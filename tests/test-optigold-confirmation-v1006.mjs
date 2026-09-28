/* HARDGATE — hg-v1006: OPTI GOLD's break answers to a CONFIRMATION FLOOR.

   Run: node tests/test-optigold-confirmation-v1006.mjs

   THE HOLE THIS CLOSES
   --------------------
   Every gold desk that forms setups crowns only with cross-family agreement
   — GOLDSCALP blends a dozen detectors, GOLD SWING demands strictly more
   agreeing reads than opposing, OMNIGOLD / OMNIGOLD1 demand a minimum of
   confirmation classes, NEW GOLD demands three. OPTI GOLD alone crowned a
   bare close through a swing level with NO independent family ever asked:
   no volume, no momentum, no trend read — the probability model only RANKED
   what the rule produced.

   hg-v1006 stamps every setup with ogConfirmRead(rows, s) — three families
   on the lane's OWN tape, sliced at the break bar so nothing after the
   signal informs the read:
     VOLUME    volZ(20) > 0.5 (engine.js's G2 floor, reused, not refit)
     MOMENTUM  RSI-14 past the 50 midline AND sloping with the break over
               engine.js's 3-bar span; an exhausted RSI (>70 long, <30
               short) never counts as confirmation
     TREND     the close beyond EMA-50 with EMA-50 sloping the same way
   Fewer than two CHECKED families backing the break = UNCONFIRMED: the
   setup still renders with its evidence named, but ogTopPicks never hands
   it a TOP PICK slot. A family that cannot be read is UNCHECKED — it
   neither confirms nor vetoes — and with fewer than two readable families
   the setup is UNVERIFIED and stays eligible: the floor bites only where
   evidence exists to judge (hg-v700's honest-degradation rule).

   The tapes below are deterministic: a mixed uptrend with pullbacks (RSI
   held in the 60s, price above a rising EMA-50) and its mirror, each with a
   volume spike on the break bar. Every number here was derived by running
   the real indicators on the real tapes, never asserted blind. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok —', m); }
                       else { failed++; console.error('  FAIL —', m); } };

function boot(withIndicators){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   querySelector: () => null, addEventListener(){} };
  vm.createContext(ctx);
  if (withIndicators){
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8'), ctx, { filename: 'optigold.js' });
  return ctx;
}

/* the deterministic tapes the numbers above were derived on */
const PAT = [0.45, -0.4, 0.5, -0.5, 0.45];           /* +1.0 per 5 bars, pullbacks keep RSI in the 60s */
function upTape(){
  const rows = []; let t = 1700000000, c = 100;
  const bar = (o, h, l, cl, v) => rows.push({ t: (t += 3600), o, h, l, c: cl, v });
  for (let i = 0; i < 55; i++){ const d = PAT[i % 5]; const o = c; c = c + d;
    bar(o, Math.max(o, c) + 0.25, Math.min(o, c) - 0.25, c, i % 2 ? 95 : 105); }
  const o = c; c = c + 0.8; bar(o, c + 0.4, o - 0.3, c, 420);   /* break bar at i=55, volume 4x norm */
  return rows;
}
function dnTape(){                                                /* the exact mirror */
  const rows = []; let t = 1700000000, c = 160;
  const bar = (o, h, l, cl, v) => rows.push({ t: (t += 3600), o, h, l, c: cl, v });
  for (let i = 0; i < 55; i++){ const d = -PAT[i % 5]; const o = c; c = c + d;
    bar(o, Math.max(o, c) + 0.25, Math.min(o, c) - 0.25, c, i % 2 ? 95 : 105); }
  const o = c; c = c - 0.8; bar(o, o + 0.3, c - 0.4, c, 420);
  return rows;
}
function counterTape(){                                           /* downtrend, then an UPSIDE break on LOW volume */
  const rows = []; let t = 1700000000, c = 160;
  const bar = (o, h, l, cl, v) => rows.push({ t: (t += 3600), o, h, l, c: cl, v });
  for (let i = 0; i < 55; i++){ const d = -PAT[i % 5]; const o = c; c = c + d;
    bar(o, Math.max(o, c) + 0.25, Math.min(o, c) - 0.25, c, i % 2 ? 90 : 120); }
  const o = c; c = c + 1.1; bar(o, c + 0.4, o - 0.3, c, 85);
  return rows;
}
const mk = (lane, entry, extra) => Object.assign(
  { state: 'waiting', lane, dir: 'long', entry, stop: entry - 5,
    t1: entry + 10, risk: 5, rr: 2, atr: 2, barsLeft: 30 }, extra || {});

