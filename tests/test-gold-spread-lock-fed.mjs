/* HARDGATE — hg-v968: the gold SPREAD LOCK had never fired, and the quote it
   needs was already on the wire.

   AGENTS.md documents it as a live hard gate: "live bid/ask wider than 250
   points / 2.5 pips ($0.25) kills the entry". It reads three globals --
   __hgGoldQuote, __hgGoldSpreadUsd, __hgGoldL2Book -- which have NINE read
   sites across four desks and ZERO writers anywhere in the repo. So
   hgGoldSpreadLock returned unchecked on every scan since it shipped.

   The quote was already being fetched. Delta's /v2/tickers/{symbol} returns a
   `quotes` object; parseDeltaTicker reached into it for mark_price and dropped
   best_bid / best_ask -- the exact two fields the lock reads. hg-v932's "the
   work was done and dropped on the way out", in the gold quote path.

   AND THE BAR IS VENUE-SPECIFIC. $0.25 is "250 points / 2.5 pips", a broker
   figure, while the desks' feed chain ends in Delta XAUTUSD and Binance PAXG --
   crypto-settled gold PROXIES. hg-v919 measured that exact asymmetry on the
   cost ceiling: 96.1% of the scalp book vetoed at PAXG against 16.4% at XM. So
   a quote naming a non-broker venue is REPORTED and never dropped, and NOTHING
   leaves any board that was not already leaving it -- today the lock drops
   nothing at all.

   Covers:
     1) the defect: nine readers, zero writers
     2) the parser keeps bid/ask, in BOTH copies (the server uses the .cjs)
     3) the shared quote reader, and its half-quote refusal
     4) the venue rule: proxy reports, broker gates, unnamed behaves as before
     5) the desks actually carry the quote into the filter
     6) fails open at every seam
   Run: node tests/test-gold-spread-lock-fed.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); } catch(e){}
  }
  return ctx;
}
const GI = ['indicators.js', 'indicators2.js', 'goldind.js'];

console.log('== 1) the defect: nine readers, zero writers ==');
{
  /* Derived, not typed: sweep the repo for the three globals and partition
     every reference into reads and writes. A hand-counted number here would be
     the stale-list defect these packs keep finding. */
  const NAMES = ['__hgGoldQuote', '__hgGoldSpreadUsd', '__hgGoldL2Book'];
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
  let reads = 0, writes = 0;
  const readers = new Set();
  for (const f of files){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const n of NAMES){
      const re = new RegExp(n + '\\s*(=[^=])?', 'g');
      let m;
      while ((m = re.exec(src))){
        if (m[2]) writes++; else { reads++; readers.add(f); }
      }
    }
  }
  assert(reads > 0, 'the spread-lock globals are READ across the desks (' + reads + ' sites in ' + readers.size + ' files)');
  assert(writes === 0,
         'and WRITTEN nowhere in the repo (' + writes + ') — which is why the lock had never fired');

  /* the gate really does go unchecked with nothing supplied */
  const W = boot(GI);
  const bare = W.hgGoldSpreadLock({});
  assert(bare.unchecked === true && bare.lock === false,
         'with no quote the lock reports UNCHECKED and drops nothing — fail open, as AGENTS.md says');
}

