/* HARDGATE -- hg-v973: GOLD PINE's swing lane took a THIRD route into the
   swing mint that nothing fed, and both of its borrowed lanes handed the mints
   less than the desks they borrow from.

   hg-v971 fed the three borrowing desks through one applier and listed GOLD
   PINE as fed. It fed GOLD PINE's SCALP lane. The SWING lane reaches the mint
   through goldswingCollectCandidates, which called buildCandidates with NO
   microOpts (news null -> the news gate failed open, hg-v963's literal in a
   seventh place; no quote, book, venue or cost override), passed the raw news
   snapshot where a caution object was expected, and ranked with NO rows for
   the confluence scorer -- so the CONF NO TRADE demote this desk applies read
   CONF UNCHECKED there and could not fire (hg-v700's starvation, one route
   over). The scalp lane fetched daily bars and never passed them (the MTF
   matrix's Daily leg unchecked), never named its feed (so the mint TRUSTED
   PAXG volume the GOLD SCALP desk distrusts), and judged on the wall clock.
   And the adapter dropped every demote and every advisory note the mint
   wrote (hg-v955).

   Sections:
     1) the route DELEGATES: same board as goldSwingSetups, CONF NO TRADE lands,
        the news gate locks through it, the quote is read through it
     2) the pine swing lane, lifted and RUN: news, macro, feed, 4h signal bar
     3) the pine scalp lane, lifted and RUN: daily bars, feed label, 15m bar
     4) the adapter carries the mint's demote and notes; the card prints them;
        the leader rule does NOT read them (marks, withholds nothing)
     5) the real scalp mint: what the two fed fields DO -- daily bars stamp
        MTF BIAS; a PAXG label drops the volume votes (grade A -> B, and on
        one tape two candidates leave the board) -- parity, said plainly
     6) GOLD DIRECTION / GOLD ULTRA name the feed too; build stamps
   Run: node tests/test-gold-pine-lanes-fed.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){} }
  return ctx;
}
const BASE  = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js'];
const SWING = BASE.concat(['goldswing.js']);
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
const board = c => [c.entry, c.stop, c.t1, c.dir, c.stratKey, !!c.demoted, (c.stamps || []).join('+')].join('|');
const same = (a, b) => a.length === b.length && a.map(board).join('~') === b.map(board).join('~');
const lv = (p, s) => ({ price: p, size: s });
const BOOK = { bids: [lv(4300.4, 10), lv(4300.3, 10)], asks: [lv(4300.6, 10), lv(4300.7, 10)], venue: 'delta-xaut' };
const WIDE = 0.60;
const CPI = Date.UTC(2026, 3, 8, 12, 30);
const SNAP = { events: [{ title: 'US CPI m/m', t: CPI }] };
const MAC = { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' };
function lift(file, head){
  const src = read(file);
  const i = src.indexOf(head);
  assert(i > 0, file + ': ' + head.trim() + ' is findable');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j + 2);
}

console.log('== 1) the route delegates to the desk mint ==');
{
  const S = boot(SWING);
  const leg = { rows4h: tapeEnding(WED, 300, 14400, 103, 40, -0.3), rows1d: tapeEnding(WED, 150, 86400, 106, 60, -0.3) };
  const route = S.goldswingCollectCandidates(leg, { now: WED, news: null, macro: null });
  const full = (S.goldSwingSetups(Object.assign({ now: WED, news: null }, leg)) || {}).ranked || [];
  assert(route.length > 0 && route.some(c => !/^p[89]/.test(String(c.stratKey))), 'REACHABILITY: the route mints through the filter path (' + route.map(c => c.stratKey).join(', ') + ')');
  assert(same(route, full), 'the route returns the SAME board as goldSwingSetups -- levels, direction, demotion and every stamp (' + route.length + ' rows)');
  assert(route.every(c => (c.stamps || []).indexOf('CONF NO TRADE') >= 0 && c.demoted) && !route.some(c => (c.stamps || []).indexOf('CONF UNCHECKED') >= 0), 'the confluence scorer is FED through the route: CONF NO TRADE demotes land where CONF UNCHECKED used to read (' + route.map(c => (c.stamps || []).filter(s => /CONF/.test(s)).join('/')).join(', ') + ')');
  assert(route.every(c => (c.stamps || []).some(s => /^S23 /.test(s))), 'and the S23 regime read lands too');
  const locked = S.goldswingCollectCandidates(leg, { now: CPI - 10 * 60000, news: SNAP });
  const released = S.goldswingCollectCandidates(leg, { now: CPI + 3 * 3600000, news: SNAP });
  assert(locked.length === 0 && released.length > 0, 'the NEWS GATE is reached through the route: 10 min before CPI mints nothing, 3h after mints again (' + released.length + ')');
  const unnamed = S.goldswingCollectCandidates(leg, { now: WED, spreadUsd: WIDE, bid: 4300.4, ask: 4301 });
  const named = S.goldswingCollectCandidates(leg, { now: WED, spreadUsd: WIDE, bid: 4300.4, ask: 4301, spreadVenue: 'delta-xaut' });
  assert(unnamed.length === 0, 'the SPREAD LOCK is reached through the route: a wide unnamed quote locks every candidate');
  assert(same(named, route) && named.every(c => (c.notes || []).some(n => /SPREAD WIDE/.test(n) && /delta-xaut/.test(n))), 'a wide PROXY quote moves no board and lands the SPREAD WIDE read on every card -- the hg-v968 venue rule now reaches this lane');
  const booked = S.goldswingCollectCandidates(leg, { now: WED, l2OrderBook: BOOK });
  assert(same(booked, route) && booked.every(c => (c.notes || []).some(n => /L2 READ/.test(n))), 'the L2 book is reached through the route: a proxy book reports and moves nothing');
  const SAT = Date.UTC(2026, 3, 11, 12, 0, 0);
  const sat = S.goldswingCollectCandidates({ rows4h: tapeEnding(SAT, 300, 14400, 103, 40, -0.3), rows1d: tapeEnding(SAT, 150, 86400, 106, 60, -0.3) }, { now: SAT });
  assert(sat.length > 0 && sat.every(c => c.goldShut === true), 'the hg-v953 weekend mark is reached through the route (' + sat.length + ' rows marked shut on a Saturday bar)');
  /* the daily leg reaches the mint through the route: seed 125 on a rising
     tape mints a weekly-range break ONLY when the daily bars are present */
  const leg125 = { rows4h: tapeEnding(WED, 300, 14400, 125, 40, 0.3), rows1d: tapeEnding(WED, 150, 86400, 128, 60, 0.3) };
  const r125 = S.goldswingCollectCandidates(leg125, { now: WED });
  const f125 = (S.goldSwingSetups(Object.assign({ now: WED }, leg125)) || {}).ranked || [];
  const n125 = (S.goldSwingSetups({ now: WED, rows4h: leg125.rows4h }) || {}).ranked || [];
  assert(f125.length === 1 && f125[0].stratKey === 'wkbreak' && n125.length === 0, 'REACHABILITY: seed 125 mints wkbreak with the daily bars and nothing without them');
  assert(same(r125, f125), 'the route hands the DAILY bars to the mint (wkbreak forms through it)');
  assert(S.goldswingCollectCandidates(null, null).length === 0 && S.goldswingCollectCandidates({}, {}).length === 0, 'junk in, empty out, no throw');
  const src = read('goldswing.js');
  const i = src.indexOf('W.goldswingCollectCandidates = function(leg, ctx){');
  const body = src.slice(i, src.indexOf('\n};\n', i)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert(/goldSwingSetups\(/.test(body) && !/buildCandidates\(/.test(body) && !/rankSetups\(/.test(body), 'ONE route: the export calls goldSwingSetups and no longer builds or ranks on its own');
}

console.log('== 2) the pine swing lane, lifted and run ==');
{
  const W = boot(BASE);
  const rows4 = tapeEnding(WED, 80, 14400, 5, 40), rows15 = tapeEnding(WED, 60, 900, 6, 24);
  const feed = { quote: { spreadUsd: WIDE, bid: 4300.4, ask: 4301, venue: 'delta-xaut' }, l2: BOOK, perp: null, macro: { fed: true }, venue: 'delta-xaut' };
  function sandbox(rec){
    const sb = { console: { log(){} }, isFinite, isNaN, Math, Number, String, Object, Array, JSON, Date, Promise, Error,
      gfn: n => (n === 'goldswingCollectCandidates' || n === 'goldScalpSetups') ? rec : (n === 'hgGoldApplyLiveFeed' ? W.hgGoldApplyLiveFeed : (n === 'hgGoldSignalBarMs' ? W.hgGoldSignalBarMs : null)),
      setupFromNative: () => null, fin: v => Number.isFinite(v) };
    vm.createContext(sb);
    vm.runInContext(lift('goldpine.js', 'function gpMintBarMs(rows, fallback){'), sb, { filename: 'goldpine.js:gpMintBarMs' });
    return sb;
  }
  const WALL = WED + 7 * 3600000;   /* a wall clock seven hours past the last bar */
  const barMs4 = rows4[rows4.length - 1].t * 1000;
  {
    const calls = []; const sb = sandbox((leg, ctx) => { calls.push({ leg, ctx }); return []; });
    vm.runInContext(lift('goldpine.js', 'function collectNativeSwing(bars, ctx, source){'), sb, { filename: 'goldpine.js:collectNativeSwing' });
    sb.collectNativeSwing({ rows4h: rows4, rows1d: rows15, rows1h: rows15, live: feed }, { now: WALL, news: SNAP, macro: MAC, spot: { x: 1 } }, 'test');
    assert(calls.length === 1 && calls[0].leg.rows4h === rows4 && calls[0].leg.rows1d === rows15, 'the lane calls the route once with the desk bars');
    const c = calls[0].ctx;
    assert(c.news === SNAP, 'the route ctx CARRIES the desk news snapshot (it was in scanCtx; the route now reads it)');
    assert(c.macro === MAC, 'and the desk macro read, which wins over the feed macro');
    assert(Math.abs(c.spreadUsd - WIDE) < 1e-9 && c.spreadVenue === 'delta-xaut' && c.l2OrderBook === BOOK, 'and the shared live feed: quote, venue, book');
    assert(c.now === barMs4 && c.now !== WALL, 'the instant is the 4h SIGNAL BAR, not the wall clock');
    assert(c.spot && c.spot.x === 1, 'the rest of the scan context still rides along');
  }
  {
    const calls = []; const sb = sandbox((leg, ctx) => { calls.push({ leg, ctx }); return []; });
    vm.runInContext(lift('goldpine.js', 'function collectNativeSwing(bars, ctx, source){'), sb, { filename: 'goldpine.js:collectNativeSwing2' });
    sb.collectNativeSwing({ rows4h: rows4, rows1d: [], rows1h: [], live: null }, { now: WALL, news: null, macro: null }, 'test');
    const c = calls[0].ctx;
    assert(calls.length === 1 && c.spreadUsd === undefined && c.l2OrderBook === undefined && c.macro === null && c.news === null, 'with no feed and no reads the ctx carries nothing invented');
    const calls3 = []; const sb3 = sandbox((leg, ctx) => { calls3.push({ leg, ctx }); return []; });
    vm.runInContext(lift('goldpine.js', 'function collectNativeSwing(bars, ctx, source){'), sb3, { filename: 'goldpine.js:collectNativeSwing3' });
    sb3.collectNativeSwing({ rows4h: rows4, live: feed }, { now: WALL, macro: null }, 'test');
    assert(calls3[0].ctx.macro === feed.macro, 'with no desk macro the feed macro fills it (hg-v972 applier, same seam)');
    const calls4 = []; const sb4 = sandbox((leg, ctx) => { calls4.push({ leg, ctx }); return []; });
    vm.runInContext(lift('goldpine.js', 'function collectNativeSwing(bars, ctx, source){'), sb4, { filename: 'goldpine.js:collectNativeSwing4' });
    sb4.collectNativeSwing({ rows4h: [{ o: 1, h: 1, l: 1, c: 1, v: 1 }].concat(new Array(70).fill({ t: 'x', o: 1, h: 1, l: 1, c: 1, v: 1 })), live: null }, { now: WALL }, 'test');
    assert(calls4.length === 1 && calls4[0].ctx.now === WALL, 'a series with no readable instant falls back to the caller clock');
  }
}

console.log('== 3) the pine scalp lane, lifted and run ==');
{
  const W = boot(BASE);
  const rows15 = tapeEnding(WED, 60, 900, 6, 24), rows1d = tapeEnding(WED, 30, 86400, 7, 60);
  const barMs15 = rows15[rows15.length - 1].t * 1000, WALL = WED + 7 * 3600000;
  const feed = { quote: { spreadUsd: WIDE, bid: 4300.4, ask: 4301, venue: 'delta-xaut' }, l2: BOOK, perp: null, macro: { fed: true }, venue: 'delta-xaut' };
  function sandbox(rec){
    const sb = { console: { log(){} }, isFinite, isNaN, Math, Number, String, Object, Array, JSON, Date, Promise, Error,
      gfn: n => (n === 'goldScalpSetups') ? rec : (n === 'hgGoldApplyLiveFeed' ? W.hgGoldApplyLiveFeed : (n === 'hgGoldSignalBarMs' ? W.hgGoldSignalBarMs : null)),
      setupFromNative: () => null, fin: v => Number.isFinite(v) };
    vm.createContext(sb);
    vm.runInContext(lift('goldpine.js', 'function gpMintBarMs(rows, fallback){'), sb, { filename: 'goldpine.js:gpMintBarMs' });
    return sb;
  }
  const calls = []; const sb = sandbox(inp => { calls.push(inp); const out = []; out.rejected = []; return out; });
  vm.runInContext(lift('goldpine.js', 'function collectNativeScalp(bars, ctx, source){'), sb, { filename: 'goldpine.js:collectNativeScalp' });
  sb.collectNativeScalp({ rows15m: rows15, rows1h: rows15, rows4h: rows15, rows1d: rows1d, source: 'binance-paxg', live: feed }, { now: WALL, news: SNAP, macro: MAC }, 'test');
  const inp = calls[0];
  assert(calls.length === 1 && inp.dailyCandles === rows1d, 'the DAILY bars this desk fetched reach the mint (the MTF Daily leg can run)');
  assert(inp.candleSource === 'binance-paxg', 'the FEED LABEL reaches the mint (volume trust can be decided)');
  assert(inp.now === barMs15 && inp.now !== WALL, 'the instant is the 15m SIGNAL BAR, not the wall clock');
  assert(inp.news === SNAP && inp.macro === MAC && Math.abs(inp.spreadUsd - WIDE) < 1e-9 && inp.l2OrderBook === BOOK, 'news, macro, quote and book still arrive (hg-v971 / hg-v972 unchanged)');
  const calls2 = []; const sb2 = sandbox(inp => { calls2.push(inp); const out = []; out.rejected = []; return out; });
  vm.runInContext(lift('goldpine.js', 'function collectNativeScalp(bars, ctx, source){'), sb2, { filename: 'goldpine.js:collectNativeScalp2' });
  sb2.collectNativeScalp({ rows15m: rows15, rows1h: rows15, rows4h: rows15, rows1d: [], source: null, live: null }, { now: WALL }, 'test');
  assert(calls2.length === 1 && calls2[0].dailyCandles === undefined && calls2[0].candleSource === undefined, 'no daily bars and no label: neither key is invented');
}

console.log('== 4) the adapter carries the mint verdicts; the card prints them; the leader rule ignores them ==');
{
  const sb = { console: { log(){} }, isFinite, Math, Number, String, Object, Array, JSON, PINE_GOLD_MAX: 10, fin: v => Number.isFinite(v),
    esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
  vm.createContext(sb);
  vm.runInContext(lift('goldpine.js', 'function setupFromNative(c, mode, source, forming){'), sb, { filename: 'goldpine.js:setupFromNative' });
  vm.runInContext(lift('goldpine.js', 'function gpMintMarkChipHtml(s){'), sb, { filename: 'goldpine.js:chip' });
  vm.runInContext(lift('goldpine.js', 'function gpMintNotesHtml(s){'), sb, { filename: 'goldpine.js:notes' });
  vm.runInContext(lift('goldpine.js', 'function gpTapeAligned(list){'), sb, { filename: 'goldpine.js:tapeAligned' });
  const dem = sb.setupFromNative({ dir: 'short', stratKey: 'bos', entry: 1, stop: 2, t1: 0, demoted: true, stamps: ['CONF NO TRADE', 'S23 TREND'], notes: ['SPREAD WIDE — 0.60 on delta-xaut'] }, 'swing', 'GOLD', false);
  assert(dem.mintDemoted === true && dem.mintDemotedWhy === 'CONF NO TRADE · S23 TREND', 'a demoted mint candidate carries the mark and the stamps that name it');
  assert(Array.isArray(dem.mintNotes) && dem.mintNotes[0] === 'SPREAD WIDE — 0.60 on delta-xaut', 'and the advisory note the mint wrote');
  const why = sb.setupFromNative({ dir: 'long', stratKey: 'x', entry: 1, stop: 0, t1: 2, demoted: true, demotedWhy: 'no record on this desk', stamps: ['A'] }, 'scalp', 'GOLD', false);
  assert(why.mintDemotedWhy === 'no record on this desk', 'a mint that says WHY is quoted over the stamps');
  const clean = sb.setupFromNative({ dir: 'long', stratKey: 'x', entry: 1, stop: 0, t1: 2 }, 'scalp', 'GOLD', false);
  assert(clean.mintDemoted === false && clean.mintDemotedWhy === null && clean.mintNotes.length === 0, 'a clean candidate carries no mark and no notes');
  assert(clean.entry === 1 && clean.stop === 0 && clean.t1 === 2 && clean.dir === 'long', 'levels and direction are untouched');
  const chip = sb.gpMintMarkChipHtml(dem);
  assert(/MINT DEMOTED/.test(chip) && /CONF NO TRADE/.test(chip), 'the card chip names the demote: ' + chip.replace(/<[^>]+>/g, '').trim());
  assert(sb.gpMintMarkChipHtml(clean) === '' && sb.gpMintMarkChipHtml(null) === '', 'no chip on a clean row or junk');
  assert(/SPREAD WIDE/.test(sb.gpMintNotesHtml(dem)) && sb.gpMintNotesHtml(clean) === '', 'the notes line prints the advisory once, and nothing on a clean row');
  const chipX = sb.gpMintMarkChipHtml({ mintDemoted: true, mintDemotedWhy: '<b>x</b>' });
  assert(!/<b>/.test(chipX) && /&lt;b&gt;/.test(chipX), 'the why is escaped into the chip');
  /* the leader rule: a demoted mint row with no tape still passes gpTapeAligned -- this pack MARKS and withholds nothing */
  const kept = sb.gpTapeAligned([dem, clean]);
  assert(kept.length === 2, 'gpTapeAligned does NOT read the mint demote: both rows may still lead (the leader policy is this tab\'s own and is untouched)');
  const src = read('goldpine.js').replace(/\/\*[\s\S]*?\*\//g, '');
  const ta = src.slice(src.indexOf('function gpTapeAligned('), src.indexOf('\n}\n', src.indexOf('function gpTapeAligned(')));
  const so = src.slice(src.indexOf('function sortSetups('), src.indexOf('\n}\n', src.indexOf('function sortSetups(')));
  const ps = src.slice(src.indexOf('function probScore('), src.indexOf('\n}\n', src.indexOf('function probScore(')));
  assert(!/mintDemoted/.test(ta) && !/mintDemoted/.test(so) && !/mintDemoted/.test(ps), 'nor do sortSetups / probScore -- the mark is read by the card only (textual, hg-v956)');
  /* the CALL SITES, not the definitions -- the first cut matched the name and
     the function header satisfied it while the card called neither (both
     survived mutation). Bounded to the concatenation shape inside cardHTML;
     deliberately textual (hg-v956), cardHTML is DOM-shaped and not lifted. */
  const card = src.slice(src.indexOf('function cardHTML('), src.indexOf('\nfunction sectionHTML('));
  assert(/gpTapeChipHtml\(s\) \+ gpMintMarkChipHtml\(s\)/.test(card), 'the card header concatenates the demote chip');
  assert(/\n    \+ gpMintNotesHtml\(s\)\n/.test(card), 'and the card body concatenates the notes line');
}

console.log('== 5) the real scalp mint: what the two fed fields do ==');
{
  const C = boot(BASE);
  const inp = (seed, extra) => Object.assign({ rows15m: tapeEnding(WED, 420, 900, seed, 24), rows1h: tapeEnding(WED, 220, 3600, seed + 1, 30), rows4h: tapeEnding(WED, 140, 14400, seed + 2, 40), now: WED, news: null }, extra || {});
  const bare = C.goldScalpSetups(inp(106)) || [];
  const daily = C.goldScalpSetups(inp(106, { dailyCandles: tapeEnding(WED, 120, 86400, 109, 60) })) || [];
  assert(bare.length === 1 && bare[0].dir === 'long' && !(bare[0].stamps || []).some(s => /^MTF/.test(s)), 'REACHABILITY: seed 106 forms one long with no MTF stamp when no daily bars are handed over');
  assert(daily.length === 1 && (daily[0].stamps || []).indexOf('MTF BIAS') >= 0, 'with the daily bars the MTF matrix runs and stamps MTF BIAS on that long -- the leg GOLD PINE never fed');
  const desc = c => c.dir + ':' + c.stratKey + ':' + c.agree + ':' + c.grade;
  const xm = C.goldScalpSetups(inp(118, { candleSource: 'xm-xauusd' })) || [];
  const px = C.goldScalpSetups(inp(118, { candleSource: 'binance-paxg' })) || [];
  const none = C.goldScalpSetups(inp(118)) || [];
  assert(xm.length === 4 && xm.map(desc).join('~') === none.map(desc).join('~'), 'REACHABILITY: seed 118 forms four candidates, and an UNNAMED feed reads exactly like the broker feed -- proxy volume trusted by default');
  assert(px.length === 4 && px.every((c, i) => c.agree === xm[i].agree - 1) && px.filter(c => c.grade === 'B').length === 2 && xm.every(c => c.grade === 'A'), 'named binance-paxg: the squeeze / MFI volume votes are withheld, every candidate loses one agreeing read and two fall from grade A to B');
  const xm120 = C.goldScalpSetups(inp(120, { candleSource: 'xm-xauusd' })) || [];
  const px120 = C.goldScalpSetups(inp(120, { candleSource: 'binance-paxg' })) || [];
  assert(xm120.length === 2 && px120.length === 0, 'and on seed 120 the same rule takes two candidates OFF the board -- this pack can remove candidates on GOLD PINE / GOLD ULTRA / GOLD DIRECTION, which read PAXG / XAUT bars and never said so');
  assert(C.goldMFI(tapeEnding(WED, 40, 900, 3, 24), { volumeTrusted: false }).last === 'NONE' && C.goldVolSqueeze(tapeEnding(WED, 60, 900, 3, 24), { volumeTrusted: false }).state === 'NONE', 'the two volume reads return NONE on untrusted volume (the pre-existing rule, unchanged)');
  const src = read('goldind.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(/paxg\|xaut\|binance-paxg\|binance-xaut/.test(src), 'the proxy-venue pattern is unchanged');
}

console.log('== 6) GOLD DIRECTION / GOLD ULTRA name the feed; build stamps ==');
{
  const W = boot(BASE);
  const rows = [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }];
  function sandbox(rec){
    const sb = { console: { log(){} }, isFinite, isNaN, Math, Number, String, Object, Array, JSON, Date, Promise, Error,
      gfn: n => (n === 'goldScalpSetups') ? rec : (n === 'hgGoldApplyLiveFeed' ? W.hgGoldApplyLiveFeed : null),
      heldLine: () => '', gdNewsCtx: () => ({ at: Date.now(), snap: null }), normCand: () => ({}) };
    vm.createContext(sb);
    return sb;
  }
  const calls = []; const sb = sandbox(inp => { calls.push(inp); const out = []; out.rejected = []; return out; });
  vm.runInContext(lift('golddirection.js', 'async function laneGoldScalp(gold, now){'), sb, { filename: 'golddirection.js:laneGoldScalp' });
  await sb.laneGoldScalp({ rows15m: rows, rows1h: rows, rows4h: rows, rows1d: rows, source: 'delta-xaut', live: null }, Date.now());
  assert(calls.length === 1 && calls[0].candleSource === 'delta-xaut', 'GOLD DIRECTION scalp lane: the feed label reaches the mint');
  const calls2 = []; const sb2 = sandbox(inp => { calls2.push(inp); const out = []; out.rejected = []; return out; });
  vm.runInContext(lift('goldultra.js', 'async function laneGoldScalp(gold, now){'), sb2, { filename: 'goldultra.js:laneGoldScalp' });
  await sb2.laneGoldScalp({ rows15m: rows, rows1h: rows, rows4h: rows, rows1d: rows, src: 'binance-paxg', live: null }, Date.now());
  assert(calls2.length === 1 && calls2[0].candleSource === 'binance-paxg', 'GOLD ULTRA scalp lane: the feed label reaches the mint');
  assert(/scalpBundle\.candleSource = gold\.src\['15m'\]/.test(read('goldscalp.js')), 'GOLD SCALP itself has always named its feed -- this is parity with the desk the mints belong to');
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
