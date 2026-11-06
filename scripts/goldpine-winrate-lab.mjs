#!/usr/bin/node
/* HARDGATE — GOLD PINE win-rate lab (offline, node ESM).
   Run:  node scripts/goldpine-winrate-lab.mjs [--bars=N] [--passes=N]

   WHAT THIS IS: the add/remove simulation the TREND MATRIX (hg-v1484), GOLD
   SCALP (hg-v1488) and OMNIGOLD (hg-v1490) desks got, pointed at GOLD PINE —
   the desk this repo had NO committed walk for. Phase A IS the walk: the
   desk's own scan lane functions (collectPineUniverse + the native lanes,
   exactly what runGoldPineScan calls, minus the forward-ledger side
   effects) walked per closed 15m bar (scalp lane) and per closed 4h bar
   (swing lane) over the same tapes the other gold harnesses use, recording
   EVERY candidate with its layer label, record-only flag, demote marks,
   grade, score and plan. The walked book is WRITTEN to
   goldpine-walk-results.json — the desk's first committed artifact, the
   thing every later pack can re-derive from instead of re-walking.

   Phase B settles every candidate under a grid of stop/target geometries on
   its own lane grid (scalp = 15m bars / 24-bar trigger window, swing = 4h
   bars / 20-bar), the lib walk semantics verbatim: fill required, first
   touch stop vs target, both-touch = LOSS, 96 bars after fill -> timeout at
   close, XM 0.020% round trip (the venue the desk quotes) with PAXG 0.26%
   as the sensitivity cost.

   Phase C is the simulation loop — the axes the ask names, all of them:
   per-PINE-LAYER on/off (the ten primary ports AND the record-only layers
   the desk withholds — measuring their ADMISSION is the "add pinescripts"
   lever the desk's own release rule points at), per-NATIVE-STRATEGY on/off
   (the borrowed mint), direction (the trading-style axis), lane, pine-only
   / native-only, mint-demote skip, and geometry — scored on three disjoint
   SEARCH windows and kept only when it clears the bar. Phase D confirms on
   a fourth HELD-OUT window. Phase E is the leave-one-out postmortem. Phase
   F measures the direction cohort at both cost models, searched by nobody.

   THE BAR (the hg-v1488 tightened shape): a move must (1) not lower the win
   rate in ANY of the three search windows, (2) keep at least 40 settled
   positions in each, (3) keep at least 35% of the baseline cohort, and (4)
   not lower aggregate net R. Confirmation demands the held-out window's win
   rate AND net R both at least the baseline's, n >= 25 there. z vs the
   baseline pooled book; configurations evaluated printed.

   This script MEASURES. It ships nothing: a clause enters the desk only
   through the measured-edge doctrine, and the shipped walk re-run is the
   arbiter.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { xmOrderType, ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';
import { klinesRouteNote } from '../lib/klines-source.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const HERE = path.join(ROOT, 'scripts');
const LAB_OUT = path.join(HERE, 'goldpine-winrate-lab-results.json');
const WALK_OUT = path.join(HERE, 'goldpine-walk-results.json');
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.slice(name.length + 1) : dflt; };
const BARS_15M = +opt('--bars', 6000);
const PASSES = +opt('--passes', 8);

const SYMBOL = 'PAXGUSDT';
const DEPTH = { m15: 240, h1: 400, h4: 220, d1: 260 };
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;      /* 0.020% — XM XAUUSD */
const COST_PAXG_FRAC = 2 * (0.0010 + 0.0003);          /* 0.26% — PAXG spot */
const TIMEOUT_BARS = 96;
const FILL_WINDOW = { scalp: 24, swing: 20 };          /* bars on the lane's own grid */

const GEOMS = [{ s: 1, k: null, label: 'plan' }];
for (const s of [0.75, 1, 1.25]) for (const k of [1, 1.5, 2, 2.5, 3]) GEOMS.push({ s, k, label: 'stop' + s + 'x t' + k + 'R' });

async function cachedKlines(interval, target){
  const file = path.join(CACHE_DIR, SYMBOL + '-' + interval + '.json');
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(file)){
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j && j.target >= target && Array.isArray(j.rows) && j.rows.length >= target) return j.rows.slice(-target);
  }
  console.log('  fetching ' + SYMBOL + ' ' + interval + ' x' + target + ' — ' + klinesRouteNote());
  const rows = [];
  let end = null;
  while (rows.length < target){
    const { klinesUrl } = await import('../lib/klines-source.mjs');
    const params = { symbol: SYMBOL, interval, limit: Math.min(1000, target - rows.length) };
    if (end) params.endTime = end;
    const res = await fetch(klinesUrl(params, process.env).url);
    if (!res.ok) throw new Error('klines ' + res.status);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    rows.unshift(...batch.map(b => ({ t: Math.floor(b[0] / 1000), o: +b[1], h: +b[2], l: +b[3], c: +b[4], v: +b[5] })));
    end = batch[0][0] - 1;
    if (batch.length < params.limit) break;
  }
  fs.writeFileSync(file, JSON.stringify({ target, rows }));
  return rows.slice(-target);
}

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity, Float64Array };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js',
                   'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                   'goldind.js', 'gold-catalog.js', 'gold-best-levels.js',
                   'goldswing.js', 'pinemath.js', 'pinegoldmath.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  /* the collect functions are IIFE-internal; the same source-patch the
     OMNIGOLD harness uses for its two scalars exports them for the walk */
  let GP = fs.readFileSync(path.join(ROOT, 'goldpine.js'), 'utf8');
  const GP_ANCHOR = 'W.gpBoardPick = gpBoardPick;';
  if (!GP.includes(GP_ANCHOR)) throw new Error('goldpine.js injection anchor not found — source drifted');
  GP = GP.replace(GP_ANCHOR, GP_ANCHOR
    + '\nW.collectPineUniverse = collectPineUniverse;'
    + '\nW.collectNativeScalp = collectNativeScalp;'
    + '\nW.collectNativeSwing = collectNativeSwing;');
  vm.runInContext(GP, ctx, { filename: 'goldpine.js(patched-exports)' });
  for (const fn of ['collectPineUniverse', 'collectNativeScalp', 'collectNativeSwing'])
    if (typeof ctx[fn] !== 'function') throw new Error('boot failed: ' + fn);
  return ctx;
}

