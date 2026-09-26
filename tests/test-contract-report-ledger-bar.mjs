/* HARDGATE — CONTRACT REPORT's forward record is dated on the bar the plan
   was composed on, and carries the funding the plan read (hg-v986).

   The report is handed the 4h series and a ticker; planFrom composes ONE
   plan on the last closed 4h bar of that series and reads the ticker. The
   record it then wrote carried the plan's mark (hg-v981) and NOTHING that
   said which bar it was — so hgFwdRecordScan dated it on the floor of the
   clock: the hg-v978 defect on a crypto desk. Settlement walks strictly
   after barT, so the first closed bar after the signal was skipped; and a
   FULL REPORT pressed across a clock boundary on the SAME closed bar wrote
   a second record. The ticker's funding, read one function up from the
   record site, never reached the record either (hg-v985 named this desk
   "no figure in reach at its record site" — true of that site).

   Every claim here is driven through the real report on rows whose last
   closed bar sits THREE 4h bars behind the clock, so the clock bar and the
   signal bar cannot coincide by accident.

   Run: node tests/test-contract-report-ledger-bar.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const ENGINES = ['indicators.js', 'indicators2.js', 'plans.js', 'structure-levels.js', 'best-levels.js',
                 'formation.js', 'cryptogates.js', 'edge.js', 'squeeze.js', 'meanrev.js', 'trendtable.js',
                 'liqs.js', 'reversalsniper.js', 'pinemath.js', 'pine-sub.js', 'hg-setup-core.js', 'hg-forward.js'];

const SEC4H = 14400;
/* one controllable clock per boot: hg-forward reads Date.now() for its
   floor-of-now fallback and its future-bar clamp */
function boot(clockMs){
  const store = {};
  const state = { now: clockMs };
  class ClockDate extends Date {
    constructor(...a){ if (a.length) super(...a); else super(state.now); }
    static now(){ return state.now; }
  }
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date: ClockDate, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, Error, TypeError, Set, Map, setTimeout, clearTimeout, encodeURIComponent, Intl, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem(k, v){ store[k] = String(v); }, removeItem(k){ delete store[k]; } };
  ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  ctx.fetch = async () => ({ ok: true, json: async () => ({}) });
  vm.createContext(ctx);
  for (const f of ENGINES){
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) { /* engine optional */ }
  }
  vm.runInContext(read('contract-report.js'), ctx, { filename: 'contract-report.js' });
  ctx.__clock = state;
  return ctx;
}

/* the fixture test-contract-report.mjs forms a ticket on: a gentle sine-drift
   tape. Its last closed bar is `back` 4h bars behind the clock. */
function gen(n, base, clockSec, back){
  const rows = []; let p = base;
  const t0 = Math.floor(clockSec / SEC4H) * SEC4H - (n + back - 1) * SEC4H;   /* last row = clock bar - back bars */
  for (let i = 0; i < n; i++){
    p = p * (1 + 0.001 * Math.sin(i / 7) + 0.0004);
    rows.push({ t: t0 + i * SEC4H, o: p * 0.999, h: p * 1.004, l: p * 0.996, c: p, v: 1000 });
  }
  return rows;
}
function runReport(ctx, r4, ticker){
  return ctx.hgContractReportRun({ sym: 'BTCUSD', rows4h: r4, rows1h: r4, rows15m: r4,
    ticker: Object.assign({ symbol: 'BTCUSD', mark: r4[r4.length - 1].c }, ticker || {}) });
}

const CLOCK = Date.UTC(2026, 8, 26, 13, 37, 0);           /* a fixed instant, not the wall clock */
const clockSec = Math.floor(CLOCK / 1000);
const clockBar = Math.floor(clockSec / SEC4H) * SEC4H;

