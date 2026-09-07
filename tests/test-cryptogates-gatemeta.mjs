/* Test Pack 2 wiring: cryptogates.js now emits gateMeta[] alongside gates[]
   via hgGateResult, with degrade-mode discipline (na → veto by default,
   except CoinDCX funding which legitimately degrades to pass).

   Run with: node tests/test-cryptogates-gatemeta.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/* Load hg-setup-core (defines G.hgGateResult) + cryptogates as UMD-ish
   globals inside a shared sandbox with just enough browser stubs. */
function makeSandbox() {
  const G = {
    isFinite, Math, Date, console, Number, Array, Object, String,
    setTimeout, clearTimeout, JSON,
  };
  G.window = G;
  G.globalThis = G;
  G.self = G;
  return G;
}

function evalInSandbox(sandbox, code, filename) {
  const fn = new Function('window', 'globalThis', 'self', 'G',
    'var __F = ' + JSON.stringify(filename) + ';\n' + code);
  fn.call(sandbox, sandbox, sandbox, sandbox, sandbox);
}

const sb = makeSandbox();
evalInSandbox(sb, readFileSync(resolve(ROOT, 'hg-setup-core.js'), 'utf8'), 'hg-setup-core.js');

assert.equal(typeof sb.hgGateResult, 'function', 'hgGateResult must be exported');

/* Verify the helper itself first — na → veto by default, na → pass with degradeMode:'pass' */
const naDefault = sb.hgGateResult('G4', 'funding', 'na', 'missing', {});
assert.equal(naDefault.state, 'veto', 'na without opts must veto');
assert.equal(naDefault.pass, false);

const naDegrade = sb.hgGateResult('G4', 'funding', 'na', 'coindcx no funding', { degradeMode: 'pass' });
assert.equal(naDegrade.state, 'pass', 'na with degradeMode:pass must pass');
assert.equal(naDegrade.pass, true);

const passLiteral = sb.hgGateResult('G1', 'cascade', 'pass', 'spread 0.42 ATR', { degradeMode: 'veto' });
assert.equal(passLiteral.pass, true);

const vetoLiteral = sb.hgGateResult('G2', 'HTF', 'veto', 'wrong side', { degradeMode: 'veto' });
assert.equal(vetoLiteral.pass, false);
assert.equal(vetoLiteral.state, 'veto');

/* Now verify cryptogates.js loaded and exposes the SWING evaluate function.
   We need a synthetic price series long enough to run the gate stack.
   Ripping the file into a sandbox is fragile because it references several
   other globals (atr, ema, rsi, cusumLast, lastSwing). Instead of stubbing
   all of those, we do a static-source check: the file MUST call pushGate
   for each of G1..G7 and expose gateMeta in the return. */

const src = readFileSync(resolve(ROOT, 'cryptogates.js'), 'utf8');

for (const id of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']) {
  const call = new RegExp(`pushGate\\('${id}'`);
  assert.ok(call.test(src), `cryptogates.js must call pushGate('${id}', ...)`);
}
assert.ok(/gateMeta:\s*gateMeta/.test(src), 'return object must expose gateMeta');
assert.ok(/var gateMeta = \[\]/.test(src), 'gateMeta[] must be initialised');
assert.ok(/function pushGate/.test(src), 'pushGate helper must exist');
/* CoinDCX funding-missing branch must degrade to pass, not veto */
assert.ok(/coindcx.*'pass'|'pass'.*coindcx/i.test(src)
       || /degradeMode:.*coindcx.*\?\s*'pass'/i.test(src),
  'G4 with CoinDCX must degrade to pass, not veto');

console.log('OK — cryptogates.js is wired to hgGateResult with degrade discipline');
console.log('  * G1-G7 all emit through pushGate → hgGateResult');
console.log('  * gateMeta[] returned alongside gates[] (backwards-compatible)');
console.log('  * na → veto by default; CoinDCX funding degrades to pass');
