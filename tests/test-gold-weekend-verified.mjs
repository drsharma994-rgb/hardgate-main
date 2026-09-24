/* HARDGATE — hg-v952: the coverage reporter reported what its AUTHOR TYPED.

   hg-v949 built it so gaps would name themselves, and hg-v951 fixed its first
   blind spot. But every `via` string in it was a claim nothing ever checked,
   and two things followed.

   (1) SUPER GOLD was listed covered "via own weekend read". It does read the
       calendar — and it read it on Date.now() at ALL FOUR of its sites, not
       on the signal bar. The veto is real (it pushes a reason and stands the
       candidate down), so the error ran in BOTH directions: a setup formed on
       a Friday and reviewed on a Saturday was vetoed for a closure it never
       met, and one formed on a Saturday and reviewed on a Monday sailed
       through. hg-v949 wrote "a Monday re-run over Friday's bars must give
       Friday's answer" into the shared formation while this desk did the
       opposite, and the reporter called it covered because the string said so.

   (2) TAURIC was absent from the list ENTIRELY — a second blind spot one pack
       after the first was fixed. It prices XAUUSD and writes entry/stop/t1 to
       the forward log, and had no weekend reference of any kind.

   This is hg-v946's hand-typed-prefer-book failure living inside the reporter
   built to stop gaps hiding. So the reporter now CALLS each route with a
   known Saturday and a known Wednesday and requires it to tell them apart.

   Covers:
     1) the probe verifies, and can say BROKEN and CLAIMED — not a rubber stamp
     2) two argument shapes, because the desks genuinely differ
     3) SUPER GOLD: the real veto, driven, both directions
     4) and its wall-clock fallback still works and names itself
     5) TAURIC is listed and its route verifies
     6) the buckets still partition, with the new labels inside `covered`
     7) what is still only CLAIMED is reported as such, not as coverage
   Run: node tests/test-gold-weekend-verified.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
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
    catch(e){ /* surfaced by the assertions below */ }
  }
  return ctx;
}
const CAL = ['indicators.js', 'indicators2.js', 'omnigold.js', 'gold-formation.js'];
const SAT_MS = Date.UTC(2026, 3, 11, 12, 0, 0);
const WED_MS = Date.UTC(2026, 3,  8, 12, 0, 0);
const SAT_S  = Math.floor(SAT_MS / 1000);
const WED_S  = Math.floor(WED_MS / 1000);

console.log('== 1) the probe VERIFIES, and can also say BROKEN and CLAIMED ==');
{
  const W = boot(CAL);
  const P = W.hgGoldWeekendProbeRoute;
  assert(typeof P === 'function', 'hgGoldWeekendProbeRoute is exported');
  W.__good = t => (new Date(+t).getUTCDay() === 6) ? { why: 'sat' } : null;
  W.__alwaysOpen = () => null;
  W.__alwaysShut = () => ({ why: 'always' });
  W.__throws = () => { throw new Error('boom'); };
  assert(P('__good') === 'verified', 'a route that tells Saturday from Wednesday is VERIFIED');
  assert(P('__alwaysOpen') === 'broken', 'one that never fires is BROKEN — not silently covered');
  assert(P('__alwaysShut') === 'broken', 'one that always fires is BROKEN too — a stuck rule is not a calendar');
  assert(P('__throws') === 'broken', 'a throwing route is BROKEN, and does not take the reporter with it');
  assert(P('__notDefined') === null && P(null) === null,
         'nothing callable yields null, which the reporter labels CLAIMED rather than counting as proof');
}

