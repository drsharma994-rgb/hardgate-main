/* HARDGATE — carry.js unit tests (Node 18+, builtins only).
   Loads carry.js as a classic script inside a vm context with a `window`
   stub (exactly like the browser's <script> globals) and asserts:
     1) the pure window.carrySpread classifier across every branch
     2) the window.HG_tabs registration shape
     3) mount() smoke (stub DOM, no throw, feature-gate behavior)
     4) the full scan pipeline with stubbed fetch/globals (happy path,
        hard fetch failure, degraded missing-global path) — no live network.
   Run: node tests/test-carry.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(root, 'carry.js'), 'utf8');
const IND_SRC = readFileSync(path.join(root, 'indicators.js'), 'utf8');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
function approx(a, b, eps, msg){
  assert(isFinite(a) && Math.abs(a - b) <= eps, msg + ' (got ' + a + ', want ~' + b + ')');
}

/* ---------------- context / stub factories ---------------- */
function makeCtx(extra){
  const base = {
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
    // NOTE: no fetch / AbortController / binance* unless `extra` adds them,
    // so load-time feature-checks are exercised too.
  };
  return vm.createContext(Object.assign(Object.create(null), base, extra || {}));
}
function loadModule(ctx){
  vm.runInContext(SRC, ctx, { filename: 'carry.js' });
  return ctx.window;
}
/* minimal DOM stub: mount() only uses innerHTML + el.querySelector + element
   {style, textContent, disabled, addEventListener, firstElementChild} */
function stubEl(){
  return {
    innerHTML: '', textContent: '', style: {}, disabled: false,
    firstElementChild: { style: {} },
    _kids: {},
    addEventListener: function(ev, fn){ this._click = fn; },
    querySelector: function(sel){
      if (!this._kids[sel]) this._kids[sel] = stubEl();
      return this._kids[sel];
    }
  };
}
function fetchRouter(routes){
  return async function(url){
    for (const r of routes){
      if (url.indexOf(r.match) >= 0){
        if (r.fail) return { ok: false, status: 500, json: async function(){ return null; } };
        const body = (typeof r.body === 'function') ? r.body(url) : r.body;
        return { ok: true, status: 200, json: async function(){ return body; } };
      }
    }
    return { ok: false, status: 404, json: async function(){ return null; } };
  };
}

/* ---------------- synthetic market data ---------------- */
const PREMIUM = [
  { symbol: 'BTCUSDT', lastFundingRate: '0.0001',  markPrice: '60000', nextFundingTime: 0 },
  { symbol: 'ETHUSDT', lastFundingRate: '-0.0002', markPrice: '3000',  nextFundingTime: 0 },
  { symbol: 'SOLUSDT', lastFundingRate: '0.001',   markPrice: '150',   nextFundingTime: 0 },
  { symbol: 'DOGEUSDT', lastFundingRate: '0.0005', markPrice: '0.12',  nextFundingTime: 0 },
  { symbol: 'XRPUSDT', lastFundingRate: '-0.00005', markPrice: '0.5',  nextFundingTime: 0 },
  { symbol: 'ADAUSDT', lastFundingRate: '0.0002',  markPrice: '0.4',   nextFundingTime: 0 },
  { symbol: 'LOWUSDT', lastFundingRate: '0.009',   markPrice: '1',     nextFundingTime: 0 }, // gated by turnover
  { symbol: 'BTCBUSD', lastFundingRate: '0.005',   markPrice: '60000', nextFundingTime: 0 }  // gated by USDT filter
];
const TICKERS = {
  BTCUSDT: { symbol: 'BTCUSDT', mark: 60000, chg24: 1, turnoverUsd: 3.0e9 },
  ETHUSDT: { symbol: 'ETHUSDT', mark: 3000,  chg24: 1, turnoverUsd: 2.0e9 },
  SOLUSDT: { symbol: 'SOLUSDT', mark: 150,   chg24: 1, turnoverUsd: 1.5e9 },
  DOGEUSDT:{ symbol: 'DOGEUSDT', mark: 0.12, chg24: 1, turnoverUsd: 8.0e8 },
  XRPUSDT: { symbol: 'XRPUSDT', mark: 0.5,   chg24: 1, turnoverUsd: 9.0e8 },
  ADAUSDT: { symbol: 'ADAUSDT', mark: 0.4,   chg24: 1, turnoverUsd: 5.0e8 },
  LOWUSDT: { symbol: 'LOWUSDT', mark: 1,     chg24: 1, turnoverUsd: 5.0e6 }
};
const HIST_RATE = { BTCUSDT: '0.0001', ETHUSDT: '-0.0002', SOLUSDT: '0.001',
                    DOGEUSDT: '0.0005', XRPUSDT: '-0.00005', ADAUSDT: '0.0002', LOWUSDT: '0.009' };
