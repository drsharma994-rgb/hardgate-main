#!/usr/bin/env node
/* hg-v1167 — four more bar-only gold Pine record layers (Chandelier Exit,
   Hull MA turn, CCI re-entry with its exact OMNIGOLD twin CCI-EXTREME, Aroon
   cross) on every gold desk that reads the one home, and three more free
   Yahoo legs (gold/palladium, credit appetite HYG/LQD, the GLD volume print).

   Asked a fourth time for more Pine scripts on GANESH GOLD, GOLD SCALP, GOLD
   SWING, OMNIGOLD and GOLD PINE "to form more accurate setups" with free
   feeds, indicators and strategies, the measured record still refuses a
   weight (hg-v966 / v987 / v945 / v922). So the four join the record table
   hg-v1164 built: their STATES ride the PINE STACK marks on every record of
   the five desks with no desk edit (the desks iterate the table), they MINT
   record-only on GOLD SCALP, GOLD SWING and GOLD PINE through each desk's own
   gates and the one judge (hg-v1166), and the CCI layer quotes its twin's
   gate-clear record the way the Ichimoku layer does. The three legs enter
   the one free-feed home; the GLD volume reader refuses the open session.

   Sections:
     1  macro.js: the four Yahoo legs; the ratio trends; the GLD volume print
        reads the last COMPLETE session and never the open one; dark is null
     2  the home: twenty-three keys; one directional leg and two state reads;
        the ranker identical with and without; the line
     3  the four layers: each fires on the last closed bar of a found window,
        both ways, never one bar early, mirrored; the swing stops; the CCI
        layer fires on exactly the re-entries; the states (twelve); thirteen
        marks; the majority stays the five; the hits; the twin record
     4  GOLD PINE end to end: the four mint record-only through the real tab,
        recorded under GOLDPINE:<lane>; the CCI card quotes CCI-EXTREME, the
        Aroon card quotes none
     5  GOLD SCALP end to end: two of the four mint record-only through the
        real tab on the hg-v1166 tape, recorded with the three new legs and
        the new states; release per mechanic
     6  GOLD SWING: a port that fired on the 4h bar is refused by the desk's
        own confluence rule (recorded nowhere, named in the rejects); the
        records that do form carry the new states
     7  OMNIGOLD and GANESH GOLD read the twelve with no edit; nothing gated;
        the cap; the catalog; stamps */
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
const OLD8 = OLD5.concat(['macd', 'psar', 'stoch']);
const NEW4 = ['chandelier', 'hullma', 'cci', 'aroon'];
const NEW3K = ['free:goldPalladium', 'free:creditRiskOn', 'free:gldVolumeHigh'];
const MACRO_ALL = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                    realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'FALLING', realRateSource: 'yahoo',
                    gvzTrend: 'RISING', gvzLast: 18.4, vixLast: 15.2, goldSpxCorr20: 0.45, goldBtcCorr20: -0.52,
                    minersGoldTrend: 'RISING', goldCopperTrend: 'FALLING', goldOilTrend: 'RISING', eurusdTrend: 'FALLING',
                    tipTrend: 'RISING', goldPlatinumTrend: 'FALLING', usdcnyTrend: 'RISING', curveSlopeTrend: 'STEEPENING', curveSlopeChg: 0.3,
                    goldPalladiumTrend: 'RISING', creditTrend: 'FALLING', gldVolumeRel: 1.62, gldVolumeState: 'HIGH' };
