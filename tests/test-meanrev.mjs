/* HARDGATE — meanrev.js unit tests (Node 18+, builtins only, no live network).
   Loads indicators.js + indicators2.js + meanrev.js as classic scripts in a
   shared vm context (mirrors the browser's <script> globals; window is stubbed)
   and asserts the pure exports window.mrSignal / window.mrBacktest:

     1. registration / load-time safety (HG_tabs entry, mount(null), mount(stubEl))
     2. degenerate inputs (null/garbage/empty/short/flat/NaN/null-rows) -> null/zeros, no throw
     3. missing indicator globals -> graceful null/zeros
     4. LONG signal on a synthetic series: 190 bars flat at 100, 17-bar plateau
        at 104 (bands tighten), then a 3-bar dip -> close > sma200, rsi2 ~ 0,
        %B < 0 — signal fires with exact entry/stop/target math
     5. SHORT mirror of (4)
     6. R:R < 1.2 gate: all conditions hold but the mean is too close -> skip
     7. regime filter: oversold BELOW sma200 and overbought ABOVE sma200 -> null
     8. backtest on a two-cycle oscillating series (real indicators):
        exactly 2 planted occurrences, both mean-touch wins
     9. backtest math on hand-computed fixtures (stubbed indicator arrays):
        mean-touch / stop-first / 10-bar-timeout resolution, non-overlap,
        aggregation (winPct / avgR / PF / expR) to 1e-9, short side
    10. mount() with missing binance globals -> warns + disables, no throw

   Run: node tests/test-meanrev.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = {};                                  // module exposes mrSignal/mrBacktest + HG_tabs here
for (const f of ['indicators.js', 'indicators2.js', 'meanrev.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = ctx;
const W = ctx.window;
const mrSignal = W.mrSignal, mrBacktest = W.mrBacktest;

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
function approx(a, b, tol, msg){
  assert(typeof a === 'number' && isFinite(a) && Math.abs(a - b) <= (tol || 1e-9),
         msg + ' (got ' + a + ', want ' + b + ')');
}

/* ---------------- synthetic data builders ---------------- */
function rep(v, k){ return new Array(k).fill(v); }
/* symmetric bars around each close, t = index; indicators only read h/l/c */
function mkRows(closes, spread){
  const s = (spread === undefined) ? 0.5 : spread;
  return closes.map(function(c, i){ return { t: i, o: c, h: c + s, l: c - s, c: c, v: 1000 }; });
}
const lastIdx = rows => rows.length - 1;
const closesOf = rows => rows.map(r => r.c);

/* LONG fixture: flat 100 x190, plateau 104 x17, dip 103.4 / 102.9 / 102.5 (210 bars).
   At the last bar: close 102.5 > sma200 ~ 100.38, rsi2 ~ 0.001, %B ~ -0.32. */
const longRows = mkRows(rep(100, 190).concat(rep(104, 17), [103.4, 102.9, 102.5]));
/* SHORT mirror: flat 100 x190, plateau 96 x17, rally 96.6 / 97.1 / 97.5. */
const shortRows = mkRows(rep(100, 190).concat(rep(96, 17), [96.6, 97.1, 97.5]));
/* R:R-SKIP fixture: plateau 101 x17, shallow dip 100.9 / 100.75 / 100.65 —
   trigger + regime hold but reward (sma20 - entry ~ 0.32) << risk (~1.0). */
const rrSkipRows = mkRows(rep(100, 190).concat(rep(101, 17), [100.9, 100.75, 100.65]));
/* COUNTER-REGIME LONG: flat 100 x207, dip 99.4 / 98.9 / 98.5 — oversold but close < sma200. */
const contraLongRows = mkRows(rep(100, 207).concat([99.4, 98.9, 98.5]));
/* COUNTER-REGIME SHORT: flat 100 x207, rally 100.6 / 101.3 / 102.2 — overbought but close > sma200. */
const contraShortRows = mkRows(rep(100, 207).concat([100.6, 101.3, 102.2]));
/* BACKTEST fixture (245 bars): two plateau/dip/recovery cycles around a rising sma200.
   Cycle 1: dip at 207-209 (occurrence at 209), recovery mean-touch at 211.
   Cycle 2: dip at 231-233 (occurrence at 233), recovery mean-touch at 235. */
const btRows = mkRows(
  rep(100, 190)
    .concat(rep(104, 17), [103.4, 102.9, 102.5], [103.1, 103.7, 104.2, 104.5])
    .concat(rep(105, 17), [104.4, 103.9, 103.5], [104.1, 104.7, 105.2], rep(105.5, 8))
);

/* ---------------- 1) registration / load-time safety ---------------- */
{
  assert(typeof mrSignal === 'function', 'window.mrSignal exported');
  assert(typeof mrBacktest === 'function', 'window.mrBacktest exported');
  assert(Array.isArray(W.HG_tabs) && W.HG_tabs.length === 1, 'HG_tabs registered exactly once');
  const t = W.HG_tabs[0];
  assert(t.id === 'meanrev' && t.label === 'MEAN REV' && typeof t.mount === 'function',
         'HG_tabs entry: id=meanrev, label=MEAN REV, mount fn');
  let threw = false;
  try { t.mount(null); } catch(e){ threw = true; }
  assert(!threw, 'mount(null) does not throw');
}

