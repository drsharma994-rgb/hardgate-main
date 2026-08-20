/* HARDGATE — OMNIGOLD tickets must be the setup's own gold levels.

   Live scan (GC=F ~4535, 2026-08-20): FVG-FILL LONG triggered at 4429.10
   and the card printed ENTRY 4534.90 / STOP 3415.54. ROUND-MAGNET LONG
   reclaimed 4530 — four points from the market — and had NO PLAN at all,
   because the desk priced a generic lastSwing from the live print instead
   of the round it just named.

   That is "still no ticket" and "the levels of gold do not match that of
   the setup" as the same defect: the printed trade is not the mechanic.

   Contract:
     1. entry IS hit.level when the detector named one
     2. a sweep/reversion stop sits beyond that level (the idea dies if
        the level breaks), not a months-old swing 1000 points away
     3. continuation still uses structure / labelled vol-stop FROM the
        setup entry, skipExact so enrichers cannot hijack it
     4. the card names the setup price
     5. counter-trend TREND hits that already fail the trend gate do not
        vote in consensus (they were emptying every with-trend scalp)

   Run: node tests/test-omnigold-setup-levels.mjs */
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

function tape(n, seed, start){
  const out = []; let p = start || 4530, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.0018);
    const r = p * 0.0012 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 3600, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return out;
}
const ROWS = tape(400, 9, 4500);
const LIVE = ROWS[ROWS.length - 1].c;
const CFG = { minRr: 1.5, label: 'SCALP', sessionHard: true };

console.log('== 1. a ROUND-MAGNET plan is AT the round, not at live gold ==');
{
  const lvl = 4530;
  const rows = ROWS.map((r, i) => i < ROWS.length - 1 ? r : {
    t: r.t, o: 4532, h: 4536, l: 4526.4, c: 4534.9, v: 1200
  });
  const live = rows[rows.length - 1].c;
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl,
                why: 'reclaimed the $4530 round level from below' };
  ok(typeof W.hgOgPlanForHit === 'function', 'hgOgPlanForHit is exported');
  const pl = W.hgOgPlanForHit(hit, rows, { livePx: live }, CFG);
  ok(!!pl, 'a sweep with a named level still produces a plan (was plan-levels veto)');
  ok(Math.abs(pl.entry - lvl) < 1e-6, 'ENTRY is the round ' + lvl + ', not live ' + live.toFixed(2)
     + ' (got ' + (pl && pl.entry) + ')');
  ok(pl.stop < pl.entry, 'long stop is below the round');
  ok(pl.entry - pl.stop < 80, 'stop is a gold stop, not a months-old swing (risk '
     + (pl.entry - pl.stop).toFixed(1) + ')');
  ok(pl.stop <= 4526.4, 'stop is at or beyond the rejection wick (got ' + pl.stop.toFixed(2) + ')');
  ok(pl.t1 > pl.entry, 'T1 is beyond the round');
}

console.log('\n== 2. FVG-FILL / continuation entry is the setup level, not live ==');
{
  const setup = LIVE - 105.8;
  const hit = { kind: 'FVG-FILL', dir: 'long', level: setup, why: 'unmitigated FVG' };
  const pl = W.hgOgPlanForHit(hit, ROWS, { livePx: LIVE }, CFG);
  ok(!!pl, 'imbalance still plans');
  ok(Math.abs(pl.entry - setup) < 1e-6, 'ENTRY is the FVG ' + setup.toFixed(2) + ', not live '
     + LIVE.toFixed(2) + ' (got ' + (pl && +pl.entry) + ')');
  ok((LIVE - setup) > 50, 'this is the live defect: setup and market were 100pts apart');
  ok(Math.abs(pl.entry - LIVE) > 50, 'and the plan did NOT silently chase the market');
  ok(pl.entry - pl.stop < LIVE * 0.03, 'stop is inside 3% of gold, not a 1000-pt lastSwing');
}

console.log('\n== 3. evaluate + card name the setup price ==');
{
  const lvl = Math.round(LIVE / 10) * 10;
  const hit = { kind: 'ROUND-MAGNET', dir: 'long', level: lvl, why: 'reclaimed round' };
  const cards = W.hgOgEvaluate(ROWS, [hit], { livePx: LIVE + 4 }, CFG);
  ok(cards.length === 1, 'one card');
  ok(cards[0].plan && Math.abs(cards[0].plan.entry - lvl) < 1e-6,
     'evaluate stamps the setup entry (got ' + (cards[0].plan && cards[0].plan.entry) + ')');
  ok(/SETUP /.test(GOLD) && /fmtPx\(c\.level\)/.test(GOLD),
     'the card prints SETUP @ the detector level');
}

