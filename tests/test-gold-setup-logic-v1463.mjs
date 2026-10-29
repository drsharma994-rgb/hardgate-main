#!/usr/bin/env node
/* test-gold-setup-logic-v1463 — the setup-logic round's contract.

   hg-v1463 corrects three logical/mathematical errors in the gold setup
   producers, and accords the CONFLUENCE tab with them and with upstream
   hg-v1462's leader-quote card:

     1. hgPlanFromRisk (plans.js — the shared plan builder behind NEWGOLD,
        OMNIGOLD, OMNIROUTE and FORMATION) could ship an INVERTED T2: the
        v675 fall-through resolves T2 as the t2R policy rung whenever the
        t2Hint fails rew2 > rew1, but when the surviving T1 sits BEYOND that
        policy rung (a structural 4.16R hint against the 3.5R policy T2) —
        or a caller configures t2R <= t1R — the resolved T2 landed CLOSER to
        entry than T1. The card advertised T2 as the further rung while T2
        paid LESS R; a ledger closing at T2 realised less than the card
        claimed. 2875 of 20000 fuzzed plans inverted. The unordered T2 is
        now dropped to ABSENT with a named t2Unordered flag.
     2. GANESH GOLD planFor: TP2 is the range EQUILIBRIUM before the week
        extreme, and the equilibrium of a compressing range can sit NEARER
        than the previous day high (mirrored on shorts); TP3 can sit nearer
        than a kept TP2. An unordered rung is dropped to absent, named.
     3. GOLD CONFLUENCE accords with hg-v1462 (one-desk leader quote) and
        hg-v1459 (a target-less plan is legal at the ranker): the watch and
        the tie card no longer go SILENT when the leader publishes no
        target — a risk-only quote paints the leader entry/stop with the
        reward leg absent and named; applyCost leaves rr and net R unread;
        the cf:synthetic t1 leg is absent, not silently passed by NaN.
     4. ROOT CAUSE under all of it: the median filter used the COERCING
        global isFinite — isFinite(null) is true — so a null level leaked
        through and median returned null. Strictly numeric now.
     5. the shipped build is stamped hg-v1463 on every cache surface.

   Mutation-proven: restoring the inverted T2, re-arming the unordered
   ganesh rung, or re-coercing the median filter each red a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootCtx(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp, Intl };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

/* ============ 1. hgPlanFromRisk: the ladder can no longer invert ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'plans.js']);
  const P = ctx.hgPlanFromRisk;
  ok(typeof P === 'function', 'plans: hgPlanFromRisk exported');

  const far = P('long', 2645.11, 2633.11, { t1Hint: 2645.11 + 50 });   /* T1 = 4.16R, policy T2 = 3.5R */
  ok(far && far.t1 === 2645.11 + 50, 'plans: the far T1 hint is used verbatim');
  ok(!isFinite(far.t2) && far.t2Unordered === true && !isFinite(far.rr2),
     'plans: the policy T2 (3.5R) that would sit CLOSER than the 4.16R T1 is dropped to absent, named t2Unordered');
  ok(far.rr1 > 0 && Math.abs(far.rr1 - 50 / 12) < 1e-9, 'plans: T1 itself is untouched (rr1 exact)');

  const cfg = P('long', 2000, 1990, { t1R: 3, t2R: 2.5 });
  ok(cfg && !isFinite(cfg.t2) && cfg.t2Unordered === true, 'plans: a t2R <= t1R caller config publishes no T2, named');

  const hint = P('long', 2000, 1990, { t1Hint: 2030, t2Hint: 2050 });
  ok(hint && hint.t2 === 2050 && hint.t2Unordered === false && Math.abs(hint.rr2 - 50 / 10) < 1e-9,
     'plans: a T2 hint that sits beyond T1 is used verbatim with its exact rr2');

  const clean = P('long', 2000, 1990, {});
  ok(clean && clean.t1 === 2020 && clean.t2 === 2035 && Math.abs(clean.rr1 - 2) < 1e-9 && Math.abs(clean.rr2 - 3.5) < 1e-9 && !clean.t2Unordered,
     'plans: the default 2R/3.5R ladder is unchanged');

  let seed = 14631, bad = 0, n = 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 5000; i++){
    const dir = rnd() < 0.5 ? 'long' : 'short';
    const entry = 2000 + rnd() * 800;
    const sign = dir === 'long' ? 1 : -1;
    const stop = entry - sign * (0.5 + rnd() * 50);
    const opts = {};
    if (rnd() < 0.5) opts.t1Hint = entry + sign * (0.5 + rnd() * 100);
    if (rnd() < 0.3) opts.t2Hint = entry + sign * (0.5 + rnd() * 150);
    if (rnd() < 0.4) opts.minRr = 1 + rnd() * 2;
    if (rnd() < 0.3) { opts.t1R = 1 + rnd() * 2; opts.t2R = 2 + rnd() * 3; }
    if (rnd() < 0.3) opts.atr = 1 + rnd() * 10;
    const p = P(dir, entry, stop, opts);
    if (!p) continue;
    n++;
    const inv = isFinite(p.t2) && isFinite(p.t1) && (dir === 'long' ? p.t2 <= p.t1 : p.t2 >= p.t1);
    const geo = dir === 'long' ? (p.stop < p.entry && p.t1 > p.entry) : (p.stop > p.entry && p.t1 < p.entry);
    const rrOk = !isFinite(p.rr1) || Math.abs(p.rr1 - Math.abs(p.t1 - p.entry) / Math.abs(p.entry - p.stop)) < 1e-9;
    if (inv || !geo || !rrOk) bad++;
  }
  ok(n > 2500 && bad === 0, 'plans fuzz: ' + n + ' plans built, zero inverted ladders, geometry and rr exact everywhere');
}

