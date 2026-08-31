/* HARDGATE — OMNIROUTE walk-forward EXIT optimization.

   Sits ON TOP of the audited replay harness (scripts/backtest-omniroute.mjs).
   The harness is a top-level script with side effects (it runs the backtest
   at import time and exports nothing), so its data loading, sandbox boot,
   detection pass, fill rules and fee model are reused by VERBATIM EXTRACTION,
   not import. Every extracted block below is marked with the exact source
   line range in backtest-omniroute.mjs so drift is diff-checkable. The
   conservative semantics are NOT forked: the entry population is produced by
   the harness's own replaySymbol copied byte-for-byte (same detection, same
   lanes/dedup, same fill rules, same audited fill-bar t1 rule, same fees for
   lane occupancy), and the exit grid re-simulates ONLY the exit leg of each
   already-filled trade.

   Run:  node scripts/exit-optimize.mjs --smoke     (2 symbols x 500 bars +
                                                     bar-by-bar hand-walk of
                                                     one BANK and one TRAIL)
         node scripts/exit-optimize.mjs             (top 25 x 2000 bars)
         flags: --top=N --bars=N --offline
   Out:  scripts/exit-optimization-results.json + console table.
   Cache: scripts/.bt-cache/*.json — shared with the harness, re-runs offline.

   DESIGN (fixed grid, 27 combos per family):
   - styles: FIXED (single target at T R);
             BANK  (half off at +1R, stop to breakeven, remainder to T R);
             TRAIL (after +1R first touch, stop ratchets at each bar CLOSE to
                    max(entry, close - 1.5xATR14) for longs, mirrored shorts,
                    never loosens; target at T R still live).
   - targets T: 1.5R, 2R, 3R.  horizons H: 20, 40, 72 bars from fill.
   - families: the app's own OMNI_FAMILY mapping via window.hgOmniFamilyOf
     (omniroute.js:1962-1993 + merged HG_MECH_FAMILY, hg-mechanics.js:535).
     Kinds the map does not know get their OWN bucket only when they clear
     the min-n guard on TRAIN alone; otherwise they pool into 'OTHER'.

   CONSERVATIVE SIMULATION (mirrors the harness, non-negotiable):
   - same-bar stop+target touch = STOP for the whole open portion
     (harness ambiguous-bar pessimism, backtest-omniroute.mjs:434-448 /
      omniroute.js:1014);
   - same-bar stop+1R touch before banking = STOP, no bank;
   - after banking, remainder same-bar BE+target = BE; a bare BE touch on or
     after the bank bar also exits at BE (the bank-bar low may predate the
     bank — counting it is pessimistic, never optimistic);
   - TRAIL evaluates the ratchet on the PRIOR bar's close: the stop active
     during bar i was fixed at the close of i-1 — no intra-bar clairvoyance;
   - fill-bar rule (audited, harness lines 75-84): on the fill bar a
     FAVORABLE event (target touch, +1R bank/arm touch) only counts when the
     bar OPENED at-or-through the entry (long: o <= entry, short: o >= entry),
     i.e. the fill provably precedes the touch; otherwise the favorable event
     is ignored that bar and must re-print later. Stops count on every bar.
   - fees 0.05% taker + 0.02% slippage per side, charged on entry AND exit
     notional of EVERY leg (the banked half pays its own full round trip),
     expressed in R against the plan risk distance — harness deviation 11.
   - timeout: still open at H bars after fill = exit whole remainder at that
     bar's close, marked to market (harness ordering: timeout is checked only
     after the bar's exit checks fail).

   WALK-FORWARD: chronological 60/40 split by SIGNAL time over the pooled
   trade set. The trade population is IDENTICAL across all 27 combos: it is
   frozen once by the harness replay (lane occupancy under the harness's own
   audited exit model), then each combo re-simulates exits per trade
   independently. Per family the best combo is picked on TRAIN net expectancy
   (mean netR/trade) with a min-n guard of >= 80 train trades — below that
   the family gets NO recommendation (no borrowing, no global fallback). The
   frozen pick is evaluated on TEST alongside the baseline FIXED 2R/20 on the
   SAME test trades (paired).

   HONESTY MATH: testDelta = mean(chosen netR - baseline netR) over test
   trades (paired per-trade diffs), se = sd(diffs, n-1)/sqrt(n), z = delta/se.
   Sidak bar for the 27 comparisons searched per family, one-sided familywise
   alpha 0.10: alphaAdj = 1 - 0.9^(1/27) = 0.0038946, zBar = 2.6614 (~2.68;
   the Bonferroni 0.1/27 equivalent is 2.679). verdict: 'improves-OOS' only
   when z clears the bar AND train/test deltas agree in sign; 'directional'
   when testDelta > 0 below the bar; 'no-improvement' otherwise. A GLOBAL
   pooled row runs the same math over all trades.

   DISCIPLINES / LIMITATIONS specific to this optimizer are in meta of the
   output JSON; the harness's own deviations 1-14 are inherited unchanged. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ============ config — EXTRACTED VERBATIM from backtest-omniroute.mjs:106-147
   (OUT_PATH is this script's own; grid constants appended at the end) ====== */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(root, 'scripts', '.bt-cache');