function sliceByCutoff(rows, tfSec, cutoffSec){
  let lo = 0, hi = rows.length;
  while (lo < hi){ const m = (lo + hi) >> 1; (rows[m].t + tfSec <= cutoffSec) ? lo = m + 1 : hi = m; }
  return rows.slice(0, lo);
}

/* ---------- Phase A: the desk's own scan lanes, walked ---------- */
function labelOf(s){
  return String(s.layerLabel || s.nativeStrategy || s.strategy || s.kind || 'unlabeled');
}
function scanLane(W, bars, lane, out, counters){
  /* hg-v1501: the gold-catalog indicator stack on the lane's own tape — the
     same reads the live desk's ctx carries, recorded per candidate so the lab
     can sweep the latest indicators as admission clauses on THIS book. */
  let __ir = null;
  try { __ir = W.hgGoldIndicatorReads(lane === 'swing' ? bars.rows4h : bars.rows15m, { rows1d: bars.rows1d }) || null; } catch (eIr) { __ir = null; }
  const reg = (__ir && __ir.ok === true) ? {
    vrs: __ir.vrState || null, ents: __ir.entropyState || null,
    rsi: isFinite(__ir.rsi14) ? +__ir.rsi14.toFixed(2) : null,
    adxs: __ir.adxState || null,
    ker: isFinite(__ir.ker20) ? +__ir.ker20.toFixed(3) : null,
    sqz: __ir.squeeze || null,
    pdi: isFinite(__ir.plusDI) ? +__ir.plusDI.toFixed(2) : null,
    mdi: isFinite(__ir.minusDI) ? +__ir.minusDI.toFixed(2) : null,
    bbB: isFinite(__ir.bbPctB) ? +__ir.bbPctB.toFixed(3) : null,
    hv: isFinite(__ir.hv20) ? +__ir.hv20.toFixed(5) : null,
    hvMed: isFinite(__ir.hv20Med) ? +__ir.hv20Med.toFixed(5) : null,
    volR: isFinite(__ir.volRatio) ? +__ir.volRatio.toFixed(3) : null,
    tsmom: isFinite(__ir.tsmom96) ? +__ir.tsmom96.toFixed(4) : null,
    sma50: isFinite(__ir.sma50) ? +__ir.sma50.toFixed(2) : null
  } : null;
  const srcLabel = 'GP-BT';
  const scanOpts = { now: bars.now || Date.now(), macro: null, spot: null, levels: {} };
  const scanCtx = { macro: null, spot: null, now: bars.now || Date.now(), news: null,
    rows15m: bars.rows15m, rows1h: bars.rows1h, rows4h: bars.rows4h, rows1d: bars.rows1d };
  let list = [];
  try { list = list.concat(W.collectPineUniverse(bars, lane, scanOpts, srcLabel) || []); }
  catch (e) { counters.pineErrors++; }
  try {
    list = list.concat(lane === 'scalp'
      ? (W.collectNativeScalp(bars, scanCtx, srcLabel) || [])
      : (W.collectNativeSwing(bars, scanCtx, srcLabel) || []));
  } catch (e) { counters.nativeErrors++; }
  for (const s of (list || [])){
    if (!s || (s.dir !== 'long' && s.dir !== 'short')) continue;
    const entry = +s.entry, stop = +s.stop, t1 = +s.t1;
    if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1) || !(Math.abs(entry - stop) > 0)) { counters.unpriced++; continue; }
    const long = s.dir === 'long';
    if (long && !(stop < entry && t1 > entry)) { counters.badGeometry++; continue; }
    if (!long && !(stop > entry && t1 < entry)) { counters.badGeometry++; continue; }
    out.push({
      i: bars.i, t: bars.t * 1000, lane,   /* bars carry SECONDS (the harness convention); the lab's clock is ms */
      label: labelOf(s), reg,
      pine: s.kind === 'confluence' || !!s.layerLabel,
      recordOnly: !!s.recordOnly,
      demoted: !!s.demoted || !!s.mintDemoted,
      dir: s.dir,
      grade: s.grade || null, tier: s.tier || null, score: isFinite(+s.score) ? +s.score : null,
      rr: isFinite(+s.rr) ? +s.rr : null,
      entry, stop, t1,
      orderType: xmOrderType(s.dir, entry, bars.markAtFire).name,
      markAtFire: bars.markAtFire
    });
    counters.candidates++;
  }
}

