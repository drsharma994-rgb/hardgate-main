/* HARDGATE — "SCAN ALL FUTURES" was quoting a universe two filters had shrunk.

   Two findings, both in the layer above the coverage reporting packs 869 and
   870 built.

   ONE. hgDeskLoadUniverse honours opts.includeUnknown on its xuUniverse
   branch and hardcodes `false` on its Binance fallback:

       if (passesTurnover(it, minTurn, false)) items.push(it);

   Same call, same options, two different universes. CRYPTO SCAN asks for
   { minTurnover: 0, includeUnknown: true } under a button that says SCAN ALL
   FUTURES; on the fallback path every perp whose ticker carried no turnover
   was dropped anyway, and passing includeUnknown:false gave the identical
   answer, which is how you know the option was doing nothing.

   TWO. CRYPTO SCAN records `universe: items.length` — the list it was HANDED,
   after the turnover floor and the venue filter have already run. So the
   COVERAGE line can honestly say "300 of 300 contracts read (100%)" while 180
   contracts were removed before the scan started. Measured on a ten-row
   fixture: rawLen 10, items 4, and six vanished before coverage could count
   them.

   Both close by naming the funnel rather than by loosening a filter. The
   floors are the desk's and are not moved; what changes is that the loader
   reports rawLen -> turnoverLen -> filteredLen with the reason for each drop,
   and the coverage line quotes the source universe beside the scanned one.

   Run: node tests/test-cryptoscan-universe-funnel.mjs */
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

