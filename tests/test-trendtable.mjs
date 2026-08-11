/* HARDGATE — trendtable.js unit tests (Node 18+, no network).
   Loads indicators.js + indicators2.js + trendtable.js as classic scripts in a
   shared vm context (same as the browser's <script> globals) and asserts the
   pure window.trendScore classifier across every branch:
     - each component in each state (-1/0/+1)
     - fresh GOLDEN / DEATH cross detection incl. the 10-bar recency boundary
     - ADX >= 25 strength-point threshold incl. zero trend-sum deadzone
     - null / empty / NaN-poisoned / short inputs
   Run: node tests/test-trendtable.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = ctx; // browser-style global alias the module registers onto
for (const f of ['indicators.js', 'indicators2.js', 'setup-stack.js', 'desk-scan-universe.js', 'trendtable.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = ctx;

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- deterministic row builders ---------------- */
function mkRows(closes, t0){
  const rows = [];
  let prev = closes[0];
  for (let i = 0; i < closes.length; i++){
    const c = closes[i], o = prev;
    rows.push({ t: (t0 || 0) + i * 86400, o: o,
                h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c: c, v: 1000 });
    prev = c;
  }
  return rows;
}
function lin(n, start, step){
  const a = [];
  for (let i = 0; i < n; i++) a.push(start + i * step);
  return a;
}

/* ---------------- 0) module registration ---------------- */
{
  assert(typeof G.trendScore === 'function', 'window.trendScore exported as a function');
  assert(Array.isArray(G.HG_tabs) && G.HG_tabs.length === 1, 'HG_tabs registered exactly once');
  const tab = G.HG_tabs[0];
  assert(tab && tab.id === 'trendmx' && tab.label === 'TREND MATRIX' && typeof tab.mount === 'function',
         'tab registration shape {id:trendmx, label:TREND MATRIX, mount}');
}

/* ---------------- shared fixtures ---------------- */
const up1  = mkRows(lin(260, 100, 1));      // monotonic 1d uptrend
const up4  = mkRows(lin(120, 50, 0.5));     // monotonic 4h uptrend
const dn1  = mkRows(lin(260, 400, -1));     // monotonic 1d downtrend
const dn4  = mkRows(lin(120, 100, -0.5));   // monotonic 4h downtrend
const flat1 = mkRows(lin(260, 100, 0));     // pinned 1d closes
const flat4 = mkRows(lin(120, 50, 0));      // pinned 4h closes

/* ---------------- 1) strong long: every component +1, score +5 ---------------- */
{
  const r = G.trendScore(up1, up4);
  assert(r.score === 5, 'strong long: composite +5 (got ' + r.score + ')');
  assert(r.comps.d1Trend === 1, 'strong long: close > ema200 => +1');
  assert(r.comps.d1Cross === 1, 'strong long: ema50 > ema200 => +1');
  assert(r.comps.h4Cascade === 1, 'strong long: 4h full align => +1');
  assert(r.comps.cloud === 1, 'strong long: price ABOVE cloud => +1');
  assert(r.comps.adxPt === 1, 'strong long: adx>=25 with positive trend-sum => +1');
  assert(isFinite(r.adx) && r.adx >= 25, 'strong long: adx >= 25 (got ' + r.adx.toFixed(1) + ')');
  assert(r.freshCross === null, 'strong long: steady trend has no fresh cross');
}

/* ---------------- 2) strong short: every component -1, score -5 ---------------- */
{
  const r = G.trendScore(dn1, dn4);
  assert(r.score === -5, 'strong short: composite -5 (got ' + r.score + ')');
  assert(r.comps.d1Trend === -1, 'strong short: close < ema200 => -1');
  assert(r.comps.d1Cross === -1, 'strong short: ema50 < ema200 => -1');
  assert(r.comps.h4Cascade === -1, 'strong short: 4h full inverse => -1');
  assert(r.comps.cloud === -1, 'strong short: price BELOW cloud => -1');
  assert(r.comps.adxPt === -1, 'strong short: adx>=25 with negative trend-sum => -1');
  assert(isFinite(r.adx) && r.adx >= 25, 'strong short: adx >= 25 (got ' + r.adx.toFixed(1) + ')');
  assert(r.freshCross === null, 'strong short: steady trend has no fresh cross');
}

