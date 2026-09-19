/* HARDGATE — a network outage was being reported as thin contracts.

   hgDeskFetchKlines swallowed every failure and returned []:

     }catch(e){}
     return [];

   Downstream, CRYPTO SCAN tests `rows15m.length < 230` and counts a miss as
   "skipped (too few bars)". So five distinct causes arrived identically:

     xuCandles threw (HTTP 451)           []  ->  "too few bars"
     the venue returned a non-array body  []  ->  "too few bars"
     no candle source wired               []  ->  "too few bars"
     no symbol could be derived           []  ->  "too few bars"
     a genuinely thin contract             3  ->  "too few bars"

   Only the last is a fact about the contract. The other four are facts about
   the fetch — and pack 869's COVERAGE line reported them as the contract,
   because it was built on a counter that already conflated them. A Binance 451
   for every symbol read out as "300 skipped, fewer than 230 closed 15m bars".

   hgDeskFetchKlines keeps its exact contract: it still resolves to an array,
   always, so every existing caller is untouched. hgDeskFetchKlinesResult adds
   { rows, ok, reason, error } beside it, CRYPTO SCAN counts `unread` apart
   from `skipped`, and the coverage line names the cause.

   Run: node tests/test-cryptoscan-fetch-cause.mjs */
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

function bootUniverse(){
  const s = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, Number, String,
              Object, Array, JSON, Date, NaN, Infinity, RegExp, Promise, Error };
  s.window = s; s.globalThis = s;
  vm.createContext(s);
  vm.runInContext(fs.readFileSync(root + 'desk-scan-universe.js', 'utf8'), s,
                  { filename: 'desk-scan-universe.js' });
  return s;
}
function bootScan(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  vm.createContext(s);
  for (const f of ['order-flow.js', 'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const U = bootUniverse();
const S = bootScan();
const UNI = fs.readFileSync(root + 'desk-scan-universe.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');

const CDCX = { exchange: 'coindcx', sym: 'B-PEPE_USDT', base: 'PEPE' };
const DELTA = { exchange: 'delta', sym: 'XRPUSD' };

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the array could never say why it was empty');
{
  ok(typeof U.hgDeskFetchKlines === 'function', 'hgDeskFetchKlines is reachable');
  ok(typeof U.hgDeskFetchKlinesResult === 'function', 'and so is the result form beside it');

  const shapes = [
    ['xuCandles threw',        () => { U.xuCandles = async () => { throw new Error('HTTP 451'); }; }],
    ['a non-array came back',  () => { U.xuCandles = async () => ({ error: 'rate limited' }); }],
    ['zero bars came back',    () => { U.xuCandles = async () => []; }],
  ];
  const lengths = new Set();
  for (const [, set] of shapes){ set(); lengths.add((await U.hgDeskFetchKlines(CDCX, '15m', 320)).length); }
  ok(lengths.size === 1 && lengths.has(0),
     'three different failures all arrive as a zero-length array');
  U.xuCandles = async () => [{ t: 1 }, { t: 2 }, { t: 3 }];
  const thin = await U.hgDeskFetchKlines(CDCX, '15m', 320);
  ok(thin.length === 3 && thin.length < 230,
     'and a genuinely thin contract lands on the same side of the 230-bar test');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the result form names the cause, and only the last is the contract');
{
  U.xuCandles = async () => { throw new Error('HTTP 451'); };
  const threw = await U.hgDeskFetchKlinesResult(CDCX, '15m', 320);
  ok(threw.ok === false && threw.reason === 'fetch-failed', 'a throw is fetch-failed');
  ok(/451/.test(threw.error || ''), 'and carries the message (' + threw.error + ')');

  U.xuCandles = async () => ({ error: 'rate limited' });
  ok((await U.hgDeskFetchKlinesResult(CDCX, '15m', 320)).reason === 'bad-shape',
     'a non-array body is bad-shape');

  U.xuCandles = async () => [{ t: 1 }, { t: 2 }, { t: 3 }];
  const good = await U.hgDeskFetchKlinesResult(CDCX, '15m', 320);
  ok(good.ok === true && good.reason === null && good.rows.length === 3,
     'a thin contract is a SUCCESSFUL fetch of three bars, not a failure');

  U.xuCandles = async () => [];
  const none = await U.hgDeskFetchKlinesResult(CDCX, '15m', 320);
  ok(none.ok === true && none.rows.length === 0,
     'and a venue that honestly returns zero bars is also a success');

  delete U.xuCandles; delete U.binanceKlines;
  ok((await U.hgDeskFetchKlinesResult(DELTA, '15m', 320)).reason === 'no-source',
     'no candle source at all is no-source');

  U.binanceKlines = async () => [{ t: 1 }];
  ok((await U.hgDeskFetchKlinesResult({ exchange: 'delta', sym: '???' }, '15m', 320)).reason === 'no-symbol',
     'a symbol that cannot be derived is no-symbol');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the old contract is untouched, including its fall-through');
{
  const src = stripComments(UNI);
  ok(/async function hgDeskFetchKlines\(item, tf, n\)\{\s*var r = await hgDeskFetchKlinesResult/.test(src),
     'hgDeskFetchKlines delegates and still resolves to an array');

  /* a non-binance venue with no xuCandles must still fall through to Binance,
     exactly as the original branch structure did */
  delete U.xuCandles;
  U.binanceKlines = async (sym) => { U.__lastSym = sym; return [{ t: 1 }, { t: 2 }]; };
  const fell = await U.hgDeskFetchKlinesResult(CDCX, '15m', 320);
  ok(fell.ok === true && fell.rows.length === 2, 'it does');
  ok(U.__lastSym === 'PEPEUSDT', 'and derives the Binance symbol the same way');

  /* and the xuCandles branch does NOT fall through on a bad shape */
  U.xuCandles = async () => null;
  U.__lastSym = null;
  const noFall = await U.hgDeskFetchKlinesResult(CDCX, '15m', 320);
  ok(noFall.reason === 'bad-shape' && U.__lastSym === null,
     'a venue that answered badly is not silently re-asked of Binance');

  for (const bad of [null, undefined, {}, { exchange: 'coindcx' }]){
    const r = await U.hgDeskFetchKlinesResult(bad, '15m', 320);
    ok(Array.isArray(r.rows) && r.ok === false, 'a junk item returns rows:[] and ok:false');
  }
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the scan counts unread apart from skipped');
{
  const src = stripComments(SCAN);
  ok(/var fetchRes = W\.hgDeskFetchKlinesResult;/.test(src), 'runScan reaches for the result form');
  ok(/: \{ rows: \(await fetchKl\(item, '15m', KL_15M\)\) \|\| \[\], ok: true, reason: null \}/.test(src),
     'and falls back to the array form if an older desk-scan-universe.js is loaded');
  ok(/if \(!got15\.ok\)\{\s*unread\+\+;/.test(src), 'a failed fetch increments unread');
  ok(/unreadWhy\[got15\.reason \|\| 'unknown'\]/.test(src), 'and records which reason');
  ok(/if \(!rows15m \|\| rows15m\.length < 230\)\{ skipped\+\+;/.test(src),
     'while skipped is now only a contract that really was too thin');
  ok(/unread: unread, unreadWhy: unreadWhy/.test(src), 'both reach __results');
  ok(/unread \+ ' unread \(fetch\)/.test(src), 'and the status line reports them');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. coverage stops calling an outage a thin contract');
{
  const OUTAGE = { universe: 300, scanned: 300, skipped: 0, errors: 0,
                   unread: 300, unreadWhy: { 'fetch-failed': 300 }, setups: [] };
  const THIN   = { universe: 300, scanned: 300, skipped: 300, errors: 0,
                   unread: 0, unreadWhy: {}, setups: [] };

  const co = S.csCoverage(OUTAGE), ct = S.csCoverage(THIN);
  ok(co.read === 0 && ct.read === 0, 'both read nothing');
  ok(co.unread === 300 && co.skipped === 0, 'but the outage is 300 unread and 0 skipped');
  ok(ct.unread === 0 && ct.skipped === 300, 'and the thin universe is the other way round');

  const ho = S.csCoverageHTML(OUTAGE), ht = S.csCoverageHTML(THIN);
  ok(/300 never fetched: the request failed \(300\)/.test(ho),
     'the outage line says the requests failed');
  ok(!/fewer than 230 closed 15m bars/.test(ho),
     'and does NOT say the contracts were too thin, which is what it used to say');
  ok(/300 skipped, fewer than 230 closed 15m bars/.test(ht),
     'while a genuinely thin universe still reads that way');
  ok(!/never fetched/.test(ht), 'without borrowing the fetch wording');

  ok(/none of the 300 contracts could be read/.test(S.csEmptyHTML(OUTAGE))
     && /300 were never fetched: the request failed/.test(S.csEmptyHTML(OUTAGE)),
     'and the empty state names the cause too');

  /* mixed causes, ordered by how many */
  const MIX = { universe: 100, scanned: 100, skipped: 10, errors: 0, unread: 60,
                unreadWhy: { 'no-source': 10, 'fetch-failed': 45, 'no-symbol': 5 }, setups: [] };
  const hm = S.csCoverageHTML(MIX);
  ok(/30 of 100 contracts read \(30%\)/.test(hm), '100 less 60 unread less 10 thin leaves 30 read');
  ok(hm.indexOf('the request failed (45)') < hm.indexOf('no candle source is wired for the venue (10)'),
     'causes are listed biggest first');
  /* the fixture above also happens to be alphabetical, so it cannot tell a
     count sort from a name sort. This one can: by name 'bad-shape' leads, by
     count 'no-symbol' does. */
  const ORDER = { universe: 100, scanned: 100, skipped: 0, errors: 0, unread: 45,
                  unreadWhy: { 'bad-shape': 5, 'no-symbol': 40 }, setups: [] };
  const ho2 = S.csCoverageHTML(ORDER);
  ok(ho2.indexOf('no symbol could be derived for the venue (40)')
     < ho2.indexOf('was not candles (5)'),
     'and by COUNT, not by the name of the reason code');
  ok(/no symbol could be derived for the venue \(5\)/.test(hm), 'and none is dropped');

  ok(S.csUnreadWhyText({ unreadWhy: {} }) === '', 'no causes renders no cause text');
  ok(S.csUnreadWhyText({}) === '' && S.csUnreadWhyText(null) === '',
     'and a missing tally does not throw');
  ok(S.csCoverage({ universe: 5, scanned: 5, unread: 9, skipped: 9 }).read === 0,
     'counts that overrun the scan still clamp at zero');
  ok(!/NaN|undefined/.test(S.csCoverageHTML({ universe: 2, scanned: 2, unread: 1,
       unreadWhy: { 'something-new': 1 }, setups: [] })),
     'an unrecognised reason code renders without NaN or undefined');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
