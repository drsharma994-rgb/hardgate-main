/* HARDGATE -- hg-v979: the forward ledger settled a gold record on whichever
   desk next handed it bars of that timeframe, and the gold desks do not read
   one feed.

   Every gold desk records sym 'XAUUSD' and hgFwdSettle matched on sym + tf
   only. GOLD SCALP and GOLD SWING price their levels on the XM bridge first;
   GOLD ULTRA, GOLD DIRECTION, GOLD PRO and OPTI GOLD have no XM leg and read
   Binance XAUUSDT, then PAXG; OMNIGOLD's resolver settles EVERY open XAUUSD
   record with whatever bars it fetched, by design ("a user who runs only one
   gold tab should still see their records resolve"). macro.js puts PAXG
   "within ~0.5%" of spot; goldscalp.js records XAUT ~1.5% under the XM
   print. In GOLD SCALP's committed walk (2,605 trades) the median stop is
   0.219% of entry and 91.4% of stops are narrower than 0.5% -- so a record
   priced on one feed and settled on another is decided on its FIRST bar by
   the basis and the trade's direction, not by the tape. GOLD SWING's own
   comment said "the venue affects execution, not whether the setup
   resolved"; it affects whether the setup resolved.

   The rule lives once: a record carries the feed its levels were priced on
   (`feed`), the resolver names the feed of the bars it hands over, and a
   KNOWN mismatch is held for its own feed. Unknown on either side fails
   open, exactly as the timeframe rule beside it does. Found on the way: the
   TAURIC price path read `rows.length` on the PACK hgOgFetchRows returns
   and so never priced a plan in production; its guard stubbed a bare array.

   Sections:
     1) the ledger rule, driven directly (and the defect reproduced first)
     2) GOLD SCALP end to end: seven XM records, held under PAXG bars,
        settled under XM bars; the pre-fix records resolved on the first bar
     3) GOLD SWING end to end, and the note that says what is waiting
     4) the other desks: what can be driven is driven, the rest is textual
        and says so (hg-v956)
     5) the census, derived from source: every XAUUSD writer and resolver
        names a feed
     6) build stamps
   Run: node tests/test-gold-ledger-same-feed.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/mg, '');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

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
/* a continuation from the last close, starting one step after WED */
function future(lastClose, n, stepSec, seed, amp){
  let s = seed, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let c = lastClose; const t0 = SEC + stepSec;
  for (let i = 0; i < n; i++){
    const shock = (rnd() < 0.06) ? (rnd() - 0.5) * amp : 0;
    const o = c; c = o + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
    const w = 0.8 + rnd() * 2.6;
    rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 1000 });
  }
  return rows;
}
const shift = (rows, b) => rows.map(r => ({ t: r.t, o: r.o * (1 + b), h: r.h * (1 + b), l: r.l * (1 + b), c: r.c * (1 + b), v: r.v }));

function boot(files, clock, news, tapes, feed){
  const FakeDate = class extends Date { static now(){ return clock.now; } };
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date: FakeDate, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; }, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  const el = () => ({ style: {}, innerHTML: '', textContent: '', appendChild(){}, setAttribute(){}, addEventListener(){},
    querySelector: () => el(), querySelectorAll: () => [], classList: { add(){}, remove(){}, toggle(){} }, dataset: {} });
  const byId = {};
  ctx.document = { createElement: el, getElementById: id => (byId[id] || (byId[id] = el())), querySelector: () => el(), querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false }, documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  if (tapes){
    ctx.getXmGoldCandles = async tf => ({ rows: tapes[tf] || [], source: feed || 'xm-xauusd' });
    ctx.getGoldCandles = async () => ({ rows: [], source: null });
  }
  if (news !== undefined) ctx.hgNewsState = () => news;
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){} }
  return ctx;
}
/* the four desks below are IIFE-wrapped: their helpers are lifted out of the
   file and RUN under stubs (the hg-v951 technique) */
function lift(file, head){
  const src = read(file);
  const i = src.indexOf(head);
  assert(i > 0, file + ': ' + head.trim() + ' is findable');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j + 2);
}
function sandbox(extra){
  const sb = Object.assign({ Math, Number, String, Object, Array, JSON, Promise, isFinite, isNaN, parseFloat, parseInt, console: { log(){}, warn(){}, error(){} } }, extra || {});
  sb.gfn = n => (typeof sb[n] === 'function' ? sb[n] : null);
  vm.createContext(sb);
  return sb;
}
const BASE = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'gold-best-levels.js', 'hg-forward.js', 'gold-forward-read.js'];