/* ---------------- 2) degenerate inputs -> null / zeros, no throw ---------------- */
{
  const zero = { n: 0, winPct: 0, avgR: 0, pf: 0, expR: 0 };
  const isZero = bt => bt && bt.n === 0 && bt.winPct === 0 && bt.avgR === 0 && bt.pf === 0 && bt.expR === 0;

  assert(mrSignal(null) === null, 'mrSignal(null) -> null');
  assert(mrSignal(undefined) === null, 'mrSignal(undefined) -> null');
  assert(mrSignal('garbage') === null, 'mrSignal("garbage") -> null');
  assert(mrSignal([]) === null, 'mrSignal([]) -> null');
  assert(mrSignal([{t:1,o:1,h:1,l:1,c:1,v:1}]) === null, 'mrSignal(single bar) -> null');
  assert(mrSignal(mkRows(rep(100, 60))) === null, 'mrSignal(60 flat bars, < sma200 warmup) -> null');

  const flat = mkRows(rep(100, 250));
  assert(mrSignal(flat) === null, 'mrSignal(250 flat bars: %B NaN, rsi 50) -> null, no throw');

  const nanLast = mkRows(rep(100, 250)); nanLast[249].c = NaN;
  assert(mrSignal(nanLast) === null, 'mrSignal(NaN last close) -> null, no throw');

  const nullRow = mkRows(rep(100, 250)); nullRow[249] = null;
  assert(mrSignal(nullRow) === null, 'mrSignal(null last row) -> null, no throw');

  const nullMid = mkRows(rep(100, 250)); nullMid[120] = null;
  assert(mrSignal(nullMid) === null, 'mrSignal(null mid row: poisoned atr/rsi) -> null, no throw');

  assert(isZero(mrBacktest(null)), 'mrBacktest(null) -> zeros');
  assert(isZero(mrBacktest(undefined)), 'mrBacktest(undefined) -> zeros');
  assert(isZero(mrBacktest('garbage')), 'mrBacktest("garbage") -> zeros');
  assert(isZero(mrBacktest([])), 'mrBacktest([]) -> zeros');
  assert(isZero(mrBacktest(mkRows(rep(100, 50)))), 'mrBacktest(50 flat bars) -> zeros');
  assert(isZero(mrBacktest(flat)), 'mrBacktest(250 flat bars, no setups) -> zeros, no throw');
  assert(isZero(mrBacktest(nanLast)), 'mrBacktest(NaN closes) -> zeros, no throw');
  assert(isZero(mrBacktest(nullRow)), 'mrBacktest(null row) -> zeros, no throw');
  const btShape = mrBacktest([]);
  assert(JSON.stringify(btShape) === JSON.stringify(zero),
         'mrBacktest zero-shape exactly {n:0, winPct:0, avgR:0, pf:0, expR:0}');
}

/* ---------------- 3) missing indicator globals -> graceful null/zeros ---------------- */
{
  const keepSma = G.sma, keepAtr = G.atr;
  G.sma = undefined;
  assert(mrSignal(longRows) === null, 'sma missing -> mrSignal null, no throw');
  assert(mrBacktest(longRows).n === 0, 'sma missing -> mrBacktest zeros, no throw');
  G.sma = keepSma;
  G.atr = undefined;
  assert(mrSignal(longRows) === null, 'atr missing -> mrSignal null, no throw');
  G.atr = keepAtr;
  assert(mrSignal(longRows) !== null, 'globals restored -> signal fires again');
}

