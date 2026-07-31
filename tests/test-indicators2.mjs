/* HARDGATE — indicators2.js unit tests (Node 18+, no imports beyond builtins).
   Loads indicators.js + indicators2.js as classic scripts (shared vm context,
   exactly like the browser's <script> globals; window is stubbed so the
   hg-prefixed exports can be asserted on it) and asserts deterministic
   behavior on synthetic rows. Sections 11-13 cover hgStructure / hgAVWAP /
   hgAtrPercentile on hand-verifiable fixtures. Run: node tests/test-indicators2.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = {};                                  // indicators2.js exposes hgStructure/hgAVWAP/hgAtrPercentile here
for (const f of ['indicators.js', 'indicators2.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = ctx;
const W = ctx.window;

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
const rnd = mulberry32(42);
const rows = [];                       // 200 bars: sine wave + gentle trend
for (let i = 0; i < 200; i++){
  const base = 100 + i*0.1 + 10*Math.sin(i/10);
  const c = base + (rnd()-0.5)*0.5;
  const o = c + (rnd()-0.5)*0.3;
  rows.push({ t:i, o:o, h:Math.max(o,c)+rnd()*0.5, l:Math.min(o,c)-rnd()*0.5, c:c, v:1000+rnd()*100 });
}
const closes = rows.map(r => r.c);

function flatRows(n, base, spread, t0){  // pinned close, fixed h/l spread => sd~0, atr=2*spread
  const r = [];
  for (let i = 0; i < n; i++) r.push({ t:t0+i, o:base, h:base+spread, l:base-spread, c:base, v:1000 });
  return r;
}
function trendRows(n, start, step, t0){ // steady trend => bb sd >> atr
  const r = [];
  for (let i = 0; i < n; i++){
    const c = start + (i+1)*step, o = c - step;
    r.push({ t:t0+i, o:o, h:Math.max(o,c)+0.3, l:Math.min(o,c)-0.3, c:c, v:1000 });
  }
  return r;
}

/* ---------------- 1) sma / stdev / highest / lowest ---------------- */
{
  const s = G.sma(closes, 20);
  assert(s.length === closes.length && s.slice(0,19).every(Number.isNaN), 'sma: NaN until len-1');
  let m = 0; for (let k = 180; k < 200; k++) m += closes[k]; m /= 20;
  approx(s[199], m, 1e-9, 'sma: last value matches manual mean');

  const sd = G.stdev([2,4,4,4,5,5,7,9], 8);
  approx(sd[7], 2, 1e-12, 'stdev: population sd of textbook series = 2');

  const hi = G.highest([1,5,3,2,4], 3), lo = G.lowest([1,5,3,2,4], 3);
  assert(hi.slice(2).join(',') === '5,5,4' && lo.slice(2).join(',') === '1,2,2'
         && hi.slice(0,2).every(Number.isNaN), 'highest/lowest: rolling max/min incl. current bar');
  assert(G.sma([1,2], 20).every(Number.isNaN) && G.stdev([], 5).length === 0, 'sma/stdev: no throw on short/empty arrays');
}

/* ---------------- 2) keltner vs bollinger (BB inside KC on low-vol) ---------------- */
{
  const flat = flatRows(40, 50, 1, 0);
  const kc = G.keltner(flat, 20, 1.5);
  const bb = G.bollinger(flat.map(r=>r.c), 20, 2);
  const i = flat.length - 1;
  assert(isFinite(kc.mid[i]) && isFinite(kc.up[i]) && isFinite(kc.lo[i]), 'keltner: finite after warmup');
  assert(bb.upper[i] < kc.up[i] && bb.lower[i] > kc.lo[i], 'keltner: BB fully inside KC on constructed low-vol series');

  const tr = trendRows(40, 50, 1, 100);
  const kc2 = G.keltner(tr, 20, 1.5);
  const bb2 = G.bollinger(tr.map(r=>r.c), 20, 2);
  const j = tr.length - 1;
  assert(bb2.upper[j] > kc2.up[j] && bb2.lower[j] < kc2.lo[j], 'keltner: BB fully outside KC on strong-trend series');
}

