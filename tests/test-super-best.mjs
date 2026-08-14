/* HARDGATE — super-best.js unit tests */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({
  window: {},
  document: { head: { appendChild: function(){} }, createElement: function(){ return { id: '', textContent: '' }; } }
});
ctx.window = ctx;
ctx.globalThis = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'super-desk-common.js'), 'utf8'), ctx, { filename: 'super-desk-common.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'super-best.js'), 'utf8'), ctx, { filename: 'super-best.js' });
const W = ctx.window;

let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

ok(typeof W.buildSnapFromBestScan === 'function', 'buildSnapFromBestScan exported');
ok(typeof W.superBestRunScan === 'function', 'superBestRunScan exported');

const now = Date.now();
W.superSetupEnrichRow = function(c, tier, riskOpts, meta){
  if (!c || !c.dir) return null;
  return {
    id: c.id, sym: c.sym, dir: c.dir, entry: c.entry, stop: c.stop, t1: c.t1,
    tier: tier, tp: c.t1, rr: c.rr, impliedLev: 2, sizingPass: true,
    minimalLossPass: tier === 'clean', scanner: meta.scanner, famScore: c.famScore
  };
};
W.bestScan = function(){
  return {
    at: now - 60000,
    clean: [{
      sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, rr: 2,
      famScore: 7, robScore: 2, rows: [{ c: 100, h: 101, l: 99, o: 100 }]
    }]
  };
};

const snap = W.buildSnapFromBestScan(W, { balance: 1000, riskPct: 1 });
ok(snap.cands.length === 1 && snap.cands[0].minimalLossPass, 'enriches BEST clean row');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/super-best\.js\?v=284/.test(html), 'super-best in index');
ok(/'super-best'/.test(html), 'super-best in nav');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw cache ' + HG_VER);
ok(/super-best\.js/.test(sw), 'super-best in sw');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