/* ---------------- 4) LONG signal: planted rsi2 extreme above sma200 ---------------- */
{
  const rows = longRows, k = lastIdx(rows), c = closesOf(rows);
  const s200 = G.sma(c, 200)[k], s20 = G.sma(c, 20)[k], r2 = G.rsi(c, 2)[k];
  const pb = G.bollingerPercentB(rows, 20, 2), at = G.atr(rows, 14)[k];
  const lo5 = G.lowest(rows.map(r => r.l), 5)[k];

  /* premises: the construction really is regime-ok + rsi2 extreme + %B extreme */
  assert(c[k] === 102.5, 'premise: last close is 102.5');
  approx(s200, 100.384, 1e-9, 'premise: sma200 = 100.384');
  assert(c[k] > s200, 'premise: close > sma200 (regime long)');
  assert(r2 <= 10, 'premise: rsi(2) <= 10 (got ' + r2 + ')');
  assert(pb <= 0.05, 'premise: %B <= 0.05 (got ' + pb + ')');
  approx(s20, 103.84, 1e-9, 'premise: sma20 (the mean) = 103.84');
  assert(isFinite(at) && at > 0, 'premise: atr14 finite > 0 (got ' + at + ')');
  assert(lo5 === 102.0, 'premise: 5-bar lowest low = 102.0 (got ' + lo5 + ')');

  const sig = mrSignal(rows);
  assert(sig !== null, 'LONG: mrSignal fires on the planted dip');
  assert(sig.dir === 'long', 'LONG: side is "long"');
  assert(sig.entry === 102.5, 'LONG: entry = last close exactly');
  approx(sig.stop, lo5 - 0.5 * at, 1e-9, 'LONG: stop = 5-bar low - 0.5xATR14');
  assert(sig.stop < sig.entry, 'LONG: stop below entry');
  approx(sig.target, s20, 1e-12, 'LONG: target = sma20 (the mean)');
  assert(sig.target > sig.entry, 'LONG: target (mean) above entry');
  const rrWant = (s20 - c[k]) / (c[k] - (lo5 - 0.5 * at));
  approx(sig.rr, rrWant, 1e-9, 'LONG: rr = reward/risk matches hand math');
  assert(sig.rr >= 1.2, 'LONG: rr >= 1.2 (got ' + sig.rr.toFixed(3) + ')');

  /* the dip bars BEFORE the last one must NOT fire: %B still mid-band there */
  assert(mrSignal(rows.slice(0, k)) === null, 'LONG: one bar earlier %B > 0.05 -> no signal');
  assert(mrSignal(rows.slice(0, k - 1)) === null, 'LONG: two bars earlier %B > 0.05 -> no signal');

  /* the only occurrence is the still-open last bar -> nothing resolvable */
  const bt = mrBacktest(rows);
  assert(bt.n === 0 && bt.avgR === 0 && bt.pf === 0,
         'LONG: backtest n=0 (last-bar occurrence has no forward bars)');
}

/* ---------------- 5) SHORT signal: mirror construction ---------------- */
{
  const rows = shortRows, k = lastIdx(rows), c = closesOf(rows);
  const s200 = G.sma(c, 200)[k], s20 = G.sma(c, 20)[k], r2 = G.rsi(c, 2)[k];
  const pb = G.bollingerPercentB(rows, 20, 2), at = G.atr(rows, 14)[k];
  const hi5 = G.highest(rows.map(r => r.h), 5)[k];

  approx(s200, 99.616, 1e-9, 'premise: sma200 = 99.616');
  assert(c[k] === 97.5 && c[k] < s200, 'premise: close 97.5 < sma200 (regime short)');
  assert(r2 >= 90, 'premise: rsi(2) >= 90 (got ' + r2 + ')');
  assert(pb >= 0.95, 'premise: %B >= 0.95 (got ' + pb + ')');
  approx(s20, 96.16, 1e-9, 'premise: sma20 = 96.16');
  assert(hi5 === 98.0, 'premise: 5-bar highest high = 98.0 (got ' + hi5 + ')');

  const sig = mrSignal(rows);
  assert(sig !== null, 'SHORT: mrSignal fires on the planted rally');
  assert(sig.dir === 'short', 'SHORT: side is "short"');
  assert(sig.entry === 97.5, 'SHORT: entry = last close exactly');
  approx(sig.stop, hi5 + 0.5 * at, 1e-9, 'SHORT: stop = 5-bar high + 0.5xATR14');
  assert(sig.stop > sig.entry, 'SHORT: stop above entry');
  approx(sig.target, s20, 1e-12, 'SHORT: target = sma20 (the mean)');
  assert(sig.target < sig.entry, 'SHORT: target (mean) below entry');
  const rrWant = (c[k] - s20) / ((hi5 + 0.5 * at) - c[k]);
  approx(sig.rr, rrWant, 1e-9, 'SHORT: rr = reward/risk matches hand math');
  assert(sig.rr >= 1.2, 'SHORT: rr >= 1.2 (got ' + sig.rr.toFixed(3) + ')');

  assert(mrSignal(rows.slice(0, k)) === null, 'SHORT: one bar earlier %B < 0.95 -> no signal');
}

/* ---------------- 6) R:R < 1.2 gate: trigger + regime hold, mean too close ---------------- */
{
  const rows = rrSkipRows, k = lastIdx(rows), c = closesOf(rows);
  const s200 = G.sma(c, 200)[k], s20 = G.sma(c, 20)[k], r2 = G.rsi(c, 2)[k];
  const pb = G.bollingerPercentB(rows, 20, 2), at = G.atr(rows, 14)[k];
  const lo5 = G.lowest(rows.map(r => r.l), 5)[k];

  assert(c[k] > s200, 'premise: regime ok (close > sma200)');
  assert(r2 <= 10, 'premise: rsi(2) <= 10 (got ' + r2 + ')');
  assert(pb <= 0.05, 'premise: %B <= 0.05 (got ' + pb + ')');
  const rr = (s20 - c[k]) / (c[k] - (lo5 - 0.5 * at));
  assert(isFinite(rr) && rr > 0 && rr < 1.2, 'premise: raw R:R positive but < 1.2 (got ' + rr.toFixed(3) + ')');
  assert(mrSignal(rows) === null, 'R:R < 1.2 -> setup skipped (null) despite all triggers');
}

