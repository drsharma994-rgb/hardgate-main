#!/usr/bin/env node
/* HARDGATE hg-v1295: three more crypto Pine ports join TREND MATRIX's
   `trendmxPineMarks` as record-only three-state marks on top of the
   hg-v1207 nine. Supertrend (ATR-band trend flip, DIFFERENT from
   HalfTrend's amplitude-pivot flip), MACD (signal-line cross, DIFFERENT
   from Squeeze's BB-in-KC release) and CCI re-entry (overbought/oversold
   mean-reversion, DIFFERENT from Cipher's WaveTrend). All three are
   defined in pinemath.js and were read by nothing on this desk until
   this pack; they ride the same record-only path as the hg-v1207 nine.

   Doctrine (hg-v966 / hg-v987 / v945 / v922): no new weight pays. The
   marks enter three-state (long / short / null, hg-v989) so the forward
   ledger can ask, out of sample, whether each separates on this desk's
   own population. Nothing gates on them, no threshold moves, no setup
   leaves any board. */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function assert(cond, msg){ if (!cond){ console.log('ASSERT ' + msg); process.exit(1); } console.log('ok  ' + msg); }

function loadModules(files){
  const sb = { console, Date, Math, JSON, Object, Array, Promise, isFinite, isNaN, parseInt, parseFloat, Error, TypeError };
  sb.window = sb; sb.self = sb; sb.G = sb; sb.W = sb;
  for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  return sb;
}

/* ====================================================================
   § 1 pinemath.js: all seven target ports exist (four hg-v1207 + three hg-v1295)
   ==================================================================== */
console.log('== 1) pinemath.js exports VuManChu Cipher B, Range Filter, NW envelope, Weekly AVWAP, Supertrend, MACD, CCI ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js']);
  assert(typeof W.pineVumanchuCipher === 'function', 'pineVumanchuCipher is exported');
  assert(typeof W.pineRangeFilter === 'function', 'pineRangeFilter is exported');
  assert(typeof W.pineNwEnvelope === 'function', 'pineNwEnvelope is exported');
  assert(typeof W.pineWeeklyAvwap === 'function', 'pineWeeklyAvwap is exported');
  /* hg-v1295 */
  assert(typeof W.pineSupertrend === 'function', 'pineSupertrend is exported (hg-v1295)');
  assert(typeof W.pineMacd === 'function', 'pineMacd is exported (hg-v1295)');
  assert(typeof W.pineCci === 'function', 'pineCci is exported (hg-v1295)');
}

/* ====================================================================
   § 2 trendmxPineMarks (lifted from source, hg-v967: never export to test)
   returns 13 keys, each three-state; the seven new ports are called
   ==================================================================== */
