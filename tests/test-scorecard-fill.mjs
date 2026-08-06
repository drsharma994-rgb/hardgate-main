/* HARDGATE — scorecard fill gate and net-of-cost expectancy.
   The SCORECARD is the app's primary edge-measurement instrument: walk-forward
   settlement, tier / lane / direction / layer breakdowns, and the hint boost
   that feeds back into ranking. Two defects made it unreliable:

   1) NO FILL GATE. HARDGATE entries are LIMITs that sit AWAY from the mark
      (EMA21/EMA9 for swings, the sweep level for scalps). hgScoreWalk started
      testing stop/target from the first post-entry bar without ever checking
      that price traded to the entry, so an unfilled long-limit that ran
      straight up was booked as a T1/T2 WIN. Measured on a fixture whose lowest
      low was 99.95 against a limit at 99: the old engine returned T2 +3.5R.
      The bias is one-directional — an unfilled long-limit that runs DOWN must
      pass back through the entry to reach the stop, so it fills. Only the
      winners were phantom.

   2) GROSS ONLY. The LOG gained a Delta fee model in pack 4; the scorecard did
      not, so the two instruments disagreed, and the hint boost was tuning the
      app on pre-fee edge.

   Run: node tests/test-scorecard-fill.mjs                                    */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function load(extra){
  const ctx = {
    console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout,
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null, addEventListener(){} },
    fetch: () => Promise.reject(new Error('no net')),
  };
  Object.assign(ctx, extra || {});
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scorecard.js'), 'utf8'), ctx, { filename: 'scorecard.js' });
  return ctx;
}
const AT = 1754400000000;                        /* ms */
const T0 = AT / 1000;
/* bars that RUN UP and never trade down to a limit at 99 */
function runUp(n){
  const out = [];
  for (let i = 0; i < n; i++){
    const base = 100 + i * 0.3;
    out.push({ t: T0 + (i + 1) * 3600, o: base, h: base + 0.25, l: base - 0.05, c: base + 0.2 });
  }
  return out;
}
/* same run-up, but the FIRST bar dips to 98.8 so the limit at 99 fills */
function dipThenRun(n){
  const out = runUp(n);
  out[0] = Object.assign({}, out[0], { l: 98.8 });
  return out;
}
const PLAN = { dir: 'long', entry: 99, stop: 98, t1: 101, t2: 102.5, at: AT };

console.log('== an unfilled limit is never scored as a win ==');
{
  const ctx = load();
  const bars = runUp(10);
  const lowest = Math.min.apply(null, bars.map(b => b.l));
  ok(lowest > PLAN.entry, 'fixture never trades to the limit (low ' + lowest.toFixed(2) + ' vs entry 99)');
  const w = ctx.hgScoreWalk(PLAN, bars);
  ok(w.state !== 'T1' && w.state !== 'T2' && w.state !== 'T1S',
     'the walk does NOT return a win — got ' + w.state);
  ok(w.state === 'PENDING_FILL', 'it reports PENDING_FILL while the window is still open');
  ok(w.r === null, 'R is null, so it cannot enter any average');
}

console.log('== the same plan, once price actually trades to the limit ==');
{
  const ctx = load();
  const w = ctx.hgScoreWalk(PLAN, dipThenRun(10));
  ok(w.state === 'T2', 'a genuinely filled runner still scores T2');
  ok(w.r === 3.5, 'and books its real +3.5R');
}

console.log('== a fill bar may also hit a level in the same bar ==');
{
  const ctx = load();
  const bars = [{ t: T0 + 3600, o: 100, h: 100.2, l: 97.5, c: 98.2 }];
  const w = ctx.hgScoreWalk(PLAN, bars);
  ok(w.state === 'SL', 'one bar that reaches the limit AND the stop settles as SL');
  ok(w.r === -1, 'exactly -1R');
}

console.log('== no data is not the same as not filled ==');
{
  const ctx = load();
  ok(ctx.hgScoreWalk(PLAN, []).state === 'OPEN', 'zero bars stays OPEN, not PENDING_FILL');
  ok(ctx.hgScoreWalk(PLAN, null).state === 'OPEN', 'null rows stay OPEN and never throw');
  ok(ctx.hgScoreWalk(PLAN, []).r === null, 'and invent no R');
}

console.log('== null-R settlements never leak into an average ==');
{
  const ctx = load();
  const recs = [
    { status: 'settled', outcome: 'T2',       r: 3.5,  dir: 'long', tier: 'PRIME' },
    { status: 'settled', outcome: 'SL',       r: -1,   dir: 'long', tier: 'PRIME' },
    { status: 'settled', outcome: 'UNFILLED', r: null, dir: 'long', tier: 'PRIME' },
  ];
  const st = ctx.hgScoreStats(recs);
  ok(st.settled === 3, 'all three are visible as settled');
  ok(st.counted === 2, 'only the two with a real R are counted');
  ok(Math.abs(st.avgR - 1.25) < 1e-9, 'avgR is (3.5 + -1)/2 = 1.25, the UNFILLED is excluded');
  ok(st.byTier.PRIME.n === 2, 'the tier bucket excludes it too');
}

console.log('== expectancy is reported NET when the cost model is loaded ==');
{
  /* index.html owns the ONE fee model; scorecard reads it rather than keeping
     a second copy of the constants. */
  const ctx = load({ hgCostR: (entry, stop, inSide, outSide) => {
    const riskPct = Math.abs(entry - stop) / entry * 100;
    const rt = (inSide === 'taker' ? 0.05 : 0.02) + (outSide === 'taker' ? 0.05 : 0.02);
    return (rt * 1.18) / riskPct;
  }});
  const w = ctx.hgScoreWalk(PLAN, dipThenRun(10));
  const net = ctx.hgScoreNetR({ entry: 99, stop: 98 }, w.state, w.r);
  ok(net !== null, 'net R is computed');
  ok(net < w.r, 'net (' + net.toFixed(4) + 'R) is below gross (' + w.r + 'R)');
  const slNet = ctx.hgScoreNetR({ entry: 99, stop: 98 }, 'SL', -1);
  ok(slNet < -1, 'a loss is worse than -1R once the market stop exit is paid');
  ok(Math.abs(slNet + 1) > Math.abs(w.r - net), 'the SL leg costs more — taker exit vs limit exit');
}

console.log('== without the cost model, net reads null, never gross-in-disguise ==');
{
  const ctx = load();                       /* no hgCostR on the host */
  ok(ctx.hgScoreNetR({ entry: 99, stop: 98 }, 'T2', 3.5) === null,
     'net is null when index.html has not loaded');
  const st = ctx.hgScoreStats([{ status: 'settled', r: 2, dir: 'long', tier: 'PRIME' }]);
  ok(st.avgR === 2, 'gross still reported');
  ok(st.expectancyNet === null, 'net expectancy is null — a gross number never wears a net label');
}

console.log('\n' + passed + ' passed, 0 failed');
