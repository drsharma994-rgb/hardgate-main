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
    opts: { emaLen: 20, atrLen: 10, mult: 1.5, trendLen: 50, slopeBars: 5 }, twin: null },
  /* hg-v1166: three more bar-only Pine ports a gold trader runs, the same
     shape as the five above -- fire ONLY on the last closed bar, a wrong-side
     stop is no signal, record-only until the ledger measures them paying.
     None has an exact OMNIGOLD twin: STOCHRSI-TURN reads a StochRSI turn, not
     the plain Stochastic cross, and a loose analogy is not a twin (hg-v943). */
  { id: 'macd', label: 'MACD Cross', fn: 'pineGoldMacdCross', minBars: 60,
    opts: { fast: 12, slow: 26, signal: 9, swing: 5 }, twin: null },
  { id: 'psar', label: 'Parabolic SAR Flip', fn: 'pineGoldPsarFlip', minBars: 60,
    opts: { step: 0.02, max: 0.2 }, twin: null },
  { id: 'stoch', label: 'Stochastic Cross', fn: 'pineGoldStochCross', minBars: 60,
    opts: { kLen: 14, kSmooth: 3, dLen: 3, ob: 80, os: 20, swing: 5 }, twin: null },
  /* hg-v1167: four more, the same shape. The Chandelier Exit and the Hull MA
     turn name no OMNIGOLD twin. The CCI re-entry IS the rule OMNIGOLD runs as
     CCI-EXTREME (CCI 20 back inside +/-100 from an extreme on the last closed
     bar), so it names that twin and quotes its gate-clear record. The Aroon
     cross names none (DI-CROSS reads +DI against -DI, a different series). The
     TTM squeeze is NOT here: the ten-layer table above already carries it as
     Squeeze Mom, and a second copy would be a second rule (hg-v949). */
  { id: 'chandelier', label: 'Chandelier Exit', fn: 'pineGoldChandelierExit', minBars: 60,
    opts: { len: 22, mult: 3 }, twin: null },
  { id: 'hullma', label: 'Hull MA Turn', fn: 'pineGoldHullTurn', minBars: 60,
    opts: { len: 20, swing: 5 }, twin: null },
  { id: 'cci', label: 'CCI Re-entry', fn: 'pineGoldCciReentry', minBars: 60,
    opts: { len: 20, band: 100, swing: 5 }, twin: 'CCI-EXTREME' },
  { id: 'aroon', label: 'Aroon Cross', fn: 'pineGoldAroonCross', minBars: 60,
    opts: { len: 25, swing: 5 }, twin: null },
  /* hg-v1171: three more bar-only Pine ports a gold trader runs. Williams
     %R re-entry (distance from recent high, different series from Stochastic
     which measures position within the range); TRIX zero cross (triple-
     smoothed momentum, different from MACD which crosses its signal line);
     Fisher Transform zero cross (Ehlers' Gaussian mapping of hl2, a scale
     no other layer here reads). None has an exact OMNIGOLD twin: the
     closest sibling of Williams %R is WILLIAMS-FAIL and that mechanic is
     NOT registered on OMNIGOLD today (confirmed by hgGoldSiblingRecord
     returning null), and a loose analogy is not a twin (hg-v943). */
  { id: 'williams', label: 'Williams %R Re-entry', fn: 'pineGoldWilliamsReentry', minBars: 60,
    opts: { len: 14, os: -80, ob: -20, swing: 5 }, twin: null },
  { id: 'trix', label: 'TRIX Zero Cross', fn: 'pineGoldTrixCross', minBars: 60,
    opts: { len: 15, swing: 5 }, twin: null },
  { id: 'fisher', label: 'Fisher Transform', fn: 'pineGoldFisherZero', minBars: 60,
    opts: { len: 10, swing: 5 }, twin: null }
];
/* hg-v1165's majority mark is the majority of the FIVE hg-v1164 layers --
   records written since then carry that meaning, so the three hg-v1166
   layers mark their own states and do not move the majority's population. */
var PINE_GOLD_MAJORITY_IDS = ['supertrend', 'ichimoku', 'donchian', 'emacross', 'keltner'];

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

