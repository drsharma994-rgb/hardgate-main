/* HARDGATE — unified ticket formation: POI entry → structure stop → structure TP.
   Loaded after plans.js + scorecard.js. Pure exports on window, never throw. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var LS_FORMATION = 'hgFormationParams_v1';
var HG_FILL_MIN = 0.20;
var HG_ANCHOR_MAX_ATR = 1.25;

function hgAnchorMaxAtr(){
  try{
    if (typeof G.hgSwingAnchorMax === 'function') return G.hgSwingAnchorMax();
    if (typeof G.CG_SWING_ANCHOR_ATR === 'number') return G.CG_SWING_ANCHOR_ATR;
  }catch(e){}
  return HG_ANCHOR_MAX_ATR;
}

function _last(arr){
  if (typeof last === 'function') return last(arr);
  return (arr && arr.length) ? arr[arr.length - 1] : NaN;
}

/* --- calibrated params: ledger stop sweep + optional CALIBRATE lookback --- */
function hgFormationParams(){
  var p = {
    swingLook: 20,
    stopScale: 1,
    buffer: 0.25,
    capDist: 2.5,
    fillBarsSwing: 12,
    fillBarsScalp: 24,
    source: 'defaults'
  };
  try{
    if (typeof G.CG_SWING_LOOK === 'number' && G.CG_SWING_LOOK > 5) p.swingLook = G.CG_SWING_LOOK;
    if (typeof G.hgLiveStopScale === 'function'){
      var sc = G.hgLiveStopScale();
      if (isFinite(sc) && sc > 0) p.stopScale = sc;
    }
    if (typeof G.hgHeatProfile === 'function' && typeof G.hgScoreRecords === 'function'){
      var recs = (typeof G.hgScoreRecords === 'function' ? G.hgScoreRecords() : []) || [];
      var sorted = recs.slice().sort(function(a, b){ return (+a.closedAt || 0) - (+b.closedAt || 0); });
      var cut = Math.floor(sorted.length * 0.7);
      var trainRecs = sorted.slice(0, cut);
      var heat = G.hgHeatProfile(trainRecs);
      var wf = (typeof G.hgWalkForward === 'function') ? G.hgWalkForward(sorted) : null;
      if (heat && heat.winners && isFinite(heat.winners.p90) && (!wf || wf.verdict === 'HOLDS')){
        p.buffer = Math.max(0.15, Math.min(0.45, (1 - heat.winners.p90) + 0.05));
        p.source = 'walkforward+ledger';
      } else if (wf && wf.verdict !== 'HOLDS'){
        p.source = 'defaults (walk-forward ' + wf.verdict + ')';
      }
      if (heat && heat.winners && isFinite(heat.winners.p90) && heat.winners.p90 < 0.5){
        p.stopHint = 'winners p90 MAE ' + heat.winners.p90.toFixed(2) + 'R — stops likely too wide';
      }
    }
    if (typeof localStorage !== 'undefined'){
      try{
        var stored = JSON.parse(localStorage.getItem(LS_FORMATION) || 'null');
        if (stored && typeof stored === 'object'){
          if (stored.swingLook > 5) p.swingLook = stored.swingLook;
          if (stored.buffer > 0) p.buffer = stored.buffer;
          p.source = 'calibrate+ledger';
        }
      }catch(eSt){}
    }
  }catch(e){}
  p.minRr = p.minRr != null ? Math.max(1.5, Math.min(3, +p.minRr)) : 2.0;
  p.fqsFloor = p.fqsFloor != null ? Math.max(50, Math.min(80, +p.fqsFloor)) : 62;
  return p;
}

function hgSaveFormationParams(patch){
  try{
    var cur = hgFormationParams();
    var next = Object.assign({}, cur, patch || {}, { savedAt: Date.now() });
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_FORMATION, JSON.stringify(next));
    return next;
  }catch(e){ return null; }
}

/* --- historical limit fill rate on this TF --- */
function hgFillProbability(rows, entry, dir, zone, maxBars){
  var out = { prob: null, pct: null, note: 'fill history n/a' };
  try{
    maxBars = maxBars || 12;
    if (!rows || rows.length < maxBars + 10 || !isFinite(+entry)) return out;
    var lo = (zone && isFinite(zone.lo)) ? +zone.lo : +entry;
    var hi = (zone && isFinite(zone.hi)) ? +zone.hi : +entry;
    if (lo > hi){ var t = lo; lo = hi; hi = t; }
    var touches = 0, trials = 0;
    for (var i = 10; i < rows.length - maxBars - 1; i++){
      var touched = false;
      for (var j = i; j < i + maxBars && j < rows.length; j++){
        var bar = rows[j];
        if (!bar) continue;
        if (+bar.l <= hi && +bar.h >= lo){ touched = true; break; }
      }
      trials++;
      if (touched) touches++;
    }
    if (!trials) return out;
    out.prob = touches / trials;
    out.pct = Math.round(out.prob * 100);
    out.note = out.pct + '% of past ' + maxBars + '-bar windows touched this zone (n=' + trials + ')';
    return out;
  }catch(e){ return out; }
}

/* --- rank entry POIs (sweep > FVG/EDGE > OTE > aVWAP > EMA) --- */
function hgAnchorIndex(rows, mode){
  try{
    if (!rows || !rows.length) return -1;
    var n = rows.length - 1;
    if (mode === 'swingHigh' || mode === 'swingLow'){
      var seg = Math.min(60, rows.length);
      var best = -1, bv = (mode === 'swingHigh') ? -Infinity : Infinity;
      for (var i = rows.length - seg; i <= n; i++){
        if (i < 0 || !rows[i]) continue;
        var v = (mode === 'swingHigh') ? +rows[i].h : +rows[i].l;
        if (!isFinite(v)) continue;
        if ((mode === 'swingHigh' && v > bv) || (mode === 'swingLow' && v < bv)){ bv = v; best = i; }
      }
      return best;
    }
    var lastT = +(rows[n].t || rows[n].time || 0);
    if (!isFinite(lastT) || lastT <= 0) return Math.max(0, rows.length - 24);
    var ms = lastT < 1e12 ? lastT * 1000 : lastT;
    var dayStart = Math.floor(ms / 86400000) * 86400000;
    if (mode === 'london') dayStart += 7 * 3600000;
    for (var j = n; j >= 0; j--){
      var tj = +(rows[j].t || rows[j].time || 0);
      var mj = tj < 1e12 ? tj * 1000 : tj;
      if (mj < dayStart) return Math.min(n, j + 1);
    }
    return 0;
  }catch(e){ return -1; }
}

