/* HARDGATE — every WIDE stop warning on the desk was measured against the
   wrong entry.

   A live gold card read:

     ENTRY 4366.19 · STOP 4388.13
     stop: lastSwing(20) buffered 0.25xATR14 — WIDE (4.2xATR, beyond the
     2.5xATR guide)
     PASS vol-alive ATR 0.329% of price

   Those two statements cannot both be true. 21.94 points of stop against an
   ATR of 0.329% of 4366 is 1.53xATR, not 4.2x. I chased the two ATR
   implementations first — omnigold's atrOf is a simple mean of 14 true
   ranges, indicators.js atr() is Wilder smoothing — and measured them across
   steady, expanding, spiking and contracting tapes. They never diverge more
   than 1.5x. That was not it, and I said so and dropped it.

   What made it findable was moving hgPlanLevels out of index.html: before
   that, no harness could build a card WITH a plan, so no test could ever see
   both numbers at once. With plans reachable, 1,470 gold cards printed both
   figures and they agreed 5% of the time — median 1.95x apart, worst 4.71x.
   The live 2.75x sat squarely inside that.

   THE CAUSE, traced through hgPlanLevelsCore:

     st   = hgStructureStop(dir, entry, rows, opts)   <- note written here
     plan.note = st.note
     exactPl   = hgApplyExactEntry(plan, rows, ...)   <- THE ENTRY MOVES
     return exactPl                                    <- note carried unchanged

   On the traced case hgStructureStop measured risk 50.790 and wrote
   "2.6xATR"; after the exact-entry adjustment the card's own |entry - stop|
   was 38.099, which is 1.75xATR. The note described a geometry the card no
   longer had.

   This is not cosmetic. The WIDE clause is the card's only warning that a
   stop sits outside policy, and a reader sizing off it was being told a stop
   was more than twice as wide as it is — or, in the other direction, not
   warned about one that had become wide.

   Deliberately NOT a new decline: a plan that already passed hgStructureStop
   is not withdrawn on re-measurement, because removing setups is the opposite
   of what this work is for.

   Run: node tests/test-stop-note-restate.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PLANS = read('plans.js');

function boot(withDesks){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  const files = ['indicators.js','indicators2.js','fixpack14-core.js','plans.js'];
  if (withDesks) files.push('hg-mechanics.js','hg-forward.js','hg-gates.js','hg-plan.js',
                            'omniroute.js','omnigold.js');
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const W = boot(false);

const PLAIN = 'stop: lastSwing(20) buffered 0.25×ATR14';
const WIDE  = PLAIN + ' — WIDE (4.2×ATR, beyond the 2.5×ATR guide); R:R is measured against this real invalidation';

console.log('== a warning that is no longer true is removed ==');
{
  ok(typeof W.hgRestateStopNote === 'function', 'hgRestateStopNote is exported');
  const out = W.hgRestateStopNote(WIDE, 10, 15, 2.5);   /* 1.5xATR */
  ok(!/WIDE/.test(out), 'a stop that ends up at 1.5xATR is no longer flagged WIDE');
  ok(out === PLAIN, 'and the note reverts to its plain form exactly: ' + out);
}

