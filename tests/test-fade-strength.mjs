/* HARDGATE — "the setups are absolutely wrong — shorts in a rally."

   The ledger could not stop one. For a reversion mechanic, every trend-aware
   gate on the gold desk was either exempt by design or advisory:

     trend             passes by design   trendOk = true when reversion
     htf-daily         passes by design   d1 = reversion ? true : dAgrees
     hurst-regime      info:true
     regime-fit        info:true
     adx-trend         info:true
     structure-shift   info:true
     htf-confirm       info:true
     regression-slope  info:true

   Eight trend-aware gates and not one able to veto a fade. A live ticket
   carried "AGAINST hurst-regime — a reversion mechanic against a trending
   tape" and "AGAINST regime-fit — fading a trending tape" side by side, and
   cleared anyway.

   V376 WIDENED THAT HOLE, AND IT WAS MY CHANGE. Before it, VWAP-REVERT,
   POC-REVERT and RSI-DIVERGE were classed as continuation and
   WERE vetoed by trend and htf-daily. Reclassifying them as reversion was
   correct — the trend gate's own comment says vetoing a fade for being
   counter-trend is a category error, and it is — but it handed those four a
   free pass on every trend check in the same move.

   The distinction the ledger never drew: fading a STRETCHED market is the
   trade; fading a STRONG TREND is the classic way to lose. For a fade,
   direction is not the question. Strength is.

   fade-strength takes three independent reads of strength against the fade —
   the daily stack, ADX with DI, and the structural regime with the local EMA
   stack confirming — and requires TWO to agree before vetoing, so one noisy
   indicator cannot kill a setup. It is soft, so it reports rather than
   disappearing the card.

   Run: node tests/test-fade-strength.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
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

/* drift < 0.5 pushes price up; > 0.5 pushes it down; 0.5 is a random walk. */
function tape(n, seed, drift, wobble){
  const out = []; let p = 4000, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    const osc = wobble ? Math.sin(i/22) * wobble : 0;
    p = p * (1 + (rnd() - drift + osc) * 0.004);
    const r = p * 0.0012 * (0.5 + rnd());
    out.push({ t: 1700000000 + i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v: 1000 });
  }
  return out;
}
const RALLY = tape(400, 3, 0.30, 0);          /* strong uptrend  */
const SELLOFF = tape(400, 7, 0.70, 0);        /* strong downtrend */
/* A genuinely mean-reverting tape: pulled back toward a fixed level, so it
   oscillates without acquiring a drift the way a sine-shifted walk does. */
function ranging(n, seed){
  const out = []; let p = 4000, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p += (4000 - p) * 0.06 + (rnd() - 0.5) * 26;
    const r = 5 + rnd() * 6;
    out.push({ t: 1700000000 + i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v: 1000 });
  }
  return out;
}
const RANGE = ranging(400, 11);
const move = r => (r[r.length-1].c / r[r.length-61].c - 1) * 100;

const gate = (rows, dir, kind, htf) =>
  W.hgOgGates(rows, { dir: dir, kind: kind, mech: kind }, htf ? { htf: htf } : {})
   .filter(g => g && g.key === 'fade-strength')[0];

/* AVWAP-RECLAIM is NOT here. It reclaims a swing-low VWAP long and loses a
   swing-high VWAP short — it trades WITH the cross both ways, which is
   continuation. Classing it reversion exempted it from every trend gate and
   produced a live TICKET whose own gates described a long as fading the move
   it was buying. See test-avwap-reclaim-family.mjs. */
const REVERSION = ['POC-REVERT','VWAP-REVERT','ADR-FADE','SPRING','RSI-DIVERGE'];
const CONTINUATION = ['ORB','MMOVE','PO3','BOS-RETEST','NR7-BREAK'];

console.log('== the tapes are what they claim to be ==');
{
  ok(move(RALLY) > 3, 'the rally moved +' + move(RALLY).toFixed(2) + '% over 60 bars');
  ok(move(SELLOFF) < -3, 'the selloff moved ' + move(SELLOFF).toFixed(2) + '%');
  ok(Math.abs(move(RANGE)) < 3, 'and the range went nowhere (' + move(RANGE).toFixed(2) + '%)');
}

console.log('\n== THE DEFECT: a fade against a strong trend is now vetoed ==');
{
  for (const k of REVERSION){
    const g = gate(RALLY, 'short', k, { e21: 4400, e50: 4300 });
    ok(g.pass === false, k + ' SHORT into a rally is VETOED');
    ok(/fading a STRONG trend/.test(g.why), '   and says why: ' + g.why.slice(0, 78));
    ok(/;/.test(g.why), '   naming more than one adverse read, as the two-of-three rule requires');
  }
  /* Mirror image: a long fade into a selloff. */
  const g2 = gate(SELLOFF, 'long', 'POC-REVERT', { e21: 4300, e50: 4400 });
  ok(g2.pass === false, 'and POC-REVERT LONG into a selloff is vetoed too — the rule is symmetric');
  ok(/the daily stack is down/.test(g2.why), '   naming the downtrend: ' + g2.why.slice(0, 70));
}

