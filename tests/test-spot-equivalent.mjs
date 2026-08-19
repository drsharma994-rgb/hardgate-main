/* HARDGATE — the levels in the reader's instrument, not just the feed's.

   "The omnigold levels are not comparable to the live levels" — reported
   repeatedly, and correctly. The feed is a Binance XAUUSDT perpetual; the
   reader's broker quotes spot XAUUSD. v386 made the desk SAY so ("NOT a
   broker feed ... -0.28% vs spot") — but naming the basis does not make the
   levels placeable on the reader's chart.

   A perp->spot conversion is one ratio, spot / perp-live, applied to entry,
   stop and both targets alike. Scaling every level by the same factor
   preserves R:R exactly, so nothing about the trade's judgement changes —
   only its denomination. Each planned card now carries:

     ≈ SPOT-EQUIVALENT (basis -0.28% applied, R:R unchanged):
       ENTRY 4419.2 · STOP 4389.3 · T1 4479.0 · T2 ...

   Measured live while building this, the basis swings — -0.28% one day,
   -0.03% the next — which is exactly why it is computed per scan rather than
   hardcoded, and why a sub-0.05% basis renders nothing: at that size the
   conversion is noise dressed as precision.

   The spot fetch is bounded to 2.5 seconds and NaN on any failure, BEFORE
   rendering — cards omit the line rather than waiting on a dead feed or
   printing a stale factor.

   Run: node tests/test-spot-equivalent.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');

console.log('== the factor is fetched before rendering, bounded, and honest ==');
{
  ok(/__og\.spotFactor = NaN;/.test(GOLD), 'the factor starts NaN every scan — never stale');
  ok(/Promise\.race\(\[/.test(GOLD) && /setTimeout\(function\(\)\{ r2\(NaN\); \}, 2500\)/.test(GOLD),
     'the spot fetch is raced against a 2.5s timeout that resolves NaN');
  ok(GOLD.indexOf('__og.spotFactor = NaN') < GOLD.indexOf('sfSpot / sfFeed'),
     'reset before assignment, so a failed fetch cannot inherit an old factor');
  ok(/!hgOgSrcIsBroker\(res\.scalp\.source\)/.test(GOLD),
     'a broker-bridge feed computes no factor — its levels ARE the reader\'s');
  ok(/catch \(eSf\)\{\}/.test(GOLD), 'and any failure is swallowed rather than breaking the scan');
  ok(/isFinite\(sfSpot\) && sfSpot > 0/.test(GOLD), 'a nonsense spot price is rejected');
}

console.log('\n== the card line preserves R:R and knows when to shut up ==');
{
  ok(/SPOT-EQUIVALENT \(basis /.test(GOLD), 'the line names itself and quotes the basis');
  ok(/R:R unchanged/.test(GOLD), 'and says the ratio is untouched');
  /* One factor applied to every level — that is what preserves R:R. */
  ok(/c\.plan\.entry \* sf/.test(GOLD) && /c\.plan\.stop \* sf/.test(GOLD)
     && /c\.plan\.t1 \* sf/.test(GOLD), 'entry, stop and T1 all scale by the same factor');
  ok(/Math\.abs\(sf - 1\) > 0\.0005/.test(GOLD),
     'a sub-0.05% basis renders nothing — noise dressed as precision');
  ok(/isFinite\(fin\(c\.plan\.t2\)\)/.test(GOLD), 'T2 converts only when it exists');
  /* The ratio identity, asserted numerically rather than trusted. */
  const sf = 0.99721;
  const e = 4431.59, st = 4401.61, t1 = 4491.54;
  const rr0 = Math.abs(t1 - e) / Math.abs(e - st);
  const rr1 = Math.abs(t1*sf - e*sf) / Math.abs(e*sf - st*sf);
  ok(Math.abs(rr0 - rr1) < 1e-12, 'scaling all levels by one factor preserves R:R to machine precision');
}

console.log('\n== it renders inside the plan branch only ==');
{
  const i = GOLD.indexOf('SPOT-EQUIVALENT (basis');
  const planBranch = GOLD.lastIndexOf('if (c.plan){', i);
  const elseBranch = GOLD.indexOf('no plan — structure could not clear', i);
  ok(planBranch > 0 && planBranch < i, 'the line sits inside if (c.plan)');
  ok(elseBranch > i, 'and above the no-plan else — a card without levels converts nothing');
}

console.log('\n== the shared spot source is the one the basis line already uses ==');
{
  ok(/gfn\('hgGoldLiveSpot'\)/.test(GOLD.slice(GOLD.indexOf('__og.spotFactor'))),
     'the factor uses hgGoldLiveSpot — one spot source, not a second fetcher');
  ok(/window\.hgGoldLiveSpot = goldLiveSpotRef;/.test(read('goldscalp.js')),
     'which goldscalp.js still exports');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SPOT-EQUIVALENT TESTS PASSED');
