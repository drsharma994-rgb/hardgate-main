/* HARDGATE — termbasis.js pure math + module wiring */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

console.log('== termBasisCurve pure ==');
globalThis.window = globalThis;
load('termbasis.js');
ok(typeof globalThis.termBasisCurve === 'function', 'termBasisCurve exported');
ok(typeof globalThis.termBasisScore === 'function', 'termBasisScore exported');

const flat = globalThis.termBasisCurve(1, 1, 1);
ok(flat && flat.regime === 'flat' && flat.spreadCur === 0, 'equal legs → flat regime');

const cont = globalThis.termBasisCurve(5, 3, 1);
ok(cont && cont.regime === 'contango' && cont.spreadCur > 0 && cont.slope > 0,
  'upward curve → contango');

const back = globalThis.termBasisCurve(-4, -2, 0.5);
ok(back && back.regime === 'backwardation', 'downward curve → backwardation');

ok(globalThis.termBasisCurve(NaN, 1, 1) === null, 'non-finite → null');
ok(globalThis.termBasisScore(cont) > globalThis.termBasisScore(flat), 'larger spread scores higher');

ok(typeof globalThis.termBasisPlan === 'function', 'termBasisPlan exported');
const plan = globalThis.termBasisPlan({
  pair: 'BTCUSDT',
  mark: 60000,
  curve: cont
});
ok(plan && plan.dir === 'short' && plan.sym === 'BTCUSD', 'contango → short perp plan on desk sym');
ok(plan && plan.stop > plan.entry && plan.t1 < plan.entry, 'short plan stop above / T1 below entry');
ok(globalThis.termBasisPlan({ pair: 'ETHUSDT', mark: 3000, curve: back })?.dir === 'long',
  'backwardation → long perp plan');

globalThis.bookBtnHTML = function(sym, dir, entry, stop, t1, meta){
  return '<button class="toBook" data-fund="' + (meta && meta.fund) + '">' + sym + '</button>';
};
const btn = globalThis.termBasisBookBtn({ pair: 'BTCUSDT', mark: 60000, curve: cont });
ok(btn.indexOf('toBook') >= 0 && btn.indexOf('BTCUSD') >= 0, 'termBasisBookBtn renders when plan exists');

globalThis.hgToTradePlanOnclickAttr = function(sym, dir, entry, stop, t1, meta){
  return 'hgToTradePlan(' + JSON.stringify(sym) + ')';
};
const tbTrade = globalThis.termBasisTradeBtn({ pair: 'BTCUSDT', mark: 60000, curve: cont });
ok(tbTrade.indexOf('SEND TO TRADE PLAN') >= 0 && tbTrade.indexOf('hgToTradePlan') >= 0,
  'termBasisTradeBtn renders trade handoff');

const tbSrc = fs.readFileSync(root + 'termbasis.js', 'utf8');
ok(tbSrc.indexOf('termBasisBookStamp') >= 0 && tbSrc.indexOf('hgBookStampChip') >= 0,
  'term basis cardHTML wires slotted IN BOOK chip');
ok(tbSrc.indexOf('termBasisTradeBtn') >= 0, 'term basis cards wire trade handoff');

const tabs = globalThis.window.HG_tabs || [];
const mod = tabs.find(t => t && t.id === 'termbasis');
ok(!!mod && mod.label === 'TERM BASIS' && typeof mod.mount === 'function' && typeof mod.refresh === 'function',
  'HG_tabs termbasis registered with refresh');

console.log('\n' + passed + ' passed');
if (!passed) process.exit(1);
