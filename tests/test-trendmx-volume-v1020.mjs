/* HARDGATE — hg-v1020: THE VOLUME WITNESS (TREND MATRIX side). The
   composite reads closes, the momentum witness reads closes, and the flow
   witness reads ONE venue's 4h taker prints — nothing read the swing-scale
   volume trend on the row's own 1D tape. Granville's rule: volume must
   confirm. The read is the textbook OBV DIVERGENCE over the last two
   20-bar daily windows: price at a HIGHER 20-bar high with a LOWER OBV
   high is distribution under the rally (against longs); a LOWER price low
   with a HIGHER OBV low is accumulation under the fall (against shorts);
   the new extreme TOGETHER is confirmation (with). A pullback cannot
   false-fire — divergence needs price at a NEW extreme.

   The mechanic is the momentum witness's own (hg-v1019): evidence stamps
   on trendScore (never composite legs), AGAINST caps at NEAR and holds off
   both class desks (heldWhy gains the vol reason), WITH chips and records
   a volWith read-mark, flat and unreadable stay silent.

   Covers:
     1) the tape read: divergence, confirmation, and the silent tapes
     2) trendScore carries the stamps — the composite is byte-unchanged
     3) the state bands, both directions, one-sided verdicts
     4) the collector: held per class, three witnesses reason-split
     5) the tier: divergence caps at NEAR over a 7/7 gate
     6) the chips name the verdict; the abstain states stay silent
     7) the forward log: volWith rides the reads seam
     8) the desk verdicts name each witness; legacy text intact; no bar moved
   Run: node tests/test-trendmx-volume-v1020.mjs */

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

/* fixtures (the v1012/v1018/v1019 shapes, t in SECONDS) */
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
/* segmented 1D tapes: the last two 20-bar windows are the witness's stage */
function segs(spec){
  const rows = []; let i0 = 0;
  for (const s of spec){
    for (let i = 0; i < s.n; i++){
      const c = s.from + (s.to - s.from) * (i + 1) / s.n;
      const o = i0 ? rows[rows.length - 1].c : s.from;
      rows.push({ t: T0 - (260 - 1 - i0) * 86400, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.5, c, v: s.v });
      i0++;
    }
  }
  return rows;
}
/* distribution top: W1 rises to 320 on v1000 (OBV peaks), W2 dips heavy
   (v3000 down) then prints a HIGHER price high 321 on thin v200 — the
   textbook higher-price-high / lower-OBV-high */
const DIST1 = segs([{ n: 220, from: 100, to: 320, v: 1000 }, { n: 20, from: 320, to: 310, v: 3000 }, { n: 20, from: 310, to: 321, v: 200 }]);
/* accumulation bottom, mirrored */
const ACC1 = segs([{ n: 220, from: 500, to: 280, v: 1000 }, { n: 20, from: 280, to: 290, v: 3000 }, { n: 20, from: 290, to: 279, v: 200 }]);

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

console.log('== 1) the tape read: divergence, confirmation, and the silent tapes ==');
{
  const w = boot();
  const d = w.tmVolWitness(DIST1);
  assert(d.div === 'bear' && d.conf === null,
         'a higher 20-bar price high on a lower OBV high reads DISTRIBUTION (div bear)');
  const a = w.tmVolWitness(ACC1);
  assert(a.div === 'bull' && a.conf === null,
         'a lower 20-bar price low on a higher OBV low reads ACCUMULATION (div bull)');
  assert(w.tmVolWitness(UP1).conf === 'up' && w.tmVolWitness(DN1).conf === 'down',
         'a tape making the new extreme WITH volume confirms (conf up / down)');
  const flat = w.tmVolWitness(tape(260, 86400, 100, 0));
  assert(flat.div === null && flat.conf === null,
         'a flat tape makes no new extreme — volume has nothing to say');
  const deaf = tape(260, 86400, 100, 1).map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: 0 }));
  const dw = w.tmVolWitness(deaf);
  assert(dw.div === null && dw.conf === null,
         'a volume-deaf feed (every v zero) cannot speak — nulls, and nulls hold nothing off');
  const short = w.tmVolWitness(UP1.slice(-30));
  assert(short.div === null && short.conf === null,
         'fewer than 40 daily bars: no two windows, no verdict');
}