const MACRO_NO3 = Object.assign({}, MACRO_ALL, { goldPalladiumTrend: null, creditTrend: null, gldVolumeRel: null, gldVolumeState: null });
const COT_LONG = { crowding: 'SPEC CROWDED LONG', zScore: 2.3, reportDate: '2026-04-07' };
const EXP3_LONG = { 'free:goldPalladium': true, 'free:creditRiskOn': false, 'free:gldVolumeHigh': true };
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
console.log('== 1) macro.js: the four legs, the GLD volume print ==');
{
  const DAY = 86400;
  const nowMs = Date.now();
  const todayMs = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate());
  /* daily bars ending YESTERDAY (every one complete) unless `openToday` adds the session in progress */
  const chart = (closes, vols, openToday) => {
    const n = closes.length;
    const ts = closes.map((_, i) => Math.floor(todayMs / 1000) - (n - i) * DAY);
    const c2 = closes.slice(), v2 = (vols || closes.map(() => 1)).slice();
    if (openToday){ ts.push(Math.floor(todayMs / 1000) + 3600); c2.push(closes[n - 1]); v2.push(openToday); }
    return { chart: { result: [{ timestamp: ts, indicators: { quote: [{ open: c2, high: c2, low: c2, close: c2, volume: v2 }] } }] } };
  };
  const ramp = (a, pct, n) => Array.from({ length: n }, (_, i) => a * (1 + pct * i / (n - 1)));
  const flat40 = Array.from({ length: 40 }, () => 300);
  const vols = (lastMult) => { const v = Array.from({ length: 40 }, () => 1000); v[39] = 1000 * lastMult; return v; };
  const legs = { 'GC=F': [ramp(2300, 0.002, 24)], 'HYG': [ramp(78, 0.03, 24)], 'LQD': [ramp(108, 0, 24)], 'PA=F': [ramp(1000, -0.04, 24)], 'GLD': [flat40, vols(2)], '^VIX': [[15, 15.1, 15.2, 15.3, 15.2]] };
  const fetched = [];
  const mk = (legsIn) => boot(['macro.js'], null, { binanceKlines: async () => [], fetch: async url => {
    const u = decodeURIComponent(String(url).replace(/^\/api\/proxy\?url=/, ''));
    const sym = (u.match(/finance\/chart\/([^?]+)/) || [])[1];
    if (sym) fetched.push(sym);
    const j = legsIn[sym] ? chart.apply(null, legsIn[sym]) : null;
    return j ? { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) } : { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  } });
  const m = await mk(legs).getGoldMacro();
  assert(['HYG', 'LQD', 'PA=F', 'GLD'].every(s => fetched.indexOf(s) >= 0), 'getGoldMacro fetches HYG, LQD, PA=F and GLD (free Yahoo legs)');
  assert(m.creditTrend === 'RISING', 'HYG up 3% against a flat LQD reads credit RISING (risk being bought) (' + m.creditTrend + ')');
  assert(m.goldPalladiumTrend === 'RISING', 'palladium down 4% against a flat gold reads gold/palladium RISING (' + m.goldPalladiumTrend + ')');
  assert(m.gldVolumeRel === 2 && m.gldVolumeState === 'HIGH', 'the last complete GLD session at twice its 20-session mean reads 2.00x HIGH (' + m.gldVolumeRel + ' ' + m.gldVolumeState + ')');
  /* the open session is never read: a partial bar dated today with a tiny volume leaves the print as it was */
  const mOpen = await mk(Object.assign({}, legs, { 'GLD': [flat40, vols(2), 37] })).getGoldMacro();
  assert(mOpen.gldVolumeRel === 2 && mOpen.gldVolumeState === 'HIGH', 'a bar dated on today\'s UTC date (the session still open, 37 shares printed) is NOT the last complete session: still 2.00x HIGH');
  const mLow = await mk(Object.assign({}, legs, { 'GLD': [flat40, vols(0.4)] })).getGoldMacro();
  assert(mLow.gldVolumeRel === 0.4 && mLow.gldVolumeState === 'LOW', 'at 0.4x the print reads LOW');
  const mNorm = await mk(Object.assign({}, legs, { 'GLD': [flat40, vols(1.1)] })).getGoldMacro();
  assert(Math.abs(mNorm.gldVolumeRel - 1.1) < 1e-9 && mNorm.gldVolumeState === 'NORMAL', 'at 1.1x the print reads NORMAL (inside the band, the number still carried)');
  const mThin = await mk(Object.assign({}, legs, { 'GLD': [flat40.slice(0, 15), vols(2).slice(0, 15)] })).getGoldMacro();
  assert(mThin.gldVolumeRel === null && mThin.gldVolumeState === null, 'fewer than 21 complete sessions: no print, null');
  const mZero = await mk(Object.assign({}, legs, { 'GLD': [flat40, (() => { const v = vols(2); v[30] = 0; return v; })()] })).getGoldMacro();
  assert(mZero.gldVolumeRel === null, 'a zero volume inside the base is an unreadable base, not a divisor (null)');
  const mFlat = await mk(Object.assign({}, legs, { 'HYG': [ramp(78, 0.004, 24)] })).getGoldMacro();
  assert(mFlat.creditTrend === 'FLAT', 'a 0.4% ratio move is inside the 1% band: FLAT');
  const m0 = await mk({}).getGoldMacro();
  assert(m0 && m0.creditTrend === null && m0.goldPalladiumTrend === null && m0.gldVolumeRel === null && m0.gldVolumeState === null, 'every leg dark: the four fields are null, the shape is kept');
  const m1 = await mk(Object.assign({}, legs, { 'LQD': undefined, 'PA=F': undefined })).getGoldMacro();
  assert(m1.creditTrend === null && m1.goldPalladiumTrend === null && m1.gldVolumeState === 'HIGH', 'LQD and palladium dark: both ratios null while GLD still reads');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the home: twenty-three keys, the ranker scores nothing on them ==');
{
  const W = boot(RANK_BASE);
  assert(W.HG_GOLD_FREE_KEYS.length === 26 && NEW3K.every(k => W.HG_GOLD_FREE_KEYS.indexOf(k) >= 0), 'the key list carries the three hg-v1167 legs (26 keys since hg-v1171)');
  const F = { macro: MACRO_ALL, fng: { v: 20 }, fundingRate: -0.05, spot: { verdict: 'shorts-crowding', basisPct: -0.2 }, cot: COT_LONG };
  const L = W.hgGoldFreeFeedVerdicts(F, 'long'), S = W.hgGoldFreeFeedVerdicts(F, 'short');
  assert(NEW3K.every(k => L[k] === EXP3_LONG[k]), 'on a long: gold/palladium RISING reads WITH, credit FALLING reads RISK-OFF (false), GLD HIGH reads true (' + JSON.stringify(NEW3K.map(k => L[k])) + ')');
  assert(S['free:goldPalladium'] === false && S['free:creditRiskOn'] === false && S['free:gldVolumeHigh'] === true, 'on a short the directional leg mirrors and the two state reads do NOT (a regime is not a side)');
  assert(Object.keys(L).length === 23 && Object.keys(S).length === 23, 'twenty-three keys, no stowaway');
  const flat = W.hgGoldFreeFeedVerdicts({ macro: Object.assign({}, MACRO_ALL, { goldPalladiumTrend: 'FLAT', creditTrend: 'up', gldVolumeState: 'NORMAL' }) }, 'long');
  assert(NEW3K.every(k => flat[k] === undefined), 'FLAT, a junk string and NORMAL each mark NOTHING');
  const none = W.hgGoldFreeFeedVerdicts({ macro: MACRO_NO3 }, 'long');
  assert(NEW3K.every(k => none[k] === undefined), 'null legs mark nothing');
  const other = { macro: Object.assign({}, MACRO_ALL, { goldPalladiumTrend: 'FALLING', creditTrend: 'RISING', gldVolumeState: 'LOW' }) };
  const oL = W.hgGoldFreeFeedVerdicts(other, 'long'), oS = W.hgGoldFreeFeedVerdicts(other, 'short');
  assert(oL['free:goldPalladium'] === false && oS['free:goldPalladium'] === true && oL['free:creditRiskOn'] === true && oS['free:creditRiskOn'] === true && oL['free:gldVolumeHigh'] === false && oS['free:gldVolumeHigh'] === false,
    'the other states: gold/palladium FALLING is AGAINST a long and WITH a short, credit RISING reads RISK-ON on both, GLD LOW reads false on both');
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback', entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  for (const dir of ['long', 'short']){
    const a = W.goldRankSetups([cand(dir)], { macro: MACRO_ALL, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
    const b = W.goldRankSetups([cand(dir)], { macro: MACRO_NO3, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
    assert(a && b && a.tally === b.tally && JSON.stringify(a.parts) === JSON.stringify(b.parts) && a.grade === b.grade, dir + ': identical tally (' + a.tally + '), parts and grade with and without the three legs');
    assert(NEW3K.every(k => a.freeReads[k] !== undefined) && NEW3K.every(k => b.freeReads[k] === undefined), dir + ': the marks are on one row and absent on the other');
  }
  const line = W.hgGoldFreeFeedLineHtml(L, { fundingPct: -0.05 });
  assert(/23 of 26 free internet feeds read/.test(line) && /GOLD\/PALLADIUM<\/b> WITH/.test(line) && /CREDIT HYG\/LQD<\/b> RISK-OFF/.test(line) && /GLD VOLUME<\/b> HIGH/.test(line), 'the line prints the three legs in their own words (23 of 26 since hg-v1171)');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) the four layers, the states, the marks, the hits, the twin ==');
const firstWindow = (W, fn, opts, rows, from, want) => {
  for (let k = from || 80; k <= rows.length; k++){ const r = W[fn](rows.slice(0, k), opts); if (r && r.dir && (!want || r.dir === want)) return { k, r }; }
  return null;
};
{
  const W = boot(MATH_BASE.concat(['gold-extra-strategies.js']));
  const T = W.PINE_GOLD_RECORD_LAYERS;
  assert(T.length === 23 && T.slice(0, 8).map(l => l.id).join(',') === OLD8.join(',') && T.slice(8, 12).map(l => l.id).join(',') === NEW4.join(',') && T[22].id === 'bpr', 'the eight earlier layers lead the table, the four hg-v1167 ones follow (twenty-three total since hg-v1202 appended BPR at position 22, Williams/TRIX/Fisher at 12-14, hg-v1173 formation family at 15-21) (' + T.map(l => l.id).join(' · ') + ')');
  assert(NEW4.every(id => T.some(l => l.id === id && typeof W[l.fn] === 'function')), 'each of the four has its detector exported');
  assert(T.find(l => l.id === 'cci').twin === 'CCI-EXTREME' && ['chandelier', 'hullma', 'aroon'].every(id => T.find(l => l.id === id).twin === null) && T.filter(l => l.twin).length === 2, 'the CCI re-entry names its exact OMNIGOLD twin CCI-EXTREME; the other three name none (two twins in the table with ICHI-KUMO)');
  assert(!T.some(l => /squeeze/i.test(l.id)) && W.PINE_GOLD_LAYERS.some(l => l.id === 'squeeze'), 'no TTM squeeze in the record table: the ten-layer table already carries Squeeze Mom');
  assert(Array.isArray(W.PINE_GOLD_MAJORITY_IDS) && W.PINE_GOLD_MAJORITY_IDS.join(',') === OLD5.join(','), 'the majority mark keeps its hg-v1165 population: the five hg-v1164 layers');
  const full = tapeEnding(WED, 600, 900, 11, 24, 0);
  const found = {};
  for (const id of NEW4){
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
    for (const want of ['long', 'short']){
      const hw = firstWindow(W, l.fn, l.opts, full, 120, want);
      assert(!!hw, 'REACHABILITY: ' + l.label + ' fires a ' + want + ' somewhere on the tape (window ' + (hw && hw.k) + ')');
      if (!hw) continue;
      if (id === 'chandelier'){
        /* the stop IS the trail of the new direction, read off the series
           itself -- at a long flip the SHORT trail also sits under price, so
           "a stop on the right side" alone cannot tell the two apart */
        const CS = W.pineGoldChandelierSeries(full.slice(0, hw.k), l.opts.len, l.opts.mult);
        const own = want === 'long' ? CS.longStop[hw.k - 1] : CS.shortStop[hw.k - 1], other = want === 'long' ? CS.shortStop[hw.k - 1] : CS.longStop[hw.k - 1];
        assert(hw.r.stop === own && hw.r.stop !== other && (want === 'long' ? hw.r.stop < hw.r.entry : hw.r.stop > hw.r.entry), l.label + ' ' + want + ': the stop is the ' + want + ' trail of the series, not the other trail (' + hw.r.stop.toFixed(2) + ' vs ' + other.toFixed(2) + ')');
      } else {
        const win = full.slice(hw.k - 1 - l.opts.swing, hw.k - 1);
        const swingStop = want === 'long' ? Math.min.apply(null, win.map(x => x.l)) : Math.max.apply(null, win.map(x => x.h));
        assert(hw.r.stop === swingStop, l.label + ' ' + want + ': the stop is the prior ' + l.opts.swing + '-bar swing on the other side (' + hw.r.stop.toFixed(2) + ')');
      }
    }
  }
  /* the Chandelier trails ratchet: while price holds above the long trail
     the trail never falls, even when the raw 22-bar-high-minus-3-ATR does */
  {
    const l = T.find(x => x.id === 'chandelier');
    const CS = W.pineGoldChandelierSeries(full, l.opts.len, l.opts.mult), a = W.atr(full, l.opts.len);
    let held = 0, exercised = 0, broke = 0;
    for (let i = l.opts.len + 2; i < full.length; i++){
      if (!(full[i - 1].c > CS.longStop[i - 1])) continue;
      const raw = Math.max.apply(null, full.slice(i - l.opts.len + 1, i + 1).map(x => x.h)) - l.opts.mult * a[i];
      if (raw < CS.longStop[i - 1]) exercised++;
      if (CS.longStop[i] >= CS.longStop[i - 1]) held++; else broke++;
    }
    assert(exercised >= 5 && broke === 0 && held >= 50, 'the long trail ratchets: on ' + exercised + ' bars the raw trail fell below the prior trail and the series held it (never fell on ' + held + ' bars above the trail)');
  }
  /* the CCI layer fires on every re-entry from beyond the band and on nothing
     else: the count of firing windows equals an independent CCI count */
  {
    const l = T.find(x => x.id === 'cci');
    const tp = full.map(r => (r.h + r.l + r.c) / 3);
    const cci = tp.map((_, i) => { if (i < 19) return NaN; let s = 0; for (let k = i - 19; k <= i; k++) s += tp[k]; const m = s / 20; let md = 0; for (let k = i - 19; k <= i; k++) md += Math.abs(tp[k] - m); md /= 20; return md > 0 ? (tp[i] - m) / (0.015 * md) : NaN; });
    let re = 0, fires = 0;
    for (let k = 120; k <= full.length; k++){
      const i = k - 1;
      if ((cci[i - 1] <= -100 && cci[i] > -100) || (cci[i - 1] >= 100 && cci[i] < 100)) re++;
      const r = W[l.fn](full.slice(0, k), l.opts);
      if (r && r.dir) fires++;
    }
    assert(re >= 5 && fires === re, 'CCI Re-entry fires on exactly the re-entries of the tape and never between them (' + fires + ' of ' + re + ')');
    /* the same rule OMNIGOLD runs as CCI-EXTREME: on the first firing window
       OMNIGOLD's own detector fires the same way */
    const hit = found.cci;
    const og = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
    const win = full.slice(0, hit.k);
    const cur = og.goldCCI(win), prv = og.goldCCI(win.slice(0, win.length - 1));
    const ogDir = (prv.zone === 'EXTREME_LOW' && cur.zone !== 'EXTREME_LOW') ? 'long' : ((prv.zone === 'EXTREME_HIGH' && cur.zone !== 'EXTREME_HIGH') ? 'short' : null);
    assert(ogDir === hit.r.dir, 'on that window goldCCI (the series CCI-EXTREME reads) shows the same re-entry the same way: an exact twin, not an analogy (' + ogDir + ')');
  }
  const flat = full.map(r => ({ t: r.t, o: 2300, h: 2300.5, l: 2299.5, c: 2300, v: 1 }));
  assert(NEW4.every(id => { const l = T.find(x => x.id === id); const r = W[l.fn](flat, l.opts); return r && !r.dir; }), 'a dead-flat tape fires none of the four');
  assert(NEW4.every(id => { const l = T.find(x => x.id === id); const a = W[l.fn](null, l.opts), b = W[l.fn]([{ t: 1, c: null }], l.opts), c = W[l.fn](full.slice(0, 10), l.opts); return a && !a.dir && b && !b.dir && c && !c.dir; }), 'no rows, a junk row and too few bars: no signal, no throw');
  for (const id of NEW4){
    const l = T.find(x => x.id === id), hit = found[id];
    const junk = full.slice(0, hit.k).map((r, i, a) => (i === a.length - 3 ? { t: r.t, o: null, h: null, l: null, c: null, v: r.v } : r));
    const r = W[l.fn](junk, l.opts);
    assert(r && !r.dir, l.label + ': a null bar inside the window on the very window that fired is unreadable: no signal (never a price of zero)');
  }
  /* the hits helper names the new kinds */
  const hk = found.hullma.k;
  const hits = W.pineGoldRecordLayerHits(full.slice(0, hk));
  const h = hits.find(x => x.id === 'hullma');
  assert(h && h.kind === 'pine_hullma' && h.dir === found.hullma.r.dir && h.entry === found.hullma.r.entry && h.stop === found.hullma.r.stop && h.twin === null, 'pineGoldRecordLayerHits names the Hull turn as a mint hit (kind pine_hullma, dir, levels, no twin)');
  const hc = W.pineGoldRecordLayerHits(full.slice(0, found.cci.k)).find(x => x.id === 'cci');
  assert(hc && hc.twin === 'CCI-EXTREME', 'the CCI hit carries its twin');
  /* states: twelve fields, the majority over the five */
  const up = []; let px = 2300; const t0 = Math.floor(WED / 1000) - 300 * 900;
  for (let i = 0; i < 300; i++){ const o = px, c = o + 1.5 + Math.sin(i / 9) * 0.4; up.push({ t: t0 + i * 900, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.5, c, v: 1000 }); px = c; }
  const su = W.pineGoldLayerStates(up);
  assert(su.ok === true && NEW4.every(id => su[id] === 'long') && su.readable >= 12 && su.allLong >= 12 && su.agreeLong === 5, 'a clean uptrend: the Chandelier side, the Hull slope, the CCI sign and Aroon all read LONG; at least twelve readable (fifteen total since hg-v1171); the five-layer majority tally stays five');
  const sd = W.pineGoldLayerStates(mirror(up));
  assert(NEW4.every(id => sd[id] === 'short') && sd.readable >= 12 && sd.allShort >= 12 && sd.agreeShort === 5, 'the mirrored tape: all four SHORT, at least twelve readable (fifteen total since hg-v1171)');
  const sf = W.pineGoldLayerStates(flat);
  assert(NEW4.every(id => sf[id] === null), 'a dead-flat tape reads none of the four (a Hull slope of zero, a CCI of zero, Aroon up equal to down, no trail crossed)');
  const mL = W.pineGoldPineMarks(su, 'long'), mS = W.pineGoldPineMarks(su, 'short');
  assert(Object.keys(mL).length === 16 && NEW4.every(id => mL['pine:' + id + 'With'] === true && mS['pine:' + id + 'With'] === false) && mL['pine:majorityWith'] === true, 'sixteen marks since hg-v1171: the hg-v1167 four WITH on a long, AGAINST on a short, the majority still the five');
  const onlyNew = Object.assign({ ok: true, readable: 4, allLong: 4, allShort: 0, agreeLong: 0, agreeShort: 0 }, Object.fromEntries(OLD8.map(id => [id, null])), Object.fromEntries(NEW4.map(id => [id, 'long'])));
  const mo = W.pineGoldPineMarks(onlyNew, 'long');
  assert(Object.keys(mo).length === 4 && mo['pine:majorityWith'] === undefined, 'the four alone never move the majority mark (absent)');
  const html = W.pineGoldStackLineHtml(su, mL);
  assert(/\d+ of 23 gold Pine layers readable/.test(html) && /Chandelier Exit<\/b> LONG/.test(html) && /Hull MA Turn<\/b> LONG/.test(html) && /CCI Re-entry<\/b> LONG/.test(html) && /Aroon Cross<\/b> LONG/.test(html) && /five hg-v1164 layers/.test(html), 'the line prints the four new states and names the majority population (twenty-three total since hg-v1202)');
  /* the twin record: quoted through the one home, not past the veto bar */
  const rec = W.hgGoldSiblingRecord('cci');
  assert(rec && rec.twin === 'CCI-EXTREME' && rec.settled === 322 && rec.n === 327 && typeof rec.zBreakeven === 'number' && rec.zBreakeven > -2 && W.hgGoldSiblingVetoed('cci') === false, 'hgGoldSiblingRecord(cci) quotes CCI-EXTREME: gate-clear n=327, 322 settled, z ' + (rec && rec.zBreakeven) + ' — inside the noise, not a measured failure, so the port is allowed (hg-v934)');
  assert(W.hgGoldSiblingRecord('chandelier') === null && W.hgGoldSiblingRecord('hullma') === null && W.hgGoldSiblingRecord('aroon') === null, 'the other three quote none');
  const xs = read('gold-extra-strategies.js');
  assert(/'CCI-EXTREME': \{ n: 327, settled: 322,/.test(xs), 'the record literal carries CCI-EXTREME, regenerated by scripts/gold-sibling-records.mjs from the committed artifact');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) GOLD PINE end to end ==');
const PINE_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                   'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'gold-extra-strategies.js', 'pinemath.js', 'pinegoldmath.js', 'goldpine.js', 'accuracy-floor.js'];
function stubFire(dir){
  return function(rows){ const c = rows[rows.length - 1].c; const risk = 6;
    const stop = dir === 'long' ? c - risk : c + risk;
    return { dir, newLong: dir === 'long', newShort: dir === 'short', barsAgo: 0, price: c, entry: c, stop,
             t1: dir === 'long' ? c + 2 * risk : c - 2 * risk, t2: dir === 'long' ? c + 3.5 * risk : c - 3.5 * risk, recordOnly: true }; };
}
async function pineRun(opts){
  opts = opts || {};
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '15m': tapeEnding(WED, 300, 900, 102, 24, 0), '1h': tapeEnding(WED, 240, 3600, 103, 30, 0),
                  '4h': tapeEnding(WED, 300, 14400, 104, 40, 6), '1d': tapeEnding(WED, 280, 86400, 105, 60, 20) };
  const extra = {
    getGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'binance-xau' }),
    hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    getGoldMacro: async () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }),
    S: { fng: { v: 20 } },
    binanceFunding: async () => ({ fundingPct: -0.05 }),
    hgMpPin: () => {}
  };
  const W = boot(PINE_BASE, clock, extra);
  W.hgMpPin = () => {};
  W.pineGoldCciReentry = stubFire('long');
  W.pineGoldAroonCross = stubFire('short');
  const tab = W.HG_tabs.find(t => t && t.id === 'goldpine');
  const el = mkEl();
  tab.mount(el);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000){
    await settle(2);
    const st = el.querySelector('#goldPineStat').textContent;
    if (/^done|^error|^failed/.test(st)) break;
  }
  return { W, el, tapes, snap: W.goldPineScan(), stat: el.querySelector('#goldPineStat').textContent, html: el.querySelector('#goldPineOut').innerHTML };
}
const cardOf = (html, label) => { const i = html.indexOf('· ' + label + ' · Grade'); if (i < 0) return ''; const s = html.lastIndexOf('<div class="panel', i); const e = html.indexOf('<div class="panel', i + 1); return html.slice(s, e < 0 ? undefined : e); };
{
  const r = await pineRun();
  assert(/^done/.test(r.stat), 'REACHABILITY: the real tab mounted, scanned and painted (' + r.stat + ')');
  const all = r.snap.swing.concat(r.snap.scalp);
  const rec = all.filter(s => s.recordOnly);
  const cci = rec.filter(s => s.recordLayer === 'cci'), ar = rec.filter(s => s.recordLayer === 'aroon');
  assert(cci.length === 2 && ar.length === 2 && cci.every(s => s.dir === 'long' && s.recordTwin === 'CCI-EXTREME' && s.layerLabel === 'CCI Re-entry') && ar.every(s => s.dir === 'short' && s.recordTwin === null && s.layerLabel === 'Aroon Cross'),
    'REACHABILITY: the CCI and Aroon layers mint record-only on both lanes through the real table and the real builder (' + rec.map(s => s.mode + ':' + s.layerLabel + ':' + s.dir).join(' · ') + ')');
  assert(rec.every(s => s.demoted === true && /RECORD ONLY/.test(s.demotedWhy) && s.recordJudge && s.recordJudge.pool === 'GOLDPINE:' + s.mode && s.recordJudge.mechanic === s.layerLabel && s.recordJudge.n === 0), 'each is demoted and judged under GOLDPINE:<lane> with the layer label as mechanic, nothing settled');
  for (const mode of ['scalp', 'swing']){
    const recs = r.W.hgFwdRecords('GOLDPINE:' + mode) || [];
    const c = recs.find(x => x.mechanic === 'CCI Re-entry'), a = recs.find(x => x.mechanic === 'Aroon Cross');
    assert(!!c && !!a && c.ticket === false && a.ticket === false && c.dir === 'long' && a.dir === 'short', mode + ': both are RECORDED under GOLDPINE:' + mode + ' with the layer label as mechanic, ticket false');
    assert(c && c.reads && NEW3K.every(k => c.reads[k] !== undefined) && NEW4.map(id => 'pine:' + id + 'With').some(k => c.reads[k] !== undefined), mode + ': the record carries the three new legs and the new states');
  }
  const cciCard = cardOf(r.html, 'SCALP · 15m · CCI Re-entry'), arCard = cardOf(r.html, 'SCALP · 15m · Aroon Cross');
  assert(cciCard.length > 500 && arCard.length > 500, 'REACHABILITY: both record-only cards painted');
  assert(/RECORD ONLY · 0 of 20 settled/.test(cciCard) && /NO TRADE HANDOFF — RECORD ONLY/.test(cciCard) && !/class="toTrade"/.test(cciCard) && !/ADD TO BOOK/.test(cciCard), 'the CCI card carries the chip and the withheld-handoff note and NO handoff button');
  assert(/OMNIGOLD CCI-EXTREME, gate-clear n=327, 322 settled, −0\.033R net at XM, z \+0\.20/.test(cciCard) && /OMNIGOLD’s gates and 1h horizon/.test(cciCard), 'the CCI card quotes its twin\'s gate-clear record through hgGoldSiblingRecord, attributed to OMNIGOLD\'s gates and horizon');
  assert(!/Nearest measured twin/.test(arCard) && !/Nearest OMNIGOLD mechanic/.test(arCard), 'the Aroon card, with no twin, quotes none');
  assert(/4 RECORD-ONLY Pine layers on this scan/.test(r.html), 'the board names the four record-only rows once');
  assert(/\d+ of 23 gold Pine layers readable/.test(r.html), 'every GOLD PINE card prints the PINE STACK line over twenty-three layers (hg-v1202)');
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
  const W = boot(SCALP_BASE.concat(PINE_MATH), clock, {
    getXmGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' }),
    getGoldCandles: async () => ({ rows: [], source: null }),
    getGoldMacro: async () => MACRO_ALL, getGoldMacroCached: () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG,
    binanceFunding: async () => ({ fundingPct: -0.05 }), hgGoldLoadDeltaPerp: async () => null, hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
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
  const hits = r.W.pineGoldRecordLayerHits(r.tapes['15m']).filter(h => NEW4.includes(h.id));
  assert(hits.length === 2 && hits.map(h => h.id).sort().join(',') === 'cci,hullma', 'REACHABILITY: on the hg-v1166 scalp tape the Hull turn and the CCI re-entry both fire on the last closed 15m bar');
  const pine = (r.snap.cands || []).filter(c => c.recordOnly && /^pine_(hullma|cci)$/.test(c.stratKey));
  assert(pine.length === 2 && pine.every(c => c.demoted === true && /RECORD ONLY/.test(c.demotedWhy || '') && c.recordJudge && c.recordJudge.pool === 'GOLDSCALP' && c.recordJudge.mechanic === String(c.stratKey).toUpperCase()),
    'GOLD SCALP minted both record-only through its own mint, each judged under GOLDSCALP with its own mechanic (' + pine.map(c => c.stratKey + ':' + c.dir).join(', ') + ')');
  const prec = r.recs.filter(x => /^PINE_(HULLMA|CCI)$/.test(x.mechanic));
  assert(prec.length === 2 && prec.every(x => x.ticket === false && x.reads && NEW3K.every(k => x.reads[k] !== undefined) && NEW4.map(id => 'pine:' + id + 'With').some(k => x.reads[k] !== undefined)),
    'each is recorded under GOLDSCALP, ticket FALSE, with the three new legs and the new states on the record');
  const expP = r.W.pineGoldPineMarks(r.W.pineGoldLayerStates(r.tapes['15m']), r.recs[0].dir);
  assert(NEW4.map(id => 'pine:' + id + 'With').filter(k => expP[k] !== undefined).every(k => r.recs[0].reads[k] === expP[k]), 'the new states are read off the 15m tape for the record\'s own direction');
  assert(r.recs.every(x => x.reads && NEW3K.every(k => x.reads[k] !== undefined)), 'every GOLD SCALP record carries the three new legs');
  assert(!r.snap.bestId || !pine.some(c => c.id === r.snap.bestId), 'the MOST PROBABLE pin is never one of them');
  const segsAll = r.html.split('<div class="card gsx-card').slice(1);
  const segs = segsAll.filter(s => (s.indexOf(pine[0].strategy) >= 0 || s.indexOf(pine[1].strategy) >= 0) && /data-hg-record-note="1"/.test(s));
  assert(segs.length >= 2 && segs.every(s => !/class="toTrade"/.test(s) && !/ADD TO BOOK/.test(s) && /data-hg-record-chip="record-only"/.test(s)), 'both cards print the RECORD ONLY chip and neither handoff');
  const t0 = Math.floor(WED / 1000);
  const rr = await scalpRun({ seed: 131, seedLedger: W => seedLedger(W, 'GOLDSCALP', 'PINE_CCI', 20, true, t0) });
  const rel = (rr.snap.cands || []).find(c => c.stratKey === 'pine_cci'), held = (rr.snap.cands || []).find(c => c.stratKey === 'pine_hullma');
  assert(rel && rel.recordReleased === true && rel.recordOnly === false && held && held.recordOnly === true, 'with 20 settled wins under GOLDSCALP / PINE_CCI the CCI port is RELEASED and the Hull port stays record-only (per mechanic)');
}

/* ------------------------------------------------------------------ 6 */
console.log('== 6) GOLD SWING: the desk\'s own gate decides ==');
{
  const SWING = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                 'goldind.js', 'gold-best-levels.js', 'conviction-lock.js', 'gold-catalog.js', 'goldswing.js', 'accuracy-floor.js'].concat(PINE_MATH);
  const W = boot(SWING, { now: WED + 16 * 60 * 1000 });
  const MAC = dir => Object.assign({}, MACRO_ALL, { dxy: { trend20: dir === 'long' ? 'FALLING' : 'RISING' }, tnxTrend: dir === 'long' ? 'FALLING' : 'RISING' });
  const r4 = tapeEnding(WED, 300, 14400, 279, 40, 6), r1d = tapeEnding(WED, 280, 86400, 280, 60, 20);
  const hits = W.pineGoldRecordLayerHits(r4);
  const hullHit = hits.find(h => h.id === 'hullma');
  assert(hullHit && hullHit.dir === 'short', 'REACHABILITY: on this 4h tape the Hull turn fires a short on the last closed bar (hits: ' + hits.map(h => h.id + ':' + h.dir).join(',') + ')');
  const out = W.goldSwingSetups({ rows4h: r4, rows1d: r1d, now: WED + 16 * 60 * 1000, news: null, macro: MAC('short') }) || {};
  const rj = (out.rejected || []).find(c => c.stratKey === 'pine_hullma');
  assert(rj && /confluence insufficient/.test(String(rj.why || rj.reason || '')) && !(out.ranked || []).some(c => c.stratKey === 'pine_hullma'),
    'GOLD SWING offered it to mkCand and its own two-agreeing-reads rule refused it, named in the rejects (' + String(rj && (rj.why || rj.reason)).slice(0, 70) + ')');
  /* the tape where a port does clear the gate (hg-v1166, MACD): its record carries the new states */
  const r4b = tapeEnding(WED, 300, 14400, 124, 40, 6), r1db = tapeEnding(WED, 280, 86400, 125, 60, 20);
  const outB = W.goldSwingSetups({ rows4h: r4b, rows1d: r1db, now: WED + 16 * 60 * 1000, news: null, macro: MAC('long') }) || {};
  const port = (outB.ranked || []).find(c => c.recordOnly);
  assert(port && port.pineStates && port.pineStates.ok === true && NEW4.some(id => port.pineStates[id] === 'long' || port.pineStates[id] === 'short'), 'REACHABILITY: on the hg-v1166 tape a port clears the gate and its row carries the twelve-layer states (' + (port && NEW4.map(id => id + ':' + port.pineStates[id]).join(' ')) + ')');
  const expM = W.pineGoldPineMarks(W.pineGoldLayerStates(r4b), port.dir);
  assert(NEW4.map(id => 'pine:' + id + 'With').filter(k => expM[k] !== undefined).every(k => port.freeReads[k] === expM[k]) && NEW3K.every(k => port.freeReads[k] !== undefined), 'the row\'s marks carry the new states for its own direction and the three new legs');
}

/* ------------------------------------------------------------------ 7 */
console.log('== 7) OMNIGOLD and GANESH GOLD read the twelve; nothing gated; the cap; the catalog; stamps ==');
{
  /* OMNIGOLD */
  const OG_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-setup-core.js', 'hg-forward.js', 'gold-forward-read.js',
                   'gold-formation.js', 'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'omniroute.js', 'setup-ui.js', 'omnigold.js', 'accuracy-floor.js'];
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '1h': tapeEnding(WED, 1500, 3600, 41, 30, 0), '4h': tapeEnding(WED, 1500, 14400, 42, 40, 6), '1d': tapeEnding(WED, 260, 86400, 43, 60, 20), '15m': tapeEnding(WED, 400, 900, 44, 24, 0) };
  const Wo = boot(OG_BASE.concat(PINE_MATH), clock, {
    getXmGoldCandles: async () => ({ rows: [], source: null }),
    getGoldCandles: async (tf, n) => ({ rows: (tapes[tf] || []).slice(-(n || 1500)), source: 'binance-xau' }),
    hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    hgGoldLoadDeltaPerp: async () => null,
    S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG, getGoldMacro: async () => MACRO_ALL, getGoldMacroCached: () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 })
  });
  const tabO = Wo.HG_tabs.find(t => t && t.id === 'omnigold');
  const elO = mkEl();
  tabO.mount(elO);
  await settle(4);
  const run = elO.querySelector('#ogRun');
  if (run && run.listeners.click) run.click();
  const t0 = Date.now();
  let cards = null;
  while (Date.now() - t0 < 40000){ await settle(3); try { cards = Wo.hgOgLastCards ? Wo.hgOgLastCards() : null; } catch(e){ cards = null; } if (cards && cards.ran) break; }
  const recsO = ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING'].map(t => Wo.hgFwdRecords(t) || []).reduce((a, b) => a.concat(b), []);
  assert(cards && cards.ran === true && recsO.length >= 1, 'REACHABILITY: OMNIGOLD scanned and wrote ' + recsO.length + ' records');
  assert(recsO.every(x => x.reads && NEW4.map(id => 'pine:' + id + 'With').some(k => x.reads[k] !== undefined) && NEW3K.every(k => x.reads[k] !== undefined)), 'every OMNIGOLD record carries the new states and the three new legs, with no edit on omnigold.js');
  assert(!/chandelier|hullma|aroon|goldPalladium|creditTrend|gldVolume/.test(strip(read('omnigold.js'))) && !/chandelier|hullma|aroon|goldPalladium|creditTrend|gldVolume/.test(strip(read('ganeshgold.js'))), 'omnigold.js and ganeshgold.js name none of the new layers or legs (they iterate the table and read the home)');
  /* GANESH GOLD */
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
  const newG = NEW4.map(id => 'pine:' + id + 'With').filter(k => expG[k] !== undefined);
  assert(newG.length >= 2 && newG.every(k => recs[0].reads[k] === expG[k]) && NEW3K.every(k => recs[0].reads[k] !== undefined), 'the record carries the new layers\' states (' + newG.join(', ') + ') and the three new legs, through the same home with no edit');
  assert(snap.plan.pineStates.readable === W.pineGoldLayerStates(longTape()).readable && snap.plan.pineStates.readable >= 6, 'the call reads all twelve layers (' + snap.plan.pineStates.readable + ' readable on this tape)');
  /* nothing gated */
  for (const f of ['hg-gates.js', 'cryptogates.js', 'engine.js', 'gold-best-levels.js', 'gold-formation.js', 'hg-solidity.js', 'plans.js', 'conviction-lock.js']){
    assert(!/['"]pine:|recordOnly|recordReleased|goldPalladium|creditTrend|gldVolume|chandelier|hullma/.test(strip(read(f))), f + ' names no hg-v1167 mark, layer or field');
  }
  const gi = strip(read('goldind.js'));
  assert(!/free:goldPalladium|free:creditRiskOn|free:gldVolumeHigh/.test(body(gi, 'function goldRankSetups(')), 'the ranker names none of the three new legs (the home marks them; it scores nothing)');
  assert(!/pineStates\.(chandelier|hullma|cci|aroon)/.test(gi) && !/freeReads\[\s*['"]pine:/.test(gi), 'the ranker never reads a new state or a pine: mark back (textual)');
  const pg = strip(read('pinegoldmath.js'));
  assert(!/pineGoldChandelierExit|pineGoldHullTurn|pineGoldCciReentry|pineGoldAroonCross/.test(body(pg, 'function pineGoldEvalDir(')) && !/PINE_GOLD_RECORD_LAYERS/.test(body(pg, 'function pineGoldConfluence(')), 'pineGoldEvalDir and pineGoldConfluence never read the record table or its detectors: the confluence tier of the ten layers cannot move');
  /* the cap */
  const Wr = boot(RANK_BASE.concat(PINE_MATH));
  const KEYS = Wr.HG_GOLD_FREE_KEYS.length + 2 + Object.keys(Wr.hgGoldIndicatorMarks(Wr.hgGoldIndicatorReads(tapeEnding(WED, 300, 900, 102, 24, 0), { rows1d: tapeEnding(WED, 280, 86400, 105, 60, 20) }), 'long')).length + 13;
  assert(KEYS <= 64 && KEYS >= 52, 'twenty-three free: + two PERFECT + the indicator stack read on this tape + thirteen pine: = ' + KEYS + ' keys, inside the 64 cap');
  /* the catalog says what it read for GLD, and does not call the ETF-flows row USED */
  const Wc = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js']);
  const f = Wc.hgGoldCatalogFeed(tapeEnding(WED, 300, 900, 102, 24, 0), { ctx: { macro: MACRO_ALL, now: WED } });
  const r133 = f.unchecked.find(r => r.id === 133);
  assert(r133 && !f.used.some(r => r.id === 133) && /GLD volume is read instead: 1\.62/.test(r133.note) && /high/.test(r133.note) && /participation, not tonnage/.test(r133.note) && /free:gldVolumeHigh/.test(r133.note), '#133 (ETF flows) stays UNCHECKED and says the GLD volume print was read instead (participation, not tonnage)');
  const f0 = Wc.hgGoldCatalogFeed(tapeEnding(WED, 300, 900, 102, 24, 0), { ctx: { macro: MACRO_NO3, now: WED } });
  const r133b = f0.unchecked.find(r => r.id === 133);
  assert(r133b && !/GLD volume is read/.test(r133b.note), 'with no GLD print the row says nothing about one');
  const bs = read('build-stamp.js');
  assert(bs.includes("version: '" + HG_VER + "'"), 'build-stamp.js version is ' + HG_VER);
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + ' ' + pass + ' assertions' + (fail ? ' (' + fail + ' failed)' : ''));
process.exit(fail ? 1 : 0);
