/* HARDGATE — NEW GOLD tab backtest harness (offline, node ESM).
   Run:  node scripts/backtest-newgold.mjs [--smoke] [--bars=N] [--refresh]

   WHAT THIS REPLAYS
   -----------------
   The NEW GOLD tab's OWN per-bar pipeline (newgold.js v690/v695/v698), per
   closed native bar, zero lookahead:

     ngAssess(rows) -> ngHtfTape(label, rows4h) -> ngConfirmations(setup,
     { tape, rows }) -> hgGoldFormation(...) -> hgSolidityGrade(...) ->
     v689 kill filter

   for BOTH primary horizons the tab scans (HORIZONS, newgold.js:47-50):
   1H and 4H, each on ITS OWN closed-bar grid. Only a FORMED card (the
   shared gold-formation contract said tradable, hg-v698) is walked as a
   trade — a fire that lands WATCH / STOOD-ASIDE / KILLED is COUNTED per
   cohort and never given levels, exactly as the tab prints "NOT A TICKET —
   no levels printed" (newgold.js:867-868).

   FIDELITY TO THE LIVE TAB
   ------------------------
   - rows per horizon are the last KL_LIMIT=300 CLOSED bars (newgold.js:42),
     sliced from cached PAXGUSDT klines with sliceByCutoff closed-bar
     prefixes; each horizon's walk starts only once 300 closed bars exist so
     the recursive RSI (indicators.js rsi, seeded from series start) sees the
     same depth the live fetch feeds it.
   - 'now' is the CLOSED bar's close instant; the session leg reads the
     SIGNAL BAR's own clock through hgGoldSignalBarMs(rows) inside
     ngConfirmations (newgold.js:423, gold-formation.js:280) — the harness
     never passes a wall clock anywhere.
   - the 1H horizon's HTF tape is the real 4H VWMA-50 regime computed from
     the closed 4h prefix (ngHtfTape -> ngHtfVwmaRegime, newgold.js:296-329).
     The 4H horizon's tape (OMNIGOLD desk tape via hgOgUniformDebug) reads ''
     offline — the same degradation as live before OMNIGOLD's first scan.
   - formation call mirrors newgold.js:566-583 verbatim: rows deliberately
     NOT passed, tab 'NEWGOLD:<label>', mechanic TRIPLE-CONF,
     requireClasses:['session-htf'] (the desk's only revocable class).
   - solidity call mirrors newgold.js:593-611: minRr 1.5, tape from the real
     HTF read (never the card's own dir), consensus.nAgree = the formation
     confluence classCount, liveGrade 'fresh' (market fill by definition).
   - kill filter mirrors newgold.js:781-794 (solidity.killed OR
     formation.state==='KILLED' -> filtered, counted).
   - venue for the hgOgFormation stop floor is declared XM via the DOCUMENTED
     window.HG_OG_VENUE override (precedence #1, omnigold.js:6833): XM is the
     live UI default (HG_OG_VENUE_UI_DEFAULT, omnigold.js:6784) and the venue
     this desk actually executes on; an unmounted context would otherwise
     fail closed to PAXG's 0.26% RT and price 1h FVG stops at fees the desk
     never pays (stop floor 2.08% vs 0.16%).

   SELECTION / DEDUP
   -----------------
   NEW GOLD has NO conviction store — every ngRunScan rebuilds cards from
   scratch and the 5-minute auto-refresh (NG_AUTO_REFRESH_MS, newgold.js:59)
   re-renders the same closed-bar signal. Offline each closed bar is
   assessed exactly ONCE per horizon (the re-renders carry no new data), and
   dedup is one live trade per (horizon|dir) — kind is the constant
   TRIPLE-CONF — with re-fires while a same-key trade is live counted as
   merged, not traded.

   OUTCOME RESOLUTION (LIB semantics: lib/omnigold-xm-bot-backtest.mjs)
   --------------------------------------------------------------------
   - signal fires on the CLOSE of native bar i; entry is MARKET at close
     (newgold.js:14-16), so xmOrderType classifies BUY/SELL (rel=0) and the
     lib fills at bar i+1 at the entry price
   - fill test = ogXmBarTouchesEntry (shared lib); a pending order unfilled
     after 30 native bars is 'unfilled', NOT a loss (moot for market orders,
     kept for the shared walk shape)
   - after fill: first touch of stop vs t1; both touched in one bar = LOSS
     (conservative); 30 native bars after fill -> 'timeout', MTM at close.
     30 bars is the tab's OWN forward-log horizon (horizonBars:30,
     newgold.js:762), applied per horizon tf (30h on 1H, 120h on 4H)
   - T2 (2.5R) is recorded on the card but never walked: settlement is the
     house stop-vs-T1 first-touch, like every gold harness

   COSTS (venue-true — the v536 OMNIGOLD lesson)
   ---------------------------------------------
   PRIMARY netR at XM XAUUSD: $0.35 spread / $3500 ref spot + 0.010% slip
   = 0.020% RT (hgOgVenuePresetCost constants, omnigold.js:6789-91).
   SENSITIVITY netR_paxg at PAXG spot: 0.1% taker + 0.03% slip per side =
   0.26% RT. costR_xm, costR_paxg and stopAtr = |entry-stop|/ATR(14) are
   recorded on every trade (stopAtr exposes the tight-stop defect class).

   KNOWN DEVIATIONS — see meta.deviations (each names the module line whose
   live degradation it mirrors). Highlights: OMNIGOLD desk tape and the
   v695 OMNI lanes are empty offline exactly as before OMNIGOLD's first live
   scan; the forward ledger starts empty so v685 veto / v687 PRIME / v689
   kill never fire (fresh-browser-profile semantics); PAXG proxy carries
   volume so VWMA-50 is genuinely volume-weighted where a volume-less live
   XAUUSD feed degrades to SMA (newgold.js:79-94).

   DATA: PAXGUSDT Binance spot 1h/4h (same proxy + scripts/.bt-cache as
   backtest-omnigold.mjs; basis vs XAU ~0.1-0.5%, 24/7 weekend bars a broker
   never printed). Style: modeled on scripts/backtest-goldscalp.mjs.
   No new dependencies. Harness + results JSON only — no app module touched. */

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
/* the tab fires ~once per 4-5 days, so even the smoke default walks the whole
   cached 1h window (the walk costs ~15s); --smoke's job here is the SEPARATE
   output artifact, never a shrunken window that cannot demonstrate settlement */
