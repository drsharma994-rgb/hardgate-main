/* HARDGATE — GOLD SCALP: when the R:R on the card is arithmetic, say so.

   __gsLevels builds the scalp ladder. Its own note explains why the old 2xATR
   stop cap was a defect — "truncating the stop does not reduce risk, it
   relocates it ... the ladder is then measured against a risk that never
   reached invalidation, so the R:R on the card overstates the trade" — and
   justifies the 3.5xATR ceiling that replaced it like this:

     "MAX is a sanity ceiling for broken structure, not a risk policy —
      beyond it the geometry is not a stop but a different trade, and the
      R:R gate declines it on its own."

   THAT LAST CLAUSE IS ONLY HALF TRUE, and this is what the pack measured.

   When TP1 SNAPS to an opposing level, rr is a real ratio against a real
   level: swept across structure distances it comes out at 0.629, well under
   the 1.2R floor, so the gate does decline it — 138 of 138 in the sweep.

   When nothing snaps, t1 is entry + 1.5*risk BY CONSTRUCTION, so
   rr = |t1 - entry| / risk is 1.5 IDENTICALLY, whatever the risk. The sweep
   gives 1.500 for every single unsnapped ceiling case, and the 1.2R floor
   declines 0 of 138. On the real mint path over 800 tapes it is starker:
   all 88 ceiling cases were unsnapped, every one carried rr exactly 1.500,
   and the gate declined none of them.

   WHAT THIS PACK DOES, AND WHAT IT DELIBERATELY DOES NOT.

   The stop is already disclosed — stopNote says it sits at the ceiling and
   that structure may be broken — so the stop was never hidden. What was
   hidden is that the number beside it measures nothing. So these DEMOTE and
   carry an R:R UNMEASURED stamp: the card still paints with its levels and
   cannot lead.

   An earlier cut of this pack DROPPED them instead. That removed 14% of the
   board (640 minted -> 551) on an argument rather than on evidence, and broke
   a fixture that documents rsidiv painting. The ceiling is deliberate and
   already tested (test-gold-stop-model.mjs documents 13%; test-gold-inst-gates
   pins 3.5x), so cutting it back needed evidence this pack did not have.

   hg-v1439 — THE EVIDENCE NOW EXISTS, AND THE PACK RE-PINS TO THE DROP.
   Measured on the tab's own 15m replay, net R at the XM venue, negative in
   BOTH halves at BOTH cost models on three windows:
     fresh Aug21-Oct22 2026   n=259  -0.283R (H1 -0.349 / H2 -0.218; PAXG -0.866)
     refreshed Aug19-Oct21    n=252  -0.282R (H1 -0.331 / H2 -0.234)
     round-1 fresh Aug16-Oct18       -0.115R / -0.211R by half
   and gross is negative both halves (-0.305/-0.166) — not cost-eaten winners;
   the geometry loses. The full 6000-bar re-walk with the reject in place
   (conviction-lock cascade included): book -0.071 -> -0.035R net@XM, better in
   both halves, gross +0.002 -> +0.043. The hg-v912 lesson applies: a demote
   stops the card leading, it does not stop the trade. So hg-v1439 DROPS the
   cohort with a named reason and numeric rr/rrFloor, riding the same
   .rejected channel as the rr-shortfall drop. Mutation: reverting the
   goldind.js seam to demote reddens section 3 below.

   Run: node tests/test-goldscalp-rr-unmeasured.mjs */
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
const GI = fs.readFileSync(root + 'goldind.js', 'utf8');

