/* HARDGATE — GOLD SWING tab backtest harness (offline, node ESM).
   Run:  node scripts/backtest-goldswing.mjs [--smoke] [--bars=N] [--refresh]

   WHAT THIS REPLAYS
   -----------------
   The GOLD SWING tab's OWN inline engine, per closed 4h bar, zero lookahead:
     goldSwingSetups(inp)  (goldswing.js:2395)
       -> buildCandidates (goldswing.js:1441) — 4h/1d strategy composition
       -> rankSetups (goldswing.js:2422) -> window.goldRankSetups
          (goldind.js:3608) — goldind.js is loaded FIRST in the vm so the
          real ranker, hgGoldPlanSidesOk and hgGoldSetupEdgeApply({swing:true})
          (applied inside mkCand, goldswing.js:1711-1712) run exactly as live.
   This is the engine the tab itself exports (W.goldSwingSetups,
   goldswing.js:3420) — NOT the OMNIGOLD bridge. The baked SWING rows of
   HG_GOLD_SETUP_EDGE (goldind.js:1184-1195) still come from the bridge
   replay (n as small as 1, PAXG costs); this harness measures the tab's own
   pipeline at the venue the tab actually quotes (XM XAUUSD), with PAXG
   costs as the sensitivity row.

   FIDELITY TO THE LIVE TAB
   ------------------------
   - inp mirrors the tab's feeds: rows4h x220 (KL_4H, goldswing.js:108),
     rows1d x260 (KL_1D). MIN_4H=60 is the engine's own floor
     (goldswing.js:109) — the walk only scans once 220 closed 4h bars exist.
   - `now` is the CLOSED 4h bar's close instant ((t+14400)*1000) — the
     session gate (hgGoldSessionGate, goldind.js:7159 — ASIA demotion via
     hgGoldInstFilter's swing path, goldind.js:7263-7282) and every news/
     killzone consumer read the bar's own clock, never the wall clock.
   - season = goldSeason(now) (goldind.js:745) — pure date math, bar clock.
   - live-only feeds (getGoldMacro, hgNewsState, goldspotState, S.fng,
     goldProState, binanceFunding, Delta perpNative OI/funding, L2/tick/
     spread, US10Y candles) are absent offline: passed null/undefined so
     each consumer feature-checks and degrades exactly as a live fetch
     failure would. Every degradation is listed in meta.deviations with the
     module line it mirrors.
   - runScan-only pipeline stages are NOT part of goldSwingSetups and are
     not replayed (deviations list them with lines): the 7-step 1h leg,
     sweep/NY-exhaustion/sweep→OB/silver-bullet/PART4-7/SMC/VP stamp passes
     (goldswing.js:2775-2978), hgFilterGoldPostGate (3031), weekend demotes
     (3046), best-levels/formation ticket batch (3072-3111), spot alignment
     (3118), the conviction-lock level restore (3125) and the A+ batch.

   SELECTION / DEDUP (conviction-lock semantics)
   ---------------------------------------------
   One live trade per (stratKey|dir). The tab pins issued setups under
   'hgGoldswingConviction' (goldswing.js:557) and MERGES matching re-issues
   (same dir + compatible stratKey with anchors within 0.5xATR,
   conviction-lock.js:426-449) while restoring ORIGINAL levels verbatim — so
   a signal for a key with a pending/filled trade here is a re-confirmation,
   counted as merged, never a new trade. Our key is coarser than the lock's
   anchor-distance merge (deviation, stated).

   OUTCOME RESOLUTION (LIB semantics: lib/omnigold-xm-bot-backtest.mjs)
   --------------------------------------------------------------------
   - signal fires on the CLOSE of a 4h bar; fills searched on the 1h grid
     from the next 1h bar (finer first-touch resolution than the tab's own
     4h-close invalidation — stricter, deliberate, stated as a deviation)
   - pending order at entry; type from xmOrderType(dir, entry, close4h);
     fill test = ogXmBarTouchesEntry (shared lib)
   - unfilled after 120 x 1h bars (5 days = CONVICTION_TTL_MS,
     goldswing.js:558 — the tab's own EXPIRED horizon) is NOT a loss
   - after the fill: first touch of stop vs t1; both in one 1h bar = LOSS
     (conservative); 120 x 1h bars (5 days) after the fill -> 'timeout',
     mark-to-market at close. NOTE the tab's EXPIRED clock is anchored at
     ISSUE, not fill (deviation, stated).
   - the live tab STOPS on a 4h CLOSE beyond the stop (wick-through
     survives live); touch-based 1h stops here are stricter. Deliberate.

   COSTS (venue-true — the v536 OMNIGOLD lesson)
   ---------------------------------------------
   PRIMARY netR at XM XAUUSD: $0.35 spread / $3500 ref spot + 0.010% slip
   = 0.020% round trip (hgOgVenuePresetCost constants). SENSITIVITY netR at
   PAXG spot: 0.1% taker + 0.03% slip per side = 0.26% RT. Both on every
   trade and aggregate row. stopAtr = |entry-stop| / candidate.atr (the 4h
   ATR14 the engine itself carried, goldswing.js:1690) is recorded on every
   trade — it exposes the engine-plan tight-stop override class (stops under
   the tab's own 1.5xATR floor, goldswing.js:1352 / goldind.js:7269).

   SHADOW BOOK
   -----------
   Rejected candidates carrying an 'EDGE SUPPRESS' stamp (or a replay-
   suppress reason) with a finite entry/stop/t1 walk in a separate shadow
   ledger, never pooled. The SWING edge table currently has NO suppress
   rows (goldind.js:1184-1195 — prefer/demote only), and goldSwingSetups'
   returned .rejected rows are minimal {id,stratKey,dir,reason} objects
   (buildCandidates' full side-channel is not forwarded by rankSetups), so
   the shadow book is expected EMPTY — the mechanism is kept and counted so
   a future suppress row is picked up automatically.

   DATA: PAXGUSDT Binance spot 1h/4h/1d (same proxy + cache as
   backtest-goldscalp.mjs; basis vs XAU ~0.1-0.5%, 24/7 weekend bars a
   broker never printed — session cohorts include phantom weekend bars).
   Style: modeled on scripts/backtest-goldscalp.mjs. No new dependencies. */

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
const BARS_1H = +opt('--bars', SMOKE ? 700 : 3960);
/* smoke runs write to their own file so a full-run artifact can never be
   silently overwritten */
