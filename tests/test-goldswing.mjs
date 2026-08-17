/* HARDGATE — goldswing.js unit tests (Node 18+, builtins only, zero network).
   Loads goldind.js + goldswing.js as classic scripts via vm.runInThisContext
   with globalThis.window = {} (mirrors the browser's script globals), exactly
   the tests/test-goldscalp.mjs harness style. fetch/localStorage/Date.now are
   stubbed; no live network anywhere.

   Covers: tab + warmup registration; bare-environment never-throws; each of
   the 4 swing strategies firing AND not firing (4h EMA50/200 trend pullback,
   weekly-range sweep-reclaim + displacement break, 4h order-block retest,
   macro-aligned continuation — incl. macro never fabricating a setup); the
   confluence tally (exact math per leg) + MOST PROBABLE selection; swing
   risk math (stop 1.5–2×ATR anchored beyond structure, targets 1.5R/2.5R/4R);
   the conviction-lock lifecycle (lock -> verbatim re-confirm -> STOPPED /
   TARGET HIT / EXPIRED after 5 days) against the latest 4h close; the
   goldswingState()/goldswingScan() contract shapes; the honest empty state;
   the Delta second venue; and the index.html / sw.js scoped wiring edits.
   Run: node tests/test-goldswing.mjs */

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

/* ---------------- harness helpers ---------------- */
function loadEnv(withGoldind){
  globalThis.window = {};
  if (withGoldind !== false)
    vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'conviction-lock.js', 'utf8'), { filename: 'conviction-lock.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldswing.js', 'utf8'), { filename: 'goldswing.js' });
  return globalThis.window;
}
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
function memLocalStorage(){
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; },
           _map: m };
}
function loadConvictionStore(ls){
  const raw = ls.getItem('hgGoldswingConviction');
  return raw ? JSON.parse(raw) : null;
}
function cloneRows(rows){ return rows.map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v })); }

const DAY = Date.UTC(2024, 0, 15, 0, 0, 0)/1000;             // a Monday, 00:00 GMT
const H4 = 4*3600;
const MAR_NOW = Date.UTC(2024, 2, 20, 14, 30, 0);           // March -> season NEUTRAL
const JAN_NOW = Date.UTC(2024, 0, 16, 14, 30, 0);           // January -> season STRONG

function flatRows(n, base, spread, t0, stepT){
  const r = [];
  for (let i = 0; i < n; i++) r.push({ t: t0 + i*(stepT || 1), o: base, h: base + spread, l: base - spread, c: base, v: 1000 });
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
function wiggleRows(n, start, up, dn, t0, stepT){
  const r = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c;
    c += (i % 2 === 0) ? up : dn;
    r.push({ t: t0 + i*(stepT || 1), o: o, h: Math.max(o, c) + 0.4, l: Math.min(o, c) - 0.4, c: c, v: 1000 });
  }
  return r;
}
function mirrorRows(rows, M){
  return rows.map(r => ({ t: r.t, o: 2*M - r.o, h: 2*M - r.l, l: 2*M - r.h, c: 2*M - r.c, v: r.v }));
}
function emaLast(vals, p){                                   // mirrors the module's local EMA seed
  if (vals.length < p) return NaN;
  const k = 2/(p+1); let e = 0;
  for (let i = 0; i < p; i++) e += vals[i];
  e /= p;
  for (let i = p; i < vals.length; i++) e = vals[i]*k + e*(1-k);
  return e;
}

/* ---------------- pinned fixtures ---------------- */
/* 220 x 4h strong uptrend with the last 4 bars pulling the close onto the
   running EMA50 (+0.3) — the 4h trend-pullback trigger. */
function pullback4h(){
  const N = 220;
  const t0 = DAY + 2*H4 - (N-1)*H4;
  const rows = wiggleRows(216, 2300, 1.1, -0.4, t0, H4);
  const closes = rows.map(r => r.c);
  let px = rows[rows.length-1].c;
  for (let i = 216; i < N; i++){
    const e = emaLast(closes, 50);
    const o = px, c = e + 0.3;
    rows.push({ t: t0 + i*H4, o: o, h: Math.max(o, c) + 0.6, l: Math.min(o, c) - 0.6, c: c, v: 1200 });
    px = c; closes.push(c);
  }
  return rows;
}
/* same uptrend, no pullback tail -> close extended far from the 50-EMA */
function pullbackExtended4h(){
  const N = 220;
  const t0 = DAY + 2*H4 - (N-1)*H4;
  return wiggleRows(N, 2300, 1.1, -0.4, t0, H4);
}
/* 210 daily bars of bull trend (EMA50 stacked over EMA200), ends Monday */
function dailyBull(){ return wiggleRows(210, 2300, 2.2, -0.8, DAY - 209*86400, 86400); }
/* 30 daily bars whose prior ISO week (Jan 8–14) has EXACT high 2420 / low 2380 */
function weekly1d(){
  const rows = [];
  for (let i = 0; i < 30; i++)
    rows.push({ t: DAY - (29 - i)*86400, o: 2400, h: 2410, l: 2390, c: 2400, v: 1000 });
  for (let i = 22; i <= 28; i++){ rows[i].h = 2415; rows[i].l = 2385; }   // prior week
  rows[24].h = 2420;                                                      // prior week high
  rows[26].l = 2380;                                                      // prior week low
  return rows;
}
/* 59 flat 4h bars then a wick below 2380 closing back at `sweepClose` */
function wkReclaim4h(sweepClose){
  const t0 = DAY - 59*H4;
  const rows = flatRows(59, 2390, 3, t0, H4);
  rows.push({ t: DAY, o: 2391, h: 2394, l: 2375, c: sweepClose, v: 3000 });
  return rows;
}
/* no sweep, no displacement -> weekly strategy must stay silent */
function wkQuiet4h(){
  const t0 = DAY - 59*H4;
  const rows = flatRows(59, 2390, 3, t0, H4);
  rows.push({ t: DAY, o: 2391, h: 2394, l: 2385, c: 2390, v: 1000 });
  return rows;
}
/* latest 4h bar closes above the prior week's high with a displacement body */
function wkBreak4h(){
  const t0 = DAY - 59*H4;
  const rows = flatRows(59, 2400, 1, t0, H4);
  rows.push({ t: DAY, o: 2418, h: 2428, l: 2416, c: 2426, v: 5000 });
  return rows;
}
/* closes above the weekly high but WITHOUT a displacement range */
function wkBreakSmall4h(){
  const t0 = DAY - 59*H4;
  const rows = flatRows(59, 2400, 1, t0, H4);
  rows.push({ t: DAY, o: 2419, h: 2422, l: 2418, c: 2421, v: 2000 });
  return rows;
}
/* 45 flat 4h bars, a bearish candle (= bullish OB [2398.8, 2400.4]), a
   >1.5xATR displacement up through the 20-bar swing, then a drift back into
   the OB zone. lastClose pins the entry (and the single-bar weekly VWAP side). */
