/* HARDGATE — goldpro.js unit + UI-flow tests (Node 18+, builtins only).
   Loads indicators.js / indicators2.js / macro.js / goldpro.js as classic
   scripts (vm shared context, exactly like the browser's <script> globals)
   with a stubbed window, then:
     1) asserts the HG_tabs registration + goldProVerdict export
     2) asserts goldProVerdict against synthetic inputs covering every branch:
        all three words, both cross states, both decoupling regimes, deadzone
        between ±2.5, exact ±2.5 boundaries, null/NaN/wrong-type inputs,
        case-insensitivity, why-string composition
     3) drives mount() + the RUN button through four UI flows with stubbed
        globals and a stubbed fetch — NO live network anywhere.
   Run: node tests/test-goldpro.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = f => vm.runInThisContext(readFileSync(path.join(root, f), 'utf8'), { filename: f });

globalThis.window = {};
load('indicators.js'); load('indicators2.js'); load('macro.js'); load('goldpro.js');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ================= Part 1: registration & exports ================= */
console.log('== Part 1: registration ==');
assert(typeof window.goldProVerdict === 'function', 'window.goldProVerdict exported');
assert(Array.isArray(window.HG_tabs) && window.HG_tabs.length === 1, 'HG_tabs registered exactly once');
const tab = window.HG_tabs[0];
assert(tab && tab.id === 'goldpro', 'tab id is goldpro');
assert(tab && tab.label === 'GOLD PRO', 'tab label is GOLD PRO');
assert(tab && typeof tab.mount === 'function', 'tab mount is a function');

/* ================= Part 2: pure verdict branches ================= */
console.log('\n== Part 2: goldProVerdict pure branches ==');
const V = window.goldProVerdict;
const FULL_BULL = { goldAbove200: true, crossState: 'GOLDEN', dxyTrend: 'FALLING', tnxTrend: 'FALLING', realRateHint: 'TAILWIND' };
const FULL_BEAR = { goldAbove200: false, crossState: 'DEATH', dxyTrend: 'RISING', tnxTrend: 'RISING', realRateHint: 'HEADWIND' };

let r = V({ ...FULL_BULL, corr: -0.5 });
assert(r.word === 'STRUCTURAL BULL', 'full bull evidence + classic inverse corr -> BULL');
assert(/Aligned bull evidence/.test(r.why) && /golden cross/.test(r.why) && /tailwind/.test(r.why), 'bull why lists the evidence');
assert(!/half weight/.test(r.why), 'corr <= -0.3 keeps macro at full weight (no half-weight note)');

r = V({ ...FULL_BEAR, corr: -0.5 });
assert(r.word === 'STRUCTURAL BEAR', 'full bear evidence -> BEAR');
assert(/Aligned bear evidence/.test(r.why) && /death cross/.test(r.why) && /headwind/.test(r.why), 'bear why lists the evidence');

r = V({});
assert(r.word === 'NEUTRAL' && /Insufficient data/.test(r.why), 'empty object -> NEUTRAL, insufficient data');
assert(V().word === 'NEUTRAL' && V(null).word === 'NEUTRAL' && V(undefined).word === 'NEUTRAL', 'missing/null arg -> NEUTRAL');
assert(V({ corr: NaN }).word === 'NEUTRAL' && /Insufficient data/.test(V({ corr: NaN }).why), 'NaN corr alone -> NEUTRAL insufficient');

r = V({ goldAbove200: true });
assert(r.word === 'NEUTRAL', 'structure-only bull (net +2) sits in the ±2.5 deadzone -> NEUTRAL');
assert(/for: price above the 200D EMA/.test(r.why), 'deadzone why names the bull case');
r = V({ goldAbove200: false });
assert(r.word === 'NEUTRAL', 'structure-only bear (net -2) -> NEUTRAL');

r = V({ goldAbove200: true, tnxTrend: 'FALLING', corr: 0 });
assert(r.word === 'STRUCTURAL BULL', 'exact +2.5 boundary (decoupled half-weight macro) -> BULL');
r = V({ goldAbove200: false, tnxTrend: 'RISING', corr: 0.5 });
assert(r.word === 'STRUCTURAL BEAR', 'exact -2.5 boundary -> BEAR');
r = V({ goldAbove200: true, corr: 0.9 });
assert(r.word === 'NEUTRAL', 'just under boundary (net +2, decoupled, no macro) -> NEUTRAL');