function histBody(url){
  const m = /[?&]symbol=([^&]+)/.exec(url);
  const sym = m ? m[1] : '';
  const rate = HIST_RATE[sym] || '0';
  const out = [];
  for (let i = 0; i < 30; i++) out.push({ symbol: sym, fundingRate: rate, fundingTime: 1700000000000 + i*28800000 });
  return out;
}
const DELTA = { result: [
  { symbol: 'BTCUSD',  funding_rate: '0.05',  turnover_usd: '1000000' },  // spread 43.8  -> card
  { symbol: 'SOLUSD',  funding_rate: '0.5',   turnover_usd: '900000' },   // spread 438   -> card
  { symbol: 'ETHUSD',  funding_rate: '-0.02', turnover_usd: '500000' },   // spread 0     -> matched, no card
  { symbol: 'DOGEUSD', funding_rate: '0.055', turnover_usd: '300000' }    // spread 5.475 -> below threshold
] };
function happyCtx(){
  return makeCtx({
    AbortController: AbortController,
    fetch: fetchRouter([
      { match: 'premiumIndex', body: PREMIUM },
      { match: 'fundingRate?symbol=', body: histBody },
      { match: 'delta.exchange', body: DELTA }
    ]),
    binanceTickers24h: async function(){ return TICKERS; },
    binanceLongShort: async function(){
      return { latest: { longPct: 62.5, shortPct: 37.5, ratio: 1.67, t: 1 }, series: [] };
    }
  });
}
async function runScanIn(ctx){
  const w = loadModule(ctx);
  const el = stubEl();
  w.HG_tabs[0].mount(el);
  const btn = el.querySelector('#carryRun');
  await btn._click(); // click handler returns the scan promise
  return el;
}

/* ================================================================
   1) PURE CLASSIFIER — window.carrySpread
================================================================ */
console.log('--- carrySpread: direction branches ---');
{
  const w = loadModule(makeCtx());
  const cs = w.carrySpread;
  assert(typeof cs === 'function', 'window.carrySpread exported');

  // both positive, delta higher -> short delta, long binance
  let r = cs(0.05, 0.01);
  approx(r.deltaAPR, 54.75, 1e-9, 'deltaAPR = 0.05 * 3 * 365');
  approx(r.binanceAPR, 10.95, 1e-9, 'binanceAPR = 0.01 * 3 * 365');
  approx(r.spreadAPR, 43.8, 1e-9, 'spreadAPR = |54.75 - 10.95|');
  assert(r.shortVenue === 'delta' && r.longVenue === 'binance', 'delta higher -> SHORT delta + LONG binance');

  // both positive, binance higher -> short binance, long delta
  r = cs(0.01, 0.05);
  assert(r.shortVenue === 'binance' && r.longVenue === 'delta', 'binance higher -> SHORT binance + LONG delta');
  approx(r.spreadAPR, 43.8, 1e-9, 'spread symmetric in venue order');

  // delta negative, binance positive -> short binance, spread = sum of magnitudes
  r = cs(-0.05, 0.05);
  approx(r.deltaAPR, -54.75, 1e-9, 'negative delta rate annualizes negative');
  approx(r.spreadAPR, 109.5, 1e-9, 'opposite signs -> spread is the sum');
  assert(r.shortVenue === 'binance' && r.longVenue === 'delta', 'positive venue is the short leg');

  // both negative, delta more negative -> binance is still the short (higher) leg
  r = cs(-0.10, -0.02);
  approx(r.spreadAPR, 87.6, 1e-9, 'both negative: spread = |deltaAPR - binanceAPR|');
  assert(r.shortVenue === 'binance' && r.longVenue === 'delta', 'less-negative venue shorts');

  // zero handling
  r = cs(0, 0.01);
  assert(r.shortVenue === 'binance' && r.longVenue === 'delta', 'zero delta vs positive binance -> short binance');
  approx(r.spreadAPR, 10.95, 1e-9, 'zero delta: spread = binance APR');

  // exact tie -> spread 0, deterministic delta-first assignment
  r = cs(0.02, 0.02);
  assert(r.spreadAPR === 0, 'equal rates -> zero spread');
  assert(r.shortVenue === 'delta' && r.longVenue === 'binance', 'tie breaks to delta deterministically');
  r = cs(0, 0);
  assert(r.spreadAPR === 0 && r.shortVenue === 'delta', 'zero/zero tie -> delta, no NaN');

  // deadzone-scale rates (tiny but nonzero)
  r = cs(0.0001, -0.0001);
  approx(r.spreadAPR, 0.219, 1e-9, 'tiny rates still annualize (0.1095 - -0.1095)');
  assert(r.shortVenue === 'delta', 'tiny positive delta beats tiny negative binance');

  // boundary: spread exactly ~25% APR (card threshold)
  r = cs(0.1 + 25/1095, 0.1);
  approx(r.spreadAPR, 25, 1e-6, 'spread lands on the 25% APR boundary');

  // large magnitudes
  r = cs(1.0, -1.0);
  approx(r.spreadAPR, 2190, 1e-9, 'extreme rates: ±1095% APR, spread 2190');
  assert(r.shortVenue === 'delta', 'extreme positive delta -> short delta');

  // exact key set
  assert(JSON.stringify(Object.keys(r).sort()) ===
    JSON.stringify(['binanceAPR', 'deltaAPR', 'longVenue', 'shortVenue', 'spreadAPR']),
    'result has exactly the five contracted keys');
}

