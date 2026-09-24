/* HARDGATE — hg-v956: what the gold weekend actually costs the edge table,
   and the gate that was already paying for it.

   hg-v953 said 679 of GOLD SCALP's 2,575 committed trades formed inside the
   gold weekend and that "that walk is what HG_GOLD_SETUP_EDGE is measured
   on". TWO THINGS IN MY OWN PACK WERE WRONG.

   (a) THE WRONG FILE. scripts/ holds three goldscalp artifacts. The edge
       table's `live` column is computed by edge-live-population.mjs, which
       reads backtest-goldscalp-results-FLOOR.json (2,605 trades), and
       AGENTS.md's HG_GOLD_EDGE_WALK names that same span. v953 quoted the
       2,575-trade neighbour. On the right file the share is 27.2%, and the
       set of verdicts that would move is DIFFERENT — so the file mattered.

   (b) THE WRONG BASIS. The headline n/gross/net on each row are whole-book
       and contaminated; the `live` figures hg-v916 added and hg-v928 acted
       on are not. On the live basis it is SEVEN weekend rows in 1,205 — 0.6%.

   THE MECHANISM, measured rather than assumed: a weekend PAXG bar is a thin
   crypto proxy with almost no range, so ATR collapses, so the stop is narrow
   — and the hg-v912 cost reject removes narrow stops. Median stop 0.038%
   weekend against 0.266% open, a 0.16% bar, 98.4% of weekend rows rejected
   against 6.4% of open ones. That gate has been paying for the calendar
   since it shipped and nobody had established it either way.

   NOTHING MOVES. Every moving row is thin under the desk's own bar (four
   disjoint windows, both fill bounds), and the live basis has nothing to
   scope. This is hg-v920/v944/v945's discipline, not a new one.

   AND THE FOURTH SEAM: hg-v955 found goldShut dropped by hgFwdNormalize,
   hgFwdRecordScan and the desks' own .map(). The replay row builders dropped
   it too — the place hg-v953 actually named — so seven scripts read these
   artifacts and exactly one carried a calendar of its own.

   Run: node tests/test-gold-edge-tradeable.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, inWeekend, isTradeable, tableVerdict, WALK_PATH } from '../scripts/gold-edge-tradeable.mjs';
import { scalpBook, COST_BAR_PCT } from '../scripts/factor-separation.mjs';
import { REPLAY as EDGE_LIVE_REPLAY } from '../scripts/edge-live-population.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

const out = run();

/* ---- 1) the right artifact, asserted against the module that defines it ---- */
assert(path.resolve(WALK_PATH) === path.resolve(EDGE_LIVE_REPLAY),
  'THE TABLE\'S OWN WALK: this pack reads the same artifact edge-live-population.mjs does');
assert(/floor/.test(path.basename(WALK_PATH)),
  'and that artifact is the FLOOR file, not the neighbour hg-v953 quoted (' + path.basename(WALK_PATH) + ')');
assert(fs.existsSync(path.join(ROOT, 'scripts/backtest-goldscalp-results.json')),
  'the neighbour hg-v953 quoted does exist — the error was choosing it, not inventing it');
{
  const other = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/backtest-goldscalp-results.json'), 'utf8'));
  assert(other.trades.length !== out.meta.trades,
    'the two artifacts hold different books (' + other.trades.length + ' vs ' + out.meta.trades + '), so the choice is not cosmetic');
}

/* ---- 2) the calendar is CALLED, never re-derived here ---- */
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts/gold-edge-tradeable.mjs'), 'utf8');
  const body = src.slice(src.indexOf('export function run'));
  assert(/hgInGoldWeekend/.test(src), 'the script names the repo calendar');
  assert(!/22:00|Friday|Sunday|getUTCDay/.test(body),
    'and contains no calendar arithmetic of its own below the load');
  assert(inWeekend('2026-04-11T12:00:00.000Z') === true, 'a known Saturday reads shut');
  assert(inWeekend('2026-04-08T12:00:00.000Z') === false, 'a known Wednesday reads open');
  assert(isTradeable({ tISO: '2026-04-08T12:00:00.000Z' }) === true
      && isTradeable({ tISO: '2026-04-11T12:00:00.000Z' }) === false,
    'isTradeable is the negation, on the row\'s own signal time');
}

