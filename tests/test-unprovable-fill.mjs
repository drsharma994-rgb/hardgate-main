/* HARDGATE — the exclusion that was only ever applied to one side.

   scripts/backtest-omnigold.mjs flagged `ambiguousSameBarWin` on a pending
   order that resolved on its own fill bar, and the evidence bake dropped
   rows carrying it. The flag was set on WINS only. So the bake removed 462
   unprovable wins and kept 1,289 unprovable losses, and the mechanics were
   then judged on the remainder.

   That is not conservatism, it is a filter pointing one way. On the shipped
   walk it moved the pooled win rate from 33.56% to 27.61% against a 33.33%
   breakeven at 2R, and seventeen mechanics read "significantly below
   breakeven" where one does under an even rule.

   The predicate now lives in lib/unprovable-fill.mjs and every consumer
   filters on it. These checks pin the rule, its symmetry, its
   back-compatibility with artifacts written before the flag existed, and
   the arithmetic above against the real walk.

   Run: node tests/test-unprovable-fill.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUnprovableFill, isProvableFill, isPendingOrder, boundRows,
         winRateBounds, thresholdVsInterval,
         partitionProvable, unprovableNote } from '../lib/unprovable-fill.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const row = o => Object.assign({ entry: 4700, stop: 4670, t1: 4760,
                                 rMultiple: 2, outcome: 'win',
                                 orderType: 'BUY_LIMIT' }, o);

console.log('== a resting order is what makes the fill unprovable ==');
{
  ok(isPendingOrder('BUY_LIMIT') && isPendingOrder('SELL_LIMIT'), 'limits rest in the book');
  ok(isPendingOrder('BUY_STOP') && isPendingOrder('SELL_STOP'), 'so do stops');
  /* a market order fills at the bar open, so its entry print necessarily
     precedes everything else in that bar — nothing to be unsure about */
  ok(!isPendingOrder('BUY') && !isPendingOrder('SELL'), 'a market order does not');
  ok(!isPendingOrder(null) && !isPendingOrder(undefined) && !isPendingOrder(''),
     'and a missing order type is not treated as pending');
}

console.log('\n== the rule is symmetric — this is the whole point ==');
{
  ok(isUnprovableFill(row({ sameBarExit: true, outcome: 'win', rMultiple: 2 })),
     'a same-bar pending WIN is unprovable');
  ok(isUnprovableFill(row({ sameBarExit: true, outcome: 'loss', rMultiple: -1 })),
     'and a same-bar pending LOSS is unprovable in exactly the same way');
  ok(isUnprovableFill(row({ sameBarExit: true, outcome: 'loss (both-touch)', rMultiple: -1 })),
     'including a both-touch loss on the fill bar');

  /* the two cases that ARE provable, and must not be swept up */
  ok(!isUnprovableFill(row({ sameBarExit: true, orderType: 'BUY', outcome: 'win' })),
     'a market order filling and resolving in one bar is NOT unprovable');
  ok(!isUnprovableFill(row({ outcome: 'win' })),
     'and neither is a pending order that resolved on a later bar');

  ok(isProvableFill(row({})) === !isUnprovableFill(row({})), 'the complement really is the complement');
  ok(!isUnprovableFill(null) && !isUnprovableFill(undefined), 'a missing row is not unprovable, it is absent');
}

console.log('\n== old artifacts classify the same as new ones ==');
{
  /* rows written before the flag existed carry sameBarExit + orderType, and
     the predicate derives the identical answer from them */
  const derived = row({ sameBarExit: true, outcome: 'loss' });
  ok(derived.unprovableFill === undefined, 'the fixture has no explicit flag');
  ok(isUnprovableFill(derived), 'and is still classified from sameBarExit + orderType');

  /* an explicit flag wins over the derivation, in both directions, so a
     walk that has settled a row properly can say so */
  ok(!isUnprovableFill(row({ sameBarExit: true, unprovableFill: false })),
     'an explicit false overrides the derivation — a resolved row stays in the sample');
  ok(isUnprovableFill(row({ unprovableFill: true })), 'and an explicit true is honoured');
}

