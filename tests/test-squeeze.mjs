/* HARDGATE — squeeze.js unit tests (Node 18+, builtins only, no live network).
   Loads indicators.js + indicators2.js + squeeze.js as classic scripts in a
   shared vm context (mirrors the browser's <script> globals; window is stubbed)
   and asserts the pure classifier window.squeezeClassify on synthetic rows:
   every state, both directions, deadzones, null/NaN inputs, boundary
   thresholds. Run: node tests/test-squeeze.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext(Object.create(null));
ctx.window = {};                                  // module exposes squeezeClassify + HG_tabs here
for (const f of ['indicators.js', 'indicators2.js', 'desk-scan-universe.js', 'squeeze.js']){
  vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = ctx;
const W = ctx.window;
const sq = W.squeezeClassify;

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- synthetic data builders ---------------- */
function flatRows(n, base, spread, t0){           // pinned close => BB sd ~0 => squeeze ON
  const r = [];
  for (let i = 0; i < n; i++) r.push({ t:t0+i, o:base, h:base+spread, l:base-spread, c:base, v:1000 });
  return r;
}
function trendRows(n, start, step, t0){           // steady trend => BB outside KC (expanded)
  const r = [];
  for (let i = 0; i < n; i++){
    const c = start + (i+1)*step, o = c - step;
    r.push({ t:t0+i, o:o, h:Math.max(o,c)+0.3, l:Math.min(o,c)-0.3, c:c, v:1000 });
  }
  return r;
}
function expRows(n, start, step, t0){             // expanded, exact 0.5-multiple prices, alternating volumes
  const r = [];
  for (let i = 0; i < n; i++){
    const c = start + (i+1)*step, o = c - step;
    r.push({ t:t0+i, o:o, h:Math.max(o,c)+0.5, l:Math.min(o,c)-0.5, c:c, v:(i%2 ? 1100 : 900) });
  }
  return r;
}
/* daily series */
const dUp  = trendRows(120, 80,  0.5, 0);         // close > ema20 > ema50
const dDn  = trendRows(120, 140, -0.5, 0);        // close < ema20 < ema50
const dMix = trendRows(100, 40, 0.5, 0).concat(trendRows(5, 90, -3, 100)); // close < ema20 but ema20 > ema50
{ // premise checks on the daily constructions
  const cu = dUp.map(r=>r.c), cd = dDn.map(r=>r.c), cm = dMix.map(r=>r.c);
  const u20 = G.ema(cu,20), u50 = G.ema(cu,50), d20 = G.ema(cd,20), d50 = G.ema(cd,50), m20 = G.ema(cm,20), m50 = G.ema(cm,50);
  assert(cu[119] > u20[119] && u20[119] > u50[119], 'premise: dUp is a clean uptrend (c > ema20 > ema50)');
  assert(cd[119] < d20[119] && d20[119] < d50[119], 'premise: dDn is a clean downtrend (c < ema20 < ema50)');
  assert(cm[104] < m20[104] && m20[104] > m50[104], 'premise: dMix is MIXED (c < ema20, ema20 > ema50)');
}

/* ---------------- 1) registration / load-time safety ---------------- */
{
  assert(typeof sq === 'function', 'window.squeezeClassify exported');
  assert(Array.isArray(W.HG_tabs) && W.HG_tabs.length === 1, 'HG_tabs registered exactly once');
  const t = W.HG_tabs[0];
  assert(t.id === 'squeeze' && t.label === 'SQUEEZE' && typeof t.mount === 'function',
         'HG_tabs entry: id=squeeze, label=SQUEEZE, mount fn');
  let threw = false;
  try { t.mount(null); } catch(e){ threw = true; }
  assert(!threw, 'mount(null) does not throw');
}

/* ---------------- 2) null / garbage / degenerate inputs ---------------- */
{
  const r1 = sq(null, null);
  assert(r1.state === 'NONE' && r1.firedAgo === null && Number.isNaN(r1.momentum)
         && r1.trendAgree === null && Number.isNaN(r1.volZ) && r1.donchianBreak === null,
         'null inputs -> NONE with null/NaN fields');
  assert(sq([], []).state === 'NONE', 'empty arrays -> NONE');
  assert(sq([{t:1,o:1,h:1,l:1,c:1,v:1}], null).state === 'NONE', 'single bar -> NONE');
  assert(sq(flatRows(5, 50, 1, 0), null).state === 'NONE', '5 bars (too short for any signal) -> NONE, no throw');
  assert(sq(flatRows(60, 50, 1, 0), 'garbage').state === 'BUILDING', 'garbage rows1d tolerated (trend unknown)');
  const withNull = flatRows(60, 50, 1, 0); withNull[59] = null;
  assert(sq(withNull, null).state === 'NONE', 'trailing null row -> NONE, no throw');
  const withNaN = flatRows(60, 50, 1, 0); withNaN[59].c = NaN;
  assert(sq(withNaN, null).state === 'NONE', 'NaN last close -> NONE, no throw');
}

/* ---------------- 3) missing indicator globals -> graceful NONE ---------------- */
{
  const keep = G.ttmSqueeze;
  G.ttmSqueeze = undefined;
  const r = sq(flatRows(60, 50, 1, 0), dUp);
  assert(r.state === 'NONE', 'ttmSqueeze missing -> NONE, no throw');
  G.ttmSqueeze = keep;
  assert(sq(flatRows(60, 50, 1, 0), dUp).state === 'BUILDING', 'globals restored -> classifies again');
}

