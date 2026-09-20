/* HARDGATE — CRYPTO SCAN kept losing setups and reported a clean scan.

   REPORTED SYMPTOM: "the setups in crypto scan tab are constantly losing
   setups."

   This tab's identity is "all Delta + CoinDCX futures". The universe arrives
   from xuUniverse, which fetches the two venues as separate legs and is
   explicit when one dies: it returns the survivor's rows plus a note reading
   "coindcx leg failed: <reason> — Delta India contracts only".
   hgDeskLoadUniverse carries that note through on the pack. EDGE, OMNIROUTE,
   REVERSALSNIPER and cryptogates all read it. This tab never did.

   So a failed leg silently halved the universe and the tab reported a clean
   complete scan of what was left. Driven through the real runScan over a
   16-contract universe, eight per venue, failing the CoinDCX leg on the
   second pass:

     scan 1  universe 16   14 setups (7 Delta, 7 CoinDCX)
             COVERAGE - 16 of 16 contracts read (100%)
     scan 2  universe  8    7 setups (7 Delta, 0 CoinDCX)
             COVERAGE -  8 of  8 contracts read (100%)

   Half the cards gone, "100%" both times, and the sentence that explained it
   thrown away. On the 10-minute cycle a flaky venue does that over and over.

   The counts were never wrong -- 8 of 8 WERE read. They answered a question
   nobody asked, because `universe` is whatever the loader handed over rather
   than what this tab claims to cover.

   Run: node tests/test-cryptoscan-venue-drop.mjs */
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
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const SEC = 900;