console.log('== 2) trendmxPineMarks reads all thirteen ports and each is three-state (long / short / null) ==');
{
  const src = readFileSync('trendtable.combined.js', 'utf8');
  const match = src.match(/function trendmxPineMarks\(rows\)\{[\s\S]*?^\}/m);
  assert(!!match, 'trendmxPineMarks body is readable in source (hg-v1022 lift, hg-v967 refuses to export)');
  /* each new port's call site is textually present (behavioural §3 cannot
     tell a dropped port call from a tape that did not flip the port —
     both leave the key null — so the call sites are pinned here) */
  const body = match[0];
  /* the 30-bar floor is textually pinned (hg-v956): behavioural §2
     cannot tell < 30 from < 1 because every port has its own
     thin-tape null fail, so the floor is here as the intent — "do
     not even ask on tapes too thin to be useful" */
  assert(/rows\.length\s*<\s*30\b/.test(body), 'trendmxPineMarks keeps the 30-bar floor (hg-v956 textual)');
  assert(/W\.pineVumanchuCipher\s*\(/.test(body), 'trendmxPineMarks calls W.pineVumanchuCipher');
  assert(/W\.pineRangeFilter\s*\(/.test(body),    'trendmxPineMarks calls W.pineRangeFilter');
  assert(/W\.pineNwEnvelope\s*\(/.test(body),     'trendmxPineMarks calls W.pineNwEnvelope');
  assert(/W\.pineWeeklyAvwap\s*\(/.test(body),    'trendmxPineMarks calls W.pineWeeklyAvwap');
  assert(/W\.pineSmcCore\s*\(/.test(body),          'trendmxPineMarks calls W.pineSmcCore');
  /* hg-v1295: three more port call sites */
  assert(/W\.pineSupertrend\s*\(/.test(body), 'trendmxPineMarks calls W.pineSupertrend (hg-v1295)');
  assert(/W\.pineMacd\s*\(/.test(body),       'trendmxPineMarks calls W.pineMacd (hg-v1295)');
  assert(/W\.pineCci\s*\(/.test(body),        'trendmxPineMarks calls W.pineCci (hg-v1295)');
  /* and the result lands on the right output key */
  assert(/out\.cipher\s*=/.test(body),   'trendmxPineMarks writes out.cipher');
  assert(/out\.rfilter\s*=/.test(body),  'trendmxPineMarks writes out.rfilter');
  assert(/out\.nwenv\s*=/.test(body),    'trendmxPineMarks writes out.nwenv');
  assert(/out\.wavwap\s*=/.test(body),   'trendmxPineMarks writes out.wavwap');
  assert(/out\.smc\s*=/.test(body),        'trendmxPineMarks writes out.smc');
  /* hg-v1295: three more output keys */
  assert(/out\.supertrend\s*=/.test(body), 'trendmxPineMarks writes out.supertrend (hg-v1295)');
  assert(/out\.macd\s*=/.test(body),       'trendmxPineMarks writes out.macd (hg-v1295)');
  assert(/out\.cci\s*=/.test(body),        'trendmxPineMarks writes out.cci (hg-v1295)');
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinesmf.js', 'pinemsb.js', 'pinesqz.js']);
  /* lift the function into W's sandbox so its W.pineXxx references bind */
  vm.runInNewContext(match[0] + '\nG.trendmxPineMarks = trendmxPineMarks;', W, { filename: 'lifted-trendmxPineMarks' });
  assert(typeof W.trendmxPineMarks === 'function', 'lifted trendmxPineMarks runs in sandbox');
  /* a thin tape (< 30 bars) returns all thirteen keys as null — the bar
     floor is 30, so a tape of 29 rows must also return all nulls */
  const expected = ['lor', 'ht', 'sqz', 'smf', 'msb', 'cipher', 'rfilter', 'nwenv', 'wavwap', 'smc', 'supertrend', 'macd', 'cci'];
  for (const n of [5, 10, 29]){
    const thin = Array.from({length: n}, (_, i) => ({t: i*14400, o: 100 + i*0.1, h: 100.5 + i*0.1, l: 99.5 + i*0.1, c: 100 + i*0.1, v: 100}));
    const out = W.trendmxPineMarks(thin);
    assert(out && expected.every(k => out[k] === null),
      'a thin tape of ' + n + ' bars returns all thirteen keys as null — hg-v989 three-state, 30-bar floor');
  }
  /* an empty / non-array returns the same thirteen keys as null, never throws */
  const outEmpty = W.trendmxPineMarks([]);
  assert(outEmpty && expected.every(k => outEmpty[k] === null), 'empty rows returns all thirteen keys as null, never a throw');
  const outNull = W.trendmxPineMarks(null);
  assert(outNull && expected.every(k => outNull[k] === null), 'null rows returns all thirteen keys as null, never a throw');
  /* every expected key is present on the output shape (hg-v955: a field nothing writes is ornamental) */
  const outKeys = Object.keys(outEmpty || {}).sort().join(',');
  assert(outKeys === expected.slice().sort().join(','),
    'output shape carries exactly the thirteen keys (' + outKeys + ')');
}

/* ====================================================================
   § 3 every mark is one of the three states on a real tape
   ==================================================================== */
console.log('== 3) each of the thirteen marks reads long / short / null on a real tape ==');
{
  const src = readFileSync('trendtable.combined.js', 'utf8');
  const match = src.match(/function trendmxPineMarks\(rows\)\{[\s\S]*?^\}/m);
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinesmf.js', 'pinemsb.js', 'pinesqz.js']);
  vm.runInNewContext(match[0] + '\nG.trendmxPineMarks = trendmxPineMarks;', W, { filename: 'lifted-trendmxPineMarks-3' });
  /* a 300-bar rising tape */
  const rising = [];
  let x = 100;
  for (let i = 0; i < 300; i++){
    const noise = ((i * 7) % 11) * 0.05 - 0.25;
    const o = x, c = x + 0.5 + noise, h = Math.max(o, c) + 0.3, l = Math.min(o, c) - 0.3;
    rising.push({t: i*14400, o, h, l, c, v: 100});
    x = c;
  }
  const marks = W.trendmxPineMarks(rising);
  const expected = ['lor', 'ht', 'sqz', 'smf', 'msb', 'cipher', 'rfilter', 'nwenv', 'wavwap', 'smc', 'supertrend', 'macd', 'cci'];
  for (const k of expected){
    const v = marks[k];
    assert(v === null || v === 'long' || v === 'short',
      k + ' reads one of the three states (' + String(v) + ')');
  }
  /* each new port is driven directly on W (ports ARE on W from pinemath.js);
     this proves §2's integration points carry the behavioural guard the
     lifted function wraps around. */
  const vc = W.pineVumanchuCipher(rising, {});
  const rf = W.pineRangeFilter(rising, { includeContext: true });
  const nw = W.pineNwEnvelope(rising, {});
  const wv = W.pineWeeklyAvwap(rising, {});
  /* hg-v1295: three more ports driven directly */
  const st = W.pineSupertrend(rising, {});
  const md = W.pineMacd(rising, {});
  const cc = W.pineCci(rising, {});
  for (const [name, out] of [['pineVumanchuCipher', vc], ['pineRangeFilter', rf], ['pineNwEnvelope', nw], ['pineWeeklyAvwap', wv], ['pineSupertrend', st], ['pineMacd', md], ['pineCci', cc]]){
    assert(out === null || (out && (out.dir === 'long' || out.dir === 'short' || out.dir === null)),
      name + ' returns null or {dir: long/short/null} on a real tape (hg-v989 three-state at the port)');
  }
}

/* ====================================================================
   § 3b behavioural: craft tapes that force each new port's exact flip
   on the LAST CLOSED BAR (not an earlier one). This proves the three
   new ports fire on the dir states they are supposed to, not merely
   return null on everything.
   ==================================================================== */
console.log('== 3b) new ports fire on crafted last-bar flips ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js']);

  /* Supertrend flip LONG: 40 bars down, then one monster up bar */
  const stRows = [];
  let x = 100;
  for (let i = 0; i < 40; i++){
    const o = x, c = x - 1.0;
    stRows.push({t: i*14400, o, h: o + 0.1, l: c - 0.1, c, v: 1});
    x = c;
  }
  stRows.push({t: 40*14400, o: x, h: x + 8, l: x - 0.5, c: x + 8, v: 1});
  const stOut = W.pineSupertrend(stRows, {});
  assert(stOut && stOut.dir === 'long', 'pineSupertrend fires LONG on the trend-flip tape');

  /* MACD cross LONG: steady decline then one monster-up bar */
  const mdRows = [];
  let x2 = 1000;
  for (let i = 0; i < 60; i++){
    const o = x2, c = x2 - 5;
    mdRows.push({t: i*14400, o, h: o + 0.5, l: c - 0.5, c, v: 100});
    x2 = c;
  }
  mdRows.push({t: 60*14400, o: x2, h: x2 + 60, l: x2 - 1, c: x2 + 50, v: 100});
  const mdOut = W.pineMacd(mdRows, {});
  assert(mdOut && mdOut.dir === 'long', 'pineMacd fires LONG on the cross tape');

  /* CCI re-entry LONG: push CCI below -100 then back inside on last bar */
  const cciRows = [];
  let x3 = 100;
  for (let i = 0; i < 40; i++) cciRows.push({t: i*14400, o: x3, h: x3 + 0.1, l: x3 - 0.1, c: x3, v: 1});
  for (let i = 40; i < 55; i++){
    const o = x3, c = x3 - 1.5;
    cciRows.push({t: i*14400, o, h: o + 0.1, l: c - 0.1, c, v: 1});
    x3 = c;
  }
  /* big bounce back on last bar */
  cciRows.push({t: 55*14400, o: x3, h: x3 + 16, l: x3 - 0.1, c: x3 + 15, v: 1});
  const ccOut = W.pineCci(cciRows, {});
  assert(ccOut && ccOut.dir === 'long', 'pineCci fires LONG on re-entry from oversold');
}

/* ====================================================================
   § 4 the thirteen marks ride each record as reads.pineXxx
   ==================================================================== */
console.log('== 4) each record carries thirteen pine: marks under reads.pineXxx ==');
{
  const src = readFileSync('trendtable.combined.js', 'utf8');
  for (const k of ['pineLorKnn', 'pineHalfTrend', 'pineSqueeze', 'pineSmf', 'pineMsb', 'pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap', 'pineSupertrend', 'pineMacd', 'pineCci']){
    assert(src.indexOf('reads.' + k + ' = pm.') >= 0, 'reads.' + k + ' is set on every record from pm');
  }
}

/* ====================================================================
   § 5 the TECHNICAL card line prints each new mark beside the originals
   ==================================================================== */
console.log('== 5) crown TECHNICAL card line prints the seven new marks ==');
{
  const src = readFileSync('trendtable.combined.js', 'utf8');
  for (const k of ['pineLorKnn', 'pineHalfTrend', 'pineSqueeze', 'pineSmf', 'pineMsb', 'pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap', 'pineSupertrend', 'pineMacd', 'pineCci']){
    assert(src.indexOf('pfR.' + k) >= 0, 'the TECHNICAL guard reads pfR.' + k);
  }
  assert(/pineBits\.push\('cipher '/.test(src), 'the TECHNICAL line names the Cipher mark as "cipher"');
  assert(/pineBits\.push\('range '/.test(src), 'the TECHNICAL line names the Range Filter mark as "range"');
  assert(/pineBits\.push\('NW '/.test(src), 'the TECHNICAL line names the NW Envelope mark as "NW"');
  assert(/pineBits\.push\('wAVWAP '/.test(src), 'the TECHNICAL line names the Weekly AVWAP mark as "wAVWAP"');
  /* hg-v1295 */
  assert(/pineBits\.push\('supertrend '/.test(src), 'the TECHNICAL line names the Supertrend mark (hg-v1295)');
  assert(/pineBits\.push\('MACD '/.test(src),       'the TECHNICAL line names the MACD mark (hg-v1295)');
  assert(/pineBits\.push\('CCI '/.test(src),        'the TECHNICAL line names the CCI mark (hg-v1295)');
}

/* ====================================================================
   § 6 no gate module scores on a new mark
   contract-report.js is NOT a gate — its `pineRows` is a public census
   that calls every Pine port directly on W (SMC Core, MSB, Half Trend,
   Squeeze, Range Filter, NW, Cipher, SMF, wAVWAP, Lorentzian — the ten
   that exist). It reads the PORT, not the TREND MATRIX record mark, so
   it would false-positive on a bare textual check. The gate-vs-report
   distinction is the finding: the four new keys are the record MARKS
   `reads.pineCipher` / `reads.pineRangeFilter` / `reads.pineNwEnvelope`
   / `reads.pineWavwap`, so a gate reader would access them as
   `.pineCipher` / `['pineCipher']` on a reads bag.
   ==================================================================== */
console.log('== 6) no gate module reads a new pineCipher/pineRangeFilter/pineNwEnvelope/pineWavwap/pineSupertrend/pineMacd/pineCci record mark ==');
{
  const gates = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  const marks = ['pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap', 'pineSupertrend', 'pineMacd', 'pineCci'];
  for (const f of gates){
    const src = readFileSync(f, 'utf8');
    for (const k of marks){
      /* catch any dotted or bracketed read of the mark key — a gate that
         scores on this would read reads.pineXxx or reads['pineXxx']. */
      const dotted = new RegExp('\\.\\s*' + k + '\\b');
      const bracketed = new RegExp('\\[\\s*[\'"]' + k + '[\'"]\\s*\\]');
      assert(!dotted.test(src) && !bracketed.test(src),
        f + ' names no ' + k + ' mark (hg-v956: a gate would access it on a reads bag)');
    }
  }
  /* contract-report.js is a port reader (not a gate), so it is checked
     separately: it may name the ports (SMC Core / MSB / etc, same shape)
     but it must not consume the TREND MATRIX record MARKS. */
  {
    const src = readFileSync('contract-report.js', 'utf8');
    for (const k of marks){
      const dotted = new RegExp('\\.\\s*' + k + '\\b');
      const bracketed = new RegExp('\\[\\s*[\'"]' + k + '[\'"]\\s*\\]');
      assert(!dotted.test(src) && !bracketed.test(src),
        'contract-report.js consumes no ' + k + ' TREND MATRIX record mark');
    }
    /* the port strings SHOULD appear once each in the PINE census table,
       exactly as the hg-v1201 five do — if they did not, the public
       census would stop reporting the four new ports. */
    for (const port of ['pineRangeFilter', 'pineNwEnvelope', 'pineVumanchuCipher', 'pineWeeklyAvwap']){
      assert(src.indexOf(port) >= 0, 'contract-report.js PINE census names the ' + port + ' port (public reader, not a gate)');
    }
    /* hg-v1295: the contract-report may add the three new ports when a
       future pack extends its census — this guard checks the census is
       NOT a gate, not that the census must list the new ports yet. */
  }
}

/* ====================================================================
   § 7 ship stamps
   ==================================================================== */
console.log('== 7) build stamps are version-agnostic (reads build-stamp as the source of truth) ==');
{
  /* hg-v1289: this guard used to hardcode hg-v1287 by text — the hg-v956
     textual-pin failure, which turned every subsequent release red (hg-v1291
     already shipped past it). The shared `tests/helpers/build-version.mjs`
     exists for exactly this: ONE place reads build-stamp.js so a pack bump
     costs one edit, not thirty. The invariant this test actually guards is
     that sw.js, trendtable.js and the cachebuster all AGREE with
     build-stamp.js — not that any of them equals a fixed string. */
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  assert(/^hg-v\d+/.test(HG_VER), 'build-stamp.js has a readable version (' + HG_VER + ')');
  const sw = readFileSync('sw.js', 'utf8');
  assert(swCacheOk(sw), 'sw.js HG_CACHE matches build-stamp (' + HG_VER + ')');
  const tt = readFileSync('trendtable.js', 'utf8');
  assert(new RegExp(HG_VER).test(tt), 'trendtable.js header reads ' + HG_VER);
  const verDigits = HG_VER.replace(/^hg-v/, '');
  assert(new RegExp('v=' + verDigits).test(tt), 'trendtable.js loader cachebuster reads v=' + verDigits);
}

/* ====================================================================
   § 8 the two parts files (served to the browser) carry the same four
   new reads and TECHNICAL pushes as the combined file (hg-v1160's
   parts==combined invariant lives in test-trendmx-replay-harness §6;
   this re-pins the hg-v1205 adds locally so the guard is self-contained)
   ==================================================================== */
console.log('== 8) parts files served to the browser carry the seven new reads and TECHNICAL pushes ==');
{
  const parts = [
    { name: 'trendtable-src-9.js',  readsBody: false, bits: true,  calls: true  },
    { name: 'trendtable-src-10.js', readsBody: true,  bits: false, calls: false },
  ];
  for (const p of parts){
    const src = readFileSync(p.name, 'utf8');
    if (p.calls){
      /* src9 holds trendmxPineMarks and the TECHNICAL block */
      for (const port of ['pineVumanchuCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWeeklyAvwap', 'pineSupertrend', 'pineMacd', 'pineCci']){
        assert(src.indexOf('W.' + port) >= 0, p.name + ' calls W.' + port);
      }
    }
    if (p.bits){
      assert(/pineBits\.push\('cipher '/.test(src),  p.name + ' TECHNICAL line pushes cipher');
      assert(/pineBits\.push\('range '/.test(src),   p.name + ' TECHNICAL line pushes range');
      assert(/pineBits\.push\('NW '/.test(src),      p.name + ' TECHNICAL line pushes NW');
      assert(/pineBits\.push\('wAVWAP '/.test(src),  p.name + ' TECHNICAL line pushes wAVWAP');
      /* hg-v1295 */
      assert(/pineBits\.push\('supertrend '/.test(src), p.name + ' TECHNICAL line pushes supertrend');
      assert(/pineBits\.push\('MACD '/.test(src),       p.name + ' TECHNICAL line pushes MACD');
      assert(/pineBits\.push\('CCI '/.test(src),        p.name + ' TECHNICAL line pushes CCI');
    }
    if (p.readsBody){
      /* src10 holds the record attachment */
      for (const k of ['pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap', 'pineSupertrend', 'pineMacd', 'pineCci']){
        assert(src.indexOf('reads.' + k + ' = pm.') >= 0, p.name + ' sets reads.' + k + ' on every record');
      }
    }
  }
}

console.log('\nhg-v1295 TREND MATRIX thirteen Pine marks: all § passed');
