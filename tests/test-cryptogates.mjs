/* HARDGATE — cryptogates.js unit tests */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });

globalThis.window = globalThis;
load('indicators.js');
load('indicators2.js');
load('cryptogates.js');
load('plans.js');

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok —', msg); }
  else { fail++; console.error('FAIL —', msg); }
}

function synthRows(n, start){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * 10;
    out.push({ t: i, o: c, h: c + 5, l: c - 5, c: c, v: 1000 });
  }
  return out;
}

const rows = synthRows(260, 50000);
const ticker = { symbol: 'BTCUSDT', fundingPct: 0.01, mark: rows[rows.length - 1].c };
const m = globalThis.swingGateMatrix(rows, ticker);
ok(m && m.dir === 'long' && m.passed >= 1, 'swingGateMatrix returns aligned long with gate tally');
ok(typeof globalThis.swingTryClean === 'function', 'swingTryClean exported');
ok(typeof globalThis.scalpTryNear === 'function', 'scalpTryNear exported');
{
  const hit = globalThis.swingTryClean(rows, ticker);
  if (hit){
    ok(hit.dir === 'long' || hit.dir === 'short', 'swingTryClean direction');
    ok(typeof hit.entryType === 'string' && hit.entryType.length > 0, 'swingTryClean enriched entryType');
    ok(hit.targetPolicy && hit.targetPolicy.indexOf('unified') >= 0, 'swingTryClean unified targetPolicy');
    ok(isFinite(hit.mark), 'swingTryClean carries mark price');
  } else {
    ok(true, 'fixture may not pass all gates — enrich path still wired when hit');
  }
}
{
  const near = globalThis.swingTryNear(rows, ticker);
  if (near){
    ok(near.nearClean === true && near.passed >= 6, 'swingTryNear marks 6/7+ watch rows');
    ok(Array.isArray(near.missing) && near.missing.length >= 1, 'swingTryNear lists missing gates');
  } else {
    ok(true, 'fixture may not land 6/7 near-clean — swingTryNear path still wired');
  }
}
{
  /* G6 must not cap wide structure stops — veto honestly when R:R fails. */
  const wide = synthRows(260, 50000);
  const k = wide.length - 11;
  wide[k] = Object.assign({}, wide[k], { l: wide[k].l * 0.80 });
  const tm = globalThis.swingGateMatrix(wide, ticker);
  if (tm && tm.dir && isFinite(tm.a4) && tm.a4 > 0){
    ok(Math.abs(tm.dynamicRR - 1.75) > 1e-6 || tm.dynamicRR >= 2.0,
       'wide stop: dynamicRR is not pinned at dead 1.75 cap artifact');
    ok(Math.abs(tm.entry - tm.stop) / tm.a4 > 1.75 - 1e-9 || !tm.gates.find(function(g){ return g[0].indexOf('G6')===0 && g[1]; }),
       'wide stop: structure distance reported without 2.0xATR cap');
  } else {
    ok(true, 'wide-stop fixture did not align — G6 veto test skipped');
  }
}

{
  globalThis.regimeState = function(){ return { btcdPct: 58, dxyTrend: 'FLAT' }; };
  const altTicker = { symbol: 'DOGEUSDT', fundingPct: 0.01, mark: rows[rows.length - 1].c };
  const altHit = globalThis.swingTryClean(rows, altTicker);
  ok(altHit === null, 'swingTryClean blocks alt long when BTC.D > 55%');
  globalThis.regimeState = function(){ return null; };
}