console.log('== 2) two argument shapes, because the desks genuinely differ ==');
{
  const W = boot(CAL);
  /* a rows-taking route — GOLD PINE and GOLD PRO read a SERIES, having no
     instant of their own. The first cut of this probe passed a number to
     every route and reported both of them BROKEN: a false alarm from the
     reporter, not a defect in them. */
  W.__rowsRoute = rows => {
    if (!rows || !rows.length) return null;
    const last = rows[rows.length - 1];
    return (new Date(last.t * 1000).getUTCDay() === 6) ? { why: 'sat' } : null;
  };
  assert(W.hgGoldWeekendProbeRoute('__rowsRoute') === 'broken',
         'called with the WRONG shape a working rows-route reads broken (the false alarm, reproduced)');
  assert(W.hgGoldWeekendProbeRoute('__rowsRoute', 'rows') === 'verified',
         'called with the right shape it VERIFIES');
  /* the instant shape, in THIS context — section 1's helpers live in a
     different vm context, and reaching for them here returned null and made
     the assertion pass for the wrong reason until it was driven properly */
  W.__instRoute = t => (new Date(+t).getUTCDay() === 6) ? { why: 'sat' } : null;
  assert(W.hgGoldWeekendProbeRoute('__instRoute', 'instant') === 'verified'
      && W.hgGoldWeekendProbeRoute('__instRoute') === 'verified',
         'the instant shape verifies whether named explicitly or left to the default');
}

console.log('== 3) SUPER GOLD: the REAL veto, driven, both directions ==');
{
  const W = boot(CAL.concat(['super-gold.js']));
  const A = W.__sgGoldDeskAudit;
  assert(typeof A === 'function', 'the real audit is reachable (fatal if not — everything below would be a claim)');
  const vetoed = (barSec, wallMs) => {
    const real = W.Date.now;
    W.Date.now = () => wallMs;
    let r;
    try { r = A(W, {}, barSec === null ? { dir: 'long' } : { dir: 'long', t: barSec }); }
    finally { W.Date.now = real; }
    return (r.reasons || []).some(x => /weekend closure/i.test(x));
  };
  assert(vetoed(WED_S, SAT_MS) === false,
         'a WEEKDAY bar reviewed while the wall clock says Saturday is NOT vetoed (it was, before hg-v952)');
  assert(vetoed(SAT_S, WED_MS) === true,
         'a SATURDAY bar reviewed while the wall clock says Wednesday IS vetoed (it was not, before hg-v952)');
  assert(vetoed(SAT_S, SAT_MS) === true && vetoed(WED_S, WED_MS) === false,
         'and the two agreeing cases are unchanged');
}

console.log('== 4) the wall-clock fallback still works, and names itself ==');
{
  const W = boot(CAL.concat(['super-gold.js']));
  const A = W.__sgGoldDeskAudit;
  const real = W.Date.now;
  W.Date.now = () => SAT_MS;
  let r;
  try { r = A(W, {}, { dir: 'long' }); } finally { W.Date.now = real; }
  const reason = (r.reasons || []).find(x => /weekend closure/i.test(x));
  assert(!!reason, 'a candidate carrying NO instant still gets the closure veto — nothing is lost');
  assert(/no bar time on this candidate/.test(reason),
         'and the reason SAYS it fell back to the wall clock, so the two cases are distinguishable');
  /* the +null===0 trap needs an EXPLICIT null / '' to bite — an absent key
     coerces to NaN and is caught by any finiteness check, so a fixture with
     only absent keys let a coercing reader survive mutation */
  for (const bad of [null, '', 0, -1, NaN, undefined]){
    assert(W.__sgCandSec({}, { dir: 'long', t: bad }) === null,
           'the instant reader rejects t=' + JSON.stringify(bad) + ' rather than reading it as 1970');
  }
  assert(W.__sgCandSec({}, { dir: 'long' }) === null,
         'and returns null when nothing on the row carries a time at all');
  assert(W.__sgCandSec({ t: SAT_S }, { dir: 'long', t: null }) === SAT_S,
         'an unreadable hit time falls through to the candidate\'s own, rather than stopping at 0');
  assert(W.__sgCandSec({}, { t: SAT_S }) === SAT_S && W.__sgCandSec({}, { t: SAT_MS }) === SAT_S,
         'and reads seconds or milliseconds to the same instant');
}

