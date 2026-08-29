/* HARDGATE — OMNIGOLD setup backtest harness (offline, node ESM).
   Run:  node scripts/backtest-omnigold.mjs [--smoke] [--bars=N] [--no-engines] [--refresh]

   WHAT THIS REPLAYS
   -----------------
   The OMNIGOLD scan path, bar by bar, with zero lookahead:
     hgOgDetect(prefix, {nowSec}) -> hgOgEvaluate(prefix, hits, extra, cfg)
   on PAXGUSDT Binance SPOT bars (the same proxy the module's own header used
   to measure itself: "1,000 live PAXG bars per horizon", omnigold.js:209).
   SCALP walks native 1h bars, SWING walks native 4h bars — the same
   timeframes the live scan fetches (HORIZONS, omnigold.js:223-228).
   FVG-FILL and ROUND-MAGNET are not separate pipelines; they are kinds
   inside hgOgDetect and are replayed with everything else (~55 kinds).
   GOLD-ENGINE setups (goldScalpSetups / goldSwingSetups) are replayed too,
   on the 1h grid, over the window where 15m bars exist. SELECTION uses the
   LIVE desk selector: the ranked engine output is packed into the same
   bridge object hgOgRunGoldTabEngines returns and fed to
   hgOgPickGoldEngineForMp (omnigold.js:6046/6101, the exact function the
   desk calls at 7380-7381) — ONE grade-gated pick per horizon per bar:
   grade A / B(tally>=5) first, tape-aligned preferred, against-tape
   fallback, C only as the MP fallback, D/vetoed never. The pick is bridged
   with hgOgBridgeSetupToPick and scored with the grade-based scalar
   fallback of hgOgAdvancedConfluenceScore, as the live tab does; its
   engineGrade is recorded on the trade row and ENGINE aggregates are
   split by grade letter (never pooled with scan 0-100 scores).

   LOADING UNDER NODE
   ------------------
   Same vm-sandbox recipe as tests/test-omnigold-mechanics.mjs:38-55 (window
   = ctx, stub localStorage/document, run the classic scripts in app order).
   ONE SOURCE PATCH, documented: hgOgAdvancedConfluenceScore and
   hgOgCompositeScore are NOT window-exported in omnigold.js (only
   hgOgManualRefresh at 4979-4981 is). Rather than duplicating them, this
   harness injects two extra `window.X = X;` lines at that existing export
   block before eval, so the REAL functions run verbatim. The injection is
   asserted; the run aborts if the anchor or the functions are missing.
   hgWilson lives in index.html (line 6624) and is not in any .js module, so
   its 14-line formula is copied verbatim below and installed in the sandbox
   (used both by the app's own hgOgWilsonHit and by this harness's
   walk-forward evidence ledger).

   CONFLUENCE AT FIRE TIME (zero lookahead)
   ----------------------------------------
   A scan candidate has its levels under .plan and no gateConf/composite
   fields; fed raw to hgOgAdvancedConfluenceScore it scores near 0 (the trap
   in the recon spec). So each candidate is FLATTENED to the setupObj shape
   hgOgUpdateOpenSetups builds (omnigold.js:4811-4853):
     gateConf   = stack3 = #(regime-fit, htf-confirm, hurst-regime) PASS
                  (same derivation as the forward-log record, 6881-6888)
     checks     = replicated VERBATIM from 4811-4818 — including the live
                  quirk that checks.riskReward uses the SIGNED ratio
                  (t1-entry)/(stop-entry), which is negative for every
                  well-formed plan, so riskReward is false and checksPass
                  tops out at 4 (12/15 pts). Deliberately not "fixed".
     corrRegime = 'NORMAL' (its live default; the live value needs the DXY
                  fetch at 366-385 which does not exist offline)
     wilsonLo   = Wilson 95% lower bound (FRACTION 0..1, as the live
                  evidence.wilson.lo is) from THIS replay's own settled
                  record for the mechanic+horizon so far. Starts NaN -> 0
                  pts, grows as trades settle. Because the live code
                  multiplies a 0..1 fraction by 0.3 against a 15-pt cap,
                  this factor contributes at most ~0.3 pts (live quirk,
                  replicated, not fixed).
     age        = 0 at fire time -> freshness 5 pts.
   Max observed score here: ~78 (25+20+16.1+12+~0.3+5 = 78.4 by the app's
   own arithmetic) -> EXCEPTIONAL (>=85) is unreachable for scan setups
   offline. SCAN tiers and ENGINE grades are therefore reported separately
   (see aggregates.byTier) — pooling them would be a composition artifact.

   OUTCOME RESOLUTION (LIB semantics: lib/omnigold-xm-bot-backtest.mjs
   ogXmBotWalkTrade + the requirements' additions — deliberately NOT the
   desk panel's hgOgUpdateSetupStatus at omnigold.js:4694, which marks
   'profit'/'stopped' on a live-price cross with NO fill requirement; the
   lib walk is stricter and more realistic: fill required, stop-first,
   unfilled != loss)
   ----------------------------
   - signal fires on the CLOSE of bar i; fills are searched from bar i+1
     (ogXmBotWalkTrade does the same)
   - pending order at plan.entry, order type from xmOrderType(dir, entry,
     close[i]) (shared lib), fill test = ogXmBarTouchesEntry (shared lib)
   - untriggered after cfg.horizonBars bars (24 on 1h SCALP, 20 on 4h SWING)
     -> 'unfilled', NOT a loss (the app's own staleness rule: fillBars =
     horizonBars in hgOgXmBtWalkHorizon, and unfilled != loss in the lib)
   - after the fill: first touch of stop vs t1; a bar that spans BOTH is a
     LOSS (conservative, same as the lib's stop-first; counted separately)
   - still open 96 bars after the fill -> 'timeout', exit at that bar close,
     R marked to market
   - FEES: 0.10% taker per side + 0.03% slippage per side = 0.26% of entry
     round trip; costR = entry*0.0026/risk; netR = grossR - costR. (PAXG
     spot, not the $0.30/oz XM spread model — spot taker + wide PAXG book.)

   DEDUP: one live trade per (horizon, kind, dir); a signal for a key that
   already has a pending or filled trade is skipped and counted.

   KNOWN DEVIATIONS / ASSUMPTIONS (also in the output JSON meta)
   ------------------------------------------------------------
   1. PAXG trades 24/7 -> session mechanics (ASIA-BREAK, LONDON-FIX,
      NY-OPEN-DRIVE, WEEKLY-OPEN...) fire on weekend bars a spot-gold broker
      never printed (omnigold.js itself warns at 3510-3512). PAXG basis vs
      XAU ~0.1-0.5%; thin volume degrades participation gates to UNCHECKED.
   2. extra{} for hgOgEvaluate mirrors hgOgXmBtExtra (7551-7579) minus the
      live-only feeds: macro/news/yieldRows undefined, stats (in-sample
      pooled walk-forward) null, zoneCtx null (opAssess lives in
      omnipresent.js, not loaded). Those gates degrade to UNCHECKED — the
      same honest degradation the module was built around.
   3. SMT-DIVERGE sees no silver series (window.__hgXagCandles unset) and
      GSR-EXTREME likewise -> they never fire here. Not a code deviation:
      the detector returns null without the pair, by design.
   4. Engine setups resolve on the 1h grid for both engine horizons (the
      swing engine's own tab settles on 4h closes); fill window 24 (scalp) /
      80 (swing, = 20 4h bars) 1h bars, timeout 96 1h bars. Simplification.
      Selection is the live one-pick-per-horizon path (see above), with two
      residual deviations: (a) the live desk only SURFACES the engine pick
      when the scan produced no MP pick for that horizon (7380-7381) — the
      harness measures the engine pick unconditionally every bar to sample
      the engine path itself; (b) hgOgApplyBridgeBestLevels refinement is
      not applied (gold-best-levels.js not loaded offline).
   5. Prefix passed to the generators is capped at the trailing 1500 bars —
      the live scan never sees more (HORIZONS bars: 1500).
   6. Evidence for wilsonLo is per (horizon, mechanic) from this replay only
      (empty at the start). The live app merges localStorage tabs this
      harness does not have. Both start from zero the same way.
   Style: modeled on scripts/scalp-audit.mjs. No new dependencies. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { xmOrderType, ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const CACHE_DIR = path.join(ROOT, 'scripts', '.bt-cache');
const OUT_FILE = path.join(ROOT, 'scripts', 'backtest-omnigold-results.json');

/* ---------- CLI ---------- */
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(name + '='));
  return a ? a.split('=')[1] : dflt;
};
const SMOKE = has('--smoke');
const NO_ENGINES = has('--no-engines');
const REFRESH = has('--refresh');
const BARS_1H = +opt('--bars', SMOKE ? 500 : 4000);

