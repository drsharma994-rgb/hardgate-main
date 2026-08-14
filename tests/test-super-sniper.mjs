/* HARDGATE — super-sniper.js unit tests */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ window: {}, document: { head: { appendChild: function(){} } } });
ctx.window = ctx;
ctx.globalThis = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'super-desk-common.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'super-sniper.js'), 'utf8'), ctx);
const W = ctx.window;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

W.rsMaxSafeLev = function(){ return 35; };
W.hgCryptoAttachPositionSize = function(hit, bal, rp){
  hit.positionSize = { positionSizeUnits: 1 };
  hit.positionRisk = { pass: true };
};
W.reversalSniperScan = function(){
  return {
    at: Date.now(),
    cands: [{
      id: 'rs|ETH|0', sym: 'ETHUSD', dir: 'long', entry: 100, stop: 99, t1: 102,
      conviction: 5, lev: 35, rr: 2
    }]
  };
};

const snap = W.buildSnapFromRsScan(W, { balance: 1000, riskPct: 1 }, { allowStale: true });
ok(snap.cands.length === 1 && snap.cands[0].minimalLossPass, 'sniper row passes desk');

const rsSrc = fs.readFileSync(path.join(root, 'reversalsniper.js'), 'utf8');
ok(/rsRunScan/.test(rsSrc), 'reversalsniper exports headless rsRunScan');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/super-sniper\.js\?v=286/.test(html), 'super-sniper in index');
ok(swCacheOk(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw ' + HG_VER);

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
