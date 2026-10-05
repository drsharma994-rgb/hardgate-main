/* HARDGATE — hg-v1066: THE TREND MATRIX CROWN — the OMNIBTC treatment on the matrix.

   The strongest majority row with a minted plan now renders as a crown:
   THE CALL (direction + tier + composite + conviction), a CROWN VERDICT
   line, a COMPLETE ANALYSIS (technical/sentimental/fundamental/macro/
   micro with the world tilt), a SETUP CARD (thesis, bias, entry zone, SL,
   TP1-3 with the ungraded extension, automation JSON) and the MEASURED
   EDGE chip for the TRENDMX pool. Evidence, never a gate.

   Run: node tests/test-trendmx-crown-v1066.mjs */
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
                   'plans.js', 'setup-ui.js', 'trendtable.combined.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

const T4 = 14400;
function mkRows(n, slope){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * slope;
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c - 0.02, h: c + 0.4, l: c - 0.4, c, v: 100 });
  }
  return rows;
}
function row(sym, score, exchange){
  return { sym, score, exchange: exchange || 'delta',
    comps: { d200: score > 0 ? 1 : -1, x: score > 0 ? 1 : -1, h4: score > 0 ? 1 : -1, cloud: score > 0 ? 1 : -1, adx: 0 },
    adx: 28, price: 100 + score, fundingPct: 0.001,
    gate: { label: 'trend', clean7: true, veto: false, gatesPassed: 7 },
    rows4h: mkRows(60, score >= 0 ? 0.05 : -0.05),
    rows1h: mkRows(60, score >= 0 ? 0.05 : -0.05) };
}

console.log('== the crown renders the OMNIBTC stack on the matrix lead ==');
{
  const W = boot({
    hgProvenEdgeVerdict: (scan, mech, o) => ({ state: 'proven', n: 40, hit: 0.55, expR: 0.3, floor: 20 }),
    hgProvenEdgeChipHtml: (v) => 'CHIP:' + v.state,
    getWorldMonitorDeskCached: () => ({ macro: { verdict: 'BUY' }, stress: { label: 'LOW' } }),
    regimeState: () => ({ playbook: { bias: 'LONG-ONLY' }, dxy: { trend20: 'FALLING' } })
  });
  ok(typeof W.trendmxCrownPanelHTML === 'function', 'the crown renderer is exported');
  const html = W.trendmxCrownPanelHTML({ rows: [row('BTCUSD', 3), row('ETHUSD', 1)] });
  ok(html.indexOf('THE CALL') >= 0 && html.indexOf('LONG - TICKET') >= 0, 'the call names the direction and tier');
  ok(html.indexOf('composite +3/5') >= 0, 'the composite rides the call');
  ok(html.indexOf('CROWN VERDICT') >= 0 && html.indexOf('gates 7/7') >= 0, 'the verdict line prints');
  ok(html.indexOf('COMPLETE ANALYSIS') >= 0 && html.indexOf('TECHNICAL') >= 0 && html.indexOf('MACRO') >= 0 && html.indexOf('MICRO') >= 0, 'the five-dimension analysis prints');
  ok(html.indexOf('world tilt RISK-ON') >= 0, 'the world tilt reads RISK-ON on the risk-on feeds');
  ok(html.indexOf('SETUP CARD') >= 0 && html.indexOf('Market Thesis') >= 0, 'the setup card prints with the thesis');
  ok(html.indexOf('TP3') >= 0 && html.indexOf('EXTENSION - not graded') >= 0, 'TP3 is the honest ungraded extension');
  ok(html.indexOf('Automation Blueprint') >= 0 && html.indexOf('&quot;venue&quot;: &quot;delta&quot;') >= 0, 'the automation JSON prints for the row venue');
  ok(html.indexOf('MEASURED EDGE') >= 0 && html.indexOf('CHIP:proven') >= 0, 'the measured chip reads the TRENDMX pool');
  ok(html.indexOf('ANCHOR') >= 0 && html.indexOf('VWAP') >= 0 && html.indexOf('Bollinger') >= 0, 'the VWAP + Bollinger anchor prints');
  ok(html.indexOf('SWING SETUP') >= 0 && html.indexOf('4h grid') >= 0, 'the swing grid prints');
  ok(html.indexOf('SCALP SETUP') >= 0 && html.indexOf('1h grid') >= 0 && html.indexOf('1h draft ladder ATR14') >= 0, 'the 1h scalp grid prints as the honest draft ladder');
  ok(html.indexOf('SCALP SETUP - ALT SIDE') >= 0 && html.indexOf('AGAINST THE CALL') >= 0, 'the alt side prints stamped against the call');
}

console.log('== no minted plan, no crown ==');
{
  const W = boot({});
  const html = W.trendmxCrownPanelHTML({ rows: [row('ETHUSD', 1)] });
  ok(html === '', 'a row without a minted plan prints no crown - an honest empty');
}

console.log('== wiring pins ==');
{
  const src = read('trendtable.combined.js');
  ok(src.indexOf('function trendmxCrownPanelHTML') >= 0, 'the crown renderer is defined');
  ok(src.indexOf('W.trendmxCrownPanelHTML = trendmxCrownPanelHTML') >= 0, 'the seam is exported');
  ok(src.indexOf('data-r="crown"') >= 0, 'the mount exists');
  ok(src.indexOf('function trendmxGridBlockHtml') >= 0, 'the grid-block helper is defined');
  ok(src.indexOf('trendmxCrownPanelHTML(state)') >= 0, 'the panel paints from the desk state');
}

console.log('\ntest-trendmx-crown-v1066: ' + passed + ' passed, 0 failed');
