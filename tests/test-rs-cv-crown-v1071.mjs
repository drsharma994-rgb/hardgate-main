/* HARDGATE — hg-v1071: THE CROWN ON REVERSAL SNIPER + CHART VISION.

   The OMNIBTC treatment reaches the last two list-style desks: a bold
   THE CALL, a CROWN VERDICT, a COMPLETE ANALYSIS (technical - macro -
   micro, with the world tilt), a SETUP CARD (thesis, bias, entry, SL,
   targets, automation JSON) and the MEASURED EDGE chip. Both desks stay
   honest: the sniper is LONG-only by design, 6/7 NEAR stays WATCH, and
   an empty scan prints no crown.

   Run: node tests/test-rs-cv-crown-v1071.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = []; ctx.HG_TAB_MODS = {};
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js',
                   'hg-setup-core.js', 'crypto-position-risk.js', 'cryptogates.js',
                   'plans.js', 'setup-ui.js', 'reversalsniper.js', 'chartvision-tab.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

const WM = {
  getWorldMonitorDeskCached: () => ({ macro: { verdict: 'BUY' }, stress: { label: 'LOW' } }),
  regimeState: () => ({ playbook: { bias: 'LONG-ONLY' } }),
  hgProvenEdgeVerdict: () => ({ state: 'proven', n: 40, hit: 0.55, expR: 0.3, floor: 20 }),
  hgProvenEdgeChipHtml: v => 'CHIP:' + v.state
};

console.log('== the sniper crown renders the OMNIBTC stack on its leading bounce ==');
{
  const W = boot(WM);
  ok(typeof W.rsCrownHtml === 'function', 'the sniper crown renderer is exported');
  const html = W.rsCrownHtml([{ sym: 'ETHUSD', setup: {
    entry: 100, stop: 99.5, t1: 101.5, t2: 102, rr1: 3, rr2: 4, riskPct: 0.5, lev: 5,
    drawdownPct: 2.3, rsi2: 4.1, triggers: [1, 2, 3] } }]);
  ok(html.indexOf('THE CALL') >= 0 && html.indexOf('LONG -') >= 0, 'the call prints the desk direction');
  ok(html.indexOf('CROWN VERDICT') >= 0 && html.indexOf('REVERSAL SNIPER') >= 0, 'the verdict prints');
  ok(html.indexOf('COMPLETE ANALYSIS') >= 0 && html.indexOf('TECHNICAL') >= 0 && html.indexOf('MACRO') >= 0 && html.indexOf('MICRO') >= 0, 'the three-dimension analysis prints');
  ok(html.indexOf('world tilt RISK-ON') >= 0, 'the world tilt reads RISK-ON on the risk-on feeds');
  ok(html.indexOf('drawdown 2.3%') >= 0 && html.indexOf('RSI(2) 4.1') >= 0, 'the measured technical lines print');
  ok(html.indexOf('SETUP CARD') >= 0 && html.indexOf('Automation Blueprint') >= 0, 'the setup card + JSON print');
  ok(html.indexOf('MEASURED EDGE') >= 0 && html.indexOf('CHIP:proven') >= 0, 'the measured chip reads the pool');
  ok(W.rsCrownHtml([]) === '', 'no bounce, no crown - an honest empty');
}

console.log('== the vision crown leads with 7/7 CLEAN and keeps 6/7 WATCH ==');
{
  const W = boot(WM);
  ok(typeof W.cvCrownHtml === 'function', 'the vision crown renderer is exported');
  const snap = { at: Date.now(), results: [
    { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 99, t1: 102, t2: null, rr: 2, gatesPassed: 7, gatesTotal: 7, clean7: true, visionChip: 'UP', style: 'swing' },
    { sym: 'ETHUSD', dir: 'short', entry: 100, stop: 101.2, t1: 98, t2: null, rr: 1.6, gatesPassed: 6, gatesTotal: 7, clean7: false, visionChip: 'DOWN', style: 'swing' }
  ]};
  const html = W.cvCrownHtml(snap);
  ok(html.indexOf('LONG - TICKET') >= 0, 'the 7/7 CLEAN leads as TICKET');
  ok(html.indexOf('gates 7/7') >= 0 && html.indexOf('vision UP') >= 0, 'the verdict names the gates and the vision read');
  ok(html.indexOf('COMPLETE ANALYSIS') >= 0 && html.indexOf('world tilt RISK-ON') >= 0, 'the analysis prints with the tilt');
  ok(html.indexOf('SETUP CARD') >= 0 && html.indexOf('Automation Blueprint') >= 0, 'the setup card + JSON print');
  ok(W.cvCrownHtml({ at: Date.now(), results: [{ sym: 'X', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, gatesPassed: 6, gatesTotal: 7, clean7: false }] }).indexOf('WATCH') >= 0, '6/7 NEAR stays WATCH');
  ok(W.cvCrownHtml(null) === '', 'no scan, no crown - an honest empty');
}

console.log('== wiring pins ==');
{
  const rs = read('reversalsniper.js');
  ok(rs.indexOf('function rsCrownHtml') >= 0 && rs.indexOf('id="rsCrown"') >= 0, 'the sniper crown is wired');
  ok(rs.indexOf('rsCrownEl.innerHTML = rsCrownHtml(results)') >= 0, 'the sniper crown paints after every scan');
  const cv = read('chartvision-tab.js');
  ok(cv.indexOf('function cvCrownHtml') >= 0 && cv.indexOf('id="cvCrown"') >= 0, 'the vision crown is wired');
  ok(cv.indexOf('cvCrownHtml(__cvSnap)') >= 0, 'the vision crown paints after every scan');
}

console.log('\ntest-rs-cv-crown-v1071: ' + passed + ' passed, 0 failed');
