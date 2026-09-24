/* HARDGATE — hg-v953: GOLD SCALP and GOLD SWING were listed covered "via own
   weekend read", and the functions the coverage reporter probes contain no
   calendar at all.

   goldind.js -- the file that houses goldScalpSetups -- had not ONE weekend
   reference in it. goldSwingSetups had none either. The read both desks were
   credited with lives in the tab SHELL, in runScan, on the WALL CLOCK. That
   is hg-v952's failure one layer down: a `via` string naming a read that
   exists somewhere other than the thing being probed.

   WHAT IT COST, BEYOND THE REPORTER. Every consumer of the mint that is not
   the tab shell got no weekend awareness at all: GOLD PINE's goldScalpSetups
   call, the OMNIGOLD bridge, STAR TRADER, and both replay harnesses. The
   swing walk's own artifact says so in its meta -- "weekend demotes" is
   listed among the runScan stages it does NOT replay -- and both walks run on
   PAXGUSDT, whose universe line in the same meta reads "24/7 weekend bars a
   broker never printed".

   MEASURED: 679 of GOLD SCALP's 2,575 committed trades (26.4%) formed inside
   the gold weekend, and that walk is what HG_GOLD_SETUP_EDGE -- the table
   deciding suppress / demote / prefer on that desk -- is measured on. The
   split moves the reading in BOTH directions and no verdict is claimed from
   it: re-derive with scripts/gold-weekend-population.mjs.

   THE FIX MARKS AND DOES NOT WITHHOLD, deliberately. The shell already
   demotes on the live path and a second withhold would move the board on
   evidence this pack did not gather; and the replay rows need the mark
   precisely so the population can be separated later, which is how NEW
   GOLD's record came to be half weekend unnoticed (hg-v949, TAURIC in v952).

   Behavioural throughout: the real mints are driven and the mark is read off
   the candidates they returned.

   Covers:
     1) reachability FIRST -- both mints actually produce candidates
     2) GOLD SCALP marks, and tells a Saturday from a Wednesday
     3) it marks and WITHHOLDS NOTHING -- same board either way
     4) GOLD SWING the same, on its own series
     5) the rejected side-channel is marked too (the replay reads it)
     6) the SIGNAL BAR decides, not the wall clock
     7) an unreadable instant yields NO verdict, never a 1970 "open"
     8) fails OPEN with the calendar absent
     9) the coverage reporter VERIFIES both routes now
    10) the walks' own meta states the two facts this pack acts on
   Run: node tests/test-gold-mint-weekend.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files, opts){
  opts = opts || {};
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  /* a wall clock we control, so section 6 can prove the mark does not read it */
  if (opts.wallMs != null){
    const W = opts.wallMs;
    function FakeDate(...a){ return a.length ? new Date(...a) : new Date(W); }
    FakeDate.prototype = Date.prototype;
    FakeDate.now = () => W;
    FakeDate.parse = Date.parse; FakeDate.UTC = Date.UTC;
    ctx.Date = FakeDate;
  } else ctx.Date = Date;
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    documentElement: { appendChild(){} },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* reported by the assertions below */ }
  }
  return ctx;
}

const BASE   = ['indicators.js', 'indicators2.js', 'gold-formation.js', 'goldind.js'];
const SWING  = BASE.concat(['goldswing.js']);
/* indicators2.js holds hgInGoldWeekend; without it there is no calendar */
const NOCAL  = ['indicators.js', 'gold-formation.js', 'goldind.js'];

/* Saturday 2026-04-11 12:00 UTC is shut under both DST offsets.
   Wednesday 2026-04-08 12:00 UTC is open. */
const SAT = Date.UTC(2026, 3, 11, 12, 0, 0);
const WED = Date.UTC(2026, 3,  8, 12, 0, 0);

/* a tape anchored by its LAST bar, so the instant the assertions talk about
   is the one the series actually ends on (the fixture bug hg-v950 hit). */
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
/* seeds chosen only because they MINT on both anchors -- a fixture that fires
   nothing passes every assertion below vacuously (hg-v950). */
