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

  W.hgGoldTapeSanity = hgGoldTapeSanity;
  W.hgGoldTapeSanityNote = hgGoldTapeSanityNote;
})(typeof window !== 'undefined' ? window : this);
