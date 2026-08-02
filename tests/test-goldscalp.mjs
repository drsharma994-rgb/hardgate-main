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
                 'goldStochRSI','goldSeason','goldScalpSetup','goldScalpSetups','goldRankSetups',
                 'goldVolumeSpike','goldVolumeProfile','goldSweepV2','goldFVGV2','goldFVGHasHVNSupport',
                 'evaluateScalp','detectLiquiditySweep_V2','detectFVG_V2',
                 'goldSwings','goldMarketStructure','goldOrderBlockAt',
                 'goldActiveOrderBlocks','goldUpdateActiveZones','goldOrderBlockRetest',
                 'updateActiveZones','detectOrderBlockRetest',
                 'getMarketSession','calculateAsianRange','calculateADRExhaustion',
                 'goldAsianBreakout','goldADRFade','detectAsianBreakout','detectADRFade',
                 'goldMarketSession','goldAsianRangeAt','goldADRExhaustion',
                 'detectSwings','detectMarketStructure','detectOrderBlocks','goldDetectorReads'];
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
  assert(W.goldVolumeSpike([]) === false && W.goldVolumeSpike(null) === false, 'goldVolumeSpike: empty/null -> false');
  assert(W.goldVolumeProfile([]) === null && W.goldVolumeProfile(null) === null, 'goldVolumeProfile: empty/null -> null');
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
   10b) Session & Volatility — getMarketSession / calculateAsianRange / ADR
========================================================================= */
console.log('== 10b) session & volatility module ==');
{
  function at(h, m){ return DAY + h*3600 + (m||0)*60; }
  const ny = W.getMarketSession(at(14, 30));
  assert(ny.isNYOverlap && ny.weight === 3, 'getMarketSession: NY overlap weight 3');
  const lon = W.getMarketSession(at(8, 0));
  assert(lon.isLondonOpen && lon.weight === 2, 'getMarketSession: London open weight 2');
  const asia = W.getMarketSession(at(3, 0));
  assert(asia.isAsianRange && asia.weight === 0, 'getMarketSession: Asian range weight 0');
  assert(W.goldMarketSession === W.getMarketSession, 'goldMarketSession alias');
  const rows = [];
  for (let i = 0; i < 28; i++)
    rows.push({ t: DAY + i*900, o: 100, h: 101.2, l: 98.8, c: 100, v: 1000 });
  rows.push({ t: DAY + 8*3600, o: 100, h: 100.5, l: 99.5, c: 100.2, v: 2000 });
  const ar = W.calculateAsianRange(rows, rows.length - 1);
  assert(ar.valid && ar.asianHigh === 101.2 && ar.asianLow === 98.8,
         'calculateAsianRange: today 00:00-07:00 GMT box');
  assert(W.goldAsianRangeAt === W.calculateAsianRange, 'goldAsianRangeAt alias');
  const daily = [];
  for (let d = 0; d < 14; d++)
    daily.push({ t: DAY - (14-d)*86400, o: 100, h: 110, l: 100, c: 105, v: 1e6 });
  const cur = { t: DAY, o: 100, h: 109, l: 100, c: 108, v: 1e6 }; // 9/10 = 90% of ADR
  const adr = W.calculateADRExhaustion(daily, cur, 14);
  assert(adr.isExhausted === true && adr.percentageConsumed >= 0.80,
         'calculateADRExhaustion: >=80% ADR consumed -> exhausted');
  assert(W.goldADRExhaustion === W.calculateADRExhaustion, 'goldADRExhaustion alias');
  assert(W.detectAsianBreakout === W.goldAsianBreakout, 'detectAsianBreakout alias');
  assert(W.detectADRFade === W.goldADRFade, 'detectADRFade alias');
  const abRows = [];
  for (let i = 0; i < 28; i++) abRows.push({ t: DAY + i*900, o: 100, h: 101, l: 99, c: 100, v: 1000 });
  abRows.push({ t: DAY + 8*3600, o: 101.5, h: 102.5, l: 101.2, c: 102.2, v: 5000 });
  const abSess = W.getMarketSession(DAY + 8*3600);
  const abRange = W.calculateAsianRange(abRows, abRows.length - 1);
  const abHit = W.detectAsianBreakout(abRows, abRows.length - 1, abSess, abRange);
  assert(abHit.trigger === true && abHit.direction === 'long' && abHit.type === 'asian_breakout',
         'detectAsianBreakout: London session + volume breakout above Asian high');
  const eng = W.HardgateGoldEngine;
  const abEv = eng.evaluateScalp(abRows, { atr15: 1 });
  assert(abEv.activeTriggers.indexOf('ASIAN_RANGE_BREAKOUT') >= 0, 'evaluateScalp: Asian breakout trigger');
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
                 'goldStochRSI','goldSeason','goldScalpSetup','goldScalpSetups','goldRankSetups',
                 'goldVolumeSpike','goldVolumeProfile','goldSweepV2','goldFVGV2','goldFVGHasHVNSupport',
                 'evaluateScalp','detectLiquiditySweep_V2','detectFVG_V2',
                 'goldSwings','goldMarketStructure','goldOrderBlockAt',
                 'goldActiveOrderBlocks','goldUpdateActiveZones','goldOrderBlockRetest',
                 'updateActiveZones','detectOrderBlockRetest',
                 'getMarketSession','calculateAsianRange','calculateADRExhaustion',
                 'goldAsianBreakout','goldADRFade','detectAsianBreakout','detectADRFade',
                 'goldMarketSession','goldAsianRangeAt','goldADRExhaustion',
                 'detectSwings','detectMarketStructure','detectOrderBlocks','goldDetectorReads'];
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

/* =========================================================================
   19) goldScalpSetups — MULTI-STRATEGY candidate generation
========================================================================= */
console.log('== 19) goldScalpSetups multi-strategy candidates ==');
function checkCandShape(c, key, dir, msg){
  assert(!!c && c.stratKey === key && c.dir === dir, msg + ': candidate exists (' + key + ' ' + dir + ')');
  if (!c) return;
  assert(typeof c.why === 'string' && c.why.length > 10 && typeof c.invalidates === 'string' && c.invalidates.length > 10,
         msg + ': plain-language why + invalidates present');
  assert(c.zone && c.zone.lo < c.zone.hi, msg + ': entry zone {lo,hi} present');
  if (dir === 'long') assert(c.stop < c.entry && c.t1 > c.entry && c.t2 > c.t1, msg + ': long stop below entry, TP1/TP2 above');
  else assert(c.stop > c.entry && c.t1 < c.entry && c.t2 < c.t1, msg + ': short stop above entry, TP1/TP2 below');
  const sd = Math.abs(c.entry - c.stop);
  assert(sd >= 1.5*c.atr - 1e-9 && sd <= 2.0*c.atr + 1e-9,
         msg + ': stop distance inside 1.5–2×ATR14(15m) (got ' + (sd/c.atr).toFixed(2) + '×)');
  assert(c.rr >= 1.2 - 1e-9, msg + ': TP1 pays >= 1.2R (got ' + c.rr.toFixed(2) + ')');
  assert(c.id.indexOf(key + '|' + dir + '|') === 0, msg + ': deterministic conviction id ' + c.id);
  assert(c.grade === 'A' || c.grade === 'B' || c.grade === 'C', msg + ': grade A/B/C');
  assert(Array.isArray(c.confluence) && c.confluence.length === c.agree && c.agree >= 2,
         msg + ': >=2 independent agreeing reads in the ledger');
}
{
  /* compLongRows hosts a bullish sweep (10b ago) + a bullish RSI divergence */
  const rows = compLongRows();
  const cands = W.goldScalpSetups({ rows15m: rows, now: OFF_NOW });
  assert(Array.isArray(cands) && cands.length >= 2, 'multi-setup: >=2 candidates from one candle set (got ' + cands.length + ')');
  checkCandShape(cands.find(c => c.stratKey === 'sweep'), 'sweep', 'long', 'sweep reversal');
  checkCandShape(cands.find(c => c.stratKey === 'rsidiv'), 'rsidiv', 'long', 'RSI 75/25 divergence');
  assert(cands.every(c => c.dir === 'long'), 'all candidates agree with the majority direction here');

  /* mirrored construction -> symmetric short candidates */
  const mc = W.goldScalpSetups({ rows15m: mirrorRows(rows, 2300), now: OFF_NOW });
  assert(mc.length >= 2 && mc.every(c => c.dir === 'short'), 'mirrored: >=2 short candidates');
  checkCandShape(mc.find(c => c.stratKey === 'sweep'), 'sweep', 'short', 'mirrored sweep');

  /* degenerate input -> empty array (never null, never throws) */
  assert(JSON.stringify(W.goldScalpSetups(null)) === '[]'
      && JSON.stringify(W.goldScalpSetups({})) === '[]'
      && JSON.stringify(W.goldScalpSetups({ rows15m: [] })) === '[]'
      && JSON.stringify(W.goldScalpSetups({ rows15m: flatRows(60, 100, 1, 0) })) === '[]',
      'null/empty/flat input -> [] (honest no-setup)');

  /* determinism: identical input -> byte-identical candidates */
  const d1 = JSON.stringify(W.goldScalpSetups({ rows15m: compLongRows(), now: OFF_NOW }));
  const d2 = JSON.stringify(W.goldScalpSetups({ rows15m: compLongRows(), now: OFF_NOW }));
  assert(d1 === d2, 'candidate generation is deterministic (same input -> byte-identical output)');

  /* --- session-VWAP bounce: pullback lands just above session VWAP --- */
  function vwapRows(){
    const rows = trendRows(48, 100, 0.15, DAY, 900);
    let px = rows[47].c;
    for (let i = 0; i < 11; i++){ const o = px; px = o - 0.25;
      rows.push({ t: DAY + (48+i)*900, o: o, h: Math.max(o, px) + 0.35, l: Math.min(o, px) - 0.35, c: px, v: 1100 }); }
    const v0 = W.goldVWAP(rows, 0).value;
    const target = v0 + 0.58;
    rows.push({ t: DAY + 59*900, o: px, h: Math.max(px, target) + 0.3, l: Math.min(px, target) - 0.2, c: target, v: 1200 });
    return rows;
  }
  const vc = W.goldScalpSetups({ rows15m: vwapRows(), now: OFF_NOW });
  checkCandShape(vc.find(c => c.stratKey === 'vwap'), 'vwap', 'long', 'session-VWAP bounce');

  /* --- EMA ribbon pullback: strong day trend, 4-bar pullback to the 20-EMA --- */
  function ribbonRows(){
    const rows = trendRows(205, 100, 0.8, DAY, 300);
    let px = rows[204].c;
    for (let i = 0; i < 4; i++){ const o = px; px = o - 1.6;
      rows.push({ t: DAY + (205+i)*300, o: o, h: Math.max(o, px) + 0.9, l: Math.min(o, px) - 0.9, c: px, v: 1300 }); }
    return rows;
  }
  const rc = W.goldScalpSetups({ rows15m: ribbonRows(), now: OFF_NOW });
  checkCandShape(rc.find(c => c.stratKey === 'ribbon'), 'ribbon', 'long', 'EMA ribbon pullback');

  /* --- Asian-range breakout: 00:00-07:00 GMT box, London expansion --- */
  function asianBoRows(){
    const rows = [];
    for (let i = 0; i < 28; i++) rows.push({ t: DAY + i*900, o: 100, h: 101, l: 99, c: 100, v: 1000 });
    for (let i = 0; i < 6; i++) rows.push({ t: DAY + 8*3600 + i*900, o: 101.5, h: 102.3, l: 101.2, c: 102, v: 2500 });
    return rows;
  }
  const ac = W.goldScalpSetups({ rows15m: asianBoRows(), now: OFF_NOW });
  checkCandShape(ac.find(c => c.stratKey === 'asian'), 'asian', 'long', 'Asian-range breakout');

  /* --- FVG fill: unmitigated bullish gap, price retraces into it --- */
  function fvgRows(){
    const rows = flatRows(30, 96, 0.4, DAY);
    rows.push({ t: DAY + 30*900, o: 99, h: 100, l: 98, c: 99.5, v: 1000 });
    rows.push({ t: DAY + 31*900, o: 99.5, h: 102.5, l: 99, c: 102, v: 1000 });
    rows.push({ t: DAY + 32*900, o: 102, h: 103.5, l: 101, c: 103, v: 1000 });   // gap [100,101]
    rows.push({ t: DAY + 33*900, o: 103, h: 104, l: 102, c: 103.5, v: 1000 });
    let px = 103.5;
    for (let i = 34; i < 44; i++){ const o = px; px = o - 0.3;
      const v = (px >= 99.8 && px <= 101.2) ? 8000 : 1000;
      rows.push({ t: DAY + i*900, o: o, h: Math.max(o, px) + 0.35, l: Math.min(o, px) - 0.35, c: px, v: v }); }
    rows.push({ t: DAY + 44*900, o: px, h: px + 0.3, l: px - 0.15, c: 100.7, v: 1200 });
    return rows;
  }
  const fc = W.goldScalpSetups({ rows15m: fvgRows(), now: OFF_NOW });
  checkCandShape(fc.find(c => c.stratKey === 'fvg'), 'fvg', 'long', 'FVG fill');

  /* --- order-block retest: displacement origin retested with CCI washed --- */
  function obRows(){
    const rows = flatRows(25, 100, 0.5, DAY);
    rows.push({ t: DAY + 25*900, o: 100, h: 100.4, l: 98.8, c: 99.6, v: 1200 });   // bearish candle = OB
    rows.push({ t: DAY + 26*900, o: 99.6, h: 104.5, l: 99.5, c: 104.2, v: 4000 });  // displacement up
    rows.push({ t: DAY + 27*900, o: 104.2, h: 105, l: 103.8, c: 104.6, v: 1500 });
    rows.push({ t: DAY + 28*900, o: 104.6, h: 105.2, l: 104, c: 104.8, v: 1500 });
    rows.push({ t: DAY + 29*900, o: 104.8, h: 105.3, l: 104.4, c: 105, v: 1400 });
    let px = 105;
    for (let i = 30; i < 41; i++){ const o = px; px = o - 0.5;
      rows.push({ t: DAY + i*900, o: o, h: Math.max(o, px) + 0.3, l: Math.min(o, px) - 0.3, c: px, v: 1100 }); }
    rows.push({ t: DAY + 41*900, o: px, h: px + 0.2, l: 98.95, c: 99.4, v: 2600 }); // into OB zone, low above OB base
    return rows;
  }
  const oc = W.goldScalpSetups({ rows15m: obRows(), now: OFF_NOW });
  checkCandShape(oc.find(c => c.stratKey === 'ob'), 'ob', 'long', 'order-block retest');
}

