/* HARDGATE — OMNIPRESENT offline backtest harness (node ESM, no deps).

   Replays OMNIPRESENT's two mechanics — OP-HIGH-REJECT (short fade of the
   nearest zone above) and OP-LOW-REJECT (long fade of the nearest zone
   below) — bar-by-bar over the SAME Binance futures 1h klines, the SAME
   25-symbol point-in-time universe and the SAME fill/exit/fee discipline as
   the audited OMNIROUTE harness (scripts/backtest-omniroute.mjs), with ZERO
   LOOKAHEAD.

   DETECTOR REUSE — VERBATIM, NOT REIMPLEMENTED
   --------------------------------------------
   omnipresent.js is vm-loaded into the same sandbox recipe as
   backtest-omniroute.mjs boot() (its lines 160-176), appended after the
   audited file list. Its detector chain is PURE over the prefix and is
   already window-exported by the module itself (omnipresent.js:1262-1272):
     opLevelSources (omnipresent.js:146-212)  — the level sources
     opZones        (omnipresent.js:217-246)  — clustering into zones
     opEvidence     (omnipresent.js:252-302)  — exhaustion evidence
     opAssess       (omnipresent.js:312-398)  — dir/entry/stop/t1 + ARMED/TRIGGERED
   The harness calls W.opAssess(prefix, livePx) — the exact call the live
   crypto scan makes (omnipresent.js:727, extraLevels omitted there too).
   NO detector logic lives in this file.

   ZONE LIFECYCLE (ARMED -> TRIGGERED) WITHOUT LOOKAHEAD
   -----------------------------------------------------
   No cross-bar zone state machine is simulated, because none is needed:
   opAssess re-derives the lifecycle from the prefix alone. Its trigger test
   (omnipresent.js:347-358) scans the LAST 3 CLOSED bars of the tape it is
   given for "tagged the zone AND closed back through it". So the replay
   simply calls opAssess at every bar close on rows.slice(0, i+1): the
   ARMED->TRIGGERED transition appears at exactly the first bar-close whose
   prefix tail satisfies sweep+reject — which is exactly when the live desk
   would flip the card ("Triggers evaluate at 1h bar closes",
   omnipresent.js:824-826). ARMED candidates are counted but NEVER traded
   (ARMED is WATCH, not a ticket — the module's own header, line 30-32).
   Because the trigger window is 3 bars wide, the same rejection re-reports
   TRIGGERED for up to 2 more bar closes; the harness dedups these ECHOES
   (see adaptation 3 below) so one rejection event is one trade.

   livePx: the live scan captures the forming close as livePx, then drops
   the forming bar (omnipresent.js:723-724). Replayed at the instant after
   bar i closes: bar i is now the last CLOSED bar and the new forming bar's
   price ~= bar i's close, so prefix = rows[0..i], livePx = rows[i].c is the
   same moment with zero lookahead. TRIGGERED entry = livePx by construction
   (omnipresent.js:366).

   RULES — IDENTICAL TO THE AUDITED OMNIROUTE HARNESS (blocks copied with
   line refs from scripts/backtest-omniroute.mjs):
   - scripts/.bt-cache 1h klines, paginated fetch + hgOmniDropForming
     (fetch1h, backtest-omniroute.mjs:233-250)
   - point-in-time 25-symbol universe: USDT perps ranked by summed
     quoteVolume over the FIRST 7 days of the lookback window, with the
     <=3-day adjacent-cache reuse (fetchUniverse, backtest-omniroute.mjs:
     285-348)
   - prefix-only detection at each bar close; last bar excluded (a signal
     there has no future bar to fill on) (backtest-omniroute.mjs:471-475)
   - fill-required: entry is a limit, filled when a later bar's range
     touches it, fill AT entry (gap-throughs are not price-improved),
     expired after FILL_WINDOW=24 unfilled bars (backtest-omniroute.mjs:
     455-463; deviation 10)
   - first-touch stop-vs-t1; a bar spanning BOTH = STOP (ambiguous-bar
     pessimism); fill-bar t1 only granted when the bar OPENED at-or-through
     the entry (checkExit, backtest-omniroute.mjs:434-448)
   - fees 0.05% taker + 0.02% slippage per side, on entry and exit
     notional, expressed in R (backtest-omniroute.mjs:130-132, 412)
   - dedup: one open trade per symbol+direction; skips counted
     (backtest-omniroute.mjs deviation 3)
   - TIMEOUT_BARS = 40, mark-to-market at close for a signed R. CHOICE,
     documented: OP trades are zone-reversal fades — mean-reversion either
     works fast or dies. The live desk forward-judges OP records at
     horizonBars: 24 (omnipresent.js:807); 40 bars (~1.7 days) gives the 2R
     target ~1.7x that judgment horizon so the harness does not clip
     winners the desk itself would still count, while stopping short of
     letting a fade become a drift trade. (The omniroute harness's 72 is a
     trend-following horizon; a fade held 3 days is a different trade than
     the desk printed.)

   OP-SPECIFIC ADAPTATIONS (each also in meta.limitations):
   1. PREFIX CAP 400 bars: the live scan fetches BARS=400 (omnipresent.js:
      84), so the detectors never see a longer tape live. The replay feeds
      opAssess the trailing 400 bars — fidelity, not an optimization.
   2. WARM = 160 bars: opAssess needs 120 rows (omnipresent.js:316) and its
      deepest lookback is the 160-bar pivot slice (omnipresent.js:159), so
      from bar 160 the detector inputs are at full live depth.
   3. ECHO DEDUP: a TRIGGERED candidate whose zone OVERLAPS the zone of the
      last OPENED trade for the same symbol+direction within 2 bars of that
      trade's signal is the SAME rejection re-reported by the 3-bar trigger
      window, not a new event — skipped, counted as skipsEcho. Beyond 2
      bars the window has slid past the original rejection bar, so a fresh
      TRIGGERED requires a fresh sweep+reject.
   4. GATES NOT REPLAYED: opGates (omnipresent.js:431-579) is the live
      desk's overlay (news feed, context bank, its own settled forward
      record — all live-state, not replayable offline). The forward pool
      this backtest mirrors is the TRIGGERED record set (omnipresent.js:
      803-807 logs TRIGGERED plans whether ticketed or not). The two
      offline-computable hard gates are recorded per trade as tags
      (confluence>=3, evidence>=2 — omnipresent.js:464-476) and an
      informational gated-cohort aggregate is emitted.
   5. kinds named exactly as the live forward log names them:
      'OP-' + (dir==='short' ? 'HIGH-REJECT' : 'LOW-REJECT')
      (omnipresent.js:540 and 805).

   Run:  node scripts/backtest-omnipresent.mjs --smoke   (3 symbols x 2000 bars)
         node scripts/backtest-omnipresent.mjs           (top 25 x 2000 bars)
         flags: --top=N --bars=N --offline
   Out:  scripts/backtest-omnipresent-results.json (full runs) + console table;
         --smoke writes scripts/backtest-omnipresent-smoke-results.json so a
         smoke rerun can never overwrite full-run evidence (audit fix).
   Cache: scripts/.bt-cache/*.json — shared with the omniroute harness;
          re-runs are fully offline. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ============================= config ============================= */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(root, 'scripts', '.bt-cache');

