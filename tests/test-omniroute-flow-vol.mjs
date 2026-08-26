/* HARDGATE — OMNIROUTE closes its last three coverage gaps.

   The coverage table on the tab named its own holes, and production printed
   them: "Quant trend following (TSMOM) PARTIAL 2/3 — still missing
   vol_targeting" and "Order flow / CVD PARTIAL 1/3 — still missing cvd,
   liquidation_map". Every other school read COVERED, so the tab was
   claiming to run every engine and every indicator while three named
   techniques had no implementation at all.

   This pack implements the three, OMNIROUTE only:

     vol_targeting   hgOmniVolTarget — realized vol vs a vol budget, and the
                     size multiplier that budget implies. TSMOM sizes by
                     volatility; without it the tab ranked a 1%-a-day tape
                     and an 8%-a-day tape as the same trade.
     cvd             hgOmniCvd — cumulative volume delta. Real Binance taker
                     series when the contract has a twin, candle-approximated
                     close-location delta otherwise (labelled, the way
                     volume_profile already labels its approximation), so a
                     CoinDCX-only name is not silently skipped.
     liquidation_map hgOmniLiqMap — where leveraged positions opened at the
                     recent swing extremes get liquidated, clustered. A stop
                     parked inside a cluster is a stop-hunt; a cluster
                     between entry and T1 is fuel.

   HONESTY CONSTRAINTS, because three new gates could quietly re-cut the
   ledger:
     - all three are INFO gates. They argue on the card and never veto, so
       no ticket that cleared before this pack is refused because of it.
     - G1 spread 0.25, G5 volZ 0.5, ANCHOR 1.5, G6 R:R 2.0 are untouched.
     - gold min-loss GOLD_STOP_MAX_PCT stays 0.025.
     - crypto live trading stays disabled.
     - CVD from candles is an APPROXIMATION and says so; it is never
       presented as a trade tape.

   Run: node tests/test-omniroute-flow-vol.mjs */
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
const GOLD = read('omnigold.js');
const CGATES = read('cryptogates.js');
const HGATES = read('hg-gates.js');
const EXEC = read('execute.js');

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
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

/* Deterministic tapes — no RNG in an assertion path. */
function calmTape(n){
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++){
    p = p * (1 + (i % 2 ? 0.0008 : -0.0006));       /* ~0.07% per bar */
    const r = p * 0.0015;
    out.push({ t: 1700000000 + i * 14400, o: p - r * 0.2, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return out;
}
function wildTape(n){
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++){
    p = p * (1 + (i % 2 ? 0.075 : -0.055));          /* ~6% per bar */
    const r = p * 0.05;
    out.push({ t: 1700000000 + i * 14400, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 1000 });
  }
  return out;
}
/* Buying pressure: every bar closes at its high on rising volume. */
function buyPressureTape(n){
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++){
    p = p * 1.002;
    const lo = p * 0.995;
    out.push({ t: 1700000000 + i * 14400, o: lo, h: p, l: lo, c: p, v: 1000 + i * 10 });
  }
  return out;
}
/* Selling pressure: every bar closes at its low. */
function sellPressureTape(n){
  const out = [];
  let p = 100;
  for (let i = 0; i < n; i++){
    p = p * 0.998;
    const hi = p * 1.005;
    out.push({ t: 1700000000 + i * 14400, o: hi, h: hi, l: p, c: p, v: 1000 + i * 10 });
  }
  return out;
}

const W = boot();

console.log('== the three functions exist and are exported ==');
{
  ok(typeof W.hgOmniVolTarget === 'function', 'hgOmniVolTarget is exported');
  ok(typeof W.hgOmniCvd === 'function', 'hgOmniCvd is exported');
  ok(typeof W.hgOmniLiqMap === 'function', 'hgOmniLiqMap is exported');
}

