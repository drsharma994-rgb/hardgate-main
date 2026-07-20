/* HARDGATE — macro.js unit tests (Node 18+, builtins only, NO live network).
   Loads macro.js as a classic script (vm shared context, exactly like the
   browser's <script> globals) with a URL-routed stub fetch and a stubbed
   binanceKlines, then asserts:
     1) Treasury CSV parsing — real column layout (quoted "10 Yr" header with
        spaces, MM/DD/YYYY dates, CRLF, newest-first rows) and trend math
     2) Treasury year rollover — current-year 404/empty -> previous-year fetch
     3) gold-api.com parsing — good/bad payloads on the silver + gold legs
     4) getGoldMacro() — exact return shape, leg provenance (Treasury vs
        Yahoo-via-/api/proxy last resort), realRateHint logic, null-tolerance
     5) getGoldCandles() chain order — XAUUSDT tried first, PAXGUSDT on
        failure, Twelve Data, Yahoo GC=F via /api/proxy; count clamps;
        {rows:[], source:null} on total failure
   Run: node tests/test-macro.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = f => vm.runInThisContext(readFileSync(path.join(root, f), 'utf8'), { filename: f });

globalThis.window = {};
load('macro.js');

/* ---- harness ---- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
const clearCache = () => vm.runInThisContext('__MACRO_CACHE.clear()');
const YEAR = new Date().getUTCFullYear();
const DAY = 86400;

/* ---- URL-routed fetch stub ---- */
let routes = [];
let calls = [];
function setRoutes(r){ routes = r || []; calls = []; }
globalThis.fetch = async (url) => {
  url = String(url);
  calls.push(url);
  for (const r of routes){
    if (r.match(url)){
      if (r.error) throw r.error;
      return {
        ok: r.ok !== false,
        status: r.status || (r.ok === false ? 404 : 200),
        json: async () => (typeof r.json === 'function' ? r.json(url) : r.json),
        text: async () => (typeof r.text === 'function' ? r.text(url) : (r.text !== undefined ? r.text : ''))
      };
    }
  }
  return { ok: false, status: 404, json: async () => null, text: async () => '' };
};
const isTreasury = (u, y) => u.includes('daily-treasury-rates.csv/' + y + '/all');

/* ---- fixtures ---- */
function businessDaysBack(n){
  const out = [];
  let d = new Date();
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  while (out.length < n){
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.unshift(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() - DAY * 1000);
  }
  return out; // ascending ISO dates, last = most recent business day
}
/* Real Treasury layout: quoted header ("10 Yr" with a space), MM/DD/YYYY,
   CRLF endings, data rows NEWEST-FIRST (verified against the live feed). */
const TNX_HEADER = 'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"';
function treasuryCsv(yieldsAsc){ // yields oldest->newest; emits newest-first rows like the real feed
  const days = businessDaysBack(yieldsAsc.length);
  const lines = yieldsAsc.map((y, i) => {
    const [Y, M, D] = days[i].split('-');
    return `${M}/${D}/${Y},3.70,3.70,3.61,3.63,3.58,3.56,3.48,3.47,3.54,3.72,3.93,${y.toFixed(2)},4.80,4.86`;
  });
  return TNX_HEADER + '\r\n' + lines.reverse().join('\r\n') + '\r\n';
}
const FALLING_YIELDS = Array.from({ length: 25 }, (_, i) => 4.80 - i * 0.025); // -> 4.20, -10.6% rel.
const RISING_YIELDS  = Array.from({ length: 25 }, (_, i) => 4.00 + i * 0.025); // -> 4.60, +12.2% rel.
const FLAT_YIELDS    = Array.from({ length: 25 }, () => 4.50);

