/* HARDGATE — hg-v1057 accuracy pack: the three new OMNIBTC WATCH mechanics.

   TSI CROSS (research B1) — the double-smoothed momentum line crossing its
   signal EMA on the winner tape; ADAPTIVE TREND (B3) — KAMA(10,2,30) side +
   SuperTrend(10,3) side must agree; SPRING (B4) — a range-bound liquidity
   sweep reclaimed on springboard volume, stop beyond the sweep extreme.

   All three ship as WATCH candidates (clean === false, near === true,
   passed === 6) — the desk's measured-edge ledger decides whether any of
   them ever earns a crown. Fail open: an unreadable tape mints nothing.

   Run: node tests/test-omnibtc-engines-accuracy-v1057.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js',
                   'hg-setup-core.js', 'crypto-position-risk.js', 'cryptogates.js',
                   'plans.js', 'setup-ui.js', 'omnibtc-engines.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

const T4 = 14400, LAST_T = 1760000000;
function tape(n, fn){ const rows = []; for (let i = 0; i < n; i++){
  const { o, h, l, c, v } = fn(i);
  rows.push({ t: LAST_T - (n - 1 - i) * T4, o, h, l, c, v: v == null ? 100 : v });
} return rows; }
function closers(rows){ return rows.map(r => r.c); }

/* ---- the trend tapes (deterministic agree cases) ---- */
const UP = tape(140, i => { const c = 100 + i * 0.4; return { o: c - 0.1, h: c + 0.3, l: c - 0.3, c }; });
const DN = tape(140, i => { const c = 160 - i * 0.4; return { o: c + 0.1, h: c + 0.3, l: c - 0.3, c }; });

console.log('== the three mechanics are exported ==');
{
  const W = boot();
  ok(typeof W.hgObtcTryTsi === 'function', 'hgObtcTryTsi exported');
  ok(typeof W.hgObtcTryAdaptive === 'function', 'hgObtcTryAdaptive exported');
  ok(typeof W.hgObtcTrySpring === 'function', 'hgObtcTrySpring exported');
}

console.log('== B1: TSI CROSS fires on a fresh turn, never on a dying tape ==');
{
  const W = boot();
  /* a late turn: long decline, then a rise confined to the last two bars so
     the TSI line crosses its signal inside the last 3 closed bars (float
     dust handled with the same epsilon the engine uses) */
  const riseN = 2, slope = 1.6;
  const T = tape(120, i => {
    if (i < 120 - riseN) { const c = 150 - i * 0.5; return { o: c + 0.1, h: c + 0.3, l: c - 0.3, c }; }
    const c = (150 - (120 - riseN) * 0.5) + (i - (120 - riseN)) * slope;
    return { o: c - 0.2, h: c + 0.3, l: c - 0.2, c };
  });
  /* compute the real cross position with the booted math */
  const t = W.tsi(closers(T), 13, 25), sig = W.nanEmaLocal(t, 13);
  const EPS = 1e-9;
  let crossIdx = -1;
  for (let i = T.length - 3; i < T.length - 1; i++){
    if (isFinite(t[i]) && isFinite(sig[i]) && t[i] <= sig[i] + EPS && t[i + 1] > sig[i + 1] + EPS){ crossIdx = i; break; }
  }
  const row = W.hgObtcTryTsi(T);
  ok(crossIdx >= 0, 'premise: the fixture cross lands in the last 3 bars (' + crossIdx + ')');
  ok(row && row.dir === 'long' && row.engine === 'TSI CROSS', 'a fresh long cross in the last 3 bars mints the TSI watch');
  ok(row.clean === false && row.near === true && row.passed === 6, '  as a WATCH, never a clean ticket');
  ok(isFinite(row.entry) && isFinite(row.stop) && isFinite(row.t1) && row.stop > 0 && row.stop !== row.entry,
     '  with real levels (entry/stop/t1)');
  /* a pure downtrend: TSI stays negative, no up-cross in the last 3 */
  const down = W.hgObtcTryTsi(DN);
  ok(down === null || down.dir !== 'long', 'a dying tape never mints a long');
  const thin = W.hgObtcTryTsi(tape(30, i => { const c = 100 + i * 0.1; return { o: c, h: c + 0.2, l: c - 0.2, c }; }));
  ok(thin === null, 'a thin tape mints nothing');
}

