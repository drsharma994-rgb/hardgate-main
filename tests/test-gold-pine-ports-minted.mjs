#!/usr/bin/env node
/* hg-v1166 — the gold Pine ports MINTED record-only on GOLD SCALP and GOLD
   SWING through ONE record-only judge; GOLD SWING forwards the reads at last;
   three more Pine record layers (MACD, Parabolic SAR, Stochastic); four more
   free Yahoo legs (TIP, gold/platinum, USDCNY, the 10y-3m curve slope).

   Asked a third time for more Pine scripts on GANESH GOLD, GOLD SCALP, GOLD
   SWING and OMNIGOLD "to form more accurate setups" with free feeds,
   indicators and strategies, the measured record still refuses a weight
   (hg-v966 / v987 / v945 / v922). So the eight bar-only Pine ports FORM
   setups on the two home desks through each desk's OWN mint and gates, mint
   RECORD-ONLY (demoted, both handoffs withheld, never a ticket claim), are
   recorded under GOLDSCALP / GOLDSWING with the layer as mechanic, and are
   released by the one judge GOLD PINE has read since hg-v1164 -- moved into
   pinegoldmath.js so three desks read one rule. The three new layers' states
   join the PINE STACK marks every gold desk records; GOLD SWING's publish and
   record maps forward freeReads / indReads / fundingPct / pineStates (the
   hg-v1155 gap); four more free legs enter the one free-feed home.

   Sections:
     1  macro.js: the four legs through the URL-routed fetch; dark is null;
        the curve band
     2  the home: twenty keys; the two directional legs and the two state
        reads; the ranker identical with and without them; the line
     3  the three layers: each fires on the last closed bar of a found window,
        both ways, never with a wrong-side stop; the states; the majority
        stays the five; nine marks; the hits helper
     4  the one judge: release / hold / under the floor / no ledger / a floor
        of 10; GOLD PINE delegates to it
     5  GOLD SCALP end to end: Pine ports mint record-only through the real tab,
        recorded with ticket false, the chip and the note, no handoff, never the
        pin; a paying ledger releases; pinegoldmath absent leaves the board as it was
     6  GOLD SWING end to end: the same, plus the three read lines and the
        reads on every record
     7  GANESH GOLD reads the eight states; nothing gated; the cap; the
        catalog; stamps */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const settle = async (n) => { for (let i = 0; i < (n || 3); i++){ await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 0)); } };
const body = (src, head) => { const i = src.indexOf(head); if (i < 0) return ''; return src.slice(i, src.indexOf('\n}\n', i) + 2); };

const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
function tapeEnding(endMs, n, stepSec, seed, amp, drift){
  let s = seed || 99, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let c = 2300;
  const tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
  for (let i = 0; i < n; i++){
    const shock = (rnd() < 0.06) ? (rnd() - 0.5) * (amp || 24) : 0;
    const o = c; c = o + (drift || 0) * (stepSec / 14400) + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
    const w = 0.8 + rnd() * 2.6;
    rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
  }
  return rows;
}
const mirror = rows => rows.map(r => ({ t: r.t, o: 4800 - r.o, h: 4800 - r.l, l: 4800 - r.h, c: 4800 - r.c, v: r.v }));
const ALL_KIDS = [];
function mkEl(){
  const kids = {}, ctl = {};
  const e = { style: {}, innerHTML: '', textContent: '', disabled: false, className: '', dataset: {}, attrs: {}, listeners: {},
    appendChild(){}, setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }, removeEventListener(){},
    click(){ (this.listeners.click || []).forEach(f => f()); },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    querySelector(sel){ return kids[sel] || (kids[sel] = mkEl()); },
    querySelectorAll(sel){
      const m = sel.match(/^\[([a-z0-9-]+)\]$/i);
      if (!m) return [];
      const re = new RegExp(m[1] + '="([^"]*)"', 'g'); const out = []; let x;
      while ((x = re.exec(String(this.innerHTML)))){
        const k = m[1] + '=' + x[1];
        if (!ctl[k]){ ctl[k] = mkEl(); ctl[k].attrs[m[1]] = x[1]; }
        if (out.indexOf(ctl[k]) < 0) out.push(ctl[k]);
      }
      return out;
    } };
  ALL_KIDS.push(e);
  return e;
}
/* every piece of HTML a tab wrote anywhere under a root, hosts included */
function allHtml(){ return ALL_KIDS.map(e => String(e.innerHTML || '')).join('\n'); }
function boot(files, clock, extra){
  const FakeDate = clock ? class extends Date { static now(){ return clock.now; } } : Date;
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date: FakeDate, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, Float64Array, Infinity, NaN,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, setImmediate, AbortController,
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; }, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  const byId = {};
  ctx.document = { createElement: mkEl, getElementById: id => (byId[id] || (byId[id] = mkEl())), querySelector: () => mkEl(), querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => true }, documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
  return ctx;
}
const PINE_MATH = ['pinemath.js', 'pinegoldmath.js'];
const MATH_BASE = ['indicators.js', 'indicators2.js'].concat(PINE_MATH);
const RANK_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js',
                   'goldind.js', 'gold-catalog.js', 'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'hg-setup-core.js'];
const OLD5 = ['supertrend', 'ichimoku', 'donchian', 'emacross', 'keltner'];
const NEW3 = ['macd', 'psar', 'stoch'];
const NEW4 = ['free:tip', 'free:goldPlatinum', 'free:usdcnyRising', 'free:curveSteepening'];
const MACRO_ALL = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                    realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING', realRateSource: 'yahoo',
                    gvzTrend: 'RISING', gvzLast: 18.4, vixLast: 15.2, goldSpxCorr20: 0.45, goldBtcCorr20: -0.52,
                    minersGoldTrend: 'RISING', goldCopperTrend: 'FALLING', goldOilTrend: 'RISING', eurusdTrend: 'FALLING',
                    tipTrend: 'RISING', goldPlatinumTrend: 'FALLING', usdcnyTrend: 'RISING', curveSlopeTrend: 'STEEPENING', curveSlopeChg: 0.3 };
