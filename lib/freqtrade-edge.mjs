/* HARDGATE — Freqtrade Edge math (pure JS port of freqtrade edge positioning concepts).
   Reference: https://github.com/freqtrade/freqtrade — expectancy = RRR * win_rate - (1 - win_rate)
   Never throws. */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, dp = 3) => (Number.isFinite(v) ? Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp) : null);

/** Classic Freqtrade expectancy from win rate + risk-reward ratio (per trade, in R units). */
export function ftExpectancy(winRate, riskRewardRatio){
  var w = num(winRate);
  var r = num(riskRewardRatio);
  if (w === null || r === null) return null;
  w = Math.max(0, Math.min(1, w));
  return round(r * w - (1 - w));
}

/** Minimum RRR required for positive expectancy at this win rate (minExp default 0). */
export function ftRequiredRiskReward(winRate, minExpectancy = 0){
  var w = num(winRate);
  var m = num(minExpectancy) ?? 0;
  if (w === null || w <= 0) return null;
  if (w >= 1) return 0;
  return round((1 + m) / w - 1);
}

/** Average win R / |average loss R| from settled trades. */
export function ftRiskRewardFromTrades(trades){
  var wins = 0, loss = 0, winSum = 0, lossSum = 0;
  for (var i = 0; i < (trades || []).length; i++){
    var r = num(trades[i]?.r ?? trades[i]?.R ?? trades[i]?.realizedR);
    if (r === null) continue;
    if (r > 0){ wins++; winSum += r; }
    else if (r < 0){ loss++; lossSum += Math.abs(r); }
  }
  if (!wins || !loss) return wins && !loss ? Infinity : null;
  return round(winSum / wins / (lossSum / loss));
}

/** Build edge row for a symbol/fingerprint family from settled R-scored trades. */
export function ftEdgeRow(trades, opts = {}){
  opts = opts || {};
  var minExp = num(opts.minimumExpectancy) ?? 0;
  var arr = (Array.isArray(trades) ? trades : []).filter(function(t){
    return num(t?.r ?? t?.R ?? t?.realizedR) !== null;
  });
  var n = arr.length;
  if (!n){
    return { n: 0, winRate: null, riskRewardRatio: null, expectancy: null, requiredRR: null, ok: false, reason: 'no-trades' };
  }
  var wins = 0, winSum = 0, lossSum = 0, lossN = 0;
  for (var i = 0; i < arr.length; i++){
    var r = num(arr[i].r ?? arr[i].R ?? arr[i].realizedR);
    if (r > 0){ wins++; winSum += r; }
    else if (r < 0){ lossN++; lossSum += Math.abs(r); }
  }
  var winRate = wins / n;
  var rrr = ftRiskRewardFromTrades(arr);
  var exp = rrr === Infinity ? Infinity : (rrr !== null ? ftExpectancy(winRate, rrr) : null);
  var req = ftRequiredRiskReward(winRate, minExp);
  var ok = exp === Infinity || (exp !== null && exp >= minExp);
  return {
    n: n,
    wins: wins,
    losses: lossN,
    winRate: round(winRate, 4),
    avgWinR: wins ? round(winSum / wins) : null,
    avgLossR: lossN ? round(lossSum / lossN) : null,
    riskRewardRatio: rrr === Infinity ? 'inf' : rrr,
    expectancy: exp === Infinity ? 'inf' : exp,
    requiredRiskReward: req,
    ok: ok,
    reason: ok ? 'edge-ok' : 'below-min-expectancy',
  };
}