console.log('\n== the two bounds are what the ambiguity actually implies ==');
{
  /* a scored WIN is worst-cased by deletion (you never got the win);
     a scored LOSS is worst-cased by keeping it (you really did take it) */
  const uw = row({ sameBarExit: true, outcome: 'win', rMultiple: 2 });
  const ul = row({ sameBarExit: true, outcome: 'loss', rMultiple: -1 });
  const clean = row({ outcome: 'win' });
  const rows = [uw, ul, clean];

  const lo = boundRows(rows, 'lower');
  ok(lo.indexOf(uw) < 0, 'the LOWER bound drops the unprovable win');
  ok(lo.indexOf(ul) >= 0, 'and keeps the unprovable loss');

  const hi = boundRows(rows, 'upper');
  ok(hi.indexOf(uw) >= 0, 'the UPPER bound keeps the unprovable win');
  ok(hi.indexOf(ul) < 0, 'and drops the unprovable loss');

  ok(boundRows(rows, 'point').length === 1, 'the point set drops both and is not a bound');
  ok(lo.indexOf(clean) >= 0 && hi.indexOf(clean) >= 0, 'a provable row is in every set');
  ok(boundRows(rows).indexOf(uw) < 0, 'lower is the default, because it is the cautious read');
}

console.log('\n== a threshold is judged against the interval, never a point ==');
{
  const many = (n, o) => Array.from({ length: n }, () => row(o));
  /* a pool that wins outright: 60 provable wins, 40 provable losses */
  const strong = many(60, { outcome: 'win' }).concat(many(40, { outcome: 'loss', rMultiple: -1 }));
  ok(thresholdVsInterval(strong, 1 / 3) === 'below', 'a pool clearing 33.3% at its WORST reads below');

  const weak = many(10, { outcome: 'win' }).concat(many(90, { outcome: 'loss', rMultiple: -1 }));
  ok(thresholdVsInterval(weak, 1 / 3) === 'above', 'a pool failing 33.3% at its BEST reads above');

  /* the case this file exists for: enough ambiguity to span the threshold */
  const murky = many(30, { outcome: 'win' })
    .concat(many(70, { outcome: 'loss', rMultiple: -1 }))
    .concat(many(40, { sameBarExit: true, outcome: 'win' }))
    .concat(many(40, { sameBarExit: true, outcome: 'loss', rMultiple: -1 }));
  ok(thresholdVsInterval(murky, 1 / 3) === 'straddles',
     'and a pool whose interval contains 33.3% establishes NOTHING in either direction');

  ok(thresholdVsInterval([], 1 / 3) === null, 'no rows yields no verdict, not a default one');
}

