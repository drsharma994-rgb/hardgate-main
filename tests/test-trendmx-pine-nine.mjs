#!/usr/bin/env node
/* HARDGATE hg-v1207: four more crypto Pine ports join TREND MATRIX's
   `trendmxPineMarks` as record-only three-state marks. VuManChu Cipher B,
   Range Filter, Nadaraya-Watson envelope and Weekly AVWAP are all defined
   in pinemath.js and were read by nothing on this desk; they ride the same
   record-only path as the hg-v1201 five.

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
   § 1 pinemath.js: all four target ports exist
   ==================================================================== */
console.log('== 1) pinemath.js exports VuManChu Cipher B, Range Filter, NW envelope, Weekly AVWAP ==');
{
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js']);
  assert(typeof W.pineVumanchuCipher === 'function', 'pineVumanchuCipher is exported');
  assert(typeof W.pineRangeFilter === 'function', 'pineRangeFilter is exported');
  assert(typeof W.pineNwEnvelope === 'function', 'pineNwEnvelope is exported');
  assert(typeof W.pineWeeklyAvwap === 'function', 'pineWeeklyAvwap is exported');
}

/* ====================================================================
   § 2 trendmxPineMarks (lifted from source, hg-v967: never export to test)
   returns 9 keys, each three-state; the four new ports are called
   ==================================================================== */
console.log('== 2) trendmxPineMarks reads all nine ports and each is three-state (long / short / null) ==');
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
  /* and the result lands on the right output key */
  assert(/out\.cipher\s*=/.test(body),   'trendmxPineMarks writes out.cipher');
  assert(/out\.rfilter\s*=/.test(body),  'trendmxPineMarks writes out.rfilter');
  assert(/out\.nwenv\s*=/.test(body),    'trendmxPineMarks writes out.nwenv');
  assert(/out\.wavwap\s*=/.test(body),   'trendmxPineMarks writes out.wavwap');
  const W = loadModules(['indicators.js', 'indicators2.js', 'pinemath.js', 'pinesmf.js', 'pinemsb.js', 'pinesqz.js']);
  /* lift the function into W's sandbox so its W.pineXxx references bind */
  vm.runInNewContext(match[0] + '\nG.trendmxPineMarks = trendmxPineMarks;', W, { filename: 'lifted-trendmxPineMarks' });
  assert(typeof W.trendmxPineMarks === 'function', 'lifted trendmxPineMarks runs in sandbox');
  /* a thin tape (< 30 bars) returns all nine keys as null — the bar
     floor is 30, so a tape of 29 rows must also return all nulls */
  const expected = ['lor', 'ht', 'sqz', 'smf', 'msb', 'cipher', 'rfilter', 'nwenv', 'wavwap'];
  for (const n of [5, 10, 29]){
    const thin = Array.from({length: n}, (_, i) => ({t: i*14400, o: 100 + i*0.1, h: 100.5 + i*0.1, l: 99.5 + i*0.1, c: 100 + i*0.1, v: 100}));
    const out = W.trendmxPineMarks(thin);
    assert(out && expected.every(k => out[k] === null),
      'a thin tape of ' + n + ' bars returns all nine keys as null — hg-v989 three-state, 30-bar floor');
  }
  /* an empty / non-array returns the same nine keys as null, never throws */
  const outEmpty = W.trendmxPineMarks([]);
  assert(outEmpty && expected.every(k => outEmpty[k] === null), 'empty rows returns all nine keys as null, never a throw');
  const outNull = W.trendmxPineMarks(null);
  assert(outNull && expected.every(k => outNull[k] === null), 'null rows returns all nine keys as null, never a throw');
  /* every expected key is present on the output shape (hg-v955: a field nothing writes is ornamental) */
  const outKeys = Object.keys(outEmpty || {}).sort().join(',');
  assert(outKeys === expected.slice().sort().join(','),
    'output shape carries exactly the nine keys (' + outKeys + ')');
}

/* ====================================================================
   § 3 every mark is one of the three states on a real tape
   ==================================================================== */
console.log('== 3) each of the nine marks reads long / short / null on a real tape ==');
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
  const expected = ['lor', 'ht', 'sqz', 'smf', 'msb', 'cipher', 'rfilter', 'nwenv', 'wavwap'];
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
  for (const [name, out] of [['pineVumanchuCipher', vc], ['pineRangeFilter', rf], ['pineNwEnvelope', nw], ['pineWeeklyAvwap', wv]]){
    assert(out === null || (out && (out.dir === 'long' || out.dir === 'short')),
      name + ' returns null or {dir: long/short} on a real tape (hg-v989 three-state at the port)');
  }
}