r = V({ dxyTrend: 'FALLING', tnxTrend: 'FALLING', realRateHint: 'TAILWIND', corr: -0.1 });
assert(r.word === 'NEUTRAL', 'macro-only bull but decoupled (corr -0.1): 3x0.5=1.5 -> NEUTRAL');
assert(/half weight/.test(r.why), 'decoupled regime explains half weight in why');
r = V({ dxyTrend: 'FALLING', tnxTrend: 'FALLING', realRateHint: 'TAILWIND', corr: -0.3 });
assert(r.word === 'STRUCTURAL BULL', 'same macro with corr -0.3 (not > -0.2): full weight 3 -> BULL');
r = V({ goldAbove200: true, dxyTrend: 'FALLING', corr: -0.2 });
assert(r.word === 'STRUCTURAL BULL', 'corr exactly -0.2 is NOT decoupled -> full weight 3 -> BULL');
r = V({ goldAbove200: true, dxyTrend: 'FALLING', corr: -0.19 });
assert(r.word === 'STRUCTURAL BULL', 'corr -0.19 decoupled: 2+0.5=2.5 boundary -> BULL');

r = V({ goldAbove200: true, crossState: 'GOLDEN', dxyTrend: 'RISING', tnxTrend: 'RISING', realRateHint: 'HEADWIND', corr: -0.6 });
assert(r.word === 'NEUTRAL', 'structure bull vs full macro bear (3-3) -> NEUTRAL');
assert(/Mixed evidence/.test(r.why) && /for:/.test(r.why) && /against:/.test(r.why), 'mixed why shows both sides');

r = V({ goldAbove200: true, dxyTrend: 'falling', tnxTrend: ' falling ', realRateHint: 'tailwind', corr: -0.4 });
assert(r.word === 'STRUCTURAL BULL', 'string inputs are case/whitespace-insensitive');

r = V({ goldAbove200: true, crossState: 'NONE' });
assert(r.word === 'NEUTRAL', "crossState 'NONE' contributes nothing (net +2 -> NEUTRAL)");

r = V({ goldAbove200: 'yes', crossState: 7, dxyTrend: 42, tnxTrend: [], realRateHint: {}, corr: '-0.5' });
assert(r.word === 'NEUTRAL' && /Insufficient data/.test(r.why), 'wrong-type inputs all ignored -> NEUTRAL insufficient');

r = V({ goldAbove200: true, dxyTrend: 'FLAT', tnxTrend: 'FLAT', realRateHint: 'NEUTRAL' });
assert(r.word === 'NEUTRAL', 'FLAT/NEUTRAL macro reads contribute nothing (net +2 -> NEUTRAL)');

r = V({ goldAbove200: true, crossState: 'GOLDEN', dxyTrend: 'FALLING', tnxTrend: 'RISING', realRateHint: 'TAILWIND', corr: -0.4 });
assert(r.word === 'STRUCTURAL BULL' && /Against: US10Y yield rising/.test(r.why), 'bull verdict names the dissenting evidence');

r = V({ goldAbove200: true, dxyTrend: 'FALLING', corr: NaN });
assert(r.word === 'STRUCTURAL BULL' && !/half weight/.test(r.why), 'NaN corr treated as missing -> full macro weight');
r = V({ goldAbove200: true, dxyTrend: 'FALLING', corr: Infinity });
assert(r.word === 'STRUCTURAL BULL' && !/half weight/.test(r.why), 'Infinity corr treated as missing -> full macro weight');

/* ================= Part 2b: goldProPlan pure execution levels (SL/TP audit) ================= */
console.log('\n== Part 2b: goldProPlan pure levels ==');
const approx = (a, b, eps, msg) => assert(isFinite(a) && Math.abs(a - b) <= eps, msg + ' (got ' + a + ', want ~' + b + ')');
assert(typeof window.goldProPlan === 'function', 'window.goldProPlan exported');
const GP = window.goldProPlan;

