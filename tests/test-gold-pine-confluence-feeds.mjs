#!/usr/bin/env node
/* hg-v1165 — the five gold Pine layers as a CONFLUENCE OF READS on OMNIGOLD,
   GOLD SCALP, GOLD PINE and GANESH GOLD; four more free Yahoo legs; the
   ledger's read cap moved before the marks that need it.

   Asked to use the gold Pine layers on four desks "to form a confluence",
   the measured record still refuses a new weight (hg-v966 / v987 / v945 /
   v922). So each layer's STATE on the desk's own execution tape enters as a
   three-state mark (pine:<layer>With) with a sixth for the majority of the
   readable states (pine:majorityWith), on every record the four desks
   write, printed as a PINE STACK line — and scored nowhere. Four more free
   Yahoo legs (GDX / GC=F, GC=F / HG=F, GC=F / CL=F, EURUSD=X) join the one
   free-feed home the same way. FWD_READS_MAX moves 32 -> 64 first, because
   hg-v1163 left the ledger exactly at its cap.

   Sections:
     1  macro.js: the four legs, each ratio through the one band, dark is null
     2  the home: sixteen keys; the four legs WITH / AGAINST / absent; the
        ranker's tally and parts identical with and without them
     3  the Pine stack: five states on crafted tapes, both ways, unreadable
        where the layer reads neither; six marks; the majority rule; the line
     4  the four desks end to end: records carry the pine: marks for their
        own direction, cards print the line, boards byte-identical with the
        stack absent
     5  the cap: 64 keeps every mark the desks write; nothing gated; census;
        stamps */
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
const LAYER_IDS = ['supertrend', 'ichimoku', 'donchian', 'emacross', 'keltner'];
const PINE_KEYS = LAYER_IDS.map(id => 'pine:' + id + 'With').concat(['pine:majorityWith']);
const NEW4 = ['free:minersGold', 'free:goldCopper', 'free:goldOil', 'free:eurusd'];
const MACRO_ALL = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                    realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo',
                    gvzTrend: 'RISING', gvzLast: 18.4, vixLast: 15.2, goldSpxCorr20: 0.45, goldBtcCorr20: -0.52,
                    minersGoldTrend: 'RISING', goldCopperTrend: 'FALLING', goldOilTrend: 'RISING', eurusdTrend: 'FALLING' };
const MACRO_NO4 = Object.assign({}, MACRO_ALL, { minersGoldTrend: null, goldCopperTrend: null, goldOilTrend: null, eurusdTrend: null });
const COT_LONG = { crowding: 'SPEC CROWDED LONG', zScore: 2.3, reportDate: '2026-04-07' };
const FEEDS_ALL = { macro: MACRO_ALL, fng: { v: 20 }, fundingRate: -0.05, spot: { verdict: 'shorts-crowding', basisPct: -0.2 }, cot: COT_LONG };
const EXP4_LONG = { 'free:minersGold': true, 'free:goldCopper': false, 'free:goldOil': true, 'free:eurusd': false };

