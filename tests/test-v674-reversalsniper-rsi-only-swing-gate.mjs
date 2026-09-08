/* v674: reversalsniper RSI-only branch requires structural weakness.

   The RSI-only branch is the weakest branch in rsAssess: it fires on a
   single indicator (RSI(2) <= 12) and normally reaches MIN_CONVICTION = 4
   by stacking a drawdown bump and an RSI-depth bump. v670 already dropped
   the forming bar so rows[n-1] is now a closed bar, but even so a hot
   RSI(2) alone does not describe the swing shape a reversal SHOULD snipe.

   Fix (v674): before allowing lowest[n-1] as the swing extreme in the
   RSI-only branch, require a completed LOWER LOW on the last two closed
   bars (rows[n-2].l < rows[n-3].l). If no such lower low is present, fall
   back to rsSwingLow(rows, 10, 1) which uses a proper closed-bar swing
   window that excludes only the immediately-adjacent bar. When neither
   is available, skip the branch entirely.

   Guards preserved: n >= 4, a14 finite, ex finite (the branch simply
   skips otherwise). The sweep and mean-rev branches are unchanged \u2014 they
   already anchor to real completed swings via sweepFn and meanrevPlan. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');

/* --- rationale --- */
assert.ok(/v674: RSI-only branch \u2014 the weakest branch/.test(src),
  'v674 rationale must be present at the RSI-only branch');

