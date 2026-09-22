/* HARDGATE — THE GOLD FAMILY SAYS WHEN ITS TAPE IS NOT CONTINUOUS.

   Pack 907 asked whether each bar is one a market could have produced. It
   says nothing about whether the bars are CONSECUTIVE, and a feed can return
   two hundred perfectly well-formed bars with a run of them missing out of
   the middle. Every indicator in this app walks the array by index, so a hole
   means EMA, ATR and RSI are computed across a discontinuity and "twenty bars
   ago" is not twenty bars ago.

   MEASURED, part one — what a hole does to the numbers. Delete a contiguous
   run from a 220-bar 15m tape and re-run the app's own atr/ema/rsi, 400
   seeded tapes per cell, median shift:

     hole ends ... before the last bar     ATR14      RSI14
       110 bars (12 missing)                0.002%     0.004%
        40 bars (12 missing)                0.230%     0.603%
        20 bars (12 missing)                1.066%     2.562%
        10 bars (12 missing)                2.601%     4.535%
         2 bars (12 missing)                4.934%     7.251%
         2 bars (48 missing)                7.821%    20.577%

   The damage is almost entirely a function of HOW RECENT the hole is, which
   is why the note reports the distance and not just a count. An old hole has
   rolled out of the averaging window. A recent one moves ATR by several per
   cent — and ATR is the distance the stop is placed at, so it is the distance
   R is measured in and position size is derived from.

   A first draft of this work assumed a mid-tape hole distorted ATR. The
   measurement said otherwise (0.002%), and the table replaced the assumption.

   MEASURED, part two — what the family did about it. Driving the whole GOLD
   nav group on a tape with a 12-bar hole: FIVE of the fifteen that can be
   driven rendered different numbers, and NOT ONE of the fifteen said a word.
   The only gap check anywhere in the tree was in gold-seven-step.js, on the
   1H series, at a three-day threshold — so a hole of two days or less passed
   silently everywhere, including there.

   THE WEEKEND IS NOT A HOLE. Gold shuts from Friday evening to Sunday
   evening. A rule that flagged every gap would fire every week and be ignored
   by the second one, so gaps are classified with the app's OWN hgInGoldWeekend
   — the same DST-aware definition the weekend-exposure panel uses. Verified
   silent on 28 realistic gold tapes (four timeframes x seven start weekdays),
   and 16 of 16 punched holes still caught.

   Run: node tests/test-gold-tape-gaps.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function load(files){
  const c = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, Date, Intl, RegExp };
  c.window = c; vm.createContext(c);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c, { filename: f });
  return c;
}
/* WITH the app's weekend calendar, and WITHOUT it — the second is a real
   deployment state (a desk whose indicators2.js failed to load), not a
   hypothetical. */
const C = load(['indicators.js', 'indicators2.js', 'gold-tape-sanity.js']);
const BARE = load(['gold-tape-sanity.js']);

