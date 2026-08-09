/* HARDGATE — strats.js unit tests (Node 18+, no imports beyond builtins).
   Loads indicators.js + indicators2.js + strats.js as classic scripts (one
   shared vm context, exactly like the browser's <script> globals) and
   asserts deterministic behavior on seeded synthetic rows:
     1. exports + HG_tabs registration
     2. degenerate inputs (empty / null / 30 bars / 300 flat bars) -> zero
        stats, no throw
     3. EMA cross: zig-zag trend series generates long AND short trades
     4. stop-first resolution: a bar touching stop AND target exits at the
        stop with r == -1
     5. Connors RSI-2: oscillator around a rising sma200 generates long
        mean-reversion trades
     6. Donchian: flat -> rally -> crash series generates breakout trades
     7. stats math on a hand-computed 3-trade fixture
     8. R math: r == cost-adjusted signed(exit-entry)/|entry-stop| (5+5 bps/side)
   Run: node tests/test-strats.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
for (const f of ['indicators.js', 'indicators2.js', 'strats.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = ctx;

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
function approx(a, b, eps, msg){
  assert(isFinite(a) && Math.abs(a - b) <= eps, msg + ' (got ' + a + ', want ~' + b + ')');
}

/* ---------------- deterministic data ---------------- */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Alternating 60-bar up/down legs (slope 0.8, small noise) => ema9/21 crosses
   in both directions, rsi14 filter satisfied a few bars into each leg. */
function waveRows(n, t0, seed){
  const rnd = mulberry32(seed);
  const rows = [];
  let price = 100;
  for (let i = 0; i < n; i++){
    const leg = Math.floor(i / 60) % 2;            // 0 = up, 1 = down
    const drift = leg === 0 ? 0.8 : -0.8;
    const o = price;
    const c = price + drift + (rnd() - 0.5) * 0.4;
    rows.push({ t: t0 + i * 3600, o: o, h: Math.max(o, c) + rnd() * 0.3,
                l: Math.min(o, c) - rnd() * 0.3, c: c, v: 1000 });
    price = c;
  }
  return rows;
}

/* Sine wave (amplitude 6, period ~38 bars) around a slow +0.05/bar uptrend:
   closes stay above the lagging sma200 except near deep troughs, and every
   down-leg produces consecutive down closes => rsi2 < 10 long entries. */
function oscRows(n, t0, seed){
  const rnd = mulberry32(seed);
  const rows = [];
  for (let i = 0; i < n; i++){
    const base = 100 + i * 0.05 + 6 * Math.sin(i / 6);
    const c = base + (rnd() - 0.5) * 0.2;
    const o = i ? rows[i - 1].c : c - 0.1;
    rows.push({ t: t0 + i * 3600, o: o, h: Math.max(o, c) + rnd() * 0.15,
                l: Math.min(o, c) - rnd() * 0.15, c: c, v: 1000 });
  }
  return rows;
}

/* 80 flat bars ~100, then a 90-bar rally (+0.8/bar), then a 90-bar crash
   (-0.9/bar) => donchian(20) upside breakout, band-exit, then downside
   breakout. */
function breakoutRows(n, t0, seed){
  const rnd = mulberry32(seed);
  const rows = [];
  let price = 100;
  for (let i = 0; i < n; i++){
    let drift;
    if (i < 80) drift = (rnd() - 0.5) * 0.6;
    else if (i < 170) drift = 0.8 + (rnd() - 0.5) * 0.1;
    else drift = -0.9 + (rnd() - 0.5) * 0.1;
    const o = price;
    const c = price + drift;
    rows.push({ t: t0 + i * 3600, o: o, h: Math.max(o, c) + rnd() * 0.15,
                l: Math.min(o, c) - rnd() * 0.15, c: c, v: 1000 });
    price = c;
  }
  return rows;
}

function flatRows(n, base, t0){
  const r = [];
  for (let i = 0; i < n; i++) r.push({ t: t0 + i * 3600, o: base, h: base, l: base, c: base, v: 1000 });
  return r;
}

/* ---------------- helpers ---------------- */
const ZERO_KEYS = ['n', 'winPct', 'avgR', 'expectR', 'profitFactor', 'maxDD', 'exposurePct'];
function expectZero(res, label){
  assert(res && Array.isArray(res.trades) && res.trades.length === 0, label + ': no trades');
  const s = res && res.stats;
  assert(!!s && ZERO_KEYS.every(k => s[k] === 0), label + ': zeroed stats');
}
const SG_COST_R = ((5 + 5) / 10000) * 2;
function sgCostAdjustR(r){ return isFinite(r) ? r - SG_COST_R : r; }
function checkRMath(tr, label){
  const risk = tr.dir === 'long' ? (tr.entry - tr.stop) : (tr.stop - tr.entry);
  const pnl  = tr.dir === 'long' ? (tr.exit - tr.entry) : (tr.entry - tr.exit);
  const rawR = pnl / risk;
  const want = sgCostAdjustR(rawR);
  assert(risk > 0 && isFinite(tr.r) && Math.abs(tr.r - want) < 1e-9,
         label + ': r == cost-adjusted signed(exit-entry)/|entry-stop| (' + tr.dir + ', r=' + tr.r.toFixed(3) + ')');
}
const REASONS = { ema: ['stop', 'target', 'cross', 'eod'], connors: ['stop', 'rsi', 'time', 'eod'], donchian: ['stop', 'band', 'time', 'eod'] };