console.log('--- carrySpread: invalid inputs -> null ---');
{
  const cs = loadModule(makeCtx()).carrySpread;
  assert(cs(null, 0.01) === null, 'null delta -> null');
  assert(cs(0.01, null) === null, 'null binance -> null');
  assert(cs(null, null) === null, 'null/null -> null');
  assert(cs(NaN, 0.01) === null, 'NaN delta -> null');
  assert(cs(0.01, NaN) === null, 'NaN binance -> null');
  assert(cs(undefined, 0.01) === null, 'undefined -> null');
  assert(cs('0.05', 0.01) === null, 'numeric string rejected (strict number typing)');
  assert(cs(0.05, '0.01') === null, 'string binance rejected');
  assert(cs(Infinity, 0.01) === null, 'Infinity -> null');
  assert(cs(0.01, -Infinity) === null, '-Infinity -> null');
  assert(cs({}, []) === null, 'object/array -> null');
}

console.log('--- carrySpreadPair + carryBybitCrossCheck ---');
{
  const w = loadModule(makeCtx());
  assert(typeof w.carrySpreadPair === 'function', 'carrySpreadPair exported');
  assert(typeof w.carryBybitCrossCheck === 'function', 'carryBybitCrossCheck exported');
  const p = w.carrySpreadPair(0.02, 0.05, 'binance', 'bybit', 8, 8);
  assert(p && p.pair === 'binance-bybit' && p.shortVenue === 'bybit', 'binance-bybit pair classifies short on richer leg');
  const cc = w.carryBybitCrossCheck({ binanceAPR: 20, deltaAPR: 40 }, 0.03);
  assert(cc && cc.status === 'confirms', 'bybit between binance and delta -> confirms');
  const cc2 = w.carryBybitCrossCheck({ binanceAPR: 20, deltaAPR: 40 }, 0.5);
  assert(cc2 && cc2.status === 'conflicts', 'bybit richest -> conflicts');
}

/* ================================================================
   2) TAB REGISTRATION
================================================================ */
console.log('--- HG_tabs registration ---');
{
  const w = loadModule(makeCtx());
  assert(Array.isArray(w.HG_tabs) && w.HG_tabs.length === 1, 'HG_tabs array created with one entry');
  const t = w.HG_tabs[0];
  assert(t.id === 'carry', 'tab id is carry');
  assert(t.label === 'CARRY', 'tab label is CARRY');
  assert(typeof t.mount === 'function', 'tab mount is a function');
}

/* ================================================================
   3) MOUNT SMOKE (stub DOM, no network globals at all)
================================================================ */
console.log('--- mount smoke ---');
{
  const w = loadModule(makeCtx()); // no fetch, no AbortController, no binance*
  const el = stubEl();
  let threw = false;
  try{ w.HG_tabs[0].mount(el); }catch(e){ threw = true; }
  assert(!threw, 'mount does not throw without any network globals');
  assert(el.innerHTML.indexOf('class="panel"') >= 0, 'mount builds a .panel');
  assert(el.innerHTML.indexOf('RUN CARRY SCAN') >= 0, 'RUN button present');
  assert(el.innerHTML.indexOf('id="carryProg"') >= 0, 'progress bar present');
  assert(el.innerHTML.indexOf('id="carryCards"') >= 0, 'output container present');
  const warn = el.querySelector('#carryWarn');
  assert(warn.style.display === 'block' && warn.textContent.indexOf('missing globals') >= 0,
    'missing-globals warn rendered');
  assert(el.querySelector('#carryRun').disabled === true, 'RUN disabled when fetch layer absent');
}

