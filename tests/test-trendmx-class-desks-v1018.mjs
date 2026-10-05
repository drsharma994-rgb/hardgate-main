/* HARDGATE — hg-v1018: THE CLASS DESKS. The TREND MATRIX limit board painted
   two different formation CLASSES in one mixed bag — 7/7 gate-clean rows and
   composite-conviction rows — ranked against each other (the clean7
   1000-bonus made the order a class order, not a quality one), while the
   forward log already recorded them under different mechanics (TM-CLEAN7 /
   TM-CONVICTION) precisely because they are different claims.

   They stand on their own now: trendmxLimitClasses collects the two bags
   (the bars per row are exactly the old board's — gate veto, majority, valid
   plan, clean7-or-conviction, the hg-v1012 taker-flow hold-off, counted per
   class), records ONE forward log over both bags before either desk slices,
   and the two desks render through the shared renderer with their own
   criteria in the header and a class stamp on each card. The GATE-CLEAN desk
   keeps the old intra-class order (|composite|, then gates passed); the
   CONVICTION desk orders on its own claim — composite, the ADX strength
   indicator breaking ties. Each desk caps at 4 cards — two desks x 4 = the
   old board's 8: presentation, not exposure.

   Covers:
     1) the classes separate on their own criteria
     2) the per-class ordering (gates for one, ADX for the other)
     3) one forward record over BOTH classes, before either slice
     4) the caps: 4 + 4 = the old 8
     5) each desk renders only its own class, criteria named, cards stamped
     6) the hold-off is counted and named per desk
     7) the paint routing fills both containers; the venue filter applies
        upstream of both
     8) the mixed board is gone; the desks stand in order
   Run: node tests/test-trendmx-class-desks-v1018.mjs */

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
    catch(e){ /* reported below */ }
  }
  return ctx;
}

/* fixtures (the v1012 shapes, t in SECONDS) */
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
const UP1 = tape(260, 86400, 100, 1), UP4 = tape(120, 14400, 100, 0.6);
const DN1 = tape(260, 86400, 400, -1), DN4 = tape(120, 14400, 400, -0.6);

function mkRow(w, sym, dirn, opts){
  const up = dirn === 'long';
  const r1 = up ? UP1 : DN1, r4 = up ? UP4 : DN4;
  const ts = w.trendScore(r1, r4);
  return Object.assign({
    sym: sym, base: sym.replace(/USDT$/, ''), exchange: 'binance',
    score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
    price: r1[r1.length - 1].c, rows4h: r4, rows1h: r4.slice(-60),
    fundingPct: 0.01,
    gate: { gatesPassed: 5, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: '5/7', veto: null }
  }, opts || {});
}
function gate7(){ return { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null }; }

console.log('== 1) the classes separate on their own criteria ==');
{
  const w = boot();
  const clean = mkRow(w, 'CLCUSDT', 'long', { gate: gate7() });
  const conv = mkRow(w, 'CNVUSDT', 'short');   /* 5/7 gate, score -5 -> STRONG conviction */
  const out = w.trendmxLimitClasses([clean, conv]);
  assert(out.clean.length === 1 && out.clean[0].row.sym === 'CLCUSDT',
         'a 7/7 gate-clean row is collected into the GATE-CLEAN class');
  assert(out.conv.length === 1 && out.conv[0].row.sym === 'CNVUSDT' && out.conv[0].dir === 'short',
         'a composite-conviction row (no clean7) is collected into the CONVICTION class, short side intact');
  assert(out.clean[0].conv === undefined && typeof out.conv[0].conv === 'object',
         'the conviction item carries its conviction verdict; the clean item does not pretend one');
  /* every exclusion the old board had, per row */
  const vetoed = mkRow(w, 'VETUSDT', 'long', { gate: { gatesPassed: 7, gatesTotal: 7, clean7: true, veto: 'regime', label: 'regime veto' } });
  const noDir = mkRow(w, 'NODUSDT', 'long', { score: 0, gate: gate7() });
  const noPlan = mkRow(w, 'NPLUSDT', 'long', { rows4h: [], gate: gate7() });
  const noGate = mkRow(w, 'NGTUSDT', 'long', { gate: null });
  const weak = mkRow(w, 'WEKUSDT', 'long', { score: 1 });   /* majority bar is |2| — no dir either */
  const out2 = w.trendmxLimitClasses([vetoed, noDir, noPlan, noGate, weak]);
  assert(out2.clean.length === 0 && out2.conv.length === 0 && out2.heldClean === 0 && out2.heldConv === 0,
         'veto / no-majority / no-plan / no-gate / sub-majority rows qualify for NEITHER class — the old board\'s bars, per row');
  /* a clean7 row with conviction-level score is ONLY in the clean class */
  const both = mkRow(w, 'BTHUSDT', 'long', { gate: gate7() });
  const out3 = w.trendmxLimitClasses([both]);
  assert(out3.clean.length === 1 && out3.conv.length === 0,
         'a 7/7 row with a strong composite lives in exactly ONE class — no double-painting');
}