/* ---------------- 3) flat market: everything 0, adx NaN ---------------- */
{
  const r = G.trendScore(flat1, flat4);
  assert(r.score === 0, 'flat: composite 0 (got ' + r.score + ')');
  assert(r.comps.d1Trend === 0, 'flat: close == ema200 => 0 (strict inequality deadzone)');
  assert(r.comps.d1Cross === 0, 'flat: ema50 == ema200 => 0');
  assert(r.comps.h4Cascade === 0, 'flat: e9 == e21 == e50 => 0 (no strict alignment)');
  assert(r.comps.cloud === 0, 'flat: price INSIDE degenerate cloud => 0');
  assert(r.comps.adxPt === 0, 'flat: zero DM => adx NaN => no strength point');
  assert(Number.isNaN(r.adx), 'flat: adx is NaN (zero +DM/-DM), not thrown');
  assert(r.freshCross === null, 'flat: no cross event');
}

/* ---------------- 4) fresh GOLDEN cross + 10/11-bar recency boundary ---------------- */
{
  // 240 bars of decline (ema50 < ema200), then a sharp rally that crosses up
  const cxDn = lin(240, 300, -0.8);                 // 300 -> 108.8
  const cxUp = [];
  for (let i = 1; i <= 80; i++) cxUp.push(108.8 + i * 2.5);
  const cxAll = cxDn.concat(cxUp);                  // 320 bars
  const co = G.crossOver(G.ema(cxAll, 50), G.ema(cxAll, 200));
  const gi = co.lastIndexOf(true);
  assert(gi > 0, 'golden fixture: ema50 crosses above ema200 (index ' + gi + ')');
  const cxRows = mkRows(cxAll);

  const r5 = G.trendScore(cxRows.slice(0, gi + 1 + 5), up4);   // cross 5 bars ago
  assert(r5.freshCross === 'GOLDEN', 'golden: detected 5 bars after the cross');
  assert(r5.comps.d1Cross === 1, 'golden: ema50 > ema200 right after cross');
  const r9 = G.trendScore(cxRows.slice(0, gi + 1 + 9), up4);   // cross 9 bars ago
  assert(r9.freshCross === 'GOLDEN', 'golden boundary: cross 9 bars old is still fresh (last-10-bars window)');
  const r10 = G.trendScore(cxRows.slice(0, gi + 1 + 10), up4); // cross 10 bars ago
  assert(r10.freshCross === null, 'golden boundary: cross 10 bars old falls out of the 10-bar window');
}

/* ---------------- 5) fresh DEATH cross + recency expiry ---------------- */
{
  const dxUp = lin(240, 100, 0.8);                  // 100 -> 291.2
  const dxDn = [];
  for (let i = 1; i <= 80; i++) dxDn.push(291.2 - i * 2.5);
  const dxAll = dxUp.concat(dxDn);
  const cu = G.crossUnder(G.ema(dxAll, 50), G.ema(dxAll, 200));
  const di = cu.lastIndexOf(true);
  assert(di > 0, 'death fixture: ema50 crosses below ema200 (index ' + di + ')');
  const dxRows = mkRows(dxAll);

  const r5 = G.trendScore(dxRows.slice(0, di + 1 + 5), dn4);
  assert(r5.freshCross === 'DEATH', 'death: detected 5 bars after the cross');
  assert(r5.comps.d1Cross === -1, 'death: ema50 < ema200 right after cross');
  const r10 = G.trendScore(dxRows.slice(0, di + 1 + 10), dn4);
  assert(r10.freshCross === null, 'death boundary: cross 10 bars old falls out of the 10-bar window');
}

