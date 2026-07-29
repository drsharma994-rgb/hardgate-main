/* HARDGATE — live gate-calibration audit (one-shot diagnostic, not part of the app).
   Fetches the real Binance USDT-M futures universe + 4h klines and measures how
   many symbols currently pass simplified versions of the brain gates G1-G4,
   plus "near-miss" counts (all-but-one gate). Answers: is the market genuinely
   flat, or are the gates miscalibrated? Run: node scripts/gate-audit.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const sandbox = { Math, JSON, NaN, isFinite, parseFloat, console };
vm.createContext(sandbox);
for (const f of ['indicators.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}
const { ema, rsi, atr, volZ, adx } = sandbox;

const FAPI = 'https://fapi.binance.com';
const TOP_N = 150;          /* top turnover symbols */
const CHUNK = 10, SLEEP = 250;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function j(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-gate-audit/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}

function pct(x, n){ return (x * 100).toFixed(1) + '%'; }

const tickers = await j(FAPI + '/fapi/v1/ticker/24hr');
const uni = tickers
  .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
  .map(t => ({ sym: t.symbol, qv: +t.quoteVolume }))
  .filter(t => isFinite(t.qv) && t.qv > 0)
  .sort((a, b) => b.qv - a.qv)
  .slice(0, TOP_N);

console.log('universe: ' + uni.length + ' symbols (top by 24h quote volume)');

const tally = {
  scanned: 0, errors: 0,
  turnover5M: 0, atrOK: 0, structure: 0, momentum: 0, allFour: 0,
  near3of4: 0,
  structLong: 0, structShort: 0,
  rsiOK: 0, volzOK: 0,
};
const nearMisses = [];

for (let i = 0; i < uni.length; i += CHUNK){
  const batch = uni.slice(i, i + CHUNK);
  await Promise.all(batch.map(async u => {
    try{
      const k = await j(FAPI + '/fapi/v1/klines?symbol=' + u.sym + '&interval=4h&limit=220');
      const rows = k.map(r => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
      if (rows.length < 210) return;
      tally.scanned++;
      const closes = rows.map(r => r.c);
      const n = rows.length - 1;
      const last = rows[n];

      /* G4 liquidity/vol */
      const atrV = atr(rows, 14)[n];
      const atrPct = atrV / last.c;
      const gTurn = u.qv >= 5e6;
      const gAtr = atrPct >= 0.015;
      if (gTurn) tally.turnover5M++;
      if (gAtr) tally.atrOK++;

      /* G1 structure: EMA cascade + close on the right side of EMA200 */
      const e21 = ema(closes, 21)[n], e50 = ema(closes, 50)[n], e200 = ema(closes, 200)[n];
      const longStruct = e21 > e50 && e50 > e200 && last.c > e200;
      const shortStruct = e21 < e50 && e50 < e200 && last.c < e200;
      const gStruct = longStruct || shortStruct;
      if (gStruct) tally.structure++;
      if (longStruct) tally.structLong++;
      if (shortStruct) tally.structShort++;

      /* G2 momentum: RSI band + adaptive participation (mirrors engine.js) */
      const rsiArr = rsi(closes, 14);
      const rsiV = rsiArr[n], rPrev = rsiArr[rsiArr.length - 4];
      const vz = volZ(rows, 20);
      const range = last.h - last.l;
      const closePos = range > 0 ? (last.c - last.l) / range : 0.5;
      const closeOK = longStruct ? closePos >= 0.60 : closePos <= 0.40;
      const slopeOK = isFinite(rPrev) ? (longStruct ? rsiV > rPrev : rsiV < rPrev) : false;
      const volOK = isFinite(vz) && vz > 0.5;
      const gRsi = longStruct ? (rsiV >= 45 && rsiV <= 72) : (rsiV >= 28 && rsiV <= 55);
      const gVolz = volOK || (closeOK && slopeOK && !(isFinite(vz) && vz <= -1.5 && !closeOK));
      if (gRsi) tally.rsiOK++;
      if (gVolz) tally.volzOK++;
      const gMom = gRsi && gVolz;
      if (gMom) tally.momentum++;

      const gates = [gTurn && gAtr, gStruct, gMom];
      const passed = gates.filter(Boolean).length;
      if (gTurn && gAtr && gStruct && gMom) tally.allFour++;
      else if (passed === 2 && gStruct) {
        tally.near3of4++;
        nearMisses.push(u.sym + ' ' + (longStruct ? 'LONG' : 'SHORT')
          + ' rsi=' + rsiV.toFixed(1) + ' volz=' + vz.toFixed(2)
          + ' atr%=' + pct(atrPct) + ' qv=$' + (u.qv / 1e6).toFixed(1) + 'M'
          + (gMom ? '' : ' [momentum blocked]') + ((gTurn && gAtr) ? '' : ' [liquidity blocked]'));
      }
    }catch(e){ tally.errors++; }
  }));
  if (i + CHUNK < uni.length) await sleep(SLEEP);
}

console.log('\n=== GATE FUNNEL (live, ' + new Date().toISOString() + ') ===');
console.log('scanned           ' + tally.scanned + ' (errors ' + tally.errors + ')');
console.log('turnover >= $5M   ' + tally.turnover5M + '  (' + pct(tally.turnover5M / tally.scanned) + ')');
console.log('ATR >= 1.5%       ' + tally.atrOK + '  (' + pct(tally.atrOK / tally.scanned) + ')');
console.log('G1 structure      ' + tally.structure + '  (' + pct(tally.structure / tally.scanned) + ')  long ' + tally.structLong + ' / short ' + tally.structShort);
console.log('G2 momentum       ' + tally.momentum + '  (' + pct(tally.momentum / tally.scanned) + ')  [rsi band ok: ' + tally.rsiOK + ', volz ok: ' + tally.volzOK + ']');
console.log('ALL GATES         ' + tally.allFour + '  (' + pct(tally.allFour / tally.scanned) + ')');
console.log('near-miss (struct + 1 other) ' + tally.near3of4);
console.log('\n=== NEAR-MISSES (structure committed, one gate short) ===');
nearMisses.slice(0, 25).forEach(s => console.log('  ' + s));
