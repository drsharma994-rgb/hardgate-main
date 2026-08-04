/* HARDGATE — pinegoldmath.js
   Combined gold Pine confluence: SMC/ICT + session + HTF bias + ported pinemath
   layers (Lorentzian, MSB/OB, Squeeze, SMF, HalfTrend, SMC, Cipher, RF, NW, AVWAP).
   Pure exports; never throws. */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(v){ return typeof v === 'number' && isFinite(v); }
function gfn(name){
  try{ if (typeof G[name] === 'function') return G[name]; }catch(e){}
  return null;
}
function last(arr){
  if (!arr || !arr.length) return NaN;
  return arr[arr.length - 1];
}

var PINE_GOLD_SCAN = { includeContext: true, recentBars: 5 };

var PINE_GOLD_LAYERS = [
  { id: 'lorentzian', label: 'ML Lorentzian', fn: 'pineLorentzianKernel', minBars: 260,
    opts: { kNeighbors: 8, lookback: 250, scoreLimit: 2, kernelLookback: 8, kernelBandwidth: 3 } },
  { id: 'msb-ob', label: 'MSB + OB', fn: 'pineMsbOb', minBars: 80, opts: { leftBars: 5, rightBars: 5 } },
  { id: 'squeeze', label: 'Squeeze Mom', fn: 'pineSqueezeMomentum', minBars: 50,
    opts: { length: 20, bbMult: 2, kcMult: 1.5 } },
  { id: 'smf', label: 'Smart Money Flow', fn: 'pineSmartMoneyFlow', minBars: 30,
    opts: { length: 21, threshold: 0.10 } },
  { id: 'halftrend', label: 'HalfTrend', fn: 'pineHalfTrend', minBars: 120,
    opts: { amplitude: 2, atrMult: 2.0, atrLen: 100 } },
  { id: 'smc', label: 'SMC Core', fn: 'pineSmcCore', minBars: 30,
    opts: { pivotLength: 5, atrLen: 14, recentBars: 5 } },
  { id: 'cipher', label: 'VuManChu Cipher', fn: 'pineVumanchuCipher', minBars: 40,
    opts: { wtChannelLen: 9, wtAvgLen: 21, osLevel: -53, obLevel: 53, recentBars: 5 } },
  { id: 'rangefilter', label: 'Range Filter', fn: 'pineRangeFilter', minBars: 210,
    opts: { period: 100, mult: 3.0 } },
  { id: 'nw', label: 'NW Envelope', fn: 'pineNwEnvelope', minBars: 60,
    opts: { bandwidth: 8.0, mult: 2.5, lookback: 50, atrLen: 100 } },
  { id: 'avwap', label: 'Weekly AVWAP', fn: 'pineWeeklyAvwap', minBars: 20, opts: { bandMult: 2.0 } }
];

function pineGoldRunLayer(layer, rows){
  try{
    var fn = gfn(layer.fn);
    if (typeof fn !== 'function') return null;
    if (!rows || rows.length < (layer.minBars || 30)) return null;
    var opts = Object.assign({}, PINE_GOLD_SCAN, layer.opts || {});
    return fn(rows, opts);
  }catch(e){ return null; }
}

function pineGoldHtfBias(htfRows){
  var out = { dir: null, note: 'HTF unknown' };
  if (!htfRows || htfRows.length < 55) return out;
  var ribbonFn = gfn('goldRibbon');
  if (ribbonFn){
    try{
      var rb = ribbonFn(htfRows);
      if (rb && rb.mode === 'BULL') return { dir: 'long', note: 'HTF ribbon BULL (EMA50/200)' };
      if (rb && rb.mode === 'BEAR') return { dir: 'short', note: 'HTF ribbon BEAR (EMA50/200)' };
    }catch(e){}
  }
  var closes = htfRows.map(function(r){ return r.c; });
  var emaFn = gfn('ema') || gfn('pineEma');
  if (typeof emaFn !== 'function') return out;
  var e50 = last(emaFn(closes, 50));
  var e200 = last(emaFn(closes, 200));
  var cl = closes[closes.length - 1];
  if (!fin(e50) || !fin(e200) || !fin(cl)) return out;
  if (cl > e50 && e50 > e200) return { dir: 'long', note: 'HTF EMA50>200 · price above stack' };
  if (cl < e50 && e50 < e200) return { dir: 'short', note: 'HTF EMA50<200 · price below stack' };
  out.note = 'HTF mixed — no macro bias';
  return out;
}