/* ---------------- 7) regime filter blocks counter-regime signals ---------------- */
{
  const rowsL = contraLongRows, kL = lastIdx(rowsL), cL = closesOf(rowsL);
  assert(cL[kL] < G.sma(cL, 200)[kL], 'premise: dip close < sma200');
  assert(G.rsi(cL, 2)[kL] <= 10, 'premise: rsi(2) <= 10 (deep oversold)');
  assert(G.bollingerPercentB(rowsL, 20, 2) <= 0.05, 'premise: %B <= 0.05');
  assert(mrSignal(rowsL) === null, 'oversold BELOW sma200 -> no long (regime block), no short (rsi)');

  const rowsS = contraShortRows, kS = lastIdx(rowsS), cS = closesOf(rowsS);
  assert(cS[kS] > G.sma(cS, 200)[kS], 'premise: rally close > sma200');
  assert(G.rsi(cS, 2)[kS] >= 90, 'premise: rsi(2) >= 90 (deep overbought)');
  assert(G.bollingerPercentB(rowsS, 20, 2) >= 0.95, 'premise: %B >= 0.95');
  assert(mrSignal(rowsS) === null, 'overbought ABOVE sma200 -> no short (regime block), no long (rsi)');
}

/* ---------------- 8) backtest on the two-cycle oscillating series (real indicators) ---------------- */
{
  const c = closesOf(btRows);
  /* premises: both cycles plant exactly one firing bar (209 / 233), neighbours blocked by %B or R:R */
  for (const k of [209, 233]){
    assert(c[k] > G.sma(c, 200)[k], 'premise: cycle occurrence at ' + k + ' above sma200');
    assert(G.rsi(c, 2)[k] <= 10, 'premise: rsi(2) <= 10 at ' + k);
    assert(G.bollingerPercentB(btRows.slice(0, k + 1), 20, 2) <= 0.05, 'premise: %B <= 0.05 at ' + k);
  }
  assert(mrSignal(btRows.slice(0, 210)) !== null, 'premise: standalone slice at 209 fires');
  assert(mrSignal(btRows.slice(0, 234)) !== null, 'premise: standalone slice at 233 fires');

  const bt = mrBacktest(btRows);
  assert(bt.n === 2, 'backtest: exactly 2 historical occurrences traded (got ' + bt.n + ')');
  assert(bt.winPct === 100, 'backtest: both recoveries touched the mean -> 100% win');
  assert(bt.pf === Infinity, 'backtest: zero losing trades -> PF Infinity convention');
  assert(isFinite(bt.avgR) && bt.avgR > 0, 'backtest: avgR > 0 (got ' + bt.avgR + ')');
  assert(bt.expR === bt.avgR, 'backtest: expR === avgR (expectancy per trade)');

  /* last bar is a quiet tail bar -> no live signal on the full fixture */
  assert(mrSignal(btRows) === null, 'backtest fixture: no live signal on the quiet tail');
}