const BARS_1H = +opt('--bars', 3999);
/* smoke runs write to their own file so a full-run artifact can never be
   silently overwritten */
const OUT_FILE = path.join(ROOT, 'scripts',
  SMOKE ? 'backtest-newgold-smoke-results.json' : 'backtest-newgold-results.json');

/* ---------- constants ---------- */
const SYMBOL = 'PAXGUSDT';
const KL_LIMIT = 300;             /* the tab's own fetch depth (newgold.js:42) */
const MIN_RR = 1.5;               /* the tab's T1 floor (newgold.js:43) */
const HORIZON_BARS = 30;          /* the tab's forward-log horizon (newgold.js:762) */
const FILL_WINDOW = 30;           /* pending TTL in native bars (market orders fill at i+1) */
const TIMEOUT_BARS = 30;          /* MTM exit N native bars after the fill */
/* venue-true round-trip costs, fraction of entry */
const COST_XM_FRAC = (0.35 / 3500) + 0.010 / 100;      /* 0.020% — XM XAUUSD */
const COST_PAXG_FRAC = 2 * (0.0010 + 0.0003);          /* 0.26% — PAXG spot  */

const HORIZONS = [
  { tf: '1h', tfSec: 3600, label: '1H' },
  { tf: '4h', tfSec: 14400, label: '4H' }
];

/* ==================== 1. DATA — Binance spot klines, cached ==================== */

const IV_SEC = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-newgold-backtest/1.0' } });
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

/* rows already cached for this (symbol, interval) — so targets can be capped
   to reuse the cache instead of triggering a refetch for a few extra bars */
function cacheAvail(symbol, interval){
  try {
    const j = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, symbol + '-' + interval + '.json'), 'utf8'));
    return (j.rows && j.rows.length) || 0;
  } catch (e) { return 0; }
}