console.log('== 2) trendScore carries the stamps — the composite is byte-unchanged ==');
{
  const w = boot();
  const ts = w.trendScore(DIST1, UP4);
  assert(ts.volDiv === 'bear' && ts.volConf === null,
         'the distribution tape stamps volDiv bear on the result');
  assert(ts.score === 5 && ts.score === ts.comps.d1Trend + ts.comps.d1Cross + ts.comps.h4Cascade + ts.comps.cloud + ts.comps.adxPt,
         'and that tape is a maximal +5 composite — the witness is EVIDENCE, never a leg (the exact hole it closes)');
  const up = w.trendScore(UP1, UP4);
  assert(up.volConf === 'up' && up.volDiv === null,
         'a confirmed rise stamps the WITH side');
  const src = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  const sumLine = src.match(/out\.score = out\.comps[^;]+;/);
  assert(sumLine && !/vol/i.test(sumLine[0]),
         'the score sum names no volume field — the ledger\'s scale is untouched');
}

console.log('== 3) the state bands, both directions, one-sided verdicts ==');
{
  const w = boot();
  assert(w.trendmxVolState({ volDiv: 'bear', volConf: null }, 'long') === 'against',
         'distribution under the rally is AGAINST the long');
  assert(w.trendmxVolState({ volDiv: 'bear', volConf: null }, 'short') === 'flat',
         '…and says NOTHING to the short — one-sided verdicts, never both');
  assert(w.trendmxVolState({ volDiv: 'bull', volConf: null }, 'short') === 'against'
      && w.trendmxVolState({ volDiv: 'bull', volConf: null }, 'long') === 'flat',
         'accumulation under the fall is AGAINST the short, silent to the long');
  assert(w.trendmxVolState({ volDiv: null, volConf: 'up' }, 'long') === 'with'
      && w.trendmxVolState({ volDiv: null, volConf: 'down' }, 'short') === 'with',
         'the confirmed new extreme is WITH');
  assert(w.trendmxVolState({ volDiv: null, volConf: 'up' }, 'short') === 'flat'
      && w.trendmxVolState({ volDiv: null, volConf: 'down' }, 'long') === 'flat',
         'confirmation of the OTHER direction is not a verdict on this one');
  assert(w.trendmxVolState({ volDiv: null, volConf: null }, 'long') === null
      && w.trendmxVolState({}, 'long') === null && w.trendmxVolState(null, 'short') === null,
         'unreadable and unstamped rows: the witness cannot speak');
  assert(w.trendmxVolState({ volDiv: 'bear' }, null) === null && w.trendmxVolState({ volDiv: 'bear' }, 'x') === null,
         'no majority direction -> no verdict');
}

