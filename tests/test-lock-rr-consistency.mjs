/* HARDGATE — a restored conviction must not pair locked levels with a fresh R:R.

   Restoring a lock replaces the candidate's levels wholesale from the stored
   record. Two paths did not replace everything:

   1. The MERGED branch copied entry/stop/t1/t2 from the merged record and left
      t3 AND rr3 untouched — so every merged conviction carrying a runner
      showed a T3 and an rr3 belonging to the fresh scan, sitting next to an
      entry and stop belonging to the lock. Unconditional, not an edge case.

   2. Both branches recomputed ratios only inside `if (risk > 0)`. When that
      failed, all three ratios stayed from the fresh scan while every level
      came from the record.

   The lock path is the one the trade is actually taken from, which makes a
   mismatch here worse than anywhere else in the app.

   Run: node tests/test-lock-rr-consistency.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

function load(src, filename){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'best-levels.js', 'structure-levels.js', 'gold-best-levels.js']){
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  vm.runInContext(src, ctx, { filename: filename });
  return ctx;
}

const LOCK_SRC = fs.readFileSync(path.join(ROOT, 'conviction-lock.js'), 'utf8');
const W = load(LOCK_SRC, 'conviction-lock.js');

console.log('== the sync helper is reachable from the lock module ==');
{
  ok(typeof W.hgSyncPlanRr === 'function', 'hgSyncPlanRr is on the global by lock time');
  ok(/clSyncRr/.test(LOCK_SRC), 'the lock module routes through the shared sync');
  ok(/function clFin/.test(LOCK_SRC), 'the lock module has a null-rejecting finite test');
  ok(!/if \(isFinite\(rec\.t3\)\) c\.t3 = rec\.t3;/.test(LOCK_SRC), 'the isFinite(null) guard on t3 is gone');
}

console.log('\n== the invariant, stated once, holds for a restored card ==');
{
  const rec = { entry: 3300, stop: 3280, t1: 3340, t2: 3380, t3: 3420, dir: 'long', sym: 'XAUUSDT', issuedAt: 1 };
  const card = W.hgConvictionCardFromRecord
    ? W.hgConvictionCardFromRecord(rec)
    : null;
  if (card){
    const risk = Math.abs(rec.entry - rec.stop);
    ok(near(card.rr, Math.abs(rec.t1 - rec.entry) / risk), 'card rr matches the stored levels');
    ok(near(card.rr3, Math.abs(rec.t3 - rec.entry) / risk), 'card rr3 matches the stored T3');
  } else {
    ok(/rr3: \(risk > 0 && clFin\(rec\.t3\)\)/.test(LOCK_SRC), 'card builder guards T3 with the null-rejecting test');
    ok(/rr: \(risk > 0 && clFin\(rec\.t1\)\)/.test(LOCK_SRC), 'card builder guards T1 too (it previously did not)');
  }
}

console.log('\n== a cleared ratio is null, never a leftover or a NaN-that-serialises ==');
{
  const c = { entry: 100, stop: 100, t1: 110, rr: 5, rr2: 5, rr3: 5 };
  W.hgSyncPlanRr(c);
  ok(c.rr === null && c.rr2 === null && c.rr3 === null, 'zero risk clears all three');
  ok(JSON.parse(JSON.stringify(c)).rr === null, 'null survives the localStorage round-trip as null');
}

console.log('\n== THE MERGED BRANCH: t3 and rr3 used to be left behind ==');
{
  /* Read the shipped source: the merged branch must restore t3 alongside the
     other levels and re-derive every ratio. */
  const merged = LOCK_SRC.slice(LOCK_SRC.indexOf('c.entry = mergedRec.entry'));
  const block = merged.slice(0, merged.indexOf('c.venue = mergedRec.venue'));
  ok(/c\.t3 = clFin\(mergedRec\.t3\)/.test(block), 'the merged branch now restores t3 from the merged record');
  ok(/clSyncRr\(c\)/.test(block), 'the merged branch re-derives every ratio');
  ok(!/mrisk/.test(block), 'the hand-rolled partial recompute is gone');
}

