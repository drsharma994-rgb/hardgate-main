/* HARDGATE — Increment 3 & 4 wiring integration tests */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok —', m); };

function loadChain(files){
  const sandbox = {
    window: {}, console, setTimeout, clearTimeout, AbortController, Date, JSON, Math,
    localStorage: { _s: {}, getItem(k){ return this._s[k] || null; }, setItem(k,v){ this._s[k]=String(v); }, removeItem(k){ delete this._s[k]; } },
    fetch: async function(){ return { ok: false }; }
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return sandbox.window;
}

console.log('== inc34 bridge exports ==');
const W = loadChain(['liquidity-gate.js', 'inc34-data-core.js']);
ok(typeof W.hgSymbolTierGate === 'function', 'hgSymbolTierGate exported');
ok(typeof W.hgCorrDedupeCandidates === 'function', 'hgCorrDedupeCandidates exported');
ok(typeof W.hgRegimeTransitionPush === 'function', 'hgRegimeTransitionPush exported');
ok(typeof W.hgAlertShouldPush === 'function', 'hgAlertShouldPush exported');
ok(typeof W.hgBookImbalanceConfluence === 'function', 'hgBookImbalanceConfluence exported');

console.log('== data files ==');
ok(fs.existsSync(path.join(root, 'data/param-drift.json')), 'param-drift.json exists');
ok(fs.existsSync(path.join(root, 'data/symbol-tier.json')), 'symbol-tier.json exists');
ok(fs.existsSync(path.join(root, 'data/alert-precision.json')), 'alert-precision.json exists');
ok(fs.existsSync(path.join(root, 'scripts/walk-forward-recalibrate.mjs')), 'walk-forward-recalibrate script exists');
ok(fs.existsSync(path.join(root, 'scripts/compute-symbol-tiers.mjs')), 'compute-symbol-tiers script exists');

console.log('== index.html wiring ==');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('inc34-data-core.js') >= 0, 'index.html loads inc34-data-core.js');
ok(html.indexOf('bestInc34Prepare') >= 0, 'BEST uses inc34 prepare');
ok(html.indexOf('hgBookImbalanceConfluence') >= 0, 'trade plan book imbalance');
ok(html.indexOf('hgSymbolTierGate') >= 0, 'trade plan symbol tier gate');
ok(html.indexOf('hgRegimeTransitionModifiers') >= 0, 'trade plan regime transition');

console.log('== paperbook realistic P&L ==');
const pb = fs.readFileSync(path.join(root, 'lib/paperbook-core.mjs'), 'utf8');
ok(pb.indexOf('rfRealisticPnl') >= 0, 'paperbook-core uses realistic fill model');
ok(pb.indexOf('idealRealizedUsd') >= 0, 'paperbook stores ideal vs realistic columns');

console.log('== setup-calibration execution drag ==');
const sc = fs.readFileSync(path.join(root, 'setup-calibration.js'), 'utf8');
ok(sc.indexOf('scExecutionDragSuspend') >= 0, 'execution drag suspend helper');
ok(sc.indexOf('hgRegimeTransitionModifiers') >= 0, 'calibration reads regime transition');

console.log('== sw precache ==');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(sw.indexOf('inc34-data-core.js') >= 0, 'sw precaches inc34 bridge');
ok(sw.indexOf('param-drift.json') >= 0, 'sw precaches param-drift.json');

console.log('\ntest-inc34-wiring: ' + n + ' passed');
