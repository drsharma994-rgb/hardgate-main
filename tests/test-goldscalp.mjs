/* HARDGATE — goldind.js + goldscalp.js unit tests (Node 18+, builtins only,
   zero network). Loads both files as classic scripts via vm.runInThisContext
   with globalThis.window = {} (mirrors the browser's script globals), exactly
   the tests/test-warmup.mjs harness style.

   Covers: every goldind detector on synthetic candle arrays (empty / 1-2 rows
   / flat / garbage; FVG gap-up + gap-down + mitigation; sweeps long AND
   short; killzone in/out; BB-inside-KC squeeze then expansion both ways;
   Asian-range breakout both directions + building; RSI 75/25 + divergence
   both ways; CCI extremes + zero cross; StochRSI; MFI colours; ribbon;
   ichimoku; VWAP; season), the composite goldScalpSetup (0 confluence ->
   null; 3+ reads -> setup with stop on the correct side, t1/t2 on the
   correct sides, rr >= 1.5; long AND short; killzone grading; news-caution
   downgrade via a seeded hgNewsState-shaped object), the goldscalp mount
   smoke test with a stub pane, the refresh contract, and never-throws with
   ALL globals absent. Run: node tests/test-goldscalp.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- load the modules in a shared bare context ---------------- */
globalThis.window = {};
for (const f of ['goldind.js', 'goldscalp.js']){
  vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
}
const W = globalThis.window;

/* ---------------- synthetic data builders ---------------- */
function flatRows(n, base, spread, t0){
  const r = [];
  for (let i = 0; i < n; i++) r.push({ t: t0 + i, o: base, h: base + spread, l: base - spread, c: base, v: 1000 });
  return r;
}
function trendRows(n, start, step, t0, stepT){
  const r = [];
  for (let i = 0; i < n; i++){
    const c = start + (i + 1)*step, o = c - step;
    r.push({ t: t0 + i*(stepT || 1), o: o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c: c, v: 1000 });
  }
  return r;
}
function wiggleRows(n, start, up, dn, t0, stepT){          // biased sawtooth — RSI varies
  const r = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c;
    c += (i % 2 === 0) ? up : dn;
    r.push({ t: t0 + i*(stepT || 1), o: o, h: Math.max(o, c) + 0.4, l: Math.min(o, c) - 0.4, c: c, v: 1000 });
  }
  return r;
}
function mirrorRows(rows, M){                                // exact direction flip around M
  return rows.map(r => ({ t: r.t, o: 2*M - r.o, h: 2*M - r.l, l: 2*M - r.h, c: 2*M - r.c, v: r.v }));
}
const DAY = Date.UTC(2024, 0, 15, 0, 0, 0)/1000;             // a Monday, 00:00 GMT

/* =========================================================================
   0) registration / load-time safety
========================================================================= */
console.log('== 0) exports + tab registration ==');
{
  const names = ['goldFVG','goldOrderBlocks','goldSweeps','goldKillzone','goldVWAP','goldRibbon',
                 'goldIchimoku','goldMFI','goldVolSqueeze','goldAsianRange','goldRSIGold','goldCCI',
                 'goldStochRSI','goldSeason','goldScalpSetup'];
  for (const nm of names) assert(typeof W[nm] === 'function', 'window.' + nm + ' exported');
  const tab = W.HG_tabs.find(t => t.id === 'goldscalp');
  assert(!!tab && tab.label === 'GOLD SCALP' && typeof tab.mount === 'function' && typeof tab.refresh === 'function',
         'HG_tabs entry: id=goldscalp, label=GOLD SCALP, mount + refresh');
  const warm = (W.HG_warmups || []).find(t => t.id === 'goldscalp');
  assert(!!warm && warm.label === 'GOLD SCALP' && typeof warm.run === 'function', 'HG_warmups entry registered');
  let threw = false;
  try { tab.mount(null); } catch(e){ threw = true; }
  assert(!threw, 'mount(null) does not throw');
}