const MACRO_NO4 = Object.assign({}, MACRO_ALL, { tipTrend: null, goldPlatinumTrend: null, usdcnyTrend: null, curveSlopeTrend: null, curveSlopeChg: null });
const COT_LONG = { crowding: 'SPEC CROWDED LONG', zScore: 2.3, reportDate: '2026-04-07' };
const EXP4_LONG = { 'free:tip': true, 'free:goldPlatinum': false, 'free:usdcnyRising': true, 'free:curveSteepening': true };
/* a ledger record through the direct door; the geometry settles on the next bar */
function seedLedger(W, tab, mechanic, n, win, t0){
  for (let i = 0; i < n; i++){
    const barT = t0 - (i + 2) * 900, c = 2300 + i;
    const why = W.hgFwdRecord({ tab, mechanic, sym: 'XAUUSD', tf: '15m', dir: 'long', entry: c, stop: win ? c - 30 : c - 0.5, t1: win ? c + 0.5 : c + 30, barT, feed: 'xm-xauusd', mark: c });
    if (why !== 'recorded') throw new Error('seed: ' + why);
  }
  const rows = []; for (let i = 0; i < n + 4; i++){ const t = t0 - (n + 3 - i) * 900; rows.push({ t, o: 2300, h: 2400, l: 2299.4, c: 2340, v: 1 }); }
  W.hgFwdResolve('XAUUSD', '15m', rows, 'xm-xauusd');
}

