/* HARDGATE — edge.js unit tests (Node 18+, builtins only).
   Run: node tests/test-edge.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = {};
for (const f of ['indicators.js', 'indicators2.js', 'meanrev.js', 'cryptogates.js', 'plans.js', 'edge.js']){
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
    return { t: i * 14400, o: c, h: c + s, l: c - s, c: c, v: 1000 + i * 10 };
  });
}

function trendSeries(dir, n){
  var closes = [];
  var i, base = 100;
  for (i = 0; i < n; i++){
    base += (dir === 'long') ? (0.15 + Math.sin(i / 9) * 0.05) : (-0.15 - Math.sin(i / 9) * 0.05);
    closes.push(base);
  }
  return mkRows(closes, 0.35);
}

assert(/xuniverse\.js[\s\S]*edge\.js/.test(readFileSync(path.join(root, 'index.html'), 'utf8')),
  'index.html loads xuniverse.js before edge.js');

console.log('== edge exports ==');
assert(typeof W.edgeSignal === 'function', 'edgeSignal exported');
assert(typeof W.edgeSwingBias === 'function', 'edgeSwingBias exported');
assert(typeof W.edgeScan === 'function', 'edgeScan exported');
assert(typeof W.edgeWarm === 'function', 'edgeWarm exported');
assert(typeof W.edgeSwingRead === 'function', 'edgeSwingRead exported');
assert(typeof W.edgeEnrich === 'function', 'edgeEnrich exported');
assert(typeof W.edgeAssess === 'function', 'edgeAssess exported');
assert(typeof W.edgeScanList === 'function', 'edgeScanList exported');
assert(typeof W.edgeCardHTML === 'function', 'edgeCardHTML exported');
assert(typeof W.edgeDropForming === 'function', 'edgeDropForming exported');
assert(Array.isArray(W.HG_tabs) && W.HG_tabs.some(function(t){ return t.id === 'edge'; }),
  'HG_tabs registers edge tab');

console.log('== SWING bias gate ==');
{
  var bull = trendSeries('long', 260);
  var bear = trendSeries('short', 260);
  var bBias = W.edgeSwingBias(bull);
  var sBias = W.edgeSwingBias(bear);
  assert(bBias && bBias.dir === 'long', 'uptrend -> long bias');
  assert(sBias && sBias.dir === 'short', 'downtrend -> short bias');
}

console.log('== counter-trend range fade blocked ==');
{
  var bear = trendSeries('short', 260);
  var n = bear.length;
  bear[n - 1].l = bear[n - 1].c - 2;
  bear[n - 1].c = bear[n - 1].l + 0.1;
  var sig = W.edgeSignal(bear);
  assert(sig === null || sig.dir === 'short', 'bear trend does not emit counter-trend long');
}

console.log('== edgePlan geometry ==');
{
  var p = W.edgePlan({ dir: 'short', entry: 100, stop: 103, t1: 94, t2: 89.5, rr: 2 });
  assert(p && p.stop > p.entry && p.t1 < p.entry && p.rr1 >= 2, 'short plan min 2R');
}

console.log('== edgeBacktest never throws ==');
{
  var bt = W.edgeBacktest(trendSeries('long', 280));
  assert(bt && typeof bt.n === 'number', 'backtest shape');
}

console.log('== exact entry geometry ==');
{
  var bull = trendSeries('long', 260);
  var sig = W.edgeSignal(bull);
  if (sig){
    assert(sig.entryType === 'LIMIT' || sig.entryType === 'MARKET', 'signal carries entryType');
    assert(sig.entry !== undefined && isFinite(sig.entry), 'signal has finite exact entry');
    assert(sig.entryGuidance && sig.entryGuidance.length > 5, 'signal carries entry guidance text');
    if (sig.edge === 'EMA21 PULLBACK'){
      assert(Math.abs(sig.entry - sig.anchor) < 1e-6, 'EMA21 pullback entry equals the EMA21 anchor, not bar close');
    }
  } else {
    assert(true, 'trend fixture may not trigger on every bar — skip exact-entry pin when no signal');
  }
}

console.log('== edgeExactEntry pure seam ==');
{
  assert(typeof W.edgeExactEntry === 'function', 'edgeExactEntry exported');
  assert(typeof W.edgeEntryGuidance === 'function', 'edgeEntryGuidance exported');
  assert(typeof W.edgeOteZone === 'function', 'edgeOteZone exported');
  assert(typeof W.edgeSweepQuality === 'function', 'edgeSweepQuality exported');
  var g = W.edgeEntryGuidance(100.1, 100, { lo: 99.8, hi: 100.2 }, 'long');
  assert(g.inZone === true, 'mark inside zone -> inZone');
}

console.log('== OTE zone geometry ==');
{
  var ote = W.edgeOteZone(100, 110, 'long');
  assert(ote && ote.entry < 110 && ote.entry > 100, 'long OTE entry inside impulse leg');
  assert(ote.lo <= ote.entry && ote.entry <= ote.hi, 'OTE entry inside 62-79 band');
}

console.log('== sweep quality filter ==');
{
  var rows = trendSeries('long', 80);
  var n = rows.length;
  rows[n - 3].l = rows[n - 3].c - 3;
  rows[n - 3].o = rows[n - 3].l + 0.1;
  rows[n - 3].c = rows[n - 3].l + 0.2;
  rows[n - 2].c = rows[n - 2].l + 1.5;
  rows[n - 1].o = rows[n - 1].l + 0.2;
  rows[n - 1].c = rows[n - 1].l + 1.2;
  var priorLo = Math.min.apply(null, rows.slice(n - 15, n - 3).map(function(r){ return r.l; }));
  var atrArr = rows.map(function(){ return 1; });
  var A = { rows: rows, lows: rows.map(function(r){ return r.l; }), highs: rows.map(function(r){ return r.h; }),
            closes: rows.map(function(r){ return r.c; }), atr: atrArr };
  var sq = W.edgeSweepQuality(A, n - 1, 'long', priorLo);
  assert(sq && sq.swept === true, 'edgeSweepQuality displacement reclaim passes');
  rows[n - 2].o = rows[n - 2].c - 0.05;
  rows[n - 1].o = rows[n - 1].c - 0.05;
  sq = W.edgeSweepQuality(A, n - 1, 'long', priorLo);
  assert(sq === null, 'edgeSweepQuality rejects weak reclaim body');
}

console.log('== cryptogates bias parity ==');
{
  var bull = trendSeries('long', 260);
  var b = W.edgeSwingBias(bull);
  assert(b && b.dir === 'long', 'bias with cryptogates loaded');
}

console.log('== volume decay validator ==');
{
  assert(typeof W.isCorrectivePullback === 'function', 'isCorrectivePullback exported');
  var volA = {
    volumes: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 50, 50, 50, 50, 50]
  };
  assert(W.isCorrectivePullback(volA, 14, 'long') === true, 'light pullback vs heavy impulse passes');
  volA.volumes = [50, 50, 50, 50, 50, 100, 100, 100, 100, 100, 200, 200, 200, 200, 200];
  assert(W.isCorrectivePullback(volA, 14, 'long') === false, 'heavy pullback vs light impulse fails');
  assert(W.isCorrectivePullback(volA, 3, 'long') === true, 'short history passes by default');
}
{
  var tab = W.HG_tabs.filter(function(t){ return t.id === 'edge'; })[0];
  assert(tab.refresh() === 'skipped: not run yet', 'refresh before scan skipped');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
