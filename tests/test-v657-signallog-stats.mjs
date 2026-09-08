/* v657: SIGNAL LOG summary stats strip.

   Renders one pipe-separated line above the count note showing:
     N rows | L long / S short | avg maeR | avg mfeR | avg gates X/Y
     | top vetos: G6 (7x), G14 (4x)

   Values are computed over the CURRENTLY FILTERED rows so
   sources/direction/symbol chips slice the stats too. Missing
   maeR/mfeR/gateMeta cells are skipped, not treated as zero. Empty
   filter -> strip is hidden entirely (no empty-stat clutter). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* --- helpers exist --- */
assert.ok(/function __fmt2\(n\)/.test(sl), '__fmt2 helper required');
assert.ok(/function __fmt1\(n\)/.test(sl), '__fmt1 helper required');
assert.ok(/function computeStats\(rows\)/.test(sl), 'computeStats required');
assert.ok(/function statsLine\(rows\)/.test(sl), 'statsLine required');

/* --- null-skipping behavior (must NOT treat missing values as zero) --- */
assert.ok(/typeof e\.maeR === 'number' && isFinite\(e\.maeR\).*?maeSum \+= e\.maeR; maeN\+\+;/.test(sl),
  'computeStats must skip non-finite maeR cells (avg is honest, not zero-padded)');
assert.ok(/typeof e\.mfeR === 'number' && isFinite\(e\.mfeR\).*?mfeSum \+= e\.mfeR; mfeN\+\+;/.test(sl),
  'computeStats must skip non-finite mfeR cells');
assert.ok(/gatesN \? \(gatesPassSum \/ gatesN\) : NaN/.test(sl),
  'avgGatesPass must divide by gatesN (rows WITH gateMeta), not total row count');

/* --- veto tallying is a dictionary + top-2 sort --- */
assert.ok(/vetoCounts\[gm\.id\] = \(vetoCounts\[gm\.id\] \|\| 0\) \+ 1;/.test(sl),
  'veto counts must accumulate by gate id');
assert.ok(/vetoList\.sort\(function\(a, b\)\{ return \(b\.n - a\.n\) \|\| \(a\.id < b\.id/.test(sl),
  'veto sort must be desc by count with deterministic id tie-break');
assert.ok(/vetoList\.slice\(0, 2\)/.test(sl),
  'topVetos exposes at most 2');

/* --- statsLine formatting --- */
assert.ok(/parts = \[s\.n \+ ' row' \+ \(s\.n === 1 \? '' : 's'\)\]/.test(sl),
  'stats line always starts with N row(s)');
assert.ok(/parts\.push\(s\.longs \+ ' long \/ ' \+ s\.shorts \+ ' short'\)/.test(sl),
  'long/short split included when either is > 0');
assert.ok(/parts\.push\('avg maeR ' \+ __fmt2\(s\.avgMae\) \+ 'R'\)/.test(sl),
  'avg maeR line uses __fmt2 with trailing R');
assert.ok(/parts\.push\('avg mfeR ' \+ __fmt2\(s\.avgMfe\) \+ 'R'\)/.test(sl),
  'avg mfeR line uses __fmt2 with trailing R');
assert.ok(/parts\.push\('avg gates ' \+ __fmt1\(s\.avgGatesPass\) \+ '\/' \+ __fmt1\(s\.avgGatesTotal\)\)/.test(sl),
  'avg gates line reports pass/total using __fmt1');
assert.ok(/parts\.push\('top vetos: '/.test(sl),
  'top vetos label present');

/* --- DOM node + render integration --- */
assert.ok(/<div class="sl-stats" id="slStats"/.test(sl),
  '#slStats DOM node must be in mount HTML');
assert.ok(/stats:\s*el\.querySelector\('#slStats'\)/.test(sl),
  '__ui.stats reference required');
assert.ok(/v657: summary stats over the filtered set/.test(sl),
  'render() must include v657 stats comment');
assert.ok(/var line = statsLine\(filtered\);/.test(sl),
  'render() must call statsLine on the filtered array');
assert.ok(/ui\.stats\.style\.display = 'none'/.test(sl),
  'render() must hide the stats strip when filtered is empty');

/* --- CSS --- */
assert.ok(/#tab_signallog \.sl-stats\{/.test(sl),
  '.sl-stats CSS block required');
assert.ok(/font-variant-numeric:tabular-nums/.test(sl),
  'stats strip must use tabular-nums for alignment');

/* --- runtime behavior check --- */
const m1 = sl.match(/function __fmt2[\s\S]*?^\}/m)[0];
const m2 = sl.match(/function __fmt1[\s\S]*?^\}/m)[0];
const m3 = sl.match(/function computeStats[\s\S]*?^\}/m)[0];
const m4 = sl.match(/function statsLine[\s\S]*?^\}/m)[0];
const s = {};
new Function('module', m1 + m2 + m3 + m4 + '; module.exports = { computeStats, statsLine };')(s);
const { computeStats, statsLine } = s.exports;

