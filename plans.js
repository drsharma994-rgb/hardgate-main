/* HARDGATE — shared setup/plan primitives (all tabs).
   Loaded after indicators.js + cryptogates.js. Pure exports, never throw. */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var HG_STOP_BUFFER_ATR = 0.25;
var HG_STOP_CAP_DIST_ATR = 2.5;
var HG_STOP_FALLBACK_ATR = 1.5;
var HG_SWEEP_STOP_ATR = 0.5;
var HG_SWEEP_RECLAIM_MAX = 3;
var HG_T1_R = 2;
var HG_T2_R = 3.5;
var HG_SCALP_T1_R = 1.5;
var HG_SCALP_T2_R = 2.5;
var HG_MIN_RR_SWING = 1.5;
var HG_MIN_RR_DEFAULT = 2.0;
var HG_SPREAD_MIN_ATR = 0.25;

function _last(arr){
  if (typeof last === 'function') return last(arr);
  return (arr && arr.length) ? arr[arr.length - 1] : NaN;
}

/* --- confirmed trend cascade (single definition for badges) --- */
function hgConfirmedCascade(rows, style){
  var out = { confirmed: false, dir: null, label: 'n/a', style: style || 'smart' };
  try{
    if (!rows || rows.length < 55 || typeof ema !== 'function') return out;
    var closes = rows.map(function(r){ return r.c; });
    var n = closes.length - 1;
    style = String(style || 'smart').toLowerCase();
    if (style === 'swing' || style === 'cryptogates'){
      var e9a = ema(closes, 9), e21a = ema(closes, 21), e50a = ema(closes, 50);
      var e9 = e9a[n], e21 = e21a[n], e50 = e50a[n];
      if (!(isFinite(e9) && isFinite(e21) && isFinite(e50))) return out;
      var dir = null;
      if (e9 > e21 && e21 > e50) dir = 'long';
      else if (e9 < e21 && e21 < e50) dir = 'short';
      var spreadOk = true;
      if (typeof atr === 'function'){
        var a = _last(atr(rows, 14));
        spreadOk = isFinite(a) && a > 0 && Math.abs(e21 - e50) >= HG_SPREAD_MIN_ATR * a;
      }
      out.dir = (dir && spreadOk) ? dir : null;
      out.confirmed = !!out.dir;
      out.label = out.confirmed ? ('SWING cascade ' + dir.toUpperCase()) : 'cascade mixed or spread thin';
      return out;
    }
    /* smart / default: EMA20/50 */
    var e20 = _last(ema(closes, 20)), e50b = _last(ema(closes, 50));
    if (!(isFinite(e20) && isFinite(e50b))) return out;
    if (e20 > e50b){ out.dir = 'long'; out.confirmed = true; out.label = 'EMA20>EMA50 long'; }
    else if (e20 < e50b){ out.dir = 'short'; out.confirmed = true; out.label = 'EMA20<EMA50 short'; }
    return out;
  }catch(e){ return out; }
}

/* --- regime filter by setup style --- */
function hgRegimeAllowsSetup(rows, style){
  try{
    if (typeof detectRegime !== 'function' || !rows || !rows.length) return { allow: true, reason: null };
    var dr = detectRegime(rows);
    if (!dr || !dr.regime) return { allow: true, reason: null };
    style = String(style || 'swing').toLowerCase();
    if (dr.regime === 'volatile' && (style === 'swing' || style === 'edge' || style === 'scalp')){
      return { allow: false, reason: dr.label + ' — volatile tape, skip trend continuation' };
    }
    if (dr.regime === 'compression' && (style === 'swing' || style === 'edge' || style === 'best')){
      return { allow: false, reason: dr.label + ' — compression chop, wait for expansion' };
    }
    if (dr.regime === 'compression' && (style === 'meanrev' || style === 'squeeze')){
      return { allow: true, reason: dr.label + ' — compression friendly for ' + style };
    }
    return { allow: true, reason: dr.label || null };
  }catch(e){ return { allow: true, reason: null }; }
}