const OUT_PATH = path.join(root, 'scripts', 'exit-optimization-results.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes('--' + name);
const opt = (name, dflt) => {
  const hit = args.find(a => a.startsWith('--' + name + '='));
  return hit ? +hit.split('=')[1] : dflt;
};
const SMOKE = flag('smoke');
const OFFLINE = flag('offline');
const TOP_N = opt('top', SMOKE ? 2 : 25);
const BARS_1H = opt('bars', SMOKE ? 500 : 2000);

const TF = '1h', TF_SEC = 3600;
const MIN_RR = 2;                 // the module's own floor (omniroute.js:143)
const WARM = Math.min(160, Math.max(60, Math.floor(BARS_1H / 3))); // deviation 2
const FILL_WINDOW = 24;           // bars a limit may wait before expiring
const TIMEOUT_BARS = 72;          // bars in-position before exit-at-close (population replay)
const FEE_SIDE = 0.0005;          // taker 0.05% per side
const SLIP_SIDE = 0.0002;         // slippage 0.02% per side
const COST_SIDE = FEE_SIDE + SLIP_SIDE;
const DAILY_FAST = 10, DAILY_SLOW = 21;   // omniroute.js:167-168
const HTF_DAILY_BARS = 35;        // closed daily bars fed to the htf EMAs

/* ---- v531 roster / cohort constants (replaySymbol references them) ---- */
const ROSTER_VERSION = 'hg-v531';
const CV_KINDS = ['HTF-PULLBACK','DONCHIAN-DRIVE','AVWAP-DEFEND',
                  'COMPRESSION-BREAK','SWEEP-RECLAIM','EXHAUST-REVERT'];
const RT_COST_PCT = 0.14;         // HG_OMNI_RT_COST_PCT default (omniroute.js:4163)
const COST_OK_R = 0.125;          // 'ok' cost-tier ceiling (OMNI_CV_COST_OK_R, omniroute.js:554)
const BAND20X_LO = 1.12, BAND20X_HI = 1.84;   // 20X safe band, stopDistPct
const CLUSTER_ATR = 0.25;         // cluster tag: entries within 0.25*ATR14 (same bar)
const H1_FAST = 21, H1_SLOW = 50; // withTrend tag: 1h prefix EMAs

const FAPI = 'https://fapi.binance.com';
const CHUNK = 4, SLEEP_MS = 350;  // polite pacing, scalp-audit style

/* ---- exit-grid constants (THIS script only — the fixed design) ---- */
const STYLES = ['FIXED', 'BANK', 'TRAIL'];
const TARGETS = [1.5, 2, 3];
const HORIZONS = [20, 40, 72];
const HMAX = Math.max(...HORIZONS);
const TRAIL_ATR_MULT = 1.5;
const BASELINE = { style: 'FIXED', T: 2, horizon: 20 };
const MIN_TRAIN_N = 80;           // min-n guard: train trades per family
const N_COMPARISONS = STYLES.length * TARGETS.length * HORIZONS.length;  // 27
const ALPHA_FW = 0.10;            // one-sided familywise alpha behind the ~2.68-sigma spec bar
const TRAIN_FRAC = 0.6;

/* ===== sandbox boot — EXTRACTED VERBATIM from backtest-omniroute.mjs:149-205
   (hgOmniFamilyOf added to the assertion list: this script groups by it) === */

const RealDate = Date;
let simNowMs = null;              // deviation 6: settable "now" for sessionTiming
class SimDate extends RealDate {
  constructor(...a){ if (a.length) super(...a); else super(simNowMs == null ? RealDate.now() : simNowMs); }
  static now(){ return simNowMs == null ? RealDate.now() : simNowMs; }
}

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date: SimDate, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                Error, TypeError, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
for (const fn of ['hgOmniDetect','hgOmniPlanForHit','hgOmniDerivePlan','hgOmniSolidityScore',
                  'hgOmniBtcRegime','hgOmniDropForming','hgOmniIsReversion',
                  'hgPlanFromRisk',
                  /* exit-optimize: families come from the app's own map */
                  'hgOmniFamilyOf']){
  if (typeof W[fn] !== 'function') { console.error('sandbox missing ' + fn); process.exit(1); }
}

/* emaOf, verbatim semantics from omniroute.js (seed = first value).
   EXTRACTED VERBATIM from backtest-omniroute.mjs:187-205 (with atrOf). */
function emaOf(vals, n){
  if (!vals || vals.length < n || n <= 0) return NaN;
  let k = 2 / (n + 1), e = vals[0];
  for (let i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}

/* atrOf, verbatim semantics from omniroute.js:217 (mean TR of last n bars). */
function atrOf(rows, n){
  if (!rows || rows.length < n + 1) return NaN;
  let sum = 0, cnt = 0;
  for (let i = rows.length - n; i < rows.length; i++){
    const h = +rows[i].h, l = +rows[i].l, pc = +rows[i - 1].c;
    if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
    sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); cnt++;
  }
  return cnt ? sum / cnt : NaN;
}

/* ===== data layer — EXTRACTED VERBATIM from backtest-omniroute.mjs:207-348 == */

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function j(url){
  for (let attempt = 0; ; attempt++){
    const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-omni-backtest/1.0' } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status === 418 || r.status >= 500) && attempt < 3){
      await sleep(2000 * (attempt + 1)); continue;
    }
    throw new Error('HTTP ' + r.status + ' ' + url);
  }
}
const mapK = r => ({ t: Math.floor(+r[0] / 1000), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] });

function cachePath(name){ return path.join(CACHE_DIR, name + '.json'); }
function cacheRead(name){
  try { return JSON.parse(fs.readFileSync(cachePath(name), 'utf8')); } catch (e) { return null; }
}
function cacheWrite(name, obj){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(name), JSON.stringify(obj));
}

/* Paginated 1h klines: Binance caps limit at 1500 per call; walk endTime
   backwards until `need` CLOSED bars are in hand, then hgOmniDropForming. */
async function fetch1h(sym, need){
  const cached = cacheRead(sym + '-1h');
  if (cached && cached.rows && cached.rows.length >= need) return cached.rows.slice(-need);
  if (OFFLINE) throw new Error('offline: no 1h cache for ' + sym);
  let out = [], endTime = RealDate.now();
  while (out.length < need + 2){
    const lim = Math.min(1500, need + 2 - out.length);
    const page = await j(FAPI + '/fapi/v1/klines?symbol=' + sym + '&interval=1h&limit=' + lim + '&endTime=' + endTime);
    if (!page.length) break;
    out = page.map(mapK).concat(out);
    endTime = +page[0][0] - 1;
    if (page.length < lim) break;
    await sleep(150);
  }
  const rows = W.hgOmniDropForming(out, '1h', RealDate.now() / 1000);
  cacheWrite(sym + '-1h', { fetchedAt: new RealDate().toISOString(), rows });
  return rows.slice(-need);
}

async function fetchDaily(sym){
  const cached = cacheRead(sym + '-1d');
  if (cached && cached.rows) return cached.rows;
  if (OFFLINE) throw new Error('offline: no 1d cache for ' + sym);
  const raw = (await j(FAPI + '/fapi/v1/klines?symbol=' + sym + '&interval=1d&limit=250')).map(mapK);
  const rows = W.hgOmniDropForming(raw, '1d', RealDate.now() / 1000);
  cacheWrite(sym + '-1d', { fetchedAt: new RealDate().toISOString(), rows });
  return rows;
}

async function fetchFunding(sym){
  const cached = cacheRead(sym + '-funding');
  if (cached && cached.recs) return cached.recs;
  if (OFFLINE) return [];   // funding is optional enrichment; degrade, never block
  let recs = [];
  try {
    const raw = await j(FAPI + '/fapi/v1/fundingRate?symbol=' + sym + '&limit=1000');
    recs = raw.map(r => ({ t: Math.floor(+r.fundingTime / 1000), pct: +r.fundingRate * 100 }))
              .filter(r => isFinite(r.t) && isFinite(r.pct))
              .sort((a, b) => a.t - b.t);
  } catch (e) { recs = []; }
  cacheWrite(sym + '-funding', { fetchedAt: new RealDate().toISOString(), recs });
  return recs;
}

/* POINT-IN-TIME universe (audit FATAL fix — selection bias): see the harness
   comment at backtest-omniroute.mjs:277-284. Extracted verbatim. */
