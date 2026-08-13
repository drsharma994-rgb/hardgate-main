/* HARDGATE — supersetup.js unit tests (Node 18+, no network). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ window: {}, document: { head: { appendChild: function(){} }, createElement: function(){ return { id: '', textContent: '' }; } } });
ctx.window = ctx;
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'supersetup.js'), 'utf8'), ctx, { filename: 'supersetup.js' });
const W = ctx.window;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

ok(typeof W.superSetupCalc === 'function', 'superSetupCalc exported');
ok(typeof W.calcTrade === 'function', 'calcTrade alias exported');

const passLong = W.superSetupCalc({ balance: 1000, riskPct: 1, entry: 100, stop: 98, tpRR: 2, maxLeverage: 10 });
ok(passLong.ok === true, 'long 2% stop 1% risk passes with headroom');
ok(Math.abs(passLong.riskDollars - 10) < 1e-9, 'risk $ = balance × risk%');
ok(Math.abs(passLong.tp - 104) < 1e-9, 'TP at 2R above entry for long');

const badStop = W.superSetupCalc({ balance: 1000, riskPct: 1, entry: 100, stop: 100 });
ok(badStop.ok === false && /Stop-loss/.test(badStop.reason), 'equal entry/stop blocked');

const highLev = W.superSetupCalc({ balance: 1000, riskPct: 5, entry: 100, stop: 99.9, tpRR: 2, maxLeverage: 2 });
ok(highLev.ok === false && /Leverage/.test(highLev.reason), 'excessive leverage blocked');

const tab = (W.HG_tabs || []).find(function(t){ return t && t.id === 'super-setup'; });
ok(!!tab && tab.label === 'SUPER SETUP' && typeof tab.mount === 'function', 'HG_tabs registers super-setup');
ok(typeof tab.refresh === 'function', 'refresh hook present');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('supersetup.js') >= 0, 'index.html loads supersetup.js');
ok(/super-setup/.test(html), 'STRATEGIES nav lists super-setup');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw.js cache matches build-stamp (' + HG_VER + ')');
ok(sw.indexOf('supersetup.js') >= 0, 'sw.js precaches supersetup.js');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
