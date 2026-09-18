/* HARDGATE — a replayed detector sees the bars, and nothing else.

   The OMNIGOLD replay hands each mechanic a TRUNCATED slice of history and
   asks what it sees at the end of it. Whatever a detector reads other than
   those bars is not a property of the setup — it is a property of the moment
   the bake ran, and it makes the measured record unreproducible.

   The map carried this comment about itself:

     "Each is the same pure function the live pass calls, so the in-sample
      record and the live firing cannot diverge."

   It was not true. hgOgVpPlaybook was called with NO OPTIONS, so its `now`
   fell through to Date.now() and the gold VP playbook judged every historical
   bar against the wall clock. Session is one of the twelve gates it scores,
   so on the SAME 400 bars:

     03:00 UTC  ->  "NO ENTRY · 3/12 · fail G2,3,4,5,6,7,8,9,10"   sessionOk false
     15:00 UTC  ->  "NO ENTRY · 4/12 · fail G2,3,4,5,6,8,9,10"     sessionOk true

   Bake at 03:00 and VP-PLAYBOOK fails its session gate everywhere in
   history; bake at 15:00 and it passes everywhere. The record was a property
   of the clock.

   This file holds the WHOLE map to the invariant rather than the one entry
   that broke it, so the next clock-reading detector cannot land quietly.

   Run: node tests/test-omnigold-replay-clock.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const FILES = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
               'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
               'hg-plan.js', 'omniroute.js', 'omnigold.js'];

/* A context whose wall clock is frozen at a chosen instant. Date.now(), `new
   Date()` and everything built on them read that instant and no other. */
function bootAt(nowMs){
  const doc = { getElementById: () => null,
                createElement: () => ({ style: {}, classList: { add(){}, remove(){} },
                                        appendChild(){}, setAttribute(){} }),
                querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  class FrozenDate extends Date {
    constructor(...a){ if (a.length === 0) super(nowMs); else super(...a); }
    static now(){ return nowMs; }
  }
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date: FrozenDate, RegExp,
                document: doc, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')),
                localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of FILES){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade, as in the app */ }
  }
  return ctx;
}

const T0 = 1700000000 - (1700000000 % 86400);
const mk = (n, seed) => {
  let p = 4000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    out.push({ t: T0 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 + rnd() * 800 });
  }
  return out;
};

/* two clocks twelve hours apart: a different trading session, a different
   killzone, a different day-of-week bucket for anything that reads one */
const ASIA = Date.UTC(2026, 2, 10, 3, 0, 0);
const NY   = Date.UTC(2026, 2, 10, 15, 0, 0);

console.log('== the clock really is frozen, or this file proves nothing ==');
{
  const A = bootAt(ASIA), B = bootAt(NY);
  ok(A.Date.now() === ASIA && B.Date.now() === NY, 'each context reads its own instant from Date.now()');
  ok(new A.Date().getUTCHours() === 3 && new B.Date().getUTCHours() === 15,
     'and from `new Date()` — 03:00 UTC against 15:00 UTC');
  ok(typeof A.hgOgBtDetectors === 'function', 'the replay detector map is exported');
  ok(typeof A.hgOgBtLastSec === 'function', 'and the bar clock it reads');

  /* THE ENGINE THE DEFECT LIVED IN. If this is not clock-sensitive the whole
     test is vacuous, so it is asserted rather than assumed. */
  ok(typeof A.hgGoldVpPlaybook === 'function', 'the gold VP playbook engine is loaded');
  const rows = mk(400, 17);
  const pbA = A.hgGoldVpPlaybook(rows, { scalp: false, news: null });
  const pbB = B.hgGoldVpPlaybook(rows, { scalp: false, news: null });
  ok(pbA && pbB, 'and answers on this tape at both clocks');
  ok(JSON.stringify(pbA) !== JSON.stringify(pbB),
     'it IS clock-sensitive: the same 400 bars read differently at 03:00 and at 15:00');
  ok(pbA.sessionOk !== pbB.sessionOk,
     `specifically its session gate — sessionOk ${pbA.sessionOk} against ${pbB.sessionOk}`);
  ok(pbA.gatesPass !== pbB.gatesPass,
     `which moves its score: ${pbA.gatesPass}/12 against ${pbB.gatesPass}/12`);
}

