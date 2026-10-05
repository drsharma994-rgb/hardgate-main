/* HARDGATE — hg-v1034: THE FUNDAMENTAL + SENTIMENT WITNESS (TREND MATRIX).

   Until this pack the TREND MATRIX judged every setup on its own closes and
   one venue's flow — technical + microstructure only. It never read what the
   market is POSITIONED to do or what the macro/sentiment says. This pack wires
   the house fundamental stack (fundamental-stack.js hgFundamentalGate — the
   SAME read OmniBTC and the gold desks answer to) into the matrix as a fourth
   evidence witness, mirroring the flow/mom/vol idiom exactly:

     - EVIDENCE ONLY — the composite stays five legs (a sixth would re-scale
       every tmScore the forward ledger measures).
     - refuse  (red-folder blackout) / against  (2+ net checked votes AGAINST
       the row's direction) hold the row off BOTH class desks and cap it at
       NEAR — counted per class under the fund reason; one witness never flips.
     - with    (2+ net checked votes WITH) chips TAILWIND and hands the ledger
       a fundWith read-mark — never a composite point.
     - flat / null — a readable board with no decisive vote, or a dark board:
       silent, holds nothing off (the hg-v700 honest-degradation rule).

   Covers:
     1) the state machine: refuse / against / with / flat / null
     2) both directions — the same board is a headwind for one side, a
        tailwind for the other
     3) a dark board holds nothing off (unchecked is not a veto)
     4) the tier: refuse + against cap at NEAR over a 7/7 gate
     5) the collector: held per class, the fund reason counted and named
     6) PERFECT is disqualified by refuse/against
     7) the chip names the verdict; the house renderer is reused
   Run: node tests/test-trendmx-fundamental-v1034.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js',
               'omniroute.js', 'fundamental-stack.js', 'trendtable.combined.js'];

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of FILES){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* reported below */ }
  }
  return ctx;
}

/* ---- fixture boards (the fundamental-stack v1003 / gold-desk shapes) ---- */
function btcHeadwindLong(W){
  /* two checked BEAR votes for BTC: term contango (longs pay) + F&G extreme greed */
  W.termBasisState = function(){ return { rows: [{ sym: 'BTCUSDT', curve: { regime: 'contango' } }] }; };
  W.S = { fng: { v: 88, c: 'Extreme Greed' }, dom: null };
}
function btcTailwindLong(W){
  W.termBasisState = function(){ return { rows: [{ sym: 'BTCUSDT', curve: { regime: 'backwardation' } }] }; };
  W.S = { fng: { v: 12, c: 'Extreme Fear' }, dom: null };
}
function btcBlackout(W){
  W.hgNewsRisk = function(){ return { risk: 'high', blackout: true, events: [{ title: 'US CPI' }] }; };
}

/* a minimal BTC row the witness can read (score drives tmDirOf) */
function row(w, opts){
  return Object.assign({ sym: 'BTCUSDT', score: 4, exchange: 'binance' }, opts || {});
}

console.log('== 1) the state machine: refuse / against / with / flat / null ==');
{
  const W = boot();
  /* dark board -> null (holds nothing off) */
  const r0 = row(W);
  assert(W.trendmxFundState(r0, 'long') === null, 'a dark board is null — holds nothing off');

  /* hostile long board: 2 bear votes -> against the long */
  btcHeadwindLong(W);
  const r1 = row(W);
  assert(W.trendmxFundState(r1, 'long') === 'against', 'BTC long into contango + F&G greed demotes (2 bear votes)');
  assert(W.trendmxFundState(r1, 'short') === 'with', 'the same board is a TAILWIND for the short (2 bear votes)');

  /* tailwind long board: 2 bull votes -> with the long, against the short */
  btcTailwindLong(W);
  const r2 = row(W);
  assert(W.trendmxFundState(r2, 'long') === 'with', 'BTC long into backwardation + F&G fear chips TAILWIND');
  assert(W.trendmxFundState(r2, 'short') === 'against', 'the same board is a headwind for the short');

  /* blackout -> refuse, direction-free */
  btcBlackout(W);
  const r3 = row(W);
  assert(W.trendmxFundState(r3, 'long') === 'refuse', 'a red-folder blackout refuses, direction-free');
}

console.log('\n== 2) the gate reads through the row, memoized ==');
{
  const W = boot();
  btcHeadwindLong(W);
  const r = row(W);
  const g1 = W.trendmxFundGate(r);
  assert(g1 && g1.demote === true && /FUNDAMENTAL HEADWIND 2v0/.test((g1.chips || []).join(' ')),
    'the memoized gate carries the headwind chip with the decisive split');
  assert(W.trendmxFundGate(r) === g1, 'the gate is computed once and memoized on the row');
}

console.log('\n== 3) the tier: refuse + against cap at NEAR over a 7/7 gate ==');
{
  const W = boot();
  function cleanRow(){ return row(W, { gate: { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null } }); }
  btcHeadwindLong(W);
  const rA = cleanRow();
  assert(W.trendmxRowTier(rA, W.trendmxPlan(Object.assign({}, rA, { dir: 'long' }))) !== 'clean',
    'an AGAINST row is never CLEAN (capped at NEAR)');
  btcBlackout(W);
  const rR = cleanRow();
  assert(W.trendmxRowTier(rR, W.trendmxPlan(Object.assign({}, rR, { dir: 'long' }))) !== 'clean',
    'a REFUSED row is never CLEAN');
}

console.log('\n== 4) the collector holds off per class with the fund reason ==');
{
  const W = boot();
  const r1 = row(W, { score: 4, gate: { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null } });
  btcHeadwindLong(W);
  const out = W.trendmxLimitClasses([r1]);
  assert(out.heldClean === 1 && out.heldWhy.clean.fund === 1 && out.clean.length === 0,
    'a clean row against a 2v0 headwind is held off, counted under the fund reason');
  const html = W.trendmxGateCleanDeskHTML(out.clean, out.heldClean, out.heldWhy.clean);
  assert(/fundamental \+ sentiment/i.test(text(html)), 'the held verdict names the fundamental reason');
  /* a dark board holds nothing off — the same row passes */
  const W2 = boot();
  const r2 = row(W2, { score: 4, gate: { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null } });
  const out2 = W2.trendmxLimitClasses([r2]);
  assert(out2.heldClean === 0 && out2.heldWhy.clean.fund === 0, 'a dark board holds nothing off (unchecked is not a veto)');
}

console.log('\n== 5) PERFECT is disqualified by refuse / against ==');
{
  const W = boot();
  btcHeadwindLong(W);
  const r = row(W, { score: 5, gate: { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null } });
  assert(W.trendmxPerfectState(r) === false, 'a 2v0 headwind disqualifies PERFECT');
}

console.log('\n== 6) the chip reuses the house renderer ==');
{
  const W = boot();
  btcHeadwindLong(W);
  const r = row(W);
  const chip = W.trendmxFundChipHtml(r);
  assert(/FUNDAMENTAL HEADWIND 2v0/.test(text(chip)), 'the headwind chip paints the decisive split via the house renderer');
  const W2 = boot();
  const r2 = row(W2);
  assert(W2.trendmxFundChipHtml(r2) === '', 'a dark board paints no chip');
}

console.log('\ntest-trendmx-fundamental-v1034: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