function hgAnchoredVWAP(rows, anchorIdx){
  try{
    if (!rows || anchorIdx < 0 || anchorIdx >= rows.length) return null;
    var pv = 0, vol = 0, sq = 0, cnt = 0;
    for (var i = anchorIdx; i < rows.length; i++){
      var r = rows[i];
      if (!r) continue;
      var tp = (+r.h + +r.l + +r.c) / 3;
      var v = isFinite(+r.v) && +r.v > 0 ? +r.v : 1;
      if (!isFinite(tp)) continue;
      pv += tp * v; vol += v; sq += tp * tp * v; cnt++;
    }
    if (!(vol > 0) || cnt < 3) return null;
    var vwap = pv / vol;
    var varr = Math.max(0, sq / vol - vwap * vwap);
    var sd = Math.sqrt(varr);
    return { vwap: vwap, sd: sd, bars: cnt, anchorIdx: anchorIdx,
             lower1: vwap - sd, upper1: vwap + sd };
  }catch(e){ return null; }
}

function hgRankEntryPOI(rows, dir, style, mark, atrVal, params){
  params = params || hgFormationParams();
  try{
    dir = String(dir || '').toLowerCase();
    style = String(style || 'swing').toLowerCase();
    if (!rows || !rows.length || !isFinite(mark) || !(atrVal > 0)) return null;
    var cands = [];
    var n = rows.length - 1;
    var tol = 0.4 * atrVal;
    var anchorMax = hgAnchorMaxAtr() * atrVal;

    if (typeof G.hgDetectOrderBlock === 'function'){
      var ob = G.hgDetectOrderBlock(rows, dir);
      if (ob && fin(+ob.entry)){
        cands.push({
          score: style === 'scalp' ? 92 : 90,
          entry: ob.entry, label: ob.label || 'order block', poi: 'ob',
          zone: ob.zone || { lo: ob.entry - tol * 0.5, hi: ob.entry + tol * 0.25 },
        });
      }
    }
    if (typeof G.hgDetectFvg === 'function'){
      var fvgD = G.hgDetectFvg(rows, dir);
      if (fvgD && fin(+fvgD.entry)){
        cands.push({
          score: style === 'scalp' ? 91 : 87,
          entry: fvgD.entry, label: fvgD.label || 'FVG', poi: 'fvg',
          zone: fvgD.zone || { lo: fvgD.entry - tol * 0.5, hi: fvgD.entry + tol * 0.25 },
        });
      }
    }

    /* sweep + reclaim (scalp priority) */
    if (typeof G.hgDetectLiquiditySweep === 'function'){
      var prior = dir === 'long' ? Math.min.apply(null, rows.slice(Math.max(0, n - 30), n).map(function(r){ return r.l; }))
        : Math.max.apply(null, rows.slice(Math.max(0, n - 30), n).map(function(r){ return r.h; }));
      if (isFinite(prior)){
        var sw = G.hgDetectLiquiditySweep(rows, n, dir, prior, {});
        if (sw && sw.swept){
          var ent = sw.priorLevel;
          cands.push({
            score: style === 'scalp' ? 95 : 88,
            entry: ent, label: 'sweep reclaim', poi: 'sweep',
            sweepExtreme: sw.sweepExtreme,
            zone: dir === 'long' ? { lo: ent - tol * 0.25, hi: ent + tol * 0.5 } : { lo: ent - tol * 0.5, hi: ent + tol * 0.25 }
          });
        }
      }
    }

    /* EDGE / FVG signal */
    if (typeof edgeSignal === 'function' && style !== 'scalp' && style !== 'fade'){
      try{
        var sig = edgeSignal(rows);
        if (sig && sig.dir === dir && isFinite(sig.entry)){
          cands.push({
            score: 86, entry: sig.entry, label: sig.edge || 'FVG', poi: 'fvg',
            zone: sig.zone || { lo: sig.entry - tol * 0.5, hi: sig.entry + tol * 0.25 }
          });
        }
      }catch(eEd){}
    }

    /* OTE on recent impulse */
    if (typeof G.hgOteZone === 'function' && typeof ema === 'function'){
      var seg = rows.slice(Math.max(0, n - 40));
      var loI = Math.min.apply(null, seg.map(function(r){ return r.l; }));
      var hiI = Math.max.apply(null, seg.map(function(r){ return r.h; }));
      var ote = G.hgOteZone(loI, hiI, dir);
      if (ote && isFinite(ote.entry)){
        cands.push({
          score: 82, entry: ote.entry, label: 'OTE 70.5%', poi: 'ote',
          zone: { lo: ote.lo, hi: ote.hi }
        });
      }
    }

    /* anchored VWAP: session anchor for scalp, swing-extreme anchor for swing */
    try{
      var avMode = (style === 'scalp' || style === 'fade')
        ? 'session'
        : (dir === 'long' ? 'swingLow' : 'swingHigh');
      var avIdx = hgAnchorIndex(rows, avMode);
      var av = hgAnchoredVWAP(rows, avIdx);
      if (av && isFinite(av.vwap)){
        var avEntry = (dir === 'long')
          ? ((mark > av.vwap) ? av.vwap : av.lower1)
          : ((mark < av.vwap) ? av.vwap : av.upper1);
        if (isFinite(avEntry)){
          cands.push({
            score: (style === 'scalp') ? 84 : 80,
            entry: avEntry,
            label: 'aVWAP ' + avMode + ' (' + av.bars + 'b)',
            poi: 'avwap',
            zone: { lo: avEntry - tol * 0.4, hi: avEntry + tol * 0.4 }
          });
        }
      }
    }catch(eAv){}

    /* EMA21 / EMA9 fallback */
    if (typeof ema === 'function'){
      var c = rows.map(function(r){ return r.c; });
      var e21 = _last(ema(c, 21));
      var e9 = _last(ema(c, 9));
      if (isFinite(e21)){
        cands.push({
          score: 70, entry: e21, label: 'EMA21', poi: 'ema21',
          zone: { lo: e21 - tol * 0.5, hi: e21 + tol * 0.25 }
        });
      }
      if (isFinite(e9)){
        cands.push({
          score: 65,
          entry: dir === 'long' ? Math.min(mark, e9) : Math.max(mark, e9),
          label: 'EMA9', poi: 'ema9',
          zone: { lo: e9 - tol * 0.5, hi: e9 + tol * 0.25 }
        });
      }
    }

    cands.sort(function(a, b){ return b.score - a.score; });
    for (var i = 0; i < cands.length; i++){
      var cd = cands[i];
      if (Math.abs(mark - cd.entry) <= anchorMax) return cd;
    }
    return cands.length ? cands[0] : null;
  }catch(e){ return null; }
}