/* ---------------- 3) donchian excludes current bar ---------------- */
{
  const d = flatRows(50, 100, 1, 0);           // all highs = 101
  d[49].h = 9999;                              // spike high on the LAST bar
  const dc = G.donchian(d, 20);
  assert(dc.up[49] === 101 && dc.up[49] < 9999, 'donchian: up[n-1] excludes current-bar spike (101 < 9999)');
  assert(dc.lo[49] === 99 && dc.mid[49] === 100, 'donchian: lo/mid from prior 20 bars');
  assert(dc.up.slice(0,20).every(Number.isNaN), 'donchian: NaN until index len');
}

/* ---------------- 4) ttmSqueeze on / fired ---------------- */
{
  const sq = flatRows(60, 50, 1, 0).concat(trendRows(30, 50, 1, 1000));
  const ttm = G.ttmSqueeze(sq);
  assert(ttm.on[59] === true, 'ttmSqueeze: on == true during constructed compression');
  assert(ttm.on[89] === false, 'ttmSqueeze: on == false after expansion');
  const firedIdx = ttm.fired.findIndex(Boolean);
  assert(firedIdx > 59, 'ttmSqueeze: fired on expansion bar (index ' + firedIdx + ')');
  let run = 0, maxRunBeforeFire = 0;
  for (let k = 0; k < firedIdx; k++){ run = ttm.on[k] ? run+1 : 0; maxRunBeforeFire = Math.max(maxRunBeforeFire, run); }
  assert(ttm.on[firedIdx-1] === true && maxRunBeforeFire >= 3, 'ttmSqueeze: fired only after >=3 consecutive on-bars');
  assert(ttm.fired.filter(Boolean).length === 1, 'ttmSqueeze: fired exactly once');
  assert(isFinite(ttm.momentum[89]) && ttm.momentum[89] > 0, 'ttmSqueeze: momentum positive on uptrend expansion');
}

/* ---------------- 5) ichimoku / ichimokuState ---------------- */
{
  const upRows = [], dnRows = [];
  for (let i = 0; i < 100; i++){
    upRows.push({ t:i, o:i-1,   h:i+0.5,     l:i-1.5,     c:i,     v:100 });
    dnRows.push({ t:i, o:201-i, h:201.5-i,   l:199.5-i,   c:200-i, v:100 });
  }
  const su = G.ichimokuState(upRows);
  assert(su.priceVsCloud === 'ABOVE' && su.tkCross === 'BULL' && su.cloudBull === true,
         'ichimokuState: monotonic up => ABOVE/BULL/cloudBull (' + JSON.stringify(su) + ')');
  const sd = G.ichimokuState(dnRows);
  assert(sd.priceVsCloud === 'BELOW' && sd.tkCross === 'BEAR' && sd.cloudBull === false,
         'ichimokuState: monotonic down => BELOW/BEAR/!cloudBull (' + JSON.stringify(sd) + ')');
  const ic = G.ichimoku(upRows, 9, 26, 52);
  approx(ic.tenkan[99], (99.5 + 89.5)/2, 1e-9, 'ichimoku: tenkan = 9-bar midpoint, unshifted');
  assert(G.ichimokuState(flatRows(5, 50, 1, 0)).priceVsCloud === 'INSIDE', 'ichimokuState: no throw on 5 bars');
}

/* ---------------- 6) linregSlope / linregCurve ---------------- */
{
  const lin = []; for (let i = 0; i < 60; i++) lin.push(i*1.0);
  const sl = G.linregSlope(lin, 20), cu = G.linregCurve(lin, 20);
  approx(sl[59], 1, 1e-9, 'linregSlope: slope 1/bar on linear series');
  approx(cu[59], 59, 1e-9, 'linregCurve: fitted value == actual on linear series');
  assert(sl.slice(0,19).every(Number.isNaN), 'linregSlope: NaN until len-1');
}

