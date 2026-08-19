/* HARDGATE — the fallback plan engine kept the one answer the codebase had
   already named as wrong.

   hgPlanLevels (index.html) delegates to hgPlanLevelsCore when plans.js has
   loaded, and falls back to its own geometry when it has not. Four lines
   above the fallback, its own comment records a fix:

     "The options argument used to be missing here, so every caller that
      passed one — OMNIGOLD passes { minRr: cfg.minRr } — had it silently
      dropped and got a hardcoded 2R policy plus crypto stop defaults it could
      not tune. Forwarded now."

   The fallback directly below it went on hardcoding 2R. So a gold SCALP setup
   on a 1.5R floor was handed 2R targets, while measured-edge judged the
   mechanic against the 1.5R breakeven of 40% rather than 2R's 33.3% — the
   target the plan set and the bar the ledger judged by were different
   numbers.

   The second defect is the more expensive one. On a structural stop beyond
   2.5xATR the fallback MOVED THE STOP IN to a flat 1.5xATR and took the trade
   anyway. plans.js removed exactly that from hgStructureStop and named it:

     "Measured on gold-shaped 1h data, that fired on 65% of setups. The stop
      landed 53% closer than the level that would actually invalidate the
      idea — inside normal noise — and, because R:R is computed against the
      risk distance, the card then advertised 2.00R for a trade worth 0.96R
      against real invalidation. A 2.08x overstatement, and a stop placed
      where it will be hit. That is the one wrong answer available here."

   Fixed there, left here — in the path every caller lands on precisely when
   plans.js is missing, which is also when nothing else is around to catch it.

   The fallback now keeps the structural stop and lets the R:R gate judge it
   on true risk, declines beyond 6xATR as HG_STOP_MAX_DIST_ATR does, and
   honours the caller's R floor.

   Run: node tests/test-plan-fallback.mjs */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* The engine lives in hg-plan.js now; index.html only loads it. */
const SRC = readFileSync(path.join(ROOT, 'hg-plan.js'), 'utf8');
const HTML = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Pull hgPlanLevels out of index.html and run it with hgPlanLevelsCore
   DELIBERATELY ABSENT — that is the fallback path, and it is the only way to
   exercise it, because whenever plans.js loads the core takes over. */
function bootFallback(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, RegExp, Error };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  /* Real helpers: indicators.js supplies atr and lastSwing. */
  vm.runInContext(readFileSync(path.join(ROOT, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
  /* indicators.js already supplies last(); redeclaring it throws. */
  /* applyExactEntry also lives in index.html; the fallback's last act is to
     call it. Identity here keeps this test about the geometry. */
  /* hg-plan.js brings its own applyExactEntry; without plans.js it finds no
     hgApplyExactEntry and returns the plan unchanged, which is the shim's job. */
  /* hg-plan.js, loaded WITHOUT plans.js, so hgPlanLevelsCore is absent and the
     fallback is what runs. That is the only way to reach this path. */
  vm.runInContext(readFileSync(path.join(ROOT, 'hg-plan.js'), 'utf8'), ctx, { filename: 'hg-plan.js' });
  return ctx;
}
const W = bootFallback();
ok(typeof W.hgPlanLevels === 'function', 'hgPlanLevels is available');
ok(typeof W.hgPlanLevelsCore !== 'function', 'and hgPlanLevelsCore is ABSENT — this is the fallback path');

/* A tape whose last swing sits a controllable distance from price, so the
   stop geometry can be aimed rather than fished for. */
function tape(n, swingDrop){
  const out = []; let p = 4350, s = 11;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd()-0.5)*0.0016);
    const r = p * 0.0010 * (0.5+rnd());
    out.push({ t: 1700000000+i*3600, o: p-r*0.25, h: p+r, l: p-r, c: p, v: 1000 });
  }
  /* Punch a swing low `swingDrop` below the close, inside the 30-bar window. */
  if (swingDrop > 0){
    const k = out.length - 12, base = out[out.length-1].c;
    out[k].l = base - swingDrop;
    out[k].o = out[k].c = base - swingDrop*0.4;
    out[k-1].l = Math.min(out[k-1].l, base - swingDrop*0.8);
    out[k+1].l = Math.min(out[k+1].l, base - swingDrop*0.8);
  }
  return out;
}
/* indicators.js declares last() lexically, so it is not on the vm global;
   pick the final finite value here instead. */
