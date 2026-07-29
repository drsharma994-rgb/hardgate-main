/* HARDGATE — full SCALP gate-chain audit (exact replica of index.html runScan
   scalp branch, post-v47) against live Binance 1h+15m data. Run: node scripts/scalp-audit.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const sandbox = { Math, JSON, NaN, isFinite, parseFloat, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'indicators.js'), 'utf8'), sandbox, { filename: 'indicators.js' });
const { ema, rsi, atr, volZ } = sandbox;

const FAPI = 'https://fapi.binance.com';
const TOP_N = 80, CHUNK = 8, SLEEP = 300;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function j(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-scalp-audit/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const last = a => a[a.length - 1];
const klines = async (sym, interval, limit) =>
  (await j(FAPI + '/fapi/v1/klines?symbol=' + sym + '&interval=' + interval + '&limit=' + limit))
    .map(r => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));

const tickers = await j(FAPI + '/fapi/v1/ticker/24hr');
const uni = tickers
  .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
  .map(t => ({ sym: t.symbol, qv: +t.quoteVolume }))
  .filter(t => isFinite(t.qv) && t.qv > 0)
  .sort((a, b) => b.qv - a.qv)
  .slice(0, TOP_N);

const G = { scanned:0, h1cascade:0, sweepReclaim:0, pullbackHold:0, triggerEither:0,
            rsiBand:0, atrRegime:0, vol:0, close:0, rr:0, PASS:0 };
const passed = [];

for (let i = 0; i < uni.length; i += CHUNK){
  await Promise.all(uni.slice(i, i + CHUNK).map(async u => {
    try{
      const h1 = await klines(u.sym, '1h', 120);
      if (h1.length < 60) return;
      G.scanned++;
      const c1 = h1.map(r => r.c);
      const e9h = last(ema(c1, 9)), e21h = last(ema(c1, 21)), e50h = last(ema(c1, 50));
      let dir = null;
      if (e9h > e21h && e21h > e50h) dir = 'long'; else if (e9h < e21h && e21h < e50h) dir = 'short';
      if (!dir) return;                                   G.h1cascade++;
      const m15 = await klines(u.sym, '15m', 160);
      if (m15.length < 60) return;
      const c15 = m15.map(r => r.c);
      const e9a = ema(c15, 9), e21a = ema(c15, 21);
      const n = c15.length;
      const priorWin = m15.slice(n-24, n-7);
      const localLow = Math.min(...priorWin.map(r => r.l));
      const localHigh = Math.max(...priorWin.map(r => r.h));
      const recentWin = m15.slice(n-7, n-1);
      const swept = dir === 'long' ? Math.min(...recentWin.map(r => r.l)) < localLow
                                   : Math.max(...recentWin.map(r => r.h)) > localHigh;
      const reclaimed = dir === 'long' ? (c15[n-1] > e9a[n-1] && e9a[n-1] > e21a[n-1])
                                       : (c15[n-1] < e9a[n-1] && e9a[n-1] < e21a[n-1]);
      if (swept && reclaimed) G.sweepReclaim++;
      /* alternative experienced-trader trigger: EMA21 pullback hold */
      const atrArr0 = atr(m15, 14); const a0 = last(atrArr0);
      const touched21 = dir === 'long'
        ? (m15[n-1].l <= e21a[n-1] + 0.3 * a0 && c15[n-1] > e21a[n-1])
        : (m15[n-1].h >= e21a[n-1] - 0.3 * a0 && c15[n-1] < e21a[n-1]);
      const pullbackHold = touched21 && reclaimed;
      if (pullbackHold) G.pullbackHold++;
      if (!(swept && reclaimed) && !pullbackHold) return;  G.triggerEither++;
      const r15 = last(rsi(c15, 14));
      if (dir === 'long' ? !(r15 >= 40 && r15 <= 65) : !(r15 >= 35 && r15 <= 60)) return;  G.rsiBand++;
      const atrArr = atr(m15, 14); const a = last(atrArr);
      const base = atrArr.slice(-96).filter(isFinite).sort((x, y) => x - y);
      const aMed = base.length ? base[Math.floor(base.length / 2)] : NaN;
      if (!(isFinite(a) && isFinite(aMed) && a >= 0.8 * aMed)) return;   G.atrRegime++;
      const vz = volZ(m15, 20);
      const cur = m15[n-1], range = cur.h - cur.l;
      const closePos = range > 0 ? (cur.c - cur.l) / range : 0.5;
      const closeOK = dir === 'long' ? closePos >= 0.60 : closePos <= 0.40;
      const rA = rsi(c15, 14), rP = rA[rA.length - 4];
      const slopeOK = isFinite(rP) ? (dir === 'long' ? r15 > rP : r15 < rP) : false;
      if (!((vz > 0.5) || (closeOK && slopeOK))) return;   G.vol++;
      if (!closeOK) return;                                G.close++;
      const entry = c15[n-1];
      const stop = dir === 'long' ? localLow - a * 0.25 : localHigh + a * 0.25;
      const risk = Math.abs(entry - stop);
      if (!(risk > 0)) return;
      const rr = (a * 2.5) / risk;
      if (!(rr >= 1.5)) return;                            G.rr++;
      G.PASS++;
      passed.push(u.sym + ' ' + dir.toUpperCase() + ' @ ' + entry.toPrecision(6)
        + ' · rr ' + rr.toFixed(2) + ' · trigger ' + ((swept && reclaimed) ? 'sweep+reclaim' : 'pullback-hold')
        + ' · volz ' + vz.toFixed(2));
    }catch(e){}
  }));
  if (i + CHUNK < uni.length) await sleep(SLEEP);
}

console.log('=== SCALP GATE ATTRITION (live ' + new Date().toISOString() + ', top ' + TOP_N + ') ===');
for (const s of ['scanned','h1cascade','sweepReclaim','pullbackHold','triggerEither','rsiBand','atrRegime','vol','close','rr','PASS'])
  console.log(s.padEnd(13), G[s]);
console.log('\n=== PASSING ===');
passed.forEach(s => console.log('  ' + s));