/* hg-v1166: the series the three new layers read, stated once each */
function pgrMacdSeries(rows, fL, sL, gL){
  var emaFn = gfn('ema') || gfn('pineEma');
  if (typeof emaFn !== 'function' || !rows || !rows.length) return null;
  var closes = rows.map(function(r){ return r.c; });
  var ef = emaFn(closes, fL), es = emaFn(closes, sL);
  var macd = closes.map(function(_, i){ var a = pgrNum(ef[i]), b = pgrNum(es[i]); return (isFinite(a) && isFinite(b)) ? a - b : NaN; });
  var sig = emaFn(macd.map(function(v){ return isFinite(v) ? v : 0; }), gL);
  return { macd: macd, sig: sig };
}
function pgrPsarSeries(rows, step, max){
  var n = rows ? rows.length : 0;
  if (n < 3) return null;
  var sar = new Array(n), up = new Array(n);
  var h0 = pgrNum(rows[0].h), l0 = pgrNum(rows[0].l), h1 = pgrNum(rows[1].h), l1 = pgrNum(rows[1].l);
  if (![h0, l0, h1, l1].every(isFinite)) return null;
  var isUp = pgrNum(rows[1].c) >= pgrNum(rows[0].c);
  var ep = isUp ? Math.max(h0, h1) : Math.min(l0, l1), af = step, s = isUp ? Math.min(l0, l1) : Math.max(h0, h1);
  sar[0] = NaN; up[0] = null; sar[1] = s; up[1] = isUp;
  for (var i = 2; i < n; i++){
    var h = pgrNum(rows[i].h), l = pgrNum(rows[i].l), hP = pgrNum(rows[i - 1].h), lP = pgrNum(rows[i - 1].l);
    if (![h, l, hP, lP].every(isFinite)) return null;
    var ns = s + af * (ep - s);
    if (isUp){
      ns = Math.min(ns, lP, pgrNum(rows[i - 2].l));
      if (l < ns){ isUp = false; ns = ep; ep = l; af = step; }
      else if (h > ep){ ep = h; af = Math.min(max, af + step); }
    } else {
      ns = Math.max(ns, hP, pgrNum(rows[i - 2].h));
      if (h > ns){ isUp = true; ns = ep; ep = h; af = step; }
      else if (l < ep){ ep = l; af = Math.min(max, af + step); }
    }
    s = ns; sar[i] = s; up[i] = isUp;
  }
  return { sar: sar, up: up };
}
function pgrStochSeries(rows, kLen, kSm, dLen){
  var n = rows ? rows.length : 0;
  if (n < kLen + kSm + dLen + 2) return null;
  var raw = new Array(n), k = new Array(n), d = new Array(n), i, j, acc;
  for (i = 0; i < n; i++){
    if (i < kLen - 1){ raw[i] = NaN; continue; }
    var hh = pgrHighest(rows, i - kLen + 1, i, 'h'), ll = pgrLowest(rows, i - kLen + 1, i, 'l'), c = pgrNum(rows[i].c);
    raw[i] = (isFinite(hh) && isFinite(ll) && isFinite(c) && hh > ll) ? (c - ll) / (hh - ll) * 100 : NaN;
  }
  function sma(src, len, out){
    for (i = 0; i < n; i++){
      if (i < len - 1){ out[i] = NaN; continue; }
      acc = 0;
      for (j = i - len + 1; j <= i; j++){ if (!isFinite(src[j])){ acc = NaN; break; } acc += src[j]; }
      out[i] = isFinite(acc) ? acc / len : NaN;
    }
  }
  sma(raw, kSm, k); sma(k, dLen, d);
  return { k: k, d: d };
}
/* MACD 12 / 26 / 9: the MACD line crosses its signal on the last closed bar
   (the plain Pine strategy: the histogram changes sign). Stop is the prior
   5-bar swing on the other side. No zero-line filter: on a cycling tape every
   bullish cross sits under zero and every bearish one over it, so that
   variant fires nothing to measure. */
function pineGoldMacdCross(rows, opts){
  opts = opts || {};
  var fL = opts.fast || 12, sL = opts.slow || 26, gL = opts.signal || 9, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < sL + gL + sw + 3) return { dir: null };
    var S = pgrMacdSeries(rows, fL, sL, gL);
    if (!S) return { dir: null };
    var i = n - 1;
    var m = pgrNum(S.macd[i]), g = pgrNum(S.sig[i]), mP = pgrNum(S.macd[i - 1]), gP = pgrNum(S.sig[i - 1]), c = pgrNum(rows[i].c);
    if (![m, g, mP, gP, c].every(isFinite)) return { dir: null };
    if (m > g && mP <= gP) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { macd: m, signal: g, hist: m - g });
    if (m < g && mP >= gP) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { macd: m, signal: g, hist: m - g });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}
/* Parabolic SAR (0.02 step, 0.2 max): the SAR flips to the other side of
   price on the last closed bar. Stop is the new SAR. */
function pineGoldPsarFlip(rows, opts){
  opts = opts || {};
  var step = opts.step || 0.02, max = opts.max || 0.2;
  try{
    var n = rows ? rows.length : 0;
    if (n < 20) return { dir: null };
    var S = pgrPsarSeries(rows, step, max);
    if (!S) return { dir: null };
    var i = n - 1, c = pgrNum(rows[i].c), s = pgrNum(S.sar[i]);
    if (!isFinite(c) || !isFinite(s)) return { dir: null };
    if (S.up[i] === true && S.up[i - 1] === false) return pgrResult('long', c, s, { sar: s });
    if (S.up[i] === false && S.up[i - 1] === true) return pgrResult('short', c, s, { sar: s });
    return { dir: null, trend: S.up[i] === true ? 1 : -1 };
  }catch(e){ return { dir: null }; }
}
/* Stochastic 14 / 3 / 3: %K crosses %D on the last closed bar out of the
   oversold band (prior %K under 20) for a long, out of the overbought band
   (prior %K over 80) for a short. Stop is the prior 5-bar swing. */
function pineGoldStochCross(rows, opts){
  opts = opts || {};
  var kL = opts.kLen || 14, kS = opts.kSmooth || 3, dL = opts.dLen || 3, ob = opts.ob || 80, os = opts.os || 20, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < kL + kS + dL + sw + 3) return { dir: null };
    var S = pgrStochSeries(rows, kL, kS, dL);
    if (!S) return { dir: null };
    var i = n - 1;
    var k = pgrNum(S.k[i]), d = pgrNum(S.d[i]), kP = pgrNum(S.k[i - 1]), dP = pgrNum(S.d[i - 1]), c = pgrNum(rows[i].c);
    if (![k, d, kP, dP, c].every(isFinite)) return { dir: null };
    if (k > d && kP <= dP && kP < os) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { k: k, d: d });
    if (k < d && kP >= dP && kP > ob) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { k: k, d: d });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}