/* ---------------- 7) zscore ---------------- */
{
  const z = G.zscoreArr(closes, 20), zl = G.zscoreLast(closes, 20);
  assert(zl === z[z.length-1] && isFinite(zl), 'zscoreLast == zscoreArr[n-1]');
  let m = 0; for (let k = 180; k < 200; k++) m += closes[k]; m /= 20;
  let sq = 0; for (let k = 180; k < 200; k++) sq += (closes[k]-m)**2;
  approx(zl, (closes[199]-m)/Math.sqrt(sq/20), 1e-9, 'zscore: matches manual (x-mean)/sd');
  assert(G.zscoreLast([7,7,7,7], 4) === 0, 'zscore: zero-variance window => 0');
}

/* ---------------- 8) correlation / rollingCorr ---------------- */
{
  approx(G.correlation(closes, closes, 50), 1, 1e-12, 'correlation: identical series = 1');
  approx(G.correlation(closes, closes.map(c=>-c), 50), -1, 1e-12, 'correlation: negated series = -1');
  const rc = G.rollingCorr(closes, closes, 50);
  approx(rc[rc.length-1], 1, 1e-12, 'rollingCorr: last value 1 for identical series');
  const noisy = closes.map((c,i)=> c + (mulberry32(i+7)()-0.5)*30);
  const r = G.correlation(closes, noisy, 100);
  assert(r > -1 && r < 1, 'correlation: noisy pair strictly inside (-1,1), got ' + r.toFixed(3));
}

/* ---------------- 9) crossOver / crossUnder / crossedRecently ---------------- */
{
  const up = []; for (let i = 0; i < 100; i++) up.push(i);
  const flat = new Array(100).fill(50);
  const co = G.crossOver(up, flat), cu = G.crossUnder(up, flat);
  assert(co.filter(Boolean).length === 1 && co[51] === true, 'crossOver: fires exactly once (at the crossing bar)');
  assert(cu.filter(Boolean).length === 0, 'crossUnder: never fires on pure up-cross');
  const cu2 = G.crossUnder(flat, up);
  assert(cu2.filter(Boolean).length === 1 && cu2[51] === true, 'crossUnder: mirror series fires once');
  assert(G.crossedRecently(co, 60) === true && G.crossedRecently(co, 5) === false,
         'crossedRecently: true within 60 bars, false within 5');
  const nanA = [NaN, NaN, 1, 2, 3], nanB = [2, 2, 2, 2, 2];
  assert(G.crossOver(nanA, nanB).filter(Boolean).length === 1, 'crossOver: leading NaNs do not fire');
}

/* ---------------- 10) nanEma vs ema ---------------- */
{
  const padded = new Array(15).fill(NaN).concat(closes);
  const ne = G.nanEma(padded, 10);
  const ee = G.ema(closes, 10);
  let maxDiff = 0;
  for (let i = 0; i < 200; i++){
    if (!isFinite(ee[i])) continue;               // skip shared warmup NaNs
    maxDiff = Math.max(maxDiff, Math.abs(ne[i+15] - ee[i]));
  }
  assert(isFinite(maxDiff) && maxDiff < 1e-9, 'nanEma: matches ema on NaN-free tail (maxDiff ' + maxDiff.toExponential(2) + ')');
  assert(ne.slice(0, 15+9).every(Number.isNaN) && isFinite(ne[15+9]), 'nanEma: seeds after p finite values');
  const few = G.nanEma([NaN, 1, NaN, 2], 10);
  assert(few.every(Number.isNaN), 'nanEma: fewer than p finite values => all NaN, no throw');
}

/* ---------------- 11) hgStructure: swings / BOS / CHoCH / trend ---------------- */
function mkC(closesArr, spread){          // rows from closes, symmetric h/l spread
  const s = (spread === undefined) ? 0.4 : spread;
  return closesArr.map(function(c, i){ return { t:i, o:c, h:c+s, l:c-s, c:c, v:1000 }; });
}
function stairCloses(cycles){             // 9-bar cycles; peak close 13+2k @offset3, trough close P-2.1 @offset6
  const cl = [];
  for (let k = 0; k < cycles; k++){
    const P = 13 + 2*k;
    cl.push(P-2.4, P-1.6, P-0.8, P, P-0.7, P-1.4, P-2.1, P-1.7, P-1.2);
  }
  return cl;
}
assert(typeof G.hgStructure === 'function' && typeof G.hgAVWAP === 'function' && typeof G.hgAtrPercentile === 'function',
       'hg exports: hgStructure/hgAVWAP/hgAtrPercentile are functions');
