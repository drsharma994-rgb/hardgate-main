/* HARDGATE — the root cause of the empty funnel was a horizon mismatch.
   Twenty packs in, alert-state.json still reads setups 0 and ticket null. The
   gate everyone kept pointing at was G6, the R:R floor. G6 was not the
   problem. The stop it measures was.
       var stop = lastSwing(rows, dir, 30);
   On 4H that is a FIVE DAY range. ATR(14) on 4H spans about 2.3 days. G6 caps
   risk at EXP/RR_MIN = 3.5/2.0 = 1.75 xATR — so the code was asking a 5-day
   swing extreme to sit inside 1.75x a 2.3-day volatility measure.
   Measured over 3,346 aligned cascades:
       lookback  ~days   median stop   within the 1.75 cap   max R:R at median
            5     0.8      1.39 ATR          62.8%                2.53R
            8     1.3      1.87 ATR          45.9%                1.87R
           10     1.7      2.14 ATR          38.3%                1.64R
           20     3.3      3.43 ATR          12.7%                1.02R
           30     5.0      4.53 ATR           3.6%                0.77R   <- was hardcoded
   At 30 the MEDIAN setup cannot reach 1:1, let alone 2:1. Lowering
   CG_SWING_RR_MIN would have "fixed" the count by accepting genuinely worse
   reward-to-risk. The horizon is the lever.
   This does NOT change the default. 30 stays. It becomes a PARAMETER so the
   CALIBRATE sweep can price it on real candles instead of my synthetic ones.
   Run: node tests/test-swing-lookback.mjs                                    */
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
ctx.hgStructureGate = () => ({ veto: false, bos: true });
ctx.detectRegime = () => ({ regime: 'trend', label: 'trend' });
const rng = seed => { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };
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
console.log('== the default is unchanged ==');
{
  /* Pack 21 introduced the parameter at 30. Pack 22 moved it to 20 on outcome
     evidence — two independent 120-symbol samples where 30 produced only 19
     settled trades and an expectancy that swung 0.848R / 0.218R between them. */
  ok(ctx.CG_SWING_LOOK === 20, 'CG_SWING_LOOK is 20 since fix pack 22');
  const a = ctx.swingGateMatrix(world(7919, 300), T);
  const b = ctx.swingGateMatrix(world(7919, 300), T, {});
  const c = ctx.swingGateMatrix(world(7919, 300), T, { swingLook: ctx.CG_SWING_LOOK });
  ok(a.stop === b.stop && b.stop === c.stop, 'no opts, empty opts and an explicit CG_SWING_LOOK all agree');
  ok(ctx.swingGateMatrix(world(7919, 300), T, { swingLook: 0 }).stop === a.stop, 'a nonsense lookback falls back to the default');
  ok(ctx.swingGateMatrix(world(7919, 300), T, { swingLook: -5 }).stop === a.stop, 'negative too');
}
console.log('== a shorter lookback really does move the stop closer ==');
{
  const rows = world(7919, 300);
  const m30 = ctx.swingGateMatrix(rows, T, { swingLook: 30 });
  const m10 = ctx.swingGateMatrix(rows, T, { swingLook: 10 });
  const m5  = ctx.swingGateMatrix(rows, T, { swingLook: 5 });
  const d = m => Math.abs(m.entry - m.stop) / m.a4;
  ok(m30.dir && m30.dir === m10.dir && m10.dir === m5.dir, 'direction is unaffected — only the stop moves');
  ok(d(m5) <= d(m10) + 1e-9, 'a 5-bar stop is no further than a 10-bar stop');
  ok(d(m10) <= d(m30) + 1e-9, 'and a 10-bar is no further than a 30-bar');
  ok(m5.dynamicRR >= m30.dynamicRR - 1e-9, 'so the implied R:R can only improve as the horizon shortens');
}
console.log('== the horizon mismatch is real, and it is the binding constraint ==');
{
  const dist = {}; [5, 10, 30].forEach(k => dist[k] = []);
  for (let s = 1; s <= 1500; s++){
    const rows = world(s * 7919, 300);
    const m = ctx.swingGateMatrix(rows, T);
    if (!m || !m.dir) continue;
    [5, 10, 30].forEach(k => {
      const sw = ctx.lastSwing(rows, m.dir, k);
      if (isFinite(sw) && m.a4 > 0) dist[k].push(Math.abs(m.p - sw) / m.a4);
    });
  }
  const med = k => { const a = dist[k].slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  const within = k => dist[k].filter(x => x <= 1.75).length / dist[k].length;
  ok(dist[30].length > 500, 'sampled ' + dist[30].length + ' aligned cascades');
  ok(med(30) > 3.5, 'the 30-bar stop sits a median ' + med(30).toFixed(2) + ' ATR away');
  ok(3.5 / med(30) < 1.0, 'so the MEDIAN 30-bar setup cannot even reach 1:1 (' + (3.5 / med(30)).toFixed(2) + 'R)');
  ok(within(30) < 0.10, 'under 10% of 30-bar stops fit inside the 1.75 cap (' + (100 * within(30)).toFixed(1) + '%)');
  ok(within(5) > 0.40, 'over 40% of 5-bar stops do (' + (100 * within(5)).toFixed(1) + '%)');
  ok(med(5) < med(10) && med(10) < med(30), 'the distance rises monotonically with the horizon');
}
console.log('== the replay honours the parameter, so CALIBRATE can sweep it ==');
{
  const rows = world(11279156, 420);
  const a = ctx.cgGateReplay(rows, T, { swingLook: 30 });
  const b = ctx.cgGateReplay(rows, T, { swingLook: 8 });
  ok(a.aligned === b.aligned, 'the aligned-bar count is identical — only the stop changed');
  ok(a.samples.length === b.samples.length, 'and so is the sample count');
  const g6 = r => r.samples.map(s => s.vals.G6).filter(v => v !== null && isFinite(v));
  const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
  ok(mean(g6(b)) > mean(g6(a)), 'the shorter horizon reports a higher mean dynamicRR');
  ok(b.clean >= a.clean, 'and produces at least as many CLEAN setups (' + a.clean + ' -> ' + b.clean + ')');
}
console.log('== CALIBRATE shows it, and flags where you are ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/const HG_DIAG_LOOKS = \[5, 8, 10, 15, 20, 30\];/.test(html), 'the sweep values are a named constant');
  ok(/swingLook: L/.test(html), 'each lookback is passed into the replay');
  ok(/← current/.test(html), 'the current setting is marked in the table');
  ok(/CG_SWING_LOOK/.test(html), 'and the panel title reads the live constant');
  ok(/HG_DIAG_LOOK_SYMBOLS/.test(html), 'the heavier sweep uses its own smaller symbol budget');
  ok(/cachedRows/.test(html), 'candles are reused across lookbacks — CPU, not network');
}
console.log('\n' + passed + ' passed, 0 failed');
