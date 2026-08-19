/* HARDGATE — "it doesnot show 2 tickets, only one ticket shows".

   The gold header read:

     12 setup(s) · 2 ticket(s)

   and the desk rendered ONE ticket card, whose own subtitle explained why:

     also fired here on identical levels: NR7-BREAK, BOS-RETEST, MMOVE
       — 4 mechanics, one trade

   Several mechanics firing the same bar produce the same entry, stop,
   direction and horizon. That is one trade with several names, and the render
   collapses it into one card — correctly. But the header counted tickets over
   the PRE-collapse list, so when two members of a collapsed group both graded
   TICKET, the header said two and the desk showed one. A ticket count you
   cannot act on twice is a count of positions the reader might size twice.

   The owner rule was the worse half of it. The FIRST member kept the card, so
   a group holding one cleared setup and one vetoed setup showed whichever
   happened to sort first — and a ticket could be hidden behind a VETO card
   entirely, invisible on the desk while still counted in the header. Not
   hypothetical: mechanics on identical levels genuinely grade differently,
   because measured-edge is per mechanic and consensus is per family.

   SECOND DEFECT, found on the same scan. The one ticket the desk was
   recommending carried:

     PASS measured-edge in-sample 22 samples · 18% T1-first · -0.45R
       [-2.09σ vs breakeven] — below breakeven, but only 22 samples: too few
       to veto on

   while the pool table three inches above read, for the same mechanic on the
   same number: "has not paid". Two verdicts on one measurement. The table
   judges anything past MIN_SAMPLES (20); the gate refuses to act under
   EDGE_VETO_SAMPLES (30); the 20-29 window printed a green PASS. Being too
   thin to VETO on is not evidence of an edge, and this ledger's own rule is
   that unknown reads UNCHECKED, never PASS.

   Run: node tests/test-ticket-count-and-edge-honesty.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
                   head:{appendChild(){}}, body:{appendChild(){}},
                   documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js',
                   'hg-forward.js', 'hg-gates.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
const GOLD = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');

/* The collapse key is entry+stop+direction+horizon. These four candidates are
   the live shape: one trade, four mechanics, two of them cleared. */
const T = (kind, ticket, entry, stop) => ({
  horizon: 'SCALP', dir: 'short', kind: kind, sym: 'XAUUSD',
  plan: { entry: entry, stop: stop },
  grade: { ticket: ticket, vetoes: ticket ? [] : ['trend'] }
});

console.log('== THE DEFECT: two tickets counted, one trade to take ==');
{
  /* POC-REVERT and MMOVE both cleared, on identical levels. */
  const list = [T('POC-REVERT', true, 4366.19, 4388.13), T('NR7-BREAK', false, 4366.19, 4388.13),
                T('BOS-RETEST', false, 4366.19, 4388.13), T('MMOVE', true, 4366.19, 4388.13)];
  const raw = list.filter(c => c.grade.ticket).length;
  ok(raw === 2, 'the old count over raw candidates gives ' + raw + ' — this was the header');
  const d = W.ogDistinctCounts(list);
  ok(d.trades === 1, 'but there is only ONE distinct trade here (' + d.trades + ')');
  ok(d.tickets === 1, 'so the header now says 1 ticket, which is what the desk renders');
}

console.log('\n== a genuinely separate trade is still counted separately ==');
{
  const list = [T('POC-REVERT', true, 4366.19, 4388.13), T('MMOVE', true, 4366.19, 4388.13),
                T('SPRING', true, 4300.00, 4320.00)];
  const d = W.ogDistinctCounts(list);
  ok(d.trades === 2, 'different levels are two trades (' + d.trades + ')');
  ok(d.tickets === 2, 'and two tickets — the fix does not undercount real ones');
}

console.log('\n== the horizon is part of the trade, so SCALP and SWING do not merge ==');
{
  const a = T('ORB', true, 4366.19, 4388.13);
  const b = T('ORB', true, 4366.19, 4388.13); b.horizon = 'SWING';
  const d = W.ogDistinctCounts([a, b]);
  ok(d.trades === 2, 'same levels on two horizons are two trades — different targets, different time stops');
  ok(d.tickets === 2, 'and two tickets');
}

console.log('\n== a group with no ticket contributes none ==');
{
  const d = W.ogDistinctCounts([T('A', false, 1, 2), T('B', false, 1, 2), T('C', false, 1, 2)]);
  ok(d.trades === 1 && d.tickets === 0, 'one trade, zero tickets');
}

console.log('\n== the counter is PURE — it must not touch the candidates ==');
{
  /* If it mutated, the render pass that runs after it would see half-built
     alsoKinds and the two passes would depend on each other. */
  const list = [T('POC-REVERT', true, 1, 2), T('MMOVE', false, 1, 2)];
  const before = JSON.stringify(list);
  W.ogDistinctCounts(list);
  ok(JSON.stringify(list) === before, 'counting leaves every candidate exactly as it was');
  ok(list.every(c => c.alsoKinds === undefined), 'and sets no alsoKinds');
}