/* ====================================================================
   § 4 the nine marks ride each record as reads.pineXxx
   ==================================================================== */
console.log('== 4) each record carries nine pine: marks under reads.pineXxx ==');
{
  const src = readFileSync('trendtable.combined.js', 'utf8');
  for (const k of ['pineLorKnn', 'pineHalfTrend', 'pineSqueeze', 'pineSmf', 'pineMsb', 'pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap']){
    assert(src.indexOf('reads.' + k + ' = pm.') >= 0, 'reads.' + k + ' is set on every record from pm');
  }
}

/* ====================================================================
   § 5 the TECHNICAL card line prints each new mark beside the five
   ==================================================================== */
console.log('== 5) crown TECHNICAL card line prints the four new marks ==');
{
  const src = readFileSync('trendtable.combined.js', 'utf8');
  for (const k of ['pineLorKnn', 'pineHalfTrend', 'pineSqueeze', 'pineSmf', 'pineMsb', 'pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap']){
    assert(src.indexOf('pfR.' + k) >= 0, 'the TECHNICAL guard reads pfR.' + k);
  }
  assert(/pineBits\.push\('cipher '/.test(src), 'the TECHNICAL line names the Cipher mark as "cipher"');
  assert(/pineBits\.push\('range '/.test(src), 'the TECHNICAL line names the Range Filter mark as "range"');
  assert(/pineBits\.push\('NW '/.test(src), 'the TECHNICAL line names the NW Envelope mark as "NW"');
  assert(/pineBits\.push\('wAVWAP '/.test(src), 'the TECHNICAL line names the Weekly AVWAP mark as "wAVWAP"');
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
console.log('== 6) no gate module reads a new pineCipher/pineRangeFilter/pineNwEnvelope/pineWavwap record mark ==');
{
  const gates = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  const marks = ['pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap'];
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
  }
}

/* ====================================================================
   § 7 ship stamps
   ==================================================================== */
console.log('== 7) build stamps say hg-v1218 ==');
{
  const bs = readFileSync('build-stamp.js', 'utf8');
  assert(/version:\s*'hg-v1218'/.test(bs), 'build-stamp.js version is hg-v1218');
  const sw = readFileSync('sw.js', 'utf8');
  assert(/HG_CACHE\s*=\s*'hg-v1218'/.test(sw), 'sw.js HG_CACHE is hg-v1218');
  const tt = readFileSync('trendtable.js', 'utf8');
  assert(/hg-v1218/.test(tt), 'trendtable.js header reads hg-v1218');
  assert(/v=1218/.test(tt), 'trendtable.js loader cachebuster reads v=1218');
}

/* ====================================================================
   § 8 the two parts files (served to the browser) carry the same four
   new reads and TECHNICAL pushes as the combined file (hg-v1160's
   parts==combined invariant lives in test-trendmx-replay-harness §6;
   this re-pins the hg-v1205 adds locally so the guard is self-contained)
   ==================================================================== */
console.log('== 8) parts files served to the browser carry the four new reads and TECHNICAL pushes ==');
{
  const parts = [
    { name: 'trendtable-src-9.js',  readsBody: false, bits: true,  calls: true  },
    { name: 'trendtable-src-10.js', readsBody: true,  bits: false, calls: false },
  ];
  for (const p of parts){
    const src = readFileSync(p.name, 'utf8');
    if (p.calls){
      /* src9 holds trendmxPineMarks and the TECHNICAL block */
      for (const port of ['pineVumanchuCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWeeklyAvwap']){
        assert(src.indexOf('W.' + port) >= 0, p.name + ' calls W.' + port);
      }
    }
    if (p.bits){
      assert(/pineBits\.push\('cipher '/.test(src),  p.name + ' TECHNICAL line pushes cipher');
      assert(/pineBits\.push\('range '/.test(src),   p.name + ' TECHNICAL line pushes range');
      assert(/pineBits\.push\('NW '/.test(src),      p.name + ' TECHNICAL line pushes NW');
      assert(/pineBits\.push\('wAVWAP '/.test(src),  p.name + ' TECHNICAL line pushes wAVWAP');
    }
    if (p.readsBody){
      /* src10 holds the record attachment */
      for (const k of ['pineCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWavwap']){
        assert(src.indexOf('reads.' + k + ' = pm.') >= 0, p.name + ' sets reads.' + k + ' on every record');
      }
    }
  }
}

console.log('\nhg-v1207 TREND MATRIX nine Pine marks: all § passed');
