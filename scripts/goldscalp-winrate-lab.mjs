#!/usr/bin/node
/* HARDGATE — GOLD SCALP win-rate lab (offline, node ESM).
   Run:  node scripts/goldscalp-winrate-lab.mjs [--bars=N] [--passes=N]

   WHAT THIS IS: the GOLD SCALP tab's own add/remove simulation — the exact
   shape scripts/trendmx-winrate-lab.mjs ran for the TREND MATRIX desk
   (hg-v1484), pointed at the gold scalp pipeline. Phase A walks every closed
   15m bar through the tab's OWN pipeline (goldScalpSetups -> goldRankSetups,
   the same functions scripts/backtest-goldscalp.mjs boots, the same feed
   depths, the same 0.020% XM round trip, stop-first on a both-touch bar,
   24-bar conviction TTL, 96-bar timeout) and records EVERY candidate the
   pipeline forms — the ranked book AND the EDGE-suppressed shadow book —
   with the candidate's own stamps, killzone, grade, geometry, plus the gold
   indicator stack's regime reads (VR20, ENTROPY20, RSI14, ADX, Kaufman ER,
   squeeze) computed off the same scan input the tab saw. Phase B settles
   every candidate under a grid of stop/target geometries (the plan's own
   levels, plus stop-scale x T1-multiple around plan risk). Phase C is the
   simulation loop: starting from the SHIPPED configuration it greedily adds
   and removes admission clauses (per-strategy on/off, suppressed kinds
   admitted, direction, killzone family, gold-shut, the stamp vocabulary the
   pipeline itself prints, indicator-regime clauses, stop-width/RR bars,
   geometry), scoring every configuration on three disjoint SEARCH windows
   and keeping a move only when it clears the bar below. The loop runs until
   no move improves (or --passes). Phase D confirms the finalists on a fourth
   HELD-OUT window the search never saw.

   THE BAR (the hg-v922 shape, same as the trendmx lab, TIGHTENED after the
   first run overfit): a move must
   (1) not lower the win rate in ANY of the three search windows,
   (2) keep at least 40 settled positions in EACH search window — the first
       run cleared the bar at n>=15 per window and climbed to 66.7% by
       shrinking the book to n=69, then died on the held-out window (42.9%);
       a win-rate search that is allowed to shrink the sample buys its
       percentage with the evidence behind it,
   (3) keep at least 35% of the baseline book's search cohort — a config
       that is a knife-edge subset of the desk is not a desk,
   (4) not lower aggregate net R vs the current config — and only then rank
   on search win rate. Confirmation demands the held-out window's win rate
   AND net R are both at least the baseline's, with at least 25 settled
   there. Two-proportion z-test against the baseline pooled book; the number
   of configurations evaluated is printed because a search this wide needs
   its multiple-comparison discount said out loud.

   WHAT IT CANNOT SIMULATE, SAID: the taker-flow, GOLD PRO, news, macro and
   positioning legs read live feeds no bar archive carries (fail-open
   offline, exactly as the live tab degrades); funding is not modelled
   (PAXG spot stands in for XAUUSD); one symbol. Same limitations the
   committed walk states, inherited whole.

   This script MEASURES. It ships nothing: a clause enters the tab only
   through the measured-edge doctrine (hg-v966 both-halves / held-out), and
   the shipped walk re-run is the arbiter.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { xmOrderType, ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';
import { klinesRouteNote } from '../lib/klines-source.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const HERE = path.join(ROOT, 'scripts');
const LAB_OUT = path.join(HERE, 'goldscalp-winrate-lab-results.json');
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => { const a = argv.find(x => x.startsWith(name + '=')); return a ? a.slice(name.length + 1) : dflt; };

const SYMBOL = 'PAXGUSDT';
const DEPTH = { m15: 240, h1: 400, h4: 220, d1: 260 };
const BARS_15M = +opt('--bars', 6000);
const PASSES = +opt('--passes', 8);
const FILL_WINDOW = 24, TIMEOUT_BARS = 96;
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;      /* 0.020% — XM XAUUSD */
const IV_SEC = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

/* geometry grid: g0 = the plan's own levels (baseline); the rest scale the
   stop and the T1 multiple around the plan risk, in plan-risk units. */
const GEOMS = [{ s: 1, k: null, label: 'plan' }];
for (const s of [0.75, 1, 1.25, 1.5]) for (const k of [1.5, 2, 2.5, 3]) GEOMS.push({ s, k, label: 'stop' + s + 'x t1 ' + k + 'R' });

/* the stamp clauses the lab may add or remove — the pipeline's OWN vocabulary */
const STAMP_CLAUSES = [
  'skip CONF NO TRADE', 'skip S23 CHOP', 'skip MTF BIAS', 'skip OFF-SESSION',
  'skip S56 BALANCE', 'skip S60 HALF', 'skip NEAR EQ', 'skip THIN VP',
  'skip REGIME MR', 'skip S23 MIXED', 'skip COUNTER-TREND', 'skip DISCOUNT SHORT',
  'skip PREMIUM LONG', 'skip ASIA SESSION', 'skip DEAD TAPE', 'skip PINE AGAINST',
  'skip EDGE DEMOTE', 'require EDGE PREFER', 'require ACCURACY', 'require EDGE MEASURED'
];
const KZ_SKIP = ['skip OFF-HOURS', 'skip OVERLAP', 'skip ASIAN RANGE', 'only LONDON+NY'];

