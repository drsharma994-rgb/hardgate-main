#!/usr/bin/env node
/* hg-v1163 — the three free Yahoo legs hg-v1158 named as not fetched (^GVZ,
   ^GSPC, BTC-USD) and the COT caution join the one free-feed home as marks;
   OMNIGOLD and GANESH GOLD records carry the free-feed and indicator-stack
   marks; GOLD SCALP prints every free-feed mark; nothing scores on a read
   that has not been measured.

   Sections:
     1  macro.js: the correlation helper (aligned by UTC date, null under ten
        shared returns or on a flat series) and getGoldMacro carrying the
        three legs
     2  the home: four more three-state marks; the ranker derives its COT
        caution from the home and scores NOTHING on the three state reads
        (tally identical with and without them); marks == verdicts on a grid
     3  OMNIGOLD end to end: every record carries the marks; the card prints
        the two lines; no funding on this desk (absent, not conflated)
     4  GANESH GOLD end to end: the crowned plan's record carries reads +
        fundingPct; the call panel prints the two lines
     5  GOLD SCALP and GOLD PINE: the records carry the twelve free: keys and
        the card prints the FREE FEEDS line with the state reads
     6  the catalog census reads the three legs USED, naming each value
     7  fail-open; the 32-key record fits the cap exactly; no gate names a
        mark; stamps */
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
function mkEl(){
  const kids = {}, ctl = {};
  const e = { style: {}, innerHTML: '', textContent: '', disabled: false, className: '', dataset: {}, attrs: {}, listeners: {}, value: '',
    appendChild(){}, setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }, removeEventListener(){},
    click(){ (this.listeners.click || []).forEach(f => f()); },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    querySelector(sel){ return kids[sel] || (kids[sel] = mkEl()); },
    querySelectorAll(sel){
      const m = sel.match(/^\[([a-z0-9-]+)\]$/i);
      if (!m) return [];
      const re = new RegExp(m[1] + '="([^"]*)"', 'g'); const out = []; let x;
      while ((x = re.exec(String(this.innerHTML)))){ const k = m[1] + '=' + x[1]; if (!ctl[k]){ ctl[k] = mkEl(); ctl[k].attrs[m[1]] = x[1]; } if (out.indexOf(ctl[k]) < 0) out.push(ctl[k]); }
      return out;
    } };
  return e;
}
function boot(files, clock, extra){
  const FakeDate = clock ? class extends Date { static now(){ return clock.now; } } : Date;
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date: FakeDate, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, Float64Array, Infinity, NaN,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, setImmediate,
    encodeURIComponent, decodeURIComponent, URL, URLSearchParams, AbortController };
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
const RANK_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js',
                   'goldind.js', 'gold-catalog.js', 'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'hg-setup-core.js'];
const FREE8 = ['free:macroTilt', 'free:paxgBasis', 'free:perpFunding', 'free:fearGreed', 'free:silver', 'free:gsRatio', 'free:vix', 'free:usdjpy'];
const NEW4 = ['free:cotAgainst', 'free:gvzRising', 'free:spxCorrPositive', 'free:btcCorrPositive'];
const MACRO_ALL = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                    realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo',
                    gvzTrend: 'RISING', gvzLast: 18.4, vixLast: 15.2, goldSpxCorr20: 0.45, goldBtcCorr20: -0.52 };
const COT_LONG = { crowding: 'SPEC CROWDED LONG', zScore: 2.3, reportDate: '2026-04-07' };
const FEEDS_ALL = { macro: MACRO_ALL, fng: { v: 20 }, fundingRate: -0.05, spot: { verdict: 'shorts-crowding', basisPct: -0.2 }, cot: COT_LONG };
const EXP_LONG = { 'free:cotAgainst': true, 'free:gvzRising': true, 'free:spxCorrPositive': true, 'free:btcCorrPositive': false };
const EXP_SHORT = { 'free:cotAgainst': false, 'free:gvzRising': true, 'free:spxCorrPositive': true, 'free:btcCorrPositive': false };

