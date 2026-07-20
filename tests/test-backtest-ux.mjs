/* HARDGATE — Stage 4 tests: chunked backtest engines + cooperative cancel.
   - engines are async and yield to the event loop (UI stays alive)
   - ctl progress callback fires and results are identical to the no-ctl run
   - btCancel(key) cooperatively aborts with e.cancelled === true
   Run: node tests/test-backtest-ux.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });

const html = fs.readFileSync(root + 'index.html', 'utf8');
function grab(re, label){
  const m = html.match(re);
  if (!m) throw new Error('extraction failed: ' + label);
  vm.runInThisContext(m[0], { filename: label });
}
// plumbing + engines + the inline helpers the engines close over
grab(/const BT_CTL = \{\};[\s\S]*?return Promise\.resolve\(\);\n\}/, 'bt-plumbing.js');
grab(/async function backtestSwingTD\(rows, ctl\)\{[\s\S]*?\n\}(?=\n+function backtestSummaryHTML)/, 'bt-swing.js');
grab(/async function backtestScalpTD\(h1rows, m15rows, ctl\)\{[\s\S]*?\n\}(?=\n+async function backtestGoldSwingTD)/, 'bt-scalp.js');
grab(/async function backtestGoldSwingTD\(d1rows, h4rows, ctl\)\{[\s\S]*?\n\}(?=\n+async function backtestJudasTD)/, 'bt-goldswing.js');
grab(/async function backtestJudasTD\(d1rows, h1rows, m15rows, ctl\)\{[\s\S]*?\n\}(?=\n+function backtestSummaryHTML2)/, 'bt-judas.js');
grab(/function fundingMinsAt\(tSec\)\{[\s\S]*?\n\}/, 'helper-funding.js');
grab(/function dayStartOf\(tSec\)\{[\s\S]*?\n\}/, 'helper-daystart.js');
grab(/function asiaDayBase\(tSec\)\{[\s\S]*?\n\}/, 'helper-asiaday.js');
grab(/function sessionAt\(tSec\)\{[\s\S]*?\n\}/, 'helper-session.js');

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* synthetic series: seeded noisy drift — noise keeps RSI mid-range while the
   drift holds the EMA cascade aligned, so the swing engine actually fires */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function rows(n, start, slope, stepSec){
  const rnd = mulberry32(7), vol = 0.5;
  const out = []; let c = start;
  for (let i = 0; i < n; i++){
    c += slope + (rnd() - 0.5) * 2 * vol;
    out.push({ t: 1700000000 + i * stepSec, o: c - vol * 0.3, h: c + vol * 0.5, l: c - vol * 0.9, c: c, v: 100 + (i % 7) * 10 });
  }
  return out;
}

/* ============ 1) swingTD: chunked == unchunked, progress fires ============ */
console.log('== backtestSwingTD (chunking + progress) ==');
const sw = rows(1500, 100, 0.05, 14400);

const plain = await globalThis.backtestSwingTD(sw, null);
ok(Array.isArray(plain) && plain.length > 0, 'no-ctl run finds signals (' + plain.length + ') — equality check is non-trivial');
ok(plain.every(r => r.outcome && typeof r.rMult === 'number' && isFinite(r.entry) && isFinite(r.stop)), 'every signal has outcome/rMult/entry/stop');

let progCalls = 0, lastFrac = 0, monotonic = true;
const ctlA = btCtlMake('t1');
ctlA.prog = f => { progCalls++; if (f < lastFrac) monotonic = false; lastFrac = f; };
const chunked = await globalThis.backtestSwingTD(sw, ctlA);
ok(JSON.stringify(chunked) === JSON.stringify(plain), 'chunked results identical to unchunked');
ok(progCalls >= 10, 'progress callback fired ' + progCalls + 'x over 1500 bars (>=10)');
ok(monotonic && lastFrac > 0.5, 'progress fraction monotonic and advances (last ' + lastFrac.toFixed(2) + ')');
btCtlDone('t1');
ok(!BT_CTL.t1, 'btCtlDone removes the control handle');

/* ============ 2) cooperative cancel ============ */
console.log('== cooperative cancel ==');
const ctlB = btCtlMake('t2');
let seen = 0;
ctlB.prog = () => { if (++seen === 3) globalThis.btCancel('t2'); };
let cancelled = false;
try { await globalThis.backtestSwingTD(sw, ctlB); }
catch (e){ cancelled = (e && e.cancelled === true); }
ok(cancelled, 'engine aborts with e.cancelled===true after btCancel (prog saw ' + seen + ' ticks)');
btCtlDone('t2');

const ctlC = btCtlMake('t3');
ctlC.cancelled = true; // cancel pressed before the first bar
let preCancelled = false;
try { await globalThis.backtestSwingTD(sw, ctlC); }
catch (e){ preCancelled = (e && e.cancelled === true); }
ok(preCancelled, 'pre-cancelled ctl aborts immediately');
btCtlDone('t3');

/* ============ 3) event loop actually breathes between chunks ============ */
console.log('== event-loop liveness ==');
let ticked = 0;
const tickTimer = setInterval(() => { ticked++; }, 0);
const ctlD = btCtlMake('t4');
await globalThis.backtestSwingTD(sw, ctlD);
clearInterval(tickTimer);
btCtlDone('t4');
ok(ticked >= 5, 'setInterval fired ' + ticked + 'x during the backtest (macrotask yields work)');

/* ============ 4) scalpTD: chunked == unchunked ============ */
console.log('== backtestScalpTD ==');
const h1 = rows(500, 100, 0.3, 3600);
const m15 = rows(1600, 100, 0.095, 900);
const scPlain = await globalThis.backtestScalpTD(h1, m15, null);
const ctlE = btCtlMake('t5');
let scProg = 0; ctlE.prog = () => { scProg++; };
const scChunked = await globalThis.backtestScalpTD(h1, m15, ctlE);
btCtlDone('t5');
ok(JSON.stringify(scChunked) === JSON.stringify(scPlain), 'scalp chunked == unchunked (' + scPlain.length + ' signals, ' + scProg + ' prog ticks)');

/* ============ 5) goldSwingTD + judasTD: run to completion, cancel-safe ============ */
console.log('== backtestGoldSwingTD / backtestJudasTD ==');
const d1 = rows(320, 90, 0.25, 86400);
const h4g = rows(700, 100, 0.18, 14400);
const gsPlain = await globalThis.backtestGoldSwingTD(d1, h4g, null);
const ctlF = btCtlMake('t6'); ctlF.prog = () => {};
const gsChunked = await globalThis.backtestGoldSwingTD(d1, h4g, ctlF);
btCtlDone('t6');
ok(JSON.stringify(gsChunked) === JSON.stringify(gsPlain), 'gold swing chunked == unchunked (' + gsPlain.length + ' signals)');

const jdPlain = await globalThis.backtestJudasTD(d1, h1, m15, null);
const ctlG = btCtlMake('t7');
let jdSeen = 0;
ctlG.prog = () => { if (++jdSeen === 2) globalThis.btCancel('t7'); };
let jdCancelled = false;
try { await globalThis.backtestJudasTD(d1, h1, m15, ctlG); }
catch (e){ jdCancelled = (e && e.cancelled === true); }
btCtlDone('t7');
ok(Array.isArray(jdPlain), 'judas no-ctl completes (' + jdPlain.length + ' signals)');
ok(jdCancelled, 'judas honours btCancel mid-run');

console.log(`\nALL ${passed} BACKTEST-UX ASSERTIONS PASSED`);