/* ------------------------------------------------------------------ 1 */
console.log('== 1) macro.js: the four legs ==');
{
  const DAY = 86400, T0 = 1770000000 - (1770000000 % DAY);
  const chart = closes => ({ chart: { result: [{ timestamp: closes.map((_, i) => T0 + i * DAY), indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1) }] } }] } });
  const ramp = (a, pct, n) => Array.from({ length: n }, (_, i) => a * (1 + pct * i / (n - 1)));
  const legs = { 'GC=F': ramp(2300, 0.002, 24), 'TIP': ramp(108, 0.03, 24), 'PL=F': ramp(1000, 0.06, 24), 'USDCNY=X': ramp(7.1, 0.02, 24), '^TNX': ramp(4.0, 0.075, 24), '^IRX': ramp(4.4, 0, 24), '^VIX': [15, 15.1, 15.2, 15.3, 15.2] };
  const fetched = [];
  const mk = (legsIn) => boot(['macro.js'], null, { binanceKlines: async () => [], fetch: async url => {
    const u = decodeURIComponent(String(url).replace(/^\/api\/proxy\?url=/, ''));
    const sym = (u.match(/finance\/chart\/([^?]+)/) || [])[1];
    if (sym) fetched.push(sym);
    const j = legsIn[sym] ? chart(legsIn[sym]) : null;
    return j ? { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) } : { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  } });
  const m = await mk(legs).getGoldMacro();
  assert(['TIP', 'PL=F', 'USDCNY=X', '^IRX'].every(s => fetched.indexOf(s) >= 0), 'getGoldMacro fetches TIP, PL=F, USDCNY=X and ^IRX (free Yahoo legs)');
  assert(m.tipTrend === 'RISING', 'TIP up 3% over the window reads RISING (real yields falling) (' + m.tipTrend + ')');
  assert(m.goldPlatinumTrend === 'FALLING', 'platinum outrunning gold by 6% reads gold/platinum FALLING (' + m.goldPlatinumTrend + ')');
  assert(m.usdcnyTrend === 'RISING', 'USDCNY up 2% reads RISING (' + m.usdcnyTrend + ')');
  assert(m.curveSlopeTrend === 'STEEPENING' && Math.abs(m.curveSlopeChg - 0.3) < 1e-9, 'the 10y up 30bp against a flat 3m reads the curve STEEPENING by +0.30 (' + m.curveSlopeTrend + ' ' + m.curveSlopeChg + ')');
  const m2 = await mk(Object.assign({}, legs, { '^TNX': ramp(4.0, 0.01, 24) })).getGoldMacro();
  assert(m2.curveSlopeTrend === 'FLAT' && Math.abs(m2.curveSlopeChg - 0.04) < 1e-9, 'a 4bp move in the slope is inside the tenth-of-a-point band: FLAT, the change still carried');
  const m3 = await mk(Object.assign({}, legs, { '^TNX': ramp(4.4, -0.05, 24) })).getGoldMacro();
  assert(m3.curveSlopeTrend === 'FLATTENING', 'the 10y down 22bp against a flat 3m reads FLATTENING');
  const m0 = await mk({}).getGoldMacro();
  assert(m0 && m0.tipTrend === null && m0.goldPlatinumTrend === null && m0.usdcnyTrend === null && m0.curveSlopeTrend === null && m0.curveSlopeChg === null, 'every leg dark: the five fields are null, the shape is kept');
  const m1 = await mk(Object.assign({}, legs, { 'PL=F': undefined, '^IRX': undefined })).getGoldMacro();
  assert(m1.goldPlatinumTrend === null && m1.curveSlopeTrend === null && m1.tipTrend === 'RISING', 'platinum and the bill dark: the ratio and the slope are null while TIP still reads');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the home: twenty keys, the ranker scores nothing on them ==');
{
  const W = boot(RANK_BASE);
  assert(W.HG_GOLD_FREE_KEYS.length === 20 && NEW4.every(k => W.HG_GOLD_FREE_KEYS.indexOf(k) >= 0), 'the key list carries the four hg-v1166 legs (20 keys)');
  const F = { macro: MACRO_ALL, fng: { v: 20 }, fundingRate: -0.05, spot: { verdict: 'shorts-crowding', basisPct: -0.2 }, cot: COT_LONG };
  const L = W.hgGoldFreeFeedVerdicts(F, 'long'), S = W.hgGoldFreeFeedVerdicts(F, 'short');
  assert(NEW4.every(k => L[k] === EXP4_LONG[k]), 'on a long: TIP RISING reads WITH, gold/platinum FALLING reads AGAINST, the yuan rising and the curve steepening read as states (' + JSON.stringify(NEW4.map(k => L[k])) + ')');
  assert(S['free:tip'] === false && S['free:goldPlatinum'] === true && S['free:usdcnyRising'] === true && S['free:curveSteepening'] === true, 'on a short the two directional legs mirror and the two state reads do NOT (a regime is not a side)');
  assert(Object.keys(L).length === 20 && Object.keys(S).length === 20, 'twenty keys, no stowaway');
  const flat = W.hgGoldFreeFeedVerdicts({ macro: Object.assign({}, MACRO_ALL, { tipTrend: 'FLAT', goldPlatinumTrend: null, usdcnyTrend: 'up', curveSlopeTrend: 'FLAT' }) }, 'long');
  assert(NEW4.every(k => flat[k] === undefined), 'FLAT, null, a junk string and a FLAT curve each mark NOTHING');
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback', entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  for (const dir of ['long', 'short']){
    const a = W.goldRankSetups([cand(dir)], { macro: MACRO_ALL, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
    const b = W.goldRankSetups([cand(dir)], { macro: MACRO_NO4, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
    assert(a && b && a.tally === b.tally && JSON.stringify(a.parts) === JSON.stringify(b.parts) && a.grade === b.grade, dir + ': identical tally (' + a.tally + '), parts and grade with and without the four legs');
    assert(NEW4.every(k => a.freeReads[k] !== undefined) && NEW4.every(k => b.freeReads[k] === undefined), dir + ': the marks are on one row and absent on the other');
  }
  const line = W.hgGoldFreeFeedLineHtml(L, { fundingPct: -0.05 });
  assert(/20 of 20 free internet feeds read/.test(line) && /TIPS \(TIP\)<\/b> WITH/.test(line) && /GOLD\/PLATINUM<\/b> AGAINST/.test(line) && /USDCNY<\/b> RISING/.test(line) && /CURVE 10Y-3M<\/b> STEEPENING/.test(line), 'the line prints the four legs in their own words');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) the three layers, the states, the marks, the hits ==');
const firstWindow = (W, fn, opts, rows, from) => {
  for (let k = from || 80; k <= rows.length; k++){ const r = W[fn](rows.slice(0, k), opts); if (r && r.dir) return { k, r }; }
  return null;
};
{
  const W = boot(MATH_BASE);
  const T = W.PINE_GOLD_RECORD_LAYERS;
  assert(T.length === 8 && NEW3.every(id => T.some(l => l.id === id && typeof W[l.fn] === 'function' && l.twin === null)), 'the three new layers sit in the record table with their detectors and name no twin (STOCHRSI-TURN is not the Stochastic cross)');
  assert(Array.isArray(W.PINE_GOLD_MAJORITY_IDS) && W.PINE_GOLD_MAJORITY_IDS.join(',') === OLD5.join(','), 'the majority mark keeps its hg-v1165 population: the five hg-v1164 layers');
  const full = tapeEnding(WED, 600, 900, 11, 24, 0);
  const found = {};
  for (const id of NEW3){
    const l = T.find(x => x.id === id);
    const hit = firstWindow(W, l.fn, l.opts, full, 120);
    found[id] = hit;
    assert(!!hit, 'REACHABILITY: ' + l.label + ' fires on some closed bar of a 600-bar tape (window ' + (hit && hit.k) + ', ' + (hit && hit.r.dir) + ')');
    if (!hit) continue;
    const r = hit.r;
    assert(r.barsAgo === 0 && r.recordOnly === true && r.entry === full[hit.k - 1].c && (r.dir === 'long' ? r.stop < r.entry : r.stop > r.entry) && (r.dir === 'long' ? r.t1 > r.entry : r.t1 < r.entry),
      l.label + ': fires on the LAST closed bar at its close, the stop on the right side, the ladder beyond the entry');
    const prev = W[l.fn](full.slice(0, hit.k - 1), l.opts);
    assert(!prev || !prev.dir, l.label + ': the window one bar shorter does not fire (the signal is dated on its own bar)');
    const mr = W[l.fn](mirror(full.slice(0, hit.k)), l.opts);
    assert(mr && mr.dir && mr.dir !== r.dir, l.label + ': the mirrored tape fires the other way (' + mr.dir + ')');
    if (id === 'macd' || id === 'stoch'){
      /* the first LONG and the first SHORT fire each carry the prior swing on
         the other side -- both sides, so a wrong-side stop on one branch
         cannot hide behind the other */
      for (const want of ['long', 'short']){
        let hw = null;
        for (let k = 120; k <= full.length && !hw; k++){ const x = W[l.fn](full.slice(0, k), l.opts); if (x && x.dir === want) hw = { k, r: x }; }
        assert(!!hw, 'REACHABILITY: ' + l.label + ' fires a ' + want + ' somewhere on the tape (window ' + (hw && hw.k) + ')');
        if (!hw) continue;
        const win = full.slice(hw.k - 1 - l.opts.swing, hw.k - 1);
        const swingStop = want === 'long' ? Math.min.apply(null, win.map(x => x.l)) : Math.max.apply(null, win.map(x => x.h));
        assert(hw.r.stop === swingStop, l.label + ' ' + want + ': the stop is the prior ' + l.opts.swing + '-bar swing on the other side (' + hw.r.stop.toFixed(2) + ')');
      }
    }
  }
  /* the MACD layer fires on every signal cross and on nothing else: the count
     of firing windows over the tape equals the count of crosses an independent
     MACD computation finds */
  {
    const l = T.find(x => x.id === 'macd');
    const cl = full.map(r => r.c), ef = W.ema(cl, 12), es = W.ema(cl, 26);
    const macd = cl.map((_, i) => ef[i] - es[i]), sig = W.ema(macd.map(v => isFinite(v) ? v : 0), 9);
    let crosses = 0, fires = 0;
    for (let k = 120; k <= full.length; k++){
      const i = k - 1;
      if ((macd[i] > sig[i] && macd[i - 1] <= sig[i - 1]) || (macd[i] < sig[i] && macd[i - 1] >= sig[i - 1])) crosses++;
      const r = W[l.fn](full.slice(0, k), l.opts);
      if (r && r.dir) fires++;
    }
    assert(crosses >= 5 && fires === crosses, 'MACD Cross fires on exactly the signal crosses of the tape and never between them (' + fires + ' of ' + crosses + ')');
  }
  const flat = full.map(r => ({ t: r.t, o: 2300, h: 2300.5, l: 2299.5, c: 2300, v: 1 }));
  assert(NEW3.every(id => { const l = T.find(x => x.id === id); const r = W[l.fn](flat, l.opts); return r && !r.dir; }), 'a dead-flat tape fires none of the three');
  assert(NEW3.every(id => { const l = T.find(x => x.id === id); const a = W[l.fn](null, l.opts), b = W[l.fn]([{ t: 1, c: null }], l.opts), c = W[l.fn](full.slice(0, 10), l.opts); return a && !a.dir && b && !b.dir && c && !c.dir; }), 'no rows, a junk row and too few bars: no signal, no throw');
  /* the hits helper: every layer that fired on the last bar, as a mint-shaped hit */
  const hk = found.psar ? found.psar.k : found.stoch.k;
  const hits = W.pineGoldRecordLayerHits(full.slice(0, hk));
  const theHit = hits.find(h => h.id === (found.psar ? 'psar' : 'stoch'));
  assert(hits.length >= 1 && theHit && theHit.kind === 'pine_' + theHit.id && theHit.dir && isFinite(theHit.entry) && isFinite(theHit.stop) && /fired on the last closed bar/.test(theHit.why),
    'pineGoldRecordLayerHits names each firing layer as a mint hit (kind pine_<id>, dir, entry, stop, why)');
  assert(W.pineGoldRecordLayerHits(flat).length === 0 && W.pineGoldRecordLayerHits(null).length === 0, 'a dead-flat tape or no rows: no hits');
  /* states: eight fields, the majority over the five */
  const up = []; let px = 2300; const t0 = Math.floor(WED / 1000) - 300 * 900;
  for (let i = 0; i < 300; i++){ const o = px, c = o + 1.5 + Math.sin(i / 9) * 0.4; up.push({ t: t0 + i * 900, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.5, c, v: 1000 }); px = c; }
  const su = W.pineGoldLayerStates(up);
  assert(su.ok === true && NEW3.every(id => su[id] === 'long') && su.readable === 8 && su.allLong === 8 && su.agreeLong === 5, 'a clean uptrend: MACD, SAR and Stochastic all read LONG; eight readable; the five-layer majority tally stays five');
  const sd = W.pineGoldLayerStates(mirror(up));
  assert(NEW3.every(id => sd[id] === 'short') && sd.allShort === 8, 'the mirrored tape: all three SHORT');
  const sf = W.pineGoldLayerStates(up.map(r => ({ t: r.t, o: 2300, h: 2300.5, l: 2299.5, c: 2300, v: 1 })));
  assert(sf.ok === true && sf.macd === null && sf.stoch === null, 'a dead-flat tape: the MACD line equals its signal and %K equals %D -- NEITHER, never guessed');
  const onlyNew = { ok: true, supertrend: null, ichimoku: null, donchian: null, emacross: null, keltner: null, macd: 'long', psar: 'long', stoch: 'long', readable: 3, allLong: 3, allShort: 0, agreeLong: 0, agreeShort: 0 };
  const mN = W.pineGoldPineMarks(onlyNew, 'long');
  assert(mN['pine:macdWith'] === true && mN['pine:psarWith'] === true && mN['pine:stochWith'] === true && mN['pine:majorityWith'] === undefined && Object.keys(mN).length === 3,
    'three new layers WITH and the five unread: three marks and NO majority (the three do not move the five-layer majority)');
  const mL = W.pineGoldPineMarks(su, 'long'), mS = W.pineGoldPineMarks(su, 'short');
  assert(Object.keys(mL).length === 9 && Object.keys(mL).every(k => mL[k] === true) && Object.keys(mS).every(k => mS[k] === false), 'all-long states: nine marks WITH on a long, nine AGAINST on a short');
  const html = W.pineGoldStackLineHtml(su, mL);
  assert(/8 of 8 gold Pine layers readable/.test(html) && /MACD Cross<\/b> LONG/.test(html) && /Parabolic SAR Flip<\/b> LONG/.test(html) && /Stochastic Cross<\/b> LONG/.test(html) && /five hg-v1164 layers/.test(html), 'the line prints the three new states and names the majority population');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) the one record-only judge ==');
{
  const JUDGE_BASE = ['indicators.js', 'indicators2.js', 'hg-forward.js'].concat(PINE_MATH);
  const mkRow = () => ({ strategy: 'MACD Cross', stratKey: 'pine_macd', recordOnly: true, recordLayer: 'macd', demoted: true, demotedWhy: 'RECORD ONLY' });
  const t0 = Math.floor(WED / 1000);
  const W = boot(JUDGE_BASE);
  seedLedger(W, 'GOLDSCALP', 'PINE_MACD', 20, true, t0);
  const s = W.pineGoldRecordJudge(mkRow(), 'GOLDSCALP', 'PINE_MACD');
  assert(s.recordJudge.measured === true && s.recordJudge.n === 20 && s.recordJudge.paying === true && s.recordReleased === true && s.recordOnly === false && s.demoted === false && s.demotedWhy === undefined,
    '20 settled wins under GOLDSCALP / PINE_MACD: measured, paying, RELEASED (not record-only, not demoted)');
  assert(s.recordJudge.pool === 'GOLDSCALP' && s.recordJudge.mechanic === 'PINE_MACD', 'the judge names the pool and the mechanic it read');
  const Wl = boot(JUDGE_BASE);
  seedLedger(Wl, 'GOLDSCALP', 'PINE_MACD', 20, false, t0);
  const sl = Wl.pineGoldRecordJudge(mkRow(), 'GOLDSCALP', 'PINE_MACD');
  assert(sl.recordJudge.measured === true && sl.recordJudge.paying === false && sl.recordOnly === true && sl.demoted === true && /PINE_MACD measured 20 settled at −1\.000R on this desk, not paying/.test(sl.demotedWhy),
    '20 settled losses: measured and NOT paying stays record-only and says the figure');
  const Wu = boot(JUDGE_BASE);
  seedLedger(Wu, 'GOLDSCALP', 'PINE_MACD', 19, true, t0);
  const su = Wu.pineGoldRecordJudge(mkRow(), 'GOLDSCALP', 'PINE_MACD');
  assert(su.recordJudge.measured === false && su.recordJudge.n === 19 && su.recordOnly === true && !su.recordReleased, '19 wins stay under the floor of 20: not measured, still record-only, the count said');
  const sp = W.pineGoldRecordJudge(mkRow(), 'GOLDSWING', 'PINE_MACD');
  assert(sp.recordJudge.n === 0 && sp.recordOnly === true, 'the same mechanic under another pool reads its OWN record: nothing settled on GOLDSWING, still record-only');
  const sm = W.pineGoldRecordJudge(mkRow(), 'GOLDSCALP', 'PINE_PSAR');
  assert(sm.recordJudge.n === 0 && sm.recordOnly === true, 'another mechanic under the same pool reads its own record too');
  const Wf = boot(JUDGE_BASE, null, { HG_GOLD_FWD_MIN_JUDGE: 10 });
  seedLedger(Wf, 'GOLDSCALP', 'PINE_MACD', 12, true, t0);
  const sf = Wf.pineGoldRecordJudge(mkRow(), 'GOLDSCALP', 'PINE_MACD');
  assert(Wf.pineGoldRecordFloor() === 10 && sf.recordReleased === true && sf.recordJudge.floor === 10, 'the floor is HG_GOLD_FWD_MIN_JUDGE read at call time: a floor of 10 releases on 12');
  const W0 = boot(MATH_BASE);
  const s0 = W0.pineGoldRecordJudge(mkRow(), 'GOLDSCALP', 'PINE_MACD');
  assert(s0.recordJudge && s0.recordJudge.n === 0 && s0.recordOnly === true && !s0.recordReleased, 'with no ledger loaded nothing is measured and nothing is released');
  assert(W.pineGoldRecordJudge(null, 'GOLDSCALP', 'x') === null, 'no row: null, no throw');
  /* the chip and the note */
  assert(/data-hg-record-chip="released"/.test(W.pineGoldRecordChipHtml(s)) && /MEASURED · 20 settled \+0\.\d{3}R/.test(W.pineGoldRecordChipHtml(s)), 'a released row prints the MEASURED chip with its figure (' + s.recordJudge.expR.toFixed(3) + 'R)');
  assert(/data-hg-record-chip="record-only"/.test(W.pineGoldRecordChipHtml(su)) && /19 of 20 settled/.test(W.pineGoldRecordChipHtml(su)), 'an unmeasured row prints RECORD ONLY with the count toward the floor');
  assert(W.pineGoldRecordChipHtml({ strategy: 'x' }) === '' && W.pineGoldRecordNoteHtml(s, 'GOLDSCALP') === '', 'a row that is neither prints no chip; a released row prints no withheld note');
  const note = W.pineGoldRecordNoteHtml(sl, 'GOLDSCALP');
  assert(/data-hg-record-note="1"/.test(note) && /NO TRADE HANDOFF/.test(note) && /recorded under GOLDSCALP/.test(note) && /not paying/.test(note), 'the withheld note names the pool and the state');
  /* GOLD PINE delegates */
  const gp = strip(read('goldpine.js'));
  assert(/pineGoldRecordJudge/.test(body(gp, 'function gpRecordLayerJudge(')) && !/hgFwdJudgeSample|hgFwdStats/.test(body(gp, 'function gpRecordLayerJudge(')), 'gpRecordLayerJudge delegates to the one home and reads no ledger of its own (textual, hg-v956)');
  const Wg = boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js', 'goldind.js', 'gold-catalog.js', 'gold-best-levels.js'].concat(PINE_MATH).concat(['goldpine.js']));
  const calls = [];
  const realJ = Wg.pineGoldRecordJudge;
  Wg.pineGoldRecordJudge = function(s, pool, mech){ calls.push([pool, mech]); return realJ(s, pool, mech); };
  const tab = Wg.HG_tabs.find(t => t && t.id === 'goldpine');
  const row = { layerLabel: 'Supertrend 10x3', recordOnly: true, demoted: true };
  tab.recordLayerJudge(row, 'scalp');
  assert(calls.length === 1 && calls[0][0] === 'GOLDPINE:scalp' && calls[0][1] === 'Supertrend 10x3' && row.recordJudge && row.recordJudge.n === 0, 'GOLD PINE hands the home its own pool (GOLDPINE:<lane>) and mechanic (the layer label)');
}

/* ------------------------------------------------------------------ 5 */
console.log('== 5) GOLD SCALP end to end ==');
const SCALP_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                    'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'goldscalp.js', 'accuracy-floor.js'];
async function scalpRun(opts){
  opts = opts || {};
  const seed = opts.seed || 131;
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '15m': tapeEnding(WED, 420, 900, seed, 24, (seed % 3) * 6 - 6), '1h': tapeEnding(WED, 240, 3600, seed + 1, 30, 0), '4h': tapeEnding(WED, 300, 14400, seed + 2, 40, 6), '1d': tapeEnding(WED, 280, 86400, seed + 3, 60, 20) };
  const W = boot(SCALP_BASE.concat(opts.noPine ? [] : PINE_MATH), clock, {
    getXmGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' }),
    getGoldCandles: async () => ({ rows: [], source: null }),
    getGoldMacro: async () => MACRO_ALL, getGoldMacroCached: () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG,
    binanceFunding: async () => ({ fundingPct: -0.05 }), hgGoldLoadDeltaPerp: async () => null, hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    /* the two handoffs the desk prints, so withholding them is observable */
    hgToTradePlanOnclickAttr: () => 'void(0)', bookBtnHTML: () => '<button class="hgbook">ADD TO BOOK</button>'
  });
  if (opts.seedLedger) opts.seedLedger(W);
  const before = ALL_KIDS.length;
  const tab = W.HG_tabs.find(t => t && t.id === 'goldscalp');
  const el = mkEl();
  tab.mount(el);
  const t0 = Date.now();
  let snap = null;
  while (Date.now() - t0 < 30000){ await settle(3); snap = W.goldscalpScan && W.goldscalpScan(); if (snap && snap.cands && snap.cands.length) break; }
  const html = ALL_KIDS.slice(before).map(e => String(e.innerHTML || '')).join('\n');
  return { W, tapes, snap, recs: W.hgFwdRecords('GOLDSCALP') || [], html };
}
{
  const r = await scalpRun({ seed: 131 });
  const pine = (r.snap.cands || []).filter(c => c.recordOnly);
  assert(pine.length >= 1 && pine.every(c => /^pine_/.test(c.stratKey) && c.demoted === true && c.recordLayer && /RECORD ONLY/.test(c.demotedWhy || '')),
    'REACHABILITY: GOLD SCALP minted ' + pine.length + ' Pine ports record-only through its own mint (' + pine.map(c => c.stratKey + ':' + c.dir).join(', ') + ')');
  assert(pine.every(c => c.recordJudge && c.recordJudge.pool === 'GOLDSCALP' && c.recordJudge.mechanic === String(c.stratKey).toUpperCase() && c.recordJudge.n === 0 && !c.recordReleased), 'each was judged under GOLDSCALP with its own mechanic and, with nothing settled, stays record-only');
  const exp = r.W.pineGoldRecordLayerHits(r.tapes['15m']);
  assert(exp.length >= pine.length && pine.every(c => exp.some(h => h.kind === c.stratKey && h.dir === c.dir)), 'every minted port is a layer that fired on the last closed 15m bar');
  const prec = r.recs.filter(x => /^PINE_/.test(x.mechanic));
  assert(prec.length === pine.length && prec.every(x => x.ticket === false && x.reads && Object.keys(x.reads).some(k => /^pine:/.test(k)) && NEW4.every(k => x.reads[k] !== undefined)),
    'each is recorded under GOLDSCALP with the layer as mechanic, ticket FALSE, the pine: marks and the four new free legs on the record');
  assert(r.recs.every(x => x.reads && NEW4.every(k => x.reads[k] !== undefined)), 'every GOLD SCALP record carries the four new legs');
  assert(!r.snap.bestId || !pine.some(c => c.id === r.snap.bestId), 'the MOST PROBABLE pin is never a record-only port');
  const chips = (r.html.match(/data-hg-record-chip="record-only"/g) || []).length, notes = (r.html.match(/data-hg-record-note="1"/g) || []).length;
  assert(chips >= pine.length && notes >= pine.length, 'every record-only card prints the RECORD ONLY chip and the withheld-handoff note (' + chips + ' / ' + notes + ')');
  /* the card of a record-only port carries no handoff button */
  const lbl = pine[0].strategy;
  const segsAll = r.html.split('<div class="card gsx-card').slice(1);
  const segs = segsAll.filter(s => s.indexOf(lbl) >= 0 && /data-hg-record-note="1"/.test(s));
  const plain = segsAll.filter(s => !/data-hg-record-note="1"/.test(s) && !/data-hg-record-chip/.test(s));
  assert(plain.length >= 1 && plain.some(s => /class="toTrade"/.test(s) && /ADD TO BOOK/.test(s)), 'REACHABILITY: a card that is not a port prints both handoffs in this harness (' + plain.length + ')');
  assert(segs.length >= 1 && segs.every(s => !/class="toTrade"/.test(s) && !/ADD TO BOOK/.test(s)), 'the record-only card prints neither SEND TO TRADE PLAN nor ADD TO BOOK');
  /* the mint itself demotes the port -- read straight off goldScalpSetups,
     before the tab's other demotes (the hg-v1156 lead-set policy) land on it */
  const direct = r.W.goldScalpSetups({ rows15m: r.tapes['15m'], rows1h: r.tapes['1h'], rows4h: r.tapes['4h'], rows1d: r.tapes['1d'], now: WED + 16 * 60 * 1000, news: null, macro: MACRO_ALL, candleSource: 'xm-xauusd' }) || [];
  const dp = direct.filter(c => c.recordOnly);
  assert(dp.length === pine.length && dp.every(c => c.demoted === true && /RECORD ONLY/.test(c.demotedWhy) && c.recordJudge), 'the mint itself demotes every port and judges it, before any other rule runs');
  /* a paying ledger releases the port, and the record claim follows */
  const t0 = Math.floor(WED / 1000);
  const rr = await scalpRun({ seed: 131, seedLedger: W => seedLedger(W, 'GOLDSCALP', String(pine[0].stratKey).toUpperCase(), 20, true, t0) });
  const rel = (rr.snap.cands || []).find(c => c.stratKey === pine[0].stratKey);
  assert(rel && rel.recordReleased === true && rel.recordOnly === false && rel.recordJudge.measured === true && rel.recordJudge.paying === true, 'with 20 settled wins under GOLDSCALP the same port is RELEASED (not record-only) on the next scan');
  assert(/data-hg-record-chip="released"/.test(rr.html), 'and its card prints the MEASURED chip');
  const other = (rr.snap.cands || []).filter(c => c.recordOnly && c.stratKey !== pine[0].stratKey);
  assert(other.every(c => !c.recordReleased), 'the release is per mechanic: the other ports stay record-only (' + other.length + ')');
  /* pinegoldmath absent: no port, the rest of the board as it was */
  const r0 = await scalpRun({ seed: 131, noPine: true });
  const sig = cs => cs.filter(c => !/^pine_/.test(c.stratKey)).map(c => [c.stratKey, c.dir, c.entry, c.stop, c.t1, c.grade, c.demoted].join('|')).sort().join('\n');
  assert(!(r0.snap.cands || []).some(c => c.recordOnly) && sig(r0.snap.cands || []) === sig(r.snap.cands || []), 'with pinegoldmath absent no port mints and every other row forms byte-identically');
}

/* ------------------------------------------------------------------ 6 */
console.log('== 6) GOLD SWING end to end ==');
const SWING_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                    'goldind.js', 'gold-best-levels.js', 'conviction-lock.js', 'gold-catalog.js', 'goldswing.js', 'accuracy-floor.js'];
async function swingRun(opts){
  opts = opts || {};
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '4h': tapeEnding(WED, 300, 14400, 124, 40, 6), '1d': tapeEnding(WED, 280, 86400, 125, 60, 20), '1h': tapeEnding(WED, 220, 3600, 123, 30, 0) };
  const W = boot(SWING_BASE.concat(opts.noPine ? [] : PINE_MATH), clock, {
    getXmGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' }),
    getGoldCandles: async () => ({ rows: [], source: null }),
    getGoldMacro: async () => MACRO_ALL, getGoldMacroCached: () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG,
    binanceFunding: async () => ({ fundingPct: -0.05 }), hgGoldLoadDeltaPerp: async () => null, hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    hgToTradePlanOnclickAttr: () => 'void(0)', bookBtnHTML: () => '<button class="hgbook">ADD TO BOOK</button>'
  });
  if (opts.seedLedger) opts.seedLedger(W);
  const before = ALL_KIDS.length;
  const tab = W.HG_tabs.find(t => t && t.id === 'goldswing');
  const el = mkEl();
  tab.mount(el);
  await tab.refresh();
  await settle(4);
  const snap = W.goldswingScan();
  const html = ALL_KIDS.slice(before).map(e => String(e.innerHTML || '')).join('\n');
  return { W, tapes, snap, recs: W.hgFwdRecords('GOLDSWING') || [], html };
}
{
  const r = await swingRun();
  const cands = (r.snap && r.snap.cands) || [];
  const pine = cands.filter(c => c.recordOnly);
  assert(cands.length >= 1 && pine.length >= 1 && pine.every(c => /^pine_/.test(c.stratKey) && c.demoted === true && /RECORD ONLY/.test(c.demotedWhy || '')),
    'REACHABILITY: GOLD SWING minted ' + pine.length + ' Pine port(s) record-only through mkCand and push (' + pine.map(c => c.stratKey + ':' + c.dir).join(', ') + ' of ' + cands.length + ' rows)');
  const exp = r.W.pineGoldRecordLayerHits(r.tapes['4h']);
  assert(pine.every(c => exp.some(h => h.kind === c.stratKey && h.dir === c.dir)), 'every minted port is a layer that fired on the last closed 4h bar');
  assert(pine.every(c => c.recordJudge && c.recordJudge.pool === 'GOLDSWING' && c.recordJudge.mechanic === String(c.stratKey).toUpperCase()), 'each was judged under GOLDSWING with its own mechanic');
  /* the hg-v1155 gap: every record carries the reads */
  assert(r.recs.length >= 1 && r.recs.every(x => x.reads && Object.keys(x.reads).some(k => /^free:/.test(k)) && Object.keys(x.reads).some(k => /^ind:/.test(k)) && Object.keys(x.reads).some(k => /^pine:/.test(k)) && NEW4.every(k => x.reads[k] !== undefined)),
    'every GOLD SWING record carries free:, ind: and pine: marks and the four new legs (the hg-v1155 gap, closed)');
  const expP = r.W.pineGoldPineMarks(r.W.pineGoldLayerStates(r.tapes['4h']), r.recs[0].dir);
  assert(Object.keys(expP).length >= 3 && Object.keys(expP).every(k => r.recs[0].reads[k] === expP[k]), 'the pine: marks are read off the 4h tape for the record\'s own direction');
  const prec = r.recs.filter(x => /^PINE_/.test(x.mechanic));
  assert(prec.length === pine.length && prec.every(x => x.ticket === false), 'the port records claim no ticket');
  assert(cands.every(c => c.freeReads && c.pineStates && c.pineStates.ok === true), 'the published snapshot carries freeReads and pineStates on every row');
  assert(/data-hg-free-feeds="1"/.test(r.html) && /data-hg-ind-stack="1"|INDICATOR STACK/.test(r.html) && /data-hg-pine-stack="1"/.test(r.html), 'the GOLD SWING cards print the FREE FEEDS, INDICATOR STACK and PINE STACK lines');
  assert(/data-hg-record-chip="record-only"/.test(r.html) && /data-hg-record-note="1"/.test(r.html) && /recorded under GOLDSWING/.test(r.html), 'the record-only card prints the chip and the note naming GOLDSWING');
  const lbl = pine[0].strategy;
  const segsAll = r.html.split('<div class="card gsw-card').slice(1);
  const segs = segsAll.filter(s => s.indexOf(lbl) >= 0 && /data-hg-record-note="1"/.test(s));
  const plain = segsAll.filter(s => !/data-hg-record-note="1"/.test(s) && !/data-hg-record-chip/.test(s));
  assert(plain.length >= 1 && plain.some(s => /class="toTrade"/.test(s) && /ADD TO BOOK/.test(s)), 'REACHABILITY: a swing card that is not a port prints both handoffs in this harness (' + plain.length + ')');
  assert(segs.length >= 1 && segs.every(s => !/class="toTrade"/.test(s) && !/ADD TO BOOK/.test(s)), 'the record-only swing card prints neither handoff');
  /* the mint itself demotes the port: with a pass-through ranker (so the
     ranker's own CONF NO TRADE demote cannot stand in for it) the row that
     leaves goldSwingSetups is already demoted and judged */
  r.W.goldRankSetups = cands => ({ ranked: cands.filter(c => c && !c.dropped), best: null, rejected: cands.filter(c => c && c.dropped) });
  const direct = r.W.goldSwingSetups({ rows4h: r.tapes['4h'], rows1d: r.tapes['1d'], now: WED + 16 * 60 * 1000, news: null, macro: MACRO_ALL }) || {};
  const dp = (direct.ranked || []).filter(c => c.recordOnly);
  assert(dp.length >= 1 && dp.every(c => c.demoted === true && /RECORD ONLY/.test(c.demotedWhy) && c.recordJudge && c.recordJudge.pool === 'GOLDSWING'), 'the swing mint itself demotes and judges every port before the ranker runs');
  assert(!r.snap.bestId || !pine.some(c => c.id === r.snap.bestId), 'the pin is never a record-only port');
  const t0 = Math.floor(WED / 1000);
  const rr = await swingRun({ seedLedger: W => seedLedger(W, 'GOLDSWING', String(pine[0].stratKey).toUpperCase(), 20, true, t0) });
  const rel = ((rr.snap && rr.snap.cands) || []).find(c => c.stratKey === pine[0].stratKey);
  assert(rel && rel.recordReleased === true && rel.recordOnly === false, 'with 20 settled wins under GOLDSWING the port is released');
  const r0 = await swingRun({ noPine: true });
  const sig = cs => cs.filter(c => !/^pine_/.test(c.stratKey)).map(c => [c.stratKey, c.dir, c.entry, c.stop, c.t1, c.grade].join('|')).sort().join('\n');
  assert(!((r0.snap && r0.snap.cands) || []).some(c => c.recordOnly) && sig((r0.snap && r0.snap.cands) || []) === sig(cands) && r0.recs.every(x => !Object.keys(x.reads || {}).some(k => /^pine:/.test(k))),
    'with pinegoldmath absent no port mints, the other rows form byte-identically, and no pine: mark is made');
}

