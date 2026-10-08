/* HARDGATE — hg-v1158: GOLD SCALP marks the gold indicator stack, and the
   catalog census reads the scan instead of a hand-typed column.

   The gold Master Catalog (gold-catalog.js) decided USED / UNCHECKED from a
   hand-typed `wire` column plus eight computed ids, and the `opts` its feed
   accepted was discarded (`void opts`). So COT managed money, the news
   calendar, the FRED real-rate read, the session windows, silver and USDJPY
   all read UNCHECKED on a desk whose ranker scores by every one of them each
   scan — and the bar-computable rows the catalog itself calls CORE
   (Bollinger 20,2 · HV20 realized · raw volume/MA · hourly range p80) were
   computed nowhere. hgGoldIndicatorReads is the one home for the
   bar-computed stack (ADX, squeeze, Hurst and ACF are goldind's own
   functions CALLED); the census reads it and the scan context; the ranker
   stamps one three-state mark per read on the ranked row under `ind:` beside
   the hg-v1155 `free:` marks; GOLD SCALP records them, prints the stack on
   the card and hands the census the context. Marks only: tally, grade,
   every gate untouched. The ledger read cap is 16 -> 32 because the
   normaliser keeps SORTED keys and `ind:` sorts before `free:` — at 16 the
   free-feed marks would have left the record silently.

   Sections:
     1) the reads: every field on a full tape, the third state on thin or
        unreadable input, hours are complete UTC hours, the daily legs
     2) the marks: three states, direction mirror, every key fits the ledger
     3) the census: the context is read, the free feeds not fetched are named
     4) the ranker: marks ride the row, the tally and grade do not move,
        fail-open with the catalog absent
     5) end to end through the real GOLD SCALP tab: records carry the whole
        set under the widened cap, the card prints the stack, the census is
        on the board with the context, the split can ask
     6) one home: the ranker reads nothing back, no gate names a mark, the
        GOLD SWING gap is still a known one
     7) build stamps

   Run: node tests/test-goldscalp-indicator-stack.mjs */
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

const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
const SEC = WED / 1000;
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
const TAPES = () => ({ '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) });
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false, value: '', style: {}, firstElementChild: { style: {} }, _handlers: {},
    addEventListener(ev, fn){ this._handler = fn; this._handlers[ev] = fn; }, querySelector: () => stubEl(), querySelectorAll: () => [],
    classList: { add(){}, remove(){}, toggle(){} }, setAttribute(){}, appendChild(){} };
}
function pane(){
  const stubs = {};
  const p = { _html: '', set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
    querySelector(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }, querySelectorAll: () => [] };
  return { pane: p, stubs };
}
const CAT_FILES = ['indicators.js', 'indicators2.js', 'goldind.js', 'gold-catalog.js'];
const RANK_BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js', 'hg-forward.js', 'goldind.js',
                   'formation.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'hg-setup-core.js'];
const TAB_FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                   'goldind.js', 'gold-best-levels.js', 'conviction-lock.js', 'gold-catalog.js', 'goldscalp.js', 'accuracy-floor.js'];
function boot(files, opts){
  opts = opts || {};
  const clock = { now: opts.now || (WED + 16 * 60000) };
  const FakeDate = class extends Date { static now(){ return clock.now; } };
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, Date: FakeDate, Number, String, Object, Array, JSON, Error,
    TypeError, Promise, RegExp, Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval(){}, encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; }, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  const byId = {};
  ctx.document = { createElement: stubEl, getElementById: id => (byId[id] || (byId[id] = stubEl())), querySelector: () => stubEl(), querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false }, documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  if (opts.tapes){
    ctx.getXmGoldCandles = async tf => ({ rows: opts.tapes[tf] || [], source: 'xm-xauusd' });
    ctx.getGoldCandles = async () => ({ rows: [], source: null });
  }
  if (opts.extra) Object.assign(ctx, opts.extra);
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
  ctx.__store = store;
  return ctx;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function kicked(W){ for (let i = 0; i < 800; i++){ const s = W.goldscalpScan(); if (s) return s; await sleep(10); } return null; }