console.log('== 5) TAURIC is listed, and its route verifies ==');
{
  const W = boot(CAL.concat(['tauric.js']));
  const row = (W.HG_GOLD_WEEKEND_MINTERS || []).find(r => r.desk === 'TAURIC');
  assert(!!row, 'TAURIC is on the list at all — it was absent entirely before hg-v952');
  assert(typeof W.hgTauricWeekendVerdict === 'function', 'its route is callable');
  assert(W.hgGoldWeekendProbeRoute(row.verdictFn, row.probeKind) === 'verified',
         'and the reporter VERIFIES it by calling it');
  assert(!!W.hgTauricWeekendVerdict(SAT_S) && W.hgTauricWeekendVerdict(WED_S) === null,
         'Saturday shut, Wednesday open');
  for (const bad of [null, undefined, '', NaN, 0, -1]){
    assert(W.hgTauricWeekendVerdict(bad) === null,
           'an unreadable instant (' + JSON.stringify(bad) + ') yields null, never a guessed verdict');
  }
  const bare = boot(['tauric.js']);
  assert(typeof bare.hgGoldWeekendVerdict !== 'function', 'the bare context genuinely lacks the calendar');
  assert(bare.hgTauricWeekendVerdict(SAT_S) === null,
         'and with it absent TAURIC returns null — fails OPEN, never assumes shut');
  assert(/marked, not withheld/.test(row.via),
         'its route says MARKED not withheld — these rows record ticket:false, so there is no ticket to withhold');

  /* DRIVE THE REAL RECORD. Asserting only on the verdict function left the
     mark itself unguarded — mutation said so, by deleting it and surviving. */
  function recordOn(wallMs){
    const C = boot(CAL.concat(['tauric.js']));
    const seen = [];
    C.hgFwdRecord = row => { seen.push(row); return 'recorded'; };
    const real = C.Date.now;
    C.Date.now = () => wallMs;
    try {
      C.hgTauricRecord({ state: 'directional', dir: 'long', label: 'buy' },
                       { ok: true, plan: { entry: 2300, stop: 2280, t1: 2340 } });
    } finally { C.Date.now = real; }
    return seen;
  }
  const onSat = recordOn(SAT_MS), onWed = recordOn(WED_MS);
  assert(onSat.length === 1 && onWed.length === 1,
         'the real record path runs and writes one row each time (fatal if not — the checks below would be vacuous)');
  assert(onSat[0].goldShut === true,
         'a record priced on a Saturday bar is MARKED goldShut');
  assert(onWed[0].goldShut === false,
         'one priced on a Wednesday bar is not');
  assert(onSat[0].ticket === false && onSat[0].entry === 2300 && onSat[0].stop === 2280,
         'and nothing is withheld — it still records with its levels, exactly as before');
}

console.log('== 6) the buckets still partition, with the labels inside covered ==');
{
  const W = boot(CAL);
  const c = W.hgGoldWeekendCoverage();
  const all = c.covered.map(x => x.desk).concat(c.uncovered, c.notLoaded);
  assert(all.length === W.HG_GOLD_WEEKEND_MINTERS.length,
         'every desk lands in exactly one of covered / uncovered / notLoaded (' + all.length + ')');
  assert(c.covered.every(r => r.proof === 'verified' || r.proof === 'claimed' || r.proof === 'broken'),
         'and every covered row carries one of the three proof labels');
  const labelled = c.verified.length + c.claimed.length + c.broken.length;
  assert(labelled === c.covered.length,
         'the three label lists sum to covered (' + labelled + ' of ' + c.covered.length + ')');
}

console.log('== 7) what is still only CLAIMED says so ==');
{
  const W = boot(CAL);
  const c = W.hgGoldWeekendCoverage();
  const og = c.covered.find(r => r.desk === 'OMNIGOLD');
  assert(!!og && og.proof === 'claimed',
         'OMNIGOLD has its own hg-v420 veto and nothing callable to test, so it reads CLAIMED — an honest label, not coverage');
  assert(c.verified.indexOf('OMNIGOLD') < 0,
         'and it is NOT counted as verified');
  /* a desk with a working route moves out of claimed the moment it is loaded */
  const W2 = boot(CAL.concat(['optigold.js']));
  W2.optiGoldState = () => null;
  const c2 = W2.hgGoldWeekendCoverage();
  assert(c2.verified.indexOf('OPTI GOLD') >= 0,
         'OPTI GOLD, whose route IS callable, reports VERIFIED once its desk is on the page');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
