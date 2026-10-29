#!/usr/bin/env node
/* test-gold-pricing-accuracy-v1460 — the pricing-accuracy round's contract.

   hg-v1460 ships the exact-pricing pass over the gold setup pricing core:

     1. calculatePositionSize rounds the taken size DOWN to the 0.001 unit
        step, never to nearest — toFixed(3) nearest-rounding could take a
        size ABOVE the raw risk budget, so realized risk (size x stop
        distance) could exceed riskAmountUSD. After the fix, realized risk
        <= budget on every input, and the notional is recomputed from the
        TAKEN size so the two published numbers agree.
     2. hgGoldTickPx — the venue 0.01 tick snap the mint sites call.
     3. hgGoldPlanPricingOk — the exact-pricing audit of a PUBLISHED plan:
        geometry per direction, published rr == exact |TP1-entry|/|entry-stop|
        within half a display tick, published risk == exact |entry-stop|,
        TP2 beyond TP1; off-tick levels are NAMED (offTick) without flipping
        ok. Named, never gating — no desk reads it to withhold a setup.
     4. hgGoldScalpStopFloor snaps the minted floored stop to the tick and
        re-derives the published rr from the SNAPPED stop (the drop decision
        stays keyed to the floor distance — the measured gate is untouched).
     5. goldProPlan snaps every minted level and publishes rr1/rr2 as the
        exact ratio of the published levels (with clean 2dp inputs the plan
        is bit-identical to the pre-v1460 one).
     6. the shipped build is stamped hg-v1460 on every cache surface.

   Mutation-proven: restoring the toFixed(3) sizing, loosening the rr-drift
   bar, deleting the geometry leg, or un-snapping the scalp floor mint each
   red a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8'), { filename: 'goldind.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'goldpro.js'), 'utf8'), { filename: 'goldpro.js' });
const W = globalThis.window;

/* ============ 1. position sizing can never exceed the risk budget ============ */
{
  const pos = W.calculatePositionSize(10000, 1, 2645.11, 2643.42);
  ok(pos && !pos.error, 'sizing: built for a clean budget case');
  ok(pos.riskAmountUSD === 100, 'sizing: budget = 1% of 10000 = $100');
  ok(Math.abs(pos.stopDistanceUSD - 1.69) < 1e-9, 'sizing: stop distance $1.69');
  ok(Math.abs(pos.positionSizeUnits - 59.171) < 1e-9,
     'sizing: taken ' + pos.positionSizeUnits + ' units = FLOORED raw 59.1715976 (toFixed(3) would take 59.172)');
  const realized = pos.positionSizeUnits * pos.stopDistanceUSD;
  ok(realized <= pos.riskAmountUSD + 1e-9,
     'sizing: realized risk $' + realized.toFixed(6) + ' <= budget $100 (the pre-v1460 nearest-rounded 59.172 realized $100.00068)');
  ok(Math.abs(pos.notionalValueUSD - pos.positionSizeUnits * 2645.11) <= 0.005,
     'sizing: notional is recomputed from the taken size, not the raw one');

  /* fuzz: no input may overspend the budget */
  let fuzzBad = 0, zeroErr = 0;
  let seed = 14601;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 500; i++){
    const bal = 500 + rnd() * 200000;
    const pct = 0.1 + rnd() * 2;
    const entry = 1500 + rnd() * 2500;
    const dist = 0.5 + rnd() * 60;
    const dir = rnd() < 0.5 ? 1 : -1;
    const stop = entry + dir * dist;
    const p = W.calculatePositionSize(bal, pct, entry, stop);
    if (p.error){ zeroErr++; continue; }
    const budget = bal * (pct / 100);
    if (p.positionSizeUnits * p.stopDistanceUSD > budget + 1e-9) fuzzBad++;
    if (Math.abs(p.positionSizeUnits * 1000 - Math.round(p.positionSizeUnits * 1000)) > 1e-6) fuzzBad++;
  }
  ok(fuzzBad === 0, 'sizing fuzz: 500 random inputs, zero budget overspends, every size on the 0.001 step');

  const zErr = W.calculatePositionSize(100, 0.1, 2645.11, 2645.11 + 99999);
  ok(zErr && zErr.error && /0.001 unit step/.test(zErr.error), 'sizing: the sub-step error names the step');
}

