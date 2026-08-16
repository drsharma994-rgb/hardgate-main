/* HARDGATE — unified gold scalp/swing entry · SL · TP engine.
   Phases: 1 formation+ShieldGuard · 2 MTF bias · 3 OB/FVG quality ·
   4 regime/session · 5 calibrated min R:R · 6 chart vision veto.
   Inspired by xaubot-ai / EA_SCALPER_XAUUSD / BAKOMEGoldScalper SMC patterns.
   Loaded after best-levels.js + structure-levels.js. Never throws. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var GB_REF = 'hgFormGold + opencrypto OB/FVG + MTF + regime + vision veto';
var HG_GOLD_SCALP_MIN_RR = 1.2;
var HG_GOLD_SWING_MIN_RR = 2.0;
var HG_GOLD_HIGH_VOL_MIN_RR = 1.5;

function fin(v){ return typeof v === 'number' && isFinite(v); }

function gbDir(d){
  d = String(d || '').toLowerCase();
  return (d === 'long' || d === 'short') ? d : null;
}

function gbStyle(inp){
  var s = String((inp && inp.style) || 'gold-scalp').toLowerCase();
  return s.indexOf('swing') >= 0 ? 'gold-swing' : 'gold-scalp';
}

function gbBaseStyle(style){
  return style.indexOf('swing') >= 0 ? 'swing' : 'scalp';
}

function gbMinRr(style, regime){
  var base = gbBaseStyle(style) === 'scalp' ? HG_GOLD_SCALP_MIN_RR : HG_GOLD_SWING_MIN_RR;
  if (regime && regime.highVol) return Math.max(base, HG_GOLD_HIGH_VOL_MIN_RR);
  if (regime && fin(+regime.minRr)) return +regime.minRr;
  return base;
}

function gbValidPlan(plan, minRr){
  if (!plan) return false;
  var entry = gbNum(plan.entry), stop = gbNum(plan.stop), t1 = gbNum(plan.t1);
  if (!fin(entry) || entry <= 0 || !fin(stop) || !fin(t1)) return false;
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return false;
  /* Derived here, never read from plan.rr1. This gate used to PREFER the
     plan's own rr1, which meant a minimum-R:R floor could be cleared by a
     ratio measured against levels the plan no longer had — the gate testing
     a number instead of the trade. The levels are the only self-consistent
     source, exactly as in hgSyncPlanRr. */
  var rr = Math.abs(t1 - entry) / risk;
  return fin(rr) && rr >= minRr - 1e-9;
}

function gbEmaSlope(rows, len, back){
  try{
    if (typeof ema !== 'function' || !rows || rows.length < len + back + 2) return null;
    var e = ema(rows.map(function(r){ return r.c; }), len);
    if (!e || e.length < back + 1) return null;
    var n = e.length - 1;
    return e[n] - e[n - back];
  }catch(e){ return null; }
}

function gbEmaLast(rows, len){
  try{
    if (typeof ema !== 'function' || !rows || rows.length < len + 2) return NaN;
    var e = ema(rows.map(function(r){ return r.c; }), len);
    return e && e.length ? e[e.length - 1] : NaN;
  }catch(e){ return NaN; }
}

/** Phase 4 — regime label + calibrated min R:R inputs. */
function hgGoldRegime(rows, style){
  var out = { label: 'UNKNOWN', er: NaN, highVol: false, minRr: null, chop: false };
  try{
    rows = rows || [];
    if (rows.length < 25) return out;
    if (typeof kaufmanER === 'function'){
      var er = kaufmanER(rows, 20);
      if (fin(er)){
        out.er = er;
        out.chop = er < 0.25;
        out.label = er >= 0.45 ? 'TREND' : (er < 0.25 ? 'CHOP' : 'MIXED');
      }
    }
    if (typeof atr === 'function'){
      var a = atr(rows, 14);
      var atrVal = a && a.length ? a[a.length - 1] : NaN;
      var atrMed = NaN;
      if (a && a.length >= 20){
        var sl = a.slice(-20);
        sl.sort(function(x, y){ return x - y; });
        atrMed = sl[Math.floor(sl.length / 2)];
      }
      if (fin(atrVal) && fin(atrMed) && atrMed > 0 && atrVal / atrMed >= 1.35){
        out.highVol = true;
        out.label = (out.label === 'TREND' ? 'VOL-TREND' : 'VOLATILE');
      }
    }
    out.minRr = gbMinRr(style, out);
    return out;
  }catch(e){ return out; }
}

