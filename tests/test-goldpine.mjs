/* HARDGATE — goldpine / pinegoldmath unit tests (Node 18+, no network). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function mkRows(n, start, step){
  const rows = [];
  let prev = start;
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    rows.push({ t: i * 3600, o: prev, h: Math.max(prev, c) + 2, l: Math.min(prev, c) - 2, c, v: 1000 + i * 10 });
    prev = c;
  }
  return rows;
}

const ctx = vm.createContext({
  window: {}, console, Math, JSON, Date, isFinite, NaN, Array, Object, String,
  module: { exports: {} }
});
ctx.window = ctx;

vm.runInContext(fs.readFileSync(path.join(root, 'pinemath.js'), 'utf8'), ctx, { filename: 'pinemath.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'pinegoldmath.js'), 'utf8'), ctx, { filename: 'pinegoldmath.js' });
const G = ctx.window;

assert(typeof G.pineGoldConfluence === 'function', 'pineGoldConfluence exported');
assert(typeof G.pineGoldGrade === 'function', 'pineGoldGrade exported');
assert(G.pineGoldGrade(18, 24) === 'A+', 'grade A+ at 75% of 24');
assert(typeof G.pineGoldNativeBundle === 'function', 'pineGoldNativeBundle exported');
assert(typeof G.pineGoldOuZscore === 'function', 'pineGoldOuZscore exported');

{
  const rows4h = mkRows(300, 2400, 0.5);
  const rows1d = mkRows(280, 2200, 2);
  const res = G.pineGoldConfluence(rows4h, { mode: 'swing', htfRows: rows1d, levels: {} });
  assert(res && res.long && res.short, 'returns long and short eval');
  assert(typeof res.long.score === 'number', 'long has numeric score');
  assert(res.layers && res.layers.halftrend !== undefined, 'layer results populated');
}

{
  const rows15m = mkRows(250, 2650, 0.08);
  const rows1h = mkRows(220, 2600, 0.3);
  const res = G.pineGoldConfluence(rows15m, { mode: 'scalp', htfRows: rows1h, levels: { pdh: 2700, pdl: 2600 } });
  assert(res.long && res.short, 'scalp mode evaluates both directions');
}

assert(G.PINE_GOLD_TIER && G.PINE_GOLD_TIER.swing.primary === 10, 'tier thresholds exported');
assert(typeof G.pineGoldUniverse === 'function', 'pineGoldUniverse exported');
{
  const rows4h = mkRows(300, 2400, 0.5);
  const rows1d = mkRows(280, 2200, 2);
  const uni = G.pineGoldUniverse(rows4h, { mode: 'swing', htfRows: rows1d, levels: {} });
  assert(uni && Array.isArray(uni.setups), 'universe returns setups array');
  assert(uni.setups.length >= 1, 'universe populates at least one swing card on trend data');
}

{
  const ctx2 = vm.createContext({
    window: {}, console, Math, JSON, Date, isFinite, NaN, Array, Object, String,
    module: { exports: {} }
  });
  ctx2.window = ctx2;
  vm.runInContext(fs.readFileSync(path.join(root, 'goldpine.js'), 'utf8'), ctx2, { filename: 'goldpine.js' });
  const GP = ctx2.window;
  assert(typeof GP.topProbSetups === 'function', 'topProbSetups exported');
  assert(GP.GOLD_PINE_TOP_SETUPS === 2, 'TOP_SETUPS is 2');
  const pool = [
    { dir: 'long', score: 8, maxScore: 24, grade: 'B', tier: 'aligned', isNew: false, isRecent: false },
    { dir: 'short', score: 14, maxScore: 24, grade: 'A', tier: 'primary', isNew: true, isRecent: false, rr: 2.1, familyCount: 3 },
    { dir: 'long', score: 12, maxScore: 24, grade: 'A', tier: 'forming', isNew: false, isRecent: true, barsAgo: 2, rr: 1.8, familyCount: 2 },
    { dir: 'short', score: 16, maxScore: 24, grade: 'A+', tier: 'primary', isNew: false, isRecent: false, rr: 2.5, familyCount: 4 }
  ];
  const top2 = GP.topProbSetups(pool, 2);
  assert(top2.length === 2, 'topProbSetups returns 2');
  assert(top2[0].isNew === true, 'NEW primary ranks #1');
  assert(top2[1].tier === 'forming' || top2[1].isRecent === true || top2[1].score >= 14,
         'second pick is high-probability formation or strong primary');
  assert(GP.goldPineProbScore(top2[0]) >= GP.goldPineProbScore(pool[0]),
         'probScore ranks formation setups above weak aligned');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