const UNIVERSE_RANK_DAYS = 7;
let universeCacheNote = null;   // v531: set when an adjacent-day cached universe is reused
async function fetchUniverse(n){
  const windowStartMs = RealDate.now() - BARS_1H * 3600 * 1000;
  const key = 'universe-pit-' + new RealDate(windowStartMs).toISOString().slice(0, 10);
  const cached = cacheRead(key);
  if (cached && cached.syms && cached.syms.length >= n) return cached.syms.slice(0, n);
  try {
    const cand = fs.readdirSync(CACHE_DIR)
      .filter(f => /^universe-pit-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => {
        const c = cacheRead(f.replace(/\.json$/, ''));
        const ws = c && c.windowStart ? RealDate.parse(c.windowStart) : NaN;
        return { name: f, c, dMs: Math.abs(ws - windowStartMs) };
      })
      .filter(x => x.c && x.c.syms && x.c.syms.length >= n && isFinite(x.dMs) && x.dMs <= 3 * 86400000)
      .sort((a, b) => a.dMs - b.dMs);
    if (cand.length){
      universeCacheNote = 'universe reused from cache ' + cand[0].name + ' (windowStart ' +
        cand[0].c.windowStart + ', ' + (cand[0].dMs / 86400000).toFixed(2) +
        ' days from this run\'s nominal window start; still point-in-time ranked over the first ' +
        UNIVERSE_RANK_DAYS + ' days of its own window)';
      console.log('universe: ' + universeCacheNote);
      return cand[0].c.syms.slice(0, n);
    }
  } catch (e) { /* fall through to fetch */ }
  if (OFFLINE) throw new Error('offline: no point-in-time universe cache ' + key);
  const tickers = await j(FAPI + '/fapi/v1/ticker/24hr');
  const candidates = tickers
    .filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'))
    .map(t => t.symbol);
  console.log('universe: ranking ' + candidates.length + ' USDT perps by quoteVolume over first ' +
              UNIVERSE_RANK_DAYS + 'd of the window (point-in-time)…');
  const endMs = windowStartMs + UNIVERSE_RANK_DAYS * 86400000;
  const scored = [];
  const UCHUNK = 6;
  for (let i = 0; i < candidates.length; i += UCHUNK){
    const slice = candidates.slice(i, i + UCHUNK);
    const part = await Promise.all(slice.map(async sym => {
      try {
        const kl = await j(FAPI + '/fapi/v1/klines?symbol=' + sym + '&interval=1d&startTime=' +
                           windowStartMs + '&endTime=' + endMs + '&limit=' + (UNIVERSE_RANK_DAYS + 1));
        return { sym, qv: kl.reduce((s, r) => s + (+r[7] || 0), 0) };
      } catch (e) { return { sym, qv: 0 }; }
    }));
    scored.push(...part);
    if (i + UCHUNK < candidates.length) await sleep(SLEEP_MS);
  }
  const syms = scored.filter(s => isFinite(s.qv) && s.qv > 0)
    .sort((a, b) => b.qv - a.qv)
    .slice(0, 50)
    .map(s => s.sym);
  cacheWrite(key, { fetchedAt: new RealDate().toISOString(),
                    windowStart: new RealDate(windowStartMs).toISOString(),
                    rankDays: UNIVERSE_RANK_DAYS, syms });
  return syms.slice(0, n);
}

/* ===== zero-lookahead context lookups — EXTRACTED VERBATIM
   from backtest-omniroute.mjs:350-378 ===================================== */

function closedDailyBefore(daily, tSec){
  let lo = 0, hi = daily.length;           // first index with close > tSec
  while (lo < hi){ const m = (lo + hi) >> 1; (daily[m].t + 86400 <= tSec) ? lo = m + 1 : hi = m; }
  return daily.slice(0, lo);
}

function htfAt(daily, tSec){               // deviation 7
  const closed = closedDailyBefore(daily, tSec).slice(-HTF_DAILY_BARS);
  if (closed.length < DAILY_SLOW + 2) return null;
  const dc = closed.map(r => r.c).filter(isFinite);
  const e21 = emaOf(dc.slice(-(DAILY_FAST * 2)), DAILY_FAST);
  const e50 = emaOf(dc, DAILY_SLOW);
  if (!isFinite(e21) || !isFinite(e50)) return null;
  return { e21, e50, bars: closed.length };
}

function btcRegimeAt(btcDaily, tSec){      // deviation 5
  const closed = closedDailyBefore(btcDaily, tSec).slice(-HTF_DAILY_BARS);
  try { return W.hgOmniBtcRegime(closed); } catch (e) { return null; }
}

function fundingAt(recs, tSec){            // deviation 9: last record <= tSec
  let lo = 0, hi = recs.length;
  while (lo < hi){ const m = (lo + hi) >> 1; (recs[m].t <= tSec) ? lo = m + 1 : hi = m; }
  return lo > 0 ? recs[lo - 1].pct : NaN;
}

/* ===== replay core — EXTRACTED VERBATIM from backtest-omniroute.mjs:380-596.
   This produces the ENTRY POPULATION: detection, planning, scoring, lanes/
   dedup, limit fills and the harness's own audited exit model for lane
   occupancy. NOT modified. The trades it returns keep signalIdx/fillIdx
   (the harness strips them only at JSON-output time, line 778). ========== */

const STAT_KEY = k => (k === 'UTAD' ? 'SPRING' : k);   // app rule (omniroute.js:4629)

