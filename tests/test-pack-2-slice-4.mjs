/* Pack 2 slice 4: signallog.js reads gateMeta (from slices 1-3) and
   surfaces per-gate block reasons in the SIGNAL LOG note column.

   The helper contract:
     gateSummary(gateMeta[]) — compact "N/M pass" or
       "N/M · blocked: <label>, <label> +K" string
     edgeVetoNote() — reads edgeSwingBias.lastVetoBlockedBy for the last
       EDGE block reason across the whole session

   Test loads signallog.js as source and exercises the two helpers by
   running them in a minimal sandbox. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const src = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* ------------ static contract checks ------------ */
assert.ok(/function gateSummary\(meta\)/.test(src), 'gateSummary must be defined');
assert.ok(/function edgeVetoNote\(\)/.test(src),   'edgeVetoNote must be defined');
assert.ok(/W\.hgGateSummary\s*=\s*gateSummary/.test(src),
  'gateSummary must be exposed on W.hgGateSummary');
assert.ok(/W\.hgEdgeVetoNote\s*=\s*edgeVetoNote/.test(src),
  'edgeVetoNote must be exposed on W.hgEdgeVetoNote');
assert.ok(/PACK 2 slice 4: prepend gate summary/.test(src),
  'pullers must be wired to prepend gate summary to note');
const pullerWireCount = (src.match(/gateSummary\(/g) || []).length;
assert.ok(pullerWireCount >= 3,
  `expected gateSummary called \u22653 times (definition + 2 pullers), saw ${pullerWireCount}`);

/* ------------ behavioural checks via vm sandbox ------------ */
/* Build a minimal window/global that signallog.js's IIFE will bind to.
   We can't easily eval the whole IIFE (it pulls in DOM, localStorage, etc.),
   so we scrape just the two helper bodies and eval them standalone. */
function extractFn(name){
  var rx = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\}', 'm');
  var m = src.match(rx);
  assert.ok(m, `could not extract ${name} for behavioural test`);
  return m[0];
}
const gateSummarySrc = extractFn('gateSummary');
const edgeVetoNoteSrc = extractFn('edgeVetoNote');

const ctx = { W: {}, result: null };
vm.createContext(ctx);
vm.runInContext(gateSummarySrc + '\nresult = { gateSummary: gateSummary };', ctx);
vm.runInContext(edgeVetoNoteSrc + '\nresult.edgeVetoNote = edgeVetoNote;', ctx);
const { gateSummary, edgeVetoNote } = ctx.result;

/* Empty / invalid input */
assert.equal(gateSummary(null), '', 'null gateMeta \u2192 empty string');
assert.equal(gateSummary([]), '', 'empty gateMeta \u2192 empty string');
assert.equal(gateSummary('nope'), '', 'non-array gateMeta \u2192 empty string');

/* All pass: "7/7 pass" */
const allPass = Array.from({length: 7}, (_, i) => ({
  id: 'G' + (i+1), label: 'G' + (i+1) + ' foo', state: 'pass', detail: ''
}));
assert.equal(gateSummary(allPass), '7/7 pass', 'all pass should read "7/7 pass"');

/* Two blocked, five pass */
const mixed = [
  { id: 'G1', label: 'G1 trend',           state: 'pass' },
  { id: 'G2', label: 'G2 sweep/reclaim',   state: 'veto' },
  { id: 'G3', label: 'G3 RSI band',        state: 'pass' },
  { id: 'G4', label: 'G4 funding',         state: 'pass' },
  { id: 'G5', label: 'G5 settle>25m',      state: 'pass' },
  { id: 'G6', label: 'G6 vol+wick commit', state: 'veto' },
  { id: 'G7', label: 'G7 1.5R vol-capped', state: 'pass' },
];
const mixedSum = gateSummary(mixed);
assert.equal(mixedSum, '5/7 \u00b7 blocked: sweep/reclaim, vol+wick commit',
  'mixed should format compact block reasons with G-prefix stripped, got: ' + mixedSum);

/* More than 2 blocks: overflow with "+N" tail */
const heavy = [
  { id: 'G1', label: 'G1 a', state: 'veto' },
  { id: 'G2', label: 'G2 b', state: 'veto' },
  { id: 'G3', label: 'G3 c', state: 'veto' },
  { id: 'G4', label: 'G4 d', state: 'veto' },
  { id: 'G5', label: 'G5 e', state: 'pass' },
];
const heavySum = gateSummary(heavy);
assert.ok(heavySum.startsWith('1/5 \u00b7 blocked: a, b'), 'heavy prefix wrong: ' + heavySum);
assert.ok(heavySum.endsWith('+2'), 'heavy overflow should end with +2, got: ' + heavySum);

/* 'na' state is neither pass nor veto \u2014 counts against total, listed nowhere */
const withNa = [
  { id: 'T1', label: 'T1 struct', state: 'pass' },
  { id: 'T3', label: 'T3 MACD',   state: 'na' },
  { id: 'T4', label: 'T4 RSI',    state: 'pass' },
];
assert.equal(gateSummary(withNa), '2/3',
  'na states should not count as pass and not show in blocked list');

/* --- edgeVetoNote --- */
ctx.W.edgeSwingBias = undefined;
assert.equal(edgeVetoNote(), '', 'no edgeSwingBias \u2192 empty');
ctx.W.edgeSwingBias = function(){};
assert.equal(edgeVetoNote(), '', 'no lastVetoBlockedBy \u2192 empty');
ctx.W.edgeSwingBias.lastVetoBlockedBy = 'EG3';
assert.equal(edgeVetoNote(), 'EDGE blocked at EG3', 'should surface EG3 block');

console.log('OK \u2014 Pack 2 slice 4: signallog gate consumers wired');
console.log('  * gateSummary handles null/empty/mixed/heavy/na cases correctly');
console.log('  * G-prefix stripping produces short human-readable labels');
console.log('  * >2 blocks overflow with "+N" tail (note column is width-capped)');
console.log('  * edgeVetoNote reads edgeSwingBias.lastVetoBlockedBy from slice 3');
console.log('  * W.hgGateSummary and W.hgEdgeVetoNote exposed for downstream consumers');
console.log('  * pullBrain and pullScan prepend gate summary to note when present');
