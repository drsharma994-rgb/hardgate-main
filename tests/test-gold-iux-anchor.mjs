/* HARDGATE — hg-v1161: every gold tab prices its levels on ONE IUX XAUUSD anchor.

   Three gold desks each carried a copy of "scale the levels to live spot"
   (GOLD SCALP / GOLD SWING at 0.5%, OMNIGOLD at 0.15% or 8 points) and
   build-stamp.js wrapped window.fetch (hg-v1101) to shift any gold payload
   sitting $8..$80 ABOVE gold-api spot; ten of the fifteen minting gold desks
   applied nothing, a feed BELOW spot (Delta XAUT ~-1.5%) was never moved,
   and a desk that did scale recorded scaled levels into a ledger that
   settles on the UNscaled feed (hg-v979). gold-iux.js is the one home now:
   the anchor is applied to the BARS at the feed seams every gold desk reads
   through, so every level is on the IUX scale by construction and the
   ledger records and settles on the same anchored feed.

   Sections:
     1) the rule, driven directly: window, direction, null close, idempotent,
        broker never moved, state / shiftOf / label three states
     2) the anchor loader: cached, one in flight, bounded, null on junk
     3) macro.js getGoldCandles, REAL, with the module loaded: every pack
        leaves anchored, cached once, feed name kept; absent module or dead
        anchor -> the feed's bars
     4) the shell's getXAUCandles, lifted: the Delta XAUT leg is anchored, the
        broker leg is not, the DATA chip names the anchor
     5) the three direct PAXG fallbacks (GOLD ULTRA, GOLD DIRECTION, GOLD
        PINE), lifted and run; OMNIGOLD's own fetcher driven
     6) the ledger: iuxShiftPct kept / refused, stamped from the one home at
        record time, a desk hand-in wins, the gold note prints it
     7) end to end through the real GOLD SCALP tab on the real macro.js: the
        levels sit on the anchor, the desk's own scaler does not fire, the
        records carry the feed and the move
     8) census + hygiene: every direct PAXG call site in a gold file is
        anchored, the hg-v1101 wrapper is gone, the module loads before
        macro.js and is precached, no gate reads the field, build stamps

   Run: node tests/test-gold-iux-anchor.mjs */
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
const near = (a, b, tol) => Math.abs(a / b - 1) <= (tol || 1e-9);

