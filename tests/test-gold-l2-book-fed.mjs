/* HARDGATE -- hg-v970: the gold L2 book is fed, and the DOM rule it feeds is
   made venue-aware before it can empty a board.

   hg-v968 proved three quote globals had zero writers and fed the bid/ask one.
   The L2 one (__hgGoldL2Book) still had none, so the gold DOM rule --
   validateDomLiquidity, reached from GOLD SCALP's and GOLD SWING's micro veto
   -- had never run. The book is on the same Delta payload the quote is;
   Delta serves /v2/l2orderbook/{symbol}.

   The trap, found before the wire went in: that rule VETOES unless the book
   skews >= 20% toward the trade -- a balanced book vetoes both sides -- and on
   GOLD SCALP a non-demote micro veto is a DROP. Feeding a thin proxy book to
   a rule that strict, unmeasured, would have emptied every gold board (the
   hg-v966 trap: a feed handed to a rule nobody decided). So the spread lock's
   venue rule (hg-v968) applies: a book naming a non-broker venue is REPORTED,
   never gated; a book naming no venue behaves exactly as before.

   Sections:
     1) the parser leg, in BOTH copies, and the fetch really asks for it
     2) the one reader
     3) the DOM rule: unnamed / broker venue unchanged (veto); proxy venue advisory
     4) the two micro vetoes carry the advisory out as a note, never a veto
     5) the REAL mints, driven: a balanced proxy book changes NO board and the
        note lands; the same book unnamed drops (the pre-existing rule)
     6) the desks' real perp handlers, lifted and run; the bundle seams (textual)
     7) OMNIGOLD / OMNIGOLD 1 deliberately not wired; still zero writers
     8) build stamps
   Run: node tests/test-gold-l2-book-fed.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';
import * as mjs from '../lib/delta-perp-history.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
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

/* books: Delta's own shape */
const lv = (p, s) => ({ price: String(p), size: String(s), depth: '1' });
const BALANCED = { result: { symbol: 'XAUTUSD', last_updated_at: 1700000000000,
  buy:  [lv(4300.4, 10), lv(4300.3, 10), lv(4300.2, 10)],
  sell: [lv(4300.6, 10), lv(4300.7, 10), lv(4300.8, 10)] } };
const BUYERS = { result: { buy: [lv(4300.4, 50), lv(4300.3, 50)], sell: [lv(4300.6, 5), lv(4300.7, 5)] } };
const SELLERS = { result: { buy: [lv(4300.4, 5), lv(4300.3, 5)], sell: [lv(4300.6, 50), lv(4300.7, 50)] } };
const bookOf = (parsed, venue) => Object.assign({}, parsed, venue ? { venue } : {});

