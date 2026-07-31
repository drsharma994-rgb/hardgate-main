/* HARDGATE — data-layer smoke test (Node 18+, global fetch, no imports).
   Hits the live public endpoints the new binance.js / macro.js rely on and
   prints first values. Run: node tests/test-data-layer.mjs
   Twelve Data / Yahoo-via-/api/proxy paths are intentionally not exercised here.
   Binance legs skip gracefully on HTTP 451 (geo-blocked VMs). */

const FAPI = 'https://fapi.binance.com';
const FRANK = 'https://api.frankfurter.dev';
const GOLDAPI = 'https://api.gold-api.com';

async function j(url, label){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try{
    const r = await fetch(url, { signal: ctrl.signal });
    if (r.status === 451){
      console.log('\n== ' + (label || url) + ' ==\nSKIP — HTTP 451 geo-block (Binance unavailable in this region)');
      return null;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const show = (name, v) => console.log('\n== ' + name + ' ==\n' + v);

// 1) Binance klines BTCUSDT 1h -> normalized row shape
{
  const raw = await j(`${FAPI}/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=500`, 'binance klines BTCUSDT 1h');
  if (raw){
    const rows = raw.map(k => ({ t: Math.floor(k[0]/1000), o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }))
                    .sort((a,b) => a.t - b.t);
    show('binance klines BTCUSDT 1h', `rows=${rows.length}\nfirst=${JSON.stringify(rows[0])}\nlast=${JSON.stringify(rows[rows.length-1])}`);
  }
}

// 2) Funding BTCUSDT (premiumIndex)
{
  const p = await j(`${FAPI}/fapi/v1/premiumIndex?symbol=BTCUSDT`, 'binanceFunding BTCUSDT');
  if (p) show('binanceFunding BTCUSDT', `fundingPct=${(+p.lastFundingRate)*100}%  markPrice=${p.markPrice}  nextFundingTime=${new Date(+p.nextFundingTime).toISOString()}`);
}

// 3) Long/short ETHUSDT 1h
{
  const raw = await j(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=ETHUSDT&period=1h&limit=30`, 'binanceLongShort ETHUSDT');
  if (raw){
    const d = raw[raw.length - 1];
    show('binanceLongShort ETHUSDT', `points=${raw.length}\nlatest: longPct=${(+d.longAccount)*100}  shortPct=${(+d.shortAccount)*100}  ratio=${d.longShortRatio}  t=${new Date(+d.timestamp).toISOString()}`);
  }
}

// 4) Frankfurter latest + DXY formula sanity check
{
  const f = await j(`${FRANK}/v1/latest?base=USD&symbols=EUR,JPY,GBP,CAD,SEK,CHF`, 'Frankfurter latest');
  if (f){
    const r = f.rates;
    const dxy = 50.14348112 * Math.pow(1/r.EUR, -0.576) * Math.pow(r.JPY, 0.136) * Math.pow(1/r.GBP, -0.119)
              * Math.pow(r.CAD, 0.091) * Math.pow(r.SEK, 0.042) * Math.pow(r.CHF, 0.036);
    show('Frankfurter latest', `date=${f.date}  rates=${JSON.stringify(r)}\ncomputed DXY=${dxy.toFixed(3)}`);
  }
}

// 5) Binance XAUUSDT 4h klines (primary free gold feed — TradFi perp)
{
  const raw = await j(`${FAPI}/fapi/v1/klines?symbol=XAUUSDT&interval=4h&limit=100`, 'binance klines XAUUSDT 4h (primary gold)');
  if (raw){
    const rows = raw.map(k => ({ t: Math.floor(k[0]/1000), o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }))
                    .sort((a,b) => a.t - b.t);
    show('binance klines XAUUSDT 4h (primary gold)', `rows=${rows.length}\nfirst=${JSON.stringify(rows[0])}\nlast=${JSON.stringify(rows[rows.length-1])}`);
  }
}

// 6) Binance XAUUSDT funding + global long/short (goldpro M5/M6 legs)
{
  const p = await j(`${FAPI}/fapi/v1/premiumIndex?symbol=XAUUSDT`, 'binanceFunding XAUUSDT');
  if (p) show('binanceFunding XAUUSDT', `fundingPct=${(+p.lastFundingRate)*100}%  markPrice=${p.markPrice}  nextFundingTime=${new Date(+p.nextFundingTime).toISOString()}`);
  const raw = await j(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=XAUUSDT&period=1h&limit=5`, 'binanceLongShort XAUUSDT');
  if (raw){
    const d = raw[raw.length - 1];
    show('binanceLongShort XAUUSDT', `points=${raw.length}\nlatest: longPct=${(+d.longAccount)*100}  shortPct=${(+d.shortAccount)*100}  ratio=${d.longShortRatio}`);
  }
}

// 7) Binance PAXGUSDT 4h klines (tokenized-gold fallback leg)
{
  const raw = await j(`${FAPI}/fapi/v1/klines?symbol=PAXGUSDT&interval=4h&limit=100`, 'binance klines PAXGUSDT 4h (gold fallback)');
  if (raw){
    const rows = raw.map(k => ({ t: Math.floor(k[0]/1000), o:+k[1], h:+k[2], l:+k[3], c:+k[4], v:+k[5] }))
                    .sort((a,b) => a.t - b.t);
    show('binance klines PAXGUSDT 4h (gold fallback)', `rows=${rows.length}\nlast=${JSON.stringify(rows[rows.length-1])}`);
  }
}

// 8) US Treasury daily yield-curve CSV -> US10Y ('10 Yr' column; newest-first rows)
{
  const yr = new Date().getUTCFullYear();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  let csv = null, usedYear = yr;
  try{
    for (const y of [yr, yr - 1]){
      const r = await fetch(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`, { signal: ctrl.signal });
      if (r.ok){ const txt = await r.text(); if (txt && txt.trim()){ csv = txt; usedYear = y; break; } }
    }
  } finally { clearTimeout(t); }
  if (!csv) throw new Error('Treasury CSV fetch failed for ' + yr + ' and ' + (yr - 1));
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const ci = header.indexOf('10 Yr');
  if (ci < 0) throw new Error('"10 Yr" column not found in Treasury header: ' + lines[0]);
  const newest = lines[1].split(',');
  const oldest = lines[lines.length - 1].split(',');
  show('Treasury daily CSV US10Y', `year=${usedYear}  rows=${lines.length - 1}  col=${ci}\nnewest: ${newest[0]} -> ${newest[ci]}\noldest: ${oldest[0]} -> ${oldest[ci]}`);
}

// 9) gold-api.com spot XAU + XAG (silver price + gold/silver ratio legs)
{
  const xau = await j(`${GOLDAPI}/price/XAU`, 'gold-api XAU');
  const xag = await j(`${GOLDAPI}/price/XAG`, 'gold-api XAG');
  if (xau && xag){
    if (!(xau.price > 0) || !(xag.price > 0)) throw new Error('gold-api returned non-positive prices');
    show('gold-api.com spot', `XAU=${xau.price} (${xau.updatedAt})\nXAG=${xag.price} (${xag.updatedAt})\nimplied GSR=${(xau.price / xag.price).toFixed(1)}`);
  }
}

console.log('\nALL SMOKE TESTS PASSED (skipped Binance legs are OK in geo-blocked regions)');