console.log('== 2) the parser keeps bid/ask, in BOTH copies ==');
{
  const TICK = { result: { symbol: 'XAUTUSD', mark_price: '4300.5', close: '4300.4',
    quotes: { best_bid: '4300.40', best_ask: '4300.60', mark_price: '4300.5' } } };

  const mjs = await import(path.join(ROOT, 'lib/delta-perp-history.mjs'));
  const a = mjs.parseDeltaTicker(TICK);
  assert(a.bid === 4300.4 && a.ask === 4300.6, 'the .mjs parser keeps best_bid / best_ask');
  assert(Math.abs(a.spreadUsd - 0.2) < 1e-9, 'and derives the spread in dollars (' + a.spreadUsd.toFixed(3) + ')');

  /* THE SERVER USES THE .cjs. Patching only the copy a test imports would leave
     production still dropping the quote -- the hg-v967 trap exactly, one file
     along. Both are driven here, and required to agree. */
  const api = fs.readFileSync(path.join(ROOT, 'api/delta-perp-history.js'), 'utf8');
  assert(/delta-perp-history\.cjs/.test(api),
         'the live /api route really does use the .cjs copy — so it is the one that must work');
  const req = (await import('node:module')).createRequire(import.meta.url);
  const cjs = req(path.join(ROOT, 'lib/delta-perp-history.cjs'));
  const b = cjs.parseDeltaTicker(TICK);
  assert(b.bid === a.bid && b.ask === a.ask && b.spreadUsd === a.spreadUsd,
         'the .cjs copy agrees with the .mjs on all three fields — a second copy is what drifts');

  /* nullable like every other leg */
  const none = cjs.parseDeltaTicker({ result: { symbol: 'X', mark_price: '1' } });
  assert(none.bid === null && none.ask === null && none.spreadUsd === null,
         'a ticker with no quote block yields nulls, never a fabricated spread');
  /* the half-quote case is checked on BOTH copies. Driving it on one and only
     comparing the copies on a FULL quote left a mjs-only half-quote bug
     invisible, and a mutation fabricating a spread there survived. */
  const HALF = { result: { quotes: { best_bid: '4300.40' } } };
  for (const [name, mod] of [['.cjs', cjs], ['.mjs', mjs]]){
    const half = mod.parseDeltaTicker(HALF);
    assert(half.bid === 4300.4 && half.ask === null && half.spreadUsd === null,
           name + ': ONE SIDE IS NOT A SPREAD — a half quote yields no spreadUsd (+null would have made it the price)');
  }
  assert(cjs.parseDeltaTicker({ result: { quotes: null } }).spreadUsd === null,
         'a null quote block is handled');
  assert(cjs.parseDeltaTicker(null) === null || cjs.parseDeltaTicker(null).spreadUsd === null,
         'an absent payload does not throw');
}

console.log('== 3) the shared quote reader ==');
{
  const W = boot(GI);
  assert(typeof W.hgGoldQuoteFromPerp === 'function',
         'one reader turns the perp response into a quote — four desks do not grow four ideas of it (hg-v949)');
  const q = W.hgGoldQuoteFromPerp({ ticker: { bid: 4300.4, ask: 4300.6, spreadUsd: 0.2 } }, 'delta-xaut');
  assert(q && Math.abs(q.spreadUsd - 0.2) < 1e-9 && q.venue === 'delta-xaut',
         'it carries the spread AND the venue it was measured on');
  const derived = W.hgGoldQuoteFromPerp({ ticker: { bid: 4300.4, ask: 4300.9 } }, 'xm-xauusd');
  assert(derived && Math.abs(derived.spreadUsd - 0.5) < 1e-9,
         'it derives the spread when the parser did not');
  assert(W.hgGoldQuoteFromPerp({ ticker: { bid: 4300.4 } }, 'xm') === null,
         'a HALF quote is no quote — null, never a spread equal to the price');
  assert(W.hgGoldQuoteFromPerp(null) === null && W.hgGoldQuoteFromPerp({}) === null
      && W.hgGoldQuoteFromPerp({ ticker: null }) === null,
         'absent / empty / null ticker all yield null');
  const noVenue = W.hgGoldQuoteFromPerp({ ticker: { bid: 1, ask: 1.1 } });
  assert(noVenue && noVenue.venue === undefined,
         'and an unnamed venue stays unnamed rather than being invented');
}