/* lift __gsLevels out of its IIFE, as test-gold-stop-model.mjs does */
function extract(src, name){
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}'){ d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}
const __gsLevels = new Function(extract(GI, '__gsLevels') + 'return __gsLevels;')();

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the levels report whether the ceiling bound and whether TP1 was measured');
{
  const a = 1.0, entry = 2400;
  const tight = __gsLevels('long', entry, a, entry - 0.8 * a, null);
  ok(tight.ceilingBound === false, 'a structure inside the ceiling does not bind it');
  ok(tight.t1Snapped === false, 'and with no levels offered, nothing snapped');

  const far = __gsLevels('long', entry, a, entry - 6 * a, null);
  ok(far.ceilingBound === true, 'a structure well beyond 3.5xATR binds the ceiling');
  ok(Math.abs((entry - far.stop) / a - 3.5) < 1e-9,
     'and the stop lands exactly on it (' + ((entry - far.stop) / a).toFixed(3) + 'xATR)');

  const snapped = __gsLevels('long', entry, a, entry - 6 * a, [entry + 2.2 * a]);
  ok(snapped.t1Snapped === true, 'an opposing level in range is reported as snapped');
  ok(snapped.ceilingBound === true, 'while the ceiling still bound');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the claim the stop-model note makes, measured');
{
  const a = 1.0, entry = 2400;
  const unsnapped = [], snapped = [];
  for (let structAtr = 3.6; structAtr <= 8.0; structAtr += 0.02){
    const ss = entry - structAtr * a;
    unsnapped.push(__gsLevels('long', entry, a, ss, null));
    snapped.push(__gsLevels('long', entry, a, ss, [entry + 2.2 * a]));
  }
  ok(unsnapped.length > 200, 'swept ' + unsnapped.length + ' structures past the ceiling');
  ok(unsnapped.every(l => l.ceilingBound), 'every one binds the ceiling');

  /* THE TAUTOLOGY */
  const rrs = [...new Set(unsnapped.map(l => l.rr.toFixed(6)))];
  ok(rrs.length === 1 && rrs[0] === '1.500000',
     'unsnapped, the R:R is 1.500000 for every one of them — identical whatever the risk');
  ok(unsnapped.filter(l => l.rr < 1.2).length === 0,
     'so the 1.2R floor declines NONE of them');

  /* and the half that does work */
  ok(snapped.every(l => l.t1Snapped), 'snapped to a real level, every one reports it');
  ok(snapped.every(l => l.rr < 1.2),
     'and every one falls under the 1.2R floor, so the gate declines it — the note holds here');
  ok(Math.abs(snapped[0].rr - 0.629) < 0.01,
     'at the measured 0.63R (' + snapped[0].rr.toFixed(3) + ')');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. an unmeasured ladder is REJECTED with a named reason (hg-v1439)');
{
  ok(/if \(lv\.ceilingBound && !lv\.t1Snapped\)\{/.test(GI),
     'the mint path tests both flags together');
  const blk = GI.slice(GI.indexOf('if (lv.ceilingBound && !lv.t1Snapped){'));
  const body = blk.slice(0, blk.indexOf('\n    }') + 6);
  ok(/return \{ dropped: true,/.test(body),
     'hg-v1439: it DROPS — the three-window both-halves measurement replaced the hg-v902 demote');
  ok(!/demoted = true;/.test(body), 'and no longer demotes — a demote never stopped one trading (hg-v912 lesson)');
  ok(/R:R UNMEASURED/.test(body), 'the drop reason names what the number is');
  ok(/rr: lv\.rr,/.test(body) && /rrFloor: GS_MIN_RR,/.test(body),
     'rr and rrFloor ride the drop as NUMBERS (the hg-v929 reject-funnel contract)');
  ok(/stratKey: key/.test(body) && /id: key \+ '\|' \+ dir/.test(body),
     'and the dropped-return shape mirrors the rr-shortfall drop above it');

  /* the flags must be read together: either alone is the wrong gate */
  ok(!/if \(lv\.ceilingBound\)\{[\s\S]{0,80}dropped: true/.test(GI),
     'ceilingBound alone does not drop — a snapped ceiling case has a real R:R and still paints');
  ok(!/if \(!lv\.t1Snapped\)\{[\s\S]{0,80}dropped: true/.test(GI),
     'and t1Snapped alone does not either — an unsnapped ladder inside the ceiling still has a real stop');
  /* fail-open: the flag initialises false and only sets inside the guard where
     a finite structure stop distance ran past the ceiling — missing structure
     (structureStop == null) returns before that line, so the reject can never
     trip on absent inputs */
  ok(/var ceilingBound = false, t1Snapped = false;/.test(GI),
     'ceilingBound initialises false');
  ok(/if \(d \+ 0\.25\*a15 > GOLD_STOP_MAX_ATR\*a15\) ceilingBound = true;/.test(GI),
     'and sets only when a measured structure distance exceeds the ceiling — fail-open on missing structure');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. what this pack left alone, and why');
{
  /* the ceiling itself is deliberate and tested elsewhere — not relitigated */
  ok(/var GOLD_STOP_MAX_ATR = 3\.5;/.test(GI), 'the 3.5xATR ceiling is unchanged');
  const sm = fs.readFileSync(root + 'tests/test-gold-stop-model.mjs', 'utf8');
  ok(/sanity ceiling/.test(sm), 'test-gold-stop-model.mjs still pins the stop model');
  const ig = fs.readFileSync(root + 'tests/test-gold-inst-gates.mjs', 'utf8');
  ok(/sanity ceiling still 3\.5×ATR/.test(ig), 'and test-gold-inst-gates pins the ceiling itself');

  /* the floor is untouched: 1.5xATR is still a floor, never a cap */
  const a = 1.0, entry = 2400;
  ok(Math.abs((entry - __gsLevels('long', entry, a, entry - 0.1 * a, null).stop) / a - 1.5) < 1e-9,
     'a structure inside 1.5xATR still floors at 1.5x, not below');
  ok((entry - __gsLevels('long', entry, a, entry - 2.5 * a, null).stop) / a > 2.5,
     'and structure between the floor and the ceiling still widens the stop');

  /* the stop was never the hidden part */
  ok(/sanity ceiling, structure may be broken/.test(GI),
     'stopNote already disclosed that the stop sits at the ceiling');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
