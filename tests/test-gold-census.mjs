/* HARDGATE — hg-v954: the coverage reporter's own desk list was HAND-TYPED,
   which is the exact mechanism that produced its two previous blind spots.

   hg-v951 added the inline GOLD tab to that list by noticing. hg-v952 added
   TAURIC by noticing. Each was written up as a blind spot fixed, and the
   thing that produced both -- a desk list kept by hand, inside the reporter
   built so that gaps name themselves -- was never touched.

   The shell's GOLD nav group holds SEVENTEEN tabs. The reporter listed
   TWELVE. The five missing: MILLI GOLD, GOLD DIRECTION, GOLD ULTRA,
   GOLD SPOT, GOLD COINT.

   TWO OF THEM WRITE ticket:true XAUUSD ROWS INTO THE FORWARD LEDGER with no
   weekend reference of any kind. That is stronger than the TAURIC case
   hg-v952 wired: those rows record ticket:false, so hg-v952 could say there
   was no ticket to withhold. These record TICKETS. A weekend-formed pick
   entered the ledger as tradeable and would be judged as one -- the
   contamination hg-v949 measured on NEW GOLD, running in two more ledgers.
   GOLD ULTRA's only two mentions of the word "weekend" are PROSE in its walk
   metadata, saying its universe carries "24/7 weekend bars a broker never
   printed": the desk documented the contamination and did nothing about it.

   The other three are classified, not wired: MILLI GOLD inherits OMNIGOLD
   (since hg-v938 it renders cards OMNIGOLD already evaluated, so a second
   calendar here would be a second calendar), and GOLD SPOT / GOLD COINT are
   context tabs -- which is ASSERTED behaviourally below, not assumed.

   The census is derived by EXECUTING index.html's nav statement rather than
   grepping it (the hg-v951 lesson, after four brittle source-slice guards).

   Covers:
     1) the shell's gold group is read by running its own statement
     2) every gold tab is classified -- minter or non-minter, no gaps
     3) the runtime reporter names a gap, and is not vacuous
     4) an unreadable registry reports NULL, never "no gaps"
     5) GOLD DIRECTION marks its ticket row, on the 1h signal bar
     6) GOLD ULTRA marks its ticket row, on the 15m signal bar
     7) both MARK and withhold nothing -- the ticket is still written
     8) both fail OPEN
     9) GOLD SPOT and GOLD COINT really do not mint
    10) the reporter verifies both new routes
   Run: node tests/test-gold-census.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files, extra){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
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
  if (typeof extra === 'function') extra(ctx);
  return ctx;
}
const CAL = ['indicators.js', 'indicators2.js', 'gold-formation.js'];

/* ---- 1) the shell's gold group, by RUNNING its own statement ---- */
/* A regex over `tabs:[...]` is the brittle shape this session corrected four
   times. The declaration is lifted whole and executed instead, so it is the
   real value the shell builds -- not a reading of its punctuation. */
let NAV = null;
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf('const HG_NAV_GROUPS = [');
  assert(i > 0, 'index.html declares HG_NAV_GROUPS');
  const end = html.indexOf('\n];', i);
  assert(end > i, 'the declaration terminates');
  const stmt = html.slice(i, end + 3);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(stmt + '\nthis.out = HG_NAV_GROUPS;', sandbox, { filename: 'nav-lift' });
  NAV = sandbox.out;
  assert(Array.isArray(NAV) && NAV.length > 0, 'the lifted statement RAN and produced the real array');
}
const goldGroup = (NAV || []).find(g => g && g.id === 'gold');
assert(!!goldGroup && Array.isArray(goldGroup.tabs) && goldGroup.tabs.length > 0,
  'the shell has a GOLD nav group with tabs (' + (goldGroup ? goldGroup.tabs.length : 0) + ')');

