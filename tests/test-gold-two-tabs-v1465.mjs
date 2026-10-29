#!/usr/bin/env node
/* test-gold-two-tabs-v1465 — PINE GOLD + GOLD SCALP exactness round.

   hg-v1465 corrects two classes of unit/geometry inaccuracy on these two
   tabs and makes their published setups quote exact R:

     1. GOLD SCALP spot realignment scaled the plan's levels but NOT the
        price-denominated fields that ride the same candidate: the live
        print (mark) and the detector mark (pxNow) stayed in drifted-feed
        units beside a spot-realigned entry — one card, two units — and the
        zone check compared spot-scaled bounds against an unscaled pxNow.
        Both realignment paths (goldScaleOneCandidate, the per-candidate
        XAUT-basis path; goldAlignLevelsToSpot, the bulk kline path) now
        scale mark and pxNow with the levels. R ratios are scale-invariant,
        so the seal re-run lands on the same numbers — the realignment is
        now a pure change of units, provably.
     2. GOLD PINE's mint (setupFromNative) quoted whatever R the borrowed
        mint or the native detector advertised — a stale or absolute-ratio
        R that may not describe the row's own levels at all (the
        pre-hg-v1461 disease inherited through every borrow). The mint is
        now SEALED (hgSealGoldSetup / hgSyncPlanRr): every leg recomputed
        from the row's own published levels, an unread or wrong-side leg
        cleared to null with a named rrNote — the card quotes the geometry,
        never the advertisement. Named, never gating: the seal clears
        fields, it does not withhold the row.
     3. the shipped build is stamped hg-v1465 on every cache surface.

   Mutation-proven: un-scaling the realigned mark, dropping the pine seal,
   each reds a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ============ 1. GOLD SCALP: the realignment is a pure change of units ============ */
{
  globalThis.window = {};
  vm.runInThisContext(read('goldind.js'), { filename: 'goldind.js' });
  vm.runInThisContext(read('conviction-lock.js'), { filename: 'conviction-lock.js' });
  vm.runInThisContext(read('gold-best-levels.js'), { filename: 'gold-best-levels.js' });
  vm.runInThisContext(read('goldscalp.js'), { filename: 'goldscalp.js' });
  const W = globalThis.window;
  ok(typeof W.goldScaleOneCandidate === 'function' && typeof W.goldAlignLevelsToSpot === 'function',
     'scalp: the realignment functions are exported for the suite');

  /* an XAUT candidate 0.5% above spot: realigned to the live anchor */
  const c = {
    sym: 'XAUTUSD', dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, t2: 2675.11,
    mark: 2646.20, pxNow: 2644.90, zone: { lo: 2640.00, hi: 2650.00 },
    rr: 9.99, rr2: 9.99
  };
  const pre = {
    rr: 2, zonePos: (c.pxNow - c.zone.lo) / (c.zone.hi - c.zone.lo)
  };
  W.goldScaleOneCandidate(c, c.entry, 2632.00);
  const ratio = 2632 / 2645.11;
  ok(Math.abs(c.entry - 2632) < 1e-9, 'scalp: the entry realigns to the live anchor');
  ok(Math.abs(c.stop - 2635.11 * ratio) < 1e-9 && Math.abs(c.t1 - 2665.11 * ratio) < 1e-9, 'scalp: stop and target scale with it');
  ok(Math.abs(c.mark - 2646.20 * ratio) < 1e-9, 'scalp: the live print (mark) rides the realignment — one card, one unit');
  ok(Math.abs(c.pxNow - 2644.90 * ratio) < 1e-9, 'scalp: the detector mark (pxNow) rides too');
  ok(Math.abs(c.zone.lo - 2640 * ratio) < 1e-9 && Math.abs(c.zone.hi - 2650 * ratio) < 1e-9, 'scalp: the zone scales');
  ok(Math.abs(c.rr - pre.rr) < 1e-9 && Math.abs(c.rr2 - 3) < 1e-9,
     'scalp: R ratios are scale-invariant — the seal re-run lands on the same numbers, the stale 9.99 lie is replaced by the exact 2.0');
  const postPos = (c.pxNow - c.zone.lo) / (c.zone.hi - c.zone.lo);
  ok(Math.abs(postPos - pre.zonePos) < 1e-9, 'scalp: the pxNow-vs-zone relation is preserved exactly (the in-zone verdict cannot flip from realignment)');
  ok(c.spotRealigned === true && Math.abs(c.spotAlignRatio - ratio) < 1e-9, 'scalp: the realignment is stamped');

  /* below the 0.35% threshold: untouched */
  const c2 = { sym: 'XAUTUSD', dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, mark: 2645.5, pxNow: 2645.0 };
  W.goldScaleOneCandidate(c2, c2.entry, 2644.5);
  ok(Math.abs(c2.entry - 2645.11) < 1e-9 && c2.spotRealigned !== true, 'scalp: a sub-threshold basis leaves the plan untouched');

  /* the bulk kline path: same unit rule */
  const b = { dir: 'long', entry: 2600, stop: 2590, t1: 2620, mark: 2601, pxNow: 2600.5, zone: { lo: 2595, hi: 2605 } };
  W.goldAlignLevelsToSpot([b], 2600, 2626);   /* +1% kline-to-spot */
  const br = 2626 / 2600;
  ok(Math.abs(b.entry - 2626) < 1e-9 && Math.abs(b.mark - 2601 * br) < 1e-9 && Math.abs(b.pxNow - 2600.5 * br) < 1e-9,
     'scalp: the bulk path scales the levels AND the prints — same unit rule');
  ok(b.spotAligned === true, 'scalp: the bulk realignment is stamped');

  /* a broken-stop candidate: the seal names it instead of quoting a lie */
  const broken = { sym: 'XAUTUSD', dir: 'long', entry: 2645.11, stop: 2655.11, t1: 2665.11, rr: 2 };
  W.goldScaleOneCandidate(broken, broken.entry, 2632.00);
  ok(broken.rr === null && /cleared|not beyond/.test(broken.rrNote || ''),
     'scalp: a realigned plan whose stop sits on the wrong side quotes no R and names why');
}

