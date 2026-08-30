/* HARDGATE — OMNIROUTE offline backtest harness.

   Replays the module's own replayable detector pool (OMNI_MECHANICS: the
   native six + the 16 shared hg-mechanics kinds) bar-by-bar over Binance
   futures 1h klines with ZERO LOOKAHEAD, prices each hit with the module's
   own hgOmniPlanForHit, scores it with the module's own hgOmniSolidityScore,
   then resolves the trade forward with a conservative fill/exit model.

   Run:  node scripts/backtest-omniroute.mjs --smoke     (2 symbols x 500 bars)
         node scripts/backtest-omniroute.mjs             (top 25 x 2000 bars)
         flags: --top=N --bars=N --offline
   Out:  scripts/backtest-omniroute-v531-results.json + console table.
         (backtest-omniroute-results.json is the committed pre-v531 evidence
         and is NEVER rewritten by this script.)
   Cache: scripts/.bt-cache/*.json — re-runs are fully offline.

   v531 EXTENSION (hg-v531 roster + cohort tags — measurement only, no rule
   of the audited replay model was touched):
   - The six conviction mechanics (HTF-PULLBACK, DONCHIAN-DRIVE, AVWAP-DEFEND,
     COMPRESSION-BREAK, SWEEP-RECLAIM, EXHAUST-REVERT) need no harness wiring:
     detection goes through the module's own hgOmniDetect (omniroute.js:1426-
     1437 runs them), and pricing goes through the module's own
     hgOmniPlanForHit, whose conviction branch (omniroute.js:2054-2071) fires
     whenever hit.conviction.costGate === 'passed' and uses the certified
     stopHint geometry via hgPlanFromRisk (2R t1). The harness asserts
     hgPlanFromRisk exists in the sandbox so that branch can never silently
     fall through to a rebuilt geometry.
   - Per-trade cohort tags, all computed from the prefix at signal time
     (zero lookahead):
       hasConviction — hit carries the formation cert with costGate 'passed';
       cluster       — >= 2 DISTINCT mechanic kinds fired on the same
                       symbol+direction at the SAME bar with entries within
                       0.25*ATR14 of each other (same-bar detection output
                       only — mirrors the app's identical-levels collapse);
       withTrend     — 1h prefix EMA21 >= EMA50 AND daily EMA10 >= EMA21
                       (cached daily bars cut to <= signal time) BOTH agreeing
                       with the trade direction; unknown/absent HTF = false;
       stopBand20x   — plan stopDistPct in [1.12, 1.84] AND costR <= 0.125 at
                       the module's 0.14% round-trip default (the 20X safe
                       band with cost tier 'ok').
   - New aggregates: full per-mechanic table for ALL kinds (the six new ones
     always listed, n=0 if they never traded) and the four cohort splits.

   ASSUMPTIONS / DEVIATIONS FROM THE LIVE APP (each also listed in the output
   JSON under `deviations`):
   1. Timeframe is 1h (the app scans 4h). 2000 x 1h ~= 83 days gives the
      pillars real history; horizonLabel '1H' is passed to the scorer.
   2. WARM = 160 bars, not the module's 45: multiTfCascade needs 120 rows and
      liqRecovery/volTerm need 50, so a 45-bar warmup would score the early
      signals 0 on pillars for lack of history, not for lack of quality.
   3. Dedup replaces the module's fixed `i += horizon` cooldown: one open
      trade per symbol+direction; same-direction signals while one is
      pending/open are counted as skips. Opposite direction may open.
   4. extra.stats (expectancy pillar) is the WALK-FORWARD record accumulated
      by this very replay (per symbol, per mechanic, resolved strictly before
      the signal bar) — not the app's hgOmniBacktestAll over the full window,
      which would be lookahead. UTAD is tallied under SPRING (app rule).
   5. extra.regime / setup.btcRegime = hgOmniBtcRegime(BTC daily closed bars
      at-or-before the signal bar close). The regime pillar scores RISK-ON/
      RISK-OFF as "mismatch/unknown" = 2 pts by design (TREND vocabulary is
      the app's 8-gauge regime.js, unavailable offline); sectorMomentum's
      market leg and multiAsset's BTC leg read it as intended.
   6. sessionTiming reads the wall clock in the app; here the sandbox Date is
      stubbed to the SIGNAL BAR's close time so the pillar scores the bar's
      own IST session deterministically.
   7. extra.htf {e21,e50} = DAILY_FAST/DAILY_SLOW (10/21) EMAs over the last
      35 REAL daily klines closed at-or-before the signal bar close (the app
      resamples its 180x4h window; 35 closed daily bars is the same order of
      history, from better data, still strictly causal).
   8. orderFlow pillar has no data source offline — 0 pts, same as the live
      scan (enrichOne never populates extra.orderFlow either). OI history is
      not fetchable far enough back, so the multiAsset OI leg reads n/a.
   9. Funding leg: last /fapi/v1/fundingRate record at-or-before the signal
      bar close, as fundingPct = rate*100 (% per 8h, baseline +0.01).
  10. Fill model: plan.entry is a limit; filled when a later bar's range
      touches it (fill AT entry — gap-throughs are not price-improved),
      expired after 24 unfilled bars. Stop/target checked on the fill bar
      too; a bar spanning BOTH stop and t1 counts as a LOSS (the module's own
      ambiguous-bar pessimism). AUDIT FIX (fill-bar t1): on the fill bar a
      bare t1 touch only counts as a win when the bar OPENED at-or-through
      the entry (long: o <= entry, short: o >= entry), i.e. the fill provably
      precedes the target touch; otherwise the trade is left open into the
      next bar (stop grants stay pessimistic on every bar). Timeout after 72
      bars in-position exits at close for a signed R.
  11. Fees: taker 0.05% + slippage 0.02% per side, charged on entry and exit
      notional, expressed in R against the plan's risk distance.
  12. account is omitted so riskAdjusted uses the module default (10000).
  13. UNIVERSE (audit fix for selection bias): candidates are all USDT perps
      listed today; they are RANKED by summed quoteVolume over the FIRST 7
      DAYS of the lookback window (point-in-time), NOT by today's 24h volume,
      so symbols are not selected because they recently moved. Residual
      survivorship remains: perps delisted before the fetch date are
      invisible to the candidate list.
  14. newsCalendar pillar has no historical calendar source offline — it
      scores its constant no-blackout value on every trade; live FOMC/CPI
      score caps never fire in this replay.
  Further known limitations (score-integrity ceiling, statistical power,
  touch-fill optimism) are recorded in the results JSON under
  meta.limitations. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ============================= config ============================= */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(root, 'scripts', '.bt-cache');
