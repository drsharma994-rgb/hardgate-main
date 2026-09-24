/* HARDGATE — hg-v950: the four gold desks that mint from RAW BARS and never
   route through the shared formation, so hg-v949's calendar never reached
   them. hg-v949's own coverage reporter named them rather than anyone's
   memory: OPTI GOLD, GOLD PINE, GOLD PRO, 80PERCENT.

   THE HEADLINE IS NOT A MISSING RULE, IT IS A FALSE PREMISE. 80PERCENT has a
   session rule, hg80InSession, and it reads the UTC HOUR ONLY — never the
   day — so a Saturday 14:00 bar passes its 13:00-18:00 "NY session" test.
   That was a DELIBERATE, DOCUMENTED choice: the file said adding a weekday
   condition "would change nothing on real data because gold prints no
   weekend bars". The spec-fidelity half of that argument stands. The
   empirical half does not: this desk's bars arrive through hgOgFetchRows,
   whose chain ends in binanceKlines('PAXGUSDT') -- a 24/7 Binance pair, and
   the leg that fires whenever XM is not configured.

   So the FIRING RULE IS LEFT EXACTLY AS THE SPEC WROTE IT, and the calendar
   decides only what each desk PRESENTS AS TRADEABLE.

   Behavioural throughout: each desk's real mint is driven and the stamp is
   read back off the setups it produced.

   Covers:
     1) the premise, measured: hg80InSession passes while gold is shut
     2) the feed chain really can deliver those bars
     3) OPTI GOLD stamps PER SETUP, not per scan
     4) and withholds ACTIONABLE without removing the setup
     5) 80PERCENT stamps PER SIGNAL, and its firing rule is untouched
     6) GOLD PINE stamps PER MODE, from each mode's own series
     7) GOLD PRO stamps from the one bar its plan is composed on
     8) every desk fails OPEN with the calendar absent
     9) the coverage reporter now routes all four
   Run: node tests/test-gold-weekend-minters.mjs */

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
    catch(e){ /* reported by the assertions below */ }
  }
  return ctx;
}
const CAL = ['indicators.js', 'indicators2.js', 'omnigold.js', 'gold-formation.js'];

/* bars anchored so a KNOWN slice of them lands inside the gold weekend.
   Saturday 2026-04-11 is shut; Wednesday 2026-04-08 is open. */
const SAT_DAY = Date.UTC(2026, 3, 11, 0, 0, 0);
const WED_DAY = Date.UTC(2026, 3,  8, 0, 0, 0);

function tape(startMs, n, stepSec, seed){
  let s = seed || 4242, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let c = 2300;
  const t0 = Math.floor(startMs / 1000);
  for (let i = 0; i < n; i++){
    const shock = (rnd() < 0.03) ? (rnd() - 0.5) * 16 : 0;
    const o = c; c = o + Math.sin(i / 40) * 1.1 + (rnd() - 0.5) * 2.6 + shock;
    const w = 0.5 + rnd() * 1.8;
    rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 800 + rnd() * 900 });
  }
  return rows;
}

/* the same tape, anchored by its LAST bar. Sections 6 and 7 ask what the
   calendar says about the series' final closed bar, so the fixture has to
   END where the assertion claims — anchoring the START put the last bar
   thirteen days later on a weekday, and the first cut of this guard failed
   for that reason rather than for anything wrong in the desks. */
function tapeEnding(endMs, n, stepSec, seed){
  return tape(endMs - (n - 1) * stepSec * 1000, n, stepSec, seed);
}

