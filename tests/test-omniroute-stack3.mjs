/* HARDGATE — OMNIROUTE records its own replicated-gate stack, and the
   forward panel names the right gates for the right desk.

   THE MEASUREMENT BEHIND THIS. The same audit that gave gold its stack was
   run on OMNIROUTE: 10 Binance majors x 1,000 bars, 4h AND 1h, every firing
   settled at 2R, Sidak-corrected over 32 gates, a gate counting only if it
   cleared the bar on BOTH horizons with the same sign. Survivors: regime
   (z +8.5/+7.2) and htf-confirm (+5.9/+9.0), with stoch-rsi (+3.5/+3.3)
   sitting on the bar. BTC-regime alignment split 32.2% vs 24.8% at 2R and
   the sign held on 9 of 10 symbols — the per-symbol check matters because
   correlated symbols inflate any pooled z.

   TWO FACTS THIS FILE PINS:
     - each desk earns its OWN stack: gold's regime-fit and hurst-regime did
       NOT replicate on crypto, so OMNIROUTE must not record gold's keys and
       the panel must not caption crypto data with gold's gate names;
     - the claim is RECORDED, not acted on — stack3 goes into the forward
       log so the out-of-sample record can judge it, and nothing in the
       ranking or veto path reads it.

   Run: node tests/test-omniroute-stack3.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const OR = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');
const FW = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');

console.log('== the record site carries the CRYPTO stack, not gold\'s ==');
{
  ok(/'regime':1, 'htf-confirm':1, 'stoch-rsi':1/.test(OR),
     'stack3 counts exactly regime, htf-confirm, stoch-rsi');
  ok(!/'regime-fit':1[^]{0,40}'hurst-regime':1/.test(OR),
     'and never gold\'s regime-fit / hurst-regime, which did not replicate on crypto');
  const rec = OR.slice(OR.indexOf('var fwdRow = { sym: fitem.sym'), OR.indexOf('fwdRows.push(fwdRow)'));
  ok(/stack3:/.test(rec), 'stack3 rides on the same forward record as entry/stop/t1');
  ok(/pass === true/.test(rec), 'only an explicit pass counts — UNCHECKED is not agreement');
}

console.log('\n== recorded, not acted on ==');
{
  /* the ranking and veto paths must not read stack3 — the whole point is
     that the claim gets judged out-of-sample before anything trades on it */
  const rank = OR.slice(OR.indexOf('function hgOmniRank'), OR.indexOf('function', OR.indexOf('function hgOmniRank') + 10));
  ok(rank.indexOf('stack3') < 0, 'hgOmniRank never reads stack3');
  const grade = OR.slice(OR.indexOf('function hgOmniGrade'), OR.indexOf('function hgOmniEvaluate'));
  ok(grade.indexOf('stack3') < 0, 'hgOmniGrade never reads stack3');
}

console.log('\n== the evidence is readable, not write-only ==');
{
  ok(/hgFwdPanelHTML\('OMNIROUTE'/.test(OR),
     'the OMNIROUTE tab renders the forward panel under its pooled table');
  const pool = OR.slice(OR.indexOf('var fwdPanel'), OR.indexOf('renderPooled(res.pooled) + fwdPanel'));
  ok(/catch \(eFp\)/.test(pool), 'a panel failure degrades to the pooled table alone, never a blank tab');
}

console.log('\n== the panel captions each desk with its own gates ==');
{
  ok(/isGoldTab/.test(FW), 'the stack line is tab-aware');
  ok(/'regime-fit, htf-confirm and hurst-regime'/.test(FW), 'gold keeps its three');
  ok(/'regime, htf-confirm and stoch-rsi'/.test(FW), 'crypto names its own');
  ok(/31\.6% on tape alone against 44\.2%/.test(FW),
     'gold\'s in-sample context uses the corrected close-by-close figures, not the leaky originals');
  ok(/32\.2% at 2R against 35\.0%/.test(FW), 'crypto\'s context states its own in-sample split');
}

console.log('\n== stack3 flows through normalize -> settle -> byStack for OMNIROUTE records ==');
{
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { addEventListener(){}, createElement: () => ({ style: {} }), head: { appendChild(){} } };
  vm.createContext(ctx);
  vm.runInContext(FW, ctx, { filename: 'hg-forward.js' });
  const T0 = 1700000000;
  const bar = (i, hi, lo) => ({ t: T0 + (i + 1) * 3600, o: 100, h: hi, l: lo, c: 100, v: 1 });
  const mk = (st) => ctx.hgFwdNormalize({ tab: 'OMNIROUTE', mechanic: 'MMOVE', sym: 'BTCUSDT', tf: '4h',
    dir: 'long', entry: 100, stop: 90, t1: 120, barT: T0, horizonBars: 6, stack3: st });
  ok(mk(2).stack3 === 2, 'an OMNIROUTE record keeps its stack3 through normalize');
  const settled = [ ctx.hgFwdSettleOne(mk(2), [bar(0, 121, 101)]),
                    ctx.hgFwdSettleOne(mk(2), [bar(0, 105, 89)]) ];
  const st = ctx.hgFwdStatsOf(settled, 'OMNIROUTE', 'MMOVE', false);
  ok(st.byStack[2].n === 2 && st.byStack[2].w === 1,
     'and byStack aggregates it for the panel (2 settled, 1 win at stack 2)');
}

console.log('\nomniroute stack3: ' + passed + ' checks passed');