const ANCHOR = 4300;
function mkRows(n, base, stepSec, endSec){
  const out = [];
  const t0 = (endSec || 1760000000) - (n - 1) * stepSec;
  for (let i = 0; i < n; i++){
    const c = base + Math.sin(i / 7) * 20;
    out.push({ t: t0 + i * stepSec, o: c - 1, h: c + 5, l: c - 5, c, v: 100 + i });
  }
  return out;
}
function goldApiFetch(price, opts){
  opts = opts || {};
  const calls = [];
  const f = (url, init) => {
    calls.push(String(url) + ((init && init.cache) ? '#' + init.cache : ''));
    if (/gold-api\.com\/price\/XAU/.test(String(url))){
      if (opts.hang) return new Promise(() => {});
      if (opts.throws) return Promise.reject(new Error('down'));
      if (opts.notOk) return Promise.resolve({ ok: false, status: 503, json: async () => null });
      return Promise.resolve({ ok: true, status: 200, json: async () => (typeof price === 'function' ? price() : { price }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => null, text: async () => '' });
  };
  f.calls = calls;
  return f;
}
function boot(files, extra, opts){
  opts = opts || {};
  const FakeDate = opts.clock ? class extends Date { static now(){ return opts.clock.now; } } : Date;
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date: FakeDate, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt, AbortController,
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
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
  return ctx;
}

/* ------------------------------------------------------------------ 1 */
console.log('== 1) the rule, driven directly ==');
{
  const W = boot(['gold-iux.js']);
  assert(typeof W.hgGoldIuxShiftPack === 'function' && typeof W.hgGoldIuxRatio === 'function', 'REACHABILITY: the one home loads and exports the rule');
  assert(W.HG_GOLD_IUX_MIN_PCT === 0.05 && W.HG_GOLD_IUX_MAX_PCT === 2.5, 'the window is 0.05% .. 2.5% (' + W.HG_GOLD_IUX_MIN_PCT + ' / ' + W.HG_GOLD_IUX_MAX_PCT + ')');
  const r = W.hgGoldIuxRatio;
  assert(r(4300 * (1 - 0.0004), 4300).shift === false && r(4300 * (1 - 0.0004), 4300).why === 'on-anchor', 'a feed 0.04% off the anchor is ON the anchor: nothing moves');
  const in1 = r(4300 / 1.0006, 4300);
  assert(in1 && in1.shift === true && near(in1.ratio, 1.0006, 1e-9), 'a feed 0.06% off is moved (ratio ' + in1.ratio.toFixed(6) + ')');
  const dn = r(4300 * 1.015, 4300);
  assert(dn && dn.shift === true && dn.ratio < 1 && near(dn.pct, (1 / 1.015 - 1) * 100, 1e-9), 'a feed ABOVE the anchor (GC=F) is moved DOWN (pct ' + dn.pct.toFixed(3) + ')');
  const up = r(4300 * 0.985, 4300);
  assert(up && up.shift === true && up.ratio > 1, 'a feed BELOW the anchor (Delta XAUT ~-1.5%) is moved UP — the direction the hg-v1101 wrapper never had');
  const edge = r(4300 / 1.025, 4300);
  assert(edge && edge.shift === true, '2.5% exactly is inside the window');
  const out = r(4300 / 1.026, 4300);
  assert(out && out.shift === false && out.why === 'out-of-window' && out.ratio === 1, '2.6% is a broken feed, not a basis: left alone and said so');
  assert(r(NaN, 4300) === null && r(0, 4300) === null && r(4300, null) === null && r('4300', 4300) === null && r(-1, 4300) === null, 'unreadable on either side is NO ratio (NaN, 0, null, a string, negative)');
  /* rows */
  const rows = mkRows(5, 4300 * 0.99, 900);
  rows[2].c = null; rows[3].h = undefined;
  const before = JSON.stringify(rows);
  const sh = W.hgGoldIuxShiftRows(rows, 1.01);
  assert(JSON.stringify(rows) === before, 'the fetcher\'s own rows are never mutated');
  assert(sh !== rows && sh[0] !== rows[0] && near(sh[0].c, rows[0].c * 1.01) && near(sh[0].o, rows[0].o * 1.01) && near(sh[0].h, rows[0].h * 1.01) && near(sh[0].l, rows[0].l * 1.01), 'o/h/l/c are scaled on NEW row objects');
  assert(sh[0].v === rows[0].v && sh[0].t === rows[0].t, 'volume and time untouched');
  assert(sh[2].c === null && sh[3].h === undefined, 'a null close stays null and a missing high stays missing — never a zero scaled (+null is 0)');
  assert(W.hgGoldIuxShiftRows(rows, NaN) === rows && W.hgGoldIuxShiftRows(rows, 0) === rows && W.hgGoldIuxShiftRows(null, 1.01) === null, 'no ratio, or no rows: the input back');
  assert(W.hgGoldIuxLastClose([{ c: 1 }, { c: null }, { c: 'x' }]) === 1 && isNaN(W.hgGoldIuxLastClose([])) && isNaN(W.hgGoldIuxLastClose([{ c: null }])), 'the last close is the last FINITE positive close; none is NaN');
  /* pack */
  W.hgGoldIuxReset();
  const anchor = { px: ANCHOR, at: 1, src: 'gold-api' };
  const feedRows = mkRows(10, ANCHOR * 0.99, 900);
  const p1 = W.hgGoldIuxShiftPack({ rows: feedRows, source: 'binance-paxg' }, anchor);
  assert(p1 && p1 !== feedRows && p1.rows !== feedRows && p1.iux && p1.iux.shifted === true && p1.source === 'binance-paxg', 'a pack off the anchor returns a NEW pack with anchored rows, its feed name kept and an iux stamp');
  assert(near(W.hgGoldIuxLastClose(p1.rows), ANCHOR, 1e-9), 'the anchored pack\'s last close IS the anchor');
  assert(near(p1.iux.ratio, ANCHOR / W.hgGoldIuxLastClose(feedRows)) && near(p1.iux.feedLast, W.hgGoldIuxLastClose(feedRows)) && p1.iux.anchor === ANCHOR, 'the stamp carries anchor, feedLast and the ratio');
  const p2 = W.hgGoldIuxShiftPack(p1, { px: ANCHOR * 1.01, at: 2, src: 'gold-api' });
  assert(p2 === p1, 'a pack already carrying iux is returned as it is — never anchored twice (a cached pack)');
  const flatRows = mkRows(10, ANCHOR, 900).map(r => Object.assign({}, r, { c: ANCHOR * (1 - 0.0003) }));   /* 0.03% off: inside the floor */
  const pOn = W.hgGoldIuxShiftPack({ rows: flatRows, source: 'binance-xau' }, anchor);
  assert(pOn && pOn.iux && pOn.iux.shifted === false && pOn.rows === flatRows, 'a feed on the anchor is measured, stamped shifted:false and its rows left as they are (the same array)');
  const bro = { rows: mkRows(10, ANCHOR * 0.99, 900), source: 'xm-xauusd' };
  const pB = W.hgGoldIuxShiftPack(bro, anchor);
  assert(pB === bro && !bro.iux, 'the BROKER feed is never anchored — it IS the reader\'s instrument');
  const pNo = { rows: mkRows(10, ANCHOR * 0.99, 900), source: 'binance-paxg' };
  assert(W.hgGoldIuxShiftPack(pNo, null) === pNo && W.hgGoldIuxShiftPack(pNo, { px: NaN }) === pNo && !pNo.iux, 'no anchor: the pack back, unstamped');
  assert(W.hgGoldIuxShiftPack({ rows: mkRows(5, 4000, 900) }, anchor).iux === undefined, 'a pack naming no feed is not anchored (nothing to record it under)');
  assert(W.hgGoldIuxShiftPack({ rows: [], source: 'binance-paxg' }, anchor).iux === undefined && W.hgGoldIuxShiftPack(null, anchor) === null, 'empty rows / no pack: untouched');
  const far = W.hgGoldIuxShiftPack({ rows: mkRows(10, ANCHOR * 0.9, 900), source: 'binance-xaut' }, anchor);
  assert(far.iux && far.iux.shifted === false && far.iux.why === 'out-of-window', 'a feed 10% off is stamped out-of-window, not moved');
  /* state / shiftOf / label: three states */
  const st = W.hgGoldIuxState();
  assert(st.byFeed['binance-paxg'] && st.byFeed['binance-paxg'].shifted === true && st.byFeed['xm-xauusd'] && st.byFeed['xm-xauusd'].measured === false && st.byFeed['xm-xauusd'].why === 'broker', 'the state names each feed: moved, on-anchor, broker');
  const so = W.hgGoldIuxShiftOf;
  assert(typeof so('binance-paxg') === 'number' && near(so('binance-paxg'), (ANCHOR / W.hgGoldIuxLastClose(feedRows) - 1) * 100, 1e-3), 'shiftOf(moved feed) is the percent moved (' + so('binance-paxg') + ')');
  assert(so('binance-xau') === 0 && so('binance-xaut') === 0, 'shiftOf(a measured feed that did not move) is a READ zero');
  assert(so('xm-xauusd') === undefined && so('delta-xaut') === undefined && so('') === undefined, 'shiftOf(broker) and shiftOf(never measured) are ABSENT');
  assert(W.hgGoldIuxFeedLabel('binance-paxg', 'BINANCE PAXG') === 'BINANCE PAXG → IUX' && W.hgGoldIuxFeedLabel('binance-xau', 'BINANCE XAU') === 'BINANCE XAU' && W.hgGoldIuxFeedLabel('xm-xauusd', 'XM') === 'XM' && W.hgGoldIuxFeedLabel('nope', 'N') === 'N', 'the label says → IUX only for a feed that was moved');
  assert(W.hgGoldIuxLine('binance-paxg') === '' , 'no anchor loaded yet: no line (the pack carried its own anchor, the loader has none)');
  const stCopy = W.hgGoldIuxState(); stCopy.byFeed['binance-paxg'].shifted = false;
  assert(W.hgGoldIuxState().byFeed['binance-paxg'].shifted === true, 'the state is a copy');
}

/* ------------------------------------------------------------------ 2 */
console.log('== 2) the anchor loader ==');
{
  const f = goldApiFetch(ANCHOR);
  const W = boot(['gold-iux.js'], { fetch: f });
  const a1 = await W.hgGoldIuxAnchor();
  assert(a1 && a1.px === ANCHOR && a1.src === 'gold-api' && f.calls.length === 1, 'loads gold-api spot once (' + f.calls[0] + ')');
  const [a2, a3] = await Promise.all([W.hgGoldIuxAnchor(), W.hgGoldIuxAnchor()]);
  assert(a2.px === ANCHOR && a3.px === ANCHOR && f.calls.length === 1, 'cached: two more calls, still one request');
  assert(W.hgGoldIuxAnchorCached() && W.hgGoldIuxAnchorCached().px === ANCHOR, 'the cached anchor is readable synchronously');
  assert(/IUX anchor ~\$4300\.00 \(gold-api spot\)/.test(W.hgGoldIuxLine()) && /4300\.00/.test(W.hgGoldIuxChipHtml()), 'the line and the chip name the anchor and its source');
  W.hgGoldIuxReset();
  const fH = goldApiFetch(ANCHOR, { hang: true });
  const W2 = boot(['gold-iux.js'], { fetch: fH });
  const t0 = Date.now();
  const aH = await W2.hgGoldIuxAnchor({ timeoutMs: 120 });
  assert(aH === null && (Date.now() - t0) < 2000, 'a hanging endpoint resolves null inside the timeout (' + (Date.now() - t0) + 'ms)');
  const W3 = boot(['gold-iux.js'], { fetch: goldApiFetch(ANCHOR, { throws: true }) });
  assert((await W3.hgGoldIuxAnchor()) === null, 'a throwing fetch is null');
  const W4 = boot(['gold-iux.js'], { fetch: goldApiFetch(ANCHOR, { notOk: true }) });
  assert((await W4.hgGoldIuxAnchor()) === null, 'a non-ok response is null');
  for (const junk of [{ price: 12 }, { price: 'abc' }, { price: null }, {}, { price: 25000 }]){
    const Wj = boot(['gold-iux.js'], { fetch: goldApiFetch(() => junk) });
    assert((await Wj.hgGoldIuxAnchor()) === null, 'junk price ' + JSON.stringify(junk) + ' is null, never an anchor');
  }
  const W5 = boot(['gold-iux.js'], { fetch: undefined });
  assert((await W5.hgGoldIuxAnchor()) === null, 'no fetch at all is null');
  /* a dead anchor leaves apply fail-open */
  const pk = { rows: mkRows(10, ANCHOR * 0.99, 900), source: 'binance-paxg' };
  assert((await W3.hgGoldIuxApply(pk)) === pk && !pk.iux, 'hgGoldIuxApply with a dead anchor hands the pack back untouched');
  const inflight = [W.hgGoldIuxAnchor({ refresh: true }), W.hgGoldIuxAnchor({ refresh: true })];
  await Promise.all(inflight);
  assert(f.calls.length === 2, 'two concurrent refreshes share ONE request in flight (' + f.calls.length + ' total)');
}

/* ------------------------------------------------------------------ 3 */
console.log('== 3) macro.js getGoldCandles, real, with the module loaded ==');
{
  const feedLast = ANCHOR * 0.99;
  const bkCalls = [];
  const bk = async (sym, res, n) => { bkCalls.push(sym + ':' + res); return (sym === 'XAUUSDT') ? mkRows(n, feedLast, 900) : []; };
  const f = goldApiFetch(ANCHOR);
  const W = boot(['gold-iux.js', 'macro.js'], { fetch: f, binanceKlines: bk });
  assert(typeof W.getGoldCandles === 'function', 'REACHABILITY: macro.js booted');
  const p = await W.getGoldCandles('15m', 50);
  assert(p && p.rows && p.rows.length === 50 && p.source === 'binance-xau', 'the chain answered on XAUUSDT, feed name kept');
  assert(p.iux && p.iux.shifted === true && near(W.hgGoldIuxLastClose(p.rows), ANCHOR, 1e-9), 'the pack left the chain ANCHORED: last close is the anchor, stamped iux');
  const raw = mkRows(50, feedLast, 900);
  assert(near(p.rows[0].c, raw[0].c * (ANCHOR / raw[raw.length - 1].c), 1e-9) && p.rows[0].v === raw[0].v, 'every bar is scaled by the one ratio, volume untouched');
  const p2 = await W.getGoldCandles('15m', 50);
  assert(p2 === p && bkCalls.length === 1 && f.calls.length === 1, 'the cached pack is the anchored one — not anchored twice, not fetched twice');
  assert(near(W.hgGoldIuxShiftOf('binance-xau'), (ANCHOR / raw[raw.length - 1].c - 1) * 100, 1e-3), 'shiftOf names the move (' + W.hgGoldIuxShiftOf('binance-xau').toFixed(3) + '%)');
  const p4 = await W.getGoldCandles('4h', 30);
  assert(p4.iux && p4.iux.shifted === true && f.calls.length === 1, 'a second timeframe is anchored on the cached anchor (one gold-api request)');
  /* PAXG leg through the same seam */
  const bkP = async (sym, res, n) => (sym === 'PAXGUSDT') ? mkRows(n, ANCHOR * 1.004, 900) : [];
  const Wp = boot(['gold-iux.js', 'macro.js'], { fetch: goldApiFetch(ANCHOR), binanceKlines: bkP });
  const pp = await Wp.getGoldCandles('1h', 40);
  assert(pp.source === 'binance-paxg' && pp.iux && pp.iux.shifted === true && pp.iux.ratio < 1 && near(Wp.hgGoldIuxLastClose(pp.rows), ANCHOR, 1e-9), 'the PAXG leg, above the anchor, is moved DOWN onto it');
  /* module absent: the feed's bars */
  const Wn = boot(['macro.js'], { fetch: goldApiFetch(ANCHOR), binanceKlines: bk });
  const pn = await Wn.getGoldCandles('15m', 50);
  assert(pn && pn.rows.length === 50 && pn.iux === undefined && near(pn.rows[49].c, raw[49].c, 1e-9), 'with gold-iux.js absent the pack is the feed\'s own bars, unstamped');
  /* anchor dead: the feed's bars */
  const Wd = boot(['gold-iux.js', 'macro.js'], { fetch: goldApiFetch(ANCHOR, { throws: true }), binanceKlines: bk });
  const pd = await Wd.getGoldCandles('15m', 50);
  assert(pd && pd.rows.length === 50 && pd.iux === undefined && near(pd.rows[49].c, raw[49].c, 1e-9), 'with the anchor unreadable the pack is the feed\'s own bars (fails open)');
  /* broker is not in this chain, but an on-anchor feed is left alone */
  const flat50 = mkRows(50, ANCHOR, 900).map(r => Object.assign({}, r, { c: ANCHOR }));
  const bkOn = async (sym, res, n) => (sym === 'XAUUSDT') ? flat50.slice(-n) : [];
  const Wo = boot(['gold-iux.js', 'macro.js'], { fetch: goldApiFetch(ANCHOR), binanceKlines: bkOn });
  const po = await Wo.getGoldCandles('15m', 50);
  assert(po.iux && po.iux.shifted === false && po.rows[0].o === flat50[0].o && po.rows[0].c === ANCHOR, 'a feed already on the anchor is measured and left exactly as it came');
  /* the Yahoo GC=F leg (the one the hg-v1101 wrapper used to shift), through the proxy */
  const gcLast = ANCHOR * 1.0065;   /* the COMEX future, ~$28 over spot */
  const yFetch = (url) => {
    const u = String(url);
    if (/gold-api\.com\/price\/XAU/.test(u)) return Promise.resolve({ ok: true, status: 200, json: async () => ({ price: ANCHOR }) });
    if (/GC%3DF|GC=F/.test(u)){
      const n = 40, ts = [], o = [], h = [], l = [], c = [];
      for (let i = 0; i < n; i++){ ts.push(1760000000 - (n - 1 - i) * 3600); const v = gcLast + Math.sin(i / 7) * 10; o.push(v - 1); h.push(v + 4); l.push(v - 4); c.push(i === n - 1 ? gcLast : v); }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ chart: { result: [{ timestamp: ts, indicators: { quote: [{ open: o, high: h, low: l, close: c, volume: ts.map(() => 5) }] } }] } }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => null, text: async () => '' });
  };
  const Wy = boot(['gold-iux.js', 'macro.js'], { fetch: yFetch, binanceKlines: async () => [] });
  const py = await Wy.getGoldCandles('1h', 30);
  assert(py && py.source === 'yahoo' && py.rows.length === 30, 'REACHABILITY: with Binance dark the chain fell to Yahoo GC=F');
  assert(py.iux && py.iux.shifted === true && py.iux.ratio < 1 && near(Wy.hgGoldIuxLastClose(py.rows), ANCHOR, 1e-9), 'the GC=F future, 0.65% over spot, is moved DOWN onto the anchor — what hg-v1101 did in a fetch wrapper, now in the chain');
  assert(near(Wy.hgGoldIuxShiftOf('yahoo'), (ANCHOR / gcLast - 1) * 100, 1e-3), 'shiftOf(yahoo) names the move (' + Wy.hgGoldIuxShiftOf('yahoo').toFixed(3) + '%)');
  /* silver is NOT anchored */
  const bkAg = async (sym, res, n) => (sym === 'XAGUSDT') ? mkRows(n, 50, 900) : [];
  const Wa = boot(['gold-iux.js', 'macro.js'], { fetch: goldApiFetch(ANCHOR), binanceKlines: bkAg });
  const ps = await Wa.getSilverCandles('15m', 20);
  assert(ps && ps.rows.length === 20 && ps.iux === undefined && near(ps.rows[19].c, mkRows(20, 50, 900)[19].c, 1e-12), 'silver leaves its chain untouched — the anchor is gold\'s');
}