console.log('\n== a warning that BECAME true is added ==');
{
  /* The other direction matters just as much: the exact-entry adjustment can
     widen the stop as well as narrow it, and the reader was not being told. */
  const out = W.hgRestateStopNote(PLAIN, 10, 40, 2.5);  /* 4.0xATR */
  ok(/WIDE \(4\.0×ATR/.test(out), 'a stop that ends up at 4.0xATR IS flagged, though it started inside the guide');
  ok(/beyond the 2\.5×ATR guide/.test(out), 'quoting the guide it passed');
  ok(/real invalidation/.test(out), 'and what the R:R is measured against');
}

console.log('\n== a warning that is still true is restated, not left stale ==');
{
  const out = W.hgRestateStopNote(WIDE, 10, 31, 2.5);   /* 3.1xATR, was 4.2 */
  ok(/WIDE \(3\.1×ATR/.test(out), 'the multiple is corrected to the final geometry (3.1x)');
  ok(!/4\.2×ATR/.test(out), 'and the pre-adjustment figure is gone');
  ok((out.match(/WIDE/g) || []).length === 1, 'with exactly one WIDE clause, never two');
}

console.log('\n== notes that describe something else are left alone ==');
{
  const capped = 'stop capped: structure beyond 2.5×ATR — 1.5×ATR14 (TIGHTENED off structure)';
  const fb = 'stop: 1.5×ATR14 (lastSwing unavailable)';
  ok(W.hgRestateStopNote(capped, 10, 40, 2.5) === capped, 'a capped note is untouched');
  ok(W.hgRestateStopNote(fb, 10, 40, 2.5) === fb, 'a fallback note is untouched');
  ok(W.hgRestateStopNote('', 10, 40, 2.5) === '', 'an empty note stays empty');
}

console.log('\n== degenerate input never rewrites anything ==');
{
  for (const [a, r] of [[0,10],[NaN,10],[10,0],[10,NaN],[null,null],[undefined,5],[-3,10]]){
    ok(W.hgRestateStopNote(WIDE, a, r, 2.5) === WIDE,
       'atr=' + a + ' risk=' + r + ' leaves the note exactly as it was');
  }
  for (const bad of [null, undefined, 0]){
    let threw = null;
    try { W.hgRestateStopNote(bad, 10, 40, 2.5); } catch (e){ threw = e; }
    ok(!threw, 'note=' + JSON.stringify(bad) + ' does not throw');
  }
  /* A missing capDist must fall back to the module default, not to NaN. */
  ok(/WIDE \(4\.0×ATR, beyond the 2\.5×ATR guide\)/.test(W.hgRestateStopNote(PLAIN, 10, 40)),
     'with no capDist it uses HG_STOP_CAP_DIST_ATR (2.5)');
}

console.log('\n== the core wires it in AFTER the entry moves ==');
{
  ok(/exactPl\.note = hgRestateStopNote\(exactPl\.note, st\.atr,/.test(PLANS),
     'hgPlanLevelsCore restates the note on the exact-entry plan');
  ok(/Math\.abs\(\+exactPl\.entry - \+exactPl\.stop\)/.test(PLANS),
     'against the FINAL entry and stop, not the ones the note was written for');
  ok(PLANS.indexOf('hgApplyExactEntry(plan, rows') < PLANS.indexOf('exactPl.note = hgRestateStopNote'),
     'and only after hgApplyExactEntry has moved the entry');
  ok(/DESCRIBED A GEOMETRY THE CARD NO LONGER HAS/.test(PLANS), 'the reason is recorded in the source');
  ok(/NOT a new decline/.test(PLANS), 'including that it deliberately withdraws no plan');
}

console.log('\n== end to end: the note and the card now agree ==');
{
  const D = boot(true);
  function tape(n, seed, mode, burst){
    const out = []; let p = 4350, s = seed;
    const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
    for (let i = 0; i < n; i++){
      const b = (burst && i >= n - burst.bars) ? burst.mult : 1;
      const d = mode==='trend'?0.07:mode==='down'?-0.07:0;
      p = p*(1+(rnd()-0.48+d)*0.0025*b);
      const r = p*0.0013*(0.5+rnd())*b;
      out.push({ t: 1700000000+i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v:900+rnd()*800 });
    }
    return out;
  }
  let checked = 0, disagreed = 0, worst = 0;
  for (let s = 1; s <= 40; s++){
    for (const mode of ['trend','down','range']){
      for (const burst of [null, { bars: 8, mult: 4 }]){
        const rows = tape(400, s, mode, burst);
        let hits; try { hits = D.hgOgDetect(rows, {}); } catch (e){ continue; }
        if (!hits || !hits.length) continue;
        let cands;
        try { cands = D.hgOgEvaluate(rows, hits, { adr:{usedPct:40} },
                { minRr:1.5, horizonBars:24, warm:60, label:'SCALP' }); } catch (e){ continue; }
        for (const c of (cands||[])){
          if (!c.plan) continue;
          const m = /\(([\d.]+)×ATR, beyond/.exec(String(c.plan.note || ''));
          if (!m) continue;                       /* no WIDE clause to check */
          const va = (c.gates||[]).filter(g => g && g.key === 'vol-alive')[0];
          const am = va && /ATR ([\d.]+)% of price/.exec(String(va.why));
          if (!am) continue;
          checked++;
          const gateAtr = parseFloat(am[1]) / 100 * (+c.plan.entry);
          const cardMult = Math.abs(+c.plan.entry - +c.plan.stop) / gateAtr;
          const noteMult = parseFloat(m[1]);
          const ratio = noteMult / cardMult;
          if (Math.abs(ratio - 1) > 0.35) disagreed++;
          if (Math.abs(ratio - 1) > worst) worst = Math.abs(ratio - 1);
        }
      }
    }
  }
  /* Every surviving WIDE clause must now match the card's own entry and stop,
     to within the difference between the two ATR definitions (~1.1-1.5x). */
  ok(disagreed === 0, 'no card whose note says WIDE disagrees with its own entry/stop'
     + ' (checked ' + checked + ', worst ' + (1 + worst).toFixed(2) + 'x)');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL STOP NOTE RESTATEMENT TESTS PASSED');