console.log('== 1) the parser leg, in BOTH copies ==');
{
  const cjs = req(path.join(ROOT, 'lib/delta-perp-history.cjs'));
  for (const [name, mod] of [['.mjs', mjs], ['.cjs', cjs]]){
    assert(typeof mod.parseDeltaL2 === 'function', name + ' exports parseDeltaL2');
    const b = mod.parseDeltaL2(BALANCED);
    assert(b && b.bids.length === 3 && b.asks.length === 3, name + ': both sides parsed');
    assert(b.bids[0].price === 4300.4 && b.asks[0].price === 4300.6, name + ': best levels first (bids descending, asks ascending)');
    assert(b.bids[0].size === 10 && typeof b.bids[0].size === 'number', name + ': size is a number, not the string Delta sends');
    assert(b.at === 1700000000000, name + ': the timestamp travels');
    const shuffled = mod.parseDeltaL2({ result: { buy: [lv(4300.2, 1), lv(4300.4, 1)], sell: [lv(4300.8, 1), lv(4300.6, 1)] } });
    assert(shuffled.bids[0].price === 4300.4 && shuffled.asks[0].price === 4300.6, name + ': sorted, not trusted');
    assert(mod.parseDeltaL2({ result: { buy: [lv(4300.4, 1)], sell: [] } }) === null, name + ': a one-sided book is no book');
    assert(mod.parseDeltaL2({ result: { buy: [lv('x', 1)], sell: [lv(4300.6, 1)] } }) === null, name + ': an unreadable best level on one side is no book');
    assert(mod.parseDeltaL2({ result: { buy: [lv(4300.4, 0)], sell: [lv(4300.6, 1)] } }) === null, name + ': a zero-size level does not count');
    assert(mod.parseDeltaL2(null) === null && mod.parseDeltaL2({}) === null && mod.parseDeltaL2({ result: null }) === null, name + ': nothing in, null out');
    const arr = mod.parseDeltaL2({ bids: [[4300.4, 2]], asks: [[4300.6, 3]] });
    assert(arr && arr.bids[0].size === 2 && arr.asks[0].size === 3, name + ': the [price, size] array shape is read too');
  }
  assert(JSON.stringify(mjs.parseDeltaL2(BALANCED)) === JSON.stringify(cjs.parseDeltaL2(BALANCED))
         && JSON.stringify(mjs.parseDeltaL2(BUYERS)) === JSON.stringify(cjs.parseDeltaL2(BUYERS)),
         'the two copies agree on the same payloads -- the server uses the .cjs, the tests the .mjs (hg-v968)');
  /* the fetch really asks for the book -- driven with an injected fetch on BOTH copies */
  for (const [name, mod] of [['.mjs', mjs], ['.cjs', cjs]]){
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      const body = /l2orderbook/.test(url) ? BALANCED
        : /tickers/.test(url) ? { result: { mark_price: '4300.5', quotes: { best_bid: '4300.4', best_ask: '4300.6' } } }
        : { result: [] };
      return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    };
    const r = await mod.fetchDeltaPerpHistory({ symbol: 'XAUTUSD', fetchImpl });
    assert(urls.some(u => /\/v2\/l2orderbook\/XAUTUSD$/.test(u)), name + ': the fetch asks Delta for /v2/l2orderbook/XAUTUSD');
    assert(r.l2 && r.l2.bids.length === 3 && r.l2.asks.length === 3, name + ': the response carries the parsed book as l2');
    assert(r.statuses && r.statuses.l2 === 200, name + ': and its status');
    assert(r.ticker && Math.abs(r.ticker.spreadUsd - 0.2) < 1e-9, name + ': the hg-v968 quote leg is untouched');
    const urls2 = [];
    const failL2 = async (url) => { urls2.push(url); return { ok: !/l2orderbook/.test(url), status: /l2orderbook/.test(url) ? 502 : 200, text: async () => '{"result":[]}' }; };
    const r2 = await mod.fetchDeltaPerpHistory({ symbol: 'XAUTUSD', fetchImpl: failL2 });
    assert(r2.l2 === null && r2.statuses.l2 === 502, name + ': a failed book leg is null with its status, and the payload still returns');
  }
  const api = read('api/delta-perp-history.js');
  assert(/delta-perp-history\.cjs/.test(api), 'the live route still uses the .cjs copy -- which is why both were driven');
}

console.log('== 2) the one reader ==');
{
  const W = boot(BASE);
  assert(typeof W.hgGoldL2FromPerp === 'function', 'hgGoldL2FromPerp is exported');
  const perp = { ok: true, l2: mjs.parseDeltaL2(BALANCED) };
  const b = W.hgGoldL2FromPerp(perp, 'delta-xaut');
  assert(b && b.bids.length === 3 && b.asks.length === 3 && b.venue === 'delta-xaut', 'reads the book and stamps the venue');
  assert(b.at === 1700000000000, 'and the timestamp');
  assert(W.hgGoldL2FromPerp({ ok: true, l2: null }, 'delta-xaut') === null, 'no book on the payload: null');
  assert(W.hgGoldL2FromPerp({ ok: true }, 'delta-xaut') === null, 'no l2 field: null');
  assert(W.hgGoldL2FromPerp(null, 'delta-xaut') === null && W.hgGoldL2FromPerp('x', 'delta-xaut') === null, 'junk: null');
  assert(W.hgGoldL2FromPerp({ l2: { bids: [{ price: 4300.4, size: 1 }], asks: [] } }, 'v') === null, 'one side empty: null');
  assert(W.hgGoldL2FromPerp({ l2: { bids: [{ price: null, size: 1 }], asks: [{ price: 4300.6, size: 1 }] } }, 'v') === null, 'a null best price is unreadable, not zero (isFinite(null) trap)');
  assert(W.hgGoldL2FromPerp({ l2: { bids: [{ price: 4300.4, size: null }], asks: [{ price: 4300.6, size: 1 }] } }, 'v') === null, 'a null best size is unreadable, not zero');
  const unnamed = W.hgGoldL2FromPerp(perp);
  assert(unnamed && unnamed.venue === undefined, 'no venue given: no venue stamped (the caller decides)');
  /* one reader: the desks reach for this name and do not parse the payload themselves */
  for (const f of ['goldscalp.js', 'goldswing.js']){
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    assert(/hgGoldL2FromPerp/.test(code), f + ' asks the shared reader');
    assert(!/perpNative\.l2|\.l2\.bids|\.l2\.asks/.test(code), f + ' does not read the payload\'s book itself');
  }
}

