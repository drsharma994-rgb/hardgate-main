/* HARDGATE — hg-v965: the LAST FOUR gold desks get the news gate, and the
   coverage reporter's `uncovered` bucket reaches ZERO.

   hg-v963 built that reporter so gaps would name themselves and it named
   SEVEN. hg-v964 wired the three that record a conditionally true ticket and
   took it to four. The four left — OPTI GOLD, 80PERCENT, GOLD (inline) and
   TAURIC — mint or price from raw bars and had no news reference of any kind.

   NO NEW POLICY IS INVENTED PER DESK. Each treats the news lock exactly as it
   already treats the weekend, because the two calendars make the same claim
   about the same instant. OPTI GOLD withholds ACTIONABLE (hg-v950); the inline
   GOLD lanes withhold both handoffs (hg-v951); 80PERCENT and TAURIC mark and
   withhold nothing (hg-v950 / hg-v952), their rows recording no ticket.

   ZERO NEW WRAPPERS, and that is the shape: those three files carry a
   byte-identical weekend wrapper each, so three matching news wrappers would
   be SIX copies of one rule (hg-v949). The null-unless-it-locks rule lives
   once, as hgGoldNewsMark.

   Behavioural throughout: each desk's real mint is driven and the mark read
   back off what it produced, and the inline lanes' real assignment statements
   are lifted out of the shell and EXECUTED (the hg-v951 technique).

   Covers:
     1) the rule lives ONCE and fails open at every seam
     2) the coverage reporter reaches zero uncovered, and is not a rubber stamp
     3) OPTI GOLD marks per setup from its OWN bar and withholds ACTIONABLE
     4) 80PERCENT marks per signal; its firing rule is untouched
     5) TAURIC marks on the card, on the SAME instant its record uses
     6) the inline GOLD lanes withhold BOTH handoffs, per lane
     7) GOLD SCALP's 3-minute clock: one page one clock, busy is normal
     8) no desk grew a wrapper of its own
   Run: node tests/test-gold-news-raw-minters.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

/* one synthetic tier-1 event; synthetic on purpose, because a probe that
   needed the live calendar would report BROKEN on any quiet week. */
const CPI = Date.UTC(2026, 3, 8, 12, 30, 0);          /* Wednesday, gold OPEN */
const SNAP = { events: [{ title: 'US CPI m/m', t: CPI }] };

function boot(files, opts){
  opts = opts || {};
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
  /* the snapshot the desks read through hgGoldNewsSnapshot -> window.hgNewsState */
  if (opts.news !== false) ctx.hgNewsState = () => SNAP;
  return ctx;
}
const CAL = ['indicators.js', 'indicators2.js', 'goldind.js', 'omnigold.js', 'gold-formation.js'];

console.log('== 1) the rule lives ONCE, and fails open at every seam ==');
{
  const W = boot(CAL);
  assert(typeof W.hgGoldNewsMark === 'function', 'hgGoldNewsMark is exported');

  const locked = W.hgGoldNewsMark(Math.floor((CPI - 10 * 60000) / 1000), SNAP);
  const after  = W.hgGoldNewsMark(Math.floor((CPI + 3 * 3600000) / 1000), SNAP);
  assert(locked && locked.locked === true, 'ten minutes before a CPI release it LOCKS');
  assert(after === null, 'three hours after it returns null — a gate that never opens is not a gate');
  assert(!!(locked && locked.why && /signal bar/.test(locked.why)),
         'and the reason names the instant it was judged at, not the wall clock');

  /* null unless locked: an open instant yields null, never a not-locked object,
     because the three raw-bar desks branch on truthiness */
  assert(after === null && W.hgGoldNewsMark(Math.floor((CPI - 6 * 3600000) / 1000), SNAP) === null,
         'an unlocked instant is NULL, never a falsy-locked object the call sites would still branch on');

  /* every seam, independently */
  assert(W.hgGoldNewsMark(null, SNAP) === null, 'a null instant yields no verdict');
  assert(W.hgGoldNewsMark('', SNAP) === null, "an empty-string instant yields no verdict");
  assert(W.hgGoldNewsMark(0, SNAP) === null, 'EPOCH ZERO yields no verdict (hg-v953: +null === 0 is 1970, not a bar)');
  assert(W.hgGoldNewsMark(NaN, SNAP) === null, 'an unreadable instant yields no verdict');
  assert(W.hgGoldNewsMark(Math.floor(CPI / 1000), null) === null,
         'no snapshot is NOT "no news" — it is no reading, and yields no verdict');

  /* it delegates: with goldind.js absent there is no news calendar at all,
     rather than a second one grown here */
  const bare = boot(['indicators.js', 'indicators2.js', 'gold-formation.js']);
  assert(typeof bare.hgGoldNewsGate !== 'function', 'the bare context genuinely lacks hgGoldNewsGate');
  assert(bare.hgGoldNewsMark(Math.floor((CPI - 10 * 60000) / 1000), SNAP) === null,
         'and with it absent the mark is null — it DELEGATES, it does not re-decide what a tier-1 event is');
  const src = fs.readFileSync(path.join(ROOT, 'gold-formation.js'), 'utf8');
  const i = src.indexOf('function hgGoldNewsMark');
  const blk = src.slice(i, src.indexOf('\n  }', i));
  assert(i > 0 && /hgGoldNewsVerdict/.test(blk) && !/CPI|NFP|FOMC|30 \* 60|1800000/.test(blk),
         'and its body holds no calendar, no event list and no window of its own');
}