const W = boot(true);

/* Safe wrappers: on the PRE-FIX tree the exports do not exist, and a bare
   call would throw the suite dead instead of counting its failures. The
   wrappers return the absence answers (null / false / '') so the run stays
   readable — the typeof asserts below record the missing seams, and every
   behavior assert fails on the absence answer. */
const R = (...a) => (typeof W.__ogConfirmRead === 'function') ? W.__ogConfirmRead(...a) : null;
const B = (s) => (typeof W.__ogConfirmBlocked === 'function') ? W.__ogConfirmBlocked(s) : false;
const CH = (s) => (typeof W.__ogConfirmChipHtml === 'function') ? W.__ogConfirmChipHtml(s) : '';

console.log('== the reader exists and junk can never fabricate a confirmation ==');
{
  ok(typeof W.__ogConfirmRead === 'function', '__ogConfirmRead exported');
  ok(typeof W.__ogConfirmBlocked === 'function', '__ogConfirmBlocked exported');
  ok(typeof W.__ogConfirmChipHtml === 'function', '__ogConfirmChipHtml exported');
  for (const bad of [null, undefined, 0, 'x', NaN, {}]){
    ok(R(bad, { dir: 'long', i: 5 }) === null, 'rows ' + JSON.stringify(bad) + ' -> null');
  }
  ok(R(upTape(), null) === null && R(upTape(), {}) === null, 'no setup / empty setup -> null');
  ok(R(upTape(), { dir: 'sideways', i: 55 }) === null, 'an unknown direction -> null, never a verdict');
  ok(R(upTape(), { dir: 'long' }) === null, 'no break-bar index -> null (+null is 0; a fabricated bar 0 read is still a fabrication)');
  ok(R(upTape(), { dir: 'long', i: '' }) === null, 'an empty-string index -> null for the same reason');
  ok(R(upTape(), { dir: 'long', i: -1 }) === null && R(upTape(), { dir: 'long', i: 9999 }) === null,
     'an out-of-tape index -> null');
  ok(B(null) === false && B({}) === false
      && B({ confirm: { verdict: 'confirmed' } }) === false
      && B({ confirm: { verdict: 'unverified' } }) === false,
     'the pick-loop predicate blocks nothing but a CHECKED failure');
  ok(B({ confirm: { verdict: 'unconfirmed' } }) === true,
     'and it always blocks that one');
  ok(CH({}) === '' && CH(null) === '',
     'an unstamped setup wears no chip');
}

console.log('== a backed break is CONFIRMED — all three families, with their numbers ==');
{
  const r = R(upTape(), { dir: 'long', i: 55 });
  ok(r && r.verdict === 'confirmed', 'the constructed break is CONFIRMED');
  ok(!!r && r.checked === 3 && r.agree === 3, 'all three families readable and with it (3/3)');
  ok(!!r && r.vol && r.vol.ok === true && r.vol.val > 0.5, 'volume: expanding participation at the house\'s 0.5 z-floor');
  ok(!!r && r.mom && r.mom.ok === true && r.mom.val > 50 && r.mom.val <= 70, 'momentum: RSI past the midline, rising, not exhausted');
  ok(!!r && r.trend && r.trend.ok === true, 'trend: above a rising EMA-50');
  ok(!!r && typeof r.line === 'string' && r.line.indexOf('CONFIRMED 3/3') === 0, 'the evidence line opens with the verdict and the count');
  ok(!!r && r.line.indexOf('volume') >= 0 && r.line.indexOf('RSI') >= 0 && r.line.indexOf('EMA-50') >= 0,
     'and names every family — evidence, not just a badge');
}

console.log('== the read never looks past the break bar ==');
{
  const s = { dir: 'long', i: 55 };
  const r1 = R(upTape(), s);
  /* append bars violent enough to flip every family, then re-read the SAME
     setup: the answer must be byte-identical, or the floor reads the future */
  const future = upTape();
  let lc = future[future.length - 1].c;
  for (let k = 0; k < 10; k++){ const o = lc; lc = lc * 0.94;
    future.push({ t: future[future.length - 1].t + 3600, o, h: o * 1.001, l: lc * 0.999, c: lc, v: 5000 }); }
  const r2 = R(future, s);
  ok(JSON.stringify(r1) === JSON.stringify(r2),
     'ten crash bars appended after the break change nothing — the read is causal');
}