/* --- structure-first targets with R floor --- */
function hgStructureTargets(dir, entry, stop, rows, atrVal, opts){
  opts = opts || {};
  try{
    dir = String(dir || '').toLowerCase();
    entry = +entry; stop = +stop; atrVal = +atrVal;
    if (!(isFinite(entry) && isFinite(stop) && atrVal > 0)) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var minRr = opts.minRr !== undefined ? opts.minRr : 2;
    var t1Hint = null, t1Source = 'R floor', t2Hint = null, t2Source = 'ATR excursion';

    if (typeof findLiquidityPools === 'function'){
      var lp = findLiquidityPools(rows);
      var tgt = dir === 'long' ? lp.buySide : lp.sellSide;
      if (tgt && isFinite(tgt.level)){
        var rew = dir === 'long' ? (tgt.level - entry) : (entry - tgt.level);
        if (rew / risk >= minRr){ t1Hint = tgt.level; t1Source = 'liquidity pool'; }
      }
    }
    if (typeof volumeProfile === 'function'){
      var vp = volumeProfile(rows, 80, 24);
      if (vp){
        var edge = dir === 'long' ? vp.vah : vp.val;
        if (isFinite(edge)){
          var rew2 = dir === 'long' ? (edge - entry) : (entry - edge);
          if (rew2 / risk >= minRr){
            t1Hint = edge;
            t1Source = 'volume profile edge';
          }
        }
      }
    }

    var tgFn = (typeof G.hgPlanSwingTargets === 'function') ? G.hgPlanSwingTargets : null;
    var base = tgFn ? tgFn(dir, entry, stop, atrVal, opts.targetOpts || {}) : null;
    if (!base) return null;

    var t1 = base.t1, t2 = base.t2;
    if (t1Hint != null){
      var rr1h = Math.abs(t1Hint - entry) / risk;
      if (rr1h >= minRr){
        t1 = t1Hint;
        if (typeof G.hgPlanFromRisk === 'function'){
          var pr = G.hgPlanFromRisk(dir, entry, stop, { t1Hint: t1, minRr: minRr, targetPolicy: 'structure T1 + R floor' });
          if (pr){ t1 = pr.t1; t2 = pr.t2; }
        }
      }
    }

    var rr1 = Math.abs(t1 - entry) / risk;
    return {
      t1: t1, t2: t2, rr1: rr1, rr2: Math.abs(t2 - entry) / risk,
      t1Source: t1Source, t2Source: t2Source,
      targetPolicy: 'structure T1 (' + t1Source + ') · T2 (' + t2Source + ')',
      partialPolicy: '50% @ T1 · 30% @ T2 · runner trail 1×ATR'
    };
  }catch(e){ return null; }
}

function hgFormationScore(plan, ctx){
  try{
    var s = 0;
    if (!plan) return 0;
    if (plan.poi === 'sweep') s += 18;
    else if (plan.poi === 'fvg') s += 15;
    else if (plan.poi === 'ote') s += 12;
    else if (plan.poi === 'avwap') s += 14;
    else if (plan.poi === 'ema21') s += 8;
    if (plan.flowOk) s += 10;
    if (isFinite(+plan.liveScoreDelta)) s += Math.min(18, Math.max(-18, +plan.liveScoreDelta));
    if (plan.crossOk) s += 5;
    if (plan.rsEdge != null && isFinite(plan.rsEdge)) s += Math.min(12, Math.max(0, plan.rsEdge * 80));
    if (plan.fillProb != null && plan.fillProb >= 50) s += 8;
    else if (plan.fillProb != null && plan.fillProb >= 30) s += 4;
    if (plan.margins && plan.tightCount === 0) s += 6;
    if (typeof bestSessionActive === 'function' && bestSessionActive()) s += 4;
    if (typeof G.hgFtFormationBoost === 'function'){
      var recs = (typeof G.hgScoreRecords === 'function') ? G.hgScoreRecords() : [];
      s += G.hgFtFormationBoost(plan, recs);
    }
    if (typeof G.hgDeskFormationBoost === 'function'){
      s += G.hgDeskFormationBoost(plan.dir, typeof G.getDeskMacroCached === 'function' ? G.getDeskMacroCached() : null);
    }
    if (typeof G.hgChartVisionFormationBoost === 'function' && ctx && ctx.vision){
      s += G.hgChartVisionFormationBoost(plan.dir, ctx.vision);
    }
    if (ctx && ctx.rankBoost) s += Math.min(25, Math.max(-10, ctx.rankBoost));
    return Math.round(s);
  }catch(e){ return 0; }
}

function hgGoldPoiFromStrat(stratKey){
  var k = String(stratKey || '').toLowerCase();
  if (k === 'sweep') return 'sweep';
  if (k === 'fvg' || k === 'ob') return 'fvg';
  if (k === 'vwap' || k === 'vwapband') return 'avwap';
  if (k === 'ribbon') return 'ema21';
  if (k === 'rsidiv' || k === 'adrfade') return 'ote';
  if (k === 'asian' || k === 'openrange' || k === 'bosalign' || k === 'hvn') return 'fvg';
  return 'ema21';
}

function hgGoldOteInZone(dir, zone){
  try{
    if (!zone || !isFinite(zone.lo) || !isFinite(zone.hi)) return NaN;
    var span = zone.hi - zone.lo;
    if (!(span > 0)) return NaN;
    var mid = 0.705;
    return (dir === 'long') ? (zone.hi - span * mid) : (zone.lo + span * mid);
  }catch(e){ return NaN; }
}

function hgGoldEntryRefine(hit, mark, atrVal){
  try{
    var dir = String(hit.dir || '').toLowerCase();
    mark = isFinite(mark) ? +mark : (isFinite(hit.pxNow) ? +hit.pxNow : +hit.entry);
    var zone = hit.zone;
    var anchor = hit.anchor;
    var stratEntry = +hit.entry;
    if (!isFinite(stratEntry)) stratEntry = mark;
    if (typeof G.goldScalpLevels !== 'function' && typeof G.__gsEntryFromZone === 'function'){
      return G.__gsEntryFromZone(dir, mark, zone, anchor);
    }
    if (!zone || !isFinite(zone.lo) || !isFinite(zone.hi)){
      return { entry: stratEntry, inZone: true, zone: zone };
    }
    var entry = stratEntry, inZone = true;
    var poi = hgGoldPoiFromStrat(hit.stratKey);
    if (poi === 'ote'){
      var otePx = hgGoldOteInZone(dir, zone);
      if (isFinite(otePx) && isFinite(mark)){
        if (mark >= zone.lo && mark <= zone.hi){ entry = mark; inZone = true; }
        else { entry = otePx; inZone = false; }
        return { entry: entry, inZone: inZone, zone: zone, ote: true };
      }
    }
    if (isFinite(mark)){
      if (mark >= zone.lo && mark <= zone.hi){ entry = mark; inZone = true; }
      else if (isFinite(anchor)){
        entry = anchor;
        if (dir === 'long' && mark > zone.hi) entry = Math.min(anchor, zone.hi);
        else if (dir === 'short' && mark < zone.lo) entry = Math.max(anchor, zone.lo);
        inZone = false;
      } else {
        entry = (dir === 'long') ? (mark > zone.hi ? zone.hi : zone.lo) : (mark < zone.lo ? zone.lo : zone.hi);
        inZone = false;
      }
    }
    return { entry: entry, inZone: inZone, zone: zone };
  }catch(e){ return { entry: hit.entry, inZone: true, zone: hit.zone }; }
}

