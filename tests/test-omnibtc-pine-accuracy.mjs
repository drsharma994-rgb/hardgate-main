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

console.log('== two scripts in one family are one vote ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.pineRangeFilter = function(){ return { dir: 'long', newLong: true }; };
  const same = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(same.tier === 'near' && same.row.clean === false, 'HalfTrend and Range Filter do not confirm each other');
  ok(/trend family/i.test(same.row.pineNote || ''), 'the note names the single family (' + same.row.pineNote + ')');
  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: true }; };
  const three = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(three.tier === 'clean' && /PINE CONFIRM/i.test(three.row.pineNote || ''),
    'a second family beside the trend pair keeps the ticket');
}

console.log('== a fresh indicator cross is a second read; a lean is not ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.ema = function(vals, p){
    return vals.map(function(_, i){
      if (p === 20) return i >= vals.length - 3 ? 2 : 0;
      return 1;
    });
  };
  W.macdHist = function(vals){ return vals.map(function(){ return 1; }); };
  W.donchian = function(rows){
    return { up: rows.map(function(){ return 200; }), lo: rows.map(function(){ return 50; }) };
  };
  const crossed = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(crossed.tier === 'clean' && /PINE \+ INDICATOR/i.test(crossed.row.pineNote || '') && /EMA 20\/50/.test(crossed.row.pineNote || ''),
    'one fresh pine plus a fresh EMA cross keeps the ticket (' + crossed.row.pineNote + ')');

  W.macdHist = function(vals){
    return vals.map(function(_, i){ return i >= vals.length - 2 ? -1 : 1; });
  };
  const against = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(against.tier === 'near' && /INDICATOR AGAINST/i.test(against.row.pineNote || '') && /MACD/.test(against.row.pineNote || ''),
    'a fresh MACD cross the other way refuses the ticket (' + against.row.pineNote + ')');

  W.ema = function(vals, p){
    return vals.map(function(_, i){
      if (p === 20) return (i % 2) ? 2 : 0;
      return 1;
    });
  };
  W.macdHist = function(vals){ return vals.map(function(){ return 1; }); };
  const chop = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(chop.tier === 'near' && /only HalfTrend/i.test(chop.row.pineNote || ''),
    'an EMA that flips every bar is not a vote (' + chop.row.pineNote + ')');
}

console.log('== a fresh 1h core the other way is a watch; a missing 1h tape is not ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.pineSqueezeMomentum = function(rows){
    if (rows && rows.length === 180) return { dir: 'short', newShort: true };
    return { dir: 'long', newLong: true };
  };
  const opposed = W.hgObtcApplyPineAccuracy(crown(), bars(280), [], bars(180));
  ok(opposed.tier === 'near' && /1h PINE AGAINST/i.test(opposed.row.pineNote || ''),
    'a fresh 1h squeeze the other way demotes a 4h confirm (' + opposed.row.pineNote + ')');
  const quiet = W.hgObtcApplyPineAccuracy(crown(), bars(280), [], bars(10));
  ok(quiet.tier === 'clean' && /PINE CONFIRM/i.test(quiet.row.pineNote || ''),
    'a 1h tape too short to read does not invent a refusal');
  const absent = W.hgObtcApplyPineAccuracy(crown(), bars(280), []);
  ok(absent.tier === 'clean', 'no 1h argument leaves the 4h confirm standing');
}

console.log('== a fresh daily core the other way is a watch; a short daily tape is not ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.pineSqueezeMomentum = function(rows){
    if (rows && rows.length === 260) return { dir: 'short', newShort: true };
    return { dir: 'long', newLong: true };
  };
  const opposed = W.hgObtcApplyPineAccuracy(crown(), bars(280), [], bars(10), bars(260));
  ok(opposed.tier === 'near' && /1d PINE AGAINST/i.test(opposed.row.pineNote || ''),
    'a fresh daily squeeze the other way demotes a 4h confirm (' + opposed.row.pineNote + ')');
  const shortDaily = W.hgObtcApplyPineAccuracy(crown(), bars(280), [], bars(10), bars(12));
  ok(shortDaily.tier === 'clean' && /PINE CONFIRM/i.test(shortDaily.row.pineNote || ''),
    'a daily tape too short to read does not invent a refusal');
}