/* ------------------------------------------------------------------ 4 */
console.log('== 4) the shell\'s getXAUCandles, lifted: the Delta XAUT leg is anchored, the broker leg is not ==');
{
  const html = read('index.html');
  const START = 'const GOLD_SRC_LABEL';
  const END = "  throw new Error('XAUUSD data unavailable from all sources (XM, spot proxies, Delta XAUTUSD)');\n}";
  const a = html.indexOf(START);
  const k = html.indexOf(END, html.indexOf('async function getXAUCandles', a));
  assert(a > 0 && k > a, 'REACHABILITY: the getXAUCandles block is located');
  const block = html.slice(a, k + END.length);
  function run(opts){
    const chip = { innerHTML: '' };
    const xautLast = ANCHOR * 0.985;
    const ctx = {
      console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, encodeURIComponent, Promise, AbortController, setTimeout, clearTimeout,
      DELTA: 'https://api.india.delta.exchange', DELTA_RES: { '15m':'15m','1h':'1h','2h':'2h','4h':'4h','1d':'1d' }, GOLD_SYM: 'XAUTUSD',
      nowSec: () => 1754400000, S: { candleCache: {} }, hgCandleCacheTtl: () => 60, $: () => chip,
      dropForming: rows => rows,
      getGoldCandles: async () => ({ rows: [], source: null }),
      getXmGoldCandles: async () => (opts.xm ? { rows: mkRows(260, ANCHOR * 0.99, 14400, 1754400000), source: 'xm-xauusd' } : { rows: [], source: null }),
      deltaGet: async () => ({ result: Array.from({ length: 260 }, (_, i) => ({ time: 1754400000 - (260 - i) * 14400, open: xautLast - 1, high: xautLast + 5, low: xautLast - 5, close: xautLast, volume: 10 })) })
    };
    ctx.window = ctx; ctx.globalThis = ctx;
    ctx.fetch = goldApiFetch(ANCHOR);
    vm.createContext(ctx);
    if (opts.module) vm.runInContext(read('gold-iux.js'), ctx, { filename: 'gold-iux.js' });
    vm.runInContext(block, ctx, { filename: 'index.html:getXAUCandles' });
    return { ctx, chip, xautLast };
  }
  const r = run({ module: true });
  const rows = await r.ctx.getXAUCandles('4h', 200);
  assert(rows && rows.length === 260 && r.ctx.S.goldDataSource === 'delta-xaut', 'REACHABILITY: the Delta XAUT leg answered (source delta-xaut)');
  assert(near(rows[rows.length - 1].c, ANCHOR, 1e-9), 'its bars left the shell ON THE ANCHOR (XAUT ~-1.5% moved up)');
  assert(r.ctx.hgGoldIuxShiftOf('delta-xaut') > 1.4 && r.ctx.hgGoldIuxShiftOf('delta-xaut') < 1.6, 'shiftOf(delta-xaut) names the move (' + r.ctx.hgGoldIuxShiftOf('delta-xaut').toFixed(3) + '%)');
  assert(/IUX ~\$4300\.00/.test(r.chip.innerHTML) && /DELTA XAUTUSD/.test(r.chip.innerHTML), 'the DATA chip names the feed AND the anchor it sits on');
  const rx = run({ module: true, xm: true });
  const rowsX = await rx.ctx.getXAUCandles('4h', 200);
  assert(rx.ctx.S.goldDataSource === 'xm-xauusd' && near(rowsX[rowsX.length - 1].c, mkRows(260, ANCHOR * 0.99, 14400, 1754400000)[259].c, 1e-12), 'the broker leg is NOT anchored: its bars are the bridge\'s bars');
  assert(rx.ctx.hgGoldIuxShiftOf('xm-xauusd') === undefined, 'and records no move');
  const rn = run({ module: false });
  const rowsN = await rn.ctx.getXAUCandles('4h', 200);
  assert(near(rowsN[rowsN.length - 1].c, rn.xautLast, 1e-12) && !/IUX/.test(rn.chip.innerHTML), 'with the module absent the Delta leg is the feed\'s own bars and the chip says nothing about IUX');
}