console.log('== 4) the venue rule ==');
{
  const W = boot(GI);
  const WIDE = 0.40, TIGHT = 0.10;
  /* unnamed venue: EXACTLY as before this pack, which is what every existing
     caller and guard sees */
  const plain = W.hgGoldSpreadLock({ spreadUsd: WIDE });
  assert(plain.lock === true && /SPREAD LOCK/.test(plain.reason),
         'a quote naming NO venue locks exactly as it always did');
  assert(W.hgGoldSpreadLock({ spreadUsd: TIGHT }).lock === false, 'and a tight one does not');

  /* broker venue: the bar is written for it, so it gates */
  const xm = W.hgGoldSpreadLock({ spreadUsd: WIDE, venue: 'xm-xauusd' });
  assert(xm.lock === true && xm.advisory === false && /SPREAD LOCK/.test(xm.reason),
         'on the broker venue the bar is written for, a wide spread LOCKS');

  /* proxy venue: reported, never dropped */
  const dx = W.hgGoldSpreadLock({ spreadUsd: WIDE, venue: 'delta-xaut' });
  assert(dx.lock === false && dx.advisory === true,
         'on a gold PROXY the same spread does NOT lock — nothing leaves a board that was not already leaving it');
  assert(/SPREAD WIDE/.test(dx.reason) && /delta-xaut/.test(dx.reason),
         'and the reason names the spread and the venue');
  assert(/hg-v919/.test(dx.reason),
         'and cites the measurement that justifies it rather than asserting a preference');
  assert(dx.venue === 'delta-xaut' && xm.venue === 'xm-xauusd',
         'the verdict carries the venue either way, so a future pack can measure this');
  const paxg = W.hgGoldSpreadLock({ spreadUsd: WIDE, venue: 'binance-paxg' });
  assert(paxg.lock === false && paxg.advisory === true, 'the other proxy behaves the same');

  /* a tight proxy spread is not advisory either — the flag means WIDE */
  assert(W.hgGoldSpreadLock({ spreadUsd: TIGHT, venue: 'delta-xaut' }).advisory === false,
         'a tight proxy spread raises nothing — advisory means wide, not merely proxy');
  assert(typeof W.hgGoldSpreadVenueOk === 'function'
      && W.hgGoldSpreadVenueOk(null) === true && W.hgGoldSpreadVenueOk('') === true,
         'an unnamed venue is treated as the bar\'s own — the pre-hg-v968 behaviour');
  assert(W.hgGoldSpreadVenueOk('XM XAUUSD') === true && W.hgGoldSpreadVenueOk('delta-xaut') === false,
         'and the venue test is case-insensitive on the broker name');
}