console.log('\n== degenerate input never throws and never invents a trade ==');
{
  for (const bad of [null, undefined, [], [null], [{}], [{ plan: null, grade: null }]]){
    let threw = null, out = null;
    try { out = W.ogDistinctCounts(bad); } catch (e){ threw = e; }
    ok(!threw, 'ogDistinctCounts(' + JSON.stringify(bad) + ') does not throw');
    ok(out && isFinite(out.trades) && isFinite(out.tickets), 'and returns finite counts');
    ok(out.tickets <= out.trades, 'with tickets never exceeding trades');
  }
  /* Candidates with no plan share the 'na|na' key rather than each claiming
     to be a distinct trade. */
  const d = W.ogDistinctCounts([{ grade: { ticket: true } }, { grade: { ticket: true } }]);
  ok(d.tickets <= d.trades, 'planless candidates cannot inflate the ticket count');
}

console.log('\n== the cleared setup takes the card from the vetoed one ==');
{
  for (const [n, src] of [['omnigold', GOLD], ['omniroute', ROUTE]]){
    ok(/A cleared setup takes the card|cleared setup takes the card from the vetoed one/.test(src),
       n + ' prefers a cleared member as the card owner');
    ok(/\.grade\.ticket\) && !\(ow(n|ner)\.grade && ow(n|ner)\.grade\.ticket\)/.test(src),
       n + ' swaps the owner only when the newcomer cleared and the owner did not');
    ok(/also2?\.indexOf\(ow(n|ner)\.kind\) < 0\) also2?\.push\(ow(n|ner)\.kind\)/.test(src),
       n + ' carries the displaced owner into alsoKinds rather than losing it');
  }
  ok(/ogDistinctCounts\(ranked\)/.test(GOLD), 'gold counts over the distinct set');
  ok(/omniDistinctCounts\(ranked\)/.test(ROUTE), 'omniroute counts over the distinct set');
  ok(/distinct trade\(s\) after collapsing/.test(GOLD),
     'and gold says so in the header when a collapse happened');
}

console.log('\n== SECOND DEFECT: a losing read no longer shows as PASS ==');
{
  const T0 = 1700000000 - (1700000000 % 86400);
  const rows = []; let p = 4350, s = 5;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < 400; i++){
    p = p * (1 + (rnd() - 0.5) * 0.003);
    const r = p * 0.0018 * (0.5 + rnd());
    rows.push({ t: T0 + i*3600, o: p-r*0.25, h: p+r, l: p-r, c: p, v: 1000*(0.85+rnd()*0.3) });
  }
  const edge = (samples, hit) => {
    const g = W.hgOgGates(rows, { dir: 'long', kind: 'POC-REVERT', mech: 'POC-REVERT' },
                          { stats: { samples: samples, hit: hit, expR: hit*1.5 - (1-hit) }, minRr: 1.5 });
    return (g || []).filter(x => x && x.key === 'measured-edge')[0];
  };
  /* The live number: 22 samples at 18% against a 1.5R breakeven of 40%. */
  const thin = edge(22, 0.18);
  ok(thin.pass !== true, 'a -2σ read on 22 samples is NOT a PASS any more');
  ok(thin.info === true, 'it is reported as info, so it cannot veto the ticket either');
  ok(/counts AGAINST/.test(thin.why), 'and says what it is doing: ' + thin.why);
  ok(/under the 30/.test(thin.why), 'naming the sample floor it fell short of');

  /* Past the floor it must still be a hard veto. */
  const fat = edge(60, 0.18);
  ok(fat.pass === false && fat.info !== true, 'past 30 samples the same read is a real VETO');
  ok(/has not paid/.test(fat.why), 'and says so plainly');

  /* Under MIN_SAMPLES it stays UNCHECKED, unchanged. */
  const tiny = edge(10, 0.18);
  ok(tiny.pass === null, 'under 20 samples it is UNCHECKED, as before');

  /* And a positive read is untouched. */
  const good = edge(60, 0.75);
  ok(good.pass === true, 'a read that clears the family-wise bar still PASSES');
  ok(good.info !== true, 'as a real pass, not a caution');
}

console.log('\n== the AGAINST read does not silence the desk ==');
{
  /* The whole point of info:true — the ticket survives. */
  const clean = [{ key: 'trend', hard: true, pass: true, why: 'ok' },
                 { key: 'vol-alive', hard: true, pass: true, why: 'ok' }];
  const against = { key: 'measured-edge', hard: false, info: true, pass: false, why: 'counts AGAINST' };
  const veto = { key: 'measured-edge', hard: false, pass: false, why: 'has not paid' };
  ok(W.hgOmniGrade(clean.concat([against])).ticket === true,
     'a thin negative read leaves the ticket standing');
  ok(W.hgOmniGrade(clean.concat([veto])).ticket === false,
     'a measured one still stops it');
  ok(W.hgOmniGrade(clean.concat([against])).notes.indexOf('measured-edge') >= 0,
     'and the card still says it argued against');
}

console.log('\n== both desks got both fixes ==');
{
  for (const [n, src] of [['omnigold', GOLD], ['omniroute', ROUTE]]){
    ok(/ed = false; edInfo = true;/.test(src), n + ' reports the thin negative read as AGAINST');
    ok(/info: edInfo, pass: ed/.test(src), n + ' passes the flag through to the gate');
    ok(/SIGNIFICANTLY NEGATIVE IS NOT A PASS/.test(src), n + ' records why, so it is not tidied back');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL TICKET COUNT AND EDGE HONESTY TESTS PASSED');