console.log('== B3: ADAPTIVE TREND needs KAMA + SuperTrend to agree ==');
{
  const W = boot();
  const upRow = W.hgObtcTryAdaptive(UP);
  ok(upRow && upRow.dir === 'long' && upRow.engine === 'ADAPTIVE TREND',
     'a clean uptrend reads long (KAMA rising + SuperTrend 1)');
  ok(upRow.clean === false && upRow.near === true && isFinite(upRow.entry) && isFinite(upRow.stop) && isFinite(upRow.t1),
     '  WATCH shape with real levels');
  const dnRow = W.hgObtcTryAdaptive(DN);
  ok(dnRow && dnRow.dir === 'short', 'the mirrored downtrend reads short');
  /* oscillating tape: the engine either agrees (both flipped together) or
     refuses — it never mints a row off one indicator alone */
  const CH = tape(140, i => { const c = 100 + Math.sin(i / 3) * 2; return { o: c - 0.05, h: c + 0.4, l: c - 0.4, c }; });
  const chRow = W.hgObtcTryAdaptive(CH);
  ok(chRow === null || (chRow.dir === 'long' || chRow.dir === 'short'), 'the choppy tape never throws (null or honest agree)');
  ok(W.hgObtcTryAdaptive(tape(40, i => { const c = 100 + i * 0.1; return { o: c, h: c + 0.2, l: c - 0.2, c }; })) === null,
     'a thin tape mints nothing');
}

console.log('== B4: SPRING needs range + sweep + reclaim + springboard volume ==');
{
  const W = boot();
  function springTape(){
    const rows = [];
    /* the range: a ±0.5 zigzag (pre-sweep Choppiness reads ~97) */
    for (let i = 0; i < 100; i++){
      const c = 100 + (i % 2 === 0 ? 0.5 : -0.5);
      rows.push({ t: LAST_T - (99 - i) * T4, o: c - 0.03, h: c + 0.1, l: c - 0.1, c, v: 100 });
    }
    /* sweep bar (n-4): wicks below the prior 20-bar low, closes weak */
    rows[96] = Object.assign({}, rows[96], { h: 99, l: 94.2, c: 96.5, v: 90 });
    /* reclaim bars close back inside the range; the last bar on springboard volume */
    rows[97] = Object.assign({}, rows[97], { l: 98.2, c: 99.1, v: 110 });
    rows[98] = Object.assign({}, rows[98], { l: 98.8, c: 99.8, v: 120 });
    rows[99] = Object.assign({}, rows[99], { l: 99.0, c: 100.8, h: 101.2, v: 420 });
    return rows;
  }
  const S = springTape();
  /* the engine reads the PRE-SWEEP chop (the range, not the spring's exit) */
  const chopPre = W.hgChoppiness(S, 14)[S.length - 5];
  const row = W.hgObtcTrySpring(S);
  ok(isFinite(chopPre) && chopPre >= 61.8, 'premise: the range reads choppy before the sweep (' + chopPre.toFixed(1) + ')');
  ok(row && row.dir === 'long' && row.engine === 'SPRING', 'a range-bound sweep reclaimed on 4x volume mints the spring');
  ok(isFinite(row.stop) && row.stop < row.entry && row.stop <= 94.2, '  the stop sits beyond the sweep extreme (' + row.stop + ')');
  ok(row.clean === false && row.near === true && isFinite(row.t1), '  WATCH shape with a target');
  /* a trending tape is not a spring: no range precondition */
  ok(W.hgObtcTrySpring(UP) === null, 'a trending tape never mints a spring');
  /* no springboard volume: the same geometry without the volume bar refuses */
  const SV = springTape(); SV[99] = Object.assign({}, SV[99], { v: 100 });
  const noVol = W.hgObtcTrySpring(SV);
  ok(noVol === null, 'without springboard volume the sweep is a stop-run, not a spring');
}

console.log('== wiring pins — the pool takes the three mechanics ==');
{
  const src = read('omnibtc-engines.js');
  ok(src.indexOf("take('TSI CROSS', hgObtcTryTsi(rows4h)") >= 0, 'TSI CROSS is taken in the pool');
  ok(src.indexOf("take('ADAPTIVE TREND', hgObtcTryAdaptive(rows4h)") >= 0, 'ADAPTIVE TREND is taken in the pool');
  ok(src.indexOf("take('SPRING', hgObtcTrySpring(rows4h)") >= 0, 'SPRING is taken in the pool');
  ok(src.indexOf('W.hgObtcTryTsi = hgObtcTryTsi') >= 0 && src.indexOf('W.hgObtcTrySpring = hgObtcTrySpring') >= 0,
     'the seams are exported for tests');
  ok(src.indexOf('hg-v1057') >= 0, 'the pack is documented in the file');
}

console.log('\ntest-omnibtc-engines-accuracy-v1057: ' + passed + ' passed, 0 failed');