/* ------------------------------------------------------------------ 1 */
console.log('== 1) macro.js: the correlation helper and the three legs ==');
{
  const W = boot(['macro.js'], null, { binanceKlines: async () => [] });
  assert(typeof W.hgCorrDailyReturns === 'function', 'the correlation helper is exported (pure)');
  const DAY = 86400;
  const ser = (closes, t0) => closes.map((c, i) => ({ t: t0 + i * DAY, o: c, h: c, l: c, c, v: 0 }));
  const T0 = 1770000000 - (1770000000 % DAY);
  const a = [], b = [], c = [];
  let s = 3; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let pa = 2300, pb = 5000, pc = 60000;
  /* b moves with a (same log return), c mirrors it (the inverse log return) */
  for (let i = 0; i < 25; i++){ const r = (rnd() - 0.5) * 0.02; pa *= 1 + r; pb *= 1 + r; pc /= 1 + r; a.push(pa); b.push(pb); c.push(pc); }
  const corrAB = W.hgCorrDailyReturns(ser(a, T0), ser(b, T0), 20), corrAC = W.hgCorrDailyReturns(ser(a, T0), ser(c, T0), 20);
  assert(Math.abs(corrAB - 1) < 1e-9 && Math.abs(corrAC + 1) < 1e-9, 'a series that moves with gold reads +1, one that mirrors it reads −1 (' + corrAB.toFixed(3) + ' / ' + corrAC.toFixed(3) + ')');
  /* alignment by UTC date: BTC prints the days gold does not */
  const gold = ser(a, T0).filter((r, i) => (i % 7) !== 5 && (i % 7) !== 6);
  const btc = ser(c, T0);
  const corrAligned = W.hgCorrDailyReturns(gold, btc, 20);
  assert(Math.abs(corrAligned + 1) < 1e-9, 'aligned by UTC date: gold with the weekend days missing still reads −1 against a daily BTC series (an unaligned zip would not)');
  assert(W.hgCorrDailyReturns(ser(a.slice(0, 10), T0), ser(b.slice(0, 10), T0), 20) === null, 'under ten shared returns is null, never a number');
  assert(W.hgCorrDailyReturns(ser(a, T0), ser(a.map(() => 100), T0), 20) === null, 'a flat series is null (zero variance is no correlation, not a correlation of zero)');
  assert(W.hgCorrDailyReturns(null, ser(b, T0), 20) === null && W.hgCorrDailyReturns(ser(a, T0), ser(b.map((v, i) => (i === 12 ? 'x' : v)), T0), 20) !== null, 'no series is null; a junk close is skipped rather than coerced');
  /* getGoldMacro, real, with a URL-routed fetch: every leg dark except Yahoo */
  const chart = closes => ({ chart: { result: [{ timestamp: closes.map((_, i) => T0 + i * DAY), indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1) }] } }] } });
  const gvz = [], spx = [], btcs = [], gc = [];
  let g = 17, q = 5000, bb = 60000, gcp = 2300;
  for (let i = 0; i < 24; i++){ const r = (rnd() - 0.5) * 0.02; gcp *= 1 + r; q *= 1 + r; bb /= 1 + r; g += 0.1; gvz.push(g); spx.push(q); btcs.push(bb); gc.push(gcp); }
  const route = url => {
    const u = decodeURIComponent(String(url).replace(/^\/api\/proxy\?url=/, ''));
    const sym = (u.match(/finance\/chart\/([^?]+)/) || [])[1];
    if (sym === '^GVZ') return chart(gvz);
    if (sym === '^GSPC') return chart(spx);
    if (sym === 'BTC-USD') return chart(btcs);
    if (sym === 'GC=F') return chart(gc);
    if (sym === '^VIX') return chart([15, 15.1, 15.2, 15.3, 15.2]);
    return null;
  };
  const W2 = boot(['macro.js'], null, { binanceKlines: async () => [], fetch: async url => { const j = route(url); return j ? { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) } : { ok: false, status: 404, json: async () => ({}), text: async () => '' }; } });
  const m = await W2.getGoldMacro();
  assert(m && m.gvzTrend === 'RISING' && Math.abs(m.gvzLast - gvz[gvz.length - 1]) < 1e-9, 'getGoldMacro carries the GVZ level and its trend from ^GVZ (' + m.gvzTrend + ' · ' + (m.gvzLast && m.gvzLast.toFixed(2)) + ')');
  assert(typeof m.goldSpxCorr20 === 'number' && typeof m.goldBtcCorr20 === 'number' && Math.abs(m.goldSpxCorr20 - 1) < 1e-9 && Math.abs(m.goldBtcCorr20 + 1) < 1e-9, 'and the two 20-day correlations against GC=F (SPX ' + m.goldSpxCorr20 + ', BTC ' + m.goldBtcCorr20 + ')');
  assert(m.vixLast === 15.2 && m.vixTrend === 'RISING', 'and the VIX level beside its trend (for the GVZ/VIX ratio)');
  const W3 = boot(['macro.js'], null, { binanceKlines: async () => [], fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }) });
  const m3 = await W3.getGoldMacro();
  assert(m3 && m3.gvzTrend === null && m3.gvzLast === null && m3.goldSpxCorr20 === null && m3.goldBtcCorr20 === null, 'with every Yahoo leg dark the five fields are null (the shape is kept, nothing is invented)');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the home: four more marks; the ranker scores nothing on the three state reads ==');
{
  const W = boot(RANK_BASE);
  assert(W.HG_GOLD_FREE_KEYS.length === 12 && NEW4.every(k => W.HG_GOLD_FREE_KEYS.indexOf(k) >= 0), 'the key list carries the four hg-v1163 reads');
  const L = W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'long'), S = W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'short');
  assert(NEW4.every(k => L[k] === EXP_LONG[k]) && NEW4.every(k => S[k] === EXP_SHORT[k]), 'COT crowded long reads CROWDED THIS SIDE on a long and the other side on a short; GVZ rising, SPX corr positive and BTC corr negative read the same state either way');
  assert(Object.keys(L).length === 12 && Object.keys(S).length === 12, 'twelve keys, no stowaway');
  const flat = W.hgGoldFreeFeedVerdicts({ macro: { gvzTrend: 'FLAT', goldSpxCorr20: 0.1, goldBtcCorr20: -0.29 }, cot: { crowding: 'N/A' } }, 'long');
  assert(Object.keys(flat).length === 0, 'a FLAT GVZ, a correlation inside ±0.30 and a COT with no crowding mark NOTHING');
  const junk = W.hgGoldFreeFeedVerdicts({ macro: { gvzTrend: 'UP', goldSpxCorr20: '0.8', goldBtcCorr20: null }, cot: 'x' }, 'long');
  assert(Object.keys(junk).length === 0, 'junk is unread: a trend string that is not RISING/FALLING, a string correlation, a null, a string COT');
  assert(W.hgGoldFreeFeedVerdicts({ macro: { goldSpxCorr20: 0.3 } }, 'long')['free:spxCorrPositive'] === true && W.hgGoldFreeFeedVerdicts({ macro: { goldSpxCorr20: -0.3 } }, 'long')['free:spxCorrPositive'] === false, 'the band is inclusive at ±0.30');
  /* the window snapshot is the fallback the ranker always read */
  W.__hgGoldCot = { crowding: 'SPEC CROWDED SHORT' };
  assert(W.hgGoldFreeFeedVerdicts({ macro: null }, 'short')['free:cotAgainst'] === true && W.hgGoldFreeFeedVerdicts({ cot: COT_LONG }, 'short')['free:cotAgainst'] === false, 'the desk\'s own COT snapshot wins; the window\'s is the fallback');
  W.__hgGoldCot = null;
  /* the ranker */
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback', entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  const ctxOf = over => Object.assign({ scanner: 'GOLDSCALP', now: Date.now(), news: { caution: false }, rows15m: [], rows4h: [], rows1h: [] }, over || {});
  const macroNoState = Object.assign({}, MACRO_ALL, { gvzTrend: null, gvzLast: null, goldSpxCorr20: null, goldBtcCorr20: null });
  const withState = W.goldRankSetups([cand('long')], ctxOf({ macro: MACRO_ALL })).ranked[0];
  const noState = W.goldRankSetups([cand('long')], ctxOf({ macro: macroNoState })).ranked[0];
  assert(withState.tally === noState.tally && JSON.stringify(withState.tallyParts) === JSON.stringify(noState.tallyParts), 'the three state reads SCORE NOTHING: the tally and its parts are identical with and without them (' + withState.tally + ')');
  assert(withState.freeReads['free:gvzRising'] === true && withState.freeReads['free:spxCorrPositive'] === true && withState.freeReads['free:btcCorrPositive'] === false && noState.freeReads['free:gvzRising'] === undefined, 'and they are MARKED on the ranked row, absent when unread');
  const cotLong = W.goldRankSetups([cand('long')], ctxOf({ macro: macroNoState, cot: COT_LONG })).ranked[0];
  const cotShort = W.goldRankSetups([cand('short')], ctxOf({ macro: macroNoState, cot: COT_LONG })).ranked[0];
  const noCot = W.goldRankSetups([cand('long')], ctxOf({ macro: macroNoState })).ranked[0];
  const shortNoCot = W.goldRankSetups([cand('short')], ctxOf({ macro: macroNoState })).ranked[0];
  assert(cotLong.tally === noCot.tally - 1 && /COT spec crowded long/.test(cotLong.tallyParts.map(p => p.label).join('|')) && cotLong.freeReads['free:cotAgainst'] === true, 'COT crowded long costs a long exactly −1 with the caution label, and marks CROWDED THIS SIDE');
  assert(cotShort.tally === shortNoCot.tally && cotShort.freeReads['free:cotAgainst'] === false && noCot.freeReads['free:cotAgainst'] === undefined, 'the same crowding costs a short nothing and marks the other side; no snapshot marks nothing');
  /* the grid: every mark equals the home's verdict */
  let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = a => a[Math.floor(rnd() * a.length)];
  let n = 0, bad = 0;
  for (let i = 0; i < 300; i++){
    const macro = Object.assign({}, MACRO_ALL, { gvzTrend: pick(['RISING', 'FALLING', 'FLAT', null]), goldSpxCorr20: pick([0.5, -0.5, 0.1, null]), goldBtcCorr20: pick([0.4, -0.6, 0, 'x']), silverTrend: pick(['RISING', 'FALLING', 'FLAT']) });
    const feeds = { macro, cot: pick([COT_LONG, { crowding: 'SPEC CROWDED SHORT' }, { crowding: 'N/A' }, null]), fng: pick([{ v: 20 }, { v: 80 }, null]), fundingRate: pick([-0.05, 0.05, null]), spot: { verdict: pick(['longs-crowding', 'shorts-crowding', null]) } };
    for (const dir of ['long', 'short']){
      const r = W.goldRankSetups([cand(dir)], ctxOf(feeds)).ranked[0];
      const fv = W.hgGoldFreeFeedVerdicts(feeds, dir);
      const got = {}; for (const k of W.HG_GOLD_FREE_KEYS) if (r.freeReads && r.freeReads[k] !== undefined) got[k] = r.freeReads[k];
      const sorted = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
      n++; if (sorted(got) !== sorted(fv)) bad++;
    }
  }
  assert(bad === 0, 'the ranked row\'s twelve free-feed marks EQUAL the home\'s verdicts on all ' + n + ' grid cases');
  const line = W.hgGoldFreeFeedLineHtml(L, { fundingPct: -0.05 });
  assert(/12 of 12 free internet feeds read/.test(line) && /CROWDED THIS SIDE/.test(line) && /GVZ<\/b> RISING/.test(line) && /GOLD-SPX CORR<\/b> POSITIVE/.test(line) && /GOLD-BTC CORR<\/b> NEGATIVE/.test(line), 'the line prints the four reads in their own words');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) OMNIGOLD end to end ==');
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
    hgGoldLoadDeltaPerp: async () => null
  };
  if (!opts.noFeeds){
    extra.S = { fng: { v: 20 } };
    extra.__hgGoldCot = COT_LONG;
    extra.getGoldMacro = async () => MACRO_ALL;
    extra.getGoldMacroCached = () => MACRO_ALL;
    extra.goldspotState = () => ({ verdict: 'shorts-crowding', basisPct: -0.2 });
  }
  const files = OG_BASE.filter(f => !(opts.drop || []).includes(f));
  const W = boot(files, clock, extra);
  if (opts.before) opts.before(W);
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
  /* the board opens PAID-ONLY (no mechanic has paid on a fresh ledger, so it
     hides every card); ALL is one click away and paints the cards */
  const all = el.querySelector('#ogShowAll'); if (all.listeners.click) all.click();
  await settle(3);
  let html = String(el.innerHTML);
  for (const k of ['#ogCards', '#ogMp', '#ogPool', '#ogGridOut', '#ogGoldEngines', '#ogVerdict']) html += String(el.querySelector(k).innerHTML);
  return { W, el, tapes, cards, recs, html };
}
{
  const r = await ogRun();
  assert(r.cards && r.cards.ran === true, 'REACHABILITY: the real OMNIGOLD tab mounted and scanned');
  assert(r.recs.length >= 1, 'REACHABILITY: ' + r.recs.length + ' OMNIGOLD records written');
  const fvL = r.W.hgGoldFreeFeedVerdicts({ macro: MACRO_ALL, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, cot: COT_LONG }, 'long');
  const fvS = r.W.hgGoldFreeFeedVerdicts({ macro: MACRO_ALL, fng: { v: 20 }, spot: { verdict: 'shorts-crowding' }, cot: COT_LONG }, 'short');
  const keys = Object.keys(fvL);
  assert(keys.length === 11 && keys.indexOf('free:perpFunding') < 0, 'the feeds this desk reads mark eleven legs — no funding (the Binance PAXG leg is not fetched here, and the Delta gold-perp print is a different one)');
  assert(r.recs.every(x => x.reads && keys.every(k => x.reads[k] === (x.dir === 'long' ? fvL[k] : fvS[k]))), 'every record carries the eleven free-feed marks for its own direction');
  assert(r.recs.every(x => Object.keys(x.reads).filter(k => /^ind:/.test(k)).length >= 10), 'and the indicator stack beside them');
  assert(r.recs.some(x => x.reads['ind:hurstTrending'] !== undefined || x.reads['ind:acMomentum'] !== undefined), 'the daily leg the MTF matrix already fetched is the stack\'s daily leg: a Hurst or ACF mark rides');
  assert(r.recs.every(x => x.fundingPct === undefined && x.fundAgainst === undefined), 'no funding on an OMNIGOLD record: NOT RECORDED, never a conflated rate');
  const scalpRec = r.recs.find(x => x.tab === 'OMNIGOLD:SCALP'), swingRec = r.recs.find(x => x.tab === 'OMNIGOLD:SWING');
  if (scalpRec && swingRec) assert(scalpRec.reads['ind:sma20With'] !== undefined || swingRec.reads['ind:sma20With'] !== undefined, 'each horizon\'s stack is read off its own rows');
  const cardsHtml = r.html;
  assert((cardsHtml.match(/data-hg-free-feeds="1"/g) || []).length >= 1 && (cardsHtml.match(/data-hg-ind-stack="1"/g) || []).length >= 1, 'the painted cards print the FREE FEEDS line and the INDICATOR STACK line');
  const r0 = await ogRun({ noFeeds: true });
  assert(r0.recs.length >= 1 && r0.recs.every(x => x.reads && !Object.keys(x.reads).some(k => /^free:/.test(k)) && Object.keys(x.reads).some(k => /^ind:/.test(k))), 'with no feed loaded the records carry no free: mark and the ind: marks still ride');
  const sig = rs => rs.map(x => [x.tab, x.mechanic, x.dir, x.entry, x.stop, x.t1, x.barT, x.ticket].join('|')).sort().join('\n');
  assert(sig(r.recs) === sig(r0.recs), 'the setups this desk forms, their levels and their ticket claim are BYTE-IDENTICAL with and without the feeds (a mark gates nothing)');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) GANESH GOLD end to end ==');
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
  const ggBoot = (feeds, dropCatalog) => boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'hg-forward.js', 'goldind.js'].concat(dropCatalog ? [] : ['gold-catalog.js']).concat(['ganeshgold.js']), null, Object.assign({
    getXAUCandles: async tf => (tf === '15m' ? longTape() : (tf === '4h' ? mkTape(100, H4, i => ({ o: 2500 + i, h: 2502 + i, l: 2498 + i, c: 2501 + i, v: 400 })) : mkDay())),
    regimeState: () => ({ dxy: { trend20: 'FALLING' }, tnx: { trend: 'FALLING' } }),
    hgNewsRisk: () => ({ blackout: false }),
    hgGoldGateAt: () => ({ weekend: { inWeekend: false }, lock: false })
  }, feeds ? { getGoldMacroCached: () => MACRO_ALL, goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG, binanceFunding: async () => ({ fundingPct: -0.05 }) } : {}));
  const W = ggBoot(true);
  const snap = await W.ganeshGoldScan({ style: 'scalp' });
  assert(snap && snap.ok === true && snap.plan && snap.plan.dir === 'long' && snap.plan.tier === 'TICKET', 'REACHABILITY: the long model crowns a TICKET on the sweep + displacement + FVG tape');
  const recs = W.hgFwdRecords('GANESHGOLD') || [];
  assert(recs.length === 1, 'REACHABILITY: one GANESHGOLD record written');
  const fvL = W.hgGoldFreeFeedVerdicts({ macro: MACRO_ALL, fng: { v: 20 }, fundingRate: -0.05, spot: { verdict: 'shorts-crowding' }, cot: COT_LONG }, 'long');
  assert(Object.keys(fvL).length === 12 && Object.keys(fvL).every(k => recs[0].reads[k] === fvL[k]), 'the record carries all twelve free-feed marks for the crowned direction');
  assert(Object.keys(recs[0].reads).filter(k => /^ind:/.test(k)).length >= 10 && recs[0].reads['ind:hurstTrending'] === undefined, 'and the indicator stack off the 15m execution tape (ten daily bars are too few for a Hurst read: absent, never guessed)');
  assert(recs[0].fundingPct === -0.05 && recs[0].fundAgainst === false, 'and the PAXG funding print, with the G4 verdict the ledger derived (−0.05 is not against a long)');
  assert(snap.plan.freeReads && snap.plan.indReads && snap.alt && snap.alt.freeReads && snap.alt.freeReads['free:cotAgainst'] === false, 'both plans are marked, the alternate for ITS direction (COT crowded long is the other side for the short)');
  const tab = W.HG_tabs.find(t => t && t.id === 'ganeshgold');
  assert(!!tab, 'REACHABILITY: the tab is registered');
  const el = mkEl();
  tab.mount(el);
  await settle(4);
  const run = el.querySelector('#ggRun'); if (run.listeners.click) run.click();
  const tg = Date.now();
  let all = '';
  while (Date.now() - tg < 20000){ await settle(3); all = String(el.innerHTML) + String(el.querySelector('#ggBody').innerHTML); if (/THE CALL/.test(all)) break; }
  assert(/THE CALL/.test(all), 'REACHABILITY: the tab painted the call panel');
  assert(/data-hg-free-feeds="1"/.test(all) && /data-hg-ind-stack="1"/.test(all), 'the call panel prints the FREE FEEDS line and the INDICATOR STACK line');
  const W0 = ggBoot(false);
  const snap0 = await W0.ganeshGoldScan({ style: 'scalp' });
  const recs0 = W0.hgFwdRecords('GANESHGOLD') || [];
  assert(snap0.plan && snap0.plan.tier === 'TICKET' && recs0.length === 1 && recs0[0].entry === recs[0].entry && recs0[0].stop === recs[0].stop && recs0[0].t1 === recs[0].t1, 'with no feed the same TICKET forms at the same levels (a mark gates nothing)');
  assert(recs0[0].reads && !Object.keys(recs0[0].reads).some(k => /^free:/.test(k)) && recs0[0].fundingPct === undefined, 'and its record carries no free: mark and no funding');
  const Wc = ggBoot(true, true);
  await Wc.ganeshGoldScan({ style: 'scalp' });
  const recsC = Wc.hgFwdRecords('GANESHGOLD') || [];
  assert(recsC.length === 1 && Object.keys(recsC[0].reads).filter(k => /^free:/.test(k)).length === 12 && !Object.keys(recsC[0].reads).some(k => /^ind:/.test(k)), 'without the catalog the free-feed marks ride and no ind: mark is made');
}

