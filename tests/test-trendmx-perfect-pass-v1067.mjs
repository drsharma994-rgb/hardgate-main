/* HARDGATE — hg-v1067: THE SHARED PERFECT EVIDENCE PASS ON TREND MATRIX.

   The matrix's strongest rows now run through the SAME reads bag and the
   SAME enrichment + predicate OMNIBTC consumes (W.hgObtcPerfectFormation),
   fed by the same external data: real Binance taker flow, Binance funding,
   the ATR percentile regime, EMA50/200 structure, session RVOL and the
   news calendar. A PERFECT / PERFECT+ stamp on a matrix row now means
   byte-identically what it means on OMNIBTC. Evidence, never a gate.

   Run: node tests/test-trendmx-perfect-pass-v1067.mjs */
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
                   'plans.js', 'setup-ui.js', 'trendtable.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

const T4 = 14400;
function mkRows(n, slope, vol){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * slope;
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c - 0.02, h: c + 0.4, l: c - 0.4, c, v: vol });
  }
  return rows;
}
function row(sym, score){
  return { sym, score, exchange: 'delta',
    comps: { d200: score > 0 ? 1 : -1, x: score > 0 ? 1 : -1, h4: score > 0 ? 1 : -1, cloud: score > 0 ? 1 : -1, adx: 0 },
    adx: 28, price: 100 + score, fundingPct: -0.002,
    gate: { label: 'trend', clean7: true, veto: false, gatesPassed: 7 },
    rows4h: mkRows(220, 0.05, 100) };
}
const TSERIES = (function(){ const s = []; for (let k = 119; k >= 0; k--) s.push({ buySellRatio: k < 60 ? 1.0 : 1.25, t: 1760000000 - k * T4 }); return s; })();

console.log('== the pass runs the SAME stack and stamps the SAME badges ==');
{
  const cap = {};
  const W = boot({
    binanceTakerRatio: async () => { cap.takerAsked = true; return { series: TSERIES }; },
    binanceFunding: async () => { cap.fundAsked = true; return { fundingPct: 0.004 }; },
    hgNewsRisk: () => ({ blackout: false }),
    hgObtcPerfectFormation: (pick, reads) => {   /* the OMNIBTC seam is stubbed here - its own tests cover the real one */
      cap.reads = reads;
      pick.row.perfect = true; pick.row.perfectPlus = true; pick.row.perfectReads = reads;
    }
  });
  const rows = [row('BTCUSD', 3), row('ETHUSD', 2), row('SOLUSD', 1), row('XRPUSD', -1),
    row('ADAUSD', -2), row('DOTUSD', -3), row('LTCUSD', 2), row('BCHUSD', 2), row('AVAXUSD', 2)];
  await W.trendmxPerfectEvidencePass(rows);
  ok(cap.takerAsked === true && cap.fundAsked === true, 'the same external data is fetched (real taker flow + Binance funding)');
  ok(rows[0].perfect === true && rows[0].perfectPlus === true, 'the strongest row carries the shared PERFECT+ badge');
  ok(cap.reads && cap.reads.takerFlowVerdict, 'the taker-flow leg reads from the real series (' + cap.reads.takerFlowVerdict + ')');
  ok(cap.reads && cap.reads.atrRegime, 'the ATR-percentile regime leg reads (' + cap.reads.atrRegime + ')');
  ok(cap.reads && cap.reads.structureTrend, 'the EMA50/200 structure leg reads (' + cap.reads.structureTrend + ')');
  ok(cap.reads && cap.reads.sess && isFinite(cap.reads.volumeRvol), 'the session + volume witness legs read');
  /* XRPUSD (|score| 1) sorts below the eight stronger rows and is excluded */
  ok(rows[3] && rows[3].sym === 'XRPUSD' && rows[3].perfect !== true, 'the pass caps at the 8 strongest rows - the rest stay unjudged');
}

console.log('== the shared seam absent degrades to no stamps, never a crash ==');
{
  const W = boot({});
  const rows = [row('BTCUSD', 3)];
  await W.trendmxPerfectEvidencePass(rows);
  ok(rows[0].perfect !== true, 'no OMNIBTC seam, no stamp - and the scan still completes');
}

console.log('== wiring pins ==');
{
  const src = read('trendtable.js');
  ok(src.indexOf('async function trendmxPerfectEvidencePass') >= 0, 'the pass is defined');
  ok(src.indexOf('hgObtcPerfectFormation') >= 0, 'the pass consumes the OMNIBTC enrichment + predicate');
  ok(src.indexOf("binanceTakerRatio('BTCUSDT', '4h', 120)") >= 0, 'the pass fetches the real taker series');
  ok(src.indexOf('await trendmxPerfectEvidencePass(core.rows)') >= 0, 'the pass runs inside the scan');
  ok(src.indexOf('PERFECT+') >= 0, 'the crown verdict shows the shared PERFECT+ badge');
}

console.log('\ntest-trendmx-perfect-pass-v1067: ' + passed + ' passed, 0 failed');
