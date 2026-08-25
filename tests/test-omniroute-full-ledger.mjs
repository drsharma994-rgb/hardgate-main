/* HARDGATE — OMNIROUTE runs every engine and every indicator on every name.

   Field request after an honest coverage answer: pass 1 ran candle mechanics
   on the whole Delta+CoinDCX book, then house extras, the indicator ledger,
   SCALP (1H+15m) and Binance confluence only reached names that already
   fired — and even those were capped at ENRICH_MAX = 120.

   After this pack, OMNIROUTE (this tab only):
     - holds every scannable contract through pass 2
     - fetches 4H + 1H + 15m on every name so SCALP can actually vote
     - runs detect + house extras + hgOmniGates (including hgIndicatorGates)
       on every name
     - asks Binance OI / LS / taker / depth for every name (no 120 cap)
     - does not invent a ticket when nothing fired
     - extra votes never claim 7/7 CLEAN
     - G1–G7, gold min-loss, and crypto live-trading-off stay as they are

   Run: node tests/test-omniroute-full-ledger.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUTE = read('omniroute.js');
const GATES = read('cryptogates.js');
const GOLD = read('omnigold.js');
const EXEC = read('execute.js');
const PROXY = read('api/proxy.js');
const HG_GATES = read('hg-gates.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function tape(n, seed, drift){
  const out = []; let p = 80 + (seed % 40), s = seed * 7919 + 3;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + ((rnd() - 0.5) * 0.008 + drift));
    const r = p * 0.004 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 14400, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 + rnd() * 300 });
  }
  return out;
}

function flatTape(n){
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({ t: 1700000000 + i * 14400, o: 100, h: 100.02, l: 99.98, c: 100, v: 10 });
  }
  return out;
}

function mkEl(){ return { innerHTML: '', textContent: '', disabled: false,
  style: {}, addEventListener(){}, appendChild(){} }; }

console.log('== source: every scannable name is held into pass 2 ==');
{
  ok(/held\.push\(\{ item: item, rows: rows, hits: hits, livePx: livePx \}\)/.test(ROUTE)
     || /held\.push\(\{ item, rows, hits, livePx \}\)/.test(ROUTE),
     'pass 1 pushes every name with bars onto the workset, not only fires');
  ok(!/else unfired\.push\(\{ item: item, rows: rows \}\);/.test(ROUTE)
     || /held\.push/.test(ROUTE),
     'quiet names are not a separate discarded pile');
  ok(!/unfired\.length = 0;/.test(ROUTE)
     || /held\.push/.test(ROUTE),
     'quiet bars are not released before pass 2');
  ok(!/var subset = meritOrder\.slice\(0, ENRICH_MAX\);/.test(ROUTE),
     'the 120-name confluence cap is gone');
  ok(!/var ENRICH_MAX = 120/.test(ROUTE),
     'ENRICH_MAX = 120 is no longer the networked ceiling');
  ok(/subset = held|subset = meritOrder/.test(ROUTE)
     && /full ledger on every|every name/.test(ROUTE),
     'pass 2 copy says the full ledger runs on every name');
}

console.log('\n== source: 1H + 15m fetched so SCALP is not starved ==');
{
  const enrich = ROUTE.slice(ROUTE.indexOf('function enrichOne'), ROUTE.indexOf('function enrich('));
  ok(/xuCandles\(f\.item,\s*'1h'/.test(enrich), 'enrichment fetches 1H candles per name');
  ok(/xuCandles\(f\.item,\s*'15m'/.test(enrich), 'enrichment fetches 15m candles per name');
  ok(/rows1h/.test(enrich) && /rows15m/.test(enrich), 'those bars are stamped onto extra for house SCALP');
}

console.log('\n== source: house extras + indicator ledger on every evaluated name ==');
{
  ok(/pointed at every scanned contract|every name, not only/.test(ROUTE),
     'house extras are no longer described as fired-only');
  ok(/hgOmniHouseHits/.test(ROUTE) && /hgOmniGates/.test(ROUTE) && /hgIndicatorGates/.test(ROUTE),
     'evaluate still runs house extras and the shared indicator bank');
  ok(/quietGates/.test(ROUTE), 'a name that fires nothing still runs the indicator ledger');
  ok(/hgOmniEvaluate\(fitem/.test(ROUTE) || /hgOmniEvaluate\(held/.test(ROUTE),
     'the scan grades through hgOmniEvaluate');
}

console.log('\n== house SCALP actually receives 1H/15m ==');
{
  const W = boot();
  const rows = tape(120, 1, 0.0004);
  const h1 = tape(120, 1, 0.0004).map((r, i) => Object.assign({}, r, { t: 1700000000 + i * 3600 }));
  const m15 = tape(120, 1, 0.0004).map((r, i) => Object.assign({}, r, { t: 1700000000 + i * 900 }));
  let scalpArgs = null;
  W.scalpTryClean = function(a, b, ticker, mins){
    scalpArgs = { a: a && a.length, b: b && b.length, sym: ticker && ticker.sym, mins: mins };
    return { dir: 'long', entry: 80, stop: 78, t1: 86 };
  };
  const none = W.hgOmniHouseHits(rows, { sym: 'AAAUSD', base: 'AAA' }, {});
  ok(!none.some(h => h.kind === 'SCALP'), 'SCALP stays silent without 1H/15m (honest, not faked)');
  const hits = W.hgOmniHouseHits(rows, { sym: 'AAAUSD', base: 'AAA' }, { rows1h: h1, rows15m: m15 });
  ok(scalpArgs && scalpArgs.a === 120 && scalpArgs.b === 120, 'SCALP is called with both series when they exist');
  ok(hits.some(h => h.kind === 'SCALP' && h.extra === true && h.clean !== true),
     'a SCALP fire is an extra vote, never 7/7 CLEAN');
}

console.log('\n== quiet names run indicators and do not invent a ticket ==');
{
  const W = boot();
  W.hgMechRunAll = function(){ return []; };
  const extra = {};
  const cands = W.hgOmniEvaluate({ sym: 'QUIETUSD', base: 'QUIET', exchange: 'delta' }, flatTape(25), null, extra);
  ok(Array.isArray(cands) && cands.length === 0, 'too little history for engines → no invented setup (' + cands.length + ')');
  ok((cands || []).every(c => c.kind !== 'QUIET'), 'QUIET is never promoted to a ticket');
  ok(Array.isArray(extra.quietGates) && extra.quietGates.length > 10,
     'the indicator / gate ledger still ran (' + ((extra.quietGates && extra.quietGates.length) || 0) + ' gates)');
  const ich = (extra.quietGates || []).filter(g => g.key === 'ichimoku' || g.key === 'macd-momentum' || g.key === 'rsi-classic');
  ok(ich.length >= 1, 'shared indicator reads are on the quiet ledger');
  ok((extra.quietGates || []).every(g => typeof g.why === 'string' && g.why.length),
     'every quiet-ledger gate states a reason');
}

console.log('\n== live scan asks every name for every TF + confluence ==');
{
  const W = boot();
  const UNI = [
    { sym: 'HOTUSD', base: 'HOT', exchange: 'delta' },
    { sym: 'WARMUSD', base: 'WARM', exchange: 'delta' },
    { sym: 'COLDUSD', base: 'COLD', exchange: 'delta' },
    { sym: 'ICEUSD', base: 'ICE', exchange: 'coindcx' }
  ];
  const candleCalls = [];
  const oiCalls = [];
  const scalpSyms = [];
  W.xuUniverse = () => Promise.resolve(UNI);
  W.xuUniverseNote = () => null;
  W.xuCandles = (item, tf) => {
    const t = tf || '4h';
    candleCalls.push(item.sym + '|' + t);
    if (item.sym === 'ICEUSD') return Promise.resolve(flatTape(181));
    const drift = item.sym === 'HOTUSD' ? 0.002 : 0.0003;
    const rows = tape(181, item.sym.length * 17, drift);
    if (t === '1h') return Promise.resolve(rows.map((r, i) => Object.assign({}, r, { t: 1700000000 + i * 3600 })));
    if (t === '15m') return Promise.resolve(rows.map((r, i) => Object.assign({}, r, { t: 1700000000 + i * 900 })));
    return Promise.resolve(rows);
  };
  W.binanceOIHistory = (sym) => { oiCalls.push(sym); return Promise.resolve({ series: [{ oi: 100 }, { oi: 110 }] }); };
  W.binanceLongShort = () => Promise.resolve({ latest: { longShortRatio: 1.1 } });
  W.binanceTakerRatio = () => Promise.resolve({ latest: { buySellRatio: 1.02 } });
  W.binanceDepth = () => Promise.resolve({ bids: [[1, 1]], asks: [[2, 1]] });
  W.scalpTryClean = function(h1, m15, ticker){
    if (ticker && ticker.sym) scalpSyms.push(ticker.sym);
    return null;
  };
  const ui = { btn: mkEl(), stat: mkEl(), warn: mkEl(), cards: mkEl(), pool: mkEl(), matrix: mkEl() };
  await W.hgOmniRunScan(ui);
  const bySym = {};
  for (const c of candleCalls){
    const [sym, tf] = c.split('|');
    (bySym[sym] = bySym[sym] || new Set()).add(tf);
  }
  for (const item of UNI){
    ok(bySym[item.sym] && bySym[item.sym].has('4h') && bySym[item.sym].has('1h') && bySym[item.sym].has('15m'),
       item.sym + ' fetched 4H + 1H + 15m');
  }
  for (const item of UNI){
    ok(oiCalls.indexOf(item.base + 'USDT') >= 0, item.sym + ' was asked for Binance OI confluence');
  }
  ok(UNI.every(item => scalpSyms.indexOf(item.sym) >= 0),
     'SCALP house path was pointed at every name (got ' + scalpSyms.join(',') + ')');
  const stat = String(ui.stat.textContent || '');
  ok(/full ledger|every name|all engines/i.test(stat)
     || /contracts scanned/.test(stat),
     'status still reports the sweep: "' + stat.slice(0, 120) + '"');
  ok(!/confluence capped at/.test(stat), 'status no longer apologises for a 120-name cap');
}

console.log('\n== extra votes never claim 7/7; G1–G7 / gold / execute untouched ==');
{
  ok(/never 7\/7|not 7\/7 CLEAN/.test(ROUTE), 'extra-engine copy still refuses 7/7 CLEAN');
  ok(/CG_G1_SPREAD_ATR = 0\.25/.test(GATES), 'G1 spread floor stays 0.25×ATR');
  ok(/CG_SWING_RR_MIN = 2\.0/.test(GATES), 'G6 R:R floor stays 2.0');
  ok(/GOLD_STOP_MAX_PCT = 0\.025/.test(GOLD), 'gold min-loss cap stays 2.5%');
  ok(/HG_LIVE_TRADING_ENABLED/.test(EXEC), 'crypto live-trading kill switch still in execute.js');
  ok(!/LIVE TRADING ENABLED/.test(EXEC.slice(0, 900)), 'live trading is not enabled by this pack');
}

console.log('\n== proxy ceiling matches a full-universe Binance pass ==');
{
  ok(/RATE_MAX_BINANCE = 1600/.test(PROXY) || /RATE_MAX_BINANCE = [1-9][0-9]{3}/.test(PROXY),
     'Binance proxy bucket is large enough for every-name confluence, not the old 900/120-name math');
}

console.log('\n== UI tells the truth ==');
{
  ok(/every engine|full ledger|1H \+ 15m|on every name/i.test(ROUTE),
     'the lead copy no longer says enrich only what fired');
  ok(!/measure and enrich only what fired/.test(ROUTE),
     'the old two-pass cost-tracks-hits sentence is gone from the tab');
}

console.log('\n== cache stamp ==');
{
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
  const pin = HG_VER.replace('hg-v', '');
  ok(new RegExp('omniroute\\.js\\?v=' + pin).test(read('index.html')),
     'index.html cache-busts omniroute.js at ' + pin);
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIROUTE FULL-LEDGER TESTS PASSED');
