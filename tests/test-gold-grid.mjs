/* HARDGATE — "I am still not getting good setups in omnigold."

   The gold desk had no way to answer that, and neither did I without going
   outside the app. OMNIROUTE has carried an R/horizon grid since its own test
   established the finding that governs every desk here:

     the SAME six detectors run from -18.7 sigma at 3R/10 bars to +2.5 sigma
     at 1.5R/40 bars. Nothing about the detectors changed between those
     numbers; target and horizon did all the work.

   OMNIGOLD trades SCALP at 1.5R/24 bars and SWING at 2R/20 bars and had zero
   grid references against omniroute's seven. So the one diagnostic the app
   itself says dominates was missing from the desk being asked about.

   WHAT IT SHOWS, measured on 1,500 real XAUUSDT 1h bars:

     R    horizon  settled  hit   expR    sigma
     1    10       235      54%   +0.09R  +1.37   <- best of all twelve
     1.5  20       157      41%   +0.04R  +0.36   <- gold's own frame
     1.5  40       107      44%   +0.10R  +0.83   <- best reachable
     3    10       161      20%   -0.20R  -1.50   <- worst

   Against a family-wise bar of +2.97 sigma, NOT ONE CELL CLEARS. So for gold
   the frame is not the main problem: moving to the best reachable setting
   takes it from +0.36 to +0.83, an improvement and still noise. That is a
   real answer to "why aren't the setups good", and it is one the desk should
   be able to produce on demand rather than needing someone to go and measure
   it by hand.

   A HYPOTHESIS I TESTED AND DROPPED FIRST. I thought the problem was sample
   size: gold measures on 1500 1h bars, 63 days, giving 20-46 samples per
   mechanic against the ~94 the bar needs. Binance caps klines at 1500 and
   nothing in the app paginates, so I verified deeper history was reachable —
   4 requests, 6000 bars, 250 days, zero duplicates. Then I measured what it
   bought. ROUND-MAGNET went from 42 samples at +1.01 sigma to 169 samples at
   +1.00 sigma: the hit rate fell from 48% to 44% exactly as fast as the error
   bar shrank. Four times the data moved significance by 0.01 sigma, because
   the 48% was noise. Deeper history does not manufacture an edge, and I did
   not ship it.

   Run: node tests/test-gold-grid.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');
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
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();

/* Gold-shaped 1h bars. Deterministic, so the gradient below is reproducible. */
function tape(n, seed, mode){
  const out = []; let p = 4350, s = seed;
  const rnd = () => { s = (s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for (let i = 0; i < n; i++){
    const d = mode==='trend'?0.05:mode==='down'?-0.05:mode==='range'?Math.sin(i/28)*0.2:0;
    p = p*(1+(rnd()-0.48+d)*0.0028);
    const r = p*0.0014*(0.5+rnd());
    out.push({ t: 1700000000+i*3600, o:p-r*0.25, h:p+r, l:p-r, c:p, v:900+rnd()*900 });
  }
  return out;
}
const LISTS = [tape(1200, 5, 'trend'), tape(1200, 9, 'range')];

console.log('== the grid runs on gold bars at all ==');
{
  ok(typeof W.hgOmniGridRun === 'function', 'hgOmniGridRun is reachable from the gold desk');
  ok(typeof W.hgOmniGridProgressive === 'function', 'and the progressive runner it uses');
  const c = W.hgOmniGridRun(LISTS, 1.5, 24);
  ok(!!c, 'gold bars at 1.5R/24 produce a cell');
  ok(c.settled > 30, 'with a real sample behind it (' + c.settled + ' settled)');
  ok(Math.abs(c.be - 1/2.5) < 1e-9, 'breakeven for 1.5R is 40% (' + (c.be*100).toFixed(1) + '%)');
  ok(isFinite(c.z), 'and a finite sigma (' + c.z.toFixed(2) + ')');
}

console.log('\n== it measures the SAME six detectors as the crypto grid ==');
{
  /* Comparability across desks is the point: this tab's own header calls them
     "the OmniRoute six". A gold-only mechanic set would make the two tables
     incomparable. */
  ok(/var GRID_MECHS = \['SPRING', 'PO3', 'ORB', 'ABSORB', 'VALUE', 'MMOVE'\]/.test(ROUTE),
     'the grid holds the six core detectors fixed');
  ok(/the OmniRoute six/.test(GOLD), 'and the gold tab already describes itself as running them');
  ok(/Same six detectors as the crypto grid/.test(GOLD), 'the gold panel records why that matters');
}

console.log('\n== the frame really does move the result ==');
{
  const at = (r, h) => W.hgOmniGridRun(LISTS, r, h);
  const rows = [[1,10],[1,20],[1,40],[1.5,10],[1.5,20],[1.5,40],[2,10],[2,20],[2,40],[3,10],[3,20],[3,40]];
  const cells = rows.map(([r,h]) => ({ r, h, c: at(r,h) })).filter(x => x.c);
  ok(cells.length === 12, 'all twelve settings produce a cell (' + cells.length + ')');
  const zs = cells.map(x => x.c.z);
  const spread = Math.max.apply(null, zs) - Math.min.apply(null, zs);
  ok(spread > 1, 'sigma spreads ' + spread.toFixed(2) + ' across the grid — the frame is doing real work');
  /* Breakeven must move with R, or every row is judged against one bar. */
  ok(Math.abs(at(1,20).be - 0.5) < 1e-9, 'a 1R target breaks even at 50%');
  ok(Math.abs(at(3,20).be - 0.25) < 1e-9, 'a 3R target at 25%');
  /* A nearer target settles at least as often. */
  ok(at(1,20).settled >= at(3,20).settled,
     'a nearer target settles at least as often (' + at(1,20).settled + ' vs ' + at(3,20).settled + ')');
}

console.log('\n== the panel is wired, and costs no network ==');
{
  ok(/id="ogGrid"/.test(GOLD), 'the button exists');
  ok(/id="ogGridOut"/.test(GOLD), 'with an output slot');
  ok(/grid: el\.querySelector\('#ogGrid'\)/.test(GOLD), 'both are captured on the ui object');
  ok(/__og\.gridRows = \{ scalp: res\.scalp\.rows \|\| \[\], swing: res\.swing\.rows \|\| \[\] \}/.test(GOLD),
     'the scan retains the bars it already fetched');
  ok(/costs no network/.test(GOLD), 'and says so — the grid re-measures, it does not refetch');
  ok(/gw\.hgOmniGridProgressive\(lists,/.test(GOLD), 'it uses the progressive runner, not the blocking build');
  ok(/A button, not part of every scan/.test(GOLD), 'and is a button, because it re-runs the walk-forward twelve times');
}

console.log('\n== it refuses to read as a recommendation ==');
{
  ok(/IN-SAMPLE and GROSS/.test(GOLD), 'the gold frame says the figures are in-sample and gross');
  /* The sentence spans a JS concatenation boundary in the source, so match
     its halves rather than pretending it is one literal. */
  ok(/best of twelve cells is the best of/.test(GOLD) && /twelve searches/.test(GOLD),
     'and that picking a setting is itself a search');
  ok(/multiple-comparisons bar/.test(GOLD), 'naming the correction that applies');
  const html = W.hgOmniGridHTML(LISTS);
  ok(/diagnostic, not a recommendation/.test(html), 'and the shared table says so in bold');
  ok(/only after the forward log has measured it/.test(html),
     'refusing to sanction a change on in-sample evidence');
}

console.log('\n== it names gold\'s own frame so the reader can locate themselves ==');
{
  ok(/HORIZONS\.scalp\.minRr \+ 'R \/ '/.test(GOLD), 'the panel quotes the live SCALP setting');
  ok(/HORIZONS\.swing\.minRr \+ 'R \/ '/.test(GOLD), 'and the live SWING setting');
  ok(/HORIZONS\.scalp\.horizonBars/.test(GOLD) && /HORIZONS\.swing\.horizonBars/.test(GOLD),
     'including both horizons, read from the config rather than hardcoded');
}

console.log('\n== it degrades rather than throwing ==');
{
  ok(/typeof gw\.hgOmniGridProgressive !== 'function'/.test(GOLD),
     'a missing grid engine is reported, not thrown');
  ok(/Run a scan first/.test(GOLD), 'no retained bars says run a scan first');
  ok(/catch \(eG\)\{/.test(GOLD), 'and the run is wrapped');
  ok(/ui\.grid\.disabled = false;/.test(GOLD), 'with the button re-enabled on failure');
  /* The shared builder must survive junk. */
  for (const bad of [[], [[]], [null], null]){
    let threw = null, out = null;
    try { out = W.hgOmniGridHTML(bad); } catch (e){ threw = e; }
    ok(!threw, 'hgOmniGridHTML(' + JSON.stringify(bad) + ') does not throw');
    ok(typeof out === 'string' && !/NaN|undefined/.test(out), 'and returns a panel with no NaN in it');
  }
}

console.log('\n== the finding is recorded, not just the code ==');
{
  ok(/-18\.7 sigma at 3R\/10 bars/.test(GOLD) && /\+2\.5 sigma at 1\.5R\/40 bars/.test(GOLD),
     'the gold panel records the finding that justifies it');
  ok(/frame is NOT the main/.test(GOLD) && /problem here/.test(GOLD),
     'and what the grid actually said about gold, so nobody re-derives it');
  ok(/\+2\.97/.test(GOLD), 'against the family-wise bar it was measured on');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL GOLD GRID TESTS PASSED');