const args = process.argv.slice(2);
const flag = (name) => args.includes('--' + name);
const opt = (name, dflt) => {
  const hit = args.find(a => a.startsWith('--' + name + '='));
  return hit ? +hit.split('=')[1] : dflt;
};
const SMOKE = flag('smoke');
/* AUDIT FATAL FIX (2026-09-01): smoke and full runs used to share one output
   file, so a --smoke rerun silently OVERWROTE the full-run evidence — and the
   committed "full run" numbers were in fact a 3-symbol smoke run's. Smoke now
   writes its own file; backtest-omnipresent-results.json is full-run only. */
const OUT_PATH = path.join(root, 'scripts',
  SMOKE ? 'backtest-omnipresent-smoke-results.json' : 'backtest-omnipresent-results.json');
const OFFLINE = flag('offline');
const TOP_N = opt('top', SMOKE ? 3 : 25);
/* bars default 2000 in BOTH modes so smoke shares the full run's cached
   point-in-time universe window and klines (fully offline on a warm cache).
   Smoke's cut is the 3-symbol head, not a shorter tape. */
const BARS_1H = opt('bars', 2000);

const TF = '1h', TF_SEC = 3600;
const PREFIX_CAP = 400;           // live scan tape length (omnipresent.js:84 BARS=400)
const WARM = 160;                 // adaptation 2: full live detector depth from here
const FILL_WINDOW = 24;           // audited value (backtest-omniroute.mjs:128); OP fills are
                                  // near-immediate anyway (entry = signal-bar close)