/* ---------------- 9) hand-computed backtest fixtures (stubbed indicator arrays) ----------------
   Stubs replace the global indicator functions inside the vm (classic-script
   free-variable lookup, same pattern as test-squeeze). Every number below is
   fixed by construction:
     entry 100.05, stop 99.0 (5-bar low 99.5 - 0.5xATR 1.0), risk 1.05,
     target 101.35 (rr 1.238 >= 1.2).
     trade 1 @100: mean touch at 105 vs T20[105]=100.8  -> R = 0.75/1.05 = 5/7
     (decoy trigger @103 must be SKIPPED: trade 1 still open -> non-overlap)
     trade 2 @150: bar 151 touches BOTH stop and mean   -> stop-first -> R = -1
     trade 3 @190: no touch through bar 200 (=i+10)     -> timeout at close 100.55
                                                          -> R = 0.5/1.05 = 10/21
--------------------------------------------------------------------------------- */
{
  const keep = { sma: G.sma, rsi: G.rsi, atr: G.atr, bollinger: G.bollinger };
  const N = 220;
  const S200 = rep(100, N);
  const T20 = rep(100, N);
  T20[100] = 101.35; T20[101] = T20[102] = T20[104] = 101.0; T20[103] = 101.35; T20[105] = 100.8;
  T20[150] = 101.35; T20[151] = 100.8;
  T20[190] = 101.35; for (let j = 191; j <= 200; j++) T20[j] = 101.0;
  const R2 = rep(50, N); R2[100] = R2[103] = R2[150] = R2[190] = 5;
  const ATR1 = rep(1.0, N);
  const BB_MID = rep(100, N), BB_UP = rep(101, N), BB_LO = rep(99, N);
  BB_LO[100] = BB_LO[103] = BB_LO[150] = BB_LO[190] = 100;   // -> %B = 0.05 on trigger bars

  G.sma = function(arr, len){ return len === 200 ? S200 : (len === 20 ? T20 : rep(NaN, arr.length)); };
  G.rsi = function(){ return R2; };
  G.atr = function(){ return ATR1; };
  G.bollinger = function(){ return { mid: BB_MID, upper: BB_UP, lower: BB_LO, widthPct: BB_MID }; };

  function stubRows(n){
    const rows = [];
    for (let i = 0; i < n; i++) rows.push({ t: i, o: 100, h: 100.3, l: 99.8, c: 100, v: 1000 });
    const ov = {};
    [100, 103, 150, 190].forEach(i => { ov[i] = { c: 100.05 }; });
    for (let i = 96; i <= 103; i++) (ov[i] = ov[i] || {}).l = 99.5;
    for (let i = 146; i <= 150; i++) (ov[i] = ov[i] || {}).l = 99.5;
    for (let i = 186; i <= 190; i++) (ov[i] = ov[i] || {}).l = 99.5;
    (ov[105] = ov[105] || {}).h = 100.9;              // trade 1 mean-touch bar
    ov[151] = { h: 101.5, l: 98.9 };                  // trade 2 stop-first bar (both touched)
    for (let i = 191; i <= 199; i++) ov[i] = { c: 99.0 }; // early-exit would give R=-1
    ov[200] = { c: 100.55 };                          // trade 3 timeout close -> R = 10/21
    for (const k in ov){ const i = +k; if (i < n) Object.assign(rows[i], ov[k]); }
    return rows;
  }

  /* 9a: all three trades + the in-trade decoy trigger */
  {
    const bt = mrBacktest(stubRows(220));
    assert(bt.n === 3, 'stub 3-trade: n=3 (decoy trigger @103 skipped while trade 1 open) — got ' + bt.n);
    approx(bt.winPct, 200 / 3, 1e-9, 'stub 3-trade: winPct = 2/3');
    approx(bt.avgR, 4 / 63, 1e-9, 'stub 3-trade: avgR = (5/7 - 1 + 10/21)/3 = 4/63');
    approx(bt.pf, 25 / 21, 1e-9, 'stub 3-trade: PF = (5/7 + 10/21)/1 = 25/21');
    assert(bt.expR === bt.avgR, 'stub 3-trade: expR === avgR');
  }

  /* 9b: mean-touch only -> PF Infinity */
  {
    const keepR2 = G.rsi;
    const R2b = rep(50, N); R2b[100] = 5;
    G.rsi = function(){ return R2b; };
    const bt = mrBacktest(stubRows(130));
    assert(bt.n === 1, 'stub mean-touch: n=1');
    assert(bt.winPct === 100, 'stub mean-touch: 100% win');
    approx(bt.avgR, 5 / 7, 1e-9, 'stub mean-touch: avgR = 0.75/1.05 = 5/7 (exit at running sma20)');
    assert(bt.pf === Infinity, 'stub mean-touch: PF Infinity (no losers)');
    G.rsi = keepR2;
  }

  /* 9c: stop-first only -> R exactly -1, PF 0 */
  {
    const keepR2 = G.rsi;
    const R2c = rep(50, N); R2c[150] = 5;
    G.rsi = function(){ return R2c; };
    const bt = mrBacktest(stubRows(165));
    assert(bt.n === 1 && bt.winPct === 0, 'stub stop-first: 1 trade, 0% win');
    approx(bt.avgR, -1, 1e-12, 'stub stop-first: bar touches stop AND mean -> stop counts, R = -1');
    assert(bt.pf === 0, 'stub stop-first: PF = 0 (no winners, one loser)');
    assert(bt.expR === -1, 'stub stop-first: expR = -1');
    G.rsi = keepR2;
  }

  /* 9d: timeout at exactly bar i+10 */
  {
    const keepR2 = G.rsi;
    const R2d = rep(50, N); R2d[190] = 5;
    G.rsi = function(){ return R2d; };
    const bt = mrBacktest(stubRows(220));
    assert(bt.n === 1, 'stub timeout: n=1');
    approx(bt.avgR, 10 / 21, 1e-9,
           'stub timeout: exit at close of bar i+10 (100.55) -> R = 0.5/1.05 = 10/21, not the -1 of bars i+1..i+9');
    assert(bt.winPct === 100 && bt.pf === Infinity, 'stub timeout: small positive R counts as a win, PF Infinity');
    G.rsi = keepR2;
  }

  /* 9e: short side — mean-touch win (13/21) + stop-first loss (-1) */
  {
    const keepR2 = G.rsi, keepT20 = G.sma, keepBB = G.bollinger;
    const R2s = rep(50, N); R2s[100] = R2s[150] = 95;
    const T20s = rep(100, N);
    T20s[100] = 98.65; T20s[101] = T20s[102] = T20s[103] = T20s[104] = 99.0; T20s[105] = 99.3;
    T20s[150] = 98.65; T20s[151] = 99.3;
    const BB_UPs = rep(101, N), BB_LOs = rep(99, N); BB_UPs[100] = BB_UPs[150] = 100; // %B = 0.95 on triggers
    G.rsi = function(){ return R2s; };
    G.sma = function(arr, len){ return len === 200 ? S200 : (len === 20 ? T20s : rep(NaN, arr.length)); };
    G.bollinger = function(){ return { mid: BB_MID, upper: BB_UPs, lower: BB_LOs, widthPct: BB_MID }; };

    const rows = stubRows(165);
    rows[100].c = 99.95; rows[150].c = 99.95;       // below sma200=100
    for (let i = 96; i <= 100; i++) rows[i].h = 100.5;   // high5 = 100.5 -> stop 101.0
    for (let i = 146; i <= 150; i++) rows[i].h = 100.5;
    rows[105].l = 99.2;                             // short mean touch vs 99.3
    rows[151].h = 101.5; rows[151].l = 98.9;        // both touched -> stop-first

    const bt = mrBacktest(rows);
    assert(bt.n === 2, 'stub short: n=2 — got ' + bt.n);
    approx(bt.winPct, 50, 1e-9, 'stub short: 1 win 1 loss -> 50%');
    approx(bt.avgR, -4 / 21, 1e-9, 'stub short: avgR = (13/21 - 1)/2 = -4/21');
    approx(bt.pf, 13 / 21, 1e-9, 'stub short: PF = (0.65/1.05)/1 = 13/21');
    assert(bt.expR === bt.avgR, 'stub short: expR === avgR');
    G.rsi = keepR2; G.sma = keepT20; G.bollinger = keepBB;
  }

  /* restore real indicators, prove real path works again */
  G.sma = keep.sma; G.rsi = keep.rsi; G.atr = keep.atr; G.bollinger = keep.bollinger;
  assert(mrSignal(longRows) !== null && mrSignal(longRows).dir === 'long',
         'stubs removed -> real indicators classify again');
}

