/* HARDGATE - hg-v1291: the gold institutional gates on the PERFECT bar, and the
   free-feed witness. Ported onto hg-v1290 from the hg-v1274/v1275 work.

   FOUND 1: hgGoldInstFilter stamps its whole veto stack on every gold candidate
   (sweepConfirm, obVol, macroLock, mtf, sessionGate, spreadLock, newsGate) and
   hgPerfectFormation read NONE of them, so a candidate that reached the bar
   WITH A WITHHELD CONFIRMATION could still wear the PERFECT badge - a badge
   claiming a confirmation the desk had explicitly refused.

   MEASURED WHILE BUILDING THIS: every one of those gates either DROPS the
   candidate upstream (sweepConfirm, obVol, macroLock, spreadLock, newsGate) or
   sets `demoted` (mtf, sessionGate with hardReject:false) - and the
   always-computable bar already rejects a demoted candidate. So the gate reads
   are DEFENSE IN DEPTH, not the live defense. Section 2b pins the upstream drop
   at its source rather than assuming it.

   FOUND 2, and this is the half that moves the badge: the shared predicate READS
   five evidence legs this desk never FED. Two of them a gold tape can answer -
   `atrRegime` (house ATR percentile off the desk's own 4h bars) and
   `trendQuality` (Dreiss Choppiness + Kaufman efficiency off the same bars) - so
   they were permanently unread and could witness nothing. The third is the gold
   FREE-FEED WITNESS: the ~29 free internet series the desk already fetches and
   scores, collapsed to one leg.

   Run: node tests/test-gold-perfect-gates-v1291.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok -', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('hg-perfect-setup.js'), ctx, { filename: 'hg-perfect-setup.js' });
  return ctx;
}
const W = boot();
const F = W.hgPerfectFormation;
ok(typeof F === 'function', 'hgPerfectFormation is exported');

/* a candidate that clears every always-computable leg, carrying NO gold gates */
const base = () => ({ dir: 'long', grade: 'A', demoted: false, vetoed: false, oppose: 0,
  tally: 3, entry: 2600, stop: 2590, t1: 2630 });

console.log('== 1) a desk with NO gold gates is unchanged (crypto parity) ==');
{
  const r = F(base(), {});
  ok(r.perfect === true, 'the baseline candidate is PERFECT');
  ok(r.plus === false, 'and NOT PERFECT plus - no readable evidence leg, so the tier cannot mint');
  ok(r.why.length === 0, 'with no reason against it');
  const explicit = Object.assign(base(), {
    sweepConfirm: undefined, obVol: undefined, macroLock: undefined, mtf: undefined,
    sessionGate: undefined, spreadLock: undefined, newsGate: undefined
  });
  const r2 = F(explicit, {});
  ok(JSON.stringify(r2) === JSON.stringify(r), 'explicit undefined gates are byte-identical to absent ones');
}

console.log('== 2) a gate that RAN and REFUSED stands the candidate down, named ==');
{
  const cases = [
    ['obVol',       { trap: true, vol: 10, avg: 40, reason: 'displacement under the 5-bar average', unchecked: false }],
    ['macroLock',   { lock: true, reason: 'DXY and TNX both bullish against a gold long', unchecked: false }],
    ['mtf',         { conflict: true, reason: 'Daily and H4 disagree', unchecked: false }],
    ['sessionGate', { reject: true, demote: false, reason: 'Asia hard-reject on a standard scalp', unchecked: false }],
    ['spreadLock',  { lock: true, reason: 'spread 0.40 wider than the 0.25 cap', unchecked: false }],
    ['newsGate',    { lock: true, reason: 'CPI inside the 30m lock', unchecked: false }]
  ];
  for (const [key, gate] of cases){
    const c = base(); c[key] = gate;
    const r = F(c, {});
    ok(r.perfect === false, key + ' refusing makes the candidate not PERFECT');
    ok(r.why.length > 0, key + ' names a reason');
    ok(r.why.join(' ').indexOf(gate.reason.slice(0, 18)) >= 0, key + ' quotes the gate own reason');
  }
  /* sweepConfirm is a POSITIVE gate and a false `ok` DROPS the candidate
     upstream, so the predicate can never see it in production. The reader still
     treats it as a refusal, so it cannot become a hole if that ever changes. */
  const c = base();
  c.sweepConfirm = { ok: false, mss: false, displacement: false, ifvg: false, reason: 'no MSS on the sweep', unchecked: false };
  ok(F(c, {}).perfect === false, 'a false positive-gate ok is read as a refusal if one ever reaches here');
}

