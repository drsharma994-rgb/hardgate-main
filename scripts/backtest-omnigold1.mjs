/* HARDGATE — OMNIGOLD 1 tab backtest harness (offline, node ESM).
   Run:  node scripts/backtest-omnigold1.mjs [--smoke] [--scan-bars=N] [--bars=N] [--offline]

   TWO LANES IN ONE FILE:

   LANE 1 (committed evidence, unchanged): the hgOg1Replay sweep→reclaim
   filter-combo sweep the old harness ran — raw / minRisk / minDisp / gated /
   gated+bias / +ob / +node / disp0.75 / disp1.00 over PAXG 1h bars with a
   22:00-UTC-anchored derived 4h context. Output shape preserved verbatim
   (variants / bestNamed / apply). `--bars=N` keeps its old meaning: the
   sweep's 1h bar count.

   LANE 2 (NEW — the lane the tab actually trades today, post hg-v698):

   WHAT THIS REPLAYS
   -----------------
   The OMNIGOLD 1 tab's OWN composition path, per closed 1h bar, zero
   lookahead: hgOg1Engine({horizon:'SWING'}) + hgOg1Engine({horizon:'SCALP'})
   — exactly what runScan calls (omnigold1.js:1539-1540). Candidates are the
   rendered setup cards (out.candidates, omnigold1.js:477): swept-pool
   sweeps/S37/S3 built by buildCand (505), scored by the 20-point matrix
   (543), decided by decide() (762) which applies the SHARED GOLD FORMATION
   LAST (806-821): og1Confirmations maps matrix families into the shared
   confluence classes via hgGoldConfluenceFromMatrix with the two
   PLACEABILITY rows ('Clean Path', 'Volatility & Target Realism') excluded
   from evidence (gold-formation.js:199-202), the session leg re-decided on
   the SIGNAL BAR's open instant via hgGoldApplySessionLeg/hgGoldSignalBarMs
   (omnigold1.js:724-730), and hgGoldFormation runs the venue stop floor /
   kind demotion / KILL-LIST / measured-edge / catalog checks through
   hgOgFormation (omnigold.js:7524). A non-formed candidate is capped at
   grade C (omnigold1.js:1094-1100) and can never QUALIFY (813-820).
   hgOg1Replay is NOT this lane: the tab attaches it only as the
   'MEASURED, NOT CLAIMED' sanity lines (omnigold1.js:497-499, 1432-1449).

   FIDELITY TO THE LIVE TAB
   ------------------------
   - vm boot = the index.html module stack the tab needs (load order proven
     by tests/test-v698-gold-formation.mjs CORE): indicators/fixpack14/plans/
     hg-mechanics/hg-forward/hg-gates/hg-plan/formation/hg-solidity/
     backtest-tab-params/gold-session/goldind/gold-catalog/gold-formation/
     omniroute/omnigold + gold-seven-step + omnigold1.
   - inp mirrors loadInputs (omnigold1.js:1507-1528): rows1h x400
     (hgGoldSevenStepLoad1h(400), :1512), rows15m x200 (:1513), rows4h x220
     (:1514); the tab loads NO 1d leg. venue = 'Delta XAUTUSD' (:1525, the
     tab's unconditional default) so ctx.isPerp is true exactly as live.
     tape = hgGoldUniformTape(closedRows(rows4h)) (:1524) — bar-derived, so
     it is computed here too (keyed on the bar clock, not Date.now()).
   - `now` is the CLOSED 1h bar's close instant ((t+3600)*1000): veto stack,
     goldSession, session-leg cohort and trigger all read that clock.
   - HG_OG_VENUE='XM' — the mounted desk default (HG_OG_VENUE_UI_DEFAULT,
     omnigold.js:6784; hgOgVenueInit:6861-6875). An UNMOUNTED sandbox would
     fail closed to PAXG 0.26% RT and stop-floor nearly every OG1 stop at
     8x0.26% = 2.08%; the live tab prices the floor at XM 0.020% (0.16%).
   - HG_OG1_FORM_EDGE read from scripts/formation-nightly.json and clamped
     exactly as formation-nightly.js:88-98/184 does (never below $5 / 0.5).
   - live-only feeds absent (macro/DXY/US10Y, news calendar, bid/ask spread,
     GVZ/COT/walls/weekly/ML/xag/gdxRs/fedwatch/realYield, funding/OI,
     equity/stopsToday/trader): every consumer feature-checks and degrades
     exactly as a live fetch failure does — see meta.deviations.

   SELECTION / DEDUP
   -----------------
   EVERY rendered candidate card with a full plan walks; cohorts split on
   the tab's own flags: verdict.qualifies (ticket), gradeInfo.tradeReady
   (grade A/B+/B — what hgOg1ForwardRecord records, omnigold1.js:1361-1368),
   formation state (FORMED/WATCH/STOOD-ASIDE/KILLED), BEST #1-3
   (hgOg1BestSetups, mirroring runScan:1550) and MP (hgOg1MostProbable).
   One live trade per (horizon|sid|dir); re-issues while live are counted
   as merged, never traded twice (the live forward log's own dedup is per
   (symbol, mechanic, bar) — brain.js:5489 — which would triple-count a
   sweep that re-fires on 3 consecutive bars; the lock is the honest book).

   OUTCOME RESOLUTION (LIB: lib/omnigold-xm-bot-backtest.mjs)
   ----------------------------------------------------------
   - signal on the CLOSE of exec bar i (SWING: 1h grid, SCALP: 15m grid);
     fills searched from bar i+1; order type from xmOrderType(dir, entry,
     close[i]); fill test = ogXmBarTouchesEntry (shared lib)
   - unfilled after 6 exec bars is NOT a loss — the tab replay's own retest
     window ('price must come back to the entry within 6 bars',
     omnigold1.js:1316-1319)
   - after fill: first touch stop vs t1; stop+target in one bar = LOSS
     (conservative); 24 exec bars after fill -> timeout, mark-to-market at
     close (mirrors hgOg1Replay's 24-bar resolution, omnigold1.js:1322-1332;
     the forward log's alternative horizons are SWING 20 / SCALP 24 bars,
     omnigold1.js:1372). sameBarWins + ambiguous LIMIT/STOP same-bar wins
     counted.

   COSTS (venue-true — the v536 lesson)
   ------------------------------------
   PRIMARY netR at XM XAUUSD: $0.35 spread / $3500 ref + 0.010% slip =
   0.020% RT (hgOgVenuePresetCost constants, omnigold.js:6789-6791) — the
   same venue the formation's stop floor prices. SENSITIVITY netR_paxg at
   PAXG spot 0.26% RT (2 x (0.10% + 0.03%)) — what the price SERIES is.
   costR_xm, costR_paxg and stopAtr = |entry-stop|/ATR14(exec) recorded on
   every trade (stopAtr exposes the engine-override tight-stop defect class).

   KNOWN DEVIATIONS: see meta.deviations (every one names the module line
   whose live degradation it mirrors).

   DATA: PAXGUSDT Binance spot 15m/1h/4h from scripts/.bt-cache (same cache
   as backtest-omnigold/goldscalp; basis vs XAU ~0.1-0.5%; 24/7 weekend bars
   a broker never printed). Style: scripts/backtest-goldscalp.mjs (hg-v699
   template). No new dependencies. */

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
const OFFLINE = has('--offline');
const REFRESH = has('--refresh');
/* --bars keeps its OLD meaning: the LANE-1 sweep's 1h bar count */
const SWEEP_BARS = +opt('--bars', SMOKE ? 600 : 2000);
/* --scan-bars: trailing closed 1h bars LANE 2 scans; 0 = every bar where
   all three feeds carry full tab depth (200x15m / 400x1h / 220x4h) */
