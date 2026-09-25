/* =============================================================================
   HARDGATE — gold-formation.js (hg-v698)

   ONE formation contract for every gold desk: OMNIGOLD, OMNIGOLD 1, NEW GOLD.

   WHY THIS FILE EXISTS.

   A recon of the three gold desks found them applying three different
   formation rules to the same instrument:

     hgOgFormation (venue stop floor + measured kind demotion + gold-setup-edge
       + gold-catalog)   OMNIGOLD only — 5 call sites; OG1 and NEW GOLD never.
     venue cost model    OMNIGOLD only. OG1 hard-coded a $5 SL floor and called
                         it "the same 0.125R bar"; NEW GOLD had no cost model.
     KILL-LIST v689      OMNIGOLD + NEW GOLD; OG1 never.
     measured-edge veto  OMNIGOLD + NEW GOLD; OG1 never.
     HTF tape            OMNIGOLD real, OG1 real, NEW GOLD FABRICATED
                         (tape: setup.dir — a card confirming itself).
     session / news      OMNIGOLD soft, OG1 gated, NEW GOLD none at all.
     desk-tab-params     none of the three.

   Three desks, one metal, three answers. This file is the single place the
   answer is computed. It OWNS NO THRESHOLDS OF ITS OWN: every number it
   applies is read back out of the function that already owned it —
   hgOgFormation / hgOgCostDrag / HG_OG_FORM_COST_R_MAX (omnigold.js),
   hgSolidityIsKilled / hgSolGateMeasuredEdge (hg-solidity.js), hgDeskParam
   (backtest-tab-params.js). The only numbers written down here are the
   measured session cohorts quoted below, each with its own n.

   THE CONFLUENCE CONTRACT (the one new rule).

   A gold setup is a TRADABLE card only when at least THREE independent
   confirmations stand on the CLOSED bar, drawn from THREE DISTINCT classes:

     structure       market structure / level / SMC evidence
     momentum        directional indicator read on the closed bar
     participation   volume, order flow, positioning
     session-htf     session window or higher-timeframe tape

   A class counts ONCE no matter how many reads inside it agree. That is the
   anti-inflation rule the crypto desk has run since fix pack 16 ("STRONG now
   requires 10 of 12 INDEPENDENT families, not 30 of 37 overlapping gates",
   fixpack16-core.js:134) and that brain.js states as its philosophy
   ("Conviction is INDEPENDENT LAYERS AGREEING", brain.js:8). Five momentum
   reads are one confirmation, not five.

   A setup short of three classes is NOT dropped and is NOT a ticket: it
   renders as WATCH with the missing class NAMED, so the reader learns what
   would have to appear for it to become tradable.

   WHY THREE AND NOT TWO OR FOUR. Three is the bar the gold desks already
   claim in their own copy — goldind.js:41 ">=3 independent agreeing reads",
   goldind.js:758 "Confluence-driven: >=3 independent agreeing reads on one
   side", newgold.js "triple confirmation" — and the bar brain.js uses for
   its lowest conviction tier (WATCH = 3 layers agree). It is not a new
   number; it is the number the desks were already printing while not
   enforcing it across independent classes.

   SESSION EVIDENCE (recon 3.3, computed from scripts/backtest-omnigold-
   results.json trades[], 8,132 filled, PAXGUSDT proxy 2026-03-27..09-10).
   UTC hour cohorts, gross R per trade:

     ASIA        00-06   n=2,320   gross +0.064   medCostR 0.51
     LONDON      07-11   n=1,430   gross -0.137   medCostR 0.68
     NY-OVERLAP  12-16   n=2,626   gross -0.081   medCostR 0.45
     NY-PM       17-20   n=1,044   gross +0.109   medCostR 0.57
     OFF         21-23   n=  712   gross -0.045   medCostR 0.81

   (hg-v910: this block was a SECOND copy of the table, still carrying the
   7,270-row generation — n=2,082 +0.097 for ASIA and so on — while the live
   HG_GOLD_SESSION_EVIDENCE below had already moved to the 8,155-row re-bake
   and the file has since moved again to 8,132. Two copies of a measurement
   are two things to drift, and this one drifted furthest. Both are now read
   back out of the cited file, and test-gold-evidence-citations.mjs
   re-derives them on every run.)

   THE RULE THAT FOLLOWS, and nothing more: the SESSION leg of the
   session-htf class confirms only inside a window whose measured gross is
   >= 0 — ASIA (+0.064 at n=2,320) and NY-PM (+0.109 at n=1,044). In LONDON
   (-0.137 at n=1,430), NY-OVERLAP (-0.081 at n=2,626) and OFF (-0.045 at
   n=712) the clock is not evidence FOR the trade, so it cannot be one of the
   three confirmations. Every sign is what it was across all three bakes. It is NOT a veto: the HTF-tape leg satisfies the same
   class, and the OMNIGOLD gate ledger keeps `session` soft exactly as it was.
   ASIA and OFF carry the source's own caveat (meta.proxyNote: PAXG trades
   24/7, so those buckets include weekend bars a spot broker never printed) —
   the caveat is printed wherever the ASIA leg is what confirmed.

   VENUE COST FLOOR. Delegated whole to hgOgFormation / hgOgCostDrag: a stop
   inside 1 / HG_OG_FORM_COST_R_MAX = 8x the venue round trip does not form.
   The constant is READ from omnigold.js at call time and never restated here,
   so a change there moves all three desks at once. If that machinery is not
   loaded the verdict FAILS CLOSED (not formed, reason named) rather than
   letting a desk print a tradable card no one has priced.

   ES5. No optional chaining, no arrow functions, no const/let. Never throws:
   every entry point returns a fail-closed verdict on any internal error.
   ============================================================================= */