console.log('== 3) the DOM rule: unchanged where it was, advisory on a proxy venue ==');
{
  const W = boot(BASE);
  const P = mjs.parseDeltaL2;
  const bal = P(BALANCED), buy = P(BUYERS), sell = P(SELLERS);
  /* unnamed venue: exactly as before */
  let d = W.validateDomLiquidity('long', bookOf(bal));
  assert(d.triggerValid === false && /L2 VETO/.test(d.reason) && /sellers/.test(d.reason), 'UNNAMED venue, balanced book, long: still VETOES with the original reason');
  d = W.validateDomLiquidity('short', bookOf(bal));
  assert(d.triggerValid === false && /L2 VETO/.test(d.reason) && /buyers/.test(d.reason), 'UNNAMED venue, balanced book, short: still VETOES');
  assert(W.validateDomLiquidity('long', bookOf(buy)).triggerValid === true, 'UNNAMED venue, buyers-skewed, long: passes');
  assert(W.validateDomLiquidity('short', bookOf(sell)).triggerValid === true, 'UNNAMED venue, sellers-skewed, short: passes');
  /* broker venue: exactly as before */
  d = W.validateDomLiquidity('long', bookOf(bal, 'xm'));
  assert(d.triggerValid === false && /L2 VETO/.test(d.reason), 'BROKER venue (xm), balanced, long: still VETOES');
  /* proxy venue: reported, never gated */
  d = W.validateDomLiquidity('long', bookOf(bal, 'delta-xaut'));
  assert(d.triggerValid === true && d.advisory === true, 'PROXY venue, balanced, long: NOT a veto -- advisory');
  assert(/L2 READ/.test(d.reason) && /delta-xaut/.test(d.reason) && /gold proxy/.test(d.reason) && /not gated/.test(d.reason),
         'the advisory names the venue, calls it a proxy, and says it is not gated -- "' + d.reason.slice(0, 60) + '..."');
  assert(/balanced/.test(d.reason), 'and says the book is balanced rather than inventing a skew');
  assert(d.obi && typeof d.obi.obiValue === 'number' && d.venue === 'delta-xaut', 'the imbalance and venue ride on the verdict');
  d = W.validateDomLiquidity('long', bookOf(sell, 'delta-xaut'));
  assert(d.triggerValid === true && d.advisory === true && /toward sellers/.test(d.reason) && /\d+%/.test(d.reason), 'PROXY, sellers-skewed, long: advisory naming the skew and its size');
  d = W.validateDomLiquidity('short', bookOf(buy, 'delta-xaut'));
  assert(d.triggerValid === true && d.advisory === true && /toward buyers/.test(d.reason), 'PROXY, buyers-skewed, short: advisory');
  d = W.validateDomLiquidity('long', bookOf(buy, 'delta-xaut'));
  assert(d.triggerValid === true && !d.advisory, 'PROXY, buyers-skewed, long: the rule is satisfied -- nothing to report');
  assert(W.validateDomLiquidity('long', bookOf(bal, 'XM-XAUUSD')).triggerValid === false, 'the venue test is the spread lock\'s (case-insensitive, substring): XM-XAUUSD is the broker');
  assert(W.validateDomLiquidity('long', null).triggerValid === false && W.validateDomLiquidity('long', {}).triggerValid === false,
         'no book at all still reads as the old rule did (neutral imbalance -> veto) -- this pack changes only NAMED proxy books');
}

