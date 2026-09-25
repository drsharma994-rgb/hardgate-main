/* HARDGATE -- hg-v971: the live gold feed reaches every desk that mints
   through the shared gold mints, and the venue reaches the filter.

   hg-v968 fed the quote and hg-v970 the book, each from the Delta payload
   GOLD SCALP and GOLD SWING fetch. Two things were still wrong, both in my own
   packs. (1) On those two desks the quote the perp handler put on `ctx` was
   NEVER copied into the bundle the mint reads -- so the spread lock had still
   never received a quote there (hg-v932: fed to a seam that dropped it).
   (2) The mints' own institutional-filter context omitted the venue, so a
   quote that did arrive would have LOCKED rather than been reported: the
   hg-v968 proxy rule was unreachable through the mint. And GOLD PINE,
   GOLD ULTRA and GOLD DIRECTION borrow those mints and fetch no payload.

   Sections:
     1) hgGoldApplyLiveFeed: fills only what is empty; a broker quote / book wins
     2) hgGoldLiveFeed: one loader, both readers, null on every failure, timeout
     3) the REAL mints: a wide PROXY quote reports and moves no board; the same
        quote unnamed or on the broker venue LOCKS (the pre-existing rule)
     4) the fed desks: the handler keeps the whole quote, the bundle applies it
     5) the borrowing desks: each lane, lifted and RUN, hands the feed to the mint
     6) still zero writers of the globals; build stamps
   Run: node tests/test-gold-live-feed-reaches-mints.mjs */
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
const WIDE = 0.60, NARROW = 0.10;
const lv = (p, s) => ({ price: p, size: s });
const BOOK = { bids: [lv(4300.4, 10), lv(4300.3, 10)], asks: [lv(4300.6, 10), lv(4300.7, 10)] };
const PERP = { ok: true, ticker: { bid: 4300.40, ask: 4301.00, spreadUsd: WIDE }, l2: BOOK, oi: [], funding: [] };

console.log('== 1) the applier fills only what is empty ==');
{
  const W = boot(BASE);
  assert(typeof W.hgGoldApplyLiveFeed === 'function', 'hgGoldApplyLiveFeed is exported');
  const feed = { quote: { spreadUsd: WIDE, bid: 4300.4, ask: 4301, venue: 'delta-xaut' }, l2: Object.assign({ venue: 'delta-xaut' }, BOOK), perp: PERP };
  const a = W.hgGoldApplyLiveFeed({}, feed);
  assert(Math.abs(a.spreadUsd - WIDE) < 1e-9 && a.bid === 4300.4 && a.ask === 4301 && a.spreadVenue === 'delta-xaut', 'an empty input takes the quote and its venue');
  assert(a.l2OrderBook === feed.l2 && a.perpNative === PERP, 'and the book and the payload');
  const b = W.hgGoldApplyLiveFeed({ spreadUsd: 0.1, spreadVenue: 'xm' }, feed);
  assert(Math.abs(b.spreadUsd - 0.1) < 1e-9 && b.spreadVenue === 'xm' && b.bid === undefined, 'a broker quote already there WINS -- nothing overwritten');
  const c = W.hgGoldApplyLiveFeed({ bid: 4300.5, ask: 4300.6 }, feed);
  assert(c.spreadUsd === undefined && c.bid === 4300.5 && c.spreadVenue === undefined, 'a bid/ask pair already there counts as a quote and wins');
  const d = W.hgGoldApplyLiveFeed({ l2OrderBook: BOOK }, feed);
  assert(d.l2OrderBook === BOOK, 'a book already there wins');
  const e = W.hgGoldApplyLiveFeed({}, { quote: null, l2: null, perp: null });
  assert(e.spreadUsd === undefined && e.l2OrderBook === undefined && e.perpNative === undefined, 'an empty feed changes nothing');
  const f = W.hgGoldApplyLiveFeed({}, { quote: { spreadUsd: null, bid: 4300.4, ask: 4301, venue: 'delta-xaut' } });
  assert(f.spreadUsd === undefined && f.spreadVenue === undefined, 'a quote with no spread is no quote (null is not zero)');
  const g = W.hgGoldApplyLiveFeed({}, { perp: { ok: false } });
  assert(g.perpNative === undefined, 'a failed payload is not attached');
  const h = W.hgGoldApplyLiveFeed({}, null), h2 = W.hgGoldApplyLiveFeed(null, feed);
  assert(h && Object.keys(h).length === 0 && h2 === null, 'junk in, input back, no throw');
}