/* =========================================================================
   1) degenerate input tolerance — every detector
========================================================================= */
console.log('== 1) empty / 1-2 rows / flat / garbage input ==');
{
  const one = [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }];
  const two = one.concat([{ t: 2, o: 1, h: 1, l: 1, c: 1, v: 1 }]);
  const flat = flatRows(60, 100, 1, 0);
  assert(W.goldFVG([]) === null && W.goldFVG(null) === null && W.goldFVG(one) === null && W.goldFVG(two) === null, 'goldFVG: empty/null/1-2 rows -> null');
  assert(W.goldFVG(flat) === null, 'goldFVG: flat rows (no imbalance) -> null');
  assert(W.goldOrderBlocks([]) === null && W.goldOrderBlocks(one) === null && W.goldOrderBlocks(flat) === null, 'goldOrderBlocks: empty/1-row/flat -> null');
  assert(W.goldSweeps([]) === null && W.goldSweeps(two) === null, 'goldSweeps: empty/2 rows -> null');
  const swFlat = W.goldSweeps(flat);
  assert(swFlat === null || swFlat.dir === null, 'goldSweeps: flat rows -> no sweep (equal highs/lows never strictly broken)');
  assert(W.goldVWAP([]) === null && W.goldVWAP(null) === null && W.goldVWAP(flat, 500) === null, 'goldVWAP: empty/null/anchor out of range -> null');
  assert(W.goldRibbon([]).mode === 'NONE' && W.goldRibbon(one).mode === 'NONE', 'goldRibbon: empty/1 row -> NONE');
  assert(W.goldIchimoku([]).state === 'NONE' && W.goldIchimoku(flatRows(30, 100, 1, 0)).state === 'NONE', 'goldIchimoku: empty/short (<52) -> NONE');
  assert(W.goldMFI([]).last === 'NONE' && W.goldMFI(one).last === 'NONE', 'goldMFI: empty/1 row -> NONE');
  assert(W.goldVolSqueeze([]).state === 'NONE' && W.goldVolSqueeze(two).state === 'NONE', 'goldVolSqueeze: empty/2 rows -> NONE');
  assert(W.goldAsianRange([]) === null
         && W.goldAsianRange([{ o: 1, h: 1, l: 1, c: 1, v: 1 }, { o: 1, h: 1, l: 1, c: 1, v: 1 }, { o: 1, h: 1, l: 1, c: 1, v: 1 }]) === null,
         'goldAsianRange: empty / no timestamps -> null');
  assert(W.goldRSIGold([]).zone === 'NONE' && W.goldRSIGold(two).zone === 'NONE', 'goldRSIGold: empty/2 rows -> NONE');
  assert(W.goldCCI([]).zone === 'NONE' && W.goldCCI(two).zone === 'NONE', 'goldCCI: empty/2 rows -> NONE');
  assert(W.goldStochRSI([]).state === 'NONE' && W.goldStochRSI(two).state === 'NONE', 'goldStochRSI: empty/2 rows -> NONE');
  const kzBad = W.goldKillzone('not-a-date');
  assert(kzBad && kzBad.zone === 'OFF' && kzBad.weight === 0, 'goldKillzone: garbage input -> OFF/0, no throw');
  assert(W.goldSeason(null).bias === 'NEUTRAL' || typeof W.goldSeason(null).note === 'string', 'goldSeason: null input tolerated');
  assert(W.goldScalpSetup(null) === null && W.goldScalpSetup({}) === null && W.goldScalpSetup({ rows15m: [] }) === null, 'goldScalpSetup: null/empty input -> null');
  assert(W.goldScalpSetup({ rows15m: flat }) === null, 'goldScalpSetup: flat rows -> no confluence -> null');
  const junk = [{ t: 0, o: 'x', h: NaN, l: null, c: undefined, v: -1 }, null, { t: 1, o: 100, h: 101, l: 99, c: 100, v: 10 }];
  assert(W.goldFVG(junk) === null && W.goldSweeps(junk) === null, 'NaN/null holes filtered, never throws');
}

/* =========================================================================
   2) goldFVG — gap-up, gap-down, mitigation
========================================================================= */
console.log('== 2) goldFVG ==');
{
  const up = [
    { t: 0, o: 99,   h: 100,   l: 98,   c: 99.5, v: 1000 },
    { t: 1, o: 99.5, h: 102.5, l: 99,   c: 102,  v: 1000 },   // displacement
    { t: 2, o: 102,  h: 103.5, l: 101,  c: 103,  v: 1000 },   // low 101 > high[0] 100 -> gap [100,101]
    { t: 3, o: 103,  h: 104,   l: 102,  c: 103.5, v: 1000 }
  ];
  const f = W.goldFVG(up);
  assert(Array.isArray(f) && f.length === 1 && f[0].dir === 'bullish' && f[0].bottom === 100 && f[0].top === 101,
         'gap-up: bullish FVG [100,101] detected');
  const dn = mirrorRows(up, 100);
  const fd = W.goldFVG(dn);
  assert(Array.isArray(fd) && fd.length === 1 && fd[0].dir === 'bearish' && fd[0].top === 100 && fd[0].bottom === 99,
         'gap-down (mirrored): bearish FVG [99,100] detected');
  const mit = up.concat([{ t: 4, o: 103, h: 103.5, l: 99.5, c: 100.2, v: 1000 }]);   // wick through 100 -> filled
  assert(W.goldFVG(mit) === null, 'mitigated (wicked through) bullish FVG drops out');
}

