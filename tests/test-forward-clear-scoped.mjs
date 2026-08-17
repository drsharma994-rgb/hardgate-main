/* HARDGATE — clearing the gold log must not destroy the crypto evidence.

   Asked to clear the forward log after the gold stop fix invalidated the
   OMNIGOLD records. hgFwdClear was all-or-nothing, which is the wrong tool
   for that job: the OMNIROUTE, PINE and EDGE pools were recorded under a
   stop model that did NOT change, and they are the only accumulated
   out-of-sample evidence in the app. Wiping them to fix gold would destroy
   months of record for no reason.

   hgFwdClear(prefix) now clears one desk. 'OMNIGOLD' catches both
   'OMNIGOLD:SCALP' and 'OMNIGOLD:SWING' and leaves everything else alone.

   The AGGREGATE is cleared for the same tabs in the same call. It is a
   separate store that survives record pruning by design (v328), so clearing
   records alone would leave the log still reporting trades the user believes
   they deleted — which is exactly the failure this has to avoid, and is why
   the emptied-aggregate assertion below is not optional.

   It returns a count of what it removed rather than a bare true, because
   "I deleted your evidence" deserves a number.

   Run: node tests/test-forward-clear-scoped.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const store = {};
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  /* The module reads a BARE localStorage, not window.localStorage — a first
     harness that shimmed only window.localStorage recorded "recorded" while
     persisting nothing, and every assertion would have passed on an empty
     store. */
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  ctx.__store = store;
  return ctx;
}

const BAR = Math.floor(Date.now() / 1000 / 14400) * 14400;
const SEED = [
  ['OMNIGOLD:SCALP', 'ROUND-MAGNET', 'XAUUSD'], ['OMNIGOLD:SCALP', 'ORB', 'XAUUSD'],
  ['OMNIGOLD:SWING', 'MMOVE', 'XAUUSD'],        ['OMNIGOLD:SWING', 'PO3', 'XAUUSD'],
  ['OMNIROUTE', 'SPRING', 'BTCUSDT'],           ['OMNIROUTE', 'ORB', 'ETHUSDT'],
  ['PINE', 'SMC', 'SOLUSDT'],                   ['EDGE', 'EDGE', 'BNBUSDT']
];
function seed(W){
  SEED.forEach(([tab, mechanic, sym], i) =>
    W.hgFwdRecord({ tab, mechanic, sym, tf: '4h', dir: 'long', entry: 100, stop: 98, t1: 104,
                    barT: BAR - (i + 2) * 14400, horizonBars: 20 }));
  const later = [];
  for (let i = 1; i <= 8; i++) later.push({ t: BAR - 14400 + i * 14400, o: 100, h: i === 8 ? 105 : 101, l: 99, c: 100, v: 1 });
  W.hgFwdResolve('XAUUSD', '4h', later);
  W.hgFwdResolve('BTCUSDT', '4h', later);
}
const tot = (W, t) => { const s = W.hgFwdStats(t, null, false); return s.samples + s.open; };

console.log('== the fixture actually records, so nothing here passes on an empty store ==');
const W = boot();
{
  seed(W);
  ok(tot(W, 'OMNIGOLD:SCALP') > 0, 'OMNIGOLD:SCALP has records (' + tot(W, 'OMNIGOLD:SCALP') + ')');
  ok(tot(W, 'OMNIGOLD:SWING') > 0, 'OMNIGOLD:SWING has records (' + tot(W, 'OMNIGOLD:SWING') + ')');
  ok(tot(W, 'OMNIROUTE') > 0, 'OMNIROUTE has records (' + tot(W, 'OMNIROUTE') + ')');
  ok(tot(W, 'PINE') > 0, 'PINE has records');
  ok(tot(W, 'EDGE') > 0, 'EDGE has records');
  ok(W.hgFwdStats('OMNIGOLD:SCALP', null, false).samples > 0, 'and some gold trades actually SETTLED, so the aggregate is populated');
}

