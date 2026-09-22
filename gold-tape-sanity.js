/* HARDGATE — gold-tape-sanity.js — ONE RULE FOR WHETHER A GOLD TAPE IS MADE
   OF POSSIBLE CANDLES.

   Every gold desk validates that it HAS bars — a count, a positive ATR, a
   positive entry. None of them validated that the bars are ones a market
   could have produced: a high below its own low, a range that does not
   contain the open or close, a price that is not a number, a timestamp that
   repeats or runs backwards.

   Those are not edge cases in the arithmetic. They are impossible candles,
   and every level drawn from them is drawn from something that never
   happened.

   MEASURED (pack 907). index.html's GOLD nav group holds sixteen tabs;
   fifteen of them register and can be driven. Feed the whole family a tape
   with one bar in twenty arriving with its high and low swapped — a proxy
   glitch or a bad merge — and EIGHT of those fifteen render a different set
   of numbers than they do on the clean tape:

     omnigold1  optigold  newgold  goldswing  goldscalp  goldultra
     goldpine   80percent

   Only ONE of the eight said so: GOLD SCALP, which got this check in pack
   906. The other seven changed their levels and reported nothing. The same
   eight move at 2%, 5% and 10% inversion, so the set is a property of what
   each desk computes, not of one draw.

   The size of the move is not uniform and is not always "fewer setups".
   GOLD SWING rendered a THIRD LESS than on the clean tape (42,128 chars of
   text against 27,916) while OPTI GOLD and 80PERCENT roughly DOUBLED. A
   malformed tape does not fail loudly; it quietly produces a different
   board.

   THE SEVEN THAT DID NOT MOVE ARE NOT CERTIFIED CLEAN. super-gold, omnigold,
   golddirection, goldpro, goldspot, goldcoint and tauric held still in that
   harness, but four of them render no decimal number in it at all, which
   makes their result "not exercised" rather than "immune".

   So five of those seven — omnigold, golddirection, goldpro, goldcoint and
   tauric — are wired here as well, on the tapes they actually fetch, and the
   answer comes from the bars rather than from what the harness happened to
   reach. THIRTEEN of the fifteen are wired.

   THE TWO THAT ARE NOT, named rather than quietly counted as done:

     super-gold  reads other desks' published snapshots and fetches no gold
                 candles of its own, so it has no tape to judge; the note
                 belongs on whichever desk drew the bars.
     goldspot    is a spot-price readout with no candle fetch at all.

   Neither is silent by oversight. Add a candle fetch to either and it needs
   wiring, which is what test-gold-tape-sanity-family.mjs checks.

   IT REPORTS; IT DOES NOT GATE. A malformed bar is disclosed, never dropped.
   Which bars to discard is a data-repair policy, and inventing one here —
   silently deleting a bar the feed sent, or "correcting" it by swapping the
   high and low back — would be exactly the invisible correction this desk
   exists to avoid. The note says what arrived and leaves the decision where
   it belongs. */
