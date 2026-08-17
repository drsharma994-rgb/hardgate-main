/* HARDGATE — the position-size worksheet approved trades that cannot win.

   Found by the coverage measurement from v340: risk-tab.js, 169 lines of
   position sizing, is referenced by no test at all. Executing the calculator
   behind it turned up a defect that matters more than most, because this is
   the one screen where the numbers are HAND-TYPED — entry, stop and target
   are all keyed in by the reader.

   hgCryptoPositionRisk checked that entry and stop were valid and different,
   and nothing else about the geometry. So:

     long  entry 100, stop 98,  T1 95   ->  gross -2.5R,  RISK PASS, no reasons
     short entry 100, stop 102, T1 110  ->  gross -5R,    RISK PASS
     long  entry 100, stop 106, T1 98   ->  gross -0.33R, RISK PASS

   That last one is the stop and the target transposed, which is the likeliest
   typo on a form with three price fields next to each other. The tab answered
   "RISK PASS — Sizing, liq clearance, and net-R clear the bar."

   Sizing arithmetic works on any three numbers. It cannot tell you those
   numbers describe a trade. The geometry is now checked before the money is.

   Run: node tests/test-position-risk.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  ctx.window = ctx; ctx.globalThis = ctx;
  const store = {};
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'crypto-position-risk.js'), 'utf8'), ctx,
    { filename: 'crypto-position-risk.js' });
  return ctx;
}

const W = boot();
const R = W.hgCryptoPositionRisk;
const CTX = { balance: 10000, riskPct: 1 };

console.log('== the calculator is reachable ==');
{
  ok(typeof R === 'function', 'hgCryptoPositionRisk is exported');
  ok(typeof W.hgCryptoFixedRiskSize === 'function', 'the sizing helper is exported');
  ok(typeof W.hgCryptoBreakevenWinRate === 'function', 'the breakeven helper is exported');
}

console.log('\n== THE DEFECT: a trade that cannot win is no longer approved ==');
{
  const cannotWin = [
    ['long target below entry',  { dir: 'long',  entry: 100, stop: 98,  t1: 95 },  /not above entry/],
    ['long target equal entry',  { dir: 'long',  entry: 100, stop: 98,  t1: 100 }, /not above entry/],
    ['short target above entry', { dir: 'short', entry: 100, stop: 102, t1: 110 }, /not below entry/],
    ['short target equal entry', { dir: 'short', entry: 100, stop: 102, t1: 100 }, /not below entry/]
  ];
  for (const [name, plan, re] of cannotWin){
    const r = R(plan, CTX);
    ok(r.ok === false, name + ': declined rather than sized');
    ok(re.test(r.reason || ''), name + ': the reason says why (' + r.reason + ')');
    ok(r.pass !== true, name + ': never reports RISK PASS');
  }
}

console.log('\n== THE TYPO: stop and target transposed ==');
{
  /* Three price fields in a row; this is the mistake the form invites. */
  const swapped = R({ dir: 'long', entry: 100, stop: 106, t1: 98 }, CTX);
  ok(swapped.ok === false, 'a long with the stop ABOVE entry is declined');
  ok(/transposed/.test(swapped.reason || ''), 'and the reason names the likely cause (' + swapped.reason + ')');

  const swappedShort = R({ dir: 'short', entry: 100, stop: 98, t1: 106 }, CTX);
  ok(swappedShort.ok === false, 'a short with the stop BELOW entry is declined');
  ok(/transposed/.test(swappedShort.reason || ''), 'with the same explanation');
}

console.log('\n== legitimate worksheets still size ==');
{
  const long = R({ dir: 'long', entry: 100, stop: 98, t1: 106 }, CTX);
  ok(long.ok === true, 'a normal long sizes');
  ok(Math.abs(long.riskAmountUSD - 100) < 1e-9, 'risk is balance x riskPct exactly ($' + long.riskAmountUSD + ')');
  ok(Math.abs(long.positionSizeUnits - 50) < 1e-9, 'qty is risk / |entry - stop| (' + long.positionSizeUnits + ')');
  ok(Math.abs(long.grossR - 3) < 1e-9, 'gross R is |t1 - entry| / |entry - stop| (' + long.grossR + ')');
  ok(long.netR < long.grossR, 'net R is below gross R once costs are taken');
  ok(long.breakevenWinRate > 0 && long.breakevenWinRate < 1,
    'the breakeven win rate is a real probability (' + (long.breakevenWinRate * 100).toFixed(1) + '%)');

  const short = R({ dir: 'short', entry: 100, stop: 102, t1: 94 }, CTX);
  ok(short.ok === true, 'a normal short sizes');
  ok(Math.abs(short.grossR - 3) < 1e-9, 'direction does not change the geometry (' + short.grossR + ')');

  /* Sizing WITHOUT a target is legitimate — you can size a trade before you
     have picked where to take profit. */
  const noTarget = R({ dir: 'long', entry: 100, stop: 98, t1: null }, CTX);
  ok(noTarget.ok === true, 'sizing with no target is still allowed');
  ok(noTarget.grossR === null, 'and reports no gross R rather than inventing one');
  ok(noTarget.breakevenWinRate === null, 'and no breakeven, because there is no target to clear');
}