function pineGoldAdx(rows, p){
  p = p || 14;
  var adxFn = gfn('adx');
  if (typeof adxFn !== 'function') return NaN;
  try{
    var arr = adxFn(rows, p);
    return last(arr);
  }catch(e){ return NaN; }
}

function pineGoldNearLevel(price, level, atr, mult){
  if (!fin(price) || !fin(level) || !fin(atr) || atr <= 0) return false;
  return Math.abs(price - level) <= (mult || 0.6) * atr;
}

function pineGoldGrade(score, max){
  max = max || 16;
  var pct = max > 0 ? score / max : 0;
  if (pct >= 0.75) return 'A+';
  if (pct >= 0.62) return 'A';
  if (pct >= 0.50) return 'B';
  if (pct >= 0.38) return 'C';
  return '—';
}

function pineGoldLayerAlign(layer, res, dir){
  if (!res) return { ok: false, pts: 0, note: layer.label + ' n/a' };
  var d = String(dir).toLowerCase();
  var isNew = !!(res.newLong || res.newShort);
  var aligned = res.dir === d
    || (d === 'long' && (res.longCondition || res.trend === 1 || res.longAligned))
    || (d === 'short' && (res.shortCondition || res.trend === -1 || res.shortAligned));
  if (!aligned) return { ok: false, pts: 0, note: layer.label + ' not aligned' };
  var pts = isNew ? 2 : 1;
  var note = layer.label + (isNew ? ' NEW' : ' aligned');
  if (fin(+res.barsAgo) && res.barsAgo > 0) note += ' −' + res.barsAgo + 'b';
  return { ok: true, pts: pts, note: note, isNew: isNew, res: res };
}

function pineGoldBuildPlan(dir, price, rows, resHint){
  if (resHint && fin(+resHint.entry) && fin(+resHint.stop) && resHint.entry !== resHint.stop){
    var e = +resHint.entry, s = +resHint.stop;
    var risk = Math.abs(e - s);
    return {
      entry: e, stop: s,
      t1: fin(+resHint.t1) ? +resHint.t1 : (dir === 'long' ? e + 2 * risk : e - 2 * risk),
      t2: fin(+resHint.t2) ? +resHint.t2 : (dir === 'long' ? e + 3.5 * risk : e - 3.5 * risk),
      planSrc: resHint.zoneEntry ? 'Pine zone limit' : 'Pine structure'
    };
  }
  try{
    if (typeof G.hgStructureStop === 'function' && rows && rows.length){
      var st = G.hgStructureStop(dir, price, rows, { atrLen: 14, look: 30 });
      if (st && fin(+st.stop)){
        var stop = +st.stop;
        var risk = Math.abs(price - stop);
        if (risk > 0){
          return {
            entry: price, stop: stop,
            t1: dir === 'long' ? price + 2 * risk : price - 2 * risk,
            t2: dir === 'long' ? price + 3.5 * risk : price - 3.5 * risk,
            planSrc: st.note || 'structure'
          };
        }
      }
    }
  }catch(e){}
  var atrFn = gfn('atr') || gfn('pineAtr');
  var a = (typeof atrFn === 'function' && rows && rows.length) ? last(atrFn(rows, 14)) : NaN;
  if (!fin(a)) a = price * 0.008;
  var mult = dir === 'long' ? -1.5 : 1.5;
  var stopF = price + mult * a;
  var riskF = Math.abs(price - stopF);
  return {
    entry: price, stop: stopF,
    t1: dir === 'long' ? price + 2 * riskF : price - 2 * riskF,
    t2: dir === 'long' ? price + 3.5 * riskF : price - 3.5 * riskF,
    planSrc: '1.5×ATR fallback'
  };
}

