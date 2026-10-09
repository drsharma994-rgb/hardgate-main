#!/usr/bin/env node
/* HARDGATE hg-v1219: three more bar-only Pine ports join OMNIGOLD and
   GOLD SCALP as record-only layers, and ONE joins as a state-only read.
   HalfTrend / Range Filter / NW Envelope mint record-only through the
   one judge pineGoldRecordJudge, through goldScalpSetups' existing table
   iteration — no desk edit. The state-only VuManChu Cipher
   (pine:vumanchuCipherWith) joins pineGoldLayerStates and
   pineGoldPineMarks for the PINE STACK and the forward record, but does
   NOT mint a record-only layer and does NOT join the majority bar.

   Doctrine (hg-v966 / hg-v987 / v945 / v922): no new weight pays. No
   gate reads a new mark, no threshold moves, no setup leaves any board.
   The forward ledger decides, out of sample, whether any of them pays
   on this desk. */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function assert(cond, msg){ if (!cond){ console.log('ASSERT ' + msg); process.exit(1); } console.log('ok  ' + msg); }

function loadModules(files){
  const sb = { console, Date, Math, JSON, Object, Array, Promise, isFinite, isNaN, parseInt, parseFloat, Error, TypeError };
  sb.window = sb; sb.self = sb; sb.G = sb; sb.W = sb;
  for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  return sb;
}

function craftTape(opts){
  const o = Object.assign({ n: 250, start: 2000, step: 0, noise: 0, seed: 1 }, opts || {});
  const rows = []; let x = o.start, s = o.seed;
  for (let i = 0; i < o.n; i++){
    s = (s * 9301 + 49297) % 233280;
    const noise = o.noise ? ((s / 233280) * 2 - 1) * o.noise : 0;
    const open = x, close = x + o.step + noise;
    const hi = Math.max(open, close) + Math.abs(o.step) * 0.3 + 0.5;
    const lo = Math.min(open, close) - Math.abs(o.step) * 0.3 - 0.5;
    rows.push({ t: i * 900, o: open, h: hi, l: lo, c: close, v: 100 });
    x = close;
  }
  return rows;
}

/* ====================================================================
   § 1 pinegoldmath.js exposes the three new builders + the state-only helper
   ==================================================================== */
console.log('== 1) pinegoldmath.js carries three new record-layer builders and one state-only helper ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  assert(typeof W.pineGoldRangeFilter === 'function',     'pineGoldRangeFilter is exported');
  assert(typeof W.pineGoldNwEnvelope === 'function',      'pineGoldNwEnvelope is exported');
  assert(typeof W.pineGoldNwCenter === 'function',        'pineGoldNwCenter helper is exported');
  assert(Array.isArray(W.PINE_GOLD_STATE_ONLY_IDS),       'PINE_GOLD_STATE_ONLY_IDS is exported as an array');
  assert(W.PINE_GOLD_STATE_ONLY_IDS.length === 1 && W.PINE_GOLD_STATE_ONLY_IDS[0] === 'vumanchuCipher',
    'PINE_GOLD_STATE_ONLY_IDS carries exactly one entry: vumanchuCipher');
  /* HalfTrend uses the pinemath port directly (no gold wrapper, per hg-v949 one home) */
  assert(typeof W.pineHalfTrend === 'function',           'pineHalfTrend is reachable on W from pinemath.js');
}

/* ====================================================================
   § 2 PINE_GOLD_RECORD_LAYERS has 27 entries; the last three are our adds
   ==================================================================== */
console.log('== 2) PINE_GOLD_RECORD_LAYERS carries 27 entries with the hg-v1219 three at the end ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  const T = W.PINE_GOLD_RECORD_LAYERS;
  assert(T.length === 27, 'table has 27 entries after hg-v1219 (24 + 3 — ' + T.length + ')');
  const last3 = T.slice(-3);
  assert(last3[0].id === 'halftrend'   && last3[0].fn === 'pineHalfTrend'       && last3[0].twin === null, 'row 25: halftrend → pineHalfTrend, twin null');
  assert(last3[1].id === 'rangefilter' && last3[1].fn === 'pineGoldRangeFilter' && last3[1].twin === null, 'row 26: rangefilter → pineGoldRangeFilter, twin null');
  assert(last3[2].id === 'nwenvelope'  && last3[2].fn === 'pineGoldNwEnvelope'  && last3[2].twin === null, 'row 27: nwenvelope → pineGoldNwEnvelope, twin null');
  /* ensure PINE_GOLD_MAJORITY_IDS is UNCHANGED (hg-v1165 five-layer population) */
  const maj = W.PINE_GOLD_MAJORITY_IDS;
  assert(Array.isArray(maj) && maj.length === 5
    && maj[0] === 'supertrend' && maj[1] === 'ichimoku' && maj[2] === 'donchian'
    && maj[3] === 'emacross'   && maj[4] === 'keltner',
    'PINE_GOLD_MAJORITY_IDS unchanged — five hg-v1164 layers (' + maj.join(',') + ')');
  /* and no new entries are in it */
  assert(maj.indexOf('halftrend') < 0 && maj.indexOf('rangefilter') < 0 && maj.indexOf('nwenvelope') < 0 && maj.indexOf('vumanchuCipher') < 0,
    'new layers / state-only mark do NOT join the majority (hg-v1165)');
}

