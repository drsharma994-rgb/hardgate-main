/* HARDGATE — oiflow.js unit tests (Node 18+, builtins only).
   Loads oiflow.js as a classic script (vm.runInThisContext, like the
   browser's <script> tag) with NOTHING but a window stub present, then:
     A) load + HG_tabs registration
     B) oiflowClassify — price×OI quadrants (all 4 states)
     C) deadzones + inclusive boundary thresholds (px ±0.5 / OI ±2)
     D) fundingZ crowding (±2 boundaries, both directions)
     E) retail contrarian (65/35 boundaries)
     F) taker imbalance (1.05/0.95 boundaries)
     G) null / NaN / undefined / missing-arg tolerance
     H) majority scoring, ties, contract shape
     I) mount(el) smoke test (UI scaffold + graceful missing-globals note)
     J) setup plans — smartSetup/toTrade/hgMiniChart stubbed: plan HTML, button
        payload, chart containers + calls, confirmed->context sort, empty klines
     K) local ATR fallback math when smartSetup is absent (atr/ema stubbed)
     K2) no smartSetup + no atr -> context card, no crash
     L) binanceKlines throwing -> catch-isolated context card, scan survives
     M) toTrade absent -> plan renders, SEND TO TRADE PLAN button omitted
   No live network. Run: node tests/test-oiflow.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

/* ---- load the module in a pristine global scope: only a window stub ---- */
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'positioning.js', 'utf8'), { filename: 'positioning.js' });
vm.runInThisContext(fs.readFileSync(root + 'oiflow.js', 'utf8'), { filename: 'oiflow.js' });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* ================= A) load + registration ================= */
console.log('== load + registration ==');
ok(typeof globalThis.window.oiflowClassify === 'function', 'window.oiflowClassify exposed');
ok(Array.isArray(globalThis.window.HG_tabs) && globalThis.window.HG_tabs.length === 1, 'HG_tabs array created with one entry');
const tab = globalThis.window.HG_tabs[0];
ok(tab.id === 'oiflow' && tab.label === 'OI FLOW' && typeof tab.mount === 'function',
   'HG_tabs entry = {id:oiflow, label:OI FLOW, mount}');
ok(globalThis.window.oiflowScanSymbol === undefined && globalThis.window.oiflowPlan === undefined
   && globalThis.window.cardHTML === undefined && globalThis.window.runScan === undefined,
   'only the classifier + HG_tabs leak onto window');

const C = globalThis.window.oiflowClassify;

/* ================= B) price×OI quadrants ================= */
console.log('== quadrants (all four states) ==');
let r = C({ fundingZ: 0, oiChg: 3, pxChg: 2, takerAvg: 1.0, longPct: 50 });
ok(r.dir === 'LONG' && r.score === 1 && r.evidence[0].indexOf('NEW LONGS (trend fuel)') === 0,
   'px↑ + OI↑ → LONG · NEW LONGS (trend fuel)');

r = C({ fundingZ: 0, oiChg: -3, pxChg: 2, takerAvg: 1.0, longPct: 50 });
ok(r.dir === 'SHORT' && r.score === 1 && r.evidence[0].indexOf('SHORT COVERING (weak rally)') === 0,
   'px↑ + OI↓ → SHORT · SHORT COVERING (weak rally)');

r = C({ fundingZ: 0, oiChg: 3, pxChg: -2, takerAvg: 1.0, longPct: 50 });
ok(r.dir === 'SHORT' && r.score === 1 && r.evidence[0].indexOf('NEW SHORTS (trend fuel)') === 0,
   'px↓ + OI↑ → SHORT · NEW SHORTS (trend fuel)');

r = C({ fundingZ: 0, oiChg: -3, pxChg: -2, takerAvg: 1.0, longPct: 50 });
ok(r.dir === 'LONG' && r.score === 1 && r.evidence[0].indexOf('LONG FLUSH (capitulation)') === 0,
   'px↓ + OI↓ → LONG · LONG FLUSH (capitulation)');

/* ================= C) deadzones + boundaries ================= */
console.log('== deadzones + inclusive boundaries ==');
r = C({ oiChg: 5, pxChg: 0.49 });
ok(r.dir === null && r.total === 0, 'px +0.49% (inside ±0.5 deadzone) → no quadrant');
r = C({ oiChg: 1.99, pxChg: 5 });
ok(r.dir === null && r.total === 0, 'OI +1.99% (inside ±2 deadzone) → no quadrant');
r = C({ oiChg: 0, pxChg: 0 });
ok(r.dir === null && r.score === 0 && r.evidence.length === 0, 'flat book → no fabricated evidence');
r = C({ oiChg: 2, pxChg: 0.5 });
ok(r.dir === 'LONG' && r.evidence[0].indexOf('NEW LONGS') === 0, 'boundary px +0.5 / OI +2 fires (inclusive)');
r = C({ oiChg: -2, pxChg: -0.5 });
ok(r.dir === 'LONG' && r.evidence[0].indexOf('LONG FLUSH') === 0, 'boundary px −0.5 / OI −2 fires LONG FLUSH');
r = C({ oiChg: 2, pxChg: -0.5 });
ok(r.dir === 'SHORT' && r.evidence[0].indexOf('NEW SHORTS') === 0, 'boundary px −0.5 / OI +2 fires NEW SHORTS');
r = C({ oiChg: -2, pxChg: 0.5 });
ok(r.dir === 'SHORT' && r.evidence[0].indexOf('SHORT COVERING') === 0, 'boundary px +0.5 / OI −2 fires SHORT COVERING');
r = C({ oiChg: 2, pxChg: 0.49 });
ok(r.dir === null, 'px +0.49 with OI +2 → still dead');
r = C({ oiChg: 1.9, pxChg: 0.5 });
ok(r.dir === null, 'px +0.5 with OI +1.9 → still dead');
r = C({ oiChg: 8, pxChg: null });
ok(r.dir === null, 'pxChg null → quadrant cannot fire on OI alone');
r = C({ oiChg: null, pxChg: 8 });
ok(r.dir === null, 'oiChg null → quadrant cannot fire on px alone');