const SCAN_BARS = +opt('--scan-bars', SMOKE ? 240 : 0);
/* smoke runs write to their own file so a full-run artifact can never be
   silently overwritten (the OP smoke/OUT_PATH incident) */
const OUT_FILE = path.join(ROOT, 'scripts',
  SMOKE ? 'backtest-omnigold1-smoke-results.json' : 'backtest-omnigold1-results.json');

/* ---------- constants ---------- */
const SYMBOL = 'PAXGUSDT';
const HOUR = 3600;
/* tab feed depths (loadInputs, omnigold1.js:1512-1514) */
const DEPTH = { m15: 200, h1: 400, h4: 220 };
const FILL_WINDOW = 6;    /* exec bars — the tab replay's retest window (omnigold1.js:1316-1319) */
const TIMEOUT_BARS = 24;  /* exec bars after fill — hgOg1Replay's resolution (omnigold1.js:1322-1332) */
/* venue-true round-trip costs, fraction of entry */
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;      /* 0.020% — XM XAUUSD */
const COST_PAXG_FRAC = 2 * (0.0010 + 0.0003);          /* 0.26% — PAXG spot  */

/* ==================== 1. DATA — Binance spot klines, cached ==================== */

const IV_SEC = { '15m': 900, '1h': 3600, '4h': 14400 };
/* data-api.binance.vision answers where api.binance.com returns HTTP 451
   (same host list as the old harness / scripts/stack-oos-check.mjs) */
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