/** Phase 4 — Silver Bullet / ICT killzone boost (London 8–9, NY 15–16 UTC). */
function hgGoldSessionBoost(nowMs, stratKey){
  try{
    var d = new Date(nowMs || Date.now());
    var h = d.getUTCHours() + d.getUTCMinutes() / 60;
    var k = String(stratKey || '').toLowerCase();
    var inLondon = h >= 8 && h < 9;
    var inNy = h >= 15 && h < 16;
    if ((inLondon || inNy) && (k === 'ob' || k === 'fvg' || k === 'sweep' || k === 'vwap')) return 6;
    if (h >= 13 && h < 17) return 3;
    return 0;
  }catch(e){ return 0; }
}

/** Phase 2 — MTF bias: scalp = 4H EMA50/200 + 1H slope; swing = 4H + optional 1D. */
function hgGoldMtfGate(dir, inp){
  inp = inp || {};
  dir = gbDir(dir);
  if (!dir) return { ok: false, reason: 'no direction' };
  var style = gbStyle(inp);
  var exempt = inp.exemptMtf === true || String(inp.stratKey || '').toLowerCase() === 'sweep';
  if (exempt) return { ok: true, aligned: true, exempt: true };

  var rows4h = inp.rows4h || inp.rows;
  var rows1h = inp.rows1h;
  var rows1d = inp.rows1d;

  if (!rows4h || rows4h.length < 55){
    return { ok: true, aligned: null, note: 'MTF n/a — insufficient 4H' };
  }

  var e50 = gbEmaLast(rows4h, 50);
  var e200 = gbEmaLast(rows4h, 200);
  var s50 = gbEmaSlope(rows4h, 50, 3);
  var bull4h = fin(e50) && fin(e200) && e50 > e200 && fin(s50) && s50 >= 0;
  var bear4h = fin(e50) && fin(e200) && e50 < e200 && fin(s50) && s50 <= 0;

  if (style === 'gold-scalp' && rows1h && rows1h.length >= 30){
    var e21 = gbEmaLast(rows1h, 21);
    var s21 = gbEmaSlope(rows1h, 21, 3);
    if (dir === 'long' && fin(e21) && rows1h[rows1h.length - 1].c < e21 && fin(s21) && s21 < 0 && !bull4h){
      return { ok: false, aligned: false, reason: 'MTF: 1H below EMA21 falling — wait reclaim', demote: true };
    }
    if (dir === 'short' && fin(e21) && rows1h[rows1h.length - 1].c > e21 && fin(s21) && s21 > 0 && !bear4h){
      return { ok: false, aligned: false, reason: 'MTF: 1H above EMA21 rising — wait reject', demote: true };
    }
  }

  if (rows1d && rows1d.length >= 55 && style === 'gold-swing'){
    var d50 = gbEmaLast(rows1d, 50);
    var d200 = gbEmaLast(rows1d, 200);
    if (dir === 'long' && fin(d50) && fin(d200) && d50 < d200){
      return { ok: false, aligned: false, reason: 'MTF: 1D bear stack — swing long demoted', demote: true };
    }
    if (dir === 'short' && fin(d50) && fin(d200) && d50 > d200){
      return { ok: false, aligned: false, reason: 'MTF: 1D bull stack — swing short demoted', demote: true };
    }
  }

  var lastC = rows4h[rows4h.length - 1].c;
  var bearStack = bear4h || (fin(e50) && fin(e200) && e50 < e200 && fin(s50) && s50 <= 0);
  var bullStack = bull4h || (fin(e50) && fin(e200) && e50 > e200 && fin(s50) && s50 >= 0);

  if (dir === 'long' && fin(lastC) && fin(e200) && lastC < e200 && fin(s50) && s50 < 0 && !bullStack){
    return { ok: false, aligned: false, reason: 'MTF: price below 4H EMA200 falling — long demoted', demote: true };
  }
  if (dir === 'short' && fin(lastC) && fin(e200) && lastC > e200 && fin(s50) && s50 > 0 && !bearStack){
    return { ok: false, aligned: false, reason: 'MTF: price above 4H EMA200 rising — short demoted', demote: true };
  }

  if (dir === 'long' && bearStack){
    return { ok: false, aligned: false, reason: 'MTF: 4H bear stack vs long', demote: true };
  }
  if (dir === 'short' && bullStack){
    return { ok: false, aligned: false, reason: 'MTF: 4H bull stack vs short', demote: true };
  }

  return { ok: true, aligned: true, bull4h: bullStack, bear4h: bearStack };
}

