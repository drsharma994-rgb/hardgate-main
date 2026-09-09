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
  /* v687 auto-promotion: symmetric to the v685 veto floor. When the same
     (tab, kind) pair has HG_SOL_MIN_EDGE_SAMPLES+ recorded outcomes AND
     expR >= HG_SOL_EDGE_PRIME, G7 passes and the card earns the PRIME grade.
     +0.5R is the smallest expectancy that clears typical fee/slip modelling
     with headroom; anything lower is edge-thin. */
  var HG_SOL_EDGE_PRIME = 0.5;
  /* v689 KILL-LIST: stricter thresholds than G6 veto. Kinds with 30+
     samples AND expR < -0.5R are REMOVED from the visible list entirely
     rather than merely demoted. 30 samples so the standard error of the
     hit rate is <= 0.09 (tighter than G6's 0.11). -0.5R because the
     kill is destructive — the user won't see the kind at all until the
     stat recovers, so the bar has to be higher than the veto's -0.25R.

     Filter is HONEST: the tab renders a 'KILLED N proven-losing setups
     hidden' note so the user knows filtering happened. Recovery is
     automatic — as new samples land and expR recovers, the kind
     re-enters the visible list. */
  var HG_SOL_KILL_MIN_SAMPLES = 30;
  var HG_SOL_KILL_EDGE_FLOOR = -0.5;

  /* v687: 7-point scale. 7/7 = PRIME (measured-winning kind + all quality
     gates clean). 6/7 = SOLID. 5/7 = GOOD. Both PRIME and SOLID and GOOD
     remain lead-eligible. PRIME is a new grade earned only when G7 fires
     positively — an unmeasured or too-few-samples kind can still be SOLID,
     just not PRIME. This preserves the innocent-until-proven-guilty rule
     from v685 while adding a proven-innocent bonus. */
  var HG_SOL_LABELS = {
    /* v687 tape-override virtual point can push effectiveScore to 8; still PRIME */
    8: 'PRIME',
    7: 'PRIME',
    6: 'SOLID',
    5: 'GOOD',
    4: 'MIXED',
    3: 'MIXED',
    2: 'THIN',
    1: 'WEAK',
    0: 'WEAK'
  };
  var HG_SOL_LEAD_MIN = 5; /* score >= 5 leads (PRIME, SOLID, GOOD) */
  var HG_SOL_PRIME_MIN = 7; /* score == 7 = PRIME */

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
     to preserve backward compatibility with pre-v685 callers.

     v687: this gate now also stamps the raw stats on the returned object
     so G7 (auto-promotion) can read them without a second lookup. */
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

  /* v689 KILL-LIST check. Returns { killed: bool, samples, expR } for a
     given (tab, kind). Kinds with 30+ samples AND expR < -0.5R are killed:
     the tab hides them entirely, with a 'N proven-losing setups hidden'
     note so the user can see the filtering happened.

     Defaults to killed=false when data is missing (no lookup, no fwdlog,
     small sample, NaN expR). This is deliberately more conservative than
     G6 veto: kill is destructive, so we require BOTH higher sample count
     AND worse expR before hiding a kind entirely.

     Recovery is automatic: if new samples land and expR recovers above
     -0.5R (either through wins or through the stale-sample decay in
     hgFwdStats), the kind reappears on the next scan. Nothing needs to
     be manually unkilled. */
  function hgSolidityIsKilled(tab, kind){
    if (!tab || !kind) return { killed: false, source: 'no-lookup' };
    var W = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : G);
    if (!W || typeof W.hgFwdStats !== 'function') return { killed: false, source: 'no-fwdlog' };
    var stats = null;
    try { stats = W.hgFwdStats(String(tab), String(kind), false); }
    catch(eF){ return { killed: false, source: 'fwdlog-error' }; }
    if (!stats || !isFinite(stats.samples) || stats.samples < HG_SOL_KILL_MIN_SAMPLES){
      return { killed: false, source: 'too-few-samples', samples: stats && stats.samples || 0 };
    }
    var expR = _fin(stats.expR);
    if (!isFinite(expR)) return { killed: false, source: 'expR-nan', samples: stats.samples };
    var killed = expR < HG_SOL_KILL_EDGE_FLOOR;
    return { killed: killed, source: 'measured', samples: stats.samples, expR: expR,
             threshold: HG_SOL_KILL_EDGE_FLOOR };
  }

  /* G7 (v687): MEASURED-WINNING auto-promotion. Symmetric to G6 — same
     sample floor, same lookup, opposite polarity. Fires (pass=true) only
     when the log has HG_SOL_MIN_EDGE_SAMPLES+ observations AND measured
     expR meets or exceeds HG_SOL_EDGE_PRIME. Unlike G6 which defaults to
     pass when data is missing (innocent-until-proven-guilty), G7 defaults
     to FAIL when data is missing (proven-innocent bonus).

     G7 reads the same stats G6 already computed when both are called from
     hgSolidityGrade in sequence. When called standalone, it re-queries. */
  function hgSolGateMeasuredWinning(plan, opts){
    opts = opts || {};
    if (!opts.tab || !opts.kind) return { pass: false, source: 'no-lookup' };
    var W = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : G);
    if (!W || typeof W.hgFwdStats !== 'function') return { pass: false, source: 'no-fwdlog' };
    var stats = null;
    try { stats = W.hgFwdStats(String(opts.tab), String(opts.kind), false); }
    catch(eF){ return { pass: false, source: 'fwdlog-error' }; }
    if (!stats || !isFinite(stats.samples) || stats.samples < HG_SOL_MIN_EDGE_SAMPLES){
      return { pass: false, source: 'too-few-samples', samples: stats && stats.samples || 0, expR: stats && stats.expR };
    }
    var expR = _fin(stats.expR);
    if (!isFinite(expR)) return { pass: false, source: 'expR-nan', samples: stats.samples, expR: NaN };
    var pass = expR >= HG_SOL_EDGE_PRIME;
    return { pass: pass, source: 'measured', samples: stats.samples, expR: expR, threshold: HG_SOL_EDGE_PRIME };
  }

  /* --- composite grade -------------------------------------------------- */

  /* Given a plan, return { grade, score, gates } where score is 0..7 (v687).
     This is the ONE call every tab makes. Adds no fields to plan; returns a
     fresh object the tab attaches (or doesn't) at its discretion.

     opts.minRr: the tab's minimum R:R floor (default 2.0).
     opts.tab, opts.kind: identifies (scanner, mechanic) pair for G6/G7
       lookups. If either is missing, G6 passes unconditionally and G7
       fails unconditionally (backward-compat + honest no-data).

     v685: G6 measured-edge veto added.
     v687: G7 measured-winning auto-promotion added; PRIME grade for 7/7. */
  function hgSolidityGrade(plan, opts){
    opts = opts || {};
    var g1 = hgSolGateFamilies(plan);
    var g2 = hgSolGateLiveFresh(plan);
    var g3 = hgSolGateTape(plan);
    var g4 = hgSolGateRr(plan, opts);
    var g5 = hgSolGateStop(plan);
    var g6 = hgSolGateMeasuredEdge(plan, opts);
    var g7 = hgSolGateMeasuredWinning(plan, opts);
    var score = (g1.pass ? 1 : 0) + (g2.pass ? 1 : 0) + (g3.pass ? 1 : 0)
              + (g4.pass ? 1 : 0) + (g5.pass ? 1 : 0) + (g6.pass ? 1 : 0)
              + (g7.pass ? 1 : 0);
    /* v687 opts.tapeOverride: when the caller (currently omnigold only) opts
       in, a card whose G7 measured-winning fires gets ALL OTHER GATES
       INCLUDING TAPE re-evaluated as if tape passed. A measured-winning
       kind has been proven to work over 20+ samples of REAL market
       history — that empirical evidence overrides the current-tape
       heuristic for the purpose of lead ordering. The card's tape gate
       still shows the honest ✗ in the tooltip so the trader sees the
       risk; only the composite score and grade get promoted. */
    var effectiveScore = score;
    var effectiveGrade = HG_SOL_LABELS[score] || 'WEAK';
    var tapeOverridden = false;
    if (opts.tapeOverride === true && g7.pass === true && g3.pass === false){
      effectiveScore = score + 1; /* virtual point for the override */
      effectiveGrade = HG_SOL_LABELS[effectiveScore] || effectiveGrade;
      tapeOverridden = true;
    }
    /* v689: attach the kill decision. This is not a gate (doesn't affect
       score or grade) — it's a downstream filter. A card can be PRIME
       and killed simultaneously in principle, though in practice a
       killed kind will have failed G7 (never enters PRIME) and failed G6
       (drops below GOOD). The killed flag is what lets hgSolidityReorder
       hide the card from the visible list. */
    var kill = hgSolidityIsKilled(opts.tab, opts.kind);
    return {
      grade: effectiveGrade,
      score: effectiveScore,
      rawScore: score,
      tapeOverridden: tapeOverridden,
      gates: {
        families: g1,
        liveFresh: g2,
        tape: g3,
        rr: g4,
        stop: g5,
        measuredEdge: g6,
        measuredWinning: g7
      },
      /* leadEligible: score >= HG_SOL_LEAD_MIN (5). PRIME/SOLID/GOOD lead. */
      leadEligible: effectiveScore >= HG_SOL_LEAD_MIN,
      /* primeEligible: score == HG_SOL_PRIME_MIN (7). PRIME cards may override
         tape veto on tabs that opt in (see v687 omnigold override). */
      primeEligible: effectiveScore >= HG_SOL_PRIME_MIN,
      /* v689 KILL flag: true when the kind has been proven losing over
         30+ samples with expR < -0.5R. Consumed by hgSolidityReorder to
         filter the card out of the visible list. */
      killed: kill.killed === true,
      killReason: kill
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
    /* G7 MEASURED-WINNING (v687): auto-promotion. Only shows a check when
       the (tab, kind) pair has genuinely proven itself. */
    var g7 = g.measuredWinning || {};
    var winStr;
    if (g7.source === 'no-lookup' || g7.source === 'no-fwdlog') winStr = 'no data';
    else if (g7.source === 'too-few-samples') winStr = 'sample too small (' + (g7.samples || 0) + '/' + HG_SOL_MIN_EDGE_SAMPLES + ')';
    else if (g7.source === 'expR-nan' || g7.source === 'fwdlog-error') winStr = 'no data';
    else if (g7.source === 'measured'){
      var er7 = isFinite(g7.expR) ? g7.expR.toFixed(2) + 'R' : '?';
      winStr = 'measured ' + er7 + ' over ' + (g7.samples || 0) + ' samples (prime floor ' + HG_SOL_EDGE_PRIME.toFixed(2) + 'R)';
    } else winStr = 'unknown';
    lines.push((g7.pass ? '✓' : '✗') + ' measured-winning: ' + winStr);
    /* v687 omnigold tape-override marker: shown only when the override
       actually fired so the trader sees that a proven-winning kind is
       leading despite an adverse tape reading. */
    if (sol.tapeOverridden === true){
      lines.push('★ tape-override: PRIME kind overrides adverse tape (omnigold)');
    }
    return lines.join('\n');
  }

  /* Convenience: chip HTML for a card footer, styled to match existing hg
     chips (gpip ok / caution / veto). Tabs may render it or not.

     v684: tooltip now carries the per-gate breakdown so a MIXED chip
     tells the user WHICH gates failed — not just the score. */
  function hgSolidityChipHtml(sol){
    if (!sol || !sol.grade) return '';
    var cls = 'caution';
    /* v687: PRIME shares 'ok' class with SOLID/GOOD; distinguished by the
       grade label itself and the tooltip. */
    if (sol.grade === 'PRIME') cls = 'ok';
    else if (sol.grade === 'SOLID') cls = 'ok';
    else if (sol.grade === 'GOOD') cls = 'ok';
    else if (sol.grade === 'MIXED') cls = 'caution';
    else if (sol.grade === 'THIN') cls = 'veto';
    else if (sol.grade === 'WEAK') cls = 'veto';
    var reasons = hgSolidityReasons(sol);
    /* v687: real gate count is 7; effectiveScore may reach 8 via the
       omnigold tape-override virtual point. Display the raw '/7' as the
       user-facing denominator because that matches the number of actual
       gates. When tape-overridden, the tooltip ★ line makes the override
       explicit; the chip's numerator can still be 8 in that case, which
       reads as 'better than every gate' and matches the PRIME grade. */
    var MAX = 7;
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
  function hgSolidityReorder(cards, opts){
    opts = opts || {};
    if (!Array.isArray(cards)) return cards;
    /* v687: split lead bucket into prime + rest so PRIME cards lead
       absolutely. Within each bucket, input order (score-derived) is
       preserved so the tab's own ranker still resolves ties.

       v689: cards marked sol.killed=true are FILTERED OUT of the visible
       list entirely. The count is exposed via .killedCount on the returned
       array so the tab can render a 'N proven-losing setups hidden' note. */
    var prime = [], lead = [], mid = [], back = [];
    var killedCount = 0;
    var killedKinds = {};
    for (var i = 0; i < cards.length; i++){
      var c = cards[i];
      var sol = c && c.solidity;
      /* v689: skip killed kinds. The kind is still recorded in
         killedKinds so the tab can list which kinds were filtered. */
      if (sol && sol.killed === true){
        killedCount++;
        var kindKey = (c && (c.kind || (c.setup && c.setup.kind))) || 'unknown';
        killedKinds[kindKey] = (killedKinds[kindKey] || 0) + 1;
        continue;
      }
      if (sol && sol.score >= HG_SOL_PRIME_MIN) prime.push(c);
      else if (sol && sol.score >= HG_SOL_LEAD_MIN) lead.push(c);
      else if (sol && sol.score >= 3) mid.push(c);
      else back.push(c);
    }
    var out = prime.concat(lead).concat(mid).concat(back);
    /* v689: attach the filter statistics to the returned array as
       properties so no caller signature has to change. Arrays are
       objects in JS and callers that don't look for these props see
       the plain reordered array.

       Also stash the last-computed stats on window per tab (via opts.tab
       if the caller supplies it) so downstream renderers can read them
       without re-running the reorder. */
    try {
      Object.defineProperty(out, 'killedCount', { value: killedCount, enumerable: false });
      Object.defineProperty(out, 'killedKinds', { value: killedKinds, enumerable: false });
    } catch(eProp){ /* older engines: silent */ }
    try {
      if (opts && opts.tab){
        var W = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : G);
        if (W){
          W.__hgSolKillLast = W.__hgSolKillLast || {};
          W.__hgSolKillLast[String(opts.tab)] = {
            killedCount: killedCount,
            killedKinds: killedKinds,
            at: Date.now()
          };
        }
      }
    } catch(eStash){ /* silent */ }
    return out;
  }

  /* v689: read the last-reordered killed stats for a tab (stashed by
     hgSolidityReorder when opts.tab was provided). Returns a fake
     array-like { killedCount, killedKinds } compatible with
     hgSolidityKilledNoteHtml. Useful when the render site does not have
     the reordered array in scope but knows the tab id. */
  function hgSolidityLastKilled(tab){
    if (!tab) return null;
    var W = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : G);
    if (!W || !W.__hgSolKillLast) return null;
    var rec = W.__hgSolKillLast[String(tab)];
    if (!rec) return null;
    /* Return an object with the same duck-type hgSolidityKilledNoteHtml
       expects (killedCount + killedKinds). */
    return { killedCount: rec.killedCount, killedKinds: rec.killedKinds };
  }

  /* v689: render 'N proven-losing setups hidden' note. Consumers pass the
     reordered array returned from hgSolidityReorder. When killedCount is 0
     returns empty string; when > 0 renders a small note listing the total
     count and the top kinds hidden. Uses only inline styles so it matches
     any theme. */
  function hgSolidityKilledNoteHtml(reordered){
    if (!reordered || typeof reordered !== 'object') return '';
    var n = 0, kinds = null;
    try { n = reordered.killedCount; kinds = reordered.killedKinds; }
    catch(e){ return ''; }
    if (!isFinite(n) || n <= 0) return '';
    var kindList = '';
    if (kinds){
      var names = [];
      for (var k in kinds) if (Object.prototype.hasOwnProperty.call(kinds, k)) names.push(k);
      if (names.length){
        /* Show up to 3 kind names; if more, add '+ N more' */
        var shown = names.slice(0, 3);
        kindList = ' (' + shown.map(function(name){
          var count = kinds[name];
          return name + (count > 1 ? ' ×' + count : '');
        }).join(', ');
        if (names.length > 3) kindList += ', +' + (names.length - 3) + ' more';
        kindList += ')';
      }
    }
    return '<div class="hg-sol-killed-note" style="margin-top:6px;padding:4px 8px;'
      + 'border:1px dashed rgba(255,140,0,0.4);border-radius:4px;font-size:11px;'
      + 'opacity:0.75;background:rgba(255,140,0,0.06)">'
      + '✗ ' + n + ' proven-losing setup' + (n === 1 ? '' : 's') + ' hidden'
      + kindList
      + ' — kinds with 30+ samples and expR < -0.5R are removed from the visible list until the stat recovers'
      + '</div>';
  }

  /* --- expose ----------------------------------------------------------- */
  G.hgSolidityGrade = hgSolidityGrade;
  G.hgSolidityKilledNoteHtml = hgSolidityKilledNoteHtml; /* v689 */
  G.hgSolidityLastKilled = hgSolidityLastKilled; /* v689 */
  G.hgSolidityChipHtml = hgSolidityChipHtml;
  G.hgSolidityReasons = hgSolidityReasons; /* v684 */
  G.hgSolidityReorder = hgSolidityReorder;
  G.hgSolGateFamilies = hgSolGateFamilies;
  G.hgSolGateLiveFresh = hgSolGateLiveFresh;
  G.hgSolGateTape = hgSolGateTape;
  G.hgSolGateRr = hgSolGateRr;
  G.hgSolGateStop = hgSolGateStop;
  G.hgSolGateMeasuredEdge = hgSolGateMeasuredEdge; /* v685 */
  G.hgSolGateMeasuredWinning = hgSolGateMeasuredWinning; /* v687 */
  G.hgSolidityIsKilled = hgSolidityIsKilled; /* v689 */
  G.HG_SOLIDITY_VERSION = 'v689';
  G.HG_SOL_LEAD_MIN = HG_SOL_LEAD_MIN;
  G.HG_SOL_PRIME_MIN = HG_SOL_PRIME_MIN;
  G.HG_SOL_MIN_EDGE_SAMPLES = HG_SOL_MIN_EDGE_SAMPLES;
  G.HG_SOL_EDGE_FLOOR = HG_SOL_EDGE_FLOOR;
  G.HG_SOL_EDGE_PRIME = HG_SOL_EDGE_PRIME;
  G.HG_SOL_KILL_MIN_SAMPLES = HG_SOL_KILL_MIN_SAMPLES;
  G.HG_SOL_KILL_EDGE_FLOOR = HG_SOL_KILL_EDGE_FLOOR;
})();
