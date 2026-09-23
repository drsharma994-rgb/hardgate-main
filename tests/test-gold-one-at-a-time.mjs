/* HARDGATE — the desk whose evidence produced the fix was the one still
   exposed to it.

   hg-v926 measured the only read in the whole gold evidence base that is
   positive at BOTH fill bounds: taken one at a time the SCALP ticket book is
   +0.1484R (n=73, conservative) and +0.4155R (n=54, the other), against
   -0.1160R all at once (n=8132). The walk publishes 59.4 plans a day on one
   instrument and holds 57 at once — one bet on gold at 57x size.

   It went in on OMNIGOLD and stopped there. hgOgOneAtATimeGate reads BOTH
   booking stores, so OMNIGOLD held itself back while GOLD SCALP was in a
   trade and GOLD SCALP went on stacking, for four packs.

   What this file pins:
     - a held card is DEMOTED, so it paints and keeps its levels and can
       never lead — the existing pickers do that, no second code path;
     - THE HANDOFF IS THE ENFORCEMENT. hg-v611 shipped a demote stamp with
       ADD TO BOOK still live and it was four stop-outs. Both CTAs go;
     - the position you are ALREADY IN (c.locked) is never held;
     - it FAILS OPEN — no reader, no hold;
     - the limit is on the panel: n=73 at +1.16 sigma is NOT significant.

   Run: node tests/test-gold-one-at-a-time.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
                        querySelector: () => null, querySelectorAll: () => [],
                        head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
let STORE = {};
globalThis.localStorage = {
  getItem: k => (k in STORE ? STORE[k] : null),
  setItem: (k, v) => { STORE[k] = String(v); },
  removeItem: k => { delete STORE[k]; } };
vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });

const APPLY = globalThis.gsApplyOneAtATime;
const HTML  = globalThis.gsOneAtATimeHtml;
const OPEN  = globalThis.gsOpenGoldConvictions;
const SET   = globalThis.gsSetOneAtATime;
const INIT  = globalThis.gsOneAtATimeInit;
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/* stand in for omnigold.js's reader; the real one is exercised in §6 */
const reader = n => { globalThis.hgOgOpenGoldConvictions = () => ({ n, keys: Array.from({length:n},(_,i)=>'k'+i) }); };
const noReader = () => { delete globalThis.hgOgOpenGoldConvictions; };
const row = (o) => Object.assign({ id: 'x', strategy: 'S', dir: 'long', entry: 100, stop: 99, t1: 102 }, o || {});

console.log('\n1. the asymmetry this closes actually existed');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/OG_CONVICTION_KEYS = \['hgGoldscalpConviction', 'hgGoldswingConviction'\]/.test(og),
     'OMNIGOLD holds itself back on EITHER gold desk being in a trade');
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  ok(/var CONVICTION_KEY = 'hgGoldscalpConviction';/.test(gs),
     'and GOLD SCALP is one of the two desks that writes those convictions');
  ok(typeof APPLY === 'function' && typeof HTML === 'function' && typeof OPEN === 'function',
     'so GOLD SCALP now reads the same state back, through its own exported helpers');
}

console.log('\n2. a held card is demoted — it paints, keeps levels, cannot lead');
{
  reader(1); SET(true);
  const rows = [row({ id: 'a' }), row({ id: 'b', dir: 'short' })];
  const res = APPLY(rows, null);
  ok(res && res.held === 2, 'both fresh setups are held');
  ok(rows.every(r => r.demoted === true), 'each is DEMOTED, the desk vocabulary every picker already reads');
  ok(rows.every(r => r.heldOneAtATime === true), 'and flagged, so the card can say which demote this is');
  ok(rows.every(r => r.entry === 100 && r.stop === 99 && r.t1 === 102),
     'levels are untouched — the card is held, not blanked');
  ok(rows.every(r => !r.dropped && !r.vetoed),
     'and it is not dropped or vetoed, so it still paints');
  ok(rows.every(r => (r.stamps || []).indexOf('HELD · ONE AT A TIME') >= 0),
     'the stamp names the reason on the card');

  /* the pickers must agree — assert against the SHIPPED picker, not a copy */
  const pick = globalThis.goldPickSpotAlignedBest;
  ok(typeof pick === 'function', 'goldPickSpotAlignedBest is the leader picker');
  ok(pick(rows, NaN) === null, 'and it crowns nothing once the rows are held');
  ok(pick([row({ id: 'c' })], NaN) !== null, 'while an unheld row still leads, so the null means the hold');
}

