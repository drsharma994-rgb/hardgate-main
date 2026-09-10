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
   results.json trades[], 7,270 settled, PAXGUSDT proxy 2026-03-15..08-29).
   UTC hour cohorts, gross R per trade:

     ASIA        00-06   n=2,082   gross +0.097   medCostR 0.57
     LONDON      07-11   n=1,305   gross -0.080   medCostR 0.80
     NY-OVERLAP  12-16   n=2,247   gross -0.061   medCostR 0.51
     NY-PM       17-20   n=  994   gross +0.053   medCostR 0.69
     OFF         21-23   n=  642   gross -0.011   medCostR 0.88

   THE RULE THAT FOLLOWS, and nothing more: the SESSION leg of the
   session-htf class confirms only inside a window whose measured gross is
   >= 0 — ASIA (+0.097 at n=2,082) and NY-PM (+0.053 at n=994). In LONDON
   (-0.080 at n=1,305), NY-OVERLAP (-0.061 at n=2,247) and OFF (-0.011 at
   n=642) the clock is not evidence FOR the trade, so it cannot be one of the
   three confirmations. It is NOT a veto: the HTF-tape leg satisfies the same
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
    { from: 0,  to: 7,  key: 'ASIA',       label: 'ASIA 00-06 UTC',       n: 2307, grossR:  0.066, medCostR: 0.51, weekendCaveat: true },
    { from: 7,  to: 12, key: 'LONDON',     label: 'LONDON 07-11 UTC',     n: 1428, grossR: -0.124, medCostR: 0.68, weekendCaveat: false },
    { from: 12, to: 17, key: 'NY-OVERLAP', label: 'NY-OVERLAP 12-16 UTC', n: 2644, grossR: -0.094, medCostR: 0.45, weekendCaveat: false },
    { from: 17, to: 21, key: 'NY-PM',      label: 'NY-PM 17-20 UTC',      n: 1055, grossR:  0.113, medCostR: 0.57, weekendCaveat: false },
    { from: 21, to: 24, key: 'OFF',        label: 'OFF 21-23 UTC',        n:  721, grossR: -0.062, medCostR: 0.81, weekendCaveat: true }
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

     Verified against the source rather than assumed: bucketing
     scripts/backtest-omnigold-results.json trades[] by
     `new Date(t.tISO).getUTCHours()` over the 7,270 settled rows reproduces
     every line of HG_GOLD_SESSION_EVIDENCE exactly — ASIA n=2082 +0.097,
     LONDON n=1305 -0.080, NY-OVERLAP n=2247 -0.061, NY-PM n=994 +0.053,
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
