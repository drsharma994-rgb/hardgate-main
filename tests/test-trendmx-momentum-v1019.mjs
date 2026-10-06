/* HARDGATE — hg-v1019: THE MOMENTUM WITNESS (TREND MATRIX side). The
   composite's five legs are all SLOW trend/strength reads of the same
   closes (1D EMA200, EMA50/200 cross, 4H cascade, Ichimoku, ADX) — the desk
   carried no momentum oscillator at all. Trend legs lag: a row keeps a
   ±3 composite while the momentum regime has already turned.

   The witness is the canonical RSI range read (Cardwell/Constance Brown):
   a bull momentum range holds RSI(14) above 40, a bear range caps it under
   60. A LONG row whose 1D RSI broke under 40 / a SHORT row whose RSI broke
   over 60 is a slow composite fighting a turned regime: held off both limit
   desks (counted and named per class, beside the hg-v1012 flow hold-off),
   capped at NEAR in the matrix, chip naming why. RSI on the regime side of
   the 50 midline chips MOMENTUM WITH IT and hands the forward log a momWith
   read-mark. The 40–50 / 50–60 abstain zone (a pullback inside an INTACT
   regime) and every unreadable read stay silent. The composite is NOT
   touched — rsi is evidence, never a sixth leg (the hg-v1012 rule).

   Covers:
     1) trendScore carries the witness — composite byte-unchanged
     2) the bands: against / with / flat / unread, both directions
     3) the collector: held per class, counted AND reason-split
     4) the tier: momentum-against caps at NEAR even with a 7/7 gate
     5) the chips name the verdict; the abstain states stay silent
     6) the forward log: momWith rides the reads seam, held rows never record
     7) the desk verdicts name each witness that fired (legacy text intact)
     8) the source says what shipped; no threshold moved
   Run: node tests/test-trendmx-momentum-v1019.mjs */

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

/* fixtures (the v1012/v1018 shapes, t in SECONDS) */
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
    score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx, rsi: ts.rsi,
    price: r1[r1.length - 1].c, rows4h: r4, rows1h: r4.slice(-60),
    fundingPct: 0.01,
    gate: { gatesPassed: 5, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: '5/7', veto: null }
  }, opts || {});
}
function gate7(){ return { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null }; }

console.log('== 1) trendScore carries the witness — the composite is byte-unchanged ==');
{
  const w = boot();
  const up = w.trendScore(UP1, UP4), dn = w.trendScore(DN1, DN4);
  assert(typeof up.rsi === 'number' && isFinite(up.rsi) && up.rsi > 99,
         'a rising 1D tape stamps a high RSI (' + up.rsi.toFixed(1) + ')');
  assert(typeof dn.rsi === 'number' && isFinite(dn.rsi) && dn.rsi < 1,
         'a falling 1D tape stamps a floor RSI (' + dn.rsi.toFixed(1) + ')');
  assert(up.score === up.comps.d1Trend + up.comps.d1Cross + up.comps.h4Cascade + up.comps.cloud + up.comps.adxPt
      && dn.score === dn.comps.d1Trend + dn.comps.d1Cross + dn.comps.h4Cascade + dn.comps.cloud + dn.comps.adxPt,
         'the score is still exactly the five legs — the witness is NOT a composite point');
  const short = w.trendScore(UP1.slice(-10), UP4);
  assert(short.rsi !== short.rsi || !isFinite(short.rsi),
         'a tape too short for RSI(14) stamps NaN — the unreadable third state');
  const src = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  const sumLine = src.match(/out\.score = out\.comps[^;]+;/);
  assert(sumLine && !/rsi/i.test(sumLine[0]),
         'the score sum in the source names no rsi — the re-scale the ledger cannot absorb never happened');
}