const SCALP_SEED = 102, SWING_SEED = 128;
function scalpInp(end){
  return { rows15m: tapeEnding(end, 420, 900, SCALP_SEED, 24),
           rows1h:  tapeEnding(end, 220, 3600, SCALP_SEED + 1, 30),
           rows4h:  tapeEnding(end, 140, 14400, SCALP_SEED + 2, 40),
           dailyCandles: tapeEnding(end, 120, 86400, SCALP_SEED + 3, 60),
           now: end, news: null, candleSource: 'binance-paxg' };
}
function swingInp(end){
  const drift = 0.06;
  function t(n, step, seed, amp){
    let s = seed, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const rows = []; let c = 2300;
    const tEnd = Math.floor(end / 1000), t0 = tEnd - (n - 1) * step;
    for (let i = 0; i < n; i++){
      const shock = (rnd() < 0.06) ? (rnd() - 0.5) * amp : 0;
      const o = c; c = o + drift * (step / 14400) + Math.sin(i / 25) * 2.0 + (rnd() - 0.5) * 3.4 + shock;
      const w = 0.8 + rnd() * 2.6;
      rows.push({ t: t0 + i * step, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 700 + rnd() * 2200 });
    }
    return rows;
  }
  return { rows4h: t(300, 14400, SWING_SEED, 40), rows1d: t(150, 86400, SWING_SEED + 3, 60),
           now: end, news: null };
}
const board = c => [c.entry, c.stop, c.t1, c.dir, c.stratKey, !!c.demoted, !!c.vetoed].join('|');

/* ---- 1) reachability FIRST ---- */
const C = boot(BASE);
const S = boot(SWING);
assert(typeof C.goldScalpSetups === 'function', 'goldScalpSetups is exported and callable');
assert(typeof S.goldSwingSetups === 'function', 'goldSwingSetups is exported and callable');

const scSat = C.goldScalpSetups(scalpInp(SAT)) || [];
const scWed = C.goldScalpSetups(scalpInp(WED)) || [];
assert(scSat.length > 0 && scWed.length > 0,
  'REACHABILITY: the scalp mint produced candidates on both anchors (' + scSat.length + ' / ' + scWed.length + ') — nothing below can pass vacuously');

const swSatPack = S.goldSwingSetups(swingInp(SAT)) || {};
const swWedPack = S.goldSwingSetups(swingInp(WED)) || {};
const swSat = swSatPack.ranked || [], swWed = swWedPack.ranked || [];
assert(swSat.length > 0 && swWed.length > 0,
  'REACHABILITY: the swing mint produced candidates on both anchors (' + swSat.length + ' / ' + swWed.length + ')');

/* ---- 2) GOLD SCALP marks, and tells a Saturday from a Wednesday ---- */
assert(scSat.every(c => c && c.goldShut === true),
  'GOLD SCALP: every candidate minted on a Saturday bar is marked shut');
assert(scWed.every(c => c && c.goldShut === false),
  'GOLD SCALP: every candidate minted on a Wednesday bar is marked open');
assert(scSat.every(c => typeof c.goldShutWhy === 'string' && /gold weekend/i.test(c.goldShutWhy)),
  'GOLD SCALP: the shut mark carries a REASON naming the gold weekend, not a bare flag');
assert(scWed.every(c => c.goldShutWhy === undefined),
  'GOLD SCALP: an open bar carries no reason string (nothing to explain)');
assert(/24\/7|proxy|no broker/i.test(scSat[0].goldShutWhy),
  'GOLD SCALP: the reason says where a weekend gold candle came from — a 24/7 proxy in the feed chain');

/* ---- 3) it MARKS and withholds nothing ---- */
assert(scSat.length === scWed.length,
  'NO WITHHOLD: the shut scan returns the same number of candidates as the open one (' + scSat.length + ')');