console.log('== 5) the desks carry the quote into the filter ==');
{
  /* The hg-v967 lesson: asserting the reader in isolation proves the RULE and
     not that anything supplies it. These lift each desk's real .then() body and
     RUN it, then read the ctx the institutional filter is handed. */
  for (const [desk, file] of [['GOLD SCALP', 'goldscalp.js'], ['GOLD SWING', 'goldswing.js']]){
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const i = src.indexOf('.then(function(j){\n            ctx.perpNative = j;');
    assert(i > 0, desk + ': the perp response handler is findable');
    const body = src.slice(i, src.indexOf('}).catch(function(){}));', i));
    assert(/hgGoldQuoteFromPerp/.test(body), desk + ': it asks the shared reader for a quote');

    const W = boot(GI);
    const ctx = {};
    const sandbox = { ctx, isFinite, console: { log(){} },
      gfn: (n) => W[n], Math, Number, String, Object, JSON };
    vm.createContext(sandbox);
    const stmt = '(function(j){' + body.slice(body.indexOf('{', body.indexOf('function(j)')) + 1) + '})';
    const fn = vm.runInContext(stmt, sandbox, { filename: file + ':perp' });
    fn({ ticker: { bid: 4300.40, ask: 4300.60, spreadUsd: 0.2 } });
    assert(Math.abs(ctx.spreadUsd - 0.2) < 1e-9,
           desk + ': the ctx the filter reads now CARRIES the spread (' + ctx.spreadUsd + ')');
    assert(ctx.bid === 4300.4 && ctx.ask === 4300.6, desk + ': and both sides of the quote');
    assert(ctx.spreadVenue === 'delta-xaut',
           desk + ': stamped with the venue it was measured on, not the bar\'s');

    /* fails open: a response with no quote leaves the ctx untouched */
    const ctx2 = {};
    const sb2 = { ctx: ctx2, isFinite, console: { log(){} }, gfn: (n) => W[n], Math, Number, String, Object, JSON };
    vm.createContext(sb2);
    vm.runInContext(stmt, sb2, { filename: file + ':perp2' })({ ticker: { bid: 4300.4 } });
    assert(ctx2.spreadUsd === undefined && ctx2.spreadVenue === undefined,
           desk + ': a half quote leaves the ctx with no spread at all');
    const ctx3 = {};
    const sb3 = { ctx: ctx3, isFinite, console: { log(){} }, gfn: () => null, Math, Number, String, Object, JSON };
    vm.createContext(sb3);
    vm.runInContext(stmt, sb3, { filename: file + ':perp3' })({ ticker: { bid: 1, ask: 2 } });
    assert(ctx3.spreadUsd === undefined,
           desk + ': with goldind absent it reaches for nothing and throws nothing');
    assert(ctx3.perpNative !== undefined, desk + ': and the perp response itself still lands');
  }

  /* and the institutional filter passes the venue through to the lock */
  const gi = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  const call = gi.slice(gi.indexOf('spreadPoints: ctx.spreadPoints'), gi.indexOf('cand.spreadLock = spr;'));
  assert(/venue: ctx\.spreadVenue/.test(call),
         'hgGoldInstFilter hands the venue to the lock — without it the proxy rule could never fire');
}

console.log('== 6) fails open at every seam ==');
{
  const W = boot(GI);
  for (const [label, src] of [['null', null], ['undefined', undefined], ['empty object', {}],
                              ['a string', 'x'], ['a number', 0], ['half quote', { bid: 4300 }],
                              ['null spread', { spreadUsd: null }]]){
    const r = W.hgGoldSpreadLock(src);
    assert(r && r.lock === false, label + ' never locks');
  }
  assert(W.hgGoldSpreadLock({ bid: 4300, ask: null }).unchecked === true,
         'a one-sided quote is NO quote, not a spread equal to the price');
  /* the threshold itself is unchanged by this pack */
  assert(W.HG_GOLD_SPREAD_MAX_USD === 0.25, 'the $0.25 bar is not moved');
  assert(/250 points \/ 2\.5 pips/.test(W.hgGoldSpreadLock({ spreadUsd: 1 }).reason),
         'and the lock still says what it always said');
}