/* ---------------- 6) 4h cascade branches ---------------- */
{
  const rInv = G.trendScore(up1, dn4);              // bullish 1d, inverse 4h
  assert(rInv.comps.h4Cascade === -1, 'cascade: full inverse => -1');
  assert(rInv.score === 3, 'cascade flip reflected in score (+5-2 = +3, got ' + rInv.score + ')');

  // genuinely mixed: long decline then a short sharp rally => e9 > e21 but e21 < e50
  const mix = lin(150, 200, -0.7).concat(lin(10, 97.7, 2));
  const c4 = mix;
  const i4 = c4.length - 1;
  const e9 = G.ema(c4, 9)[i4], e21 = G.ema(c4, 21)[i4], e50 = G.ema(c4, 50)[i4];
  const aligned = (e9 > e21 && e21 > e50) || (e9 < e21 && e21 < e50);
  assert(!aligned, 'mixed fixture: genuinely non-aligned (e9 ' + e9.toFixed(2) +
                   ', e21 ' + e21.toFixed(2) + ', e50 ' + e50.toFixed(2) + ')');
  const rMix = G.trendScore(up1, mkRows(mix));
  assert(rMix.comps.h4Cascade === 0, 'cascade: non-aligned => 0');

  const rNo4 = G.trendScore(up1, []);
  assert(rNo4.comps.h4Cascade === 0 && rNo4.score === 4, 'missing 4h rows => cascade 0, rest intact');
  const short4 = mkRows(lin(30, 50, 0.5));          // < 50 bars => ema50 NaN
  const rSh4 = G.trendScore(up1, short4);
  assert(rSh4.comps.h4Cascade === 0, 'short 4h rows (<50 bars) => cascade 0');
}

/* ---------------- 7) short 1d rows: ema200-based comps neutral, rest works ---------------- */
{
  const short1 = mkRows(lin(100, 100, 1));          // 100 bars: no ema200, cloud+adx fine
  const r = G.trendScore(short1, up4);
  assert(r.comps.d1Trend === 0, 'short 1d (<200 bars): close-vs-ema200 => 0');
  assert(r.comps.d1Cross === 0, 'short 1d (<200 bars): ema50-vs-ema200 => 0');
  assert(r.comps.h4Cascade === 1, 'short 1d: 4h cascade still computed');
  assert(r.comps.cloud === 1, 'short 1d (>=52 bars): cloud still computed');
  assert(r.score === r.comps.h4Cascade + r.comps.cloud + r.comps.adxPt,
         'short 1d: score consistent with components');
}

/* ---------------- 8) degenerate inputs: null / empty / NaN-poisoned ---------------- */
{
  const z = G.trendScore(null, null);
  assert(z.score === 0 && z.freshCross === null && Number.isNaN(z.adx),
         'null inputs => zero result, no throw');
  assert(z.comps.d1Trend === 0 && z.comps.d1Cross === 0 && z.comps.h4Cascade === 0 &&
         z.comps.cloud === 0 && z.comps.adxPt === 0, 'null inputs => all components 0');

  const ze = G.trendScore([], []);
  assert(ze.score === 0 && ze.freshCross === null, 'empty arrays => zero result, no throw');

  const nanRows = mkRows(lin(260, 100, 1)).map(function(r){
    return { t: r.t, o: NaN, h: NaN, l: NaN, c: NaN, v: NaN };
  });
  const zn = G.trendScore(nanRows, nanRows);
  assert(zn.score === 0 && zn.freshCross === null && Number.isNaN(zn.adx),
         'NaN-poisoned rows => zero result, no throw');

  const zu = G.trendScore(undefined, undefined);
  assert(zu.score === 0, 'undefined inputs => zero result, no throw');
}