/** Phase 3 — OB/FVG quality score 0–100 (EA_SCALPER-style freshness + displacement). */
function hgGoldPoiQuality(rows, dir, hit){
  hit = hit || {};
  dir = gbDir(dir);
  var out = { score: 55, label: 'baseline', poi: hit.stratKey || 'unknown' };
  if (!rows || rows.length < 10 || !dir) return out;

  try{
    var strat = String(hit.stratKey || '').toLowerCase();
    var n = rows.length - 1;
    var a = (typeof atr === 'function') ? atr(rows, 14) : null;
    var atrVal = a && a.length ? a[n] : NaN;

    if ((strat === 'ob' || strat === 'fvg') && typeof G.hgDetectOrderBlock === 'function' && strat === 'ob'){
      var ob = G.hgDetectOrderBlock(rows, dir);
      if (ob && fin(ob.idx)){
        var age = n - ob.idx;
        var fresh = Math.max(0, 35 - age * 2);
        var disp = 0;
        if (fin(atrVal) && ob.zone){
          var zspan = Math.abs(ob.zone.hi - ob.zone.lo);
          if (zspan >= atrVal * 0.4) disp = 15;
          else if (zspan >= atrVal * 0.2) disp = 8;
        }
        out.score = Math.min(100, 40 + fresh + disp);
        out.label = 'OB q' + out.score;
        out.poi = 'ob';
        return out;
      }
    }

    if ((strat === 'fvg' || strat === 'ob') && typeof G.hgDetectFvg === 'function' && strat === 'fvg'){
      var fvg = G.hgDetectFvg(rows, dir);
      if (fvg && fin(fvg.idx)){
        var ageF = n - fvg.idx;
        var freshF = Math.max(0, 30 - ageF * 2);
        var gap = fvg.zone ? Math.abs(fvg.zone.hi - fvg.zone.lo) : 0;
        var gapSc = (fin(atrVal) && gap >= atrVal * 0.25) ? 15 : 5;
        var fillPct = 0;
        if (fvg.zone && fin(rows[n].c)){
          var span = fvg.zone.hi - fvg.zone.lo;
          if (span > 0){
            if (dir === 'long'){
              fillPct = Math.max(0, Math.min(1, (fvg.zone.hi - rows[n].c) / span));
            } else {
              fillPct = Math.max(0, Math.min(1, (rows[n].c - fvg.zone.lo) / span));
            }
          }
        }
        var mitig = fillPct > 0.65 ? -12 : (fillPct < 0.35 ? 10 : 0);
        out.score = Math.min(100, 45 + freshF + gapSc + mitig);
        out.label = 'FVG q' + out.score + (fillPct > 0 ? ' fill' + Math.round(fillPct * 100) + '%' : '');
        out.poi = 'fvg';
        return out;
      }
    }

    if (strat === 'sweep') out.score = 72;
    else if (strat === 'vwap' || strat === 'vwapband') out.score = 62;
    else if (strat === 'ribbon') out.score = 58;

    out.label = strat + ' q' + out.score;
    return out;
  }catch(e){ return out; }
}

