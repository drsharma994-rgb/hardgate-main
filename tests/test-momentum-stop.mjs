/* HARDGATE — the momentum stop: the trade v381 removed, put back with its
   name on.

   Four sessions of "why does the scalp setup have no entry, SL and TP" were
   one policy gap. In a runaway trend the nearest swing sits many ATR behind
   the market — measured live at 8-9xATR — so the structural plan engine
   declines, and the desk takes nothing precisely in the conditions breakout
   mechanics exist for. Meanwhile the walk-forward pool's OWN stop model
   (hgOmniBtStop) falls back to a 1.5xATR stop when structure is unusable —
   disclosed in every pool footer — so the in-sample numbers measure trades
   the live desk refused to take.

   v381 removed the ATR fallback because it was SILENT: presented as
   structure, claiming 2R against risk 53% smaller than real invalidation.
   The lie was the defect, not the volatility stop. The momentum stop returns
   under four conditions, each asserted here:

     1. the caller must OPT IN (momentumOk: true) — and the gold desk grants
        it to CONTINUATION mechanics only, never fades: a fade's premise IS
        the level, and a fade without structure has no premise
     2. only where structure is genuinely beyond reach (past maxDist xATR) —
        a placeable structural stop always wins
     3. the note names it: "MOMENTUM STOP ... This is a volatility stop, NOT
        invalidation"
     4. the ledger flags it AGAINST (info) so the compromise is on the card

   THE FLAG DIED TWICE ON THE WAY IN, and both killings are pinned. First
   hgApplyExactEntry builds a fresh plan object and dropped momentumStop;
   then the hgPlanLevels wrapper's fixed field list dropped it again — the
   same list that once dropped rr1/rr2. Either loss re-created the exact
   disguise v381 removed: a volatility stop rendered as [structure] with the
   AGAINST never firing.

   Run: node tests/test-momentum-stop.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PLANS = read('plans.js');
const PLANJS = read('hg-plan.js');
const GOLD = read('omnigold.js');

function boot(){
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
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

/* A runaway rally: relentless drift so no pivot low prints anywhere near
   price — the exact tape that produced 8-9xATR structural distances live. */
function runaway(n, seed){
  const out = []; let p = 4200, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd()*0.5 + 0.25) * 0.004);   /* every bar drifts up */
    const r = p * 0.0010 * (0.5 + rnd());
    out.push({ t: 1700000000+i*3600, o: p-r*0.25, h: p+r, l: p-r, c: p, v: 1000 });
  }
  return out;
}
/* A tape WITH nearby structure. */
function structured(n, seed){
  const out = []; let p = 4200, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd()-0.5)*0.0025);
    const r = p * 0.0014 * (0.5 + rnd());
    out.push({ t: 1700000000+i*3600, o: p-r*0.25, h: p+r, l: p-r, c: p, v: 1000 });
  }
  return out;
}
const RUN = runaway(300, 7);
const STR = structured(300, 5);
const atrOf = rows => { const a = W.atr(rows, 14);
  for (let i = a.length - 1; i >= 0; i--) if (isFinite(a[i])) return a[i]; return NaN; };

console.log('== the runaway tape really has no reachable structure ==');
{
  const a = atrOf(RUN), e = RUN[RUN.length-1].c, sw = W.lastSwing(RUN, 'long', 20);
  const mult = (e - (sw - 0.25*a)) / a;
  ok(mult > 6, 'the nearest long swing sits ' + mult.toFixed(1) + 'xATR away — past the 6x limit');
}

console.log('\n== opt-in: without the flag, the decline stands ==');
{
  ok(W.hgPlanLevels('long', RUN, undefined, { minRr: 1.5, capMode: 'structure' }) === null,
     'no momentumOk means no plan, exactly as before');
  ok(W.hgPlanLevels('long', RUN, undefined, { minRr: 1.5, capMode: 'structure', momentumOk: false }) === null,
     'and momentumOk:false is the same');
}