async function jget(pathQ){
  let lastErr = null;
  for (const h of HOSTS){
    try{
      const r = await fetch(h + pathQ, { headers: { 'User-Agent': 'hardgate-og1-bt/2.0' } });
      if (r.ok) return r.json();
      lastErr = new Error('HTTP ' + r.status + ' ' + h + pathQ);
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('klines fetch failed');
}

async function fetchKlines(symbol, interval, target){
  const ivMs = IV_SEC[interval] * 1000;
  let out = [], endTime;
  while (out.length < target){
    const lim = Math.min(1000, target - out.length + 2);
    let pathQ = '/api/v3/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + lim;
    if (endTime) pathQ += '&endTime=' + endTime;
    const batch = await jget(pathQ);
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

/* Cache-first: an existing cache file is used WHOLE (never partially
   refetched for a bigger target — the PAXG caches are shared with the
   other gold harnesses and must not be churned mid-run). */
async function cachedKlines(symbol, interval, minBars){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-' + interval + '.json');
  if (!REFRESH && fs.existsSync(file)){
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const rows = j.rows || j;
      if (Array.isArray(rows) && rows.length >= minBars){
        console.log('  cache hit ' + interval + ': ' + rows.length + ' bars');
        return rows;
      }
    } catch (e) { /* refetch */ }
  }
  if (OFFLINE) throw new Error('offline: no ' + interval + ' cache with >= ' + minBars + ' bars');
  console.log('  fetching ' + symbol + ' ' + interval + ' x' + minBars + ' ...');
  const rows = await fetchKlines(symbol, interval, minBars);
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, interval, target: minBars, rows }));
  console.log('  got ' + rows.length + ' bars');
  return rows;
}

/* 22:00-UTC-anchored 4h derived from 1h — LANE 1's context, verbatim from
   the old harness (committed evidence; unchanged). */
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

/* ==================== 2. BOOT the tab's module stack in a vm sandbox ==================== */

function boot(){
  const el = () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){},
    querySelector: () => null, querySelectorAll: () => [],
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false } });
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String,
    Promise, RegExp, Error, TypeError, Map, Set, Symbol, Intl,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: el, createTextNode: el, createDocumentFragment: el,
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: el(), body: el(), documentElement: el(),
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('offline sandbox'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  /* the tab's live stack, load order proven by tests/test-v698-gold-formation.mjs */
  const FILES = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-mechanics.js',
    'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'formation.js', 'hg-solidity.js',
    'backtest-tab-params.js', 'gold-session.js', 'goldind.js', 'gold-catalog.js',
    'gold-formation.js', 'omniroute.js', 'omnigold.js', 'gold-seven-step.js', 'omnigold1.js'];
  for (const f of FILES){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  /* the mounted desk's venue default (omnigold.js:6784 HG_OG_VENUE_UI_DEFAULT='XM',
     restored by hgOgVenueInit at mount). Without it the sandbox fail-closes to
     PAXG 0.26% RT and the formation stop floor (8x RT) kills nearly every stop. */
  ctx.HG_OG_VENUE = 'XM';
  /* nightly OG1 edge, clamped exactly as formation-nightly.js:88-98/184 does */
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'formation-nightly.json'), 'utf8'));
    const e = (j && j.omnigold1) || {};
    ctx.HG_OG1_FORM_EDGE = {
      minRisk: Math.max(5, isFinite(+e.minRisk) ? +e.minRisk : 5),
      minDisp: Math.max(0.5, isFinite(+e.minDisp) ? +e.minDisp : 0.5),
      gated: e.gated === true, biasSide: e.biasSide === true
    };
  } catch (e) {
    ctx.HG_OG1_FORM_EDGE = { minRisk: 5, minDisp: 0.5, gated: false, biasSide: false };
  }
  for (const fn of ['hgOg1Engine', 'hgOg1Replay', 'hgOg1Grade', 'hgOg1BestSetups', 'hgOg1MostProbable',
                    'hgGoldFormation', 'hgOgFormation', 'hgGoldUniformTape', 'hgGoldConfluenceFromMatrix']){
    if (typeof ctx[fn] !== 'function') throw new Error('boot failed: ' + fn + ' is not a function');
  }
  if (!ctx.HG_GOLD7) throw new Error('boot failed: HG_GOLD7 missing');
  return ctx;
}

/* ==================== 3. trade lifecycle (template walk, shared lib fills) ==================== */

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
    horizon: tr.horizon, sid: tr.sid, strategy: tr.strategy, cls: tr.cls,
    pool: tr.pool, dir: tr.dir,
    grade: tr.grade || null, tradeReady: !!tr.tradeReady, ticket: !!tr.ticket,
    formation: tr.formation || null, formed: !!tr.formed,
    formationReason: tr.formationReason || undefined,
    matrix: isFinite(tr.matrix) ? tr.matrix : null,
    gatesPass: isFinite(tr.gatesPass) ? tr.gatesPass : null,
    bestRank: tr.bestRank || 0, mp: !!tr.mp,
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

/* ==================== 4. LANE 2 — the tab-faithful walk ==================== */

function sliceByCutoff(rows, tfSec, cutoffSec){
  let lo = 0, hi = rows.length;
  while (lo < hi){ const m = (lo + hi) >> 1; (rows[m].t + tfSec <= cutoffSec) ? lo = m + 1 : hi = m; }
  return rows.slice(0, lo);
}