/* ---------------- 9) ADX 25 threshold: below / at, plus zero trend-sum deadzone ---------------- */
{
  // damped sine over a gentle drift: two-sided DM early (adx ~10), trend takes
  // over as the wiggle decays => adx climbs gradually through the 25 threshold
  const choppy = [];
  for (let i = 0; i < 300; i++) choppy.push(100 + 0.15 * i + 3 * Math.sin(i * 0.9) * Math.exp(-i / 60));
  const chRows = mkRows(choppy);
  const adxArr = G.adx(chRows, 14).adx;
  let b = -1;
  for (let i = 1; i < adxArr.length; i++){
    if (isFinite(adxArr[i]) && adxArr[i] >= 25 && isFinite(adxArr[i-1]) && adxArr[i-1] < 25){ b = i; break; }
  }
  assert(b > 0, 'adx fixture: crosses the 25 threshold at index ' + b);

  const rBelow = G.trendScore(chRows.slice(0, b), up4);       // last bar = b-1, adx < 25
  assert(isFinite(rBelow.adx) && rBelow.adx < 25 && rBelow.comps.adxPt === 0,
         'adx just below 25 => no strength point (adx ' + rBelow.adx.toFixed(2) + ')');

  const rAt = G.trendScore(chRows.slice(0, b + 1), up4);      // last bar = b, adx >= 25
  const sum4 = rAt.comps.d1Trend + rAt.comps.d1Cross + rAt.comps.h4Cascade + rAt.comps.cloud;
  assert(isFinite(rAt.adx) && rAt.adx >= 25 && rAt.comps.adxPt === (sum4 > 0 ? 1 : (sum4 < 0 ? -1 : 0)),
         'adx >= 25 => signed strength point (adx ' + rAt.adx.toFixed(2) + ', sum ' + sum4 + ')');

  // adx >= 25 but the four trend components cancel to 0 => deadzone, adxPt 0
  const tiny1 = mkRows(lin(45, 100, 1));   // <52 bars: cloud INSIDE; <200: d1 comps 0; flat4: cascade 0
  const rTiny = G.trendScore(tiny1, flat4);
  assert(isFinite(rTiny.adx) && rTiny.adx >= 25 && rTiny.comps.adxPt === 0,
         'adx >= 25 with zero trend-sum => adxPt 0 (adx ' + rTiny.adx.toFixed(1) + ')');
  assert(rTiny.score === 0, 'zero trend-sum deadzone => score 0 despite high adx');
}

/* ---------------- 9b) gate eval + formation exports ---------------- */
{
  assert(typeof G.trendmxGateEval === 'function', 'trendmxGateEval exported');
  assert(typeof G.trendmxClassify === 'function', 'trendmxClassify exported');
  var cls = G.trendmxClassify({ score: 4, comps: { d1Trend: 1, d1Cross: 1, h4Cascade: 1, cloud: 0, adxPt: 1 }, rows4h: up4 }, 'long');
  assert(cls && cls.dir === 'long' && cls.longEv.length >= 3, 'classify builds long evidence from components');
  var gateOnly = G.trendmxGateEval({ sym: 'TEST', rows4h: up4, price: up4[up4.length - 1].c }, 'long');
  assert(gateOnly === null || typeof gateOnly.label === 'string', 'gate eval returns label object or null without cryptogates');
}

