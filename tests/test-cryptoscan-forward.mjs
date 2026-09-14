/* HARDGATE — CRYPTO SCAN records its setups to the forward log (hg-v735).

   Run: node tests/test-cryptoscan-forward.mjs

   WHY
   ---
   CRYPTO SCAN was absent from Setup Intelligence entirely. The dashboard reads
   hg-forward.js, and cryptoscan.js never called hgFwdRecordScan — so the tab
   measured nothing about itself: every number on its cards came from the same
   rolling window it had just fetched, which reshuffles noise rather than adding
   evidence.

   TESTABILITY
   -----------
   Everything in the scan path lives inside runScan, which cannot be reached
   without live network (it needs cryptoUltraEngine plus exchange klines), so
   the row builder is lifted out as a pure exported function. This is the same
   shape the SMC ordering work used, and for the same reason: the previous SMC
   activation in this repo shipped as DEAD CODE because nothing could exercise
   it. A test that only proves the file parses would repeat that.

   THE REGRESSION THIS PINS HARDEST
   --------------------------------
   +null, +undefined and +'' are all 0, and isFinite(0) is true. Coercing a
   level before testing it therefore lets a MISSING stop through AS ZERO, which
   records a fabricated 100%-risk trade instead of dropping the row. The first
   version of this code had exactly that bug; these assertions caught it. The
   same trap is documented in fixpack14-core.js's hgCoint. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, Promise, RegExp,
    isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout, Map, Set,
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   addEventListener(){} };
  ctx.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'cryptoscan.js'), 'utf8'), ctx, { filename: 'cryptoscan.js' });
  return ctx;
}
const W = boot();
const plan = (entry, stop, t1, timeoutBars) => ({ entry, stop, t1, timeoutBars });
const mk = (sym, tier, hq, p) => ({ sym, dir: 'long', voteTier: tier, isHighQuality: hq, plan: p });

console.log('== the row builder is reachable without a live scan ==');
ok(typeof W.__csFwdRows === 'function', '__csFwdRows exported — runScan needs network, so the decision has to be liftable');
ok(typeof W.__csFwdHorizon === 'function', '__csFwdHorizon exported');

console.log('== valid setups become forward records ==');
{
  const rows = W.__csFwdRows([
    mk('BTCUSDT', 'strong', true, plan(100, 95, 110, 24)),
    mk('ETHUSDT', 'weak', false, plan(50, 52, 46, 24)),
  ]);
  ok(rows.length === 2, 'both valid setups recorded');
  ok(rows[0].sym === 'BTCUSDT' && rows[0].entry === 100 && rows[0].stop === 95 && rows[0].t1 === 110,
     'levels carried through unchanged');
  ok(rows[0].dir === 'long' && rows[1].dir === 'long', 'direction carried');
}

console.log('== mechanic is the VOTE TIER, so the tiers can be judged separately ==');
{
  const rows = W.__csFwdRows([
    mk('A', 'strong', true, plan(100, 95, 110)),
    mk('B', 'moderate', false, plan(100, 95, 110)),
    mk('C', 'weak', false, plan(100, 95, 110)),
  ]);
  const mechs = rows.map(r => r.mechanic);
  ok(mechs.join(',') === 'VOTE-STRONG,VOTE-MODERATE,VOTE-WEAK',
     'one pool per tier, not one undifferentiated bag — got ' + mechs.join(', '));
  ok(new Set(mechs).size === 3, 'the tiers do not collapse together');
  const noTier = W.__csFwdRows([mk('D', null, false, plan(100, 95, 110))]);
  ok(noTier[0].mechanic === 'VOTE-WEAK', 'a missing tier defaults to weak rather than undefined');
}

console.log('== ticket marks the HIGH-QUALITY cohort ==');
{
  const rows = W.__csFwdRows([
    mk('HQ', 'strong', true, plan(100, 95, 110)),
    mk('LQ', 'weak', false, plan(100, 95, 110)),
  ]);
  ok(rows[0].ticket === true && rows[1].ticket === false,
     'the split that lets someone later ask whether the strongest claim paid');
}

console.log('== a MISSING level is dropped, never recorded as zero ==');
{
  /* the bug this suite exists for: +null === 0 and isFinite(0) === true */
  for (const [label, p] of [
    ['stop null', plan(1, null, 2)],
    ['stop empty string', plan(1, '', 2)],
    ['stop undefined', { entry: 1, t1: 2 }],
    ['entry null', plan(null, 95, 110)],
    ['t1 null', plan(100, 95, null)],
  ]) {
    const rows = W.__csFwdRows([mk('X', 'weak', false, p)]);
    ok(rows.length === 0, label + ' → row dropped, not coerced to a zero level');
  }
  const mixed = W.__csFwdRows([
    mk('GOOD', 'strong', true, plan(100, 95, 110)),
    mk('NULLSTOP', 'weak', false, plan(1, null, 2)),
  ]);
  ok(mixed.length === 1 && mixed[0].sym === 'GOOD', 'one bad row does not discard the good ones');
  ok(mixed.every(r => r.stop !== 0), 'no record carries a fabricated zero stop');
}

console.log('== unscoreable and malformed setups are refused ==');
{
  ok(W.__csFwdRows([mk('ZERORISK', 'weak', false, plan(10, 10, 12))]).length === 0,
     'entry === stop is unscoreable in R and would divide by zero downstream');
  ok(W.__csFwdRows([{ sym: 'NOPLAN', dir: 'long' }]).length === 0, 'no plan → no record');
  ok(W.__csFwdRows([{ dir: 'long', plan: plan(100, 95, 110) }]).length === 0, 'no symbol → no record');
  ok(W.__csFwdRows([{ sym: 'NODIR', plan: plan(100, 95, 110) }]).length === 0, 'no direction → no record');
}

console.log('== horizon comes from the plan the card printed ==');
{
  ok(W.__csFwdHorizon([mk('A', 'weak', false, plan(1, 2, 3, 24))]) === 24, 'uses the plan timeoutBars');
  ok(W.__csFwdHorizon([mk('A', 'weak', false, plan(1, 2, 3, 40))]) === 40, 'honours a different expiry');
  ok(W.__csFwdHorizon([mk('A', 'weak', false, plan(1, 2, 3))]) === 24, 'falls back when absent');
  ok(W.__csFwdHorizon([]) === 24 && W.__csFwdHorizon(null) === 24, 'empty and null are safe');
}

console.log('== degenerate input never throws ==');
{
  ok(JSON.stringify(W.__csFwdRows(null)) === '[]', 'null → []');
  ok(JSON.stringify(W.__csFwdRows([])) === '[]', 'empty → []');
  ok(JSON.stringify(W.__csFwdRows([null, undefined])) === '[]', 'holes → []');
}

console.log('== the recorder is actually wired into the scan, not merely defined ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'cryptoscan.js'), 'utf8');
  ok(/hgFwdRecordScan\('CRYPTO SCAN', '15m'/.test(src),
     "runScan calls hgFwdRecordScan under the tab name the dashboard will group by");
  ok(/csFwdRows\(setups\)/.test(src), 'it uses the tested builder rather than a second inline copy');
}

console.log('\ntest-cryptoscan-forward: ' + passed + ' assertions passed');