function replaySymbol(sym, rows, daily, btcDaily, funding, counters){
  const trades = [], open = { long: null, short: null, cvlong: null, cvshort: null };
  const LANES = ['long', 'short', 'cvlong', 'cvshort'];
  const statTally = {};   // statKey -> {wins, losses} — walk-forward record (deviation 4)

  const statsFor = (kind) => {
    const t = statTally[STAT_KEY(kind)];
    if (!t || (t.wins + t.losses) === 0) return null;
    const samples = t.wins + t.losses, hit = t.wins / samples;
    return { samples, wins: t.wins, losses: t.losses, open: 0, hit, expR: hit * MIN_RR - (1 - hit) };
  };

  const settle = (tr, outcome, exitPx, exitIdx) => {
    tr.state = 'done'; tr.outcome = outcome;
    const risk = Math.abs(tr.entry - tr.stop);
    let grossR = NaN;
    if (outcome === 'target') grossR = Math.abs(tr.t1 - tr.entry) / risk;
    else if (outcome === 'stop') grossR = -1;
    else if (outcome === 'timeout') grossR = (tr.dir === 'long' ? (exitPx - tr.entry) : (tr.entry - exitPx)) / risk;
    const costR = (COST_SIDE * tr.entry + COST_SIDE * exitPx) / risk;   // deviation 11
    tr.rMultiple = round4(grossR);
    tr.netR = round4(grossR - costR);
    tr.exit = exitPx;
    tr.barsHeld = exitIdx - tr.fillIdx;
    tr.resolveT = rows[exitIdx].t + TF_SEC;
    const key = STAT_KEY(tr.mechanic);
    if (!statTally[key]) statTally[key] = { wins: 0, losses: 0 };
    if (outcome === 'target') statTally[key].wins++;
    else if (outcome === 'stop') statTally[key].losses++;   // timeouts settle neither, like 'open' in the app
    trades.push(tr);
    open[tr.lane] = null;
  };

  /* First-touch exit check for bar i. A bar spanning BOTH stop and t1 is a
     LOSS — the module's own ambiguous-bar pessimism (omniroute.js:1014).
     AUDIT FATAL FIX (fill-bar t1): on the fill bar itself, a bare t1 touch
     is only a win when the bar OPENED at-or-through the entry (long:
     o <= entry, short: o >= entry) — then the fill happened at the open and
     the t1 touch is provably post-fill. If the bar opened on the far side of
     entry the t1 print may predate the fill, so the trade is left open into
     the next bar. Stop grants stay pessimistic on every bar. */
  const checkExit = (tr, bar, i, isFillBar) => {
    const long = tr.dir === 'long';
    const stopHit = long ? bar.l <= tr.stop : bar.h >= tr.stop;
    const t1Hit = long ? bar.h >= tr.t1 : bar.l <= tr.t1;
    if (stopHit && t1Hit){ counters.ambiguousBars++; settle(tr, 'stop', tr.stop, i); return true; }
    if (stopHit){ settle(tr, 'stop', tr.stop, i); return true; }
    if (t1Hit){
      if (isFillBar){
        const openThroughEntry = long ? bar.o <= tr.entry : bar.o >= tr.entry;
        if (!openThroughEntry){ counters.fillBarT1Deferred++; return false; }
      }
      settle(tr, 'target', tr.t1, i); return true;
    }
    return false;
  };

  for (let i = 0; i < rows.length; i++){
    const bar = rows[i];

    /* 1) advance any pending/open trades with this bar */
    for (const lane of LANES){
      const tr = open[lane];
      if (!tr) continue;
      if (tr.state === 'pending'){
        if (bar.l <= tr.entry && tr.entry <= bar.h){
          tr.state = 'open'; tr.fillIdx = i; tr.barsToFill = i - tr.signalIdx;
          checkExit(tr, bar, i, true);     // fill bar: stop counts; t1 only if open was through entry
        } else if (i - tr.signalIdx >= FILL_WINDOW){
          counters.expired++; open[lane] = null;   // never filled — not a trade
        }
      } else if (tr.state === 'open'){
        if (!checkExit(tr, bar, i, false) && i - tr.fillIdx >= TIMEOUT_BARS){
          settle(tr, 'timeout', bar.c, i);
        }
      }
    }

    /* 2) detect at the close of bar i — exactly the module's replay contract:
       detector(prefixRows) on rows.slice(0, i+1). Last bar excluded: a signal
       there has no future bar to fill on. */
    if (i < WARM || i >= rows.length - 1) continue;
    const prefix = rows.slice(0, i + 1);
    let hits = [];
    try { hits = W.hgOmniDetect(prefix, null, null, sym) || []; } catch (e) { hits = []; }
    if (!hits.length) continue;
    counters.signals += hits.length;

    for (const h of hits){
      if (!h || !h.kind) continue;
      counters.detectedByKind[h.kind] = (counters.detectedByKind[h.kind] || 0) + 1;
      if (h.conviction && h.conviction.costGate === 'passed') counters.convictionSignals++;
    }
    const atr14 = atrOf(prefix, 14);
    const entryOfHit = h => {
      const lvl = +h.level;
      return (isFinite(lvl) && lvl > 0) ? lvl : bar.c;   // same choice hgOmniPlanForHit makes with livePx
    };
    const clusterOf = (hit) => {
      if (!isFinite(atr14) || !(atr14 > 0)) return { cluster: false, kinds: [] };
      const e0 = entryOfHit(hit), kinds = [];
      for (const other of hits){
        if (!other || other === hit || other.kind === hit.kind || other.dir !== hit.dir) continue;
        if (Math.abs(entryOfHit(other) - e0) <= CLUSTER_ATR * atr14) kinds.push(other.kind);
      }
      return { cluster: kinds.length > 0, kinds };
    };
    const h1Closes = prefix.map(r => r.c).filter(isFinite);
    const h1Fast = emaOf(h1Closes.slice(-(H1_FAST * 2)), H1_FAST);
    const h1Slow = emaOf(h1Closes.slice(-(H1_SLOW * 2)), H1_SLOW);
    const h1Up = (isFinite(h1Fast) && isFinite(h1Slow)) ? (h1Fast >= h1Slow) : null;

    const tSec = bar.t + TF_SEC;           // signal bar CLOSE time
    for (const hit of hits){
      if (!hit || (hit.dir !== 'long' && hit.dir !== 'short')) continue;
      const cert = (hit.conviction && typeof hit.conviction === 'object' &&
                    hit.conviction.costGate === 'passed') ? hit.conviction : null;
      const lane = (cert ? 'cv' : '') + hit.dir;
      if (open[lane]){ counters.skipsOpen++; continue; }   // deviation 3 (dedup, per lane)

      /* plan the printed trade with the module's own planner */
      let plan = null;
      try { plan = W.hgOmniPlanForHit(hit, prefix, { minRr: MIN_RR, livePx: bar.c }); } catch (e) { plan = null; }
      if (plan) plan = W.hgOmniDerivePlan(plan);
      if (!plan || !isFinite(+plan.entry) || !isFinite(+plan.stop) || !isFinite(+plan.t1) ||
          !(Math.abs(plan.entry - plan.stop) > 0)){ counters.planRejected++; continue; }

      /* score with ONLY data through bar i */
      const htf = htfAt(daily, tSec);
      const btcReg = btcRegimeAt(btcDaily, tSec);
      const fundPct = fundingAt(funding, tSec);
      const setup = {
        sym, kind: hit.kind, dir: hit.dir,
        rows: prefix, hit, plan,
        btcRegime: btcReg,
        positioning: isFinite(fundPct) ? { fundingPct: fundPct } : null,
        extra: {
          htf,
          regime: btcReg,          // deviation 5: btc-daily-proxy stands in for regime.js
          btcRegime: btcReg,
          stats: statsFor(hit.kind),
          ticker: { sym }
        }
      };
      simNowMs = tSec * 1000;      // deviation 6: sessionTiming scores the bar's session
      let sol = null;
      try { sol = W.hgOmniSolidityScore(setup, '1H'); } catch (e) { sol = null; }
      simNowMs = null;
      if (!sol){ counters.scoreFailed++; continue; }

      const pillars = {};
      for (const k in (sol.breakdown || {})) pillars[k] = sol.breakdown[k].score;

      const hasConviction = !!cert;
      const cl = clusterOf(hit);
      const dailyUp = (htf && isFinite(htf.e21) && isFinite(htf.e50)) ? (htf.e21 >= htf.e50) : null;
      const withTrend = (h1Up === null || dailyUp === null) ? false
        : (hit.dir === 'long' ? (h1Up === true && dailyUp === true)
                              : (h1Up === false && dailyUp === false));
      const stopDistPct = Math.abs(+plan.entry - +plan.stop) / Math.abs(+plan.entry) * 100;
      const costRForm = RT_COST_PCT / stopDistPct;   // formation-cost arithmetic, omniroute.js:4220-4230
      const stopBand20x = stopDistPct >= BAND20X_LO && stopDistPct <= BAND20X_HI && costRForm <= COST_OK_R;

      open[lane] = {
        state: 'pending', signalIdx: i, lane,
        sym, tISO: new RealDate(tSec * 1000).toISOString(),
        dir: hit.dir, mechanic: hit.kind,
        entry: +plan.entry, stop: +plan.stop, t1: +plan.t1,
        rr1: round4(+plan.rr1),
        solidity: sol.score, tier: sol.tier, pillarBreakdown: pillars,
        hasConviction,
        conviction: cert ? { count: cert.count, classes: cert.classes,
                             costR: round4(cert.costR), stopDistPct: round4(cert.stopDistPct),
                             confirmations: cert.confirmations } : null,
        planViaConvictionBranch: hasConviction && String(plan.targetPolicy || '').includes('conviction'),
        cluster: cl.cluster, clusterKinds: cl.kinds,
        withTrend, h1Up, dailyUp,
        stopDistPct: round4(stopDistPct), costRAtDefaultRt: round4(costRForm), stopBand20x,
        fillIdx: -1, barsToFill: null
      };
      counters.opened++;
      if (hasConviction) counters.convictionOpened++;
    }
  }

  /* trades still pending/open when the data ran out: not resolvable, not counted */
  for (const lane of LANES) if (open[lane]){
    counters[open[lane].state === 'pending' ? 'expired' : 'unresolvedAtEnd']++;
  }
  return trades;
}

function round4(v){ return isFinite(v) ? Math.round(v * 1e4) / 1e4 : null; }

/* ======================= exit-grid simulation (NEW) ======================= */

/* ATR14 series mirroring atrOf(rows.slice(0, i+1), 14) at every i — same
   TR formula, same skip-non-finite, same cnt divisor — precomputed once per
   symbol so TRAIL does not re-slice the prefix on every bar. */
function atrSeries(rows, n){
  const out = new Array(rows.length).fill(NaN);
  for (let i = n; i < rows.length; i++){
    let sum = 0, cnt = 0;
    for (let jj = i - n + 1; jj <= i; jj++){
      const h = +rows[jj].h, l = +rows[jj].l, pc = +rows[jj - 1].c;
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
      sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); cnt++;
    }
    out[i] = cnt ? sum / cnt : NaN;
  }
  return out;
}