function hgGoldFormationScore(plan, hit, ctx){
  try{
    var s = hgFormationScore(plan, ctx);
    if (hit){
      if (hit.agree >= 5) s += 12;
      else if (hit.agree >= 3) s += 8;
      if (hit.grade === 'A') s += 10;
      else if (hit.grade === 'B') s += 5;
      if (hit.killzoneWeight >= 2) s += 8;
      else if (hit.killzoneWeight >= 1) s += 4;
      if (hit.stratKey === 'sweep') s += 6;
      if (hit.confluence && hit.confluence.length >= 4) s += 5;
    }
    return Math.round(s);
  }catch(e){ return hgFormationScore(plan, ctx); }
}

function hgFormGoldEnrich(hit, ctx, params, dir, mark, a4, rows, style, baseStyle, minRr){
  var plan = Object.assign({}, hit);
  var stratEntry = +hit.entry, stratStop = +hit.stop, stratT1 = +(hit.t1 || hit.tp1), stratT2 = +hit.t2;
  if (hit.notes && hit.notes.length) plan.stopNote = hit.notes.join('; ');
  else if (hit.stopNote) plan.stopNote = hit.stopNote;

  var ent = hgGoldEntryRefine(hit, mark, a4);
  var entryMoved = isFinite(ent.entry) && isFinite(stratEntry)
    && Math.abs(ent.entry - stratEntry) > a4 * 0.02;
  if (entryMoved && ent.entry > 0) plan.entry = ent.entry;
  if (ent.zone) plan.zone = ent.zone;

  plan.poi = hgGoldPoiFromStrat(hit.stratKey);
  plan.poiLabel = hit.strategy || hit.stratKey || plan.poi;

  var lvFn = (baseStyle === 'scalp' && typeof G.goldScalpLevels === 'function')
    ? G.goldScalpLevels
    : ((baseStyle === 'swing' && typeof G.goldSwingLevels === 'function') ? G.goldSwingLevels : null);
  if (entryMoved && lvFn){
    try{
      var lv0 = lvFn(dir, plan.entry, a4, hit.structStop || hit.anchor, hit.snapLvls);
      if (lv0 && isFinite(lv0.stop) && isFinite(lv0.t1)){
        plan.stop = lv0.stop; plan.t1 = lv0.t1;
        if (isFinite(lv0.t2)) plan.t2 = lv0.t2;
        plan.rr = lv0.rr; plan.rr2 = lv0.rr2;
        if (lv0.stopNote) plan.stopNote = lv0.stopNote;
      }
    }catch(eLv){}
  }

  var stop = +plan.stop;
  if (!isFinite(hit.structStop) && typeof G.hgStructureStop === 'function'){
    try{
      /* GOLD keeps its structural stop.

         v350 fixed this for OMNIGOLD and reached nothing else. SUPER GOLD,
         GOLD SWING and GOLD SCALP all build levels through
         hgApplyGoldBestLevels -> hgBestLevelsGold -> hgFormTicket, which
         lands here — so three of the four gold desks were still having the
         stop pulled off structure to a flat 1.5xATR whenever invalidation sat
         beyond 2.5xATR. On gold-shaped 1h data that fired on 65% of setups
         and put the stop ~53% nearer than the level that means the idea is
         wrong, which is inside ordinary session noise.

         The crypto branch below is deliberately left on the old default. */
      var st = G.hgStructureStop(dir, plan.entry, rows, {
        look: params.swingLook, buffer: params.buffer, capDist: params.capDist,
        capMode: 'structure'
      });
      if (st && isFinite(st.stop)){
        if (dir === 'long' && st.stop < stop){ stop = st.stop; plan.stopNote = (plan.stopNote ? plan.stopNote + '; ' : '') + (st.note || ''); }
        else if (dir === 'short' && st.stop > stop){ stop = st.stop; plan.stopNote = (plan.stopNote ? plan.stopNote + '; ' : '') + (st.note || ''); }
      }
    }catch(eSt){}
  }
  if (entryMoved && isFinite(params.stopScale) && params.stopScale > 0 && Math.abs(params.stopScale - 1) > 0.02){
    var r0 = Math.abs(plan.entry - stop);
    stop = dir === 'long' ? plan.entry - r0 * params.stopScale : plan.entry + r0 * params.stopScale;
  }
  plan.stop = stop;

  var risk = Math.abs(plan.entry - stop);
  if (!(risk > 0)) return { ok: false, reason: 'invalid strategy levels', tag: 'formation' };

  if (entryMoved){
    var tg = hgStructureTargets(dir, plan.entry, stop, rows, a4, { minRr: minRr, style: baseStyle });
    if (tg){
      var stratRr = isFinite(stratT1) ? Math.abs(stratT1 - plan.entry) / risk : minRr;
      plan.t1 = tg.t1;
      if (Math.abs(plan.t1 - plan.entry) / risk < stratRr - 1e-9 && isFinite(stratT1)) plan.t1 = stratT1;
      plan.t2 = isFinite(stratT2) ? stratT2 : tg.t2;
      plan.rr = Math.abs(plan.t1 - plan.entry) / risk;
      plan.rr1 = plan.rr;
      plan.rr2 = isFinite(plan.t2) ? Math.abs(plan.t2 - plan.entry) / risk : tg.rr2;
      plan.t1Source = tg.t1Source; plan.t2Source = tg.t2Source;
      plan.targetPolicy = tg.targetPolicy;
    }
  } else {
    plan.t1 = stratT1;
    plan.t2 = stratT2;
    plan.rr = isFinite(stratT1) ? Math.abs(stratT1 - plan.entry) / risk : hit.rr;
  }

  if (typeof G.hgRefineEntry === 'function'){
    var ref = G.hgRefineEntry(mark, plan.entry, plan.zone, dir);
    if (typeof G.hgFormatEntryType === 'function'){
      plan.entryType = ref.inZone ? G.hgFormatEntryType('MARKET', plan.poiLabel)
        : G.hgFormatEntryType('LIMIT', plan.poiLabel);
    } else {
      plan.entryType = (ref.inZone ? 'MARKET @ ' : 'LIMIT @ ') + plan.poiLabel;
    }
    plan.entryGuidance = ref.guidance || plan.entryGuidance;
  }

  var fillBars = baseStyle === 'scalp' ? params.fillBarsScalp : params.fillBarsSwing;
  var fill = hgFillProbability(rows, plan.entry, dir, plan.zone, fillBars);
  plan.fillProb = fill.pct;
  plan.fillNote = fill.note;

  /* Every ratio derived from the FINAL levels, on every path.

     plan starts as a copy of hit, so it arrives carrying the hit's rr, rr1
     and rr2. Three paths above then move the levels without replacing all
     three: the entryMoved branch leaves every ratio and both targets behind
     when hgStructureTargets returns nothing; the else branch recomputes rr
     but not rr1 or rr2, even though hgStructureStop routinely widens the stop
     there; and the goldScalpLevels branch sets rr and rr2 from lv0 just
     before the stop can be changed again beneath them.

     A stale rr1 does not merely display wrong. gbValidPlan in
     gold-best-levels.js PREFERS plan.rr1 over deriving one, so the minimum
     R:R gate could be cleared by a ratio measured against levels the setup no
     longer has. */
  plan.rr = isFinite(plan.t1) ? Math.abs(plan.t1 - plan.entry) / risk : null;
  plan.rr1 = plan.rr;
  plan.rr2 = isFinite(plan.t2) ? Math.abs(plan.t2 - plan.entry) / risk : null;

  var gRr = isFinite(plan.rr) ? plan.rr : NaN;
  if (!isFinite(gRr) || gRr < minRr - 1e-9){
    return { ok: false, reason: 'min R:R ' + minRr + ' not met (' + (isFinite(gRr) ? gRr.toFixed(2) : 'n/a') + 'R)', tag: 'formation' };
  }
  if (dir === 'long' && stop >= plan.entry) return { ok: false, reason: 'long stop above entry', tag: 'formation' };
  if (dir === 'short' && stop <= plan.entry) return { ok: false, reason: 'short stop below entry', tag: 'formation' };

  plan.formationScore = hgGoldFormationScore(plan, hit, ctx);
  plan.formationParams = params.source;
  plan.planSrc = 'gold ' + baseStyle + ' · ' + (hit.stratKey || 'strategy');
  if (typeof G.hgLiveFormationApply === 'function'){
    try{
      var gLive = ctx.live;
      if (!gLive && typeof G.hgLiveFormationSnap === 'function')
        gLive = G.hgLiveFormationSnap(plan.sym || hit.sym, dir);
      var gApp = G.hgLiveFormationApply(plan, gLive, { a4: a4, preserveLevels: true, gold: true });
      if (!gApp || gApp.ok === false){
        return { ok: false, reason: (gApp && gApp.reason) || 'live context refused', tag: (gApp && gApp.tag) || 'live' };
      }
      plan = gApp.plan || plan;
      if (isFinite(+plan.liveScoreDelta))
        plan.formationScore = Math.round((isFinite(+plan.formationScore) ? +plan.formationScore : 0) + +plan.liveScoreDelta);
    }catch(eGLive){}
  }
  return { ok: true, hit: plan, formationScore: plan.formationScore, fillNote: fill.note };
}