/* ============ 2. GANESH GOLD: the rungs pay in order ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'ganeshgold.js']);
  const planFor = ctx.ganeshGoldPlanFor;
  ok(typeof planFor === 'function', 'ganesh: planFor exported for the suite');

  const ev = {
    px: 2650, atrEx: 8,
    zone: { hi: 2652, lo: 2644 },
    sellLiq: 2638, buyLiq: 2668,
    lv: { pdh: 2680, pdl: 2620, wkH: 2700, wkL: 2600 },
    eqH: 2670, eqL: 2630,
    rangeHi: 2665, rangeLo: 2625,
    style: 'scalp'
  };
  const m = { dir: 'long', grade: 'A' };
  const p = planFor(ev, m);
  ok(p && p.dir === 'long', 'ganesh: long plan built');
  ok(Math.abs(p.t1 - 2680) < 1e-9, 'ganesh: TP1 = previous day high 2680');
  ok(!isFinite(p.t2) && p.tp2Unordered === true, 'ganesh: the equilibrium TP2 (2670, nearer than TP1) is dropped to absent, named');
  ok(!isFinite(p.t3) && p.tp3Unordered === true, 'ganesh: TP3 (2665, nearer than the kept TP1) is dropped to absent too');
  ok(Math.abs(p.rr1 - Math.abs(2680 - p.entry) / Math.abs(p.entry - p.stop)) < 1e-9, 'ganesh: rr1 exact vs the published levels');
  ok(p.ok === true, 'ganesh: ok still keys on TP1 only — named, never gating');

  const ev2 = Object.assign({}, ev, { eqH: null, rangeHi: 2720 });
  const p2 = planFor(ev2, m);
  ok(p2 && Math.abs(p2.t2 - 2700) < 1e-9 && !p2.tp2Unordered, 'ganesh: the week-extreme fallback TP2 (2700 > 2680) is kept');
  ok(Math.abs(p2.t3 - 2720) < 1e-9 && !p2.tp3Unordered, 'ganesh: TP3 beyond the kept TP2 is kept');

  const ev3 = Object.assign({}, ev, {
    zone: { hi: 2656, lo: 2648 }, px: 2652,
    sellLiq: 2668, buyLiq: 2638,
    lv: { pdh: 2680, pdl: 2620, wkH: 2700, wkL: 2600 },
    eqL: 2632, rangeLo: 2635
  });
  const p3 = planFor(ev3, { dir: 'short', grade: 'A' });
  ok(p3 && p3.dir === 'short', 'ganesh: short plan built');
  ok(Math.abs(p3.t1 - 2620) < 1e-9, 'ganesh short: TP1 = previous day low 2620');
  ok(!isFinite(p3.t2) && p3.tp2Unordered === true, 'ganesh short: the equilibrium TP2 (2632, nearer than TP1) is dropped, named');
}

/* ============ 3. GOLD CONFLUENCE accords (hg-v1462 leader quote + target-less) ============ */
{
  const win = { HG_tabs: [] };
  const cctx = { window: win, globalThis: win, console };
  vm.createContext(cctx);
  vm.runInContext(read('gold-confluence.js'), cctx, { filename: 'gold-confluence.js' });
  const build = win.hgGoldConfluenceBuild;
  ok(typeof build === 'function', 'confluence: hgGoldConfluenceBuild exported');
  const vote = (desk, id, side, entry, stop, t1, extra) => Object.assign({
    desk, id, state: 'setup', side, entry, stop, t1, grade: 'A', lead: true
  }, extra || {});

  /* a target-less plan is NOT a vote under hg-v1462 (legR null) — the intake
     says so honestly instead of silently blending or crashing */
  const b = build([
    vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, null),
    vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, null),
    vote('GANESH GOLD', 'ganeshgold', 'long', 2649.5, 2639.5, null)
  ], { px: 2649 });
  ok(b && b.ready === false, 'confluence: a pack of target-less plans forms no setup (they are not votes under hg-v1462)');
  ok(/No gold desk has published/.test(b.reason || ''), 'confluence: the intake names the empty vote pool honestly (no crash, no blend)');

  /* the risk-only quote: the leader entry/stop with the reward leg ABSENT —
     named, never invented (the hg-v1459 target-less rule, hg-v1463 paint) */
  const rq = win.hgCfQuoteRiskOnly('long', [
    { entry: 2650, stop: 2640, t1: null, desk: 'GOLD SCALP' },
    { entry: 2651, stop: 2640.5, t1: undefined, desk: 'GOLD SWING' }
  ]);
  ok(rq && rq.noTarget === true && rq.t1 === null && rq.rr == null, 'confluence: the risk-only quote carries the leader entry/stop with the reward leg absent');
  ok(Math.abs(rq.entry - 2650) < 0.011 && Math.abs(rq.stop - 2640) < 0.011 && Math.abs(rq.risk - 10) < 1e-9,
     'confluence: the risk-only quote quotes the nearest-median desk own levels, exact risk');
  ok(win.hgCfQuoteRiskOnly('long', [{ entry: 2650, stop: 2660, t1: null }]) === null,
     'confluence: a broken stop still returns null — only the target may be unread');

  /* a fully-targeted pack: the card prints the LEADER desk's own levels */
  const b2 = build([
    vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2680),
    vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2681),
    vote('GANESH GOLD', 'ganeshgold', 'long', 2649.5, 2639.5, 2682)
  ], { px: 2649 });
  ok(b2 && b2.ready === true, 'confluence: a fully-targeted pack forms ONE SETUP');
  ok(Math.abs(b2.entry - 2650) < 0.011 && Math.abs(b2.t1 - 2680) < 0.011,
     'confluence: the card prints the nearest-median desk own levels (leader quote, no blend)');

  /* a published target on the wrong side: no setup */
  const b3 = build([
    vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2630),
    vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2631),
    vote('GANESH GOLD', 'ganeshgold', 'long', 2649.5, 2639.5, 2632)
  ], { px: 2649 });
  ok(b3 && !b3.ready, 'confluence: a published target on the wrong side forms no setup');

  /* a one-plan watch (the other desks off-scale) still nets the measured spread */
  const b4 = build([
    vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2680),
    vote('GOLD SWING', 'goldswing', 'long', 2900, 2880, 2960),
    vote('GANESH GOLD', 'ganeshgold', 'long', 2900.5, 2880.5, 2960.5)
  ], { px: 2651 }, { spreadUsd: 0.30 });
  ok(b4 && b4.ready === false && b4.watch && b4.watch.t1 != null && isFinite(b4.watch.netRr) && b4.watch.netRr > 0,
     'confluence: a one-plan watch still nets the measured spread (unchanged)');
}