console.log('== 2) the per-class ordering: gates for one, ADX for the other ==');
{
  const w = boot();
  /* gate-clean: |composite| then gates passed — the old intra-class rank */
  const hi = mkRow(w, 'HICUSDT', 'long', { gate: gate7() });                       /* |5| */
  const lo = mkRow(w, 'LOCUSDT', 'long', { score: 3, gate: gate7() });             /* |3| */
  const outC = w.trendmxLimitClasses([lo, hi]);
  assert(outC.clean.length === 2 && outC.clean[0].row.sym === 'HICUSDT',
         'GATE-CLEAN desk: the stronger composite leads (the old board\'s intra-class order, unchanged)');
  /* conviction: |composite| tied -> the ADX strength indicator breaks the tie */
  const hiA = mkRow(w, 'HIAUSDT', 'long', { adx: 38 });
  const loA = mkRow(w, 'LOAUSDT', 'long', { adx: 26 });
  const noA = mkRow(w, 'NOAUSDT', 'long', { adx: NaN });
  const outV = w.trendmxLimitClasses([loA, noA, hiA]);
  assert(outV.conv.length === 3 && outV.conv[0].row.sym === 'HIAUSDT' && outV.conv[1].row.sym === 'LOAUSDT',
         'CONVICTION desk: equal composites order by ADX strength (38 > 26), an unreadable ADX ties at zero');
  assert(Math.abs(outV.conv[0].rank - (50 + 3.8)) < 1e-9 && Math.abs(outV.conv[2].rank - 50) < 1e-9,
         'the rank is |composite| x10 + ADX/10 — the strength read orders the strength class');
}

console.log('== 3) one forward record over BOTH classes, before either slice ==');
{
  const w = boot();
  let rec = null;
  w.hgFwdRecordScan = (tab, tf, list, opts) => { rec = { tab, tf, list, opts }; return list.length; };
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push(mkRow(w, 'CL' + i + 'USDT', 'long', { gate: gate7() }));
  for (let j = 0; j < 5; j++) rows.push(mkRow(w, 'CV' + j + 'USDT', 'short'));
  const out = w.trendmxLimitClasses(rows);
  assert(out.clean.length === 5 && out.conv.length === 5, 'ten qualifying rows collected (5 + 5)');
  assert(rec && rec.tab === 'TRENDMX' && rec.tf === '4h' && rec.list.length === 10,
         'ALL TEN record — the measurement covers every setup the desk judged tradeable, not the eight it has room to show');
  const mech = rec.list.map(r => r.mechanic).sort();
  assert(mech.filter(m => m === 'TM-CLEAN7').length === 5 && mech.filter(m => m === 'TM-CONVICTION').length === 5,
         'the mechanics split is byte-identical to the mixed board\'s');
  assert(rec.opts && rec.opts.horizonBars === 20, 'horizon unchanged');
  assert(rec.list.every(r => r.entry && r.stop && r.t1), 'every record carries the levels the card paints');
}

console.log('== 4) the caps: 4 + 4 = the old 8 ==');
{
  const w = boot();
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push(mkRow(w, 'CL' + i + 'USDT', 'long', { gate: gate7() }));
  for (let j = 0; j < 5; j++) rows.push(mkRow(w, 'CV' + j + 'USDT', 'short'));
  const out = w.trendmxLimitClasses(rows);
  const gc = w.trendmxGateCleanDeskHTML(out.clean, out.heldClean);
  const cv = w.trendmxConvictionDeskHTML(out.conv, out.heldConv);
  const gcCards = (gc.match(/GATE-CLEAN 7\/7/g) || []).length;
  const cvCards = (cv.match(/CONVICTION [+-]/g) || []).length;
  assert(gcCards === 4 && cvCards === 4,
         'each desk caps at 4 cards (' + gcCards + ' + ' + cvCards + ') — two desks x 4 = the old board\'s 8, presentation not exposure');
}

console.log('== 5) each desk renders only its own class, criteria named, cards stamped ==');
{
  const w = boot();
  const clean = mkRow(w, 'CLCUSDT', 'long', { gate: gate7() });
  const conv = mkRow(w, 'CNVUSDT', 'short');
  const out = w.trendmxLimitClasses([clean, conv]);
  const gc = w.trendmxGateCleanDeskHTML(out.clean, out.heldClean);
  const cv = w.trendmxConvictionDeskHTML(out.conv, out.heldConv);
  assert(text(gc).indexOf('CLCUSDT') >= 0 && text(gc).indexOf('CNVUSDT') < 0,
         'the GATE-CLEAN desk paints only gate-clean rows');
  assert(text(cv).indexOf('CNVUSDT') >= 0 && text(cv).indexOf('CLCUSDT') < 0,
         'the CONVICTION desk paints only conviction rows');
  assert(/LIMIT BOARD · GATE-CLEAN DESK/.test(gc) && /7\/7 swing-gate matrix/.test(gc),
         'the gate-clean header names its formation criteria (the gate matrix\'s indicators)');
  assert(/LIMIT BOARD · CONVICTION DESK/.test(cv) && /ADX strength/.test(cv) && /Ichimoku cloud/.test(cv),
         'the conviction header names its five-leg composite criteria');
  assert(/GATE-CLEAN 7\/7/.test(gc) && /CONVICTION -5\/5/.test(cv),
         'each card carries its own class stamp (the short\'s stamp reads -5/5)');
  /* empty bag, nothing held: renders nothing (the hg-v1015 rule) */
  assert(w.trendmxGateCleanDeskHTML([], 0) === '' && w.trendmxConvictionDeskHTML(null, 0) === '',
         'a desk with zero qualifying rows renders nothing — never an empty frame');
}

