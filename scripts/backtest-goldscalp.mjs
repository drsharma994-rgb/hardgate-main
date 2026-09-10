/* HARDGATE — GOLD SCALP tab backtest harness (offline, node ESM).
   Run:  node scripts/backtest-goldscalp.mjs [--smoke] [--bars=N] [--refresh]

   WHAT THIS REPLAYS
   -----------------
   The GOLD SCALP tab's OWN pipeline, per closed 15m bar, zero lookahead:
     goldScalpSetups(inp) -> goldRankSetups(cands, ctx)
   — NOT the OMNIGOLD engine bridge (hgOgPickGoldEngineForMp) that
   scripts/backtest-omnigold.mjs samples. That bridge takes ONE grade-gated
   pick per horizon; the tab ranks EVERY strategy candidate, applies its own
   quality gates (inst-filter Asia demotion, micro veto, EDGE table,
   OFF-SESSION bar, GOLD PRO alignment), and issues per-(strategy,dir)
   convictions. The existing HG_GOLD_SETUP_EDGE table (goldind.js:1136) was
   baked from the BRIDGE replay (ENGINE n as small as 2) at PAXG 0.26% RT
   costs — this harness measures the tab itself, at the venue the tab
   actually quotes (XM XAUUSD), with PAXG costs as the sensitivity row.

   FIDELITY TO THE LIVE TAB
   ------------------------
   - inp mirrors buildCandidates (goldscalp.js:1251) + scalpBundle:
     { rows15m, rows1h, rows4h, dailyCandles, now, news, candleSource }.
     Feed depths are the tab's own: 15m x240 (KL_15M, goldscalp.js:128),
     1h x400 (the 7-step upgrade path at 1419 tops the 1h leg up to 400),
     4h x220, 1d x260.
   - ctx mirrors the tab's ranking ctx (goldscalp.js:1344): { now, news,
     season: goldSeason(now), macro:null, spot:null, fng:null,
     style:'goldscalp', perpNative:null, crossVenue: goldCrossVenueMap }.
     The tab does NOT put candle rows in ctx, so hgGoldApplyConfluence's
     core-confluence leg degrades the same way live and here.
   - `now` is the CLOSED bar's close instant ((t+900)*1000) — killzone,
     session gates and news windows read the bar's own clock, never the
     wall clock (the v698 closed-bar lesson).
   - live-only feeds (macro/DXY/US10Y, news, goldspot basis, F&G, GOLD PRO,
     funding, L2/tick, hgFilterGoldPostGate, hgApplyGoldBestLevels) are
     absent offline; every consumer feature-checks and degrades exactly as
     the live tab does on a fetch failure. Deviations are listed in meta.

   SELECTION / DEDUP (conviction-lock semantics)
   ---------------------------------------------
   One live trade per (stratKey|dir) — the tab's conviction lock restores
   ORIGINAL levels verbatim on re-scans and MERGES matching re-issues, so a
   signal for a key with a pending/filled trade is a re-confirmation, not a
   new trade (counted, skipped). Pending fill window = 24 x 15m bars (6h,
   CONVICTION_TTL_MS, goldscalp.js:506 — the tab's own EXPIRED horizon).

   OUTCOME RESOLUTION (LIB semantics: lib/omnigold-xm-bot-backtest.mjs)
   --------------------------------------------------------------------
   - signal fires on the CLOSE of 15m bar i; fills searched from bar i+1
   - pending order at entry; type from xmOrderType(dir, entry, close[i]);
     fill test = ogXmBarTouchesEntry (shared lib)
   - unfilled after 24 bars -> 'unfilled', NOT a loss (tab: EXPIRED)
   - after the fill: first touch of stop vs t1; both in one bar = LOSS
     (conservative); 96 bars (24h) after fill -> 'timeout', MTM at close
   - NOTE the live tab STOPS on a 15m CLOSE beyond the stop (wick-through
     survives live); touch-based stops here are stricter. Deliberate.

   COSTS (venue-true — the v536 OMNIGOLD lesson)
   ---------------------------------------------
   PRIMARY netR at XM XAUUSD: $0.35 spread / $3500 ref spot + 0.010% slip
   = 0.020% round trip (hgOgVenuePresetCost constants, omnigold.js:6789-91).
   SENSITIVITY netR at PAXG spot: 0.1% taker + 0.03% slip per side = 0.26%
   RT. Both are reported on every trade and every aggregate row; the scalp
   desk quotes broker-aligned XAUUSD (goldscalp.js:1506), so XM is the
   honest primary — PAXG is what the price SERIES is, so it stays visible.

   SHADOW BOOK
   -----------
   Candidates the baked EDGE table suppresses (stamps 'EDGE SUPPRESS')
   ride goldScalpSetups' .rejected side-channel WITH their full plan; they
   are walked in a separate shadow ledger (never pooled with the main book)
   to test whether bridge-era suppressions hold on the tab's own pipeline.
   Shadow rows never passed ranking, so they carry no grade/tally.

   DATA: PAXGUSDT Binance spot 15m/1h/4h/1d (same proxy + cache as
   backtest-omnigold.mjs; basis vs XAU ~0.1-0.5%, 24/7 weekend bars a
   broker never printed — session mechanics see phantom weekend sessions).
   Style: modeled on scripts/backtest-omnigold.mjs. No new dependencies. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { xmOrderType, ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');

/* ---------- CLI ---------- */
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(name + '='));
  return a ? a.split('=')[1] : dflt;
};
const SMOKE = has('--smoke');
const REFRESH = has('--refresh');
const BARS_15M = +opt('--bars', SMOKE ? 700 : 6000);
/* smoke runs write to their own file so a full-run artifact can never be
   silently overwritten (the OP smoke/OUT_PATH incident) */
