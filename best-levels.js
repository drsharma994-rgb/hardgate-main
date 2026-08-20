/* HARDGATE — unified best entry / SL / TP engine for all crypto tabs.
   Phases: 1 formation pipeline · 2 ShieldGuard · 3 Freqtrade edge gate · 4 vision veto.
   Loaded after formation.js + freqtrade-formation.js. Never throws. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var BL_REF = 'hgFormTicket + opencrypto structure + freqtrade edge + chart vision veto';

function fin(v){ return typeof v === 'number' && isFinite(v); }

function blDir(inp){
  var dir = (inp && typeof inp.dir === 'string') ? inp.dir.toLowerCase() : null;
  return (dir === 'long' || dir === 'short') ? dir : null;
}

function blMinRr(style){
  style = String(style || 'swing').toLowerCase();
  if (style.indexOf('scalp') >= 0){
    return (typeof G.CG_SCALP_RR_MIN === 'number') ? G.CG_SCALP_RR_MIN : 2.25;
  }
  return (typeof G.CG_SWING_RR_MIN === 'number') ? G.CG_SWING_RR_MIN : 2.0;
}

function blValidPlan(plan, style){
  if (!plan) return false;
  /* fin() here is the file's own strict helper, but +plan.entry would coerce
     a null to 0 before it ever reached the test. */
  var entry = (plan.entry === null || plan.entry === undefined || plan.entry === '') ? NaN : +plan.entry;
  var stop = (plan.stop === null || plan.stop === undefined || plan.stop === '') ? NaN : +plan.stop;
  var t1 = (plan.t1 === null || plan.t1 === undefined || plan.t1 === '') ? NaN : +plan.t1;
  if (!fin(entry) || entry <= 0 || !fin(stop) || !fin(t1)) return false;
  var risk = Math.abs(entry - stop);
  if (!(risk > 0)) return false;
  /* Derived, never read from plan.rr1. Preferring the plan's own rr1 let the
     minimum-R:R floor be cleared by a ratio measured against levels the plan
     no longer had — the gate testing a stored number instead of the trade. */
  var rr = Math.abs(t1 - entry) / risk;
  return fin(rr) && rr >= blMinRr(style) - 1e-9;
}

function blTicker(inp, rows){
  inp = inp || {};
  var mark = fin(+inp.mark) ? +inp.mark
    : (rows && rows.length ? +rows[rows.length - 1].c : null);
  return {
    symbol: inp.sym || inp.symbol,
    fundingPct: inp.fundingPct != null ? inp.fundingPct : (inp.tick && inp.tick.fundingPct),
    mark: mark,
  };
}

function blTryFormTicket(hit, ctx){
  if (!hit || typeof G.hgFormTicket !== 'function') return null;
  try{
    var fm = G.hgFormTicket(hit, ctx);
    if (fm && fm.ok && fm.hit && blValidPlan(fm.hit, ctx.style)){
      return { plan: fm.hit, formationScore: fm.formationScore };
    }
  }catch(e){}
  return null;
}

function blTryCleanPlan(rows, ticker, dir, style){
  if (style === 'scalp'){
    if (typeof G.scalpTryClean === 'function'){
      try{
        var sc = G.scalpTryClean(rows, ticker);
        if (sc && sc.dir === dir && blValidPlan(sc, style)) return sc;
      }catch(e){}
    }
    return null;
  }
  if (typeof G.hgSwingCleanPlan === 'function'){
    try{
      var sw = G.hgSwingCleanPlan(rows, ticker, dir);
      if (blValidPlan(sw, style)) return sw;
    }catch(e){}
  }
  return null;
}

function blTryPlanLevels(dir, rows, style, typeTag){
  if (typeof G.hgPlanLevelsCore !== 'function') return null;
  try{
    var stopOpts = (typeof G.hgStructureStopOpts === 'function') ? G.hgStructureStopOpts() : { look: 20 };
    var pl = G.hgPlanLevelsCore(dir, rows, null, {
      minRr: blMinRr(style),
      style: style,
      type: typeTag || 'BEST',
      look: stopOpts.look,
    });
    if (blValidPlan(pl, style)) return pl;
  }catch(e){}
  return null;
}

function blTrySmartFade(inp, dir, rows, rows1h){
  if (inp.allowFade !== true || typeof G.smartSetup !== 'function') return null;
  try{
    var cls = inp.cls || {};
    var s = G.smartSetup(Object.assign({ dir: dir }, cls), rows, rows1h);
    if (s && s.type === 'FADE' && blValidPlan(s, 'fade')) return s;
  }catch(e){}
  return null;
}