async function cachedKlines(symbol, interval, target){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-' + interval + '.json');
  if (!REFRESH && fs.existsSync(file)){
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ageH = (Date.now() - j.fetchedAt) / 3.6e6;
      if (j.rows && j.rows.length >= target && ageH < 96){
        console.log('  cache hit ' + interval + ': ' + j.rows.length + ' bars (' + ageH.toFixed(1) + 'h old), using last ' + target);
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

/* ==================== 2. BOOT the app in a vm sandbox ==================== */

/* Wilson score interval — copied VERBATIM from index.html:6624 (hgWilson);
   it lives in no .js module and goldind/omniroute feature-check it. */
function hgWilson(wins, n, z){
  z = isFinite(z) ? z : 1.96;
  wins = +wins; n = +n;
  if (!(n > 0) || !(wins >= 0) || wins > n) return null;
  const p = wins / n, z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p: p };
}

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, Error, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  ctx.hgWilson = hgWilson;
  /* Venue for the hgOgFormation stop floor: the DOCUMENTED override
     (precedence #1, omnigold.js:6833). XM is the live UI default and the
     desk's execution venue; see header + meta.deviations. */
  ctx.HG_OG_VENUE = 'XM';
  /* the browser loads data/desk-tab-params.json via fetch (backtest-tab-
     params.js:57-73); no fetch in the sandbox, so preload the same file.
     Informational only in the formation verdict (deskParams row). */
  try {
    ctx.HG_DESK_TAB_PARAMS = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data', 'desk-tab-params.json'), 'utf8'));
  } catch (e) { /* absent file = the live fetch-failed shape */ }
  vm.createContext(ctx);

  /* prelude proven by scripts/backtest-omnigold.mjs (omnigold.js boots on it),
     then the gold formation stack in app order, then newgold.js */
  const REQUIRED = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                    'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                    'goldind.js', 'gold-session.js', 'gold-catalog.js', 'backtest-tab-params.js',
                    'omnigold.js', 'hg-solidity.js', 'gold-formation.js', 'newgold.js'];
  for (const f of REQUIRED){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  for (const fn of ['ngAssess', 'ngConfirmations', 'ngHtfTape', 'ngHtfVwmaRegime',
                    'hgGoldFormation', 'hgGoldSessionEdge', 'hgGoldSignalBarMs',
                    'hgSolidityGrade', 'hgOgFormation', 'hgPlanFromRisk', 'rsi']){
    if (typeof ctx[fn] !== 'function') throw new Error('boot failed: ' + fn + ' is not a function');
  }
  return ctx;
}

/* ==================== 3. small pure helpers ==================== */

function sliceByCutoff(rows, tfSec, cutoffSec){
  let lo = 0, hi = rows.length;
  while (lo < hi){ const m = (lo + hi) >> 1; (rows[m].t + tfSec <= cutoffSec) ? lo = m + 1 : hi = m; }
  return rows.slice(0, lo);
}

/* Wilder ATR(14) on the prefix — for the stopAtr diagnostic only (the module
   itself derives its ATR inside hgPlanFromRisk from the same rows). */
function atr14(rows){
  const p = 14;
  if (!rows || rows.length < p + 1) return NaN;
  let a = 0;
  for (let i = 1; i <= p; i++){
    a += Math.max(rows[i].h - rows[i].l,
      Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c));
  }
  a /= p;
  for (let i = p + 1; i < rows.length; i++){
    const tr = Math.max(rows[i].h - rows[i].l,
      Math.abs(rows[i].h - rows[i - 1].c), Math.abs(rows[i].l - rows[i - 1].c));
    a = (a * (p - 1) + tr) / p;
  }
  return a;
}

/* ==================== 4. trade lifecycle (template walk) ==================== */

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
    horizon: tr.horizon, kind: tr.kind, dir: tr.dir,
    grade: tr.grade || null, solScore: isFinite(tr.solScore) ? tr.solScore : null,
    leadEligible: !!tr.leadEligible, ticket: !!tr.ticket,
    formationState: tr.formationState || null,
    classCount: isFinite(tr.classCount) ? tr.classCount : null,
    classes: tr.classes || null,
    revocableClasses: tr.revocableClasses || null,
    sessionKey: tr.sessionKey || null,
    sessionConfirms: !!tr.sessionConfirms,
    tapeDir: tr.tapeDir || null,
    tapeOk: !!tr.tapeOk,
    sessionLeg: tr.sessionLeg || null,
    stopWidened: !!tr.stopWidened,
    fvgAgeBars: isFinite(tr.fvgAgeBars) ? tr.fvgAgeBars : null,
    utcHour: new Date(rows[tr.sigIdx].t * 1000).getUTCHours(),
    entry: +tr.entry.toFixed(2), stop: +tr.stop.toFixed(2),
    t1: +tr.t1.toFixed(2), t2: isFinite(tr.t2) ? +tr.t2.toFixed(2) : null,
    rr1: isFinite(tr.rr1) ? +(+tr.rr1).toFixed(2) : null,
    riskPct: isFinite(tr.riskPct) ? +tr.riskPct.toFixed(3) : null,
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