console.log('\n3. idempotent, and it reports what it did');
{
  reader(2); SET(true);
  const rows = [row({ id: 'a' })];
  const a = APPLY(rows, null), b = APPLY(rows, null);
  ok(a.held === 1 && a.n === 2, 'it reports the conviction count and how many it held');
  ok(rows[0].stamps.filter(s => s === 'HELD · ONE AT A TIME').length === 1,
     'a rescan does not stack duplicate stamps');
  ok(b && b.held === 1, 'and the second pass is stable rather than a no-op that hides the hold');
}

console.log('\n4. the trade you are IN keeps running');
{
  reader(1); SET(true);
  const live = row({ id: 'live', locked: true });
  const fresh = row({ id: 'fresh' });
  const res = APPLY([live, fresh], null);
  ok(live.demoted !== true && !live.heldOneAtATime,
     'a locked conviction is NEVER held — holding your open trade off its own card is backwards');
  ok(fresh.heldOneAtATime === true, 'while the new setup beside it is');
  ok(res.running === 1 && res.held === 1, 'and both counts are reported');
  ok(globalThis.goldPickSpotAlignedBest([live, fresh], NaN) === live,
     'so the position you are in can still lead the board');

  /* NOTHING HELD IS NOT A HOLD. A board where every row is your own open
     conviction must report null, not a result object carrying held:0 — the
     scan's status leg and the panel both branch on the object's existence as
     well as its count, and a truthy no-op is how a hold gets announced that
     never happened. */
  const allLive = [row({ id: 'l1', locked: true }), row({ id: 'l2', locked: true })];
  ok(APPLY(allLive, null) === null,
     'a board of nothing but live convictions reports NO hold, not a hold of zero');

  /* rows that never had a chance are left alone */
  const dropped = row({ id: 'd', dropped: true }), vetoed = row({ id: 'v', vetoed: true });
  APPLY([dropped, vetoed], null);
  ok(!dropped.heldOneAtATime && !vetoed.heldOneAtATime,
     'dropped and vetoed rows are not restamped — they failed for their own reasons');
}

console.log('\n5. nothing happens when nothing is open, or when it is switched off');
{
  reader(0); SET(true);
  const flat = [row({ id: 'a' })];
  ok(APPLY(flat, null) === null && !flat[0].heldOneAtATime, 'a flat book holds nothing');

  reader(3); SET(false);
  const off = [row({ id: 'a' })];
  ok(APPLY(off, null) === null && !off[0].heldOneAtATime,
     'and gsSetOneAtATime(false) really turns it off, three convictions or not');
  ok(localStorage.getItem('hg_gs_one_at_a_time') === '0', 'the choice persists');
  SET(true);
  ok(localStorage.getItem('hg_gs_one_at_a_time') === '1', 'and so does turning it back on');

  ok(APPLY(null, null) === null && APPLY([], null) === null, 'no rows, nothing to say');
}

console.log('\n6. it FAILS OPEN, and borrows one definition rather than copying it');
{
  SET(true);
  noReader();
  const rows = [row({ id: 'a' })];
  ok(OPEN().n === 0 && OPEN().reader === null,
     'with omnigold.js absent the reader is missing and the count is 0');
  ok(APPLY(rows, null) === null && !rows[0].heldOneAtATime,
     'so every setup STANDS — refusing to trade because a file did not load is a gate nobody chose');

  globalThis.hgOgOpenGoldConvictions = () => { throw new Error('storage denied'); };
  const rows2 = [row({ id: 'b' })];
  ok(OPEN().n === 0, 'a reader that throws is 0 open, not an exception out of the scan');
  ok(APPLY(rows2, null) === null && !rows2[0].heldOneAtATime, 'and again the setups stand');

  globalThis.hgOgOpenGoldConvictions = () => ({ n: 'not a number' });
  ok(OPEN().n === 0, 'a non-numeric count is 0 rather than NaN leaking into the comparison');

  /* THE REAL READER, on the real store shape — this is what runs in the tab */
  delete globalThis.hgOgOpenGoldConvictions;
  const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object,
                Array, JSON, Date, RegExp, document: globalThis.document, setTimeout: () => 0,
                clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')), localStorage: globalThis.localStorage };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js', 'plans.js', 'hg-plan.js',
                   'hg-gates.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f }); } catch (e) {}
  }
  ok(typeof ctx.hgOgOpenGoldConvictions === 'function',
     'omnigold.js really exports the reader this desk borrows');
  STORE = {};
  ok(ctx.hgOgOpenGoldConvictions().n === 0, 'an empty store is 0 open');
  STORE['hgGoldscalpConviction'] = JSON.stringify({ v: 1, live: { 'S|long|100': { id: 1 } } });
  STORE['hgGoldswingConviction'] = JSON.stringify({ v: 1, live: { 'W|short|90': { id: 2 } } });
  ok(ctx.hgOgOpenGoldConvictions().n === 2,
     'and a live conviction on EACH desk counts as two — a position is a position whichever tab opened it');
  STORE = {};
}

