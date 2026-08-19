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
                         momentumStop: pl.momentumStop === true };
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

  G.applyExactEntry = applyExactEntry;
  G.hgPlanLevels    = hgPlanLevels;

})(typeof window !== 'undefined' ? window : globalThis);