/* ---- 2) every gold tab is classified ---- */
const F = boot(CAL);
const MINT = F.HG_GOLD_WEEKEND_MINTERS || [];
const NON  = F.HG_GOLD_NON_MINTERS || [];
assert(MINT.length > 0 && NON.length > 0, 'both classification lists are exported');
{
  const known = new Map();
  for (const m of MINT) known.set(m.tab, 'minter');
  for (const n of NON)  known.set(n.tab, 'non-minter');
  const gaps = goldGroup.tabs.filter(t => !known.has(t));
  assert(gaps.length === 0,
    'CENSUS: every gold tab in the shell is classified here — gaps: [' + gaps.join(', ') + ']');
  /* and nothing is classified twice, or the partition is a fiction */
  const both = MINT.filter(m => NON.some(n => n.tab === m.tab)).map(m => m.tab);
  assert(both.length === 0, 'CENSUS: no tab is both a minter and a non-minter (' + both.join(', ') + ')');
  const strays = [...known.keys()].filter(t => goldGroup.tabs.indexOf(t) < 0);
  assert(strays.length === 0, 'CENSUS: nothing is classified that the shell does not list (' + strays.join(', ') + ')');
  assert(MINT.every(m => m.tab) && NON.every(n => n.tab),
    'every row carries the tab id the census matches on');
  /* the five hg-v954 found */
  for (const t of ['milligold', 'golddirection', 'goldultra', 'goldspot', 'goldcoint'])
    assert(known.has(t), 'the previously-absent tab ' + t + ' is classified (' + known.get(t) + ')');
  /* a length check is not a claim. Each `why` must state the OPERATIVE fact
     — the thing section 9 below proves behaviourally — or name what it
     inherits, so the prose and the test are about the same thing. */
  assert(NON.every(n => typeof n.why === 'string'
      && (/no (forward )?record|no levels|no ticket|no spread execution|writes no|prices no/i.test(n.why)
          || /inherits/i.test(n.why))),
    'each non-minter states the operative fact (writes no record / prices no levels) or names what it inherits');
  assert(NON.filter(n => !n.inherits).every(n => /record|ticket|levels|execution/i.test(n.why)),
    'a non-inheriting non-minter says specifically what it does NOT produce');
  assert((NON.find(n => n.tab === 'milligold') || {}).inherits === 'OMNIGOLD',
    'MILLI GOLD is recorded as INHERITING OMNIGOLD, not as having no calendar');
}

/* ---- 3) the runtime reporter names a gap, and is not vacuous ---- */
{
  const G = boot(CAL, c => { c.HG_NAV_GROUPS = JSON.parse(JSON.stringify(NAV)); });
  const r = G.hgGoldWeekendCensusGaps();
  assert(r && Array.isArray(r.gaps), 'hgGoldWeekendCensusGaps reads the registry when it is reachable');
  assert(r.gaps.length === 0 && r.classified === goldGroup.tabs.length,
    'reporter: no gaps against the real registry (' + r.classified + '/' + goldGroup.tabs.length + ')');
  /* NOT VACUOUS: push a synthetic gold tab and require it to be reported.
     A checker that can never report anything is a rubber stamp (hg-v950). */
  const G2 = boot(CAL, c => {
    const nav = JSON.parse(JSON.stringify(NAV));
    nav.find(g => g.id === 'gold').tabs.push('goldbrandnew');
    c.HG_NAV_GROUPS = nav;
  });
  const r2 = G2.hgGoldWeekendCensusGaps();
  assert(r2 && r2.gaps.length === 1 && r2.gaps[0] === 'goldbrandnew',
    'NOT VACUOUS: a gold tab the shell adds and this list does not know is REPORTED');
}

/* ---- 4) an unreadable registry reports NULL, never "no gaps" ---- */
{
  const N = boot(CAL);
  assert(N.hgGoldWeekendCensusGaps() === null,
    'no registry -> null, NOT an empty gap list — an unreadable census is not a clean one');
  const E = boot(CAL, c => { c.HG_NAV_GROUPS = [{ id: 'crypto', tabs: ['swing'] }]; });
  assert(E.hgGoldWeekendCensusGaps() === null, 'a registry with no gold group -> null');
}

/* Saturday 2026-04-11 is shut; Wednesday 2026-04-08 is open. */
const SAT = Date.UTC(2026, 3, 11, 12, 0, 0);
const WED = Date.UTC(2026, 3,  8, 12, 0, 0);
function bars(endMs, n, stepSec){
  const rows = [], tEnd = Math.floor(endMs / 1000), t0 = tEnd - (n - 1) * stepSec;
  for (let i = 0; i < n; i++) rows.push({ t: t0 + i * stepSec, o: 2300, h: 2304, l: 2296, c: 2301, v: 900 });
  return rows;
}