function dxyFixtures(dir){
  const days = businessDaysBack(23);
  const eur0 = dir === 'falling' ? 0.94 : 0.88;
  const step = dir === 'falling' ? -0.0009 : 0.0009;
  const rates = {};
  days.forEach((ds, k) => {
    rates[ds] = { EUR: +(eur0 + step * k).toFixed(4), JPY: 148, GBP: 0.78, CAD: 1.35, SEK: 10.4, CHF: 0.88 };
  });
  const last = days[days.length - 1];
  return {
    latest: { amount: 1, base: 'USD', date: last, rates: rates[last] },
    range:  { amount: 1, base: 'USD', start_date: days[0], end_date: last, rates: rates }
  };
}
function yahooChart(closes){
  const t0 = Math.floor(Date.now() / 1000) - closes.length * DAY;
  return {
    chart: {
      result: [{
        timestamp: closes.map((_, i) => t0 + i * DAY),
        indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 0) }] }
      }],
      error: null
    }
  };
}
function synthRows(n, lastC, stepSec){
  const t0 = Math.floor(Date.now() / 1000) - n * (stepSec || DAY);
  return Array.from({ length: n }, (_, i) => ({
    t: t0 + i * (stepSec || DAY),
    o: lastC - 5, h: lastC + 5, l: lastC - 10, c: i === n - 1 ? lastC : lastC - 2, v: 100
  }));
}
function macroRoutes(dxyDir, yields, xagPrice){
  const dxyF = dxyFixtures(dxyDir);
  return [
    { match: u => u.includes('frankfurter.dev/v1/latest'), json: dxyF.latest },
    { match: u => u.includes('frankfurter.dev/v1/') && u.includes('..'), json: dxyF.range },
    { match: u => isTreasury(u, YEAR), text: treasuryCsv(yields) },
    { match: u => u.includes('gold-api.com/price/XAG'), json: { name: 'Silver', price: xagPrice, symbol: 'XAG', updatedAt: '2026-07-18T00:00:00Z' } },
    { match: u => u.includes('gold-api.com/price/XAU'), json: { name: 'Gold', price: 4100.5, symbol: 'XAU', updatedAt: '2026-07-18T00:00:00Z' } }
  ];
}

/* ================= Part 1: Treasury CSV parsing ================= */
console.log('== Part 1: Treasury CSV parsing ==');
{
  clearCache();
  setRoutes([{ match: u => isTreasury(u, YEAR), text: treasuryCsv(FALLING_YIELDS) }]);
  const ust = await getUST10Y();
  assert(!!ust, 'getUST10Y returns a result for a valid CSV');
  assert(ust && Math.abs(ust.value - 4.20) < 1e-9, 'newest "10 Yr" value parsed from newest-first rows (4.20)');
  assert(ust && /^\d{4}-\d{2}-\d{2}$/.test(ust.date), 'date normalized to ISO YYYY-MM-DD (got ' + (ust && ust.date) + ')');
  assert(ust && ust.trend20 === 'FALLING', 'yield down >2% rel. over ~20 business days -> FALLING');
  assert(ust && Math.abs(ust.change20Pct - ((4.20 / 4.70 - 1) * 100)) < 0.01, 'change20Pct is the relative move vs the row ~20 business days back');

  clearCache();
  setRoutes([{ match: u => isTreasury(u, YEAR), text: treasuryCsv(RISING_YIELDS) }]);
  const up = await getUST10Y();
  assert(up && up.trend20 === 'RISING' && Math.abs(up.value - 4.60) < 1e-9, 'RISING trend + 4.60 value');

  clearCache();
  setRoutes([{ match: u => isTreasury(u, YEAR), text: treasuryCsv(FLAT_YIELDS) }]);
  const flat = await getUST10Y();
  assert(flat && flat.trend20 === 'FLAT' && flat.change20Pct !== null && Math.abs(flat.change20Pct) < 1e-9, 'constant yields -> FLAT with ~0 change');

  // quoted-header column lookup is name-based: '10 Yr' moved to a different index still parses
  clearCache();
  const days = businessDaysBack(22);
  const reordered = 'Date,"10 Yr","1 Mo"\r\n' + days.map((ds, i) => {
    const [Y, M, D] = ds.split('-');
    return `${M}/${D}/${Y},${(4.00 + i * 0.02).toFixed(2)},3.70`;
  }).reverse().join('\r\n') + '\r\n';
  setRoutes([{ match: u => isTreasury(u, YEAR), text: reordered }]);
  const reo = await getUST10Y();
  assert(reo && Math.abs(reo.value - (4.00 + 21 * 0.02)) < 1e-9, "column found by header name, not position ('10 Yr' at index 1)");

  // garbage -> null, never throws
  clearCache();
  setRoutes([{ match: u => isTreasury(u, YEAR), text: 'not a csv at all' }, { match: u => isTreasury(u, YEAR - 1), text: '<html>404</html>' }]);
  const bad = await getUST10Y();
  assert(bad === null, 'malformed CSV on both years -> null, no throw');

  // cache: second call served from memory (only one treasury fetch)
  clearCache();
  setRoutes([{ match: u => isTreasury(u, YEAR), text: treasuryCsv(FLAT_YIELDS) }]);
  await getUST10Y(); await getUST10Y();
  assert(calls.filter(u => u.includes('daily-treasury-rates')).length === 1, 'getUST10Y result is cached (1 fetch across 2 calls)');
}