/* hg-v1167: the series the four new layers read, stated once each */
function pgrWma(src, len){
  var n = src.length, out = new Array(n), i, j, acc, w, den = len * (len + 1) / 2;
  for (i = 0; i < n; i++){
    if (i < len - 1){ out[i] = NaN; continue; }
    acc = 0; w = 1;
    for (j = i - len + 1; j <= i; j++, w++){ var v = pgrNum(src[j]); if (!isFinite(v)){ acc = NaN; break; } acc += v * w; }
    out[i] = isFinite(acc) ? acc / den : NaN;
  }
  return out;
}
/* Hull MA: WMA(2 x WMA(n/2) - WMA(n), sqrt(n)) */
function pgrHullSeries(rows, len){
  var n = rows ? rows.length : 0;
  if (n < len + 5) return null;
  var closes = rows.map(function(r){ return pgrNum(r.c); });
  var half = Math.max(1, Math.round(len / 2)), sq = Math.max(1, Math.round(Math.sqrt(len)));
  var a = pgrWma(closes, half), b = pgrWma(closes, len);
  var diff = closes.map(function(_, i){ var x = pgrNum(a[i]), y = pgrNum(b[i]); return (isFinite(x) && isFinite(y)) ? 2 * x - y : NaN; });
  return pgrWma(diff, sq);
}
/* CCI (typical price, 0.015 x mean deviation), Lambert's own */
function pgrCciSeries(rows, len){
  var n = rows ? rows.length : 0;
  if (n < len + 2) return null;
  var tp = new Array(n), out = new Array(n), i, k, s, m, md;
  for (i = 0; i < n; i++){
    var h = pgrNum(rows[i].h), l = pgrNum(rows[i].l), c = pgrNum(rows[i].c);
    tp[i] = (h + l + c) / 3;   /* pgrNum reads a null price as NaN already */
  }
  for (i = 0; i < n; i++){
    if (i < len - 1){ out[i] = NaN; continue; }
    s = 0;
    for (k = i - len + 1; k <= i; k++){ if (!isFinite(tp[k])){ s = NaN; break; } s += tp[k]; }
    if (!isFinite(s)){ out[i] = NaN; continue; }
    m = s / len; md = 0;
    for (k = i - len + 1; k <= i; k++) md += Math.abs(tp[k] - m);
    md /= len;
    out[i] = (md > 0) ? (tp[i] - m) / (0.015 * md) : NaN;
  }
  return out;
}
/* Chandelier Exit (everget's Pine): the long trail is the 22-bar high minus
   3 x ATR 22 and ratchets up while price holds above it; the short trail the
   mirror; the direction flips when a close crosses the OTHER trail */
function pgrChandelierSeries(rows, len, mult){
  var atrFn = gfn('atr') || gfn('pineAtr');
  var n = rows ? rows.length : 0;
  if (typeof atrFn !== 'function' || n < len + 5) return null;
  var a = atrFn(rows, len);
  var longS = new Array(n), shortS = new Array(n), dir = new Array(n), i;
  for (i = 0; i < n; i++){
    var av = pgrNum(a[i]), c = pgrNum(rows[i].c), pc = pgrNum(rows[i - 1] && rows[i - 1].c);
    if (i < len - 1 || !isFinite(av) || !isFinite(c)){ longS[i] = NaN; shortS[i] = NaN; dir[i] = 0; continue; }
    var hh = pgrHighest(rows, i - len + 1, i, 'h'), ll = pgrLowest(rows, i - len + 1, i, 'l');
    if (!isFinite(hh) || !isFinite(ll)){ longS[i] = NaN; shortS[i] = NaN; dir[i] = 0; continue; }
    var ls = hh - mult * av, ss = ll + mult * av;
    var pls = pgrNum(longS[i - 1]), pss = pgrNum(shortS[i - 1]);
    if (isFinite(pls) && isFinite(pc) && pc > pls) ls = Math.max(ls, pls);
    if (isFinite(pss) && isFinite(pc) && pc < pss) ss = Math.min(ss, pss);
    longS[i] = ls; shortS[i] = ss;
    var pd = dir[i - 1] || 0;
    if (isFinite(pss) && c > pss) dir[i] = 1;
    else if (isFinite(pls) && c < pls) dir[i] = -1;
    else dir[i] = pd;
  }
  return { longStop: longS, shortStop: shortS, dir: dir };
}
/* Aroon: up = 100 x (len - bars since the len-bar high) / len, down the mirror */
function pgrAroonSeries(rows, len){
  var n = rows ? rows.length : 0;
  if (n < len + 2) return null;
  var up = new Array(n), dn = new Array(n), i, k;
  for (i = 0; i < n; i++){
    if (i < len){ up[i] = NaN; dn[i] = NaN; continue; }
    var hi = -Infinity, lo = Infinity, hiAt = -1, loAt = -1, bad = false;
    for (k = i - len; k <= i; k++){
      var h = pgrNum(rows[k].h), l = pgrNum(rows[k].l);
      if (!isFinite(h) || !isFinite(l)){ bad = true; break; }
      if (h >= hi){ hi = h; hiAt = k; }
      if (l <= lo){ lo = l; loAt = k; }
    }
    if (bad){ up[i] = NaN; dn[i] = NaN; continue; }
    up[i] = 100 * (len - (i - hiAt)) / len;
    dn[i] = 100 * (len - (i - loAt)) / len;
  }
  return { up: up, down: dn };
}
/* hg-v1171: Williams %R(len) = -100 * (highH - close) / (highH - lowL) across
   the len-bar window ending at i. Scale: 0 at the high, -100 at the low. On a
   flat window (highH === lowL) the formula divides by zero -- NaN here, which
   downstream unread is absent and never a guessed zero (hg-v989). */