console.log('\n== 4. skipExact still blocks enricher hijack when there is no setup level ==');
{
  ok(/skipExact:\s*true/.test(GOLD), 'skipExact stays on the continuation path');
  const hit = { kind: 'ORB', dir: 'long', why: 'closed above ORB' }; /* no level */
  const pl = W.hgOgPlanForHit(hit, ROWS, { livePx: LIVE }, CFG);
  if (pl){
    ok(Math.abs(pl.entry - LIVE) < 1e-6, 'no setup level → live market is the honest proxy');
  } else {
    ok(true, 'no plan is acceptable when structure cannot clear — just not a hijacked EMA21');
  }
}

console.log('\n== 5. counter-trend TREND hits do not vote against a with-trend setup ==');
{
  /* EMA stack on ROWS is whatever the tape produced. Force a rising stack
     by using the live rally tape from §1's last bars — ROWS drifts up
     (rnd-0.48). Build voters the desk uses. */
  const longs = [
    { kind: 'PO3', dir: 'long', level: LIVE, why: 't' },
    { kind: 'ROUND-MAGNET', dir: 'long', level: LIVE, why: 't' }
  ];
  const shorts = [
    { kind: 'ORB', dir: 'short', level: LIVE, why: 't' },
    { kind: 'MMOVE', dir: 'short', level: LIVE, why: 't' },
    { kind: 'BOS-RETEST', dir: 'short', level: LIVE, why: 't' }
  ];
  ok(typeof W.hgOgConsensusVoters === 'function', 'voter filter is exported');
  const all = longs.concat(shorts);
  const voters = W.hgOgConsensusVoters(all, ROWS, { htf: { e21: LIVE + 40, e50: LIVE } });
  const kinds = voters.map(h => h.kind + ':' + h.dir).sort().join(',');
  ok(!/ORB:short/.test(kinds) && !/MMOVE:short/.test(kinds) && !/BOS-RETEST:short/.test(kinds),
     'TREND shorts against a rising daily/EMA stack do not vote: ' + kinds);
  ok(/PO3:long/.test(kinds), 'the with-trend continuation still votes');
  const g = (W.hgOgGates(ROWS, longs[0], {
    allHits: all, htf: { e21: LIVE + 40, e50: LIVE }, minRr: 1.5, planRisk: 12,
    plan: { entry: LIVE, stop: LIVE - 15, t1: LIVE + 30 }
  }) || []).filter(x => x && x.key === 'consensus')[0];
  ok(g && g.pass === true, 'consensus PASSES for the with-trend long once the rejected shorts stop voting (got '
     + (g && g.pass) + ' — ' + ((g && g.why) || '') + ')');
}

console.log('\n== 6. a genuine two-sided tape still vetoes — the gate is not gone ==');
{
  const all = [
    { kind: 'ORB', dir: 'long', level: LIVE, why: 't' },
    { kind: 'ROUND-MAGNET', dir: 'short', level: LIVE, why: 't' }
  ];
  /* No HTF / a flat stack: neither side is a rejected continuation. */
  const g = (W.hgOgGates(ROWS, all[0], { allHits: all, minRr: 1.5, planRisk: 12 }) || [])
    .filter(x => x && x.key === 'consensus')[0];
  ok(g && g.pass === false, 'ORB long vs ROUND-MAGNET short is still a real veto when both are eligible');
  ok(g.info !== true, 'consensus is still not an info gate');
}

console.log('\n== 7. STRONGEST prefers a nearby ticket over a 6×ATR FVG ==');
{
  const far = {
    horizon: 'SWING', kind: 'FVG-FILL', dir: 'long', distAtr: 6.2,
    grade: { ticket: true, vetoes: [] },
    plan: { entry: 4429.10, stop: 4318.37, t1: 4650, momentumStop: false }
  };
  const near = {
    horizon: 'SWING', kind: 'THREE-BAR', dir: 'long', distAtr: 1.67,
    grade: { ticket: true, vetoes: [] },
    plan: { entry: 4506, stop: 4499.97, t1: 4518, momentumStop: false }
  };
  /* Ranked as the live desk was: higher-consensus FVG first. */
  const pick = W.hgOgPickFor([far, near], 'SWING');
  ok(pick && pick.kind === 'THREE-BAR',
     'STRONGEST is the 1.7×ATR THREE-BAR, not the 6×ATR FVG (got ' + (pick && pick.kind) + ')');
  const onlyFar = W.hgOgPickFor([far], 'SWING');
  ok(onlyFar && onlyFar.kind === 'FVG-FILL',
     'a far FVG still wins STRONGEST when nothing nearer ticketed');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIGOLD SETUP-LEVEL TESTS PASSED');