console.log('== 1) the premise, measured: the session rule passes while gold is shut ==');
{
  const W = boot(CAL);
  const src = fs.readFileSync(path.join(ROOT, 'eightypercent.js'), 'utf8');
  const m = src.match(/var P80_UTC_FROM\s*=\s*(\d+)[\s\S]*?var P80_UTC_TO\s*=\s*(\d+)/);
  assert(!!m, 'the desk\'s session window is readable from its own constants');
  const FROM = +m[1], TO = +m[2];
  const inSess = t => { const h = new Date(t * 1000).getUTCHours(); return h >= FROM && h < TO; };
  let both = 0, tot = 0;
  for (let d = 0; d < 28; d++) for (let h = 0; h < 24; h++){
    const t = Date.UTC(2026, 3, 1 + d, h, 0, 0) / 1000; tot++;
    if (inSess(t) && W.hgInGoldWeekend(t)) both++;
  }
  assert(both === 40 && tot === 672,
         both + ' of ' + tot + ' hours in a 28-day span pass the ' + FROM + ':00-' + TO
         + ':00 session test WHILE GOLD IS SHUT — every weekend inside the window');
  assert(/getUTCHours/.test(src.slice(src.indexOf('function hg80InSession'), src.indexOf('function hg80InSession') + 220))
      && !/getUTCDay/.test(src.slice(src.indexOf('function hg80InSession'), src.indexOf('function hg80InSession') + 220)),
         'and the rule reads the HOUR only, never the day — left exactly as the spec writes it');
}

console.log('== 2) the feed chain really can deliver those bars ==');
{
  const og = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  const i = og.indexOf('function hgOgFetchRows');
  const blk = og.slice(i, i + 2600);
  assert(i > 0 && /PAXGUSDT/.test(blk),
         'hgOgFetchRows falls back to binanceKlines(\'PAXGUSDT\') — a 24/7 pair, so weekend bars are real here');
}

console.log('== 3) OPTI GOLD stamps PER SETUP, not per scan ==');
{
  const W = boot(CAL.concat(['optigold.js']));
  const L = W.__ogLanes[0];                     /* 15m lane */
  /* a window that STRADDLES the Friday close: some breaks land in the
     weekend and some do not, which is exactly what a per-scan stamp would
     get wrong */
  const rows = tape(Date.UTC(2026, 3, 9, 0, 0, 0), 600, 900, 991);
  const out = W.__ogSignals(rows, L);
  assert(out.length > 0, 'the rule forms setups on this tape (' + out.length + ')');
  const shut = out.filter(s => s.goldShut), open = out.filter(s => !s.goldShut);
  assert(shut.length > 0 && open.length > 0,
         'the SAME scan carries both shut and open setups (' + shut.length + ' shut / ' + open.length + ' open) '
         + '— a per-scan stamp could not do that');
  assert(shut.every(s => W.hgInGoldWeekend(s.t)) && open.every(s => !W.hgInGoldWeekend(s.t)),
         'and every stamp matches that setup\'s OWN bar against the shared calendar');
}

console.log('== 4) OPTI GOLD withholds ACTIONABLE without removing the setup ==');
{
  const W = boot(CAL.concat(['optigold.js']));
  const L = W.__ogLanes[0];
  const rows = tape(Date.UTC(2026, 3, 9, 0, 0, 0), 600, 900, 991);
  const out = W.__ogSignals(rows, L);
  const s = out.find(x => x.goldShut);
  assert(!!s, 'a shut-market setup exists to test');
  const px = rows[rows.length - 1].c;
  const reach = W.__ogReach(s, px);
  assert(reach && reach.ok === false && /GOLD WAS SHUT/.test(reach.why),
         'it is not ACTIONABLE, and the reason names the calendar');
  assert(isFinite(s.entry) && isFinite(s.stop) && isFinite(s.t1),
         'and it keeps its ENTRY / STOP / T1 — withheld, not deleted');
  const open = out.find(x => !x.goldShut && x.state === 'waiting');
  if (open){
    const r2 = W.__ogReach(open, px);
    assert(r2 && !/GOLD WAS SHUT/.test(r2.why || ''),
           'an open-market setup carries no such reason');
  } else {
    assert(true, 'no open-market waiting setup on this tape to contrast — not asserted either way');
  }
}