/** Phase 3 — Freqtrade edge expectancy gate (soft by default). */
function hgBestLevelsEdgeGate(plan, inp){
  inp = inp || {};
  if (!plan) return plan;
  try{
    if (inp.skipEdgeGate === true || inp.ftEdgeGate === false) return plan;
    var hard = inp.ftEdgeGate === true;
    var minExp = fin(+inp.ftMinExpectancy) ? +inp.ftMinExpectancy : 0;
    var minN = fin(+inp.ftMinTrades) ? +inp.ftMinTrades : 6;
    var sym = String(plan.sym || plan.symbol || inp.sym || '').toUpperCase();
    if (!sym || typeof G.ftEdgeTableFromRecords !== 'function') return plan;

    var recs = (typeof G.hgScoreRecords === 'function') ? G.hgScoreRecords() : [];
    var tbl = G.ftEdgeTableFromRecords(recs, function(r){
      return String(r.sym || r.symbol || sym).toUpperCase();
    });
    var row = tbl.lookup(sym);
    plan.ftExpectancy = row && row.expectancy != null ? row.expectancy : null;
    plan.ftWinRate = row && row.winRate != null ? row.winRate : null;

    if (!row || !row.n || row.n < minN) return plan;
    var exp = row.expectancy;
    if (exp !== 'inf' && exp !== null && exp < minExp){
      if (hard){
        return null;
      }
      plan.edgeWarn = 'ft-expectancy ' + exp + ' < ' + minExp;
      plan.formationScore = fin(+plan.formationScore) ? Math.max(0, +plan.formationScore - 8) : plan.formationScore;
    } else if (exp === 'inf' || (exp !== null && exp >= 0.25)){
      plan.edgeOk = true;
    }
    return plan;
  }catch(e){ return plan; }
}

/** Phase 4 — chart vision veto only (never mutates entry/stop/t1). */
function hgBestLevelsVisionVeto(plan, inp){
  inp = inp || {};
  if (!plan || inp.skipVision === true) return plan;
  try{
    var vision = inp.vision || plan.vision;
    if (!vision) return plan;
    if (vision.veto === true){
      plan.visionVetoed = true;
      plan.demoted = true;
      plan.demoteReason = vision.note || 'chart vision conflict';
      plan.visionChip = (plan.visionChip ? plan.visionChip + ' · ' : '') + 'VISION VETO';
    } else if (typeof G.hgChartVisionFormationBoost === 'function'){
      var boost = G.hgChartVisionFormationBoost(plan.dir, vision);
      if (boost && fin(+plan.formationScore)) plan.formationScore = Math.round(+plan.formationScore + boost);
    }
    return plan;
  }catch(e){ return plan; }
}

/**
 * Unified levels: POI entry → structure stop → structure TP → edge gate → vision veto.
 * @param {Object} inp — { dir, rows4h|rows, rows1h, rows15m, style, gate, sym, ticker, cls, allowFade, vision, tab }
 */