/* ---------------- 1) exports + tab registration ---------------- */
{
  assert(typeof G.btEmaCross === 'function', 'export: window.btEmaCross is a function');
  assert(typeof G.btConnorsRsi2 === 'function', 'export: window.btConnorsRsi2 is a function');
  assert(typeof G.btDonchian === 'function', 'export: window.btDonchian is a function');
  assert(G.HG_strats && typeof G.HG_strats.computeStats === 'function', 'export: HG_strats.computeStats helper');
  const tab = (G.HG_tabs || []).find(t => t && t.id === 'strats');
  assert(!!tab && tab.label === 'STRATEGY LAB' && typeof tab.mount === 'function',
         'HG_tabs: {id:"strats", label:"STRATEGY LAB", mount} registered');
  // mount must never throw, even with deps (binanceKlines) missing in this ctx
  const stubEl = {
    innerHTML: '',
    querySelector(){ return { innerHTML: '', value: '', addEventListener(){}, style: {} }; },
    querySelectorAll(){ return []; }
  };
  let threw = false;
  try { tab.mount(stubEl); } catch (e) { threw = true; }
  assert(!threw && stubEl.innerHTML.includes('STRATEGY LAB'), 'mount: renders without throw (deps-missing path)');
}

/* ---------------- 2) degenerate inputs -> zero stats, no throw ---------------- */
{
  const fns = [['btEmaCross', G.btEmaCross], ['btConnorsRsi2', G.btConnorsRsi2], ['btDonchian', G.btDonchian]];
  for (const [name, fn] of fns){
    expectZero(fn([]), name + '([])');
    expectZero(fn(null), name + '(null)');
    expectZero(fn('junk'), name + '("junk")');
    expectZero(fn(flatRows(30, 100, 0)), name + '(30 flat bars)');
    expectZero(fn(flatRows(300, 100, 0)), name + '(300 flat bars: atr=0, rsi=50, no crosses/breakouts)');
  }
}

/* ---------------- 3) EMA cross: zig-zag trend generates long+short trades ---------------- */
{
  const res = G.btEmaCross(waveRows(400, 0, 7));
  assert(res.trades.length >= 2, 'ema cross: >=2 trades on 400-bar zig-zag (got ' + res.trades.length + ')');
  assert(res.trades.some(t => t.dir === 'long'), 'ema cross: at least one LONG trade');
  assert(res.trades.some(t => t.dir === 'short'), 'ema cross: at least one SHORT trade');
  assert(res.trades.every(t => REASONS.ema.includes(t.reason)), 'ema cross: exit reasons in {stop,target,cross,eod}');
  assert(res.stats.n === res.trades.length, 'ema cross: stats.n === trades.length');
  res.trades.forEach((t, i) => checkRMath(t, 'ema cross trade #' + (i + 1)));
}

/* ---------------- 4) stop-first resolution (stop AND target same bar) ---------------- */
{
  const base = waveRows(120, 0, 7);
  const probe = G.btEmaCross(base);
  assert(probe.trades.length > 0, 'stop-first fixture: probe run finds a trade');
  const t0 = probe.trades[0];
  const ei = t0.t / 3600;                       // entry bar index (t0 = i*3600)
  assert(Number.isInteger(ei) && base[ei] && Math.abs(base[ei].c - t0.entry) < 1e-9,
         'stop-first fixture: trade.t is the entry bar time');
  const risk = Math.abs(t0.entry - t0.stop);
  const target = t0.dir === 'long' ? t0.entry + 2.5 * risk : t0.entry - 2.5 * risk;
  // rebuild the series: identical through the signal bar, then one killer bar
  // whose range touches BOTH stop and target, then a few flat bars
  const rows2 = base.slice(0, ei + 1);
  rows2.push({
    t: (ei + 1) * 3600, o: t0.entry,
    h: Math.max(t0.entry, target, t0.stop) + risk * 0.2,
    l: Math.min(t0.entry, target, t0.stop) - risk * 0.2,
    c: t0.entry, v: 1000
  });
  for (let k = 2; k < 8; k++){
    rows2.push({ t: (ei + k) * 3600, o: t0.entry, h: t0.entry + risk * 0.05, l: t0.entry - risk * 0.05, c: t0.entry, v: 1000 });
  }
  const res2 = G.btEmaCross(rows2);
  assert(res2.trades.length >= 1, 'stop-first fixture: trade still generated after truncation');
  const tr = res2.trades[0];
  assert(Math.abs(tr.entry - t0.entry) < 1e-9 && tr.dir === t0.dir, 'stop-first fixture: same entry reproduced');
  assert(tr.reason === 'stop', 'stop-first: bar touching stop AND target resolves to STOP (got ' + tr.reason + ')');
  approx(tr.r, sgCostAdjustR(-1), 1e-9, 'stop-first: r == cost-adjusted -1 (filled at stop, no gap)');
  assert(Math.abs(tr.exit - t0.stop) < 1e-9, 'stop-first: exit price == stop price');
}