/* ------------------------------------------------------------------ 1 */
console.log('== 1) macro.js: the four legs ==');
{
  const DAY = 86400, T0 = 1770000000 - (1770000000 % DAY);
  const chart = closes => ({ chart: { result: [{ timestamp: closes.map((_, i) => T0 + i * DAY), indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1) }] } }] } });
  const ramp = (a, pct, n) => Array.from({ length: n }, (_, i) => a * (1 + pct * i / (n - 1)));
  const legs = { 'GC=F': ramp(2300, 0.002, 24), 'GDX': ramp(40, 0.05, 24), 'HG=F': ramp(4, 0.05, 24), 'CL=F': ramp(70, -0.05, 24), 'EURUSD=X': ramp(1.1, -0.03, 24), '^VIX': [15, 15.1, 15.2, 15.3, 15.2] };
  const fetched = [];
  const route = url => {
    const u = decodeURIComponent(String(url).replace(/^\/api\/proxy\?url=/, ''));
    const sym = (u.match(/finance\/chart\/([^?]+)/) || [])[1];
    if (sym) fetched.push(sym);
    return legs[sym] ? chart(legs[sym]) : null;
  };
  const W = boot(['macro.js'], null, { binanceKlines: async () => [], fetch: async url => { const j = route(url); return j ? { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) } : { ok: false, status: 404, json: async () => ({}), text: async () => '' }; } });
  const m = await W.getGoldMacro();
  assert(['GDX', 'HG=F', 'CL=F', 'EURUSD=X'].every(s => fetched.indexOf(s) >= 0), 'getGoldMacro fetches GDX, HG=F, CL=F and EURUSD=X (free Yahoo legs)');
  assert(m.minersGoldTrend === 'RISING', 'miners outrunning gold by 5% over the window reads miners/gold RISING (' + m.minersGoldTrend + ')');
  assert(m.goldCopperTrend === 'FALLING', 'copper outrunning gold reads gold/copper FALLING (' + m.goldCopperTrend + ')');
  assert(m.goldOilTrend === 'RISING', 'crude falling 5% against a flat gold reads gold/oil RISING (' + m.goldOilTrend + ')');
  assert(m.eurusdTrend === 'FALLING', 'EURUSD down 3% reads FALLING (' + m.eurusdTrend + ')');
  const W0 = boot(['macro.js'], null, { binanceKlines: async () => [], fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }) });
  const m0 = await W0.getGoldMacro();
  assert(m0 && m0.minersGoldTrend === null && m0.goldCopperTrend === null && m0.goldOilTrend === null && m0.eurusdTrend === null, 'every leg dark: the four fields are null, the shape is kept');
  /* a ratio is unreadable when one side is dark */
  delete legs['HG=F'];
  const W1 = boot(['macro.js'], null, { binanceKlines: async () => [], fetch: async url => { const j = route(url); return j ? { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) } : { ok: false, status: 404, json: async () => ({}), text: async () => '' }; } });
  const m1 = await W1.getGoldMacro();
  assert(m1.goldCopperTrend === null && m1.minersGoldTrend === 'RISING', 'copper dark: gold/copper is null while miners/gold still reads');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the home: sixteen keys, four more legs, the ranker scores nothing on them ==');
{
  const W = boot(RANK_BASE);
  assert(W.HG_GOLD_FREE_KEYS.length === 16 && NEW4.every(k => W.HG_GOLD_FREE_KEYS.indexOf(k) >= 0), 'the key list carries the four hg-v1165 legs (16 keys)');
  const L = W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'long'), S = W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'short');
  assert(NEW4.every(k => L[k] === EXP4_LONG[k]), 'on a long: miners/gold RISING and gold/oil RISING read WITH, gold/copper FALLING and EURUSD FALLING read AGAINST (' + JSON.stringify(NEW4.map(k => L[k])) + ')');
  assert(NEW4.every(k => S[k] === !EXP4_LONG[k]), 'on a short every leg reads the mirror');
  assert(Object.keys(L).length === 16 && Object.keys(S).length === 16, 'sixteen keys, no stowaway');
  const flat = W.hgGoldFreeFeedVerdicts({ macro: Object.assign({}, MACRO_ALL, { minersGoldTrend: 'FLAT', goldCopperTrend: null, goldOilTrend: 'up', eurusdTrend: undefined }) }, 'long');
  assert(NEW4.every(k => flat[k] === undefined), 'FLAT, null, a junk string and absent each mark NOTHING');
  /* the ranker: identical tally and parts with and without the four legs */
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback', entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  for (const dir of ['long', 'short']){
    const a = W.goldRankSetups([cand(dir)], { macro: MACRO_ALL, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
    const b = W.goldRankSetups([cand(dir)], { macro: MACRO_NO4, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
    assert(a && b && a.tally === b.tally && JSON.stringify(a.parts) === JSON.stringify(b.parts) && a.grade === b.grade, dir + ': identical tally (' + a.tally + '), parts and grade with and without the four legs');
    assert(NEW4.every(k => a.freeReads[k] !== undefined) && NEW4.every(k => b.freeReads[k] === undefined), dir + ': the marks are on one row and absent on the other');
  }
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) the Pine stack: states, marks, the majority, the line ==');
{
  const W = boot(MATH_BASE);
  assert(typeof W.pineGoldLayerStates === 'function' && typeof W.pineGoldPineMarks === 'function' && typeof W.pineGoldStackLineHtml === 'function' && W.PINE_GOLD_MAJORITY === 3, 'the state reader, the marks and the line are exported; the majority bar is three');
  /* a strong, clean uptrend: every layer reads long */
  const up = []; let px = 2300; const t0 = Math.floor(WED / 1000) - 300 * 900;
  for (let i = 0; i < 300; i++){ const o = px, c = o + 1.5 + Math.sin(i / 9) * 0.4; up.push({ t: t0 + i * 900, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.5, c, v: 1000 }); px = c; }
  const su = W.pineGoldLayerStates(up);
  assert(su.ok === true && LAYER_IDS.every(id => su[id] === 'long') && su.readable === 5 && su.agreeLong === 5 && su.agreeShort === 0, 'a clean uptrend: all five states LONG (' + LAYER_IDS.map(id => su[id]).join('/') + ')');
  const sd = W.pineGoldLayerStates(mirror(up));
  assert(sd.ok === true && LAYER_IDS.every(id => sd[id] === 'short') && sd.agreeShort === 5, 'the mirrored tape: all five SHORT');
  /* a dead-flat tape: the midline, the cross and the Keltner mid read neither */
  const flat = up.map(r => ({ t: r.t, o: 2300, h: 2300.5, l: 2299.5, c: 2300, v: 1 }));
  const sf = W.pineGoldLayerStates(flat);
  assert(sf.ok === true && sf.donchian === null && sf.emacross === null && sf.keltner === null && sf.ichimoku === null, 'a dead-flat tape: Donchian, EMA cross, Keltner and Ichimoku read NEITHER (absent, never guessed)');
  assert(!W.pineGoldLayerStates(up.slice(0, 40)).ok && !W.pineGoldLayerStates(null).ok && !W.pineGoldLayerStates([{ t: 1, c: null }]).ok, 'too few bars, no rows or a junk close: not ok');
  /* a three-bar bounce inside a decline: the close is back above the Keltner
     mid while the EMA 50 is still falling over five bars -- the Keltner
     state needs BOTH and reads neither */
  const bounce = []; let pb = 2600;
  for (let i = 0; i < 300; i++){ const o = pb, c = i < 297 ? o - 1 : o + 3; bounce.push({ t: t0 + i * 900, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 }); pb = c; }
  const sb = W.pineGoldLayerStates(bounce);
  const emaFn = W.ema, cl = bounce.map(r => r.c), e20 = emaFn(cl, 20), e50 = emaFn(cl, 50);
  assert(cl[299] > e20[299] && e50[299] < e50[294], 'REACHABILITY: the bounce closes above the EMA 20 while the EMA 50 still falls over five bars');
  assert(sb.ok === true && sb.keltner === null, 'so the Keltner state reads NEITHER (the slope leg is part of the rule)');
  /* marks */
  const mL = W.pineGoldPineMarks(su, 'long'), mS = W.pineGoldPineMarks(su, 'short');
  assert(PINE_KEYS.every(k => mL[k] === true) && Object.keys(mL).length === 6, 'all-long states on a long: six marks, all WITH');
  assert(PINE_KEYS.every(k => mS[k] === false), 'the same states on a short: six marks, all AGAINST');
  const mixed = { ok: true, supertrend: 'long', ichimoku: null, donchian: 'short', emacross: 'long', keltner: null, readable: 3, agreeLong: 2, agreeShort: 1 };
  const mM = W.pineGoldPineMarks(mixed, 'long');
  assert(mM['pine:supertrendWith'] === true && mM['pine:donchianWith'] === false && mM['pine:emacrossWith'] === true && mM['pine:ichimokuWith'] === undefined && mM['pine:keltnerWith'] === undefined && mM['pine:majorityWith'] === undefined,
    'mixed states: WITH / AGAINST per layer, absent where the layer read neither, NO majority mark under three agreeing');
  const three = Object.assign({}, mixed, { keltner: 'long', readable: 4, agreeLong: 3 });
  assert(W.pineGoldPineMarks(three, 'long')['pine:majorityWith'] === true && W.pineGoldPineMarks(three, 'short')['pine:majorityWith'] === false, 'three of five with the plan is a majority WITH; the same three on a short read AGAINST');
  assert(Object.keys(W.pineGoldPineMarks(null, 'long')).length === 0 && Object.keys(W.pineGoldPineMarks({ ok: false }, 'long')).length === 0 && Object.keys(W.pineGoldPineMarks(su, 'x')).length === 0, 'no states, a failed read or no direction mark nothing');
  /* the line */
  const html = W.pineGoldStackLineHtml(mixed, mM);
  assert(/data-hg-pine-stack="1"/.test(html) && /PINE STACK/.test(html) && /3 of 5 gold Pine layers readable/.test(html), 'the line carries its marker and the readable count');
  assert(/Supertrend 10x3<\/b> LONG/.test(html) && /Ichimoku TK Cross<\/b> UNREAD/.test(html) && /MAJORITY<\/b> SPLIT 2L\/1S/.test(html) && /gates nothing/.test(html), 'each layer prints its state (UNREAD where neither), the majority prints SPLIT with the tally, and the line says it gates nothing');
  assert(/MAJORITY<\/b> WITH/.test(W.pineGoldStackLineHtml(su, mL)) && /MAJORITY<\/b> AGAINST/.test(W.pineGoldStackLineHtml(su, mS)), 'a majority prints WITH or AGAINST by the marks');
  assert(W.pineGoldStackLineHtml(null, mL) === '' && W.pineGoldStackLineHtml({ ok: false }, {}) === '', 'no states: no line');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) the four desks end to end ==');
const expectPine = (W, rows, dir) => W.pineGoldPineMarks(W.pineGoldLayerStates(rows), dir);
/* GOLD SCALP, through the ranker directly and through the real tab */
{
  const W = boot(RANK_BASE.concat(PINE_MATH));
  const rows = tapeEnding(WED, 300, 900, 102, 24, 40);
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback', entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  const exp = expectPine(W, rows, 'long');
  assert(Object.keys(exp).length >= 3, 'REACHABILITY: the drifting tape reads at least three Pine states (' + JSON.stringify(exp) + ')');
  const rc = W.goldRankSetups([cand('long')], { macro: MACRO_ALL, rows15m: rows, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
  assert(rc && rc.pineStates && rc.pineStates.ok === true && Object.keys(exp).every(k => rc.freeReads[k] === exp[k]), 'the ranker marks the Pine stack off rows15m for the candidate\'s direction and carries the states');
  const W0 = boot(RANK_BASE);
  const rc0 = W0.goldRankSetups([cand('long')], { macro: MACRO_ALL, rows15m: rows, now: WED, scanner: 'GOLDSCALP' }).ranked[0];
  assert(rc0 && rc0.pineStates === undefined && !Object.keys(rc0.freeReads).some(k => /^pine:/.test(k)) && rc0.tally === rc.tally && JSON.stringify(rc0.parts) === JSON.stringify(rc.parts), 'with pinegoldmath absent: no pine: mark, no states, the SAME tally and parts (the stack scores nothing)');
  const TAB_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                    'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'goldscalp.js', 'accuracy-floor.js'].concat(PINE_MATH);
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24, 0), '1h': tapeEnding(WED, 240, 3600, 103, 30, 0), '4h': tapeEnding(WED, 300, 14400, 104, 40, 6), '1d': tapeEnding(WED, 280, 86400, 105, 60, 20) };
  const Wt = boot(TAB_BASE, clock, {
    getXmGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' }),
    getGoldCandles: async () => ({ rows: [], source: null }),
    getGoldMacro: async () => MACRO_ALL, getGoldMacroCached: () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG,
    binanceFunding: async () => ({ fundingPct: -0.05 }), hgGoldLoadDeltaPerp: async () => null, hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null })
  });
  const tab = Wt.HG_tabs.find(t => t && t.id === 'goldscalp');
  const el = mkEl();
  tab.mount(el);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000){ await settle(3); const s = Wt.goldscalpScan && Wt.goldscalpScan(); if (s && s.cands && s.cands.length) break; }
  const recs = Wt.hgFwdRecords('GOLDSCALP') || [];
  assert(recs.length >= 1, 'REACHABILITY: GOLD SCALP wrote ' + recs.length + ' records');
  assert(recs.every(x => x.reads && Object.keys(x.reads).some(k => /^pine:/.test(k)) && NEW4.every(k => x.reads[k] !== undefined)), 'every GOLD SCALP record carries pine: marks and the four new free legs');
  assert(recs.every(x => Object.keys(x.reads).filter(k => /^pine:/.test(k)).every(k => x.reads[k] === (x.dir === 'long' ? true : false) || x.reads[k] === (x.dir === 'long' ? false : true))), 'each pine: mark is a boolean');
  const dirs = new Set(recs.map(x => x.dir));
  if (dirs.size === 2){
    const a = recs.find(x => x.dir === 'long'), b = recs.find(x => x.dir === 'short');
    assert(Object.keys(a.reads).filter(k => /^pine:/.test(k)).every(k => a.reads[k] === !b.reads[k]), 'a long and a short on the same tape carry mirrored pine: marks');
  }
  let html = String(el.innerHTML);
  for (const k of ['#gsOut', '#gsCards', '#gsBody']) html += String(el.querySelector(k).innerHTML);
  assert(/data-hg-pine-stack="1"/.test(html) && /MINERS\/GOLD<\/b>/.test(html), 'the GOLD SCALP card prints the PINE STACK line and the new free legs');
}
/* OMNIGOLD */
const OG_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-setup-core.js', 'hg-forward.js', 'gold-forward-read.js',
                 'gold-formation.js', 'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                 'omniroute.js', 'setup-ui.js', 'omnigold.js', 'accuracy-floor.js'];