/* --- structure stop (shared by smartSetup fallbacks, squeeze, oiflow, trendtable) --- */
function hgStructureStop(dir, entry, rows, opts){
  opts = opts || {};
  try{
    dir = String(dir || '').toLowerCase();
    entry = +entry;
    if (!(dir === 'long' || dir === 'short') || !(isFinite(entry) && entry > 0)) return null;
    if (!rows || !rows.length || typeof atr !== 'function') return null;
    var atrLen = opts.atrLen || 14;
    var look = opts.look || 30;
    var buffer = (opts.buffer !== undefined) ? opts.buffer : HG_STOP_BUFFER_ATR;
    var capDist = (opts.capDist !== undefined) ? opts.capDist : HG_STOP_CAP_DIST_ATR;
    var fallback = (opts.fallback !== undefined) ? opts.fallback : HG_STOP_FALLBACK_ATR;
    var aArr = atr(rows, atrLen);
    var a = _last(aArr);
    if (!isFinite(a) || a <= 0) return null;
    var sw = (typeof lastSwing === 'function') ? lastSwing(rows, dir, look) : NaN;
    var stop = NaN, note = '';
    if (isFinite(sw)){
      stop = (dir === 'long') ? sw - buffer * a : sw + buffer * a;
      var risk = Math.abs(entry - stop);
      if (risk > 0 && risk <= capDist * a){
        note = 'stop: lastSwing(' + look + ') buffered ' + buffer + '×ATR' + atrLen;
      } else if (risk > capDist * a){
        stop = (dir === 'long') ? entry - fallback * a : entry + fallback * a;
        note = 'stop capped: structure beyond ' + capDist + '×ATR — ' + fallback + '×ATR' + atrLen;
      }
    }
    if (!isFinite(stop) || (dir === 'long' ? stop >= entry : stop <= entry)){
      stop = (dir === 'long') ? entry - fallback * a : entry + fallback * a;
      note = 'stop: ' + fallback + '×ATR' + atrLen + ' (lastSwing unavailable)';
    }
    var riskF = Math.abs(entry - stop);
    if (!(riskF > 0)) return null;
    return { stop: stop, risk: riskF, atr: a, note: note };
  }catch(e){ return null; }
}

/* --- R-multiple plan from entry/stop --- */
function hgPlanFromRisk(dir, entry, stop, opts){
  opts = opts || {};
  try{
    entry = +entry; stop = +stop;
    if (!(dir === 'long' || dir === 'short')) return null;
    if (!(isFinite(entry) && isFinite(stop))) return null;
    var risk = (dir === 'long') ? (entry - stop) : (stop - entry);
    if (!(risk > 0)) return null;
    var t1R = opts.t1R !== undefined ? opts.t1R : HG_T1_R;
    var t2R = opts.t2R !== undefined ? opts.t2R : HG_T2_R;
    var minRr = opts.minRr !== undefined ? opts.minRr : HG_MIN_RR_DEFAULT;
    var t1 = opts.t1Hint;
    var rew1 = (dir === 'long') ? (t1 - entry) : (entry - t1);
    if (!(isFinite(t1) && rew1 > 0)){
      t1 = (dir === 'long') ? entry + t1R * risk : entry - t1R * risk;
      rew1 = t1R * risk;
    }
    var rr1 = rew1 / risk;
    if (rr1 < minRr){
      t1 = (dir === 'long') ? entry + minRr * risk : entry - minRr * risk;
      rr1 = minRr;
    }
    var t2 = opts.t2Hint;
    var rew2 = (isFinite(t2)) ? ((dir === 'long') ? (t2 - entry) : (entry - t2)) : NaN;
    if (!(isFinite(t2) && rew2 > 0)){
      t2 = (dir === 'long') ? entry + t2R * risk : entry - t2R * risk;
      rew2 = t2R * risk;
    }
    return {
      dir: dir, entry: entry, stop: stop, t1: t1, t2: t2,
      risk: risk, riskPct: risk / entry * 100,
      rr1: rr1, rr2: rew2 / risk,
      targetPolicy: opts.targetPolicy || 'R-multiples',
      t1R: t1R, t2R: t2R
    };
  }catch(e){ return null; }
}