const atrOf = rows => { const a = W.atr(rows, 14);
  for (let i = a.length - 1; i >= 0; i--) if (isFinite(a[i])) return a[i];
  return NaN; };

console.log('\n== DEFECT 1: the fallback ignored the caller\'s R floor ==');
{
  const rows = tape(300, 0);
  const at2  = W.hgPlanLevels('long', rows, undefined, { minRr: 2 });
  const at15 = W.hgPlanLevels('long', rows, undefined, { minRr: 1.5 });
  const at3  = W.hgPlanLevels('long', rows, undefined, { minRr: 3 });
  ok(at2 && at15 && at3, 'all three produce a plan');
  const rr = pl => (pl.t1 - pl.entry) / pl.risk;
  ok(Math.abs(rr(at2) - 2) < 1e-9, 'minRr 2 gives a 2.00R target');
  ok(Math.abs(rr(at15) - 1.5) < 1e-9, 'minRr 1.5 gives a 1.50R target — OMNIGOLD SCALP\'s floor');
  ok(Math.abs(rr(at3) - 3) < 1e-9, 'minRr 3 gives a 3.00R target');
  ok(rr(at15) !== rr(at2), 'the floor now changes the target, which it did not before');
  /* T2 keeps its original proportion to T1. */
  for (const pl of [at2, at15, at3]){
    const r1 = (pl.t1 - pl.entry) / pl.risk, r2 = (pl.t2 - pl.entry) / pl.risk;
    ok(Math.abs(r2 / r1 - 1.75) < 1e-9, 'T2 stays 1.75x T1 (' + r1.toFixed(2) + 'R -> ' + r2.toFixed(2) + 'R)');
  }
  /* No option at all must keep the 2R behaviour it always had. */
  ok(Math.abs(rr(W.hgPlanLevels('long', rows, undefined, undefined)) - 2) < 1e-9,
     'with no opts it still defaults to 2R');
  ok(Math.abs(rr(W.hgPlanLevels('long', rows, undefined, { minRr: 0 })) - 2) < 1e-9,
     'and a zero floor falls back to 2R rather than a zero-width target');
}

console.log('\n== DEFECT 2: a far stop was moved IN, falsifying the risk ==');
{
  const rows = tape(300, 0);
  const a = atrOf(rows);
  /* Put the swing ~4xATR away: past the 2.5xATR guide, inside the 6xATR limit. */
  const far = tape(300, 4 * a);
  const pl = W.hgPlanLevels('long', far, undefined, { minRr: 2 });
  ok(!!pl, 'a 4xATR structural stop still produces a plan');
  const mult = pl.risk / atrOf(far);
  ok(mult > 2.5, 'the stop stays out at ' + mult.toFixed(1) + 'xATR, on structure');
  ok(mult < 6, 'inside the 6xATR limit');
  ok(!/capped at 1\.5/.test(String(pl.note)), 'it is NOT capped to 1.5xATR any more');
  ok(/WIDE/.test(String(pl.note)), 'and the note says WIDE: ' + pl.note);
  ok(/real invalidation/.test(String(pl.note)), 'naming what the stop is measured against');
  /* The overstatement this removes: a 1.5xATR stop on a 4xATR invalidation
     advertises R:R against risk that is not the real risk. */
  const honest = pl.risk, falsified = 1.5 * atrOf(far);
  ok(honest > falsified * 2, 'the old cap would have understated risk by '
     + (honest / falsified).toFixed(2) + 'x — the 2.08x class of overstatement plans.js measured');
}