/* ---------------- 10) window.trendmxPlan: universal SL/TP levels ---------------- */
{
  assert(typeof G.trendmxPlan === 'function', 'window.trendmxPlan exported as a function');
  assert(typeof G.trendmxPlanHTML === 'function', 'window.trendmxPlanHTML exported as a function');
  assert(typeof G.trendmxPlanBlock === 'function', 'window.trendmxPlanBlock exported as a function');
  assert(typeof G.smartSetup !== 'function', 'premise: smartSetup absent in this context -> house fallback path');

  const a4 = G.atr(up4, 14)[up4.length - 1];
  assert(isFinite(a4) && a4 > 0, 'premise: 4h ATR14 computable on up4 (' + a4.toFixed(3) + ')');

  /* direction from the row's own majority score — long */
  const pl = G.trendmxPlan({ score: 5, rows4h: up4 });
  assert(pl && pl.dir === 'long', 'score +5 -> long plan');
  assert(pl.entry === up4[up4.length - 1].c, 'long: entry = last 4h close');
  assert(pl.stop < pl.entry, 'long: stop below entry');
  assert(Math.abs(pl.stop - (pl.entry - 1.5 * a4)) < 1e-9, 'long: far structure -> stop = entry - 1.5×ATR');
  assert(Math.abs(pl.t1 - (pl.entry + 2 * (pl.entry - pl.stop))) < 1e-9, 'long: T1 = entry + 2R exactly');
  assert(Math.abs(pl.t2 - (pl.entry + 3.5 * (pl.entry - pl.stop))) < 1e-9, 'long: T2 = entry + 3.5R exactly');
  assert(pl.t1 > pl.entry && pl.t2 > pl.t1, 'long: T1 above entry, T2 beyond T1');

  /* short */
  const a4d = G.atr(dn4, 14)[dn4.length - 1];
  const ps = G.trendmxPlan({ score: -5, rows4h: dn4 });
  assert(ps && ps.dir === 'short', 'score -5 -> short plan');
  assert(ps.stop > ps.entry, 'short: stop above entry');
  assert(Math.abs(ps.stop - (ps.entry + 1.5 * a4d)) < 1e-9, 'short: stop = entry + 1.5×ATR');
  assert(Math.abs(ps.t1 - (ps.entry - 2 * (ps.stop - ps.entry))) < 1e-9, 'short: T1 = entry - 2R exactly');
  assert(Math.abs(ps.t2 - (ps.entry - 3.5 * (ps.stop - ps.entry))) < 1e-9, 'short: T2 = entry - 3.5R exactly');
  assert(ps.t1 < ps.entry && ps.t2 < ps.t1, 'short: T1 below entry, T2 beyond T1');

  /* explicit dir wins over the score */
  const pd = G.trendmxPlan({ dir: 'short', score: 5, rows4h: up4 });
  assert(pd && pd.dir === 'short' && pd.stop > pd.entry, 'explicit dir overrides the score majority');

  /* majority deadzone + boundaries */
  assert(G.trendmxPlan({ score: 1, rows4h: up4 }) === null, 'score +1 (below majority band) -> null');
  assert(G.trendmxPlan({ score: -1, rows4h: up4 }) === null, 'score -1 -> null');
  assert(G.trendmxPlan({ score: 2, rows4h: up4 }) !== null, 'boundary: score +2 -> long plan');
  assert(G.trendmxPlan({ score: -2, rows4h: up4 }) !== null, 'boundary: score -2 -> short plan');
  assert(G.trendmxPlan({ score: 0, rows4h: up4 }) === null, 'score 0 (flat) -> null, no direction fabricated');
  assert(G.trendmxPlan({ rows4h: up4 }) === null, 'no score and no dir -> null');
  assert(G.trendmxPlan(null) === null, 'null input -> null, no throw');
  assert(G.trendmxPlan({ score: 5 }) === null, 'missing rows4h -> null (levels unavailable)');
  assert(G.trendmxPlan({ score: 5, rows4h: [] }) === null, 'empty rows4h -> null');

  /* NaN-safe when ATR is missing */
  const nan4 = up4.map(function(r){ return { t: r.t, o: NaN, h: NaN, l: NaN, c: NaN, v: NaN }; });
  assert(G.trendmxPlan({ score: 5, rows4h: nan4 }) === null, 'NaN-poisoned 4h rows -> null, no fabricated levels');
  const zero4 = up4.map(function(r){ return { t: r.t, o: 50, h: 50, l: 50, c: 50, v: r.v }; }); // pinned -> TR 0 -> ATR 0
  assert(G.trendmxPlan({ score: 5, rows4h: zero4 }) === null, 'zero-range rows (ATR 0) -> null');
  const keepAtr = G.atr; G.atr = undefined;
  assert(G.trendmxPlan({ score: 5, rows4h: up4 }) === null, 'atr global missing -> null, no throw');
  G.atr = keepAtr;

  /* structure stop path via hgBestLevels (unified lookback 20) */
  const rowsLS = mkRows(lin(90, 50, 0.5).concat(lin(30, 95, 0)));
  const pLS = G.trendmxPlan({ score: 4, rows4h: rowsLS });
  assert(pLS && isFinite(pLS.stop) && isFinite(pLS.t1),
         'hgBestLevels produces valid plan on structure rows');
  const riskLS = Math.abs(pLS.entry - pLS.stop);
  assert(riskLS > 0 && Math.abs(pLS.t1 - pLS.entry) / riskLS >= 1.99, 'structure plan: min ~2R');

  /* smartSetup preference (legacy path when hgBestLevels absent) */
  const keepBL = G.hgBestLevels;
  G.hgBestLevels = undefined;
  const fakeS = { type:'SWING', dir:'long', entry:50, stop:48, t1:54, t2:57, rr1:2, rr2:3.5, riskPct:4, confirmed:true, note:'stub' };
  G.smartSetup = function(){ return fakeS; };
  assert(G.trendmxPlan({ score: 5, rows4h: up4 }) === fakeS, 'smartSetup preferred when it returns a valid plan');
  G.smartSetup = function(){ return null; };
  assert(G.trendmxPlan({ score: 5, rows4h: up4 }).type === 'ATR', 'smartSetup declining -> house fallback');
  G.smartSetup = function(){ throw new Error('x'); };
  assert(G.trendmxPlan({ score: 5, rows4h: up4 }) !== null, 'smartSetup throwing -> fallback survives, never throws');
  G.hgBestLevels = keepBL;
  delete G.smartSetup;

  /* markup: expandable-row plan block */
  const rowObj = { sym:'FAKEUSDT', score:5, comps:{ d1Trend:1, d1Cross:1, h4Cascade:1, cloud:1, adxPt:1 },
                   freshCross:null, adx:30, price: up4[up4.length - 1].c, rows4h: up4, rows1h: null };
  const blk = G.trendmxPlanBlock(rowObj);
  assert(blk.indexOf('<div class="plan">') === 0, 'plan block uses the shared .plan container');
  assert(/ENTRY <b>/.test(blk), 'block contains ENTRY level');
  assert(/STOP <b>/.test(blk), 'block contains STOP level');
  assert(blk.indexOf('T1') !== -1 && blk.indexOf('T2') !== -1, 'block contains T1 and T2 labels');
  assert(/\(2(\.0)?R\)/.test(blk) && /\(3\.5R\)/.test(blk), 'block shows 2R / 3.5R multiples');
  assert(blk.indexOf('FAKEUSDT') !== -1 && blk.indexOf('LONG') !== -1, 'block names the symbol and direction');
  const blkS = G.trendmxPlanBlock({ sym:'FAKEUSDT', score:-5, comps:{}, rows4h: dn4 });
  assert(blkS.indexOf('SHORT') !== -1 && /STOP <b>/.test(blkS), 'short row block: direction + STOP level');
  const blkFlat = G.trendmxPlanBlock({ sym:'FAKEUSDT', score:0, comps:{}, rows4h: up4 });
  assert(blkFlat.indexOf('No majority direction') !== -1 && blkFlat.indexOf('STOP <b>') === -1,
         'no-majority row -> honest note, no levels');
  const blkNoRows = G.trendmxPlanBlock({ sym:'FAKEUSDT', score:5, comps:{} });
  assert(blkNoRows.indexOf('levels unavailable') !== -1, 'uncached 4h rows -> levels unavailable note');
  assert(blkNoRows.indexOf('SEND TO TRADE PLAN') === -1, 'no trade handoff without a plan');
  G.toTrade = function(){};
  const blkT = G.trendmxPlanBlock(rowObj);
  assert(blkT.indexOf('SEND TO TRADE PLAN') !== -1 && blkT.indexOf('toTrade(&quot;FAKEUSDT&quot;') !== -1,
         'toTrade present -> SEND TO TRADE PLAN button, sym escaped');
  assert(blkT.indexOf('hg-stack-row') >= 0, 'plan block renders FTS row when setup-stack loaded');
  delete G.toTrade;
}

