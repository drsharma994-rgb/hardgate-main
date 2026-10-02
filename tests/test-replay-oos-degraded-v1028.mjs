/* HARDGATE — hg-v1028: the browser OOS replay can now report a DEGRADED edge.

   gate-replay-oos.js (browser) mirrored lib/gate-replay-oos.mjs but its verdict
   collapsed to 'HOLDS' whenever the out-of-sample set had 8+ settled outcomes —
   so a gate whose edge had decayed on the test set could never read as degraded,
   and the periodic auto-demotion the replay exists to feed had no signal to key
   on. It now follows the lib rule exactly: HOLDS only when the test expectancy
   sustains ≥0.7× the best train expectancy, else DEGRADED; <8 settled is
   INSUFFICIENT.

   Run: node tests/test-replay-oos-degraded-v1028.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const assert = (c, m) => { if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } };

const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gate-replay-oos.js'), 'utf8'), ctx, { filename: 'gate-replay-oos.js' });
const sweep = ctx.hgReplaySweepOos;
assert(typeof sweep === 'function', 'hgReplaySweepOos exported');

/* sample maker: r = outcome in R (null = unsettled), v = gate value */
const mk = (v, r) => ({ pass: {}, vals: { G6: v }, r: r, at: 0 });

function replay(trainWins, testOutcomes){
  const total = trainWins + testOutcomes.length;
  const samples = [];
  for (let i = 0; i < trainWins; i++) samples.push(mk(2.0, 1.0));   // train all winners at the same gate value
  for (const r of testOutcomes) samples.push(mk(2.0, r));            // test set
  return { samples, clean: 0, settled: total };
}

console.log('== the three-way verdict ==');
{
  /* train all +1R → best train expectancy ≈ +1.0; test all −1R → DEGRADED */
  const r = sweep(replay(21, [-1, -1, -1, -1, -1, -1, -1, -1, -1]), 'G6', [1.0, 2.0], 'min');
  assert(r.oos !== null, 'an OOS verdict is produced');
  assert(r.oos.settled === 9 && r.oos.settled >= 8, 'with enough settled outcomes');
  assert(r.oos.verdict === 'DEGRADED', 'a test set that collapses to −1R reads DEGRADED (got ' + r.oos.verdict + ')');
  assert(r.oos.expectancyR === -1, 'the test expectancy is −1R');
}

console.log('== HOLDS when the edge sustains ==');
{
  const r = sweep(replay(21, [1, 1, 1, 1, 1, 1, 1, 1, 1]), 'G6', [1.0, 2.0], 'min');
  assert(r.oos && r.oos.verdict === 'HOLDS', 'a test set that sustains reads HOLDS (got ' + (r.oos && r.oos.verdict) + ')');
}

console.log('== INSUFFICIENT under the sample floor ==');
{
  /* 21 train winners + 9 test where only 3 settle → test settled < 8 */
  const r = sweep(replay(21, [1, 1, 1, null, null, null, null, null, null]), 'G6', [1.0, 2.0], 'min');
  assert(r.oos && r.oos.settled === 3, 'the test set has 3 settled outcomes');
  assert(r.oos.verdict === 'INSUFFICIENT', 'fewer than 8 settled OOS reads INSUFFICIENT (got ' + r.oos.verdict + ')');
}

console.log('== it mirrors lib/gate-replay-oos.mjs ==');
{
  const lib = fs.readFileSync(path.join(ROOT, 'lib', 'gate-replay-oos.mjs'), 'utf8');
  const br = fs.readFileSync(path.join(ROOT, 'gate-replay-oos.js'), 'utf8');
  assert(/DEGRADED/.test(lib) && /DEGRADED/.test(br), 'both the lib and the browser source know DEGRADED');
  assert(/setups:\s*n2/.test(br), 'the browser now also reports the test-set setup count');
  assert(/hitPct/.test(br), 'and the test-set hit rate');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