/* ------------------------------------------------------------------ 5 */
console.log('== 5) GOLD SCALP and GOLD PINE carry the twelve keys ==');
{
  const TAB_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                    'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'goldscalp.js', 'accuracy-floor.js'];
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24, 0), '1h': tapeEnding(WED, 240, 3600, 103, 30, 0), '4h': tapeEnding(WED, 300, 14400, 104, 40, 6), '1d': tapeEnding(WED, 280, 86400, 105, 60, 20) };
  const W = boot(TAB_BASE, clock, {
    getXmGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'xm-xauusd' }),
    getGoldCandles: async () => ({ rows: [], source: null }),
    getGoldMacro: async () => MACRO_ALL, getGoldMacroCached: () => MACRO_ALL,
    goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG,
    binanceFunding: async () => ({ fundingPct: -0.05 }), hgGoldLoadDeltaPerp: async () => null, hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null })
  });
  const tab = W.HG_tabs.find(t => t && t.id === 'goldscalp');
  const el = mkEl();
  tab.mount(el);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000){ await settle(3); const s = W.goldscalpScan && W.goldscalpScan(); if (s && s.cands && s.cands.length) break; }
  const snap = W.goldscalpScan();
  assert(snap && snap.cands && snap.cands.length >= 1, 'REACHABILITY: GOLD SCALP formed ' + (snap && snap.cands ? snap.cands.length : 0) + ' candidates');
  const recs = W.hgFwdRecords('GOLDSCALP') || [];
  assert(recs.length >= 1 && recs.every(x => x.reads && W.HG_GOLD_FREE_KEYS.every(k => x.reads[k] !== undefined)), 'every GOLD SCALP record carries all twelve free-feed keys');
  assert(recs.every(x => x.reads['free:gvzRising'] === true && x.reads['free:spxCorrPositive'] === true && x.reads['free:btcCorrPositive'] === false && x.reads['free:cotAgainst'] === (x.dir === 'long')), 'the state reads read the same both ways; COT crowded long is CROWDED THIS SIDE on longs only');
  let html = String(el.innerHTML);
  for (const k of ['#gsOut', '#gsCards', '#gsBody']) html += String(el.querySelector(k).innerHTML);
  assert(/data-hg-free-feeds="1"/.test(html) && /GVZ<\/b> RISING/.test(html) && /CROWDED/.test(html), 'the GOLD SCALP card prints the FREE FEEDS line with the state reads');
  /* GOLD PINE: the same twelve, through the desk seam */
  const PINE_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                     'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'pinemath.js', 'pinegoldmath.js', 'goldpine.js', 'accuracy-floor.js'];
  const Wp = boot(PINE_BASE, clock, {
    getGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'binance-xau' }), hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null }),
    getGoldMacro: async () => MACRO_ALL, goldspotState: () => ({ verdict: 'shorts-crowding', basisPct: -0.2 }), S: { fng: { v: 20 } }, __hgGoldCot: COT_LONG, binanceFunding: async () => ({ fundingPct: -0.05 })
  });
  const tabP = Wp.HG_tabs.find(t => t && t.id === 'goldpine');
  const elP = mkEl();
  tabP.mount(elP);
  const t1 = Date.now();
  while (Date.now() - t1 < 20000){ await settle(2); if (/^done|^error|^failed/.test(elP.querySelector('#goldPineStat').textContent)) break; }
  const recsP = Wp.hgFwdRecords('GOLDPINE:scalp').concat(Wp.hgFwdRecords('GOLDPINE:swing'));
  assert(recsP.length >= 2 && recsP.every(x => x.reads && Wp.HG_GOLD_FREE_KEYS.every(k => x.reads[k] !== undefined)), 'every GOLD PINE record carries all twelve free-feed keys (' + recsP.length + ' records)');
}

