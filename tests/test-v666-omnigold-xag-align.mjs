/* v666: gold-vs-silver mechanics align by TIMESTAMP, not tail-index.

   Three OMNIGOLD mechanics (SMT-DIVERGE, GSR-EXTREME, COINT-SPREAD)
   compare gold (XAU) to silver (XAG) bars. Before v666 they paired
   by array index (xag[n-1] with rows[m-1], xag[n-2] with rows[m-2],
   etc.), silently assuming both series had the same length AND were
   aligned on the same timestamps.

   Two real-world things break that:
     * XAG can arrive with fewer bars than XAU (different provider,
       gaps, session offsets). goldind's shared __smtAlignIdx exists
       exactly for this reason.
     * A single data gap in XAG shifts all subsequent pairs by one
       bar, so \"gold 10 bars ago vs silver 10 bars ago\" can compare
       different time windows. On a fast market that produces phantom
       divergence and phantom GSR z-scores.

   Fix: new hgOgAlignXag(rows, xag, maxSkewSec) walks XAU rows and,
   for each, finds the nearest XAG bar within tolerance. Returns
   pairs oldest -> newest. Prefers goldind's __smtAlignIdx global
   when present; falls back to an inline linear scan. All three
   affected mechanics now route through this helper. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');

/* --- rationale comment must be present so future edits know why --- */
assert.ok(/v666: gold\/silver bars aligned by TIMESTAMP, not by tail-index/.test(src),
  'v666 rationale comment must be present in the helper block');

