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


  /* THE INDICATOR CONTEXT GATES — shared by both desks.

     Asked directly: "are omniroute and omnigold using all the indicators and
     strategies fed into them?" Audited, and the honest answer was NO on one
     side. Seventeen indicator reads existed only on the gold desk — ichimoku,
     donchian, stochastic RSI, Hurst, Keltner, squeeze, MACD, %B, volume
     z-score, regression slope, volume profile, structure shift, the
     higher-timeframe confirm and the regime fit. A gold card carried 34
     checks; a crypto card ~21, and the gap was exactly these.

     They are INFO gates: they argue on the card and never veto, so sharing
     them raises no significance bar (that scales with MECHANIC count, which
     is unchanged) and silences nothing. What they add is evidence density —
     the same reads on every card, both desks.

     Each body below is omnigold's, moved verbatim; the shapes were probed
     against the real library functions when first written (ichimokuState has
     no .state; donchian returns arrays), and that hard-won correctness is
     exactly why this is a MOVE and not a rewrite. */
  function hgIndicatorGates(rows, hit, x, reversion){
    var gates = [];
    try {
      var W2 = (typeof window !== 'undefined') ? window : globalThis;
      var gfn = function(n){ return (W2 && typeof W2[n] === 'function') ? W2[n] : null; };
      var num = function(v){ var n = +v; return isFinite(n) ? n : NaN; };
      var atrOf = function(rr, n){
        if (!rr || rr.length < n + 1) return NaN;
        var sum = 0, cnt = 0, i2, h2, l2, pc2, tr2;
        for (i2 = rr.length - n; i2 < rr.length; i2++){
          h2 = num(rr[i2].h); l2 = num(rr[i2].l); pc2 = num(rr[i2 - 1].c);
          if (!isFinite(h2) || !isFinite(l2) || !isFinite(pc2)) continue;
          tr2 = Math.max(h2 - l2, Math.abs(h2 - pc2), Math.abs(l2 - pc2));
          sum += tr2; cnt++;
        }
        return cnt ? sum / cnt : NaN;
      };
      x = x || {};
      var closes = [], ci;
      for (ci = 0; ci < (rows || []).length; ci++){
        var cv = fin(rows[ci] && rows[ci].c);
        if (isFinite(cv)) closes.push(cv);
      }
      var last = closes.length ? closes[closes.length - 1] : NaN;
      var lastBar = (rows && rows.length) ? rows[rows.length - 1] : null;
      var closesOf = function(rr){
        var o = [], k2;
        for (k2 = 0; k2 < (rr || []).length; k2++){
          var c2 = fin(rr[k2] && rr[k2].c);
          if (isFinite(c2)) o.push(c2);
        }
        return o;
      };
      /* Gold's own emaOf, verbatim — it seeds from the FIRST value, while the
         library ema() seeds differently; wrapping the library here drifted
         htf-confirm by ~0.1 point and the equivalence check caught it. */
      var emaOf = function(vals, n){
        if (!vals || vals.length < n || n <= 0) return NaN;
        var k = 2 / (n + 1), e = vals[0], i3;
        for (i3 = 1; i3 < vals.length; i3++) e = vals[i3] * k + e * (1 - k);
        return e;
      };
      var e21 = emaOf(closes.slice(-60), 21), e50 = emaOf(closes.slice(-120), 50);

    /* --- added indicator reads ------------------------------------------

       These are CONTEXT, deliberately conditional rather than hard. Adding
       four more hard gates to a twelve-gate ledger would cut tickets to
       almost nothing and the cut would be arbitrary: none of these has a
       measured record on this desk. They report, they show on the card, and
       they can veto only where the read is unambiguous and directional.

       An indicator that cannot be computed reads UNCHECKED, never PASS. */

    /* 13 — Ichimoku cloud position. A well-known gold trend filter. */
    var ich = null, ichWhy = 'ichimoku unavailable';
    var ichFn = gfn('ichimokuState');
    if (ichFn){
      try {
        /* indicators2.js returns { priceVsCloud:'ABOVE'|'BELOW'|'INSIDE',
           tkCross:'BULL'|'BEAR', cloudBull:bool }. Reading a .state or .label
           off it finds undefined and the gate reads UNCHECKED forever, which
           is exactly what the suite caught. */
        var ichR = ichFn(rows);
        var iState = ichR ? String(ichR.priceVsCloud || '') : '';
        if (iState === 'ABOVE' || iState === 'BELOW'){
          var bullCloud = (iState === 'ABOVE');
          var tk = ichR.tkCross === 'BULL';
          var ichAgrees = (hit.dir === 'long') ? bullCloud : !bullCloud;
          ichWhy = 'price ' + iState.toLowerCase() + ' the cloud, tenkan/kijun '
                 + (tk ? 'bull' : 'bear') + ', cloud ' + (ichR.cloudBull ? 'bull' : 'bear');
          /* A reversion mechanic is counter-cloud BY DESIGN — the same
             category error the trend gate already refuses to make. */
          if (reversion){
            ich = true;
            ichWhy += ' — counter-cloud is expected for a reversion mechanic';
          } else {
            /* A SOFT FAIL, not UNCHECKED. The cloud was read and it disagrees;
               reporting that as "unknown" would hide a known negative behind
               the label the ledger reserves for things it could not check. */
            ich = ichAgrees;
            ichWhy += ichAgrees ? ' — agrees' : ' — against this direction (context, not a veto)';
          }
        } else if (iState === 'INSIDE'){
          ichWhy = 'inside the cloud — no directional read';
        }
      } catch (eIch){ ich = null; ichWhy = 'ichimoku threw: ' + ((eIch && eIch.message) || eIch); }
    }
    gates.push({ key:'ichimoku', hard:false, info:true, pass: ich, why: ichWhy });

    /* 14 — Donchian position: where price sits in its own 20-bar range. */
    var don = null, donWhy = 'donchian unavailable';
    var donFn = gfn('donchian');
    if (donFn){
      try {
        /* indicators2.js returns { up, lo, mid } as ARRAYS, one entry per bar
           — not scalars, and not .upper/.lower. Both halves of that mistake
           read NaN and left the gate permanently UNCHECKED. */
        var dc = donFn(rows, 20);
        var dUa = dc && dc.up, dLa = dc && dc.lo;
        var dU = (dUa && dUa.length) ? fin(dUa[dUa.length - 1]) : NaN;
        var dL = (dLa && dLa.length) ? fin(dLa[dLa.length - 1]) : NaN;
        var dC = lastBar ? fin(lastBar.c) : NaN;
        if (isFinite(dU) && isFinite(dL) && isFinite(dC) && dU > dL){
          /* The channel is built from the bars BEFORE this one, so the close
             can sit outside it. That is a range break and worth saying, not a
             negative percentage on the card. */
          var pos = (dC - dL) / (dU - dL);
          var shown = Math.max(0, Math.min(1, pos));
          donWhy = (pos > 1 ? 'broken ABOVE the 20-bar range ('
                  : pos < 0 ? 'broken BELOW the 20-bar range ('
                  : 'at ' + (shown * 100).toFixed(0) + '% of the 20-bar range (')
                 + dL.toFixed(2) + '–' + dU.toFixed(2) + ')';
          /* Buying the very top or selling the very bottom of the range is
             the one case worth flagging as a fail. */
          if (hit.dir === 'long' && pos > 0.95){ don = false; donWhy += ' — buying the extreme high of the range'; }
          else if (hit.dir === 'short' && pos < 0.05){ don = false; donWhy += ' — selling the extreme low of the range'; }
          else { don = true; }
        }
      } catch (eDon){ don = null; donWhy = 'donchian threw: ' + ((eDon && eDon.message) || eDon); }
    }
    gates.push({ key:'donchian-pos', hard:false, info:true, pass: don, why: donWhy });

    /* 15 — Stochastic RSI extreme, as a momentum-exhaustion read. */
    var st = null, stWhy = 'stoch RSI unavailable';
    var stFn = gfn('stochRsi');
    if (stFn){
      try {
        var closes = [], ci;
        for (ci = 0; ci < rows.length; ci++){ var cv = fin(rows[ci].c); if (isFinite(cv)) closes.push(cv); }
        var sArr = stFn(closes, 14);
        var sv = (sArr && sArr.length) ? fin(sArr[sArr.length - 1]) : NaN;
        /* "unavailable" would claim the indicator is missing. It ran; on a
           tape with no RSI range in the window there is simply no value to
           read, and the card should say which of the two it is. */
        if (!isFinite(sv)) stWhy = 'stoch RSI has no value on this tape (no RSI range in the window)';
        if (isFinite(sv)){
          var v = sv > 1 ? sv / 100 : sv;           /* some builds return 0–100 */
          stWhy = 'stoch RSI ' + (v * 100).toFixed(0);
          if (hit.dir === 'long' && v >= 0.95){ st = false; stWhy += ' — buying into an exhausted high'; }
          else if (hit.dir === 'short' && v <= 0.05){ st = false; stWhy += ' — selling into an exhausted low'; }
          else { st = true; }
        }
      } catch (eSt){ st = null; stWhy = 'stoch RSI threw: ' + ((eSt && eSt.message) || eSt); }
    }
    gates.push({ key:'stoch-rsi', hard:false, info:true, pass: st, why: stWhy });

    /* 16 — Hurst exponent: is this series trending or mean-reverting right
       now? Reported for every mechanic, and used to flag the mismatch that
       matters — a reversion mechanic in a strongly trending tape. */
    var hu = null, huWhy = 'hurst unavailable';
    var huFn = gfn('hgHurstRS');
    if (huFn){
      try {
        var hcl = [], hi2;
        for (hi2 = 0; hi2 < rows.length; hi2++){ var hv = fin(rows[hi2].c); if (isFinite(hv)) hcl.push(hv); }
        var hr = huFn(hcl);
        var H = fin(hr && (hr.hurst !== undefined ? hr.hurst : hr));
        if (isFinite(H)){
          var trending = H > 0.55, reverting = H < 0.45;
          huWhy = 'Hurst ' + H.toFixed(2) + ' — '
                + (trending ? 'trending' : (reverting ? 'mean-reverting' : 'neither, random walk'));
          var isReversion = reversion;   /* the one derivation — see hgOgIsReversion */
          if (isReversion && trending){ hu = false; huWhy += ': a reversion mechanic against a trending tape'; }
          else { hu = true; }
        }
      } catch (eHu){ hu = null; huWhy = 'hurst threw: ' + ((eHu && eHu.message) || eHu); }
    }
    gates.push({ key:'hurst-regime', hard:false, info:true, pass: hu, why: huWhy });

    /* 18 — TTM squeeze state: compression, release, or neither. */
    var sq = null, sqWhy = 'squeeze unavailable';
    var sqFn = gfn('ttmSqueeze');
    if (sqFn){
      try {
        var sqR = sqFn(rows);
        var onA = sqR && sqR.on, fdA = sqR && sqR.fired, moA = sqR && sqR.momentum;
        if (onA && onA.length && moA && moA.length){
          var li = onA.length - 1;
          var isOn = onA[li] === true, didFire = !!(fdA && fdA[li] === true);
          var mo = fin(moA[li]);
          sqWhy = isOn ? 'in a volatility squeeze (compression, no expansion yet)'
                : didFire ? 'squeeze just released' : 'no squeeze';
          if (isFinite(mo)){
            var moUp = mo > 0;
            sqWhy += ', momentum ' + (moUp ? 'up' : 'down');
            var moAgrees = (hit.dir === 'long') ? moUp : !moUp;
            /* Entering INTO a live squeeze is entering before the market has
               chosen — worth saying, not worth vetoing. */
            if (isOn){ sq = false; sqWhy += ' — entering before the expansion has picked a side'; }
            else if (reversion){
              /* A fade is counter-momentum BY DESIGN. Marking it "against"
                 would be the same category error the trend gate refuses. */
              sq = true;
              sqWhy += moAgrees ? ' — agrees' : ' — counter-momentum by design';
            }
            else { sq = moAgrees; sqWhy += moAgrees ? ' — agrees' : ' — momentum points the other way'; }
          } else { sq = isOn ? false : null; }
        }
      } catch (eSq){ sq = null; sqWhy = 'squeeze threw: ' + ((eSq && eSq.message) || eSq); }
    }
    gates.push({ key:'squeeze-state', hard:false, info:true, pass: sq, why: sqWhy });

    /* 19 — Keltner position: riding the band, or stretched outside it. */
    var kel = null, kelWhy = 'keltner unavailable';
    var kelFn = gfn('keltner');
    if (kelFn){
      try {
        var kc = kelFn(rows, 20, 1.5);
        var kU = (kc && kc.up && kc.up.length) ? fin(kc.up[kc.up.length - 1]) : NaN;
        var kL = (kc && kc.lo && kc.lo.length) ? fin(kc.lo[kc.lo.length - 1]) : NaN;
        var kM = (kc && kc.mid && kc.mid.length) ? fin(kc.mid[kc.mid.length - 1]) : NaN;
        var kC = fin(rows[rows.length - 1].c);
        if (isFinite(kU) && isFinite(kL) && isFinite(kM) && isFinite(kC) && kU > kL){
          var outHigh = kC > kU, outLow = kC < kL;
          kelWhy = outHigh ? 'above the upper Keltner band'
                 : outLow ? 'below the lower Keltner band'
                 : 'inside the Keltner bands';
          if (reversion){
            /* Outside the band is exactly where a fade belongs. */
            kel = true;
            if (outHigh || outLow) kelWhy += ' — the stretch a reversion mechanic is fading';
          } else if ((hit.dir === 'long' && outHigh) || (hit.dir === 'short' && outLow)){
            kel = false;
            kelWhy += ' — chasing a move already extended past the band';
          } else {
            kel = true;
          }
        }
      } catch (eKel){ kel = null; kelWhy = 'keltner threw: ' + ((eKel && eKel.message) || eKel); }
    }
    gates.push({ key:'keltner-pos', hard:false, info:true, pass: kel, why: kelWhy });

    /* 21 — Market structure: is there a fresh opposing change of character?
       hgStructureGate returns { veto, bos, choch, note } and already words
       its own note, so the card quotes it rather than paraphrasing. */
    var stG = null, stGWhy = 'structure unavailable';
    var stGFn = gfn('hgStructureGate');
    if (stGFn){
      try {
        var sg = stGFn(rows, hit.dir, {});
        if (sg && typeof sg.note === 'string' && sg.note){
          stGWhy = sg.note;
          stG = (sg.veto === true) ? false : true;
          if (sg.veto === true) stGWhy += ' — structure turned against this direction';
        }
      } catch (eSt2){ stG = null; stGWhy = 'structure threw: ' + ((eSt2 && eSt2.message) || eSt2); }
    }
    gates.push({ key:'structure-shift', hard:false, info:true, pass: stG, why: stGWhy });

    /* 23 — MACD histogram: momentum turning, not merely present. macdHist
       returns a bare ARRAY of histogram values. */
    var mac = null, macWhy = 'MACD unavailable';
    var macFn = gfn('macdHist');
    if (macFn){
      try {
        var mh = macFn(closesOf(rows));
        var m0 = (mh && mh.length) ? fin(mh[mh.length - 1]) : NaN;
        var m1 = (mh && mh.length > 1) ? fin(mh[mh.length - 2]) : NaN;
        if (isFinite(m0) && isFinite(m1)){
          var rising = m0 > m1;
          macWhy = 'MACD histogram ' + (m0 >= 0 ? '+' : '') + m0.toFixed(2)
                 + ' and ' + (rising ? 'rising' : 'falling');
          var macAgrees = (hit.dir === 'long') ? rising : !rising;
          if (reversion){
            /* A fade wants momentum rolling over, which is the opposite of
               agreement — so agreement is not the test for it. */
            mac = true;
            macWhy += macAgrees ? ' — turning with the fade' : ' — still against the fade, early';
          } else {
            mac = macAgrees;
            macWhy += macAgrees ? ' — agrees' : ' — momentum is turning the other way';
          }
        }
      } catch (eMac){ mac = null; macWhy = 'MACD threw: ' + ((eMac && eMac.message) || eMac); }
    }
    gates.push({ key:'macd-momentum', hard:false, info:true, pass: mac, why: macWhy });

    /* 24 — Bollinger %B: where price sits across its own volatility envelope.
       bollingerPercentB returns a bare NUMBER (0 = lower band, 1 = upper). */
    var bb = null, bbWhy = 'bollinger %B unavailable';
    var bbFn = gfn('bollingerPercentB');
    if (bbFn){
      try {
        var pb = fin(bbFn(rows, 20, 2));
        if (isFinite(pb)){
          bbWhy = '%B ' + pb.toFixed(2) + ' ('
                + (pb > 1 ? 'above the upper band' : pb < 0 ? 'below the lower band'
                   : pb > 0.5 ? 'upper half' : 'lower half') + ')';
          if (reversion){
            bb = true;
            if (pb > 1 || pb < 0) bbWhy += ' — the stretch being faded';
          } else if (hit.dir === 'long' && pb > 1){ bb = false; bbWhy += ' — buying outside the envelope'; }
          else if (hit.dir === 'short' && pb < 0){ bb = false; bbWhy += ' — selling outside the envelope'; }
          else bb = true;
        }
      } catch (eBb){ bb = null; bbWhy = 'bollinger %B threw: ' + ((eBb && eBb.message) || eBb); }
    }
    gates.push({ key:'bollinger-pctb', hard:false, info:true, pass: bb, why: bbWhy });

    /* 25 — Volume z-score: is anyone actually here for this move? volZ
       returns a bare NUMBER. Gold feeds without volume return NaN, which
       reads UNCHECKED rather than pretending participation was confirmed. */
    var vz = null, vzWhy = 'volume z unavailable (this feed may publish no volume)';
    var vzFn = gfn('volZ');
    if (vzFn){
      try {
        var z20 = fin(vzFn(rows, 20));
        if (isFinite(z20)){
          vzWhy = 'volume ' + (z20 >= 0 ? '+' : '') + z20.toFixed(1) + 'σ vs its 20-bar mean';
          if (z20 <= -1){ vz = false; vzWhy += ' — nobody is here for this move'; }
          else vz = true;
        }
      } catch (eVz){ vz = null; vzWhy = 'volume z threw: ' + ((eVz && eVz.message) || eVz); }
    }
    gates.push({ key:'volume-z', hard:false, info:true, pass: vz, why: vzWhy });

    /* 26 — Linear regression slope: the trend's actual gradient, in dollars
       per bar, rather than a crossover's opinion of it. Returns an ARRAY. */
    var lr = null, lrWhy = 'regression slope unavailable';
    var lrFn = gfn('linregSlope');
    if (lrFn){
      try {
        var slArr = lrFn(closesOf(rows), 20);
        var sl = (slArr && slArr.length) ? fin(slArr[slArr.length - 1]) : NaN;
        var aRef = atrOf(rows, 14);
        if (isFinite(sl) && isFinite(aRef) && aRef > 0){
          var perAtr = sl / aRef;
          lrWhy = '20-bar regression slope ' + (sl >= 0 ? '+' : '') + sl.toFixed(2)
                + '/bar (' + (perAtr >= 0 ? '+' : '') + perAtr.toFixed(2) + ' ATR)';
          var flat = Math.abs(perAtr) < 0.02;
          if (flat){
            lr = reversion ? true : false;
            lrWhy += flat && reversion ? ' — flat, which is what a fade wants'
                                       : ' — flat, no gradient behind a continuation';
          } else {
            var slUp = sl > 0;
            var slAgrees = (hit.dir === 'long') ? slUp : !slUp;
            lr = reversion ? true : slAgrees;
            lrWhy += reversion ? ' — counter-slope by design'
                   : (slAgrees ? ' — agrees' : ' — the gradient points the other way');
          }
        }
      } catch (eLr){ lr = null; lrWhy = 'regression slope threw: ' + ((eLr && eLr.message) || eLr); }
    }
    gates.push({ key:'regression-slope', hard:false, info:true, pass: lr, why: lrWhy });

    /* 27 — Volume profile: is the entry near value, or out in thin air where
       there is no traded history to lean on? volumeProfile returns
       { poc, vah, val, bins }. */
    var vpf = null, vpfWhy = 'volume profile unavailable';
    var vpfFn = gfn('volumeProfile');
    if (vpfFn){
      try {
        var prof = vpfFn(rows, Math.max(0, rows.length - 200), rows.length - 1);
        var poc = prof ? fin(prof.poc) : NaN;
        var vah = prof ? fin(prof.vah) : NaN;
        var val = prof ? fin(prof.val) : NaN;
        var pxNow = fin(rows[rows.length - 1].c);
        if (isFinite(poc) && isFinite(vah) && isFinite(val) && isFinite(pxNow) && vah > val){
          var inValue = pxNow >= val && pxNow <= vah;
          vpfWhy = 'price ' + (inValue ? 'inside' : 'outside') + ' value ('
                 + val.toFixed(2) + '–' + vah.toFixed(2) + ', POC ' + poc.toFixed(2) + ')';
          if (reversion){
            /* Fades work back toward the POC; being outside value is the setup. */
            vpf = true;
            if (!inValue) vpfWhy += ' — outside value, with the POC as the magnet';
          } else {
            /* A continuation entered deep inside value is fighting the whole
               traded distribution to get anywhere. */
            vpf = !inValue;
            vpfWhy += inValue ? ' — a continuation starting inside the value area'
                              : ' — outside value, with room to travel';
          }
        }
      } catch (eVpf){ vpf = null; vpfWhy = 'volume profile threw: ' + ((eVpf && eVpf.message) || eVpf); }
    }
    gates.push({ key:'value-area', hard:false, info:true, pass: vpf, why: vpfWhy });

    /* 28 — HIGHER TIMEFRAME CONFIRMATION.

       The one read on this ledger that adds robustness rather than opinion.
       Everything else judges the setup against the timeframe it fired on;
       this asks whether the timeframe above agrees, which is the question a
       desk asks before sizing up. A 1h long inside a 4h downtrend is a
       different trade from the same 1h long inside a 4h uptrend, and until
       now the card could not tell them apart.

       The higher timeframe is RESAMPLED from bars already in hand — no second
       fetch, no second source that can disagree with the first, and both
       views provably describe the same bars.

       Info, not hard. A counter-HTF trade is a real thing a desk takes on
       purpose, and this has no measured record on gold. It argues; it does
       not veto. */
    var htf = null, htfWhy = 'higher timeframe unavailable';
    try {
      /* hgOgResample is omnigold's wrapper; resolve it by lookup with a direct
         hgMechResample fallback so this works on a desk loaded without gold. */
      var __rsF = gfn('hgOgResample') || gfn('hgMechResample');
      var hRows = __rsF ? __rsF(rows, 4) : null;
      if (hRows && hRows.length >= 60){
        var hCl = closesOf(hRows);
        var h21 = emaOf(hCl.slice(-60), 21), h50 = emaOf(hCl.slice(-120), 50);
        var hLast = hCl.length ? hCl[hCl.length - 1] : NaN;
        if (isFinite(h21) && isFinite(h50) && isFinite(hLast)){
          var hUp = h21 >= h50;
          var hAgrees = (hit.dir === 'long') ? hUp : !hUp;
          htfWhy = '4x timeframe is ' + (hUp ? 'up' : 'down')
                 + ' (EMA21 ' + h21.toFixed(2) + ' vs EMA50 ' + h50.toFixed(2) + ')';
          if (reversion){
            /* A fade is counter-trend by design on every timeframe. */
            htf = true;
            htfWhy += hAgrees ? ' — and agrees' : ' — counter-trend by design for a reversion mechanic';
          } else {
            htf = hAgrees;
            htfWhy += hAgrees ? ' — agrees, the trade is with the timeframe above'
                              : ' — this is a counter-trend trade against the timeframe above';
          }
        }
      } else if (hRows){
        htfWhy = 'only ' + hRows.length + ' higher-timeframe bars — too few to read a trend';
      }
    } catch (eHtf){ htf = null; htfWhy = 'higher timeframe threw: ' + ((eHtf && eHtf.message) || eHtf); }
    gates.push({ key:'htf-confirm', hard:false, info:true, pass: htf, why: htfWhy });

    /* 29 — REGIME FIT. detectRegime returns { regime, label }.

       Trend mechanics need a trending tape and reversion mechanics need a
       ranging one. That is not a preference, it is the definition of the
       mechanic — and running a breakout in a dead range is the single most
       reliable way to pay the spread repeatedly for nothing. */
    var reg = null, regWhy = 'regime unavailable';
    var regFn = gfn('detectRegime');
    if (regFn){
      try {
        var rg = regFn(rows);
        var rName = rg ? String(rg.regime || '') : '';
        var rLabel = rg ? String(rg.label || rName) : '';
        if (rName){
          var trendy = /trend/i.test(rName);
          var rangey = /range|chop|mean/i.test(rName);
          regWhy = 'regime reads ' + (rLabel || rName);
          if (!trendy && !rangey){
            reg = true;
            regWhy += ' — no clear regime either way';
          } else if (reversion){
            reg = rangey;
            regWhy += rangey ? ' — a ranging tape is what a reversion mechanic wants'
                             : ' — fading a trending tape';
          } else {
            reg = trendy;
            regWhy += trendy ? ' — a trending tape is what a continuation mechanic wants'
                             : ' — a continuation mechanic in a tape that is not trending';
          }
        }
      } catch (eReg){ reg = null; regWhy = 'regime threw: ' + ((eReg && eReg.message) || eReg); }
    }
    gates.push({ key:'regime-fit', hard:false, info:true, pass: reg, why: regWhy });

    /* ============ BANK TWO — six more reads, every desk at once ============

       Added 2026-08 when the ask became "feed the tabs more indicators and
       strategies". Because every desk consumes this one function (the two
       ledger desks directly, the eight tally desks through hgContextRead),
       six additions here upgrade the whole app. Same contract as the first
       fourteen: info-only, honest UNCHECKED, and a reversion mechanic is
       never punished for being counter-trend — that is what it IS; whether
       the fade should exist at all is fade-strength's call, not context. */

    /* 30 — ADX/DI: is there directional energy, and whose side is it on? */
    var axG = null, axWhy = 'ADX unavailable';
    var axFn = gfn('adx');
    if (axFn){
      try {
        var axr = axFn(rows, 14), axn = rows.length - 1;
        var axNow = fin(axr.adx[axn]), pdi = fin(axr.plusDI[axn]), mdi = fin(axr.minusDI[axn]);
        if (isFinite(axNow) && isFinite(pdi) && isFinite(mdi)){
          var diUp = pdi > mdi;
          var diAgrees = (hit.dir === 'long') ? diUp : !diUp;
          axWhy = 'ADX ' + axNow.toFixed(0) + ' with DI ' + (diUp ? 'up' : 'down');
          if (reversion){
            axG = true;
            axWhy += ' — counter-trend by design; whether the fade should exist is fade-strength’s call';
          } else if (axNow < 20){
            axG = false;
            axWhy += ' — no directional energy behind a continuation';
          } else {
            axG = diAgrees;
            axWhy += diAgrees ? ' — the energy is on this side' : ' — the energy is on the other side';
          }
        }
      } catch (eAx){ axG = null; axWhy = 'ADX threw: ' + ((eAx && eAx.message) || eAx); }
    }
    gates.push({ key:'adx-regime', hard:false, info:true, pass: axG, why: axWhy });

    /* 31 — OBV flow: is volume accumulating with the trade or against it? */
    var obvG = null, obvWhy = 'volume series unavailable';
    try {
      var obv = 0, obvBack = NaN, oi3, oc, op, ov, obvSpan = Math.min(rows.length - 1, 60);
      var haveVol = false;
      for (oi3 = rows.length - obvSpan; oi3 < rows.length; oi3++){
        oc = fin(rows[oi3].c); op = fin(rows[oi3 - 1].c); ov = fin(rows[oi3].v);
        if (!isFinite(oc) || !isFinite(op) || !isFinite(ov)) continue;
        haveVol = haveVol || ov > 0;
        obv += (oc > op ? ov : (oc < op ? -ov : 0));
        if (oi3 === rows.length - 21) obvBack = obv;
      }
      if (haveVol && isFinite(obvBack)){
        var obvRising = (obv - obvBack) > 0;
        var obvAgrees = (hit.dir === 'long') ? obvRising : !obvRising;
        obvWhy = 'on-balance volume ' + (obvRising ? 'rising' : 'falling') + ' over 20 bars';
        if (reversion){
          obvG = true;
          obvWhy += ' — the flow a fade fades, by design';
        } else {
          obvG = obvAgrees;
          obvWhy += obvAgrees ? ' — volume backs this side' : ' — volume is walking the other way';
        }
      }
    } catch (eObv){ obvG = null; obvWhy = 'OBV threw: ' + ((eObv && eObv.message) || eObv); }
    gates.push({ key:'obv-flow', hard:false, info:true, pass: obvG, why: obvWhy });

    /* 32 — MFI pressure: money-flow exhaustion at the extremes. Unlike the
       trend reads, this one CAN argue against a fade's counterpart — buying
       a tape already stuffed above 80 is late whoever you are. */
    var mfiG = null, mfiWhy = 'MFI inputs unavailable';
    try {
      var mp = 14, posF = 0, negF = 0, mi, tpN, tpP, mv;
      if (rows.length > mp + 1){
        for (mi = rows.length - mp; mi < rows.length; mi++){
          tpN = (fin(rows[mi].h) + fin(rows[mi].l) + fin(rows[mi].c)) / 3;
          tpP = (fin(rows[mi - 1].h) + fin(rows[mi - 1].l) + fin(rows[mi - 1].c)) / 3;
          mv = fin(rows[mi].v);
          if (!isFinite(tpN) || !isFinite(tpP) || !isFinite(mv)) continue;
          if (tpN > tpP) posF += tpN * mv; else if (tpN < tpP) negF += tpN * mv;
        }
        if (posF + negF > 0){
          var mfi = 100 * posF / (posF + negF);
          mfiWhy = 'MFI(14) ' + mfi.toFixed(0);
          if (hit.dir === 'long' && mfi >= 80){ mfiG = false; mfiWhy += ' — buying a tape already stuffed with money flow'; }
          else if (hit.dir === 'short' && mfi <= 20){ mfiG = false; mfiWhy += ' — selling a tape already drained'; }
          else { mfiG = true; mfiWhy += ' — no money-flow exhaustion against this entry'; }
        }
      }
    } catch (eMfi){ mfiG = null; mfiWhy = 'MFI threw: ' + ((eMfi && eMfi.message) || eMfi); }
    gates.push({ key:'mfi-pressure', hard:false, info:true, pass: mfiG, why: mfiWhy });

    /* 33 — CCI stretch: entering WITH a ±200 blowoff is chasing it. A
       reversion mechanic entering AGAINST the stretch is the design. */
    var cciG = null, cciWhy = 'CCI inputs unavailable';
    try {
      var cp = 20;
      if (rows.length > cp + 1){
        var tps = [], ci2;
        for (ci2 = rows.length - cp; ci2 < rows.length; ci2++){
          tps.push((fin(rows[ci2].h) + fin(rows[ci2].l) + fin(rows[ci2].c)) / 3);
        }
        var tpSum = 0; for (ci2 = 0; ci2 < tps.length; ci2++) tpSum += tps[ci2];
        var tpMean = tpSum / tps.length, dev = 0;
        for (ci2 = 0; ci2 < tps.length; ci2++) dev += Math.abs(tps[ci2] - tpMean);
        dev /= tps.length;
        if (dev > 0){
          var cci = (tps[tps.length - 1] - tpMean) / (0.015 * dev);
          cciWhy = 'CCI(20) ' + cci.toFixed(0);
          if (!reversion && hit.dir === 'long' && cci >= 200){ cciG = false; cciWhy += ' — chasing a +200 blowoff'; }
          else if (!reversion && hit.dir === 'short' && cci <= -200){ cciG = false; cciWhy += ' — chasing a −200 washout'; }
          else if (reversion && ((hit.dir === 'short' && cci >= 200) || (hit.dir === 'long' && cci <= -200))){
            cciG = true; cciWhy += ' — a stretched tape is the fade’s premise';
          } else { cciG = true; cciWhy += ' — no blowoff to chase'; }
        }
      }
    } catch (eCci){ cciG = null; cciWhy = 'CCI threw: ' + ((eCci && eCci.message) || eCci); }
    gates.push({ key:'cci-stretch', hard:false, info:true, pass: cciG, why: cciWhy });

    /* 34 — EMA ribbon: 8/21/50 stack alignment. */
    var rbG = null, rbWhy = 'EMA ribbon inputs unavailable';
    try {
      if (closes.length >= 50){
        var e8 = emaOf(closes, 8), e21b = emaOf(closes, 21), e50b = emaOf(closes, 50);
        if (isFinite(e8) && isFinite(e21b) && isFinite(e50b)){
          var stackUp = e8 > e21b && e21b > e50b;
          var stackDn = e8 < e21b && e21b < e50b;
          rbWhy = 'EMA 8/21/50 ' + (stackUp ? 'stacked up' : (stackDn ? 'stacked down' : 'tangled'));
          if (reversion){
            rbG = true;
            rbWhy += stackUp || stackDn ? ' — counter-ribbon by design' : ' — a tangled ribbon suits a fade';
          } else if (!stackUp && !stackDn){
            rbG = false;
            rbWhy += ' — no alignment behind a continuation';
          } else {
            rbG = (hit.dir === 'long') ? stackUp : stackDn;
            rbWhy += rbG ? ' — aligned with this side' : ' — stacked against it';
          }
        }
      }
    } catch (eRb){ rbG = null; rbWhy = 'ribbon threw: ' + ((eRb && eRb.message) || eRb); }
    gates.push({ key:'ema-ribbon', hard:false, info:true, pass: rbG, why: rbWhy });

    /* 35 — Heikin-Ashi run: three smoothed candles one way is short-term
       momentum whoever measures it. */
    var haG = null, haWhy = 'not enough bars for a Heikin-Ashi read';
    try {
      if (rows.length >= 5){
        var hb = rows.slice(-4), haO = (fin(hb[0].o) + fin(hb[0].c)) / 2, haC, haCol = [], hi2;
        for (hi2 = 0; hi2 < hb.length; hi2++){
          haC = (fin(hb[hi2].o) + fin(hb[hi2].h) + fin(hb[hi2].l) + fin(hb[hi2].c)) / 4;
          if (hi2 > 0) haO = (haO + haCol[hi2 - 1].c) / 2;
          haCol.push({ o: haO, c: haC });
        }
        var ups = 0, dns = 0;
        for (hi2 = 1; hi2 < haCol.length; hi2++){
          if (haCol[hi2].c > haCol[hi2].o) ups++; else if (haCol[hi2].c < haCol[hi2].o) dns++;
        }
        var haRun = (ups === 3) ? 'up' : (dns === 3 ? 'down' : null);
        haWhy = haRun ? 'three Heikin-Ashi candles ' + haRun : 'no three-candle Heikin-Ashi run either way';
        if (!haRun){ haG = true; }
        else if (reversion){
          haG = true;
          haWhy += ' — the run a fade steps in front of, by design';
        } else {
          haG = (hit.dir === 'long') ? haRun === 'up' : haRun === 'down';
          haWhy += haG ? ' — momentum with this side' : ' — momentum the other way';
        }
      }
    } catch (eHa){ haG = null; haWhy = 'Heikin-Ashi threw: ' + ((eHa && eHa.message) || eHa); }
    gates.push({ key:'heikin-trend', hard:false, info:true, pass: haG, why: haWhy });
    } catch (eCtx){
      gates.push({ key:'context-gates', hard:false, info:true, pass:null,
                   why:'context block threw: ' + ((eCtx && eCtx.message) || eCtx) });
    }
    return gates;
  }

  /* ================= the one-call context read ==================

     Every desk that grades by hand-summed tally rather than a ledger —
     GOLD SCALP, GOLD SWING, GOLD PRO, EDGE, SQUEEZE, TRENDTABLE, OI FLOW,
     STAR TRADER, both best-levels refiners — asked the same question the
     two ledger desks already answer: what do the indicators actually say
     about this setup? This is hgIndicatorGates packaged for them.

     Three guarantees the callers cannot each be trusted to re-implement:

       CLOSED BARS. Most of those desks feed a forming candle into their
       indicator math (measured in the 2026-08 audit: five of six crypto
       desks, all of goldind). The last bar is dropped HERE whenever it is
       younger than the tape's own bar spacing — self-sufficient, no tf
       label needed, and a no-op on historical tapes.

       INFO ONLY. Nothing returned here vetoes. The counts summarise 14
       verdicts; what a desk does with "9 against" is that desk's policy.

       HONEST COUNTS. withN/againstN count only gates that evaluated;
       gates that could not run are n/a, never silently counted as agreeing. */
  function hgContextRead(rows, dir, kind, reversion){
    try{
      if (dir !== 'long' && dir !== 'short') return null;
      if (!rows || rows.length < 60) return null;
      var clean = [], i, r;
      for (i = 0; i < rows.length; i++){
        r = rows[i];
        if (r && isFinite(fin(r.c))) clean.push(r);
      }
      if (clean.length < 60) return null;
      var sp = hgBarSpacingSec(clean);
      var lastT = fin(clean[clean.length - 1].t);
      if (isFinite(lastT) && lastT > 1e12) lastT = Math.floor(lastT / 1000);
      if (isFinite(sp) && sp > 0 && isFinite(lastT)
          && (Date.now() / 1000 - lastT) < sp){
        clean = clean.slice(0, -1);
      }
      if (clean.length < 60) return null;
      var gates = hgIndicatorGates(clean, { dir: dir, kind: String(kind || '') }, {},
                                   reversion === true);
      if (!gates || !gates.length) return null;
      var withN = 0, againstN = 0, na = 0, g;
      for (i = 0; i < gates.length; i++){
        g = gates[i];
        if (!g) continue;
        if (g.pass === true) withN++;
        else if (g.pass === false) againstN++;
        else na++;
      }
      /* The policy thresholds SCALE with the panel. When the bank grew from
         14 to 20 gates, every consumer that had hardcoded "5 objections"
         would silently loosen — so the bar lives here, once: adverse is a
         third of the panel objecting (5 of 14 then, 7 of 20 now), clean is
         at most one objection. Consumers read cx.adverse / cx.clean and
         never count for themselves. */
      var advBar = Math.max(4, Math.ceil(gates.length * 0.35));
      return { gates: gates, withN: withN, againstN: againstN, na: na,
               adverse: againstN >= advBar,
               clean: againstN <= 1,
               read: 'indicator context ' + withN + ' with / ' + againstN + ' against'
                   + (na ? ' / ' + na + ' n-a' : '') + ' of ' + gates.length };
    }catch(e){ return null; }
  }

  G.hgContextRead   = hgContextRead;
  G.hgBarSpacingSec = hgBarSpacingSec;
  G.hgSlotMeanVol   = hgSlotMeanVol;
  G.hgNewsGate      = hgNewsGate;
  G.hgIndicatorGates = hgIndicatorGates;

})(typeof window !== 'undefined' ? window : globalThis);
