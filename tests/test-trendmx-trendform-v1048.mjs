/* HARDGATE — hg-v1048: TREND MATRIX · COINDCX TRENDING / FORMING BOARD.

   The scan now merges in ALL CoinDCX futures (universe floor 0, venue
   coindcx, deduped against the floored board), and a new section classifies
   them in two columns:

     TRENDING — the composite has a majority direction (|score| >= 2);
                levels are the minted plan (7/7 CLEAN / 6/7 NEAR) or the
                house DRAFT ladder (tmFallbackStop stop through
                cgDraftSwingLevels) stamped DRAFT.
     FORMING  — no majority yet; the lean is named (LONG-LEAN /
                SHORT-LEAN / NO LEAN) and levels are the DRAFT ladder.

   Run: node tests/test-trendmx-trendform-v1048.mjs */
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
  Object.assign(ctx, extra || {});
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
  /* mirrors the real scan (trendtable.js line ~1210): a row with a majority
     direction carries its gate evaluation; a forming row carries null. */
  const hasDir = Math.abs(score) >= 2;
  return {
    sym: sym, score: score, exchange: exchange || 'coindcx',
    comps: { d200: score > 0 ? 1 : (score < 0 ? -1 : 0), x: 0, h4: 0, cloud: 0, adx: 0 },
    adx: 24, price: 100 + Math.abs(score) * 2,
    gate: hasDir ? { label: 'trend', clean7: false, nearClean: false, veto: false, gatesPassed: 5 } : null,
    rows4h: mkRows(60, score >= 0 ? 0.05 : -0.05)
  };
}
const FIX = [
  row('CX1', 3), row('CX2', -4),          /* trending */
  row('CX3', 1), row('CX4', -1), row('CX5', 0),   /* forming */
  row('DX1', 5, 'delta')                  /* not coindcx — excluded */
];

console.log('== the board splits CoinDCX rows into TRENDING / FORMING with TP/SL ==');
{
  const W = boot();
  ok(typeof W.trendmxTrendFormHTML === 'function', 'trendmxTrendFormHTML is exported for tests');
  const html = W.trendmxTrendFormHTML(FIX);
  ok(html.indexOf('TRENDING') >= 0 && html.indexOf('2 contracts') >= 0, 'TRENDING column groups the two majority rows with its count');
  ok(html.indexOf('FORMING') >= 0 && html.indexOf('3 contracts') >= 0, 'FORMING column groups the three forming rows with its count');
  ok(html.indexOf('CX1') >= 0 && html.indexOf('LONG') >= 0, 'the +3 row tags LONG');
  ok(html.indexOf('CX2') >= 0 && html.indexOf('SHORT') >= 0, 'the -4 row tags SHORT');
  ok(html.indexOf('CX2') < html.indexOf('CX1'), 'TRENDING orders by |composite| (4 before 3)');
  ok(html.indexOf('LONG-LEAN') >= 0 && html.indexOf('CX3') >= 0, 'the +1 row tags LONG-LEAN');
  ok(html.indexOf('SHORT-LEAN') >= 0 && html.indexOf('CX4') >= 0, 'the -1 row tags SHORT-LEAN');
  ok(html.indexOf('NO LEAN') >= 0 && html.indexOf('composite 0/5') >= 0, 'the 0 row names no lean and no levels');
  ok(html.indexOf('DX1') < 0, 'a Delta row never lands on the CoinDCX board');
  const tIdx = html.indexOf('TRENDING'), fIdx = html.indexOf('FORMING');
  ok(tIdx >= 0 && fIdx > tIdx, 'the columns render TRENDING before FORMING');
}

console.log('== the levels: minted plan or the honest DRAFT ladder ==');
{
  const W = boot();
  const html = W.trendmxTrendFormHTML(FIX);
  /* The fixture rows are 5/7 (below the 6/7 NEAR floor) and the forming rows
     carry no majority (gate null), so every direction-bearing row prints the
     house DRAFT ladder — levels stamped DRAFT, never a fabricated NEAR. */
  ok((html.match(/ENTRY /g) || []).length === 4, 'every direction-bearing row prints ENTRY (4 of them)');
  ok((html.match(/STOP /g) || []).length === 4, 'every direction-bearing row prints STOP');
  ok((html.match(/T1 /g) || []).length === 4, 'every direction-bearing row prints T1');
  ok((html.match(/T2 /g) || []).length === 4, 'every direction-bearing row prints T2');
  ok(html.indexOf(' - DRAFT') >= 0, 'a below-6/7 or no-majority row stamps DRAFT');
  ok(html.indexOf('5/7 NEAR') < 0 && html.indexOf('6/7 NEAR') < 0, 'a 5/7 row never prints a NEAR stamp');
  ok(html.indexOf('7/7 CLEAN') < 0, 'a 5/7 row never prints a CLEAN stamp');
  /* the minted tiers keep their real labels: 7/7 CLEAN and 6/7 NEAR */
  const cleanRow = row('CX7', 3); cleanRow.gate = { label: '7/7 CLEAN', clean7: true, nearClean: false, veto: false, gatesPassed: 7 };
  const nearRow = row('CX8', 3); nearRow.gate = { label: '6/7 NEAR', clean7: false, nearClean: true, veto: false, gatesPassed: 6 };
  const html3 = W.trendmxTrendFormHTML([cleanRow, nearRow]);
  ok(html3.indexOf('7/7 CLEAN') >= 0, 'a 7/7 gate-clean row keeps 7/7 CLEAN');
  ok(html3.indexOf('6/7 NEAR') >= 0, 'a 6/7 row keeps the real 6/7 NEAR');
  ok(html3.indexOf(' - DRAFT') < 0, 'a minted-tier row never stamps DRAFT');
  const bareRow = row('CX6', 2);
  bareRow.rows4h = null;
  const html2 = W.trendmxTrendFormHTML([bareRow]);
  ok(html2.indexOf('no levels - the gates have not met') >= 0, 'a row with no tape says no levels, honestly');
}

console.log('== the scan merges ALL CoinDCX futures + wiring pins ==');
{
  const src = read('trendtable.combined.js');
  ok(src.indexOf('minTurnover: 0, includeUnknown: true') >= 0, 'the scan re-reads the universe at floor 0');
  /* hg-v1074: the floor-0 pass reads the RAW CoinDCX leg, not the deduped
     merged universe (which tags one 'exchange' per base and hides CoinDCX
     contracts also listed on Delta/Startrader). */
  ok(src.indexOf('hgDeskLoadCoinDCXAll') >= 0, 'the floor-0 read uses the raw CoinDCX leg (hgDeskLoadCoinDCXAll)');
  ok(src.indexOf('ALL COINDCX FUTURES') >= 0, 'the merge documents itself');
  ok(src.indexOf('gates + /7 NEAR') >= 0 || src.indexOf('gates + \'/7 NEAR\'') >= 0, 'the NEAR stamp reads the real gate count');
  ok(src.indexOf("W.trendmxTrendFormHTML = trendmxTrendFormHTML") >= 0, 'the seam export is pinned');
  ok(src.indexOf("data-r=\"trendform\"") >= 0, 'the section mount exists');
}

console.log('\ntest-trendmx-trendform-v1048: ' + passed + ' passed, 0 failed');
