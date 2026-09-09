/* =============================================================================
   hg-solidity.js — Shared "best setup" solidity gate for omniroute, omnigold,
   reversalsniper (v682).

   The problem this closes.

   Every tab this session has been given better inputs (v664/v671 measured
   edge, v670 forming-bar, v677 freshness, v678 HTF tape, v679 live-price,
   v680 forward-resolve, v681 stop floor), but each tab still ranks with its
   own weighted sum and takes the top row as the LEAD / BEST / MOST PROBABLE
   card. Nothing enforces that the top card meets a MINIMUM QUALITY BAR. A
   plan can lead its tab with a passable rr and a decent tape and no
   confluence quality, no live-price freshness, and a stop that had to be
   widened up to the v681 floor to survive the geometry check.

   This helper defines "SOLID" concretely across ALL three tabs, so the same
   setup gets the same grade regardless of which tab surfaced it. Each tab
   still keeps its own ranker; solidity is applied AFTER ranking and can
   demote a top row that fails the bar so the lead slot only ever shows a
   setup that clears the shared minimum.

   The gate is FIVE independent checks. Each pass adds 1 point. Grades:

     SOLID       = 5/5   (all five gates)
     GOOD        = 4/5   (any four)
     MIXED       = 3/5
     THIN        = 2/5
     WEAK        = 0-1/5

   Only SOLID or GOOD may occupy a tab's LEAD slot. MIXED still displays but
   with a chip. THIN / WEAK are shown last and chipped so the user reads the
   honest state.

   The five gates.

     G1 CONFLUENCE — at least 2 independent mechanic families point the same
                     way (family-consensus nAgree >= 2). Reads plan.consensus
                     or plan.familiesAgree.

     G2 LIVE-FRESH — hgLivePriceGrade returns fresh or pending (deltaN >= 0).
                     Rejects past-entry / past-t1 / past-stop cards.

     G3 TAPE       — dir agrees with the higher-timeframe tape, OR tape is
                     neutral. Rejects tape-adverse cards.

     G4 RR-CLEAN   — rr1 >= tab's minRr with headroom (rr1 >= minRr + 0.25).
                     A plan that BARELY clears the R:R floor is not solid;
                     small execution slippage kills it.

     G5 STOP-CLEAN — stop was NOT widened by the v681 ATR floor. If the
                     detector had to have its stop widened to meet 0.5*ATR,
                     the original geometry was marginal. This gate rewards
                     detectors that emitted a genuine structural stop with
                     enough natural room.

   Every gate is fed data the tabs already stamp on their cards. This file
   introduces NO new scans, NO new API calls, NO ranker changes.

   Loaded via <script> before omniroute / omnigold / reversalsniper. Exposes
   on window / globalThis so all three tabs can call it.
   ========================================================================= */