console.log('\n== THE RESTORE BRANCH: ratios are re-derived unconditionally ==');
{
  const restore = LOCK_SRC.slice(LOCK_SRC.indexOf('c.entry = rec.entry; c.stop = rec.stop;'));
  const block = restore.slice(0, restore.indexOf('c.venue = rec.venue;'));
  ok(/clSyncRr\(c\)/.test(block), 'the restore branch re-derives every ratio');
  ok(!/if \(risk > 0\)/.test(block), 'ratios are no longer left stale when risk is not positive');
  ok(/c\.t3 = clFin\(rec\.t3\) \? rec\.t3 : null/.test(block), 't3 is restored or explicitly cleared, never half-set');
}

console.log('\n== reproduction: the pre-fix merged branch really did leave rr3 behind ==');
{
  /* Rebuild the old merged branch and show the mismatch it produced. */
  const freshScan = { entry: 3400, stop: 3390, t1: 3420, t2: 3440, t3: 3460, rr: 2, rr2: 4, rr3: 6 };
  const mergedRec = { entry: 3300, stop: 3280, t1: 3340, t2: 3380, t3: 3420 };

  const oldWay = Object.assign({}, freshScan);
  oldWay.entry = mergedRec.entry; oldWay.stop = mergedRec.stop;
  oldWay.t1 = mergedRec.t1; oldWay.t2 = mergedRec.t2;
  const mrisk = Math.abs(mergedRec.entry - mergedRec.stop);
  if (mrisk > 0){
    oldWay.rr = Math.abs(mergedRec.t1 - mergedRec.entry) / mrisk;
    oldWay.rr2 = Math.abs(mergedRec.t2 - mergedRec.entry) / mrisk;
  }
  ok(oldWay.t3 === 3460 && oldWay.rr3 === 6,
    'pre-fix: T3 3460 and rr3 6R survived from the fresh scan onto locked levels');
  ok(!near(oldWay.rr3, Math.abs(oldWay.t3 - oldWay.entry) / mrisk),
    'pre-fix: the surviving rr3 did not match its own displayed T3 and entry');

  const newWay = Object.assign({}, freshScan);
  newWay.entry = mergedRec.entry; newWay.stop = mergedRec.stop;
  newWay.t1 = mergedRec.t1; newWay.t2 = mergedRec.t2;
  newWay.t3 = mergedRec.t3;
  W.hgSyncPlanRr(newWay);
  ok(near(newWay.rr3, Math.abs(newWay.t3 - newWay.entry) / mrisk), 'post-fix: rr3 matches its own T3 and entry');
  ok(near(newWay.rr, 2) && near(newWay.rr2, 4) && near(newWay.rr3, 6), 'post-fix: every leg derived from the locked plan');
}

console.log('\n== pine: one guard for nine scripts, no Infinity R:R ==');
{
  const sub = fs.readFileSync(path.join(ROOT, 'pine-sub.js'), 'utf8');
  ok(/sig\.rr = \(fin\(rk\) && rk > 0/.test(sub), 'pineSubEnrichSignal guards the denominator');

  const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(sub, ctx, { filename: 'pine-sub.js' });

  const mk = (entry, stop, t1) => ctx.pineSubEnrichSignal(
    { sym: 'X', dir: 'long', entry: entry, stop: stop, t1: t1, isNew: true },
    { gates: [] }, { newLong: true }
  );
  const degenerate = mk(100, 100, 110);
  ok(degenerate.rr === null, 'entry === stop yields null, not Infinity');
  ok(degenerate.rr !== Infinity, 'no Infinity can reach a sort or an R:R floor');
  const normal = mk(100, 98, 104);
  ok(near(normal.rr, 2), 'a real signal still gets its real 2R');
  const noTarget = mk(100, 98, null);
  ok(noTarget.rr === null, 'a null target yields null rather than treating it as price 0');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL LOCK R:R TESTS PASSED');
