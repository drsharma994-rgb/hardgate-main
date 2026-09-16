/* HARDGATE — the audit must not be able to flatter the rule it measures.

   scripts/geometry-audit.mjs exists to answer one question: does a plan
   flagged dead on arrival actually do worse? A measurement script that
   quietly rounds unjudgeable rows onto the pass side, or counts an order
   that never filled as a loss, would produce exactly the answer someone
   hoping for a good result would want. These tests cover the three places
   that could happen.

   Run: node tests/test-geometry-audit.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const SCRIPT = path.join(ROOT, 'scripts', 'geometry-audit.mjs');
ok(fs.existsSync(SCRIPT), 'the audit script is where it says it is');

const src = fs.readFileSync(SCRIPT, 'utf8');

console.log('\n== it runs on this repo, as shipped ==');
let report;
{
  const out = execFileSync(process.execPath, [SCRIPT, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  report = JSON.parse(out);
  ok(report && Array.isArray(report.desks), 'and --json is machine readable');
  ok(report.desks.length > 0, 'and it found settled artifacts to measure');
  const text = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(/MARKET-GEOMETRY AUDIT/.test(text), 'the human output names what it is');
  ok(/decoration/.test(text), 'and says out loud that an unmeasured gate is a decoration');
}

console.log('\n== it uses the real rule, not a second copy of it ==');
{
  ok(/hg-plan\.js/.test(src), 'it loads hg-plan.js');
  ok(/ctx\.hgPlanMarketGeometry/.test(src), 'and takes the rule from it');
  ok(!/stop-breached'[\s\S]{0,200}return \{ code/.test(src),
     'and does not reimplement the verdict it is auditing');
}

console.log('\n== unfilled is not a loss ==');
{
  /* an order that never filled is neither. Folding it into losses is the
     easiest way to manufacture a bad number for the retest population,
     which is precisely the population full of unfilled limit orders. */
  ok(/winRate = b => \(b\.win \+ b\.loss\)/.test(src.replace(/\s+/g, ' ').replace(/const /, 'const ')) ||
     /b\.win \+ b\.loss/.test(src),
     'the win rate divides by wins plus losses only');
  ok(/unfilled/.test(src), 'and unfilled is tracked as its own outcome');

  let unfilledSeen = 0, winPlusLoss = 0, n = 0;
  for (const d of report.desks){
    for (const b of [d.partial.retest, d.partial.noRetest]){
      unfilledSeen += b.unfilled; winPlusLoss += b.win + b.loss; n += b.n;
    }
  }
  ok(unfilledSeen > 0, 'the corpus really does contain unfilled orders (' + unfilledSeen + ')');
  ok(winPlusLoss + unfilledSeen <= n, 'and they are never also counted as settled');
}

console.log('\n== unjudgeable rows are excluded, never folded onto the pass side ==');
{
  for (const d of report.desks){
    const e = d.exact;
    const seen = e.flagged.n + e.clean.n + e.unjudgeable;
    ok(seen === d.n, d.file.replace(/^backtest-|-results.*\.json$/g, '')
      + ': every row is flagged, passed or unjudgeable — ' + seen + ' of ' + d.n);
  }
  const blind = report.desks.filter(d => d.grade === 'none');
  for (const d of blind){
    ok(d.exact.clean.n === 0 && d.partial.noRetest.n === 0,
       d.file.replace(/^backtest-|-results.*\.json$/g, '')
       + ': a walk that recorded neither mark nor order type scores nothing at all');
  }
}

console.log('\n== the retest recovery is the real one, both directions ==');
{
  /* LIMIT means price must still travel to the entry; STOP means it has
     already gone past. Getting these the wrong way round would invert the
     entire finding, so it is asserted rather than assumed. */
  ok(/BUY_LIMIT' \|\| n === 'SELL_LIMIT'\) return true/.test(src), 'a limit order is a retest');
  ok(/BUY_STOP' \|\| n === 'SELL_STOP'\) return false/.test(src), 'a stop order is not');
  ok(/n === 'BUY' \|\| n === 'SELL'\) return false/.test(src), 'and a market order sits at the mark');
}

console.log('\n== it states its own limits ==');
{
  const text = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(/WHAT THIS DOES NOT SHOW|EXACT — nothing to report/.test(text),
     'the output says what it cannot conclude, not only what it can');
  ok(/ceiling, not a count/.test(text),
     'and calls the partial prevalence a ceiling rather than a measurement');
  ok(/adverse selection/.test(text) || !/retest entries win/.test(text),
     'and names the confound whenever it reports the retest gap');
}

console.log('\n== the emitters now record the mark, so EXACT becomes possible ==');
{
  /* the whole reason the EXACT section is empty today: no settled artifact
     in this repo was written with the mark it was published against */
  const emitters = ['backtest-goldswing.mjs', 'backtest-goldscalp.mjs', 'backtest-newgold.mjs',
                    'backtest-omnigold1.mjs', 'backtest-omnigold.mjs'];
  for (const f of emitters){
    const s = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
    ok(/markAtFire/.test(s), f + ' records the mark at fire');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