console.log('== 1) the ledger rule, driven directly ==');
{
  const clock = { now: WED + 5 * 60000 };
  const W = boot(['hg-forward.js'], clock, undefined, null);
  const fits = W.hgFwdFeedFits;
  assert(fits('xm-xauusd', 'xm-xauusd') === true && fits('binance-paxg', 'binance-paxg') === true, 'the same named feed on both sides fits');
  assert(fits('xm-xauusd', 'binance-paxg') === false && fits('binance-xau', 'binance-paxg') === false, 'two different NAMED feeds do not (xm vs paxg, xau vs paxg)');
  assert(fits(undefined, 'binance-paxg') === true && fits('', 'binance-paxg') === true && fits(null, 'x') === true, 'a record with no feed settles under any bars (fails OPEN, as the timeframe rule does)');
  assert(fits('xm-xauusd', undefined) === true && fits('xm-xauusd', '') === true && fits('xm-xauusd', 7) === true, 'bars whose caller named no feed settle any record');

  const row = x => Object.assign({ sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2290, t1: 2320, mechanic: 'M', signalT: WED }, x || {});
  const bars = future(2300, 30, 900, 5, 24);
  /* a tape that reaches the target cleanly on bar 3 */
  const up = bars.map((r, i) => ({ t: r.t, o: 2300, h: i >= 2 ? 2325 : 2305, l: 2296, c: 2302, v: 1 }));
  const recs = tab => W.hgFwdRecords(tab);

  /* THE DEFECT, REPRODUCED FIRST: a record with no feed (every record ever
     written before this pack) is settled by bars of ANY feed, and a +0.5%
     basis on a 0.43%-stop long reads as a target hit on the first bar */
  assert(W.hgFwdRecordScan('LEGACY', '15m', [row()]) === 1 && recs('LEGACY')[0].feed === undefined, 'REACHABILITY: a row naming no feed records with feed undefined (the pre-hg-v979 record)');
  const flat = bars.map(r => ({ t: r.t, o: 2300, h: 2303, l: 2298, c: 2300, v: 1 }));   /* goes nowhere */
  const legacyInfo = W.hgFwdResolveInfo('XAUUSD', '15m', shift(flat, 0.01), 'binance-paxg');
  assert(legacyInfo.changed === 1 && legacyInfo.heldFeed === 0 && recs('LEGACY')[0].state === 't1' && recs('LEGACY')[0].settledT === flat[0].t,
    'THE DEFECT: a flat tape shifted +1% (another feed\'s basis) settles the feedless record as a TARGET HIT on its FIRST bar -- the outcome is the basis, not the tape');

  assert(W.hgFwdRecordScan('A', '15m', [row({ feed: 'xm-xauusd' })]) === 1 && recs('A')[0].feed === 'xm-xauusd', 'c.feed is recorded on the row');
  assert(W.hgFwdRecordScan('B', '15m', [row()], { feed: 'binance-xau' }) === 1 && recs('B')[0].feed === 'binance-xau', 'opts.feed names one feed for the whole scan');
  assert(W.hgFwdRecordScan('C', '15m', [row({ feed: 'xm-xauusd' })], { feed: 'binance-xau' }) === 1 && recs('C')[0].feed === 'xm-xauusd', 'the candidate\'s own feed wins over the scan\'s');
  for (const junk of [7, null, '', {}, true]){
    const tab = 'J' + String(junk);
    W.hgFwdRecordScan(tab, '15m', [row({ feed: junk })]);
    assert(recs(tab)[0] && recs(tab)[0].feed === undefined, 'a non-string feed (' + JSON.stringify(junk) + ') is not a feed: recorded as absent');
  }
  /* the rule's ONE home is hgFwdNormalize; the scan entry point pre-filters,
     so a mutation coercing the feed there survived until hgFwdRecord -- the
     route OMNIGOLD, TAURIC and 80PERCENT take -- was driven directly */
  const direct = x => Object.assign({ tab: 'K' + String(x), mechanic: 'M', sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2290, t1: 2320, barT: SEC, feed: x });
  assert(W.hgFwdRecord(direct(7)) === 'recorded' && recs('K7')[0].feed === undefined, 'hgFwdRecord (the direct route): a numeric feed is recorded as absent, never coerced to "7"');
  assert(W.hgFwdRecord(direct({})) === 'recorded' && recs('K[object Object]')[0].feed === undefined && W.hgFwdRecord(direct('xm-xauusd')) === 'recorded' && recs('Kxm-xauusd')[0].feed === 'xm-xauusd', 'an object is absent; a string is kept');
  const heldInfo = W.hgFwdResolveInfo('XAUUSD', '15m', shift(flat, 0.01), 'binance-paxg');
  assert(recs('A')[0].state === 'open' && heldInfo.heldFeed >= 1, 'the SAME shifted tape named binance-paxg leaves the xm-xauusd record OPEN and counts it held (' + heldInfo.heldFeed + ')');
  assert(W.hgFwdFeedHeld('A', 'binance-paxg').held === 1 && W.hgFwdFeedHeld('A', 'binance-paxg').feeds['xm-xauusd'] === 1, 'hgFwdFeedHeld counts it, by the feed it waits for');
  assert(W.hgFwdFeedHeld('A', 'xm-xauusd').held === 0 && W.hgFwdFeedHeld('A').held === 0 && W.hgFwdFeedHeld('A', 7).held === 0, 'nothing is held against its own feed, or against no feed');
  assert(W.hgFwdFeedHeld(['A', 'B'], 'delta-xaut').held === 2, 'a list of tabs pools the count (A on xm, B on binance-xau, both held against delta-xaut)');
  assert(W.hgFwdResolve('XAUUSD', '15m', up) === 1 || recs('A')[0].state === 't1', 'bars whose caller names NO feed settle it (a legacy resolver keeps working)');
  W.hgFwdRecordScan('D', '15m', [row({ feed: 'xm-xauusd' })]);
  assert(W.hgFwdResolveInfo('XAUUSD', '15m', up, 'xm-xauusd').changed >= 1 && recs('D')[0].state === 't1', 'bars named with the record\'s OWN feed settle it');
  /* the multi-timeframe entry: a per-timeframe map (gold.src) or one label */
  W.hgFwdRecordScan('E', '15m', [row({ feed: 'xm-xauusd' })]);
  W.hgFwdRecordScan('E', '4h', [row({ feed: 'binance-paxg', signalT: WED - 3 * 3600000 })]);
  const up4 = up.map(r => ({ t: SEC + 14400 * (1 + up.indexOf(r)), o: r.o, h: r.h, l: r.l, c: r.c, v: 1 }));
  W.hgFwdResolveMulti('XAUUSD', { '15m': up, '4h': up4 }, { '15m': 'binance-paxg', '4h': 'binance-paxg' });
  assert(recs('E').find(r => r.tf === '15m').state === 'open' && recs('E').find(r => r.tf === '4h').state === 't1', 'ResolveMulti with a per-timeframe map: the 15m xm record is held, the 4h paxg record settles');
  W.hgFwdResolveMulti('XAUUSD', { '15m': up }, 'xm-xauusd');
  assert(recs('E').find(r => r.tf === '15m').state === 't1', 'ResolveMulti with one label for every timeframe');
  W.hgFwdRecordScan('F', '15m', [row({ feed: 'xm-xauusd' })]);
  W.hgFwdResolveMulti('XAUUSD', { '15m': up }, { '4h': 'binance-paxg' });
  assert(recs('F')[0].state === 't1', 'a timeframe the map does not name passes no feed and settles as before');
  /* the dedup key is untouched: the feed is not part of a firing's identity */
  W.hgFwdRecordScan('G', '15m', [row({ feed: 'xm-xauusd' })]);
  assert(W.hgFwdRecordScan('G', '15m', [row({ feed: 'binance-paxg' })]) === 0 && recs('G').length === 1, 'the same firing seen under another feed label is still ONE record (the key is tab|mechanic|sym|dir|barT)');
}