/* ====================================================================
   § 3 each new port fires LONG on a rising transition, SHORT on a mirror,
   and NOTHING on a dead-flat tape — the hg-v1164 shape
   ==================================================================== */
console.log('== 3) HalfTrend fires three-state on crafted tapes ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  /* a flat tape of 250 bars — HalfTrend's port needs atrLen + amplitude + 5 = 107 bars */
  const flat = craftTape({ n: 250, start: 2000, step: 0, noise: 0 });
  const resFlat = W.pineHalfTrend(flat, { amplitude: 2, atrLen: 100, atrMult: 2 });
  assert(resFlat === null || (!resFlat.newLong && !resFlat.newShort),
    'HalfTrend fires no flip event on a flat tape (' + JSON.stringify(resFlat && { nl: resFlat.newLong, ns: resFlat.newShort }) + ')');
  /* thin tape returns null */
  const thin = craftTape({ n: 50, start: 2000, step: 0.5 });
  assert(W.pineHalfTrend(thin, { amplitude: 2, atrLen: 100, atrMult: 2 }) === null, 'HalfTrend returns null on a thin tape (<atrLen+amplitude+5)');
  /* a steady rising tape produces trend = +1 (readable long state) */
  const rising = craftTape({ n: 250, start: 2000, step: 0.4, noise: 0 });
  const resRising = W.pineHalfTrend(rising, { amplitude: 2, atrLen: 100, atrMult: 2, includeContext: true });
  assert(resRising && resRising.trend === 1, 'HalfTrend reads trend +1 on a steady rising tape');
  const falling = craftTape({ n: 250, start: 2000, step: -0.4, noise: 0 });
  const resFalling = W.pineHalfTrend(falling, { amplitude: 2, atrLen: 100, atrMult: 2, includeContext: true });
  assert(resFalling && resFalling.trend === -1, 'HalfTrend reads trend -1 on a steady falling tape');
}

/* The wrappers read the pinemath ports via gfn → G[name], so §4 and §5
   drive the wrappers deterministically by STUBBING the port in the
   sandbox. This asserts the WRAPPER's own geometry (long: stop below
   entry; short: stop above) separately from the real port's firing
   conditions — which are tested §3 for HalfTrend and §5 (real tape)
   for NW envelope. The §4/§5 stub tests also catch a swap of the two
   branches, which the pure "port must fire" test cannot. */