/* --- guard: n >= 4 --- */
assert.ok(/if \(!plan && triggers\.indexOf\('rsi'\) >= 0 && isFinite\(a14\) && n >= 4\)\{/.test(src),
  'RSI-only branch must guard on n >= 4 (needs rows[n-2] and rows[n-3])');

/* --- lower-low completion check --- */
assert.ok(/var lower = isFinite\(rows\[n-2\] && rows\[n-2\]\.l\) && isFinite\(rows\[n-3\] && rows\[n-3\]\.l\) &&\s*\(rows\[n-2\]\.l < rows\[n-3\]\.l\);/.test(src),
  'must test rows[n-2].l < rows[n-3].l for a completed lower low');

/* --- lower-low branch uses lowest[n-1]; fallback uses rsSwingLow(rows, 10, 1) --- */
assert.ok(/ex = \(lo5b && lo5b\.length\) \? lo5b\[n - 1\] : NaN;/.test(src),
  'lower-low path uses lowest[n-1]');
assert.ok(/ex = rsSwingLow\(rows, 10, 1\);/.test(src),
  'fallback path uses rsSwingLow(rows, 10, 1)');

/* --- runtime demonstration: extract the exact RSI-only branch logic ---
   Rather than extract the whole rsAssess (huge and dependency-heavy), I
   inline the exact predicate under test and drive it with hand-crafted rows. */
function rsiOnlyExtreme(rows){
  const n = rows.length;
  if (n < 4) return { ex: NaN, path: 'skip', reason: 'n < 4' };
  const lows = rows.map(r => r.l);
  const lo5b = lowest(lows, 5);
  const lower = Number.isFinite(rows[n-2] && rows[n-2].l) &&
                Number.isFinite(rows[n-3] && rows[n-3].l) &&
                (rows[n-2].l < rows[n-3].l);
  let ex;
  let path;
  if (lower){
    ex = (lo5b && lo5b.length) ? lo5b[n - 1] : NaN;
    path = 'lower-low';
  } else {
    ex = swingLow(rows, 10, 1);
    path = 'swing-fallback';
  }
  return { ex, path };
}
function lowest(vals, len){
  const out = [];
  for (let i = 0; i < vals.length; i++){
    const start = Math.max(0, i - len + 1);
    let m = Infinity;
    for (let j = start; j <= i; j++) if (vals[j] < m) m = vals[j];
    out.push(Number.isFinite(m) ? m : NaN);
  }
  return out;
}
function swingLow(rows, lookback, exclude){
  const n = rows.length;
  const start = Math.max(0, n - lookback);
  const end = Math.max(start, n - exclude);
  let lo = Infinity;
  for (let i = start; i < end; i++){
    if (rows[i] && Number.isFinite(rows[i].l) && rows[i].l < lo) lo = rows[i].l;
  }
  return Number.isFinite(lo) ? lo : NaN;
}

/* Case A: no completed lower low (last 2 closed bars are flat/rising) \u2014
   MUST fall back to rsSwingLow, NOT use lowest[n-1]. */
{
  const rows = [
    { l: 100 }, { l: 99 }, { l: 98 }, { l: 97 },  /* older */
    { l: 96 },                                      /* n-3 low = 96 */
    { l: 97 },                                      /* n-2 low = 97 (higher than n-3) */
    { l: 96 }                                       /* n-1 = current close, low = 96 */
  ];
  const r = rsiOnlyExtreme(rows);
  assert.equal(r.path, 'swing-fallback',
    'no lower low (n-2 >= n-3) must use rsSwingLow, not lowest[n-1]');
  /* rsSwingLow(rows, 10, 1) uses rows[0..n-1) => rows[0..6), lo = min(100,99,98,97,96,97) = 96 */
  assert.equal(r.ex, 96, 'fallback swing low = 96');
}

/* Case B: completed lower low (rows[n-2].l < rows[n-3].l) \u2014 use lowest[n-1]. */
{
  const rows = [
    { l: 100 }, { l: 99 }, { l: 98 }, { l: 97 },
    { l: 98 },                                       /* n-3 = 98 */
    { l: 95 },                                       /* n-2 = 95 (LOWER than n-3) */
    { l: 96 }                                        /* n-1 close low = 96 */
  ];
  const r = rsiOnlyExtreme(rows);
  assert.equal(r.path, 'lower-low',
    'completed lower low must use lowest[n-1]');
  /* lowest(lows, 5)[n-1] over last 5 lows = min(97, 98, 95, 96) but window is 5,
     so from index n-5..n-1 = indices 2..6 => lows 98,97,98,95,96 => min = 95 */
  assert.equal(r.ex, 95, 'lower-low path uses lowest[n-1] = 95');
}

/* Case C: exactly n=4 (edge case) with a completed lower low */
{
  const rows = [
    { l: 100 },
    { l: 99 },   /* n-3 */
    { l: 95 },   /* n-2, lower than n-3 */
    { l: 96 }    /* n-1 */
  ];
  const r = rsiOnlyExtreme(rows);
  assert.equal(r.path, 'lower-low', 'n=4 with lower low uses lowest[n-1]');
}

/* Case D: n=3 (below minimum) \u2014 branch must skip */
{
  const rows = [ { l: 100 }, { l: 99 }, { l: 95 } ];
  const r = rsiOnlyExtreme(rows);
  assert.equal(r.path, 'skip', 'n < 4 skips the branch entirely');
}

/* Case E: rows with NaN lows at n-2 or n-3 \u2014 lower-low check is false, fallback */
{
  const rows = [
    { l: 100 }, { l: 99 }, { l: 98 }, { l: 97 },
    { l: NaN },   /* n-3 */
    { l: 95 },    /* n-2 */
    { l: 96 }
  ];
  const r = rsiOnlyExtreme(rows);
  assert.equal(r.path, 'swing-fallback',
    'NaN low at n-3 must fail the completed-lower-low check and fall back');
}

/* Case F: fallback returns NaN when all excluded bars are missing lows \u2014
   in real code the `if (isFinite(ex))` guard then skips the branch. */
{
  const rows = [
    { l: NaN }, { l: NaN }, { l: NaN }, { l: NaN },
    { l: 100 },                                     /* n-3 */
    { l: 101 },                                     /* n-2 (higher than n-3 => no lower low) */
    { l: 98 }
  ];
  const r = rsiOnlyExtreme(rows);
  assert.equal(r.path, 'swing-fallback',
    'n-2 (101) >= n-3 (100), lower-low check fails, fallback runs');
  /* fallback: rsSwingLow(rows, 10, 1) reads rows[0..6) => 4 NaN + 100 + 101 => lo = 100 */
  assert.equal(r.ex, 100, 'fallback swing low = 100 (min of finite lows in the window)');
}

/* Case G: sanity \u2014 lowest[n-1] returns the min of the last 5 closed lows
   only when they include a completed lower low, so the two paths give
   demonstrably different extremes on the same input shape. */
{
  const rowsLower = [
    { l: 200 }, { l: 190 }, { l: 180 }, { l: 170 },
    { l: 160 },   /* n-3 */
    { l: 150 },   /* n-2 < n-3 */
    { l: 155 }    /* n-1 close */
  ];
  const rowsNoLower = [
    { l: 200 }, { l: 190 }, { l: 180 }, { l: 170 },
    { l: 160 },   /* n-3 */
    { l: 165 },   /* n-2 > n-3 */
    { l: 158 }    /* n-1 close */
  ];
  const a = rsiOnlyExtreme(rowsLower);
  const b = rsiOnlyExtreme(rowsNoLower);
  assert.equal(a.path, 'lower-low');
  assert.equal(a.ex, 150, 'lower-low path extreme = 150 (real completed lower low)');
  assert.equal(b.path, 'swing-fallback');
  assert.equal(b.ex, 160, 'fallback path extreme = 160 (closed swing low outside recent)');
  /* Key point: without the v674 guard, the no-lower-low case would have\n     given 158 (the last close low, treated as a swing when it is not).\n     With the guard we anchor to 160 (the last real completed swing low). */
}

/* --- version --- */
assert.ok(/^hg-v(?:674|67[5-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v674',
  'HG_VER must be >= hg-v674 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('reversalsniper\\.js\\?v=' + qv).test(idx),
  'index.html reversalsniper.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v674: RSI-only branch requires structural weakness');
console.log('  * n >= 4 guard added');
console.log('  * completed lower low (rows[n-2].l < rows[n-3].l) required for lowest[n-1] path');
console.log('  * fallback to rsSwingLow(rows, 10, 1) when no lower low');
console.log('  * lower-low case:  extreme = 150 (real completed swing low)');
console.log('  * no-lower case:   extreme = 160 (proper swing helper, not last close low)');
console.log('  * NaN at n-2/n-3 correctly falls back');
console.log('  * version bumped to ' + HG_VER);
