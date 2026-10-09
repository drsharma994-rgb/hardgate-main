/* HARDGATE — hg-v1270 shipped twelve core gold strategies across four desks
   (GS-1..3 GOLD SCALP, OG-1..3 OMNIGOLD, PG-1..3 PINE GOLD, GG-1..3 GANESH
   GOLD) in gold-suite-unified.js with NO guard. An untested detector engine is
   exactly where a silent bug hides, so this test pins the contract:

     - the suite exports the four hit functions plus forDesk
     - all twelve core ids are declared
     - every hit carries the shape the desks render (id, name, dir, entry,
       stop, target, why) with entry/stop on the correct side and a 2.5R target
     - honesty: an empty / null / thin / junk tape returns NO hits and never
       throws (a missing series stays unread)
     - hg-v1276 participation: every hit carries `pace` (the confirming bar
       over the 20-bar readable median) and states it in the why; the four
       five session-raid detections WITHHOLD on a readable dead pace (nobody
       defended the sweep); a volume-deaf feed fails OPEN with pace null;
       level reads carry the number without a bar
     - the four desks read HG_GoldSuite

   Run: node tests/test-gold-core-strategies.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, isFinite, isNaN, parseFloat, parseInt };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('gold-suite-unified.js'), ctx, { filename: 'gold-suite-unified.js' });
  return ctx;
}

const T0 = Date.UTC(2026, 0, 6, 0, 0, 0);
const b15 = (min, o, h, l, c) => ({ t: T0 + min * 60000, o, h, l, c, v: 100 });
/* 27 Asian bars (00:00..06:30) spanning $10, then a 07:30 London bar that
   sweeps the Asia low and closes back inside with a long lower wick — the
   GS-1 "London Judas Asian Sweep" condition. */
function londonTape(){
  const rows = [];
  for (let i = 0; i < 27; i++) rows.push(b15(i * 15, 2600, 2605, 2595, 2600));
  rows.push({ t: Date.UTC(2026, 0, 6, 7, 30), o: 2600, h: 2602, l: 2590, c: 2600.5, v: 100 });
  return rows;
}
function flatTape(n){
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ t: Date.UTC(2026, 0, 6, 3, 0) + i * 900000, o: 2600, h: 2601, l: 2599, c: 2600, v: 100 });
  return rows;
}

const DESKS = ['scalpHits', 'omniHits', 'pineHits', 'ganeshHits'];
const IDS = {
  scalpHits: ['GS-1', 'GS-2', 'GS-3'],
  omniHits: ['OG-1', 'OG-2', 'OG-3'],
  pineHits: ['PG-1', 'PG-2', 'PG-3'],
  ganeshHits: ['GG-1', 'GG-2', 'GG-3']
};

console.log('== the suite exports the four desks and forDesk ==');
const W = boot();
ok(W.HG_GoldSuite && typeof W.HG_GoldSuite === 'object', 'HG_GoldSuite is exported');
for (const d of DESKS) ok(typeof W.HG_GoldSuite[d] === 'function', d + ' is a function');
ok(typeof W.HG_GoldSuite.forDesk === 'function', 'forDesk is a function');

console.log('== all twelve core strategy ids are declared ==');
{
  const src = read('gold-suite-unified.js');
  for (const d of DESKS) for (const id of IDS[d]) ok(src.indexOf("'" + id + "'") >= 0, id + ' is declared in the source');
}

console.log('== the detectors form setups with a valid, renderable shape ==');
{
  const S = W.HG_GoldSuite;
  const tape = londonTape();
  const gs = S.scalpHits(tape, tape);
  ok(Array.isArray(gs) && gs.length >= 1, 'the London Judas tape fires at least one GOLD SCALP core hit (' + gs.map(h => h.id + ':' + h.dir).join(', ') + ')');
  ok(gs.some(h => h.id === 'GS-1' && h.dir === 'long'), 'GS-1 fires LONG on the swept Asia low');
  /* every hit from every desk on this tape must satisfy the render contract */
  let seen = 0;
  for (const d of DESKS){
    const hits = S[d](tape, tape);
    ok(Array.isArray(hits), d + ' returns an array');
    for (const h of hits){
      seen++;
      ok(!!h.id && !!h.name && typeof h.why === 'string' && h.why.length > 0, h.id + ' names its id, label and reason');
      ok(h.dir === 'long' || h.dir === 'short', h.id + ' names a side');
      ok(isFinite(h.entry) && isFinite(h.stop) && isFinite(h.target), h.id + ' carries finite entry/stop/target');
      ok(h.dir === 'long' ? h.stop < h.entry : h.stop > h.entry, h.id + ' puts the stop on the correct side of the entry');
      const rr = Math.abs(h.target - h.entry) / Math.abs(h.entry - h.stop);
      ok(rr >= 2.3 && rr <= 2.7, h.id + ' targets 2.5R (' + rr.toFixed(2) + 'R)');
    }
  }
  ok(seen >= 1, 'at least one core hit was driven end to end');
}