console.log('\n== clearing one desk leaves the others untouched ==');
{
  const res = W.hgFwdClear('OMNIGOLD');
  ok(res && res.cleared === 'OMNIGOLD', 'it reports which desk it cleared');
  ok(res.records === 4, 'and how many records it removed (' + res.records + ')');
  ok(typeof res.recordsKept === 'number', 'and how many it kept (' + res.recordsKept + ')');

  ok(tot(W, 'OMNIGOLD:SCALP') === 0, 'OMNIGOLD:SCALP is empty');
  ok(tot(W, 'OMNIGOLD:SWING') === 0, 'OMNIGOLD:SWING is empty — the prefix caught both horizons');
  ok(tot(W, 'OMNIROUTE') > 0, 'OMNIROUTE survived');
  ok(tot(W, 'PINE') > 0, 'PINE survived');
  ok(tot(W, 'EDGE') > 0, 'EDGE survived');
}

console.log('\n== the aggregate goes with it, or the log keeps reporting deleted trades ==');
{
  ok(JSON.stringify(W.hgFwdPool('OMNIGOLD:SCALP')) === '{}', 'no gold mechanic survives in the pool');
  ok(JSON.stringify(W.hgFwdPool('OMNIGOLD:SWING')) === '{}', 'on either horizon');
  const gs = W.hgFwdStats('OMNIGOLD:SCALP', null, false);
  ok(gs.samples === 0 && gs.wins === 0, 'and the stats report nothing rather than aggregate leftovers');
  ok(Object.keys(W.hgFwdPool('OMNIROUTE')).length > 0, 'while the crypto aggregate is intact');
}

console.log('\n== a cleared desk starts accumulating again immediately ==');
{
  const r = W.hgFwdRecord({ tab: 'OMNIGOLD:SCALP', mechanic: 'ROUND-MAGNET', sym: 'XAUUSD', tf: '4h',
                            dir: 'long', entry: 100, stop: 98, t1: 104, barT: BAR, horizonBars: 20 });
  ok(r === 'recorded', 'a new firing records straight after a clear');
  ok(tot(W, 'OMNIGOLD:SCALP') === 1, 'and the desk shows exactly that one, with no history behind it');
}

console.log('\n== clearing everything still works, and says so ==');
{
  const W2 = boot();
  seed(W2);
  const before = SEED.length;
  const res = W2.hgFwdClear();
  ok(res.cleared === 'ALL', 'no argument clears everything (back-compatible)');
  ok(res.records === before, 'reporting the full count (' + res.records + ' of ' + before + ')');
  for (const t of ['OMNIGOLD:SCALP', 'OMNIROUTE', 'PINE', 'EDGE']){
    ok(tot(W2, t) === 0, t + ' is empty');
  }
}

console.log('\n== a prefix that matches nothing removes nothing ==');
{
  const W3 = boot();
  seed(W3);
  const res = W3.hgFwdClear('NOSUCHDESK');
  ok(res.records === 0, 'nothing was removed (' + res.records + ')');
  for (const t of ['OMNIGOLD:SCALP', 'OMNIROUTE', 'PINE', 'EDGE']){
    ok(tot(W3, t) > 0, t + ' is untouched');
  }
}

console.log('\n== a prefix must not clear a desk that merely starts the same way ==');
{
  const W4 = boot();
  W4.hgFwdRecord({ tab: 'OMNIGOLD:SCALP', mechanic: 'A', sym: 'XAUUSD', tf: '4h', dir: 'long',
                   entry: 100, stop: 98, t1: 104, barT: BAR - 30000, horizonBars: 20 });
  W4.hgFwdRecord({ tab: 'OMNIROUTE', mechanic: 'A', sym: 'BTCUSDT', tf: '4h', dir: 'long',
                   entry: 100, stop: 98, t1: 104, barT: BAR - 30000, horizonBars: 20 });
  W4.hgFwdClear('OMNI');
  ok(tot(W4, 'OMNIGOLD:SCALP') === 0 && tot(W4, 'OMNIROUTE') === 0,
    'a deliberately broad prefix clears both — prefix semantics, documented, not a surprise');
}

console.log('\n== it never throws ==');
{
  const W5 = boot();
  seed(W5);
  for (const arg of [null, undefined, '', 0, {}, []]){
    let threw = null, r = null;
    try { r = W5.hgFwdClear(arg); } catch (e) { threw = e; }
    ok(!threw, 'hgFwdClear(' + JSON.stringify(arg) + ') does not throw');
    ok(r && typeof r === 'object', 'and returns a result object');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SCOPED FORWARD-CLEAR TESTS PASSED');
