/* =========================================================================
HARDGATE — omnibtc.js
OMNIBTC — Bitcoin only. Every house strategy and indicator bank is pointed
at BTC, then the desk keeps ONE most-probable setup.

WHY THIS TAB EXISTS. The rest of CRYPTO scans a universe. This tab answers
a narrower question: given everything HARDGATE already knows how to read,
what is the single most probable BTC setup right now?

ENGINES ACTUALLY CALLED, because this header used to name three it never
invoked (squeeze, PINE and structure were listed and never wired):
  SWING clean + near-clean ... swingTryClean / swingTryNear
  SCALP clean .............. scalpTryClean
  EDGE ..................... edgeSignal
  MEAN REVERSION ........... mrSignal
  REVERSAL SNIPER .......... rsAssess
  LIQUIDITY FLUSH .......... liqFlushSetup
  SQUEEZE .................. squeezeClassify -> squeezeGateEval -> squeezePlan
  TREND MATRIX ............. trendScore -> trendmxGateEval -> trendmxPlan
  OMNIROUTE ................ hgOmniEvaluate, then OMNIROUTE principal
  CONTRACT REPORT .......... hgContractReportRun (every gate + indicator)
  20-gate indicator bank ... hgStrategyRefine
  SMART $ / OI FLOW ........ classify + setup (omnibtc-engines.js)
  FUNDING FADE ............. swingTryFundingFade / scalpTryFundingFade
  COIL / DIV / TRAP ........ same gates as those CRYPTO tabs
  SMC ...................... pineSmcCore last-bar ChoCh
  STAR TRADER .............. stSynthesize (votes the engines above)
  ONCHAIN / TERM / CARRY ... evidence only — confirm / demote / refuse
  FUNDAMENTAL STACK ........ hg-v1002, evidence only (omnibtc-engines.js):
                             FEAR & GREED extremes contrarian on the house
                             S2 80/20 lines; Deribit 25Δ risk-reversal
                             extremes on the house |8| line; DVOL + BTC.D
                             are info-only priors that never vote; the news
                             blackout is a hard REFUSE. 2+ net checked votes
                             against the candidate demote it to watch — one
                             witness never flips a setup. The stack never
                             mints levels and never moves rank math.
  PINE ..................... READ ONLY. pineScan() is a snapshot the PINE tab
                             computes; this reads a BTC row when one is
                             already there and contributes nothing when it is
                             not. It never runs pine and never mints a signal
                             pine did not produce.
  REAL-FLOW CVD ............ hg-v1011: the contract report's CVD row always
                             accepted a taker series and was never fed one —
                             the candle-approximated stand-in answered for the
                             life of the desk. hgObtcGatherExtra now fetches
                             Binance's BTCUSDT taker long/short series (4h,
                             cached), so the row reads REAL aggressor flow
                             when the feed is up, the labelled stand-in when
                             it is not.
  FORWARD LEDGER ........... hg-v1011: the crowned pick is recorded to
                             hg-forward ('OMNIBTC', 4h tape, 20-bar horizon)
                             with the winner leg's own rows (the central
                             regime mark reads them) and the ticker's funding
                             — the desk's word is measured now, out-of-sample,
                             and the book renders under the card. Dedup keys
                             on the levels: a re-scan of the same crown
                             records once.

Extra engines never claim 7/7 CLEAN. That badge stays on swingTryClean /
scalpTryClean. APEX is alts-versus-BTC, so it is not called. BEST is the
same 7/7 swing path already run. SUPER and BRAIN need a warmed multi-asset
snap — they are not invented here from an empty board.

Structure (FVG / order blocks) is deliberately NOT listed as an engine: those
are detectors that feed the planners above, not producers of a ticket.

OMNIROUTE PRINCIPAL FIRST. Every house row (including OMNIROUTE hits)
must clear the same floors the OMNIROUTE tab uses before it is a result:
  replay demote / nightly aside / analogue map (SNIPER→PIN-REJECT,
  SMC→FVG-FILL, SQUEEZE→SQUEEZE-FIRE, SCALP→NR7-BREAK, MR→VWAP-REVERT)
  / desk-edge suppress+demote. OMNIROUTE hits also need grade.ticket
  and formationOk !== false. The map never invents a prefer. Survivors
  then collapse to one MOST PROBABLE. Aside is the result when nothing
  clears.

WHAT IT WILL NOT DO.
  - It will not invent a new BTC strategy.
  - It will not mint ENTRY / STOP / T1. Levels come from existing engines.
  - It will not promote alts or gold. Non-BTC rows are dropped before rank.
  - It will not use contract-report's "derived structure" fallback (that
    path writes numbers when no engine produced a ticket).
  - It will not loosen G1–G7.
  - It will not MOST-PROBABLE a replay-demoted or desk-suppressed analogue.

ONE SETUP. After the OMNIROUTE principal: CLEAN with real levels wins.
Else the best 6/7 NEAR (watch, not a ticket). Else WAIT. Standing aside
is the position.

VENUES. Delta BTCUSD and CoinDCX B-BTC_USDT when dual-scan is on (the
house default). Both legs feed one pick — two venues, still one card.

Classic script, IIFE. Never throws at load. Every engine is feature-checked.
refresh() is async, never throws, and never launches a first-time scan on
a global hard refresh.
========================================================================= */
'use strict';

