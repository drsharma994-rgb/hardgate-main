#!/usr/bin/env node
/* hg-v1162 — GOLD PINE and 80PERCENT read the gold indicator stack and the
   eight free internet feeds AS MARKS, through one home each, on every record
   they write; GOLD PINE's native lanes are fed what the ranker scores by.

   The eight free-feed verdicts (real-rate tilt · PAXG basis · PAXG funding ·
   Fear & Greed · silver · gold/silver ratio · VIX · USDJPY) were decided
   inside goldRankSetups' closure and nowhere else, so a desk whose rows never
   pass through the ranker (the ten Pine ports on GOLD PINE; every literal-
   spec signal on 80PERCENT) could not mark them without a second copy of
   each rule. hgGoldFreeFeedVerdicts (goldind.js) is the one home now; the
   ranker DERIVES its points from it (zero tally drift, §2), and the two desks
   read it (§3, §4). The indicator stack already had one home (gold-catalog.js,
   hg-v1158); both desks read that too. Nothing is gated on any mark.

   Sections:
     1  the home: three states per leg, both directions, junk is absent
     2  the ranker derives its tally from the home — marks equal the home's
        verdicts, points equal the documented rule, on a grid
     3  GOLD PINE end to end: feeds fetched once, every row marked, the record
        carries reads + funding, the cards print both lines, one census; the
        native lane is fed (the real ranker ranks a stubbed mint's candidate
        with the feeds); Pine rows identical with and without feeds
     4  80PERCENT end to end: feeds read once per run, live signals marked,
        the direct-door record carries reads + funding + the G4 verdict, both
        card renderers print the lines, the read split renders once settled,
        one census on the full view; the signal set is byte-identical with
        and without the feeds (the spec is untouched)
     5  fail-open: no home / no catalog -> no marks, every record still written
     6  the marks gate nothing: no gate file names them; stamps */
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
/* an element whose querySelector memoises by selector, so a tab's `out` and
   `stat` handles are the same objects the guard reads back */
function mkEl(){
  const kids = {}, ctl = {};
  const e = { style: {}, innerHTML: '', textContent: '', disabled: false, className: '', dataset: {}, attrs: {}, listeners: {},
    appendChild(){}, setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return this.attrs[k]; },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }, removeEventListener(){},
    click(){ (this.listeners.click || []).forEach(f => f()); },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    querySelector(sel){ return kids[sel] || (kids[sel] = mkEl()); },
    /* `[data-x]` returns one stub per distinct value found in this element's
       own markup, cached by value so a listener wired on one render survives
       to the click (a control re-rendered is re-wired by the tab anyway) */
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
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, setImmediate,
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
const RANK_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js',
                   'goldind.js', 'gold-catalog.js', 'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'hg-setup-core.js'];
/* setup-ui.js rides so the shared panel (hgSetupPanelHTML) the forming /
   context rows render through is the REAL one, not the fallback branch */
const PINE_BASE = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                   'goldind.js', 'gold-catalog.js', 'gold-best-levels.js', 'pinemath.js', 'pinegoldmath.js', 'goldpine.js', 'accuracy-floor.js'];
const P80_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js', 'hg-setup-core.js',
                  'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'omnigold.js', 'goldind.js', 'gold-catalog.js', 'eightypercent.js'];
const FREE8 = ['free:macroTilt', 'free:paxgBasis', 'free:perpFunding', 'free:fearGreed', 'free:silver', 'free:gsRatio', 'free:vix', 'free:usdjpy'];
const MACRO_ALL = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                    realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo' };
const FEEDS_ALL = { macro: MACRO_ALL, fng: { v: 20 }, fundingRate: -0.05, spot: { verdict: 'shorts-crowding', basisPct: -0.2 } };
/* the documented points of each leg (goldind.js goldRankSetups), WITH / AGAINST */
const PTS = { 'free:macroTilt': [2, -2], 'free:paxgBasis': [1, -1], 'free:perpFunding': [1, -1], 'free:fearGreed': [1, 0],
              'free:silver': [1, -1], 'free:gsRatio': [1, -1], 'free:vix': [1, -1], 'free:usdjpy': [1, -1] };
const legPts = fv => FREE8.reduce((a, k) => a + (fv[k] === true ? PTS[k][0] : (fv[k] === false ? PTS[k][1] : 0)), 0);

