/* HARDGATE — the combined SCALP and SWING setups really do use everything.

   THE ASK: combine all the indicators and strategies into gold scalp and
   swing setups. The honest finding is that the combining layer already
   existed — hgOgBalanceParts scores each candidate on mechanic FAMILIES plus
   indicator INFO-READS plus coverage, proximity and tape, and hgOgPickFor
   turns that into up to one SCALP and one SWING pick (the MOST PROBABLE
   SETUPS panel). Building a second one would have been the duplication
   mistake this file has already made once, with the indicator-stack gate.

   So the work is not a new combiner. It is proving that everything added
   actually REACHES the existing one, because both paths are silent when they
   fail:

     1. A new MECHANIC reaches the score through OG_FAMILY -> consensus ->
        the `family` term. Miss the family map and the mechanic still fires
        and still shows a card, but contributes nothing to the combined pick
        — or worse, lands in 'OTHER' with every other unmapped mechanic and
        votes as a bloc.

     2. A new INDICATOR GATE reaches the score through hgOgInfoNet -> the
        `infoRatio` term, which counts every gate declared info:true. Declare
        one without the flag and it silently becomes a VETO instead of a
        read; declare it with the flag but never push it and the score simply
        never sees it.

   Both terms are RATIOS by design ("40 mechanics cannot drown 12
   oscillators"), so this file also checks that adding reads does not tilt the
   scale by weight of numbers — which is the failure mode of every confluence
   score that counts votes instead of balancing them.

   Run: node tests/test-omnigold-combined-setup.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'goldind.js', 'pinegoldmath.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

ok(typeof W.hgOgPickFor === 'function', 'hgOgPickFor (the combiner) is exported');
ok(typeof W.hgOgGates === 'function', 'hgOgGates is exported');

const T0 = 1700000000 - (1700000000 % 86400);
const B = (i, o, h, l, c, v) => ({ t: T0 + i * 3600, o, h, l, c, v: v === undefined ? 1000 : v });
function uptrend(n){
  const rows = []; let p = 2000;
  for (let i = 0; i < n; i++){ const o = p, c = p + 2.2; rows.push(B(i, o, c + 1, o - 1, c, 1000 + (i % 7) * 50)); p = c; }
  return rows;
}
const rows = uptrend(320);

/* ---- 1. every new indicator gate carries info:true, so infoRatio sees it ---- */
console.log('\n== the new indicator reads reach the combined score ==');
{
  const gates = W.hgOgGates(rows, { kind:'ORB', dir:'long', level: rows[rows.length-1].c, why:'t' }, {});
  const byKey = {};
  gates.forEach(g => { byKey[g.key] = g; });
  for (const k of ['premium-discount', 'gold-season', 'spot-basis']){
    ok(!!byKey[k], k + ' is on the ledger');
    ok(byKey[k].info === true,
       k + ' is declared info:true — without the flag it would VETO instead of arguing');
    ok(byKey[k].hard === false, k + ' is soft');
  }
  /* hgOgInfoNet is the bridge from the ledger to the score. It must count
     them; a gate the score cannot see is a gate that does not exist. */
  const src = SRC.slice(SRC.indexOf('function hgOgInfoNet'), SRC.indexOf('function hgOgBalanceParts'));
  ok(/g\.info !== true\) continue/.test(src),
     'hgOgInfoNet counts every info gate rather than a hard-coded list');
}

/* ---- 2. every mechanic is mapped to a family, so the family term sees it ---- */
console.log('\n== every mechanic reaches the family term ==');
{
  const mechStart = SRC.indexOf('var OG_MECHANICS');
  const MECHS = (SRC.slice(mechStart, SRC.indexOf('];', mechStart)).match(/'[A-Z0-9][A-Z0-9-]*'/g) || [])
    .map(s => s.slice(1, -1));
  ok(MECHS.length >= 55, 'OG_MECHANICS holds at least 55 keys (' + MECHS.length + ')');
  ok(typeof W.hgOgFamilyOf === 'function',
     'hgOgFamilyOf is exported — without it this check cannot run and must not pass silently');
  const unmapped = MECHS.filter(k => W.hgOgFamilyOf(k) === 'OTHER');
  ok(unmapped.length === 0,
     'no mechanic falls through to the OTHER bucket' +
     (unmapped.length ? ' — unmapped: ' + unmapped.join(', ') : ''));
  /* And the families are actually plural — one family holding everything
     would make the consensus term meaningless. */
  const fams = new Set(MECHS.map(k => W.hgOgFamilyOf(k)));
  ok(fams.size >= 4, 'the mechanics span several families (' + [...fams].sort().join(', ') + ')');
}