/* v531: NEW output file. scripts/backtest-omniroute-results.json is committed
   pre-v531 evidence and must never be overwritten. */
const OUT_PATH = path.join(root, 'scripts', 'backtest-omniroute-v531-results.json');

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
const TIMEOUT_BARS = 72;          // bars in-position before exit-at-close
const FEE_SIDE = 0.0005;          // taker 0.05% per side
const SLIP_SIDE = 0.0002;         // slippage 0.02% per side
const COST_SIDE = FEE_SIDE + SLIP_SIDE;
const DAILY_FAST = 10, DAILY_SLOW = 21;   // omniroute.js:167-168
const HTF_DAILY_BARS = 35;        // closed daily bars fed to the htf EMAs

/* ---- v531 roster / cohort constants ---- */
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

/* ==================== sandbox: load the app's modules ==================== */
/* Same boot as tests/test-omniroute-setup-levels.mjs: window === globalThis
   so classic-script exports become bare globals exactly as in a browser. */

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
                  /* v531: hgPlanFromRisk (plans.js:973) must exist or the
                     conviction branch of hgOmniPlanForHit (omniroute.js:2054)
                     silently falls through to a rebuilt geometry. */
                  'hgPlanFromRisk']){
  if (typeof W[fn] !== 'function') { console.error('sandbox missing ' + fn); process.exit(1); }
}

/* emaOf, verbatim semantics from omniroute.js (seed = first value). */
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

/* ============================= data layer ============================= */

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

/* POINT-IN-TIME universe (audit FATAL fix — selection bias): the old code
   ranked by TODAY'S 24h quoteVolume, i.e. attention-of-the-day names chosen
   BECAUSE they recently moved, biasing every measured hit rate over the
   lookback. Now: candidates = every USDT perp listed today (ticker/24hr is
   used ONLY as a symbol list, not for ranking); rank = summed quoteVolume
   (kline field 7) over the FIRST 7 days of the lookback window. Symbols with
   no volume in that opening week (not yet listed) drop out. Residual
   survivorship: perps delisted before the fetch date are invisible. */