/* ------------------------------------------------------------------ 1 */
console.log('== 1) the home: three states per leg, both directions ==');
{
  const W = boot(RANK_BASE);
  assert(typeof W.hgGoldFreeFeedVerdicts === 'function' && typeof W.hgGoldFreeFeedFunding === 'function'
      && typeof W.hgGoldFreeFeedLineHtml === 'function' && Array.isArray(W.HG_GOLD_FREE_KEYS), 'the home, the funding reader, the line renderer and the key list are exported');
  assert(W.HG_GOLD_FREE_KEYS.slice(0, 8).join(',') === FREE8.join(',') && W.HG_GOLD_FREE_KEYS.length === 26, 'the key list names the eight free-feed legs first, then the four hg-v1163 reads, the four hg-v1165 legs, the four hg-v1166 legs, the three hg-v1167 legs and the three hg-v1171 legs (26 keys)');
  const L = W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'long'), S = W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'short');
  assert(FREE8.every(k => L[k] === true), 'every leg aligned with a long reads WITH (' + JSON.stringify(L) + ')');
  assert(FREE8.every(k => S[k] === false), 'the same feeds read AGAINST a short on every leg (' + JSON.stringify(S) + ')');
  assert(Object.keys(L).length === 8 && Object.keys(S).length === 8, 'exactly eight keys, no stowaway');
  const mirror = W.hgGoldFreeFeedVerdicts({ macro: { silverTrend: 'FALLING', gsRatioTrend: 'RISING', vixTrend: 'FALLING', usdjpyTrend: 'RISING', realRateHint: 'HEADWIND' },
                                            fng: { v: 80 }, fundingRate: 0.05, spot: { verdict: 'longs-crowding' } }, 'short');
  assert(FREE8.every(k => mirror[k] === true), 'the mirrored feeds read WITH a short on every leg');
  const flat = W.hgGoldFreeFeedVerdicts({ macro: { silverTrend: 'FLAT', gsRatioTrend: 'FLAT', vixTrend: 'FLAT', usdjpyTrend: 'FLAT', realRateHint: null },
                                          fng: { v: 50 }, fundingRate: 0.0, spot: { verdict: 'neutral' } }, 'long');
  assert(Object.keys(flat).join(',') === 'free:fearGreed' && flat['free:fearGreed'] === false,
    'FLAT trends, no tilt, a funding print inside the band and a neutral basis mark NOTHING; a readable non-extreme Fear & Greed is a READ false (' + JSON.stringify(flat) + ')');
  const junk = W.hgGoldFreeFeedVerdicts({ macro: { silverTrend: 'UP', gsRatioTrend: 'down', vixTrend: '', usdjpyTrend: 1 }, fng: { v: 'x' }, fundingRate: 'x', spot: { verdict: 'LONGS' } }, 'long');
  assert(Object.keys(junk).length === 0, 'a trend string that is neither RISING nor FALLING, a string Fear & Greed, a string funding and an unknown basis verdict are all UNREAD (absent), never false');
  assert(Object.keys(W.hgGoldFreeFeedVerdicts(null, 'long')).length === 0 && Object.keys(W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'both')).length === 0
      && Object.keys(W.hgGoldFreeFeedVerdicts(FEEDS_ALL, null)).length === 0, 'no context or no direction is no verdict');
  assert(Object.keys(W.hgGoldFreeFeedVerdicts({ fng: { v: 20 } }, 'short')).join(',') === 'free:fearGreed'
      && W.hgGoldFreeFeedVerdicts({ fng: { v: 20 } }, 'short')['free:fearGreed'] === false, 'extreme fear reads AGAINST a short (the leg favours longs)');
  /* the funding band is evaluateFundingRate's own: inside ±0.03%/interval nothing */
  assert(W.hgGoldFreeFeedVerdicts({ fundingRate: 0.02 }, 'long')['free:perpFunding'] === undefined
      && W.hgGoldFreeFeedVerdicts({ fundingRate: 0.05 }, 'long')['free:perpFunding'] === false
      && W.hgGoldFreeFeedVerdicts({ fundingRate: -0.05 }, 'long')['free:perpFunding'] === true
      && W.hgGoldFreeFeedVerdicts({ fundingRate: 0.0005 }, 'long')['free:perpFunding'] === false,
    'funding reads through the ranker\'s own band (±0.03%/interval): +0.05 against a long, −0.05 with it, +0.02 nothing, a raw decimal 0.0005 is scaled to 0.05% and reads against');
  assert(W.hgGoldFreeFeedFunding({ fundingRate: 0.0005 }) === 0.05 && W.hgGoldFreeFeedFunding({ fundingRate: -0.05 }) === -0.05
      && Number.isNaN(W.hgGoldFreeFeedFunding({ fundingRate: null })) && Number.isNaN(W.hgGoldFreeFeedFunding(null)) && Number.isNaN(W.hgGoldFreeFeedFunding({ fundingRate: 'x' })),
    'the funding reader normalises exactly as the ranker does and reads NaN for null, no context or a string (+null is never 0 here)');
  const line = W.hgGoldFreeFeedLineHtml(L, { fundingPct: -0.05 });
  assert(/data-hg-free-feeds="1"/.test(line) && /8 of 26 free internet feeds read/.test(line) && (line.match(/ WITH</g) || []).length === 8 && /funding -0\.0500%/.test(line),
    'the line renderer prints every leg WITH and the funding print (26 since hg-v1171)');
  const lineS = W.hgGoldFreeFeedLineHtml({ 'free:vix': false });
  assert(/1 of 26/.test(lineS) && (lineS.match(/UNREAD</g) || []).length === 25 && /AGAINST</.test(lineS) && !/funding/.test(lineS),
    'one mark prints one AGAINST and twenty-five UNREAD, and no funding line without a print');
  assert(W.hgGoldFreeFeedLineHtml(null) !== '' && /0 of 26/.test(W.hgGoldFreeFeedLineHtml(null)), 'no marks still renders an honest 0 of 26 (the caller decides whether to print it)');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the ranker derives its tally from the home: marks == verdicts, points == the rule, on a grid ==');
{
  const W = boot(RANK_BASE);
  const trends = ['RISING', 'FALLING', 'FLAT', null, 'UP'];
  const hints = ['TAILWIND', 'HEADWIND', null, 'X'];
  const verdicts = ['longs-crowding', 'shorts-crowding', 'neutral', null];
  const funds = [-0.05, 0.05, 0.01, 0, null, 0.0004, 'x'];
  const fngs = [{ v: 20 }, { v: 50 }, { v: 80 }, { v: 'x' }, null];
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback', entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  const ctxOf = over => Object.assign({ scanner: 'GOLDSCALP', now: Date.now(), news: { caution: false }, rows15m: [], rows4h: [], rows1h: [] }, over || {});
  const base = { long: W.goldRankSetups([cand('long')], ctxOf()).ranked[0].tally, short: W.goldRankSetups([cand('short')], ctxOf()).ranked[0].tally };
  let n = 0, markBad = 0, ptsBad = 0, sumBad = 0, fundBad = 0, withFeeds = 0;
  for (let i = 0; i < 600; i++){
    const macro = (rnd() < 0.1) ? null : { silverTrend: pick(trends), gsRatioTrend: pick(trends), vixTrend: pick(trends), usdjpyTrend: pick(trends), realRateHint: pick(hints), dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo' };
    const feeds = { macro, fng: pick(fngs), fundingRate: pick(funds), spot: { verdict: pick(verdicts), basisPct: -0.2 } };
    for (const dir of ['long', 'short']){
      const r = W.goldRankSetups([cand(dir)], ctxOf(feeds)).ranked[0];
      const fv = W.hgGoldFreeFeedVerdicts(feeds, dir);
      n++;
      const got = {}; for (const k of FREE8) if (r.freeReads && r.freeReads[k] !== undefined) got[k] = r.freeReads[k];
      if (JSON.stringify(got) !== JSON.stringify(fv)) markBad++;
      if (r.tally !== base[dir] + legPts(fv)) ptsBad++;
      if (r.tally !== r.tallyParts.reduce((a, p) => a + (+p.pts || 0), 0)) sumBad++;
      const fp = W.hgGoldFreeFeedFunding(feeds);
      if ((isFinite(fp) ? fp : undefined) !== r.fundingPct) fundBad++;
      if (Object.keys(fv).length) withFeeds++;
    }
  }
  assert(withFeeds > 900, 'REACHABILITY: the grid fed the ranker a live leg on ' + withFeeds + ' of ' + n + ' cases');
  assert(markBad === 0, 'the ranked row\'s free-feed marks EQUAL the home\'s verdicts on all ' + n + ' cases (' + markBad + ' differ)');
  assert(ptsBad === 0, 'the tally moves by exactly the documented points of the legs the home read (±2 tilt · ±1 basis · ±1 funding · +1 Fear & Greed WITH only · ±1 per trend) on all ' + n + ' cases (' + ptsBad + ' differ)');
  assert(sumBad === 0, 'the tally is still exactly the sum of its parts on every case');
  assert(fundBad === 0, 'rc.fundingPct is the home\'s normalised funding read on every case');
  /* the leg labels still name the feed the home read */
  const r = W.goldRankSetups([cand('long')], ctxOf(FEEDS_ALL)).ranked[0];
  const labels = r.tallyParts.map(p => p.label).join(' | ');
  assert(/silver rising — Yahoo SI=F/.test(labels) && /gold\/silver ratio falling/.test(labels) && /VIX rising/.test(labels) && /USDJPY falling/.test(labels)
      && /extreme fear/.test(labels) && /funding tailwind/.test(labels) && /shorts crowding/.test(labels) && /favors longs/.test(labels),
    'every leg still prints its own label on the tally (' + labels.slice(0, 160) + '…)');
  assert(/var fv = hgGoldFreeFeedVerdicts\(ctx, c\.dir\)/.test(strip(read('goldind.js'))), 'TEXTUAL, and says so: the ranker reads the home by one call per candidate');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) GOLD PINE end to end ==');
async function pineRun(opts){
  opts = opts || {};
  const clock = { now: WED + 16 * 60 * 1000 };
  const tapes = { '15m': tapeEnding(WED, 300, 900, 102, 24, 0), '1h': tapeEnding(WED, 240, 3600, 103, 30, 0),
                  '4h': tapeEnding(WED, 300, 14400, 104, 40, 6), '1d': tapeEnding(WED, 280, 86400, 105, 60, 20) };
  const calls = { funding: 0, macro: 0 };
  const extra = {
    getGoldCandles: async tf => ({ rows: tapes[tf] || [], source: 'binance-xau' }),
    hgGoldLiveFeed: async () => ({ perp: null, quote: null, l2: null, macro: null })
  };
  /* the macro snapshot and the spot read were this desk's own inputs before
     this pack (the Pine universe scores by them); the feeds THIS pack adds
     are Fear & Greed and the PAXG funding print, so `noFeeds` withholds
     exactly those two */
  extra.getGoldMacro = async () => { calls.macro++; return MACRO_ALL; };
  extra.goldspotState = () => ({ verdict: 'shorts-crowding', basisPct: -0.2 });
  if (!opts.noFeeds){
    extra.S = { fng: { v: 20 } };
    extra.binanceFunding = async () => { calls.funding++; return { fundingPct: -0.05 }; };
  }
  const files = PINE_BASE.filter(f => !(opts.drop || []).includes(f));
  const W = boot(files, clock, extra);
  if (opts.stubMint){
    /* a stubbed scalp mint hands the REAL ranker one candidate, so the lane's
       feeding is observable whatever the synthetic tape forms */
    W.goldScalpSetups = () => { const a = [{ sym: 'XAUUSD', dir: 'long', stratKey: 'liqsweep', strategy: 'LIQ SWEEP', entry: 2300, stop: 2290, t1: 2320, t2: 2340, rr: 2, agree: 5, killzoneWeight: 0, atr: 4 }]; a.rejected = []; return a; };
  }
  if (opts.before) opts.before(W);
  const tab = W.HG_tabs.find(t => t && t.id === 'goldpine');
  const el = mkEl();
  tab.mount(el);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000){
    await settle(2);
    const st = el.querySelector('#goldPineStat').textContent;
    if (/^done|^error|^failed/.test(st)) break;
  }
  return { W, el, calls, tapes, snap: W.goldPineScan(), stat: el.querySelector('#goldPineStat').textContent, html: el.querySelector('#goldPineOut').innerHTML };
}
{
  const r = await pineRun({ stubMint: true });
  assert(/^done/.test(r.stat), 'REACHABILITY: the real tab mounted, scanned and painted (' + r.stat + ')');
  assert(r.calls.funding === 1, 'the funding print is fetched ONCE per scan (' + r.calls.funding + '; the macro snapshot is the desk\'s own pre-existing read, ' + r.calls.macro + ')');
  const all = r.snap.swing.concat(r.snap.scalp);
  assert(all.length >= 2, 'REACHABILITY: the board formed rows (' + r.snap.swing.length + ' swing · ' + r.snap.scalp.length + ' scalp)');
  const pine = all.filter(s => s.kind !== 'native'), native = all.filter(s => s.kind === 'native');
  assert(pine.length >= 1 && native.length >= 1, 'REACHABILITY: both a Pine row and a native row are on the board (' + pine.length + ' / ' + native.length + ')');
  const expectOf = s => { const fv = r.W.hgGoldFreeFeedVerdicts(FEEDS_ALL, s.dir); return FREE8.map(k => fv[k]); };
  assert(all.every(s => s.freeReads && typeof s.freeReads === 'object'), 'EVERY row carries freeReads');
  assert(all.every(s => JSON.stringify(FREE8.map(k => s.freeReads[k])) === JSON.stringify(expectOf(s))),
    'and the eight free-feed marks on every row — Pine and native alike — are the home\'s verdicts for the row\'s own direction');
  assert(all.every(s => s.indReads && s.indReads.ok === true && Object.keys(s.freeReads).some(k => /^ind:/.test(k))), 'every row carries the indicator stack and its ind: marks');
  const sw = r.snap.swing[0], sc = r.snap.scalp[0];
  assert(sw.indReads !== sc.indReads && sw.indReads.close === r.tapes['4h'][r.tapes['4h'].length - 1].c && sc.indReads.close === r.tapes['15m'][r.tapes['15m'].length - 1].c,
    'the swing lane\'s stack is read off the 4h tape and the scalp lane\'s off the 15m tape (last close ' + sw.indReads.close.toFixed(2) + ' / ' + sc.indReads.close.toFixed(2) + ')');
  assert(all.every(s => s.fundingPct === -0.05), 'every row carries the PAXG funding print the desk read (−0.05)');
  /* the native lane is FED: the real ranker ranked the stubbed candidate with the feeds */
  const nat = native.find(s => s.nativeStrategy === 'LIQ SWEEP');
  assert(!!nat, 'REACHABILITY: the stubbed native candidate reached the board');
  const fvL = r.W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'long');
  const fvL0 = r.W.hgGoldFreeFeedVerdicts({ macro: MACRO_ALL, spot: FEEDS_ALL.spot }, 'long');
  const legDelta = legPts(fvL) - legPts(fvL0);
  assert(legDelta === 2, 'REACHABILITY: the two feeds this pack adds are worth +' + legDelta + ' to a long on this fixture (Fear & Greed 20, funding −0.05)');
  /* the records */
  const recs = r.W.hgFwdRecords('GOLDPINE:scalp').concat(r.W.hgFwdRecords('GOLDPINE:swing'));
  assert(recs.length >= 2, 'REACHABILITY: ' + recs.length + ' records written');
  assert(recs.every(x => x.reads && typeof x.reads === 'object' && FREE8.every(k => x.reads[k] === (x.dir === 'long' ? fvL[k] : !fvL[k]))),
    'every record carries the eight free-feed marks under reads, WITH on longs and AGAINST on shorts');
  assert(recs.every(x => Object.keys(x.reads).some(k => /^ind:/.test(k))), 'and the ind: marks beside them');
  assert(recs.every(x => x.fundingPct === -0.05 && (x.fundAgainst === (x.dir === 'short'))),
    'every record carries fundingPct −0.05 and the ledger derived the G4 verdict from it (against a short, not a long)');
  const tfOf = x => x.tf;
  assert(recs.every(x => (tfOf(x) === '15m' || tfOf(x) === '4h') && x.feed === 'binance-xau' && x.barT > 0), 'the records are still dated on their lane\'s bar and name their feed (hg-v978 / v979 untouched)');
  /* the cards */
  const painted = r.snap.swingTop.length + r.snap.scalpTop.length;
  /* hg-v1164: a record-only row that did not make the two-card cut paints in
     a section of its own, with the same two lines; hg-v1167's layers fire on
     this tape, so those cards are counted beside the top cards */
  const keyOf = s => [s.mode, s.layerLabel || s.strategy || '', s.dir, s.entry].join('|');
  const topKeys = new Set(r.snap.swingTop.concat(r.snap.scalpTop).map(keyOf));
  const recExtra = r.snap.swing.concat(r.snap.scalp).filter(s => s.recordOnly && !topKeys.has(keyOf(s))).length;
  assert(painted >= 3 && (r.html.match(/data-hg-free-feeds="1"/g) || []).length === painted + recExtra && (r.html.match(/data-hg-ind-stack="1"/g) || []).length === painted + recExtra,
    'EVERY painted card prints the FREE FEEDS line and the INDICATOR STACK line (' + painted + ' top cards + ' + recExtra + ' record-only cards; the shared panel rows included)');
  assert(typeof r.W.hgSetupPanelHTML === 'function' && /hg-tier-chip/.test(r.html), 'REACHABILITY: the shared panel is the real one and at least one painted card went through it');
  assert((r.html.match(/data-hg-gold-catalog="1"/g) || []).length === 1, 'exactly ONE catalog census on the board');
  assert(/COT|USED/.test(r.html), 'the census says what was read');
  /* parity: Pine rows identical with and without the feeds */
  const r0 = await pineRun({ stubMint: true, noFeeds: true });
  const key = s => [s.kind, s.layerLabel || s.nativeStrategy, s.mode, s.dir, s.entry, s.stop, s.t1, s.score, s.tier].join('|');
  const pine0 = r0.snap.swing.concat(r0.snap.scalp).filter(s => s.kind !== 'native').map(key).sort().join('\n');
  const pine1 = pine.map(key).sort().join('\n');
  assert(pine0 === pine1, 'the Pine rows are IDENTICAL with and without the feeds — score, tier, levels (nothing is gated on a mark)');
  const nat0 = r0.snap.scalp.find(s => s.nativeStrategy === 'LIQ SWEEP');
  assert(nat0 && nat.score - nat0.score === legDelta && nat0.entry === nat.entry && nat0.stop === nat.stop && nat0.t1 === nat.t1,
    'the native scalp lane is FED what the ranker scores by: its tally moves by exactly the +' + legDelta + ' the two new feeds are worth (' + nat0.score + ' -> ' + nat.score + '), levels unchanged — parity with GOLD SCALP, not a new rule');
  const all0 = r0.snap.swing.concat(r0.snap.scalp);
  assert(all0.every(s => s.freeReads && s.freeReads['free:fearGreed'] === undefined && s.freeReads['free:perpFunding'] === undefined && s.freeReads['free:silver'] === (s.dir === 'long'))
      && all0.every(s => s.indReads && s.indReads.ok), 'with the two feeds withheld their marks are ABSENT on every row, the macro legs and the ind: marks still ride (three states)');
  const recs0 = r0.W.hgFwdRecords('GOLDPINE:scalp').concat(r0.W.hgFwdRecords('GOLDPINE:swing'));
  assert(recs0.length >= 2 && recs0.every(x => x.fundingPct === undefined && x.fundAgainst === undefined && x.reads['free:fearGreed'] === undefined), 'with no funding read the records carry NOT RECORDED, never a zero');
  /* the ranker's own marks win over the desk seam: a row the ranker marked keeps them */
  assert(/if \(s\.freeReads && typeof s\.freeReads === 'object'\) continue;/.test(strip(read('goldpine.js'))), 'TEXTUAL, and says so: the desk seam fills only rows the ranker did not mark');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) 80PERCENT end to end ==');