/* ============ 2. the venue tick snap ============ */
{
  ok(W.hgGoldTickPx(2643.4166666) === 2643.42, 'tick: 2643.4166666 snaps to 2643.42');
  ok(W.hgGoldTickPx(2642.035) === 2642.04 || W.hgGoldTickPx(2642.035) === 2642.03,
     'tick: a half-cent mint lands ON the tick either way, never sub-cent');
  ok(W.hgGoldTickPx(2645.11) === 2645.11, 'tick: an on-tick price is identity');
  ok(isNaN(W.hgGoldTickPx(NaN)) && isNaN(W.hgGoldTickPx('junk')), 'tick: unreadable input stays NaN, never 0');
}

/* ============ 3. the exact-pricing audit ============ */
{
  const good = W.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2643.42, t1: 2650.11, t2: 2653.11, rr: 2.95858, risk: 1.69 });
  ok(good.ok === true, 'audit: an internally exact plan passes (rr |t1-e|/|e-s| = 2.95858)');
  ok(Array.isArray(good.drifts) && good.drifts.length === 0 && good.offTick.length === 0, 'audit: no drifts, nothing off-tick');

  const rrDrift = W.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2643.42, t1: 2650.11, rr: 2.0 });
  ok(rrDrift.ok === false && rrDrift.drifts.some(d => /rr 2 vs exact/.test(d)),
     'audit: a published rr that disagrees with the published levels is named (2.0 vs exact '
     + (Math.abs(2650.11 - 2645.11) / 1.69).toFixed(4) + ')');

  const riskDrift = W.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2643.42, t1: 2650.11, rr: 2.95858, risk: 2.5 });
  ok(riskDrift.ok === false && riskDrift.drifts.some(d => /risk 2\.5 vs exact 1\.69/.test(d)), 'audit: a published risk that disagrees with the levels is named');

  const offTick = W.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.115, stop: 2643.425, t1: 2650.115 });
  ok(offTick.ok === true && offTick.offTick.length === 3, 'audit: sub-cent levels are NAMED in offTick without flipping ok (structural passthrough stays legal)');

  const wrongSide = W.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2647.00, t1: 2650.11 });
  ok(wrongSide.ok === false && wrongSide.drifts.some(d => /geometry/.test(d)), 'audit: stop on the reward side is a geometry drift');

  const ladder = W.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2643.42, t1: 2650.11, t2: 2649.00 });
  ok(ladder.ok === false && ladder.drifts.some(d => /TP2 not beyond TP1/.test(d)), 'audit: an inverted TP ladder is named');

  const shortPlan = W.hgGoldPlanPricingOk({ dir: 'short', entry: 2645.11, stop: 2647.11, t1: 2641.11, t2: 2638.61, rr: 2, risk: 2 });
  ok(shortPlan.ok === true, 'audit: an exact short plan passes');

  const minimal = W.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2643.42 });
  ok(minimal.ok === true, 'audit: absent t1/rr/risk fields are absent checks, not failures');

  const junk = W.hgGoldPlanPricingOk(null);
  ok(junk.ok === false && junk.drifts[0] === 'no plan', 'audit: null plan refuses with a named drift');
}

