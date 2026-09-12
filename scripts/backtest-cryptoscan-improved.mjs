/* CRYPTO SCAN with improved entry/exit logic - professional position management */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');

async function jget(url){ const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-cryptoscan/1.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }

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
        console.log('  cache ' + symbol + ' ' + interval + ': ' + j.rows.length + ' bars');
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

console.log('=== CRYPTO SCAN with Improved Entry/Exit Logic ===\n');

const W = boot();
const symbol = 'BTCUSDT';
const COST_FRAC = 0.002;  // Binance 0.10% each side

console.log('Testing ' + symbol + ' with improved rules...');
const m15 = await cachedKlines(symbol, '15m', 2000);
const h1 = await cachedKlines(symbol, '1h', 500);

const MIN_15M = 230, WIN_15M = 320, WIN_1H = 400;

// Generate signals
const sigs = [];
let h1Ptr = 0;
for (let i = MIN_15M - 1; i < m15.length - 1; i++){
  const now = (m15[i].t + 900) * 1000;
  const rows15 = m15.slice(Math.max(0, i - WIN_15M + 1), i + 1);
  while (h1Ptr < h1.length && (h1[h1Ptr].t + 3600) * 1000 <= now) h1Ptr++;
  const rows1h = h1.slice(Math.max(0, h1Ptr - WIN_1H), h1Ptr);
  try{
    const r = W.cryptoUltraEngine({ rows15m: rows15, rows1h, now, allowUnverified: true, venueCost: { venue: 'Binance', rtFrac: COST_FRAC }, rule: { minPct: 0, minAvail: 0, regimeGate: false } });
    if (r.ok && r.plan) sigs.push({ i, pct: r.count.pct, lead: r.count.lead, sigBar: m15[i], nextBar: i + 1 });
  }catch(e){}
}

console.log('Generated ' + sigs.length + ' signals\n');

// Trade with IMPROVED logic
const live = { long: null, short: null };
const trades = [];
let tradeCount = 0;

for (let bi = MIN_15M + 1; bi < m15.length; bi++){
  const bar = m15[bi];

  // Check exits for open trades
  for (const dir of ['long', 'short']){
    const tr = live[dir];
    if (!tr) continue;

    // Exit logic: hit TP (close 50%), SL, or timeout
    if (tr.state === 'pending') tr.state = 'filled';

    const hitSL = dir === 'long' ? bar.l <= tr.stop : bar.h >= tr.stop;
    const hitTP = dir === 'long' ? bar.h >= tr.tp1 : bar.l <= tr.tp1;

    if (hitSL && hitTP) { tr.netR = -1; tr.outcome = 'both-touch'; }
    else if (hitSL) { tr.netR = -1; tr.outcome = 'sl'; }
    else if (hitTP) {
      // At TP1, close 50%, move stop to breakeven, runner to TP2
      if (!tr.halfClosed) {
        tr.halfClosed = true;
        tr.stop = tr.entry;  // Move SL to breakeven
        tr.tp1 = tr.tp2;     // Runner to TP2
      } else {
        // Second TP hit
        tr.netR = Math.abs(tr.tp2 - tr.entry) / Math.abs(tr.stop - tr.entry) * 0.5 + 0.5 * (Math.abs(tr.tp1 - tr.entry) / Math.abs(tr.stop - tr.entry));
        tr.outcome = 'tp2';
      }
    }
    else if (bi - tr.fillBar >= 24) { const risk = Math.abs(tr.stop - tr.entry), mv = dir === 'long' ? bar.c - tr.entry : tr.entry - bar.c; tr.netR = mv / risk; tr.outcome = 'timeout'; }

    if (tr.outcome && tr.netR != null){
      tr.netR -= (tr.entry * COST_FRAC) / Math.abs(tr.stop - tr.entry);
      trades.push(tr);
      live[dir] = null;
    }
  }

  // Check new entries: use NEXT bar open, not signal close
  const sig = sigs.filter(s => s.nextBar === bi)[0];
  if (!sig) continue;

  // Entry: next bar open (more realistic than signal close)
  const entry = bar.o;
  const risk = Math.abs(sig.sigBar.c - entry) * 1.5;  // 1.5x the signal move
  const stop = sig.lead === 'long' ? entry - risk : entry + risk;
  const atr = Math.abs(sig.sigBar.h - sig.sigBar.l) * 1.5;

  if (Math.abs(stop - entry) < atr * 0.8) continue;  // Skip weak setups
  if (live[sig.lead]) continue;  // Don't override live position

  const tp1 = sig.lead === 'long' ? entry + risk * 1.5 : entry - risk * 1.5;
  const tp2 = sig.lead === 'long' ? entry + risk * 2.5 : entry - risk * 2.5;

  live[sig.lead] = {
    dir: sig.lead, entry, stop, tp1, tp2, fillBar: bi, state: 'pending',
    pct: sig.pct, outcome: null, netR: null, halfClosed: false
  };
  tradeCount++;
}

const settled = trades.filter(t => t.netR != null && isFinite(t.netR));
const wins = settled.filter(t => t.outcome === 'tp2' || (t.outcome === 'timeout' && t.netR > 0)).length;

console.log('=== RESULTS ===');
console.log('Signals: ' + sigs.length);
console.log('Trades opened: ' + tradeCount);
console.log('Trades settled: ' + settled.length);
console.log('Wins: ' + wins + ' (' + (settled.length ? (wins / settled.length * 100).toFixed(0) : '0') + '%)');
if (settled.length) {
  const avgR = (settled.reduce((s, t) => s + t.netR, 0) / settled.length).toFixed(3);
  console.log('Avg R/trade: ' + avgR);
  console.log('Sum R: ' + settled.reduce((s, t) => s + t.netR, 0).toFixed(2));
}