function boot(){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'sentiment.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const XU = fs.readFileSync(root + 'xuniverse.js', 'utf8');
const DESK = fs.readFileSync(root + 'desk-scan-universe.js', 'utf8');

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the loader says which leg died; this tab threw it away');
{
  ok(/coindcx leg failed: ' \+ errMsg\(c\.reason\) \+ ' — Delta India contracts only/.test(XU),
     'xuUniverse names a failed CoinDCX leg and what is left');
  ok(/delta leg failed: ' \+ errMsg\(d\.reason\)/.test(XU), 'and a failed Delta leg');
  ok(/both exchange legs failed/.test(XU), 'and both at once');
  ok(/note: note/.test(DESK) || /note: \(typeof G\.xuUniverseNote/.test(DESK),
     'hgDeskLoadUniverse carries the note out on the pack');

  /* other desks read it; this one is the whole-universe desk and did not */
  const readers = [];
  for (const f of fs.readdirSync(root)){
    if (!f.endsWith('.js')) continue;
    const src = stripComments(fs.readFileSync(root + f, 'utf8'));
    if (/\bpack\.note\b|xuUniverseNote\(\)/.test(src)) readers.push(f);
  }
  ok(readers.length >= 3, 'other desks read it (' + readers.join(', ') + ')');
  ok(readers.indexOf('cryptoscan.js') >= 0, 'and CRYPTO SCAN now does too');

  const src = stripComments(SCAN);
  ok(/note: pack\.note \|\| null,/.test(src), 'carrying it onto __results');
  ok(/venueCounts: vc, prevVenueCounts: prevVenues,/.test(src),
     'beside the venue mix, this scan and the one before it');
  ok(/var prevVenues = \(__results && __results\.venueCounts\) \? __results\.venueCounts : null;/.test(src),
     'captured BEFORE __results is replaced, or there is nothing to compare against');
  const capAt = src.indexOf('var prevVenues =');
  const setAt = src.indexOf('__results = { at: now');
  ok(capAt > 0 && capAt < setAt, 'which is what that ordering guarantees');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. csVenueDrop: a venue that shrank, not one that simply is small');
{
  ok(typeof S.__csVenueDrop === 'function', 'csVenueDrop is reachable');
  const drop = S.__csVenueDrop({ venueCounts: { delta: 8, coindcx: 0 },
                                 prevVenueCounts: { delta: 8, coindcx: 8 } });
  ok(drop.length === 1 && drop[0].venue === 'coindcx', 'the venue that went to zero is named');
  ok(drop[0].prev === 8 && drop[0].now === 0 && drop[0].lost === 8,
     'with both counts and the difference');

  ok(S.__csVenueDrop({ venueCounts: { delta: 8, coindcx: 8 },
                       prevVenueCounts: { delta: 8, coindcx: 8 } }).length === 0,
     'a steady mix is not a drop');
  ok(S.__csVenueDrop({ venueCounts: { delta: 8, coindcx: 20 },
                       prevVenueCounts: { delta: 8, coindcx: 8 } }).length === 0,
     'and neither is a venue that GREW');
  ok(S.__csVenueDrop({ venueCounts: { delta: 8, coindcx: 5 },
                       prevVenueCounts: { delta: 8, coindcx: 8 } })[0].lost === 3,
     'a partial shrink counts too — a venue does not have to die completely');

  /* the first scan of a session has nothing to compare against */
  ok(S.__csVenueDrop({ venueCounts: { delta: 8 }, prevVenueCounts: null }).length === 0,
     'the first scan claims no drop — there is no previous mix');
  ok(S.__csVenueDrop({ venueCounts: {}, prevVenueCounts: undefined }).length === 0,
     'and neither does one with nothing at all');
  ok(S.__csVenueDrop(null).length === 0, 'no coverage object does not throw');
  /* a venue that was not there before is NEW, not lost */
  ok(S.__csVenueDrop({ venueCounts: { delta: 8 }, prevVenueCounts: { delta: 8 } }).length === 0
     && S.__csVenueDrop({ venueCounts: { delta: 8, binance: 3 },
                          prevVenueCounts: { delta: 8 } }).length === 0,
     'a venue appearing for the first time is not a loss');
  /* A VENUE THAT VANISHED FROM THE COUNTS ENTIRELY, not merely went to zero.
     hgDeskVenueCounts happens to emit all five of its keys every time, so
     today a dead venue still appears as 0 — but the question is "which venues
     did we have BEFORE", so the walk has to be over `prev`. Reading `now`
     instead works only by that accident and breaks the moment a counter omits
     an empty venue. */
  const vanished = S.__csVenueDrop({ venueCounts: { delta: 8 },
                                     prevVenueCounts: { delta: 8, coindcx: 8 } });
  ok(vanished.length === 1 && vanished[0].venue === 'coindcx' && vanished[0].now === 0,
     'a venue missing from this scan\'s counts altogether is still reported lost');

  /* prev has to be an object. An array iterates as indices and would invent a
     venue called "0" with a real-looking count. */
  ok(S.__csVenueDrop({ venueCounts: {}, prevVenueCounts: [8, 3] }).length === 0,
     'a non-object previous mix is refused rather than iterated as indices');
  ok(S.__csVenueDrop({ venueCounts: {}, prevVenueCounts: 'delta' }).length === 0,
     'and so is a string');

  /* several at once, worst first */
  const two = S.__csVenueDrop({ venueCounts: { delta: 6, coindcx: 0 },
                                prevVenueCounts: { delta: 8, coindcx: 30 } });
  ok(two.length === 2 && two[0].venue === 'coindcx',
     'two shrinking venues are both named, the bigger loss first');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the words, including the ones that name the venue');
{
  const cov = { venueCounts: { delta: 120, coindcx: 84 }, prevVenueCounts: null };
  ok(/Delta 120/.test(S.__csVenueMixText(cov)) && /CoinDCX 84/.test(S.__csVenueMixText(cov)),
     'the mix uses the venues\' display names: "' + S.__csVenueMixText(cov) + '"');
  ok(S.__csVenueMixText({ venueCounts: {} }) === '', 'no counts, no mix line');
  /* hgDeskVenueCounts returns all five of its keys on every call, zeros and
     all, so the mix must not read them back verbatim */
  const real = { venueCounts: { delta: 120, coindcx: 84, binance: 0, startrader: 0, other: 0 } };
  ok(S.__csVenueMixText(real) === 'CoinDCX 84 · Delta 120',
     'venues with no contracts are left off: "' + S.__csVenueMixText(real) + '"');
  ok(!/Binance|Startrader|Other/.test(S.__csVenueMixText(real)),
     'so three dead zeros do not sit in front of the two numbers that matter');
  ok(S.__csVenueMixText({ venueCounts: { delta: 0, coindcx: 0 } }) === '',
     'and an all-zero mix says nothing rather than "Delta 0 · CoinDCX 0"');
  ok(S.__csVenueMixText(null) === '', 'and no coverage object does not throw');

  const d = S.__csVenueDropText({ venueCounts: { delta: 120, coindcx: 0 },
                                  prevVenueCounts: { delta: 120, coindcx: 84 } });
  ok(/CoinDCX 0, was 84/.test(d), 'the drop carries BOTH counts: "' + d + '"');
  ok(S.__csVenueDropText({ venueCounts: { delta: 1 }, prevVenueCounts: { delta: 1 } }) === '',
     'and says nothing when nothing shrank');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. end to end: the real runScan, a venue leg failing between scans');
{
  function tape(sd, n){
    let s2 = sd;
    const r = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
    const drift = (r() - 0.5) * 0.30, vol = 0.005 + r() * 0.020;
    const out = []; let px = 100;
    const base = Math.floor(Date.now() / 1000 / SEC) * SEC, t0 = base - n * SEC;
    for (let i = 0; i < n; i++){
      const o = px, c = px * (1 + (r() - 0.5 + drift) * vol);
      out.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * (1 + vol * 0.2),
                 l: Math.min(o, c) * (1 - vol * 0.2), v: 1000 + r() * 4000 });
      px = c;
    }
    return out;
  }
  const DELTA = [], CDCX = [];
  for (let i = 0; i < 8; i++) DELTA.push({ sym: 'D' + i, exchange: 'delta', base: 'D' + i });
  for (let i = 0; i < 8; i++) CDCX.push({ sym: 'C' + i, exchange: 'coindcx', base: 'C' + i });
  const T = {}; DELTA.concat(CDCX).forEach((it, i) => { T[it.sym] = tape(31 + i * 7919, 320); });
  const H = Math.floor(Date.now() / 1000 / 3600) * 3600, r1h = [];
  for (let i = 199; i >= 0; i--) r1h.push({ t: H - i * 3600, o: 100, c: 101, h: 102, l: 99, v: 5000 });
  S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? T[it.sym].slice() : r1h.slice());
  S.hgDeskFetchKlinesResult = async (it, tf) =>
    ({ rows: tf === '15m' ? T[it.sym].slice() : r1h.slice(), ok: true, reason: null, error: null });
  S.hgSentimentLoad = async () => ({});
  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];

  async function scan(items, note){
    S.hgDeskLoadDeltaCoinDCX = async () => ({
      items: items, rawLen: 16, note: note || null,
      venueCounts: { delta: items.filter(i => i.exchange === 'delta').length,
                     coindcx: items.filter(i => i.exchange === 'coindcx').length },
      droppedTurnover: 0, droppedVenue: 0, droppedNoTicker: 0, minTurnover: 0 });
    await tab.refresh();
    return S.cryptoScanState();
  }

  const a = await scan(DELTA.concat(CDCX), null);
  ok(a.universe === 16 && a.setups.length > 8, 'both venues up: ' + a.setups.length + ' setups from 16 contracts');
  const covA = text(S.csCoverageHTML(a));
  ok(/from CoinDCX 8 · Delta 8/.test(covA), 'the coverage line shows the mix every scan: ' + covA);
  ok(!/SHRANK/.test(covA), 'and claims no drop on the first scan');

  const b = await scan(DELTA.slice(), 'coindcx leg failed: HTTP 503 — Delta India contracts only');
  ok(b.universe === 8, 'the CoinDCX leg fails and the universe halves');
  ok(b.setups.filter(x => x.exchange === 'coindcx').length === 0, 'every CoinDCX setup is gone from the list');
  ok(a.setups.length - b.setups.length > 0,
     (a.setups.length - b.setups.length) + ' setups disappeared — the reported symptom');

  const covB = text(S.csCoverageHTML(b));
  ok(/8 of 8 contracts read \(100%\)/.test(covB),
     'the old numbers are still there and still true — 8 of 8 WERE read');
  ok(/A VENUE SHRANK SINCE THE LAST SCAN/.test(covB), 'but the line no longer stops there');
  ok(/CoinDCX 0, was 8/.test(covB), 'naming the venue and both counts');
  ok(/gone from the list above/.test(covB), 'and tying it to the setups the reader just lost');
  ok(/coindcx leg failed: HTTP 503/.test(covB), 'with the loader\'s own reason, verbatim');
  ok(/#92400E/.test(S.csCoverageHTML(b)), 'and the line is coloured as a warning');

  /* the venue recovers */
  const c = await scan(DELTA.concat(CDCX), null);
  ok(c.setups.length > b.setups.length, 'the venue comes back and the setups return');
  const covC = text(S.csCoverageHTML(c));
  ok(!/SHRANK/.test(covC), 'and no drop is claimed on the way back up: ' + covC);
  ok(/from CoinDCX 8 · Delta 8/.test(covC), 'the mix reads whole again');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the status line leads with it');
{
  const src = stripComments(SCAN);
  ok(/var venueDrop = csVenueDropText\(csCoverage\(__results\)\);/.test(src),
     'the final status line computes the drop from the run it just finished');
  ok(/\(venueDrop \? 'VENUE SHRANK — ' \+ venueDrop \+ ' · ' : ''\)/.test(src),
     'and leads with it rather than burying it after the counts');
  ok(/UTC', !!venueDrop\);/.test(src),
     'flagging the line as bad, so it is coloured like an error');
  const leadAt = src.indexOf("'VENUE SHRANK — '");
  const countAt = src.indexOf("setups.length + ' setup(s) from '");
  ok(leadAt > 0 && leadAt < countAt, 'it really is first on the line');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