/* ---------------- 4) BUILDING (real indicators) ---------------- */
{
  const r = sq(flatRows(60, 50, 1, 0), dUp);
  assert(r.state === 'BUILDING', 'flat 60 bars -> BUILDING');
  assert(r.firedAgo === null && r.trendAgree === null, 'BUILDING: firedAgo/trendAgree null (no direction)');
  assert(r.momentum === 0, 'BUILDING: momentum exactly 0 on pinned closes (got ' + r.momentum + ')');
  assert(r.volZ === 0, 'BUILDING: volZ 0 on constant volumes (zero-variance convention)');
  assert(r.donchianBreak === null, 'BUILDING: no donchian break inside the channel');
}

/* ---------------- 5) FIRED_LONG + firedAgo window boundary (real indicators) ---------------- */
const full = flatRows(60, 50, 1, 0).concat(trendRows(30, 50, 1, 1000));
const ttmFull = G.ttmSqueeze(full);
const fIdx = ttmFull.fired.findIndex(Boolean);
{
  assert(fIdx > 59 && ttmFull.fired.filter(Boolean).length === 1, 'premise: single fire at index ' + fIdx);

  const at0 = sq(full.slice(0, fIdx+1), dUp);
  assert(at0.state === 'FIRED_LONG' && at0.firedAgo === 0, 'fire on the last bar -> FIRED_LONG, firedAgo 0');
  assert(at0.momentum > 0, 'FIRED_LONG: momentum > 0 (got ' + at0.momentum + ')');
  assert(at0.trendAgree === true, 'FIRED_LONG + uptrend 1d -> trendAgree true');
  assert(at0.volZ === 0, 'FIRED_LONG: fire-bar volZ 0 on constant volumes');
  assert(at0.donchianBreak === null, 'FIRED_LONG: donchian break blocked by vol gate (volZ 0 < 1)');

  assert(sq(full.slice(0, fIdx+2), dUp).firedAgo === 1, 'fire 1 bar ago -> firedAgo 1, still FIRED_LONG');
  const at2 = sq(full.slice(0, fIdx+3), dUp);
  assert(at2.state === 'FIRED_LONG' && at2.firedAgo === 2, 'fire 2 bars ago -> still inside the 3-bar window');

  const at3 = sq(full.slice(0, fIdx+4), dUp);
  assert(at3.state === 'NONE' && at3.firedAgo === null, 'boundary: fire 3 bars ago -> outside window, NONE');
  const dcCheck = G.donchian(full.slice(0, fIdx+4), 20);
  const mm = fIdx+4;
  assert(full[mm-1].c > dcCheck.up[mm-2] && at3.donchianBreak === null,
         'price above donchian up but volZ 0 < 1 -> donchianBreak null (vol gate, deadzone)');

  assert(sq(full.slice(0, fIdx+1), dDn).trendAgree === false, 'FIRED_LONG + downtrend 1d -> AGAINST TREND (false)');
  assert(sq(full.slice(0, fIdx+1), dMix).trendAgree === false, 'FIRED_LONG + mixed 1d -> trendAgree false');
  assert(sq(full.slice(0, fIdx+1), null).trendAgree === null, 'FIRED_LONG + missing 1d -> trendAgree null');
  assert(sq(full.slice(0, fIdx+1), trendRows(30, 50, 0.5, 0)).trendAgree === null,
         'FIRED_LONG + short 1d (<50 bars, ema50 NaN) -> trendAgree null');
}

/* ---------------- 6) FIRED_SHORT + trend matrix (real indicators) ---------------- */
{
  const fullS = flatRows(60, 50, 1, 0).concat(trendRows(30, 50, -1, 1000));
  const fS = G.ttmSqueeze(fullS).fired.findIndex(Boolean);
  assert(fS > 59, 'premise: short-side fire at index ' + fS);
  const sDn = sq(fullS.slice(0, fS+1), dDn);
  assert(sDn.state === 'FIRED_SHORT' && sDn.momentum < 0, 'downtrend expansion -> FIRED_SHORT, momentum < 0');
  assert(sDn.trendAgree === true, 'FIRED_SHORT + downtrend 1d -> trendAgree true');
  assert(sq(fullS.slice(0, fS+1), dUp).trendAgree === false, 'FIRED_SHORT + uptrend 1d -> AGAINST TREND (false)');
  assert(sq(fullS.slice(0, fS+1), dMix).trendAgree === false, 'FIRED_SHORT + mixed 1d -> trendAgree false');
  assert(sq(fullS.slice(0, fS+1), null).trendAgree === null, 'FIRED_SHORT + missing 1d -> trendAgree null');
}

