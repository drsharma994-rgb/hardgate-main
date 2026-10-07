/* HARDGATE — pinegoldmath.js
   Combined gold Pine + goldind.js confluence (SMC, session, macro, positioning).
   Pure exports; never throws. */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var PINE_GOLD_MAX = 24;

/** Display tiers: primary = strict gate; aligned = watch/context (relaxed vetoes). */
var PINE_GOLD_TIER = {
  swing: { primary: 10, aligned: 4, forming: 3, rrPrimary: 1.2, rrAligned: 0.75 },
  scalp: { primary: 8, aligned: 3, forming: 2, rrPrimary: 1.2, rrAligned: 0.75 }
};

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

function pineGoldSessionVwapAnchor(rows){
  if (!rows || !rows.length) return 0;
  var tl = rows[rows.length - 1].t;
  if (!fin(tl)) return Math.max(0, rows.length - 48);
  var ds = Math.floor((tl < 1e12 ? tl : tl / 1000) / 86400) * 86400;
  for (var i = 0; i < rows.length; i++){
    var t = rows[i].t < 1e12 ? rows[i].t : Math.floor(rows[i].t / 1000);
    if (t >= ds) return i;
  }
  return 0;
}

/** Ornstein–Uhlenbeck-style exhaustion z-score (AsliGold MR lite). */
function pineGoldOuZscore(rows, len){
  try{
    len = len || 50;
    if (!rows || rows.length < len + 5) return null;
    var closes = rows.map(function(r){ return r.c; });
    var slice = closes.slice(-len);
    var mean = slice.reduce(function(a, b){ return a + b; }, 0) / slice.length;
    var sq = 0;
    for (var i = 0; i < slice.length; i++) sq += Math.pow(slice[i] - mean, 2);
    var sd = Math.sqrt(sq / slice.length);
    if (!fin(sd) || sd <= 0) return null;
    var z = (closes[closes.length - 1] - mean) / sd;
    return {
      z: z,
      mean: mean,
      longExhaust: z <= -1.8,
      shortExhaust: z >= 1.8
    };
  }catch(e){ return null; }
}

