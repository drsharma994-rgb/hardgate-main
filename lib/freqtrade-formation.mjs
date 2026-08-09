/* HARDGATE — Freqtrade concepts wired into formation pipeline. */
import { ftEdgeTable, ftEdgeGate, ftStoplossSweep, ftExpectancy } from './freqtrade-edge.mjs';
import { ftProtectionGate } from './freqtrade-protections.mjs';

export function ftCfgFromEnv(env){
  env = env || {};
  return {
    edgeGate: env.HARDGATE_FT_EDGE_GATE === '1' || env.HARDGATE_FT_EDGE_GATE === 'true',
    protectGate: env.HARDGATE_FT_PROTECT === '1' || env.HARDGATE_FT_PROTECT === 'true',
    minExpectancy: +(env.HARDGATE_FT_MIN_EXPECTANCY || 0),
    minTrades: +(env.HARDGATE_FT_MIN_TRADES || 6),
    cooldownMinutes: +(env.HARDGATE_FT_COOLDOWN_MIN || 30),
    stoplossTradeLimit: +(env.HARDGATE_FT_SL_GUARD_LIMIT || 4),
    stoplossLookbackMin: +(env.HARDGATE_FT_SL_GUARD_LOOKBACK || 240),
  };
}

export function ftFormationContext(ledgerRows, opts = {}){
  opts = opts || {};
  var keyFn = opts.keyFn || function(r){ return r.fpKey || String(r.symbol || r.sym || '').toUpperCase(); };
  var table = ftEdgeTable(ledgerRows || [], {
    minimumExpectancy: opts.minExpectancy ?? 0,
    minTrades: opts.minTrades ?? 4,
    keyFn: keyFn,
  });
  var sweep = ftStoplossSweep(ledgerRows || [], null, { minimumExpectancy: opts.minExpectancy ?? 0 });
  return { table: table, stopSweep: sweep };
}

/** Apply Freqtrade edge + protections to formation candidates (after FQS/edge). */
export function ftFormationFilter(candidates, ctx){
  ctx = ctx || {};
  var cfg = ctx.ftCfg || ftCfgFromEnv(ctx.env || process.env);
  var ledger = ctx.ledgerRows || [];
  var trades = ctx.tradeHistory || ledger;
  var now = ctx.nowMs || Date.now();
  var gates = ctx.gates;
  var ftCtx = ctx.ftCtx || ftFormationContext(ledger, {
    minExpectancy: cfg.minExpectancy,
    minTrades: cfg.minTrades,
    keyFn: function(r){ return r.fpKey || String(r.symbol || r.sym || '').toUpperCase(); },
  });
  var table = ftCtx.table;
  var out = [];
  var skipped = 0;

  for (var i = 0; i < (candidates || []).length; i++){
    var cand = candidates[i];
    if (!cand) continue;

    var pg = ftProtectionGate(cand, trades, now, {
      cooldown: { cooldownMinutes: cfg.cooldownMinutes },
      stoplossGuard: {
        tradeLimit: cfg.stoplossTradeLimit,
        lookbackMinutes: cfg.stoplossLookbackMin,
        onlyPerPair: true,
      },
    });
    if (gates) gates.record('ft_protect', pg.ok || !cfg.protectGate, { symbol: cand.symbol || cand.sym, reason: pg.reason });
    if (cfg.protectGate && !pg.ok){
      skipped++;
      if (ctx.onSkip) ctx.onSkip(cand, pg.reason, 'ft_protect');
      continue;
    }

    var eg = ftEdgeGate(cand, table, {
      minimumExpectancy: cfg.minExpectancy,
      minTrades: cfg.minTrades,
    });
    cand.ftExpectancy = eg.row && eg.row.expectancy != null ? eg.row.expectancy : null;
    cand.ftWinRate = eg.row && eg.row.winRate != null ? eg.row.winRate : null;
    cand.ftEdgeReason = eg.reason;
    if (gates) gates.record('ft_edge', eg.ok || !cfg.edgeGate, { symbol: cand.symbol || cand.sym, reason: eg.reason });
    if (cfg.edgeGate && !eg.ok){
      skipped++;
      if (ctx.onSkip) ctx.onSkip(cand, eg.reason, 'ft_edge');
      continue;
    }
    cand.sizeMult = (cand.sizeMult != null ? cand.sizeMult : 1) * (eg.mult || 1);
    out.push(cand);
  }

  return { passed: out, skipped: skipped, ftCtx: ftCtx, cfg: cfg };
}

/** Boost formation score 0..15 from Freqtrade expectancy (browser + server). */
export function ftFormationScoreBoost(cand, ledgerRows){
  try{
    if (!cand) return 0;
    var key = cand.fpKey || String(cand.symbol || cand.sym || '').toUpperCase();
    var table = ftEdgeTable(ledgerRows || [], { keyFn: function(r){ return r.fpKey || String(r.symbol || r.sym || '').toUpperCase(); } });
    var row = table.lookup(key);
    if (!row || !row.n || row.n < 3) return 0;
    var exp = row.expectancy;
    if (exp === 'inf') return 12;
    if (exp === null) return 0;
    if (exp >= 0.5) return 15;
    if (exp >= 0.25) return 10;
    if (exp >= 0) return 5;
    if (exp >= -0.15) return -3;
    return -8;
  }catch(e){ return 0; }
}

export { ftExpectancy, ftEdgeTable, ftStoplossSweep, ftProtectionGate };