const OUT_FILE = path.join(ROOT, 'scripts',
  SMOKE ? 'backtest-goldscalp-smoke-results.json' : 'backtest-goldscalp-results.json');

/* ---------- constants ---------- */
const SYMBOL = 'PAXGUSDT';
/* tab feed depths (goldscalp.js:128 + the 400x1h 7-step upgrade at 1419) */
const DEPTH = { m15: 240, h1: 400, h4: 220, d1: 260 };
const FILL_WINDOW = 24;           /* 15m bars = 6h, the tab's conviction TTL */
const TIMEOUT_BARS = 96;          /* 15m bars = 24h after the fill, MTM exit */
/* venue-true round-trip costs, fraction of entry */
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;      /* 0.020% — XM XAUUSD */
const COST_PAXG_FRAC = 2 * (0.0010 + 0.0003);          /* 0.26% — PAXG spot  */

/* ==================== 1. DATA — Binance spot klines, cached ==================== */

const IV_SEC = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-goldscalp-backtest/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.json();
}

async function fetchKlines(symbol, interval, target){
  const ivMs = IV_SEC[interval] * 1000;
  let out = [], endTime;
  while (out.length < target){
    const lim = Math.min(1000, target - out.length + 2);
    let url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol
            + '&interval=' + interval + '&limit=' + lim;
    if (endTime) url += '&endTime=' + endTime;
    const batch = await jget(url);
    if (!Array.isArray(batch) || !batch.length) break;
    out = batch.concat(out);
    endTime = batch[0][0] - 1;
    if (batch.length < lim) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const seen = new Set();
  const rows = out
    .filter(k => { if (seen.has(k[0])) return false; seen.add(k[0]); return true; })
    .map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))
    .sort((a, b) => a.t - b.t);
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();
  return rows;
}

async function cachedKlines(symbol, interval, target){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-' + interval + '.json');
  if (!REFRESH && fs.existsSync(file)){
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ageH = (Date.now() - j.fetchedAt) / 3.6e6;
      if (j.rows && j.rows.length >= target && ageH < 96){
        console.log('  cache hit ' + interval + ': ' + j.rows.length + ' bars (' + ageH.toFixed(1) + 'h old)');
        return j.rows.slice(-target);
      }
    } catch (e) { /* refetch */ }
  }
  console.log('  fetching ' + symbol + ' ' + interval + ' x' + target + ' from Binance spot...');
  const rows = await fetchKlines(symbol, interval, target);
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, interval, target, rows }));
  console.log('  got ' + rows.length + ' bars ('
    + new Date(rows[0].t * 1000).toISOString().slice(0, 10) + ' .. '
    + new Date(rows[rows.length - 1].t * 1000).toISOString().slice(0, 10) + ')');
  return rows;
}

/* ==================== 2. BOOT goldind.js in a vm sandbox ==================== */

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  /* goldind.js is standalone (tests/test-goldscalp.mjs boots it alone). */
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8'), ctx, { filename: 'goldind.js' });
  for (const fn of ['goldScalpSetups', 'goldRankSetups', 'goldSeason', 'goldCrossVenueMap', 'goldKillzone']){
    if (typeof ctx[fn] !== 'function') throw new Error('boot failed: ' + fn + ' is not a function');
  }
  return ctx;
}