const TFS = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
function goldTape(nBars, tfSec, startSec){
  /* A tape shaped like the real instrument: the Friday-to-Sunday closure is
     genuinely absent from it, exactly as a venue returns it. */
  const o = []; let t = startSec, p = 4000, s = 11, guard = 0;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  while (o.length < nBars && guard++ < nBars * 12){
    if (!C.hgInGoldWeekend(t)){
      p = p * (1 + (rnd() - 0.48) * 0.003);
      const r = p * 0.002 * (0.5 + rnd());
      o.push({ t, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
    }
    t += tfSec;
  }
  return o;
}
const punch = (rows, hole, fromEnd) => {
  const o = rows.map(r => ({ ...r }));
  o.splice(Math.max(1, o.length - fromEnd - hole), hole);
  return o;
};
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

console.log('== the rule is exported, and it reads the tape\'s own spacing ==');
{
  ok(typeof C.hgGoldTapeGaps === 'function' && typeof C.hgGoldTapeGapNote === 'function',
     'hgGoldTapeGaps and hgGoldTapeGapNote are on window');
  ok(typeof C.hgGoldTapeNotes === 'function',
     'and hgGoldTapeNotes composes both tape questions, so a desk asks once');

  for (const [tf, sec] of Object.entries(TFS)){
    const tape = goldTape(tf === '1d' ? 200 : 400, sec, Math.floor(Date.UTC(2026, 0, 5) / 1000));
    ok(C.hgGoldTapeSpacing(tape) === sec,
       `a ${tf} gold tape reports its spacing as ${sec}s, weekends and all`);
  }
  /* The regression this caught in itself: a strided sample smeared the
     weekend into the estimate and returned 144000 for a daily tape. The rule
     stayed silent, which LOOKED like a pass, while a hole then had to exceed
     two and a half days to register. */
  const daily = goldTape(200, 86400, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  ok(C.hgGoldTapeSpacing(daily) === 86400 && C.hgGoldTapeSpacing(daily) !== 144000,
     'and the daily tape is 86400, not the 144000 a weekend-smeared estimate gave');
  ok(Number.isNaN(C.hgGoldTapeSpacing([])) && Number.isNaN(C.hgGoldTapeSpacing(null)),
     'an unreadable tape returns NaN rather than a default interval — a wrong spacing does not announce itself');
  /* A tape LONG enough to walk but with no usable gap in it. The short-tape
     guard above never reaches the sampling code, so without this a default
     return value planted there would go unnoticed — a mutation run found
     exactly that hole in an earlier draft of this file. */
  const noGaps = [{ t: 5, o: 1, h: 1, l: 1, c: 1 }, { t: 5, o: 1, h: 1, l: 1, c: 1 },
                  { t: 5, o: 1, h: 1, l: 1, c: 1 }, { t: 4, o: 1, h: 1, l: 1, c: 1 }];
  ok(Number.isNaN(C.hgGoldTapeSpacing(noGaps)),
     'and so does a long tape whose timestamps never advance — the sampling path returns NaN too, not a plausible default');
  ok(C.hgGoldTapeGaps(noGaps).holes === 0 && C.hgGoldTapeGaps(noGaps).ok === true,
     'with no spacing there is no verdict on gaps either, rather than one invented from a default interval');

  /* THE SAMPLE MUST BE WIDE ENOUGH TO OUTVOTE A CLOSURE. A tape that ends
     just after the weekend has a three-day step among its most recent gaps;
     an estimate drawn from only the last few would take that step as the
     spacing and go blind to every hole smaller than it. */
  const hourly = goldTape(400, 3600, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  let endedOnClosure = 0;
  for (let cut = 40; cut < hourly.length; cut++){
    const recent = hourly.slice(0, cut);
    const lastGaps = [];
    for (let i = Math.max(1, recent.length - 3); i < recent.length; i++) lastGaps.push(recent[i].t - recent[i - 1].t);
    if (!lastGaps.some(g => g > 3600 * 1.5)) continue;   /* only the cuts that land just after a closure */
    endedOnClosure++;
    if (C.hgGoldTapeSpacing(recent) !== 3600){ endedOnClosure = -1; break; }
  }
  ok(endedOnClosure > 0,
     `${endedOnClosure} truncations end within three bars of a weekend closure, and every one still reports 3600s`);
}

console.log('\n== a real gold tape is SILENT: the weekend is not a hole ==');
{
  let fired = 0, checked = 0;
  for (const [tf, sec] of Object.entries(TFS)){
    for (let d = 0; d < 7; d++){
      const tape = goldTape(tf === '1d' ? 200 : 400, sec, Math.floor(Date.UTC(2026, 0, 5 + d) / 1000));
      const rep = C.hgGoldTapeGaps(tape);
      checked++;
      if (C.hgGoldTapeGapNote(rep, tf)) fired++;
    }
  }
  ok(checked === 28, `${checked} realistic gold tapes: four timeframes by seven start weekdays`);
  ok(fired === 0,
     `and NOT ONE of them fires the banner (${fired} false positives) — a weekly false alarm would be worse than no rule`);
  /* Proof the tapes really do contain closures, so the silence above is the
     rule classifying them and not the tapes being gap-free. */
  const wk = goldTape(400, 3600, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  let raw = 0;
  for (let i = 1; i < wk.length; i++) if (wk[i].t - wk[i - 1].t > 3600 * 1.5) raw++;
  ok(raw >= 3, `and those tapes really do gap — ${raw} raw discontinuities in one of them, every one a closure`);
}

console.log('\n== a real hole is caught, at every timeframe, down to one bar ==');
{
  let missed = 0, cases = 0;
  for (const [tf, sec] of Object.entries(TFS)){
    const tape = goldTape(tf === '1d' ? 200 : 400, sec, Math.floor(Date.UTC(2026, 0, 5) / 1000));
    for (const [hole, fromEnd] of [[1, 5], [3, 5], [12, 5], [12, 100]]){
      const rep = C.hgGoldTapeGaps(punch(tape, hole, fromEnd));
      cases++;
      if (rep.holes < 1 || rep.missingBars !== hole) missed++;
    }
  }
  ok(cases === 16 && missed === 0,
     `${cases} punched holes, ${missed} missed — and each reports exactly the number of bars removed`);

  const tape = goldTape(400, 3600, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  const near = C.hgGoldTapeGaps(punch(tape, 12, 5));
  const far  = C.hgGoldTapeGaps(punch(tape, 12, 100));
  ok(near.nearestHoleFromEnd === 4 && far.nearestHoleFromEnd === 99,
     'and the distance from the last bar is reported, because that is what decides whether it matters');
}

console.log('\n== a hole that swallows a weekend is its own size, not the wall clock ==');
{
  /* The bug this replaced: counting round(gap / spacing) called a 48-bar hole
     that happened to span a closure a 96-bar hole. True about wall-clock time,
     false about bars, and the number a reader would act on. */
  const tape = goldTape(400, 3600, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  let worst = null;
  for (let fromEnd = 2; fromEnd < 340; fromEnd += 7){
    const rep = C.hgGoldTapeGaps(punch(tape, 48, fromEnd));
    if (rep.holes !== 1 || rep.missingBars !== 48){ worst = { fromEnd, rep }; break; }
  }
  ok(!worst,
     'a 48-bar hole reports 48 missing bars at every position tested, including the ones that span a closure'
     + (worst ? ` — ${worst.fromEnd} from end gave ${worst.rep.missingBars}` : ''));

  /* And a gap the closure FULLY explains is not a hole at all, wherever it
     falls — which is the same rule doing both jobs rather than two. */
  const rep = C.hgGoldTapeGaps(tape);
  ok(rep.holes === 0 && rep.missingBars === 0,
     'while the closures themselves contribute nothing: one rule, no special case');
}

console.log('\n== without the weekend calendar it says so, rather than guessing ==');
{
  const tape = goldTape(400, 3600, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  const rep = BARE.hgGoldTapeGaps(tape);
  ok(typeof BARE.hgInGoldWeekend !== 'function', 'the bare context genuinely has no weekend calendar');
  ok(rep.holes === 0 && rep.unclassified >= 3,
     `the closures come back UNCLASSIFIED (${rep.unclassified}), not as holes — calling them holes would cry wolf every week`);
  ok(rep.ok === false, 'and the report is not ok, because "I could not tell" is not "nothing is wrong"');
  const note = strip(BARE.hgGoldTapeGapNote(rep, '1h'));
  ok(/could not be classified/.test(note) && /weekend calendar is not loaded/.test(note),
     'the note names the missing calendar as the reason, rather than reporting a fault it did not find');
  ok(!/\bhole\b/.test(note),
     'and does not call them holes');
  /* The other direction of the same mistake. */
  ok(rep.missingBars === 0, 'nor does it count missing bars it could not attribute');
}

console.log('\n== the note is about the stop, and it never fills anything in ==');
{
  const tape = goldTape(400, 900, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  const note = strip(C.hgGoldTapeGapNote(C.hgGoldTapeGaps(punch(tape, 12, 5)), '15m'));
  ok(/TAPE NOT CONTINUOUS/.test(note), 'it is titled for what it found');
  ok(/12 missing bars/.test(note), 'it says how many bars are gone');
  ok(/4 bars before the last bar/.test(note), 'and how close that is to the live end');
  ok(/ATR14 and RSI14 are computed over/.test(note) && /2\.6%/.test(note),
     'it quotes the measured distortion for that distance rather than a severity word');
  ok(/ATR is the distance the stop is placed at/.test(note),
     'and says why ATR is the one that matters — it is the distance R is measured in');
  ok(/Weekend closures are not counted here/.test(note),
     'it states that closures are excluded, so the number is not read as including them');
  ok(/Nothing here is filled in or interpolated/.test(note),
     'and promises no interpolation');
  for (const claim of ['filled', 'interpolated', 'reconstructed', 'estimated', 'repaired'])
    ok(!new RegExp('(?:were|was|have been|has been|are|is) ' + claim, 'i')
        .test(note.replace(/Nothing here is filled in or interpolated[\s\S]*$/i, ' ')),
       `and nowhere claims the missing bars were ${claim} — because they are not`);

  const far = strip(C.hgGoldTapeGapNote(C.hgGoldTapeGaps(punch(tape, 12, 200)), '15m'));
  ok(/older than the ATR14 and RSI14 windows/.test(far),
     'an OLD hole is reported as not moving those indicators, rather than dressed up as urgent');
  ok(/structure and level detection read the whole tape/.test(far),
     'while still noting what an old hole CAN reach — five tabs changed their numbers on exactly such a hole');
}

console.log('\n== it reports; it does not gate, and it does not touch the rows ==');
{
  const tape = goldTape(200, 3600, Math.floor(Date.UTC(2026, 0, 5) / 1000));
  const holed = punch(tape, 12, 5);
  const before = JSON.stringify(holed);
  C.hgGoldTapeGaps(holed);
  ok(JSON.stringify(holed) === before, 'the check does not mutate the tape it reads');
  ok(holed.length === 188, 'and returns no repaired copy either — the caller keeps exactly what the feed sent');

  const src = fs.readFileSync(path.join(ROOT, 'gold-tape-sanity.js'), 'utf8');
  const body = src.slice(src.indexOf('function hgGoldTapeGaps'), src.indexOf('function hgGoldTapeGapNote'));
  ok(!/\.splice\(|\.push\(\{|rows\[i\]\s*=/.test(body),
     'and the implementation neither inserts a bar nor rewrites one — there is nowhere for a silent fill to hide');
}

console.log('\n== degenerate input returns a verdict it can defend ==');
{
  for (const [label, input] of [['null', null], ['undefined', undefined], ['empty', []],
                                ['one bar', [{ t: 1, o: 1, h: 1, l: 1, c: 1 }]],
                                ['a string', 'xxxx'], ['a number', 7]]){
    const r = C.hgGoldTapeGaps(input);
    ok(r && r.holes === 0 && r.ok === true, `${label} reports no holes rather than a fabricated one`);
    ok(C.hgGoldTapeGapNote(r, '1h') === '', `and renders nothing for ${label}`);
  }
  const noTimes = Array.from({ length: 50 }, () => ({ o: 1, h: 2, l: 0.5, c: 1 }));
  ok(C.hgGoldTapeGaps(noTimes).holes === 0,
     'a tape with no timestamps at all reports no holes — it is a different complaint, and hgGoldTapeSanity makes it');

  let threw = 0;
  for (const bad of [[{ t: NaN }], [{ t: 1 }, null, { t: 3 }], [{ t: 1 }, { t: 1 }], [{ t: 5 }, { t: 1 }]]){
    try { C.hgGoldTapeGaps(bad); C.hgGoldTapeGapNote(C.hgGoldTapeGaps(bad), '1h'); } catch (e) { threw++; }
  }
  ok(threw === 0, 'and four malformed-timestamp tapes produce zero throws');
}

console.log('\n== the work is bounded ==');
{
  /* A feed that returns two bars a year apart must not walk a year of slots. */
  const huge = [{ t: 0, o: 1, h: 1, l: 1, c: 1 }, { t: 60, o: 1, h: 1, l: 1, c: 1 },
                { t: 120, o: 1, h: 1, l: 1, c: 1 }, { t: 400000000, o: 1, h: 1, l: 1, c: 1 }];
  const t0 = Date.now();
  const rep = C.hgGoldTapeGaps(huge);
  const ms = Date.now() - t0;
  ok(ms < 2000, `a gap of 400 million seconds is judged in ${ms}ms rather than walked to the end`);
  ok(rep.holes === 1 && rep.missingBars >= 1,
     'and it is still reported as a hole, at or above the cap rather than not at all');
}

console.log(`\n${passed} passed, 0 failed`);