console.log('\n== vol targeting: the size a vol budget actually allows ==');
{
  const calm = W.hgOmniVolTarget(calmTape(120), {});
  const wild = W.hgOmniVolTarget(wildTape(120), {});
  ok(calm && isFinite(calm.sigmaNow) && calm.sigmaNow > 0, 'a calm tape reports a realized sigma');
  ok(wild && wild.sigmaNow > calm.sigmaNow * 5, 'a wild tape reports a much larger sigma (' +
     (wild.sigmaNow / calm.sigmaNow).toFixed(1) + 'x)');
  ok(isFinite(calm.mult) && isFinite(wild.mult), 'both return a size multiplier');
  ok(wild.mult < calm.mult, 'the wild tape gets the smaller multiplier — that is the whole point');
  ok(wild.mult < 1, 'above budget means size DOWN (' + wild.mult.toFixed(2) + 'x)');
  ok(calm.mult > 0 && calm.mult <= 4, 'the multiplier is clipped, never unbounded (' + calm.mult.toFixed(2) + 'x)');
  ok(wild.overBudget === true, 'the wild tape is flagged over budget');
  ok(typeof calm.note === 'string' && /vol/i.test(calm.note), 'and it says so in words: ' + calm.note);
  /* Purity + refusal on thin data. */
  const a = W.hgOmniVolTarget(calmTape(120), {});
  ok(JSON.stringify(a) === JSON.stringify(calm), 'pure — same bars give the same answer');
  ok(W.hgOmniVolTarget(calmTape(5), {}) === null, 'too little history returns null, not a guess');
  ok(W.hgOmniVolTarget(null, {}) === null, 'null bars do not throw');
  ok(W.hgOmniVolTarget([], {}) === null, 'empty bars do not throw');
  /* An explicit budget is honoured. */
  const tight = W.hgOmniVolTarget(calmTape(120), { targetPct: 0.01 });
  const loose = W.hgOmniVolTarget(calmTape(120), { targetPct: 10 });
  ok(tight.mult < loose.mult, 'a tighter vol budget allows less size');
}

console.log('\n== CVD: real taker series when there is one, labelled candles when not ==');
{
  const up = W.hgOmniCvd(buyPressureTape(80), 30, null);
  const dn = W.hgOmniCvd(sellPressureTape(80), 30, null);
  ok(up && up.source === 'candles', 'with no taker series the source is candle approximation');
  ok(/approx/i.test(up.note), 'and the note says approximation, never claiming a trade tape: ' + up.note);
  ok(up.delta > 0, 'closes-at-high on rising volume reads as net buying (' + up.delta.toFixed(0) + ')');
  ok(dn.delta < 0, 'closes-at-low reads as net selling (' + dn.delta.toFixed(0) + ')');
  ok(up.dir === 'long' && dn.dir === 'short', 'each names the side its flow supports');

  /* A real Binance taker series outranks the approximation. */
  const takerBuy = { series: [] };
  for (let i = 0; i < 12; i++) takerBuy.series.push({ buySellRatio: 1.4, t: 1700000000 + i * 14400 });
  const real = W.hgOmniCvd(sellPressureTape(80), 30, takerBuy);
  ok(real.source === 'taker', 'a taker series is used when present');
  ok(!/approx/i.test(real.note), 'and is not labelled an approximation: ' + real.note);
  ok(real.delta > 0, 'taker buy dominance reads as net buying even on a red candle tape — real data wins');

  const takerSell = { series: [] };
  for (let i = 0; i < 12; i++) takerSell.series.push({ buySellRatio: 0.6, t: 1700000000 + i * 14400 });
  ok(W.hgOmniCvd(buyPressureTape(80), 30, takerSell).delta < 0, 'and taker sell dominance reads as net selling');

  /* Divergence: price up, flow down. */
  const rows = buyPressureTape(80);
  const div = W.hgOmniCvd(rows, 30, takerSell);
  ok(div.divergence === 'bear', 'price rising into selling flow is a bearish divergence');
  ok(W.hgOmniCvd(sellPressureTape(80), 30, takerBuy).divergence === 'bull',
     'price falling into buying flow is a bullish divergence');

  ok(W.hgOmniCvd(calmTape(5), 30, null) === null, 'too little history returns null');
  ok(W.hgOmniCvd(null, 30, null) === null, 'null bars do not throw');
  const p1 = W.hgOmniCvd(buyPressureTape(80), 30, null);
  ok(JSON.stringify(p1) === JSON.stringify(up), 'pure — same bars give the same answer');
  /* A zero-range bar must not divide by zero. */
  const flat = [];
  for (let i = 0; i < 60; i++) flat.push({ t: 1700000000 + i * 14400, o: 50, h: 50, l: 50, c: 50, v: 100 });
  const fz = W.hgOmniCvd(flat, 30, null);
  ok(fz === null || isFinite(fz.delta), 'a zero-range tape yields null or a finite delta, never NaN');
}