/* ---------------- 10b) golden-cross alert rows ---------------- */
{
  assert(typeof G.trendmxGoldenCrossSetups === 'function', 'trendmxGoldenCrossSetups exported');
  assert(typeof G.trendmxConviction === 'function', 'trendmxConviction exported');
  const cxDn = lin(240, 300, -0.8);
  const cxUp = [];
  for (let i = 1; i <= 80; i++) cxUp.push(108.8 + i * 2.5);
  const cxAll = cxDn.concat(cxUp);
  const gi = G.crossOver(G.ema(cxAll, 50), G.ema(cxAll, 200)).lastIndexOf(true);
  const cxRows = mkRows(cxAll);
  const ts = G.trendScore(cxRows.slice(0, gi + 1 + 5), up4);
  const row = { sym: 'GOLDUSDT', score: ts.score, comps: ts.comps, freshCross: ts.freshCross,
    adx: ts.adx, price: cxRows[cxRows.length - 1].c, rows4h: up4, rows1h: null };
  assert(ts.freshCross === 'GOLDEN', 'fixture row has fresh golden cross');
  const conv = G.trendmxConviction(row);
  assert(conv && conv.label, 'conviction label for golden row');
  const setups = G.trendmxGoldenCrossSetups([row]);
  assert(setups.length >= 1, 'golden cross row yields at least one alert setup');
  assert(setups[0].entry && setups[0].stop && setups[0].t1, 'setup has entry/stop/t1');
  assert(setups[0].dir === 'long', 'golden cross setup is long');
  const flat = G.trendmxGoldenCrossSetups([{ sym: 'X', score: 0, freshCross: null, comps: {}, rows4h: up4 }]);
  assert(flat.length === 0, 'non-golden rows produce no alert setups');
}

