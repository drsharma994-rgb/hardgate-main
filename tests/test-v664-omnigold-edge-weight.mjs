/* v664: OMNIGOLD balance score rebalance so measured-edge and
   measured-negative demotion have real say among ticket survivors.

   Prior weights (edgeN=8, edgeDemoteN weight=15 with a fixed -0.35
   multiplier -> effective -5.25 penalty) meant walk-forward history
   barely tipped the pick order. Tape (100), ticket (120), family (30)
   and infoRatio (30) dominated so completely that a mechanic with 100%
   measured edge outranked an unmeasured mechanic by 8 points \u2014 less
   than one gate agreeing.

   v664:
     edgeN         weight  8  -> 25
     edgeDemoteN   weight 15  -> 40

   Neither change affects what QUALIFIES as a ticket. This is
   ordering-only. The measured-edge VETO still keeps significantly-
   negative mechanics out of the pool entirely; v664 just makes the
   remaining ambiguity between measured-positive, measured-neutral,
   and unmeasured cards actually resolve toward the measured winner. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');

/* --- v664 rationale comment must be present so future edits know why --- */
assert.ok(/v664: rebalanced so measured-edge has real say among ticket survivors/.test(src),
  'v664 rationale comment must be present near hgOgBalanceParts score');

/* --- the numeric weight change: exact new coefficients + inline annotations --- */
assert.ok(/\+ 25 \* edgeN\s+\/\* v664: 8 -> 25/.test(src),
  'edgeN weight must be 25 with a v664 annotation');
/* v677: relaxed — the score expression grew a freshness term below
   edgeDemoteN, so `;` is no longer immediately after edgeDemoteN. Accept
   either the original `edgeDemoteN;` shape or `edgeDemoteN` followed by
   whitespace and the v664 annotation. */
assert.ok(/\+ 40 \* edgeDemoteN[;\s]\s*\/\* v664: 15 -> 40/.test(src),
  'edgeDemoteN weight must be 40 with a v664 annotation');

/* --- old numeric weights must be gone from the score expression --- */
/* v677: match up to the trailing semicolon of the score expression, which may
   now sit after a later term (freshN) rather than immediately after edgeDemoteN. */
const scoreBlock = src.match(/var score = 100 \* tapeScore[\s\S]{0,900}edgeDemoteN[\s\S]{0,300}?;/);
assert.ok(scoreBlock, 'balance-score expression must still be intact');
assert.ok(!/\+ 8 \* edgeN$/m.test(scoreBlock[0]),
  'stale "+ 8 * edgeN" without v664 annotation must be gone from the score');
assert.ok(!/\+ 15 \* edgeDemoteN;$/m.test(scoreBlock[0]),
  'stale "+ 15 * edgeDemoteN" must be gone from the score');

/* --- weights for all the other terms must be unchanged (nothing else touched) --- */
assert.ok(/100 \* tapeScore/.test(scoreBlock[0]), 'tapeScore weight 100 unchanged');
assert.ok(/120 \* ticketN/.test(scoreBlock[0]), 'ticketN weight 120 unchanged');
assert.ok(/30 \* family/.test(scoreBlock[0]),   'family weight 30 unchanged');
assert.ok(/30 \* infoRatio/.test(scoreBlock[0]),'infoRatio weight 30 unchanged');
assert.ok(/12 \* coverage/.test(scoreBlock[0]), 'coverage weight 12 unchanged');
assert.ok(/10 \* alsoNorm/.test(scoreBlock[0]), 'alsoNorm weight 10 unchanged');
assert.ok(/8 \* horizon/.test(scoreBlock[0]),   'horizon weight 8 unchanged');
assert.ok(/10 \* near/.test(scoreBlock[0]),     'near weight 10 unchanged');

/* --- runtime demonstration --- */
/* Simulate the score formula directly (identical shape to the source) so we
   can prove the numeric behaviour changes as claimed. This does NOT touch the
   real OMNIGOLD module (it's an IIFE), it verifies the mathematical outcome
   for the fixed constants and confirms the fix has the intended effect. */
function score(w, parts){
  const p = parts;
  return w.tape   * (p.tapeScore   || 0)
       + w.ticket * (p.ticketN     || 0)
       + w.family * (p.family      || 0)
       + w.info   * (p.infoRatio   || 0)
       + w.cov    * (p.coverage    || 0)
       + w.also   * (p.alsoNorm    || 0)
       + w.hori   * (p.horizon     || 0)
       + w.near   * (p.near        || 0)
       + w.edge   * (p.edgeN       || 0)
       + w.demote * (p.edgeDemoteN || 0);
}
const OLD = { tape:100, ticket:120, family:30, info:30, cov:12, also:10, hori:8, near:10, edge:8,  demote:15 };
const NEW = { tape:100, ticket:120, family:30, info:30, cov:12, also:10, hori:8, near:10, edge:25, demote:40 };