const TIMEOUT_BARS = 40;          // zone-reversal horizon — documented choice (header)
const FEE_SIDE = 0.0005;          // taker 0.05% per side (backtest-omniroute.mjs:130)
const SLIP_SIDE = 0.0002;         // slippage 0.02% per side (backtest-omniroute.mjs:131)
const COST_SIDE = FEE_SIDE + SLIP_SIDE;
const ECHO_BARS = 2;              // adaptation 3: width of the trigger-window echo
const OP_KINDS = ['OP-HIGH-REJECT', 'OP-LOW-REJECT'];   // omnipresent.js:540/805 naming

const FAPI = 'https://fapi.binance.com';
const CHUNK = 4, SLEEP_MS = 350;  // polite pacing (backtest-omniroute.mjs:147)

/* ==================== sandbox: load the app's modules ==================== */
/* Same boot as backtest-omniroute.mjs:160-176 (window === globalThis so
   classic-script exports become bare globals exactly as in a browser), with
   omnipresent.js APPENDED to the audited file list. No SimDate: no
   OMNIPRESENT detector reads the clock (opNextCloses does, but it is UI
   copy, not detection). NO SOURCE PATCH is needed: omnipresent.js already
   window-exports its whole pure detector chain (omnipresent.js:1262-1272). */

const RealDate = Date;

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
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
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnipresent.js']){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
for (const fn of ['opAssess','opLevelSources','opZones','opEvidence','opPivots',
                  'hgOmniDropForming','atr','ema','rsi','donchian','volumeProfile','hgAVWAP']){
  if (typeof W[fn] !== 'function') { console.error('sandbox missing ' + fn); process.exit(1); }
}

/* ============================= data layer ============================= */
/* Copied VERBATIM from backtest-omniroute.mjs:209-348 (sleep, j, mapK,
   cache fns, fetch1h, fetchUniverse) minus fetchDaily/fetchFunding — no
   OMNIPRESENT detector input needs daily bars or funding. */

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

/* Paginated 1h klines — backtest-omniroute.mjs:233-250 verbatim. */
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

/* POINT-IN-TIME universe — backtest-omniroute.mjs:285-348 verbatim
   (audit FATAL fix for selection bias + the <=3-day cache-reuse note). */
const UNIVERSE_RANK_DAYS = 7;
let universeCacheNote = null;
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

/* ============================= replay core ============================= */

function round4(v){ return isFinite(v) ? Math.round(v * 1e4) / 1e4 : null; }