console.log('== 2) the coverage reporter reaches ZERO uncovered ==');
{
  const W = boot(CAL.concat(['optigold.js', 'eightypercent.js', 'tauric.js',
                             'newgold.js', 'omnigold1.js', 'goldpro.js', 'goldpine.js',
                             'goldultra.js', 'golddirection.js', 'goldswing.js', 'goldscalp.js',
                             'super-gold.js']));
  const cov = W.hgGoldNewsCoverage();
  assert(!!cov, 'the reporter returns a report');
  assert(cov.uncovered.length === 0,
         'ZERO desks uncovered (was 7 at hg-v963, 4 at hg-v964) — ' + cov.censusSize + ' in the census');
  assert(cov.verified.length + cov.uncovered.length + cov.notLoaded.length === cov.censusSize,
         'and the buckets still PARTITION the census the reporter itself saw');

  /* the four this pack added are present and routed */
  for (const tab of ['optigold', '80percent', 'gold', 'tauric']){
    const row = cov.verified.concat(cov.notLoaded).find(r => r.tab === tab);
    assert(!!(row && row.route && /hg-v965/.test(row.route)),
           tab + ' has a route, and it names the pack that added it');
  }

  /* NOT A RUBBER STAMP: a bucket nothing can land in proves nothing, so push a
     synthetic routeless desk and require it to still be reported (hg-v950). */
  W.HG_GOLD_WEEKEND_MINTERS.push({ desk: 'SYNTHETIC', tab: 'synthetic-desk', probe: 'hgNoSuchProbe' });
  const cov2 = W.hgGoldNewsCoverage();
  assert(cov2.uncovered.length === 1 && cov2.uncovered[0].tab === 'synthetic-desk',
         'a synthetic routeless desk STILL reports UNCOVERED — the empty bucket is reachable');
  assert(cov2.censusSize === cov.censusSize + 1, 'and the census the reporter saw grew by exactly one');
}