console.log('== 5) 80PERCENT stamps PER SIGNAL, firing rule untouched ==');
{
  const W = boot(CAL.concat(['eightypercent.js']));
  assert(typeof W.hg80Scan === 'function', '80PERCENT exposes hg80Scan');
  /* A RANDOM TAPE FIRES NOTHING HERE, and the first cut of this section
     passed vacuously on zero signals — mutation said so, three survivors.
     This tape is built to fire: a steady uptrend (EMA50 over EMA200) with
     periodic sharp dips that drag RSI(14) under the long threshold, then a
     close back up. It spans the Friday close, so the SAME scan carries fires
     from both sides of the calendar. */
  function trendDips(startMs, n, stepSec){
    const rows = []; const t0 = Math.floor(startMs / 1000); let c = 2300;
    for (let i = 0; i < n; i++){
      const cyc = i % 60;
      const d = (cyc < 44) ? 0.55 : (cyc < 52 ? -1.9 : 1.4);
      const o = c; c = o + d;
      rows.push({ t: t0 + i * stepSec, o, h: Math.max(o, c) + 0.35, l: Math.min(o, c) - 0.35,
                  c: +c.toFixed(2), v: 1000 });
    }
    return rows;
  }
  const rows = trendDips(Date.UTC(2026, 3, 9, 0, 0, 0), 1400, 300);
  const res = W.hg80Scan(rows, {});
  assert(res && res.ok === true, 'the scan runs (' + ((res && res.why) || 'ok') + ')');
  const sigs = (res && res.signals) || [];
  assert(sigs.length > 0, 'and it FIRES — ' + sigs.length + ' signals; a zero here would make everything below vacuous');
  const shut = sigs.filter(s => s.goldShut), open = sigs.filter(s => !s.goldShut);
  assert(shut.length > 0 && open.length > 0,
         'the SAME scan carries both shut and open fires (' + shut.length + ' shut / ' + open.length
         + ' open) — a per-scan stamp could not do that');
  assert(sigs.every(s => (s.goldShut ? W.hgInGoldWeekend(s.t) : !W.hgInGoldWeekend(s.t))),
         'every signal\'s stamp matches its OWN bar against the shared calendar');
  assert(shut.every(s => s.dir && s.plan),
         'a shut-market signal still FIRED and still carries its plan — the spec\'s rule is untouched');
  /* the firing rule itself: a weekend bar must still pass the session test,
     because that is what the spec says and hg-v950 does not change it */
  assert(shut.some(s => { const h = new Date(s.t * 1000).getUTCHours(); return h >= 13 && h < 18; }),
         'and at least one of them sits inside the 13:00-18:00 UTC window it passed');

  /* fails open: same tape, no calendar loaded */
  const W2 = boot(['indicators.js', 'eightypercent.js']);
  assert(typeof W2.hgGoldWeekendVerdict !== 'function', 'the probe context genuinely lacks the calendar');
  const res2 = W2.hg80Scan(rows, {});
  const sigs2 = (res2 && res2.signals) || [];
  assert(sigs2.length === sigs.length && sigs2.every(s => s.goldShut === null),
         'with the calendar absent it stamps null on every signal and fires exactly the same ones ('
         + sigs2.length + ')');
}

console.log('== 6) GOLD PINE stamps PER MODE ==');
{
  const W = boot(CAL.concat(['goldpine.js']));
  assert(typeof W.gpWeekendVerdict === 'function' || typeof W.runGoldPineScan === 'function'
      || W.HG_tabs.some(t => t.id === 'goldpine'),
         'GOLD PINE loaded');
  /* the helper is the unit under test; the scan needs pinegoldmath, which
     this context deliberately does not load */
  const shutRows = tapeEnding(SAT_DAY + 12 * 3600 * 1000, 80, 14400, 7);   /* ends Sat 12:00 UTC */
  const openRows = tapeEnding(WED_DAY + 12 * 3600 * 1000, 80, 14400, 7);   /* ends Wed 12:00 UTC */
  const vFn = W.gpWeekendVerdict;
  if (typeof vFn === 'function'){
    assert(!!vFn(shutRows), 'a 4h series whose last closed bar is inside the weekend reads SHUT');
    assert(vFn(openRows) === null, 'one that ends on a weekday reads open');
    assert(vFn([]) === null && vFn(null) === null, 'an empty or absent series fails open, never a fabricated verdict');
    /* the calendar itself absent — the seam the first mutation pass found
       untested on this desk */
    const W2 = boot(['goldpine.js']);
    assert(typeof W2.hgGoldWeekendVerdict !== 'function', 'the probe context genuinely lacks the calendar');
    assert(W2.gpWeekendVerdict(shutRows) === null,
           'with the calendar absent GOLD PINE returns null on a weekend series — fails OPEN, never assumes shut');
  } else {
    assert(false, 'gpWeekendVerdict is not reachable — the wiring would be unguarded');
  }
}