/* ------------------------------------------------------------------ 5 */
console.log('== 5) the three direct PAXG fallbacks, lifted and run; OMNIGOLD\'s fetcher driven ==');
/* the fetch function ALONE, as tests/test-gold-ledger-same-feed.mjs lifts it:
   the anchor call lives INSIDE the function so a lift stays self-contained */
function lift(file, fnName){
  const src = read(file);
  const b = src.indexOf('async function ' + fnName + '(');
  const e = src.indexOf('\n}\n', b);
  if (b < 0 || e < 0) throw new Error('lift failed for ' + file);
  return src.slice(b, e + 3);
}
{
  const cases = [
    { file: 'goldultra.js', helper: 'guIuxRows', fn: 'fetchRows', consts: { KL_15M: 40, KL_1H: 40 }, pick: o => o.rows15m, feedKey: o => o.srcByTf['15m'] },
    { file: 'golddirection.js', helper: 'gdIuxRows', fn: 'fetchGoldKlines', consts: { KL_15M: 40, KL_1H: 40, KL_4H: 40, KL_1D: 40 }, pick: o => o.rows15m, feedKey: o => o.src['15m'] },
    { file: 'goldpine.js', helper: 'gpIuxRows', fn: 'fetchGoldBars', consts: { KL_15M: 40, KL_1H: 40, KL_4H: 40, KL_1D: 40 }, pick: o => o.rows15m, feedKey: o => o.srcByTf['15m'] }
  ];
  for (const cs of cases){
    const code = lift(cs.file, cs.fn);
    assert(code.indexOf('PAXGUSDT') > 0, 'REACHABILITY: ' + cs.file + ' ' + cs.fn + ' lifted with its PAXG fallback');
    const mk = (withModule) => {
      const W = boot(withModule ? ['gold-iux.js'] : [], { fetch: goldApiFetch(ANCHOR) });
      Object.assign(W, cs.consts);
      W.W = W;
      W.gfn = name => (typeof W[name] === 'function') ? W[name] : null;
      W.binanceKlines = async (sym, res, n) => (sym === 'PAXGUSDT') ? mkRows(n, ANCHOR * 1.004, 900) : [];
      vm.runInContext(code, W, { filename: cs.file + ':' + cs.fn });
      return W;
    };
    const W = mk(true);
    const out = await W[cs.fn]();
    const rows = cs.pick(out);
    assert(rows && rows.length === 40 && cs.feedKey(out) === 'binance-paxg', cs.file + ': getGoldCandles absent, the PAXG fallback answered under its own feed name');
    assert(near(W.hgGoldIuxLastClose(rows), ANCHOR, 1e-9), cs.file + ': the fallback rows are ANCHORED (PAXG +0.4% moved down)');
    assert(W.hgGoldIuxShiftOf('binance-paxg') < 0, cs.file + ': the move is recorded under binance-paxg');
    const Wn = mk(false);
    const outN = await Wn[cs.fn]();
    assert(near(cs.pick(outN)[39].c, mkRows(40, ANCHOR * 1.004, 900)[39].c, 1e-12), cs.file + ': with the module absent the fallback is the feed\'s own bars');
  }
  /* the two home desks' own fetchers, lifted the same way */
  for (const cs of [
    { file: 'goldscalp.js', fn: 'fetchGoldKlines', consts: { KL_15M: 40, KL_1H: 40, KL_4H: 40, KL_1D: 40, gsClosedRows: r => r }, pick: o => o.rows15m, feedKey: o => o.src['15m'] },
    { file: 'goldswing.js', fn: 'fetchGoldKlines', consts: { KL_4H: 40, KL_1D: 40 }, pick: o => o.rows4h, feedKey: o => o.src['4h'] }
  ]){
    const code = lift(cs.file, cs.fn);
    assert(code.indexOf('PAXGUSDT') > 0 && code.indexOf('iuxRows') > 0, 'REACHABILITY: ' + cs.file + ' ' + cs.fn + ' lifted with its PAXG fallback and the anchor call inside it');
    const mk = (withModule) => {
      const W = boot(withModule ? ['gold-iux.js'] : [], { fetch: goldApiFetch(ANCHOR) });
      Object.assign(W, cs.consts);
      W.W = W;
      W.gfn = name => (typeof W[name] === 'function') ? W[name] : null;
      W.binanceKlines = async (sym, res, n) => (sym === 'PAXGUSDT') ? mkRows(n, ANCHOR * 1.004, 900) : [];
      vm.runInContext(code, W, { filename: cs.file + ':' + cs.fn });
      return W;
    };
    const W = mk(true);
    const out = await W[cs.fn]();
    const rows = cs.pick(out);
    assert(rows && rows.length === 40 && cs.feedKey(out) === 'binance-paxg', cs.file + ': with every other leg dark the PAXG fallback answered under its own feed name');
    assert(near(W.hgGoldIuxLastClose(rows), ANCHOR, 1e-9), cs.file + ': the fallback rows are ANCHORED');
    const Wn = mk(false);
    assert(near(cs.pick(await Wn[cs.fn]())[39].c, mkRows(40, ANCHOR * 1.004, 900)[39].c, 1e-12), cs.file + ': with the module absent the fallback is the feed\'s own bars');
  }
  /* the 7-step 1h loader shared by OMNIGOLD / GOLD SCALP / GOLD SWING */
  {
    const W7 = boot(['gold-iux.js', 'gold-seven-step.js'], { fetch: goldApiFetch(ANCHOR), binanceKlines: async (sym, res, n) => (sym === 'PAXGUSDT') ? mkRows(n, ANCHOR * 1.004, 3600) : [] });
    assert(typeof W7.hgGoldSevenStepLoad1h === 'function', 'REACHABILITY: the 7-step loader is exported');
    const p7 = await W7.hgGoldSevenStepLoad1h(50);
    assert(p7 && p7.source === 'binance-paxg' && p7.rows.length === 50 && near(W7.hgGoldIuxLastClose(p7.rows), ANCHOR, 1e-9), 'the 7-step loader\'s PAXG leg is anchored');
    const W7n = boot(['gold-seven-step.js'], { fetch: goldApiFetch(ANCHOR), binanceKlines: async (sym, res, n) => (sym === 'PAXGUSDT') ? mkRows(n, ANCHOR * 1.004, 3600) : [] });
    const p7n = await W7n.hgGoldSevenStepLoad1h(50);
    assert(near(p7n.rows[49].c, mkRows(50, ANCHOR * 1.004, 3600)[49].c, 1e-12), 'module absent: the feed\'s own bars');
  }
  /* SHIVA GOLD's fast lane, lifted (iuxRows + loadFast) */
  {
    const src = read('shivagold.js');
    const a = src.indexOf('async function iuxRows(rows, feed){'), b = src.indexOf('async function loadFast('), e = src.indexOf('\n}\n', b);
    assert(a > 0 && b > a && e > b, 'REACHABILITY: SHIVA GOLD loadFast lifted with its anchor helper');
    const code = src.slice(a, e + 3);
    const mkS = (withModule) => {
      const W = boot(withModule ? ['gold-iux.js'] : [], { fetch: goldApiFetch(ANCHOR) });
      W.W = W; W.timed = p => p;
      /* 1.008, not 1.004: a 30-row sine tape at 1.004 lands its LAST close 0.007% off the anchor, inside the floor, and measures as on-anchor */
      W.binanceKlines = async (sym, res, n) => (sym === 'XAUUSDT') ? mkRows(n, ANCHOR * 0.99, 300) : (sym === 'PAXGUSDT' ? mkRows(n, ANCHOR * 1.008, 300) : []);
      vm.runInContext(code, W, { filename: 'shivagold.js:loadFast' });
      return W;
    };
    const Ws = mkS(true);
    const fast = await Ws.loadFast('5m', 30);
    assert(fast && /^binance-xau/.test(fast.source) && near(Ws.hgGoldIuxLastClose(fast.rows), ANCHOR, 1e-9), 'SHIVA GOLD\'s XAUUSDT lane is anchored (' + fast.source + ')');
    Ws.binanceKlines = async (sym, res, n) => (sym === 'PAXGUSDT') ? mkRows(n, ANCHOR * 1.008, 300) : [];
    const fastP = await Ws.loadFast('5m', 30);
    assert(fastP && /^binance-paxg/.test(fastP.source) && near(Ws.hgGoldIuxLastClose(fastP.rows), ANCHOR, 1e-9), 'and its PAXG lane');
    const Wsn = mkS(false);
    assert(near((await Wsn.loadFast('5m', 30)).rows[29].c, mkRows(30, ANCHOR * 0.99, 300)[29].c, 1e-12), 'module absent: the feed\'s own bars');
  }
  /* OMNIGOLD: the exported fetcher on its legacy path */
  const Wo = boot(['gold-iux.js', 'indicators.js', 'indicators2.js', 'hg-setup-core.js', 'goldind.js', 'omnigold.js'],
    { fetch: goldApiFetch(ANCHOR), binanceKlines: async (sym, res, n) => (sym === 'PAXGUSDT') ? mkRows(n, ANCHOR * 1.004, 3600) : [] });
  assert(typeof Wo.hgOgFetchRows === 'function', 'REACHABILITY: OMNIGOLD exports hgOgFetchRows');
  const po = await Wo.hgOgFetchRows('1h', 60);
  assert(po && po.rows && po.rows.length > 0 && po.feed === 'binance-paxg', 'OMNIGOLD with no shell chain fell to PAXG and named it');
  assert(near(Wo.hgGoldIuxLastClose(po.rows), ANCHOR, 1e-6), 'and those bars are anchored');
}