function pgrWilliamsSeries(rows, len){
  var n = rows ? rows.length : 0;
  if (n < len + 2) return null;
  var out = new Array(n), i, k;
  for (i = 0; i < n; i++){
    if (i < len - 1){ out[i] = NaN; continue; }
    var hi = -Infinity, lo = Infinity, bad = false;
    for (k = i - len + 1; k <= i; k++){
      var h = pgrNum(rows[k].h), l = pgrNum(rows[k].l);
      if (!isFinite(h) || !isFinite(l)){ bad = true; break; }
      if (h > hi) hi = h;
      if (l < lo) lo = l;
    }
    var c = pgrNum(rows[i].c);
    if (bad || !isFinite(c) || !(hi > lo)){ out[i] = NaN; continue; }
    out[i] = -100 * (hi - c) / (hi - lo);
  }
  return out;
}
/* hg-v1171: TRIX(len) is the 1-period momentum of a triple-smoothed EMA of
   close. Pine's trix() does exactly this; it is NOT the MACD arithmetic
   (hg-v949). We compute it inline rather than borrow a one-off EMA helper
   because the three-stage smoothing is the mechanic. A dead-flat tape leaves
   NaN rather than 0 -- a close-equal series gives TRIX zero, which the port
   reads as NEITHER (hg-v989's third state). */
function pgrTrixSeries(rows, len){
  var n = rows ? rows.length : 0;
  if (n < 3 * len + 3) return null;
  var k = 2 / (len + 1);
  var e1 = new Array(n), e2 = new Array(n), e3 = new Array(n), out = new Array(n), i;
  for (i = 0; i < n; i++){
    var c = pgrNum(rows[i].c);
    if (!isFinite(c)){ e1[i] = NaN; e2[i] = NaN; e3[i] = NaN; out[i] = NaN; continue; }
    e1[i] = (i === 0 || !isFinite(e1[i - 1])) ? c : (e1[i - 1] + k * (c - e1[i - 1]));
    e2[i] = (i === 0 || !isFinite(e2[i - 1])) ? e1[i] : (e2[i - 1] + k * (e1[i] - e2[i - 1]));
    e3[i] = (i === 0 || !isFinite(e3[i - 1])) ? e2[i] : (e3[i - 1] + k * (e2[i] - e3[i - 1]));
    if (i < 3 * (len - 1) + 1 || !(e3[i - 1] > 0)){ out[i] = NaN; continue; }
    out[i] = 10000 * (e3[i] - e3[i - 1]) / e3[i - 1];
  }
  return out;
}
/* hg-v1171: Fisher Transform(len) -- Ehlers' price-to-Gaussian mapping. Scale
   the hl2 midpoint into [-1, 1] over the len-bar window, clamp away from the
   singularities at +/-1 (ln(0) and ln(inf) are both undefined, so a bar that
   closed exactly at the window extreme is clamped to +/-0.999 rather than
   NaN; this is Ehlers' own clamp, not an invention), then recursively
   half-weight the previous Fisher. A flat window reads NaN; the state is
   unread when fisher is exactly zero. */
function pgrFisherSeries(rows, len){
  var n = rows ? rows.length : 0;
  if (n < len + 2) return null;
  var x = new Array(n), fi = new Array(n), i, k;
  for (i = 0; i < n; i++){
    if (i < len - 1){ x[i] = NaN; fi[i] = NaN; continue; }
    var hi = -Infinity, lo = Infinity, bad = false;
    for (k = i - len + 1; k <= i; k++){
      var h = pgrNum(rows[k].h), l = pgrNum(rows[k].l);
      if (!isFinite(h) || !isFinite(l)){ bad = true; break; }
      if (h > hi) hi = h;
      if (l < lo) lo = l;
    }
    var hc = pgrNum(rows[i].h), lc = pgrNum(rows[i].l);
    if (bad || !isFinite(hc) || !isFinite(lc) || !(hi > lo)){ x[i] = NaN; fi[i] = NaN; continue; }
    var mid = (hc + lc) / 2;
    var raw = 2 * ((mid - lo) / (hi - lo)) - 1;
    if (raw > 0.999) raw = 0.999; else if (raw < -0.999) raw = -0.999;
    x[i] = raw;
    var pf = (i > 0 && isFinite(fi[i - 1])) ? fi[i - 1] : 0;
    fi[i] = 0.5 * Math.log((1 + raw) / (1 - raw)) + 0.5 * pf;
  }
  return fi;
}
/* Chandelier Exit 22 x 3: the direction flips on the last closed bar. Stop is
   the trail the flip put under / over price. */