/* --- helper defined and used from all three sites --- */
assert.ok(/function hgOgAlignXag\(rows, xag, maxSkewSec\)\{/.test(src),
  'hgOgAlignXag helper must be defined with (rows, xag, maxSkewSec) signature');
assert.ok(/var alignFn = gfn\('__smtAlignIdx'\);/.test(src),
  'helper must feature-check goldind __smtAlignIdx via gfn()');

/* SMT-DIVERGE routes through the aligned helper */
assert.ok(/hgOgSmtDiverge[\s\S]{0,800}var pairs = hgOgAlignXag\(rows, xag\);/.test(src),
  'hgOgSmtDiverge must call hgOgAlignXag on rows,xag');
assert.ok(/hgOgSmtDiverge[\s\S]{0,1200}pairs\[pairs\.length - 11\]/.test(src),
  'SMT-DIVERGE must sample the 10th-oldest aligned pair from the tail');
assert.ok(/over 10 aligned bars/.test(src),
  'why-string must say \"10 aligned bars\" now (was \"10 bars\")');

/* GSR-EXTREME routes through the aligned helper */
assert.ok(/hgOgGsrExtreme[\s\S]{0,800}var pairs = hgOgAlignXag\(rows, xag\);/.test(src),
  'hgOgGsrExtreme must call hgOgAlignXag');
assert.ok(/g = pairs\[i\]\.gc; s = pairs\[i\]\.sc;/.test(src),
  'GSR-EXTREME ratio loop must read pairs[i].gc/sc, not raw rows/xag');

/* COINT-SPREAD routes through the aligned helper */
assert.ok(/hgOgCointSpread[\s\S]{0,800}var pairsAll = hgOgAlignXag\(rows, xag\);/.test(src),
  'hgOgCointSpread must call hgOgAlignXag');
assert.ok(/pairsAll\.length > 300 \? pairsAll\.slice\(-300\) : pairsAll/.test(src),
  'COINT-SPREAD must cap the aligned pairs at 300 (was Math.min(rows.length, xag.length, 300))');

/* --- stale tail-index pairing must be gone --- */
assert.ok(!/g = num\(rows\[rows\.length - m \+ i\]\.c\);\s*s = num\(xag\[xag\.length - m \+ i\]\.c\);/.test(src),
  'stale tail-index pairing in GSR-EXTREME must be removed');
assert.ok(!/ga = num\(rows\[rows\.length - m \+ i\]\.c\);\s*sa = num\(xag\[xag\.length - m \+ i\]\.c\);/.test(src),
  'stale tail-index pairing in COINT-SPREAD must be removed');
assert.ok(!/legs\(rows\), s = legs\(xag\);/.test(src),
  'stale legs(rows)/legs(xag) pattern in SMT-DIVERGE must be gone');

/* --- runtime demonstration: extract hgOgAlignXag and drive it. --- */
const helperMatch = src.match(/function hgOgAlignXag\(rows, xag, maxSkewSec\)\{[\s\S]*?\n  \}/);
assert.ok(helperMatch, 'hgOgAlignXag body must be extractable');
/* the helper calls gfn() and num(); provide simple stubs so it runs standalone */
const wrap = new Function('gfn', 'num', 'isFinite',
  helperMatch[0] + '\nreturn hgOgAlignXag;');
const stubGfn = () => null;
const stubNum = (v) => { var n = +v; return Number.isFinite(n) ? n : NaN; };
const hgOgAlignXag = wrap(stubGfn, stubNum, Number.isFinite);

const HR = 3600;
function bar(t, gc, sc){ return { t, c: gc, h: gc + 1, l: gc - 1, __xag: sc }; }
/* Convenience: build a full aligned pair series from timestamps */
function pair(t, gc, sc){ return [{ t, c: gc, h: gc+1, l: gc-1 }, { t, c: sc, h: sc+0.5, l: sc-0.5 }]; }

/* Case A: perfectly aligned same-length series. Every bar pairs 1:1. */
{
  const xau = [], xag = [];
  const base = 1_700_000_000;
  for (let i = 0; i < 20; i++){
    xau.push({ t: base + i * HR, c: 2000 + i, h:0, l:0 });
    xag.push({ t: base + i * HR, c:   25 + i * 0.1, h:0, l:0 });
  }
  const pairs = hgOgAlignXag(xau, xag);
  assert.equal(pairs.length, 20, 'aligned same-length series must produce 20 pairs');
  assert.equal(pairs[0].gc, 2000);
  assert.equal(pairs[0].sc, 25);
  assert.equal(pairs[19].gc, 2019);
}

/* Case B: XAG has a data gap (missing bar 5). Pair count drops by 1, and
   the pairs on either side of the gap point to the correct XAG bars. */
{
  const xau = [], xag = [];
  const base = 1_700_000_000;
  for (let i = 0; i < 20; i++){
    xau.push({ t: base + i * HR, c: 2000 + i });
    if (i === 5) continue;  /* XAG is missing bar 5 */
    xag.push({ t: base + i * HR, c: 25 + i * 0.1 });
  }
  const pairs = hgOgAlignXag(xau, xag);
  assert.equal(pairs.length, 19, 'missing XAG bar must drop only that one pair (20 -> 19)');
  /* XAU bar 4 should pair with XAG bar 4 (both at base + 4*HR).
     XAG bar 4 has c = 25 + 4*0.1 = 25.4 */
  const pair4 = pairs.find(p => p.t === base + 4 * HR);
  assert.ok(pair4 && Math.abs(pair4.sc - 25.4) < 1e-9, 'pair at bar 4 aligns to correct XAG bar');
  /* XAU bar 5 should be absent (no aligned XAG bar within tolerance). */
  const pair5 = pairs.find(p => p.t === base + 5 * HR);
  assert.ok(!pair5, 'pair at bar 5 must not exist (gap)');
  /* XAU bar 6 should still align to XAG bar 6 (which has c = 25.6),
     NOT to XAG bar 4 (25.4) that would appear if the gap shifted pairs.
     Pre-v666 with tail-index pairing, XAU bar 6 would have been paired
     with the 6-from-tail XAG bar which is actually bar 4 (since one bar
     was dropped from XAG's tail). */
  const pair6 = pairs.find(p => p.t === base + 6 * HR);
  assert.ok(pair6 && Math.abs(pair6.sc - 25.6) < 1e-9,
    'pair at bar 6 aligns to XAG bar 6 (gap did not shift subsequent pairs)');
}

/* Case C: XAG shorter than XAU. Only overlapping timestamps pair. */
{
  const xau = [], xag = [];
  const base = 1_700_000_000;
  for (let i = 0; i < 20; i++) xau.push({ t: base + i * HR, c: 2000 + i });
  for (let i = 8; i < 20; i++) xag.push({ t: base + i * HR, c: 25 + i * 0.1 });
  const pairs = hgOgAlignXag(xau, xag);
  assert.equal(pairs.length, 12, 'shorter XAG (12 bars) must produce 12 pairs');
  assert.ok(pairs.every(p => p.t >= base + 8 * HR),
    'all pairs must be timestamped at or after XAG first bar');
}

/* Case D: timestamps skewed by 60s (within 480s tolerance) still pair. */
{
  const base = 1_700_000_000;
  const xau = [{ t: base, c: 2000 }, { t: base + HR, c: 2001 }];
  const xag = [{ t: base + 60, c: 25 }, { t: base + HR + 45, c: 25.1 }];
  const pairs = hgOgAlignXag(xau, xag);
  assert.equal(pairs.length, 2, 'skew within 480s tolerance must still pair both bars');
}

/* Case E: timestamps skewed beyond tolerance (e.g. 600s > 480s) drop out. */
{
  const base = 1_700_000_000;
  const xau = [{ t: base, c: 2000 }];
  const xag = [{ t: base + 600, c: 25 }];   /* 10 min skew */
  const pairs = hgOgAlignXag(xau, xag);
  assert.equal(pairs.length, 0, 'skew beyond tolerance must drop the pair');
}

/* Case F: missing/non-finite timestamps are skipped. */
{
  const xau = [
    { t: 1_700_000_000, c: 2000 },
    { c: 2001 },                                        /* no t */
    { t: 1_700_003_600, c: 2002 }
  ];
  const xag = [
    { t: 1_700_000_000, c: 25 },
    { t: 1_700_003_600, c: 25.1 }
  ];
  const pairs = hgOgAlignXag(xau, xag);
  assert.equal(pairs.length, 2, 'XAU bar with no t must be skipped');
}

/* --- version --- */
assert.ok(/^hg-v(?:666|66[7-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v666',
  'HG_VER must be >= hg-v666 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v666: XAU/XAG comparisons align by timestamp');
console.log('  * hgOgAlignXag helper defined, uses shared __smtAlignIdx when present');
console.log('  * SMT-DIVERGE routes through aligned pairs (10 aligned bars)');
console.log('  * GSR-EXTREME builds ratio series from aligned pairs');
console.log('  * COINT-SPREAD builds regressed series from aligned pairs');
console.log('  * runtime verified: same-length aligned, gaps, short XAG, skew tolerance, missing timestamps');
console.log('  * version bumped to ' + HG_VER);