const desc = rs => rs.map(r => [r.mechanic, r.dir, r.feed].join('|')).sort().join(' ~ ');
async function scanOnce(files, tabId, tapes, clock, feed){
  const W = boot(files, clock, null, tapes, feed);
  const tab = (W.HG_tabs || []).find(t => t && t.id === tabId);
  const r = await tab.refresh();
  const snap = W[tabId + 'Scan']();
  return { W, r, cands: (snap && snap.cands) || [], recs: W.hgFwdRecords(tabId === 'goldscalp' ? 'GOLDSCALP' : 'GOLDSWING'), tapes };
}

console.log('== 2) GOLD SCALP end to end: XM records, PAXG bars ==');
{
  const tapes = { '15m': tapeEnding(WED, 420, 900, 102, 24), '1h': tapeEnding(WED, 220, 3600, 103, 30), '4h': tapeEnding(WED, 140, 14400, 104, 40), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
  const clock = { now: WED + 5 * 60000 };
  const r = await scanOnce(BASE.concat(['goldscalp.js']), 'goldscalp', tapes, clock);
  assert(r.r === 'refreshed' && r.recs.length >= 5, 'REACHABILITY: a headless XM-fed scan ran and recorded (' + r.recs.length + ' records)');
  assert(r.recs.every(x => x.feed === 'xm-xauusd'), 'every record carries the feed its levels were priced on: xm-xauusd (' + desc(r.recs).slice(0, 60) + '...)');
  assert(r.cands.length > 0 && r.cands.every(c => c.feed === 'xm-xauusd'), 'the published snapshot carries it too (SUPER GOLD records from that snapshot)');
  const W = r.W, n = r.recs.length;
  const raw = W.localStorage.getItem('hg_forward_v1');
  const fut = future(tapes['15m'][tapes['15m'].length - 1].c, 60, 900, 1002, 24);
  /* under another desk's PAXG bars 1.5% under the XM print (the XAUT basis
     goldscalp.js records): held, every one */
  const held = W.hgFwdResolveInfo('XAUUSD', '15m', shift(fut, -0.015), 'binance-paxg');
  assert(held.changed === 0 && held.heldFeed === n && W.hgFwdRecords('GOLDSCALP').every(x => x.state === 'open'), 'PAXG bars 1.5% under the XM print settle NOTHING: all ' + n + ' held for their own feed');
  assert(W.hgFwdFeedHeld('GOLDSCALP', 'binance-paxg').held === n, 'hgFwdFeedHeld(GOLDSCALP, binance-paxg) = ' + n);
  const note = W.hgGoldFwdNote('goldscalp', undefined, 'binance-paxg');
  assert(/PRICED ON ANOTHER FEED/.test(note) && note.indexOf(n + ' OPEN RECORD') >= 0 && /xm-xauusd/.test(note) && /binance-paxg/.test(note), 'the desk note says what is waiting and for which feed');
  assert(!/PRICED ON ANOTHER FEED/.test(W.hgGoldFwdNote('goldscalp', undefined, 'xm-xauusd')) && !/PRICED ON ANOTHER FEED/.test(W.hgGoldFwdNote('goldscalp')), 'and says nothing under the record\'s own feed, or when no feed is named');
  /* under the desk's own feed: they settle on the tape */
  W.localStorage.setItem('hg_forward_v1', raw);
  const own = W.hgFwdResolveInfo('XAUUSD', '15m', fut, 'xm-xauusd');
  const settledOwn = W.hgFwdRecords('GOLDSCALP').filter(x => x.state !== 'open');
  assert(own.heldFeed === 0 && own.changed === n && settledOwn.length === n, 'XM bars settle all ' + n + ' on the tape (' + settledOwn.filter(x => x.state === 't1').length + ' t1 / ' + settledOwn.filter(x => x.state === 'stop').length + ' stop)');
  const firstOwn = settledOwn.filter(x => x.settledT === fut[0].t).length;
  /* THE DEFECT ON THESE RECORDS: strip the feed (the pre-hg-v979 record) and
     settle the same seven under the same PAXG bars -- decided on bar one */
  W.localStorage.setItem('hg_forward_v1', JSON.stringify(JSON.parse(raw).map(x => { const y = Object.assign({}, x); delete y.feed; return y; })));
  const legacy = W.hgFwdResolveInfo('XAUUSD', '15m', shift(fut, -0.015), 'binance-paxg');
  const settledLegacy = W.hgFwdRecords('GOLDSCALP').filter(x => x.state !== 'open');
  const firstLegacy = settledLegacy.filter(x => x.settledT === fut[0].t).length;
  assert(legacy.heldFeed === 0 && settledLegacy.length === n && firstLegacy >= Math.ceil(n / 2) && firstLegacy > firstOwn,
    'THE DEFECT: the same records with no feed settle under those PAXG bars, ' + firstLegacy + ' of ' + n + ' on the FIRST bar (' + firstOwn + ' on the first bar under their own feed)');
  assert(settledLegacy.filter(x => x.dir === 'short' && x.state === 't1' && x.settledT === fut[0].t).length === settledLegacy.filter(x => x.dir === 'short' && x.settledT === fut[0].t).length,
    'and every short resolved on that first bar is a "win" -- the basis under the print, not the trade');
}

console.log('== 3) GOLD SWING end to end ==');
{
  const tapes = { '4h': tapeEnding(WED, 300, 14400, 103, 40, -0.3), '1d': tapeEnding(WED, 150, 86400, 106, 60, -0.3), '1h': tapeEnding(WED, 220, 3600, 103, 30) };
  const clock = { now: WED + 5 * 60000 };
  const r = await scanOnce(BASE.concat(['goldswing.js']), 'goldswing', tapes, clock);
  assert(r.r === 'refreshed' && r.recs.length >= 1, 'REACHABILITY: a headless XM-fed swing scan ran and recorded (' + r.recs.length + ')');
  assert(r.recs.every(x => x.feed === 'xm-xauusd') && r.cands.every(c => c.feed === 'xm-xauusd'), 'swing records and the snapshot carry xm-xauusd');
  const W = r.W, n = r.recs.length;
  const fut = future(tapes['4h'][tapes['4h'].length - 1].c, 40, 14400, 1003, 40);
  const held = W.hgFwdResolveInfo('XAUUSD', '4h', shift(fut, 0.005), 'binance-xau');
  assert(held.changed === 0 && held.heldFeed === n, 'Binance XAU 4h bars settle none of the XM swing records (' + n + ' held)');
  assert(/PRICED ON ANOTHER FEED/.test(W.hgGoldFwdNote('goldswing', undefined, 'binance-xau')), 'the swing note says so');
  assert(W.hgFwdResolveInfo('XAUUSD', '4h', fut, 'xm-xauusd').heldFeed === 0, 'XM bars hold none');
  /* a second scan under a DIFFERENT feed label: the conviction-locked rows
     keep the feed they were priced on (the stamp fills only what is absent) */
  const r2 = await scanOnce(BASE.concat(['goldswing.js']), 'goldswing', tapes, { now: WED + 5 * 60000 }, 'binance-xau');
  assert(r2.recs.length >= 1 && r2.recs.every(x => x.feed === 'binance-xau'), 'a scan whose XM bridge reports another label records that label (' + r2.recs[0].feed + ')');
}

console.log('== 4) the other desks ==');
{
  /* GOLD ULTRA: the fetch names each leg's feed */
  const gu = sandbox({ KL_15M: 400, KL_1H: 300,
    getGoldCandles: async tf => (tf === '15m' ? { rows: [{ t: 1 }], source: 'binance-xau' } : tf === '1h' ? { rows: [{ t: 1 }], source: 'binance-paxg' } : { rows: [], source: null }),
    binanceKlines: async (sym, tf) => (tf === '4h' ? [{ t: 1 }] : []) });
  vm.runInContext(lift('goldultra.js', 'async function fetchRows(){'), gu);
  const f = await vm.runInContext('fetchRows', gu)();
  assert(f.srcByTf['15m'] === 'binance-xau' && f.srcByTf['1h'] === 'binance-paxg' && f.srcByTf['4h'] === 'binance-paxg' && !('1d' in f.srcByTf), 'GOLD ULTRA fetchRows names the feed of each leg (15m xau, 1h paxg, 4h from the PAXG fallback, 1d none)');
  assert(f.src === 'binance-xau', 'and its display label is what it always was');
  const guS = strip(read('goldultra.js'));
  assert(/var guFeed = f && f\.srcByTf && f\.srcByTf\['15m'\];\s*if \(typeof guFeed === 'string' && guFeed\) guRow\.feed = guFeed;/.test(guS), 'GOLD ULTRA records the 15m feed the borrowed scalp mint read (textual, inside the scan closure -- hg-v956)');
  assert(/hgFwdResolveMulti\('XAUUSD', \{ '15m': f\.rows15m, '1h': f\.rows1h \}, f\.srcByTf\)/.test(guS), 'GOLD ULTRA resolves each timeframe against its own feed (textual)');

  /* GOLD DIRECTION: one feed for every leg, or none */
  const gd = sandbox();
  vm.runInContext(lift('golddirection.js', 'function gdFeedUniform(gold){'), gd);
  gd.gdFeedUniform = vm.runInContext('gdFeedUniform', gd);
  assert(gd.gdFeedUniform({ src: { '15m': 'binance-xau', '1h': 'binance-xau', '4h': 'binance-xau' } }) === 'binance-xau', 'GOLD DIRECTION: legs on one feed name it');
  assert(gd.gdFeedUniform({ src: { '15m': 'binance-xau', '1h': 'binance-paxg' } }) === null, 'legs on two feeds name NONE (a mixed fetch fails open rather than naming the wrong one)');
  assert(gd.gdFeedUniform({ src: {} }) === null && gd.gdFeedUniform(null) === null && gd.gdFeedUniform({ src: { '1h': null, '4h': 'binance-xau' } }) === 'binance-xau', 'no legs -> none; an unnamed leg does not count as a second feed');
  const gdS = strip(read('golddirection.js'));
  assert(/var gdFeed = gdFeedUniform\(gold\);[\s\S]{0,700}if \(gdFeed\) row\.feed = gdFeed;/.test(gdS), 'GOLD DIRECTION records it (textual)');
  assert(/hgFwdResolveMulti\('XAUUSD', \{ '15m': gold\.rows15m, '1h': gold\.rows1h, '4h': gold\.rows4h \}, gold\.src\)/.test(gdS), 'GOLD DIRECTION resolves against gold.src (textual)');

  /* OPTI GOLD: the row builder, driven */
  const og = sandbox({ window: { hgGoldSignalBarMs: rows => rows[rows.length - 1].t * 1000 } });
  og.W = og.window;
  vm.runInContext(lift('optigold.js', 'function ogBreakBarSec(rows, s){') + '\n' + lift('optigold.js', 'function ogFwdRows(setups, lane, rows, feed){'), og);
  og.ogFwdRows = vm.runInContext('ogFwdRows', og);
  const rows = tapeEnding(WED, 30, 900, 9, 24);
  const setups = [{ dir: 'long', state: 'waiting', entry: 2300, stop: 2290, t1: 2320, i: 3 }];
  assert(og.ogFwdRows(setups, 'M15', rows, 'binance-xau')[0].feed === 'binance-xau', 'OPTI GOLD stamps the lane\'s feed on the row');
  assert(!('feed' in og.ogFwdRows(setups, 'M15', rows, null)[0]) && !('feed' in og.ogFwdRows(setups, 'M15', rows)[0]) && !('feed' in og.ogFwdRows(setups, 'M15', rows, 7)[0]), 'no feed, or a non-string, stamps nothing');
  assert(/ogFwdRows\(setups, L\.key, rows, \(got && typeof got\.source === 'string'\) \? got\.source : null\)/.test(strip(read('optigold.js'))), 'OPTI GOLD hands the lane\'s own source (textual)');

  /* NEW GOLD: the fetch wrapper, driven */
  const ngW = {};
  const ng = sandbox({ W: ngW });
  vm.runInContext(lift('newgold.js', 'function ngShellFeed(tf){') + '\n' + lift('newgold.js', 'function fetchXau(tf, n){'), ng);
  ng.fetchXau = vm.runInContext('fetchXau', ng);
  ngW.hgOgFetchRows = async () => ({ rows: [{ t: 1 }], source: 'xm-xauusd', feed: 'xm-xauusd' });
  assert((await ng.fetchXau('1h', 10)).feed === 'xm-xauusd', 'NEW GOLD carries the pack\'s feed');
  ngW.hgOgFetchRows = async () => ({ rows: [{ t: 1 }], source: 'binance-xau' });
  assert((await ng.fetchXau('1h', 10)).feed === null && (await ng.fetchXau('1h', 10)).source === 'binance-xau', 'a pack with no feed carries none (never the display label)');
  ngW.hgOgFetchRows = undefined;
  ngW.getXAUCandles = async () => [{ t: 1 }];
  ngW.S = { goldSrcByTf: { '1h': 'delta-xaut' } };
  assert((await ng.fetchXau('1h', 10)).feed === 'delta-xaut' && (await ng.fetchXau('4h', 10)).feed === null, 'the getXAUCandles branch reads the shell\'s per-timeframe record, and none for a timeframe it did not serve');
  const ngS = strip(read('newgold.js'));
  assert(/feed: \(typeof r\.feed === 'string' && r\.feed\) \? r\.feed : undefined,/.test(ngS) && /feed: tfFeed\[lane\.tf\] \|\| null,/.test(ngS) && /hgFwdResolve\('XAUUSD', rr\.tf, rr\.rows, \(typeof rr\.feed === 'string' && rr\.feed\) \? rr\.feed : undefined\)/.test(ngS), 'NEW GOLD records and resolves with it on both lanes (textual)');

  /* 80PERCENT: the record, driven against the real ledger */
  const p8 = boot(['hg-forward.js', 'eightypercent.js'], { now: WED }, undefined, null);
  const sig = { dir: 'long', tf: '1h', tfSec: 3600, t: SEC, plan: { entry: 2300, stop: 2290, t1: 2320 }, mech: 'P80' };
  assert(p8.hg80Record(sig, null, 'binance-xau').ok === true && p8.hgFwdRecords('OMNIGOLD:P80').pop().feed === 'binance-xau', '80PERCENT records the rung\'s feed');
  const sig2 = Object.assign({}, sig, { t: SEC - 3600, dir: 'short', plan: { entry: 2300, stop: 2310, t1: 2280 } });
  assert(p8.hg80Record(sig2, null).ok === true && p8.hgFwdRecords('OMNIGOLD:P80').pop().feed === undefined, 'and none when the rung named none');
  const p8S = strip(read('eightypercent.js'));
  assert(/var feed = \(got && typeof got\.feed === 'string' && got\.feed\) \? got\.feed : null;[\s\S]{0,1200}hgFwdResolve\('XAUUSD', def\.tf, rows, feed \|\| undefined\)[\s\S]{0,300}rung\.feed = feed;/.test(p8S) && /hg80Record\(r\.live\[0\], r\.cfg, r\.feed\)/.test(p8S), '80PERCENT threads the pack\'s feed to its resolve and its record (textual)');

  /* OMNIGOLD: the shared fetcher, driven both paths */
  const om = boot(['omnigold.js'], { now: WED }, undefined, null);
  om.getXAUCandles = async () => [{ t: 1, o: 1, h: 1, l: 1, c: 1 }];
  om.S = { goldSrcByTf: { '1h': 'xm-xauusd' }, goldDataSource: 'xm-xauusd' };
  let pk = await om.hgOgFetchRows('1h', 10);
  assert(pk.feed === 'xm-xauusd' && pk.source === 'xm-xauusd', 'OMNIGOLD hgOgFetchRows names the shell\'s feed for the timeframe');
  om.S = undefined;
  pk = await om.hgOgFetchRows('1h', 10);
  assert(pk.feed === null && pk.source === 'binance-xau', 'with no shell record the pack names NO feed while `source` keeps its display fallback');
  om.getXAUCandles = undefined;
  om.getXmGoldCandles = async () => ({ rows: [{ t: 1, o: 1, h: 1, l: 1, c: 1 }], source: 'xm-xauusd' });
  pk = await om.hgOgFetchRows('1h', 10);
  assert(pk.feed === 'xm-xauusd', 'the legacy chain names the bridge\'s own label');
  om.getXmGoldCandles = undefined; om.getGoldCandles = async () => ({ rows: [{ t: 1, o: 1, h: 1, l: 1, c: 1 }], source: 'binance-paxg' });
  pk = await om.hgOgFetchRows('1h', 10);
  assert(pk.feed === 'binance-paxg', 'and the gold chain\'s');
  const omS = strip(read('omnigold.js'));
  assert(/fwdResolve\('XAUUSD', null, rows, \(got && typeof got\.feed === 'string' && got\.feed\) \? got\.feed : undefined\)/.test(omS) && /feed: \(got && typeof got\.feed === 'string' && got\.feed\) \? got\.feed : undefined,/.test(omS), 'OMNIGOLD resolves and records with the pack\'s feed (textual, inside the horizon scan)');

  /* OMNIGOLD 1: the record map, driven */
  const o1 = boot(['omnigold1.js'], { now: WED }, undefined, null);
  const seen1 = [];
  o1.hgFwdRecordScan = (tab, tf, rows) => { seen1.push(...rows); return rows.length; };
  const cand = { dir: 'long', entry: 2300, stop: 2290, t1: 2320, sid: 'S0', verdict: { qualifies: true }, gradeInfo: { grade: 'A', tradeReady: true } };
  o1.hgOg1ForwardRecord([{ horizon: 'SWING', r: { ok: true, candidates: [cand], sections: { s0: { clear: true } } } }], 'delta-xaut');
  assert(seen1.length === 1 && seen1[0].feed === 'delta-xaut', 'OMNIGOLD 1 records the 1h feed it loaded');
  o1.hgOg1ForwardRecord([{ horizon: 'SWING', r: { ok: true, candidates: [cand], sections: { s0: { clear: true } } } }]);
  assert(seen1.length === 2 && seen1[1].feed === undefined, 'and none when none was loaded');
  assert(/res\('XAUUSD', null, inp\.rows1h, \(typeof inp\.feed === 'string' && inp\.feed\) \? inp\.feed : undefined\)/.test(strip(read('omnigold1.js'))) && /hgOg1ForwardRecord\(\[\{ horizon: 'SWING', r: rSwing \}, \{ horizon: 'SCALP', r: rScalp \}\], inp\.feed\)/.test(strip(read('omnigold1.js'))), 'OMNIGOLD 1 resolves and records with inp.feed (textual)');

  /* TAURIC: the price path, driven on the PACK the real fetcher returns */
  const ta = boot(['hg-forward.js', 'tauric.js'], { now: WED }, undefined, null);
  const tRows = tapeEnding(WED, 60, 14400, 11, 40);
  ta.hgPlanLevels = (dir, rows) => ({ entry: 2300, stop: dir === 'long' ? 2290 : 2310, t1: dir === 'long' ? 2320 : 2280 });
  ta.hgOgFetchRows = async () => ({ rows: tRows, source: 'xm-xauusd', feed: 'xm-xauusd' });
  const priced = await ta.hgTauricPricePlan('long');
  assert(priced.ok === true && priced.bars === tRows.length && priced.feed === 'xm-xauusd', 'TAURIC prices on the PACK hgOgFetchRows actually returns (it read rows.length on the pack and priced nothing) and carries its feed');
  ta.hgOgFetchRows = async () => tRows;
  const pricedArr = await ta.hgTauricPricePlan('long');
  assert(pricedArr.ok === true && pricedArr.feed === null, 'a bare array (the old guard\'s stub) still prices, with no feed');
  const rec = ta.hgTauricRecord({ state: 'directional', dir: 'long', label: 'buy' }, priced);
  assert(rec.ok === true && ta.hgFwdRecords('OMNIGOLD:TAURIC').pop().feed === 'xm-xauusd', 'TAURIC records the feed it priced on');

  /* GOLD PINE: its record builder, lifted and RUN against the real ledger */
  const gpx = sandbox({ W: {}, fin: v => isFinite(+v), hgGpKind: s => 'PINE-' + s.dir });
  const gpLed = boot(['hg-forward.js'], { now: WED + 5 * 60000 }, undefined, null);
  gpx.hgFwdRecordScan = gpLed.hgFwdRecordScan;
  gpx.W.hgGoldSignalBarMs = rows => rows[rows.length - 1].t * 1000;
  vm.runInContext(lift('goldpine.js', 'function hgGpRecord(list, mode, bars){'), gpx);
  const gpRec = vm.runInContext('hgGpRecord', gpx);
  const gpBars = { rows15m: tapeEnding(WED, 40, 900, 3, 24), rows4h: tapeEnding(WED - 4 * 3600000, 40, 14400, 4, 40), srcByTf: { '15m': 'binance-xau', '4h': 'binance-paxg' } };
  const gpSet = [{ dir: 'long', entry: 2300, stop: 2290, t1: 2320 }];
  assert(gpRec(gpSet, 'scalp', gpBars) === 1 && gpRec(gpSet, 'swing', gpBars) === 1, 'GOLD PINE records through its alias (REACHABILITY)');
  const gpScalp = gpLed.hgFwdRecords('GOLDPINE:scalp')[0], gpSwing = gpLed.hgFwdRecords('GOLDPINE:swing')[0];
  assert(gpScalp.feed === 'binance-xau' && gpSwing.feed === 'binance-paxg', 'each GOLD PINE lane records the feed of ITS OWN series (15m xau, 4h paxg)');
  assert(gpScalp.barT === SEC && gpSwing.barT === SEC - 14400, 'and is dated on its own signal bar, not the floor of the clock (the hg-v978 defect, on the desk that census could not see)');
  assert(gpRec(gpSet, 'scalp') === 0 && gpRec([{ dir: 'short', entry: 2300, stop: 2310, t1: 2280 }], 'scalp') === 1 && gpLed.hgFwdRecords('GOLDPINE:scalp').pop().feed === undefined, 'with no bars handed over: no feed, the clock bar, the record as before (fails open)');

  /* GOLD PRO, SUPER GOLD, and the GOLD PINE resolve: textual, inside closures or an IIFE (hg-v956) */
  const gpS = strip(read('goldpine.js'));
  assert(/fwdResolve\('XAUUSD', '4h', bars\.rows4h, bars\.srcByTf && bars\.srcByTf\['4h'\]\)/.test(gpS) && /fwdResolve\('XAUUSD', '15m', bars\.rows15m, bars\.srcByTf && bars\.srcByTf\['15m'\]\)/.test(gpS) && /out\.srcByTf\['15m'\] = feedOf\(legs\[0\]\)/.test(gpS), 'GOLD PINE resolves each timeframe against the leg\'s own feed');
  const prS = strip(read('goldpro.js'));
  assert(/lvFeed = 'perp:XAUUSDT'/.test(prS) && /lvFeed = 'perp:PAXGUSDT'/.test(prS) && /lvFeed = \(typeof g4h\.source === 'string' && g4h\.source\) \? g4h\.source : null;/.test(prS) && /feed: lvFeed \|\| undefined,/.test(prS), 'GOLD PRO names the feed at all three places the plan\'s rows can come from, and records it');
  assert(/barT: c\.barT, signalT: c\.signalT,\s*feed: c\.feed \}/.test(strip(read('super-gold.js'))), 'SUPER GOLD forwards the source desk\'s feed across its record map');
  assert(/gsStampFeed\(display, gold && gold\.src && gold\.src\['15m'\]\);/.test(strip(read('goldscalp.js'))) && /gwStampFeed\(display, gold && gold\.src && gold\.src\['4h'\]\);/.test(strip(read('goldswing.js'))), 'the home desks stamp the leg the mint priced on: 15m on SCALP, 4h on SWING');
  /* the home desks' own resolve runs BEFORE their scan records, so a single
     headless scan cannot observe it -- textual, and says so (hg-v956) */
  assert(/'4h':  gold && gold\.rows4h \}, gold && gold\.src\);/.test(strip(read('goldscalp.js'))) && /hgFwdResolve\('XAUUSD', '1h', gold\.rows1h, gold\.src && gold\.src\['1h'\]\)/.test(strip(read('goldscalp.js'))), 'GOLD SCALP resolves each timeframe against gold.src (textual)');
  assert(/'4h': gold && gold\.rows4h \}, gold && gold\.src\);/.test(strip(read('goldswing.js'))) && /hgFwdResolve\('XAUUSD', '4h', gold\.rows4h, gold\.src && gold\.src\['4h'\]\)/.test(strip(read('goldswing.js'))), 'GOLD SWING resolves each timeframe against gold.src (textual)');
}

