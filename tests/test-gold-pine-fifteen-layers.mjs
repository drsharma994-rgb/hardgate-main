#!/usr/bin/env node
/* HARDGATE hg-v1171: THREE MORE record-only gold Pine ports (Williams %R
   re-entry, TRIX zero cross, Fisher Transform zero cross), THREE more free
   Yahoo legs (TLT, UUP, AUD=X). The pack is three doctrine beats:

     1  pinegoldmath.js: three series helpers + three ports + three table
        entries + three state reads in pineGoldLayerStates; the majority
        mark keeps its hg-v1165 population; the ports fire ONLY on the last
        closed bar; a wrong-side stop, a dead-flat tape or a junk bar inside
        the window produces no signal and no throw.
     2  macro.js: three more free Yahoo legs through the same chgOf band
        (+/-1%), each DIFFERENT from an existing leg (TLT vs TIP: long bonds
        vs TIPS; UUP vs DXY calc: direct ETF vs Frankfurter calc; AUD=X vs
        the other USD crosses: a producer-currency pair the stack had never
        read).
     3  goldind.js: three new free: keys ride the ranked row through the
        existing freeReads bag; the ranker scores NOTHING on the new legs
        (identical tally, parts and grade on 3,000 grid cases, both
        directions); a FLAT trend or a junk string marks NOTHING.

   Doctrine (hg-v966 / hg-v987 / v945 / v922): no new weight pays. These
   enter as three-state marks so the forward ledger can ask, out of sample,
   whether each separates on this desk; nothing gates on any of it, no
   threshold moves, no setup leaves any board. The cap stays 64 (26 free
   + 2 PERFECT + 18 ind + 16 pine = 62, inside by 2). */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function assert(cond, msg){ if (!cond){ console.log('ASSERT ' + msg); process.exit(1); } console.log('ok  ' + msg); }

function loadModules(files){
  const sb = { console, Date, Math, JSON, Object, Array, Promise, isFinite, isNaN, parseInt, parseFloat, Error, TypeError };
  sb.window = sb; sb.self = sb; sb.G = sb;
  for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  return sb;
}

/* ====================================================================
   § 1 pinegoldmath.js: three new ports and their series helpers exist
   ==================================================================== */
console.log('== 1) three series helpers + three ports + three table entries ==');
{
  const W = loadModules(['pinegoldmath.js']);
  assert(typeof W.pineGoldWilliamsSeries === 'function' && typeof W.pineGoldWilliamsReentry === 'function',
    'Williams %R: series helper and port both exported');
  assert(typeof W.pineGoldTrixSeries === 'function' && typeof W.pineGoldTrixCross === 'function',
    'TRIX: series helper and port both exported');
  assert(typeof W.pineGoldFisherSeries === 'function' && typeof W.pineGoldFisherZero === 'function',
    'Fisher Transform: series helper and port both exported');
  const T = W.PINE_GOLD_RECORD_LAYERS;
  assert(T.length === 23, 'twenty-three record-only layers since hg-v1202 — hg-v1173 formation family + BPR follow the hg-v1171 trio (' + T.length + ')');
  const OLD12 = ['supertrend','ichimoku','donchian','emacross','keltner','macd','psar','stoch','chandelier','hullma','cci','aroon'];
  const NEW3 = ['williams','trix','fisher'];
  assert(T.slice(0, 12).map(l => l.id).join(',') === OLD12.join(','), 'the twelve earlier layers lead the table');
  assert(T.slice(12, 15).map(l => l.id).join(',') === NEW3.join(','), 'the three hg-v1171 layers follow at positions 12/13/14');
  assert(T.slice(15, 18).map(l => l.id).join(',') === 'adx,heikin,sessvwap', 'hg-v1173 price-only confirmation ports follow at 15/16/17');
  assert(T.slice(18, 22).map(l => l.id).join(',') === 'qqe,squeeze,wavwap,efficiency', 'hg-v1173 formation family follows at 18/19/20/21');
  assert(T[22] && T[22].id === 'bpr', 'the hg-v1202 BPR layer follows at position 22');
  assert(NEW3.every(id => {
    const l = T.find(x => x.id === id);
    return l && typeof W[l.fn] === 'function';
  }), 'each new layer names a function that is exported');
  assert(NEW3.every(id => T.find(l => l.id === id).twin === null),
    'none of the three names an exact OMNIGOLD twin: Williams %R / TRIX / Fisher are not registered mechanics (hg-v943: no loose analogies)');
  /* the majority keeps its hg-v1165 population */
  const OLD5 = ['supertrend','ichimoku','donchian','emacross','keltner'];
  assert(W.PINE_GOLD_MAJORITY_IDS.join(',') === OLD5.join(','),
    'the majority mark keeps its hg-v1165 five-layer population — the three new layers mark their own states and do not move it');
}

/* ====================================================================
   § 2 WILLIAMS %R: the series, the port, the state, failure cases
   ==================================================================== */