async function cachedKlines(symbol, interval, target){
  const file = path.join(CACHE_DIR, symbol + '-' + interval + '.json');
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(file)){
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j && j.target >= target && Array.isArray(j.rows) && j.rows.length >= target) return j.rows.slice(-target);
  }
  console.log('  fetching ' + symbol + ' ' + interval + ' x' + target + ' — ' + klinesRouteNote());
  const rows = [];
  let end = null;
  while (rows.length < target){
    const params = { symbol, interval, limit: Math.min(1000, target - rows.length) };
    if (end) params.endTime = end;
    const { klinesUrl } = await import('../lib/klines-source.mjs');
    const { url } = klinesUrl(params, process.env);
    const res = await fetch(url);
    if (!res.ok) throw new Error('klines ' + res.status + ' for ' + symbol + ' ' + interval);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    rows.unshift(...batch.map(b => ({ t: Math.floor(b[0] / 1000), o: +b[1], h: +b[2], l: +b[3], c: +b[4], v: +b[5] })));
    end = batch[0][0] - 1;
    /* hg-v1509: a short page is NOT the end of history — endTime advances,
       keep going. (A short middle page used to end the walk silently days
       before the present; the freshness gate below now refuses that.) */
  }
  if (rows.length){
    const ivMs = ({ '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 })[interval] || 900000;
    const staleMs = Date.now() - rows[rows.length - 1].t * 1000 - ivMs;
    if (staleMs > 3 * ivMs) throw new Error('tape truncated: the newest ' + interval
      + ' bar closes ' + Math.round(staleMs / 3600000) + 'h ago — refusing to measure a stale tape; delete the cache and re-run');
  }
  fs.writeFileSync(file, JSON.stringify({ target, rows }));
  return rows.slice(-target);
}

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  /* hg-v1493: the catalog loads here (the live tab loads it) — the ranker's
     indicator-stack reads are live-faithful. pinegoldmath does NOT load in
     this boot: the live GOLD SCALP tab runs without it, and loading it here
     turned the ranker pine-aware (PINE stamps on every candidate) — a
     divergence the squeeze sweep caught immediately. Phase H boots its own
     pine-aware sandbox when it needs the record-only layers. */
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  for (const fn of ['goldScalpSetups', 'goldRankSetups', 'goldSeason', 'goldCrossVenueMap', 'goldKillzone', 'hgGoldIndicatorReads'])
    if (typeof ctx[fn] !== 'function') throw new Error('boot failed: ' + fn + ' is not a function');
  return ctx;
}
/* the pine-aware boot, for Phase H only */
function bootPine(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js', 'pinemath.js', 'pinegoldmath.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  if (typeof ctx.pineGoldRecordLayerSetups !== 'function') throw new Error('pine boot failed');
  return ctx;
}

function sliceByCutoff(rows, tfSec, cutoffSec){
  let lo = 0, hi = rows.length;
  while (lo < hi){ const m = (lo + hi) >> 1; (rows[m].t + tfSec <= cutoffSec) ? lo = m + 1 : hi = m; }
  return rows.slice(0, lo);
}

/* ---------- Phase A: record every candidate the pipeline forms ---------- */
function walkRecords(W, m15, h1, h4, d1){
  const records = [];
  const counters = { scans: 0, ranked: 0, suppressed: 0, scanErrors: 0, noPlan: 0 };
  const needSec = Math.max(
    m15[0].t + DEPTH.m15 * 900,
    h4.length ? h4[0].t + DEPTH.h4 * 14400 : 0,
    h1.length ? h1[0].t + DEPTH.h1 * 3600 : 0,
    d1.length ? d1[0].t + DEPTH.d1 * 86400 : 0);
  let first = m15.findIndex(r => r.t + 900 >= needSec);
  if (first < 0) first = Math.min(m15.length - 1, DEPTH.m15);
  const t0 = Date.now();
  for (let i = first; i < m15.length; i++){
    const bar = m15[i];
    const cutoff = bar.t + 900;
    const now = cutoff * 1000;
    const inp = {
      rows15m: sliceByCutoff(m15, 900, cutoff).slice(-DEPTH.m15),
      rows1h: sliceByCutoff(h1, 3600, cutoff).slice(-DEPTH.h1),
      rows4h: sliceByCutoff(h4, 14400, cutoff).slice(-DEPTH.h4),
      dailyCandles: sliceByCutoff(d1, 86400, cutoff).slice(-DEPTH.d1),
      now, news: null, candleSource: 'binance-paxg'
    };
    let ranked = [], rejected = [], best = null;
    try {
      counters.scans++;
      const got = W.goldScalpSetups(inp) || [];
      const cands = Array.isArray(got) ? got : [];
      for (const c of cands){ if (c){ c.venue = 'BT PAXGUSDT'; c.sym = 'PAXGUSDT'; } }
      rejected = got.rejected || [];
      const ctx = { now, news: null, season: W.goldSeason(now), macro: null, spot: null,
                    fng: null, style: 'goldscalp', perpNative: null,
                    crossVenue: W.goldCrossVenueMap(cands),
                    rows15m: inp.rows15m, rows1h: inp.rows1h, rows4h: inp.rows4h };
      const rk = W.goldRankSetups(cands, ctx) || { ranked: cands, best: null, rejected: [] };
      ranked = rk.ranked || [];
      best = rk.best || null;
      rejected = rk.rejected || rejected;
    } catch (e) { counters.scanErrors++; continue; }
    /* the gold indicator stack's regime reads, off the SAME scan input */
    let ir = null;
    try { ir = W.hgGoldIndicatorReads(inp.rows15m, {}) || null; } catch (eI) { ir = null; }
    const reg = ir ? {
      vr: isFinite(ir.vr20) ? +ir.vr20.toFixed(4) : null, vrs: ir.vrState || null,
      ent: isFinite(ir.entropy20) ? +ir.entropy20.toFixed(4) : null, ents: ir.entropyState || null,
      rsi: isFinite(ir.rsi14) ? +ir.rsi14.toFixed(2) : null,
      adx: isFinite(ir.adx) ? +ir.adx.toFixed(2) : null, adxs: ir.adxState || null,
      ker: isFinite(ir.ker20) ? +ir.ker20.toFixed(3) : null,
      sqz: ir.squeeze || null,
      /* hg-v1493: the REST of the gold-catalog indicator stack, recorded so the
         lab can measure every latest indicator as an admission clause */
      pdi: isFinite(ir.plusDI) ? +ir.plusDI.toFixed(2) : null,
      mdi: isFinite(ir.minusDI) ? +ir.minusDI.toFixed(2) : null,
      bbB: isFinite(ir.bbPctB) ? +ir.bbPctB.toFixed(3) : null,
      bbW: isFinite(ir.bbWidthPct) ? +ir.bbWidthPct.toFixed(2) : null,
      hv: isFinite(ir.hv20) ? +ir.hv20.toFixed(5) : null,
      hvMed: isFinite(ir.hv20Med) ? +ir.hv20Med.toFixed(5) : null,
      park: isFinite(ir.park20) ? +ir.park20.toFixed(5) : null,
      parkMed: isFinite(ir.park20Med) ? +ir.park20Med.toFixed(5) : null,
      volR: isFinite(ir.volRatio) ? +ir.volRatio.toFixed(3) : null,
      tsmom: isFinite(ir.tsmom96) ? +ir.tsmom96.toFixed(4) : null,
      sma50: isFinite(ir.sma50) ? +ir.sma50.toFixed(2) : null
    } : null;
    const take = (c, shadow) => {
      if (!c || (c.dir !== 'long' && c.dir !== 'short')) return;
      const isMp = !!(best && c.id != null && best.id === c.id);
      const entry = +c.entry, stop = +c.stop, t1 = +c.t1;
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)){ counters.noPlan++; return; }
      const long = c.dir === 'long';
      if (long && !(stop < entry && t1 > entry)) return;
      if (!long && !(stop > entry && t1 < entry)) return;
      const stamps = Array.isArray(c.stamps) ? c.stamps.slice(0, 24) : [];
      records.push({
        i, t: bar.t + 900, shadow: !!shadow,
        stratKey: String(c.stratKey || '?'), dir: c.dir,
        grade: c.grade || null, tally: isFinite(c.tally) ? c.tally : null,
        demoted: !!c.demoted, mp: isMp,
        stamps, killzone: c.killzone || null,
        rr: isFinite(c.rr) ? c.rr : null,
        stopAtr: (isFinite(c.atr) && c.atr > 0) ? +Math.abs(entry - stop) / c.atr : null,
        goldShut: c.goldShut === true,
        entry, stop, t1,
        orderType: xmOrderType(c.dir, entry, +bar.c).name,
        markAtFire: +bar.c,
        reg
      });
    };
    for (const c of ranked) { take(c, false); counters.ranked++; }
    for (const c of (rejected || [])){
      const isEdge = Array.isArray(c && c.stamps) && c.stamps.indexOf('EDGE SUPPRESS') >= 0;
      if (!isEdge) continue;
      take(c, true); counters.suppressed++;
    }
    if ((i - first) % 1000 === 0)
      console.log('  bar ' + i + '/' + m15.length + ' · records ' + records.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  /* mp: the ranker's own MOST-PROBABLE pick per bar — one per bar, by id order */
  return { records, counters, first, m15 };
}