/* ---------------- 10) mount(): UI build, missing-globals path ---------------- */
{
  function makeClassList(){
    const s = new Set();
    return { add(){ for (const c of arguments) s.add(c); }, remove(){ for (const c of arguments) s.delete(c); },
             contains(c){ return s.has(c); } };
  }
  function makeEl(tag){
    return {
      tagName: String(tag || 'div').toUpperCase(), id: '', innerHTML: '', textContent: '',
      className: '', disabled: false, style: {}, children: [],
      classList: makeClassList(), firstElementChild: { style: {} },
      _qs: {},
      addEventListener(){}, appendChild(c){ this.children.push(c); return c; },
      setAttribute(){}, querySelector(sel){ if (!this._qs[sel]) this._qs[sel] = makeEl('div'); return this._qs[sel]; },
      querySelectorAll(){ return []; }
    };
  }
  const mount = W.HG_tabs[0].mount;

  /* binance.js is not loaded in this vm — stub its three globals so the
     mount feature-check sees a complete data layer (UI is only built, the
     scan itself is never run here). */
  G.binancePerpUniverse = async () => [];
  G.binanceTickers24h = async () => null;
  G.binanceKlines = async () => [];

  let threw = null;
  const el1 = makeEl('div');
  try { mount(el1); } catch(e){ threw = e; }
  assert(!threw, 'mount(stubEl) with all globals present does not throw');
  assert(el1.querySelector('#mrRun').disabled === false, 'mount: scan button enabled when globals present');
  assert(String(el1.innerHTML).indexOf('idle') !== -1 && String(el1.innerHTML).indexOf('id="mrStat"') !== -1,
         'mount: status line seeded in the panel markup');

  const keepKlines = G.binanceKlines, keepUniverse = G.binancePerpUniverse;
  G.binanceKlines = undefined; G.binancePerpUniverse = undefined;
  threw = null;
  const el2 = makeEl('div');
  try { mount(el2); } catch(e){ threw = e; }
  assert(!threw, 'mount() with missing binance globals does not throw');
  assert(el2.querySelector('#mrRun').disabled === true, 'mount: button disabled when binance layer missing');
  assert(String(el2.querySelector('#mrStat').textContent).indexOf('missing') !== -1,
         'mount: warning names the missing layer');
  G.binanceKlines = keepKlines; G.binancePerpUniverse = keepUniverse;

  const el3 = makeEl('div');
  mount(el3);
  assert(el3.querySelector('#mrRun').disabled === false, 'globals restored -> mount re-enables the button');
}