/* ==================== 5. THE WALK — one horizon on its own grid ==================== */

/* every fire is diagnosed, formed or not — the FORMED rate and its blockers
   are this tab's primary story (capped so the artifact stays readable) */
const FIRE_LOG_MAX = 500;
const fireLog = [];

function walkHorizon(W, hz, rows, rows4h, results, counters){
  const label = hz.label, tfSec = hz.tfSec;
  const active = new Map();       /* 'label|dir' -> trade */
  const st = counters.horizons[label] = {
    scans: 0, noFire: 0, fires: 0,
    formed: 0, watch: 0, watchSessionMissing: 0, stoodAside: 0, stoodAsideStopFloor: 0,
    killed: 0, noPlan: 0, badGeometry: 0, merged: 0, issued: 0, openAtEnd: 0,
    tapeReads: 0, sessionLegConfirms: 0, tapeLegConfirms: 0
  };
  /* the tab feeds each horizon KL_LIMIT closed bars; start once that depth
     exists so the recursive RSI sees the depth the live fetch feeds it */
  const first = KL_LIMIT;         /* rows[first] is the first signal bar with a 300-bar prefix */
  if (rows.length <= first + 1){
    console.log('  WARN: ' + label + ' has only ' + rows.length + ' bars — nothing to walk');
    return;
  }
  const t0 = Date.now();
  for (let i = first; i < rows.length; i++){
    const bar = rows[i];
    /* 1. advance open trades (signals from earlier bars only) */
    for (const [key, tr] of active){
      if (tr.sigIdx >= i) continue;
      if (stepTrade(tr, bar, i)){
        settleRecord(tr, rows, counters, results);
        active.delete(key);
      }
    }
    /* 2. scan the closed prefix — the tab's own depth */
    const cutoff = bar.t + tfSec;
    const prefix = rows.slice(Math.max(0, i + 1 - KL_LIMIT), i + 1);
    const p4 = sliceByCutoff(rows4h, 14400, cutoff).slice(-KL_LIMIT);
    try {
      st.scans++; counters.scans++;
      const setup = W.ngAssess(prefix);
      if (!setup){ st.noFire++; continue; }
      st.fires++; counters.fires++;
      const tape = W.ngHtfTape(label, p4);
      if (tape && tape.dir) st.tapeReads++;
      /* mirror of newgold.js:565 */
      const confirmations = W.ngConfirmations(setup, { tape, rows: prefix });
      /* mirror of newgold.js:566-583 (rows deliberately NOT passed) */
      const formation = W.hgGoldFormation(
        { kind: setup.kind, horizon: label, dir: setup.dir,
          plan: { entry: setup.entry, stop: setup.stop, t1: setup.t1, rr1: setup.rr1 },
          entry: setup.entry, stop: setup.stop, t1: setup.t1 },
        { tab: 'NEWGOLD:' + label, mechanic: setup.kind || 'TRIPLE-CONF',
          confirmations, requireClasses: ['session-htf'] });
      /* mirror of newgold.js:591-612 */
      let solidity = null;
      try {
        solidity = W.hgSolidityGrade({
          dir: setup.dir,
          entry: setup.entry, stop: setup.stop, t1: setup.t1, t2: setup.t2,
          rr1: setup.rr1, minRr: MIN_RR,
          tape: (tape && tape.dir) || '',
          stopWidened: setup.stopWidened,
          consensus: { nAgree: (formation && formation.confluence)
                                 ? formation.confluence.classCount : 0 },
          liveGrade: 'fresh'
        }, { minRr: MIN_RR, tab: 'NEWGOLD:' + label, kind: 'TRIPLE-CONF' });
      } catch (eSol) { solidity = null; }
      /* v689 kill filter — mirror of newgold.js:781-794 */
      if ((solidity && solidity.killed === true) || (formation && formation.state === 'KILLED')){
        st.killed++; counters.killedFiltered++; continue;
      }
      /* cohort bookkeeping for every fire */
      const conf = formation && formation.confluence;
      const sessLeg = pickSessionLeg(confirmations);
      if (sessLeg.sessionOk) st.sessionLegConfirms++;
      if (sessLeg.tapeOk) st.tapeLegConfirms++;
      if (fireLog.length < FIRE_LOG_MAX){
        fireLog.push({
          tISO: new Date(bar.t * 1000).toISOString(),
          horizon: label, dir: setup.dir, state: formation.state,
          riskPct: isFinite(setup.riskPct) ? +setup.riskPct.toFixed(3) : null,
          stopPctFinal: (isFinite(setup.entry) && isFinite(setup.stop) && setup.entry > 0)
            ? +((Math.abs(setup.entry - setup.stop) / setup.entry) * 100).toFixed(3) : null,
          stopWidened: setup.stopWidened === true,
          classes: conf && conf.present ? conf.present.join('+') : null,
          requiredMissing: conf && conf.requiredMissing && conf.requiredMissing.length
            ? conf.requiredMissing.join('+') : undefined,
          stopFloorCostR: formation.stopFloor && isFinite(formation.stopFloor.costR)
            ? +formation.stopFloor.costR.toFixed(3) : undefined,
          sessionLeg: sessLeg.name,
          tapeDir: (tape && tape.dir) || null,
          grade: (solidity && solidity.grade) || null,
          reason: (formation.reasons && formation.reasons[0]) ? String(formation.reasons[0]).slice(0, 160) : null
        });
      }
      if (formation.state === 'WATCH'){
        st.watch++;
        if (conf && Array.isArray(conf.requiredMissing) && conf.requiredMissing.indexOf('session-htf') >= 0)
          st.watchSessionMissing++;
        continue;
      }
      if (formation.state !== 'FORMED'){
        st.stoodAside++;
        if (formation.stopFloor) st.stoodAsideStopFloor++;
        continue;
      }
      st.formed++; counters.formedFires++;
      /* 3. FORMED — the tab prints levels; walk it. Fail closed on plan. */
      const entry = +setup.entry, stop = +setup.stop, t1 = +setup.t1;
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)){ st.noPlan++; counters.noPlan++; continue; }
      const long = setup.dir === 'long';
      if (long && !(stop < entry && t1 > entry)){ st.badGeometry++; counters.badGeometry++; continue; }
      if (!long && !(stop > entry && t1 < entry)){ st.badGeometry++; counters.badGeometry++; continue; }
      const key = label + '|' + setup.dir;
      if (active.has(key)){ st.merged++; counters.merged++; continue; }
      st.issued++; counters.issued++;
      const sedge = W.hgGoldSessionEdge(rows[i].t * 1000);
      const a14 = atr14(prefix);
      active.set(key, newTrade({
        horizon: label, kind: String(setup.kind || 'TRIPLE-CONF'), dir: setup.dir,
        grade: (solidity && solidity.grade) || null,
        solScore: solidity ? solidity.score : NaN,
        leadEligible: !!(solidity && solidity.leadEligible),
        /* the tab's own ticket bar: FORMED and lead-eligible (newgold.js:760-762) */
        ticket: !!(formation.tradable === true && solidity && solidity.leadEligible),
        formationState: formation.state,
        classCount: conf ? conf.classCount : NaN,
        classes: conf && conf.present ? conf.present.join('+') : null,
        revocableClasses: conf && conf.revocable ? conf.revocable.join('+') : null,
        sessionKey: sedge ? sedge.key : null,
        sessionConfirms: !!(sedge && sedge.confirms === true),
        tapeDir: (tape && tape.dir) || null,
        tapeOk: sessLeg.tapeOk,
        sessionLeg: sessLeg.name,
        stopWidened: setup.stopWidened === true,
        fvgAgeBars: setup.fvg ? setup.fvg.ageBars : NaN,
        rr1: setup.rr1, riskPct: setup.riskPct,
        stopAtr: (isFinite(a14) && a14 > 0) ? Math.abs(entry - stop) / a14 : NaN,
        entry, stop, t1, t2: +setup.t2,
        orderType: xmOrderType(setup.dir, entry, +bar.c).name,
        sigIdx: i
      }));
    } catch (e) { counters.scanErrors++; }
    if ((i - first) % 500 === 0){
      console.log('  [' + label + '] bar ' + i + '/' + rows.length + ' · open ' + active.size
        + ' · settled ' + results.length + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
  }
  for (const tr of active.values()){ void tr; st.openAtEnd++; counters.openAtEnd++; }
}