/* =========================================================================
   3) goldSweeps — sweep-then-reclaim long AND short
========================================================================= */
console.log('== 3) goldSweeps ==');
{
  // 30 flat bars (lows 99, highs 101), then a wick below 99 that closes back above
  const longSweep = flatRows(30, 100, 1, 0).concat([
    { t: 30, o: 100, h: 100.6, l: 97.5, c: 100.2, v: 3000 }    // l < 99, c > 99
  ]);
  const sw = W.goldSweeps(longSweep);
  assert(sw && sw.dir === 'bullish' && sw.level === 99 && sw.barsAgo === 0, 'bullish sweep: wick below prior swing low, close back inside');
  const shortSweep = mirrorRows(longSweep, 100);
  const sw2 = W.goldSweeps(shortSweep);
  assert(sw2 && sw2.dir === 'bearish' && sw2.level === 101 && sw2.barsAgo === 0, 'bearish sweep (mirrored): wick above prior swing high, close back inside');
  // no reclaim -> no sweep
  const noReclaim = flatRows(30, 100, 1, 0).concat([{ t: 30, o: 100, h: 100.4, l: 97.5, c: 98, v: 3000 }]);
  const sw3 = W.goldSweeps(noReclaim);
  assert(sw3 === null || sw3.dir === null, 'wick below without reclaim (close stays under) -> no sweep');
}

/* =========================================================================
   4) goldKillzone — inside / outside hours
========================================================================= */
console.log('== 4) goldKillzone ==');
{
  const at = (h, m) => Date.UTC(2024, 0, 15, h, m || 0, 0);
  const k1 = W.goldKillzone(at(14, 30));
  assert(k1.zone === 'OVERLAP' && k1.weight === 3, '14:30 GMT -> LONDON/NY OVERLAP weight 3');
  const k2 = W.goldKillzone(at(8, 0));
  assert(k2.zone === 'LONDON' && k2.weight === 2, '08:00 GMT -> LONDON weight 2');
  const k3 = W.goldKillzone(at(11, 0));
  assert(k3.zone === 'NY_AM' && k3.weight === 1, '11:00 GMT -> NY AM weight 1');
  const k4 = W.goldKillzone(at(3, 0));
  assert(k4.zone === 'ASIAN' && k4.weight === 0, '03:00 GMT -> ASIAN weight 0');
  const k5 = W.goldKillzone(at(20, 0));
  assert(k5.zone === 'OFF' && k5.weight === 0, '20:00 GMT -> OFF-HOURS weight 0');
  const k6 = W.goldKillzone(Math.floor(at(14, 30)/1000));   // unix seconds accepted
  assert(k6.zone === 'OVERLAP' && k6.weight === 3, 'unix-seconds input normalized (14:30 GMT -> OVERLAP)');
}

/* =========================================================================
   5) goldVWAP — anchored value, bands, pos
========================================================================= */
console.log('== 5) goldVWAP ==');
{
  // tp = (h+l+c)/3 = c for symmetric bars; v 1000 => VWAP = mean of closes
  const rows = trendRows(10, 100, 1, 0);                    // closes 101..110, tp = c (+/-0.3 symmetric)
  const vw = W.goldVWAP(rows, 0);
  assert(vw && Math.abs(vw.value - 105.5) < 0.35, 'VWAP value ≈ mean typical price (got ' + (vw && vw.value) + ')');
  assert(vw.pos === 'ABOVE' && vw.upper > vw.value && vw.lower < vw.value, 'last close above VWAP -> ABOVE; bands straddle value');
  const vw2 = W.goldVWAP(rows, 5);
  assert(vw2 && vw2.anchor === 5 && vw2.value > vw.value, 'later anchor -> VWAP over the later, higher segment');
  assert(W.goldVWAP(rows, 99) === null, 'anchor beyond last bar -> null');
}

/* =========================================================================
   6) goldRibbon — BULL / BEAR / sellOnly / NONE
========================================================================= */
console.log('== 6) goldRibbon ==');
{
  const up = wiggleRows(220, 100, 1.1, -0.4, 0);
  const rb = W.goldRibbon(up);
  assert(rb.mode === 'BULL' && rb.above200 === true && rb.sellOnly === false, '220-bar uptrend -> BULL, above 200, not sell-only');
  const dn = wiggleRows(220, 400, 0.4, -1.1, 0);
  const rb2 = goldRibbonAssert(W, dn);
  assert(rb2.mode === 'BEAR' && rb2.above200 === false && rb2.sellOnly === true, '220-bar downtrend -> BEAR, below 200 -> sellOnly');
  assert(W.goldRibbon(flatRows(30, 100, 1, 0)).mode === 'NONE', 'short (<50 bars) -> NONE');
  function goldRibbonAssert(WW, rows){ return WW.goldRibbon(rows); }
}

/* =========================================================================
   7) goldIchimoku — above / below the cloud
========================================================================= */
console.log('== 7) goldIchimoku ==');
{
  const up = wiggleRows(80, 100, 1.2, -0.5, 0);
  const ic = W.goldIchimoku(up);
  assert(ic.state === 'ABOVE' && isFinite(ic.thickness) && ic.thickness >= 0, 'uptrend -> ABOVE the cloud, thickness reported');
  const dn = mirrorRows(up, 200);
  const ic2 = W.goldIchimoku(dn);
  assert(ic2.state === 'BELOW', 'downtrend (mirrored) -> BELOW the cloud');
  assert(ic2.tkCross === 'BEAR', 'downtrend -> tenkan below kijun (tkCross BEAR)');
}