/* ================= Part 2: Treasury year rollover ================= */
console.log('\n== Part 2: Treasury year rollover ==');
{
  clearCache();
  setRoutes([
    { match: u => isTreasury(u, YEAR), ok: false, status: 404, text: '' },
    { match: u => isTreasury(u, YEAR - 1), text: treasuryCsv(RISING_YIELDS) }
  ]);
  const ust = await getUST10Y();
  const tCalls = calls.filter(u => u.includes('daily-treasury-rates'));
  assert(!!ust && Math.abs(ust.value - 4.60) < 1e-9, 'current year 404 -> previous-year CSV used');
  assert(tCalls.length === 2 && tCalls[0].includes('/' + YEAR + '/all') && tCalls[1].includes('/' + (YEAR - 1) + '/all'),
    'rollover fetches current year first, then previous year, in order');

  clearCache();
  setRoutes([
    { match: u => isTreasury(u, YEAR), text: TNX_HEADER + '\r\n' }, // header-only: valid HTTP, no data rows
    { match: u => isTreasury(u, YEAR - 1), text: treasuryCsv(FLAT_YIELDS) }
  ]);
  const ust2 = await getUST10Y();
  assert(!!ust2 && Math.abs(ust2.value - 4.50) < 1e-9, 'current-year empty (header-only) -> previous-year fallback');
}

/* ================= Part 3: gold-api parsing via getGoldMacro legs ================= */
console.log('\n== Part 3: gold-api.com parsing ==');
async function macroOnly(setR, klines){
  clearCache();
  setRoutes(setR);
  globalThis.binanceKlines = klines;
  return getGoldMacro();
}
{
  // silver from gold-api XAG; gold for the ratio from the candle chain (Binance stub)
  const m = await macroOnly(macroRoutes('falling', FALLING_YIELDS, 50), async () => synthRows(10, 4000));
  assert(m.silver === 50, 'silver parsed from gold-api XAG payload');
  assert(Math.abs(m.goldSilverRatio - 4000 / 50) < 1e-9, 'GSR = candle-chain last close / silver (4000/50 = 80)');

  // gold-api XAG malformed -> silver leg dies (Yahoo last resort also dead here)
  const m2 = await macroOnly(
    [{ match: u => isTreasury(u, YEAR), text: treasuryCsv(FLAT_YIELDS) },
     { match: u => u.includes('gold-api.com/price/XAG'), json: { name: 'Silver', price: 'abc' } }],
    async () => synthRows(10, 4000));
  assert(m2.silver === null && m2.goldSilverRatio === null, "malformed XAG price ('abc') -> silver + GSR null");

  const m3 = await macroOnly(
    [{ match: u => isTreasury(u, YEAR), text: treasuryCsv(FLAT_YIELDS) },
     { match: u => u.includes('gold-api.com/price/XAG'), json: {} }],
    async () => synthRows(10, 4000));
  assert(m3.silver === null, 'empty XAG payload -> silver null');

  const m4 = await macroOnly(
    [{ match: u => isTreasury(u, YEAR), text: treasuryCsv(FLAT_YIELDS) },
     { match: u => u.includes('gold-api.com/price/XAG'), json: { price: 0 } }],
    async () => synthRows(10, 4000));
  assert(m4.silver === null, 'zero XAG price rejected (not > 0)');

  // candle chain dead -> XAU spot is the GSR gold leg
  const m5 = await macroOnly(
    [{ match: u => isTreasury(u, YEAR), text: treasuryCsv(FLAT_YIELDS) },
     { match: u => u.includes('gold-api.com/price/XAG'), json: { name: 'Silver', price: 56.08, symbol: 'XAG' } },
     { match: u => u.includes('gold-api.com/price/XAU'), json: { name: 'Gold', price: 4019.3, symbol: 'XAU' } }],
    async () => []);
  assert(m5.silver === 56.08 && Math.abs(m5.goldSilverRatio - 4019.3 / 56.08) < 1e-9,
    'candle chain dead -> GSR uses gold-api XAU spot (4019.3/56.08)');
}