/* ------------------------------------------------------------------ 6 */
console.log('== 6) the ledger: iuxShiftPct kept / refused / stamped from the one home; the note prints it ==');
{
  const W = boot(['gold-iux.js', 'hg-forward.js', 'gold-forward-read.js', 'accuracy-floor.js']);
  assert(typeof W.hgFwdRecord === 'function' && typeof W.hgFwdRecordScan === 'function', 'REACHABILITY: ledger loaded');
  const base = { tab: 'GOLDSCALP', mechanic: 'T', sym: 'XAUUSD', tf: '15m', dir: 'long', entry: 4300, stop: 4290, t1: 4320, barT: 1760000000 };
  const recOf = (extra, barT) => {
    const r = W.hgFwdRecord(Object.assign({}, base, { barT: barT || base.barT }, extra));
    const recs = W.hgFwdRecords('GOLDSCALP');
    return recs[recs.length - 1];
  };
  assert(recOf({ iuxShiftPct: 0.37 }, 1760000001).iuxShiftPct === 0.37, 'a number is kept');
  assert(recOf({ iuxShiftPct: 0 }, 1760000002).iuxShiftPct === 0, 'zero is a READ zero');
  assert(recOf({ iuxShiftPct: -1.5 }, 1760000003).iuxShiftPct === -1.5, 'a negative move is kept');
  assert(recOf({ iuxShiftPct: '0.37' }, 1760000004).iuxShiftPct === undefined, 'a string is NOT a move');
  assert(recOf({ iuxShiftPct: 7 }, 1760000005).iuxShiftPct === undefined, 'beyond 5% is a caller this log does not understand: nothing');
  assert(recOf({ iuxShiftPct: NaN }, 1760000006).iuxShiftPct === undefined && recOf({}, 1760000007).iuxShiftPct === undefined, 'NaN or absent: absent');
  /* hgFwdRecordScan stamps from the one home by the record's feed */
  W.hgGoldIuxShiftPack({ rows: mkRows(10, ANCHOR * 0.99, 900), source: 'binance-paxg' }, { px: ANCHOR, at: 1, src: 'gold-api' });
  W.hgGoldIuxShiftPack({ rows: mkRows(10, ANCHOR, 900).map(r => Object.assign({}, r, { c: ANCHOR * (1 - 0.0003) })), source: 'binance-xau' }, { px: ANCHOR, at: 1, src: 'gold-api' });
  const scanRec = (c, o) => { W.hgFwdRecordScan('GOLDSWING', '4h', [c], o || {}); const rs = W.hgFwdRecords('GOLDSWING'); return rs[rs.length - 1]; };
  const c0 = { sym: 'XAUUSD', dir: 'long', entry: 4300, stop: 4290, t1: 4320, barT: 1760000000, feed: 'binance-paxg' };
  const r0 = scanRec(c0);
  assert(r0 && typeof r0.iuxShiftPct === 'number' && near(r0.iuxShiftPct, W.hgGoldIuxShiftOf('binance-paxg'), 1e-9), 'a record naming a moved feed is stamped with that feed\'s move from the one home (' + r0.iuxShiftPct + ')');
  const r1 = scanRec(Object.assign({}, c0, { barT: 1760014400, feed: 'binance-xau' }));
  assert(r1.iuxShiftPct === 0, 'a record on a feed measured on the anchor records a READ zero');
  const r2 = scanRec(Object.assign({}, c0, { barT: 1760028800, feed: 'xm-xauusd' }));
  assert(r2.iuxShiftPct === undefined, 'a broker-feed record records nothing');
  const r3 = scanRec(Object.assign({}, c0, { barT: 1760043200, feed: undefined }));
  assert(r3.iuxShiftPct === undefined, 'a record naming no feed records nothing');
  const r4 = scanRec(Object.assign({}, c0, { barT: 1760057600, feed: 'binance-paxg', iuxShiftPct: 0.11 }));
  assert(r4.iuxShiftPct === 0.11, 'a desk hand-in wins over the shared state');
  const r5 = scanRec(Object.assign({}, c0, { barT: 1760072000, feed: undefined }), { feed: 'binance-paxg' });
  assert(typeof r5.iuxShiftPct === 'number' && r5.iuxShiftPct !== 0, 'the scan-level feed is read when the candidate names none');
  /* the reader */
  const note = W.hgGoldFwdNote('goldswing', undefined, 'binance-paxg');
  assert(/IUX ANCHOR/.test(note) && /had the bars moved onto it/.test(note) && /Gates nothing/.test(note), 'the gold note prints the IUX line once records carry the move');
  const html = W.hgGoldFwdIuxHtml(['GOLDSWING']);
  assert(/4 records priced/.test(html) && /3 had the bars moved/.test(html) && /1 sat on it/.test(html), 'the line counts measured (4: the broker and the feedless record carry none), moved (3) and on-anchor (1) records (' + html.replace(/<[^>]+>/g, '').slice(0, 120) + '…)');
  assert(W.hgGoldFwdIuxHtml(['GOLDULTRA']) === '' && W.hgGoldFwdIuxHtml([]) === '' && W.hgGoldFwdIuxHtml(null) === '', 'a pool with no record carrying the number prints NOTHING — an empty line is not a clean one');
  /* module absent: the record scan stamps nothing */
  const Wn = boot(['hg-forward.js']);
  Wn.hgFwdRecordScan('GOLDSWING', '4h', [c0], {});
  assert(Wn.hgFwdRecords('GOLDSWING')[0].iuxShiftPct === undefined, 'with gold-iux.js absent nothing is stamped');
}