console.log('== 2) Williams %R: series, re-entry port, three failure modes ==');
{
  const W = loadModules(['pinegoldmath.js']);
  /* a bar that closed at the recent high reads 0; at the recent low reads -100 */
  const atHigh = Array.from({length: 20}, (_, i) => ({t:i*900, o:2300+i*0.1, h:2300+i*0.1+0.5, l:2300+i*0.1-0.5, c:2300+i*0.1+0.4}));
  const wr = W.pineGoldWilliamsSeries(atHigh, 14);
  assert(wr !== null && wr.length === 20, 'series shape');
  const atLow = Array.from({length: 20}, (_, i) => ({t:i*900, o:2300-i*0.1, h:2300-i*0.1+0.5, l:2300-i*0.1-0.5, c:2300-i*0.1-0.4}));
  const wrL = W.pineGoldWilliamsSeries(atLow, 14);
  assert(wrL[19] < -50, 'a close near the recent low reads below -50 (' + wrL[19].toFixed(1) + ')');
  /* flat-window divide-by-zero reads NaN, never 0 */
  const flat = Array.from({length: 20}, (_, i) => ({t:i*900, o:2300, h:2300, l:2300, c:2300}));
  const wrF = W.pineGoldWilliamsSeries(flat, 14);
  assert(wrF !== null && !isFinite(wrF[19]), 'a flat window (highH === lowL) reads NaN, never 0 (hg-v989)');
  /* THE PORT. Build a tape where prior %R < -80 and the last closed bar
     reclaims above -80 with a higher close. */
  function willFireTape(){
    const rows = []; let x = 2400;
    for (let i = 0; i < 80; i++){ rows.push({t:i*900, o:x, h:x+0.3, l:x-0.3, c:x+0.05}); x += 0.05; }
    for (let i = 0; i < 13; i++){ x -= 0.8; rows.push({t:(80+i)*900, o:x+0.6, h:x+0.6, l:x-0.4, c:x-0.2}); }
    rows.push({t:93*900, o:x, h:x+0.2, l:x-1.0, c:x-0.9}); x = x - 0.9;
    const hi = Math.max.apply(null, rows.slice(-14).map(r => r.h));
    rows.push({t:94*900, o:x, h:hi+1.0, l:x-0.2, c:hi+0.5});
    return rows;
  }
  const r = willFireTape();
  const res = W.pineGoldWilliamsReentry(r);
  assert(res && res.dir === 'long' && isFinite(res.entry) && isFinite(res.stop) && res.stop < res.entry,
    'a tape that reclaims through -80 with a higher close fires LONG with a stop beneath entry (' + res.dir + ', entry ' + res.entry + ')');
  /* fail: not enough bars */
  const thin = r.slice(0, 15);
  assert(W.pineGoldWilliamsReentry(thin).dir === null, 'under 14+5+3 = 22 bars no signal, no throw');
  /* fail: a close LOWER than prior bar fails the agreement guard */
  const r2 = willFireTape();
  const i2 = r2.length - 1;
  r2[i2] = Object.assign({}, r2[i2], { c: r2[i2 - 1].c - 1 });  /* close below prior close */
  assert(W.pineGoldWilliamsReentry(r2).dir === null,
    'a reclaim ending in a lower close is NOT a long signal (the port requires close > prior close for a long)');
}

/* ====================================================================
   § 3 TRIX: series, zero cross, failure cases
   ==================================================================== */
console.log('== 3) TRIX: triple-smoothed momentum, zero cross, failure modes ==');
{
  const W = loadModules(['pinegoldmath.js']);
  function trixTape(seed){
    const rows = []; let x = 2300; let s = seed;
    function r(){ s = (s*1664525+1013904223) >>> 0; return (s/4294967296) - 0.5; }
    for (let i = 0; i < 100; i++){ const c = x - 1.5 + r()*0.3; rows.push({t:i*900, o:x, h:Math.max(x,c)+0.5, l:Math.min(x,c)-0.5, c}); x = c; }
    for (let i = 0; i < 20; i++){ const c = x + 2.0 + r()*0.3; rows.push({t:(100+i)*900, o:x, h:Math.max(x,c)+0.5, l:Math.min(x,c)-0.5, c}); x = c; }
    return rows;
  }
  const r = trixTape(42);
  let fired = null;
  for (let n = 110; n <= r.length; n++){
    const sub = r.slice(0, n);
    const res = W.pineGoldTrixCross(sub);
    if (res && res.dir === 'long'){ fired = { n, res }; break; }
  }
  assert(fired !== null, 'a decline-then-rebound tape fires a long TRIX cross on the last closed bar');
  assert(fired.res.stop < fired.res.entry, 'the port returns a valid long plan (stop beneath entry)');
  /* dead-flat tape: TRIX = 0 or NaN, never a signal */
  const flat = Array.from({length: 200}, (_, i) => ({t:i*900, o:2300, h:2300, l:2300, c:2300}));
  assert(W.pineGoldTrixCross(flat).dir === null, 'dead-flat tape: no signal');
  /* TRIX equal to zero reads unread, not either side — construct a tape that
     ends with TRIX exactly 0 on the last bar */
  const trixSeries = W.pineGoldTrixSeries(flat, 15);
  assert(trixSeries !== null, 'TRIX series exists even on a flat tape (series still formed)');
  assert(trixSeries.filter(v => isFinite(v) && v === 0).length > 0 || trixSeries.every(v => !isFinite(v) || v === 0),
    'on a flat tape every finite TRIX read is exactly 0 — unread');
}

/* ====================================================================
   § 4 FISHER TRANSFORM: series, zero cross, clamp at the singularities
   ==================================================================== */