console.log('\n== opted in, the momentum plan forms and says what it is ==');
{
  const pl = W.hgPlanLevels('long', RUN, undefined, { minRr: 1.5, capMode: 'structure', momentumOk: true });
  ok(!!pl, 'a plan forms where the desk previously had nothing');
  ok(pl.momentumStop === true, 'flagged momentumStop — through core, exact-entry AND the wrapper');
  ok(/MOMENTUM STOP/.test(String(pl.note)), 'the note leads with its name');
  ok(/volatility stop,\s*NOT invalidation/i.test(String(pl.note).replace(/\n/g,' ')) || /NOT invalidation/.test(String(pl.note)),
     'and says it is not invalidation: ' + String(pl.note).slice(0, 70));
  ok(/no structure within \d+×ATR/.test(String(pl.note)), 'naming why it exists');
  ok(isFinite(+pl.entry) && isFinite(+pl.stop) && isFinite(+pl.t1), 'with full entry, SL and TP');
  const rr = Math.abs(+pl.t1 - +pl.entry) / Math.abs(+pl.entry - +pl.stop);
  /* minRr is a FLOOR: exact-entry may build a richer target (live scalp cards
     have always shown 2.00R on a 1.5R floor), and that satisfies it. */
  ok(rr >= 1.5 - 1e-6, 'and the R floor is honoured against the REAL risk taken (' + rr.toFixed(2) + 'R >= 1.5R)');
}

console.log('\n== where structure IS reachable, structure wins ==');
{
  const pl = W.hgPlanLevels('long', STR, undefined, { minRr: 1.5, capMode: 'structure', momentumOk: true });
  ok(!!pl, 'the structured tape plans');
  ok(pl.momentumStop !== true, 'WITHOUT the momentum flag — a placeable structural stop always wins');
  ok(!/MOMENTUM STOP/.test(String(pl.note)), 'and the note does not claim one');
}

console.log('\n== the gold desk grants it to continuation only, never fades ==');
{
  ok(/momentumOk: !hgOgIsReversion\(hit\.kind\)/.test(GOLD),
     'the flag is the inverse of the reversion classification');
  ok(/a fade's premise IS the level/i.test(GOLD.replace(/\n/g, ' ')) || /Fades never get one/.test(GOLD),
     'with the reason recorded');
}

console.log('\n== the ledger shows the compromise ==');
{
  const g = (plan) => W.hgOgGates(STR, { dir:'long', kind:'ORB', mech:'ORB' }, { plan: plan })
                       .filter(x => x && x.key === 'momentum-stop')[0];
  const m = g({ entry: 4300, stop: 4270, t1: 4345, momentumStop: true });
  ok(m.pass === false && m.info !== true, 'a momentum plan is a real VETO — visible and fatal for tickets');
  ok(/VOLATILITY stop, not structure/.test(m.why), 'saying what it is: ' + m.why.slice(0, 60));
  const st = g({ entry: 4300, stop: 4270, t1: 4345 });
  ok(st.pass === true, 'a structural plan passes');
  ok(/rests on structure/.test(st.why), 'and says so');
  const noPlan = g(null);
  ok(noPlan && noPlan.pass === null, 'no plan reads UNCHECKED — this gate judges stops, not absence');
  ok(/no plan to judge/.test(noPlan.why), 'and says so');
  /* Min-loss: a volatility stop cannot TICKET. */
  const graded = W.hgOmniGrade([{ key:'trend', hard:true, pass:true, why:'ok' },
    { key:'momentum-stop', hard:false, info:false, pass:false, why:'volatility stop' }]);
  ok(graded.ticket === false, 'a momentum-stop veto stops the ticket');
}

console.log('\n== the flag survived its two assassins, pinned at the source ==');
{
  ok(/if \(st\.momentumStop === true\)\{\s*\n\s*exactPl\.momentumStop = true;/.test(PLANS),
     'hgApplyExactEntry\'s fresh object gets the flag re-attached');
  ok(/momentumStop: pl\.momentumStop === true/.test(PLANJS),
     'and the wrapper\'s fixed field list forwards it');
  ok(/MOMENTUM STOP/.test(PLANS.slice(PLANS.indexOf('function hgRestateStopNote'), PLANS.indexOf('function hgRestateStopNote') + 2200)),
     'and the note restatement skips MOMENTUM notes, so one is never rewritten as WIDE-structural');
  ok(/opts\.momentumOk === true/.test(PLANS), 'the engine only grants it on explicit opt-in');
}

console.log('\n== degenerate inputs never produce a half-plan ==');
{
  for (const rows of [[], [{}], RUN.slice(0, 10)]){
    let threw = null, pl = null;
    try { pl = W.hgPlanLevels('long', rows, undefined, { minRr: 1.5, capMode: 'structure', momentumOk: true }); }
    catch (e){ threw = e; }
    ok(!threw, 'rows=' + rows.length + ' does not throw');
    ok(pl === null || (isFinite(+pl.entry) && isFinite(+pl.stop) && +pl.entry !== +pl.stop),
       '   and returns null or a complete plan');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL MOMENTUM STOP TESTS PASSED');