let gp = GP({ dir: 'long', entry: 2700, atr: 6 });
assert(gp !== null && gp.dir === 'long', 'plan LONG: built (ATR fallback, no swing)');
assert(gp.stop === 2700 - 1.5 * 6, 'plan LONG: stop = entry - 1.5xATR exactly (2691)');
assert(gp.stop < gp.entry, 'plan LONG: stop below entry');
assert(gp.t1 === 2700 + 2 * 9, 'plan LONG: T1 = 2R (2718)');
assert(gp.t2 === 2700 + 3.5 * 9, 'plan LONG: T2 = 3.5R (2731.5)');
assert(gp.rr1 === 2 && gp.rr2 === 3.5, 'plan LONG: R multiples 2 / 3.5');
approx(gp.riskPct, 9 / 2700 * 100, 1e-9, 'plan LONG: riskPct = risk/entry*100');
assert(gp.structural === false, 'plan LONG: no swing -> not structural');

gp = GP({ dir: 'short', entry: 2300, atr: 4 });
assert(gp !== null && gp.stop === 2300 + 6 && gp.t1 === 2300 - 12 && gp.t2 === 2300 - 21,
       'plan SHORT: stop above entry, T1 = 2R and T2 = 3.5R below');
assert(gp.stop > gp.entry && gp.t1 < gp.entry && gp.t2 < gp.t1, 'plan SHORT: levels ordered against direction');

gp = GP({ dir: 'long', entry: 2700, atr: 6, swing: 2600 });
assert(gp.stop === 2598.5, 'plan LONG swing: stop = structure stop (swing 2600 - 0.25xATR), wider than 1.5xATR');
assert(gp.structural === true, 'plan LONG swing: structural flag set');
assert(gp.t1 === 2700 + 2 * 101.5 && gp.t2 === 2700 + 3.5 * 101.5, 'plan LONG swing: T1/T2 use the widened risk');

gp = GP({ dir: 'long', entry: 2700, atr: 6, swing: 2750 });
assert(gp.stop === 2691 && gp.structural === false, 'plan LONG swing wrong side (above entry): ignored, 1.5xATR stands');
gp = GP({ dir: 'long', entry: 2700, atr: 6, swing: 2698 });
assert(gp.stop === 2691 && gp.structural === false, 'plan LONG swing tighter than 1.5xATR: wider ATR stop stands');
gp = GP({ dir: 'short', entry: 2300, atr: 4, swing: 2400 });
assert(gp.stop === 2401 && gp.structural === true, 'plan SHORT swing: structure stop above (swing + 0.25xATR) wins');

assert(GP(null) === null && GP() === null && GP({}) === null, 'plan(null/missing/{}) -> null');
assert(GP({ dir: 'sideways', entry: 2700, atr: 6 }) === null, 'plan: invalid dir -> null');
assert(GP({ dir: 'long', entry: NaN, atr: 6 }) === null, 'plan: NaN entry -> null');
assert(GP({ dir: 'long', entry: 2700, atr: NaN }) === null, 'plan: NaN atr -> null');
assert(GP({ dir: 'long', entry: 2700, atr: 0 }) === null, 'plan: atr = 0 -> null');
assert(GP({ dir: 'long', entry: 2700, atr: -2 }) === null, 'plan: negative atr -> null');
assert(GP({ dir: 'long', entry: 0, atr: 6 }) === null, 'plan: entry <= 0 -> null');

/* ================= Part 3: mount + RUN flows (no network) ================= */
console.log('\n== Part 3: mount + RUN UI flows ==');

function makeFakePane(){
  const nodes = {};
  const mk = () => ({
    innerHTML: '', textContent: '', className: '', disabled: false,
    style: {}, firstElementChild: { style: {} },
    addEventListener(ev, fn){ this._click = fn; }
  });
  const pane = {
    _html: '',
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = v; },
    querySelector(sel){ return nodes[sel] || (nodes[sel] = mk()); }
  };
  return { pane, nodes };
}