console.log('== 2) the loader: one payload, both readers, null on every failure ==');
{
  const W = boot(BASE);
  assert(typeof W.hgGoldLiveFeed === 'function', 'hgGoldLiveFeed is exported');
  const src = read('goldind.js');
  const i = src.indexOf('function hgGoldLiveFeed(');
  const body = src.slice(i, src.indexOf('\nfunction hgGoldApplyLiveFeed', i));
  assert(/hgGoldQuoteFromPerp\(/.test(body) && /hgGoldL2FromPerp\(/.test(body), 'the loader reads through the two existing readers, not a third parser');
  /* the loader closes over the module-scope loader, so drive it by replacing
     the fetch the module-scope loader calls */
  const drive = async (fetchImpl, opts) => {
    W.fetch = fetchImpl;
    return W.hgGoldLiveFeed(opts);
  };
  const okFetch = () => Promise.resolve({ json: () => Promise.resolve(PERP) });
  const r = await drive(okFetch, {});
  assert(r && r.quote && Math.abs(r.quote.spreadUsd - WIDE) < 1e-9 && r.quote.venue === 'delta-xaut', 'a good payload yields the quote, venue-stamped');
  assert(r.l2 && r.l2.bids.length === 2 && r.l2.venue === 'delta-xaut', 'and the book, venue-stamped');
  assert(r.perp === PERP && r.venue === 'delta-xaut', 'and the payload itself');
  const r2 = await drive(() => Promise.resolve({ json: () => Promise.resolve({ ok: false }) }), {});
  assert(r2 && r2.quote === null && r2.l2 === null, 'a failed payload: null quote, null book, no throw');
  const r3 = await drive(() => Promise.reject(new Error('down')), {});
  assert(r3 && r3.quote === null && r3.l2 === null, 'a rejecting fetch: nulls, no throw');
  const r4 = await drive(() => new Promise(() => {}), { timeoutMs: 30 });
  assert(r4 && r4.quote === null && r4.perp === null, 'a hanging fetch: nulls after the timeout -- a desk never waits forever on a quote');
  const r5 = await drive(okFetch, { venue: 'xm' });
  assert(r5.quote.venue === 'xm', 'the venue is a parameter, not baked');
}

console.log('== 3) the REAL mints: the venue now reaches the filter ==');
{
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
  const SCALP_SEED = 102, SWING_SEED = 103, SWING_DRIFT = -0.3;   /* the hg-v970 seeds: both mint through the path that carries the filter */
  const scalpInp = extra => Object.assign({ rows15m: tapeEnding(WED, 420, 900, SCALP_SEED, 24), rows1h: tapeEnding(WED, 220, 3600, SCALP_SEED + 1, 30),
    rows4h: tapeEnding(WED, 140, 14400, SCALP_SEED + 2, 40), dailyCandles: tapeEnding(WED, 120, 86400, SCALP_SEED + 3, 60), now: WED, news: null, candleSource: 'binance-paxg' }, extra || {});
  const swingInp = extra => Object.assign({ rows4h: tapeEnding(WED, 300, 14400, SWING_SEED, 40, SWING_DRIFT), rows1d: tapeEnding(WED, 150, 86400, SWING_SEED + 3, 60, SWING_DRIFT), now: WED, news: null }, extra || {});
  const board = c => [c.entry, c.stop, c.t1, c.dir, c.stratKey, !!c.demoted, !!c.vetoed].join('|');

  const C = boot(BASE);
  const none = C.goldScalpSetups(scalpInp()) || [];
  assert(none.length > 0, 'REACHABILITY: the scalp mint forms candidates with no quote (' + none.length + ')');
  const proxy = C.goldScalpSetups(scalpInp({ spreadUsd: WIDE, bid: 4300.4, ask: 4301, spreadVenue: 'delta-xaut' })) || [];
  assert(proxy.length === none.length && proxy.map(board).join('~') === none.map(board).join('~'), 'GOLD SCALP mint: a WIDE quote on the PROXY venue moves NO board (' + proxy.length + ' = ' + none.length + ')');
  assert(proxy.every(c => Array.isArray(c.notes) && c.notes.some(n => /SPREAD WIDE/.test(n) && /delta-xaut/.test(n))), 'GOLD SCALP mint: every card carries the SPREAD WIDE read naming the venue');
  const unnamed = C.goldScalpSetups(scalpInp({ spreadUsd: WIDE, bid: 4300.4, ask: 4301 })) || [];
  assert(unnamed.length === 0 && (unnamed.rejected || []).some(r => /SPREAD LOCK/.test(r.reason || '')), 'GOLD SCALP mint: the same quote UNNAMED locks every candidate -- the pre-existing rule, and what the missing venue seam would have done to a live proxy quote');
  const broker = C.goldScalpSetups(scalpInp({ spreadUsd: WIDE, spreadVenue: 'xm' })) || [];
  assert(broker.length === 0, 'GOLD SCALP mint: a wide BROKER quote still locks');
  const narrow = C.goldScalpSetups(scalpInp({ spreadUsd: NARROW, spreadVenue: 'delta-xaut' })) || [];
  assert(narrow.length === none.length && !narrow.some(c => (c.notes || []).some(n => /SPREAD/.test(n))), 'GOLD SCALP mint: a narrow proxy quote passes silently');

  const S = boot(SWING);
  const swNone = (S.goldSwingSetups(swingInp()) || {}).ranked || [];
  assert(swNone.length > 0 && swNone.some(c => !/^p[89]/.test(String(c.stratKey))), 'REACHABILITY: the swing mint forms candidates through the filter path (' + swNone.map(c => c.stratKey).join(', ') + ')');
  const swProxy = (S.goldSwingSetups(swingInp({ spreadUsd: WIDE, bid: 4300.4, ask: 4301, spreadVenue: 'delta-xaut' })) || {}).ranked || [];
  assert(swProxy.length === swNone.length && swProxy.map(board).join('~') === swNone.map(board).join('~'), 'GOLD SWING mint: a WIDE proxy quote moves NO board (' + swProxy.length + ' = ' + swNone.length + ')');
  assert(swProxy.every(c => Array.isArray(c.notes) && c.notes.some(n => /SPREAD WIDE/.test(n))), 'GOLD SWING mint: every card carries the SPREAD WIDE read');
  const swUnnamed = (S.goldSwingSetups(swingInp({ spreadUsd: WIDE })) || {}).ranked || [];
  assert(swUnnamed.length === 0, 'GOLD SWING mint: the same quote UNNAMED locks every candidate (' + swUnnamed.length + ')');
  /* bid/ask alone (no spreadUsd) is a quote too -- the applier and both mints agree on that */
  const swPair = (S.goldSwingSetups(swingInp({ bid: 4300.4, ask: 4301, spreadVenue: 'delta-xaut' })) || {}).ranked || [];
  assert(swPair.length === swNone.length && swPair.every(c => (c.notes || []).some(n => /SPREAD WIDE/.test(n))), 'GOLD SWING mint: a bid/ask pair without spreadUsd is read as the same wide proxy quote');
}

console.log('== 4) the fed desks: the handler keeps the quote, the bundle applies it ==');
{
  const W = boot(BASE);
  for (const [desk, file, bundle] of [['GOLD SCALP', 'goldscalp.js', 'scalpBundle'], ['GOLD SWING', 'goldswing.js', 'microOpts']]){
    const src = read(file);
    const i = src.indexOf('.then(function(j){\n            ctx.perpNative = j;');
    assert(i > 0, desk + ': the perp handler is findable');
    const body = src.slice(i, src.indexOf('}).catch(function(){}));', i));
    const stmt = '(function(j){' + body.slice(body.indexOf('{', body.indexOf('function(j)')) + 1) + '})';
    const ctx = {};
    const sb = { ctx, isFinite, console: { log(){} }, gfn: n => W[n], Math, Number, String, Object, JSON };
    vm.createContext(sb);
    vm.runInContext(stmt, sb, { filename: file + ':perp' })(PERP);
    assert(ctx.quote && Math.abs(ctx.quote.spreadUsd - WIDE) < 1e-9 && ctx.quote.venue === 'delta-xaut', desk + ': the handler keeps the WHOLE quote on ctx.quote for the applier');
    assert(ctx.l2Book && ctx.l2Book.venue === 'delta-xaut', desk + ': and the book');
    /* the bundle seam, LIFTED AND RUN rather than grepped: the first cut of
       this section matched the applier call in the source and an `if (false)`
       in front of it survived mutation -- the grep-satisfiable shape one more
       time. The real bundle-build block is executed under stubs, once with an
       empty global (the proxy quote must land) and once with a broker quote on
       the global (it must win). */
    const startMark = 'var ' + bundle + ' = {};';
    const bs = src.indexOf(startMark);
    const be = src.indexOf('}catch(eAp){}', bs);
    assert(bs > 0 && be > bs, desk + ': the bundle-build block is findable');
    const block = src.slice(bs, be + '}catch(eAp){}'.length);
    const runBundle = (Wglob) => {
      const sb = { ctx: { quote: { spreadUsd: WIDE, bid: 4300.4, ask: 4301, venue: 'delta-xaut' }, l2Book: Object.assign({ venue: 'delta-xaut' }, BOOK), macro: null, perpNative: null },
        gold: { rows1d: [], rows15m: [], src: {}, source: 'binance-paxg' }, newsRaw: null,
        W: Wglob, gfn: n => W[n], isFinite, console: { log(){} }, Math, Number, String, Object, JSON, Array };
      vm.createContext(sb);
      vm.runInContext(block, sb, { filename: file + ':bundle' });
      return sb[bundle];
    };
    const fed = runBundle({});
    assert(fed && Math.abs(fed.spreadUsd - WIDE) < 1e-9 && fed.spreadVenue === 'delta-xaut' && fed.bid === 4300.4, desk + ': with an empty global the bundle the mint reads CARRIES the proxy quote and its venue');
    assert(fed.l2OrderBook && fed.l2OrderBook.venue === 'delta-xaut', desk + ': and the book');
    const won = runBundle({ __hgGoldQuote: { bid: 4300.50, ask: 4300.60, spreadUsd: 0.10 } });
    assert(Math.abs(won.spreadUsd - 0.10) < 1e-9 && won.bid === 4300.5 && won.spreadVenue === undefined, desk + ': a broker quote on the global WINS -- the proxy fills nothing');
    /* and nothing else on the desk copies ctx.spreadUsd by hand -- one rule */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    assert(!new RegExp(bundle + '\\.spreadUsd = ctx\\.spreadUsd').test(code), desk + ': no hand copy beside the applier');
  }
}

console.log('== 5) the borrowing desks: each lane, lifted and RUN, hands the feed to the mint ==');
{
  const W = boot(BASE);
  const feed = { quote: { spreadUsd: WIDE, bid: 4300.4, ask: 4301, venue: 'delta-xaut' }, l2: Object.assign({ venue: 'delta-xaut' }, BOOK), perp: PERP, venue: 'delta-xaut' };
  function lift(file, head){
    const src = read(file);
    const i = src.indexOf(head);
    assert(i > 0, file + ': ' + head.trim() + ' is findable');
    const j = src.indexOf('\n}\n', i);
    return src.slice(i, j + 2);
  }
  function sandbox(rec, extra){
    const sb = Object.assign({ console: { log(){} }, isFinite, isNaN, Math, Number, String, Object, Array, JSON, Date, Promise, Error,
      gfn: n => (n === 'goldScalpSetups' || n === 'goldSwingSetups') ? rec : (n === 'hgGoldApplyLiveFeed' ? W.hgGoldApplyLiveFeed : null),
      heldLine: () => '', gdNewsCtx: () => ({ at: Date.now(), snap: null }), normCand: () => ({}), setupFromNative: () => null }, extra || {});
    vm.createContext(sb);
    return sb;
  }
  const rows = [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }];
  const gold = { rows15m: rows, rows1h: rows, rows4h: rows, rows1d: rows, live: feed };
  /* GOLD DIRECTION scalp lane */
  {
    const calls = []; const rec = inp => { calls.push(inp); const out = []; out.rejected = []; return out; };
    const sb = sandbox(rec);
    vm.runInContext(lift('golddirection.js', 'async function laneGoldScalp(gold, now){'), sb, { filename: 'golddirection.js:laneGoldScalp' });
    await sb.laneGoldScalp(gold, Date.now());
    assert(calls.length === 1, 'GOLD DIRECTION scalp lane: the mint was called once');
    assert(calls[0] && Math.abs(calls[0].spreadUsd - WIDE) < 1e-9 && calls[0].spreadVenue === 'delta-xaut' && calls[0].l2OrderBook === feed.l2, 'GOLD DIRECTION scalp lane: the mint input CARRIES the quote, its venue and the book');
    const calls2 = []; const rec2 = inp => { calls2.push(inp); const out = []; out.rejected = []; return out; };
    const sb2 = sandbox(rec2);
    vm.runInContext(lift('golddirection.js', 'async function laneGoldScalp(gold, now){'), sb2, { filename: 'golddirection.js:laneGoldScalp2' });
    await sb2.laneGoldScalp(Object.assign({}, gold, { live: null }), Date.now());
    assert(calls2.length === 1 && calls2[0].spreadUsd === undefined && calls2[0].l2OrderBook === undefined, 'GOLD DIRECTION scalp lane: with no feed the mint input is exactly as before');
  }
  /* GOLD DIRECTION swing lane */
  {
    const calls = []; const rec = inp => { calls.push(inp); return { ranked: [], rejected: [] }; };
    const sb = sandbox(rec);
    vm.runInContext(lift('golddirection.js', 'function laneGoldSwing(gold, now){'), sb, { filename: 'golddirection.js:laneGoldSwing' });
    sb.laneGoldSwing(gold, Date.now());
    assert(calls.length === 1 && Math.abs(calls[0].spreadUsd - WIDE) < 1e-9 && calls[0].spreadVenue === 'delta-xaut' && calls[0].l2OrderBook === feed.l2, 'GOLD DIRECTION swing lane: the mint input carries the quote, venue and book');
  }
  /* GOLD ULTRA scalp lane */
  {
    const calls = []; const rec = inp => { calls.push(inp); const out = []; out.rejected = []; return out; };
    const sb = sandbox(rec);
    vm.runInContext(lift('goldultra.js', 'async function laneGoldScalp(gold, now){'), sb, { filename: 'goldultra.js:laneGoldScalp' });
    await sb.laneGoldScalp(gold, Date.now());
    assert(calls.length === 1 && Math.abs(calls[0].spreadUsd - WIDE) < 1e-9 && calls[0].spreadVenue === 'delta-xaut' && calls[0].l2OrderBook === feed.l2, 'GOLD ULTRA scalp lane: the mint input carries the quote, venue and book');
  }
  /* GOLD PINE native scalp */
  {
    const calls = []; const rec = inp => { calls.push(inp); const out = []; out.rejected = []; return out; };
    const sb = sandbox(rec);
    vm.runInContext(lift('goldpine.js', 'function collectNativeScalp(bars, ctx, source){'), sb, { filename: 'goldpine.js:collectNativeScalp' });
    sb.collectNativeScalp({ rows15m: new Array(40).fill(rows[0]), rows1h: rows, rows4h: rows, live: feed }, { now: Date.now(), news: null }, 'test');
    assert(calls.length === 1 && Math.abs(calls[0].spreadUsd - WIDE) < 1e-9 && calls[0].spreadVenue === 'delta-xaut' && calls[0].l2OrderBook === feed.l2, 'GOLD PINE native scalp: the mint input carries the quote, venue and book');
  }
  /* each desk loads the feed ONCE per scan, awaited, before its lanes run --
     deliberately textual (hg-v956): the scan bodies are network-bound */
  for (const [desk, file, after, lane] of [
      ['GOLD DIRECTION', 'golddirection.js', 'var gold = await fetchGoldKlines();', 'laneGoldScalp(gold, now)'],
      ['GOLD ULTRA', 'goldultra.js', 'var f = await fetchRows();', 'laneGoldScalp(f, now)'],
      ['GOLD PINE', 'goldpine.js', 'var bars = await fetchGoldBars();', 'runGoldPineScan(bars,']]){
    const src = read(file);
    const a = src.indexOf(after), l = src.indexOf("await lfFn({ symbol: 'XAUTUSD' })", a), c = src.indexOf(lane, a);
    assert(a > 0 && l > a && c > l, desk + ': hgGoldLiveFeed is awaited after the bars and before the lanes');
    assert((src.match(/hgGoldLiveFeed/g) || []).length === 1, desk + ': loaded once per scan, not per lane');
  }
}

console.log('== 6) still zero writers; build stamps ==');
{
  const NAMES = ['__hgGoldQuote', '__hgGoldSpreadUsd', '__hgGoldL2Book'];
  let reads = 0, writes = 0;
  for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.js'))){
    const src = read(f);
    for (const n of NAMES){
      reads += (src.match(new RegExp(n + '(?!\\s*=[^=])', 'g')) || []).length;
      writes += (src.match(new RegExp(n + '\\s*=[^=]', 'g')) || []).length;
    }
  }
  assert(reads > 0 && writes === 0, 'the sweep sees ' + reads + ' read sites and NO writer -- the feed goes through the mint inputs');
  const W = boot(BASE);
  assert(Math.abs(W.HG_GOLD_SPREAD_MAX_USD - 0.25) < 1e-12, 'the $0.25 bar is unchanged');
  assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