/** Phase 5 — apply calibrated min R:R to formation context. */
function hgGoldCalibrateCtx(ctx, regime, style){
  ctx = ctx || {};
  regime = regime || hgGoldRegime(ctx.rows, style);
  ctx.goldMinRr = gbMinRr(style, regime);
  ctx.goldRegime = regime.label;
  ctx.goldRegimeEr = regime.er;
  return ctx;
}

/**
 * Unified gold levels for one ranked candidate.
 * @param {Object} inp — { hit, dir, style, rows, rows15m, rows1h, rows4h, rows1d, atrW, rankBoost, vision, nowMs, skipShield, skipVision }
 */
function hgBestLevelsGold(inp){
  inp = inp || {};
  var out = { ok: false, reason: null, plan: null, formationScore: null, phase: GB_REF };
  try{
    var hit = inp.hit || inp.candidate || inp.gate && inp.gate.hit;
    if (!hit) return Object.assign(out, { reason: 'no candidate' });

    var dir = gbDir(inp.dir || hit.dir);
    if (!dir) return Object.assign(out, { reason: 'no direction' });

    var style = gbStyle(inp);
    var baseStyle = gbBaseStyle(style);
    var rows = inp.rows || inp.rows15m || inp.rows4h;
    if (!rows || !rows.length) return Object.assign(out, { reason: 'no rows' });

    var formRows = rows;
    if (style === 'gold-scalp' && inp.rows15m && inp.rows15m.length) formRows = inp.rows15m;
    if (style === 'gold-swing' && inp.rows4h && inp.rows4h.length) formRows = inp.rows4h;

    var regime = hgGoldRegime(formRows, style);
    var minRr = gbMinRr(style, regime);

    /* Phase 2 — MTF */
    var mtf = hgGoldMtfGate(dir, {
      style: style,
      stratKey: hit.stratKey,
      exemptMtf: hit.stratKey === 'sweep' || hit.stratKey === 'asian',
      rows4h: inp.rows4h,
      rows1h: inp.rows1h,
      rows1d: inp.rows1d,
    });
    if (mtf.demote && mtf.ok === false){
      return Object.assign(out, { reason: mtf.reason, mtf: mtf, demote: true });
    }

    /* Phase 4 — chop demote mean-reversion (unless breakout/sweep) */
    var sk = String(hit.stratKey || '').toLowerCase();
    if (regime.chop && (sk === 'vwap' || sk === 'ob' || sk === 'fvg' || sk === 'vwapband')){
      if (inp.hardChopGate === true){
        return Object.assign(out, { reason: 'regime CHOP — mean-reversion demoted', demote: true, regime: regime });
      }
    }

    /* Phase 1 — ShieldGuard */
    if (typeof G.hgShieldGuardVeto === 'function' && inp.skipShield !== true){
      var sg = G.hgShieldGuardVeto(formRows, dir, inp);
      if (sg && sg.veto){
        return Object.assign(out, { reason: sg.reason || 'ShieldGuard', veto: true, shield: sg });
      }
    }

    if (typeof G.hgFormTicket !== 'function'){
      return Object.assign(out, { reason: 'hgFormTicket missing' });
    }

    var mark = fin(+inp.mark) ? +inp.mark
      : (fin(+hit.pxNow) ? +hit.pxNow : (formRows.length ? +formRows[formRows.length - 1].c : +hit.entry));
    var atrW = fin(+inp.atrW) ? +inp.atrW : NaN;

    var ctx = hgGoldCalibrateCtx({
      rows: formRows,
      style: style,
      a4: atrW,
      m15: inp.rows15m,
      rows1h: inp.rows1h,
      rankBoost: inp.rankBoost,
      goldMinRr: minRr,
    }, regime, style);

    var gHit = Object.assign({}, hit, {
      mark: mark,
      structStop: hit.structStop || hit.anchor,
      dir: dir,
    });

    var gfm = G.hgFormTicket(gHit, ctx);
    if (!gfm || !gfm.ok || !gfm.hit){
      return Object.assign(out, { reason: (gfm && gfm.reason) || 'formation', tag: gfm && gfm.tag });
    }

    var plan = gfm.hit;
    if (!gbValidPlan(plan, minRr)){
      return Object.assign(out, { reason: 'min R:R ' + minRr + ' not met after formation' });
    }

    /* Phase 3 — POI quality boost */
    var pq = hgGoldPoiQuality(formRows, dir, hit);
    plan.poiQuality = pq.score;
    plan.poiQualityLabel = pq.label;
    var fs = fin(+gfm.formationScore) ? +gfm.formationScore : 0;
    if (pq.score >= 75) fs += 10;
    else if (pq.score >= 60) fs += 5;
    else if (pq.score < 45) fs -= 6;

    /* Phase 4 — session boost */
    fs += hgGoldSessionBoost(inp.nowMs, hit.stratKey);
    if (mtf.aligned === true) fs += 4;
    plan.formationScore = Math.round(fs);

    /* Phase 3 — Freqtrade edge (soft) */
    if (typeof G.hgBestLevelsEdgeGate === 'function'){
      plan = G.hgBestLevelsEdgeGate(plan, Object.assign({}, inp, { ftEdgeGate: inp.ftEdgeGate }));
      if (!plan) return Object.assign(out, { reason: 'freqtrade edge gate' });
    }

    /* Phase 6 — chart vision veto */
    if (typeof G.hgBestLevelsVisionVeto === 'function'){
      plan = G.hgBestLevelsVisionVeto(plan, inp);
    }

    plan.planSrc = (plan.planSrc || 'gold formation') + ' · ' + GB_REF;
    plan.goldRegime = regime.label;
    plan.goldMinRr = minRr;
    plan.mtfNote = mtf.note || (mtf.aligned ? 'MTF aligned' : null);

    return {
      ok: true,
      plan: plan,
      formationScore: plan.formationScore,
      poiQuality: pq,
      regime: regime,
      mtf: mtf,
      phase: GB_REF,
    };
  }catch(e){
    return Object.assign(out, { reason: (e && e.message) || String(e) });
  }
}

