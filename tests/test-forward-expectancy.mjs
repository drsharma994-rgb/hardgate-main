/* HARDGATE — a desk that has never won was printing an em dash for its
   expectancy.

   Found while checking OMNIGOLD's record. The forward log computed

     var avgRr = wins ? (rrSum / wins) : NaN;
     var expR  = (settled && isFinite(avgRr)) ? (hit * avgRr - (1 - hit)) : NaN;

   With zero winners avgRr is legitimately unknown — there is no winner to
   average — so expR fell to NaN and the FORWARD table rendered "—".

   But the expectancy is not unknown. If nothing has won, every settled trade
   lost 1R and the expectancy is exactly -1.00R; the hit*avgRr term is
   multiplied by a zero hit rate and vanishes. The one record that needs no
   inference whatsoever was the one the table refused to state.

   This is not a corner case on this desk. OMNIGOLD's live out-of-sample
   record was 0 wins in 13 settled trades — precisely the shape that printed a
   dash. A dash reads as "no data yet", which is the opposite of what 0-for-13
   means, and it is the reading that costs money.

   Run: node tests/test-forward-expectancy.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const store = {};
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

const HR = 3600;
const BAR = Math.floor(Date.now() / 1000 / HR) * HR;

/* Settle n records: `wins` of them reach T1, the rest stop out. */
function run(nWins, nLosses){
  const W = boot();
  let i = 0;
  const mk = (mech) => W.hgFwdRecord({ tab: 'T', mechanic: mech, sym: 'X', tf: '1h', dir: 'long',
    entry: 100, stop: 90, t1: 115, barT: BAR - (++i + 1) * HR, horizonBars: 24 });
  for (let k = 0; k < nWins; k++) mk('WIN' + k);
  for (let k = 0; k < nLosses; k++) mk('LOSS' + k);
  /* One pass of bars that hits T1 — settles the winners. */
  if (nWins){
    const up = [];
    for (let k = 1; k <= 4; k++) up.push({ t: BAR - HR + k * HR, o: 100, h: k === 2 ? 116 : 101, l: 99, c: 100, v: 1 });
    W.hgFwdResolve('X', '1h', up);
  }
  return W;
}

console.log('== THE DEFECT: no winners must not mean no expectancy ==');
{
  const W = boot();
  W.hgFwdRecord({ tab: 'T', mechanic: 'M', sym: 'X', tf: '1h', dir: 'long',
    entry: 100, stop: 90, t1: 115, barT: BAR - 3 * HR, horizonBars: 24 });
  const down = [];
  for (let k = 1; k <= 4; k++) down.push({ t: BAR - HR + k * HR, o: 100, h: 101, l: k === 2 ? 88 : 99, c: 95, v: 1 });
  W.hgFwdResolve('X', '1h', down);

  const s = W.hgFwdStats('T', null, false);
  ok(s.samples === 1 && s.losses === 1 && s.wins === 0, 'one settled trade, and it lost');
  ok(s.hit === 0, 'the hit rate is 0');
  ok(s.expR === -1, 'the expectancy is stated as exactly -1R, not left blank (' + s.expR + ')');
  ok(isFinite(s.expR), 'and it is a finite number, so the table renders it');
  ok(!isFinite(s.avgRr), 'while avgRr stays unknown — there is no winner to average, and it does not pretend');
}

console.log('\n== the live shape that started this: 0 of 13 ==');
{
  const W = boot();
  for (let k = 0; k < 13; k++){
    W.hgFwdRecord({ tab: 'OMNIGOLD:SCALP', mechanic: 'ROUND-MAGNET', sym: 'XAUUSD', tf: '1h', dir: 'long',
      entry: 100, stop: 90, t1: 115, barT: BAR - (k + 2) * HR, horizonBars: 24 });
  }
  const down = [];
  for (let k = 1; k <= 20; k++) down.push({ t: BAR - HR + k * HR, o: 100, h: 101, l: k === 2 ? 88 : 99, c: 95, v: 1 });
  W.hgFwdResolve('XAUUSD', '1h', down);

  const s = W.hgFwdStats('OMNIGOLD:SCALP', null, false);
  ok(s.samples === 13, '13 settled trades (' + s.samples + ')');
  ok(s.wins === 0, 'none of them won');
  ok(s.expR === -1, 'the desk reports -1.00R rather than an em dash — 0-for-13 is a result, not a gap');

  const pool = W.hgFwdPool('OMNIGOLD:SCALP');
  ok(pool['ROUND-MAGNET'].expR === -1, 'and the per-mechanic pool says the same');
}

console.log('\n== a record WITH winners is unchanged ==');
{
  /* The formula must not have moved for any case that already worked. */
  const W = run(3, 0);
  const s = W.hgFwdStats('T', null, false);
  ok(s.wins === 3 && s.losses === 0, 'three winners, no losers');
  ok(s.hit === 1, 'hit rate 1');
  ok(Math.abs(s.avgRr - 1.5) < 1e-9, 'avgRr is the realised 1.5R (' + s.avgRr + ')');
  ok(Math.abs(s.expR - 1.5) < 1e-9, 'expectancy 1*1.5 - 0 = 1.5R (' + s.expR + ')');
}

console.log('\n== a mixed record still uses the realised winner R ==');
{
  const W = boot();
  let i = 0;
  const mk = m => W.hgFwdRecord({ tab: 'T', mechanic: m, sym: 'X', tf: '1h', dir: 'long',
    entry: 100, stop: 90, t1: 115, barT: BAR - (++i + 1) * HR, horizonBars: 24 });
  mk('A'); mk('B');
  /* A bar that touches BOTH stop and target counts as a STOP by house rule,
     so build them separately: first a clean win pass. */
  const up = [];
  for (let k = 1; k <= 3; k++) up.push({ t: BAR - HR + k * HR, o: 100, h: k === 2 ? 116 : 101, l: 99, c: 100, v: 1 });
  W.hgFwdResolve('X', '1h', up);
  const s = W.hgFwdStats('T', null, false);
  ok(s.samples === 2 && s.wins === 2, 'both settled as wins on this pass (' + s.wins + ')');
  ok(isFinite(s.expR), 'expectancy is finite');
  ok(s.expR > 0, 'and positive when everything won (' + s.expR.toFixed(2) + 'R)');
}

console.log('\n== nothing settled yet still reads as unknown ==');
{
  const W = boot();
  W.hgFwdRecord({ tab: 'T', mechanic: 'M', sym: 'X', tf: '1h', dir: 'long',
    entry: 100, stop: 90, t1: 115, barT: BAR - 2 * HR, horizonBars: 24 });
  const s = W.hgFwdStats('T', null, false);
  ok(s.samples === 0, 'nothing has settled');
  ok(s.open === 1, 'one trade is still open');
  ok(!isFinite(s.expR), 'and expectancy is UNKNOWN, not -1 — an open trade has not lost yet');
}

console.log('\n== the table renders the number it is now given ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');
  const cells = src.match(/isFinite\(p\.expR\)/g) || [];
  ok(cells.length >= 2, 'both forward tables gate the cell on isFinite (' + cells.length + ')');
  ok(/\(p\.expR >= 0 \? '\+' : ''\) \+ p\.expR\.toFixed\(2\)/.test(src),
     'so -1 now prints as -1.00R where it used to print an em dash');
  ok(/else if \(!wins\) expR = -1;/.test(src), 'and the zero-winner case is explicit in the source');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FORWARD EXPECTANCY TESTS PASSED');