console.log('== 4) the collector: held per class, three witnesses reason-split ==');
{
  const w = boot();
  const heldV = mkRow(w, 'HLVUSDT', 'long', { gate: gate7(), volDiv: 'bear', volConf: null });
  const okV = mkRow(w, 'OKVUSDT', 'long', { gate: gate7(), volDiv: null, volConf: 'up' });
  const flatV = mkRow(w, 'FLVUSDT', 'long', { gate: gate7(), volDiv: null, volConf: null });
  const heldCV = mkRow(w, 'HCVUSDT', 'short', { volDiv: 'bull', volConf: null });
  const out = w.trendmxLimitClasses([heldV, okV, flatV, heldCV]);
  assert(out.clean.length === 2 && out.heldClean === 1 && out.heldWhy.clean.vol === 1,
         'the diverging clean row is held off ITS desk; confirming and silent rows paint');
  assert(out.conv.length === 0 && out.heldConv === 1 && out.heldWhy.conv.vol === 1,
         'the diverging conviction row is held off ITS OWN class');
  /* three witnesses, one desk: the reasons accrue independently */
  const heldF = mkRow(w, 'HFWUSDT', 'long', { gate: gate7(), flow: { verdict: 'against' } });
  const heldM = mkRow(w, 'HMWUSDT', 'long', { gate: gate7(), rsi: 30, volDiv: null, volConf: null });
  const out2 = w.trendmxLimitClasses([heldV, heldF, heldM]);
  assert(out2.heldClean === 3 && out2.heldWhy.clean.flow === 1 && out2.heldWhy.clean.mom === 1 && out2.heldWhy.clean.vol === 1,
         'flow + momentum + volume held on one desk: total 3, reasons split 1 + 1 + 1');
  /* priority order is stable: a row tripping flow first counts ONCE, under flow */
  const both = mkRow(w, 'BTHUSDT', 'long', { gate: gate7(), flow: { verdict: 'against' }, volDiv: 'bear', volConf: null });
  const out3 = w.trendmxLimitClasses([both]);
  assert(out3.heldClean === 1 && out3.heldWhy.clean.flow === 1 && out3.heldWhy.clean.vol === 0,
         'a row is held ONCE, under the first witness that fires — never double-counted');
}

console.log('== 5) the tier: divergence caps at NEAR over a 7/7 gate ==');
{
  const w = boot();
  const dv = mkRow(w, 'DVGUSDT', 'long', { gate: gate7(), volDiv: 'bear', volConf: null });
  const planD = w.trendmxPlan(Object.assign({}, dv, { dir: 'long' }));
  assert(w.trendmxRowTier(dv, planD) === 'near',
         'a 7/7 CLEAN row on a diverging volume trend caps at NEAR — never CLEAN, never the board');
  const cf = mkRow(w, 'CNFUSDT', 'long', { gate: gate7(), volDiv: null, volConf: 'up' });
  const planC = w.trendmxPlan(Object.assign({}, cf, { dir: 'long' }));
  assert(w.trendmxRowTier(cf, planC) === 'clean',
         'the confirmed row keeps its CLEAN tier — the witness only removes');
}

console.log('== 6) the chips name the verdict; the abstain states stay silent ==');
{
  const w = boot();
  const chA = w.trendmxVolChipHtml(mkRow(w, 'CHAVUSDT', 'long', { volDiv: 'bear', volConf: null }));
  assert(/VOLUME TREND AGAINST · HELD OFF/.test(chA) && chA.indexOf('hg-v1020') >= 0 && /distribution under the rally/i.test(chA),
         'the AGAINST chip names the hold-off, the pack and the divergence it read');
  const chW = w.trendmxVolChipHtml(mkRow(w, 'CHWVUSDT', 'short', { volDiv: null, volConf: 'down' }));
  assert(/VOLUME TREND WITH IT/.test(chW),
         'the WITH chip carries the confirmation');
  assert(w.trendmxVolChipHtml(mkRow(w, 'CHFVUSDT', 'long', { volDiv: null, volConf: null })) === ''
      && w.trendmxVolChipHtml(mkRow(w, 'CHNVUSDT', 'long', {})) === '',
         'FLAT and UNSTAMPED paint NO chip — the silent states stay silent');
  const src6 = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  assert(/trendmxMomChipHtml\(r\) \+ trendmxVolChipHtml\(r\) \+ trendmxFundingChipHtml\(r\)/.test(src6),
         'both card chip chains carry the volume witness between momentum and funding');
}