function walkTab(W, m15, h1, h4){
  const results = [];
  const active = new Map();   /* 'horizon|sid|dir' -> trade */
  const counters = { scans: 0, engineRuns: 0, dataUnavailable: 0, vetoScans: 0, noPermitted: 0,
                     candidates: 0, noPlan: 0, badGeometry: 0, issued: 0, merged: 0,
                     tickets: 0, tradeReadyCands: 0, formedCands: 0, watchCands: 0,
                     asideCands: 0, killedCands: 0,
                     scanErrors: 0, openAtEnd: 0, bothTouch: 0,
                     sameBarWins: 0, sameBarAmbiguousWins: 0 };
  const asideReasons = {};    /* first formation reason (trimmed) -> count */
  /* first scan where every feed carries full tab depth */
  const needSec = Math.max(
    m15.length ? m15[0].t + DEPTH.m15 * 900 : Infinity,
    h1.length ? h1[0].t + DEPTH.h1 * HOUR : Infinity,
    h4.length ? h4[0].t + DEPTH.h4 * 14400 : Infinity);
  let first = h1.findIndex(r => r.t + HOUR >= needSec);
  if (first < 0) throw new Error('feeds never reach tab depth (200x15m / 400x1h / 220x4h) together');
  if (SCAN_BARS > 0) first = Math.max(first, h1.length - SCAN_BARS);
  /* m15 pointer: next 15m bar not yet stepped for SCALP trades */
  let m15Ptr = 0;
  while (m15Ptr < m15.length && m15[m15Ptr].t + 900 <= h1[first].t) m15Ptr++;
  const G7 = W.HG_GOLD7;
  const t0 = Date.now();
  for (let i = first; i < h1.length; i++){
    const bar = h1[i];
    const cutoff = bar.t + HOUR;
    const now = cutoff * 1000;
    /* 1a. advance SCALP trades over the 15m bars closing inside this hour */
    while (m15Ptr < m15.length && m15[m15Ptr].t + 900 <= cutoff){
      for (const [key, tr] of active){
        if (tr.grid !== 'm15' || tr.sigIdx >= m15Ptr) continue;
        if (stepTrade(tr, m15[m15Ptr], m15Ptr)){
          settleRecord(tr, m15, counters, results);
          active.delete(key);
        }
      }
      m15Ptr++;
    }
    /* 1b. advance SWING trades on this 1h bar */
    for (const [key, tr] of active){
      if (tr.grid !== 'h1' || tr.sigIdx >= i) continue;
      if (stepTrade(tr, bar, i)){
        settleRecord(tr, h1, counters, results);
        active.delete(key);
      }
    }
    /* 2. scan on the closed prefix — both horizons, as runScan does */
    const rows1h = sliceByCutoff(h1, HOUR, cutoff).slice(-DEPTH.h1);
    const rows15m = sliceByCutoff(m15, 900, cutoff).slice(-DEPTH.m15);
    const rows4h = sliceByCutoff(h4, 14400, cutoff).slice(-DEPTH.h4);
    const inp = { rows1h, rows15m, rows4h, now, news: null, replay: false,
                  feed: 'binance-paxg-cache', venue: 'Delta XAUTUSD' };
    try { inp.tape = W.hgGoldUniformTape(G7.closedRows(rows4h, 14400, now)); } catch (e) { /* unread tape, as live */ }
    counters.scans++;
    let runs;
    try {
      const rSwing = W.hgOg1Engine(Object.assign({}, inp, { horizon: 'SWING' }));
      counters.engineRuns++;
      const rScalp = W.hgOg1Engine(Object.assign({}, inp, { horizon: 'SCALP' }));
      counters.engineRuns++;
      runs = [{ horizon: 'SWING', r: rSwing }, { horizon: 'SCALP', r: rScalp }];
      /* BEST #1-3 + MP flags, exactly as the tab stamps them (runScan:1545-1551) */
      W.hgOg1BestSetups(runs, 3);
      for (const run of runs){
        let mp = null;
        try { mp = W.hgOg1MostProbable(run.r); } catch (eMp) { mp = null; }
        run.mpCand = mp && mp.cand ? mp.cand : null;
      }
    } catch (e) { counters.scanErrors++; continue; }
    /* 3. book every rendered candidate card, cohort-flagged */
    for (const run of runs){
      const r = run.r, hz = run.horizon;
      if (!r || !r.ok){ counters.dataUnavailable++; continue; }
      if (r.sections.s0 && !r.sections.s0.clear){ counters.vetoScans++; continue; }
      if (r.sections.s1 && r.sections.s1.noPermitted){ counters.noPermitted++; continue; }
      const cands = Array.isArray(r.candidates) ? r.candidates : [];
      const execRows = hz === 'SCALP' ? rows15m : rows1h;
      const sigIdx = hz === 'SCALP' ? (m15Ptr - 1) : i;
      const sigClose = hz === 'SCALP'
        ? (m15Ptr > 0 ? +m15[m15Ptr - 1].c : +bar.c)
        : +bar.c;
      let atrExec = NaN;
      try { atrExec = G7.atrN(execRows, 14); } catch (e) { atrExec = NaN; }
      for (const c of cands){
        if (!c || (c.dir !== 'long' && c.dir !== 'short')) continue;
        counters.candidates++;
        const entry = +c.entry, stop = +c.stop, t1 = +c.t1;
        if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)){ counters.noPlan++; continue; }
        const long = c.dir === 'long';
        if (long && !(stop < entry && t1 > entry)){ counters.badGeometry++; continue; }
        if (!long && !(stop > entry && t1 < entry)){ counters.badGeometry++; continue; }
        const gi = c.gradeInfo || W.hgOg1Grade(c);
        const fm = c.verdict && c.verdict.formation;
        const fmState = fm ? String(fm.state || '?') : 'NO-FORMATION';
        const formed = !!(fm && fm.formed === true);
        const ticket = !!(c.verdict && c.verdict.qualifies);
        if (ticket) counters.tickets++;
        if (gi.tradeReady) counters.tradeReadyCands++;
        if (formed) counters.formedCands++;
        else if (fmState === 'WATCH') counters.watchCands++;
        else if (fmState === 'KILLED') counters.killedCands++;
        else counters.asideCands++;
        let fmReason;
        if (!formed && fm && Array.isArray(fm.reasons) && fm.reasons.length){
          fmReason = String(fm.reasons[0]).slice(0, 90);
          if (fmState === 'STOOD-ASIDE' || fmState === 'KILLED'){
            /* tally by reason SHAPE (numbers normalised) so one rule is one row */
            const shape = fmReason.replace(/\d+(\.\d+)?/g, '#').slice(0, 80);
            asideReasons[shape] = (asideReasons[shape] || 0) + 1;
          }
        }
        const key = hz + '|' + String(c.sid || '?') + '|' + c.dir;
        if (active.has(key)){ counters.merged++; continue; }
        counters.issued++;
        active.set(key, newTrade({
          grid: hz === 'SCALP' ? 'm15' : 'h1',
          horizon: hz, sid: String(c.sid || '?'), strategy: c.name || null,
          cls: c.cls || null, pool: c.kind || null, dir: c.dir,
          grade: gi.grade, tradeReady: gi.tradeReady, ticket,
          formation: fmState, formed, formationReason: fmReason,
          matrix: c.matrix ? c.matrix.score : NaN,
          gatesPass: c.gates ? c.gates.pass : NaN,
          bestRank: c.bestRank || 0,
          mp: !!(run.mpCand && run.mpCand === c),
          rr: c.rr1,
          stopAtr: (isFinite(atrExec) && atrExec > 0) ? Math.abs(entry - stop) / atrExec : NaN,
          entry, stop, t1,
          orderType: xmOrderType(c.dir, entry, sigClose).name,
          sigIdx
        }));
      }
    }
    if ((i - first) % 100 === 0){
      console.log('  bar ' + i + '/' + h1.length + ' · open ' + active.size
        + ' · settled ' + results.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
  }
  counters.openAtEnd = active.size;
  return { results, counters, asideReasons, firstScanISO: new Date((h1[first].t + HOUR) * 1000).toISOString() };
}