/* ==================== 3. trade lifecycle (same walk as backtest-omnigold) ==================== */

function newTrade(sig){
  return Object.assign({ state: 'pending', waitBars: 0, fillIdx: null }, sig);
}

function stepTrade(tr, bar, bi){
  const { dir, entry, stop, t1 } = tr;
  const hitStop = dir === 'long' ? +bar.l <= stop : +bar.h >= stop;
  const hitT1 = dir === 'long' ? +bar.h >= t1 : +bar.l <= t1;
  if (tr.state === 'pending'){
    if (ogXmBarTouchesEntry(tr.orderType, dir, bar, entry)){
      tr.state = 'filled';
      tr.fillIdx = bi;
    } else {
      tr.waitBars++;
      if (tr.waitBars >= FILL_WINDOW){
        tr.outcome = 'unfilled'; tr.exitIdx = bi; tr.rGross = null;
        return true;
      }
      return false;
    }
  }
  if (tr.state === 'filled'){
    if (hitStop && hitT1){ tr.outcome = 'loss'; tr.bothTouch = true; tr.rGross = -1; tr.exitIdx = bi; return true; }
    if (hitStop){ tr.outcome = 'loss'; tr.rGross = -1; tr.exitIdx = bi; return true; }
    if (hitT1){ tr.outcome = 'win'; tr.rGross = Math.abs(t1 - entry) / Math.abs(stop - entry); tr.exitIdx = bi; return true; }
    if (bi - tr.fillIdx >= TIMEOUT_BARS){
      const risk = Math.abs(stop - entry);
      const mv = dir === 'long' ? (+bar.c - entry) : (entry - +bar.c);
      tr.outcome = 'timeout'; tr.rGross = mv / risk; tr.exitIdx = bi;
      return true;
    }
  }
  return false;
}

function settleRecord(tr, rows, counters, results){
  const risk = Math.abs(tr.stop - tr.entry);
  const costXm = (tr.rGross == null) ? null : (tr.entry * COST_XM_FRAC) / risk;
  const costPaxg = (tr.rGross == null) ? null : (tr.entry * COST_PAXG_FRAC) / risk;
  if (tr.bothTouch) counters.bothTouch++;
  const sameBarExit = (tr.fillIdx != null && tr.exitIdx === tr.fillIdx);
  const pendingFill = /LIMIT|STOP/.test(String(tr.orderType || ''));
  const ambiguousWin = (tr.outcome === 'win' && sameBarExit && pendingFill);
  if (tr.outcome === 'win' && sameBarExit){
    counters.sameBarWins++;
    if (pendingFill) counters.sameBarAmbiguousWins++;
  }
  results.push({
    tISO: new Date(rows[tr.sigIdx].t * 1000).toISOString(),
    shadow: tr.shadow || undefined,
    stratKey: tr.stratKey, strategy: tr.strategy, dir: tr.dir,
    grade: tr.grade || null, tally: isFinite(tr.tally) ? tr.tally : null,
    demoted: !!tr.demoted, mp: !!tr.mp,
    stamps: tr.stamps && tr.stamps.length ? tr.stamps : undefined,
    killzone: tr.killzone || null,
    killzoneWeight: isFinite(tr.killzoneWeight) ? tr.killzoneWeight : 0,
    utcHour: new Date(rows[tr.sigIdx].t * 1000).getUTCHours(),
    entry: +tr.entry.toFixed(2), stop: +tr.stop.toFixed(2), t1: +tr.t1.toFixed(2),
    rr: isFinite(tr.rr) ? +(+tr.rr).toFixed(2) : null,
    stopAtr: isFinite(tr.stopAtr) ? +tr.stopAtr.toFixed(2) : null,
    orderType: tr.orderType,
    sameBarExit: sameBarExit || undefined,
    ambiguousSameBarWin: ambiguousWin || undefined,
    outcome: tr.outcome + (tr.bothTouch ? ' (both-touch)' : ''),
    rGross: tr.rGross == null ? null : +tr.rGross.toFixed(3),
    netR: tr.rGross == null ? null : +(tr.rGross - costXm).toFixed(3),
    netR_paxg: tr.rGross == null ? null : +(tr.rGross - costPaxg).toFixed(3),
    costR_xm: costXm == null ? null : +costXm.toFixed(3),
    costR_paxg: costPaxg == null ? null : +costPaxg.toFixed(3),
    barsHeld: tr.fillIdx == null ? null : (tr.exitIdx - tr.fillIdx),
    exitISO: tr.exitIdx == null ? null : new Date(rows[tr.exitIdx].t * 1000).toISOString()
  });
}

