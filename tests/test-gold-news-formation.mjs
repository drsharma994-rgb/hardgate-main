/* HARDGATE — hg-v964: the news gate reaches the three desks that record a
   TICKET, and both gold calendars are judged on one instant.

   hg-v963 gave the gold news gate a shared route and its own reporter then
   named SEVEN desks with no route at all. Three of them record a
   CONDITIONALLY TRUE ticket into the forward ledger, so a plan composed inside
   a CPI / NFP / FOMC / GDP window entered that ledger as TRADEABLE and would be
   judged as one — the contamination hg-v949 measured for the weekend, arriving
   through the other calendar:

     newgold.js:1260   ticket: r.ticket === true
     newgold.js:1622   ticket: !!(r.formation && r.formation.tradable === true …)
     omnigold1.js:1599 ticket: !!(c.verdict && c.verdict.qualifies)
     goldpro.js:836    ticket: gpAligned

   NEW GOLD and OMNIGOLD 1 reach formation through hgGoldFormation, so the lock
   goes THERE — one rule, one home (hg-v949) — beside the weekend check and on
   the SAME opts.atMs, so the two calendars cannot judge different moments. That
   drift is what produced the hg-v952 wall-clock defect and its hg-v963 repeat.

   GOLD PRO decides `ticket` at its own forward-record site, so it reads the
   gate at the same bar as its own weekend verdict.

   Run: node tests/test-gold-news-formation.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(files, news){
  const ctx = { console, Math, Date, JSON, Error, Promise, RegExp, isFinite, isNaN,
                parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of files){
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ /* reported below */ }
  }
  if (news !== undefined) ctx.hgNewsState = () => news;
  return ctx;
}

/* April 2026 is EDT. A WEEKDAY instant, so the weekend rule cannot be what
   stands these setups aside — otherwise "not tradable during CPI" proves
   nothing (the hg-v950 fixture lesson). */
const CPI = Date.UTC(2026, 3, 8, 12, 30);
const SNAP = { events: [{ title: 'US CPI m/m', t: CPI }] };
const CLEAR = Date.UTC(2026, 3, 8, 8, 0);

const FULL = ['indicators2.js', 'omnigold.js', 'goldind.js', 'gold-formation.js'];
const W = boot(FULL, SNAP);

/* a stop wide enough to clear the PAXG venue floor, so a clear-window run
   genuinely FORMS */
const SETUP = { kind: 'TRIPLE-CONF', horizon: '1H', dir: 'long',
  plan: { entry: 2300, stop: 2240, t1: 2450, rr1: 2.5 }, entry: 2300, stop: 2240, t1: 2450 };
const CONFS = [{ label: 'fvg', ok: true, cls: 'structure' },
               { label: 'vwma', ok: true, cls: 'momentum' },
               { label: 'htf', ok: true, cls: 'session-htf' }];
const form = (atMs, ctx) => (ctx || W).hgGoldFormation(SETUP,
  { tab: 'NEWGOLD:1H', mechanic: 'TRIPLE-CONF', confirmations: CONFS,
    requireClasses: ['session-htf'], atMs: atMs });

/* =====================================================================
   1. THE CLEAR CASE FORMS — or nothing below proves anything.
   ===================================================================== */
{
  const clear = form(CLEAR);
  eq(clear.tradable, true, 'a clear weekday instant genuinely FORMS and is tradable');
  eq(clear.state, 'FORMED', 'and reads FORMED');
  ok(clear.news !== undefined, 'the news verdict rides on the result either way');
  eq(clear.news && clear.news.locked, false, 'and says CHECKED AND CLEAR, not "could not check"');
}

/* =====================================================================
   2. THE LOCK: inside the window, tradable is withheld and nothing else.
   ===================================================================== */
{
  for (const [lab, at] of [['-30 min', CPI - 30 * 60000 + 1000],
                           ['-10 min', CPI - 10 * 60000],
                           ['at the release', CPI],
                           ['+10 min', CPI + 10 * 60000]]){
    const r = form(at);
    eq(r.tradable, false, lab + ': tradable is withheld');
    eq(r.state, 'STOOD-ASIDE', lab + ': and the state says stood aside');
    ok(r.news && r.news.locked === true, lab + ': the news verdict is the reason');
    ok((r.reasons || []).some(x => /GOLD NEWS LOCK/.test(x)),
      lab + ': and the reason is NAMED, not silent');
  }

  /* it releases — a gate that never opens is not a gate */
  const after = form(CPI + 3 * 3600000);
  eq(after.tradable, true, 'well after the window it forms again');
  eq(after.news.locked, false, 'and reads clear');

  /* THE CARD KEEPS ITS EVIDENCE. hg-v552/v572: a hard drop empties a board,
     a demote does not — so confluence and the venue read must survive. */
  const locked = form(CPI - 10 * 60000);
  ok(locked.confluence, 'the confluence read survives the lock');
  ok(locked.venue !== undefined, 'and the venue read');
  ok(locked.evidence !== undefined, 'and the evidence');
}