/* A derived number must never outlive the inputs it was derived from.

   hgApplyGoldBestLevels replaces entry/stop/targets in place, then recomputed
   R:R only where every guard happened to hold. Where one did not — risk of
   zero, a target the new plan did not supply, a non-finite level — the OLD
   rr/rr2/rr3 stayed attached to the NEW levels. A card then showed an entry, a
   stop, a target, and an R:R that was not the ratio between them. This is the
   second time a stale R:R has reached a card, so it is now impossible by
   construction: every leg is recomputed from the levels actually on the
   candidate, and any leg that cannot be computed is CLEARED, never carried. */
function gbNum(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }

function hgSyncPlanRr(c){
  if (!c) return c;
  try{
    var entry = gbNum(c.entry), stop = gbNum(c.stop);
    var risk = (fin(entry) && fin(stop)) ? Math.abs(entry - stop) : NaN;
    var usable = fin(risk) && risk > 0;
    var legs = [['t1', 'rr'], ['t2', 'rr2'], ['t3', 'rr3']];
    var cleared = [], i, tgt, key;
    for (i = 0; i < legs.length; i++){
      tgt = gbNum(c[legs[i][0]]); key = legs[i][1];
      if (usable && fin(tgt)){
        c[key] = Math.abs(tgt - entry) / risk;
      } else {
        if (c[key] !== null && c[key] !== undefined) cleared.push(key.toUpperCase());
        c[key] = null;
      }
    }
    if (!usable){
      c.rrNote = 'R:R unavailable — entry and stop do not define a risk distance';
    } else if (cleared.length){
      c.rrNote = cleared.join(' / ') + ' cleared — no target at these levels';
    } else {
      c.rrNote = null;
    }
  }catch(e){}
  return c;
}