console.log('== a break the checked evidence opposes is UNCONFIRMED — and only that blocks ==');
{
  const r = R(counterTape(), { dir: 'long', i: 55 });
  ok(r && r.verdict === 'unconfirmed', 'a countertrend break on no volume is UNCONFIRMED');
  ok(!!r && r.checked === 3 && r.agree === 0, 'all three families read, none back it (0/3)');
  ok(!!r && r.vol && r.vol.ok === false, 'volume: below the tape\'s norm');
  ok(!!r && r.mom && r.mom.ok === false, 'momentum: below the midline');
  ok(!!r && r.trend && r.trend.ok === false, 'trend: against the prevailing EMA-50 direction');
  ok(B({ confirm: r }) === true, 'the predicate blocks it');
  ok(!!r && r.line.indexOf('never takes a TOP PICK slot') >= 0, 'the consequence is named on the card, not just enacted');
}

console.log('== direction symmetry: the mirror tape CONFIRMS a short ==');
{
  const r = R(dnTape(), { dir: 'short', i: 55 });
  ok(r && r.verdict === 'confirmed' && r.checked === 3 && r.agree === 3,
     'the downtrend break is CONFIRMED 3/3 for a short');
  ok(!!r && r.mom && r.mom.ok && r.mom.val < 50 && r.mom.val >= 30, 'momentum: RSI under the midline, falling, not exhausted');
  ok(!!r && r.trend && r.trend.ok, 'trend: below a falling EMA-50');
}

console.log('== exhaustion is not confirmation ==');
{
  /* a one-sided ramp drives RSI past 70 before the break: momentum must
     refuse to confirm even though it runs with the break */
  const rows = []; let t = 1700000000, c = 100;
  for (let i = 0; i < 55; i++){ const o = c; c = c + (i % 5 === 2 ? -0.15 : 0.55);
    rows.push({ t: (t += 3600), o, h: Math.max(o, c) + 0.25, l: Math.min(o, c) - 0.25, c, v: i % 2 ? 95 : 105 }); }
  const o = c; c = c + 1.2; rows.push({ t: (t += 3600), o, h: c + 0.4, l: o - 0.3, c, v: 420 });
  const r = R(rows, { dir: 'long', i: 55 });
  ok(r && r.mom && r.mom.ok === false && r.mom.val > 70,
     'RSI ' + (r && r.mom ? r.mom.val.toFixed(0) : '?') + ' — the chase is named, not counted');
  ok(r && r.verdict === 'confirmed' && r.agree === 2,
     'volume and trend still carry it to 2/3 — one refusing family never vetoes alone');
}

console.log('== honest degradation: unreadable evidence neither confirms nor vetoes ==');
{
  const noVol = R(upTape().map(r => Object.assign({}, r, { v: 0 })), { dir: 'long', i: 55 });
  ok(noVol && noVol.vol === null && noVol.checked === 2, 'a tape with no volume leg leaves the family UNCHECKED, not failed');
  ok(!!noVol && noVol.verdict === 'confirmed' && noVol.agree === 2, 'and the two readable families can still answer the floor (2/2)');
  ok(!!noVol && noVol.line.indexOf('volume unreadable') >= 0, 'the absence is named, not hidden');

  const constVol = R(upTape().map(r => Object.assign({}, r, { v: 100 })), { dir: 'long', i: 55 });
  ok(constVol && constVol.vol === null && constVol.checked === 2,
     'a feed printing one repeated volume figure carries no information — UNCHECKED, not a z of 0 read as failure');

  const early = R(upTape(), { dir: 'long', i: 30 });
  ok(early && early.trend === null, 'an EMA-50 not yet warmed up is UNCHECKED, never fabricated');
  ok(!!early && early.checked === 2 && early.verdict === 'confirmed', 'volume and momentum still answer it (2/2)');

  const W2 = boot(false);
  const R2 = (...a) => (typeof W2.__ogConfirmRead === 'function') ? W2.__ogConfirmRead(...a) : null;
  const bare = R2(upTape(), { dir: 'long', i: 55 });
  ok(bare && bare.verdict === 'unverified' && bare.checked === 0,
     'with no indicator library at all the setup is UNVERIFIED');
  ok((typeof W2.__ogConfirmBlocked === 'function' ? W2.__ogConfirmBlocked({ confirm: bare }) : false) === false,
     'and UNVERIFIED never blocks — the floor bites only where evidence exists to judge');
}