console.log('== 3) OPTI GOLD marks per setup and withholds ACTIONABLE ==');
{
  /* The event is anchored ON A SETUP THE DESK ACTUALLY FORMED, rather than at
     a time chosen in advance. A -30/+15 window is ~3 bars of a 15m tape, so an
     event placed blind lands on no setup at all and every assertion below
     passes over an EMPTY array -- which is exactly what the first cut of this
     section did. Anchoring on a real setup also makes the claim sharper: the
     marked set must be exactly those setups whose OWN bar is in the window. */
  const rows = [];
  const t0 = Math.floor((CPI - 300 * 900 * 1000) / 1000);
  let c = 2300, s = 77;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 600; i++){
    const o = c; c = o + Math.sin(i / 40) * 1.1 + (rnd() - 0.5) * 2.6 + (rnd() < 0.03 ? (rnd() - 0.5) * 16 : 0);
    const w = 0.5 + rnd() * 1.8;
    rows.push({ t: t0 + i * 900, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 800 + rnd() * 900 });
  }

  const W = boot(CAL.concat(['optigold.js']));
  assert(typeof W.__ogSignals === 'function' && Array.isArray(W.__ogLanes), 'the real mint is reachable');
  const L = W.__ogLanes[0];                                  /* 15m lane */

  /* a quiet calendar first: nothing may be marked */
  W.hgNewsState = () => ({ events: [] });
  const base = W.__ogSignals(rows, L);
  assert(base.length > 1, 'the rule forms setups on this tape (' + base.length + ')');
  assert(base.every(x => !x.newsLock), 'with a quiet calendar NOTHING is marked');

  /* now put a release on one of those setups' own bars */
  const target = base[Math.floor(base.length / 2)];
  const EV = target.t * 1000;
  W.hgNewsState = () => ({ events: [{ title: 'US CPI m/m', t: EV }] });
  const out = W.__ogSignals(rows, L);
  assert(out.length === base.length, 'the same setups form either way — the calendar marks, it does not filter');

  const inWin = x => { const dt = x.t * 1000 - EV; return dt >= -30 * 60000 && dt <= 15 * 60000; };
  const locked = out.filter(x => x.newsLock), free = out.filter(x => !x.newsLock);
  assert(locked.length > 0, 'the setup the release sits on IS marked (' + locked.length + ' in all)');
  assert(free.length > 0, 'and the rest are not (' + free.length + ') — the mark is PER SETUP, not per scan');
  assert(locked.every(inWin) && free.every(x => !inWin(x)),
         "the marked set is EXACTLY the setups whose OWN bar falls in the -30/+15 window");

  /* the withhold, driven through the shipped reach function */
  const px = rows[rows.length - 1].c;
  const one = out.find(x => x.newsLock);
  const r = W.__ogReach(one, px);
  assert(r && r.ok === false && /TIER-1 GOLD NEWS LOCK/.test(r.why),
         'it is not ACTIONABLE, and the reason names the calendar');
  /* Number.isFinite, NOT isFinite: isFinite(null) is TRUE, because +null === 0.
     The first cut used the coercing form and a mutation that nulled all three
     levels SURVIVED it -- the same trap this codebase has now hit seven times,
     here inside the assertion meant to catch it. */
  assert(Number.isFinite(one.entry) && Number.isFinite(one.stop) && Number.isFinite(one.t1),
         'and it keeps its ENTRY / STOP / T1 — withheld, not deleted (hg-v552/v572)');
  const other = out.find(x => !x.newsLock && x.state === 'waiting');
  if (other){
    const r2 = W.__ogReach(other, px);
    assert(!/TIER-1 GOLD NEWS LOCK/.test((r2 && r2.why) || ''),
           'an unmarked setup carries no such reason — the withhold is specific');
  } else {
    assert(true, 'no unmarked waiting setup on this tape to contrast — not asserted either way');
  }

  /* same instant expression as the weekend read */
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  assert(/s\.goldShut = ogWeekendVerdict\(rows\[t\]\.t\);[\s\S]{0,1400}?s\.newsLock = [^\n]*hgGoldNewsMark\(rows\[t\]\.t\)/.test(src),
         'both calendars are read on the SAME instant expression — rows[t].t');

  /* fails OPEN */
  const W2 = boot(['indicators.js', 'optigold.js']);
  assert(typeof W2.hgGoldNewsMark !== 'function', 'the bare context genuinely lacks the mark');
  const out2 = W2.__ogSignals(rows, W2.__ogLanes[0]);
  assert(out2.length === out.length && out2.every(x => x.newsLock === null),
         'with gold-formation absent it marks null and forms exactly the same setups (' + out2.length + ')');
}

