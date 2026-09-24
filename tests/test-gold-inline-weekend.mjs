/* HARDGATE — hg-v951: the desk listed as plain GOLD is an INLINE scanner in
   index.html, not a module file — and that is precisely why nothing found it.

   Every other gold desk is a file, so file-level surveys and hg-v949's
   coverage reporter (which probes module globals like optiGoldState) can
   enumerate them. runGold is ~200 lines inside the shell, registered as
   id:'gold' in HG_NAV_GROUPS. It had NO probe and therefore NO BUCKET in that
   reporter: not covered, not uncovered, absent. A reporter built so gaps name
   themselves had a blind spot, and the tab hiding in it was the one being
   asked about.

   What it does: reads getXAUCandles (whose chain falls back to Delta XAUTUSD
   and Binance PAXG, both 24/7), runs two gated lanes — swing on 4h, scalp on
   15m — and EACH calls logSetup and renders SEND TO TRADE PLAN and ADD TO
   BOOK. So a setup formed on a Saturday bar was directly bookable.

   hg-v930 is explicit that a demote alone does NOT remove those CTAs —
   hg-v611 needed a suppress verdict for exactly that, after a demote stamp
   left four stop-outs bookable. So the handoffs are REPLACED by the reason.

   Covers:
     1) the tab really is inline, and really is in the GOLD nav group
     2) the helper judges per lane, delegating to the shared calendar
     3) it fails OPEN at every seam
     4) the SWING lane withholds both CTAs and keeps everything else
     5) the SCALP lane does too, judged on ITS OWN 15m series
     6) an open-market bar still renders both CTAs
     7) the coverage reporter can no longer be blind to an inline desk
   Run: node tests/test-gold-inline-weekend.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

console.log('== 1) the tab is inline, and it is in the GOLD group ==');
{
  assert(/async function runGold\(\)/.test(HTML), 'runGold is defined INLINE in index.html, not in a module');
  const grp = HTML.match(/\{ id:'gold',\s*label:'GOLD',\s*tabs:\[([^\]]*)\]/);
  assert(!!grp, 'the GOLD nav group is declared in the shell');
  assert(/'gold'/.test(grp[1]), "and it lists a tab whose id is 'gold' — the desk itself");
  assert(!fs.existsSync(path.join(ROOT, 'gold.js')),
         'there is no gold.js — which is why every file-level survey missed it');
}

/* lift the helper out of the shell and run it for real */
function liftInline(names){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object,
    Array, JSON, Error, RegExp, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators2.js', 'omnigold.js', 'gold-formation.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  for (const n of names){
    const re = new RegExp('function ' + n + '\\([\\s\\S]*?\\n\\}', 'm');
    const m = HTML.match(re);
    if (!m) throw new Error('could not lift ' + n + ' out of index.html');
    vm.runInContext(m[0], ctx, { filename: 'index.html:' + n });
  }
  return ctx;
}

const SAT = Date.UTC(2026, 3, 11, 12, 0, 0);
const WED = Date.UTC(2026, 3,  8, 12, 0, 0);
function seriesEnding(endMs, n, stepSec){
  const rows = []; const t0 = Math.floor(endMs / 1000) - (n - 1) * stepSec;
  for (let i = 0; i < n; i++) rows.push({ t: t0 + i * stepSec, o: 2300, h: 2302, l: 2298, c: 2301, v: 900 });
  return rows;
}

console.log('== 2) the helper judges per lane, from the shared calendar ==');
let CTX;
{
  CTX = liftInline(['hgEsc', 'hgInlineGoldShut', 'hgInlineGoldShutHtml']);
  assert(typeof CTX.hgInlineGoldShut === 'function', 'hgInlineGoldShut lifted and runs');
  const h4Shut = seriesEnding(SAT, 80, 14400), m15Open = seriesEnding(WED, 200, 900);
  assert(!!CTX.hgInlineGoldShut(h4Shut), 'a 4h series ending inside the weekend reads SHUT');
  assert(CTX.hgInlineGoldShut(m15Open) === null, 'a 15m series ending on a weekday reads open');
  /* the two lanes can disagree, which is the whole reason it is per lane */
  const m15Shut = seriesEnding(SAT, 200, 900);
  assert(!!CTX.hgInlineGoldShut(m15Shut) && CTX.hgInlineGoldShut(seriesEnding(WED, 80, 14400)) === null,
         'the 4h and 15m series are judged independently — one can be shut while the other is open');
}