/* ================================================================
   4) FULL PIPELINE (stubbed fetch + globals)
================================================================ */
console.log('--- scan: happy path ---');
{
  const el = await runScanIn(happyCtx());
  const stat = el.querySelector('#carryStat').textContent;
  assert(stat.indexOf('done') === 0, 'status line completes: "' + stat + '"');
  assert(stat.indexOf('6 binance perps deep-scanned') >= 0, 'USDT filter + $20M turnover gate leave 6 perps');
  assert(stat.indexOf('4 delta perps') >= 0, 'delta leg parsed 4 perpetuals');
  assert(stat.indexOf('4 matched') >= 0, 'base-name matching pairs BTC/ETH/SOL/DOGE');
  assert(stat.indexOf('2 spreads') >= 0, 'exactly 2 spreads clear the 25% APR threshold');
  assert(el.querySelector('#carryWarn').style.display === 'none', 'no warnings on happy path');

  const cards = el.querySelector('#carryCards').innerHTML;
  assert(cards.indexOf('card long') >= 0, 'scanner card markup used');
  assert(cards.indexOf('LEVELS unavailable') >= 0,
    'SL/TP audit: no klines/atr globals -> honest levels-unavailable note on cards (nothing fabricated)');
  assert(cards.indexOf('SOL') >= 0 && cards.indexOf('SOL') < cards.indexOf('BTC'),
    'cards sorted by spreadAPR desc (SOL 438% before BTC 43.8%)');
  assert(cards.indexOf('SHORT perp on <b>DELTA</b>') >= 0, 'plan shorts the higher-funding venue');
  assert(cards.indexOf('LONG perp on <b>BINANCE</b>') >= 0, 'plan longs the lower-funding venue');
  assert(cards.indexOf('547.5%') >= 0, 'delta APR shown (0.5 * 3 * 365)');
  assert(cards.indexOf('BINANCE↔DELTA') >= 0 && cards.indexOf('delta-neutral') >= 0,
    'card labeled with pair + delta-neutral gate');
  assert(cards.indexOf('basis risk') >= 0 && cards.indexOf('0.05%/side/entry') >= 0 &&
         cards.indexOf('funding flips') >= 0 && cards.indexOf('counterparty') >= 0,
    'risk notes (basis, fees, flips, counterparty) on the card');
  assert(cards.indexOf('ETHUSD') < 0 && cards.indexOf('DOGEUSD') < 0,
    'zero-spread and below-threshold matches produce no card');

  const table = el.querySelector('#carryTableWrap').innerHTML;
  assert(table.indexOf('<table>') >= 0, 'binance-only payers table rendered');
  assert(table.indexOf('SOLUSDT') >= 0 && table.indexOf('SOLUSDT') < table.indexOf('BTCUSDT'),
    'table sorted by |APR| desc');
  assert(table.indexOf('LOWUSDT') < 0, 'turnover-gated symbol excluded from table');
  assert(table.indexOf('62.5%') >= 0, 'retail longPct column filled from binanceLongShort');
  assert(table.indexOf('shorting perp (delta-neutral: long spot)') >= 0, 'delta-neutral collection note present');
  assert(el.querySelector('#carryEmpty').style.display === 'none', 'empty block hidden when cards exist');
  assert(el.querySelector('#carryProg').style.display === 'none', 'progress hidden after run');
  assert(el.querySelector('#carryRun').disabled === false, 'RUN re-enabled after run');
}

console.log('--- scan: binance premiumIndex hard failure ---');
{
  const ctx = makeCtx({
    AbortController: AbortController,
    fetch: fetchRouter([{ match: 'premiumIndex', fail: true }]),
    binanceTickers24h: async function(){ return TICKERS; }
  });
  const el = await runScanIn(ctx);
  const warn = el.querySelector('#carryWarn');
  assert(warn.style.display === 'block' && warn.textContent.indexOf('premiumIndex fetch failed') >= 0,
    'hard LEG A failure -> .note.warn shown');
  assert(el.querySelector('#carryStat').textContent.indexOf('failed at binance premiumIndex') >= 0,
    'status line reports the failure honestly');
  assert(el.querySelector('#carryRun').disabled === false, 'RUN re-enabled after failure');
  assert(el.querySelector('#carryCards').innerHTML === '', 'no fabricated cards on failure');
}

console.log('--- scan: degraded (binanceTickers24h missing) ---');
{
  const ctx = makeCtx({
    AbortController: AbortController,
    fetch: fetchRouter([
      { match: 'premiumIndex', body: PREMIUM },
      { match: 'fundingRate?symbol=', body: histBody },
      { match: 'delta.exchange', body: DELTA }
    ])
    // binanceTickers24h intentionally absent; binanceLongShort absent too
  });
  const el = await runScanIn(ctx);
  const warn = el.querySelector('#carryWarn');
  assert(warn.style.display === 'block' && warn.textContent.indexOf('turnover gate skipped') >= 0,
    'missing binanceTickers24h -> graceful warn, scan continues');
  const cards = el.querySelector('#carryCards').innerHTML;
  assert(cards.indexOf('SOL') >= 0, 'cards still produced without the turnover gate');
  const table = el.querySelector('#carryTableWrap').innerHTML;
  assert(table.indexOf('LOWUSDT') >= 0, 'ungated universe now includes LOWUSDT');
  assert(table.indexOf('n/a') >= 0, 'retail column degrades to n/a without binanceLongShort');
  const stat = el.querySelector('#carryStat').textContent;
  assert(stat.indexOf('7 binance perps') >= 0, 'all 7 USDT perps scanned without gate');
}

console.log('--- scan: delta leg failure -> binance-only mode ---');
{
  const ctx = makeCtx({
    AbortController: AbortController,
    fetch: fetchRouter([
      { match: 'premiumIndex', body: PREMIUM },
      { match: 'fundingRate?symbol=', body: histBody },
      { match: 'delta.exchange', fail: true }
    ]),
    binanceTickers24h: async function(){ return TICKERS; },
    binanceLongShort: async function(){ return { latest: { longPct: 41, shortPct: 59, ratio: 0.7, t: 1 }, series: [] }; }
  });
  const el = await runScanIn(ctx);
  assert(el.querySelector('#carryWarn').textContent.indexOf('delta india tickers fetch failed') >= 0,
    'LEG B failure warned');
  assert(el.querySelector('#carryEmpty').style.display === 'block', 'empty block shown when no spread cards');
  assert(el.querySelector('#carryTableWrap').innerHTML.indexOf('<table>') >= 0,
    'binance-only table still rendered');
  assert(el.querySelector('#carryStat').textContent.indexOf('delta leg failed') >= 0,
    'status line notes the failed leg');
}

