/* v684: per-gate reasons in the SOLIDITY chip tooltip.

   v683 rendered a chip with a tooltip that just said "Solidity 3/5".
   A trader hovering a MIXED chip had no idea WHICH gate failed. This
   ship expands the tooltip so hovering shows five lines, one per
   gate, each prefixed with a check or cross and a short label.

   Runtime-only. No ranker change, no card layout change. Only the
   title="" attribute string changes; when the helper is missing on
   any tab, the empty-chip behavior from v683 is unchanged. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- helper file has both hgSolidityReasons and updated chip HTML --- */
const solSrc = readFileSync(resolve(ROOT, 'hg-solidity.js'), 'utf8');
assert.ok(/function hgSolidityReasons\(sol\)/.test(solSrc),
  'hgSolidityReasons is defined');
assert.ok(/G\.hgSolidityReasons = hgSolidityReasons/.test(solSrc),
  'hgSolidityReasons exposed on globalThis');
assert.ok(/var reasons = hgSolidityReasons\(sol\);/.test(solSrc),
  'chip calls hgSolidityReasons');
assert.ok(/HG_SOLIDITY_VERSION = 'v(684|68[5-9]|69\d|[7-9]\d\d|\d{4,})'/.test(solSrc),
  'helper version stamped >= v684');

/* --- runtime evaluation of the helper module --- */
const fakeG = {};
const buildFn = new Function('window', `
  var globalThis = window;
  ${solSrc}
  return window;
`);
const api = buildFn(fakeG);
assert.equal(typeof api.hgSolidityReasons, 'function');
assert.equal(typeof api.hgSolidityChipHtml, 'function');

const grade = api.hgSolidityGrade;
const reasons = api.hgSolidityReasons;
const chip = api.hgSolidityChipHtml;

/* --- Case A: SOLID plan produces 5 lines, all checks --- */
{
  const p = {
    dir: 'long', rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'fresh', tape: 'long', stopWidened: false
  };
  const g = grade(p);
  const r = reasons(g);
  const lines = r.split('\n');
  assert.equal(lines.length, 6, 'six lines (v685 added G6)');
  for (const line of lines){
    assert.ok(line.startsWith('\u2713'), 'every gate passes: ' + line);
  }
  assert.ok(/families: 3 agree/.test(r));
  assert.ok(/live-price: fresh/.test(r));
  assert.ok(/tape: long/.test(r));
  assert.ok(/rr: 3\.00R \(floor 2\.00R \+ 0\.25\)/.test(r));
  assert.ok(/stop: natural structure/.test(r));
}

/* --- Case B: WEAK plan produces 5 crosses --- */
{
  const p = {
    dir: 'long', rr1: 1.9, minRr: 2.0,
    consensus: { nAgree: 1 },
    liveGrade: 'past-stop', tape: 'short', stopWidened: true
  };
  const g = grade(p);
  const r = reasons(g);
  const lines = r.split('\n');
  assert.equal(lines.length, 6);
  /* v685: G6 measured-edge passes because no tab/kind was provided
     (no-lookup). Five gates should fail, one (G6) passes. */
  const failCount = lines.filter(l => l.startsWith('\u2717')).length;
  const passCount = lines.filter(l => l.startsWith('\u2713')).length;
  assert.equal(failCount, 5, 'five gates fail');
  assert.equal(passCount, 1, 'G6 passes (no-lookup)');
  assert.ok(/live-price: past-stop/.test(r));
  assert.ok(/tape: short/.test(r), 'tape adverse');
  assert.ok(/stop: widened to v681 floor/.test(r));
  assert.ok(/\u2713 measured-edge: no data/.test(r), 'G6 no-lookup shows no data');
}

/* --- Case C: MIXED plan shows a mix of checks and crosses --- */
{
  const p = {
    dir: 'long', rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'past-t1',  /* fails G2 */
    tape: 'short',         /* fails G3 */
    stopWidened: false
  };
  const g = grade(p);
  const r = reasons(g);
  const lines = r.split('\n');
  assert.equal(lines.length, 6);
  /* v685: G6 measured-edge passes because no tab/kind was provided
     (no-lookup). So the pass count includes G6. */
  const passLines = lines.filter(l => l.startsWith('\u2713'));
  const failLines = lines.filter(l => l.startsWith('\u2717'));
  assert.equal(passLines.length, 4, 'four gates pass (v685: G6 no-lookup adds one)');
  assert.equal(failLines.length, 2, 'two gates fail');
  assert.ok(/\u2717 live-price: past-t1/.test(r));
  assert.ok(/\u2717 tape: short/.test(r));
}