/* Base card: passes ticket, tape-aligned, mid family + info, mid coverage, near. */
const base = { tapeScore:1, ticketN:1, family:0.5, infoRatio:0.5, coverage:0.6, alsoNorm:0.5, horizon:1, near:1 };

/* Case A: two survivors identical EXCEPT one has measured 100% edge, other unmeasured. */
const measured   = { ...base, edgeN:1, edgeDemoteN:0 };
const unmeasured = { ...base, edgeN:0, edgeDemoteN:0 };

const oldGap = score(OLD, measured) - score(OLD, unmeasured);
const newGap = score(NEW, measured) - score(NEW, unmeasured);
assert.equal(oldGap, 8,  'pre-v664 measured/unmeasured gap was 8 points');
assert.equal(newGap, 25, 'post-v664 measured/unmeasured gap is 25 points');

/* Case B: measured-positive card vs measured-negative-but-not-vetoed card.
   Pre-v664: gap = 8*1 - 15*(-0.35) = 8 + 5.25 = 13.25
   Post-v664: gap = 25*1 - 40*(-0.35) = 25 + 14 = 39 */
const measuredPos = { ...base, edgeN:1,   edgeDemoteN:0 };
const measuredNeg = { ...base, edgeN:0,   edgeDemoteN:-0.35 };
const oldGap2 = score(OLD, measuredPos) - score(OLD, measuredNeg);
const newGap2 = score(NEW, measuredPos) - score(NEW, measuredNeg);
assert.ok(Math.abs(oldGap2 - 13.25) < 1e-9, 'pre-v664 pos/demoted gap was 13.25 points');
assert.equal(newGap2, 39,                    'post-v664 pos/demoted gap is 39 points');

/* Case C: the measured-edge signal must still lose to tape agreement.
   A measured card AGAINST tape must still sink below an unmeasured card WITH tape,
   because tape is 100 and edge caps at 25 \u2014 the discipline "against-tape sinks" survives. */
const measuredWithoutTape   = { ...base, tapeScore: 0, edgeN: 1 };
const unmeasuredAgainstTape = { ...base, tapeScore:-1, edgeN: 0 };
assert.ok(score(NEW, measuredWithoutTape) > score(NEW, unmeasuredAgainstTape),
  'a measured card with neutral tape must still outrank an unmeasured card AGAINST tape');
const unmeasuredWithTape    = { ...base, tapeScore: 1, edgeN: 0 };
const measuredAgainstTape   = { ...base, tapeScore:-1, edgeN: 1 };
assert.ok(score(NEW, unmeasuredWithTape) > score(NEW, measuredAgainstTape),
  'against-tape stays punished (tape weight 100 > edge weight 25)');

/* Case D: ticketN dominance must survive.
   A non-ticket card with 100% edge must NOT outrank a ticket card without measured edge:
     new: no-ticket + measured   = 100*1 + 0     + ... + 25    (no 120 for ticket)
          ticket + no-measure    = 100*1 + 120*1 + ...          (no 25 edge)
   The 120-point ticket bonus dwarfs the 25-point edge bonus, so ticket cards still lead. */
const ticketNoEdge     = { ...base, ticketN:1, edgeN:0 };
const noTicketFullEdge = { ...base, ticketN:0, edgeN:1 };
assert.ok(score(NEW, ticketNoEdge) > score(NEW, noTicketFullEdge),
  'ticket cards must still outrank non-ticket cards regardless of measured edge');

/* --- version --- */
assert.ok(/^hg-v(?:664|66[5-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v664',
  'HG_VER must be >= hg-v664 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v664: OMNIGOLD balance-score rebalance');
console.log('  * edgeN weight 8 -> 25 (measured-positive walk-forward)');
console.log('  * edgeDemoteN weight 15 -> 40 (measured-negative demotion)');
console.log('  * measured/unmeasured gap grows from 8 to 25 points');
console.log('  * measured-pos/measured-neg gap grows from 13.25 to 39 points');
console.log('  * against-tape sinks still (100 > 25)');
console.log('  * ticket cards still dominate non-ticket (120 > 25)');
console.log('  * version bumped to ' + HG_VER);
