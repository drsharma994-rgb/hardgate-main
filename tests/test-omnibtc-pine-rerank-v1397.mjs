#!/usr/bin/env node
/* HARDGATE — hg-v1397: OMNIBTC ranks the pine +10 from the ten-core book,
   not from the engine name, and a refused crown does not keep the seat.

   The book is unchanged: ten cores, record-only ports stay out, an unread
   book is not a side. What changes is the order. The +10 used to fire
   because the engine string contained PINE, and it fired before the book
   ran. A later refusal left that winner in the chair. This guard drives
   the real functions. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
function ok(cond, label){
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.log('  FAIL —', label); }
}
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function liftFn(src, name){
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}

function boot(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} },
    documentElement: { appendChild(){} }, addEventListener(){}
  };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function bars(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    rows.push({ t: 1700000000 + i * 14400, o: 100, h: 104, l: 96, c: 100 + (i % 3), v: 10 });
  }
  return rows;
}

const SRC = read('omnibtc.js');
const ctx = { Math, isFinite, isNaN, JSON, Array, Object, Number, String };
vm.createContext(ctx);
vm.runInContext(liftFn(SRC, 'hgObtcAccuracyParts'), ctx, { filename: 'lifted:parts' });

function pineWeight(row){
  const parts = ctx.hgObtcAccuracyParts(row, true);
  const p = parts.filter(x => x.key === 'pine')[0];
  return p ? p.weight : -1;
}

console.log('== the +10 is the book, not the engine name ==');
{
  ok(pineWeight({ engine: 'PINE LORENTZIAN', clean: true }) === 0,
    'an engine named PINE scores 0 before the book has agreed');
  ok(pineWeight({
    engine: 'SWING', clean: true,
    pineFamilies: ['trend', 'momentum'], pineOppose: [], pineAgree: ['HalfTrend', 'Squeeze']
  }) === 10, 'two agreeing families score +10 even when the engine is not named PINE');
  ok(pineWeight({
    engine: 'PINE LORENTZIAN', clean: true,
    pineFamilies: ['trend', 'momentum'], pineOppose: ['Smart Money Flow']
  }) === 0, 'an opposing core scores 0 even when two families also agreed');
  ok(pineWeight({
    engine: 'PINE LORENTZIAN', clean: true, pineRefused: true,
    pineFamilies: ['trend', 'momentum'], pineOppose: []
  }) === 0, 'a refused crown does not keep the +10');
  ok(pineWeight({
    engine: 'SWING', clean: true,
    pineFamilies: ['trend'], pineOppose: [], coreAgree: ['SQUEEZE']
  }) === 10, 'one family plus a second house core is the same agreement the ticket already accepts');
  ok(pineWeight({
    engine: 'SWING', clean: true,
    pineFamilies: ['trend'], pineOppose: [], coreAgree: [], indAgree: []
  }) === 0, 'one family with no second witness is not an agreement');
  const named = ctx.hgObtcAccuracyParts({ engine: 'PINE CONFIRM', clean: true }, true);
  ok(named.filter(p => p.key === 'pine')[0].on === false,
    'the old name check is not the on-switch');
}

console.log('== a refused long hands the crown to the short the book accepts ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'short', newShort: true }; };
  W.pineSqueezeMomentum = function(){ return { dir: 'short', newShort: true }; };
  const tape = bars(280);
  const longRow = {
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120,
    clean: true, engine: 'PINE LORENTZIAN',
    crossValidation: 'PASSED: confirmed by opposite family engine',
    accuracyScore: 45,
    pineRefused: true,
    pineNote: 'PINE AGAINST — Smart Money Flow fired the other way. Watch only, not a ticket.',
    pineOppose: ['Smart Money Flow'], pineFamilies: ['trend'], pineAgree: ['HalfTrend']
  };
  const shortRow = {
    sym: 'BTCUSD', dir: 'short', entry: 110, stop: 120, t1: 90,
    clean: true, engine: 'SWING clean plan',
    crossValidation: 'PASSED: confirmed by opposite family engine',
    accuracyScore: 35
  };
  const pick = { row: longRow, tier: 'near', source: 'weighted-accuracy', board: [longRow, shortRow] };
  const all = [
    { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, engine: 'PINE LORENTZIAN', _rows: tape },
    { sym: 'BTCUSD', dir: 'short', entry: 110, stop: 120, t1: 90, engine: 'SWING clean plan', _rows: tape }
  ];
  const next = W.hgObtcReCrownAfterPine(pick, all);
  ok(next && next.row && next.row.dir === 'short', 'the short survivor takes the crown (' + (next && next.row && next.row.dir) + ')');
  ok(next.row.engine === 'SWING clean plan', 'it is the swing row, not the refused pine-named row');
  ok(next.row.pineRecrowned === true, 'the hand-off is stamped');
  ok(next.row.pineRefused !== true && next.tier === 'clean' && next.row.clean === true,
    'the survivor is still a ticket');
  ok(next.row.accuracyScore === 45, 'the book agreement adds the +10 to the short (got ' + next.row.accuracyScore + ')');
  ok(/next survivor/.test(next.row.pineNote || ''), 'the note says the previous crown stood down');
  ok(next.source === 'pine-recrown', 'the source names the re-crown');
}

console.log('== when every direction is refused, the original watch stays ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.pineSmartMoneyFlow = function(){ return { dir: 'short', newShort: true }; };
  const tape = bars(280);
  const longRow = {
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120,
    clean: true, engine: 'SWING A',
    crossValidation: 'PASSED: confirmed by opposite family engine',
    accuracyScore: 35,
    pineRefused: true,
    pineNote: 'PINE AGAINST — Smart Money Flow fired the other way. Watch only, not a ticket.'
  };
  const shortRow = {
    sym: 'BTCUSD', dir: 'short', entry: 110, stop: 120, t1: 90,
    clean: true, engine: 'SWING B',
    crossValidation: 'PASSED: confirmed by opposite family engine',
    accuracyScore: 35
  };
  const pick = { row: longRow, tier: 'near', source: 'weighted-accuracy', board: [longRow, shortRow] };
  const all = [
    { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, engine: 'SWING A', _rows: tape },
    { sym: 'BTCUSD', dir: 'short', entry: 110, stop: 120, engine: 'SWING B', _rows: tape }
  ];
  const next = W.hgObtcReCrownAfterPine(pick, all);
  ok(next.row === longRow, 'no survivor means the refused watch stays the crown');
  ok(next.row.pineRecrowned !== true, 'a kept refusal is not stamped as a re-crown');
  ok(shortRow.pineRefused === true, 'the other direction was tried and refused');
}

console.log('== a crown the book accepts keeps its seat and earns the +10 ==');
{
  const W = boot();
  const row = {
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120,
    clean: true, engine: 'SWING',
    crossValidation: 'PASSED: confirmed by opposite family engine',
    accuracyScore: 35,
    pineFamilies: ['trend', 'momentum'], pineOppose: [], pineAgree: ['HalfTrend', 'Squeeze']
  };
  const pick = { row: row, tier: 'clean', source: 'weighted-accuracy', board: [row] };
  const next = W.hgObtcReCrownAfterPine(pick, []);
  ok(next === pick, 'an accepted crown is the same object');
  ok(next.row.pineRecrowned !== true, 'it was not handed off');
  ok(next.row.accuracyScore === 45, 'the agreement is now worth +10 (got ' + next.row.accuracyScore + ')');
}

console.log('== a tape-regime refusal does not hand the crown around ==');
{
  const W = boot();
  let ran = 0;
  W.pineHalfTrend = function(){ ran++; return { dir: 'short', newShort: true }; };
  W.pineSqueezeMomentum = function(){ ran++; return { dir: 'short', newShort: true }; };
  const longRow = {
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120,
    clean: true, engine: 'SWING A',
    crossValidation: 'PASSED: confirmed by opposite family engine',
    accuracyScore: 35,
    pineRefused: true, regimeRefused: true,
    pineNote: 'TAPE REGIME — volatile. Watch only, not a ticket.'
  };
  const shortRow = {
    sym: 'BTCUSD', dir: 'short', entry: 110, stop: 120, t1: 90,
    clean: true, engine: 'SWING B', accuracyScore: 35
  };
  const next = W.hgObtcReCrownAfterPine(
    { row: longRow, tier: 'near', board: [longRow, shortRow] },
    [{ sym: 'BTCUSD', dir: 'short', entry: 110, stop: 120, engine: 'SWING B', _rows: bars(280) }]
  );
  ok(next.row === longRow, 'the regime watch stays');
  ok(ran === 0, 'the other candidate was not re-scored by the book');
  ok(shortRow.pineNote == null, 'the short row was not touched');
}

console.log('== the vote book is still ten cores ==');
{
  ok(/var OBTC_PINE = \[/.test(SRC), 'the voting table is still declared');
  const vot = SRC.slice(SRC.indexOf('var OBTC_PINE = ['), SRC.indexOf('var OBTC_PINE_RECORD'));
  const ids = vot.match(/id: '/g) || [];
  ok(ids.length === 10, 'still exactly ten voting cores (' + ids.length + ')');
  ok(SRC.includes('W.hgObtcReCrownAfterPine = hgObtcReCrownAfterPine'),
    'the re-crown is the function the scan calls');
  ok(/hgObtcReCrownAfterPine\(pick, all\)/.test(SRC), 'the scan calls it after the book');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