/* --- flow A0: mount with globals stripped -> graceful missing-globals note --- */
const SAVED = {};
for (const k of ['getGoldCandles', 'getGoldMacro', 'binanceFunding', 'binanceLongShort', 'computeDXYfromRates']){
  SAVED[k] = globalThis[k]; globalThis[k] = undefined;
}
const SAVED_FETCH = globalThis.fetch; globalThis.fetch = undefined;
{
  const { pane, nodes } = makeFakePane();
  tab.mount(pane);
  assert(/GOLD PRO/.test(pane.innerHTML), 'mount renders the panel title');
  assert(/class="btn" data-gp="run"/.test(pane.innerHTML), 'mount renders the RUN button');
  assert(/class="prog"/.test(pane.innerHTML) && /class="note"/.test(pane.innerHTML) && /data-gp="out"/.test(pane.innerHTML), 'mount renders note + prog + output container');
  assert(nodes['[data-gp="note"]'].className === 'note warn' && /missing globals/.test(nodes['[data-gp="note"]'].textContent), 'mount warns about missing globals without throwing');
}
/* --- flow A: RUN with everything missing -> .empty, never throws --- */
{
  const { pane, nodes } = makeFakePane();
  tab.mount(pane);
  const btn = nodes['[data-gp="run"]'];
  assert(typeof btn._click === 'function', 'RUN button is wired');
  await btn._click();
  const out = nodes['[data-gp="out"]'].innerHTML;
  assert(/class="empty"/.test(out) && /unreachable/.test(out), 'all sources missing -> .empty state rendered');
  assert(nodes['[data-gp="note"]'].className === 'note warn', 'empty-state run ends with a warn note');
  assert(btn.disabled === false, 'RUN button re-enabled after the run');
}

/* --- stubs for the remaining flows --- */
const DAY = 86400;
const today0 = Math.floor(Date.now() / (DAY * 1000)) * DAY; // unix sec, UTC midnight
function synth1d(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 2000 + i * 1.5; // steady uptrend -> above all EMAs, no 50/200 cross
    rows.push({ t: today0 - (n - 1 - i) * DAY, o: c - 3, h: c + 5, l: c - 6, c, v: 100 });
  }
  return rows;
}
function synth4h(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 2300 + i * 2;
    rows.push({ t: today0 - (n - 1 - i) * 14400, o: c - 1, h: c + 2, l: c - 2, c, v: 50 });
  }
  return rows;
}
globalThis.getGoldCandles = async (res) => ({ rows: res === '1d' ? synth1d(400) : synth4h(200), source: 'binance-xau' });
globalThis.getGoldMacro = async () => ({
  dxy: { value: 103.42, date: '2026-01-02', trend20: 'FALLING', change20Pct: -1.4 },
  tnx: 4.21, tnxTrend: 'FALLING', tnxChange20Pct: -3.1,
  silver: 31.2, goldSilverRatio: 78.6, realRateHint: 'TAILWIND'
});
let fundingSym = null, lsSym = null;
globalThis.binanceFunding = async (sym) => { fundingSym = sym; return { fundingPct: 0.0612, markPrice: 2450.5, nextFundingTime: Date.now() }; };
globalThis.binanceLongShort = async (sym) => { lsSym = sym; return { latest: { longPct: 65.2, shortPct: 34.8, ratio: 1.87, t: today0 }, series: [] }; };
globalThis.computeDXYfromRates = SAVED.computeDXYfromRates;

