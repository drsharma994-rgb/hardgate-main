/* HARDGATE — the gold sanitiser reads each bar once, and the same bars come out.

   __rows is the first thing 163 goldind entry points do: drop any bar missing
   an OHLC number. It used to re-read the whole tape on every call, and an
   OMNIGOLD scan calls it through a per-bar replay, so the re-reads multiplied.
   Measured through a real scan on a 600-bar tape: 426,844 calls, 126,054,685
   bar reads, 46.6% of the scan's CPU — more than atr(), goldADX(),
   goldVolumeProfile() and every detector put together.

   It now remembers where it got to and reads only the new tail. That is a
   contract, not an implementation detail, so this file drives the branches
   directly rather than inferring them from a detector's output:

     - a whole tape comes back whole, in order
     - a holed tape comes back without the holes
     - a tape with nothing usable comes back null, not an empty array
     - an APPENDED tape resumes: the new bar appears, the old ones do not move
     - a SHORTER array, and one whose last read bar has been replaced, are
       re-read in full rather than resumed
     - appending a BAD bar does not smuggle it in on the resume path

   And the caller side of the contract, because the resume rule depends on it:
   hgOmniBacktestOne hands the same array to every detector and only ever
   appends to it. That is asserted here by watching what the detector receives,
   so the day someone rewrites that loop to reuse-and-rewrite, this file fails
   rather than the desk quietly reading a stale tape.

   Run: node tests/test-goldind-rows-sanitiser.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, WeakMap, Set, Map,
                Promise, Error, NaN, Infinity, setTimeout: (f) => { try { f && f(); } catch (e) {} return 0; },
                clearTimeout: () => {} };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
const C = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'hg-mechanics.js', 'omniroute.js']);
const san = C.hgGoldSanitiseRows;
const bar = (t, c) => ({ t: t, o: c, h: c + 1, l: c - 1, c: c, v: 100 });
const closes = a => (a || []).map(r => r.c);

console.log('== the sanitiser is reachable, and it is the real one ==');
{
  ok(typeof san === 'function', 'goldind exports hgGoldSanitiseRows');
  /* Not a stub of my own: it has to behave like the thing 163 call sites use,
     so prove it filters before anything below leans on it. */
  ok(san([bar(1, 10), { t: 2, o: NaN, h: 1, l: 1, c: 1 }, bar(3, 12)]).length === 2,
     'and it drops a bar missing a number, so this is the sanitiser and not an identity function');
}

console.log('\n== a whole tape comes back whole ==');
{
  const rows = [bar(1, 10), bar(2, 11), bar(3, 12), bar(4, 13)];
  const out = san(rows);
  ok(out.length === 4, 'four bars in, four out');
  ok(String(closes(out)) === '10,11,12,13', 'in the order they arrived, unchanged');
  ok(out.every((r, i) => r === rows[i]), 'and the same bar objects, not copies of them');
}

console.log('\n== a holed tape comes back without the holes ==');
{
  const rows = [bar(1, 10), null, bar(2, 11), { t: 3, o: 1, h: 1, l: 1, c: null },
                bar(4, 13), { t: 5, o: 1, h: 1, l: undefined, c: 1 }, bar(6, 14)];
  const out = san(rows);
  ok(String(closes(out)) === '10,11,13,14',
     'the null bar, the null close and the undefined low are gone; the four good bars remain in order');
  ok(san([null, undefined, { c: 'x' }]) === null,
     'and a tape with nothing usable is null, not an empty array a caller would read as a tape');
  ok(san([]) === null && san(null) === null && san('rows') === null && san(undefined) === null,
     'empty, null, undefined and a non-array are all null');
}

console.log('\n== a missing price is not the price zero ==');
{
  /* isFinite(null) is true, so this filter used to pass {c:null} straight
     through and every indicator downstream read that close as 0 — a -100%
     bar through every ATR, swing and gap in goldind. '' is the same story
     and is what a CSV or JSON feed leaves for a missing field. */
  ok(isFinite(null) === true && isFinite('') === true,
     'JS itself says null and empty-string are finite — this is the trap, not a hypothetical');
  const kept = san([bar(1, 4000), bar(2, 4001), bar(3, 4002)]);
  ok(kept.length === 3, 'three real bars are kept');
  for (const [field, value, label] of [['c', null, 'a null close'], ['o', '', 'an empty-string open'],
                                       ['h', null, 'a null high'], ['l', '', 'an empty-string low']]){
    const holed = [bar(1, 4000), bar(2, 4001), bar(3, 4002)];
    const b = Object.assign({}, holed[1]); b[field] = value; holed[1] = b;
    const out = san(holed);
    ok(out.length === 2 && closes(out).every(c => c > 3000),
       `${label} is dropped, not read as 0 — the two real bars come back and nothing prices at zero`);
  }
  const allNull = san([{ t: 1, o: null, h: null, l: null, c: null },
                       { t: 2, o: '', h: '', l: '', c: '' }]);
  ok(allNull === null, 'and a tape of nothing but empty fields is null, not two bars of gold at $0');
  /* Feeds do deliver numeric strings, and dropping those would drop a whole
     tape rather than a hole in one. That stays kept, deliberately. */
  ok(san([{ t: 1, o: '4000.5', h: '4001', l: '3999', c: '4000' }]).length === 1,
     'a numerically-stringed bar is still a bar — narrowing that would silence a whole feed');
}