/** Apply unified gold levels onto a scan candidate (mutates gc). */
/** Recompute structural R:R tally leg after hgApplyGoldBestLevels mutates rr. */
function hgGoldRefreshTallyRr(c){
  if (!c || !Array.isArray(c.tallyParts)) return c;
  try{
    var rrVal = fin(gbNum(c.rr)) ? gbNum(c.rr) : gbNum(c.rr1);
    var rrPts = (fin(rrVal) && rrVal >= 2) ? (rrVal >= 2.5 ? 2 : 1) : 0;
    var found = false, i, p, oldPts;
    for (i = 0; i < c.tallyParts.length; i++){
      p = c.tallyParts[i];
      if (!p || !/structural R:R/.test(String(p.label || ''))) continue;
      found = true;
      oldPts = fin(+p.pts) ? +p.pts : 0;
      c.tally = (fin(+c.tally) ? +c.tally : 0) - oldPts + rrPts;
      p.pts = rrPts;
      if (fin(rrVal)){
        p.label = 'structural R:R ' + rrVal.toFixed(1) + 'R — reward/risk geometry';
      }
      break;
    }
    if (!found && rrPts > 0 && fin(rrVal)){
      c.tallyParts.push({ label: 'structural R:R ' + rrVal.toFixed(1) + 'R — reward/risk geometry', pts: rrPts });
      c.tally = (fin(+c.tally) ? +c.tally : 0) + rrPts;
    }
  }catch(e){}
  return c;
}

/** Grade from confluence score — same thresholds as goldind __gsCand (A≥8, B≥5). */
function hgGoldGradeFromScore(score, newsCaution){
  var s = fin(+score) ? +score : 0;
  var grade = (s >= 8) ? 'A' : ((s >= 5) ? 'B' : 'C');
  if (newsCaution){
    if (grade === 'A') grade = 'B';
    else if (grade === 'B') grade = 'C';
  }
  return grade;
}

/** Sync displayed grade from tally (or structural reads + killzone when tally absent). */
function hgGoldSyncCandidateGrade(c){
  if (!c) return c;
  try{
    var score = fin(+c.tally) ? +c.tally
      : ((fin(+c.agree) ? +c.agree : 0) + (fin(+c.killzoneWeight) ? +c.killzoneWeight : 0));
    c.grade = hgGoldGradeFromScore(score, !!(c.newsCaution));
  }catch(e){}
  return c;
}

/** HTF alignment + ER for A+ / scorecard (never throws). */
function hgGoldAnnotateCandidateMeta(c, inp){
  inp = inp || {};
  if (!c || (c.dir !== 'long' && c.dir !== 'short')) return c;
  try{
    var style = gbStyle(inp);
    if (typeof hgGoldMtfGate === 'function'){
      var mtf = hgGoldMtfGate(c.dir, {
        style: style,
        stratKey: c.stratKey,
        exemptMtf: c.stratKey === 'sweep' || c.stratKey === 'asian',
        rows4h: inp.rows4h,
        rows1h: inp.rows1h,
        rows1d: inp.rows1d,
      });
      if (mtf && mtf.aligned === true) c.htfAlign = true;
      else if (mtf && mtf.aligned === false) c.htfAlign = false;
    }
    if (!fin(+c.barAge) && fin(+c.barsAgo)) c.barAge = +c.barsAgo;
    if (!fin(+c.barAge) && fin(+c.triggerBarsAgo)) c.barAge = +c.triggerBarsAgo;
    var formRows = (style === 'gold-swing' && inp.rows4h && inp.rows4h.length) ? inp.rows4h
      : ((inp.rows15m && inp.rows15m.length) ? inp.rows15m : inp.rows);
    if (formRows && formRows.length >= 25 && typeof kaufmanER === 'function'){
      var er = kaufmanER(formRows, 20);
      if (fin(er)) c.er = er;
    }
  }catch(e){}
  return c;
}

