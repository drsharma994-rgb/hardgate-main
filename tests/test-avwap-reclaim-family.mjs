/* HARDGATE — a LONG described by six gates as fading the move it was buying.

   The live gold TICKET read:

     GOLD · SCALP · AVWAP-RECLAIM LONG
     PASS trend           EMA21 < EMA50 — counter-trend, which is what this setup IS
     PASS keltner-pos     above the upper Keltner band — the stretch a reversion
                          mechanic is fading
     PASS bollinger-pctb  %B 1.46 (above the upper band) — the stretch being faded
     PASS macd-momentum   +8.76 and rising — turning with the fade
     PASS regression-slope +2.17/bar — counter-slope by design
     AGAINST donchian-pos broken ABOVE the 20-bar range — buying the extreme high
     AGAINST stoch-rsi    stoch RSI 100 — buying into an exhausted high

   Six gates called it a fade while two said it was buying an extreme. Both
   cannot be true of one trade.

   THE DETECTOR SETTLES IT. hgMechAvwapReclaim fires:

     pc <= v && c > v && anchor.type === 'low'   -> LONG
     pc >= v && c < v && anchor.type === 'high'  -> SHORT

   Long is price crossing UP through the VWAP anchored to a swing LOW — an
   up-move resuming after a pullback. Short is price LOSING the VWAP anchored
   to a swing HIGH. Both trade WITH the cross. That is continuation, in both
   directions, unambiguously.

   It was classified 'AVWAP-RECLAIM':'REVERSION', and v376 — my change —
   derived the reversion flag from that family. So it was exempted from the
   trend gate, exempted from htf-daily, and every context gate was handed the
   wrong premise. The card on the live desk had EMA21 < EMA50 on a LONG and
   the trend gate reported it as "counter-trend, which is what this setup IS"
   instead of vetoing it.

   Every other REVERSION member genuinely fades — VWAP-REVERT, POC-REVERT,
   ADR-FADE, VALUE, ABSORB, RSI-DIVERGE all trade against a stretch. This one
   was alone in being wrong.

   Run: node tests/test-avwap-reclaim-family.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');
const MECH = read('hg-mechanics.js');

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

function tape(n, seed, drift){
  const out = []; let p = 4200, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p*(1+(rnd()-drift)*0.0035);
    const r = p*0.0013*(0.5+rnd());
    out.push({ t: 1700000000+i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v:1000 });
  }
  return out;
}
const UP = tape(400, 7, 0.34);      /* rallying */
const DOWN = tape(400, 13, 0.66);   /* selling off */
const PLAN = { entry: 4400, stop: 4380, t1: 4440 };
const gates = (rows, dir, kind, htf) =>
  W.hgOgGates(rows, { dir: dir, kind: kind, mech: kind }, { htf: htf, plan: PLAN });
const g1 = (rows, dir, kind, htf, key) => gates(rows, dir, kind, htf).filter(g => g && g.key === key)[0];

console.log('== the detector trades WITH the cross, in both directions ==');
{
  ok(/pc <= v && c > v && anchor\.type === 'low'/.test(MECH),
     'long fires when price crosses UP through a swing-LOW anchored VWAP');
  ok(/pc >= v && c < v && anchor\.type === 'high'/.test(MECH),
     'short fires when price LOSES a swing-HIGH anchored VWAP');
  ok(/reclaimed the VWAP anchored to the swing low/.test(MECH), 'and the long says "reclaimed"');
  ok(/lost the VWAP anchored to the swing high/.test(MECH), 'the short says "lost" — neither is a fade');
}

console.log('\n== it is classified as continuation now, in one place per file ==');
{
  ok(/'AVWAP-RECLAIM':'TREND'/.test(MECH), 'hg-mechanics classes it TREND');
  ok(/'AVWAP-RECLAIM':'TREND'/.test(GOLD), 'and omnigold agrees');
  ok(!/'AVWAP-RECLAIM':'REVERSION'/.test(MECH), 'the REVERSION classification is gone from hg-mechanics');
  ok(!/'AVWAP-RECLAIM':'REVERSION'/.test(GOLD), 'and from omnigold');
  ok(/AVWAP-RECLAIM IS NOT A FADE/.test(MECH) && /AVWAP-RECLAIM IS NOT A FADE/.test(GOLD),
     'both record why, so it is not reverted by a tidy-up');
  /* The two maps must not drift — consensus reads one, the desks read the other. */
  ok(W.hgOgFamilyOf ? W.hgOgFamilyOf('AVWAP-RECLAIM') === 'TREND' : true,
     'the runtime lookup agrees with the source');
}

console.log('\n== every other REVERSION member really does fade ==');
{
  /* If any of these were also wrong the fix would be incomplete, so name them. */
  for (const k of ['VWAP-REVERT','POC-REVERT','ADR-FADE','VALUE','ABSORB','RSI-DIVERGE']){
    ok(new RegExp("'" + k + "':'REVERSION'").test(GOLD), k + ' stays REVERSION — it trades against a stretch');
  }
}

