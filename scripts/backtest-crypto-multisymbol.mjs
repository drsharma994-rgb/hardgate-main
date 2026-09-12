/* Quick multi-symbol backtest to find which crypto/timeframe actually works */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');

async function jget(url){ const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-crypto-backtest/1.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }

async function fetchKlines(symbol, interval, target){
  const IV_SEC = { '15m': 900, '1h': 3600 };
  const ivMs = IV_SEC[interval] * 1000;
  let out = [], endTime;
  while (out.length < target){
    const lim = Math.min(1000, target - out.length + 2);
    let url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + lim;
    if (endTime) url += '&endTime=' + endTime;
    const batch = await jget(url);
    if (!Array.isArray(batch) || !batch.length) break;
    out = batch.concat(out);
    endTime = batch[0][0] - 1;
    if (batch.length < lim) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const seen = new Set();
  const rows = out.filter(k => { if (seen.has(k[0])) return false; seen.add(k[0]); return true; })
    .map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))
    .sort((a, b) => a.t - b.t);
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();
  return rows;
}

async function cachedKlines(symbol, interval, target){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-' + interval + '.json');
  if (fs.existsSync(file)){
    try{ const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j.rows && j.rows.length >= target) {
        console.log('  cache hit ' + symbol + ' ' + interval + ': ' + j.rows.length + ' bars');
        return j.rows.slice(-target);
      }
    }catch(e){}
  }
  console.log('  fetching ' + symbol + ' ' + interval + ' x' + target + '...');
  const rows = await fetchKlines(symbol, interval, target);
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, interval, target, rows }));
  return rows;
}

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'cryptoultra.js'), 'utf8'), ctx, { filename: 'cryptoultra.js' });
  return ctx;
}

function testSymbol(W, symbol, interval, m15, h1, costs){
  const MIN_15M = 230, WIN_15M = 320, WIN_1H = 400;
  const IV_SEC = { '15m': 900, '1h': 3600 };
  const sigs = [];
  let h1Ptr = 0;

  for (let i = MIN_15M - 1; i < m15.length - 1; i++){
    const now = (m15[i].t + IV_SEC[interval]) * 1000;
    const rows15 = m15.slice(Math.max(0, i - WIN_15M + 1), i + 1);
    while (h1Ptr < h1.length && (h1[h1Ptr].t + 3600) * 1000 <= now) h1Ptr++;
    const rows1h = h1.slice(Math.max(0, h1Ptr - WIN_1H), h1Ptr);
    try{
      const r = W.cryptoUltraEngine({ rows15m: rows15, rows1h, now, allowUnverified: true, venueCost: costs, rule: { minPct: 0, minAvail: 0, regimeGate: false } });
      if (r.ok && r.plan) sigs.push({ i, pct: r.count.pct, lead: r.count.lead, plan: r.plan });
    }catch(e){}
  }

  const live = { long: null, short: null };
  const trades = [];
  const COST_FRAC = costs.rtFrac;

  for (let bi = MIN_15M; bi < m15.length; bi++){
    const bar = m15[bi];
    for (const dir of ['long', 'short']){
      const tr = live[dir];
      if (!tr) continue;
      const hitStop = dir === 'long' ? bar.l <= tr.stop : bar.h >= tr.stop;
      const hitT1 = dir === 'long' ? bar.h >= tr.t1 : bar.l <= tr.t1;
      if (hitStop && hitT1) { tr.outcome = 'loss'; tr.netR = -1; }
      else if (hitStop) { tr.outcome = 'loss'; tr.netR = -1; }
      else if (hitT1) { tr.outcome = 'win'; tr.netR = Math.abs(tr.t1 - tr.entry) / Math.abs(tr.stop - tr.entry); }
      else if (bi - tr.fillIdx >= 24) { const risk = Math.abs(tr.stop - tr.entry), mv = dir === 'long' ? bar.c - tr.entry : tr.entry - bar.c; tr.outcome = 'timeout'; tr.netR = mv / risk; }

      if (tr.outcome) {
        if (tr.netR != null && isFinite(tr.netR)) {
          tr.netR -= (tr.entry * COST_FRAC) / Math.abs(tr.stop - tr.entry);
          trades.push(tr);
        }
        live[dir] = null;
      }
    }

    const s = sigs[bi - (MIN_15M - 1)];
    if (!s) continue;
    if (live[s.lead]) continue;
    live[s.lead] = { dir: s.lead, fillIdx: bi, entry: s.plan.entry, stop: s.plan.stop, t1: s.plan.t1, pct: s.pct };
  }

  const settled = trades.filter(t => t.netR != null && isFinite(t.netR));
  const wins = settled.filter(t => t.outcome === 'win').length;
  return {
    n: settled.length,
    wins: wins,
    winRate: settled.length ? (wins / settled.length).toFixed(3) : null,
    avgR: settled.length ? (settled.reduce((s, t) => s + t.netR, 0) / settled.length).toFixed(3) : null,
    sumR: settled.reduce((s, t) => s + t.netR, 0).toFixed(2)
  };
}

console.log('=== CRYPTO ULTRA multi-symbol test ===\n');
const W = boot();

const tests = [
  { symbol: 'BTCUSDT', interval: '15m', bars: 1000, costs: { venue: 'Binance', rtFrac: 0.002 } },
  { symbol: 'BTCUSDT', interval: '1h',  bars: 250,  costs: { venue: 'Binance', rtFrac: 0.002 } },
  { symbol: 'ETHUSDT', interval: '15m', bars: 1000, costs: { venue: 'Binance', rtFrac: 0.002 } },
  { symbol: 'SOLUSDT', interval: '15m', bars: 1000, costs: { venue: 'Binance', rtFrac: 0.002 } }
];

const results = [];

for (const test of tests){
  console.log('Testing ' + test.symbol + ' ' + test.interval + '...');
  const m15 = await cachedKlines(test.symbol, test.interval, test.bars);
  const h1_bars = Math.ceil(test.bars / 4) + 408;
  const h1_interval = test.interval === '15m' ? '1h' : '4h';
  const h1 = await cachedKlines(test.symbol, h1_interval, h1_bars);

  const r = testSymbol(W, test.symbol, test.interval, m15, h1, test.costs);
  results.push({ symbol: test.symbol, interval: test.interval, ...r });
  console.log('  ' + test.symbol + ' ' + test.interval + ': n=' + r.n + ' win ' + (r.winRate ? (r.winRate * 100).toFixed(0) + '%' : '—') + ' net ' + r.avgR + 'R');
}

console.log('\n=== RESULTS ===');
console.log('Symbol      | Interval | Trades | Win%  | Avg R');
console.log('------------|----------|--------|-------|-------');
for (const r of results){
  const sym = (r.symbol + '        ').slice(0, 11);
  const int = (r.interval + '   ').slice(0, 8);
  const n = (r.n + '      ').slice(0, 6);
  const w = (r.winRate ? (r.winRate * 100).toFixed(0) + '%' : '—   ') + '  ';
  const a = r.avgR + 'R';
  console.log(sym + '| ' + int + ' | ' + n + ' | ' + w + ' | ' + a);
}

const best = results.filter(r => r.n >= 20 && r.avgR > 0).sort((a, b) => b.avgR - a.avgR)[0];
if (best) {
  console.log('\n✓ FOUND WORKING RULE: ' + best.symbol + ' ' + best.interval + ' (' + best.n + ' trades, +' + best.avgR + 'R avg)');
} else {
  console.log('\n✗ No working rule found — all symbols/timeframes have n<20 or negative avg R');
}
