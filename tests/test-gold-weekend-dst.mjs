/* HARDGATE — the gold weekend closes on a New York hour, not a UTC one.

   hgInGoldWeekend is the gate every gold desk asks whether spot gold is
   shut. OMNIGOLD turns it into a `weekend-exposure` ledger row and a -16
   score demote, GOLD SCALP and GOLD SWING veto on it, SUPER GOLD reports
   cashOpen from it — and OMNIGOLD TICKET rows are what the XM live-order
   path sends. Its two edges were the constant 22:

     var HG_GOLD_CLOSE_UTC_H = 22;   // 22:00 UTC
     var HG_GOLD_OPEN_UTC_H  = 22;

   22:00 UTC is 17:00 in New York — but only in EST. The spot / CME week
   turns on 17:00 New York, and for the 238 days a year New York sits in
   EDT that is 21:00 UTC. So the fixed hour was an hour late at BOTH ends of
   every summer weekend, and wrong in opposite directions:

     Friday 21:00-22:00 UTC   the book is shut, the gate said open
                              -> a ticket, and on the XM path a live order,
                                 into a market that had already closed
     Sunday 21:00-22:00 UTC   the book is open, the gate said shut
                              -> an hour of gold setups vetoed, every week

   Measured hour by hour across 2026: 68 of 8760 verdicts change, which is
   34 weekends x the 2 hours above and nothing else. Winter is untouched.

   The edge is now read from Intl at the instant under test, so each end of
   one weekend gets its own offset and the spring-forward weekend correctly
   shuts at 22:00 UTC and reopens at 21:00 — a 71-hour closure, which is
   what actually happens. Where Intl cannot report a named-zone offset the
   fallback is the old constant, so the worst case is exactly today's
   behaviour and never worse.

   NOT CHANGED, and worth being explicit: this fixes WHEN the week turns,
   not the anchor itself. 17:00 New York is what the old constant already
   encoded for winter, so no new schedule is being chosen here — the fixed
   UTC hour is simply stopped from drifting against it twice a year. A
   broker whose XAUUSD session differs from the spot/CME week (XM quotes
   its own hours in server time) is a separate question this does not
   pretend to answer.

   Run: node tests/test-gold-weekend-dst.mjs */
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