/* which leg satisfied the session-htf class at fire time, read from the
   module's own confirmation names (newgold.js:427-446) */
function pickSessionLeg(confirmations){
  let sessionOk = false, tapeOk = false;
  for (const c of (confirmations || [])){
    if (!c || c.cls !== 'session-htf') continue;
    if (c.name === 'session window' && c.ok === true) sessionOk = true;
    if (c.name === 'higher-timeframe tape' && c.ok === true) tapeOk = true;
  }
  return { sessionOk, tapeOk,
    name: sessionOk && tapeOk ? 'both' : sessionOk ? 'session-window' : tapeOk ? 'htf-tape' : 'none' };
}

/* ==================== 6. aggregates (dual-cost) ==================== */

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

/* ==================== 7. main ==================== */

console.log('=== NEW GOLD tab backtest — ' + (SMOKE ? 'SMOKE RUN' : 'FULL RUN')
  + ' · ' + new Date().toISOString() + ' ===');
console.log('symbol ' + SYMBOL + ' · 1h bars ' + BARS_1H
  + ' · costs XM ' + (COST_XM_FRAC * 100).toFixed(3) + '% RT (primary) / PAXG '
  + (COST_PAXG_FRAC * 100).toFixed(2) + '% RT (sensitivity)');

/* cap targets at what the cache already holds so a full run never refetches
   (another long-running backtest may share this repo; the cache is shared) */