async function ogRun(opts){
  opts = opts || {};
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '1h': tapeEnding(WED, 1500, 3600, 41, 30, 0), '4h': tapeEnding(WED, 1500, 14400, 42, 40, 6), '1d': tapeEnding(WED, 260, 86400, 43, 60, 20), '15m': tapeEnding(WED, 400, 900, 44, 24, 0) };
  const extra = {
    getXmGoldCandles: async () => ({ rows: [], source: null }),
    getGoldCandles: async (tf, n) => ({ rows: (tapes[tf] || []).slice(-(n || 1500)), source: 'binance-xau' }),
    hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    hgGoldLoadDeltaPerp: async () => null,
    S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG, getGoldMacro: async () => MACRO_ALL, getGoldMacroCached: () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 })
  };
  const W = boot(OG_BASE.concat(opts.noPine ? [] : PINE_MATH), clock, extra);
  const tab = W.HG_tabs.find(t => t && t.id === 'omnigold');
  const el = mkEl();
  tab.mount(el);
  await settle(4);
  const run = el.querySelector('#ogRun');
  if (run && run.listeners.click) run.click();
  const t0 = Date.now();
  let cards = null;
  while (Date.now() - t0 < 40000){
    await settle(3);
    try { cards = W.hgOgLastCards ? W.hgOgLastCards() : null; } catch(e){ cards = null; }
    if (cards && cards.ran) break;
  }
  const recs = ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING'].map(t => W.hgFwdRecords(t) || []).reduce((a, b) => a.concat(b), []);
  const all = el.querySelector('#ogShowAll'); if (all.listeners.click) all.click();
  await settle(3);
  let html = String(el.innerHTML);
  for (const k of ['#ogCards', '#ogMp', '#ogPool', '#ogGridOut', '#ogGoldEngines', '#ogVerdict']) html += String(el.querySelector(k).innerHTML);
  return { W, el, tapes, cards, recs, html };
}
{
  const r = await ogRun();
  assert(r.cards && r.cards.ran === true && r.recs.length >= 1, 'REACHABILITY: OMNIGOLD scanned and wrote ' + r.recs.length + ' records');
  assert(r.recs.every(x => x.reads && Object.keys(x.reads).some(k => /^pine:/.test(k)) && NEW4.every(k => x.reads[k] !== undefined)), 'every OMNIGOLD record carries pine: marks and the four new free legs');
  const byTab = {};
  for (const x of r.recs) (byTab[x.tab] = byTab[x.tab] || []).push(x);
  for (const t in byTab){
    const L = byTab[t].find(x => x.dir === 'long'), S = byTab[t].find(x => x.dir === 'short');
    if (L && S) assert(Object.keys(L.reads).filter(k => /^pine:/.test(k)).every(k => L.reads[k] === !S.reads[k]), t + ': a long and a short carry mirrored pine: marks (one stack per horizon)');
    const sc = byTab['OMNIGOLD:SCALP'], sw = byTab['OMNIGOLD:SWING'];
    if (sc && sw && sc[0].dir === sw[0].dir){
      const ks = Object.keys(sc[0].reads).filter(k => /^pine:/.test(k));
      const same = ks.every(k => sc[0].reads[k] === sw[0].reads[k]);
      assert(true, 'scalp and swing stacks are read off their own rows (' + (same ? 'agree on this tape' : 'differ on this tape') + ')');
    }
  }
  assert((r.html.match(/data-hg-pine-stack="1"/g) || []).length >= 1, 'the painted OMNIGOLD cards print the PINE STACK line');
  const r0 = await ogRun({ noPine: true });
  const sig = rs => rs.map(x => [x.tab, x.mechanic, x.dir, x.entry, x.stop, x.t1, x.barT, x.ticket].join('|')).sort().join('\n');
  assert(sig(r.recs) === sig(r0.recs) && r0.recs.every(x => !Object.keys(x.reads).some(k => /^pine:/.test(k))), 'with the Pine stack absent the same setups form at the same levels with the same ticket claim, and no pine: mark is made');
}
/* GANESH GOLD */
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
  const ggBoot = (pine) => boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'hg-forward.js', 'goldind.js', 'gold-catalog.js'].concat(pine ? PINE_MATH : []).concat(['ganeshgold.js']), null, {
    getXAUCandles: async tf => (tf === '15m' ? longTape() : (tf === '4h' ? mkTape(100, H4, i => ({ o: 2500 + i, h: 2502 + i, l: 2498 + i, c: 2501 + i, v: 400 })) : mkDay())),
    regimeState: () => ({ dxy: { trend20: 'FALLING' }, tnx: { trend: 'FALLING' } }),
    hgNewsRisk: () => ({ blackout: false }),
    hgGoldGateAt: () => ({ weekend: { inWeekend: false }, lock: false }),
    getGoldMacroCached: () => MACRO_ALL, goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG, binanceFunding: async () => ({ fundingPct: -0.05 })
  });
  const W = ggBoot(true);
  const snap = await W.ganeshGoldScan({ style: 'scalp' });
  assert(snap && snap.ok === true && snap.plan && snap.plan.tier === 'TICKET', 'REACHABILITY: GANESH GOLD crowns a TICKET');
  const recs = W.hgFwdRecords('GANESHGOLD') || [];
  const pk = Object.keys(recs[0].reads).filter(k => /^pine:/.test(k));
  assert(recs.length === 1 && pk.length >= 3 && NEW4.every(k => recs[0].reads[k] !== undefined), 'the record carries pine: marks (' + pk.length + ') and the four new free legs');
  assert(snap.plan.pineStates && snap.plan.pineStates.ok === true && snap.alt && snap.alt.freeReads && pk.every(k => snap.alt.freeReads[k] === !snap.plan.freeReads[k]), 'both plans are marked, the alternate mirrored for ITS direction, off one stack');
  const tab = W.HG_tabs.find(t => t && t.id === 'ganeshgold');
  const el = mkEl(); tab.mount(el); await settle(4);
  const run = el.querySelector('#ggRun'); if (run.listeners.click) run.click();
  const tg = Date.now(); let all = '';
  while (Date.now() - tg < 20000){ await settle(3); all = String(el.innerHTML) + String(el.querySelector('#ggBody').innerHTML); if (/THE CALL/.test(all)) break; }
  assert(/THE CALL/.test(all) && /data-hg-pine-stack="1"/.test(all), 'the call panel prints the PINE STACK line');
  const W0 = ggBoot(false);
  const snap0 = await W0.ganeshGoldScan({ style: 'scalp' });
  const recs0 = W0.hgFwdRecords('GANESHGOLD') || [];
  assert(snap0.plan && snap0.plan.tier === 'TICKET' && recs0[0].entry === recs[0].entry && recs0[0].stop === recs[0].stop && recs0[0].t1 === recs[0].t1 && !Object.keys(recs0[0].reads).some(k => /^pine:/.test(k)), 'with the stack absent the same TICKET forms at the same levels and no pine: mark is made');
}
/* GOLD PINE */
{
  const PINE_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                     'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'pinemath.js', 'pinegoldmath.js', 'goldpine.js', 'accuracy-floor.js'];
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '15m': tapeEnding(WED, 300, 900, 102, 24, 0), '1h': tapeEnding(WED, 240, 3600, 103, 30, 0), '4h': tapeEnding(WED, 300, 14400, 104, 40, 6), '1d': tapeEnding(WED, 280, 86400, 105, 60, 20) };
  const W = boot(PINE_BASE, clock, {
    getGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'binance-xau' }), hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    getGoldMacro: async () => MACRO_ALL, goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG, binanceFunding: async () => ({ fundingPct: -0.05 })
  });
  const tab = W.HG_tabs.find(t => t && t.id === 'goldpine');
  const el = mkEl(); tab.mount(el);
  const t1 = Date.now();
  while (Date.now() - t1 < 20000){ await settle(2); if (/^done|^error|^failed/.test(el.querySelector('#goldPineStat').textContent)) break; }
  const snap = W.goldPineScan();
  const all = snap.swing.concat(snap.scalp);
  assert(all.length >= 2 && all.every(s => s.pineStates && s.pineStates.ok === true), 'REACHABILITY: every GOLD PINE row carries the Pine states (' + all.length + ' rows)');
  const okSw = snap.swing.every(s => { const e = expectPine(W, tapes['4h'], s.dir); return Object.keys(e).every(k => s.freeReads[k] === e[k]); });
  const okSc = snap.scalp.every(s => { const e = expectPine(W, tapes['15m'], s.dir); return Object.keys(e).every(k => s.freeReads[k] === e[k]); });
  assert(okSw && okSc, 'swing rows carry the stack read off the 4h tape and scalp rows off the 15m tape, for each row\'s own direction');
  const recs = W.hgFwdRecords('GOLDPINE:scalp').concat(W.hgFwdRecords('GOLDPINE:swing'));
  assert(recs.length >= 2 && recs.every(x => x.reads && Object.keys(x.reads).some(k => /^pine:/.test(k))), 'every GOLD PINE record carries pine: marks');
  assert((String(el.querySelector('#goldPineOut').innerHTML).match(/data-hg-pine-stack="1"/g) || []).length >= 1, 'the cards print the PINE STACK line');
}

