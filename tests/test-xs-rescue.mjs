/* HARDGATE — the universe's most extreme contracts could never produce a card.

   OMNIROUTE scans in two passes, and it has to. XS-LEADER and XS-LAGGARD are
   the only mechanics on the desk that cannot be evaluated from one symbol's
   candles: a contract's rank is not known until every contract has been seen.
   So pass 1 fetches bars and detects WITHOUT the cross-section, and pass 2
   re-detects the fired names with the universe in hand.

   The bug is in who reached pass 2. That was decided by

     if (hits.length) fired.push(...)

   and those hits came from hgOmniDetect(rows) with no `xs` argument. A
   contract that is the strongest or weakest name in the whole universe, but
   happened to have no PRICE mechanic firing on its own candles, was dropped
   before the cross-section was ever computed. It could not produce a card
   however extreme it was — and being extreme is the entire signal those two
   mechanics carry.

   Measured on a 300-contract synthetic universe with a real spread of 20-bar
   returns: XS fires on 20% of names, and 5% of those fires had no price
   mechanic alongside them. That is 1% of the universe silently gone. On a
   524-contract live scan it is roughly five contracts per scan, and by
   construction they are the tails.

   The rescue costs no network and almost no memory. 93% of contracts already
   fire something and their bars were being retained anyway, so holding the
   remaining 7% until the ranks exist adds a fraction to a list the scan
   already carries, and the cross-sectional read needs only bars pass 1 has
   already fetched. The bars are released immediately afterwards.

   Run: node tests/test-xs-rescue.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUTE = read('omniroute.js');

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
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

/* A universe with a genuine spread of 20-bar returns, so the top and bottom
   deciles are populated the way a real scan's are. */
function tape(n, seed, drift){
  const out = []; let p = 100, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd()-0.5)*0.010 + drift);
    const r = p * 0.006 * (0.5+rnd());
    out.push({ t: 1700000000+i*14400, o:p-r*0.25, h:p+r, l:p-r, c:p, v:1000+rnd()*4000 });
  }
  return out;
}
const N = 300;
const universe = [];
for (let k = 0; k < N; k++){
  universe.push({ sym: 'SYM' + k, rows: tape(200, k + 1, (k / (N - 1) - 0.5) * 0.006) });
}

/* Reproduce pass 1 exactly as the scan does it. */
const xsAll = [], firedSyms = new Set(), unfired = [];
for (const u of universe){
  const sum = W.hgOmniXsSummary(u.sym, u.rows);
  if (sum) xsAll.push(sum);
  const hits = W.hgOmniDetect(u.rows);          /* NO cross-section, as in pass 1 */
  if (hits && hits.length) firedSyms.add(u.sym); else unfired.push(u);
}
const xsRanks = W.hgOmniXsRanks(xsAll);

console.log('== the universe behaves like a real one ==');
{
  ok(xsAll.length === N, 'every contract produced a cross-sectional summary (' + xsAll.length + ')');
  ok(!!xsRanks, 'ranks were computed');
  ok(xsRanks.n === N, 'over the whole universe (n=' + xsRanks.n + ')');
  ok(firedSyms.size > N * 0.5, 'most contracts fire a price mechanic in pass 1 (' + firedSyms.size + ')');
  ok(unfired.length > 0, 'and some fire nothing (' + unfired.length + ') — those are the ones at issue');
}

console.log('\n== THE DEFECT: extremes with no price mechanic were unreachable ==');
{
  let xsFires = 0, xsOnly = 0;
  const lost = [];
  for (const u of universe){
    const xd = W.hgOmniXsLeader(u.rows, xsRanks, u.sym);
    if (!xd) continue;
    xsFires++;
    if (!firedSyms.has(u.sym)){ xsOnly++; lost.push({ sym: u.sym, kind: xd.kind, dir: xd.dir }); }
  }
  ok(xsFires > 0, 'XS-LEADER/LAGGARD fires on ' + xsFires + ' contracts (' + (xsFires/N*100).toFixed(0) + '%)');
  ok(xsOnly > 0, 'and ' + xsOnly + ' of those had NO price mechanic — the old scan dropped them entirely');
  ok(lost.some(l => l.kind === 'XS-LEADER') || lost.some(l => l.kind === 'XS-LAGGARD'),
     'the lost set contains real cross-sectional signals: ' + lost.map(l => l.kind).join(', '));
  /* They are the tails by construction — which is the whole point. */
  for (const l of lost){
    const r = xsRanks.rank[l.sym];
    ok(r >= 0.9 || r <= 0.1, l.sym + ' sits at the ' + (r*100).toFixed(0)
       + 'th percentile — an extreme, which is exactly what these mechanics exist to find');
  }
}

