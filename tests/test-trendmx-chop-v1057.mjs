/* HARDGATE — hg-v1057: TREND MATRIX · TREND-QUALITY WITNESS (chop/ER tier cap).

   The matrix scores five composite legs and mints CLEAN tickets, but nothing
   asked whether the tape the row was scored on HAS a trend to ride. The two
   house trend-quality instruments (indicators.js) now answer that:

     Choppiness Index (Dreiss, TASC 2009) — 0..100, >61.8 choppy, <38.2 trending
     Kaufman Efficiency Ratio      — 0..1, ~1 clean directional, near 0 noise

   trendmxChopState(r) reads the row's own 4h series and returns
   { chop, er, state } with state 'chop' ONLY when BOTH agree choppy
   (chop >= 61.8 AND er < 0.3), 'trend' only when BOTH agree directional
   (chop <= 38.2 AND er > 0.4), else null — mixed or unreadable is NO verdict
   (fail open, hg-v700). A CHOP tape caps the row at NEAR in trendmxRowTier
   (never CLEAN, never dropped — evidence first), the card prints a
   CHOP x · ER y bad chip, and the CoinDCX FORMING column stamps the reason:
   · CHOP for a choppy tape, · EARLY FORMING for a clean tape with no majority.

   Run: node tests/test-trendmx-chop-v1057.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* the same boot the hg-v1048 trendform guard uses — indicators.js FIRST so
   hgChoppiness / hgKaufmanER exist before trendtable.js reads them */
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = []; ctx.HG_TAB_MODS = {};
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js',
                   'hg-setup-core.js', 'crypto-position-risk.js', 'cryptogates.js',
                   'plans.js', 'setup-ui.js', 'trendtable.combined.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

const T4 = 14400;
/* a clean directional tape: constant slope, tiny wicks -> chop low, ER ~1 */
function mkTrend(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * 0.1;
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c - 0.01, h: c + 0.02, l: c - 0.02, c, v: 100 });
  }
  return rows;
}
/* a choppy tape: alternating closes, no net move -> chop ~99, ER ~0 */
function mkZigzag(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + (i % 2 === 0 ? 0.3 : -0.3);
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c, h: c + 0.02, l: c - 0.02, c, v: 100 });
  }
  return rows;
}
/* a mixed tape: mild slope but huge wicks -> chop high, ER high: no verdict */
function mkMixed(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * 0.05;
    rows.push({ t: 1760000000 - (n - 1 - i) * T4, o: c, h: c + 0.4, l: c - 0.4, c, v: 100 });
  }
  return rows;
}
/* the hg-v1048 fixture row shape, with the tape swapped in */
function row(sym, score, rows4h, gate){
  return {
    sym: sym, score: score, exchange: 'coindcx',
    comps: { d200: score > 0 ? 1 : (score < 0 ? -1 : 0), x: 0, h4: 0, cloud: 0, adx: 0 },
    adx: 24, price: 100 + Math.abs(score) * 2,
    gate: gate || null,
    rows4h: rows4h
  };
}
const CLEAN7 = { label: '7/7 CLEAN', clean7: true, nearClean: false, veto: false, gatesPassed: 7 };

console.log('== the seams ==');
{
  const W = boot();
  ok(typeof W.trendmxChopState === 'function', 'trendmxChopState is exported');
  ok(typeof W.trendmxChopChipHtml === 'function', 'trendmxChopChipHtml is exported');
  ok(typeof W.trendmxRowTier === 'function', 'trendmxRowTier is exported (the tier cap is testable directly)');
}

console.log('== the witness: both instruments must agree ==');
{
  const W = boot();
  const t = W.trendmxChopState({ rows4h: mkTrend(60) });
  ok(t.state === 'trend', 'a clean directional tape reads trend');
  ok(isFinite(t.chop) && t.chop <= 38.2, '  with Choppiness <= 38.2 (got ' + (t.chop != null ? t.chop.toFixed(1) : 'null') + ')');
  ok(isFinite(t.er) && t.er > 0.4, '  and Efficiency Ratio > 0.4 (got ' + (t.er != null ? t.er.toFixed(2) : 'null') + ')');

  const c = W.trendmxChopState({ rows4h: mkZigzag(60) });
  ok(c.state === 'chop', 'an oscillating no-net-move tape reads chop');
  ok(isFinite(c.chop) && c.chop >= 61.8, '  with Choppiness >= 61.8 (got ' + (c.chop != null ? c.chop.toFixed(1) : 'null') + ')');
  ok(isFinite(c.er) && c.er < 0.3, '  and Efficiency Ratio < 0.3 (got ' + (c.er != null ? c.er.toFixed(2) : 'null') + ')');

  const m = W.trendmxChopState({ rows4h: mkMixed(60) });
  ok(m.state === null, 'a high-chop high-ER tape is MIXED: no verdict, no cap (fail open)');
  ok(isFinite(m.chop) && isFinite(m.er), '  and the readable scalars still ride the object');

  const s = W.trendmxChopState({ rows4h: mkTrend(20) });
  ok(s.state === null && s.chop === null && s.er === null, 'a <25-bar tape is unreadable: state null, scalars null');
  const bare = W.trendmxChopState({ sym: 'X', score: 1, exchange: 'coindcx' });
  ok(bare.state === null && bare.chop === null && bare.er === null, 'a row with no 4h series never throws: null verdict');
}