console.log('== 2) the bands: against / with / flat / unread, both directions ==');
{
  const w = boot();
  /* long side: < 40 against, 40–50 flat (the intact-regime pullback zone), >= 50 with */
  assert(w.trendmxMomState({ rsi: 35 }, 'long') === 'against'
      && w.trendmxMomState({ rsi: 39.99 }, 'long') === 'against',
         'a long under the 40 bull-range floor is AGAINST (strict below)');
  assert(w.trendmxMomState({ rsi: 40 }, 'long') === 'flat' && w.trendmxMomState({ rsi: 49.9 }, 'long') === 'flat',
         'RSI 40–50 against a long is the pullback zone inside an intact regime — the witness abstains');
  assert(w.trendmxMomState({ rsi: 50 }, 'long') === 'with' && w.trendmxMomState({ rsi: 84 }, 'long') === 'with',
         'a long at or over the 50 midline is WITH');
  /* short side, mirrored */
  assert(w.trendmxMomState({ rsi: 65 }, 'short') === 'against'
      && w.trendmxMomState({ rsi: 60.01 }, 'short') === 'against',
         'a short over the 60 bear-range ceiling is AGAINST (strict above)');
  assert(w.trendmxMomState({ rsi: 60 }, 'short') === 'flat' && w.trendmxMomState({ rsi: 50.1 }, 'short') === 'flat',
         'RSI 50–60 against a short abstains the same way');
  assert(w.trendmxMomState({ rsi: 50 }, 'short') === 'with' && w.trendmxMomState({ rsi: 16 }, 'short') === 'with',
         'a short at or under the midline is WITH');
  /* the unreadable and the directionless never speak */
  assert(w.trendmxMomState({ rsi: NaN }, 'long') === null && w.trendmxMomState({}, 'short') === null
      && w.trendmxMomState(null, 'long') === null,
         'no readable RSI -> null: what cannot speak holds nothing off');
  assert(w.trendmxMomState({ rsi: 30 }, null) === null && w.trendmxMomState({ rsi: 30 }, 'sideways') === null,
         'no majority direction -> no verdict either');
}

console.log('== 3) the collector: held per class, counted AND reason-split ==');
{
  const w = boot();
  /* the defect scenario: a stale composite long whose momentum range has turned */
  const heldM = mkRow(w, 'HLDUSDT', 'long', { gate: gate7(), rsi: 32 });
  const okM = mkRow(w, 'OKMUSDT', 'long', { gate: gate7() });          /* UP tape: rsi ~100 -> with */
  const flatM = mkRow(w, 'FLTUSDT', 'long', { gate: gate7(), rsi: 45 });
  const unrM = mkRow(w, 'UNRUSDT', 'long', { gate: gate7(), rsi: NaN });
  const heldConv = mkRow(w, 'HCVUSDT', 'short', { rsi: 68 });          /* conviction short, range turned up */
  const out = w.trendmxLimitClasses([heldM, okM, flatM, unrM, heldConv]);
  assert(out.clean.length === 3 && out.heldClean === 1 && out.heldWhy.clean.mom === 1 && out.heldWhy.clean.flow === 0,
         'the momentum-AGAINST clean row is held off ITS desk; WITH, FLAT and UNREAD all paint');
  assert(out.conv.length === 0 && out.heldConv === 1 && out.heldWhy.conv.mom === 1,
         'the momentum-AGAINST conviction row is held off ITS OWN class');
  assert(out.clean.every(c => c.row.sym !== 'HLDUSDT'),
         'the held row is nowhere in the painted bag');
  /* flow and momentum reasons accrue independently on the same desk */
  const heldF = mkRow(w, 'HFLUSDT', 'long', { gate: gate7(), flow: { verdict: 'against' } });
  const out2 = w.trendmxLimitClasses([heldM, heldF]);
  assert(out2.heldClean === 2 && out2.heldWhy.clean.flow === 1 && out2.heldWhy.clean.mom === 1,
         'a flow-held row and a momentum-held row on one desk: total 2, reasons split 1 + 1');
}

console.log('== 4) the tier: momentum-against caps at NEAR even with a 7/7 gate ==');
{
  const w = boot();
  const turned = mkRow(w, 'TRNUSDT', 'long', { gate: gate7(), rsi: 31 });
  const planT = w.trendmxPlan(Object.assign({}, turned, { dir: 'long' }));
  assert(w.trendmxRowTier(turned, planT) === 'near',
         'a 7/7 CLEAN row with the momentum range turned caps at NEAR — never CLEAN, never the board');
  const backed = mkRow(w, 'BKDUSDT', 'long', { gate: gate7() });
  const planB = w.trendmxPlan(Object.assign({}, backed, { dir: 'long' }));
  assert(w.trendmxRowTier(backed, planB) === 'clean',
         'the same row WITH the momentum regime keeps its CLEAN tier — the witness only removes');
  const flat = mkRow(w, 'FLCUSDT', 'long', { gate: gate7(), rsi: 44 });
  const planF = w.trendmxPlan(Object.assign({}, flat, { dir: 'long' }));
  assert(w.trendmxRowTier(flat, planF) === 'clean',
         'and the abstain zone caps nothing either — a pullback in an intact regime is not a verdict');
}