function replaySymbol(sym, rows, counters){
  const trades = [], open = { long: null, short: null };
  /* adaptation 3: last OPENED signal per direction, for echo dedup */
  const lastOpened = { long: null, short: null };

  const settle = (tr, outcome, exitPx, exitIdx) => {
    tr.state = 'done'; tr.outcome = outcome;
    const risk = Math.abs(tr.entry - tr.stop);
    let grossR = NaN;
    if (outcome === 'target') grossR = Math.abs(tr.t1 - tr.entry) / risk;
    else if (outcome === 'stop') grossR = -1;
    else if (outcome === 'timeout') grossR = (tr.dir === 'long' ? (exitPx - tr.entry) : (tr.entry - exitPx)) / risk;
    const costR = (COST_SIDE * tr.entry + COST_SIDE * exitPx) / risk;   // backtest-omniroute.mjs:412
    tr.rMultiple = round4(grossR);
    tr.costR = round4(costR);
    tr.netR = round4(grossR - costR);
    tr.exit = exitPx;
    tr.barsHeld = exitIdx - tr.fillIdx;
    tr.resolveT = rows[exitIdx].t + TF_SEC;
    trades.push(tr);
    open[tr.dir] = null;
  };

  /* First-touch exit for bar i — copied from backtest-omniroute.mjs:434-448:
     a bar spanning BOTH stop and t1 is a LOSS (ambiguous-bar pessimism);
     on the fill bar a bare t1 touch only wins when the bar OPENED
     at-or-through the entry (the fill provably precedes the target touch);
     stop grants stay pessimistic on every bar. */
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

    /* 1) advance pending/open trades — backtest-omniroute.mjs:453-469 */
    for (const dir of ['long', 'short']){
      const tr = open[dir];
      if (!tr) continue;
      if (tr.state === 'pending'){
        if (bar.l <= tr.entry && tr.entry <= bar.h){
          tr.state = 'open'; tr.fillIdx = i; tr.barsToFill = i - tr.signalIdx;
          checkExit(tr, bar, i, true);   // fill bar: stop counts; t1 only if open was through entry
        } else if (i - tr.signalIdx >= FILL_WINDOW){
          counters.expired++; open[dir] = null;   // never filled — not a trade
        }
      } else if (tr.state === 'open'){
        if (!checkExit(tr, bar, i, false) && i - tr.fillIdx >= TIMEOUT_BARS){
          settle(tr, 'timeout', bar.c, i);
        }
      }
    }

    /* 2) detect at the close of bar i — prefix-only, last bar excluded
       (backtest-omniroute.mjs:471-475). Prefix capped at the live tape
       length (adaptation 1); livePx = this close (header, livePx note). */
    if (i < WARM || i >= rows.length - 1) continue;
    const prefix = rows.slice(Math.max(0, i + 1 - PREFIX_CAP), i + 1);
    const livePx = bar.c;
    let cands = [];
    try { cands = W.opAssess(prefix, livePx) || []; } catch (e) { cands = []; }
    if (!cands.length) continue;

    const tSec = bar.t + TF_SEC;   // signal bar CLOSE time
    for (const cand of cands){
      if (!cand || (cand.dir !== 'long' && cand.dir !== 'short')) continue;
      counters.candidates++;
      if (cand.status === 'ARMED'){ counters.armedSeen++; continue; }   // ARMED is WATCH, never a trade
      if (cand.status !== 'TRIGGERED') continue;
      counters.triggeredSeen++;
      const dir = cand.dir;

      /* echo dedup — adaptation 3: same rejection re-reported by the 3-bar
         trigger window (zone overlap within ECHO_BARS of the last opened
         signal for this symbol+direction) is not a new event. */
      const le = lastOpened[dir];
      if (le && (i - le.signalIdx) <= ECHO_BARS &&
          cand.zone && cand.zone.lo <= le.zoneHi && cand.zone.hi >= le.zoneLo){
        counters.skipsEcho++; continue;
      }
      if (open[dir]){ counters.skipsOpen++; continue; }   // one open per symbol+dir

      const entry = +cand.entry, stop = +cand.stop, t1 = +cand.t1;
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1) ||
          !(Math.abs(entry - stop) > 0)){ counters.planRejected++; continue; }

      const evidenceN = Array.isArray(cand.evidence) ? cand.evidence.length : 0;
      const confluence = cand.zone ? +cand.zone.confluence : 0;
      open[dir] = {
        state: 'pending', signalIdx: i,
        sym, tISO: new RealDate(tSec * 1000).toISOString(),
        dir,
        kind: 'OP-' + (dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT'),   // omnipresent.js:540/805
        entry, stop, t1,
        rr1: 2,                                    // T1 = 2R by construction (omnipresent.js:370)
        zoneLo: round4(cand.zone && cand.zone.lo), zoneHi: round4(cand.zone && cand.zone.hi),
        confluence, srcs: cand.zone ? cand.zone.srcs : [],
        evidenceN, evidence: cand.evidence || [],
        distAtr: round4(cand.zone && cand.zone.distAtr),
        score: round4(cand.score), atr: cand.atr,
        gateConfluence3: confluence >= 3,          // offline-computable hard gates (omnipresent.js:464-476)
        gateEvidence2: evidenceN >= 2,
        fillIdx: -1, barsToFill: null
      };
      lastOpened[dir] = { signalIdx: i, zoneLo: +cand.zone.lo, zoneHi: +cand.zone.hi };
      counters.opened++;
    }
  }

  /* trades still pending/open when the data ran out: not resolvable, not counted */
  for (const dir of ['long', 'short']) if (open[dir]){
    counters[open[dir].state === 'pending' ? 'expired' : 'unresolvedAtEnd']++;
  }
  return trades;
}