/* ------------------------------------------------------------------ 7 */
console.log('== 7) GANESH GOLD reads the eight states; nothing gated; the cap; the catalog; stamps ==');
{
  const M15 = 900, H4 = 14400, D1 = 86400, DAY0 = 1761609600;
  const mkTape = (n, tf, make) => { const rows = []; for (let i = 0; i < n; i++) rows.push(Object.assign({ t: DAY0 + i * tf }, make(i))); return rows; };
  const longTape = () => {
    const rows = [];
    for (let i = 0; i < 240; i++){ const c = 2600 - i * 0.05; rows.push({ t: DAY0 + i * M15, o: c, h: c + 1, l: c - 1, c, v: 100 }); }
    rows[232] = { t: DAY0 + 232 * M15, o: 2552, h: 2553, l: 2525, c: 2546, v: 500 };
    rows[233] = { t: DAY0 + 233 * M15, o: 2546, h: 2568, l: 2545, c: 2566, v: 600 };
    rows[234] = { t: DAY0 + 234 * M15, o: 2566, h: 2578, l: 2564, c: 2576, v: 400 };
    const ret = [{ o: 2576, h: 2577, l: 2566, c: 2568 }, { o: 2568, h: 2569, l: 2559, c: 2562 }, { o: 2562, h: 2563, l: 2555, c: 2557 }, { o: 2557, h: 2558, l: 2552, c: 2554 }, { o: 2554, h: 2556, l: 2551, c: 2553 }];
    for (let i = 0; i < ret.length; i++) rows[235 + i] = Object.assign({ t: DAY0 + (235 + i) * M15, v: 100 }, ret[i]);
    return rows;
  };
  const mkDay = () => mkTape(10, D1, i => ({ o: 2600 - i * 10, h: 2700 - i * 5, l: 2550 - i * 2, c: 2605 - i * 10, v: 1000 }));
  const W = boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'hg-forward.js', 'goldind.js', 'gold-catalog.js'].concat(PINE_MATH).concat(['ganeshgold.js']), null, {
    getXAUCandles: async tf => (tf === '15m' ? longTape() : (tf === '4h' ? mkTape(100, H4, i => ({ o: 2500 + i, h: 2502 + i, l: 2498 + i, c: 2501 + i, v: 400 })) : mkDay())),
    regimeState: () => ({ dxy: { trend20: 'FALLING' }, tnx: { trend: 'FALLING' } }),
    hgNewsRisk: () => ({ blackout: false }),
    hgGoldGateAt: () => ({ weekend: { inWeekend: false }, lock: false }),
    getGoldMacroCached: () => MACRO_ALL, goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG, binanceFunding: async () => ({ fundingPct: -0.05 })
  });
  const snap = await W.ganeshGoldScan({ style: 'scalp' });
  const recs = W.hgFwdRecords('GANESHGOLD') || [];
  assert(snap && snap.plan && snap.plan.tier === 'TICKET' && recs.length === 1, 'REACHABILITY: GANESH GOLD crowns a TICKET and records it');
  const expG = W.pineGoldPineMarks(W.pineGoldLayerStates(longTape()), snap.plan.dir);
  const newG = NEW3.map(id => 'pine:' + id + 'With').filter(k => expG[k] !== undefined);
  assert(newG.length >= 1 && newG.every(k => recs[0].reads[k] === expG[k]) && NEW4.every(k => recs[0].reads[k] !== undefined), 'the record carries the new layers\' states (' + newG.join(', ') + ') and the four new legs, through the same home with no edit');
  assert(snap.plan.pineStates.readable === W.pineGoldLayerStates(longTape()).readable && snap.plan.pineStates.readable >= 4, 'the call reads all eight layers (' + snap.plan.pineStates.readable + ' readable on this tape)');
  /* nothing gated */
  for (const f of ['hg-gates.js', 'cryptogates.js', 'engine.js', 'gold-best-levels.js', 'gold-formation.js', 'hg-solidity.js', 'plans.js', 'conviction-lock.js']){
    assert(!/['"]pine:|recordOnly|recordReleased|tipTrend|goldPlatinum|usdcny|curveSlope/.test(strip(read(f))), f + ' names no hg-v1166 mark or field');
  }
  const gi = strip(read('goldind.js'));
  assert(!/free:tip|free:goldPlatinum|free:usdcnyRising|free:curveSteepening/.test(body(gi, 'function goldRankSetups(')), 'the ranker names none of the four new legs (the home marks them; it scores nothing)');
  assert(!/pineStates\.(macd|psar|stoch)/.test(gi) && !/freeReads\[\s*['"]pine:/.test(gi), 'the ranker never reads a new state or a pine: mark back (textual)');
  assert(!/recordOnly|recordReleased/.test(body(gi, 'function goldRankSetups(')), 'goldRankSetups does not read the record-only mark: the demote it carries is the hg-v1005 field the pick already sinks');
  const gs = strip(read('goldscalp.js')), gw = strip(read('goldswing.js'));
  assert(!/recordOnly|recordReleased/.test(body(gs, 'function gsPickBest(')) && !/recordOnly|recordReleased/.test(body(gw, 'function pickBest(')), 'neither leader picker reads the record-only mark (the demote decides, as for every demoted row)');
  /* the cap */
  const Wr = boot(RANK_BASE.concat(PINE_MATH));
  const KEYS = Wr.HG_GOLD_FREE_KEYS.length + 2 + Object.keys(Wr.hgGoldIndicatorMarks(Wr.hgGoldIndicatorReads(tapeEnding(WED, 300, 900, 102, 24, 0), { rows1d: tapeEnding(WED, 280, 86400, 105, 60, 20) }), 'long')).length + 9;
  assert(KEYS <= 64 && KEYS >= 45, 'twenty free: + two PERFECT + the indicator stack read on this tape + nine pine: = ' + KEYS + ' keys, inside the 64 cap');
  /* the catalog says what it read for the curve, and does not call the 10Y/2Y row USED */
  const Wc = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js']);
  const f = Wc.hgGoldCatalogFeed(tapeEnding(WED, 300, 900, 102, 24, 0), { ctx: { macro: MACRO_ALL, now: WED } });
  const r147 = f.unchecked.find(r => r.id === 147);
  assert(r147 && !f.used.some(r => r.id === 147) && /10Y-3M slope/.test(r147.note) && /steepening/.test(r147.note) && /free:curveSteepening/.test(r147.note), '#147 (10Y/2Y) stays UNCHECKED and says the 10Y-3M slope was read instead');
  const bs = read('build-stamp.js');
  assert(bs.includes("version: '" + HG_VER + "'"), 'build-stamp.js version is ' + HG_VER);
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + ' ' + pass + ' assertions' + (fail ? ' (' + fail + ' failed)' : ''));
process.exit(fail ? 1 : 0);