/* ---------- Phase B: settle one candidate under one geometry ---------- */
function settleOne(m15, rec, geom){
  const dir = rec.dir, sgn = dir === 'long' ? 1 : -1;
  const risk0 = Math.abs(rec.entry - rec.stop);
  const entry = rec.entry;
  const stop = entry - sgn * geom.s * risk0;
  const t1 = geom.k == null ? rec.t1 : entry + sgn * geom.k * risk0;
  const risk = geom.s * risk0;
  if (!(risk > 0)) return { outcome: 'unpriced', liveUntil: rec.i };
  const orderType = xmOrderType(dir, entry, rec.markAtFire).name;
  let state = 'pending', waitBars = 0, fillIdx = null, exitIdx = null, rGross = null, bothTouch = false;
  for (let bi = rec.i + 1; bi < m15.length; bi++){
    const bar = m15[bi];
    if (state === 'pending'){
      if (ogXmBarTouchesEntry(orderType, dir, bar, entry)){ state = 'filled'; fillIdx = bi; }
      else { if (++waitBars >= FILL_WINDOW) return { outcome: 'unfilled', liveUntil: bi }; continue; }
    }
    const hitStop = dir === 'long' ? +bar.l <= stop : +bar.h >= stop;
    const hitT1 = dir === 'long' ? +bar.h >= t1 : +bar.l <= t1;
    if (hitStop && hitT1){ return { outcome: 'loss', bothTouch: true, liveUntil: bi, rGross: -1, fillIdx, exitIdx: bi }; }
    if (hitStop){ return { outcome: 'loss', liveUntil: bi, rGross: -1, fillIdx, exitIdx: bi }; }
    if (hitT1){ return { outcome: 'win', liveUntil: bi, rGross: Math.abs(t1 - entry) / risk, fillIdx, exitIdx: bi }; }
    if (bi - fillIdx >= TIMEOUT_BARS){
      const mv = dir === 'long' ? (+bar.c - entry) : (entry - +bar.c);
      return { outcome: 'timeout', liveUntil: bi, rGross: mv / risk, fillIdx, exitIdx: bi };
    }
  }
  return { outcome: 'open', liveUntil: m15.length - 1 };
}