/* ============================= aggregates ============================= */
/* aggregate() adapted from backtest-omniroute.mjs:602-625, plus medianCostR
   (the task's required per-kind field). */

function median(vals){
  if (!vals.length) return null;
  const s = vals.slice().sort((a, b) => a - b), m = s.length >> 1;
  return round4(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

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
  const chrono = list.slice().sort((a, b) => a.resolveT - b.resolveT);
  let cum = 0, peak = 0, maxDd = 0;
  for (const t of chrono){ cum += t.netR; if (cum > peak) peak = cum; if (peak - cum > maxDd) maxDd = peak - cum; }
  return {
    n, wins, losses, timeouts,
    winRate: round4(wins / n),
    avgGrossR: round4(grossSum / n),
    avgNetR: round4(netSum / n),
    medianCostR: median(list.map(t => t.costR)),
    profitFactor: negNet < 0 ? round4(posNet / -negNet) : (posNet > 0 ? Infinity : null),
    maxDrawdownR: round4(maxDd)
  };
}

function fmt(v){ return v === null || v === undefined ? '—' : (v === Infinity ? 'inf' : (typeof v === 'number' ? v.toFixed(3).replace(/\.?0+$/, m => m.includes('.') ? '' : m) : String(v))); }
function row(cols, widths){ return cols.map((c, i) => String(c).padEnd(widths[i])).join(' '); }

/* ============================= main ============================= */

const t0 = RealDate.now();
console.log('=== OMNIPRESENT OFFLINE BACKTEST — ' + (SMOKE ? 'SMOKE' : 'FULL') +
            ' · top ' + TOP_N + ' · ' + BARS_1H + ' x 1h bars · warm ' + WARM +
            ' · prefix cap ' + PREFIX_CAP + ' ===');

const syms = await fetchUniverse(TOP_N);
console.log('universe: ' + syms.join(' '));

const counters = { candidates: 0, armedSeen: 0, triggeredSeen: 0, opened: 0,
                   skipsOpen: 0, skipsEcho: 0, planRejected: 0,
                   expired: 0, unresolvedAtEnd: 0, ambiguousBars: 0, fillBarT1Deferred: 0 };
const allTrades = [];
const perSymBars = {};
let dataEndSec = 0;

for (let i = 0; i < syms.length; i += CHUNK){
  const slice = syms.slice(i, i + CHUNK);
  const datasets = await Promise.all(slice.map(async sym => {
    try { return { sym, rows: await fetch1h(sym, BARS_1H) }; }
    catch (e) { console.error('  ' + sym + ' data failed: ' + e.message); return null; }
  }));
  for (const d of datasets){
    if (!d || !d.rows || d.rows.length < WARM + 30) continue;
    perSymBars[d.sym] = d.rows.length;
    dataEndSec = Math.max(dataEndSec, d.rows[d.rows.length - 1].t + TF_SEC);
    const tr = replaySymbol(d.sym, d.rows, counters);
    allTrades.push(...tr);
    console.log('  ' + d.sym.padEnd(12) + d.rows.length + ' bars → ' + tr.length + ' resolved trades');
  }
  if (!OFFLINE && i + CHUNK < syms.length) await sleep(SLEEP_MS);
}

/* ---- aggregates ---- */
const byKindTrades = {};
for (const t of allTrades) (byKindTrades[t.kind] = byKindTrades[t.kind] || []).push(t);
const byKind = {};
for (const k of [...new Set([...OP_KINDS, ...Object.keys(byKindTrades)])].sort())
  byKind[k] = aggregate(byKindTrades[k] || []);
const overall = aggregate(allTrades);

/* informational: the two offline-computable hard gates as a cohort split
   (adaptation 4) — the live TICKET additionally needs the trend guard,
   news window, context bank and the desk's own settled record. */
const gatedPred = t => t.gateConfluence3 && t.gateEvidence2;
const gatedCohort = {
  bothHardGates: aggregate(allTrades.filter(gatedPred)),
  rest: aggregate(allTrades.filter(t => !gatedPred(t)))
};
const byKindGated = {};
for (const k of OP_KINDS)
  byKindGated[k] = aggregate((byKindTrades[k] || []).filter(gatedPred));

const result = {
  wallClockRunAt: new RealDate().toISOString(),
  config: { mode: SMOKE ? 'smoke' : 'full', tf: TF, topN: TOP_N, bars: BARS_1H, warm: WARM,
            prefixCap: PREFIX_CAP, fillWindowBars: FILL_WINDOW, timeoutBars: TIMEOUT_BARS,
            echoBars: ECHO_BARS, feePerSide: FEE_SIDE, slippagePerSide: SLIP_SIDE,
            symbols: syms, barsPerSymbol: perSymBars },
  meta: {
    generatedAt: new RealDate(dataEndSec * 1000).toISOString(),   // from bar data, not wall clock
    universe: syms,
    universeCacheNote: universeCacheNote || null,
    universeSelection: 'point-in-time: all USDT perps listed today, ranked by summed quoteVolume over the first ' +
                       UNIVERSE_RANK_DAYS + ' days of the ' + BARS_1H + 'x1h lookback window (NOT today\'s 24h volume)',
    detectorReuse: 'omnipresent.js vm-loaded verbatim after the audited backtest-omniroute.mjs boot file list; ' +
                   'signals come from the module\'s own window-exported opAssess (omnipresent.js:312-398, exports 1262-1272), ' +
                   'called exactly as the live crypto scan calls it (omnipresent.js:727: opAssess(rows, livePx), no extraLevels). ' +
                   'No detector logic is reimplemented in the harness.',
    lifecycleReplay: 'no cross-bar zone state machine: opAssess is pure over the prefix and derives ARMED/TRIGGERED from ' +
                     'the last 3 closed bars of the tape it is given (omnipresent.js:347-358). The replay calls it at every ' +
                     'bar close on the trailing 400-bar prefix; the ARMED->TRIGGERED transition therefore appears at exactly ' +
                     'the first bar-close whose prefix tail satisfies sweep+reject — the same 1h-bar-close grid the live desk ' +
                     'evaluates triggers on (omnipresent.js:824-826). Echoes of the same rejection inside the 3-bar window are ' +
                     'deduped (skipsEcho), ARMED candidates are counted but never traded.',
    disciplines: [
      'zero lookahead: detection at the close of bar i sees rows[0..i] only; livePx = bar i close (the forming price the live scan would hold at that instant); last bar excluded (no future bar to fill on)',
      'TRIGGERED-only entries: an ARMED zone is WATCH, never a trade (omnipresent.js:30-32); armedSeen counted',
      'fill-required: entry is a limit at the candidate entry (= signal-bar close for TRIGGERED, omnipresent.js:366); filled when a later bar\'s range touches it, fill AT entry (no gap price improvement); expired after ' + FILL_WINDOW + ' unfilled bars — an unfilled signal is not a trade (backtest-omniroute.mjs:455-463)',
      'first-touch stop-vs-t1; a bar spanning BOTH = STOP (ambiguous-bar pessimism, backtest-omniroute.mjs:434-448)',
      'fill-bar t1 only granted when the bar OPENED at-or-through the entry (long: o<=entry, short: o>=entry) — the fill provably precedes the target touch; otherwise deferred to the next bar; stop grants stay pessimistic on every bar',
      'fees ' + (FEE_SIDE * 100).toFixed(2) + '% taker + ' + (SLIP_SIDE * 100).toFixed(2) + '% slippage per side, charged on entry and exit notional, expressed in R against the plan risk distance',
      'one open trade per symbol+direction; same-direction signals while one is pending/open are counted skips (skipsOpen)',
      'timeout ' + TIMEOUT_BARS + ' bars in-position, exit at close mark-to-market for a signed R — DOCUMENTED CHOICE: zone-reversal fades either work fast or die; the live desk forward-judges OP records at horizonBars 24 (omnipresent.js:807), 40 gives the 2R target ~1.7x that horizon without letting a fade become a drift trade',
      'point-in-time 25-symbol universe shared byte-for-byte with the audited omniroute harness (fetchUniverse, backtest-omniroute.mjs:285-348), klines from the same scripts/.bt-cache',
      'kinds named exactly as the live forward log: OP-HIGH-REJECT (short) / OP-LOW-REJECT (long) (omnipresent.js:540/805)'
    ],
    limitations: [
      'PREFIX CAP 400: the detectors see the trailing 400 bars, the live tape length (omnipresent.js:84) — fidelity, but it means early-window signals (bars 160-399) see a shorter tape than live until the window fills',
      'GATES NOT REPLAYED: opGates (trend guard, news window, context bank, measured-edge — omnipresent.js:431-579) is live-desk state not replayable offline; this measures the RAW TRIGGERED mechanic, i.e. the same pool the live forward log records (omnipresent.js:803-807 logs TRIGGERED whether ticketed or not). The two offline-computable hard gates (confluence>=3, evidence>=2) are carried per-trade as tags and split in aggregates.gatedCohort / aggregates.byKindGated — informational, NOT the full live TICKET bar',
      'SHOWN-HEAD SELECTION NOT REPLAYED: the live desk forward-logs only the ranked shown head (<= 6 per scan across the whole universe, omnipresent.js:793-807); this replay records EVERY deduped TRIGGERED zone per symbol, so it measures the mechanic, not the desk\'s cross-symbol ranking',
      'ECHO DEDUP is a harness rule: the 3-bar trigger window re-reports the same rejection for up to 2 more closes; overlapping-zone TRIGGERED signals within ' + ECHO_BARS + ' bars of the last opened same-direction trade are skipped (skipsEcho). The live desk\'s scan cadence would show the same card persisting, not a new trade',
      'ENTRY TIMING: the replay always enters at the trigger bar\'s close (the earliest bar-close detection); a live scan running mid-bar could first-see the same TRIGGERED card up to 2 bars later at a different live price. The bar-close grid is the canonical reading of "triggers evaluate at 1h bar closes" (omnipresent.js:824-826)',
      'T2/runner not resolved: the forward-comparable leg is T1 = 2R (omnipresent.js:42-44 "the leg the forward log measures"); T2 (5-10R) outcomes are not modeled — avgNetR is the 2R-leg economics only',
      'touch-based fills: limit entry and t1 fill on a bare touch (no queue/trade-through requirement); stops exit exactly at the stop price plus flat slippage (no gap-through-stop modeling) — mildly optimistic on both sides',
      'timeouts settle at 40 bars mark-to-market; a different timeout would shift timeout-trade R (they are reported separately in the aggregates via the timeouts count)',
      'residual universe survivorship: the point-in-time ranking only sees perps still listed on the fetch date',
      'STATISTICAL POWER: two mechanics over 25 symbols x ~' + BARS_1H + ' bars can still be small-n per kind; treat deltas of a few tenths of an R as directional evidence, not significance'
    ].concat(universeCacheNote ? ['cache reuse: ' + universeCacheNote] : [])
  },
  counters,
  aggregates: { overall, byKind, gatedCohort, byKindGated },
  trades: allTrades.map(({ state, signalIdx, fillIdx, ...t }) => t)
};
fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 1));

/* ---- console table ---- */
const widths = [22, 6, 8, 8, 9, 10, 8, 8];
console.log('\n' + row(['bucket','n','winRate','avgR(g)','avgR(net)','medCostR','PF','maxDD-R'], widths));
const printAgg = (name, a) => a.n
  ? console.log(row([name, a.n, fmt(a.winRate), fmt(a.avgGrossR), fmt(a.avgNetR), fmt(a.medianCostR), fmt(a.profitFactor), fmt(a.maxDrawdownR)], widths))
  : console.log(row([name, 0, '—','—','—','—','—','—'], widths));
printAgg('OVERALL', overall);
for (const [k, a] of Object.entries(byKind)) printAgg(k, a);
console.log('\n-- hard-gate cohort (informational — not the live TICKET bar) --');
printAgg('gated:both', gatedCohort.bothHardGates);
printAgg('gated:rest', gatedCohort.rest);
for (const k of OP_KINDS) printAgg('gated:' + k, byKindGated[k]);
console.log('\ncounters: ' + JSON.stringify(counters));
console.log('\nwrote ' + OUT_PATH + ' (' + allTrades.length + ' trades) in ' + ((RealDate.now() - t0) / 1000).toFixed(1) + 's');