/* ==================== 4. THE WALK ==================== */

function sliceByCutoff(rows, tfSec, cutoffSec){
  let lo = 0, hi = rows.length;
  while (lo < hi){ const m = (lo + hi) >> 1; (rows[m].t + tfSec <= cutoffSec) ? lo = m + 1 : hi = m; }
  return rows.slice(0, lo);
}

function walk(W, m15, h1, h4, d1){
  const results = [];
  const active = new Map();       /* 'stratKey|dir' (+ 'SH:' prefix for shadow) */
  const counters = { scans: 0, issued: 0, merged: 0, noPlan: 0, badGeometry: 0,
                     rankRejected: 0, edgeSuppressed: 0, otherRejected: 0,
                     scanErrors: 0, openAtEnd: 0, bothTouch: 0,
                     sameBarWins: 0, sameBarAmbiguousWins: 0, shadowIssued: 0 };
  /* need the tab's own 15m depth + full 1h/4h/1d coverage before the walk */
  const needSec = Math.max(
    m15[0].t + DEPTH.m15 * 900,
    h4.length ? h4[0].t + DEPTH.h4 * 14400 : 0,
    h1.length ? h1[0].t + DEPTH.h1 * 3600 : 0,
    d1.length ? d1[0].t + DEPTH.d1 * 86400 : 0);
  let first = m15.findIndex(r => r.t + 900 >= needSec);
  if (first < 0){
    /* HTF depth exceeds the 15m window — walk with what exists (the live tab
       also runs on whatever depth the feed returned) but say so. */
    first = Math.min(m15.length - 1, DEPTH.m15);
    console.log('  WARN: HTF feeds shallower than tab depth over this window — walking from 15m bar ' + first);
  }
  const t0 = Date.now();
  for (let i = first; i < m15.length; i++){
    const bar = m15[i];
    /* 1. advance open trades (signals from earlier bars only) */
    for (const [key, tr] of active){
      if (tr.sigIdx >= i) continue;
      if (stepTrade(tr, bar, i)){
        settleRecord(tr, m15, counters, results);
        active.delete(key);
      }
    }
    /* 2. scan on the closed prefix */
    const cutoff = bar.t + 900;
    const now = cutoff * 1000;
    const inp = {
      rows15m: sliceByCutoff(m15, 900, cutoff).slice(-DEPTH.m15),
      rows1h: sliceByCutoff(h1, 3600, cutoff).slice(-DEPTH.h1),
      rows4h: sliceByCutoff(h4, 14400, cutoff).slice(-DEPTH.h4),
      dailyCandles: sliceByCutoff(d1, 86400, cutoff).slice(-DEPTH.d1),
      now, news: null, candleSource: 'binance-paxg'
    };
    let ranked = [], best = null, rejected = [];
    try {
      counters.scans++;
      const got = W.goldScalpSetups(inp) || [];
      const cands = Array.isArray(got) ? got : [];
      for (const c of cands){ if (c){ c.venue = 'BT PAXGUSDT'; c.sym = 'PAXGUSDT'; } }
      rejected = got.rejected || [];
      const ctx = { now, news: null, season: W.goldSeason(now), macro: null, spot: null,
                    fng: null, style: 'goldscalp', perpNative: null,
                    crossVenue: W.goldCrossVenueMap(cands) };
      const rk = W.goldRankSetups(cands, ctx) || { ranked: cands, best: null, rejected: [] };
      ranked = rk.ranked || [];
      best = rk.best || null;
      counters.rankRejected += (rk.rejected || []).length;
    } catch (e) { counters.scanErrors++; continue; }
    /* 3. main book — every ranked candidate, conviction-lock dedup */
    for (const c of ranked){
      if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
      const entry = +c.entry, stop = +c.stop, t1 = +c.t1;
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)){ counters.noPlan++; continue; }
      const long = c.dir === 'long';
      if (long && !(stop < entry && t1 > entry)){ counters.badGeometry++; continue; }
      if (!long && !(stop > entry && t1 < entry)){ counters.badGeometry++; continue; }
      const key = String(c.stratKey || c.strategy || '?') + '|' + c.dir;
      if (active.has(key)){ counters.merged++; continue; }
      counters.issued++;
      active.set(key, newTrade({
        stratKey: String(c.stratKey || '?'), strategy: c.strategy || null, dir: c.dir,
        grade: c.grade || null, tally: c.tally, demoted: !!c.demoted,
        mp: !!(best && best.id === c.id),
        stamps: Array.isArray(c.stamps) ? c.stamps.slice(0, 6) : [],
        killzone: c.killzone || null, killzoneWeight: c.killzoneWeight,
        rr: c.rr, stopAtr: (isFinite(c.atr) && c.atr > 0) ? Math.abs(entry - stop) / c.atr : NaN,
        entry, stop, t1,
        orderType: xmOrderType(c.dir, entry, +bar.c).name,
        sigIdx: i
      }));
    }
    /* 4. shadow book — EDGE-table-suppressed candidates with a full plan */
    for (const c of rejected){
      if (!c || c.dir !== 'long' && c.dir !== 'short') continue;
      const isEdge = Array.isArray(c.stamps) && c.stamps.indexOf('EDGE SUPPRESS') >= 0;
      if (!isEdge){ counters.otherRejected++; continue; }
      counters.edgeSuppressed++;
      const entry = +c.entry, stop = +c.stop, t1 = +c.t1;
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)) continue;
      const long = c.dir === 'long';
      if (long && !(stop < entry && t1 > entry)) continue;
      if (!long && !(stop > entry && t1 < entry)) continue;
      const key = 'SH:' + String(c.stratKey || '?') + '|' + c.dir;
      if (active.has(key)) continue;
      counters.shadowIssued++;
      active.set(key, newTrade({
        shadow: true,
        stratKey: String(c.stratKey || '?'), strategy: c.strategy || null, dir: c.dir,
        grade: null, tally: NaN, demoted: false, mp: false,
        stamps: ['EDGE SUPPRESS (shadow)'],
        killzone: null, killzoneWeight: NaN,
        rr: c.rr, stopAtr: (isFinite(c.atr) && c.atr > 0) ? Math.abs(entry - stop) / c.atr : NaN,
        entry, stop, t1,
        orderType: xmOrderType(c.dir, entry, +bar.c).name,
        sigIdx: i
      }));
    }
    if ((i - first) % 400 === 0){
      console.log('  bar ' + i + '/' + m15.length + ' · open ' + active.size
        + ' · settled ' + results.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
  }
  for (const tr of active.values()) counters.openAtEnd++;
  return { results, counters };
}

