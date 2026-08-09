/* HARDGATE — formation instrumentation wiring (pure helpers). */
import { fingerprint, fpClass } from './setup-fingerprint.mjs';
import { formationQuality, fqsGate } from './formation-quality.mjs';
import { buildEdgeTable, edgeGate } from './edge-table.mjs';
import { createGateRecorder } from './gate-attrib.mjs';
import { shadowFromCandidate } from './shadow-book.mjs';
import { ftFormationFilter, ftCfgFromEnv } from './freqtrade-formation.mjs';

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function formationCfgFromEnv(env){
  env = env || {};
  return {
    fqsGate: env.HARDGATE_FQS_GATE === '1' || env.HARDGATE_FQS_GATE === 'true',
    fqsFloor: num(env.HARDGATE_FQS_FLOOR),
    edgeGate: env.HARDGATE_EDGE_GATE === '1' || env.HARDGATE_EDGE_GATE === 'true',
    edgeMinN: num(env.HARDGATE_EDGE_MIN_N) ?? 8,
    edgeBlockLB: num(env.HARDGATE_EDGE_BLOCK_LB) ?? -0.15,
    priorWeight: num(env.HARDGATE_EDGE_PRIOR_WEIGHT) ?? 12,
  };
}

function rrFromPlan(entry, stop, t1){
  entry = +entry; stop = +stop; t1 = +t1;
  if (!(isFinite(entry) && isFinite(stop) && isFinite(t1))) return null;
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return null;
  return Math.abs(t1 - entry) / risk;
}

function evidenceConfluence(evidence){
  if (!Array.isArray(evidence)) return null;
  return evidence.length;
}

function htfFromEvidence(evidence){
  if (!Array.isArray(evidence)) return null;
  var bull = evidence.some(function(e){ return /TREND4H:\s*bull/i.test(String(e)); });
  var bear = evidence.some(function(e){ return /TREND4H:\s*bear/i.test(String(e)); });
  if (bull) return true;
  if (bear) return false;
  return null;
}

export function brainRowToCandidate(row){
  if (!row || !row.plan) return null;
  var p = row.plan;
  var sym = row.sym || row.symbol;
  return {
    symbol: sym,
    sym: sym,
    side: row.dir || row.side || 'long',
    dir: row.dir || row.side || 'long',
    entry: p.entry,
    stop: p.stop,
    t1: p.t1,
    target: p.t1,
    poiKind: row.poiKind || p.poiKind || null,
    regime: row.regime || p.regime || null,
    htfAlign: row.htfAlign != null ? row.htfAlign : htfFromEvidence(row.evidence),
    confluence: row.confluence != null ? row.confluence : evidenceConfluence(row.evidence),
    atrPct: row.atrPct || p.atrPct || null,
    rr: row.rr != null ? row.rr : rrFromPlan(p.entry, p.stop, p.t1),
    oiflowState: row.oiflowState || null,
    tier: row.tier || null,
    ts: row.ts || Date.now(),
    riskOnScore: row.riskOnScore != null ? row.riskOnScore : (row.desk && row.desk.riskOnScore),
    desk: row.desk || null,
    realRateHint: row.realRateHint || (row.desk && row.desk.realRateHint) || null,
    _row: row,
  };
}

export function intentToCandidate(intent){
  if (!intent) return null;
  var sym = intent.sym || intent.symbol;
  return {
    symbol: sym,
    sym: sym,
    side: intent.dir || intent.side || 'long',
    dir: intent.dir || intent.side || 'long',
    entry: intent.entry,
    stop: intent.stop,
    t1: intent.t1,
    target: intent.t1,
    poiKind: intent.poiKind || null,
    regime: intent.regime || null,
    htfAlign: intent.htfAlign,
    confluence: intent.confluence,
    atrPct: intent.atrPct,
    rr: intent.rr != null ? intent.rr : rrFromPlan(intent.entry, intent.stop, intent.t1),
    oiflowState: intent.oiflowState || null,
    klass: intent.klass || null,
    ts: intent.ts || Date.now(),
  };
}

export function attachFingerprint(target, cand){
  try{
    var fp = fingerprint(cand || target || {});
    target.fpKey = fp.key;
    target.fpParts = fp.parts;
    return fp;
  }catch(e){ return { key: '', parts: {} }; }
}

export function closedPositionToLedgerRow(pos){
  if (!pos) return null;
  var entry = +pos.entry, stop = +pos.stop;
  var risk = Math.abs(entry - stop);
  var r = null;
  if (pos.r != null && isFinite(+pos.r)) r = +pos.r;
  else if (isFinite(+pos.mark) && risk > 0){
    var move = (String(pos.dir).toLowerCase() === 'short') ? (entry - pos.mark) : (pos.mark - entry);
    r = move / risk;
  }
  if (r === null) return null;
  return Object.assign({}, pos.fpParts ? { fpKey: pos.fpKey } : {}, {
    symbol: pos.sym,
    side: pos.dir,
    poiKind: pos.poiKind || null,
    regime: pos.regime || null,
    htfAlign: pos.htfAlign,
    confluence: pos.confluence,
    atrPct: pos.atrPct,
    rr: pos.rr != null ? pos.rr : rrFromPlan(pos.entry, pos.stop, pos.t1),
    r: r,
    maeR: pos.maeR != null ? +pos.maeR : null,
    mfeR: pos.mfeR != null ? +pos.mfeR : null,
  });
}

