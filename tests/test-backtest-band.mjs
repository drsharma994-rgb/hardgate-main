/* HARDGATE — tests for the backtest confidence band (task #13).
   Run: node tests/test-backtest-band.mjs */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { hgMeanRCI, hgMeanRCILabel, mulberry32 } from '../lib/backtest-stats.mjs';

let passed = 0, failed = 0;
function ok(cond, msg){ if (cond){ passed++; console.log('  ok - ' + msg); } else { failed++; console.error('  FAIL - ' + msg); } }

console.log('== 1) degenerate inputs are honest, never guessed ==');
{
  ok(hgMeanRCI([]) === null, 'no trades -> null, not a zero');
  ok(hgMeanRCI([null, undefined, NaN, 'x']) === null, 'no finite trades -> null');
  const one = hgMeanRCI([0.42]);
  ok(one && one.n === 1 && one.lo === 0.42 && one.hi === 0.42 && one.meanR === 0.42,
    'n=1 -> the degenerate band is the value itself');
}

console.log('== 2) determinism: same seed + same n -> same band (reproducible evidence) ==');
{
  const rs = [2.1, -1, 3.4, -1, -1, 4.9, 0.8, -1, 1.2, -0.6];
  const a = hgMeanRCI(rs, { seed: 7 });
  const b = hgMeanRCI(rs, { seed: 7 });
  ok(a.lo === b.lo && a.hi === b.hi && a.meanR === b.meanR, 'identical inputs + seed -> identical band');
  const c = hgMeanRCI(rs, { seed: 99 });
  ok(a.meanR === c.meanR, 'mean never depends on the seed');
  ok(a.lo <= a.meanR && a.meanR <= a.hi, 'band brackets the mean');
}

console.log('== 3) skewed-by-design R distributions behave ==');
{
  /* winners run to +N R, losers clip near -1 R — the exact shape the app trades */
  const rs = [...Array(9).fill(-1), 4.2, 2.9, 6.1, 1.4, 3.3, 8.0, 2.2];
  const band = hgMeanRCI(rs);
  ok(band.n === 16, 'all finite values counted (n=' + band.n + ')');
  ok(band.lo < band.meanR && band.hi > band.meanR, 'varied data -> a real range, not a point');
  const flat = hgMeanRCI([1, 1, 1, 1, 1]);
  ok(flat.lo === 1 && flat.hi === 1 && flat.meanR === 1, 'constant data -> constant band');
  const mixed = hgMeanRCI([1, null, 2, undefined, 3, NaN]);
  ok(mixed.n === 3 && mixed.meanR === 2, 'null/NaN rows are skipped, not counted as zeros');
}

console.log('== 4) small n widens the band — the honesty property ==');
{
  const pop = [3.1, -1, -1, 2.2, 5.5, -1, 1.1, -1, 4.4, 2.0, -1, 6.2, 0.5, -1, 2.8, 3.9, -1, 1.6, 2.4, -0.5];
  const tight = hgMeanRCI(pop.slice(0, 4), { seed: 3 });
  const wide = hgMeanRCI(pop, { seed: 3 });
  ok((tight.hi - tight.lo) > (wide.hi - wide.lo),
    'n=4 band (' + (tight.hi - tight.lo).toFixed(2) + ') is WIDER than n=20 (' + (wide.hi - wide.lo).toFixed(2) + ')');
  ok(hgMeanRCILabel(wide).includes('n=20') && hgMeanRCILabel(wide).includes('bootstrap 95%'),
    'label states n and the method');
  ok(hgMeanRCILabel(null) === null, 'no band -> no label');
}

console.log('== 5) mulberry32 is a real PRNG ==');
{
  const r = mulberry32(42);
  const a = [r(), r(), r()];
  const r2 = mulberry32(42);
  ok(a[0] === r2() && a[1] === r2() && a[2] === r2(), 'same seed -> same sequence');
  ok(a.every(v => v >= 0 && v < 1), 'values are in [0,1)');
}

console.log('== 6) wiring: the flagship walk ships the band ==');
{
  const src = fs.readFileSync(new URL('../scripts/backtest-omnigold.mjs', import.meta.url), 'utf8');
  ok(/import \{ hgMeanRCI \} from '\.\.\/lib\/backtest-stats\.mjs';/.test(src), 'backtest-omnigold imports the band');
  ok(/netR_band: ci \? \{ lo: \+ci\.lo\.toFixed\(3\)/.test(src), "agg() emits netR_band on every group + overall");
  ok(src.includes("method: 'bootstrap-pctl-95-seeded'"), 'the band states its method');
  ok(/console\.log\('NET R BAND: mean '/.test(src), 'the summary prints the band beside the fees line');
  ok(src.includes('Small n widens it; that widening is the point'), 'limitations explain the band honestly');
  ok(src.includes('FEE_SIDE') && src.includes('SLIP_SIDE'), 'venue-true costs remain in the walk');
}

console.log('== 7) the gold desks keep their dual-cost sensitivity ==');
{
  const scalp = fs.readFileSync(new URL('../scripts/backtest-goldscalp.mjs', import.meta.url), 'utf8');
  const swing = fs.readFileSync(new URL('../scripts/backtest-goldswing.mjs', import.meta.url), 'utf8');
  for (const [name, s] of [['goldscalp', scalp], ['goldswing', swing]]){
    ok(/COST_XM_FRAC = \(0\.35 \/ 3500\) \+ 0\.010 \/ 100/.test(s), name + ' keeps XM 0.020% RT primary');
    ok(/COST_PAXG_FRAC = 2 \* \(0\.0010 \+ 0\.0003\)/.test(s), name + ' keeps PAXG 0.26% RT sensitivity');
  }
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  ok(readme.includes('netR_band') && readme.includes('venue-true costs'),
    'README disclaimer matches reality: costs are included, not denied');
}

console.log(`\nbacktest band tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