/* ==================== 5. aggregates (dual-cost) ==================== */

function agg(trades){
  const settled = trades.filter(t => t.netR != null);
  const wins = settled.filter(t => t.outcome.startsWith('win')).length;
  const sum = k => settled.reduce((s, t) => s + t[k], 0);
  return {
    n: settled.length,
    unfilled: trades.filter(t => t.outcome === 'unfilled').length,
    winRate: settled.length ? +(wins / settled.length).toFixed(3) : null,
    avgR_gross: settled.length ? +(sum('rGross') / settled.length).toFixed(3) : null,
    avgR_net_xm: settled.length ? +(sum('netR') / settled.length).toFixed(3) : null,
    avgR_net_paxg: settled.length ? +(sum('netR_paxg') / settled.length).toFixed(3) : null,
    sumR_net_xm: +sum('netR').toFixed(2)
  };
}

function groupAgg(trades, keyFn){
  const groups = {};
  for (const t of trades){ const k = keyFn(t); (groups[k] = groups[k] || []).push(t); }
  const out = {};
  for (const k of Object.keys(groups).sort()) out[k] = agg(groups[k]);
  return out;
}

/* ==================== 6. main ==================== */

console.log('=== GOLD SCALP tab backtest — ' + (SMOKE ? 'SMOKE RUN' : 'FULL RUN')
  + ' · ' + new Date().toISOString() + ' ===');
console.log('symbol ' + SYMBOL + ' · 15m bars ' + BARS_15M
  + ' · costs XM ' + (COST_XM_FRAC * 100).toFixed(3) + '% RT (primary) / PAXG '
  + (COST_PAXG_FRAC * 100).toFixed(2) + '% RT (sensitivity)');