/* ============ 4. the scalp stop-floor mint is snapped ============ */
{
  /* entry 2645.11, a15 = 2.05 -> floor distance 3.075 -> raw mint
     2642.035 (sub-cent). t1 = entry + 4 -> rr at the floored stop
     4 / 3.075 = 1.3008 >= the 1.2 GS_MIN_RR bar, so the plan FLOORS
     (does not drop) and the mint path runs. */
  const a15 = 2.05, e = 2645.11;
  const c = { dir: 'long', entry: e, stop: e - 1.0, t1: e + 4, t2: e + 6, stratKey: 'sweep', stamps: [] };
  const out = W.hgGoldScalpStopFloor ? W.hgGoldScalpStopFloor(c, a15) : null;
  ok(out && out.stamps.indexOf('STOP FLOORED 1.5×ATR') >= 0, 'scalp floor: the plan floored (raw stop 1.0 < 3.075 floor, rr at floor 1.30 >= 1.2)');
  ok(Math.abs(out.stop - Math.round(out.stop * 100) / 100) < 1e-9,
     'scalp floor: published stop ' + out.stop + ' is ON the venue tick (the raw mint was 2642.035)');
  const exactRr = Math.abs(out.t1 - out.entry) / Math.abs(out.entry - out.stop);
  ok(Math.abs(out.rr - exactRr) < 1e-9, 'scalp floor: published rr ' + out.rr.toFixed(6) + ' is the exact ratio of the published levels');
  ok(Math.abs(out.rr2 - Math.abs(out.t2 - out.entry) / Math.abs(out.entry - out.stop)) < 1e-9, 'scalp floor: rr2 re-derived from the snapped stop too');
  ok(!out.dropped, 'scalp floor: the drop decision still ran on the floor distance — the measured gate is untouched');
}

/* ============ 5. goldProPlan mints snapped, exact-ratio levels ============ */
{
  const gp = W.goldProPlan({ dir: 'long', entry: 2700.004, atr: 6.007 });
  ok(gp && gp.dir === 'long', 'goldpro: plan built from a dirty (sub-cent) input');
  const lv = [gp.entry, gp.stop, gp.t1, gp.t2];
  ok(lv.every(x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6),
     'goldpro: every minted level is on the venue tick (' + lv.join(', ') + ')');
  ok(Math.abs(gp.rr1 - Math.abs(gp.t1 - gp.entry) / Math.abs(gp.entry - gp.stop)) < 1e-9,
     'goldpro: rr1 is the exact ratio of the published levels, not a hardcoded 2');
  ok(Math.abs(gp.rr2 - Math.abs(gp.t2 - gp.entry) / Math.abs(gp.entry - gp.stop)) < 1e-9,
     'goldpro: rr2 is the exact ratio of the published levels');
  ok(Math.abs(gp.risk - Math.abs(gp.entry - gp.stop)) < 1e-9, 'goldpro: published risk = |entry - stop| of the snapped levels');
  const audit = W.hgGoldPlanPricingOk(gp);
  ok(audit.ok === true && audit.offTick.length === 0, 'goldpro: the shipped plan passes its own exact-pricing audit clean');
  /* clean 2dp inputs stay bit-identical to the pre-v1460 plan */
  const clean = W.goldProPlan({ dir: 'short', entry: 2300, atr: 4 });
  ok(clean.stop === 2306 && clean.t1 === 2288 && clean.t2 === 2279 && clean.rr1 === 2 && clean.rr2 === 3.5,
     'goldpro: clean 2dp inputs reproduce the legacy plan bit-for-bit');
}

/* ============ 6. the shipped build is stamped hg-v1460 ============ */
{
  const stamp = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  ok(/version: 'hg-v1463'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-10-29T/.test(stamp), 'build-stamp built (non-decreasing)');
  ok(/hg-v1460: GOLD PRICING ACCURACY/.test(stamp), 'the pack string names the round');
  ok(/hg-v1459: GOLD forming watch/.test(stamp), 'the pack history chain carries the upstream hg-v1459 round');
  ok(/hg-v1458: CONFLUENCE accuracy round/.test(stamp), 'and the older chain is intact');
  ok(/HG_CACHE = 'hg-v1463'/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache id');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(idx.indexOf('?v=1458') < 0 && idx.indexOf('?v=1463') >= 0, 'index.html cache-busters all at 1460');
  ok(fs.readFileSync(path.join(ROOT, 'hg-api-base.js'), 'utf8').indexOf('1458') < 0, 'hg-api-base at 1460');
  ok(fs.readFileSync(path.join(ROOT, 'trendtable.js'), 'utf8').indexOf('1458') < 0, 'trendtable loader at 1460');
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'batch-ledger.json'), 'utf8'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1463', 'the batch ledger last entry is hg-v1460');
}