/* ---------------- 11) HARD REFRESH contract: refresh field + status paths ---------------- */
{
  const __unhandled = [];
  process.on('unhandledRejection', function(e){ __unhandled.push(e); });

  const tab = G.HG_tabs[0];
  assert(typeof tab.refresh === 'function',
         'refresh: HG_tabs registration exposes refresh() as the 4th field (id/label/mount/refresh)');

  /* minimal fake DOM — only the surface mountTrendMatrix/runScan touch */
  function tmFakeNode(sel){
    return { id: sel, innerHTML: '', textContent: '', className: '', disabled: false,
             style: {}, firstElementChild: { style: {} }, _click: null,
             addEventListener(ev, fn){ if (ev === 'click') this._click = fn; },
             querySelector(){ return null; }, querySelectorAll(){ return []; } };
  }
  function tmFakeEl(){
    return { innerHTML: '', _nodes: {},
             querySelector(sel){ if (!this._nodes[sel]) this._nodes[sel] = tmFakeNode(sel); return this._nodes[sel]; },
             querySelectorAll(){ return []; } };
  }

  /* stub the binance data layer the scan consumes (counted, no network) */
  let uniCalls = 0;
  G.binancePerpUniverse = async function(){ uniCalls++; return ['AAAUSDT', 'BBBUSDT']; };
  G.binanceTickers24h   = async function(){ return { AAAUSDT: { turnoverUsd: 50e6 }, BBBUSDT: { turnoverUsd: 30e6 } }; };
  const rows1d = mkRows(lin(260, 100, 1)), rows4h = mkRows(lin(120, 50, 0.5));
  G.binanceKlines = async function(sym, tf){ return tf === '1d' ? rows1d : rows4h; };

  /* (c) never run -> skip honestly, and NEVER trigger a first-time universe scan */
  let r = await tab.refresh();
  assert(r === 'skipped: not run yet', 'refresh before mount -> "skipped: not run yet" (got "' + r + '")');
  assert(uniCalls === 0, 'refresh before first run fires no universe fetch (no first-time scan from a global refresh)');

  /* mounted but never scanned -> still skip, still no fetch */
  const el = tmFakeEl();
  tab.mount(el);
  const btn = el._nodes['[data-r="run"]'], status = el._nodes['[data-r="status"]'], out = el._nodes['[data-r="out"]'];
  assert(!!btn && typeof btn._click === 'function', 'refresh fixture: mount wires the RUN SCAN button');
  r = await tab.refresh();
  assert(r === 'skipped: not run yet' && uniCalls === 0,
         'refresh after mount but before first RUN -> still skipped, no fetch');

  /* operator runs one scan, then refresh re-runs it exactly once */
  btn._click();
  let settled = false;
  for (let i = 0; i < 200; i++){
    const t = status.textContent || '';
    if (t.indexOf('scanned') > -1 || t.indexOf('Scan failed') > -1){ settled = true; break; }
    await new Promise(res => setTimeout(res, 25));
  }
  assert(settled && uniCalls === 1 && out.innerHTML.indexOf('AAAUSDT') > -1,
         'fixture: manual RUN completes one universe fetch and renders the matrix');
  r = await tab.refresh();
  assert(r === 'refreshed' && uniCalls === 2,
         'refresh after a completed scan -> "refreshed", exactly one new universe fetch (calls ' + uniCalls + ')');
  assert(out.innerHTML.indexOf('AAAUSDT') > -1, 'refresh re-renders the matrix rows');

  /* busy guard: a second refresh while one is scanning must not double-fetch */
  G.binanceKlines = function(sym, tf){
    return new Promise(function(res){ setTimeout(function(){ res(tf === '1d' ? rows1d : rows4h); }, 40); });
  };
  const p1 = tab.refresh();              /* starts a scan (slow klines keep it in flight) */
  const rBusy = await tab.refresh();     /* must refuse to overlap */
  const rDone = await p1;
  assert(rBusy === 'busy', 'refresh while a scan is in flight -> "busy" (got "' + rBusy + '")');
  assert(rDone === 'refreshed' && uniCalls === 3,
         'the in-flight refresh itself completes -> "refreshed", no double-fetch (calls ' + uniCalls + ')');

  /* never throws: a failing data layer is reported in the tab, not rejected */
  G.binancePerpUniverse = async function(){ uniCalls++; throw new Error('universe down'); };
  let threw = null, rErr = null;
  try { rErr = await tab.refresh(); } catch(e){ threw = e; }
  assert(!threw && typeof rErr === 'string',
         'refresh never rejects — failing data layer still returns a status string (got "' + rErr + '")');
  assert((status.textContent || '').indexOf('Scan failed') > -1,
         'the scan failure surfaces honestly in the tab status line');

  /* missing data layer: a second, deps-less context -> honest skip, no fabricated scan */
  const ctx2 = vm.createContext(Object.create(null));
  ctx2.window = ctx2;
  for (const f of ['indicators.js', 'indicators2.js', 'desk-scan-universe.js', 'trendtable.js']){
    vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx2, { filename: f });
  }
  const tab2 = ctx2.HG_tabs[0];
  let r2 = await tab2.refresh();
  assert(r2 === 'skipped: not run yet', 'second context, pre-mount -> "skipped: not run yet" (got "' + r2 + '")');
  tab2.mount(tmFakeEl());
  r2 = await tab2.refresh();
  assert(r2 === 'skipped: data layer missing',
         'mounted without universe backend -> "skipped: data layer missing" (got "' + r2 + '")');

  await new Promise(res => setTimeout(res, 100));
  assert(__unhandled.length === 0, 'no unhandled rejections on any refresh path');
}

