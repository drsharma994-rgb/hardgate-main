/* HARDGATE — hg-v1012: TRENDMX EVIDENCE LAYER.

   The composite's five components are five reads of the same closes — five
   ways to agree with yourself. This layer adds the read that cannot be
   derived from those closes: which side is AGGRESSING the tape. One capped,
   paced pass per scan reads REAL Binance taker long/short flow
   (binanceTakerRatio on the row's hgDeskBinanceSym twin, 4h × 120 windows)
   through omniroute.js's hgOmniCvd over the last 30 windows. Flow AGAINST
   the row's own majority holds the row off the LIMIT BOARD and caps it at
   NEAR (it paints, the chip names why); flow WITH chips; anything
   unreadable demotes nothing (the hg-v1009 independence rule: the
   candle-approximated stand-in derives from the same closes, so it never
   speaks here). The forward record now carries fundingPct (hg-v985's
   hand-in-what-you-hold) and the takerFlowWith read-mark (hg-v989's seam).
   FUNDING CROWDING rides beside it: the fundingPct the universe already
   carried, read through the ONE house rule (hg-setup-core.js
   hgFundingAgainstMark), a caution chip, never a gate.

   Harness: classic scripts in a vm context (the v1011 route). hgOmniCvd and
   hgFundingAgainstMark are the REAL primitives; every number below was
   derived by probing them on these exact fixtures, never asserted blind:
     30 windows of ratio 0.8  -> delta -3.33, source 'taker', divergence
                                 'bear' on an uptrend tape (price up into
                                 net selling)
     30 windows of ratio 1.25 -> delta +3.33, no divergence
     ratio 1.0                -> delta 0 -> UNREAD (a zero delta says nothing)
     ratio 0                  -> hgOmniCvd falls to source 'candles' -> refused
     6 windows of 0.8         -> source 'taker' but bars 6 < TM_FLOW_MIN_WIN
                                 (10, hg-v1009's floor) -> UNREAD

   Run: node tests/test-trendmx-evidence-v1012.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js', 'omniroute.js', 'trendtable.js'];
function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of (files || FILES))
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

/* ---------------- fixtures (t in SECONDS, the desk's own unit) ---------------- */
const T0 = 1750000000;
function tape(n, tfSec, start, step){
  const rows = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c; c = c + step;
    rows.push({ t: T0 - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + Math.abs(step) * 0.5,
                l: Math.min(o, c) - Math.abs(step) * 0.5, c, v: 1000 });
  }
  return rows;
}
function taker(ratio, n){
  const s = [];
  for (let k = n - 1; k >= 0; k--) s.push({ buySellRatio: ratio, t: T0 - k * 14400 });
  return { latest: s[s.length - 1], series: s };
}
const UP1 = tape(260, 86400, 100, 1), UP4 = tape(120, 14400, 100, 0.6);
const DN1 = tape(260, 86400, 400, -1), DN4 = tape(120, 14400, 400, -0.6);
const SELL = taker(0.8, 120), BUY = taker(1.25, 120), FLAT = taker(1.0, 120),
      JUNK = taker(0, 120), THIN = taker(0.8, 6);

let W = boot();
const TS_UP = W.trendScore(UP1, UP4), TS_DN = W.trendScore(DN1, DN4);
ok(TS_UP.score === 5 && TS_DN.score === -5, 'fixtures score ±5 on the real trendScore (probed)');

function mkRow(sym, dirn, opts){
  const up = dirn === 'long';
  const r1 = up ? UP1 : DN1, r4 = up ? UP4 : DN4, ts = up ? TS_UP : TS_DN;
  return Object.assign({
    sym: sym, base: sym.replace(/USDT$/, ''), exchange: 'binance',
    score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
    price: r1[r1.length - 1].c, rows4h: r4, rows1h: r4.slice(-60),
    fundingPct: 0.01,
    gate: { gatesPassed: 5, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: '5/7', veto: null }
  }, opts || {});
}
function gate7(){ return { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null }; }