console.log('\n== liquidation map: where leverage dies, clustered ==');
{
  const rows = calmTape(140);
  const map = W.hgOmniLiqMap(rows, {});
  ok(map && Array.isArray(map.clusters), 'a map of clusters is returned');
  ok(map.clusters.length > 0, 'the recent swings project at least one cluster (' + map.clusters.length + ')');
  ok(map.clusters.every(c => isFinite(c.price) && c.price > 0), 'every cluster has a real price');
  ok(map.clusters.every(c => isFinite(c.weight) && c.weight > 0), 'and a weight');
  ok(map.clusters.every(c => c.side === 'long' || c.side === 'short'),
     'and says which side gets liquidated there');
  const px = rows[rows.length - 1].c;
  if (map.nearestBelow) ok(map.nearestBelow.price < px, 'the nearest cluster below is below the market');
  if (map.nearestAbove) ok(map.nearestAbove.price > px, 'the nearest cluster above is above the market');
  ok(W.hgOmniLiqMap(calmTape(8), {}) === null, 'too little history returns null');
  ok(W.hgOmniLiqMap(null, {}) === null, 'null bars do not throw');
  const again = W.hgOmniLiqMap(calmTape(140), {});
  ok(JSON.stringify(again) === JSON.stringify(map), 'pure — same bars give the same answer');
}

console.log('\n== all three land on the ledger as INFO, never as new vetoes ==');
{
  const rows = calmTape(140);
  const px = rows[rows.length - 1].c;
  const hit = { kind: 'ORB', dir: 'long', level: px, why: 'test' };
  const gates = W.hgOmniGates(rows, hit, null, { sym: 'TESTUSD' });
  const byKey = {};
  gates.forEach(g => { byKey[g.key] = g; });
  ok(!!byKey['vol-target'], 'vol-target is on the ledger');
  ok(!!byKey['cvd'], 'cvd is on the ledger');
  ok(!!byKey['liq-map'], 'liq-map is on the ledger');
  ['vol-target', 'cvd', 'liq-map'].forEach(k => {
    ok(byKey[k].hard !== true, k + ' is not a hard gate');
    ok(byKey[k].info === true, k + ' is an info read — it argues, it does not veto');
    ok(typeof byKey[k].why === 'string' && byKey[k].why.length > 0, k + ' explains itself: ' + byKey[k].why);
  });
  /* The proof they cannot refuse a ticket: a grade over ONLY these three
     failing must still be a ticket. */
  const grade = W.hgOmniGrade([
    { key: 'trend', hard: true, pass: true, why: '' },
    { key: 'vol-alive', hard: true, pass: true, why: '' },
    { key: 'participation', hard: true, pass: true, why: '' },
    { key: 'vol-target', hard: false, info: true, pass: false, why: 'over budget' },
    { key: 'cvd', hard: false, info: true, pass: false, why: 'flow against' },
    { key: 'liq-map', hard: false, info: true, pass: false, why: 'stop in a cluster' }
  ]);
  ok(grade.ticket === true, 'three failing info reads cannot veto a ticket');
  ok(/against/.test(grade.verdict), 'but the card says what argued against it: ' + grade.verdict);
}

console.log('\n== the flow reads answer to the direction being traded ==');
{
  const rows = buyPressureTape(120);
  const px = rows[rows.length - 1].c;
  const long = W.hgOmniGates(rows, { kind: 'ORB', dir: 'long', level: px, why: '' }, null, { sym: 'A' });
  const short = W.hgOmniGates(rows, { kind: 'ORB', dir: 'short', level: px, why: '' }, null, { sym: 'A' });
  const cvdL = long.filter(g => g.key === 'cvd')[0];
  const cvdS = short.filter(g => g.key === 'cvd')[0];
  ok(cvdL.pass === true, 'buying flow agrees with a long');
  ok(cvdS.pass === false, 'and argues against a short on the same bars');
  ok(/flow/i.test(cvdS.why), 'naming flow as the disagreement: ' + cvdS.why);
}

console.log('\n== a stop parked inside a liquidation cluster is called out ==');
{
  const rows = calmTape(140);
  const map = W.hgOmniLiqMap(rows, {});
  const below = map.nearestBelow;
  ok(!!below, 'the tape has a cluster below to test against');
  const px = rows[rows.length - 1].c;
  /* Stop placed exactly on the cluster. */
  const inCluster = W.hgOmniGates(rows, { kind: 'ORB', dir: 'long', level: px, why: '' }, null,
    { sym: 'A', plan: { dir: 'long', entry: px, stop: below.price, t1: px * 1.05, t2: px * 1.08 } });
  const g = inCluster.filter(x => x.key === 'liq-map')[0];
  ok(g.pass === false, 'a stop sitting on a liquidation cluster reads against the trade');
  ok(/cluster/i.test(g.why), 'and says why: ' + g.why);
}