/* ------------------------------------------------------------------ 6 */
console.log('== 6) the catalog census reads the three legs ==');
{
  const W = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js']);
  const rows = tapeEnding(WED, 300, 900, 102, 24, 0);
  const f = W.hgGoldCatalogFeed(rows, { ctx: { macro: MACRO_ALL, now: WED } });
  const byId = id => (f.used.find(r => r.id === id) || f.unchecked.find(r => r.id === id) || {});
  const usedIds = new Set(f.used.map(r => r.id));
  assert([83, 84, 87, 150, 151].every(id => usedIds.has(id)), 'GVZ, the GVZ expected move, the GVZ/VIX ratio, the gold–SPX and gold–BTC correlations read USED');
  assert(/GVZ 18\.40 · 20d rising/.test(byId(83).note) && /1σ one-day move 1\.16% from GVZ 18\.40/.test(byId(84).note) && /GVZ\/VIX 1\.21/.test(byId(87).note) && /\+0\.45/.test(byId(150).note) && /-0\.52/.test(byId(151).note), 'each note names its value');
  const f0 = W.hgGoldCatalogFeed(rows, { ctx: { macro: Object.assign({}, MACRO_ALL, { gvzTrend: null, gvzLast: null, vixLast: null, goldSpxCorr20: null, goldBtcCorr20: null }), now: WED } });
  const u0 = new Set(f0.used.map(r => r.id));
  assert(![83, 84, 87, 150, 151].some(id => u0.has(id)) && /unread this snapshot/.test((f0.unchecked.find(r => r.id === 83) || {}).note || ''), 'a snapshot without the legs reads them UNCHECKED and says unread, never "no tape"');
}