console.log('== 4) 80PERCENT marks per signal, firing rule untouched ==');
{
  const W = boot(CAL.concat(['eightypercent.js']));
  assert(typeof W.hg80Scan === 'function', '80PERCENT exposes hg80Scan');
  /* a tape built to FIRE -- a random one fires nothing and every assertion
     below would pass vacuously (hg-v950 hit exactly that) */
  const rows = []; const t0 = Math.floor((CPI - 700 * 300 * 1000) / 1000); let c = 2300;
  for (let i = 0; i < 1400; i++){
    const cyc = i % 60, d = (cyc < 44) ? 0.55 : (cyc < 52 ? -1.9 : 1.4);
    const o = c; c = o + d;
    rows.push({ t: t0 + i * 300, o, h: Math.max(o, c) + 0.35, l: Math.min(o, c) - 0.35, c: +c.toFixed(2), v: 1000 });
  }

  W.hgNewsState = () => ({ events: [] });
  const base = (W.hg80Scan(rows, {}).signals) || [];
  assert(base.length > 1, 'the scan runs and FIRES — ' + base.length + ' signals; a zero would make this vacuous');
  assert(base.every(s => !s.newsLock), 'with a quiet calendar NOTHING is marked');

  const target = base[Math.floor(base.length / 2)];
  const EV = target.t * 1000;
  W.hgNewsState = () => ({ events: [{ title: 'US CPI m/m', t: EV }] });
  const sigs = (W.hg80Scan(rows, {}).signals) || [];
  assert(sigs.length === base.length, 'the same signals fire either way — the firing rule is untouched');

  const inWin = s => { const dt = s.t * 1000 - EV; return dt >= -30 * 60000 && dt <= 15 * 60000; };
  const locked = sigs.filter(s => s.newsLock), free = sigs.filter(s => !s.newsLock);
  assert(locked.length > 0, 'the signal the release sits on IS marked (' + locked.length + ')');
  assert(free.length > 0, 'and the rest are not (' + free.length + ')');
  assert(locked.every(inWin) && free.every(s => !inWin(s)),
         "the marked set is EXACTLY the signals whose OWN bar falls in the window");
  assert(locked.every(s => s.dir && s.plan),
         'a marked signal still FIRED and still carries its plan — nothing is withheld here (hg-v950)');

  /* the card says so */
  const src = fs.readFileSync(path.join(ROOT, 'eightypercent.js'), 'utf8');
  const ci = src.indexOf('if (sig.newsLock){');
  assert(ci > 0 && /TIER-1 GOLD NEWS LOCK/.test(src.slice(ci, ci + 700)),
         'the card carries a TIER-1 GOLD NEWS LOCK line');
  assert(/s\.goldShut = hg80WeekendVerdict\(s\.t\);[\s\S]{0,1400}?s\.newsLock = [^\n]*hgGoldNewsMark\(s\.t\)/.test(src),
         'both calendars are read on the SAME instant expression — s.t');

  const W2 = boot(['indicators.js', 'eightypercent.js']);
  const sigs2 = (W2.hg80Scan(rows, {}).signals) || [];
  assert(sigs2.length === base.length && sigs2.every(s => s.newsLock === null),
         'with the calendar absent it marks null and fires exactly the same signals (' + sigs2.length + ')');
}

console.log('== 5) TAURIC marks the card, on the SAME instant its record uses ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'tauric.js'), 'utf8');
  /* ONE definition of the instant: the record writer no longer computes it inline */
  assert(/function hgTauricBarT\(\)/.test(src), 'the bar is defined once, as hgTauricBarT');
  assert(src.match(/Math\.floor\(\(Date\.now\(\) \/ 1000\) \/ TAURIC_TF_SEC\)/g).length === 1,
         'and that expression appears EXACTLY once in the file — the record and the card cannot judge two instants');
  assert(/var barT = hgTauricBarT\(\);/.test(src), 'the record writer reads it');
  assert(/var tNews = hgTauricNewsMark\(hgTauricBarT\(\)\);/.test(src), 'and so does the card');

  /* behavioural: the mark itself, under the shipped lookup guard */
  const W = boot(CAL.concat(['tauric.js']));
  assert(typeof W.hgTauricNewsMark === 'function' || /function hgTauricNewsMark/.test(src),
         'the desk has a news reader');
  const ctx = boot(CAL);
  const m = src.match(/function hgTauricNewsMark\([\s\S]*?\n\}/m);
  vm.runInContext('var W = this; ' + m[0], ctx, { filename: 'tauric.js:mark' });
  assert(!!ctx.hgTauricNewsMark(Math.floor((CPI - 10 * 60000) / 1000)),
         'ten minutes before CPI it marks');
  assert(ctx.hgTauricNewsMark(Math.floor((CPI + 3 * 3600000) / 1000)) === null,
         'three hours after it does not');
  /* fails open with the shared rule absent */
  const bare = { console: { log(){} }, Math, Date, Number, String, Object, Array, JSON, Error, RegExp,
                 isFinite, isNaN, parseFloat, parseInt };
  bare.window = bare; bare.globalThis = bare;
  vm.createContext(bare);
  vm.runInContext('var W = this; ' + m[0], bare, { filename: 'tauric.js:bare' });
  assert(bare.hgTauricNewsMark(Math.floor((CPI - 10 * 60000) / 1000)) === null,
         'with hgGoldNewsMark absent it returns null — fails OPEN');

  /* nothing is withheld on this desk */
  const ci = src.indexOf('if (tNews){');
  const card = src.slice(ci, ci + 900);
  assert(ci > 0 && /Nothing below is withheld/.test(card),
         'and the card says plainly that nothing is withheld — these rows record no ticket');
}

