/* v672: hgOmniResample drops the trailing higher-TF bucket while it is
   still aggregating.

   Prior to v672 the resample function unconditionally pushed the final
   bucket even when only 1..(N-1) of its constituent bars had arrived, so
   daily resamples mid-session emitted a partial daily bar. Consumers
   (hgOmniDailyHtf, hgOmniMultiTfCascadeScore, HouseHits squeeze path)
   then read EMA21/EMA50 off that partial daily close, causing the daily
   HTF gate to flip mid-day and MTF cascade agreement bits to repaint.

   Same class as v665 dropForming on the fetch path, one abstraction higher.

   Fix: hgOmniResample now defaults to dropping the trailing bucket unless
   it is provably closed (i.e. the last raw bar's timestamp + one raw-tf
   period would have started a new bucket). Callers that need the old
   behaviour (e.g. walk-forward replays that already prefix-close their
   series) pass `{ dropForming: false }`. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');

/* --- rationale comment must be present --- */
assert.ok(/v672: drop the trailing bucket when it is still aggregating/.test(src),
  'v672 rationale must be present in hgOmniResample');

/* --- signature accepts opts --- */
assert.ok(/function hgOmniResample\(rows, secPerBucket, opts\)\{/.test(src),
  'hgOmniResample must accept the new opts parameter');

/* --- default drop + opt-out via opts.dropForming === false --- */
assert.ok(/var drop = !\(opts && opts\.dropForming === false\);/.test(src),
  'default is drop; caller opts out with opts.dropForming === false');

/* --- close detection uses last two raw bar timestamps --- */
assert.ok(/var lastRawT = num\(rows\[rows\.length - 1\]\.t\);/.test(src),
  'must read last raw row timestamp');
assert.ok(/var prevT = num\(rows\[rows\.length - 2\]\.t\);/.test(src),
  'must read second-to-last raw row timestamp to infer raw tf');
assert.ok(/lastRawT \+ rawTf >= cur\.t \+ per/.test(src),
  'bucket is closed iff lastRawT + rawTf >= cur.t + per');

/* --- runtime demonstration: extract hgOmniResample and drive it --- */
const rsMatch = src.match(/function hgOmniResample\(rows, secPerBucket, opts\)\{[\s\S]*?\n  \}/);
assert.ok(rsMatch, 'hgOmniResample body must be extractable');
const wrap = new Function('num',
  rsMatch[0] + '\nreturn hgOmniResample;');
const hgOmniResample = wrap(
  (v) => { var n = +v; return Number.isFinite(n) ? n : NaN; }
);

/* Build a series of 4h bars covering N full days plus a partial day. */
function mk4hBars(days, partialBars){
  const rows = [];
  const day0Utc = Date.UTC(2026, 8, 1, 0, 0, 0) / 1000;
  /* full complete days */
  for (let d = 0; d < days; d++){
    for (let b = 0; b < 6; b++){
      rows.push({
        t: day0Utc + d * 86400 + b * 14400,
        o: 100 + d * 6 + b, h: 100 + d * 6 + b + 0.5,
        l: 100 + d * 6 + b - 0.5, c: 100 + d * 6 + b, v: 1
      });
    }
  }
  /* partial day (0..5 additional 4h bars, no more than 5) */
  for (let b = 0; b < partialBars; b++){
    rows.push({
      t: day0Utc + days * 86400 + b * 14400,
      o: 200 + b, h: 200 + b + 0.5, l: 200 + b - 0.5, c: 200 + b, v: 1
    });
  }
  return rows;
}

/* Case A: 3 complete days + 3 partial 4h bars (half a day) \u2014 default drop */
{
  const rows = mk4hBars(3, 3);
  const d1 = hgOmniResample(rows, 86400);
  /* Should emit 3 daily bars (the partial day is dropped) */
  assert.equal(d1.length, 3,
    'default behaviour drops the still-forming daily bucket');
  /* Third daily bar's high must be the highest 4h high of day-index 2, not day-index 3 */
  assert.ok(d1[2].c < 200, 'third daily bar is a full day-2 aggregate (close < 200)');
}

/* Case B: 3 complete days + 3 partial \u2014 opt out with dropForming: false */
{
  const rows = mk4hBars(3, 3);
  const d1 = hgOmniResample(rows, 86400, { dropForming: false });
  assert.equal(d1.length, 4,
    'opt-out preserves the partial daily bucket (backward-compat replay path)');
  assert.equal(d1[3].c, 202, 'partial fourth bucket closes at the last 4h bar in it');
}

/* Case C: exactly 3 complete days (last bar closes the last daily bucket)
   The last raw bar is (day 2, bar 5), timestamp = day0 + 2*86400 + 5*14400.
   rawTf = 14400. cur.t = day0 + 2*86400. cur.t + per = day0 + 3*86400.
   lastRawT + rawTf = day0 + 2*86400 + 5*14400 + 14400 = day0 + 3*86400.
   So the condition lastRawT + rawTf >= cur.t + per is TRUE \u2014 the bucket
   is exactly closed, and must be emitted. */
{
  const rows = mk4hBars(3, 0);
  const d1 = hgOmniResample(rows, 86400);
  assert.equal(d1.length, 3,
    'exactly 3 complete days => 3 daily buckets emitted (last one is closed)');
}

/* Case D: hourly rows resampled to 4h with the trailing 4h bucket half-full.
   1h rows with 3 completed 4h buckets + 2 hours of a fourth 4h bucket \u2014
   the fourth must be dropped. */
{
  const rows = [];
  const t0 = Date.UTC(2026, 8, 1, 0, 0, 0) / 1000;
  /* 3 complete 4h buckets (12 hours) + 2 partial hours */
  for (let h = 0; h < 14; h++){
    rows.push({ t: t0 + h * 3600, o: 100+h, h: 100+h+0.5, l: 100+h-0.5, c: 100+h, v: 1 });
  }
  const r4 = hgOmniResample(rows, 14400);
  assert.equal(r4.length, 3,
    '14 hourly bars aggregate to 3 closed 4h buckets (partial 4th dropped)');
}

/* Case E: empty / null input */
{
  assert.deepEqual(hgOmniResample([], 86400), [], 'empty rows returns []');
  assert.deepEqual(hgOmniResample(null, 86400), [], 'null rows returns []');
}

/* Case F: single-bar input (no rawTf inferable) \u2014 bucket cannot be proven closed,
   so with default drop the result is []. Opt-out preserves the single bar. */
{
  const rows = [{ t: 1000, o: 1, h: 1, l: 1, c: 1, v: 1 }];
  const dDrop = hgOmniResample(rows, 86400);
  assert.equal(dDrop.length, 0,
    'single-bar input cannot prove closure; default drops the bucket');
  const dNoDrop = hgOmniResample(rows, 86400, { dropForming: false });
  assert.equal(dNoDrop.length, 1,
    'single-bar input with opt-out yields the single bucket');
}

/* --- version --- */
assert.ok(/^hg-v(?:672|67[3-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v672',
  'HG_VER must be >= hg-v672 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omniroute\\.js\\?v=' + qv).test(idx),
  'index.html omniroute.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v672: hgOmniResample drops forming trailing bucket by default');
console.log('  * 3 full days + 3 partial 4h bars => 3 daily buckets (partial dropped)');
console.log('  * exactly-closed final bucket is preserved');
console.log('  * hourly -> 4h with partial 4th bucket: 3 closed buckets returned');
console.log('  * opt-out via opts.dropForming = false restores old behaviour');
console.log('  * single-bar input drops by default (cannot prove closure)');
console.log('  * version bumped to ' + HG_VER);