function pineGoldChandelierExit(rows, opts){
  opts = opts || {};
  var len = opts.len || 22, mult = opts.mult || 3;
  try{
    var n = rows ? rows.length : 0;
    if (n < len + 5) return { dir: null };
    var S = pgrChandelierSeries(rows, len, mult);
    if (!S) return { dir: null };
    var i = n - 1, c = pgrNum(rows[i].c);
    if (!isFinite(c)) return { dir: null };
    if (S.dir[i] === 1 && S.dir[i - 1] === -1) return pgrResult('long', c, S.longStop[i], { trail: S.longStop[i] });
    if (S.dir[i] === -1 && S.dir[i - 1] === 1) return pgrResult('short', c, S.shortStop[i], { trail: S.shortStop[i] });
    return { dir: null, trend: S.dir[i] };
  }catch(e){ return { dir: null }; }
}
/* Hull MA 20: the HMA turns up on the last closed bar (rising now, not rising
   the bar before) for a long, the mirror for a short. Stop is the prior
   5-bar swing on the other side. */
function pineGoldHullTurn(rows, opts){
  opts = opts || {};
  var len = opts.len || 20, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < len + sw + 5) return { dir: null };
    var H = pgrHullSeries(rows, len);
    if (!H) return { dir: null };
    var i = n - 1;
    var h0 = pgrNum(H[i]), h1 = pgrNum(H[i - 1]), h2 = pgrNum(H[i - 2]), c = pgrNum(rows[i].c);
    if (![h0, h1, h2, c].every(isFinite)) return { dir: null };
    if (h0 > h1 && h1 <= h2) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { hma: h0 });
    if (h0 < h1 && h1 >= h2) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { hma: h0 });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}
/* CCI 20 re-entry (the rule OMNIGOLD runs as CCI-EXTREME): the prior bar's
   CCI sat beyond +/-100 and the last closed bar's is back inside -- below
   -100 then inside is a long, above +100 then inside a short. Stop is the
   prior 5-bar swing. */
function pineGoldCciReentry(rows, opts){
  opts = opts || {};
  var len = opts.len || 20, band = opts.band || 100, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < len + sw + 3) return { dir: null };
    var C = pgrCciSeries(rows, len);
    if (!C) return { dir: null };
    var i = n - 1, v = pgrNum(C[i]), p = pgrNum(C[i - 1]), c = pgrNum(rows[i].c);
    if (![v, p, c].every(isFinite)) return { dir: null };
    if (p <= -band && v > -band) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { cci: v, prev: p });
    if (p >= band && v < band) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { cci: v, prev: p });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}
/* Aroon 25: Aroon Up crosses above Aroon Down on the last closed bar for a
   long, the mirror for a short. Stop is the prior 5-bar swing. */
function pineGoldAroonCross(rows, opts){
  opts = opts || {};
  var len = opts.len || 25, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < len + sw + 3) return { dir: null };
    var A = pgrAroonSeries(rows, len);
    if (!A) return { dir: null };
    var i = n - 1;
    var u = pgrNum(A.up[i]), d = pgrNum(A.down[i]), uP = pgrNum(A.up[i - 1]), dP = pgrNum(A.down[i - 1]), c = pgrNum(rows[i].c);
    if (![u, d, uP, dP, c].every(isFinite)) return { dir: null };
    if (u > d && uP <= dP) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { up: u, down: d });
    if (u < d && uP >= dP) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { up: u, down: d });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}
/* hg-v1171: Williams %R 14 re-entry. The prior bar's %R sat below -80
   (oversold) and the last closed bar's is back above -80 for a long, or
   mirror -- above -20 then back inside for a short. The close must also
   agree with the re-entry direction, so a reclaim through -80 that ends in a
   lower close is not a long signal. Stop is the prior 5-bar swing. Williams
   %R and Stochastic are related but not duplicated (hg-v949): %R measures
   distance from the recent HIGH alone, Stoch measures position within the
   recent RANGE and uses %K/%D smoothing. */
function pineGoldWilliamsReentry(rows, opts){
  opts = opts || {};
  var len = opts.len || 14, osB = opts.os || -80, obB = opts.ob || -20, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < len + sw + 3) return { dir: null };
    var W = pgrWilliamsSeries(rows, len);
    if (!W) return { dir: null };
    var i = n - 1;
    var v = pgrNum(W[i]), p = pgrNum(W[i - 1]), c = pgrNum(rows[i].c), pc = pgrNum(rows[i - 1].c);
    if (![v, p, c, pc].every(isFinite)) return { dir: null };
    if (p <= osB && v > osB && c > pc) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { wr: v, prev: p });
    if (p >= obB && v < obB && c < pc) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { wr: v, prev: p });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}
/* hg-v1171: TRIX 15 zero-line cross. The prior bar's TRIX was below zero and
   the last closed bar's is above zero for a long; mirror for a short. Stop is
   the prior 5-bar swing. TRIX = 1-period rate of change of a triple-smoothed
   EMA, so a zero cross means the three-stage smoothed momentum has turned.
   Different from MACD (which crosses its SIGNAL line, not zero, and uses a
   two-stage subtraction) and so is not a duplicated port of the hg-v1166
   MACD layer (hg-v949). TRIX exactly equal to zero is unread, never guessed
   as either side. */