const rows = [
  { dir:'long', maeR:-0.3, mfeR:1.2, gateMeta:[
      { id:'G1', state:'pass' }, { id:'G6', state:'veto' }, { id:'G7', state:'pass' } ] },
  { dir:'long', maeR:-0.5, mfeR:0.4, gateMeta:[
      { id:'G1', state:'pass' }, { id:'G6', state:'veto' }, { id:'G14', state:'veto' } ] },
  { dir:'short', maeR:-0.2, mfeR:2.0, gateMeta:[
      { id:'G1', state:'pass' }, { id:'G2', state:'pass' }, { id:'G3', state:'pass' } ] },
  { dir:'short', maeR:null, mfeR:null }   /* brain row, no gateMeta */
];
const c = computeStats(rows);
assert.equal(c.n, 4);
assert.equal(c.longs, 2);
assert.equal(c.shorts, 2);
/* mae/mfe average over 3 finite cells (skipping the null one) */
assert.ok(Math.abs(c.avgMae - ((-0.3 + -0.5 + -0.2) / 3)) < 1e-9,
  'avgMae must skip null and divide by 3');
assert.ok(Math.abs(c.avgMfe - ((1.2 + 0.4 + 2.0) / 3)) < 1e-9,
  'avgMfe must skip null and divide by 3');
/* gate averages divide by rows-with-gateMeta (3), not total rows (4) */
assert.equal(c.gatesN, 3);
assert.ok(Math.abs(c.avgGatesPass - ((2 + 1 + 3) / 3)) < 1e-9,
  'avgGatesPass must divide by rows-with-gateMeta');
assert.ok(Math.abs(c.avgGatesTotal - 3) < 1e-9,
  'avgGatesTotal is 3 for every row here');
assert.equal(c.topVetos[0].id, 'G6');
assert.equal(c.topVetos[0].n, 2);
assert.equal(c.topVetos[1].id, 'G14');
assert.equal(c.topVetos[1].n, 1);

const line = statsLine(rows);
assert.ok(line.startsWith('4 rows'), 'line starts with row count');
assert.ok(line.includes('2 long / 2 short'), 'long/short split rendered');
assert.ok(line.includes('avg maeR'), 'avg maeR present');
assert.ok(line.includes('avg mfeR'), 'avg mfeR present');
assert.ok(line.includes('avg gates'), 'avg gates present');
assert.ok(line.includes('top vetos'), 'top vetos present');
assert.ok(line.includes('G6 (2\u00d7)'), 'top veto id + count formatted as G6 (2\u00d7)');

/* empty input -> empty string */
assert.equal(statsLine([]), '', 'empty rows -> empty line');
/* row with no gates, no mae/mfe -> only row count + direction line */
assert.equal(statsLine([{ dir:'long', maeR:null, mfeR:null }]),
  '1 row \u00b7 1 long / 0 short',
  'singular row/no-metrics case must skip empty numeric parts');

/* --- version --- */
assert.ok(/^hg-v(?:657|65[8-9]|66\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v657 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v657: SIGNAL LOG summary stats strip');
console.log('  * computeStats(rows) \u2014 honest averages, skips nulls');
console.log('  * statsLine(rows) \u2014 pipe-separated summary, singular \"row\" handled');
console.log('  * top-2 vetos with deterministic id tie-break');
console.log('  * DOM: #slStats node, __ui.stats ref, render() integration');
console.log('  * CSS: .sl-stats block with tabular-nums for alignment');
console.log('  * hidden when filter matches zero (no empty-stat clutter)');
console.log('  * version bumped to ' + HG_VER);