/** Group ledger rows by key fn and rank families (Freqtrade pair whitelist style). */
export function ftEdgeTable(rows, opts = {}){
  opts = opts || {};
  var minExp = num(opts.minimumExpectancy) ?? 0;
  var minN = num(opts.minTrades) ?? 4;
  var keyFn = typeof opts.keyFn === 'function' ? opts.keyFn : function(r){
    return String(r.symbol || r.sym || 'unknown').toUpperCase();
  };
  var buckets = new Map();
  var all = [];
  for (var i = 0; i < (rows || []).length; i++){
    var raw = rows[i];
    var r = num(raw?.r ?? raw?.R ?? raw?.realizedR);
    if (r === null) continue;
    all.push(raw);
    var k = keyFn(raw);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(raw);
  }
  var global = ftEdgeRow(all, { minimumExpectancy: minExp });
  var families = [];
  for (var [key, trades] of buckets){
    var row = ftEdgeRow(trades, { minimumExpectancy: minExp });
    families.push(Object.assign({ key: key }, row));
  }
  families.sort(function(a, b){
    var ea = a.expectancy === 'inf' ? 999 : (a.expectancy ?? -999);
    var eb = b.expectancy === 'inf' ? 999 : (b.expectancy ?? -999);
    return eb - ea;
  });
  return {
    global: global,
    families: families,
    whitelist: families.filter(function(f){ return f.n >= minN && f.ok; }),
    lookup(key){
      var trades = buckets.get(key) || [];
      return ftEdgeRow(trades, { minimumExpectancy: minExp });
    },
  };
}

/**
 * Stoploss sweep on trades with maeR — simulates tighter stops (Freqtrade edge stop grid).
 * stopScales: multiply actual stop distance by scale (<1 = tighter stop).
 */
export function ftStoplossSweep(trades, stopScales, opts = {}){
  opts = opts || {};
  var minExp = num(opts.minimumExpectancy) ?? 0;
  var scales = Array.isArray(stopScales) && stopScales.length
    ? stopScales
    : [0.5, 0.65, 0.8, 0.9, 1.0, 1.1, 1.25];
  var arr = (Array.isArray(trades) ? trades : []).filter(function(t){
    return num(t?.r ?? t?.R) !== null && num(t?.maeR) !== null;
  });
  if (!arr.length) return { best: null, grid: [], reason: 'need maeR on settled trades' };

  var grid = [];
  for (var si = 0; si < scales.length; si++){
    var scale = scales[si];
    var sim = [];
    for (var i = 0; i < arr.length; i++){
      var r = num(arr[i].r ?? arr[i].R);
      var mae = num(arr[i].maeR);
      if (mae === null) continue;
      /* tighter stop: if MAE would have hit scaled stop, count as loss (-1R approx) */
      var stopped = mae >= scale;
      sim.push({ r: stopped ? -1 : r });
    }
    var row = ftEdgeRow(sim, { minimumExpectancy: minExp });
    grid.push(Object.assign({ stopScale: scale }, row));
  }
  grid.sort(function(a, b){
    var ea = a.expectancy === 'inf' ? 999 : (a.expectancy ?? -999);
    var eb = b.expectancy === 'inf' ? 999 : (b.expectancy ?? -999);
    if (eb !== ea) return eb - ea;
    return (b.winRate ?? 0) - (a.winRate ?? 0);
  });
  return { best: grid[0] || null, grid: grid, reason: null };
}

/** Gate a candidate using historical edge for its fingerprint key. */
export function ftEdgeGate(cand, table, cfg = {}){
  cfg = cfg || {};
  var minExp = num(cfg.minimumExpectancy) ?? 0;
  var minN = num(cfg.minTrades) ?? 6;
  var exploreBelowN = cfg.exploreBelowN !== false;
  if (!table || typeof table.lookup !== 'function'){
    return { ok: true, reason: 'no-ft-table', mult: 1, row: null };
  }
  var key = cand.fpKey || cand.key || String(cand.symbol || cand.sym || '').toUpperCase();
  var row = table.lookup(key);
  if (!row || !row.n){
    return { ok: true, reason: 'ft-explore(no-history)', mult: 1, row: row };
  }
  if (row.n < minN){
    return exploreBelowN
      ? { ok: true, reason: 'ft-explore(n=' + row.n + ')', mult: 1, row: row }
      : { ok: false, reason: 'ft-insufficient-n(' + row.n + ')', mult: 0, row: row };
  }
  var exp = row.expectancy;
  if (exp !== 'inf' && exp !== null && exp < minExp){
    return { ok: false, reason: 'ft-expectancy(' + exp + '<' + minExp + ')', mult: 0, row: row };
  }
  var mult = 1;
  if (exp === 'inf' || (exp !== null && exp >= 0.5)) mult = 1.15;
  else if (exp !== null && exp >= 0.2) mult = 1.05;
  else if (exp !== null && exp < 0) mult = 0.75;
  return { ok: true, reason: 'ft-edge-ok(exp=' + exp + ')', mult: mult, row: row };
}