console.log('== 4) the micro vetoes carry the advisory out as a note, never a veto ==');
{
  const W = boot(BASE);
  const bal = mjs.parseDeltaL2(BALANCED), buy = mjs.parseDeltaL2(BUYERS);
  const D = { scalpEval: null, obRetest: null };
  let mv = W.__gsMicroVeto('long', 'vwap', D, { l2OrderBook: bookOf(bal, 'delta-xaut') });
  assert(mv && mv.advisory === true && /L2 READ/.test(mv.note) && mv.reason === undefined, 'scalp: proxy balanced -> { advisory, note } with NO reason key (a reason is a veto to every caller)');
  mv = W.__gsMicroVeto('long', 'vwap', D, { l2OrderBook: bookOf(bal) });
  assert(mv && !mv.advisory && /L2 VETO/.test(mv.reason), 'scalp: unnamed balanced -> the veto, as before');
  mv = W.__gsMicroVeto('long', 'vwap', D, { l2OrderBook: bookOf(buy, 'delta-xaut') });
  assert(mv === null, 'scalp: proxy favourable -> null (nothing to say)');
  mv = W.__gsMicroVeto('long', 'vwap', D, {});
  assert(mv === null, 'scalp: no book -> null');
  mv = W.__swMicroVeto('short', 'ob', null, { l2OrderBook: bookOf(bal, 'delta-xaut') });
  assert(mv && mv.advisory === true && /L2 READ/.test(mv.note) && mv.reason === undefined, 'swing: proxy balanced -> advisory note');
  mv = W.__swMicroVeto('short', 'ob', null, { l2OrderBook: bookOf(bal) });
  assert(mv && /L2 VETO/.test(mv.reason), 'swing: unnamed balanced -> the veto, as before');
  /* evaluateScalp records the advisory and keeps validity */
  const ev = W.HardgateGoldEngine && typeof W.HardgateGoldEngine.evaluateScalp === 'function' ? W.HardgateGoldEngine : null;
  assert(!!ev, 'HardgateGoldEngine.evaluateScalp is reachable');
  if (ev){
    const rows = []; let c = 2300;
    for (let i = 0; i < 260; i++){ const o = c; c = o + Math.sin(i / 9) * 2; rows.push({ t: 1700000000 + i * 900, o, h: Math.max(o, c) + 1, l: Math.min(o, c) - 1, c, v: 1000 }); }
    const outA = ev.evaluateScalp(rows, { l2OrderBook: bookOf(bal, 'delta-xaut'), setupDirection: 'long' });
    const outB = ev.evaluateScalp(rows, { l2OrderBook: bookOf(bal), setupDirection: 'long' });
    assert(outA && outA.domNote && /L2 READ/.test(outA.domNote), 'evaluateScalp: the proxy read is recorded as domNote');
    assert(outA.valid !== false || !/L2/.test(outA.vetoReason || ''), 'evaluateScalp: a proxy book does not invalidate the evaluation on the L2 leg');
    assert(outB && /L2 VETO/.test(outB.vetoReason || ''), 'evaluateScalp: an unnamed book still writes the L2 veto reason, as before');
  }
}