const OUT_FILE = path.join(ROOT, 'scripts',
  SMOKE ? 'backtest-goldswing-smoke-results.json' : 'backtest-goldswing-results.json');

/* ---------- constants ---------- */
const SYMBOL = 'PAXGUSDT';
/* the tab's own feed depths (goldswing.js:108) */
const DEPTH = { h4: 220, d1: 260 };
const FILL_WINDOW = 120;          /* 1h bars = 5 days — CONVICTION_TTL_MS (goldswing.js:558) */
const TIMEOUT_BARS = 120;         /* 1h bars = 5 days after the fill, MTM exit (same tab horizon; tab anchors it at issue) */
/* venue-true round-trip costs, fraction of entry */
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;      /* 0.020% — XM XAUUSD */
const COST_PAXG_FRAC = 2 * (0.0010 + 0.0003);          /* 0.26% — PAXG spot  */

/* ==================== 1. DATA — Binance spot klines, cached ==================== */

const IV_SEC = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-goldswing-backtest/1.0' } });
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

/* ==================== 2. BOOT goldind.js + goldswing.js in a vm sandbox ==================== */

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
  /* goldind.js FIRST so goldswing.js's rankSetups finds window.goldRankSetups
     and mkCand finds hgGoldInstFilter / hgGoldSetupEdgeApply / the detectors —
     the exact live load order (goldswing.js header: "loads AFTER goldind.js"). */
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8'), ctx, { filename: 'goldind.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldswing.js'), 'utf8'), ctx, { filename: 'goldswing.js' });
  for (const fn of ['goldSwingSetups', 'goldRankSetups', 'goldSeason', 'goldCrossVenueMap',
                    'hgGoldSetupEdgeApply', 'hgGoldPlanSidesOk']){
    if (typeof ctx[fn] !== 'function') throw new Error('boot failed: ' + fn + ' is not a function');
  }
  return ctx;
}