console.log('== the picks: UNCONFIRMED never leads, whatever it scores ==');
{
  const T = W.__ogTopPicks;
  const unc = mk('scalp', 99, { confirm: { verdict: 'unconfirmed', agree: 1, checked: 3 } });
  const clean = mk('scalp', 99.5, {});
  const picks = T([unc, clean], 100);
  ok(picks.scalp && picks.scalp.setup === clean,
     'a cleaner-scoring UNCONFIRMED break loses the slot to the unstamped one behind it');
  ok(T([unc], 100).scalp === null,
     'a lane whose only setup is UNCONFIRMED has NO pick — the slot stays empty rather than leading with it');
  const unv = mk('scalp', 99, { confirm: { verdict: 'unverified', agree: 0, checked: 1 } });
  const pv = T([unv], 100);
  ok(pv.scalp && pv.scalp.setup === unv, 'UNVERIFIED stays eligible — absent evidence is not evidence against');
  const conf = mk('scalp', 99.8, { confirm: { verdict: 'confirmed', agree: 3, checked: 3 } });
  ok(T([unc, conf], 100).scalp.setup === conf, 'CONFIRMED beats UNCONFIRMED for the same lane');
  const uncSwing = mk('swing', 97, { confirm: { verdict: 'unconfirmed', agree: 0, checked: 2 } });
  const both = T([unc, uncSwing], 100);
  ok(both.scalp === null && both.swing === null, 'the floor bites both headline lanes alike');
}

console.log('== the chip and the card ==');
{
  const cOk = CH({ confirm: { verdict: 'confirmed', agree: 3, checked: 3 } });
  ok(cOk.indexOf('CONFIRMED 3/3') >= 0 && cOk.indexOf('stamp ok') >= 0, 'CONFIRMED wears the count');
  const cBad = CH({ confirm: { verdict: 'unconfirmed', agree: 1, checked: 3 } });
  ok(cBad.indexOf('UNCONFIRMED 1/3') >= 0 && cBad.indexOf('never a TOP PICK') >= 0,
     'UNCONFIRMED says what it costs, on the chip');
  const cUnv = CH({ confirm: { verdict: 'unverified', agree: 0, checked: 1 } });
  ok(cUnv.indexOf('CONF UNCHECKED') >= 0, 'UNVERIFIED wears the hg-v700 honest words');

  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/smcChip \+ fundChip \+ confChip/.test(src), 'the chip is actually on the card\'s chip row');
  ok(/s\.confirm && s\.confirm\.line/.test(src), 'and the evidence line renders under the stats');
}

console.log('== wiring: the floor is on the real path, not a parallel copy ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8');
  ok(/s\.confirm = ogConfirmRead\(rows, s\)/.test(src),
     'the scan stamps every setup from its own lane\'s rows');
  ok(/if \(ogConfirmBlocked\(s\)\) return;/.test(src),
     'ogTopPicks reads the predicate — the exclusion is the tested one');
  ok(/row\.conf = s\.confirm\.verdict/.test(src),
     'the verdict rides the forward ledger, so the floor can be judged on outcomes later');
  ok(/confirmation floor<\/b> \(hg-v1006\)/.test(src),
     'the TOP PICKS note states the floor to the reader');
  ok(/hg-v1006: the break itself now answers to a CONFIRMATION FLOOR/.test(src),
     'the file header documents the pack');
  const reg = (W.HG_tabs || []).find(t => t && t.id === 'optigold');
  ok(reg && reg.confirmRead === W.__ogConfirmRead && reg.confirmBlocked === W.__ogConfirmBlocked,
     'the registration carries the seams, like the v1005 stack seams beside them');
}

console.log('== the forward ledger carries the verdict ==');
{
  const s = mk('scalp', 100, { i: 55, confirm: { verdict: 'confirmed', agree: 3, checked: 3 } });
  const rows = W.__ogFwdRows([s], 'scalp', upTape(), 'test');
  ok(rows.length === 1 && rows[0].conf === 'confirmed', 'a stamped live setup logs its verdict');
  const bare = W.__ogFwdRows([mk('scalp', 100, { i: 55 })], 'scalp', upTape(), 'test');
  ok(bare.length === 1 && !('conf' in bare[0]), 'an unstamped setup invents none');
  ok(rows[0].mechanic === 'BOS-RETRACE-SCALP-LONG',
     'and the mechanic string is untouched — grouping stays continuous with every row already logged');
}

console.log('\ntest-optigold-confirmation-v1006: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