/* --- universal hgPlanLevels replacement core --- */
function hgPlanLevelsCore(dir, rows, entryOverride, opts){
  opts = opts || {};
  try{
    if (!(dir === 'long' || dir === 'short') || !rows || !rows.length) return null;
    var entry = (isFinite(entryOverride) && entryOverride > 0) ? +entryOverride : +rows[rows.length - 1].c;
    if (!isFinite(entry) || entry <= 0) return null;
    var st = hgStructureStop(dir, entry, rows, opts);
    if (!st) return null;
    var plan = hgPlanFromRisk(dir, entry, st.stop, {
      t1R: opts.t1R, t2R: opts.t2R, minRr: opts.minRr || HG_MIN_RR_DEFAULT,
      targetPolicy: 'R-multiples (2R/3.5R)'
    });
    if (!plan) return null;
    plan.note = st.note;
    plan.planSrc = 'hgPlanLevels';
    return plan;
  }catch(e){ return null; }
}

/* --- liquidity sweep: wick through level + reclaim within N bars --- */
function hgDetectLiquiditySweep(bars, i, dir, priorLevel, opts){
  opts = opts || {};
  try{
    if (!bars || !isFinite(priorLevel) || !isFinite(i)) return null;
    var maxBack = Math.min(opts.maxBars !== undefined ? opts.maxBars : HG_SWEEP_RECLAIM_MAX, i);
    var lows = bars.lows || bars.map(function(r){ return r.l; });
    var highs = bars.highs || bars.map(function(r){ return r.h; });
    var closes = bars.closes || bars.map(function(r){ return r.c; });
    var sweepBar = -1, sweepExtreme = NaN, reclaimBar = -1;
    for (var b = 0; b <= maxBack; b++){
      var j = i - b;
      if (dir === 'long'){
        if (!(isFinite(lows[j]) && lows[j] < priorLevel)) continue;
        sweepBar = j; sweepExtreme = lows[j];
        if (isFinite(closes[j]) && closes[j] > priorLevel){ reclaimBar = j; break; }
        for (var r = j + 1; r <= i && r - j <= HG_SWEEP_RECLAIM_MAX; r++){
          if (isFinite(closes[r]) && closes[r] > priorLevel){ reclaimBar = r; break; }
        }
        if (reclaimBar >= 0) break;
      } else {
        if (!(isFinite(highs[j]) && highs[j] > priorLevel)) continue;
        sweepBar = j; sweepExtreme = highs[j];
        if (isFinite(closes[j]) && closes[j] < priorLevel){ reclaimBar = j; break; }
        for (var r2 = j + 1; r2 <= i && r2 - j <= HG_SWEEP_RECLAIM_MAX; r2++){
          if (isFinite(closes[r2]) && closes[r2] < priorLevel){ reclaimBar = r2; break; }
        }
        if (reclaimBar >= 0) break;
      }
    }
    if (sweepBar < 0 || reclaimBar < 0) return null;
    return { swept: true, sweepBar: sweepBar, reclaimBar: reclaimBar,
             priorLevel: priorLevel, sweepExtreme: sweepExtreme };
  }catch(e){ return null; }
}

function hgSweepStop(dir, sweepExtreme, atrVal, opts){
  opts = opts || {};
  try{
    var mult = (opts.atrMult !== undefined) ? opts.atrMult : HG_SWEEP_STOP_ATR;
    if (!isFinite(sweepExtreme) || !isFinite(atrVal)) return NaN;
    return (dir === 'long') ? sweepExtreme - mult * atrVal : sweepExtreme + mult * atrVal;
  }catch(e){ return NaN; }
}

/* --- OTE zone 62–79%, 70.5% entry --- */
function hgOteZone(impulseLo, impulseHi, dir){
  try{
    impulseLo = +impulseLo; impulseHi = +impulseHi;
    var span = impulseHi - impulseLo;
    if (!(span > 0)) return null;
    var OTE_LO = 0.62, OTE_HI = 0.79, OTE_MID = 0.705;
    if (dir === 'long'){
      return {
        lo: impulseHi - OTE_HI * span, hi: impulseHi - OTE_LO * span,
        mid: impulseHi - OTE_MID * span, entry: impulseHi - OTE_MID * span
      };
    }
    return {
      lo: impulseLo + OTE_LO * span, hi: impulseLo + OTE_HI * span,
      mid: impulseLo + OTE_MID * span, entry: impulseLo + OTE_MID * span
    };
  }catch(e){ return null; }
}