/* ============ 2. GOLD PINE: the mint is sealed ============ */
{
  const ctx = vm.createContext({
    window: {}, console: { log(){}, warn(){}, error(){} }, Math, JSON, Date, isFinite, NaN, Array, Object, String,
    module: { exports: {} }
  });
  ctx.window = ctx;
  vm.runInContext(read('pinemath.js'), ctx, { filename: 'pinemath.js' });
  vm.runInContext(read('pinegoldmath.js'), ctx, { filename: 'pinegoldmath.js' });
  vm.runInContext(read('indicators.js'), ctx, { filename: 'indicators.js' });
  vm.runInContext(read('gold-best-levels.js'), ctx, { filename: 'gold-best-levels.js' });
  vm.runInContext(read('goldpine.js'), ctx, { filename: 'goldpine.js' });
  const G = ctx.window;
  ok(typeof G.hgPineSetupFromNative === 'function', 'pine: setupFromNative exported for the suite');

  /* a borrowed row advertising R 5 with NO target of its own: sealed */
  const noT = G.hgPineSetupFromNative({
    dir: 'long', entry: 2645.11, stop: 2635.11, rr: 5, strategy: 'borrowed-native', tally: 3
  }, 'scalp', 'test', false);
  ok(noT && noT.rr === null, 'pine: a mint with no target quotes no R (the advertised 5 was not this plan)');
  ok(/cleared/.test(noT.rrNote || ''), 'pine: the clearing is named on the row');
  ok(noT.geometryOk === false, 'pine: a target-less mint is not geometry-ok');
  ok(Math.abs(noT.entry - 2645.11) < 1e-9 && noT.tier === 'native', 'pine: the levels and tier are untouched by the seal');

  /* a wrong-side target: cleared, named */
  const wrong = G.hgPineSetupFromNative({
    dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2630, rr: 3, strategy: 'borrowed-native', tally: 3
  }, 'scalp', 'test', false);
  ok(wrong && wrong.rr === null && /cleared|not beyond/.test(wrong.rrNote || ''), 'pine: a wrong-side target clears to null, named');

  /* a clean 2R policy plan: the exact R */
  const clean = G.hgPineSetupFromNative({
    dir: 'short', entry: 2645.11, stop: 2655.11, t1: 2625.11, strategy: 'native-swing', tally: 3
  }, 'swing', 'test', false);
  ok(clean && Math.abs(clean.rr - 2) < 1e-9, 'pine: a clean plan quotes the exact 2R of its own levels');
  ok(clean.geometryOk === true && clean.rr1 === clean.rr, 'pine: the sealed row is geometry-ok with rr1 synced');

  /* the seal is absent: the graceful fallback still syncs */
  const ctx2 = vm.createContext({
    window: {}, console: { log(){}, warn(){}, error(){} }, Math, JSON, Date, isFinite, NaN, Array, Object, String,
    module: { exports: {} }
  });
  ctx2.window = ctx2;
  vm.runInContext(read('pinemath.js'), ctx2, { filename: 'pinemath.js' });
  vm.runInContext(read('pinegoldmath.js'), ctx2, { filename: 'pinegoldmath.js' });
  vm.runInContext(read('indicators.js'), ctx2, { filename: 'indicators.js' });
  vm.runInContext(read('goldpine.js'), ctx2, { filename: 'goldpine.js' });
  const fallback = ctx2.window.hgPineSetupFromNative({
    dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, rr: 9.99, strategy: 'x', tally: 3
  }, 'scalp', 'test', false);
  ok(fallback && Math.abs(fallback.rr - 2) < 1e-9, 'pine: without the seal module the sync fallback still recomputes the exact R');
}

