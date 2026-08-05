/* HARDGATE — binance.js unit tests (offline, mocked fetch).
   Run: node tests/test-binance.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
load('binance.js');

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

async function withFetch(stub, fn){
  const orig = globalThis.fetch;
  globalThis.fetch = stub;
  try { await fn(); }
  finally { globalThis.fetch = orig; }
}

console.log('== makeTokenBucket ==');
{
  const b = globalThis.makeTokenBucket(10, 2);
  ok(typeof b.take === 'function', 'makeTokenBucket exported');
  ok(b.take() === 0, 'first take consumes token (0 wait)');
  ok(b.take() === 0, 'burst allows second immediate take');
}

console.log('== binanceKlines ==');
await withFetch(async (url) => {
  ok(String(url).indexOf('/fapi/v1/klines') >= 0, 'klines hits fapi endpoint');
  return {
    ok: true,
    json: async () => [
      [2000000000000, '100', '101', '99', '100.5', '1000'],
      [1999000000000, '99', '100', '98', '99.5', '900'],
    ],
  };
}, async () => {
  const rows = await globalThis.binanceKlines('BTCUSDT', '1h', 500);
  ok(rows.length === 2 && rows[0].t < rows[1].t, 'klines sorted ascending by t (seconds)');
  ok(rows[1].c === 100.5 && rows[1].v === 1000, 'OHLCV normalized');
  const cached = await globalThis.binanceKlines('BTCUSDT', '1h', 500);
  ok(cached === rows, 'klines cached for identical args');
});

console.log('== binancePerpUniverse ==');
await withFetch(async () => ({
  ok: true,
  json: async () => ({
    symbols: [
      { symbol: 'BTCUSDT', quoteAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING' },
      { symbol: 'ETHUSD', quoteAsset: 'USD', contractType: 'PERPETUAL', status: 'TRADING' },
      { symbol: 'SOLUSDT', quoteAsset: 'USDT', contractType: 'PERPETUAL', status: 'BREAK' },
    ],
  }),
}), async () => {
  const uni = await globalThis.binancePerpUniverse();
  ok(Array.isArray(uni) && uni.length === 1 && uni[0] === 'BTCUSDT', 'USDT PERPETUAL TRADING only');
});

console.log('== binanceFunding + binanceTickers24h ==');
await withFetch(async (url) => {
  const u = String(url);
  if (u.indexOf('premiumIndex') >= 0){
    return { ok: true, json: async () => ({
      lastFundingRate: '0.0001', markPrice: '42000', nextFundingTime: '2000000000000',
    }) };
  }
  if (u.indexOf('ticker/24hr') >= 0){
    return { ok: true, json: async () => [{
      symbol: 'ETHUSDT', lastPrice: '3000', priceChangePercent: '1.5', quoteVolume: '999',
    }] };
  }
  return { ok: false, json: async () => null };
}, async () => {
  const f = await globalThis.binanceFunding('ETHUSDT');
  ok(f && Math.abs(f.fundingPct - 0.01) < 1e-9, 'funding decimal → percent units');
  ok(f.markPrice === 42000, 'markPrice parsed');
  const tick = await globalThis.binanceTickers24h();
  ok(tick && tick.ETHUSDT.turnoverUsd === 999, 'tickers24h map by symbol');
});

console.log('== binanceLongShort ==');
await withFetch(async () => ({
  ok: true,
  json: async () => ([
    { longAccount: '0.6', shortAccount: '0.4', longShortRatio: '1.5', timestamp: '1000000000000' },
    { longAccount: '0.55', shortAccount: '0.45', longShortRatio: '1.22', timestamp: '1000003600000' },
  ]),
}), async () => {
  const ls = await globalThis.binanceLongShort('BTCUSDT', '1h', 30);
  ok(ls && Math.abs(ls.latest.longPct - 55) < 0.01 && Math.abs(ls.latest.shortPct - 45) < 0.01,
    'long/short pct from accounts');
  ok(ls.series.length === 2 && ls.series[0].t < ls.series[1].t, 'LS series sorted');
});

console.log('== binanceOI ==');
await withFetch(async (url) => {
  const u = String(url);
  if (u.indexOf('openInterest?') >= 0){
    return { ok: true, json: async () => ({ openInterest: '1000' }) };
  }
  if (u.indexOf('premiumIndex') >= 0){
    return { ok: true, json: async () => ({ markPrice: '50' }) };
  }
  return { ok: false, json: async () => null };
}, async () => {
  const oi = await globalThis.binanceOI('SOLUSDT');
  ok(oi && oi.oiContracts === 1000 && oi.oiUsd === 50000, 'OI contracts × mark → oiUsd');
});

console.log('== binanceFundingInfo ==');
await withFetch(async () => ({
  ok: true,
  json: async () => ([
    { symbol: 'BTCUSDT', fundingIntervalHours: 8, adjustedFundingRateCap: '0.02', adjustedFundingRateFloor: '-0.02' },
    { symbol: 'BADUSDT', fundingIntervalHours: 0 },
  ]),
}), async () => {
  const info = await globalThis.binanceFundingInfo();
  ok(info && info.BTCUSDT.intervalHours === 8, 'funding interval hours kept');
  ok(info.BTCUSDT.capPct === 2 && info.BTCUSDT.floorPct === -2, 'cap/floor decimal → percent');
  ok(!info.BADUSDT, 'invalid interval omitted');
});

console.log('== binanceDepth ==');
await withFetch(async () => ({
  ok: true,
  json: async () => ({
    bids: [['100', '2'], ['99', '1']],
    asks: [['101', '3']],
  }),
}), async () => {
  const d = await globalThis.binanceDepth('BTCUSDT', 20);
  ok(d && d.bidUsd === 299 && d.askUsd === 303, 'depth totals price×qty');
});

console.log('== binanceFundingHist ==');
await withFetch(async () => ({
  ok: true,
  json: async () => {
    const rows = [];
    for (let i = 0; i < 12; i++){
      rows.push({ fundingRate: '0.0001', fundingTime: String(1000000000000 + i * 3600000) });
    }
    return rows;
  },
}), async () => {
  const hist = await globalThis.binanceFundingHist('BTCUSDT', 100);
  ok(Array.isArray(hist) && hist.length === 12 && hist[0].t < hist[11].t, 'funding hist >= 10 rows sorted');
});

console.log('== graceful degradation ==');
await withFetch(async () => { throw new Error('network down'); }, async () => {
  ok((await globalThis.binanceKlines('ZZZUSDT')).length === 0, 'klines fetch error → []');
  ok(await globalThis.binanceFunding(null) === null, 'missing symbol funding → null');
  ok(await globalThis.binanceFunding('ZRXUSDT') === null, 'funding fetch error → null');
});

await withFetch(async () => ({ ok: false, json: async () => null }), async () => {
  ok(await globalThis.binanceTakerRatio('ATOMUSDT') === null, 'non-ok taker ratio → null');
});

console.log('\n' + pass + ' passed');