/* ------------------------------------------------------------------ 7 */
console.log('== 7) end to end: the real GOLD SCALP tab on the real macro.js ==');
{
  const WED = Date.UTC(2026, 3, 8, 12, 0, 0);
  const SEC = WED / 1000;
  function tape(endMs, n, stepSec, seed, amp, scale){
    let s = seed || 99, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const rows = []; let c = 2300;
    const tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
    for (let i = 0; i < n; i++){
      const shock = (rnd() < 0.06) ? (rnd() - 0.5) * (amp || 24) : 0;
      const o = c; c = o + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
      const w = 0.8 + rnd() * 2.6;
      rows.push({ t: t0 + i * stepSec, o: o * scale, h: (Math.max(o, c) + w) * scale, l: (Math.min(o, c) - w) * scale, c: c * scale, v: 700 + rnd() * 2200 });
    }
    return rows;
  }
  const SCALE = 1;
  const tapes = { '15m': tape(WED, 420, 900, 102, 24, SCALE), '1h': tape(WED, 220, 3600, 103, 30, SCALE), '4h': tape(WED, 140, 14400, 104, 40, SCALE), '1d': tape(WED, 150, 86400, 106, 60, SCALE) };
  const feedLast = tapes['15m'][419].c;
  /* one instrument: every timeframe's last close is the same print */
  for (const tf of ['1h', '4h', '1d']){ const k = feedLast / tapes[tf][tapes[tf].length - 1].c; tapes[tf] = tapes[tf].map(r => ({ t: r.t, o: r.o * k, h: r.h * k, l: r.l * k, c: r.c * k, v: r.v })); }
  const anchorPx = feedLast * 1.006;      /* the feed sits 0.6% under the anchor */
  const files = ['gold-iux.js', 'macro.js', 'indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                 'goldind.js', 'gold-best-levels.js', 'goldscalp.js', 'accuracy-floor.js'];
  async function runTab(withModule){
    const gf = goldApiFetch(anchorPx);
    const W = boot(withModule ? files : files.filter(f => f !== 'gold-iux.js'), {
      fetch: gf,
      binanceKlines: async (sym, res, n) => (sym === 'XAUUSDT' && tapes[res]) ? tapes[res].slice(-n) : [],
      getXmGoldCandles: async () => ({ rows: [], source: null })
    }, { clock: { now: WED + 16 * 60000 } });
    const tab = (W.HG_tabs || []).find(t => t && t.id === 'goldscalp');
    const r1 = await tab.refresh();
    const snap = W.goldscalpScan();
    return { W, r1, cands: (snap && snap.cands) || [], recs: W.hgFwdRecords('GOLDSCALP'), goldApiCalls: gf.calls.filter(u => /gold-api.*#no-store$/.test(u)).length };
  }
  const r = await runTab(true);
  assert(r.r1 === 'refreshed' && r.cands.length > 0 && r.recs.length > 0, 'REACHABILITY: the headless scan ran on the real macro.js chain, minted (' + r.cands.length + ') and recorded (' + r.recs.length + ')');
  const feed15 = r.W.hgGoldIuxState().byFeed['binance-xau'];
  assert(feed15 && feed15.shifted === true && near(feed15.pct, 0.6, 1e-2), 'the 15m feed was moved onto the anchor (+' + feed15.pct.toFixed(3) + '%)');
  const onAnchor = r.cands.every(c => isFinite(+c.entry) && Math.abs(c.entry / anchorPx - 1) < 0.003);
  assert(onAnchor, 'EVERY card\'s entry sits on the anchor scale, not the feed\'s (' + r.cands.map(c => (c.entry / anchorPx).toFixed(4)).join(' ') + ')');
  const bars = r.W.hgGoldIuxState().byFeed['binance-xau'];
  assert(bars && near(bars.anchor, anchorPx, 1e-9) && near(bars.feedLast, feedLast, 1e-9), 'and the bars every level, stop and structure read were moved onto that same anchor (feedLast ' + bars.feedLast.toFixed(2) + ' -> ' + bars.anchor.toFixed(2) + ')');
  assert(r.cands.every(c => !c.spotAligned && !c.spotRealigned), 'the desk\'s own level scaler did NOT fire — the feed already sat on the anchor (residual safety net only)');
  assert(r.recs.every(x => x.feed === 'binance-xau'), 'every record names the feed it was priced on (binance-xau), not the anchor');
  assert(r.recs.every(x => typeof x.iuxShiftPct === 'number' && near(x.iuxShiftPct, 0.6, 1e-2)), 'every record carries the move the feed was given (' + r.recs[0].iuxShiftPct + ')');
  assert(r.recs.every(x => x.barT === SEC && Math.abs(x.entry / anchorPx - 1) < 0.003), 'records dated on the signal bar, their levels on the anchor scale — the scale the feed now settles on');
  const note = r.W.hgGoldFwdNote('goldscalp', undefined, 'binance-xau');
  assert(/IUX ANCHOR/.test(note), 'the desk\'s own note prints the IUX line');
  assert(r.goldApiCalls === 1, 'ONE no-store gold-api request for the whole scan: the chain anchored four timeframes and the desk read its live spot through the same cached anchor rather than its own fetch (' + r.goldApiCalls + '; macro.js\'s separate ratio read is not counted)');
  const vl = r.W.hgGoldIuxFeedLabel('binance-xau', 'BINANCE XAUUSDT');
  assert(/→ IUX$/.test(vl), 'the feed label the desk derives says the feed was moved onto IUX (' + vl + ')');
  /* the same scan with the module absent: the feed\'s own scale, and the old scaler fires on its own rule */
  const rn = await runTab(false);
  assert(rn.r1 === 'refreshed' && rn.cands.length > 0, 'REACHABILITY: module absent, the scan still runs (' + rn.cands.length + ')');
  assert(rn.recs.every(x => x.iuxShiftPct === undefined), 'module absent: no record carries a move');
  /* the pre-pack shape, kept as the measured defect: the desk enters at the live
     spot print (its mark) while its bars, its stops, its structure and the ledger
     it settles into are all on the feed's scale 0.6% below */
  assert(rn.recs.every(x => Math.abs(x.entry / anchorPx - 1) < 0.003) && feedLast < anchorPx * 0.995, 'module absent: every record enters at live spot while the bars the ledger settles on sit 0.6% under it — the hg-v979 contamination this pack removes');
  assert(Object.keys(rn.W.hgGoldIuxState ? rn.W.hgGoldIuxState().byFeed : {}).length === 0, 'module absent: no feed was measured');
}

/* ------------------------------------------------------------------ 8 */
console.log('== 8) census + hygiene ==');
{
  const idx = read('index.html'), sw = read('sw.js'), bs = read('build-stamp.js');
  const gi = strip(read('gold-iux.js'));
  /* every direct PAXG kline call in a gold file is anchored (derived, not typed) */
  const files = fs.readdirSync(ROOT).filter(f => /\.js$/.test(f));
  const paxgFiles = files.filter(f => /\b(bk|binanceKlines)\(\s*'PAXGUSDT'/.test(strip(read(f))));
  assert(paxgFiles.length >= 4, 'REACHABILITY: direct PAXG kline callers found (' + paxgFiles.join(', ') + ')');
  /* GOLD COINT is a context ledger (gold-formation.js HG_GOLD_NON_MINTERS: no levels, no ticket,
     no record) — its PAXG daily series feeds a cointegration read, not a price anyone places;
     named here, deliberately not anchored */
  const NON_MINTER_PAXG = ['goldcoint.js'];
  for (const f of paxgFiles){
    const s = strip(read(f));
    if (NON_MINTER_PAXG.indexOf(f) >= 0){ assert(!/hgGoldIuxApplyRows/.test(s), f + ': context-only, deliberately NOT anchored (named, not forgotten)'); continue; }
    assert(/hgGoldIuxApplyRows|__goldIuxApply/.test(s), f + ': its direct PAXG leg is anchored through the one home');
  }
  assert(['goldscalp.js', 'goldswing.js', 'gold-seven-step.js', 'shivagold.js', 'goldcoint.js'].every(f => paxgFiles.indexOf(f) >= 0),
    'the census found the five files whose PAXG legs the first cut missed (GOLD SCALP, GOLD SWING, the 7-step loader, SHIVA GOLD, GOLD COINT)');
  /* macro.js: all four gold packs, silver none */
  const mj = strip(read('macro.js'));
  const gc = mj.slice(mj.indexOf('async function getGoldCandles'), mj.indexOf('async function getSilverCandles'));
  assert((gc.match(/await __goldIuxApply\(/g) || []).length === 4, 'macro.js getGoldCandles anchors all four of its packs');
  const sc = mj.slice(mj.indexOf('async function getSilverCandles'), mj.indexOf('async function getUST10YCandles'));
  assert(!/__goldIuxApply/.test(sc), 'getSilverCandles anchors nothing');
  /* the hg-v1101 wrapper is gone */
  assert(!/__hgIux|XAUUSD\.iux|gold-api\.com/.test(bs) && bs.indexOf('/* HARDGATE — build stamp.') === 0, 'build-stamp.js no longer wraps fetch — the hg-v1101 shift moved into the one home');
  for (const f of files){ if (f === 'gold-iux.js') continue; assert(!/\.__hgIux|G\.__hgIux|XAUUSD\.iux/.test(strip(read(f))), f + ' carries no trace of the retired wrapper'); }
  /* load order and precache */
  const iBuild = idx.indexOf('<script src="build-stamp.js'), iIux = idx.indexOf('<script src="gold-iux.js'), iMacro = idx.indexOf('<script src="macro.js');
  assert(iBuild > 0 && iIux > iBuild && iMacro > iIux, 'index.html loads gold-iux.js after build-stamp.js and before macro.js');
  assert(/'\.\/gold-iux\.js'/.test(sw), 'sw.js precaches gold-iux.js');
  /* the one home is the only parser of the window */
  assert((gi.match(/0\.05/g) || []).length === 1 && (gi.match(/2\.5\b/g) || []).length === 1, 'the window literals live once in gold-iux.js');
  for (const f of ['goldscalp.js', 'goldswing.js', 'goldpro.js', 'goldpine.js', 'omnigold.js']){
    assert(!/'yahoo':\s*'IUX XAUUSD'/.test(read(f)) && /'yahoo':\s*'YAHOO GC=F'/.test(read(f)), f + ': the Yahoo feed is labelled YAHOO GC=F, not typed as IUX');
    assert(/hgGoldIuxFeedLabel/.test(strip(read(f))), f + ': the → IUX suffix is derived from the one home');
  }
  /* GOLD SCALP / GOLD SWING read the anchor through the one home */
  for (const f of ['goldscalp.js', 'goldswing.js']){
    const s = strip(read(f));
    /* textual on purpose (hg-v956): GOLD SWING is not driven end to end here; GOLD SCALP is, and its one-request assertion in section 7 proves the delegation behaviourally */
    assert(/var p = NaN, af = gfn\('hgGoldIuxAnchor'\);/.test(s) && /goldLiveSpotRef/.test(s), f + ': goldLiveSpotRef reads the anchor through hgGoldIuxAnchor');
  }
  /* nothing gates on the ledger field */
  for (const f of ['hg-gates.js', 'cryptogates.js', 'engine.js', 'plans.js', 'goldind.js', 'gold-best-levels.js', 'goldscalp.js', 'goldswing.js', 'omnigold.js', 'gold-formation.js']){
    assert(!/iuxShiftPct/.test(strip(read(f))), f + ' reads iuxShiftPct nowhere');
  }
  const fwd = strip(read('hg-forward.js'));
  assert(/iuxShiftPct: \(typeof rec\.iuxShiftPct === 'number'/.test(fwd) && /function iuxOf\(c\)/.test(fwd) && /iuxShiftPct: iuxOf\(c\)/.test(fwd), 'hg-forward.js names the field at the normaliser, the helper and the record assembly');
  const fwdRest = fwd.replace(/iuxShiftPct: \(typeof rec\.iuxShiftPct[^\n]*\n/, '').replace(/function iuxOf\(c\)\{[\s\S]*?\n        \}\n/, '').replace(/iuxShiftPct: iuxOf\(c\),[^\n]*\n/, '');
  assert(!/iuxShiftPct/.test(fwdRest), 'and nowhere else in the ledger — nothing settles or folds on it');
  /* stamps */
  const b = read('build-stamp.js');
  assert(b.indexOf("version: '" + HG_VER + "'") > 0, 'build-stamp version is ' + HG_VER);
  assert(swCacheOk(sw), 'sw.js HG_CACHE matches');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