(function(){
  'use strict';
  var G = (typeof window !== 'undefined') ? window : globalThis;

  /* --- gate constants --------------------------------------------------- */
  var HG_SOL_MIN_FAMILIES = 2;
  var HG_SOL_RR_HEADROOM = 0.25;
  /* v685 measured-edge veto: sample-count threshold and expR floor. Below
     20 recorded outcomes the sample is noise — do not penalize. At >= 20
     samples, expR < -0.25 means measured losing after all noise: the veto
     fires and G6 is marked failed. Choice of thresholds is deliberate:
     20 is the smallest N where the standard error of an even-money hit
     rate is <= 0.1, and -0.25R is the smallest expectancy loss that
     survives typical fee/slip modelling in the forward log. */
  var HG_SOL_MIN_EDGE_SAMPLES = 20;
  var HG_SOL_EDGE_FLOOR = -0.25;

  /* v685: labels re-scaled to a 6-point gate system. Only 6/6 is SOLID;
     5/6 is GOOD; both remain lead-eligible. Mid grades tightened so a
     card with a measured-losing kind cannot lead just because its other
     five gates happen to line up. */
  var HG_SOL_LABELS = {
    6: 'SOLID',
    5: 'GOOD',
    4: 'MIXED',
    3: 'MIXED',
    2: 'THIN',
    1: 'WEAK',
    0: 'WEAK'
  };
  var HG_SOL_LEAD_MIN = 5; /* v685: score >= 5 leads (was 4 pre-v685) */

  function _fin(x){ x = +x; return isFinite(x) ? x : NaN; }

  /* --- individual gates ------------------------------------------------- */

  /* G1: at least MIN_FAMILIES independent mechanic families agree with dir.
     Reads (in order): plan.consensus.nAgree, plan.familiesAgree,
     plan.confluenceCount, plan.alsoKinds.length. Returns
     { pass: bool, n: int, source: string }. */
  function hgSolGateFamilies(plan){
    if (!plan || typeof plan !== 'object') return { pass: false, n: 0, source: 'none' };
    var cons = plan.consensus || {};
    if (isFinite(_fin(cons.nAgree))){
      var n1 = _fin(cons.nAgree);
      return { pass: n1 >= HG_SOL_MIN_FAMILIES, n: n1, source: 'consensus.nAgree' };
    }
    if (isFinite(_fin(plan.familiesAgree))){
      var n2 = _fin(plan.familiesAgree);
      return { pass: n2 >= HG_SOL_MIN_FAMILIES, n: n2, source: 'familiesAgree' };
    }
    if (isFinite(_fin(plan.confluenceCount))){
      var n3 = _fin(plan.confluenceCount);
      return { pass: n3 >= HG_SOL_MIN_FAMILIES, n: n3, source: 'confluenceCount' };
    }
    if (Array.isArray(plan.alsoKinds)){
      var n4 = plan.alsoKinds.length;
      return { pass: n4 >= HG_SOL_MIN_FAMILIES, n: n4, source: 'alsoKinds' };
    }
    return { pass: false, n: 0, source: 'none' };
  }

  /* G2: live-price grade is fresh or pending (delta >= 0). Fresh = +1.0,
     pending = +0.5. Past-entry = -0.5, past-t1 = -1.0, past-stop = -1.5.
     Reads plan.liveGrade if pre-stamped, else attempts to compute via the
     ranker helper if livePx is present, else returns unknown pass=false. */
  function hgSolGateLiveFresh(plan){
    if (!plan || typeof plan !== 'object') return { pass: false, grade: 'unknown' };
    if (plan.liveGrade){
      var okGrades = { 'fresh': true, 'pending': true };
      return { pass: !!okGrades[String(plan.liveGrade).toLowerCase()], grade: plan.liveGrade };
    }
    /* Fallback: derive from livePx + plan levels if the grader is present */
    if (typeof G.hgLivePriceGrade === 'function' && isFinite(_fin(plan.livePx))){
      try {
        var dir = String(plan.dir || '').toLowerCase();
        var lp = G.hgLivePriceGrade(dir, plan.entry, plan.stop, plan.t1, plan.t2, _fin(plan.livePx));
        if (lp && lp.grade){
          var ok2 = { 'fresh': true, 'pending': true };
          return { pass: !!ok2[String(lp.grade).toLowerCase()], grade: lp.grade };
        }
      } catch(e){}
    }
    /* Absent grade means we cannot confirm freshness; NOT a fail, just neutral.
       Return pass=true if livePx is absent (no live data), pass=false if
       livePx exists but the helper could not classify. This preserves rsniper
       cards that don't stamp livePx from being unfairly demoted. */
    if (!isFinite(_fin(plan.livePx))) return { pass: true, grade: 'no-live' };
    return { pass: false, grade: 'unknown' };
  }

  /* G3: tape agrees or is neutral. Reads plan.tape (string 'long'/'short'/
     'neutral'/'mixed'), plan.strategyConfirm ('CLEAN'/'MIXED'/'ADVERSE'),
     or plan.tapeDir. Returns pass=false only when we KNOW the tape is
     adverse to plan.dir. */
  function hgSolGateTape(plan){
    if (!plan || typeof plan !== 'object') return { pass: true, tape: 'unknown' };
    var dir = String(plan.dir || '').toLowerCase();
    var tape = String(plan.tape || plan.tapeDir || '').toLowerCase();
    if (tape === 'long' || tape === 'short'){
      return { pass: dir === tape, tape: tape };
    }
    /* Fallback: strategyConfirm */
    var sc = String(plan.strategyConfirm || '').toUpperCase();
    if (sc === 'ADVERSE') return { pass: false, tape: 'adverse' };
    if (sc === 'CLEAN' || sc === 'MIXED') return { pass: true, tape: sc.toLowerCase() };
    /* No tape signal: not a fail. */
    return { pass: true, tape: 'unknown' };
  }

  /* G4: rr1 clears minRr with headroom. Reads plan.rr1 and plan.minRr (or
     opts.minRr fallback). */
  function hgSolGateRr(plan, opts){
    opts = opts || {};
    if (!plan || typeof plan !== 'object') return { pass: false, rr: 0, floor: 0 };
    var rr = _fin(plan.rr1);
    if (!isFinite(rr) || rr <= 0) return { pass: false, rr: 0, floor: 0 };
    var floor = _fin(plan.minRr);
    if (!isFinite(floor)) floor = _fin(opts.minRr);
    if (!isFinite(floor)) floor = 2.0;
    return { pass: rr >= floor + HG_SOL_RR_HEADROOM, rr: rr, floor: floor };
  }

  /* G5: stop was not widened by the v681 ATR floor. plan.stopWidened is set
     by hgPlanFromRisk when it had to widen the caller's stop to reach the
     0.5*ATR floor. A widened stop means the detector's original geometry
     was marginal — solid setups have natural structural room. Absent flag
     means either (a) plan came from a pre-v681 codepath that never widens,
     or (b) it came from a v681 path and did not widen: BOTH are pass. */
  function hgSolGateStop(plan){
    if (!plan || typeof plan !== 'object') return { pass: false, widened: null };
    return { pass: plan.stopWidened !== true, widened: plan.stopWidened === true };
  }

  /* G6 (v685): MEASURED-EDGE veto. Reads the forward log's expectancy for
     this (tab, kind) pair. If we have enough samples and the measured expR
     is meaningfully negative, this gate FAILS. That drops the total score
     by 1, which flips a would-be GOOD lead into MIXED and pushes it out of
     the lead slot without hiding the card.

     Absent data means pass=true — unmeasured setups are innocent until
     proven guilty. Only setups the log has ACTUALLY MEASURED as losing
     get penalized. Feature-checked: forward log missing (test harness,
     load failure) always passes.

     opts.tab and opts.kind identify the (scanner, mechanic) pair to look
     up. Both tabs must pass them; if missing, gate passes without lookup
     to preserve backward compatibility with pre-v685 callers. */
  function hgSolGateMeasuredEdge(plan, opts){
    opts = opts || {};
    if (!opts.tab || !opts.kind) return { pass: true, source: 'no-lookup' };
    var W = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : G);
    if (!W || typeof W.hgFwdStats !== 'function') return { pass: true, source: 'no-fwdlog' };
    var stats = null;
    try { stats = W.hgFwdStats(String(opts.tab), String(opts.kind), false); }
    catch(eF){ return { pass: true, source: 'fwdlog-error' }; }
    if (!stats || !isFinite(stats.samples) || stats.samples < HG_SOL_MIN_EDGE_SAMPLES){
      return { pass: true, source: 'too-few-samples', samples: stats && stats.samples || 0, expR: stats && stats.expR };
    }
    var expR = _fin(stats.expR);
    /* Not-a-number expR with samples present means every settled trade
       lost 1R (hgFwdStats sets expR = -1 when wins=0) or a data glitch;
       treat the -1 case as an explicit veto. NaN with samples is a data
       shape we do not want to penalize on. */
    if (!isFinite(expR)) return { pass: true, source: 'expR-nan', samples: stats.samples, expR: NaN };
    var pass = expR >= HG_SOL_EDGE_FLOOR;
    return { pass: pass, source: 'measured', samples: stats.samples, expR: expR };
  }

  /* --- composite grade -------------------------------------------------- */

  /* Given a plan, return { grade, score, gates } where score is 0..6 (v685).
     This is the ONE call every tab makes. Adds no fields to plan; returns a
     fresh object the tab attaches (or doesn't) at its discretion.

     opts.minRr: the tab's minimum R:R floor (default 2.0).
     opts.tab, opts.kind: identifies (scanner, mechanic) pair for G6
       measured-edge lookup. If either is missing, G6 passes unconditionally.

     v685: G6 measured-edge veto added; only setups the forward log has
     ACTUALLY MEASURED as losing get penalized. Lead eligibility raised to
     score >= 5 so a card cannot lead while carrying a measured-losing kind. */
  function hgSolidityGrade(plan, opts){
    opts = opts || {};
    var g1 = hgSolGateFamilies(plan);
    var g2 = hgSolGateLiveFresh(plan);
    var g3 = hgSolGateTape(plan);
    var g4 = hgSolGateRr(plan, opts);
    var g5 = hgSolGateStop(plan);
    var g6 = hgSolGateMeasuredEdge(plan, opts);
    var score = (g1.pass ? 1 : 0) + (g2.pass ? 1 : 0) + (g3.pass ? 1 : 0)
              + (g4.pass ? 1 : 0) + (g5.pass ? 1 : 0) + (g6.pass ? 1 : 0);
    return {
      grade: HG_SOL_LABELS[score] || 'WEAK',
      score: score,
      gates: {
        families: g1,
        liveFresh: g2,
        tape: g3,
        rr: g4,
        stop: g5,
        measuredEdge: g6
      },
      /* leadEligible: only SOLID (6) or GOOD (5) may lead a tab. Threshold
         is HG_SOL_LEAD_MIN so the constant stays honest. */
      leadEligible: score >= HG_SOL_LEAD_MIN
    };
  }

  /* v684: per-gate reason string for the chip tooltip. Turns the chip from
     decorative into diagnostic — a trader can hover a MIXED chip and see
     which specific gates failed (adverse tape? past-stop? widened stop?),
     rather than just a 3/5 that gives no direction on what to fix or ignore.

     Reason format: five lines, one per gate, each prefixed with ✓ or ✗ and
     a short label describing that gate's finding. Consumed as a title=""
     attribute so browsers render it as native hover text; newlines are
     encoded as &#10; which every modern engine treats as a line break in
     tooltip contexts. */
  function hgSolidityReasons(sol){
    if (!sol || !sol.gates) return '';
    var g = sol.gates;
    var lines = [];
    /* G1 FAMILIES */
    var g1 = g.families || {};
    lines.push((g1.pass ? '✓' : '✗') + ' families: '
      + (isFinite(g1.n) ? g1.n : '?') + ' agree'
      + (g1.source ? ' (' + g1.source + ')' : ''));
    /* G2 LIVE-FRESH */
    var g2 = g.liveFresh || {};
    lines.push((g2.pass ? '✓' : '✗') + ' live-price: ' + (g2.grade || 'unknown'));
    /* G3 TAPE */
    var g3 = g.tape || {};
    lines.push((g3.pass ? '✓' : '✗') + ' tape: ' + (g3.tape || 'unknown'));
    /* G4 RR */
    var g4 = g.rr || {};
    var rrStr = (isFinite(g4.rr) ? g4.rr.toFixed(2) : '?') + 'R (floor '
      + (isFinite(g4.floor) ? g4.floor.toFixed(2) : '?') + 'R + 0.25)';
    lines.push((g4.pass ? '✓' : '✗') + ' rr: ' + rrStr);
    /* G5 STOP */
    var g5 = g.stop || {};
    lines.push((g5.pass ? '✓' : '✗') + ' stop: '
      + (g5.widened === true ? 'widened to v681 floor' : 'natural structure'));
    /* G6 MEASURED-EDGE (v685) */
    var g6 = g.measuredEdge || {};
    var edgeStr;
    if (g6.source === 'no-lookup' || g6.source === 'no-fwdlog') edgeStr = 'no data';
    else if (g6.source === 'too-few-samples') edgeStr = 'sample too small (' + (g6.samples || 0) + '/' + HG_SOL_MIN_EDGE_SAMPLES + ')';
    else if (g6.source === 'expR-nan' || g6.source === 'fwdlog-error') edgeStr = 'no data';
    else if (g6.source === 'measured'){
      var er = isFinite(g6.expR) ? g6.expR.toFixed(2) + 'R' : '?';
      edgeStr = 'measured ' + er + ' over ' + (g6.samples || 0) + ' samples (floor ' + HG_SOL_EDGE_FLOOR.toFixed(2) + 'R)';
    } else edgeStr = 'unknown';
    lines.push((g6.pass ? '✓' : '✗') + ' measured-edge: ' + edgeStr);
    return lines.join('\n');
  }

  /* Convenience: chip HTML for a card footer, styled to match existing hg
     chips (gpip ok / caution / veto). Tabs may render it or not.

     v684: tooltip now carries the per-gate breakdown so a MIXED chip
     tells the user WHICH gates failed — not just the score. */
  function hgSolidityChipHtml(sol){
    if (!sol || !sol.grade) return '';
    var cls = 'caution';
    if (sol.grade === 'SOLID') cls = 'ok';
    else if (sol.grade === 'GOOD') cls = 'ok';
    else if (sol.grade === 'MIXED') cls = 'caution';
    else if (sol.grade === 'THIN') cls = 'veto';
    else if (sol.grade === 'WEAK') cls = 'veto';
    var reasons = hgSolidityReasons(sol);
    /* v685: max score is now 6 (was 5 pre-v685). Use the label table's
       highest key so future scale changes don't need another callsite
       update. */
    var MAX = Math.max.apply(null, Object.keys(HG_SOL_LABELS).map(Number));
    var title = 'Solidity ' + sol.score + '/' + MAX;
    if (reasons) title += '\n' + reasons;
    /* HTML-encode the title to keep double-quotes safe inside the attribute
       AND to preserve newlines as &#10; which browsers convert back to line
       breaks in native tooltips. */
    var titleAttr = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
    return '<span class="gpip ' + cls + '" title="' + titleAttr + '">SOLIDITY ' + sol.grade + '</span>';
  }

  /* Sort helper: reorders a list of cards so lead-eligible (SOLID/GOOD) come
     first, keeping stable order within each bucket (so the tab's own ranker
     still decides ordering WITHIN a bucket). Every card must already carry
     a .solidity object (attach with hgSolidityGrade before calling).

     v685: bucket thresholds re-scaled to the 6-point system. Lead bucket is
     score >= 5 (HG_SOL_LEAD_MIN); mid bucket is 3-4 (both MIXED); back
     bucket is 0-2. Preserves the property that ORDER within a bucket is
     stable, so the tab's own ranker still decides ordering. */
  function hgSolidityReorder(cards){
    if (!Array.isArray(cards)) return cards;
    var lead = [], mid = [], back = [];
    for (var i = 0; i < cards.length; i++){
      var c = cards[i];
      var sol = c && c.solidity;
      if (sol && sol.score >= HG_SOL_LEAD_MIN) lead.push(c);
      else if (sol && sol.score >= 3) mid.push(c);
      else back.push(c);
    }
    return lead.concat(mid).concat(back);
  }

  /* --- expose ----------------------------------------------------------- */
  G.hgSolidityGrade = hgSolidityGrade;
  G.hgSolidityChipHtml = hgSolidityChipHtml;
  G.hgSolidityReasons = hgSolidityReasons; /* v684 */
  G.hgSolidityReorder = hgSolidityReorder;
  G.hgSolGateFamilies = hgSolGateFamilies;
  G.hgSolGateLiveFresh = hgSolGateLiveFresh;
  G.hgSolGateTape = hgSolGateTape;
  G.hgSolGateRr = hgSolGateRr;
  G.hgSolGateStop = hgSolGateStop;
  G.hgSolGateMeasuredEdge = hgSolGateMeasuredEdge; /* v685 */
  G.HG_SOLIDITY_VERSION = 'v686';
  G.HG_SOL_LEAD_MIN = HG_SOL_LEAD_MIN;
  G.HG_SOL_MIN_EDGE_SAMPLES = HG_SOL_MIN_EDGE_SAMPLES;
  G.HG_SOL_EDGE_FLOOR = HG_SOL_EDGE_FLOOR;
})();