console.log('\n== a fade WITH the higher timeframe still passes ==');
{
  for (const k of REVERSION){
    const g = gate(RALLY, 'long', k, { e21: 4400, e50: 4300 });
    ok(g.pass !== false, k + ' LONG in a rally is not vetoed — it is not fighting anything');
  }
}

console.log('\n== a fade in a RANGING tape is untouched, which is where fades belong ==');
{
  let vetoed = 0;
  for (const k of REVERSION){
    for (const dir of ['long','short']){
      const g = gate(RANGE, dir, k, null);
      if (g.pass === false) vetoed++;
    }
  }
  ok(vetoed === 0, 'no fade is vetoed in a tape with no trend (' + vetoed + ' of ' + (REVERSION.length*2) + ')');
  const g = gate(RANGE, 'short', 'POC-REVERT', null);
  ok(/nothing strong running against this fade|counter-trend on one read/.test(g.why),
     'and it says so rather than staying silent: ' + g.why.slice(0, 70));
}

console.log('\n== ONE adverse read is not enough ==');
{
  /* The whole point of two-of-three: a fade IS counter-trend, so a single
     disagreeing indicator must not stand it aside. Range tape, daily against. */
  const g = gate(RANGE, 'short', 'POC-REVERT', { e21: 4400, e50: 4300 });
  ok(g.pass !== false, 'a fade with only the daily against it is not vetoed');
  ok(/one read is not enough/.test(g.why) || /nothing strong/.test(g.why),
     'and the reason explains the threshold: ' + g.why.slice(0, 80));
}

console.log('\n== continuation mechanics are not judged by this gate at all ==');
{
  for (const k of CONTINUATION){
    for (const [rows, dir] of [[RALLY,'short'],[RALLY,'long'],[SELLOFF,'short']]){
      const g = gate(rows, dir, k, { e21: 4400, e50: 4300 });
      ok(g.pass === true, k + ' ' + dir + ' passes — this gate only judges fades');
    }
  }
  ok(/this gate only judges fades/.test(gate(RALLY,'short','ORB',null).why),
     'and says so explicitly');
}

console.log('\n== it is SOFT, so it reports rather than disappearing a card ==');
{
  ok(/key:'fade-strength', hard:false/.test(GOLD), 'the gate is soft');
  ok(!/key:'fade-strength'[^}]*info:\s*true/.test(GOLD),
     'but NOT info — an info gate could not veto, which is the hole it exists to close');
  /* It must actually be able to stop a ticket. */
  const clean = [{ key:'trend', hard:true, pass:true, why:'ok' },
                 { key:'vol-alive', hard:true, pass:true, why:'ok' }];
  const veto = { key:'fade-strength', hard:false, pass:false, why:'fading a STRONG trend' };
  ok(W.hgOmniGrade(clean.concat([veto])).ticket === false, 'and a fade-strength veto stops a ticket');
  ok(W.hgOmniGrade(clean).ticket === true, 'while a clean ledger still clears');
}

console.log('\n== with no usable reads it says so rather than guessing ==');
{
  /* A tape too short for ADX or regime, and no daily supplied. */
  const thin = tape(30, 5, 0.5, 0);
  const g = gate(thin, 'short', 'POC-REVERT', null);
  ok(g.pass !== false, 'a fade is not vetoed on absent evidence');
  ok(g.pass === null || /nothing strong|cannot judge/.test(g.why),
     'it reads UNCHECKED or says nothing was running: ' + String(g.why).slice(0, 70));
}

console.log('\n== degenerate input never throws ==');
{
  for (const bad of [[], [{}], tape(3, 1, 0.5, 0)]){
    let threw = null, g = null;
    try {
      g = W.hgOgGates(bad, { dir:'short', kind:'POC-REVERT', mech:'POC-REVERT' }, {})
           .filter(x => x && x.key === 'fade-strength')[0];
    } catch (e){ threw = e; }
    ok(!threw, 'rows of length ' + bad.length + ' does not throw');
    if (g){
      ok(g.pass === true || g.pass === false || g.pass === null, 'and the verdict is a real one');
      ok(!/undefined|NaN/.test(String(g.why)), 'with no undefined or NaN in the reason');
    }
  }
}

console.log('\n== the reasoning is recorded, including that v376 caused it ==');
{
  ok(/FADE-STRENGTH/.test(GOLD), 'the gate names itself');
  ok(/v376 widened that hole|v376 made it necessary|v376 made necessary/i.test(GOLD),
     'and records that v376 widened the hole');
  ok(/fading a STRETCHED market is the trade/.test(GOLD) || /stretched tape, not a running one/.test(GOLD),
     'and states the distinction it draws');
  ok(/TWO must\s+agree/.test(GOLD) || /two-of-three/i.test(GOLD) || /TWO to agree/.test(GOLD),
     'and the two-of-three threshold');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FADE-STRENGTH TESTS PASSED');