console.log('== 6) the inline GOLD lanes withhold BOTH handoffs, per lane ==');
function liftInline(names, files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object,
    Array, JSON, Error, RegExp, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of (files || ['indicators.js', 'indicators2.js', 'goldind.js', 'omnigold.js', 'gold-formation.js']))
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); } catch(e){}
  ctx.hgNewsState = () => SNAP;
  for (const n of names){
    const re = new RegExp('function ' + n + '\\([\\s\\S]*?\\n\\}', 'm');
    const m = HTML.match(re);
    if (!m) throw new Error('could not lift ' + n + ' out of index.html');
    vm.runInContext(m[0], ctx, { filename: 'index.html:' + n });
  }
  return ctx;
}
function seriesEnding(endMs, n, stepSec){
  const rows = []; const t0 = Math.floor(endMs / 1000) - (n - 1) * stepSec;
  for (let i = 0; i < n; i++) rows.push({ t: t0 + i * stepSec, o: 2300, h: 2302, l: 2298, c: 2301, v: 900 });
  return rows;
}
let ICTX;
{
  ICTX = liftInline(['hgEsc', 'hgInlineGoldBarMs', 'hgInlineGoldShut', 'hgInlineGoldNews',
                     'hgInlineGoldShutHtml', 'hgInlineGoldNewsHtml']);
  assert(typeof ICTX.hgInlineGoldNews === 'function', 'hgInlineGoldNews lifted and runs');
  const m15Locked = seriesEnding(CPI - 10 * 60000, 200, 900);
  const m15Free   = seriesEnding(CPI + 3 * 3600000, 200, 900);
  assert(!!ICTX.hgInlineGoldNews(m15Locked), 'a 15m series ending inside the window reads LOCKED');
  assert(ICTX.hgInlineGoldNews(m15Free) === null, 'one ending three hours later does not');
  /* per lane: the 4h and 15m series are judged independently */
  const h4Free = seriesEnding(CPI + 3 * 3600000, 80, 14400);
  assert(!!ICTX.hgInlineGoldNews(m15Locked) && ICTX.hgInlineGoldNews(h4Free) === null,
         'the two lanes are judged independently — one can be locked while the other is not');
  assert(ICTX.hgInlineGoldNews([]) === null && ICTX.hgInlineGoldNews(null) === null,
         'an empty or absent series yields null');

  /* ONE bar read serves both calendars */
  assert(typeof ICTX.hgInlineGoldBarMs === 'function'
      && ICTX.hgInlineGoldBarMs(m15Locked) === ICTX.hgInlineGoldBarMs(m15Locked),
         'the lane instant is read through one shared function');
  const shutSrc = HTML.match(/function hgInlineGoldShut\([\s\S]*?\n\}/m)[0];
  const newsSrc = HTML.match(/function hgInlineGoldNews\([\s\S]*?\n\}/m)[0];
  assert(/hgInlineGoldBarMs\(rows\)/.test(shutSrc) && /hgInlineGoldBarMs\(rows\)/.test(newsSrc),
         'and BOTH calendars read it, so the two cannot judge different moments');

  const bare = liftInline(['hgInlineGoldBarMs', 'hgInlineGoldNews'], ['indicators2.js']);
  assert(typeof bare.hgGoldNewsMark !== 'function', 'the bare context genuinely lacks the shared rule');
  assert(bare.hgInlineGoldNews(seriesEnding(CPI - 10 * 60000, 200, 900)) === null,
         'with it absent the lane returns null — fails OPEN, never assumes locked');
}

