/* HARDGATE — Increment 3 & 4 pure core tests */
import assert from 'node:assert';
import {
  pdRecalibrate, PD_BASELINES, stAssignTier, stBuildTiers, stGateForTier,
  cmPairCorr, cmDedupeCandidates, rfRealisticPnl, rfExecutionDragProfile,
  apRouteDecision, apRecordOutcome, rtDetectTransition, rtPushScore, rtModifiers
} from '../lib/inc34-core.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok —', m); };

console.log('== param drift recalibration ==');
const trades = [{ r: 1.2 }, { r: -0.8 }, { r: 0.5 }, { r: 1.0 }];
const drift = pdRecalibrate(trades, { baselines: PD_BASELINES, params: {}, adoptionHistory: [], weekKey: '2026-09-07' });
ok(drift.params && drift.params.rrMin != null, 'pdRecalibrate returns params');
ok(drift.provenance && drift.provenance.rrMin, 'provenance trail per parameter');

console.log('== symbol tiers ==');
ok(stAssignTier({ n: 20, wr: 0.6, expectancy: 0.3, structureRespect: 0.55 }).tier === 'A', 'Tier A on strong stats');
ok(stAssignTier({ n: 20, wr: 0.4, expectancy: -0.1 }).tier === 'C', 'Tier C on weak stats');
ok(stGateForTier('C', 7, 7).veto === true, 'Tier C veto');
ok(stGateForTier('B', 6, 7).veto === true, 'Tier B needs full confluence');
const tiers = stBuildTiers([{ sym: 'BTCUSD', r: 1, outcome: 'tp' }, { sym: 'BTCUSD', r: -1, outcome: 'sl' }]);
ok(tiers.symbols && tiers.symbols.BTCUSD, 'stBuildTiers maps symbol');

console.log('== correlation dedupe ==');
const a = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120];
const b = a.map((x, i) => x * 1.001 + i * 0.01);
ok(cmPairCorr(a, b) > 0.9, 'highly correlated pair');
const deduped = cmDedupeCandidates([
  { sym: 'ETHUSD', dir: 'long', score: 5, turnoverUsd: 1e6 },
  { sym: 'SOLUSD', dir: 'long', score: 7, turnoverUsd: 2e6 },
], { ETHUSD: a, SOLUSD: b }, { corrThr: 0.7 });
ok(deduped.length === 1 && deduped[0].sym === 'SOLUSD', 'keeps highest-score representative');

console.log('== realistic fill P&L ==');
const rf = rfRealisticPnl({ dir: 'long', entry: 100, mark: 102, stop: 98, notionalUsd: 1000, r: 2 }, { atr: 2, feeBps: 4 });
ok(rf.realisticUsd < rf.idealUsd, 'realistic drag below ideal on long win');
const dragProf = rfExecutionDragProfile([
  { setupKind: 'swing', idealR: 1, realisticR: -0.2 },
  { setupKind: 'swing', idealR: 0.8, realisticR: -0.1 },
]);
ok(dragProf.swing && dragProf.swing.suspend === true, 'auto-suspend when realistic EV < 0');

console.log('== alert precision routing ==');
let store = {};
apRecordOutcome(store, 'swing|risk-on|clean', 1);
apRecordOutcome(store, 'swing|risk-on|clean', -1);
ok(apRouteDecision(0.5).route === 'neutral', 'neutral precision band');
ok(apRouteDecision(0.35).route === 'block', 'block below 40%');
ok(apRouteDecision(0.65).route === 'promote', 'promote above 60%');

console.log('== regime transition ==');
/* THE WINDOW EDGE IS NOT A TEST FIXTURE.

   This read `Date.now() - 5 * 86400000` for the old point and let
   rtScoreSlope recompute its own `Date.now() - 5 * 86400000` cutoff a
   moment later. The cutoff is therefore always >= the point, and the
   filter is `h.at >= cutoff` — so the instant ONE MILLISECOND elapsed
   between the two calls the old point dropped out of the window, pts fell
   to 1, slope came back null and this assertion failed.

   It passed standalone because both calls landed in the same tick and
   failed under the full suite on a loaded machine, which reads like
   ordering and is not: it is a race against the clock, and the only flake
   in a 473-file suite. Fixed by pinning one `now` for the whole fixture
   and sitting the old point just INSIDE the window rather than exactly on
   its edge, so elapsed time cannot move it out. */
const NOW = Date.now();
const DAY = 86400000;
let hist = rtPushScore([], 2, NOW - 4.9 * DAY);
hist = rtPushScore(hist, -1, NOW);
const tr = rtDetectTransition(hist, 0.5);
ok(tr.tag === 'REGIME TRANSITION' || tr.active, 'transition detectable on slope');
/* and the reason it is detectable is the sign flip, not the magnitude —
   pinned so a future change to the 0.5 threshold cannot pass this by
   accident */
ok(tr.crossed === true, 'because the slope crossed zero against prevSlope 0.5');
ok(tr.slope !== null, 'and the slope is a number, not the null a dropped point produces');
ok(rtModifiers(true).minRr === 2.5, 'transition tightens min R:R');

/* THE MECHANISM ITSELF, PINNED DETERMINISTICALLY. A point OUTSIDE the
   window is dropped, one point is not a slope, and the result is null —
   which is what the old fixture hit whenever the clock ticked. Stamped a
   full second past the edge so no amount of elapsed time makes this
   ambiguous in either direction. */
const stale = rtPushScore(rtPushScore([], 2, NOW - 5 * DAY - 1000), -1, NOW);
ok(stale.length === 2, 'both points are in the history');
const staleTr = rtDetectTransition(stale, 0.5);
ok(staleTr.slope === null, 'but a point past the 5-day cutoff is dropped, leaving no slope');
ok(staleTr.active === false, 'and no transition is claimed from one point');

console.log('\ntest-inc34-core: ' + n + ' passed');