const UNIVERSE_RANK_DAYS = 7;
let universeCacheNote = null;   // v531: set when an adjacent-day cached universe is reused
async function fetchUniverse(n){
  const windowStartMs = RealDate.now() - BARS_1H * 3600 * 1000;
  const key = 'universe-pit-' + new RealDate(windowStartMs).toISOString().slice(0, 10);
  const cached = cacheRead(key);
  if (cached && cached.syms && cached.syms.length >= n) return cached.syms.slice(0, n);
  /* v531 cache-reuse: the key embeds the window-start DATE, so a run one day
     after the cache was built misses on the exact key even though the ranking
     window is 96%+ identical. Reuse the nearest cached point-in-time universe
     whose windowStart is within 3 days — still point-in-time (ranked over the
     first 7 days of ITS OWN window, never by end-of-window volume) — and say
     so in meta. This avoids re-ranking ~500 perps per run; it never touches
     the replay itself. */
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

/* ==================== zero-lookahead context lookups ==================== */

/* Daily bars fully CLOSED at-or-before tSec (close = open + 86400). */
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

/* ============================= replay core ============================= */

const STAT_KEY = k => (k === 'UTAD' ? 'SPRING' : k);   // app rule (omniroute.js:4629)

/* v531: conviction hits trade in a PARALLEL dedup lane (cvlong/cvshort) —
   one open conviction trade per symbol+direction, independent of the legacy
   lane. Without it the six deliberately-rare mechanics are crowded out: in
   the smoke run 95% of signals were skipsOpen because commodity mechanics
   (MMOVE/ORB fire on a third of bars) always occupied the single slot, and
   the conviction cohort measured n=0 by construction. The fill/exit/fee
   model is byte-identical in both lanes; only the slot allocation differs.
   The pre-v531 evidence file was produced WITHOUT this lane — compare
   legacy-cohort numbers, not overall, across the two files. */
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

    /* ---- v531 same-bar tag inputs (prefix-only, zero lookahead) ---- */
    /* detection tally per kind — proves the six are wired even when dedup or
       plan rejection keeps a kind out of the trade list */
    for (const h of hits){
      if (!h || !h.kind) continue;
      counters.detectedByKind[h.kind] = (counters.detectedByKind[h.kind] || 0) + 1;
      if (h.conviction && h.conviction.costGate === 'passed') counters.convictionSignals++;
    }
    /* cluster: >= 2 DISTINCT kinds, same direction, entries within
       0.25*ATR14 of each other, from THIS bar's full detection output —
       mirrors the app's identical-levels collapse, same-bar info only. */
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
    /* withTrend inputs: 1h prefix EMA21/EMA50 (window sizing mirrors htfAt:
       fast over 2*n closes, slow over 2*n closes) */
    const h1Closes = prefix.map(r => r.c).filter(isFinite);
    const h1Fast = emaOf(h1Closes.slice(-(H1_FAST * 2)), H1_FAST);
    const h1Slow = emaOf(h1Closes.slice(-(H1_SLOW * 2)), H1_SLOW);
    const h1Up = (isFinite(h1Fast) && isFinite(h1Slow)) ? (h1Fast >= h1Slow) : null;

    const tSec = bar.t + TF_SEC;           // signal bar CLOSE time
    for (const hit of hits){
      if (!hit || (hit.dir !== 'long' && hit.dir !== 'short')) continue;
      /* v531: formation cert decides the dedup lane — conviction hits have
         their own slot per direction so commodity mechanics cannot crowd
         out the rare roster (see the note above replaySymbol). */
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

      /* ---- v531 cohort tags (all from the prefix at signal time) ---- */
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
        /* v531 tags */
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

/* ============================= aggregates ============================= */

function round4(v){ return isFinite(v) ? Math.round(v * 1e4) / 1e4 : null; }

function aggregate(list){
  const n = list.length;
  if (!n) return { n: 0 };
  const wins = list.filter(t => t.outcome === 'target').length;
  const losses = list.filter(t => t.outcome === 'stop').length;
  const timeouts = list.filter(t => t.outcome === 'timeout').length;
  const grossSum = list.reduce((s, t) => s + t.rMultiple, 0);
  const netSum = list.reduce((s, t) => s + t.netR, 0);
  const posNet = list.filter(t => t.netR > 0).reduce((s, t) => s + t.netR, 0);
  const negNet = list.filter(t => t.netR < 0).reduce((s, t) => s + t.netR, 0);
  /* max drawdown in R over the chronological net equity curve */
  const chrono = list.slice().sort((a, b) => a.resolveT - b.resolveT);
  let cum = 0, peak = 0, maxDd = 0;
  for (const t of chrono){ cum += t.netR; if (cum > peak) peak = cum; if (peak - cum > maxDd) maxDd = peak - cum; }
  return {
    n, wins, losses, timeouts,
    winRate: round4(wins / n),
    avgGrossR: round4(grossSum / n),
    avgNetR: round4(netSum / n),
    expectancyNetR: round4(netSum / n),   // expectancy per trade = mean net R (timeouts included)
    profitFactor: negNet < 0 ? round4(posNet / -negNet) : (posNet > 0 ? Infinity : null),
    maxDrawdownR: round4(maxDd)
  };
}

function quartileCuts(scores){
  const s = scores.slice().sort((a, b) => a - b);
  const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return [q(0.25), q(0.5), q(0.75)];
}

function fmt(v){ return v === null || v === undefined ? '—' : (v === Infinity ? 'inf' : (typeof v === 'number' ? v.toFixed(3).replace(/\.?0+$/, m => m.includes('.') ? '' : m) : String(v))); }
function row(cols, widths){ return cols.map((c, i) => String(c).padEnd(widths[i])).join(' '); }

/* ============================= main ============================= */

const t0 = RealDate.now();
console.log('=== OMNIROUTE OFFLINE BACKTEST — ' + (SMOKE ? 'SMOKE' : 'FULL') +
            ' · top ' + TOP_N + ' · ' + BARS_1H + ' x 1h bars · warm ' + WARM + ' ===');

const syms = await fetchUniverse(TOP_N);
console.log('universe: ' + syms.join(' '));

const btcDaily = await fetchDaily('BTCUSDT');

const counters = { signals: 0, opened: 0, skipsOpen: 0, planRejected: 0, scoreFailed: 0,
                   expired: 0, unresolvedAtEnd: 0, ambiguousBars: 0, fillBarT1Deferred: 0,
                   /* v531 */ convictionSignals: 0, convictionOpened: 0, detectedByKind: {} };
const allTrades = [];
const perSymBars = {};
let dataEndSec = 0;   // latest bar close across all symbols → meta.generatedAt (bar data, not wall clock)

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
    allTrades.push(...tr);
    console.log('  ' + d.sym.padEnd(12) + d.rows.length + ' bars → ' + tr.length + ' resolved trades');
  }
  if (!OFFLINE && i + CHUNK < syms.length) await sleep(SLEEP_MS);
}

