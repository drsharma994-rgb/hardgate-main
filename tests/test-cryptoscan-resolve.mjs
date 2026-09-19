/* HARDGATE — CRYPTO SCAN recorded forward evidence and never settled any of it.

   hgFwdResolve is keyed by SYMBOL and takes the bars, so a desk can only
   settle what it has candles for. CRYPTO SCAN has written 15m forward records
   since hg-v735 and has never called it once. Nothing else covers it either:
   goldultra resolves XAUUSD, every other resolver runs 4h, and hgFwdSettle
   refuses a record whose timeframe differs.

   So every row this tab has ever written sat state:'open' until
   STALE_HORIZONS (3 horizons — 18 hours at 24 bars of 15m) relabelled it
   "recorded, then the contract went quiet". That was never what happened. The
   bars existed. This scan fetches them every cycle, for every contract, and
   threw them away.

   hg-forward.js states the principle itself, about recording: "a scan that
   cannot record looks exactly like a quiet market, which is why this says so
   instead of staying silent." An unsettled log is the same lie one step later
   — a desk with no wins and no losses looks like a desk with no edge.

   The scan now resolves each symbol with the bars it already fetched, before
   deciding whether that contract produces a new setup — because a record from
   an earlier scan needs bars whether or not the contract fires again. Only
   symbols that still owe bars are touched, so the log is loaded once instead
   of once per contract across a universe of hundreds.

   Run: node tests/test-cryptoscan-resolve.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
function boot(){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of ['hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const LS = 'hg_forward_v1';
const SEC = 900, BAR = 1000 * SEC;
const wipe = () => S.localStorage.removeItem(LS);
const stored = () => JSON.parse(S.localStorage.getItem(LS) || '[]');
const row = (sym, over) => Object.assign({
  sym: sym, dir: 'long', entry: 100, stop: 95, t1: 110, mark: 100,
  mechanic: 'VOTE-WEAK@V4', barT: BAR
}, over || {});

/* ---------------------------------------------------------------- 1 */
console.log('\n1. nothing in the app was settling these records');
{
  const resolvers = [];
  for (const f of fs.readdirSync(root)){
    if (!f.endsWith('.js')) continue;
    const src = stripComments(fs.readFileSync(root + f, 'utf8'));
    const calls = src.match(/hgFwdResolve\([^)]*\)/g) || [];
    for (const c of calls) if (!/function/.test(c)) resolvers.push(f + ': ' + c);
  }
  ok(resolvers.length > 0, 'the app does resolve somewhere (' + resolvers.length + ' call sites)');
  const crypto15 = resolvers.filter(r => /'15m'/.test(r) && !/XAU/.test(r));
  ok(crypto15.length === 1 && /^cryptoscan\.js/.test(crypto15[0]),
     'and exactly one of them settles a crypto symbol at 15m, in this tab (' + crypto15.join('; ') + ')');

  const fwd = stripComments(FWD);
  ok(/\(!tf \|\| !r\.tf \|\| r\.tf === tf\)/.test(fwd),
     'hgFwdSettle refuses a record whose timeframe differs, so a 4h resolver could never have covered them');
  ok(/var STALE_HORIZONS = 3;/.test(fwd), 'and after 3 horizons an unsettled record reads as stale');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the open-symbol reader, which keeps it to one load');
{
  ok(typeof S.hgFwdOpenSyms === 'function', 'hgFwdOpenSyms is reachable');
  ok(typeof S.hgFwdOpenSymsOf === 'function', 'and its pure form beside it');

  const list = [
    { tab: 'CRYPTO SCAN', sym: 'BTCUSDT', tf: '15m', state: 'open' },
    { tab: 'CRYPTO SCAN', sym: 'BTCUSDT', tf: '15m', state: 'open' },   /* same symbol twice */
    { tab: 'CRYPTO SCAN', sym: 'ETHUSDT', tf: '15m', state: 't1' },     /* already settled */
    { tab: 'CRYPTO SCAN', sym: 'SOLUSDT', tf: '4h',  state: 'open' },   /* other timeframe */
    { tab: 'OTHER',       sym: 'DOGEUSDT', tf: '15m', state: 'open' }   /* other tab */
  ];
  const got = S.hgFwdOpenSymsOf(list, 'CRYPTO SCAN', '15m');
  ok(got.length === 1 && got[0] === 'BTCUSDT', 'one symbol, deduped, scoped to tab and timeframe');
  ok(S.hgFwdOpenSymsOf(list, 'CRYPTO SCAN').length === 2, 'no timeframe given widens to both');
  ok(S.hgFwdOpenSymsOf(list).length === 3, 'no tab given widens to every tab');
  ok(S.hgFwdOpenSymsOf(null).length === 0 && S.hgFwdOpenSymsOf([]).length === 0,
     'a missing list is empty, not a throw');
  ok(S.hgFwdOpenSymsOf([null, { state: 'open' }, { sym: 'X' }]).length === 0,
     'rows with no symbol or no open state are skipped');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. an unsettled record really was headed for "stale"');
{
  const rec = { sym: 'BTCUSDT', tf: '15m', state: 'open', barT: BAR, horizonBars: 24 };
  const justAfter = BAR + 24 * SEC;
  ok(S.hgFwdIsStale(rec, justAfter) === false, 'one horizon in, it is simply still running');
  ok(S.hgFwdIsStale(rec, BAR + 3 * 24 * SEC + 1) === true,
     'three horizons in — 18 hours at 24 bars of 15m — it reads as stale');
  ok(S.hgFwdIsStale({ sym: 'B', tf: '15m', state: 't1', barT: BAR, horizonBars: 24 },
                    BAR + 9e9) === false,
     'while a SETTLED record never does, which is the whole difference');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the scan resolves with the bars it already has');
{
  const scan = stripComments(SCAN);
  ok(/W\.hgFwdOpenSyms\('CRYPTO SCAN', '15m'\)/.test(scan),
     'runScan asks which symbols still owe bars, once, before the loop');
  ok(/resolved \+= \(W\.hgFwdResolve\(item\.sym, '15m', rows15m\) \|\| 0\)/.test(scan),
     'and settles each one with the bars that contract just returned');
  const resolveAt = scan.indexOf("hgFwdResolve(item.sym");
  const skipAt = scan.indexOf("if (!rows15m || rows15m.length < 230){ skipped++");
  ok(resolveAt > 0 && resolveAt < skipAt,
     'BEFORE the 230-bar setup test — an old record needs bars whether or not the contract fires again');
  ok(/owedN && owed\[item\.sym\]/.test(scan),
     'only symbols that owe something are touched, so the log is loaded once, not once per contract');
  ok(/owed: owedN, resolved: resolved,/.test(scan), 'both counts reach __results');
  ok(/open records settled/.test(scan), 'and the status line reports them');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. end to end: a record written by this tab now settles');
{
  wipe();
  const rows = S.__csFwdRows([{ sym: 'BTCUSDT', dir: 'long', voteTier: 'weak', isHighQuality: false,
                                price: 100, bar: { t: BAR }, plan: { entry: 100, stop: 95, t1: 110 } }]);
  ok(S.hgFwdRecordScan('CRYPTO SCAN', '15m', rows, { horizonBars: 24 }) === 1, 'the record is written');
  ok(stored()[0].state === 'open', 'and starts open, as every record does');

  const owed = S.hgFwdOpenSyms('CRYPTO SCAN', '15m');
  ok(owed.length === 1 && owed[0] === 'BTCUSDT', 'the scan would be told it owes BTCUSDT bars');

  /* the bars this tab fetches every cycle anyway */
  const bars = [{ t: BAR, h: 101, l: 99, c: 100 },
                { t: BAR + SEC, h: 111, l: 99, c: 110 },
                { t: BAR + 2 * SEC, h: 101, l: 99, c: 100 }];
  ok(S.hgFwdResolve('BTCUSDT', '15m', bars) === 1, 'resolving with them changes the record');
  ok(stored()[0].state === 't1', 'which settles as a target (' + stored()[0].state + ')');
  ok(stored()[0].fillState === 'filled',
     'and the fill-aware pass settles it too, on the same call');
  ok(S.hgFwdOpenSyms('CRYPTO SCAN', '15m').length === 0, 'so nothing is owed any more');

  /* a 4h resolver could not have done this, which is why nothing had */
  wipe();
  S.hgFwdRecordScan('CRYPTO SCAN', '15m', rows, { horizonBars: 24 });
  ok(S.hgFwdResolve('BTCUSDT', '4h', bars) === 0,
     'the same bars offered as 4h settle nothing — the timeframes have to agree');
  ok(stored()[0].state === 'open', 'and the record stays open');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
