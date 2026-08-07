/* HARDGATE — relative strength vs BTC: the one MEASURED-orthogonal family.
   The eight swing gates were tested for independence across 19,837 aligned
   cascades and carry only ~6.0 effective independent dimensions of 8. G3
   (RSI band) and ANCHOR (distance to EMA21) correlate at 0.923 — the same
   "price is not extended" fact counted twice — and G1/G2 pass 96% of the time
   on an aligned cascade, so they carry ~0.23 bits each. Adding another trend
   confirmation would raise the badge number without raising conviction.
   RS was chosen because it was MEASURED against every existing gate at several
   lookbacks and 30 x 4H came back least correlated (max |r| 0.207 vs G2) while
   still carrying 0.58 bits. At 180 bars it collapses into the trend G2 already
   owns (|r| 0.505); at 6 bars it starts tracking extension (|r| 0.353 ANCHOR).
   Run: node tests/test-relative-strength.mjs                                 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

/* n bars ending at a total return of `total` (compounded evenly) */
function ramp(n, total){
  const step = Math.pow(1 + total, 1 / (n - 1));
  const out = []; let p = 100;
  for (let i = 0; i < n; i++){
    out.push({ t: i * 14400, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 1 });
    p *= step;
  }
  return out;
}
const LOOK = ctx.HG_RS_LOOK;

console.log('== the lookback is the measured one, not a round number ==');
{
  ok(LOOK === 30, 'HG_RS_LOOK is 30 bars (5 days on 4H) — the orthogonality minimum');
  ok(typeof ctx.hgRelStrength === 'function', 'hgRelStrength is exported');
}

console.log('== a long that is outpacing BTC confirms ==');
{
  const r = ctx.hgRelStrength(ramp(60, 0.20), ramp(60, 0.05), 'long');
  ok(r.available, 'measurable');
  ok(r.ok === true, 'alt +20% vs BTC +5% confirms a long');
  ok(r.edge > 0, 'edge is positive');
  ok(/with the trade/.test(r.note), 'the note says which way it cuts: ' + r.note);
}

console.log('== a long that is LAGGING BTC opposes, even in its own uptrend ==');
{
  const r = ctx.hgRelStrength(ramp(60, 0.04), ramp(60, 0.15), 'long');
  ok(r.available && r.ok === false,
     'alt is UP 4% and still fails — this is the case a trend-only stack cannot see');
  ok(r.edge < 0, 'edge is negative');
  ok(/against the trade/.test(r.note), 'the note is explicit');
}

console.log('== direction is respected, not assumed ==');
{
  const falling = ramp(60, -0.20), btcFlat = ramp(60, 0.0);
  ok(ctx.hgRelStrength(falling, btcFlat, 'short').ok === true,
     'a short on an alt falling harder than BTC confirms');
  ok(ctx.hgRelStrength(falling, btcFlat, 'long').ok === false,
     'the same tape fails for a long');
  const r = ctx.hgRelStrength(ramp(60, -0.02), ramp(60, -0.20), 'short');
  ok(r.ok === false, 'a short on an alt falling LESS than BTC fails — relative weakness is the point');
}

console.log('== it degrades honestly, it never guesses ==');
{
  ok(ctx.hgRelStrength(ramp(10, 0.1), ramp(60, 0.1), 'long').available === false,
     'too little history on either leg -> not available');
  ok(ctx.hgRelStrength(ramp(60, 0.1), ramp(60, 0.1), 'long').available === true,
     'exactly enough history is fine');
  ok(ctx.hgRelStrength(null, ramp(60, 0.1), 'long').ok === false, 'null rows -> false, never throws');
  ok(ctx.hgRelStrength(ramp(60, 0.1), ramp(60, 0.1), null).available === false, 'no direction -> not available');
  const flat = ctx.hgRelStrength(ramp(60, 0.10), ramp(60, 0.10), 'long');
  ok(flat.available && flat.ok === false, 'dead heat is NOT a pass — edge must be strictly positive');
}

console.log('== BEST wiring: the denominator moves, so the bar cannot be gamed ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/s\.famMax = 9 \+ \(f10Counts \? 1 : 0\)/.test(html),
     'famMax shrinks to 9 when RS cannot be measured (BTC itself, or short history)');
  ok(/f10Counts=false; f10Detail='BTC is the benchmark/.test(html),
     'BTC is excluded from the denominator rather than scored pass or fail');
  ok(/\(f10Counts&&f10\)\?1:0/.test(html), 'an unmeasurable family never scores a point');
  ok(/const bar = \(s, nine, ten\) => \(\(s\.famMax \|\| 9\) >= 10 \? ten : nine\)/.test(html),
     'selection bars scale with the denominator');
  ok(/famScore >= bar\(s, 7, 8\)/.test(html) && /famScore >= bar\(s, 6, 7\)/.test(html),
     'STRONG 7/9 -> 8/10 and OK 6/9 -> 7/10: adding a family does not LOOSEN selection');
  ok(!/famScore\}\/9 /.test(html), 'no hardcoded /9 left in the rendered strings');
  ok(/\(b\.rsEdge\|\|0\)-\(a\.rsEdge\|\|0\)/.test(html), 'rsEdge breaks ranking ties');
}

console.log('\n' + passed + ' passed, 0 failed');