/* ================= Part 4: getGoldMacro shape + hints + Yahoo last resort ================= */
console.log('\n== Part 4: getGoldMacro shape, realRateHint, Yahoo last resort ==');
{
  const SHAPE = ['dxy', 'goldSilverRatio', 'realRateHint', 'silver', 'tnx', 'tnxChange20Pct', 'tnxTrend'];

  const m = await macroOnly(macroRoutes('falling', FALLING_YIELDS, 50), async () => synthRows(10, 4000));
  assert(Object.keys(m).sort().join('|') === SHAPE.join('|'), 'exact return shape keys: ' + SHAPE.join(', '));
  assert(m.dxy && m.dxy.trend20 === 'FALLING' && isFinite(m.dxy.value), 'DXY leg: FALLING trend from Frankfurter fixtures');
  assert(Math.abs(m.tnx - 4.20) < 1e-9 && m.tnxTrend === 'FALLING', 'tnx leg: Treasury CSV value + FALLING trend');
  assert(m.realRateHint === 'TAILWIND', 'FALLING DXY + FALLING yields -> TAILWIND');

  const mB = await macroOnly(macroRoutes('rising', RISING_YIELDS, 40), async () => synthRows(10, 4000));
  assert(mB.dxy && mB.dxy.trend20 === 'RISING' && mB.tnxTrend === 'RISING' && mB.realRateHint === 'HEADWIND',
    'RISING DXY + RISING yields -> HEADWIND');

  const mM = await macroOnly(macroRoutes('rising', FLAT_YIELDS, 40), async () => synthRows(10, 4000));
  assert(mM.realRateHint === 'NEUTRAL', 'mixed (RISING DXY + FLAT yields) -> NEUTRAL');

  // everything dead -> full null shape, no throw
  const mD = await macroOnly([], async () => []);
  assert(Object.keys(mD).sort().join('|') === SHAPE.join('|'), 'dead-everything shape keys intact');
  assert(mD.dxy === null && mD.tnx === null && mD.tnxTrend === null && mD.tnxChange20Pct === null &&
         mD.silver === null && mD.goldSilverRatio === null && mD.realRateHint === 'NEUTRAL',
         'all legs null + NEUTRAL hint when every source is down');

  // Yahoo last resort through /api/proxy: Treasury + gold-api + Binance dead
  clearCache();
  setRoutes([
    { match: u => u.startsWith('/api/proxy?url='), json: (u) => {
        const inner = decodeURIComponent(u.slice('/api/proxy?url='.length));
        if (inner.includes('chart/^TNX')) return yahooChart([44.0, 44.1, 44.15, 44.3, 44.5, 45.0, 45.4]);
        if (inner.includes('chart/SI=F')) return yahooChart([31.0, 31.2, 31.5]);
        if (inner.includes('chart/GC=F')) return yahooChart([3980, 3990, 4000]);
        return null;
      } }
  ]);
  globalThis.binanceKlines = async () => [];
  const mY = await getGoldMacro();
  assert(Math.abs(mY.tnx - 4.54) < 1e-9, 'Yahoo ^TNX fallback keeps the adaptive x10 scale (45.4 -> 4.54)');
  assert(mY.tnxTrend === 'RISING', 'Yahoo ^TNX fallback trend (44.0 -> 45.4 = +3.2% rel -> RISING)');
  assert(mY.silver === 31.5, 'Yahoo SI=F fallback supplies silver');
  assert(Math.abs(mY.goldSilverRatio - 4000 / 31.5) < 0.01, 'GSR from Yahoo GC=F last close via the candle chain');
  assert(mY.realRateHint === 'NEUTRAL', 'DXY dead + yields RISING -> NEUTRAL (not HEADWIND)');
  const proxyCalls = calls.filter(u => u.startsWith('/api/proxy?url=')).map(u => decodeURIComponent(u.slice('/api/proxy?url='.length)));
  assert(proxyCalls.length >= 3 && proxyCalls.some(u => u.includes('query1.finance.yahoo.com/v8/finance/chart/^TNX')) &&
         proxyCalls.some(u => u.includes('chart/SI=F')) && proxyCalls.some(u => u.includes('chart/GC=F')),
         'every Yahoo leg routed through /api/proxy?url=<encoded yahoo chart URL>');
}