(function(){
  'use strict';

  var G = (typeof window !== 'undefined') ? window
        : ((typeof globalThis !== 'undefined') ? globalThis : this);

  function fin(x){ var n = +x; return isFinite(n) ? n : NaN; }
  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function gfn(name){
    try { var f = G[name]; return (typeof f === 'function') ? f : null; } catch (e){ return null; }
  }

  /* --- the four confirmation classes ------------------------------------ */

  var HG_GOLD_CONF_CLASSES = ['structure', 'momentum', 'participation', 'session-htf'];
  var HG_GOLD_CONF_CLASS_LABEL = {
    structure:     'structure',
    momentum:      'momentum',
    participation: 'participation',
    'session-htf': 'session / HTF'
  };
  /* Three distinct classes. See the header for why three. */
  var HG_GOLD_CONF_MIN_CLASSES = 3;

  /* OMNIGOLD's 32-gate ledger, routed to classes. Only gates that are a
     DIRECTIONAL read on the closed bar appear here: geometry gates
     (plan-levels, stop-width, cost-drag, fill-path, fill-risk, level-fresh)
     are conditions of placeability, not evidence for the side, and counting
     them would inflate confluence with the desk's own plumbing. */
  var HG_GOLD_CONF_GATE_CLASS = {
    /* structure — the level / pattern / cross-family agreement */
    'consensus':         'structure',
    'zone-anchor':       'structure',
    'premium-discount':  'structure',
    /* momentum — directional indicators on the trigger bar */
    'trend':             'momentum',
    'ema-stack':         'momentum',
    'adx-trend':         'momentum',
    'rsi-zone':          'momentum',
    'session-vwap':      'momentum',
    /* participation — who is actually trading it.

       `inst-filter` IS DELIBERATELY NOT HERE, and this is the second half of
       the geometry-gate rule above. Its pass is not a read of participation
       at all: omnigold.js:4194 opens with `instOk = true`, :4197-4199 keeps
       it TRUE when goldind is not loaded ("goldind absent -> fail-open
       PASS"), and it turns false ONLY at :4200-4202 when the institutional
       filter actively DROPS the setup — which is a hard gate failing, so the
       card is already dead. `pass === true` on that row therefore means
       "nothing objected", never "participation confirms this side", and a
       class satisfied by nothing objecting is the inflation this contract
       exists to forbid. Measured on a volume-less gold feed (the ordinary
       spot-proxy case) it was the ONLY participation confirmation on every
       card, so the class was satisfied on 100% of them with no participation
       data read at all. Volume (`participation`) and the PAXG basis
       (`spot-basis`) are positive reads and stay; when both are dark the
       class is reported MISSING, which is the honest answer. */
    'participation':     'participation',
    'spot-basis':        'participation',
    /* session / HTF — the clock and the higher timeframe */
    'session':           'session-htf',
    'htf-daily':         'session-htf',
    'macro-realrate':    'session-htf',
    'dxy-inverse':       'session-htf',
    'gold-season':       'session-htf'
  };

  /* OMNIGOLD 1's 20-point matrix families, routed to the same four classes.
     Families come from omnigold1.js scoreMatrix add(block, pts, name, family). */
  var HG_GOLD_CONF_FAMILY_CLASS = {
    'Structure':       'structure',
    'Volume Profile':  'structure',
    'Trend':           'momentum',
    'Statistical':     'momentum',
    'Volatility':      'momentum',
    'Regime':          'momentum',
    'Flow':            'participation',
    'Positioning':     'participation',
    'Execution':       'participation',
    'Time':            'session-htf',
    'Macro':           'session-htf'
  };

  /* OMNIGOLD 1's matrix is labelled by FAMILY, and two of its rows carry a
     family whose other rows are real evidence while they themselves are
     PLACEABILITY reads — the same category the gate table above excludes
     (plan-levels / stop-width / cost-drag / fill-path / level-fresh):

       'Clean Path'                    omnigold1.js:666 — is there an LVN and
                                       no HVN/wall/naked-POC between entry and
                                       TP1. That is OMNIGOLD's `fill-path`
                                       gate under another name, and `fill-path`
                                       is excluded, so counting this one would
                                       hand OG1 a structure class for exactly
                                       the read OMNIGOLD is denied.
       'Volatility & Target Realism'   omnigold1.js:624 — is TP1 reachable
                                       inside the implied move. Whether the
                                       TARGET is realistic, not whether
                                       anything confirms the SIDE.

     Excluded by NAME because the family is shared with rows that are
     evidence ('Volume Profile & VPOC/HVN Rejection' is a real structural
     read; 'Regime Fit' is a real momentum read). 'Execution Quality' is
     deliberately NOT here: its pass REQUIRES rvOk — RVOL >= 0.7,
     omnigold1.js:649/652 — so it cannot pass on geometry alone and the
     participation it reports is measured. */
  var HG_GOLD_CONF_ROW_EXCLUDE = {
    'Clean Path': 1,
    'Volatility & Target Realism': 1
  };

  function hgGoldConfClassOfGate(key){
    var k = String(key === null || key === undefined ? '' : key);
    return Object.prototype.hasOwnProperty.call(HG_GOLD_CONF_GATE_CLASS, k)
      ? HG_GOLD_CONF_GATE_CLASS[k] : null;
  }
  function hgGoldConfClassOfFamily(fam){
    var k = String(fam === null || fam === undefined ? '' : fam);
    return Object.prototype.hasOwnProperty.call(HG_GOLD_CONF_FAMILY_CLASS, k)
      ? HG_GOLD_CONF_FAMILY_CLASS[k] : null;
  }

  /* --- measured session cohorts (recon 3.3; see header) ------------------ */

  /* Each row is a MEASURED cohort, not a preference. `confirms` is derived
     from `grossR >= 0` at read time so a re-bake of the numbers moves the
     rule without a second edit. */
  /* hg-v700 re-bake: 8,155-settled refresh (2026-03-27..09-10). Every
     cohort kept its SIGN from the 7,270-trade bake, so `confirms` behavior
     is unchanged — only the measured magnitudes moved. */
  var HG_GOLD_SESSION_EVIDENCE = [
    /* hg-v910: re-derived from the file this table cites. The numbers above
       were baked from an older generation of it — 8,155 rows against the
       8,132 it now holds — so the line that claimed the derivation
       "reproduces every line exactly" had stopped being true. medCostR was
       the one field that still matched on all five buckets, which is what
       said the METHOD was right and the data had moved under it.
       No verdict changes: confirms is grossR >= 0, and all five signs are
       what they were. */
    { from: 0,  to: 7,  key: 'ASIA',       label: 'ASIA 00-06 UTC',       n: 2320, grossR:  0.064, medCostR: 0.51, weekendCaveat: true },
    { from: 7,  to: 12, key: 'LONDON',     label: 'LONDON 07-11 UTC',     n: 1430, grossR: -0.137, medCostR: 0.68, weekendCaveat: false },
    { from: 12, to: 17, key: 'NY-OVERLAP', label: 'NY-OVERLAP 12-16 UTC', n: 2626, grossR: -0.081, medCostR: 0.45, weekendCaveat: false },
    { from: 17, to: 21, key: 'NY-PM',      label: 'NY-PM 17-20 UTC',      n: 1044, grossR:  0.109, medCostR: 0.57, weekendCaveat: false },
    { from: 21, to: 24, key: 'OFF',        label: 'OFF 21-23 UTC',        n:  712, grossR: -0.045, medCostR: 0.81, weekendCaveat: true }
  ];
  /* The source's own caveat, carried verbatim wherever a caveated window is
     what confirmed. scripts/backtest-omnigold-results.json meta.proxyNote. */
  var HG_GOLD_SESSION_WEEKEND_NOTE =
    'PAXG proxy trades 24/7, so this bucket includes weekend bars a spot broker never printed';

  /* -> { key, label, n, grossR, medCostR, confirms, why } for a UTC instant,
     or null when the instant is unreadable (fail closed: no session leg). */
  function hgGoldSessionEdge(when){
    try{
      var ms = NaN;
      if (when === null || when === undefined) ms = NaN;
      else if (typeof when === 'number') ms = (when < 1e12) ? when * 1000 : when;
      else if (typeof when === 'object' && typeof when.getTime === 'function') ms = when.getTime();
      else ms = fin(when);
      if (!isFinite(ms)) return null;
      var h = new Date(ms).getUTCHours();
      if (!isFinite(h)) return null;
      var i, r;
      for (i = 0; i < HG_GOLD_SESSION_EVIDENCE.length; i++){
        r = HG_GOLD_SESSION_EVIDENCE[i];
        if (h >= r.from && h < r.to){
          var confirms = r.grossR >= 0;
          return {
            key: r.key, label: r.label, n: r.n, grossR: r.grossR, medCostR: r.medCostR,
            confirms: confirms, weekendCaveat: !!r.weekendCaveat,
            why: r.label + ' measured gross ' + (r.grossR >= 0 ? '+' : '') + r.grossR.toFixed(3)
               + 'R at n=' + r.n + (confirms ? '' : ' — the clock is not evidence for this trade')
               + (confirms && r.weekendCaveat ? ' (' + HG_GOLD_SESSION_WEEKEND_NOTE + ')' : '')
          };
        }
      }
      return null;
    }catch(e){ return null; }
  }

  /* THE INSTANT THE COHORT IS KEYED ON: the SIGNAL BAR'S OPEN time, never
     the wall clock.

     Verified against the source rather than assumed, and RE-verified in
     hg-v910: bucketing scripts/backtest-omnigold-results.json trades[] by
     `new Date(t.tISO).getUTCHours()` over the 8,132 filled rows (rMultiple
     AND netR present) reproduces every line of HG_GOLD_SESSION_EVIDENCE,
     with grossR the mean rMultiple and medCostR the median of
     rMultiple - netR. test-gold-session-evidence.mjs re-runs that derivation
     against the committed file and fails on any drift, so this claim cannot
     go stale again without the suite saying so.

     The figures this paragraph carried before v910 — 7,270 rows, ASIA n=2082
     +0.097, LONDON n=1305 -0.080, NY-OVERLAP n=2247 -0.061, NY-PM n=994
     +0.053 — reproduce from NEITHER the table below NOR the current file.
     They were an older generation still, and they are recorded here rather
     than deleted because a number that once justified a live table is worth
     being able to recognise when it turns up somewhere else.
     OFF n=642 -0.011 — and `tISO` is the SIGNAL bar's own timestamp (the
     order fills on bar sigIdx+1, meta.rules.fill). So the leg is a property
     of the closed signal bar.

     A desk that passes Date.now() instead asks a different question: the
     SAME closed bar then answers FORMED at 18:00 UTC and WATCH at 09:00 UTC,
     so on a 5-minute auto-refresh a card changes verdict with no new data —
     the moving-target failure omnigold.js:4791 already documents for
     detectors. One helper, called by all three desks, so the clock cannot
     drift between them either. -> ms, or NaN when the bars are unreadable. */
  function hgGoldSignalBarMs(rows){
    try{
      if (!rows || !rows.length) return NaN;
      var b = rows[rows.length - 1];
      var t = fin(b && b.t);
      if (!isFinite(t)) return NaN;
      return (t < 1e12) ? t * 1000 : t;
    }catch(e){ return NaN; }
  }

  /* Re-decide ONE named confirmation against the measured session cohort.
     OMNIGOLD ('session'), OMNIGOLD 1 ('Session Volatility Filter') and NEW
     GOLD ('session window') all route through this, so the rule and its
     fail-closed wording exist once. Mutates and returns `confs`. */
  function hgGoldApplySessionLeg(confs, name, whenMs){
    try{
      var list = Array.isArray(confs) ? confs : [];
      var w = fin(whenMs);
      var sedge = isFinite(w) ? hgGoldSessionEdge(w) : null;
      var i;
      for (i = 0; i < list.length; i++){
        if (!list[i] || list[i].name !== name) continue;
        if (!sedge){
          list[i].ok = false;
          list[i].detail = 'session cohort unreadable on the closed signal bar — '
                         + 'the clock cannot confirm (fail closed)';
        } else {
          list[i].ok = list[i].ok === true && sedge.confirms === true;
          list[i].detail = String(list[i].detail || '') + ' · ' + sedge.why;
        }
      }
    }catch(e){}
    return confs;
  }

  /* --- the confluence verdict ------------------------------------------- */

  /* confirmations: [{ cls, name, detail, ok, inherent? }]. Only ok === true
     counts. Anything else is kept and reported as unconfirmed so the card can
     name what is missing rather than silently dropping it.

     INHERENT CLASSES (hg-v698 audit closeout). A desk may declare a
     confirmation `inherent: true` when the read is part of the SIGNAL'S OWN
     DEFINITION and therefore true on any fire — NEW GOLD's FVG (structure)
     and VWMA-regime + RSI-cross (momentum) ARE the triple-confirmation, so
     on a fired card those two classes are tautologies, not evidence that can
     revoke the card. An inherent class still counts toward the class bar
     (the reads are real), but it is REPORTED apart from the revocable ones
     so a "3/3 classes" chip cannot dress two tautologies up as independent
     confirmation. A confirmed class is `inherent` only when EVERY confirming
     read inside it is inherent; one revocable read makes the class revocable.

     opts.requireClasses: [clsName]. Each named class must itself be among
     the CONFIRMED classes or the verdict is WATCH regardless of the count —
     the explicit floor for a desk whose other classes are inherent, so its
     bar cannot silently weaken if a new always-true read appears later.

     Returns (never throws):
       { min, ok, state, classCount, count, present[], missing[],
         byClass{cls: [names]}, confirmed[], unconfirmed[],
         inherent[], revocable[], declaredInherent,
         requireClasses[], requiredMissing[], why } */
  function hgGoldConfluence(confirmations, opts){
    opts = opts || {};
    var min = isFinite(fin(opts.min)) ? Math.max(1, Math.round(fin(opts.min))) : HG_GOLD_CONF_MIN_CLASSES;
    var out = {
      min: min, ok: false, state: 'WATCH', classCount: 0, count: 0,
      present: [], missing: HG_GOLD_CONF_CLASSES.slice(),
      byClass: {}, confirmed: [], unconfirmed: [],
      inherent: [], revocable: [], declaredInherent: false,
      requireClasses: [], requiredMissing: [], why: ''
    };
    try{
      var list = Array.isArray(confirmations) ? confirmations : [];
      var i, c, cls;
      var allInherent = {};                 /* cls -> every confirming read inherent? */
      for (i = 0; i < list.length; i++){
        c = list[i];
        if (!c || typeof c !== 'object') continue;
        cls = String(c.cls || c['class'] || '');
        if (HG_GOLD_CONF_CLASSES.indexOf(cls) < 0) continue;   /* unknown class never counts */
        var rec = { cls: cls, name: String(c.name || cls), detail: String(c.detail || ''),
                    inherent: c.inherent === true };
        if (c.inherent === true) out.declaredInherent = true;
        if (c.ok === true){
          out.confirmed.push(rec);
          if (!out.byClass[cls]){ out.byClass[cls] = []; allInherent[cls] = true; }
          out.byClass[cls].push(rec.name);
          if (rec.inherent !== true) allInherent[cls] = false;
        } else {
          out.unconfirmed.push(rec);
        }
      }
      out.count = out.confirmed.length;
      var present = [], missing = [], k;
      for (i = 0; i < HG_GOLD_CONF_CLASSES.length; i++){
        k = HG_GOLD_CONF_CLASSES[i];
        if (out.byClass[k] && out.byClass[k].length) present.push(k);
        else missing.push(k);
      }
      out.present = present;
      out.missing = missing;
      out.classCount = present.length;
      for (i = 0; i < present.length; i++){
        if (allInherent[present[i]] === true) out.inherent.push(present[i]);
        else out.revocable.push(present[i]);
      }
      /* the explicit per-desk floor: every required class must be CONFIRMED */
      var req = [], rq = opts.requireClasses;
      if (Array.isArray(rq)){
        for (i = 0; i < rq.length; i++){
          var rk = String(rq[i] === null || rq[i] === undefined ? '' : rq[i]);
          if (HG_GOLD_CONF_CLASSES.indexOf(rk) >= 0 && req.indexOf(rk) < 0) req.push(rk);
        }
      }
      out.requireClasses = req;
      var reqMiss = [];
      for (i = 0; i < req.length; i++){
        if (present.indexOf(req[i]) < 0) reqMiss.push(req[i]);
      }
      out.requiredMissing = reqMiss;
      out.ok = present.length >= min && reqMiss.length === 0;
      out.state = out.ok ? 'FORMED' : 'WATCH';

      if (out.ok){
        var parts = [];
        for (i = 0; i < present.length; i++){
          parts.push(HG_GOLD_CONF_CLASS_LABEL[present[i]] + ' (' + out.byClass[present[i]].join(' + ') + ')');
        }
        out.why = out.count + ' independent confirmation' + (out.count === 1 ? '' : 's')
          + ' on the closed bar across ' + present.length + ' distinct class'
          + (present.length === 1 ? '' : 'es') + ': ' + parts.join(' · ');
      } else {
        var missLabels = [];
        for (i = 0; i < missing.length; i++) missLabels.push(HG_GOLD_CONF_CLASS_LABEL[missing[i]]);
        var haveLabels = [];
        for (i = 0; i < present.length; i++){
          haveLabels.push(HG_GOLD_CONF_CLASS_LABEL[present[i]] + ' (' + out.byClass[present[i]].join(' + ') + ')');
        }
        out.why = 'WATCH — ' + present.length + ' of ' + min + ' required confirmation classes'
          + (haveLabels.length ? ': ' + haveLabels.join(' · ') : ' (none confirmed)')
          + ' · MISSING ' + missLabels.join(', ');
        if (reqMiss.length){
          var reqLabels = [];
          for (i = 0; i < reqMiss.length; i++) reqLabels.push(HG_GOLD_CONF_CLASS_LABEL[reqMiss[i]] || reqMiss[i]);
          out.why += ' · REQUIRED class ' + reqLabels.join(', ')
            + ' is unconfirmed — this desk declares its other classes inherent to the signal,'
            + ' so it cannot form without this one';
        }
      }
      return out;
    }catch(e){
      /* fail closed: an unreadable confluence is not a confluence */
      out.why = 'WATCH — confluence could not be read (' + ((e && e.message) || e) + ')';
      return out;
    }
  }

  /* Build confirmations straight from an OMNIGOLD gate ledger. Only
     pass === true counts: an UNCHECKED (null) gate is not evidence. */
  function hgGoldConfluenceFromGates(gates){
    var out = [];
    try{
      var list = Array.isArray(gates) ? gates : [];
      var i, g, cls;
      for (i = 0; i < list.length; i++){
        g = list[i];
        if (!g) continue;
        cls = hgGoldConfClassOfGate(g.key);
        if (!cls) continue;
        out.push({ cls: cls, name: String(g.key), detail: String(g.why || ''), ok: g.pass === true });
      }
    }catch(e){}
    return out;
  }

  /* Build confirmations from an OMNIGOLD 1 matrix rows[] array
     ({ name, family, got, pts, evidence }). A row scores its class only when
     it actually earned points (got > 0). */
  function hgGoldConfluenceFromMatrix(rows){
    var out = [];
    try{
      var list = Array.isArray(rows) ? rows : [];
      var i, r, cls;
      for (i = 0; i < list.length; i++){
        r = list[i];
        if (!r) continue;
        cls = hgGoldConfClassOfFamily(r.family);
        if (!cls) continue;
        if (Object.prototype.hasOwnProperty.call(HG_GOLD_CONF_ROW_EXCLUDE, String(r.name || ''))) continue;
        out.push({ cls: cls, name: String(r.name || r.family), detail: String(r.evidence || ''),
                   ok: isFinite(fin(r.got)) && fin(r.got) > 0 });
      }
    }catch(e){}
    return out;
  }

  /* --- rendering --------------------------------------------------------- */

  /* THE HONEST HEADER (hg-v698 audit closeout). A desk that declared classes
     inherent does not get to print 'CONFLUENCE 3/3 classes' as if three
     independent legs confirmed: on NEW GOLD two of the three are the signal's
     own definition (structure = the FVG, momentum = VWMA regime + RSI cross —
     the triple-confirmation ITSELF), so the only class that can actually
     revoke the card is session-htf. This header states exactly that, in the
     desk's own idiom, and is used by the chip, the HTML block and the text
     line whenever `declaredInherent` is set. Desks with real multi-class
     independence (OMNIGOLD, OG1) never set the flag and render unchanged.
     -> '' when the confluence declared nothing inherent. */
  function hgGoldConfHonestHead(conf){
    try{
      if (!conf || typeof conf !== 'object' || conf.declaredInherent !== true) return '';
      var rev = Array.isArray(conf.revocable) ? conf.revocable : [];
      var inh = Array.isArray(conf.inherent) ? conf.inherent : [];
      return 'confluence: ' + rev.length + ' revocable class' + (rev.length === 1 ? '' : 'es')
        + (rev.length ? ' (' + rev.join(', ') + ')' : '')
        + ' + ' + inh.length + ' inherent to the signal — weaker bar than OMNIGOLD/OG1';
    }catch(e){ return ''; }
  }

  /* The named confirmations, and the classes that are missing, as one small
     block. Every string escaped. '' when there is nothing to say. */
  function hgGoldConfluenceHtml(conf){
    try{
      if (!conf || typeof conf !== 'object') return '';
      var i, h = '<div class="hg-gold-conf" data-hg-gold-conf="'
        + (conf.ok ? 'formed' : 'watch') + '" style="margin-top:6px;font-size:11px;line-height:1.5">';
      var honest = hgGoldConfHonestHead(conf);
      if (honest){
        h += '<b>' + (conf.ok ? '' : 'WATCH — ') + esc(honest) + '</b>';
      } else {
        h += '<b>' + (conf.ok ? 'CONFLUENCE ' : 'WATCH ') + esc(conf.classCount) + '/' + esc(conf.min)
           + ' classes</b>';
      }
      if (conf.confirmed && conf.confirmed.length){
        h += '<ul style="margin:3px 0 0 14px;padding:0">';
        for (i = 0; i < conf.confirmed.length; i++){
          h += '<li><b>' + esc(HG_GOLD_CONF_CLASS_LABEL[conf.confirmed[i].cls] || conf.confirmed[i].cls)
             + '</b> — ' + esc(conf.confirmed[i].name)
             + (conf.confirmed[i].detail ? ' <span class="dim">· ' + esc(conf.confirmed[i].detail) + '</span>' : '')
             + '</li>';
        }
        h += '</ul>';
      }
      if (conf.missing && conf.missing.length){
        var labels = [];
        for (i = 0; i < conf.missing.length; i++) labels.push(HG_GOLD_CONF_CLASS_LABEL[conf.missing[i]] || conf.missing[i]);
        h += '<div class="dim" style="margin-top:2px">missing class' + (labels.length === 1 ? '' : 'es')
           + ': ' + esc(labels.join(', ')) + '</div>';
      }
      h += '</div>';
      return h;
    }catch(e){ return ''; }
  }

  /* One plain-text line for text renderers (OMNIGOLD 1 prints text). */
  function hgGoldConfluenceLine(conf){
    try{
      if (!conf || typeof conf !== 'object') return '';
      var honest = hgGoldConfHonestHead(conf);
      if (honest) return (conf.ok ? '' : 'WATCH — ') + honest + ' — ' + conf.why;
      return (conf.ok ? 'CONFLUENCE ' : 'WATCH ') + conf.classCount + '/' + conf.min
        + ' classes — ' + conf.why;
    }catch(e){ return ''; }
  }

  /* --- measured-evidence reads, each through the owning function --------- */

  /* KILL-LIST (hg-solidity.js hgSolidityIsKilled, v689: n>=30 & expR<-0.5)
     plus the measured-edge veto (hgSolGateMeasuredEdge, v685: n>=20 &
     expR<-0.25), read for ONE (tab, mechanic) pair. No thresholds here — both
     live in hg-solidity.js and are read back through it.
     -> { killed, kill, edgePass, edge, unreadable, reasons[] }. Missing
     helper = the check did not run; it never invents a pass or a kill.

     A THROWING kill-check is NOT "not killed". Until hg-v698's audit closeout
     this caught the throw and read on as killed:false — which is the fail-OPEN
     direction: the one check that can prove a mechanic measured-losing errors
     out, and the card trades anyway. The header's contract is that every
     entry point returns a FAIL-CLOSED verdict on any internal error, and for
     an evidence read that errors the fail-closed direction is STAND ASIDE:
     `unreadable: true`, reason named, and hgGoldFormation refuses to form. */
  function hgGoldEvidenceRead(opts){
    opts = opts || {};
    var out = { killed: false, kill: null, edgePass: true, edge: null, ran: false,
                unreadable: false, reasons: [] };
    try{
      var tab = String(opts.tab || ''), kind = String(opts.kind || '');
      if (!tab || !kind) return out;
      var killFn = gfn('hgSolidityIsKilled');
      if (killFn){
        out.ran = true;
        var k = null, killErr = null;
        try { k = killFn(tab, kind); } catch (eK){ k = null; killErr = eK; }
        if (killErr !== null){
          out.unreadable = true;
          out.reasons.push('evidence unreadable — the KILL-LIST check (hgSolidityIsKilled) threw for '
            + kind + ' on ' + tab + ': ' + ((killErr && killErr.message) || killErr)
            + ' — killed:false cannot be claimed from an error, so the desk stands aside (fail closed)');
        }
        out.kill = k;
        if (k && k.killed === true){
          out.killed = true;
          out.reasons.push('KILL-LIST — ' + kind + ' on ' + tab + ' measured expR '
            + (isFinite(fin(k.expR)) ? fin(k.expR).toFixed(2) : '?') + 'R over ' + (k.samples || 0)
            + ' settled outcomes, below the -0.5R kill floor');
        }
      }
      var edgeFn = gfn('hgSolGateMeasuredEdge');
      if (edgeFn){
        out.ran = true;
        var e = null;
        try { e = edgeFn(opts.plan || {}, { tab: tab, kind: kind }); } catch (eE){ e = null; }
        out.edge = e;
        if (e && e.pass === false){
          out.edgePass = false;
          out.reasons.push('measured-edge veto — ' + kind + ' on ' + tab + ' expR '
            + (isFinite(fin(e.expR)) ? fin(e.expR).toFixed(2) : '?') + 'R over ' + (e.samples || 0)
            + ' settled outcomes, below the -0.25R floor');
        }
      }
      return out;
    }catch(e){ return out; }
  }

  /* --- the unified formation verdict ------------------------------------- */

  /* setup: { kind, horizon, dir, plan:{entry,stop,t1}, rows }
     opts:  { tab, mechanic, alsoKinds[], confirmations[], min }

     Order of operations, all fail-closed:
       1  hgOgFormation (omnigold.js) — venue stop floor (1/HG_OG_FORM_COST_R_MAX
          = 8x the venue round trip), measured kind demotion, gold-setup-edge
          suppress/demote/prefer, gold-catalog exclude. MISSING or THROWING =>
          not formed. Run once per kind in [setup.kind].concat(alsoKinds) so a
          hybrid card is judged on its underlying mechanic too.
       2  hgGoldEvidenceRead — KILL-LIST (kills) + measured-edge veto (demotes).
       3  hgGoldConfluence — >= 3 distinct confirmation classes, else WATCH.

     -> { formed, tradable, state, reasons[], confluence, og, ogAll[],
          evidence, venue, drag, stopFloor?, kindDemotion?, deskParams } */
  /* ---------- hg-v949: the gold trading calendar ----------

     GOLD IS SHUT from Friday 22:00 UTC to Sunday 22:00 UTC (DST-aware; the
     one definition is hgInGoldWeekend in indicators2.js and this delegates to
     it rather than re-deriving the edges -- a second copy of a calendar is a
     second calendar). OMNIGOLD has vetoed inside that window since hg-v420.
     The desks that route through THIS function never had the rule at all.

     Why it is not merely historical hygiene: getXAUCandles walks a feed chain
     (XM -> Delta XAUTUSD -> Binance PAXG -> proxy), and the last two are 24/7
     crypto tokens. So on a Saturday a desk reading that chain is handed bars
     and will mint an XAUUSD ticket nobody can take, at a price no broker
     quoted.

     WHAT IT MEASURED ON: NEW GOLD's only settled record is walked on
     PAXGUSDT, whose own artifact meta says "24/7 weekend bars a broker never
     printed". Nine of its nineteen trades formed inside the gold weekend and
     the desk's entire positive reading is those nine (+0.2403R net at XM);
     the tradeable subset is n=10, gross +0.0000R, net -0.0568R, win 40.0%
     against the 40.0% its own 1.5R ladder demands. n=10 carries NO verdict
     and none is claimed -- the finding is that the quoted number was not
     measured on a population the desk can trade, not that the desk loses.
     Re-derive: node scripts/gold-weekend-population.mjs

     THE INSTANT IS THE SIGNAL BAR, NEVER Date.now(). A scan re-run on Monday
     over Friday's bars must give the same answer it gave on Friday, and a
     wall-clock read would flip it. Callers pass opts.atMs; there is
     deliberately no rows fallback, because the three desks here make an
     identical rows-less call by design and adding one would break that.

     FAILS OPEN at every seam: no atMs, an unreadable atMs, or indicators2.js
     absent and the verdict is null -- the setup stands exactly as before. A
     calendar this desk cannot read is not a reason to withhold a setup. */
  /* hg-v963 -- THE GOLD NEWS GATE, AS A SHARED ROUTE KEYED ON THE SIGNAL BAR.

     `hgGoldNewsGate` (goldind.js) has locked new gold minting 30 min before
     and 15 min after CPI / NFP / FOMC / GDP since hg-v554, and it works:
     driven on a real snapshot it locks at -10 min and +10 min around a CPI
     instant and releases by +3h. It is reached inside hgGoldInstFilter, which
     reads `ctx.news` and `ctx.nowMs`.

     THE GATE IS NOT MISSING ON THE OTHER DESKS -- IT IS DEFEATED, three
     different ways, and the distinction matters because two of them are one
     literal each:

       1. `news: null` HARDCODED. GOLD ULTRA (2 sites) and GOLD DIRECTION
          (3 sites) call the gated mint and hand it a literal null. The gate
          then returns { lock:false, unchecked:true } -- FAIL-OPEN BY
          CONSTRUCTION, every scan, forever. Proved by driving it. And the
          snapshot they needed is a global their sibling SUPER GOLD already
          reads (`window.hgNewsState()`), so nothing was unavailable.
       2. NO news read at all -- OPTI GOLD, GOLD PRO, NEW GOLD, 80PERCENT,
          the same four raw-bar minters hg-v950 named. These are REPORTED by
          the coverage reporter below and deliberately not wired here:
          withholding on a desk that never had the read changes what leaves
          the board, and this pack fixes what is broken before widening.
       3. PRESENT BUT ON THE WALL CLOCK -- GOLD PINE passes `news` and never
          sets `nowMs`, so the gate dates the lock by Date.now() instead of
          the bar being judged. That is the hg-v952 SUPER GOLD defect in a
          third place: a scan re-run after the window gives the wrong answer
          in both directions.

     So the rule lives once, here, and DELEGATES to hgGoldNewsGate rather than
     re-deciding what a tier-1 event is -- a second copy of a calendar is a
     second calendar (hg-v949). The instant is the SIGNAL BAR, never the wall
     clock. It fails OPEN at every seam: no instant, an unreadable one, no
     snapshot, or goldind absent, and there is no verdict and nothing is
     withheld, because a gate the desk cannot read is not a reason to withhold
     a setup. */
  function hgGoldNewsSnapshot(){
    try{
      var fn = gfn('hgNewsState');
      if (typeof fn !== 'function') return null;
      var snap = fn();
      return (snap && typeof snap === 'object') ? snap : null;
    }catch(e){ return null; }
  }

  function hgGoldNewsVerdict(atMs, snapArg){
    try{
      var t = atMs;
      if (t === null || t === undefined || t === '') return null;
      t = +t;
      if (!isFinite(t)) return null;
      /* the same epoch-zero refusal the weekend rule makes, for the same
         reason: 0 is a readable number and an unreadable instant, and a gate
         must not answer on the second (hg-v953). */
      if (!(t > 0)) return null;
      var ms = (Math.abs(t) < 1e12) ? t * 1000 : t;
      var gate = gfn('hgGoldNewsGate');
      if (typeof gate !== 'function') return null;
      var snap = (snapArg === undefined) ? hgGoldNewsSnapshot() : snapArg;
      /* No snapshot is NOT "no news" -- it is no reading, and the gate says so
         itself via `unchecked`. Returning a cheerful open verdict here would
         reproduce the `news: null` defect this function exists to remove. */
      if (!snap) return null;
      var v = gate(snap, ms);
      if (!v || typeof v !== 'object') return null;
      if (v.unchecked) return null;
      return { atMs: ms, locked: !!v.lock, title: v.title || null,
               why: v.lock
                 ? ((v.reason || 'tier-1 gold news window')
                    + ' — judged at the signal bar '
                    + new Date(ms).toISOString().replace('T', ' ').slice(0, 16)
                    + ' UTC, not the wall clock. The card and its evidence stay; '
                    + 'only the trade handoff is withheld.')
                 : '' };
    }catch(e){ return null; }
  }

  /* hg-v965 -- THE NEWS LOCK AS A MARK, IN THE SHAPE THE RAW-BAR DESKS ALREADY USE.

     optigold.js, eightypercent.js and tauric.js each carry a BYTE-IDENTICAL
     weekend wrapper: look the calendar up, return the verdict only when it
     says shut, null otherwise. Writing three matching NEWS wrappers beside
     them would make SIX copies of one rule, and hg-v949 is explicit that a
     second copy of a calendar is a second calendar. So the "null unless it
     locks" shape lives HERE, once, and those desks call it directly with no
     wrapper of their own -- their call sites carry a typeof guard and nothing
     else, so there is no rule in them to drift.

     It DELEGATES to hgGoldNewsVerdict and therefore inherits every seam that
     function already fails open at: no instant, an unreadable one, epoch zero
     (hg-v953), no snapshot, or a snapshot the gate itself reads as unchecked.
     It adds no calendar and no threshold. */
  function hgGoldNewsMark(tSec, snapArg){
    try{
      var v = hgGoldNewsVerdict(tSec, snapArg);
      return (v && v.locked === true) ? v : null;
    }catch(e){ return null; }
  }

  function hgGoldWeekendVerdict(atMs){
    try{
      var t = atMs;
      if (t === null || t === undefined || t === '') return null;
      t = +t;
      if (!isFinite(t)) return null;
      /* hg-v953: and NOT epoch zero. '' and 0 both coerce to 0 here, which is
         1970-01-01 -- a THURSDAY, so an unreadable instant read as "gold was
         open" and marked a candidate accordingly, silently. That is the
         +null === 0 trap this codebase has now hit repeatedly; an instant
         at or before the epoch is not a gold bar, it is a failed read, and a
         failed read must produce NO verdict rather than a cheerful one. */
      if (!(t > 0)) return null;
      /* accept seconds or milliseconds, the convention hgGoldSignalBarMs uses */
      var ms = (Math.abs(t) < 1e12) ? t * 1000 : t;
      var fn = gfn('hgInGoldWeekend');
      if (typeof fn !== 'function') return null;
      var shut = fn(ms / 1000);
      if (shut !== true && shut !== false) return null;
      return { atMs: ms, inWeekend: !!shut,
               why: shut
                 ? ('formed at ' + new Date(ms).toISOString().replace('T', ' ').slice(0, 16)
                    + ' UTC, inside the gold weekend (Fri 22:00 - Sun 22:00 UTC, DST-aware). '
                    + 'XAUUSD prints no bar then: this candle came from a 24/7 crypto proxy in the feed chain, '
                    + 'so the level is one no broker quoted and the ticket is one nobody could take. '
                    + 'The card and its evidence stay; only tradable is withheld.')
                 : '' };
    }catch(e){ return null; }
  }

  /* hg-v953 -- THE MARK THE MINT ITSELF CARRIES.
     GOLD SCALP and GOLD SWING were listed here as covered "via own weekend
     read". They do read one -- in the tab SHELL, in runScan, on the WALL
     CLOCK. The functions this reporter probes (goldScalpSetups in goldind.js,
     goldSwingSetups in goldswing.js) contain no calendar at all; goldind.js
     has not one weekend reference in the whole file. So the claim was false
     about the thing being probed, which is hg-v952's failure one layer down.

     What that cost, beyond the reporter: every consumer of the mint that is
     not the tab shell got NO weekend awareness -- GOLD PINE's goldScalpSetups
     call, the OMNIGOLD bridge, STAR TRADER, and both replay harnesses. The
     swing walk's own meta lists "weekend demotes" among the runScan stages it
     does NOT replay, so the committed GOLD SCALP walk -- the one the
     suppress/demote/prefer table is measured on -- was formed on PAXGUSDT
     24/7 bars with no weekend mark of any kind.

     This MARKS and does not withhold, deliberately, for two reasons. The
     shell already demotes on the live path, and a second withhold there would
     move the board on evidence this pack did not gather. And the replay rows
     need the mark precisely so the population can be SEPARATED later -- which
     is how NEW GOLD's record came to be half weekend without anyone noticing
     (hg-v949), and the TAURIC precedent from hg-v952.

     The instant is the SIGNAL BAR: both mints already take inp.now, and both
     replay harnesses already pass the closed bar's cutoff there, so a re-run
     over Friday's bars gives Friday's answer with no new plumbing.
     Fails OPEN: no calendar, or an unreadable instant, and nothing is
     marked and nothing is changed. */
  function hgGoldMarkMintWeekend(cands, atMs){
    try{
      var v = hgGoldWeekendVerdict(atMs);
      if (!v) return null;
      var lists = [], i, j;
      if (cands && cands.length) lists.push(cands);
      if (cands && cands.rejected && cands.rejected.length) lists.push(cands.rejected);
      if (cands && cands.ranked && cands.ranked.length) lists.push(cands.ranked);
      if (cands && cands.best && typeof cands.best === 'object') lists.push([cands.best]);
      for (i = 0; i < lists.length; i++){
        for (j = 0; j < lists[i].length; j++){
          var c = lists[i][j];
          if (!c || typeof c !== 'object') continue;
          c.goldShut = !!v.inWeekend;
          if (v.inWeekend) c.goldShutWhy = v.why;
        }
      }
      return v;
    }catch(e){ return null; }
  }

  /* Which gold desks route through this function, and therefore have the
     calendar, versus those that mint from raw bars with no weekend rule of
     their own. Derived from a probe of the live globals rather than a list
     kept in prose -- hg-v945's lesson: a coverage claim nobody can re-run is
     a coverage claim that goes stale silently. A desk absent from the page
     reports 'not loaded', never 'covered'. */
  /* hg-v952: TWO KNOWN INSTANTS the reporter judges a route with. A desk that
     cannot tell these apart does not have a working calendar, whatever its
     `via` string claims. Chosen inside one weekend so the DST edge cannot
     make either ambiguous: Saturday is shut under both offsets. */
  var HG_GOLD_WEEKEND_PROBE_SHUT = Date.UTC(2026, 3, 11, 12, 0, 0);   /* Saturday */
  var HG_GOLD_WEEKEND_PROBE_OPEN = Date.UTC(2026, 3,  8, 12, 0, 0);   /* Wednesday */

  var HG_GOLD_WEEKEND_MINTERS = [
    { desk: 'NEW GOLD',    tab: 'newgold',   probe: 'newGoldState',     via: 'hgGoldFormation' },
    { desk: 'OMNIGOLD 1',  tab: 'omnigold1', probe: 'omnigold1State',   via: 'hgGoldFormation' },
    { desk: 'OMNIGOLD',    tab: 'omnigold',  probe: 'hgOgFormation',    via: 'own hg-v420 veto' },
    /* hg-v953: these two said 'own weekend read' and the probed function had
       none -- the read is in the tab shell, on the wall clock, and is excluded
       from the replay by the swing walk's own meta. The mint carries the mark
       now, on its own signal bar, and the route is CALLED rather than claimed. */
    { desk: 'GOLD SWING',  tab: 'goldswing', probe: 'goldSwingSetups',  via: 'per-scan signal bar in the mint; marked, not withheld (the shell demote is separate and unchanged)', verdictFn: 'goldSwingWeekendVerdict' },
    { desk: 'GOLD SCALP',  tab: 'goldscalp', probe: 'goldScalpSetups',  via: 'per-scan signal bar in the mint; marked, not withheld (the shell demote is separate and unchanged)', verdictFn: 'goldScalpWeekendVerdict' },
    { desk: 'SUPER GOLD',  tab: 'super-gold', probe: 'superGoldState',   via: 'per-candidate signal bar, wall clock only when the row carries no time', verdictFn: 'sgWeekendVerdict' },
    /* hg-v950: these four mint from raw bars and do not route through
       hgGoldFormation, so each calls hgGoldWeekendVerdict directly at the
       instant its own shape makes correct — per SETUP where the desk walks
       a window, per SERIES where it reads one closed bar. */
    { desk: 'OPTI GOLD',   tab: 'optigold',  probe: 'optiGoldState',    via: 'per-setup, own break bar', verdictFn: '__ogWeekendVerdict' },
    { desk: 'GOLD PINE',   tab: 'goldpine',  probe: 'goldPineScan',     via: 'per-mode, 4h swing and 15m scalp last closed bar', verdictFn: 'gpWeekendVerdict', probeKind: 'rows' },
    { desk: 'GOLD PRO',    tab: 'goldpro',   probe: 'goldProState',     via: 'last closed bar of the series in hand', verdictFn: 'gpProWeekendVerdict', probeKind: 'rows' },
    { desk: '80PERCENT',   tab: '80percent', probe: 'eightyPercentState', via: 'per-signal, own bar', verdictFn: 'hg80WeekendVerdict' },
    /* hg-v951: THE INLINE DESK. Every other row here is a module file, and
       this reporter finds them by probing a module global. The GOLD tab is
       ~200 lines inside index.html registered as id:'gold', so it had NO
       probe and therefore NO bucket — not covered, not uncovered, absent.
       The reporter built so gaps name themselves could not see this one.
       It is listed now, and it probes the inline function the shell defines,
       so an inline desk can never again be invisible here. */
    { desk: 'GOLD (inline)', tab: 'gold',    probe: 'hgInlineGoldShut', via: 'per-lane, 4h swing and 15m scalp; handoffs withheld', verdictFn: 'hgInlineGoldShut' },
    /* hg-v952: TAURIC was absent from this list entirely — a second blind
       spot one pack after hg-v951 fixed the first. It prices XAUUSD and
       records entry/stop/t1 to the forward log, so it mints; it had NO
       weekend reference of any kind. */
    { desk: 'TAURIC',      tab: 'tauric',    probe: 'hgTauricRecord',   via: 'per-record, the bar the pipeline priced; marked, not withheld', verdictFn: 'hgTauricWeekendVerdict' },
    /* hg-v954: both write ticket:true XAUUSD rows into the forward ledger
       and had NO weekend reference of any kind. That is stronger than the
       TAURIC case hg-v952 wired: those rows record ticket:false, so there
       was no ticket to withhold. These two record TICKETS, so a
       weekend-formed pick enters the ledger as tradeable and is judged as
       one -- the contamination mechanism hg-v949 measured on NEW GOLD,
       running in two more ledgers. They MARK, on the TAURIC precedent. */
    { desk: 'GOLD DIRECTION', tab: 'golddirection', probe: 'hgGoldDirectionRecordForward', via: 'per-record, the 1h signal bar; marked on the ticket row, not withheld', verdictFn: 'gdWeekendVerdict' },
    { desk: 'GOLD ULTRA',  tab: 'goldultra', probe: 'goldUltraState',  via: 'per-record, the 15m signal bar; marked on the ticket row, not withheld', verdictFn: 'guWeekendVerdict' }
  ];

  /* hg-v954: THE CENSUS, because the list above was ITSELF HAND-TYPED.
     hg-v951 added the inline GOLD tab to it by noticing; hg-v952 added
     TAURIC by noticing. Each was called a blind spot fixed, and the
     MECHANISM that produced both -- a desk list kept by hand inside the
     reporter built so gaps name themselves -- was never touched. The shell's
     GOLD nav group holds SEVENTEEN tabs and this reporter listed TWELVE.

     So every gold tab is classified here, as a minter above or as one of
     these, and the guard reads HG_NAV_GROUPS out of index.html and requires
     the two lists to agree. A gold tab added to the nav with no row here
     turns a test red rather than going quietly missing a third time. */
  var HG_GOLD_NON_MINTERS = [
    { desk: 'MILLI GOLD', tab: 'milligold',
      why: 'inherits OMNIGOLD: since hg-v938 it renders the cards OMNIGOLD has already evaluated rather than scanning, so its weekend answer IS OMNIGOLD\'s and a second one here would be a second calendar',
      inherits: 'OMNIGOLD' },
    { desk: 'GOLD SPOT',  tab: 'goldspot',
      why: 'spot-vs-perp basis monitor: reads a live quote and prints a verdict, prices no entry, stop or target and writes no forward record' },
    { desk: 'GOLD COINT', tab: 'goldcoint',
      why: 'cointegration context ledger: its own header says CONTEXT only, no spread execution path -- no levels, no ticket, no record' }
  ];

  /* Reads the shell's own nav registry when it is reachable and names any
     gold tab classified nowhere. Returns null when the registry cannot be
     read -- an unreadable census is NOT an empty one, which is the whole
     failure this exists to stop. */
  function hgGoldWeekendCensusGaps(){
    var nav = null;
    try{ nav = (typeof HG_NAV_GROUPS !== 'undefined') ? HG_NAV_GROUPS : (G.HG_NAV_GROUPS || null); }
    catch(eN){ nav = null; }
    if (!nav || !nav.length) return null;
    var grp = null, i;
    for (i = 0; i < nav.length; i++) if (nav[i] && nav[i].id === 'gold') grp = nav[i];
    if (!grp || !grp.tabs || !grp.tabs.length) return null;
    var known = {};
    for (i = 0; i < HG_GOLD_WEEKEND_MINTERS.length; i++) known[HG_GOLD_WEEKEND_MINTERS[i].tab] = 'minter';
    for (i = 0; i < HG_GOLD_NON_MINTERS.length; i++) known[HG_GOLD_NON_MINTERS[i].tab] = 'non-minter';
    var gaps = [];
    for (i = 0; i < grp.tabs.length; i++) if (!known[grp.tabs[i]]) gaps.push(grp.tabs[i]);
    return { navTabs: grp.tabs.slice(), gaps: gaps, classified: grp.tabs.length - gaps.length };
  }
  /* hg-v952: DOES THE ROUTE ACTUALLY WORK? Call the desk's own verdict
     function with two known instants and require it to tell them apart:
     SHUT on a Saturday, open on a Wednesday. A function that answers both
     the same way, throws, or is absent has not demonstrated a calendar.
     Returns 'verified' | 'broken' | null (nothing to test). */
  /* TWO SHAPES, because the desks genuinely differ and pretending otherwise
     is how a probe reports a working route as broken. A desk whose setups
     carry their own instant takes a NUMBER; a desk whose setups carry none
     (GOLD PINE, GOLD PRO) reads the last closed bar of a SERIES and takes
     rows. The first cut of this probe called every route with a number, and
     reported both rows-taking desks BROKEN — a false alarm from the reporter,
     not a defect in them. */
  function hgGoldWeekendProbeArg(kind, atMs){
    if (kind === 'rows'){
      var rows = [], step = 14400, t0 = Math.floor(atMs / 1000) - 3 * step;
      for (var i = 0; i < 4; i++)
        rows.push({ t: t0 + i * step, o: 2300, h: 2302, l: 2298, c: 2301, v: 900 });
      return rows;                        /* last closed bar lands on atMs */
    }
    return atMs;
  }
  function hgGoldWeekendProbeRoute(fnName, kind){
    if (!fnName) return null;
    var f = null;
    try{ f = G[fnName]; }catch(eG){ f = null; }
    if (typeof f !== 'function') return null;
    var shut, open;
    try{
      shut = f(hgGoldWeekendProbeArg(kind, HG_GOLD_WEEKEND_PROBE_SHUT));
      open = f(hgGoldWeekendProbeArg(kind, HG_GOLD_WEEKEND_PROBE_OPEN));
    }catch(eC){ return 'broken'; }
    /* the shared shape is "truthy verdict when shut, null when open" */
    return (shut && !open) ? 'verified' : 'broken';
  }

  /* The reporter used to report what its AUTHOR TYPED. Every `via` string was
     a claim nothing checked — and hg-v952 found what that costs: SUPER GOLD
     read the calendar on Date.now() rather than the signal bar at all four of
     its sites, and the reporter called it covered because the string said so.
     That is the hand-typed-prefer-book failure (hg-v946) living inside the
     reporter built to stop gaps hiding.
     So a route is now one of:
       VERIFIED  the desk's verdict function was CALLED and told a Saturday
                 from a Wednesday.
       BROKEN    it was called and could not.
       CLAIMED   there is nothing callable to test, so the `via` string is an
                 author's claim and is labelled one rather than counted as
                 coverage.
     The buckets still PARTITION the list, and `covered` still holds every
     routed desk so existing readers are unchanged — what is new is that each
     row says which kind of answer it is. */
  function hgGoldWeekendCoverage(){
    var out = { covered: [], uncovered: [], notLoaded: [],
                verified: [], claimed: [], broken: [] };
    for (var i = 0; i < HG_GOLD_WEEKEND_MINTERS.length; i++){
      var m = HG_GOLD_WEEKEND_MINTERS[i];
      var loaded = false;
      try{ loaded = (typeof G[m.probe] !== 'undefined'); }catch(eL){ loaded = false; }
      if (!loaded){ out.notLoaded.push(m.desk); continue; }
      if (!m.via){ out.uncovered.push(m.desk); continue; }
      var state = hgGoldWeekendProbeRoute(m.verdictFn, m.probeKind);
      var row = { desk: m.desk, via: m.via,
                  proof: state === 'verified' ? 'verified'
                       : state === 'broken' ? 'broken' : 'claimed' };
      out.covered.push(row);
      if (row.proof === 'verified') out.verified.push(m.desk);
      else if (row.proof === 'broken') out.broken.push(m.desk);
      else out.claimed.push(m.desk);
    }
    return out;
  }

  function hgGoldFormation(setup, opts){
    opts = opts || {};
    var out = {
      formed: false, tradable: false, state: 'STOOD-ASIDE', reasons: [],
      confluence: null, og: null, ogAll: [], evidence: null,
      venue: null, drag: null, deskParams: null
    };
    try{
      setup = setup || {};

      /* ---- 1. venue stop floor + demotion + edge + catalog ---- */
      var ogFn = gfn('hgOgFormation');
      if (!ogFn){
        out.reasons.push('venue cost floor unavailable — omnigold.js (hgOgFormation) is not loaded, '
          + 'so the stop could not be priced against the venue round trip; fail closed');
        out.state = 'STOOD-ASIDE';
        out.confluence = hgGoldConfluence(opts.confirmations, { min: opts.min, requireClasses: opts.requireClasses });
        return out;
      }
      var kinds = [];
      if (setup.kind !== null && setup.kind !== undefined && String(setup.kind) !== '') kinds.push(String(setup.kind));
      var also = Array.isArray(opts.alsoKinds) ? opts.alsoKinds : [];
      var ai;
      for (ai = 0; ai < also.length; ai++){
        var ak = String(also[ai] || '');
        if (ak && kinds.indexOf(ak) < 0) kinds.push(ak);
      }
      if (!kinds.length) kinds.push('');
      var ogFormed = true, ki, v;
      for (ki = 0; ki < kinds.length; ki++){
        v = null;
        try {
          v = ogFn({ kind: kinds[ki], horizon: setup.horizon, dir: setup.dir,
                     plan: setup.plan, entry: setup.entry, stop: setup.stop,
                     stratKey: setup.stratKey, rows: setup.rows, demoted: setup.demoted });
        } catch (eOg){
          v = { formed: false, reasons: ['formation check threw — fail closed: ' + ((eOg && eOg.message) || eOg)] };
        }
        if (!v || typeof v !== 'object') v = { formed: false, reasons: ['formation check returned nothing — fail closed'] };
        out.ogAll.push({ kind: kinds[ki], verdict: v });
        if (ki === 0) out.og = v;
        if (v.formed === false){
          ogFormed = false;
          var rs = Array.isArray(v.reasons) ? v.reasons : [];
          var rj;
          for (rj = 0; rj < rs.length; rj++){
            out.reasons.push(kinds.length > 1 && kinds[ki] ? (kinds[ki] + ': ' + rs[rj]) : rs[rj]);
          }
          if (v.stopFloor && !out.stopFloor) out.stopFloor = v.stopFloor;
          if (v.kindDemotion && !out.kindDemotion) out.kindDemotion = v.kindDemotion;
          if (v.catalogExclude) out.catalogExclude = true;
          if (v.edgeSuppress && !out.edgeSuppress) out.edgeSuppress = v.edgeSuppress;
        }
        if (v.venue && !out.venue) out.venue = v.venue;
        if (v.drag && !out.drag) out.drag = v.drag;
        if (v.edgeDemote && !out.edgeDemote) out.edgeDemote = v.edgeDemote;
        if (v.edgePrefer) out.edgePrefer = true;
        if (v.unDemoted && !out.unDemoted) out.unDemoted = v.unDemoted;
      }

      /* ---- 2. measured evidence: KILL-LIST + measured-edge veto ---- */
      var ev = hgGoldEvidenceRead({
        tab: opts.tab, kind: opts.mechanic || setup.kind,
        plan: setup.plan || { entry: setup.entry, stop: setup.stop, t1: setup.t1 }
      });
      out.evidence = ev;
      var ri;
      if (ev.killed || ev.unreadable === true){
        for (ri = 0; ri < ev.reasons.length; ri++) out.reasons.push(ev.reasons[ri]);
      } else if (!ev.edgePass){
        /* NOT a formation kill — the same strength it has on the other two
           desks, where it costs a solidity point and the lead slot, not the
           card. Named so the reader sees it. */
        for (ri = 0; ri < ev.reasons.length; ri++) out.reasons.push(ev.reasons[ri]);
      }

      /* ---- 3. desk-tab-params, through the shared reader ---- */
      try{
        var dpFn = gfn('hgDeskParam');
        if (dpFn && opts.tab){
          out.deskParams = { tab: String(opts.tab), minRR: dpFn(String(opts.tab), 'minRR', null) };
        }
      }catch(eDp){}

      /* ---- 4. confluence ---- */
      var conf = hgGoldConfluence(opts.confirmations, { min: opts.min, requireClasses: opts.requireClasses });
      out.confluence = conf;

      /* ---- hg-v949: the gold trading calendar, BEFORE the outcome gates ----
         A setup formed on a bar XAUUSD never printed is not a weaker setup,
         it is not a setup: no broker quoted the level and nobody could take
         the ticket. So it is decided here rather than folded into confluence,
         and the card keeps its evidence while losing only `tradable` -- the
         hg-v552/v572 rule that a hard drop empties a board and a demote does
         not. Null (no atMs, unreadable, or indicators2.js absent) changes
         nothing; `out.weekend` rides either way so a reader can tell
         "checked and open" from "could not check". */
      out.weekend = hgGoldWeekendVerdict(opts.atMs);
      if (out.weekend && out.weekend.inWeekend === true){
        out.state = 'STOOD-ASIDE'; out.formed = false; out.tradable = false;
        out.reasons.push('GOLD IS SHUT — ' + out.weekend.why);
        return out;
      }

      /* ---- hg-v964: the tier-1 news lock, on the SAME instant ----
         hg-v963 gave the gold news gate a shared route and its own reporter
         then named seven desks with no route at all -- among them the two that
         reach formation through here, NEW GOLD and OMNIGOLD 1. Putting it here
         rather than in each desk is the hg-v949 rule: one rule, one home, so a
         desk that routes through formation cannot acquire a second calendar or
         miss this one.

         It sits beside the weekend check and reads the SAME opts.atMs, so the
         two calendars can never judge different moments -- the drift behind the
         hg-v952 wall-clock defect and its hg-v963 repeat.

         Same shape as the weekend rule, deliberately: this is not a weaker
         setup, it is one whose minting is barred, so the card keeps its
         evidence and loses only `tradable` (hg-v552/v572 -- a hard drop empties
         a board, a demote does not). `out.news` rides either way so a reader
         can tell "checked and clear" from "could not check". Null -- no atMs,
         unreadable, no snapshot, or goldind absent -- changes nothing. */
      out.news = hgGoldNewsVerdict(opts.atMs);
      if (out.news && out.news.locked === true){
        out.state = 'STOOD-ASIDE'; out.formed = false; out.tradable = false;
        out.reasons.push('GOLD NEWS LOCK — ' + out.news.why);
        return out;
      }

      if (ev.killed){ out.state = 'KILLED'; out.formed = false; out.tradable = false; return out; }
      /* UNREADABLE EVIDENCE (hg-v698 audit closeout): the kill-check threw,
         so "not killed" was never established. Same fail-closed direction as
         the rest of this verdict — stand aside, reason already named above. */
      if (ev.unreadable === true){ out.state = 'STOOD-ASIDE'; out.formed = false; out.tradable = false; return out; }
      if (!ogFormed){ out.state = 'STOOD-ASIDE'; out.formed = false; out.tradable = false; return out; }
      if (!conf.ok){
        out.state = 'WATCH';
        out.formed = false;
        out.tradable = false;
        out.reasons.push(conf.why);
        return out;
      }
      out.formed = true;
      out.tradable = true;
      out.state = 'FORMED';
      out.reasons.push(conf.why);
      return out;
    }catch(e){
      out.reasons.push('gold formation threw — fail closed: ' + ((e && e.message) || e));
      out.state = 'STOOD-ASIDE';
      out.formed = false; out.tradable = false;
      if (!out.confluence) out.confluence = hgGoldConfluence(null, { min: opts.min, requireClasses: opts.requireClasses });
      return out;
    }
  }

  /* A one-line chip for the card head. '' when there is nothing to show. */
  function hgGoldFormationChipHtml(v){
    try{
      if (!v || typeof v !== 'object') return '';
      var cls, txt, cc = v.confluence || {};
      /* a desk that declared classes inherent gets the honest count on its
         chip too — 'FORMED 3/3 classes' overstates when two of the three are
         the signal confirming itself. OMNIGOLD/OG1 never set the flag. */
      var chipInh = cc.declaredInherent === true;
      var chipRev = (chipInh && Array.isArray(cc.revocable)) ? cc.revocable.length : 0;
      var chipInhN = (chipInh && Array.isArray(cc.inherent)) ? cc.inherent.length : 0;
      if (v.state === 'FORMED'){
        cls = 'ok';
        txt = chipInh ? ('FORMED ' + chipRev + ' revocable + ' + chipInhN + ' inherent')
                      : ('FORMED ' + cc.classCount + '/' + cc.min + ' classes');
      } else if (v.state === 'WATCH'){
        cls = 'warn';
        txt = chipInh ? ('WATCH ' + chipRev + ' revocable + ' + chipInhN + ' inherent')
                      : ('WATCH ' + cc.classCount + '/' + cc.min + ' classes');
      } else if (v.state === 'KILLED'){
        cls = 'bad'; txt = 'KILLED — measured losing';
      } else {
        cls = 'bad'; txt = 'STOOD ASIDE';
      }
      var colour = cls === 'ok' ? '#22c55e' : cls === 'warn' ? '#f59e0b' : '#dc2626';
      return '<span class="pill hg-gold-form-chip" data-hg-gold-form="' + esc(v.state) + '" '
        + 'style="border:1px solid ' + colour + ';color:' + colour + ';border-radius:3px;'
        + 'padding:1px 5px;font-size:10px;white-space:nowrap">' + esc(txt) + '</span>';
    }catch(e){ return ''; }
  }

  /* --- expose ------------------------------------------------------------ */
  G.HG_GOLD_CONF_CLASSES = HG_GOLD_CONF_CLASSES;
  G.HG_GOLD_CONF_CLASS_LABEL = HG_GOLD_CONF_CLASS_LABEL;
  G.HG_GOLD_CONF_MIN_CLASSES = HG_GOLD_CONF_MIN_CLASSES;
  G.HG_GOLD_CONF_GATE_CLASS = HG_GOLD_CONF_GATE_CLASS;
  G.HG_GOLD_CONF_FAMILY_CLASS = HG_GOLD_CONF_FAMILY_CLASS;
  G.HG_GOLD_CONF_ROW_EXCLUDE = HG_GOLD_CONF_ROW_EXCLUDE;
  G.HG_GOLD_SESSION_EVIDENCE = HG_GOLD_SESSION_EVIDENCE;
  G.hgGoldConfClassOfGate = hgGoldConfClassOfGate;
  G.hgGoldConfClassOfFamily = hgGoldConfClassOfFamily;
  G.hgGoldSessionEdge = hgGoldSessionEdge;
  G.hgGoldSignalBarMs = hgGoldSignalBarMs;
  G.hgGoldWeekendVerdict = hgGoldWeekendVerdict;
  G.hgGoldNewsMark = hgGoldNewsMark;
  /* hg-v963 -- WHICH GOLD DESKS THE NEWS GATE ACTUALLY REACHES.

     The desk list is DERIVED from HG_GOLD_WEEKEND_MINTERS, never typed again:
     that census is the repo's one list of gold desks that mint, and hg-v954
     established that a hand-kept second copy inside a reporter is exactly what
     goes stale (it had gone stale twice by then).

     A desk is VERIFIED only when it supplies the gate a real snapshot, which
     is asked BEHAVIOURALLY: the probe hands the shared verdict an instant
     inside a tier-1 window and one outside it and requires the two to differ.
     A route that cannot tell them apart is BROKEN, not covered -- the
     `news: null` sites this pack fixed would have read BROKEN, because a gate
     that answers the same way on both instants is not a gate. */
  var HG_GOLD_NEWS_ROUTES = {
    goldultra:     'per-lane 15m signal bar, live hgNewsState snapshot (hg-v963)',
    golddirection: 'per-lane signal bar (15m scalp / 4h swing), live snapshot (hg-v963)',
    goldscalp:     'ctx.news + ctx.nowMs through hgGoldInstFilter',
    goldswing:     'ctx.news + ctx.nowMs through hgGoldInstFilter',
    omnigold:      'hgOgGates inst-filter ledger row',
    'super-gold':  'own hgNewsState read',
    goldpine:      'passes a live snapshot into the shared mint',
    /* hg-v964: the three desks that record a CONDITIONALLY TRUE ticket, so a
       news-window pick entered the forward ledger as tradeable. The first two
       reach it through hgGoldFormation, which now checks the lock beside the
       weekend rule on the same instant; GOLD PRO decides `ticket` at its own
       forward-record site and reads the gate at the same bar as its weekend
       verdict. */
    newgold:       'hgGoldFormation news lock, same instant as the weekend rule (hg-v964)',
    omnigold1:     'hgGoldFormation news lock, same instant as the weekend rule (hg-v964)',
    goldpro:       'own paired read at the last closed bar; withholds the ticket flag (hg-v964)',
    /* hg-v965: the last four, each treating the news lock EXACTLY as it
       already treats the weekend -- no new per-desk policy is invented here.
       OPTI GOLD withholds the ACTIONABLE claim (hg-v950), the inline GOLD
       lanes withhold both handoffs (hg-v951), and 80PERCENT and TAURIC mark
       without withholding (hg-v950 / hg-v952), because their rows record no
       ticket there is anything to withhold. Each reads hgGoldNewsMark on the
       SAME instant expression its weekend read already uses. */
    optigold:      'hgGoldNewsMark on the break bar; withholds ACTIONABLE (hg-v965)',
    '80percent':   'hgGoldNewsMark on the signal bar; marks the card (hg-v965)',
    gold:          'hgGoldNewsMark per lane signal bar; withholds both handoffs (hg-v965)',
    tauric:        'hgGoldNewsMark on the pipeline bar; marks the card (hg-v965)'
  };

  function hgGoldNewsProbe(){
    /* Two known instants around one synthetic tier-1 event. Synthetic on
       purpose: a probe that needed the live calendar would report BROKEN on
       any quiet week, which is the opposite of what it is for. */
    var t = Date.UTC(2026, 9, 13, 12, 30);
    var snap = { events: [{ title: 'US CPI m/m', t: t }] };
    var inside = hgGoldNewsVerdict(t - 10 * 60000, snap);
    var outside = hgGoldNewsVerdict(t + 3 * 3600000, snap);
    if (!inside || !outside) return 'BROKEN';
    if (inside.locked === true && outside.locked === false) return 'VERIFIED';
    return 'BROKEN';
  }

  function hgGoldNewsCoverage(){
    try{
      if (!HG_GOLD_WEEKEND_MINTERS || !HG_GOLD_WEEKEND_MINTERS.length) return null;
      var shared = hgGoldNewsProbe();
      /* censusSize is reported so a reader (and the guard) can check the
         partition against the SOURCE rather than against a typed number —
         a hardcoded expected count is the stale-list defect one layer along. */
      var out = { shared: shared, censusSize: 0, verified: [], uncovered: [], notLoaded: [] };
      for (var i = 0; i < HG_GOLD_WEEKEND_MINTERS.length; i++){
        var d = HG_GOLD_WEEKEND_MINTERS[i];
        if (!d || !d.tab) continue;
        out.censusSize++;
        var route = HG_GOLD_NEWS_ROUTES[d.tab] || null;
        var loaded = false;
        try{ loaded = (typeof gfn(d.probe) === 'function'); }catch(e){ loaded = false; }
        var row = { desk: d.desk, tab: d.tab, route: route };
        if (!route) out.uncovered.push(row);
        else if (!loaded) out.notLoaded.push(row);
        else { row.probe = shared; out.verified.push(row); }
      }
      return out;
    }catch(e){ return null; }
  }

  /* hg-v964 -- ONE INSTANT, BOTH GOLD CALENDARS.

     hg-v963 gave the news gate a shared route and its reporter then named
     SEVEN desks with no route at all: NEW GOLD, OMNIGOLD 1, OPTI GOLD,
     GOLD PRO, 80PERCENT, GOLD (inline) and TAURIC. This pairs the two
     calendars so a desk adding one cannot end up judging them at different
     moments -- which is exactly the drift that produced the hg-v952 wall-clock
     defect and its hg-v963 repeat.

     Both verdicts are derived from the SAME atMs, by construction rather than
     by a caller remembering to pass the same value twice. Each half fails open
     independently: a desk whose weekend calendar is readable and whose news
     snapshot is absent still gets the weekend verdict, and the reverse. */
  function hgGoldGateAt(atMs, snapArg){
    var out = { atMs: null, weekend: null, news: null };
    try{
      out.weekend = hgGoldWeekendVerdict(atMs);
      out.news = hgGoldNewsVerdict(atMs, snapArg);
      /* the instant is reported from whichever half could read it, so a caller
         can prove the two were judged together */
      if (out.weekend && isFinite(out.weekend.atMs)) out.atMs = out.weekend.atMs;
      else if (out.news && isFinite(out.news.atMs)) out.atMs = out.news.atMs;
      return out;
    }catch(e){ return out; }
  }

  /* What a desk must WITHHOLD at this instant, and why, as one line. Returns
     null when neither calendar withholds anything -- never an empty string,
     because '' and null read the same at a call site and only one of them
     means "asked and nothing is wrong". */
  function hgGoldGateBlock(atMs, snapArg){
    try{
      var g = hgGoldGateAt(atMs, snapArg);
      var parts = [];
      if (g.weekend && g.weekend.inWeekend === true) parts.push(g.weekend.why || 'gold is shut');
      if (g.news && g.news.locked === true) parts.push(g.news.why || 'tier-1 gold news window');
      if (!parts.length) return null;
      return { atMs: g.atMs, weekend: !!(g.weekend && g.weekend.inWeekend === true),
               news: !!(g.news && g.news.locked === true), why: parts.join(' · ') };
    }catch(e){ return null; }
  }

  G.hgGoldNewsVerdict = hgGoldNewsVerdict;
  G.hgGoldGateAt = hgGoldGateAt;
  G.hgGoldGateBlock = hgGoldGateBlock;
  G.hgGoldNewsCoverage = hgGoldNewsCoverage;
  G.hgGoldNewsProbe = hgGoldNewsProbe;
  G.HG_GOLD_NEWS_ROUTES = HG_GOLD_NEWS_ROUTES;
  G.hgGoldNewsSnapshot = hgGoldNewsSnapshot;
  G.hgGoldMarkMintWeekend = hgGoldMarkMintWeekend;
  G.hgGoldWeekendCoverage = hgGoldWeekendCoverage;
  G.hgGoldWeekendProbeRoute = hgGoldWeekendProbeRoute;
  G.HG_GOLD_WEEKEND_MINTERS = HG_GOLD_WEEKEND_MINTERS;
  G.HG_GOLD_NON_MINTERS = HG_GOLD_NON_MINTERS;
  G.hgGoldWeekendCensusGaps = hgGoldWeekendCensusGaps;
  G.hgGoldApplySessionLeg = hgGoldApplySessionLeg;
  G.hgGoldConfluence = hgGoldConfluence;
  G.hgGoldConfluenceFromGates = hgGoldConfluenceFromGates;
  G.hgGoldConfluenceFromMatrix = hgGoldConfluenceFromMatrix;
  G.hgGoldConfHonestHead = hgGoldConfHonestHead;
  G.hgGoldConfluenceHtml = hgGoldConfluenceHtml;
  G.hgGoldConfluenceLine = hgGoldConfluenceLine;
  G.hgGoldEvidenceRead = hgGoldEvidenceRead;
  G.hgGoldFormation = hgGoldFormation;
  G.hgGoldFormationChipHtml = hgGoldFormationChipHtml;
  G.HG_GOLD_FORMATION_VERSION = 'hg-v698';
})();