/* ================================================================
   5) FUNDING-INTERVAL FIX — scan with binanceFundingInfo present
================================================================ */
console.log('--- scan: fundingInfo intervals + cap proximity ---');
{
  /* SOLUSDT: verified 4h interval, tight 0.075% cap (current |rate| 0.1% > 80% of cap).
     ETHUSDT: verified 8h, cap chosen so |rate| lands EXACTLY on 80% -> NOT flagged.
     everything else: missing from the map -> assumed 8h. */
  const ctx = happyCtx();
  ctx.binanceFundingInfo = async function(){
    return {
      SOLUSDT: { intervalHours: 4, capPct: 0.075, floorPct: -0.075 },
      ETHUSDT: { intervalHours: 8, capPct: 0.025, floorPct: -0.025 }
    };
  };
  // NOTE: binanceFundingInfo must be a global inside the vm context, not a
  // property of window — happyCtx puts globals on the context itself.
  const w = loadModule(ctx);
  const el = stubEl();
  w.HG_tabs[0].mount(el);
  await el.querySelector('#carryRun')._click();

  const stat = el.querySelector('#carryStat').textContent;
  assert(stat.indexOf('done') === 0, 'scan completes with fundingInfo present');
  assert(stat.indexOf('2 spreads') >= 0, 'still exactly 2 spread cards (ETH 0, DOGE 5.475 unchanged)');

  const cards = el.querySelector('#carryCards').innerHTML;
  assert(cards.indexOf('SOL') >= 0 && cards.indexOf('SOL') < cards.indexOf('BTC'),
    'card order preserved (SOL spread |547.5 - 219| = 328.5 still tops BTC 43.8)');
  assert(cards.indexOf('4h settle') >= 0, 'SOL card shows its verified funding interval');
  assert(cards.indexOf('4h × 6 × 365') >= 0, 'gate pip annualizes with 6 prints/day for a 4h perp');
  assert(cards.indexOf('219.0%') >= 0, 'SOL binance APR fixed: 0.1% per 4h × 6 × 365 = 219.0%');
  assert(cards.indexOf('109.5%') < 0, 'bug regression: wrong 8h-annualized SOL APR (109.5%) is gone');
  assert(cards.indexOf('at cap — squeeze crowded') >= 0,
    'cap proximity note shown (|0.1%| > 80% of the 0.075% cap)');
  assert(cards.indexOf('8h settle (assumed 8h)') >= 0,
    'BTC (missing from fundingInfo) defaults to 8h and is labeled (assumed 8h)');
  assert(el.querySelector('#carryWarn').style.display === 'none',
    'fundingInfo healthy -> no interval warnings');

  const table = el.querySelector('#carryTableWrap').innerHTML;
  assert(table.indexOf('SOLUSDT (4h) ⚠') >= 0, 'table row: verified 4h interval + at-cap flag');
  assert(table.indexOf('BTCUSDT (8h*)') >= 0, 'table row: assumed interval starred');
  assert(table.indexOf('ETHUSDT (8h)') >= 0 && table.indexOf('ETHUSDT (8h) ⚠') < 0,
    'cap boundary: |rate| exactly 80% of cap is NOT flagged (strictly-greater test)');
  assert(table.indexOf('219.0%') >= 0, 'table APR column uses the 4h interval for SOL');
  assert(table.indexOf('assumed 8h') >= 0 && table.indexOf('at cap — squeeze crowded') >= 0,
    'table footnote explains the * and ⚠ markers');
  assert(table.indexOf('SOLUSDT') < table.indexOf('BTCUSDT'), 'table still sorted by |APR| desc');
}

console.log('--- scan: fundingInfo fetch failure -> assumed 8h everywhere ---');
{
  const ctx = happyCtx();
  ctx.binanceFundingInfo = async function(){ return null; };
  const w = loadModule(ctx);
  const el = stubEl();
  w.HG_tabs[0].mount(el);
  await el.querySelector('#carryRun')._click();

  const warn = el.querySelector('#carryWarn');
  assert(warn.style.display === 'block' && warn.textContent.indexOf('funding intervals assumed 8h') >= 0,
    'fundingInfo returning null -> honest warning');
  const cards = el.querySelector('#carryCards').innerHTML;
  assert(cards.indexOf('8h settle (assumed 8h)') >= 0, 'every card falls back to assumed 8h');
  assert(cards.indexOf('43.8%') >= 0 && cards.indexOf('547.5%') >= 0,
    'all spreads identical to the legacy 8h math when intervals are assumed');
  assert(el.querySelector('#carryStat').textContent.indexOf('done') === 0, 'scan still completes');
  assert(cards.indexOf('at cap — squeeze crowded') < 0, 'no cap flags without cap data');
}

