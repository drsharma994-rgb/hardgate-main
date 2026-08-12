/* HARDGATE — browser bridges for fix pack 15 pure modules. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function fpClass(symbol){
  var s = String(symbol || '').toUpperCase();
  if (/(XAU|PAXG|XAUT|GOLD)/.test(s)) return 'gold';
  if (/(XAG|SILVER)/.test(s)) return 'silver';
  if (/^(BTC|WBTC)/.test(s)) return 'btc';
  if (/^(ETH|WETH|STETH)/.test(s)) return 'eth';
  return 'alt';
}
function fpSession(tsOrHour){
  var h = fin(tsOrHour);
  if (h === null) return 'sess-na';
  if (h > 24) h = new Date(h).getUTCHours();
  if (h >= 0 && h < 7) return 'sess-asia';
  if (h >= 7 && h < 12) return 'sess-london';
  if (h >= 12 && h < 17) return 'sess-overlap';
  if (h >= 17 && h < 21) return 'sess-ny-pm';
  return 'sess-late';
}
function fpAtrBucket(atrPct){
  var a = fin(atrPct);
  if (a === null) return 'atr-na';
  if (a < 0.35) return 'atr-dead';
  if (a < 0.8) return 'atr-low';
  if (a < 1.6) return 'atr-mid';
  if (a < 3.0) return 'atr-high';
  return 'atr-wild';
}
function fpConflBucket(n){
  var c = fin(n);
  if (c === null) return 'cf-na';
  if (c <= 1) return 'cf-1';
  if (c === 2) return 'cf-2';
  if (c === 3) return 'cf-3';
  return 'cf-4p';
}
function fpRrBucket(rr){
  var r = fin(rr);
  if (r === null) return 'rr-na';
  if (r < 1.5) return 'rr-lt15';
  if (r < 2.5) return 'rr-15to25';
  if (r < 4) return 'rr-25to4';
  return 'rr-4p';
}
function hgFingerprint(cand){
  cand = cand || {};
  var side = String(cand.side || cand.dir || 'flat').toLowerCase() === 'short' ? 'short' : 'long';
  var parts = {
    cls: fpClass(cand.symbol || cand.sym),
    side: side,
    poi: String(cand.poiKind || 'na').toLowerCase(),
    regime: String(cand.regime || 'reg-na').toLowerCase(),
    htf: cand.htfAlign === true ? 'htf-yes' : (cand.htfAlign === false ? 'htf-no' : 'htf-na'),
    conf: fpConflBucket(cand.confluence),
    atr: fpAtrBucket(cand.atrPct),
    sess: fpSession(cand.ts != null ? cand.ts : cand.hour),
    rr: fpRrBucket(cand.rr != null ? cand.rr : cand.rr1)
  };
  var key = [parts.cls, parts.side, parts.poi, parts.regime, parts.htf, parts.conf, parts.atr, parts.sess, parts.rr].join('|');
  return { key: key, parts: parts, coarse: [parts.cls, parts.side, parts.poi, parts.regime].join('|') };
}

function wilsonLB(wins, n, z){
  z = z || 1.96;
  if (!n || n <= 0) return 0;
  var p = wins / n, z2 = z * z, denom = 1 + z2 / n;
  var centre = p + z2 / (2 * n);
  var margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - margin) / denom);
}

function blankBucket(){
  return { n: 0, wins: 0, sumR: 0, sumR2: 0, maeSum: 0, maeN: 0, mfeSum: 0, mfeN: 0 };
}
function accBucket(a, r){
  a.n += 1;
  if (r.R > 0) a.wins += 1;
  a.sumR += r.R;
  a.sumR2 += r.R * r.R;
  if (r.maeR !== null) { a.maeSum += r.maeR; a.maeN += 1; }
  if (r.mfeR !== null) { a.mfeSum += r.mfeR; a.mfeN += 1; }
}
function edgeStats(a, prior, priorWeight){
  var expRaw = a.n ? a.sumR / a.n : 0;
  var w = a.n / (a.n + priorWeight);
  var exp = w * expRaw + (1 - w) * prior;
  var mean = expRaw;
  var varR = a.n > 1 ? Math.max(0, a.sumR2 / a.n - mean * mean) : 0;
  var sd = Math.sqrt(varR);
  var se = a.n ? Math.max(sd / Math.sqrt(a.n), 1 / Math.sqrt(a.n + priorWeight)) : 0;
  var round = function(v){ return isFinite(v) ? Math.round(v * 1000) / 1000 : null; };
  return {
    n: a.n, winRate: a.n ? a.wins / a.n : 0, winLB: wilsonLB(a.wins, a.n),
    expR: round(expRaw), expShrunk: round(exp), expLB: round(exp - 1.64 * se),
    avgMaeR: a.maeN ? round(a.maeSum / a.maeN) : null,
    avgMfeR: a.mfeN ? round(a.mfeSum / a.mfeN) : null
  };
}

function hgEdgeFor(cand, records, cfg){
  cfg = cfg || {};
  var minFull = fin(cfg.minFull); minFull = (minFull !== null) ? minFull : 8;
  var minCoarse = fin(cfg.minCoarse); minCoarse = (minCoarse !== null) ? minCoarse : 20;
  var priorWeight = fin(cfg.priorWeight); priorWeight = (priorWeight !== null) ? priorWeight : 12;
  var list = [], noFp = 0, settled = Array.isArray(records) ? records : [];
  for (var i = 0; i < settled.length; i++){
    var r = settled[i];
    if (!r || r.status !== 'settled') continue;
    var rv = fin(r.r);
    if (rv === null) continue;
    if (!r.fpKey){ noFp++; continue; }
    list.push(r);
  }
  var fp = hgFingerprint(cand);
  function agg(pred){
    var a = blankBucket();
    for (var j = 0; j < list.length; j++){
      if (pred && !pred(list[j])) continue;
      accBucket(a, { R: fin(list[j].r), maeR: fin(list[j].maeR), mfeR: fin(list[j].mfeR) });
    }
    return a;
  }
  var all = agg(null);
  var globalExp = all.n ? all.sumR / all.n : 0;
  var coarseAgg = agg(function(r){ return r.fpCoarse === fp.coarse; });
  var coarseRow = edgeStats(coarseAgg, globalExp, priorWeight);
  var exactAgg = agg(function(r){ return r.fpKey === fp.key; });
  var exactPrior = coarseAgg.n ? (coarseRow.expShrunk != null ? coarseRow.expShrunk : coarseRow.expR) : globalExp;
  var exactRow = edgeStats(exactAgg, exactPrior, priorWeight);
  var row, source, bucketRecs;
  if (exactAgg.n >= minFull){ row = exactRow; source = 'exact'; bucketRecs = list.filter(function(r){ return r.fpKey === fp.key; }); }
  else if (coarseAgg.n >= minCoarse){ row = coarseRow; source = 'coarse'; bucketRecs = list.filter(function(r){ return r.fpCoarse === fp.coarse; }); }
  else { row = edgeStats(all, globalExp, 0); source = 'prior'; bucketRecs = list; }
  var effN = (typeof G.hgEffectiveN === 'function' && typeof G.hgEventsFromRecords === 'function')
    ? G.hgEffectiveN(G.hgEventsFromRecords(bucketRecs)) : row.n;
  var expR = row.expShrunk != null ? row.expShrunk : (row.expR != null ? row.expR : globalExp);
  var lb = row.expLB != null ? row.expLB : 0;
  var tier = 'UNPROVEN';
  if (effN >= 8 && expR < -0.15) tier = 'PROVEN-BAD';
  else if (effN >= 8 && lb > 0) tier = 'PROVEN-GOOD';
  return { n: row.n, effN: Math.round(effN * 1000) / 1000, expR: expR, wilsonLB: lb,
    maeR: row.avgMaeR, mfeR: row.avgMfeR, tier: tier, source: source, noFingerprint: noFp,
    note: source === 'prior' ? 'prior/global sample' : '' };
}

function hgEdgeArchetypeLine(edge){
  if (!edge || !edge.n) return '';
  var exp = isFinite(edge.expR) ? ((edge.expR >= 0 ? '+' : '') + edge.expR.toFixed(2) + 'R') : '—';
  var lb = isFinite(edge.wilsonLB) ? ((edge.wilsonLB >= 0 ? '+' : '') + edge.wilsonLB.toFixed(2) + 'R') : '—';
  var mae = isFinite(edge.maeR) ? (' · MAE p75 ' + edge.maeR.toFixed(1) + 'R') : '';
  return 'this archetype: ' + edge.n + '/' + Math.round(edge.effN || edge.n) + ' · exp ' + exp + ' · LB ' + lb + mae;
}

function hgVenuePremium(o){
  o = o || {};
  var d = fin(o.deltaMark), b = fin(o.binanceMark);
  if (d === null || b === null || !(b > 0)) return null;
  var premBps = (d - b) / b * 10000;
  return { premBps: premBps, note: 'Delta ' + premBps.toFixed(1) + ' bps vs Binance' };
}

function hgVenuePremiumZ(history, lookback, premBps){
  lookback = lookback || 240;
  var hist = Array.isArray(history) ? history.slice() : [];
  var cur = premBps != null ? fin(premBps) : (hist.length ? fin(hist[hist.length - 1]) : null);
  var window = hist.slice(-lookback);
  var n = window.length;
  if (cur === null) return { premBps: null, z: null, n: n, stretched: false };
  var sum = 0; for (var i = 0; i < window.length; i++) sum += window[i];
  var mean = n ? sum / n : 0;
  var v = 0; for (var j = 0; j < window.length; j++) v += (window[j] - mean) * (window[j] - mean);
  var sd = n ? Math.sqrt(v / n) : 0;
  var z = (sd > 0) ? (cur - mean) / sd : null;
  return { premBps: cur, mean: mean, sd: sd, z: z, n: n, stretched: n >= 60 && z !== null && Math.abs(z) >= 2 };
}

function hgBarFreshnessChip(barAge, tf){
  tf = tf || '4h';
  if (!isFinite(barAge)) return { html: '', stale: false };
  var max = (tf === '15m' || tf === '1h') ? 2 : 1;
  if (barAge === 0) return { html: 'FRESH', stale: false, barAge: barAge };
  if (barAge <= max) return { html: 'ACTIVE', stale: false, barAge: barAge };
  return { html: 'STALE', stale: true, veto: true, barAge: barAge };
}

function hgSignalRarity(candidates, universeSize, cand){
  var list = Array.isArray(candidates) ? candidates : [];
  var uSize = Math.max(list.length, universeSize || list.length || 1);
  var target = cand || list[0] || {};
  var dir = String(target.dir || target.side || 'long').toLowerCase();
  var fam = String(target.stratKey || target.strategy || target.triggerFamily || 'na').toLowerCase();
  var sig = dir + '|' + fam;
  var shared = 0;
  for (var i = 0; i < list.length; i++){
    var c = list[i] || {};
    var d2 = String(c.dir || c.side || 'long').toLowerCase();
    var f2 = String(c.stratKey || c.strategy || c.triggerFamily || 'na').toLowerCase();
    if (d2 + '|' + f2 === sig) shared++;
  }
  var rarityPct = shared / uSize;
  var label = rarityPct <= 0.05 ? 'IDIOSYNCRATIC' : (rarityPct >= 0.25 ? 'COMMON' : 'NORMAL');
  return { sharedCount: shared, universeSize: uSize, rarityPct: rarityPct, label: label,
    note: label === 'COMMON' ? shared + '/' + uSize + ' symbols show this — beta not setup' : shared + '/' + uSize };
}

function hgRealRate(input){
  input = input || {};
  var dfii = input.dfii10Rows || input.observations || [];
  if (!dfii.length) return { measured: false, stale: true, source: 'missing' };
  var level = fin(dfii[0].value);
  var asOf = dfii[0].date || null;
  var chg20 = (dfii.length > 20 && fin(dfii[20].value) !== null) ? level - fin(dfii[20].value) : null;
  var trend = 'FLAT';
  if (chg20 !== null){ if (chg20 <= -0.05) trend = 'FALLING'; else if (chg20 >= 0.05) trend = 'RISING'; }
  return { level: level, chg20d: chg20, trend: trend, asOf: asOf, stale: false, measured: true, source: 'fred-dfii10' };
}

function hgMetalsComplex(input){
  input = input || {};
  var dir = String(input.dir || 'long').toLowerCase();
  var agree = 0, oppose = 0, dark = [];
  function inv(t){
    if (!t) return 'dark';
    t = String(t).toUpperCase();
    if (t.indexOf('FALL') >= 0 || t.indexOf('DOWN') >= 0) return dir === 'long' ? 'agree' : 'oppose';
    if (t.indexOf('RISE') >= 0 || t.indexOf('UP') >= 0) return dir === 'short' ? 'agree' : 'oppose';
    return 'dark';
  }
  function tr(t){
    if (!t) return 'dark';
    t = String(t).toUpperCase();
    if (t.indexOf('RISE') >= 0 || t.indexOf('UP') >= 0) return dir === 'long' ? 'agree' : 'oppose';
    if (t.indexOf('FALL') >= 0 || t.indexOf('DOWN') >= 0) return dir === 'short' ? 'agree' : 'oppose';
    return 'dark';
  }
  var legs = [
    tr(input.xagTrend || (input.xag && input.xag.trend20)),
    tr(input.ratioTrend),
    inv(input.dxyTrend || (input.dxy && input.dxy.trend20)),
    inv(input.realTrend || (input.real10y && input.real10y.trend))
  ];
  for (var i = 0; i < legs.length; i++){
    if (legs[i] === 'agree') agree++;
    else if (legs[i] === 'oppose') oppose++;
    else dark.push('M' + (i + 1));
  }
  var verdict = oppose >= 2 ? 'COMPLEX OPPOSES' : (agree >= 3 && oppose === 0 ? 'COMPLEX CONFIRMS' : 'MIXED');
  return { verdict: verdict, agree: agree, oppose: oppose, dark: dark };
}

function hgGoldVenueSpread(input){
  input = input || {};
  if (input.cashOpen === false){
    return { gated: true, note: 'Cash gold closed — weekend spreads not positioning', darkVenues: ['spot'] };
  }
  var spot = fin(input.spot);
  var spreads = {};
  var dark = [];
  if (spot === null) dark.push('spot');
  ['xauusdt', 'paxg', 'xaut'].forEach(function(k){
    var px = fin(input[k]);
    if (px === null || spot === null) { spreads[k] = null; dark.push(k); }
    else spreads[k] = Math.round((px - spot) / spot * 10000 * 10) / 10;
  });
  return { gated: false, spreads: spreads, darkVenues: dark, dislocated: false };
}

function hgGoldAPlus(cand, ctx){
  if (typeof G.__hgGoldAPlusPure === 'function') return G.__hgGoldAPlusPure(cand, ctx);
  cand = cand || {}; ctx = ctx || {};
  var legs = [], failed = [], darkLegs = [];
  function add(name, state, detail){
    legs.push({ name: name, state: state, detail: detail || '' });
    if (state === 'veto') failed.push(name);
    if (state === 'dark') darkLegs.push(name);
  }
  var barAge = fin(cand.barAge);
  if (barAge === null) add('L1 trigger fresh', 'dark');
  else if (barAge > 2) add('L1 trigger fresh', 'veto', 'stale');
  else add('L1 trigger fresh', 'pass');
  if (cand.sweepExempt) add('L2 HTF alignment', 'veto', 'sweep exempt never A+');
  else if (cand.htfAlign === false) add('L2 HTF alignment', 'veto');
  else if (cand.htfAlign === true) add('L2 HTF alignment', 'pass');
  else add('L2 HTF alignment', 'dark');
  var rr = fin(cand.rr != null ? cand.rr : cand.rr1);
  if (rr === null) add('L3 structural R:R', 'dark');
  else if (rr < 2) add('L3 structural R:R', 'veto', rr.toFixed(1) + ' vs 2.0');
  else add('L3 structural R:R', 'pass');
  add('L4 structural stop', cand.stopIsAtrOnly ? 'veto' : (cand.anchor ? 'pass' : 'dark'));
  var er = fin(cand.er);
  if (er === null) add('L5 Kaufman ER', 'dark');
  else add('L5 Kaufman ER', er >= 0.35 || er <= 0.25 ? 'pass' : 'veto');
  add('L9 metals complex', ctx.metalsComplex ? (ctx.metalsComplex.verdict === 'COMPLEX CONFIRMS' ? 'pass' : (ctx.metalsComplex.verdict === 'COMPLEX OPPOSES' ? 'veto' : 'dark')) : 'dark');
  add('L10 real rates', ctx.realRate && ctx.realRate.measured ? 'pass' : 'dark');
  add('L11 COT crowding', ctx.cot ? 'pass' : 'dark');
  add('L12 venue dislocation', ctx.goldVenueSpread ? (ctx.goldVenueSpread.gated ? 'dark' : 'pass') : 'dark');
  add('L13 ledger edge', ctx.edge && ctx.edge.tier === 'PROVEN-BAD' ? 'veto' : (ctx.edge ? 'pass' : 'dark'));
  var passN = 0; for (var i = 0; i < legs.length; i++) if (legs[i].state === 'pass') passN++;
  var soleBlocker = failed.length === 1 ? failed[0] : null;
  return { aplus: !failed.length && !darkLegs.length && passN === legs.length, legs: legs, failed: failed,
    darkLegs: darkLegs, passN: passN, total: legs.length, soleBlocker: soleBlocker,
    note: failed.length ? 'NOT A+ — ' + passN + '/' + legs.length : 'GOLD A+' };
}

G.hgFingerprint = hgFingerprint;
G.hgEdgeFor = hgEdgeFor;
G.hgEdgeArchetypeLine = hgEdgeArchetypeLine;
G.hgVenuePremium = hgVenuePremium;
G.hgVenuePremiumZ = hgVenuePremiumZ;
G.hgBarFreshnessChip = hgBarFreshnessChip;
G.hgSignalRarity = hgSignalRarity;
G.hgRealRate = hgRealRate;
G.hgMetalsComplex = hgMetalsComplex;
G.hgGoldVenueSpread = hgGoldVenueSpread;
G.hgGoldAPlus = hgGoldAPlus;

function hgTallyLegAudit(records){
  records = Array.isArray(records) ? records : [];
  var defs = ['killzone','news','macro','paxg','seasonal','fear','agreeing read'];
  var out = [];
  for (var d = 0; d < defs.length; d++){
    var m = defs[d];
    var withN = 0, withoutN = 0, sumW = 0, sumWo = 0;
    for (var i = 0; i < records.length; i++){
      var r = records[i];
      if (!r || r.status !== 'settled' || !isFinite(r.r)) continue;
      var parts = Array.isArray(r.tallyParts) ? r.tallyParts : [];
      var has = false;
      for (var j = 0; j < parts.length; j++){
        if (parts[j] && String(parts[j].label || '').toLowerCase().indexOf(m) >= 0){ has = true; break; }
      }
      if (has){ withN++; sumW += r.r; } else { withoutN++; sumWo += r.r; }
    }
    var liftR = (withN && withoutN) ? (sumW / withN - sumWo / withoutN) : null;
    var verdict = 'UNPROVEN';
    if (withN >= 12 && liftR !== null){
      if (liftR >= 0.15) verdict = 'CARRIES';
      else if (liftR <= -0.05) verdict = 'NOISE';
      else verdict = 'NEUTRAL';
    } else if (withN >= 8 && liftR !== null && liftR <= -0.04) verdict = 'NOISE';
    out.push({ leg: m, nWith: withN, nWithout: withoutN, liftR: liftR, verdict: verdict });
  }
  return out;
}
G.hgTallyLegAudit = hgTallyLegAudit;

})();