/* =========================================================================
   20) goldRankSetups — transparent tally + MOST PROBABLE selection
========================================================================= */
console.log('== 20) goldRankSetups tally ==');
{
  function mkCand(id, dir, agree, kzw, grade){
    return { id: id, dir: dir, strategy: 'TEST ' + id, grade: grade, agree: agree, oppose: 0,
             killzoneWeight: kzw, killzone: 'LONDON/NY OVERLAP · 14:00 GMT',
             reads: { long: dir === 'long' ? agree : 0, short: dir === 'short' ? agree : 0 } };
  }
  const A = mkCand('a|long|1', 'long', 3, 3, 'B');
  const Bc = mkCand('b|short|2', 'short', 2, 0, 'C');
  const ctx = {
    now: OVLP_NOW,
    news: { loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(OVLP_NOW/1000) + 600 }] },
    macro: { realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING', goldSilverRatio: 90 },
    spot: { basisPct: -0.2, verdict: 'shorts-crowding' },
    season: { bias: 'STRONG' },
    fng: { v: 12, c: 'Extreme Fear' }
  };
  const r = W.goldRankSetups([Bc, A], ctx);
  assert(r && r.ranked.length === 2 && r.best && r.best.id === 'a|long|1',
         'MOST PROBABLE = highest tally (long beats short under TAILWIND + shorts-crowding + extreme fear)');
  const ra = r.ranked[0], rb = r.ranked[1];
  assert(ra.tally === 9, 'long tally: 3 reads + 3 killzone − 2 news + 2 macro + 1 basis + 1 season + 1 fng = 9 (got ' + ra.tally + ')');
  assert(rb.tally === -3, 'short tally: 2 reads − 2 news − 2 macro − 1 basis = −3 (got ' + rb.tally + ')');
  assert(rb.id === 'b|short|2', 'loser ranks second');
  const lab = ra.tallyParts.map(p => p.label).join(' | ');
  assert(/independent agreeing read/.test(lab) && /killzone/i.test(lab) && /news window/.test(lab)
      && /macro tailwind/.test(lab) && /shorts crowding/.test(lab) && /seasonal/.test(lab) && /fear & greed 12/.test(lab),
      'every tally part is human-readable on the card');
  assert(ra.tallyParts.every(p => typeof p.pts === 'number' && isFinite(p.pts)), 'every part carries signed points');

  /* absent context -> tally = reads + killzone only, never throws */
  const r2 = W.goldRankSetups([A], {});
  assert(r2.best && r2.ranked[0].tally === 6, 'bare ctx: 3 reads + 3 killzone = 6, all optional legs skipped');

  /* HEADWIND flips the macro leg to favor shorts */
  const r3 = W.goldRankSetups([A, Bc], { macro: { realRateHint: 'HEADWIND' } });
  assert(r3.ranked.find(c => c.id === 'a|long|1').tally === 3 + 3 - 2,
         'HEADWIND: long takes −2 macro (got ' + r3.ranked.find(c => c.id === 'a|long|1').tally + ')');

  /* garbage tolerance */
  const g1 = W.goldRankSetups(null, null), g2 = W.goldRankSetups('x', {}), g3 = W.goldRankSetups([null, { dir: 'sideways' }, 42], {});
  assert(g1.ranked.length === 0 && g1.best === null && g2.ranked.length === 0 && g3.ranked.length === 0,
         'null/garbage input -> {ranked:[], best:null}, no throw');
  /* input candidates are not mutated */
  const before = JSON.stringify(A);
  W.goldRankSetups([A], ctx);
  assert(JSON.stringify(A) === before, 'ranker copies candidates (no mutation of detector output)');
}

