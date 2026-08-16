/* HARDGATE — a displayed R:R must be the ratio between the displayed levels.

   hgApplyGoldBestLevels replaces entry/stop/targets in place and then
   recomputed R:R only when every guard happened to hold:

       var rsk = Math.abs(gc.entry - gc.stop);
       if (rsk > 0){
         if (fin(gc.t1)) gc.rr  = ...
         if (fin(gc.t2)) gc.rr2 = ...
         if (fin(gc.t3)) gc.rr3 = ...
       }

   Where a guard failed — risk of zero, a non-finite level, a target the new
   plan did not supply — the OLD ratio stayed attached to the NEW levels. The
   card then showed an entry, a stop, a target and an R:R that were not
   related to each other. That is the same defect as the 5–7x overstated R:R
   fixed earlier from a different direction, so the invariant is now pinned:

     for every candidate, either  rr === |t1 - entry| / |entry - stop|
     or rr is null. Never a leftover number.

   Run: node tests/test-rr-consistency.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'best-levels.js', 'structure-levels.js', 'gold-best-levels.js']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const W = ctx;

console.log('== hgSyncPlanRr is exported ==');
ok(typeof W.hgSyncPlanRr === 'function', 'hgSyncPlanRr exported');

console.log('\n== the invariant holds on a normal plan ==');
{
  const c = { entry: 100, stop: 98, t1: 104, t2: 108, t3: 112, rr: 999, rr2: 999, rr3: 999 };
  W.hgSyncPlanRr(c);
  ok(near(c.rr, 2), 'rr recomputed from the levels on the candidate (4/2)');
  ok(near(c.rr2, 4), 'rr2 recomputed (8/2)');
  ok(near(c.rr3, 6), 'rr3 recomputed (12/2)');
  ok(c.rrNote === null, 'no note when every leg computed cleanly');
}

console.log('\n== THE BUG: a target the new plan did not supply must not keep the old ratio ==');
{
  /* Levels were replaced by a plan with no T3. Previously rr3 survived from
     the plan these levels replaced. */
  const c = { entry: 3300, stop: 3280, t1: 3340, t2: 3380, t3: null, rr: 7.4, rr2: 7.4, rr3: 7.4 };
  W.hgSyncPlanRr(c);
  ok(near(c.rr, 2), 'rr matches |t1-entry|/|entry-stop|');
  ok(near(c.rr2, 4), 'rr2 matches |t2-entry|/|entry-stop|');
  ok(c.rr3 === null, 'rr3 is CLEARED, not carried over from the previous plan');
  ok(/RR3 cleared/.test(c.rrNote || ''), 'the card is told which leg was cleared');
}

console.log('\n== THE BUG: zero risk must clear every ratio, not leave three stale ones ==');
{
  const c = { entry: 100, stop: 100, t1: 104, t2: 108, t3: 112, rr: 3.1, rr2: 5.2, rr3: 7.3 };
  W.hgSyncPlanRr(c);
  ok(c.rr === null && c.rr2 === null && c.rr3 === null, 'all three cleared when entry === stop');
  ok(/risk distance/.test(c.rrNote || ''), 'the reason names the missing risk distance');
}

console.log('\n== null levels must not read as zero ==');
{
  /* +null is 0, so a null stop used to produce risk = |100 - 0| = 100 and
     three confident, entirely invented ratios. */
  const c = { entry: 100, stop: null, t1: 104, rr: 2, rr2: 3, rr3: 4 };
  W.hgSyncPlanRr(c);
  ok(c.rr === null, 'a null stop clears rr rather than treating it as price 0');
  ok(c.rr2 === null && c.rr3 === null, 'and clears the rest');
  ok(/risk distance/.test(c.rrNote || ''), 'reported as unavailable');
}

console.log('\n== a short plan measures the same way ==');
{
  const c = { entry: 100, stop: 102, t1: 96, t2: 92 };
  W.hgSyncPlanRr(c);
  ok(near(c.rr, 2) && near(c.rr2, 4), 'direction does not change the geometry');
  ok(c.rr3 === null, 'an absent T3 yields a null, not an inherited value');
}