/* ---------------- 5) Connors RSI-2: oscillator around rising sma200 ---------------- */
{
  const res = G.btConnorsRsi2(oscRows(350, 0, 11));
  assert(res.trades.length >= 2, 'connors: >=2 trades on 350-bar oscillator (got ' + res.trades.length + ')');
  assert(res.trades.every(t => t.dir === 'long'),
         'connors: all trades LONG (close>sma200 regime; shorts need close<sma200 at an rsi2>90 peak, absent here)');
  assert(res.trades.every(t => REASONS.connors.includes(t.reason)), 'connors: exit reasons in {stop,rsi,time,eod}');
  assert(res.stats.n === res.trades.length, 'connors: stats.n === trades.length');
  res.trades.forEach((t, i) => checkRMath(t, 'connors trade #' + (i + 1)));
}

/* ---------------- 5b) Connors dedicated exit fixtures (noise-free) -----------
   220 gentle uptrend bars (close > lagging sma200), then two sharp -2 closes
   => rsi2 = 0 => LONG entry at that close. Then either:
   'fast': two +1.5 rebounds => rsi2 > 60 => 'rsi' exit
   'slow': tiny alternating closes => rsi2 pinned mid-range => 7-bar 'time' exit */
function connorsDipRows(recover){
  const rows = [];
  const bar = (o, h, l, c) => rows.push({ t: rows.length * 3600, o: o, h: h, l: l, c: c, v: 1000 });
  let price = 100;
  for (let i = 0; i < 220; i++){
    const c = 100 + i * 0.05, o = i ? rows[i - 1].c : c - 0.05;
    bar(o, Math.max(o, c) + 0.05, Math.min(o, c) - 0.05, c);
    price = c;
  }
  bar(price, price + 0.05, price - 2.05, price - 2); price -= 2;   // rsi2 ~2 => entry at this close
  if (recover === 'fast'){
    bar(price, price + 1.55, price - 0.05, price + 1.5); price += 1.5;
    bar(price, price + 1.55, price - 0.05, price + 1.5); price += 1.5;
  } else {
    for (let k = 0; k < 9; k++){
      const d = (k % 2 === 0) ? 0.05 : -0.05;
      bar(price, Math.max(price, price + d) + 0.05, Math.min(price, price + d) - 0.05, price + d);
      price += d;
    }
  }
  for (let k = 0; k < 5; k++){ const c = price + 0.05; bar(price, c + 0.05, price - 0.05, c); price = c; }
  return rows;
}
{
  const fast = G.btConnorsRsi2(connorsDipRows('fast'));
  assert(fast.trades.length >= 1, 'connors fast-dip fixture: trade generated (rsi2=0 above sma200)');
  assert(fast.trades[0].dir === 'long' && fast.trades[0].reason === 'rsi',
         'connors fast-dip fixture: LONG exits via rsi2 > 60 (got ' + fast.trades[0].reason + ')');
  assert(fast.trades[0].r > 0, 'connors fast-dip fixture: rebound exit is a win (r=' + fast.trades[0].r.toFixed(2) + ')');
  checkRMath(fast.trades[0], 'connors fast-dip trade');

  const slow = G.btConnorsRsi2(connorsDipRows('slow'));
  assert(slow.trades.length >= 1, 'connors slow-dip fixture: trade generated');
  assert(slow.trades[0].reason === 'time',
         'connors slow-dip fixture: 7-bar time cap exit (got ' + slow.trades[0].reason + ')');
  assert(slow.trades[0].bars === 7, 'connors slow-dip fixture: held exactly 7 bars (got ' + slow.trades[0].bars + ')');
  checkRMath(slow.trades[0], 'connors slow-dip trade');
}

/* ---------------- 6) Donchian: flat -> rally -> crash generates breakout trades ---------------- */
{
  const res = G.btDonchian(breakoutRows(260, 0, 13));
  assert(res.trades.length >= 1, 'donchian: >=1 trade on breakout series (got ' + res.trades.length + ')');
  assert(res.trades[0].dir === 'long', 'donchian: first trade LONG (upside breakout after flat base)');
  assert(res.trades.some(t => t.dir === 'short'), 'donchian: at least one SHORT trade (crash leg breakdown)');
  assert(res.trades.every(t => REASONS.donchian.includes(t.reason)), 'donchian: exit reasons in {stop,band,time,eod}');
  assert(res.stats.n === res.trades.length, 'donchian: stats.n === trades.length');
  res.trades.forEach((t, i) => checkRMath(t, 'donchian trade #' + (i + 1)));
}