console.log('== 5) the chips name the verdict; the abstain states stay silent ==');
{
  const w = boot();
  const against = mkRow(w, 'CHGUSDT', 'long', { rsi: 33 });
  const chA = w.trendmxMomChipHtml(against);
  assert(/MOMENTUM AGAINST · HELD OFF/.test(chA) && chA.indexOf('33.0') >= 0 && chA.indexOf('hg-v1019') >= 0,
         'the AGAINST chip names the hold-off, the RSI print and the pack');
  const withIt = mkRow(w, 'WTHUSDT', 'long', { rsi: 58 });
  const chW = w.trendmxMomChipHtml(withIt);
  assert(/MOMENTUM WITH IT/.test(chW) && chW.indexOf('58.0') >= 0,
         'the WITH chip carries the print');
  assert(w.trendmxMomChipHtml(mkRow(w, 'FLPUSDT', 'long', { rsi: 45 })) === ''
      && w.trendmxMomChipHtml(mkRow(w, 'NAPUSDT', 'short', { rsi: NaN })) === '',
         'FLAT and UNREAD paint NO chip — the abstain states stay silent');
  /* and the chip rides the desk card surface (the limit renderer runs the
     same chain; hgSetupCardHTML is index.html's, outside this harness) */
  const withRow = mkRow(w, 'CRDUSDT', 'long', { gate: gate7() });
  const deskCard = w.trendmxGateCleanDeskHTML([{ row: withRow, plan: w.trendmxPlan(Object.assign({}, withRow, { dir: 'long' })), dir: 'long', stack: null }], 0, { flow: 0, mom: 0 });
  assert(/MOMENTUM WITH IT/.test(deskCard), 'the desk card carries the witness chip beside the flow chip');
  const src5 = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  /* hg-v1020 repoint: the chain gained the volume witness between momentum
     and funding — the momentum witness still rides the same seam, one chip
     earlier in the order. */
  assert(/trendmxPlanHTML\(plan\) \+ tmSmcChip\(r\) \+ trendmxFlowChipHtml\(r\) \+ trendmxMomChipHtml\(r\) \+ trendmxVolChipHtml\(r\) \+ trendmxFundingChipHtml\(r\)/.test(src5),
         'the MATRIX card\'s chip chain carries the witness between the flow and funding chips (volume witness between them, hg-v1020)');
}

console.log('== 6) the forward log: momWith rides the reads seam, held rows never record ==');
{
  const w = boot();
  let rec = null;
  w.hgFwdRecordScan = (tab, tf, list, opts) => { rec = { tab, tf, list, opts }; return list.length; };
  const withR = mkRow(w, 'WITUSDT', 'long', { gate: gate7() });                       /* rsi ~100 -> with */
  const flatR = mkRow(w, 'FLSUSDT', 'short', { rsi: 55 });                            /* flat for a short */
  const flowAndMom = mkRow(w, 'BMUSDT', 'long', { gate: gate7(), flow: { verdict: 'with', bars: 30 } });
  const held = mkRow(w, 'OUTUSDT', 'long', { gate: gate7(), rsi: 30 });
  w.trendmxLimitClasses([withR, flatR, flowAndMom, held]);
  assert(rec && rec.list.length === 4, 'hg-v1159: the held row REACHES the record — four recorded, the held one with ticket:false');
  const bySym = {};
  rec.list.forEach(r => { bySym[r.sym] = r; });
  assert(bySym.WITUSDT.reads && bySym.WITUSDT.reads.momWith === true && !bySym.WITUSDT.reads.takerFlowWith,
         'a momentum-WITH row records the momWith read-mark');
  assert(!(bySym.FLSUSDT.reads && ('momWith' in bySym.FLSUSDT.reads)),
         'a FLAT row records NO momWith mark — the abstain state is NOT RECORDED, the honest third state (hg-v1159: the composite legs ride the bag; the witness key stays absent)');
  assert(bySym.OUTUSDT && bySym.OUTUSDT.ticket === false && bySym.OUTUSDT.reads && bySym.OUTUSDT.reads.momWith === false,
         'hg-v1159: the momentum-held row is recorded with ticket:false and momWith FALSE — the complement the ledger never had');
  assert(bySym.BMUSDT.reads && bySym.BMUSDT.reads.momWith === true && bySym.BMUSDT.reads.takerFlowWith === true,
         'flow-with and momentum-with accrue on the ONE reads seam');
  assert(bySym.WITUSDT.mechanic === 'TM-CLEAN7' && rec.opts.horizonBars === 20,
         'mechanics and horizon byte-identical — the ledger stays comparable');
}

