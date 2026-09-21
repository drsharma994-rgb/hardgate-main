/* HARDGATE — GOLD SCALP says when its tape is not made of possible candles.

   goldScalpSetups checks that it has at least 30 bars, that ATR came out
   positive and that the entry is a positive number. It never checked that the
   BARS were well formed, and a feed can deliver ones that are not: a high
   below its own low, a range that does not contain the body, a price that is
   not a number, a timestamp that repeats or goes backwards.

   Those are not edge cases in the maths. They are impossible candles, and
   every level drawn from them is drawn from something that never happened.

   MEASURED. Feed a tape where one bar in twenty arrives with its high and low
   swapped — a proxy glitch or a bad merge — and over 300 scans the STOP moved
   on 36.7% of them while the ENTRY moved on only 4.7%. That is the worse half
   to lose: the stop is the risk distance every size, every R and every target
   on the ladder is measured against, and a tape it was drawn from contains
   bars that never happened. It also minted MORE setups, 350 against 340, and
   said nothing either way.

   (Both figures are real and they measure different things. An earlier draft
   of this file compared entry alone, got 3%, and would have understated the
   fault; the pack note originally said "a different set of setups", which is
   true of the entry+stop signature but reads as if the whole board moved.)

   Wholly malformed input was already handled — all-NaN, all-zero, negative,
   flat and huge-price tapes each minted nothing — so it is the partial glitch
   that gets through.

   IT REPORTS; IT DOES NOT GATE. A malformed bar is disclosed, not dropped:
   which bars to discard is a data-repair policy, and inventing one here would
   be the silent correction this desk exists to avoid.

   Run: node tests/test-goldscalp-tape-sanity.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
const GS = fs.readFileSync(root + 'goldscalp.js', 'utf8');
function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}'){ d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const F = new Function('esc', 'isFinite', 'Math', 'Array',
  grab(GS, 'gsTapeSanity') + grab(GS, 'gsTapeSanityNote')
  + 'return { gsTapeSanity, gsTapeSanityNote };')(esc, isFinite, Math, Array);
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const clean = n => Array.from({ length: n }, (_, i) =>
  ({ t: 1000 + i * 900, o: 100, h: 101, l: 99, c: 100.5, v: 1 }));

/* the real engine, for the measurement this pack rests on */
function loadGoldind(){
  const ctx = { window: {}, console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
                Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
                parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map, Error,
                setTimeout: () => 0, clearTimeout: () => {} };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'structure-levels.js',
                   'gold-session.js', 'goldind.js']){
    try { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); } catch (e) {}
  }
  return ctx.window;
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. a well-formed tape is silent');
{
  const rep = F.gsTapeSanity(clean(100));
  ok(rep.bars === 100 && rep.bad === 0 && rep.ok === true, '100 honest candles: nothing wrong');
  ok(F.gsTapeSanityNote(rep) === '', 'and no banner — a clean tape needs no caveat');
  ok(F.gsTapeSanity([]).ok === true && F.gsTapeSanityNote(F.gsTapeSanity([])) === '',
     'an empty tape is not malformed, it is empty — a different failure, reported elsewhere');
  ok(F.gsTapeSanity(null).bars === 0, 'and no tape at all does not throw');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. each kind of impossible candle is named separately');
{
  const inv = clean(100); inv[7] = { ...inv[7], h: 99, l: 101 };
  const r1 = F.gsTapeSanity(inv);
  ok(r1.inverted === 1 && r1.bad === 1, 'a high below its own low is counted as inverted');

  const body = clean(50); body[3] = { t: body[3].t, o: 100, h: 100.2, l: 99.8, c: 105 };
  const r2 = F.gsTapeSanity(body);
  ok(r2.bodyOutside === 1 && r2.inverted === 0,
     'a range that does not contain the close is its own fault, not an inversion');

  const nan = clean(50); nan[9] = { ...nan[9], c: NaN };
  ok(F.gsTapeSanity(nan).nonFinite === 1, 'a price that is not a number is counted');

  const dup = clean(50).map(b => ({ ...b, t: 1000 }));
  ok(F.gsTapeSanity(dup).timeOrder === 49, 'a timestamp that repeats is counted on every repeat');
  const back = clean(50); back[10] = { ...back[10], t: 0 };
  ok(F.gsTapeSanity(back).timeOrder >= 1, 'and so is one that goes backwards');

  /* the counts are separate so the banner can say WHICH fault it found */
  const t1 = text(F.gsTapeSanityNote(r1));
  ok(/with the high below the low/.test(t1), 'the banner names an inversion');
  ok(!/range does not contain/.test(t1), 'and does not claim faults it did not find');
  ok(/1 of 100 15m bars \(1%\)/.test(t1), 'quoting the count and the share');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the measurement this rests on: a partial glitch changes the board');
{
  const W = loadGoldind();
  ok(typeof W.goldScalpSetups === 'function', 'the real engine is reachable');
  const NOW = Date.now();
  function tape(seed, n, sec, d){
    let x = seed;
    const r = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
    const o = []; let c = 2400;
    const t0 = Math.floor((NOW / 1000 - n * sec) / sec) * sec;
    for (let i = 0; i < n; i++){
      const op = c; c = op + (r() - 0.5) * 4 + (d || 0);
      o.push({ t: t0 + i * sec, o: op, h: Math.max(op, c) + r() * 1.8, l: Math.min(op, c) - r() * 1.8, c, v: 900 });
    }
    return o;
  }
  /* entry AND stop: the stop is what the malformed bars actually move, and a
     signature without it measures the wrong half (4.7% instead of 36.7%). */
  const sig = g => (Array.isArray(g) ? g : []).filter(c => c && !c.dropped)
    .map(c => c.stratKey + '|' + c.dir + '|' + (+c.entry).toFixed(3) + '|' + (+c.stop).toFixed(3))
    .sort().join(',');
  const sigEntryOnly = g => (Array.isArray(g) ? g : []).filter(c => c && !c.dropped)
    .map(c => c.stratKey + '|' + c.dir + '|' + (+c.entry).toFixed(3)).sort().join(',');

  let n = 0, changed = 0, entryChanged = 0;
  for (let s = 1; s <= 120; s++){
    const d = [0, 0.35, -0.35][s % 3];
    const good = tape(s, 400, 900, d);
    const dirty = good.map((b, i) => (i % 20 === 7) ? { ...b, h: b.l, l: b.h } : b);
    const inp = r => ({ rows15m: r, rows1h: tape(s + 5, 400, 3600, d * 4),
                        rows4h: tape(s + 9, 400, 14400, d * 16), now: NOW, news: null });
    let A, B;
    try { A = W.goldScalpSetups(inp(good)); B = W.goldScalpSetups(inp(dirty)); } catch (e) { continue; }
    n++;
    if (sig(A) !== sig(B)) changed++;
    if (sigEntryOnly(A) !== sigEntryOnly(B)) entryChanged++;
    /* and the check would have caught it */
    if (s === 1) ok(F.gsTapeSanity(dirty).inverted === 20,
      'the check finds all 20 inverted bars in a 400-bar tape');
  }
  ok(n > 100, 'ran ' + n + ' clean-vs-dirty pairs');
  ok(changed > n * 0.15,
     'the STOP moved on ' + changed + ' of ' + n + ' (' + Math.round(100 * changed / n)
     + '%) from a tape one bar in twenty malformed');
  ok(entryChanged < changed,
     'while the ENTRY moved on only ' + entryChanged
     + ' — which is why a signature without the stop measures the wrong half');

  /* wholly broken tapes were already safe — it is the partial glitch that gets in */
  const allBad = tape(1, 400, 900, 0).map(b => ({ ...b, o: 0, h: 0, l: 0, c: 0 }));
  const none = W.goldScalpSetups({ rows15m: allBad, now: NOW, news: null });
  ok((Array.isArray(none) ? none : []).filter(c => c && !c.dropped).length === 0,
     'an all-zero tape still mints nothing, as it always did');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. it reports; it does not gate, and it repairs nothing');
{
  const inv = clean(100); inv[7] = { ...inv[7], h: 99, l: 101 };
  const before = JSON.stringify(inv);
  F.gsTapeSanity(inv);
  ok(JSON.stringify(inv) === before, 'the check does not touch a single bar it read');

  const body = grab(GS, 'gsTapeSanity') + grab(GS, 'gsTapeSanityNote');
  ok(!/\.dropped\s*=/.test(body) && !/\.demoted\s*=/.test(body) && !/\.vetoed\s*=/.test(body),
     'neither helper writes dropped, demoted or vetoed');
  ok(!/rows\.splice|rows\[\w+\]\s*=/.test(body), 'and neither rewrites the tape');
  const note = text(F.gsTapeSanityNote(F.gsTapeSanity(inv)));
  ok(/which bars to discard is a data-repair/.test(note),
     'the banner says outright that nothing was dropped, and why');
  /* AND IT MUST NEVER CLAIM A REPAIR IT DID NOT PERFORM. A note that said the
     bad bars "were removed" would be worse than no note: the reader would
     trust levels drawn from a tape nobody cleaned. */
  ok(!/were removed|have been removed|discarded them|excluded them|cleaned|corrected|repaired/i.test(note),
     'and never claims the malformed bars were removed, excluded or fixed');
  ok(/Nothing here is dropped/.test(note), 'it states the opposite, in as many words');

  /* a wholly broken feed cannot cost the scan its time */
  ok(/BAD_CAP/.test(GS), 'the walk is bounded');
  const huge = Array.from({ length: 20000 }, () => ({ t: 1, o: 1, h: 0, l: 2, c: 1 }));
  const t0 = Date.now();
  const rep = F.gsTapeSanity(huge);
  ok(Date.now() - t0 < 500, 'twenty thousand broken bars still return promptly');
  /* the cap bounds the WORK; one bar can carry two faults (impossible range
     AND a bad timestamp), so the count can pass it by one and no more */
  ok(rep.bad >= 5000 && rep.bad <= 5001,
     'with the walk stopped at the cap rather than run to the end (' + rep.bad + ' of 20000 bars)');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. wired with the other feed caveats');
{
  ok(/gsTapeSanityNote\(gsTapeSanity\(gold && gold\.rows15m\)\)/.test(GS),
     'the banner is built from the desk\'s own 15m tape');
  ok(/gsTapeSanityNote\(gsTapeSanity\(gold && gold\.rows15m\)\)\s*\n\s*\+ gsFeedLegNote\(gold\)/.test(GS),
     'and rides with the unread-leg and mixed-feed banners, so it reaches every path they do');
  ok(/W\.gsTapeSanity = gsTapeSanity;/.test(GS), 'the report is exported so the split is checkable');
  ok(!/W\.gsTapeSanityNote\s*=/.test(GS),
     'while the HTML helper stays internal — everything on window is fuzzed as a renderer');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