console.log('== the seams ==');
{
  ok(typeof W.trendmxFlowScan === 'function', 'trendmxFlowScan exported');
  ok(typeof W.trendmxFlowChipHtml === 'function', 'trendmxFlowChipHtml exported');
  ok(typeof W.trendmxFundingChipHtml === 'function', 'trendmxFundingChipHtml exported');
  ok(typeof W.trendmxRowTier === 'function', 'trendmxRowTier exported (the tier the cap lives in)');
  /* hg-v1018: the mixed LIMIT BOARD split into the two class desks — the
     hold-off lives in the collector + the per-desk renderers now */
  ok(typeof W.trendmxLimitClasses === 'function', 'trendmxLimitClasses exported (the collector the hold-off lives in, hg-v1018)');
  ok(typeof W.trendmxGateCleanDeskHTML === 'function' && typeof W.trendmxConvictionDeskHTML === 'function',
     'both class desks exported (hg-v1018)');
  ok(typeof W.trendmxSummaryLine === 'function', 'trendmxSummaryLine exported');
}

console.log('== the read — real flow, probed numbers ==');
{
  const w = boot();
  const calls = [];
  w.binanceTakerRatio = async (sym, period, limit) => { calls.push(sym + '|' + period + '|' + limit); return SELL; };
  /* the promoted slice is the SMC pass's own: clean7 OR conviction. The
     flow pass mirrors that slice exactly, never widens it. (Pre-hg-v1013
     trendmxConviction read the long side only, so this short carries a
     clean7 gate; since v1013 a -5 score is conviction on its own — the
     v1013 test pins that.) */
  const rowL = mkRow('AAAUSDT', 'long'), rowS = mkRow('BBBUSDT', 'short', { gate: gate7() });
  const res = await w.trendmxFlowScan([rowL, rowS]);
  ok(res.read === 'taker' && res.scanned === 2, 'pass reads the promoted slice, read=taker');
  ok(res.against === 1 && res.with === 1 && res.unreadable === 0, 'one against (long into selling), one with (short into selling)');
  ok(rowL.flow && rowL.flow.verdict === 'against' && rowL.flow.delta === -3.33 && rowL.flow.bars === 30,
     'long row: against, delta -3.33 over 30 windows (probed)');
  ok(rowL.flow.divergence === 'bear', 'long row: bear divergence — price up into net selling (probed)');
  ok(rowS.flow && rowS.flow.verdict === 'with' && rowS.flow.delta === -3.33, 'short row: with, same delta');
  ok(calls.length === 2 && calls[0].indexOf('|4h|120') > 0, 'one taker fetch per promoted row, 4h x 120');
  ok(calls[0].indexOf('AAAUSDT|') === 0 || calls[1].indexOf('AAAUSDT|') === 0, 'fetched on the hgDeskBinanceSym twin');
  ok(text(w.trendmxFlowChipHtml(rowL)).indexOf('TAKER FLOW AGAINST') >= 0, 'AGAINST chip paints');
  ok(text(w.trendmxFlowChipHtml(rowS)).indexOf('TAKER FLOW WITH IT') >= 0, 'WITH chip paints');
}

