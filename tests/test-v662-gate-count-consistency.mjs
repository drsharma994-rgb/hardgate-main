/* v662: consistency fix - `total` in gateSummary + computeStats must
   pair with the same skip predicate as the pass loop.

   Same bug pattern as v661 (fixed in hgGateLedgerBadge). Two more sites
   in signallog.js had it:

     1. gateSummary(meta)
        Used `total = meta.length` while the loop skipped
        null/non-object entries. A shape like
        [{pass},{pass},null,undefined] produced '2/4 pass' with two
        phantom slots the user can never inspect via the badge.

     2. computeStats(rows) - gate accumulators inside the per-row block
        Used `gatesTotalSum += e.gateMeta.length` while the loop skipped
        null gate entries. avg gates X/Y in the stats strip could inflate
        the /Y side with phantom slots.

   Fix in both cases:
     * Introduce a local `total` (or `tot`) that increments only when the
       pass loop's skip predicate would keep the entry.
     * Reject an empty-after-filter result upfront (return '' for
       gateSummary; skip the gatesN++ accumulation for computeStats). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* --- gateSummary: rationale comment + new counter shape --- */
assert.ok(/v662: pair the total count with the pass loop \u2014 same bug pattern v661/.test(src),
  'gateSummary must include v662 rationale comment');
assert.ok(/var pass = 0, total = 0, blocked = \[\];/.test(src),
  'gateSummary must declare total = 0 (not derived from meta.length)');
assert.ok(!/var total = meta\.length;/.test(src),
  'stale `total = meta.length` line must be gone from gateSummary');
assert.ok(/if \(!total\) return '';/.test(src),
  'gateSummary must return empty when filter yields zero entries');

/* --- computeStats: rationale comment + local tot --- */
assert.ok(/v662: total for this row must match the pass loop's skip predicate/.test(src),
  'computeStats gate block must include v662 rationale comment');
assert.ok(/var pass = 0, tot = 0;/.test(src),
  'computeStats gate loop must declare local tot = 0');
assert.ok(/if \(!gm \|\| typeof gm !== 'object'\) continue;\s*tot\+\+;/.test(src),
  'computeStats gate loop must skip null/non-object THEN tot++');
assert.ok(!/gatesTotalSum \+= e\.gateMeta\.length;/.test(src),
  'stale `gatesTotalSum += e.gateMeta.length` line must be gone');
assert.ok(/if \(tot\)\{\s*gatesPassSum \+= pass;\s*gatesTotalSum \+= tot;\s*gatesN\+\+;\s*\}/.test(src),
  'computeStats must only accumulate when tot > 0');

/* --- runtime behavior: extract gateSummary + computeStats + statsLine + fmt helpers --- */
function extract(name){
  const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}', ''));
  assert.ok(m, name + ' must be extractable');
  return m[0];
}
const gateSummary = extract('gateSummary');
const computeStats = extract('computeStats');
const statsLine = extract('statsLine');
const fmt2 = extract('__fmt2');
const fmt1 = extract('__fmt1');
const sandbox = {};
new Function('module',
  gateSummary + '\n' + computeStats + '\n' + statsLine + '\n' + fmt2 + '\n' + fmt1
  + '\nmodule.exports = { gateSummary, computeStats, statsLine };'
)(sandbox);
const { gateSummary: gs, computeStats: cs, statsLine: sl } = sandbox.exports;

/* --- gateSummary cases --- */
/* case A: all clean, 3 passes -> '3/3 pass' */
assert.equal(gs([
  { id:'G1', label:'g1', state:'pass' },
  { id:'G2', label:'g2', state:'pass' },
  { id:'G3', label:'g3', state:'pass' }
]), '3/3 pass');

/* case B: THE FIX - two passes + a null entry.
   pre-v662: '2/3 pass' (WRONG: three total, but pass===total was false so
   the ' pass' suffix would appear iff 2===3 which is false).
   pre-v662 exact string: '2/3'
   post-v662: '2/2 pass' (total matches dot count from the badge) */
assert.equal(gs([
  { id:'G1', label:'g1', state:'pass' },
  { id:'G2', label:'g2', state:'pass' },
  null
]), '2/2 pass');

/* case C: two passes + one veto + a null -> '2/3 \u00b7 blocked: ...' */
const c = gs([
  { id:'G1', label:'G1 cascade', state:'pass' },
  { id:'G6', label:'G6 rr-cap', state:'veto' },
  { id:'G7', label:'g7', state:'pass' },
  null
]);
assert.ok(c.startsWith('2/3 \u00b7 blocked:'),
  'blocked line must lead with correct pass/total; got ' + c);
assert.ok(c.includes('rr-cap'), 'block reason must be stripped of "G6 " prefix');

/* case D: all-null / non-array -> empty string */
assert.equal(gs([null, null, 'nope']), '', 'no real entries -> empty');
assert.equal(gs([]), '', 'empty array -> empty');
assert.equal(gs(null), '', 'null -> empty');

/* --- computeStats cases --- */
/* row 1: 3 real gates, 2 pass; row 2: has null gate entry */
const rows = [
  { dir:'long', maeR:null, mfeR:null, gateMeta:[
    { id:'G1', state:'pass' }, { id:'G2', state:'pass' }, { id:'G3', state:'veto' } ] },
  { dir:'short', maeR:null, mfeR:null, gateMeta:[
    { id:'G1', state:'pass' }, null, { id:'G3', state:'pass' } ] }
];
const stats = cs(rows);
/* Row 1: pass=2, tot=3. Row 2: pass=2, tot=2 (null skipped).
   Aggregates: gatesPassSum=4, gatesTotalSum=5, gatesN=2
   avgGatesPass = 4/2 = 2.0
   avgGatesTotal = 5/2 = 2.5 (NOT 3.0 which would happen pre-v662 via
   e.gateMeta.length=3 for row 2) */
assert.equal(stats.gatesN, 2);
assert.equal(stats.avgGatesPass, 2);
assert.equal(stats.avgGatesTotal, 2.5,
  'pre-v662 would return 3.0 (5+3=6, 6/2) \u2014 must be 2.5');

/* row with only null gates should NOT bump gatesN */
const rows2 = [
  { dir:'long', maeR:null, mfeR:null, gateMeta:[null, null] }
];
const stats2 = cs(rows2);
assert.equal(stats2.gatesN, 0,
  'a row where every gateMeta entry is null must NOT contribute to gatesN');

/* --- statsLine formatting sanity: gates line uses the fixed averages --- */
const line = sl(rows);
assert.ok(line.includes('avg gates 2.0/2.5'),
  'stats line must show avg gates 2.0/2.5 (post-v662); got: ' + line);

/* --- version --- */
assert.ok(/^hg-v(?:662|66[3-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v662',
  'HG_VER must be >= hg-v662 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v662: gate count consistency');
console.log('  * gateSummary total now pairs with the pass loop skip predicate');
console.log('  * computeStats gate accumulators use local tot instead of length');
console.log('  * runtime verified against 6 hand-crafted gateMeta shapes');
console.log('  * statsLine avg gates X/Y correctly shows 2.0/2.5 (was 2.0/3.0)');
console.log('  * version bumped to ' + HG_VER);