/* Crypto desks that already priced a named setup (OMNIROUTE hit.level,
   OMNIPRESENT live/zone) must not snap ENTRY to a generic POI. This path
   keeps that entry locked, then uses the house formation tools on the
   rest of the ticket:

     STOP  widen-only via hgStructureStop (never tighten — gold lesson).
           OMNIPRESENT zone stops stay squeezed: the zone IS invalidation.
     T1/T2 structure (liquidity / value-area) when they still clear min R:R;
           mechanical R-multiples otherwise. Never invent a closer target
           just to dress the card.
     TYPE  MARKET if live is in the zone, else LIMIT. Thin LIMIT fill
           demotes the score — never pulls ENTRY closer, never vetoes
           a VALUE / ARMED wait that is the desk's product.
     SCORE POI agreement with the named level, fill, live context.

   Live refuse (event / stables / spot-perp) is the only hard fail. */
function hgFormKeepLevels(hit, ctx, params, dir, mark, a4, rows, style, baseStyle, minRr){
  var plan = Object.assign({}, hit);
  var entry0 = +plan.entry, stop0 = +plan.stop, t10 = +(plan.t1 || plan.tp1), t20 = +plan.t2;
  if (!(isFinite(entry0) && entry0 > 0 && isFinite(stop0)))
    return { ok: false, reason: 'no named levels to keep', tag: 'formation' };
  var risk0 = Math.abs(entry0 - stop0);
  if (!(risk0 > 0)) return { ok: false, reason: 'invalid named levels', tag: 'formation' };
  if (!(isFinite(a4) && a4 > 0)) a4 = risk0;
  if (!isFinite(mark)) mark = isFinite(+plan.mark) ? +plan.mark : entry0;
  var rankBoost = isFinite(ctx && ctx.rankBoost) ? +ctx.rankBoost : 0;
  var squeezed = /omnipresent|^op-/i.test(String(plan.planSrc || '') + ' ' + String(plan.kind || ''));
  var stop = stop0;

  /* 1. Structure-widen STOP. Never pull it closer than the named invalidation.
        Distant lastSwing (runaway trend) is declined — that would destroy
        the setup-level stop OMNIROUTE priced on purpose. */
  if (!squeezed && typeof G.hgStructureStop === 'function'){
    try{
      var st = G.hgStructureStop(dir, entry0, rows, {
        look: params.swingLook, buffer: params.buffer, capDist: params.capDist,
        capMode: 'structure'
      });
      if (st && isFinite(st.stop)){
        var stOk = (dir === 'long') ? (st.stop < entry0 && st.stop < stop)
                                    : (st.stop > entry0 && st.stop > stop);
        if (stOk){
          var widenAtr = Math.abs(st.stop - stop) / a4;
          var riskAtr = Math.abs(entry0 - st.stop) / a4;
          if (widenAtr <= 1.0 + 1e-9 && riskAtr <= 3.5 + 1e-9){
            stop = st.stop;
            plan.stopWidened = true;
            plan.stopNote = (plan.stopNote ? plan.stopNote + '; ' : '')
              + (st.note || 'stop widened to structure');
          }
        }
      }
    }catch(eSt){}
  }
  plan.stop = stop;
  if (dir === 'long' && stop >= entry0)
    return { ok: false, reason: 'long stop above entry', tag: 'formation' };
  if (dir === 'short' && stop <= entry0)
    return { ok: false, reason: 'short stop below entry', tag: 'formation' };

  var risk = Math.abs(entry0 - stop);
  if (!(risk > 0)) return { ok: false, reason: 'invalid formed levels', tag: 'formation' };

  /* 2. Structure T1/T2 when they still clear the style floor. Keep the
        named target if it is further (more honest reward) and still pays. */
  var t1 = t10, t2 = t20, t1Source = plan.t1Source || 'named', t2Source = plan.t2Source || 'named';
  var tg = hgStructureTargets(dir, entry0, stop, rows, a4, { minRr: minRr, style: baseStyle });
  if (tg && isFinite(tg.t1) && tg.rr1 >= minRr - 1e-9){
    var namedRr = isFinite(t10) ? Math.abs(t10 - entry0) / risk : NaN;
    var namedFurther = isFinite(namedRr) && namedRr >= minRr - 1e-9
      && Math.abs(t10 - entry0) >= Math.abs(tg.t1 - entry0) - 1e-9;
    if (!namedFurther){
      t1 = tg.t1;
      t1Source = tg.t1Source || 'structure';
      plan.targetPolicy = tg.targetPolicy;
    }
    if (isFinite(tg.t2)){
      if (!isFinite(t20) || Math.abs(tg.t2 - entry0) > Math.abs(t20 - entry0)){
        t2 = tg.t2;
        t2Source = tg.t2Source || 'structure';
      }
    }
  } else if (!(isFinite(t1) && Math.abs(t1 - entry0) / risk >= minRr - 1e-9)
             && typeof G.hgPlanFromRisk === 'function'){
    try{
      var pr = G.hgPlanFromRisk(dir, entry0, stop, {
        t1R: baseStyle === 'scalp' ? 1.5 : 2,
        t2R: baseStyle === 'scalp' ? 2.5 : 3.5,
        minRr: minRr,
        targetPolicy: 'R-multiples after structure stop'
      });
      if (pr && isFinite(pr.t1)){
        t1 = pr.t1;
        t1Source = 'R floor after stop';
        if (isFinite(pr.t2) && !isFinite(t2)) t2 = pr.t2;
        plan.targetPolicy = pr.targetPolicy || plan.targetPolicy;
      }
    }catch(ePr){}
  }
  if (isFinite(t1)) plan.t1 = t1;
  if (isFinite(t2)) plan.t2 = t2;
  plan.t1Source = t1Source;
  plan.t2Source = t2Source;
  plan.rr = isFinite(t1) ? Math.abs(t1 - entry0) / risk : null;
  plan.rr1 = plan.rr;
  plan.rr2 = isFinite(t2) ? Math.abs(t2 - entry0) / risk : null;

  /* 3. Entry TYPE — never move the named price. TRIGGERED fades are market. */
  if (!plan.zone || !isFinite(+plan.zone.lo) || !isFinite(+plan.zone.hi)){
    plan.zone = { lo: entry0 - 0.25 * a4, hi: entry0 + 0.25 * a4 };
  }
  var triggered = /triggered|op-reject/i.test(String(plan.kind || '') + ' ' + String(plan.status || ''));
  var inZone = false;
  if (triggered){
    plan.entryType = (typeof G.hgFormatEntryType === 'function')
      ? G.hgFormatEntryType('MARKET', plan.poiLabel || plan.kind || 'live')
      : 'MARKET @ live';
    plan.entryGuidance = 'TRIGGERED — live print is the fill';
    inZone = true;
  } else if (typeof G.hgRefineEntry === 'function'){
    var ref = G.hgRefineEntry(mark, entry0, plan.zone, dir);
    inZone = !!ref.inZone;
    var label = plan.poiLabel || plan.kind || 'setup';
    if (typeof G.hgFormatEntryType === 'function'){
      plan.entryType = ref.inZone ? G.hgFormatEntryType('MARKET', label)
        : G.hgFormatEntryType('LIMIT', label);
    } else {
      plan.entryType = (ref.inZone ? 'MARKET @ ' : 'LIMIT @ ') + label;
    }
    plan.entryGuidance = ref.guidance || plan.entryGuidance;
  }

  /* 4. POI agreement — score the named level against real structure.
        Never replace ENTRY with the POI. */
  try{
    var poi = hgRankEntryPOI(rows, dir, baseStyle, mark, a4, params);
    if (poi && isFinite(+poi.entry)){
      var poiAtr = Math.abs(+poi.entry - entry0) / a4;
      plan.poiAgreeAtr = poiAtr;
      plan.poiAgreeLabel = poi.label || poi.poi;
      if (poiAtr <= 0.5){ rankBoost += 8; plan.poiAgree = true; }
      else if (poiAtr <= 1.0){ rankBoost += 3; plan.poiAgree = true; }
      else { rankBoost -= 3; plan.poiAgree = false; }
    }
  }catch(ePoi){}

  /* 5. Fill history. Do not pull ENTRY closer to chase a thin zone.
        Demote — do not refuse. VALUE / ARMED tickets live 2–4×ATR from
        the print on purpose; a fill refuse would empty both desks. */
  var fillBars = baseStyle === 'scalp' ? params.fillBarsScalp : params.fillBarsSwing;
  var fill = hgFillProbability(rows, entry0, dir, plan.zone, fillBars);
  plan.fillProb = fill.pct;
  plan.fillNote = fill.note;
  var fillPct = isFinite(+fill.pct) ? +fill.pct : null;
  var isLimit = !inZone && !triggered;
  if (isLimit && fillPct != null && fillPct < 25){
    plan.fillPenalty = true;
    rankBoost -= (fillPct < 10 ? 12 : 8);
  }

  plan.formationParams = params.source;
  plan.planSrc = plan.planSrc || 'keep-levels';
  ctx = Object.assign({}, ctx, { rankBoost: rankBoost });
  plan.formationScore = hgFormationScore(plan, ctx);

  if (typeof G.hgLiveFormationApply === 'function'){
    try{
      var live = (ctx && ctx.live) || null;
      if (!live && typeof G.hgLiveFormationSnap === 'function')
        live = G.hgLiveFormationSnap(plan.sym || hit.sym, dir);
      var app = G.hgLiveFormationApply(plan, live, { a4: a4, preserveLevels: true, style: baseStyle });
      if (!app || app.ok === false){
        return { ok: false, reason: (app && app.reason) || 'live context refused',
          tag: (app && app.tag) || 'live', hit: plan };
      }
      plan = app.plan || plan;
    }catch(eKeep){}
  }

  /* 6. Final gates: PROVEN-BAD is a refuse. Cost / regime are demotes —
        VALUE tickets often have a tight setup-level R, and the desk already
        owns net-R / cost-drag. A second cost veto here emptied the tab. */
  if (typeof G.hgTicketFinalGates === 'function'){
    try{
      var fg = G.hgTicketFinalGates(plan, { minRr: minRr, lane: 'crypto', style: baseStyle });
      if (fg && fg.chips && fg.chips.length){
        plan.evidenceChips = (plan.evidenceChips || []).concat(fg.chips);
      }
      if (fg && fg.ok === false && fg.tag === 'edge'){
        return { ok: false, reason: fg.reason || 'PROVEN-BAD archetype', tag: 'edge', hit: plan };
      }
      if (fg && fg.ok === false){
        rankBoost -= 10;
        plan.finalGateDemote = fg.reason || fg.tag;
      }
    }catch(eFg){}
  }

  /* Named ENTRY is the trade — restore even if a live helper mutated a copy.
     Stop / T1 / T2 keep the intelligent geometry computed above. */
  plan.entry = entry0;
  plan.stop = stop;
  if (isFinite(t1)) plan.t1 = t1;
  if (isFinite(t2)) plan.t2 = t2;
  risk = Math.abs(entry0 - stop);
  plan.rr = isFinite(t1) ? Math.abs(t1 - entry0) / risk : plan.rr;
  plan.rr1 = plan.rr;
  plan.rr2 = isFinite(t2) ? Math.abs(t2 - entry0) / risk : plan.rr2;
  ctx = Object.assign({}, ctx, { rankBoost: rankBoost });
  plan.formationScore = hgFormationScore(plan, ctx);
  if (isFinite(+plan.liveScoreDelta))
    plan.formationScore = Math.round((isFinite(+plan.formationScore) ? +plan.formationScore : 0) + +plan.liveScoreDelta);
  return { ok: true, hit: plan, formationScore: plan.formationScore, fillNote: fill.note };
}