/* ---------------- 7) stats math: hand-computed 3-trade fixture ---------------- */
{
  const fx = [
    { t: 1, dir: 'long',  entry: 100, exit: 110,  r: 2,   reason: 'target', bars: 3 },
    { t: 2, dir: 'long',  entry: 100, exit: 95,   r: -1,  reason: 'stop',   bars: 2 },
    { t: 3, dir: 'short', entry: 100, exit: 97.5, r: 0.5, reason: 'cross',  bars: 4 }
  ];
  const st = G.HG_strats.computeStats(fx, 100);
  // hand: n=3; wins=2/3; sumR=1.5 avgR=0.5; avgW=1.25 avgL=-1
  // expectR = (2/3)(1.25)+(1/3)(-1) = 0.5; PF = 2.5/1 = 2.5
  // equity 2 -> 1 -> 1.5, peak 2, maxDD = 1; exposure (3+2+4)/100 = 9%
  assert(st.n === 3, 'stats fixture: n = 3');
  approx(st.winPct, 200 / 3, 1e-9, 'stats fixture: winPct = 66.67');
  approx(st.avgR, 0.5, 1e-12, 'stats fixture: avgR = 0.5');
  approx(st.expectR, 0.5, 1e-12, 'stats fixture: expectR = (2/3)(1.25)+(1/3)(-1) = 0.5');
  approx(st.profitFactor, 2.5, 1e-12, 'stats fixture: profitFactor = 2.5');
  approx(st.maxDD, 1, 1e-12, 'stats fixture: maxDD = 1R (equity 2->1 trough)');
  approx(st.exposurePct, 9, 1e-12, 'stats fixture: exposurePct = 9%');
  // edge: all winners -> PF = Infinity; no trades -> zeros
  const pf = G.HG_strats.computeStats([{ r: 1, bars: 1 }, { r: 2, bars: 1 }], 10);
  assert(pf.profitFactor === Infinity, 'stats edge: no losses -> profitFactor = Infinity');
  expectZero({ trades: [], stats: G.HG_strats.computeStats([], 100) }, 'stats edge: empty trade list');
}

/* ---------------- 8) honesty stats: avgWinR / avgLossR / maxLoseStreak -------- */
{
  const fx = [
    { t: 1, dir: 'long',  entry: 100, exit: 110,  r: 2,   reason: 'target', bars: 3 },
    { t: 2, dir: 'long',  entry: 100, exit: 95,   r: -1,  reason: 'stop',   bars: 2 },
    { t: 3, dir: 'short', entry: 100, exit: 97.5, r: 0.5, reason: 'cross',  bars: 4 }
  ];
  const st = G.HG_strats.computeStats(fx, 100);
  approx(st.avgWinR, 1.25, 1e-12, 'honesty stats: avgWinR = (2+0.5)/2 = 1.25');
  approx(st.avgLossR, -1, 1e-12, 'honesty stats: avgLossR = -1');
  assert(st.maxLoseStreak === 1, 'honesty stats: maxLoseStreak = 1 on 3-trade fixture');

  // streak fixture: W L L L W L L -> longest losing run = 3; breakeven (r=0)
  // counts as a non-win, matching winPct's loss bucket
  const sk = G.HG_strats.computeStats(
    [{ r: 1, bars: 1 }, { r: -1, bars: 1 }, { r: -2, bars: 1 }, { r: -0.5, bars: 1 },
     { r: 3, bars: 1 }, { r: -1, bars: 1 }, { r: 0, bars: 1 }], 100);
  assert(sk.maxLoseStreak === 3, 'honesty stats: maxLoseStreak = 3 on W LLL W L BE (got ' + sk.maxLoseStreak + ')');
  approx(sk.avgWinR, 2, 1e-12, 'honesty stats: avgWinR = (1+3)/2 = 2 on streak fixture');
  approx(sk.avgLossR, -0.9, 1e-12, 'honesty stats: avgLossR = (-1-2-0.5-1+0)/5 = -0.9 on streak fixture');

  const z = G.HG_strats.computeStats([], 100);
  assert(z.avgWinR === 0 && z.avgLossR === 0 && z.maxLoseStreak === 0,
         'honesty stats: empty trade list -> new keys zeroed');

  // all-winners edge: avgLossR = 0 (no losing trades), streak = 0
  const aw = G.HG_strats.computeStats([{ r: 1, bars: 1 }, { r: 2, bars: 1 }], 10);
  assert(aw.avgLossR === 0 && aw.maxLoseStreak === 0 && aw.avgWinR === 1.5,
         'honesty stats: all-winners -> avgLossR 0, streak 0, avgWinR 1.5');
}