console.log('== 5) the census, derived from source ==');
{
  /* DERIVED, NOT TYPED (hg-v954): every file that settles or writes an
     XAUUSD record is found by the CALL SHAPE -- the entry point by name or
     by the alias a file took from gfn()/W -- with comments stripped and the
     call span read to its balanced close paren, so a fourth argument that
     itself contains parens is counted, not cut. */
  function spanFrom(s, i){            /* s[i] is the '(' -- returns the span to its match */
    let d = 0, q = null;
    for (let k = i; k < s.length; k++){
      const ch = s[k];
      if (q){ if (ch === '\\') k++; else if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`'){ q = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === ')' || ch === ']' || ch === '}'){ d--; if (d === 0) return s.slice(i, k + 1); }
    }
    return s.slice(i);
  }
  function topArgs(span){             /* count top-level comma-separated args of "(...)" */
    let d = 0, q = null, n = 1, body = span.slice(1, -1).trim();
    if (!body) return 0;
    for (let k = 0; k < body.length; k++){
      const ch = body[k];
      if (q){ if (ch === '\\') k++; else if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`'){ q = ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === ')' || ch === ']' || ch === '}') d--;
      else if (ch === ',' && d === 0) n++;
    }
    return n;
  }
  function calls(s, names){
    const out = [], re = new RegExp('\\b(' + names.join('|') + ')\\s*\\(', 'g');
    let m;
    while ((m = re.exec(s))){
      const span = spanFrom(s, m.index + m[0].length - 1);
      out.push({ name: m[1], span: span, args: topArgs(span) });
    }
    return out;
  }
  const aliasesOf = (s, entry) => {
    const names = [entry], re = new RegExp("(?:var|let|const)\\s+(\\w+)\\s*=\\s*(?:gfn\\('" + entry + "'\\)|W\\." + entry + "|window\\." + entry + ")", 'g');
    let m; while ((m = re.exec(s))) names.push(m[1]);
    return names;
  };
  const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f));
  const resolvers = [], writers = [], bareResolve = [], bareWrite = [];
  for (const f of files){
    const s = strip(read(f));
    const rCalls = calls(s, aliasesOf(s, 'hgFwdResolve')).filter(c => /^\(\s*'XAUUSD'/.test(c.span));
    const mCalls = calls(s, aliasesOf(s, 'hgFwdResolveMulti')).filter(c => /^\(\s*'XAUUSD'/.test(c.span));
    if (rCalls.length || mCalls.length){
      resolvers.push(f);
      for (const c of rCalls) if (c.args < 4) bareResolve.push(f + ': ' + c.span.replace(/\s+/g, ' ').slice(0, 70));
      for (const c of mCalls) if (c.args < 3) bareResolve.push(f + ': ' + c.span.replace(/\s+/g, ' ').slice(0, 70));
    }
    /* a writer: any record call, by name or by the alias the file took, in a
       file that builds rows for XAUUSD (or SUPER GOLD's pass-through sym) */
    const wCalls = calls(s, aliasesOf(s, 'hgFwdRecordScan').concat(aliasesOf(s, 'hgFwdRecord')));
    if (wCalls.length && (/sym:\s*'XAUUSD'/.test(s) || /SUPER:GOLD/.test(s))){
      writers.push(f);
      /* the feed either sits in the record literal inside the call, or is
         assigned onto the row the call hands over (row.feed = ...) */
      const named = wCalls.some(c => /\bfeed\s*:/.test(c.span)) || /\w+\.feed = /.test(s) || /\bfeed:\s*feed\b/.test(s);
      if (!named) bareWrite.push(f);
    }
  }
  const EXP_RESOLVERS = ['eightypercent.js', 'golddirection.js', 'goldpine.js', 'goldscalp.js', 'goldswing.js', 'goldultra.js', 'newgold.js', 'omnigold.js', 'omnigold1.js'].sort();
  /* thirteen: hg-v978's census read the entry point by NAME and could not see
     GOLD PINE, which records through a local alias -- so that desk's rows
     carried neither bar nor feed until this pack */
  const EXP_WRITERS = ['eightypercent.js', 'golddirection.js', 'goldpine.js', 'goldpro.js', 'goldscalp.js', 'goldswing.js', 'goldultra.js', 'newgold.js', 'omnigold.js', 'omnigold1.js', 'optigold.js', 'super-gold.js', 'tauric.js'].sort();
  assert(JSON.stringify(resolvers.sort()) === JSON.stringify(EXP_RESOLVERS), 'the files that settle XAUUSD records are exactly the nine expected (' + resolvers.join(', ') + ')');
  assert(bareResolve.length === 0, 'every XAUUSD resolve names a feed (4 args, or 3 on the multi entry)' + (bareResolve.length ? ' -- BARE: ' + bareResolve.join(' | ') : ''));
  assert(JSON.stringify(writers.sort()) === JSON.stringify(EXP_WRITERS), 'the files that write gold records are exactly the thirteen expected (' + writers.join(', ') + ')');
  assert(bareWrite.length === 0, 'every one of them names a feed on the row' + (bareWrite.length ? ' -- BARE: ' + bareWrite.join(', ') : ''));
  /* the crypto resolvers are deliberately untouched: they name no feed and
     settle as before -- asserted so a later pack knows it was a choice */
  const cs = strip(read('cryptoscan.js'));
  assert(/hgFwdResolve\(item\.sym, '15m', rows15m\)/.test(cs), 'CRYPTO SCAN still resolves with no feed (fails open, unchanged -- the crypto desks read one venue per symbol)');
}

console.log('== 6) build stamps ==');
{
  const stamp = read('build-stamp.js');
  assert(/hg-v979/.test(stamp) && HG_VER === 'hg-v979', 'build-stamp.js is hg-v979 (' + HG_VER + ')');
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is hg-v979');
  assert(/hg-v979/.test(read('AGENTS.md')), 'AGENTS.md carries the hg-v979 entry');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