/* ---- 3) the mechanism, re-derived from the artifact ---- */
{
  const m = out.mechanism;
  assert(m.costBarPct === COST_BAR_PCT, 'the cost bar matches the repo constant');
  /* AND IS THE CONSTANT, not a literal that happens to equal it today. This
     one assertion is deliberately textual: whether a number was imported or
     retyped is a property of the source, and no runtime comparison can tell
     them apart while the two agree — which is exactly when the drift starts. */
  {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/gold-edge-tradeable.mjs'), 'utf8');
    assert(/costBarPct:\s*COST_BAR_PCT/.test(src),
      'the cost bar is IMPORTED at the point of use, so a change to the repo constant moves this pack with it');
    assert(/COST_BAR_PCT[\s\S]*from '\.\/factor-separation\.mjs'/.test(src),
      'and it comes from factor-separation, the module that defines it');
  }
  assert(m.weekend.n > 0 && m.open.n > 0,
    'REACHABILITY: both cohorts are non-empty (' + m.weekend.n + ' weekend / ' + m.open.n + ' open)');
  assert(m.weekend.medianStopPct < m.costBarPct,
    'MECHANISM: the median weekend stop sits UNDER the cost bar (' + m.weekend.medianStopPct.toFixed(3) + '%)');
  assert(m.open.medianStopPct > m.costBarPct,
    'MECHANISM: the median open stop sits OVER it (' + m.open.medianStopPct.toFixed(3) + '%)');
  assert(m.open.medianStopPct > 4 * m.weekend.medianStopPct,
    'the gap is a multiple, not a rounding difference (' + (m.open.medianStopPct / m.weekend.medianStopPct).toFixed(1) + 'x)');
  assert(m.weekend.underBarShare > 0.9 && m.open.underBarShare < 0.2,
    'REJECTION RATES: ' + (100 * m.weekend.underBarShare).toFixed(1) + '% of weekend rows fail the gate vs '
      + (100 * m.open.underBarShare).toFixed(1) + '% of open rows');
}

/* ---- 4) the live basis, cross-checked by an independent path ---- */
{
  assert(out.live.n > 0, 'REACHABILITY: the live book is non-empty (' + out.live.n + ')');
  assert(out.live.weekendShare < 0.02,
    'THE LIVE BASIS IS ALREADY CLEAN: ' + out.live.weekend + ' of ' + out.live.n
      + ' (' + (100 * out.live.weekendShare).toFixed(1) + '%) formed while shut');
  /* the toolkit's own default must agree, or one of the two is reading the
     wrong file — which is exactly the error this pack corrects */
  const viaToolkit = scalpBook('as-recorded');
  assert(viaToolkit.length === out.live.n,
    'CROSS-CHECK: the toolkit default and this pack agree on the live book size ('
      + viaToolkit.length + ' vs ' + out.live.n + ')');
  assert(viaToolkit.filter((t) => !isTradeable(t)).length === out.live.weekend,
    'and on its weekend count');
}

/* ---- 5) what moves is reported, and nothing ships ---- */
{
  assert(out.rows.length > 10, 'REACHABILITY: verdicts were derived for ' + out.rows.length + ' kinds');
  assert(out.movers.length > 0,
    'the whole-book basis really does move verdicts (' + out.movers.length + ') — the contamination is not nil');
  assert(out.perKind.length === out.movers.length, 'every mover was put to the separation test');
  assert(out.perKind.every((p) => p.verdict === null),
    'NO MOVER CARRIES A VERDICT under four disjoint windows at both fill bounds');
  assert(out.ships.length === 0,
    'SHIPS NOTHING: no table verdict moves on this evidence (' + out.ships.join(', ') + ')');
  assert(out.pooled.verdict === null, 'and the pooled read carries no verdict either');
  /* NOT VACUOUS: `ships` must be an expression that CAN be non-empty.
     hg-v937 shipped a verdict inline and a mutation survived because every
     trial agreed; this drives the same filter over input where one does. */
  const synthetic = [{ kind: 'x', verdict: null }, { kind: 'y', verdict: 'worse' }];
  const shipsOf = (pk) => pk.filter((p) => p.verdict !== null).map((p) => p.kind);
  assert(shipsOf(synthetic).join(',') === 'y',
    'NOT VACUOUS: the ships rule returns a row when one carries a verdict');
  assert(shipsOf([]).length === 0 && shipsOf([{ kind: 'z', verdict: null }]).length === 0,
    'and returns nothing when none does');
}

