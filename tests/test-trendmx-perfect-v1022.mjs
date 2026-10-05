/* HARDGATE — hg-v1022: THE PERFECT SETUP tier (TREND MATRIX side) + the
   VOLATILITY REGIME read. The desk already had a gate-clean class (7/7 matrix)
   and a conviction class (|composite| ≥ 2); the PERFECT tier is the strictest
   confluence read it can honestly print: max composite |5/5| AND 7/7 gate-clean
   AND momentum witness WITH AND volume witness WITH AND taker flow never against
   AND funding not crowded. It is a FILTER, not a promise — the forward ledger's
   `perfect` read-mark is how it earns a measured outcome.

   Covers:
     1) the PERFECT predicate: true only at full confluence, false on each leg
     2) the collector: perfect rows only, ranked by composite then gates
     3) the desk renderer: empty is silent by design; a bag renders a PERFECT desk
     4) the ATR-regime read: DEAD / HEALTHY / BLOWOFF bands, unreadable → null
     5) the card renderer stamps ★ PERFECT on perfect rows
   Run: node tests/test-trendmx-perfect-v1022.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js', 'omniroute.js', 'trendtable.combined.js'];
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
    catch(e){ console.error('boot failed on ' + f + ': ' + e.message); }
  }
  return ctx;
}

const W = boot();

/* ---- fixtures ---- */
function tape(n, tfSec, start, step){
  const rows = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c; c = c + step;
    // give it a real ATR so hgAtrPercentile / trendmxPlan are computable
    const h = Math.max(o, c) + Math.abs(step) * 0.6, l = Math.min(o, c) - Math.abs(step) * 0.6;
    rows.push({ t: 1750000000 - (n - 1 - i) * tfSec, o, h, l, c, v: 1000 + i * 10 });
  }
  return rows;
}
const ROWS4H = tape(120, 14400, 100, 0.6);

/* a PERFECT long row: every condition green */
function perfectRow(dir, over){
  over = over || {};
  const long = dir === 'long';
  return Object.assign({
    sym: 'ABCUSDT', exchange: 'delta',
    score: long ? 5 : -5,
    adx: 32, rsi: long ? 62 : 38,           // momentum WITH
    volDiv: null, volConf: long ? 'up' : 'down', // volume WITH
    flow: { verdict: 'with' },              // taker flow WITH (never against)
    fundingPct: long ? -0.01 : 0.01,        // not crowded
    price: 100, rows4h: ROWS4H, rows1h: [],
    gate: { clean7: true, veto: false, gatesPassed: 7, label: '7/7', hit: null }
  }, over);
}

/* ---- 1) the predicate ---- */
console.log('== the PERFECT predicate ==');
assert(typeof W.trendmxPerfectState === 'function', 'trendmxPerfectState exported');
assert(W.trendmxPerfectState(perfectRow('long')) === true, 'a max-confluence long is PERFECT');
assert(W.trendmxPerfectState(perfectRow('short')) === true, 'a max-confluence short is PERFECT (direction parity)');
assert(W.trendmxPerfectState(perfectRow('long', { score: 4 })) === false, '|score| 4 is not PERFECT (needs 5/5)');
assert(W.trendmxPerfectState(perfectRow('long', { score: -5 })) === false, 'a -5 score flips direction — not a long PERFECT');
assert(W.trendmxPerfectState(perfectRow('long', { gate: { clean7: false, veto: false } })) === false, 'not 7/7 clean → not PERFECT');
assert(W.trendmxPerfectState(perfectRow('long', { gate: { clean7: true, veto: true } })) === false, 'gate vetoed → not PERFECT');
assert(W.trendmxPerfectState(perfectRow('long', { rsi: 45 })) === false, 'momentum flat (RSI in pullback) → not PERFECT');
assert(W.trendmxPerfectState(perfectRow('long', { volConf: null })) === false, 'volume witness flat/null → not PERFECT');
assert(W.trendmxPerfectState(perfectRow('long', { flow: { verdict: 'against' } })) === false, 'taker flow against → not PERFECT');
assert(W.trendmxPerfectState(null) === false, 'null row → not PERFECT');
assert(W.trendmxPerfectState({}) === false, 'empty row → not PERFECT');

/* funding crowded (a long paying 0.20% is against) → not PERFECT */
assert(W.trendmxPerfectState(perfectRow('long', { fundingPct: 0.20 })) === false, 'crowded long funding → not PERFECT');

/* ---- 2) the collector ---- */
console.log('== the collector ==');
const rows = [
  perfectRow('long'),
  perfectRow('long', { sym: 'XYZUSDT', score: 4 }),   // not perfect
  perfectRow('short', { sym: 'DEFUSDT' }),            // perfect short
  { sym: 'NOPEUSDT', score: 5, gate: { clean7: true, veto: false }, rsi: 60, volConf: 'up', flow: { verdict: 'against' }, fundingPct: -0.01, rows4h: ROWS4H }
];
const pf = W.trendmxPerfectSetups(rows);
assert(Array.isArray(pf) && pf.length === 2, 'perfect collector yields 2 of 4 rows');
assert(pf[0].perfect === true && pf[1].perfect === true, 'collected rows carry the perfect flag');
assert(pf[0].row.sym === 'ABCUSDT' && pf[1].row.sym === 'DEFUSDT', 'collected rows are the two max-confluence fixtures');
assert(W.trendmxPerfectSetups([]).length === 0, 'empty input → empty bag');

/* ---- 3) the desk renderer ---- */
console.log('== the desk renderer ==');
assert(typeof W.trendmxPerfectDeskHTML === 'function', 'trendmxPerfectDeskHTML exported');
assert(W.trendmxPerfectDeskHTML([]) === '', 'an empty bag renders nothing (a quiet board is policy, not a fault)');
const desk = W.trendmxPerfectDeskHTML(pf);
assert(/PERFECT SETUP DESK/.test(desk), 'a non-empty bag renders a PERFECT SETUP DESK header');
assert(/★ PERFECT/.test(desk), 'the card carries the ★ PERFECT stamp');
assert(/filter, not a promise/.test(text(desk)), 'the header names it a filter, not a promise');

/* ---- 4) the ATR-regime read ---- */
console.log('== the volatility regime read ==');
assert(typeof W.trendmxAtrRegime === 'function', 'trendmxAtrRegime exported');
const flat = tape(140, 14400, 100, 0.0001);
const regFlat = W.trendmxAtrRegime({ rows4h: flat });
assert(regFlat && regFlat.regime === 'DEAD', 'a flat tape is DEAD TAPE (bottom-quintile ATR)');
const hot = tape(140, 14400, 100, (i) => 3);   // ignore — replaced below
hot.splice(0);
{ let c = 100; for (let i = 0; i < 140; i++){ const o = c; c = c + (i < 120 ? 0.0001 : 30);
    hot.push({ t: 1750000000 - (139 - i) * 14400, o, h: Math.max(o, c) + 20, l: Math.min(o, c) - 20, c, v: 1000 }); } }
const regHot = W.trendmxAtrRegime({ rows4h: hot });
assert(regHot && regHot.regime === 'BLOWOFF', 'a late spike puts ATR at the top quintile → BLOWOFF');
assert(W.trendmxAtrRegime({ rows4h: [] }) === null, 'no history → unreadable (null)');
assert(W.trendmxAtrRegime(null) === null, 'null row → unreadable (null)');

/* ---- 5) the card stamp (exercised through the desk renderer above) ---- */
console.log('== the card stamp ==');
assert(/★ PERFECT/.test(desk), 'the ★ PERFECT stamp rides the shared card renderer on the desk');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
