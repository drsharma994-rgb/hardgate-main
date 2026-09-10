/* v695: NEW GOLD OMNIGOLD lane.

   OMNIGOLD already fetches gold candles + scores candidates via its
   institutional 12-gate engine. Instead of duplicating the fetch or
   trusting OMNIGOLD's plan geometry as-is, NEW GOLD now:

     1. Reads OMNIGOLD's already-scored candidates via hgOgUniformDebug()
     2. Reuses OMNIGOLD's ROWS (__og.lastRows.swing for 4h, .m15 for 15m)
     3. Re-gates each candidate through ngAssess (FVG + VWMA-50 + RSI cross)
     4. Emits a card ONLY when both agree on direction

   The mechanic is stamped TRIPLE-CONF+OMNI:<ogKind> so the forward log
   measures the hybrid edge separately from plain TRIPLE-CONF and plain
   OMNIGOLD - the measured-edge stats will show whether the intersection
   actually wins more often than either parent. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const src = readFileSync(resolve(ROOT, 'newgold.js'), 'utf8');

/* --- helper defined + exposed --- */
assert.ok(/function ngPullOmniLanes\(\)\{/.test(src),
  'ngPullOmniLanes defined');
assert.ok(/W\.ngPullOmniLanes = ngPullOmniLanes;/.test(src),
  'ngPullOmniLanes exposed on W');
assert.ok(/v695 \(v696 fix\): pull OMNIGOLD's already-scored gold candidates/.test(src),
  'v695+v696 rationale comment at helper');

/* --- ngPullOmniLanes reads OMNIGOLD state correctly --- */
assert.ok(/typeof W\.hgOgUniformDebug === 'function'/.test(src),
  'feature-checks hgOgUniformDebug');
assert.ok(/tag: 'SWING', tf: '4h', label: 'OMNI-4H'/.test(src),
  'SWING lane maps to 4h');
assert.ok(/tag: 'SCALP', tf: '15m', label: 'OMNI-15m'/.test(src),
  'SCALP lane maps to 15m');
/* v696: rowless — rows fetched by ngRunScan via fetchXau instead of window.__og */
assert.ok(!/ogState\.lastRows/.test(src),
  'v696: rows are NOT read from window.__og (was unreachable in production)');

/* --- ngRunScan integrates the OMNIGOLD lane --- */
assert.ok(/var omniLanes = ngPullOmniLanes\(\);/.test(src),
  'ngRunScan calls ngPullOmniLanes');
assert.ok(/dedupKey = lane\.horizonLabel \+ '\|' \+ lane\.ogKind \+ '\|' \+ lane\.ogDir/.test(src),
  'dedupes on (horizon, kind, dir)');
assert.ok(/laneRows\.length < ML_LOOKBACK \+ 5/.test(src),
  'v696: skips lanes without enough bars for ngAssess (laneRows fetched by ngRunScan)');
assert.ok(/ogSetup = ngAssess\(laneRows\);/.test(src),
  'v696: re-gates OMNIGOLD candidate through ngAssess on fetched rows');
assert.ok(/mpack = await fetchXau\(mtf, KL_LIMIT\);/.test(src),
  'v696: ngRunScan fetches missing tf rows via fetchXau');
assert.ok(/tfRows\[pr\.tf\] = pr\.rows;/.test(src),
  'v696: reuses primary-horizon rows via tfRows cache (no double fetch)');
assert.ok(/if \(ogSetup\.dir !== lane\.ogDir\) continue;/.test(src),
  'intersection guard: direction must match');

/* --- hybrid mechanic key --- */
assert.ok(/var hybridKind = 'TRIPLE-CONF\+OMNI:' \+ lane\.ogKind;/.test(src),
  'hybrid mechanic key = TRIPLE-CONF+OMNI:<ogKind>');
assert.ok(/ogSetup\.kind = hybridKind;/.test(src),
  'setup.kind stamped as hybrid');
/* hg-v698: confluenceCount is NO LONGER forced to 4, and this expectation
   changed on purpose. Forcing 4 was the exact inflation the unified
   confluence contract forbids: OMNIGOLD agreeing on the same bars is another
   STRUCTURAL read, not a fourth independent class, and the count was fed
   straight into hgSolidityGrade as `consensus.nAgree` — a family count. The
   hybrid now takes the DISTINCT-CLASS count the shared contract actually
   measured (gold-formation.js), and the OMNIGOLD agreement is registered in
   the SAME structure class as the FVG so it earns no free class. */
assert.ok(/ogSetup\.confluenceCount = \(omniRecord\.formation && omniRecord\.formation\.confluence\)/.test(src),
  'confluenceCount comes from the measured distinct-class count, never a hard-coded 4');
assert.ok(/alsoKinds: \[lane\.ogKind\]/.test(src),
  'hybrid formation also judges the UNDERLYING OMNIGOLD kind (demotion table is keyed by it)');
assert.ok(/tape: laneTape\.dir \|\| ''/.test(src),
  'hybrid solidity gets the REAL htf tape, never the card own direction');
assert.ok(/kind: hybridKind/.test(src),
  'solidity lookup uses hybrid kind');

/* --- forward log records the actual mechanic --- */
assert.ok(/mechanic: r\.setup\.kind \|\| 'TRIPLE-CONF'/.test(src),
  'forward log mechanic is setup.kind (TRIPLE-CONF or TRIPLE-CONF+OMNI:<kind>)');

/* --- kill-list tracks the actual kind --- */
assert.ok(/var kk = \(kr\.setup && kr\.setup\.kind\) \|\| 'TRIPLE-CONF';/.test(src),
  'killedKinds tracks the actual setup.kind');

/* --- solidity tab key stays per-horizon --- */
assert.ok(/tab: 'NEWGOLD:' \+ lane\.horizonLabel/.test(src),
  'solidity tab = NEWGOLD:OMNI-4H or NEWGOLD:OMNI-15m');

/* --- runtime: ngPullOmniLanes with a fake W.hgOgUniformDebug returns lanes
     (v696: rowless — rows are fetched by ngRunScan, not by ngPullOmniLanes) --- */
{
  const fakeW = {};
  fakeW.hgOgUniformDebug = () => ({
    swing: [
      { kind: 'kzJudas', dir: 'long', plan: { entry: 100, stop: 99 } },
      { kind: 'adrFade', dir: 'short' }
    ],
    scalp: [
      { kind: 'nyOpenDrive', dir: 'long' }
    ],
    src: { swing: 'binance-xau', m15: 'binance-xau' }
  });
  const api = new Function('window', `
    var globalThis = window;
    ${src}
    return { pull: window.ngPullOmniLanes };
  `)(fakeW);
  const lanes = api.pull();
  assert.equal(lanes.length, 3, 'returns 3 lanes (2 swing + 1 scalp)');
  const swingLanes = lanes.filter(l => l.horizonLabel === 'OMNI-4H');
  const scalpLanes = lanes.filter(l => l.horizonLabel === 'OMNI-15m');
  assert.equal(swingLanes.length, 2, '2 swing lanes');
  assert.equal(scalpLanes.length, 1, '1 scalp lane');
  assert.equal(swingLanes[0].ogKind, 'kzJudas');
  assert.equal(swingLanes[0].tf, '4h');
  assert.equal(swingLanes[0].ogDir, 'long');
  assert.ok(!('rows' in swingLanes[0]), 'v696: no rows on lane object');
  assert.equal(scalpLanes[0].tf, '15m');
}

/* --- runtime: ngPullOmniLanes returns [] when hgOgUniformDebug missing --- */
{
  const fakeW = {};
  const api = new Function('window', `
    var globalThis = window;
    ${src}
    return { pull: window.ngPullOmniLanes };
  `)(fakeW);
  const lanes = api.pull();
  assert.deepEqual(lanes, [], 'returns [] when OMNIGOLD not loaded');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:69[5-9]|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v695',
  'HG_VER must be >= hg-v695');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('newgold\\.js\\?v=' + qv).test(idx));

console.log('OK - v695: NEW GOLD OMNIGOLD lane wired');
console.log('  * ngPullOmniLanes defined + exposed on W');
console.log('  * SWING lane (OMNI-4H) reads __og.lastRows.swing');
console.log('  * SCALP lane (OMNI-15m) reads __og.lastRows.m15');
console.log('  * Each OMNIGOLD candidate re-gated through ngAssess');
console.log('  * Intersection guard: NG dir must match OMNIGOLD dir');
console.log('  * Hybrid mechanic = TRIPLE-CONF+OMNI:<ogKind>');
console.log('  * confluenceCount = measured distinct-class count (v698), never a hard-coded 4');
console.log('  * Forward log mechanic = actual setup.kind (per-hybrid measurement)');
console.log('  * Feature-checked: [] when OMNIGOLD not loaded');
console.log('  * runtime: 3 lanes from 2 swing + 1 scalp candidate');
console.log('  * version bumped to ' + HG_VER);