console.log('== 7) the desk verdicts name each witness that fired (legacy text intact) ==');
{
  const w = boot();
  /* legacy caller, bare count: the hg-v1018 text byte-for-byte */
  const legacy = w.trendmxGateCleanDeskHTML([], 1);
  assert(/1 qualified row held off — real Binance taker flow reads against the trend \(hg-v1012\)\. The rows paint in the matrix with their chips\./.test(text(legacy)),
         'a bare-count call still prints the hg-v1012/hg-v1018 flow verdict byte-identical');
  const momOnly = w.trendmxGateCleanDeskHTML([], 1, { flow: 0, mom: 1 });
  assert(/momentum range has turned against the trend \(hg-v1019\)/.test(text(momOnly))
      && !/taker flow reads against the trend/.test(text(momOnly)),
         'a momentum-only hold-off names ONLY the momentum witness (the criteria line\'s standing flow bar is not a verdict)');
  const both = w.trendmxConvictionDeskHTML([], 2, { flow: 1, mom: 1 });
  assert(/hg-v1012/.test(text(both)) && /hg-v1019/.test(text(both)) && /2 qualified rows held off/.test(text(both)),
         'both witnesses fired: the verdict names both, count 2');
  /* the header tag on a populated desk names the firing witnesses too */
  const ok = mkRow(w, 'OKHUSDT', 'long', { gate: gate7() });
  const heldF = mkRow(w, 'HFHUSDT', 'long', { gate: gate7(), flow: { verdict: 'against' } });
  const heldM2 = mkRow(w, 'HMHUSDT', 'long', { gate: gate7(), rsi: 30 });
  const out = w.trendmxLimitClasses([ok, heldF, heldM2]);
  const gc = w.trendmxGateCleanDeskHTML(out.clean, out.heldClean, out.heldWhy.clean);
  assert(/2 held off — taker flow against · momentum regime against/.test(gc),
         'the header tag reads "2 held off — taker flow against · momentum regime against"');
  assert(/1D RSI momentum range not turned against/.test(gc) && /taker flow not against/.test(gc),
         'both desk criteria lines now name the momentum witness beside the flow bar');
}

console.log('== 8) the source says what shipped; no threshold moved ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  assert(/var TM_MOM_BULL_FLOOR = 40, TM_MOM_BEAR_CEIL = 60, TM_MOM_MID = 50;/.test(src),
         'the witness bands are the stated priors: bull floor 40, bear ceiling 60, midline 50');
  assert(/rsi: ts\.rsi/.test(src), 'the scan row carries the rsi stamp off trendScore — chips never recompute');
  assert(typeof boot().trendmxMomState === 'function' && typeof boot().trendmxMomChipHtml === 'function',
         'the witness and its chip are exported for the desks and the tests');
  assert(/var TM_MAJORITY = 2;/.test(src) && /var TM_LIMIT_DESK_CAP = 4;/.test(src),
         'no threshold moved — the majority bar is still |2|, the desk cap still 4');
  assert(/MOMENTUM WITNESS \(hg-v1019\)/.test(src),
         'the header documents the witness (docs follow behavior)');
}

console.log('\n' + (fail === 0
  ? 'ALL TRENDMX MOMENTUM-WITNESS TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