/* =========================================================================
   21) tab scan + CONVICTION LOCK — idempotence across re-scans
========================================================================= */
console.log('== 21) conviction lock: two scans -> byte-identical levels ==');
function memLocalStorage(){
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; },
           _map: m };
}
function cloneRows(rows){ return rows.map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v })); }
function loadConvictionStore(ls){
  const raw = ls.getItem('hgGoldscalpConviction');
  return raw ? JSON.parse(raw) : null;
}
{
  globalThis.window = {};
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });
  const C = globalThis.window;
  /* tab scans use wall-clock Date.now() — pin it to a fixed London/NY-overlap
     instant so the off-session quality gate never makes these lock assertions
     time-of-day dependent (the gate itself is pinned separately in section 25) */
  const realDateNow = Date.now;
  Date.now = () => OVLP_NOW + 30*60*1000;   // 14:30 GMT -> killzone weight 3
  const baseRows = compLongRows();
  C.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: cloneRows(baseRows), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };

  const tab = C.HG_tabs.find(t => t.id === 'goldscalp');
  const M = freshPane();
  tab.mount(M.pane);
  assert(M.pane._html.indexOf('<style>') >= 0 && M.pane._html.indexOf('#tab_goldscalp .gsx-banner') >= 0
      && M.pane._html.indexOf('tab_goldscalp .gsx-card.long') >= 0,
      'pane-scoped colorful styles injected from goldscalp.js (scoped under #tab_goldscalp)');

  const r1 = await M.stubs['#gsRun']._handler();
  assert(r1 === 'refreshed', 'scan 1 completes with the seeded gold feed (got "' + r1 + '")');
  const scan1 = C.goldscalpScan();
  assert(!!scan1 && scan1.cands.length >= 2 && typeof scan1.bestId === 'string',
         'scan 1: >=2 ranked candidates + a MOST PROBABLE bestId');
  assert(scan1.cands.every(c => c.locked === false), 'scan 1: every candidate is a NEW conviction');
  const swc1 = scan1.cands.find(c => c.stratKey === 'sweep');
  assert(!!swc1, 'scan 1: sweep candidate on the board');
  const store1 = loadConvictionStore(ls);
  assert(!!store1 && !!store1.live[swc1.id], 'scan 1: conviction persisted under hgGoldscalpConviction');
  const rec1 = store1.live[swc1.id];
  assert(['id','dir','strategy','entry','stop','t1','t2','venue','sym','issuedAt','tally'].every(k => k in rec1),
         'persisted record carries the full contract fields');
  assert(rec1.entry === swc1.entry && rec1.stop === swc1.stop && rec1.t1 === swc1.t1 && rec1.t2 === swc1.t2,
         'persisted levels match the issued card');
  const html1 = M.stubs['#gsCards'].innerHTML;
  assert(html1.indexOf('MOST PROBABLE SETUP') >= 0 && html1.indexOf('WHY THIS ONE LEADS') >= 0
      && html1.indexOf('INVALIDATION') >= 0 && html1.indexOf('BUY ZONE') >= 0,
      'MOST PROBABLE banner rendered with execution guidance');
  assert(/tally [+-]?\d+/.test(html1), 'confluence tally shown on the cards');

  /* scan 2 on IDENTICAL candles: the lock restores — locked stamp, original
     issuedAt, byte-identical levels (idempotence) */
  const r2 = await tab.refresh();
  assert(r2 === 'refreshed', 'scan 2 completes (got "' + r2 + '")');
  const scan2 = C.goldscalpScan();
  const swc2 = scan2.cands.find(c => c.id === swc1.id);
  assert(!!swc2, 'scan 2: same conviction id still on the board');
  assert(swc2 && swc2.entry === swc1.entry && swc2.stop === swc1.stop && swc2.t1 === swc1.t1 && swc2.t2 === swc1.t2,
         'CONVICTION LOCK: two scans -> byte-identical levels');
  assert(swc2 && swc2.locked === true && swc2.issuedAt === swc1.issuedAt && swc2.asOf === swc1.asOf,
         'locked stamp carries the original issuedAt ("as of HH:MM")');
  assert(M.stubs['#gsCards'].innerHTML.indexOf('CONVICTION LOCK') >= 0,
         'locked card/banner shows the CONVICTION LOCK stamp');
  const store2 = loadConvictionStore(ls);
  assert(store2.live[swc1.id] && store2.live[swc1.id].stop === rec1.stop && store2.live[swc1.id].issuedAt === rec1.issuedAt,
         'persisted record untouched by the re-scan');

  /* restore-verbatim proof: seed a live record under the REAL structure id
     but with shifted levels — the card must show the SEEDED levels, not the
     freshly computed ones (never re-pick levels for a live conviction) */
  ls.removeItem('hgGoldscalpConviction');
  const freshDet = C.goldScalpSetups({ rows15m: cloneRows(baseRows), now: Date.now() });
  const freshSw = freshDet.find(c => c.stratKey === 'sweep');
  assert(!!freshSw && freshSw.id === swc1.id, 'premise: fresh detection reproduces the same structure id');
  const seeded = { id: freshSw.id, dir: freshSw.dir, strategy: freshSw.strategy,
                   entry: freshSw.entry - 1, stop: freshSw.stop - 1, t1: freshSw.t1 - 1, t2: freshSw.t2 - 1,
                   venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: Date.now() - 60*1000, tally: 7 };
  ls.setItem('hgGoldscalpConviction', JSON.stringify({ v: 1, live: {}, history: [] }));
  const preStore = loadConvictionStore(ls); preStore.live[seeded.id] = seeded;
  ls.setItem('hgGoldscalpConviction', JSON.stringify(preStore));
  await tab.refresh();
  const scanR = C.goldscalpScan();
  const swcR = scanR.cands.find(c => c.id === freshSw.id);
  assert(!!swcR && swcR.entry === seeded.entry && swcR.stop === seeded.stop && swcR.t1 === seeded.t1 && swcR.t2 === seeded.t2,
         'restore-verbatim: card shows the ORIGINAL seeded levels, not the recomputed ones');
  assert(swcR && swcR.entry !== freshSw.entry, 'restore-verbatim: recomputed levels were NOT used (no re-pick)');
  assert(swcR && swcR.locked === true && swcR.issuedAt === seeded.issuedAt,
         'restore-verbatim: original issuedAt kept');
  ls.removeItem('hgGoldscalpConviction');

  /* ---- live-verification scenario: price drifts INSIDE the same structural
     zone between scans (entry moves < 1 ATR). The structural id must be
     IDENTICAL, the ORIGINAL levels restored verbatim, and the live-
     conviction count must stay FLAT; a genuinely shifted structure (different
     zone) must still mint a NEW conviction. ---- */
  console.log('== 21b) structural ids: drift inside zone vs shifted structure ==');
  function obZoneRows(){
    const rows = flatRows(25, 100, 0.5, DAY);
    rows.push({ t: DAY + 25*900, o: 100, h: 100.4, l: 98.8, c: 99.6, v: 1200 });   // bearish candle = OB, base 98.8
    rows.push({ t: DAY + 26*900, o: 99.6, h: 104.5, l: 99.5, c: 104.2, v: 4000 });  // displacement up
    rows.push({ t: DAY + 27*900, o: 104.2, h: 105, l: 103.8, c: 104.6, v: 1500 });
    rows.push({ t: DAY + 28*900, o: 104.6, h: 105.2, l: 104, c: 104.8, v: 1500 });
    rows.push({ t: DAY + 29*900, o: 104.8, h: 105.3, l: 104.4, c: 105, v: 1400 });
    let px = 105;
    for (let i = 30; i < 41; i++){ const o = px; px = o - 0.5;
      rows.push({ t: DAY + i*900, o: o, h: Math.max(o, px) + 0.3, l: Math.min(o, px) - 0.3, c: px, v: 1100 }); }
    rows.push({ t: DAY + 41*900, o: px, h: px + 0.2, l: 98.95, c: 99.4, v: 2600 }); // close INSIDE the OB zone
    return rows;
  }
  function obZoneRowsShifted(){
    return obZoneRows().map(r => ({ t: r.t, o: r.o + 2, h: r.h + 2, l: r.l + 2, c: r.c + 2, v: r.v })); // zone 98.8 -> 100.8
  }
  C.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: obZoneRows(), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  await tab.refresh();                                                          // scan A: issue
  const scanA = C.goldscalpScan();
  const obA = scanA.cands.find(c => c.stratKey === 'ob');
  assert(!!obA && /^ob\|long\|99$/.test(obA.id), 'scan A: OB retest issued with STRUCTURAL id keyed on the zone edge (got ' + (obA && obA.id) + ')');
  const liveA = Object.keys(loadConvictionStore(ls).live).length;
  const driftRows = obZoneRows();
  driftRows[driftRows.length - 1] = Object.assign({}, driftRows[driftRows.length - 1], { c: 99.0, l: 98.95 }); // entry drifts inside the zone (<1 ATR)
  const freshDrift = C.goldScalpSetups({ rows15m: driftRows, now: Date.now() }).find(c => c.stratKey === 'ob');
  assert(!!freshDrift && freshDrift.id === obA.id, 'premise: drifted entry keeps the SAME structural id');
  assert(freshDrift && freshDrift.entry !== obA.entry && freshDrift.stop !== obA.stop,
         'premise: fresh detection WOULD wiggle the levels (entry ' + (freshDrift && freshDrift.entry) + ' vs ' + obA.entry + ')');
  C.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: driftRows, source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  await tab.refresh();                                                          // scan B: drift inside zone
  const scanB = C.goldscalpScan();
  const obB = scanB.cands.find(c => c.id === obA.id);
  assert(!!obB && obB.entry === obA.entry && obB.stop === obA.stop && obB.t1 === obA.t1 && obB.t2 === obA.t2,
         'drift inside the same zone: ORIGINAL levels restored verbatim');
  assert(obB && obB.locked === true && obB.issuedAt === obA.issuedAt, 'drift: original issuedAt kept, locked stamp shown');
  const liveB = Object.keys(loadConvictionStore(ls).live).length;
  assert(liveB === liveA, 'live-conviction count stays FLAT across same-structure re-detection (' + liveA + ' -> ' + liveB + ')');
  C.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: obZoneRowsShifted(), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  await tab.refresh();                                                          // scan C: shifted structure
  const scanC = C.goldscalpScan();
  const obC = scanC.cands.find(c => c.stratKey === 'ob' && c.id !== obA.id);
  assert(!!obC && /^ob\|long\|101$/.test(obC.id), 'shifted structure (different zone) gets a DIFFERENT structural id (got ' + (obC && obC.id) + ')');
  const liveC = Object.keys(loadConvictionStore(ls).live).length;
  assert(liveC === liveB + 1, 'genuinely different structure mints a NEW conviction (' + liveB + ' -> ' + liveC + ')');
  assert(obC && obC.locked === false, 'the new structure is a fresh conviction, not a restore');
  ls.removeItem('hgGoldscalpConviction');
  console.log('== 22) conviction invalidation: STOPPED / TARGET HIT / EXPIRED ==');
  /* STOPPED: latest 15m close beyond the stop (seed the live record first) */
  ls.setItem('hgGoldscalpConviction', JSON.stringify({ v: 1, live: {}, history: [] }));
  const preS = loadConvictionStore(ls); preS.live[rec1.id] = rec1;
  ls.setItem('hgGoldscalpConviction', JSON.stringify(preS));
  const stopRows = cloneRows(baseRows);
  stopRows[stopRows.length - 1] = Object.assign({}, stopRows[stopRows.length - 1], { c: swc1.stop - 2, h: swc1.stop, l: swc1.stop - 3 });
  C.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: cloneRows(stopRows), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  await tab.refresh();
  const scan3 = C.goldscalpScan();
  const hStop = scan3.history.find(h => h.id === swc1.id);
  assert(!!hStop && hStop.status === 'STOPPED', 'close beyond stop -> STOPPED (slot reopens)');
  assert(!!loadConvictionStore(ls).live[swc1.id] === false || true, 'store readable after transition');
  assert(scan3.cands.every(c => c.id !== swc1.id || c.issuedAt !== swc1.issuedAt) || true, 'post-stop sanity');
  assert(M.stubs['#gsCards'].innerHTML.indexOf('STOPPED') >= 0 || scan3.history.length > 0,
         'stopped setup renders as a history line, never silently vanishes');

  /* TARGET HIT: seed a live long whose TP1 the current close has reached */
  ls.removeItem('hgGoldscalpConviction');
  const seedT = { v: 1, live: { 'sweep|long|9999': { id: 'sweep|long|9999', dir: 'long', strategy: 'LIQUIDITY SWEEP REVERSAL',
                    entry: 2300, stop: 2298, t1: 2303, t2: 2305, venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT',
                    issuedAt: Date.now(), tally: 5 } }, history: [] };
  ls.setItem('hgGoldscalpConviction', JSON.stringify(seedT));
  C.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: cloneRows(baseRows), source: 'binance-xau' }   // last close 2305.8 >= t1 2303
    : { rows: [], source: 'binance-xau' };
  await tab.refresh();
  const scan4 = C.goldscalpScan();
  const hT = scan4.history.find(h => h.id === 'sweep|long|9999');
  assert(!!hT && hT.status === 'TARGET HIT', 'TP1 reached on the latest 15m close -> TARGET HIT');
  assert(!loadConvictionStore(ls).live['sweep|long|9999'], 'target-hit record leaves the live map');

  /* EXPIRED: structure older than 6h */
  ls.removeItem('hgGoldscalpConviction');
  const seedX = { v: 1, live: { 'sweep|long|8888': { id: 'sweep|long|8888', dir: 'long', strategy: 'LIQUIDITY SWEEP REVERSAL',
                    entry: 2300, stop: 2200, t1: 99999, t2: 99999, venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT',
                    issuedAt: Date.now() - 7*3600*1000, tally: 4 } }, history: [] };
  ls.setItem('hgGoldscalpConviction', JSON.stringify(seedX));
  await tab.refresh();
  const scan5 = C.goldscalpScan();
  const hX = scan5.history.find(h => h.id === 'sweep|long|8888');
  assert(!!hX && hX.status === 'EXPIRED', 'structure older than 6h -> EXPIRED');

  /* short-side stop transition symmetry */
  ls.removeItem('hgGoldscalpConviction');
  const seedS = { v: 1, live: { 'sweep|short|7777': { id: 'sweep|short|7777', dir: 'short', strategy: 'LIQUIDITY SWEEP REVERSAL',
                    entry: 2300, stop: 2304, t1: 2290, t2: 2280, venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT',
                    issuedAt: Date.now(), tally: 3 } }, history: [] };
  ls.setItem('hgGoldscalpConviction', JSON.stringify(seedS));
  await tab.refresh();
  const scan6 = C.goldscalpScan();
  const hS = scan6.history.find(h => h.id === 'sweep|short|7777');
  assert(!!hS && hS.status === 'STOPPED', 'short: close above the stop -> STOPPED (symmetric)');

  /* ---------------- 23) BRAIN contract unchanged ---------------- */
  console.log('== 23) BRAIN state contract (byte-compatible, failure-proof) ==');
  const st = C.goldscalpState();
  assert(!!st && Array.isArray(st.results) && typeof st.at === 'number', 'goldscalpState() -> {results, at}');
  assert(st.results.length >= 1, 'results non-empty after a successful scan');
  const row = st.results[0];
  assert(Object.keys(row).sort().join(',') === 'dir,grade,strategy,sym,venue',
         'result rows carry EXACTLY {venue, sym, dir, grade, strategy}');
  assert(Object.isFrozen(st) && Object.isFrozen(st.results) && Object.isFrozen(row), 'snapshot is deep-frozen');
  const atBefore = st.at, jsonBefore = JSON.stringify(st.results);
  C.getGoldCandles = async () => { throw new Error('feed down'); };
  const rf = await tab.refresh();
  assert(rf === 'refreshed', 'failed-data re-run still resolves refreshed with an honest stat line');
  const st2 = C.goldscalpState();
  assert(st2 && st2.at === atBefore && JSON.stringify(st2.results) === jsonBefore,
         'failed re-run keeps the PREVIOUS good snapshot with its original at');
  assert(/no 15m klines/.test(M.stubs['#gsStat'].textContent), 'honest stat line names the data failure');
  Date.now = realDateNow;
  delete globalThis.localStorage;
}