/* Simulate ONE exit combo for ONE already-filled trade. Entry price, stop,
   direction and fill bar come from the harness population — never re-derived.
   Returns { grossR, costR, netR, outcome, exitIdx, barsHeld, legs, banked,
   armed, walk? }. Conservative rules are documented in the header. */
function simulateExit(rows, atr, tr, style, T, H, verbose){
  const long = tr.dir === 'long';
  const sgn = long ? 1 : -1;
  const entry = tr.entry, stop0 = tr.stop;
  const risk = Math.abs(entry - stop0);
  const target = entry + sgn * T * risk;
  const oneR = entry + sgn * risk;
  const fillBar = rows[tr.fillIdx];
  const openThrough = long ? fillBar.o <= entry : fillBar.o >= entry;

  const legs = [];                 // { frac, exitPx, tag, barIdx }
  let banked = false, armed = false;
  let stopCur = stop0;             // active protective stop (whole position, or remainder after bank)
  let frac = 1;                    // open fraction
  const walk = verbose ? [] : null;
  const note = (i, s) => { if (walk) walk.push({ i, s }); };

  const closeLeg = (f, px, tag, i) => { legs.push({ frac: f, exitPx: px, tag, barIdx: i }); frac = round8(frac - f); };
  const round8 = v => Math.round(v * 1e8) / 1e8;

  let exitIdx = -1, outcome = null;

  for (let i = tr.fillIdx; i < rows.length && frac > 0; i++){
    const bar = rows[i];
    const isFill = i === tr.fillIdx;
    const stopTouch = long ? bar.l <= stopCur : bar.h >= stopCur;
    const tgtTouch  = long ? bar.h >= target  : bar.l <= target;
    const oneRTouch = long ? bar.h >= oneR    : bar.l <= oneR;
    const favorableAllowed = !isFill || openThrough;   // audited fill-bar rule
    if (walk) note(i, 'bar o=' + bar.o + ' h=' + bar.h + ' l=' + bar.l + ' c=' + bar.c +
                      ' | stopActive=' + fmtPx(stopCur) + (style === 'TRAIL' ? ' atr14=' + fmtPx(atr[i]) : '') +
                      (isFill ? ' [FILL BAR, openThrough=' + openThrough + ']' : ''));

    if (style === 'FIXED'){
      if (stopTouch && tgtTouch){ closeLeg(frac, stopCur, 'stop-ambig', i); outcome = 'stop'; exitIdx = i; note(i, 'stop+target same bar -> STOP (pessimism) @' + fmtPx(stopCur)); break; }
      if (stopTouch){ closeLeg(frac, stopCur, 'stop', i); outcome = 'stop'; exitIdx = i; note(i, 'STOP @' + fmtPx(stopCur)); break; }
      if (tgtTouch && favorableAllowed){ closeLeg(frac, target, 'target', i); outcome = 'target'; exitIdx = i; note(i, 'TARGET @' + fmtPx(target)); break; }
      if (tgtTouch && !favorableAllowed) note(i, 'target touch on fill bar, open not through entry -> deferred');
    }
    else if (style === 'BANK'){
      if (!banked){
        /* same-bar stop + 1R (or target, which implies 1R) before banking = STOP, no bank */
        if (stopTouch && (oneRTouch || tgtTouch)){ closeLeg(frac, stopCur, 'stop-ambig', i); outcome = 'stop'; exitIdx = i; note(i, 'stop+1R same bar pre-bank -> STOP, no bank @' + fmtPx(stopCur)); break; }
        if (stopTouch){ closeLeg(frac, stopCur, 'stop', i); outcome = 'stop'; exitIdx = i; note(i, 'STOP @' + fmtPx(stopCur)); break; }
        if (oneRTouch && favorableAllowed){
          closeLeg(0.5, oneR, 'bank', i); banked = true; stopCur = entry;
          note(i, 'BANK half @+1R=' + fmtPx(oneR) + ', stop -> breakeven ' + fmtPx(entry));
          /* same-bar remainder checks against the NEW breakeven stop.
             The bar's adverse extreme may predate the bank — counting it is
             pessimistic, so it counts. BE beats target on the same bar. */
          const beTouch = long ? bar.l <= entry : bar.h >= entry;
          if (beTouch){ closeLeg(frac, entry, tgtTouch ? 'be-ambig' : 'be', i); outcome = 'banked-be'; exitIdx = i; note(i, 'remainder BE touch same bar -> BE @' + fmtPx(entry)); break; }
          if (tgtTouch){ closeLeg(frac, target, 'target', i); outcome = 'banked-target'; exitIdx = i; note(i, 'remainder TARGET same bar @' + fmtPx(target)); break; }
        } else if (oneRTouch && !favorableAllowed){
          note(i, '+1R touch on fill bar, open not through entry -> bank deferred');
        }
      } else {
        const beTouch = long ? bar.l <= stopCur : bar.h >= stopCur;   // stopCur === entry
        if (beTouch){ closeLeg(frac, stopCur, tgtTouch ? 'be-ambig' : 'be', i); outcome = 'banked-be'; exitIdx = i; note(i, 'remainder BE' + (tgtTouch ? '+target same bar -> BE (pessimism)' : '') + ' @' + fmtPx(stopCur)); break; }
        if (tgtTouch){ closeLeg(frac, target, 'target', i); outcome = 'banked-target'; exitIdx = i; note(i, 'remainder TARGET @' + fmtPx(target)); break; }
      }
    }
    else { /* TRAIL — stopCur active during bar i was fixed at close of i-1 */
      if (stopTouch && tgtTouch){ closeLeg(frac, stopCur, 'stop-ambig', i); outcome = armed ? 'trail-stop' : 'stop'; exitIdx = i; note(i, 'stop+target same bar -> STOP (pessimism) @' + fmtPx(stopCur)); break; }
      if (stopTouch){ closeLeg(frac, stopCur, armed ? 'trail-stop' : 'stop', i); outcome = armed ? 'trail-stop' : 'stop'; exitIdx = i; note(i, (armed ? 'TRAIL-STOP' : 'STOP') + ' @' + fmtPx(stopCur)); break; }
      if (tgtTouch && favorableAllowed){ closeLeg(frac, target, 'target', i); outcome = 'target'; exitIdx = i; note(i, 'TARGET @' + fmtPx(target)); break; }
      if (tgtTouch && !favorableAllowed) note(i, 'target touch on fill bar, open not through entry -> deferred');
      /* no exit this bar: arm on first PROVABLY-POST-FILL +1R touch, then
         ratchet at THIS bar's close — the stop it sets is active from the
         NEXT bar only (prior-bar-close rule, no intra-bar clairvoyance). */
      if (!armed && oneRTouch && favorableAllowed){ armed = true; note(i, 'ARMED (+1R first touch)'); }
      if (armed && isFinite(atr[i])){
        const cand = long ? Math.max(entry, bar.c - TRAIL_ATR_MULT * atr[i])
                          : Math.min(entry, bar.c + TRAIL_ATR_MULT * atr[i]);
        const next = long ? Math.max(stopCur, cand) : Math.min(stopCur, cand);
        if (next !== stopCur){ note(i, 'ratchet at close: stop ' + fmtPx(stopCur) + ' -> ' + fmtPx(next) + ' (max(entry, close-' + TRAIL_ATR_MULT + 'xATR) rule)'); stopCur = next; }
      }
    }

    /* timeout — checked only after the bar's exit checks failed (harness ordering) */
    if (frac > 0 && i - tr.fillIdx >= H){
      closeLeg(frac, bar.c, 'timeout', i);
      outcome = (banked ? 'banked-' : '') + 'timeout'; exitIdx = i;
      note(i, 'HORIZON ' + H + ' bars -> exit remainder at close ' + fmtPx(bar.c));
      break;
    }
  }

  /* population guard upstream ensures resolution within data; belt-and-braces */
  if (frac > 0){
    const last = rows.length - 1;
    closeLeg(frac, rows[last].c, 'data-end', last);
    outcome = (outcome || (banked ? 'banked-' : '') + 'timeout'); exitIdx = last;
  }

  let grossR = 0, costR = 0;
  for (const leg of legs){
    grossR += leg.frac * (sgn * (leg.exitPx - entry)) / risk;
    costR  += leg.frac * (COST_SIDE * entry + COST_SIDE * leg.exitPx) / risk;   // deviation 11, per leg
  }
  return { grossR: round4(grossR), costR: round4(costR), netR: round4(grossR - costR),
           outcome, exitIdx, barsHeld: exitIdx - tr.fillIdx, legs, banked, armed,
           walk: walk || undefined };
}