console.log('\n== the bar clock, stated directly ==');
{
  const A = bootAt(ASIA);
  const f = A.hgOgBtLastSec;
  ok(!isFinite(f(null)) && !isFinite(f([])), 'no bars, no clock — NaN rather than a guess');
  ok(f([{ t: 100 }, { t: 200 }, { t: 300 }]) === 300, 'otherwise the LAST bar, which is what "now" means in a replay');
  ok(f([{ t: 100 }, { t: 200 }, { t: null }]) === 200,
     'a hole at the end falls back to the newest bar that has a time');
  ok(!isFinite(f([{ t: null }, { t: '' }])), 'and a slice with no usable time at all answers NaN');
  for (const bad of [undefined, '', NaN, 'x', {}]){
    ok(!isFinite(f([{ t: bad }])), `a ${JSON.stringify(bad)} timestamp is not a clock`);
  }
}

console.log('\n== every entry in the replay map answers the same at both clocks ==');
{
  const A = bootAt(ASIA), B = bootAt(NY);
  const mapA = A.hgOgBtDetectors(), mapB = B.hgOgBtDetectors();
  const keys = Object.keys(mapA);
  ok(keys.length > 60, `the map carries ${keys.length} detectors`);
  ok(keys.join() === Object.keys(mapB).join(), 'and the same set in both contexts');
  ok(keys.indexOf('VP-PLAYBOOK') >= 0, 'including VP-PLAYBOOK, the one that broke this');

  /* Several tapes, and several truncations of each, because a detector that
     reads the clock may only diverge where its session boundary falls. */
  const drift = [];
  let calls = 0, answered = 0;
  for (const seed of [17, 23, 41, 59]){
    const full = mk(400, seed);
    for (const cut of [400, 360, 300, 220, 150]){
      const r = full.slice(0, cut);
      for (const k of keys){
        let a, b;
        try { a = mapA[k](r); } catch (e) { a = 'THREW:' + e.message; }
        try { b = mapB[k](r); } catch (e) { b = 'THREW:' + e.message; }
        calls++;
        if (a && typeof a === 'object') answered++;
        const sa = JSON.stringify(a), sb = JSON.stringify(b);
        if (sa !== sb && drift.indexOf(k) < 0) drift.push(k);
      }
    }
  }
  ok(drift.length === 0,
     `${calls} replayed readings across ${keys.length} detectors, 4 tapes and 5 truncations — `
     + 'not one answer depends on the wall clock'
     + (drift.length ? (' — DRIFTED: ' + drift.join(', ')) : ''));
  ok(answered > 50,
     `and ${answered} of those readings produced an actual setup, so the map is answering, `
     + 'not failing shut in both contexts alike');
}

console.log('\n== VP-PLAYBOOK is handed the bar clock, pinned directly ==');
{
  /* THE SWEEP ABOVE IS A NET, NOT A PROOF FOR THIS ENTRY. The wrapper only
     returns a hit when the playbook decides ENTER; on any tape where it says
     NO ENTRY at both clocks it answers null both times and the comparison
     passes whatever clock it read. Reverting the fix does not fail that
     sweep, which I checked rather than assumed.

     So the contract is pinned where it lives: the map must hand the engine
     the last bar's time. gfn() resolves the engine by name at CALL time, so
     a spy in its place records exactly what the replay passes. */
  const A = bootAt(ASIA);
  const rows = mk(400, 17);
  const realEngine = A.hgGoldVpPlaybook;
  const seen = [];
  A.hgGoldVpPlaybook = function(r, o){ seen.push(o && o.now); return realEngine(r, o); };

  const map = A.hgOgBtDetectors();
  for (const cut of [400, 300, 200]) map['VP-PLAYBOOK'](rows.slice(0, cut));
  A.hgGoldVpPlaybook = realEngine;

  ok(seen.length === 3, 'the spy saw all three replayed calls');
  ok(seen.every(v => isFinite(v)), `each carried a finite clock (${seen.join(', ')})`);
  ok(seen.every(v => v !== ASIA),
     'and none of them was the wall clock — which is the defect, stated as an assertion');
  for (let i = 0; i < 3; i++){
    const cut = [400, 300, 200][i];
    ok(seen[i] === rows[cut - 1].t * 1000,
     `the ${cut}-bar slice was replayed as of its own last bar, ${rows[cut - 1].t}`);
  }
  ok(seen[0] > seen[1] && seen[1] > seen[2],
     'so the replay clock walks back with the history, instead of standing still at the bake');
}