console.log('== the demote — held off, never CLEAN, never recorded ==');
{
  const w = boot();
  w.binanceTakerRatio = async () => SELL;
  const row = mkRow('AAAUSDT', 'long', { gate: gate7() });
  await w.trendmxFlowScan([row]);
  ok(row.flow.verdict === 'against', 'stamped against');
  const plan = w.trendmxPlan(Object.assign({}, row, { dir: 'long' }));
  ok(plan && w.trendmxRowTier(row, plan) === 'near', 'a 7/7 CLEAN row with flow against caps at NEAR');
  let rec = 'unset';
  w.hgFwdRecordScan = (tab, tf, list, opts) => { rec = { tab, tf, list, opts }; return list.length; };
  /* hg-v1018: a held-off clean7 row belongs to the GATE-CLEAN desk */
  const clsHeld = w.trendmxLimitClasses([row]);
  const html = w.trendmxGateCleanDeskHTML(clsHeld.clean, clsHeld.heldClean);
  ok(rec === 'unset' || rec === null, 'no forward record when every qualified row is held off');
  ok(clsHeld.heldClean === 1 && clsHeld.clean.length === 0,
     'the held-off clean7 row is counted on its own class (hg-v1018)');
  ok(text(html).indexOf('held off') >= 0 && text(html).indexOf('taker flow') >= 0,
     'the empty desk names the hold-off — nothing dropped silently');
  const rowOk = mkRow('BBBUSDT', 'short', { gate: gate7() });
  await w.trendmxFlowScan([rowOk]);
  rec = null;
  const clsOk = w.trendmxLimitClasses([rowOk]);
  const html2 = w.trendmxGateCleanDeskHTML(clsOk.clean, clsOk.heldClean);
  ok(clsOk.clean.length === 1, 'the with-row lands in the gate-clean class (hg-v1018)');
  ok(text(html2).indexOf('TAKER FLOW WITH IT') >= 0, 'desk card carries the WITH chip');
  ok(rec && rec.tab === 'TRENDMX' && rec.tf === '4h' && rec.list.length === 1, 'the with-row records (TM-CLEAN7 mechanics untouched)');
  ok(rec.list[0].mechanic === 'TM-CLEAN7' && rec.list[0].ticket === true, 'mechanic string + ticket unchanged');
  ok(rec.list[0].fundingPct === 0.01, 'the record carries the fundingPct the row held (hg-v985)');
  ok(rec.list[0].reads && rec.list[0].reads.takerFlowWith === true, 'the record carries the takerFlowWith read-mark (hg-v989)');
  ok(rec.opts && rec.opts.horizonBars === 20, 'horizon unchanged');
}

console.log('== UNREAD demotes nothing (hg-v700) ==');
{
  const w = boot();
  const cases = {
    thin: () => { w.binanceTakerRatio = async () => THIN; },
    junk: () => { w.binanceTakerRatio = async () => JUNK; },
    flat: () => { w.binanceTakerRatio = async () => FLAT; },
    none: () => { w.binanceTakerRatio = async () => null; },
    fail: () => { w.binanceTakerRatio = async () => { throw new Error('net down'); }; }
  };
  for (const k of Object.keys(cases)){
    const row = mkRow('AAAUSDT', 'long', { gate: gate7() });
    cases[k]();
    const res = await w.trendmxFlowScan([row]);
    ok(res.unreadable === 1 && res.against === 0 && res.with === 0, k + ': unreadable, no verdict counts');
    ok(row.flow && row.flow.verdict === 'unreadable', k + ': stamped unreadable');
    const plan = w.trendmxPlan(Object.assign({}, row, { dir: 'long' }));
    ok(w.trendmxRowTier(row, plan) === 'clean', k + ': tier untouched — what cannot be read demotes nothing');
    let rec = null;
    w.hgFwdRecordScan = (tab, tf, list) => { rec = { list }; return list.length; };
    const clsU = w.trendmxLimitClasses([row]);   /* hg-v1018: collector records, desk renders */
    const html = w.trendmxGateCleanDeskHTML(clsU.clean, clsU.heldClean);
    ok(rec && rec.list.length === 1 && rec.list[0].reads === undefined, k + ': desk keeps the row, records no read-mark');
    ok(text(html).indexOf('TAKER FLOW UNREAD') >= 0, k + ': the UNREAD chip says the desk looked and could not read');
  }
  /* no Binance twin */
  const noTwin = mkRow('???', 'long', { base: null, exchange: 'delta', gate: gate7() });
  w.binanceTakerRatio = async () => BUY;
  const resN = await w.trendmxFlowScan([noTwin]);
  ok(resN.unreadable === 1 && noTwin.flow.why === 'no Binance twin', 'no Binance twin: unreadable, named why');
  /* a row outside the promoted slice is never judged */
  const idle = mkRow('ZZZUSDT', 'long', { score: 1, comps: TS_UP.comps, gate: null });
  let calls = 0;
  w.binanceTakerRatio = async () => { calls++; return BUY; };
  const resI = await w.trendmxFlowScan([idle]);
  ok(resI.read === 'unavailable' && calls === 0 && !idle.flow, 'unpromoted rows are never fetched, never stamped');
  ok(w.trendmxFlowChipHtml(idle) === '', 'no stamp, no chip — not the same as UNREAD');
}

