/* HARDGATE — the plan engine: entry, stop, T1, T2 and risk.

   TEN MODULES CALL THIS and it decides the levels every one of them shows:
   omnigold, omniroute, brain, engine, squeeze, oiflow, trendtable,
   best-levels, supersetup and plans itself. It lived inside index.html, an
   8,700-line file, which had two consequences.

   The first is that no test harness could reach it. Every desk test builds
   its cards by loading the .js modules and evaluating a ledger — and with
   hgPlanLevels absent from that set, `plan` came back null on all of them.
   Measured before this move: 198 cards built, 0 carrying a plan, and the two
   gates that read one — cost-drag and stop-width — reported UNCHECKED on
   100% of cards in every test that has ever run. Lifting these two functions
   into the harness took that to 198 of 198 and both gates to 0% unchecked.

   The second is that the two defects fixed in v381 — a fallback that ignored
   the caller's R floor, and one that moved a far stop IN and falsified the
   risk — sat in a file nothing could exercise, for as long as they did.

   Nothing here is rewritten. The two functions are the v381 versions moved
   verbatim; equivalence was checked over 9,600 plans across seeds, market
   modes, swing distances, directions, R floors and entry overrides, and the
   output is byte-identical.

   Load order: after indicators.js (atr, lastSwing) and plans.js
   (hgPlanLevelsCore, hgApplyExactEntry). Both are looked up at call time, so
   a missing one degrades to the fallback or to the plan unchanged rather
   than throwing.

   Classic script, no build step, same as every other module. */