/* ---- 5) GOLD DIRECTION marks its ticket row, on the 1h signal bar ---- */
{
  const D = boot(CAL.concat(['golddirection.js']), c => {
    /* a wall clock on the OPPOSITE side of the calendar from the bars, so a
       mark taken from Date.now() would give the wrong answer and be caught */
    const W = WED;
    function FakeDate(...a){ return a.length ? new Date(...a) : new Date(W); }
    FakeDate.prototype = Date.prototype; FakeDate.now = () => W;
    FakeDate.parse = Date.parse; FakeDate.UTC = Date.UTC;
    c.Date = FakeDate;
  });
  assert(typeof D.hgGoldDirectionRecordForward === 'function', 'GOLD DIRECTION: recordForward is exported');
  assert(typeof D.gdWeekendVerdict === 'function', 'GOLD DIRECTION: its route is exported');

  const written = [];
  D.hgFwdRecordScan = (desk, tf, rows, opts) => { written.push({ desk, tf, rows, opts }); };
  const pick = d => ({ dir: d, entry: 2300, stop: 2290, t1: 2315, stratKey: 'probe', strategy: 'PROBE' });

  D.hgGoldDirectionRecordForward({ pick: pick('long') }, { pick: null }, { rows1h: bars(SAT, 60, 3600) });
  assert(written.length === 1 && written[0].rows.length === 1,
    'REACHABILITY: a record was actually written (' + written.length + ') — nothing below passes vacuously');
  const satRow = written[0].rows[0];
  assert(satRow.ticket === true, 'the row is still a TICKET — the mark withholds nothing');
  assert(satRow.goldShut === true, 'a Saturday 1h signal bar is marked shut');
  assert(typeof satRow.goldShutWhy === 'string' && /gold weekend/i.test(satRow.goldShutWhy),
    'the mark carries a reason naming the gold weekend');
  assert(satRow.entry === 2300 && satRow.stop === 2290 && satRow.t1 === 2315 && satRow.dir === 'long',
    'the levels and direction are untouched');
  assert(/GOLDDIRECTION/.test(written[0].desk), 'written under its own desk name');

  written.length = 0;
  D.hgGoldDirectionRecordForward({ pick: pick('long') }, { pick: null }, { rows1h: bars(WED, 60, 3600) });
  assert(written.length === 1 && written[0].rows[0].goldShut === false,
    'a Wednesday 1h signal bar is marked open');
  assert(written[0].rows[0].goldShutWhy === undefined, 'an open row carries no reason (nothing to explain)');
  assert(!!D.gdWeekendVerdict(SAT) && D.gdWeekendVerdict(WED) === null,
    'the route answers truthy-when-shut / null-when-open');
}

/* ---- 6+7) GOLD ULTRA: the same, on its own 15m series ---- */
{
  const U = boot(CAL.concat(['goldultra.js']));
  assert(typeof U.guWeekendVerdict === 'function', 'GOLD ULTRA: its route is exported');
  assert(typeof U.__guSignalSec === 'function', 'GOLD ULTRA: its signal-bar reader is exported');
  assert(U.__guSignalSec({ rows15m: bars(SAT, 40, 900) }) === Math.floor(SAT / 1000),
    'GOLD ULTRA reads the LAST closed bar of its own 15m series');
  assert(U.__guSignalSec({ rows15m: [] }) === null && U.__guSignalSec(null) === null,
    'GOLD ULTRA: an empty or absent series yields no instant');
  assert(U.__guSignalSec({ rows15m: [{ t: 0, c: 1 }] }) === null,
    'GOLD ULTRA: an epoch-zero last bar yields NO instant, not 0 (the reader\'s own contract)');
  assert(!!U.guWeekendVerdict(SAT) && U.guWeekendVerdict(WED) === null,
    'GOLD ULTRA: the route tells the two instants apart');
  /* the row shape it builds, driven through the same rule the file uses */
  const shut = U.guWeekendVerdict(U.__guSignalSec({ rows15m: bars(SAT, 40, 900) }));
  assert(!!shut && /24\/7|proxy|no broker/i.test(shut.why),
    'GOLD ULTRA: the reason says where a weekend gold candle came from');
}