function pineGoldNativeBundle(rows, mode){
  var b = {
    bos: null, pd: null, structure: null, obRetest: null,
    sweepV2: null, fvgV2: null, asian: null, vwapBands: null,
    rsi: null, rangeBound: null, ou: null
  };
  if (!rows || rows.length < 25) return b;

  try{ var fn = gfn('goldBOS'); if (fn) b.bos = fn(rows); }catch(e){}
  try{ var pdFn = gfn('goldPremiumDiscount'); if (pdFn) b.pd = pdFn(rows); }catch(e){}
  try{
    var swFn = gfn('goldSwings'), msFn = gfn('goldMarketStructure');
    if (swFn && msFn){
      var swings = swFn(rows, 5, 5);
      b.structure = msFn(rows, swings, 5, 5);
    }
  }catch(e){}
  try{
    var upd = gfn('goldUpdateActiveZones'), ret = gfn('goldOrderBlockRetest');
    if (upd && ret && b.structure){
      var zones = upd(rows, rows.length - 1);
      var obs = zones && zones.activeOrderBlocks ? zones.activeOrderBlocks : [];
      b.obRetest = ret(rows, rows.length - 1, b.structure, obs);
    }
  }catch(e){}
  try{
    var sv2 = gfn('goldSweepV2');
    if (sv2) b.sweepV2 = sv2(rows, rows.length - 1, mode === 'scalp' ? 10 : 15, 20, 1.4);
  }catch(e){}
  try{
    var fv2 = gfn('goldFVGV2');
    if (fv2) b.fvgV2 = fv2(rows, rows.length - 1);
  }catch(e){}
  try{ var ar = gfn('goldAsianRange'); if (ar) b.asian = ar(rows); }catch(e){}
  try{
    var vb = gfn('goldVWAPBands');
    if (vb) b.vwapBands = vb(rows, pineGoldSessionVwapAnchor(rows));
  }catch(e){}
  try{ var rg = gfn('goldRSIGold'); if (rg) b.rsi = rg(rows); }catch(e){}
  try{ var rb = gfn('goldRangeBound'); if (rb) b.rangeBound = rb(rows); }catch(e){}
  b.ou = pineGoldOuZscore(rows, mode === 'swing' ? 50 : 30);
  return b;
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

function pineGoldNearLevel(price, level, atr, mult){
  if (!fin(price) || !fin(level) || !fin(atr) || atr <= 0) return false;
  return Math.abs(price - level) <= (mult || 0.6) * atr;
}

function pineGoldGrade(score, max){
  max = max || PINE_GOLD_MAX;
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

function pineGoldBuildPlan(dir, price, rows, resHint, nativeHint){
  if (nativeHint && nativeHint.trigger && fin(+nativeHint.anchor)){
    var anchor = +nativeHint.anchor;
    var atrFn = gfn('atr') || gfn('pineAtr');
    var a = (typeof atrFn === 'function' && rows && rows.length) ? last(atrFn(rows, 14)) : price * 0.008;
    var stop = dir === 'long' ? anchor - 1.2 * a : anchor + 1.2 * a;
    var entry = fin(+nativeHint.entry) ? +nativeHint.entry : price;
    var risk = Math.abs(entry - stop);
    if (risk > 0){
      return {
        entry: entry, stop: stop,
        t1: dir === 'long' ? entry + 2 * risk : entry - 2 * risk,
        t2: dir === 'long' ? entry + 3.5 * risk : entry - 3.5 * risk,
        planSrc: nativeHint.type || 'gold SMC zone'
      };
    }
  }
  if (resHint && fin(+resHint.entry) && fin(+resHint.stop) && resHint.entry !== resHint.stop){
    var e = +resHint.entry, s = +resHint.stop;
    var riskOb = Math.abs(e - s);
    return {
      entry: e, stop: s,
      t1: fin(+resHint.t1) ? +resHint.t1 : (dir === 'long' ? e + 2 * riskOb : e - 2 * riskOb),
      t2: fin(+resHint.t2) ? +resHint.t2 : (dir === 'long' ? e + 3.5 * riskOb : e - 3.5 * riskOb),
      planSrc: resHint.zoneEntry ? 'Pine zone limit' : 'Pine structure'
    };
  }
  try{
    if (typeof G.hgStructureStop === 'function' && rows && rows.length){
      var st = G.hgStructureStop(dir, price, rows, { atrLen: 14, look: 20 });
      if (st && fin(+st.stop)){
        var stopS = +st.stop;
        var riskS = Math.abs(price - stopS);
        if (riskS > 0){
          return {
            entry: price, stop: stopS,
            t1: dir === 'long' ? price + 2 * riskS : price - 2 * riskS,
            t2: dir === 'long' ? price + 3.5 * riskS : price - 3.5 * riskS,
            planSrc: st.note || 'structure'
          };
        }
      }
    }
  }catch(e){}
  var atrFn2 = gfn('atr') || gfn('pineAtr');
  var a2 = (typeof atrFn2 === 'function' && rows && rows.length) ? last(atrFn2(rows, 14)) : NaN;
  if (!fin(a2)) a2 = price * 0.008;
  var stopF = dir === 'long' ? price - 1.5 * a2 : price + 1.5 * a2;
  var riskF = Math.abs(price - stopF);
  return {
    entry: price, stop: stopF,
    t1: dir === 'long' ? price + 2 * riskF : price - 2 * riskF,
    t2: dir === 'long' ? price + 3.5 * riskF : price - 3.5 * riskF,
    planSrc: '1.5×ATR fallback'
  };
}

function pineGoldEvalDir(dir, primaryRows, layerResults, opts){
  opts = opts || {};
  var mode = opts.mode || 'swing';
  var factors = [];
  var families = { htf: false, goldSMC: false, pine: false, session: false, macro: false };
  var score = 0;
  var maxScore = PINE_GOLD_MAX;
  var price = primaryRows[primaryRows.length - 1].c;
  var atrFn = gfn('atr') || gfn('pineAtr');
  var atr = (typeof atrFn === 'function') ? last(atrFn(primaryRows, 14)) : NaN;
  var native = opts.native || pineGoldNativeBundle(primaryRows, mode);
  var meanRevHeavy = false;

  var htf = pineGoldHtfBias(opts.htfRows || []);
  if (htf.dir === dir){
    var htfPts = mode === 'swing' ? 2 : 1;
    score += htfPts;
    families.htf = true;
    factors.push({ cat: 'Structure', ok: true, pts: htfPts, note: htf.note });
  } else if (htf.dir && htf.dir !== dir){
    factors.push({ cat: 'Structure', ok: false, pts: 0, note: 'HTF opposes (' + htf.note + ')' });
  }

  if (native.structure){
    var tr = native.structure.trend;
    if ((dir === 'long' && tr === 'bullish') || (dir === 'short' && tr === 'bearish')){
      score += 2; families.goldSMC = true;
      factors.push({ cat: 'Structure', ok: true, pts: 2, note: 'Market structure ' + tr + (native.structure.bos ? ' BOS' : '') + (native.structure.choch ? ' CHoCH' : '') });
    }
  }
  if (native.bos){
    if ((dir === 'long' && native.bos.bos === 'bullish') || (dir === 'short' && native.bos.bos === 'bearish')){
      score += 1; families.goldSMC = true;
      factors.push({ cat: 'Structure', ok: true, pts: 1, note: 'goldBOS ' + native.bos.bos + (native.bos.strength ? ' ' + native.bos.strength : '') });
    }
    if ((dir === 'long' && native.bos.choch === 'bullish') || (dir === 'short' && native.bos.choch === 'bearish')){
      score += 1; families.goldSMC = true;
      factors.push({ cat: 'Structure', ok: true, pts: 1, note: 'goldBOS CHoCH ' + native.bos.choch });
    }
  }

  var structPts = 0;
  ['halftrend', 'rangefilter', 'msb-ob', 'smc'].forEach(function(id){
    var layer = PINE_GOLD_LAYERS.filter(function(x){ return x.id === id; })[0];
    var al = pineGoldLayerAlign(layer, layerResults[id], dir);
    if (al.ok){ structPts += al.pts; families.pine = true; factors.push({ cat: 'Structure', ok: true, pts: al.pts, note: al.note }); }
  });
  score += Math.min(structPts, 4);

  if (native.pd){
    if ((dir === 'long' && native.pd.zone === 'DISCOUNT') || (dir === 'short' && native.pd.zone === 'PREMIUM')){
      score += 2; families.goldSMC = true;
      factors.push({ cat: 'Location', ok: true, pts: 2, note: 'Premium/discount ' + native.pd.zone + ' (' + (native.pd.pct * 100).toFixed(0) + '% range)' });
    } else if (native.pd.zone === 'NEUTRAL' && fin(+native.pd.pct)){
      if ((dir === 'long' && native.pd.pct <= 0.42) || (dir === 'short' && native.pd.pct >= 0.58)){
        score += 1; families.goldSMC = true;
        factors.push({ cat: 'Location', ok: true, pts: 1, note: 'PD lean ' + (native.pd.pct * 100).toFixed(0) + '% (neutral band)' });
      }
    }
  }
  if (native.obRetest && native.obRetest.trigger && native.obRetest.direction === dir){
    score += 2; families.goldSMC = true;
    factors.push({ cat: 'Location', ok: true, pts: 2, note: 'Order block retest @ ' + (native.obRetest.base || native.obRetest.anchor) });
  }
  var nw = layerResults.nw, av = layerResults.avwap;
  if ((nw && nw.dir === dir) || (av && av.dir === dir)){
    score += 1; families.pine = true; meanRevHeavy = true;
    factors.push({ cat: 'Location', ok: true, pts: 1, note: 'Mean-reversion band (NW/AVWAP)' });
  }
  if (native.ou){
    if ((dir === 'long' && native.ou.longExhaust) || (dir === 'short' && native.ou.shortExhaust)){
      score += 1; families.pine = true; meanRevHeavy = true;
      factors.push({ cat: 'Location', ok: true, pts: 1, note: 'OU exhaustion z=' + native.ou.z.toFixed(2) });
    }
  }
  var lv = opts.levels || {};
  if (fin(atr)){
    if (dir === 'long'){
      if (pineGoldNearLevel(price, lv.pdl, atr) || pineGoldNearLevel(price, lv.asiaLo, atr)){
        score += 1; families.goldSMC = true;
        factors.push({ cat: 'Location', ok: true, pts: 1, note: 'At PDL / Asia low liquidity' });
      }
    } else if (pineGoldNearLevel(price, lv.pdh, atr) || pineGoldNearLevel(price, lv.asiaHi, atr)){
      score += 1; families.goldSMC = true;
      factors.push({ cat: 'Location', ok: true, pts: 1, note: 'At PDH / Asia high liquidity' });
    }
  }

  var confPts = 0;
  if (native.sweepV2 && native.sweepV2.trigger && native.sweepV2.dir === dir){
    confPts += 3; families.goldSMC = true;
    factors.push({ cat: 'Confirmation', ok: true, pts: 3, note: 'Sweep V2 + volume climax' });
  } else {
    var sweepFn = gfn('goldSweeps');
    if (sweepFn){
      try{
        var sw = sweepFn(primaryRows);
        var sweepOk = (dir === 'long' && sw && (sw.dir === 'bullish' || (sw.lowSweep && sw.lowSweep.barsAgo <= 8)))
          || (dir === 'short' && sw && (sw.dir === 'bearish' || (sw.highSweep && sw.highSweep.barsAgo <= 8)));
        if (sweepOk){
          confPts += 2; families.goldSMC = true;
          factors.push({ cat: 'Confirmation', ok: true, pts: 2, note: 'Liquidity sweep + reclaim' });
        }
      }catch(e){}
    }
  }
  if (native.fvgV2 && native.fvgV2.trigger && native.fvgV2.dir === dir){
    confPts += 2; families.goldSMC = true;
    factors.push({ cat: 'Confirmation', ok: true, pts: 2, note: 'FVG V2 + HVN support' });
  }
  if (native.rsi){
    if ((dir === 'long' && native.rsi.div === 'bullish') || (dir === 'short' && native.rsi.div === 'bearish')){
      confPts += 1; families.pine = true;
      factors.push({ cat: 'Confirmation', ok: true, pts: 1, note: 'RSI gold divergence (' + native.rsi.div + ')' });
    }
  }
  ['squeeze', 'smf', 'cipher', 'lorentzian'].forEach(function(id){
    var layer = PINE_GOLD_LAYERS.filter(function(x){ return x.id === id; })[0];
    var al = pineGoldLayerAlign(layer, layerResults[id], dir);
    if (al.ok){ confPts += 1; families.pine = true; factors.push({ cat: 'Confirmation', ok: true, pts: 1, note: al.note }); }
    if (id === 'cipher' && al.ok) meanRevHeavy = meanRevHeavy || !al.isNew;
  });
  score += Math.min(confPts, 6);

  var timePts = 0;
  var kzFn = gfn('goldKillzone');
  if (kzFn){
    try{
      var kz = kzFn(Date.now());
      if (mode === 'scalp'){
        if (kz.weight >= 3){ timePts += 2; families.session = true; factors.push({ cat: 'Timing', ok: true, pts: 2, note: kz.label }); }
        else if (kz.weight >= 1){ timePts += 1; families.session = true; factors.push({ cat: 'Timing', ok: true, pts: 1, note: kz.label }); }
        else factors.push({ cat: 'Timing', ok: false, pts: 0, note: 'Off-session (scalp needs killzone or strong sweep)' });
      } else if (kz.weight >= 1){
        timePts += 1; families.session = true;
        factors.push({ cat: 'Timing', ok: true, pts: 1, note: kz.label + ' (context)' });
      }
    }catch(e){}
  }
  if (native.vwapBands){
    var vb = native.vwapBands;
    if ((dir === 'long' && vb.pos === 'BELOW' && fin(+vb.distSig) && vb.distSig >= 1)
        || (dir === 'short' && vb.pos === 'ABOVE' && fin(+vb.distSig) && vb.distSig >= 1)){
      timePts += 1; families.session = true;
      factors.push({ cat: 'Timing', ok: true, pts: 1, note: 'Session VWAP stretch ' + vb.band });
    }
  }
  if (native.asian){
    if ((dir === 'long' && native.asian.state === 'LONG_BREAK') || (dir === 'short' && native.asian.state === 'SHORT_BREAK')){
      timePts += 1; families.session = true;
      factors.push({ cat: 'Timing', ok: true, pts: 1, note: 'Asian range ' + native.asian.state });
    }
  }
  var adxFn = gfn('goldADX');
  var adxR = adxFn ? adxFn(primaryRows) : null;
  var adx = adxR && fin(+adxR.adx) ? +adxR.adx : NaN;
  if (fin(adx) && adx >= (mode === 'swing' ? 18 : 15)){
    timePts += 1;
    factors.push({ cat: 'Timing', ok: true, pts: 1, note: 'ADX ' + adx.toFixed(1) + ' ' + (adxR.state || '') });
  }
  score += Math.min(timePts, 4);

  var macro = opts.macro || {};
  var hint = String(macro.realRateHint || macro.hint || '').toUpperCase();
  if (hint === 'TAILWIND' && dir === 'long'){
    score += mode === 'swing' ? 2 : 1; families.macro = true;
    factors.push({ cat: 'Macro', ok: true, pts: mode === 'swing' ? 2 : 1, note: 'Real-rate / DXY TAILWIND for longs' });
  } else if (hint === 'HEADWIND' && dir === 'short'){
    score += mode === 'swing' ? 2 : 1; families.macro = true;
    factors.push({ cat: 'Macro', ok: true, pts: mode === 'swing' ? 2 : 1, note: 'Real-rate / DXY HEADWIND for shorts' });
  }
  var spot = opts.spot || {};
  var verdict = String(spot.verdict || '').toLowerCase();
  if (verdict === 'shorts-crowding' && dir === 'long'){
    score += 1; families.macro = true;
    factors.push({ cat: 'Macro', ok: true, pts: 1, note: 'PAXG basis shorts-crowding → long tilt' });
  } else if (verdict === 'longs-crowding' && dir === 'short'){
    score += 1; families.macro = true;
    factors.push({ cat: 'Macro', ok: true, pts: 1, note: 'PAXG basis longs-crowding → short tilt' });
  }

  var momPts = 0;
  var lor = layerResults.lorentzian;
  if (lor && ((dir === 'long' && lor.longCondition) || (dir === 'short' && lor.shortCondition))){
    momPts += 1; families.pine = true;
    factors.push({ cat: 'Momentum', ok: true, pts: 1, note: 'ML score ' + (lor.smoothedScore || 0).toFixed(2) });
  }
  var sq = layerResults.squeeze;
  if (sq && fin(+sq.momentum)){
    if ((dir === 'long' && sq.momentum > 0) || (dir === 'short' && sq.momentum < 0)){
      momPts += 1; families.pine = true;
      factors.push({ cat: 'Momentum', ok: true, pts: 1, note: 'Squeeze mom ' + sq.momentum.toFixed(4) });
    }
  }
  score += Math.min(momPts, 2);

  var familyCount = (families.htf ? 1 : 0) + (families.goldSMC ? 1 : 0) + (families.pine ? 1 : 0)
    + (families.session ? 1 : 0) + (families.macro ? 1 : 0);

  var tierCfg = PINE_GOLD_TIER[mode] || PINE_GOLD_TIER.swing;
  var minScore = tierCfg.primary;
  var hasSweep = native.sweepV2 && native.sweepV2.trigger && native.sweepV2.dir === dir;
  var hasOb = native.obRetest && native.obRetest.trigger && native.obRetest.direction === dir;
  var hasFvg = native.fvgV2 && native.fvgV2.trigger && native.fvgV2.dir === dir;
  var hasNativeTrigger = hasSweep || hasOb || hasFvg;
  var okFactorCount = 0;
  for (var fi = 0; fi < factors.length; fi++){
    if (factors[fi].ok && factors[fi].cat !== 'Veto') okFactorCount++;
  }

  var pass = score >= minScore && familyCount >= 2;
  if (mode === 'scalp' && !families.session && !hasSweep && familyCount < 3){
    pass = pass && score >= minScore + 2;
  }
  var htfOppose = htf.dir && htf.dir !== dir && !hasSweep && !hasOb;
  if (htfOppose){
    pass = false;
    factors.push({ cat: 'Veto', ok: false, pts: 0, note: 'HTF opposes without sweep/OB trigger' });
  }
  var chopVeto = mode === 'scalp' && native.rangeBound && native.rangeBound.isRangeBound && meanRevHeavy;
  if (chopVeto){
    pass = false;
    factors.push({ cat: 'Veto', ok: false, pts: 0, note: 'Chop range — mean-reversion demoted on scalp' });
  }

  var nativeHint = null;
  if (native.obRetest && native.obRetest.trigger && native.obRetest.direction === dir) nativeHint = native.obRetest;
  else if (native.sweepV2 && native.sweepV2.trigger && native.sweepV2.dir === dir) nativeHint = native.sweepV2;
  else if (native.fvgV2 && native.fvgV2.trigger && native.fvgV2.dir === dir) nativeHint = native.fvgV2;

  var bestHint = null;
  var pri = ['smc', 'msb-ob', 'halftrend', 'nw', 'avwap', 'cipher', 'squeeze'];
  for (var p = 0; p < pri.length; p++){
    var lr = layerResults[pri[p]];
    if (lr && lr.dir === dir && (lr.newLong || lr.newShort || fin(+lr.entry) || fin(+lr.trailingStop))){
      bestHint = lr; break;
    }
  }
  var plan = pineGoldBuildPlan(dir, price, primaryRows, bestHint, nativeHint);
  var rr = Math.abs(plan.t1 - plan.entry) / Math.abs(plan.entry - plan.stop);
  var rrFailPrimary = fin(rr) && rr < tierCfg.rrPrimary;
  if (rrFailPrimary){
    pass = false;
    factors.push({ cat: 'Veto', ok: false, pts: 0, note: 'R:R ' + rr.toFixed(2) + ' < ' + tierCfg.rrPrimary + ' min' });
  }

  var isNew = false;
  var isRecent = false;
  var recentBars = PINE_GOLD_SCAN.recentBars || 5;
  PINE_GOLD_LAYERS.forEach(function(layer){
    var lr = layerResults[layer.id];
    if (!lr || lr.dir !== dir) return;
    if (lr.newLong || lr.newShort) isNew = true;
    else if (fin(+lr.barsAgo) && lr.barsAgo > 0 && lr.barsAgo <= recentBars) isRecent = true;
  });
  if (hasSweep || hasOb) isNew = true;

  var alignedMin = tierCfg.aligned;
  var formingMin = tierCfg.forming || 3;
  var alignedPass = score >= alignedMin && okFactorCount >= 1
    && (familyCount >= 1 || hasNativeTrigger || okFactorCount >= 2);
  if (mode === 'scalp' && !families.session && !hasSweep && familyCount < 1){
    alignedPass = alignedPass && score >= alignedMin + 1;
  }
  if (chopVeto && score < 4) alignedPass = false;
  if (fin(rr) && rr < tierCfg.rrAligned && score < alignedMin + 2) alignedPass = false;

  var formingPass = !pass && !alignedPass && score >= formingMin && okFactorCount >= 1;

  var tier = pass ? 'primary' : (alignedPass ? 'aligned' : (formingPass ? 'forming' : null));
  var display = tier !== null;

  return {
    dir: dir,
    score: score,
    maxScore: maxScore,
    grade: pineGoldGrade(score, maxScore),
    pass: pass,
    tier: tier,
    display: display,
    factors: factors,
    families: families,
    familyCount: familyCount,
    price: price,
    entry: plan.entry,
    stop: plan.stop,
    t1: plan.t1,
    t2: plan.t2,
    rr: fin(rr) ? rr : null,
    planSrc: plan.planSrc,
    isNew: isNew,
    isRecent: isRecent && !isNew,
    isContext: (tier === 'aligned' || tier === 'forming') && !isNew && !isRecent,
    atr: atr,
    layerResults: layerResults,
    native: native
  };
}

function pineGoldConfluence(primaryRows, opts){
  opts = opts || {};
  var out = { long: null, short: null, layers: {}, native: null, at: Date.now() };
  if (!primaryRows || primaryRows.length < 30) return out;

  var layerResults = {};
  for (var i = 0; i < PINE_GOLD_LAYERS.length; i++){
    var layer = PINE_GOLD_LAYERS[i];
    layerResults[layer.id] = pineGoldRunLayer(layer, primaryRows);
  }
  out.layers = layerResults;
  out.native = pineGoldNativeBundle(primaryRows, opts.mode || 'swing');
  opts.native = out.native;

  out.long = pineGoldEvalDir('long', primaryRows, layerResults, opts);
  out.short = pineGoldEvalDir('short', primaryRows, layerResults, opts);
  return out;
}

function pineGoldLayerSetup(layer, res, dir, primaryRows, mode){
  if (!res || !primaryRows || !primaryRows.length) return null;
  var d = String(dir).toLowerCase();
  var al = pineGoldLayerAlign(layer, res, d);
  if (!al.ok) return null;
  var isFresh = !!(al.isNew || res.newLong || res.newShort);
  var recentBars = PINE_GOLD_SCAN.recentBars || 5;
  var isRecent = !isFresh && fin(+res.barsAgo) && res.barsAgo > 0 && res.barsAgo <= recentBars;
  var price = fin(+res.price) ? +res.price : primaryRows[primaryRows.length - 1].c;
  var plan = pineGoldBuildPlan(d, price, primaryRows, res, null);
  var rr = Math.abs(plan.t1 - plan.entry) / Math.abs(plan.entry - plan.stop);
  return {
    kind: 'layer',
    layerId: layer.id,
    layerLabel: layer.label,
    dir: d,
    mode: mode,
    tier: isFresh ? 'primary' : 'aligned',
    display: true,
    score: Math.max(1, al.pts || 1),
    maxScore: PINE_GOLD_MAX,
    grade: pineGoldGrade(Math.max(1, al.pts || 1), PINE_GOLD_MAX),
    factors: [{ cat: 'Pine', ok: true, pts: al.pts || 1, note: al.note || layer.label }],
    price: price,
    entry: plan.entry,
    stop: plan.stop,
    t1: plan.t1,
    t2: plan.t2,
    rr: fin(rr) ? rr : null,
    planSrc: plan.planSrc,
    isNew: isFresh,
    isRecent: isRecent,
    isContext: !isFresh && !isRecent,
    familyCount: 1,
    pass: false
  };
}

function pineGoldUniverse(primaryRows, opts){
  opts = opts || {};
  var mode = opts.mode || 'swing';
  var out = [];
  var conf = pineGoldConfluence(primaryRows, opts);

  function pushEval(ev){
    if (!ev) return;
    if (ev.display){
      out.push(Object.assign({ kind: 'confluence' }, ev));
    } else if (ev.score >= (PINE_GOLD_TIER[mode] || PINE_GOLD_TIER.swing).forming){
      out.push(Object.assign({}, ev, {
        kind: 'confluence', tier: 'forming', display: true,
        isContext: true, pass: false
      }));
    }
  }
  pushEval(conf.long);
  pushEval(conf.short);

  var htf = pineGoldHtfBias(opts.htfRows || []);
  if (htf.dir){
    var priceH = primaryRows[primaryRows.length - 1].c;
    var planH = pineGoldBuildPlan(htf.dir, priceH, primaryRows, null, null);
    var rrH = Math.abs(planH.t1 - planH.entry) / Math.abs(planH.entry - planH.stop);
    out.push({
      kind: 'htf',
      layerLabel: 'HTF Bias',
      dir: htf.dir,
      mode: mode,
      tier: 'aligned',
      display: true,
      score: 2,
      maxScore: PINE_GOLD_MAX,
      grade: pineGoldGrade(2, PINE_GOLD_MAX),
      factors: [{ cat: 'Structure', ok: true, pts: 2, note: htf.note }],
      price: priceH,
      entry: planH.entry,
      stop: planH.stop,
      t1: planH.t1,
      t2: planH.t2,
      rr: fin(rrH) ? rrH : null,
      planSrc: 'HTF bias',
      isNew: false,
      isRecent: false,
      isContext: true,
      familyCount: 1,
      pass: false
    });
  }

  for (var i = 0; i < PINE_GOLD_LAYERS.length; i++){
    var layer = PINE_GOLD_LAYERS[i];
    var lr = conf.layers[layer.id];
    if (!lr) continue;
    var longS = pineGoldLayerSetup(layer, lr, 'long', primaryRows, mode);
    var shortS = pineGoldLayerSetup(layer, lr, 'short', primaryRows, mode);
    if (longS) out.push(longS);
    if (shortS) out.push(shortS);
  }

  return { setups: out, confluence: conf, at: Date.now() };
}

/* =======================================================================
   hg-v1164: RECORD-ONLY GOLD PINE LAYERS.

   Asked for new gold Pine layers after hg-v1163 said why none was added: on
   the measured record a new detector is an unmeasured gate (hg-v966) or
   noise with a label (hg-v987 / v945 / v922). The honest form, the hg-v933
   precedent, is a mechanic that MINTS, is RECORDED beside an outcome on
   every signal bar, PRINTS its levels -- and cannot lead and cannot be
   handed over until the forward ledger has measured it paying. These five
   are that: bar-only ports of the Pine scripts a gold trader runs, kept in
   a table of their OWN so the ten layers above, the confluence rows and
   every existing record stay byte-identical (pineGoldEvalDir walks
   PINE_GOLD_LAYERS for isNew / isRecent, so a new entry THERE would move the
   confluence tier of every row the moment one of these fired).

   Each detector fires ONLY on the last closed bar (newLong / newShort on
   that bar, barsAgo 0, no context state), so a signal is recorded once, on
   its own bar, and never re-recorded three bars later at a stale entry.
   Twins: ICHI-KUMO is the one exact OMNIGOLD mechanic among them, and its
   gate-clear record is quoted on the card through hgGoldSiblingRecord
   (hg-v934); the daily-pivot bounce is NOT ported -- its twin PIVOT-REJECT
   is a measured failure past the veto bar (zBreakeven -2.69), the hg-v934
   refusal, and this desk has no measured-edge gate that would hold it. */
var PINE_GOLD_RECORD_LAYERS = [
  { id: 'supertrend', label: 'Supertrend 10x3', fn: 'pineGoldSupertrend', minBars: 60,
    opts: { atrLen: 10, mult: 3 }, twin: null },
  { id: 'ichimoku', label: 'Ichimoku TK Cross', fn: 'pineGoldIchimoku', minBars: 120,
    opts: { tenkan: 9, kijun: 26, senkou: 52 }, twin: 'ICHI-KUMO' },
  { id: 'donchian', label: 'Donchian 20/10', fn: 'pineGoldDonchian', minBars: 60,
    opts: { entryLen: 20, exitLen: 10 }, twin: null },
  { id: 'emacross', label: 'EMA 8/21 + RSI50', fn: 'pineGoldEmaCrossRsi', minBars: 60,
    opts: { fast: 8, slow: 21, rsiLen: 14, swing: 5 }, twin: null },
  { id: 'keltner', label: 'Keltner Pullback', fn: 'pineGoldKeltnerPullback', minBars: 80,
    opts: { emaLen: 20, atrLen: 10, mult: 1.5, trendLen: 50, slopeBars: 5 }, twin: null }
];

function pgrNum(v){ return (typeof v === 'number' && isFinite(v)) ? v : NaN; }
function pgrHighest(rows, from, to, key){
  var m = -Infinity;
  for (var i = from; i <= to; i++){ var v = pgrNum(rows[i] && rows[i][key]); if (!isFinite(v)) return NaN; if (v > m) m = v; }
  return (m === -Infinity) ? NaN : m;
}
function pgrLowest(rows, from, to, key){
  var m = Infinity;
  for (var i = from; i <= to; i++){ var v = pgrNum(rows[i] && rows[i][key]); if (!isFinite(v)) return NaN; if (v < m) m = v; }
  return (m === Infinity) ? NaN : m;
}
/* ONE result shape for the five: the signal bar's close is the entry, the
   mechanic's own level is the stop, and the ladder is the one every Pine
   layer above carries (2R / 3.5R through pineGoldBuildPlan's resHint path).
   A stop on the wrong side of the entry, or no distance at all, is no signal. */
function pgrResult(dir, entry, stop, extra){
  entry = pgrNum(entry); stop = pgrNum(stop);
  if (!dir || !isFinite(entry) || !isFinite(stop)) return { dir: null };
  if (dir === 'long' && !(stop < entry)) return { dir: null };
  if (dir === 'short' && !(stop > entry)) return { dir: null };
  var risk = Math.abs(entry - stop);
  var out = Object.assign({
    dir: dir, newLong: dir === 'long', newShort: dir === 'short', barsAgo: 0,
    price: entry, entry: entry, stop: stop,
    t1: dir === 'long' ? entry + 2 * risk : entry - 2 * risk,
    t2: dir === 'long' ? entry + 3.5 * risk : entry - 3.5 * risk,
    recordOnly: true
  }, extra || {});
  return out;
}

/* Supertrend (ATR 10, multiplier 3): the band flips on the last closed bar.
   Stop is the band the flip put under / over price. */
function pineGoldSupertrend(rows, opts){
  opts = opts || {};
  var len = opts.atrLen || 10, mult = opts.mult || 3;
  try{
    var atrFn = gfn('atr') || gfn('pineAtr');
    if (typeof atrFn !== 'function' || !rows || rows.length < len + 5) return { dir: null };
    var a = atrFn(rows, len), n = rows.length;
    var fU = NaN, fL = NaN, dir = 0, prevDir = 0, i;
    for (i = 0; i < n; i++){
      var r = rows[i], av = pgrNum(a[i]);
      var h = pgrNum(r.h), l = pgrNum(r.l), c = pgrNum(r.c);
      if (!isFinite(av) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
      var hl2 = (h + l) / 2, up = hl2 + mult * av, dn = hl2 - mult * av;
      var pc = pgrNum(rows[i - 1] && rows[i - 1].c);
      var nU = (!isFinite(fU) || up < fU || (isFinite(pc) && pc > fU)) ? up : fU;
      var nL = (!isFinite(fL) || dn > fL || (isFinite(pc) && pc < fL)) ? dn : fL;
      prevDir = dir;
      if (dir === 0) dir = (c > nU) ? 1 : -1;
      else if (dir === 1) dir = (c < nL) ? -1 : 1;
      else dir = (c > nU) ? 1 : -1;
      fU = nU; fL = nL;
    }
    var last = rows[n - 1];
    if (dir === 1 && prevDir === -1) return pgrResult('long', last.c, fL, { trend: 1, band: fL });
    if (dir === -1 && prevDir === 1) return pgrResult('short', last.c, fU, { trend: -1, band: fU });
    return { dir: null, trend: dir };
  }catch(e){ return { dir: null }; }
}

/* Ichimoku: Tenkan crosses Kijun on the last closed bar with the close on
   the same side of the Kumo (Senkou A / B projected from 26 bars back).
   Stop is the Kijun. */
function pineGoldIchimoku(rows, opts){
  opts = opts || {};
  var tL = opts.tenkan || 9, kL = opts.kijun || 26, sL = opts.senkou || 52;
  try{
    var n = rows ? rows.length : 0;
    if (n < sL + kL + 2) return { dir: null };
    function mid(i, len){ var hh = pgrHighest(rows, i - len + 1, i, 'h'), ll = pgrLowest(rows, i - len + 1, i, 'l'); return (hh + ll) / 2; }
    var i = n - 1, j = n - 2;
    var tk = mid(i, tL), kj = mid(i, kL), tkP = mid(j, tL), kjP = mid(j, kL);
    var ci = i - kL;   /* the cloud under bar i was drawn from bar i-26 */
    var sA = (mid(ci, tL) + mid(ci, kL)) / 2, sB = mid(ci, sL);
    var c = pgrNum(rows[i].c);
    if (![tk, kj, tkP, kjP, sA, sB, c].every(isFinite)) return { dir: null };
    var cloudTop = Math.max(sA, sB), cloudBot = Math.min(sA, sB);
    if (tk > kj && tkP <= kjP && c > cloudTop) return pgrResult('long', c, kj, { tenkan: tk, kijun: kj, cloud: [cloudBot, cloudTop] });
    if (tk < kj && tkP >= kjP && c < cloudBot) return pgrResult('short', c, kj, { tenkan: tk, kijun: kj, cloud: [cloudBot, cloudTop] });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}

/* Donchian 20 / 10 (the Turtle S1 shape): the last closed bar is the FIRST
   close beyond the prior 20-bar channel; the stop is the prior 10-bar
   channel on the other side (the exit channel). */
function pineGoldDonchian(rows, opts){
  opts = opts || {};
  var eL = opts.entryLen || 20, xL = opts.exitLen || 10;
  try{
    var n = rows ? rows.length : 0;
    if (n < eL + xL + 3) return { dir: null };
    var i = n - 1;
    var hi = pgrHighest(rows, i - eL, i - 1, 'h'), lo = pgrLowest(rows, i - eL, i - 1, 'l');
    var c = pgrNum(rows[i].c);
    if (![hi, lo, c].every(isFinite)) return { dir: null };
    /* the FIRST breakout: none of the prior exit-channel bars (10) closed
       beyond ITS OWN 20-bar channel on that side -- the Turtle takes one
       entry per breakout and the next only after the exit channel has been
       given back, which this state-free read approximates. */
    function brokeBefore(side){
      for (var k = i - xL; k < i; k++){
        if (k - eL < 0) return true;   /* channel unreadable: no claim */
        var ck = pgrNum(rows[k].c);
        var lvl = side === 'long' ? pgrHighest(rows, k - eL, k - 1, 'h') : pgrLowest(rows, k - eL, k - 1, 'l');
        if (!isFinite(ck) || !isFinite(lvl)) return true;
        if (side === 'long' ? ck > lvl : ck < lvl) return true;
      }
      return false;
    }
    if (c > hi && !brokeBefore('long')) return pgrResult('long', c, pgrLowest(rows, i - xL, i - 1, 'l'), { channel: [lo, hi] });
    if (c < lo && !brokeBefore('short')) return pgrResult('short', c, pgrHighest(rows, i - xL, i - 1, 'h'), { channel: [lo, hi] });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}

/* EMA 8 / 21 cross with RSI 14 on the right side of 50 on the cross bar.
   Stop is the prior 5-bar swing on the other side. */
function pineGoldEmaCrossRsi(rows, opts){
  opts = opts || {};
  var fL = opts.fast || 8, sL = opts.slow || 21, rL = opts.rsiLen || 14, sw = opts.swing || 5;
  try{
    var emaFn = gfn('ema') || gfn('pineEma'), rsiFn = gfn('rsi') || gfn('pineRsi');
    var n = rows ? rows.length : 0;
    if (typeof emaFn !== 'function' || typeof rsiFn !== 'function' || n < sL + sw + 3) return { dir: null };
    var closes = rows.map(function(r){ return r.c; });
    var ef = emaFn(closes, fL), es = emaFn(closes, sL), rs = rsiFn(closes, rL);
    var i = n - 1;
    var f = pgrNum(ef[i]), s = pgrNum(es[i]), fP = pgrNum(ef[i - 1]), sP = pgrNum(es[i - 1]), r = pgrNum(rs[i]), c = pgrNum(closes[i]);
    if (![f, s, fP, sP, r, c].every(isFinite)) return { dir: null };
    if (f > s && fP <= sP && r > 50) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { fast: f, slow: s, rsi: r });
    if (f < s && fP >= sP && r < 50) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { fast: f, slow: s, rsi: r });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}

/* Keltner pullback: EMA 50 rising over 5 bars, the PRIOR bar reached the
   lower band (EMA 20 - 1.5 x ATR 10), the last closed bar closes back
   above it and up. Stop is the pullback low. Mirrored for shorts. */
function pineGoldKeltnerPullback(rows, opts){
  opts = opts || {};
  var eL = opts.emaLen || 20, aL = opts.atrLen || 10, m = opts.mult || 1.5, tL = opts.trendLen || 50, sb = opts.slopeBars || 5;
  try{
    var emaFn = gfn('ema') || gfn('pineEma'), atrFn = gfn('atr') || gfn('pineAtr');
    var n = rows ? rows.length : 0;
    if (typeof emaFn !== 'function' || typeof atrFn !== 'function' || n < tL + sb + 3) return { dir: null };
    var closes = rows.map(function(r){ return r.c; });
    var mid = emaFn(closes, eL), tr = emaFn(closes, tL), a = atrFn(rows, aL);
    var i = n - 1, j = n - 2;
    var lo = pgrNum(mid[j]) - m * pgrNum(a[j]), hi = pgrNum(mid[j]) + m * pgrNum(a[j]);
    var loI = pgrNum(mid[i]) - m * pgrNum(a[i]), hiI = pgrNum(mid[i]) + m * pgrNum(a[i]);
    var t0 = pgrNum(tr[i]), t1 = pgrNum(tr[i - sb]);
    var c = pgrNum(rows[i].c), o = pgrNum(rows[i].o), lJ = pgrNum(rows[j].l), hJ = pgrNum(rows[j].h), lI = pgrNum(rows[i].l), hI = pgrNum(rows[i].h);
    if (![lo, hi, loI, hiI, t0, t1, c, o, lJ, hJ, lI, hI].every(isFinite)) return { dir: null };
    if (t0 > t1 && lJ <= lo && c > loI && c > o) return pgrResult('long', c, Math.min(lJ, lI), { band: [loI, hiI] });
    if (t0 < t1 && hJ >= hi && c < hiI && c < o) return pgrResult('short', c, Math.max(hJ, hI), { band: [loI, hiI] });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}

/* The record-only setups for one lane: every layer in the table that fired
   on the last closed bar, built through the SAME pineGoldLayerSetup the ten
   layers above use, then stamped. Stamped rather than tiered, because the
   tier is what the signal is (a fresh flip IS primary); what it is not is
   measured. `demoted` is the hg-v1005 field sortSetups and the shared pick
   already sink; `recordOnly` is the field the desk reads to withhold the two
   handoffs and the pin, and to ask the ledger whether to release it. */
function pineGoldRecordLayerSetups(rows, mode){
  var out = [];
  if (!rows || !rows.length) return out;
  for (var i = 0; i < PINE_GOLD_RECORD_LAYERS.length; i++){
    var layer = PINE_GOLD_RECORD_LAYERS[i];
    var res = pineGoldRunLayer(layer, rows);
    if (!res || !res.dir) continue;
    var s = pineGoldLayerSetup(layer, res, res.dir, rows, mode);
    if (!s) continue;
    s.recordOnly = true;
    s.recordLayer = layer.id;
    s.recordTwin = layer.twin || null;
    s.demoted = true;
    s.demotedWhy = 'RECORD ONLY — ' + layer.label + ' has no measured record on this desk';
    out.push(s);
  }
  return out;
}

/* =======================================================================
   hg-v1165: THE PINE STACK AS A CONFLUENCE OF READS, NOT A VOTE.

   Asked to use the five gold Pine layers (hg-v1164) on OMNIGOLD, GOLD
   SCALP, GOLD PINE and GANESH GOLD "to form a confluence", the measured
   record still says a new weight is an unmeasured gate (hg-v966) or noise
   with a label (hg-v987 / v945 / v922). So the confluence enters the way
   every other read has since hg-v1155: each layer's STATE on the desk's
   own execution tape -- the side the Supertrend band sits on, Tenkan
   against Kijun with the close against the Kumo, the close against the
   Donchian midline, EMA 8 against EMA 21, the close against the Keltner
   mid with the EMA 50 slope -- marked three-state (WITH / AGAINST / absent)
   on every record, with a sixth mark for the majority of the readable
   states. The ledger can then ask, out of sample, whether any layer or the
   majority separates winners on each desk. Nothing scores on any of it. */
function pgrStateOf(res){ return res && (res.dir === 'long' || res.dir === 'short') ? res.dir : null; }
function pineGoldLayerStates(rows){
  var out = { ok: false, supertrend: null, ichimoku: null, donchian: null, emacross: null, keltner: null, readable: 0, agreeLong: 0, agreeShort: 0 };
  try{
    if (!rows || rows.length < 60) return out;
    var n = rows.length, i = n - 1;
    var c = pgrNum(rows[i].c);
    if (!isFinite(c)) return out;
    var layerOpts = function(id){ var l = PINE_GOLD_RECORD_LAYERS.filter(function(x){ return x.id === id; })[0]; return (l && l.opts) || {}; };
    /* supertrend: the side of the band after the last closed bar */
    var st = pineGoldSupertrend(rows, layerOpts('supertrend'));
    if (st && (st.trend === 1 || st.trend === -1)) out.supertrend = st.trend === 1 ? 'long' : 'short';
    /* ichimoku: tenkan against kijun, the close against the cloud of 26 bars back */
    try{
      var io = layerOpts('ichimoku'), tL = io.tenkan || 9, kL = io.kijun || 26, sL = io.senkou || 52;
      if (n >= sL + kL + 2){
        var mid = function(j, len){ var hh = pgrHighest(rows, j - len + 1, j, 'h'), ll = pgrLowest(rows, j - len + 1, j, 'l'); return (hh + ll) / 2; };
        var tk = mid(i, tL), kj = mid(i, kL), ci = i - kL;
        var sA = (mid(ci, tL) + mid(ci, kL)) / 2, sB = mid(ci, sL);
        if ([tk, kj, sA, sB].every(isFinite)){
          if (tk > kj && c > Math.max(sA, sB)) out.ichimoku = 'long';
          else if (tk < kj && c < Math.min(sA, sB)) out.ichimoku = 'short';
        }
      }
    }catch(eI){}
    /* donchian: the close against the midline of the prior 20-bar channel */
    try{
      var dO = layerOpts('donchian'), eL = dO.entryLen || 20;
      var hi = pgrHighest(rows, i - eL, i - 1, 'h'), lo = pgrLowest(rows, i - eL, i - 1, 'l');
      if (isFinite(hi) && isFinite(lo) && hi > lo){
        var dm = (hi + lo) / 2;
        if (c > dm) out.donchian = 'long'; else if (c < dm) out.donchian = 'short';
      }
    }catch(eD){}
    /* ema cross: EMA 8 against EMA 21 */
    try{
      var emaFn = gfn('ema') || gfn('pineEma');
      var xO = layerOpts('emacross'), fL = xO.fast || 8, sl = xO.slow || 21;
      if (typeof emaFn === 'function'){
        var closes = rows.map(function(r){ return r.c; });
        var ef = emaFn(closes, fL), es = emaFn(closes, sl);
        var f = pgrNum(ef[i]), s = pgrNum(es[i]);
        if (isFinite(f) && isFinite(s)){ if (f > s) out.emacross = 'long'; else if (f < s) out.emacross = 'short'; }
        /* keltner: the close against the EMA 20 mid with the EMA 50 slope agreeing */
        var kO = layerOpts('keltner'), mL = kO.emaLen || 20, tLn = kO.trendLen || 50, sb = kO.slopeBars || 5;
        var km = emaFn(closes, mL), kt = emaFn(closes, tLn);
        var m0 = pgrNum(km[i]), t0 = pgrNum(kt[i]), t1 = pgrNum(kt[i - sb]);
        if (isFinite(m0) && isFinite(t0) && isFinite(t1)){
          if (c > m0 && t0 > t1) out.keltner = 'long';
          else if (c < m0 && t0 < t1) out.keltner = 'short';
        }
      }
    }catch(eK){}
    PINE_GOLD_RECORD_LAYERS.forEach(function(l){
      var v = out[l.id];
      if (v === 'long'){ out.readable++; out.agreeLong++; }
      else if (v === 'short'){ out.readable++; out.agreeShort++; }
    });
    out.ok = true;
  }catch(e){ out.ok = false; }
  return out;
}
/* six three-state marks for one direction: one per layer (WITH when the
   layer's state is the plan's side, AGAINST when the other side, absent
   when the layer reads neither) and the majority of the readable states
   (at least three of the five with the plan is true, at least three
   against is false, anything else absent) */
var PINE_GOLD_MAJORITY = 3;
function pineGoldPineMarks(states, dir){
  var m = {};
  if (!states || states.ok !== true || (dir !== 'long' && dir !== 'short')) return m;
  PINE_GOLD_RECORD_LAYERS.forEach(function(l){
    var v = states[l.id];
    if (v === 'long' || v === 'short') m['pine:' + l.id + 'With'] = (v === dir);
  });
  var withN = dir === 'long' ? states.agreeLong : states.agreeShort;
  var againstN = dir === 'long' ? states.agreeShort : states.agreeLong;
  if (withN >= PINE_GOLD_MAJORITY) m['pine:majorityWith'] = true;
  else if (againstN >= PINE_GOLD_MAJORITY) m['pine:majorityWith'] = false;
  return m;
}
/* the card line: every layer's state and the majority, UNREAD where the
   layer read neither; reported, never scored */
function pineGoldStackLineHtml(states, marks){
  try{
    if (!states || states.ok !== true) return '';
    marks = (marks && typeof marks === 'object') ? marks : {};
    function e(x){ return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    var cells = '';
    PINE_GOLD_RECORD_LAYERS.forEach(function(l){
      var v = states[l.id], mk = marks['pine:' + l.id + 'With'];
      var tag = v ? v.toUpperCase() : 'UNREAD';
      var cls = (mk === true) ? 'ok' : (mk === false ? 'no' : 'na');
      cells += '<span class="gsx-ind ' + cls + '" title="' + e('pine:' + l.id + 'With — ' + l.label + ' state on this tape') + '"><b>' + e(l.label) + '</b> ' + e(tag) + '</span>';
    });
    var mj = marks['pine:majorityWith'];
    var mjTag = mj === true ? 'WITH' : (mj === false ? 'AGAINST' : 'SPLIT');
    cells += '<span class="gsx-ind ' + (mj === true ? 'ok' : (mj === false ? 'no' : 'na')) + '" title="pine:majorityWith — at least three of the readable states"><b>MAJORITY</b> ' + mjTag + ' ' + states.agreeLong + 'L/' + states.agreeShort + 'S</span>';
    return '<div class="note gsx-pinestack" data-hg-pine-stack="1" style="margin-top:6px;font-size:11px"><b>PINE STACK</b> · '
      + states.readable + ' of ' + PINE_GOLD_RECORD_LAYERS.length + ' gold Pine layers readable on this tape'
      + ' — recorded for the forward ledger’s read split, not part of this desk’s score, gates nothing.'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + cells + '</div></div>';
  }catch(e){ return ''; }
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
G.PINE_GOLD_RECORD_LAYERS = PINE_GOLD_RECORD_LAYERS;   /* hg-v1164 */
G.pineGoldRecordLayerSetups = pineGoldRecordLayerSetups;
G.pineGoldSupertrend = pineGoldSupertrend;
G.pineGoldIchimoku = pineGoldIchimoku;
G.pineGoldDonchian = pineGoldDonchian;
G.pineGoldEmaCrossRsi = pineGoldEmaCrossRsi;
G.pineGoldKeltnerPullback = pineGoldKeltnerPullback;
G.pineGoldLayerStates = pineGoldLayerStates;   /* hg-v1165 */
G.pineGoldPineMarks = pineGoldPineMarks;
G.pineGoldStackLineHtml = pineGoldStackLineHtml;
G.PINE_GOLD_MAJORITY = PINE_GOLD_MAJORITY;
G.PINE_GOLD_SCAN = PINE_GOLD_SCAN;
G.PINE_GOLD_MAX = PINE_GOLD_MAX;
G.PINE_GOLD_TIER = PINE_GOLD_TIER;
G.pineGoldUniverse = pineGoldUniverse;
G.pineGoldLayerSetup = pineGoldLayerSetup;
G.pineGoldConfluence = pineGoldConfluence;
G.pineGoldHtfBias = pineGoldHtfBias;
G.pineGoldGrade = pineGoldGrade;
G.pineGoldLevelsFromBars = pineGoldLevelsFromBars;
G.pineGoldEvalDir = pineGoldEvalDir;
G.pineGoldNativeBundle = pineGoldNativeBundle;
G.pineGoldOuZscore = pineGoldOuZscore;

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    PINE_GOLD_LAYERS, PINE_GOLD_SCAN, PINE_GOLD_MAX, PINE_GOLD_TIER, pineGoldConfluence, pineGoldHtfBias,
    pineGoldGrade, pineGoldLevelsFromBars, pineGoldEvalDir, pineGoldNativeBundle, pineGoldOuZscore,
    pineGoldUniverse, pineGoldLayerSetup,
    PINE_GOLD_RECORD_LAYERS, pineGoldRecordLayerSetups, pineGoldSupertrend, pineGoldIchimoku,
    pineGoldDonchian, pineGoldEmaCrossRsi, pineGoldKeltnerPullback,
    pineGoldLayerStates, pineGoldPineMarks, pineGoldStackLineHtml, PINE_GOLD_MAJORITY
  };
}

})();