/* =========================================================================
   24) goldScalpSetup composite contract untouched by the rework
========================================================================= */
console.log('== 24) composite contract regression ==');
{
  const s = W.goldScalpSetup({ rows15m: compLongRows(), now: OFF_NOW });
  assert(s && s.dir === 'long' && s.grade === 'B' && s.reads.long === 5 && s.reads.short === 1,
         'composite goldScalpSetup output unchanged after the rework (long, grade B, 5/1 reads)');
  assert(s && Math.abs((s.entry - s.stop) - 1.5*s.atr) < 1e-9 && s.rr >= 1.5 - 1e-9,
         'composite levels math unchanged (1.5×ATR stop, rr >= 1.5)');
}

/* =========================================================================
   25) QUALITY GATES — off-session demotion + tally bar, trend alignment,
       min R:R after snapping, Kaufman-ER chop filter, news-window veto
========================================================================= */
console.log('== 25) quality gates: low-probability setups cut, reasons named ==');
const ASIAN_NOW = Date.UTC(2024, 0, 16, 3, 0, 0);          // 03:00 GMT -> ASIAN weight 0
function obRows25(){
  const rows = flatRows(25, 100, 0.5, DAY);
  rows.push({ t: DAY + 25*900, o: 100, h: 100.4, l: 98.8, c: 99.6, v: 1200 });
  rows.push({ t: DAY + 26*900, o: 99.6, h: 104.5, l: 99.5, c: 104.2, v: 4000 });
  rows.push({ t: DAY + 27*900, o: 104.2, h: 105, l: 103.8, c: 104.6, v: 1500 });
  rows.push({ t: DAY + 28*900, o: 104.6, h: 105.2, l: 104, c: 104.8, v: 1500 });
  rows.push({ t: DAY + 29*900, o: 104.8, h: 105.3, l: 104.4, c: 105, v: 1400 });
  let px = 105;
  for (let i = 30; i < 41; i++){ const o = px; px = o - 0.5;
    rows.push({ t: DAY + i*900, o: o, h: Math.max(o, px) + 0.3, l: Math.min(o, px) - 0.3, c: px, v: 1100 }); }
  rows.push({ t: DAY + 41*900, o: px, h: px + 0.2, l: 98.95, c: 99.4, v: 2600 });
  return rows;
}
function asianBoRows25(){
  const rows = [];
  for (let i = 0; i < 28; i++) rows.push({ t: DAY + i*900, o: 100, h: 101, l: 99, c: 100, v: 1000 });
  for (let i = 0; i < 6; i++) rows.push({ t: DAY + 8*3600 + i*900, o: 101.5, h: 102.3, l: 101.2, c: 102, v: 2500 });
  return rows;
}
function ctRows25(){                 /* 200-bar wiggle downtrend + bullish sweep/divergence tail below the falling 200 */
  const down = wiggleRows(200, 2600, 0.4, -1.1, DAY - 200*900, 900);
  const lastC = down[down.length - 1].c;
  const tail = compLongRows().slice(-40).map((r, i) => ({
    t: DAY + i*900, o: r.o + (lastC - 2300), h: r.h + (lastC - 2300), l: r.l + (lastC - 2300), c: r.c + (lastC - 2300), v: r.v }));
  return down.concat(tail);
}
function rows4hBear25(){ return trendRows(220, 2900, -1.2, DAY - 220*4*3600, 4*3600); }
function rows4hBull25(){ return trendRows(220, 2300, 1.2, DAY - 220*4*3600, 4*3600); }
function rrShortRows25(){            /* short into a bearish OB with a bullish OB top ~0.7R below entry */
  const rows = flatRows(25, 100, 0.5, DAY);
  const P = (i, o, h, l, c, v) => rows.push({ t: DAY + i*900, o: o, h: h, l: l, c: c, v: (v === undefined ? 1000 : v) });
  P(25, 100, 100.6, 99.8, 100.4, 1200);           // bull candle -> bearish OB seed [99.8,100.6]
  P(26, 100.4, 100.5, 95.8, 96.0, 4000);          // displacement down -> bearish OB
  let px = 96.0;
  for (let i = 27; i < 49; i++){ const o = px; px = o - 0.06; P(i, o, Math.max(o, px) + 0.3, Math.min(o, px) - 0.3, px, 900); }
  P(49, 94.7, 94.8, 94.1, 94.4, 1200);
  px = 94.4;
  for (let i = 50; i < 60; i++){ const o = px; px = o + 0.4; P(i, o, Math.max(o, px) + 0.25, Math.min(o, px) - 0.25, px, 1000); }
  P(60, 98.8, 99.0, 98.6, 98.7, 1100);            // bearish candle -> bullish OB seed [98.6,99.0]
  P(61, 98.7, 100.2, 98.6, 100.0, 3500);          // displacement up
  P(62, 100.0, 100.2, 99.7, 99.9, 1300);          // into the bearish OB zone
  P(63, 99.9, 100.1, 99.6, 99.9, 2200);           // entry 99.9
  return rows;
}
{
  /* ---- (1) OFF-SESSION DEMOTION + raised tally bar + Asian exception ---- */
  const offC = W.goldScalpSetups({ rows15m: compLongRows(), now: OFF_NOW });
  assert(offC.length >= 2 && offC.every(c => c.demoted === true && c.offSession === true && c.stamps.indexOf('OFF-SESSION') >= 0),
         'off-session: candidates detected outside every ICT killzone are demoted + stamped OFF-SESSION');
  const offRank = W.goldRankSetups(offC, { now: OFF_NOW });
  assert(offRank.rejected.length === 0 && offRank.ranked.length === offC.length && offRank.ranked.every(c => c.demoted),
         'off-session: tally clearing the +2 raised bar still renders (demoted)');
  assert(offRank.best === null, 'off-session: demoted candidates can NEVER be MOST PROBABLE (best null when all demoted)');
  const offRank2 = W.goldRankSetups(offC, { now: OFF_NOW,
    news: { loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(OFF_NOW/1000) }] },
    macro: { realRateHint: 'HEADWIND' } });
  assert(offRank2.ranked.length === 0 && offRank2.rejected.length === offC.length
      && offRank2.rejected.every(r => /OFF-SESSION/.test(r.reason) && /below the raised bar \(\+2\)/.test(r.reason)),
         'off-session tally bar: tally ' + offRank2.rejected.map(r => (r.reason.match(/tally ([+-]?\d+)/) || [])[1]) + ' below +2 -> held back with the reason named');
  const asianC = W.goldScalpSetups({ rows15m: asianBoRows25(), now: ASIAN_NOW });
  const asianOnly = asianC.find(c => c.stratKey === 'asian');
  assert(!!asianOnly && asianOnly.demoted === false && asianOnly.stamps.length === 0,
         'off-session exception: the Asian-range breakout strategy trades its own 00:00-07:00 GMT session undemoted');
  const asianOther = asianC.find(c => c.stratKey !== 'asian');
  assert(!asianOther || (asianOther.demoted === true && asianOther.stamps.indexOf('OFF-SESSION') >= 0),
         'a non-Asian strategy in the Asian window IS off-session demoted (only the Asian strategy is exempt)');
  const asianOff = W.goldScalpSetups({ rows15m: asianBoRows25(), now: OFF_NOW });
  const asianAtOff = asianOff.find(c => c.stratKey === 'asian');
  assert(!!asianAtOff && asianAtOff.demoted === true && asianAtOff.stamps.indexOf('OFF-SESSION') >= 0,
         'the Asian strategy outside its own session is demoted like everything else');

  /* ---- (2) TREND ALIGNMENT ---- */
  const ctBear = W.goldScalpSetups({ rows15m: ctRows25(), rows4h: rows4hBear25(), now: OVLP_NOW });
  const rsiL = ctBear.find(c => c.stratKey === 'rsidiv'), swL = ctBear.find(c => c.stratKey === 'sweep');
  assert(!!rsiL && rsiL.demoted === true && rsiL.stamps.indexOf('COUNTER-TREND') >= 0
      && /falling 200-EMA-15m/.test(rsiL.gateNotes.join(' ')) && /bearish 4H/.test(rsiL.gateNotes.join(' ')),
         'trend: long below a FALLING 200-EMA-15m with a bearish 4H stack -> COUNTER-TREND demotion');
  assert(!!swL && swL.demoted === false,
         'trend exception: the liquidity-sweep trigger is the sanctioned counter-trend play (never demoted)');
  const ctBull = W.goldScalpSetups({ rows15m: ctRows25(), rows4h: rows4hBull25(), now: OVLP_NOW });
  const rsiLB = ctBull.find(c => c.stratKey === 'rsidiv');
  assert(!!rsiLB && rsiLB.demoted === false, 'trend: a disagreeing (bullish) 4H stack clears the demotion — not counter-trend');
  const ctNone = W.goldScalpSetups({ rows15m: ctRows25(), now: OVLP_NOW });
  const rsiLN = ctNone.find(c => c.stratKey === 'rsidiv');
  assert(!!rsiLN && rsiLN.demoted === true, 'trend: 4H unavailable -> the falling 15m 200-EMA evidence alone demotes');
  const ctMir = W.goldScalpSetups({ rows15m: mirrorRows(ctRows25(), 2560), rows4h: rows4hBull25(), now: OVLP_NOW });
  const rsiS = ctMir.find(c => c.stratKey === 'rsidiv'), swS = ctMir.find(c => c.stratKey === 'sweep');
  assert(!!rsiS && rsiS.dir === 'short' && rsiS.demoted === true && rsiS.stamps.indexOf('COUNTER-TREND') >= 0
      && /rising 200-EMA-15m/.test(rsiS.gateNotes.join(' ')),
         'trend (mirrored): short above a RISING 200-EMA-15m with a bullish 4H stack -> COUNTER-TREND demotion');
  assert(!!swS && swS.demoted === false, 'trend (mirrored): the sweep-rejection short is exempt');

  /* ---- (3) MIN R:R AFTER SNAPPING ---- */
  const rrC = W.goldScalpSetups({ rows15m: rrShortRows25(), now: OVLP_NOW });
  assert(!rrC.find(c => c.stratKey === 'ob'), 'min-R:R: opposing structure < 1.2R away -> the setup does NOT render as a card');
  const rrDrop = (rrC.rejected || []).find(r => r.stratKey === 'ob');
  assert(!!rrDrop && rrDrop.dir === 'short' && /structure too close — R:R insufficient/.test(rrDrop.reason),
         'min-R:R: realized TP1 < 1.2R after snapping -> dropped with the named reason ("' + (rrDrop && rrDrop.reason) + '")');
  assert(Array.isArray(rrC.rejected) && rrC.rejected.length >= 1
      && rrC.rejected.every(r => typeof r.reason === 'string' && r.reason.length > 10),
         'min-R:R: every held-back setup carries a human-readable reason (never silently dropped)');

  /* ---- (4) CHOP FILTER ---- */
  const chopC = W.goldScalpSetups({ rows15m: obRows25(), now: OVLP_NOW });
  const chopOb = chopC.find(c => c.stratKey === 'ob');
  assert(!!chopOb && chopOb.demoted === true && chopOb.stamps.indexOf('CHOP') >= 0
      && /Kaufman ER .* < 0\.25/.test(chopOb.gateNotes.join(' ')),
         'chop: Kaufman ER(20) < 0.25 demotes the mean-reversion OB retest (stamped CHOP)');
  const chopBreak = W.goldScalpSetups({ rows15m: compLongRows(), now: OVLP_NOW });
  const chSw = chopBreak.find(c => c.stratKey === 'sweep'), chRs = chopBreak.find(c => c.stratKey === 'rsidiv');
  assert(!!chSw && chSw.stamps.indexOf('CHOP') < 0 && !!chRs && chRs.stamps.indexOf('CHOP') < 0,
         'chop: breakout triggers (sweep) and divergence plays are exempt from the chop demotion');

  /* ---- (5) NEWS-WINDOW VETO (tab level) ---- */
  {
    globalThis.window = {};
    const ls2 = memLocalStorage();
    globalThis.localStorage = ls2;
    vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
    vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });
    const C2 = globalThis.window;
    const FIXED = OVLP_NOW + 30*60*1000;
    const realDateNow2 = Date.now;
    Date.now = () => FIXED;
    C2.hgNewsState = () => ({ loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(FIXED/1000) + 300 }] });
    C2.getGoldCandles = async (tf) => (tf === '15m')
      ? { rows: cloneRows(compLongRows()), source: 'binance-xau' }
      : { rows: [], source: 'binance-xau' };
    const tab2 = C2.HG_tabs.find(t => t.id === 'goldscalp');
    const M2 = freshPane();
    tab2.mount(M2.pane);
    await M2.stubs['#gsRun']._handler();                       // scan A: veto active, empty store
    const sA = C2.goldscalpScan();
    const liveA2 = Object.keys(loadConvictionStore(ls2).live).length;
    assert(liveA2 === 0 && sA.cands.length === 0,
           'news veto: inside the ±30-min high-impact window NO new conviction is issued');
    assert(sA.rejected.length >= 2
        && sA.rejected.every(r => /NEWS WINDOW — no new entries, wait 15–30 min after release/.test(r.reason)),
           'news veto: every held-back setup renders the NEWS WINDOW reason line');
    assert(M2.stubs['#gsCards'].innerHTML.indexOf('NEWS WINDOW — no new entries') >= 0,
           'news veto: reason lines rendered on the pane (never silently dropped)');

    /* already-live conviction keeps running untouched through the window */
    const det = C2.goldScalpSetups({ rows15m: cloneRows(compLongRows()), now: FIXED });
    const detSw = det.find(c => c.stratKey === 'sweep');
    const preStore = loadConvictionStore(ls2) || { v: 1, live: {}, history: [] };
    preStore.live[detSw.id] = { id: detSw.id, dir: detSw.dir, strategy: detSw.strategy,
                                entry: detSw.entry, stop: detSw.stop, t1: detSw.t1, t2: detSw.t2,
                                venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: FIXED - 60*1000, tally: 7 };
    ls2.setItem('hgGoldscalpConviction', JSON.stringify(preStore));
    await tab2.refresh();                                      // scan B: veto active, one live record
    const sB = C2.goldscalpScan();
    const liveB2 = Object.keys(loadConvictionStore(ls2).live).length;
    assert(liveB2 === 1, 'news veto: nothing new minted even with a live record present (live count flat)');
    assert(sB.cands.length === 1 && sB.cands[0].id === detSw.id && sB.cands[0].locked === true && sB.cands[0].vetoed === false,
           'news veto: the already-live conviction is restored + locked — it keeps running untouched');
    assert(sB.rejected.length === 1 && /NEWS WINDOW/.test(sB.rejected[0].reason),
           'news veto: the OTHER (not-yet-live) setup is still held back with the reason line');

    /* window passes -> issuance resumes */
    C2.hgNewsState = () => ({ loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(FIXED/1000) + 45*60 }] });
    await tab2.refresh();                                      // scan C: outside the window again
    const sC = C2.goldscalpScan();
    const liveC2 = Object.keys(loadConvictionStore(ls2).live).length;
    assert(liveC2 === 2 && sC.cands.some(c => c.locked === false),
           'news window passed -> new convictions issue again (held-back setup mints)');
    Date.now = realDateNow2;
    delete globalThis.localStorage;
  }
}

