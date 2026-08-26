/* HARDGATE — setup-solidity.js ranks and gates weak tickets.

   Run: node tests/test-setup-solidity.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(extra){
  const ctx = {
    console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'setup-solidity.js'), 'utf8'), ctx, { filename: 'setup-solidity.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'plans.js'), 'utf8'), ctx, { filename: 'plans.js' });
  return ctx;
}

console.log('== exports ==');
{
  const W = boot();
  ok(typeof W.hgSetupSolidityScore === 'function', 'hgSetupSolidityScore');
  ok(typeof W.hgSetupSolidityApply === 'function', 'hgSetupSolidityApply');
  ok(typeof W.hgSetupSolidityBookOk === 'function', 'hgSetupSolidityBookOk');
  ok(typeof W.hgSetupSolidityChipHtml === 'function', 'hgSetupSolidityChipHtml');
}

console.log('\n== crypto: 7/7 checked beats near unchecked ==');
{
  const W = boot();
  const solid = W.hgSetupSolidityScore({
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110,
    clean: true, gatesPassed: 7, postGateChecked: true, rr: 2.2, flowOk: true
  });
  const weak = W.hgSetupSolidityScore({
    sym: 'ETHUSD', dir: 'long', entry: 4000, stop: 3920, t1: 4160,
    near: true, gatesPassed: 6, postGateUnchecked: true, rr: 1.4
  });
  ok(solid.score > weak.score, 'clean checked scores above near unchecked (' + solid.score + ' vs ' + weak.score + ')');
  ok(solid.bookOk === true, 'solid row is book-ok');
  ok(weak.bookOk === false, 'weak near unchecked is not book-ok');
  ok(solid.tier === 'SOLID' || solid.tier === 'GOOD', 'top row tier is SOLID or GOOD');
}

console.log('\n== gold: grade A + tally ranks above C ==');
{
  const W = boot();
  const a = W.hgSetupSolidityScore({
    sym: 'XAUUSD', dir: 'long', entry: 2400, stop: 2380, t1: 2440,
    clean: true, grade: 'A', tally: 9
  }, { asset: 'gold', tally: 9, grade: 'A' });
  const c = W.hgSetupSolidityScore({
    sym: 'XAUUSD', dir: 'short', entry: 2400, stop: 2420, t1: 2360,
    clean: true, grade: 'C', tally: 2, demoted: true
  }, { asset: 'gold', tally: 2, grade: 'C' });
  ok(a.score > c.score, 'gold A beats demoted C');
  ok(!c.bookOk, 'demoted gold C is not book-ok');
}

console.log('\n== ranking prefers solid book-ok row ==');
{
  const W = boot();
  const rows = [
    { sym: 'A', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, clean: true, gatesPassed: 7, postGateUnchecked: true, rr: 2 },
    { sym: 'B', dir: 'long', entry: 1, stop: 0.9, t1: 1.2, clean: true, gatesPassed: 7, postGateChecked: true, rr: 2.1, flowOk: true }
  ].map(r => W.hgSetupSolidityApply(r));
  const ranked = W.hgRankCryptoSetups(rows, 'long');
  ok(ranked.best.sym === 'B', 'MOST PROBABLE prefers post-gate-checked solid row');
}

console.log('\n== shell loads setup-solidity.js ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/setup-solidity\.js/.test(html), 'index.html loads setup-solidity.js');
  ok(/setup-solidity\.js/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js precaches setup-solidity.js');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SETUP SOLIDITY TESTS PASSED');