console.log('== 7) the forward log: volWith rides the reads seam ==');
{
  const w = boot();
  let rec = null;
  w.hgFwdRecordScan = (tab, tf, list, opts) => { rec = { tab, tf, list, opts }; return list.length; };
  const withV = mkRow(w, 'WVVUSDT', 'long', { gate: gate7(), volDiv: null, volConf: 'up', rsi: 45 });
  const flatAll = mkRow(w, 'FAVUSDT', 'short', { volDiv: null, volConf: null, rsi: 55 });
  const held = mkRow(w, 'OUTVUSDT', 'long', { gate: gate7(), volDiv: 'bear', volConf: null });
  w.trendmxLimitClasses([withV, flatAll, held]);
  assert(rec && rec.list.length === 2, 'the held row never reaches the record — two recorded, not three');
  const bySym = {};
  rec.list.forEach(r => { bySym[r.sym] = r; });
  assert(bySym.WVVUSDT.reads && bySym.WVVUSDT.reads.volWith === true && !bySym.WVVUSDT.reads.momWith,
         'a volume-confirming row records volWith (momentum abstained — reads accrue per witness)');
  assert(bySym.FAVUSDT.reads === undefined,
         'a row every witness abstained on records NO reads object — NOT RECORDED, the honest third state');
  assert(bySym.WVVUSDT.mechanic === 'TM-CLEAN7' && rec.opts.horizonBars === 20,
         'mechanics and horizon byte-identical — the ledger stays comparable');
}

console.log('== 8) the desk verdicts name each witness; legacy text intact; no bar moved ==');
{
  const w = boot();
  const legacy = w.trendmxGateCleanDeskHTML([], 1);
  assert(/1 qualified row held off — real Binance taker flow reads against the trend \(hg-v1012\)\. The rows paint in the matrix with their chips\./.test(text(legacy)),
         'a bare-count call still prints the hg-v1012/hg-v1018 flow verdict byte-identical');
  const volOnly = w.trendmxGateCleanDeskHTML([], 1, { flow: 0, mom: 0, vol: 1 });
  /* the VERDICT names only the witnesses that fired — the criteria line is a
     standing sentence that names all three bars, so the negative probes use
     the verdict phrasings ("reads against", "has turned"), not the criteria
     phrasings ("not against", "not turned against"). */
  assert(/OBV volume trend diverges against the trend \(hg-v1020\)/.test(text(volOnly))
      && !/taker flow reads against/.test(text(volOnly)) && !/momentum range has turned/.test(text(volOnly)),
         'a volume-only hold-off names ONLY the volume witness');
  const allThree = w.trendmxConvictionDeskHTML([], 3, { flow: 1, mom: 1, vol: 1 });
  assert(/hg-v1012/.test(text(allThree)) && /hg-v1019/.test(text(allThree)) && /hg-v1020/.test(text(allThree))
      && /3 qualified rows held off/.test(text(allThree)),
         'all three witnesses fired: the verdict names all three, count 3');
  const ok = mkRow(w, 'OKWUSDT', 'long', { gate: gate7(), volDiv: null, volConf: 'up' });
  const heldV2 = mkRow(w, 'HVWUSDT', 'long', { gate: gate7(), volDiv: 'bear', volConf: null });
  const out = w.trendmxLimitClasses([ok, heldV2]);
  const gc = w.trendmxGateCleanDeskHTML(out.clean, out.heldClean, out.heldWhy.clean);
  assert(/1 held off — volume trend against/.test(gc),
         'the header tag reads "1 held off — volume trend against"');
  assert(/OBV volume trend not diverging against/.test(gc),
         'the desk criteria line names the volume bar beside the flow and momentum bars');
  const src = fs.readFileSync(path.join(ROOT, 'trendtable.combined.js'), 'utf8');
  assert(/var TM_VOL_WIN = 20;/.test(src), 'the 20-bar windows are the stated prior');
  assert(/volDiv: ts\.volDiv, volConf: ts\.volConf/.test(src),
         'the scan row carries the volume stamps off trendScore — chips never recompute');
  assert(typeof w.trendmxVolState === 'function' && typeof w.trendmxVolChipHtml === 'function' && typeof w.tmVolWitness === 'function',
         'the witness, its chip and the pure tape read are exported');
  assert(/var TM_MAJORITY = 2;/.test(src) && /var TM_LIMIT_DESK_CAP = 4;/.test(src),
         'no threshold moved — the majority bar is still |2|, the desk cap still 4');
}

console.log('\n' + (fail === 0
  ? 'ALL TRENDMX VOLUME-WITNESS TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