(function (G) {
  'use strict';

  /* indicators.js declares `const last = a => a[a.length-1]` at top level.
     Classic scripts share a global lexical scope so that binding is visible
     here, but depending on another file's const across a file boundary is a
     load-order trap waiting to happen. Local copy, same semantics: the LAST
     element, not the last finite one — atr() returns leading NaNs and a
     "last finite" variant would silently change every stop this engine has
     ever produced. */
  function lastOf(a){ return (a && a.length) ? a[a.length - 1] : undefined; }

  function applyExactEntry(plan, rows4h, opts){
    if (!plan || typeof hgApplyExactEntry !== 'function') return plan;
    try{ return hgApplyExactEntry(plan, rows4h, opts || {}) || plan; }catch(e){ return plan; }
  }

  function hgPlanLevels(dir, rows, entryOverride, opts){
    try{
      if (typeof hgPlanLevelsCore === 'function'){
        /* The options argument used to be missing here, so every caller that
           passed one — OMNIGOLD passes { minRr: cfg.minRr } — had it silently
           dropped and got a hardcoded 2R policy plus crypto stop defaults it
           could not tune. Forwarded now, with 2R as the default it always had. */
        var plOpts = Object.assign({ minRr: 2 }, opts || {});
        var pl = hgPlanLevelsCore(dir, rows, entryOverride, plOpts);
        if (pl) return { dir: pl.dir, entry: pl.entry, stop: pl.stop, t1: pl.t1, t2: pl.t2, risk: pl.risk, note: pl.note,
                         targetPolicy: pl.targetPolicy, planSrc: pl.planSrc,
                         /* This fixed field list silently dropped the flag that
                            marks a volatility stop, so a momentum plan rendered
                            as structural and the ledger's AGAINST never fired —
                            the disguise v381 removed, back through a third door.
                            The list already dropped rr1/rr2 the same way once;
                            that is what it does to any field added below it. */
                         momentumStop: pl.momentumStop === true,
                         strategyConfirm: pl.strategyConfirm,
                         strategyWith: pl.strategyWith,
                         strategyAgainst: pl.strategyAgainst,
                         strategyDemoted: pl.strategyDemoted === true,
                         strategyApplied: pl.strategyApplied,
                         strategyWithKeys: pl.strategyWithKeys,
                         strategyAgainstKeys: pl.strategyAgainstKeys,
                         contextGates: pl.contextGates,
                         contextRead: pl.contextRead,
                         contextWarn: pl.contextWarn === true,
                         formationScore: pl.formationScore };
      }
      if (dir!=='long' && dir!=='short') return null;
      if (!rows || !rows.length) return null;
      const entry = (isFinite(entryOverride) && entryOverride>0) ? +entryOverride : +rows[rows.length-1].c;
      if (!isFinite(entry) || entry<=0 || typeof atr!=='function') return null;
      const a = lastOf(atr(rows,14));
      if (!isFinite(a) || a<=0) return null;
      let stop = (typeof lastSwing==='function') ? lastSwing(rows, dir, 30) : NaN;
      let note = '';
      if (!isFinite(stop) || (dir==='long' ? stop>=entry : stop<=entry)){
        stop = dir==='long' ? entry-1.5*a : entry+1.5*a;
        note = 'ATR stop (no clean swing)';
      }
      let risk = Math.abs(entry-stop);
      if (!(risk>0)) return null;
      if (risk < 0.5*a){
        stop = dir==='long' ? entry-1.5*a : entry+1.5*a;   // structure too tight to be meaningful
        risk = 1.5*a;
        note = 'ATR stop (swing too tight)';
      }
      /* DO NOT TIGHTEN A FAR STOP. This used to move the stop in to a flat
         1.5xATR and take the trade anyway. plans.js removed exactly that from
         hgStructureStop and named it: measured on gold-shaped 1h data it fired
         on 65% of setups, landed the stop 53% closer than the level that would
         actually invalidate the idea, and - because R:R is computed against the
         risk distance - advertised 2.00R for a trade worth 0.96R. "That is the
         one wrong answer available here."

         It was fixed there and left here, in the fallback every caller lands on
         when plans.js has not loaded. The honest responses are the same two:
         keep the structural stop and let the R:R gate judge it on true risk, or
         decline. 6xATR mirrors HG_STOP_MAX_DIST_ATR, hardcoded because this
         path exists precisely for when plans.js is absent. */
      if (risk > 6*a){
        return null;
      }
      if (risk > 2.5*a){
        note = 'stop: lastSwing(30) - WIDE (' + (risk/a).toFixed(1) + '×ATR, beyond the 2.5×ATR guide);'
             + ' R:R is measured against this real invalidation';
      }
      /* HONOUR THE CALLER'S R FLOOR. The wrapper above forwards opts to
         hgPlanLevelsCore precisely because "every caller that passed one -
         OMNIGOLD passes { minRr: cfg.minRr } - had it silently dropped and got
         a hardcoded 2R policy". This fallback four lines below it went on
         hardcoding 2R, so a gold SCALP setup on a 1.5R floor was handed 2R
         targets while measured-edge judged it against the 1.5R breakeven of
         40% rather than 2R's 33.3%. T2 keeps its original 1.75x ratio to T1. */
      const rMul = (opts && isFinite(+opts.minRr) && +opts.minRr > 0) ? +opts.minRr : 2;
      const t1 = dir==='long' ? entry+rMul*risk : entry-rMul*risk;
      const t2 = dir==='long' ? entry+rMul*1.75*risk : entry-rMul*1.75*risk;
      var plFallback = { dir:dir, entry:entry, stop:stop, t1:t1, t2:t2, risk:risk, note:note, type:'SWING' };
      return applyExactEntry(plFallback, rows, { poiLevel: entryOverride, style: 'swing', preferEdge: true });
    }catch(e){ return null; }
  }

  /* =====================================================================
     IS THIS PLAN STILL AHEAD OF PRICE?

     hgPlanLevels sizes entry, stop and T1 against each OTHER, which is the
     right job and is why a plan can be a flawless 2.0R and still be
     nonsense: none of that arithmetic knows where price is NOW.

     Reported from the desk, XAUUSD SHORT SWING:

       mark 4282.70   entry 4316.20   stop 4326.05   T1 4296.51

     A true 2.0R — and T1 sits BETWEEN the mark and the entry, so price
     climbing to fill the short has to cross TP1 on the way up. The target
     is behind price, not ahead of it.

     omnigold has named that geometry since v697 (hgOgEntryMarketNote) but
     it lives in that tab's renderer, so every other gold desk — goldswing,
     goldscalp, goldultra, goldpro, newgold, golddirection, super-gold,
     omnigold1 — sized plans with no idea whether price had already walked
     through them. This is the same rule in the shared layer those desks
     already call, as a verdict rather than a sentence.

     Two ways a pending plan can be dead on arrival:

       stop-breached   price is already through the invalidation. A short
                       whose stop is BELOW the mark is not a trade waiting
                       to happen; it is a trade that already lost.
       target-crossed  the target sits between the mark and the entry, as
                       above — reaching the entry crosses the target.

     Returns null when the mark or the plan is unknown: an unjudgeable plan
     must not come back as 'ok'. Pure, no DOM, no globals. */
  function hgPlanMarketGeometry(plan, mark){
    try{
      if (!plan) return null;
      var dir = String(plan.dir || '').toLowerCase();
      if (dir !== 'long' && dir !== 'short') return null;
      var e = +plan.entry, s = +plan.stop, t1 = +plan.t1, m = +mark;
      if (!isFinite(e) || !isFinite(m) || !(m > 0) || !(e > 0)) return null;

      var long = (dir === 'long');

      /* 1 — invalidation already through. Checked first: a breached stop
         makes the target question moot. */
      if (isFinite(s) && s > 0){
        if (long ? (m <= s) : (m >= s)){
          return { code: 'stop-breached', ok: false, dir: dir, mark: m,
                   why: 'price is already through the stop at ' + s
                      + ' — the invalidation happened before the entry filled' };
        }
      }

      /* 2 — target behind price. Only meaningful while the entry is still
         a retest AWAY from the mark in the direction price must travel. */
      if (isFinite(t1) && t1 > 0){
        /* A retest is an entry price must still TRAVEL to: a long buys the
           dip below the mark (m > e), a short sells the rally above it
           (m < e). Getting these the wrong way round makes the rule fire on
           exactly the plans it should pass. */
        var retest = long ? (m > e) : (m < e);
        var crossed = long ? (t1 < m && t1 > e) : (t1 > m && t1 < e);
        if (retest && crossed){
          return { code: 'target-crossed', ok: false, dir: dir, mark: m,
                   why: 'T1 ' + t1 + ' sits between the market and the entry — '
                      + 'the retest crosses TP1 before the fill' };
        }
      }

      return { code: 'ok', ok: true, dir: dir, mark: m, why: '' };
    }catch(e){ return null; }
  }

  /* =====================================================================
     THE SAME VERDICT, RENDERED ONCE.

     v748 wired hgPlanMarketGeometry into eight gold desks and each one got
     its own copy of the same twelve lines — gswGeoLine, gsxGeoLine,
     guGeoLine, ngGeoLine, gdGeoLine, sgGeoLine, og1GeoLine — differing only
     in the CSS class on the wrapper. Eight copies of a rule is eight places
     to fix it, and the tabs outside gold would have made it thirty.

     So the rule renders here. Callers pass their own class and keep their
     own look; what they stop carrying is the logic.

     Returns null — not an empty note — when there is nothing to say: no
     rule, no plan, no mark, or a plan that is fine. An unjudgeable plan
     gets no claim in either direction, which is the same contract
     hgPlanMarketGeometry itself keeps. */
  var GEO_LABELS = { 'stop-breached': 'STOP ALREADY BREACHED',
                     'target-crossed': 'TARGET BEHIND PRICE' };

  function geoEsc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hgPlanGeometryNote(plan, mark, opts){
    try{
      var g = hgPlanMarketGeometry(plan, mark);
      if (!g || g.ok) return null;
      var label = GEO_LABELS[g.code];
      /* an unrecognised code is a new rule this renderer has not been
         taught to name — say nothing rather than print a raw code */
      if (!label) return null;
      var o = opts || {};
      var cls = o.cls ? String(o.cls) : 'note warn';
      var style = o.style ? ' style="' + geoEsc(o.style) + '"' : '';
      return {
        code: g.code,
        label: label,
        why: g.why,
        mark: g.mark,
        html: '<div class="' + geoEsc(cls) + '"' + style + '><b>' + label
            + ':</b> ' + geoEsc(g.why) + '</div>'
      };
    }catch(e){ return null; }
  }

  /* The one-liner the desks actually call: the HTML, or '' for nothing to
     say. Kept separate from the note above so a caller that wants the
     verdict without the markup — a gate, a log, a test — has it. */
  function hgPlanGeometryLineHtml(plan, mark, opts){
    var n = hgPlanGeometryNote(plan, mark, opts);
    return n ? n.html : '';
  }

  G.applyExactEntry = applyExactEntry;
  G.hgPlanLevels    = hgPlanLevels;
  G.hgPlanMarketGeometry = hgPlanMarketGeometry;
  G.hgPlanGeometryNote = hgPlanGeometryNote;
  G.hgPlanGeometryLineHtml = hgPlanGeometryLineHtml;

})(typeof window !== 'undefined' ? window : globalThis);