console.log('== 7) GOLD PRO stamps from the bar its plan is composed on ==');
{
  const W = boot(CAL.concat(['goldpro.js']));
  const vFn = W.gpProWeekendVerdict;
  if (typeof vFn === 'function'){
    assert(!!vFn(tapeEnding(SAT_DAY + 12 * 3600 * 1000, 60, 14400, 11)),
           'a series ending inside the weekend reads SHUT');
    assert(vFn(tapeEnding(WED_DAY + 12 * 3600 * 1000, 60, 14400, 11)) === null,
           'one ending on a weekday reads open');
    assert(vFn([]) === null, 'an empty series fails open');
    const W2 = boot(['goldpro.js']);
    assert(typeof W2.hgGoldWeekendVerdict !== 'function', 'the probe context genuinely lacks the calendar');
    assert(W2.gpProWeekendVerdict(tapeEnding(SAT_DAY + 12 * 3600 * 1000, 60, 14400, 11)) === null,
           'with the calendar absent GOLD PRO returns null on a weekend series — fails OPEN, never assumes shut');
  } else {
    assert(false, 'gpProWeekendVerdict is not reachable — the wiring would be unguarded');
  }
}

console.log('== 8) every desk fails OPEN with the calendar absent ==');
{
  /* no indicators2.js and no gold-formation.js: hgGoldWeekendVerdict is gone */
  const W = boot(['optigold.js']);
  assert(typeof W.hgGoldWeekendVerdict !== 'function', 'the probe context genuinely lacks the calendar');
  const rows = tape(Date.UTC(2026, 3, 9, 0, 0, 0), 600, 900, 991);
  const out = W.__ogSignals(rows, W.__ogLanes[0]);
  assert(out.length > 0 && out.every(s => s.goldShut === null),
         'OPTI GOLD stamps null on every setup rather than guessing (' + out.length + ' setups)');
  const px = rows[rows.length - 1].c;
  const waiting = out.find(s => s.state === 'waiting');
  if (waiting){
    const r = W.__ogReach(waiting, px);
    assert(r && !/GOLD WAS SHUT/.test(r.why || ''),
           'and nothing is withheld — a calendar the desk cannot read is not a reason to withhold a setup');
  } else {
    assert(true, 'no waiting setup to contrast on this tape');
  }
}

console.log('== 9) the coverage reporter routes all four ==');
{
  const W = boot(CAL);
  for (const [desk, probe] of [['OPTI GOLD','optiGoldState'], ['GOLD PINE','goldPineScan'],
                               ['GOLD PRO','goldProState'], ['80PERCENT','eightyPercentState']]){
    W[probe] = function(){ return null; };
  }
  const cov = W.hgGoldWeekendCoverage();
  for (const desk of ['OPTI GOLD', 'GOLD PINE', 'GOLD PRO', '80PERCENT']){
    const row = cov.covered.find(c => c.desk === desk);
    assert(!!row && typeof row.via === 'string' && row.via.length > 0,
           desk + ' reports COVERED with its route named: ' + ((row && row.via) || '(none)'));
  }
  assert(cov.uncovered.length === 0,
         'no minting gold desk on the list is left uncovered');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