/* ---------- constants ---------- */
const SYMBOL = 'PAXGUSDT';
const FEE_SIDE = 0.0010;          /* Binance spot taker */
const SLIP_SIDE = 0.0003;         /* PAXG book is thin */
const COST_RT_FRAC = 2 * (FEE_SIDE + SLIP_SIDE);   /* 0.26% of entry, round trip */
const TIMEOUT_BARS = 96;          /* bars AFTER the fill, then exit at close */
const PREFIX_CAP = 1500;          /* live scan fetches 1500 bars max */
const TIER = s => s >= 85 ? 'EXCEPTIONAL' : s >= 70 ? 'STRONG' : s >= 50 ? 'FAIR' : 'WEAK';

/* Wilson score interval — copied VERBATIM from index.html:6624 (hgWilson).
   It lives only in index.html, unreachable from any module load. */
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

/* ==================== 1. DATA — Binance spot klines, cached ==================== */

const IV_SEC = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-omnigold-backtest/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.json();
}

/* Paginate backwards to ~target bars; ascending {t(sec),o,h,l,c,v}; forming bar dropped. */
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
  /* drop the forming bar (its close time is in the future) */
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
      /* a smaller cached fetch (e.g. from a smoke run) never satisfies a
         bigger request — only >= target counts as a hit */
      if (j.rows && j.rows.length >= target && ageH < 6){
        console.log('  cache hit ' + interval + ': ' + j.rows.length + ' bars ('
          + ageH.toFixed(1) + 'h old)');
        return j.rows.slice(-target);
      }
      if (j.rows && j.rows.length >= target && ageH < 96){
        console.log('  cache hit (stale-ok) ' + interval + ': ' + j.rows.length + ' bars');
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

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  ctx.hgWilson = hgWilson;   /* index.html-only global the modules feature-check */
  vm.createContext(ctx);

  const REQUIRED = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                    'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js'];
  const OPTIONAL = ['goldind.js', 'goldswing.js'];   /* engines + goldKillzone (KZ-JUDAS) */
  for (const f of REQUIRED){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  const optLoaded = [];
  for (const f of OPTIONAL){
    try {
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
      optLoaded.push(f);
    } catch (e) {
      console.log('  WARN: optional ' + f + ' failed to load (' + e.message + ') — continuing');
    }
  }

  /* SOURCE PATCH (documented in header): export the two non-exported pure
     functions by adding lines to the EXISTING export block at 4979-4981.
     The functions are function declarations, hoisted inside the IIFE, so
     assignment at that point is valid. Verbatim code, no duplication. */
  let SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  const ANCHOR = 'window.hgOgManualRefresh = hgOgManualRefresh;';
  if (!SRC.includes(ANCHOR)) throw new Error('injection anchor not found in omnigold.js — source drifted');
  SRC = SRC.replace(ANCHOR, ANCHOR
    + '\n    window.hgOgAdvancedConfluenceScore = hgOgAdvancedConfluenceScore;'
    + '\n    window.hgOgCompositeScore = hgOgCompositeScore;');
  vm.runInContext(SRC, ctx, { filename: 'omnigold.js(patched-exports)' });

  for (const fn of ['hgOgDetect', 'hgOgEvaluate', 'hgOgHorizonCfg', 'hgOgAdr', 'hgOgTapeDir',
                    'hgOmniDailyHtf', 'hgOgAdvancedConfluenceScore', 'hgOgCompositeScore',
                    'hgOgBridgeSetupToPick', 'hgOgPickGoldEngineForMp', 'hgOgDeskTape']){
    if (typeof ctx[fn] !== 'function') throw new Error('boot failed: ' + fn + ' is not a function');
  }
  ctx.__optLoaded = optLoaded;
  return ctx;
}

