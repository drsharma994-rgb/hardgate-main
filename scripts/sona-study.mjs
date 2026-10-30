#!/usr/bin/env node
/* scripts/sona-study.mjs — the SONA variation study (research harness, not shipped logic).
 *
 * Fetches PAXGUSDT 15m klines (the PAXG anchor the repo's gold replays use),
 * reuses sona.js's EXACT series math (EMA24/120, ATR14, UTC-day VWAP) via a VM,
 * and sweeps variations of the SONA decision: which prints fire, the body
 * floor, the EMA-120 slope leg, the session window, extra measured filters
 * (RSI14, VR20, ENTROPY20, volume ratio, hour buckets, direction) and the
 * stop-band / reward-R ladder. Every variation resolves with sona.js's
 * one-plan-held, cents-exact semantics (both-barriers-in-one-bar = 'both',
 * never a win).
 *
 * The study is reported in two halves of the window: a filter is only a
 * candidate when BOTH halves improve. Output: a ranked table.
 *
 * Run: node scripts/sona-study.mjs [--months=12] [--refresh]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts', '.sona-tape-paxg-15m.json');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const MONTHS = +(args.months || 12);

/* ---------- 1. the tape ---------- */
async function fetchTape(){
  if (!args.refresh && fs.existsSync(CACHE)){
    const j = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    console.log('tape: cached', j.rows.length, 'bars', j.first, '->', j.last);
    return j.rows;
  }
  const rows = [];
  const end = Date.now();
  let endTime = end;
  const want = Math.min(MONTHS * 31 * 96, 40000);
  while (rows.length < want){
    const url = 'https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=1000&endTime=' + endTime;
    const r = await fetch(url);
    if (!r.ok) throw new Error('binance http ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    const batch = j.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
    rows.unshift(...batch);
    endTime = j[0][0] - 1;
    if (j.length < 1000) break;
  }
  const seen = new Set(); const out = [];
  for (const r of rows){ if (seen.has(r.t)) continue; seen.add(r.t); out.push(r); }
  out.sort((a, b) => a.t - b.t);
  const rec = { fetchedAt: new Date().toISOString(), first: new Date(out[0].t).toISOString(), last: new Date(out[out.length - 1].t).toISOString(), rows: out };
  fs.writeFileSync(CACHE, JSON.stringify(rec));
  console.log('tape: fetched', out.length, 'bars', rec.first, '->', rec.last);
  return out;
}

/* ---------- 2. sona.js exact series via VM ---------- */
function loadSona(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sona.js'), 'utf8'), ctx, { filename: 'sona.js' });
  return ctx;
}

/* ---------- 3. exact decision semantics (mirroring sona.js hgSonaEval) ---------- */
function isNum(x){ return typeof x === 'number' && isFinite(x); }
const MINTICK = 0.01;
const centsOf = x => { if (!isNum(x)) return NaN; const s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) / MINTICK + 1e-8); };
const pxFromCents = c => c * MINTICK;
const divRound = (n, d) => Math.floor((n + Math.floor(d / 2)) / d);
function beyondWickCents(price, dir){
  if (!isNum(price)) return NaN;
  const scaled = price / MINTICK;
  let c;
  if (dir === 1){ c = Math.floor(scaled + 1e-8); if (c >= scaled - 1e-6) c -= 1; }
  else { c = Math.ceil(scaled - 1e-8); if (c <= scaled + 1e-6) c += 1; }
  return c;
}
const centsAtLeast = x => (!isNum(x) || !(x > 0)) ? NaN : Math.ceil(x / MINTICK - 1e-8);
const centsAtMost = x => (!isNum(x) || !(x > 0)) ? NaN : Math.floor(x / MINTICK + 1e-8);
const utcDay = ms => { const d = new Date(ms); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
const barMs = r => { let t = r.t; if (typeof t === 'string') t = Date.parse(t); if (!isNum(t)) return null; if (t < 1e12) t *= 1000; return t; };
const isSpan = (a, b, bars, step) => (a == null || b == null || !step) ? false : Math.abs((b - a) / step - bars) <= 0.51;

function planOf(row, dir, atr, p){
  const entryC = centsOf(row.c);
  const wick = dir === 1 ? row.l : row.h;
  const stopC = beyondWickCents(wick, dir);
  if (!isNum(entryC) || !isNum(stopC)) return null;
  const riskC = dir === 1 ? (entryC - stopC) : (stopC - entryC);
  if (!(riskC >= 1)) return null;
  const entryPx = pxFromCents(entryC);
  const floorAtr = centsAtLeast(p.stopAtrMin * atr);
  const floorCost = centsAtLeast(p.rtFrac * p.rtMult * entryPx);
  const floorC = Math.max(isNum(floorAtr) ? floorAtr : 0, isNum(floorCost) ? floorCost : 0);
  const ceilC = centsAtMost(p.stopAtrMax * atr);
  if (riskC < floorC) return null;
  if (!isNum(ceilC) || riskC > ceilC) return null;
  const rewardC = divRound(riskC * Math.round(p.rewardR * 100), 100);
  if (!(rewardC >= 1)) return null;
  return { dir, entry: entryPx, stop: pxFromCents(stopC), tp: pxFromCents(entryC + dir * rewardC),
           risk: pxFromCents(riskC), rr: rewardC / riskC };
}

function hitOf(row, s){
  const lowC = centsOf(row.l), highC = centsOf(row.h), stopC = centsOf(s.stop), tpC = centsOf(s.tp);
  if (![lowC, highC, stopC, tpC].every(isNum)) return null;
  const stopHit = s.dir === 1 ? lowC <= stopC : highC >= stopC;
  const tpHit = s.dir === 1 ? highC >= tpC : lowC <= tpC;
  if (stopHit && tpHit) return 'both';
  if (stopHit) return 'stopped';
  if (tpHit) return 'target';
  return null;
}

/* ---------- 4. feature precompute (once per tape) ---------- */
function sma(arr, n, i){ if (i + 1 < n) return NaN; let s = 0; for (let k = i - n + 1; k <= i; k++){ if (!isNum(arr[k])) return NaN; s += arr[k]; } return s / n; }
function rsiSeries(c, n){
  const out = new Array(c.length).fill(NaN);
  let ag = 0, al = 0;
  for (let i = 1; i < c.length; i++){
    const d = c[i] - c[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    if (i <= n){ ag += g; al += l; if (i === n){ ag /= n; al /= n; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } }
    else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
  }
  return out;
}
function vrAt(c, i, q, look){
  if (i - look + 1 < q + 2) return NaN;
  let mu = 0; const n0 = look;
  for (let k = i - look + 1; k <= i; k++) mu += c[k] - c[k - 1];
  mu /= n0;
  let s2a = 0;
  for (let k = i - look + 1; k <= i; k++){ const d = c[k] - c[k - 1] - mu; s2a += d * d; }
  s2a /= (n0 - 1);
  let s2c = 0, m = 0;
  for (let t = i - look + q; t <= i; t++){ const d = c[t] - c[t - q] - q * mu; s2c += d * d; m++; }
  if (!(m > 0) || !(s2a > 0)) return NaN;
  s2c /= m;
  return s2c / (q * s2a);
}
function entropyAt(c, i, look){
  let tot = 0; const b = { u: 0, d: 0, f: 0 };
  for (let k = Math.max(1, i - look + 1); k <= i; k++){
    const ch = c[k] - c[k - 1];
    b[ch > 1e-9 ? 'u' : ch < -1e-9 ? 'd' : 'f']++; tot++;
  }
  if (tot < 10) return NaN;
  let H = 0, syms = 0;
  for (const k of ['u', 'd', 'f']){ if (b[k] > 0){ syms++; const p = b[k] / tot; H -= p * Math.log(p) / Math.LN2; } }
  return (syms >= 2 && H > 0) ? H / Math.log2(syms) : 0;
}

function features(rows, series){
  const n = rows.length, c = rows.map(r => r.c), v = rows.map(r => r.v);
  const f = { rsi: rsiSeries(c, 14), vridx: new Array(n).fill(NaN), ent: new Array(n).fill(NaN), volr: new Array(n).fill(NaN) };
  for (let i = 0; i < n; i++){
    if (i % 4 === 0 || i > n - 200) f.vridx[i] = vrAt(c, i, 4, 120);   // VR every 4th bar, dense at the edge
    else f.vridx[i] = f.vridx[i - 1];
    f.ent[i] = i > 25 ? entropyAt(c, i, 20) : NaN;
    const vm1 = sma(v, 20, i - 1);
    f.volr[i] = (isNum(v[i]) && isNum(vm1) && vm1 > 0) ? v[i] / vm1 : NaN;
  }
  f.series = series;
  return f;
}

/* ---------- 5. one variation run ---------- */
function runVariation(rows, feat, p){
  const n = rows.length;
  const step = 15 * 60 * 1000;
  const signals = [];
  let open = null;
  const closed = n - 1; // drop the last (live) bar
  for (let i = 30; i < closed; i++){
    const r = rows[i], ms = barMs(r);
    if (open != null){
      const h = hitOf(r, signals[open]);
      if (h){ signals[open].state = h; signals[open].resolveMs = ms; open = null; }
    }
    const emaF = feat.series.emaFast[i], emaS = feat.series.emaSlow[i], atr = feat.series.atr[i], vwap = feat.series.vwap[i];
    if (!isNum(atr) || !(atr > 0)) continue;
    let pull = 0;
    if (isNum(emaF) && isNum(emaS)){
      if (emaF > emaS && r.l <= emaF && r.c > emaF && r.c > r.o) pull = 1;
      else if (emaF < emaS && r.h >= emaF && r.c < emaF && r.c < r.o) pull = -1;
    }
    let vw = 0;
    const prevI = i - p.vwLook;
    const prevVw = prevI >= 0 ? feat.series.vwap[prevI] : NaN;
    const prevMs = prevI >= 0 ? barMs(rows[prevI]) : null;
    if (prevI >= 0 && isNum(prevVw) && isNum(vwap) && isSpan(prevMs, ms, p.vwLook, step) && utcDay(prevMs) === utcDay(ms)){
      const up = r.c > vwap && vwap > prevVw && r.l <= vwap && r.c > r.o;
      const dn = r.c < vwap && vwap < prevVw && r.h >= vwap && r.c < r.o;
      if (up) vw = 1; else if (dn) vw = -1;
    }
    let agreed;
    if (p.prints === 'both') agreed = (pull !== 0 && pull === vw) ? pull : 0;
    else if (p.prints === 'ema') agreed = pull;
    else agreed = vw;
    if (agreed === 0) continue;
    if (p.bodyMin > 0 && !((r.c - r.o) * agreed >= p.bodyMin * atr)) continue;
    if (p.slopeOn){
      const sI = i - p.slopeLen;
      if (!(sI >= 0 && isSpan(barMs(rows[sI]), ms, p.slopeLen, step) && isNum(feat.series.emaSlow[sI]) && (emaS - feat.series.emaSlow[sI]) * agreed > 0)) continue;
    }
    if (p.sessStart != null){
      const d = new Date(ms), hm = d.getUTCHours() + d.getUTCMinutes() / 60;
      if (!(hm >= p.sessStart && hm < p.sessEnd)) continue;
    }
    if (p.dir === 1 && agreed !== 1) continue;
    if (p.dir === -1 && agreed !== -1) continue;
    if (p.rsiWith && !(isNum(feat.rsi[i]) && (agreed === 1 ? feat.rsi[i] > 50 : feat.rsi[i] < 50))) continue;
    if (p.vrTrend && !(isNum(feat.vridx[i]) && feat.vridx[i] > 1.05)) continue;
    if (p.entOrdered && !(isNum(feat.ent[i]) && feat.ent[i] <= 0.85)) continue;
    if (p.volAbove && !(isNum(feat.volr[i]) && feat.volr[i] > 1)) continue;
    if (p.hourDrop && p.hourDrop.indexOf(new Date(ms).getUTCHours()) >= 0) continue;
    if (open != null) continue;                        // one plan, held
    const g = planOf(r, agreed, atr, p);
    if (!g) continue;
    signals.push({ i, ms, dir: agreed, entry: g.entry, stop: g.stop, tp: g.tp, rr: g.rr, state: 'live' });
    open = signals.length - 1;
  }
  /* settle unresolved at the end of the tape as 'open' (excluded from win stats) */
  let wins = 0, losses = 0, both = 0, openEnd = 0, netR = 0;
  for (const s of signals){
    if (s.state === 'target'){ wins++; netR += s.rr; }
    else if (s.state === 'stopped'){ losses++; netR -= 1; }
    else if (s.state === 'both'){ both++; netR -= 1; }   // both = not a win; conservative loss
    else openEnd++;
  }
  const settled = wins + losses + both;
  return { n: settled, wins, losses, both, openEnd, netR, winPct: settled ? 100 * wins / settled : 0, avgR: settled ? netR / settled : 0 };
}

/* ---------- 6. the study ---------- */
const BASE = { prints: 'both', bodyMin: 0.15, slopeOn: true, sessStart: null, sessEnd: null, vwLook: 6, slopeLen: 4,
               stopAtrMin: 1.5, stopAtrMax: 3.5, rewardR: 1.5, rtFrac: 0.0002, rtMult: 4, dir: 0,
               rsiWith: false, vrTrend: false, entOrdered: false, volAbove: false, hourDrop: null };

const tape = await fetchTape();
const sona = loadSona();
const rows = tape.filter(r => r && [r.o, r.h, r.l, r.c].every(x => typeof x === 'number' && isFinite(x)) && r.h >= r.l && r.h >= r.o && r.h >= r.c && r.l <= r.o && r.l <= r.c && r.c > 0 && r.o > 0);
const series = sona.hgSonaSeries(rows);
const feat = features(rows, series);
const mid = Math.floor(rows.length / 2);

function runTwoHalves(p){
  const all = runVariation(rows, feat, p);
  const h1 = runVariation(rows.slice(0, mid), { ...feat, series: sliceSeries(series, 0, mid) }, p);
  const h2 = runVariation(rows.slice(mid), { ...feat, series: sliceSeries(series, mid) }, p);
  return { all, h1, h2 };
}
function sliceSeries(s, a, b){
  const cut = k => s[k].slice(a, b === undefined ? undefined : b);
  return { emaFast: cut('emaFast'), emaSlow: cut('emaSlow'), atr: cut('atr'), vwap: cut('vwap') };
}
/* features are precomputed over the full tape; for halves we re-slice the feature arrays too */
function sliceFeat(f, a, b){
  const end = b === undefined ? f.rsi.length : b;
  return { rsi: f.rsi.slice(a, end), vridx: f.vridx.slice(a, end), ent: f.ent.slice(a, end), volr: f.volr.slice(a, end),
           series: sliceSeries(f.series, a, end) };
}

const VARIANTS = [];
const add = (name, over) => VARIANTS.push({ name, p: { ...BASE, ...over } });
add('BASELINE (prints both, body .15, slope, 1.5-3.5 ATR, 1.5R)', {});
add('prints: EMA only', { prints: 'ema' });
add('prints: VWAP only', { prints: 'vwap' });
add('body: none (0)', { bodyMin: 0 });
add('body: 0.30 ATR', { bodyMin: 0.3 });
add('slope leg: OFF', { slopeOn: false });
add('session 07-17', { sessStart: 7, sessEnd: 17 });
add('session 07-13', { sessStart: 7, sessEnd: 13 });
add('session 12-17', { sessStart: 12, sessEnd: 17 });
add('session 13-17 (overlap only)', { sessStart: 13, sessEnd: 17 });
add('RSI with', { rsiWith: true });
add('VR20 trending (>1.05)', { vrTrend: true });
add('ENTROPY20 ordered (<=0.85)', { entOrdered: true });
add('volume above MA20', { volAbove: true });
add('drop hours 14-16', { hourDrop: [14, 15, 16] });
add('LONG only', { dir: 1 });
add('SHORT only', { dir: -1 });
add('stop band 1.0-2.5', { stopAtrMin: 1.0, stopAtrMax: 2.5 });
add('stop band 2.0-4.5', { stopAtrMin: 2.0, stopAtrMax: 4.5 });
add('reward 1.0R', { rewardR: 1.0 });
add('reward 2.0R', { rewardR: 2.0 });
add('reward 2.5R', { rewardR: 2.5 });
add('reward 3.0R', { rewardR: 3.0 });

const fmt = r => `n=${String(r.n).padStart(4)} win=${r.winPct.toFixed(1).padStart(5)}% net=${r.netR >= 0 ? '+' : ''}${r.netR.toFixed(1).padStart(7)}R avg=${r.avgR.toFixed(3).padStart(7)}`;
console.log('\n== 1-FACTOR STUDY (all bars / H1 / H2) ==');
for (const v of VARIANTS){
  const r = runVariation(rows, feat, v.p);
  const h1 = runVariation(rows.slice(0, mid), sliceFeat(feat, 0, mid), v.p);
  const h2 = runVariation(rows.slice(mid), sliceFeat(feat, mid), v.p);
  console.log(v.name.padEnd(52), '|', fmt(r), '| H1', (h1.winPct || 0).toFixed(1) + '%', 'net', (h1.netR >= 0 ? '+' : '') + h1.netR.toFixed(1), '| H2', (h2.winPct || 0).toFixed(1) + '%', 'net', (h2.netR >= 0 ? '+' : '') + h2.netR.toFixed(1));
}

/* ---------- 7. COMBINATION PHASE: greedy on the both-halves winners ---------- */
const COMBOS = [];
const combo = (name, over) => COMBOS.push({ name, p: { ...BASE, ...over } });
combo('C1 session 07-13 + stop 1.0-2.5', { sessStart: 7, sessEnd: 13, stopAtrMin: 1.0, stopAtrMax: 2.5 });
combo('C2 session 07-13 + reward 2.0R', { sessStart: 7, sessEnd: 13, rewardR: 2.0 });
combo('C3 session 07-13 + stop 1.0-2.5 + reward 2.0R', { sessStart: 7, sessEnd: 13, stopAtrMin: 1.0, stopAtrMax: 2.5, rewardR: 2.0 });
combo('C4 stop 1.0-2.5 + reward 2.0R', { stopAtrMin: 1.0, stopAtrMax: 2.5, rewardR: 2.0 });
combo('C5 stop 1.0-2.5 + reward 2.5R', { stopAtrMin: 1.0, stopAtrMax: 2.5, rewardR: 2.5 });
combo('C6 session 07-17 + stop 1.0-2.5', { sessStart: 7, sessEnd: 17, stopAtrMin: 1.0, stopAtrMax: 2.5 });
combo('C7 session 07-13 + volume>MA20', { sessStart: 7, sessEnd: 13, volAbove: true });
combo('C8 stop 1.0-2.5 + volume>MA20', { stopAtrMin: 1.0, stopAtrMax: 2.5, volAbove: true });
combo('C9 session 07-13 + stop 1.0-2.5 + volume', { sessStart: 7, sessEnd: 13, stopAtrMin: 1.0, stopAtrMax: 2.5, volAbove: true });
combo('C10 session 07-17 + stop 1.0-2.5 + reward 2.0R', { sessStart: 7, sessEnd: 17, stopAtrMin: 1.0, stopAtrMax: 2.5, rewardR: 2.0 });

console.log('\n== COMBINATION PHASE (12m tape) ==');
for (const v of COMBOS){
  const r = runVariation(rows, feat, v.p);
  const h1 = runVariation(rows.slice(0, mid), sliceFeat(feat, 0, mid), v.p);
  const h2 = runVariation(rows.slice(mid), sliceFeat(feat, mid), v.p);
  console.log(v.name.padEnd(46), '|', fmt(r), '| H1', (h1.winPct || 0).toFixed(1) + '% net ' + (h1.netR >= 0 ? '+' : '') + h1.netR.toFixed(1), '| H2', (h2.winPct || 0).toFixed(1) + '% net ' + (h2.netR >= 0 ? '+' : '') + h2.netR.toFixed(1));
}

/* ---------- 8. OUT-OF-SAMPLE: the previous 12 months, never studied ---------- */
if (args.oos !== false){
  console.log('\n== OUT-OF-SAMPLE TAPE (months 13-24, never studied) ==');
  const OOS_CACHE = path.join(ROOT, 'scripts', '.sona-tape-paxg-15m-oos.json');
  let oosRows;
  if (fs.existsSync(OOS_CACHE)) oosRows = JSON.parse(fs.readFileSync(OOS_CACHE, 'utf8')).rows;
  else {
    const out = []; let endTime = Date.now() - 365 * 86400000;
    while (out.length < 36000){
      const r0 = await fetch('https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=1000&endTime=' + endTime);
      if (!r0.ok) throw new Error('binance http ' + r0.status);
      const j = await r0.json();
      if (!Array.isArray(j) || !j.length) break;
      out.unshift(...j.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] })));
      endTime = j[0][0] - 1;
      if (j.length < 1000) break;
    }
    oosRows = out.sort((a, b) => a.t - b.t);
    fs.writeFileSync(OOS_CACHE, JSON.stringify({ fetchedAt: new Date().toISOString(), first: new Date(oosRows[0].t).toISOString(), last: new Date(oosRows[oosRows.length - 1].t).toISOString(), rows: oosRows }));
    console.log('oos tape: fetched', oosRows.length, 'bars');
  }
  const orows = oosRows.filter(r => r && [r.o, r.h, r.l, r.c].every(x => typeof x === 'number' && isFinite(x)) && r.h >= r.l && r.h >= r.o && r.h >= r.c && r.l <= r.o && r.l <= r.c && r.c > 0 && r.o > 0);
  const oseries = sona.hgSonaSeries(orows);
  const ofeat = features(orows, oseries);
  const FINALISTS = [{ name: 'BASELINE', p: BASE }, ...COMBOS, { name: 'session 07-13 alone', p: { ...BASE, sessStart: 7, sessEnd: 13 } }, { name: 'stop 1.0-2.5 alone', p: { ...BASE, stopAtrMin: 1.0, stopAtrMax: 2.5 } }];
  for (const v of FINALISTS){
    const r = runVariation(orows, ofeat, v.p);
    console.log(('OOS ' + v.name).padEnd(46), '|', fmt(r));
  }
}