console.log('== the cap — the promoted slice only, never the universe ==');
{
  const w = boot();
  let calls = 0;
  w.binanceTakerRatio = async () => { calls++; return SELL; };
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push(mkRow('C' + i + 'USDT', 'long', { gate: gate7() }));
  const res = await w.trendmxFlowScan(rows);
  ok(res.scanned === 24 && calls === 24, '30 promoted rows -> exactly TM_FLOW_MAX (24) fetched, the SMC pass’s own cap');
  ok(res.against === 24, 'all 24 stamped against (longs into selling)');
}

console.log('== funding crowding — the one rule, a chip, never a gate ==');
{
  const w = boot();
  const crowded = mkRow('AAAUSDT', 'long', { fundingPct: 0.12 });
  ok(text(w.trendmxFundingChipHtml(crowded)).indexOf('FUNDING CROWDED') >= 0, 'funding +0.12 on a long chips FUNDING CROWDED (real hgFundingAgainstMark)');
  const calm = mkRow('AAAUSDT', 'long', { fundingPct: 0.01 });
  ok(w.trendmxFundingChipHtml(calm) === '', 'funding +0.01 on a long: no chip');
  const contra = mkRow('AAAUSDT', 'long', { fundingPct: -0.12 });
  ok(w.trendmxFundingChipHtml(contra) === '', 'funding -0.12 on a long leans the OTHER way: no chip');
  const crowdedShort = mkRow('AAAUSDT', 'short', { fundingPct: -0.12 });
  ok(text(w.trendmxFundingChipHtml(crowdedShort)).indexOf('FUNDING CROWDED') >= 0, 'funding -0.12 on a short chips (mirrored)');
  const noFund = mkRow('AAAUSDT', 'long', { fundingPct: undefined });
  ok(w.trendmxFundingChipHtml(noFund) === '', 'no funding: no chip, never a throw');
  const plan = w.trendmxPlan(Object.assign({}, crowded, { dir: 'long' }));
  ok(w.trendmxRowTier(crowded, plan) !== 'near' || !crowded.flow, 'the funding chip never touches the tier');
}

console.log('== the summary names the split ==');
{
  const w = boot();
  w.binanceTakerRatio = async (sym) => (sym === 'AAAUSDT' ? BUY : SELL);
  const a = mkRow('AAAUSDT', 'long'), b = mkRow('BBBUSDT', 'long');
  await w.trendmxFlowScan([a, b]);
  const line = w.trendmxSummaryLine([a, b], []);
  ok(line.indexOf('taker flow 1 with / 1 held off') >= 0, 'summary line: "taker flow 1 with / 1 held off"');
  ok(line.indexOf('NEAR 1') >= 0, 'the held-off row counts in NEAR, not CLEAN');
}

console.log('== honest degradation (hg-v700) ==');
{
  const bare = boot(['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js', 'trendtable.js']);
  const row = mkRow('AAAUSDT', 'long', { gate: gate7() });
  const res = await bare.trendmxFlowScan([row]);
  ok(res.read === 'unavailable' && res.scanned === 0 && !row.flow, 'no hgOmniCvd / no binanceTakerRatio: unavailable, rows untouched');
  const res2 = await bare.trendmxFlowScan(null);
  ok(res2 && res2.read === 'unavailable', 'null rows: never throws');
  const w2 = boot();
  w2.hgDeskBinanceSym = undefined;
  const row2 = mkRow('AAAUSDT', 'long');
  const res3 = await w2.trendmxFlowScan([row2]);
  ok(res3.read === 'unavailable', 'no symbol map: unavailable, nothing fetched');
}

console.log('\nPASS — ' + passed + ' assertions');