console.log('== 3) it fails OPEN at every seam ==');
{
  assert(CTX.hgInlineGoldShut([]) === null && CTX.hgInlineGoldShut(null) === null
      && CTX.hgInlineGoldShut(undefined) === null,
         'an empty or absent series yields null, never a fabricated verdict');
  /* the calendar itself absent */
  const bare = { console: { log(){} }, Math, Date, Number, String, Object, Array, JSON, Error, RegExp,
                 isFinite, isNaN, parseFloat, parseInt };
  bare.window = bare; bare.globalThis = bare;
  vm.createContext(bare);
  const m = HTML.match(/function hgInlineGoldShut\([\s\S]*?\n\}/m);
  vm.runInContext(m[0], bare, { filename: 'index.html:bare' });
  assert(typeof bare.hgGoldWeekendVerdict !== 'function', 'the bare context genuinely lacks the calendar');
  assert(bare.hgInlineGoldShut(seriesEnding(SAT, 80, 14400)) === null,
         'with the calendar absent a weekend series returns null — fails OPEN, never assumes shut');
}

/* Lift a lane's REAL assignment statement out of the shell and RUN it under
   stubs. The first cut of sections 4-6 grepped index.html for the branch —
   the brittle shape this session has corrected four times, and one that
   cannot see whether the branch is reachable. This executes the shipped
   expression and reads the HTML it produces. */