async function scanTab(extra, tapes){
  tapes = tapes || TAPES();
  const W = boot(TAB_FILES, { tapes, extra });
  const tab = W.HG_tabs.find(t => t && t.id === 'goldscalp');
  const P = pane();
  tab.mount(P.pane);
  const snap = await kicked(W);
  return { W, P, tapes, snap, cands: (snap && snap.cands) || [], cards: P.stubs['#gsCards'] ? P.stubs['#gsCards'].innerHTML : '', recs: W.hgFwdRecords('GOLDSCALP') };
}
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9:_. -]{0,47}$/;
const FREE_KEYS = Array.from(new Set((strip(read('goldind.js')).match(/'free:[A-Za-z0-9]+'/g) || []).map(s => s.slice(1, -1))));
const MACRO = { silverTrend: 'RISING', gsRatioTrend: 'FALLING', vixTrend: 'RISING', usdjpyTrend: 'FALLING',
                realRateHint: 'TAILWIND', dxy: { trend20: 'FALLING' }, tnxTrend: 'RISING', realRateSource: 'yahoo' };

/* ------------------------------------------------------------------ 1 */
console.log('== 1) the reads: one home, every field, the third state ==');
{
  const W = boot(CAT_FILES);
  assert(typeof W.hgGoldIndicatorReads === 'function' && typeof W.hgGoldIndicatorMarks === 'function' && typeof W.hgGoldIndicatorKeys === 'function' && typeof W.hgGoldIndicatorStackHtml === 'function', 'the four exports exist');
  const T = TAPES();
  const ir = W.hgGoldIndicatorReads(T['15m'], { rows1d: T['1d'] });
  assert(ir && ir.ok === true && ir.n === 420, 'REACHABILITY: 420 bars read ok');
  for (const f of ['adx', 'plusDI', 'minusDI', 'sma20', 'sma50', 'sma200', 'bbPctB', 'bbWidthPct', 'hv20', 'hv20Med', 'park20', 'park20Med', 'volRatio', 'tsmom96', 'hourRange', 'hourRangeP80', 'rsi14', 'ker20', 'atrRegime', 'linregSlope', 'hurst', 'ac1'])
    assert(typeof ir[f] === 'number' && isFinite(ir[f]), 'field ' + f + ' is a finite number (' + ir[f] + ')');
  assert(['TRENDING', 'CHOP', 'TRANSITION'].indexOf(ir.adxState) >= 0 && typeof ir.squeeze === 'string' && ['trending', 'meanrev', 'random'].indexOf(ir.hurstRegime) >= 0 && ['momentum', 'meanrev', 'mixed'].indexOf(ir.acRegime) >= 0, 'the four state reads carry their helpers\' own labels');
  /* ADX, the squeeze, Hurst and ACF are goldind's functions CALLED */
  const adx = W.goldADX(T['15m']), hu = W.hgGoldPart6Hurst(T['1d']), ac = W.hgGoldPart6Autocorr(T['1d']);
  assert(ir.adx === adx.adx && ir.adxState === adx.state && ir.plusDI === adx.plusDI && ir.minusDI === adx.minusDI, 'ADX / DMI are goldADX\'s own numbers');
  assert(ir.squeeze === W.goldVolSqueeze(T['15m']).state, 'the squeeze state is goldVolSqueeze\'s');
  assert(ir.hurst === hu.H && ir.hurstRegime === hu.regime && ir.ac1 === ac.ac1 && ir.acRegime === ac.regime, 'Hurst and ACF are the Part6 helpers\' own reads on the DAILY leg');
  /* the arithmetic the census and the marks rest on */
  const c = T['15m'].map(r => r.c), n = c.length;
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert(Math.abs(ir.sma20 - mean(c.slice(-20))) < 1e-9 && Math.abs(ir.sma200 - mean(c.slice(-200))) < 1e-9, 'SMA20 / SMA200 are the last-20 / last-200 means');
  assert(Math.abs(ir.tsmom96 - (c[n - 1] / c[n - 97] - 1)) < 1e-12, 'TSMOM is the 96-bar (24h) return');
  const vs = T['15m'].slice(n - 21, n - 1).map(r => r.v);
  assert(Math.abs(ir.volRatio - T['15m'][n - 1].v / mean(vs)) < 1e-12, 'volume/MA is the last closed bar over the 20 bars BEFORE it');
  const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) * (x - m)))); };
  assert(Math.abs(ir.bbPctB - ((c[n - 1] - (ir.sma20 - 2 * sd(c.slice(-20)))) / (4 * sd(c.slice(-20))))) < 1e-9, '%b is read off the 20-bar bands');
  /* hours: the tape starts at 07:15 UTC (419 x 15m before 12:00), so the 07:00 hour has three bars and the 12:00 hour one — 104 COMPLETE hours between */
  assert(ir.hoursRead === 104, 'hourly range reads COMPLETE UTC hours only: 104 (got ' + ir.hoursRead + ')');
  assert(typeof ir.hourRangeHigh === 'boolean', 'the p80 verdict is a boolean');
  /* the third state */
  const thin = W.hgGoldIndicatorReads(T['15m'].slice(-25));
  assert(thin.ok === false && /need/.test(thin.why), 'a 25-bar tape is not read (ok false, why named)');
  const nullClose = T['15m'].map(r => Object.assign({}, r)); nullClose[nullClose.length - 1].c = null;
  const nc = W.hgGoldIndicatorReads(nullClose);
  assert(nc.ok === false && /unreadable/.test(nc.why), 'a null last close is UNREADABLE, never a close of zero (the +null trap)');
  const nullLow = T['15m'].map(r => Object.assign({}, r)); nullLow[nullLow.length - 3].l = null;
  const nl = W.hgGoldIndicatorReads(nullLow);
  assert(nl.ok === true && !isFinite(nl.park20) && isFinite(nl.sma20), 'a null low inside the Parkinson window reads NaN for Parkinson alone; the closes still read');
  const noDaily = W.hgGoldIndicatorReads(T['15m']);
  assert(noDaily.ok === true && noDaily.hurst === undefined && noDaily.ac1 === undefined, 'no daily leg -> Hurst and ACF ABSENT, not computed on four days of 15m bars');
  const hourly = W.hgGoldIndicatorReads(T['1h']);
  assert(hourly.ok === true && hourly.hoursRead >= 100, 'a 1h tape reads one bar per hour (' + hourly.hoursRead + ' hours)');
  /* the catalog alone: goldind absent, the called helpers are absent and the reads say so */
  const Wc = boot(['gold-catalog.js']);
  const lone = Wc.hgGoldIndicatorReads(T['15m']);
  assert(lone.ok === true && lone.adx === undefined && lone.squeeze === undefined && isFinite(lone.sma20), 'with goldind absent ADX and the squeeze are ABSENT — called, not copied; the catalog\'s own arithmetic still reads');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the marks: three states, direction mirror, ledger shape ==');
{
  const W = boot(CAT_FILES);
  const T = TAPES();
  const ir = W.hgGoldIndicatorReads(T['15m'], { rows1d: T['1d'] });
  const KEYS = W.hgGoldIndicatorKeys();
  assert(KEYS.length === 18 && KEYS.every(k => /^ind:/.test(k)) && new Set(KEYS).size === 18, '18 named ind: keys, unique');
  assert(KEYS.every(k => KEY_RE.test(k)), 'every key passes the ledger normaliser\'s key shape');
  /* hg-v1163 added COT, GVZ and the two correlations: fourteen free: + eighteen
     ind: = 32, EXACTLY the cap -- the next mark needs the cap moved first */
  /* hg-v1165: four more legs and the cap moved 32 -> 64 first */
  assert(FREE_KEYS.length === 28 && KEYS.length + FREE_KEYS.length <= 64, 'twenty-eight free: + eighteen ind: = ' + (KEYS.length + FREE_KEYS.length) + ' fits the 64-per-record cap (hg-v1171: three more free legs)');
  assert(KEYS.length + FREE_KEYS.length > 16 && KEYS.every(k => k > 'free:') && FREE_KEYS.length - 2 === 26, 'and would NOT have fit the old 16 — every ind: key sorts AFTER free:, so at 16 only two of the eighteen indicator marks would have landed and sixteen would have been dropped silently');
  const L = W.hgGoldIndicatorMarks(ir, 'long'), S = W.hgGoldIndicatorMarks(ir, 'short');
  const DIRECTIONAL = ['ind:dmiWith', 'ind:sma20With', 'ind:sma50With', 'ind:sma200With', 'ind:tsmomWith', 'ind:rsiWith', 'ind:linregWith'];
  const STATE = KEYS.filter(k => DIRECTIONAL.indexOf(k) < 0);
  assert(Object.keys(L).length >= 16 && Object.keys(L).every(k => KEYS.indexOf(k) >= 0), 'the full tape marks at least 16 of 18 and no stowaway key (' + Object.keys(L).length + ')');
  for (const k of DIRECTIONAL) assert(L[k] === !S[k], k + ' flips with direction (long ' + L[k] + ' / short ' + S[k] + ')');
  for (const k of STATE) assert(L[k] === S[k], k + ' is a state read — identical in both directions (' + L[k] + ')');
  assert(L['ind:adxTrending'] === (ir.adxState === 'TRENDING') && L['ind:hurstTrending'] === (ir.hurstRegime === 'trending') && L['ind:acMomentum'] === (ir.acRegime === 'momentum'), 'the state marks follow the helpers\' labels');
  assert(L['ind:sma20With'] === (ir.close > ir.sma20) && S['ind:sma20With'] === !(ir.close > ir.sma20), 'sma20With is close-over-SMA20 WITH a long, AGAINST a short');
  /* the third state, on hand-built reads */
  const mk = over => W.hgGoldIndicatorMarks(Object.assign({ ok: true, close: 100 }, over), 'long');
  assert(!('ind:adxTrending' in mk({ adxState: 'TRANSITION', adx: 22 })) && mk({ adxState: 'CHOP' })['ind:adxTrending'] === false, 'ADX in TRANSITION marks nothing; CHOP marks false');
  assert(!('ind:kerTrend' in mk({ ker20: 0.45 })) && mk({ ker20: 0.6 })['ind:kerTrend'] === true && mk({ ker20: 0.3 })['ind:kerTrend'] === false, 'KER between the L1 bars marks nothing; at the bars it marks');
  assert(!('ind:rsiWith' in mk({ rsi14: 50 })) && mk({ rsi14: 50.1 })['ind:rsiWith'] === true, 'RSI exactly 50 marks nothing');
  assert(!('ind:bbSqueeze' in mk({ squeeze: 'NONE' })) && mk({ squeeze: 'FIRED' })['ind:bbSqueeze'] === false && mk({ squeeze: 'ON' })['ind:bbSqueeze'] === true, 'squeeze NONE marks nothing; FIRED and OFF read false, ON true');
  assert(!('ind:hurstTrending' in mk({ hurstRegime: 'random' })) && !('ind:acMomentum' in mk({ acRegime: 'mixed' })), 'a random Hurst and a mixed ACF mark nothing');
  assert(!('ind:dmiWith' in mk({ plusDI: 20, minusDI: 20 })) && !('ind:tsmomWith' in mk({ tsmom96: 0 })) && !('ind:linregWith' in mk({ linregSlope: 0 })), 'equal DI, a zero return and a flat slope mark nothing');
  assert(!('ind:hvHigh' in mk({ hv20: 0.01 })) && mk({ hv20: 0.01, hv20Med: 0.005 })['ind:hvHigh'] === true, 'HV with no median to judge against marks nothing');
  assert(!('ind:sma200With' in mk({ sma200: NaN })) && !('ind:hourRangeP80' in mk({ hourRangeHigh: undefined })), 'an unreadable SMA200 or hour range marks nothing');
  assert(Object.keys(W.hgGoldIndicatorMarks({ ok: false }, 'long')).length === 0 && Object.keys(W.hgGoldIndicatorMarks(ir, 'LONG')).length === 0 && Object.keys(W.hgGoldIndicatorMarks(null, 'long')).length === 0, 'reads that are not ok (and so carry no fields), a direction in the wrong case and no reads mark NOTHING');
  const booleansOnly = Object.keys(L).every(k => L[k] === true || L[k] === false);
  assert(booleansOnly, 'only the two booleans ever land');
  /* the renderer */
  const html = W.hgGoldIndicatorStackHtml(ir, L);
  const marked = Object.keys(L).length;
  assert(/INDICATOR STACK/.test(html) && /data-hg-ind-stack/.test(html) && new RegExp(marked + ' of 18 reads marked').test(html), 'the stack renders with the marked count (' + marked + ' of 18)');
  assert(/gates nothing/.test(html) && /not part of the tally/.test(html), 'and says it is not part of the tally and gates nothing');
  assert(new RegExp('<b>ADX14</b> ' + (L['ind:adxTrending'] ? 'TRENDING' : 'CHOP')).test(html) && /SMA200/.test(html), 'each read prints its own two words, not WITH/AGAINST for a state');
  const partial = W.hgGoldIndicatorStackHtml(ir, { 'ind:adxTrending': true });
  assert((partial.match(/UNREAD/g) || []).length === 17 && /1 of 18 reads marked/.test(partial), 'an unmarked read prints UNREAD, never invents a verdict');
  assert(W.hgGoldIndicatorStackHtml({ ok: false }, L) === '' && W.hgGoldIndicatorStackHtml(null, L) === '', 'no reads -> no line');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) the census reads the scan context; the free feeds it does not fetch are named ==');
{
  const W = boot(CAT_FILES);
  const T = TAPES();
  const src = strip(read('gold-catalog.js'));
  assert(!/void opts/.test(src), 'the census no longer discards its opts (`void opts` is gone)');
  const f0 = W.hgGoldCatalogFeed(T['15m'], {});
  assert(f0.usedN + f0.uncheckedN + f0.excludedN === 204, 'every item still USED / UNCHECKED / EXCLUDE (partition)');
  const usedIds = f => new Set(f.used.filter(u => u.family !== 'L1').map(u => u.id));
  const u0 = usedIds(f0);
  for (const id of [44, 47, 54, 66, 72, 73, 75, 95]) assert(u0.has(id), 'the pre-existing computed id ' + id + ' is still USED');
  for (const id of [33, 38, 53, 76, 81, 82, 91, 94]) assert(u0.has(id), 'bar-computable id ' + id + ' is USED on the tape alone (no context needed)');
  const noteOf = (f, id) => (f.used.concat(f.unchecked).find(u => u.id === id && u.family !== 'L1') || {}).note || '';
  assert(/SMA20 \d/.test(noteOf(f0, 33)) && /ADX14=\d/.test(noteOf(f0, 38)) && /BB\(20,2\) %b/.test(noteOf(f0, 76)) && /HV20 .*%\/bar/.test(noteOf(f0, 81)) && /Parkinson20/.test(noteOf(f0, 82)) && /hour range .* vs p80/.test(noteOf(f0, 91)) && /volume\/MA20/.test(noteOf(f0, 94)) && /TSMOM 24h/.test(noteOf(f0, 53)), 'each computed row names its value this bar');
  for (const id of [48, 49, 125, 144, 146, 152, 153, 163]) assert(!u0.has(id), 'without a context id ' + id + ' reads UNCHECKED (nothing was read)');
  const ctx = { macro: MACRO, news: { events: [{ t: WED + 3600e3, impact: 'high', title: 'CPI' }] }, cot: { crowding: 'SPEC CROWDED LONG', zScore: 2.3, reportDate: '2026-04-07' }, now: WED, rows1d: T['1d'] };
  const f1 = W.hgGoldCatalogFeed(T['15m'], { ctx, killzone: 'NY AM' });
  const u1 = usedIds(f1);
  for (const id of [48, 49, 125, 144, 152, 153, 163]) assert(u1.has(id), 'with the context id ' + id + ' reads USED');
  assert(f1.usedN === f0.usedN + 7, 'seven more rows USED with the context (' + f0.usedN + ' -> ' + f1.usedN + ')');
  assert(/COT managed money SPEC CROWDED LONG · z=2\.30 · as-of 2026-04-07/.test(noteOf(f1, 125)), 'COT names its crowding, z and as-of');
  assert(/calendar snapshot loaded · 1 events/.test(noteOf(f1, 144)), 'the calendar names its event count');
  assert(/Hurst\(1d\) H=/.test(noteOf(f1, 48)) && /daily return ac1=/.test(noteOf(f1, 49)), 'Hurst and ACF read the daily leg the context carries');
  assert(/silver rising — Yahoo SI=F/.test(noteOf(f1, 153)) && /USDJPY falling \(JPY=X\)/.test(noteOf(f1, 152)) && /session NY AM/.test(noteOf(f1, 163)), 'silver, USDJPY and the session name their reads');
  assert(!u1.has(146) && /NOT measured — fallback hint TAILWIND only/.test(noteOf(f1, 146)), 'the real yield stays UNCHECKED on a fallback hint and SAYS so — a hint is not a measurement');
  const f2 = W.hgGoldCatalogFeed(T['15m'], { ctx: Object.assign({}, ctx, { macro: Object.assign({}, MACRO, { realRateMeasured: { measured: true, trend: 'FALLING', source: 'fred-dfii10' } }) }) });
  assert(usedIds(f2).has(146) && /real yield falling · fred-dfii10/.test(noteOf(f2, 146)), 'a MEASURED real yield reads USED naming its source');
  const f3 = W.hgGoldCatalogFeed(T['15m'], { ctx: Object.assign({}, ctx, { cot: { crowding: 'N/A', note: 'no COT rows' }, news: null }) });
  assert(!usedIds(f3).has(125) && !usedIds(f3).has(144), 'a COT with no rows and a null calendar stay UNCHECKED');
  assert(/GVZ unread/.test(noteOf(f1, 87)) && /VIX rising read/.test(noteOf(f1, 87)), 'GVZ/VIX ratio: the VIX half is read, the GVZ half is named unread');
  /* hg-v1163: the three legs are fetched now (macro.js); a snapshot without
     them still names each as unread rather than "no tape" */
  assert(/GVZ unread this snapshot/.test(noteOf(f1, 83)) && /SPX correlation unread/.test(noteOf(f1, 150)) && /BTC correlation unread/.test(noteOf(f1, 151)), 'a snapshot without the three hg-v1163 legs names each as unread (GVZ, ^GSPC, BTC), not "no tape"');
  /* the census reads the stack through the one home: a hand-in wins, the same arithmetic otherwise */
  const ir = W.hgGoldIndicatorReads(T['15m'], { rows1d: T['1d'] });
  const f4 = W.hgGoldCatalogFeed(T['15m'], { ctx, ind: ir });
  assert(noteOf(f4, 38) === noteOf(f1, 38) && noteOf(f4, 48) === noteOf(f1, 48), 'handing the reads in gives the same notes the census computes itself (one home)');
  const fe = W.hgGoldCatalogFeed([], {});
  assert(fe.usedN + fe.uncheckedN + fe.excludedN === 204 && !usedIds(fe).has(38), 'no bars: the partition holds and nothing is computed');
  const eng = W.hgGoldCatalogEngine(T['15m'], { ctx, killzone: 'NY AM' });
  assert(eng.ok && eng.usedN === f1.usedN && new RegExp('USED ' + f1.usedN).test(W.hgGoldCatalogHtml(eng)), 'the engine and its html carry the context-read count (' + eng.usedN + ')');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) the ranker: marks ride the row, nothing moves, fail-open without the catalog ==');
{
  const T = TAPES();
  const cand = dir => ({ sym: 'XAUUSD', dir, stratKey: 'TREND', strategy: 'trend-pullback', entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280, agree: 5, killzoneWeight: 0 });
  const ctxOf = () => ({ scanner: 'GOLDSCALP', now: WED, news: { caution: false }, macro: MACRO, rows15m: T['15m'], rows1h: T['1h'], rows4h: T['4h'], rows1d: T['1d'] });
  const Wc = boot(RANK_BASE.concat(['gold-catalog.js'])), Wn = boot(RANK_BASE);
  Wc.hgPerfectFormation = () => ({ perfect: false, plus: false, why: [] }); Wn.hgPerfectFormation = Wc.hgPerfectFormation;
  const rc = Wc.goldRankSetups([cand('long'), cand('short')], ctxOf()).ranked, rn = Wn.goldRankSetups([cand('long'), cand('short')], ctxOf()).ranked;
  assert(rc.length === 2 && rn.length === 2, 'REACHABILITY: both directions rank with and without the catalog');
  const byDir = r => { const o = {}; r.forEach(x => { o[x.dir] = x; }); return o; };
  const C = byDir(rc), N = byDir(rn);
  const indKeys = r => Object.keys(r.freeReads || {}).filter(k => /^ind:/.test(k));
  assert(indKeys(C.long).length >= 16 && indKeys(C.short).length >= 16, 'with the catalog every ranked row carries the ind: marks (' + indKeys(C.long).length + ')');
  assert(C.long.freeReads['ind:dmiWith'] === !C.short.freeReads['ind:dmiWith'] && C.long.freeReads['ind:adxTrending'] === C.short.freeReads['ind:adxTrending'], 'direction-relative marks flip, state marks do not, on the ranked rows');
  const ir = Wc.hgGoldIndicatorReads(T['15m'], { rows1d: T['1d'] });
  assert(C.long.indReads && C.long.indReads.adx === ir.adx && C.long.indReads.hurst === ir.hurst, 'the row carries the reads of the 15m tape and the daily leg the ctx handed in');
  assert(C.long.freeReads['ind:hurstTrending'] === (ir.hurstRegime === 'trending'), 'the Hurst mark on the row is the daily-leg read');
  assert(indKeys(N.long).length === 0 && indKeys(N.short).length === 0 && N.long.indReads === undefined, 'with the catalog ABSENT no ind: key and no reads land — fail-open, never a guessed false');
  for (const d of ['long', 'short']){
    assert(C[d].tally === N[d].tally && C[d].grade === N[d].grade, d + ': tally and grade are IDENTICAL with and without the marks (' + C[d].tally + ' / ' + C[d].grade + ')');
    const sum = r => (r.tallyParts || []).reduce((a, p) => a + (+p.pts || 0), 0);
    assert(C[d].tally === sum(C[d]), d + ': the tally is still exactly the sum of its parts');
  }
  const noRows = Wc.goldRankSetups([cand('long')], Object.assign(ctxOf(), { rows15m: [], rows1h: [], rows4h: [], rows1d: null })).ranked[0];
  assert(indKeys(noRows).length === 0, 'no rows in the ctx -> no ind: mark');
}