assert(scSat.map(board).join('~') === scWed.map(board).join('~'),
  'NO WITHHOLD: entry / stop / t1 / dir / kind / demoted / vetoed are identical on both anchors — only the mark differs');
assert(scSat.every(c => isFinite(+c.entry) && isFinite(+c.stop)),
  'NO WITHHOLD: a shut candidate keeps real levels');

/* ---- 3b) the shared helper, driven DIRECTLY ---- */
/* Both assertions above read real candidates, and on this desk every
   candidate is ALREADY demoted (hg-v920: 84.5% of what GOLD SCALP forms can
   never lead). So "the board is identical" could not see a mutation that
   ALSO set demoted, and "best carries the mark" could not see the best branch
   removed, because best is a member of ranked and was marked by reference.
   Two mutations survived on exactly that. The helper is driven on pristine
   objects here, where every property it touches is visible. */
{
  const MARK = C.hgGoldMarkMintWeekend;
  assert(typeof MARK === 'function', 'hgGoldMarkMintWeekend is exported');
  const mk = () => ({ entry: 2300, stop: 2290, t1: 2315, dir: 'long', stratKey: 'probe' });
  const KEYS = o => Object.keys(o).sort().join(',');
  const before = KEYS(mk());

  const inRanked = mk(), inRejected = mk(), standalone = mk();
  const pack = { ranked: [inRanked], rejected: [inRejected], best: standalone };
  const v = MARK(pack, SAT);
  assert(!!v && v.inWeekend === true, 'the helper returns the verdict it applied');
  assert(inRanked.goldShut === true, 'DIRECT: a ranked row is marked');
  assert(inRejected.goldShut === true, 'DIRECT: a rejected row is marked');
  assert(standalone.goldShut === true,
    'DIRECT: a best row that is NOT a member of ranked is marked — the branch a by-reference fixture cannot test');

  /* the mark adds goldShut (+ the reason) and NOTHING else */
  const added = Object.keys(inRanked).filter(k => before.split(',').indexOf(k) < 0).sort();
  assert(added.join(',') === 'goldShut,goldShutWhy',
    'DIRECT: marking a shut row adds exactly goldShut + goldShutWhy — no demote, no veto, no stamp (' + added.join(',') + ')');
  const openRow = mk();
  MARK({ ranked: [openRow] }, WED);
  const addedOpen = Object.keys(openRow).filter(k => before.split(',').indexOf(k) < 0).sort();
  assert(addedOpen.join(',') === 'goldShut',
    'DIRECT: marking an open row adds exactly goldShut (' + addedOpen.join(',') + ')');
  assert(openRow.goldShut === false && openRow.demoted === undefined && openRow.vetoed === undefined,
    'DIRECT: neither anchor sets demoted or vetoed — this marks, it does not withhold');

  /* a plain array is the scalp shape */
  const arrRow = mk(); const arr = [arrRow]; arr.rejected = [mk()];
  MARK(arr, SAT);
  assert(arrRow.goldShut === true && arr.rejected[0].goldShut === true,
    'DIRECT: the plain-array-with-.rejected shape (what goldScalpSetups returns) is handled');

  /* fail-open on an unreadable instant, on pristine rows */
  const dead = mk(); MARK({ ranked: [dead] }, 0);
  assert(KEYS(dead) === before, 'DIRECT: an epoch-zero instant leaves the row untouched — no key added at all');
}

/* ---- 4) GOLD SWING the same, on its own series ---- */
assert(swSat.every(c => c && c.goldShut === true) && swWed.every(c => c && c.goldShut === false),
  'GOLD SWING: marks per scan from its own 4h signal bar, and tells the two anchors apart');
assert(swSat.length === swWed.length && swSat.map(board).join('~') === swWed.map(board).join('~'),
  'GOLD SWING: withholds nothing — the board is identical either way');
assert(!swSatPack.best || swSatPack.best.goldShut === true,
  'GOLD SWING: the best row carries the mark too (it is what a handoff reads)');
