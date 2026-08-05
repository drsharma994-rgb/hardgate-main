/* HARDGATE — setup-ui.js smoke tests (Node 18+, builtins only). */
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

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'setup-ui.js', 'utf8'), { filename: 'setup-ui.js' });
const W = globalThis.window;

assert(typeof W.hgSetupCardHTML === 'function', 'hgSetupCardHTML exported');
assert(typeof W.hgFormingWatchHTML === 'function', 'hgFormingWatchHTML exported');
assert(typeof W.hgSetupPanelHTML === 'function', 'hgSetupPanelHTML exported');
assert(typeof W.hgSetupDeskBannerHTML === 'function', 'hgSetupDeskBannerHTML exported');
assert(typeof W.hgBrainSetupTier === 'function', 'hgBrainSetupTier exported');
assert(W.hgBrainSetupTier('PRIME') === 'clean' && W.hgBrainSetupTier('WATCH') === 'forming', 'brain tier mapping');

const watch = W.hgFormingWatchHTML([
  { state: 'armed', sym: 'BTCUSD', strategy: 'SWING 4H', condition: '6/7 gates', gatesPassed: 6, gatesTotal: 7 }
]);
assert(/ARMED/.test(watch) && /BTCUSD/.test(watch), 'forming watch renders armed row');

const desk = W.hgSetupDeskBannerHTML({ tab: 'SWING' });
assert(/CLEAN/.test(desk) && /NEAR/.test(desk) && /FORMING/.test(desk), 'desk banner shows three tiers');

const panel = W.hgSetupPanelHTML({
  sym: 'ETHUSD', dir: 'long', entry: 100, stop: 95, t1: 110, t2: 115,
  isRecent: true, scriptLabel: 'PINE TEST', price: 100
}, { scanner: 'pine' });
assert(/FORMING/.test(panel) && /ETHUSD/.test(panel), 'panel marks recent as forming tier');

const panelEdge = W.hgSetupPanelHTML({
  sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, t2: 115,
  isContext: true, edgeTicket: true, scriptLabel: 'PINE TEST', price: 100
}, { scanner: 'pine' });
assert(/toTrade/.test(panelEdge) && /CLEAN/.test(panelEdge), 'edge ticket stays CLEAN tier with trade button');

console.log(fail ? '\nTESTS FAILED' : '\nALL SETUP-UI TESTS PASSED');
process.exit(fail ? 1 : 0);