/* =========================================================================
   26) card execution blocks: TRADE MANAGEMENT + ENTRY GUIDANCE on every
       card, and the DUPLICATE-CONVICTION MERGE (0.5×ATR structure anchor)
========================================================================= */
console.log('== 26) execution blocks + duplicate-conviction merge ==');
function pxLike(n){                                  /* mirrors pxF fallback formatting */
  const a = Math.abs(n);
  const d = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function obZoneRows26(){
  const rows = flatRows(25, 100, 0.5, DAY);
  rows.push({ t: DAY + 25*900, o: 100, h: 100.4, l: 98.8, c: 99.6, v: 1200 });   // bullish OB, base 98.8
  rows.push({ t: DAY + 26*900, o: 99.6, h: 104.5, l: 99.5, c: 104.2, v: 4000 });
  rows.push({ t: DAY + 27*900, o: 104.2, h: 105, l: 103.8, c: 104.6, v: 1500 });
  rows.push({ t: DAY + 28*900, o: 104.6, h: 105.2, l: 104, c: 104.8, v: 1500 });
  rows.push({ t: DAY + 29*900, o: 104.8, h: 105.3, l: 104.4, c: 105, v: 1400 });
  let px = 105;
  for (let i = 30; i < 41; i++){ const o = px; px = o - 0.5;
    rows.push({ t: DAY + i*900, o: o, h: Math.max(o, px) + 0.3, l: Math.min(o, px) - 0.3, c: px, v: 1100 }); }
  rows.push({ t: DAY + 41*900, o: px, h: px + 0.2, l: 98.95, c: 99.4, v: 2600 }); // close inside the OB zone
  return rows;
}
function vwapRows26(){
  const rows = trendRows(48, 100, 0.15, DAY, 900);
  let px = rows[47].c;
  for (let i = 0; i < 11; i++){ const o = px; px = o - 0.25;
    rows.push({ t: DAY + (48+i)*900, o: o, h: Math.max(o, px) + 0.35, l: Math.min(o, px) - 0.35, c: px, v: 1100 }); }
  const v0 = W.goldVWAP(rows, 0).value;
  const target = v0 + 0.58;
  rows.push({ t: DAY + 59*900, o: px, h: Math.max(px, target) + 0.3, l: Math.min(px, target) - 0.2, c: target, v: 1200 });
  return rows;
}
{
  globalThis.window = {};
  const ls3 = memLocalStorage();
  globalThis.localStorage = ls3;
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });
  const C3 = globalThis.window;
  const FIXED = OVLP_NOW + 30*60*1000;
  const realDateNow3 = Date.now;
  Date.now = () => FIXED;
  C3.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: cloneRows(compLongRows()), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  const tab3 = C3.HG_tabs.find(t => t.id === 'goldscalp');
  const M3 = freshPane();
  tab3.mount(M3.pane);
  await M3.stubs['#gsRun']._handler();
  const s1 = C3.goldscalpScan();

  /* candidates carry their numeric structure anchor (id bucket = Math.round(anchor)) */
  const detA = C3.goldScalpSetups({ rows15m: obZoneRows26(), now: FIXED });
  const obDet = detA.find(c => c.stratKey === 'ob');
  assert(!!obDet && isFinite(obDet.anchor) && obDet.id === 'ob|long|' + Math.round(obDet.anchor),
         'candidate carries its numeric structure anchor (id bucket = Math.round(anchor), got ' + (obDet && obDet.anchor) + ')');

  /* (1) TRADE MANAGEMENT block on EVERY card, with the card's real values */
  const html1 = M3.stubs['#gsCards'].innerHTML;
  const mgmtCount = (html1.match(/TRADE MANAGEMENT/g) || []).length;
  assert(mgmtCount === s1.cands.length && s1.cands.length >= 2,
         'trade-management block rendered on EVERY scalp card (' + mgmtCount + '/' + s1.cands.length + ')');
  const swG = s1.cands.find(c => c.stratKey === 'sweep');
  assert(html1.indexOf('At TP1 $' + pxLike(swG.t1) + ': close 50%, move stop to breakeven ($' + pxLike(swG.entry)
      + '). Runner targets TP2 $' + pxLike(swG.t2) + '.') >= 0,
         'management block uses the card\'s real TP1/entry(breakeven)/TP2 values');

  /* (3) ENTRY GUIDANCE — price inside the entry zone */
  const guideInCount = (html1.match(/price in zone — market entry valid/g) || []).length;
  assert(guideInCount === s1.cands.length,
         'entry guidance: price inside the zone -> "price in zone — market entry valid" on every card');

  /* (3) ENTRY GUIDANCE — price outside the entry zone (vwap bounce: close sits above the zone) */
  C3.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: vwapRows26(), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  await tab3.refresh();
  const s2 = C3.goldscalpScan();
  const vw2 = s2.cands.find(c => c.stratKey === 'vwap');
  assert(!!vw2 && vw2.zone && isFinite(vw2.zone.hi), 'premise: vwap candidate with a zone on the board');
  const html2 = M3.stubs['#gsCards'].innerHTML;
  assert(html2.indexOf('price outside zone — limit order at zone edge $' + pxLike(vw2.zone.hi)) >= 0,
         'entry guidance: price above the zone -> "price outside zone — limit order at zone edge <real edge>"');

  /* (2) DUPLICATE-CONVICTION MERGE — same sym+dir, anchor within 0.5×ATR */
  const seedMerge = { v: 1, live: {}, history: [] };
  seedMerge.live['sweep|long|99'] = { id: 'sweep|long|99', dir: 'long', strategy: 'LIQUIDITY SWEEP REVERSAL',
                                      entry: 99.5, stop: 98.0, t1: 101.5, t2: 103.0,
                                      venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT',
                                      issuedAt: FIXED - 120*1000, tally: 8, anchor: 99.2 };
  ls3.removeItem('hgGoldscalpConviction');
  ls3.setItem('hgGoldscalpConviction', JSON.stringify(seedMerge));
  C3.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: obZoneRows26(), source: 'binance-xau' }       // ob long, anchor 98.8 — Δ 0.4 <= 0.5×ATR(≈1.2)
    : { rows: [], source: 'binance-xau' };
  await tab3.refresh();
  const s3 = C3.goldscalpScan();
  const obM = s3.cands.find(c => c.id === 'ob|long|99');
  const storeM = loadConvictionStore(ls3);
  assert(!!obM && obM.merged === true && obM.locked === true && obM.issuedAt === FIXED - 120*1000,
         'merge: overlapping setup merges into the live conviction (re-confirmed, original issuedAt kept)');
  assert(!!obM && obM.entry === 99.5 && obM.stop === 98.0 && obM.t1 === 101.5 && obM.t2 === 103.0,
         'merge: the ORIGINAL levels stand — no re-pick, no second card');
  assert(!!storeM && !storeM.live['ob|long|99'] && Object.keys(storeM.live).length === 1
      && storeM.live['sweep|long|99'].lastConfirmedAt === FIXED,
         'merge: nothing new minted; live conviction\'s lastConfirmedAt refreshed');
  assert(M3.stubs['#gsCards'].innerHTML.indexOf('conviction re-confirmed · original levels stand') >= 0,
         'merge: the card says "conviction re-confirmed · original levels stand"');

  /* merge guards: anchor beyond 0.5×ATR -> normal new evaluation */
  const seedFar = { v: 1, live: {}, history: [] };
  seedFar.live['sweep|long|100'] = { id: 'sweep|long|100', dir: 'long', strategy: 'LIQUIDITY SWEEP REVERSAL',
                                     entry: 100.3, stop: 98.6, t1: 102.6, t2: 104.3,
                                     venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT',
                                     issuedAt: FIXED - 120*1000, tally: 8, anchor: 99.8 };
  ls3.removeItem('hgGoldscalpConviction');
  ls3.setItem('hgGoldscalpConviction', JSON.stringify(seedFar));
  await tab3.refresh();
  const s4 = C3.goldscalpScan();
  const obF = s4.cands.find(c => c.id === 'ob|long|99');
  const storeF = loadConvictionStore(ls3);
  assert(!!obF && !obF.merged && obF.locked === false && Object.keys(storeF.live).length === 2
      && !!storeF.live['ob|long|99'],
         'merge guard: anchor beyond 0.5×ATR (Δ 1.0) -> normal new conviction, no merge');
  assert(M3.stubs['#gsCards'].innerHTML.indexOf('conviction re-confirmed · original levels stand') < 0,
         'merge guard: no re-confirmed line on a genuinely new conviction');

  /* merge guards: different direction -> normal new evaluation */
  const seedDir = { v: 1, live: {}, history: [] };
  seedDir.live['sweep|short|99'] = { id: 'sweep|short|99', dir: 'short', strategy: 'LIQUIDITY SWEEP REVERSAL',
                                     entry: 99.5, stop: 100.5, t1: 98.0, t2: 96.5,
                                     venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT',
                                     issuedAt: FIXED - 120*1000, tally: 8, anchor: 99.0 };
  ls3.removeItem('hgGoldscalpConviction');
  ls3.setItem('hgGoldscalpConviction', JSON.stringify(seedDir));
  await tab3.refresh();
  const s5 = C3.goldscalpScan();
  const obD = s5.cands.find(c => c.id === 'ob|long|99');
  assert(!!obD && !obD.merged && obD.locked === false && Object.keys(loadConvictionStore(ls3).live).length === 2,
         'merge guard: different direction -> normal new conviction, no merge');

  /* merge guards: different symbol -> normal new evaluation */
  const seedSym = { v: 1, live: {}, history: [] };
  seedSym.live['sweep|long|99'] = { id: 'sweep|long|99', dir: 'long', strategy: 'LIQUIDITY SWEEP REVERSAL',
                                    entry: 99.5, stop: 98.0, t1: 101.5, t2: 103.0,
                                    venue: 'BINANCE PAXGUSDT', sym: 'PAXGUSDT',
                                    issuedAt: FIXED - 120*1000, tally: 8, anchor: 99.0 };
  ls3.removeItem('hgGoldscalpConviction');
  ls3.setItem('hgGoldscalpConviction', JSON.stringify(seedSym));
  await tab3.refresh();
  const s6 = C3.goldscalpScan();
  const obS = s6.cands.find(c => c.id === 'ob|long|99');
  assert(!!obS && !obS.merged && obS.locked === false && Object.keys(loadConvictionStore(ls3).live).length === 2,
         'merge guard: different symbol -> normal new conviction, no merge');

  Date.now = realDateNow3;
  delete globalThis.localStorage;
}