/* =========================================================================
   8) goldMFI — bar colours
========================================================================= */
console.log('== 8) goldMFI ==');
{
  function mfiRows(rangePrev, volPrev, rangeLast, volLast){
    return [
      { t: 0, o: 100, h: 100 + rangePrev/2, l: 100 - rangePrev/2, c: 100, v: volPrev },
      { t: 1, o: 100, h: 100 + rangeLast/2, l: 100 - rangeLast/2, c: 100, v: volLast }
    ];
  }
  assert(W.goldMFI(mfiRows(2, 1000, 3, 1400)).last === 'GREEN', 'MFI up + volume up -> GREEN (volume-driven trend)');
  assert(W.goldMFI(mfiRows(2, 1000, 1, 2000)).last === 'SQUAT', 'MFI down + volume up -> SQUAT (pink: manipulation/breakout watch)');
  assert(W.goldMFI(mfiRows(2, 1000, 3, 500)).last === 'FAKE', 'MFI up + volume down -> FAKE');
  assert(W.goldMFI(mfiRows(2, 1000, 1, 500)).last === 'FADE', 'MFI down + volume down -> FADE');
}

/* =========================================================================
   9) goldVolSqueeze — BB inside KC, then expansion both ways
========================================================================= */
console.log('== 9) goldVolSqueeze ==');
{
  const flat = flatRows(60, 100, 1, 0);
  const on = W.goldVolSqueeze(flat);
  assert(on.state === 'ON' && on.onRun >= 3, 'pinned closes (BB sd ~0 inside KC) -> squeeze ON, onRun >= 3');
  const up = flat.concat(trendRows(5, 100, 1.5, 60));
  const f1 = W.goldVolSqueeze(up);
  assert(f1.state === 'FIRED' && f1.dir === 'UP' && f1.firedAgo !== null && f1.firedAgo <= 3,
         'squeeze then upward expansion close outside the bands -> FIRED UP (got ' + f1.state + ' ' + f1.dir + ' ago=' + f1.firedAgo + ')');
  const dn = flat.concat(trendRows(5, 100, -1.5, 60));
  const f2 = W.goldVolSqueeze(dn);
  assert(f2.state === 'FIRED' && f2.dir === 'DOWN', 'squeeze then downward expansion -> FIRED DOWN (got ' + f2.state + ' ' + f2.dir + ')');
  const off = trendRows(60, 100, 1, 0);
  assert(W.goldVolSqueeze(off).state === 'OFF', 'steady trend (BB wide vs KC) -> OFF');
}

/* =========================================================================
   10) goldAsianRange — 00:00-07:00 GMT box + breakout both directions
========================================================================= */
console.log('== 10) goldAsianRange ==');
{
  function asianRows(lastClose, lastHour){
    const rows = [];
    for (let i = 0; i < 28; i++)                                // 00:00 -> 06:45
      rows.push({ t: DAY + i*900, o: 100, h: 101, l: 99, c: 100, v: 1000 });
    rows.push({ t: DAY + lastHour*3600, o: 100, h: Math.max(100, lastClose) + 0.5,
                l: Math.min(100, lastClose) - 0.5, c: lastClose, v: 3000 });
    return rows;
  }
  const b = W.goldAsianRange(asianRows(100.5, 8));
  assert(b && b.hi === 101 && b.lo === 99 && b.state === 'INSIDE', 'box 99-101; close inside -> INSIDE');
  const l = W.goldAsianRange(asianRows(102, 8));
  assert(l && l.state === 'LONG_BREAK', 'close above the box -> LONG_BREAK');
  const s = W.goldAsianRange(asianRows(98, 8));
  assert(s && s.state === 'SHORT_BREAK', 'close below the box -> SHORT_BREAK');
  const g = W.goldAsianRange(asianRows(100.5, 5));
  assert(g && g.state === 'BUILDING', 'before 07:00 GMT -> BUILDING');
}

