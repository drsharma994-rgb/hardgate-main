/* HARDGATE — gate logic shared by both desks.

   THE PROBLEM THIS SOLVES. Six gates exist once per desk: vol-alive,
   participation, trend, news-window, measured-edge and consensus. Most of
   those are genuinely PARAMETERISED VARIANTS, not copies — gold's
   participation is soft because several gold feeds publish no volume at all
   while crypto's is hard, gold's vol-alive floor is per horizon, and the two
   consensus gates read different family maps. Merging those would mean
   inventing a shared abstraction over behaviour that is deliberately
   different, which is how a "shared" gate ends up wrong for both desks.

   Two of them were not variants. They were the same source, character for
   character, in two files:

     hgBarSpacingSec + hgSlotMeanVol   1,330 chars, verbatim
     the news-window decision           2,730 chars, verbatim

   Both got there the same way: a defect was found on one desk, the fix
   applied to that desk, and then the identical fix pasted into the other. In
   one working session that happened five times, and each paste was a chance
   to fix one desk and miss the other. The news gate in particular emptied
   BOTH tabs for days, and the fix had to be written twice.

   So this module holds only what is provably identical. A gate belongs here
   when the two desks' copies are byte-for-byte the same; anything that needs
   a desk-specific branch stays where it is, called with its own parameters.

   Classic script, no build step, same as every other module. */
(function (G) {
  'use strict';

  /* null/undefined/'' -> NaN. isFinite(null) is TRUE in JS and +null is 0, so
     num()-style coercion silently turns a missing field into a real zero. The
     desks each carry this; it is repeated rather than imported so this module
     has no load-order dependency on them. */
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  /* ---------------------------------------------------------------------
     PARTICIPATION MUST COMPARE LIKE WITH LIKE.

     "trigger vol 0.39x 20-bar mean" was the top veto on the live gold desk —
     4 of 7 setups — on a card whose own session gate read ASIAN RANGE three
     lines below it.

     On 1h gold a 20-bar mean spans TWENTY HOURS, so it averages Asia, London
     and New York together. Asian volume is a fraction of London's by
     construction, so an ordinary Asian bar scores ~0.4x and is vetoed for
     being thin when all it is, is three in the morning. The gate was
     measuring TIME OF DAY and calling it participation — and because the
     whole desk scans one instrument at one moment, it vetoed every card at
     once.

     Against the same slot on previous days it measures what it claims: is
     this bar busy FOR THIS TIME OF DAY. The bar spacing is derived from the
     tape rather than assumed, so it works on 1h and 4h alike. With too little
     per-slot history it falls back to the flat mean and SAYS which baseline
     it used, because a gate quietly changing what it compares against is how
     this went unnoticed in the first place.
     --------------------------------------------------------------------- */
  function hgBarSpacingSec(rows){
    if (!rows || rows.length < 6) return NaN;
    var d = [], i, a, b;
    for (i = Math.max(1, rows.length - 50); i < rows.length; i++){
      a = fin(rows[i] && rows[i].t); b = fin(rows[i - 1] && rows[i - 1].t);
      if (isFinite(a) && isFinite(b) && a > b) d.push(a - b);
    }
    if (!d.length) return NaN;
    d.sort(function(x, y){ return x - y; });
    return d[Math.floor(d.length / 2)];
  }

  function hgSlotMeanVol(rows, want){
    var out = { mean: NaN, n: 0 };
    if (!rows || rows.length < 2) return out;
    var dt = hgBarSpacingSec(rows);
    /* Daily bars and coarser have no intraday slot to correct for. */
    if (!isFinite(dt) || dt <= 0 || dt >= 86400) return out;
    var lt = fin(rows[rows.length - 1] && rows[rows.length - 1].t);
    if (!isFinite(lt)) return out;
    var slot = Math.floor((lt % 86400) / dt);
    var sum = 0, n = 0, i, t, v;
    for (i = rows.length - 2; i >= 0 && n < (want || 20); i--){
      t = fin(rows[i] && rows[i].t); v = fin(rows[i] && rows[i].v);
      if (!isFinite(t) || !isFinite(v)) continue;
      if (Math.floor((t % 86400) / dt) !== slot) continue;
      sum += v; n++;
    }
    /* Fewer than five same-slot bars is not a baseline, it is a rumour. */
    if (n >= 5 && sum > 0){ out.mean = sum / n; out.n = n; }
    return out;
  }

  /* ---------------------------------------------------------------------
     A BLACKOUT IS NOT A FORECAST, AND THIS GATE WAS TREATING THEM AS ONE.

     news.js defines two different things on the same object:

       blackout : now is inside [event - 60m, event + 60m] of a high-impact
                  print. Trading is genuinely suspended.
       risk     : 'high' if a blackout is active OR a high-impact USD event
                  lands within the next TWENTY-FOUR HOURS.

     Vetoing on risk === 'high' therefore stands the desk aside for a whole
     day around every CPI, NFP, FOMC, PPI, PCE, GDP and the WEEKLY jobless
     claims print. On the US calendar those overlap: there is a high-impact
     release within 24h on most weekdays, so the gate is not occasionally on,
     it is effectively permanently on. That is what the live scans showed —
     11 of 11 gold setups and every one of 1240 crypto setups vetoed, across
     days, by this single gate.

     brain.js found and fixed exactly this on 2026-07-30 and says so in a
     comment: "an event hours away is context — a caution chip, never a kill".
     engine.js and book.js also veto on blackout alone. The two desks were the
     only consumers still killing on the forecast, which is why the rest of
     the app kept working while both tabs sat empty.

     So: a true blackout vetoes. A red event on the horizon is reported
     AGAINST — visible on the card, costing the reader nothing — because
     standing aside for a print that is nineteen hours away is not discipline,
     it is not trading.

     Returns { pass, info, why } with pass === null meaning UNCHECKED.
     --------------------------------------------------------------------- */
  function hgNewsGate(news){
    var nw = null, nwWhy = 'news module has not run', nwInfo = false;
    var nwNote = (news && typeof news.note === 'string') ? news.note : '';
    var nwUnloaded = /not loaded|news error/i.test(nwNote);
    if (news && news.risk && !nwUnloaded){
      var nwBlack = (news.blackout === true);
      var nwHigh = (String(news.risk) === 'high');
      nw = !nwBlack;
      if (nwBlack){
        nwWhy = 'NEWS BLACKOUT — TRADING BLOCKED'
              + (nwNote ? ' · ' + nwNote : ' (no event named — check the news tab)');
      } else if (nwHigh){
        /* Not a veto. info:true keeps it off the ticket's critical path while
           still printing on the card, which is what a caution is. */
        nw = false; nwInfo = true;
        nwWhy = 'red event on the horizon, OUTSIDE the blackout window — caution, not a veto'
              + (nwNote ? ' · ' + nwNote : '');
      } else {
        nwWhy = 'news risk ' + news.risk + ' — no blackout active'
              + (nwNote ? ' · ' + nwNote : '');
      }
    } else if (nwUnloaded){
      nwWhy = 'news not checked — module reports: ' + nwNote;
    }
    return { pass: nw, info: nwInfo, why: nwWhy };
  }

  G.hgBarSpacingSec = hgBarSpacingSec;
  G.hgSlotMeanVol   = hgSlotMeanVol;
  G.hgNewsGate      = hgNewsGate;

})(typeof window !== 'undefined' ? window : globalThis);