/* ================================================================
   6) SL/TP AUDIT — window.carryPlan execution levels (pure)
================================================================ */
console.log('--- carryPlan: execution levels ---');
{
  const w = loadModule(makeCtx());
  const cp = w.carryPlan;
  assert(typeof cp === 'function', 'window.carryPlan exported');

  const p = cp({ entry: 60000, atr: 500, spreadAPR: 43.8, intervalHours: 8 });
  assert(p !== null, 'carryPlan: plan built on valid input');
  assert(p.entry === 60000 && p.atr === 500, 'carryPlan: entry/atr passthrough');
  approx(p.stopShort, 60000 + 2 * 500, 1e-9, 'carryPlan: stopShort = entry + 2xATR (short-leg price invalidation)');
  approx(p.stopLong, 60000 - 2 * 500, 1e-9, 'carryPlan: stopLong = entry - 2xATR (long-leg price invalidation)');
  assert(p.stopShort > p.entry && p.stopLong < p.entry, 'carryPlan: invalidation levels straddle the entry');
  assert(p.stopAtrMult === 2, 'carryPlan: stop ATR multiple exposed');
  approx(p.t1CapturePct, 43.8 * 7 / 365, 1e-9, 'carryPlan: T1 = 7 days of spread capture (% of notional)');
  approx(p.t2CapturePct, 43.8 * 30 / 365, 1e-9, 'carryPlan: T2 = 30 days of spread capture');
  approx(p.t1Px, 60000 * p.t1CapturePct / 100, 1e-9, 'carryPlan: T1 converted to a price equivalent');
  approx(p.t2Px, 60000 * p.t2CapturePct / 100, 1e-9, 'carryPlan: T2 converted to a price equivalent');
  approx(p.t1Atr, p.t1Px / 500, 1e-9, 'carryPlan: T1 expressed in ATR multiples');
  approx(p.t2Atr, p.t2Px / 500, 1e-9, 'carryPlan: T2 expressed in ATR multiples');
  assert(p.t1Days === 7 && p.t2Days === 30, 'carryPlan: capture horizons exposed (7d / 30d)');

  /* degenerate inputs -> null, no throw (strict number typing, house style) */
  assert(cp(null) === null && cp() === null && cp({}) === null, 'carryPlan(null/missing/{}) -> null');
  assert(cp({ entry: NaN, atr: 500, spreadAPR: 43.8, intervalHours: 8 }) === null, 'carryPlan: NaN entry -> null');
  assert(cp({ entry: 60000, atr: NaN, spreadAPR: 43.8, intervalHours: 8 }) === null, 'carryPlan: NaN atr -> null');
  assert(cp({ entry: 60000, atr: 500, spreadAPR: NaN, intervalHours: 8 }) === null, 'carryPlan: NaN spread -> null');
  assert(cp({ entry: 60000, atr: 500, spreadAPR: 43.8, intervalHours: NaN }) === null, 'carryPlan: NaN interval -> null');
  assert(cp({ entry: 0, atr: 500, spreadAPR: 43.8, intervalHours: 8 }) === null, 'carryPlan: entry <= 0 -> null');
  assert(cp({ entry: 60000, atr: 0, spreadAPR: 43.8, intervalHours: 8 }) === null, 'carryPlan: atr = 0 -> null');
  assert(cp({ entry: 60000, atr: -5, spreadAPR: 43.8, intervalHours: 8 }) === null, 'carryPlan: negative atr -> null');
  assert(cp({ entry: 60000, atr: 500, spreadAPR: 0, intervalHours: 8 }) === null, 'carryPlan: zero spread -> null (no capture to plan)');
  assert(cp({ entry: 60000, atr: 500, spreadAPR: -10, intervalHours: 8 }) === null, 'carryPlan: negative spread -> null');
  assert(cp({ entry: 60000, atr: 500, spreadAPR: 43.8, intervalHours: 0 }) === null, 'carryPlan: interval 0 -> null');
  assert(cp({ entry: '60000', atr: 500, spreadAPR: 43.8, intervalHours: 8 }) === null, 'carryPlan: numeric string rejected (strict typing)');
  assert(cp({ entry: Infinity, atr: 500, spreadAPR: 43.8, intervalHours: 8 }) === null, 'carryPlan: Infinity -> null');
}