/* ---------------- 7) fire-bar volZ: crafted volumes, NaN volumes, fired+break combo ---------------- */
{
  const fullV = flatRows(60, 50, 1, 0).concat(trendRows(30, 50, 1, 1000));
  fullV.forEach((r, i)=>{ r.v = (i%2 ? 1100 : 900); });   // any 20-window: mean 1000, sd 100 (exact)
  const fV = G.ttmSqueeze(fullV).fired.findIndex(Boolean);
  fullV[fV].v = 1500;
  const rV = sq(fullV.slice(0, fV+1), dUp);
  assert(rV.volZ === 5, 'fire-bar volZ = (1500-1000)/100 = 5 exactly (got ' + rV.volZ + ')');
  assert(rV.state === 'FIRED_LONG' && rV.donchianBreak === 'LONG',
         'fired + donchian break reported independently on the same symbol');

  const fullN = flatRows(60, 50, 1, 0).concat(trendRows(30, 50, 1, 1000));
  const fN = G.ttmSqueeze(fullN).fired.findIndex(Boolean);
  for (let i = Math.max(0, fN-20); i <= fN; i++) fullN[i].v = NaN;
  const rN = sq(fullN.slice(0, fN+1), dUp);
  assert(rN.state === 'FIRED_LONG' && Number.isNaN(rN.volZ), 'NaN volumes -> volZ NaN, state unaffected');
}

/* ---------------- 8) Donchian breakout: direction, price/volume deadzones, boundaries ---------------- */
{
  const up2 = G.donchian(expRows(60, 50, 0.5, 0), 20).up[59];
  const lo2 = G.donchian(expRows(60, 130, -0.5, 0), 20).lo[59];
  assert(up2 === 80 && lo2 === 100, 'premise: exact channel levels up=80 / lo=100 (got ' + up2 + '/' + lo2 + ')');

  const mkLong = (c, v) => expRows(60, 50, 0.5, 0).concat([{ t:60, o:c-0.5, h:c+0.5, l:c-1, c:c, v:v }]);
  const rL = sq(mkLong(80.5, 1300), dUp);
  assert(rL.state === 'NONE' && rL.donchianBreak === 'LONG', 'close 80.5 > up 80 with vol z 3 -> donchianBreak LONG');
  assert(rL.firedAgo === null && Number.isNaN(rL.momentum), 'pure breakout: firedAgo null, momentum NaN');
  assert(rL.volZ === 3, 'pure breakout reports current-bar volZ = 3 (got ' + rL.volZ + ')');

  assert(sq(mkLong(80.5, 1100), dUp).donchianBreak === 'LONG', 'boundary: vol z exactly 1 -> breakout counts (>=)');
  const rWeak = sq(mkLong(80.5, 1099), dUp);
  assert(rWeak.donchianBreak === null && Number.isNaN(rWeak.volZ), 'vol z ~0.99 < 1 -> breakout vetoed, volZ NaN');
  assert(sq(mkLong(80, 1300), dUp).donchianBreak === null, 'boundary: close exactly == up -> no break (deadzone)');
  assert(sq(mkLong(79.5, 1300), dUp).donchianBreak === null, 'close inside channel with volume -> no break');

  const mkShort = (c, v) => expRows(60, 130, -0.5, 0).concat([{ t:60, o:c+0.5, h:c+1, l:c-0.5, c:c, v:v }]);
  const rS = sq(mkShort(99.5, 1300), dDn);
  assert(rS.state === 'NONE' && rS.donchianBreak === 'SHORT', 'close 99.5 < lo 100 with vol z 3 -> donchianBreak SHORT');
  assert(sq(mkShort(100, 1300), dDn).donchianBreak === null, 'boundary: close exactly == lo -> no break (deadzone)');
  assert(sq(mkShort(99.5, 1000), dDn).donchianBreak === null, 'short break without volume (z 0) -> vetoed');
}

/* ---------------- 9) BUILDING on-run boundary via causal slicing (real indicators) ---------------- */
{
  const buildFull = trendRows(60, 50, 1, 0).concat(flatRows(40, 110, 1, 1000));
  const ttmB = G.ttmSqueeze(buildFull);
  assert(ttmB.on[99] === true && ttmB.fired.every(f=>!f), 'premise: squeeze ON at end, no fires in series');
  let firstOn = 99; while (firstOn > 0 && ttmB.on[firstOn-1]) firstOn--;
  assert(100 - firstOn >= 5, 'premise: long on-run at the end (' + (100 - firstOn) + ' bars)');
  assert(sq(buildFull.slice(0, firstOn+2), dUp).state === 'NONE', 'boundary: run of exactly 2 on-bars -> NONE');
  const r3 = sq(buildFull.slice(0, firstOn+3), dUp);
  assert(r3.state === 'BUILDING', 'boundary: run of exactly 3 on-bars -> BUILDING');
  assert(r3.firedAgo === null && r3.trendAgree === null && isFinite(r3.momentum),
         'BUILDING slice: firedAgo/trendAgree null, momentum finite');
}