/* =====================================================================
   3. ONE INSTANT, BOTH CALENDARS — and each half fails open alone.
   ===================================================================== */
{
  const g = W.hgGoldGateAt(CPI - 10 * 60000, SNAP);
  ok(g.news && g.news.locked === true, 'the paired helper reports the news lock');
  eq(g.atMs, CPI - 10 * 60000, 'and the instant it judged');
  if (g.weekend) eq(g.weekend.atMs, g.news.atMs,
    'both calendars were judged at the SAME instant, by construction');
  n++;

  const blk = W.hgGoldGateBlock(CPI - 10 * 60000, SNAP);
  ok(blk && blk.news === true, 'hgGoldGateBlock names the news half');
  ok(blk.why && blk.why.length > 20, 'and carries a reason');
  eq(W.hgGoldGateBlock(CPI + 3 * 3600000, SNAP), null,
    'and returns NULL when nothing is withheld — not an empty string, because '
    + "'' and null read the same at a call site and only one means \"asked\"");

  /* each half independently fails open */
  eq(W.hgGoldGateBlock(null, SNAP), null, 'no instant withholds nothing');
  eq(W.hgGoldGateBlock(0, SNAP), null, 'epoch zero withholds nothing (hg-v953)');
  const noSnap = W.hgGoldGateAt(CPI - 10 * 60000, null);
  eq(noSnap.news, null, 'no snapshot yields no news verdict');
}

/* =====================================================================
   4. FAILS OPEN at every seam on the formation path.
   ===================================================================== */
{
  eq(form(undefined).tradable, true, 'no atMs -> the setup stands exactly as before');
  eq(form('x').tradable, true, 'an unreadable atMs changes nothing');
  eq(form(0).tradable, true, 'epoch zero changes nothing');

  /* goldind absent -> the gate cannot be read -> nothing is withheld */
  const noGate = boot(['indicators2.js', 'omnigold.js', 'gold-formation.js'], SNAP);
  const r = form(CPI - 10 * 60000, noGate);
  eq(r.tradable, true,
    'with goldind.js absent the lock cannot be read and NOTHING is withheld — '
    + 'a gate the desk cannot read is not a reason to withhold a setup');
  eq(r.news, null, 'and the verdict is null rather than a second news calendar');

  /* no snapshot at all -> fails open */
  const noNews = boot(FULL, null);
  eq(form(CPI - 10 * 60000, noNews).tradable, true,
    'no snapshot -> fails open, exactly as when there is genuinely no news');
}