/* ==================== 3. per-bar extra{} (mirror of hgOgXmBtExtra) ==================== */

function btExtra(W, prefix){
  const last = prefix[prefix.length - 1];
  const livePx = +last.c;
  const nowSec = +last.t;
  let killzone = null;
  try { if (typeof W.goldKillzone === 'function') killzone = W.goldKillzone(nowSec * 1000); } catch (e) {}
  return {
    htf: (typeof W.hgOmniDailyHtf === 'function') ? W.hgOmniDailyHtf(prefix) : null,
    killzone,
    macro: undefined,            /* live-only feed */
    yieldRows: undefined,        /* live-only feed */
    nowSec,
    adr: W.hgOgAdr(prefix, 14),
    news: undefined,             /* live-only feed */
    stats: null,                 /* in-sample pooled walk-forward: not built offline */
    livePx,
    zoneCtx: null                /* opAssess lives in omnipresent.js (not loaded) */
  };
}

/* ==================== 4. confluence at fire time ==================== */

function gatePass(gates, key){
  return !!(gates || []).some(g => g && g.key === key && g.pass === true);
}

/* evidence: Map('<HORIZON>|<KIND>' -> {wins, n}) — settled BEFORE this bar only */
function confluenceForCandidate(W, cand, evidence){
  const p = cand.plan;
  const entry = +p.entry, stop = +p.stop, t1 = +p.t1;
  const stack3 = ['regime-fit', 'htf-confirm', 'hurst-regime']
    .reduce((n, k) => n + (gatePass(cand.gates, k) ? 1 : 0), 0);
  /* VERBATIM replication of the live checks (omnigold.js:4811-4818),
     including the signed-ratio riskReward quirk. */
  const checks = {
    htfRegime: gatePass(cand.gates, 'htf-confirm'),
    gate1h: gatePass(cand.gates, 'regime-fit'),
    corrNorm: true,          /* corrRegime 'NORMAL' !== 'EXTREME' */
    drawdownOk: true,
    riskReward: ((t1 - entry) / (stop - entry) >= 1.5) || Number.isNaN(t1 - entry)
  };
  const checksPass = Object.keys(checks).filter(k => checks[k]).length;
  const ev = evidence.get(cand.horizon + '|' + cand.kind);
  const wl = (ev && ev.n > 0) ? hgWilson(ev.wins, ev.n) : null;
  const setupObj = {
    barT: 0,
    entry, t1, stop,
    age: 0,                          /* fire time */
    mechanic: cand.kind,
    gateConf: stack3,
    checks, checksPass,
    wilsonLo: wl ? wl.lo : NaN,      /* FRACTION, exactly what the live app feeds */
    corrRegime: 'NORMAL'
  };
  setupObj.compositeScore = W.hgOgCompositeScore(setupObj, 'NORMAL');
  const res = W.hgOgAdvancedConfluenceScore(setupObj);
  const score = (typeof res === 'number') ? res : res.score;
  return { score, tier: TIER(score), gateConf: stack3, checksPass,
           compositeScore: Math.round(setupObj.compositeScore * 10) / 10 };
}

/* Engine setups: the scalar grade fallback (setup.engineGrade && !setup.gateConf). */
function confluenceForEngine(W, bridge){
  const res = W.hgOgAdvancedConfluenceScore({
    engineGrade: bridge.engineGrade,
    engineTally: bridge.engineTally,
    engineDemoted: bridge.engineDemoted
  });
  const score = (typeof res === 'number') ? res : res.score;
  return { score, tier: TIER(score) };
}

/* ==================== 5. trade lifecycle ==================== */

function newTrade(sig){
  return Object.assign({ state: 'pending', waitBars: 0, fillIdx: null }, sig);
}

