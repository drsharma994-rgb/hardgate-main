/* HARDGATE — hg-v959: ONE home for the gold walk artifacts.

   THE DEFECT THIS REMOVES. `npm run gold:rebake` re-walked GOLD SCALP into
   scripts/backtest-goldscalp-results.json, and then derived every gold
   literal from scripts/backtest-goldscalp-results-FLOOR.json — a different
   file, produced by a different run, that NOTHING in this repo writes. Two
   halves of one pipeline each hardcoded a filename, and the filenames
   disagreed. The re-bake reported success while refreshing nothing any desk
   reads.

   Proved both ways rather than read off the imports: deleting 80% of the
   trades from the file the walk writes left the drift check reporting
   "every baked literal already equals its artifact" — zero drift — while the
   same edit to the floor file moved 22 scalp rows and the walk span.

   WHAT IT COST, beyond staleness. The two files are not two runs of one
   pipeline; their own metadata says they are different pipelines. The file
   the literals come from records "goldRankSetups ctx carries NO candle rows",
   so its confluence scorer could not score. The file the walk writes records
   "carries candle rows since hg-v700 (tab parity)". The live desk feeds rows
   — goldscalp.js:2328. So the suppress / demote / prefer table behind GOLD
   SCALP, GOLD SWING, GOLD ULTRA, GOLD DIRECTION and MILLI GOLD was measured
   on a ranking context that is not the desk's.

   WHY A SHARED CONSTANT RATHER THAN A CHECKER. The first cut of this fix was
   a script that walked the rebake chain and reported artifacts read but never
   written. It found the defect — and then, wired into the head of the chain
   it inspects, it enumerated itself, spawned itself, and took the machine to
   a load average over 1000. A checker that validates a pipeline by RUNNING it
   also needs the live feed, so it is least usable on the machine that most
   needs it. The disease was never "nobody checked"; it was that a filename
   had two homes. It has one now, and the class of defect is structural rather
   than detectable — the same reason hg-v949 keeps the gold calendar in one
   place and calls a second copy a second calendar.

   THE NAME IS HISTORICAL. "-floor" does not denote a config: meta.rules is
   byte-identical between the two artifacts, so nothing about a stop floor
   distinguishes them. It is kept because ~20 readers name it and renaming
   them is churn with no gain; it is pinned here so it is named ONCE. */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

/* The GOLD SCALP walk. Written by scripts/backtest-goldscalp.mjs, read by
   rebake-gold-literals.mjs and edge-live-population.mjs — which is the whole
   point: one constant, three files, no chance of disagreement. */
export const GOLD_SCALP_WALK = join(SCRIPTS, 'backtest-goldscalp-results-floor.json');

/* The OMNIGOLD walk and the evidence baked from it. These two were already
   consistent across writer and readers; they are named here so the next
   artifact added to the chain has an obvious home rather than a new literal. */
export const OMNIGOLD_WALK = join(SCRIPTS, 'backtest-omnigold-results.json');
export const OMNIGOLD_REPLAY_EVIDENCE = join(SCRIPTS, 'omnigold-replay-evidence.json');

export const GOLD_ARTIFACTS = {
  goldScalpWalk: GOLD_SCALP_WALK,
  omnigoldWalk: OMNIGOLD_WALK,
  omnigoldReplayEvidence: OMNIGOLD_REPLAY_EVIDENCE
};