console.log('\n7. the handoff is the enforcement, not the demote');
{
  const src = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  ok(/var heldOne = !!c\.heldOneAtATime;/.test(src), 'the card reads the flag');
  ok(/var tradeBtn = \(tradeOnclick && !heldOne\)/.test(src),
     'SEND TO TRADE PLAN is withheld on a held card');
  ok(/var bookBtn = \(typeof bookBtnHTML === 'function' && c\.sym && !heldOne\)/.test(src),
     'and so is ADD TO BOOK — hg-v611 proved a demote alone does not remove them');
  ok(/\+ heldOneLine\n/.test(src), 'and the space where they were says why, rather than going blank');
  ok(/cannot be booked or sent to TRADE PLAN/.test(src), 'in words, on the card itself');

  /* applied in the right place: after the lock stamps c.locked, before the pick */
  /* Asserted by SOURCE POSITION, and deliberately so: "move this call above
     the lock" is a defect a single-string mutation cannot express, so the
     ordering has no behavioural guard and this index check is the only thing
     standing between the hold and a version that runs before c.locked exists
     — at which point it would demote your open trade off its own card. */
  const iLock = src.indexOf('var lock = applyConviction(ranked');
  const iApply = src.indexOf('gsApplyOneAtATime(ranked, null)');
  const iPick = src.indexOf('best = goldPickSpotAlignedBest(ranked, spotRef)');
  ok(iLock > 0 && iApply > iLock,
     'the hold runs AFTER applyConviction, so c.locked is already set and live trades are recognised');
  ok(iPick > iApply, 'and BEFORE the leader is picked, so MOST PROBABLE empties with no second code path');
}

console.log('\n8. the panel states the claim AND its limit');
{
  reader(1); SET(true);
  ok(HTML(null) === '' && HTML({ held: 0 }) === '',
     'nothing is rendered on a flat book — a standing lecture is what gets scrolled past');
  const t = text(HTML({ n: 1, held: 4, running: 1, keys: [] }));
  ok(/ONE POSITION AT A TIME/.test(t), 'it names itself');
  ok(/1 gold conviction is live/.test(t) && /4 new setups are HELD/.test(t),
     'and says exactly what is held and why');
  ok(/keep their levels/.test(t), 'that the cards are intact');
  ok(/ADD TO BOOK/.test(t) && /SEND TO TRADE PLAN/.test(t), 'that the handoffs are the thing withheld');
  ok(/1 conviction you are already in keeps running/.test(t),
     'and that your open trade is unaffected');

  ok(/59\.4 plans a day/.test(t) && /57 at once/.test(t), 'the concentration arithmetic is quoted');
  ok(/\+0\.148R/.test(t) && /\+0\.416R/.test(t) && /0\.116R/.test(t),
     'with both fill bounds and the all-at-once book to compare against');

  /* THE LIMIT IS NOT OPTIONAL. An n=73 result presented without its sigma is
     how a not-significant number becomes a house rule nobody re-examines. */
  ok(/n=73 at \+1\.16/.test(t), 'the sample and sigma are on the panel');
  ok(/not significant/.test(t), 'stated as NOT SIGNIFICANT, in those words');
  ok(/uncorrected single test/.test(t), 'against a bar the reader can place it on');
  ok(/SWING disagrees between the bounds/.test(t), 'and SWING is recorded as carrying no verdict');
  ok(/gsSetOneAtATime\(false\)/.test(t), 'with the switch that reverses it');

  const t2 = text(HTML({ n: 2, held: 1, running: 0, keys: [] }));
  ok(/2 gold convictions are live/.test(t2) && /1 new setup is HELD/.test(t2),
     'singular and plural are both right, so the panel never reads as a template');
  ok(!/you are already in/.test(t2), 'and the running clause is dropped when nothing is running');
}

console.log('\n9. no threshold moved');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/if \(lv\.rr < 1\.2\)\{/.test(gi), 'the 1.2R scalp floor is unchanged');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/var COST_VETO_R_SCALP = 0\.15;/.test(og) && /var COST_VETO_R = 0\.30;/.test(og),
     'the cost ceilings are unchanged');
  ok(/var OG_ONE_AT_A_TIME_DEFAULT = true;/.test(og), 'and OMNIGOLD keeps its own hold');
}

console.log('\n' + passed + ' assertions — all green');