/** Evaluate one direction on primary TF rows. opts: mode swing|scalp, htfRows, levels */
function pineGoldEvalDir(dir, primaryRows, layerResults, opts){
  opts = opts || {};
  var mode = opts.mode || 'swing';
  var factors = [];
  var score = 0;
  var maxScore = 16;
  var price = primaryRows[primaryRows.length - 1].c;
  var atrFn = gfn('atr') || gfn('pineAtr');
  var atr = (typeof atrFn === 'function') ? last(atrFn(primaryRows, 14)) : NaN;

  var htf = pineGoldHtfBias(opts.htfRows || []);
  if (htf.dir === dir){
    var htfPts = mode === 'swing' ? 2 : 1;
    score += htfPts;
    factors.push({ cat: 'Structure', ok: true, pts: htfPts, note: htf.note });
  } else if (htf.dir && htf.dir !== dir){
    factors.push({ cat: 'Structure', ok: false, pts: 0, note: 'HTF opposes (' + htf.note + ')' });
  }

  var structPts = 0;
  ['halftrend', 'rangefilter', 'msb-ob', 'smc'].forEach(function(id){
    var layer = PINE_GOLD_LAYERS.filter(function(x){ return x.id === id; })[0];
    var al = pineGoldLayerAlign(layer, layerResults[id], dir);
    if (al.ok){ structPts += al.pts; factors.push({ cat: 'Structure', ok: true, pts: al.pts, note: al.note }); }
  });
  score += Math.min(structPts, 4);

  var locPts = 0;
  var nw = layerResults.nw, av = layerResults.avwap, smc = layerResults.smc, msb = layerResults['msb-ob'];
  if ((smc && smc.dir === dir && fin(+smc.entry)) || (msb && msb.dir === dir && fin(+msb.entry))){
    locPts += 2;
    factors.push({ cat: 'Location', ok: true, pts: 2, note: 'SMC/MSB zone active' });
  }
  if ((nw && nw.dir === dir) || (av && av.dir === dir)){
    locPts += 1;
    factors.push({ cat: 'Location', ok: true, pts: 1, note: 'Mean-reversion band (NW/AVWAP)' });
  }
  var lv = opts.levels || {};
  if (fin(atr)){
    if (dir === 'long'){
      if (pineGoldNearLevel(price, lv.pdl, atr) || pineGoldNearLevel(price, lv.asiaLo, atr)){
        locPts += 1; factors.push({ cat: 'Location', ok: true, pts: 1, note: 'At PDL / Asia low liquidity' });
      }
    } else {
      if (pineGoldNearLevel(price, lv.pdh, atr) || pineGoldNearLevel(price, lv.asiaHi, atr)){
        locPts += 1; factors.push({ cat: 'Location', ok: true, pts: 1, note: 'At PDH / Asia high liquidity' });
      }
    }
  }
  score += Math.min(locPts, 4);

  var confPts = 0;
  var sweepFn = gfn('goldSweeps');
  if (sweepFn){
    try{
      var sw = sweepFn(primaryRows);
      var sweepOk = (dir === 'long' && sw && (sw.dir === 'bullish' || (sw.lowSweep && sw.lowSweep.barsAgo <= 8)))
        || (dir === 'short' && sw && (sw.dir === 'bearish' || (sw.highSweep && sw.highSweep.barsAgo <= 8)));
      if (sweepOk){
        confPts += 2;
        factors.push({ cat: 'Confirmation', ok: true, pts: 2, note: 'Liquidity sweep + reclaim' });
      }
    }catch(e){}
  }
  ['squeeze', 'smf', 'cipher', 'lorentzian'].forEach(function(id){
    var layer = PINE_GOLD_LAYERS.filter(function(x){ return x.id === id; })[0];
    var al = pineGoldLayerAlign(layer, layerResults[id], dir);
    if (al.ok){ confPts += 1; factors.push({ cat: 'Confirmation', ok: true, pts: 1, note: al.note }); }
  });
  score += Math.min(confPts, 4);

  var timePts = 0;
  var kzFn = gfn('goldKillzone');
  if (kzFn){
    try{
      var kz = kzFn(Date.now());
      if (mode === 'scalp'){
        if (kz.weight >= 3){ timePts += 2; factors.push({ cat: 'Timing', ok: true, pts: 2, note: kz.label }); }
        else if (kz.weight >= 1){ timePts += 1; factors.push({ cat: 'Timing', ok: true, pts: 1, note: kz.label }); }
        else factors.push({ cat: 'Timing', ok: false, pts: 0, note: 'Off-session (scalp demoted)' });
      } else if (kz.weight >= 1){
        timePts += 1;
        factors.push({ cat: 'Timing', ok: true, pts: 1, note: kz.label + ' (context)' });
      }
    }catch(e){}
  }
  var adx = pineGoldAdx(primaryRows, 14);
  if (fin(adx) && adx >= (mode === 'swing' ? 18 : 15)){
    timePts += 1;
    factors.push({ cat: 'Timing', ok: true, pts: 1, note: 'ADX ' + adx.toFixed(1) + ' trending' });
  }
  score += Math.min(timePts, 2);

  var momPts = 0;
  var lor = layerResults.lorentzian;
  if (lor && ((dir === 'long' && lor.longCondition) || (dir === 'short' && lor.shortCondition))){
    momPts += 1;
    factors.push({ cat: 'Momentum', ok: true, pts: 1, note: 'ML score ' + (lor.smoothedScore || 0).toFixed(2) });
  }
  var sq = layerResults.squeeze;
  if (sq && fin(+sq.momentum)){
    if ((dir === 'long' && sq.momentum > 0) || (dir === 'short' && sq.momentum < 0)){
      momPts += 1;
      factors.push({ cat: 'Momentum', ok: true, pts: 1, note: 'Squeeze mom ' + sq.momentum.toFixed(4) });
    }
  }
  score += Math.min(momPts, 2);

  var minScore = mode === 'swing' ? 6 : 5;
  var structMin = mode === 'swing' ? 2 : 1;
  var structTotal = factors.filter(function(f){ return f.cat === 'Structure' && f.ok; })
    .reduce(function(s, f){ return s + f.pts; }, 0);
  var pass = score >= minScore && structTotal >= structMin;
  if (mode === 'scalp' && timePts === 0 && confPts < 2) pass = pass && score >= minScore + 2;

  var bestHint = null;
  var pri = ['smc', 'msb-ob', 'halftrend', 'nw', 'avwap', 'cipher', 'squeeze'];
  for (var p = 0; p < pri.length; p++){
    var lid = pri[p];
    var lr = layerResults[lid];
    if (lr && lr.dir === dir && (lr.newLong || lr.newShort || fin(+lr.entry) || fin(+lr.trailingStop))){
      bestHint = lr; break;
    }
  }
  var plan = pineGoldBuildPlan(dir, price, primaryRows, bestHint);
  var rr = Math.abs(plan.t1 - plan.entry) / Math.abs(plan.entry - plan.stop);

  var isNew = false;
  PINE_GOLD_LAYERS.forEach(function(layer){
    var lr = layerResults[layer.id];
    if (lr && lr.dir === dir && (lr.newLong || lr.newShort)) isNew = true;
  });

  return {
    dir: dir,
    score: score,
    maxScore: maxScore,
    grade: pineGoldGrade(score, maxScore),
    pass: pass,
    factors: factors,
    price: price,
    entry: plan.entry,
    stop: plan.stop,
    t1: plan.t1,
    t2: plan.t2,
    rr: fin(rr) ? rr : null,
    planSrc: plan.planSrc,
    isNew: isNew,
    atr: atr,
    layerResults: layerResults
  };
}

