/* v696 fix: NEW GOLD OMNIGOLD lane fetches its own rows.

   v695 assumed window.__og.lastRows was reachable so that the OMNI
   lane could reuse OMNIGOLD's already-fetched rows for free. In
   production OMNIGOLD is an IIFE and __og never bound to window, so
   every OMNI lane came back with rowsLen=0 and every hybrid card was
   silently dropped by the ML_LOOKBACK+5 guard.

   v696 fix:
     * ngPullOmniLanes returns ROWLESS candidate metadata only
     * ngRunScan builds a tfRows cache from the primary 1H/4H results
       (no double fetch on 4h) and fetches any missing tf via fetchXau
     * OMNI lanes look up rows from tfRows[lane.tf] and re-gate through
       ngAssess against those rows */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const src = readFileSync(resolve(ROOT, 'newgold.js'), 'utf8');

/* --- ngPullOmniLanes is rowless --- */
assert.ok(!/rowsKey:/.test(src),
  'v696: no rowsKey (rows are no longer sourced from __og.lastRows)');
assert.ok(!/ogState = \(typeof W !== 'undefined'\) \? \(W\.__og \|\| null\) : null/.test(src),
  'v696: no window.__og lookup (unreachable in production)');
assert.ok(!/lane\.rows\.length/.test(src),
  'v696: no lane.rows reads (lanes are rowless)');
assert.ok(!/rows: laneRows/.test(src) === false || /rows: laneRows/.test(src),
  'v696: omniRecord.rows sourced from tfRows cache, not lane object');

/* --- tfRows cache built from primary horizons + fetch missing --- */
assert.ok(/var tfRows = \{\};/.test(src),
  'tfRows cache declared');
assert.ok(/tfRows\[pr\.tf\] = pr\.rows;/.test(src),
  'seeds tfRows from primary horizon results');
assert.ok(/tfSource\[pr\.tf\] = pr\.source;/.test(src),
  'seeds tfSource from primary horizon results');
assert.ok(/if \(!tfRows\[omniLanes\[oi0\]\.tf\]\) neededTfs\[omniLanes\[oi0\]\.tf\] = true;/.test(src),
  'computes neededTfs (missing lanes)');
assert.ok(/pack = await fetchXau\(mtf, KL_LIMIT\);/.test(src),
  'fetches missing tf rows via fetchXau');

/* --- OMNI lane consumes tfRows --- */
assert.ok(/var laneRows = tfRows\[lane\.tf\] \|\| \[\];/.test(src),
  'lane row lookup from tfRows');
assert.ok(/if \(laneRows\.length < ML_LOOKBACK \+ 5\) continue;/.test(src),
  'skips insufficient-bars lanes');
assert.ok(/source: tfSource\[lane\.tf\] \|\| 'omnigold'/.test(src),
  'omniRecord source = tfSource[lane.tf] fallback omnigold');

/* --- runtime: two-swing + one-scalp candidates end up rowless --- */
{
  const fakeW = {};
  fakeW.hgOgUniformDebug = () => ({
    swing: [
      { kind: 'kzJudas', dir: 'long' },
      { kind: 'adrFade', dir: 'short' }
    ],
    scalp: [
      { kind: 'nyOpenDrive', dir: 'long' }
    ]
  });
  /* Deliberately do NOT set fakeW.__og \u2014 the fix must not depend on it. */
  const api = new Function('window', `
    var globalThis = window;
    ${src}
    return { pull: window.ngPullOmniLanes };
  `)(fakeW);
  const lanes = api.pull();
  assert.equal(lanes.length, 3);
  for (const lane of lanes){
    assert.ok(!('rows' in lane),
      'v696: no rows property on lane (fetched by ngRunScan instead)');
    assert.ok(lane.horizonLabel && lane.tf && lane.ogKind && lane.ogDir,
      'lane carries horizonLabel + tf + ogKind + ogDir');
  }
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:696|69[7-9]|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v696',
  'HG_VER must be >= hg-v696');

console.log('OK - v696: NEW GOLD OMNIGOLD lane fetches its own rows');
console.log('  * ngPullOmniLanes returns ROWLESS candidate metadata');
console.log('  * ngRunScan builds tfRows cache from primary 1H/4H (no double fetch on 4h)');
console.log('  * fetches missing tf via fetchXau (adds 15m only)');
console.log('  * OMNI lane re-gates through ngAssess on tfRows[lane.tf]');
console.log('  * v695 rowless bug in production fixed');
console.log('  * runtime: no dependency on window.__og');
console.log('  * version bumped to ' + HG_VER);
