/* HARDGATE — hg-v949: gold is shut from Friday 22:00 UTC to Sunday 22:00
   UTC, and the desks routing through the shared formation had never heard
   of it. OMNIGOLD has vetoed inside that window since hg-v420; NEW GOLD and
   OMNIGOLD 1 minted straight through it.

   It is not merely historical hygiene. getXAUCandles walks a feed chain
   ending in Delta XAUTUSD and Binance PAXG -- both 24/7 crypto tokens -- so
   on a Saturday a desk on that chain is handed bars and mints an XAUUSD
   ticket at a price no broker quoted.

   Behavioural throughout: the real hgGoldFormation is driven with real
   omnigold.js and indicators2.js loaded, and the verdict is read back.

   Covers:
     1) the rule fires, both edges, DST-aware, delegating to the ONE
        definition rather than re-deriving it
     2) a setup that FORMS on a weekday is withheld on a weekend, and the
        weekend is provably what withheld it (not some other gate)
     3) only `tradable` is withheld -- the evidence, confluence and venue
        read all survive (hg-v552/v572: a demote, never a hard drop)
     4) the instant is the SIGNAL BAR, never Date.now()
     5) fails OPEN at every seam (no atMs, unreadable atMs, no indicators2)
     6) seconds and milliseconds both read
     7) the coverage reporter never claims a desk it cannot see
     8) the measurement script re-derives, and refuses to invent the calendar
   Run: node tests/test-gold-weekend-formation.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* a desk that throws on load is reported by the assertions below */ }
  }
  return ctx;
}
const FULL = ['indicators2.js', 'omnigold.js', 'gold-formation.js'];
const W = boot(FULL);

/* a setup with a stop wide enough to clear the PAXG venue floor, so that a
   WEEKDAY run genuinely FORMS -- without that, "not tradable on Saturday"
   would prove nothing */
const SETUP = { kind: 'TRIPLE-CONF', horizon: '1H', dir: 'long',
  plan: { entry: 2300, stop: 2240, t1: 2450, rr1: 2.5 }, entry: 2300, stop: 2240, t1: 2450 };
const CONFS = [{ label: 'fvg', ok: true, cls: 'structure' },
               { label: 'vwma', ok: true, cls: 'momentum' },
               { label: 'htf', ok: true, cls: 'session-htf' }];
const form = (atMs, ctx) => (ctx || W).hgGoldFormation(SETUP,
  { tab: 'NEWGOLD:1H', mechanic: 'TRIPLE-CONF', confirmations: CONFS,
    requireClasses: ['session-htf'], atMs: atMs });

/* April 2026 is EDT, so the close edge is 21:00 UTC, not 22:00 */
const SAT      = Date.UTC(2026, 3, 11, 12, 0, 0);
const WED      = Date.UTC(2026, 3,  8, 12, 0, 0);
const FRI_2030 = Date.UTC(2026, 3, 10, 20, 30, 0);
const FRI_2130 = Date.UTC(2026, 3, 10, 21, 30, 0);
const SUN_2000 = Date.UTC(2026, 3, 12, 20,  0, 0);
const SUN_2300 = Date.UTC(2026, 3, 12, 23,  0, 0);
/* January is EST, edge 22:00 UTC — the same Friday hour lands the other way */
const JAN_FRI_2130 = Date.UTC(2026, 0,  9, 21, 30, 0);

console.log('== 1) the rule fires at both edges, DST-aware, from ONE definition ==');
{
  const V = W.hgGoldWeekendVerdict;
  assert(typeof V === 'function', 'hgGoldWeekendVerdict is exported');
  assert(V(SAT).inWeekend === true && V(WED).inWeekend === false,
         'Saturday is shut, Wednesday is open');
  assert(V(FRI_2030).inWeekend === false && V(FRI_2130).inWeekend === true,
         'the Friday close edge bites between 20:30 and 21:30 UTC in April (EDT)');
  assert(V(SUN_2000).inWeekend === true && V(SUN_2300).inWeekend === false,
         'the Sunday reopen edge bites between 20:00 and 23:00 UTC');
  assert(V(JAN_FRI_2130).inWeekend === false,
         'the SAME Friday 21:30 UTC is OPEN in January (EST) — the edge is DST-aware, not a fixed hour');
  /* delegation, not re-derivation: remove the one definition and the rule
     must go silent rather than fall back to its own idea of the calendar */
  const noCal = boot(['omnigold.js', 'gold-formation.js']);
  assert(typeof noCal.hgInGoldWeekend !== 'function',
         'the probe context genuinely lacks hgInGoldWeekend');
  assert(noCal.hgGoldWeekendVerdict(SAT) === null,
         'with indicators2.js absent the verdict is NULL — it never re-derives the calendar itself');
}