/* ================= D) funding z crowding ================= */
console.log('== funding z-score crowding ==');
r = C({ fundingZ: 2 });
ok(r.dir === 'SHORT' && r.evidence[0].indexOf('CROWDED LONG (squeeze-down risk)') === 0, 'z = +2 (boundary) → CROWDED LONG → SHORT fade');
r = C({ fundingZ: -2 });
ok(r.dir === 'LONG' && r.evidence[0].indexOf('CROWDED SHORT (squeeze-up risk)') === 0, 'z = −2 (boundary) → CROWDED SHORT → LONG fade');
r = C({ fundingZ: 3.7 });
ok(r.dir === 'SHORT', 'z = +3.7 → SHORT');
r = C({ fundingZ: -2.5 });
ok(r.dir === 'LONG', 'z = −2.5 → LONG');
r = C({ fundingZ: 1.99 });
ok(r.dir === null, 'z = +1.99 → inside band, no evidence');
r = C({ fundingZ: -1.99 });
ok(r.dir === null, 'z = −1.99 → inside band, no evidence');

/* ================= E) retail contrarian ================= */
console.log('== retail contrarian ==');
r = C({ longPct: 65 });
ok(r.dir === 'SHORT' && r.evidence[0].indexOf('RETAIL MAX LONG (fade)') === 0, 'retail 65% long (boundary) → RETAIL MAX LONG → SHORT');
r = C({ longPct: 35 });
ok(r.dir === 'LONG' && r.evidence[0].indexOf('RETAIL MAX SHORT (fade)') === 0, 'retail 35% long (boundary) → RETAIL MAX SHORT → LONG');
r = C({ longPct: 82 });
ok(r.dir === 'SHORT', 'retail 82% → SHORT fade');
r = C({ longPct: 12 });
ok(r.dir === 'LONG', 'retail 12% → LONG fade');
r = C({ longPct: 64.9 });
ok(r.dir === null, 'retail 64.9% → no evidence');
r = C({ longPct: 35.1 });
ok(r.dir === null, 'retail 35.1% → no evidence');

/* ================= F) taker imbalance ================= */
console.log('== taker imbalance ==');
r = C({ takerAvg: 1.05 });
ok(r.dir === 'LONG' && r.evidence[0].indexOf('AGGRESSIVE BUYERS') === 0, 'taker 1.05 (boundary) → AGGRESSIVE BUYERS → LONG');
r = C({ takerAvg: 0.95 });
ok(r.dir === 'SHORT' && r.evidence[0].indexOf('AGGRESSIVE SELLERS') === 0, 'taker 0.95 (boundary) → AGGRESSIVE SELLERS → SHORT');
r = C({ takerAvg: 1.2 });
ok(r.dir === 'LONG', 'taker 1.20 → LONG');
r = C({ takerAvg: 0.8 });
ok(r.dir === 'SHORT', 'taker 0.80 → SHORT');
r = C({ takerAvg: 1.049 });
ok(r.dir === null, 'taker 1.049 → inside band, no evidence');
r = C({ takerAvg: 0.951 });
ok(r.dir === null, 'taker 0.951 → inside band, no evidence');

/* ================= G) null / NaN / undefined tolerance ================= */
console.log('== null / NaN / undefined tolerance ==');
r = C({ fundingZ: null, oiChg: null, pxChg: null, takerAvg: null, longPct: null });
ok(r.dir === null && r.score === 0 && r.evidence.length === 0, 'all null → null dir, empty evidence');
r = C({ fundingZ: NaN, oiChg: NaN, pxChg: NaN, takerAvg: NaN, longPct: NaN });
ok(r.dir === null && r.total === 0, 'all NaN → treated as missing');
r = C({});
ok(r.dir === null, 'empty object → null dir');
r = C();
ok(r.dir === null, 'no argument at all → no throw, null dir');
r = C(null);
ok(r.dir === null, 'explicit null argument → no throw, null dir');
r = C({ fundingZ: '3', oiChg: '4', pxChg: '2', takerAvg: '1.2', longPct: '80' });
ok(r.dir === null, 'string numbers are rejected (strict finite numbers only)');
r = C({ fundingZ: Infinity, oiChg: -Infinity, pxChg: 3, takerAvg: 1.2, longPct: 50 });
ok(r.dir === 'LONG' && r.score === 1 && r.evidence[0].indexOf('AGGRESSIVE BUYERS') === 0,
   'Infinity legs ignored; remaining taker read still classifies');
r = C({ fundingZ: 2.5, oiChg: NaN, pxChg: NaN, takerAvg: NaN, longPct: NaN });
ok(r.dir === 'SHORT' && r.score === 1, 'NaN quadrant skipped, funding leg still fires');