/* --- flow B: frankfurter dead -> degraded run, corr warn, panels render --- */
globalThis.fetch = async () => { throw new Error('network disabled in tests'); };
{
  const { nodes } = makeFakePane();
  tab.mount({ innerHTML: '', querySelector: (s) => nodes[s] || (nodes[s] = { innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, addEventListener(ev, fn){ this._click = fn; } }) });
  await nodes['[data-gp="run"]']._click();
  const out = nodes['[data-gp="out"]'].innerHTML;
  assert(/STRUCTURE/.test(out), 'flow B: structure panel rendered');
  assert(/ABOVE \(/.test(out), 'flow B: price above 200D EMA');
  assert(/none in last 15d/.test(out), 'flow B: monotonic uptrend shows no recent 50/200 cross');
  assert(/4H cascade/.test(out) && /LONG/.test(out), 'flow B: 4H cascade reads LONG');
  assert(/MACRO LEDGER/.test(out), 'flow B: macro ledger rendered');
  assert((out.match(/stamp pass/g) || []).length === 3, 'flow B: M1 DXY + M2 10Y + M3 hint all stamp BULL(pass)');
  assert(/dollar index \(20d trend\)/.test(out) && /FALLING/.test(out), 'flow B: DXY row shows FALLING');
  assert(/Gold\/Silver ratio/.test(out) && /mid-range/.test(out), 'flow B: GSR 78.6 reads mid-range INFO');
  assert(/stamp veto/.test(out) && /contrarian bearish lean/.test(out), 'flow B: extreme positive funding stamps BEAR contrarian');
  assert(/65% long/.test(out) && /retail heavily long/.test(out), 'flow B: retail 65% long stamps contrarian BEAR');
  assert(/XAU perp funding \(8h\)/.test(out), 'flow B: funding row labeled XAU perp');
  assert(/XAU retail long % \(1h\)/.test(out), 'flow B: retail row labeled XAU perp');
  assert(fundingSym === 'XAUUSDT' && lsSym === 'XAUUSDT', 'flow B: funding + long/short requested for XAUUSDT');
  assert(/Frankfurter range fetch failed/.test(out), 'flow B: dead fetch -> correlation warn note');
  assert(/STRUCTURAL BULL/.test(out), 'flow B: verdict computes STRUCTURAL BULL (2+3, corr missing = full weight)');
  assert(/not financial advice/.test(out), 'flow B: not-financial-advice note present');
  assert(/degraded: correlation unavailable/.test(nodes['[data-gp="note"]'].textContent), 'flow B: status note flags the degraded correlation');
  assert(nodes['[data-gp="srcchip"]'].textContent === 'SRC: BINANCE XAU', 'flow B: source chip shows BINANCE XAU');
  /* SL/TP audit — EXECUTION LEVELS on the synthetic 4H uptrend:
     entry 2698, atr 4, 30-bar swing low 2636 -> structural stop 2635 (63 risk),
     T1 = 2R 2824, T2 = 3.5R 2918.5 (exact, deterministic) */
  assert(/EXECUTION LEVELS/.test(out), 'flow B: execution levels panel rendered');
  assert(/dir <b>LONG<\/b>/.test(out), 'flow B: levels direction = LONG cascade');
  assert(/ENTRY <b>2698\.00<\/b>/.test(out), 'flow B: exact ENTRY = last 4H close');
  assert(/STOP <b>2635\.00<\/b>/.test(out), 'flow B: exact STOP = structure stop beyond the 30-bar swing (wider than 1.5xATR)');
  assert(/T1 2824\.00 \(2\.0R\)/.test(out), 'flow B: exact T1 = 2R');
  assert(/T2 2918\.50 \(3\.5R\)/.test(out), 'flow B: exact T2 = 3.5R');
  assert(/risk 2\.34%/.test(out), 'flow B: riskPct = 63/2698');
  assert(/structure beyond the 30-bar swing/.test(out), 'flow B: structural stop note shown');
}

/* --- flow C: frankfurter alive but thin (10 fixes) -> corr guard '---' --- */
function frankfurterPayload(nDays){
  const rates = {};
  let added = 0;
  for (let back = 0; back < 200 && added < nDays; back++){
    const d = new Date((today0 - back * DAY) * 1000);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // business days only, like the ECB
    const ds = d.toISOString().slice(0, 10);
    const i = added;
    rates[ds] = {
      EUR: 0.90 + 0.02 * Math.sin(i / 5), JPY: 148 + 3 * Math.sin(i / 7 + 1),
      GBP: 0.78 + 0.01 * Math.sin(i / 6 + 2), CAD: 1.35 + 0.02 * Math.sin(i / 8),
      SEK: 10.4 + 0.15 * Math.sin(i / 9), CHF: 0.88 + 0.01 * Math.sin(i / 4)
    };
    added++;
  }
  return { amount: 1, base: 'USD', start_date: 'x', end_date: 'y', rates };
}
globalThis.fetch = async (url) => {
  if (!/frankfurter/.test(String(url))) throw new Error('unexpected fetch in test: ' + url);
  return { ok: true, json: async () => frankfurterPayload(10) };
};
{
  const { nodes } = makeFakePane();
  tab.mount({ innerHTML: '', querySelector: (s) => nodes[s] || (nodes[s] = { innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, addEventListener(ev, fn){ this._click = fn; } }) });
  await nodes['[data-gp="run"]']._click();
  const out = nodes['[data-gp="out"]'].innerHTML;
  assert(/GOLD–DXY CORRELATION/.test(out), 'flow C: correlation panel rendered');
  assert(/<span class="big">—<\/span>/.test(out), 'flow C: <30 overlapping pairs -> big dash');
  assert(/insufficient overlap: 9 return pairs/.test(out), 'flow C: guard reports the pair count');
  assert(!/Regime:/.test(out), 'flow C: no regime line under the guard');
}

/* --- flow C2: direct Frankfurter blocked (CSP) -> proxy fallback succeeds --- */
{
  let proxyHit = false;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/proxy') && u.includes('frankfurter')){
      proxyHit = true;
      return { ok: true, json: async () => frankfurterPayload(65) };
    }
    if (/frankfurter/.test(u)) throw new TypeError('Failed to fetch');
    throw new Error('unexpected fetch in flow C2: ' + url);
  };
  const { nodes } = makeFakePane();
  tab.mount({ innerHTML: '', querySelector: (s) => nodes[s] || (nodes[s] = { innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, addEventListener(ev, fn){ this._click = fn; } }) });
  await nodes['[data-gp="run"]']._click();
  const out = nodes['[data-gp="out"]'].innerHTML;
  assert(proxyHit, 'flow C2: direct Frankfurter failure retried via /api/proxy');
  assert(/<span class="big">(-?\d\.\d\d)<\/span>/.test(out), 'flow C2: correlation computed via proxy fallback');
  assert(!/correlation unavailable/.test(out), 'flow C2: no correlation-unavailable warn when proxy succeeds');
}

