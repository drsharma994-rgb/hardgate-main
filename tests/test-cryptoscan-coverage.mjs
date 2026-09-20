/* HARDGATE — CRYPTO SCAN reported a broken scan as a quiet market.

   The empty state was one sentence for four different outcomes:

     "No setups found — no contracts generated signals."

   It said that whether every contract was read and none had a directional
   signal, or every contract failed to fetch, or every contract was dropped for
   having fewer than 230 closed 15m bars (cryptoultra.js MIN_15M — CoinDCX
   carries young and thin contracts that never reach it), or any mixture of the
   three. The first is a finding about the market. The other three are a
   finding about the scan, and the tab reported them as the market.

   The counts already existed: runScan tracks scanned, skipped and errors, and
   stores them on __results. They only ever reached the transient status line,
   which the next scan overwrites and which the card block never mentions —
   and the card block is where the claim is made. renderCards was not even
   handed them.

   Now the cards carry a COVERAGE line — how many contracts actually reached
   the engine, out of how many, and why the rest did not — and the empty state
   names which of the four outcomes happened. Nothing is claimed about a
   contract that was never read.

   Run: node tests/test-cryptoscan-coverage.mjs */
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
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');

/* the four outcomes, as runScan would record them */
const ALL_READ   = { universe: 300, scanned: 300, skipped: 0,   errors: 0,   setups: [] };
const ALL_FAILED = { universe: 300, scanned: 300, skipped: 0,   errors: 300, setups: [] };
const ALL_THIN   = { universe: 300, scanned: 300, skipped: 300, errors: 0,   setups: [] };
const MIXED      = { universe: 300, scanned: 300, skipped: 140, errors: 40,  setups: [] };

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the counts existed and never reached the cards');
{
  const src = stripComments(SCAN);
  /* assert the fields, not the shape of the literal: pack 871 added the
     universe funnel to this object and a whole-literal regex broke on it. */
  const results = (/__results = \{[\s\S]*?\};/.exec(src) || [''])[0];
  ok(results.length > 0, 'runScan builds a __results object');
  ok(/scanned: scanned/.test(results) && /skipped: skipped/.test(results)
     && /errors: errors/.test(results) && /universe: items\.length/.test(results),
     'recording scanned / skipped / errors / universe, as it has all along');
  ok(/renderCards\(setups, __results\)/.test(src), 'and now hands them to renderCards');
  ok(/renderCards\(__results\.setups, __results\)/.test(src),
     'including on tab re-open, which used to pass the setups alone');
  ok(!/No setups found — no contracts generated signals/.test(src),
     'the one-sentence-for-four-outcomes empty state is gone');
  ok(/rows15m\.length < 230/.test(src), 'the skip threshold is 230 closed 15m bars');
  ok(/MIN_15M = 230/.test(fs.readFileSync(root + 'cryptoultra.js', 'utf8')),
     "which is the engine's own MIN_15M, not a number this tab invented");
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. coverage counts what actually reached the engine');
{
  ok(typeof S.csCoverage === 'function', 'csCoverage is reachable');

  const c = S.csCoverage(MIXED);
  ok(c.read === 120, '300 scanned less 140 thin and 40 unfetchable leaves 120 read');
  ok(Math.round(100 * c.pct) === 40, 'which is 40% of the universe');
  ok(c.partial === true, 'and the run is flagged partial');

  ok(S.csCoverage(ALL_READ).read === 300 && S.csCoverage(ALL_READ).partial === false,
     'a clean run reads everything and is not partial');
  ok(S.csCoverage(ALL_FAILED).read === 0, 'a run where every fetch failed read nothing');
  ok(S.csCoverage(ALL_THIN).read === 0, 'and so did one where every contract was too thin');

  ok(S.csCoverage(null).known === false, 'no run at all is not a coverage claim');
  ok(S.csCoverage({}).known === false, 'and neither is an empty object');
  ok(S.csCoverage({ universe: 10 }).known === true, 'a universe alone is enough to say something');
  ok(S.csCoverage({ universe: 5, scanned: 5, skipped: 9, errors: 9 }).read === 0,
     'counts that overrun the scan clamp at zero rather than going negative');
  ok(S.csCoverage({ universe: 'x', scanned: null, skipped: undefined, errors: NaN }).read === 0,
     'and unreadable counts read as zero, never NaN');
  ok(S.csCoverage({ universe: 0, scanned: 0 }).pct === null,
     'an empty universe reports no percentage rather than dividing by zero');
  ok(S.csCoverage({ universe: 10, scanned: 10, setups: [1, 2, 3] }).signals === 3,
     'and the signal count comes off the setups list');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the empty state names which of the four outcomes happened');
{
  const read = S.csEmptyHTML(ALL_READ);
  ok(/all 300 contracts were read and none produced a directional signal/.test(read),
     'everything read, nothing found: a finding about the market');
  ok(!/finding about the scan/.test(read), 'and it is not blamed on the scan');

  const failed = S.csEmptyHTML(ALL_FAILED);
  ok(/none of the 300 contracts could be read, so the engine never ran/.test(failed),
     'every fetch failed: the engine never ran');
  ok(/finding about the scan, not about the market/.test(failed),
     'and it says so in those words');

  const thin = S.csEmptyHTML(ALL_THIN);
  ok(/the engine never ran/.test(thin),
     'every contract too thin reaches the same honest conclusion');

  const mixed = S.csEmptyHTML(MIXED);
  ok(/120 of 300 contracts reached the engine and none produced a directional signal/.test(mixed),
     'a partial run reports what it did read');
  ok(/The other 180 were never read, so nothing is claimed about them/.test(mixed),
     'and refuses to claim anything about the rest');

  ok(/has not run in this session yet/.test(S.csEmptyHTML(null)),
     'no run at all says exactly that');
  ok(S.csEmptyHTML(ALL_READ).indexOf('COVERAGE') > 0,
     'and every empty state carries the coverage line under it');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the coverage line rides the cards, not just the status bar');
{
  const html = S.csCoverageHTML(MIXED);
  ok(/COVERAGE/.test(html), 'it is labelled');
  ok(/120 of 300 contracts read \(40%\)/.test(html), 'and carries the count and the share');
  ok(/140 skipped, fewer than 230 closed 15m bars/.test(html), 'naming the thin ones');
  /* Pack 870 split this: `errors` means a throw INSIDE the loop, and a fetch
     that never delivered bars is counted separately as `unread`. Pack 882
     split it again: a crash in this app's own SCORING -- bars in hand, engine
     already voted -- is counted and worded apart from a fetch that threw,
     because one is a fact about the feed and the other is a bug here. */
  ok(/40 threw before their bars could be read/.test(html),
     'and the ones that threw before any bars arrived');
  ok(!/scoring threw/.test(html), 'with no scoring failures in this fixture, that clause is absent');
  ok(/#92400E/.test(html), 'a partial run is coloured as a warning');

  const clean = S.csCoverageHTML(ALL_READ);
  ok(/300 of 300 contracts read \(100%\)/.test(clean), 'a clean run says so');
  ok(!/skipped/.test(clean) && !/threw during the scan/.test(clean) && !/never fetched/.test(clean),
     'without inventing rows for counts that are zero');
  ok(!/#92400E/.test(clean), 'and is not coloured as a warning');

  ok(S.csCoverageHTML(null) === '', 'no run renders no coverage line');
  ok(S.csCoverageHTML({}) === '', 'and neither does an empty run object');

  const src = stripComments(SCAN);
  ok(/h \+= csCoverageHTML\(run \|\| \{ setups: setups \}\);/.test(src),
     'renderCards paints it above the cards');
  ok(src.indexOf('csCoverageHTML(run') < src.indexOf('csWhyEmptyHTML(csBlockerTally'),
     'before the WHY EMPTY panel — how much was read, then what blocked it');

  const nasty = S.csCoverageHTML({ universe: 1, scanned: 1, skipped: 0, errors: 0, setups: [] });
  ok(!/undefined|NaN/.test(nasty), 'a one-contract run renders without undefined or NaN');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. a scan that found something still says what it missed');
{
  /* the honesty gap that matters most: signals WERE found, but on 40% of the
     universe, and the footer talks about "N total signals" either way */
  const found = { universe: 300, scanned: 300, skipped: 140, errors: 40,
                  setups: [{ sym: 'BTCUSDT' }, { sym: 'ETHUSDT' }] };
  const c = S.csCoverage(found);
  ok(c.signals === 2 && c.read === 120,
     'two signals out of 120 contracts read, not out of 300');
  const html = S.csCoverageHTML(found);
  ok(/120 of 300 contracts read \(40%\)/.test(html),
     'and the coverage line says so beside the cards');
  /* the same run, with and without signals, must report the same coverage —
     finding something does not make the contracts you never read disappear */
  const bare = Object.assign({}, found, { setups: [] });
  ok(S.csCoverageHTML(found) === S.csCoverageHTML(bare),
     'the coverage line is identical whether or not the scan found anything');

  /* the numbers agree with the status line runScan already printed */
  const src = stripComments(SCAN);
  ok(/setups\.length \+ ' setup\(s\) from ' \+ scanned \+ ' scanned/.test(src),
     'the status line still reports the same run stats');
  ok(/skipped \+ ' skipped \(too few bars\) /.test(src), 'including the skips');
  ok(/errors \+ ' errors/.test(src), 'and the errors');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