(function(){

  var W = (typeof window !== 'undefined') ? window : globalThis;
  var __obtc = { ui: null, busy: false, ran: false, snap: null, lastStat: '' };

  function gfn(name){
    return (W && typeof W[name] === 'function') ? W[name] : null;
  }
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }
  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hgObtcIsBtc(sym){
    try{
      var raw = String(sym || '');
      var s = raw.replace(/^B-/, '').replace(/_/g, '');
      if (gfn('hgIsBtcSymbol') && !W.hgIsBtcSymbol(raw)) return false;
      return /^(BTCUSD|BTCUSDT)$/i.test(s);
    }catch(e){ return false; }
  }

  function hgObtcFilterUniverse(items){
    var out = [], i, it, sym, base;
    if (!Array.isArray(items)) return out;
    for (i = 0; i < items.length; i++){
      it = items[i];
      if (!it) continue;
      sym = it.sym || it.symbol || '';
      if (!hgObtcIsBtc(sym)) continue;
      base = it.base != null ? String(it.base).toUpperCase() : '';
      if (base && base !== 'BTC') continue;
      out.push(it);
    }
    return out;
  }

  function isDerivedSource(src){
    var s = String(src || '').toLowerCase();
    if (s.indexOf('derived') < 0) return false;
    return s.indexOf('structure') >= 0 || s.indexOf('no engine') >= 0;
  }

  function hgObtcHasLevels(row){
    if (gfn('hgSetupHasLevels')) return W.hgSetupHasLevels(row);
    if (!row) return false;
    var e = fin(row.entry), s = fin(row.stop), t1 = fin(row.t1);
    return isFinite(e) && e > 0 && isFinite(s) && s > 0 && e !== s && isFinite(t1) && t1 > 0;
  }

  /* Same analogue map OMNIROUTE uses (hg-v612). Local copy so the BTC
     desk cannot fail-open when omniroute.js has not loaded yet. */
  var HG_OBTC_KIND_ALIAS = {
    SNIPER: 'PIN-REJECT',
    REVERSALSNIPER: 'PIN-REJECT',
    'REVERSAL-SNIPER': 'PIN-REJECT',
    'HOUSE-SQUEEZE': 'SQUEEZE-FIRE',
    SQUEEZE: 'SQUEEZE-FIRE',
    SMC: 'FVG-FILL',
    SCALP: 'NR7-BREAK',
    MR: 'VWAP-REVERT'
  };
  var HG_OBTC_BAKED_ACTION = {
    'PIN-REJECT': 'suppress',
    'FVG-FILL': 'suppress',
    'RSI-DIVERGE': 'suppress',
    'THREE-BAR': 'suppress',
    UTAD: 'suppress',
    'SWEEP-RECLAIM': 'demote',
    'EQH-SWEEP': 'demote',
    'EQL-SWEEP': 'demote',
    PO3: 'demote'
  };

  function hgObtcForwardPaid(kind){
    try{
      if (gfn('hgOmniReplayForwardPaid')){
        var v = W.hgOmniReplayForwardPaid(kind);
        if (v && v.read === 'has paid') return true;
      }
    }catch(eFp){}
    return false;
  }

  function hgObtcReplayKind(engine, kind){
    var raw = String(kind || '').toUpperCase().trim();
    if (!raw){
      var eng = String(engine || '').toUpperCase();
      var named = eng.match(/OMNIROUTE\s*[·.:-]\s*([A-Z0-9-]+)/);
      if (named) raw = named[1];
      else if (/SNIPER|PIN-REJECT|PIN REJECT/.test(eng)) raw = 'SNIPER';
      else if (/\bSMC\b|CHOCH/.test(eng)) raw = 'SMC';
      else if (/SQUEEZE/.test(eng)) raw = 'HOUSE-SQUEEZE';
      else if (/SCALP/.test(eng)) raw = 'SCALP';
      else if (/MEAN REVERSION|\bMR\b/.test(eng)) raw = 'MR';
      else if (/DIV|RSI-DIVERGE/.test(eng)) raw = 'RSI-DIVERGE';
      else if (/TRAP|SWEEP/.test(eng)) raw = 'SWEEP-RECLAIM';
      else raw = eng.replace(/^OMNIROUTE\s*[·.:-]\s*/, '').split(/\s+/)[0] || '';
    }
    if (gfn('hgOmniReplayKind')) return W.hgOmniReplayKind(raw);
    return HG_OBTC_KIND_ALIAS[raw] || raw;
  }

  function hgObtcEngineTab(engine, kind){
    var raw = String(engine || kind || '').toUpperCase();
    if (/SNIPER|PIN-REJECT/.test(raw)) return 'reversalsniper';
    if (/\bSMC\b|CHOCH|FVG-FILL/.test(raw)) return 'smc';
    if (/SQUEEZE/.test(raw)) return 'squeeze';
    if (/SCALP/.test(raw)) return 'scalp';
    if (/DIV|RSI-DIVERGE/.test(raw)) return 'divergence';
    if (/TRAP|SWEEP/.test(raw)) return 'trap';
    if (/SWING/.test(raw)) return 'swing';
    if (/\bEDGE\b/.test(raw)) return 'edge';
    if (/COIL/.test(raw)) return 'coil';
    if (/OI FLOW|OIFLOW/.test(raw)) return 'oiflow';
    if (/SMART/.test(raw)) return 'smart';
    if (/FUND/.test(raw)) return 'fund-fade';
    if (/FLUSH|LIQS/.test(raw)) return 'liqs';
    return '';
  }

  function hgObtcStampAside(row, reason, action){
    row.clean = false;
    row.near = false;
    row.nearClean = true;
    row.forming = false;
    row.watchOnly = true;
    row.ticket = false;
    row.demoted = true;
    row.omniPrincipal = reason;
    row.omniPickable = false;
    if (action) row.deskEdgeAction = row.deskEdgeAction || action;
    return row;
  }

  /* OMNIROUTE tab floors, then a result. Never invents prefer. */
  function hgObtcApplyOmniPrincipal(row, opts){
    opts = opts || {};
    if (!row || typeof row !== 'object') return { row: null, pickable: false, reason: 'no row' };
    var kind = hgObtcReplayKind(row.engine || row.strategy, row.kind);
    var tab = hgObtcEngineTab(row.engine || row.strategy, kind);
    if (kind && !row.kind) row.kind = kind;
    row.omniKind = kind;
    row.omniPickable = true;
    row.omniPrincipal = 'pass';

    if (gfn('hgOmniKindDemotion')){
      try{
        var dem = W.hgOmniKindDemotion(kind);
        if (dem && !hgObtcForwardPaid(kind)){
          hgObtcStampAside(row, 'replay-demoted', 'suppress');
          row.kindDemotion = dem;
          row.formationOk = false;
          return { row: row, pickable: false, reason: 'replay-demoted' };
        }
      }catch(eD){}
    } else if (HG_OBTC_BAKED_ACTION[kind] && !hgObtcForwardPaid(kind)){
      hgObtcStampAside(row, 'replay-demoted', HG_OBTC_BAKED_ACTION[kind]);
      return { row: row, pickable: false, reason: 'replay-demoted' };
    }

    if (tab && gfn('hgDeskFormationEdgeApply')){
      try{
        W.hgDeskFormationEdgeApply(row, {
          tab: tab, kind: kind, rows: opts.rows || row._rows, dir: row.dir
        });
        if (row.deskEdgeAction === 'suppress' || row.deskEdgeAction === 'demote'){
          hgObtcStampAside(row, 'desk-edge-' + row.deskEdgeAction, row.deskEdgeAction);
          return { row: row, pickable: false, reason: row.omniPrincipal };
        }
      }catch(eE){}
    } else if (HG_OBTC_BAKED_ACTION[kind] && !hgObtcForwardPaid(kind)){
      hgObtcStampAside(row, 'desk-edge-' + HG_OBTC_BAKED_ACTION[kind], HG_OBTC_BAKED_ACTION[kind]);
      return { row: row, pickable: false, reason: row.omniPrincipal };
    }

    return { row: row, pickable: true, reason: 'pass' };
  }

  function hgObtcCandidateFromOmniHit(hit, ticker){
    if (!hit) return null;
    var plan = (hit.plan && typeof hit.plan === 'object') ? hit.plan : null;
    if (!plan) return null;
    var kind = hit.kind || plan.kind || '';
    var grade = hit.grade || {};
    var formedOk = plan.formationOk;
    var demoted = !!(hit.kindDemotion || plan.kindDemotion);
    if (formedOk === false) return null;
    if (demoted && !hgObtcForwardPaid(kind)) return null;
    var c = hgObtcCandidateFromSignal(plan, ticker, { engine: 'OMNIROUTE · ' + (kind || 'hit') });
    if (!c) return null;
    c.kind = kind;
    if (kind) c.engine = 'OMNIROUTE · ' + kind;
    if (grade.ticket !== true){
      c.clean = false;
      c.near = true;
      c.nearClean = true;
      c.watchOnly = true;
      c.ticket = false;
    }
    var app = hgObtcApplyOmniPrincipal(c);
    if (!app.pickable) return null;
    return c;
  }

  function hgObtcCandidateFromSignal(r, ticker, opts){
    opts = opts || {};
    if (!r || typeof r !== 'object') return null;
    var src = String(r.source || r.name || opts.engine || '');
    if (isDerivedSource(src) || isDerivedSource(r.source)) return null;
    var sym = String((ticker && (ticker.symbol || ticker.sym)) || r.sym || r.symbol || opts.sym || '');
    if (!hgObtcIsBtc(sym)) return null;
    var dir = String(r.dir || r.side || r.direction || '').toLowerCase();
    if (dir === 'buy' || dir === 'l') dir = 'long';
    if (dir === 'sell' || dir === 's') dir = 'short';
    if (dir !== 'long' && dir !== 'short') return null;
    var entry = fin(r.entry), stop = fin(r.stop), t1 = fin(r.t1);
    if (!(isFinite(entry) && entry > 0 && isFinite(stop) && stop > 0 && entry !== stop && isFinite(t1) && t1 > 0))
      return null;
    var passed = fin(r.passed != null ? r.passed : r.gatesPassed);
    var total = fin(r.total != null ? r.total : r.gatesTotal);
    if (!isFinite(total) || total <= 0) total = 7;
    var detail = String(r.detail || '');
    var clean = !!(r.clean || (isFinite(passed) && passed >= 7) || /clean/i.test(detail));
    var near = !clean && !!(r.near || r.nearClean || (isFinite(passed) && passed === 6));
    var forming = !clean && !near && !!(r.forming || (isFinite(passed) && passed >= 5));
    var t2 = fin(r.t2);
    var risk = Math.abs(entry - stop);
    var rr = fin(r.rr);
    if (!isFinite(rr) && risk > 0) rr = Math.abs(t1 - entry) / risk;
    var row = {
      sym: sym,
      dir: dir,
      entry: entry,
      stop: stop,
      t1: t1,
      venue: (ticker && (ticker.exchange || ticker.venue)) || r.venue || opts.venue || '',
      rr: rr,
      passed: isFinite(passed) ? passed : undefined,
      gatesPassed: isFinite(passed) ? passed : undefined,
      gatesTotal: total,
      engine: src || 'engine',
      strategy: src || 'engine',
      clean: clean,
      near: near,
      nearClean: near,
      forming: forming,
      missing: Array.isArray(r.missing) ? r.missing.slice() : undefined,
      gateMeta: Array.isArray(r.gateMeta) ? r.gateMeta : undefined
    };
    if (isFinite(t2) && t2 > 0) row.t2 = t2;
    if (clean){ row.near = false; row.nearClean = false; row.forming = false; }
    return row;
  }

  function hgObtcCandidatesFromReport(report, ticker){
    var out = [], i, j, sec, r, c;
    if (!report) return out;
    if (report.plan && report.plan.ok && !isDerivedSource(report.plan.source)){
      c = hgObtcCandidateFromSignal(report.plan, ticker, { engine: report.plan.source });
      if (c) out.push(c);
    }
    var sections = report.sections || [];
    for (i = 0; i < sections.length; i++){
      sec = sections[i];
      if (!sec || !Array.isArray(sec.rows)) continue;
      for (j = 0; j < sec.rows.length; j++){
        r = sec.rows[j];
        if (!r || r.state !== 'signal') continue;
        c = hgObtcCandidateFromSignal(r, ticker, { engine: r.name });
        if (c) out.push(c);
      }
    }
    return out;
  }

  function hgObtcPick(cands){
    var btc = [], i, n, raw;
    for (i = 0; i < (cands || []).length; i++){
      raw = cands[i];
      n = gfn('hgNormalizeSetupRow') ? W.hgNormalizeSetupRow(raw) : (hgObtcHasLevels(raw) ? raw : null);
      if (!n || !hgObtcIsBtc(n.sym) || !hgObtcHasLevels(n)) continue;
      n.engine = raw.engine || raw.strategy || n.engine;
      n.strategy = raw.strategy || raw.engine || n.strategy;
      n.kind = raw.kind || n.kind;
      n.omniKind = raw.omniKind || n.omniKind;
      n.omniPrincipal = raw.omniPrincipal || n.omniPrincipal;
      n.venue = raw.venue || n.venue;
      n.passed = n.passed != null ? n.passed : raw.passed;
      n.gatesPassed = n.gatesPassed != null ? n.gatesPassed : raw.gatesPassed;
      n.gatesTotal = n.gatesTotal || raw.gatesTotal || 7;
      if (gfn('hgLiveFormationApply')){
        try{
          var live = gfn('hgLiveFormationSnap') ? W.hgLiveFormationSnap(n.sym, n.dir) : null;
          var app = W.hgLiveFormationApply(n, live, { preserveLevels: true });
          if (app && app.ok === false) continue;
          if (app && app.plan) n = app.plan;
        }catch(eLive){}
      }
      if (gfn('hgObtcApplyEvidence')){
        try{
          var evApp = W.hgObtcApplyEvidence(n, raw._extra || n._extra || null);
          if (evApp && evApp.ok === false) continue;
          if (evApp && evApp.row) n = evApp.row;
        }catch(eEv){}
      }
      n.engine = n.engine || raw.engine;
      n.strategy = n.strategy || raw.strategy;
      n.kind = n.kind || raw.kind;
      /* Carry the gate evidence the near-clean path dropped: setup-ui.js's
         MOST PROBABLE banner reads row.missing to NAME the exact gate that
         kept a 6/7 NEAR from printing 7/7 CLEAN (e.g. G6 R:R below the floor). */
      if (n.missing == null && Array.isArray(raw.missing)) n.missing = raw.missing.slice();
      if ((n.gateMeta == null || !n.gateMeta.length) && Array.isArray(raw.gateMeta)) n.gateMeta = raw.gateMeta;
      var prin = hgObtcApplyOmniPrincipal(n, { rows: raw._rows || n._rows });
      if (!prin.pickable) continue;
      btc.push(n);
    }
    if (!btc.length) return null;
    var pick = gfn('hgPickMostProbableAny') ? W.hgPickMostProbableAny(btc) : { row: btc[0], tier: 'clean', source: 'clean' };
    if (!pick || !pick.row || !hgObtcIsBtc(pick.row.sym) || !hgObtcHasLevels(pick.row)) return null;
    /* hg-v1051: MEASURED RANKING — when the ledger is armed, a CLEAN
       candidate from a PROVEN mechanic beats the rest; while records
       accumulate (every verdict unproven) the desk's own ranking stands.
       Fails open: the shared gate absent or unreadable changes nothing. */
    try{
      if (gfn('hgProvenEdgeVerdict') && btc.length > 1){
        var mechOf = function(r){ return String(r.omniKind || r.kind || r.engine || 'UNKNOWN').toUpperCase().slice(0, 28); };
        var pickMech = mechOf(pick.row);
        var pickV = W.hgProvenEdgeVerdict('omnibtc', pickMech, { pool: 'OMNIBTC', mechanic: pickMech });
        if (!(pickV && pickV.state === 'proven')){
          for (var bi = 0; bi < btc.length; bi++){
            if (!btc[bi].clean) continue;
            var bm = mechOf(btc[bi]);
            var bv = W.hgProvenEdgeVerdict('omnibtc', bm, { pool: 'OMNIBTC', mechanic: bm });
            if (bv && bv.state === 'proven'){
              pick = { row: btc[bi], tier: 'clean', source: 'measured-rank' };
              pick.row.measuredRanked = true;
              break;
            }
          }
        }
      }
    }catch(eMr){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eMr); }catch(eWm){} }
    var win = btc.filter(function(r){
      return r && r.sym === pick.row.sym && r.dir === pick.row.dir
        && r.entry === pick.row.entry && r.stop === pick.row.stop;
    })[0] || btc[0];
    pick.row.engine = pick.row.engine || win.engine;
    pick.row.strategy = pick.row.strategy || pick.row.engine;
    pick.row.kind = pick.row.kind || win.kind;
    pick.row.omniKind = pick.row.omniKind || win.omniKind;
    pick.row.omniPrincipal = pick.row.omniPrincipal || win.omniPrincipal;
    if (pick.row.missing == null && Array.isArray(win.missing)) pick.row.missing = win.missing.slice();
    if ((pick.row.gateMeta == null || !pick.row.gateMeta.length) && Array.isArray(win.gateMeta)) pick.row.gateMeta = win.gateMeta;
    return pick;
  }

  /* hg-v1035: THE PERFECT SETUP tier — the shared PERFECT formation predicate
     (hg-perfect-setup.js hgPerfectFormation) applied to the desk's ONE MOST
     PROBABLE crown. OmniBTC already combines every engine (technical) with
     the fundamental + sentiment stack (on-chain / term / F&G / 25Δ RR /
     calendar) at pick time — this tier is the SYNTHESIS that says the crown is
     max-confluence, never a gate and never a promise (the forward ledger
     measures the PERFECT cohort like every other mechanic).

     The desk's row is a different shape from the graded ranked rows the gold
     desks hand the predicate, so hgObtcPerfectCandidate adapts it honestly:
       grade  — 'A' when the row is a 7/7 CLEAN engine ticket (the desk's own
                max bar); a near/watch row is NOT top grade and never perfect.
       tally  — the gates-passed count (the desk's positive-confluence proxy;
                clean carries 6+ and clear 7/7 rows carry 7).
       oppose — 0: the OMNIROUTE principal and the evidence pass in hgObtcPick
                already dropped every row a decisive read opposed.
     The evidence legs the desk actually holds (real CVD/taker flow, the event
     calendar blackout, perp funding) ride the reads bag; a leg the desk does
     not read stays null and neither confirms nor denies (the honest third
     state). */
  function hgObtcPerfectCandidate(r){
    if (!r) return null;
    var clean = !!r.clean;
    var tally = (typeof r.passed === 'number' && isFinite(r.passed)) ? r.passed
      : (typeof r.gatesPassed === 'number' && isFinite(r.gatesPassed)) ? r.gatesPassed
      : (clean ? 7 : 0);
    return {
      sym: r.sym, dir: r.dir, entry: r.entry, stop: r.stop, t1: r.t1,
      grade: clean ? 'A' : null,
      tally: tally,
      oppose: 0,
      demoted: !!(r.demoted), vetoed: !!(r.vetoed)
    };
  }

  function hgObtcPerfectFormation(pick, reads){
    if (!pick || !pick.row || !hgObtcHasLevels(pick.row)) return { perfect: false, plus: false, why: ['no pick or levels'] };
    var r = pick.row;
    var c = hgObtcPerfectCandidate(r);
    if (!c) return { perfect: false, plus: false, why: ['no candidate'] };
    if (typeof hgPerfectFormation !== 'function') return { perfect: false, plus: false, why: ['perfect stack absent'] };
    var pf = hgPerfectFormation(c, reads || {});
    r.perfect = pf.perfect ? true : undefined;
    r.perfectPlus = pf.plus ? true : undefined;
    r.perfectWhy = (pf.why && pf.why.length) ? pf.why : undefined;
    return pf;
  }

  function hgObtcPerfectStamp(r){
    try{
      if (!r || r.perfect !== true) return '';
      if (typeof hgPerfectStamp !== 'function') return '';
      var c = hgObtcPerfectCandidate(r);
      if (!c) return '';
      /* prefer the stamped verdict so the banner agrees with the ledger */
      c.perfectPlus = (r.perfectPlus === true);
      return hgPerfectStamp(c);
    }catch(e){ return ''; }
  }

  /* hg-v1039: THE FUNDING WITNESS — the same one-rule read the shared
     PERFECT formation consumes (hgFundingAgainstMark), printed beside the
     pick so the crowding verdict that shaped the crown is visible.
     Caution, never a gate. */
  function hgObtcFundingWitnessHtml(snap, pick){
    try{
      if (!snap || !pick || !pick.row || !pick.row.dir) return '';
      var fp = null;
      var legs = snap.legs || [];
      for (var li = 0; li < legs.length; li++){
        var l = legs[li];
        if (l && l._ticker && typeof l._ticker.fundingPct === 'number' && isFinite(l._ticker.fundingPct)){
          fp = l._ticker.fundingPct; break;
        }
      }
      if (fp === null || typeof hgFundingAgainstMark !== 'function') return '';
      var m = hgFundingAgainstMark(fp, pick.row.dir);
      if (!m) return '';
      var cls = (m.against === true) ? 'warn' : 'ok';
      return '<div class="note ' + cls + '" style="margin-top:8px">'
        + '<b>FUNDING WITNESS</b> — funding ' + fp.toFixed(4) + '%/interval '
        + (m.against === true
          ? ('is CROWDED AGAINST this ' + esc(pick.row.dir) + ' (the crowd is already stacked on your side — squeeze risk; the shared PERFECT formation reads the same verdict).')
          : ('is not crowded for this ' + esc(pick.row.dir) + ' (the shared PERFECT formation reads the same verdict).'))
        + '</div>';
    }catch(e){ return ''; }
  }

  /* hg-v1041: the four remaining PERFECT evidence legs the shared predicate
     consumes (hg-perfect-setup.js) — the desk always held this data (the
     winner's own 4h tape) but never read it. RVOL = the fire bar's volume
     against the tape's own 20-bar mean (participation + volume witness). */
  function hgObtcFireRvol(rows){
    try{
      if (!Array.isArray(rows) || rows.length < 21) return NaN;
      var n = rows.length, last = rows[n - 1], sum = 0, cnt = 0, i;
      for (i = n - 21; i < n - 1; i++){ var v = +rows[i].v; if (isFinite(v) && v > 0){ sum += v; cnt++; } }
      if (!cnt) return NaN;
      var mean = sum / cnt, lv = +last.v;
      if (!isFinite(lv) || lv <= 0 || mean <= 0) return NaN;
      return lv / mean;
    }catch(e){ return NaN; }
  }

  function hgObtcStructureTrend(rows){
    try{
      if (!Array.isArray(rows) || rows.length < 200) return null;
      var emaFn = (typeof ema === 'function') ? ema : null;
      if (!emaFn) return null;
      var c = rows.map(function(r){ return +r.c; });
      var e50 = emaFn(c, 50), e200 = emaFn(c, 200);
      var a = e50[e50.length - 1], b = e200[e200.length - 1];
      if (!isFinite(a) || !isFinite(b)) return null;
      if (a > b) return 'up';
      if (a < b) return 'down';
      return 'range';
    }catch(e){ return null; }
  }

  /* hg-v1042: DAY-RANGE EXHAUSTION — today's hi-lo range against the
     trailing 20-day mean, read off the winner's own tape. A crown at
     85%+ consumed is chasing a move that may already be spent. */
  function hgObtcDayExhaustion(rows){
    try{
      if (!Array.isArray(rows) || rows.length < 30) return null;
      var days = {}, i, t, key, d;
      for (i = 0; i < rows.length; i++){
        t = +rows[i].t; if (!isFinite(t)) continue;
        key = String(Math.floor(t / 86400));
        d = days[key];
        if (!d) days[key] = { hi: rows[i].h, lo: rows[i].l };
        else { if (+rows[i].h > d.hi) d.hi = +rows[i].h; if (+rows[i].l < d.lo) d.lo = +rows[i].l; }
      }
      var keys = Object.keys(days).sort(), ranges = [], k;
      for (i = 0; i < keys.length; i++){
        var dd = days[keys[i]];
        if (dd.hi > dd.lo) ranges.push(dd.hi - dd.lo);
      }
      if (ranges.length < 5) return null;
      var prev = ranges.slice(-21, -1);
      if (!prev.length) return null;
      var mean = 0;
      for (k = 0; k < prev.length; k++) mean += prev[k];
      mean /= prev.length;
      if (!(mean > 0)) return null;
      return Math.round(ranges[ranges.length - 1] / mean * 100);
    }catch(e){ return null; }
  }

  /* hg-v1049: PLAN MATH + TIMEFRAME AGREEMENT — what the numbers REQUIRE
     (the break-even win rate at this R:R after costs) and whether the
     other timeframes agree with the pick. Arithmetic and facts, never a
     forecast. */
  function hgObtcPlanMathHtml(pick){
    try{
      if (!pick || !pick.row) return '';
      var r = pick.row, reads = r.perfectReads || {};
      var e = +r.entry, s = +r.stop, t1 = +r.t1;
      if (!(isFinite(e) && isFinite(s) && isFinite(t1) && Math.abs(e - s) > 0)) return '';
      var risk = Math.abs(e - s);
      var grossR = Math.abs(t1 - e) / risk;
      var costR = isFinite(reads.costR) ? +reads.costR : 0;
      var rows = [];
      if (typeof hgCryptoBreakevenWinRate === 'function'){
        var need = hgCryptoBreakevenWinRate(grossR, costR);
        if (need != null){
          rows.push('<div class="kv"><span class="k">Break-even requirement</span><span class="v">this plan needs ' + (need * 100).toFixed(0) + '% T1 wins to break even at ' + grossR.toFixed(1) + 'R after costs</span></div>');
        }
      }
      if (reads.tfAgree){
        rows.push('<div class="kv"><span class="k">Timeframe agreement</span><span class="v">' + esc(reads.tfAgree) + '</span></div>');
      }
      if (!rows.length) return '';
      return '<div class="panel" style="margin-top:10px"><h3>PLAN MATH <span>what the numbers require - arithmetic, not a forecast</span></h3>' + rows.join('') + '</div>';
    }catch(e){ return ''; }
  }

  /* hg-v1047: EXIT POLICY — the book's measured auto-rule for a ticket.
     Scale 50% at T1, trail the stop to breakeven, ride the rest. Evidence,
     never a guarantee — printed on tickets only, never on watches. */
  function hgObtcAutoRuleHtml(pick){
    try{
      if (!pick || !pick.row) return '';
      var r = pick.row;
      if (!isFinite(+r.t1) || String(pick.tier || 'clean').toLowerCase() !== 'clean') return '';
      var rr1 = (isFinite(+r.entry) && isFinite(+r.stop) && Math.abs(+r.entry - +r.stop) > 0 && isFinite(+r.t1))
        ? Math.abs(+r.t1 - +r.entry) / Math.abs(+r.entry - +r.stop) : NaN;
      var t2Txt = isFinite(+r.t2) ? ' move the stop to breakeven and ride the rest to T2' : ' move the stop to breakeven';
      return '<div class="panel" style="margin-top:10px"><h3>EXIT POLICY <span>the book\'s measured auto-rule — tScale 50, trail to breakeven</span></h3>'
        + '<div class="kv"><span class="k">At T1' + (isFinite(rr1) ? ' (' + rr1.toFixed(1) + 'R here)' : '') + '</span><span class="v">scale 50% of the position,' + t2Txt + ' — bank half at target, let the runner run</span></div>'
        + '</div>';
    }catch(e){ return ''; }
  }

  /* hg-v1049: the fire bar's session by UTC hour (the gold desks' own
     session map). Evidence, never a gate. */
  function hgObtcSessionOf(t){
    try{
      if (!isFinite(+t)) return null;
      var h = Math.floor((((+t % 86400) + 86400) % 86400) / 3600);
      if (h < 8) return 'ASIA';
      if (h < 12) return 'LONDON';
      if (h < 16) return 'NY-LONDON OVERLAP';
      return 'NY PM';
    }catch(e){ return null; }
  }

  /* hg-v1049: one tape's EMA9/EMA21 cascade direction — the agreement
     read per timeframe. Unreadable tape = no verdict, never a guess. */
  function hgObtcTapeDir(rows){
    try{
      if (!Array.isArray(rows) || rows.length < 30 || typeof W.ema !== 'function') return null;
      var c = rows.map(function(x){ return x.c; });
      var e9 = W.ema(c, 9), e21 = W.ema(c, 21);
      if (!e9 || !e21 || e9.length < 2) return null;
      var a = e9[e9.length - 1], b = e21[e21.length - 1];
      if (!isFinite(a) || !isFinite(b) || a === b) return null;
      return a > b ? 'long' : 'short';
    }catch(e){ return null; }
  }

  /* hg-v1054: THE CROWN VERDICT — every badge the desk earned for this
     pick in one line: engine, ticket tier, PERFECT formation, refined
     entry, the measured verdict and the timeframe agreement. */
  function hgObtcVerdictHtml(pick, snap){
    try{
      if (!pick || !pick.row) return '';
      var r = pick.row, bits = [];
      bits.push(String(r.engine || r.omniKind || 'CROWN').toUpperCase().slice(0, 24));
      bits.push(String(pick.tier || 'clean').toLowerCase() === 'clean' ? 'TICKET' : 'WATCH');
      if (r.perfectPlus) bits.push('PERFECT+');
      else if (r.perfect) bits.push('PERFECT');
      if (r.entryRefined) bits.push('REFINED ENTRY');
      var m = snap && snap.measured;
      if (m && m.state === 'proven') bits.push('EDGE PROVEN');
      else if (m && m.state === 'losing') bits.push('EDGE LOSING - STAND ASIDE');
      else bits.push('EDGE ACCUMULATING');
      var reads = r.perfectReads || {};
      if (reads.tfAgree) bits.push(String(reads.tfAgree));
      return '<div class="panel" style="margin-top:10px"><h3>CROWN VERDICT <span>the desk\'s complete verdict on this pick</span></h3>'
        + '<div style="font-size:12px;letter-spacing:.03em">' + esc(bits.join(' | ')) + '</div></div>';
    }catch(e){ return ''; }
  }

  /* hg-v1054: THE ENGINE SCOREBOARD — the desk's own settled record per
     engine (hgFwdPool on the OMNIBTC pool): which mechanics actually
     earn their crowns. Nothing renders with zero settled records. */
  function hgObtcScoreboardHtml(){
    try{
      if (typeof W.hgFwdPool !== 'function') return '';
      var pool = W.hgFwdPool('OMNIBTC');
      if (!pool || typeof pool !== 'object') return '';
      var keys = Object.keys(pool).filter(function(k){
        var s = pool[k]; return s && isFinite(s.samples) && s.samples >= 1;
      }).sort(function(a, b){
        var ea = isFinite(pool[b] && pool[b].expR) ? pool[b].expR : -999;
        var eb = isFinite(pool[a] && pool[a].expR) ? pool[a].expR : -999;
        return ea - eb;
      });
      if (!keys.length) return '';
      var rows = keys.slice(0, 8).map(function(k){
        var s = pool[k];
        var hit = isFinite(s.hit) ? (s.hit * 100).toFixed(0) + '%' : '--';
        var expR = isFinite(s.expR) ? ((s.expR > 0 ? '+' : '') + s.expR.toFixed(2) + 'R') : '--';
        return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v'
          + (isFinite(s.expR) && s.expR > 0 ? ' ok' : (isFinite(s.expR) && s.expR < 0 ? ' bad' : ''))
          + '">n=' + s.samples + ' - hit ' + hit + ' - expR ' + expR + '</span></div>';
      }).join('');
      return '<div class="panel" style="margin-top:10px"><h3>ENGINE SCOREBOARD <span>the desk\'s settled record per engine - which mechanics earn their crowns</span></h3>' + rows + '</div>';
    }catch(e){ return ''; }
  }

  /* the TRADE COST + TIMING WITNESSES — round-trip cost in R, session
     participation, day-range exhaustion and the cross-venue funding
     premium. All evidence, never a gate: they tell the operator what the
     levels cost and whether the tape is worth paying for. */
  function hgObtcEvidenceWitnessesHtml(pick){
    try{
      if (!pick || !pick.row) return '';
      var reads = pick.row.perfectReads || {}, rows = [];
      if (isFinite(reads.costR)){
        rows.push('<div class="kv"><span class="k">Round-trip cost</span><span class="v' + (reads.costR > 0.25 ? ' bad' : ' ok') + '">' + (+reads.costR).toFixed(2) + 'R of the risk window' + (reads.costR > 0.25 ? ' — COST-HEAVY: fees eat over a quarter of the stop' : '') + '</span></div>');
      }
      if (isFinite(reads.slotRvol)){
        rows.push('<div class="kv"><span class="k">Session participation</span><span class="v' + (reads.slotRvol < 0.7 ? ' bad' : ' ok') + '">' + (+reads.slotRvol).toFixed(2) + 'x the fire bar\'s own time-of-day norm' + (reads.slotRvol < 0.7 ? ' — QUIET HOURS: the slot is thin' : '') + (reads.sessName ? ' — ' + reads.sessName + ' session' : '') + '</span></div>');
      }
      if (reads.dayExhaustionPct != null){
        rows.push('<div class="kv"><span class="k">Day range</span><span class="v' + (reads.dayExhaustionPct >= 85 ? ' bad' : ' ok') + '">' + reads.dayExhaustionPct + '% consumed' + (reads.dayExhaustionPct >= 85 ? ' — CHASE RISK: the move may be spent' : '') + '</span></div>');
      }
      if (isFinite(reads.venueFundingPct) && isFinite(reads.btcFundingBinance)){
        var spread = reads.venueFundingPct - reads.btcFundingBinance;
        rows.push('<div class="kv"><span class="k">Venue premium</span><span class="v">Delta ' + (+reads.venueFundingPct).toFixed(4) + '% vs Binance ' + (+reads.btcFundingBinance).toFixed(4) + '% — spread ' + (spread >= 0 ? '+' : '') + spread.toFixed(4) + '%/interval' + (Math.abs(spread) > 0.01 ? ' (wide — locals price it differently)' : '') + '</span></div>');
      }
      if (reads.venuesAgree != null){
        var vBoth = reads.venuesAgree >= 2;
        var vTxt = vBoth
          ? (reads.venuesNames || 'both venues') + ' crown the same direction'
          : (reads.venuesScanned >= 2
            ? 'only ' + (reads.venuesNames || 'one venue') + ' crowns this direction — the other book reads against or nothing'
            : 'single venue only — no cross-venue confirmation');
        rows.push('<div class="kv"><span class="k">Venue confirmation</span><span class="v' + (vBoth ? ' ok' : '') + '">' + vTxt + '</span></div>');
      }
      if (pick.row.omniLiqStopCluster === true){
        rows.push('<div class="kv"><span class="k">Liquidation map</span><span class="v bad">the stop sits inside a liquidation cluster - SL-hunt risk (coinglass read)</span></div>');
      }
      if (pick.row.omniLiqFuel === true){
        rows.push('<div class="kv"><span class="k">Liquidation map</span><span class="v ok">liquidations fuel toward the trade side</span></div>');
      }
      if (pick.row.omniVolOverBudget === true){
        rows.push('<div class="kv"><span class="k">Volume budget</span><span class="v bad">volume targeting over budget - the expected move may be capped</span></div>');
      }
      if (reads.fillPct != null){
        rows.push('<div class="kv"><span class="k">Fill odds</span><span class="v">' + (+reads.fillPct).toFixed(0) + '% of past 12-bar windows touched this entry zone on this tape</span></div>');
      }
      if (reads.sweepCount != null){
        var swTxt = reads.sweepCount + '/' + reads.sweepLook + ' prior bars wicked through the stop width'
          + (reads.sweepCount >= 10 ? ' - the stop sits where noise trades' : '');
        rows.push('<div class="kv"><span class="k">Stop sensitivity</span><span class="v' + (reads.sweepCount >= 10 ? ' bad' : '') + '">' + swTxt + '</span></div>');
      }
      if (reads.markDistPct != null){
        var md = +reads.markDistPct;
        var mdTxt = Math.abs(md) < 0.5 ? 'mark sits ON the entry zone - the levels are live'
          : (md > 0 ? 'mark is ' + md.toFixed(1) + '% ABOVE the entry' : 'mark is ' + Math.abs(md).toFixed(1) + '% BELOW the entry');
        rows.push('<div class="kv"><span class="k">Mark distance</span><span class="v' + (Math.abs(md) < 0.5 ? ' ok' : '') + '">' + mdTxt + '</span></div>');
      }
      if (!rows.length) return '';
      return '<div class="panel" style="margin-top:10px"><h3>TRADE COST + TIMING WITNESSES <span>what the levels cost and whether the tape is worth paying for — evidence, never a gate</span></h3>' + rows.join('') + '</div>';
    }catch(e){ return ''; }
  }

  /* the PERFECT CRITERIA LEDGER — every leg the shared predicate consumed,
     printed with its measured value and verdict, so the ★ badge is fully
     auditable: what passed, what was read against (and therefore blocked
     PERFECT⁺), and what the desk could not read (the honest third state).
     A filter, not a promise. */
  function hgObtcPerfectLedgerHtml(pick){
    try{
      if (!pick || !pick.row || pick.row.perfect !== true) return '';
      var r = pick.row, reads = r.perfectReads || {}, rows = [];
      function row(name, verdict, note){
        var cls = verdict === 'WITH' ? 'ok' : (verdict === 'AGAINST' ? 'bad' : 'na');
        rows.push('<div class="kv"><span class="k">' + esc(name) + '</span><span class="v ' + cls + '">' + esc(verdict) + (note ? ' · ' + esc(note) : '') + '</span></div>');
      }
      var tally = (typeof r.passed === 'number' && isFinite(r.passed)) ? r.passed
        : (typeof r.gatesPassed === 'number' && isFinite(r.gatesPassed)) ? r.gatesPassed : null;
      var rr = null;
      if (isFinite(r.entry) && isFinite(r.stop) && isFinite(r.t1) && Math.abs(r.entry - r.stop) > 0){
        rr = r.dir === 'short' ? (r.entry - r.t1) / Math.abs(r.entry - r.stop) : (r.t1 - r.entry) / Math.abs(r.entry - r.stop);
      }
      rows.push('<div class="kv"><span class="k">Grade</span><span class="v ok">A — the desk\'s own max bar</span></div>');
      rows.push('<div class="kv"><span class="k">Opposing reads</span><span class="v ok">0 — the OMNIROUTE principal + evidence pass dropped every opposed row</span></div>');
      rows.push('<div class="kv"><span class="k">Confluence tally</span><span class="v ok">' + (tally != null ? tally : 'positive') + ' gates passed</span></div>');
      rows.push('<div class="kv"><span class="k">R:R</span><span class="v ok">' + (rr != null ? rr.toFixed(2) : 'unread') + ' vs the 0.25 floor</span></div>');
      var dir = r.dir;
      row('Taker flow', reads.takerFlowVerdict === 'with' ? 'WITH' : (reads.takerFlowVerdict === 'against' ? 'AGAINST' : 'UNREAD'),
        reads.takerFlowVerdict == null ? 'no CVD/taker prints for this crown' : (r.omniCvdWith === true ? 'CVD with' : 'CVD against'));
      row('Perp funding', reads.fundingAgainst === false ? 'WITH' : (reads.fundingAgainst === true ? 'AGAINST' : 'UNREAD'),
        reads.fundingAgainst == null ? 'no funding print on the venue leg' : 'the one hgFundingAgainstMark rule');
      row('Volatility regime', reads.atrRegime === 'HEALTHY' ? 'WITH' : (reads.atrRegime === 'BLOWOFF' ? 'AGAINST' : (reads.atrRegime === 'DEAD' ? 'NEUTRAL' : 'UNREAD')),
        reads.atrRegime == null ? 'ATR percentile unread' : 'ATR at the ' + Math.round(reads.atrPct) + 'th percentile of its trailing 100');
      var st = reads.structureTrend;
      if (st === 'up' || st === 'down'){
        var stWith = (dir === 'long') ? st === 'up' : st === 'down';
        row('Structure trend', stWith ? 'WITH' : 'AGAINST', '4h EMA50 ' + (st === 'up' ? 'above' : 'below') + ' EMA200 for a ' + esc(dir));
      } else row('Structure trend', 'UNREAD', '4h tape under 200 bars — EMA200 cannot warm');
      row('News calendar', reads.newsRisk === 'low' ? 'WITH' : (reads.newsRisk === 'blackout' ? 'AGAINST' : 'UNREAD'),
        reads.newsRisk == null ? 'no calendar verdict for this crown' : 'no high-impact event in the window');
      row('Session volume', reads.sess === 'participating' ? 'WITH' : (reads.sess === 'thin' ? 'AGAINST' : 'UNREAD'),
        isFinite(reads.volumeRvol) ? 'fire bar traded ' + (+reads.volumeRvol).toFixed(2) + 'x its 20-bar norm' : 'RVOL unread');
      row('Volume witness', (isFinite(reads.volumeRvol) && reads.volumeRvol >= 1.0) ? 'WITH' : (isFinite(reads.volumeRvol) && reads.volumeRvol < 0.6 ? 'AGAINST' : 'NEUTRAL'),
        isFinite(reads.volumeRvol) ? 'RVOL ' + (+reads.volumeRvol).toFixed(2) + ' vs the 0.6 / 1.0 house bars' : 'unread');
      var plus = (r.perfectPlus === true);
      var title = plus
        ? '★ PERFECT⁺ — every readable evidence leg is explicitly WITH: max confluence, nothing unknown'
        : '★ PERFECT — the always-computable bar passed and nothing readable runs against; ' + (r.perfectWhy && r.perfectWhy.length ? esc(r.perfectWhy.join(' · ')) : 'some evidence legs are unread or neutral, so the headline tier is not earned');
      return '<div class="panel" style="margin-top:10px"><h3>PERFECT CRITERIA LEDGER <span>every leg the predicate consumed, with its measured value — a filter, not a promise</span></h3>'
        + '<div class="note ' + (plus ? 'ok' : 'warn') + '">' + title + '</div>'
        + rows.join('') + '</div>';
    }catch(e){ return ''; }
  }

  function hgObtcDefaultLegs(){
    var dual = true;
    try{ if (gfn('hgDualScanEnabled')) dual = !!W.hgDualScanEnabled(); }catch(e){}
    var delta = { exchange: 'delta', sym: 'BTCUSD', base: 'BTC' };
    var cdcx = { exchange: 'coindcx', sym: 'B-BTC_USDT', base: 'BTC' };
    if (dual) return [delta, cdcx];
    var ex = (W.S && W.S.exchange) || 'delta';
    return ex === 'coindcx' ? [cdcx] : [delta];
  }

  function tickerOf(item){
    return {
      symbol: item.sym || item.symbol || 'BTCUSD',
      fundingPct: item.fundingPct,
      mark: item.mark,
      exchange: item.exchange || item.venue || ''
    };
  }

  async function hgObtcResolveLegs(){
    var out = [];
    if (gfn('xuUniverse')){
      try{
        var uni = await W.xuUniverse();
        out = hgObtcFilterUniverse(uni);
      }catch(e){ out = []; }
    }
    if (!out.length) out = hgObtcDefaultLegs();
    return hgObtcFilterUniverse(out);
  }

  async function loadBars(item, tf, n){
    if (gfn('xuCandles')){
      try{
        var rows = await W.xuCandles(item, tf, n);
        if (Array.isArray(rows) && rows.length) return rows;
      }catch(e){}
    }
    if (gfn('getCandles')){
      try{
        var g = await W.getCandles(item.sym || item.symbol, tf, n);
        if (Array.isArray(g) && g.length) return g;
      }catch(e2){}
    }
    return [];
  }

  function pushEngine(out, name, fn, ticker){
    try{
      var hit = fn();
      if (!hit) return;
      if (hit.dir && hit.entry != null && hit.t1 == null && hit.tp != null) hit.t1 = hit.tp;
      var c = hgObtcCandidateFromSignal(hit, ticker, { engine: name });
      if (c){
        hgObtcApplyOmniPrincipal(c);
        out.push(c);
      }
    }catch(e){}
  }

  function hgObtcCoverageMatrixHtml(){
    if (!gfn('hgOmniRenderCoverageMatrix')) return '';
    try{ return W.hgOmniRenderCoverageMatrix(); }catch(e){ return ''; }
  }

  function hgObtcOmniInfoHtml(rows){
    if (!rows || !rows.length) return '';
    var html = '<div class="note" style="margin-top:10px"><b>OMNIROUTE INFO</b> — vol target · CVD · liquidation map (report only)</div>';
    html += '<div class="cr-ind-wrap">';
    rows.forEach(function(r){
      html += '<div class="kv"><span class="k">' + esc(r.name) + '</span><span class="v">'
        + esc(r.state || '—') + (r.detail ? ' · ' + esc(r.detail) : '')
        + '</span></div>';
    });
    return html + '</div>';
  }

  function hgObtcRunLocalEngines(rows4h, rows1h, rows15m, ticker, rows1d, ledger){
    var out = [];
    var mins = 120;
    try{ if (gfn('tickClock')) mins = W.tickClock(); }catch(e){}
    if (gfn('swingTryClean'))
      pushEngine(out, 'SWING clean plan', function(){ return W.swingTryClean(rows4h, ticker); }, ticker);
    if (gfn('swingTryNear')){
      try{
        var near = W.swingTryNear(rows4h, ticker);
        if (near){
          near.nearClean = true;
          if (near.passed == null) near.passed = 6;
          var nc = hgObtcCandidateFromSignal(near, ticker, { engine: 'SWING near-clean watch' });
          if (nc){ nc.clean = false; nc.near = true; nc.nearClean = true; out.push(nc); }
        }
      }catch(e2){}
    }
    if (gfn('scalpTryClean'))
      pushEngine(out, 'SCALP clean plan', function(){ return W.scalpTryClean(rows1h, rows15m, ticker, mins); }, ticker);
    if (gfn('edgeSignal'))
      pushEngine(out, 'EDGE', function(){ return W.edgeSignal(rows4h); }, ticker);
    if (gfn('mrSignal'))
      pushEngine(out, 'MEAN REVERSION', function(){ return W.mrSignal(rows4h); }, ticker);
    if (gfn('rsAssess'))
      pushEngine(out, 'REVERSAL SNIPER', function(){ return W.rsAssess(rows4h, rows1h || rows4h, ticker); }, ticker);
    if (gfn('liqFlushSetup'))
      pushEngine(out, 'LIQUIDITY FLUSH', function(){
        var flush = gfn('hgLiveLiqFlushSetup') || W.liqFlushSetup;
        var snap = gfn('liqRecoverSnap') ? W.liqRecoverSnap() : null;
        return snap ? flush(snap, rows4h) : flush(rows4h, ticker);
      }, ticker);
    /* SQUEEZE. The tab header has always claimed squeeze and never called it.
       Wired the way squeeze.js wires itself: the pure classifier gives the
       direction, the gate evaluates it, and squeezePlan mints the levels — a
       BUILDING squeeze has no direction and therefore no ticket, which is the
       module's own rule, not a new one. */
    if (gfn('squeezeClassify') && gfn('squeezePlan') && rows4h && rows4h.length){
      try{
        var cls = W.squeezeClassify(rows4h, rows1d || null);
        var sqDir = null, sqKind = null;
        if (cls && cls.state === 'FIRED_LONG'){ sqDir = 'long';  sqKind = 'fired'; }
        else if (cls && cls.state === 'FIRED_SHORT'){ sqDir = 'short'; sqKind = 'fired'; }
        else if (cls && cls.donchianBreak){
          sqDir = (cls.donchianBreak === 'LONG') ? 'long' : 'short'; sqKind = 'break';
        }
        if (sqDir){
          var sqInp = { sym: ticker.symbol, dir: sqDir, cls: cls, kind: sqKind,
                        rows4h: rows4h, rows1h: rows1h || null, tick: ticker };
          if (gfn('squeezeGateEval')) sqInp.gate = W.squeezeGateEval(sqInp, sqDir);
          pushEngine(out, 'SQUEEZE ' + sqKind, function(){ return W.squeezePlan(sqInp); }, ticker);
        }
      }catch(eSq){}
    }

    /* TREND MATRIX. trendScore is a pure read over 1d + 4h; tmDirOf turns a
       composite at or beyond the module's own majority threshold into a
       direction, and anything short of that produces no ticket. */
    if (gfn('trendScore') && gfn('trendmxPlan') && rows4h && rows4h.length){
      try{
        var tsc = W.trendScore(rows1d || null, rows4h);
        if (tsc && isFinite(tsc.score) && Math.abs(tsc.score) >= 2){
          var tmInp = { sym: ticker.symbol, score: tsc.score, comps: tsc.comps,
                        rows4h: rows4h, rows1h: rows1h || null, tick: ticker };
          var tmDir = tsc.score > 0 ? 'long' : 'short';
          if (gfn('trendmxGateEval')) tmInp.gate = W.trendmxGateEval(tmInp, tmDir);
          pushEngine(out, 'TREND MATRIX', function(){ return W.trendmxPlan(tmInp); }, ticker);
        }
      }catch(eTm){}
    }

    /* PINE. pineScan() is a SNAPSHOT reader, not a per-symbol scanner — the
       PINE tab computes it. So this reads a BTC row if one is already there
       and contributes nothing when it is not. It never runs pine itself, and
       it never invents a signal pine did not produce. */
    if (gfn('pineScan')){
      try{
        var snap = W.pineScan();
        var list = (snap && (snap.rows || snap.signals || snap.results)) || null;
        if (Array.isArray(list)){
          list.forEach(function(sig){
            var sym = sig && (sig.sym || sig.symbol);
            if (!sym || !hgObtcIsBtc(sym)) return;
            var plan = sig.plan || sig;
            pushEngine(out, 'PINE ' + (sig.kind || sig.name || 'signal'),
                       function(){ return plan; }, ticker);
          });
        }
      }catch(ePn){}
    }

    if (gfn('hgOmniEvaluate')){
      try{
        var omniExtra = { rows1h: rows1h, rows15m: rows15m };
        try{ if (gfn('tickClock')) omniExtra.minsToFunding = W.tickClock(); }catch(eM){}
        var omni = W.hgOmniEvaluate({
          sym: ticker.symbol, base: 'BTC', exchange: ticker.exchange || 'delta'
        }, rows4h, null, omniExtra);
        if (Array.isArray(omni)){
          if (!omni.length){
            if (ledger){
              ledger.push({ name: 'OMNIROUTE evaluate', state: 'idle', dir: null,
                detail: 'no mechanic fired on BTC — indicator ledger still ran, no invented ticket' });
            }
          } else {
            omni.forEach(function(hit){
              var c = hgObtcCandidateFromOmniHit(hit, ticker);
              if (c) out.push(c);
              if (ledger){
                var why = c
                  ? (c.clean ? 'OMNIROUTE ticket after principal' : 'OMNIROUTE watch after principal')
                  : (hit && hit.plan && hit.plan.formationOk === false
                    ? 'formation refused — not a result'
                    : (hit && (hit.kindDemotion || (hit.plan && hit.plan.kindDemotion))
                      ? 'replay-demoted — not a result'
                      : 'mechanic fired but no honest levels on BTC'));
                ledger.push({ name: 'OMNIROUTE · ' + (hit && hit.kind ? hit.kind : 'hit'),
                  state: c ? (c.clean ? 'signal' : 'watch') : 'idle', dir: c && c.dir,
                  detail: why });
              }
            });
          }
        }
      }catch(e3){
        if (ledger){
          ledger.push({ name: 'OMNIROUTE evaluate', state: 'error', dir: null,
            detail: 'threw during BTC evaluate' });
        }
      }
    } else if (ledger){
      ledger.push({ name: 'OMNIROUTE evaluate', state: 'unchecked', dir: null,
        detail: 'module not loaded: hgOmniEvaluate' });
    }
    return out;
  }

  function waitHtml(){
    return '<div class="note" role="status">WAIT — after the OMNIROUTE principal, no BTC ticket with real ENTRY / STOP / T1 survived. '
      + 'Standing aside is the position. Nothing was invented.</div>';
  }

  function hgObtcPrincipalBannerHtml(){
    var html = '';
    try{
      if (gfn('hgOmniDeskStanceBannerHtml')) html += W.hgOmniDeskStanceBannerHtml() || '';
    }catch(eB){}
    try{
      if (gfn('hgFormationNightlyBannerHtml')) html += W.hgFormationNightlyBannerHtml() || '';
    }catch(eN){}
    html += '<div class="note warn" data-obtc-omni-principal="1" style="display:block;margin-bottom:10px">'
      + '<b>OMNIROUTE PRINCIPAL</b> — OMNIBTC applies the OMNIROUTE tab floors first '
      + '(replay demote, nightly aside, analogue map, desk-edge suppress/demote), then keeps one BTC result. '
      + 'SNIPER→PIN-REJECT, SMC→FVG-FILL, SQUEEZE→SQUEEZE-FIRE, SCALP→NR7-BREAK, MR→VWAP-REVERT. '
      + 'The map never invents a prefer. G1–G7 stay closed.</div>';
    return html;
  }

  function detailHtml(pick, omniInfo){
    if (!pick || !pick.row || !hgObtcHasLevels(pick.row)) return waitHtml();
    var r = pick.row;
    var tier = String(pick.tier || 'clean').toLowerCase();
    var clean = tier === 'clean';
    var html = '<div class="card" data-obtc-winner="1">';
    html += '<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap">';
    html += '<div><b>' + esc(r.sym) + '</b> ' + esc(String(r.dir || '').toUpperCase())
      + hgObtcPerfectStamp(r);
    html += '<div class="dim">' + esc(r.engine || r.strategy || 'engine');
    if (r.venue) html += ' · ' + esc(String(r.venue).toUpperCase());
    html += clean ? ' · ticket' : ' · watch only</div></div>';
    if (r.evidenceChips && r.evidenceChips.length){
      html += '<div class="dim" style="width:100%">' + esc(r.evidenceChips.join(' · ')) + '</div>';
    }
    if (gfn('hgBookStampChip')){
      try{ html += W.hgBookStampChip(r.sym, r.dir, { scanner: 'omnibtc', strategy: r.engine }); }catch(e){}
    }
    html += '</div>';
    if (gfn('hgStrategyTradeDetailHtml')){
      try{ html += W.hgStrategyTradeDetailHtml(r, { scanner: 'omnibtc', kind: r.engine }); }catch(e2){}
    }
    html += hgObtcOmniInfoHtml(omniInfo);
    if (gfn('hgSetupSolidityChipHtml')){
      try{ html += '<div style="margin-top:6px">' + W.hgSetupSolidityChipHtml(r) + '</div>'; }catch(eS){}
    }
    if (clean){
      html += '<div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">';
      if (gfn('bookBtnHTML')){
        try{
          html += W.bookBtnHTML(r.sym, r.dir, r.entry, r.stop, r.t1, {
            scanner: 'omnibtc', strategy: r.engine || 'omnibtc', venue: r.venue, t2: r.t2
          });
        }catch(e3){}
      }
      if (gfn('hgToTradePlanOnclickAttr')){
        try{
          html += '<button type="button" class="btn" onclick="'
            + W.hgToTradePlanOnclickAttr(r.sym, r.dir, r.entry, r.stop, r.t1, {
              scanner: 'omnibtc', strategy: r.engine, venue: r.venue, t2: r.t2
            })
            + '">SEND TO TRADE PLAN →</button>';
        }catch(e4){}
      }
      html += '</div>';
    } else {
      html += '<div class="note" style="margin-top:8px">Watch only — not trade-ready until a CLEAN engine ticket prints.</div>';
    }
    html += '</div>';
    return html;
  }

  function indicatorsHtml(indicators){
    if (!indicators || !indicators.length){
      return '<div class="note">No indicator bank ran — engines were missing or candles were too thin.</div>';
    }
    var html = '<div class="cr-ind-wrap">';
    indicators.forEach(function(ind){
      html += '<div class="kv"><span class="k">' + esc(ind.label) + '</span><span class="v">'
        + esc(ind.value) + (ind.note ? ' <span class="dim">' + esc(ind.note) + '</span>' : '')
        + '</span></div>';
    });
    return html + '</div>';
  }

  function ledgerHtml(report){
    if (!report || !report.sections){
      return '<div class="note">Engine ledger empty — contract-report.js did not run.</div>';
    }
    if (gfn('hgContractReportHTML')){
      try{ return W.hgContractReportHTML(report); }catch(e){}
    }
    var html = '';
    report.sections.forEach(function(sec){
      html += '<h4 style="margin:12px 0 6px;letter-spacing:.06em">' + esc(sec.label || sec.id) + '</h4>';
      (sec.rows || []).forEach(function(r){
        html += '<div class="kv"><span class="k">' + esc(r.name) + '</span><span class="v">'
          + esc(r.state || '—') + (r.dir ? ' · ' + esc(r.dir) : '')
          + (r.detail ? ' · ' + esc(r.detail) : '')
          + '</span></div>';
      });
    });
    return html;
  }

  function paint(ui, snap){
    if (!ui) return;
    var pick = snap && snap.pick;
    if (ui.stat){
      ui.stat.textContent = snap && snap.stat ? snap.stat : '';
    }
    if (ui.cards){
      ui.cards.innerHTML = '';
      if (pick && hgObtcHasLevels(pick.row)){
        if (gfn('hgPinMostProbablePanel')) W.hgPinMostProbablePanel(ui.cards, 'omnibtc', pick);
        else if (gfn('hgMpPin')) W.hgMpPin('omnibtc', [pick.row], pick.row.dir, ui.cards);
        else if (gfn('hgMostProbablePanelHTML')) ui.cards.innerHTML = W.hgMostProbablePanelHTML('omnibtc', pick);
      }
    }
    if (ui.detail){
      var dhtml = hgObtcVerdictHtml(pick, snap) + (pick ? detailHtml(pick, snap && snap.omniInfo) : waitHtml());
      if (snap && snap.fundamental && gfn('hgObtcFundamentalPanelHtml')){
        try{ dhtml += W.hgObtcFundamentalPanelHtml(snap.fundamental) || ''; }catch(eFu){}
      }
      dhtml += hgObtcFundingWitnessHtml(snap, pick);
      dhtml += hgObtcEvidenceWitnessesHtml(pick);
      dhtml += hgObtcPerfectLedgerHtml(pick);
      if (snap && snap.measured && gfn('hgProvenEdgeChipHtml')){
        try{
          /* hg-v1052: the settled T1 hit rate beside the verdict — the
             ledger settles T1-first by design, so the hit rate IS the
             T1 rate; the runner is recorded but never graded. Compare
             it with the break-even requirement PLAN MATH prints above. */
          var meHit = '';
          if (isFinite(snap.measured.hit) && snap.measured.n >= (snap.measured.floor || 20)){
            meHit = '<div class="kv"><span class="k">Settled T1 hit rate</span><span class="v">'
              + (snap.measured.hit * 100).toFixed(0) + '% over n=' + snap.measured.n
              + ' - the ledger settles T1-first; the T2 runner is not graded</span></div>';
          }
          var meNote = (snap.measured.state === 'losing' && gfn('hgProvenEdgeBlockedNoteHtml'))
            ? W.hgProvenEdgeBlockedNoteHtml(snap.measured) : '';
          dhtml += '<div class="panel" style="margin-top:10px"><h3>MEASURED EDGE <span>the desk\'s own settled record for this mechanic — the shared proven-edge gate, judged at its evidence floor</span></h3>'
            + W.hgProvenEdgeChipHtml(snap.measured) + meHit + meNote + '</div>';
        }catch(eChip){}
      }
      dhtml += hgObtcAutoRuleHtml(pick);
      dhtml += hgObtcPlanMathHtml(pick);
      dhtml += hgObtcScoreboardHtml();
      ui.detail.innerHTML = dhtml;
    }
    /* hg-v1011: the desk's own forward book under the card — does the crown
       pay. Rides the drop-in panel every other recording desk renders; the
       module absent leaves the mount's note standing, never a throw. */
    if (ui.fwd){
      try{ if (gfn('hgFwdPanelHTML')) ui.fwd.innerHTML = W.hgFwdPanelHTML('OMNIBTC') || ''; }catch(eFp){}
    }
    if (ui.ind) ui.ind.innerHTML = indicatorsHtml(snap && snap.indicators);
    if (ui.ledger){
      var extraHtml = '';
      if (snap && snap.extraLedger && snap.extraLedger.length){
        extraHtml = '<h4 style="margin:12px 0 6px;letter-spacing:.06em">EXTRA BTC ENGINES</h4>';
        snap.extraLedger.forEach(function(r){
          extraHtml += '<div class="kv"><span class="k">' + esc(r.name) + '</span><span class="v">'
            + esc(r.state || '—') + (r.dir ? ' · ' + esc(r.dir) : '')
            + (r.detail ? ' · ' + esc(r.detail) : '')
            + '</span></div>';
        });
      }
      ui.ledger.innerHTML = extraHtml + ledgerHtml(snap && snap.report);
    }
  }

  function setStat(ui, msg){
    __obtc.lastStat = msg;
    if (ui && ui.stat) ui.stat.textContent = msg;
  }

  async function hgObtcRunScan(ui){
    ui = ui || __obtc.ui;
    if (!ui) return 'no ui';
    if (__obtc.busy) return 'busy';
    __obtc.busy = true;
    if (ui.btn) ui.btn.disabled = true;
    setStat(ui, 'scanning BTC…');
    try{
      var legs = await hgObtcResolveLegs();
      legs = hgObtcFilterUniverse(legs);
      if (!legs.length){
        var snap0 = { pick: null, legs: [], candidates: [], stat: 'no BTC contract on the venue', indicators: [], report: null };
        __obtc.snap = snap0;
        __obtc.ran = true;
        paint(ui, snap0);
        setStat(ui, snap0.stat);
        return snap0.stat;
      }
      var all = [];
      var reports = [];
      var indicators = [];
      var extraLedger = [];
      var extra = {};
      var winnerRows = null;
      var i, item, tk, r4, r1, r15, r1d, cands, rep, extraRun;
      for (i = 0; i < legs.length; i++){
        item = legs[i];
        if (!hgObtcIsBtc(item.sym || item.symbol)) continue;
        tk = tickerOf(item);
        r4 = await loadBars(item, '4h', 220);
        r1 = await loadBars(item, '1h', 180);
        r15 = await loadBars(item, '15m', 180);
        /* the 1d leg is what squeezeClassify and trendScore read for the
           higher-timeframe agreement they gate on; without it both degrade to
           an honest zero rather than a guess */
        r1d = await loadBars(item, '1d', 260);
        if (gfn('hgLiveFormationGather')){
          try{ await W.hgLiveFormationGather(tk.symbol, { ticker: tk, fetch: true }); }catch(eG){}
        }
        extra = extra || {};
        if (gfn('hgObtcGatherExtra')){
          try{ extra = await W.hgObtcGatherExtra(tk.symbol, tk) || extra; }catch(eX){}
        }
        if (gfn('hgContractReportRun')){
          try{
            rep = W.hgContractReportRun({
              sym: tk.symbol, venue: tk.exchange, ticker: tk,
              rows4h: r4, rows1h: r1, rows15m: r15,
              takerSeries: extra && extra.takerSeries
            });
            reports.push(rep);
            cands = hgObtcCandidatesFromReport(rep, tk);
            if (rep.indicators && rep.indicators.length && !indicators.length) indicators = rep.indicators;
          }catch(eRep){
            rep = null;
            cands = [];
          }
        } else {
          rep = null;
          cands = [];
        }
        cands = cands.concat(hgObtcRunLocalEngines(r4, r1, r15, tk, r1d, extraLedger));
        if (gfn('hgObtcRunExtraEngines')){
          try{
            extraRun = W.hgObtcRunExtraEngines(r4, r1, r15, tk, extra);
            if (extraRun && Array.isArray(extraRun.candidates))
              cands = cands.concat(extraRun.candidates);
            if (extraRun && Array.isArray(extraRun.ledger) && extraRun.ledger.length)
              extraLedger = extraLedger.concat(extraRun.ledger);
          }catch(eEx){}
        }
        cands.forEach(function(c){ c._rows = r4; c._rows1 = r1; c._rows15 = r15; c._rows1d = r1d; c._ticker = tk; c._extra = extra; });
        all = all.concat(cands);
      }
      /* hg-v1002: the fundamental read is taken once per scan from the
         same extra bag the candidates carried into the pick, and rendered
         under the card whether the desk picked or waited. */
      var fundamental = null;
      if (gfn('hgObtcFundamentalRegime')){
        try{ fundamental = W.hgObtcFundamentalRegime(extra || {}); }catch(eFu){}
      }
      var pick = hgObtcPick(all);
      if (pick && pick.row && gfn('hgPostGateSetupVeto')){
        try{
          var vetoTk = (all.filter(function(c){
            return c.sym === pick.row.sym && c.dir === pick.row.dir
              && c.entry === pick.row.entry;
          })[0] || {})._ticker || { symbol: pick.row.sym };
          var vetoRows = (all.filter(function(c){
            return c.sym === pick.row.sym && c.entry === pick.row.entry;
          })[0] || {})._rows;
          var veto = await W.hgPostGateSetupVeto(vetoTk, pick.row, vetoRows, 'swing', gfn('getCandles') || gfn('xuCandles'));
          if (veto && veto.ok === false){
            all = all.filter(function(c){
              return !(c.sym === pick.row.sym && c.dir === pick.row.dir
                && c.entry === pick.row.entry && c.stop === pick.row.stop);
            });
            pick = hgObtcPick(all);
          }
        }catch(eVt){}
      }
      if (pick && pick.row && gfn('hgChartVisionAnalyze') && gfn('hgChartVisionFormationBoost')){
        try{
          var vRows = (all.filter(function(c){
            return c.sym === pick.row.sym && c.entry === pick.row.entry;
          })[0] || {})._rows;
          var analysis = await W.hgChartVisionAnalyze(Object.assign({}, pick.row, { rows: vRows, rows4h: vRows }));
          var boost = W.hgChartVisionFormationBoost(pick.row.dir, analysis);
          if (typeof boost === 'number' && boost <= -10){
            pick.row.clean = false;
            pick.row.near = true;
            pick.row.nearClean = true;
            pick.tier = 'near';
          }
        }catch(eVi){}
      }
      var winRep = null;
      var omniInfo = [];
      if (pick && pick.row && reports.length){
        winRep = reports.filter(function(r){ return r && hgObtcIsBtc(r.sym) && r.sym === pick.row.sym; })[0] || reports[0];
        if (winRep && winRep.indicators) indicators = winRep.indicators;
        if (winRep && winRep.sections){
          var osec = winRep.sections.filter(function(s){ return s.id === 'omniinfo'; })[0];
          if (osec && osec.rows) omniInfo = osec.rows;
        }
      }
      if (pick && pick.row){
        var pfReadsEntryRefined = false;   /* hg-v1051: refinement stamp for the record */
        var match = all.filter(function(c){
          return c.sym === pick.row.sym && c.dir === pick.row.dir
            && c.entry === pick.row.entry && c.stop === pick.row.stop;
        })[0];
        winnerRows = match && match._rows;
        /* hg-v1051: ENTRY-EDGE REFINEMENT — the pick's entry is snapped
           to the structure edge the house exact-entry seam prices (edge
           signal / swing enrichment on the winner's own tape), then
           re-verified: the refined plan must still clear the 2.0R floor
           or the refinement is REFUSED and the original levels stand.
           The reads bag, the PERFECT formation, the measured tier and
           the forward record all consume the refined levels. */
        try{
          if (gfn('hgApplyExactEntry') && winnerRows && winnerRows.length >= 60 && pick.row.dir){
            var refined = W.hgApplyExactEntry(Object.assign({}, pick.row, { type: 'SWING' }), winnerRows, { style: 'swing', preferEdge: true });
            if (refined && refined.entry != null && refined.stop != null && refined.t1 != null
                && isFinite(+refined.entry) && isFinite(+refined.stop) && isFinite(+refined.t1)){
              var rrAfter = Math.abs(+refined.t1 - +refined.entry) / Math.max(1e-9, Math.abs(+refined.entry - +refined.stop));
              if (isFinite(rrAfter) && rrAfter >= 2.0 && Math.abs(+refined.entry - +pick.row.entry) > 1e-9){
                pick.row.entry = +refined.entry;
                pick.row.stop = +refined.stop;
                pick.row.t1 = +refined.t1;
                if (isFinite(+refined.t2)) pick.row.t2 = +refined.t2;
                pick.row.rr = rrAfter;
                pick.row.rr1 = rrAfter;
                if (isFinite(+pick.row.t2)) pick.row.rr2 = Math.abs(+pick.row.t2 - +pick.row.entry) / Math.abs(+pick.row.entry - +pick.row.stop);
                pick.row.entryRefined = true;
                pfReadsEntryRefined = true;
              }
            }
          }
        }catch(eRef){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eRef); }catch(eWr){} }
        if (omniInfo.length){
          omniInfo.forEach(function(r){
            var det = String(r.detail || '');
            if (/Vol targeting/.test(r.name || '')) pick.row.omniVolOverBudget = /over budget/i.test(det);
            if (/CVD/.test(r.name || '')) pick.row.omniCvdWith = (r.state === 'signal');
            else if (/CVD/.test(r.name || '') && r.state === 'idle' && /against/.test(det)) pick.row.omniCvdWith = false;
            if (/Liquidation map/.test(r.name || '')) pick.row.omniLiqStopCluster = /stop sits inside/i.test(det);
            else if (/Liquidation map/.test(r.name || '') && /fuel toward/i.test(det)) pick.row.omniLiqFuel = true;
          });
        }
        /* rows/tab ride along on the solidity opts so the SMC wrapper around
           hgSetupSolidityApply can compute context on the winner leg's 4h
           candles. pick.row is a normalised copy that carries no candles of its
           own, which is why the rows have to be handed over here. v731: the
           wrapper enriches before scoring and setup-solidity.js folds the grade
           in via smcPts, so this path CAN move the score and tier. */
        if (gfn('hgSetupSolidityApply')) W.hgSetupSolidityApply(pick.row, { asset: 'crypto', rows: winnerRows, tab: 'OMNIBTC' });
        if (gfn('hgStrategyRefine') && winnerRows && winnerRows.length){
          try{
            W.hgStrategyRefine(pick.row, winnerRows, {
              scanner: 'omnibtc', kind: pick.row.engine || 'setup'
            });
          }catch(eRef){}
        }
        /* hg-v1035: THE PERFECT SETUP tier — stamp the crown with the shared
           formation predicate, reading the desk's own evidence: real CVD/
           taker flow, the event-calendar blackout, and perp funding. A leg
           the desk did not read stays null (neither confirms nor denies). */
        var pfReads = {};
        /* hg-v1046: VENUE CONFIRMATION — how many of the scanned venues
           crown the pick's own direction. A crown echoed by both Delta and
           CoinDCX is confirmed by two independent books; a single-venue
           crown is a single book. Evidence, never a gate. */
        try{
          var agreeVenues = {};
          var ci;
          for (ci = 0; ci < all.length; ci++){
            var cc = all[ci];
            if (!cc || cc.dir !== pick.row.dir) continue;
            if (cc._ticker && cc._ticker.exchange) agreeVenues[String(cc._ticker.exchange)] = true;
          }
          var venueList = Object.keys(agreeVenues);
          pfReads.venuesAgree = venueList.length;
          pfReads.venuesNames = venueList.join(' + ');
          pfReads.venuesScanned = legs.length;
        }catch(eVen){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eVen); }catch(eWv){} }
        try{
          if (fundamental && fundamental.blackout) pfReads.newsRisk = 'blackout';
          if (pick.row.omniCvdWith === true) pfReads.takerFlowVerdict = 'with';
          else if (pick.row.omniCvdWith === false) pfReads.takerFlowVerdict = 'against';
          if (match && match._ticker && typeof match._ticker.fundingPct === 'number' && isFinite(match._ticker.fundingPct)
              && typeof hgFundingAgainstMark === 'function'){
            var fam = hgFundingAgainstMark(match._ticker.fundingPct, pick.row.dir);
            if (fam) pfReads.fundingAgainst = (fam.against === true);
          }
          /* hg-v1041: the four remaining evidence legs the shared predicate
             consumes — read off the winner's own 4h tape the desk already
             holds. Unreadable stays null: neither confirms nor denies. */
          if (winnerRows && winnerRows.length >= 21){
            try{
              var rvolW = hgObtcFireRvol(winnerRows);
              if (isFinite(rvolW)){
                pfReads.volumeRvol = rvolW;
                pfReads.sess = (rvolW >= 0.6) ? 'participating' : 'thin';
              }
            }catch(eRv){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eRv); }catch(eW2){} }
            try{
              if (typeof hgAtrPercentile === 'function'){
                var atrP = hgAtrPercentile(winnerRows, 14, 100);
                if (isFinite(atrP)){
                  pfReads.atrRegime = atrP < 20 ? 'DEAD' : (atrP > 80 ? 'BLOWOFF' : 'HEALTHY');
                  pfReads.atrPct = atrP;
                }
              }
            }catch(eAt){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eAt); }catch(eW3){} }
          }
          if (winnerRows && winnerRows.length >= 200){
            try{
              var stT = hgObtcStructureTrend(winnerRows);
              if (stT) pfReads.structureTrend = stT;
            }catch(eSt){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eSt); }catch(eW4){} }
          }
          /* hg-v1042: the cost + timing witnesses — round-trip cost in R,
             time-of-day participation, day-range exhaustion and the
             cross-venue funding spread. Evidence, never a gate. */
          if (pick.row.entry != null && pick.row.stop != null && typeof hgCryptoCostR === 'function'){
            try{
              var costR = hgCryptoCostR(+pick.row.entry, +pick.row.stop, 'taker', 'taker');
              if (isFinite(costR)) pfReads.costR = costR;
            }catch(eCst){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eCst); }catch(eW5){} }
          }
          if (winnerRows && winnerRows.length >= 21 && typeof hgSlotMeanVol === 'function'){
            try{
              var slot = hgSlotMeanVol(winnerRows, 20);
              if (slot && isFinite(slot.mean) && slot.mean > 0){
                var lvSlot = +winnerRows[winnerRows.length - 1].v;
                if (isFinite(lvSlot) && lvSlot > 0) pfReads.slotRvol = lvSlot / slot.mean;
              }
            }catch(eSlt){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eSlt); }catch(eW6){} }
          }
          if (winnerRows && winnerRows.length >= 30){
            try{
              var dex = hgObtcDayExhaustion(winnerRows);
              if (dex != null) pfReads.dayExhaustionPct = dex;
            }catch(eDx){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eDx); }catch(eW7){} }
          }
          if (extra && typeof extra.btcFundingBinance === 'number' && isFinite(extra.btcFundingBinance)){
            pfReads.btcFundingBinance = extra.btcFundingBinance;
          }
          if (match && match._ticker && typeof match._ticker.fundingPct === 'number' && isFinite(match._ticker.fundingPct)){
            pfReads.venueFundingPct = match._ticker.fundingPct;
          }
          /* hg-v1050: SETUP ACCURACY reads - how often this entry zone
             actually fills on the winner tape (hgFillProbability, the
             house 12-bar touch rate) and how often noise wicks through
             the full stop width (prior bars that traded the whole risk
             distance on the wrong side). Facts about the tape, never a
             forecast. */
          try{
            if (typeof hgFillProbability === 'function' && winnerRows && pick.row.entry != null){
              var fp = hgFillProbability(winnerRows, +pick.row.entry, pick.row.dir, null, 12);
              if (fp && fp.pct != null && isFinite(fp.pct)) pfReads.fillPct = fp.pct;
            }
          }catch(eFp){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eFp); }catch(eWf){} }
          try{
            if (winnerRows && winnerRows.length >= 45 && isFinite(+pick.row.entry) && isFinite(+pick.row.stop)){
              var riskPx = Math.abs(+pick.row.entry - +pick.row.stop);
              var sweeps = 0, look = 40;
              for (var si = winnerRows.length - look; si < winnerRows.length; si++){
                var sbar = winnerRows[si];
                if (!sbar) continue;
                var sl = +sbar.l, sh = +sbar.h;
                if (!isFinite(sl) || !isFinite(sh)) continue;
                if (pick.row.dir === 'long' && sl <= +pick.row.entry - riskPx) sweeps++;
                else if (pick.row.dir === 'short' && sh >= +pick.row.entry + riskPx) sweeps++;
              }
              pfReads.sweepCount = sweeps;
              pfReads.sweepLook = look;
            }
          }catch(eSw){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eSw); }catch(eWs){} }
          if (match && match._ticker && isFinite(+match._ticker.mark) && isFinite(+pick.row.entry) && +match._ticker.mark > 0){
            pfReads.markDistPct = (+match._ticker.mark - +pick.row.entry) / +pick.row.entry * 100;
          }
          /* hg-v1049: the fire bar's session and the multi-timeframe
             agreement, read off the tapes the desk already holds */
          if (winnerRows && winnerRows.length){
            try{ pfReads.sessName = hgObtcSessionOf(+winnerRows[winnerRows.length - 1].t); }catch(eSn){}
          }
          try{
            var tfList = [];
            var t4 = hgObtcTapeDir(winnerRows);
            if (t4) tfList.push('4h ' + (t4 === pick.row.dir ? 'WITH' : 'AGAINST'));
            var t1h = hgObtcTapeDir(match && match._rows1);
            if (t1h) tfList.push('1h ' + (t1h === pick.row.dir ? 'WITH' : 'AGAINST'));
            var t15 = hgObtcTapeDir(match && match._rows15);
            if (t15) tfList.push('15m ' + (t15 === pick.row.dir ? 'WITH' : 'AGAINST'));
            var t1d = hgObtcTapeDir(match && match._rows1d);
            if (t1d) tfList.push('1d ' + (t1d === pick.row.dir ? 'WITH' : 'AGAINST'));
            if (tfList.length) pfReads.tfAgree = tfList.join(' - ');
          }catch(eTf){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eTf); }catch(eWt){} }
        }catch(ePfR){}
        hgObtcPerfectFormation(pick, pfReads);
        pick.row.perfectReads = pfReads;   /* the ledger reads the same bag the predicate consumed */
        /* hg-v1047: THE MEASURED-EDGE TIER (the shared proven-edge gate).
           The desk's own settled forward record for this mechanic, judged
           at the desk evidence floor (hgDeskParam minEvidence, default 20)
           by hgFwdJudgeSample. Below the floor the crown still trades and
           the chip says so — accumulating mode, nothing blocked. A LOSING
           record AT the floor stands the desk aside: the crown stays
           visible with honest levels but becomes a watch, not a ticket —
           the same veto the gold desks run. The record keeps writing
           either way: the card is still recorded, which is the anti-
           deadlock invariant. */
        var measured = null;
        try{
          if (gfn('hgProvenEdgeVerdict')){
            var mechName = String(pick.row.omniKind || pick.row.kind || pick.row.engine || 'UNKNOWN').toUpperCase().slice(0, 28);
            measured = W.hgProvenEdgeVerdict('omnibtc', mechName, { pool: 'OMNIBTC', mechanic: mechName });
          }
        }catch(eMe){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eMe); }catch(eWm){} }
        if (measured && measured.state === 'losing'){
          pick.tier = 'near';
          pick.row.measuredStandAside = true;
        }
        if (measured && gfn('hgProvenEdgeTrack')){
          try{ W.hgProvenEdgeTrack('omnibtc', mechName, measured, {}); }catch(eTr){}
        }
        /* hg-v1011: THE PICK JOINS THE FORWARD BOOK. Every desk that crowns
           a setup writes it to hg-forward; this desk has crowned one MOST
           PROBABLE per scan for its whole life and never recorded one —
           nothing could ever answer "does the crown pay?". The record
           carries the winner leg's own tape (hg-v993's regime mark reads
           the series the desk held, 60+ bars required) and the ticker's
           funding (hg-v985's central mark). hg-v1046: the tf is the CROWN'S
           OWN grid — a 15m-priced scalp (SCALP / TRAP engines) records on
           the 15m book with the house 24-bar horizon instead of being
           graded on an 80-hour 4h window, and hands its own 15m tape under
           the `rows` carrier the shared mark reads first; swing-priced
           crowns keep the 4h book and the 20-bar horizon. The bar is the
           tape's own last closed bar (hg-v978), never the wall clock. Dedup
           keys on the levels, so a re-scan of the same crown records once.
           A watch-tier pick records with ticket:false — it is still the
           desk's output, marked for what it is. */
        try{
          if (gfn('hgFwdRecordScan') && winnerRows && winnerRows.length){
            var fwdTk = (match && match._ticker) || null;
            var fwdEng = String(pick.row.engine || '');
            var fwdScalp = /SCALP|TRAP/i.test(fwdEng);
            var fwdTf = fwdScalp ? '15m' : '4h';
            var fwdHorizon = fwdScalp ? 24 : 20;
            var fwdTape = fwdScalp
              ? ((match && Array.isArray(match._rows15) && match._rows15.length >= 60) ? match._rows15 : winnerRows)
              : winnerRows;
            var fwdLast = fwdTape[fwdTape.length - 1];
            var fwdRow = {
              sym: 'BTCUSD',
              dir: pick.row.dir,
              entry: +pick.row.entry, stop: +pick.row.stop, t1: +pick.row.t1,
              signalT: fwdLast && fwdLast.t,
              mark: fwdLast && fwdLast.c,
              fundingPct: (fwdTk && typeof fwdTk.fundingPct === 'number' && isFinite(fwdTk.fundingPct)) ? fwdTk.fundingPct : undefined,
              mechanic: String(pick.row.omniKind || pick.row.kind || pick.row.engine || 'UNKNOWN').toUpperCase().slice(0, 28),
              ticket: String(pick.tier || 'clean').toLowerCase() === 'clean',
              /* hg-v1035: the PERFECT / PERFECT⁺ read-marks — true when the
                 crown met the max-confluence bar at fire time, absent when it
                 did not. The ledger measures the PERFECT cohort against the
                 rest, exactly like every other mechanic. */
              perfect: (pick.row.perfect ? true : undefined),
              perfectPlus: (pick.row.perfectPlus ? true : undefined),
              /* hg-v1046: how many scanned venues crowned this direction —
                 the cross-venue confirmation read mark */
              venueAgreeCount: isFinite(pfReads.venuesAgree) ? pfReads.venuesAgree : undefined,
              /* hg-v1047: the measured-edge verdict for this mechanic —
                 recorded only once armed (proven / losing), never while
                 the floor has not been reached */
              measuredState: (measured && measured.state !== 'unproven') ? measured.state : undefined,
              /* hg-v1051: the entry was refined to the structure edge */
              entryRefined: (pfReadsEntryRefined ? true : undefined)
            };
            if (fwdScalp){ fwdRow.rows = fwdTape; } else { fwdRow.rows4h = winnerRows; }
            W.hgFwdRecordScan('OMNIBTC', fwdTf, [fwdRow], { horizonBars: fwdHorizon });
          }
        }catch(eFwd2){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eFwd2); }catch(eW){} }
      }
      var nClean = all.filter(function(c){ return c.clean; }).length;
      var stat = pick
        ? ('BTC · ' + legs.length + ' venue' + (legs.length === 1 ? '' : 's')
          + ' · ' + all.length + ' levelled read' + (all.length === 1 ? '' : 's')
          + ' · ' + nClean + ' CLEAN · one MOST PROBABLE')
        : ('BTC · ' + legs.length + ' venue' + (legs.length === 1 ? '' : 's')
          + ' · no engine produced a ticket — WAIT');
      var snap = {
        pick: pick,
        legs: legs,
        candidates: all.map(function(c){
          return { sym: c.sym, dir: c.dir, entry: c.entry, stop: c.stop, t1: c.t1, engine: c.engine, clean: !!c.clean, near: !!c.near };
        }),
        stat: stat,
        indicators: indicators,
        report: winRep,
        omniInfo: omniInfo,
        extraLedger: extraLedger,
        fundamental: fundamental,
        measured: measured,
        at: Date.now()
      };
      __obtc.snap = snap;
      __obtc.ran = true;
      paint(ui, snap);
      setStat(ui, stat);
      return stat;
    }catch(e){
      var fail = 'scan failed — nothing invented';
      setStat(ui, fail);
      if (ui.detail) ui.detail.innerHTML = waitHtml();
      return fail;
    }finally{
      __obtc.busy = false;
      if (ui.btn) ui.btn.disabled = false;
    }
  }

  function mountOmnibtc(el){
    if (!el) return;
    el.innerHTML =
      '<div class="panel">'
      + '<h2>OMNIBTC — Bitcoin only <span>OMNIROUTE principal first · then one MOST PROBABLE</span></h2>'
      + '<div class="note" style="margin-bottom:10px">BTC is the whole universe. House engines still read the coin — '
      + 'SWING, SCALP, EDGE, PINE, squeeze, mean-reversion, sniper, liquidity, SMART $, OI FLOW, funding-fade, '
      + 'COIL, DIV, TRAP, SMC, STAR TRADER, <b>OMNIROUTE (full ledger on 4H + 1H + 15m)</b> and the SEARCH report. '
      + 'The OMNIROUTE tab principal runs first: replay demote, nightly aside, analogue map, desk-edge suppress/demote. '
      + 'Only survivors become a result. Then the desk keeps <b>one</b> setup: 7/7 CLEAN with real ENTRY / STOP / T1; '
      + 'otherwise the nearest watch; otherwise WAIT. Extra engines never claim 7/7. G1–G7 stay as they are. '
      + 'The desk also reads the fundamental stack — Fear &amp; Greed extremes, Deribit options positioning, DVOL, BTC dominance and the event calendar — as evidence: '
      + 'a red-folder blackout refuses, a 2+-vote fundamental headwind demotes to watch, and the full read prints under the card.</div>'
      + hgObtcPrincipalBannerHtml()
      + '<div class="note" id="obtcStat" aria-live="polite">idle — press SCAN BTC.</div>'
      + '<div class="row" style="margin-top:8px"><button type="button" class="btn" id="obtcRun">SCAN BTC</button></div>'
      + '<div class="cards" id="obtcCards" style="margin-top:12px"></div>'
      + '<div id="obtcDetail" style="margin-top:12px"></div>'
      + '<h3 style="margin:18px 0 6px;letter-spacing:.08em;font-size:12px">FORWARD — DOES THE CROWN PAY?</h3>'
      + '<div id="obtcFwd" class="note">The crowned pick is recorded out-of-sample from the next scan on (hg-v1011) — the book fills as scans run and settles on bars that had not printed at the time.</div>'
      + '<h3 style="margin:18px 0 6px;letter-spacing:.08em;font-size:12px">INDICATOR BANK</h3>'
      + '<div id="obtcInd" class="note">Run a scan to read BTC.</div>'
      + '<h3 style="margin:18px 0 6px;letter-spacing:.08em;font-size:12px">STRATEGY LEDGER</h3>'
      + '<div id="obtcLedger" class="note">Every engine that ran — including the ones that said nothing.</div>'
      + '<h3 style="margin:18px 0 6px;letter-spacing:.08em;font-size:12px">OMNIROUTE COVERAGE</h3>'
      + '<div id="obtcMatrix">' + hgObtcCoverageMatrixHtml() + '</div>'
      + '</div>';
    var ui = {
      btn: el.querySelector('#obtcRun'),
      stat: el.querySelector('#obtcStat'),
      cards: el.querySelector('#obtcCards'),
      detail: el.querySelector('#obtcDetail'),
      fwd: el.querySelector('#obtcFwd'),
      ind: el.querySelector('#obtcInd'),
      ledger: el.querySelector('#obtcLedger')
    };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __obtc.ui = ui;
    ui.btn.addEventListener('click', function(){ return hgObtcRunScan(ui); });
    /* hg-v1011: the forward book renders on mount too — records from
       previous sessions are the point of an accumulating ledger. */
    try{ if (ui.fwd && gfn('hgFwdPanelHTML')) ui.fwd.innerHTML = W.hgFwdPanelHTML('OMNIBTC') || ui.fwd.innerHTML; }catch(eFm){}
    if (__obtc.snap) paint(ui, __obtc.snap);
  }

  function refreshOmnibtc(){
    return Promise.resolve().then(function(){
      if (__obtc.busy) return 'busy';
      if (!__obtc.ran) return 'skipped: not run yet';
      var ui = __obtc.ui;
      if (ui) return hgObtcRunScan(ui).then(function(){ return __obtc.lastStat || 'rescanned'; });
      return __obtc.lastStat || 'no ui mounted';
    }).catch(function(){ return 'refresh failed'; });
  }

  W.hgObtcIsBtc = hgObtcIsBtc;
  W.hgObtcFilterUniverse = hgObtcFilterUniverse;
  W.hgObtcCandidateFromSignal = hgObtcCandidateFromSignal;
  W.hgObtcCandidatesFromReport = hgObtcCandidatesFromReport;
  W.hgObtcReplayKind = hgObtcReplayKind;
  W.hgObtcApplyOmniPrincipal = hgObtcApplyOmniPrincipal;
  W.hgObtcCandidateFromOmniHit = hgObtcCandidateFromOmniHit;
  W.hgObtcPrincipalBannerHtml = hgObtcPrincipalBannerHtml;
  W.hgObtcPick = hgObtcPick;
  /* hg-v1053: the alert / auto-scan seam — the last crown in a light
     shape the unified Telegram batch and the background cycle read. */
  W.hgObtcSnap = function(){
    try{
      var s = __obtc.snap;
      if (!s || !s.pick) return null;
      var row = s.pick.row || {};
      return {
        at: s.at || null,
        tier: s.pick.tier || 'clean',
        pick: { row: {
          sym: row.sym || 'BTCUSD', dir: row.dir || null,
          entry: row.entry, stop: row.stop, t1: row.t1, t2: row.t2,
          engine: row.engine || null, omniKind: row.omniKind || null, kind: row.kind || null,
          perfect: row.perfect === true, perfectPlus: row.perfectPlus === true,
          measuredStandAside: row.measuredStandAside === true,
          measuredRanked: row.measuredRanked === true,
          entryRefined: row.entryRefined === true
        } },
        measured: s.measured ? { state: s.measured.state, n: s.measured.n, hit: s.measured.hit,
          expR: s.measured.expR, floor: s.measured.floor } : null
      };
    }catch(e){ return null; }
  };
  W.hgObtcPerfectCandidate = hgObtcPerfectCandidate;   /* hg-v1035: the PERFECT tier */
  W.hgObtcPerfectFormation = hgObtcPerfectFormation;
  W.hgObtcPerfectStamp = hgObtcPerfectStamp;
  W.hgObtcDefaultLegs = hgObtcDefaultLegs;
  W.hgObtcRunScan = hgObtcRunScan;
  /* exported so the engine wiring is testable on its own: which engines get
     called, and — more importantly — which correctly decline */
  W.hgObtcRunLocalEngines = hgObtcRunLocalEngines;
  W.hgObtcCoverageMatrixHtml = hgObtcCoverageMatrixHtml;
  W.hgObtcOmniInfoHtml = hgObtcOmniInfoHtml;
  W.hgObtcState = function(){
    try{ return __obtc.snap ? JSON.parse(JSON.stringify(__obtc.snap)) : null; }catch(e){ return null; }
  };
  W.HG_tabs = W.HG_tabs || [];
  W.HG_tabs.push({ id: 'omnibtc', label: 'OMNIBTC', mount: mountOmnibtc, refresh: refreshOmnibtc });
})();
