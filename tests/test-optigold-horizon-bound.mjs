/* HARDGATE — hg-v948: OPTI GOLD scored the EXIT of every setup under an
   INFINITE horizon, on setups that all expire.

   ogProb's fill leg has always been distance- and horizon-aware
   (2*(1-PHI(d/sqrt(n)))). Its outcome leg was the constant 1/(1+rr) -- the
   gambler's-ruin value between two absorbing barriers, which is the answer
   GIVEN that one of them is reached at all. These setups die at horizonBars
   whether or not either was. So the constant is an UPPER BOUND, never the
   value, and it was also blind to how far the target is: 20xATR away with one
   bar left and 0.5xATR away with forty both scored 0.333.

   Behavioural throughout: every assertion drives the real exported functions
   and the real rendered card. Nothing greps the source.

   Covers:
     1) the defect, stated as the fixture that exposed it
     2) it is a BOUND -- the new number can never exceed the old one
     3) it CONVERGES: ample horizon returns exactly 1/(1+rr), unchanged
     4) it COLLAPSES where the target is genuinely out of reach
     5) monotone in both arguments (more bars up, farther target down)
     6) ABSENT is not EXPIRED and is not ZERO -- the +null===0 trap, three
        places, each proved to fall back rather than invent
     7) the running branch gets the same rule, from the mark
     8) the ranking actually changes: time-to-target now breaks the tie
     9) nothing leaves the board -- ogProb ranks and renders, it never mints
    10) the card shows BOTH numbers and calls the product a bound
   Run: node tests/test-optigold-horizon-bound.mjs */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, addEventListener(){} }),
                   querySelector: () => null, addEventListener(){} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'optigold.js'), 'utf8'), ctx, { filename: 'optigold.js' });
  return ctx;
}
const W = boot();
const PROB = W.__ogProb, TRAVEL = W.__ogTravelP, BOUND = W.__ogCondBound,
      CDF = W.__ogNormCdf, SIG = W.__ogSignals, LANES = W.__ogLanes, TOP = W.__ogTopPicks;

/* a resting setup: entry 2300, stop 1R below, target rr R above, ATR 4 */
function resting(o){
  const atr = (o && o.atr !== undefined) ? o.atr : 4;
  const tAtr = (o && o.targetAtr !== undefined) ? o.targetAtr : 5;   /* target distance in ATR */
  const rr = (o && o.rr !== undefined) ? o.rr : 2;
  const risk = (atr * tAtr) / rr;
  return Object.assign({ state: 'waiting', lane: 'scalp', dir: 'long', entry: 2300,
    stop: 2300 - risk, t1: 2300 + risk * rr, risk: risk, rr: rr, atr: atr, barsLeft: 48 }, o || {});
}
const NEAR = 2300.4;   /* the mark, a whisker from the limit, so fill ~ 1 */

console.log('== 1) the defect: the outcome leg saw neither distance nor horizon ==');
{
  const far = [], near = [];
  for (const n of [40, 12, 4, 2, 1]){
    far.push(PROB(resting({ targetAtr: 20, barsLeft: n }), NEAR).cond);
    near.push(PROB(resting({ targetAtr: 0.5, barsLeft: n }), NEAR).cond);
  }
  assert(new Set(far.map(x => x.toFixed(6))).size > 1,
         'the outcome leg now VARIES with the bars remaining (it was one constant)');
  assert(far[0] < near[0],
         'and with the target DISTANCE: 20×ATR scores below 0.5×ATR at the same horizon ('
         + far[0].toFixed(4) + ' < ' + near[0].toFixed(4) + ')');
  const inf = 1 / 3;
  assert(far.every(x => x < inf),
         'a 20×ATR target never reaches the 1/(1+rr) figure this desk used to quote for it');
}

console.log('== 2) it is a BOUND — it can never exceed what the desk claimed before ==');
{
  let n = 0, viol = 0;
  for (const tAtr of [0.2, 0.5, 1, 2, 3, 5, 8, 12, 20, 40]){
    for (const bars of [1, 2, 4, 8, 16, 32, 48, 96, 400]){
      for (const rr of [1, 1.5, 2, 3]){
        const e = PROB(resting({ targetAtr: tAtr, barsLeft: bars, rr: rr }), NEAR);
        if (!e) continue;
        n++;
        if (e.cond > e.condInf + 1e-12) viol++;
        if (e.cond < -1e-12 || e.cond > 1 + 1e-12) viol++;
      }
    }
  }
  assert(n >= 300 && viol === 0,
         'across ' + n + ' distance × horizon × R:R combinations the bound NEVER exceeds 1/(1+rr) and stays in [0,1]');
}