/* ---------------- 11) SL/TP audit: meanrevPlan live execution levels ---------------- */
{
  assert(typeof W.meanrevPlan === 'function', 'window.meanrevPlan exported');
  assert(typeof W.meanrevPlanHtml === 'function', 'window.meanrevPlanHtml exported');

  /* exact LONG math on the planted fixture */
  const rows = longRows, k = lastIdx(rows), c = closesOf(rows);
  const at = G.atr(rows, 14)[k];
  const up = G.bollinger(c, 20, 2).upper[k];
  const s20 = G.sma(c, 20)[k];
  const p = W.meanrevPlan({ dir: 'long', entry: 102.5, extreme: 102.0, atr: at, mean: s20, oppBand: up });
  assert(p !== null, 'plan LONG: built on the planted fixture');
  assert(p.dir === 'long' && p.entry === 102.5, 'plan LONG: dir + stretch entry passthrough');
  approx(p.stop, 102.0 - 1.5 * at, 1e-9, 'plan LONG: stop = extreme - 1.5xATR14');
  assert(p.stop < p.entry, 'plan LONG: stop below entry (against direction)');
  assert(p.t1 === s20, 'plan LONG: T1 = the sma20 mean exactly');
  assert(p.t1 > p.entry && p.t2 === up && p.t2 > p.t1, 'plan LONG: T1/T2 in the reversion direction, T2 = opposite band');
  approx(p.risk, 102.5 - p.stop, 1e-12, 'plan LONG: risk = entry - stop');
  approx(p.rr1, (s20 - 102.5) / p.risk, 1e-9, 'plan LONG: rr1 = (T1-entry)/risk hand math');
  approx(p.rr2, (up - 102.5) / p.risk, 1e-9, 'plan LONG: rr2 = (T2-entry)/risk hand math');
  approx(p.riskPct, p.risk / 102.5 * 100, 1e-9, 'plan LONG: riskPct = risk/entry*100');

  /* SHORT mirror */
  const rowsS = shortRows, kS = lastIdx(rowsS), cS = closesOf(rowsS);
  const atS = G.atr(rowsS, 14)[kS];
  const loS = G.bollinger(cS, 20, 2).lower[kS];
  const s20S = G.sma(cS, 20)[kS];
  const ps = W.meanrevPlan({ dir: 'short', entry: 97.5, extreme: 98.0, atr: atS, mean: s20S, oppBand: loS });
  assert(ps !== null && ps.dir === 'short', 'plan SHORT: built on the mirror fixture');
  approx(ps.stop, 98.0 + 1.5 * atS, 1e-9, 'plan SHORT: stop = extreme + 1.5xATR14');
  assert(ps.stop > ps.entry, 'plan SHORT: stop above entry (against direction)');
  assert(ps.t1 === s20S && ps.t1 < ps.entry && ps.t2 === loS && ps.t2 < ps.t1,
         'plan SHORT: T1 = mean below entry, T2 = lower band below T1');
  approx(ps.rr1, (97.5 - s20S) / (ps.stop - 97.5), 1e-9, 'plan SHORT: rr1 hand math');
  approx(ps.rr2, (97.5 - loS) / (ps.stop - 97.5), 1e-9, 'plan SHORT: rr2 hand math');

  /* degenerate inputs -> null, no throw */
  assert(W.meanrevPlan(null) === null && W.meanrevPlan() === null, 'plan(null/missing arg) -> null');
  assert(W.meanrevPlan({}) === null, 'plan({}) -> null');
  assert(W.meanrevPlan({ dir: 'sideways', entry: 100, extreme: 99, atr: 1, mean: 101, oppBand: 102 }) === null,
         'plan: invalid dir -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: NaN, extreme: 99, atr: 1, mean: 101, oppBand: 102 }) === null,
         'plan: NaN entry -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 100, extreme: NaN, atr: 1, mean: 101, oppBand: 102 }) === null,
         'plan: NaN extreme -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 100, extreme: 99, atr: 1, mean: NaN, oppBand: 102 }) === null,
         'plan: NaN mean -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 100, extreme: 99, atr: 1, mean: 101, oppBand: NaN }) === null,
         'plan: NaN oppBand -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 100, extreme: 99, atr: 0, mean: 101, oppBand: 102 }) === null,
         'plan: atr = 0 -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 100, extreme: 99, atr: -1, mean: 101, oppBand: 102 }) === null,
         'plan: negative atr -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 0, extreme: 99, atr: 1, mean: 101, oppBand: 102 }) === null,
         'plan: entry <= 0 -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 100, extreme: 101, atr: 0.5, mean: 102, oppBand: 103 }) === null,
         'plan LONG: stop lands above entry (extreme beyond entry) -> null');
  assert(W.meanrevPlan({ dir: 'short', entry: 100, extreme: 99, atr: 0.3, mean: 99, oppBand: 98 }) === null,
         'plan SHORT: stop lands below entry -> null');
  assert(W.meanrevPlan({ dir: 'long', entry: 100, extreme: 99, atr: 1, mean: 99.5, oppBand: 101 }) === null,
         'plan LONG: T1 (mean) not in the reversion direction -> null');
  const negT2 = W.meanrevPlan({ dir: 'long', entry: 100, extreme: 99, atr: 1, mean: 101, oppBand: 99.5 });
  assert(negT2 !== null && negT2.rr2 < 0, 'plan LONG: T2 on the wrong side keeps the plan but rr2 < 0 (honest)');

  /* markup: oiflow-style plan block contains STOP + T1 */
  const html = W.meanrevPlanHtml(p);
  assert(html.indexOf('ENTRY <b>') !== -1 && html.indexOf('STOP <b>') !== -1 &&
         html.indexOf('T1 ') !== -1 && html.indexOf('T2 ') !== -1,
         'planHtml: markup contains ENTRY + STOP + T1 + T2');
  assert(html.indexOf('risk') !== -1 && html.indexOf('R)') !== -1, 'planHtml: risk percent + R multiples shown');
  assert(W.meanrevPlanHtml(null) === '', 'planHtml(null) -> empty string');
}