console.log('== the tier cap: a CHOP tape caps the row at NEAR, never CLEAN ==');
{
  const W = boot();
  const goodPlan = { dir: 'long', entry: 101, stop: 100, t1: 103, rr1: 2.0 };
  const choppyClean = row('CX1', 3, mkZigzag(60), CLEAN7);
  const trendingClean = row('CX2', 3, mkTrend(60), CLEAN7);
  ok(W.trendmxRowTier(choppyClean, goodPlan) === 'near',
     'a 7/7 gate-clean row on a choppy tape is capped at NEAR');
  ok(W.trendmxRowTier(trendingClean, goodPlan) === 'clean',
     'the same row on a clean directional tape stays CLEAN');
  const htmlChop = W.trendmxTrendFormHTML([choppyClean]);
  ok(htmlChop.indexOf('7/7 CLEAN') < 0, 'the rendered board never prints 7/7 CLEAN for the capped row');
  ok(htmlChop.indexOf('NEAR') >= 0, '  it prints the NEAR label instead');
  const htmlTrend = W.trendmxTrendFormHTML([trendingClean]);
  ok(htmlTrend.indexOf('7/7 CLEAN') >= 0, 'the trending tape keeps its 7/7 CLEAN label');
}

console.log('== the FORMING column names why nothing formed ==');
{
  const W = boot();
  const hChop = W.trendmxTrendFormHTML([row('FX1', 1, mkZigzag(60))]);
  ok(hChop.indexOf('composite +1/5 · CHOP') >= 0, 'a forming choppy row stamps · CHOP beside the composite');
  const hTrend = W.trendmxTrendFormHTML([row('FX2', 1, mkTrend(60))]);
  ok(hTrend.indexOf('composite +1/5 · EARLY FORMING') >= 0, 'a forming directional row stamps · EARLY FORMING');
  const hMixed = W.trendmxTrendFormHTML([row('FX3', 1, mkMixed(60))]);
  ok(hMixed.indexOf('· CHOP') < 0 && hMixed.indexOf('EARLY FORMING') < 0,
     'a forming mixed row prints neither stamp (no verdict)');
  ok(hMixed.indexOf('composite +1/5</div>') >= 0, '  and its composite line stays bare');
}

console.log('== the chip ==');
{
  const W = boot();
  const chip = W.trendmxChopChipHtml(row('CX9', 3, mkZigzag(60), CLEAN7));
  ok(typeof chip === 'string' && chip.indexOf('CHOP ') >= 0 && chip.indexOf(' · ER ') >= 0 && chip.indexOf('stamp bad') >= 0,
     'a choppy row prints the CHOP x · ER y bad chip with both measured values');
  ok(W.trendmxChopChipHtml(row('CX8', 3, mkTrend(60), CLEAN7)) === '',
     'a trending row paints no chip (evidence, never a brag)');
  ok(W.trendmxChopChipHtml(row('CX7', 3, mkMixed(60), CLEAN7)) === '',
     'a mixed row paints no chip either');
}

console.log('== wiring pins — the shipped file actually does it ==');
{
  const src = read('trendtable.combined.js');
  ok(src.indexOf('var chopSt = trendmxChopState(r)') >= 0, 'the tier cap reads the trend-quality witness');
  ok(src.indexOf("if (chopSt && chopSt.state === 'chop') return 'near';") >= 0, 'a CHOP tape caps at NEAR in trendmxRowTier');
  ok(src.indexOf('trendmxCostChipHtml(r, plan) + trendmxChopChipHtml(r)') >= 0, 'the chip rides the plan chip line on the card');
  ok(src.indexOf('W.trendmxChopState = trendmxChopState') >= 0, 'the state seam is exported');
  ok(src.indexOf('W.trendmxChopChipHtml = trendmxChopChipHtml') >= 0, 'the chip seam is exported');
  ok(src.indexOf('· CHOP') >= 0 && src.indexOf('· EARLY FORMING') >= 0, 'the forming stamps exist in source');
}

console.log('\ntest-trendmx-chop-v1057: ' + passed + ' passed, 0 failed');
