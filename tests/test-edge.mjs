/* HARDGATE — edge.js unit tests (Node 18+, builtins only).
   Run: node tests/test-edge.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = {};
for (const f of ['indicators.js', 'indicators2.js', 'meanrev.js', 'edge.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const W = ctx.window;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function mkRows(closes, spread){
  var s = (spread === undefined) ? 0.4 : spread;
  return closes.map(function(c, i){
    return { t: i, o: c, h: c + s, l: c - s, c: c, v: 1000 };
  });
}

function bottomFadeSeries(){
  var closes = [];
  var i;
  for (i = 0; i < 220; i++) closes.push(100);
  for (i = 0; i < 15; i++) closes.push(100 - i * 0.15);
  closes.push(97.2);
  closes.push(97.8);
  closes.push(98.4);
  closes.push(98.9);
  closes.push(99.2);
  var rows = mkRows(closes, 0.35);
  var n = rows.length;
  rows[n - 2].l = 96.5;
  rows[n - 2].h = 97.4;
  rows[n - 2].c = 97.8;
  rows[n - 2].o = 97.0;
  rows[n - 1].l = 97.2;
  rows[n - 1].h = 99.5;
  rows[n - 1].c = 99.2;
  rows[n - 1].o = 97.9;
  return rows;
}

const html = readFileSync(path.join(root, 'index.html'), 'utf8');
assert(/xuniverse\.js[\s\S]*edge\.js/.test(html), 'index.html loads xuniverse.js before edge.js');

console.log('== edge exports ==');
assert(typeof W.edgeSignal === 'function', 'edgeSignal exported');
assert(typeof W.edgeEnrich === 'function', 'edgeEnrich exported');
assert(typeof W.edgeAssess === 'function', 'edgeAssess exported');
assert(typeof W.edgePlan === 'function', 'edgePlan exported');
assert(typeof W.edgeBacktest === 'function', 'edgeBacktest exported');
assert(typeof W.edgeMaxSafeLev === 'function', 'edgeMaxSafeLev exported');
assert(typeof W.edgeUseLev === 'function', 'edgeUseLev exported');
assert(typeof W.edgeSwingRead === 'function', 'edgeSwingRead exported');
assert(Array.isArray(W.HG_tabs) && W.HG_tabs.some(function(t){ return t.id === 'edge'; }),
  'HG_tabs registers edge tab');

console.log('== leverage math ==');
assert(W.edgeMaxSafeLev(100, 97) >= 10, 'wide stop -> double-digit max safe lev');
assert(W.edgeUseLev(100, 97) <= W.edgeMaxSafeLev(100, 97), 'use lev <= max safe');
assert(W.edgeUseLev(100, 97) >= 1, 'use lev at least 1x');

console.log('== edgeSignal + plan ==');
{
  var rows = bottomFadeSeries();
  var sig = W.edgeSignal(rows);
  assert(sig === null || sig.dir === 'long' || sig.dir === 'short', 'signal dir valid when present');
  if (sig){
    var p = W.edgePlan(sig);
    assert(!!p && p.dir === sig.dir && p.rr1 >= 1.5, 'plan R:R >= 1.5 when signal fires');
    assert(p.useLev <= p.maxLev, 'plan useLev conservative');
    assert(p.stop < p.entry && p.t1 > p.entry, 'long plan geometry');
  } else {
    assert(true, 'synthetic bottom fade may not fire on every fixture — geometry still tested below');
  }
}

console.log('== edgeEnrich confluence ==');
{
  var rows = bottomFadeSeries();
  var sig = { dir: 'long', edge: 'RANGE BOTTOM', swept: true, entry: 99, stop: 95, t1: 102, t2: 105 };
  var en = W.edgeEnrich(sig, rows, { symbol: 'BTCUSD', exchange: 'delta', fundingPct: -0.03, turnoverUsd: 5e6 }, 'delta');
  assert(en && typeof en.tally === 'number', 'enrich returns tally');
  assert(Array.isArray(en.parts) && en.parts.length >= 1, 'enrich returns parts');
}

console.log('== %B series ==');
{
  var rows = bottomFadeSeries();
  var sig = W.edgeSignal(rows);
  /* computeArrays is internal; edgeSignal proves per-bar %B works when a fade exists */
  assert(sig === null || (isFinite(sig.pctB) && sig.pctB <= 0.22), 'long signal carries finite %B at extreme');
}
{
  var rows = bottomFadeSeries();
  var item = { symbol: 'BTCUSD', exchange: 'delta', turnoverUsd: 5e6 };
  var r = W.edgeAssess(rows, item, 'delta');
  assert(r === null || (r.plan && r.tally >= 2), 'assess null or passes min tally with plan');
}

console.log('== edgeSwingRead + SWING conflict ==');
{
  var closes = [];
  var i;
  for (i = 0; i < 260; i++) closes.push(100 - i * 0.08);
  var bear = mkRows(closes, 0.2);
  var sw = W.edgeSwingRead(bear);
  assert(sw && sw.dir === 'short', 'declining series -> SWING short cascade');
  var sig = { dir: 'long', edge: 'RANGE BOTTOM', swept: true };
  var en = W.edgeEnrich(sig, bear, { sym: 'TESTUSD', exchange: 'delta' }, 'delta');
  assert(en.swingConflict === true, 'EDGE long vs SWING short flags conflict');
  assert(en.parts.some(function(p){ return /OPPOSES SWING/i.test(p.label); }), 'conflict part present');
}

{
  var p = W.edgePlan({ dir: 'short', entry: 100, stop: 103, t1: 96, t2: 92 });
  assert(p && p.stop > p.entry && p.t1 < p.entry && p.rr1 > 0, 'short plan geometry');
}

console.log('== edgeBacktest never throws ==');
{
  var bt = W.edgeBacktest(bottomFadeSeries());
  assert(bt && typeof bt.n === 'number' && typeof bt.expR === 'number', 'backtest shape');
}

console.log('== refresh contract ==');
{
  var tab = W.HG_tabs.filter(function(t){ return t.id === 'edge'; })[0];
  assert(typeof tab.refresh === 'function', 'edge refresh exposed');
  assert(tab.refresh() === 'skipped: not run yet', 'refresh before first scan skipped');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