function series(n, o){
  o = o || {};
  const tfSec = o.tfSec == null ? 300 : o.tfSec;
  const endT = Date.UTC(2026, 8, 16, 15, 0, 0) / 1000;
  const base = endT - (n - 1) * tfSec;
  const rows = []; let px = 4000; const up = o.down ? -1 : 1;
  for (let i = 0; i < n; i++){
    const t = base + i * tfSec, oo = px; let c;
    if (i < n - 8) c = px + 1.2 * up; else if (i < n - 1) c = px - 2.6 * up; else c = px + 1.4 * up;
    rows.push({ t, o: oo, h: Math.max(oo, c) + 0.4, l: Math.min(oo, c) - 0.4, c, v: 100 });
    px = c;
  }
  return rows;
}
async function p80Run(opts){
  opts = opts || {};
  const calls = { funding: 0, macro: 0 };
  const extra = {};
  if (!opts.noFeeds){
    extra.S = { fng: { v: 20 } };
    extra.binanceFunding = async () => { calls.funding++; return { fundingPct: -0.05 }; };
    extra.getGoldMacro = async () => { calls.macro++; return MACRO_ALL; };
    extra.goldspotState = () => ({ verdict: 'shorts-crowding', basisPct: -0.2 });
  }
  const files = P80_BASE.filter(f => !(opts.drop || []).includes(f));
  const W = boot(files, null, extra);
  const secOf = Object.fromEntries(W.HG_P80_LADDER.map(r => [r.tf, r.sec]));
  W.hgOgFetchRows = (tf, n) => Promise.resolve({ rows: series(Math.max(n, 320), { tfSec: secOf[tf], down: !!opts.down }), source: 'fixture', feed: 'binance-paxg' });
  W.hgGoldLiveSpot = async () => NaN;
  if (opts.before) opts.before(W);
  const tab = W.HG_tabs.find(t => t && t.id === '80percent');
  const el = mkEl();
  const body = el.querySelector('#p80Body'), stat = el.querySelector('#p80Stat');
  tab.mount(el);   /* the mount kicks run() */
  const t0 = Date.now();
  while (Date.now() - t0 < 20000){
    await settle(2);
    if (/^updated|^error|^no fetcher/.test(stat.textContent)) break;
  }
  /* the control is a no-op on the view already shown, so a re-render of
     FULL is driven as SIMPLE then FULL */
  const full = () => {
    const btn = v => body.querySelectorAll('[data-p80-view]').find(x => x.getAttribute('data-p80-view') === v);
    const bs = btn('simple'); if (bs) bs.click();
    const bf = btn('full'); if (bf) bf.click();
    return String(body.innerHTML);
  };
  return { W, el, body, calls, res: stat.textContent, full };
}
{
  const r = await p80Run();
  assert(/^updated/.test(r.res), 'REACHABILITY: the tab mounted and ran (' + r.res + ')');
  assert(r.calls.funding === 1 && r.calls.macro === 1, 'the free feeds are read ONCE per run (funding ' + r.calls.funding + ', macro ' + r.calls.macro + ')');
  const recs = r.W.hgFwdRecords(r.W.HG_P80_TAB) || [];
  assert(recs.length >= 1, 'REACHABILITY: ' + recs.length + ' rung' + (recs.length === 1 ? '' : 's') + ' fired on the last closed bar and recorded');
  const fvL = r.W.hgGoldFreeFeedVerdicts(FEEDS_ALL, 'long');
  assert(recs.every(x => x.reads && FREE8.every(k => x.reads[k] === (x.dir === 'long' ? fvL[k] : !fvL[k]))), 'every record carries the eight free-feed marks for its own direction');
  assert(recs.every(x => Object.keys(x.reads).filter(k => /^ind:/.test(k)).length >= 10), 'and at least ten ind: marks beside them (the stack off the rung\'s own closed tape)');
  assert(recs.some(x => x.reads['ind:hurstTrending'] !== undefined || x.reads['ind:acMomentum'] !== undefined), 'the daily rung\'s bars are the daily leg of every rung\'s stack: a Hurst or ACF mark rides');
  assert(recs.every(x => x.fundingPct === -0.05 && x.fundAgainst === (x.dir === 'short')), 'every record carries fundingPct −0.05 and the G4 verdict derived through the one rule at the direct door (hgFundingAgainstMark)');
  assert(recs.every(x => x.ticket === false && x.gateClear === false && x.feed === 'binance-paxg' && x.barT > 0), 'ticket false, gateClear false, the feed and the bar: the record is otherwise what it always was');
  const html = String(r.body.innerHTML);
  assert(html.length > 2000, 'REACHABILITY: the SIMPLE view painted (' + html.length + ' chars)');
  assert((html.match(/data-hg-free-feeds="1"/g) || []).length >= 1 && (html.match(/data-hg-ind-stack="1"/g) || []).length >= 1, 'the SIMPLE card prints the FREE FEEDS line and the INDICATOR STACK line');
  assert(!/data-hg-gold-catalog/.test(html), 'the SIMPLE view carries no census (it lives on FULL)');
  /* FULL view, through the real control: the full card, no split lead yet, one census */
  assert(/data-p80-view="full"/.test(html), 'REACHABILITY: the FULL control is on the page');
  const fullHtml = r.full();
  assert(fullHtml !== html && /THE LADDER RIGHT NOW/.test(fullHtml), 'REACHABILITY: the FULL view painted through the control');
  assert((fullHtml.match(/data-hg-gold-catalog="1"/g) || []).length === 1, 'exactly ONE catalog census on the FULL view');
  assert((fullHtml.match(/data-hg-free-feeds="1"/g) || []).length >= 1 && (fullHtml.match(/data-hg-ind-stack="1"/g) || []).length >= 1, 'the FULL card prints both read lines');
  assert(!/FREE-FEED LEGS/.test(fullHtml), 'the forward panel prints no split lead while nothing has settled');
  /* the read split: silent until a settled record carries a mark */
  const splitBefore = r.W.hgFwdReadSplitHtml(r.W.HG_P80_TAB) || '';
  assert(splitBefore === '', 'the read split renders NOTHING while no record has settled (an empty split is not a clean bill)');
  const rec0 = recs[0];
  const tfSec = secOf80(r.W, rec0.tf);
  const after = []; let px = rec0.entry;
  for (let i = 1; i <= 6; i++){ const t = rec0.barT + i * tfSec; const c = (rec0.dir === 'long') ? rec0.t1 + 1 : rec0.t1 - 1; after.push({ t, o: px, h: Math.max(px, c) + 0.5, l: Math.min(px, c) - 0.5, c, v: 1 }); px = c; }
  r.W.hgFwdResolve('XAUUSD', rec0.tf, after, 'binance-paxg');
  const split = r.W.hgFwdReadSplit(r.W.HG_P80_TAB);
  assert(split.settled >= 1 && split.marked >= 1 && split.reads['free:silver'] && split.reads['ind:adxTrending'] !== undefined,
    'settled on the next bars, the read split counts the record and has a cell per free-feed leg and per indicator read (' + split.settled + ' settled, ' + split.marked + ' marked)');
  const splitHtml = r.W.hgFwdReadSplitHtml(r.W.HG_P80_TAB) || '';
  assert(splitHtml.length > 0, 'and the split renders once a marked record settled');
  const fullAfter = r.full();
  assert(/FREE-FEED LEGS/.test(fullAfter) && /free:silver/.test(fullAfter), 'and the forward panel on FULL carries the split lead and the legs once a marked record settled');
  /* the spec is untouched: the signal set is byte-identical with and without the feeds */
  const r0 = await p80Run({ noFeeds: true });
  const sigs = W2 => (W2.hgFwdRecords(W2.HG_P80_TAB) || []).map(x => [x.tf, x.dir, x.entry, x.stop, x.t1, x.barT, x.mechanic].join('|')).sort().join('\n');
  assert(sigs(r0.W) === sigs(r.W), 'the signals this desk fires and records are BYTE-IDENTICAL with and without the feeds (tf · dir · entry · stop · t1 · bar · mechanic): the literal spec is untouched');
  const recs0 = r0.W.hgFwdRecords(r0.W.HG_P80_TAB) || [];
  assert(recs0.every(x => (!x.reads || !FREE8.some(k => x.reads[k] !== undefined)) && x.fundingPct === undefined && x.fundAgainst === undefined)
      && recs0.every(x => x.reads && Object.keys(x.reads).some(k => /^ind:/.test(k))),
    'with no feeds the records carry no free: mark and no funding (NOT RECORDED), and the ind: marks still ride');
  /* and the down tape: shorts read AGAINST the long-favouring feeds */
  const rd = await p80Run({ down: true });
  const recsD = rd.W.hgFwdRecords(rd.W.HG_P80_TAB) || [];
  assert(recsD.length >= 1 && recsD.every(x => x.dir === 'short'), 'REACHABILITY: the mirrored tape fires shorts (' + recsD.length + ')');
  assert(recsD.every(x => FREE8.every(k => x.reads[k] === false) && x.fundAgainst === true), 'every short reads AGAINST on all eight legs and the −0.05 funding is AGAINST a short (shorts pay it)');
}
function secOf80(W, tf){ const d = W.HG_P80_LADDER.find(r => r.tf === tf); return d ? d.sec : 300; }

