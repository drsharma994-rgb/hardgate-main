/* HARDGATE — browser meta-label bridge (MLFinLab-style, loads after scorecard.js). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function num(v){ var n = +v; return (v === undefined || v === null || v === '' || !isFinite(n)) ? null : n; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function fpClass(sym){
  var s = String(sym || '').toUpperCase();
  if (/(XAU|PAXG|XAUT|GOLD)/.test(s)) return 'gold';
  if (/^(BTC|WBTC)/.test(s)) return 'btc';
  if (/^(ETH|WETH)/.test(s)) return 'eth';
  return 'alt';
}

function bucketKey(plan){
  var side = String(plan.dir || plan.side || 'long').toLowerCase() === 'short' ? 'short' : 'long';
  var tier = String(plan.tier || 'na').toLowerCase();
  var poi = String(plan.poi || plan.poiKind || 'none').toLowerCase();
  return fpClass(plan.sym || plan.symbol) + '|' + side + '|' + tier + '|' + poi;
}

function ledgerBucketStats(records){
  var map = {};
  for (var i = 0; i < (records || []).length; i++){
    var r = records[i];
    if (!r || r.status !== 'settled' || !isFinite(+r.r)) continue;
    var k = bucketKey(r);
    if (!map[k]) map[k] = { n: 0, sumR: 0, wins: 0 };
    map[k].n++; map[k].sumR += +r.r;
    if (+r.r > 0) map[k].wins++;
  }
  for (var key in map){
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
    var s = map[key];
    s.expR = s.n ? s.sumR / s.n : 0;
    s.winRate = s.n ? s.wins / s.n : 0;
  }
  return map;
}

function featureScore(plan, ctx){
  ctx = ctx || {};
  var s = 0.5;
  var fqs = num(plan.fqs != null ? plan.fqs : plan.formationScore);
  if (fqs !== null) s += (fqs - 50) / 100;
  var fill = num(plan.fillProb);
  if (fill !== null) s += (fill - 40) / 200;
  var rr = num(plan.rr != null ? plan.rr : plan.rr1);
  if (rr !== null) s += rr >= 2.5 ? 0.12 : rr >= 2 ? 0.06 : rr < 1.5 ? -0.15 : 0;
  if (plan.htfAlign === true) s += 0.08;
  if (plan.htfAlign === false) s -= 0.1;
  if (plan.eventBlackout === true) s -= 0.25;
  if (ctx.newsRisk === 'high') s -= 0.2;
  else if (ctx.newsRisk === 'medium') s -= 0.08;
  if (plan.poi === 'sweep' || plan.poiKind === 'sweep-reclaim') s += 0.1;
  return clamp(s, 0, 1);
}

function hgMetaLabel(plan, ctx, ledgerRecords){
  ctx = ctx || {};
  if (!plan || !plan.dir){
    return { take: false, prob: 0, verdict: 'SKIP', confidence: 'low', reason: 'no plan', features: {} };
  }
  var buckets = ledgerBucketStats(ledgerRecords);
  var key = bucketKey(plan);
  var bucket = buckets[key] || null;
  var feat = featureScore(plan, ctx);
  var prob = feat;
  var reason = 'feature score ' + Math.round(feat * 100) + '%';
  if (bucket && bucket.n >= 5){
    var hist = clamp(0.5 + bucket.expR * 0.25 + (bucket.winRate - 0.5) * 0.4, 0.05, 0.95);
    prob = clamp(feat * 0.45 + hist * 0.55, 0.05, 0.95);
    reason = 'ledger n=' + bucket.n + ' E[R]=' + bucket.expR.toFixed(2) + ' · ' + reason;
  } else if (bucket && bucket.n >= 2){
    prob = clamp(feat * 0.7 + (0.5 + bucket.expR * 0.2) * 0.3, 0.05, 0.95);
    reason = 'thin ledger n=' + bucket.n + ' · ' + reason;
  }
  var floor = num(ctx.metaFloor) != null ? ctx.metaFloor : 0.52;
  var take = prob >= floor;
  var verdict = take ? (prob >= 0.68 ? 'TAKE' : 'TAKE-CAUTIOUS') : 'SKIP';
  var confidence = prob >= 0.72 || prob <= 0.35 ? 'high' : prob >= 0.58 || prob <= 0.48 ? 'medium' : 'low';
  return {
    take: take,
    prob: Math.round(prob * 1000) / 1000,
    verdict: verdict,
    confidence: confidence,
    reason: reason,
    bucket: bucket ? { key: key, n: bucket.n, expR: bucket.expR, winRate: bucket.winRate } : null,
    features: { featScore: Math.round(feat * 100), fqs: num(plan.fqs != null ? plan.fqs : plan.formationScore), fill: num(plan.fillProb), rr: num(plan.rr != null ? plan.rr : plan.rr1) },
  };
}

try{
  G.hgMetaLabel = hgMetaLabel;
  G.HG_META_FLOOR = 0.52;
}catch(e){}

})();