/* ---- 3. the score genuinely balances families against indicator reads ---- */
console.log('\n== families and indicator reads are balanced, not counted ==');
{
  const mk = (nAgree, nAgainst, infoPass, infoFail) => ({
    horizon: 'SCALP', dir: 'long', kind: 'ORB', plan: { entry: 2000, stop: 1990, t1: 2020, rr1: 2 },
    grade: { ticket: true, total: 40, evaluated: 40 },
    consensus: { nAgree, nAgainst, nSplit: 0 },
    distAtr: 0.5,
    gates: [].concat(
      Array.from({ length: infoPass }, (_, i) => ({ key: 'p' + i, hard: false, info: true, pass: true, why: '' })),
      Array.from({ length: infoFail }, (_, i) => ({ key: 'f' + i, hard: false, info: true, pass: false, why: '' }))
    )
  });
  const parts = c => W.hgOgBalanceParts(c, 'long');

  /* Doubling BOTH sides of the indicator tally must not change the score —
     that is what makes it a ratio rather than a vote count. If a future
     change makes it additive, more indicators would automatically beat more
     mechanics and the balance the header promises would be gone. */
  const a = parts(mk(3, 1, 4, 2));
  const b = parts(mk(3, 1, 8, 4));
  ok(Math.abs(a.infoRatio - b.infoRatio) < 1e-9,
     'doubling the indicator count leaves infoRatio unchanged (' +
     a.infoRatio.toFixed(3) + ' vs ' + b.infoRatio.toFixed(3) + ') — it is a ratio, not a tally');
  ok(Math.abs(a.score - b.score) < 1e-9, 'and the combined score is unchanged too');

  /* Same for families. */
  const c1 = parts(mk(3, 1, 4, 2));
  const c2 = parts(mk(6, 2, 4, 2));
  ok(Math.abs(c1.family - c2.family) < 1e-9,
     'doubling the family tally leaves the family term unchanged — mechanics cannot win by weight of numbers');

  /* But DIRECTION of agreement must move it, or the term reads nothing. */
  const agree = parts(mk(4, 0, 5, 0));
  const fight = parts(mk(0, 4, 0, 5));
  ok(agree.family > fight.family, 'agreeing families score above opposing ones');
  ok(agree.infoRatio > fight.infoRatio, 'agreeing indicator reads score above opposing ones');
  ok(agree.score > fight.score, 'and the combined score follows both');
}

/* ---- 4. the combiner still produces one SCALP and one SWING ---- */
console.log('\n== one SCALP pick and one SWING pick, tape-aligned ==');
{
  const cand = (horizon, dir, ticket, nAgree) => ({
    horizon, dir, kind: 'ORB', plan: { entry: 2000, stop: 1990, t1: 2020, rr1: 2 },
    grade: { ticket, total: 40, evaluated: 38 },
    consensus: { nAgree, nAgainst: 0, nSplit: 0 },
    distAtr: 0.4, gates: [{ key: 'g', hard: false, info: true, pass: true, why: '' }]
  });
  const ranked = [
    cand('SCALP', 'long', true, 4), cand('SCALP', 'long', true, 1),
    cand('SWING', 'long', true, 3), cand('SWING', 'short', true, 5)
  ];
  const s = W.hgOgPickFor(ranked, 'SCALP', 'long');
  const w = W.hgOgPickFor(ranked, 'SWING', 'long');
  ok(s && s.horizon === 'SCALP', 'a SCALP pick is produced');
  ok(w && w.horizon === 'SWING', 'a SWING pick is produced');
  ok(s.consensus.nAgree === 4, 'the SCALP pick is the one more families agree with');
  ok(w.dir === 'long', 'the SWING pick is tape-aligned — the against-tape candidate is not chosen');

  /* Standing aside is a valid answer and must stay one. */
  ok(W.hgOgPickFor([cand('SCALP', 'short', true, 9)], 'SCALP', 'long') === null,
     'when nothing aligns with the tape the desk stands aside rather than inventing the other side');
  ok(W.hgOgPickFor([cand('SCALP', 'long', false, 9)], 'SCALP', 'long') === null,
     'a candidate that never cleared the ledger is not promoted to a pick');
}

/* ---- 5. the picks carry their working ---- */
console.log('\n== the pick shows what combined into it ==');
{
  const c = {
    horizon: 'SCALP', dir: 'long', kind: 'ORB', plan: { entry: 2000, stop: 1990, t1: 2020, rr1: 2 },
    grade: { ticket: true, total: 40, evaluated: 36 },
    consensus: { nAgree: 5, nAgainst: 1, nSplit: 0 }, distAtr: 0.3,
    gates: [{ key: 'premium-discount', hard: false, info: true, pass: true, why: '' },
            { key: 'gold-season', hard: false, info: true, pass: false, why: '' },
            { key: 'spot-basis', hard: false, info: true, pass: true, why: '' }]
  };
  const p = W.hgOgPickFor([c], 'SCALP', 'long');
  ok(p && p.balance, 'the pick carries its balance breakdown');
  ok(p.balance.info && p.balance.info.n === 3,
     'the breakdown counts the indicator reads that fed it (' + p.balance.info.n + ')');
  ok(p.balance.info.net === 1, 'and their net direction (2 for, 1 against = +1)');
  ok(p.balance.nAgree === 5 && p.balance.nAgainst === 1, 'and the family tally behind it');
  ok(isFinite(p.balance.score), 'and a finite combined score');
}

console.log('\nomnigold combined setup: ' + passed + ' checks passed');