/* --- Case D: chip title attribute encodes newlines as &#10; --- */
{
  const p = {
    dir: 'long', rr1: 3.0, minRr: 2.0,
    consensus: { nAgree: 3 },
    liveGrade: 'fresh', tape: 'long', stopWidened: false
  };
  const g = grade(p);
  const html = chip(g);
  assert.ok(/title="/.test(html));
  /* Chip must encode the newlines as &#10; (not raw \n) so the browser\n     preserves them in the native tooltip. */
  const titleMatch = html.match(/title="([^"]*)"/);
  assert.ok(titleMatch, 'title attribute extracted');
  const titleValue = titleMatch[1];
  assert.ok(/&#10;/.test(titleValue), 'newlines encoded as &#10;');
  assert.ok(!/\n/.test(titleValue), 'no raw newlines in title attribute');
  assert.ok(/Solidity 6\/6/.test(titleValue), 'score header preserved (v685: 6-gate scale)');
  assert.ok(/families: 3 agree/.test(titleValue), 'gate reason present in title');
}

/* --- Case E: no gates object -> empty reasons (safe fallback) --- */
{
  assert.equal(reasons(null), '');
  assert.equal(reasons({}), '');
  assert.equal(reasons({ grade: 'SOLID', score: 5 }), '',
    'no gates object -> empty');
}

/* --- Case F: partial gates object (missing G4/G5) --- */
{
  const partial = {
    grade: 'MIXED', score: 3,
    gates: {
      families: { pass: true, n: 2, source: 'consensus.nAgree' },
      liveFresh: { pass: false, grade: 'past-entry' },
      tape: { pass: true, tape: 'long' }
      /* rr and stop missing */
    }
  };
  const r = reasons(partial);
  const lines = r.split('\n');
  assert.equal(lines.length, 6, 'always six lines (v685)');
  assert.ok(/\u2713 families: 2 agree/.test(r));
  assert.ok(/\u2717 live-price: past-entry/.test(r));
  assert.ok(/\u2717 rr: \?R \(floor \?R/.test(r), 'missing rr shows ?');
  assert.ok(/\u2717 stop: natural structure/.test(r), 'missing stop defaults');
}

/* --- Case G: chip HTML properly HTML-encodes special chars in title --- */
{
  /* Force a value with a double-quote (won't happen in practice, but the
     encoder must be defensive). */
  const g = {
    grade: 'GOOD', score: 4,
    gates: {
      families: { pass: true, n: 3, source: 'con"sensus' /* injected quote */ },
      liveFresh: { pass: true, grade: 'fresh' },
      tape: { pass: true, tape: 'long' },
      rr: { pass: true, rr: 3.0, floor: 2.0 },
      stop: { pass: true, widened: false }
    }
  };
  const html = chip(g);
  /* No raw " in the title attribute value */
  const titleMatch = html.match(/title="([^"]*)"/);
  assert.ok(titleMatch);
  assert.ok(!/"/.test(titleMatch[1]), 'no raw double-quote in title value');
  assert.ok(/&quot;/.test(titleMatch[1]), 'double-quote encoded as &quot;');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:684|68[5-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v684',
  'HG_VER must be >= hg-v684 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('hg-solidity\\.js\\?v=' + qv).test(idx),
  'index.html hg-solidity.js cache-buster must be ?v=' + qv);

console.log('OK - v684: per-gate reasons in SOLIDITY chip tooltip');
console.log('  * A: SOLID -> five ok lines');
console.log('  * B: WEAK  -> five cross lines');
console.log('  * C: MIXED -> mix of pass/fail');
console.log('  * D: title attribute encodes \\n as &#10;');
console.log('  * E: no gates -> empty reasons');
console.log('  * F: partial gates -> five lines, unknown fields defaulted');
console.log('  * G: double-quote in gate value -> encoded as &quot;');
console.log('  * version bumped to ' + HG_VER);