console.log('== 4) Range Filter wrapper composes entry/stop/t1/t2 — stubbed port, both directions ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  /* stub the port: a LONG flip returns known values; the wrapper must
     compose entry=price, stop = filterLevel - rng, t1/t2 at 2R/3.5R */
  const originalRf = W.pineRangeFilter;
  W.pineRangeFilter = function(rows, opts){
    return { dir: 'long', newLong: true, newShort: false, trend: 1, prevTrend: -1,
             filterLevel: 1990, rng: 5, period: opts.period, mult: opts.mult, price: 2000 };
  };
  const long = W.pineGoldRangeFilter([{t:1,o:1,h:1,l:1,c:1,v:1}], { period: 100, mult: 3 });
  assert(long && long.dir === 'long',                                   'Range Filter LONG stub → wrapper dir=long');
  assert(long.entry === 2000,                                           'Range Filter LONG stub → entry = price');
  assert(long.stop  === 1990 - 5,                                       'Range Filter LONG stub → stop = filterLevel - rng (= 1985)');
  assert(long.stop < long.entry,                                        'Range Filter LONG stub → stop below entry');
  assert(long.t1 > long.entry && long.t2 > long.t1,                     'Range Filter LONG stub → t1/t2 above entry at 2R/3.5R');
  /* short mirror */
  W.pineRangeFilter = function(){
    return { dir: 'short', newLong: false, newShort: true, trend: -1, prevTrend: 1,
             filterLevel: 2010, rng: 5, period: 100, mult: 3, price: 2000 };
  };
  const short = W.pineGoldRangeFilter([{t:1,o:1,h:1,l:1,c:1,v:1}], { period: 100, mult: 3 });
  assert(short && short.dir === 'short',                                'Range Filter SHORT stub → wrapper dir=short');
  assert(short.entry === 2000,                                          'Range Filter SHORT stub → entry = price');
  assert(short.stop  === 2010 + 5,                                      'Range Filter SHORT stub → stop = filterLevel + rng (= 2015)');
  assert(short.stop > short.entry,                                      'Range Filter SHORT stub → stop above entry');
  assert(short.t1 < short.entry && short.t2 < short.t1,                 'Range Filter SHORT stub → t1/t2 below entry at 2R/3.5R');
  /* no-flip stub: wrapper returns {dir:null} */
  W.pineRangeFilter = function(){ return { dir: 'long', newLong: false, newShort: false, trend: 1, filterLevel: 1990, rng: 5, price: 2000 }; };
  assert(W.pineGoldRangeFilter([{t:1,o:1,h:1,l:1,c:1,v:1}], { period: 100, mult: 3 }).dir === null,
    'Range Filter stub with no flip (newLong/newShort both false) → wrapper {dir:null}');
  /* null-rng stub: wrapper returns {dir:null} (geometry would be invalid) */
  W.pineRangeFilter = function(){ return { dir: 'long', newLong: true, filterLevel: 1990, rng: null, price: 2000 }; };
  assert(W.pineGoldRangeFilter([{t:1,o:1,h:1,l:1,c:1,v:1}], { period: 100, mult: 3 }).dir === null,
    'Range Filter stub with null rng → wrapper refuses (geometry would be invalid)');
  /* missing port: wrapper fails closed */
  W.pineRangeFilter = null;
  assert(W.pineGoldRangeFilter([{t:1,o:1,h:1,l:1,c:1,v:1}], { period: 100, mult: 3 }).dir === null,
    'Range Filter wrapper fails closed when the port is absent');
  W.pineRangeFilter = originalRf;
  /* behavioural: a thin tape runs the real port and gets no signal */
  const thin = craftTape({ n: 80, start: 2000, step: 0.5 });
  assert(W.pineGoldRangeFilter(thin, { period: 100, mult: 3 }).dir === null, 'Range Filter wrapper returns no signal on a thin tape via the real port');
}

