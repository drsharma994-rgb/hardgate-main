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
ok(typeof W.mergePublishSuperBestSnap === 'function', 'mergePublishSuperBestSnap exported');
ok(typeof W.warmBestSnapInline === 'function', 'warmBestSnapInline exported');

const now = Date.now();
W.calcTrade = function(opts){
  return { ok: true, impliedLeverage: 2, qty: 10, tp: opts.tpPrice || opts.entry * 1.02 };
};
W.calcSafeMaxLeverage = function(){ return 5; };
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

W.bestScan = function(){
  return {
    at: now - 60000,
    clean: [{
      t: { symbol: 'ETHUSD' }, dir: 'short', entry: 200, stop: 205, t1: 190, rr: 2,
      famScore: 6, robScore: 1, rows: [{ c: 200, h: 201, l: 199, o: 200 }]
    }]
  };
};
const snapRaw = W.buildSnapFromBestScan(W, { balance: 1000, riskPct: 1 });
ok(snapRaw.cands.length === 1 && snapRaw.cands[0].sym === 'ETHUSD', 'maps raw BEST row with t.symbol');

W.mergePublishSuperBestSnap({
  at: now, cands: [{ id: 'a', sym: 'BTCUSD', dir: 'long', entry: 1, stop: 2, minimalLossPass: true }],
  stat: '1 BEST CLEAN'
});
W.mergePublishSuperBestSnap({ at: now, cands: [], stat: '0 BEST CLEAN — stale tick' });
const kept = W.superBestScan();
ok(kept.cands.length === 1 && kept.stat.indexOf('1 BEST CLEAN') === 0, 'mergePublish keeps prior cands when rebuild empty');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(new RegExp('super-best\\.js\\?v=' + HG_VER.replace('hg-v', '')).test(html), 'super-best in index');
ok(/'super-best'/.test(html), 'super-best in nav');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw cache ' + HG_VER);
ok(/super-best\.js/.test(sw), 'super-best in sw');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