console.log('\n== the interval, against the real walk ==');
{
  const walk = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'scripts', 'backtest-omnigold-results.json'), 'utf8'));
  const settled = walk.trades.filter(r => typeof r.rMultiple === 'number');
  const b = winRateBounds(settled);

  ok(b.unprovable === 1751, 'the walk holds 1751 unprovable fills (' + b.unprovable + ')');
  ok(b.unprovableScoredWins === 462, '462 of them the walk scored as wins');
  ok(b.unprovableScoredLosses === 1289, 'and 1289 as losses');

  ok(Math.abs(b.lower - 0.2761) < 0.001, 'the lower bound is ' + (100 * b.lower).toFixed(2) + '%');
  ok(Math.abs(b.upper - 0.3832) < 0.001, 'the upper bound is ' + (100 * b.upper).toFixed(2) + '%');

  /* THE finding: 2R breakeven sits inside the interval, so this walk cannot
     say whether the book wins or loses */
  ok(b.lower < 1 / 3 && b.upper > 1 / 3,
     'and 33.33% breakeven at 2R falls INSIDE it — the walk settles nothing');
  ok(thresholdVsInterval(settled, 1 / 3) === 'straddles', 'which is what the verdict says');

  /* what the old single number did: it WAS the lower bound, reported as the record */
  const oldFilter = settled.filter(r => !r.ambiguousSameBarWin);
  const rate = rs => {
    const w = rs.filter(r => /^win/.test(r.outcome)).length;
    const l = rs.filter(r => /^loss/.test(r.outcome)).length;
    return w / (w + l);
  };
  ok(Math.abs(rate(oldFilter) - b.lower) < 1e-9,
     'the filter this repo shipped computed exactly the lower bound — a bound, presented as a measurement');

  /* and the consequence: condemnation at the lower bound, nothing at the upper */
  const be = 1 / 3;
  const group = rows => {
    const g = {};
    for (const r of rows) (g[r.horizon + '|' + r.kind] = g[r.horizon + '|' + r.kind] || []).push(r);
    return g;
  };
  const verdict = rs => {
    const w = rs.filter(r => /^win/.test(r.outcome)).length;
    const l = rs.filter(r => /^loss/.test(r.outcome)).length;
    const n = w + l;
    if (n < 20) return 'thin';
    const z = (w / n - be) / Math.sqrt(be * (1 - be) / n);
    return z <= -2 ? 'VETO' : (z >= 2.88 ? 'PASS' : 'unchecked');
  };
  const count = (rows, v) => Object.values(group(rows)).filter(rs => verdict(rs) === v).length;

  ok(count(boundRows(settled, 'lower'), 'VETO') === 17,
     '17 mechanics read significantly below breakeven at the lower bound');
  ok(count(boundRows(settled, 'upper'), 'VETO') === 0,
     'and NOT ONE fails at its upper bound — every condemnation was a choice of bound');
  ok(count(boundRows(settled, 'upper'), 'PASS') === 8,
     '8 clear the significance bar at the upper bound');
  ok(count(boundRows(settled, 'lower'), 'PASS') === 0,
     'and not one clears it at the lower — so nothing is established either way');
}

console.log('\n== partition keeps every row, and the note refuses to reassure ==');
{
  const rows = [row({ sameBarExit: true }), row({}), row({ sameBarExit: true, outcome: 'loss' })];
  const p = partitionProvable(rows);
  ok(p.kept.length + p.withheld.length === rows.length, 'nothing is lost in the split');
  ok(p.withheld.length === 2 && p.kept.length === 1, 'and it splits where the rule says');
  ok(partitionProvable([]).withheld.length === 0, 'an empty input yields an empty split');
  ok(unprovableNote([row({}), row({})]) === '',
     'a walk with nothing unprovable prints nothing rather than a reassurance');
  ok(/interval, not a measurement/.test(unprovableNote(rows)),
     'a walk with unprovable rows says the number is an interval');
  ok(/resolve-unprovable-1m/.test(unprovableNote(rows)),
     'and names the one thing that can narrow it');
}

console.log('\n== every consumer filters on the shared rule ==');
{
  /* the defect was one filter drifting from another, so the check is that
     no consumer still carries its own copy of the old predicate */
  const consumers = ['scripts/omnigold-evidence-bake.mjs', 'scripts/target-sweep.mjs',
                     'scripts/backtest-multi.mjs', 'tests/test-omnigold-publication-rate.mjs'];
  /* comments are stripped first: several of these files explain the old
     predicate by name, and the history is worth keeping. What must not
     survive is a live filter still using it. */
  const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const f of consumers){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(/unprovable-fill\.mjs/.test(src), f + ' imports the shared rule');
    ok(!/!\s*r\.ambiguousSameBarWin/.test(code(src)),
       'and ' + f + ' no longer filters on the win-only flag');
  }

  const walkSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnigold.mjs'), 'utf8');
  ok(/unprovableFill: unprovableFill \|\| undefined/.test(walkSrc),
     'the walk records the symmetric flag on every row it applies to');
  ok(/sampleIntegrity/.test(walkSrc), 'and reports how big the usable sample really is');
}

console.log('\n' + passed + ' passed, 0 failed');