/* the swing pack is {ranked, best, rejected} — marking only .ranked would
   leave the other two bare, and a fixture whose best is a member of ranked
   cannot see that. Assert the rejected channel here as it is asserted for
   scalp, with reachability first. */
const swRejSat = swSatPack.rejected || [], swRejWed = swWedPack.rejected || [];
assert(swRejSat.length > 0,
  'REACHABILITY: the swing mint also produced rejected rows (' + swRejSat.length + ')');
assert(swRejSat.every(r => r && r.goldShut === true) && swRejWed.every(r => r && r.goldShut === false),
  'GOLD SWING: its rejected channel is marked too — the whole pack, not just .ranked');

/* ---- 5) the rejected side-channel is marked too ---- */
const scRejSat = scSat.rejected || [], scRejWed = scWed.rejected || [];
assert(scRejSat.length > 0,
  'REACHABILITY: the scalp mint also produced rejected rows (' + scRejSat.length + ') — the channel the replay harness reads');
assert(scRejSat.every(r => r && r.goldShut === true) && scRejWed.every(r => r && r.goldShut === false),
  'REJECTED CHANNEL: rejected rows carry the mark — backtest-goldscalp.mjs settles those rows WITH their plan');

/* ---- 6) the SIGNAL BAR decides, not the wall clock ---- */
{
  /* same inp.now, two wall clocks on opposite sides of the calendar */
  const onSat = boot(BASE, { wallMs: SAT });
  const onWed = boot(BASE, { wallMs: WED });
  const a = onSat.goldScalpSetups(scalpInp(WED)) || [];
  const b = onWed.goldScalpSetups(scalpInp(WED)) || [];
  assert(a.length > 0 && b.length > 0, 'REACHABILITY: both wall-clock runs minted');
  assert(a.every(c => c.goldShut === false) && b.every(c => c.goldShut === false),
    'SIGNAL BAR: a Wednesday scan reads OPEN whether the wall clock says Saturday or Wednesday');
  const c2 = onWed.goldScalpSetups(scalpInp(SAT)) || [];
  assert(c2.length > 0 && c2.every(c => c.goldShut === true),
    'SIGNAL BAR: a Saturday scan reads SHUT even while the wall clock says Wednesday — a Monday re-run of Friday bars gives Friday the answer');
}

/* ---- 7) an unreadable instant yields NO verdict, never a 1970 "open" ---- */
{
  const V = C.hgGoldWeekendVerdict;
  assert(typeof V === 'function', 'hgGoldWeekendVerdict is exported');
  /* 1970-01-01 is a THURSDAY, so a zero instant used to mark "gold was open" */
  assert(V(0) === null && V('') === null && V(-1) === null && V(null) === null
      && V(undefined) === null && V(NaN) === null && V('x') === null,
    'EPOCH TRAP: 0 / empty / negative / null / undefined / NaN / junk all yield NO verdict, not a cheerful 1970 "open"');
  assert(V(SAT) && V(SAT).inWeekend === true && V(WED) && V(WED).inWeekend === false,
    'real instants still resolve both ways');
  const nowless = C.goldScalpSetups(Object.assign(scalpInp(SAT), { now: 0 })) || [];
  assert(nowless.length > 0, 'REACHABILITY: the mint still ran with an unreadable instant');
  assert(nowless.every(c => c.goldShut !== true),
    'EPOCH TRAP: an unreadable instant does not silently stamp a Saturday tape as open-and-fine');
}

/* ---- 8) fails OPEN with the calendar absent ---- */
{
  const N = boot(NOCAL);
  assert(typeof N.hgInGoldWeekend !== 'function', 'fixture: the calendar really is absent');
  const got = N.goldScalpSetups(scalpInp(SAT)) || [];
  assert(got.length > 0, 'REACHABILITY: the mint still ran with no calendar loaded');
  assert(got.every(c => c.goldShut === undefined),
    'FAIL OPEN: with no calendar nothing is marked — a calendar the desk cannot read is not a reason to change a setup');
  assert(got.map(board).join('~') === scSat.map(board).join('~'),
    'FAIL OPEN: the board is byte-identical to the calendar-loaded run');
}