const m15 = await cachedKlines(SYMBOL, '15m', BARS_15M);
const h1 = await cachedKlines(SYMBOL, '1h', Math.max(DEPTH.h1 + Math.ceil(BARS_15M / 4) + 8, 1200));
const h4 = await cachedKlines(SYMBOL, '4h', Math.max(DEPTH.h4 + Math.ceil(BARS_15M / 16) + 8, 600));
const d1 = await cachedKlines(SYMBOL, '1d', Math.max(DEPTH.d1 + Math.ceil(BARS_15M / 96) + 4, 330));

console.log('booting goldind.js in vm sandbox...');
const W = boot();

console.log('walking GOLD SCALP pipeline on the 15m grid (' + m15.length + ' bars)...');
const { results, counters } = walk(W, m15, h1, h4, d1);

const main = results.filter(t => !t.shadow);
const shadow = results.filter(t => t.shadow);
const aggregates = {
  overall: agg(main),
  byStrategy: groupAgg(main, t => t.stratKey),
  byGrade: groupAgg(main, t => (t.demoted ? 'demoted-' : '') + (t.grade || '?')),
  byDirection: groupAgg(main, t => t.dir),
  byKillzone: groupAgg(main, t => t.killzone ? String(t.killzone).split(' · ')[0] : 'OFF-SESSION'),
  byUtcSession: groupAgg(main, t => {
    const h = t.utcHour;
    return h < 7 ? 'ASIA(00-07)' : h < 12 ? 'LONDON(07-12)' : h < 17 ? 'NY-OVERLAP(12-17)' : 'NY-LATE(17-24)';
  }),
  mpOnly: agg(main.filter(t => t.mp)),
  leadEligible: agg(main.filter(t => !t.demoted)),
  demotedOnly: agg(main.filter(t => t.demoted)),
  shadowSuppressed: {
    note: 'EDGE-table-suppressed kinds walked separately — NEVER pooled with the main book; '
      + 'they test whether the bridge-era suppressions hold on the tab pipeline',
    overall: agg(shadow),
    byStrategy: groupAgg(shadow, t => t.stratKey)
  }
};

const settledAll = main.filter(t => t.netR != null);
const winsAll = settledAll.filter(t => t.outcome.startsWith('win'));
const exAmbig = settledAll.filter(t => !t.ambiguousSameBarWin);
const exAmbigWins = exAmbig.filter(t => t.outcome.startsWith('win'));