console.log('\n== the rescue recovers exactly those, and only those ==');
{
  /* Reproduce the rescue as the scan now performs it. */
  const rescued = [];
  for (const u of unfired){
    const xd = W.hgOmniXsLeader(u.rows, xsRanks, u.sym);
    if (xd) rescued.push({ sym: u.sym, hits: [xd] });
  }
  ok(rescued.length > 0, 'the rescue recovers ' + rescued.length + ' contract(s)');
  ok(rescued.every(r => !firedSyms.has(r.sym)), 'every rescued contract is one pass 1 had dropped');
  ok(rescued.every(r => r.hits.length === 1), 'each carries exactly the cross-sectional hit');
  ok(rescued.every(r => r.hits[0].kind === 'XS-LEADER' || r.hits[0].kind === 'XS-LAGGARD'),
     'and nothing else is smuggled in');
  /* A contract that fires nothing at all must still be left out. */
  const stillOut = unfired.filter(u => !W.hgOmniXsLeader(u.rows, xsRanks, u.sym));
  ok(stillOut.length > 0, stillOut.length + ' contract(s) fire nothing at all and stay out, as they should');
  ok(stillOut.length + rescued.length === unfired.length, 'every unfired contract is accounted for');
}

console.log('\n== the rescued hit carries what a card needs ==');
{
  const u = unfired.map(x => ({ x, xd: W.hgOmniXsLeader(x.rows, xsRanks, x.sym) })).filter(r => r.xd)[0];
  ok(!!u, 'there is a rescued contract to inspect');
  const xd = u.xd;
  ok(xd.kind === 'XS-LEADER' || xd.kind === 'XS-LAGGARD', 'it has a kind (' + xd.kind + ')');
  ok(xd.dir === 'long' || xd.dir === 'short', 'a direction (' + xd.dir + ')');
  ok(isFinite(xd.level) && xd.level > 0, 'a level (' + xd.level + ')');
  ok(typeof xd.why === 'string' && /percentile/.test(xd.why), 'and a reason naming the percentile: ' + xd.why);
  /* The gate ledger must build on it without throwing. */
  let threw = null, gates = null;
  try { gates = W.hgOmniGates(u.x.rows, { dir: xd.dir, kind: xd.kind, mech: xd.kind }, null, {}); }
  catch (e){ threw = e; }
  ok(!threw, 'the ledger grades a rescued hit without throwing' + (threw ? ' — ' + threw.message : ''));
  ok(gates && gates.length > 10, 'producing a full ledger (' + (gates || []).length + ' gates)');
}

console.log('\n== the scan wires it correctly ==');
{
  ok(/var unfired = \[\];/.test(ROUTE), 'pass 1 holds the contracts that fired nothing');
  ok(/else unfired\.push\(\{ item: item, rows: rows \}\);/.test(ROUTE), 'with their bars, so no refetch is needed');
  ok(/CROSS-SECTIONAL RESCUE/.test(ROUTE), 'the rescue is named and explained');
  ok(/rx = hgOmniXsLeader\(uc\.rows, xsRanks, uc\.item\.sym\);/.test(ROUTE),
     'it runs the cross-sectional detector once the ranks exist');
  ok(/fired\.push\(\{ item: uc\.item, rows: uc\.rows, hits: \[rx\] \}\);/.test(ROUTE),
     'and promotes the contract into pass 2');
  ok(/unfired\.length = 0;/.test(ROUTE), 'the retained bars are released immediately afterwards');
  /* Ordering: the rescue can only run AFTER the ranks are known. */
  ok(ROUTE.indexOf('xsRanks = hgOmniXsRanks(xsAll);') < ROUTE.indexOf('CROSS-SECTIONAL RESCUE'),
     'and it runs after the ranks are computed, never before');
}

console.log('\n== the count is honest and per-scan ==');
{
  ok(/xsRescued: 0/.test(ROUTE), 'the counter is declared on the tab state');
  ok(/__omni\.xsRescued = 0;/.test(ROUTE), 'and reset at the start of every scan');
  ok(ROUTE.indexOf('__omni.xsRescued = 0;') < ROUTE.indexOf('if (resc) __omni.xsRescued = resc;'),
     'reset before it is written, so a previous scan is never reported against this one');
  ok(/cross-sectional rescue\(s\): universe extremes with no price mechanic of their own/.test(ROUTE),
     'and the status line says what a rescued contract is');
}

console.log('\n== a rescue failure can never break the scan ==');
{
  ok(/catch \(eXs\)\{/.test(ROUTE), 'the rescue has its own catch');
  ok(/hgFwdWarn\('omniroute:xs-rescue'/.test(ROUTE), 'reporting through the shared warn channel');
  /* With no ranks — a universe under the 30-name floor — it must simply not run. */
  const tiny = [];
  for (let k = 0; k < 5; k++) tiny.push(W.hgOmniXsSummary('T' + k, tape(200, k + 1, 0)));
  ok(W.hgOmniXsRanks(tiny.filter(Boolean)) === null,
     'a universe under the floor produces no ranks, so nothing is rescued on a thin scan');
  ok(/if \(xsRanks\)\{/.test(ROUTE), 'and the rescue is guarded on the ranks existing');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL CROSS-SECTIONAL RESCUE TESTS PASSED');
