/* HARDGATE — replay the gates over history and price a threshold.
   WHY. Pack 17 answers "how many setups would relaxing this gate ADD". Pack 15
   answers "what would a different stop have PAID". Neither answers the question
   that actually decides a threshold: BOTH AT ONCE. Count without expectancy
   argues for loosening everything; expectancy without count argues for
   tightening until nothing trades.
   With alert-state.json showing setups 0 and tickets null while the pipeline
   runs, this is not academic. The funnel is empty and the only honest way to
   pick which gate to relax is to replay what each setting would have done.
   NO LOOK-AHEAD is the load-bearing property. The matrix at bar i sees
   rows[0..i] and nothing else; outcomes come only from bars after i. The first
   section proves it by MUTATING every future bar and checking that not one
   gate verdict moves.
   Outcomes reuse the ledger's discipline: a LIMIT entry must actually be
   touched before stop or target are evaluated, and a bar reaching both counts
   as the stop. Without that this would inherit the phantom-fill bug packs 1
   and 6 removed, and every sweep would read too high.
   Run: node tests/test-gate-replay.mjs                                       */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'cryptogates.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const rng = seed => { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };
function tape(n, seed, drift, vol){
  const r = rng(seed), out = []; let p = 100;
  for (let i = 0; i < n; i++){
    const o = p; p = p * (1 + (r() - 0.5) * vol + drift);
    out.push({ t: i * 14400, o, h: Math.max(o, p) * (1 + r() * vol * 0.4),
               l: Math.min(o, p) * (1 - r() * vol * 0.4), c: p, v: 1000 + r() * 500 });
  }
  return out;
}
/* varied beta/alpha/vol on a shared factor — an alt universe, not one asset */
function world(seed, n){
  const r = rng(seed), mkt = []; let m = 100;
  for (let i = 0; i < n; i++){ m = m * (1 + (r() - 0.5) * 0.02 + (r() < 0.5 ? 0.002 : -0.001)); mkt.push(m); }
  const beta = 0.6 + r() * 1.2, alpha = (r() - 0.5) * 0.004, vol = 0.012 + r() * 0.02;
  const out = []; let p = 100;
  for (let i = 0; i < n; i++){
    const mr = i ? (mkt[i] / mkt[i - 1] - 1) : 0, o = p;
    p = p * (1 + beta * mr + alpha + (r() - 0.5) * vol);
    out.push({ t: i * 14400, o, h: Math.max(o, p) * (1 + r() * vol * 0.4),
               l: Math.min(o, p) * (1 - r() * vol * 0.4), c: p, v: 1000 + r() * 500 });
  }
  return out;
}
const T = { symbol: 'X', fundingPct: 0.005 };
console.log('== NO LOOK-AHEAD — the load-bearing property ==');
{
  ok(typeof ctx.cgGateReplay === 'function', 'cgGateReplay is not a function');
  const base = tape(500, 7919, 0.0025, 0.02);
  const a = ctx.cgGateReplay(base, T, {});
  ok(a.aligned > 100, 'the replay produced ' + a.aligned + ' aligned samples');
  const lastI = a.samples[a.samples.length - 1].i;
  /* triple every high, third every low, double every close — AFTER the last replayed bar */
  const alt = base.map((b, k) => k > lastI ? { ...b, h: b.h * 3, l: b.l * 0.3, c: b.c * 2 } : b);
  const b = ctx.cgGateReplay(alt, T, {});
  const sig = r => r.samples.map(s => s.i + ':' + s.dir + ':' + JSON.stringify(s.pass) + ':' + JSON.stringify(s.vals)).join('|');
  ok(sig(a) === sig(b), 'not one gate verdict or raw value moved when the FUTURE was mutated');
  ok(a.clean === b.clean, 'the CLEAN count is identical');
  const changed = a.samples.filter((s, k) => s.r !== b.samples[k].r).length;
  ok(changed > 0, 'but ' + changed + ' OUTCOMES did change — they are the future, and they should');
}
console.log('== outcomes are bounded and use the fill gate ==');
{
  const all = [];
  for (let s = 1; s <= 30; s++) all.push(...ctx.cgGateReplay(world(s * 7919, 420), T, {}).samples);
  const rs = all.filter(x => x.r !== null).map(x => x.r);
  ok(rs.length > 500, rs.length + ' settled samples');
  ok(Math.min.apply(null, rs) === -1, 'the worst outcome is exactly -1R, never worse');
  /* target is the matrix ATR excursion; risk varies, so R is bounded but not constant */
  ok(Math.max.apply(null, rs) < 10, 'the best outcome is bounded (' + Math.max.apply(null, rs).toFixed(2) + 'R)');
  /* The replay deliberately uses the MATRIX entry, which is the mark — not the
     EMA21 limit that hgEnrichSwingClean puts on a live ticket. That isolates
     the GATE decision from fill behaviour, which is what a threshold sweep
     needs: otherwise a threshold change and a fill-rate change move together
     and neither can be read. The consequence is that the fill gate almost
     never fires here, and replay expectancy is therefore a market-entry
     figure that will differ from live tickets. */
  ok(all.every(x => x.state !== 'unfilled'),
     'with a mark entry the fill gate does not fire — replay is a market-entry measure');
  ok(all.filter(x => x.r === null).every(x => x.state !== 'TP' && x.state !== 'SL'),
     'anything unsettled carries null R and is excluded from every average');
}
console.log('== isFinite(null) is TRUE in JS — the target guard must check the value ==');
{
  /* This bug shipped in my first draft: t1 null -> isFinite(null) true -> target 0
     -> every long instantly "hit" it -> a 7.76R phantom win on a -1R trade.
     Same trap as the gold basis guard in pack 3. */
  const all = [];
  for (let s = 1; s <= 20; s++) all.push(...ctx.cgGateReplay(world(s * 7919, 420), T, {}).samples);
  const rs = all.filter(x => x.r !== null).map(x => x.r);
  ok(!rs.some(r => r > 5), 'no sample reports an absurd multi-R win from a zero target');
  ok(rs.filter(r => r > 0).length > 0, 'wins still exist — the guard did not just zero everything out');
}
console.log('== a sweep re-prices a threshold in COUNT and in R ==');
{
  const all = [];
  let clean = 0;
  for (let s = 1; s <= 140; s++){
    const rp = ctx.cgGateReplay(world(s * 7919, 420),
      { symbol: 'X', fundingPct: [-0.06, -0.02, 0, 0.02, 0.06][s % 5] }, {});
    all.push(...rp.samples); clean += rp.clean;
  }
  ok(clean > 5, 'the universe produced ' + clean + ' CLEAN setups at current thresholds');
  const g6 = ctx.cgReplaySweep({ samples: all }, 'G6', [1.50, 1.75, 2.00, 2.25, 2.50], 'min');
  const at = t => g6.rows.find(r => Math.abs(r.t - t) < 1e-9);
  ok(at(2.00).setups === clean, 'sweeping G6 at its CURRENT value reproduces the live CLEAN count exactly');
  ok(at(1.75).setups > at(2.00).setups, 'a lower R:R floor yields more setups');
  ok(at(2.50).setups < at(2.00).setups, 'a higher one yields fewer');
  for (let i = 1; i < g6.rows.length; i++)
    ok(g6.rows[i].setups <= g6.rows[i - 1].setups, 'monotone at t=' + g6.rows[i].t);
  ok(g6.rows.every(r => r.expectancyR === null || (r.expectancyR >= -1 && r.expectancyR < 10)),
     'every expectancy is inside the possible range');
  /* ANCHOR is inert given the other gates — pack 12 found it by correlation,
     pack 17 by sole-blocker count, and here it shows up a third way: the
     threshold can move 3x and change nothing at all. */
  const an = ctx.cgReplaySweep({ samples: all }, 'ANCHOR', [1.00, 1.50, 3.00], 'max');
  ok(an.rows[0].setups === an.rows[2].setups,
     'tripling the ANCHOR cap changes the setup count by zero');
  ok(an.rows[0].expectancyR === an.rows[2].expectancyR, 'and changes expectancy by zero');
}
console.log('== it degrades honestly ==');
{
  ok(/needs \d+\+ bars/.test(ctx.cgGateReplay(tape(50, 1, 0.002, 0.02), T, {}).note), 'thin history says what it needs');
  ok(ctx.cgGateReplay(null, T, {}).aligned === 0, 'null rows -> 0 aligned, never throws');
  ok(/no replay samples/.test(ctx.cgReplaySweep({ samples: [] }, 'G6', [2], 'min').note), 'an empty sweep says so');
  ok(ctx.cgReplaySweep(null, 'G6', [2], 'min').rows.length === 0, 'a null replay -> no rows');
  const nul = ctx.cgReplaySweep({ samples: [{ pass: {}, vals: { G6: null }, r: null }] }, 'G6', [2], 'min');
  ok(nul.rows[0].setups === 0, 'a sample with no measurable value is skipped, never counted as passing');
  ok(nul.rows[0].expectancyR === null, 'and no expectancy is invented from zero settled trades');
}
console.log('\n' + passed + ' passed, 0 failed');
