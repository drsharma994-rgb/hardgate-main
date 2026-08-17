/* HARDGATE — a z-score computed over readings that were not there.

   Continuing the coverage sweep from v340: venuepremium.js is one of the
   modules no test executes. Its statistic lives in fixpack15-core.js, and
   hgVenuePremiumZ summed the history straight out of localStorage without
   checking what was in it.

   A stored null does not get ignored by that loop. It adds 0 to the sum and 1
   to the count, so it drags the mean toward zero AND inflates the standard
   deviation. Measured on a 120-sample series with 20 nulls:

       mean 10.141 -> 8.456
       sd    1.396 -> 3.992
       z    10.646 -> 4.145        while n still reported 120

   That is the wrong direction to be wrong in. The z-score is the entire point
   of the function: an inflated sd makes a genuinely stretched venue premium
   read as normal — a missed signal, reported as a measurement. A single
   non-numeric entry did worse and took mean and sd to NaN.

   Only real readings are counted now, and n reports how many there actually
   were rather than how long the array happened to be.

   Run: node tests/test-venue-premium-z.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b, tol) => Math.abs(a - b) < (tol === undefined ? 1e-9 : tol);

const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'fixpack15-core.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const Z = ctx.hgVenuePremiumZ;
const P = ctx.hgVenuePremium;

function series(n){
  const out = [];
  for (let i = 0; i < n; i++) out.push(10 + Math.sin(i / 7) * 2);
  return out;
}

console.log('== both halves of the premium read are reachable ==');
{
  ok(typeof P === 'function', 'hgVenuePremium is exported');
  ok(typeof Z === 'function', 'hgVenuePremiumZ is exported');
  const p = P({ deltaMark: 101, binanceMark: 100 });
  ok(p && near(p.premBps, 100), 'a 1% premium is 100 bps (' + (p && p.premBps) + ')');
  const neg = P({ deltaMark: 99, binanceMark: 100 });
  ok(near(neg.premBps, -100), 'a discount is negative, not absolute (' + neg.premBps + ')');
  ok(P({ deltaMark: null, binanceMark: 100 }) === null, 'a missing mark yields no premium rather than zero');
  ok(P({ deltaMark: 101, binanceMark: 0 }) === null, 'a zero reference yields no premium rather than Infinity');
}

console.log('\n== THE DEFECT: nulls in the history corrupted the statistic ==');
{
  const clean = series(120);
  const dirty = clean.slice();
  for (let i = 0; i < 20; i++) dirty[i * 5] = null;

  const a = Z(clean, 240, 25);
  const b = Z(dirty, 240, 25);

  ok(a.n === 120 && a.dropped === 0, 'a clean history counts every reading (' + a.n + ')');
  ok(b.n === 100, 'a history with 20 nulls counts 100 readings, not 120 (' + b.n + ')');
  ok(b.dropped === 20, 'and reports how many it dropped (' + b.dropped + ')');

  /* The whole point: the surviving statistic must match the clean one. */
  ok(near(a.mean, b.mean, 0.05), 'the mean survives the nulls (' + a.mean.toFixed(3) + ' vs ' + b.mean.toFixed(3) + ')');
  ok(near(a.sd, b.sd, 0.05), 'the sd survives the nulls (' + a.sd.toFixed(3) + ' vs ' + b.sd.toFixed(3) + ')');
  ok(near(a.z, b.z, 0.1), 'and so does the z-score (' + a.z.toFixed(3) + ' vs ' + b.z.toFixed(3) + ')');

  /* Prove the old behaviour really was wrong, by reproducing it here. */
  let sum = 0;
  for (const v of dirty) sum += v;                    /* null adds 0 */
  const oldMean = sum / dirty.length;                 /* divided by 120 */
  ok(Math.abs(oldMean - a.mean) > 1, 'the pre-fix mean really was off by more than a bps ('
    + oldMean.toFixed(3) + ' vs ' + a.mean.toFixed(3) + ')');
}