/* ---------------- 9) equity chart adapter: stubbed LightweightCharts recorder -- */
{
  const fx3 = [{ r: 2 }, { r: -1 }, { r: 0.5 }];
  const rec = { charts: [] };
  ctx.LightweightCharts = {
    LineStyle: { Dashed: 2 },
    createChart(el, opts){
      const c = { el: el, opts: opts, series: [], fitted: false };
      function mkSeries(type, o){
        const s = { type: type, opts: o, data: null, markers: null, priceLines: [] };
        s.setData = d => { s.data = d; };
        s.setMarkers = m => { s.markers = m; };
        s.createPriceLine = p => { s.priceLines.push(p); return p; };
        c.series.push(s);
        return s;
      }
      c.addLineSeries = o => mkSeries('line', o);
      c.addHistogramSeries = o => mkSeries('histogram', o);
      c.timeScale = () => ({ fitContent(){ c.fitted = true; } });
      rec.charts.push(c);
      return c;
    }
  };
  const el = { innerHTML: '' };
  let used = false, threw = false;
  try { used = G.HG_strats.equityMount(el, fx3); } catch (e){ threw = true; }
  assert(!threw, 'chart adapter: equityMount never throws with stubbed lib');
  assert(used === true, 'chart adapter: equityMount returns true when lightweight-charts available');
  assert(rec.charts.length === 1 && rec.charts[0].opts.height === 220,
         'chart adapter: one ~220px chart created');
  const ch = rec.charts[0];
  const line = ch.series.find(s => s.type === 'line');
  const hist = ch.series.find(s => s.type === 'histogram');
  assert(!!line && line.opts.color === '#D9A441' && line.opts.lineWidth === 2,
         'chart adapter: equity line series, gold #D9A441, lineWidth 2');
  assert(!!hist && hist.opts.color === 'rgba(228,88,107,.5)',
         'chart adapter: drawdown histogram series, rgba(228,88,107,.5)');
  assert(!!line && Array.isArray(line.data) && line.data.length === 3 &&
         line.data.every((d, i) => d.time === 1700000000 + i * 86400),
         'chart adapter: equity times are synthetic ascending seconds (trade index)');
  assert(!!line && line.data.map(d => d.value).join(',') === '2,1,1.5',
         'chart adapter: equity values = cumulative R [2, 1, 1.5] (got ' +
         (line && line.data ? line.data.map(d => d.value).join(',') : 'n/a') + ')');
  assert(!!hist && hist.data.map(d => d.value).join(',') === '0,-1,-0.5',
         'chart adapter: drawdown values = eq - running peak [0, -1, -0.5] (got ' +
         (hist && hist.data ? hist.data.map(d => d.value).join(',') : 'n/a') + ')');
  assert(!!line && line.priceLines.length === 1 && line.priceLines[0].price === 0,
         'chart adapter: reference price line at 0');
  assert(!!line && Array.isArray(line.markers) && line.markers.length === 2 &&
         line.markers[0].text.indexOf('BEST') === 0 && line.markers[1].text.indexOf('WORST') === 0,
         'chart adapter: markers on best (trade 1) and worst (trade 2), time-ordered');
  assert(ch.fitted === true, 'chart adapter: timeScale().fitContent() called');
  assert(el.innerHTML === '', 'chart adapter: no fallback strip injected when chart succeeds');
  delete ctx.LightweightCharts;
}

/* ---------------- 10) equity fallback: div strip when lib absent ------------- */
{
  const fx3 = [{ r: 2 }, { r: -1 }, { r: 0.5 }];
  assert(typeof ctx.LightweightCharts === 'undefined', 'fallback: LightweightCharts absent in this ctx');
  const el = { innerHTML: '' };
  let used = true, threw = false;
  try { used = G.HG_strats.equityMount(el, fx3); } catch ( e){ threw = true; }
  assert(!threw && used === false, 'fallback: equityMount returns false, no throw, when lib absent');
  assert(el.innerHTML.indexOf('display:flex') !== -1 && el.innerHTML.indexOf('cum ') !== -1,
         'fallback: legacy div strip markup rendered into the slot');
  assert(el.innerHTML.indexOf('one bar per trade step') !== -1,
         'fallback: original strip caption note preserved');
  // degenerate mounts never throw and never claim a chart
  assert(G.HG_strats.equityMount(null, fx3) === false, 'fallback: null slot -> false');
  assert(G.HG_strats.equityMount({ innerHTML: '' }, []) === false, 'fallback: empty trades -> false');
  // broken lib (createChart throws) also degrades to the strip
  ctx.LightweightCharts = { createChart(){ throw new Error('boom'); } };
  const el2 = { innerHTML: '' };
  const used2 = G.HG_strats.equityMount(el2, fx3);
  assert(used2 === false && el2.innerHTML.indexOf('display:flex') !== -1,
         'fallback: throwing chart lib degrades to the div strip');
  delete ctx.LightweightCharts;
  // legacy strip helper itself stays export-compatible
  assert(typeof G.HG_strats.equityStrip === 'function' && G.HG_strats.equityStrip([]) === '',
         'fallback: HG_strats.equityStrip exported; empty trades -> empty html');
}