/* ================================================================
   6b) PAPER BOOK — carryBookBtn (short carry leg → macro fund)
================================================================ */
console.log('--- carryBookBtn: macro fund CTA ---');
{
  const ctx = makeCtx();
  ctx.bookBtnHTML = function(sym, dir, entry, stop, t1, meta){
    return '<button class="toBook" data-fund="' + (meta && meta.fund) + '">' + sym + ':' + dir + '</button>';
  };
  const w = loadModule(ctx);
  const lv = w.carryPlan({ entry: 60000, atr: 500, spreadAPR: 43.8, intervalHours: 8 });
  const btn = w.carryBookBtn({
    pair: 'bin-delta',
    sp: { shortVenue: 'delta', longVenue: 'binance' },
    del: { symbol: 'BTCUSD' },
    bin: { symbol: 'BTCUSDT' },
    levels: lv
  });
  assert(typeof w.carryBookBtn === 'function', 'window.carryBookBtn exported');
  w.hgBookStampChip = function(sym, dir){
    return '<span class="hg-book-stamp" data-hg-book-sym="' + sym + '" data-hg-book-dir="' + dir + '">IN BOOK SLOT</span>';
  };
  assert(SRC.indexOf('carryBookStamp') >= 0, 'carryBookStamp helper present in carry.js');
  assert(btn.indexOf('toBook') >= 0 && btn.indexOf('BTCUSD') >= 0, 'carryBookBtn: books short leg desk sym');
  assert(btn.indexOf('macro') >= 0, 'carryBookBtn: macro fund pinned');
  assert(w.carryBookBtn({ levels: null }) === '', 'carryBookBtn: no levels → no button');
  w.hgToTradePlanOnclickAttr = function(sym, dir, entry, stop, t1, meta){
    return 'hgToTradePlan(' + JSON.stringify(sym) + ')';
  };
  const tradeBtn = w.carryTradeBtn({
    sp: { shortVenue: 'delta', longVenue: 'binance' },
    del: { symbol: 'BTCUSD' }, bin: { symbol: 'BTCUSDT' }, pair: 'bin-delta',
    levels: lv
  });
  assert(typeof w.carryTradeBtn === 'function', 'window.carryTradeBtn exported');
  assert(tradeBtn.indexOf('toTrade') >= 0 && tradeBtn.indexOf('SEND TO TRADE PLAN') >= 0, 'carryTradeBtn: trade handoff button');
  assert(tradeBtn.indexOf('hgToTradePlan') >= 0, 'carryTradeBtn: uses hgToTradePlan handoff');
}

/* ================================================================
   7) SL/TP AUDIT — scan renders per-card LEVELS when klines+atr exist
================================================================ */
console.log('--- scan: execution levels rendered when klines+atr available ---');
{
  const ctx = happyCtx();
  vm.runInContext(IND_SRC, ctx, { filename: 'indicators.js' });   // real atr()
  /* deterministic 4h rows: constant TR = 8 -> atr14 = 8 exactly */
  ctx.binanceKlines = async function(sym){
    const base = (sym === 'BTCUSDT') ? 60000 : (sym === 'SOLUSDT') ? 150 : 100;
    const out = [];
    for (let i = 0; i < 60; i++) out.push({ t: 1700000000 + i * 14400, o: base, h: base + 4, l: base - 4, c: base, v: 1000 });
    return out;
  };
  ctx.window.hgBookStampChip = function(sym, dir){
    return '<span class="hg-book-stamp" data-hg-book-sym="' + sym + '" data-hg-book-dir="' + dir + '">IN BOOK SLOT</span>';
  };
  const w = loadModule(ctx);
  const el = stubEl();
  w.HG_tabs[0].mount(el);
  await el.querySelector('#carryRun')._click();

  const cards = el.querySelector('#carryCards').innerHTML;
  const flat = cards.replace(/,/g, '');   // locale-independent number matching
  assert(cards.indexOf('LEVELS unavailable') < 0, 'levels rendered on every card (no unavailable fallback)');
  assert(cards.indexOf('LEVELS — ENTRY short') >= 0, 'card levels block: ENTRY legs description');
  assert(cards.indexOf('STOP <b>') >= 0 && cards.indexOf('T1 ') >= 0 && cards.indexOf('T2 ') >= 0,
    'card levels markup contains STOP + T1 + T2');
  assert(flat.indexOf('STOP <b>166</b> short leg / <b>134</b> long leg') >= 0,
    'SOL card: stop = ref 150 ± 2xATR8 (price invalidation both legs)');
  assert(flat.indexOf('STOP <b>60016</b> short leg / <b>59984</b> long leg') >= 0,
    'BTC card: stop = ref 60000 ± 2xATR8');
  assert(cards.indexOf('funding sign flip at the next 8h print = exit both legs') >= 0,
    'STOP rule quantified: 2xATR move OR funding sign flip = exit');
  assert(cards.indexOf('T1 7d capture ≈ <b>8.40%</b>') >= 0,
    'SOL card: T1 = 7d of 438% APR spread = 8.40% of notional');
  assert(cards.indexOf('T1 7d capture ≈ <b>0.84%</b>') >= 0,
    'BTC card: T1 = 7d of 43.8% APR spread = 0.84% of notional');
  assert(cards.indexOf('hg-book-stamp') >= 0 || cards.indexOf('IN BOOK SLOT') >= 0,
    'carry spread cards render IN BOOK stamp chip when hgBookStampChip is available');
  assert(flat.indexOf('≈ 12.6') >= 0, 'SOL card: T1 price-equivalent 150 x 8.4% = 12.6');
  assert(cards.indexOf('×ATR') >= 0, 'capture horizons also expressed in ATR multiples');
  assert(el.querySelector('#carryStat').textContent.indexOf('done') === 0, 'scan still completes with the levels leg');
}