/* ---- aggregates ---- */
const scores = allTrades.map(t => t.solidity);
const cuts = scores.length >= 4 ? quartileCuts(scores) : null;
const byTier = {}, byQuartile = {};
for (const t of allTrades){
  (byTier[t.tier] = byTier[t.tier] || []).push(t);
  if (cuts){
    const q = t.solidity <= cuts[0] ? 'Q1' : t.solidity <= cuts[1] ? 'Q2' : t.solidity <= cuts[2] ? 'Q3' : 'Q4';
    (byQuartile[q] = byQuartile[q] || []).push(t);
  }
}
const tierAgg = {}, quartAgg = {};
for (const k of Object.keys(byTier)) tierAgg[k] = aggregate(byTier[k]);
for (const k of ['Q1','Q2','Q3','Q4']) if (byQuartile[k]) quartAgg[k] = aggregate(byQuartile[k]);
const overall = aggregate(allTrades);

/* score distribution */
const dist = {};
if (scores.length){
  const s = scores.slice().sort((a, b) => a - b);
  dist.min = s[0]; dist.max = s[s.length - 1];
  dist.mean = round4(s.reduce((a, b) => a + b, 0) / s.length);
  dist.p25 = cuts ? cuts[0] : null; dist.median = cuts ? cuts[1] : null; dist.p75 = cuts ? cuts[2] : null;
  dist.histogram = {};
  for (const v of s){ const b = Math.floor(v / 10) * 10; const key = b + '-' + (b + 9); dist.histogram[key] = (dist.histogram[key] || 0) + 1; }
}