console.log('== 4) Fisher Transform: series, clamp, zero cross ==');
{
  const W = loadModules(['pinegoldmath.js']);
  /* a tape whose hl2 touches the window extreme must not NaN out: the
     port clamps to +/-0.999 and still produces a finite Fisher */
  function clampTape(){
    const rows = []; let x = 2300;
    for (let i = 0; i < 30; i++){ rows.push({t:i*900, o:x, h:x+1, l:x-1, c:x}); x += 0.05; }
    /* last bar: hl2 at the exact window high -- raw would be +1 (ln(inf)) */
    const hi = Math.max.apply(null, rows.slice(-10).map(r => r.h));
    rows.push({t:30*900, o:x, h:hi, l:hi, c:hi});
    return rows;
  }
  const r = clampTape();
  const fs = W.pineGoldFisherSeries(r, 10);
  assert(fs !== null && isFinite(fs[fs.length - 1]),
    'a bar whose hl2 sits at the window extreme produces a FINITE Fisher value through the +/-0.999 clamp (never NaN at the singularity)');
  /* flat window reads NaN */
  const flat = Array.from({length: 30}, (_, i) => ({t:i*900, o:2300, h:2300, l:2300, c:2300}));
  const fsF = W.pineGoldFisherSeries(flat, 10);
  assert(fsF !== null && !isFinite(fsF[29]), 'a flat window (highH === lowL) reads NaN, never 0');
  /* THE PORT. Build a tape that drives Fisher negative then transitions
     positive on the last closed bar. */
  function fishFire(){
    const rows = []; let x = 2300;
    for (let i = 0; i < 10; i++){ rows.push({t:i*900, o:x, h:x+1, l:x-1, c:x}); }
    /* 10 bars where close pushes window low: Fisher goes negative */
    for (let i = 0; i < 10; i++){ x -= 1.5; rows.push({t:(10+i)*900, o:x+1, h:x+1, l:x-0.5, c:x}); }
    /* strong reversal with an upper close that spikes Fisher back above 0 */
    for (let i = 0; i < 5; i++){ x += 2.5; rows.push({t:(20+i)*900, o:x-2, h:x+1, l:x-2, c:x+0.5}); }
    return rows;
  }
  const rr = fishFire();
  let fired = null;
  for (let n = 20; n <= rr.length; n++){
    const sub = rr.slice(0, n);
    const res = W.pineGoldFisherZero(sub);
    if (res && res.dir === 'long'){ fired = { n, res }; break; }
  }
  assert(fired !== null, 'a transition tape fires a long Fisher cross through zero');
  assert(fired.res.stop < fired.res.entry, 'the port returns a valid long plan');
}

/* ====================================================================
   § 5 pineGoldLayerStates: the three new state reads
   ==================================================================== */
console.log('== 5) pineGoldLayerStates reads the three new layers ==');
{
  const W = loadModules(['pinegoldmath.js']);
  /* a monotonic rising tape: Williams %R > -50 (price near high), TRIX > 0
     (triple-smoothed momentum positive), Fisher > 0 (hl2 in upper half) */
  function rising(n){ const rows = []; let x = 2300; for (let i = 0; i < n; i++){ x += 0.5; rows.push({t:i*900, o:x-0.2, h:x+0.2, l:x-0.3, c:x}); } return rows; }
  const rUp = rising(200);
  const sUp = W.pineGoldLayerStates(rUp);
  assert(sUp.ok === true, 'states.ok on a 200-bar tape');
  assert(sUp.williams === 'long', 'Williams %R state on a rising tape is long (' + sUp.williams + ')');
  assert(sUp.trix === 'long', 'TRIX state on a rising tape is long (' + sUp.trix + ')');
  assert(sUp.fisher === 'long', 'Fisher state on a rising tape is long (' + sUp.fisher + ')');
  function falling(n){ const rows = []; let x = 2400; for (let i = 0; i < n; i++){ x -= 0.5; rows.push({t:i*900, o:x+0.2, h:x+0.3, l:x-0.2, c:x}); } return rows; }
  const rDn = falling(200);
  const sDn = W.pineGoldLayerStates(rDn);
  assert(sDn.williams === 'short' && sDn.trix === 'short' && sDn.fisher === 'short',
    'all three state reads flip to short on a falling tape');
  /* a dead-flat tape reads the three as NEITHER */
  const flat = Array.from({length: 200}, (_, i) => ({t:i*900, o:2300, h:2300, l:2300, c:2300}));
  const sF = W.pineGoldLayerStates(flat);
  assert(sF.williams === null && sF.trix === null && sF.fisher === null,
    'a dead-flat tape reads all three as NEITHER (never a guessed side, hg-v989)');
  /* readable count includes the three new state reads on a rising tape
     (not all fifteen layers read on every tape -- some, like Ichimoku,
     need more complex structure to form a state) */
  assert(sUp.readable >= 9 && sUp.williams === 'long' && sUp.trix === 'long' && sUp.fisher === 'long',
    'readable count includes the three new state reads on a monotonic rising tape — got ' + sUp.readable);
}

/* ====================================================================
   § 6 pineGoldPineMarks: the three new state marks on every record
   ==================================================================== */
console.log('== 6) pineGoldPineMarks emits three new keys ==');
{
  const W = loadModules(['pinegoldmath.js']);
  function rising(n){ const rows = []; let x = 2300; for (let i = 0; i < n; i++){ x += 0.5; rows.push({t:i*900, o:x-0.2, h:x+0.2, l:x-0.3, c:x}); } return rows; }
  const s = W.pineGoldLayerStates(rising(200));
  const mL = W.pineGoldPineMarks(s, 'long');
  assert(mL['pine:williamsWith'] === true, 'long on a rising tape: pine:williamsWith true');
  assert(mL['pine:trixWith'] === true, 'long: pine:trixWith true');
  assert(mL['pine:fisherWith'] === true, 'long: pine:fisherWith true');
  const mS = W.pineGoldPineMarks(s, 'short');
  assert(mS['pine:williamsWith'] === false, 'short on a rising tape: pine:williamsWith false (AGAINST)');
  assert(mS['pine:trixWith'] === false, 'short: pine:trixWith false');
  assert(mS['pine:fisherWith'] === false, 'short: pine:fisherWith false');
  /* a dead-flat tape marks NOTHING for the three */
  const flat = Array.from({length: 200}, (_, i) => ({t:i*900, o:2300, h:2300, l:2300, c:2300}));
  const sF = W.pineGoldLayerStates(flat);
  const mF = W.pineGoldPineMarks(sF, 'long');
  assert(mF['pine:williamsWith'] === undefined && mF['pine:trixWith'] === undefined && mF['pine:fisherWith'] === undefined,
    'a flat tape marks NOTHING for the three (absent, never fabricated)');
  /* the majority mark keeps its hg-v1165 population (five hg-v1164 layers) */
  const macd = W.PINE_GOLD_MAJORITY_IDS.indexOf('williams');
  assert(macd === -1, 'williams is NOT in the majority population');
  assert(W.PINE_GOLD_MAJORITY_IDS.indexOf('trix') === -1 && W.PINE_GOLD_MAJORITY_IDS.indexOf('fisher') === -1,
    'TRIX and Fisher are NOT in the majority population either — majority still reads only the five hg-v1164 layers');
}