console.log('== 5) NW Envelope wrapper composes entry/stop/t1/t2 — stubbed port, both directions ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  const originalNw = W.pineNwEnvelope;
  /* long reversion: last bar wicked below the lower band, closed back inside */
  W.pineNwEnvelope = function(){
    return { dir: 'long', newLong: true, newShort: false, meanTarget: 2000, nwCenter: 2000,
             upper: 2010, lower: 1990, atr: 2, bandwidth: 8, mult: 2.5, lookback: 50, price: 2000 };
  };
  const long = W.pineGoldNwEnvelope([{t:1,o:1,h:1,l:1,c:1,v:1}], { bandwidth: 8, mult: 2.5, lookback: 50, atrLen: 100 });
  assert(long && long.dir === 'long',                                   'NW Envelope LONG stub → wrapper dir=long');
  assert(long.entry === 2000,                                           'NW Envelope LONG stub → entry = price');
  /* stop = lower - 0.15 * atr = 1990 - 0.3 = 1989.7 */
  assert(Math.abs(long.stop - (1990 - 0.3)) < 1e-6,                     'NW Envelope LONG stub → stop = lower - 0.15*atr');
  assert(long.stop < long.entry,                                        'NW Envelope LONG stub → stop below entry');
  assert(long.nwCenter === 2000,                                        'NW Envelope LONG stub → row carries nwCenter');
  /* short mirror */
  W.pineNwEnvelope = function(){
    return { dir: 'short', newLong: false, newShort: true, meanTarget: 2000, nwCenter: 2000,
             upper: 2010, lower: 1990, atr: 2, bandwidth: 8, mult: 2.5, lookback: 50, price: 2000 };
  };
  const short = W.pineGoldNwEnvelope([{t:1,o:1,h:1,l:1,c:1,v:1}], { bandwidth: 8, mult: 2.5, lookback: 50, atrLen: 100 });
  assert(short && short.dir === 'short',                                'NW Envelope SHORT stub → wrapper dir=short');
  /* stop = upper + 0.15 * atr = 2010 + 0.3 = 2010.3 */
  assert(Math.abs(short.stop - (2010 + 0.3)) < 1e-6,                    'NW Envelope SHORT stub → stop = upper + 0.15*atr');
  assert(short.stop > short.entry,                                      'NW Envelope SHORT stub → stop above entry');
  /* no-flip stub: wrapper returns {dir:null} */
  W.pineNwEnvelope = function(){ return { dir: 'long', newLong: false, newShort: false, lower: 1990, upper: 2010, atr: 2, nwCenter: 2000, price: 2000 }; };
  assert(W.pineGoldNwEnvelope([{t:1,o:1,h:1,l:1,c:1,v:1}], { bandwidth: 8, mult: 2.5, lookback: 50, atrLen: 100 }).dir === null,
    'NW Envelope stub with no flip → wrapper {dir:null}');
  /* zero-atr stub: wrapper refuses */
  W.pineNwEnvelope = function(){ return { dir: 'long', newLong: true, lower: 1990, upper: 2010, atr: 0, nwCenter: 2000, price: 2000 }; };
  assert(W.pineGoldNwEnvelope([{t:1,o:1,h:1,l:1,c:1,v:1}], { bandwidth: 8, mult: 2.5, lookback: 50, atrLen: 100 }).dir === null,
    'NW Envelope stub with zero atr → wrapper refuses');
  /* missing port: wrapper fails closed */
  W.pineNwEnvelope = null;
  assert(W.pineGoldNwEnvelope([{t:1,o:1,h:1,l:1,c:1,v:1}], { bandwidth: 8, mult: 2.5, lookback: 50, atrLen: 100 }).dir === null,
    'NW Envelope wrapper fails closed when the port is absent');
  W.pineNwEnvelope = originalNw;
  /* behavioural: a thin tape runs the real port and gets no signal */
  const thin = craftTape({ n: 80, start: 2000, step: 0 });
  assert(W.pineGoldNwEnvelope(thin, { bandwidth: 8, mult: 2.5, lookback: 50, atrLen: 100 }).dir === null,
    'NW Envelope wrapper returns no signal on a thin tape via the real port');
}

/* ====================================================================
   § 6 pineGoldNwCenter reads the kernel center as a continuous state
   ==================================================================== */
console.log('== 6) pineGoldNwCenter returns a finite number for a long-enough tape and NaN below the floor ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  const rows = craftTape({ n: 100, start: 2000, step: 0.1 });
  const nwC = W.pineGoldNwCenter(rows, 8, 50);
  assert(isFinite(nwC), 'pineGoldNwCenter returns a finite number on a 100-bar tape (' + nwC + ')');
  /* close to the last bar's close within a small envelope */
  const lastC = rows[rows.length - 1].c;
  assert(Math.abs(nwC - lastC) < 10, 'the kernel center sits near the recent closes (' + nwC + ' vs last ' + lastC + ')');
  /* thin tape */
  const thin = craftTape({ n: 20, start: 2000, step: 0.1 });
  assert(!isFinite(W.pineGoldNwCenter(thin, 8, 50)), 'pineGoldNwCenter returns NaN below the lookback floor');
  /* invalid bandwidth / lookback */
  assert(!isFinite(W.pineGoldNwCenter([], 8, 50)), 'pineGoldNwCenter returns NaN on an empty tape');
}

/* ====================================================================
   § 7 pineGoldLayerStates reads the four new states and the counts move
   ==================================================================== */