/* =====================================================================
   5. GOLD PRO: the gate at the SAME bar as its own weekend verdict,
      withholding the ticket flag and nothing else.
   ===================================================================== */
{
  const gp = boot(['indicators2.js', 'omnigold.js', 'goldind.js', 'gold-formation.js',
                   'goldpro.js'], SNAP);
  eq(typeof gp.gpProNewsVerdict, 'function', 'gpProNewsVerdict is exported');
  eq(typeof gp.gpProWeekendVerdict, 'function', 'and the weekend verdict still is');

  const rowsIn = [{ t: Math.floor((CPI - 10 * 60000) / 1000), o: 2300, h: 2310, l: 2290, c: 2305 }];
  const rowsOut = [{ t: Math.floor((CPI + 3 * 3600000) / 1000), o: 2300, h: 2310, l: 2290, c: 2305 }];
  const vIn = gp.gpProNewsVerdict(rowsIn);
  ok(vIn && vIn.locked === true, 'it locks on a bar inside the window');
  eq(gp.gpProNewsVerdict(rowsOut), null, 'and returns null outside it');

  /* SAME READER, SAME BAR as the weekend verdict — proved by giving both the
     same series and comparing the instant each judged */
  const wk = gp.hgGoldWeekendVerdict(gp.hgGoldSignalBarMs(rowsIn));
  if (wk) eq(wk.atMs, vIn.atMs,
    'the weekend and news verdicts judge the identical instant on one series');
  n++;

  /* fails open */
  eq(gp.gpProNewsVerdict([]), null, 'no rows -> no verdict');
  eq(gp.gpProNewsVerdict(null), null, 'null rows -> no verdict');
  eq(gp.gpProNewsVerdict([{ o: 1, h: 1, l: 1, c: 1 }]), null,
    'a bar with no readable instant -> no verdict');
  const noGate2 = boot(['indicators2.js', 'omnigold.js', 'gold-formation.js', 'goldpro.js'], SNAP);
  eq(noGate2.gpProNewsVerdict(rowsIn), null, 'goldind absent -> no verdict, fails open');

  /* THE TICKET IS WITHHELD, and the row is still recorded. Asserted on the
     shipped source, bounded to the record block — the ticket decision and the
     mechanic label are two lines apart and both must move together. */
  const src = read('goldpro.js');
  const at = src.indexOf("W.hgFwdRecordScan('GOLDPRO'");
  ok(at > 0, 'the GOLD PRO forward record site is locatable');
  const blockStart = src.lastIndexOf('var gpAligned', 0 + at);
  /* hg-v980: bounded to the call's own closing `}], {` rather than a fixed
     character count -- a field added to the record map (feed in v979, mark in
     v980) pushed the label past a fixed slice with the rule untouched. */
  const recEnd = src.indexOf('}], {', at);
  ok(recEnd > at, 'the record call closes after the site');
  const stmt = src.slice(blockStart, recEnd + 5);
  ok(/gpNewsLock/.test(stmt), 'the record site reads the news lock');
  ok(/if \(gpNewsLock\) gpAligned = false;/.test(stmt),
    'and a locked window withholds the ticket flag');
  ok(/GP-NEWS-LOCKED/.test(stmt),
    'and the row is still RECORDED, labelled so the population can be separated later');
  ok(/hgFwdRecordScan/.test(stmt), 'the forward row is not dropped');

  /* THE CALL SITE, LIFTED AND EXECUTED. Testing the exported verdict proves the
     rule; it does not prove the DESK asks for it. Deleting the two lines that
     read the gate and stash it on the plan left every assertion above passing —
     `gpNewsLock` is derived from `lvPlan.newsLock`, so with nothing setting that
     it is simply always false and the ticket is never withheld. Passing a
     different series survived for the same reason. Both are caught by running
     the statement and observing what it is handed (the hg-v963 technique). */
  const callAt = src.indexOf('var gpNews = gpProNewsVerdict(');
  ok(callAt > 0, 'the GOLD PRO news call site is locatable');
  const callEnd = src.indexOf('\n', src.indexOf('lvPlan.newsLock = gpNews;', callAt));
  ok(callEnd > callAt, 'and terminated');
  const lifted = src.slice(callAt, callEnd);

  const seen = [];
  const sand = {
    lvRows: rowsIn,
    lvPlan: {},
    gpProNewsVerdict: (rows) => { seen.push(rows); return { locked: true, atMs: 1 }; }
  };
  vm.createContext(sand);
  vm.runInContext(lifted, sand);
  eq(seen.length, 1, 'the desk really CALLS the news verdict once per scan');
  eq(seen[0], rowsIn,
    'and hands it lvRows — the SAME series its weekend verdict reads, so the two '
    + 'calendars cannot judge different instants');
  ok(sand.lvPlan.newsLock && sand.lvPlan.newsLock.locked === true,
    'and stashes the lock on the plan, which is what the ticket decision reads');

  /* and it does not stash anything when the gate is clear */
  const sand2 = { lvRows: rowsOut, lvPlan: {}, gpProNewsVerdict: () => null };
  vm.createContext(sand2);
  vm.runInContext(lifted, sand2);
  eq(sand2.lvPlan.newsLock, undefined, 'a clear gate stashes nothing');
}

/* =====================================================================
   6. The reporter moves the three desks out of UNCOVERED.
   ===================================================================== */
{
  const c = W.hgGoldNewsCoverage();
  ok(c, 'the reporter reports');
  eq(c.shared, 'VERIFIED', 'the shared route is proved behaviourally');

  const routed = new Set([...c.verified, ...c.notLoaded].map(r => r.tab));
  for (const t of ['newgold', 'omnigold1', 'goldpro'])
    ok(routed.has(t), t + ' is now routed, not uncovered');

  const un = new Set(c.uncovered.map(r => r.tab));
  for (const t of ['newgold', 'omnigold1', 'goldpro'])
    ok(!un.has(t), t + ' no longer reports UNCOVERED');

  /* hg-v965: this required the uncovered bucket to be NON-EMPTY, so that the
     four desks this pack left were "named rather than quietly dropped". hg-v965
     routed all four and the bucket went legitimately empty, turning this red
     with nothing wrong — the third time this session an expectation about how
     many desks are left has gone stale in a guard. What must hold is that the
     reporter NAMES a gap when there is one, so make one (hg-v950). */
  const census = W.HG_GOLD_WEEKEND_MINTERS;
  census.push({ desk: 'SYNTHETIC', tab: 'synthetic-newsless', probe: 'hgNoSuchProbe' });
  const cGap = W.hgGoldNewsCoverage();
  census.pop();
  ok(cGap.uncovered.some(r => r.tab === 'synthetic-newsless'),
    'a routeless desk is reported UNCOVERED and NAMED, not quietly dropped');
  ok(cGap.uncovered.length === c.uncovered.length + 1,
    'and it is the only one added — the bucket reports exactly what has no route');

  /* partition still holds against the census count the reporter itself saw */
  const total = c.verified.length + c.uncovered.length + c.notLoaded.length;
  eq(total, c.censusSize, 'every census desk is bucketed exactly once');
}

console.log('\nOK — ' + n + ' assertions passed (gold news formation)');