console.log('1. the record is dated on the last closed 4h bar the plan was composed on, not the clock');
{
  const ctx = boot(CLOCK);
  const r4 = gen(260, 50000, clockSec, 3);
  const last = r4[r4.length - 1];
  ok(last.t === clockBar - 3 * SEC4H, 'fixture: the last closed bar sits three 4h bars behind the clock (' + last.t + ' vs clock bar ' + clockBar + ')');
  const rep = runReport(ctx, r4, { fundingPct: 0.01 });
  ok(rep && rep.plan && rep.plan.ok === true, 'the report forms a plan on this tape (' + (rep.plan && rep.plan.source) + ')');
  ok(rep.plan.barT === last.t, 'planFrom stamps the last closed bar\'s time on the plan (' + rep.plan.barT + ')');
  ok(rep.plan.fundingPct === 0.01, 'planFrom stamps the funding the ticker carried on the plan');
  ok(ctx.hgContractReportRecord(rep) === 1, 'the record is written');
  const recs = ctx.hgFwdRecords('SEARCH-REPORT');
  ok(recs.length === 1, 'one record under the report\'s own tab');
  const r = recs[0];
  ok(r.barT === last.t, 'the record is dated on the signal bar (' + r.barT + ')');
  ok(r.barT !== clockBar, 'and NOT on the clock bar (' + clockBar + ') — the hg-v978 defect, gone from this desk');
  ok(r.mark === last.c, 'the mark still rides (hg-v981)');
  ok(r.fundingPct === 0.01, 'the record carries the funding the plan read');
  ok(r.fundAgainst === false, 'and the ledger derived the directional verdict from the one rule (long at +0.01% is not against)');
  ok(r.dir === 'long' && r.tf === '4h', 'direction and timeframe as before');
}

console.log('\n2. what the date buys: settlement starts on the FIRST bar after the signal');
{
  const ctx = boot(CLOCK);
  const r4 = gen(260, 50000, clockSec, 3);
  const last = r4[r4.length - 1];
  const rep = runReport(ctx, r4, { fundingPct: 0.01 });
  ok(rep.plan.ok && rep.plan.dir === 'long', 'a long plan with t1 ' + rep.plan.t1);
  ctx.hgContractReportRecord(rep);
  /* the bar right after the signal bar trades through T1 — it closed two
     bars before the clock, so a clock-dated record could never see it */
  const hit = { t: last.t + SEC4H, o: last.c, h: rep.plan.t1 * 1.002, l: last.c * 0.999, c: rep.plan.t1 * 1.001, v: 1200 };
  ok(hit.t < clockBar, 'fixture: the T1 bar is strictly before the clock bar');
  const settled = ctx.hgFwdResolve('BTCUSD', '4h', r4.concat([hit]));
  ok(settled === 1, 'that bar settles the record (' + settled + ')');
  const r = ctx.hgFwdRecords('SEARCH-REPORT')[0];
  ok(r.state && r.state !== 'open', 'the record reads settled (' + r.state + ')');
  /* the defect, reproduced through the ledger rule: the same record hand-
     dated on the clock bar is NOT settled by the same bar */
  const ctx2 = boot(CLOCK);
  ctx2.hgFwdRecordScan('SEARCH-REPORT', '4h', [{ sym: 'BTCUSD', dir: 'long', entry: rep.plan.entry, stop: rep.plan.stop, t1: rep.plan.t1,
    mark: last.c, mechanic: 'FORMED-TICKET', ticket: false }], { horizonBars: 20 });
  const r2 = ctx2.hgFwdRecords('SEARCH-REPORT')[0];
  ok(r2.barT === clockBar, 'a record handed no bar is dated on the clock bar (the pre-hg-v986 shape)');
  ok(ctx2.hgFwdResolve('BTCUSD', '4h', r4.concat([hit])) === 0, 'and the T1 bar that closed before the clock cannot settle it — the first bars of the trade were invisible');
}

console.log('\n3. dedup follows the signal bar: the same closed bar is one record however many clock bars it spans');
{
  const ctx = boot(CLOCK);
  const r4 = gen(260, 50000, clockSec, 3);
  const rep = runReport(ctx, r4, { fundingPct: 0.01 });
  ok(ctx.hgContractReportRecord(rep) === 1, 'first press records');
  ctx.__clock.now = CLOCK + 2 * SEC4H * 1000;               /* two clock bars later, no new 4h bar closed */
  ok(ctx.hgContractReportRecord(rep) === 0, 'the same plan pressed two clock bars later records nothing');
  ok(ctx.hgFwdRecords('SEARCH-REPORT').length === 1, 'one record');
  /* a new closed bar is a new signal bar */
  const r5 = r4.concat([{ t: r4[r4.length - 1].t + SEC4H, o: r4[r4.length - 1].c, h: r4[r4.length - 1].c * 1.003, l: r4[r4.length - 1].c * 0.997, c: r4[r4.length - 1].c * 1.001, v: 1000 }]);
  const rep2 = runReport(ctx, r5, { fundingPct: 0.01 });
  ok(rep2.plan.ok, 'the plan still forms one bar on');
  ok(ctx.hgContractReportRecord(rep2) === 1, 'the next closed bar is a new record');
}