console.log('== 7) pineGoldLayerStates carries halftrend / rangefilter / nwenvelope / vumanchuCipher states ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  /* a steady rising tape must populate halftrend='long' AND rangefilter='long'
     via the port's own trend fields; nwenvelope reads via kernel center which
     tracks price so close > center → 'long' */
  const rising = craftTape({ n: 260, start: 2000, step: 0.3, noise: 0, seed: 1 });
  const stUp = W.pineGoldLayerStates(rising);
  assert(stUp && stUp.ok === true, 'states ok on a 260-bar rising tape');
  for (const k of ['halftrend', 'rangefilter', 'nwenvelope', 'vumanchuCipher']){
    assert(k in stUp, 'states carries field: ' + k);
    const v = stUp[k];
    assert(v === null || v === 'long' || v === 'short', k + ' is three-state: ' + v);
  }
  /* behavioural: halftrend and rangefilter MUST read 'long' on a steady rising
     tape (the port's trend field is unambiguous there) — if the state-read
     code was dropped the field reads null and this assertion fails */
  assert(stUp.halftrend === 'long',   'halftrend reads "long" on a steady rising tape (state-read code is live)');
  assert(stUp.rangefilter === 'long', 'rangefilter reads "long" on a steady rising tape (state-read code is live)');
  /* nwenvelope: close is above kernel center on a rising tape */
  assert(stUp.nwenvelope === 'long',  'nwenvelope reads "long" on a steady rising tape (close > kernel center)');
  /* mirror on a falling tape */
  const falling = craftTape({ n: 260, start: 2000, step: -0.3, noise: 0, seed: 1 });
  const stDown = W.pineGoldLayerStates(falling);
  assert(stDown.halftrend === 'short',   'halftrend reads "short" on a steady falling tape');
  assert(stDown.rangefilter === 'short', 'rangefilter reads "short" on a steady falling tape');
  assert(stDown.nwenvelope === 'short',  'nwenvelope reads "short" on a steady falling tape');
  /* readable is a non-negative number */
  assert(typeof stUp.readable === 'number' && stUp.readable >= 0, 'readable count is a non-negative number');
  /* vumanchu STRICT equality: a tape where WaveTrend sits exactly at osLevel
     reads NEITHER (not 'long'). We cannot force exact equality without
     mocking the port, so this is pinned textually (hg-v956): the state
     read uses strict `<` not `<=`. */
  const src = readFileSync('pinegoldmath.js', 'utf8');
  assert(/if \(wt < osL\) out\.vumanchuCipher = 'long';/.test(src),
    'vumanchuCipher uses strict `<` (not `<=`): equality reads NEITHER per hg-v989');
  assert(/else if \(wt > obL\) out\.vumanchuCipher = 'short';/.test(src),
    'vumanchuCipher uses strict `>` (not `>=`): equality reads NEITHER per hg-v989');
}

/* ====================================================================
   § 8 pineGoldPineMarks emits the four new keys on a plan's own direction
   ==================================================================== */
console.log('== 8) pineGoldPineMarks emits pine:halftrendWith, pine:rangefilterWith, pine:nwenvelopeWith, pine:vumanchuCipherWith ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  /* synthesize a states object with every new field set to 'long' */
  const states = { ok: true, agreeLong: 0, agreeShort: 0,
    halftrend: 'long', rangefilter: 'long', nwenvelope: 'long', vumanchuCipher: 'long' };
  const longMarks = W.pineGoldPineMarks(states, 'long');
  assert(longMarks['pine:halftrendWith']      === true, 'long state with long plan → pine:halftrendWith = true');
  assert(longMarks['pine:rangefilterWith']    === true, 'long state with long plan → pine:rangefilterWith = true');
  assert(longMarks['pine:nwenvelopeWith']     === true, 'long state with long plan → pine:nwenvelopeWith = true');
  assert(longMarks['pine:vumanchuCipherWith'] === true, 'long state with long plan → pine:vumanchuCipherWith = true');
  /* mirror on a short plan — each is AGAINST */
  const shortMarks = W.pineGoldPineMarks(states, 'short');
  assert(shortMarks['pine:halftrendWith']      === false, 'long state with short plan → pine:halftrendWith = false');
  assert(shortMarks['pine:rangefilterWith']    === false, 'long state with short plan → pine:rangefilterWith = false');
  assert(shortMarks['pine:nwenvelopeWith']     === false, 'long state with short plan → pine:nwenvelopeWith = false');
  assert(shortMarks['pine:vumanchuCipherWith'] === false, 'long state with short plan → pine:vumanchuCipherWith = false');
  /* null states → marks absent */
  const neutralStates = { ok: true, agreeLong: 0, agreeShort: 0,
    halftrend: null, rangefilter: null, nwenvelope: null, vumanchuCipher: null };
  const neutralMarks = W.pineGoldPineMarks(neutralStates, 'long');
  for (const k of ['pine:halftrendWith', 'pine:rangefilterWith', 'pine:nwenvelopeWith', 'pine:vumanchuCipherWith']){
    assert(!(k in neutralMarks), 'null state → ' + k + ' is absent on marks (hg-v989 three-state)');
  }
}