/* ================= H) majority scoring, ties, shape ================= */
console.log('== majority scoring, ties, contract shape ==');
r = C({ fundingZ: -2.5, oiChg: 4, pxChg: 2.5, takerAvg: 1.15, longPct: 20 });
ok(r.dir === 'LONG' && r.score === 4 && r.evidence.length === 4 && r.total === 4,
   'four agreeing LONG reads → dir LONG, score 4');
r = C({ fundingZ: 2.5, oiChg: -4, pxChg: 2.5, takerAvg: 0.85, longPct: 80 });
ok(r.dir === 'SHORT' && r.score === 4 && r.evidence.length === 4,
   'four agreeing SHORT reads → dir SHORT, score 4');
r = C({ fundingZ: 0, oiChg: 4, pxChg: 2.5, takerAvg: 1.15, longPct: 80 });
ok(r.dir === 'LONG' && r.score === 2 && r.evidence.length === 2 && r.shortEv.length === 1,
   '2 LONG vs 1 SHORT → LONG, score = agreeing count 2');
r = C({ fundingZ: 2.5, oiChg: 4, pxChg: -2.5, takerAvg: 1.15, longPct: 50 });
ok(r.dir === 'SHORT' && r.score === 2 && r.longEv.length === 1,
   '2 SHORT (new shorts + crowded long) vs 1 LONG (taker) → SHORT, score 2');
r = C({ fundingZ: 2.5, oiChg: -4, pxChg: -2.5, takerAvg: 1.0, longPct: 50 });
ok(r.dir === null && r.score === 0 && r.evidence.length === 0 && r.total === 2,
   '1v1 tie → dir null, score 0, evidence empty (but total preserved)');
r = C({ fundingZ: 2.5, oiChg: 4, pxChg: -2.5, takerAvg: 1.15, longPct: 20 });
ok(r.dir === null && r.total === 4, '2v2 tie → null dir');
ok(r.longEv.length === 2 && r.shortEv.length === 2, 'tie keeps both evidence lists for the UI contra row');
r = C({ fundingZ: -3, oiChg: -4, pxChg: -1 });
ok(r.dir === 'LONG' && r.score === 2, 'LONG FLUSH + CROWDED SHORT → squeeze-up LONG, score 2 (the card-worthy combo)');
ok(['LONG', 'SHORT', null].indexOf(r.dir) >= 0, 'dir is always LONG | SHORT | null');
ok(Array.isArray(r.evidence) && r.evidence.every(function(e){ return typeof e === 'string'; }),
   'evidence is an array of strings');
r = C({ fundingZ: 0, oiChg: 4, pxChg: 2.5, takerAvg: 1.0, longPct: 50 });
ok(r.regime === 'NEW LONGS (trend fuel)', 'regime exposes the quadrant label separately');
r = C({ fundingZ: 1, oiChg: 0.5, pxChg: 0.1, takerAvg: 1.0, longPct: 50 });
ok(r.regime === null, 'regime null when the quadrant is dead');

/* ================= I) mount(el) smoke test ================= */
console.log('== mount(el) smoke test ==');
const stubs = {};
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           addEventListener: function(ev, fn){ this._handler = fn; } };
}
const pane = {
  _html: '',
  set innerHTML(v){ this._html = v; },
  get innerHTML(){ return this._html; },
  querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
};
tab.mount(pane);
ok(pane._html.indexOf('class="panel"') >= 0 && pane._html.indexOf('<h2>OI FLOW') >= 0,
   'mount builds .panel with h2 title');
ok(pane._html.indexOf('id="oiflowRun"') >= 0 && pane._html.indexOf('class="btn"') >= 0, 'RUN .btn present');
ok(pane._html.indexOf('id="oiflowStat"') >= 0 && pane._html.indexOf('note') >= 0, 'status .note present');
ok(pane._html.indexOf('id="oiflowProg"') >= 0 && pane._html.indexOf('<i></i>') >= 0, '.prog progress bar present');
ok(pane._html.indexOf('id="oiflowCards"') >= 0 && pane._html.indexOf('class="cards"') >= 0, 'output .cards container present');
ok(pane._html.indexOf('id="oiflowEmpty"') >= 0 && pane._html.indexOf('class="empty"') >= 0, '.empty state container present');
ok(typeof stubs['#oiflowRun']._handler === 'function', 'RUN button wired to a click handler');
ok(stubs['#oiflowDeps'].className === 'note warn' && stubs['#oiflowDeps'].textContent.indexOf('missing globals') >= 0
   && stubs['#oiflowDeps'].textContent.indexOf('binancePerpUniverse') >= 0,
   'graceful .note.warn lists missing globals when data layer absent');
tab.mount(pane); // second mount must not throw either
ok(true, 'mount is idempotent (second call does not throw)');
tab.mount(null);
ok(true, 'mount(null) tolerated without throwing');

/* ================= J) setup plans: smartSetup + toTrade + hgMiniChart stubbed =================
   Full scan driven through the RUN button with the whole Binance layer stubbed.
   BTCUSDT = LONG x2 (confirmed SWING setup), ETHUSDT = SHORT x2 (unconfirmed SCALP),
   SOLUSDT = SHORT x3 but klines come back empty -> context-only card.
   Exercises: plan HTML, button payload, chart containers, chart calls,
   confirmed->unconfirmed->context sort, all-null-klines tolerance, stat line. */