/* ---- 7b) GOLD ULTRA's REAL record statement, lifted and run ---- */
/* The helpers above are not the shipped path, and asserting only on them is
   the hg-v952 TAURIC failure repeated — four mutations survived against the
   helper-only checks, including the mark being deleted outright. The real
   block is lifted out of goldultra.js and EXECUTED under stubs (hg-v951), so
   what is driven is the shipped statement, not a restatement of it. */
{
  const src = fs.readFileSync(path.join(ROOT, 'goldultra.js'), 'utf8');
  const from = src.indexOf('      var guWk = guWeekendFull(guSignalSec(f));');
  assert(from > 0, 'LIFT: the record block is locatable in goldultra.js');
  const marker = "W.hgFwdRecordScan('GOLDULTRA', '15m', [guRow]";
  const at = src.indexOf(marker, from);
  assert(at > from, 'LIFT: the hgFwdRecordScan call follows it');
  const to = src.indexOf('\n', at);
  const block = src.slice(from, to);
  assert(/guWk/.test(block) && /hgFwdRecordScan/.test(block), 'LIFT: the block carries both halves');

  function runLift(rows15m){
    const U = boot(CAL.concat(['goldultra.js']), c => {
      /* wall clock on the OPPOSITE side of the calendar from the bars */
      const WM = WED;
      function FakeDate(...a){ return a.length ? new Date(...a) : new Date(WM); }
      FakeDate.prototype = Date.prototype; FakeDate.now = () => WM;
      FakeDate.parse = Date.parse; FakeDate.UTC = Date.UTC;
      c.Date = FakeDate;
    });
    const written = [];
    U.hgFwdRecordScan = (desk, tf, rows, opts) => written.push({ desk, tf, rows, opts });
    /* built INSIDE the module's own context, so the shipped statement runs
       against the real loaded globals rather than a copy of them */
    vm.runInContext(
      'this.__liftRun = function(guWeekendFull, guSignalSec, f, sel, W, RULE){\n'
      + block + '\n};', U, { filename: 'goldultra-lift' });
    U.__liftRun(U.__guWeekendFull, U.__guSignalSec,
      { rows15m: rows15m },
      { pick: { dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'probe' } },
      U, { timeoutBars: 24 });
    return written;
  }

  const wSat = runLift(bars(SAT, 40, 900));
  assert(wSat.length === 1 && wSat[0].rows.length === 1,
    'REACHABILITY: the lifted statement RAN and wrote a record');
  const rs = wSat[0].rows[0];
  assert(rs.ticket === true, 'GOLD ULTRA: the row is still a TICKET — the mark withholds nothing');
  assert(rs.goldShut === true, 'GOLD ULTRA: a Saturday 15m signal bar is marked shut, on the REAL path');
  assert(typeof rs.goldShutWhy === 'string' && /gold weekend/i.test(rs.goldShutWhy),
    'GOLD ULTRA: the mark carries its reason on the real path');
  assert(rs.entry === 2300 && rs.stop === 2290 && rs.t1 === 2315 && rs.sym === 'XAUUSD',
    'GOLD ULTRA: levels and symbol untouched');
  assert(wSat[0].desk === 'GOLDULTRA' && wSat[0].tf === '15m', 'GOLD ULTRA: written under its own desk and timeframe');

  const wWed = runLift(bars(WED, 40, 900));
  assert(wWed.length === 1 && wWed[0].rows[0].goldShut === false,
    'GOLD ULTRA: a Wednesday 15m signal bar is marked OPEN — open and unreadable stay distinguishable');
  assert(wWed[0].rows[0].goldShutWhy === undefined, 'GOLD ULTRA: an open row carries no reason');

  /* the wall clock says Wednesday in both runs, so a mark taken from
     Date.now() would read open on the Saturday tape too */
  assert(rs.goldShut === true,
    'GOLD ULTRA SIGNAL BAR: the Saturday tape reads SHUT while the wall clock says Wednesday');

  const wZero = runLift([{ t: 0, o: 1, h: 1, l: 1, c: 1, v: 1 }]);
  assert(wZero.length === 1 && wZero[0].rows[0].goldShut === undefined && wZero[0].rows[0].ticket === true,
    'GOLD ULTRA EPOCH TRAP: an epoch-zero last bar leaves the row UNMARKED, not stamped open');
  const wNone = runLift([]);
  assert(wNone.length === 1 && wNone[0].rows[0].goldShut === undefined,
    'GOLD ULTRA: an empty series leaves the row unmarked, and the ticket is still written');
}