/* ==================== 5. aggregates (dual-cost, template) ==================== */

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

/* the shared measured session cohorts (gold-formation.js:220-226) */
function sessionOf(h){
  return h < 7 ? 'ASIA(00-06)' : h < 12 ? 'LONDON(07-11)' : h < 17 ? 'NY-OVERLAP(12-16)'
       : h < 21 ? 'NY-PM(17-20)' : 'OFF(21-23)';
}

/* ==================== 6. LANE 1 — the committed hgOg1Replay sweep (unchanged) ==================== */

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

function runSweep(W, h1All){
  const h1 = h1All.slice(-SWEEP_BARS);
  const h4 = derive4h(h1);
  console.log('LANE 1 — hgOg1Replay sweep · 1h', h1.length, '4h', h4.length,
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
  return {
    bars: { h1: h1.length, h4: h4.length,
      from: new Date(h1[0].t * 1000).toISOString(),
      to: new Date(h1[h1.length - 1].t * 1000).toISOString() },
    variants,
    bestNamed: ranked[0] ? ranked[0][0] : null
  };
}

/* ==================== 7. main ==================== */

console.log('=== OMNIGOLD 1 tab backtest — ' + (SMOKE ? 'SMOKE RUN' : 'FULL RUN')
  + ' · ' + new Date().toISOString() + ' ===');
console.log('symbol ' + SYMBOL + ' · sweep bars requested ' + SWEEP_BARS
  + ' · tab-lane scan bars ' + (SCAN_BARS || 'all fetched')
  + ' · costs XM ' + (COST_XM_FRAC * 100).toFixed(3) + '% RT (primary) / PAXG '
  + (COST_PAXG_FRAC * 100).toFixed(2) + '% RT (sensitivity)');

/* hg-v704 FIX: these three fetches used to be hardcoded to 1200/1200/500
   bars, completely divorced from --bars/SWEEP_BARS and from the per-scan
   DEPTH lookback the walk needs at its FIRST bar. Two silent consequences:
   (1) LANE 1's runSweep does h1All.slice(-SWEEP_BARS) — with h1All capped
       at 1200 by the old hardcode, a 2000-bar request silently ran on
       whatever was cached (<=1200), while the console log kept claiming
       "sweep bars 2000";
   (2) the tab lane's walkable window was capped at 1200 h1 bars / 1200 m15
       bars (~12.5 days, m15 is the binding constraint) regardless of
       intent — it only ever looked bigger because the 15m cache file is
       SHARED with scripts/backtest-goldscalp.mjs, which normally requests
       ~6000 m15 bars and leaves that larger series cached; running this
       harness's own --refresh (or running it after clearing the shared
       cache) collapses straight back to 1200.
   Fetch targets now scale with SWEEP_BARS and add each walk's own DEPTH
   lookback so the earliest bar walked still has full warmup history,
   independent of what any OTHER script happened to leave cached. */
const H1_TARGET = SWEEP_BARS + DEPTH.h1 + 50;
const M15_TARGET = SWEEP_BARS * 4 + DEPTH.m15 + 50;   /* 4x: 15m bars per h1 bar */
const H4_TARGET = Math.ceil(SWEEP_BARS / 4) + DEPTH.h4 + 50;

const m15 = await cachedKlines(SYMBOL, '15m', M15_TARGET);
const h1 = await cachedKlines(SYMBOL, '1h', H1_TARGET);
const h4 = await cachedKlines(SYMBOL, '4h', H4_TARGET);
console.log('  fetched (actual, may exceed target on a cache hit): m15 ' + m15.length
  + ' · h1 ' + h1.length + ' · h4 ' + h4.length);

console.log('booting the OMNIGOLD 1 tab stack in a vm sandbox...');
const W = boot();

/* ---- LANE 1 (unchanged committed sweep) ---- */
const sweep = runSweep(W, h1);

/* ---- LANE 2 (tab-faithful walk) ---- */
console.log('LANE 2 — walking hgOg1Engine SWING+SCALP per closed 1h bar...');
const { results, counters, asideReasons, firstScanISO } = walkTab(W, m15, h1, h4);

const tabBook = results.filter(t => t.tradeReady || t.ticket);
const aggregates = {
  overall: agg(results),
  tabBook: {
    note: 'what hgOg1ForwardRecord records live: gradeInfo.tradeReady (grade A/B+/B) or verdict.qualifies (omnigold1.js:1361-1368) — the formation-gated book',
    all: agg(tabBook),
    ticketsOnly: agg(results.filter(t => t.ticket)),
    tradeReadyOnly: agg(results.filter(t => t.tradeReady))
  },
  byFormation: groupAgg(results, t => t.formation),
  formedVsNot: {
    formed: agg(results.filter(t => t.formed)),
    notFormed: agg(results.filter(t => !t.formed))
  },
  byGrade: groupAgg(results, t => t.grade || '?'),
  byHorizon: groupAgg(results, t => t.horizon),
  byStrategy: groupAgg(results, t => t.sid),
  byClass: groupAgg(results, t => t.cls || '?'),
  byDirection: groupAgg(results, t => t.dir),
  byUtcSession: groupAgg(results, t => sessionOf(t.utcHour)),
  bestOnly: agg(results.filter(t => t.bestRank > 0)),
  mpOnly: agg(results.filter(t => t.mp))
};

const settledAll = results.filter(t => t.netR != null);
const winsAll = settledAll.filter(t => t.outcome.startsWith('win'));
const exAmbig = settledAll.filter(t => !t.ambiguousSameBarWin);
const exAmbigWins = exAmbig.filter(t => t.outcome.startsWith('win'));

const meta = {
  generated: new Date().toISOString(),
  mode: SMOKE ? 'smoke' : 'full',
  symbol: SYMBOL,
  universe: 'PAXGUSDT Binance spot proxy for XAUUSD (basis ~0.1-0.5%; 24/7 weekend bars a broker never printed)',
  pipeline: 'hgOg1Engine SWING (4H ctx / 1H exec) + SCALP (1H ctx / 15m exec) per closed 1h bar — the OMNIGOLD 1 tab path (runScan, omnigold1.js:1539-1540), shared gold formation applied inside decide() (806-821); hgOg1Replay is LANE 1, not this lane',
  bars: { m15: m15.length, h1: h1.length, h4: h4.length },
  span: { firstScan: firstScanISO, to: new Date((h1[h1.length - 1].t + HOUR) * 1000).toISOString() },
  feedDepths: Object.assign({ note: 'the tab loads no 1d leg (loadInputs, omnigold1.js:1510-1514)' }, DEPTH),
  costs: {
    xm: { rtFrac: COST_XM_FRAC, basis: 'XM XAUUSD $0.35 spread / $3500 ref + 0.010% slip = 0.020% RT (hgOgVenuePresetCost, omnigold.js:6789-6791) — same venue the formation stop floor prices (HG_OG_VENUE=XM)' },
    paxg: { rtFrac: COST_PAXG_FRAC, basis: 'PAXG spot 0.1% taker + 0.03% slip per side = 0.26% RT' },
    primary: 'xm — netR is XM, netR_paxg the sensitivity'
  },
  rules: {
    cadence: 'scan on every closed 1h bar, both horizons together as runScan does; now = the bar close instant ((t+3600)*1000) — veto stack, goldSession, session-leg cohort and trigger read that clock, never the wall clock',
    selection: 'every rendered candidate card with a finite plan walks; cohorts split on the tab\'s own flags: verdict.qualifies (ticket), gradeInfo.tradeReady (the forward-log book), formation state, BEST #1-3 (hgOg1BestSetups), MP (hgOg1MostProbable)',
    dedup: 'one live trade per (horizon|sid|dir); re-issues while live counted merged — the live forward log dedups per (symbol, mechanic, bar) (brain.js:5489) which would multi-count a sweep re-firing on consecutive bars',
    fill: 'pending order at entry from exec bar sigIdx+1; type via xmOrderType(dir, entry, signal close); touch via ogXmBarTouchesEntry (shared lib); unfilled after 6 exec bars (the tab replay\'s retest window, omnigold1.js:1316-1319) != loss',
    resolution: 'first touch stop vs t1 after fill; both-touch bar = LOSS; 24 exec bars after fill -> timeout MTM at close (hgOg1Replay\'s own resolution, omnigold1.js:1322-1332; forward-log horizons SWING 20 / SCALP 24 bars at :1372)',
    stops: 'touch-based; the live card invalidates on two closes beyond the level (omnigold1.js:865) — touch stops here are stricter. Deliberate.'
  },
  deviations: [
    'macro layer absent (getGoldMacro race, omnigold1.js:1515): DXY 4H / 10Y real yield / GVZ / COT read unavailable — matrix A1 Intermarket/Macro can never score, exactly as a live macro fetch failure degrades (omnigold1.js:214-238)',
    'news calendar absent (omnigold1.js:1518-1522): veto 1 marked unavailable, never fires; gate 7 lockout and sanity (d) pass with "calendar unavailable" — the engine\'s own fetch-failure path',
    'bid/ask + 20d spread absent (omnigold1.js:1523): veto 2 unavailable; B7 execution liquidity leg reads "ILLIQ and spread average unavailable"',
    'DATA BLOCK inputs (gvz, cotPct, realYield5d, walls, weekly physical, ml, xag, gdxRs, fedwatch, hourHist, dd95...) not supplied — same as a live user who pastes nothing (omnigold1.js:1566); those matrix legs are counted unavailable and meta-scored in reachable/20',
    'funding / OI absent (omnigold1.js:1516-1517): B2 positioning leg partial; veto 9 flagged unavailable — and at exact 1h-close instants the IST funding-window arithmetic (omnigold1.js:374-376) can never land inside (0,20] minutes anyway',
    'equity/stopsToday/trader not set: sizing prints "account balance missing" (no effect on candidacy); veto 5 unavailable; G12 passes with note — mirrors readInputs defaults (omnigold1.js:1501-1503)',
    'CVD is the engine\'s own BVC proxy computed from the 15m bars (omnigold1.js:242-253) — the exact live path when no taker delta is supplied; PAXG volumes stand in for XAU volumes',
    'hour-of-day histogram is the engine\'s own loaded-sessions proxy (omnigold1.js:300-319) — same as live with hourHist unsupplied',
    'forward ledger empty offline: hgOgForwardPaid never un-demotes a kind (omnigold.js:7440-7468); KILL-LIST and measured-edge read too-few-samples -> not killed / pass (hg-solidity.js:279-294, 238-263) — identical to a fresh browser profile',
    'HG_OG_VENUE=XM set at boot: the mounted desk default (omnigold.js:6784, hgOgVenueInit:6861-6875); an unmounted sandbox fail-closes to PAXG 0.26% RT and would stop-floor nearly every OG1 stop at 2.08%',
    'venue string "Delta XAUTUSD" as the live tab sets unconditionally (omnigold1.js:1525) -> ctx.isPerp true, as live; basisPct unavailable so venue conversion never renders',
    'HG_OG1_FORM_EDGE read from scripts/formation-nightly.json, clamped as formation-nightly.js:88-98/184 (today = the $5 / 0.5-ATR defaults)',
    'inp.replay=false: skips only the in-card MEASURED lines (omnigold1.js:497-499) — zero effect on candidates, verdicts or grades; LANE 1 runs the same replays standalone',
    'tape computed from the same 4h prefix via hgGoldUniformTape but keyed on the BAR clock; the live tab keys closedRows on Date.now() at scan time (omnigold1.js:1524) — equal at a live scan instant, and the bar clock is the only zero-lookahead choice offline',
    'SCALP horizon is scanned at 1h-close instants only (the tab has no fixed cadence — RUN SCAN is manual); a 15m-cadence walk would sample 4x more SCALP signal bars',
    'single venue PAXG proxy: weekend bars exist that a broker never prints — session cohorts include phantom weekend bars (ASIA and OFF carry the same caveat in gold-formation.js:227-230)'
  ],
  limitations: [
    'SAME-BAR FILL->TARGET OPTIMISM: ' + counters.sameBarWins + ' of ' + winsAll.length
      + ' wins settle on the fill bar; ' + counters.sameBarAmbiguousWins
      + ' are LIMIT/STOP fills where OHLC cannot prove order-of-touch — resolved pro-strategy. Win rate '
      + (settledAll.length ? (winsAll.length / settledAll.length * 100).toFixed(1) : '-') + '% -> '
      + (exAmbig.length ? (exAmbigWins.length / exAmbig.length * 100).toFixed(1) : '-')
      + '% excluding ambiguous same-bar wins. Both-touch bars ARE losses (' + counters.bothTouch + ').',
    'PORTFOLIO STATS NOT ATTAINABLE: every card walks at 1R with unlimited concurrency; read per-trade expectancy and per-group rows only',
    'OFFLINE DATA CEILING: matrix legs on unfetchable feeds (macro, positioning, weekly physical, ML) cannot score, so matrix totals and grades compress toward C and QUALIFIES tickets are structurally rarer than live — read cohort LADDERS (formed vs not, grade ordering), not absolute counts',
    'THIN FORMED/TICKET COHORTS: the tab book (tradeReady||ticket) is small by construction — mind n before reading any row as edge'
  ],
  counters,
  stoodAsideReasons: Object.fromEntries(Object.entries(asideReasons).sort((a, b) => b[1] - a[1]).slice(0, 12))
};

const report = {
  /* LANE 1 output shape preserved (additive change): generated / symbol /
     bars / note / variants / bestNamed / apply exactly as the old harness
     wrote them; tabLane is the new key. */
  generated: new Date().toISOString(),
  symbol: SYMBOL,
  bars: sweep.bars,
  note: 'in-sample sweep→reclaim pricing sanity — not a forecast. Same hgOg1Replay the tab attaches.',
  variants: sweep.variants,
  bestNamed: sweep.bestNamed,
  apply: {
    liveQualifies: 'SL$ ≥ $5 + G5 displacement ≥ 0.5 ATR (minRisk5+disp0.5 least-bad vs raw). gated+bias is worse — attached as measured lines, not a QUALIFIES gate.',
    neverLoosen: ['G1-G12', 'displacement ≥ 0.5 × ATR', 'RR 1.5 floor', 'SL$ ≥ $5']
  },
  tabLane: { meta, aggregates, trades: results }
};

fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 1));