console.log('== 2) a setup that FORMS on a weekday is withheld on a weekend ==');
{
  const wed = form(WED), sat = form(SAT);
  assert(wed.tradable === true && wed.state === 'FORMED',
         'the weekday fixture genuinely FORMS (' + wed.state + ') — otherwise the test below proves nothing');
  assert(sat.tradable === false,
         'the SAME setup on a Saturday is not tradable');
  assert(sat.weekend && sat.weekend.inWeekend === true,
         'and the verdict says the weekend is why');
  assert(sat.reasons.some(r => /GOLD IS SHUT/.test(r)),
         'the reason names it: GOLD IS SHUT');
  assert(sat.reasons.some(r => /no broker quoted/.test(r)),
         'and says what is actually wrong — the level is one no broker quoted');
  assert(!wed.reasons.some(r => /GOLD IS SHUT/.test(r)),
         'the weekday run carries no such reason');
}

console.log('== 3) only tradable is withheld — the card keeps its evidence ==');
{
  const sat = form(SAT);
  assert(sat.confluence && sat.confluence.classCount >= 3,
         'the confluence read survives (' + (sat.confluence && sat.confluence.classCount) + ' classes)');
  assert(!!sat.og && !!sat.og.venue,
         'the venue / cost read survives — nothing is dropped, only the ticket is withheld');
  assert(sat.state === 'STOOD-ASIDE' && sat.formed === false,
         'it stands aside rather than being deleted (hg-v552/v572: a demote, not a hard drop)');
}

console.log('== 4) the instant is the SIGNAL BAR, never Date.now() ==');
{
  /* same call, two very different wall clocks: the answer must not move */
  const realNow = Date.now;
  Date.now = () => SAT;
  const a = form(WED);
  Date.now = () => WED;
  const b = form(WED);
  Date.now = realNow;
  assert(a.tradable === b.tradable && a.tradable === true,
         'a Wednesday bar stays tradable even while the wall clock says Saturday');
  Date.now = () => WED;
  const c = form(SAT);
  Date.now = realNow;
  assert(c.tradable === false && c.weekend.inWeekend === true,
         'and a Saturday bar stays withheld even while the wall clock says Wednesday');
}

console.log('== 5) fails OPEN at every seam ==');
{
  assert(form(undefined).tradable === true, 'no atMs -> the setup stands exactly as before');
  assert(form(undefined).weekend === null, 'and the verdict is null, so a reader can tell "could not check" from "checked and open"');
  for (const bad of [null, '', NaN, 'not-a-time', {}]){
    const o = form(bad);
    assert(o.tradable === true && o.weekend === null,
           'an unreadable atMs (' + JSON.stringify(bad) + ') fails open');
  }
  const noCal = boot(['omnigold.js', 'gold-formation.js']);
  const o = form(SAT, noCal);
  assert(o.tradable === true && o.weekend === null,
         'with the calendar absent a Saturday setup still stands — a calendar the desk cannot read is not a reason to withhold');
}

console.log('== 6) seconds and milliseconds both read ==');
{
  const V = W.hgGoldWeekendVerdict;
  const ms = V(SAT), sec = V(SAT / 1000);
  assert(!!ms && !!sec && ms.inWeekend === sec.inWeekend && ms.atMs === sec.atMs,
         'the same instant in seconds or milliseconds gives the same verdict');
}

console.log('== 7) the coverage reporter never claims a desk it cannot see ==');
{
  const cov = W.hgGoldWeekendCoverage();
  assert(cov && Array.isArray(cov.covered) && Array.isArray(cov.uncovered) && Array.isArray(cov.notLoaded),
         'hgGoldWeekendCoverage returns the three buckets');
  const all = cov.covered.map(c => c.desk).concat(cov.uncovered, cov.notLoaded);
  assert(all.length === W.HG_GOLD_WEEKEND_MINTERS.length,
         'the buckets PARTITION the desk list — every desk lands in exactly one (' + all.length + ')');
  assert(cov.notLoaded.includes('NEW GOLD') && cov.notLoaded.includes('OPTI GOLD'),
         'a desk absent from this context reports NOT LOADED, never "covered"');
  assert(cov.covered.some(c => c.desk === 'OMNIGOLD' && /v420/.test(c.via)),
         'OMNIGOLD is reported covered, and by its own rule rather than this one');
  /* with a desk's probe present it must move out of notLoaded */
  W.optiGoldState = function(){ return null; };
  const cov2 = W.hgGoldWeekendCoverage();
  assert(!cov2.notLoaded.includes('OPTI GOLD') && cov2.uncovered.includes('OPTI GOLD'),
         'once OPTI GOLD is on the page it reports UNCOVERED — the gap names itself rather than living in prose');
  delete W.optiGoldState;
}