/* ------------------------------------------------------------------ 7 */
console.log('== 7) fail-open, the cap, no gate, stamps ==');
{
  const W = boot(['hg-forward.js', 'goldind.js', 'gold-catalog.js', 'indicators.js', 'indicators2.js']);
  const reads = {}; for (const k of W.HG_GOLD_FREE_KEYS) reads[k] = true; for (const k of W.hgGoldIndicatorKeys()) reads[k] = false;
  reads['free:structure4h'] = true; reads['free:leverageExtended'] = false;
  assert(Object.keys(reads).length === 32, 'twelve free-feed legs + the two PERFECT legs + eighteen indicator reads = 32 keys');
  const why = W.hgFwdRecord({ tab: 'CAPTEST', mechanic: 'x', sym: 'XAUUSD', tf: '15m', dir: 'long', entry: 2300, stop: 2290, t1: 2320, barT: Math.floor(WED / 1000), reads });
  const rec = (W.hgFwdRecords('CAPTEST') || [])[0];
  assert(why === 'recorded' && rec && Object.keys(rec.reads).length === 32, 'the ledger keeps every one of the 32 — exactly at its cap; the next mark moves the cap first (' + (rec ? Object.keys(rec.reads).length : 0) + ' kept)');
  for (const g of ['hg-gates.js', 'cryptogates.js', 'gold-formation.js', 'hg-solidity.js', 'conviction-lock.js', 'hg-forward.js', 'gold-best-levels.js', 'omnigold.js', 'ganeshgold.js', 'goldscalp.js', 'goldpine.js'])
    assert(!/free:(cotAgainst|gvzRising|spxCorrPositive|btcCorrPositive)/.test(strip(read(g))), g + ' names none of the four new marks (nothing gates on them)');
  const gi = strip(read('goldind.js'));
  assert(!/fv\['free:(gvzRising|spxCorrPositive|btcCorrPositive)'\]/.test(gi), 'the ranker never reads one of the three state verdicts back (no fv[...] of them anywhere in goldind.js): they are marked, not scored');
  assert(read('build-stamp.js').indexOf("version: '" + HG_VER + "'") > 0, 'build-stamp.js is ' + HG_VER);
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