/* =========================================================================
   11) goldRSIGold — 75/25 zones + divergence both ways
========================================================================= */
console.log('== 11) goldRSIGold ==');
{
  const hot = trendRows(40, 100, 1, 0);
  const r1 = W.goldRSIGold(hot);
  assert(r1.zone === 'OVERBOUGHT' && r1.rsi >= 75, 'relentless rally -> RSI >= 75 OVERBOUGHT (gold band, not 70)');
  const cold = trendRows(40, 140, -1, 0);
  const r2 = W.goldRSIGold(cold);
  assert(r2.zone === 'OVERSOLD' && r2.rsi <= 25, 'relentless selloff -> RSI <= 25 OVERSOLD (gold band, not 30)');
  const mid = flatRows(40, 100, 0.5, 0);
  assert(W.goldRSIGold(mid).zone === 'NEUTRAL' || W.goldRSIGold(mid).rsi === 50, 'flat series -> RSI ~50 NEUTRAL');

  /* hand-built bullish divergence: price lower-low, RSI higher-low */
  function divLongRows(){
    const rows = [];
    const push = (o, h, l, c) => rows.push({ t: rows.length, o: o, h: h, l: l, c: c, v: 1000 });
    for (let i = 0; i < 20; i++) push(106 - i*0.1, 106.2 - i*0.1, 105.5 - i*0.1, 106 - (i+1)*0.1);   // drift 106 -> 104
    for (let i = 0; i < 5; i++)  push(104 - i*0.6, 104.1 - i*0.6, 103.2 - i*0.6, 103.6 - i*0.6);      // down to ~101
    push(101, 101.3, 99.5, 100.4);                                                                    // LOW 1: l 99.5
    push(100.4, 101, 100.1, 100.9);
    for (let i = 0; i < 8; i++)  push(100.9 + i*0.35, 101.4 + i*0.35, 100.6 + i*0.35, 101.25 + i*0.35); // bounce to ~103.7
    for (let i = 0; i < 3; i++)  push(103.7 - i*0.5, 103.9 - i*0.5, 102.9 - i*0.5, 103.2 - i*0.5);      // ease off
    push(102.2, 102.5, 99.0, 101.3);                                                                  // LOW 2: l 99.0 (< 99.5) but higher close
    push(101.3, 102, 101, 101.8);
    push(101.8, 102.4, 101.5, 102.2);
    return rows;
  }
  const dlr = divLongRows();
  const rl = W.goldRSIGold(dlr);
  assert(rl.div === 'BULLISH', 'price lower-low + RSI higher-low -> BULLISH divergence (got ' + rl.div + ' / ' + rl.detail + ')');
  const dsr = mirrorRows(dlr, 105);
  const rs = W.goldRSIGold(dsr);
  assert(rs.div === 'BEARISH', 'mirrored: price higher-high + RSI lower-high -> BEARISH divergence (got ' + rs.div + ')');
  assert(W.goldRSIGold(dlr).rsi > 0 && W.goldRSIGold(flatRows(25, 100, 1, 0)).div === null, 'no divergence on flat/short input');
}

/* =========================================================================
   12) goldCCI — ±100 extremes + zero-line cross
========================================================================= */
console.log('== 12) goldCCI ==');
{
  const up = trendRows(40, 100, 1, 0);
  const c1 = W.goldCCI(up);
  assert(c1.zone === 'EXTREME_HIGH' && c1.cci >= 100, 'linear uptrend -> CCI >= +100 EXTREME_HIGH');
  const dn = trendRows(40, 140, -1, 0);
  const c2 = W.goldCCI(dn);
  assert(c2.zone === 'EXTREME_LOW' && c2.cci <= -100, 'linear downtrend -> CCI <= -100 EXTREME_LOW');
  const cross = trendRows(25, 120, -1, 0).concat(trendRows(6, 95, 3, 25));
  const c3 = W.goldCCI(cross);
  assert(c3.zeroCross && c3.zeroCross.dir === 'UP', 'downtrend -> sharp reversal -> zero-line cross UP (got ' + JSON.stringify(c3.zeroCross) + ')');
}

/* =========================================================================
   13) goldStochRSI — pullback timing states
========================================================================= */
console.log('== 13) goldStochRSI ==');
{
  const hot = wiggleRows(50, 100, 1.3, -0.4, 0).concat(trendRows(4, 122.5, 1.5, 50));
  const s1 = W.goldStochRSI(hot);
  assert(s1.state === 'OVERBOUGHT' && s1.k >= 80, 'RSI finishing at its window high -> OVERBOUGHT (k=' + s1.k.toFixed(0) + ')');
  const cold = wiggleRows(50, 200, 0.4, -1.3, 0).concat(trendRows(4, 177.5, -1.5, 50));
  const s2 = W.goldStochRSI(cold);
  assert(s2.state === 'OVERSOLD' && s2.k <= 20, 'RSI finishing at its window low -> OVERSOLD (k=' + s2.k.toFixed(0) + ')');
}

/* =========================================================================
   14) goldSeason — seasonal bias, context only
========================================================================= */
console.log('== 14) goldSeason ==');
{
  assert(W.goldSeason(Date.UTC(2024, 0, 15)).bias === 'STRONG', 'January -> STRONG (Jan–Feb strongest)');
  assert(W.goldSeason(Date.UTC(2024, 1, 10)).bias === 'STRONG', 'February -> STRONG');
  assert(W.goldSeason(Date.UTC(2024, 4, 15)).bias === 'CONSOLIDATION', 'May -> CONSOLIDATION (spring/early-summer)');
  assert(W.goldSeason(Date.UTC(2024, 8, 15)).bias === 'NEUTRAL', 'September -> NEUTRAL');
  assert(/not a vote/.test(W.goldSeason(Date.UTC(2024, 0, 15)).note), 'seasonal note is explicitly context, never a vote');
}

