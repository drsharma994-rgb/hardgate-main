/* Pack 2 slice 4 addendum: cryptogates try-clean outputs and index.html
   hgCryptoCandRow both propagate gateMeta so SIGNAL LOG can render
   per-gate summaries via W.hgGateSummary. Without this addendum the
   readers wired by slice 4 saw undefined gateMeta on every cand row. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const cg = readFileSync(resolve(ROOT, 'cryptogates.js'), 'utf8');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* --- swingTryClean must include gateMeta in its returned out object --- */
const swingBlock = cg.match(/function swingTryClean\([\s\S]{0,4000}?\n  \}/);
assert.ok(swingBlock, 'could not extract swingTryClean');
assert.ok(/gateMeta:\s*m\.gateMeta/.test(swingBlock[0]),
  'swingTryClean out object must include gateMeta: m.gateMeta');

/* --- scalpTryClean must include gateMeta in its returned out object --- */
const scalpBlock = cg.match(/function scalpTryClean\([\s\S]{0,4000}?\n  \}/);
assert.ok(scalpBlock, 'could not extract scalpTryClean');
assert.ok(/gateMeta:\s*m\.gateMeta/.test(scalpBlock[0]),
  'scalpTryClean out object must include gateMeta: m.gateMeta');

/* --- hgCryptoCandRow must copy hit.gateMeta onto the published row --- */
const candRow = idx.match(/function hgCryptoCandRow\([\s\S]{0,2000}?\n\}/);
assert.ok(candRow, 'could not extract hgCryptoCandRow');
assert.ok(/hit\.gateMeta[\s\S]{0,200}row\.gateMeta\s*=\s*hit\.gateMeta/.test(candRow[0]),
  'hgCryptoCandRow must copy hit.gateMeta onto row.gateMeta');
assert.ok(/Array\.isArray\(hit\.gateMeta\)/.test(candRow[0]),
  'hgCryptoCandRow guard must use Array.isArray for safety');

/* --- version bump: build-stamp.js and sw.js must agree --- */
/* v646: read the version through the helper so version bumps don't break
   this test suite. Slice 4 addendum shipped in v645; v646 fixes are
   independent and each release afterwards keeps advancing the number. */
const { HG_VER } = await import('./helpers/build-version.mjs');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(/^hg-v(?:645|64[6-9]|65\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  `build-stamp.js version must be ≥ hg-v645 (saw ${HG_VER})`);
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  `sw.js HG_CACHE must match build-stamp version ${HG_VER}`);

console.log('OK \u2014 Pack 2 slice 4 addendum: gateMeta propagates end-to-end');
console.log('  * swingTryClean out.gateMeta \u2190 m.gateMeta');
console.log('  * scalpTryClean out.gateMeta \u2190 m.gateMeta');
console.log('  * hgCryptoCandRow row.gateMeta \u2190 hit.gateMeta (Array.isArray guarded)');
console.log('  * build-stamp.js + sw.js on ' + HG_VER + ' (≥ hg-v645 for slice 4 addendum)');
