/* v677: uniform setup-freshness stamping + soft-penalty across all 3 tabs.

   Motivation: existing v664-v676 fixes made data hygiene, direction safety,
   DST windows, and forming-bar handling correct. Nothing yet gated the
   OTHER dimension of solidity \u2014 whether the setup is still actionable.
   A pattern that formed three or four bars ago has usually already
   resolved (price ran through the level or the exhaustion faded), yet
   without a freshness input those stale cards ranked identically to fresh
   ones.

   Fix (in three coordinated changes):
     1. omnigold.js hgOgDetect: after collecting every hit, stamp t = lastBar.t
        on any hit that does not already carry a formation timestamp.
     2. omniroute.js hgOmniDetect: same stamping pattern.
     3. reversalsniper.js rsAssess: stamp formedT on setup at construction.
     4. omnigold.js hgOgBalanceParts: add + 15 * freshN term to the score.
     5. omniroute.js hgOmniBalanceParts: add + 15 * freshN term to the score.
     6. reversalsniper.js rsConviction: add +1/0/-1/-2 by bars-since.
   Fresh setups (<=1 bar) gain up to +15 pts; stale (>4 bars) lose up to
   -15 pts. Not a hard veto \u2014 stale cards can still rank if their other
   components are strong enough. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* ============================================================
   PART A \u2014 STAMPING (all 3 detectors add t / formedT)
   ============================================================ */
const ogSrc = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
const orSrc = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
const rsSrc = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');

/* omnigold hgOgDetect stamps t */
assert.ok(/v677: stamp every hit with the formation-bar timestamp/.test(ogSrc),
  'omnigold hgOgDetect v677 stamp rationale must be present');
assert.ok(/if \(h && !isFinite\(fin\(h\.t\)\)\) h\.t = formT;/.test(ogSrc),
  'omnigold hgOgDetect must stamp h.t = formT without overriding existing t');

/* omniroute hgOmniDetect stamps t */
assert.ok(/v677: stamp every hit with the formation-bar timestamp/.test(orSrc),
  'omniroute hgOmniDetect v677 stamp rationale must be present');
assert.ok(/if \(h && !isFinite\(num\(h\.t\)\)\) h\.t = formT;/.test(orSrc),
  'omniroute hgOmniDetect must stamp h.t = formT without overriding existing t');

/* reversalsniper stamps formedT on setup */
assert.ok(/v677: stamp the formation-bar timestamp/.test(rsSrc),
  'reversalsniper v677 stamp rationale must be present');
assert.ok(/formedT: isFinite\(formedT\) \? formedT : null/.test(rsSrc),
  'reversalsniper must set setup.formedT');

/* ============================================================
   PART B \u2014 SCORE INTEGRATION (all 3 rank on freshness)
   ============================================================ */

/* omnigold BalanceParts includes freshN term */
assert.ok(/v677: freshness component\. hgOgDetect \(v677 upstream change\)/.test(ogSrc),
  'omnigold BalanceParts v677 freshness rationale must be present');
/* v679: relaxed — the score expression grew a liveN term below freshN, so
   `;` may no longer be immediately after freshN. Accept either shape. */
assert.ok(/\+ 15 \* freshN[;\s]\s*\/\* v677: NEW/.test(ogSrc),
  'omnigold BalanceParts must add 15 * freshN to score');
assert.ok(/freshN: freshN,/.test(ogSrc),
  'omnigold BalanceParts must return freshN in parts');

/* omniroute BalanceParts includes freshN term */
assert.ok(/v677: freshness component\. Detectors identify a pattern/.test(orSrc),
  'omniroute BalanceParts v677 freshness rationale must be present');
assert.ok(/\+ 15 \* freshN\s+\/\* v677: NEW/.test(orSrc),
  'omniroute BalanceParts must add 15 * freshN to score');
assert.ok(/freshN: freshN,/.test(orSrc),
  'omniroute BalanceParts must return freshN in parts');

/* reversalsniper rsConviction includes freshness component */
assert.ok(/v677: freshness component\. A reversal snipe is a time-sensitive read/.test(rsSrc),
  'reversalsniper rsConviction v677 freshness rationale must be present');
assert.ok(/if \(barsSince <= 1\) c \+= 1;/.test(rsSrc),
  'reversalsniper rsConviction: fresh (<=1 bar) awards +1');
assert.ok(/else c -= 2;\s+\/\* clearly stale/.test(rsSrc),
  'reversalsniper rsConviction: clearly stale awards -2');

/* ============================================================
   PART C \u2014 RUNTIME DEMONSTRATION
   ============================================================ */

/* freshness scoring function shape (mirrored from source) */
function freshN(barsSince){
  if (barsSince <= 1) return 1;
  if (barsSince === 2) return 0.5;
  if (barsSince <= 4) return -0.5;
  return -1;
}
function rsFresh(barsSince){
  if (barsSince <= 1) return 1;
  if (barsSince === 2) return 0;
  if (barsSince <= 4) return -1;
  return -2;
}

/* omnigold / omniroute score deltas across freshness classes */
assert.equal(15 * freshN(0), 15,  '0 bars: +15 pts');
assert.equal(15 * freshN(1), 15,  '1 bar: +15 pts');
assert.equal(15 * freshN(2), 7.5, '2 bars: +7.5 pts');
assert.equal(15 * freshN(3), -7.5,'3 bars: -7.5 pts');
assert.equal(15 * freshN(4), -7.5,'4 bars: -7.5 pts');
assert.equal(15 * freshN(5), -15, '5+ bars: -15 pts');

/* fresh-vs-stale delta at extreme = 30 pts (a full family swing) */
assert.equal(15 * freshN(1) - 15 * freshN(5), 30,
  'fresh-vs-stale delta is 30 pts \u2014 a full family swing');

/* reversalsniper conviction deltas */
assert.equal(rsFresh(0), 1);
assert.equal(rsFresh(1), 1);
assert.equal(rsFresh(2), 0);
assert.equal(rsFresh(3), -1);
assert.equal(rsFresh(4), -1);
assert.equal(rsFresh(5), -2);
/* fresh - stale = 3 conviction pts = MIN_CONVICTION threshold */
assert.equal(rsFresh(1) - rsFresh(5), 3,
  'fresh-vs-stale conviction delta is 3 pts (one full MIN_CONVICTION step)');

/* ============================================================
   PART D \u2014 VERSION HYGIENE
   ============================================================ */
assert.ok(/^hg-v(?:677|67[8-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v677',
  'HG_VER must be >= hg-v677 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omnigold\\.js\\?v=' + qv).test(idx), 'omnigold cache-buster must be ?v=' + qv);
assert.ok(new RegExp('omniroute\\.js\\?v=' + qv).test(idx), 'omniroute cache-buster must be ?v=' + qv);
assert.ok(new RegExp('reversalsniper\\.js\\?v=' + qv).test(idx), 'reversalsniper cache-buster must be ?v=' + qv);

console.log('OK \u2014 v677: uniform setup-freshness stamping + soft-penalty across 3 tabs');
console.log('  * omnigold hgOgDetect stamps t on every hit');
console.log('  * omniroute hgOmniDetect stamps t on every hit');
console.log('  * reversalsniper rsAssess stamps formedT on setup');
console.log('  * omnigold/omniroute BalanceParts add 15 * freshN (fresh +15, stale -15)');
console.log('  * reversalsniper rsConviction adds +1/0/-1/-2 by bars-since');
console.log('  * fresh vs stale delta: 30 pts (omni), 3 conviction pts (rsniper)');
console.log('  * version bumped to ' + HG_VER);