/* ---------- Phase C: the shipped configuration and the clauses ---------- */
function baseConfig(records){
  const on = {}, sup = {};
  for (const r of records) (r.shadow ? sup : on)[r.stratKey] = true;
  for (const k of Object.keys(sup)) sup[k] = false;   /* shipped: suppressed kinds stay suppressed */
  return {
    on, sup,
    dirLong: true, dirShort: true,
    kz: {},                        /* skip-killzone-family flags */
    onlyLondonNy: false,
    skipGoldShut: false,
    stamps: {},                    /* STAMP_CLAUSES label -> true */
    reg: {},                       /* indicator-regime clauses */
    mpOnly: false,
    minStopAtr: 0, maxStopAtr: 0,  /* 0 = off */
    minRR: 0,
    geom: 0
  };
}
function selected(cfg, r){
  if (r.shadow){ if (!cfg.sup[r.stratKey]) return false; }
  else if (!cfg.on[r.stratKey]) return false;
  if (r.dir === 'long' && !cfg.dirLong) return false;
  if (r.dir === 'short' && !cfg.dirShort) return false;
  const kz = String(r.killzone || '');
  if (cfg.kz['skip OFF-HOURS'] && kz.indexOf('OFF-HOURS') >= 0) return false;
  if (cfg.kz['skip OVERLAP'] && kz.indexOf('OVERLAP') >= 0) return false;
  if (cfg.kz['skip ASIAN RANGE'] && kz.indexOf('ASIAN RANGE') >= 0) return false;
  if (cfg.kz['only LONDON+NY'] && kz.indexOf('LONDON KILLZONE') < 0 && kz.indexOf('NY AM') < 0) return false;
  if (cfg.skipGoldShut && r.goldShut) return false;
  for (const label of STAMP_CLAUSES){
    if (!cfg.stamps[label]) continue;
    const core = label.replace(/^skip /, '').replace(/^require /, '');
    const hasStamp = r.stamps.some(s => s.indexOf(core) >= 0);
    if (label.indexOf('skip ') === 0 && hasStamp) return false;
    if (label.indexOf('require ') === 0 && !hasStamp) return false;
  }
  const reg = r.reg || {};
  if (cfg.reg.skipVrMeanrev && reg.vrs === 'MEANREV') return false;
  if (cfg.reg.requireVrTrend && reg.vrs !== 'TRENDING') return false;
  if (cfg.reg.skipEntropyDisorder && reg.ents === 'DISORDER') return false;
  if (cfg.reg.requireEntropyOrdered && reg.ents !== 'ORDERED') return false;
  if (cfg.reg.rsiWith && isFinite(reg.rsi) && ((r.dir === 'long' && reg.rsi <= 50) || (r.dir === 'short' && reg.rsi >= 50))) return false;
  if (cfg.reg.adxTrending && !(reg.adxs === 'TRENDING')) return false;
  if (cfg.reg.kerTrend && !(isFinite(reg.ker) && reg.ker >= 0.6)) return false;
  if (cfg.reg.squeezeOff && reg.sqz && String(reg.sqz).indexOf('OFF') < 0) return false;
  /* hg-v1493: the latest-indicator clauses, each a measured admission filter */
  if (cfg.reg.dmiWith && isFinite(reg.pdi) && isFinite(reg.mdi) && ((r.dir === 'long' && reg.pdi <= reg.mdi) || (r.dir === 'short' && reg.mdi <= reg.pdi))) return false;
  if (cfg.reg.skipBbExtreme && isFinite(reg.bbB) && ((r.dir === 'long' && reg.bbB > 0.95) || (r.dir === 'short' && reg.bbB < 0.05))) return false;
  if (cfg.reg.volAbove && !(isFinite(reg.volR) && reg.volR >= 1)) return false;
  if (cfg.reg.skipHvSpike && isFinite(reg.hv) && isFinite(reg.hvMed) && reg.hvMed > 0 && reg.hv > reg.hvMed * 1.25) return false;
  if (cfg.reg.tsmomWith && isFinite(reg.tsmom) && ((r.dir === 'long' && reg.tsmom <= 0) || (r.dir === 'short' && reg.tsmom >= 0))) return false;
  if (cfg.reg.sma50With && isFinite(reg.sma50) && ((r.dir === 'long' && r.entry < reg.sma50) || (r.dir === 'short' && r.entry > reg.sma50))) return false;
  if (cfg.reg.squeezeOn && reg.sqz && String(reg.sqz).indexOf('ON') < 0) return false;
  if (cfg.mpOnly && !r.mp) return false;
  if (cfg.minStopAtr > 0 && !(isFinite(r.stopAtr) && r.stopAtr >= cfg.minStopAtr)) return false;
  if (cfg.maxStopAtr > 0 && !(isFinite(r.stopAtr) && r.stopAtr <= cfg.maxStopAtr)) return false;
  if (cfg.minRR > 0 && !(isFinite(r.rr) && r.rr >= cfg.minRR)) return false;
  return true;
}
function describe(cfg){
  const bits = [];
  const offStrat = Object.keys(cfg.on).filter(k => !cfg.on[k]);
  const supOn = Object.keys(cfg.sup).filter(k => cfg.sup[k]);
  if (offStrat.length) bits.push('strats -' + offStrat.join('-'));
  if (supOn.length) bits.push('suppressed +' + supOn.join('-'));
  if (!cfg.dirLong || !cfg.dirShort) bits.push(cfg.dirLong ? 'long only' : (cfg.dirShort ? 'short only' : 'NO DIR'));
  for (const k of Object.keys(cfg.kz)) if (cfg.kz[k]) bits.push(k);
  if (cfg.skipGoldShut) bits.push('skip goldShut');
  for (const label of STAMP_CLAUSES) if (cfg.stamps[label]) bits.push(label);
  for (const k of Object.keys(cfg.reg)) if (cfg.reg[k]) bits.push(k);
  if (cfg.mpOnly) bits.push('MP only');
  if (cfg.minStopAtr) bits.push('stopAtr>=' + cfg.minStopAtr);
  if (cfg.maxStopAtr) bits.push('stopAtr<=' + cfg.maxStopAtr);
  if (cfg.minRR) bits.push('rr>=' + cfg.minRR);
  bits.push('geom:' + GEOMS[cfg.geom].label);
  return bits.join(' · ');
}
function evalConfig(data, cfg){
  const trades = [];
  const live = new Map();   /* stratKey|dir -> liveUntil bar */
  for (const r of data.records){
    if (!selected(cfg, r)) continue;
    const key = r.stratKey + '|' + r.dir;
    /* merge semantics = the shipped walk's: the previous position is deleted
       during bar liveUntil's advance, BEFORE that bar's scan — so a candidate
       ON the resolution bar may mint (r.i === liveUntil passes; r.i < does not). */
    if (live.has(key) && r.i < live.get(key)) continue;
    const s = data.settled.get(r.i + '|' + cfg.geom) || (data.settled.set(r.i + '|' + cfg.geom, settleOne(data.m15, r, GEOMS[cfg.geom])), data.settled.get(r.i + '|' + cfg.geom));
    live.set(key, s.liveUntil);
    if (s.outcome === 'unfilled' || s.outcome === 'open' || s.outcome === 'unpriced') continue;
    const risk = GEOMS[cfg.geom].s * Math.abs(r.entry - r.stop);
    const net = s.rGross - (r.entry * COST_XM_FRAC) / risk;
    trades.push({ t: r.t, outcome: s.outcome, net, bothTouch: !!s.bothTouch, r: s.rGross });
  }
  trades.sort((a, b) => a.t - b.t);
  return trades;
}
function windowAgg(trades, t0, t1){
  const s = trades.filter(t => t.t >= t0 && t.t < t1);
  if (!s.length) return { n: 0, win: null, net: null };
  let w = 0, net = 0;
  for (const t of s){ if (t.outcome === 'win') w++; net += t.net; }
  return { n: s.length, win: w / s.length, net: net / s.length };
}