/* ---------------- 10) stubbed ttmSqueeze: exact branch deadzones ---------------- */
{
  const realTtm = G.ttmSqueeze;
  const flat60 = flatRows(60, 50, 1, 0);          // benign under real donchian/volZ (no break, volZ 0)
  function stub(n, onIdx, firedIdx, mom){
    const on = new Array(n).fill(false), fired = new Array(n).fill(false), momentum = new Array(n).fill(NaN);
    onIdx.forEach(i=>{ on[i] = true; });
    firedIdx.forEach(i=>{ fired[i] = true; });
    for (const k in mom) momentum[+k] = mom[k];
    G.ttmSqueeze = function(){ return { on: on, fired: fired, momentum: momentum }; };
  }

  stub(60, [], [59], {59: 0});
  let r = sq(flat60, dUp);
  assert(r.state === 'NONE' && r.firedAgo === 0 && r.momentum === 0,
         'fire with momentum exactly 0 -> directionless NONE, firedAgo still reported');

  stub(60, [], [59], {});
  r = sq(flat60, dUp);
  assert(r.state === 'NONE' && r.firedAgo === 0 && Number.isNaN(r.momentum),
         'fire with momentum NaN -> directionless NONE');

  stub(60, [], [57], {57: 5});
  r = sq(flat60, dUp);
  assert(r.state === 'FIRED_LONG' && r.firedAgo === 2 && r.trendAgree === true,
         'fire at n-3 (oldest in window) -> FIRED_LONG, firedAgo 2');

  stub(60, [], [56], {56: 5});
  r = sq(flat60, dUp);
  assert(r.state === 'NONE' && r.firedAgo === null, 'fire at n-4 only -> outside window, firedAgo null');

  stub(60, [57,58,59], [], {59: 2});
  r = sq(flat60, dUp);
  assert(r.state === 'BUILDING' && r.momentum === 2, 'stub: on-run of 3 at end -> BUILDING, momentum from last bar');

  stub(60, [58,59], [], {});
  assert(sq(flat60, dUp).state === 'NONE', 'stub: on-run of 2 -> NONE');

  stub(60, [55,56,57,58,59], [], {59: -1});
  assert(sq(flat60, dUp).state === 'BUILDING', 'stub: on-run of 5 -> BUILDING (momentum sign irrelevant)');

  stub(60, [59], [58], {58: -3});
  r = sq(flat60, dUp);
  assert(r.state === 'FIRED_SHORT' && r.firedAgo === 1, 'fire takes precedence over a fresh on-bar');

  stub(60, [], [57, 59], {57: 5, 59: -2});
  r = sq(flat60, dUp);
  assert(r.state === 'FIRED_SHORT' && r.firedAgo === 0, 'multiple fires in window -> most recent wins');

  G.ttmSqueeze = realTtm;
  assert(sq(flat60, dUp).state === 'BUILDING', 'stub removed -> real ttmSqueeze classifies again');
}