console.log('\n== hgApplyGoldBestLevels leaves the invariant true ==');
{
  /* Whatever the engine decides, the candidate it hands back must satisfy the
     invariant — this is the guarantee the card depends on. */
  const rows = [];
  for (let i = 0; i < 260; i++){
    const c = 3300 + i * 0.6;
    rows.push({ t: i * 14400, o: c, h: c + 2, l: c - 2, c: c, v: 500 });
  }
  const cases = [
    { sym: 'XAUUSDT', dir: 'long', entry: 3450, stop: 3430, t1: 3490, t2: 3530, t3: 3570, rr: 99, rr2: 99, rr3: 99 },
    { sym: 'XAUUSDT', dir: 'long', entry: 3450, stop: 3450, t1: 3490, rr: 99, rr2: 99, rr3: 99 },
    { sym: 'XAUUSDT', dir: 'short', entry: 3450, stop: 3470, t1: 3410, rr: 99, rr2: 99, rr3: 99 },
    { sym: 'XAUUSDT', dir: 'long', entry: 3450, stop: null, t1: 3490, rr: 99 }
  ];
  let checked = 0;
  for (const gc of cases){
    W.hgApplyGoldBestLevels(gc, { style: 'gold-swing', rows: rows, rows4h: rows, atrW: 6, nowMs: 1755300000000 });
    if (typeof W.hgGoldPostApplyRefresh === 'function'){
      W.hgGoldPostApplyRefresh(gc, { style: 'gold-swing', rows: rows, rows4h: rows });
    }
    const risk = (typeof gc.entry === 'number' && typeof gc.stop === 'number')
      ? Math.abs(gc.entry - gc.stop) : NaN;
    for (const [tk, rk] of [['t1', 'rr'], ['t2', 'rr2'], ['t3', 'rr3']]){
      const t = gc[tk], r = gc[rk];
      if (r === null || r === undefined) continue;
      ok(isFinite(risk) && risk > 0, rk + ' is only present when a real risk distance exists');
      ok(typeof t === 'number' && isFinite(t), rk + ' is only present when ' + tk + ' is a real level');
      ok(near(r, Math.abs(t - gc.entry) / risk), rk + ' equals |' + tk + ' - entry| / risk exactly');
      checked++;
    }
    ok(gc.rr !== 99 && gc.rr2 !== 99 && gc.rr3 !== 99, 'no pre-existing ratio survived the apply');
  }
  ok(checked > 0, 'at least one ratio was actually produced and verified (' + checked + ')');
}

console.log('\n== a cleared R:R must not print as a measured 0.0R ==');
{
  /* isFinite(null) is true and +null is 0, so the tally leg used to render
     "structural R:R 0.0R" for a ratio that was deliberately removed. */
  const c = { rr: null, rr1: null, tally: 5, tallyParts: [{ label: 'structural R:R 3.0R — reward/risk geometry', pts: 2 }] };
  W.hgGoldRefreshTallyRr(c);
  ok(!/0\.0R/.test(JSON.stringify(c.tallyParts)), 'no fabricated 0.0R in the tally');
  ok(c.tallyParts[0].pts === 0, 'a missing R:R scores zero points');
  ok(c.tally === 3, 'the tally total is corrected by exactly the points removed');
}

console.log('\n== ranking treats a cleared R:R as absent, not as a real zero ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  ok(/function gdRr\(v\)/.test(src), 'goldind uses a null-rejecting R:R reader');
  ok(!/isFinite\(c\.rr\) \? \+c\.rr/.test(src), 'the raw isFinite(null) read is gone from the tally');
  ok(!/isFinite\(x\.rr\) \? x\.rr/.test(src), 'the raw isFinite(null) read is gone from the sort');
}

console.log('\n== both gold desks route through the shared sync and explain a clear ==');
for (const f of ['goldswing.js', 'goldscalp.js']){
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(/hgSyncPlanRr/.test(src), f + ' uses the shared R:R sync on the form-ticket path');
  ok(!/Math\.abs\(gc2\.t1 - gc2\.entry\)/.test(src), f + ' no longer hand-rolls its own R:R math');
  ok(/rrNoteLine/.test(src), f + ' declares the note line');
  ok(/\+ rrNoteLine/.test(src), f + ' actually emits it into the card');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL R:R CONSISTENCY TESTS PASSED');