/* ------------------------------------------------------------------ 5 */
console.log('== 5) fail-open ==');
{
  const r = await pineRun({ stubMint: true, drop: ['gold-catalog.js'] });
  const all = r.snap.swing.concat(r.snap.scalp);
  assert(/^done/.test(r.stat) && all.length >= 2, 'REACHABILITY: GOLD PINE scans without the catalog');
  assert(all.every(s => !s.indReads && s.freeReads && !Object.keys(s.freeReads).some(k => /^ind:/.test(k)) && FREE8.every(k => s.freeReads[k] !== undefined)),
    'without the catalog no ind: mark is made and the free-feed marks still ride');
  assert(!/data-hg-ind-stack/.test(r.html) && /data-hg-free-feeds/.test(r.html) && !/data-hg-gold-catalog/.test(r.html), 'the cards print the free-feed line alone and no census');
  const recs = r.W.hgFwdRecords('GOLDPINE:scalp').concat(r.W.hgFwdRecords('GOLDPINE:swing'));
  assert(recs.length >= 2 && recs.every(x => x.reads && !Object.keys(x.reads).some(k => /^ind:/.test(k))), 'the records are still written, with the free: marks and no ind: mark');
  /* the home absent: GOLD PINE's desk seam marks nothing, the record still writes */
  const r2 = await pineRun({ before: W => { W.hgGoldFreeFeedVerdicts = undefined; W.hgGoldFreeFeedFunding = undefined; } });
  const all2 = r2.snap.swing.concat(r2.snap.scalp).filter(s => s.kind !== 'native');
  assert(/^done/.test(r2.stat) && all2.length >= 1 && all2.every(s => !s.freeReads || !FREE8.some(k => s.freeReads[k] !== undefined)),
    'with the free-feed home absent the Pine rows carry no free: mark (ind: still rides) and the scan completes');
  const r3 = await p80Run({ drop: ['gold-catalog.js'], before: W => { W.hgGoldFreeFeedVerdicts = undefined; W.hgGoldFreeFeedFunding = undefined; } });
  const recs3 = r3.W.hgFwdRecords(r3.W.HG_P80_TAB) || [];
  assert(recs3.length >= 1 && recs3.every(x => x.reads === undefined && x.fundingPct === undefined && x.fundAgainst === undefined),
    '80PERCENT with neither home: the records are still written with no reads, no funding, no verdict');
  assert(!/data-hg-free-feeds|data-hg-ind-stack|data-hg-gold-catalog/.test(String(r3.body.innerHTML)), 'and the cards print neither line');
}