assert(typeof G.hgStructureGate === 'function', 'hgStructureGate exported');
assert(W.hgStructure === G.hgStructure && W.hgAVWAP === G.hgAVWAP && W.hgAtrPercentile === G.hgAtrPercentile,
       'hg exports: same functions attached on window');
{
  // synthetic uptrend: every peak/trough higher; closes keep breaking prior peak highs
  const up = G.hgStructure(mkC(stairCloses(6)));
  assert(up.trend === 'up', 'hgStructure: staircase uptrend => trend up');
  assert(up.lastBOS !== null && up.lastBOS.dir === 'up', 'hgStructure: bullish BOS detected in uptrend');
  approx(up.lastBOS.level, 21.4, 1e-9, 'hgStructure: last BOS level == high of 5th peak (13+2*4 + 0.4)');
  assert(up.lastBOS.i === 47, 'hgStructure: last BOS fires on the close first beyond the level (i=47)');
  assert(up.lastCHoCH === null, 'hgStructure: no CHoCH in a clean uptrend');
  assert(up.swings.length === 11, 'hgStructure: 6 peaks + 5 troughs confirmed (last trough unconfirmed)');
  assert(up.swings.filter(s => s.type === 'HH').length === 6 && up.swings.every(s => s.type === 'HH' || s.type === 'HL'),
         'hgStructure: uptrend swings are all HH/HL');
  assert(up.swings.filter(s => s.type === 'HL').length === 5, 'hgStructure: 5 HL troughs');
  // strictness: close exactly EQUAL to the level must not fire — the next bar does
  const up2 = G.hgStructure(mkC(stairCloses(2)));
  assert(up2.lastBOS !== null && up2.lastBOS.i === 11 && up2.lastBOS.level === up2.swings[0].px,
         'hgStructure: close == level does not fire (i=10), strict break fires at i=11');
}
{
  // converging triangle: LH peaks (13.4/12.8) + HL troughs (9.2/9.8), nothing ever breaks
  const tri = [9.0];
  for (const tgt of [13.0, 9.6, 12.4, 10.2, 11.8]){
    const cur0 = tri[tri.length-1], step = (tgt - cur0)/4;
    for (let k = 1; k <= 4; k++) tri.push(cur0 + step*k);
  }
  const rg = G.hgStructure(mkC(tri));
  assert(rg.trend === 'range', 'hgStructure: converging triangle => trend range');
  assert(rg.lastBOS === null && rg.lastCHoCH === null, 'hgStructure: no breaks inside the triangle');
  assert(rg.swings.length === 4, 'hgStructure: 4 confirmed swings in triangle (final peak unconfirmed)');
  assert(rg.swings.map(s => s.type).join(',') === 'HH,HL,LH,HL', 'hgStructure: triangle labels HH,HL,LH,HL');
  // same triangle + breakout: first break out of 'range' is a BOS that establishes the trend
  const bo = G.hgStructure(mkC(tri.concat([12.4, 13.0, 13.6])));
  assert(bo.trend === 'up', 'hgStructure: breakout from range establishes uptrend');
  assert(bo.lastBOS !== null && bo.lastBOS.dir === 'up' && bo.lastCHoCH === null,
         'hgStructure: first break from range is a BOS, not a CHoCH');
  approx(bo.lastBOS.level, 12.8, 1e-9, 'hgStructure: breakout level == last LH high');
  assert(bo.lastBOS.i === 22, 'hgStructure: level fires once (i=22), later closes above it do not re-fire');
}
{
  // reversal: staircase up, one last push, then a close below the last HL => bearish CHoCH
  const rev = G.hgStructure(mkC(stairCloses(5).concat([20.5, 21.0, 21.5, 22.0, 20.0, 18.8, 17.9])));
  assert(rev.trend === 'down', 'hgStructure: reversal fixture flips trend down');
  assert(rev.lastCHoCH !== null && rev.lastCHoCH.dir === 'down', 'hgStructure: bearish CHoCH detected');
  approx(rev.lastCHoCH.level, 18.5, 1e-9, 'hgStructure: CHoCH level == last HL low');
  assert(rev.lastCHoCH.i === 51, 'hgStructure: CHoCH fires on the first close beyond the opposing swing (i=51)');
  assert(rev.lastBOS !== null && rev.lastBOS.dir === 'up' && rev.lastBOS.i === 47 && rev.lastBOS.i < rev.lastCHoCH.i,
         'hgStructure: final bullish BOS (i=47) precedes the CHoCH');
}
{
  // degenerate / dirty inputs -> safe sentinels, no throw
  const badInputs = [[], null, undefined, 'nope', mkC([10, 11, 12, 11, 10])];
  for (const b of badInputs){
    const st = G.hgStructure(b);
    assert(st && Array.isArray(st.swings) && st.swings.length === 0 && st.lastBOS === null &&
           st.lastCHoCH === null && st.trend === 'range',
           'hgStructure: sentinel on degenerate input (' + (b && b.length) + ')');
  }
  const mono = G.hgStructure(trendRows(30, 50, 1, 1000));
  assert(mono.swings.length === 0 && mono.trend === 'range' && mono.lastBOS === null,
         'hgStructure: monotonic ramp has no pivots => range/nulls');
  const dirty = mkC(stairCloses(4));
  dirty[20] = null;
  dirty[25] = { t:25, o:NaN, h:NaN, l:NaN, c:NaN, v:NaN };
  let threw = false, stD = null;
  try { stD = G.hgStructure(dirty); } catch(e){ threw = true; }
  assert(!threw && stD && Array.isArray(stD.swings) && ['up','down','range'].indexOf(stD.trend) >= 0,
         'hgStructure: null/NaN holes do not throw, output shape stays valid');
  const opt = G.hgStructure(mkC(stairCloses(6)), { left:2, right:2 });
  assert(opt.trend === 'up' && opt.lastBOS !== null && opt.lastBOS.dir === 'up',
         'hgStructure: custom left/right=2 still reads the uptrend');
}

