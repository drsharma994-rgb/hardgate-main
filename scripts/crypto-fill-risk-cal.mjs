/* HARDGATE — crypto-specific fill-risk calibration replay
   Measures never-fill rates on 10 Binance majors (BTCUSDT, ETHUSDT, etc.)
   across 1,000 candles at 4h and 1h horizons.

   Run: node scripts/crypto-fill-risk-cal.mjs

   Output: tab-separated results with gap buckets and never-fill percentages
   for both 4h and 1h horizons. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const FAPI = 'https://fapi.binance.com';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'LTCUSDT'];
const BARS_PER_HORIZON = 1000;
const CHUNK_SIZE = 1;  /* Sequential to avoid rate limits */
const SLEEP_MS = 1000; /* Longer sleep between requests */
const FETCH_RETRY = 3;
const FETCH_RETRY_DELAY = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const last = a => a && a.length ? a[a.length - 1] : null;

const j = async (url, retries = FETCH_RETRY) => {
  for (let attempt = 0; attempt < retries; attempt++){
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      if (r.status === 418){
        /* Rate limited, wait longer */
        if (attempt < retries - 1){
          console.log(`    Rate limited, retrying in ${FETCH_RETRY_DELAY}ms...`);
          await sleep(FETCH_RETRY_DELAY);
          continue;
        }
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    } catch (e){
      if (attempt < retries - 1){
        console.log(`    Fetch error: ${e.message}, retrying...`);
        await sleep(FETCH_RETRY_DELAY);
      } else {
        throw e;
      }
    }
  }
  throw new Error('Max retries exceeded');
};

/* Load the omniroute machinery into a VM context */
function bootContext(){
  const ctx = {
    console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };

  vm.createContext(ctx);

  /* Load all required scripts in dependency order */
  const scripts = [
    'indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
    'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js'
  ];

  for (const script of scripts){
    try {
      const code = fs.readFileSync(path.join(root, script), 'utf8');
      vm.runInContext(code, ctx, { filename: script });
    } catch (e){
      console.error(`Failed to load ${script}:`, e.message);
      throw e;
    }
  }

  return ctx;
}