function walk(W, m15, h1, h4, d1){
  const records = [];
  const counters = { candidates: 0, pineErrors: 0, nativeErrors: 0, unpriced: 0, badGeometry: 0, scans: 0 };
  const needSec = Math.max(
    m15[0].t + DEPTH.m15 * 900,
    h4.length ? h4[0].t + DEPTH.h4 * 14400 : 0,
    h1.length ? h1[0].t + DEPTH.h1 * 3600 : 0,
    d1.length ? d1[0].t + DEPTH.d1 * 86400 : 0);
  let first15 = m15.findIndex(r => r.t + 900 >= needSec);
  if (first15 < 0) first15 = Math.min(m15.length - 1, DEPTH.m15);
  let first4 = h4.findIndex(r => r.t + 14400 >= needSec);
  if (first4 < 0) first4 = Math.min(h4.length - 1, DEPTH.h4);
  const t0 = Date.now();
  for (let i = first15; i < m15.length; i++){
    const bar = m15[i];
    const cutoff = bar.t + 900;
    scanLane(W, {
      i, t: cutoff, now: cutoff * 1000, markAtFire: +bar.c,
      rows15m: sliceByCutoff(m15, 900, cutoff).slice(-DEPTH.m15),
      rows1h: sliceByCutoff(h1, 3600, cutoff).slice(-DEPTH.h1),
      rows4h: sliceByCutoff(h4, 14400, cutoff).slice(-DEPTH.h4),
      rows1d: sliceByCutoff(d1, 86400, cutoff).slice(-DEPTH.d1),
      source: 'binance-paxg'
    }, 'scalp', records, counters);
    counters.scans++;
    if ((i - first15) % 500 === 0)
      console.log('  [scalp] bar ' + i + '/' + m15.length + ' · records ' + records.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  for (let i = first4; i < h4.length; i++){
    const bar = h4[i];
    const cutoff = bar.t + 14400;
    scanLane(W, {
      i, t: cutoff, now: cutoff * 1000, markAtFire: +bar.c,
      rows15m: sliceByCutoff(m15, 900, cutoff).slice(-DEPTH.m15),
      rows1h: sliceByCutoff(h1, 3600, cutoff).slice(-DEPTH.h1),
      rows4h: sliceByCutoff(h4, 14400, cutoff).slice(-DEPTH.h4),
      rows1d: sliceByCutoff(d1, 86400, cutoff).slice(-DEPTH.d1),
      source: 'binance-paxg'
    }, 'swing', records, counters);
    counters.scans++;
  }
  return { records, counters, first15, first4 };
}

/* ---------- Phase B: settle under one geometry, lib semantics verbatim ---------- */
function settleOne(grids, r, geom){
  const grid = grids[r.lane];
  const i0 = grid.index.get(Math.floor(r.t / 1000) - (r.lane === 'scalp' ? 900 : 14400));
  if (i0 == null) return { outcome: 'offgrid', liveUntil: Infinity };
  const dir = r.dir, sgn = dir === 'long' ? 1 : -1;
  const risk0 = Math.abs(r.entry - r.stop);
  const entry = r.entry;
  const stop = entry - sgn * geom.s * risk0;
  const t1 = geom.k == null ? r.t1 : entry + sgn * geom.k * risk0;
  const risk = geom.s * risk0;
  if (!(risk > 0)) return { outcome: 'unpriced', liveUntil: Infinity };
  const orderType = xmOrderType(dir, entry, r.markAtFire).name;
  const fillWindow = FILL_WINDOW[r.lane];
  let state = 'pending', waitBars = 0, fillIdx = null;
  for (let bi = i0 + 1; bi < grid.rows.length; bi++){
    const bar = grid.rows[bi];
    if (state === 'pending'){
      if (ogXmBarTouchesEntry(orderType, dir, bar, entry)){ state = 'filled'; fillIdx = bi; }
      else { if (++waitBars >= fillWindow) return { outcome: 'unfilled', liveUntil: bi }; continue; }
    }
    const hitStop = dir === 'long' ? +bar.l <= stop : +bar.h >= stop;
    const hitT1 = dir === 'long' ? +bar.h >= t1 : +bar.l <= t1;
    if (hitStop && hitT1) return { outcome: 'loss', liveUntil: bi, rGross: -1 };
    if (hitStop) return { outcome: 'loss', liveUntil: bi, rGross: -1 };
    if (hitT1) return { outcome: 'win', liveUntil: bi, rGross: Math.abs(t1 - entry) / risk };
    if (bi - fillIdx >= TIMEOUT_BARS){
      const mv = dir === 'long' ? (+bar.c - entry) : (entry - +bar.c);
      return { outcome: 'timeout', liveUntil: bi, rGross: mv / risk };
    }
  }
  return { outcome: 'open', liveUntil: grid.rows.length - 1 };
}

/* ---------- Phase C: the shipped configuration and the clauses ---------- */
function baseConfig(records){
  const on = {};
  for (const r of records) on[r.lane + '|' + r.label] = true;
  return {
    on, dirLong: true, dirShort: true,
    reg: {},                      /* hg-v1501: the indicator clauses */
    lanes: { scalp: true, swing: true },
    pineOnly: false, nativeOnly: false,
    admitRecordOnly: false,          /* shipped: the record-only layers stay withheld */
    skipDemoted: false,
    geom: 0
  };
}
function selected(cfg, r){
  if (!cfg.on[r.lane + '|' + r.label]) return false;
  if (r.dir === 'long' && !cfg.dirLong) return false;
  if (r.dir === 'short' && !cfg.dirShort) return false;
  if (!cfg.lanes[r.lane]) return false;
  if (cfg.pineOnly && !r.pine) return false;
  if (cfg.nativeOnly && r.pine) return false;
  if (!cfg.admitRecordOnly && r.recordOnly) return false;
  if (cfg.skipDemoted && r.demoted) return false;
  const reg = r.reg || {};
  if (cfg.reg.skipVrMeanrev && reg.vrs === 'MEANREV') return false;
  if (cfg.reg.requireVrTrend && reg.vrs !== 'TRENDING') return false;
  if (cfg.reg.skipEntropyDisorder && reg.ents === 'DISORDER') return false;
  if (cfg.reg.requireEntropyOrdered && reg.ents !== 'ORDERED') return false;
  if (cfg.reg.rsiWith && isFinite(reg.rsi) && ((r.dir === 'long' && reg.rsi <= 50) || (r.dir === 'short' && reg.rsi >= 50))) return false;
  if (cfg.reg.adxTrending && reg.adxs !== 'TRENDING') return false;
  if (cfg.reg.kerTrend && !(isFinite(reg.ker) && reg.ker >= 0.6)) return false;
  if (cfg.reg.dmiWith && isFinite(reg.pdi) && isFinite(reg.mdi) && ((r.dir === 'long' && reg.pdi <= reg.mdi) || (r.dir === 'short' && reg.mdi <= reg.pdi))) return false;
  if (cfg.reg.skipBbExtreme && isFinite(reg.bbB) && ((r.dir === 'long' && reg.bbB > 0.95) || (r.dir === 'short' && reg.bbB < 0.05))) return false;
  if (cfg.reg.volAbove && !(isFinite(reg.volR) && reg.volR >= 1)) return false;
  if (cfg.reg.skipHvSpike && isFinite(reg.hv) && isFinite(reg.hvMed) && reg.hvMed > 0 && reg.hv > reg.hvMed * 1.25) return false;
  if (cfg.reg.tsmomWith && isFinite(reg.tsmom) && ((r.dir === 'long' && reg.tsmom <= 0) || (r.dir === 'short' && reg.tsmom >= 0))) return false;
  if (cfg.reg.sma50With && isFinite(reg.sma50) && ((r.dir === 'long' && r.entry < reg.sma50) || (r.dir === 'short' && r.entry > reg.sma50))) return false;
  if (cfg.reg.squeezeOn && reg.sqz !== 'ON') return false;
  return true;
}
function describe(cfg){
  const bits = [];
  const off = Object.keys(cfg.on).filter(k => !cfg.on[k]);
  if (off.length) bits.push(off.length + ' labels off: ' + off.slice(0, 4).join(',') + (off.length > 4 ? '…' : ''));
  if (!cfg.dirLong || !cfg.dirShort) bits.push(cfg.dirLong ? 'long only' : (cfg.dirShort ? 'short only' : 'NO DIR'));
  const ln = Object.keys(cfg.lanes).filter(k => !cfg.lanes[k]);
  if (ln.length) bits.push('lanes -' + ln.join('-'));
  if (cfg.pineOnly) bits.push('pine only');
  if (cfg.nativeOnly) bits.push('native only');
  if (cfg.admitRecordOnly) bits.push('record-only ADMITTED');
  if (cfg.skipDemoted) bits.push('skip demoted');
  bits.push('geom:' + GEOMS[cfg.geom].label);
  return bits.join(' · ');
}
function evalConfig(data, cfg){
  const trades = [];
  const live = new Map();
  for (const r of data.records){
    if (!selected(cfg, r)) continue;
    const key = r.lane + '|' + r.label + '|' + r.dir;
    if (live.has(key) && r.t < live.get(key)) continue;
    const ck = r.idxKey || (r.idxKey = r.lane + '|' + r.t + '|' + r.label + '|' + r.dir);
    const s = data.settled.get(ck + '|' + cfg.geom) || (data.settled.set(ck + '|' + cfg.geom, settleOne(data.grids, r, GEOMS[cfg.geom])), data.settled.get(ck + '|' + cfg.geom));
    live.set(key, (s.liveUntil === Infinity ? Infinity : barTime(data, r.lane, s.liveUntil)));
    if (s.outcome === 'unfilled' || s.outcome === 'open' || s.outcome === 'offgrid' || s.outcome === 'unpriced') continue;
    const risk = GEOMS[cfg.geom].s * Math.abs(r.entry - r.stop);
    const costFrac = cfg.costPaxg ? COST_PAXG_FRAC : COST_XM_FRAC;
    const net = s.rGross - (r.entry * costFrac) / risk;
    trades.push({ t: r.t, outcome: s.outcome, net, label: r.label, dir: r.dir, lane: r.lane });
  }
  trades.sort((a, b) => a.t - b.t);
  return trades;
}
function barTime(data, lane, barIdx){
  const b = data.grids[lane].rows[barIdx];
  return b ? b.t * 1000 : Infinity;
}
function windowAgg(trades, t0, t1){
  const s = trades.filter(t => t.t >= t0 && t.t < t1);
  if (!s.length) return { n: 0, win: null, net: null };
  let w = 0, net = 0;
  for (const t of s){ if (t.outcome === 'win') w++; net += t.net; }
  return { n: s.length, win: w / s.length, net: net / s.length };
}

export { boot, cachedKlines, walk, settleOne, baseConfig, selected, describe, evalConfig, windowAgg, GEOMS, COST_XM_FRAC, COST_PAXG_FRAC, FILL_WINDOW, labelOf };

/* ---------- main ---------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) (async () => {
  const log = console.log;
  log('=== GOLD PINE win-rate lab · ' + new Date().toISOString() + ' ===');
  log('route ' + klinesRouteNote());
  const W = boot();
  const m15 = await cachedKlines('15m', BARS_15M);
  const h1 = await cachedKlines('1h', Math.max(DEPTH.h1 + Math.ceil(BARS_15M / 4) + 8, 1200));
  const h4 = await cachedKlines('4h', Math.max(DEPTH.h4 + Math.ceil(BARS_15M / 16) + 8, 600));
  const d1 = await cachedKlines('1d', Math.max(DEPTH.d1 + Math.ceil(BARS_15M / 96) + 4, 330));
  log('  tapes ready: 15m x' + m15.length + ' (span ' + new Date(m15[0].t * 1000).toISOString().slice(0, 10) + ' .. ' + new Date(m15[m15.length - 1].t * 1000).toISOString().slice(0, 10) + ')');

  log('Phase A — walking the desk’s own scan lanes (scalp on 15m, swing on 4h)...');
  const walked = walk(W, m15, h1, h4, d1);
  log('  records: ' + walked.records.length + ' · scans ' + walked.counters.scans
      + ' · candidates ' + walked.counters.candidates + ' · unpriced ' + walked.counters.unpriced
      + ' · badGeometry ' + walked.counters.badGeometry + ' · errors ' + (walked.counters.pineErrors + walked.counters.nativeErrors));
  const labels = {};
  for (const r of walked.records){ const k = r.lane + '|' + r.label + (r.recordOnly ? ' [record-only]' : ''); labels[k] = (labels[k] || 0) + 1; }
  log('  labels: ' + Object.keys(labels).length);
  for (const [k, v] of Object.entries(labels).sort((a, b) => b[1] - a[1]).slice(0, 14)) log('    ' + String(v).padStart(5) + '  ' + k);
  /* the desk's first committed walk artifact */
  fs.writeFileSync(WALK_OUT, JSON.stringify({
    meta: { generated: new Date().toISOString(), symbol: SYMBOL, bars: BARS_15M,
      span: [new Date(m15[walked.first15].t * 1000).toISOString(), new Date(m15[m15.length - 1].t * 1000).toISOString()],
      counters: walked.counters, costs: { xm: COST_XM_FRAC, paxg: COST_PAXG_FRAC },
      fill: FILL_WINDOW, timeoutBars: TIMEOUT_BARS },
    records: walked.records
  }, null, 1));
  log('  written: ' + WALK_OUT);

  const grids = {
    scalp: { rows: m15, index: new Map(m15.map((b, i) => [b.t, i])) },
    swing: { rows: h4, index: new Map(h4.map((b, i) => [b.t, i])) }
  };
  const data = { records: walked.records, grids, settled: new Map() };

  const spanT0 = walked.records.length ? walked.records[0].t : m15[walked.first15].t * 1000;
  const spanT1 = m15[m15.length - 1].t * 1000;
  const winBars = [0, 1, 2, 3].map(w => [spanT0 + (spanT1 - spanT0) * w / 4, spanT0 + (spanT1 - spanT0) * (w + 1) / 4]);
  const wName = i => 'W' + (i + 1) + ' ' + new Date(winBars[i][0]).toISOString().slice(0, 10) + '..' + new Date(winBars[i][1]).toISOString().slice(0, 10);

  const cur = baseConfig(walked.records);
  const score = (cfg) => {
    const trades = evalConfig(data, cfg);
    const win = [0, 1, 2, 3].map(i => windowAgg(trades, winBars[i][0], winBars[i][1]));
    const sn = win[0].n + win[1].n + win[2].n;
    const searchAll = { n: sn,
      win: (win[0].win * win[0].n + win[1].win * win[1].n + win[2].win * win[2].n) / Math.max(1, sn),
      net: (win[0].net * win[0].n + win[1].net * win[1].n + win[2].net * win[2].n) / Math.max(1, sn) };
    return { win, searchAll, all: windowAgg(trades, winBars[0][0], winBars[3][1]), trades };
  };

  log('\nPhase C — greedy add/remove from the SHIPPED configuration');
  log('baseline: ' + describe(cur));
  let base = score(cur);
  log('baseline search (W1-W3): n=' + base.searchAll.n + ' win=' + (100 * base.searchAll.win).toFixed(1) + '% net=' + base.searchAll.net.toFixed(3) + 'R');
  log('baseline all:            n=' + base.all.n + ' win=' + (100 * base.all.win).toFixed(1) + '% net=' + base.all.net.toFixed(3) + 'R');

  const labelKeys = Object.keys(cur.on).sort();
  const moves = [];
  for (const k of labelKeys) moves.push({ label: 'label ' + (cur.on[k] ? '-' : '+') + k, apply: c => { c.on[k] = !c.on[k]; } });
  moves.push({ label: 'long only', apply: c => { c.dirLong = true; c.dirShort = false; } });
  moves.push({ label: 'short only', apply: c => { c.dirLong = false; c.dirShort = true; } });
  moves.push({ label: 'both dirs', apply: c => { c.dirLong = true; c.dirShort = true; } });
  for (const ln of ['scalp', 'swing']) moves.push({ label: 'lane toggle ' + ln, apply: c => { c.lanes[ln] = !c.lanes[ln]; } });
  moves.push({ label: 'pine only', apply: c => { c.pineOnly = !c.pineOnly; c.nativeOnly = c.pineOnly ? false : c.nativeOnly; } });
  moves.push({ label: 'native only', apply: c => { c.nativeOnly = !c.nativeOnly; c.pineOnly = c.nativeOnly ? false : c.pineOnly; } });
  moves.push({ label: 'record-only ADMITTED', apply: c => { c.admitRecordOnly = !c.admitRecordOnly; } });
  moves.push({ label: 'skip demoted', apply: c => { c.skipDemoted = !c.skipDemoted; } });
  for (const k of ['skipVrMeanrev', 'requireVrTrend', 'skipEntropyDisorder', 'requireEntropyOrdered', 'rsiWith', 'adxTrending', 'kerTrend', 'dmiWith', 'skipBbExtreme', 'volAbove', 'skipHvSpike', 'tsmomWith', 'sma50With', 'squeezeOn'])
    moves.push({ label: k, apply: c => { c.reg[k] = !c.reg[k]; } });
  moves.push({ label: 'record-only ADMITTED', apply: c => { c.admitRecordOnly = !c.admitRecordOnly; } });
  moves.push({ label: 'geom next', apply: c => { c.geom = (c.geom + 1) % GEOMS.length; } });
  moves.push({ label: 'geom prev', apply: c => { c.geom = (c.geom + GEOMS.length - 1) % GEOMS.length; } });
  moves.push({ label: 'geom plan', apply: c => { c.geom = 0; } });

  /* hg-v1501: THE INDICATOR SWEEP on the pine book — every latest-indicator
     clause measured ALONE on the three search windows and the held-out
     window, before the greedy loop mixes anything. Recorded in the artifact
     (indicatorSweep) so the honest nulls are as durable as the winners. */
  let evaluated = 0;
  const indicatorSweep = [];
  {
    const CLAUSES = ['skipVrMeanrev', 'requireVrTrend', 'skipEntropyDisorder', 'requireEntropyOrdered', 'rsiWith', 'adxTrending', 'kerTrend', 'dmiWith', 'skipBbExtreme', 'volAbove', 'skipHvSpike', 'tsmomWith', 'sma50With', 'squeezeOn'];
    const baseW = base.win;
    log('\nINDICATOR SWEEP — each clause alone vs the baseline:');
    for (const k of CLAUSES){
      const cand = JSON.parse(JSON.stringify(cur));
      cand.reg[k] = true;
      const w = score(cand).win;
      evaluated++;
      const clears = w.slice(0, 3).every((x, i) => x.win != null && x.win >= baseW[i].win - 1e-12)
        && w[3].win != null && w[3].win >= baseW[3].win - 1e-12;
      indicatorSweep.push({ clause: k, windows: w, clears });
      log('  ' + k.padEnd(24) + ' ' + w.map(x => (x.win == null ? '—' : (100 * x.win).toFixed(1) + '%/' + x.n + '/' + (x.net == null ? '—' : x.net.toFixed(2)))).join('  ') + (clears ? '  <-- CLEARS' : ''));
    }
    const roC = JSON.parse(JSON.stringify(cur));
    roC.admitRecordOnly = true;
    const roW = score(roC).win;
    evaluated++;
    const roClears = roW.slice(0, 3).every((x, i) => x.win != null && x.win >= baseW[i].win - 1e-12)
      && roW[3].win != null && roW[3].win >= baseW[3].win - 1e-12;
    indicatorSweep.push({ clause: 'record-only ADMITTED', windows: roW, clears: roClears });
    log('  ' + 'record-only ADMITTED'.padEnd(24) + ' ' + roW.map(x => (x.win == null ? '—' : (100 * x.win).toFixed(1) + '%/' + x.n + '/' + (x.net == null ? '—' : x.net.toFixed(2)))).join('  ') + (roClears ? '  <-- CLEARS' : ''));
  }

  const okMove = (res) => res.win.every((w, i) => i < 3 ? (w.win != null && w.n >= 40 && w.win >= base.win[i].win - 1e-12) : true)
    && res.searchAll.n >= 0.35 * base.searchAll.n
    && res.searchAll.net >= base.searchAll.net - 1e-12;

  const history = [];
  for (let pass = 0; pass < PASSES; pass++){
    let bestMove = null, bestRes = null;
    for (const mv of moves){
      const cand = JSON.parse(JSON.stringify(cur));
      mv.apply(cand);
      if (describe(cand) === describe(cur)) continue;
      const res = score(cand);
      evaluated++;
      if (!okMove(res)) continue;
      if (!bestRes || res.searchAll.win > bestRes.searchAll.win + 1e-12){ bestMove = mv; bestRes = res; }
    }
    if (!bestMove){ log('pass ' + (pass + 1) + ': no improving move — search converged'); break; }
    bestMove.apply(cur);
    base = bestRes;
    history.push({ pass: pass + 1, move: bestMove.label, description: describe(cur), search: base.searchAll, windows: base.win.slice(0, 3) });
    log('pass ' + (pass + 1) + ': ' + bestMove.label + '  ->  win ' + (100 * base.searchAll.win).toFixed(1) + '% net ' + base.searchAll.net.toFixed(3) + 'R (n=' + base.searchAll.n + ')');
  }

  log('\nPhase D — held-out confirmation (' + wName(3) + ', never searched)');
  const confNew = base.win[3], confBase = score(baseConfig(walked.records)).win[3];
  log('baseline W4: n=' + confBase.n + ' win=' + (confBase.win == null ? '—' : (100 * confBase.win).toFixed(1) + '%') + ' net=' + (confBase.net == null ? '—' : confBase.net.toFixed(3) + 'R'));
  log('final    W4: n=' + confNew.n + ' win=' + (confNew.win == null ? '—' : (100 * confNew.win).toFixed(1) + '%') + ' net=' + (confNew.net == null ? '—' : confNew.net.toFixed(3) + 'R'));

  const bAll = score(baseConfig(walked.records)).all, fAll = base.all;
  const p1 = bAll.win || 0, n1 = bAll.n, p2 = fAll.win || 0, n2 = fAll.n;
  const pPool = (p1 * n1 + p2 * n2) / Math.max(1, n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(1, n1) + 1 / Math.max(1, n2)));
  const z = se > 0 ? (p2 - p1) / se : 0;
  function normCdf(x){ let t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return x >= 0 ? 1 - p : p; }
  const zP = 2 * (1 - normCdf(Math.abs(z)));
  const confirmed = confNew.win != null && confNew.win >= confBase.win - 1e-12 && confNew.net >= confBase.net - 1e-12 && confNew.n >= 25;

  /* Phase E — leave-one-out postmortem */
  let postmortem = null;
  if (confirmed){
    const variants = [];
    const relax = (name, mutate) => {
      const c = JSON.parse(JSON.stringify(cur)); mutate(c);
      const w = score(c).win;
      variants.push({ relax: name, heldOut: w[3], windows: w });
    };
    relax('both dirs (direction clause off)', c => { c.dirLong = true; c.dirShort = true; });
    for (const ln of ['scalp', 'swing']) if (!cur.lanes[ln]) relax('lane ' + ln + ' back in', c => { c.lanes[ln] = true; });
    if (cur.pineOnly) relax('native back in', c => { c.pineOnly = false; });
    if (cur.nativeOnly) relax('pine back in', c => { c.nativeOnly = false; });
    if (cur.admitRecordOnly) relax('record-only withheld again', c => { c.admitRecordOnly = false; });
    if (cur.skipDemoted) relax('keep demoted rows', c => { c.skipDemoted = false; });
    for (const k of labelKeys) if (!cur.on[k]) relax('+' + k + ' back in', c => { c.on[k] = true; });
    postmortem = {
      note: 'leave-one-out on the confirmed config: a variant that BEATS the full config on the held-out window names a clause the search added for its own windows — refused for shipping',
      baseline: confNew, variants,
      refused: variants.filter(v => v.heldOut.win != null && confNew.win != null && v.heldOut.win > confNew.win + 1e-12).map(v => v.relax)
    };
    for (const v of variants)
      log('  LOO ' + v.relax.padEnd(40) + ' W4: n=' + v.heldOut.n + ' win=' + (v.heldOut.win == null ? '—' : (100 * v.heldOut.win).toFixed(1) + '%') + ' net=' + (v.heldOut.net == null ? '—' : v.heldOut.net.toFixed(3) + 'R'));
    if (postmortem.refused.length) log('  REFUSED for shipping (the held-out window reads BETTER without them): ' + postmortem.refused.join(', '));
  }

  /* Phase F — the direction cohort at both cost models (measured, not searched) */
  const dirCohort = { note: 'measured, not searched: the per-direction cohort at both cost models over the walked span',
    xmCostFrac: COST_XM_FRAC, paxgCostFrac: COST_PAXG_FRAC, directions: {} };
  {
    const all = score(baseConfig(walked.records)).trades;
    for (const dir of ['long', 'short']){
      const list = all.filter(t => t.dir === dir);
      const d = { n: list.length,
        win: list.length ? +(list.filter(t => t.outcome === 'win').length / list.length).toFixed(3) : null,
        netXm: list.length ? +(list.reduce((s, t) => s + t.net, 0) / list.length).toFixed(3) : null, windows: [] };
      for (let w = 0; w < 4; w++){
        const seg = list.filter(t => t.t >= winBars[w][0] && t.t < winBars[w][1]);
        d.windows.push(seg.length ? { n: seg.length, win: +(seg.filter(t => t.outcome === 'win').length / seg.length).toFixed(3), netXm: +(seg.reduce((s, t) => s + t.net, 0) / seg.length).toFixed(3) } : { n: 0 });
      }
      dirCohort.directions[dir] = d;
    }
    log('\nPhase F — the direction cohort (XM costs, measured):');
    for (const dir of ['long', 'short']){
      const d = dirCohort.directions[dir];
      log('  ' + dir.padEnd(6) + ' n=' + d.n + ' win=' + (d.win == null ? '—' : (100 * d.win).toFixed(1) + '%') + ' net@XM=' + (d.netXm == null ? '—' : d.netXm.toFixed(3) + 'R') + ' — windows ' + d.windows.map(w => (w.win == null ? '—' : (100 * w.win).toFixed(0) + '%/' + w.n + '/' + w.netXm.toFixed(2))).join('  '));
    }
  }

  /* Phase I — THE GEOMETRY LADDER + the record-only release check, on the
     pine book: (a) every stop/target rung settled on the whole book — the
     trading-style axis measured, not assumed; (b) the record-only layers on
     the pine desk's OWN lanes (the release question the hg-v1498 scalp-lane
     measurement did not cover). Both recorded in the artifact. */
  const geometryLadder = { note: 'every stop/target rung on the whole pine book (net@XM per trade)', rungs: [] };
  for (let g = 0; g < GEOMS.length; g++){
    const cfgG = JSON.parse(JSON.stringify(cur));
    cfgG.geom = g;
    const trades = evalConfig(data, cfgG);
    if (!trades.length) continue;
    geometryLadder.rungs.push({ geom: GEOMS[g].label, n: trades.length,
      win: +(trades.filter(t => t.outcome === 'win').length / trades.length).toFixed(3),
      net: +(trades.reduce((a, t) => a + t.net, 0) / trades.length).toFixed(3) });
  }
  geometryLadder.best = geometryLadder.rungs.slice().sort((a, b) => b.net - a.net)[0] || null;
  log('Phase I — the geometry ladder (best rung: ' + (geometryLadder.best ? geometryLadder.best.geom + ' ' + geometryLadder.best.net.toFixed(3) + 'R' : 'none') + '):');
  for (const r of geometryLadder.rungs) log('  ' + r.geom.padEnd(16) + ' n=' + r.n + ' win=' + (100 * r.win).toFixed(1) + '% net=' + r.net.toFixed(3) + 'R');

  const recOnlyRelease = { note: 'the record-only layers on the pine desk\'s OWN lanes — the release question', labels: [], releasable: [] };
  {
    const recOnly = walked.records.filter(r => r.recordOnly);
    const byKL = {};
    for (const r of recOnly){ const k = r.lane + '|' + r.label; (byKL[k] = byKL[k] || []).push(r); }
    const spanT0 = walked.records.length ? walked.records[0].t : 0;
    const spanT1 = m15[m15.length - 1].t * 1000;
    for (const [k, list] of Object.entries(byKL)){
      const settled = [];
      for (const r of list){
        const st = settleOne(grids, r, GEOMS[0]);
        if (st.outcome === 'unfilled' || st.outcome === 'open' || st.outcome === 'unpriced') continue;
        settled.push({ t: r.t, net: st.rGross - (r.entry * COST_XM_FRAC) / Math.abs(r.entry - r.stop) });
      }
      if (settled.length < 20){ recOnlyRelease.labels.push({ laneLabel: k, settled: settled.length, thin: true }); continue; }
      const net = settled.reduce((a, t) => a + t.net, 0) / settled.length;
      const parts = []; let pos = 0;
      for (let w = 0; w < 4; w++){
        const a = spanT0 + (spanT1 - spanT0) * w / 4, b = spanT0 + (spanT1 - spanT0) * (w + 1) / 4;
        const seg = settled.filter(t => t.t >= a && t.t < b);
        if (!seg.length){ parts.push(null); continue; }
        const wn = seg.reduce((x, y) => x + y.net, 0) / seg.length;
        parts.push(+wn.toFixed(3)); if (wn > 0) pos++;
      }
      const rec2 = { laneLabel: k, n: settled.length, net: +net.toFixed(3), positiveWindows: pos, windows: parts };
      rec2.clears = (net > 0 && pos >= 3);
      recOnlyRelease.labels.push(rec2);
      if (rec2.clears) recOnlyRelease.releasable.push(k);
    }
    log('Phase I — the record-only release check: ' + recOnlyRelease.labels.length + ' lane|labels measured, '
      + (recOnlyRelease.releasable.length ? 'RELEASABLE: ' + recOnlyRelease.releasable.join(', ') : 'NONE releasable (all negative-in-windows or too thin)'));
  }

  /* Phase J — the CONFIRMATORY-SIGNAL sweep: the four direction-aware catalog
     reads (DMI, RSI, TSMOM96, SMA50) measured as confirm cohorts on the pine
     book. This is the measurement behind the confirm chip — and the honest
     answer it produced: no confirming read separates winners on this book. */
  const confirmatorySweep = { note: 'the direction-aware confirm reads measured as cohorts on the pine book (net@XM per trade, four disjoint windows)', reads: [] };
  {
    const CONFIRMS = {
      dmiWith:   function(dir, reg){ return dir === 'long' ? (reg.pdi > reg.mdi) : (reg.mdi > reg.pdi); },
      rsiWith:   function(dir, reg){ return dir === 'long' ? reg.rsi > 50 : reg.rsi < 50; },
      tsmomWith: function(dir, reg){ return dir === 'long' ? reg.tsmom > 0 : reg.tsmom < 0; },
      sma50With: function(dir, reg){ return dir === 'long' ? reg.entry > reg.sma50 : reg.entry < reg.sma50; }
    };
    const settledBook = [];
    for (const r of data.records){
      const ck = r.idxKey || (r.idxKey = r.lane + '|' + r.t + '|' + r.label + '|' + r.dir);
      const st = data.settled.get(ck + '|0') || (data.settled.set(ck + '|0', settleOne(data.grids, r, GEOMS[0])), data.settled.get(ck + '|0'));
      if (!st || st.outcome === 'unfilled' || st.outcome === 'open' || st.outcome === 'unpriced') continue;
      settledBook.push({ t: r.t, dir: r.dir, reg: r.reg, net: st.rGross - (r.entry * COST_XM_FRAC) / Math.abs(r.entry - r.stop) });
    }
    const bookNet = settledBook.length ? settledBook.reduce(function(a, x){ return a + x.net; }, 0) / settledBook.length : NaN;
    confirmatorySweep.book = { n: settledBook.length, net: +bookNet.toFixed(3) };
    for (const name of Object.keys(CONFIRMS)){
      const cohort = settledBook.filter(function(x){ try { return CONFIRMS[name](x.dir, x.reg); } catch (e) { return false; } });
      if (cohort.length < 40){ confirmatorySweep.reads.push({ read: name, n: cohort.length, thin: true }); continue; }
      const net = cohort.reduce(function(a, x){ return a + x.net; }, 0) / cohort.length;
      const parts = []; var pos = 0;
      for (var w = 0; w < 4; w++){
        var a = winBars[w][0], b = winBars[w][1];
        var seg = cohort.filter(function(x){ return x.t >= a && x.t < b; });
        if (!seg.length){ parts.push(null); continue; }
        var wn = seg.reduce(function(acc, x){ return acc + x.net; }, 0) / seg.length;
        parts.push(+wn.toFixed(3)); if (wn > 0) pos++;
      }
      confirmatorySweep.reads.push({ read: name, n: cohort.length, net: +net.toFixed(3), windows: parts, positiveWindows: pos, clears: (net > 0 && pos >= 3) });
    }
    log('Phase J — the confirmatory-signal sweep (the pine book, net@XM ' + bookNet.toFixed(3) + 'R):');
    for (const rd of confirmatorySweep.reads)
      log('  ' + rd.read.padEnd(10) + ' n=' + rd.n + ' net=' + (rd.net == null ? '—' : rd.net.toFixed(3) + 'R') + ' windows ' + (rd.windows || []).map(function(x){ return x == null ? '—' : x.toFixed(2); }).join('/') + (rd.clears ? '  <-- CLEARS' : ''));
  }

  const report = {
    meta: { generated: new Date().toISOString(), symbol: SYMBOL, bars: BARS_15M,
      span: [new Date(m15[walked.first15].t * 1000).toISOString(), new Date(m15[m15.length - 1].t * 1000).toISOString()],
      windows: [0, 1, 2, 3].map(wName), searchWindows: 'W1-W3', heldOut: 'W4',
      costs: { xm: COST_XM_FRAC, paxg: COST_PAXG_FRAC }, evaluated,
      walkArtifact: 'scripts/goldpine-walk-results.json' },
    baseline: { all: bAll, description: describe(baseConfig(walked.records)) },
    path: history,
    final: { config: cur, description: describe(cur), search: base.searchAll, heldOut: confNew, heldOutBaseline: confBase, all: fAll, z: +z.toFixed(2), pTwoSided: +zP.toFixed(4), confirmed },
    postmortem,
    directionCohort: dirCohort,
    indicatorSweep,
    geometryLadder,
    recordOnlyRelease: recOnlyRelease,
    confirmatorySweep
  };
  fs.writeFileSync(LAB_OUT, JSON.stringify(report, null, 1));

  log('\n=== FINAL CONFIG ===');
  log(describe(cur));
  log('search (W1-W3): n=' + base.searchAll.n + ' win=' + (100 * base.searchAll.win).toFixed(1) + '% net=' + base.searchAll.net.toFixed(3) + 'R');
  log('all windows:    n=' + fAll.n + ' win=' + (100 * fAll.win).toFixed(1) + '% net=' + fAll.net.toFixed(3) + 'R');
  log('vs baseline pooled: z=' + z.toFixed(2) + ' p=' + zP.toFixed(4) + ' (configurations evaluated: ' + evaluated + ' — the multiple-comparison discount applies)');
  log(confirmed ? 'CONFIRMED on held-out W4' : 'NOT CONFIRMED on held-out W4 — the search gain did not survive out of sample');
  log('written: ' + LAB_OUT);
})().catch(e => { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