const meta = {
  generated: new Date().toISOString(),
  mode: SMOKE ? 'smoke' : 'full',
  symbol: SYMBOL,
  universe: 'PAXGUSDT Binance spot proxy for XAUUSD (basis ~0.1-0.5%; 24/7 weekend bars a broker never printed)',
  pipeline: 'goldScalpSetups -> goldRankSetups per closed 15m bar (the GOLD SCALP tab path, not the OMNIGOLD bridge)',
  bars: { m15: m15.length, h1: h1.length, h4: h4.length, d1: d1.length },
  span: m15.length ? { from: new Date(m15[0].t * 1000).toISOString(), to: new Date(m15[m15.length - 1].t * 1000).toISOString() } : null,
  feedDepths: DEPTH,
  costs: {
    xm: { rtFrac: COST_XM_FRAC, basis: 'XM XAUUSD $0.35 spread / $3500 ref + 0.010% slip = 0.020% RT (hgOgVenuePresetCost constants)' },
    paxg: { rtFrac: COST_PAXG_FRAC, basis: 'PAXG spot 0.1% taker + 0.03% slip per side = 0.26% RT' },
    primary: 'xm — the scalp desk quotes broker-aligned XAUUSD (goldscalp.js:1506); netR is XM, netR_paxg the sensitivity'
  },
  rules: {
    cadence: 'scan on every closed 15m bar; now = bar close instant (killzone/session read the bar clock, zero lookahead)',
    dedup: 'one live trade per (stratKey, dir) — conviction-lock merge semantics; re-issues while live are counted as merged',
    fill: 'pending order at entry from bar i+1; type via xmOrderType; touch via ogXmBarTouchesEntry; unfilled after 24 bars (6h TTL) != loss',
    resolution: 'first touch stop vs t1 after fill; both-touch bar = LOSS; 96 bars (24h) after fill -> timeout MTM at close',
    stops: 'touch-based (stricter than the live tab, which stops on a 15m CLOSE beyond the stop)'
  },
  deviations: [
    'live-only feeds absent (macro/DXY/US10Y, news calendar, goldspot basis, F&G, GOLD PRO, perp funding/OI, L2/tick): every consumer feature-checks and degrades exactly as a live fetch failure does; macro tilt / news +-2 tally legs and the MACRO/NEWS/SPREAD gates never fire here',
    'hgFilterGoldPostGate and hgApplyGoldBestLevels are browser-side modules not loaded offline: post-gate filtering and best-levels refinement are not applied (candidates carry raw engine levels)',
    'goldRankSetups ctx carries no candle rows — same as the live tab (goldscalp.js:1344): the hgGoldApplyConfluence core-confluence leg degrades identically live and offline',
    'single venue (PAXG proxy): cross-venue confirmation (+2) can never fire; XAUT leg is removed in the live tab too',
    'conviction merge is anchor-distance-based live (0.5xATR); here any same-(stratKey,dir) signal while a trade is live is a merge — slightly coarser',
    'weekend PAXG bars exist; the live desk quotes a broker feed that gaps weekends — session/killzone cohorts include phantom weekend bars'
  ],
  limitations: [
    'SAME-BAR FILL->TARGET OPTIMISM: ' + counters.sameBarWins + ' of ' + winsAll.length
      + ' wins settle on the fill bar; ' + counters.sameBarAmbiguousWins
      + ' are LIMIT/STOP fills where OHLC cannot prove order-of-touch — resolved pro-strategy. Win rate '
      + (settledAll.length ? (winsAll.length / settledAll.length * 100).toFixed(1) : '-') + '% -> '
      + (exAmbig.length ? (exAmbigWins.length / exAmbig.length * 100).toFixed(1) : '-')
      + '% excluding ambiguous same-bar wins. Both-touch bars ARE losses (' + counters.bothTouch + ').',
    'PORTFOLIO STATS NOT ATTAINABLE: every signal walks at 1R with unlimited concurrency; read per-trade expectancy and per-group rows only',
    'grades A/B depend on tally legs that need live feeds (macro/news/positioning); offline tallies are structurally lower, so grade cohorts compress toward C — read the grade LADDER (ordering), not absolute counts'
  ],
  counters
};

fs.writeFileSync(OUT_FILE, JSON.stringify({ meta, aggregates, trades: results }, null, 1));

/* ---------- console table ---------- */
const pad = (s, n) => String(s == null ? '-' : s).padEnd(n);
const rpad = (s, n) => String(s == null ? '-' : s).padStart(n);
function printAgg(title, obj){
  console.log('\n--- ' + title + ' ---');
  console.log(pad('group', 26) + rpad('n', 6) + rpad('unfil', 7) + rpad('win%', 7)
    + rpad('avgR(g)', 9) + rpad('net@XM', 9) + rpad('net@PAXG', 10) + rpad('sumR@XM', 9));
  for (const k of Object.keys(obj)){
    const a = obj[k];
    if (!a || typeof a.n !== 'number') continue;
    console.log(pad(k, 26) + rpad(a.n, 6) + rpad(a.unfilled, 7)
      + rpad(a.winRate == null ? '-' : (a.winRate * 100).toFixed(0) + '%', 7)
      + rpad(a.avgR_gross, 9) + rpad(a.avgR_net_xm, 9) + rpad(a.avgR_net_paxg, 10)
      + rpad(a.sumR_net_xm, 9));
  }
}
console.log('\n=== RESULTS (' + meta.mode + ') · main ' + main.length + ' (settled ' + aggregates.overall.n
  + ') · shadow ' + shadow.length + ' · merged ' + counters.merged
  + ' · scanErrors ' + counters.scanErrors + ' ===');
printAgg('overall (main book)', { ALL: aggregates.overall, 'MP-only': aggregates.mpOnly,
  'lead-eligible': aggregates.leadEligible, 'demoted-only': aggregates.demotedOnly });
printAgg('by strategy', aggregates.byStrategy);
printAgg('by grade', aggregates.byGrade);
printAgg('by direction', aggregates.byDirection);
printAgg('by killzone', aggregates.byKillzone);
printAgg('by UTC session', aggregates.byUtcSession);
printAgg('SHADOW — currently EDGE-suppressed kinds (never pooled)', aggregates.shadowSuppressed.byStrategy);
console.log('\nSTATED LIMITATIONS:');
for (const lim of meta.limitations) console.log('  * ' + lim);
console.log('\nwritten: ' + OUT_FILE);
