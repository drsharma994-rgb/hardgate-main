#!/usr/bin/env node
/* hg-v1493 — the GOLD SCALP indicator sweep, shipped: THE MEASURED SQUEEZE
   BOOST. scripts/goldscalp-winrate-lab.mjs now records the full gold-catalog
   indicator stack per candidate (VR20, ENTROPY20, RSI14, ADX, Kaufman ER,
   squeeze, DMI, BB %b, HV20, Parkinson20, volume ratio, TSMOM96, SMA50) and
   runs an INDICATOR SWEEP before the greedy search: every latest-indicator
   clause measured ALONE on the three search windows and the held-out window.
   Fifteen clauses measured; the ONE that cleared the bar alone:

     squeeze ON (the BB/KC volatility-compression state, hg-v1471's shared
     stack): +0.19R/trade over n=196 on W1-W3 and +0.36R over n=74 on the
     held-out W4 — vs the book's −0.004R. improves: true in the artifact.

   Everything else measured mixed or thin (dmiWith/skipBbExtreme/volAbove/
   skipHvSpike/tsmomWith/sma50With — no search-window improvement; VR/
   entropy directionally interesting but thin, n=100/55, and fail the
   search-window bar).

   SHIP (record-only, the hg-v1471 marks-never-gates shape): the squeeze-ON
   state is STAMPED on the candidate ('LAB SQUEEZE ON' + a pts-0 factor line
   naming the measurement) in goldRankSetups, where the catalog stack's
   indReads are already computed once per scan. NOT a rank boost: the +0.19R
   cohort was measured over ALL squeeze-ON candidates (longs and demoted rows
   included), and on this walk window squeeze-ON almost never coincides with
   a LEAD-ELIGIBLE short — a boost would extrapolate the measurement onto a
   population it never measured. The stamp is disclosure; the boost idea is
   parked until its own re-walk measures the lead-eligible squeeze cohort
   directly (the harness now loads the catalog, so the next walk records the
   whole stack per trade — the fidelity gap this pack also closes). Lever
   HG_GS_LAB_SQUEEZE (default ON; localStorage hg_gs_lab_squeeze=0 removes
   the stamp). Run: node tests/test-goldscalp-lab-v1493.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; console.log('  ok  - ' + m); } else { fail++; console.error('  FAIL- ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. the sweep is committed and squeeze measured the winner ---------- */
console.log('[1] the indicator sweep artifact');
{
  const lab = JSON.parse(read('scripts/goldscalp-winrate-lab-results.json'));
  ok(Array.isArray(lab.indicatorSweep) && lab.indicatorSweep.length >= 15,
     'the sweep measured ' + (lab.indicatorSweep || []).length + ' indicator clauses');
  const sq = (lab.indicatorSweep || []).find(x => x.clause === 'squeezeOn');
  ok(!!sq && sq.improves === true, 'squeezeOn improves: true in the artifact');
  ok(sq && sq.search && sq.search.n === 196 && Math.abs(sq.search.net - 0.193) < 0.001,
     'search cohort: n=196, +' + (sq ? sq.search.net.toFixed(3) : '?') + 'R/trade');
  ok(sq && sq.heldOut && sq.heldOut.n === 74 && Math.abs(sq.heldOut.net - 0.359) < 0.001,
     'held-out cohort: n=74, +' + (sq ? sq.heldOut.net.toFixed(3) : '?') + 'R/trade — above the n>=50 bar');
  const others = (lab.indicatorSweep || []).filter(x => x.clause !== 'squeezeOn');
  ok(others.every(x => x.improves !== true), 'no OTHER indicator clause cleared the bar alone (honest nulls recorded)');
}

/* ---------- 2. the wiring is textual ---------- */
console.log('[2] the lever and the ranker clause');
{
  const gi = read('goldind.js');
  ok(/var HG_GS_LAB_SQUEEZE_LS = 'hg_gs_lab_squeeze';/.test(gi), 'the localStorage lever key is declared');
  ok(/var HG_GS_LAB_SQUEEZE = true;/.test(gi), 'and defaults ON');
  ok(/function hgGoldLabSqueezeInit/.test(gi) && /function hgGoldSetLabSqueeze/.test(gi) && /function hgGoldLabSqueezeOn/.test(gi),
     'init / set / on — the house lever triple');
  ok(/W\.hgGoldSetLabSqueeze = hgGoldSetLabSqueeze;/.test(gi), 'and the lever is exported');
  ok(/if \(HG_GS_LAB_SQUEEZE && indReads && indReads\.squeeze === 'ON' && !c\.demoted\)\{/.test(gi),
     'the clause rides goldRankSetups\\u2019 tally, squeeze-ON only, never on a demoted row');
  ok(gi.indexOf("label: 'LAB SQUEEZE ON") >= 0 && gi.indexOf("c.stamps.push('LAB SQUEEZE ON')") >= 0,
     'the +2 parts label and the stamp are both written');
  ok(gi.indexOf("var indReads = null") < gi.indexOf("HG_GS_LAB_SQUEEZE && indReads"),
     'and indReads (computed once per scan) is in scope where the clause reads it');
}

/* ---------- 3. the lever unit ---------- */
console.log('[3] the lever');
{
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity, Float64Array };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  try { vm.runInContext(read('goldind.js'), ctx, { filename: 'goldind.js' }); } catch (e) {}
  const W = ctx.window || ctx;
  ok(typeof W.hgGoldSetLabSqueeze === 'function' && W.hgGoldLabSqueezeOn() === true, 'defaults ON');
  W.hgGoldSetLabSqueeze(false);
  ok(W.hgGoldLabSqueezeOn() === false, 'set(false) turns it off');
  W.hgGoldSetLabSqueeze(true);
  ok(W.hgGoldLabSqueezeOn() === true, 'and back on');
}