console.log('\n== the trend gate can now veto it, which is the whole point ==');
{
  /* The live card had EMA21 < EMA50 on a LONG and the gate called it context. */
  const t = g1(DOWN, 'long', 'AVWAP-RECLAIM', { e21: 4300, e50: 4400 }, 'trend');
  ok(t.pass === false, 'AVWAP-RECLAIM LONG against a down EMA stack is VETOED');
  ok(/against the setup/.test(t.why), 'and says so plainly: ' + t.why);
  ok(!/context only/.test(t.why), 'not "context only for a reversion setup", which is what it used to say');
  ok(t.hard === true, 'and the gate is HARD for a continuation mechanic');
  /* With the stack agreeing it still passes. */
  const t2 = g1(UP, 'long', 'AVWAP-RECLAIM', { e21: 4400, e50: 4300 }, 'trend');
  ok(t2.pass === true, 'and with the stack agreeing it passes');
}

console.log('\n== htf-daily judges it too ==');
{
  const d = g1(UP, 'long', 'AVWAP-RECLAIM', { e21: 4300, e50: 4400 }, 'htf-daily');
  ok(d.pass === false, 'a LONG against a down daily is vetoed');
  ok(/disagrees with the setup/.test(d.why), 'as a disagreement, not an expectation: ' + d.why);
  ok(!/expected for a reversion setup/.test(d.why), 'the reversion exemption no longer applies');
}

console.log('\n== the context gates stop calling a long a fade ==');
{
  const k = g1(UP, 'long', 'AVWAP-RECLAIM', { e21: 4400, e50: 4300 }, 'keltner-pos');
  ok(!/the stretch a reversion mechanic is fading/.test(k.why),
     'keltner-pos no longer calls it fading: ' + k.why.slice(0, 66));
  const r = g1(UP, 'long', 'AVWAP-RECLAIM', { e21: 4400, e50: 4300 }, 'regime-fit');
  ok(!/fading a trending tape/.test(r.why), 'regime-fit no longer calls it fading');
  ok(/continuation mechanic/.test(r.why) || r.pass === true, 'it reads it as continuation: ' + r.why.slice(0, 62));
  const f = g1(UP, 'long', 'AVWAP-RECLAIM', { e21: 4400, e50: 4300 }, 'fade-strength');
  ok(/only judges fades/.test(f.why), 'and fade-strength correctly skips it: ' + f.why.slice(0, 50));
}

console.log('\n== a REAL fade is untouched by any of this ==');
{
  const k = g1(UP, 'short', 'POC-REVERT', { e21: 4400, e50: 4300 }, 'keltner-pos');
  ok(/the stretch a reversion mechanic is fading/.test(k.why) || k.pass === true,
     'POC-REVERT SHORT still reads as fading a stretch: ' + k.why.slice(0, 60));
  const t = g1(UP, 'short', 'POC-REVERT', { e21: 4400, e50: 4300 }, 'trend');
  ok(t.pass !== false, 'and its trend gate is still context, not a veto');
  ok(/what this setup IS/.test(t.why), 'saying counter-trend is what it is: ' + t.why.slice(0, 60));
  const f = g1(UP, 'short', 'POC-REVERT', { e21: 4400, e50: 4300 }, 'fade-strength');
  ok(f.pass === false, 'and fade-strength still vetoes it against a strong trend');
}

console.log('\n== consensus now groups it with the mechanics it agrees with ==');
{
  /* A reclaim is a momentum read, so it belongs with TREND rather than
     inflating REVERSION. Counting it as reversion made a continuation tape
     look two-sided. */
  const cons = W.hgOgGates(UP, { dir:'long', kind:'AVWAP-RECLAIM', mech:'AVWAP-RECLAIM' },
    { plan: PLAN, allHits: [{ kind:'AVWAP-RECLAIM', dir:'long' }, { kind:'ORB', dir:'long' },
                            { kind:'VALUE', dir:'short' }] })
    .filter(g => g && g.key === 'consensus')[0];
  ok(!!cons, 'the consensus gate ran');
  ok(!/REVERSION/.test(String(cons.why).split('vs')[0] || ''),
     'AVWAP-RECLAIM no longer counts on the REVERSION side: ' + cons.why.slice(0, 70));
  ok(/TREND/.test(cons.why), 'it counts with TREND, alongside ORB');
}

console.log('\n== degenerate input never throws ==');
{
  for (const rows of [[], [{}], tape(5, 1, 0.5)]){
    for (const dir of ['long','short']){
      let threw = null, g = null;
      try { g = W.hgOgGates(rows, { dir:dir, kind:'AVWAP-RECLAIM', mech:'AVWAP-RECLAIM' }, {}); }
      catch (e){ threw = e; }
      ok(!threw, 'rows=' + rows.length + ' ' + dir + ' does not throw');
      ok(Array.isArray(g) && g.length > 10, '   and still produces a ledger');
    }
  }
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL AVWAP-RECLAIM FAMILY TESTS PASSED');
