/* HARDGATE — the diagnostics have to be reachable without a console.
   Packs 15-19 shipped five measurement tools and wired NONE of them to a
   button. Counted on the pre-pack-20 tree, calls inside index.html:
       hgStopSweep          0
       hgHeatProfile        0
       hgGoldWeekendMoves   0
       hgGoldWeekendRisk    0
       cgReplaySweep        0
   Every one came with a "run this from the console" instruction. Nineteen
   packs in, the funnel is still empty and every instrument built to explain
   why sits behind a prompt nobody types. A tool nobody opens is worth nothing.
   This test does not check maths — the packs that introduced these functions
   already do. It checks REACHABILITY, which is the thing that was missing.
   Run: node tests/test-calibrate-wiring.mjs                                  */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
console.log('== there is a button, and it is on the SWING tab ==');
{
  ok(/id="swingDiag"[^>]*onclick="runGateDiagnostics\(\)"/.test(html), 'CALIBRATE button exists and is wired');
  ok(/id="swingDiagOut"/.test(html), 'it has an output container');
  ok(html.indexOf('id="swingDiagOut"') > html.indexOf('id="swingCards"'),
     'output renders below the cards, not above them');
  ok(/async function runGateDiagnostics\(\)/.test(html), 'the handler is defined');
}
console.log('== every previously console-only tool is now called ==');
{
  const body = html.slice(html.indexOf('async function runGateDiagnostics()'));
  const fn = body.slice(0, body.indexOf('\nasync function runScan'));
  ['cgGateReplay', 'cgReplaySweep', 'hgHeatProfile', 'hgStopSweep',
   'hgGoldWeekendMoves', 'hgGoldWeekendRisk'].forEach(f => {
    ok(new RegExp('\\b' + f + '\\s*\\(').test(fn), f + ' is called by CALIBRATE');
  });
}
console.log('== it degrades instead of throwing ==');
{
  const body = html.slice(html.indexOf('async function runGateDiagnostics()'));
  const fn = body.slice(0, body.indexOf('\nasync function runScan'));
  ['cgGateReplay', 'cgReplaySweep', 'hgHeatProfile', 'hgGoldWeekendMoves'].forEach(f => {
    ok(new RegExp("typeof " + f + " === 'function'").test(fn),
       f + ' is guarded — a missing module skips its panel rather than breaking the rest');
  });
  ok(/catch\(e\)\{[\s\S]{0,200}calibration failed/.test(fn), 'a thrown error is reported, not swallowed silently');
  ok(/btn\.disabled = false;/.test(fn), 'the button is always re-enabled');
  ok(/no symbol returned 300\+ 4H bars/.test(fn), 'an empty replay says why rather than rendering blank');
}
console.log('== it respects the scan rate limiter and the real constants ==');
{
  const body = html.slice(html.indexOf('async function runGateDiagnostics()'));
  const fn = body.slice(0, body.indexOf('\nasync function runScan'));
  ok(/hgScanRateOk\(\)/.test(fn), 'it stops when the rate limiter says stop');
  ok(/HG_DIAG_SYMBOLS/.test(fn), 'the symbol count is a named constant, not inline');
  ok(/const HG_DIAG_SYMBOLS = \d+;/.test(html), 'and that constant is defined');
  /* the sweep labels must read the LIVE thresholds, or the table will claim a
     current setting that is not the current setting */
  ['CG_SWING_RR_MIN', 'CG_G5_VZ_MIN', 'CG_G1_SPREAD_ATR', 'CG_SWING_ANCHOR_ATR'].forEach(c => {
    ok(new RegExp("\\+ " + c + " \\+").test(fn), c + ' is read live into its panel title');
  });
}
console.log('== the output tells you how to read it ==');
{
  const body = html.slice(html.indexOf('async function runGateDiagnostics()'));
  const fn = body.slice(0, body.indexOf('\nasync function runScan'));
  ok(/Read the SHAPE, not the winner/.test(fn), 'it warns against picking the best row');
  ok(/flat or jagged column means too little data/.test(fn), 'and against reading noise');
  ok(/TIGHT, ordinary noise is taking correct calls/.test(fn), 'the stop-margin warning is explicit');
}
console.log('\n' + passed + ' passed, 0 failed');