/* --- entry refinement: LIMIT vs MARKET from zone --- */
function hgRefineEntry(mark, entry, zone, dir){
  try{
    mark = +mark; entry = +entry;
    if (!isFinite(mark) || !isFinite(entry)) return { entryType: 'MARKET', inZone: false, guidance: '' };
    var zLo = zone && isFinite(zone.lo) ? zone.lo : entry;
    var zHi = zone && isFinite(zone.hi) ? zone.hi : entry;
    var inZone = mark >= zLo && mark <= zHi;
    if (inZone) return { entryType: 'MARKET', inZone: true, guidance: 'price in entry zone — market fill valid' };
    if (dir === 'long'){
      return mark < entry
        ? { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — mark below entry, order working' }
        : { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — wait for pullback to structure' };
    }
    return mark > entry
      ? { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — mark above entry, order working' }
      : { entryType: 'LIMIT', inZone: false, guidance: 'LIMIT — wait for rally into resistance' };
  }catch(e){ return { entryType: 'LIMIT', inZone: false, guidance: '' }; }
}

/* --- plan footer label for cards --- */
function hgPlanMetaLabel(plan){
  try{
    if (!plan) return '';
    var parts = [];
    if (plan.planSrc) parts.push(plan.planSrc);
    if (plan.targetPolicy) parts.push(plan.targetPolicy);
    if (plan.swingGates) parts.push('SWING ' + plan.swingGates);
    if (plan.swingClean === true) parts.push('SWING CLEAN');
    else if (plan.swingClean === false && plan.swingGates) parts.push('not SWING CLEAN');
    if (plan.entryType) parts.push(plan.entryType);
    return parts.join(' · ');
  }catch(e){ return ''; }
}

/* --- swing parity from cryptogates (EXECUTE / cards) --- */
function hgSwingParity(rows, ticker, dir){
  try{
    if (typeof swingGateMatrix !== 'function' || !rows || !dir) return null;
    var m = swingGateMatrix(rows, ticker || null);
    if (!m || !m.dir || m.dir !== dir) return { aligned: false, passed: 0, gatesTotal: 7, clean: false, g6: false, g7: false };
    return {
      aligned: true, passed: m.passed, gatesTotal: m.gatesTotal, clean: m.clean === true,
      g6: m.gates[5] ? m.gates[5][1] : false,
      g7: m.gates[6] ? m.gates[6][1] : false,
      dynamicRR: isFinite(m.dynamicRR) ? m.dynamicRR : null,
      label: m.passed + '/' + m.gatesTotal + (m.clean ? ' CLEAN' : '')
    };
  }catch(e){ return null; }
}

/* --- gold swing target ladder (unified naming) --- */
var HG_GOLD_T1_R = 1.5;
var HG_GOLD_T2_R = 2.5;
var HG_GOLD_T3_R = 4.0;

G.hgConfirmedCascade = hgConfirmedCascade;
G.hgRegimeAllowsSetup = hgRegimeAllowsSetup;
G.hgStructureStop = hgStructureStop;
G.hgPlanFromRisk = hgPlanFromRisk;
G.hgPlanLevelsCore = hgPlanLevelsCore;
G.hgDetectLiquiditySweep = hgDetectLiquiditySweep;
G.hgSweepStop = hgSweepStop;
G.hgOteZone = hgOteZone;
G.hgRefineEntry = hgRefineEntry;
G.hgPlanMetaLabel = hgPlanMetaLabel;
G.hgSwingParity = hgSwingParity;
G.HG_GOLD_T1_R = HG_GOLD_T1_R;
G.HG_GOLD_T2_R = HG_GOLD_T2_R;
G.HG_GOLD_T3_R = HG_GOLD_T3_R;
G.HG_T1_R = HG_T1_R;
G.HG_T2_R = HG_T2_R;
G.HG_SWEEP_RECLAIM_MAX = HG_SWEEP_RECLAIM_MAX;

})();