/* ---------- console tables ---------- */
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
console.log('\n=== TAB LANE RESULTS (' + meta.mode + ') · cards walked ' + results.length
  + ' (settled ' + aggregates.overall.n + ') · merged ' + counters.merged
  + ' · tickets ' + counters.tickets + ' · tradeReady ' + counters.tradeReadyCands
  + ' · scanErrors ' + counters.scanErrors + ' ===');
printAgg('overall + tab book', { 'ALL cards': aggregates.overall,
  'tab book (fwd-log)': aggregates.tabBook.all, 'tickets only': aggregates.tabBook.ticketsOnly,
  'tradeReady only': aggregates.tabBook.tradeReadyOnly, 'BEST #1-3': aggregates.bestOnly,
  'MP only': aggregates.mpOnly });
printAgg('by formation state', aggregates.byFormation);
printAgg('formed vs not', aggregates.formedVsNot);
printAgg('by grade', aggregates.byGrade);
printAgg('by horizon', aggregates.byHorizon);
printAgg('by strategy (sid)', aggregates.byStrategy);
printAgg('by class', aggregates.byClass);
printAgg('by direction', aggregates.byDirection);
printAgg('by UTC session (shared cohorts)', aggregates.byUtcSession);
console.log('\nstood-aside reasons (top):');
for (const [k, v] of Object.entries(meta.stoodAsideReasons)) console.log('  ' + rpad(v, 5) + '  ' + k);
console.log('\nSTATED LIMITATIONS:');
for (const lim of meta.limitations) console.log('  * ' + lim);
console.log('\nwritten: ' + OUT_FILE);