/* ================================================================
   8) HARD REFRESH contract (refresh field on the registration)
   House contract: refresh is async, NEVER throws, returns a terse status
   string ('skipped: not run yet' before the first user run, 'busy' while a
   scan is in flight, 'refreshed' after re-running). No live network.
================================================================ */
console.log('--- refresh contract ---');
{
  const ctx = happyCtx();
  let tickerCalls = 0;
  ctx.binanceTickers24h = async function(){ tickerCalls++; return TICKERS; };  // spy: invoked on every scan (not module-cached)
  const w = loadModule(ctx);
  const t = w.HG_tabs[0];
  assert(typeof t.refresh === 'function', 'refresh: registration carries a refresh function');

  /* (a) never mounted / never run -> skip */
  assert((await t.refresh()) === 'skipped: not run yet', 'refresh: before mount/run -> "skipped: not run yet"');

  /* (b) mounted but still never run -> still skip (a global refresh must not
     trigger an expensive first-time scan on its own) */
  const el = stubEl();
  t.mount(el);
  assert((await t.refresh()) === 'skipped: not run yet', 'refresh: mounted but never run -> "skipped: not run yet"');
  assert(tickerCalls === 0, 'refresh: a skipped refresh performs no fetches');

  /* (c) user run, then refresh -> 'refreshed' and the pipeline re-executes */
  await el.querySelector('#carryRun')._click();
  assert(tickerCalls === 1, 'run: user scan executed the pipeline once');
  const st1 = await t.refresh();
  assert(st1 === 'refreshed', 'refresh: after a user run -> "refreshed" (got "' + st1 + '")');
  assert(tickerCalls === 2, 'refresh: re-ran the pipeline (tickers leg fetched again)');
  assert(el.querySelector('#carryStat').textContent.indexOf('done') === 0,
         'refresh: stat line healthy after the re-run');
}

console.log('--- refresh: busy guard ---');
{
  /* gated fetch: premiumIndex blocks mid-scan -> refresh reports 'busy' */
  let release;
  const gate = new Promise(r => { release = r; });
  const router = fetchRouter([
    { match: 'premiumIndex', body: PREMIUM },
    { match: 'fundingRate?symbol=', body: histBody },
    { match: 'delta.exchange', body: DELTA }
  ]);
  const ctx = makeCtx({
    AbortController: AbortController,
    fetch: async function(url){
      if (String(url).indexOf('premiumIndex') >= 0) await gate;
      return router(url);
    },
    binanceTickers24h: async function(){ return TICKERS; }
  });
  const w = loadModule(ctx);
  const t = w.HG_tabs[0];
  const el = stubEl();
  t.mount(el);
  const p = el.querySelector('#carryRun')._click();   // starts, blocks inside the gated fetch
  const st = await t.refresh();
  assert(st === 'busy', 'refresh: during an in-flight scan -> "busy" (got "' + st + '")');
  release();
  assert((await p) === 'refreshed', 'run: the gated scan itself resolves "refreshed"');
  assert((await t.refresh()) === 'refreshed', 'refresh: recovers after the busy window');
}

console.log('--- refresh: loop resilience + failure paths ---');
{
  /* one symbol's funding-history fetch throws -> catch-isolated + counted */
  const router = fetchRouter([
    { match: 'premiumIndex', body: PREMIUM },
    { match: 'fundingRate?symbol=', body: histBody },
    { match: 'delta.exchange', body: DELTA }
  ]);
  const ctx = makeCtx({
    AbortController: AbortController,
    fetch: async function(url){
      if (String(url).indexOf('fundingRate?symbol=SOLUSDT') >= 0) throw new Error('boom');
      return router(url);
    },
    binanceTickers24h: async function(){ return TICKERS; }
  });
  const w = loadModule(ctx);
  const t = w.HG_tabs[0];
  const el = stubEl();
  t.mount(el);
  await el.querySelector('#carryRun')._click();
  const stat = el.querySelector('#carryStat').textContent;
  assert(stat.indexOf('done') === 0, 'loop resilience: scan completes despite a throwing per-symbol leg');
  assert(stat.indexOf('1 per-symbol history failures') >= 0,
         'loop resilience: throwing symbol counted as a failure, not fatal — got "' + stat + '"');
  assert(el.querySelector('#carryTableWrap').innerHTML.indexOf('<table>') >= 0,
         'loop resilience: payers table still rendered');
  assert((await t.refresh()) === 'refreshed', 'loop resilience: refresh on the degraded scan still -> "refreshed"');
}
{
  /* premiumIndex hard-fails -> refresh returns a terse failed: string, never
     throws, and the busy guard clears */
  const ctx = makeCtx({
    AbortController: AbortController,
    fetch: fetchRouter([{ match: 'premiumIndex', fail: true }]),
    binanceTickers24h: async function(){ return TICKERS; }
  });
  const w = loadModule(ctx);
  const t = w.HG_tabs[0];
  const el = stubEl();
  t.mount(el);
  await el.querySelector('#carryRun')._click();
  const st = await t.refresh();
  assert(typeof st === 'string' && st.indexOf('failed:') === 0,
         'refresh: failed module -> "failed: ..." string, never throws (got "' + st + '")');
  assert(el.querySelector('#carryRun').disabled === false, 'refresh: RUN re-enabled after a failed refresh (busy guard cleared)');
}

/* ---------------- summary ---------------- */
console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail > 0){ process.exitCode = 1; }