/* ------------------------------------------------------------------ 5 */
console.log('== 5) end to end through the real GOLD SCALP tab ==');
{
  const r = await scanTab({ getGoldMacro: async () => MACRO, binanceFunding: async () => ({ fundingPct: -0.05 }), S: { fng: { v: 20 } } });
  assert(r.snap && r.cands.length > 0 && r.recs.length > 0, 'REACHABILITY: the mount-kicked scan minted (' + r.cands.length + ') and recorded (' + r.recs.length + ')');
  const indOf = o => Object.keys(o || {}).filter(k => /^ind:/.test(k)), freeOf = o => Object.keys(o || {}).filter(k => /^free:/.test(k));
  assert(r.recs.every(x => x.reads && indOf(x.reads).length >= 16 && freeOf(x.reads).length === 7), 'EVERY record carries the ind: marks AND the seven free-feed marks this run read (' + indOf(r.recs[0].reads).length + ' + ' + freeOf(r.recs[0].reads).length + ')');
  const cand0 = r.cands.find(c => c.dir === r.recs[0].dir);
  assert(cand0 && Object.keys(cand0.freeReads).length === Object.keys(r.recs[0].reads).length && Object.keys(cand0.freeReads).length > 16, 'the ledger kept EVERY mark the row carried (' + Object.keys(r.recs[0].reads).length + ' > 16): nothing fell off the widened cap');
  assert(r.recs.every(x => Object.keys(x.reads).length <= 32), 'and the set sits inside 32');
  const ir = r.W.hgGoldIndicatorReads(r.tapes['15m'], { rows1d: r.tapes['1d'] });
  assert(r.recs.every(x => x.reads['ind:adxTrending'] === (ir.adxState === 'TRENDING') && x.reads['ind:hurstTrending'] === (ir.hurstRegime === 'trending')), 'the marks on the record are the reads of the tape the desk scanned, daily leg included');
  const longs = r.recs.filter(x => x.dir === 'long'), shorts = r.recs.filter(x => x.dir === 'short');
  assert(longs.concat(shorts).every(x => x.reads['ind:sma20With'] === ((ir.close > ir.sma20) === (x.dir === 'long'))), 'sma20With on each record follows its own direction');
  assert(r.recs.every(x => x.barT === SEC && x.sym === 'XAUUSD'), 'records still dated on the 15m signal bar, keyed XAUUSD — nothing else moved');
  assert(r.cands.every(c => c.indReads && c.indReads.ok === true && c.indReads.adx === ir.adx), 'the publish copy carries the reads on every row');
  /* the board */
  assert(/INDICATOR STACK/.test(r.cards) && /data-hg-ind-stack/.test(r.cards), 'the card prints the INDICATOR STACK line');
  assert(new RegExp('<b>ADX14</b> ' + (ir.adxState === 'TRENDING' ? 'TRENDING' : 'CHOP')).test(r.cards) && /<b>HURST \(1d\)<\/b> (TRENDING|MEANREV)/.test(r.cards), 'and the reads on it are the tape\'s');
  const f0 = r.W.hgGoldCatalogFeed(r.tapes['15m'], {});
  const usedOnBoard = (r.cards.match(/MASTER CATALOG[\s\S]*?USED (\d+)/g) || []).map(x => +x.match(/USED (\d+)$/)[1]);
  assert(usedOnBoard.length === 1, 'ONE catalog census on the painted board, not two with two numbers (' + usedOnBoard.length + ')');
  assert(usedOnBoard[0] > f0.usedN, 'and it read the context: USED ' + usedOnBoard[0] + ' > ' + f0.usedN + ' on the tape alone');
  assert(usedOnBoard[0] >= f0.usedN + 4, 'at least the daily legs, silver and USDJPY were read off the scan (' + usedOnBoard[0] + ' vs ' + f0.usedN + ')');
  /* settle, and the split can ask */
  const last = r.tapes['15m'][r.tapes['15m'].length - 1];
  const later = r.tapes['15m'].concat([{ t: last.t + 900, o: last.c, h: last.c + 80, l: last.c - 80, c: last.c + 40, v: 1000 }, { t: last.t + 1800, o: last.c + 40, h: last.c + 120, l: last.c - 120, c: last.c, v: 1000 }]);
  r.W.hgFwdResolve('XAUUSD', '15m', later, 'xm-xauusd');
  const sp = r.W.hgFwdReadSplit('GOLDSCALP');
  assert(sp && sp.settled === r.recs.length && sp.reads['ind:adxTrending'] && (sp.reads['ind:adxTrending'].yes.n + sp.reads['ind:adxTrending'].no.n) === r.recs.length, 'settled, the read split has a cell for ind:adxTrending counting every record');
  const note = r.W.hgGoldFwdNote('goldscalp', undefined, 'xm-xauusd');
  assert(/FREE-FEED LEGS &amp; INDICATOR STACK/.test(note) && /ind:adxTrending/.test(note) && /gates nothing/.test(note), 'the desk\'s own note leads with the stack and prints the ind: legs');
  /* no daily leg: the Hurst mark is absent on the record, the rest stands */
  const t2 = TAPES(); t2['1d'] = [];
  const r2 = await scanTab({ getGoldMacro: async () => MACRO }, t2);
  assert(r2.recs.length > 0 && r2.recs.every(x => x.reads && !('ind:hurstTrending' in x.reads) && !('ind:acMomentum' in x.reads) && 'ind:adxTrending' in x.reads), 'with no daily leg the two daily marks are ABSENT on every record and the 15m marks still ride');
}

