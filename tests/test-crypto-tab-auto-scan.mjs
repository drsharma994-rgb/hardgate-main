/* HARDGATE — SWING / SCALP / EDGE / BEST must scan themselves.

   Field report after v438: opening those four tabs left them idle until the
   reader clicked SCAN / FIND. Two cooperating defects:

     1. scheduleTabAutoScan dropped the visible-tab scan whenever another
        tab (BRAIN on boot) or the 5-min cycle held __hgTabScanBusy /
        isManualScanBusy / HG_REFRESH_BUSY. A drop is not a defer — the
        desk stayed idle forever.

     2. hgScanOneTab ignored opts.quiet, so the alert cycle called
        runScan('swing') / runBest() loud. Those wait on waitAlertIdle
        (S.alertBusy is already true → up to 240s) and disable RUN, which
        then makes isManualScanBusy() true and (1) drops the tab-open scan.

   Contract: opening SWING / SCALP / EDGE / BEST starts their scan. A busy
   lock retries; it does not swallow. Background cycles pass quiet so they
   do not steal the RUN button. G1–G7 are untouched.

   Run: node tests/test-crypto-tab-auto-scan.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const HTML = read('index.html');
const EDGE = read('edge.js');

function extractFn(src, name){
  let start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  if (start >= 6 && src.slice(start - 6, start) === 'async ') start -= 6;
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced ' + name);
}

const AUTO = HTML.slice(
  HTML.indexOf('const HG_TAB_AUTO_SCAN'),
  HTML.indexOf('const HG_SCAN_RUN_BTN')
);
const SCAN_ONE = extractFn(HTML, 'hgScanOneTab');
const SCHED = extractFn(HTML, 'scheduleTabAutoScan');

console.log('== tab-open auto-scan is not dropped when another tab is busy ==');
{
  ok(/function scheduleTabAutoScan\(/.test(HTML), 'scheduleTabAutoScan exists');
  ok(!/if \(seq !== __hgTabScanSeq\) return;\s*if \(__hgTabScanBusy[\s\S]{0,280}?return;/.test(SCHED),
     'busy lock does not return once and forget the visible tab');
  ok(/setTimeout\(\s*(go|tick|retry)/.test(SCHED) || /function go\(/.test(SCHED) || /blocked\(\)/.test(SCHED),
     'busy lock retries the scheduled scan');
  ok(/swing|scalp|best|edge/.test(SCHED),
     'crypto desks are named as scans that must not be swallowed');
}

console.log('== hgScanOneTab forwards quiet to AUTO_SCAN ==');
{
  ok(/HG_TAB_AUTO_SCAN\[id\]\(opts\)/.test(SCAN_ONE),
     'hgScanOneTab calls AUTO_SCAN with opts (quiet reaches swing/scalp/best/edge)');
}

console.log('== SWING / SCALP / BEST AUTO_SCAN honor quiet ==');
{
  ok(/swing:\s*function\s*\(\s*opts/.test(AUTO), 'swing AUTO_SCAN takes opts');
  ok(/scalp:\s*function\s*\(\s*opts/.test(AUTO), 'scalp AUTO_SCAN takes opts');
  ok(/best:\s*function\s*\(\s*opts/.test(AUTO), 'best AUTO_SCAN takes opts');
  ok(/cryptoScanWarm\('swing'\)/.test(AUTO), 'quiet SWING uses cryptoScanWarm');
  ok(/cryptoScanWarm\('scalp'\)/.test(AUTO), 'quiet SCALP uses cryptoScanWarm');
  ok(/bestScanWarm\(/.test(AUTO), 'quiet BEST uses bestScanWarm');
  ok(/runScan\('swing',\s*opts/.test(AUTO), 'loud SWING still calls runScan with opts');
  ok(/runScan\('scalp',\s*opts/.test(AUTO), 'loud SCALP still calls runScan with opts');
  ok(/runBest\(opts/.test(AUTO), 'loud BEST still calls runBest with opts');
}

console.log('== EDGE AUTO_SCAN warms when quiet or unmounted ==');
{
  ok(/edge:\s*async function\s*\(\s*opts/.test(AUTO), 'edge AUTO_SCAN takes opts');
  ok(/edgeWarm\(/.test(AUTO), 'EDGE background path calls edgeWarm (not a missing #edgeRun click)');
}

console.log('== EDGE visible mount still auto-runs after a background warm ==');
{
  const boot = EDGE.match(/setTimeout\(function\(\)\{[\s\S]{0,320}\},\s*\d+\)/);
  ok(!!boot, 'EDGE mount still schedules an auto-run');
  ok(boot && !/!__edge\.ranOnce/.test(boot[0]),
     'EDGE auto-run is not gated on ranOnce (background warm must not suppress the visible desk)');
  ok(boot && /runScan\(\)/.test(boot[0]), 'EDGE mount auto-run still calls runScan');
}

console.log('== behavioral: hgScanOneTab passes quiet ==');
{
  const ctx = {
    console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String,
    Promise, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.lastScanOpts = null;
  ctx.HG_TAB_AUTO_SCAN = {
    swing: function(opts){ ctx.lastScanOpts = opts || null; return Promise.resolve('ok'); }
  };
  ctx.HG_TAB_MODS = {};
  ctx.HG_SCAN_RUN_BTN = {};
  ctx.document = { getElementById: function(){ return null; } };
  vm.createContext(ctx);
  vm.runInContext(SCAN_ONE + '\nthis.hgScanOneTab = hgScanOneTab;', ctx);
  const p = ctx.hgScanOneTab('swing', { quiet: true, n: 80 });
  ok(p && typeof p.then === 'function', 'hgScanOneTab returns a promise');
  await p;
  ok(ctx.lastScanOpts && ctx.lastScanOpts.quiet === true,
     'AUTO_SCAN received quiet:true (got ' + JSON.stringify(ctx.lastScanOpts) + ')');
  ok(ctx.lastScanOpts && ctx.lastScanOpts.n === 80, 'other opts travel with quiet');
}

console.log('== G1–G7 floors are untouched ==');
{
  const gates = read('cryptogates.js');
  ok(/var CG_SWING_RR_MIN = 2\.0;/.test(gates), 'swing R:R floor still 2.0');
  ok(/var CG_G1_SPREAD_ATR = 0\.25;/.test(gates), 'G1 spread still 0.25×ATR');
  ok(/var CG_G5_VZ_MIN = 0\.5;/.test(gates), 'G5 volZ still 0.5');
  ok(/var CG_SWING_ANCHOR_ATR = 1\.5;/.test(gates), 'anchor still 1.5×ATR');
}

console.log('== stamp ==');
{
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\n' + passed + ' assertions');