/* ---------------- 12) hgAVWAP ---------------- */
{
  const ar = [
    { t:0, o:10, h:11, l:9,  c:10, v:100 },
    { t:1, o:11, h:12, l:10, c:11, v:200 },
    { t:2, o:12, h:13, l:11, c:12, v:100 },
    { t:3, o:9,  h:10, l:8,  c:9,  v:300 }
  ];
  const av = G.hgAVWAP(ar, 1);
  const ev = (11*200 + 12*100 + 9*300)/600;
  const esd = Math.sqrt((200*(11-ev)*(11-ev) + 100*(12-ev)*(12-ev) + 300*(9-ev)*(9-ev))/600);
  approx(av.value, ev, 1e-9, 'hgAVWAP: hand-computed anchored value (tp=(h+l+c)/3, v-weighted)');
  approx(av.stdev, esd, 1e-9, 'hgAVWAP: hand-computed volume-weighted sigma');
  approx(av.upper, ev + esd, 1e-9, 'hgAVWAP: upper == value + 1 sigma');
  approx(av.lower, ev - esd, 1e-9, 'hgAVWAP: lower == value - 1 sigma');
  approx(G.hgAVWAP(ar, 0).value, 7100/700, 1e-9, 'hgAVWAP: anchor 0 spans all bars');
  const zeroV = ar.map(r => Object.assign({}, r, { v:0 }));
  approx(G.hgAVWAP(zeroV, 0).value, 10.5, 1e-9, 'hgAVWAP: zero total volume => equal weights');
  const dr = ar.map(r => Object.assign({}, r)); dr[1].c = NaN;
  approx(G.hgAVWAP(dr, 0).value, 4900/500, 1e-9, 'hgAVWAP: non-finite typical-price bars are skipped');

  const avE = G.hgAVWAP(rows, 50);
  let mnL = Infinity, mxH = -Infinity;
  for (let k = 50; k < 200; k++){ mnL = Math.min(mnL, rows[k].l); mxH = Math.max(mxH, rows[k].h); }
  assert(avE.value >= mnL - 1e-12 && avE.value <= mxH + 1e-12, 'hgAVWAP: value inside the window high-low envelope');
  assert(avE.lower <= avE.value && avE.value <= avE.upper && avE.stdev >= 0, 'hgAVWAP: bands ordered lower<=value<=upper');
  const rl = rows[199], avL = G.hgAVWAP(rows, 199);
  approx(avL.value, (rl.h + rl.l + rl.c)/3, 1e-9, 'hgAVWAP: anchor on last bar == its typical price');
  assert(avL.stdev === 0 && avL.upper === avL.lower, 'hgAVWAP: single-bar window has zero sigma');
  const avBad = G.hgAVWAP(rows, 999);
  assert(Number.isNaN(avBad.value) && Number.isNaN(avBad.upper) && Number.isNaN(avBad.lower) && Number.isNaN(avBad.stdev),
         'hgAVWAP: anchor beyond data => all-NaN sentinel');
  assert(Number.isNaN(G.hgAVWAP([], 0).value) && Number.isNaN(G.hgAVWAP(null, 0).value),
         'hgAVWAP: empty/null input => NaN sentinel, no throw');
}