function fmtPx(v){ return isFinite(v) ? +v.toPrecision(8) : 'n/a'; }

/* ============================ honesty math ============================ */

/* Acklam's rational approximation to the inverse normal CDF (|err| < 1.2e-9). */
function qnorm(p){
  if (!(p > 0 && p < 1)) return NaN;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const pl = 0.02425, ph = 1 - pl;
  let q, r;
  if (p < pl){
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p <= ph){
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

const SIDAK_ALPHA_ADJ = 1 - Math.pow(1 - ALPHA_FW, 1 / N_COMPARISONS);
const SIDAK_BAR = qnorm(1 - SIDAK_ALPHA_ADJ);    // ~2.661 (spec's "~2.68 sigma"; Bonferroni 0.1/27 gives 2.679)

const mean = xs => xs.reduce((s, v) => s + v, 0) / xs.length;
function sdSample(xs){
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) * (v - m), 0) / (xs.length - 1));
}

/* wr/netR/pf over a list of per-trade exit results (netR-based: BANK legs
   make outcome labels non-binary, so a "win" is netR > 0). */
function exitAgg(list){
  const n = list.length;
  if (!n) return { n: 0, wr: null, netR: null, pf: null };
  const wins = list.filter(r => r.netR > 0).length;
  const pos = list.filter(r => r.netR > 0).reduce((s, r) => s + r.netR, 0);
  const neg = list.filter(r => r.netR < 0).reduce((s, r) => s + r.netR, 0);
  return {
    n, wr: round4(wins / n),
    netR: round4(mean(list.map(r => r.netR))),
    pf: neg < 0 ? round4(pos / -neg) : (pos > 0 ? Infinity : null)
  };
}

/* ============================= main ============================= */

const t0 = RealDate.now();
console.log('=== OMNIROUTE WALK-FORWARD EXIT OPTIMIZATION — ' + (SMOKE ? 'SMOKE' : 'FULL') +
            ' · top ' + TOP_N + ' · ' + BARS_1H + ' x 1h bars · warm ' + WARM +
            ' · grid ' + STYLES.join('/') + ' x T{' + TARGETS.join(',') + '} x H{' + HORIZONS.join(',') + '} ===');

const syms = await fetchUniverse(TOP_N);
console.log('universe: ' + syms.join(' '));

const btcDaily = await fetchDaily('BTCUSDT');

const counters = { signals: 0, opened: 0, skipsOpen: 0, planRejected: 0, scoreFailed: 0,
                   expired: 0, unresolvedAtEnd: 0, ambiguousBars: 0, fillBarT1Deferred: 0,
                   convictionSignals: 0, convictionOpened: 0, detectedByKind: {} };

/* 1) ENTRY POPULATION — the harness's own replay, verbatim. Trades keep
   fillIdx and a reference to their symbol's rows/atr for the exit sims. */
const population = [];           // { tr, rows, atr }
const perSymBars = {};
let dataEndSec = 0, droppedLateFill = 0;

for (let i = 0; i < syms.length; i += CHUNK){
  const slice = syms.slice(i, i + CHUNK);
  const datasets = await Promise.all(slice.map(async sym => {
    try {
      const [rows, daily, funding] = [await fetch1h(sym, BARS_1H), await fetchDaily(sym), await fetchFunding(sym)];
      return { sym, rows, daily, funding };
    } catch (e) { console.error('  ' + sym + ' data failed: ' + e.message); return null; }
  }));
  for (const d of datasets){
    if (!d || !d.rows || d.rows.length < WARM + 30) continue;
    perSymBars[d.sym] = d.rows.length;
    dataEndSec = Math.max(dataEndSec, d.rows[d.rows.length - 1].t + TF_SEC);
    const tr = replaySymbol(d.sym, d.rows, d.daily, btcDaily, d.funding, counters);
    const atr = atrSeries(d.rows, 14);
    let kept = 0;
    for (const t of tr){
      /* POPULATION GUARD: every trade must be resolvable under EVERY combo —
         the longest horizon (72) needs bar fillIdx+72 to exist. Trades filled
         too close to the data edge are dropped from the population entirely
         so the trade set is IDENTICAL across all 27 combos. */
      if (t.fillIdx + HMAX <= d.rows.length - 1){ population.push({ tr: t, rows: d.rows, atr }); kept++; }
      else droppedLateFill++;
    }
    console.log('  ' + d.sym.padEnd(12) + d.rows.length + ' bars → ' + tr.length +
                ' harness trades, ' + kept + ' in exit population');
  }
  if (!OFFLINE && i + CHUNK < syms.length) await sleep(SLEEP_MS);
}

/* 2) chronological 60/40 split by SIGNAL time (deterministic tie-break) */
population.sort((a, b) => (a.tr.tISO < b.tr.tISO ? -1 : a.tr.tISO > b.tr.tISO ? 1 :
                           (a.tr.sym + a.tr.mechanic) < (b.tr.sym + b.tr.mechanic) ? -1 : 1));
const nTrain = Math.floor(population.length * TRAIN_FRAC);
population.forEach((p, idx) => { p.split = idx < nTrain ? 'train' : 'test'; });
const splitBoundaryISO = population.length ? (population[Math.max(0, nTrain - 1)].tr.tISO) : null;

/* 3) family buckets: the app's own map; unmapped kinds get their own bucket
   only when they clear the min-n guard ON TRAIN, else pool into OTHER.
   Bucket assignment is frozen from TRAIN counts alone. */
const trainKindCount = {};
for (const p of population) if (p.split === 'train'){
  const k = p.tr.mechanic;
  if (W.hgOmniFamilyOf(k) === 'OTHER') trainKindCount[k] = (trainKindCount[k] || 0) + 1;
}
const bucketOf = (kind) => {
  const fam = W.hgOmniFamilyOf(kind);
  if (fam !== 'OTHER') return fam;
  return (trainKindCount[kind] || 0) >= MIN_TRAIN_N ? kind : 'OTHER';
};
for (const p of population) p.family = bucketOf(p.tr.mechanic);

/* 4) grid — simulate all 27 combos for every trade in the population */
const GRID = [];
for (const style of STYLES) for (const T of TARGETS) for (const horizon of HORIZONS)
  GRID.push({ id: style + '-' + T + 'R-' + horizon, style, T, horizon });
const BASE_IDX = GRID.findIndex(g => g.style === BASELINE.style && g.T === BASELINE.T && g.horizon === BASELINE.horizon);

