/* HARDGATE — full SWING gate-chain audit (exact replica of index.html runScan
   swing branch, post-v47 adaptive vol gate) against live Binance 4h data.
   Prints per-gate attrition so we can see what actually zeroes the tab.
   Run: node scripts/swing-audit.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const sandbox = { Math, JSON, NaN, isFinite, parseFloat, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'indicators.js'), 'utf8'), sandbox, { filename: 'indicators.js' });
const { ema, rsi, atr, volZ, lastSwing, cusumLast } = sandbox;

const FAPI = 'https://fapi.binance.com';
const TOP_N = 120, CHUNK = 10, SLEEP = 250;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function j(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-swing-audit/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const last = a => a[a.length - 1];

const tickers = await j(FAPI + '/fapi/v1/ticker/24hr');
const uni = tickers
  .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
  .map(t => ({ sym: t.symbol, qv: +t.quoteVolume }))
  .filter(t => isFinite(t.qv) && t.qv > 0)
  .sort((a, b) => b.qv - a.qv)
  .slice(0, TOP_N);

const G = { scanned:0, hist:0, cascade:0, spread:0, ema200:0, rsi:0, vol:0, close:0,
            anchor:0, risk:0, rr:0, cusum:0, PASS:0 };
const passed = [];

for (let i = 0; i < uni.length; i += CHUNK){
  await Promise.all(uni.slice(i, i + CHUNK).map(async u => {
    try{
      const k = await j(FAPI + '/fapi/v1/klines?symbol=' + u.sym + '&interval=4h&limit=260');
      const rows = k.map(r => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
      if (rows.length < 210) return;
      G.scanned++;
      const c = rows.map(r => r.c);
      const e9 = last(ema(c, 9)), e21 = last(ema(c, 21)), e50 = last(ema(c, 50)), e200 = last(ema(c, 200));
      const p = last(c), r14 = last(rsi(c, 14)), vz = volZ(rows, 20);
      let dir = null;
      if (e9 > e21 && e21 > e50) dir = 'long'; else if (e9 < e21 && e21 < e50) dir = 'short';
      if (!dir) return;                        G.cascade++;
      const a4 = last(atr(rows, 14));
      if (!(isFinite(a4) && Math.abs(e21 - e50) >= 0.25 * a4)) return;   G.spread++;
      if (dir === 'long' ? !(p > e200) : !(p < e200)) return;            G.ema200++;
      if ((dir === 'long' && r14 > 70) || (dir === 'short' && r14 < 30)) return;  G.rsi++;
      /* v47 adaptive participation */
      const cur = rows[rows.length - 1], range = cur.h - cur.l;
      const closePos = range > 0 ? (cur.c - cur.l) / range : 0.5;
      const closeOK = dir === 'long' ? closePos >= 0.60 : closePos <= 0.40;
      const rA = rsi(c, 14), rP = rA[rA.length - 4];
      const slopeOK = isFinite(rP) ? (dir === 'long' ? r14 > rP : r14 < rP) : false;
      if (!((vz > 0.5) || (closeOK && slopeOK))) return;                 G.vol++;
      if (!closeOK) return;                                              G.close++;
      const stop = lastSwing(rows, dir, 30);
      const distToAnchor = Math.abs(p - e21) / a4;
      if (!(isFinite(distToAnchor) && distToAnchor <= 1.5)) return;      G.anchor++;
      let entry = p;
      const distToFast = Math.abs(p - e9) / a4;
      if (distToFast > 0.25) entry = dir === 'long' ? Math.min(p, e9) : Math.max(p, e9);
      let stopCapped = stop;   /* v48: house ATR cap when structure is too far */
      if (Math.abs(entry - stopCapped) > 1.5 * a4) stopCapped = dir === 'long' ? entry - 1.5 * a4 : entry + 1.5 * a4;
      const risk = Math.abs(entry - stopCapped);
      if (!(risk > 0)) return;                                           G.risk++;
      const rr = (a4 * 3.5) / risk;
      if (!(rr >= 2)) return;                                            G.rr++;
      const ev = cusumLast(c.slice(-120), 1);
      if (ev && ev.barsAgo <= 20 && ev.dir !== dir) return;              G.cusum++;
      G.PASS++;
      passed.push(u.sym + ' ' + dir.toUpperCase() + ' @ ' + entry.toPrecision(6)
        + ' · stop ' + (+stopCapped).toPrecision(6) + ' · rr ' + rr.toFixed(2)
        + ' · volz ' + vz.toFixed(2) + ' · close ' + Math.round(closePos * 100) + '%');
    }catch(e){}
  }));
  if (i + CHUNK < uni.length) await sleep(SLEEP);
}

console.log('=== SWING GATE ATTRITION (live ' + new Date().toISOString() + ', top ' + TOP_N + ') ===');
const stages = ['scanned','cascade','spread','ema200','rsi','vol','close','anchor','risk','rr','cusum','PASS'];
for (const s of stages) console.log(s.padEnd(9), G[s]);
console.log('\n=== PASSING SETUPS ===');
passed.forEach(s => console.log('  ' + s));