/* v531: FULL per-mechanic aggregates for ALL kinds. The six conviction kinds
   are always listed (n=0 when they never produced a resolved trade) so an
   unwired or never-firing mechanic is visible, not silently absent. */
const mechTrades = {};
for (const t of allTrades) (mechTrades[t.mechanic] = mechTrades[t.mechanic] || []).push(t);
const byMech = {};
for (const k of [...new Set([...CV_KINDS, ...Object.keys(mechTrades)])].sort())
  byMech[k] = aggregate(mechTrades[k] || []);

/* v531: the four cohort splits */
const split = (pred) => ({ yes: aggregate(allTrades.filter(pred)), no: aggregate(allTrades.filter(t => !pred(t))) });
const cohorts = {
  conviction:  (s => ({ conviction: s.yes, legacy: s.no }))(split(t => t.hasConviction)),
  cluster:     (s => ({ clustered: s.yes, solo: s.no }))(split(t => t.cluster)),
  withTrend:   (s => ({ withTrend: s.yes, againstOrUnknown: s.no }))(split(t => t.withTrend)),
  stopBand20x: (s => ({ inBand: s.yes, outside: s.no }))(split(t => t.stopBand20x))
};

const result = {
  wallClockRunAt: new RealDate().toISOString(),   // when the script ran; canonical timestamp is meta.generatedAt (bar data)
  config: { mode: SMOKE ? 'smoke' : 'full', tf: TF, topN: TOP_N, bars: BARS_1H, warm: WARM,
            minRr: MIN_RR, fillWindowBars: FILL_WINDOW, timeoutBars: TIMEOUT_BARS,
            feePerSide: FEE_SIDE, slippagePerSide: SLIP_SIDE, symbols: syms, barsPerSymbol: perSymBars },
  deviations: [
    '1h timeframe (app scans 4h); horizonLabel 1H',
    'warm=' + WARM + ' not 45 (pillar minimum-history)',
    'dedup one-open-per-symbol+dir replaces i+=horizon cooldown',
    'expectancy pillar fed walk-forward record from this replay, not full-window hgOmniBacktestAll',
    'regime pillar sees btc-daily-proxy labels (scores 2 by vocabulary mismatch, by design)',
    'sessionTiming Date stubbed to signal-bar close',
    'htf EMAs from last ' + HTF_DAILY_BARS + ' real closed daily bars at signal time',
    'orderFlow 0 (no offline source; matches live), multiAsset OI leg n/a',
    'funding leg from last fundingRate record at-or-before signal close',
    'limit fill at touch, no gap price improvement; both-touch bar = LOSS; fill-bar t1 only granted when the bar opened at-or-through entry; timeout ' + TIMEOUT_BARS + ' bars',
    'fees ' + (COST_SIDE * 100).toFixed(2) + '% per side on entry+exit notional, in R',
    'account omitted (riskAdjusted default 10000)',
    'universe = top-' + TOP_N + ' USDT perps ranked by summed quoteVolume over the FIRST ' + UNIVERSE_RANK_DAYS + ' days of the lookback window (point-in-time; replaces end-of-window 24h-volume ranking and its attention bias; residual survivorship: perps delisted before fetch date are invisible)',
    'newsCalendar pillar constant (no historical calendar source offline): news blackouts are not modeled and live FOMC/CPI score caps never fire in the replay',
    /* ---- v531 additions ---- */
    'v531: cohort tags are HARNESS definitions, prefix-only at signal time: cluster = >=2 distinct kinds, same symbol+direction, same bar, entries within ' + CLUSTER_ATR + 'xATR14 (mirrors the app\'s identical-levels collapse but is computed here, not by app code); withTrend = 1h EMA' + H1_FAST + '>=EMA' + H1_SLOW + ' (fast over ' + (H1_FAST * 2) + ' closes, slow over ' + (H1_SLOW * 2) + ') AND daily EMA' + DAILY_FAST + '>=EMA' + DAILY_SLOW + ' both agreeing with direction, unknown=false; stopBand20x = plan stopDistPct in [' + BAND20X_LO + ', ' + BAND20X_HI + '] AND costR<=' + COST_OK_R + ' at the module default ' + RT_COST_PCT + '% round trip (window.HG_OMNI_RT_COST_PCT overrides are not modeled)',
    'v531: dedup (one open trade per symbol+direction) means a clustered bar contributes ONE trade tagged cluster=true; the co-firing kinds are recorded in clusterKinds, they are not separately traded',
    'v531: conviction mechanics fire inside the module\'s own hgOmniDetect and price through hgOmniPlanForHit\'s conviction branch (certified stopHint geometry via hgPlanFromRisk, 2R t1) — no harness-side reimplementation',
    'v531: conviction hits trade in a PARALLEL dedup lane (one open conviction trade per symbol+direction, independent of the legacy lane; fill/exit/fee model byte-identical). Without it the rare roster measured n=0 by construction — 95% of all signals are skipsOpen and commodity mechanics always held the single slot. The pre-v531 evidence file has no such lane: compare its numbers against this file\'s LEGACY cohort, not against overall.'
  ].concat(universeCacheNote ? ['v531 cache reuse: ' + universeCacheNote] : []),
  meta: {
    rosterVersion: ROSTER_VERSION,
    generatedAt: new RealDate(dataEndSec * 1000).toISOString(),  // from bar data: latest bar close across the universe
    universe: syms,
    universeCacheNote: universeCacheNote || null,
    cohortTagDefinitions: {
      hasConviction: 'hit carries conviction cert with costGate=passed (emitted only by the six v531 mechanics at formation)',
      cluster: '>=2 distinct mechanic kinds on the same symbol+direction at the same bar, entries within ' + CLUSTER_ATR + 'xATR14 of each other (same-bar detection output only)',
      withTrend: '1h prefix EMA' + H1_FAST + '>=EMA' + H1_SLOW + ' AND daily (cached bars cut to <= signal time) EMA' + DAILY_FAST + '>=EMA' + DAILY_SLOW + ', both agreeing with trade direction; unknown/absent = false',
      stopBand20x: 'plan stopDistPct in [' + BAND20X_LO + ', ' + BAND20X_HI + '] AND costR = ' + RT_COST_PCT + '/stopDistPct <= ' + COST_OK_R
    },
    universeSelection: 'point-in-time: all USDT perps listed today, ranked by summed quoteVolume over the first ' +
                       UNIVERSE_RANK_DAYS + ' days of the ' + BARS_1H + 'x1h lookback window (NOT today\'s 24h volume)',
    barCount: { perSymbolRequested: BARS_1H, perSymbol: perSymBars,
                total: Object.values(perSymBars).reduce((a, b) => a + b, 0) },
    feeModel: { takerPerSide: FEE_SIDE, slippagePerSide: SLIP_SIDE,
                note: 'charged on entry and exit notional, expressed in R against the plan risk distance; stops exit exactly at stop price (no gap-through modeling)' },
    limitations: [
      'SCORE INTEGRITY: 8 of 18 pillars are constant or near-constant offline — regime=2 and orderFlow=0 (disclosed by design), atrExpansion pinned ~4/"stable" (5-bar vs 20-bar mean of overlapping ATR-14 windows keeps the ratio ~1.0), liquidationRecovery at 12/12 max on nearly every trade (its 0.2%-close-move-within-15-bars reversal test is almost always satisfied on 1h crypto), fvg=0 everywhere, newsCalendar constant at max, structureConfluence confined to a narrow band. The offline-attainable score ceiling is ~176 of 200, so tiers solid (>=140) and extremely_solid (>=170) may be structurally under- or un-populated: this backtest primarily discriminates weak vs fair, not the top tiers the framework exists to certify.',
      'newsCalendar constant at max: historical news blackouts are not modeled; live FOMC/CPI score caps never fire in the replay.',
      'Touch-based fills throughout: limit entry and t1 fill on a bare touch of the level (no trade-through/queue requirement); stops exit exactly at the stop price with only the flat ' + (SLIP_SIDE * 100).toFixed(2) + '% slippage (no gap-through-stop modeling). Mildly optimistic on both sides; small on liquid 1h perps but nonzero.',
      'STATISTICAL POWER: per-tier and per-quartile buckets can be small; at n~15 a difference of ~0.3R/trade is inside one standard error. Treat bucket deltas as directional evidence, not statistically significant results.',
      'Residual universe survivorship: the point-in-time ranking can only see perps still listed on the fetch date; symbols delisted during the window are absent.',
      /* ---- v531 additions ---- */
      'v531 KLINE WINDOW AS-CACHED: the fetch layer has no incremental extension (cache is used whenever it holds >= the requested bars), so a re-run on a warm cache measures the window ending at the cache fetch date, not the run date. The measured window end is meta.generatedAt (latest cached bar close), which may lag wallClockRunAt.',
      'v531 COHORT POWER: conviction / cluster / in-band cohorts are far smaller than their complements by construction (the six mechanics are deliberately rare); at small n a cohort delta of several tenths of an R is inside one standard error. Directional evidence only.',
      'v531 CLUSTER UNDER DEDUP: because one trade per symbol+direction may be open, a cluster is measured as the FIRST tradeable hit of the co-firing group; which kind that is depends on hgOmniDetect\'s emission order, not on any quality ranking.',
      'v531 stopBand20x uses the module\'s DEFAULT ' + RT_COST_PCT + '% round-trip cost: venues that override window.HG_OMNI_RT_COST_PCT live would shift costR and the band verdict; the cert\'s own costR (carried per trade) is authoritative for conviction hits.'
    ]
  },
  counters,
  scoreDistribution: dist,
  aggregates: { overall, byTier: tierAgg, byQuartile: quartAgg, quartileCuts: cuts,
                byMechanic: byMech, cohorts },
  trades: allTrades.map(({ state, signalIdx, fillIdx, ...t }) => t)
};
fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 1));