(function(W){
  'use strict';
  if (!W) return;

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* The rule. Returns a report; never throws, never mutates rows, never
     returns a fabricated zero for a tape it could not read — an absent or
     empty tape comes back with bars:0 and ok:true, which the note renders as
     nothing at all, because "no bars" is a different complaint and other
     code already makes it. */
  function hgGoldTapeSanity(rows){
    var out = { bars: 0, bad: 0, inverted: 0, bodyOutside: 0, nonFinite: 0, timeOrder: 0, ok: true };
    /* Array.isArray, not a duck-typed length check. Moving this rule out of
       goldscalp.js, an earlier draft of pack 907 accepted anything with a
       numeric .length — and a STRING has one, so hgGoldTapeSanity('x')
       reported one malformed bar and would have painted the banner for
       something that is not a tape at all. A fabricated fault is the same
       sin as a fabricated zero. */
    if (!Array.isArray(rows) || !rows.length) return out;
    /* BAD_CAP bounds the WORK, not the number: the walk stops at the first
       bar that reaches it. One bar can carry two faults — an impossible range
       AND a timestamp that goes backwards — so the reported count can exceed
       the cap by one. Clamping it would be a prettier number and a less true
       one. */
    var BAD_CAP = 5000;
    var i, b, o, h, l, c, t, prevT = NaN;
    out.bars = rows.length;
    for (i = 0; i < rows.length; i++){
      if (out.bad >= BAD_CAP) break;
      b = rows[i];
      if (!b){ out.nonFinite++; out.bad++; continue; }
      o = +b.o; h = +b.h; l = +b.l; c = +b.c; t = +b.t;
      if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)){ out.nonFinite++; out.bad++; continue; }
      if (h < l){ out.inverted++; out.bad++; }
      else if (h < Math.max(o, c) || l > Math.min(o, c)){ out.bodyOutside++; out.bad++; }
      if (isFinite(t)){
        if (isFinite(prevT) && t <= prevT){ out.timeOrder++; out.bad++; }
        prevT = t;
      }
      if (out.bad >= BAD_CAP) break;
    }
    out.ok = out.bad === 0;
    return out;
  }

  /* The banner. tfLabel is the desk's own timeframe so the note names the
     bars the reader is looking at ('15m', '4h', '1h'); absent, it says
     'bars'. Returns '' for a clean or unreadable tape, so a caller can
     concatenate it unconditionally. */
  function hgGoldTapeSanityNote(rep, tfLabel){
    if (!rep || rep.ok || !rep.bars) return '';
    var bits = [];
    if (rep.inverted) bits.push(rep.inverted + ' with the high below the low');
    if (rep.bodyOutside) bits.push(rep.bodyOutside + ' whose range does not contain the open or close');
    if (rep.nonFinite) bits.push(rep.nonFinite + ' with a price that is not a number');
    if (rep.timeOrder) bits.push(rep.timeOrder + ' whose timestamp repeats or goes backwards');
    if (!bits.length) return '';
    var tf = tfLabel ? (esc(tfLabel) + ' bars') : 'bars';
    var pct = Math.round(1000 * rep.bad / rep.bars) / 10;
    return '<div class="note warn" style="margin:8px 0;padding:8px 10px;border:1px solid #F59E0B;border-radius:6px">'
      + '<b>MALFORMED BARS</b> — ' + rep.bad + ' of ' + rep.bars + ' ' + tf + ' (' + pct + '%) are not '
      + 'possible candles: ' + esc(bits.join(', ')) + '. Every level below was drawn from this tape, '
      + 'including those bars. Measured across the gold family, eight of the fifteen tabs that can be '
      + 'driven render different numbers on a tape with one bar in twenty inverted — GOLD SWING a third '
      + 'less output, OPTI GOLD and 80PERCENT roughly double — and before this note only one of the '
      + 'eight said so. Nothing here is dropped or corrected: which bars to discard is a data-repair '
      + 'decision, not one this desk should make for you.</div>';
  }


  /* ------------------------------------------------------------------
     IS THE TAPE CONTINUOUS?

     hgGoldTapeSanity asks whether each bar is one a market could have
     produced. It says nothing about whether the bars are CONSECUTIVE, and a
     feed can return two hundred perfectly well-formed bars with a run of
     them missing out of the middle. Every indicator in this app walks the
     array by index, so a hole means EMA, ATR and RSI are computed across a
     discontinuity and "twenty bars ago" is not twenty bars ago.

     MEASURED (pack 908). Delete a contiguous run from a 220-bar 15m tape and
     re-run the app's own atr/ema/rsi, 400 seeded tapes per cell. The damage
     depends almost entirely on HOW RECENT the hole is, which is why this
     reports the distance and not just the count:

       hole ends ... before the last bar    ATR14      RSI14
         110 bars (12 missing)               0.002%     0.004%
          40 bars (12 missing)               0.230%     0.603%
          20 bars (12 missing)               1.066%     2.562%
          10 bars (12 missing)               2.601%     4.535%
           2 bars (12 missing)               4.934%     7.251%
           2 bars (48 missing)               7.821%    20.577%

     An old hole barely moves a trailing indicator — it has rolled out of the
     window. A recent one moves ATR by several per cent, and ATR is the
     distance the stop is placed at, so it is the distance R is measured in
     and the size is derived from. A first draft of this comment claimed a
     mid-tape hole distorted ATR; the measurement said otherwise, and the
     table above is what replaced the claim.

     THE WEEKEND IS NOT A HOLE. Gold shuts from Friday evening to Sunday
     evening, so a rule that flagged every gap would fire every week and be
     ignored by the second one. Gaps are classified with the app's OWN
     hgInGoldWeekend — the same DST-aware definition the weekend-exposure
     panel uses — rather than a second copy of the trading calendar.

     WHEN THAT HELPER IS NOT LOADED, gaps are reported as UNCLASSIFIED rather
     than guessed either way. Calling them all holes would cry wolf weekly;
     calling them all weekends would hide the real ones. Absent is absent. */

  function hgGoldTapeSpacing(rows){
    /* The tape's own bar spacing: the median of CONSECUTIVE gaps.

       Not a strided sample. A first draft of this walked every Nth bar and
       divided, and on a DAILY gold tape — four 1-day steps then one 3-day
       weekend step — that smeared the closure across the estimate and
       returned 144000 instead of 86400. The rule stayed silent, which looked
       like a pass, but a hole then had to exceed two and a half days to
       register at all. A wrong spacing does not announce itself; it just
       makes the check weaker.

       Consecutive gaps put the weekend in the tail where the median ignores
       it, because a gold week has four ordinary steps for every closed one.
       Returns NaN when there is nothing to measure — never a default
       interval, which would silently reclassify every gap on a tape this
       could not read. */
    if (!Array.isArray(rows) || rows.length < 3) return NaN;
    var gaps = [], i, a, b;
    var from = Math.max(1, rows.length - 256);   /* bounded work, recent end of the tape */
    for (i = from; i < rows.length; i++){
      a = rows[i - 1] && +rows[i - 1].t;
      b = rows[i] && +rows[i].t;
      if (!isFinite(a) || !isFinite(b) || b <= a) continue;
      gaps.push(b - a);
    }
    if (!gaps.length) return NaN;
    gaps.sort(function(x, y){ return x - y; });
    return gaps[Math.floor(gaps.length / 2)];
  }

  function hgGoldTapeGaps(rows, opts){
    /* No weekendGaps tally: a gap the closure fully explains is not a gap in
       the bars, so counting it would invite it to be read as a defect. */
    var out = { bars: 0, spacing: NaN, holes: 0, unclassified: 0,
                missingBars: 0, nearestHoleFromEnd: null, worst: null, ok: true };
    if (!Array.isArray(rows) || rows.length < 3) return out;
    out.bars = rows.length;
    var sp = hgGoldTapeSpacing(rows);
    out.spacing = sp;
    if (!isFinite(sp) || sp <= 0) return out;   /* unreadable spacing: no verdict */

    var wkFn = (opts && opts.inWeekend) || W.hgInGoldWeekend;
    var canClassify = typeof wkFn === 'function';

    /* HOW MANY BARS THE GAP IS ACTUALLY MISSING.

       Not round(d / spacing) - 1. That counts the weekend hours inside a gap
       as missing bars, and an early draft of this rule reported a 48-bar hole
       that happened to swallow a weekend as 96 missing bars — a true statement
       about wall-clock and a false one about bars.

       So the slots are walked and the closed ones are not counted. That also
       removes the need to ask separately whether a gap "is" a weekend: a gap
       fully explained by the closure has zero missing bars and is not a hole,
       and a hole that starts at the Friday edge or runs through a weekend is
       still a hole of exactly the size it is. One rule, no edge cases.

       The walk is bounded. Past the cap the gap is far larger than anything a
       weekend explains, so it is reported at the cap and marked as at least
       that many rather than run to the end. */
    var SLOT_CAP = 5000;
    function missingBars(a, b, sp){
      var n = Math.round((b - a) / sp) - 1;
      if (n < 1) return 0;
      if (!canClassify) return n;
      var counted = 0, walked = 0, t;
      for (t = a + sp; t < b - sp * 0.5 && walked < SLOT_CAP; t += sp, walked++){
        var closed = false;
        try { closed = !!wkFn(t); } catch (eW) { return n; }   /* a throwing calendar is no calendar */
        if (!closed) counted++;
      }
      if (walked >= SLOT_CAP) return Math.max(counted, 1);
      return counted;
    }

    var i, a, b, d, miss;
    for (i = 1; i < rows.length; i++){
      a = rows[i - 1] && +rows[i - 1].t;
      b = rows[i] && +rows[i].t;
      if (!isFinite(a) || !isFinite(b) || b <= a) continue;   /* backwards time is hgGoldTapeSanity's complaint */
      d = b - a;
      if (d <= sp * 1.5) continue;
      if (!canClassify){
        /* Without the calendar a gap is not guessed either way: calling them
           all holes cries wolf every weekend, calling them all weekends hides
           the real ones. */
        out.unclassified++;
        continue;
      }
      miss = missingBars(a, b, sp);
      if (miss < 1) continue;                                  /* fully explained by the closure */
      out.holes++;
      out.missingBars += miss;
      var fromEnd = rows.length - 1 - i;
      if (out.nearestHoleFromEnd === null || fromEnd < out.nearestHoleFromEnd) out.nearestHoleFromEnd = fromEnd;
      if (!out.worst || miss > out.worst.missing) out.worst = { missing: miss, fromEnd: fromEnd };
    }
    out.ok = out.holes === 0 && out.unclassified === 0;
    return out;
  }

  /* The distance bands come from the table above: they are what was measured,
     not a severity scale invented to have three colours. */
  function hgGoldGapReach(fromEnd){
    if (!isFinite(fromEnd)) return '';
    if (fromEnd <= 10) return 'inside the window ATR14 and RSI14 are computed over, where a 12-bar hole moved ATR by 2.6% and RSI by 4.5% in the pack-908 measurement';
    if (fromEnd <= 40) return 'at the edge of the ATR14 window, where a 12-bar hole moved ATR by 0.2-1.1%';
    return 'older than the ATR14 and RSI14 windows, so it does not move those; structure and level detection read the whole tape and can still see it';
  }

  function hgGoldTapeGapNote(rep, tfLabel){
    if (!rep || rep.ok || !rep.bars) return '';
    var tf = tfLabel ? (esc(tfLabel) + ' bars') : 'bars';
    var bits = [];
    if (rep.holes){
      bits.push(rep.holes + (rep.holes === 1 ? ' hole' : ' holes') + ' totalling ' + rep.missingBars
        + ' missing ' + (rep.missingBars === 1 ? 'bar' : 'bars'));
    }
    if (rep.unclassified){
      bits.push(rep.unclassified + ' ' + (rep.unclassified === 1 ? 'gap' : 'gaps')
        + ' that could not be classified, because the weekend calendar is not loaded');
    }
    if (!bits.length) return '';
    var tail = '';
    if (rep.holes && rep.nearestHoleFromEnd !== null){
      tail = ' The nearest one ends ' + rep.nearestHoleFromEnd + ' '
        + (rep.nearestHoleFromEnd === 1 ? 'bar' : 'bars') + ' before the last bar — '
        + hgGoldGapReach(rep.nearestHoleFromEnd) + '.';
    }
    return '<div class="note warn" style="margin:8px 0;padding:8px 10px;border:1px solid #F59E0B;border-radius:6px">'
      + '<b>TAPE NOT CONTINUOUS</b> — this feed returned ' + rep.bars + ' ' + tf + ' with '
      + esc(bits.join(', ')) + '.' + tail
      + ' Weekend closures are not counted here; these are gaps on top of them.'
      + ' ATR is the distance the stop is placed at, so it is the distance R is measured in.'
      + ' Nothing here is filled in or interpolated: inventing the missing bars would be a'
      + ' worse answer than naming them.</div>';
  }

  /* ONE CALL FOR THE DESKS. Every gold tab asks the same two questions of its
     tape, so it asks them once here and a third rule later lands in one place
     rather than in thirteen. */
  function hgGoldTapeNotes(rows, tfLabel, opts){
    return hgGoldTapeSanityNote(hgGoldTapeSanity(rows), tfLabel)
         + hgGoldTapeGapNote(hgGoldTapeGaps(rows, opts), tfLabel);
  }

  W.hgGoldTapeSpacing = hgGoldTapeSpacing;
  W.hgGoldTapeGaps = hgGoldTapeGaps;
  W.hgGoldTapeGapNote = hgGoldTapeGapNote;
  W.hgGoldTapeNotes = hgGoldTapeNotes;

  W.hgGoldTapeSanity = hgGoldTapeSanity;
  W.hgGoldTapeSanityNote = hgGoldTapeSanityNote;
})(typeof window !== 'undefined' ? window : this);
