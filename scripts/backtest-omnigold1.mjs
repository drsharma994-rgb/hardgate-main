/* HARDGATE — OMNIGOLD 1 sweep→reclaim replay harness (offline, node ESM).
   Run: node scripts/backtest-omnigold1.mjs [--bars=N] [--offline]

   Walks hgOg1Replay (the exact function the tab attaches) over PAXG 1h bars
   with zero lookahead. Sweeps filter combinations the live cards can apply:
     raw · gated · gated+bias · gated+bias+ob · gated+bias+node · minDisp
   Reports expectancy in R — never a win rate. Does not invent tickets. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const OUT = path.join(ROOT, 'scripts', 'backtest-omnigold1-results.json');
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find(x => x.startsWith(n + '=')); return a ? a.split('=')[1] : d; };
const OFFLINE = argv.includes('--offline');
const BARS = +opt('--bars', 2000);

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
    parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error,
    setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['gold-seven-step.js', 'omnigold1.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  if (typeof ctx.hgOg1Replay !== 'function' || !ctx.HG_GOLD7)
    throw new Error('sandbox missing hgOg1Replay / HG_GOLD7');
  return ctx;
}

/* data-api.binance.vision answers from US runners where api.binance.com
   returns HTTP 451. Same host list as scripts/stack-oos-check.mjs. */
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

async function jget(path){
  let lastErr = null;
  for (const h of HOSTS){
    try{
      const r = await fetch(h + path, { headers: { 'User-Agent': 'hardgate-og1-bt/1.0' } });
      if (r.ok) return r.json();
      lastErr = new Error('HTTP ' + r.status + ' ' + h + path);
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('klines fetch failed');
}

async function fetchPaxg1h(need){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, 'PAXGUSDT-1h.json');
  if (fs.existsSync(file)){
    try{
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const rows = j.rows || j;
      if (Array.isArray(rows) && rows.length >= Math.min(need, 400)){
        console.log('  cache hit 1h:', rows.length);
        return rows.slice(-need);
      }
    }catch(e){ /* refetch */ }
  }
  if (OFFLINE) throw new Error('offline: no PAXG 1h cache');
  let out = [], endTime;
  while (out.length < need + 2){
    const lim = Math.min(1000, need + 2 - out.length);
    let pathQ = '/api/v3/klines?symbol=PAXGUSDT&interval=1h&limit=' + lim;
    if (endTime) pathQ += '&endTime=' + endTime;
    const batch = await jget(pathQ);
    if (!Array.isArray(batch) || !batch.length) break;
    out = batch.concat(out);
    endTime = batch[0][0] - 1;
    if (batch.length < lim) break;
    await new Promise(r => setTimeout(r, 200));
  }
  const seen = new Set();
  const rows = out.filter(k => { if (seen.has(k[0])) return false; seen.add(k[0]); return true; })
    .map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))
    .sort((a, b) => a.t - b.t);
  const ivMs = 3600 * 1000;
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol: 'PAXGUSDT', interval: '1h', rows }));
  console.log('  fetched 1h:', rows.length);
  return rows.slice(-need);
}

function derive4h(rows1h){
  const out = [];
  let cur = null;
  for (const r of rows1h){
    const bucket = Math.floor((r.t - 22 * 3600) / 14400) * 14400 + 22 * 3600;
    if (!cur || cur.t !== bucket){
      if (cur) out.push(cur);
      cur = { t: bucket, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v };
    } else {
      cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; cur.v += r.v;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function bag(rp, opts){
  if (!rp) return null;
  return {
    gated: !!rp.gated, signals: rp.signals, filled: rp.filled, resolved: rp.resolved,
    tp1: rp.tp1, stopped: rp.stopped, flat: rp.flat,
    expR: isFinite(rp.expR) ? +rp.expR.toFixed(4) : null,
    avgWinR: isFinite(rp.avgWinR) ? +rp.avgWinR.toFixed(4) : null,
    rejected: rp.rejected || null,
    minRisk: opts && isFinite(opts.minRisk) ? opts.minRisk : null,
    minDisp: opts && isFinite(opts.minDisp) ? opts.minDisp : null,
    byDir: rp.byDir || null
  };
}

async function main(){
  console.log('OMNIGOLD 1 replay sweep · bars=' + BARS);
  const W = boot();
  const h1 = await fetchPaxg1h(BARS);
  const h4 = derive4h(h1);
  console.log('  1h', h1.length, '4h', h4.length,
    new Date(h1[0].t * 1000).toISOString().slice(0, 10), '..',
    new Date(h1[h1.length - 1].t * 1000).toISOString().slice(0, 10));

  const combos = [
    { name: 'raw', opts: { tfLabel: '1H' } },
    { name: 'minRisk5', opts: { tfLabel: '1H', minRisk: 5 } },
    { name: 'minDisp0.5', opts: { tfLabel: '1H', minDisp: 0.5 } },
    { name: 'minRisk5+disp0.5', opts: { tfLabel: '1H', minRisk: 5, minDisp: 0.5 } },
    { name: 'gated', opts: { tfLabel: '1H', gated: true, ctxTf: 14400, minDisp: 0.5 } },
    { name: 'gated+bias', opts: { tfLabel: '1H', gated: true, ctxTf: 14400, minDisp: 0.5, biasSide: true } },
    { name: 'gated+bias+ob', opts: { tfLabel: '1H', gated: true, ctxTf: 14400, minDisp: 0.5, biasSide: true, needOb: true } },
    { name: 'gated+bias+node', opts: { tfLabel: '1H', gated: true, ctxTf: 14400, minDisp: 0.5, biasSide: true, needNode: true } },
    { name: 'disp0.75', opts: { tfLabel: '1H', gated: true, ctxTf: 14400, minDisp: 0.75, biasSide: true } },
    { name: 'disp1.00', opts: { tfLabel: '1H', gated: true, ctxTf: 14400, minDisp: 1.0, biasSide: true } }
  ];
  const variants = {};
  for (const c of combos){
    const rp = W.hgOg1Replay(h1, h4, c.opts);
    variants[c.name] = bag(rp, c.opts);
    console.log('  ' + c.name + '  n=' + rp.resolved + '  expR='
      + (isFinite(rp.expR) ? (rp.expR >= 0 ? '+' : '') + rp.expR.toFixed(3) : 'n/a')
      + '  tp1=' + rp.tp1 + '  stopped=' + rp.stopped + '  sig=' + rp.signals);
  }

  const ranked = Object.entries(variants)
    .filter(([, v]) => v && v.resolved >= 8 && isFinite(v.expR))
    .sort((a, b) => b[1].expR - a[1].expR);

  const report = {
    generated: new Date().toISOString(),
    symbol: 'PAXGUSDT',
    bars: { h1: h1.length, h4: h4.length,
      from: new Date(h1[0].t * 1000).toISOString(),
      to: new Date(h1[h1.length - 1].t * 1000).toISOString() },
    note: 'in-sample sweep→reclaim pricing sanity — not a forecast. Same hgOg1Replay the tab attaches.',
    variants,
    bestNamed: ranked[0] ? ranked[0][0] : null,
    apply: {
      liveQualifies: 'SL$ ≥ $5 + G5 displacement ≥ 0.5 ATR (minRisk5+disp0.5 least-bad vs raw). gated+bias is worse — attached as measured lines, not a QUALIFIES gate.',
      neverLoosen: ['G1-G12', 'displacement ≥ 0.5 × ATR', 'RR 1.5 floor', 'SL$ ≥ $5']
    }
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('wrote', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