function boot(opts){
  opts = opts || {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, RegExp,
              parseInt, parseFloat, NaN, Infinity, Promise, Error, TypeError,
              Set, Map, WeakMap, Symbol, Function, Boolean };
  s.Intl = Intl;
  s.window = s; s.globalThis = s;
  vm.createContext(s);
  /* A vm context is a full JS global and carries its own Intl whatever the
     sandbox object says, so removing it takes a delete INSIDE the context.
     The first version of this test left Intl in place and passed vacuously. */
  if (opts.noIntl) vm.runInContext('delete globalThis.Intl; delete this.Intl;', s);
  for (const f of ['indicators.js', 'indicators2.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const sec = ms => ms / 1000;
const shut = ms => S.hgInGoldWeekend(sec(ms));
/* the rule as it was: a fixed 22:00 UTC at both edges */
function shutFixed(ms){
  const d = new Date(ms), dow = d.getUTCDay(), h = d.getUTCHours();
  if (dow === 6) return true;
  if (dow === 5 && h >= 22) return true;
  if (dow === 0 && h < 22) return true;
  return false;
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the anchor is a New York hour');
{
  ok(typeof S.hgGoldEdgeUtcH === 'function', 'the edge hour is computed, not hardcoded');
  ok(typeof S.hgGoldNyOffsetH === 'function', 'and it comes from a named-zone offset');
  const summer = Date.UTC(2026, 6, 17, 12, 0);   /* July  — EDT */
  const winter = Date.UTC(2026, 0, 16, 12, 0);   /* January — EST */
  ok(S.hgGoldNyOffsetH(summer) === -4, 'New York is UTC-4 in July');
  ok(S.hgGoldNyOffsetH(winter) === -5, 'and UTC-5 in January');
  ok(S.hgGoldEdgeUtcH(summer) === 21, 'so the gold week turns at 21:00 UTC in summer');
  ok(S.hgGoldEdgeUtcH(winter) === 22, 'and at 22:00 UTC in winter — the old constant, for the season it fitted');
  const src = stripComments(fs.readFileSync(root + 'indicators2.js', 'utf8'));
  ok(/HG_GOLD_ANCHOR_LOCAL_H\s*=\s*17/.test(src) && /America\/New_York/.test(src),
     'the anchor is stated once, as 17:00 America/New_York');
  ok(!/HG_GOLD_CLOSE_UTC_H|HG_GOLD_OPEN_UTC_H/.test(src),
     'and the two fixed-UTC constants are gone from the file');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. a summer weekend — the two hours that were wrong');
{
  const FRI = (h, m) => Date.UTC(2026, 6, 17, h, m || 30);
  const SUN = (h, m) => Date.UTC(2026, 6, 19, h, m || 30);
  ok(shut(FRI(20)) === false, 'Friday 20:30 UTC — still trading');
  ok(shut(FRI(21)) === true,  'Friday 21:30 UTC — SHUT (the fixed rule said open)');
  ok(shutFixed(FRI(21)) === false, '   ... and the fixed rule really did say open, so this is the flip');
  ok(shut(FRI(23)) === true,  'Friday 23:30 UTC — shut under either rule');
  ok(shut(Date.UTC(2026, 6, 18, 12, 0)) === true, 'all of Saturday — shut');
  ok(shut(SUN(20)) === true,  'Sunday 20:30 UTC — still shut');
  ok(shut(SUN(21)) === false, 'Sunday 21:30 UTC — OPEN (the fixed rule said shut)');
  ok(shutFixed(SUN(21)) === true, '   ... and the fixed rule really did say shut, so this is the other flip');
  ok(shut(SUN(23)) === false, 'Sunday 23:30 UTC — open under either rule');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. a winter weekend — nothing moves');
{
  const FRI = h => Date.UTC(2026, 0, 16, h, 30);
  const SUN = h => Date.UTC(2026, 0, 18, h, 30);
  let same = 0;
  for (const h of [19, 20, 21, 22, 23]){
    ok(shut(FRI(h)) === shutFixed(FRI(h)), `Friday ${h}:30 UTC in January reads the same as it always did`);
    same++;
  }
  for (const h of [20, 21, 22, 23]){
    ok(shut(SUN(h)) === shutFixed(SUN(h)), `Sunday ${h}:30 UTC in January reads the same as it always did`);
    same++;
  }
  ok(shut(FRI(21)) === false && shut(FRI(22)) === true,
     'and the winter edge really is 22:00, so these nine are not vacuously equal');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the weekends the clocks change');
{
  /* 2026: forward 8 March, back 1 November — both at 02:00 local Sunday */
  ok(shut(Date.UTC(2026, 2, 6, 21, 30)) === false, 'spring: Friday 21:30 UTC is still EST, still trading');
  ok(shut(Date.UTC(2026, 2, 6, 22, 30)) === true,  'spring: shuts at 22:00 UTC (17:00 EST)');
  ok(shut(Date.UTC(2026, 2, 8, 20, 30)) === true,  'spring: Sunday 20:30 UTC still shut');
  ok(shut(Date.UTC(2026, 2, 8, 21, 30)) === false, 'spring: reopens at 21:00 UTC (17:00 EDT) — a 71-hour closure');

  ok(shut(Date.UTC(2026, 9, 30, 21, 30)) === true, 'autumn: Friday 21:30 UTC is EDT, already shut');
  ok(shut(Date.UTC(2026, 10, 1, 21, 30)) === true, 'autumn: Sunday 21:30 UTC is EST now, still shut');
  ok(shut(Date.UTC(2026, 10, 1, 22, 30)) === false, 'autumn: reopens at 22:00 UTC — a 73-hour closure');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. without Intl, the old behaviour exactly');
{
  const bare = boot({ noIntl: true });
  ok(vm.runInContext('typeof Intl', bare) === 'undefined',
     'a runtime with no Intl at all — checked inside the context, not on the sandbox object');
  ok(bare.hgGoldEdgeUtcH(Date.UTC(2026, 6, 17, 12, 0)) === 22,
     'the edge falls back to 22:00 UTC');
  let drift = 0, n = 0;
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 3600000){
    n++;
    if (bare.hgInGoldWeekend(sec(ms)) !== shutFixed(ms)) drift++;
  }
  ok(drift === 0, `and all ${n} hourly verdicts match the old fixed rule exactly — the fallback cannot be worse`);
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the whole year, hour by hour');
{
  let changed = 0, total = 0;
  const when = [];
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 3600000){
    total++;
    if (shut(ms) !== shutFixed(ms)){ changed++; when.push(ms); }
  }
  ok(total === 8760, `${total} hours walked`);
  ok(changed === 68,
     `${changed} verdicts differ from the fixed-22 rule — 34 weekends x the 2 edge hours, and nothing else`);
  const days = new Set(when.map(ms => new Date(ms).getUTCDay()));
  ok(days.size === 2 && days.has(5) && days.has(0),
     'every one of them is a Friday or a Sunday');
  const hours = new Set(when.map(ms => new Date(ms).getUTCHours()));
  ok(hours.size === 1 && hours.has(21),
     'and every one is in the 21:00 UTC hour — no other hour of the year moved');
  const fri = when.filter(ms => new Date(ms).getUTCDay() === 5);
  const sun = when.filter(ms => new Date(ms).getUTCDay() === 0);
  ok(fri.length === 34 && sun.length === 34, `${fri.length} Fridays and ${sun.length} Sundays, evenly`);
  ok(fri.every(ms => shut(ms) === true), 'each Friday hour now reads SHUT, which it is');
  ok(sun.every(ms => shut(ms) === false), 'each Sunday hour now reads OPEN, which it is');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. the countdown and the desks that read it');
{
  const friMorning = Date.UTC(2026, 6, 17, 9, 0);     /* summer Friday, 12h before the real close */
  const left = S.hgSecsToGoldWeekend(sec(friMorning));
  ok(isFinite(left) && left > 0, 'hgSecsToGoldWeekend still counts down');
  ok(Math.abs(left - 12 * 3600) <= 300,
     `${(left / 3600).toFixed(2)}h to the close, which is 12h — it now counts to 21:00 UTC, not 22:00`);
  ok(S.hgSecsToGoldWeekend(sec(Date.UTC(2026, 6, 18, 12, 0))) === 0, 'and reads 0 inside the closure');
  /* the line the reader sees names the hour it is counting to */
  const sum = S.hgGoldWeekendReadout([], NaN, 1.5, sec(friMorning));
  const win = S.hgGoldWeekendReadout([], NaN, 1.5, sec(Date.UTC(2026, 0, 16, 9, 0)));
  ok(/Fri 21:00 UTC close/.test(sum.headline),
     'the summer countdown line says Fri 21:00 UTC \u2014 got: ' + sum.headline);
  ok(/Fri 22:00 UTC close/.test(win.headline),
     'and the winter one says Fri 22:00 UTC \u2014 got: ' + win.headline);

  /* every desk asks the shared helper rather than keeping its own hour */
  for (const f of ['omnigold.js', 'goldscalp.js', 'goldswing.js', 'super-gold.js']){
    const src = stripComments(fs.readFileSync(root + f, 'utf8'));
    ok(/hgInGoldWeekend/.test(src), `${f} asks hgInGoldWeekend`);
    const own = /(22|21)\s*:\s*00\s*UTC/.test(src) && !/hgInGoldWeekend/.test(src);
    ok(!own, `${f} does not keep a weekend hour of its own`);
  }
}

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'see FAILs above' : '0 failed'));