function hgBestLevels(inp){
  inp = inp || {};
  var out = { ok: false, reason: null, plan: null, gate: inp.gate || null, formationScore: null, phase: BL_REF };
  try{
    var dir = blDir(inp);
    if (!dir) return Object.assign(out, { reason: 'no direction' });

    var rows = inp.rows4h || inp.rows;
    if (!Array.isArray(rows) || !rows.length) return Object.assign(out, { reason: 'no rows' });

    var style = String(inp.style || inp.tab || 'swing').toLowerCase();
    var baseStyle = style.indexOf('scalp') >= 0 ? 'scalp' : 'swing';
    var ticker = inp.ticker || blTicker(inp, rows);
    var gate = inp.gate || null;
    var plan = null;
    var formationScore = null;

    /* Phase 2 — ShieldGuard */
    if (typeof G.hgShieldGuardVeto === 'function'){
      var sg = G.hgShieldGuardVeto(rows, dir, inp);
      if (sg && sg.veto){
        return Object.assign(out, { ok: false, reason: sg.reason, veto: true, shield: sg });
      }
    }

    /* Phase 1a — gate hit + hgFormTicket */
    if (gate && gate.hit && !gate.veto){
      var ctx = {
        rows: rows,
        style: baseStyle,
        a4: gate.hit.a4,
        rows1h: inp.rows1h,
        m15: inp.rows15m || inp.m15,
        ticker: ticker,
      };
      var formed = blTryFormTicket(gate.hit, ctx);
      if (formed){
        plan = formed.plan;
        formationScore = formed.formationScore;
      }
    }

    /* Phase 1b — try clean gate hit if no gate passed in */
    if (!plan && baseStyle === 'swing' && typeof G.swingTryClean === 'function'){
      try{
        var clean = G.swingTryClean(rows, ticker);
        if (clean && clean.dir === dir){
          gate = gate || { hit: clean, clean7: true, gatesPassed: clean.passed || 7, label: '7/7 CLEAN' };
          var f1 = blTryFormTicket(clean, { rows: rows, style: 'swing', a4: clean.a4, rows1h: inp.rows1h, ticker: ticker });
          if (f1){ plan = f1.plan; formationScore = f1.formationScore; }
        }
      }catch(e){}
    }

    if (!plan && baseStyle === 'scalp' && typeof G.scalpTryClean === 'function' && inp.rows15m){
      try{
        var sclean = G.scalpTryClean(inp.rows1h || rows, inp.rows15m, ticker);
        if (sclean && sclean.dir === dir){
          gate = gate || { hit: sclean, clean7: true, gatesPassed: sclean.passed || 7 };
          var f2 = blTryFormTicket(sclean, { rows: inp.rows15m, style: 'scalp', a4: sclean.a4, m15: inp.rows15m, ticker: ticker });
          if (f2){ plan = f2.plan; formationScore = f2.formationScore; }
        }
      }catch(e){}
    }

    /* Phase 1c — clean plan helpers */
    if (!plan){
      var cp = blTryCleanPlan(rows, ticker, dir, baseStyle);
      if (cp) plan = cp;
    }

    /* Phase 1d — hgPlanLevelsCore with unified lookback */
    if (!plan){
      plan = blTryPlanLevels(dir, rows, baseStyle, String(inp.tab || style).toUpperCase());
    }

    /* FADE-only smartSetup branch */
    if (!plan){
      plan = blTrySmartFade(inp, dir, rows, inp.rows1h);
    }

    if (!plan || !blValidPlan(plan, baseStyle)){
      return Object.assign(out, { reason: 'levels unavailable', gate: gate });
    }

    if (!plan.planSrc) plan.planSrc = 'hgBestLevels';
    if (formationScore != null) plan.formationScore = formationScore;

    if (typeof G.hgApplyExactEntry === 'function' && inp.skipExact !== true){
      try{
        var ex = G.hgApplyExactEntry(plan, rows, {
          rows1h: inp.rows1h,
          rows15m: inp.rows15m,
          style: baseStyle,
          preferEdge: inp.preferEdge !== false,
        });
        if (ex && blValidPlan(ex, baseStyle)) plan = ex;
      }catch(eEx){}
    }

    /* Phase 3 */
    plan = hgBestLevelsEdgeGate(plan, inp);
    if (!plan) return Object.assign(out, { reason: 'freqtrade edge gate', gate: gate });

    /* Phase 3b — the shared indicator context. SQUEEZE, TRENDTABLE and
       OI FLOW all route their plans through here and none of them reads a
       single one of the 14 shared context gates (OI FLOW reads essentially
       no price indicator at all — its whole quality grade was one EMA20/50
       test). One call here gives all of them the same read the two ledger
       desks get. Info first: the ledger and counts ride on the plan for any
       card to show. Policy second, and mild: an outright ADVERSE MAJORITY
       (more evaluated gates against the direction than with it) shaves the
       formation score by the same 8 points a failing walk-forward edge
       already costs — a demotion in rank, never a veto. hgContextRead
       enforces closed bars itself, so the forming-candle feeds these desks
       pass in cannot repaint the verdicts. */
    if (typeof G.hgContextRead === 'function'){
      var cxKind = (gate && gate.hit && (gate.hit.kind || gate.hit.stratKey)) || baseStyle;
      var cx = G.hgContextRead(rows, dir, cxKind, inp.allowFade === true);
      if (cx){
        plan.contextGates = cx.gates;
        plan.contextRead = cx.read;
        /* objections, not majorities: half of these gates are
       permissive location reads ("do not chase the extreme") that rarely
       object, so a with/against majority never fires even on a short into
       a rally — measured: 5 against / 9 with. pass=true means NO OBJECTION,
       pass=false is an objection; five objections is a third of the panel
       shouting. */
        if (cx.againstN >= 5){
          plan.contextWarn = true;
          plan.formationScore = (fin(plan.formationScore) ? plan.formationScore
                                : (fin(formationScore) ? formationScore : 0)) - 8;
        }
      }
    }

    /* Phase 4 */
    plan = hgBestLevelsVisionVeto(plan, inp);

    if (plan.demoted && inp.rejectVisionVeto === true){
      return Object.assign(out, { reason: plan.demoteReason || 'vision veto', gate: gate, plan: plan, veto: true });
    }

    return {
      ok: true,
      plan: plan,
      formationScore: plan.formationScore != null ? plan.formationScore : formationScore,
      gate: gate,
      phase: BL_REF,
    };
  }catch(e){
    return Object.assign(out, { reason: (e && e.message) || String(e) });
  }
}

G.blValidPlan = blValidPlan;   /* pure predicate — exported so the min-R:R floor is testable, not asserted by regex */
G.hgBestLevels = hgBestLevels;
G.hgBestLevelsEdgeGate = hgBestLevelsEdgeGate;
G.hgBestLevelsVisionVeto = hgBestLevelsVisionVeto;
G.HG_BEST_LEVELS_REF = BL_REF;

})();