function pineGoldTrixCross(rows, opts){
  opts = opts || {};
  var len = opts.len || 15, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < 3 * len + sw + 3) return { dir: null };
    var T = pgrTrixSeries(rows, len);
    if (!T) return { dir: null };
    var i = n - 1;
    var v = pgrNum(T[i]), p = pgrNum(T[i - 1]), c = pgrNum(rows[i].c);
    if (![v, p, c].every(isFinite)) return { dir: null };
    if (p < 0 && v > 0) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { trix: v, prev: p });
    if (p > 0 && v < 0) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { trix: v, prev: p });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}
/* hg-v1171: Fisher Transform 10 zero-line cross (Ehlers). The transform
   maps hl2 into a Gaussian-shaped series; a zero cross says the mid-point
   has moved from the lower half of the window into the upper half (or
   mirror). Stop is the prior 5-bar swing. The clamp at +/-0.999 inside the
   series handles bars that closed exactly at the window extreme (ln is
   undefined at the singularities); it is the series' own rule, applied
   once. */
function pineGoldFisherZero(rows, opts){
  opts = opts || {};
  var len = opts.len || 10, sw = opts.swing || 5;
  try{
    var n = rows ? rows.length : 0;
    if (n < len + sw + 3) return { dir: null };
    var F = pgrFisherSeries(rows, len);
    if (!F) return { dir: null };
    var i = n - 1;
    var v = pgrNum(F[i]), p = pgrNum(F[i - 1]), c = pgrNum(rows[i].c);
    if (![v, p, c].every(isFinite)) return { dir: null };
    if (p < 0 && v > 0) return pgrResult('long', c, pgrLowest(rows, i - sw, i - 1, 'l'), { fisher: v, prev: p });
    if (p > 0 && v < 0) return pgrResult('short', c, pgrHighest(rows, i - sw, i - 1, 'h'), { fisher: v, prev: p });
    return { dir: null };
  }catch(e){ return { dir: null }; }
}

/* hg-v1166: every record layer that fired on the last closed bar of a
   series, as plain hits for a desk's OWN mint (GOLD SCALP / GOLD SWING
   consume these through their extras seam and price them through their own
   gates). `kind` is the stratKey those desks record under. */
function pineGoldRecordLayerHits(rows){
  var out = [];
  if (!rows || !rows.length) return out;
  for (var i = 0; i < PINE_GOLD_RECORD_LAYERS.length; i++){
    var layer = PINE_GOLD_RECORD_LAYERS[i];
    var res = pineGoldRunLayer(layer, rows);
    if (!res || !res.dir || !isFinite(pgrNum(res.entry)) || !isFinite(pgrNum(res.stop))) continue;
    out.push({ id: layer.id, kind: 'pine_' + layer.id, label: layer.label, dir: res.dir,
               entry: res.entry, stop: res.stop, twin: layer.twin || null,
               why: layer.label + ' fired on the last closed bar (Pine port, record-only until measured)',
               invalidates: 'the ' + layer.label + ' stop level' });
  }
  return out;
}

/* hg-v1166: THE ONE RECORD-ONLY JUDGE (hg-v949: one rule, one home).
   GOLD PINE carried this rule since hg-v1164 (gpRecordLayerJudge); GOLD
   SCALP and GOLD SWING mint the same layers now and read the same rule here
   rather than a second copy. Reads hgFwdStats(pool, mechanic) through
   hgFwdJudgeSample -- the one judge every measured-edge gate reads (hg-v982),
   fill-aware when that clears the floor on its own -- at HG_GOLD_FWD_MIN_JUDGE
   read at call time. At or over the floor AND paying releases the row; measured
   and not paying stays record-only and says so; under the floor says how far;
   with no ledger loaded nothing is measured and nothing is released. */
function pineGoldRecordFloor(){
  var f = +G.HG_GOLD_FWD_MIN_JUDGE;
  return (isFinite(f) && f > 0) ? f : 20;
}
function pineGoldRecordJudge(s, pool, mechanic){
  if (!s) return s;
  var floor = pineGoldRecordFloor();
  var j = { n: 0, expR: NaN, floor: floor, fillAware: false, measured: false, paying: false, unfilled: 0, pool: String(pool || ''), mechanic: String(mechanic || '') };
  s.recordJudge = j;
  try{
    var st = gfn('hgFwdStats'), js = gfn('hgFwdJudgeSample');
    if (!st || !js) return s;
    var stats = st(pool, mechanic, false);
    var k = js(stats, floor);
    if (!k || !fin(+k.n)){
      j.n = (stats && fin(+stats.samples)) ? +stats.samples : 0;
      return s;
    }
    j.n = +k.n; j.expR = fin(+k.expR) ? +k.expR : NaN; j.fillAware = !!k.fillAware;
    j.unfilled = fin(+k.unfilled) ? +k.unfilled : 0;
    j.measured = true;
    j.paying = isFinite(j.expR) && j.expR > 0;
    if (j.paying){
      s.recordOnly = false;
      s.recordReleased = true;
      s.demoted = false;
      s.demotedWhy = undefined;
    } else {
      s.demotedWhy = 'RECORD ONLY \u2014 ' + String(mechanic) + ' measured ' + j.n + ' settled at '
        + (isFinite(j.expR) ? ((j.expR >= 0 ? '+' : '\u2212') + Math.abs(j.expR).toFixed(3)) : '?') + 'R on this desk, not paying';
    }
  }catch(e){}
  return s;
}
/* the one chip and the one withheld-handoff note for a record-only row on a
   desk that mints it (GOLD SCALP / GOLD SWING); GOLD PINE keeps its own
   wording with the same judge behind it */
