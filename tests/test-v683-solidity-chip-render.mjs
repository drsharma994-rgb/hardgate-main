/* v683: render the SOLIDITY chip on cards across all three tabs.

   v682 computed the 5-gate solidity grade but never showed it. The user
   had no way to know which cards passed the gate versus which snuck
   through the fallback. This ship surfaces the chip in each tab's card
   head line, so every card shows one of SOLID / GOOD / MIXED / THIN /
   WEAK inline. Uses the existing hgSolidityChipHtml helper.

   Cannot regress. Every chip render is inside a try/catch and
   feature-checked; helper missing = empty string appended, card
   otherwise identical. No card is ever hidden or rewritten. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- 1. helper still present and unchanged --- */
const solSrc = readFileSync(resolve(ROOT, 'hg-solidity.js'), 'utf8');
assert.ok(/hgSolidityChipHtml/.test(solSrc), 'chip helper defined');
assert.ok(/HG_SOLIDITY_VERSION = 'v(682|68[3-9]|69\d|[7-9]\d\d|\d{4,})'/.test(solSrc), 'helper version stamped >= v682');

/* --- 2. all three tabs render the chip in their card head --- */
const omniroute = readFileSync(resolve(ROOT, 'omniroute.js'), 'utf8');
const omnigold = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');
const rsniper = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');

/* omniroute */
assert.ok(/v683: render the shared SOLIDITY chip/.test(omniroute),
  'omniroute v683 comment');
assert.ok(/if \(c\.solGrade && Wc && typeof Wc\.hgSolidityChipHtml === 'function'\)/.test(omniroute),
  'omniroute feature-check pattern');
assert.ok(/solChip = Wc\.hgSolidityChipHtml\(c\.solGrade\);/.test(omniroute),
  'omniroute chip call');
assert.ok(/\(solChip \? ' ' \+ solChip : ''\)/.test(omniroute),
  'omniroute appends chip conditionally');

/* omnigold */
assert.ok(/v683: render the shared SOLIDITY chip/.test(omnigold),
  'omnigold v683 comment');
assert.ok(/if \(row\.solidity && Wc && typeof Wc\.hgSolidityChipHtml === 'function'\)/.test(omnigold),
  'omnigold feature-check pattern');
assert.ok(/solChip = Wc\.hgSolidityChipHtml\(row\.solidity\);/.test(omnigold),
  'omnigold chip call');

/* reversalsniper */
assert.ok(/v683: render the shared SOLIDITY chip/.test(rsniper),
  'rsniper v683 comment');
assert.ok(/if \(r && r\.solidity && typeof W\.hgSolidityChipHtml === 'function'\)/.test(rsniper),
  'rsniper feature-check pattern');
assert.ok(/solChip = W\.hgSolidityChipHtml\(r\.solidity\);/.test(rsniper),
  'rsniper chip call');

/* --- 3. every render is inside a try/catch --- */
for (const [name, src] of [['omniroute', omniroute], ['omnigold', omnigold], ['rsniper', rsniper]]){
  const chipBlock = src.match(/v683: render the shared SOLIDITY chip[\s\S]{0,600}?catch\(eSc\)\{\}/);
  assert.ok(chipBlock, name + ': try/catch must wrap chip render');
}

/* --- 4. runtime: chip helper produces expected HTML for each grade --- */
const fakeG = {};
const buildFn = new Function('window', `
  var globalThis = window;
  ${solSrc}
  return window;
`);
const api = buildFn(fakeG);
const chip = api.hgSolidityChipHtml;

/* SOLID */
{
  const html = chip({ grade: 'SOLID', score: 5 });
  assert.ok(/gpip ok/.test(html), 'SOLID -> ok class');
  assert.ok(/SOLIDITY SOLID/.test(html));
  /* v685: max was 6. v687: max is 7. Widened to accept /5, /6, or /7. */
  assert.ok(/title="Solidity 5\/[567](&#10;[\s\S]*)?"/.test(html), 'SOLID score tooltip (score 5 shown as 5/N where N is the scale)');
}
/* GOOD */
{
  const html = chip({ grade: 'GOOD', score: 4 });
  assert.ok(/gpip ok/.test(html), 'GOOD -> ok class');
  assert.ok(/SOLIDITY GOOD/.test(html));
}
/* MIXED */
{
  const html = chip({ grade: 'MIXED', score: 3 });
  assert.ok(/gpip caution/.test(html), 'MIXED -> caution class');
  assert.ok(/SOLIDITY MIXED/.test(html));
}
/* THIN */
{
  const html = chip({ grade: 'THIN', score: 2 });
  assert.ok(/gpip veto/.test(html), 'THIN -> veto class');
  assert.ok(/SOLIDITY THIN/.test(html));
}
/* WEAK */
{
  const html = chip({ grade: 'WEAK', score: 1 });
  assert.ok(/gpip veto/.test(html), 'WEAK -> veto class');
  assert.ok(/SOLIDITY WEAK/.test(html));
}
/* empty/missing solidity -> empty HTML */
{
  assert.equal(chip(null), '', 'null solidity -> empty');
  assert.equal(chip({}), '', 'missing grade -> empty');
  assert.equal(chip(undefined), '', 'undefined -> empty');
}

/* --- 5. version + cache-buster --- */
assert.ok(/^hg-v(?:683|68[4-9]|69\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v683',
  'HG_VER must be >= hg-v683 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omniroute\\.js\\?v=' + qv).test(idx),
  'index.html omniroute.js cache-buster must be ?v=' + qv);
assert.ok(new RegExp('omnigold\\.js\\?v=' + qv).test(idx));
assert.ok(new RegExp('reversalsniper\\.js\\?v=' + qv).test(idx));

console.log('OK - v683: SOLIDITY chip rendered on cards across all three tabs');
console.log('  * omniroute: chip in hg-mp-head');
console.log('  * omnigold: chip in hg-mp-head');
console.log('  * rsniper: chip in card chead');
console.log('  * SOLID/GOOD -> gpip ok');
console.log('  * MIXED -> gpip caution');
console.log('  * THIN/WEAK -> gpip veto');
console.log('  * feature-checked in every tab (missing helper = no chip)');
console.log('  * every render inside try/catch');
console.log('  * empty/missing solidity -> empty HTML');
console.log('  * version bumped to ' + HG_VER);
