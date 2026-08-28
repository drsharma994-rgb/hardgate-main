/* HARDGATE — test crypto fill-risk with mock data
   Validates measurement logic without network calls */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

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

/* Generate mock OHLCV data with realistic price movement */
function generateMockBars(startPrice, count){
  const bars = [];
  let price = startPrice;

  for (let i = 0; i < count; i++){
    const noise = (Math.random() - 0.5) * 0.02; /* 2% max movement */
    const trend = 0.0001; /* Slight upward bias */
    const change = (noise + trend) * price;
    price += change;

    const o = price;
    const close = price + (Math.random() - 0.5) * 0.01 * price;
    const high = Math.max(o, close) * (1 + Math.random() * 0.01);
    const low = Math.min(o, close) * (1 - Math.random() * 0.01);
    const vol = 1000000 + Math.random() * 5000000;

    bars.push({
      t: 1700000000000 + i * 3600000, /* 1h bars */
      o: o,
      h: high,
      l: low,
      c: close,
      v: vol
    });

    price = close;
  }

  return bars;
}

/* Walk forward through bars starting at idx to determine FILL or NEVER-FILL */
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

/* Measure fill rates on mock data */
function measureMockHorizon(ctx, symbol, bars, horizon){
  console.log(`  Testing ${symbol} with ${bars.length} bars, horizon=${horizon}...`);

  /* Buckets: [0-0.25R, 0.25-0.5R, 0.5-1.0R, 1.0R+] */
  const buckets = [
    { name: '0-0.25', min: 0, max: 0.25, filled: 0, neverFilled: 0, total: 0 },
    { name: '0.25-0.5', min: 0.25, max: 0.5, filled: 0, neverFilled: 0, total: 0 },
    { name: '0.5-1.0', min: 0.5, max: 1.0, filled: 0, neverFilled: 0, total: 0 },
    { name: '1.0+', min: 1.0, max: Infinity, filled: 0, neverFilled: 0, total: 0 }
  ];

  let tested = 0;

  /* Walk through each bar and run detection */
  for (let i = 60; i < bars.length - horizon; i++){
    const prefixRows = bars.slice(0, i + 1);

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

      const entry = bars[i].c;
      const risk = Math.abs(entry - stop);
      if (!(risk > 0)) continue;

      /* Compute live price (entry bar close) */
      const livePx = bars[i].c;

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
      const result = walkForEntry(bars, i, entry, stop, hit.dir, horizon);

      bucket.total++;
      if (result.filled){
        bucket.filled++;
      } else {
        bucket.neverFilled++;
      }
      tested++;
    }
  }

  console.log(`    Tested ${tested} entries`);

  return {
    symbol: symbol,
    horizon: horizon,
    buckets: buckets
  };
}

/* Main execution */
async function main(){
  console.log('HARDGATE — Crypto Fill-Risk Test with Mock Data\n');

  console.log('Loading omniroute machinery...');
  const ctx = bootContext();
  console.log('OK — context loaded\n');

  /* Test with mock data */
  console.log('Generating mock data and running tests...\n');

  const allResults = {
    '1h': [
      { name: '0-0.25', filled: 0, neverFilled: 0, total: 0 },
      { name: '0.25-0.5', filled: 0, neverFilled: 0, total: 0 },
      { name: '0.5-1.0', filled: 0, neverFilled: 0, total: 0 },
      { name: '1.0+', filled: 0, neverFilled: 0, total: 0 }
    ]
  };

  /* Test on a few symbols with mock data */
  const testSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

  for (const sym of testSymbols){
    console.log(`\n${sym}:`);

    /* Generate mock 1h bars */
    const bars = generateMockBars(40000, 500);

    const result = measureMockHorizon(ctx, sym, bars, 60);

    if (result){
      for (let j = 0; j < result.buckets.length; j++){
        const src = result.buckets[j];
        const dst = allResults['1h'][j];
        dst.filled += src.filled;
        dst.neverFilled += src.neverFilled;
        dst.total += src.total;
      }
    }
  }

  /* Print results */
  console.log('\n\n========== CRYPTO FILL-RISK RATES (MOCK DATA TEST) ==========\n');

  console.log('gap_bucket\tfilled\tnever_fill_pct\tn_settled');

  for (let i = 0; i < allResults['1h'].length; i++){
    const b = allResults['1h'][i];
    const nf = b.total > 0 ? ((b.neverFilled / b.total) * 100).toFixed(1) : 'N/A';

    console.log(
      b.name + '\t' +
      b.filled + '\t' +
      nf + '%\t' +
      b.total
    );
  }

  /* Summary */
  console.log('\n========== SUMMARY ==========\n');

  const total = allResults['1h'].reduce((s, b) => s + b.total, 0);
  const nf = allResults['1h'].reduce((s, b) => s + b.neverFilled, 0);

  console.log(`Total: ${total} entries tested, ${nf} never-filled (${total > 0 ? ((nf/total)*100).toFixed(1) : 'N/A'}%)`);

  /* Save results to JSON */
  const outputPath = path.join(root, 'scripts', 'crypto-fill-risk-test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    test_type: 'mock_data',
    symbols: testSymbols,
    bars_per_test: 500,
    results: allResults['1h']
  }, null, 2));

  console.log(`\nResults saved to ${outputPath}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