/* --- flow D: frankfurter alive (65 fixes) -> corr computed + regime --- */
globalThis.fetch = async (url) => {
  if (!/frankfurter/.test(String(url))) throw new Error('unexpected fetch in test: ' + url);
  return { ok: true, json: async () => frankfurterPayload(65) };
};
{
  const { nodes } = makeFakePane();
  tab.mount({ innerHTML: '', querySelector: (s) => nodes[s] || (nodes[s] = { innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, addEventListener(ev, fn){ this._click = fn; } }) });
  await nodes['[data-gp="run"]']._click();
  const out = nodes['[data-gp="out"]'].innerHTML;
  const big = out.match(/<span class="big">(-?\d\.\d\d)<\/span>/);
  assert(!!big, 'flow D: correlation shows a finite 2dp value');
  if (big){
    const c = parseFloat(big[1]);
    assert(c >= -1 && c <= 1, 'flow D: correlation within [-1,1] (got ' + c + ')');
  }
  assert(/pairs <b>60<\/b>/.test(out), 'flow D: 64 return pairs available, capped at the 60-pair window');
  assert(/Regime:/.test(out), 'flow D: regime interpretation line present');
  assert(/window <b>\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}<\/b>/.test(out), 'flow D: alignment window chip shows dates');
  assert(/STRUCTURAL BULL/.test(out), 'flow D: verdict stays STRUCTURAL BULL regardless of corr regime');
}