/* ============ mutations ============ */
/* Each mutation re-runs the mutated build and is CAUGHT when a pinned
   assertion of the sections above FAILS under it. checker returns true when
   the pinned assertion it mirrors now fails. */
{
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const bootCtx = () => {
    const ctx = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, Date, Intl, RegExp, parseFloat, parseInt, console: { log(){}, warn(){}, error(){} } };
    ctx.window = ctx; vm.createContext(ctx);
    return ctx;
  };

  const runMutation = (name, file, mutate, checker) => {
    const src = read(file);
    const m = mutate(src);
    if (m === src){ fail++; console.error('  FAIL mutation ' + name + ' did not change source'); return; }
    const ctx = bootCtx();
    if (file !== 'goldind.js') vm.runInContext(read('goldind.js'), ctx, { filename: 'goldind.js' });
    vm.runInContext(m, ctx, { filename: file.replace(/\.js$/, '-mutated.js') });
    const caught = checker(ctx) === true;
    if (caught){ pass++; console.log('  ok — mutation ' + name + ' caught'); }
    else { fail++; console.error('  FAIL mutation ' + name + ' survived'); }
  };

  /* M1: sizing back to nearest-rounding -> the budget case overspends -> §1 red */
  runMutation('M1_sizing_rounds_up', 'goldind.js',
    s => s.replace('var takenUnits = Math.floor(rawPositionSize * 1000 + 1e-6) / 1000;',
      'var takenUnits = Number(rawPositionSize.toFixed(3));'),
    ctx => {
      const p = ctx.calculatePositionSize(10000, 1, 2645.11, 2643.42);
      return !(p && !p.error
        && Math.abs(p.positionSizeUnits - 59.171) < 1e-9
        && p.positionSizeUnits * p.stopDistanceUSD <= p.riskAmountUSD + 1e-9);
    });

  /* M2: the audit's rr-drift bar loosened beyond the pinned drift -> §3 red */
  runMutation('M2_rr_drift_bar_loosened', 'goldind.js',
    s => s.replace('Math.abs(rrPub - exactRr) > 0.005 + 1e-9', 'Math.abs(rrPub - exactRr) > 2 + 1e-9'),
    ctx => ctx.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2643.42, t1: 2650.11, rr: 2.0 }).ok === true);

  /* M3: the audit's geometry leg dropped -> the wrong-side plan passes -> §3 red */
  runMutation('M3_geometry_leg_dropped', 'goldind.js',
    s => s.replace("var sides = hgGoldPlanSidesOk({ dir: plan.dir, entry: e, stop: s, t1: t1 });\n    if (!sides.ok){ out.ok = false; out.drifts.push('geometry: ' + sides.why); }", '/* M3 */'),
    ctx => ctx.hgGoldPlanPricingOk({ dir: 'long', entry: 2645.11, stop: 2647.00, t1: 2650.11 }).ok === true);

  /* M4: the scalp floor mint un-snapped -> the published stop goes sub-cent -> §4 red */
  runMutation('M4_floor_mint_unsnapped', 'goldind.js',
    s => s.replace('c.stop = hgGoldTickPx(stopMint);', 'c.stop = stopMint;'),
    ctx => {
      const out = ctx.hgGoldScalpStopFloor({ dir: 'long', entry: 2645.11, stop: 2644.11, t1: 2649.11, t2: 2651.11, stratKey: 'sweep', stamps: [] }, 2.05);
      return !(out && Math.abs(out.stop * 100 - Math.round(out.stop * 100)) < 1e-9);
    });

  /* M5: goldpro's mint un-snapped -> levels go sub-cent -> §5 red */
  runMutation('M5_goldpro_mint_unsnapped', 'goldpro.js',
    s => s.replace("var tick = (W && typeof W.hgGoldTickPx === 'function') ? W.hgGoldTickPx : function(x){ return Math.round(+x * 100) / 100; };",
                   'var tick = function(x){ return +x; };'),
    ctx => {
      const gp = ctx.goldProPlan({ dir: 'long', entry: 2700.004, atr: 6.007 });
      return !(gp && [gp.entry, gp.stop, gp.t1, gp.t2].every(x => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6));
    });
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
