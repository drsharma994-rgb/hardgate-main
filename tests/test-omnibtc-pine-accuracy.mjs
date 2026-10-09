#!/usr/bin/env node
/* OMNIBTC crown stays a ticket only when fresh pine cores agree.
   A script that did not fire is not a vote. An unloaded bank is unread. */
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

function crown(){
  return {
    tier: 'clean',
    row: {
      sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135,
      clean: true, engine: 'SWING clean plan'
    }
  };
}

console.log('== unloaded pine bank does not invent a vote ==');
{
  const W = boot();
  const pick = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(pick.tier === 'clean' && pick.row.clean === true, 'no scripts loaded, the crown stands');
  ok(/unread/i.test(pick.row.pineNote || ''), 'the note says the bank is unread (' + pick.row.pineNote + ')');
  const book = W.hgObtcPineBook(bars(280));
  ok(book.loaded === 0 && book.fresh.length === 0, 'the book is empty when the functions are absent');
}

console.log('== two fresh cores confirm; one does not; a context bias is not fresh ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true, newShort: false }; };
  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: false, newShort: false }; };
  const bias = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(bias.tier === 'near' && bias.row.clean === false, 'a standing bias with no fresh flag is not a second vote');
  ok(/only HalfTrend/i.test(bias.row.pineNote || ''), 'the note names the single fresh core (' + bias.row.pineNote + ')');

  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: true }; };
  const both = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(both.tier === 'clean' && both.row.clean === true, 'two fresh longs keep the ticket');
  ok(/PINE CONFIRM/i.test(both.row.pineNote || '') && /HalfTrend/.test(both.row.pineNote) && /Squeeze/.test(both.row.pineNote),
    'the confirm names both cores (' + both.row.pineNote + ')');
}

console.log('== one fresh pine plus a second house strategy is enough ==');
{
  const W = boot();
  W.pineRangeFilter = function(){ return { dir: 'long', newLong: true }; };
  const other = { sym: 'BTCUSD', dir: 'long', entry: 101, stop: 91, t1: 121, engine: 'SQUEEZE fired' };
  const pick = W.hgObtcApplyPineAccuracy(crown(), bars(280), [other]);
  ok(pick.tier === 'clean' && /PINE \+ CORE/i.test(pick.row.pineNote || ''),
    'one fresh pine and a second core keep the ticket (' + pick.row.pineNote + ')');
  const same = W.hgObtcApplyPineAccuracy(crown(), bars(280), [
    { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, engine: 'SWING clean plan' }
  ]);
  ok(same.tier === 'near', 'the crown\'s own engine is not a second strategy');
}

console.log('== a fresh script the other way refuses the ticket ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.pineMsbOb = function(){ return { dir: 'long', newShort: false, newLong: true }; };
  W.pineSmartMoneyFlow = function(){ return { dir: 'short', newShort: true }; };
  const pick = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(pick.tier === 'near' && pick.row.pineRefused === true, 'opposition demotes even when two cores agree');
  ok(/PINE AGAINST/i.test(pick.row.pineNote || '') && /Smart Money Flow/.test(pick.row.pineNote),
    'the against note names the opposing core (' + pick.row.pineNote + ')');
}

console.log('== a recent bar counts; a quiet bank does not mint ==');
{
  const W = boot();
  W.pineSmcCore = function(){ return { dir: 'long', newLong: false, barsAgo: 3 }; };
  W.pineWeeklyAvwap = function(){ return { dir: 'long', newLong: false, barsAgo: 2 }; };
  const recent = W.hgObtcApplyPineAccuracy(crown(), bars(40), []);
  ok(recent.tier === 'clean', 'barsAgo 1..5 is a fresh vote');
  W.pineSmcCore = function(){ return null; };
  W.pineWeeklyAvwap = function(){ return { dir: 'long', aligned: true }; };
  const quiet = W.hgObtcApplyPineAccuracy(crown(), bars(40), []);
  ok(quiet.tier === 'near' && /no fresh pine/i.test(quiet.row.pineNote || ''),
    'a null and an aligned-only read leave a watch (' + quiet.row.pineNote + ')');
  const missingTape = W.hgObtcApplyPineAccuracy(crown(), [], []);
  ok(missingTape.tier === 'clean' && /unread/i.test(missingTape.row.pineNote || ''),
    'a missing tape stays unread instead of a fake refusal');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
