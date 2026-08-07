/* HARDGATE — how many bets do you ACTUALLY have?
   THE GAP. lib/paperbook-core.mjs caps total heat at 6% of NAV and sums it as
   if every position were an independent bet. It is not. Four alt longs at 1.5%
   risk each read as "6% spread across four names"; if they run 0.90 correlated
   they are ONE idea at about 5.7%. That is the ordinary way a genuinely good
   win rate still produces a drawdown that feels impossible — the entries were
   right, the sizing was wrong, and nothing in the app could see it.
   pbBucket was the only defence and it is blunt: every crypto perp lands in one
   'crypto' bucket at 35% NAV. That catches "all in crypto" and nothing finer.
   SOL and AVAX and LINK are the same trade; SOL and a XAUTUSD short are not.
   The old updatePortfolioHeat compared the NEW symbol against BTC and warned
   only if a BTC position happened to be open — it could not see four correlated
   alts at all.
   THE MATHS, w_i = risk as a fraction of NAV, SIGNED by direction so a hedge
   subtracts:
       nominal heat    H     = sum |w_i|
       correlated heat H_eff = sqrt(w' C w)
       effective bets  N_eff = (sum |w_i|)^2 / (w' C w)
   Both limits fall out rather than being special-cased: all correlations 1
   gives N_eff = 1 and H_eff = H; all zero with equal size gives N_eff = n.
   Run: node tests/test-portfolio-concentration.mjs                           */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const ctx = { console, Math, isFinite, parseFloat, JSON, Array, Object, Number, String };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
