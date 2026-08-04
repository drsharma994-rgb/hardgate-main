/* HARDGATE — hggateflip.js unit tests */
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

const store = { _m: {} };
const ctx = vm.createContext({
  window: {},
  console,
  Math, JSON, Date, isFinite, Array, Object, String,
  localStorage: {
    getItem(k){ return k in store._m ? store._m[k] : null; },
    setItem(k, v){ store._m[k] = String(v); }
  }
});
ctx.window = ctx;
ctx.hgTelegramFormat = function(opts){
  return [opts.headline, 'Tab: ' + opts.tab, 'Signal: ' + opts.signal, opts.body].join('\n');
};
ctx.sendTelegram = function(t){ ctx._tg = t; return true; };
ctx.sendAlertPush = function(){ return true; };

vm.runInContext(fs.readFileSync(path.join(root, 'hggateflip.js'), 'utf8'), ctx, { filename: 'hggateflip.js' });
const G = ctx.window;

assert(typeof G.hgGateFlipRecord === 'function', 'hgGateFlipRecord exported');
assert(G.hgGateFlipTabMeta.swing.tab.indexOf('SWING') >= 0, 'swing tab meta');

const matrix = {
  dir: 'long', passed: 6, clean: false, anchorOK: true,
  gates: [['G1 cascade+spread', true], ['G2 HTF side', true], ['G3 RSI', false],
    ['G4 funding', true], ['G5 vol+wick', true], ['G6 R:R≥2', true], ['G7 CUSUM', true]]
};
G.hgGateFlipRecord('swing', 'delta', 'BTCUSD', 'long', matrix);
const matrix2 = Object.assign({}, matrix, {
  passed: 7, clean: true,
  gates: matrix.gates.map(g => g[0] === 'G3 RSI' ? ['G3 RSI', true] : g)
});
const rec = G.hgGateFlipRecord('swing', 'delta', 'BTCUSD', 'long', matrix2);
const n = G.hgGateFlipAlerts('swing', 'delta', [rec]);
assert(n === 1, 'fires on clean flip');
assert(ctx._tg && ctx._tg.indexOf('CRYPTO SWING tab') >= 0, 'telegram names SWING tab');
assert(ctx._tg && ctx._tg.indexOf('BTCUSD') >= 0, 'telegram includes symbol');
assert(ctx._tg && ctx._tg.indexOf('NOW CLEAN') >= 0, 'telegram describes clean flip');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