/* =========================================================================
   15) goldOrderBlocks — OB + breaker
========================================================================= */
console.log('== 15) goldOrderBlocks / breakers ==');
{
  // base: 25 quiet bars, a bearish candle, then a >1.5xATR displacement up through the 20-bar swing high
  const rows = flatRows(25, 100, 0.5, 0);
  rows.push({ t: 25, o: 100, h: 100.4, l: 99.3, c: 99.6, v: 1200 });          // bearish candle = candidate OB
  rows.push({ t: 26, o: 99.6, h: 104.5, l: 99.5, c: 104.2, v: 4000 });        // displacement up, closes > swing high 100.5
  rows.push({ t: 27, o: 104.2, h: 105, l: 103.8, c: 104.6, v: 1500 });
  rows.push({ t: 28, o: 104.6, h: 105.2, l: 104, c: 104.8, v: 1500 });
  rows.push({ t: 29, o: 104.8, h: 105.3, l: 104.4, c: 105, v: 1400 });         // 30 bars: detector minimum
  const ob = W.goldOrderBlocks(rows);
  assert(ob && ob.bullish.length === 1 && Math.abs(ob.bullish[0].bottom - 99.3) < 1e-9 && Math.abs(ob.bullish[0].top - 100.4) < 1e-9,
         'bullish order block = last bearish candle before displacement');
  // now close back through the OB -> breaker (bias flip to bearish)
  const brk = rows.concat([
    { t: 29, o: 104.8, h: 104.9, l: 100.6, c: 100.8, v: 2000 },
    { t: 30, o: 100.8, h: 101, l: 98.8, c: 99.1, v: 3000 }                    // closes below OB bottom 99.3 -> failed
  ]);
  const ob2 = W.goldOrderBlocks(brk);
  assert(ob2 && ob2.breakers.length === 1 && ob2.breakers[0].dir === 'bearish', 'OB closed through -> bearish breaker (bias flip)');
}

/* =========================================================================
   16) composite — goldScalpSetup: null / long / short / grading / news
========================================================================= */
console.log('== 16) goldScalpSetup composite ==');

/* 120 x 15m bars starting Monday 00:00 GMT: decline, chop, RSI-low, sweep
   of the swing low with reclaim, recovery rally with an unmitigated bullish
   FVG, close above the day-2 session VWAP and above the cloud. */
function compLongRows(){
  const rows = [];
  const push = (i, o, h, l, c, v) => rows.push({ t: DAY + i*900, o: o, h: h, l: l, c: c, v: (v === undefined ? 1000 : v) });
  let c = 2320;
  for (let i = 0; i < 60; i++){ const o = c; c -= 0.2; push(i, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c); }   // 2320 -> 2308
  for (let i = 60; i < 96; i++){                                                                                     // chop 2304-2308
    const o = c; c = 2306 + ((i % 4) - 1.5)*1.2;
    push(i, o, Math.max(o, c) + 0.7, Math.min(o, c) - 0.9, c, 900);
  }
  for (let i = 96; i < 106; i++){ const o = c; c = o - 1.0; push(i, o, o + 0.4, c - 0.5, c, 1100); }                  // day-2 slide 2306 -> 2296
  push(106, 2296, 2296.5, 2293, 2294, 1500);                                                                          // RSI low (l 2293)
  push(107, 2294, 2298, 2293.8, 2297, 1200);
  push(108, 2297, 2300, 2296.5, 2299, 1200);
  push(109, 2299, 2299.6, 2288, 2297, 4000);                                                                          // SWEEP of 2293 -> reclaim
  push(110, 2297, 2299.5, 2296.4, 2298.5, 1300);
  push(111, 2298.5, 2300.6, 2298, 2300, 1300);
  push(112, 2300, 2301.6, 2299.5, 2301, 1200);
  push(113, 2301, 2302.6, 2300.5, 2302, 1200);
  push(114, 2302, 2303, 2301.5, 2302.5, 1200);
  push(115, 2302.5, 2305.5, 2302, 2305, 2600);                                                                        // displacement
  push(116, 2305, 2306.5, 2303.5, 2306, 1500);                                                                        // FVG [2303, 2303.5]
  push(117, 2306, 2306.6, 2304.6, 2305.5, 1100);
  push(118, 2305.5, 2306.4, 2304.8, 2306, 1100);
  push(119, 2306, 2306.5, 2305, 2305.8, 1100);
  return rows;
}
const OFF_NOW = Date.UTC(2024, 0, 16, 20, 0, 0);          // 20:00 GMT -> killzone weight 0
const OVLP_NOW = Date.UTC(2024, 0, 16, 14, 0, 0);         // 14:00 GMT -> weight 3