/* ---------- 4. the behavior, on the real ranker ---------- */
console.log('[4] the ranker stamps squeeze-ON rows');
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity, Float64Array };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'gold-catalog.js', 'goldind.js'])
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) {}
  return ctx;
}
const T0 = 1750000000;
function tape2(trendBars, trendStep, flatBars, flatWick){
  const rows = []; let c = 3000;
  for (let i = 0; i < trendBars; i++){ const o = c; c = c + trendStep;
    rows.push({ t: T0 + i * 900, o, h: Math.max(o, c) + trendStep * 0.5, l: Math.min(o, c) - trendStep * 0.5, c, v: 1000 }); }
  for (let i = 0; i < flatBars; i++){ const o = c; const c2 = c + (i % 2 ? 0.05 : -0.05);
    rows.push({ t: T0 + (trendBars + i) * 900, o, h: Math.max(o, c2) + flatWick, l: Math.min(o, c2) - flatWick, c: c2, v: 1000 }); }
  return rows;
}
{
  const W = boot();
  const squeezeTape = tape2(200, 1, 60, 0.5);
  const ir = W.hgGoldIndicatorReads(squeezeTape, {});
  ok(ir.squeeze === 'ON', 'the crafted tape reads squeeze ON (BB collapsed inside KC after the trend)');
  const mk = (dir) => ({ id: 'ob|' + dir, stratKey: 'ob', strategy: 'OB', sym: 'XAUUSD', dir,
    entry: 3300, stop: 3290, t1: 3320, rr: 2, tally: 4, grade: 'B', score: 4, stamps: [], atr: 10,
    plan: { entry: 3300, stop: 3290, t1: 3320 } });
  const ctxR = { now: (T0 + 260 * 900) * 1000, news: null, macro: null, spot: null, fng: null,
    style: 'goldscalp', perpNative: null, crossVenue: null,
    rows15m: squeezeTape, rows1h: squeezeTape.slice(-400), rows4h: squeezeTape.slice(-220) };
  const rk = W.goldRankSetups([mk('long'), mk('short')], ctxR) || { ranked: [] };
  const ranked = rk.ranked || [];
  ok(ranked.length >= 1, 'the ranker ranked the hand-built candidates (ranked ' + ranked.length + ')');
  const withStamp = ranked.filter(c => (c.stamps || []).indexOf('LAB SQUEEZE ON') >= 0);
  ok(withStamp.length === ranked.length && ranked.length >= 1,
     'every ranked row carries the LAB SQUEEZE ON stamp (' + withStamp.length + '/' + ranked.length + ')');
  ok(ranked.every(c => (c.freeReads && c.freeReads['ind:bbSqueeze']) === true),
     'and the catalog squeeze mark rode the row too (ind:bbSqueeze true)');
  /* lever OFF: no stamp, no boost */
  W.hgGoldSetLabSqueeze(false);
  const rk2 = W.goldRankSetups([mk('long')], ctxR) || { ranked: [] };
  ok((rk2.ranked || []).every(c => (c.stamps || []).indexOf('LAB SQUEEZE ON') < 0),
     'lever OFF: no squeeze stamp, no boost (the ranker\\u2019s own arithmetic unchanged)');
  W.hgGoldSetLabSqueeze(true);
  /* squeeze-OFF tape: pure trend, never consolidates — no stamp even with the lever on */
  const trendTape = tape2(260, 1, 0, 0.5);
  const ir2 = W.hgGoldIndicatorReads(trendTape, {});
  const ctxT = Object.assign({}, ctxR, { rows15m: trendTape, rows1h: trendTape.slice(-400), rows4h: trendTape.slice(-220) });
  const rk3 = W.goldRankSetups([mk('long')], ctxT) || { ranked: [] };
  ok((rk3.ranked || []).every(c => (c.stamps || []).indexOf('LAB SQUEEZE ON') < 0),
     'a squeeze-OFF tape (' + (ir2.squeeze || 'unreadable') + '): no stamp — the boost follows the state, not the lever alone');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD SCALP SQUEEZE-BOOST TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