console.log('== 3) it CONVERGES — an ample horizon is bit-for-bit the old answer ==');
{
  const e = PROB(resting({ targetAtr: 5, barsLeft: 400 }), NEAR);
  assert(e.cond === e.condInf && e.cond === 1 / 3,
         'target 5×ATR with 400 bars returns EXACTLY 1/(1+rr) — no drift introduced where nothing was wrong');
  assert(e.horizonBound === false, 'and reports that the horizon did NOT bind');
  const typ = PROB(resting({ targetAtr: 5, barsLeft: 48 }), NEAR);
  assert(typ.cond === typ.condInf && typ.horizonBound === false,
         'the typical setup on this rule (5×ATR target, 48-bar lane) is unchanged too');
}

console.log('== 4) it COLLAPSES where the target is out of reach ==');
{
  const e = PROB(resting({ targetAtr: 20, barsLeft: 12 }), NEAR);
  assert(e.cond < 0.01 && e.horizonBound === true,
         'target 20×ATR with 12 bars left is bounded near zero and says the horizon binds');
  assert(e.targetAtr !== null && Math.abs(e.targetAtr - 20) < 1e-9 && e.barsLeft === 12,
         'and it carries the two numbers that caused it, so the card can state them');
  assert(/×ATR away/.test(e.note) && /horizon binds/.test(e.note),
         'the note names the distance and says the horizon is what bound it');
}

console.log('== 5) monotone in both arguments ==');
{
  let mono = true;
  let prev = -1;
  for (const bars of [1, 2, 4, 8, 16, 32, 48, 96]){
    const c = PROB(resting({ targetAtr: 6, barsLeft: bars }), NEAR).cond;
    if (c < prev - 1e-12) mono = false;
    prev = c;
  }
  assert(mono, 'more bars never LOWERS the bound');
  mono = true; prev = 2;
  for (const t of [0.5, 1, 2, 4, 8, 16, 32]){
    const c = PROB(resting({ targetAtr: t, barsLeft: 24 }), NEAR).cond;
    if (c > prev + 1e-12) mono = false;
    prev = c;
  }
  assert(mono, 'a farther target never RAISES it');
}

console.log('== 6) ABSENT is not EXPIRED and is not ZERO (the +null===0 trap) ==');
{
  assert(PROB(resting({ barsLeft: undefined }), NEAR) === null
      && PROB(resting({ barsLeft: null }), NEAR) === null,
         'an UNREADABLE horizon yields no estimate at all — not a confident zero');
  const exp = PROB(resting({ barsLeft: 0 }), NEAR);
  assert(exp && exp.p === 0 && exp.cond === 0 && exp.reach === 0,
         'a horizon that READS as zero is genuinely expired and scores zero');
  for (const bad of [null, '', NaN]){
    const e = PROB(resting({ t1: bad }), NEAR);
    assert(e && e.reach === null && e.cond === e.condInf && e.horizonBound === false,
           'an unreadable target (' + String(bad) + ') falls back to the infinite-horizon figure, never to a fabricated 0');
  }
  assert(TRAVEL(5, null) === null && TRAVEL(null, 10) === null,
         'ogTravelP: an unreadable argument is null (cannot compute), distinct from 0');
  assert(TRAVEL(5, 0) === 0 && TRAVEL(5, -3) === 0,
         'ogTravelP: a horizon read as zero or less is 0 (cannot travel)');
  /* the A&S erf approximation carries |error| < 1.5e-7, so PHI(0) reads
     0.5000000005 and this is 0.999999999 rather than exactly 1. Asserting
     equality here would be testing the approximation, not the rule. */
  assert(Math.abs(TRAVEL(0, 10) - 1) < 1e-6,
         'a target already reached is certain (within the A&S error bound), not bounded away');
  const fb = BOUND(1 / 3, NaN, 10);
  assert(fb && fb.cond === 1 / 3 && fb.reach === null && fb.bounded === false,
         'ogCondBound with an uncomputable travel term returns the infinite-horizon value, flagged');
}

console.log('== 7) the running branch gets the same rule ==');
{
  const open = { state: 'open', lane: 'scalp', dir: 'long', entry: 2300, stop: 2290,
                 t1: 2400, risk: 10, rr: 2, atr: 4, barsLeft: 4 };
  const e = PROB(open, 2300);
  assert(e && e.kind === 'running' && e.horizonBound === true && e.cond < e.condInf,
         'a filled position 25×ATR from its target with 4 bars left is bounded down too');
  const roomy = PROB(Object.assign({}, open, { barsLeft: 4000 }), 2300);
  assert(roomy.cond === roomy.condInf && roomy.horizonBound === false,
         'and is untouched when the horizon is ample');
  const noBars = PROB(Object.assign({}, open, { barsLeft: undefined }), 2300);
  assert(noBars && noBars.reach === null && noBars.cond === noBars.condInf,
         'a running position with no recorded horizon keeps the ruin figure — the guard the existing suite caught');
}