/* ---------------- 11) comparison strip: highlight logic ---------------------- */
{
  const mk = (id, name, exp, over) => ({ meta: { id: id, name: name },
    res: { stats: Object.assign({ n: 5, expectR: exp, profitFactor: 1.5, maxDD: 2, winPct: 55 }, over || {}) } });
  const html = G.HG_strats.compareStrip([mk('ema', 'EMA CROSS 9/21', 0.2),
                                         mk('connors', 'CONNORS RSI-2', 0.8),
                                         mk('donchian', 'DONCHIAN 20 BREAKOUT', -0.1)]);
  assert(typeof html === 'string' && html.length > 0, 'compare: strip renders for 3 strategies');
  assert(html.indexOf('EMA CROSS 9/21') !== -1 && html.indexOf('CONNORS RSI-2') !== -1 &&
         html.indexOf('DONCHIAN 20 BREAKOUT') !== -1, 'compare: one card per strategy');
  assert(html.indexOf('BEST EDGE') !== -1, 'compare: best-expectancy card tagged');
  const ci = html.indexOf('CONNORS RSI-2');
  const cardStart = html.lastIndexOf('border:1px solid', ci);
  assert(html.slice(cardStart, ci).indexOf('var(--gold)') !== -1,
         'compare: best expectancy (connors 0.8R) gets the gold border');
  const ei = html.indexOf('EMA CROSS 9/21');
  const eStart = html.lastIndexOf('border:1px solid', ei);
  assert(html.slice(eStart, ei).indexOf('var(--line)') !== -1,
         'compare: non-best card keeps the normal line border');
  assert(html.indexOf('+0.80R') !== -1 && html.indexOf('PF 1.50') !== -1 &&
         html.indexOf('maxDD -2.00R') !== -1 && html.indexOf('win 55%') !== -1,
         'compare: cards show expectancy R + PF + maxDD + win%');

  // no-trades strategies are never eligible for the highlight
  const html2 = G.HG_strats.compareStrip([mk('ema', 'A', 0, { n: 0, expectR: 0 }),
                                          mk('connors', 'B', 0, { n: 0, expectR: 0 })]);
  assert(html2.indexOf('BEST EDGE') === -1 && html2.indexOf('var(--gold)') === -1,
         'compare: no highlight when every strategy has zero trades');
  // fewer than two strategies -> nothing to compare
  assert(G.HG_strats.compareStrip([]) === '', 'compare: empty input -> empty html');
  assert(G.HG_strats.compareStrip([mk('ema', 'A', 0.5)]) === '', 'compare: single strategy -> empty html');
  assert(G.HG_strats.compareStrip(null) === '', 'compare: null input -> empty html, no throw');
}