console.log('\n== beyond 6xATR it declines rather than inventing geometry ==');
{
  /* Deepening the swing also inflates ATR, so the multiple cannot be aimed
     that way. entryOverride moves entry against a FIXED tape instead: risk
     grows, ATR does not. */
  const rows = tape(300, 0);
  const a = atrOf(rows);
  const base = W.hgPlanLevels('long', rows, undefined, { minRr: 2 });
  ok(!!base, 'the tape plans at its own close');
  const stop = base.stop;
  const at = mult => W.hgPlanLevels('long', rows, stop + mult * a, { minRr: 2 });
  ok(at(5) !== null, 'a 5xATR stop is inside the limit and produces a plan');
  ok(Math.abs(at(5).risk / a - 5) < 0.2, '   measuring ' + (at(5).risk / a).toFixed(1) + 'xATR');
  ok(/WIDE/.test(String(at(5).note)), '   and is flagged WIDE');
  ok(at(7) === null, 'a 7xATR stop returns null — no plan rather than a fabricated one');
  ok(at(9) === null, 'and so does 9xATR');
  ok(at(6.5) === null, 'the limit bites just past 6xATR');
}


console.log('\n== a too-TIGHT stop is still widened, which is the safe direction ==');
{
  const rows = tape(300, 0);
  const a = atrOf(rows);
  const pl = W.hgPlanLevels('long', rows, undefined, { minRr: 2 });
  ok(!!pl, 'a tape with no clean swing still plans');
  ok(pl.risk >= 0.5 * a, 'and the stop is never left inside half an ATR of entry');
  ok(pl.stop < pl.entry, 'a long stop sits below entry');
  const sh = W.hgPlanLevels('short', rows, undefined, { minRr: 2 });
  ok(sh.stop > sh.entry, 'a short stop sits above entry');
  ok(sh.t1 < sh.entry && sh.t2 < sh.t1, 'and short targets project downward in order');
}

console.log('\n== the geometry is internally consistent on every plan ==');
{
  const a0 = atrOf(tape(300, 0));
  for (const drop of [0, a0, 2*a0, 3*a0, 5*a0]){
    for (const dir of ['long','short']){
      for (const minRr of [1.5, 2, 3]){
        const pl = W.hgPlanLevels(dir, tape(300, drop), undefined, { minRr });
        if (!pl) continue;
        ok(isFinite(pl.entry) && isFinite(pl.stop) && isFinite(pl.t1) && isFinite(pl.t2) && isFinite(pl.risk),
           dir + ' ' + minRr + 'R @' + (drop/a0).toFixed(0) + 'xATR: every level is finite');
        ok(pl.risk > 0, '   risk is positive');
        ok(Math.abs(Math.abs(pl.entry - pl.stop) - pl.risk) < 1e-6, '   risk equals |entry-stop|');
        ok(Math.abs((Math.abs(pl.t1 - pl.entry) / pl.risk) - minRr) < 1e-6,
           '   T1 is exactly ' + minRr + 'R against that risk');
      }
    }
  }
}

console.log('\n== degenerate input never throws and never invents a plan ==');
{
  for (const bad of [null, undefined, [], [{}]]){
    let threw = null, out;
    try { out = W.hgPlanLevels('long', bad, undefined, { minRr: 2 }); } catch (e){ threw = e; }
    ok(!threw, 'rows=' + JSON.stringify(bad) + ' does not throw');
    ok(out === null || (out && isFinite(out.risk)), 'and returns null or a finite plan');
  }
  ok(W.hgPlanLevels('sideways', tape(300, 0), undefined, {}) === null, 'an unknown direction returns null');
}

console.log('\n== the source records why, so it is not tidied back ==');
{
  ok(/one wrong answer available here/.test(SRC), 'hg-plan.js carries the diagnosis plans.js wrote');
  ok(!/function hgPlanLevels\(/.test(HTML), 'and index.html no longer defines the engine at all');
  ok(/HONOUR THE CALLER'S R FLOOR/.test(SRC), 'and the R-floor fix names itself');
  ok(!/stop capped at 1\.5×ATR \(structure too far\)/.test(SRC), 'the tightening note is gone');
  ok(/risk > 6\*a/.test(SRC), 'the 6xATR decline mirrors HG_STOP_MAX_DIST_ATR');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL PLAN FALLBACK TESTS PASSED');