/* ---- 8) both fail OPEN ---- */
{
  /* no calendar loaded at all */
  const D = boot(['indicators.js', 'gold-formation.js', 'golddirection.js']);
  assert(typeof D.hgInGoldWeekend !== 'function', 'fixture: the calendar really is absent');
  const written = [];
  D.hgFwdRecordScan = (desk, tf, rows) => written.push(rows);
  D.hgGoldDirectionRecordForward({ pick: { dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'p' } },
    { pick: null }, { rows1h: bars(SAT, 60, 3600) });
  assert(written.length === 1, 'REACHABILITY: the record was still written with no calendar');
  assert(written[0][0].goldShut === undefined && written[0][0].ticket === true,
    'FAIL OPEN: no calendar -> no mark, and the ticket is unchanged');
  assert(D.gdWeekendVerdict(SAT) === null, 'FAIL OPEN: the route yields no verdict with no calendar');

  /* unreadable instant: no rows at all */
  const D2 = boot(CAL.concat(['golddirection.js']));
  const w2 = [];
  D2.hgFwdRecordScan = (desk, tf, rows) => w2.push(rows);
  D2.hgGoldDirectionRecordForward({ pick: { dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'p' } },
    { pick: null }, {});
  assert(w2.length === 1 && w2[0][0].goldShut === undefined && w2[0][0].ticket === true,
    'FAIL OPEN: no series -> no instant -> no mark, ticket unchanged');
  assert(D2.__gdSignalSec({}) === null && D2.__gdSignalSec({ rows1h: [] }) === null,
    'an absent or empty series yields no instant');
  /* the reader's OWN contract. The shared calendar refuses t<=0 as well
     (hg-v953), so this is defence in depth rather than the only guard —
     but a reader that hands back 0 is claiming an instant it does not have. */
  assert(D2.__gdSignalSec({ rows1h: [{ t: 0, c: 1 }] }) === null,
    'a series whose last bar reads epoch-zero yields NO instant, not 0');
  /* the epoch trap, at this seam too: 0 is 1970-01-01, a THURSDAY */
  /* asserted on the MARK's reader, not the probe wrapper. The wrapper
     returns null for "open" as well, so a zero instant passes through it
     either way and the check was vacuous — mutation said so. 1970-01-01 is
     a THURSDAY, so the failure mode is a confident goldShut:false. */
  assert(typeof D2.__gdWeekendFull === 'function', 'the mark reads the FULL verdict, exported for this check');
  assert(D2.__gdWeekendFull(0) === null && D2.__gdWeekendFull('') === null
      && D2.__gdWeekendFull(null) === null && D2.__gdWeekendFull(-1) === null
      && D2.__gdWeekendFull(NaN) === null,
    'EPOCH TRAP: 0 / empty / null / negative / NaN yield NO verdict, not a cheerful 1970 "open"');
  assert(D2.__gdWeekendFull(WED) && D2.__gdWeekendFull(WED).inWeekend === false,
    'and a real Wednesday IS a verdict of open — the two are distinguishable');
  const w3 = [];
  D2.hgFwdRecordScan = (desk, tf, rows) => w3.push(rows);
  D2.hgGoldDirectionRecordForward({ pick: { dir: 'long', entry: 2300, stop: 2290, t1: 2315, stratKey: 'p' } },
    { pick: null }, { rows1h: [{ t: 0, o: 1, h: 1, l: 1, c: 1, v: 1 }] });
  assert(w3.length === 1 && w3[0][0].goldShut === undefined,
    'EPOCH TRAP end to end: a series whose last bar reads epoch-zero is left UNMARKED, not stamped open');
  assert(D2.gdWeekendVerdict(0) === null, 'the probe wrapper still refuses a zero instant');
}

/* ---- 9) GOLD SPOT and GOLD COINT really do not mint ---- */
/* Asserted, not assumed: they are declared non-minters above, so the claim
   is checked against the shipped files rather than against their headers. */
{
  for (const [tab, file] of [['goldspot', 'goldspot.js'], ['goldcoint', 'goldcoint.js']]){
    const S = boot(CAL.concat([file]));
    let wrote = 0;
    S.hgFwdRecordScan = () => { wrote++; };
    S.hgFwdRecord = () => { wrote++; };
    const t = (S.HG_tabs || []).find(x => x && x.id === tab);
    assert(!!t, tab + ': registers a tab');
    try { if (typeof t.refresh === 'function') t.refresh(); } catch(e){ /* offline */ }
    assert(wrote === 0, tab + ': writes NO forward record — the non-minter claim is checked, not assumed');
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert(!/hgFwdRecordScan|logSetup\s*\(|bookBtnHTML/.test(src),
      tab + ': no forward-record, setup-log or ADD TO BOOK call anywhere in the file');
  }
}

/* ---- 10) the reporter verifies both new routes ---- */
{
  const A = boot(CAL.concat(['golddirection.js', 'goldultra.js']));
  const cov = A.hgGoldWeekendCoverage();
  assert(cov.verified.indexOf('GOLD DIRECTION') >= 0, 'REPORTER: GOLD DIRECTION is VERIFIED');
  assert(cov.verified.indexOf('GOLD ULTRA') >= 0, 'REPORTER: GOLD ULTRA is VERIFIED');
  assert(cov.broken.length === 0, 'REPORTER: no route reports BROKEN (' + cov.broken.join(', ') + ')');
  const tot = cov.covered.length + cov.uncovered.length + cov.notLoaded.length;
  assert(tot === MINT.length, 'REPORTER: the buckets still partition the minter list (' + tot + '/' + MINT.length + ')');
  assert(cov.verified.length + cov.claimed.length + cov.broken.length === cov.covered.length,
    'REPORTER: verified + claimed + broken partitions covered');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
