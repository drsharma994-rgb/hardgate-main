/* v655: SIGNAL LOG - CSV export + filter persistence.

   Two related quality-of-life wins:

   1. Filter state persists to localStorage under 'hgSignalLogFilters',
      independent from the journal key. Reload preserves the last
      source/direction/symbol filter. Unknown-source entries in stored
      state are dropped (guards against a stale SOURCES entry).

   2. New EXPORT CSV button emits the CURRENTLY FILTERED rows as a
      properly-quoted (RFC 4180) UTF-8 CSV with BOM, timestamped
      filename, three flat gate columns (pass count / total / veto ids)
      so it opens usefully in Excel/Sheets without hand-parsing the
      badge. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* ------- filter persistence ------- */
assert.ok(/var LS_FILTERS_KEY = 'hgSignalLogFilters';/.test(sl),
  'LS_FILTERS_KEY constant required');
assert.ok(/function __lsReadFilters\(\)/.test(sl),
  '__lsReadFilters helper required');
assert.ok(/function __lsWriteFilters\(f\)/.test(sl),
  '__lsWriteFilters helper required');
/* the writer must serialise the Set as an array */
assert.ok(/Array\.from\(f\.sources\)/.test(sl),
  'writer must serialise the Set as an array');
/* filter init must be an IIFE that hydrates from stored state */
assert.ok(/var __filters = \(function initFilters\(\)\{/.test(sl),
  '__filters must be initialised by an IIFE that hydrates from storage');
/* unknown-source guard: only accept ids currently in SOURCES */
assert.ok(/only accept known sources so a stale storage entry/.test(sl),
  'stale-source guard comment required');
assert.ok(/known\[stored\.sources\[j\]\]/.test(sl),
  'stored source ids must be filtered against a `known` lookup');
/* dir whitelist */
assert.ok(/stored\.dir === 'long' \|\| stored\.dir === 'short' \|\| stored\.dir === 'all'/.test(sl),
  'stored direction must be whitelisted before adoption');
/* q length cap so a runaway paste can\u2019t break the input */
assert.ok(/stored\.q\.slice\(0, 20\)/.test(sl),
  'stored q must be length-capped');
assert.ok(/function persistFilters\(\)\{ __lsWriteFilters\(__filters\); \}/.test(sl),
  'persistFilters() convenience wrapper required');
/* the three chip handlers must call persistFilters() */
const persistCalls = (sl.match(/persistFilters\(\);\s*\/\* v655 \*\//g) || []).length;
assert.ok(persistCalls >= 3,
  'persistFilters must be called from all three handlers (source/dir/q); saw ' + persistCalls);
/* mount must repaint chips + populate search input from stored state */
assert.ok(/if \(__ui\.q && __filters\.q\) __ui\.q\.value = __filters\.q;/.test(sl),
  'mount must paint the search input with stored q');
assert.ok(/v655: paint chips \+ search box with the stored filter state/.test(sl),
  'mount must include v655 repaint comment');

/* ------- CSV export ------- */
assert.ok(/function csvEscape\(v\)/.test(sl),
  'csvEscape helper required');
assert.ok(/function gateColsFromEntry\(e\)/.test(sl),
  'gateColsFromEntry helper required');
assert.ok(/function buildCsv\(entries\)/.test(sl),
  'buildCsv function required');
assert.ok(/function csvFilename\(\)/.test(sl),
  'csvFilename helper required');
assert.ok(/function exportFilteredCsv\(\)/.test(sl),
  'exportFilteredCsv function required');
/* header row must be exact + in this order */
assert.ok(
  /header = \['time','source','symbol','dir','tierOrGrade','entry','stop','t1',[\s\S]{0,80}'maeR','mfeR','gatesPass','gatesTotal','gatesVeto','note'\]/.test(sl),
  'CSV header must list all 14 columns in the documented order');
/* RFC 4180 quoting: quotes doubled + wrap only when required */
assert.ok(/return '"' \+ s\.replace\(\/"\/g, '""'\) \+ '"';/.test(sl),
  'csvEscape must double quotes and wrap in double quotes');
/* export uses currently-filtered rows */
assert.ok(/var rows = applyFilters\(__journal\);/.test(sl),
  'exportFilteredCsv must operate on filtered rows');
/* empty-filter path: user-visible message, no download */
assert.ok(/nothing to export \u2014 the current filter matches zero rows/.test(sl),
  'empty-filter export must surface a status message');
/* BOM so Excel opens UTF-8 correctly */
assert.ok(/'\\ufeff' \+ csv/.test(sl),
  'CSV blob must be prefixed with a UTF-8 BOM');
assert.ok(/new Blob\(\[[\s\S]{0,40}csv[\s\S]{0,80}text\/csv;charset=utf-8/.test(sl),
  'CSV Blob must use the csv MIME type with utf-8 charset');
/* revoke pattern */
assert.ok(/URL\.revokeObjectURL\(url\)/.test(sl),
  'blob URL must be revoked after download');
/* button wiring */
assert.ok(/id="slExport"/.test(sl),
  'EXPORT CSV button must have id=slExport');
assert.ok(/EXPORT CSV/.test(sl),
  'EXPORT CSV button text must be present');
assert.ok(/export_:\s*el\.querySelector\('#slExport'\)/.test(sl),
  '__ui.export_ must reference the button');
assert.ok(/__ui\.export_\.addEventListener\('click', function\(\)\{ exportFilteredCsv\(\); \}\)/.test(sl),
  'EXPORT CSV button must be wired to exportFilteredCsv');

/* ------- runtime CSV sanity ------- */
/* Extract the three helpers and execute them to make sure the output shape
   is correct for a hand-crafted mixed-row input. */
const m1 = sl.match(/function csvEscape[\s\S]*?^\}/m)[0];
const m2 = sl.match(/function gateColsFromEntry[\s\S]*?^\}/m)[0];
const m3 = sl.match(/function buildCsv[\s\S]*?^\}/m)[0];
const sandbox = {};
new Function('module', m1 + m2 + m3 + '; module.exports = { csvEscape, gateColsFromEntry, buildCsv };')(sandbox);
const { csvEscape, gateColsFromEntry, buildCsv } = sandbox.exports;
assert.equal(csvEscape('plain'), 'plain', 'plain string is not quoted');
assert.equal(csvEscape('has, comma'), '"has, comma"', 'comma triggers quoting');
assert.equal(csvEscape('with "quote"'), '"with ""quote"""', 'double-quotes are escaped');
assert.equal(csvEscape(null), '', 'null becomes empty');
const gc = gateColsFromEntry({ gateMeta: [
  { id:'G1', state:'pass' }, { id:'G6', state:'veto' }, { id:'G7', state:'pass' } ] });
assert.equal(gc.pass, 2, 'gate pass count');
assert.equal(gc.total, 3, 'gate total count');
assert.equal(gc.vetos, 'G6', 'veto ids space-separated');
const csv = buildCsv([
  { t:'2026-09-08T02:00Z', source:'cswing', sym:'BTCUSD', dir:'long',
    tierOrGrade:'A', entry:60500, stop:60100, t1:61400, maeR:-0.3, mfeR:1.2,
    note:'ev, "quoted"',
    gateMeta:[{id:'G1',state:'pass'},{id:'G6',state:'veto'}] }
]);
assert.ok(csv.startsWith('time,source,symbol,dir,tierOrGrade,entry,stop,t1,maeR,mfeR,gatesPass,gatesTotal,gatesVeto,note\r\n'),
  'CSV header line must be first and CRLF terminated');
assert.ok(csv.includes('cswing,BTCUSD,long,A,60500,60100,61400,-0.3,1.2,1,2,G6,"ev, ""quoted"""'),
  'CSV row must serialise correctly with quoted note');
assert.ok(csv.endsWith('\r\n'), 'CSV must terminate with CRLF');

/* ------- version ------- */
assert.ok(/^hg-v(?:655|65[6-9]|66\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v655 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v655: SIGNAL LOG CSV export + filter persistence');
console.log('  * filter state persists under hgSignalLogFilters (independent key)');
console.log('  * mount hydrates chips + search box from stored state');
console.log('  * stale-source ids in storage are silently dropped');
console.log('  * EXPORT CSV button emits UTF-8 BOM CSV with RFC 4180 quoting');
console.log('  * gate ledger flattened to 3 columns (pass / total / veto ids)');
console.log('  * export uses currently-filtered rows so filter + export compose');
console.log('  * runtime CSV shape verified against hand-crafted rows');
console.log('  * version bumped to ' + HG_VER);