export function ledgerClosedRows(book, outcomes){
  var rows = [];
  if (book && Array.isArray(book.closed)){
    for (var i = 0; i < book.closed.length; i++){
      var rec = closedPositionToLedgerRow(book.closed[i]);
      if (rec) rows.push(rec);
    }
  }
  if (Array.isArray(outcomes)){
    for (var j = 0; j < outcomes.length; j++){
      var o = outcomes[j];
      if (!o || !isFinite(+o.r)) continue;
      rows.push({
        symbol: o.sym,
        side: o.side || 'long',
        r: +o.r,
        fpKey: o.fpKey || null,
        poiKind: o.poiKind || null,
        regime: o.regime || null,
      });
    }
  }
  return rows;
}

/**
 * processFormationCandidates(candidates, ctx)
 * ctx: { ledgerRows, cfg, gates, onSkip, onShadow, env }
 */
export function processFormationCandidates(candidates, ctx){
  ctx = ctx || {};
  var cfg = ctx.cfg || formationCfgFromEnv(ctx.env || process.env);
  var gates = ctx.gates || createGateRecorder();
  var edgeTbl = ctx.edgeTbl || buildEdgeTable(ctx.ledgerRows || [], { priorWeight: cfg.priorWeight });
  var out = [];
  var skipped = 0;
  var arr = (Array.isArray(candidates) ? candidates : []).slice();

  for (var i = 0; i < arr.length; i++){
    var cand = arr[i];
    if (!cand) continue;
    attachFingerprint(cand, cand);

    var q = fqsGate(cand, fpClass(cand.symbol), cfg.fqsFloor);
    cand.fqs = q.quality.fqs;
    cand.fqsGrade = q.quality.grade;
    cand.fqsPillars = q.quality.pillars;
    cand.fqsWeakest = q.quality.weakest;
    cand.fqsNotes = q.quality.notes;
    gates.record('fqs', q.ok || !cfg.fqsGate, { symbol: cand.symbol || cand.sym, reason: q.reason, fqs: cand.fqs });
    if (cfg.fqsGate && !q.ok){
      skipped++;
      if (ctx.onSkip) ctx.onSkip(cand, q.reason, 'fqs');
      if (ctx.onShadow) ctx.onShadow(shadowFromCandidate(cand, 'fqs'));
      continue;
    }

    var eg = edgeGate(cand, edgeTbl, { minN: cfg.edgeMinN, blockBelowExpLB: cfg.edgeBlockLB });
    gates.record('edge', eg.ok || !cfg.edgeGate, { symbol: cand.symbol || cand.sym, reason: eg.reason });
    if (cfg.edgeGate && !eg.ok){
      skipped++;
      if (ctx.onSkip) ctx.onSkip(cand, eg.reason, 'edge');
      if (ctx.onShadow) ctx.onShadow(shadowFromCandidate(cand, 'edge'));
      continue;
    }
    cand.sizeMult = (cand.sizeMult != null ? cand.sizeMult : 1) * (eg.mult || 1);
    cand.edgeRow = eg.row;
    cand.edgeReason = eg.reason;
    out.push(cand);
  }

  out.sort(function(a, b){ return (b.fqs || 0) - (a.fqs || 0); });

  var ft = ftFormationFilter(out, {
    ledgerRows: ctx.ledgerRows || [],
    tradeHistory: ctx.tradeHistory || ctx.ledgerRows || [],
    ftCfg: Object.assign({}, formationCfgFromEnv(ctx.env || process.env), ftCfgFromEnv(ctx.env || process.env)),
    env: ctx.env || process.env,
    gates: gates,
    onSkip: ctx.onSkip,
    nowMs: ctx.nowMs,
  });
  out = ft.passed;
  skipped += ft.skipped;

  return { passed: out, skipped: skipped, edgeTbl: edgeTbl, gates: gates, cfg: cfg, ftCtx: ft.ftCtx };
}

export function fqsLine(cand){
  try{
    var q = formationQuality(cand || {});
    var p = q.pillars;
    return q.grade + ' ' + q.fqs + ' | struct ' + p.structure + ' poi ' + p.poi + ' liq ' + p.liquidity
      + ' part ' + p.participation + ' time ' + p.timing + ' geo ' + p.geometry + ' macro ' + p.macro;
  }catch(e){ return ''; }
}

export { formationQuality, fqsGate, buildEdgeTable, edgeGate, createGateRecorder, fingerprint, fpClass };