/* four liquid, three thin, three with no turnover at all */
function rows(){
  const r = [];
  for (let i = 0; i < 4; i++) r.push({ sym: 'B-A' + i + '_USDT', base: 'A' + i, exchange: 'coindcx', turnoverUsd: 2e7 });
  for (let i = 0; i < 3; i++) r.push({ sym: 'B-S' + i + '_USDT', base: 'S' + i, exchange: 'coindcx', turnoverUsd: 1e5 });
  for (let i = 0; i < 3; i++) r.push({ sym: 'B-U' + i + '_USDT', base: 'U' + i, exchange: 'coindcx' });
  return r;
}
function useBinance(){
  delete U.xuUniverse;
  U.binancePerpUniverse = async () => ['A0USDT', 'A1USDT', 'S0USDT', 'U0USDT', 'U1USDT'];
  U.binanceTickers24h = async () => ({
    A0USDT: { turnoverUsd: 2e7 }, A1USDT: { turnoverUsd: 2e7 },
    S0USDT: { turnoverUsd: 1e5 }, U0USDT: {}, U1USDT: {}
  });
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. includeUnknown means the same thing on both paths now');
{
  U.xuUniverse = async () => rows();
  const xuOn  = await U.hgDeskLoadUniverse({ minTurnover: 5e6, includeUnknown: true });
  const xuOff = await U.hgDeskLoadUniverse({ minTurnover: 5e6, includeUnknown: false });
  ok(xuOn.items.length === 7, 'xuUniverse, includeUnknown true: 4 liquid + 3 unknown');
  ok(xuOff.items.length === 4, 'includeUnknown false: the 4 liquid only');
  ok(xuOn.items.length !== xuOff.items.length, 'so the option does something there');

  useBinance();
  const bOn  = await U.hgDeskLoadUniverse({ minTurnover: 0, includeUnknown: true });
  const bOff = await U.hgDeskLoadUniverse({ minTurnover: 0, includeUnknown: false });
  ok(bOn.items.length === 5, 'Binance fallback, includeUnknown true: all 5 perps');
  ok(bOff.items.length === 3, 'includeUnknown false: the 3 with a turnover reading');
  ok(bOn.items.length !== bOff.items.length,
     'the two answers now differ — they used to be identical, whatever was asked');

  const src = stripComments(UNI);
  ok(/if \(passesTurnover\(it, minTurn, includeUnknown\)\) items\.push\(it\);/.test(src),
     'the fallback passes the caller\'s option through');
  ok(!/passesTurnover\(it, minTurn, false\)/.test(src), 'and the hardcoded false is gone');

  /* the call CRYPTO SCAN actually makes */
  ok(/loadUni\(\{ minTurnover: 0, includeUnknown: true \}\)/.test(stripComments(SCAN)),
     'CRYPTO SCAN asks for every contract, and now gets them on either path');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the loader reports its funnel instead of one shrunk number');
{
  U.xuUniverse = async () => rows();
  const p = await U.hgDeskLoadUniverse({ minTurnover: 5e6, includeUnknown: false });
  ok(p.rawLen === 10, 'rawLen is what the source offered');
  ok(p.turnoverLen === 4 && p.droppedTurnover === 6, 'six fell to the turnover floor');
  ok(p.minTurnover === 5e6 && p.includeUnknown === false, 'and the filter it was judged by is recorded');
  ok(p.filteredLen === 4, 'filteredLen keeps its old meaning for existing callers');

  const d = await U.hgDeskLoadDeltaCoinDCX({ minTurnover: 0, includeUnknown: true });
  ok(d.rawLen === 10 && d.turnoverLen === 10 && d.filteredLen === 10,
     'a delta/coindcx-only universe loses nothing to the venue filter');
  ok(d.droppedVenue === 0, 'so droppedVenue is zero');

  U.xuUniverse = async () => rows().concat([
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'binance', turnoverUsd: 9e9 },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'binance', turnoverUsd: 9e9 }
  ]);
  const mixed = await U.hgDeskLoadDeltaCoinDCX({ minTurnover: 0, includeUnknown: true });
  ok(mixed.rawLen === 12 && mixed.turnoverLen === 12, 'twelve offered, twelve past the floor');
  ok(mixed.droppedVenue === 2 && mixed.filteredLen === 10,
     'and the two Binance rows are recorded as a VENUE drop, not silently overwritten');

  useBinance();
  const b = await U.binancePerpUniverse ? await U.hgDeskLoadUniverse({ minTurnover: 5e6, includeUnknown: false }) : null;
  ok(b.rawLen === 5 && b.turnoverLen === 2 && b.droppedTurnover === 3,
     'the Binance path reports the same funnel');
  U.binanceTickers24h = async () => ({ A0USDT: { turnoverUsd: 2e7 } });
  const noTick = await U.hgDeskLoadUniverse({ minTurnover: 0, includeUnknown: true });
  ok(noTick.droppedNoTicker === 4, 'and counts perps that had no ticker at all separately');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the scan carries the funnel into what it renders');
{
  const src = stripComments(SCAN);
  ok(/offered: \+pack\.rawLen \|\| 0/.test(src), 'runScan records what the source offered');
  ok(/droppedTurnover: \+pack\.droppedTurnover \|\| 0/.test(src), 'and each drop');
  ok(/droppedVenue: \+pack\.droppedVenue \|\| 0/.test(src), 'including the venue one');
  ok(/minTurnover: \+pack\.minTurnover \|\| 0/.test(src), 'and the floor it was judged by');

  const c = S.csCoverage({ universe: 300, scanned: 300, skipped: 10, errors: 0, unread: 60,
                           unreadWhy: { 'fetch-failed': 60 }, offered: 480,
                           droppedTurnover: 120, droppedVenue: 60, minTurnover: 5e6, setups: [] });
  ok(c.read === 230, '300 scanned less 60 unread less 10 thin leaves 230 read');
  ok(Math.round(100 * c.pct) === 77, 'which is 77% of the list the scan was handed');
  ok(Math.round(100 * c.pctOffered) === 48, 'but only 48% of what the source offered');
  ok(c.dropped === 180, 'and 180 were never offered to the scan at all');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the coverage line quotes both universes');
{
  const html = S.csCoverageHTML({ universe: 300, scanned: 300, skipped: 10, errors: 0, unread: 60,
                                  unreadWhy: { 'fetch-failed': 60 }, offered: 480,
                                  droppedTurnover: 120, droppedVenue: 60, minTurnover: 5e6, setups: [] });
  ok(/230 of 300 contracts read \(77%\)/.test(html), 'the scanned universe is still quoted');
  ok(/180 of 480 never offered to the scan/.test(html), 'and so is the source universe');
  ok(/120 under the \$5M turnover floor/.test(html), 'naming the turnover floor by its value');
  ok(/60 on other venues/.test(html), 'and the venue filter');
  ok(/48% of the source universe/.test(html), 'with the honest ceiling beside the local one');

  /* a scan that really did see everything must not grow a phantom row */
  const clean = S.csCoverageHTML({ universe: 300, scanned: 300, skipped: 0, errors: 0, unread: 0,
                                   offered: 300, droppedTurnover: 0, droppedVenue: 0, setups: [] });
  ok(/300 of 300 contracts read \(100%\)/.test(clean), 'a complete scan reads 100%');
  ok(!/never offered/.test(clean), 'and says nothing about drops that did not happen');

  /* an older __results with no funnel must still render */
  const old = S.csCoverageHTML({ universe: 300, scanned: 300, skipped: 10, errors: 0, setups: [] });
  ok(/290 of 300 contracts read/.test(old) && !/never offered/.test(old),
     'a run recorded before this pack renders without the funnel rather than with zeros');
  ok(S.csCoverage({}).dropped === 0 && S.csCoverage({}).pctOffered === null,
     'and no funnel means no claim about one');

  const sub = S.csCoverageHTML({ universe: 2, scanned: 2, offered: 5, droppedTurnover: 3,
                                 minTurnover: 250000, setups: [] });
  ok(/\$250000 turnover floor/.test(sub), 'a sub-million floor prints as its own number');
  ok(!/NaN|undefined/.test(sub), 'without NaN or undefined');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