console.log('\n== the coverage table has no holes left, and did not gain fake ones ==');
{
  const inv = W.hgOmniGateInventory();
  const keys = inv.map(r => r.key);
  ['vol_targeting', 'cvd', 'liquidation_map'].forEach(k => {
    ok(keys.indexOf(k) !== -1, k + ' is a registered gate, not a wish');
    const row = inv.filter(r => r.key === k)[0];
    ok(row.tabs.indexOf('OMNIROUTE') !== -1, k + ' is credited to OMNIROUTE, the tab that runs it');
  });
  ok(keys.length === new Set(keys).size, 'no duplicate inventory keys');
  const gaps = W.hgOmniGaps();
  ok(gaps.length === 0, 'hgOmniGaps() is empty — nothing on the roster is unimplemented (' +
     gaps.map(g => g.key).join(', ') + ')');
  const matrix = W.hgOmniCoverageMatrix();
  ok(matrix.length > 0, 'the coverage matrix still has schools in it (' + matrix.length + ')');
  ok(matrix.every(r => r.verdict === 'COVERED'), 'every school reads COVERED');
  ok(matrix.every(r => r.miss.length === 0), 'and none lists a missing technique');
  const tsmom = matrix.filter(r => /TSMOM/.test(r.school))[0];
  ok(tsmom && tsmom.have.indexOf('vol_targeting') !== -1, 'TSMOM now has vol targeting');
  const flow = matrix.filter(r => /Order flow/.test(r.school))[0];
  ok(flow && flow.have.indexOf('cvd') !== -1 && flow.have.indexOf('liquidation_map') !== -1,
     'and the order-flow school has both CVD and the liquidation map');
  /* The extractor vocabulary must not now list them twice. */
  const vocab = W.hgOmniVocabulary();
  ok(vocab.length === new Set(vocab).size, 'the extractor vocabulary has no duplicates');
  ['vol_targeting', 'cvd', 'liquidation_map'].forEach(k => {
    ok(vocab.indexOf(k) !== -1, k + ' is still in the extractor vocabulary');
  });
}

console.log('\n== a quiet name gets the new reads too ==');
{
  const rows = calmTape(140);
  const extra = { sym: 'QUIETUSD' };
  const found = W.hgOmniEvaluate({ sym: 'QUIETUSD', base: 'QUIET', exchange: 'delta' }, rows, null, extra);
  if (!found.length){
    ok(Array.isArray(extra.quietGates) && extra.quietGates.length > 0,
       'a name that fired nothing still ran the indicator ledger');
    const qk = extra.quietGates.map(g => g.key);
    ['vol-target', 'cvd', 'liq-map'].forEach(k => {
      ok(qk.indexOf(k) !== -1, k + ' ran on the quiet name as well');
    });
  } else {
    const gk = found[0].gates.map(g => g.key);
    ['vol-target', 'cvd', 'liq-map'].forEach(k => {
      ok(gk.indexOf(k) !== -1, k + ' ran on this name');
    });
  }
  ok(found.every(c => !(c.grade && c.grade.ticket) || !!c.plan),
     'no ticket without a plan — the new gates did not invent one');
}

console.log('\n== the scan carries the taker SERIES, not only its last value ==');
{
  const enrich = ROUTE.slice(ROUTE.indexOf('function enrichOne'), ROUTE.indexOf('function enrich('));
  ok(/binanceTakerRatio/.test(enrich), 'pass 2 still asks for the taker ratio');
  ok(/takerSeries/.test(enrich), 'and stamps the whole series so CVD has something to integrate');
}

console.log('\n== nothing else moved ==');
{
  ok(/CG_SWING_RR_MIN\s*=\s*2(\.0+)?\b/.test(CGATES), 'G6 R:R floor is still 2.0');
  ok(/0\.25/.test(CGATES), 'G1 spread constant still present');
  ok(/GOLD_STOP_MAX_PCT\s*=\s*0\.025/.test(GOLD), 'gold min-loss is still 2.5%');
  ok(/HG_LIVE_TRADING_ENABLED\s*=\s*false/.test(EXEC) || /live trading disabled/i.test(EXEC),
     'crypto live trading stays disabled');
  ok(!/hard:\s*true[^\n]*vol-target/.test(ROUTE), 'vol-target was not smuggled in as a hard gate');
  ok(!/key:'vol-target'/.test(HGATES) && !/key:'liq-map'/.test(HGATES),
     'the shared indicator bank was not changed — this is OMNIROUTE only');
  ok(!/key:'vol-target'/.test(GOLD) && !/key:'liq-map'/.test(GOLD),
     'and the gold desk did not gain these gates');
  ok(swCacheOk(read('sw.js')), 'sw.js cache id matches build-stamp.js (' + HG_VER + ')');
  ok(/hg-v\d+/.test(HG_VER), 'the build is stamped');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIROUTE FLOW/VOL COVERAGE TESTS PASSED');