/* ---- console table ---- */
const widths = [16, 6, 8, 8, 9, 9, 8, 8];
console.log('\n' + row(['bucket','n','winRate','avgR(g)','avgR(net)','expNet','PF','maxDD-R'], widths));
const printAgg = (name, a) => console.log(row([name, a.n, fmt(a.winRate), fmt(a.avgGrossR), fmt(a.avgNetR), fmt(a.expectancyNetR), fmt(a.profitFactor), fmt(a.maxDrawdownR)], widths));
printAgg('OVERALL', overall);
for (const k of ['weak','fair','solid','extremely_solid']) if (tierAgg[k]) printAgg('tier:' + k, tierAgg[k]);
for (const k of ['Q1','Q2','Q3','Q4']) if (quartAgg[k]) printAgg('quart:' + k, quartAgg[k]);

/* v531 cohort splits */
console.log('\n-- v531 cohorts (' + ROSTER_VERSION + ') --');
for (const [group, sides] of Object.entries(cohorts))
  for (const [name, a] of Object.entries(sides))
    if (a.n) printAgg(group + ':' + name, a); else console.log(row([group + ':' + name, 0, '—','—','—','—','—','—'], widths));

/* v531 full per-mechanic table (all kinds; the six conviction kinds always shown) */
console.log('\n-- per mechanic --');
for (const [k, a] of Object.entries(byMech)){
  const mark = CV_KINDS.includes(k) ? '*' : ' ';
  if (a.n) printAgg(mark + k, a);
  else console.log(row([mark + k, 0, '—','—','—','—','—','—'], widths));
}
console.log('(* = v531 conviction mechanic)');

console.log('\nsolidity: min ' + dist.min + ' · p25 ' + dist.p25 + ' · med ' + dist.median +
            ' · p75 ' + dist.p75 + ' · max ' + dist.max + ' · mean ' + dist.mean);
console.log('histogram: ' + Object.entries(dist.histogram || {}).map(([k, v]) => k + ':' + v).join(' '));
const { detectedByKind, ...flatCounters } = counters;
console.log('counters: ' + JSON.stringify(flatCounters));
console.log('detected by kind: ' + Object.entries(detectedByKind).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => k + ':' + v).join(' '));
console.log('conviction detections: ' + CV_KINDS.map(k => k + ':' + (detectedByKind[k] || 0)).join(' ') +
            '  (signals=' + counters.convictionSignals + ', opened=' + counters.convictionOpened + ')');
console.log('\nwrote ' + OUT_PATH + ' (' + allTrades.length + ' trades) in ' + ((RealDate.now() - t0) / 1000).toFixed(1) + 's');
