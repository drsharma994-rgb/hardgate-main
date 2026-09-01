/* HARDGATE — OMNIROUTE / OMNIPRESENT / OMNIGOLD advanced edge.

   Conservative rank + MOST PROBABLE promotion. Not a win probability.
   Wilson lower-bound expectancy vs T1 R, then consensus / tape / fill /
   cost / formation. Named entries stay put. Missing data fail-open.
   Fail-closed only on evidence (against tape, n≥20 toxic E, fat cost,
   thin-and-far fill, formation.formed === false).

   Sacred contracts unchanged:
     OMNIROUTE ENTRY = hit.level
     OMNIPRESENT TRIGGERED = livePx
     OMNIGOLD native ENTRY = hit.level
     no stack3 in hgOmniRank

   Run: node tests/test-omni-advanced-edge.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUTE = read('omniroute.js');
const PRESENT = read('omnipresent.js');
const GOLD = read('omnigold.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','formation.js','formation-live.js',
                   'omniroute.js','omnigold.js','omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function tape(n, seed, start){
  const out = []; let p = start || 60000, s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    out.push({ t: 1700000000 + i * 14400, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 1200 });
  }
  return out;
}

function ticket(over){
  return Object.assign({
    base: 'BTC',
    sym: 'BTCUSD',
    kind: 'ORB',
    dir: 'long',
    grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
    plan: { entry: 68000, stop: 66000, t1: 72000, t2: 74000, rr1: 2.0 },
    distAtr: 0.5,
    consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: []
  }, over || {});
}

console.log('== exports + wiring ==');
{
  const W = boot();
  ok(typeof W.hgOmniAdvancedEdge === 'function', 'hgOmniAdvancedEdge exported');
  ok(typeof W.hgOmniWilsonLower === 'function', 'hgOmniWilsonLower exported');
  ok(typeof W.hgOmniStampEdge === 'function', 'hgOmniStampEdge exported');
  ok(/edgeScore/.test(ROUTE.slice(ROUTE.indexOf('function hgOmniRank'))),
     'hgOmniRank reads edgeScore');
  const rankBody = ROUTE.slice(ROUTE.indexOf('function hgOmniRank'),
    ROUTE.indexOf('function', ROUTE.indexOf('function hgOmniRank') + 10));
  ok(rankBody.indexOf('stack3') < 0, 'hgOmniRank still never reads stack3');
  ok(/hgOmniStampEdge/.test(ROUTE) && /hgOmniStampEdge/.test(PRESENT) && /hgOmniStampEdge/.test(GOLD),
     'all three desks stamp the edge');
  ok(/edgePass === false/.test(ROUTE), 'MOST PROBABLE skips explicit edge fails');
}

console.log('\n== Wilson lower bound ==');
{
  const W = boot();
  const lo = W.hgOmniWilsonLower(50, 100, 1.96);
  ok(isFinite(lo) && lo > 0.39 && lo < 0.42, 'n=100 p=0.5 lower ≈ 0.403 (got ' + lo + ')');
  ok(W.hgOmniWilsonLower(0, 0, 1.96) == null, 'n=0 is null, not a fake 0%');
  ok(W.hgOmniWilsonLower(8, 40, 1.96) < 0.2, 'small-n 20% hit shrinks below the raw rate');
}

console.log('\n== missing data fail-open, prior is breakeven at T1 ==');
{
  const W = boot();
  const e = W.hgOmniAdvancedEdge(ticket());
  ok(e.pass === true, 'no replay → pass (got ' + e.pass + ' / ' + e.why + ')');
  ok(isFinite(e.score) && e.score >= 35 && e.score <= 70,
     'unproven ticket scores mid-pack (got ' + e.score + ')');
  ok(Math.abs(e.t1R - 2) < 1e-9, 'T1 R is 2 from the plan');
  ok(/not a win/i.test(String(e.why || '') + ' not a win probability'),
     'why never claims a guaranteed win');
}

console.log('\n== fail-closed only on evidence ==');
{
  const W = boot();
  const toxic = W.hgOmniAdvancedEdge(ticket({
    replay: { n: 40, hit: 0.20, costR: 0.05 }
  }));
  ok(toxic.pass === false, 'n≥20 and toxic Wilson E fails closed (E=' + toxic.E + ' ' + toxic.why + ')');
  ok(isFinite(toxic.E) && toxic.E < -0.05, 'toxic E is actually negative (got ' + toxic.E + ')');

  const thinN = W.hgOmniAdvancedEdge(ticket({
    replay: { n: 5, hit: 0, costR: 0.05 }
  }));
  ok(thinN.pass === true, 'n<20 anecdote does not veto (got ' + thinN.why + ')');

  const against = W.hgOmniAdvancedEdge(ticket({ againstTape: true }));
  ok(against.pass === false, 'against-tape fails closed');

  const fam = W.hgOmniAdvancedEdge(ticket({
    consensus: { nAgree: 0, nAgainst: 3, nSplit: 0, agree: [], against: ['TREND'], split: [] }
  }));
  ok(fam.pass === false, 'families against fail closed');

  const fat = W.hgOmniAdvancedEdge(ticket({ costR: 0.40 }));
  ok(fat.pass === false, 'costR > 0.30 fails closed');

  const formedNo = W.hgOmniAdvancedEdge(ticket({
    formation: { formed: false }
  }));
  ok(formedNo.pass === false, 'formation.formed===false fails closed');

  const thinFar = W.hgOmniAdvancedEdge(ticket({
    distAtr: 2.6, plan: { entry: 68000, stop: 66000, t1: 72000, rr1: 2, fillProb: 20, fillNote: 'thin' }
  }));
  ok(thinFar.pass === false, 'thin fill far from entry fails closed');

  const thinNear = W.hgOmniAdvancedEdge(ticket({
    distAtr: 0.2, plan: { entry: 68000, stop: 66000, t1: 72000, rr1: 2, fillProb: 20, fillNote: 'thin' }
  }));
  ok(thinNear.pass === true, 'thin fill at the market still passes');
}

console.log('\n== paid replay outranks unproven when evidence ties ==');
{
  const W = boot();
  const paid = W.hgOmniAdvancedEdge(ticket({
    replay: { n: 40, hit: 0.55, costR: 0.05 },
    replaySurvivor: true
  }));
  const cold = W.hgOmniAdvancedEdge(ticket());
  ok(paid.pass === true && paid.score > cold.score,
     'measured-positive edge scores above unproven (' + paid.score + ' > ' + cold.score + ')');
}

console.log('\n== rank: edge after formation, formation still wins the existing test ==');
{
  const W = boot();
  const byForm = W.hgOmniRank([
    { base: 'A', grade: { ticket: true, evaluated: 10 }, consensus: { nAgree: 2 }, rr: 2, formationScore: 12 },
    { base: 'B', grade: { ticket: true, evaluated: 10 }, consensus: { nAgree: 2 }, rr: 2, formationScore: 28 }
  ]);
  ok(byForm[0].base === 'B', 'higher formationScore still ranks first without edgeScore');

  const byEdge = W.hgOmniRank([
    { base: 'A', grade: { ticket: true, evaluated: 10 }, consensus: { nAgree: 2 }, rr: 2, formationScore: 40, edgeScore: 20 },
    { base: 'B', grade: { ticket: true, evaluated: 10 }, consensus: { nAgree: 2 }, rr: 2, formationScore: 40, edgeScore: 80 }
  ]);
  ok(byEdge[0].base === 'B', 'tied formation → higher edgeScore ranks first');
}

console.log('\n== MOST PROBABLE skips explicit edge fails, fail-open when every ticket fails ==');
{
  const W = boot();
  const good = ticket({ sym: 'ETHUSD', base: 'ETH', edgePass: true, edgeScore: 70 });
  const bad = ticket({ sym: 'BTCUSD', base: 'BTC', edgePass: false, edgeScore: 10,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] } });
  const few = W.hgOmniPickFew([bad, good], 'long', 3);
  ok(few.length === 1 && few[0].sym === 'ETHUSD',
     'explicit edge fail is skipped when a passer exists (got ' + few.map(x => x.sym).join(',') + ')');

  const onlyBad = W.hgOmniPickFew([bad], 'long', 3);
  ok(onlyBad.length === 1 && onlyBad[0].sym === 'BTCUSD',
     'fail-open: a lone edge-fail still shows rather than emptying the panel');

  const unset = ticket({ sym: 'SOLUSD', base: 'SOL' });
  const raw = W.hgOmniPickFew([unset], 'long', 3);
  ok(raw.length === 1 && raw[0].sym === 'SOLUSD', 'missing edgePass is still picked (compat)');
}

console.log('\n== gold balance chorus still beats lonely; edge is a last lean ==');
{
  const W = boot();
  const lonelyNear = Object.assign(ticket({
    horizon: 'SCALP', dir: 'short', kind: 'ROUND-MAGNET', distAtr: 0.15,
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] },
    gates: [{ key: 'ema-stack', info: true, pass: false }, { key: 'rsi-zone', info: true, pass: false }],
    plan: { entry: 3390, stop: 3410, t1: 3350, t2: 3320, rr1: 2.0 }
  }), {});
  const chorus = Object.assign(ticket({
    horizon: 'SCALP', dir: 'short', kind: 'ORB', distAtr: 1.5,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['TREND','SWEEP','IMBALANCE','INTERMARKET'], against: [], split: [] },
    gates: [
      { key: 'ema-stack', info: true, pass: true },
      { key: 'rsi-zone', info: true, pass: true },
      { key: 'session-vwap', info: true, pass: true },
      { key: 'adx-trend', info: true, pass: true }
    ],
    plan: { entry: 3390, stop: 3410, t1: 3350, t2: 3320, rr1: 2.0 }
  }), {});
  ok(W.hgOgBalanceScore(chorus, 'short') > W.hgOgBalanceScore(lonelyNear, 'short'),
     'chorus still outranks lonely with no edgeScore');

  const quiet = Object.assign(ticket({
    horizon: 'SCALP', dir: 'short', kind: 'THREE-BAR', distAtr: 0.4,
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] },
    gates: [],
    plan: { entry: 3390, stop: 3410, t1: 3350, rr1: 2 },
    edgeScore: 20, edgePass: true
  }), {});
  const paid = Object.assign(ticket({
    horizon: 'SCALP', dir: 'short', kind: 'ORB', distAtr: 0.5,
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] },
    gates: [],
    plan: { entry: 3388, stop: 3408, t1: 3348, rr1: 2 },
    edgeScore: 88, edgePass: true
  }), {});
  const pick = W.hgOgPickFor([quiet, paid], 'SCALP', 'short');
  ok(pick === paid, 'equal families → higher edgeScore is STRONGEST (got ' + (pick && pick.kind) + ')');
}

console.log('\n== named entries survive the stamp ==');
{
  const W = boot();
  const rows = tape(180, 11, 60000);
  const LIVE = rows[rows.length - 1].c;
  const lvl = LIVE - 420;
  const hit = { kind: 'VALUE', dir: 'long', level: lvl, why: 'VAL reject' };
  const pl = W.hgOmniPlanForHit(hit, rows, { livePx: LIVE });
  const formed = W.hgOmniFormTicket(pl, hit, rows, { livePx: LIVE, sym: 'BTCUSD' });
  ok(formed && formed.ok === true, 'formation still accepts');
  ok(Math.abs(formed.plan.entry - lvl) < 1e-6, 'OMNIROUTE ENTRY still the named level');
  ok(isFinite(+formed.plan.edgeScore), 'form ticket stamps edgeScore on the plan');

  const live = 107.4;
  const cand = {
    dir: 'long', status: 'TRIGGERED',
    entry: live, stop: 106.2, t1: 109.8, t2: 112, rr1: 2, rr2: 5,
    atr: 0.4, zone: { lo: 106.5, hi: 107.1, confluence: 3, srcs: ['swing low'] },
    evidence: ['RSI divergence', 'volume climax'],
    trigger: 'close back', score: 40, sym: 'ETHUSD'
  };
  W.opFormCandidate(cand, tape(160, 3, 107), live);
  ok(Math.abs(cand.entry - live) < 1e-9, 'OMNIPRESENT TRIGGERED entry stays livePx');
  ok(isFinite(+cand.edgeScore), 'OMNIPRESENT stamps edgeScore');
}

console.log('\n== cards print EDGE, never a guaranteed-win claim ==');
{
  ok(/EDGE/.test(ROUTE) && /EDGE/.test(PRESENT) && /og-edge|EDGE/.test(GOLD),
     'all three desks print an EDGE readout');
  const ui = ROUTE + PRESENT + GOLD;
  ok(!/surely win|guaranteed win|will surely|100% win|cannot lose/i.test(ui),
     'UI never promises a sure win');
  ok(/not a win probability/i.test(ROUTE) && /not a win probability/i.test(GOLD),
     'MOST PROBABLE copy still refuses a fake probability');
}

console.log('\n== version ==');
{
  ok(/^hg-v\d+$/.test(HG_VER), 'build stamp is hg-vN (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNI ADVANCED EDGE TESTS PASSED');