console.log('== forDesk routes to the right desk ==');
{
  const S = W.HG_GoldSuite;
  const tape = londonTape();
  for (const [desk, fn] of [['goldscalp', S.scalpHits], ['omnigold', S.omniHits], ['pinegold', S.pineHits], ['ganeshgold', S.ganeshHits]]){
    const viaDesk = S.forDesk(desk, tape, { day: tape });
    const direct = fn(tape, tape);
    ok(JSON.stringify(viaDesk) === JSON.stringify(direct), 'forDesk("' + desk + '") routes to its own hit function');
  }
  ok(Array.isArray(S.forDesk('unknown-desk', tape, {})) && S.forDesk('unknown-desk', tape, {}).length === 0,
    'forDesk refuses an unknown desk with an empty list (never a guessed setup)');
}

console.log('== honesty: thin, empty, null and junk tapes form nothing and never throw ==');
{
  const S = W.HG_GoldSuite;
  for (const d of DESKS){
    ok(Array.isArray(S[d]([], [])) && S[d]([], []).length === 0, d + ' returns nothing on an empty tape');
    ok(Array.isArray(S[d](null, null)) && S[d](null, null).length === 0, d + ' returns nothing on a null tape');
    ok(Array.isArray(S[d](flatTape(19), flatTape(19))) && S[d](flatTape(19), flatTape(19)).length === 0, d + ' returns nothing below the 20-bar floor');
    const junk = flatTape(30).concat([{ o: 'x', h: null, l: undefined, c: NaN, t: 1 }]);
    let threw = false, res = null;
    try { res = S[d](junk, junk); } catch (e) { threw = true; }
    ok(!threw && Array.isArray(res) && res.length === 0, d + ' refuses a junk bar without throwing (unread, never a fabricated hit)');
  }
}

console.log('== participation: raid sweeps need a defended print, level reads carry the number ==');
{
  const S = W.HG_GoldSuite;
  const tape = londonTape();
  const g1 = S.scalpHits(tape, tape).find(h => h.id === 'GS-1');
  ok(g1 && g1.pace === 1 && /participation 1\.00/.test(g1.why),
    'a flat-volume raid carries pace 1.00 and states it in the why');
  /* the same sweep, confirming bar at 0.2x the median: nobody defended it */
  const dead = londonTape(); dead[dead.length - 1].v = 20;
  const gsDead = S.scalpHits(dead, dead);
  ok(!gsDead.some(h => h.id === 'GS-1'),
    'a raid sweep on 0.2x participation is WITHHELD — a sweep nobody came to');
  /* volume-deaf feed: every bar v=0 — the layer cannot speak and never bites */
  const deaf = londonTape().map(b => Object.assign({}, b, { v: 0 }));
  const g1d = S.scalpHits(deaf, deaf).find(h => h.id === 'GS-1');
  ok(g1d && g1d.pace === null && !/participation/.test(g1d.why),
    'a volume-deaf feed fails OPEN — the hit stands and pace is not fabricated');
  /* the London-fix drift is a level read, not a raid: dead pace carries, never bars */
  const fixTape = (lastV) => {
    const rows = [];
    for (let i = 0; i < 17; i++) rows.push({ t: T0 + i * 900000, o: 2599.5, h: 2601, l: 2599, c: 2600, v: 100 });
    rows.push({ t: T0 + 17 * 900000, o: 2600, h: 2602.5, l: 2600, c: 2602, v: 100 });
    rows.push({ t: T0 + 18 * 900000, o: 2602, h: 2604, l: 2601.5, c: 2603.5, v: 100 });
    rows.push({ t: Date.UTC(2026, 0, 6, 14, 45), o: 2603.5, h: 2605.5, l: 2603, c: 2605, v: lastV });
    return rows;
  };
  const o2 = S.omniHits(fixTape(100), null, null).find(h => h.id === 'OG-2');
  ok(o2 && o2.dir === 'short' && o2.pace === 1,
    'the London-fix drift fires on a clean tape and carries pace 1.00');
  const o2d = S.omniHits(fixTape(15), null, null).find(h => h.id === 'OG-2');
  ok(o2d && o2d.dir === 'short' && o2d.pace === 0.15 && !/participation 1\.00/.test(o2d.why),
    'a level read on dead pace still forms and carries 0.15x instead of a bar');
  const src = read('gold-suite-unified.js');
  ok(/var PACE_WIN = 20, PACE_MIN_READ = 10, PACE_DEAD = 0\.5;/.test(src),
    'the participation priors are stated: 20-bar median, 10 readable prints, 0.5x dead');
  ok((src.match(/\bpaceDead\(/g) || []).length === 6,
    'paceDead is defined once and consulted by exactly the five session-raid detections (GS-1, GS-2, GS-4, GS-5, PG-1)');
}

console.log('== the four desks read the suite ==');
{
  for (const f of ['goldind.js', 'omnigold.js', 'goldpine.js', 'ganeshgold.js']){
    ok(read(f).indexOf('HG_GoldSuite') >= 0, f + ' wires the core suite');
  }
  ok(read('index.html').indexOf('gold-suite-unified.js') >= 0, 'the suite ships to the browser');
  ok(read('sw.js').indexOf('gold-suite-unified.js') >= 0, 'the suite is in the HG_SHELL precache');
}

console.log('\ntest-gold-core-strategies: ' + passed + ' passed, 0 failed');