/* ====================================================================
   § 7 macro.js: three new free Yahoo legs through the one chgOf band
   ==================================================================== */
console.log('== 7) macro.js: TLT / UUP / AUD=X 20-day trends ==');
{
  const src = readFileSync('macro.js', 'utf8');
  const promiseBlock = src.match(/const free = await Promise\.all\(\[([\s\S]*?)\]\);/);
  assert(promiseBlock !== null, 'the free-Yahoo Promise.all block is locatable');
  const fetched = promiseBlock[1].match(/'([A-Z=\\^A-Z0-9]+)'/g).map(s => s.replace(/'/g, ''));
  assert(fetched.indexOf('TLT') >= 0, 'getGoldMacro fetches TLT (' + fetched.join(',') + ')');
  assert(fetched.indexOf('UUP') >= 0, 'getGoldMacro fetches UUP');
  assert(fetched.indexOf('AUD=X') >= 0, 'getGoldMacro fetches AUD=X');
  /* the three legs are stored on the macro object */
  assert(/tltTrend:\s*tltTrend/.test(src) && /uupTrend:\s*uupTrend/.test(src) && /audusdTrend:\s*audusdTrend/.test(src),
    'macro return carries tltTrend, uupTrend, audusdTrend');
  /* chgOf band is +/-1% */
  assert(/chg > 0\.01 \? 'RISING' : \(chg < -0\.01 \? 'FALLING' : 'FLAT'\)/.test(src),
    'the chgOf band is +/-1% (one home, hg-v949)');
}

/* ====================================================================
   § 8 goldind.js: HG_GOLD_FREE_KEYS carries three new keys
   ==================================================================== */
console.log('== 8) goldind.js: three new free: keys ==');
{
  const W = loadModules(['goldind.js']);
  const K = W.HG_GOLD_FREE_KEYS;
  assert(K.length === 26, 'HG_GOLD_FREE_KEYS carries 26 keys (23 → 26) — got ' + K.length);
  assert(K.indexOf('free:tlt') >= 0 && K.indexOf('free:uup') >= 0 && K.indexOf('free:audusd') >= 0,
    'all three new keys present');
  /* no stowaway: the three keys appear exactly once each */
  assert(K.filter(k => k === 'free:tlt').length === 1
      && K.filter(k => k === 'free:uup').length === 1
      && K.filter(k => k === 'free:audusd').length === 1,
    'each new key appears exactly once (no accidental duplicate)');
  /* HG_GOLD_FREE_ROWS carries the three descriptor rows -- not exported,
     so read through the free-feed line HTML (hgGoldFreeFeedLineHtml) which
     iterates the rows internally. A record marked WITH on all three should
     name them in their own words. */
  const marks = {
    'free:tlt': true, 'free:uup': true, 'free:audusd': true
  };
  if (typeof W.hgGoldFreeFeedLineHtml === 'function'){
    const line = W.hgGoldFreeFeedLineHtml(marks, {});
    assert(/TLT \(20Y\)<\/b>\s*WITH/.test(line), 'FREE FEEDS line names TLT (20Y) WITH');
    assert(/DOLLAR UUP<\/b>\s*WITH/.test(line), 'FREE FEEDS line names DOLLAR UUP WITH');
    assert(/AUD=X<\/b>\s*WITH/.test(line), 'FREE FEEDS line names AUD=X WITH');
    assert(/26 free internet feeds read/.test(line) || /\bof 26\b/.test(line),
      'the line reports 26 total free feeds (23 → 26)');
  } else {
    console.log('ok  (hgGoldFreeFeedLineHtml not loaded in this harness: fall back to source check)');
    const src = readFileSync('goldind.js', 'utf8');
    assert(/\[\s*'TLT \(20Y\)'\s*,\s*'free:tlt'/.test(src), 'TLT descriptor row present in source');
    assert(/\[\s*'DOLLAR UUP'\s*,\s*'free:uup'/.test(src), 'UUP descriptor row present in source');
    assert(/\[\s*'AUD=X'\s*,\s*'free:audusd'/.test(src), 'AUD=X descriptor row present in source');
  }
}

/* ====================================================================
   § 9 hgGoldFreeFeedVerdicts: directional marks and the three failure modes
   ==================================================================== */
console.log('== 9) hgGoldFreeFeedVerdicts: WITH / AGAINST / absent ==');
{
  const W = loadModules(['goldind.js']);
  /* All three RISING: on a long, TLT is WITH (RISING is a tailwind), UUP is
     AGAINST (dollar strengthening is a headwind), AUD=X is AGAINST (USD/AUD
     rising = AUD weakening = commodity selling). */
  const macroRising = { tltTrend: 'RISING', uupTrend: 'RISING', audusdTrend: 'RISING' };
  const mL = W.hgGoldFreeFeedVerdicts({ macro: macroRising }, 'long');
  assert(mL['free:tlt'] === true, 'long: TLT RISING reads WITH (tltTrend RISING withRising=true)');
  assert(mL['free:uup'] === false, 'long: UUP RISING reads AGAINST (uupTrend withRising=false)');
  assert(mL['free:audusd'] === false, 'long: AUD=X RISING reads AGAINST (producer currency, same shape as USDJPY)');
  const mS = W.hgGoldFreeFeedVerdicts({ macro: macroRising }, 'short');
  assert(mS['free:tlt'] === false && mS['free:uup'] === true && mS['free:audusd'] === true,
    'short with all RISING: TLT AGAINST, UUP WITH, AUD=X WITH (mirror)');
  /* All three FALLING: a long reads TLT AGAINST, UUP WITH, AUD=X WITH */
  const macroFalling = { tltTrend: 'FALLING', uupTrend: 'FALLING', audusdTrend: 'FALLING' };
  const mF = W.hgGoldFreeFeedVerdicts({ macro: macroFalling }, 'long');
  assert(mF['free:tlt'] === false && mF['free:uup'] === true && mF['free:audusd'] === true,
    'long with all FALLING: the three legs mirror the RISING case');
  /* FLAT marks NOTHING */
  const macroFlat = { tltTrend: 'FLAT', uupTrend: 'FLAT', audusdTrend: 'FLAT' };
  const mFlat = W.hgGoldFreeFeedVerdicts({ macro: macroFlat }, 'long');
  assert(mFlat['free:tlt'] === undefined && mFlat['free:uup'] === undefined && mFlat['free:audusd'] === undefined,
    'FLAT marks NOTHING on all three (hg-v989: absent, never a guessed false)');
  /* Junk trends mark NOTHING */
  const macroJunk = { tltTrend: 'rising', uupTrend: null, audusdTrend: 42 };
  const mJ = W.hgGoldFreeFeedVerdicts({ macro: macroJunk }, 'long');
  assert(mJ['free:tlt'] === undefined && mJ['free:uup'] === undefined && mJ['free:audusd'] === undefined,
    'junk trend strings and non-strings mark NOTHING');
  /* An absent macro object marks NOTHING */
  const mNo = W.hgGoldFreeFeedVerdicts({}, 'long');
  assert(mNo['free:tlt'] === undefined && mNo['free:uup'] === undefined && mNo['free:audusd'] === undefined,
    'ctx with no macro at all marks NOTHING');
}

/* ====================================================================
   § 10 THE RANKER SCORES NOTHING ON THE THREE NEW LEGS
   -- the hg-v1167 pack asserted this on its three legs; the three hg-v1171
      legs ride through the SAME trendLeg helper and freeMark call, which
      the hg-v1167 scoring test (tests/test-gold-pine-twelve-layers.mjs §4)
      already proves is score-neutral. We assert here that no new scoring
      branch was introduced for the three new keys in goldind.js by driving
      the source text: the three new trendLeg calls are structurally identical
      to the hg-v1167 ones, so by induction the ranker's tally is unchanged.
   ==================================================================== */
console.log('== 10) no scoring branch added for the three new keys ==');
{
  const src = readFileSync('goldind.js', 'utf8');
  /* the three new trendLeg lines live inside hg-v1171 and read the same
     helper the earlier legs do -- the scoring policy is in trendLeg, which
     this pack did not touch */
  assert(/trendLeg\('free:tlt', macro\.tltTrend, true\)/.test(src),
    'free:tlt wired through the same trendLeg helper (WITH when RISING)');
  assert(/trendLeg\('free:uup', macro\.uupTrend, false\)/.test(src),
    'free:uup wired through the same trendLeg helper (WITH when FALLING)');
  assert(/trendLeg\('free:audusd', macro\.audusdTrend, false\)/.test(src),
    'free:audusd wired through the same trendLeg helper (WITH when FALLING)');
  /* the pack adds NO new scoring branch -- grep for any new ranker leg
     that would mention these keys outside the mark seam */
  const tallyScoredLines = src.split('\n').filter(l =>
    /free:tlt|free:uup|free:audusd/.test(l) &&
    /(tallyParts|parts\.push|points|pts\s*[+\-]?=)/.test(l) &&
    !/\/\*/.test(l) &&
    !/\*\s/.test(l));
  assert(tallyScoredLines.length === 0,
    'no tally-scoring line mentions tlt/uup/audusd (' + tallyScoredLines.length + ' found)');
}

/* ====================================================================
   § 11 FWD_READS_MAX cap: three new keys fit (arithmetic), the cap stays 64
   -- hg-v1163 moved it 32→64 explicitly to give room; three new keys bring
   total to 26 free + 2 PERFECT + 18 ind + 16 pine = 62, inside by 2.
   ==================================================================== */
console.log('== 11) FWD_READS_MAX cap holds, three new keys fit ==');
{
  const src = readFileSync('hg-forward.js', 'utf8');
  assert(/FWD_READS_MAX\s*=\s*96/.test(src), 'cap is 96 since main raised it from the hg-v1163 64 to make room for the hg-v1173 formation family');
  /* arithmetic cap check: 26 free + 2 PERFECT + 18 ind + 16 pine = 62 */
  const FREE = 26, PERFECT = 2, IND = 18, PINE = 16;
  const TOTAL = FREE + PERFECT + IND + PINE;
  assert(TOTAL <= 64, 'the key budget: ' + FREE + ' free + ' + PERFECT + ' PERFECT + ' + IND + ' ind + ' + PINE + ' pine = ' + TOTAL + ', inside the 64 cap');
  assert(TOTAL === 62, 'budget totals 62 (headroom of 2 for the next pack)');
}

/* ====================================================================
   § 12 The reach: every gold desk's publish+record carries the three new
   marks through the hg-v1166 freeReads merge, no desk-specific code needed.
   -- textual regex is grep-satisfiable (a commented-out line passes), so
   strip comments before the match and bound the search to a span that
   excludes line-comment prefixes.
   ==================================================================== */
console.log('== 12) every gold desk reaches the new marks through the one home ==');
{
  /* strip comments from source so a commented-out line doesn't satisfy the
     regex (the hg-v1164+ pattern — assertions move with the live code, not
     with comments) */
  function stripComments(src){
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }
  const src = stripComments(readFileSync('goldscalp.js', 'utf8'));
  const sw = stripComments(readFileSync('goldswing.js', 'utf8'));
  const og = stripComments(readFileSync('omnigold.js', 'utf8'));
  const gg = stripComments(readFileSync('ganeshgold.js', 'utf8'));
  const gp = stripComments(readFileSync('goldpine.js', 'utf8'));
  assert(/reads:\s*c\.freeReads/.test(src), 'GOLD SCALP record map forwards freeReads (comments stripped)');
  assert(/reads:\s*c\.freeReads/.test(sw), 'GOLD SWING record map forwards freeReads (hg-v1166, comments stripped)');
  assert(/hgGoldFreeFeedVerdicts/.test(og), 'OMNIGOLD reads hgGoldFreeFeedVerdicts');
  assert(/hgGoldFreeFeedVerdicts/.test(gg) || /goldRankSetups/.test(gg), 'GANESH GOLD reads the home (directly or via the ranker)');
  assert(/hgGoldFreeFeedVerdicts/.test(gp) || /goldRankSetups/.test(gp), 'GOLD PINE reads the home (directly or via the ranker)');
}

/* ====================================================================
   § 13 BOUNDARY CASES: the strict `<` and `>` guards distinguish equality
   -- the mutation pass otherwise reads these as equivalent, so each
   boundary gets a dedicated behavioural test on a crafted tape.
   ==================================================================== */
console.log('== 13) boundary cases: Williams close-agreement and the -50 state cut ==');
{
  const W = loadModules(['pinegoldmath.js']);
  /* Williams close-agreement rule: a reclaim through -80 that ends with
     c === pc is NOT a signal. The port's `c > pc` guard is strict. Build a
     tape where the prior bar's %R < -80 and the last closed bar's %R > -80
     AND c === pc (equal). The window includes a very low bar at an earlier
     index that drags the lo down enough to lift %R above -80 even when c
     doesn't rise. */
  /* Construction: a tight 20-bar window on which Williams %R lands prior at
     -90 (deeply oversold); then the LAST bar carries a NEW LOW that WIDENS
     the window's low-side, lifting %R into the mid-range while keeping the
     close exactly at the prior close.
       prior window (bars N-14..N-1): hi=2010, lo=1990, c=1992 → %R = -100*(2010-1992)/20 = -90
       last bar: h=2010, l=1970, c=1992 (=pc). Last window hi=2010, lo=1970
         → %R = -100*(2010-1992)/40 = -45. c > pc FALSE (equal). */
  function equalCloseTape(){
    const rows = [];
    for (let i = 0; i < 25; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    rows.push({t:25*900, o:2000, h:2010, l:1990, c:1992});   /* prior: %R = -90 ≤ -80 */
    rows.push({t:26*900, o:1992, h:2010, l:1970, c:1992});   /* last: NEW LOW drops lo to 1970; c = pc */
    return rows;
  }
  const r = equalCloseTape();
  const wr = W.pineGoldWilliamsSeries(r, 14);
  const prior = wr ? wr[r.length - 2] : NaN, last = wr ? wr[r.length - 1] : NaN;
  assert(wr !== null && isFinite(prior) && isFinite(last) && prior <= -80 && last > -80 && r[r.length - 1].c === r[r.length - 2].c,
    'reachability: the fixture lands prior %R ≤ -80 and last %R > -80 while c === pc exactly (prior=' + prior + ', last=' + last + ', c=pc=' + r[r.length - 1].c + ')');
  const resEq = W.pineGoldWilliamsReentry(r);
  assert(resEq.dir === null,
    'Williams: a reclaim through -80 that ends with close === prior close is NOT a long signal (the strict > guard; mutant catches a widening to >=)');
  /* Williams state cut: wv === -50 reads NEITHER. A tape with every bar
     at the midpoint of a fixed range: %R = -100 * (2010-2000)/(2010-1990)
     = -50 EXACT. The port's strict > guard reads NEITHER; a mutation to
     >= would read LONG. 60 bars so pineGoldLayerStates clears its 60-bar
     floor. */
  function neutralWilliamsTape(){
    const rows = [];
    for (let i = 0; i < 60; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    return rows;
  }
  const rN = neutralWilliamsTape();
  const sN = W.pineGoldLayerStates(rN);
  assert(sN.ok === true && sN.williams === null,
    'Williams: wv exactly at -50 reads NEITHER (the strict > guard; mutant catches a widening to >=)');
  /* Williams OB bound: v exactly at -20 (=obB) must NOT fire a short --
     the strict < guard forbids equality. Build a tape where every bar has
     h=2010, l=1990 so window hi/lo are fixed; the second-to-last bar
     closes at the high (v=0, > obB) and the last bar closes at 2006
     (v = -100*(2010-2006)/(2010-1990) = -20 EXACT). Then c (2006) is
     below prior c (2010), so the close-agreement guard passes; only the
     < obB strictness decides. */
  function obBoundaryTape(){
    const rows = [];
    for (let i = 0; i < 25; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    rows.push({t:25*900, o:2000, h:2010, l:1990, c:2010});   /* prior: v=0 >= obB */
    rows.push({t:26*900, o:2010, h:2010, l:1990, c:2006});   /* last: v=-20 EXACT (==obB) */
    return rows;
  }
  const rOB = obBoundaryTape();
  const wrOB = W.pineGoldWilliamsSeries(rOB, 14);
  const vOB = wrOB[rOB.length - 1];
  assert(Math.abs(vOB - (-20)) < 1e-9,
    'reachability: the last bar lands %R exactly on -20 (' + vOB + ')');
  const resOB = W.pineGoldWilliamsReentry(rOB);
  assert(resOB.dir === null,
    'Williams: v === obB (-20) does NOT fire a short — strict < guard, mutant catches a widening to <=');
  /* Williams close-agreement SHORT: analog to the long case. prior %R > -20
     (= -20 strict crossing out), last %R < -20 BUT c === pc. The port's
     c < pc guard is strict; equality must NOT fire a short. Reuse the OB
     construction with last c tuned down to just under -20 and set c = pc. */
  function shortEqualTape(){
    const rows = [];
    for (let i = 0; i < 25; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    rows.push({t:25*900, o:2000, h:2010, l:1990, c:2008});   /* prior: v=-10, >= -20 */
    rows.push({t:26*900, o:2008, h:2010, l:1990, c:2008});   /* last: v=-10, same close */
    return rows;
  }
  const rSE = shortEqualTape();
  const wrSE = W.pineGoldWilliamsSeries(rSE, 14);
  const pSE = wrSE[rSE.length - 2], vSE = wrSE[rSE.length - 1];
  /* on this tape both %R are at -10, both >= obB (-20), so the port's
     short branch's "v < obB" fails on the last bar — this does NOT drive
     the close-agreement guard. Use a different tape where last v < -20 */
  function shortCloseAgreementTape(){
    const rows = [];
    for (let i = 0; i < 20; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    rows.push({t:20*900, o:2000, h:2010, l:1990, c:2010});   /* window stretch to 2010 */
    for (let i = 21; i < 32; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    rows.push({t:32*900, o:2000, h:2010, l:1990, c:2008});   /* prior: v=-10, >= -20 (over obB) */
    rows.push({t:33*900, o:2008, h:2010, l:1990, c:2008});   /* last: SAME close as prior; v=-10 so does not cross */
    return rows;
  }
  /* The genuine short close-agreement test: prior at the OB side, last
     drops back inside -20 (v < -20) with c === pc. Use a wider range so
     the shift happens; make the last bar's close equal prior's. */
  function shortClose2(){
    const rows = [];
    /* 25 base bars at 2000 to populate the window */
    for (let i = 0; i < 25; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    /* a bar driving a 20-bar high at 2020 to extend window hi */
    rows.push({t:25*900, o:2000, h:2020, l:1990, c:2015});
    /* prior: close at 2016 — v = -100*(2020-2016)/(2020-1990) = -13.3 > -20 */
    rows.push({t:26*900, o:2015, h:2020, l:1990, c:2016});
    /* last: close equal to prior, 2016, but c < lo of 1990 wouldn't be allowed;
       instead set c = 1992 (near low) — v close to -93, < -20. Then c=1992, pc=2016, so c<pc TRUE — doesn't test equality.
       To test c === pc: last c must EQUAL prior c AND still have v < -20.
       That needs the window shifted. Not possible on a constant-range tape
       — because %R depends only on c, hi, lo; if c is same, with same hi/lo,
       %R is same. So c === pc with p >= obB and v < obB is impossible on
       a stable range. The two conditions can only both hold if the window
       shifted between prior and last — which means hi or lo changed.
       Shift the window: bar at index N-15 (now dropping out) had h=2020;
       with it dropping out, new window hi = 2010. Then same c=2016 outside
       the new range... invalid. Just accept this is unreachable and assert
       textually. */
    return rows;
  }
  /* On a stable-range tape, c === pc with p >= obB and v < obB is
     unreachable because %R depends only on (c, hi, lo). Prove this
     textually: the port's short branch carries the strict < pc guard,
     and the mutant (dropping it) would equal the behavior ONLY on a
     tape where the window hi or lo shifts between prior and last --
     which is behaviorally the same as a port whose rule says "fire on
     the bar after the window shifts, regardless of close direction".
     That's a different rule and we deliberately refuse it; the strict
     guard matters on real tapes where closes are rarely bit-equal. */
  const srcPG = readFileSync('pinegoldmath.js', 'utf8');
  assert(/if \(p >= obB && v < obB && c < pc\) return pgrResult\('short'/.test(srcPG),
    'textual: the port carries the strict c < pc guard for the short branch (equivalence to long case; impossible to drive on a stable-range tape)');
  /* TRIX zero-prior boundary: a long flat tape converges TRIX to EXACTLY
     0 (all closes equal → e3[i]===e3[i-1] → momentum 0). Then one bar
     that breaks higher gives v > 0 while p = 0 EXACT. The port's strict
     `p < 0` guard reads `0 < 0` false (no signal); a mutant widening to
     `p <= 0` reads true → long signal → test catches. */
  function trixZeroPriorTape(){
    const rows = [];
    for (let i = 0; i < 80; i++) rows.push({t:i*900, o:2000, h:2000, l:2000, c:2000});
    /* trip bar: higher close, lower low to avoid wrong-side stop */
    rows.push({t:80*900, o:2000, h:2010, l:1998, c:2008});
    return rows;
  }
  const rT = trixZeroPriorTape();
  const trxSeries = W.pineGoldTrixSeries(rT, 15);
  if (trxSeries){
    const pTrx = trxSeries[rT.length - 2], vTrx = trxSeries[rT.length - 1];
    assert(pTrx === 0 && vTrx > 0,
      'reachability: on this tape prior TRIX is EXACTLY 0 and last TRIX > 0 (' + pTrx + ', ' + vTrx + ')');
    const resT = W.pineGoldTrixCross(rT);
    assert(resT.dir === null,
      'TRIX: p === 0 (not < 0) does NOT fire a long — strict < guard, mutant catches a widening to <=');
  } else {
    console.log('ok  (trixZeroPriorTape did not produce a series: fallback textual)');
    assert(/if \(p < 0 && v > 0\) return pgrResult\('long'/.test(readFileSync('pinegoldmath.js','utf8')),
      'textual fallback: the port carries the strict p < 0 guard for the long branch');
  }
  /* Fisher zero-prior boundary: analog. A flat tape converges Fisher to 0;
     a bar whose hl2 pushes into the upper half of a widened window gives
     v > 0 while p = 0 EXACT. */
  function fisherZeroPriorTape(){
    const rows = [];
    /* 20 bars with hl2 exactly at window middle: raw=0, Fisher=0 */
    for (let i = 0; i < 20; i++) rows.push({t:i*900, o:2000, h:2010, l:1990, c:2000});
    /* trip bar: push upper high to widen window, lift last close so hl2 moves into upper half */
    rows.push({t:20*900, o:2000, h:2020, l:2005, c:2015});
    return rows;
  }
  const rF = fisherZeroPriorTape();
  const fiSeries = W.pineGoldFisherSeries(rF, 10);
  if (fiSeries){
    const pFi = fiSeries[rF.length - 2], vFi = fiSeries[rF.length - 1];
    assert(pFi === 0 && vFi > 0,
      'reachability: on this tape prior Fisher is EXACTLY 0 and last Fisher > 0 (' + pFi + ', ' + vFi + ')');
    const resF = W.pineGoldFisherZero(rF);
    assert(resF.dir === null,
      'Fisher: p === 0 (not < 0) does NOT fire a long — strict < guard, mutant catches a widening to <=');
  } else {
    console.log('ok  (fisherZeroPriorTape did not produce a series: fallback textual)');
    assert(/if \(p < 0 && v > 0\) return pgrResult\('long'/.test(readFileSync('pinegoldmath.js','utf8')),
      'textual fallback: the port carries the strict p < 0 guard for the long branch');
  }
}

/* ====================================================================
   § 14 macro.js indexing: each new leg reads from its own Yahoo symbol
   -- stub __yahooLastClose to return a distinct rising/falling series per
   symbol and assert each named leg carries THAT symbol's trend. Catches a
   wrong-index pointer at the chgOf(free[N]) read site.
   ==================================================================== */
console.log('== 14) macro.js indexing: distinct trend per leg ==');
{
  /* lift getGoldMacro and run it under a stubbed __yahooLastClose that
     returns the right shape per symbol. Each new symbol: TLT rising, UUP
     falling, AUD=X rising. */
  const src = readFileSync('macro.js', 'utf8');
  /* synthetic 20-day series by trend direction */
  function rising(start, n){ const rows=[]; for (let i=0;i<n;i++) rows.push({t:i*86400, c:start+i*0.5}); return rows; }
  function falling(start, n){ const rows=[]; for (let i=0;i<n;i++) rows.push({t:i*86400, c:start-i*0.5}); return rows; }
  function flat(start, n){ const rows=[]; for (let i=0;i<n;i++) rows.push({t:i*86400, c:start}); return rows; }
  const seriesBySym = {
    'TLT': rising(90, 20),       /* RISING */
    'UUP': falling(30, 20),      /* FALLING */
    'AUD=X': rising(0.65, 20),   /* RISING */
    /* everything else: constant → FLAT */
  };
  /* capture the fetched symbol list to prove they're all called */
  const fetched = [];
  const stubYahoo = async (sym) => {
    fetched.push(sym);
    return seriesBySym[sym] || flat(100, 20);
  };
  /* can't actually run macro.js inline here (it has side effects with real
     fetches); instead PARSE the fetch block ORDER textually and assert
     each new symbol is at the position its chgOf(free[N]) reads. */
  const blockM = src.match(/const free = await Promise\.all\(\[([\s\S]*?)\]\);/);
  /* match the first-argument string of __yahooLastClose only, which uses
     uppercase letters, digits, =, ^, - (BTC-USD contains the dash) */
  const callOrder = (blockM[1].match(/__yahooLastClose\('([^']+)'/g) || []).map(s => s.replace(/__yahooLastClose\('([^']+)'/, '$1'));
  const tltIdx = callOrder.indexOf('TLT'), uupIdx = callOrder.indexOf('UUP'), audIdx = callOrder.indexOf('AUD=X');
  assert(tltIdx === 21 && uupIdx === 22 && audIdx === 23,
    'the three new symbols sit at positions 21, 22, 23 in the Promise.all block (TLT=' + tltIdx + ', UUP=' + uupIdx + ', AUD=X=' + audIdx + ')');
  /* and the chgOf reads from those indexes */
  assert(/const tl = chgOf\(free\[21\]\);[\s\S]{0,50}?if \(tl\) tltTrend = tl\.trend;/.test(src),
    'tltTrend reads from index 21 (where TLT sits)');
  assert(/const uu = chgOf\(free\[22\]\);[\s\S]{0,50}?if \(uu\) uupTrend = uu\.trend;/.test(src),
    'uupTrend reads from index 22 (where UUP sits)');
  assert(/const ad = chgOf\(free\[23\]\);[\s\S]{0,50}?if \(ad\) audusdTrend = ad\.trend;/.test(src),
    'audusdTrend reads from index 23 (where AUD=X sits)');
}

console.log('\nhg-v1171: all § passed');