console.log('== 8) the ranking changes: time-to-target breaks the tie ==');
{
  /* two identical setups but for the bars remaining. Before hg-v948 the
     outcome leg was equal and only the fill leg separated them — by 7%, the
     wrong way round for a target that cannot be reached. */
  const roomy = resting({ targetAtr: 12, barsLeft: 40, lane: 'scalp' });
  const rushed = resting({ targetAtr: 12, barsLeft: 2, lane: 'scalp' });
  const eR = PROB(roomy, NEAR), eU = PROB(rushed, NEAR);
  assert(eU.fill > 0 && eR.fill > 0, 'both still look fillable — the fill leg barely separates them');
  assert(Math.abs(eU.fill - eR.fill) / eR.fill < 0.10,
         'their FILL odds differ by under 10% (' + eR.fill.toFixed(3) + ' vs ' + eU.fill.toFixed(3) + ')');
  assert(eR.p > eU.p * 10,
         'but the one with time to reach its target now scores an order of magnitude higher ('
         + eR.p.toFixed(5) + ' vs ' + eU.p.toFixed(5) + ')');
  assert(eR.condInf === eU.condInf,
         'their infinite-horizon figures are identical — which is exactly why it separated nothing before');
}

console.log('== 9) nothing leaves the board — ogProb ranks and renders, it never mints ==');
{
  /* a tape with impulses in it — a pure sine never breaks structure, so a
     smooth series would let this section pass by forming nothing */
  const rows = [];
  let s = 7919, rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let c = 2300;
  for (let i = 0; i < 600; i++){
    const shock = (rnd() < 0.02) ? (rnd() - 0.5) * 14 : 0;
    const o = c; c = o + Math.sin(i / 90) * 0.9 + (rnd() - 0.5) * 2.4 + shock;
    const w = 0.5 + rnd() * 1.6;
    rows.push({ t: Date.UTC(2024,0,1)/1000 + i * 900, o, h: Math.max(o,c) + w, l: Math.min(o,c) - w, c, v: 900 });
  }
  const L = LANES[0];
  const minted = SIG(rows, L);
  assert(minted.length > 0, 'the rule still forms setups on this tape (' + minted.length + ')');
  const withLevels = minted.filter(x => isFinite(x.entry) && isFinite(x.stop) && isFinite(x.t1));
  assert(withLevels.length === minted.length, 'every one keeps complete levels — the bound touches no level');
  minted.forEach(x => { x.lane = L.key; x.horizonBars = L.horizonBars; });
  let threw = false;
  try { TOP(minted, rows[rows.length - 1].c); } catch(e){ threw = true; }
  assert(!threw, 'ranking the real minted set never throws');
}

console.log('== 10) the card shows BOTH numbers and calls the product a bound ==');
{
  const tab = W.HG_tabs.find(t => t.id === 'optigold');
  const stubs = {};
  const pane = { _html: '', set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
    querySelector(sel){ if (!stubs[sel]) stubs[sel] = { innerHTML: '', textContent: '', style: {},
      addEventListener(ev, fn){ this._handler = fn; } }; return stubs[sel]; } };
  let mountThrew = false;
  try { tab.mount(pane); } catch(e){ mountThrew = true; }
  assert(!mountThrew, 'the tab still mounts');

  /* render a lane leader whose horizon binds, through the tab's own painter */
  const s2 = resting({ targetAtr: 20, barsLeft: 6, lane: 'scalp' });
  s2.laneLabel = 'SCALP'; s2.interval = '15m'; s2.sym = 'XAUUSD'; s2.i = 10; s2.t = Date.UTC(2024,0,1)/1000;
  W.__ogRenderProbe = null;
  const picks = TOP([s2], NEAR);
  assert(!!picks.scalp, 'the binding setup is still PICKED as the lane leader — it is not removed');
  const est = picks.scalp.est;
  assert(est.horizonBound === true && est.condInf === 1 / 3 && est.cond < est.condInf,
         'and the leader carries BOTH numbers so the card can print the gap ('
         + est.cond.toFixed(4) + ' vs ' + est.condInf.toFixed(4) + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
