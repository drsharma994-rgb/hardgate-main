/* HARDGATE -- hg-v976: STAR TRADER's gold lane names its feed and takes the
   shared live feed; GOLD SWING's feed label is ornamental and is said to be.

   hg-v974 fed this lane news, macro, the 1h / 4h legs and the 15m signal bar,
   and stopped at "the desk carries no feed label on this path" and no live
   feed at all. Both were reachable: the rows come through startraderCandles,
   whose gold branch walks the XM bridge -> getXAUCandles -> the macro chain
   -> Yahoo, and every leg knows its source; and stWarmContext is async, so
   the one shared loader (hg-v971) can ride on the context the lane already
   receives. Unfed, the mint TRUSTED proxy volume the GOLD SCALP desk
   distrusts, and the spread lock, the DOM rule and the OI / funding reads
   were unchecked on the vote this desk casts.

   Separately: this file's gold-tabs line said GOLD SWING passes candleSource
   "for volume-trust". The swing mint reads that field nowhere -- the board
   is byte-identical with and without it -- so the claim is corrected and the
   field is asserted unread rather than wired (hg-v966: a feed handed to an
   unmeasured rule).

   Sections:
     1) the candle chain records the gold source per timeframe, only when rows
        came back, never for a crypto contract, never across timeframes
     2) the lane, lifted through the real module: the 15m label, the live feed
        through the real applier, fails open on every seam
     3) stWarmContext loads the feed once, null on failure or absence
     4) the real mint through the real lane: an unnamed wide quote removes the
        vote, a proxy quote keeps it, a PAXG label empties the board, the
        broker label keeps it
     5) the swing label is ornamental: same board either way, asserted unread,
        the AGENTS claim corrected
     6) build stamps
   Run: node tests/test-startrader-gold-lane-fed.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files, extra){
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
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){} }
  return ctx;
}
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
const ST = ['indicators.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js'];
const REAL = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js'];
const lv = (p, s) => ({ price: p, size: s });
const BOOK = { bids: [lv(4300.4, 10), lv(4300.3, 10)], asks: [lv(4300.6, 10), lv(4300.7, 10)], venue: 'delta-xaut' };
const WIDE_UNNAMED = { quote: { spreadUsd: 0.60, bid: 4300.0, ask: 4300.6, venue: null }, l2: null, perp: null, macro: null };
const WIDE_PROXY = { quote: { spreadUsd: 0.60, bid: 4300.0, ask: 4300.6, venue: 'delta-xaut' }, l2: BOOK, perp: { ok: true, oi: [] }, macro: null };
const GOLD = { gold: true, sym: 'XAUUSD', klass: 'metal' };

console.log('== 1) the candle chain records the gold source ==');
{
  const rows = n => tapeEnding(WED, n, 900, 5, 24);
  function chain(stubs){
    const W = boot(['startrader.js'], stubs || {});
    return W;
  }
  /* XM bridge first: the broker feed, named by the payload */
  let W = chain({ getXmGoldCandles: async () => ({ rows: rows(40), source: 'xm-xauusd' }) });
  const r1 = await W.startraderCandles('XAUUSD', '15m', 30);
  assert(r1.length === 30 && W.startraderGoldSource('15m') === 'xm-xauusd', 'XM rows -> the source is the broker feed the bridge named (' + W.startraderGoldSource('15m') + ')');
  assert(W.startraderGoldSource('4h') === null, 'a timeframe nothing fetched reads null -- never invented');
  /* an XM payload without a source name still names the broker */
  W = chain({ getXmGoldCandles: async () => ({ rows: rows(40) }) });
  await W.startraderCandles('XAUUSD', '15m', 30);
  assert(W.startraderGoldSource('15m') === 'xm-xauusd', 'an XM payload with no source field is the broker feed by construction');
  /* XM empty -> getXAUCandles, and the source is the shell per-TF record, not the whole-desk label */
  W = chain({ getXmGoldCandles: async () => ({ rows: [] }), getXAUCandles: async () => rows(50),
              S: { goldDataSource: 'binance-paxg', goldSrcByTf: { '15m': 'delta-xaut', '4h': 'binance-paxg' } } });
  const r2 = await W.startraderCandles('XAUUSD', '15m', 30);
  assert(r2.length === 50 && W.startraderGoldSource('15m') === 'delta-xaut', 'getXAUCandles rows -> the shell PER-TIMEFRAME record names the feed (' + W.startraderGoldSource('15m') + '), not the last-fetched-TF label');
  await W.startraderCandles('XAUUSD', '4h', 30);
  assert(W.startraderGoldSource('4h') === 'binance-paxg' && W.startraderGoldSource('15m') === 'delta-xaut', 'a 4h fetch records the 4h source and leaves the 15m record alone');
  /* getXAUCandles with no shell record -> rows, but no label */
  W = chain({ getXAUCandles: async () => rows(50) });
  await W.startraderCandles('XAUUSD', '15m', 30);
  assert(W.startraderGoldSource('15m') === null, 'rows from getXAUCandles with no shell record -> no label invented');
  /* getXAUCandles returning nothing -> no label, even with a shell record */
  W = chain({ getXAUCandles: async () => [], S: { goldSrcByTf: { '15m': 'delta-xaut' } } });
  await W.startraderCandles('XAUUSD', '15m', 30);
  assert(W.startraderGoldSource('15m') === null, 'no rows -> no label, whatever the shell record says (a label for nothing is a lie)');
  /* the macro chain names its source on the payload */
  W = chain({ getGoldCandles: async () => ({ rows: rows(40), source: 'binance-paxg' }) });
  await W.startraderCandles('XAUUSD', '15m', 30);
  assert(W.startraderGoldSource('15m') === 'binance-paxg', 'the macro chain payload names its source (' + W.startraderGoldSource('15m') + ')');
  /* a crypto contract never touches the gold record. The first cut named
     the contract BTCUSDT, which the catalog does not carry, so the branch
     never ran and a mutation recording a gold source there SURVIVED --
     reachability is asserted first now (the catalog keys crypto as BTCUSD). */
  W = chain({ binanceKlines: async () => rows(40), getGoldCandles: async () => ({ rows: rows(40), source: 'binance-paxg' }) });
  const r4 = await W.startraderCandles('BTCUSD', '15m', 30);
  assert(Array.isArray(r4) && r4.length === 40, 'REACHABILITY: the crypto branch ran and returned rows (' + (r4 && r4.length) + ')');
  assert(W.startraderGoldSource('15m') === null, 'a crypto fetch records no gold source');
  /* the Yahoo leg: no network here, so it returns nothing and records nothing;
     its label is asserted TEXTUALLY (hg-v956) and matches macro.js's vocabulary */
  W = chain({});
  const r3 = await W.startraderCandles('XAUUSD', '15m', 30);
  assert(Array.isArray(r3) && r3.length === 0 && W.startraderGoldSource('15m') === null, 'the Yahoo leg with no network returns nothing and records nothing');
  const src = read('startrader.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(/stNoteGoldSrc\(tf, yRows, 'yahoo'\)/.test(src) && /source: 'yahoo'/.test(read('macro.js')), 'the Yahoo label is the one macro.js uses (textual, and says so)');
  assert(typeof W.startraderGoldSource === 'function' && W.startraderGoldSource() === null && W.startraderGoldSource(null) === null, 'the reader is exported and reads null on junk');
}