/* Exact matrices, so the limits are arithmetic and not a sampling result. */
const eye = n => { const m = []; for (let i = 0; i < n; i++){ m.push([]); for (let j = 0; j < n; j++) m[i].push(i === j ? 1 : 0); } return m; };
const ones = n => { const m = []; for (let i = 0; i < n; i++){ m.push([]); for (let j = 0; j < n; j++) m[i].push(1); } return m; };
const syms = n => new Array(n).fill(0).map((_, i) => 'S' + i);
const pos = (n, risk, dirs) => syms(n).map((s, i) => ({ sym: s, dir: dirs ? dirs[i] : 'long', riskPct: risk }));
console.log('== the two limits are exact, not approximate ==');
{
  const C1 = { syms: syms(4), m: ones(4), n: 4 };
  const k1 = ctx.hgPortfolioConcentration(pos(4, 0.015), C1);
  ok(Math.abs(k1.effectiveBets - 1) < 1e-9, 'perfectly correlated: exactly 1.00 effective bet');
  ok(Math.abs(k1.effectiveHeat - k1.nominalHeat) < 1e-9, 'and effective heat EQUALS nominal — 6% on one idea');
  const C0 = { syms: syms(4), m: eye(4), n: 4 };
  const k0 = ctx.hgPortfolioConcentration(pos(4, 0.015), C0);
  ok(Math.abs(k0.effectiveBets - 4) < 1e-9, 'perfectly independent: exactly 4.00 effective bets');
  ok(Math.abs(k0.effectiveHeat - 0.03) < 1e-9, 'and effective heat is 3% — the sqrt(4) reduction');
  ok(k0.nominalHeat === k1.nominalHeat, 'nominal heat is identical in both — which is the whole point');
}
console.log('== a hedge subtracts, it does not add ==');
{
  const C = { syms: syms(2), m: ones(2), n: 2 };
  const same = ctx.hgPortfolioConcentration(pos(2, 0.02, ['long', 'long']), C);
  const hedge = ctx.hgPortfolioConcentration(pos(2, 0.02, ['long', 'short']), C);
  ok(Math.abs(same.effectiveHeat - 0.04) < 1e-9, 'two correlated longs carry the full 4%');
  ok(hedge.effectiveHeat === 0, 'a perfectly correlated long+short nets to zero directional heat');
  ok(/hedge/.test(hedge.note), 'and the note says so rather than printing a bare 0');
  ok(same.nominalHeat === hedge.nominalHeat, 'nominal heat cannot tell the two apart');
}
console.log('== N_eff is capped at the position count ==');
{
  /* a slightly NEGATIVE average correlation can push the raw ratio above n */
  const m = [[1, -0.3, -0.3], [-0.3, 1, -0.3], [-0.3, -0.3, 1]];
  const k = ctx.hgPortfolioConcentration(pos(3, 0.02), { syms: syms(3), m, n: 3 });
  ok(k.effectiveBets <= 3 + 1e-9, 'never reports more bets than positions (' + k.effectiveBets.toFixed(2) + ')');
  ok(k.capped === true, 'and flags that the raw ratio was capped');
  const plain = ctx.hgPortfolioConcentration(pos(3, 0.02), { syms: syms(3), m: eye(3), n: 3 });
  ok(plain.capped === false, 'an uncapped case is not flagged');
}
console.log('== correlation is measured from real series ==');
{
  function rng(seed){ let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function series(n, seed, beta){
    const r = rng(seed), f = rng(4242), out = []; let p = 100;
    for (let i = 0; i < n; i++){
      const mk = (f() - 0.5) * 0.03;
      p = p * (1 + beta * mk + (1 - Math.abs(beta)) * (r() - 0.5) * 0.03);
      out.push({ c: p });
    }
    return out;
  }
  const tight = ctx.hgCorrMatrix({ A: series(120, 11, 0.99), B: series(120, 22, 0.99) });
  ok(tight.n === 2 && tight.m[0][1] > 0.9, 'two names on the same factor measure r > 0.9');
  const loose = ctx.hgCorrMatrix({ A: series(120, 11, 0.02), B: series(120, 22, 0.02) });
  ok(Math.abs(loose.m[0][1]) < 0.3, 'two idiosyncratic names measure near zero');
  ok(tight.m[0][0] === 1 && tight.m[1][1] === 1, 'the diagonal is exactly 1');
  ok(tight.m[0][1] === tight.m[1][0], 'the matrix is symmetric');
}
console.log('== it degrades honestly ==');
{
  ok(ctx.hgCorrMatrix({}).n === 0, 'no series -> n 0');
  ok(/needs 2\+/.test(ctx.hgCorrMatrix({ A: new Array(30).fill({ c: 1 }) }).note), 'one series says what it needs');
  ok(/needs 2\+/.test(ctx.hgCorrMatrix({ A: [{ c: 1 }], B: [{ c: 1 }] }).note), 'too few bars says what it needs');
  const one = ctx.hgPortfolioConcentration([{ sym: 'S0', dir: 'long', riskPct: 0.02 }], { syms: ['S0'], m: [[1]], n: 1 });
  ok(one.effectiveBets === null && /nothing to concentrate/.test(one.note), 'a single position reports null, not 1.00');
  const none = ctx.hgPortfolioConcentration([], { syms: [], m: [], n: 0 });
  ok(none.n === 0 && none.effectiveBets === null, 'no positions -> null');
  ok(ctx.hgPairCorr([1, 2], [1, 2], 2) === 0, 'too few pairs -> 0 (treated INDEPENDENT, never NaN)');
  const flat = new Array(40).fill(0);
  ok(ctx.hgPairCorr(flat, flat, 40) === 0, 'zero variance -> 0 rather than a divide-by-zero');
}
console.log('== the tightest pair is named ==');
{
  const m = [[1, 0.95, 0.1], [0.95, 1, 0.1], [0.1, 0.1, 1]];
  const k = ctx.hgPortfolioConcentration(pos(3, 0.02), { syms: syms(3), m, n: 3 });
  ok(k.worstPair && k.worstPair.r > 0.9, 'the 0.95 pair is surfaced, not just the aggregate');
  ok((k.worstPair.a === 'S0' && k.worstPair.b === 'S1'), 'and it names both legs');
}
console.log('\n' + passed + ' passed, 0 failed');