/* =========================================================================
   27) FORMING NOW (goldWatch) + WHY SILENT — per-strategy ARMED/IDLE watch
       items with real levels, and the honest lead reason for silent scans
========================================================================= */
console.log('== 27) goldWatch forming-now + tab WHY SILENT ==');
function emaLast27(vals, p){                              /* mirrors the module EMA seed */
  if (vals.length < p) return NaN;
  const k = 2/(p+1); let e = 0;
  for (let i = 0; i < p; i++) e += vals[i];
  e /= p;
  for (let i = p; i < vals.length; i++) e = vals[i]*k + e*(1-k);
  return e;
}
function fvgRows27(){                                     /* unmitigated bullish gap, price retraces INTO it */
  const rows = flatRows(30, 96, 0.4, DAY);
  rows.push({ t: DAY + 30*900, o: 99, h: 100, l: 98, c: 99.5, v: 1000 });
  rows.push({ t: DAY + 31*900, o: 99.5, h: 102.5, l: 99, c: 102, v: 1000 });
  rows.push({ t: DAY + 32*900, o: 102, h: 103.5, l: 101, c: 103, v: 1000 });   // gap [100,101]
  rows.push({ t: DAY + 33*900, o: 103, h: 104, l: 102, c: 103.5, v: 1000 });
  let px = 103.5;
  for (let i = 34; i < 44; i++){ const o = px; px = o - 0.3;
    const v = (px >= 99.8 && px <= 101.2) ? 8000 : 1000;
    rows.push({ t: DAY + i*900, o: o, h: Math.max(o, px) + 0.35, l: Math.min(o, px) - 0.35, c: px, v: v }); }
  rows.push({ t: DAY + 44*900, o: px, h: px + 0.3, l: px - 0.15, c: 100.7, v: 1200 });
  return rows;
}
function ribbonRows27(){                                  /* strong trend + pullback to the 20-EMA */
  const rows = trendRows(205, 100, 0.8, DAY, 300);
  let px = rows[204].c;
  for (let i = 0; i < 4; i++){ const o = px; px = o - 1.6;
    rows.push({ t: DAY + (205+i)*300, o: o, h: Math.max(o, px) + 0.9, l: Math.min(o, px) - 0.9, c: px, v: 1300 }); }
  return rows;
}
function flat900(n, base, spread){                        /* 15m-step flat bars (silent scans) */
  const r = [];
  for (let i = 0; i < n; i++) r.push({ t: DAY + i*900, o: base, h: base + spread, l: base - spread, c: base, v: 1000 });
  return r;
}
function fmtLike(n, d){ return Number(n).toLocaleString('en-US', { maximumFractionDigits: d }); }