/* ---------------- 12) LIVE LEVELS footer (SL/TP audit) ---------------------- */
{
  assert(typeof G.sgLiveLevels === 'function', 'export: window.sgLiveLevels');
  assert(G.HG_strats && typeof G.HG_strats.liveLevels === 'function' &&
         typeof G.HG_strats.liveFooter === 'function', 'export: HG_strats.liveLevels + liveFooter');

  /* ema: a slice ending at a real backtest entry reproduces that signal
     exactly (indicators are causal — this pins live math == backtest math) */
  const w400 = waveRows(400, 0, 7);
  const emaRes = G.btEmaCross(w400);
  const t0 = emaRes.trades[0];
  const ei = t0.t / 3600;
  const lv = G.sgLiveLevels('ema', w400.slice(0, ei + 1));
  assert(lv !== null, 'live ema: setup active on the entry-bar slice');
  assert(lv.dir === t0.dir, 'live ema: same direction as the backtest trade');
  approx(lv.entry, t0.entry, 1e-9, 'live ema: entry == backtest entry (signal-bar close)');
  approx(lv.stop, t0.stop, 1e-9, 'live ema: stop == backtest stop (1.5xATR14)');
  const sgn = lv.dir === 'long' ? 1 : -1;
  const risk0 = Math.abs(t0.entry - t0.stop);
  assert(sgn * (lv.stop - lv.entry) < 0, 'live ema: stop against direction');
  approx(lv.t1, lv.entry + sgn * 2.5 * risk0, 1e-9, 'live ema: T1 = 2.5R (native target)');
  approx(lv.t2, lv.entry + sgn * 3.5 * risk0, 1e-9, 'live ema: T2 = 3.5R');
  assert(sgn * (lv.t1 - lv.entry) > 0 && sgn * (lv.t2 - lv.t1) > 0, 'live ema: T1/T2 ordered in trade direction');
  assert(lv.rr1 === 2.5 && lv.rr2 === 3.5, 'live ema: R multiples exposed');
  approx(lv.riskPct, risk0 / lv.entry * 100, 1e-9, 'live ema: riskPct = risk/entry*100');

  const sh = emaRes.trades.find(t => t.dir === 'short');
  const lvS = G.sgLiveLevels('ema', w400.slice(0, sh.t / 3600 + 1));
  assert(lvS !== null && lvS.dir === 'short', 'live ema: short setup reproduced on its slice');
  assert(lvS.stop > lvS.entry && lvS.t1 < lvS.entry && lvS.t2 < lvS.t1,
         'live ema short: stop above entry, targets below');

  /* connors: dedicated fixture entry sits at bar 220 (>= 210 warmup) */
  const cRows = connorsDipRows('fast');
  const cRes = G.btConnorsRsi2(cRows);
  const ct = cRes.trades[0];
  const clv = G.sgLiveLevels('connors', cRows.slice(0, ct.t / 3600 + 1));
  assert(clv !== null && clv.dir === 'long', 'live connors: dip setup reproduced (rsi2 extreme above sma200)');
  approx(clv.entry, ct.entry, 1e-9, 'live connors: entry == backtest entry');
  approx(clv.stop, ct.stop, 1e-9, 'live connors: stop == backtest stop (1xATR14)');
  approx(clv.t1, clv.entry + 2 * Math.abs(clv.entry - clv.stop), 1e-9, 'live connors: T1 = 2R');
  approx(clv.t2, clv.entry + 3.5 * Math.abs(clv.entry - clv.stop), 1e-9, 'live connors: T2 = 3.5R');
  assert(clv.stop < clv.entry, 'live connors long: stop below entry');

  /* donchian: first breakout is a long after the flat base */
  const b260 = breakoutRows(260, 0, 13);
  const dRes = G.btDonchian(b260);
  const dt = dRes.trades[0];
  const dlv = G.sgLiveLevels('donchian', b260.slice(0, dt.t / 3600 + 1));
  assert(dlv !== null && dlv.dir === 'long', 'live donchian: first breakout reproduced');
  approx(dlv.stop, dt.stop, 1e-9, 'live donchian: stop == backtest stop (2xATR14)');
  assert(dlv.stop < dlv.entry && dlv.t1 > dlv.entry, 'live donchian long: stop below, T1 above');

  /* degenerate inputs -> null, no throw */
  assert(G.sgLiveLevels('ema', null) === null && G.sgLiveLevels('connors', null) === null &&
         G.sgLiveLevels('donchian', null) === null, 'live: null rows -> null for all three');
  assert(G.sgLiveLevels('ema', []) === null, 'live: empty rows -> null');
  assert(G.sgLiveLevels('ema', 'junk') === null, 'live: non-array -> null');
  assert(G.sgLiveLevels('nope', w400) === null, 'live: unknown strategy id -> null');
  assert(G.sgLiveLevels('ema', flatRows(300, 100, 0)) === null, 'live ema: 300 flat bars -> no live setup');
  assert(G.sgLiveLevels('connors', flatRows(300, 100, 0)) === null, 'live connors: flat -> null');
  assert(G.sgLiveLevels('donchian', flatRows(300, 100, 0)) === null, 'live donchian: flat -> null');
  assert(G.sgLiveLevels('ema', w400.slice(0, 30)) === null, 'live ema: < 36 bars (warmup floor) -> null');
  assert(G.sgLiveLevels('connors', w400.slice(0, 100)) === null, 'live connors: < 200 bars (sma200 warmup) -> null');
  assert(G.sgLiveLevels('donchian', w400.slice(0, 60)) === null, 'live donchian: < 64 bars (atr+sma50 warmup) -> null');
  const allBad = flatRows(120, 100, 0).map(r => ({ t: r.t, o: NaN, h: NaN, l: NaN, c: NaN, v: NaN }));
  assert(G.sgLiveLevels('ema', allBad) === null, 'live ema: all-NaN rows -> null, no throw');

  /* footer markup: active setup prints exact levels; idle prints the honest note */
  const fActive = G.HG_strats.liveFooter('ema', w400.slice(0, ei + 1), []);
  assert(fActive.indexOf('LIVE LEVELS') !== -1 && fActive.indexOf('ENTRY <b>') !== -1 &&
         fActive.indexOf('STOP <b>') !== -1 && fActive.indexOf('T1 ') !== -1 && fActive.indexOf('T2 ') !== -1,
         'live footer: active markup contains ENTRY + STOP + T1 + T2');
  assert(fActive.indexOf('risk') !== -1 && fActive.indexOf('native exits') !== -1,
         'live footer: risk percent + native-exit note shown');
  const fIdle = G.HG_strats.liveFooter('ema', flatRows(300, 100, 0), emaRes.trades);
  assert(fIdle.indexOf('no live setup — last signal') !== -1, 'live footer: idle -> last-signal stamp');
  assert(/last signal \d{2}-\d{2} \d{2}:\d{2} UTC/.test(fIdle), 'live footer: last signal date printed');
  const fNone = G.HG_strats.liveFooter('ema', flatRows(300, 100, 0), []);
  assert(fNone.indexOf('no live setup — no signals in this history') !== -1,
         'live footer: idle + no trades -> honest no-signals note (nothing fabricated)');
}