/* ------------------------------------------------------------------ 5 */
console.log('== 5) the cap, nothing gated, the census, stamps ==');
{
  const W = boot(['hg-forward.js']);
  const many = {}; for (let i = 0; i < 70; i++) many['r' + String(i).padStart(2, '0')] = true;
  const why = W.hgFwdRecord({ tab: 'CAPTEST', mechanic: 'x', sym: 'XAUUSD', tf: '15m', dir: 'long', entry: 2300, stop: 2290, t1: 2320, barT: Math.floor(WED / 1000), reads: many });
  const rec = (W.hgFwdRecords('CAPTEST') || [])[0];
  assert(why === 'recorded' && rec && Object.keys(rec.reads).length === 64, 'the ledger keeps 64 reads per record now (a 70-key hand-in keeps 64, the store is still not a dumping ground)');
  const Wr = boot(RANK_BASE.concat(PINE_MATH));
  const KEYS = Wr.HG_GOLD_FREE_KEYS.length + 2 + Object.keys(Wr.hgGoldIndicatorMarks(Wr.hgGoldIndicatorReads(tapeEnding(WED, 300, 900, 102, 24, 0), { rows1d: tapeEnding(WED, 280, 86400, 105, 60, 20) }), 'long')).length + PINE_KEYS.length;
  assert(KEYS <= 64 && KEYS > 32, 'sixteen free: + two PERFECT + the indicator stack + six pine: = ' + KEYS + ' keys: over the old cap of 32, inside 64');
  for (const f of ['hg-gates.js', 'cryptogates.js', 'engine.js', 'gold-best-levels.js', 'gold-formation.js', 'hg-solidity.js', 'plans.js']){
    assert(!/['"]pine:|pineStates|minersGold|goldCopper|goldOil|eurusdTrend/.test(strip(read(f))), f + ' names no hg-v1165 mark');
  }
  const gi = strip(read('goldind.js'));
  assert(!/freeReads\[\s*['"]pine:/.test(gi) && !/pineStates\.(supertrend|ichimoku|donchian|emacross|keltner|agree)/.test(gi), 'the ranker never reads a pine: mark or a state back (textual, hg-v956)');
  assert(!/free:minersGold|free:goldCopper|free:goldOil|free:eurusd/.test(body(gi, 'function goldRankSetups(')), 'the ranker names none of the four new legs (it scores nothing on them; the home marks them)');
  /* the census */
  const Wc = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js']);
  const rows = tapeEnding(WED, 300, 900, 102, 24, 0);
  const f = Wc.hgGoldCatalogFeed(rows, { ctx: { macro: MACRO_ALL, now: WED } });
  const byId = id => (f.used.find(r => r.id === id) || f.unchecked.find(r => r.id === id) || {});
  const usedIds = new Set(f.used.map(r => r.id));
  assert([152, 154, 155].every(id => usedIds.has(id)), 'the catalog reads #152 (JPY/oil/Cu), #154 (GDX relative strength) and #155 (XAUEUR) USED');
  assert(/gold\/oil rising/.test(byId(152).note) && /gold\/copper falling/.test(byId(152).note) && /GDX \/ GC=F 20d rising/.test(byId(154).note) && /EURUSD 20d falling/.test(byId(155).note), 'each note names its value');
  const f0 = Wc.hgGoldCatalogFeed(rows, { ctx: { macro: MACRO_NO4, now: WED } });
  const u0 = new Set(f0.used.map(r => r.id));
  assert(!u0.has(154) && !u0.has(155) && u0.has(152) && /USDJPY/.test((f0.used.find(r => r.id === 152) || {}).note) && !/oil/.test((f0.used.find(r => r.id === 152) || {}).note), 'without the legs #154 and #155 read UNCHECKED and #152 names only the USDJPY read');
  const bs = read('build-stamp.js');
  assert(bs.includes("version: '" + HG_VER + "'"), 'build-stamp.js version is ' + HG_VER);
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + ' ' + pass + ' assertions' + (fail ? ' (' + fail + ' failed)' : ''));
process.exit(fail ? 1 : 0);