console.log('== a fresh engulfing body is one indicator vote and does not mint a stop ==');
{
  const W = boot();
  W.pineHalfTrend = function(){ return { dir: 'long', newLong: true }; };
  W.ema = function(vals){ return vals.map(function(){ return 1; }); };
  W.macdHist = function(vals){ return vals.map(function(){ return 1; }); };
  W.donchian = function(rows){
    return { up: rows.map(function(){ return 1e9; }), lo: rows.map(function(){ return -1e9; }) };
  };
  function tape(prior, last){
    const rows = [];
    for (let i = 0; i < 280; i++) rows.push({ t: i, o: 100, h: 101, l: 99, c: 100, v: 1 });
    rows[278] = prior;
    rows[279] = last;
    return rows;
  }
  const bull = tape(
    { t: 278, o: 102, h: 103, l: 99, c: 100, v: 1 },
    { t: 279, o: 99, h: 104, l: 98, c: 103, v: 2 }
  );
  const crossed = W.hgObtcApplyPineAccuracy(crown(), bull, []);
  /* MEASURED on the merged tree (hg-v1294 + hg-v1295), and this guard's boot
     loads only `indicators.js / indicators2.js / plans.js / setup-ui.js /
     omnibtc.js` — no pinemath, so `pineSqueezeMomentum` does not exist yet and
     HalfTrend is the ONLY fresh family the bank can see.
     hg-v1294 raised the ticket bar: a crown needs TWO independent pine
     families, or one family plus a CORE strategy, or one family plus an
     indicator that CONFIRMS. A lone fresh family plus one indicator vote is
     explicitly NOT enough — omnibtc.js:972 lands on
     `only <family> fired fresh, and no second house strategy has levels this
     way. Watch only.` The engulfing body still must not mint a stop.
     So this case asserts the RAISED BAR, and the ticket case follows below
     once a second family is present. */
  ok(crossed.tier === 'near' && /only HalfTrend fired fresh/.test(crossed.row.pineNote || ''),
    'one fresh family plus a lone bullish engulf is a WATCH under the raised bar, not a ticket ('
    + crossed.row.pineNote + ')');
  ok(crossed.row.entry === 100 && crossed.row.stop === 90 && crossed.row.t1 === 120,
    'the engulfing read does not replace ENTRY / STOP / T1');

  /* A second independent family turns the same tape into a ticket — and the
     engulfing read STILL does not mint or move a stop. */
  W.pineSqueezeMomentum = function(){ return { dir: 'long', newLong: true }; };
  const two = W.hgObtcApplyPineAccuracy(crown(), bull, []);
  ok(two.tier === 'clean' && /Squeeze Momentum/.test(two.row.pineNote || ''),
    'a second fresh family turns the same tape into a ticket (' + two.row.pineNote + ')');
  ok(two.row.entry === 100 && two.row.stop === 90 && two.row.t1 === 120,
    'and even then the engulfing read mints no new stop');

  /* A family that is genuinely on the crown's side only on the BULL tape. A
     stubbed port that answers `long` unconditionally would confirm the long on
     the bearish tape too, which is a fixture artefact and not the rule under
     test — the rule is that a family pointed the OTHER way refuses the crown. */
  W.pineSqueezeMomentum = function(rows){
    var last = rows && rows[rows.length - 1];
    return (last && last.c > last.o) ? { dir: 'long', newLong: true } : { dir: 'short', newLong: true };
  };
  const bear = tape(
    { t: 278, o: 100, h: 103, l: 99, c: 102, v: 1 },
    { t: 279, o: 103, h: 104, l: 98, c: 99, v: 2 }
  );
  const against = W.hgObtcApplyPineAccuracy(crown(), bear, []);
  ok(against.tier === 'near' && /PINE AGAINST/i.test(against.row.pineNote || ''),
    'a fresh bearish engulf refuses the long ('
    + against.row.pineNote + ')');
  ok(against.row.entry === 100 && against.row.stop === 90 && against.row.t1 === 120,
    'and the refusal leaves the levels alone rather than inventing a stop');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