/* two DISTINCT arrays, so which one a lane passed is visible by identity */
const LANE_SERIES = { h4: [], m15: [] };

/* Lift each lane's REAL assignment statement and RUN it (hg-v951). */
/* `seen` collects what each lane actually PASSED to the news reader. Without
   it the stub ignores its argument, so the lane could hand the news calendar
   the OTHER lane's series and every assertion below would still pass -- which
   is the hg-v964 gap exactly (testing the rule, not that the desk calls it with
   the right thing), and mutation said so out loud here too. */
function runLane(startNeedle, endNeedle, declNeedle, shut, news, seen){
  const i = HTML.indexOf(startNeedle);
  if (i < 0) throw new Error('lane start not found: ' + startNeedle);
  const j = HTML.indexOf(endNeedle, i);
  if (j < 0) throw new Error('lane end not found: ' + endNeedle);
  const d = HTML.indexOf(declNeedle, i);
  if (d < 0 || d > j) throw new Error('declaration not found: ' + declNeedle);
  const stmt = HTML.slice(d, HTML.indexOf(';', j) + 1);
  const ctx = { console: { log(){} }, Math, Date, Number, String, Object, Array, JSON,
    Error, RegExp, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const em = HTML.match(/function hgEsc\([\s\S]*?\n\}/m)[0];
  const hm = HTML.match(/function hgInlineGoldShutHtml\([\s\S]*?\n\}/m)[0];
  const nm = HTML.match(/function hgInlineGoldNewsHtml\([\s\S]*?\n\}/m)[0];
  vm.runInContext(em + '\n' + hm + '\n' + nm, ctx, { filename: 'index.html:helpers' });
  Object.assign(ctx, {
    GOLD_SYM: 'XAUUSD', casc: 'long', dir: 'long', entry: 2300, lastClose: 2300,
    stop: 2280, t1: 2340, t2: 2360, oppo: 2360,
    h4: LANE_SERIES.h4, m15: LANE_SERIES.m15,
    planBlock: () => '<!--LEVELS-->',
    hgToTradePlanOnclickAttr: () => 'SENDATTR',
    hgBookBtn: () => '<!--ADDTOBOOK-->',
    inlineScanStack: () => ({}),
    gsPlan: {}, gcPlan: {},
    hgInlineGoldShut: () => shut,
    hgInlineGoldNews: (rows) => { if (seen) seen.push(rows); return news; }
  });
  ctx.swingPlanHtml = ''; ctx.planHtml = '';
  vm.runInContext(stmt, ctx, { filename: 'index.html:lane' });
  return ctx.swingPlanHtml || ctx.planHtml;
}
{
  const news = ICTX.hgInlineGoldNews(seriesEnding(CPI - 10 * 60000, 200, 900));
  assert(!!news, 'a real locked verdict to drive the lanes with');

  for (const [lane, start, end, decl] of [
    ['SWING', "const gsShut = hgInlineGoldShut(h4);", 'stack: gsStack', 'const gsShut'],
    ['SCALP', "const gcShut = hgInlineGoldShut(m15);", 'stack: gcStack', 'const gcShut']
  ]){
    const seen = [];
    const html = runLane(start, end, decl, null, news, seen);
    assert(html.indexOf('<!--LEVELS-->') >= 0, lane + ': the LEVELS still render — nothing is deleted');
    assert(/TIER-1 GOLD NEWS LOCK/.test(html), lane + ': the notice names the news calendar');
    assert(html.indexOf('<button class="toTrade"') < 0, lane + ': SEND TO TRADE PLAN is withheld');
    assert(html.indexOf('<!--ADDTOBOOK-->') < 0, lane + ': ADD TO BOOK is withheld too — both go together (hg-v930/v611)');

    /* and with NEITHER calendar firing, both CTAs are back */
    const ok = runLane(start, end, decl, null, null);
    assert(ok.indexOf('<button class="toTrade"') >= 0 && ok.indexOf('<!--ADDTOBOOK-->') >= 0,
           lane + ': with neither calendar firing both handoffs are present — the withhold is reachable AND specific');
    assert(!/TIER-1 GOLD NEWS LOCK/.test(ok), lane + ': and no news notice is printed');

    /* a weekend takes precedence and says the WEEKEND, not the news — one
       message per cause (hg-v940) */
    const wk = runLane(start, end, decl, { why: 'weekend why' }, news);
    assert(/GOLD WAS SHUT/.test(wk) && !/TIER-1 GOLD NEWS LOCK/.test(wk),
           lane + ': a weekend says WEEKEND, not news — two causes never share one message');

    /* PER LANE, observed at the call rather than inferred: the series the lane
       handed the news calendar must be its OWN. The two stubs are distinct
       arrays, so passing the other lane's is visible by identity. */
    assert(seen.length > 0, lane + ': the lane really did ask the news calendar');
    const want = (lane === 'SWING') ? 'h4' : 'm15';
    const other = (lane === 'SWING') ? 'm15' : 'h4';
    assert(seen.every(r => r === LANE_SERIES[want]) && !seen.some(r => r === LANE_SERIES[other]),
           lane + ': and it handed it the ' + want + ' series — its OWN, not the other lane\'s');
  }
}

console.log('== 7) GOLD SCALP runs on its own 3-minute clock ==');
{
  const m = HTML.match(/const HG_GOLDSCALP_AUTO_MS = ([^;]+);/);
  assert(!!m, 'the cadence is declared as a named constant');
  const ctx = { console: { log(){} }, Math, Date, Number, String, Object, Array, JSON, Error, RegExp,
                isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  const timers = [];
  ctx.setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  vm.createContext(ctx);
  /* the slice now INCLUDES the boot calls, so "the clock is armed at boot" is
     executed rather than assumed -- deleting hgGoldScalpAutoInit() survived a
     slice that stopped just above it. hgAutoInit is declared elsewhere in the
     shell, so it is stubbed to keep the lifted block runnable. */
  ctx.hgAutoInit = () => {};
  const bootEnd = HTML.indexOf('hgGoldScalpAutoInit();', HTML.indexOf('function hgGoldScalpAutoInit'));
  assert(bootEnd > 0, 'the shell calls hgGoldScalpAutoInit() at boot');
  const blk = HTML.slice(HTML.indexOf('const HG_GOLDSCALP_AUTO_MS'),
                         bootEnd + 'hgGoldScalpAutoInit();'.length);
  /* a top-level `const` in a vm script is a LEXICAL binding and never lands on
     the context object, so reading it back as a global is undefined however
     right the constant is -- the first cut of this line did exactly that and
     failed against correct code. Publish it from inside the same scope. */
  vm.runInContext(blk + '\nglobalThis.__GS_MS = HG_GOLDSCALP_AUTO_MS;',
                  ctx, { filename: 'index.html:goldscalp-clock' });
  assert(ctx.__GS_MS === 180000,
         'it is 3 minutes (' + ctx.__GS_MS + 'ms), as asked');

  /* the block armed it on load, with no help from this test */
  assert(timers.length === 1 && timers[0].ms === 180000,
         'loading the shell block ARMS exactly one interval, at the 3-minute period');
  assert(ctx.hgGoldScalpAutoInit() === 'already',
         'and it was already armed at boot — a further init adds nothing');
  assert(ctx.hgGoldScalpAutoInit() === 'already' && timers.length === 1,
         'a SECOND init installs no second timer — one page, one clock (hg-v958)');

  /* the tick drives the real entry point */
  let calls = 0;
  ctx.goldscalpRefresh = () => { calls++; return Promise.resolve('ok'); };
  assert(ctx.hgGoldScalpAutoTick() === 'ran' && calls === 1, 'a tick calls goldscalpRefresh()');
  timers[0].fn();
  assert(calls === 2, 'and the interval the init armed is that same tick');

  /* busy is a NORMAL outcome, not a failure — goldscalpRefresh self-guards */
  ctx.goldscalpRefresh = () => Promise.resolve('busy');
  assert(ctx.hgGoldScalpAutoTick() === 'ran',
         "a 'busy' refresh is a normal tick — the desk self-guards on __scan.busy, so this needs no lock");
  const gs = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
  const gi = gs.indexOf('async function goldscalpRefresh()');
  assert(gi > 0 && /__scan\.busy\) return 'busy'/.test(gs.slice(gi, gi + 260)),
         'and that self-guard really is in goldscalpRefresh — not assumed');

  /* fails open at every seam, and the timer never dies */
  ctx.goldscalpRefresh = null;
  assert(ctx.hgGoldScalpAutoTick() === 'unavailable', 'the module absent is reported, not thrown');
  ctx.goldscalpRefresh = () => { throw new Error('boom'); };
  assert(ctx.hgGoldScalpAutoTick() === 'error', 'a throwing refresh is caught');
  /* A REJECTING refresh: asserting only the return value cannot see the
     difference, because the tick returns 'ran' synchronously either way and the
     rejection escapes as an UNHANDLED rejection -- a mutation deleting the
     .catch survived on exactly that. So listen for it. */
  const unhandled = [];
  const onUnhandled = (r) => unhandled.push(r);
  process.on('unhandledRejection', onUnhandled);
  ctx.goldscalpRefresh = () => Promise.reject(new Error('boom'));
  assert(ctx.hgGoldScalpAutoTick() === 'ran', 'a REJECTING refresh does not throw out of the tick');
  await new Promise(r => setTimeout(r, 30));
  process.off('unhandledRejection', onUnhandled);
  assert(unhandled.length === 0,
         'and the rejection is HANDLED — nothing escapes to unhandledRejection (' + unhandled.length + ')');
  ctx.goldscalpRefresh = () => { calls++; return Promise.resolve('ok'); };
  assert(ctx.hgGoldScalpAutoTick() === 'ran', 'and after all of that the clock still ticks');

  /* the global sweep is untouched */
  assert(/const HG_GLOBAL_SCAN_MS = 10 \* 60 \* 1000;/.test(HTML),
         'HG_GLOBAL_SCAN_MS is still 10 minutes — this is an extra clock, not a change to that one');
}

console.log('== 8) no desk grew a wrapper of its own ==');
{
  for (const f of ['optigold.js', 'eightypercent.js', 'tauric.js']){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert(!/function \w*NewsVerdict\(/.test(src) && !/HG_GOLD_NEWS_BEFORE|hgGoldNewsGate\(/.test(src),
           f + ' holds no news wrapper and no news calendar — the rule lives once (hg-v949)');
  }
  /* tauric's ONE lookup helper carries a guard and nothing else */
  const t = fs.readFileSync(path.join(ROOT, 'tauric.js'), 'utf8');
  const i = t.indexOf('function hgTauricNewsMark');
  const blk = t.slice(i, t.indexOf('\n}', i));
  assert(i > 0 && /typeof f !== 'function'/.test(blk) && !/locked|lock/.test(blk),
         'hgTauricNewsMark is a lookup guard — the null-unless-it-locks rule is not restated in it');
  /* the AGENTS.md correction */
  const A = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  /* BOUNDED TO THE hg-v441 SECTION. Reading the whole file cannot tell a
     historical recitation from a normative claim, and this pack's own entry
     QUOTES the old line in order to correct it -- so a whole-file search goes
     red on correct prose. That is the hg-v962 failure exactly, and it happened
     again here on the first run of this assertion. */
  const ai = A.indexOf('### Auto hard refresh — hg-v441');
  assert(ai > 0, 'the hg-v441 section is findable');
  const sec = A.slice(ai, A.indexOf('\n### ', ai + 5));
  assert(sec.length > 100 && /HG_AUTO_REFRESH_HARDCODED_MS/.test(sec),
         'and the bounded read really covers the line in question — not a vacuous empty slice');
  assert(/`HG_AUTO_REFRESH_HARDCODED_MS = 0`/.test(sec)
      && !/`HG_AUTO_REFRESH_HARDCODED_MS = HG_GLOBAL_SCAN_MS`/.test(sec),
         'the hg-v441 section no longer documents a lock hg-v656 removed');
  assert(/honoured/.test(sec) && !/clicks are ignored/.test(sec),
         'and it no longer says the AUTO selector clicks are ignored');
  assert(/3-minute clock/.test(sec), 'it names the new GOLD SCALP clock beside the sweep');
  assert(/const HG_AUTO_REFRESH_HARDCODED_MS = 0;/.test(HTML),
         'and the source really does say 0 — the corrected claim is checked against it');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD NEWS RAW-MINTER TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