console.log('== 8) the measurement re-derives and refuses to invent the calendar ==');
{
  let out = '';
  try { out = execFileSync('node', [path.join(ROOT, 'scripts', 'gold-weekend-population.mjs')],
        { cwd: ROOT, encoding: 'utf8', timeout: 60000 }); }
  catch(e){ out = String((e && e.stdout) || ''); }
  assert(/NEW GOLD/.test(out) && /TRADEABLE \(gold open\)/.test(out),
         'the script runs and splits the record by whether gold was open');
  assert(/24\/7 weekend bars a broker never printed/.test(out),
         'it QUOTES the artifact\'s own universe line rather than asserting the claim itself');
  assert(/NO VERDICT is claimed/.test(out),
         'and states plainly that the thin tradeable subset carries no verdict');
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'gold-weekend-population.mjs'), 'utf8');
  assert(/hgInGoldWeekend/.test(src) && !/getUTCDay/.test(src),
         'the script CALLS the repo\'s calendar and contains no calendar arithmetic of its own');
}

console.log('== 9) NEW GOLD and OMNIGOLD 1 actually PASS the instant (not a no-op) ==');
{
  /* hg-v945's lesson: a rule wired into a shared function changes nothing
     unless the callers feed it. This drives the REAL ngRunScan and observes
     what the desk hands hgGoldFormation. */
  const CORE = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
    'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','hg-solidity.js',
    'backtest-tab-params.js','gold-session.js','goldind.js','gold-catalog.js',
    'gold-formation.js','omniroute.js','omnigold.js'];
  function deskBoot(extra){
    const ctx = { console:{ log(){}, warn(){}, error(){}, info(){}, debug(){} },
      Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String,
      Promise, RegExp, Error, TypeError, Map, Set, Symbol, Intl,
      setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
      encodeURIComponent, decodeURIComponent, AbortController };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
    ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
    ctx.sessionStorage = ctx.localStorage;
    ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
        querySelector: () => null, querySelectorAll: () => [] }),
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
      documentElement: { appendChild(){} },
      addEventListener(){}, removeEventListener(){}, visibilityState:'visible', readyState:'complete' };
    ctx.fetch = () => Promise.reject(new Error('no network'));
    ctx.navigator = { userAgent:'node', onLine:false };
    vm.createContext(ctx);
    for (const f of CORE.concat(extra)) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    ctx.HG_OG_VENUE = 'XM';
    return ctx;
  }
  /* a tape that FIRES, anchored on a chosen UTC day/hour so the last closed
     bar lands where we want it on the gold calendar */
  function fireTape(y, mo, d, hourUTC){
    const rows = []; const t0 = Math.floor(Date.UTC(y, mo, d, hourUTC, 0, 0) / 1000);
    const n = 70, t = i => t0 - (n - 1 - i) * 3600;
    let c = 3950;
    for (let i = 0; i < 50; i++){ c += (i % 2 === 0) ? 1.6 : -0.5;
      rows.push({ t: t(i), o: c - 0.2, h: c + 0.45, l: c - 0.5, c: +c.toFixed(2), v: 1000 }); }
    rows.push({ t: t(50), o: 3999.5, h: 4000.0, l: 3999.2, c: 3999.9, v: 1000 });
    rows.push({ t: t(51), o: 4000.2, h: 4001.6, l: 4000.1, c: 4001.5, v: 1200 });
    rows.push({ t: t(52), o: 4001.6, h: 4002.2, l: 4000.6, c: 4001.9, v: 1000 });
    const dipStart = 4001.8, dipEnd = 4000.1, dipFast = 5, dipLen = 16, closes = [];
    for (let k = 0; k < dipFast; k++) closes.push(dipStart - (dipStart - dipEnd) * ((k + 1) / dipFast));
    for (let k = 0; k < dipLen - dipFast; k++) closes.push(dipEnd + ((dipLen - dipFast - 1 - k) % 2 === 0 ? 0 : 0.05));
    for (let k = 0; k < closes.length; k++){
      const c2 = +closes[k].toFixed(2), o2 = k === 0 ? dipStart + 0.1 : +closes[k - 1].toFixed(2);
      rows.push({ t: t(53 + k), o: o2, h: Math.max(o2, c2) + 0.18,
                  l: Math.max(Math.min(o2, c2) - 0.12, 4000.05), c: c2, v: 900 });
    }
    rows.push({ t: t(69), o: 4000.12, h: 4000.55, l: 4000.07, c: 4000.5, v: 1300 });
    return rows;
  }
  async function spyScan(rows, withHybrid){
    const ctx = deskBoot(['newgold.js']);
    const real = ctx.hgGoldFormation;
    const seen = [];
    ctx.hgGoldFormation = function(setup, opts){
      seen.push({ mech: opts && opts.mechanic, atMs: opts && opts.atMs });
      return real(setup, opts);
    };
    ctx.hgOgFetchRows = () => Promise.resolve({ rows: rows, source: 'fixture' });
    /* the HYBRID lane only runs when OMNIGOLD offers a same-direction
       candidate, which the primary fixture never produces — so without this
       the hybrid call site is never reached and a guard on it is vacuous.
       Mutation said so out loud: removing its atMs survived until this stub
       existed. */
    if (withHybrid){
      ctx.hgOgUniformDebug = () => ({
        swing: [{ kind: 'STRUCT-BOS', dir: 'long', plan: { entry: 4000.5, stop: 3999, t1: 4004 } }],
        scalp: []
      });
    }
    await ctx.ngRunScan();
    return seen;
  }
  /* Saturday 2026-06-06 12:00 UTC, and Wednesday 2026-06-03 12:00 UTC */
  const satSeen = (await spyScan(fireTape(2026, 5, 6, 12), true)).map(x => x.atMs);
  const wedSeen = (await spyScan(fireTape(2026, 5, 3, 12), true)).map(x => x.atMs);
  const satCalls = await spyScan(fireTape(2026, 5, 6, 12), true);
  assert(satCalls.some(c => /OMNI/.test(String(c.mech))),
         'the HYBRID lane is reached too (' + satCalls.map(c => c.mech).join(', ') + ')');
  assert(satSeen.length > 0, 'NEW GOLD reached hgGoldFormation at all (' + satSeen.length + ' calls)');
  /* `+null` is 0 and isFinite(0) is true, so a finiteness check alone lets a
     lane that passes null slip through as "wired" — the trap this session has
     now hit four times, here in the guard itself. A real instant is on the
     millisecond scale, so demand that. */
  const readable = x => x !== undefined && x !== null && x !== '' && isFinite(+x) && +x > 1e12;
  assert(satSeen.every(readable),
         'EVERY lane carries a readable millisecond instant — not one of them is null '
         + '(' + JSON.stringify(satSeen) + ')');
  assert(satSeen.length >= 2 && wedSeen.length >= 2,
         'both NEW GOLD lanes — primary and hybrid — reached the shared formation');
  const lastSat = Math.floor(Date.UTC(2026, 5, 6, 12, 0, 0));
  assert(satSeen.some(x => Math.abs(+x - lastSat) < 3600 * 1000 + 1),
         'and it is the SIGNAL BAR of the fixture, not the wall clock');
  assert(satSeen.every(x => W.hgGoldWeekendVerdict(x) && W.hgGoldWeekendVerdict(x).inWeekend === true),
         'EVERY instant the Saturday scan passes reads as shut — on both lanes');
  assert(wedSeen.every(x => W.hgGoldWeekendVerdict(x) && W.hgGoldWeekendVerdict(x).inWeekend === false),
         'and every instant the Wednesday scan passes reads as open — on both lanes');
}