/* ---------------- 11) window.squeezePlan: universal SL/TP levels ---------------- */
{
  assert(typeof W.squeezePlan === 'function', 'window.squeezePlan exported');
  assert(typeof W.squeezePlanHTML === 'function', 'window.squeezePlanHTML exported');
  assert(typeof W.squeezePlanBlock === 'function', 'window.squeezePlanBlock exported');
  assert(typeof G.smartSetup !== 'function', 'premise: smartSetup absent in this context -> house fallback path');

  const rows = trendRows(120, 50, 0.5, 0);                 // steady uptrend, ATR ~ 1.1
  const a14 = G.atr(rows, 14)[rows.length - 1];
  assert(isFinite(a14) && a14 > 0, 'premise: ATR14 computable on the fixture (' + a14.toFixed(3) + ')');

  /* long fallback */
  const pl = W.squeezePlan({ dir: 'long', rows4h: rows });
  const lastC = rows[rows.length - 1].c;
  assert(pl && pl.entry === lastC, 'long: entry = last 4h close');
  assert(pl.stop < pl.entry, 'long: stop below entry');
  assert(Math.abs(pl.stop - (pl.entry - 1.5 * a14)) < 1e-9,
         'long: far structure -> stop = entry - 1.5×ATR (got ' + pl.stop.toFixed(4) + ')');
  assert(/capped/.test(pl.note), 'long: note honestly explains the ATR cap');
  assert(Math.abs(pl.t1 - (pl.entry + 2 * (pl.entry - pl.stop))) < 1e-9, 'long: T1 = entry + 2R exactly');
  assert(Math.abs(pl.t2 - (pl.entry + 3.5 * (pl.entry - pl.stop))) < 1e-9, 'long: T2 = entry + 3.5R exactly');
  assert(pl.t1 > pl.entry && pl.t2 > pl.t1, 'long: T1 above entry, T2 beyond T1');
  assert(pl.rr1 === 2 && pl.rr2 === 3.5, 'long: rr labels 2 / 3.5');
  assert(Math.abs(pl.riskPct - (pl.entry - pl.stop) / pl.entry * 100) < 1e-9, 'long: riskPct consistent with stop distance');

  /* short fallback */
  const rowsS = trendRows(120, 200, -0.5, 0);
  const a14s = G.atr(rowsS, 14)[rowsS.length - 1];
  const ps = W.squeezePlan({ dir: 'short', rows4h: rowsS });
  assert(ps && ps.dir === 'short' && ps.entry === rowsS[rowsS.length - 1].c, 'short: entry = last 4h close');
  assert(ps.stop > ps.entry, 'short: stop above entry');
  assert(Math.abs(ps.stop - (ps.entry + 1.5 * a14s)) < 1e-9, 'short: stop = entry + 1.5×ATR');
  assert(Math.abs(ps.t1 - (ps.entry - 2 * (ps.stop - ps.entry))) < 1e-9, 'short: T1 = entry - 2R exactly');
  assert(Math.abs(ps.t2 - (ps.entry - 3.5 * (ps.stop - ps.entry))) < 1e-9, 'short: T2 = entry - 3.5R exactly');
  assert(ps.t1 < ps.entry && ps.t2 < ps.t1, 'short: T1 below entry, T2 beyond T1');

  /* lastSwing structure preferred when it sits within 2.5×ATR */
  const rowsLS = trendRows(90, 50, 0.5, 0).concat(flatRows(30, 95, 1, 1000));
  const aLS = G.atr(rowsLS, 14)[rowsLS.length - 1];
  const swLS = G.lastSwing(rowsLS, 'long', 30);
  const pLS = W.squeezePlan({ dir: 'long', rows4h: rowsLS });
  assert(pLS && Math.abs(pLS.stop - (swLS - 0.25 * aLS)) < 1e-9,
         'structure within 2.5×ATR -> lastSwing stop (buffered 0.25×ATR)');
  assert(/lastSwing/.test(pLS.note), 'structural stop: note names lastSwing as the source');
  assert(Math.abs(pLS.t1 - (pLS.entry + 2 * (pLS.entry - pLS.stop))) < 1e-9, 'structural stop: T1 still exactly 2R');

  /* NaN-safety + graceful degradation */
  assert(W.squeezePlan(null) === null, 'null input -> null, no throw');
  assert(W.squeezePlan({}) === null, 'empty input -> null');
  assert(W.squeezePlan({ dir: 'sideways', rows4h: rows }) === null, 'non-directional dir -> null');
  assert(W.squeezePlan({ dir: 'LONG', rows4h: rows }) !== null, 'dir is case-insensitive (LONG accepted)');
  assert(W.squeezePlan({ dir: 'long' }) === null, 'missing rows4h -> null');
  assert(W.squeezePlan({ dir: 'long', rows4h: [] }) === null, 'empty rows4h -> null');
  assert(W.squeezePlan({ dir: 'long', rows4h: [{ t:1, o:1, h:1, l:1, c:NaN, v:1 }] }) === null,
         'NaN last close -> null, no throw');
  const zeroRange = flatRows(40, 50, 0, 0);                 // h==l==c -> TR 0 -> ATR 0
  assert(W.squeezePlan({ dir: 'long', rows4h: zeroRange }) === null, 'ATR 0 (zero-range rows) -> null, no fabricated levels');
  const keepAtr = G.atr; G.atr = undefined;
  assert(W.squeezePlan({ dir: 'long', rows4h: rows }) === null, 'atr global missing -> null (levels unavailable), no throw');
  G.atr = keepAtr;
  const keepLS = G.lastSwing; G.lastSwing = undefined;
  const pNoLS = W.squeezePlan({ dir: 'long', rows4h: rows });
  assert(pNoLS && Math.abs(pNoLS.stop - (pNoLS.entry - 1.5 * a14)) < 1e-9 && /lastSwing unavailable/.test(pNoLS.note),
         'lastSwing missing -> 1.5×ATR stop with honest note');
  G.lastSwing = keepLS;
  const pTrig = W.squeezePlan({ dir: 'long', rows4h: rows, entry: 999 });
  assert(pTrig && pTrig.entry === 999 && pTrig.stop < 999, 'entry override (trigger price) honoured');

  /* smartSetup preference + classification adaptation (legacy path) */
  const keepBL = G.hgBestLevels;
  G.hgBestLevels = undefined;
  const fake = { type:'SWING', dir:'long', entry:100, stop:95, t1:110, t2:117.5, rr1:2, rr2:3.5, riskPct:5, confirmed:true, note:'stub' };
  let seenCls = null, seenR1 = null;
  G.smartSetup = function(cls, r4, r1){ seenCls = cls; seenR1 = r1; return fake; };
  const fakeR1 = [{ t:1, o:1, h:1, l:1, c:1, v:1 }];
  const pSm = W.squeezePlan({ dir: 'long', rows4h: rows, rows1h: fakeR1, cls: { score: 3 } });
  assert(pSm === fake, 'smartSetup preferred when it returns a valid plan');
  assert(seenCls && seenCls.dir === 'long', 'classification adapted: lowercase dir passed to smartSetup');
  assert(seenR1 === fakeR1, 'rows1h forwarded to smartSetup');
  G.smartSetup = function(){ return null; };
  const pDecl = W.squeezePlan({ dir: 'long', rows4h: rows });
  assert(pDecl && pDecl.type === 'ATR' && pDecl.stop < pDecl.entry, 'smartSetup declining -> house fallback used');
  G.smartSetup = function(){ return { type:'SWING', dir:'long', entry:100, stop:100, t1:110, t2:117.5 }; };
  assert(W.squeezePlan({ dir: 'long', rows4h: rows }).type === 'ATR', 'smartSetup with zero risk rejected -> fallback');
  G.smartSetup = function(){ throw new Error('boom'); };
  assert(W.squeezePlan({ dir: 'long', rows4h: rows }) !== null, 'smartSetup throwing -> fallback survives, never throws');
  G.hgBestLevels = keepBL;
  delete G.smartSetup;

  /* markup: oiflow-style plan block */
  const blk = W.squeezePlanBlock({ sym: 'TESTUSDT', dir: 'long', rows4h: rows });
  assert(blk.indexOf('<div class="plan">') === 0, 'plan block uses the shared .plan container');
  assert(/ENTRY <b>/.test(blk), 'block contains ENTRY level');
  assert(/STOP <b>/.test(blk), 'block contains STOP level');
  assert(blk.indexOf('T1') !== -1 && blk.indexOf('T2') !== -1, 'block contains T1 and T2 labels');
  assert(/\(2(\.0)?R\)/.test(blk) && /\(3\.5R\)/.test(blk), 'block shows 2R / 3.5R multiples');
  assert(blk.indexOf('SEND TO TRADE PLAN') === -1, 'no trade handoff while toTrade is absent');
  G.toTrade = function(){};
  const blkT = W.squeezePlanBlock({ sym: 'TESTUSDT', dir: 'long', rows4h: rows });
  assert(blkT.indexOf('SEND TO TRADE PLAN') !== -1 && blkT.indexOf('toTrade(&quot;TESTUSDT&quot;') !== -1,
         'toTrade present -> SEND TO TRADE PLAN button, sym escaped');
  delete G.toTrade;
  const blkNone = W.squeezePlanBlock({ sym: 'TESTUSDT', dir: 'long', rows4h: zeroRange });
  assert(blkNone.indexOf('levels unavailable') !== -1 && blkNone.indexOf('STOP <b>') === -1,
         'uncomputable levels -> honest note, zero fabricated numbers');
}