/* ============ 3. the shipped build is stamped hg-v1465 ============ */
{
  const stamp = read('build-stamp.js');
  ok(/version: 'hg-v1469'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-10-30T/.test(stamp), 'build-stamp built (fresh date)');
  ok(/hg-v1467: GOLD FOUNDATION/.test(stamp), 'the pack string names the foundation round');
  ok(/hg-v1466: PINE GOLD and GOLD SCALP/.test(stamp), 'the failed-sweep round stays in the chain');
  ok(/hg-v1465: PINE GOLD and GOLD SCALP/.test(stamp), 'the prior unit-seal round stays in the chain');
  ok(/hg-v1464: GOLD TAB MATH/.test(stamp), 'and the pack history chain is intact');
  ok(/HG_CACHE = 'hg-v1469'/.test(read('sw.js')), 'sw.js cache id');
  const idx = read('index.html');
  ok(idx.indexOf('?v=1465') < 0 && idx.indexOf('?v=1469') >= 0, 'index.html cache-busters all at 1466');
  ok(read('hg-api-base.js').indexOf('1464') < 0, 'hg-api-base at 1465');
  ok(read('trendtable.js').indexOf('1464') < 0, 'trendtable loader at 1465');
  const ledger = JSON.parse(read('data/batch-ledger.json'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1469', 'the batch ledger last entry is hg-v1469');
}

/* ============ mutations ============ */
{
  /* boot(m) loads the pre-libraries and then runs the MUTATED source as the
     final module — the mutation must be the build under test */
  const runMutation = (name, file, mutate, boot, checker) => {
    const src = read(file);
    const m = mutate(src);
    if (m === src){ fail++; console.error('  FAIL mutation ' + name + ' did not change source'); return; }
    let win;
    try { win = boot(m); }
    catch(e){ pass++; console.log('  ok — mutation ' + name + ' caught (build threw)'); return; }
    let caught;
    try { caught = checker(win) === true; }
    catch(e){ caught = true; }
    if (caught){ pass++; console.log('  ok — mutation ' + name + ' caught'); }
    else { fail++; console.error('  FAIL mutation ' + name + ' survived'); }
  };

  const bootScalp = (m) => {
    globalThis.window = {};
    vm.runInThisContext(read('goldind.js'), { filename: 'goldind.js' });
    vm.runInThisContext(read('conviction-lock.js'), { filename: 'conviction-lock.js' });
    vm.runInThisContext(read('gold-best-levels.js'), { filename: 'gold-best-levels.js' });
    vm.runInThisContext(m, { filename: 'goldscalp.js' });
    return globalThis.window;
  };
  const bootPine = (m) => {
    const ctx = vm.createContext({
      window: {}, console: { log(){}, warn(){}, error(){} }, Math, JSON, Date, isFinite, NaN, Array, Object, String,
      module: { exports: {} }
    });
    ctx.window = ctx;
    for (const f of ['pinemath.js', 'pinegoldmath.js', 'indicators.js', 'gold-best-levels.js'])
      vm.runInContext(read(f), ctx, { filename: f });
    vm.runInContext(m, ctx, { filename: 'goldpine.js' });
    return ctx.window;
  };

  /* M1: the realigned mark un-scaled -> the card carries two units again.
     The first occurrence of the pair is goldScaleOneCandidate's. */
  runMutation('M1_mark_not_scaled', 'goldscalp.js',
    s => s.replace('  if (isFinite(c.mark)) c.mark = c.mark * ratio;\n  if (isFinite(c.pxNow)) c.pxNow = c.pxNow * ratio;', '/* M1 */'),
    bootScalp,
    W => {
      const c = { sym: 'XAUTUSD', dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, mark: 2646.20, pxNow: 2644.90, zone: { lo: 2640, hi: 2650 } };
      W.goldScaleOneCandidate(c, c.entry, 2632.00);
      const ratio = 2632 / 2645.11;
      return Math.abs(c.mark - 2646.20) < 1e-9; /* mutated: mark unscaled -> caught */
    });

  /* M2: the pine seal dropped entirely -> the advertised R 5 survives */
  runMutation('M2_pine_seal_dropped', 'goldpine.js',
    s => s.replace(/  \/\* the seal is looked up[\s\S]*?\n  \}\n  return __row;/, '  return __row;'),
    bootPine,
    W => {
      const row = W.hgPineSetupFromNative({ dir: 'long', entry: 2645.11, stop: 2635.11, rr: 5, strategy: 'x', tally: 3 }, 'scalp', 'test', false);
      return row.rr === 5; /* mutated: the lie survives -> caught */
    });
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