/* --- unified ticket formation pipeline --- */
function hgFormTicket(hit, ctx){
  ctx = ctx || {};
  try{
    if (!hit || !hit.dir) return { ok: false, reason: 'no direction', tag: 'formation' };
    var rows = ctx.rows;
    if (!rows || !rows.length) return { ok: false, reason: 'no rows', tag: 'formation' };
    var style = String(ctx.style || 'swing').toLowerCase();
    var isGold = style.indexOf('gold-') === 0;
    var baseStyle = style.indexOf('scalp') >= 0 ? 'scalp' : (style.indexOf('swing') >= 0 ? 'swing' : style);
    var params = hgFormationParams();
    var dir = hit.dir;
    var mark = isFinite(hit.mark) ? +hit.mark : +rows[rows.length - 1].c;
    var a4 = ctx.a4;
    if (!isFinite(a4) && typeof atr === 'function') a4 = _last(atr(rows, 14));
    if (!(isFinite(a4) && a4 > 0)) return { ok: false, reason: 'no ATR', tag: 'formation' };

    var plan = Object.assign({}, hit);
    var minRr = isGold
      ? (isFinite(+ctx.goldMinRr) ? +ctx.goldMinRr : 1.2)
      : (baseStyle === 'scalp' ? 2.25 : (typeof G.CG_SWING_RR_MIN === 'number' ? G.CG_SWING_RR_MIN : 2));
    var entryBefore = plan.entry;

    /* Gold scalp/swing: strategy-native levels from goldind.js / goldswing.js,
       then zone entry refinement, structure stop widen, structure targets,
       fill probability, and confluence-weighted formation score — never
       overwrite with generic crypto POI picks. */
    if (isGold){
      return hgFormGoldEnrich(hit, ctx, params, dir, mark, a4, rows, style, baseStyle, minRr);
    }
    if (ctx.keepLevels === true || ctx.preserveLevels === true){
      return hgFormKeepLevels(hit, ctx, params, dir, mark, a4, rows, style, baseStyle, minRr);
    }

    var poi = null;
    if (!ctx.skipPoi && !(hit.planSrc && hit.entryType)){
    poi = hgRankEntryPOI(rows, dir, style, mark, a4, params);
    if (poi){
      plan.entry = poi.entry;
      plan.anchor = poi.entry;
      plan.poi = poi.poi;
      plan.poiLabel = poi.label;
      plan.zone = poi.zone;
      if (typeof G.hgRefineEntry === 'function'){
        var ref = G.hgRefineEntry(mark, poi.entry, poi.zone, dir);
        var mkt = ref.inZone;
        if (typeof G.hgFormatEntryType === 'function'){
          plan.entryType = mkt ? G.hgFormatEntryType('MARKET', poi.label) : G.hgFormatEntryType('LIMIT', poi.label);
        } else {
          plan.entryType = (mkt ? 'MARKET @ ' : 'LIMIT @ ') + poi.label;
        }
        plan.entryGuidance = ref.guidance || plan.entryGuidance;
      }
    }
    }

    var stop = plan.stop;
    if (poi && poi.sweepExtreme != null && typeof G.hgSweepStop === 'function'){
      var ss = G.hgSweepStop(dir, poi.sweepExtreme, a4, {});
      if (isFinite(ss) && (dir === 'long' ? ss < plan.entry : ss > plan.entry)) stop = ss;
    }
    if (typeof G.hgStructureStop === 'function'){
      var st = G.hgStructureStop(dir, plan.entry, rows, {
        look: params.swingLook, buffer: params.buffer, capDist: params.capDist
      });
      if (st && isFinite(st.stop)){
        stop = st.stop;
        plan.stopNote = st.note;
        if (isFinite(params.stopScale) && params.stopScale > 0 && Math.abs(params.stopScale - 1) > 0.02){
          var r0 = Math.abs(plan.entry - stop);
          stop = dir === 'long' ? plan.entry - r0 * params.stopScale : plan.entry + r0 * params.stopScale;
          plan.stopNote = (plan.stopNote || '') + ' · ledger ×' + (Math.round(params.stopScale * 100) / 100);
        }
      }
    }
    plan.stop = stop;

    var tg = hgStructureTargets(dir, plan.entry, plan.stop, rows, a4, { minRr: minRr, style: style });
    if (tg){
      plan.t1 = tg.t1; plan.t2 = tg.t2; plan.rr = tg.rr1; plan.rr1 = tg.rr1; plan.rr2 = tg.rr2;
      plan.t1Source = tg.t1Source; plan.t2Source = tg.t2Source;
      plan.targetPolicy = tg.targetPolicy; plan.partialPolicy = tg.partialPolicy;
    }

    if (baseStyle === 'swing' && typeof G.hgSwingPostEnrichValid === 'function'){
      var v = G.hgSwingPostEnrichValid(plan, { rows: rows, a4: a4, minRr: minRr });
      if (!v) return { ok: false, reason: 'post-enrich G6 / min R:R failed', tag: 'formation' };
      plan = v;
    } else if (baseStyle === 'scalp' && typeof G.hgScalpPostEnrichValid === 'function'){
      var vs = G.hgScalpPostEnrichValid(plan, { m15: ctx.m15 || rows, a: a4, minRr: minRr });
      if (!vs) return { ok: false, reason: 'scalp post-enrich failed', tag: 'formation' };
      plan = vs;
    }

    /* Same rule as the gold path, on the bigger surface. This branch moves
       the entry to the ranked POI and then moves the stop again (sweep stop,
       structure stop, ledger stopScale) — but t1/t2/rr/rr1/rr2 are only
       replaced inside `if (tg)`. When hgStructureTargets returns nothing, the
       plan goes on carrying the ORIGINAL hit's targets and ratios against a
       new entry and a new stop. Derived from the final levels, on every
       path, after post-enrich has had its say. */
    var fRisk = (isFinite(+plan.entry) && isFinite(+plan.stop))
      ? Math.abs(+plan.entry - +plan.stop) : NaN;
    if (isFinite(fRisk) && fRisk > 0){
      plan.rr = isFinite(+plan.t1) ? Math.abs(+plan.t1 - +plan.entry) / fRisk : null;
      plan.rr1 = plan.rr;
      plan.rr2 = isFinite(+plan.t2) ? Math.abs(+plan.t2 - +plan.entry) / fRisk : null;
    } else {
      plan.rr = null; plan.rr1 = null; plan.rr2 = null;
    }

    var fillBars = baseStyle === 'scalp' ? params.fillBarsScalp : params.fillBarsSwing;
    var fill = hgFillProbability(rows, plan.entry, dir, plan.zone, fillBars);
    plan.fillProb = fill.pct;
    plan.fillNote = fill.note;
    var poiMoved = isFinite(entryBefore) && Math.abs(plan.entry - entryBefore) > (a4 * 0.05);
    if (fill.prob != null && fill.prob < HG_FILL_MIN && poiMoved
        && plan.entryType && String(plan.entryType).indexOf('LIMIT') >= 0){
      return { ok: false, reason: 'fill est. ' + fill.pct + '% < ' + Math.round(HG_FILL_MIN * 100) + '%', tag: 'fill' };
    }

    if (typeof bestSessionActive === 'function' && !bestSessionActive()
        && plan.entryType && String(plan.entryType).indexOf('MARKET') >= 0){
      plan.entryType = String(plan.entryType).replace(/MARKET/, 'LIMIT');
      plan.sessionNote = 'off-session — limit only (no market chase)';
    }

    /* Live internet context. Confirm / demote / refuse. Never invents
       ENTRY / STOP / T1. A silent feed is UNCHECKED. */
    var live = (ctx && ctx.live) || null;
    if (!live && typeof G.hgLiveFormationSnap === 'function'){
      try{ live = G.hgLiveFormationSnap(plan.sym || hit.sym, dir); }catch(eLv){ live = null; }
    }
    if (typeof G.hgLiveFormationApply === 'function'){
      try{
        var applied = G.hgLiveFormationApply(plan, live, { a4: a4, minRr: minRr, style: baseStyle });
        if (!applied || applied.ok === false){
          return { ok: false, reason: (applied && applied.reason) || 'live context refused', tag: (applied && applied.tag) || 'live' };
        }
        plan = applied.plan || plan;
      }catch(eAp){}
    }
    if (plan.liveStopWidened){
      var liveRisk = (isFinite(+plan.entry) && isFinite(+plan.stop))
        ? Math.abs(+plan.entry - +plan.stop) : NaN;
      if (isFinite(liveRisk) && liveRisk > 0){
        plan.rr = isFinite(+plan.t1) ? Math.abs(+plan.t1 - +plan.entry) / liveRisk : null;
        plan.rr1 = plan.rr;
        plan.rr2 = isFinite(+plan.t2) ? Math.abs(+plan.t2 - +plan.entry) / liveRisk : null;
      }
      if (baseStyle === 'swing' && typeof G.hgSwingPostEnrichValid === 'function'){
        var liveG6 = G.hgSwingPostEnrichValid(plan, { rows: rows, a4: a4, minRr: minRr });
        if (!liveG6) return { ok: false, reason: 'live liq stop failed G6 / min R:R', tag: 'live' };
        plan = liveG6;
      } else if (baseStyle === 'scalp' && typeof G.hgScalpPostEnrichValid === 'function'){
        var liveSc = G.hgScalpPostEnrichValid(plan, { m15: ctx.m15 || rows, a: a4, minRr: minRr });
        if (!liveSc) return { ok: false, reason: 'live liq stop failed scalp post-enrich', tag: 'live' };
        plan = liveSc;
      }
    }

    plan.expiresBars = baseStyle === 'scalp' ? 96 : null;
    plan.formationScore = hgFormationScore(plan, ctx);
    plan.formationParams = params.source;

    if (typeof G.hgMetaLabel === 'function'){
      var recs = (typeof G.hgScoreRecords === 'function') ? G.hgScoreRecords() : [];
      plan.metaLabel = G.hgMetaLabel(plan, ctx, recs);
    }

    if (typeof G.hgTicketFinalGates === 'function'){
      var tg = G.hgTicketFinalGates(plan, {
        sym: hit.sym || plan.sym,
        lane: isGold ? 'gold' : 'crypto',
        minRr: minRr,
        atrPct: (a4 && isFinite(mark) && mark > 0) ? a4 / mark * 100 : null,
        counterTrend: !!(hit.fundingFade || plan.fundingFade),
        notionalUsd: ctx.notionalUsd || (live && live.notionalUsd),
        venue: ctx.venue,
        depthUsd: ctx.depthUsd || (live && live.depthUsd),
        spreadBps: ctx.spreadBps || (live && live.spreadBps),
      });
      if (!tg.ok) return { ok: false, reason: tg.reason, tag: tg.tag || 'gate' };
      if (tg.chips && tg.chips.length) plan.evidenceChips = tg.chips;
    }

    return { ok: true, hit: plan, formationScore: plan.formationScore, fillNote: fill.note, metaLabel: plan.metaLabel || null };
  }catch(e){
    /* `hit` here is the RAW input. Reporting ok:true with it claimed a formed
       ticket for a hit that had had no POI entry, no sweep or structure stop,
       no structure targets, no fill gate and no hgTicketFinalGates run against
       it. Formation did not happen, so it must not be reported as having
       happened; every caller already has a !ok path that falls through to an
       alternative plan or declines the candidate. */
    return { ok: false, reason: 'formation threw: ' + ((e && e.message) || String(e)), tag: 'formation' };
  }
}

G.hgFormationParams = hgFormationParams;
G.hgSaveFormationParams = hgSaveFormationParams;
G.hgFillProbability = hgFillProbability;
G.hgAnchorIndex = hgAnchorIndex;
G.hgAnchoredVWAP = hgAnchoredVWAP;
G.hgRankEntryPOI = hgRankEntryPOI;
G.hgStructureTargets = hgStructureTargets;
G.hgFormationScore = hgFormationScore;
G.hgFormTicket = hgFormTicket;
G.hgFormKeepLevels = hgFormKeepLevels;
G.HG_FILL_MIN = HG_FILL_MIN;

})();