function obSwing4h(lastClose){
  const t0 = DAY - 61*H4;
  const rows = flatRows(45, 2400, 0.5, t0, H4);
  const P = (i, o, h, l, c, v) => rows.push({ t: t0 + i*H4, o: o, h: h, l: l, c: c, v: v });
  P(45, 2400, 2400.4, 2398.8, 2399.6, 1200);            // bearish candle = OB
  P(46, 2399.6, 2404.5, 2399.5, 2404.2, 4000);          // displacement up
  P(47, 2404.2, 2405, 2403.8, 2404.6, 1500);
  P(48, 2404.6, 2405.2, 2404, 2404.8, 1500);
  P(49, 2404.8, 2405.3, 2404.4, 2405, 1400);
  let px = 2405;
  for (let i = 50; i <= 60; i++){ const o = px; px = o - 0.5;
    P(i, o, Math.max(o, px) + 0.3, Math.min(o, px) - 0.3, px, 1100); }
  rows.push({ t: t0 + 61*H4, o: px, h: px + 0.2, l: 2398.95, c: lastClose, v: 2600 });
  return rows;
}
/* same OB formation but price rallies away and never retests the zone */
function obFar4h(){
  const t0 = DAY - 61*H4;
  const rows = flatRows(45, 2400, 0.5, t0, H4);
  const P = (i, o, h, l, c, v) => rows.push({ t: t0 + i*H4, o: o, h: h, l: l, c: c, v: v });
  P(45, 2400, 2400.4, 2398.8, 2399.6, 1200);
  P(46, 2399.6, 2404.5, 2399.5, 2404.2, 4000);
  let px = 2404.2;
  for (let i = 47; i <= 61; i++){ const o = px; px = o + 0.5;
    P(i, o, Math.max(o, px) + 0.3, Math.min(o, px) - 0.3, px, 1200); }
  return rows;
}
/* flat 4h bars + a deterministic bullish 4h sweep tail (for tally pins) */
function sweepFlat4h(){
  const t0 = DAY - 59*H4;
  const rows = flatRows(59, 2390, 3, t0, H4);
  rows.push({ t: DAY, o: 2391, h: 2393.5, l: 2384, c: 2392, v: 3000 });
  return rows;
}
const MACRO_TAIL = { realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING', goldSilverRatio: 90 };
const MACRO_HEAD = { realRateHint: 'HEADWIND', dxy: { trend20: 'RISING' }, tnxTrend: 'RISING', goldSilverRatio: 90 };
const MACRO_FLAT = { realRateHint: 'NEUTRAL', dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT', goldSilverRatio: 90 };

/* mounted scan environment with every feed stubbed */
function makeScanEnv(rows4h, rows1d, opts){
  opts = opts || {};
  const C = loadEnv(true);
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  C.getGoldCandles = async (tf) => (tf === '4h')
    ? { rows: cloneRows(rows4h), source: 'binance-xau' }
    : { rows: cloneRows(rows1d || []), source: 'binance-xau' };
  if (opts.macro) C.getGoldMacro = async () => opts.macro;
  if (opts.news) C.hgNewsState = () => opts.news;
  if (opts.spot) C.goldspotState = () => opts.spot;
  if (opts.fng) globalThis.S = { fng: opts.fng };
  const tab = C.HG_tabs.find(t => t.id === 'goldswing');
  const M = freshPane();
  tab.mount(M.pane);
  return { C: C, ls: ls, tab: tab, M: M };
}
function cleanup(){
  delete globalThis.localStorage;
  delete globalThis.S;
}

/* =========================================================================
   0) registration / load-time safety
========================================================================= */
console.log('== 0) exports + tab registration ==');
{
  const W = loadEnv(true);
  assert(typeof W.goldswingState === 'function' && typeof W.goldswingScan === 'function',
         'window.goldswingState + window.goldswingScan exported');
  assert(W.goldswingState() === null && W.goldswingScan() === null, 'both getters null before the first scan');
  const tab = W.HG_tabs.find(t => t.id === 'goldswing');
  assert(!!tab && tab.label === 'GOLD SWING' && typeof tab.mount === 'function' && typeof tab.refresh === 'function',
         'HG_tabs entry: id=goldswing, label=GOLD SWING, mount + refresh');
  const warm = (W.HG_warmups || []).find(t => t.id === 'goldswing');
  assert(!!warm && warm.label === 'GOLD SWING' && typeof warm.run === 'function', 'HG_warmups entry registered');
  let threw = false;
  try { tab.mount(null); } catch(e){ threw = true; }
  assert(!threw, 'mount(null) does not throw');
}

/* =========================================================================
   1) bare environment — NO goldind.js, NO klines layer, NO localStorage
========================================================================= */
console.log('== 1) bare-environment never-throws + honest degradation ==');
{
  const B = loadEnv(false);                                   // goldswing.js ONLY
  const tab = B.HG_tabs.find(t => t.id === 'goldswing');
  assert(!!tab, 'tab still self-registers with zero dependencies');
  const M = freshPane();
  let mountThrew = false;
  try { tab.mount(M.pane); } catch(e){ mountThrew = true; }
  assert(!mountThrew, 'mount in a bare env never throws');
  assert(M.pane._html.indexOf('GOLD SWING') >= 0 && M.pane._html.indexOf('id="gwRun"') >= 0,
         'mount renders the panel + RUN SCAN button');
  assert(M.pane._html.indexOf('.gsw-banner{') >= 0, 'gsw styles injected (unscoped for tab + StarTrader embed)');
  assert(M.pane._html.indexOf('let the structure come to you') >= 0, 'honest empty state rendered (no fabricated setups)');
  assert(/gold klines/.test(M.stubs['#gwStat'].textContent) && /goldind\.js detectors/.test(M.stubs['#gwStat'].textContent),
         'mount names BOTH missing layers in plain language — got "' + M.stubs['#gwStat'].textContent + '"');
  const r1 = await tab.refresh();
  assert(r1 === 'error: no klines layer', 'refresh before first run runs headless scan (got "' + r1 + '")');
  const r2 = await M.stubs['#gwRun']._handler();
  assert(r2 === 'error: no klines layer', 'scan with no klines layer resolves an honest error string (got "' + r2 + '")');
  assert(B.goldswingState() === null && B.goldswingScan() === null, 'no snapshot published without data');
  const warm = (B.HG_warmups || []).find(t => t.id === 'goldswing');
  let wOut = null, wThrew = null;
  try { wOut = await warm.run(); } catch(e){ wThrew = e; }
  assert(wThrew === null && wOut === 'unavailable: gold klines layer not loaded',
         'warm hook resolves an honest unavailable string in a bare env (got "' + wOut + '")');
}

/* =========================================================================
   2) STRATEGY 1 — 4h trend pullback to the EMA50/200 confluence
========================================================================= */
console.log('== 2) 4h trend pullback fires + extended-not-firing ==');
{
  const rows = pullback4h();
  const closes = rows.map(r => r.c);
  const e50 = emaLast(closes, 50), e200 = emaLast(closes, 200);
  const entry = closes[closes.length - 1];
  assert(entry > e50 && e50 > e200, 'premise: 4h bull stack (price > EMA50 > EMA200)');
  assert(Math.abs(entry - e50) < 1.0, 'premise: close parked on the 50-EMA value zone');

  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;
  const env = makeScanEnv(rows, dailyBull());
  const r = await env.M.stubs['#gwRun']._handler();
  assert(r === 'refreshed', 'pullback scan completes (got "' + r + '")');
  const scan = env.C.goldswingScan();
  const pb = scan && scan.cands.find(c => c.stratKey === 'pullback');
  assert(!!pb && pb.dir === 'long', 'pullback candidate fires LONG at the EMA50 shelf');
  assert(pb && /^pullback\|long\|\d+$/.test(pb.id), 'structure-anchored conviction id: ' + (pb && pb.id));
  assert(pb && pb.anchor === Math.round(e50) || (pb && Math.abs(pb.anchor - e50) < 1), 'anchor is the real 4h EMA50');
  assert(pb && pb.agree >= 3, 'at least 3 agreeing reads behind it (4h stack + daily stack + trigger) — got ' + (pb && pb.agree));
  assert(pb && pb.grade === 'C', 'grade C for tally 3–4 in bare ctx (A≥8 · B≥5 · else C) — got ' + (pb && pb.grade));
  assert(pb && /pulling back into the 50-EMA value zone/.test(pb.why), 'evidence named in plain language');
  assert(pb && /4h close below the 200-EMA/.test(pb.invalidates), 'invalidation names the 200-EMA structure');
  const pbHtml = env.M.stubs['#gwCards'].innerHTML;
  assert(pbHtml.indexOf('4h uptrend') >= 0 && pbHtml.indexOf('daily uptrend') >= 0
      && pbHtml.indexOf('pullback into the 4h 50-EMA') >= 0,
      'every agreeing read listed in the on-card ledger');
  assert(pb && pb.tally === pb.agree, 'bare ctx (March, no news/macro/spot/fng): tally == agreeing reads exactly');
  assert(scan.bestId === pb.id, 'only candidate -> MOST PROBABLE');
  assert(env.M.stubs['#gwCards'].innerHTML.indexOf('MOST PROBABLE SETUP') >= 0
      && env.M.stubs['#gwCards'].innerHTML.indexOf('WHY THIS ONE LEADS') >= 0,
      'MOST PROBABLE banner rendered with execution guidance');

  /* extended: no pullback tail -> no pullback candidate (nothing fabricated) */
  const env2 = makeScanEnv(pullbackExtended4h(), dailyBull());
  await env2.M.stubs['#gwRun']._handler();
  const scan2 = env2.C.goldswingScan();
  assert(!scan2 || !scan2.cands.find(c => c.stratKey === 'pullback'),
         'extended away from the 50-EMA -> the pullback strategy stays silent');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   3) STRATEGY 2 — weekly-range breakout (sweep-reclaim + displacement)
========================================================================= */
console.log('== 3) weekly-range breakout fires + stays silent without a trigger ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;

  /* sweep + reclaim, close NEAR the level: stop anchors beyond it */
  const env = makeScanEnv(wkReclaim4h(2390), weekly1d());
  await env.M.stubs['#gwRun']._handler();
  const scan = env.C.goldswingScan();
  const wk = scan && scan.cands.find(c => c.stratKey === 'wkbreak');
  assert(!!wk && wk.dir === 'long' && wk.id === 'wkbreak|long|2380',
         'prior week\u2019s low 2380 swept + reclaimed -> LONG candidate ' + (wk && wk.id));
  assert(wk && wk.agree === 3, 'ledger: sweep-reclaim trigger + 4h sweep read + weekly-VWAP read = 3 (got ' + (wk && wk.agree) + ')');
  assert(wk && wk.tally === 3 && wk.grade === 'C', 'bare ctx: tally 3, grade C (unified A≥8/B≥5 thresholds)');
  assert(wk && wk.stop < 2380, 'stop anchored BEYOND the swept weekly low (got ' + (wk && wk.stop) + ')');
  assert(/stop BEHIND structure 2380/.test(env.M.stubs['#gwCards'].innerHTML), 'stop note names the structure anchor (card HTML)');
  assert(wk && /swept and reclaimed/.test(wk.why) && /weekly range/.test(wk.why), 'evidence named in plain language');
  assert(wk && /4h close back below 2380/.test(wk.invalidates), 'invalidation names the level');

  /* mirrored construction -> symmetric SHORT reclaim of the prior week's high */
  const envM = makeScanEnv(mirrorRows(wkReclaim4h(2390), 2400), mirrorRows(weekly1d(), 2400));
  await envM.M.stubs['#gwRun']._handler();
  const wkM = envM.C.goldswingScan() && envM.C.goldswingScan().cands.find(c => c.stratKey === 'wkbreak');
  assert(!!wkM && wkM.dir === 'short' && wkM.id === 'wkbreak|short|2420',
         'mirrored: prior week\u2019s high 2420 swept + rejected -> SHORT ' + (wkM && wkM.id));
  assert(wkM && wkM.stop > 2420, 'short stop anchored beyond the swept weekly high');

  /* displacement break of the prior week's high */
  const envB = makeScanEnv(wkBreak4h(), weekly1d());
  await envB.M.stubs['#gwRun']._handler();
  const wkB = envB.C.goldswingScan() && envB.C.goldswingScan().cands.find(c => c.stratKey === 'wkbreak');
  assert(!!wkB && wkB.dir === 'long' && wkB.id === 'wkbreak|long|2420',
         'displacement close above the prior week\u2019s high -> breakout LONG ' + (wkB && wkB.id));
  assert(wkB && /broken with a displacement 4h close/.test(wkB.why), 'breakout evidence names the displacement');
  assert(wkB && wkB.agree === 3, 'breakout ledger: trigger + weekly-VWAP read + 4h FVG read = 3 (got ' + (wkB && wkB.agree) + ')');
  assert(/unmitigated 4h FVG/.test(envB.M.stubs['#gwCards'].innerHTML), 'breakout ledger names the displacement FVG on the card');

  /* NOT firing: quiet bars inside the weekly range */
  const envQ = makeScanEnv(wkQuiet4h(), weekly1d());
  await envQ.M.stubs['#gwRun']._handler();
  const scanQ = envQ.C.goldswingScan();
  assert(!scanQ || !scanQ.cands.find(c => c.stratKey === 'wkbreak'), 'inside the weekly range -> no weekly candidate');

  /* NOT firing: close beyond the level WITHOUT a displacement range */
  const envS = makeScanEnv(wkBreakSmall4h(), weekly1d());
  await envS.M.stubs['#gwRun']._handler();
  const scanS = envS.C.goldswingScan();
  assert(!scanS || !scanS.cands.find(c => c.stratKey === 'wkbreak'),
         'a quiet close beyond the level (no displacement) does NOT qualify as a breakout');

  /* honest degradation: no 1d bars -> weekly strategy offline, reason noted */
  const envN = makeScanEnv(wkReclaim4h(2390), []);
  await envN.M.stubs['#gwRun']._handler();
  const scanN = envN.C.goldswingScan();
  assert(!scanN || !scanN.cands.find(c => c.stratKey === 'wkbreak'),
         'no daily bars -> the weekly strategy is honestly offline');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   4) STRATEGY 3 — 4h order-block retest after the structure break
========================================================================= */
console.log('== 4) 4h order-block retest fires / not firing / held back ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;
  const W = loadEnv(true);
  const obDet = W.goldOrderBlocks(obSwing4h(2399.4));
  assert(!!obDet && obDet.bullish.length === 1 && Math.abs(obDet.bullish[0].bottom - 2398.8) < 1e-9,
         'premise: goldOrderBlocks finds the unmitigated bullish 4h OB [2398.8, 2400.4]');

  const env = makeScanEnv(obSwing4h(2399.4), dailyBull());
  await env.M.stubs['#gwRun']._handler();
  const scan = env.C.goldswingScan();
  const ob = scan && scan.cands.find(c => c.stratKey === 'ob');
  assert(!!ob && ob.dir === 'long' && ob.id === 'ob|long|2399',
         'OB retest fires LONG with the zone-edge id ' + (ob && ob.id));
  assert(ob && ob.agree === 3, 'ledger: OB read + daily stack + weekly-VWAP read = 3 (got ' + (ob && ob.agree) + ')');
  assert(ob && ob.stop < 2398.8, 'stop anchored beyond the order-block base (got ' + (ob && ob.stop) + ')');
  assert(ob && /structure-breaking displacement/.test(ob.why) && /4h close below the order-block base/.test(ob.invalidates),
         'why + invalidation name the structure break and the OB base');
  assert(ob && ob.zone && Math.abs(ob.zone.lo - 2398.8) < 1e-9 && Math.abs(ob.zone.hi - 2400.4) < 1e-9,
         'entry zone = the real OB zone');

  /* not firing: price never returns to the zone */
  const envF = makeScanEnv(obFar4h(), dailyBull());
  await envF.M.stubs['#gwRun']._handler();
  const scanF = envF.C.goldswingScan();
  assert(!scanF || !scanF.cands.find(c => c.stratKey === 'ob'), 'no retest of the zone -> no OB candidate');

  /* held back: trigger fires but confluence is insufficient (1 agreeing vs 1
     opposing) -> named reason on the rejected side-channel, never a card */
  const envD = makeScanEnv(obSwing4h(2399.0), []);
  await envD.M.stubs['#gwRun']._handler();
  const scanD = envD.C.goldswingScan();
  assert(!!scanD && scanD.cands.length === 0, 'insufficient confluence -> no card renders');
  const rej = scanD && scanD.rejected.find(x => x.stratKey === 'ob');
  assert(!!rej && rej.dir === 'long' && /confluence insufficient — 1 agreeing vs 1 opposing/.test(rej.reason),
         'held back with the reason named: "' + (rej && rej.reason) + '"');
  assert(envD.M.stubs['#gwCards'].innerHTML.indexOf('HELD BACK') >= 0,
         'held-back setups render as reason lines on the pane');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   5) STRATEGY 4 — macro-aligned continuation; macro NEVER fabricates
========================================================================= */
console.log('== 5) macro-aligned continuation + fabrication firewall ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;

  /* TAILWIND + daily bull stack -> macro LONG; deterministic ledger pins */
  const env = makeScanEnv(sweepFlat4h(), dailyBull(), { macro: MACRO_TAIL });
  await env.M.stubs['#gwRun']._handler();
  const scan = env.C.goldswingScan();
  const mc = scan && scan.cands.find(c => c.stratKey === 'macro');
  assert(!!mc && mc.dir === 'long' && /^macro\|long\|\d+$/.test(mc.id), 'macro TAILWIND + daily bull -> LONG ' + (mc && mc.id));
  assert(mc && mc.agree === 4, 'ledger: daily stack + 4h sweep + weekly VWAP + macro trigger = 4 (got ' + (mc && mc.agree) + ')');
  assert(mc && mc.grade === 'B' && mc.tally === 6, 'grade B; tally = 4 reads + 2 macro = 6 (got ' + (mc && mc.tally) + ')');
  const mcHtml = env.M.stubs['#gwCards'].innerHTML;
  assert(/real-rate backdrop favors longs/.test(mcHtml) && /DXY falling/.test(mcHtml) && /US10Y falling/.test(mcHtml),
         'macro evidence quotes the real-rate legs (DXY / US10Y trends) on the card');
  assert(mc && /daily 200-EMA region/.test(mc.invalidates), 'invalidation names the daily 200-EMA structure');
  const parts = mc ? mc.tallyParts : [];
  assert(parts.reduce((s, p) => s + p.pts, 0) === mc.tally, 'tally parts sum to the tally');
  assert(parts.some(p => p.pts === 4 && /independent agreeing read/.test(p.label))
      && parts.some(p => p.pts === 2 && /macro tailwind/.test(p.label)),
         'tally parts are human-readable with signed points');

  /* NEUTRAL hint -> no macro candidate */
  const envN = makeScanEnv(sweepFlat4h(), dailyBull(), { macro: MACRO_FLAT });
  await envN.M.stubs['#gwRun']._handler();
  const scanN = envN.C.goldswingScan();
  assert(!scanN || !scanN.cands.find(c => c.stratKey === 'macro'), 'NEUTRAL real-rate hint -> macro strategy stays silent');

  /* HEADWIND + daily BULL stack -> no long candidate fabricated, no short either */
  const envH = makeScanEnv(sweepFlat4h(), dailyBull(), { macro: MACRO_HEAD });
  await envH.M.stubs['#gwRun']._handler();
  const scanH = envH.C.goldswingScan();
  assert(!!scanH && scanH.cands.length === 0,
         'HEADWIND against the daily trend -> NOTHING fabricated (no macro long, no counter-trend short)');
  const stH = envH.C.goldswingState();
  assert(!!stH && stH.results.length === 0, 'honest empty result set published (no qualifying confluence)');

  /* macro unavailable -> strategy offline, scan still works */
  const envX = makeScanEnv(sweepFlat4h(), dailyBull());
  await envX.M.stubs['#gwRun']._handler();
  const scanX = envX.C.goldswingScan();
  assert(!scanX || !scanX.cands.find(c => c.stratKey === 'macro'), 'getGoldMacro absent -> macro strategy degrades honestly');

  /* HEADWIND + daily BEAR -> macro SHORT (alignment works both ways) */
  const envS = makeScanEnv(mirrorRows(sweepFlat4h(), 2400), mirrorRows(dailyBull(), 2400), { macro: MACRO_HEAD });
  await envS.M.stubs['#gwRun']._handler();
  const mcS = envS.C.goldswingScan() && envS.C.goldswingScan().cands.find(c => c.stratKey === 'macro');
  assert(!!mcS && mcS.dir === 'short', 'HEADWIND + daily bear stack -> macro SHORT fires');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   6) tally ranking + MOST PROBABLE selection across two candidates
========================================================================= */
console.log('== 6) ranking + MOST PROBABLE banner ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;
  /* OB retest (agree 3) vs macro continuation (agree 4) on the SAME ledger */
  const env = makeScanEnv(obSwing4h(2399.4), dailyBull(), { macro: MACRO_TAIL });
  await env.M.stubs['#gwRun']._handler();
  const scan = env.C.goldswingScan();
  const ob = scan && scan.cands.find(c => c.stratKey === 'ob');
  const mc = scan && scan.cands.find(c => c.stratKey === 'macro');
  assert(!!ob && !!mc, 'both candidates on the board');
  assert(ob && mc && mc.tally === ob.tally + 1, 'macro leads by exactly the trigger read (tally ' + (mc && mc.tally) + ' vs ' + (ob && ob.tally) + ')');
  assert(scan && scan.bestId === mc.id, 'MOST PROBABLE = highest tally (macro continuation)');
  const html = env.M.stubs['#gwCards'].innerHTML;
  assert(html.indexOf('MOST PROBABLE SETUP') >= 0 && html.indexOf('MACRO-ALIGNED TREND CONTINUATION') >= 0
      && html.indexOf('BUY ZONE') >= 0 && html.indexOf('TP3') >= 0,
         'banner singles out the leader with its full 3-target plan');
  assert(html.indexOf('★ MOST PROBABLE') >= 0, 'leader card carries the star stamp');
  /* every tally part is human-readable and signed, parts sum to the tally */
  assert(scan.cands.every(c => c.tallyParts.reduce((s, p) => s + p.pts, 0) === c.tally
      && c.tallyParts.every(p => typeof p.label === 'string' && p.label.length > 5 && isFinite(p.pts))),
      'every candidate\u2019s tally parts are signed, readable, and sum to the tally');
  /* ranked order is tally-descending */
  assert(scan.cands[0].id === mc.id, 'ranked list is tally-descending');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   7) tally context legs — news / macro / spot / season / fng (exact math)
========================================================================= */
console.log('== 7) tally context legs ==');
{
  const realDateNow = Date.now;
  async function scanWith(opts, pinnedNow){
    Date.now = () => pinnedNow;
    const env = makeScanEnv(sweepFlat4h(), dailyBull(), opts);
    await env.M.stubs['#gwRun']._handler();
    const mc = env.C.goldswingScan() && env.C.goldswingScan().cands.find(c => c.stratKey === 'macro');
    cleanup();
    return { mc: mc, env: env };
  }
  /* news window: -2 tally + one-letter grade downgrade, stamp shown */
  const news = { loaded: true, events: [{ title: 'US CPI', impact: 'high', t: Math.floor(MAR_NOW/1000) + 300 }] };
  const a = await scanWith({ macro: MACRO_TAIL, news: news }, MAR_NOW);
  assert(a.mc && a.mc.tally === 4, 'news window: tally 4 + 2 macro − 2 news = 4 (got ' + (a.mc && a.mc.tally) + ')');
  assert(a.mc && a.mc.grade === 'C', 'news window: grade B downgraded one letter to C');
  assert(/NEWS-FADE — NEWS WINDOW/.test(a.env.M.stubs['#gwCards'].innerHTML), 'NEWS-FADE stamp carried on the card (HTML)');
  assert(a.env.M.stubs['#gwCards'].innerHTML.indexOf('NEWS-FADE') >= 0, 'NEWS-FADE banner rendered');
  /* medium impact 45 min away -> outside the window */
  const newsFar = { loaded: true, events: [{ title: 'US CPI', impact: 'med', t: Math.floor(MAR_NOW/1000) + 45*60 }] };
  const b = await scanWith({ macro: MACRO_TAIL, news: newsFar }, MAR_NOW);
  assert(b.mc && b.mc.tally === 6 && b.mc.grade === 'B', 'medium/far event -> no penalty, grade stands');
  /* PAXG-basis positioning: shorts-crowding backs a long (+1) */
  const c = await scanWith({ macro: MACRO_TAIL, spot: { verdict: 'shorts-crowding', basisPct: -0.2 } }, MAR_NOW);
  assert(c.mc && c.mc.tally === 7 && c.mc.tallyParts.some(p => p.pts === 1 && /shorts crowding/.test(p.label)),
         'PAXG-basis shorts-crowding adds +1 with the reason named');
  /* seasonality: January STRONG backs a long (+1) */
  const d = await scanWith({ macro: MACRO_TAIL }, JAN_NOW);
  assert(d.mc && d.mc.tally === 7 && d.mc.tallyParts.some(p => p.pts === 1 && /seasonal tailwind/.test(p.label)),
         'Jan–Feb seasonal tailwind adds +1 behind the long');
  /* crypto fear & greed: extreme fear backs a gold long (+1) */
  const e = await scanWith({ macro: MACRO_TAIL, fng: { v: 12, c: 'Extreme Fear' } }, MAR_NOW);
  assert(e.mc && e.mc.tally === 7 && e.mc.tallyParts.some(p => p.pts === 1 && /fear & greed 12/.test(p.label)),
         'extreme fear adds +1 (risk-off bid for gold)');
  /* HEADWIND tilts the OTHER way — but with a bear daily it backs the short */
  const f = await scanWith({ macro: MACRO_HEAD }, MAR_NOW);
  assert(!f.mc, 'HEADWIND against the bull stack -> macro candidate absent (tilt only, never fabrication)');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   8) swing risk model — stop 1.5–2×ATR beyond structure, targets 1.5/2.5/4R
========================================================================= */
console.log('== 8) stop / target math ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;
  const env = makeScanEnv(wkReclaim4h(2390), weekly1d());
  await env.M.stubs['#gwRun']._handler();
  const wk = env.C.goldswingScan().cands.find(c => c.stratKey === 'wkbreak');
  const risk = Math.abs(wk.entry - wk.stop);
  assert(risk >= 1.5*wk.atr - 1e-9 && risk <= 2.0*wk.atr + 1e-9,
         'stop distance inside 1.5–2×ATR14(4h) (got ' + (risk/wk.atr).toFixed(2) + '×)');
  assert(risk > 1.5*wk.atr, 'structure wider than 1.5×ATR -> stop extended beyond the level');
  assert(Math.abs(wk.t1 - (wk.entry + 1.5*risk)) < 1e-9
      && Math.abs(wk.t2 - (wk.entry + 2.5*risk)) < 1e-9
      && Math.abs(wk.t3 - (wk.entry + 4.0*risk)) < 1e-9,
         'long targets at exactly 1.5R / 2.5R / 4R from real values');
  assert(Math.abs(wk.rr - 1.5) < 1e-6 && Math.abs(wk.rr2 - 2.5) < 1e-6 && Math.abs(wk.rr3 - 4.0) < 1e-6,
         'R multiples reported honestly (1.5 / 2.5 / 4.0) — got ' + wk.rr + ' / ' + wk.rr2 + ' / ' + wk.rr3);
  /* The 2×ATR ceiling here was the defect — see tests/test-gold-stop-model.mjs.
     What matters is that the stop clears the swept level; the width bound is
     now the 4× sanity ceiling for broken structure. */
  assert(wk.stop < 2380 && wk.stop > wk.entry - 4*wk.atr - 1e-9,
         'stop beyond the swept level, within the 4×ATR sanity ceiling');

  /* far structure -> the stop now CLEARS it rather than truncating at 2×ATR */
  const envF = makeScanEnv(wkReclaim4h(2395), weekly1d());
  await envF.M.stubs['#gwRun']._handler();
  const wkF = envF.C.goldswingScan().cands.find(c => c.stratKey === 'wkbreak');
  assert(Math.abs(wkF.entry - wkF.stop) > 2*wkF.atr - 1e-9,
         'structure beyond 1.75×ATR -> the stop goes BEHIND it, no longer truncated at 2×ATR ('
         + (Math.abs(wkF.entry - wkF.stop)/wkF.atr).toFixed(2) + '×)');
  /* The note used to say 'capped 2×' while placing the stop short of the
     structure. It now says BEHIND, and only mentions a ceiling when the
     4× sanity bound actually binds. */
  assert(/stop BEHIND structure/.test(envF.M.stubs['#gwCards'].innerHTML), 'stop note says it went behind the structure (card HTML)');

  /* short symmetry: mirrored pullback -> stop above, targets descending */
  const envM = makeScanEnv(mirrorRows(pullback4h(), 2400), mirrorRows(dailyBull(), 2400));
  await envM.M.stubs['#gwRun']._handler();
  const pbM = envM.C.goldswingScan() && envM.C.goldswingScan().cands.find(c => c.stratKey === 'pullback');
  assert(!!pbM && pbM.dir === 'short', 'mirrored downtrend -> pullback SHORT fires');
  assert(pbM && pbM.stop > pbM.entry && pbM.t1 < pbM.entry && pbM.t2 < pbM.t1 && pbM.t3 < pbM.t2,
         'short: stop above entry, TP1/TP2/TP3 descending');
  const riskM = Math.abs(pbM.entry - pbM.stop);
  assert(riskM >= 1.5*pbM.atr - 1e-9 && riskM <= 4.0*pbM.atr + 1e-9
      && Math.abs(pbM.t3 - (pbM.entry - 4.0*riskM)) < 1e-9,
         'short risk model symmetric (1.5–4×ATR stop, 4R final target)');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   9) CONVICTION LOCK — lock -> verbatim re-confirm -> STOPPED / TARGET HIT /
      EXPIRED (5-day TTL), evaluated against the latest 4h close
========================================================================= */
console.log('== 9) conviction lock lifecycle ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;
  const env = makeScanEnv(obSwing4h(2399.4), dailyBull());
  const C = env.C, ls = env.ls, tab = env.tab, M = env.M;

  const r1 = await M.stubs['#gwRun']._handler();
  assert(r1 === 'refreshed', 'scan 1 completes (got "' + r1 + '")');
  const scan1 = C.goldswingScan();
  const ob1 = scan1.cands.find(c => c.stratKey === 'ob');
  assert(!!ob1 && ob1.locked === false, 'scan 1: candidate is a NEW conviction');
  const store1 = loadConvictionStore(ls);
  const rec1 = store1 && store1.live['BINANCE XAUUSDT|' + ob1.id];
  assert(!!rec1, 'scan 1: conviction persisted under hgGoldswingConviction (venue-scoped key)');
  assert(['id','dir','strategy','entry','stop','t1','t2','t3','venue','sym','issuedAt','tally'].every(k => k in rec1),
         'persisted record carries the full contract fields (incl. t3)');
  assert(rec1.entry === ob1.entry && rec1.stop === ob1.stop && rec1.t1 === ob1.t1 && rec1.t2 === ob1.t2 && rec1.t3 === ob1.t3,
         'persisted levels match the issued card');

  /* scan 2 on IDENTICAL candles: lock restores — locked stamp, original
     issuedAt, byte-identical levels (idempotence) */
  const r2 = await tab.refresh();
  assert(r2 === 'refreshed', 'scan 2 completes (got "' + r2 + '")');
  const ob2 = C.goldswingScan().cands.find(c => c.id === ob1.id);
  assert(!!ob2 && ob2.locked === true
      && ob2.entry === ob1.entry && ob2.stop === ob1.stop && ob2.t1 === ob1.t1 && ob2.t2 === ob1.t2 && ob2.t3 === ob1.t3,
         'CONVICTION LOCK: two scans -> byte-identical levels');
  assert(ob2.issuedAt === ob1.issuedAt && ob2.asOf === ob1.asOf, 'locked stamp carries the original issuedAt');
  assert(M.stubs['#gwCards'].innerHTML.indexOf('CONVICTION LOCK') >= 0, 'locked card shows the CONVICTION LOCK stamp');

  /* restore-verbatim: seeded shifted levels beat the recomputed ones */
  ls.removeItem('hgGoldswingConviction');
  const seeded = { id: ob1.id, dir: ob1.dir, strategy: ob1.strategy,
                   entry: ob1.entry - 1, stop: ob1.stop - 1, t1: ob1.t1 - 1, t2: ob1.t2 - 1, t3: ob1.t3 - 1,
                   venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: Date.now() - 60*1000, tally: 5 };
  ls.setItem('hgGoldswingConviction', JSON.stringify({ v: 1, live: {}, history: [] }));
  const preStore = loadConvictionStore(ls); preStore.live[seeded.id] = seeded;
  ls.setItem('hgGoldswingConviction', JSON.stringify(preStore));
  await tab.refresh();
  const obR = C.goldswingScan().cands.find(c => c.id === ob1.id);
  assert(!!obR && obR.entry === seeded.entry && obR.stop === seeded.stop && obR.t1 === seeded.t1 && obR.t3 === seeded.t3,
         'restore-verbatim: card shows the ORIGINAL seeded levels, not the recomputed ones');
  assert(obR.entry !== ob1.entry && obR.locked === true && obR.issuedAt === seeded.issuedAt,
         'restore-verbatim: recomputed levels NOT used; original issuedAt kept');

  /* STOPPED: latest 4h close beyond the stop */
  ls.removeItem('hgGoldswingConviction');
  const stopped4h = obSwing4h(2399.4);
  stopped4h[stopped4h.length - 1] = Object.assign({}, stopped4h[stopped4h.length - 1],
    { c: rec1.stop - 2, h: rec1.stop, l: rec1.stop - 3 });
  C.getGoldCandles = async (tf) => (tf === '4h')
    ? { rows: cloneRows(stopped4h), source: 'binance-xau' }
    : { rows: cloneRows(dailyBull()), source: 'binance-xau' };
  const preS = loadConvictionStore(ls) || { v: 1, live: {}, history: [] };
  preS.live[rec1.id] = rec1;
  ls.setItem('hgGoldswingConviction', JSON.stringify(preS));
  await tab.refresh();
  const hStop = C.goldswingScan().history.find(h => h.id === rec1.id);
  assert(!!hStop && hStop.status === 'STOPPED', '4h close beyond the stop -> STOPPED (slot reopens)');
  assert(!loadConvictionStore(ls).live[rec1.id], 'stopped record leaves the live map');
  assert(M.stubs['#gwCards'].innerHTML.indexOf('STOPPED') >= 0, 'stopped setup renders as history, never vanishes silently');

  /* TARGET HIT: TP1 reached on the latest 4h close */
  ls.removeItem('hgGoldswingConviction');
  C.getGoldCandles = async (tf) => (tf === '4h')
    ? { rows: obSwing4h(2399.4), source: 'binance-xau' }
    : { rows: cloneRows(dailyBull()), source: 'binance-xau' };
  ls.setItem('hgGoldswingConviction', JSON.stringify({ v: 1, live: {
    'wkbreak|long|9999': { id: 'wkbreak|long|9999', dir: 'long', strategy: 'WEEKLY RANGE BREAKOUT',
                           entry: 2300, stop: 2290, t1: 2305, t2: 2320, t3: 2350,
                           venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: Date.now(), tally: 4 } }, history: [] }));
  await tab.refresh();
  const hT = C.goldswingScan().history.find(h => h.id === 'wkbreak|long|9999');
  assert(!!hT && hT.status === 'TARGET HIT', 'TP1 reached on the latest 4h close -> TARGET HIT');

  /* EXPIRED: structure older than 5 days */
  ls.removeItem('hgGoldswingConviction');
  ls.setItem('hgGoldswingConviction', JSON.stringify({ v: 1, live: {
    'pullback|long|8888': { id: 'pullback|long|8888', dir: 'long', strategy: '4H TREND PULLBACK (EMA50/200)',
                            entry: 2300, stop: 100, t1: 99999, t2: 99999, t3: 99999,
                            venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: Date.now() - 6*24*3600*1000, tally: 3 } }, history: [] }));
  await tab.refresh();
  const hX = C.goldswingScan().history.find(h => h.id === 'pullback|long|8888');
  assert(!!hX && hX.status === 'EXPIRED', 'structure older than 5 days -> EXPIRED');

  /* NOT yet expired at 4 days: still live, restored verbatim */
  ls.removeItem('hgGoldswingConviction');
  ls.setItem('hgGoldswingConviction', JSON.stringify({ v: 1, live: {
    'pullback|long|7777': { id: 'pullback|long|7777', dir: 'long', strategy: '4H TREND PULLBACK (EMA50/200)',
                            entry: 99999, stop: 1, t1: 99999, t2: 99999, t3: 99999,
                            venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: Date.now() - 4*24*3600*1000, tally: 3 } }, history: [] }));
  await tab.refresh();
  assert(!!loadConvictionStore(ls).live['pullback|long|7777'], 'structure 4 days old is still inside the 5-day TTL');

  /* short-side stop transition symmetry */
  ls.removeItem('hgGoldswingConviction');
  ls.setItem('hgGoldswingConviction', JSON.stringify({ v: 1, live: {
    'wkbreak|short|6666': { id: 'wkbreak|short|6666', dir: 'short', strategy: 'WEEKLY RANGE BREAKOUT',
                            entry: 2300, stop: 2304, t1: 2290, t2: 2280, t3: 2260,
                            venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: Date.now(), tally: 3 } }, history: [] }));
  await tab.refresh();
  const hS = C.goldswingScan().history.find(h => h.id === 'wkbreak|short|6666');
  assert(!!hS && hS.status === 'STOPPED', 'short: 4h close above the stop -> STOPPED (symmetric)');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   10) BRAIN contract — goldswingState() / goldswingScan() shapes + failure-proof
========================================================================= */
console.log('== 10) BRAIN state + diagnostic contracts ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;
  const env = makeScanEnv(obSwing4h(2399.4), dailyBull(), { macro: MACRO_TAIL });
  const C = env.C;
  await env.M.stubs['#gwRun']._handler();
  const st = C.goldswingState();
  assert(!!st && Array.isArray(st.results) && typeof st.at === 'number', 'goldswingState() -> {results, at}');
  assert(st.results.length >= 1, 'results non-empty after a successful scan');
  const row = st.results[0];
  assert(Object.keys(row).sort().join(',') === 'dir,grade,strategy,sym,venue',
         'result rows carry EXACTLY {venue, sym, dir, grade, strategy}');
  assert(row.venue === 'BINANCE XAUUSDT' && row.sym === 'XAUUSDT' && row.dir === 'long'
      && typeof row.grade === 'string' && typeof row.strategy === 'string',
         'row content: venue/sym/dir/grade/strategy populated from the scan');
  assert(Object.isFrozen(st) && Object.isFrozen(st.results) && Object.isFrozen(row), 'state snapshot is deep-frozen');

  const scan = C.goldswingScan();
  assert(!!scan && Array.isArray(scan.cands) && typeof scan.bestId === 'string'
      && Array.isArray(scan.history) && Array.isArray(scan.rejected) && typeof scan.at === 'number',
         'goldswingScan() -> {cands, bestId, history, rejected, at}');
  const c0 = scan.cands[0];
  assert(['id','venue','sym','dir','strategy','stratKey','grade','entry','stop','t1','t2','t3','rr','rr2','rr3',
          'tally','tallyParts','agree','oppose','session','atr','locked','issuedAt','asOf','why','invalidates','anchor']
          .every(k => k in c0),
         'diagnostic candidate carries the full field contract (incl. t3/rr3/session/anchor)');
  assert(Object.isFrozen(scan) && Object.isFrozen(scan.cands) && Object.isFrozen(c0) && Object.isFrozen(c0.tallyParts),
         'diagnostic snapshot is deep-frozen');
  assert(c0.session.indexOf('GMT') >= 0, 'session context stamped (ICT killzone label, informational only)');

  /* failed re-run keeps the PREVIOUS good snapshot with its original at */
  const atBefore = st.at, jsonBefore = JSON.stringify(st.results);
  C.getGoldCandles = async () => { throw new Error('feed down'); };
  const rf = await env.tab.refresh();
  assert(rf === 'refreshed', 'failed-data re-run still resolves refreshed with an honest stat line');
  const st2 = C.goldswingState();
  assert(st2 && st2.at === atBefore && JSON.stringify(st2.results) === jsonBefore,
         'failed re-run keeps the PREVIOUS good snapshot with its original at');
  assert(/no 4h klines/.test(env.M.stubs['#gwStat'].textContent), 'honest stat line names the data failure');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   11) honest empty state when candles are unavailable
========================================================================= */
console.log('== 11) honest empty state ==');
{
  const env = makeScanEnv([], []);                       // feeds return empty rows
  await env.M.stubs['#gwRun']._handler();
  assert(/no 4h klines/.test(env.M.stubs['#gwStat'].textContent),
         'stat line honestly names the missing 4h klines — got "' + env.M.stubs['#gwStat'].textContent + '"');
  assert(env.C.goldswingState() === null && env.C.goldswingScan() === null,
         'no candles -> no snapshot, no diagnostic (nothing fabricated)');
  assert(env.M.stubs['#gwEmpty'].style.display === 'block', 'honest empty state shown');
  assert(env.M.stubs['#gwCards'].innerHTML === '', 'no cards rendered without data');
  cleanup();
}

/* =========================================================================
   12) Delta XAUTUSD leg skipped (broker-aligned XAUUSD only)
========================================================================= */
console.log('== 12) Delta leg skipped ==');
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;
  const env = makeScanEnv(obSwing4h(2399.4), dailyBull());
  env.C.xuUniverse = async () => ([{ base: 'XAUT', sym: 'XAUTUSD', exchange: 'delta' }]);
  env.C.xuCandles = async (item, tf) => cloneRows(tf === '4h' ? obSwing4h(2399.4) : dailyBull());
  await env.M.stubs['#gwRun']._handler();
  const scan = env.C.goldswingScan();
  assert(!!scan && !scan.cands.some(c => c.venue === 'DELTA XAUTUSD'),
         'Delta XAUTUSD no longer scanned — broker-aligned XAUUSD only');
  assert(scan.cands.some(c => c.venue === 'BINANCE XAUUSDT'), 'primary venue candidates intact');
  assert(/DELTA XAUTUSD: skipped/.test(env.M.stubs['#gwStat'].textContent), 'stat line reports XAUT skipped');
  Date.now = realDateNow;
  cleanup();
}

/* =========================================================================
   13) scoped wiring edits — index.html GOLD group + sw.js shell/cache bump
========================================================================= */
console.log('== 13) wiring edits (index.html HG_NAV_GROUPS + sw.js) ==');
{
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const gLine = (html.match(/\{ id:'gold'[^\n]*\n?/) || [''])[0];
  assert(/tabs:\['super-gold','omnigold','goldswing','goldscalp','gold','goldpro','goldspot','goldcoint','goldpine','signallog'\]/.test(gLine),
         'GOLD group: super desk first, then swing/scalp scanners — got: ' + gLine.trim());
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  assert(/HG_CACHE\s*=\s*'hg-v\d+'/.test(sw), 'service worker cache is hg-vN (alerts workstream)');
  assert(sw.indexOf("'./goldswing.js'") !== -1 && sw.indexOf("'./goldpine.js'") !== -1
         && sw.indexOf("'./pinegoldmath.js'") !== -1 && sw.indexOf("'./signallog.js'") !== -1,
         'goldswing.js + goldpine.js + pinegoldmath.js + signallog.js in HG_SHELL precache');
}

/* =========================================================================
   14) FORMING NOW (buildWatch) + WHY SILENT — per-strategy ARMED/IDLE watch
       items with real levels, and the honest lead reason for silent scans
========================================================================= */
console.log('== 14) forming-now watch + WHY SILENT ==');
function atrLast14(rows, p){                               /* mirrors the module's local ATR (Wilder) */
  p = p || 14;
  let a = null;
  for (let i = 1; i < rows.length; i++){
    const r = rows[i], q = rows[i-1];
    const tr = Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
    if (a === null){
      if (i >= p){ let s = 0; for (let k = i-p+1; k <= i; k++){ const rk = rows[k], rj = rows[k-1]; s += Math.max(rk.h - rk.l, Math.abs(rk.h - rj.c), Math.abs(rk.l - rj.c)); } a = s/p; }
    } else a = (a*(p-1) + tr)/p;
  }
  return a;
}
function weekStartSec14(t){ const d = Math.floor(t/86400)*86400; const dow = new Date(d*1000).getUTCDay(); return d - ((dow + 6) % 7)*86400; }
function weeklyRange14(rows1d){                            /* mirrors the module's __weeklyRange */
  const n = rows1d.length, tl = rows1d[n-1].t;
  const prev = weekStartSec14(tl) - 7*86400;
  let hi = -Infinity, lo = Infinity, bars = 0;
  for (let i = 0; i < n; i++){
    const t = rows1d[i].t;
    if (weekStartSec14(t) !== prev) continue;
    if (rows1d[i].h > hi) hi = rows1d[i].h;
    if (rows1d[i].l < lo) lo = rows1d[i].l;
    bars++;
  }
  return (bars < 3 || !(hi > lo)) ? null : { hi: hi, lo: lo };
}
function pxLike14(n){                                      /* mirrors pxF fallback formatting */
  const a = Math.abs(n);
  const d = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtLike14(n, d){ return Number(n).toLocaleString('en-US', { maximumFractionDigits: d }); }
{
  const realDateNow = Date.now;
  Date.now = () => MAR_NOW;

  /* (a) candidate-producing scan: panel renders, snapshot carries the watch items */
  const env = makeScanEnv(pullback4h(), dailyBull());
  await env.M.stubs['#gwRun']._handler();
  const scan = env.C.goldswingScan();
  const html = env.M.stubs['#gwCards'].innerHTML;
  assert(html.indexOf('FORMING NOW — what the engine is watching') >= 0
      && html.indexOf('armed setups are watch items, not entries') >= 0,
      'FORMING NOW panel rendered after the cards with the honest watch-item label');
  assert(html.indexOf('ARMED') >= 0 && html.indexOf('IDLE') >= 0, 'armed rows highlighted, idle rows muted');
  assert(Array.isArray(scan.armed) && scan.armed.length === 4, 'snapshot.armed: 4 watch items (one venue leg)');
  assert(scan.armed.every(w => {
    var keys = Object.keys(w).filter(k => k !== 'promoteNote').sort().join(',');
    return keys === 'condition,level,reason,state,strategy,venue' && w.venue === 'BINANCE XAUUSDT';
  }),
         'snapshot.armed entries carry EXACTLY {strategy, venue, state, level, condition, reason}, venue-tagged');
  assert(scan.whySilent === null, 'whySilent null when candidates qualify');
  assert('armed' in scan && 'whySilent' in scan
      && Array.isArray(scan.cands) && typeof scan.bestId === 'string' && typeof scan.at === 'number',
         'additive contract: existing snapshot fields untouched, armed/whySilent added');
  const byKey = {};
  const SWK = { pullback: '4H TREND PULLBACK (EMA50/200)', wkbreak: 'WEEKLY RANGE BREAKOUT',
                ob: '4H ORDER BLOCK RETEST', macro: 'MACRO-ALIGNED TREND CONTINUATION' };
  for (const w of scan.armed){ for (const k in SWK){ if (w.strategy === SWK[k]) byKey[k] = w; } }
  const pRows = pullback4h();
  const e50p = emaLast(pRows.map(r => r.c), 50);
  assert(byKey.pullback && ['armed', 'promoted'].indexOf(byKey.pullback.state) >= 0
      && Math.abs(byKey.pullback.level - e50p) < 1e-9
      && /watching the 4h 50-EMA/.test(byKey.pullback.condition) && /bull EMA50\/200 stack/.test(byKey.pullback.condition),
         'pullback: armed or promoted on the real 4h 50-EMA ' + (byKey.pullback && byKey.pullback.level));
  const wkExp = weeklyRange14(dailyBull());
  const pEntry = pRows[pRows.length - 1].c;
  const wkLvl = Math.abs(pEntry - wkExp.lo) <= Math.abs(wkExp.hi - pEntry) ? wkExp.lo : wkExp.hi;
  assert(byKey.wkbreak.state === 'armed' && byKey.wkbreak.level === wkLvl
      && /prior week’s (low|high)/.test(byKey.wkbreak.condition),
         'wkbreak: armed on the nearer prior-week edge ' + wkLvl + ' (real weekly range)');
  assert(byKey.ob.state === 'idle' && /no unmitigated 4h order block on the chart/.test(byKey.ob.reason),
         'ob: honestly idle when the 4h chart has no unmitigated order block');
  const e50d = emaLast(dailyBull().map(r => r.c), 50);
  assert(byKey.macro.state === 'armed' && Math.abs(byKey.macro.level - e50d) < 1e-9
      && /daily bull stack in place — fires when the real-rate backdrop \(now unavailable\) aligns/.test(byKey.macro.condition),
         'macro: armed on the daily 50-EMA, honestly waiting on the real-rate backdrop');

  /* (b) OB armed on the real zone / idle when it sits beyond 1.5×ATR */
  const envB = makeScanEnv(obSwing4h(2399.4), dailyBull());
  await envB.M.stubs['#gwRun']._handler();
  const obB = envB.C.goldswingScan().armed.find(w => w.strategy === '4H ORDER BLOCK RETEST');
  assert(obB && ['armed', 'promoted'].indexOf(obB.state) >= 0 && obB.level === 2398.8
      && /unmitigated bullish 4h order block 2398.80–2400.40 — fires on a retest/.test(obB.condition),
         'ob: armed or promoted on the real zone 2398.80–2400.40 (edge 2398.8)');
  const envF = makeScanEnv(obFar4h(), dailyBull());
  await envF.M.stubs['#gwRun']._handler();
  const obF2 = envF.C.goldswingScan().armed.find(w => w.strategy === '4H ORDER BLOCK RETEST');
  assert(obF2 && obF2.state === 'idle' && /no unmitigated 4h order block within 1.5×ATR of price/.test(obF2.reason),
         'ob: zone beyond 1.5×ATR -> idle with the reason named');

  /* (c) macro honestly offline without daily bars */
  const envN = makeScanEnv(obSwing4h(2399.4), []);
  await envN.M.stubs['#gwRun']._handler();
  const mcN = envN.C.goldswingScan().armed.find(w => w.strategy === 'MACRO-ALIGNED TREND CONTINUATION');
  assert(mcN && mcN.state === 'idle' && /daily context unavailable \(0 1d bars\) — macro strategy offline/.test(mcN.reason),
         'macro: no 1d bars -> honestly offline (no fabrication)');

  /* (d) pullback honestly idle without a 4h trend stack */
  const envT = makeScanEnv(flatRows(70, 2390, 3, DAY - 70*H4), dailyBull());
  await envT.M.stubs['#gwRun']._handler();
  const pbT = envT.C.goldswingScan().armed.find(w => w.strategy === '4H TREND PULLBACK (EMA50/200)');
  assert(pbT && pbT.state === 'idle' && /no 4h EMA50\/200 trend stack right now/.test(pbT.reason),
         'pullback: no 4h trend stack -> idle with the reason named');

  /* (e) silent scan: lead = nearest armed trigger with real $ + ATR(4h) distance */
  const envQ = makeScanEnv(wkQuiet4h(), weekly1d());
  await envQ.M.stubs['#gwRun']._handler();
  const qScan = envQ.C.goldswingScan();
  assert(qScan.cands.length === 0, 'premise: quiet rows produce zero qualifying candidates');
  const qA4 = atrLast14(wkQuiet4h(), 14);
  const qExpect = 'nearest armed trigger: WEEKLY RANGE BREAKOUT (BINANCE XAUUSDT) at $' + pxLike14(2380)
    + ' — $' + pxLike14(10) + ' (' + fmtLike14(10/qA4, 1) + '×ATR(4h)) away';
  assert(qScan.whySilent === qExpect,
         'silent lead = nearest armed trigger with real $ + ATR distance — got "' + qScan.whySilent + '"');
  const qHtml = envQ.M.stubs['#gwCards'].innerHTML;
  assert(qHtml.indexOf('WHY SILENT') >= 0 && qHtml.indexOf('FORMING NOW') >= 0,
         'WHY SILENT line + watch panel rendered on the silent scan');
  assert(envQ.M.stubs['#gwEmpty'].style.display !== 'block', 'empty state stays hidden when watch data exists');

  /* (f) live convictions lead; nearest-armed rides as the tail */
  envQ.ls.setItem('hgGoldswingConviction', JSON.stringify({ v: 1, live: {
    'BINANCE XAUUSDT|wkbreak|long|9999': { id: 'wkbreak|long|9999', dir: 'long', strategy: 'WEEKLY RANGE BREAKOUT',
                         entry: 2300, stop: 2290, t1: 99999, t2: 99999, t3: 99999,
                         venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: MAR_NOW, tally: 4 } }, history: [] }));
  await envQ.tab.refresh();
  const vScan = envQ.C.goldswingScan();
  assert(vScan.whySilent === null || vScan.whySilent.indexOf('nearest armed trigger:') >= 0,
         'quiet scan with only a live lock: no misleading silence lead (got "' + vScan.whySilent + '")');
  assert(vScan.cands.length === 1 && vScan.cands[0].locked === true && vScan.cands[0].id === 'wkbreak|long|9999',
         'live conviction card renders when the scan finds zero new qualifying candidates');
  assert(envQ.M.stubs['#gwCards'].innerHTML.indexOf('CONVICTION LOCK') >= 0,
         'locked live conviction shows the CONVICTION LOCK stamp on the card');

  /* (g) news window outranks live convictions (precedence news > convictions) */
  const envG = makeScanEnv(wkQuiet4h(), weekly1d(), { news: { loaded: true,
    events: [{ title: 'US CPI', impact: 'high', t: Math.floor(MAR_NOW/1000) + 300 }] } });
  envG.ls.setItem('hgGoldswingConviction', JSON.stringify({ v: 1, live: {
    'BINANCE XAUUSDT|wkbreak|long|9999': { id: 'wkbreak|long|9999', dir: 'long', strategy: 'WEEKLY RANGE BREAKOUT',
                         entry: 2300, stop: 2290, t1: 99999, t2: 99999, t3: 99999,
                         venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: MAR_NOW, tally: 4 } }, history: [] }));
  await envG.M.stubs['#gwRun']._handler();
  const gScan = envG.C.goldswingScan();
  assert(gScan.cands.length === 1 && gScan.cands[0].locked === true,
         'news window: the locked live conviction still renders (fade risk on tally, not a veto)');
  assert(gScan.whySilent === null,
         'news window with a visible live card: WHY SILENT suppressed (got "' + gScan.whySilent + '")');
  assert(envG.M.stubs['#gwCards'].innerHTML.indexOf('NEWS') >= 0 || envG.M.stubs['#gwCards'].innerHTML.indexOf('news') >= 0,
         'news window: the card or banner carries the fade-risk stamp');

  /* (h) feeds failed: the empty state itself carries the WHY SILENT reason */
  const envX = makeScanEnv([], []);
  await envX.M.stubs['#gwRun']._handler();
  assert(envX.M.stubs['#gwEmpty'].style.display === 'block'
      && /WHY SILENT/.test(envX.M.stubs['#gwEmpty'].innerHTML)
      && /feeds failed — no 4h klines/.test(envX.M.stubs['#gwEmpty'].innerHTML),
         'feeds failed: empty state carries the WHY SILENT feeds-failed line');
  assert(envX.M.stubs['#gwCards'].innerHTML === '', 'feeds failed: no cards rendered without data');

  Date.now = realDateNow;
  cleanup();
}

console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