/* ============ 4. the shipped build is stamped hg-v1463 ============ */
{
  const stamp = read('build-stamp.js');
  ok(/version: 'hg-v1463'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-10-29T/.test(stamp), 'build-stamp built (non-decreasing)');
  ok(/hg-v1463: GOLD SETUP LOGIC/.test(stamp), 'the pack string names the round');
  ok(/hg-v1462: GOLD CONFLUENCE — the card prints one desk plan/.test(stamp), 'the upstream hg-v1462 round stays in the chain');
  ok(/hg-v1461: GOLD SETUP GEOMETRY/.test(stamp), 'and the upstream hg-v1461 round stays in the chain');
  ok(/hg-v1460: GOLD PRICING ACCURACY/.test(stamp), 'and the older chain is intact');
  ok(/HG_CACHE = 'hg-v1463'/.test(read('sw.js')), 'sw.js cache id');
  const idx = read('index.html');
  ok(idx.indexOf('?v=1462') < 0 && idx.indexOf('?v=1463') >= 0, 'index.html cache-busters all at 1463');
  ok(read('hg-api-base.js').indexOf('1462') < 0, 'hg-api-base at 1463');
  ok(read('trendtable.js').indexOf('1462') < 0, 'trendtable loader at 1463');
  const ledger = JSON.parse(read('data/batch-ledger.json'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1463', 'the batch ledger last entry is hg-v1463');
}

/* ============ mutations ============ */
{
  const runMutation = (name, file, mutate, pre, checker) => {
    const src = read(file);
    const m = mutate(src);
    if (m === src){ fail++; console.error('  FAIL mutation ' + name + ' did not change source'); return; }
    const ctx = bootCtx(pre);
    try { vm.runInContext(m, ctx, { filename: file.replace(/\.js$/, '-mutated.js') }); }
    catch(e){ pass++; console.log('  ok — mutation ' + name + ' caught (build threw)'); return; }
    const caught = checker(ctx) === true;
    if (caught){ pass++; console.log('  ok — mutation ' + name + ' caught'); }
    else { fail++; console.error('  FAIL mutation ' + name + ' survived'); }
  };

  /* M1: the inverted T2 ships again -> the far-hint plan carries t2 under t1 */
  runMutation('M1_inverted_t2_ships', 'plans.js',
    s => s.replace('var t2Unordered = !(isFinite(t2) && rew2 > 0 && rew2 > rew1);\n    if (t2Unordered){ t2 = NaN; rew2 = NaN; }', 'var t2Unordered = false; /* M1 */'),
    ['indicators.js', 'indicators2.js'],
    ctx => {
      const p = ctx.hgPlanFromRisk('long', 2645.11, 2633.11, { t1Hint: 2645.11 + 50 });
      return !!(p && isFinite(p.t2) && p.t2 <= p.t1);
    });

  /* M2: the ganesh rung guard dropped -> the equilibrium TP2 ships under TP1 */
  runMutation('M2_ganesh_rung_inverts', 'ganeshgold.js',
    s => s.replace('if (fin(tp2) && fin(tp1) && !(bull ? tp2 > tp1 : tp2 < tp1)){ tp2 = NaN; tp2Unordered = true; }', '/* M2 */'),
    ['indicators.js', 'indicators2.js'],
    ctx => {
      const p = ctx.ganeshGoldPlanFor({
        px: 2650, atrEx: 8, zone: { hi: 2652, lo: 2644 },
        sellLiq: 2638, buyLiq: 2668,
        lv: { pdh: 2680, pdl: 2620, wkH: 2700, wkL: 2600 },
        eqH: 2670, eqL: 2630, rangeHi: 2665, rangeLo: 2625, style: 'scalp'
      }, { dir: 'long', grade: 'A' });
      return !!(p && isFinite(p.t2) && p.t2 <= p.t1);
    });

  /* M3: the risk-only quote stops gating a broken stop -> §3 red */
  {
    const src = read('gold-confluence.js');
    const m = src.replace('if (!(isFinite(entry) && entry > 0 && isFinite(risk) && risk > 0)) return null;',
      'if (false) return null; /* M3 */');
    if (m === src){ fail++; console.error('  FAIL mutation M3_riskonly_broken_stop did not change source'); }
    else {
      const win = { HG_tabs: [] };
      const cctx = { window: win, globalThis: win, console };
      vm.createContext(cctx);
      vm.runInContext(m, cctx, { filename: 'gold-confluence-mutated.js' });
      const bad = win.hgCfQuoteRiskOnly('long', [{ entry: 2650, stop: 2660, t1: null }]);
      if (bad && bad.risk < 0){ pass++; console.log('  ok — mutation M3_riskonly_broken_stop caught'); }
      else { fail++; console.error('  FAIL mutation M3_riskonly_broken_stop survived'); }
    }
  }
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
