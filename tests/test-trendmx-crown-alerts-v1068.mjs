/* HARDGATE — hg-v1068: THE TREND MATRIX CROWN REACHES THE OPERATOR.

   The matrix crown joins the same final-mile loop OMNIBTC got in hg-v1053:
   a crown state seam (W.trendmxCrownState), a pure crown-of-rows helper, a
   Telegram collector (clean tier only, PERFECT badges in the note), the
   convicted-only allowlist seat, and the background auto-scan entry so the
   desk scans - and its records accumulate - even when the tab is closed.
   The crown's MICRO dimension also gains the accuracy witnesses (fill
   odds + stop sensitivity).

   Run: node tests/test-trendmx-crown-alerts-v1068.mjs */
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
                   'plans.js', 'setup-ui.js', 'trendtable.combined.js', 'tabalerts.js'])
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
    rows4h: mkRows(60, score >= 0 ? 0.05 : -0.05) };
}

console.log('== the pure crown-of-rows seam is exported and grades correctly ==');
{
  const W = boot({});
  ok(typeof W.trendmxCrownOfRows === 'function', 'the pure crown helper is exported');
  const c = W.trendmxCrownOfRows([row('ETHUSD', 1), row('BTCUSD', 3), row('SOLUSD', -2)]);
  ok(c && c.sym === 'BTCUSD' && c.dir === 'long' && c.tier === 'clean', 'the crown is the strongest majority row with a plan');
  ok(isFinite(c.entry) && isFinite(c.stop) && isFinite(c.t1), 'the crown carries the levels');
}

console.log('== the alert collector pushes the crown as a clean7 row ==');
{
  const W = boot({});
  const c = W.trendmxCrownOfRows([row('BTCUSD', 3)]);
  const out = [];
  /* the collector reads W.trendmxCrownState; stub the state around the pure helper */
  W.trendmxCrownState = () => ({ at: 1760000000, crown: c });
  W.collectTrendmxCrown(out);
  ok(out.length === 1, 'the collector pushed one row');
  ok(out[0].src === 'TRENDMX CROWN' && out[0].sym === 'BTCUSD' && out[0].dir === 'long', 'the row names the crown');
  ok(out[0].clean7 === true, 'the crown rides as gate-clean');
  const W2 = boot({});
  W2.trendmxCrownState = () => ({ at: 1760000000, crown: Object.assign({}, c, { tier: 'near' }) });
  const out2 = [];
  W2.collectTrendmxCrown(out2);
  ok(out2.length === 0, 'a near crown never alerts');
}

console.log('== wiring pins ==');
{
  const tsrc = read('trendtable.combined.js');
  ok(tsrc.indexOf('function trendmxCrownState') >= 0 && tsrc.indexOf('W.trendmxCrownOfRows') >= 0, 'the crown state seams are defined');
  ok(tsrc.indexOf('fill odds') >= 0 && tsrc.indexOf('stop sensitivity') >= 0, 'the crown MICRO carries the accuracy witnesses');
  const asrc = read('tabalerts.js');
  ok(asrc.indexOf('function collectTrendmxCrown') >= 0, 'the collector is defined');
  ok(asrc.indexOf("if (s.src === 'TRENDMX CROWN') return true;") >= 0, 'the convicted filter admits the crown');
  const html = read('index.html');
  ok(html.indexOf("|| t === 'trendmx');") >= 0, 'the background cycle force-scans the matrix');
  ok(html.indexOf("'trendmx': async function(opts){") >= 0, 'the auto-scan entry exists');
}

console.log('\ntest-trendmx-crown-alerts-v1068: ' + passed + ' passed, 0 failed');
