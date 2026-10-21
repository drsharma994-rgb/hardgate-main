/* HARDGATE — hg-v1023: THE PERFECT SETUP FORMATION tier (shared predicate).

   hg-perfect-setup.js is the single source of truth every setup-forming desk
   draws "perfect" from. It is a FILTER, never a gate: it cannot demote, move,
   drop or mint a candidate — it only marks a row PERFECT when every
   ALWAYS-COMPUTABLE leg passes and no READABLE evidence leg runs against it.
   The forward ledger's `perfect` read-mark is how that cohort is measured.

   Covers:
     1) the always-computable legs: top grade, not demoted/vetoed, oppose 0,
        strictly-positive tally, R:R floor
     2) the evidence legs: only an explicit AGAINST disqualifies (flow/funding/
        blowoff/structure); an unreadable leg never confirms nor disqualifies
     3) the star-stamp + ledger mark: empty/undefined when not perfect
   Run: node tests/test-hg-perfect-setup-v1023.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, TypeError, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-perfect-setup.js'), 'utf8'), ctx, { filename: 'hg-perfect-setup.js' });
  return ctx;
}
const W = boot();
const PF = W.hgPerfectFormation;

/* a perfect long: every always-computable leg green, evidence silent (unread) */
function perfect(d, over){
  over = over || {};
  const long = d === 'long';
  return Object.assign({
    dir: long ? 'long' : 'short', grade: 'A', demoted: false, vetoed: false,
    oppose: 0, tally: 6,
    entry: long ? 2300 : 2300, stop: long ? 2290 : 2310, t1: long ? 2313 : 2287, dir2: null
  }, over);
}

console.log('== the always-computable legs ==');
assert(typeof PF === 'function', 'hgPerfectFormation exported');
assert(PF(perfect('long')).perfect === true, 'max-confluence long is PERFECT');
assert(PF(perfect('short')).perfect === true, 'max-confluence short is PERFECT (direction parity)');
assert(PF(perfect('long', { demoted: true })).perfect === false, 'demoted → not perfect');
assert(PF(perfect('long', { vetoed: true })).perfect === false, 'vetoed → not perfect');
assert(PF(perfect('long', { grade: 'B' })).perfect === false, 'grade B → not perfect (needs top)');
assert(PF(perfect('long', { grade: null })).perfect === false, 'grade unread → not perfect');
assert(PF(perfect('long', { oppose: 1 })).perfect === false, 'one opposing read → not perfect');
assert(PF(perfect('long', { tally: 0 })).perfect === false, 'tally 0 → not perfect');
assert(PF(perfect('long', { tally: -3 })).perfect === false, 'negative tally → not perfect');
assert(PF(perfect('long', { tally: null })).perfect === false, 'tally unread → not perfect');
/* R:R floor: long 2300→2313 (entry t1) over 10 (stop) = 1.3R — clears 0.25 */
assert(PF(perfect('short')).perfect === true, 'short 1.3R still clears the floor');
assert(PF(perfect('long', { stop: 2290, t1: 2302 })).perfect === false, 'sub-floor R:R (0.2R) → not perfect');
assert(PF(null).perfect === false, 'null → not perfect');
assert(PF({}).perfect === false, 'empty → not perfect');

console.log('== the evidence legs (only an explicit AGAINST disqualifies) ==');
assert(PF(perfect('long'), { takerFlowVerdict: 'with' }).perfect === true, 'taker flow WITH → still perfect');
assert(PF(perfect('long'), { takerFlowVerdict: 'against' }).perfect === false, 'taker flow AGAINST → not perfect');
assert(PF(perfect('long'), { takerFlowVerdict: null }).perfect === true, 'taker flow unread → NOT a disqualifier (honest third state)');
assert(PF(perfect('long'), { fundingAgainst: false }).perfect === true, 'funding not crowded → still perfect');
assert(PF(perfect('long'), { fundingAgainst: true }).perfect === false, 'funding against → not perfect');
assert(PF(perfect('long'), { atrRegime: 'HEALTHY' }).perfect === true, 'ATR healthy → still perfect');
assert(PF(perfect('long'), { atrRegime: 'DEAD' }).perfect === true, 'ATR DEAD is evidence, not a perfect-denier (chop still trades)');
assert(PF(perfect('long'), { atrRegime: 'BLOWOFF' }).perfect === false, 'ATR BLOWOFF → not perfect');
assert(PF(perfect('long'), { structureTrend: 'up' }).perfect === true, 'structure aligned → still perfect');
assert(PF(perfect('long'), { structureTrend: 'down' }).perfect === false, 'structure against → not perfect');
assert(PF(perfect('long'), { structureTrend: 'range' }).perfect === true, 'structure range → not a disqualifier');

console.log('== hg-v1295: the fundamental / sentiment verdict leg ==');
assert(PF(perfect('long'), { fundamentalVerdict: 'with' }).perfect === true, 'sentiment stack WITH → still perfect');
assert(PF(perfect('long'), { fundamentalVerdict: 'against' }).perfect === false, 'sentiment stack AGAINST → not perfect (headwind clears nothing)');
assert(PF(perfect('long'), { fundamentalVerdict: null }).perfect === true, 'sentiment stack unread → NOT a disqualifier (honest third state)');
assert(PF(perfect('long'), { fundamentalVerdict: undefined }).perfect === true, 'sentiment stack absent → NOT a disqualifier (other desks unchanged)');
/* PERFECT⁺ still requires every readable leg WITH — a sentiment read must be WITH to earn plus */
var base = { takerFlowVerdict: 'with', fundingAgainst: false, atrRegime: 'HEALTHY', volumeRvol: 1.3, trendQuality: 'TREND', sess: 'participating' };
assert(PF(perfect('long'), Object.assign({}, base, { fundamentalVerdict: 'with' })).plus === true, 'all evidence WITH incl sentiment → earns ★ PERFECT⁺');
assert(PF(perfect('long'), Object.assign({}, base, { fundamentalVerdict: 'against' })).perfect === false, 'sentiment against blocks perfect before plus is even considered');

console.log('== the stamp + ledger mark ==');
assert(typeof W.hgPerfectStamp === 'function' && typeof W.hgPerfectLedgerMark === 'function',
  'hgPerfectStamp + hgPerfectLedgerMark exported');
assert(W.hgPerfectStamp(perfect('long')).indexOf('\u2605 PERFECT') >= 0, 'the stamp renders ★ PERFECT');
assert(W.hgPerfectStamp(perfect('long', { grade: 'C' })) === '', 'no stamp when not perfect');
assert(W.hgPerfectLedgerMark(perfect('long')) === true, 'ledger mark true when perfect');
assert(W.hgPerfectLedgerMark(perfect('long', { tally: 0 })) === undefined, 'ledger mark undefined when not perfect');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