/* ====================================================================
   § 9 pineGoldStackLineHtml renders the new scored cells and the
   state-only VuManChu cell beside them
   ==================================================================== */
console.log('== 9) PINE STACK line renders the three new scored cells and one state-only VuManChu cell ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinegoldmath.js']);
  const states = { ok: true, agreeLong: 3, agreeShort: 0, readable: 4,
    halftrend: 'long', rangefilter: 'short', nwenvelope: 'long', vumanchuCipher: 'long',
    supertrend: 'long', ichimoku: 'long', donchian: 'long' };
  const marks = W.pineGoldPineMarks(states, 'long');
  const html = W.pineGoldStackLineHtml(states, marks);
  assert(html.indexOf('HalfTrend') >= 0,     'PINE STACK names the HalfTrend layer');
  assert(html.indexOf('Range Filter') >= 0,  'PINE STACK names the Range Filter layer');
  assert(html.indexOf('NW Envelope') >= 0,   'PINE STACK names the NW Envelope layer');
  assert(html.indexOf('VuManChu') >= 0,      'PINE STACK names the VuManChu state-only read');
  assert(html.indexOf('gsx-stateonly') >= 0, 'the state-only cell carries the gsx-stateonly class (shape difference)');
  assert(html.indexOf('of 27') >= 0,         'the "N of M" counter reads of 27 (the record-layer total; VuManChu is state-only)');
}

/* ====================================================================
   § 10 no gate module scores on a new mark
   ==================================================================== */
console.log('== 10) no gate module reads a new pine:halftrendWith / pine:rangefilterWith / pine:nwenvelopeWith / pine:vumanchuCipherWith ==');
{
  const files = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  const marks = ['halftrendWith', 'rangefilterWith', 'nwenvelopeWith', 'vumanchuCipherWith'];
  for (const f of files){
    const src = readFileSync(f, 'utf8');
    for (const k of marks){
      const dotted    = new RegExp('\\.\\s*pine:' + k + '\\b');
      const bracketed = new RegExp('\\[\\s*[\'"]pine:' + k + '[\'"]\\s*\\]');
      assert(!dotted.test(src) && !bracketed.test(src),
        f + ' names no pine:' + k + ' mark (hg-v956: a gate would read it on a reads bag)');
    }
  }
  /* also: no gold desk reads a new mark BACK — the ranker goldRankSetups
     does not read 'pine:halftrendWith' / etc. */
  const goldind = readFileSync('goldind.js', 'utf8');
  for (const k of marks){
    const re = new RegExp('[\'"]pine:' + k + '[\'"]');
    assert(!re.test(goldind), 'goldind.js does not read pine:' + k + ' back on the ranker side (hg-v956)');
  }
}

/* ====================================================================
   § 11 OMNIGOLD and GANESH GOLD mint no new mechanic — the registry is
   byte-identical in the twin-check seams
   ==================================================================== */
console.log('== 11) OMNIGOLD mints no new port (hg-v1167: registering widens the Šidák family bar) ==');
{
  const omni = readFileSync('omnigold.js', 'utf8');
  /* the hg-v1219 three new layers must NOT appear as new OMNIGOLD mechanic
     registrations — asserted textually since the registry is a long literal */
  for (const name of ['HALFTREND', 'RANGE-FILTER', 'NW-ENVELOPE', 'VUMANCHU-CIPHER', 'RANGEFILTER', 'NWENVELOPE']){
    const re = new RegExp("'" + name + "'");
    assert(!re.test(omni), 'OMNIGOLD does not register ' + name + ' as a new mechanic (hg-v1167)');
  }
}

/* ====================================================================
   § 12 ship stamps say hg-v1219
   ==================================================================== */
console.log('== 12) build stamps say hg-v1219 ==');
{
  const bs = readFileSync('build-stamp.js', 'utf8');
  assert(/version:\s*'hg-v1219'/.test(bs), 'build-stamp.js version is hg-v1219');
  const sw = readFileSync('sw.js', 'utf8');
  assert(/HG_CACHE\s*=\s*'hg-v1219'/.test(sw), 'sw.js HG_CACHE is hg-v1219');
  const tt = readFileSync('trendtable.js', 'utf8');
  assert(/hg-v1219/.test(tt), 'trendtable.js header reads hg-v1219');
  assert(/v=1219/.test(tt), 'trendtable.js loader cachebuster reads v=1219');
}

console.log('\nhg-v1219 twenty-seven gold Pine record layers (24 + 3) + one state-only mark: all § passed');
