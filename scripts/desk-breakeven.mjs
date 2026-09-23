#!/usr/bin/env node
/**
 * hg-v931 — each gold desk against ITS OWN breakeven, at both fill bounds.
 *
 * A win rate means nothing on its own: it is a number you can raise for free
 * by shrinking the target. The quantity that matters is the win rate MINUS the
 * breakeven its own planned R:R demands, and the two gold desks do not plan at
 * the same R:R — GOLD SCALP's median is 1.50 (breakeven 40.0%), OMNIGOLD's is
 * 2.00 (breakeven 33.3%). Neither tab has ever shown that comparison.
 *
 * MEASURED, and the two desks are NOT in the same state:
 *
 *   GOLD SCALP  43.4% vs 40.0% needed  = +3.4 pts, and +4.4 at the other bound
 *   OMNIGOLD    30.4% vs 33.3% needed  = -3.0 pts, but +5.3 at the other bound
 *
 * GOLD SCALP clears its own bar at BOTH fill bounds. OMNIGOLD's SIGN FLIPS
 * between them, which is a different statement from "slightly worse" — it
 * means the desk's edge is unproven in a specific, nameable way rather than
 * measured and small.
 *
 * WHY THE BOUNDS DISAGREE ON ONE DESK AND NOT THE OTHER. A `both-touch` row is
 * a bar containing the stop AND the target, resolved stop-first because which
 * came first is unknowable at bar resolution. OMNIGOLD has 672 of them, 8.3%
 * of its filled book; GOLD SCALP has 23, 0.9%. Nine times the ambiguity.
 *
 * And the mechanism is mundane rather than strategic: OMNIGOLD's scalp lane
 * runs on 1h bars, GOLD SCALP's on 15m. A longer bar is likelier to contain
 * both levels. This is a RESOLUTION artifact, not a difference in edge, and it
 * is what has forced every OMNIGOLD verdict since hg-v918 to be stated twice.
 *
 * NOTHING IS GATED ON ANY OF THIS. It is published because a reader of
 * OMNIGOLD today has no way to know its edge is unproven in this way, and a
 * number presented without its breakeven invites exactly the wrong reading.
 *
 * Re-derive: node scripts/desk-breakeven.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCALP_REPLAY = 'backtest-goldscalp-results-floor.json';
export const OG_REPLAY = 'backtest-omnigold-results.json';

const load = n => JSON.parse(readFileSync(join(HERE, n), 'utf8'));
const med = a => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : NaN; };

export function plannedRr(t){
  const r = Math.abs(+t.entry - +t.stop), w = Math.abs(+t.t1 - +t.entry);
  return (r > 0 && isFinite(w)) ? w / r : NaN;
}

/**
 * The whole readout for one desk. Every field is derived here; nothing is
 * carried forward from a previous run, so a re-bake cannot leave a stale
 * number behind a fresh one.
 */
export function deskBreakeven(trades){
  const published = trades.length;
  const filled = trades.filter(t => t && !/unfilled/i.test(String(t.outcome)));
  const wins = filled.filter(t => String(t.outcome) === 'win').length;
  const both = filled.filter(t => /both-touch/.test(String(t.outcome))).length;
  const timeout = filled.filter(t => String(t.outcome) === 'timeout').length;
  const rr = med(filled.map(plannedRr).filter(isFinite));
  const be = 1 / (1 + rr);
  const lower = wins / filled.length;            /* both-touch counted as losses */
  const upper = (wins + both) / filled.length;   /* both-touch counted as wins  */
  return {
    published, filled: filled.length,
    unfilled: published - filled.length,
    unfilledPct: 100 * (published - filled.length) / published,
    plannedRr: rr,
    breakevenPct: 100 * be,
    winLowerPct: 100 * lower,
    winUpperPct: 100 * upper,
    edgeLowerPts: 100 * (lower - be),
    edgeUpperPts: 100 * (upper - be),
    bothTouch: both,
    bothTouchPct: 100 * both / filled.length,
    timeout, timeoutPct: 100 * timeout / filled.length,
    /* the claim in one word, and it must be derived not asserted */
    verdict: (lower > be && upper > be) ? 'clears'
           : ((lower <= be && upper <= be) ? 'below' : 'flips')
  };
}

export function run(){
  return {
    scalp: Object.assign({ tf: '15m', src: SCALP_REPLAY }, deskBreakeven(load(SCALP_REPLAY).trades)),
    omnigold: Object.assign({ tf: '1h', src: OG_REPLAY }, deskBreakeven(load(OG_REPLAY).trades))
  };
}

if (process.argv[1] && process.argv[1].endsWith('desk-breakeven.mjs')){
  const r = run();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else for (const k of Object.keys(r)){
    const d = r[k];
    console.log('\n=== ' + k.toUpperCase() + '  (' + d.tf + ' bars) ===');
    console.log('  published ' + d.published + '  unfilled ' + d.unfilled + ' (' + d.unfilledPct.toFixed(1) + '%)  filled ' + d.filled);
    console.log('  planned R:R ' + d.plannedRr.toFixed(2) + '  -> needs ' + d.breakevenPct.toFixed(1) + '% to break even');
    console.log('  win ' + d.winLowerPct.toFixed(1) + '% (lower bound) .. ' + d.winUpperPct.toFixed(1) + '% (upper)');
    console.log('  EDGE ' + (d.edgeLowerPts >= 0 ? '+' : '') + d.edgeLowerPts.toFixed(1) + ' pts .. '
              + (d.edgeUpperPts >= 0 ? '+' : '') + d.edgeUpperPts.toFixed(1) + ' pts   VERDICT: ' + d.verdict.toUpperCase());
    console.log('  both-touch ' + d.bothTouch + ' (' + d.bothTouchPct.toFixed(1) + '% of filled) — the rows the bounds disagree about');
    console.log('  timeout    ' + d.timeout + ' (' + d.timeoutPct.toFixed(1) + '%)');
  }
}