console.log('\n== a single bad entry no longer takes the whole statistic to NaN ==');
{
  const s = series(120);
  s[3] = 'abc';
  const r = Z(s, 240, 25);
  ok(isFinite(r.mean), 'the mean is a real number (' + r.mean.toFixed(3) + ')');
  ok(isFinite(r.sd), 'the sd is a real number (' + r.sd.toFixed(3) + ')');
  ok(r.z !== null && isFinite(r.z), 'and the z-score survives (' + r.z.toFixed(3) + ')');
  ok(r.n === 119 && r.dropped === 1, 'the bad entry is dropped and counted (' + r.n + '/' + r.dropped + ')');
}

console.log('\n== an empty history says it is empty ==');
{
  const allNull = Z(new Array(120).fill(null), 240, 25);
  ok(allNull.n === 0, 'no real readings means n is zero, not 120 (' + allNull.n + ')');
  ok(allNull.dropped === 120, 'and all 120 are reported dropped');
  ok(allNull.z === null, 'no z-score is invented from nothing');
  ok(allNull.stretched === false, 'and nothing is called stretched');

  const empty = Z([], 240, 25);
  ok(empty.n === 0 && empty.z === null, 'an empty array behaves the same');
  const notArray = Z(null, 240, 25);
  ok(notArray.n === 0 && notArray.z === null, 'a null history does not throw');
}

console.log('\n== the stretched verdict still needs real evidence ==');
{
  /* 60 samples is the floor. Below it, no verdict regardless of the z. */
  const short = series(40);
  const r = Z(short, 240, 100);
  ok(r.n === 40, 'a 40-sample history counts 40');
  ok(r.stretched === false, 'and is never called stretched, however extreme the reading');

  const long = series(120);
  const hot = Z(long, 240, 100);
  ok(hot.n >= 60, 'a 120-sample history clears the floor');
  ok(Math.abs(hot.z) >= 2, 'a premium far from the mean has a large z (' + hot.z.toFixed(2) + ')');
  ok(hot.stretched === true, 'and IS called stretched');

  const normal = Z(long, 240, 10.1);
  ok(Math.abs(normal.z) < 2, 'a premium near the mean has a small z (' + normal.z.toFixed(2) + ')');
  ok(normal.stretched === false, 'and is not called stretched');

  /* A history with too few REAL readings must not qualify on array length. */
  const mostlyNull = new Array(120).fill(null);
  for (let i = 0; i < 30; i++) mostlyNull[i * 4] = 10 + Math.sin(i) * 2;
  const thin = Z(mostlyNull, 240, 100);
  ok(thin.n === 30, 'only the real readings count toward the floor (' + thin.n + ')');
  ok(thin.stretched === false, 'so a 120-long array with 30 readings cannot be stretched');
}

console.log('\n== the z-score is the real algebra ==');
{
  /* A flat series has zero spread: no z is definable, and none is claimed. */
  const flat = new Array(100).fill(5);
  const r = Z(flat, 240, 9);
  ok(r.sd === 0, 'a flat history has zero standard deviation');
  ok(r.z === null, 'and yields no z-score rather than dividing by zero');
  ok(r.stretched === false, 'and no verdict');

  /* Hand-checkable: mean 2, population sd of [1,2,3] is sqrt(2/3). */
  const tiny = Z([1, 2, 3], 240, 4);
  ok(near(tiny.mean, 2), 'mean of [1,2,3] is 2');
  ok(near(tiny.sd, Math.sqrt(2 / 3)), 'population sd is sqrt(2/3) (' + tiny.sd.toFixed(6) + ')');
  ok(near(tiny.z, (4 - 2) / Math.sqrt(2 / 3)), 'z of 4 against that is (4-2)/sd (' + tiny.z.toFixed(6) + ')');
}

console.log('\n== the local slice no longer shadows the global window ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'fixpack15-core.js'), 'utf8');
  const fn = src.slice(src.indexOf('function hgVenuePremiumZ'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  ok(!/var window =/.test(body), 'the slice is not named `window` inside a browser file');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL VENUE-PREMIUM Z TESTS PASSED');