console.log('\n4. the funding is a number or nothing — never a coerced zero');
{
  const cases = [
    [{ fundingPct: null }, undefined, 'null'],
    [{ fundingPct: '0.01' }, undefined, 'a string'],
    [{ fundingPct: NaN }, undefined, 'NaN'],
    [{}, undefined, 'absent'],
    [{ fundingPct: 0 }, 0, 'exactly zero (a READ zero)'],
    [{ fundingPct: -0.02 }, -0.02, 'a negative rate'],
  ];
  for (const [tk, want, label] of cases){
    const ctx = boot(CLOCK);
    const rep = runReport(ctx, gen(260, 50000, clockSec, 3), tk);
    ok(rep.plan.fundingPct === want, 'plan funding for ' + label + ' reads ' + String(want));
    ctx.hgContractReportRecord(rep);
    const r = ctx.hgFwdRecords('SEARCH-REPORT')[0];
    ok(r && r.fundingPct === want, 'record funding for ' + label + ' reads ' + String(want));
    if (want === undefined) ok(r.fundAgainst === undefined, 'and the verdict is NOT RECORDED for ' + label);
  }
  /* the rule bites where it should: a long against +0.05% is AGAINST */
  const ctx = boot(CLOCK);
  const rep = runReport(ctx, gen(260, 50000, clockSec, 3), { fundingPct: 0.05 });
  ctx.hgContractReportRecord(rep);
  ok(ctx.hgFwdRecords('SEARCH-REPORT')[0].fundAgainst === true, 'a long recorded at +0.05% reads AGAINST through the shared rule');
}

console.log('\n5. an unreadable bar time falls back to the clock exactly as before');
{
  const ctx = boot(CLOCK);
  const r4 = gen(260, 50000, clockSec, 3).map(r => { const o = Object.assign({}, r); delete o.t; return o; });
  const rep = runReport(ctx, r4, { fundingPct: 0.01 });
  ok(rep.plan.ok, 'the plan forms without bar times');
  ok(rep.plan.barT === null, 'planFrom stamps no bar when the rows carry none');
  ctx.hgContractReportRecord(rep);
  const r = ctx.hgFwdRecords('SEARCH-REPORT')[0];
  ok(r && r.barT === clockBar, 'the record is dated on the clock bar, the ledger\'s own fallback');
  const ctx2 = boot(CLOCK);
  const r0 = gen(260, 50000, clockSec, 3).map(r => Object.assign({}, r, { t: 0 }));
  const rep0 = runReport(ctx2, r0, {});
  ok(rep0.plan.barT === null, 'a bar time of 0 is not a bar (+null is 0 — the epoch is not a read)');
}

console.log('\n6. the record forwards what the plan stamped (textual, and says so)');
{
  const src = read('contract-report.js');
  const rec = src.slice(src.indexOf('function hgContractReportRecord'), src.indexOf('function hgContractReportRecord') + 1800);
  ok(/barT: \(isFinite\(fin\(p\.barT\)\) && fin\(p\.barT\) > 0\) \? fin\(p\.barT\) : undefined,/.test(rec), 'the record forwards planFrom\'s bar');
  ok(/fundingPct: \(typeof p\.fundingPct === 'number' && isFinite\(p\.fundingPct\)\) \? p\.fundingPct : undefined,/.test(rec), 'the record forwards the plan\'s funding, number-only');
  const pf = src.slice(src.indexOf('function planFrom('), src.indexOf('function planFrom(') + 3000);
  ok(/var barT = fin\(last && last\.t\);\s*out\.barT = \(isFinite\(barT\) && barT > 0\) \? barT : null;/.test(pf), 'planFrom reads the bar off the LAST row in hand, not the clock');
  ok(!/Date\.now\(\)/.test(pf), 'planFrom reads no clock');
  ok(/out\.fundingPct = \(ticker && typeof ticker\.fundingPct === 'number' && isFinite\(ticker\.fundingPct\)\) \? ticker\.fundingPct : undefined;/.test(pf), 'planFrom reads the ticker funding as a number or nothing');
  ok(/since hg-v986 the bar the plan was composed\s+on/.test(src), 'the dedup note says which bar dedups now');
}

console.log('\n7. version stamps');
{
  const stamp = read('build-stamp.js');
  const v = (stamp.match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v), 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed');
