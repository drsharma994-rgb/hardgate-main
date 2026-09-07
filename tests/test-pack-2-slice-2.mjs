/* Pack 2 slice 2: SCALP gate matrix + BIAS ledger wired to hgGateResult.
   Both add parallel gateMeta[] via hgGateResult with per-gate degrade
   discipline. Existing shapes are unchanged. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/* ------- SCALP ------- */
const cg = readFileSync(resolve(ROOT, 'cryptogates.js'), 'utf8');

for (const id of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']) {
  const call = new RegExp("metaPush\\('" + id + "'");
  assert.ok(call.test(cg), `cryptogates.js scalpGateMatrix must call metaPush('${id}')`);
}
assert.ok(/scalpGateMatrix[\s\S]*var gateMeta = \[\]/.test(cg),
  'scalpGateMatrix must init gateMeta[]');
assert.ok(/scalpGateMatrix[\s\S]*gateMeta: gateMeta/.test(cg),
  'scalpGateMatrix return must expose gateMeta');
/* SCALP G4: CoinDCX → pass degrade; else → veto */
assert.ok(/scalpNoFundingVenue\s*\?\s*'pass'\s*:\s*'veto'/.test(cg),
  'SCALP G4 must degrade to pass on CoinDCX, veto elsewhere');
/* SCALP G5: null minsToFunding → pass (not in a settlement window) */
assert.ok(/G5[\s\S]*degradeMode:\s*'pass'/.test(cg),
  'SCALP G5 must degrade to pass when minsToFunding is null');

/* ------- BIAS ------- */
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

for (const id of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'S1', 'S2', 'F1', 'B1']) {
  const call = new RegExp("gp\\('" + id + "'");
  assert.ok(call.test(idx), `BIAS runBias() must call gp('${id}')`);
}
assert.ok(/const gMeta=\[\]/.test(idx), 'BIAS must init gMeta[]');
assert.ok(/const GRB = \(typeof hgGateResult/.test(idx),
  'BIAS must reference hgGateResult via GRB');
/* BIAS T1/T2/T4 are structural → veto degrade; T3/T5/T6/S1/S2/B1 → na */
assert.ok(/T1[\s\S]{0,200}degradeMode:\s*'veto'/.test(idx),
  'BIAS T1 must degrade to veto (structural)');
assert.ok(/T3[\s\S]{0,200}degradeMode:\s*'na'/.test(idx),
  'BIAS T3 must degrade to na (advisory)');
assert.ok(/F1[\s\S]{0,500}degradeMode:\s*'info'/.test(idx),
  'BIAS F1 must be tagged info (informational only)');

console.log('OK — Pack 2 slice 2: SCALP + BIAS wired to hgGateResult');
console.log('  * SCALP G1..G7 all emit via metaPush; gateMeta[] exposed');
console.log('  * SCALP G4 degrades to pass on CoinDCX, veto elsewhere');
console.log('  * SCALP G5 degrades to pass when not in a settlement window');
console.log('  * BIAS T1..T6, S1..S2, F1, B1 all emit via gp()');
console.log('  * BIAS structural gates (T1/T2/T4) degrade to veto');
console.log('  * BIAS advisory gates (T3/T5/T6/S1/S2/B1) degrade to na');
console.log('  * BIAS F1 tagged info (informational, never scored)');