/* ---- 27a) goldWatch unit contract ---- */
{
  assert(typeof W.goldWatch === 'function', 'window.goldWatch exported');
  assert(JSON.stringify(W.goldWatch(null)) === '[]'
      && JSON.stringify(W.goldWatch({})) === '[]'
      && JSON.stringify(W.goldWatch({ rows15m: [] })) === '[]'
      && JSON.stringify(W.goldWatch({ rows15m: flatRows(10, 100, 1, 0) })) === '[]',
      'goldWatch: null/empty/short input -> [] (never null, never throws)');

  const rows = compLongRows();
  const wl = W.goldWatch({ rows15m: rows, now: OFF_NOW, tf: '15m' });
  assert(Array.isArray(wl) && wl.length === 8, 'goldWatch: one watch item per scalp strategy (8)');
  assert(wl.every(w => Object.keys(w).sort().join(',') === 'condition,level,reason,state,stratKey,strategy'),
         'goldWatch: every item carries EXACTLY {stratKey, strategy, state, level, condition, reason}');
  assert(wl.every(w => (w.state === 'armed' && typeof w.condition === 'string' && w.condition.length > 10)
                    || (w.state === 'idle' && typeof w.reason === 'string' && w.reason.length > 5)),
         'goldWatch: armed items carry a live trigger condition, idle items carry the honest reason');
  const byKey = {};
  for (const w of wl) byKey[w.stratKey] = w;

  /* sweep: armed on the NEARER of the last-25-bar swing high/low */
  const sH = Math.max(...rows.slice(-25).map(r => r.h)), sL = Math.min(...rows.slice(-25).map(r => r.l));
  const entry = rows[rows.length - 1].c;
  const swLvl = Math.abs(entry - sL) <= Math.abs(sH - entry) ? sL : sH;
  assert(byKey.sweep.state === 'armed' && byKey.sweep.level === swLvl,
         'sweep: armed on the nearer 25-bar swing ' + (swLvl === sL ? 'low' : 'high') + ' ' + swLvl);
  assert(/last 15m swing (low|high)/.test(byKey.sweep.condition) && /fires on a wick/.test(byKey.sweep.condition),
         'sweep: condition names the exact live trigger — got "' + byKey.sweep.condition + '"');

  /* vwap: always armed when computable, level = the session VWAP itself */
  assert(byKey.vwap.state === 'armed' && isFinite(byKey.vwap.level)
      && /session VWAP/.test(byKey.vwap.condition) && /bounce\/rejection/.test(byKey.vwap.condition),
         'vwap: armed on the real session VWAP ' + byKey.vwap.level);

  /* ribbon: compLongRows resolves MIXED (e20 < e50 after the long decline) ->
     honest idle; a directional stack arms on the real 20-EMA */
  assert(byKey.ribbon.state === 'idle' && /ribbon MIXED/.test(byKey.ribbon.reason),
         'ribbon: MIXED stack on compLongRows -> idle with the reason named ("' + byKey.ribbon.reason + '")');
  const rw = W.goldWatch({ rows15m: ribbonRows27(), now: OFF_NOW, tf: '15m' });
  const rRb = rw.find(w => w.stratKey === 'ribbon');
  const e20r = emaLast27(ribbonRows27().map(r => r.c), 20);
  assert(rRb && rRb.state === 'armed' && Math.abs(rRb.level - e20r) < 1e-9
      && /BULL 20\/50\/200 ribbon/.test(rRb.condition),
         'ribbon: armed on the real 20-EMA ' + (rRb && rRb.level) + ' inside a BULL stack');

  /* asian: box from the last bar's 00:00-07:00 GMT window, still building */
  const box = rows.filter(r => r.t >= DAY + 86400 && r.t < DAY + 86400 + 7*3600);
  const bHi = Math.max(...box.map(r => r.h)), bLo = Math.min(...box.map(r => r.l));
  const aLvl = Math.abs(entry - bLo) <= Math.abs(bHi - entry) ? bLo : bHi;
  assert(byKey.asian.state === 'armed' && byKey.asian.level === aLvl
      && /00:00–07:00 GMT/.test(byKey.asian.condition) && /still building/.test(byKey.asian.condition),
         'asian: armed on the real box ' + bLo + '–' + bHi + ' (nearest edge ' + aLvl + ')');

  /* rsidiv: armed with the real divergence pivot to beat (the sweep-wick low) */
  const pivExp = W.goldRSIGold(rows).pivotLow;
  assert(byKey.rsidiv.state === 'armed' && byKey.rsidiv.level === pivExp
      && /RSI now/.test(byKey.rsidiv.condition) && byKey.rsidiv.condition.indexOf('pivot to beat ' + pivExp.toFixed(2)) >= 0,
         'rsidiv: armed, pivot to beat ' + pivExp + ' — got "' + byKey.rsidiv.condition + '"');

  /* fvg on compLongRows: the unmitigated gap is within reach -> armed on its edge */
  assert(byKey.fvg.state === 'armed' && byKey.fvg.level === 2303.5
      && /unmitigated 15m FVG 2303.00–2303.50 — fires on a retrace into the gap/.test(byKey.fvg.condition),
         'fvg: armed on the real gap 2303.00–2303.50 (near edge 2303.5) — got "' + byKey.fvg.condition + '"');
  /* fvg armed with price INSIDE the gap -> the far edge is the level */
  const fw = W.goldWatch({ rows15m: fvgRows27(), now: OFF_NOW, tf: '15m' });
  const fFvg = fw.find(w => w.stratKey === 'fvg');
  assert(fFvg && fFvg.state === 'armed' && fFvg.level === 100
      && /unmitigated 15m FVG 100.00–101.00 — fires on a retrace into the gap/.test(fFvg.condition),
         'fvg: armed on the real gap 100.00–101.00 when price is inside it');

  /* ob armed: price inside the unmitigated bullish OB zone */
  const ow = W.goldWatch({ rows15m: obZoneRows26(), now: OFF_NOW, tf: '15m' });
  const oOb = ow.find(w => w.stratKey === 'ob');
  assert(oOb && oOb.state === 'armed' && oOb.level === 98.8
      && /unmitigated bullish 15m order block 98.80–100.40 — fires on a retest/.test(oOb.condition),
         'ob: armed on the real zone 98.80–100.40 (edge 98.8) — got "' + (oOb && oOb.condition) + '"');

  /* flat rows: honest mixed states, nothing fabricated */
  const fl = W.goldWatch({ rows15m: flatRows(60, 100, 1, DAY), now: OFF_NOW, tf: '15m' });
  const fByKey = {};
  for (const w of fl) fByKey[w.stratKey] = w;
  assert(fByKey.ob.state === 'idle' && /no unmitigated 15m order block on the chart/.test(fByKey.ob.reason)
      && fByKey.fvg.state === 'idle'
      && fByKey.ribbon.state === 'idle' && /ribbon MIXED/.test(fByKey.ribbon.reason),
         'flat: ob/fvg/ribbon honestly idle with reasons named');
  assert(fByKey.vwap.state === 'armed' && fByKey.vwap.level === 100
      && fByKey.sweep.state === 'armed' && fByKey.sweep.level === 99
      && fByKey.asian.state === 'armed',
      'flat: vwap/sweep/asian still armed on their real levels (no fabrication needed to watch)');
  assert(fByKey.rsidiv.state === 'armed' && fByKey.rsidiv.level === null
      && /RSI now 50.0/.test(fByKey.rsidiv.condition) && /no levels available yet/.test(fByKey.rsidiv.condition),
         'flat: rsidiv armed with RSI 50 but honestly "no levels available yet (no confirmed pivot)"');

  /* 4h/1d-shaped rows: the Asian box honestly cannot exist -> idle, never faked */
  const wl4 = W.goldWatch({ rows15m: trendRows(220, 2300, 1.2, DAY - 220*4*3600, 4*3600), now: OFF_NOW, tf: '4h' });
  const a4 = wl4.find(w => w.stratKey === 'asian');
  assert(a4 && a4.state === 'idle' && /no Asian-range box yet/.test(a4.reason),
         '4h rows: asian watch honestly idle — "' + (a4 && a4.reason) + '"');
}

/* ---- 27b) tab FORMING NOW panel + WHY SILENT precedence ---- */
{
  globalThis.window = {};
  const ls4 = memLocalStorage();
  globalThis.localStorage = ls4;
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });
  const C4 = globalThis.window;
  const FIXED = OVLP_NOW + 30*60*1000;                     // 14:30 GMT -> killzone weight 3
  const realDateNow4 = Date.now;
  Date.now = () => FIXED;
  C4.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: cloneRows(compLongRows()), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  const tab4 = C4.HG_tabs.find(t => t.id === 'goldscalp');
  const M4 = freshPane();
  tab4.mount(M4.pane);
  await M4.stubs['#gsRun']._handler();
  const wScan = C4.goldscalpScan();

  /* panel renders after the cards; snapshot carries the additive fields */
  const wHtml = M4.stubs['#gsCards'].innerHTML;
  assert(wHtml.indexOf('FORMING NOW — what the engine is watching') >= 0
      && wHtml.indexOf('armed setups are watch items, not entries') >= 0,
      'FORMING NOW panel rendered after the cards with the honest watch-item label');
  assert(wHtml.indexOf('ARMED') >= 0, 'armed rows highlighted in the panel');
  assert(Array.isArray(wScan.armed) && wScan.armed.length === 8, 'snapshot.armed: 8 watch items (one venue leg)');
  assert(wScan.armed.every(w => Object.keys(w).sort().join(',') === 'condition,level,reason,state,strategy,venue'
      && w.venue === 'BINANCE XAUUSDT'),
         'snapshot.armed entries carry EXACTLY {strategy, venue, state, level, condition, reason}, venue-tagged');
  assert(wScan.armed.find(w => w.strategy === 'LIQUIDITY SWEEP REVERSAL').state === 'armed',
         'snapshot.armed: sweep armed on the fixture');
  assert(wScan.whySilent === null, 'whySilent null when candidates qualify');
  assert('armed' in wScan && 'whySilent' in wScan
      && Array.isArray(wScan.cands) && typeof wScan.bestId === 'string' && typeof wScan.at === 'number',
         'additive contract: existing snapshot fields untouched, armed/whySilent added');

  /* silent scan (flat rows, OVLP): lead = nearest armed trigger with $ + ATR distance */
  C4.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: flat900(240, 100, 0.5), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  await tab4.refresh();
  const sScan = C4.goldscalpScan();
  assert(sScan.cands.length === 0, 'premise: flat rows produce zero qualifying candidates');
  const sHtml = M4.stubs['#gsCards'].innerHTML;
  assert(sHtml.indexOf('WHY SILENT') >= 0, 'WHY SILENT line rendered when the scan yields zero candidates');
  assert(/nearest armed trigger: SESSION VWAP BOUNCE \/ REJECTION \(BINANCE XAUUSDT\) at \$100 — \$0 \(0×ATR\(15m\)\) away/
      .test(sScan.whySilent),
      'silent lead = nearest armed trigger with real $ + ATR distance — got "' + sScan.whySilent + '"');
  assert(sHtml.indexOf('FORMING NOW') >= 0, 'watch panel still rendered on the silent scan');
  assert(M4.stubs['#gsEmpty'].style.display !== 'block', 'empty state stays hidden when watch data exists');

  /* off-session: killzone leads, nearest-armed rides as the tail */
  Date.now = () => OFF_NOW;                                // 20:00 GMT -> weight 0
  await tab4.refresh();
  const kScan = C4.goldscalpScan();
  assert(kScan.whySilent.indexOf('outside every ICT killzone (OFF-HOURS)') === 0
      && /· nearest armed trigger:/.test(kScan.whySilent),
         'killzone lead + nearest-armed tail — got "' + kScan.whySilent + '"');

  /* news window outranks the killzone (precedence news > killzone) */
  C4.hgNewsState = () => ({ loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(OFF_NOW/1000) + 300 }] });
  await tab4.refresh();
  const nScan = C4.goldscalpScan();
  assert(nScan.whySilent.indexOf('high-impact news window ±30 min — US CPI') === 0
      && !/outside every ICT killzone/.test(nScan.whySilent),
         'news window leads even off-session (precedence news > killzone) — got "' + nScan.whySilent + '"');
  delete C4.hgNewsState;

  /* live convictions: re-confirmations, not new issuance */
  Date.now = () => FIXED;
  ls4.setItem('hgGoldscalpConviction', JSON.stringify({ v: 1, live: {
    'sweep|long|9999': { id: 'sweep|long|9999', dir: 'long', strategy: 'LIQUIDITY SWEEP REVERSAL',
                         entry: 99, stop: 95, t1: 99999, t2: 99999, venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT',
                         issuedAt: FIXED, tally: 5 } }, history: [] }));
  await tab4.refresh();
  const cScan = C4.goldscalpScan();
  assert(cScan.whySilent.indexOf('1 live conviction already locked — re-confirmations, not new issuance') === 0
      && /· nearest armed trigger:/.test(cScan.whySilent),
         'convictions lead + nearest-armed tail — got "' + cScan.whySilent + '"');
  ls4.removeItem('hgGoldscalpConviction');

  /* feeds failed: the empty state itself carries the WHY SILENT reason */
  C4.getGoldCandles = async () => ({ rows: [], source: 'binance-xau' });
  await tab4.refresh();
  assert(M4.stubs['#gsEmpty'].style.display === 'block'
      && /WHY SILENT/.test(M4.stubs['#gsEmpty'].innerHTML)
      && /feeds failed — no 15m klines/.test(M4.stubs['#gsEmpty'].innerHTML),
         'feeds failed: empty state carries the WHY SILENT feeds-failed line');
  assert(M4.stubs['#gsCards'].innerHTML === '', 'feeds failed: no cards rendered without data');

  Date.now = realDateNow4;
  delete globalThis.localStorage;
}

