/* HARDGATE — Direct crypto fill-risk measurement

   Measures never-fill rates by simulating limit orders at various distances
   from market and observing if they fill within the horizon.

   This approach bypasses detector firing and directly measures:
   "At distance X from market, what % of limit orders never fill in the
    next N bars?"

   Run: node scripts/crypto-fill-risk-direct.mjs

   Usage:
   - Fetches real Binance data for crypto majors
   - Places simulated limit orders at gap distances: 0.1R, 0.25R, 0.5R, 1.0R, 1.5R
   - Walks forward to measure if each fills or never-fills within horizon
   - Outputs never-fill percentages by distance and horizon
*/

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

const FAPI = 'https://fapi.binance.com';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'LTCUSDT'];
const BARS_PER_HORIZON = 1000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const j = async (url, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++){
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (r.status === 418){
        if (attempt < retries - 1){
          console.log(`    Rate limited, waiting 2s...`);
          await sleep(2000);
          continue;
        }
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    } catch (e){
      if (attempt < retries - 1){
        console.log(`    Retry ${attempt + 1}/${retries}...`);
        await sleep(1000 * (attempt + 1));
      } else {
        throw e;
      }
    }
  }
};

const klines = async (sym, interval, limit) => {
  const url = FAPI + '/fapi/v1/klines?symbol=' + sym + '&interval=' + interval + '&limit=' + limit;
  const data = await j(url);
  return data.map(r => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
};

/* Boot omniroute for ATR calculation */
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

  const scripts = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js'];

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

/* Calculate ATR for a given bar range */
function calculateATR(ctx, rows){
  try {
    const closes = rows.map(r => r.c);
    const atr = ctx.atrOf(rows, 14);
    return atr && isFinite(atr) ? atr : null;
  } catch (e){
    return null;
  }
}

/* Measure fill rates for a single symbol across 4h and 1h */
async function measureSymbol(ctx, sym){
  console.log(`\n${sym}:`);

  let bars4h, bars1h;

  try {
    console.log(`  Fetching 4h bars...`);
    bars4h = await klines(sym, '4h', BARS_PER_HORIZON);
    console.log(`  Got ${bars4h.length} 4h bars`);
  } catch (e){
    console.log(`  ERROR on 4h: ${e.message}`);
    bars4h = null;
  }

  await sleep(1000);

  try {
    console.log(`  Fetching 1h bars...`);
    bars1h = await klines(sym, '1h', BARS_PER_HORIZON);
    console.log(`  Got ${bars1h.length} 1h bars`);
  } catch (e){
    console.log(`  ERROR on 1h: ${e.message}`);
    bars1h = null;
  }

  const result = {};

  if (bars4h && bars4h.length >= 100){
    result['4h'] = measureBars(bars4h, 250);
  }

  if (bars1h && bars1h.length >= 100){
    result['1h'] = measureBars(bars1h, 60);
  }

  return result;
}

/* Measure fill rates on a bar series
   Tests limit orders placed at gaps: 0.1R, 0.25R, 0.5R, 1.0R, 1.5R
   from the market, and checks if they fill within the horizon */
function measureBars(bars, horizon){
  /* Gap distances to test (in R units) */
  const gaps = [0.1, 0.25, 0.5, 1.0, 1.5];

  /* Results per gap: { gap, filled, never_filled, total, never_fill_pct } */
  const results = {};

  for (const gap of gaps){
    results[gap.toFixed(2)] = { gap: gap, filled: 0, never_filled: 0, total: 0 };
  }

  /* Walk through bars, simulating limit orders */
  for (let i = 60; i < bars.length - horizon - 1; i++){
    const bar = bars[i];
    const close = bar.c;

    /* Calculate a reasonable stop (conservative: 2 ATR below for long) */
    const lookback = Math.min(i, 20);
    const lows = bars.slice(Math.max(0, i - lookback), i + 1).map(b => b.l);
    const stop = Math.min(...lows);
    const risk = close - stop;

    if (!(risk > 0)) continue;

    /* Test each gap distance */
    for (const gapStr in results){
      const gapR = parseFloat(gapStr);
      const entryDist = risk * gapR;

      /* Place a long limit order below market */
      const entry = close - entryDist;

      /* Walk forward to see if it fills */
      let filled = false;
      for (let j = i + 1; j <= Math.min(i + horizon, bars.length - 1); j++){
        if (bars[j].l <= entry){
          filled = true;
          break;
        }
      }

      results[gapStr].total++;
      if (filled){
        results[gapStr].filled++;
      } else {
        results[gapStr].never_filled++;
      }
    }
  }

  /* Convert to percentages */
  for (const gapStr in results){
    const r = results[gapStr];
    if (r.total > 0){
      r.never_fill_pct = ((r.never_filled / r.total) * 100).toFixed(1);
    } else {
      r.never_fill_pct = 'N/A';
    }
  }

  return results;
}

/* Main */
async function main(){
  console.log('HARDGATE — Crypto Fill-Risk Direct Measurement\n');
  console.log('Measuring never-fill rates on 10 Binance majors\n');

  console.log('Loading omniroute context...');
  const ctx = bootContext();
  console.log('OK\n');

  const allResults = {};

  /* Measure each symbol */
  for (const sym of SYMBOLS){
    try {
      const result = await measureSymbol(ctx, sym);
      allResults[sym] = result;
      await sleep(1000);
    } catch (e){
      console.error(`\nERROR on ${sym}: ${e.message}`);
    }
  }

  /* Print summary */
  console.log('\n\n========== SUMMARY: NEVER-FILL RATES BY DISTANCE AND HORIZON ==========\n');

  console.log('4h Horizon:');
  console.log('gap_R\tavg_never_fill_%\tsymbols_tested');

  const gapSizes = ['0.10', '0.25', '0.50', '1.00', '1.50'];

  for (const gap of gapSizes){
    let count = 0;
    let sum = 0;
    for (const sym in allResults){
      if (allResults[sym]['4h'] && allResults[sym]['4h'][gap]){
        const pct = parseFloat(allResults[sym]['4h'][gap].never_fill_pct);
        if (isFinite(pct)){
          sum += pct;
          count++;
        }
      }
    }
    const avg = count > 0 ? (sum / count).toFixed(1) : 'N/A';
    console.log(`${gap}\t${avg}%\t${count}`);
  }

  console.log('\n1h Horizon:');
  console.log('gap_R\tavg_never_fill_%\tsymbols_tested');

  for (const gap of gapSizes){
    let count = 0;
    let sum = 0;
    for (const sym in allResults){
      if (allResults[sym]['1h'] && allResults[sym]['1h'][gap]){
        const pct = parseFloat(allResults[sym]['1h'][gap].never_fill_pct);
        if (isFinite(pct)){
          sum += pct;
          count++;
        }
      }
    }
    const avg = count > 0 ? (sum / count).toFixed(1) : 'N/A';
    console.log(`${gap}\t${avg}%\t${count}`);
  }

  /* Save detailed results */
  const outputPath = path.join(root, 'scripts', 'crypto-fill-risk-direct-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    symbols: SYMBOLS,
    bars_per_horizon: BARS_PER_HORIZON,
    results: allResults
  }, null, 2));

  console.log(`\n\nDetailed results saved to crypto-fill-risk-direct-results.json`);
}

main().catch(e => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