/* ---------------- wiring + cache ---------------- */
{
  const tt = readFileSync(path.join(root, 'trendtable.js'), 'utf8');
  assert(/trendmxGateEval/.test(tt), 'trend matrix gate eval wired');
  assert(/hgFormTicket/.test(tt), 'trend matrix formation ticket path');
  assert(/label: 'GATES'/.test(tt), 'GATES column in matrix table');
  assert(/hgDeskLoadUniverse/.test(tt), 'full universe via hgDeskLoadUniverse');
  assert(/fetchK\(item, '1h', 120\)/.test(tt), 'scan fetches 1h klines for exact entry');
  assert(/data-v="delta"/.test(tt), 'venue filter chips wired');
  assert(/GOLDEN CROSS DESK/.test(tt), 'golden cross desk wired');
  assert(/LIMIT BOARD/.test(tt), 'limit board wired');
  assert(/data-r="cards"/.test(tt), 'clean ticket cards mount');
  assert(/hgPaintTrendmxFromSnap/.test(tt), 'snap restore export wired');
  assert(/trendmxDesk/.test(readFileSync(path.join(root, 'setup-ui.js'), 'utf8')), 'trendmx desk in setup-ui');
  const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert(/hg-v254/.test(sw), 'cache hg-v254');
  assert(/desk-scan-universe\.js/.test(readFileSync(path.join(root, 'index.html'), 'utf8')), 'desk-scan-universe script wired');
}

/* ---------------- summary ---------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL TRENDTABLE TESTS PASSED');