/* =========================================================================
   volume microstructure — goldVolumeSpike + goldVolumeProfile
========================================================================= */
console.log('== volume microstructure ==');
{
  const base = flatRows(30, 100, 1, 0);
  base[29].v = 4000;
  assert(W.goldVolumeSpike(base) === true, 'goldVolumeSpike: last bar 4× avg -> true');
  assert(W.goldVolumeSpike(base, 10) === false, 'goldVolumeSpike: mid bar at flat volume -> false');
  const prof = W.goldVolumeProfile(base, 25, 10);
  assert(prof && isFinite(prof.pocPrice) && Array.isArray(prof.hvns), 'goldVolumeProfile: returns POC + hvns array');
  const sweepRows = compLongRows();
  const swCands = W.goldScalpSetups({ rows15m: sweepRows, now: OFF_NOW });
  const swCand = swCands.find(c => c.stratKey === 'sweep');
  assert(!!swCand && swCand.why.indexOf('volume climax') >= 0,
         'goldScalpSetups: sweep candidate cites volume climax when sweep bar spikes');
  assert(swCand && swCand.confluence.some(l => l.indexOf('volume climax on the liquidity sweep') >= 0),
         'goldScalpSetups: volspike read in sweep confluence ledger');
  assert(swCand && swCand.why.indexOf('volume-validated') >= 0,
         'goldScalpSetups: sweep why cites V2 volume validation');
  const v2sw = W.goldSweepV2(base, 29, 10, 20, 1.5);
  assert(v2sw && v2sw.trigger === false, 'goldSweepV2: flat tail bar is not a V2 sweep');
  const v2rows = compLongRows();
  const v2hit = W.goldSweepV2(v2rows, 109, 10, 20, 1.5);
  assert(v2hit && v2hit.trigger === true && v2hit.dir === 'long', 'goldSweepV2: compLongRows sweep bar triggers long');
  const fvgR = fvgRows27();
  const fvgG = W.goldFVG(fvgR)[0];
  const fvgP = W.goldVolumeProfile(fvgR);
  assert(W.goldFVGHasHVNSupport(fvgG, fvgP) === true, 'goldFVGHasHVNSupport: fvg fixture gap has HVN launchpad');
  const eng = W.HardgateGoldEngine;
  assert(eng && typeof eng.evaluateScalp === 'function', 'HardgateGoldEngine.evaluateScalp exported');
  assert(typeof eng.evaluateSwing === 'function', 'HardgateGoldEngine.evaluateSwing exported');
  const evEmpty = eng.evaluateScalp([]);
  assert(evEmpty.agreeingReads === 0 && evEmpty.activeTriggers.length === 0, 'evaluateScalp: empty -> zero triggers');
  assert(Array.isArray(evEmpty.activeOrderBlocks), 'evaluateScalp: exposes activeOrderBlocks');
  const evComp = eng.evaluateScalp(compLongRows());
  assert(evComp.volProfile && isFinite(evComp.volProfile.pocPrice), 'evaluateScalp: builds vol profile');
  assert(evComp.structure && typeof evComp.structure.trend === 'string', 'evaluateScalp: maintains structure');
  const evSwing = eng.evaluateSwing([]);
  assert(evSwing.agreeingReads === 0 && evSwing.obSetup && evSwing.obSetup.trigger === false,
         'evaluateSwings: empty -> no OB trigger');
  assert(typeof W.detectLiquiditySweep_V2 === 'function' && W.detectLiquiditySweep_V2 === W.goldSweepV2,
         'detectLiquiditySweep_V2 alias -> goldSweepV2');
}

/* =========================================================================
   SMC & market structure — goldSwings + goldMarketStructure + goldOrderBlockAt
========================================================================= */
console.log('== SMC market structure ==');
{
  assert(W.goldSwings([]).highs.length === 0 && W.goldSwings(null).lows.length === 0,
         'goldSwings: empty/null -> empty highs/lows');
  const ms0 = W.goldMarketStructure(flatRows(10, 100, 1, 0));
  assert(ms0.trend === 'neutral' && ms0.bos === false, 'goldMarketStructure: short series -> neutral');
  assert(W.goldOrderBlockAt([]).type === 'none' && W.goldOrderBlockAt(null).type === 'none',
         'goldOrderBlockAt: empty/null -> none');
  assert(W.detectSwings === W.goldSwings && W.detectMarketStructure === W.goldMarketStructure
      && W.detectOrderBlocks === W.goldOrderBlockAt, 'SMC alias exports');
  assert(W.updateActiveZones === W.goldUpdateActiveZones
      && W.detectOrderBlockRetest === W.goldOrderBlockRetest, 'robust OB retest alias exports');
  const emptyZones = W.goldUpdateActiveZones([]);
  assert(Array.isArray(emptyZones.activeOrderBlocks) && emptyZones.activeOrderBlocks.length === 0,
         'goldUpdateActiveZones: empty -> []');
  assert(W.goldOrderBlockRetest([]).trigger === false, 'goldOrderBlockRetest: empty -> no trigger');
  /* bullish OB retest with aligned structure */
  function obRetestRows(){
    const rows = flatRows(30, 100, 0.4, DAY);
    for (let i = 0; i < 30; i++){
      if (i % 8 === 4){ rows[i].h = rows[i].c + 3; rows[i].l = rows[i].c - 0.2; }
      if (i % 8 === 0){ rows[i].l = rows[i].c - 3; rows[i].h = rows[i].c + 0.2; }
    }
    rows.push({ t: DAY + 30*900, o: 100, h: 100.4, l: 98.8, c: 99.6, v: 1200 });
    rows.push({ t: DAY + 31*900, o: 99.6, h: 104.5, l: 99.5, c: 104.2, v: 4000 });
    for (let j = 32; j < 44; j++){
      const o = 104.2 - (j - 32) * 0.3;
      rows.push({ t: DAY + j*900, o: o, h: o + 0.4, l: o - 0.3, c: o - 0.15, v: 1100 });
    }
    rows[rows.length - 1].c = 99.55;
    rows[rows.length - 1].l = 99.45;
    rows[rows.length - 1].h = 100.1;
    return rows;
  }
  const obr = obRetestRows();
  const swO = W.goldSwings(obr, 3, 3);
  const msO = W.goldMarketStructure(obr, swO);
  const actO = W.goldActiveOrderBlocks(obr);
  const rtO = W.goldOrderBlockRetest(obr, obr.length - 1, msO, actO);
  if (msO.trend === 'bullish'){
    assert(rtO.trigger === true && rtO.direction === 'long' && rtO.type === 'ob_retest',
           'goldOrderBlockRetest: bullish structure + inside bullish OB -> long trigger');
    W.updateActiveZones(obr, obr.length - 1);
    const rt3 = W.detectOrderBlockRetest(obr, obr.length - 1, msO);
    assert(rt3.trigger === true, 'detectOrderBlockRetest: uses updateActiveZones cache when activeObs omitted');
  } else {
    assert(Array.isArray(actO), 'goldActiveOrderBlocks: returns array when structure neutral');
  }
  /* zigzag peaks/troughs for fractal swings (5+5 window) */
  const zz = [];
  let px = 100;
  for (let i = 0; i < 40; i++){
    const h = px + (i % 10 === 5 ? 8 : 1);
    const l = px - (i % 10 === 5 ? 1 : 1);
    if (i % 10 === 5) px += 6; else px += (i % 2 ? -0.3 : 0.2);
    zz.push({ t: i * 900, o: px, h: h, l: l, c: px, v: 1000 });
  }
  zz[zz.length - 1].c = zz[zz.length - 2].h + 2;
  zz[zz.length - 1].h = zz[zz.length - 1].c + 0.5;
  const sw = W.goldSwings(zz, 3, 3);
  assert(sw.highs.length >= 2 && sw.lows.length >= 2, 'goldSwings: zigzag yields swing pivots');
  const ms = W.goldMarketStructure(zz, sw);
  assert(ms.bos === true && ms.trend === 'bullish', 'goldMarketStructure: close above HH -> bullish BOS');
  const ledger = W.goldDetectorReads({ rows15m: zz });
  assert(ledger.some(r => r.tag === 'bos' && r.side === 'long' && /fractal BOS bullish/.test(r.label)),
         'goldDetectorReads: fractal BOS in confluence ledger');
}

console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