/* ---------------- 13) hgAtrPercentile ---------------- */
{
  const spike = flatRows(59, 50, 1, 0);
  spike.push({ t:59, o:50, h:80, l:20, c:55, v:1000 });
  approx(G.hgAtrPercentile(spike, 14, 100), 100, 1e-9, 'hgAtrPercentile: vol-spike bar ranks ~100');
  approx(G.hgAtrPercentile(flatRows(60, 50, 1, 0), 14, 100), 0, 1e-9, 'hgAtrPercentile: flat ATR series ranks ~0');
  function volRamp(n, d0, dd){
    const r = [];
    for (let i = 0; i < n; i++){ const d = d0 + dd*i; r.push({ t:i, o:50, h:50+d/2, l:50-d/2, c:50, v:1000 }); }
    return r;
  }
  approx(G.hgAtrPercentile(volRamp(80, 0.5, 0.05), 14, 100), 100, 1e-9, 'hgAtrPercentile: strictly rising volatility ranks 100');
  approx(G.hgAtrPercentile(volRamp(80, 3, -0.03), 14, 100), 0, 1e-9, 'hgAtrPercentile: strictly falling volatility ranks 0');
  // replication of the documented convention: 100 * (# strictly below current) / (m-1)
  const atrArr = G.atr(rows, 14), finiteA = atrArr.filter(isFinite);
  const mA = Math.min(100, finiteA.length), curA = finiteA[finiteA.length-1];
  let belowA = 0;
  for (let k = finiteA.length - mA; k < finiteA.length - 1; k++){ if (finiteA[k] < curA) belowA++; }
  approx(G.hgAtrPercentile(rows, 14, 100), 100*belowA/(mA-1), 1e-9, 'hgAtrPercentile: matches manual strict-below/(m-1) math');
  const pMain = G.hgAtrPercentile(rows, 14, 100);
  assert(isFinite(pMain) && pMain >= 0 && pMain <= 100, 'hgAtrPercentile: result inside [0,100]');
  assert(isFinite(G.hgAtrPercentile(rows)), 'hgAtrPercentile: default len/lookback (14/100) computable');
  assert(Number.isNaN(G.hgAtrPercentile([], 14, 100)) && Number.isNaN(G.hgAtrPercentile(null, 14, 100)),
         'hgAtrPercentile: NaN on empty/null input');
  assert(Number.isNaN(G.hgAtrPercentile(flatRows(10, 50, 1, 0), 14, 100)),
         'hgAtrPercentile: NaN when fewer than 2 finite ATR values exist');
}

/* ---------------- summary ---------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL INDICATORS2 TESTS PASSED');