/* Fetch OHLCV bars from Binance */
const klines = async (sym, interval, limit) => {
  const url = FAPI + '/fapi/v1/klines?symbol=' + sym + '&interval=' + interval + '&limit=' + limit;
  const data = await j(url);
  return data.map(r => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
};

/* Walk forward through bars starting at idx to determine FILL or NEVER-FILL.
   We use the omniroute's walk logic: entry is the close at idx, stop is derived,
   and we check if price trades the entry within the horizon bars. */
function walkForEntry(rows, idx, entry, stop, dir, horizon){
  if (!isFinite(entry) || !isFinite(stop) || idx < 0 || idx >= rows.length){
    return { filled: false, reason: 'invalid' };
  }

  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return { filled: false, reason: 'no-risk' };

  const end = Math.min(rows.length - 1, idx + horizon);

  for (let i = idx + 1; i <= end; i++){
    const h = rows[i].h;
    const l = rows[i].l;

    if (!isFinite(h) || !isFinite(l)) continue;

    /* Check if entry was hit */
    let entryHit = false;
    if (dir === 'long'){
      entryHit = l <= entry && h >= entry;
    } else {
      entryHit = h >= entry && l <= entry;
    }

    if (entryHit){
      return { filled: true, at: i, reason: 'filled' };
    }
  }

  return { filled: false, at: end, reason: 'never-filled' };
}

/* Measure fill rates on a single symbol/horizon pair */
async function measureSymbolHorizon(ctx, sym, interval, hours){
  console.log(`  Fetching ${BARS_PER_HORIZON} ${interval} bars for ${sym}...`);

  let rows;
  try {
    rows = await klines(sym, interval, BARS_PER_HORIZON);
  } catch (e){
    console.error(`    ERROR fetching ${sym} ${interval}: ${e.message}`);
    return null;
  }

  if (rows.length < 100){
    console.log(`    Skipped: only ${rows.length} bars`);
    return null;
  }

  console.log(`  Running detection on ${sym} ${interval}...`);

  /* Buckets: [0-0.25R, 0.25-0.5R, 0.5-1.0R, 1.0R+] */
  const buckets = [
    { name: '0-0.25', min: 0, max: 0.25, filled: 0, neverFilled: 0, total: 0 },
    { name: '0.25-0.5', min: 0.25, max: 0.5, filled: 0, neverFilled: 0, total: 0 },
    { name: '0.5-1.0', min: 0.5, max: 1.0, filled: 0, neverFilled: 0, total: 0 },
    { name: '1.0+', min: 1.0, max: Infinity, filled: 0, neverFilled: 0, total: 0 }
  ];

  let tested = 0;

  /* Walk through each bar and run detection */
  for (let i = 60; i < rows.length - hours; i++){
    const prefixRows = rows.slice(0, i + 1);

    let hits;
    try {
      hits = ctx.hgOmniDetect(prefixRows) || [];
    } catch (e){
      continue;
    }

    if (!hits || !hits.length) continue;

    /* Process each hit from this bar */
    for (const hit of hits){
      if (!hit || !hit.dir) continue;

      /* Get the stop price using omniroute's logic */
      let stop;
      try {
        stop = ctx.hgOmniBtStop(hit.dir, prefixRows, prefixRows.length - 1, 10);
      } catch (e){
        continue;
      }

      if (!isFinite(stop)) continue;

      const entry = rows[i].c;
      const risk = Math.abs(entry - stop);
      if (!(risk > 0)) continue;

      /* Compute live price (last known close, but we're replaying so it's the entry bar close) */
      const livePx = rows[i].c;

      /* Compute gap in R */
      const away = (hit.dir === 'long') ? (entry < livePx - 1e-9) : (entry > livePx + 1e-9);
      if (!away){
        /* At or through market — fills immediately */
        continue;
      }

      const gapR = Math.abs(entry - livePx) / risk;

      /* Find which bucket this belongs to */
      let bucket = null;
      for (const b of buckets){
        if (gapR >= b.min && gapR < b.max){
          bucket = b;
          break;
        }
      }

      if (!bucket) continue;

      /* Walk forward to see if entry fills */
      const result = walkForEntry(rows, i, entry, stop, hit.dir, hours);

      bucket.total++;
      if (result.filled){
        bucket.filled++;
      } else {
        bucket.neverFilled++;
      }
      tested++;
    }
  }

  console.log(`    Tested ${tested} entries on ${sym} ${interval}`);

  return {
    sym: sym,
    interval: interval,
    horizon: `${hours}h`,
    buckets: buckets
  };
}

/* Main execution */
async function main(){
  console.log('HARDGATE — Crypto Fill-Risk Calibration Replay\n');

  console.log('Loading omniroute machinery...');
  const ctx = bootContext();
  console.log('OK — context loaded\n');

  /* Track results across all symbols */
  const allResults = {
    '4h': [
      { name: '0-0.25', filled: 0, neverFilled: 0, total: 0 },
      { name: '0.25-0.5', filled: 0, neverFilled: 0, total: 0 },
      { name: '0.5-1.0', filled: 0, neverFilled: 0, total: 0 },
      { name: '1.0+', filled: 0, neverFilled: 0, total: 0 }
    ],
    '1h': [
      { name: '0-0.25', filled: 0, neverFilled: 0, total: 0 },
      { name: '0.25-0.5', filled: 0, neverFilled: 0, total: 0 },
      { name: '0.5-1.0', filled: 0, neverFilled: 0, total: 0 },
      { name: '1.0+', filled: 0, neverFilled: 0, total: 0 }
    ]
  };

  /* Measure each symbol at both horizons */
  for (const sym of SYMBOLS){
    try {
      console.log(`\n${sym}:`);

      /* 4h horizon */
      const result4h = await measureSymbolHorizon(ctx, sym, '4h', 250);
      if (result4h){
        for (let j = 0; j < result4h.buckets.length; j++){
          const src = result4h.buckets[j];
          const dst = allResults['4h'][j];
          dst.filled += src.filled;
          dst.neverFilled += src.neverFilled;
          dst.total += src.total;
        }
      }

      await sleep(SLEEP_MS);

      /* 1h horizon */
      const result1h = await measureSymbolHorizon(ctx, sym, '1h', 60);
      if (result1h){
        for (let j = 0; j < result1h.buckets.length; j++){
          const src = result1h.buckets[j];
          const dst = allResults['1h'][j];
          dst.filled += src.filled;
          dst.neverFilled += src.neverFilled;
          dst.total += src.total;
        }
      }

      await sleep(SLEEP_MS);

    } catch (e){
      console.error(`  ERROR on ${sym}: ${e.message}`);
    }
  }

  /* Print results */
  console.log('\n\n========== CRYPTO FILL-RISK RATES (10 Binance Majors, 1000 bars per horizon) ==========\n');

  console.log('gap_bucket\t4h_filled\t4h_never_fill_pct\t4h_n_settled\t1h_filled\t1h_never_fill_pct\t1h_n_settled');

  for (let i = 0; i < allResults['4h'].length; i++){
    const b4h = allResults['4h'][i];
    const b1h = allResults['1h'][i];

    const nf4h = b4h.total > 0 ? ((b4h.neverFilled / b4h.total) * 100).toFixed(1) : 'N/A';
    const nf1h = b1h.total > 0 ? ((b1h.neverFilled / b1h.total) * 100).toFixed(1) : 'N/A';

    console.log(
      b4h.name + '\t' +
      b4h.filled + '\t' +
      nf4h + '%\t' +
      b4h.total + '\t' +
      b1h.filled + '\t' +
      nf1h + '%\t' +
      b1h.total
    );
  }

  /* Summary statistics */
  console.log('\n========== SUMMARY ==========\n');

  const total4h = allResults['4h'].reduce((s, b) => s + b.total, 0);
  const nf4h = allResults['4h'].reduce((s, b) => s + b.neverFilled, 0);
  const total1h = allResults['1h'].reduce((s, b) => s + b.total, 0);
  const nf1h = allResults['1h'].reduce((s, b) => s + b.neverFilled, 0);

  console.log(`4h: ${total4h} entries tested, ${nf4h} never-filled (${total4h > 0 ? ((nf4h/total4h)*100).toFixed(1) : 'N/A'}%)`);
  console.log(`1h: ${total1h} entries tested, ${nf1h} never-filled (${total1h > 0 ? ((nf1h/total1h)*100).toFixed(1) : 'N/A'}%)`);

  /* Save results to JSON for analysis */
  const outputPath = path.join(root, 'scripts', 'crypto-fill-risk-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    symbols: SYMBOLS,
    bars_per_horizon: BARS_PER_HORIZON,
    results_4h: allResults['4h'],
    results_1h: allResults['1h']
  }, null, 2));

  console.log(`\nDetailed results saved to ${outputPath}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