console.log('== 2) the lane, lifted through the real module ==');
{
  const rows15 = tapeEnding(WED, 60, 900, 6, 24), rows1h = tapeEnding(WED, 80, 3600, 7, 30), rows4h = tapeEnding(WED, 120, 14400, 8, 40);
  const SNAP = { events: [] }, MAC = { dxy: { trend20: 'FLAT' }, tnxTrend: 'FLAT' };
  function lane(stubs, ctx){
    const W = boot(['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'cryptogates.js', 'edge.js', 'setup-stack.js', 'startradertab.js']);
    const calls = [];
    W.goldScalpSetups = inp => { calls.push(inp); return []; };
    Object.assign(W, stubs || {});
    W.stContextVotes(GOLD, 'long', Object.assign({ newsState: SNAP, goldMacro: MAC }, ctx || {}), {}, rows4h, rows1h, rows15);
    return calls[0];
  }
  const a = lane({ startraderGoldSource: tf => (tf === '15m' ? 'delta-xaut' : 'binance-paxg') }, { goldLive: WIDE_PROXY });
  assert(a && a.candleSource === 'delta-xaut', 'the lane names the 15m feed the chain recorded -- the 15m record, not another timeframe (' + (a && a.candleSource) + ')');
  assert(Math.abs(a.spreadUsd - 0.60) < 1e-9 && a.spreadVenue === 'delta-xaut' && a.bid === 4300.0 && a.ask === 4300.6, 'the live quote reaches the mint input through the real applier, with its venue');
  assert(a.l2OrderBook === BOOK && a.perpNative && a.perpNative.ok === true, 'the book and the perp payload ride too');
  assert(a.macro === MAC && a.news === SNAP, 'the hg-v974 fields still ride: macro and news');
  const b = lane({ startraderGoldSource: () => null }, { goldLive: null });
  assert(b && !('candleSource' in b) && b.spreadUsd === undefined && b.l2OrderBook === undefined && b.perpNative === undefined, 'nothing recorded and no feed -> nothing named, nothing filled');
  const c = lane({}, {});
  assert(c && !('candleSource' in c) && c.spreadUsd === undefined, 'no reader on the page and no goldLive on ctx -> exactly the hg-v974 input');
  const d = lane({ startraderGoldSource: () => { throw new Error('boom'); } }, { goldLive: 'junk' });
  assert(d && !('candleSource' in d) && d.spreadUsd === undefined && d.news === SNAP, 'a throwing reader and junk on goldLive fail OPEN: the mint still runs on the rest');
  /* the applier fills only what is empty: the desk's own macro wins over the feed's */
  const e = lane({ startraderGoldSource: () => null }, { goldLive: { quote: null, l2: null, perp: null, macro: { fed: true } } });
  assert(e && e.macro === MAC, 'the feed macro does not overwrite the desk own warmed read');
}

console.log('== 3) stWarmContext loads the feed once ==');
{
  const LIVE = { quote: null, l2: null, perp: null, macro: null, __marker: 'live' };
  async function warm(stubs){
    const W = boot(ST, stubs || {});
    let n = 0;
    if (stubs && stubs.hgGoldLiveFeed) { const f = stubs.hgGoldLiveFeed; W.hgGoldLiveFeed = (...a) => { n++; return f(...a); }; }
    const ctx = await W.stWarmContext();
    return { ctx, n };
  }
  const a = await warm({ getGoldMacro: async () => ({ dxy: { trend20: 'FLAT' } }), hgGoldLiveFeed: async o => (o && o.symbol === 'XAUTUSD') ? LIVE : null });
  assert(a.ctx.goldLive === LIVE && a.n === 1, 'the feed is loaded once per warm, for the gold proxy symbol, onto ctx.goldLive');
  assert(a.ctx.goldMacro && a.ctx.goldMacro.dxy, 'the macro read still lands beside it');
  const b = await warm({ hgGoldLiveFeed: async () => { throw new Error('dead'); } });
  assert(b.ctx.goldLive === null, 'a rejecting loader -> null, never a snapshot invented');
  const c = await warm({});
  assert(c.ctx && c.ctx.goldLive === null, 'no loader on the page -> null');
  const d = await warm({ hgGoldLiveFeed: async () => undefined });
  assert(d.ctx.goldLive === null, 'an empty result -> null');
}

console.log('== 4) the real mint through the real lane ==');
{
  const s15 = tapeEnding(WED, 420, 900, 102, 24), s1h = tapeEnding(WED, 220, 3600, 103, 30), s4h = tapeEnding(WED, 140, 14400, 104, 40);
  const vote = (R, dir, ctx, rows) => (R.stContextVotes(GOLD, dir, ctx, {}, rows[2], rows[1], rows[0]).votes || []).find(x => x.src === 'GOLD SCALP');
  const R = boot(REAL);
  const open = vote(R, 'short', { newsState: null, goldLive: null }, [s15, s1h, s4h]);
  assert(open && open.dir === 'short', 'REACHABILITY: the real mint casts a GOLD SCALP short vote on seed 102');
  const locked = vote(R, 'short', { newsState: null, goldLive: WIDE_UNNAMED }, [s15, s1h, s4h]);
  assert(!locked, 'a wide UNNAMED quote on the live feed LOCKS the mint and the vote is gone -- the spread lock, reached here at last');
  const proxy = vote(R, 'short', { newsState: null, goldLive: WIDE_PROXY }, [s15, s1h, s4h]);
  assert(proxy && proxy.dir === 'short', 'the same width naming delta-xaut, with the book beside it, keeps the vote (reported, not gated)');
  /* the label: seed 120 forms two shorts unnamed and none under a PAXG label */
  const p15 = tapeEnding(WED, 420, 900, 120, 24), p1h = tapeEnding(WED, 220, 3600, 121, 30), p4h = tapeEnding(WED, 140, 14400, 122, 40);
  const u = vote(R, 'short', { newsState: null }, [p15, p1h, p4h]);
  assert(u && u.dir === 'short', 'REACHABILITY: seed 120 casts a short vote with no label');
  R.startraderGoldSource = () => 'binance-paxg';
  const x = vote(R, 'short', { newsState: null }, [p15, p1h, p4h]);
  assert(!x, 'named binance-paxg the volume votes are withheld, the board empties and the vote is gone -- parity with GOLD SCALP, which has always named its feed');
  R.startraderGoldSource = () => 'xm-xauusd';
  const m = vote(R, 'short', { newsState: null }, [p15, p1h, p4h]);
  assert(m && m.dir === 'short', 'the broker label keeps the vote');
  delete R.startraderGoldSource;
}

console.log('== 5) the swing label is ornamental, and is said to be ==');
{
  const W = boot(['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js', 'goldswing.js']);
  const b = c => [c.stratKey, c.dir, c.grade, c.agree, (c.stamps || []).join('+'), (c.notes || []).length].join('|');
  let formed = 0, same = 0, tapes = 0;
  for (const [seed, drift, dseed] of [[103, -0.3, 106], [125, 0.3, 128]]){
    const inp = () => ({ rows4h: tapeEnding(WED, 300, 14400, seed, 40, drift), rows1d: tapeEnding(WED, 150, 86400, dseed, 60, drift), now: WED });
    const a = W.goldSwingSetups(inp()), p = W.goldSwingSetups(Object.assign(inp(), { candleSource: 'binance-paxg' }));
    tapes++; formed += (a.ranked || []).length;
    if ((a.ranked || []).map(b).join('~') === (p.ranked || []).map(b).join('~')) same++;
  }
  assert(formed > 0, 'REACHABILITY: the swing mint forms on these tapes (' + formed + ' candidates)');
  assert(same === tapes, 'the swing board is byte-identical with and without a PAXG label on ' + same + ' of ' + tapes + ' tapes: the swing mint has NO volume-trust rule');
  const gw = read('goldswing.js').replace(/\/\*[\s\S]*?\*\//g, '');
  const reads = (gw.match(/candleSource/g) || []).length;
  assert(reads === 2 && /microOpts\.candleSource = gold\.src\['4h'\]/.test(gw), 'goldswing.js names candleSource at its two SET sites only -- the field is asserted unread (a later wiring must change this line and measure)');
  const ag = read('AGENTS.md');
  assert(!/gold\.src\['4h'\]` \(swing\) into setup bundles for volume-trust/.test(ag) && /the swing mint reads it nowhere/.test(ag), 'the AGENTS gold-tabs line no longer claims swing volume trust');
}

console.log('== 6) build stamps ==');
assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
