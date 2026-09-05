#!/usr/bin/env node
/* HARDGATE — nightly formation rebake.
   Walks the last N closed 1h bars (default 960 ≈ 40 crypto/gold days) through
   the live detectors, then writes scripts/formation-nightly.json.
   Demote / prefer / cost / OG1 floors / 19-desk tighten only. Never loosens G1–G7.

   Run: node scripts/nightly-formation-rebake.mjs [--bars=960] [--offline] */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNightlyApply, statsFromBacktestAll, DEFAULT_NIGHTLY_BARS } from '../lib/formation-nightly.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const OUT_SCRIPTS = path.join(ROOT, 'scripts', 'formation-nightly.json');
const OUT_DATA = path.join(ROOT, 'data', 'formation-nightly.json');
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];
const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find(x => x.startsWith(n + '=')); return a ? a.split('=')[1] : d; };
const OFFLINE = argv.includes('--offline');
const BARS = +opt('--bars', DEFAULT_NIGHTLY_BARS);
const CRYPTO = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

function bootOmni(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
    parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error,
    setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){} }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js',
                   'hg-mechanics.js', 'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  if (typeof ctx.hgOmniBacktestAll !== 'function')
    throw new Error('sandbox missing hgOmniBacktestAll');
  return ctx;
}

function bootOg1(){
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
  if (typeof ctx.hgOg1Replay !== 'function') throw new Error('sandbox missing hgOg1Replay');
  return ctx;
}

async function jget(p){
  let lastErr = null;
  for (const h of HOSTS){
    try{
      const r = await fetch(h + p, { headers: { 'User-Agent': 'hardgate-nightly/1.0' } });
      if (r.ok) return r.json();
      lastErr = new Error('HTTP ' + r.status + ' ' + h);
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('klines fetch failed');
}

async function fetch1h(sym, need){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, sym + '-1h-nightly.json');
  if (fs.existsSync(file)){
    try{
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const rows = j.rows || j;
      const fresh = j.fetchedAt && (Date.now() - j.fetchedAt) < 2 * 3600 * 1000;
      if (fresh && Array.isArray(rows) && rows.length >= need)
        return rows.slice(-need);
    }catch(e){ /* refetch */ }
  }
  if (OFFLINE){
    if (fs.existsSync(file)){
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      return (j.rows || j).slice(-need);
    }
    throw new Error('offline: no cache for ' + sym);
  }
  const batch = await jget('/api/v3/klines?symbol=' + sym + '&interval=1h&limit=' + Math.min(1000, need + 2));
  const rows = (batch || []).map(k => ({
    t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5]
  })).sort((a, b) => a.t - b.t);
  const ivMs = 3600 * 1000;
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol: sym, interval: '1h', rows }));
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

function mergeBags(list){
  const out = {};
  for (const bags of list){
    for (const [k, v] of Object.entries(bags || {})){
      if (!out[k]) out[k] = { n: 0, sumG: 0, sumN: 0 };
      out[k].n += v.n;
      out[k].sumG += (v.avgGross || 0) * v.n;
      out[k].sumN += (v.avgNet || 0) * v.n;
    }
  }
  const bags = {};
  for (const [k, v] of Object.entries(out)){
    if (!v.n) continue;
    bags[k] = { n: v.n, avgGross: +(v.sumG / v.n).toFixed(4), avgNet: +(v.sumN / v.n).toFixed(4) };
  }
  return bags;
}

function writeApply(j){
  const text = JSON.stringify(j, null, 2);
  fs.writeFileSync(OUT_SCRIPTS, text);
  try{
    fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
    fs.writeFileSync(OUT_DATA, text);
  }catch(e){ /* data/ may be read-only */ }
  const bootPath = path.join(ROOT, 'formation-nightly-boot.js');
  const boot = '/* HARDGATE — committed nightly book. Auto-written by nightly-formation-rebake.mjs. Do not hand-edit. */\n'
    + '(function(){\n\'use strict\';\n'
    + 'var W=(typeof window!==\'undefined\')?window:globalThis;\n'
    + 'W.HG_FORMATION_NIGHTLY_BOOT=' + JSON.stringify(j) + ';\n'
    + 'if(typeof W.hgFormationNightlyApply===\'function\')W.hgFormationNightlyApply(W.HG_FORMATION_NIGHTLY_BOOT);\n'
    + '})();\n';
  fs.writeFileSync(bootPath, boot);
  console.log('wrote', OUT_SCRIPTS, '+ formation-nightly-boot.js');
  return j;
}

export async function rebakeNightly(opts){
  const bars = (opts && opts.bars) || BARS;
  const asOf = new Date().toISOString();
  const dayUtc = asOf.slice(0, 10);
  let orBags = {};
  let og1Variants = {};
  const notes = [];
  try{
    const omni = bootOmni();
    const per = [];
    for (const sym of CRYPTO){
      try{
        const rows = await fetch1h(sym, Math.max(bars, 80));
        const all = omni.hgOmniBacktestAll(rows, { warm: 45, horizon: 12, rMult: 2 });
        per.push(statsFromBacktestAll(all));
        console.log('  omni', sym, Object.keys(all).filter(k => all[k] && all[k].samples).length, 'kinds');
      }catch(e){ notes.push(sym + ': ' + ((e && e.message) || e)); }
    }
    orBags = mergeBags(per);
  }catch(e){ notes.push('omni: ' + ((e && e.message) || e)); }

  try{
    const og = bootOg1();
    const h1 = await fetch1h('PAXGUSDT', Math.max(bars, 200));
    const h4 = derive4h(h1);
    const combos = [
      { name: 'raw', opts: { tfLabel: '1H' } },
      { name: 'minRisk5', opts: { tfLabel: '1H', minRisk: 5 } },
      { name: 'minDisp0.5', opts: { tfLabel: '1H', minDisp: 0.5 } },
      { name: 'minRisk5+disp0.5', opts: { tfLabel: '1H', minRisk: 5, minDisp: 0.5 } }
    ];
    for (const c of combos){
      const rp = og.hgOg1Replay(h1, h4, c.opts);
      og1Variants[c.name] = {
        resolved: rp.resolved, expR: isFinite(rp.expR) ? rp.expR : null,
        tp1: rp.tp1, stopped: rp.stopped, signals: rp.signals
      };
      console.log('  og1', c.name, 'n=' + rp.resolved, 'expR=' + (isFinite(rp.expR) ? rp.expR.toFixed(3) : 'n/a'));
    }
  }catch(e){ notes.push('og1: ' + ((e && e.message) || e)); }

  const apply = buildNightlyApply({
    asOf, dayUtc, omnirouteBags: orBags, og1Variants
  });
  if (notes.length) apply.fetchNotes = notes;
  apply.bars = bars;
  return writeApply(apply);
}

if (import.meta.url === ('file://' + process.argv[1]) || process.argv[1] && process.argv[1].endsWith('nightly-formation-rebake.mjs')){
  rebakeNightly({ bars: BARS }).catch(e => { console.error(e); process.exit(1); });
}