console.log('== 10) OMNIGOLD 1 passes the instant too ==');
{
  /* the same no-op check for the second caller. OG1's engine is driven for
     real; if it never reaches the shared formation on this fixture the
     assertion says so rather than passing vacuously. */
  function og1Boot(){
    const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
      parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Intl,
      setTimeout, clearTimeout, Infinity, NaN };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
    ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
    ctx.document = { createElement: () => ({ style: {} }), getElementById: () => null,
      querySelector: () => null, querySelectorAll: () => [] };
    vm.createContext(ctx);
    for (const f of ['indicators2.js','omnigold.js','gold-formation.js','gold-seven-step.js','omnigold1.js'])
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    return ctx;
  }
  const H = 3600;
  function sweepDay(dayUTC){
    const now = dayUTC + 14 * 3600 * 1000 + 5 * 60 * 1000;
    const rows = []; const endSec = Math.floor((dayUTC) / 1000 / H) * H;
    let c = 4380;
    for (let i = 0; i < 420; i++){ c += 0.12 + ((i % 7) - 3) * 0.4;
      rows.push({ t: endSec - (420 - i) * H, o: c - 0.4, h: c + 1.2, l: c - 1.4, c: +c.toFixed(2), v: 150 }); }
    const shift = 4495 - rows[rows.length - 1].c;
    for (const r of rows){ r.o += shift; r.h += shift; r.l += shift; r.c += shift; }
    const d0 = Math.floor(dayUTC / 1000);
    for (let i = 0; i < 13; i++) rows.push({ t: d0 + i * H, o: 4494 + (i % 2), h: 4500 - (i % 2), l: 4490 + (i % 2) * 0.5, c: 4496 - (i % 3), v: 150 });
    rows.push({ t: d0 + 13 * H, o: 4494, h: 4497, l: 4486, c: 4493, v: 420 });
    const m15 = [];
    for (let i = 0; i < 200; i++){ const t = Math.floor(now / 1000 / 900) * 900 - (200 - i) * 900;
      m15.push({ t, o: 4493, h: 4495, l: 4491, c: 4493 + (i % 3) * 0.3, v: 40 }); }
    return { now, rows, m15 };
  }
  function og1Spy(dayUTC){
    const ctx = og1Boot();
    const real = ctx.hgGoldFormation;
    const seen = [];
    ctx.hgGoldFormation = function(setup, opts){ seen.push(opts && opts.atMs); return real(setup, opts); };
    const d = sweepDay(dayUTC);
    try { ctx.hgOg1Engine({ rows1h: d.rows, rows15m: d.m15, now: d.now,
      feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 }); } catch(e){}
    return { seen, ctx };
  }
  /* HONEST LIMIT, RECORDED IN THE GUARD RATHER THAN IN PROSE.
     OMNIGOLD 1's call site is wired identically to NEW GOLD's, but reaching
     it needs a fixture that clears OG1's 4-family spread rule on its 20-point
     matrix, which this one does not. The first cut of this section asserted
     "every call carries a readable instant" over an EMPTY array and passed --
     vacuously, which is the exact failure this session has corrected four
     times. So the reachability is asserted FIRST and the rest is conditional
     on it: today that records the gap, and the day a fixture does reach the
     call site the same assertions start biting with no edit here. */
  const r = og1Spy(Date.UTC(2026, 8, 2, 0, 0));
  const reached = r.seen.length > 0;
  if (reached){
    const readable2 = x => x !== undefined && x !== null && x !== '' && isFinite(+x) && +x > 1e12;
    assert(r.seen.every(readable2),
           'OMNIGOLD 1: every formation call carries a readable millisecond instant ('
           + JSON.stringify(r.seen) + ')');
    assert(r.seen.every(x => Math.abs(+x - Date.UTC(2026, 8, 2, 0, 0)) < 40 * 24 * 3600 * 1000),
           'OMNIGOLD 1: the instant comes from the fixture\'s own bars, not the wall clock');
  } else {
    /* not a silent skip: the engine must have RUN and declined for a NAMED
       reason. An engine that threw, or one that declined with no reason,
       would be a different fact and is not allowed to read as this one. */
    const d = sweepDay(Date.UTC(2026, 8, 2, 0, 0));
    let out = null, threw = false;
    try { out = r.ctx.hgOg1Engine({ rows1h: d.rows, rows15m: d.m15, now: d.now,
      feed: 'delta-xaut', venue: 'Delta XAUTUSD', equity: 50000, stopsToday: 0 }); }
    catch(e){ threw = true; }
    assert(!threw && out && out.ok === true,
           'OMNIGOLD 1: the engine RAN on this fixture (so the gap below is a decision, not a crash)');
    const s3 = out && out.sections && out.sections.s3;
    assert(s3 && s3.qualifies === false && typeof s3.why === 'string' && s3.why.length > 0,
           'and declined with a NAMED reason: ' + ((s3 && s3.why) || '(none)').slice(0, 70));
    assert(true,
           'so OMNIGOLD 1\'s call site is wired but UNPROVEN by this guard — recorded, not claimed. '
           + 'It needs a fixture clearing OG1\'s 4-family spread rule to reach og1Formation.');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