/* --- flow E: bear stubs -> STRUCTURAL BEAR through the UI --- */
globalThis.getGoldCandles = async (res) => {
  const mk = (n, step, dt) => {
    const rows = [];
    for (let i = 0; i < n; i++){ const c = 2600 - i * step; rows.push({ t: today0 - (n - 1 - i) * dt, o: c + 1, h: c + 2, l: c - 2, c, v: 100 }); }
    return rows;
  };
  return { rows: res === '1d' ? mk(400, 1.2, DAY) : mk(200, 1.5, 14400), source: 'binance-paxg' };
};
globalThis.getGoldMacro = async () => ({
  dxy: { value: 108.9, date: '2026-01-02', trend20: 'RISING', change20Pct: 2.2 },
  tnx: 4.95, tnxTrend: 'RISING', tnxChange20Pct: 4.4,
  silver: 28.1, goldSilverRatio: 85.3, realRateHint: 'HEADWIND'
});
globalThis.binanceFunding = async () => ({ fundingPct: -0.073, markPrice: 2200, nextFundingTime: Date.now() });
globalThis.binanceLongShort = async () => ({ latest: { longPct: 33.5, shortPct: 66.5, ratio: 0.5, t: today0 }, series: [] });
{
  const { nodes } = makeFakePane();
  tab.mount({ innerHTML: '', querySelector: (s) => nodes[s] || (nodes[s] = { innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, addEventListener(ev, fn){ this._click = fn; } }) });
  await nodes['[data-gp="run"]']._click();
  const out = nodes['[data-gp="out"]'].innerHTML;
  assert(/BELOW \(/.test(out), 'flow E: price below 200D EMA');
  assert(/SHORT/.test(out), 'flow E: 4H cascade reads SHORT');
  assert(/STRUCTURAL BEAR/.test(out), 'flow E: verdict computes STRUCTURAL BEAR through the UI');
  assert(/verdict short/.test(out), 'flow E: verdict panel uses the short styling class');
  assert(/&gt;80 — silver historically undervalued; risk-off regime/.test(out), 'flow E: GSR 85.3 shows the >80 risk-off note');
  assert(/shorts crowded: contrarian bullish lean/.test(out), 'flow E: extreme negative funding stamps contrarian BULL');
  assert(/retail heavily short: contrarian bullish lean/.test(out), 'flow E: retail 33% long stamps contrarian BULL');
  assert(nodes['[data-gp="srcchip"]'].textContent === 'SRC: BINANCE PAXG', 'flow E: legacy binance-paxg source label still resolves');
  /* SL/TP audit — bear cascade: entry 2301.5, atr 4, swing high 2348.5 ->
     structural stop 2349.5 (48 risk), T1 2205.5, T2 2133.5 */
  assert(/dir <b>SHORT<\/b>/.test(out), 'flow E: levels direction = SHORT cascade');
  assert(/ENTRY <b>2301\.50<\/b>/.test(out), 'flow E: exact ENTRY');
  assert(/STOP <b>2349\.50<\/b>/.test(out), 'flow E: exact STOP above entry (against direction)');
  assert(/T1 2205\.50 \(2\.0R\)/.test(out) && /T2 2133\.50 \(3\.5R\)/.test(out), 'flow E: exact T1/T2 below entry');
}

/* --- flow F: no gold candles anywhere -> honest levels-unavailable, no fabrication --- */
globalThis.getGoldCandles = async () => ({ rows: [], source: null });
{
  const { nodes } = makeFakePane();
  tab.mount({ innerHTML: '', querySelector: (s) => nodes[s] || (nodes[s] = { innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, addEventListener(ev, fn){ this._click = fn; } }) });
  await nodes['[data-gp="run"]']._click();
  const out = nodes['[data-gp="out"]'].innerHTML;
  assert(/EXECUTION LEVELS/.test(out), 'flow F: levels panel still rendered');
  assert(/levels unavailable — no 4H gold candles/.test(out), 'flow F: honest levels-unavailable reason (nothing fabricated)');
  assert(!/ENTRY <b>/.test(out), 'flow F: no fake ENTRY level printed');
}

/* restore (hygiene only; process exits after) */
globalThis.fetch = SAVED_FETCH;

/* ================= Part 4: HARD REFRESH contract =================
   House contract: refresh is async, NEVER throws, returns a terse status
   string ('skipped: not run yet' before the first user run, 'busy' while a
   run is in flight, 'refreshed' after re-running). Skip paths need a virgin
   module (this shared context already ran flows A–F), so they load
   goldpro.js alone in a fresh vm. No live network anywhere. */
console.log('\n== Part 4: hard refresh contract ==');
assert(typeof tab.refresh === 'function', 'refresh: registration carries a refresh function');

/* (a) skip paths on a virgin module: no deps needed at load/skip time */
{
  const ctx2 = vm.createContext(Object.assign(Object.create(null), {
    window: {}, setTimeout: setTimeout, clearTimeout: clearTimeout
  }));
  vm.runInContext(readFileSync(path.join(root, 'goldpro.js'), 'utf8'), ctx2, { filename: 'goldpro.js' });
  const tab2 = ctx2.window.HG_tabs[0];
  assert(tab2 && typeof tab2.refresh === 'function', 'fresh module: refresh registered');
  let st2 = await tab2.refresh();
  assert(st2 === 'skipped: not run yet', 'fresh module: refresh before mount/run -> "skipped: not run yet" (got "' + st2 + '")');
  let threw2 = null;
  const stub2 = { innerHTML: '', querySelector(){ return { innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, addEventListener(){} }; } };
  try{ tab2.mount(stub2); }catch(e2){ threw2 = e2; }
  assert(!threw2, 'fresh module: mount with zero globals does not throw');
  st2 = await tab2.refresh();
  assert(st2 === 'skipped: not run yet', 'fresh module: mounted but never run -> "skipped: not run yet"');
}

/* (b) refreshed path in the shared context (flows A–F already ran): restub a
   healthy bull world, mount a fresh pane (latest mount wins), refresh */
globalThis.getGoldCandles = async (res) => ({ rows: res === '1d' ? synth1d(400) : synth4h(200), source: 'binance-xau' });
globalThis.getGoldMacro = async () => ({
  dxy: { value: 103.42, date: '2026-01-02', trend20: 'FALLING', change20Pct: -1.4 },
  tnx: 4.21, tnxTrend: 'FALLING', tnxChange20Pct: -3.1,
  silver: 31.2, goldSilverRatio: 78.6, realRateHint: 'TAILWIND'
});
globalThis.binanceFunding = async () => ({ fundingPct: 0.0612, markPrice: 2450.5, nextFundingTime: Date.now() });
globalThis.binanceLongShort = async () => ({ latest: { longPct: 65.2, shortPct: 34.8, ratio: 1.87, t: today0 }, series: [] });
globalThis.fetch = async (url) => {
  if (!/frankfurter/.test(String(url))) throw new Error('unexpected fetch in refresh test: ' + url);
  return { ok: true, json: async () => frankfurterPayload(65) };
};
const gpPane = makeFakePane();
tab.mount(gpPane.pane);
{
  const st = await tab.refresh();
  assert(st === 'refreshed', 'refresh: after user runs -> "refreshed" (got "' + st + '")');
  const outR = gpPane.nodes['[data-gp="out"]'].innerHTML;
  assert(/STRUCTURE/.test(outR) && /ABOVE \(/.test(outR), 'refresh: re-rendered STRUCTURE into the latest mount');
  assert(/STRUCTURAL BULL/.test(outR), 'refresh: recomputed the verdict with the restubbed world');
  const noteR = gpPane.nodes['[data-gp="note"]'].textContent;
  assert(noteR.indexOf('done') === 0,
         'refresh: status note stamped done — got "' + noteR + '"');
}

/* (c) busy: an in-flight run makes refresh report "busy", never double-fetch */
{
  const keepGgc = globalThis.getGoldCandles;
  let releaseGp;
  const gateGp = new Promise(r => { releaseGp = r; });
  globalThis.getGoldCandles = async (res) => { await gateGp; return keepGgc(res); };
  const pRun = gpPane.nodes['[data-gp="run"]']._click();   // user run blocks inside the gate
  const stB = await tab.refresh();
  assert(stB === 'busy', 'refresh: during an in-flight run -> "busy" (got "' + stB + '")');
  releaseGp();
  assert((await pRun) === 'refreshed', 'run: the gated run itself resolves "refreshed"');
  globalThis.getGoldCandles = keepGgc;
  assert((await tab.refresh()) === 'refreshed', 'refresh: recovers after the busy window');
}

/* (d) leg resilience on the refresh path: candles + macro + funding all down
   (frankfurter dead too), retail long/short healthy -> each leg degrades
   honestly and independently, refresh still completes, never throws */
{
  const keepCandles = globalThis.getGoldCandles, keepMacro = globalThis.getGoldMacro,
        keepFund = globalThis.binanceFunding, keepFetch = globalThis.fetch;
  globalThis.getGoldCandles = async () => ({ rows: [], source: null });
  globalThis.getGoldMacro = async () => { throw new Error('macro boom'); };
  globalThis.binanceFunding = async () => { throw new Error('funding boom'); };
  globalThis.fetch = async () => { throw new Error('frankfurter down'); };
  const st = await tab.refresh();
  assert(st === 'refreshed', 'leg resilience: refresh completes with three legs down (degraded, never throws) — got "' + st + '"');
  const outD = gpPane.nodes['[data-gp="out"]'].innerHTML;
  assert(/MACRO LEDGER/.test(outD) && /unavailable/.test(outD),
         'leg resilience: macro leg failure isolated — ledger degrades to unavailable');
  assert(/no gold daily closes — correlation skipped/.test(outD),
         'leg resilience: correlation leg degrades with an honest skip note');
  assert(/XAU retail long % \(1h\)/.test(outD) && /65% long/.test(outD),
         'leg resilience: the healthy retail-positioning leg still renders');
  assert(/degraded:/.test(gpPane.nodes['[data-gp="note"]'].textContent),
         'leg resilience: status note flags the degraded legs');
  globalThis.getGoldCandles = keepCandles; globalThis.getGoldMacro = keepMacro;
  globalThis.binanceFunding = keepFund; globalThis.fetch = keepFetch;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ process.exitCode = 1; }
else console.log('ALL GOLDPRO TESTS PASSED');