/* ---- 6) the table's own bars are applied, not redefined ---- */
{
  assert(tableVerdict({ n: 60, gross: -0.1, net: -0.30 }) === 'suppress', 'suppress bar unchanged');
  assert(tableVerdict({ n: 60, gross: 0.2, net: 0.15 }) === 'prefer', 'prefer bar unchanged');
  assert(tableVerdict({ n: 10, gross: 0.2, net: -0.01 }) === 'demote', 'demote bar has no sample floor (a known gap, hg-v928)');
  assert(tableVerdict({ n: 10, gross: 0.2, net: 0.05 }) === 'neutral', 'neutral otherwise');
  assert(tableVerdict(null) === 'none' && tableVerdict({ n: 0 }) === 'none', 'an empty cohort yields no verdict');
  /* the n>=50 floor really is a floor on BOTH the suppress and prefer bars */
  assert(tableVerdict({ n: 49, gross: -0.1, net: -0.30 }) === 'demote',
    'under the sample floor a suppress-shaped row is only a demote');
  assert(tableVerdict({ n: 49, gross: 0.2, net: 0.15 }) === 'neutral',
    'and a prefer-shaped row is only neutral');
}

/* ---- 7) the walks emit the mark — the fourth seam ---- */
/* The rule is LIFTED AND RUN rather than grepped, and its position is checked
   by bounding the slice to the row literal (not a fixed character count —
   the hg-v945 correction). What this does NOT prove is the whole settle path,
   which needs bars this environment cannot fetch; that limit is stated rather
   than papered over. */
for (const file of ['scripts/backtest-goldscalp.mjs', 'scripts/backtest-goldswing.mjs']){
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const pushAt = src.indexOf('results.push({');
  assert(pushAt > 0, file + ': the row literal is locatable');
  const endAt = src.indexOf('\n  });', pushAt);
  assert(endAt > pushAt, file + ': the row literal terminates');
  const rowBlock = src.slice(pushAt, endAt);
  assert(/goldShut:/.test(rowBlock),
    file + ': the emission sits INSIDE the row literal, not merely somewhere in the file');

  const line = rowBlock.split('\n').find((l) => /goldShut:/.test(l));
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext('this.mk = function(tr){ return { ' + line.trim().replace(/,\s*$/, '') + ' }; };',
    sandbox, { filename: file + '-lift' });
  assert(sandbox.mk({ goldShut: true }).goldShut === true, file + ': a shut trade emits true');
  assert(sandbox.mk({ goldShut: false }).goldShut === false, file + ': an open trade emits false');
  for (const v of [undefined, null, 1, 0, 'no', {}])
    assert(sandbox.mk({ goldShut: v }).goldShut === undefined,
      file + ': goldShut=' + JSON.stringify(v) + ' emits NOT RECORDED, never a guess (hg-v955)');

  /* and the trade object is given the mark off the candidate, never recomputed */
  /* BOTH books, not one. Each walk builds trades twice — the live book and
     the EDGE-suppressed shadow book — and a single-site check passes while
     the other silently loses the mark. Mutation caught exactly that. */
  const sites = (src.match(/goldShut: c\.goldShut/g) || []).length;
  const pushes = (src.match(/results\.push\(/g) || []).length;
  const builds = (src.match(/sigIdx: i/g) || []).length;
  assert(builds >= 2, file + ': the walk builds trades at ' + builds + ' sites (live book + shadow book)');
  assert(sites === builds,
    file + ': EVERY trade-building site takes the mark from the candidate (' + sites + '/' + builds + ')');
  assert(pushes >= 1, file + ': and the row literal is reached from them');
  assert(!/hgInGoldWeekend|getUTCDay/.test(src),
    file + ': and the walk holds no calendar of its own — a second copy is a second calendar');
}

/* ---- 8) the committed artifacts cannot carry it yet, and that is said ---- */
{
  const a = JSON.parse(fs.readFileSync(WALK_PATH, 'utf8'));
  const marked = a.trades.filter((t) => t.goldShut !== undefined).length;
  assert(marked === 0,
    'HONEST LIMIT: the committed artifact carries no marks (' + marked + ') because a re-bake needs bars this environment cannot fetch');
  assert(a.trades.every((t) => typeof t.tISO === 'string'),
    'so every figure in this pack is derived from tISO through the repo calendar, which the artifact does carry');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