console.log('== 6) the hold-off is counted and named per desk ==');
{
  const w = boot();
  const heldClean = mkRow(w, 'HCLUSDT', 'long', { gate: gate7(), flow: { verdict: 'against' } });
  const heldConv = mkRow(w, 'HCVUSDT', 'short', { flow: { verdict: 'against' } });
  const okClean = mkRow(w, 'OKCUSDT', 'long', { gate: gate7(), flow: { verdict: 'with' } });
  const out = w.trendmxLimitClasses([heldClean, heldConv, okClean]);
  assert(out.heldClean === 1 && out.heldConv === 1 && out.clean.length === 1,
         'flow-AGAINST holds each row off ITS OWN class; flow-WITH paints');
  const gc = w.trendmxGateCleanDeskHTML(out.clean, out.heldClean);
  const cv = w.trendmxConvictionDeskHTML(out.conv, out.heldConv);
  assert(/1 held off — taker flow against/.test(gc) && text(gc).indexOf('OKCUSDT') >= 0,
         'the gate-clean desk names ITS held-off row beside its card');
  assert(/1 qualified row held off/.test(text(cv)) && text(cv).indexOf('HCLUSDT') < 0,
         'the conviction desk names only ITS OWN hold-off (the other class\'s held row is not its story)');
  const cvOnly = w.trendmxConvictionDeskHTML([], 1);
  assert(/1 qualified row held off/.test(text(cvOnly)) && /taker flow/.test(text(cvOnly)),
         'an empty desk with a held-off row renders the VERDICT, not a blank');
}

console.log('== 7) the paint routing fills both containers; the venue filter applies upstream ==');
{
  const w = boot();
  const dClean = mkRow(w, 'DLCUSDT', 'long', { gate: gate7(), exchange: 'delta' });
  const bConv = mkRow(w, 'BNVUSDT', 'short');   /* binance */
  const refs = { summary: {}, gateclean: {}, conviction: {} };
  w.trendmxPaintDeskSections(refs, { rows: [dClean, bConv], golden: [], death: [], venue: 'ALL', venueCounts: null });
  assert(text(refs.gateclean.innerHTML).indexOf('DLCUSDT') >= 0 && text(refs.conviction.innerHTML).indexOf('BNVUSDT') >= 0,
         'the routing fills each container with its own class');
  const refs2 = { summary: {}, gateclean: {}, conviction: {} };
  w.trendmxPaintDeskSections(refs2, { rows: [dClean, bConv], golden: [], death: [], venue: 'delta', venueCounts: null });
  assert(text(refs2.gateclean.innerHTML).indexOf('DLCUSDT') >= 0 && !refs2.conviction.innerHTML,
         'the venue filter applies upstream of both desks — the binance conviction row leaves on DELTA');
  /* no containers, no collection — the restore guard holds */
  const refs3 = { summary: {} };
  w.trendmxPaintDeskSections(refs3, { rows: [dClean], golden: [], death: [], venue: 'ALL', venueCounts: null });
  assert(true, 'absent containers skip the collection without a throw');
}

console.log('== 8) the mixed board is gone; the desks stand in order ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  assert(typeof boot().trendmxLimitBoardHTML === 'undefined' && !/function trendmxLimitBoardHTML/.test(src),
         'trendmxLimitBoardHTML is GONE — the mixed bag does not come back silently');
  assert(!/data-r="limit"/.test(src), 'the old container is gone from the mount skeleton');
  assert(src.indexOf('data-r="gateclean"') >= 0 && src.indexOf('data-r="conviction"') >= 0,
         'both class containers exist');
  assert(src.indexOf('data-r="gateclean"') < src.indexOf('data-r="conviction"'),
         'the conviction desk stands right under the gate-clean desk');
  assert(/LIMIT BOARD · GATE-CLEAN DESK/.test(src) && /LIMIT BOARD · CONVICTION DESK/.test(src),
         'both desk titles carry LIMIT BOARD — the standing wiring pins keep their meaning');
  /* the composite, the gates and every bar are untouched by this pack */
  /* hg-v1018: the pin names the OLD board's exact slice — cands.slice(0, 8) —
     not any cands.slice: the flow scan's own cap (cands.slice(0, TM_FLOW_MAX),
     L867) is a different feature this pack never touched. */
  assert(/var TM_MAJORITY = 2;/.test(src) && /cands = cands\.slice\(0, 8\)/.test(src) === false,
         'no threshold moved — the majority bar is still |2|, and the old top-8 slice is gone with the mixed board');
}

console.log('\n' + (fail === 0
  ? 'ALL TRENDMX CLASS-DESK TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