/* ==================== 3. trade lifecycle (same walk as backtest-goldscalp) ==================== */

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
  if (isFinite(tr.stopAtr) && tr.stopAtr < 1.5 - 1e-9 && !tr.shadow) counters.stopUnderFloor++;
  results.push({
    tISO: new Date(rows[tr.sigIdx].t * 1000).toISOString(),
    shadow: tr.shadow || undefined,
    stratKey: tr.stratKey, strategy: tr.strategy, dir: tr.dir,
    grade: tr.grade || null, tally: isFinite(tr.tally) ? tr.tally : null,
    demoted: !!tr.demoted, mp: !!tr.mp,
    stamps: tr.stamps && tr.stamps.length ? tr.stamps : undefined,
    edgeAction: tr.edgeAction || null,
    session: tr.session || null,
    sessionWeight: isFinite(tr.sessionWeight) ? tr.sessionWeight : null,
    agree: isFinite(tr.agree) ? tr.agree : null,
    oppose: isFinite(tr.oppose) ? tr.oppose : null,
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

function walk(W, h1, h4, d1){
  const results = [];
  const active = new Map();       /* 'stratKey|dir' (+ 'SH:' prefix for shadow) */
  const counters = { scans: 0, warmupSkips: 0, issued: 0, merged: 0, noPlan: 0, badGeometry: 0,
                     rankRejected: 0, edgeSuppressed: 0, otherRejected: 0,
                     scanErrors: 0, openAtEnd: 0, bothTouch: 0,
                     sameBarWins: 0, sameBarAmbiguousWins: 0,
                     shadowIssued: 0, shadowSkippedNoPlan: 0, stopUnderFloor: 0 };
  /* every 4h close instant present in the 4h series */
  const h4CloseSet = new Set(h4.map(r => r.t + 14400));
  const t0 = Date.now();
  let scanned = 0;
  for (let i = 0; i < h1.length; i++){
    const bar = h1[i];
    /* 1. advance open trades on the 1h grid (signals from earlier bars only) */
    for (const [key, tr] of active){
      if (tr.sigIdx >= i) continue;
      if (stepTrade(tr, bar, i)){
        settleRecord(tr, h1, counters, results);
        active.delete(key);
      }
    }
    /* 2. scan only when a 4h bar just closed */
    const cutoff = bar.t + 3600;
    if (!h4CloseSet.has(cutoff)) continue;
    const h4Prefix = sliceByCutoff(h4, 14400, cutoff);
    if (h4Prefix.length < DEPTH.h4){ counters.warmupSkips++; continue; }
    const now = cutoff * 1000;
    const lastClose4h = +h4Prefix[h4Prefix.length - 1].c;
    const inp = {
      rows4h: h4Prefix.slice(-DEPTH.h4),
      rows1d: sliceByCutoff(d1, 86400, cutoff).slice(-DEPTH.d1),
      now,
      /* live-only feeds absent — null so every consumer degrades like a
         failed live fetch (see meta.deviations) */
      news: null, macro: null, spot: null, fng: null,
      fundingRate: null, goldPro: null,
      season: W.goldSeason(now)
    };
    let ranked = [], best = null, rejected = [];
    try {
      counters.scans++;
      const rk = W.goldSwingSetups(inp) || { ranked: [], best: null, rejected: [] };
      ranked = rk.ranked || [];
      best = rk.best || null;
      rejected = rk.rejected || [];
      counters.rankRejected += rejected.length;
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
        stamps: Array.isArray(c.stamps) ? c.stamps.slice(0, 8) : [],
        edgeAction: (c.edge && c.edge.action) || null,
        session: (c.sessionGate && c.sessionGate.session) || null,
        sessionWeight: c.sessionWeight,
        agree: c.agree, oppose: c.oppose,
        rr: c.rr, stopAtr: (isFinite(c.atr) && c.atr > 0) ? Math.abs(entry - stop) / c.atr : NaN,
        entry, stop, t1,
        orderType: xmOrderType(c.dir, entry, lastClose4h).name,
        sigIdx: i
      }));
    }
    /* 4. shadow book — EDGE-suppressed rejects with a full plan.
       NOTE: the swing edge table has no suppress rows (goldind.js:1184-1195)
       and goldSwingSetups' rejected rows are minimal (no levels), so this
       stays empty today — the mechanism is kept for future suppress rows. */
    for (const c of rejected){
      if (!c || (c.dir !== 'long' && c.dir !== 'short')){ counters.otherRejected++; continue; }
      const isEdge = (Array.isArray(c.stamps) && c.stamps.indexOf('EDGE SUPPRESS') >= 0)
        || /replay suppress|stays suppressed/i.test(String(c.reason || ''));
      if (!isEdge){ counters.otherRejected++; continue; }
      counters.edgeSuppressed++;
      const entry = +c.entry, stop = +c.stop, t1 = +c.t1;
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)){ counters.shadowSkippedNoPlan++; continue; }
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
        edgeAction: 'suppress',
        session: null, sessionWeight: NaN, agree: NaN, oppose: NaN,
        rr: c.rr, stopAtr: (isFinite(c.atr) && c.atr > 0) ? Math.abs(entry - stop) / c.atr : NaN,
        entry, stop, t1,
        orderType: xmOrderType(c.dir, entry, lastClose4h).name,
        sigIdx: i
      }));
    }
    scanned++;
    if (scanned % 100 === 0){
      console.log('  scan ' + scanned + ' (1h bar ' + i + '/' + h1.length + ') · open ' + active.size
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

console.log('=== GOLD SWING tab backtest — ' + (SMOKE ? 'SMOKE RUN' : 'FULL RUN')
  + ' · ' + new Date().toISOString() + ' ===');
console.log('symbol ' + SYMBOL + ' · 1h settlement bars ' + BARS_1H
  + ' · costs XM ' + (COST_XM_FRAC * 100).toFixed(3) + '% RT (primary) / PAXG '
  + (COST_PAXG_FRAC * 100).toFixed(2) + '% RT (sensitivity)');

/* targets sized to the existing .bt-cache (1h x3999 / 4h x1061 / 1d x401) so
   no refetch is needed; the walk starts once 220 closed 4h bars exist. */
const h1 = await cachedKlines(SYMBOL, '1h', BARS_1H);
const h4 = await cachedKlines(SYMBOL, '4h', 1060);
const d1 = await cachedKlines(SYMBOL, '1d', 400);

console.log('booting goldind.js + goldswing.js in vm sandbox...');
const W = boot();

console.log('walking GOLD SWING pipeline — scan per closed 4h bar, settle on the 1h grid ('
  + h1.length + ' 1h bars)...');
const { results, counters } = walk(W, h1, h4, d1);

const main = results.filter(t => !t.shadow);
const shadow = results.filter(t => t.shadow);
const aggregates = {
  overall: agg(main),
  byStrategy: groupAgg(main, t => t.stratKey),
  byGrade: groupAgg(main, t => (t.demoted ? 'demoted-' : '') + (t.grade || '?')),
  byDirection: groupAgg(main, t => t.dir),
  bySession: groupAgg(main, t => t.session || 'n/a'),   /* hgGoldSessionGate cohort (bar clock) */
  byUtcSession: groupAgg(main, t => {
    const h = t.utcHour;
    return h < 7 ? 'ASIA(00-07)' : h < 12 ? 'LONDON(07-12)' : h < 17 ? 'NY-OVERLAP(12-17)' : 'NY-LATE(17-24)';
  }),
  byEdgeAction: groupAgg(main, t => t.edgeAction || 'no-row'),
  mpOnly: agg(main.filter(t => t.mp)),
  leadEligible: agg(main.filter(t => !t.demoted)),
  demotedOnly: agg(main.filter(t => t.demoted)),
  shadowSuppressed: {
    note: 'EDGE-table-suppressed kinds walked separately — NEVER pooled with the main book. '
      + 'The SWING edge table has no suppress rows today (goldind.js:1184-1195) so this is '
      + 'expected empty; the mechanism stays armed for future suppress rows.',
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
  pipeline: 'goldSwingSetups(inp) per closed 4h bar (goldswing.js:2395 — buildCandidates -> goldRankSetups via goldind.js, hgGoldSetupEdgeApply({swing:true}) inside mkCand); outcomes settled on the 1h grid',
  bars: { h1: h1.length, h4: h4.length, d1: d1.length },
  span: h1.length ? { from: new Date(h1[0].t * 1000).toISOString(), to: new Date(h1[h1.length - 1].t * 1000).toISOString() } : null,
  feedDepths: DEPTH,
  costs: {
    xm: { rtFrac: COST_XM_FRAC, basis: 'XM XAUUSD $0.35 spread / $3500 ref + 0.010% slip = 0.020% RT (hgOgVenuePresetCost constants)' },
    paxg: { rtFrac: COST_PAXG_FRAC, basis: 'PAXG spot 0.1% taker + 0.03% slip per side = 0.26% RT' },
    primary: 'xm — the swing tab quotes broker-aligned XAUUSD (goldswing.js:2993 "gold swing uses broker-aligned XAUUSD spot only"); netR is XM, netR_paxg the sensitivity'
  },
  rules: {
    cadence: 'scan on every closed 4h bar; now = the 4h bar close instant ((t+14400)*1000) — session gate / news / season read the bar clock, zero lookahead; outcomes settle on the 1h grid for finer first-touch resolution',
    dedup: 'one live trade per (stratKey, dir) — conviction-lock merge semantics (hgGoldswingConviction, goldswing.js:557); re-issues while live are counted as merged',
    fill: 'pending order at entry from the next 1h bar; type via xmOrderType(dir, entry, 4h close); touch via ogXmBarTouchesEntry; unfilled after 120 x 1h bars (5-day CONVICTION_TTL_MS, goldswing.js:558) != loss',
    resolution: 'first touch stop vs t1 after fill on 1h bars; both-touch bar = LOSS; 120 x 1h bars (5 days) after fill -> timeout MTM at close',
    stops: 'touch-based on 1h bars (stricter than the live tab, which transitions STOPPED only on a 4h CLOSE beyond the stop — wick-through survives live)',
    stopAtr: 'stopAtr = |entry-stop| / candidate.atr (the engine\'s own 4h ATR14, goldswing.js:1690); the tab\'s floor is 1.5xATR (goldswing.js:1352, stopFloorAtr goldind.js:7269) — stopUnderFloor counts violations from engine-plan overrides'
  },
  deviations: [
    'live-only feeds absent, passed null so each consumer degrades exactly as a live fetch failure: getGoldMacro (goldswing.js:2651-2655) -> macro tilt +-2 rank leg, mkCand macro-vs-daily-stack suppressions (goldswing.js:1638-1648) and the MACRO-ALIGNED TREND CONTINUATION strategy (needs realRateHint, goldswing.js:1820-1837) never fire; hgNewsState (2608-2610) -> news -2 leg, tier-1 mint lock and grade demotion never fire; goldspotState -> positioning +-1 leg off; S.fng -> risk-sentiment +1 leg off; goldProState -> GOLD PRO +-2 leg and conflict demote off; binanceFunding -> funding leg off; Delta perpNative OI/funding (2656-2680) -> OI-trap/funding stamps off; L2/tick/spread/US10Y micro feeds -> __swMicroVeto (goldind.js:3196) and spread lock degrade to pass',
    'runScan-only pipeline stages are not part of goldSwingSetups and are not replayed: 7-step 1h leg (goldswing.js:2736-2748), sweep/NY-exhaustion/sweep-to-OB/silver-bullet/PART4-7/SMC/VP stamp+demote passes (2775-2978), hgFilterGoldPostGate (3031-3045), weekend demotes (3046-3056), best-levels/formation ticket batch (3072-3111), spot alignment (3118-3120), conviction-lock level restore (3122-3132), A+ batch (3177-3178) — candidates carry the inline engine\'s own levels',
    'indicators.js not loaded: _atr/_ema fall back to the module-local copies (goldswing.js:393-394) the header documents as identical to goldind.js\'s own fallbacks',
    'hgGoldGradeFromScore (gold-best-levels.js:542) not loaded: goldRankSetups uses its inline fallback with IDENTICAL thresholds (goldind.js:3840-3843); mkCand\'s pre-rank fallback grades A at agree>=8 vs 7 live (goldswing.js:1672-1673) but the rank grade overwrites it',
    'hgSetupSolidityApply (setup-solidity.js), hgProfitRankHint (scorecard.js) and window.__hgGoldCot absent: solidity never gates MOST PROBABLE (solidityBookOk undefined passes, goldind.js:3930), scorecard-expectancy and COT-crowding tally legs never fire',
    'HG_GOLD_T1_R/T2_R/T3_R from plans.js not loaded — the local defaults are the same values (1.5/2.5/4.0, plans.js:2064-2066): no ladder drift',
    'settlement on the 1h grid with touch-based stops vs the tab\'s own 4h-close invalidation (goldswing.js:11-13, conviction-lock evaluateSetup is4h) — stricter on stops, finer on fills; deliberate',
    'timeout is anchored 120 x 1h bars AFTER THE FILL; the tab\'s EXPIRED transition is anchored at ISSUE (5 days from issuedAt, goldswing.js:558) — a late fill lives longer here than the tab\'s card would',
    'dedup key is (stratKey|dir); the live lock merges on anchor distance <=0.5xATR across compatible stratKeys and keys venue-scoped ids (conviction-lock.js:406-449) — slightly coarser here',
    'single venue (PAXG proxy): cross-venue confirmation (+2) can never fire — matches live (the tab skips the Delta XAUT leg, goldswing.js:2993); weekend PAXG bars exist, so session cohorts include phantom weekend bars a broker never printed'
  ],
  limitations: [
    'SAME-BAR FILL->TARGET OPTIMISM: ' + counters.sameBarWins + ' of ' + winsAll.length
      + ' wins settle on the fill bar; ' + counters.sameBarAmbiguousWins
      + ' are LIMIT/STOP fills where OHLC cannot prove order-of-touch — resolved pro-strategy. Win rate '
      + (settledAll.length ? (winsAll.length / settledAll.length * 100).toFixed(1) : '-') + '% -> '
      + (exAmbig.length ? (exAmbigWins.length / exAmbig.length * 100).toFixed(1) : '-')
      + '% excluding ambiguous same-bar wins. Both-touch 1h bars ARE losses (' + counters.bothTouch + ').',
    'PORTFOLIO STATS NOT ATTAINABLE: every signal walks at 1R with unlimited concurrency; read per-trade expectancy and per-group rows only',
    'grades A/B depend on tally legs that need live feeds (macro/news/positioning/GOLD PRO/funding); offline tallies are structurally lower, so grade cohorts compress toward C — read the grade LADDER (ordering), not absolute counts',
    'the SWING edge rows this harness can retire/confirm were baked from the OMNIGOLD bridge replay at n<=6 (goldind.js:1136,1184-1195) — this run measures the tab\'s own pipeline at the desk\'s venue'
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
  + ' · scanErrors ' + counters.scanErrors + ' · stopUnderFloor ' + counters.stopUnderFloor + ' ===');
printAgg('overall (main book)', { ALL: aggregates.overall, 'MP-only': aggregates.mpOnly,
  'lead-eligible': aggregates.leadEligible, 'demoted-only': aggregates.demotedOnly });
printAgg('by strategy', aggregates.byStrategy);
printAgg('by grade', aggregates.byGrade);
printAgg('by direction', aggregates.byDirection);
printAgg('by session gate (bar clock)', aggregates.bySession);
printAgg('by UTC session', aggregates.byUtcSession);
printAgg('by edge action (baked table)', aggregates.byEdgeAction);
printAgg('SHADOW — EDGE-suppressed kinds (never pooled; expected empty)', aggregates.shadowSuppressed.byStrategy);
console.log('\nSTATED LIMITATIONS:');
for (const lim of meta.limitations) console.log('  * ' + lim);
console.log('\nwritten: ' + OUT_FILE);
