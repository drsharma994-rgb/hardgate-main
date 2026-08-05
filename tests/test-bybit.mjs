/* HARDGATE — bybit.js unit tests (offline, mocked fetch).
   Run: node tests/test-bybit.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
load('binance.js');
load('bybit.js');

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

function bybitJson(result){
  return { retCode: 0, result: result };
}

async function withFetch(stub, fn){
  const orig = globalThis.fetch;
  globalThis.fetch = stub;
  try { await fn(); }
  finally { globalThis.fetch = orig; }
}

console.log('== bybitFunding ==');
await withFetch(async (url) => {
  ok(String(url).indexOf('/v5/market/tickers') >= 0, 'funding hits tickers endpoint');
  return {
    ok: true,
    json: async () => bybitJson({
      list: [{ symbol: 'BTCUSDT', fundingRate: '0.0001', lastPrice: '50000' }],
    }),
  };
}, async () => {
  const f = await globalThis.bybitFunding('BTCUSDT');
  ok(f && Math.abs(f.fundingPct - 0.01) < 1e-9, 'fundingRate scaled to pct');
  ok(f.markPrice === 50000, 'mark price parsed');
  const cached = await globalThis.bybitFunding('BTCUSDT');
  ok(cached === f, 'second call returns cached object');
});

console.log('== bybitOIHistory ==');
await withFetch(async () => ({
  ok: true,
  json: async () => bybitJson({
    list: [
      { openInterest: '1000', openInterestValue: '50000000', timestamp: '1000000000000' },
      { openInterest: '1100', openInterestValue: '55000000', timestamp: '1000003600000' },
    ],
  }),
}), async () => {
  const oi = await globalThis.bybitOIHistory('ETHUSDT', 25);
  ok(oi && oi.latest.oi === 1100, 'latest OI from sorted series');
  ok(Math.abs(oi.oiChgPct - 10) < 0.01, 'oiChgPct computed from first→latest');
});

console.log('== bybitAccountRatio ==');
await withFetch(async () => ({
  ok: true,
  json: async () => bybitJson({
    list: [
      { buyRatio: '0.6', sellRatio: '0.4', timestamp: '1000000000000' },
      { buyRatio: '0.55', sellRatio: '0.45', timestamp: '1000003600000' },
    ],
  }),
}), async () => {
  const ar = await globalThis.bybitAccountRatio('SOLUSDT', '1h', 2);
  ok(ar && Math.abs(ar.latest.longPct - 55) < 0.01, 'retail long pct from buy/(buy+sell)');
});

console.log('== bybitPositioningSnapshot ==');
await withFetch(async (url) => {
  const u = String(url);
  if (u.indexOf('tickers') >= 0){
    return { ok: true, json: async () => bybitJson({ list: [{ fundingRate: '0.0002', lastPrice: '100' }] }) };
  }
  if (u.indexOf('open-interest') >= 0){
    return { ok: true, json: async () => bybitJson({
      list: [
        { openInterest: '500', openInterestValue: '50000', timestamp: '1000000000000' },
        { openInterest: '600', openInterestValue: '60000', timestamp: '1000003600000' },
      ],
    }) };
  }
  if (u.indexOf('account-ratio') >= 0){
    return { ok: true, json: async () => bybitJson({
      list: [{ buyRatio: '0.7', sellRatio: '0.3', timestamp: '1000000000000' }],
    }) };
  }
  return { ok: false, json: async () => ({}) };
}, async () => {
  const snap = await globalThis.bybitPositioningSnapshot('BTCUSDT');
  ok(snap && snap.venue === 'bybit' && snap.sym === 'BTCUSDT', 'snapshot tagged bybit');
  ok(snap.fundingPct !== null && snap.oiChgPct !== null && snap.retailLongPct === 70, 'merges funding, OI, account ratio');
});

console.log('== bybitLinearTickersByBase ==');
await withFetch(async () => ({
  ok: true,
  json: async () => bybitJson({
    list: [
      { symbol: 'BTCUSDT', fundingRate: '0.0003', turnover24h: '1234567890' },
      { symbol: 'ETHUSDT', fundingRate: '0.0001', turnover24h: '987654321' },
      { symbol: 'BTCUSD', fundingRate: '0.001', turnover24h: '1' },
    ],
  }),
}), async () => {
  const map = await globalThis.bybitLinearTickersByBase();
  ok(map && map.BTC && map.BTC.symbol === 'BTCUSDT', 'USDT linear tickers indexed by base');
  ok(Math.abs(map.BTC.pct8h - 0.03) < 1e-9, 'pct8h from funding rate');
  ok(!map.BTCUSD, 'non-USDT suffix rows skipped');
});

console.log('== graceful degradation ==');
await withFetch(async () => { throw new Error('network down'); }, async () => {
  ok(await globalThis.bybitFunding('DOGEUSDT') === null, 'fetch error → null');
  ok(await globalThis.bybitFunding(null) === null, 'missing symbol → null');
  ok(await globalThis.bybitFunding('X') === null, 'non-ok response → null');
});

await withFetch(async () => ({
  ok: true,
  json: async () => ({ retCode: 1, result: null }),
}), async () => {
  ok(await globalThis.bybitFunding('LTCUSDT') === null, 'retCode !== 0 → null');
});

console.log('\n' + pass + ' passed');