console.log('\n== and the fix is the bar clock, not a suppression ==');
{
  /* Passing nowSec: NaN would also make the two contexts agree — by making
     VP-PLAYBOOK return nothing everywhere. Prove it still reads the tape. */
  const A = bootAt(ASIA);
  const rows = mk(400, 17);
  ok(isFinite(A.hgOgBtLastSec(rows)) && A.hgOgBtLastSec(rows) === rows[rows.length - 1].t,
     'the map hands VP-PLAYBOOK the last bar of the slice it was given');

  /* the clock it now receives moves with the slice, which is the whole point:
     truncate the tape and the replay's "now" moves back with it */
  const clocks = [400, 300, 200].map(n => A.hgOgBtLastSec(rows.slice(0, n)));
  ok(clocks[0] > clocks[1] && clocks[1] > clocks[2],
     `and that clock walks back with the truncation (${clocks.join(' > ')}), `
     + 'rather than standing still at the moment of the bake');

  /* the engine, driven at the two bar clocks a replay would actually hand it,
     answers as the playbook does for those sessions */
  const early = A.hgGoldVpPlaybook(rows, { now: clocks[2] * 1000, scalp: false, news: null });
  const late = A.hgGoldVpPlaybook(rows, { now: clocks[0] * 1000, scalp: false, news: null });
  ok(early && late, 'the playbook answers at both bar clocks');
  ok(String(early.block || '').indexOf('UTC') > 0,
     'and stamps the bar time it was told, not the machine time');

  /* WHY ONLY THIS ENGINE BROKE. Its siblings default to the bar clock when
     given no `now`; this one defaults to the machine clock. The replay's map
     gave none of them a clock, so six were right by accident and one was
     wrong by accident. Read off the source rather than asserted. */
  const GI = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  const barDefault = (GI.match(/var nowMs = opts\.now \|\| \(isFinite\(rows\[rows\.length ?- ?1\]\.t\)/g) || []).length;
  const clockDefault = (GI.match(/var nowMs = opts\.now \|\| Date\.now\(\);/g) || []).length;
  ok(barDefault >= 3 && clockDefault >= 1,
     `${barDefault} gold engines fall back to the LAST BAR's time and ${clockDefault} to Date.now() — `
     + 'the replay handed none of them a clock, so the difference decided which one broke');

  /* AND A CORRECTION TO THE OBVIOUS GUESS. The old guard turned a null nowSec
     into `null * 1000` = 0, which looks like midnight 1970 — but the engine
     reads `opts.now || Date.now()`, so a zero falls back to the wall clock
     just as a missing value does. The fin() guard in omnigold is therefore
     intent made explicit, not a behaviour change; it is asserted as such and
     not dressed up as a second bug. */
  const zero = A.hgGoldVpPlaybook(rows, { now: 0, scalp: false, news: null });
  const none = A.hgGoldVpPlaybook(rows, { scalp: false, news: null });
  ok(zero && none && String(zero.block) === String(none.block),
     'a zero clock and an absent clock are the same thing to this engine — `opts.now || Date.now()` '
     + 'absorbs the zero, so the old guard produced no 1970 and no second defect');
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/now: isFinite\(fin\(opts\.nowSec\)\)/.test(SRC),
     'the guard still reads the clock through fin(), so the intent is on the page and a future '
     + 'engine without that `||` cannot inherit the trap');
}

console.log('\n' + passed + ' passed, 0 failed');