/* ---------------- 13) HARD REFRESH contract (refresh field on the registration) --
   House contract: refresh is async, NEVER throws, returns a terse status
   string ('skipped: not run yet' before the first user run, 'busy' while a
   run is in flight, 'refreshed' after re-running the LAST configuration the
   user ran). Drives mount() + the RUN button with a stubbed binanceKlines —
   no live network anywhere. */
{
  ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;   // sgRun's trailing prog-hide timer
  const tab = (G.HG_tabs || []).find(t => t && t.id === 'strats');
  assert(typeof tab.refresh === 'function', 'refresh: registration carries a refresh function');

  function sgStubEl(){
    return {
      innerHTML: '', textContent: '', value: '', disabled: false, style: {},
      firstElementChild: { style: {} },
      classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      _qs: {}, _hs: {},
      addEventListener(ev, fn){ this._hs[ev] = fn; },
      appendChild(){},
      querySelector(sel){ if (!this._qs[sel]) this._qs[sel] = sgStubEl(); return this._qs[sel]; },
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

  /* klines stub: call log + an optional gate (for the busy path) */
  const klineCalls = [];
  let gate = null;
  ctx.binanceKlines = async function(sym, tf, n){
    klineCalls.push({ sym: sym, tf: tf, n: n });
    if (gate) await gate;
    return waveRows(400, 0, 7);
  };

  /* (a) never run -> skip, and no fetch happens */
  let st = await tab.refresh();
  assert(st === 'skipped: not run yet', 'refresh: before any user run -> "skipped: not run yet" (got "' + st + '")');

  /* (b) mounted but still never run -> still skip (a global refresh must not
     trigger an expensive first-time scan on its own) */
  const el = sgStubEl();
  tab.mount(el);
  st = await tab.refresh();
  assert(st === 'skipped: not run yet', 'refresh: mounted but never run -> "skipped: not run yet"');
  assert(klineCalls.length === 0, 'refresh: a skipped refresh performs no fetches');

  /* (c) user run with ETHUSDT, then an input edit WITHOUT a run: refresh must
     replay the last RUN configuration (ETHUSDT), not the typed edit (SOLUSDT) */
  const btn = el.querySelector('#sgRun'), symIn = el.querySelector('#sgSym'),
        statEl = el.querySelector('#sgStat'), outEl = el.querySelector('#sgOut');
  symIn.value = 'ETHUSDT';
  btn._hs.click();
  assert(await waitIdle(btn), 'run: user backtest run settles');
  assert(statEl.textContent.indexOf('ETHUSDT · 4h · 400 bars · done') === 0,
         'run: stat line shows symbol/tf/bars + done — got "' + statEl.textContent + '"');
  symIn.value = 'SOLUSDT';   // typed after the run — must NOT leak into the refresh
  st = await tab.refresh();
  assert(st === 'refreshed', 'refresh: after a user run -> "refreshed" (got "' + st + '")');
  assert(klineCalls.length === 2 && klineCalls[1].sym === 'ETHUSDT' && klineCalls[1].tf === '4h',
         'refresh: replays the LAST RUN configuration (ETHUSDT 4h), not the edited input (SOLUSDT)');
  assert(symIn.value === 'ETHUSDT', 'refresh: restores the last-run symbol into the input');

  /* (d) busy: an in-flight run makes refresh report "busy", never double-fetch */
  let release;
  gate = new Promise(r => { release = r; });
  btn._hs.click();                       // blocks inside the gated klines await
  st = await tab.refresh();
  assert(st === 'busy', 'refresh: during an in-flight run -> "busy" (got "' + st + '")');
  release(); gate = null;
  assert(await waitIdle(btn), 'run: gated backtest run settles after release');
  st = await tab.refresh();
  assert(st === 'refreshed' && klineCalls.length === 4, 'refresh: recovers after the busy window and re-runs');

  /* (e) loop resilience: one strategy throwing (donchian layer) is isolated —
     the run completes, the failing panel shows an honest zero state, the other
     panels are unaffected, and refresh still refreshes */
  const keepDonchian = ctx.donchian;
  ctx.donchian = function(){ throw new Error('boom'); };
  btn._hs.click();
  assert(await waitIdle(btn), 'run: completes even with a throwing strategy layer');
  assert(statEl.textContent.indexOf('done') !== -1 || statEl.textContent.indexOf('400 bars') !== -1,
         'loop resilience: stat line still reaches done with one strategy down');
  assert(outEl.innerHTML.indexOf('No trades generated on this data.') !== -1,
         'loop resilience: failing strategy renders an honest zero-trade panel (nothing fabricated)');
  assert(outEl.innerHTML.indexOf('EMA CROSS 9/21') !== -1 && outEl.innerHTML.indexOf('<th>TIME (UTC)</th>') !== -1,
         'loop resilience: healthy strategies still render full results');
  st = await tab.refresh();
  assert(st === 'refreshed', 'loop resilience: refresh still "refreshed" with a throwing strategy (got "' + st + '")');
  ctx.donchian = keepDonchian;

  /* (f) failure path never throws: klines blowing up -> terse failed: string,
     busy cleared, and the module heals on the next refresh */
  ctx.binanceKlines = async function(){ throw new Error('network down'); };
  st = await tab.refresh();
  assert(typeof st === 'string' && st.indexOf('failed:') === 0,
         'refresh: klines failure -> "failed: ..." string, never throws (got "' + st + '")');
  assert(btn.disabled === false, 'refresh: RUN re-enabled after a failed refresh (busy guard cleared)');
  ctx.binanceKlines = async function(sym, tf){ klineCalls.push({ sym: sym, tf: tf }); return waveRows(400, 0, 7); };
  st = await tab.refresh();
  assert(st === 'refreshed', 'refresh: module heals once the data layer recovers');
}

/* ---------------- summary ---------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
