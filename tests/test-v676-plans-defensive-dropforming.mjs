/* v676: plans.js applies defensive forming-bar drops at three internal
   functions that read rows[rows.length - 1] as \"the last closed bar\":

     * hgConfirmedCascade (cascade badge)
     * hgStaleMomentumVeto (age-of-cascade veto)
     * hgSwingG5OK (wick close-position + RSI slope gate)

   Prior to v676 the file trusted callers (engine.js, oiflow.js, squeeze.js,
   brainrobust.js) to supply already-closed rows. Those callers actually
   pass raw fetcher output that still includes the forming bar, so the
   cascade badge, veto decision, and G5 gate all flickered mid-bar.

   Same class as OMNIGOLD v665 (fetch layer) and OMNIROUTE v672 (bucketing).
   v676 puts the guard inside plans.js itself so no matter which caller
   forgets to prefix-close, plans.js still sees a closed prefix. Cannot
   regress a caller that already prefix-closed \u2014 that caller sees the same
   closed prefix. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'plans.js'), 'utf8');

/* --- rationale block + helper --- */
assert.ok(/v676: defensive forming-bar drop for plans\.js internals/.test(src),
  'v676 top-of-file rationale must be present');
assert.ok(/function hgPlansDropForming\(rows\)\{/.test(src),
  'hgPlansDropForming(rows) helper must be defined');
assert.ok(/var shared = G\.hgDropForming \|\| G\.hgOgDropForming \|\| G\.dropForming;/.test(src),
  'helper must prefer the shared drop-forming helper');
assert.ok(/if \(t \+ tf > nowSec\) return rows\.slice\(0, -1\);/.test(src),
  'fallback must pop the last bar when open ts + tf > now');

/* --- three consumers must call the helper defensively --- */
assert.ok(/v676: defensively drop the forming bar so the badge does not flicker/.test(src),
  'hgConfirmedCascade v676 rationale must be present');
assert.ok(/v676: defensively drop the forming bar\. cascadeAgeBars walks from the/.test(src),
  'hgStaleMomentumVeto v676 rationale must be present');
assert.ok(/v676: defensively drop the forming bar\. The wick close-position/.test(src),
  'hgSwingG5OK v676 rationale must be present');
/* structural: each function must call hgPlansDropForming(rows) inside its
   try{} block before touching rows.length - 1 */
assert.ok(/hgConfirmedCascade[\s\S]{0,300}rows = hgPlansDropForming\(rows\);/.test(src),
  'hgConfirmedCascade must call hgPlansDropForming');
assert.ok(/hgStaleMomentumVeto[\s\S]{0,600}rows = hgPlansDropForming\(rows\);/.test(src),
  'hgStaleMomentumVeto must call hgPlansDropForming');
assert.ok(/hgSwingG5OK[\s\S]{0,1200}var dropped = hgPlansDropForming\(rows\);/.test(src),
  'hgSwingG5OK must call hgPlansDropForming');
/* G5 must also slice the closes array to stay in sync when a bar was dropped */
assert.ok(/if \(dropped\.length === rows\.length - 1 && Array\.isArray\(c\) && c\.length === rows\.length\)\{\s*c = c\.slice\(0, -1\);/.test(src),
  'hgSwingG5OK must slice closes array in sync with dropped bar');

/* --- runtime demonstration: extract hgPlansDropForming and drive it --- */
const helperMatch = src.match(/function hgPlansDropForming\(rows\)\{[\s\S]*?\n\}/);
assert.ok(helperMatch, 'hgPlansDropForming body must be extractable');
const wrap = new Function('G', 'DateNow',
  'var Date = { now: DateNow };\n' +
  'var isFinite = Number.isFinite;\n' +
  helperMatch[0] + '\nreturn hgPlansDropForming;');

/* Case A: forming last bar (last open + tf > now) is dropped */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  const now = Math.floor(nowMs / 1000);
  const drop = wrap({}, () => nowMs);
  const rows = [
    { t: now - 9 * 3600 }, { t: now - 5 * 3600 }, { t: now - 1 * 3600 } /* still forming */
  ];
  const out = drop(rows);
  assert.equal(out.length, 2, 'forming last bar must be dropped');
  assert.equal(out[out.length - 1].t, now - 5 * 3600, 'kept the previous closed bar');
}

/* Case B: closed last bar (last open + tf <= now) is kept */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  const now = Math.floor(nowMs / 1000);
  const drop = wrap({}, () => nowMs);
  const rows = [
    { t: now - 9 * 3600 }, { t: now - 5 * 3600 } /* opened 5h ago; 4h tf closed 1h ago */
  ];
  const out = drop(rows);
  assert.equal(out.length, 2, 'closed last bar must be kept');
}

/* Case C: shared helper takes precedence when available */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  let sharedCalls = 0;
  const G = { hgDropForming: function(r){ sharedCalls++; return r.slice(0, -1); } };
  const drop = wrap(G, () => nowMs);
  const rows = [{ t: 100 }, { t: 200 }, { t: 300 }];
  const out = drop(rows);
  assert.equal(sharedCalls, 1, 'shared hgDropForming must have been called');
  assert.equal(out.length, 2, 'shared helper stub drops last bar');
}

/* Case D: shared helper returns empty (bad) \u2014 fallback runs (guard) */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  const now = Math.floor(nowMs / 1000);
  const G = { hgDropForming: function(){ return []; } };
  const drop = wrap(G, () => nowMs);
  const rows = [
    { t: now - 9 * 3600 }, { t: now - 5 * 3600 } /* closed */
  ];
  const out = drop(rows);
  assert.equal(out.length, 2,
    'if shared helper returns empty, fall through to fallback which keeps closed bars');
}

/* Case E: empty / single-bar / null input */
{
  const drop = wrap({}, () => 0);
  assert.deepEqual(drop([]), [], 'empty rows returns []');
  assert.deepEqual(drop(null), [], 'null rows returns []');
  assert.deepEqual(drop([{ t: 100 }]), [{ t: 100 }],
    'single-bar input cannot infer tf, returned unchanged');
}

/* Case F: millisecond timestamps are auto-normalized */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  const drop = wrap({}, () => nowMs);
  const rows = [
    { t: nowMs - 9 * 3600 * 1000 }, { t: nowMs - 4 * 3600 * 1000 }, { t: nowMs }
  ];
  const out = drop(rows);
  assert.equal(out.length, 2, 'ms timestamps must be normalized and forming bar dropped');
}

/* Case G: non-monotonic timestamps (bad data) \u2014 return rows unchanged */
{
  const drop = wrap({}, () => Date.UTC(2026, 8, 8, 20, 0, 0));
  const rows = [{ t: 100 }, { t: 100 }]; /* same ts */
  const out = drop(rows);
  assert.equal(out.length, 2, 'non-monotonic timestamps: cannot infer tf, keep rows');
}

/* --- version --- */
assert.ok(/^hg-v(?:676|67[7-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v676',
  'HG_VER must be >= hg-v676 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('plans\\.js\\?v=' + qv).test(idx),
  'index.html plans.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v676: plans.js defensive forming-bar drop');
console.log('  * hgPlansDropForming defined and prefers shared helper');
console.log('  * hgConfirmedCascade / hgStaleMomentumVeto / hgSwingG5OK apply it');
console.log('  * G5 also slices closes array in sync');
console.log('  * forming last bar dropped; closed last bar kept');
console.log('  * ms timestamps normalized; non-monotonic timestamps safely kept');
console.log('  * empty / single-bar inputs handled');
console.log('  * version bumped to ' + HG_VER);