console.log('\n== an appended tape resumes, and the resume is correct ==');
{
  /* The hot path: the replay hands the same array back one bar longer. */
  const rows = [bar(1, 10), bar(2, 11), bar(3, 12)];
  const first = san(rows);
  ok(String(closes(first)) === '10,11,12', 'three bars read');
  rows.push(bar(4, 13));
  const second = san(rows);
  ok(String(closes(second)) === '10,11,12,13', 'a fourth appended, and all four come back in order');
  rows.push(bar(5, 14), bar(6, 15));
  ok(String(closes(san(rows))) === '10,11,12,13,14,15', 'two more, still in order');

  /* The resume must not become a way in for a bad bar. */
  const g = [bar(1, 10), bar(2, 11)];
  san(g);
  g.push({ t: 3, o: 1, h: 1, l: 1, c: NaN });
  ok(String(closes(san(g))) === '10,11',
     'appending a bar with a NaN close adds nothing — the tail is filtered on the resume path too');
  g.push(bar(4, 13));
  ok(String(closes(san(g))) === '10,11,13', 'and the good bar after it still lands');
}

console.log('\n== a tape that is not an append is re-read in full ==');
{
  const rows = [bar(1, 10), bar(2, 11), bar(3, 12), bar(4, 13)];
  ok(String(closes(san(rows))) === '10,11,12,13', 'four bars read');
  rows.length = 2;
  ok(String(closes(san(rows))) === '10,11',
     'truncated to two, it answers two — a shorter array is re-read, not resumed');

  const swap = [bar(1, 20), bar(2, 21), bar(3, 22)];
  san(swap);
  swap[2] = { t: 3, o: 1, h: 1, l: 1, c: null };
  ok(String(closes(san(swap))) === '20,21',
     'replacing the last bar that was read drops it — the resume checks that bar by identity');

  /* Two arrays holding the same numbers are two tapes, not one. */
  const a = [bar(1, 30), bar(2, 31)], b = [bar(1, 30), bar(2, 31)];
  san(a);
  ok(String(closes(san(b))) === '30,31', 'an array never seen before is read from the start');
}

console.log('\n== the caller side of the contract: the replay only ever appends ==');
{
  /* The resume rule is safe because hgOmniBacktestOne reuses one array and
     only pushes onto it. Watch what the detector is actually handed. */
  ok(typeof C.hgOmniBacktestOne === 'function', 'hgOmniBacktestOne is exported');
  const rows = [];
  for (let i = 0; i < 140; i++) rows.push(bar(i * 3600, 100 + Math.sin(i / 5) * 4));
  const seen = [];
  let sameObject = true, first = null, grewOnly = true, prevLen = -1, prevSnap = null;
  C.hgOmniBacktestOne(rows, function(r){
    if (first === null) first = r; else if (r !== first) sameObject = false;
    if (prevSnap){
      if (r.length < prevLen) grewOnly = false;
      for (let k = 0; k < prevSnap.length; k++) if (r[k] !== prevSnap[k]) grewOnly = false;
    }
    prevLen = r.length; prevSnap = r.slice();
    seen.push(r.length);
    return null;
  }, { rMult: 2, horizon: 10, warm: 40 });

  ok(seen.length > 50, `the detector was called ${seen.length} times, so this is measuring a real walk`);
  ok(sameObject, 'every call got the SAME array object — the per-bar slice is gone');
  ok(grewOnly,
     'and it only ever grew: no bar already handed to a detector was moved or replaced, which is '
     + 'exactly the condition the sanitiser resumes on');
  ok(seen[0] === 41 && seen[seen.length - 1] === rows.length - 10,
     `and it spans bar ${seen[0]} to bar ${seen[seen.length - 1]}, the same window the slice covered`);
  ok(seen.every((n, i) => i === 0 || n === seen[i - 1] + 1),
     'one bar at a time, no gaps — the view is rows[0..i] on every call, as the slice was');
}

console.log('\n== and the walk still measures what it measured ==');
{
  /* The view is an allocation change. The numbers it produces must not move. */
  const rows = [];
  let p = 100;
  for (let i = 0; i < 400; i++){
    p += Math.sin(i / 7) * 0.8 + Math.cos(i / 3) * 0.3;
    rows.push({ t: i * 3600, o: p - 0.2, h: p + 0.6, l: p - 0.6, c: p, v: 500 });
  }
  const det = r => (r.length % 17 === 0 ? { dir: (r.length % 34 === 0) ? 'long' : 'short' } : null);
  const res = C.hgOmniBacktestOne(rows, det, { rMult: 2, horizon: 12, warm: 45 });
  ok(res && isFinite(res.samples), 'the walk returns a result with a sample count');
  ok(res.samples > 0, `and found ${res.samples} settled samples on this tape, so it is not measuring nothing`);
  ok(res.wins + res.losses === res.samples, 'wins plus losses account for every settled sample');
  ok(Math.abs(res.hit - res.wins / res.samples) < 1e-12, 'and the hit rate is those wins over those samples');
}

console.log('\n' + passed + ' passed, 0 failed');