console.log('== 5) the REAL mints, driven ==');
{
  const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
  function tapeEnding(endMs, n, stepSec, seed, amp){
    let s = seed || 99, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const rows = []; let c = 2300;
    const tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
    for (let i = 0; i < n; i++){
      const shock = (rnd() < 0.06) ? (rnd() - 0.5) * (amp || 24) : 0;
      const o = c; c = o + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
      const w = 0.8 + rnd() * 2.6;
      rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
    }
    return rows;
  }
  /* seeds chosen only because they MINT on the path that carries the rule --
     on the hg-v953 swing seed the two candidates were Part8/Part9 direct mints,
     which never reach mkCand's micro veto, so every swing assertion below
     passed or failed vacuously. Seed 103 on a falling tape mints bos + p6comp
     through mkCand. */
  const SCALP_SEED = 102, SWING_SEED = 103, SWING_DRIFT = -0.3;
  const scalpInp = (extra) => Object.assign({ rows15m: tapeEnding(WED, 420, 900, SCALP_SEED, 24),
    rows1h: tapeEnding(WED, 220, 3600, SCALP_SEED + 1, 30), rows4h: tapeEnding(WED, 140, 14400, SCALP_SEED + 2, 40),
    dailyCandles: tapeEnding(WED, 120, 86400, SCALP_SEED + 3, 60), now: WED, news: null, candleSource: 'binance-paxg' }, extra || {});
  function swingInp(extra){
    const drift = SWING_DRIFT;
    function t(n, step, seed, amp){
      let s = seed, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const rows = []; let c = 2300;
      const tEnd = Math.floor(WED / 1000), t0 = tEnd - (n - 1) * step;
      for (let i = 0; i < n; i++){
        const shock = (rnd() < 0.06) ? (rnd() - 0.5) * amp : 0;
        const o = c; c = o + drift * (step / 14400) + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
        const w = 0.8 + rnd() * 2.6;
        rows.push({ t: t0 + i * step, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
      }
      return rows;
    }
    return Object.assign({ rows4h: t(300, 14400, SWING_SEED, 40), rows1d: t(150, 86400, SWING_SEED + 3, 60), now: WED, news: null }, extra || {});
  }
  const board = c => [c.entry, c.stop, c.t1, c.dir, c.stratKey, !!c.demoted, !!c.vetoed].join('|');
  const bal = mjs.parseDeltaL2(BALANCED);

  const C = boot(BASE);
  const none = C.goldScalpSetups(scalpInp()) || [];
  assert(none.length > 0, 'REACHABILITY: the scalp mint forms candidates with no book (' + none.length + ')');
  const proxy = C.goldScalpSetups(scalpInp({ l2OrderBook: bookOf(bal, 'delta-xaut') })) || [];
  assert(proxy.length === none.length, 'GOLD SCALP: a balanced PROXY book removes NOTHING (' + proxy.length + ' = ' + none.length + ')');
  assert(proxy.map(board).join('~') === none.map(board).join('~'), 'GOLD SCALP: entry / stop / t1 / dir / kind / demoted / vetoed identical -- no verdict moves');
  assert(proxy.every(c => Array.isArray(c.notes) && c.notes.some(n => /L2 READ/.test(n) && /delta-xaut/.test(n))), 'GOLD SCALP: every candidate carries the L2 read as a note (both cards paint c.notes)');
  assert(proxy.every(c => c.notes.filter(n => /L2 READ/.test(n)).length === 1), 'GOLD SCALP: once per card');
  const unnamed = C.goldScalpSetups(scalpInp({ l2OrderBook: bookOf(bal) })) || [];
  assert(unnamed.length < none.length, 'GOLD SCALP: the same balanced book with NO venue drops candidates (' + unnamed.length + ' < ' + none.length + ') -- the pre-existing rule, untouched, is what this pack refused to feed a proxy to');

  const S = boot(SWING);
  const swNone = (S.goldSwingSetups(swingInp()) || {}).ranked || [];
  assert(swNone.length > 0, 'REACHABILITY: the swing mint forms candidates with no book (' + swNone.length + ')');
  assert(swNone.some(c => !/^p[89]/.test(String(c.stratKey))), 'REACHABILITY: at least one swing candidate came through mkCand, the path that carries the DOM rule (' + swNone.map(c => c.stratKey).join(', ') + ')');
  const swProxyPack = S.goldSwingSetups(swingInp({ l2OrderBook: bookOf(bal, 'delta-xaut') })) || {};
  const swProxy = swProxyPack.ranked || [];
  assert(swProxy.length === swNone.length, 'GOLD SWING: a balanced PROXY book removes NOTHING (' + swProxy.length + ' = ' + swNone.length + ')');
  assert(swProxy.map(board).join('~') === swNone.map(board).join('~'), 'GOLD SWING: board identical');
  assert(swProxy.every(c => Array.isArray(c.notes) && c.notes.some(n => /L2 READ/.test(n))), 'GOLD SWING: every candidate carries the L2 read as a note');
  const swUnnamed = (S.goldSwingSetups(swingInp({ l2OrderBook: bookOf(bal) })) || {}).ranked || [];
  assert(swUnnamed.length < swNone.length, 'GOLD SWING: the unnamed book drops candidates (' + swUnnamed.length + ' < ' + swNone.length + ') -- the pre-existing rule');
}

console.log('== 6) the desks\' real perp handlers, lifted and run ==');
{
  const W = boot(BASE);
  const perp = { ok: true, ticker: { bid: 4300.4, ask: 4300.6, spreadUsd: 0.2 }, l2: mjs.parseDeltaL2(BALANCED) };
  for (const [desk, file] of [['GOLD SCALP', 'goldscalp.js'], ['GOLD SWING', 'goldswing.js']]){
    const src = read(file);
    const i = src.indexOf('.then(function(j){\n            ctx.perpNative = j;');
    assert(i > 0, desk + ': the perp response handler is findable');
    const body = src.slice(i, src.indexOf('}).catch(function(){}));', i));
    const stmt = '(function(j){' + body.slice(body.indexOf('{', body.indexOf('function(j)')) + 1) + '})';
    const run = (gfnImpl, payload) => {
      const ctx = {};
      const sb = { ctx, isFinite, console: { log(){} }, gfn: gfnImpl, Math, Number, String, Object, JSON };
      vm.createContext(sb);
      vm.runInContext(stmt, sb, { filename: file + ':perp' })(payload);
      return ctx;
    };
    const a = run(n => W[n], perp);
    assert(a.l2Book && a.l2Book.bids && a.l2Book.venue === 'delta-xaut', desk + ': ctx carries the book, stamped with the venue');
    assert(Math.abs(a.spreadUsd - 0.2) < 1e-9, desk + ': the hg-v968 quote still lands beside it');
    const b = run(n => W[n], { ok: true, ticker: { bid: 4300.4, ask: 4300.6, spreadUsd: 0.2 } });
    assert(b.l2Book === undefined && Math.abs(b.spreadUsd - 0.2) < 1e-9, desk + ': no book on the payload -> no book on ctx, quote unaffected');
    const c = run(() => null, perp);
    assert(c.l2Book === undefined && c.perpNative === perp, desk + ': goldind absent -> reaches for nothing, throws nothing');
  }
  /* Deliberately TEXTUAL, and says so (hg-v956): the bundle seams live inside
     the scan closure and are not lifted; whether the book is carried, and that
     a named book on the global still WINS, are properties of the source. */
  /* hg-v971 folded the two seam lines into the ONE applier (hgGoldApplyLiveFeed),
     which fills only what the globals left empty -- the global-wins property
     is now proved behaviourally in tests/test-gold-live-feed-reaches-mints.mjs */
  assert(/apLive\(scalpBundle, \{ quote: ctx\.quote \|\| null, l2: ctx\.l2Book \|\| null \}\)/.test(read('goldscalp.js')), 'GOLD SCALP: the bundle takes the proxy book through the shared applier');
  assert(/apLive\(microOpts, \{ quote: ctx\.quote \|\| null, l2: ctx\.l2Book \|\| null \}\)/.test(read('goldswing.js')), 'GOLD SWING: same, on microOpts');
  const gs = read('goldscalp.js');
  assert(gs.indexOf('if (W.__hgGoldL2Book) scalpBundle.l2OrderBook = W.__hgGoldL2Book;') < gs.indexOf('apLive(scalpBundle,'), 'GOLD SCALP: the global is read first, so it wins');
}

console.log('== 7) what is deliberately NOT wired, and still zero writers ==');
{
  /* OMNIGOLD passes the book only into the spread lock's L2 fallback, below the
     quote that always arrives on the same payload -- the book could never
     decide there. OMNIGOLD 1 passes inp.dom into a context nothing reads.
     Wiring either would be the hg-v955 ornamental field. */
  assert(!/hgGoldL2FromPerp/.test(read('omnigold.js')) && !/hgGoldL2FromPerp/.test(read('omnigold1.js')), 'OMNIGOLD and OMNIGOLD 1 do not take the book: they have no reader that can decide on it');
  const NAMES = ['__hgGoldQuote', '__hgGoldSpreadUsd', '__hgGoldL2Book'];
  let reads = 0, writes = 0;
  for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.js'))){
    const src = read(f);
    for (const n of NAMES){
      reads += (src.match(new RegExp(n + '(?!\\s*=[^=])', 'g')) || []).length;
      writes += (src.match(new RegExp(n + '\\s*=[^=]', 'g')) || []).length;
    }
  }
  assert(reads > 0, 'the sweep sees the read sites (' + reads + ')');
  assert(writes === 0, 'this pack adds NO writer of the globals -- the book goes through the ctx');
  const W = boot(BASE);
  assert(Math.abs(W.HG_GOLD_SPREAD_MAX_USD - 0.25) < 1e-12 && W.HG_GOLD_SPREAD_BASIS_VENUE === 'xm', 'the spread bar and the basis venue are unchanged');
}

console.log('== 8) build stamps ==');
assert(swCacheOk(read('sw.js')), 'sw.js HG_CACHE is ' + HG_VER);

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