/* ---------------- 12) HARD REFRESH contract (refresh field on the registration) --
   House contract: refresh is async, NEVER throws, returns a terse status
   string ('skipped: not run yet' before the first user run, 'busy' while a
   scan is in flight, 'refreshed' after re-running). Drives mount() + the
   FIND REVERSIONS button with a stubbed binance layer — no live network. */
{
  ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
  const tab = W.HG_tabs[0];
  assert(typeof tab.refresh === 'function', 'refresh: registration carries a refresh function');

  function mrStubEl(){
    return {
      innerHTML: '', textContent: '', disabled: false, style: {}, className: '',
      firstElementChild: { style: {} },
      classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      _qs: {}, _hs: {},
      addEventListener(ev, fn){ this._hs[ev] = fn; },
      appendChild(){},
      querySelector(sel){ if (!this._qs[sel]) this._qs[sel] = mrStubEl(); return this._qs[sel]; },
      querySelectorAll(){ return []; }
    };
  }
  async function waitIdle(btn){
    for (let i = 0; i < 400; i++){
      if (!btn.disabled) return true;
      await new Promise(r => setTimeout(r, 5));
    }
    return false;
  }

  /* (a) module mounted (section 10) but never RUN -> skip */
  let st = await tab.refresh();
  assert(st === 'skipped: not run yet', 'refresh: before any user run -> "skipped: not run yet" (got "' + st + '")');

  /* stub the binance layer: 3-perp universe — one signal (BTCUSDT on the
     LONG fixture), one flat (ETHUSDT), one throwing (SOLUSDT) */
  G.binancePerpUniverse = async () => ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  G.binanceTickers24h = async () => ({
    BTCUSDT: { turnoverUsd: 3.0e9 }, ETHUSDT: { turnoverUsd: 2.0e9 }, SOLUSDT: { turnoverUsd: 1.0e9 }
  });
  const klineCalls = [];
  let gate = null;
  G.binanceKlines = async function(sym){
    klineCalls.push(sym);
    if (gate) await gate;
    if (sym === 'SOLUSDT') throw new Error('boom');
    if (sym === 'BTCUSDT') return longRows;
    return mkRows(rep(100, 250));   // flat: no signal
  };

  const el = mrStubEl();
  tab.mount(el);
  st = await tab.refresh();
  assert(st === 'skipped: not run yet', 'refresh: freshly mounted but never run -> "skipped: not run yet"');
  assert(klineCalls.length === 0, 'refresh: a skipped refresh performs no fetches');

  /* (b) user run: the throwing symbol is catch-isolated and counted */
  const btn = el.querySelector('#mrRun'), statEl = el.querySelector('#mrStat'),
        cardsEl = el.querySelector('#mrCards');
  btn._hs.click();
  assert(await waitIdle(btn), 'run: user scan settles');
  assert(statEl.textContent.indexOf('universe 3 · signals 1 · failed 1') === 0,
         'loop resilience: throwing symbol isolated + counted, scan completes — got "' + statEl.textContent + '"');
  assert(klineCalls.length === 3, 'run: all 3 universe symbols fetched');
  assert(cardsEl.innerHTML.indexOf('BTCUSDT') !== -1 && cardsEl.innerHTML.indexOf('MEAN REV') !== -1,
         'run: the healthy signal still renders its card');

  /* (c) refresh re-runs the same scan */
  st = await tab.refresh();
  assert(st === 'refreshed', 'refresh: after a user run -> "refreshed" (got "' + st + '")');
  assert(klineCalls.length === 6, 'refresh: re-ran the scan (3 more kline fetches)');
  assert(statEl.textContent.indexOf('universe 3 · signals 1 · failed 1') === 0,
         'refresh: same universe/signal/failure tally on the re-run');

  /* (d) busy: an in-flight scan makes refresh report "busy", never double-fetch */
  let release;
  gate = new Promise(r => { release = r; });
  btn._hs.click();                       // blocks inside the gated klines await
  st = await tab.refresh();
  assert(st === 'busy', 'refresh: during an in-flight scan -> "busy" (got "' + st + '")');
  release(); gate = null;
  assert(await waitIdle(btn), 'run: gated scan settles after release');
  st = await tab.refresh();
  assert(st === 'refreshed', 'refresh: recovers after the busy window');

  /* (e) failure path never throws: universe layer gone -> terse failed:
     string, busy cleared, and the module heals on the next refresh */
  const keepUni = G.binancePerpUniverse;
  G.binancePerpUniverse = undefined;
  st = await tab.refresh();
  assert(typeof st === 'string' && st.indexOf('failed:') === 0,
         'refresh: dead universe layer -> "failed: ..." string, never throws (got "' + st + '")');
  assert(btn.disabled === false, 'refresh: button re-enabled after a failed refresh (busy guard cleared)');
  G.binancePerpUniverse = keepUni;
  st = await tab.refresh();
  assert(st === 'refreshed', 'refresh: module heals once the universe layer recovers');
}

/* ---------------- summary ---------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL MEANREV TESTS PASSED');