/* ---------------- 12) hard-refresh contract: refresh on the registration ----------------
   Driven on a FRESH vm context (fresh window stub + real indicators + stubbed
   Binance legs) so the module's scan-state machine starts clean. Covers:
   registration carries refresh; pre-mount and mounted-never-run skip WITHOUT
   firing a first-time universe scan; busy guard during an in-flight scan (no
   double-fetch); post-run refresh re-runs runScan; overlapping refresh pair
   -> busy/refreshed; a per-symbol 4h throw stays isolated inside the scan
   loop; a 1d throw is tolerated (trend simply unknown); sabotaged DOM ->
   refresh resolves 'error', never throws, and the busy flag recovers. */
{
  assert(typeof W.HG_tabs[0].refresh === 'function', '12: original registration carries a refresh fn');

  const ctx2 = vm.createContext(Object.create(null));
  ctx2.window = ctx2;
  ctx2.setTimeout = setTimeout;            /* module sleep() needs it inside runScan */
  for (const f of ['indicators.js', 'indicators2.js', 'desk-scan-universe.js', 'squeeze.js']){
    vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx2, { filename: f });
  }
  const tab2 = ctx2.window.HG_tabs[0];
  assert(tab2.id === 'squeeze' && typeof tab2.refresh === 'function',
         '12: fresh registration = {id:squeeze, ..., refresh fn}');

  /* stubbed Binance legs with a universe-call counter; flat 4h -> BUILDING card */
  let uniCalls = 0;
  let throw4hFor = null, throwAll1d = false;
  ctx2.binancePerpUniverse = async function(){ uniCalls++; return throw4hFor ? ['FLATUSDT', throw4hFor] : ['FLATUSDT']; };
  ctx2.binanceTickers24h = async function(){
    const m = { FLATUSDT: { mark: 50, chg24: 0.1, turnoverUsd: 500e6 } };
    if (throw4hFor) m[throw4hFor] = { mark: 5, chg24: 0.1, turnoverUsd: 400e6 };
    return m;
  };
  ctx2.binanceKlines = async function(sym, tf){
    if (tf === '4h' && sym === throw4hFor) throw new Error('simulated 4h outage');
    if (tf === '1d' && throwAll1d) throw new Error('simulated 1d outage');
    if (tf === '4h') return flatRows(60, 50, 1, 0);
    if (tf === '1d') return dUp;
    return flatRows(120, 50, 1, 0);
  };

  function sqStubEl(){
    return { innerHTML: '', textContent: '', className: '', disabled: false,
             style: {}, firstElementChild: { style: {} },
             addEventListener: function(ev, fn){ this._handler = fn; } };
  }
  function sqPane(){
    const stubs = {};
    const pane = { _html: '',
      set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
      querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = sqStubEl(); return stubs[sel]; },
      querySelectorAll: function(){ return []; } };
    return { pane: pane, stubs: stubs };
  }
  async function waitSq(stubs){
    const t0 = Date.now();
    while (stubs['#sqRun'].disabled && Date.now() - t0 < 8000)
      await new Promise(function(res){ setTimeout(res, 25); });
  }

  /* --- pre-mount: skip, and no expensive first-time scan --- */
  const sSkip0 = await tab2.refresh();
  assert(sSkip0 === 'skipped: not run yet', '12: refresh before mount -> "skipped: not run yet" (got "' + sSkip0 + '")');
  assert(uniCalls === 0, '12: pre-mount refresh triggered no universe fetch');

  /* --- mounted but never run: still skip, still no scan --- */
  const P1 = sqPane();
  tab2.mount(P1.pane);
  const sSkip1 = await tab2.refresh();
  assert(sSkip1 === 'skipped: not run yet', '12: mounted-but-never-run refresh -> "skipped: not run yet"');
  assert(uniCalls === 0, '12: a global refresh must not fire a first-time full-universe scan');

  /* --- user runs once, then refresh re-runs --- */
  P1.stubs['#sqRun']._handler();
  await waitSq(P1.stubs);
  assert(uniCalls === 1 && P1.stubs['#sqStat'].textContent.indexOf('building 1') >= 0
         && P1.stubs['#sqForming'].innerHTML.indexOf('BUILDING · FORMING') >= 0,
         '12: user FIND SQUEEZES scan completes with a BUILDING card in forming desk');
  const sRef1 = await tab2.refresh();
  assert(sRef1 === 'refreshed', '12: refresh after a completed run -> "refreshed" (got "' + sRef1 + '")');
  assert(uniCalls === 2, '12: refresh re-ran the existing runScan (universe fetched again)');

  /* --- busy guard: refresh during an in-flight scan --- */
  P1.stubs['#sqRun']._handler();                  /* starts scan #3, not awaited */
  const sBusy = await tab2.refresh();
  await waitSq(P1.stubs);
  assert(sBusy === 'busy', '12: refresh during an in-flight scan -> "busy" (got "' + sBusy + '")');
  assert(uniCalls === 3, '12: busy guard did not double-fetch (only the click scan ran)');

  /* --- overlapping refresh pair: exactly one runs --- */
  const sConcBefore = uniCalls;
  const sPA = tab2.refresh();
  const sSB = await tab2.refresh();
  const sSA = await sPA;
  assert(sSB === 'busy', '12: second overlapping refresh -> "busy"');
  assert(sSA === 'refreshed' && uniCalls === sConcBefore + 1,
         '12: first overlapping refresh -> "refreshed", exactly one scan ran');

  /* --- per-symbol 4h throw stays isolated inside the scan loop --- */
  throw4hFor = 'BADUSDT';
  const sRef2 = await tab2.refresh();
  const sStat2 = P1.stubs['#sqStat'].textContent, sHtml2 = P1.stubs['#sqForming'].innerHTML;
  assert(sRef2 === 'refreshed' && sStat2.indexOf('failed 1') >= 0,
         '12: one symbol\'s 4h throw never aborts the scan (counted failed 1)');
  assert(sHtml2.indexOf('FLATUSDT') >= 0 && sHtml2.indexOf('BADUSDT') === -1,
         '12: surviving symbol still renders its forming card; failed symbol absent');
  throw4hFor = null;

  /* --- 1d throw tolerated: trend simply unknown, symbol NOT failed --- */
  throwAll1d = true;
  const sRef3 = await tab2.refresh();
  const sStat3 = P1.stubs['#sqStat'].textContent, sHtml3 = P1.stubs['#sqForming'].innerHTML;
  assert(sRef3 === 'refreshed' && sStat3.indexOf('failed 0') >= 0 && sHtml3.indexOf('BUILDING · FORMING') >= 0,
         '12: 1d kline outage tolerated (failed 0, BUILDING card survives in forming desk, trend unknown)');
  throwAll1d = false;

  /* --- never throws: sabotaged DOM -> 'error', busy flag recovers --- */
  const sStatStub = P1.pane.querySelector('#sqStat');
  const sDesc = Object.getOwnPropertyDescriptor(sStatStub, 'textContent');
  Object.defineProperty(sStatStub, 'textContent', {
    configurable: true,
    get: function(){ return ''; },
    set: function(){ throw new Error('dom dead'); }
  });
  const sErr = await tab2.refresh();
  assert(sErr === 'error', '12: sabotaged DOM -> refresh resolves "error", never throws (got "' + sErr + '")');
  Object.defineProperty(sStatStub, 'textContent', sDesc);
  const sRef4 = await tab2.refresh();
  assert(sRef4 === 'refreshed', '12: busy flag released after the error path — module refreshes again (got "' + sRef4 + '")');
}