/* ------------------------------------------------------------------ 6 */
console.log('== 6) the marks gate nothing; stamps ==');
{
  for (const g of ['hg-gates.js', 'cryptogates.js', 'gold-formation.js', 'hg-solidity.js', 'conviction-lock.js', 'hg-forward.js', 'pinegoldmath.js', 'gold-best-levels.js'])
    assert(!/free:(silver|gsRatio|vix|usdjpy|fearGreed|perpFunding|paxgBasis|macroTilt)|hgGoldFreeFeedVerdicts/.test(strip(read(g))), g + ' names no free-feed mark and never asks the home');
  const gp = strip(read('goldpine.js')), p80 = strip(read('eightypercent.js'));
  assert(!/freeReads\[/.test(gp) && !/freeReads\[/.test(p80), 'neither desk indexes a mark (they carry and render the bag, never read a verdict out of it)');
  assert(/reads: \(s\.freeReads && typeof s\.freeReads === 'object'\) \? s\.freeReads : undefined,/.test(gp)
      && /reads: \(sig\.freeReads && typeof sig\.freeReads === 'object'\) \? sig\.freeReads : undefined,/.test(p80), 'both record writers hand the ledger the bag by property access');
  assert(/hg80MarkLive\(rungs, __p\.feeds\);/.test(p80) && /gpMarkReads\(swing, 'swing', bars, scanCtx\);/.test(gp) && /gpMarkReads\(scalp, 'scalp', bars, scanCtx\);/.test(gp),
    'the marking runs once per scan at the seam before the record (textual, and says so)');
  assert(read('build-stamp.js').indexOf("version: '" + HG_VER + "'") > 0, 'build-stamp.js is ' + HG_VER);
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
