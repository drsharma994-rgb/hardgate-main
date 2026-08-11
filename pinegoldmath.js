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
    pineGoldUniverse, pineGoldLayerSetup
  };
}

})();