/* Advance one open trade across bar `bar` at index bi. Returns true when resolved. */
function stepTrade(tr, bar, bi, fillWindow){
  const { dir, entry, stop, t1 } = tr;
  const hitStop = dir === 'long' ? +bar.l <= stop : +bar.h >= stop;
  const hitT1 = dir === 'long' ? +bar.h >= t1 : +bar.l <= t1;
  if (tr.state === 'pending'){
    if (ogXmBarTouchesEntry(tr.orderType, dir, bar, entry)){
      tr.state = 'filled';
      tr.fillIdx = bi;
      /* fall through: the fill bar itself can settle the trade (lib does the same) */
    } else {
      tr.waitBars++;
      if (tr.waitBars >= fillWindow){
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

function settleRecord(tr, rows, tfSec, counters, evidence, results){
  const costR = (tr.rGross == null) ? null
    : (tr.entry * COST_RT_FRAC) / Math.abs(tr.stop - tr.entry);
  const netR = (tr.rGross == null) ? null : tr.rGross - costR;
  if (tr.outcome === 'win' || tr.outcome === 'loss'){
    const key = tr.horizon + '|' + tr.kind;
    const ev = evidence.get(key) || { wins: 0, n: 0 };
    ev.n++; if (tr.outcome === 'win') ev.wins++;
    evidence.set(key, ev);
  }
  if (tr.bothTouch) counters.bothTouch++;
  /* Same-bar fill->exit bookkeeping (stated limitation): a win printed on
     the fill bar itself is resolved pro-strategy; for LIMIT/STOP fills the
     OHLC cannot prove the entry touch preceded the target print. */
  const sameBarExit = (tr.fillIdx != null && tr.exitIdx === tr.fillIdx);
  const pendingFill = /LIMIT|STOP/.test(String(tr.orderType || ''));
  const ambiguousWin = (tr.outcome === 'win' && sameBarExit && pendingFill);
  if (tr.outcome === 'win' && sameBarExit){
    counters.sameBarWins++;
    if (pendingFill) counters.sameBarAmbiguousWins++;
  }
  results.push({
    tISO: new Date(rows[tr.sigIdx].t * 1000).toISOString(),
    source: tr.source, horizon: tr.horizon,
    kind: tr.kind, dir: tr.dir,
    entry: +tr.entry.toFixed(2), stop: +tr.stop.toFixed(2), t1: +tr.t1.toFixed(2),
    ticket: !!tr.ticket,
    confluence: tr.confluence, tier: tr.tier,
    engineGrade: tr.source === 'ENGINE' ? (tr.engineGrade || '?') : undefined,
    engineAgainstTape: tr.source === 'ENGINE' ? !!tr.engineAgainstTape : undefined,
    gateConf: tr.gateConf, checksPass: tr.checksPass,
    orderType: tr.orderType,
    sameBarExit: sameBarExit || undefined,
    ambiguousSameBarWin: ambiguousWin || undefined,
    outcome: tr.outcome + (tr.bothTouch ? ' (both-touch)' : ''),
    rMultiple: tr.rGross == null ? null : +tr.rGross.toFixed(3),
    netR: netR == null ? null : +netR.toFixed(3),
    barsHeld: tr.fillIdx == null ? null : (tr.exitIdx - tr.fillIdx),
    exitISO: tr.exitIdx == null ? null : new Date(rows[tr.exitIdx].t * 1000).toISOString()
  });
}

/* ==================== 6. THE WALK — core scan path ==================== */

function walkCore(W, rows, cfgLabel, evidence, results, counters){
  const cfg = W.hgOgHorizonCfg(cfgLabel);
  const tfSec = IV_SEC[cfg.tf];
  const active = new Map();       /* 'KIND|dir' -> trade */
  const t0 = Date.now();
  for (let i = cfg.warm; i < rows.length; i++){
    const bar = rows[i];
    /* 1. advance open trades on this bar (signals from earlier bars only) */
    for (const [key, tr] of active){
      if (tr.sigIdx >= i) continue;
      if (stepTrade(tr, bar, i, cfg.horizonBars)){
        settleRecord(tr, rows, tfSec, counters, evidence, results);
        active.delete(key);
      }
    }
    /* 2. detect + evaluate on the closed prefix (zero lookahead) */
    const prefix = rows.slice(Math.max(0, i + 1 - PREFIX_CAP), i + 1);
    let cands = [];
    try {
      const hits = W.hgOgDetect(prefix, { nowSec: +bar.t });
      if (hits && hits.length){
        cands = W.hgOgEvaluate(prefix, hits, btExtra(W, prefix), cfg) || [];
      }
    } catch (e) { counters.evalErrors++; }
    for (const c of cands){
      const p = c.plan;
      if (!p || !isFinite(+p.entry) || !isFinite(+p.stop) || !isFinite(+p.t1)){ counters.noPlan++; continue; }
      const long = c.dir === 'long';
      if (long && !(+p.stop < +p.entry && +p.t1 > +p.entry)){ counters.badGeometry++; continue; }
      if (!long && !(+p.stop > +p.entry && +p.t1 < +p.entry)){ counters.badGeometry++; continue; }
      const key = c.kind + '|' + c.dir;
      if (active.has(key)){ counters.skippedOverlap++; continue; }
      const conf = confluenceForCandidate(W, c, evidence);
      counters.signals++;
      active.set(key, newTrade({
        source: 'SCAN', horizon: cfg.label, kind: c.kind, dir: c.dir,
        entry: +p.entry, stop: +p.stop, t1: +p.t1,
        ticket: !!(c.grade && c.grade.ticket),
        confluence: conf.score, tier: conf.tier,
        gateConf: conf.gateConf, checksPass: conf.checksPass,
        orderType: xmOrderType(c.dir, +p.entry, +bar.c).name,
        sigIdx: i
      }));
    }
    if ((i - cfg.warm) % 250 === 0){
      console.log('  [' + cfg.label + '] bar ' + i + '/' + rows.length
        + ' · open ' + active.size + ' · settled ' + results.length
        + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
  }
  /* unresolved at data end: tracked, not settled */
  for (const tr of active.values()){
    counters.openAtEnd++;
  }
}

/* ==================== 7. THE WALK — gold engines (1h grid) ==================== */

function sliceByCutoff(rows, tfSec, cutoffSec){
  /* bars fully CLOSED at cutoff: t + tfSec <= cutoff */
  let lo = 0, hi = rows.length;
  while (lo < hi){ const m = (lo + hi) >> 1; (rows[m].t + tfSec <= cutoffSec) ? lo = m + 1 : hi = m; }
  return rows.slice(0, lo);
}

function walkEngines(W, rows1h, m15, h4, d1, evidence, results, counters){
  if (typeof W.goldScalpSetups !== 'function' && typeof W.goldSwingSetups !== 'function'){
    console.log('  engines unavailable (goldind.js/goldswing.js not loaded) — skipped');
    return;
  }
  const active = new Map();
  const FILL = { SCALP: 24, SWING: 80 };   /* 1h bars; SWING = 20 4h bars */
  /* only walk where 15m coverage exists with some warmup */
  const m15start = m15.length ? m15[0].t + 200 * 900 : Infinity;
  let first = rows1h.findIndex(r => r.t >= m15start);
  if (first < 0){ console.log('  engines: no 15m coverage overlap — skipped'); return; }
  first = Math.max(first, 60);
  const t0 = Date.now();
  for (let i = first; i < rows1h.length; i++){
    const bar = rows1h[i];
    for (const [key, tr] of active){
      if (tr.sigIdx >= i) continue;
      if (stepTrade(tr, bar, i, FILL[tr.horizon] || 24)){
        settleRecord(tr, rows1h, 3600, counters, evidence, results);
        active.delete(key);
      }
    }
    const cutoff = bar.t + 3600;
    /* Cap each slice to the row counts the LIVE bridge feeds the engines
       (hgOgRunGoldTabEngines fetches 15m x500 and 1d x400 at 6178-6179;
       rows1h/rows4h are the scan's <=1500-bar series). Uncapped 15m input
       is also ~50x slower in goldScalpSetups — the cap is both faithful
       and what makes a bar-by-bar replay tractable. */
    const inp = {
      rows15m: sliceByCutoff(m15, 900, cutoff).slice(-500),
      rows1h: sliceByCutoff(rows1h, 3600, cutoff).slice(-PREFIX_CAP),
      rows4h: sliceByCutoff(h4, 14400, cutoff).slice(-PREFIX_CAP),
      rows1d: sliceByCutoff(d1, 86400, cutoff).slice(-400),
      now: cutoff * 1000,
      macro: undefined, news: undefined
    };
    /* FATAL-1 fix: replicate the LIVE selection, not a broad universe.
       Pack the ranked engine output into the same bridge shape
       hgOgRunGoldTabEngines returns ({ok, scalp:{ranked,best}, swing:{...}},
       omnigold.js:6194-6225) and let hgOgPickGoldEngineForMp — the exact
       function the desk calls at 7380-7381 — take ONE grade-gated pick per
       horizon: A/B(tally>=5) tape-aligned first, against-tape fallback,
       C only as MP fallback, D/vetoed never. tapeDir derived exactly as the
       desk does (7232-7234): hgOgDeskTape(tape(1h), tape(4h)). */
    const picks = [];
    try {
      let scalpOut = { ranked: [], best: null, rejected: [] };
      if (typeof W.goldScalpSetups === 'function'){
        const got = W.goldScalpSetups(inp);
        const cands = Array.isArray(got) ? got : [];
        if (typeof W.goldRankSetups === 'function'){
          /* ctx mirrors hgOgRunGoldTabEngines (6199-6200) minus goldPro:
             goldProState lives in goldpro.js (live-feed module, not loaded
             offline) — degrades like macro/news; listed in meta.deviations. */
          const ctx = { now: inp.now, macro: undefined, goldPro: undefined,
                        crossVenue: (typeof W.goldCrossVenueMap === 'function') ? W.goldCrossVenueMap(cands) : null };
          scalpOut = W.goldRankSetups(cands, ctx) || { ranked: cands, best: cands[0] || null };
        } else {
          scalpOut = { ranked: cands, best: cands[0] || null };
        }
      }
      const swingOut = (typeof W.goldSwingSetups === 'function')
        ? (W.goldSwingSetups(inp) || { ranked: [], best: null })
        : { ranked: [], best: null };
      const bridgeObj = { ok: true, scalp: scalpOut, swing: swingOut };
      const deskTape = W.hgOgDeskTape(W.hgOgTapeDir(inp.rows1h), W.hgOgTapeDir(inp.rows4h));
      const eScalp = W.hgOgPickGoldEngineForMp(bridgeObj, 'SCALP', deskTape);
      if (eScalp) picks.push([eScalp, 'SCALP']);
      const eSwing = W.hgOgPickGoldEngineForMp(bridgeObj, 'SWING', deskTape);
      if (eSwing) picks.push([eSwing, 'SWING']);
    } catch (e) { counters.engineErrors++; }
    for (const [bridge, horizon] of picks){
      /* bridge is already the hgOgBridgeSetupToPick output, with
         engineGrade/engineTally/engineDemoted/engineAgainstTape set by the
         live picker. */
      if (!bridge || !bridge.plan) { counters.noPlan++; continue; }
      const p = bridge.plan;
      if (!isFinite(p.entry) || !isFinite(p.stop) || !isFinite(p.t1)){ counters.noPlan++; continue; }
      const long = bridge.dir === 'long';
      if (long && !(p.stop < p.entry && p.t1 > p.entry)){ counters.badGeometry++; continue; }
      if (!long && !(p.stop > p.entry && p.t1 < p.entry)){ counters.badGeometry++; continue; }
      const key = 'ENG:' + horizon + '|' + bridge.kind + '|' + bridge.dir;
      if (active.has(key)){ counters.skippedOverlap++; continue; }
      const conf = confluenceForEngine(W, bridge);
      const gradeLabel = (bridge.engineGrade ? String(bridge.engineGrade).toUpperCase() : '?')
        + (bridge.engineDemoted ? '-demoted' : '');
      counters.signals++;
      active.set(key, newTrade({
        source: 'ENGINE', horizon, kind: bridge.kind, dir: bridge.dir,
        entry: p.entry, stop: p.stop, t1: p.t1,
        ticket: false,   /* engine picks are never OMNIGOLD tickets (grade.ticket:false) */
        confluence: conf.score, tier: conf.tier,
        engineGrade: gradeLabel,
        engineAgainstTape: !!bridge.engineAgainstTape,
        engineLowGrade: !!bridge.engineLowGrade,
        gateConf: null, checksPass: null,
        orderType: xmOrderType(bridge.dir, p.entry, +bar.c).name,
        sigIdx: i
      }));
    }
    if ((i - first) % 250 === 0){
      console.log('  [ENGINES] bar ' + i + '/' + rows1h.length
        + ' · open ' + active.size + ' · ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
  }
  for (const tr of active.values()) counters.openAtEnd++;
}

/* ==================== 8. aggregates ==================== */

function agg(trades){
  const settled = trades.filter(t => t.netR != null);
  const wins = settled.filter(t => t.outcome.startsWith('win')).length;
  const sumNet = settled.reduce((s, t) => s + t.netR, 0);
  const pos = settled.filter(t => t.netR > 0).reduce((s, t) => s + t.netR, 0);
  const neg = settled.filter(t => t.netR < 0).reduce((s, t) => s - t.netR, 0);
  let cum = 0, peak = 0, maxDD = 0;
  for (const t of settled.slice().sort((a, b) => (a.exitISO || '').localeCompare(b.exitISO || ''))){
    cum += t.netR; if (cum > peak) peak = cum;
    if (peak - cum > maxDD) maxDD = peak - cum;
  }
  const sumGross = settled.reduce((s, t) => s + (t.rMultiple || 0), 0);
  return {
    n: settled.length,
    unfilled: trades.filter(t => t.outcome === 'unfilled').length,
    winRate: settled.length ? +(wins / settled.length).toFixed(3) : null,
    avgR_gross: settled.length ? +(sumGross / settled.length).toFixed(3) : null,
    avgR_net: settled.length ? +(sumNet / settled.length).toFixed(3) : null,
    expectancy_net: settled.length ? +(sumNet / settled.length).toFixed(3) : null,
    profitFactor: neg > 0 ? +(pos / neg).toFixed(2) : (pos > 0 ? Infinity : null),
    sumR_net: +sumNet.toFixed(2),
    maxDD_R: +maxDD.toFixed(2)
  };
}

function groupAgg(trades, keyFn){
  const groups = {};
  for (const t of trades){ const k = keyFn(t); (groups[k] = groups[k] || []).push(t); }
  const out = {};
  for (const k of Object.keys(groups).sort()) out[k] = agg(groups[k]);
  return out;
}

function quartileLabels(trades){
  const settled = trades.filter(t => t.netR != null).map(t => t.confluence).sort((a, b) => a - b);
  if (settled.length < 4) return () => 'Q?';
  const q = p => settled[Math.min(settled.length - 1, Math.floor(p * settled.length))];
  const q1 = q(0.25), q2 = q(0.5), q3 = q(0.75);
  const fn = t => t.confluence <= q1 ? 'Q1(<=' + q1 + ')' : t.confluence <= q2 ? 'Q2(<=' + q2 + ')'
              : t.confluence <= q3 ? 'Q3(<=' + q3 + ')' : 'Q4(>' + q3 + ')';
  fn.bounds = { q1, q2, q3 };
  return fn;
}

/* ==================== 9. main ==================== */

console.log('=== OMNIGOLD backtest harness — ' + (SMOKE ? 'SMOKE RUN' : 'FULL RUN')
  + ' · ' + new Date().toISOString() + ' ===');
console.log('symbol ' + SYMBOL + ' · 1h bars ' + BARS_1H + ' · fees ' + (FEE_SIDE * 100)
  + '%/side + ' + (SLIP_SIDE * 100) + '%/side slip · timeout ' + TIMEOUT_BARS + ' bars');

const rows1h = await cachedKlines(SYMBOL, '1h', SMOKE ? BARS_1H : Math.max(BARS_1H, 4000));
const rows4h = await cachedKlines(SYMBOL, '4h', Math.max(120, Math.ceil(BARS_1H / 4) + 60));
const m15 = NO_ENGINES ? [] : await cachedKlines(SYMBOL, '15m', 3000);
const d1 = NO_ENGINES ? [] : await cachedKlines(SYMBOL, '1d', 400);

const h1 = rows1h.slice(-BARS_1H);
const h4 = rows4h.slice(-(Math.ceil(BARS_1H / 4) + 60));

console.log('booting app modules in vm sandbox...');
const W = boot();
console.log('  loaded (optional: ' + (W.__optLoaded.join(', ') || 'none') + ')');
console.log('  goldKillzone ' + (typeof W.goldKillzone === 'function' ? 'present (KZ-JUDAS reachable)' : 'ABSENT'));

const results = [];
const evidence = new Map();
const counters = { signals: 0, skippedOverlap: 0, noPlan: 0, badGeometry: 0,
                   evalErrors: 0, engineErrors: 0, openAtEnd: 0, bothTouch: 0,
                   sameBarWins: 0, sameBarAmbiguousWins: 0 };

console.log('walking SCALP (1h, ' + h1.length + ' bars)...');
walkCore(W, h1, 'SCALP', evidence, results, counters);
console.log('walking SWING (4h, ' + h4.length + ' bars)...');
walkCore(W, h4, 'SWING', evidence, results, counters);
if (!NO_ENGINES){
  console.log('walking GOLD ENGINES (1h grid, 15m coverage window)...');
  walkEngines(W, h1, m15, h4, d1, evidence, results, counters);
} else {
  console.log('engines skipped (--no-engines)');
}

/* ---------- aggregate + write ---------- */
/* FATAL-2 fix: scan multi-factor 0-100 scores and engine grade scalars
   (85/75/70/60/45/35) are INCOMMENSURABLE scoring regimes. They are never
   pooled: byTier keys SCAN rows by tier on the 0-100 scale and ENGINE rows
   by grade letter (the old pooled EXCEPTIONAL row was just engine grade-A);
   confluence quartiles are computed over SCAN trades only. */
const scanTrades = results.filter(t => t.source === 'SCAN');
const qfn = quartileLabels(scanTrades);
const aggregates = {
  overall: agg(results),
  bySource: groupAgg(results, t => t.source + ':' + t.horizon),
  byKind: groupAgg(results, t => t.kind),
  byTier: groupAgg(results, t => t.source === 'ENGINE'
    ? 'ENGINE grade-' + (t.engineGrade || '?')
    : 'SCAN ' + t.tier),
  byTierNote: 'SCAN rows: 0-100 multi-factor score tiers (EXCEPTIONAL>=85 unreachable offline by the app arithmetic). '
    + 'ENGINE rows: grade letters from the live selector — a separate scalar scale (A=85, B=75/60, C=70/45...). '
    + 'The two regimes are never pooled; a pooled tier table would be a composition artifact.',
  byConfluenceQuartile: groupAgg(scanTrades.filter(t => t.netR != null), qfn),
  quartileBounds: qfn.bounds || null,
  quartileNote: 'quartiles over SCAN trades only (0-100 scale); ENGINE trades live on a grade-letter scale — see byTier ENGINE rows'
};

/* Within-regime monotonicity check (stated in the report either way). */
function winPctSeq(groups, order){
  const parts = [], seq = [];
  for (const k of order){
    const a = groups[k];
    if (!a || !a.n) continue;
    seq.push(a.winRate);
    parts.push(k + ' ' + Math.round(a.winRate * 100) + '% (n=' + a.n + ')');
  }
  const monotonic = seq.every((v, i) => i === 0 || v >= seq[i - 1]);
  return { text: parts.join(' -> '), monotonic, bands: seq.length };
}
const tierSeq = winPctSeq(aggregates.byTier,
  ['SCAN WEAK', 'SCAN FAIR', 'SCAN STRONG', 'SCAN EXCEPTIONAL']);
const quartSeq = winPctSeq(aggregates.byConfluenceQuartile,
  Object.keys(aggregates.byConfluenceQuartile).sort());

const distBuckets = { SCAN: {}, ENGINE: {} };
for (const t of results){
  const b = Math.min(90, Math.floor(t.confluence / 10) * 10);
  const bag = distBuckets[t.source] || (distBuckets[t.source] = {});
  bag[b + '-' + (b + 10)] = (bag[b + '-' + (b + 10)] || 0) + 1;
}

/* Quantify the same-bar fill->target optimism (stated limitation). */
const settledAll = results.filter(t => t.netR != null);
const winsAll = settledAll.filter(t => t.outcome.startsWith('win'));
const ambigWins = settledAll.filter(t => t.ambiguousSameBarWin);
const exAmbig = settledAll.filter(t => !t.ambiguousSameBarWin);
const exAmbigWins = exAmbig.filter(t => t.outcome.startsWith('win'));
const winRateAll = settledAll.length ? winsAll.length / settledAll.length : null;
const winRateExAmbig = exAmbig.length ? exAmbigWins.length / exAmbig.length : null;

const meta = {
  generated: new Date().toISOString(),
  mode: SMOKE ? 'smoke' : 'full',
  symbol: SYMBOL,
  universe: 'PAXGUSDT proxy for XAUUSD',
  proxyNote: 'PAXGUSDT Binance spot as XAU proxy (the module docs measured on PAXG). '
    + 'PAXG trades 24/7: session mechanics fire on weekend bars a spot-gold broker never printed. '
    + 'Basis vs XAU ~0.1-0.5%; thin volume degrades participation gates to UNCHECKED.',
  bars: { h1: h1.length, h4: h4.length, m15: m15.length, d1: d1.length },
  barCount: h1.length,
  span: h1.length ? { from: new Date(h1[0].t * 1000).toISOString(), to: new Date(h1[h1.length - 1].t * 1000).toISOString() } : null,
  fees: { takerPerSide: FEE_SIDE, slipPerSide: SLIP_SIDE, roundTripFrac: COST_RT_FRAC },
  feeModel: (FEE_SIDE * 100) + '% taker/side + ' + (SLIP_SIDE * 100) + '% slippage/side = '
    + (COST_RT_FRAC * 100).toFixed(2) + '% of entry round trip; costR = entry*' + COST_RT_FRAC + '/|stop-entry|',
  rules: {
    fill: 'pending order at plan.entry from bar sigIdx+1; type via xmOrderType; touch via ogXmBarTouchesEntry (shared lib)',
    unfilled: 'not triggered within horizonBars (24 scalp-1h / 20 swing-4h / 24-80 engine-1h) -> unfilled, not a loss',
    resolution: 'LIB walk semantics (lib/omnigold-xm-bot-backtest.mjs ogXmBotWalkTrade): fill required, first touch stop vs t1, '
      + 'same-bar both-touch = LOSS (counted); 96 bars after fill -> timeout, MTM exit at close. Deliberately NOT the desk '
      + 'panel hgOgUpdateSetupStatus (omnigold.js:4694), which marks profit/stopped on a live-price cross with no fill '
      + 'requirement — the lib walk is stricter and more realistic.',
    dedup: 'one live trade per (kind, dir) per walk (per (horizon, kind, dir) on the engine walk); overlapping signals skipped and counted',
    prefixCap: PREFIX_CAP
  },
  deviations: [
    'hgOgAdvancedConfluenceScore/hgOgCompositeScore are not window-exported; two export lines were injected at the existing export block (verbatim functions, asserted at boot)',
    'hgWilson copied verbatim from index.html:6624 (it lives in no module)',
    'extra{} lacks macro/news/yieldRows/zoneCtx/pooled-stats (live-only feeds); those gates read UNCHECKED as designed',
    'checks.riskReward replicates the live signed-ratio quirk (always false for well-formed plans) -> checksPass caps at 4/5, so EXCEPTIONAL (>=85) is unreachable for scan setups',
    'wilsonLo is a 0..1 fraction as live feeds it -> factor 5 contributes <=0.3 pts (live quirk, not fixed); evidence accumulated from this replay only, zero lookahead',
    'SMT-DIVERGE/GSR-EXTREME never fire (no silver series offline, by design)',
    'engine setups resolved on the 1h grid for both engine horizons; engine walk limited to the 15m coverage window',
    'engine SELECTION is the live desk path: hgOgPickGoldEngineForMp (omnigold.js:6046/6101, called at 7380-7381) takes ONE grade-gated pick per horizon per bar — grade A / B(tally>=5) tape-aligned first, against-tape fallback, C only as MP fallback, D/vetoed never; tapeDir = hgOgDeskTape(hgOgTapeDir(1h), hgOgTapeDir(4h)) as at 7232-7234; engineGrade recorded on every ENGINE trade row',
    'residual engine deviation (a): the live desk only SURFACES the engine pick when the scan produced no MP pick for that horizon (7380-7381); this harness measures the engine pick unconditionally every bar to sample the engine path itself',
    'residual engine deviation (b): hgOgApplyBridgeBestLevels best-levels refinement is not applied (gold-best-levels.js not loaded offline); levels are the raw engine plan as bridged',
    'residual engine deviation (c): goldRankSetups ctx lacks goldPro (goldProState lives in goldpro.js, a live-feed module not loaded offline) and the live spot-anchor price re-alignment (6206-6224) is skipped — both degrade the same way macro/news do',
    'no per-kind cooldown beyond the one-open-trade dedup (the XM bot walk uses a global cooldown instead; this harness measures setups, not the single-account bot)'
  ],
  limitations: [
    'SAME-BAR FILL->TARGET OPTIMISM (inherited from lib ogXmBotWalkTrade semantics): '
      + counters.sameBarWins + ' of ' + winsAll.length + ' wins settle on the fill bar itself; '
      + counters.sameBarAmbiguousWins + ' of them are LIMIT/STOP fills where OHLC cannot prove the entry touch preceded '
      + 'the target print — all resolved pro-strategy at full R. Overall win rate '
      + (winRateAll == null ? '-' : (winRateAll * 100).toFixed(1) + '%') + ' -> '
      + (winRateExAmbig == null ? '-' : (winRateExAmbig * 100).toFixed(1) + '%')
      + ' if ambiguous same-bar wins are excluded; absolute win rates carry that much upward slack. '
      + 'Stop+target both-touch bars ARE counted as losses (' + counters.bothTouch + ' here).',
    'OUTCOME SEMANTICS ARE LIB SEMANTICS, NOT DESK-PANEL SEMANTICS: resolution follows lib/omnigold-xm-bot-backtest.mjs '
      + '(fill required, stop-first, unfilled != loss) plus a 96-bar MTM timeout and per-(kind,dir) dedup. The desk panel '
      + 'hgOgUpdateSetupStatus (omnigold.js:4694) is LOOSER (profit/stopped on a live-price cross, no fill requirement), '
      + 'so these numbers are not comparable to the desk panel readout.',
    'PORTFOLIO-LEVEL STATS ARE NOT ATTAINABLE: profitFactor / sumR_net / maxDD_R pool every signal at 1R with unlimited '
      + 'simultaneous positions (dozens of concurrent trades across ~55 kinds x 2 dirs, no capital constraint). No account '
      + 'can hold that book. Read per-trade expectancy (avgR_net) and the per-kind rows; ignore the pooled equity-curve numbers.',
    'CONFLUENCE SCORE IS TWO INCOMMENSURABLE REGIMES (scan 0-100 multi-factor, hard-capped ~78 offline; engine grade '
      + 'scalars 85/75/70/60/45/35). Tier and quartile tables are therefore reported per source and must not be pooled. '
      + 'SCAN win% by ascending tier: ' + (tierSeq.text || 'n/a') + ' — '
      + (tierSeq.bands >= 2 ? (tierSeq.monotonic ? 'monotonic non-decreasing on this sample' : 'NOT monotonic in score on this sample') : 'too few bands to assess') + '. '
      + 'SCAN win% by ascending quartile: ' + (quartSeq.text || 'n/a') + ' — '
      + (quartSeq.bands >= 2 ? (quartSeq.monotonic ? 'monotonic non-decreasing on this sample' : 'NOT monotonic in score on this sample') : 'too few bands to assess') + '. '
      + 'Do not read these tables as "higher confluence predicts wins" unless the within-regime gradient supports it.'
  ],
  counters,
  confluenceDistribution: distBuckets
};

fs.writeFileSync(OUT_FILE, JSON.stringify({ meta, aggregates, trades: results }, null, 1));

/* ---------- console table ---------- */
const pad = (s, n) => String(s == null ? '-' : s).padEnd(n);
const rpad = (s, n) => String(s == null ? '-' : s).padStart(n);
function printAgg(title, obj){
  console.log('\n--- ' + title + ' ---');
  console.log(pad('group', 26) + rpad('n', 6) + rpad('unfil', 7) + rpad('win%', 7)
    + rpad('avgR(g)', 9) + rpad('avgR(n)', 9) + rpad('PF', 7) + rpad('sumR(n)', 9) + rpad('maxDD', 8));
  for (const k of Object.keys(obj)){
    const a = obj[k];
    console.log(pad(k, 26) + rpad(a.n, 6) + rpad(a.unfilled, 7)
      + rpad(a.winRate == null ? '-' : (a.winRate * 100).toFixed(0) + '%', 7)
      + rpad(a.avgR_gross, 9) + rpad(a.avgR_net, 9)
      + rpad(a.profitFactor === Infinity ? 'inf' : a.profitFactor, 7)
      + rpad(a.sumR_net, 9) + rpad(a.maxDD_R, 8));
  }
}
console.log('\n=== RESULTS (' + meta.mode + ') · trades ' + results.length
  + ' · settled ' + aggregates.overall.n + ' · overlap-skipped ' + counters.skippedOverlap
  + ' · both-touch losses ' + counters.bothTouch
  + ' · same-bar wins ' + counters.sameBarWins + ' (' + counters.sameBarAmbiguousWins + ' ambiguous) ===');
printAgg('overall', { ALL: aggregates.overall });
printAgg('by source:horizon', aggregates.bySource);
printAgg('by confluence tier — SCAN 0-100 scale vs ENGINE grade letters (separate regimes, never pool)', aggregates.byTier);
printAgg('by confluence quartile (SCAN only, settled)', aggregates.byConfluenceQuartile);
const kinds = Object.entries(aggregates.byKind).sort((a, b) => b[1].n - a[1].n).slice(0, 20);
printAgg('by kind (top 20 by n)', Object.fromEntries(kinds));
console.log('\nconfluence distribution: ' + JSON.stringify(distBuckets));
console.log('\nSTATED LIMITATIONS:');
for (const lim of meta.limitations) console.log('  * ' + lim);
console.log('\nwritten: ' + OUT_FILE);