console.log('== 2b) the LIVE defense is the upstream drop, pinned at its source ==');
{
  const gi = read('goldind.js');
  ok(/if \(!sw\.ok\)\{[\s\S]{0,120}cand\.dropped = true;/.test(gi),
    'hgGoldInstFilter drops a candidate whose sweep is not confirmed');
  ok(/if \(!volSw\.ok\)\{[\s\S]{0,120}cand\.dropped = true;/.test(gi),
    'and one whose order-block volume traps on the sweep path');
  ok(/if \(!obv\.ok\)\{[\s\S]{0,120}cand\.dropped = true;/.test(gi),
    'and one whose order-block volume traps on the ob path');
  ok(/cand\.demoted = true/.test(gi),
    'the mtf/session/momentum/vwap branches demote - and the bar already rejects demoted');
}

console.log('== 3) a gate that could NOT run neither passes nor fails ==');
{
  for (const key of ['spreadLock', 'newsGate', 'sweepConfirm', 'obVol', 'macroLock', 'mtf']){
    const c = base();
    /* unchecked:true with the refusal flag ALSO set - the fail-open shape
       hgGoldInstFilter emits when the quote/calendar is missing */
    const g = { unchecked: true, reason: 'no live quote' };
    const refuseFlag = (key === 'mtf') ? 'conflict'
                     : (key === 'sweepConfirm') ? 'ok' : 'lock';
    g[refuseFlag] = (key === 'sweepConfirm') ? false : true;
    c[key] = g;
    const r = F(c, {});
    ok(r.perfect === true, key + ' unchecked does NOT deny a PERFECT (fail-open, never deny)');
  }
  const c = base();
  c.sweepConfirm = { mss: true, unchecked: false };
  ok(F(c, {}).perfect === true, 'a positive gate with no readable ok-flag is no verdict, never a refusal');
}

console.log('== 4) gates that ran and passed are a favourable witness ==');
{
  const allPass = {
    sweepConfirm: { ok: true, mss: true, displacement: true, ifvg: true, unchecked: false },
    obVol:        { trap: false, ok: true, unchecked: false },
    macroLock:    { lock: false, unchecked: false },
    mtf:          { conflict: false, unchecked: false },
    sessionGate:  { ok: true, reject: false, demote: false, unchecked: false },
    spreadLock:   { lock: false, unchecked: false },
    newsGate:     { lock: false, unchecked: false }
  };
  const c = Object.assign(base(), allPass);
  const r = F(c, {});
  ok(r.perfect === true, 'all gates passing keeps it PERFECT');
  ok(r.plus === true, 'and EARNS PERFECT plus - the institutional stack is a readable WITH witness');
  const c2 = base();
  for (const k of Object.keys(allPass)) c2[k] = { unchecked: true };
  const r2 = F(c2, {});
  ok(r2.perfect === true, 'an all-unchecked stack is still PERFECT');
  ok(r2.plus === false, 'but NOT PERFECT plus - nothing was actually read');
}

console.log('== 5) the session gate: DEMOTE is a warning, REJECT stands it down ==');
{
  const c = base();
  c.sessionGate = { ok: true, reject: false, demote: true, reason: 'Asia demote, not a rejection', unchecked: false };
  ok(F(c, {}).perfect === true, 'a demote alone does NOT disqualify (thresholds demote, they do not drop)');
  const c2 = base();
  c2.sessionGate = { ok: false, reject: true, demote: true, reason: 'Asia hard-reject', unchecked: false };
  ok(F(c2, {}).perfect === false, 'a reject DOES disqualify');
}

console.log('== 6) the volatility-regime leg ==');
{
  const c = base();
  ok(F(c, { atrRegime: 'BLOWOFF' }).perfect === false, 'BLOWOFF disqualifies (the move is already spent)');
  ok(F(c, { atrRegime: 'HEALTHY' }).plus === true, 'HEALTHY is a readable WITH leg, earning PERFECT plus');
  ok(F(c, { atrRegime: 'DEAD' }).perfect === true, 'DEAD is readable-neutral, not against');
  ok(F(c, { atrRegime: 'DEAD' }).plus === false, 'and being neutral it withholds PERFECT plus');
  ok(F(c, {}).perfect === true, 'an absent regime is no verdict');
}

console.log('== 7) the trend-quality leg ==');
{
  const c = base();
  ok(F(c, { trendQuality: 'CHOP' }).perfect === false, 'CHOP disqualifies (a trend setup on a tape with no trend)');
  ok(F(c, { trendQuality: 'TREND' }).plus === true, 'TREND is a readable WITH leg, earning PERFECT plus');
  ok(F(c, {}).perfect === true, 'an absent trend-quality read is no verdict');
}

console.log('== 8) the gate reader refuses to invent a verdict ==');
{
  const src = read('hg-perfect-setup.js');
  ok(/if \(g\.unchecked === true\) return \{ blocked: false, readable: false/.test(src),
    'hgGateReadable short-circuits on unchecked before reading any flag');
  ok(/if \(!gate \|\| typeof gate !== 'object'\) continue;/.test(src),
    'a gate that is not an object is skipped, never coerced into a refusal');
  ok(/goldReadableCount > 0/.test(src), 'the favourable witness needs at least one gate to have actually run');
  ok(/g\.ok === false\) return \{ blocked: true/.test(src),
    'a positive gate that ran and did not confirm is an explicit refusal');
  ok(/out\.plus = !!\(anyReadable/.test(src),
    'plus is coerced to a strict boolean (the three-state leak is closed)');
  const gi = read('goldind.js');
  ok(/pfReads\.atrRegime =/.test(gi), 'goldind.js feeds the volatility-regime leg');
  ok(/hgAtrPercentile\(ctx\.rows4h, 14, 100\)/.test(gi), 'using the house ATR percentile classifier');
  ok(/pfAtrPct < 20\) \? 'DEAD' : \(\(pfAtrPct > 80\) \? 'BLOWOFF' : 'HEALTHY'/.test(gi),
    'with the same <20 DEAD / >80 BLOWOFF / else HEALTHY thresholds TREND MATRIX uses');
  ok(/pfReads\.trendQuality = 'CHOP'/.test(gi) && /pfReads\.trendQuality = 'TREND'/.test(gi),
    'and feeds the trend-quality leg with both verdict states');
  ok(/hgChoppiness\(ctx\.rows4h, 14\)/.test(gi) && /calculateKaufmanER\(ctx\.rows4h, 20\)/.test(gi),
    'off the house choppiness and efficiency primitives, no new maths');
}

console.log('== 9) the gold FREE-FEED WITNESS: every free resource as one leg ==');
{
  /* the desk's own free internet resources, collapsed to one three-state read.
     Each mark is already oriented to the candidate's direction, so one
     disagreeing series is evidence enough to stand the badge down. */
  const withAll = base();
  withAll.goldFreeWitness = { readable: true, against: false, names: '', readableCount: 9, againstCount: 0 };
  const r = F(withAll, {});
  ok(r.perfect === true, 'a fully-readable, fully-favourable free set keeps it PERFECT');
  ok(r.plus === true, 'and EARNS PERFECT plus on the free evidence alone');

  const opposed = base();
  opposed.goldFreeWitness = { readable: true, against: true, names: 'uup, tlt', readableCount: 9, againstCount: 2 };
  const r2 = F(opposed, {});
  ok(r2.perfect === false, 'ONE disagreeing free resource stands the PERFECT down');
  ok(r2.why.join(' ').indexOf('uup, tlt') >= 0, 'and the reason names which resources objected');

  const cold = base();
  const r3 = F(cold, {});
  ok(r3.perfect === true, 'no free series readable at all is no verdict, not a denial');
  ok(r3.plus === false, 'and it withholds PERFECT plus rather than minting on silence');

  /* the witness must be a strict shape: readable is required, so a bare object
     cannot mint the tier by accident */
  const bogus = base();
  bogus.goldFreeWitness = { against: false, readableCount: 4 };
  ok(F(bogus, {}).plus === false, 'a witness without readable:true is not readable, so it cannot mint');
  const notObject = base();
  notObject.goldFreeWitness = 'yes';
  ok(F(notObject, {}).perfect === true, 'a non-object witness is ignored rather than trusted');

  /* plus must be a real boolean on every path - the three-state contract */
  ok(F(base(), {}).plus === false, 'plus is strictly false (not undefined) when nothing is readable');
  ok(F(withAll, {}).plus === true, 'and strictly true when the free set is fully favourable');

  const gi = read('goldind.js');
  ok(/rc\.goldFreeWitness = \{/.test(gi), 'goldind.js computes the witness');
  ok(/pfFkey\.indexOf\('free:'\) !== 0\) continue;/.test(gi), 'counting only free: marks');
  ok(/pfFval !== true && pfFval !== false\) continue;/.test(gi),
    'a mark that is neither true nor false is not readable, so it is skipped rather than coerced');
  ok(/if \(freeAgainst > 0\) rc\.oppose[\s\S]{0,3000}rc\.goldFreeWitness/.test(gi),
    'and it is computed inside the free block, before the predicate runs');
  const w = gi.indexOf('rc.goldFreeWitness = {');
  const p = gi.indexOf('var pfFn = (typeof window');
  ok(w > 0 && p > 0 && w < p, 'the witness is built BEFORE the perfect predicate reads it (ordering)');
}

console.log('\ntest-gold-perfect-gates-v1291: ' + passed + ' passed, 0 failed');
