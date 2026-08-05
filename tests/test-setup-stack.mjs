/* HARDGATE — setup-stack.js FTS layer tests (Node 18+, builtins only). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function mkRows(n, drift){
  drift = drift || 0.001;
  const out = [];
  let c = 100;
  for (let i = 0; i < n; i++){
    c *= (1 + drift);
    out.push({ o: c, h: c * 1.002, l: c * 0.998, c: c, v: 1000 });
  }
  return out;
}

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
vm.runInThisContext(fs.readFileSync(root + 'plans.js', 'utf8'), { filename: 'plans.js' });
vm.runInThisContext(fs.readFileSync(root + 'setup-stack.js', 'utf8'), { filename: 'setup-stack.js' });
const W = globalThis.window;

assert(typeof W.hgSetupStack === 'function', 'hgSetupStack exported');
assert(W.HG_FUND_VETO === 0.05, 'unified funding veto threshold');

const rows = mkRows(120, 0.002);
const clean = W.hgSetupStack({
  dir: 'long', style: 'swing', rows4h: rows,
  ticker: { fundingPct: 0.01 },
  gatesPassed: 7, gatesTotal: 7, clean: true,
  fng: { v: 50, c: 'Neutral' }
});
assert(clean && clean.tierHint === 'clean', '7/7 + clean funding -> CLEAN tier');
assert(/T:OK/.test(clean.summary), 'technical pillar OK on clean swing');
assert(/S:(OK|MIX)/.test(clean.summary), 'sentiment pillar acceptable on clean funding');

const veto = W.hgSetupStack({
  dir: 'long', style: 'swing', rows4h: rows,
  ticker: { fundingPct: 0.06 },
  gatesPassed: 7, gatesTotal: 7, clean: true
});
assert(veto.tierHint === 'aside', 'funding paying against long -> aside');
assert(veto.vetoes.length > 0, 'funding veto recorded');

const near = W.hgSetupStack({
  dir: 'short', style: 'swing', rows4h: rows,
  gatesPassed: 6, gatesTotal: 7, nearClean: true,
  ticker: { fundingPct: -0.01 }
});
assert(near.tierHint === 'near', '6/7 -> NEAR tier');

const html = W.hgSetupStackMiniHtml(clean);
assert(/hg-stack-row/.test(html) && /T:OK/.test(html), 'mini HTML renders FTS summary');

const hit = { sym: 'BTCUSD', dir: 'long', clean: true, rows: rows };
W.hgSetupStackAttach(hit, { style: 'swing', rows4h: rows, ticker: { fundingPct: 0.01 }, gatesPassed: 7, gatesTotal: 7 });
assert(hit.stack && hit.stack.summary, 'attach merges stack onto hit object');

const tallyParts = [
  { label: '3 independent agreeing reads', pts: 3 },
  { label: 'macro tailwind — favors longs', pts: 2 }
];
const goldStack = W.hgSetupStackFromTallyParts(tallyParts, { dir: 'long', asset: 'gold', tally: 5, grade: 'A' });
assert(goldStack && goldStack.summary, 'gold tally parts -> FTS stack');

const brainStack = W.hgSetupStackFromBrainRow({
  sym: 'BTCUSD', lane: 'crypto', dec: { dir: 'long', tier: 'PRIME', agree: 5, vetoes: [] },
  col: { votes: [{ layer: 'tape', vote: 'long', text: 'bullish tape' }] }
});
assert(brainStack && /T:/.test(brainStack.summary), 'brain row -> FTS stack');

console.log(fail ? '\nTESTS FAILED' : '\nALL SETUP-STACK TESTS PASSED');
process.exit(fail ? 1 : 0);