console.log('== setup plans (smartSetup / toTrade / hgMiniChart stubbed) ==');

function stubEl2(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           addEventListener: function(ev, fn){ this._handler = fn; } };
}
function freshPane(){
  const stubs = {};
  const pane = {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl2(); return stubs[sel]; }
  };
  return { pane: pane, stubs: stubs };
}
async function waitScan(stubs){
  const t0 = Date.now();
  while (stubs['#oiflowRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}
function mkRows(n, base, step){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = base + step*i;
    rows.push({ t: 1700000000 + i*14400, o: c - 0.5, h: c + 1, l: c - 1, c: c, v: 1000 });
  }
  return rows;
}
function stubLegs(cfg){
  globalThis.binancePerpUniverse = async function(){ return Object.keys(cfg); };
  globalThis.binanceTickers24h = async function(){
    const m = {};
    Object.keys(cfg).forEach(function(s){ m[s] = { mark: cfg[s].mark, chg24: cfg[s].chg24, turnoverUsd: cfg[s].turnover }; });
    return m;
  };
  globalThis.binanceFunding    = async function(sym){ return { markPrice: cfg[sym].mark, fundingPct: 0.01 }; };
  globalThis.binanceOIHistory  = async function(sym){ return { series: cfg[sym].oi.map(function(oi){ return { oi: oi }; }) }; };
  globalThis.binanceTakerRatio = async function(sym){ return { series: [{ buySellRatio: cfg[sym].taker }] }; };
  globalThis.binanceLongShort  = async function(sym){ return { latest: { longPct: cfg[sym].longPct } }; };
}

const J_CFG = {
  BTCUSDT: { mark: 100, chg24: 2,   turnover: 500e6, oi: [100, 103], taker: 1.2, longPct: 50 }, // LONG x2
  ETHUSDT: { mark: 50,  chg24: -2,  turnover: 300e6, oi: [100, 103], taker: 0.8, longPct: 50 }, // SHORT x2
  SOLUSDT: { mark: 20,  chg24: 2.5, turnover: 900e6, oi: [100, 96],  taker: 0.8, longPct: 80 }  // SHORT x3 -> context (klines empty)
};
stubLegs(J_CFG);
globalThis.binanceKlines = async function(sym, interval, limit){
  if (sym === 'SOLUSDT') return [];               // null-on-failure convention -> context-only card
  return mkRows(limit || 120, 100, 0.1);
};
const smartCalls = [];
globalThis.smartSetup = function(cls, rows4h, rows1h){
  smartCalls.push({ cls: cls, n4: rows4h && rows4h.length, n1: rows1h && rows1h.length });
  if (!rows4h || rows4h.length < 60) return null;
  if (cls.dir === 'long')
    return { type: 'SWING', dir: 'long',  entry: 100, stop: 95, t1: 110, t2: 117.5, rr1: 2, rr2: 3.5, riskPct: 5, confirmed: true,  note: '' };
  return   { type: 'SCALP', dir: 'short', entry: 50,  stop: 53, t1: 44,  t2: 39.5,  rr1: 2, rr2: 3.5, riskPct: 6, confirmed: false, note: 'time-stop: exit within 24h' };
};
globalThis.toTrade = function(){};
const chartCalls = [];
globalThis.hgMiniChart = function(el, rows, plan){ chartCalls.push({ el: el, n: rows && rows.length, plan: plan }); return { fake: true }; };

const J = freshPane();
tab.mount(J.pane);
J.pane.querySelector('#oiflowCards').querySelectorAll = function(sel){
  return sel === '.oiflowChart'
    ? [{ getAttribute: function(){ return 'BTCUSDT'; } }, { getAttribute: function(){ return 'ETHUSDT'; } }]
    : [];
};
J.stubs['#oiflowRun']._handler();
await waitScan(J.stubs);
const jStat = J.stubs['#oiflowStat'].textContent, jHtml = J.stubs['#oiflowCards'].innerHTML;

ok(jStat.indexOf('done · 2 setups (1 confirmed) · 1 context') === 0, 'J: stat reports 2 setups (1 confirmed) + 1 context');
ok(jStat.indexOf('failed') === -1, 'J: empty klines do NOT count as symbol failure');
ok(smartCalls.length === 3, 'J: smartSetup consulted for all 3 candidates');
const jLongCalls = smartCalls.filter(function(c){ return c.cls.dir === 'long'; });
const jShortCalls = smartCalls.filter(function(c){ return c.cls.dir === 'short'; });
ok(jLongCalls.length === 1 && jShortCalls.length === 2, 'J: oiflow LONG/SHORT adapted to lowercase long/short for smartSetup');
ok(jLongCalls[0].n4 === 120 && jLongCalls[0].n1 === 120, 'J: smartSetup received 120x4h + 120x1h rows');
ok(smartCalls.filter(function(c){ return c.n4 === null && c.n1 === null; }).length === 1,
   'J: empty klines reach smartSetup as null (context-only path)');
ok(Array.isArray(jLongCalls[0].cls.longEv) && Array.isArray(jLongCalls[0].cls.shortEv)
   && typeof jLongCalls[0].cls.score === 'number' && typeof jLongCalls[0].cls.total === 'number',
   'J: adapted cls carries longEv/shortEv/score/total (smartClassify shape)');
ok(jHtml.indexOf('BTCUSDT') >= 0 && jHtml.indexOf('BTCUSDT') < jHtml.indexOf('ETHUSDT')
   && jHtml.indexOf('ETHUSDT') < jHtml.indexOf('SOLUSDT'),
   'J: sort = confirmed setup -> unconfirmed setup -> context (SOL score 3 still ranks last)');
ok(jHtml.indexOf('ENTRY <b>100</b> · STOP <b>95</b> · T1 110 (2R) · T2 117.5 (3.5R) · risk 5%') >= 0,
   'J: confirmed card renders full ENTRY/STOP/T1/T2/risk plan block');
ok(jHtml.indexOf('>SWING</span>') >= 0 && jHtml.indexOf('>CONFIRMED</span>') >= 0
   && jHtml.indexOf('>SCALP</span>') >= 0 && jHtml.indexOf('>UNCONFIRMED</span>') >= 0,
   'J: setup-type + CONFIRMED/UNCONFIRMED pips on setup cards');
ok(jHtml.indexOf('toTrade(&quot;BTCUSDT&quot;,&quot;long&quot;,100,95,110)') >= 0
   && jHtml.indexOf('toTrade(&quot;ETHUSDT&quot;,&quot;short&quot;,50,53,44)') >= 0,
   'J: SEND TO TRADE PLAN button carries escaped toTrade(sym,dir,entry,stop,t1) payload');
ok(jHtml.indexOf(' — time-stop: exit within 24h') >= 0, 'J: setup note appended to the plan');
ok(jHtml.indexOf('class="oiflowChart" data-sym="BTCUSDT"') >= 0
   && jHtml.indexOf('class="oiflowChart" data-sym="ETHUSDT"') >= 0
   && jHtml.indexOf('data-sym="SOLUSDT"') === -1,
   'J: chart container under setup cards only (context card has none)');
ok(chartCalls.length === 2, 'J: hgMiniChart painted once per setup card');
ok(chartCalls[0].n === 120 && chartCalls[0].plan.dir === 'long' && chartCalls[0].plan.entry === 100
   && chartCalls[0].plan.stop === 95 && chartCalls[0].plan.t1 === 110 && chartCalls[0].plan.t2 === 117.5,
   'J: hgMiniChart(el, rows, {dir,entry,stop,t1,t2}) contract for the LONG card');
ok(chartCalls[1].plan.dir === 'short' && chartCalls[1].plan.entry === 50,
   'J: hgMiniChart plan for the SHORT card');
ok(jHtml.indexOf('fade weak rally: short strength') >= 0, 'J: context card keeps the classic evidence plan text');
ok(jHtml.indexOf('&quot;SOLUSDT&quot;') === -1, 'J: context card has no toTrade button');

/* ================= K) local ATR fallback when smartSetup is absent =================
   delete smartSetup; stub atr -> 2.0 and ema -> 105/102 (bullish cascade).
   Closes pinned at 100: entry 100, risk 1.5x2 = 3, stop 97, T1 106 (2R), T2 110.5 (3.5R). */
console.log('== fallback plan math (smartSetup absent, atr/ema stubbed) ==');
delete globalThis.smartSetup;
delete globalThis.hgMiniChart;
const kAtr = [], kEma = [];
globalThis.atr = function(rows, p){ kAtr.push({ n: rows.length, p: p }); return rows.map(function(){ return 2; }); };
globalThis.ema = function(vals, p){ kEma.push(p); return vals.map(function(){ return p === 20 ? 105 : 102; }); };
globalThis.binanceKlines = async function(sym, interval, limit){ return mkRows(limit || 120, 100, 0); };
stubLegs({ BTCUSDT: { mark: 100, chg24: 2, turnover: 500e6, oi: [100, 103], taker: 1.2, longPct: 50 } });

const K = freshPane();
tab.mount(K.pane);
K.stubs['#oiflowRun']._handler();
await waitScan(K.stubs);
const kStat = K.stubs['#oiflowStat'].textContent, kHtml = K.stubs['#oiflowCards'].innerHTML;

ok(kStat.indexOf('done · 1 setups (1 confirmed) · 0 context') === 0, 'K: fallback produced one confirmed setup');
ok(kHtml.indexOf('ENTRY <b>100</b> · STOP <b>97</b> · T1 106 (2R) · T2 110.5 (3.5R) · risk 3%') >= 0,
   'K: fallback math — entry=last close, stop=1.5xATR14(4h), T1=2R, T2=3.5R');
ok(kHtml.indexOf(' — local ATR fallback (smartSetup unavailable)') >= 0, 'K: fallback note explains the provenance');
ok(kHtml.indexOf('>ATR</span>') >= 0 && kHtml.indexOf('>CONFIRMED</span>') >= 0,
   'K: ATR type pip + CONFIRMED pip (ema cascade agrees with dir)');
ok(kHtml.indexOf('toTrade(&quot;BTCUSDT&quot;,&quot;long&quot;,100,97,106)') >= 0, 'K: fallback button payload uses fallback numbers');
ok(kAtr.length === 1 && kAtr[0].p === 14 && kAtr[0].n === 120, 'K: fallback calls atr(rows4h, 14)');
ok(kEma.indexOf(20) >= 0 && kEma.indexOf(50) >= 0, 'K: confirmation uses 4h EMA20/50 cascade');
ok(kHtml.indexOf('class="oiflowChart"') >= 0, 'K: chart container rendered even when the chart layer is absent');

/* ================= K2) no smartSetup AND no atr -> context card, no crash ================= */
console.log('== fallback impossible (no smartSetup, no atr) ==');
delete globalThis.atr;
const K2 = freshPane();
tab.mount(K2.pane);
K2.stubs['#oiflowRun']._handler();
await waitScan(K2.stubs);
const k2Stat = K2.stubs['#oiflowStat'].textContent, k2Html = K2.stubs['#oiflowCards'].innerHTML;
ok(k2Stat.indexOf('done · 0 setups (0 confirmed) · 1 context') === 0, 'K2: setup-less candidate degrades to context card');
ok(k2Html.indexOf('trend fuel: long the next pullback') >= 0, 'K2: context card keeps classic plan text');
ok(k2Html.indexOf('toTrade(') === -1 && k2Html.indexOf('oiflowChart') === -1, 'K2: no button / chart without a setup');

/* ================= L) klines throwing -> catch-isolated context card ================= */
console.log('== kline failure isolation (binanceKlines throws) ==');
globalThis.smartSetup = function(cls, rows4h, rows1h){
  if (!rows4h || rows4h.length < 60) return null;
  return { type: 'SWING', dir: cls.dir, entry: 100, stop: 95, t1: 110, t2: 117.5, rr1: 2, rr2: 3.5, riskPct: 5, confirmed: true, note: '' };
};
globalThis.binanceKlines = async function(sym, interval, limit){
  if (sym === 'SOLUSDT') throw new Error('simulated kline outage');
  return mkRows(limit || 120, 100, 0.1);
};
stubLegs({
  BTCUSDT: { mark: 100, chg24: 2,   turnover: 500e6, oi: [100, 103], taker: 1.2, longPct: 50 },
  SOLUSDT: { mark: 20,  chg24: 2.5, turnover: 900e6, oi: [100, 96],  taker: 0.8, longPct: 80 }
});
const L = freshPane();
tab.mount(L.pane);
L.stubs['#oiflowRun']._handler();
await waitScan(L.stubs);
const lStat = L.stubs['#oiflowStat'].textContent, lHtml = L.stubs['#oiflowCards'].innerHTML;
ok(lStat.indexOf('done · 1 setups (1 confirmed) · 1 context') === 0, 'L: thrown klines never kill the scan');
ok(lStat.indexOf('failed') === -1, 'L: kline outage is not counted as a symbol failure');
ok(lHtml.indexOf('BTCUSDT') >= 0 && lHtml.indexOf('BTCUSDT') < lHtml.indexOf('SOLUSDT'), 'L: setup card ranks above the degraded context card');
ok(lHtml.indexOf('fade weak rally: short strength') >= 0, 'L: degraded card falls back to the classic plan text');

/* ================= M) toTrade absent -> plan renders, button omitted ================= */
console.log('== toTrade feature-check (button omitted when absent) ==');
delete globalThis.toTrade;
stubLegs({ BTCUSDT: { mark: 100, chg24: 2, turnover: 500e6, oi: [100, 103], taker: 1.2, longPct: 50 } });
const M = freshPane();
tab.mount(M.pane);
M.stubs['#oiflowRun']._handler();
await waitScan(M.stubs);
const mHtml = M.stubs['#oiflowCards'].innerHTML;
ok(mHtml.indexOf('ENTRY <b>100</b>') >= 0 && mHtml.indexOf('toTrade(') === -1,
   'M: setup plan renders but no SEND TO TRADE PLAN button when toTrade is missing');
ok(M.stubs['#oiflowStat'].textContent.indexOf('done · 1 setups (1 confirmed)') === 0, 'M: scan still completes cleanly');

/* ================= N) hard-refresh contract: refresh on the registration =================
   Driven on a FRESH module instance (fresh window stub, second vm load) so the
   scan-state machine starts clean. Covers: registration carries refresh;
   pre-mount and mounted-never-run skip WITHOUT firing a first-time universe
   scan; busy guard during an in-flight scan (no double-fetch); post-run
   refresh re-runs runScan; overlapping refresh pair -> busy/refreshed; a
   per-symbol leg throw stays isolated inside the scan loop; sabotaged DOM ->
   refresh resolves 'error', never throws, and the busy flag recovers. */
console.log('== hard-refresh contract (refresh on the registration) ==');
ok(typeof tab.refresh === 'function', 'N: original registration carries a refresh fn');

globalThis.window = {};   /* fresh window -> fresh module instance, clean scan state */
vm.runInThisContext(fs.readFileSync(root + 'oiflow.js', 'utf8'), { filename: 'oiflow.js' });
const tab2 = globalThis.window.HG_tabs[0];
ok(tab2.id === 'oiflow' && typeof tab2.refresh === 'function', 'N: fresh registration = {id:oiflow, ..., refresh fn}');

/* self-contained Binance/smartSetup stubs with a universe-call counter */
let uniCalls = 0;
globalThis.binancePerpUniverse = async function(){ uniCalls++; return ['AAAUSDT']; };
globalThis.binanceTickers24h = async function(){
  return { AAAUSDT: { mark: 100, chg24: 2, turnoverUsd: 500e6 } };
};
globalThis.binanceFunding    = async function(){ return { markPrice: 100, fundingPct: 0.01 }; };
globalThis.binanceOIHistory  = async function(){ return { series: [{ oi: 100 }, { oi: 103 }] }; };
globalThis.binanceTakerRatio = async function(){ return { series: [{ buySellRatio: 1.2 }] }; };
globalThis.binanceLongShort  = async function(){ return { latest: { longPct: 50 } }; };
globalThis.binanceKlines     = async function(sym, interval, limit){ return mkRows(limit || 120, 100, 0.1); };
globalThis.smartSetup = function(cls, rows4h){
  if (!rows4h || rows4h.length < 60) return null;
  return { type: 'SWING', dir: cls.dir, entry: 100, stop: 95, t1: 110, t2: 117.5, rr1: 2, rr2: 3.5, riskPct: 5, confirmed: true, note: '' };
};

/* --- pre-mount: skip, and no expensive first-time scan --- */
const nSkip0 = await tab2.refresh();
ok(nSkip0 === 'skipped: not run yet', 'N: refresh before mount -> "skipped: not run yet" (got "' + nSkip0 + '")');
ok(uniCalls === 0, 'N: pre-mount refresh triggered no universe fetch');

/* --- mounted but never run: still skip, still no scan --- */
const NA = freshPane();
tab2.mount(NA.pane);
const nSkip1 = await tab2.refresh();
ok(nSkip1 === 'skipped: not run yet', 'N: mounted-but-never-run refresh -> "skipped: not run yet"');
ok(uniCalls === 0, 'N: a global refresh must not fire a first-time full-universe scan');

/* --- user runs once, then refresh re-runs --- */
NA.stubs['#oiflowRun']._handler();
await waitScan(NA.stubs);
ok(uniCalls === 1 && NA.stubs['#oiflowStat'].textContent.indexOf('done · 1 setups (1 confirmed)') === 0,
   'N: user RUN scan completes once (universe fetched, stat done)');
const nRef1 = await tab2.refresh();
ok(nRef1 === 'refreshed', 'N: refresh after a completed run -> "refreshed" (got "' + nRef1 + '")');
ok(uniCalls === 2, 'N: refresh re-ran the existing runScan (universe fetched again)');

/* --- busy guard: refresh during an in-flight scan --- */
NA.stubs['#oiflowRun']._handler();                 /* starts scan #3, not awaited */
const nBusy = await tab2.refresh();
await waitScan(NA.stubs);
ok(nBusy === 'busy', 'N: refresh during an in-flight scan -> "busy" (got "' + nBusy + '")');
ok(uniCalls === 3, 'N: busy guard did not double-fetch (only the click scan ran)');

/* --- overlapping refresh pair: exactly one runs --- */
const nConcBefore = uniCalls;
const nPA = tab2.refresh();
const nSB = await tab2.refresh();
const nSA = await nPA;
ok(nSB === 'busy', 'N: second overlapping refresh -> "busy"');
ok(nSA === 'refreshed' && uniCalls === nConcBefore + 1, 'N: first overlapping refresh -> "refreshed", exactly one scan ran');

/* --- per-symbol leg throw stays isolated inside the scan loop --- */
globalThis.binancePerpUniverse = async function(){ uniCalls++; return ['AAAUSDT', 'BADUSDT']; };
globalThis.binanceTickers24h = async function(){
  return { AAAUSDT: { mark: 100, chg24: 2, turnoverUsd: 500e6 },
           BADUSDT: { mark: 5,   chg24: 2, turnoverUsd: 400e6 } };
};
globalThis.binanceFunding = async function(sym){
  if (sym === 'BADUSDT') throw new Error('simulated funding outage');
  return { markPrice: 100, fundingPct: 0.01 };
};
const nRef2 = await tab2.refresh();
const nStat2 = NA.stubs['#oiflowStat'].textContent, nHtml2 = NA.stubs['#oiflowCards'].innerHTML;
ok(nRef2 === 'refreshed' && nStat2.indexOf('done ·') === 0, 'N: one symbol\'s leg throw never aborts the scan');
ok(nStat2.indexOf('1 symbols failed (skipped)') >= 0, 'N: thrown symbol counted + skipped honestly in the stat line');
ok(nHtml2.indexOf('AAAUSDT') >= 0 && nHtml2.indexOf('BADUSDT') === -1,
   'N: surviving symbol still renders its card; failed symbol absent');

/* --- never throws: sabotaged DOM -> 'error', busy flag recovers --- */
const NB = freshPane();
tab2.mount(NB.pane);
const nbStat = NB.pane.querySelector('#oiflowStat');   /* materialize the stub (runScan queries it lazily) */
const nbDesc = Object.getOwnPropertyDescriptor(nbStat, 'textContent');
Object.defineProperty(nbStat, 'textContent', {
  configurable: true,
  get: function(){ return ''; },
  set: function(){ throw new Error('dom dead'); }
});
const nErr = await tab2.refresh();
ok(nErr === 'error', 'N: sabotaged DOM -> refresh resolves "error", never throws (got "' + nErr + '")');
Object.defineProperty(nbStat, 'textContent', nbDesc);
const nRef3 = await tab2.refresh();
ok(nRef3 === 'refreshed', 'N: busy flag released after the error path — module refreshes again (got "' + nRef3 + '")');

/* ================= O) BRAIN state getter — window.oiflowState + HG_oiflowResults =================
   Fresh module instance (clean closure state). Covers: getter exposed; null
   pre-run; exact {results:[{sym,dir,evidence:number,cls:string}], at} shape
   after a successful scan; HG_oiflowResults published in the engine.js
   Stage-0 contract form ({syms, at} + mirrored results); deep-frozen fresh
   copies; an honest-abort re-run keeps the PREVIOUS good snapshot with its
   original `at`; the getter never throws with sabotaged internals. */
console.log('== BRAIN state getter (window.oiflowState + HG_oiflowResults) ==');
globalThis.window = {};   /* fresh window -> fresh module instance, clean scan + snapshot state */
vm.runInThisContext(fs.readFileSync(root + 'oiflow.js', 'utf8'), { filename: 'oiflow.js' });
const tab3 = globalThis.window.HG_tabs[0];
ok(tab3 && tab3.id === 'oiflow' && typeof tab3.refresh === 'function', 'O: fresh registration found');
ok(typeof globalThis.window.oiflowState === 'function', 'O: window.oiflowState exposed');
ok(globalThis.window.oiflowState() === null, 'O: null before the first successful scan');
ok(globalThis.window.HG_oiflowResults === undefined, 'O: HG_oiflowResults not written before the first scan');

stubLegs({
  AAAUSDT: { mark: 100, chg24: 2,   turnover: 500e6, oi: [100, 103], taker: 1.2, longPct: 50 }, // LONG x2 card
  BBBUSDT: { mark: 50,  chg24: 0.1, turnover: 400e6, oi: [100, 100], taker: 1.0, longPct: 50 }  // no evidence -> no card
});
globalThis.binanceKlines = async function(sym, interval, limit){ return mkRows(limit || 120, 100, 0.1); };
delete globalThis.smartSetup; delete globalThis.atr; delete globalThis.ema; // -> context-only card (state does not need a plan)

const O = freshPane();
tab3.mount(O.pane);
O.stubs['#oiflowRun']._handler();
await waitScan(O.stubs);
ok(O.stubs['#oiflowStat'].textContent.indexOf('done · 0 setups (0 confirmed) · 1 context') === 0,
   'O: fixture scan completes (1 context card, 1 symbol without evidence)');

const oState = globalThis.window.oiflowState();
ok(oState && Array.isArray(oState.results) && typeof oState.at === 'number' && isFinite(oState.at),
   'O: shape = {results:[], at:<epochMs>} after the successful scan');
ok(oState.results.length === 1, 'O: only the evidence-backed candidate is published');
const oRow = oState.results[0];
ok(Object.keys(oRow).sort().join(',') === 'cls,dir,evidence,sym',
   'O: result row keys exactly {sym, dir, evidence, cls}');
ok(oRow.sym === 'AAAUSDT' && oRow.dir === 'LONG' && oRow.evidence === 2
   && oRow.cls === 'NEW LONGS (trend fuel)',
   'O: row carries sym/dir, the agreeing-read COUNT (evidence: 2) and the classifier label (cls string)');
ok(Object.isFrozen(oState) && Object.isFrozen(oState.results) && Object.isFrozen(oRow),
   'O: the view is deep-frozen (state, results, rows all frozen)');
const oState2 = globalThis.window.oiflowState();
ok(oState2 !== oState && oState2.results !== oState.results
   && JSON.stringify(oState2) === JSON.stringify(oState),
   'O: each call hands a fresh deep copy with identical content');

/* HG_oiflowResults — the key engine.js Stage-0 already feature-checks */
const oPub = globalThis.window.HG_oiflowResults;
ok(oPub && typeof oPub === 'object' && typeof oPub.at === 'number' && isFinite(oPub.at),
   'O: HG_oiflowResults published with an `at` stamp');
ok(Array.isArray(oPub.syms) && oPub.syms.length === 1 && oPub.syms[0] === 'AAAUSDT',
   'O: HG_oiflowResults.syms is the engine.js Stage-0 contract form (symbol list)');
ok(Array.isArray(oPub.results) && oPub.results.length === 1 && oPub.results[0].sym === 'AAAUSDT'
   && oPub.results[0].dir === 'LONG' && oPub.results[0].evidence === 2,
   'O: HG_oiflowResults.results mirrors the oiflowState rows');

/* honest abort (binance layer gone) keeps the PREVIOUS good snapshot + publisher key */
delete globalThis.binancePerpUniverse;
const oRef = await tab3.refresh();
ok(oRef === 'refreshed' && O.stubs['#oiflowStat'].textContent.indexOf('not loaded') >= 0,
   'O: re-run aborts honestly (data layer missing), refresh still resolves');
const oState3 = globalThis.window.oiflowState();
ok(oState3 && oState3.at === oState.at && oState3.results.length === 1
   && oState3.results[0].sym === 'AAAUSDT'
   && globalThis.window.HG_oiflowResults.at === oPub.at,
   'O: stale-good snapshot + publisher key preserved after the abort (same at, same content)');

/* sabotaged internals: getter degrades to null, never throws, then recovers */
const keepIsArrayO = Array.isArray;
let oThrew = false, oGot = 'unset';
Array.isArray = undefined;
try{ oGot = globalThis.window.oiflowState(); }catch(e){ oThrew = true; }
Array.isArray = keepIsArrayO;
ok(!oThrew && oGot === null,
   'O: getter never throws with sabotaged internals (Array.isArray removed) — returns null');
ok(globalThis.window.oiflowState() !== null, 'O: getter recovers once internals are restored');

console.log('\nALL ' + passed + ' OIFLOW ASSERTIONS PASSED');