const availH1 = cacheAvail(SYMBOL, '1h');
const availH4 = cacheAvail(SYMBOL, '4h');
const wantH1 = availH1 ? Math.min(BARS_1H, availH1) : BARS_1H;
const wantH4Raw = KL_LIMIT + Math.ceil(wantH1 / 4) + 8;
const wantH4 = availH4 ? Math.min(wantH4Raw, availH4) : wantH4Raw;

const h1 = await cachedKlines(SYMBOL, '1h', wantH1);
const h4 = await cachedKlines(SYMBOL, '4h', wantH4);

console.log('booting app modules in vm sandbox (venue override XM)...');
const W = boot();

const results = [];
const counters = { scans: 0, fires: 0, formedFires: 0, killedFiltered: 0,
                   issued: 0, merged: 0, noPlan: 0, badGeometry: 0,
                   scanErrors: 0, openAtEnd: 0, bothTouch: 0,
                   sameBarWins: 0, sameBarAmbiguousWins: 0, horizons: {} };

console.log('walking NEW GOLD 1H horizon on the 1h grid (' + h1.length + ' bars)...');
walkHorizon(W, HORIZONS[0], h1, h4, results, counters);
console.log('walking NEW GOLD 4H horizon on the 4h grid (' + h4.length + ' bars)...');
walkHorizon(W, HORIZONS[1], h4, h4, results, counters);

const aggregates = {
  overall: agg(results),
  byHorizon: groupAgg(results, t => t.horizon),
  byGrade: groupAgg(results, t => t.grade || '?'),
  byDirection: groupAgg(results, t => t.dir),
  byUtcSession: groupAgg(results, t => {
    const h = t.utcHour;
    return h < 7 ? 'ASIA(00-07)' : h < 12 ? 'LONDON(07-12)' : h < 17 ? 'NY-OVERLAP(12-17)' : 'NY-LATE(17-24)';
  }),
  bySessionCohort: groupAgg(results, t => t.sessionKey || '?'),
  byClassCount: groupAgg(results, t => 'classes-' + (t.classCount == null ? '?' : t.classCount)),
  bySessionLeg: groupAgg(results, t => t.sessionLeg || 'none'),
  byStopWidened: groupAgg(results, t => t.stopWidened ? 'widened' : 'natural'),
  ticketOnly: agg(results.filter(t => t.ticket)),
  leadEligible: agg(results.filter(t => t.leadEligible)),
  nonLead: agg(results.filter(t => !t.leadEligible))
};

const settledAll = results.filter(t => t.netR != null);
const winsAll = settledAll.filter(t => t.outcome.startsWith('win'));

