/* HARDGATE — backtest tab params sync + browser bridge tests */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { btRrTighten, btBuildTabParams, syncBacktestTabParams } from '../lib/backtest-tab-params.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok —', m); };

console.log('== btRrTighten ==');
ok(btRrTighten(2.0, -0.62) === 2.75, 'severe negative net tightens +0.75');
ok(btRrTighten(2.0, -0.19) === 2.5, 'moderate negative net tightens +0.5');
ok(btRrTighten(2.0, 0.05) === 2.0, 'positive net does not loosen');

console.log('== btBuildTabParams ==');
const built = btBuildTabParams({
  byMechanic: {
    'RSI-DIVERGE': { n: 58, avgNetR: -0.62, avgGrossR: -0.28, wins: 10, losses: 40 },
    'FVG-FILL': { n: 184, avgNetR: -0.19, avgGrossR: -0.08, wins: 44, losses: 114 },
    'NR7-BREAK': { n: 150, avgNetR: 0.05, avgGrossR: 0.14, wins: 48, losses: 79 },
  },
  global: { rrMin: 2, timeStopSwingBars: 40, timeStopScalpBars: 12 },
});
ok(built.tabs.div.minRR >= 3, 'DIV minRR tightened for RSI-DIVERGE');
ok(built.tabs.smc.minRR >= 2.5, 'SMC minRR tightened for FVG-FILL');

console.log('== sync script ==');
const sync = syncBacktestTabParams(root);
ok(fs.existsSync(sync.deskOut), 'desk-tab-params.json written');
const desk = JSON.parse(fs.readFileSync(sync.deskOut, 'utf8'));
ok(desk.tabs && desk.tabs.edge && desk.tabs.edge.minRR >= 2.5, 'edge tab has backtest-tightened minRR');
ok(Array.isArray(desk.preferKinds) && desk.preferKinds.length >= 3, 'prefer kinds from analysis');

console.log('== browser bridge ==');
function loadChain(files){
  const sandbox = { window: {}, console, setTimeout, clearTimeout, fetch: async function(){ return { ok: false }; } };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return sandbox.window;
}
const W = loadChain(['inc34-data-core.js', 'backtest-tab-params.js']);
ok(typeof W.hgDeskParam === 'function', 'hgDeskParam exported');
W.HG_DESK_TAB_PARAMS = desk;
ok(W.hgDeskParam('smc', 'minRR', 2) >= 2.5, 'hgDeskParam reads synced SMC minRR');
ok(W.hgDeskParam('swing', 'timeStopBars', 60) === 40, 'hgDeskParam reads global timeStopSwingBars');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('backtest-tab-params.js') >= 0, 'index.html loads backtest-tab-params.js');
ok(html.indexOf('hgTabMinRr') >= 0, 'index.html defines hgTabMinRr helper');

const cg = fs.readFileSync(path.join(root, 'cryptogates.js'), 'utf8');
ok(cg.indexOf('cgSwingRrMin') >= 0, 'cryptogates uses cgSwingRrMin');

console.log('\ntest-backtest-tab-params: ' + n + ' passed');