/* ---------------- 13) BRAIN state getter — window.squeezeState + HG_squeezeResults ----------------
   Fresh context: getter exposed; null pre-run; exact
   {results:[{sym,dir,kind}], at} shape after a successful scan covering a
   BUILDING card (dir null) and a Donchian-break card (dir long);
   HG_squeezeResults published in the engine.js Stage-0 contract form
   ({syms, at} + mirrored results); deep-frozen fresh copies; an honest-abort
   re-run keeps the previous good snapshot with its original `at`; the getter
   never throws with sabotaged internals. */
{
  const ctx3 = vm.createContext(Object.create(null));
  ctx3.window = ctx3;
  ctx3.setTimeout = setTimeout;
  for (const f of ['indicators.js', 'indicators2.js', 'desk-scan-universe.js', 'squeeze.js']){
    vm.runInContext(readFileSync(path.join(root, f), 'utf8'), ctx3, { filename: f });
  }
  const W3 = ctx3.window;
  const tab3 = W3.HG_tabs[0];
  function sqStubEl13(){
    return { innerHTML: '', textContent: '', className: '', disabled: false,
             style: {}, firstElementChild: { style: {} },
             addEventListener: function(ev, fn){ this._handler = fn; } };
  }
  function sqPane13(){
    const stubs = {};
    const pane = { _html: '',
      set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
      querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = sqStubEl13(); return stubs[sel]; },
      querySelectorAll: function(){ return []; } };
    return { pane: pane, stubs: stubs };
  }
  async function waitSq13(stubs){
    const t0 = Date.now();
    while (stubs['#sqRun'].disabled && Date.now() - t0 < 8000)
      await new Promise(function(res){ setTimeout(res, 25); });
  }
  assert(typeof W3.squeezeState === 'function', '13: window.squeezeState exposed');
  assert(W3.squeezeState() === null, '13: null before the first successful scan');
  assert(W3.HG_squeezeResults === undefined, '13: HG_squeezeResults not written before the first scan');

  /* FLATUSDT: flat 4h -> BUILDING (dir null) · BRKUSDT: close 80.5 > DC up 80 with vol z 3 -> break LONG */
  const brkRows = expRows(60, 50, 0.5, 0).concat([{ t: 60, o: 80, h: 81, l: 79, c: 80.5, v: 1300 }]);
  let uni3 = ['FLATUSDT', 'BRKUSDT'];
  ctx3.binancePerpUniverse = async function(){ return uni3; };
  ctx3.binanceTickers24h = async function(){
    return { FLATUSDT: { mark: 50, chg24: 0.1, turnoverUsd: 500e6 },
             BRKUSDT: { mark: 80, chg24: 1.2, turnoverUsd: 400e6 } };
  };
  ctx3.binanceKlines = async function(sym, tf){
    if (tf === '4h') return sym === 'BRKUSDT' ? brkRows : flatRows(60, 50, 1, 0);
    if (tf === '1d') return dUp;
    return flatRows(120, 50, 1, 0);
  };

  const P3 = sqPane13();
  tab3.mount(P3.pane);
  P3.stubs['#sqRun']._handler();
  await waitSq13(P3.stubs);
  assert(P3.stubs['#sqStat'].textContent.indexOf('building 1') >= 0
         && P3.stubs['#sqStat'].textContent.indexOf('breakouts 1') >= 0,
         '13: fixture scan completes (1 building + 1 breakout)');

  const st = W3.squeezeState();
  assert(st && Array.isArray(st.results) && typeof st.at === 'number' && isFinite(st.at),
         '13: shape = {results:[], at:<epochMs>} after the successful scan');
  assert(st.results.length === 2,
         '13: one row per card in published state');
  assert(st.results[0].sym === 'FLATUSDT' && st.results[0].kind === 'build' && st.results[0].dir === null,
         '13: BUILDING watch card carries dir null (no direction to fabricate)');
  assert(st.results[1].sym === 'BRKUSDT' && st.results[1].kind === 'break' && st.results[1].dir === 'long',
         '13: Donchian-break card carries kind "break" + dir "long"');
  assert(Number.isFinite(+st.results[1].entry) && Number.isFinite(+st.results[1].stop) && Number.isFinite(+st.results[1].t1),
         '13: actionable squeeze rows publish entry/stop/t1 for Telegram alerts');
  assert(Object.isFrozen(st) && Object.isFrozen(st.results) && Object.isFrozen(st.results[0]),
         '13: the view is deep-frozen (state, results, rows all frozen)');
  const st2 = W3.squeezeState();
  assert(st2 !== st && st2.results !== st.results && JSON.stringify(st2) === JSON.stringify(st),
         '13: each call hands a fresh deep copy with identical content');

  /* HG_squeezeResults — the key engine.js Stage-0 already feature-checks */
  const pub = W3.HG_squeezeResults;
  assert(pub && typeof pub === 'object' && typeof pub.at === 'number'
         && Array.isArray(pub.syms) && pub.syms.join(',') === 'FLATUSDT,BRKUSDT',
         '13: HG_squeezeResults published in the engine.js Stage-0 form ({syms, at})');
  assert(Array.isArray(pub.results) && pub.results.length === 2
         && pub.results[0].kind === 'build' && pub.results[1].kind === 'break',
         '13: HG_squeezeResults.results mirrors the squeezeState rows');

  /* honest abort (universe leg returns nothing) keeps the PREVIOUS good snapshot + publisher key */
  uni3 = [];
  const ref3 = await tab3.refresh();
  const stA = W3.squeezeState();
  assert(ref3 === 'refreshed' && P3.stubs['#sqStat'].textContent.indexOf('unavailable') >= 0,
         '13: re-run aborts honestly (universe unavailable, no fabricated candidates)');
  assert(stA && stA.at === st.at && stA.results.length === 2
         && W3.HG_squeezeResults.at === pub.at,
         '13: stale-good snapshot + publisher key preserved after the abort (same at, same content)');

  /* sabotaged internals: getter degrades to null, never throws, then recovers */
  let sThrew = null, sGot = 'unset';
  vm.runInContext('globalThis.__keepIA = Array.isArray; Array.isArray = undefined;', ctx3);
  try{ sGot = W3.squeezeState(); }catch(e){ sThrew = e; }
  vm.runInContext('Array.isArray = globalThis.__keepIA; delete globalThis.__keepIA;', ctx3);
  assert(!sThrew && sGot === null,
         '13: getter never throws with sabotaged internals (Array.isArray removed) — returns null');
  assert(W3.squeezeState() !== null, '13: getter recovers once internals are restored');
}

/* ---------------- wiring + advanced desk ---------------- */
{
  const sq = readFileSync(path.join(root, 'squeeze.js'), 'utf8');
  assert(/squeezeGateEval/.test(sq), 'squeeze gate eval wired');
  assert(/hgFormTicket/.test(sq), 'squeeze formation ticket path');
  assert(/FIRED DESK/.test(sq), 'fired desk panel wired');
  assert(/LIMIT BOARD/.test(sq), 'limit board wired');
  assert(/hgPaintSqueezeFromSnap/.test(sq), 'snap restore export wired');
  assert(/#sqForming/.test(sq), 'forming desk mount point');
  assert(/hgDeskLoadUniverse/.test(sq), 'full universe via hgDeskLoadUniverse');
  assert(/data-v="coindcx"/.test(sq), 'venue filter chips wired');
  const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert(/hg-v260/.test(sw), 'cache hg-v260');
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.indexOf('squeeze:') >= 0, 'HG_TAB_AUTO_SCAN squeeze');
}

/* ---------------- summary ---------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL SQUEEZE TESTS PASSED');