/* exported so a sensitivity driver can re-use the machinery without re-walking */
export { boot, bootPine, cachedKlines, walkRecords, settleOne, baseConfig, selected, describe, evalConfig, windowAgg, GEOMS, STAMP_CLAUSES, DEPTH, COST_XM_FRAC };

/* ---------- main ---------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) (async () => {
  const log = console.log;
  log('=== GOLD SCALP win-rate lab · ' + new Date().toISOString() + ' ===');
  log('symbol ' + SYMBOL + ' · 15m bars ' + BARS_15M + ' · XM 0.020% RT · route ' + klinesRouteNote());
  const W = boot();
  const m15 = await cachedKlines(SYMBOL, '15m', BARS_15M);
  const h1 = await cachedKlines(SYMBOL, '1h', Math.max(DEPTH.h1 + Math.ceil(BARS_15M / 4) + 8, 1200));
  const h4 = await cachedKlines(SYMBOL, '4h', Math.max(DEPTH.h4 + Math.ceil(BARS_15M / 16) + 8, 600));
  const d1 = await cachedKlines(SYMBOL, '1d', Math.max(DEPTH.d1 + Math.ceil(BARS_15M / 96) + 4, 330));
  log('  tapes ready: 15m x' + m15.length + ' (span ' + new Date(m15[0].t * 1000).toISOString().slice(0, 10) + ' .. ' + new Date(m15[m15.length - 1].t * 1000).toISOString().slice(0, 10) + ')');

  log('Phase A — walking the tab pipeline, recording every candidate...');
  const walked = walkRecords(W, m15, h1, h4, d1);
  log('  records: ' + walked.records.length + ' (ranked ' + walked.counters.ranked + ', edge-suppressed ' + walked.counters.suppressed
      + ', scanErrors ' + walked.counters.scanErrors + ', noPlan ' + walked.counters.noPlan + ')');
  const data = { records: walked.records, m15: walked.m15, settled: new Map() };

  /* windows: 4 disjoint, equal bar counts over the walked region */
  const first = walked.first, span = m15.length - first;
  const wLen = Math.floor(span / 4);
  const winBars = [0, 1, 2, 3].map(w => [m15[first + w * wLen].t + 900, m15[first + (w + 1) * wLen].t + 900]);
  const wName = i => 'W' + (i + 1) + ' ' + new Date(winBars[i][0] * 1000).toISOString().slice(0, 10) + '..' + new Date(winBars[i][1] * 1000).toISOString().slice(0, 10);

  const cur = baseConfig(data.records);
  const score = (cfg) => {
    const trades = evalConfig(data, cfg);
    const win = [0, 1, 2, 3].map(i => windowAgg(trades, winBars[i][0], winBars[i][1]));
    const searchAll = { n: win[0].n + win[1].n + win[2].n,
      win: (win[0].win * win[0].n + win[1].win * win[1].n + win[2].win * win[2].n) / Math.max(1, win[0].n + win[1].n + win[2].n),
      net: (win[0].net * win[0].n + win[1].net * win[1].n + win[2].net * win[2].n) / Math.max(1, win[0].n + win[1].n + win[2].n) };
    return { trades, win, searchAll, all: windowAgg(trades, winBars[0][0], winBars[3][1]) };
  };

  log('\nPhase C — greedy add/remove from the SHIPPED configuration');
  log('baseline: ' + describe(cur));
  let base = score(cur);
  log('baseline search (W1-W3): n=' + base.searchAll.n + ' win=' + (100 * base.searchAll.win).toFixed(1) + '% net=' + base.searchAll.net.toFixed(3) + 'R');
  log('baseline all:            n=' + base.all.n + ' win=' + (100 * base.all.win).toFixed(1) + '% net=' + base.all.net.toFixed(3) + 'R');

  /* the move set */
  const stratKeys = Object.keys(cur.on).sort(), supKeys = Object.keys(cur.sup).sort();
  const moves = [];
  for (const k of stratKeys) moves.push({ label: 'strat ' + (cur.on[k] ? '-' : '+') + k, apply: c => { c.on[k] = !c.on[k]; } });
  for (const k of supKeys) moves.push({ label: 'suppressed ' + (cur.sup[k] ? '-' : '+') + k, apply: c => { c.sup[k] = !c.sup[k]; } });
  moves.push({ label: 'long only', apply: c => { c.dirLong = true; c.dirShort = false; } });
  moves.push({ label: 'short only', apply: c => { c.dirLong = false; c.dirShort = true; } });
  moves.push({ label: 'both dirs', apply: c => { c.dirLong = true; c.dirShort = true; } });
  for (const k of ['skip OFF-HOURS', 'skip OVERLAP', 'skip ASIAN RANGE', 'only LONDON+NY'])
    moves.push({ label: k, apply: c => { c.kz[k] = !c.kz[k]; } });
  moves.push({ label: 'skip goldShut', apply: c => { c.skipGoldShut = !c.skipGoldShut; } });
  for (const label of STAMP_CLAUSES) moves.push({ label, apply: c => { c.stamps[label] = !c.stamps[label]; } });
  for (const k of ['skipVrMeanrev', 'requireVrTrend', 'skipEntropyDisorder', 'requireEntropyOrdered', 'rsiWith', 'adxTrending', 'kerTrend', 'squeezeOff',
                   'dmiWith', 'skipBbExtreme', 'volAbove', 'skipHvSpike', 'tsmomWith', 'sma50With', 'squeezeOn'])
    moves.push({ label: k, apply: c => { c.reg[k] = !c.reg[k]; } });
  moves.push({ label: 'MP only', apply: c => { c.mpOnly = !c.mpOnly; } });
  const atrSteps = [0, 0.75, 1, 1.25, 1.5, 2];
  moves.push({ label: 'stopAtr floor++', apply: c => { const i = atrSteps.indexOf(c.minStopAtr); c.minStopAtr = atrSteps[Math.min(atrSteps.length - 1, i + 1)]; } });
  moves.push({ label: 'stopAtr floor--', apply: c => { const i = atrSteps.indexOf(c.minStopAtr); c.minStopAtr = atrSteps[Math.max(0, i - 1)]; } });
  const ceilSteps = [0, 2, 2.5, 3, 3.5];
  moves.push({ label: 'stopAtr ceiling++', apply: c => { const i = ceilSteps.indexOf(c.maxStopAtr); c.maxStopAtr = ceilSteps[Math.min(ceilSteps.length - 1, i + 1)]; } });
  moves.push({ label: 'stopAtr ceiling--', apply: c => { const i = ceilSteps.indexOf(c.maxStopAtr); c.maxStopAtr = ceilSteps[Math.max(0, i - 1)]; } });
  const rrSteps = [0, 1.2, 1.5, 2];
  moves.push({ label: 'rr floor++', apply: c => { const i = rrSteps.indexOf(c.minRR); c.minRR = rrSteps[Math.min(rrSteps.length - 1, i + 1)]; } });
  moves.push({ label: 'rr floor--', apply: c => { const i = rrSteps.indexOf(c.minRR); c.minRR = rrSteps[Math.max(0, i - 1)]; } });
  moves.push({ label: 'geom next', apply: c => { c.geom = (c.geom + 1) % GEOMS.length; } });
  moves.push({ label: 'geom prev', apply: c => { c.geom = (c.geom + GEOMS.length - 1) % GEOMS.length; } });

  const okMove = (res) => res.win.every((w, i) => i < 3 ? (w.win != null && w.n >= 40 && w.win >= base.win[i].win - 1e-12) : true)
    && res.searchAll.n >= 0.35 * base.searchAll.n
    && res.searchAll.net >= base.searchAll.net - 1e-12;

  let evaluated = 0;

  /* the INDICATOR SWEEP, first: every latest-indicator clause measured ALONE
     on all four windows, before the greedy loop mixes them with strategy
     moves — the honest way to answer "is this indicator worth admitting" */
  const indicatorSweep = [];
  {
    log('\nINDICATOR SWEEP — each clause alone vs the baseline:');
    const regMoves = moves.filter(m => /^(skip|require)(Vr|Entropy)|^(rsiWith|adxTrending|kerTrend|squeezeOff|dmiWith|skipBbExtreme|volAbove|skipHvSpike|tsmomWith|sma50With|squeezeOn)$/.test(m.label));
    for (const mv of regMoves){
      const cand = JSON.parse(JSON.stringify(cur));
      mv.apply(cand);
      const res = score(cand);
      evaluated++;
      const better = res.searchAll.win > base.searchAll.win + 1e-12 && res.searchAll.net >= base.searchAll.net - 1e-12;
      indicatorSweep.push({ clause: mv.label, search: res.searchAll, heldOut: res.win[3], improves: better });
      log('  ' + mv.label.padEnd(22) + ' W1-W3: n=' + String(res.searchAll.n).padStart(5)
        + ' win=' + (res.searchAll.win == null ? '—' : (100 * res.searchAll.win).toFixed(1) + '%')
        + ' net=' + (res.searchAll.net == null ? '—' : res.searchAll.net.toFixed(3) + 'R')
        + '  W4: n=' + res.win[3].n + ' win=' + (res.win[3].win == null ? '—' : (100 * res.win[3].win).toFixed(1) + '%')
        + ' net=' + (res.win[3].net == null ? '—' : res.win[3].net.toFixed(3) + 'R')
        + (better ? '  <— improves' : ''));
    }
  }

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
    history.push({ pass: pass + 1, move: bestMove.label, description: describe(cur),
      search: base.searchAll, windows: base.win.slice(0, 3) });
    log('pass ' + (pass + 1) + ': ' + bestMove.label + '  ->  win ' + (100 * base.searchAll.win).toFixed(1) + '% net ' + base.searchAll.net.toFixed(3) + 'R (n=' + base.searchAll.n + ')  [' + describe(cur) + ']');
  }

  /* Phase D: held-out confirmation */
  log('\nPhase D — held-out confirmation (' + wName(3) + ', never searched)');
  const confNew = base.win[3], confBase = score(baseConfig(data.records)).win[3];
  log('baseline W4: n=' + confBase.n + ' win=' + (confBase.win == null ? '—' : (100 * confBase.win).toFixed(1) + '%') + ' net=' + (confBase.net == null ? '—' : confBase.net.toFixed(3) + 'R'));
  log('final    W4: n=' + confNew.n + ' win=' + (confNew.win == null ? '—' : (100 * confNew.win).toFixed(1) + '%') + ' net=' + (confNew.net == null ? '—' : confNew.net.toFixed(3) + 'R'));

  /* two-proportion z vs the baseline pooled book */
  const bAll = score(baseConfig(data.records)).all, fAll = base.all;
  const p1 = bAll.win || 0, n1 = bAll.n, p2 = fAll.win || 0, n2 = fAll.n;
  const pPool = (p1 * n1 + p2 * n2) / Math.max(1, n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(1, n1) + 1 / Math.max(1, n2)));
  const z = se > 0 ? (p2 - p1) / se : 0;
  const zP = 2 * (1 - normCdf(Math.abs(z)));
  function normCdf(x){ let t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return x >= 0 ? 1 - p : p; }

  const confirmed = confNew.win != null && confNew.win >= confBase.win - 1e-12 && confNew.net >= confBase.net - 1e-12 && confNew.n >= 25;

  /* Phase E — LEAVE-ONE-OUT postmortem, ALWAYS when confirmed: which clauses
     actually carry the held-out gain, and which were the search flattering
     itself. Each variant relaxes ONE clause of the final config; a variant
     whose held-out window IMPROVES on the full config names a clause the
     search added for the search windows, not for the desk — that clause is
     REFUSED for shipping and the reduction is recorded here. */
  let postmortem = null;
  if (confirmed){
    const variants = [];
    const relax = (name, mutate) => {
      const c = JSON.parse(JSON.stringify(cur)); mutate(c);
      const w = score(c).win;
      variants.push({ relax: name, windows: w, heldOut: w[3] });
    };
    relax('both dirs (direction clause off)', c => { c.dirLong = true; c.dirShort = true; });
    for (const kz of Object.keys(cur.kz)) if (cur.kz[kz]) relax('no ' + kz, c => { c.kz[kz] = false; });
    for (const label of STAMP_CLAUSES) if (cur.stamps[label]) relax('keep ' + label, c => { c.stamps[label] = false; });
    for (const k of Object.keys(cur.on)) if (!cur.on[k]) relax('+' + k + ' back in', c => { c.on[k] = true; });
    for (const k of Object.keys(cur.sup)) if (cur.sup[k]) relax('-' + k + ' back out', c => { c.sup[k] = false; });
    if (cur.skipGoldShut) relax('keep goldShut rows', c => { c.skipGoldShut = false; });
    if (cur.mpOnly) relax('not MP-only', c => { c.mpOnly = false; });
    postmortem = {
      note: 'leave-one-out on the confirmed config: a variant that BEATS the full config on the held-out window names a clause the search added for its own windows — refused for shipping',
      baseline: confNew, variants,
      refused: variants.filter(v => v.heldOut.win != null && confNew.win != null && v.heldOut.win > confNew.win + 1e-12).map(v => v.relax)
    };
    for (const v of variants)
      log('  LOO ' + v.relax.padEnd(34) + ' W4: n=' + v.heldOut.n + ' win=' + (v.heldOut.win == null ? '—' : (100 * v.heldOut.win).toFixed(1) + '%') + ' net=' + (v.heldOut.net == null ? '—' : v.heldOut.net.toFixed(3) + 'R'));
    if (postmortem.refused.length) log('  REFUSED for shipping (the held-out window reads BETTER without them): ' + postmortem.refused.join(', '));
  }
  /* Phase G — the LEAD-ELIGIBLE squeeze cohort on fresh data: the parked
     rank boost\u2019s promotion test. The v1493 stamp was record-only because
     the +0.19R cohort was measured over ALL squeeze-ON candidates (longs and
     demoted rows included) while the boost would act on LEAD-ELIGIBLE rows
     only — a population never measured. This phase measures exactly that
     population, per window, on the freshest bars: if the lead-eligible
     squeeze-ON cohort is net-positive in the held-out window too, the boost\u2019s
     objection is gone and the promotion is measured, not guessed. */
  const leadSq = { note: 'the lead-eligible squeeze-ON cohort (non-demoted rows only) \u2014 the population a rank boost would actually act on, measured on fresh bars', windows: [], overall: null };
  {
    const baseAll = evalConfig(data, baseConfig(data.records));
    const sqRows = data.records.filter(r => r.reg && r.reg.sqz === 'ON');
    const live = new Map(); const trades = [];
    for (const r of data.records){
      if (r.reg && r.reg.sqz !== 'ON') continue;
      if (r.demoted) continue;
      const key = r.lane + '|' + r.label + '|' + r.dir;
      if (live.has(key) && r.t < live.get(key)) continue;
      const ck = r.lane + '|' + r.t + '|' + r.label + '|' + r.dir;
      const s = data.settled.get(ck + '|0') || (data.settled.set(ck + '|0', settleOne(data.m15, r, GEOMS[0])), data.settled.get(ck + '|0'));
      live.set(key, s.liveUntil === Infinity ? Infinity : (data.m15[s.liveUntil] ? data.m15[s.liveUntil].t * 1000 : s.liveUntil * 1000));
      if (s.outcome === 'unfilled' || s.outcome === 'open' || s.outcome === 'unpriced') continue;
      const risk = Math.abs(r.entry - r.stop);
      trades.push({ t: r.t, outcome: s.outcome, net: s.rGross - (r.entry * COST_XM_FRAC) / risk });
    }
    trades.sort((a, b) => a.t - b.t);
    leadSq.overall = { n: trades.length, win: trades.length ? +(trades.filter(t => t.outcome === 'win').length / trades.length).toFixed(3) : null, net: trades.length ? +(trades.reduce((s, t) => s + t.net, 0) / trades.length).toFixed(3) : null };
    for (let w = 0; w < 4; w++){
      const seg = trades.filter(t => t.t >= winBars[w][0] && t.t < winBars[w][1]);
      leadSq.windows.push(seg.length ? { n: seg.length, win: +(seg.filter(t => t.outcome === 'win').length / seg.length).toFixed(3), net: +(seg.reduce((s, t) => s + t.net, 0) / seg.length).toFixed(3) } : { n: 0 });
    }
    log('Phase G — the LEAD-ELIGIBLE squeeze-ON cohort (the boost\u2019s real population):');
    log('  overall: n=' + leadSq.overall.n + ' win=' + (leadSq.overall.win == null ? '—' : (100 * leadSq.overall.win).toFixed(1) + '%') + ' net=' + (leadSq.overall.net == null ? '—' : leadSq.overall.net.toFixed(3) + 'R'));
    leadSq.windows.forEach((w, i) => log('  ' + wName(i) + ': n=' + w.n + ' win=' + (w.win == null ? '—' : (100 * w.win).toFixed(1) + '%') + ' net=' + (w.win == null ? '—' : w.net.toFixed(3) + 'R')));
    leadSq.bookSameWindows = [0, 1, 2, 3].map(i => windowAgg(baseAll, winBars[i][0], winBars[i][1]));
  }

  /* Phase H — the RECORD-ONLY PINE LAYERS as new-strategy candidates: the
     "add strategies" question measured honestly. The 26 record-only layers
     (pinegoldmath's withheld ports) are generated per closed 15m bar through
     their own minter and settled at the same semantics — the cohort each
     would bring IF the desk admitted it. This is the measurement the desk's
     own release rule wanted before anything ships. */
  const recordLayerSweep = { note: 'the record-only pine layers measured as scalp candidates (net@XM per trade, four disjoint windows) — the would-be new strategies', layers: [] };
  {
    const rlFn = bootPine().pineGoldRecordLayerSetups;
    if (typeof rlFn === 'function'){
      const layerRecs = [];
      for (let i = 260; i < m15.length; i++){
        const rows15 = m15.slice(Math.max(0, i - 240), i);
        let items = [];
        try { items = rlFn(rows15, 'scalp') || []; } catch (eRl) { items = []; }
        for (const it of items){
          if (!it || !it.recordOnly || !it.dir || !isFinite(+it.entry) || !isFinite(+it.stop) || !isFinite(+it.t1)) continue;
          const long = it.dir === 'long';
          if (long && !(+it.stop < +it.entry && +it.t1 > +it.entry)) continue;
          if (!long && !(+it.stop > +it.entry && +it.t1 < +it.entry)) continue;
          layerRecs.push({ i: i - 1, t: m15[i - 1].t * 1000, label: it.layerLabel || it.label || it.kind || 'layer',
            dir: it.dir, entry: +it.entry, stop: +it.stop, t1: +it.t1, markAtFire: m15[i - 1].c });
        }
      }
      const labels = {};
      for (const r of layerRecs) labels[r.label] = (labels[r.label] || 0) + 1;
      for (const label of Object.keys(labels)){
        const list = layerRecs.filter(r => r.label === label);
        const settled = [];
        for (const r of list){
          const st = settleOne(m15, r, GEOMS[0]);
          if (st.outcome === 'unfilled' || st.outcome === 'open' || st.outcome === 'unpriced') continue;
          settled.push({ t: r.t, outcome: st.outcome, net: st.rGross - (r.entry * COST_XM_FRAC) / Math.abs(r.entry - r.stop) });
        }
        const entry = { label, candidates: list.length, settled: settled.length };
        if (settled.length){
          entry.win = +(settled.filter(t => t.outcome === 'win').length / settled.length).toFixed(3);
          entry.net = +(settled.reduce((a, t) => a + t.net, 0) / settled.length).toFixed(3);
          entry.windows = [];
          let pos = 0;
          const w0 = settled.length ? settled[0].t : 0, w1 = m15[m15.length - 1].t * 1000;
          for (let w = 0; w < 4; w++){
            const a = w0 + (w1 - w0) * w / 4, b = w0 + (w1 - w0) * (w + 1) / 4;
            const seg = settled.filter(t => t.t >= a && t.t < b);
            if (!seg.length){ entry.windows.push({ n: 0 }); continue; }
            const wn = seg.reduce((x, y) => x + y.net, 0) / seg.length;
            entry.windows.push({ n: seg.length, net: +wn.toFixed(3) });
            if (wn > 0) pos++;
          }
          entry.positiveWindows = pos;
          entry.clears = (entry.net > 0 && pos >= 3);
        }
        recordLayerSweep.layers.push(entry);
      }
      const clearers = recordLayerSweep.layers.filter(x => x.clears === true);
      log('Phase H — the record-only pine layers as new-strategy candidates: ' + recordLayerSweep.layers.length + ' measured, '
        + clearers.length + ' clear the bar' + (clearers.length ? ': ' + clearers.map(x => x.label).join(', ') : ' — NONE (they stay record-only, now with evidence)'));
    }
  }

  const report = {
    meta: { generated: new Date().toISOString(), symbol: SYMBOL, bars: BARS_15M,
      span: [new Date(m15[first].t * 1000).toISOString(), new Date(m15[m15.length - 1].t * 1000).toISOString()],
      windows: [0, 1, 2, 3].map(wName), searchWindows: 'W1-W3', heldOut: 'W4',
      cost: COST_XM_FRAC, evaluated, geoms: GEOMS.map(g => g.label) },
    baseline: { all: score(baseConfig(data.records)).all, description: describe(baseConfig(data.records)) },
    path: history,
    final: { config: cur, description: describe(cur), search: base.searchAll, heldOut: confNew, heldOutBaseline: confBase, all: fAll, z: +z.toFixed(2), pTwoSided: +zP.toFixed(4), confirmed },
    postmortem,
    indicatorSweep,
    leadEligibleSqueeze: leadSq,
    recordLayerSweep
  };
  fs.writeFileSync(LAB_OUT, JSON.stringify(report, (k, v) => (k === 'trades' ? undefined : v), 1));

  log('\n=== FINAL CONFIG ===');
  log(describe(cur));
  log('search (W1-W3): n=' + base.searchAll.n + ' win=' + (100 * base.searchAll.win).toFixed(1) + '% net=' + base.searchAll.net.toFixed(3) + 'R');
  log('all windows:    n=' + fAll.n + ' win=' + (100 * fAll.win).toFixed(1) + '% net=' + fAll.net.toFixed(3) + 'R');
  log('vs baseline pooled: z=' + z.toFixed(2) + ' p=' + zP.toFixed(4) + ' (configurations evaluated: ' + evaluated + ' — the multiple-comparison discount applies)');
  log(confirmed ? 'CONFIRMED on held-out W4' : 'NOT CONFIRMED on held-out W4 — the search gain did not survive out of sample');
  log('written: ' + LAB_OUT);
})().catch(e => { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
