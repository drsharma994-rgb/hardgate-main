/* HARDGATE — hg-v1398: the ADX echo does not create a side.

   trendScore still stores the five-leg sum, so an old tmScore stays on the
   same scale. ADX cannot oppose: when it is at least 25 it copies the sign
   of the other four legs. One real leg plus that copy used to clear
   |score| >= 2, which is both a direction and a CONVICTION ticket.

   The side now comes from the four legs that can disagree. One leg is not
   a side. Two legs still are. A row that has no four-leg bag still reads
   the score, because that is the number other desks already stored.

   Run: node tests/test-trendmx-adx-side-v1398.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'trendtable.combined.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

function legs(d1, cross, cascade, cloud, adxPt){
  return { d1Trend: d1, d1Cross: cross, h4Cascade: cascade, cloud: cloud, adxPt: adxPt };
}
function row(score, comps, extra){
  return Object.assign({ score: score, comps: comps, adx: 30 }, extra || {});
}

const W = boot();

console.log('== the stored score is still the five-leg sum ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  ok(/out\.score = out\.comps\.d1Trend \+ out\.comps\.d1Cross \+ out\.comps\.h4Cascade \+\s*out\.comps\.cloud \+ out\.comps\.adxPt;/.test(src),
    'trendScore still adds the ADX point into the stored number');
  const T0 = 1750000000;
  function tape(n, step, start){
    const rows = []; let c = start;
    for (let i = 0; i < n; i++){
      const o = c; c = c + step;
      rows.push({ t: T0 + i * 86400, o, h: Math.max(o, c) + 1, l: Math.min(o, c) - 1, c, v: 1000 });
    }
    return rows;
  }
  const up = W.trendScore(tape(260, 1, 100), tape(120, 0.6, 100));
  ok(up.score === up.comps.d1Trend + up.comps.d1Cross + up.comps.h4Cascade + up.comps.cloud + up.comps.adxPt,
    'a live tape score equals the five components (' + up.score + ')');
}

console.log('== one leg plus the echo is not a side ==');
{
  const echo = row(2, legs(1, 0, 0, 0, 1));
  ok(W.tmIndependentSum(echo) === 1, 'the four-leg sum ignores the ADX point');
  ok(W.tmDirOf(echo) === null, 'a long echo does not mint a long');
  const echoS = row(-2, legs(0, 0, -1, 0, -1));
  ok(W.tmDirOf(echoS) === null, 'a short echo does not mint a short');
  ok(W.trendmxPlan(echo) === null, 'an echo row does not receive levels');
  const blk = W.trendmxPlanBlock(Object.assign({ sym: 'ECHOUSDT' }, echo));
  ok(blk.indexOf('ADX echo is not a side') >= 0 && blk.indexOf('STOP') === -1,
    'the plan note names the echo and prints no stop');
}

console.log('== two independent legs are still a side ==');
{
  const two = row(2, legs(1, 1, 0, 0, 0));
  ok(W.tmDirOf(two) === 'long', 'two agreeing legs are a long without ADX');
  const twoAdx = row(3, legs(1, 0, 1, 0, 1));
  ok(W.tmDirOf(twoAdx) === 'long', 'two legs plus the echo stay a long');
  const four = row(-5, legs(-1, -1, -1, -1, -1));
  ok(W.tmDirOf(four) === 'short', 'a full bearish composite stays short');
  const named = row(2, legs(0, 0, 0, 0, 0), { dir: 'short' });
  ok(W.tmDirOf(named) === 'short', 'an explicit dir still wins');
}

console.log('== a score with no four-leg bag is unchanged ==');
{
  ok(W.tmDirOf({ score: -2 }) === 'short', 'a bare score of -2 is still short');
  ok(W.tmDirOf({ score: 2 }) === 'long', 'a bare score of +2 is still long');
  ok(W.tmDirOf({ score: 1 }) === null, 'a bare score of +1 is still no side');
  ok(W.tmDirOf({ score: -5, comps: {} }) === 'short', 'an empty comps bag is not a four-leg read');
  const flat = W.trendmxPlanBlock({ sym: 'FLATUSDT', score: 0, comps: {} });
  ok(flat.indexOf('No majority direction') >= 0 && flat.indexOf('ADX echo') === -1,
    'a score under the bar keeps the old no-majority note');
}

console.log('== the conviction board does not take the echo ==');
{
  const gate = { gatesPassed: 5, gatesTotal: 7, clean7: false, nearClean: false, hit: null, veto: null };
  const echo = row(2, legs(1, 0, 0, 0, 1), { sym: 'ECHOUSDT', gate: gate, price: 100, rows4h: [{ t: 1, o: 1, h: 2, l: 0.5, c: 1, v: 1 }] });
  const cls = W.trendmxLimitClasses([echo]);
  ok(cls.conv.length === 0 && cls.clean.length === 0, 'an echo row is not a conviction setup');
  ok(W.trendmxConviction(echo) && W.trendmxConviction(echo).tier === 'CONVICTION',
    'the strength label still reads the stored score — it does not mint the side');
}

console.log('\n' + passed + ' passed, 0 failed');