function hgGoldPostApplyRefresh(c, metaInp){
  if (!c) return c;
  /* Before anything reads c.rr — the tally leg does — make sure it matches the
     levels currently on the candidate rather than the ones it was built from. */
  hgSyncPlanRr(c);
  hgGoldRefreshTallyRr(c);
  hgGoldSyncCandidateGrade(c);
  hgGoldAnnotateCandidateMeta(c, metaInp);
  return c;
}

function hgApplyGoldBestLevels(gc, inp){
  inp = inp || {};
  if (!gc || gc.vetoed) return gc;
  try{
    var bl = hgBestLevelsGold(Object.assign({ hit: gc, dir: gc.dir }, inp));
    if (bl.veto){
      gc.vetoed = true;
      gc.vetoReason = bl.reason;
      return gc;
    }
    if (bl.demote || !bl.ok){
      gc.demoted = true;
      gc.demoteReason = bl.reason || 'gold best-levels';
      if (bl.mtf) gc.mtfNote = bl.mtf.reason;
      return gc;
    }
    var plan = bl.plan;
    if (!plan) return gc;

    gc.formationScore = bl.formationScore;
    gc.entryType = plan.entryType;
    gc.entryGuidance = plan.entryGuidance;
    gc.fillProb = plan.fillProb;
    gc.fillNote = plan.fillNote;
    gc.planSrc = plan.planSrc;
    gc.poiQuality = plan.poiQuality;
    gc.poiQualityLabel = plan.poiQualityLabel;
    gc.goldRegime = plan.goldRegime;
    gc.goldMinRr = plan.goldMinRr;
    gc.mtfNote = plan.mtfNote;
    if (plan.visionVetoed){
      gc.demoted = true;
      gc.demoteReason = plan.demoteReason || 'vision veto';
      gc.visionChip = plan.visionChip;
    }

    if (!gc.locked){
      if (fin(plan.entry)) gc.entry = plan.entry;
      if (fin(plan.stop)) gc.stop = plan.stop;
      if (fin(plan.t1)) gc.t1 = plan.t1;
      if (fin(plan.t2)) gc.t2 = plan.t2;
      if (fin(plan.t3)) gc.t3 = plan.t3;
    }

    hgSyncPlanRr(gc);
    return gc;
  }catch(e){ return gc; }
}

G.gbValidPlan = gbValidPlan;   /* pure predicate — exported so the min-R:R floor is testable, not asserted by regex */
G.hgBestLevelsGold = hgBestLevelsGold;
G.hgApplyGoldBestLevels = hgApplyGoldBestLevels;
G.hgGoldMtfGate = hgGoldMtfGate;
G.hgGoldPoiQuality = hgGoldPoiQuality;
G.hgGoldRegime = hgGoldRegime;
G.hgGoldSessionBoost = hgGoldSessionBoost;
G.hgGoldCalibrateCtx = hgGoldCalibrateCtx;
G.HG_GOLD_BEST_LEVELS_REF = GB_REF;
G.HG_GOLD_SCALP_MIN_RR = HG_GOLD_SCALP_MIN_RR;
G.HG_GOLD_SWING_MIN_RR = HG_GOLD_SWING_MIN_RR;
G.hgGoldGradeFromScore = hgGoldGradeFromScore;
G.hgGoldSyncCandidateGrade = hgGoldSyncCandidateGrade;
G.hgGoldRefreshTallyRr = hgGoldRefreshTallyRr;
G.hgSyncPlanRr = hgSyncPlanRr;
G.hgGoldAnnotateCandidateMeta = hgGoldAnnotateCandidateMeta;
G.hgGoldPostApplyRefresh = hgGoldPostApplyRefresh;

})();