/* ---- 9) the coverage reporter VERIFIES both routes ---- */
{
  assert(typeof S.hgGoldWeekendCoverage === 'function', 'hgGoldWeekendCoverage is exported');
  const cov = S.hgGoldWeekendCoverage();
  const row = d => cov.covered.find(r => r.desk === d);
  assert(cov.verified.indexOf('GOLD SCALP') >= 0,
    'REPORTER: GOLD SCALP is VERIFIED — its route was called and told the two instants apart');
  assert(cov.verified.indexOf('GOLD SWING') >= 0, 'REPORTER: GOLD SWING is VERIFIED');
  assert(row('GOLD SCALP') && row('GOLD SCALP').proof === 'verified'
      && row('GOLD SWING') && row('GOLD SWING').proof === 'verified',
    'REPORTER: both rows say proof=verified, not the author-claim bucket they were in');
  const mint = S.HG_GOLD_WEEKEND_MINTERS || [];
  const m = d => mint.find(r => r.desk === d);
  assert(m('GOLD SCALP') && !/own weekend read/.test(m('GOLD SCALP').via)
      && m('GOLD SWING') && !/own weekend read/.test(m('GOLD SWING').via),
    'REPORTER: neither via string still claims the probed function has "own weekend read"');
  assert(m('GOLD SCALP').verdictFn === 'goldScalpWeekendVerdict'
      && m('GOLD SWING').verdictFn === 'goldSwingWeekendVerdict',
    'REPORTER: each row names a callable route rather than a prose claim');
  assert(typeof S.goldScalpWeekendVerdict === 'function' && typeof S.goldSwingWeekendVerdict === 'function',
    'both routes are exported');
  assert(!!S.goldScalpWeekendVerdict(SAT) && S.goldScalpWeekendVerdict(WED) === null
      && !!S.goldSwingWeekendVerdict(SAT) && S.goldSwingWeekendVerdict(WED) === null,
    'both routes answer truthy-when-shut / null-when-open, the shape the probe requires');
  /* the buckets must still partition, with these two moved */
  const tot = cov.covered.length + cov.uncovered.length + cov.notLoaded.length;
  assert(tot === mint.length, 'REPORTER: the buckets still partition the desk list (' + tot + '/' + mint.length + ')');
  assert(cov.verified.length + cov.claimed.length + cov.broken.length === cov.covered.length,
    'REPORTER: verified + claimed + broken partitions covered');
  assert(cov.broken.length === 0, 'REPORTER: no route reports BROKEN (' + cov.broken.join(', ') + ')');
}

/* ---- 10) the walks' own meta states the two facts this pack acts on ---- */
{
  const sw = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/backtest-goldswing-results.json'), 'utf8'));
  const sc = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/backtest-goldscalp-results.json'), 'utf8'));
  const devs = [].concat(sw.meta.deviations || [], sw.meta.limitations || []).join(' ');
  assert(/weekend demotes/i.test(devs) && /not replayed|are not replayed/i.test(devs),
    'QUOTED, not asserted: the swing walk\'s own meta lists weekend demotes among the stages it does NOT replay');
  assert(/24\/7/.test(String(sc.meta.universe)) && /24\/7/.test(String(sw.meta.universe)),
    'QUOTED: both walks declare a 24/7 universe in their own meta');
  /* and the split is re-derivable rather than transcribed */
  const script = fs.readFileSync(path.join(ROOT, 'scripts/gold-weekend-population.mjs'), 'utf8');
  assert(/backtest-goldscalp-results\.json/.test(script) && /backtest-goldswing-results\.json/.test(script),
    'the population script covers both gold walks, so the split can be re-derived rather than believed');
  assert(!/22:00|Friday|Sunday/.test(script.split('const WALKS')[1] || ''),
    'the population script still contains no calendar arithmetic of its own below its walk list');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
