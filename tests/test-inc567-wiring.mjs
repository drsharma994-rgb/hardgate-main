/* HARDGATE — Increment 5/6/7 wiring integration tests.
   Verifies modules load, hg-prefixed exports survive goldind, and gate helpers exist. */
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok —', m); };

function loadChain(files){
  const sandbox = { window: {}, console, setTimeout, clearTimeout, AbortController, Date, JSON, Math, localStorage: { _s: {}, getItem(k){ return this._s[k] || null; }, setItem(k,v){ this._s[k]=String(v); } } };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return sandbox.window;
}

console.log('== inc567 module exports ==');
const W = loadChain(['structure-levels.js', 'onchain-alt-data.js', 'structure-core.js', 'portfolio-allocation.js', 'inc567-data-core.js']);
ok(typeof W.hgCalcNetflowZ === 'function', 'hgCalcNetflowZ exported');
ok(typeof W.hgDetectFvg === 'function', 'hgDetectFvg exported');
ok(typeof W.hgDetectFvgList === 'function', 'hgDetectFvgList exported');
ok(typeof W.hgCalcStrategyWeights === 'function', 'hgCalcStrategyWeights exported');
ok(typeof W.hgOnchainAltFetch === 'function', 'hgOnchainAltFetch exported');
ok(typeof W.hgOnchainAltGate === 'function', 'hgOnchainAltGate exported');
ok(typeof W.hgReconcileTrades === 'function', 'hgReconcileTrades exported');

console.log('== goldind does not clobber hgDetectFvg ==');
const W2 = loadChain(['structure-core.js', 'goldind.js']);
ok(typeof W2.hgDetectFvg === 'function', 'hgDetectFvg survives after goldind load');
ok(W2.detectSwings === W2.goldSwings, 'gold detectSwings alias points to goldSwings');

console.log('== recon tab registration ==');
const reconSrc = fs.readFileSync(path.join(root, 'recon-tab.js'), 'utf8');
ok(reconSrc.indexOf("id: 'recon'") >= 0 || reconSrc.indexOf('id: TAB_ID') >= 0, 'recon-tab.js defines tab');

console.log('== index.html wiring ==');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(html.indexOf('inc567-data-core.js') >= 0, 'index.html loads inc567-data-core.js');
ok(html.indexOf('recon-tab.js') >= 0, 'index.html loads recon-tab.js');
ok(html.indexOf('hgDetectFvg') >= 0, 'index.html SMC scan uses hgDetectFvg');
ok(html.indexOf('hgDetectDivergences') >= 0, 'index.html DIV scan uses hgDetectDivergences');
ok(html.indexOf("'recon'") >= 0 && html.indexOf('TOOLS') >= 0, 'recon in nav groups');
ok(html.indexOf('hgCorrelationKellySize') >= 0, 'trade plan uses correlation Kelly');

console.log('== FVG polymorphism (dir vs list) ==');
const fvgRows = [
  { t: 1, o: 100, h: 101, l: 99, c: 100, v: 10 },
  { t: 2, o: 100, h: 102, l: 99, c: 101, v: 10 },
  { t: 3, o: 101, h: 115, l: 101, c: 114, v: 100 },
  { t: 4, o: 114, h: 120, l: 106, c: 118, v: 20 },
  { t: 5, o: 118, h: 119, l: 115, c: 116, v: 10 }
];
const fvgDir = W.hgDetectFvg(fvgRows, 'long');
ok(fvgDir && isFinite(+fvgDir.entry), 'hgDetectFvg(rows, dir) returns legacy entry shape');
const fvgList = W.hgDetectFvgList(fvgRows, { atrLen: 3 });
ok(Array.isArray(fvgList), 'hgDetectFvgList returns array');

console.log('== nested regime expectancy ==');
const pa = loadChain(['portfolio-allocation.js']);
const expMap = { SWING: { 'RISK-OFF': -0.08 } };
const paused = pa.hgCheckStrategyRegimeActive('SWING', 'RISK-OFF', expMap);
ok(paused.active === false && paused.status === 'REGIME PAUSED', 'nested expectancy map pauses strategy');

console.log('== server route ==');
const srv = fs.readFileSync(path.join(root, 'scripts', 'server.mjs'), 'utf8');
ok(srv.indexOf('/api/onchain-alt/desk') >= 0, 'server.mjs mounts onchain-alt desk API');

console.log('\ninc567-wiring: ' + n + ' passed');
