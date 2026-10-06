/* HARDGATE — hg-v1144: FREE RESOURCES for TREND MATRIX + GOLD SCALP.

   TREND MATRIX: the shared-perfect pass now also reads the Deribit options
   vol index (public), the Coinglass free-tier liquidation clusters and the
   venue premium (venue funding vs the Binance twin) - stamped into the
   row's perfectReads bag and printed by the crown's TECHNICAL/MICRO dims.
   GOLD SCALP: a zero-touch panel (gold-free-evidence.js) shows silver,
   DXY, the US 10Y real yield + real-rate hint, XAUUSDT open interest and
   DVOL - every feed free and already fetched by the house.

   Run: node tests/test-free-resources-v1144.mjs */
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
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setInterval, clearInterval, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js',
                   'hg-setup-core.js', 'crypto-position-risk.js', 'cryptogates.js',
                   'plans.js', 'setup-ui.js', 'trendtable.combined.js', 'gold-free-evidence.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  if (ctx.hgGoldFreeEvidenceStop) ctx.hgGoldFreeEvidenceStop();   /* the module's refresh timer must not hold the test process open */
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
function row(sym, score){
  return { sym, base: 'BTC', score, exchange: 'delta',
    comps: { d200: 1, x: 1, h4: 1, cloud: 1, adx: 0 }, adx: 28, price: 103, fundingPct: 0.002,
    gate: { label: 'trend', clean7: true, veto: false, gatesPassed: 7 },
    rows4h: mkRows(220, 0.05) };
}

console.log('== the free-resource reads ride the shared-perfect pass ==');
{
  const cap = {};
  const W = boot({
    binanceTakerRatio: async () => ({ series: [] }),
    binanceFunding: async () => ({ fundingPct: 0.001 }),
    hgNewsRisk: () => ({ blackout: false }),
    deribitVolState: () => ({ dvol: 55, dvolPrev: 52, regime: 'compression' }),
    coinglassClusters: { BTC: { usd: 42000000 }, BTCUSDT: { total: 1000000 } },
    hgObtcPerfectFormation: (pick, reads) => { cap.reads = reads; }
  });
  await W.trendmxPerfectEvidencePass([row('BTCUSD', 3)]);
  ok(cap.reads.dvolVal === 55 && cap.reads.dvolRegime === 'compression', 'the DVOL read rides the bag');
  ok(Math.abs(cap.reads.venuePremiumPct - 0.001) < 1e-9, 'the venue premium reads venue minus the Binance twin (0.002 - 0.001)');
  ok(cap.reads.liqClusterUsd === 42000000, 'the Coinglass free-tier cluster USD rides the bag');
}

console.log('== the crown prints the free-resource lines ==');
{
  const W = boot({
    hgProvenEdgeVerdict: () => ({ state: 'proven', n: 40, hit: 0.55, expR: 0.3, floor: 20 }),
    hgProvenEdgeChipHtml: v => 'CHIP',
    getWorldMonitorDeskCached: () => ({ macro: { verdict: 'BUY' }, stress: { label: 'LOW' } }),
    regimeState: () => ({ playbook: { bias: 'LONG-ONLY' } })
  });
  const r = row('BTCUSD', 3);
  r.perfectReads = { dvolVal: 55, dvolRegime: 'compression', venuePremiumPct: 0.001, liqClusterUsd: 42000000 };
  const html = W.trendmxCrownPanelHTML({ rows: [r] });
  ok(html.indexOf('DVOL 55.0 compression') >= 0, 'the crown TECHNICAL prints the DVOL line');
  ok(html.indexOf('venue premium +0.0010%') >= 0 && html.indexOf('liq cluster 42000000 USD') >= 0, 'the crown MICRO prints the premium + cluster lines');
}

console.log('== the GOLD SCALP free-resources panel reads every free feed ==');
{
  const cap = {};
  const W = boot({
    getGoldMacroCached: async () => { cap.macro = true; return { silver: { dir: 'UP' }, dxy: { trend20: 'FALLING' }, realYield: 1.42, realRateHint: 'supportive' }; },
    binanceOI: async (s) => { cap.oi = s; return { openInterest: 123456 }; },
    deribitVolState: () => { cap.dvol = true; return { dvol: 55, regime: 'expansion' }; }
  });
  ok(typeof W.hgGoldFreeEvidence === 'function' && typeof W.hgGoldFreeEvidencePanelHtml === 'function', 'the gold free-resources seams are exported');
  const s = await W.hgGoldFreeEvidence();
  ok(s && s.silverDir === 'UP' && s.dxyTrend === 'FALLING', 'silver + DXY read from the free macro chain');
  ok(s.realYield === 1.42 && s.realRateHint === 'supportive', 'the real yield + hint read');
  ok(s.xauOi === 123456 && cap.oi === 'XAUUSDT', 'the XAUUSDT open interest reads from Binance');
  ok(s.dvol === 55 && s.dvolRegime === 'expansion', 'DVOL reads from Deribit');
  const html = W.hgGoldFreeEvidencePanelHtml();
  ok(html.indexOf('FREE RESOURCES') >= 0 && html.indexOf('Silver XAG') >= 0 && html.indexOf('real yield') >= 0, 'the panel prints every free line');
  ok(W.HG_warmups.some(w => w.id === 'goldfree'), 'the pass joins the warmup cycle');
}

console.log('== wiring pins ==');
{
  const t = read('trendtable-src-10.js');
  ok(t.indexOf('deribitVolState') >= 0 && t.indexOf('coinglassClusters') >= 0 && t.indexOf('venuePremiumPct') >= 0, 'the pass reads all three free resources');
  const c = read('trendtable-src-9.js');
  ok(c.indexOf('pfR.dvolVal') >= 0, 'the crown renders the bag');
  const g = read('gold-free-evidence.js');
  ok(g.indexOf('getGoldMacroCached') >= 0 && g.indexOf('binanceOI') >= 0, 'the gold panel reads the free seams');
}

console.log('\ntest-free-resources-v1144: ' + passed + ' passed, 0 failed');