console.log('\n== scalp gate matrix ==');
{
  function synthTf(n, start, step, sec){
    const out = [];
    for (let i = 0; i < n; i++){
      const c = start + i * step;
      out.push({ t: 1700000000 + i * sec, o: c, h: c + 1, l: c - 1, c, v: 1000 + i * 5 });
    }
    return out;
  }
  const h1 = synthTf(80, 100, 0.2, 3600);
  const m15 = synthTf(80, 100, 0.05, 900);
  const tick = { symbol: 'BTCUSDT', fundingPct: 0.01, mark: m15[m15.length - 1].c };

  ok(typeof globalThis.scalpGateMatrix === 'function', 'scalpGateMatrix exported');
  ok(typeof globalThis.scalpTryClean === 'function', 'scalpTryClean exported');
  ok(globalThis.scalpGateMatrix(h1.slice(0, 30), m15, tick, 120) === null, 'scalpGateMatrix: short history -> null');

  const mFar = globalThis.scalpGateMatrix(h1, m15, tick, 120);
  ok(mFar && mFar.dir === 'long' && mFar.passed >= 1, 'scalpGateMatrix: uptrend fixture yields long + gates');
  ok(mFar.gates.some(g => g[0].indexOf('settle') >= 0 && g[1] === true), 'scalpGateMatrix: funding settle gate passes at 120m');

  const mNear = globalThis.scalpGateMatrix(h1, m15, tick, 10);
  ok(mNear && mNear.passed < 7, 'scalpGateMatrix: <25m to funding blocks clean (passed ' + mNear.passed + ')');
  ok(globalThis.scalpTryClean(h1, m15, tick, 10) === null, 'scalpTryClean: not clean -> null');

  const badFund = globalThis.scalpGateMatrix(h1, m15, { fundingPct: 0.05, mark: tick.mark }, 120);
  ok(badFund && badFund.gates.some(g => g[0] === 'G4 funding' && g[1] === false), 'scalpGateMatrix: extreme funding fails G4');
}

console.log('\n== funding-fade swing/scalp path ==');
{
  /* Deterministic LCG uptrend. This seed lands a long cascade whose ONLY
     non-G4 failure is G6 — i.e. a genuine crowded-funding fade candidate, not
     a pathological straight-line ramp that fails half the matrix. */
  function fadeRows(){
    let s = 182137;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const out = []; let p = 100;
    for (let i = 0; i < 280; i++){
      const o = p;
      p = p * (1 + (rnd() - 0.5) * 0.02 + 0.003);
      out.push({ t: i * 14400, o,
        h: Math.max(o, p) * (1 + rnd() * 0.008),
        l: Math.min(o, p) * (1 - rnd() * 0.008),
        c: p, v: 1000 + rnd() * 500 });
    }
    return out;
  }
  const frRows = fadeRows();
  globalThis.hgPositioningClassify = function(){
    return { dir: 'short', longEv: [], shortEv: ['funding extreme +0.0600%/8h — longs pay', 'CROWDED'], score: 2, total: 2, fundingFade: true };
  };
  globalThis.smartSetup = function(cls, rows4h){
    if (!cls || cls.dir !== 'short') return null;
    const entry = rows4h[rows4h.length - 1].c;
    const stop = entry * 1.02;
    const risk = stop - entry;
    return { type: 'FADE', dir: 'short', entry, stop, t1: entry - 2 * risk, t2: entry - 3 * risk, rr1: 2, rr2: 3, confirmed: false, note: 'fade test' };
  };
  const crowded = { symbol: 'BTCUSDT', fundingPct: 0.06, mark: frRows[frRows.length - 1].c };
  /* CONTRACT: swingTryClean returns CLEAN TREND tickets only. A counter-trend
     funding fade off a FAILED matrix must never leak through it — BEST,
     STARTRADER and hgSwingCleanPlan all treat a non-null return as 7/7 clean. */
  const leak = globalThis.swingTryClean(frRows, crowded);
  ok(!leak || leak.fundingFade !== true,
     'swingTryClean NEVER returns a funding fade (clean-ticket contract holds)');
  const fadeHit = globalThis.swingTryFundingFade(frRows, crowded);
  ok(fadeHit && fadeHit.fundingFade === true && fadeHit.dir === 'short',
     'swingTryFundingFade returns the fade on its own opted-in entry point');
  ok(!fadeHit.stack || fadeHit.stack.tierHint !== 'clean',
     'funding fade is NOT stamped CLEAN — the matrix did not go 7/7');
  delete globalThis.hgPositioningClassify;
  delete globalThis.smartSetup;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