const meta = {
  generated: new Date().toISOString(),
  mode: SMOKE ? 'smoke' : 'full',
  symbol: SYMBOL,
  universe: 'PAXGUSDT Binance spot proxy for XAUUSD (basis ~0.1-0.5%; 24/7 weekend bars a broker never printed)',
  pipeline: 'ngAssess -> ngHtfTape -> ngConfirmations -> hgGoldFormation (requireClasses [session-htf]) -> hgSolidityGrade -> v689 kill filter, per closed native bar on BOTH tab horizons (1H + 4H)',
  bars: { h1: h1.length, h4: h4.length },
  span: h1.length ? { from: new Date(h1[0].t * 1000).toISOString(), to: new Date(h1[h1.length - 1].t * 1000).toISOString() } : null,
  feedDepth: KL_LIMIT,
  costs: {
    xm: { rtFrac: COST_XM_FRAC, basis: 'XM XAUUSD $0.35 spread / $3500 ref + 0.010% slip = 0.020% RT (hgOgVenuePresetCost constants, omnigold.js:6789-91)' },
    paxg: { rtFrac: COST_PAXG_FRAC, basis: 'PAXG spot 0.1% taker + 0.03% slip per side = 0.26% RT' },
    primary: 'xm — the tab quotes XAUUSD and the desk executes on the XM MT5 bridge; netR is XM, netR_paxg the sensitivity'
  },
  rules: {
    cadence: 'each horizon assessed once per ITS OWN closed bar (1H on the 1h grid, 4H on the 4h grid); now = bar close instant; the session leg reads the SIGNAL BAR clock via hgGoldSignalBarMs, never a wall clock',
    tradableBar: 'only FORMED cards (hgGoldFormation tradable, hg-v698 shared contract, session-htf class REQUIRED) walk as trades; WATCH / STOOD-ASIDE / KILLED fires are counted per cohort and carry no levels by design',
    dedup: 'one live trade per (horizon, dir) — NEW GOLD has no conviction store (every scan rebuilds cards); re-fires while a same-key trade is live are counted merged',
    fill: 'entry MARKET at signal close (xmOrderType rel=0 -> BUY/SELL), lib fills at bar i+1 at the entry price; pending TTL 30 native bars (moot for market orders)',
    resolution: 'first touch stop vs t1 after fill; both-touch bar = LOSS; 30 native bars after fill -> timeout MTM at close (the tab\'s own forward-log horizonBars:30, newgold.js:762). T2 recorded, never walked.',
    venue: 'stop floor priced at XM via window.HG_OG_VENUE override (omnigold.js:6833 precedence #1); XM is the live UI default (omnigold.js:6784)'
  },
  deviations: [
    'OMNIGOLD desk tape absent: omnigold.js is booted but never scans, so ngOmnigoldDeskTape (newgold.js:309-317) reads no stored tape and the 4H horizon\'s HTF-tape leg reports "no higher-timeframe read available" — the exact live degradation before OMNIGOLD\'s first scan. The 1H horizon\'s tape (4H VWMA-50 regime, newgold.js:296-307) is fully computed from the closed 4h prefix.',
    'v695/v696 OMNI lanes not walked: ngPullOmniLanes (newgold.js:492-519) sources candidates from hgOgUniformDebug()\'s ranked lists, which are empty when OMNIGOLD has not scanned — same as live before its first scan. TRIPLE-CONF+OMNI:* hybrids therefore have zero samples here.',
    'forward ledger starts empty (fresh-browser-profile semantics): hgFwdRecordScan/hgFwdResolve are not called, so hgSolidityIsKilled (v689, hg-solidity.js:279-294), hgSolGateMeasuredEdge (v685, hg-solidity.js:238-263) and G7 PRIME read zero samples — no kills, no vetoes, no promotions. The kill FILTER path itself still runs on every fire (mirroring newgold.js:781-794); it just never has evidence to fire on.',
    'venue declared XM via the documented window.HG_OG_VENUE override (omnigold.js:6833): the live UI default is XM (HG_OG_VENUE_UI_DEFAULT, omnigold.js:6784) — the venue the desk executes on; an unmounted context would otherwise fall back to PAXG costs (0.26% RT) and the 8x-RT stop floor (hgOgFormation, omnigold.js:7330) would demand 2.08% stops the live desk never prices',
    'desk-tab-params preloaded from data/desk-tab-params.json into HG_DESK_TAB_PARAMS (the browser fetches it, backtest-tab-params.js:57-73; the sandbox has no fetch) — informational only (formation.deskParams / minRR alias rows)',
    'PAXG proxy carries volume, so vwmaSeries (newgold.js:79-94) is genuinely volume-weighted; a volume-less live XAUUSD feed degrades to plain SMA by the module\'s own rule — VWMA-50 regime reads can differ from a live XAUUSD run',
    'the live tab re-scans every 5 minutes (NG_AUTO_REFRESH_MS, newgold.js:59) and re-renders the same closed-bar signal; offline each closed bar is assessed exactly once per horizon — NEW GOLD keeps no conviction store, so the re-renders add no signals, only refreshed cards',
    'getXAUCandles/hgOgFetchRows replaced by cached PAXGUSDT Binance klines (closed bars only); live-only feeds beyond candles (news, macro, order flow) are not consumed by this tab at all — participation is declared dark by the module itself (newgold.js:404-409)',
    'hgFwdRecordScan side-effects skipped: the tab records every fire to the forward log (newgold.js:743-772); the harness measures outcomes directly instead of accumulating browser-side evidence',
    'live scans see a FORMING last bar intra-bar (the 5-minute refresh exists precisely because "intra-bar price motion still moves through FVG zones", newgold.js:52-55); offline the signal bar is always the CLOSED bar — the v698 closed-bar rule. Intra-bar-only touches of an FVG zone that reverted by the close are not fires here.'
  ],
  limitations: [
    'SAME-BAR FILL->TARGET OPTIMISM: ' + counters.sameBarWins + ' of ' + winsAll.length
      + ' wins settle on the fill bar (market fills, so OHLC cannot order open->stop->t1 within it); '
      + 'both-touch bars ARE losses (' + counters.bothTouch + '). '
      + counters.sameBarAmbiguousWins + ' ambiguous LIMIT/STOP same-bar wins (market entries make this ~0).',
    'MARKET FILL AT SIGNAL CLOSE: the lib fills BUY/SELL at the entry price (= the signal bar close), ignoring any i+1 open gap; PAXG 1h/4h gaps are small but weekend proxy bars exist',
    'PORTFOLIO STATS NOT ATTAINABLE: every signal walks at 1R with unlimited concurrency (max 4 concurrent: 2 horizons x 2 dirs); read per-trade expectancy and per-group rows only',
    'grade cohorts compress: G6/G7 read an empty ledger offline, so solidity tops out below PRIME and grades cluster — read the ladder ordering, not absolute counts',
    'the 4H horizon\'s session-htf class can only confirm through the session window offline (its tape leg is dark, see deviations) — its FORMED rate is structurally lower than live-with-OMNIGOLD-running'
  ],
  counters
};

