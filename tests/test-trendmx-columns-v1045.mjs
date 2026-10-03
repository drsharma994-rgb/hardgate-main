/* HARDGATE — hg-v1045: TREND MATRIX BULL / BEAR COLUMNS.

   The full matrix can now be regrouped into three columns by the row's own
   majority direction: BULL (composite >= +2), BEAR (<= -2) and MIXED / CHOP
   (everything between). Same rows, same gates, same cards — a different
   reading order. The sortable table remains the default view; the toggle
   chips switch between TABLE and BULL / BEAR COLUMNS.

   Run: node tests/test-trendmx-columns-v1045.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
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
                   'plans.js', 'setup-ui.js', 'trendtable.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

const T4 = 14400;
function mkRows(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * 0.02;
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c, h: c + 0.3, l: c - 0.3, c, v: 100 });
  }
  return rows;
}
const R4 = mkRows(60);
function row(sym, score){
  return {
    sym: sym, score: score,
    comps: { d200: score > 0 ? 1 : (score < 0 ? -1 : 0), x: 0, h4: 0, cloud: 0, adx: 0 },
    adx: 22, exchange: 'delta', price: 100,
    gate: { label: 'swing', clean7: false, veto: false, gatesPassed: 6 },
    rows4h: R4
  };
}
const FIX = [row('BUL3', 3), row('BUL2', 2), row('BER4', -4), row('BER2', -2), row('MIX0', 0), row('MIX1', 1)];

console.log('== the seam is exported and groups by majority direction ==');
{
  const W = boot();
  ok(typeof W.trendmxColumnsHTML === 'function', 'trendmxColumnsHTML is exported for tests');
  const html = W.trendmxColumnsHTML(FIX);
  ok(html.indexOf('BULL') >= 0 && html.indexOf('2 rows') >= 0, 'the BULL column groups the two bullish rows (count shown)');
  ok(html.indexOf('BEAR') >= 0, 'the BEAR column exists');
  ok(html.indexOf('MIXED / CHOP') >= 0, 'the MIXED / CHOP column exists');
  const bullIdx = html.indexOf('BULL');
  const bearIdx = html.indexOf('BEAR');
  const mixedIdx = html.indexOf('MIXED / CHOP');
  ok(bullIdx >= 0 && bearIdx > bullIdx && mixedIdx > bearIdx, 'the columns render in BULL → BEAR → MIXED order');
  ok(html.indexOf('BUL3') < html.indexOf('BUL2'), 'the BULL column orders by |composite| (3 before 2)');
  ok(html.indexOf('BER4') < html.indexOf('BER2'), 'the BEAR column orders by |composite| (4 before 2)');
  ok(html.indexOf('MIX0') >= 0 && html.indexOf('MIX1') >= 0, 'the mixed rows both render');
  ok(html.indexOf('LONG') >= 0 && html.indexOf('SHORT') >= 0, 'the cards carry their direction');
}

console.log('== an empty bucket names itself honestly ==');
{
  const W = boot();
  const html = W.trendmxColumnsHTML([row('ONLY', 3)]);
  ok(html.indexOf('no bearish rows') >= 0, 'an empty BEAR column says so instead of rendering nothing');
  ok(html.indexOf('no mixed rows') >= 0, 'an empty MIXED column says so');
  ok(html.indexOf('1 row') >= 0, 'the BULL column counts its single row');
}

console.log('== the mount wires the toggle and the renderer honors it ==');
{
  const src = read('trendtable.js');
  ok(src.indexOf('data-view="columns"') >= 0, 'the COLUMNS toggle chip is in the mount');
  ok(src.indexOf("state.view === 'columns'") >= 0, 'renderMatrix branches on the view');
  ok(src.indexOf('view: \'table\'') >= 0, 'the default view stays the sortable table');
  ok(src.indexOf('W.trendmxColumnsHTML = trendmxColumnsHTML') >= 0, 'the seam export is pinned');
}

console.log('\ntest-trendmx-columns-v1045: ' + passed + ' passed, 0 failed');