/* ================= Part 5: getGoldCandles chain order ================= */
console.log('\n== Part 5: getGoldCandles chain ==');
{
  // XAUUSDT hit -> binance-xau, PAXG never requested
  clearCache();
  let kCalls = [];
  setRoutes([]);
  globalThis.binanceKlines = async (sym, interval, limit) => { kCalls.push([sym, interval, limit]); return synthRows(20, 4000); };
  let out = await getGoldCandles('1h', 100);
  assert(out.source === 'binance-xau' && out.rows.length === 20, 'XAUUSDT success -> source binance-xau');
  assert(kCalls.length === 1 && kCalls[0][0] === 'XAUUSDT' && kCalls[0][1] === '1h' && kCalls[0][2] === 100,
    'XAUUSDT tried first (and only) with the requested interval/count');

  // XAUUSDT empty -> PAXGUSDT -> binance-paxg
  clearCache();
  kCalls = [];
  globalThis.binanceKlines = async (sym) => { kCalls.push(sym); return sym === 'XAUUSDT' ? [] : synthRows(15, 3900); };
  out = await getGoldCandles('4h', 60);
  assert(out.source === 'binance-paxg' && out.rows.length === 15, 'XAUUSDT empty -> PAXGUSDT -> source binance-paxg');
  assert(kCalls.join(',') === 'XAUUSDT,PAXGUSDT', 'fallback order: XAUUSDT before PAXGUSDT');

  // XAUUSDT throws -> still falls through to PAXGUSDT (per-call tolerance)
  clearCache();
  globalThis.binanceKlines = async (sym) => { if (sym === 'XAUUSDT') throw new Error('boom'); return synthRows(15, 3900); };
  out = await getGoldCandles('15m', 50);
  assert(out.source === 'binance-paxg', 'XAUUSDT throwing does not break the PAXGUSDT fallback');

  // Binance absent + TWELVEDATA_KEY -> twelvedata leg (values newest-first -> ascending rows)
  clearCache();
  globalThis.binanceKlines = undefined;
  globalThis.TWELVEDATA_KEY = 'testkey';
  setRoutes([{ match: u => u.includes('api.twelvedata.com/time_series'), json: {
      status: 'ok',
      values: [
        { datetime: '2026-07-18 12:00:00', open: '4002', high: '4008', low: '3998', close: '4005', volume: '12' },
        { datetime: '2026-07-18 11:00:00', open: '3997', high: '4003', low: '3995', close: '4002', volume: '9' },
        { datetime: '2026-07-18 10:00:00', open: '3990', high: '3999', low: '3989', close: '3997' }
      ]
    } }]);
  out = await getGoldCandles('1h', 25);
  assert(out.source === 'twelvedata' && out.rows.length === 3, 'Binance absent -> Twelve Data -> source twelvedata');
  assert(out.rows.length === 3 && out.rows[0].t < out.rows[1].t && out.rows[1].t < out.rows[2].t && out.rows[2].c === 4005,
    'Twelve Data newest-first values normalized to ascending rows');
  assert(calls[0].includes('apikey=testkey') && calls[0].includes('interval=1h'), 'Twelve Data request carries the key + mapped interval');
  delete globalThis.TWELVEDATA_KEY;

  // Binance absent + no TD key -> Yahoo GC=F via /api/proxy, 2h resampled from 1h
  clearCache();
  setRoutes([{ match: u => u.startsWith('/api/proxy?url='), json: (u) => {
      const inner = decodeURIComponent(u.slice('/api/proxy?url='.length));
      if (!inner.includes('chart/GC=F')) return null;
      const t0 = Math.floor(Date.now() / 1000) - 10 * 3600;
      const ts = Array.from({ length: 10 }, (_, i) => t0 + i * 3600);
      return { chart: { result: [{ timestamp: ts,
        indicators: { quote: [{ open: ts.map(() => 100), high: ts.map(() => 101), low: ts.map(() => 99),
                                close: ts.map((_, i) => 100 + i), volume: ts.map(() => 1) }] } }], error: null } };
    } }]);
  out = await getGoldCandles('2h', 40);
  assert(out.source === 'yahoo' && out.rows.length > 0, 'Binance/TD absent -> Yahoo GC=F via /api/proxy -> source yahoo');
  assert(out.rows.every(r => r.t % 7200 === 0), '2h rows resampled into aligned 2h buckets from 1h Yahoo bars');
  assert(calls.some(u => u.startsWith('/api/proxy?url=') && decodeURIComponent(u).includes('query1.finance.yahoo.com/v8/finance/chart/GC=F')),
    'GC=F request routed through /api/proxy');

  // everything dead -> {rows:[], source:null}
  clearCache();
  setRoutes([]);
  out = await getGoldCandles('1d', 30);
  assert(out && Array.isArray(out.rows) && out.rows.length === 0 && out.source === null,
    'all sources dead -> {rows:[], source:null}, no throw');

  // count clamps: min 10, max 5000
  clearCache();
  kCalls = [];
  globalThis.binanceKlines = async (sym, interval, limit) => { kCalls.push(limit); return synthRows(3, 4000); };
  await getGoldCandles('1h', 3);
  await getGoldCandles('1h', 99999);
  assert(kCalls[0] === 10 && kCalls[1] === 5000, 'count clamped to [10, 5000] before hitting the chain');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ process.exitCode = 1; }
else console.log('ALL MACRO TESTS PASSED');