console.log('== 7) the 3-minute refresh is VISIBLE on the tab ==');
{
  /* THE REASON THIS WAS ASKED THREE TIMES. hg-v965 put GOLD SCALP on a
     3-minute clock and hg-v967 fixed the resolution that stopped it firing --
     and the tab showed no last-scan time anywhere, so a working refresh and a
     dead one looked IDENTICAL. Two answers changed a timer the desk owner had
     no way to observe. */
  const src = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  assert(/id="' \+ p \+ 'AutoStamp"/.test(src),
         'the mount renders a stamp node — there was NO last-scan time on this tab at all before');

  const W = boot(GI.concat(['goldscalp.js']));
  /* NOT a global: exporting it tipped goldscalp past test-gold-render-integrity's
     export bar (19 -> 21), the exact v967 trap. It rides the HG_tabs registration. */
  assert(typeof W.gsAutoStampText !== 'function', 'the stamp builder is deliberately NOT a module-scope export');
  const regS = (W.HG_tabs || []).find(t => t && t.id === 'goldscalp');
  assert(regS && typeof regS.autoStampText === 'function', 'it travels on the HG_tabs registration, the single route');
  W.gsAutoStampText = regS.autoStampText;
  const now = Date.UTC(2026, 8, 25, 12, 0, 0);
  const never = W.gsAutoStampText({ lastScanAt: NaN }, now, now + 161000, 180000);
  assert(/AUTO 3m/.test(never) && /no scan yet/.test(never) && /next in 2:41/.test(never),
         'never scanned: names the cadence, says so, and counts down — "' + never + '"');
  const just = W.gsAutoStampText({ lastScanAt: now }, now, now + 161000, 180000);
  assert(/last scan/.test(just) && /next in 2:41/.test(just),
         'after a scan it shows the TIME it ran — "' + just + '"');
  const noShell = W.gsAutoStampText({ lastScanAt: now }, now, NaN, NaN);
  assert(/AUTO off/.test(noShell) && !/next in/.test(noShell),
         'with the shell clock absent it omits the countdown rather than inventing one');

  /* the painter really writes to a node -- lifted and executed, because a
     source check cannot see whether the branch is reachable (hg-v951) */
  const pm = src.match(/function gsPaintAutoStamp\(ui, scanSt\)[\s\S]*?\n\}/m);
  assert(!!pm, 'the painter is findable');
  const pctx = { console: { log(){} }, Math, Date, Number, String, Object, JSON, isFinite, isNaN,
                 W: { HG_GOLDSCALP_AUTO_MS: 180000, __hgGoldScalpAutoNext: Date.now() + 90000 },
                 gsAutoStampText: W.gsAutoStampText, __scan: {} };
  pctx.window = pctx; pctx.globalThis = pctx;
  vm.createContext(pctx);
  vm.runInContext(pm[0], pctx, { filename: 'goldscalp.js:painter' });
  const node = { textContent: '<<UNTOUCHED>>' };
  const out = pctx.gsPaintAutoStamp({ autoStamp: node }, { lastScanAt: Date.now() });
  assert(node.textContent !== '<<UNTOUCHED>>' && /AUTO 3m/.test(node.textContent),
         'it WRITES the line into the DOM node — "' + node.textContent + '"');
  assert(pctx.gsPaintAutoStamp({}, {}) === '' && pctx.gsPaintAutoStamp(null, null) === '',
         'and with no node it paints nothing rather than throwing');

  /* stamped from the scan itself, in the finally, so a FAILED scan stamps too */
  const fin = src.slice(src.indexOf('}finally{', src.indexOf('async function runScan')),
                        src.indexOf('setProg(ui, null)', src.indexOf('}finally{', src.indexOf('async function runScan'))));
  assert(/scanSt\.lastScanAt = Date\.now\(\)/.test(fin) && /gsPaintAutoStamp/.test(fin),
         'the stamp is written in runScan\'s FINALLY — a failed scan stamps too, a frozen clock is not information');

  /* THE HANG THIS PACK SHIPPED AND THE SUITE CAUGHT.

     The first cut armed the 1-second ticker at MODULE LOAD. Harmless in a
     browser; in Node it installs a real setInterval that is never cleared, so
     the event loop never drains and the process never exits -- the full suite
     stalled on test-conviction-orphan-expiry for over three minutes with no
     output. Loading this file must install NO timer. */
  {
    const timers = [];
    const probe = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
      Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
      Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
      setTimeout, clearTimeout, clearInterval: () => {},
      setInterval: (fn, ms) => { timers.push(ms); return timers.length; },
      encodeURIComponent, decodeURIComponent };
    probe.window = probe; probe.globalThis = probe; probe.self = probe;
    probe.HG_tabs = []; probe.HG_warmups = [];
    probe.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
    probe.document = { createElement: () => ({ style: {}, appendChild(){}, querySelector: () => null,
        querySelectorAll: () => [] }), getElementById: () => null, querySelector: () => null,
      querySelectorAll: () => [], head: { appendChild(){} },
      body: { appendChild(){}, contains: () => false },
      addEventListener(){}, removeEventListener(){}, readyState: 'complete' };
    probe.fetch = () => Promise.reject(new Error('no network'));
    probe.navigator = { userAgent: 'node', onLine: false };
    vm.createContext(probe);
    for (const f of GI.concat(['goldscalp.js']))
      try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), probe, { filename: f }); } catch(e){}
    assert(timers.length === 0,
           'LOADING goldscalp.js installs NO timer (' + timers.length + ') — a load-time interval never lets Node exit');
    const regP = (probe.HG_tabs || []).find(t => t && t.id === 'goldscalp');
    assert(typeof probe.gsAutoStampInit !== 'function' && regP && typeof regP.autoStampInit === 'function',
           'and the ticker is available to arm -- through the registration, not a global');
    probe.gsAutoStampInit = regP.autoStampInit;
    assert(probe.gsAutoStampInit() === 'armed' && timers.length === 1 && timers[0] === 1000,
           'arming it installs exactly one 1s ticker');
    assert(probe.gsAutoStampInit() === 'already' && timers.length === 1,
           'and a second arm installs no second timer — one page, one clock (hg-v958)');
    /* ARMED BY THE MOUNT, proved by mounting rather than by slicing source.
       The first cut read a fixed 4,000 characters after the function name and
       missed the call -- the fixed-width-slice brittleness this repo has
       corrected five times. Mount the real tab and watch the timer appear. */
    const probe2 = { ...probe };
    const t2 = [];
    const boot2 = { console: probe.console, Math, Date, Number, String, Object, Array, JSON,
      Error, TypeError, Promise, RegExp, Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
      setTimeout, clearTimeout, clearInterval: () => {},
      setInterval: (fn, ms) => { t2.push(ms); return t2.length; },
      encodeURIComponent, decodeURIComponent };
    boot2.window = boot2; boot2.globalThis = boot2; boot2.self = boot2;
    boot2.HG_tabs = []; boot2.HG_warmups = [];
    boot2.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
    const mk = () => ({ style: {}, innerHTML: '', textContent: '', className: '', disabled: false,
      dataset: {}, firstElementChild: { style: {} }, appendChild(){}, setAttribute(){},
      addEventListener(){}, removeEventListener(){},
      querySelector: () => mk(), querySelectorAll: () => [],
      classList: { add(){}, remove(){}, toggle(){}, contains: () => false } });
    boot2.document = { createElement: mk, getElementById: mk, querySelector: mk,
      querySelectorAll: () => [], head: { appendChild(){} },
      body: { appendChild(){}, contains: () => false },
      addEventListener(){}, removeEventListener(){}, readyState: 'complete' };
    boot2.fetch = () => Promise.reject(new Error('no network'));
    boot2.navigator = { userAgent: 'node', onLine: false };
    vm.createContext(boot2);
    for (const f of GI.concat(['goldscalp.js']))
      try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), boot2, { filename: f }); } catch(e){}
    assert(t2.length === 0, 'load alone still installs nothing');
    const tab = (boot2.HG_tabs || []).find(x => x && x.id === 'goldscalp');
    assert(!!tab && typeof tab.mount === 'function', 'the GOLD SCALP tab is mountable');
    try { tab.mount(mk()); } catch(e){ /* mount never throws by contract */ }
    assert(t2.length === 1 && t2[0] === 1000,
           'MOUNTING the tab arms the 1s countdown — the lifecycle where it has something to paint');
  }

  /* the shell publishes what the tab reads, so the countdown cannot drift */
  assert(/window\.__hgGoldScalpAutoNext = Date\.now\(\) \+ HG_GOLDSCALP_AUTO_MS;/.test(HTML),
         'the shell publishes when the next tick is due');
  assert(HTML.match(/__hgGoldScalpAutoNext = Date\.now\(\) \+ HG_GOLDSCALP_AUTO_MS/g).length >= 2,
         'both when the clock is armed AND on every tick — so the countdown tracks the real timer');
  assert(/window\.HG_GOLDSCALP_AUTO_MS = HG_GOLDSCALP_AUTO_MS;/.test(HTML),
         'and the cadence itself, so the tab never re-derives it');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD SPREAD LOCK TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