/** Full confluence scan on primary rows — returns { swing|scalp setups for long & short } */
function pineGoldConfluence(primaryRows, opts){
  opts = opts || {};
  var out = { long: null, short: null, layers: {}, at: Date.now() };
  if (!primaryRows || primaryRows.length < 30) return out;

  var layerResults = {};
  for (var i = 0; i < PINE_GOLD_LAYERS.length; i++){
    var layer = PINE_GOLD_LAYERS[i];
    layerResults[layer.id] = pineGoldRunLayer(layer, primaryRows);
  }
  out.layers = layerResults;

  out.long = pineGoldEvalDir('long', primaryRows, layerResults, opts);
  out.short = pineGoldEvalDir('short', primaryRows, layerResults, opts);
  return out;
}

function pineGoldLevelsFromBars(rows1d, rows15m){
  var lv = { pdh: NaN, pdl: NaN, asiaHi: NaN, asiaLo: NaN };
  if (rows1d && rows1d.length >= 2){
    var pdc = rows1d[rows1d.length - 1];
    lv.pdh = pdc.h; lv.pdl = pdc.l;
  }
  if (rows15m && rows15m.length > 10){
    var now = rows15m[rows15m.length - 1].t;
    var ts = now < 1e12 ? now : Math.floor(now / 1000);
    var d = new Date(ts * 1000);
    var day0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
    var asia = rows15m.filter(function(r){
      var t = r.t < 1e12 ? r.t : Math.floor(r.t / 1000);
      return t >= day0 && t < day0 + 7 * 3600;
    });
    if (asia.length){
      lv.asiaHi = Math.max.apply(null, asia.map(function(r){ return r.h; }));
      lv.asiaLo = Math.min.apply(null, asia.map(function(r){ return r.l; }));
    }
  }
  return lv;
}

G.PINE_GOLD_LAYERS = PINE_GOLD_LAYERS;
G.PINE_GOLD_SCAN = PINE_GOLD_SCAN;
G.pineGoldConfluence = pineGoldConfluence;
G.pineGoldHtfBias = pineGoldHtfBias;
G.pineGoldGrade = pineGoldGrade;
G.pineGoldLevelsFromBars = pineGoldLevelsFromBars;
G.pineGoldEvalDir = pineGoldEvalDir;

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    PINE_GOLD_LAYERS, PINE_GOLD_SCAN, pineGoldConfluence, pineGoldHtfBias,
    pineGoldGrade, pineGoldLevelsFromBars, pineGoldEvalDir
  };
}

})();