/* ------------------------------------------------------------------ 6 */
console.log('== 6) one home: nothing reads the marks back ==');
{
  const gi = strip(read('goldind.js')), gs = strip(read('goldscalp.js')), gc = strip(read('gold-catalog.js'));
  assert((gi.match(/hgGoldIndicatorReads\(/g) || []).length === 1 && (gi.match(/hgGoldIndicatorMarks\b/g) || []).length === 2, 'the ranker calls the reads once per scan and takes the marks helper once (the typeof guard and the assignment)');
  assert(!/\.indReads\s*[^=]/.test(gi.replace('rc.indReads = indReads;', '').replace('ind: inp.indReads || null', '')) && (gi.match(/freeReads\[/g) || []).length === 1, 'goldind READS neither indReads nor any mark back (the ranker\'s one write, the forming stack\'s one pass-through to the census, the helper\'s one freeReads[ write) — the marks gate nothing in the ranker');
  assert(!/freeReads/.test(gc), 'gold-catalog.js never names freeReads (the hg-v1155 "no other reader" census stays true)');
  assert(/indReads: \(c\.indReads && typeof c\.indReads === 'object' && c\.indReads\.ok === true\) \? c\.indReads : undefined,/.test(gs), 'the publish copy carries indReads only when the reads are ok');
  assert(/gsIndicatorStackHtml\(c\)/.test(gs), 'the card prints the stack');
  assert(/catalogCtx: gsCatalogCtx\(ctx\), indReads: \(lead && lead\.indReads\) \|\| null, killzone: \(lead && lead\.killzone\) \|\| ''/.test(gs) && /formingLayersHtml\(displayBest \|\| display\[0\]\)/.test(gs) && /formingLayersHtml\(null\)/.test(gs), 'the two painted branches hand the census its context through the forming-layers panel (the leader\'s reads and session on the board branch)');
  assert((gs.match(/gsCatalogHtml\(ctx, gold\.rows15m/g) || []).length === 1, 'and the extra render stays only on the feeds-failed branch, where that panel does not paint');
  assert(/ctx: inp\.catalogCtx \|\| null, ind: inp\.indReads \|\| null, killzone: inp\.killzone \|\| ''/.test(gi), 'goldind\'s forming stack passes the context to the census it paints');
  const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f));
  const namers = files.filter(f => /'ind:[A-Za-z0-9]+'/.test(strip(read(f))));
  assert(namers.length === 1 && namers[0] === 'gold-catalog.js', 'the ind: key literals live in gold-catalog.js and nowhere else (' + namers.join(', ') + ')');
  for (const g of ['hg-gates.js', 'cryptogates.js', 'gold-formation.js', 'hg-solidity.js', 'conviction-lock.js', 'hg-forward.js', 'gold-best-levels.js'])
    assert(!/ind:(adx|dmi|bb|sma|hv|park|vol|tsmom|hour|rsi|ker|atr|linreg|hurst|ac)/.test(strip(read(g))), g + ' names no indicator mark');
  assert(/freeReads/.test(strip(read('goldswing.js'))) && /indReads/.test(strip(read('goldswing.js'))), 'GOLD SWING forwards both bags since hg-v1166 — the hg-v1155 swing gap is closed (its own guard drives the record)');
  const hf = strip(read('hg-forward.js'));
  assert(/FWD_READS_MAX = 64/.test(hf), 'the ledger cap reads 64 (hg-v1165)');
}

/* ------------------------------------------------------------------ 7 */
console.log('== 7) build stamps ==');
assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
