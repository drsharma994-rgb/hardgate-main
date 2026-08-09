/* HARDGATE — unified ticket formation: POI entry → structure stop → structure TP.
   Loaded after plans.js + scorecard.js. Pure exports on window, never throw. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var LS_FORMATION = 'hgFormationParams_v1';
var HG_FILL_MIN = 0.20;
var HG_ANCHOR_MAX_ATR = 1.25;

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
    var anchorMax = HG_ANCHOR_MAX_ATR * atrVal;

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
    if (ctx && ctx.rankBoost) s += Math.min(25, Math.max(-10, ctx.rankBoost));
    return Math.round(s);
  }catch(e){ return 0; }
}

/* --- unified ticket formation pipeline --- */
function hgFormTicket(hit, ctx){
  ctx = ctx || {};
  try{
    if (!hit || !hit.dir) return { ok: false, reason: 'no direction', tag: 'formation' };
    var rows = ctx.rows;
    if (!rows || !rows.length) return { ok: false, reason: 'no rows', tag: 'formation' };
    var style = String(ctx.style || 'swing').toLowerCase();
    var params = hgFormationParams();
    var dir = hit.dir;
    var mark = isFinite(hit.mark) ? +hit.mark : +rows[rows.length - 1].c;
    var a4 = ctx.a4;
    if (!isFinite(a4) && typeof atr === 'function') a4 = _last(atr(rows, 14));
    if (!(isFinite(a4) && a4 > 0)) return { ok: false, reason: 'no ATR', tag: 'formation' };

    var plan = Object.assign({}, hit);
    var minRr = style === 'scalp' ? 2.25 : (typeof G.CG_SWING_RR_MIN === 'number' ? G.CG_SWING_RR_MIN : 2);
    var entryBefore = plan.entry;

    if (!ctx.skipPoi && !(hit.planSrc && hit.entryType)){
    var poi = hgRankEntryPOI(rows, dir, style, mark, a4, params);
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

    if (style === 'swing' && typeof G.hgSwingPostEnrichValid === 'function'){
      var v = G.hgSwingPostEnrichValid(plan, { rows: rows, a4: a4, minRr: minRr });
      if (!v) return { ok: false, reason: 'post-enrich G6 / min R:R failed', tag: 'formation' };
      plan = v;
    } else if (style === 'scalp' && typeof G.hgScalpPostEnrichValid === 'function'){
      var vs = G.hgScalpPostEnrichValid(plan, { m15: ctx.m15 || rows, a: a4, minRr: minRr });
      if (!vs) return { ok: false, reason: 'scalp post-enrich failed', tag: 'formation' };
      plan = vs;
    }

    var fillBars = style === 'scalp' ? params.fillBarsScalp : params.fillBarsSwing;
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

    plan.expiresBars = style === 'scalp' ? 96 : null;
    plan.formationScore = hgFormationScore(plan, ctx);
    plan.formationParams = params.source;

    return { ok: true, hit: plan, formationScore: plan.formationScore, fillNote: fill.note };
  }catch(e){ return { ok: true, hit: hit, formationScore: 0 }; }
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
G.HG_FILL_MIN = HG_FILL_MIN;

})();