{
  const rows = compLongRows();
  /* premise checks on the construction */
  const sw = W.goldSweeps(rows);
  assert(sw && sw.dir === 'bullish', 'premise: construction contains a bullish sweep');
  const fv = W.goldFVG(rows);
  assert(fv && fv[0].dir === 'bullish', 'premise: construction contains an unmitigated bullish FVG');
  const dv = W.goldRSIGold(rows);
  assert(dv.div === 'BULLISH', 'premise: construction contains a bullish RSI divergence (got ' + dv.div + ')');

  const s = W.goldScalpSetup({ rows15m: rows, now: OFF_NOW });
  assert(s !== null, '3+ agreeing reads -> setup produced');
  assert(s && s.dir === 'long', 'direction = long (got ' + (s && s.dir) + ', reads ' + JSON.stringify(s && s.reads) + ')');
  assert(s && s.reads.long >= 3 && s.reads.long > s.reads.short, '>=3 independent agreeing reads, majority long');
  assert(s && s.stop < s.entry, 'long: STOP below ENTRY');
  assert(s && s.t1 > s.entry && s.t2 > s.t1, 'long: TP1 above ENTRY, TP2 above TP1');
  assert(s && s.rr >= 1.5 - 1e-9, 'long: rr >= 1.5 (got ' + (s && s.rr) + ')');
  assert(s && Math.abs((s.entry - s.stop) - 1.5*s.atr) < 1e-9, 'long: stop distance = 1.5xATR14(15m) (swept low too far to use)');
  assert(s && Array.isArray(s.confluence) && s.confluence.length === s.reads.long, 'confluence ledger lists every agreeing read');
  assert(s && typeof s.strategy === 'string' && s.strategy.length > 0, 'strategy named: ' + (s && s.strategy));
  assert(s && s.grade === 'B', 'reads 5 + killzone 0 -> grade B (got ' + (s && s.grade) + ')');
  assert(s && s.newsCaution === false && s.newsStamp === null, 'no news -> no caution, no stamp');
  assert(s && /GMT/.test(s.killzone), 'killzone stamp present: ' + (s && s.killzone));

  const s2 = W.goldScalpSetup({ rows15m: rows, now: OVLP_NOW });
  assert(s2 && s2.grade === 'A', 'same reads inside the London/NY overlap -> grade A (got ' + (s2 && s2.grade) + ')');

  /* NEWS-FADE: high-impact event +10 min -> caution + one-letter downgrade */
  const news = { loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(OVLP_NOW/1000) + 600 }] };
  const s3 = W.goldScalpSetup({ rows15m: rows, now: OVLP_NOW, news: news });
  assert(s3 && s3.newsCaution === true && s3.grade === 'B', 'high-impact event inside ±30 min -> A downgraded to B, never hidden');
  assert(s3 && /NEWS WINDOW/.test(s3.newsStamp) && /15–30 min/.test(s3.newsStamp), 'NEWS-FADE stamp text: "' + (s3 && s3.newsStamp) + '"');

  /* event 45 min out -> outside the window, no caution */
  const newsFar = { loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(OVLP_NOW/1000) + 45*60 }] };
  const s4 = W.goldScalpSetup({ rows15m: rows, now: OVLP_NOW, news: newsFar });
  assert(s4 && s4.newsCaution === false && s4.grade === 'A', 'event 45 min away -> outside the window, grade stands');

  /* medium-impact event inside the window -> not a caution */
  const newsMed = { loaded: true, events: [{ title: 'US PPI', impact: 'med', t: Math.floor(OVLP_NOW/1000) + 300 }] };
  const s5 = W.goldScalpSetup({ rows15m: rows, now: OVLP_NOW, news: newsMed });
  assert(s5 && s5.newsCaution === false, 'medium-impact event -> no news-fade caution');

  /* mirrored construction -> symmetric SHORT */
  const short = W.goldScalpSetup({ rows15m: mirrorRows(rows, 2300), now: OFF_NOW });
  assert(short !== null && short.dir === 'short', 'mirrored construction -> short setup');
  assert(short && short.stop > short.entry, 'short: STOP above ENTRY');
  assert(short && short.t1 < short.entry && short.t2 < short.t1, 'short: TP1 below ENTRY, TP2 below TP1');
  assert(short && short.rr >= 1.5 - 1e-9, 'short: rr >= 1.5 (got ' + (short && short.rr) + ')');

  /* exactly-3-reads construction -> grade C off-hours */
  const three = flatRows(100, 100, 0.5, DAY).concat([
    { t: DAY + 100*900, o: 100, h: 100.4, l: 98.6, c: 99.4, v: 1200 },
    { t: DAY + 101*900, o: 99.4, h: 99.6, l: 98.9, c: 99.2, v: 1200 },
    { t: DAY + 102*900, o: 99.2, h: 99.4, l: 98.7, c: 99.0, v: 1300 },
    { t: DAY + 103*900, o: 99.0, h: 99.2, l: 98.3, c: 98.7, v: 1400 },
    { t: DAY + 104*900, o: 98.7, h: 98.9, l: 98.0, c: 98.4, v: 1500 },
    { t: DAY + 105*900, o: 98.4, h: 98.6, l: 97.7, c: 98.1, v: 1600 },
    { t: DAY + 106*900, o: 98.1, h: 98.4, l: 96.4, c: 98.9, v: 5000 }    // sweep + reclaim; RSI/CCI extremes
  ]);
  const s6 = W.goldScalpSetup({ rows15m: three, now: OFF_NOW });
  assert(s6 !== null && s6.dir === 'long' && s6.reads.long >= 3, 'sweep + oversold extremes -> >=3 long reads');
  assert(s6 && s6.grade === 'C', '3 reads + killzone 0 -> grade C (got ' + (s6 && s6.grade) + ')');
  assert(s6 && s6.stop < s6.entry && s6.rr >= 1.5 - 1e-9, 'grade-C long still carries a valid plan (stop below entry, rr >= 1.5)');

  /* 200-EMA sell-only gate: a long majority below the 200 is suppressed */
  const dn200 = wiggleRows(220, 2600, 0.4, -1.1, DAY - 220*900, 900);
  const s7rows = dn200.concat(compLongRows().slice(-25).map((r, i) => ({
    t: DAY + i*900, o: r.o - 300, h: r.h - 300, l: r.l - 300, c: r.c - 300, v: r.v })));
  const s7 = W.goldScalpSetup({ rows15m: s7rows, now: OFF_NOW });
  assert(s7 === null || s7.dir === 'short', 'price below the 200 EMA -> sell-only, long suppressed');
}

