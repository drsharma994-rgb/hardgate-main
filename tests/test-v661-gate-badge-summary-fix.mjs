/* v661: gate ledger badge summary count must equal the number of dots.

   The badge renders one dot per gateMeta entry (skipping only null /
   non-object entries) AND a summary count `pass/total` in the label
   pill. Prior to v661, the counter had a subtle bug:

     for (var i = 0; i < gateMeta.length; i++){
       var s = gateMeta[i] && String(gateMeta[i].state || '').toLowerCase();
       if (s === 'pass') pass++;
       if (s === 'pass' || s === 'veto' || s === 'na') total++;   // <-- bug
     }

   `total` only incremented for the three known states. Any unexpected
   `state` (a null default coming from a slice, a future value, a typo)
   would render a dot (state defaults to 'na' at render time) but drop
   silently out of the denominator. Result: badges like '2/1' with 3
   visible dots \u2014 a real trust-breaker for a signal-log column.

   Post-v661:
     * The counter loop matches the dot-render predicate (skip only
       null / non-object entries), so total ALWAYS equals dot count.
     * State classification is loose \u2014 anything not 'pass' is not a
       pass, matching how the render already falls through to 'na'. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'setup-ui.js'), 'utf8');

/* --- the rationale must live in a comment so future edits know why --- */
assert.ok(/v661: summary count must equal the number of dots visible/.test(src),
  'v661 rationale comment must be present on the counter loop');

/* --- old, buggy pattern must be gone --- */
assert.ok(!/if \(s === 'pass' \|\| s === 'veto' \|\| s === 'na'\) total\+\+;/.test(src),
  'stale v650 counter that only counted known states must be removed');

/* --- new counter matches the dot-render predicate --- */
assert.ok(
  /for \(var i = 0; i < gateMeta\.length; i\+\+\)\{\s*var g = gateMeta\[i\];\s*if \(!g \|\| typeof g !== 'object'\) continue;\s*total\+\+;/.test(src),
  'new counter loop must skip null/non-object then always total++');
assert.ok(
  /var s = String\(g\.state \|\| 'na'\)\.toLowerCase\(\);\s*if \(s === 'pass'\) pass\+\+;/.test(src),
  'state classification must default to na, only pass increments pass count');

/* --- runtime behavior: extract hgGateLedgerBadge and run against a wire\n     of hand-crafted gateMeta lists so the count is truly correct. This\n     requires stubbing suEsc + W which the module expects on load. --- */
const suEscMatch = src.match(/function suEsc\([\s\S]*?\n\}/);
assert.ok(suEscMatch, 'suEsc helper must be present in setup-ui.js');
const suEscFn = suEscMatch[0];
const helperMatch = src.match(/function hgGateLedgerBadge\(gateMeta, opts\)\{[\s\S]*?^\}/m);
assert.ok(helperMatch, 'hgGateLedgerBadge function must be present in setup-ui.js');
const helperFn = helperMatch[0];

const sandbox = {};
new Function('module',
  suEscFn + '\n' + helperFn + '\nmodule.exports = { hgGateLedgerBadge };'
)(sandbox);
const { hgGateLedgerBadge } = sandbox.exports;

/* Count dots in an assembled HTML string, count denominator in the label. */
function badgeStats(html){
  const dots = (html.match(/class="hg-gld-dot /g) || []).length;
  const m = html.match(/hg-gld-lbl">(\d+)\/(\d+)</);
  return { dots, pass: m ? +m[1] : null, total: m ? +m[2] : null };
}

/* case 1: three well-known states \u2014 count matches, no regression */
let s = badgeStats(hgGateLedgerBadge([
  { id:'G1', label:'g1', state:'pass' },
  { id:'G6', label:'g6', state:'veto' },
  { id:'G7', label:'g7', state:'na' }
]));
assert.equal(s.dots, 3);
assert.equal(s.pass, 1);
assert.equal(s.total, 3, '3 known states -> total should be 3');

/* case 2: THE FIX \u2014 an unexpected state string still counts */
s = badgeStats(hgGateLedgerBadge([
  { id:'G1', label:'g1', state:'pass' },
  { id:'G6', label:'g6', state:'unknown_state' },
  { id:'G7', label:'g7', state:'pass' }
]));
assert.equal(s.dots, 3, 'all three render a dot');
assert.equal(s.pass, 2, 'two passes');
assert.equal(s.total, 3, 'total MUST equal dot count \u2014 pre-v661 this returned 2');

/* case 3: missing state defaults to na and is counted */
s = badgeStats(hgGateLedgerBadge([
  { id:'G1', label:'g1' },
  { id:'G2', label:'g2', state:'pass' }
]));
assert.equal(s.dots, 2);
assert.equal(s.pass, 1);
assert.equal(s.total, 2);

/* case 4: null / non-object entries are still skipped (not in dots, not in count) */
s = badgeStats(hgGateLedgerBadge([
  { id:'G1', label:'g1', state:'pass' },
  null,
  'not an object',
  { id:'G2', label:'g2', state:'veto' }
]));
assert.equal(s.dots, 2, 'null + string entries must not render a dot');
assert.equal(s.pass, 1);
assert.equal(s.total, 2, 'total must equal dot count, ignoring the bad entries');

/* case 5: empty / non-array \u2014 no badge */
assert.equal(hgGateLedgerBadge([]), '', 'empty array -> empty string');
assert.equal(hgGateLedgerBadge(null), '', 'null -> empty string');
assert.equal(hgGateLedgerBadge('nope'), '', 'non-array -> empty string');

/* --- version --- */
assert.ok(/^hg-v(?:661|66[2-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v661',
  'HG_VER must be >= hg-v661 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v661: gate ledger badge summary count fixed');
console.log('  * total denominator now always equals dot count');
console.log('  * unexpected state strings render a dot AND count in total');
console.log('  * null / non-object entries stay skipped in both dots + count');
console.log('  * pass counter classifies loosely (anything not pass falls through)');
console.log('  * runtime verified against 5 hand-crafted gateMeta shapes');
console.log('  * version bumped to ' + HG_VER);