fs.writeFileSync(OUT_FILE, JSON.stringify({ meta, aggregates, trades: results, fireLog }, null, 1));

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
console.log('\n=== RESULTS (' + meta.mode + ') · trades ' + results.length + ' (settled '
  + aggregates.overall.n + ') · fires ' + counters.fires + ' (formed ' + counters.formedFires
  + ') · merged ' + counters.merged + ' · scanErrors ' + counters.scanErrors + ' ===');
for (const hzL of Object.keys(counters.horizons)){
  const s = counters.horizons[hzL];
  console.log('  [' + hzL + '] scans ' + s.scans + ' · fires ' + s.fires
    + ' · FORMED ' + s.formed + ' · WATCH ' + s.watch + ' (session-missing ' + s.watchSessionMissing + ')'
    + ' · STOOD-ASIDE ' + s.stoodAside + ' (stop-floor ' + s.stoodAsideStopFloor + ')'
    + ' · killed ' + s.killed + ' · issued ' + s.issued + ' · merged ' + s.merged
    + ' · session-leg ' + s.sessionLegConfirms + ' · tape-leg ' + s.tapeLegConfirms);
  const fr = s.fires ? (s.formed / s.fires * 100).toFixed(0) : '-';
  console.log('       FORMED rate ' + fr + '% of fires');
}
printAgg('overall', { ALL: aggregates.overall, 'ticket (FORMED+lead)': aggregates.ticketOnly,
  'lead-eligible': aggregates.leadEligible, 'non-lead': aggregates.nonLead });
printAgg('by horizon', aggregates.byHorizon);
printAgg('by solidity grade', aggregates.byGrade);
printAgg('by direction', aggregates.byDirection);
printAgg('by UTC session', aggregates.byUtcSession);
printAgg('by measured session cohort', aggregates.bySessionCohort);
printAgg('by confirmation class count', aggregates.byClassCount);
printAgg('by session-htf leg', aggregates.bySessionLeg);
printAgg('by stop widening', aggregates.byStopWidened);
console.log('\nSTATED LIMITATIONS:');
for (const lim of meta.limitations) console.log('  * ' + lim);
console.log('\nwritten: ' + OUT_FILE);