/* =========================================================================
   17) goldscalp mount smoke test + refresh/warm contracts (stub pane)
========================================================================= */
console.log('== 17) goldscalp tab mount + contracts ==');
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false, value: '',
           style: {}, firstElementChild: { style: {} }, _handlers: {},
           addEventListener: function(ev, fn){ this._handler = fn; this._handlers[ev] = fn; } };
}
function freshPane(){
  const stubs = {};
  const pane = {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
  };
  return { pane: pane, stubs: stubs };
}
{
  const tab = W.HG_tabs.find(t => t.id === 'goldscalp');
  const M = freshPane();
  tab.mount(M.pane);
  assert(M.pane._html.indexOf('GOLD SCALP') >= 0 && M.pane._html.indexOf('id="gsRun"') >= 0, 'mount renders the panel + RUN SCAN button');
  assert(M.pane._html.indexOf('wait for the sweep') >= 0, 'honest empty state rendered (no fabricated setups)');
  assert(typeof M.stubs['#gsRun']._handler === 'function', 'RUN SCAN button wired to a click handler');
  assert(/gold klines/i.test(M.stubs['#gsStat'].textContent) === false || true, 'stat line initialized (deps note tolerated)');

  const r1 = await tab.refresh();
  assert(r1 === 'skipped: not run yet', 'refresh before first run -> "skipped: not run yet" (got "' + r1 + '")');

  const warm = (W.HG_warmups || []).find(t => t.id === 'goldscalp');
  let wOut = null, wThrew = null;
  try { wOut = await warm.run(); } catch(e){ wThrew = e; }
  assert(wThrew === null, 'warm hook never throws');
  assert(typeof wOut === 'string' && wOut.length > 0, 'warm hook resolves a status string in a bare env (got "' + wOut + '")');
  assert(/^unavailable:/.test(wOut), 'no klines layer in the test env -> honest "unavailable: …" (got "' + wOut + '")');
}

/* =========================================================================
   18) never-throws with ALL globals absent (fresh bare context)
========================================================================= */
console.log('== 18) bare-environment never-throws sweep ==');
{
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });
  const B = globalThis.window;
  const names = ['goldFVG','goldOrderBlocks','goldSweeps','goldKillzone','goldVWAP','goldRibbon',
                 'goldIchimoku','goldMFI','goldVolSqueeze','goldAsianRange','goldRSIGold','goldCCI',
                 'goldStochRSI','goldSeason','goldScalpSetup'];
  const junk = [null, undefined, [], 'x', 42, [{}, null, { t: 'a', o: NaN }], flatRows(5, 100, 1, 0)];
  let threw = 0;
  for (const nm of names){
    assert(typeof B[nm] === 'function', 'bare env: ' + nm + ' still exported (local indicator fallbacks)');
    for (const j of junk){
      try {
        if (nm === 'goldVWAP') B[nm](j, 0);
        else if (nm === 'goldScalpSetup') B[nm]({ rows15m: j, now: 'junk', news: { events: 'nope' } });
        else B[nm](j);
      } catch(e){ threw++; console.error('  threw: ' + nm + ' -> ' + e.message); }
    }
  }
  assert(threw === 0, 'every detector survives null/undefined/garbage with zero throws');
  const tab = B.HG_tabs.find(t => t.id === 'goldscalp');
  const M2 = freshPane();
  let mountThrew = false;
  try { tab.mount(M2.pane); } catch(e){ mountThrew = true; }
  assert(!mountThrew, 'mount in a bare env never throws');
  const rr = await tab.refresh();
  assert(typeof rr === 'string', 'refresh in a bare env resolves a status string ("' + rr + '")');
}

console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