function pineGoldSgnR(v){ return (isFinite(v) ? ((v >= 0 ? '+' : '\u2212') + Math.abs(v).toFixed(3)) : '?') + 'R'; }
function pineGoldRecordChipHtml(s){
  if (!s) return '';
  var j = s.recordJudge || {};
  function e(x){ return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  if (s.recordReleased) return '<span class="gpip ok" data-hg-record-chip="released" title="released by the forward ledger: ' + j.n + ' settled at ' + pineGoldSgnR(j.expR) + (j.fillAware ? ' (fill-aware)' : '') + '">MEASURED \u00b7 ' + j.n + ' settled ' + pineGoldSgnR(j.expR) + '</span>';
  if (!s.recordOnly) return '';
  return '<span class="gpip" data-hg-record-chip="record-only" title="' + e(String(s.demotedWhy || 'record only')) + '">RECORD ONLY \u00b7 ' + (j.measured ? ('measured ' + j.n + ' at ' + pineGoldSgnR(j.expR)) : (j.n + ' of ' + (fin(+j.floor) ? j.floor : pineGoldRecordFloor()) + ' settled')) + '</span>';
}
function pineGoldRecordNoteHtml(s, pool){
  if (!s || !s.recordOnly) return '';
  var j = s.recordJudge || {};
  var floor = fin(+j.floor) ? +j.floor : pineGoldRecordFloor();
  function e(x){ return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  return '<div class="note warn" data-hg-record-note="1" style="margin-top:8px">NO TRADE HANDOFF \u2014 RECORD ONLY. ' + e(String(s.strategy || s.recordLayer || 'this Pine layer'))
    + ' is a Pine port with no measured record on this desk: '
    + (j.measured ? ('measured ' + j.n + ' settled at ' + pineGoldSgnR(j.expR) + ', not paying') : (j.n + ' of ' + floor + ' settled'))
    + '. Every signal bar is recorded under ' + e(String(pool || j.pool || 'this desk'))
    + '; the handoffs and the MOST PROBABLE pin open only when the ledger reads it paying at or over ' + floor
    + ' settled. The levels are shown to be read, not sent.</div>';
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
  var out = { ok: false, supertrend: null, ichimoku: null, donchian: null, emacross: null, keltner: null,
              /* hg-v1166 */ macd: null, psar: null, stoch: null,
              /* hg-v1167 */ chandelier: null, hullma: null, cci: null, aroon: null,
              /* hg-v1171 */ williams: null, trix: null, fisher: null,
              allLong: 0, allShort: 0,
              readable: 0, agreeLong: 0, agreeShort: 0 };
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
    /* hg-v1166: the MACD line against its signal, the close against the SAR,
       %K against %D -- each neither at equality */
    try{
      var mO = layerOpts('macd'), MS = pgrMacdSeries(rows, mO.fast || 12, mO.slow || 26, mO.signal || 9);
      if (MS){
        var mm = pgrNum(MS.macd[i]), mg = pgrNum(MS.sig[i]);
        if (isFinite(mm) && isFinite(mg)){ if (mm > mg) out.macd = 'long'; else if (mm < mg) out.macd = 'short'; }
      }
    }catch(eM){}
    try{
      var pO = layerOpts('psar'), PS = pgrPsarSeries(rows, pO.step || 0.02, pO.max || 0.2);
      if (PS){
        var ps = pgrNum(PS.sar[i]);
        if (isFinite(ps)){ if (c > ps) out.psar = 'long'; else if (c < ps) out.psar = 'short'; }
      }
    }catch(eP){}
    try{
      var sO = layerOpts('stoch'), SS = pgrStochSeries(rows, sO.kLen || 14, sO.kSmooth || 3, sO.dLen || 3);
      if (SS){
        var sk = pgrNum(SS.k[i]), sd = pgrNum(SS.d[i]);
        if (isFinite(sk) && isFinite(sd)){ if (sk > sd) out.stoch = 'long'; else if (sk < sd) out.stoch = 'short'; }
      }
    }catch(eS){}
    /* hg-v1167: the side of the Chandelier trail, the Hull slope, the CCI
       sign, Aroon Up against Aroon Down -- each neither at equality */
    try{
      var cO = layerOpts('chandelier'), CS = pgrChandelierSeries(rows, cO.len || 22, cO.mult || 3);
      if (CS){ if (CS.dir[i] === 1) out.chandelier = 'long'; else if (CS.dir[i] === -1) out.chandelier = 'short'; }
    }catch(eC){}
    try{
      var hO = layerOpts('hullma'), HS = pgrHullSeries(rows, hO.len || 20);
      if (HS){
        var hh0 = pgrNum(HS[i]), hh1 = pgrNum(HS[i - 1]);
        if (isFinite(hh0) && isFinite(hh1)){ if (hh0 > hh1) out.hullma = 'long'; else if (hh0 < hh1) out.hullma = 'short'; }
      }
    }catch(eH){}
    try{
      var ccO = layerOpts('cci'), CC = pgrCciSeries(rows, ccO.len || 20);
      if (CC){
        var cv = pgrNum(CC[i]);
        if (isFinite(cv)){ if (cv > 0) out.cci = 'long'; else if (cv < 0) out.cci = 'short'; }
      }
    }catch(eCc){}
    try{
      var aO = layerOpts('aroon'), AS = pgrAroonSeries(rows, aO.len || 25);
      if (AS){
        var au = pgrNum(AS.up[i]), ad = pgrNum(AS.down[i]);
        if (isFinite(au) && isFinite(ad)){ if (au > ad) out.aroon = 'long'; else if (au < ad) out.aroon = 'short'; }
      }
    }catch(eA){}
    /* hg-v1171: the Williams %R sign (above its mid at -50 is 'long', below
       is 'short', NEITHER at exactly -50); the TRIX sign (above zero is
       'long', below is 'short', NEITHER at exactly 0); the Fisher Transform
       sign (above zero is 'long', below is 'short', NEITHER at exactly 0).
       Each is the state read for the record stack, not the port's signal
       event -- the port fires on a last-closed-bar transition; the state is
       the series' current side, read every record. */
    try{
      var wO = layerOpts('williams'), WR = pgrWilliamsSeries(rows, wO.len || 14);
      if (WR){
        var wv = pgrNum(WR[i]);
        if (isFinite(wv)){ if (wv > -50) out.williams = 'long'; else if (wv < -50) out.williams = 'short'; }
      }
    }catch(eW){}
    try{
      var tO = layerOpts('trix'), TR = pgrTrixSeries(rows, tO.len || 15);
      if (TR){
        var tv = pgrNum(TR[i]);
        if (isFinite(tv)){ if (tv > 0) out.trix = 'long'; else if (tv < 0) out.trix = 'short'; }
      }
    }catch(eT){}
    try{
      var fO = layerOpts('fisher'), FS = pgrFisherSeries(rows, fO.len || 10);
      if (FS){
        var fv = pgrNum(FS[i]);
        if (isFinite(fv)){ if (fv > 0) out.fisher = 'long'; else if (fv < 0) out.fisher = 'short'; }
      }
    }catch(eF){}
    PINE_GOLD_RECORD_LAYERS.forEach(function(l){
      var v = out[l.id];
      var core = PINE_GOLD_MAJORITY_IDS.indexOf(l.id) >= 0;
      if (v === 'long'){ out.readable++; out.allLong++; if (core) out.agreeLong++; }
      else if (v === 'short'){ out.readable++; out.allShort++; if (core) out.agreeShort++; }
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
    cells += '<span class="gsx-ind ' + (mj === true ? 'ok' : (mj === false ? 'no' : 'na')) + '" title="pine:majorityWith — at least three of the five hg-v1164 layers (the hg-v1166 and hg-v1167 layers mark their own states and do not move this majority)"><b>MAJORITY</b> ' + mjTag + ' ' + states.agreeLong + 'L/' + states.agreeShort + 'S</span>';
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
/* hg-v1166 */
G.pineGoldMacdCross = pineGoldMacdCross;
G.pineGoldPsarFlip = pineGoldPsarFlip;
G.pineGoldStochCross = pineGoldStochCross;
G.pineGoldRecordLayerHits = pineGoldRecordLayerHits;
/* hg-v1167 */
G.pineGoldChandelierExit = pineGoldChandelierExit;
G.pineGoldHullTurn = pineGoldHullTurn;
G.pineGoldCciReentry = pineGoldCciReentry;
G.pineGoldAroonCross = pineGoldAroonCross;
G.pineGoldChandelierSeries = pgrChandelierSeries;   /* the trails, for a guard that pins the stop to its own trail */
/* hg-v1171: the three new ports (dispatched by name through pineGoldRunLayer)
   and their series helpers (exported so a guard can pin behaviour inside them
   rather than only through the port facade). */
G.pineGoldWilliamsReentry = pineGoldWilliamsReentry;
G.pineGoldTrixCross = pineGoldTrixCross;
G.pineGoldFisherZero = pineGoldFisherZero;
G.pineGoldWilliamsSeries = pgrWilliamsSeries;
G.pineGoldTrixSeries = pgrTrixSeries;
G.pineGoldFisherSeries = pgrFisherSeries;
G.pineGoldRecordJudge = pineGoldRecordJudge;
G.pineGoldRecordFloor = pineGoldRecordFloor;
G.pineGoldRecordChipHtml = pineGoldRecordChipHtml;
G.pineGoldRecordNoteHtml = pineGoldRecordNoteHtml;
G.PINE_GOLD_MAJORITY_IDS = PINE_GOLD_MAJORITY_IDS;
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
    pineGoldLayerStates, pineGoldPineMarks, pineGoldStackLineHtml, PINE_GOLD_MAJORITY,
    pineGoldMacdCross, pineGoldPsarFlip, pineGoldStochCross, pineGoldRecordLayerHits,
    pineGoldRecordJudge, pineGoldRecordFloor, pineGoldRecordChipHtml, pineGoldRecordNoteHtml, PINE_GOLD_MAJORITY_IDS,
    pineGoldChandelierExit, pineGoldHullTurn, pineGoldCciReentry, pineGoldAroonCross, pineGoldChandelierSeries: pgrChandelierSeries,
    /* hg-v1171 */
    pineGoldWilliamsReentry, pineGoldTrixCross, pineGoldFisherZero,
    pineGoldWilliamsSeries: pgrWilliamsSeries, pineGoldTrixSeries: pgrTrixSeries, pineGoldFisherSeries: pgrFisherSeries
  };
}

})();
