/* HARDGATE — the target sweep must not be able to invent a better target.

   Every OMNIGOLD plan is designed at exactly 2.0R and nothing had ever
   compared that against what price offered. scripts/target-sweep.mjs does,
   once a walk carries excursion. A sweep is the easiest place in this repo
   to manufacture a result — pick the target that fits the noise, credit
   wins on the bar that stopped you out, ignore cost so the smallest target
   always wins — so these tests are mostly about the ways it must NOT.

   Run: node tests/test-target-sweep.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const SWEEP = path.join(ROOT, 'scripts', 'target-sweep.mjs');
const run = (args) => execFileSync(process.execPath, [SWEEP].concat(args),
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

ok(fs.existsSync(SWEEP), 'the sweep exists');

console.log('\n== against the real artifact it reports honestly ==');
{
  const out = run([]);
  ok(/TARGET SWEEP/.test(out), 'it runs on the shipped walk');
  /* the current artifact predates the excursion fields, and the sweep must
     say so rather than quietly sweeping something it cannot see */
  const j = JSON.parse(run(['--json']));
  if (!j.ok){
    ok(/cannot be tested yet/.test(out), 'with no excursion recorded it says the question is open');
    ok(!/best .*R at/.test(out), 'and names no winner it has no data for');
    ok(/33\.3%/.test(out), 'while still stating the 2R breakeven it CAN compute');
    ok(j.designR.length === 1 && j.designR[0] === 2,
       'and confirms the walk is 100% 2.0R plans — a rule, not a measurement');
  } else {
    ok(/best /.test(out), 'with excursion present it reports a best target');
  }
}

/* ---- a fixture with known answers ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-sweep-'));
const mk = (trades) => {
  const f = path.join(tmp, 'w-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(f, JSON.stringify({
    meta: { fees: { roundTripFrac: 0.0026 } }, aggregates: {}, trades
  }));
  return f;
};
/* entry 1000, stop 990 -> risk 10 = 1.00% of entry, clear of the floor.
   costR at PAXG = 1000*0.0026/10 = 0.26R. */
const trade = (mfeR, rMultiple, outcome) => ({
  entry: 1000, stop: 990, t1: 1020, dir: 'long', horizon: 'SWING', tier: 'FAIR',
  mfeR, maeR: 0.4, rMultiple, netR: rMultiple - 0.26, outcome
});

console.log('\n== a target only pays when price actually reached it ==');
{
  /* ten trades that each ran exactly 1.2R then lost. 1R pays on all ten;
     1.25R and 2R pay on none. */
  const f = mk(Array.from({ length: 10 }, () => trade(1.2, -1, 'loss')));
  const j = JSON.parse(run(['--in=' + f, '--json']));
  ok(j.ok === true, 'the fixture sweeps');
  const paxg = j.pools[0].paxg;
  const at = k => paxg.filter(r => Math.abs(r.k - k) < 1e-9)[0];
  ok(at(1).hitRate === 1, 'a 1.00R target is reached by all ten');
  ok(at(1.25).hitRate === 0, 'a 1.25R target by none — 1.2R did not reach it');
  ok(at(2).hitRate === 0, 'and 2.00R by none');
  ok(Math.abs(at(1).gross - 1) < 1e-9, 'so 1R grosses exactly +1R');
  ok(Math.abs(at(2).gross - (-1)) < 1e-9, 'and 2R grosses -1R — the outcome they really had');
}

console.log('\n== cost is priced, so the smallest target does not always win ==');
{
  /* every trade runs 3R. Gross rises with the target; the cost is fixed at
     0.26R, so net must rise too and the sweep must not prefer 0.5R. */
  const f = mk(Array.from({ length: 20 }, () => trade(3, 2, 'win')));
  const j = JSON.parse(run(['--in=' + f, '--json']));
  const paxg = j.pools[0].paxg;
  const best = paxg.slice().sort((a, b) => b.net - a.net)[0];
  ok(best.k === 3, 'when price always runs 3R the sweep picks 3R, not the smallest');
  const half = paxg.filter(r => r.k === 0.5)[0];
  ok(Math.abs(half.gross - 0.5) < 1e-9, 'a 0.5R target grosses 0.5R');
  ok(Math.abs(half.net - (0.5 - 0.26)) < 1e-6, 'and nets 0.5R minus the 0.26R PAXG cost');

  const xm = j.pools[0].xm;
  ok(xm.filter(r => r.k === 0.5)[0].net > half.net,
     'the same target nets more at XM — the venue changes the answer, so it is priced');
}

console.log('\n== a loss is floored at -1R, never worse ==');
{
  /* rMultiple -3 is not reachable through a stop, but a timeout can print a
     large negative; a target sweep must not carry that into a bucket the
     trade would have exited long before */
  const f = mk(Array.from({ length: 5 }, () => trade(0.1, -3, 'timeout')));
  const j = JSON.parse(run(['--in=' + f, '--json']));
  const two = j.pools[0].paxg.filter(r => r.k === 2)[0];
  ok(Math.abs(two.gross - (-1)) < 1e-9, 'an unreached target floors the trade at -1R');
}

console.log('\n== breakeven is reported for every target, and it is 1/(1+k) ==');
{
  const f = mk(Array.from({ length: 4 }, () => trade(2.5, 2, 'win')));
  const j = JSON.parse(run(['--in=' + f, '--json']));
  for (const r of j.pools[0].paxg){
    ok(Math.abs(r.breakeven - 1 / (1 + r.k)) < 1e-12,
       r.k.toFixed(2) + 'R breaks even at ' + (r.breakeven * 100).toFixed(1) + '%');
  }
}

console.log('\n== the stop floor is a separate pool, not a silent filter ==');
{
  const wide = Array.from({ length: 6 }, () => trade(2.5, 2, 'win'));
  /* risk 1 on entry 1000 = 0.1% of entry: below the 0.50% floor */
  const tight = Array.from({ length: 6 }, () => Object.assign(trade(2.5, 2, 'win'), { stop: 999 }));
  const f = mk(wide.concat(tight));
  const j = JSON.parse(run(['--in=' + f, '--json']));
  ok(j.pools.length === 2, 'both pools are reported');
  ok(j.pools[0].paxg[0].n === 12, 'the first pool is everything');
  ok(j.pools[1].paxg[0].n === 6, 'the second is only what clears the floor');
  ok(/stop floor/.test(j.pools[1].label), 'and it is labelled as such');
}

console.log('\n== the conservative excursion rule is in the walk, not just the sweep ==');
{
  /* the sweep can only be as honest as the mfeR it is handed. The rule that
     a stop bar contributes nothing has to live in the walk that records it. */
  const bt = fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnigold.mjs'), 'utf8');
  ok(/if \(!hitStop && risk > 0\)/.test(bt),
     'backtest-omnigold.mjs excludes the stop bar from the favourable excursion');
  ok(/mfeR:/.test(bt) && /maeR:/.test(bt), 'and emits both excursions on the row');
  /* whitespace-tolerant: the comment wraps across lines in the source */
  ok(/intrabar\s+order\s+is\s+unknown/.test(bt),
     'with the reason recorded where the next reader will find it');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n' + passed + ' passed, 0 failed');