function runLane(startNeedle, endNeedle, declNeedle, assignNeedle, shut, extra){
  const i = HTML.indexOf(startNeedle);
  if (i < 0) throw new Error('lane start not found: ' + startNeedle);
  const j = HTML.indexOf(endNeedle, i);
  if (j < 0) throw new Error('lane end not found: ' + endNeedle);
  /* start at the VERDICT DECLARATION, not at the assignment: the assignment
     closes over it, and slicing below it lifts an expression that cannot run.
     That is a fixture bug the first cut of this section had. */
  const d = HTML.indexOf(declNeedle, i);
  if (d < 0 || d > j) throw new Error('declaration not found: ' + declNeedle);
  const k = HTML.indexOf(assignNeedle, i);
  if (k < 0 || k > j) throw new Error('assignment not found: ' + assignNeedle);
  const stmt = HTML.slice(d, HTML.indexOf(';', j) + 1);
  const ctx = { console: { log(){} }, Math, Date, Number, String, Object, Array, JSON,
    Error, RegExp, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  /* the shipped helper, not a re-implementation */
  const hm = HTML.match(/function hgInlineGoldShutHtml\([\s\S]*?\n\}/m);
  const em = HTML.match(/function hgEsc\([\s\S]*?\n\}/m);
  vm.createContext(ctx);
  vm.runInContext(em[0] + '\n' + hm[0], ctx, { filename: 'index.html:helpers' });
  Object.assign(ctx, {
    GOLD_SYM: 'XAUUSD', casc: 'long', dir: 'long', entry: 2300, lastClose: 2300,
    stop: 2280, t1: 2340, t2: 2360, oppo: 2360, h4: [], m15: [],
    planBlock: () => '<!--LEVELS-->',
    hgToTradePlanOnclickAttr: () => 'SENDATTR',
    hgBookBtn: () => '<!--ADDTOBOOK-->',
    inlineScanStack: () => ({}),
    gsPlan: {}, gcPlan: {},
    hgInlineGoldShut: () => shut
  }, extra || {});
  ctx.swingPlanHtml = ''; ctx.planHtml = '';
  vm.runInContext(stmt, ctx, { filename: 'index.html:lane' });
  return ctx.swingPlanHtml || ctx.planHtml;
}

console.log('== 4) the SWING lane withholds both CTAs and keeps the rest ==');
{
  const shut = CTX.hgInlineGoldShut(seriesEnding(SAT, 80, 14400));
  assert(!!shut, 'a shut verdict to drive the lane with');
  const html = runLane("logSetup(GOLD_SYM, casc, 'gold-swing'", 'stack: gsStack',
                       'const gsShut =', 'swingPlanHtml = ', shut);
  assert(html.indexOf('<!--LEVELS-->') >= 0, 'the LEVELS still render — nothing is deleted');
  /* assert on the BUTTON, not the phrase: the withholding notice NAMES the
     two CTAs it removes, so a text search for "SEND TO TRADE PLAN" matches
     the disclosure itself. The first cut of this assertion did exactly that
     and failed against correct code. */
  assert(html.indexOf('<button class="toTrade"') < 0, 'the SEND TO TRADE PLAN button is withheld');
  assert(html.indexOf('<!--ADDTOBOOK-->') < 0, 'ADD TO BOOK is withheld too — both go together (hg-v930/v611)');
  assert(/GOLD WAS SHUT — no handoff/.test(html), 'and the reason replaces them');
  assert(/SWING/.test(html) && /still shows its ledger and its levels/.test(html),
         'naming the lane and what is NOT withheld');
}

console.log('== 5) the SCALP lane, judged on ITS OWN 15m series ==');
{
  const shut = CTX.hgInlineGoldShut(seriesEnding(SAT, 200, 900));
  const html = runLane("logSetup(GOLD_SYM, dir, 'gold-scalp'", 'stack: gcStack',
                       'const gcShut =', 'planHtml=', shut);
  assert(html.indexOf('<!--LEVELS-->') >= 0, 'the LEVELS still render');
  assert(html.indexOf('<button class="toTrade"') < 0 && html.indexOf('<!--ADDTOBOOK-->') < 0,
         'both handoffs withheld');
  assert(/SCALP/.test(html), 'the reason names the SCALP lane');
  /* the lanes do not share a clock: the scalp lane must read m15 */
  const i = HTML.indexOf("logSetup(GOLD_SYM, dir, 'gold-scalp'");
  const blk = HTML.slice(i, HTML.indexOf('stack: gcStack', i));
  assert(/hgInlineGoldShut\(m15\)/.test(blk) && !/hgInlineGoldShut\(h4\)/.test(blk),
         'and it judges on m15, never on the swing lane\'s h4');
}

console.log('== 6) an open-market bar still renders BOTH CTAs ==');
{
  const sw = runLane("logSetup(GOLD_SYM, casc, 'gold-swing'", 'stack: gsStack',
                     'const gsShut =', 'swingPlanHtml = ', null);
  assert(sw.indexOf('<button class="toTrade"') >= 0 && sw.indexOf('<!--ADDTOBOOK-->') >= 0,
         'SWING: both handoffs present when the calendar says open');
  assert(!/GOLD WAS SHUT/.test(sw), 'and no withholding notice');
  const sc = runLane("logSetup(GOLD_SYM, dir, 'gold-scalp'", 'stack: gcStack',
                     'const gcShut =', 'planHtml=', null);
  assert(sc.indexOf('<button class="toTrade"') >= 0 && sc.indexOf('<!--ADDTOBOOK-->') >= 0,
         'SCALP: both handoffs present too — the rule withholds, it does not delete');
}

console.log('== 7) the reporter can no longer be blind to an inline desk ==');
{
  const ctx = liftInline([]);
  const row = (ctx.HG_GOLD_WEEKEND_MINTERS || []).find(r => /inline/i.test(r.desk));
  assert(!!row, 'the inline desk is listed in the coverage reporter at all (it had NO bucket before)');
  assert(row.probe === 'hgInlineGoldShut',
         'and it probes the inline function the shell defines, not a module global');
  const before = ctx.hgGoldWeekendCoverage();
  assert(before.notLoaded.includes(row.desk),
         'with the shell function absent it reports NOT LOADED — never silently covered');
  ctx.hgInlineGoldShut = function(){ return null; };
  const after = ctx.hgGoldWeekendCoverage();
  const cRow = after.covered.find(r => r.desk === row.desk);
  assert(!!cRow && /per-lane/.test(cRow.via),
         'and once the shell is loaded it reports COVERED with its route named: ' + ((cRow && cRow.via) || '(none)'));
  const all = after.covered.map(c => c.desk).concat(after.uncovered, after.notLoaded);
  assert(all.length === ctx.HG_GOLD_WEEKEND_MINTERS.length,
         'the buckets still PARTITION the list with the inline desk in it (' + all.length + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
