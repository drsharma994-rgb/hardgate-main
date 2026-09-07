/* Pack 2 slice 3: edge.js edgeSwingBias publishes a 5-hard-gate ledger via
   hgGateResult. EDGE has no traditional gate array — hard gates are inline
   return-null exits. Slice 3 preserves that architecture (zero behaviour
   change) but exposes edgeSwingBias.lastVetoMeta / lastVetoBlockedBy on
   the function itself so downstream consumers can see WHY a symbol was
   blocked. On pass, gateMeta[] is included on the returned bias object. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const src = readFileSync(resolve(ROOT, 'edge.js'), 'utf8');

/* All 5 EDGE hard gates must be enumerated */
for (const id of ['EG1', 'EG2', 'EG3', 'EG4', 'EG5']){
  const rx = new RegExp("em\\('" + id + "'|fail\\('" + id + "'");
  assert.ok(rx.test(src), `edgeSwingBias must reference ${id}`);
}

/* fail() must publish lastVetoMeta/lastVetoBlockedBy on the function itself */
assert.ok(/edgeSwingBias\.lastVetoMeta\s*=\s*meta\.slice\(\)/.test(src),
  'edgeSwingBias must stash lastVetoMeta on the function');
assert.ok(/edgeSwingBias\.lastVetoBlockedBy\s*=\s*id/.test(src),
  'edgeSwingBias must stash lastVetoBlockedBy on the function');

/* BACKWARDS-COMPAT: fail() must return null so `if (!bias)` callers still work */
assert.ok(/BACKWARDS-COMPAT[\s\S]{0,300}return null;/.test(src),
  'fail() must return null to preserve the 6 !bias callers');

/* On success, bias object must include gateMeta */
assert.ok(/return \{[\s\S]{0,400}gateMeta: meta\s*\n?\s*\};/.test(src),
  'On pass, edgeSwingBias return must include gateMeta');

/* Every EDGE hard gate must be degradeMode:'veto' (structural blocker) */
const emCount = (src.match(/em\('EG[1-5]'/g) || []).length;
assert.ok(emCount >= 5, `Expected at least 5 em('EGn') calls, saw ${emCount}`);

/* GRE resolution must handle both W.hgGateResult and globalThis.hgGateResult
   (edge.js runs in the browser via W, but tests may load it Node-style) */
assert.ok(/W\.hgGateResult[\s\S]{0,120}globalThis\.hgGateResult/.test(src),
  'edgeSwingBias must fall back through W → globalThis → null');

/* Detail strings must NOT include raw eval-danger characters like unescaped
   backticks around user data */
assert.ok(!/detail:\s*`[^`]*\$\{[^}]*\}[^`]*eval/.test(src),
  'edgeSwingBias detail strings must not include eval');

console.log('OK — Pack 2 slice 3: edge.js EDGE hard-gate ledger exposed');
console.log('  * EG1 history ≥ 210 bars     → veto');
console.log('  * EG2 EMA cascade direction  → veto');
console.log('  * EG3 HTF agreement          → veto');
console.log('  * EG4 SWING gates G1/G2/G3   → veto');
console.log('  * EG5 regime stand-aside     → veto');
console.log('  * fail() returns null (backwards-compat with 6 !bias callers)');
console.log('  * gateMeta[] surfaced on pass; lastVetoMeta/blockedBy on fail');
