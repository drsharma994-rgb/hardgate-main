/* HARDGATE — browser bridge for Increment 4 pure libs (COT, Fed liq, Coinalyze, etc.) */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/* gold COT gate mirror */
function goldCotGate(assess, dir){
  try{
    assess = assess || {};
    dir = String(dir || '').toLowerCase();
    var z = fin(assess.zScore);
    var out = { veto: false, bonus: false, tag: null, note: '', zScore: z };
    if (z === null) return out;
    if (z > 2 && dir === 'long'){ out.veto = true; out.note = 'COT crowded long veto (z=' + z.toFixed(2) + ')'; }
    else if (z < -2 && dir === 'long'){ out.bonus = true; out.note = 'COT crowded short bonus (z=' + z.toFixed(2) + ')'; }
    else if (z < -2 && dir === 'short'){ out.veto = true; out.note = 'COT crowded short veto (z=' + z.toFixed(2) + ')'; }
    else if (z > 2 && dir === 'short'){ out.bonus = true; out.note = 'COT crowded long bonus (z=' + z.toFixed(2) + ')'; }
    var rd = assess.reportDate;
    if (rd && Math.abs(z) >= 2){
      var age = (Date.now() - rd) / 86400000;
      if (age >= 0 && age <= 5) out.tag = 'COT EXTREME';
    }
    return out;
  }catch(e){ return { veto: false, bonus: false, tag: null, note: '' }; }
}

function coinalyzeSymbolsForBase(base){
  base = String(base || '').toUpperCase().replace(/USDT$/, '');
  var sym = base + 'USDT_PERP';
  return [sym + '.A', sym + '.6', sym + '.3', sym + '.2', sym + '.4'];
}

function coinalyzeMergeOI(rows){
  rows = rows || [];
  var agg = 0, bin = null, n = 0;
  for (var i = 0; i < rows.length; i++){
    var v = fin(rows[i] && rows[i].value);
    if (v === null || v <= 0) continue;
    agg += v; n++;
    if (String(rows[i].symbol || '').indexOf('.A') >= 0) bin = v;
  }
  if (!(agg > 0)) return null;
  return { aggOIUsd: agg, binanceOIUsd: bin, venues: n };
}

function coinalyzeOIChgPct(histories){
  histories = histories || {};
  var keys = Object.keys(histories), times = {}, series = [];
  for (var i = 0; i < keys.length; i++){
    var h = histories[keys[i]] || [];
    for (var j = 0; j < h.length; j++) if (h[j] && isFinite(h[j].t)) times[h[j].t] = 1;
  }
  var ts = Object.keys(times).map(Number).sort(function(a,b){ return a-b; });
  for (var k = 0; k < ts.length; k++){
    var t = ts[k], sum = 0, c = 0;
    for (var vi = 0; vi < keys.length; vi++){
      var arr = histories[keys[vi]] || [];
      for (var m = 0; m < arr.length; m++){
        if (arr[m] && arr[m].t === t){ sum += arr[m].v; c++; }
      }
    }
    if (c) series.push({ t: t, oi: sum });
  }
  if (series.length < 2) return null;
  var first = series[0].oi, last = series[series.length - 1].oi;
  if (!(first > 0)) return null;
  return { chgPct: (last / first - 1) * 100 };
}

function carryNetApr(fundingApr, borrowApr){
  var f = fin(fundingApr), b = fin(borrowApr);
  if (f === null) return null;
  if (b === null) return { netApr: f, grossApr: f, borrowApr: null };
  return { netApr: f - b, grossApr: f, borrowApr: b };
}

function liquidityBetweenLevels(levels, fromPx, toPx){
  levels = levels || [];
  var lo = Math.min(fromPx, toPx), hi = Math.max(fromPx, toPx), usd = 0;
  for (var i = 0; i < levels.length; i++){
    var p = fin(levels[i][0]), q = fin(levels[i][1]);
    if (p === null || q === null) continue;
    if (p >= lo && p <= hi) usd += p * q;
  }
  return usd;
}

function liquidityToStop(book, dir, entry, stop, positionUsd){
  if (!book || entry == null || stop == null) return null;
  var path = dir === 'long'
    ? liquidityBetweenLevels(book.bids, entry, stop)
    : liquidityBetweenLevels(book.asks, entry, stop);
  var ratio = (positionUsd > 0) ? path / positionUsd : null;
  return { pathLiquidityUsd: path, ratio: ratio, thin: ratio !== null && ratio < 3, slippageProne: ratio !== null && ratio < 3 };
}

function bookImbalance(book){
  if (!book) return null;
  var bid = fin(book.bidUsd), ask = fin(book.askUsd);
  if (bid === null || ask === null || !(ask > 0)) return null;
  var ratio = bid / ask;
  return { ratio: ratio, extreme: ratio >= 2 || ratio <= 0.5, tag: ratio >= 2 ? 'BID HEAVY' : (ratio <= 0.5 ? 'ASK HEAVY' : null) };
}

