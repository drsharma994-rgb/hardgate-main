/* HARDGATE — indicators.js unit tests (Node 18+, offline).
   Loads indicators.js as a classic global script (same as browser).
   Complements test-indicators2.mjs (indicators2-only helpers) and indirect
   coverage in meanrev/squeeze/trendtable. Run: node tests/test-indicators.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
vm.runInContext(readFileSync(path.join(root, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
const G = ctx;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
function approx(a, b, eps, msg){
  assert(isFinite(a) && Math.abs(a - b) <= eps, msg + ' (got ' + a + ', want ~' + b + ')');
}

function flatRows(n, base, spread, vol){
  const r = [];
  for (let i = 0; i < n; i++){
    r.push({ t: i, o: base, h: base + spread, l: base - spread, c: base, v: vol == null ? 1000 : vol });
  }
  return r;
}
function trendRows(n, start, step){
  const r = [];
  for (let i = 0; i < n; i++){
    const c = start + (i + 1) * step;
    const o = c - step;
    r.push({ t: i, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 + i });
  }
  return r;
}

console.log('== ema / rsi / atr ==');
{
  const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const e = G.ema(closes, 3);
  assert(e.slice(0, 2).every(Number.isNaN) && isFinite(e[9]), 'ema: NaN until p-1 then finite');
  approx(e[9], 9, 0.01, 'ema: uptrend last value near close');

  const flat = new Array(20).fill(100);
  const r = G.rsi(flat, 14);
  assert(r[19] === 50, 'rsi: flat series => neutral 50');

  const fr = flatRows(30, 50, 2);
  const a = G.atr(fr, 14);
  assert(a.slice(0, 14).every(Number.isNaN) && isFinite(a[29]), 'atr: warmup then finite');
  approx(a[29], 4, 0.01, 'atr: pinned h/l spread => TR ~4');
}

console.log('== bollinger / macdHist / nanEmaLocal ==');
{
  const flat = new Array(30).fill(100);
  const bb = G.bollinger(flat, 20, 2);
  approx(bb.widthPct[29], 0, 1e-9, 'bollinger: flat closes => widthPct ~0');

  const macd = G.macdHist(flat, 12, 26, 9);
  assert(macd.slice(-5).every(v => Math.abs(v) < 1e-6), 'macdHist: flat series => ~0 tail');

  const messy = [NaN, NaN, 1, 2, 3, 4, 5];
  const ne = G.nanEmaLocal(messy, 3);
  assert(Number.isNaN(ne[0]) && Number.isNaN(ne[1]) && isFinite(ne[6]), 'nanEmaLocal: skips leading NaNs');
}

console.log('== volZ / roc / avgFinite / lastSwing ==');
{
  const vz = flatRows(25, 100, 1, 500);
  assert(G.volZ(vz, 20) === 0, 'volZ: constant volume => 0');

  const spike = flatRows(25, 100, 1, 500);
  for (let i = 0; i < 24; i++) spike[i].v = 400 + (i % 5) * 20;
  spike[24].v = 5000;
  assert(G.volZ(spike, 20) > 1, 'volZ: volume spike => positive z');

  const up = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  approx(G.roc(up, 10), 10, 0.01, 'roc: +10% over 10 bars');

  approx(G.avgFinite([NaN, 2, 4]), 3, 1e-9, 'avgFinite: ignores NaN');
  assert(Number.isNaN(G.avgFinite([NaN, NaN])), 'avgFinite: all NaN => NaN');

  const seg = trendRows(40, 50, 0.5);
  const sw = G.lastSwing(seg, 'long', 10);
  assert(isFinite(sw) && sw < seg[38].c, 'lastSwing long: min low in lookback segment');
}

console.log('== adx / stochRsi / vwapDev / cascadeAge ==');
{
  const flat = flatRows(80, 100, 0.5);
  const adxFlat = G.adx(flat, 14);
  assert(Number.isNaN(adxFlat.adx[79]), 'adx: flat market => NaN ADX');

  const tr = trendRows(80, 100, 0.8);
  const adxTr = G.adx(tr, 14);
  assert(isFinite(adxTr.adx[79]) && adxTr.adx[79] > 20, 'adx: trend fixture => ADX > 20');

  const closes = [];
  for (let i = 0; i < 60; i++) closes.push(100 + 5 * Math.sin(i / 3));
  const k = G.stochRsi(closes, 14, 14);
  const tail = k.filter(isFinite);
  assert(tail.length > 5 && tail.every(v => v >= 0 && v <= 100), 'stochRsi: bounded 0..100 where defined');

  const vw = flatRows(25, 100, 1);
  vw[24].c = 102;
  const dev = G.vwapDev(vw, 20);
  assert(isFinite(dev) && dev > 0, 'vwapDev: close above VWAP => positive % dev');

  const cas = trendRows(120, 50, 0.4).map(r => r.c);
  assert(G.cascadeAge(cas, 'long') >= 5, 'cascadeAge: uptrend => stacked EMA age > 0');
}

console.log('== cusumLast / findPivots ==');
{
  assert(G.cusumLast([100, 100, 100], 1) === null, 'cusumLast: short series => null');

  const jump = new Array(40).fill(100);
  for (let i = 20; i < 40; i++) jump[i] = 100 + (i - 19) * 2;
  const cu = G.cusumLast(jump, 1);
  assert(cu && (cu.dir === 'long' || cu.dir === 'short') && cu.barsAgo >= 0, 'cusumLast: trend break detected');

  const w = [1, 2, 3, 2, 1, 2, 3, 2, 1];
  const piv = G.findPivots(w, 1);
  assert(piv.some(p => p.type === 'high' && p.v === 3), 'findPivots: detects local high');
  assert(piv.some(p => p.type === 'low' && p.v === 1), 'findPivots: detects local low');
}

console.log('== findOrderBlock / findLiquidityPools / text helpers ==');
{
  const rows = flatRows(35, 100, 0.5);
  for (let i = 0; i < 35; i++){
    rows[i].v = 1000;
    rows[i].o = 100;
    rows[i].c = 100.2;
    rows[i].h = 100.5;
    rows[i].l = 99.5;
  }
  rows[32].o = 100.5;
  rows[32].c = 99.8;
  rows[32].h = 101;
  rows[32].l = 99.5;
  rows[33].o = 100;
  rows[33].c = 104;
  rows[33].h = 104.5;
  rows[33].l = 99.8;
  rows[34].o = 103.5;
  rows[34].c = 103.8;
  rows[34].h = 104;
  rows[34].l = 103;

  const ob = G.findOrderBlock(rows, 'long');
  assert(ob && ob.top > ob.bottom && ob.age >= 0, 'findOrderBlock: long displacement fixture => OB');

  const lpRows = flatRows(30, 100, 0.3);
  for (let i = 10; i < 15; i++){
    lpRows[i].h = 101.0;
    lpRows[i].l = 99.7;
  }
  lpRows[29].c = 100.5;
  const lp = G.findLiquidityPools(lpRows);
  assert(lp.buySide && lp.buySide.count >= 2, 'findLiquidityPools: equal-high cluster on buy side');

  ctx.px = n => Number(n).toFixed(1);
  const txt = G.nearestOBText(rows, 'long');
  assert(txt.indexOf('–') >= 0 && txt.indexOf('bars') >= 0, 'nearestOBText: formatted range when px stubbed');
  const ltxt = G.liquidityTargetText(lpRows, 'long');
  assert(ltxt.indexOf('x') >= 0 || ltxt === 'none nearby', 'liquidityTargetText: pool count or none');
}

console.log('== detectRegime / volRegime / bollingerPercentB / volumeProfile ==');
{
  assert(G.detectRegime(flatRows(30, 100, 1)).label === 'DATA THIN', 'detectRegime: <60 bars => DATA THIN');

  const comp = flatRows(80, 100, 0.2);
  const reg = G.detectRegime(comp);
  assert(reg.regime === 'compression' || reg.regime === 'range' || reg.regime === 'weak_trend',
    'detectRegime: low-vol flat => compression/range/weak (got ' + reg.regime + ')');

  const vr = G.volRegime(flatRows(60, 100, 0.15), 50);
  assert(vr === 'COMPRESSING' || vr === 'NORMAL', 'volRegime: tight ATR => COMPRESSING or NORMAL');

  const band = trendRows(25, 100, 0.05);
  const pb = G.bollingerPercentB(band, 20, 2);
  assert(isFinite(pb) && pb > 0.3 && pb <= 1, 'bollingerPercentB: trending close inside bands (got ' + pb + ')');

  const vpRows = flatRows(10, 100, 1);
  for (let i = 0; i < 10; i++) vpRows[i].v = i === 5 ? 5000 : 100;
  const vp = G.volumeProfile(vpRows, 8);
  assert(vp && isFinite(vp.poc) && vp.vah >= vp.poc && vp.val <= vp.poc, 'volumeProfile: POC inside value area');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