for (const p of population){
  p.sim = GRID.map(g => simulateExit(p.rows, p.atr, p.tr, g.style, g.T, g.horizon, false));
}

/* 5) per-family selection on TRAIN, frozen evaluation on TEST */
const familyNames = [...new Set(population.map(p => p.family))].sort();
const familyReport = {};
const chosenTradeRecords = {};

function evaluateBucket(name, members){
  const train = members.filter(p => p.split === 'train');
  const test = members.filter(p => p.split === 'test');
  const rep = { n_train: train.length, n_test: test.length };
  const baseTestResults = test.map(p => p.sim[BASE_IDX]);
  rep.baselineTest = exitAgg(baseTestResults);
  if (train.length < MIN_TRAIN_N){
    rep.chosen = null; rep.chosenTest = null;
    rep.delta = null; rep.se = null; rep.z = null;
    rep.sidakBar = round4(SIDAK_BAR);
    rep.verdict = 'insufficient-n';
    rep.note = 'below min-n guard (' + MIN_TRAIN_N + ' train trades) — NO recommendation, no borrowing, no global fallback';
    return rep;
  }
  /* best combo on TRAIN net expectancy; deterministic tie-break = grid order */
  let bestIdx = 0, bestExp = -Infinity;
  const trainExp = GRID.map((g, gi) => mean(train.map(p => p.sim[gi].netR)));
  for (let gi = 0; gi < GRID.length; gi++)
    if (trainExp[gi] > bestExp + 1e-12){ bestExp = trainExp[gi]; bestIdx = gi; }
  const g = GRID[bestIdx];
  rep.chosen = { style: g.style, T: g.T, horizon: g.horizon };
  rep.trainExpectancy = { chosen: round4(trainExp[bestIdx]), baseline: round4(trainExp[BASE_IDX]) };
  const trainDelta = trainExp[bestIdx] - trainExp[BASE_IDX];

  const chosenTestResults = test.map(p => p.sim[bestIdx]);
  rep.chosenTest = exitAgg(chosenTestResults);
  const diffs = test.map((p, ti) => chosenTestResults[ti].netR - baseTestResults[ti].netR);
  const delta = diffs.length ? mean(diffs) : NaN;
  const sd = sdSample(diffs);
  const se = (isFinite(sd) && diffs.length > 1) ? sd / Math.sqrt(diffs.length) : NaN;
  const z = (isFinite(se) && se > 0) ? delta / se : (delta === 0 ? 0 : NaN);
  rep.delta = round4(delta); rep.se = round4(se); rep.z = round4(z);
  rep.trainDelta = round4(trainDelta);
  rep.sidakBar = round4(SIDAK_BAR);
  rep.clearsSidak = isFinite(z) && z >= SIDAK_BAR;
  rep.verdict = (rep.clearsSidak && trainDelta > 0 && delta > 0) ? 'improves-OOS'
              : (isFinite(delta) && delta > 0) ? 'directional'
              : 'no-improvement';
  /* per-trade records for the chosen config (train + test, flagged) */
  chosenTradeRecords[name] = members.map(p => {
    const s = p.sim[bestIdx], b = p.sim[BASE_IDX];
    return { sym: p.tr.sym, tISO: p.tr.tISO, split: p.split, dir: p.tr.dir,
             mechanic: p.tr.mechanic, family: p.family,
             entry: p.tr.entry, stop: p.tr.stop, fillBarsAfterSignal: p.tr.barsToFill,
             chosen: { combo: GRID[bestIdx].id, outcome: s.outcome, grossR: s.grossR, netR: s.netR,
                       barsHeld: s.barsHeld, banked: s.banked, trailArmed: s.armed,
                       legs: s.legs.map(l => ({ frac: l.frac, px: l.exitPx, tag: l.tag })) },
             baseline: { combo: GRID[BASE_IDX].id, outcome: b.outcome, netR: b.netR } };
  });
  return rep;
}

for (const fam of familyNames)
  familyReport[fam] = evaluateBucket(fam, population.filter(p => p.family === fam));
familyReport.GLOBAL = evaluateBucket('GLOBAL', population);

/* 6) output JSON */
const result = {
  wallClockRunAt: new RealDate().toISOString(),
  config: { mode: SMOKE ? 'smoke' : 'full', tf: TF, topN: TOP_N, bars: BARS_1H, warm: WARM,
            minRr: MIN_RR, fillWindowBars: FILL_WINDOW, populationTimeoutBars: TIMEOUT_BARS,
            feePerSide: FEE_SIDE, slippagePerSide: SLIP_SIDE, symbols: syms, barsPerSymbol: perSymBars,
            trainFrac: TRAIN_FRAC, minTrainN: MIN_TRAIN_N, baseline: BASELINE },
  meta: {
    rosterVersion: ROSTER_VERSION,
    generatedAt: new RealDate(dataEndSec * 1000).toISOString(),
    universeCacheNote: universeCacheNote || null,
    provenance: 'entry population, data layer, sandbox boot, fill rules and fee model EXTRACTED VERBATIM from scripts/backtest-omniroute.mjs (harness is a top-level script with no exports, so extraction, not import; source line ranges are marked per block in exit-optimize.mjs). Families from the app\'s own OMNI_FAMILY map via window.hgOmniFamilyOf (omniroute.js:1962-1993 + HG_MECH_FAMILY merge).',
    grid: { styles: STYLES, targetsR: TARGETS, horizonsBars: HORIZONS, combos: GRID.map(g => g.id),
            baseline: GRID[BASE_IDX].id, comparisons: N_COMPARISONS },
    splitBoundarySignalISO: splitBoundaryISO,
    sidak: { comparisons: N_COMPARISONS, familywiseAlpha: ALPHA_FW, sided: 'one',
             alphaAdjusted: round4(SIDAK_ALPHA_ADJ), zBar: round4(SIDAK_BAR),
             note: 'Sidak 1-(1-alpha)^(1/27) at one-sided familywise alpha ' + ALPHA_FW +
                   ' gives zBar ' + SIDAK_BAR.toFixed(4) + ' — the spec\'s "~2.68 sigma" bar ' +
                   '(the Bonferroni 0.1/27 equivalent is 2.679). At familywise 0.05 one-sided the bar would be 2.894; verdicts here use the reported zBar.' },
    disciplines: [
      'trade population IDENTICAL across all 27 combos: frozen once by the harness\'s own audited replay (detection, lanes/dedup, limit fills, fill-bar t1 rule, 72-bar occupancy timeout), then exits re-simulated per trade with no lane feedback',
      'population guard: trades filled with fewer than ' + HMAX + ' bars of forward data are dropped from the population entirely (' + 'droppedLateFill counted in counters) so every combo resolves inside the data',
      'same-bar stop+target touch = STOP for the whole open portion (harness ambiguous-bar pessimism)',
      'same-bar stop+1R touch before banking = STOP, no bank',
      'after banking: remainder same-bar BE+target = BE; a bare BE touch on/after the bank bar also exits at BE (bank-bar adverse extreme may predate the bank — counted anyway, pessimistic)',
      'TRAIL ratchet evaluated on the PRIOR bar\'s close: stop active during bar i was fixed at close of i-1; ratchet = max(entry, close - ' + TRAIL_ATR_MULT + 'xATR14) longs, mirrored shorts, never loosens; ATR14 = harness atrOf semantics on the prefix through the ratchet bar',
      'fill-bar rule on EVERY favorable event (target touch, +1R bank, +1R trail-arm): only counts when the fill bar opened at-or-through entry (long o<=entry / short o>=entry), else ignored that bar — the audited harness t1 rule generalized; stops count on every bar',
      'fees ' + (COST_SIDE * 100).toFixed(2) + '% per side on entry AND exit notional of every leg including the banked half, in R against the plan risk distance (harness deviation 11, per leg)',
      'timeout = exit remainder at the horizon bar\'s CLOSE, marked to market, checked only after that bar\'s exit checks fail (harness ordering)',
      'walk-forward: chronological 60/40 by signal time, pooled; selection on TRAIN net expectancy only; picks FROZEN before TEST; min-n guard ' + MIN_TRAIN_N + ' train trades per family, below it NO recommendation (no borrowing, no global fallback)',
      'family buckets frozen from TRAIN counts alone; unknown kinds get their own bucket only when they clear the min-n guard on train, else OTHER'
    ],
    limitations: [
      'POPULATION FREEZE vs LANE FEEDBACK: in live trading a combo that holds trades longer (H=72, TRAIL) would occupy the dedup lane longer and suppress some later entries; here occupancy is fixed by the harness exit model, so long-horizon combos are measured on a slightly more generous entry stream than they could actually trade. Disclosed, not corrected.',
      'the harness\'s own deviations 1-14 (1h timeframe, touch fills, no gap-through stops, point-in-time universe with residual survivorship, etc.) are inherited unchanged — see scripts/backtest-omniroute.mjs header',
      'one 60/40 split, not k-fold: the test verdict is a single out-of-sample draw; families barely above the min-n guard have wide se',
      'Sidak bar corrects the 27-combo search WITHIN a family; nothing corrects for reading ' + (familyNames.length + 1) + ' family rows at once — treat multiple simultaneous "improves-OOS" verdicts with additional suspicion',
      'BANK banked-half arithmetic books exactly +1R gross on half the position; partial-fill microstructure at the 1R level is not modeled (touch = full half fill, consistent with the harness touch-fill optimism)',
      'TRAIL exits fill exactly at the trailed stop price with flat slippage — no gap-through modeling, same as the harness stop rule',
      'win rate (wr) is defined as netR > 0 (BANK makes outcome labels non-binary); pf = sum(+netR)/-sum(-netR)'
    ],
    droppedLateFill
  },
  counters,
  families: familyReport,
  perTradeChosen: chosenTradeRecords,
  trainComboTable: null   // filled below for transparency
};