function coinglassParseHeatmap(data){
  if (!data) return [];
  var yAxis = data.y_axis, liq = data.liquidation_leverage_data;
  if (!Array.isArray(yAxis) || !Array.isArray(liq)) return [];
  var buckets = {};
  for (var i = 0; i < liq.length; i++){
    var row = liq[i];
    if (!row || row.length < 3) continue;
    var px = fin(yAxis[+row[1]]), usd = fin(row[2]);
    if (px === null || usd === null) continue;
    var k = px.toFixed(2);
    buckets[k] = (buckets[k] || 0) + usd;
  }
  var out = [];
  for (var key in buckets) out.push({ price: +key, notionalUsd: buckets[key] });
  out.sort(function(a,b){ return b.notionalUsd - a.notionalUsd; });
  return out;
}

function coinglassParseMap(data){
  var inner = (data && data.data) ? data.data : data;
  if (!inner || !inner.data) return [];
  var root = inner.data, out = [];
  for (var pxKey in root){
    var px = fin(pxKey), rows = root[pxKey];
    if (px === null || !Array.isArray(rows)) continue;
    var usd = 0;
    for (var j = 0; j < rows.length; j++) if (rows[j] && rows[j][1]) usd += fin(rows[j][1]) || 0;
    if (usd > 0) out.push({ price: px, notionalUsd: usd });
  }
  out.sort(function(a,b){ return b.notionalUsd - a.notionalUsd; });
  return out;
}

function coinglassClusterAt(clusters, price, tolPct){
  price = fin(price);
  if (price === null || !clusters) return null;
  var tol = (tolPct || 0.15) / 100;
  for (var i = 0; i < clusters.length; i++){
    var c = clusters[i];
    if (c && Math.abs(c.price - price) / price <= tol) return c;
  }
  return null;
}

function coinglassStopWarning(clusters, stop, minUsd){
  var c = coinglassClusterAt(clusters, stop, 0.15);
  minUsd = fin(minUsd) || 500000;
  if (!c || c.notionalUsd < minUsd) return null;
  return { warn: true, cluster: c, note: 'stop inside $' + (c.notionalUsd/1e6).toFixed(2) + 'M liq cluster' };
}

function coinglassConfluenceTag(clusters, level, minUsd){
  var c = coinglassClusterAt(clusters, level, 0.2);
  minUsd = fin(minUsd) || 1e6;
  if (!c || c.notionalUsd < minUsd) return null;
  return 'LIQ CLUSTER $' + (c.notionalUsd/1e6).toFixed(1) + 'M';
}

function deribitDvolSlope(dvol, prev){
  var now = fin(dvol), p = fin(prev);
  if (now === null || p === null) return { score: 0, stamp: 'NA', slope: null };
  var chg = now - p;
  if (chg > 2) return { score: -1, stamp: 'BEAR', slope: 'RISING', chg: chg };
  if (chg < -2) return { score: 1, stamp: 'BULL', slope: 'FALLING', chg: chg };
  return { score: 0, stamp: 'NA', slope: 'FLAT', chg: chg };
}

function deribitRiskReversal(callIv, putIv){
  var c = fin(callIv), p = fin(putIv);
  if (c === null || p === null) return null;
  var rr = c - p;
  return { rr25d: rr, extreme: Math.abs(rr) >= 8, bias: rr > 0 ? 'CALLS RICH' : 'PUTS RICH' };
}

function deribitGammaFlip(gammaByStrike, spot){
  spot = fin(spot);
  if (!gammaByStrike || spot === null) return null;
  var keys = Object.keys(gammaByStrike).map(Number).filter(isFinite).sort(function(a,b){ return a-b; });
  for (var i = 1; i < keys.length; i++){
    var g0 = fin(gammaByStrike[keys[i-1]]), g1 = fin(gammaByStrike[keys[i]]);
    if (g0 !== null && g1 !== null && g0 * g1 <= 0){
      var flip = keys[i-1] + (keys[i]-keys[i-1]) * (Math.abs(g0)/(Math.abs(g0)+Math.abs(g1)||1));
      return { level: flip, distPct: Math.abs(flip-spot)/spot*100, nearFlip: Math.abs(flip-spot)/spot <= 0.01 };
    }
  }
  return null;
}

G.hgGoldCotGate = goldCotGate;
G.coinalyzeSymbolsForBase = coinalyzeSymbolsForBase;
G.coinalyzeMergeOI = coinalyzeMergeOI;
G.coinalyzeOIChgPct = coinalyzeOIChgPct;
G.carryNetApr = carryNetApr;
G.liquidityToStop = liquidityToStop;
G.bookImbalance = bookImbalance;
G.coinglassParseHeatmap = coinglassParseHeatmap;
G.coinglassParseMap = coinglassParseMap;
G.coinglassStopWarning = coinglassStopWarning;
G.coinglassConfluenceTag = coinglassConfluenceTag;
G.deribitDvolSlope = deribitDvolSlope;
G.deribitRiskReversal = deribitRiskReversal;
G.deribitGammaFlip = deribitGammaFlip;

})();