console.log('\n== breakeven is the real algebra, not a rule of thumb ==');
{
  /* p*(gross - cost) = (1-p)*(1 + cost)  =>  p = (1 + cost)/(gross + 1) */
  const be = W.hgCryptoBreakevenWinRate;
  ok(Math.abs(be(1, 0) - 0.5) < 1e-9, 'a costless 1R needs 50% (' + be(1, 0) + ')');
  ok(Math.abs(be(3, 0) - 0.25) < 1e-9, 'a costless 3R needs 25% (' + be(3, 0) + ')');
  ok(be(3, 0.2) > be(3, 0), 'costs raise the bar, never lower it');
  ok(be(0, 0) === null, 'a zero-reward trade has no breakeven to state');
  ok(be(null, 0) === null, 'and a missing gross R yields null rather than a number');
}

console.log('\n== the arithmetic holds across a spread of inputs ==');
{
  let checked = 0;
  for (const dir of ['long', 'short']){
    for (const stopPct of [0.001, 0.005, 0.02, 0.1, 0.5]){
      for (const rr of [1, 2, 5]){
        const entry = 100;
        const stop = dir === 'long' ? entry * (1 - stopPct) : entry * (1 + stopPct);
        const risk = Math.abs(entry - stop);
        const t1 = dir === 'long' ? entry + risk * rr : entry - risk * rr;
        const r = R({ dir, entry, stop, t1 }, CTX);
        const tag = dir + '/' + stopPct + '/' + rr + 'R';
        ok(r.ok === true, tag + ': sizes');
        ok(Math.abs(r.grossR - rr) < 1e-6, tag + ': gross R matches the geometry (' + r.grossR + ')');
        ok(r.positionSizeUnits > 0, tag + ': quantity is positive');
        ok(r.notionalUSD > 0, tag + ': notional is positive');
        ok(r.impliedLeverage > 0, tag + ': implied leverage is positive');
        ok(Math.abs(r.notionalUSD - r.positionSizeUnits * entry) < 0.01,
          tag + ': notional equals qty x entry');
        ok(r.netR <= r.grossR + 1e-9, tag + ': net R never exceeds gross R');
        checked++;
      }
    }
  }
  ok(checked === 30, 'thirty combinations were actually exercised (' + checked + ')');
}

console.log('\n== degenerate input declines rather than improvising ==');
{
  for (const [name, plan] of [
    ['entry equals stop', { dir: 'long', entry: 100, stop: 100, t1: 110 }],
    ['null stop',         { dir: 'long', entry: 100, stop: null, t1: 110 }],
    ['null entry',        { dir: 'long', entry: null, stop: 98, t1: 110 }],
    ['zero entry',        { dir: 'long', entry: 0, stop: -1, t1: 10 }]
  ]){
    const r = R(plan, CTX);
    ok(r.ok === false, name + ': declined');
    ok(typeof r.reason === 'string' && r.reason.length > 5, name + ': with a stated reason (' + r.reason + ')');
  }
  let threw = null;
  try { R(null, null); } catch (e) { threw = e; }
  ok(!threw, 'a null plan does not throw');
}

console.log('\n== the RISK tab renders whatever the calculator returns ==');
{
  const tab = fs.readFileSync(path.join(ROOT, 'risk-tab.js'), 'utf8');
  ok(/risk\.ok === false/.test(tab), 'the tab has a declined path');
  ok(/risk && risk\.reason \? risk\.reason/.test(tab), 'and shows the calculator reason rather than a generic message');
  ok(/RISK PASS/.test(tab) && /RISK HOLD/.test(tab), 'it distinguishes pass from hold');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL POSITION-RISK TESTS PASSED');