/* full train-expectancy table per family (transparency: what selection saw) */
const comboTable = {};
for (const fam of [...familyNames, 'GLOBAL']){
  const members = fam === 'GLOBAL' ? population : population.filter(p => p.family === fam);
  const train = members.filter(p => p.split === 'train');
  if (train.length < MIN_TRAIN_N) continue;
  comboTable[fam] = {};
  GRID.forEach((g, gi) => { comboTable[fam][g.id] = round4(mean(train.map(p => p.sim[gi].netR))); });
}
result.trainComboTable = comboTable;

fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 1));

/* 7) console table */
const widths = [18, 8, 7, 15, 9, 9, 9, 8, 8, 16];
const fmtN = v => (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) ? (v === Infinity ? 'inf' : '—')
                : (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3)) : String(v));
const rowS = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join(' ');
console.log('\n' + rowS(['family','n_train','n_test','chosen','baseNetR','chosNetR','delta','se','z','verdict']));
for (const fam of [...familyNames, 'GLOBAL']){
  const r = familyReport[fam];
  console.log(rowS([fam, r.n_train, r.n_test,
    r.chosen ? (r.chosen.style + '-' + r.chosen.T + 'R-' + r.chosen.horizon) : '—',
    fmtN(r.baselineTest && r.baselineTest.netR), fmtN(r.chosenTest && r.chosenTest.netR),
    fmtN(r.delta), fmtN(r.se), fmtN(r.z), r.verdict]));
}
console.log('\nsidak: ' + N_COMPARISONS + ' comparisons, one-sided familywise alpha ' + ALPHA_FW +
            ', adjusted alpha ' + SIDAK_ALPHA_ADJ.toFixed(6) + ', zBar ' + SIDAK_BAR.toFixed(4) +
            ' (~2.68 per spec; Bonferroni 0.1/27 = 2.679)');
console.log('population: ' + population.length + ' trades (' + nTrain + ' train / ' +
            (population.length - nTrain) + ' test), droppedLateFill=' + droppedLateFill +
            ', split boundary signal ' + splitBoundaryISO);
const { detectedByKind, ...flatCounters } = counters;
console.log('harness counters: ' + JSON.stringify(flatCounters));

/* 8) SMOKE hand-walk: print the bar-by-bar walk for one BANK trade that
   actually banked and one TRAIL trade that actually armed, so the arithmetic
   can be verified by hand against the printed bars. */
if (SMOKE){
  const walkCombo = (style) => GRID.findIndex(g => g.style === style && g.T === 2 && g.horizon === 40);
  const printWalk = (label, p, gi) => {
    const g = GRID[gi];
    const v = simulateExit(p.rows, p.atr, p.tr, g.style, g.T, g.horizon, true);
    console.log('\n===== HAND-WALK ' + label + ' — ' + p.tr.sym + ' ' + p.tr.dir + ' ' + p.tr.mechanic +
                ' signal ' + p.tr.tISO + ' combo ' + g.id + ' =====');
    const risk = Math.abs(p.tr.entry - p.tr.stop);
    console.log('entry=' + fmtPx(p.tr.entry) + ' stop0=' + fmtPx(p.tr.stop) + ' risk=' + fmtPx(risk) +
                ' target(' + g.T + 'R)=' + fmtPx(p.tr.entry + (p.tr.dir === 'long' ? 1 : -1) * g.T * risk) +
                ' +1R=' + fmtPx(p.tr.entry + (p.tr.dir === 'long' ? 1 : -1) * risk) +
                ' fillIdx=' + p.tr.fillIdx);
    for (const w of v.walk) console.log('  [' + w.i + '] ' + w.s);
    console.log('legs: ' + v.legs.map(l => l.frac + ' @ ' + fmtPx(l.exitPx) + ' (' + l.tag + ', bar ' + l.barIdx + ')').join(' | '));
    console.log('grossR=' + v.grossR + '  costR=' + v.costR + '  netR=' + v.netR +
                '  outcome=' + v.outcome + '  barsHeld=' + v.barsHeld);
    console.log('fee check: sum over legs of frac*(0.0007*entry + 0.0007*exit)/risk');
  };
  const giBank = walkCombo('BANK'), giTrail = walkCombo('TRAIL');
  const bankPick = population.find(p => p.sim[giBank].banked && p.sim[giBank].legs.length === 2 &&
                                        p.sim[giBank].legs[1].barIdx > p.sim[giBank].legs[0].barIdx)
                || population.find(p => p.sim[giBank].banked);
  const trailPick = population.find(p => p.sim[giTrail].armed && p.sim[giTrail].outcome === 'trail-stop')
                 || population.find(p => p.sim[giTrail].armed);
  if (bankPick) printWalk('BANK', bankPick, giBank); else console.log('\n(no BANK trade banked in this smoke window)');
  if (trailPick) printWalk('TRAIL', trailPick, giTrail); else console.log('\n(no TRAIL trade armed in this smoke window)');
}

console.log('\nwrote ' + OUT_PATH + ' (' + population.length + ' trades x ' + GRID.length +
            ' combos) in ' + ((RealDate.now() - t0) / 1000).toFixed(1) + 's');
