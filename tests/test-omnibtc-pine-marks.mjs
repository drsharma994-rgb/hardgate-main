#!/usr/bin/env node
/* hg-v1293: OMNIBTC carries record-only three-state Pine marks through the
   ONE HOME trendmxPineMarks (hg-v949). Beside the hg-v1291/v1292 freshness
   gates (which read newLong/barsAgo to fire): these record the final sign
   so the hg-v1065 PERFECT COHORT SPLIT and hg-v989 read-split can measure,
   out of sample, which Pine port actually paid. No new weight; no gate
   reads the ten pine* keys. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
function ok(cond, label){
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.log('  FAIL —', label); }
}
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/* same stripComments the hg-v986 census (test-crypto-funding-mark) uses:
   the real census strips comments before matching `entry:`, so any guard
   that asserts the census window must do the same (a comment containing
   `entry:` would mislead both the guard and the census, hence hg-v986's
   own named variable). */
function stripComments(src){
  return String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

function boot(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){} },
    documentElement: { appendChild(){} }, addEventListener(){}
  };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function bars(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    rows.push({ t: 1700000000 + i * 14400, o: 100, h: 104, l: 96, c: 100 + (i % 3), v: 10 });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
console.log('== 1) the one home is exported in both combined and src-11 (parts invariant) ==');
{
  const combined = read('trendtable.combined.js');
  const src11 = read('trendtable-src-11.js');
  ok(/W\.trendmxPineMarks\s*=\s*trendmxPineMarks\s*;/.test(combined),
    'trendtable.combined.js exports W.trendmxPineMarks');
  ok(/W\.trendmxPineMarks\s*=\s*trendmxPineMarks\s*;/.test(src11),
    'trendtable-src-11.js exports the same (parts invariant hg-v1160)');
  ok(/function\s+trendmxPineMarks\s*\(/.test(combined),
    'the home function trendmxPineMarks(...) still lives in trendtable.combined.js');
  const parts = src11.match(/W\.trendmxPineMarks\s*=/g);
  ok(parts && parts.length === 1, 'exactly one export line in src-11 (no duplicate)');
}

/* ------------------------------------------------------------------ */
console.log('== 2) hgObtcPineMarks delegates to the ONE home — no second port definition ==');
{
  const src = read('omnibtc.js');
  ok(/function\s+hgObtcPineMarks\s*\(\s*rows\s*\)/.test(src),
    'hgObtcPineMarks(rows) defined in omnibtc.js');
  ok(/W\s*&&\s*typeof\s+W\.trendmxPineMarks\s*===\s*['"]function['"]/.test(src),
    'the helper looks up W.trendmxPineMarks through a typeof guard (hg-v949 one home)');
  const second = [
    'pineLorentzianKernel', 'pineHalfTrend', 'pineSqueezeMomentum',
    'pineSmartMoneyFlow', 'pineMsbOb', 'pineSmcCore',
    'pineVumanchuCipher', 'pineRangeFilter', 'pineNwEnvelope', 'pineWeeklyAvwap'
  ];
  /* their hg-v1291/v1292 gates (hgObtcPineBook) ARE allowed to call pine*
     functions directly for freshness. this record-only helper may not —
     a second port read on the same tape in the same file would be the
     hg-v949 trap. the gates sit in a different helper and the guard
     checks that hgObtcPineMarks reaches only W.trendmxPineMarks. */
  const marksBlockMatch = src.match(/function\s+hgObtcPineMarks\s*\(\s*rows\s*\)\s*\{[^]*?^\s{2}\}/m);
  ok(marksBlockMatch, 'hgObtcPineMarks body isolated for a direct-port sweep');
  if (marksBlockMatch){
    const body = marksBlockMatch[0];
    let anyDirect = false;
    for (const name of second){
      if (new RegExp('\\b' + name + '\\b').test(body)){ anyDirect = true; break; }
    }
    ok(!anyDirect, 'the helper names no Pine port directly (it delegates)');
  }
}

/* ------------------------------------------------------------------ */
console.log('== 3) driven behaviour: delegation, three-state marks, thin-tape null ==');
{
  const W = boot();
  ok(typeof W.hgObtcPineMarks === 'function', 'hgObtcPineMarks is exported on W');
  ok(typeof W.hgObtcPineStamp === 'function', 'hgObtcPineStamp is exported on W');
  ok(Array.isArray(W.HG_OBTC_PINE_FIELDS), 'HG_OBTC_PINE_FIELDS is exported on W');

  /* no home at all → null, never a guessed sign */
  ok(W.hgObtcPineMarks(bars(300)) === null,
    'absent W.trendmxPineMarks → hgObtcPineMarks returns null (fail-open, nothing invented)');

  /* home present → delegates */
  const seen = { called: 0, lastRows: null };
  W.trendmxPineMarks = function(rows){
    seen.called++;
    seen.lastRows = rows;
    return { lor: 'long', ht: 'short', sqz: 'long', smf: null,
             msb: 'long', smc: 'short', cipher: null, rfilter: 'short',
             nwenv: 'long', wavwap: null };
  };
  const pm = W.hgObtcPineMarks(bars(300));
  ok(seen.called === 1, 'home called exactly once per helper call');
  ok(seen.lastRows && seen.lastRows.length === 300, 'home receives the same rows handed in');
  ok(pm && typeof pm === 'object', 'the mark bag is a plain object');
  ok(pm.lor === 'long' && pm.ht === 'short' && pm.sqz === 'long',
    'long/short reads pass through unchanged');
  ok(pm.smf === null && pm.cipher === null && pm.wavwap === null,
    'a null port stays null (hg-v989: absent is NOT MEASURED)');

  /* thin tape → null (30-bar floor) */
  const before = seen.called;
  ok(W.hgObtcPineMarks(bars(29)) === null, '29 rows is under the 30-bar floor → null');
  ok(W.hgObtcPineMarks(bars(0)) === null, 'empty array → null');
  ok(W.hgObtcPineMarks(null) === null, 'null input → null');
  ok(W.hgObtcPineMarks(undefined) === null, 'undefined input → null');
  ok(W.hgObtcPineMarks('junk') === null, 'string input → null (hgObtcPineMarks is strict)');
  ok(W.hgObtcPineMarks({}) === null, 'object (non-array) input → null');
  ok(seen.called === before, 'none of these thin cases call the home (short-circuits)');

  /* the exact 30-bar boundary */
  ok(W.hgObtcPineMarks(bars(30)) && typeof W.hgObtcPineMarks(bars(30)) === 'object',
    '30 rows passes the floor (>=30, strict)');

  /* home throws → helper returns null, never propagates */
  W.trendmxPineMarks = function(){ throw new Error('port blew up'); };
  ok(W.hgObtcPineMarks(bars(300)) === null,
    'home throwing → helper returns null (never propagates)');

  /* home returns a non-object → helper returns null */
  W.trendmxPineMarks = function(){ return 'junk'; };
  ok(W.hgObtcPineMarks(bars(300)) === null, 'home returning a non-object → null');
  W.trendmxPineMarks = function(){ return null; };
  ok(W.hgObtcPineMarks(bars(300)) === null, 'home returning null → null');
  W.trendmxPineMarks = function(){ return undefined; };
  ok(W.hgObtcPineMarks(bars(300)) === null, 'home returning undefined → null');
}

/* ------------------------------------------------------------------ */
console.log('== 4) HG_OBTC_PINE_FIELDS: 10 entries, each a [src, dst] with pine* dst ==');
{
  const W = boot();
  const fields = W.HG_OBTC_PINE_FIELDS;
  ok(fields.length === 10, 'exactly 10 fields (the ten Pine ports)');
  const expectedSrc = new Set(['lor','ht','sqz','smf','msb','smc','cipher','rfilter','nwenv','wavwap']);
  const seenSrc = new Set();
  const seenDst = new Set();
  let allPineDst = true;
  for (const [src, dst] of fields){
    seenSrc.add(src);
    seenDst.add(dst);
    if (!/^pine[A-Z]/.test(dst)) allPineDst = false;
  }
  ok(seenSrc.size === 10, 'all 10 src keys are unique');
  ok(seenDst.size === 10, 'all 10 dst keys are unique');
  for (const s of expectedSrc){
    ok(seenSrc.has(s), `src "${s}" is present`);
  }
  ok(allPineDst, 'every dst key starts with pine* (grep-safe for census)');
}

/* ------------------------------------------------------------------ */
console.log('== 5) hgObtcPineStamp: strict long/short rule, three-state ==');
{
  const W = boot();

  /* case A — long/short only writes; null/absent leaves the field absent */
  const rowA = { entry: 100 };
  W.hgObtcPineStamp(rowA, {
    lor: 'long', ht: 'short', sqz: null, smf: undefined,
    msb: 'long', smc: 'short', cipher: 'junk', rfilter: 1,
    nwenv: '', wavwap: 'LONG' /* case-sensitive, uppercase refused */
  });
  ok(rowA.pineLorKnn === 'long', 'long writes');
  ok(rowA.pineHalfTrend === 'short', 'short writes');
  ok(!('pineSqueeze' in rowA), 'null leaves the field absent');
  ok(!('pineSmf' in rowA), 'undefined leaves the field absent');
  ok(rowA.pineMsb === 'long', 'another long writes');
  ok(rowA.pineSmc === 'short', 'another short writes');
  ok(!('pineCipher' in rowA), 'a junk string refused — case-sensitive strict');
  ok(!('pineRangeFilter' in rowA), 'a number refused');
  ok(!('pineNwEnvelope' in rowA), 'empty string refused');
  ok(!('pineWavwap' in rowA), 'uppercase LONG refused (strict equal check)');
  ok(rowA.entry === 100, 'unrelated fields (entry) preserved');

  /* case B — a null pm is a no-op */
  const rowB = { entry: 200, dir: 'long' };
  W.hgObtcPineStamp(rowB, null);
  ok(Object.keys(rowB).length === 2 && rowB.entry === 200 && rowB.dir === 'long',
    'null pm is a complete no-op (unrelated fields preserved)');

  /* case C — missing row is a no-op (no throw) */
  let threw = false;
  try{ W.hgObtcPineStamp(null, { lor: 'long' }); }catch(e){ threw = true; }
  ok(!threw, 'null row is a no-op (no throw)');

  /* case D — all 10 keys long */
  const rowD = {};
  W.hgObtcPineStamp(rowD, { lor: 'long', ht: 'long', sqz: 'long', smf: 'long',
    msb: 'long', smc: 'long', cipher: 'long', rfilter: 'long', nwenv: 'long', wavwap: 'long' });
  let dstCount = 0;
  for (const [, dst] of W.HG_OBTC_PINE_FIELDS){
    if (rowD[dst] === 'long') dstCount++;
  }
  ok(dstCount === 10, 'all 10 pine* fields written when every port reads long');

  /* case E — empty pm is a no-op */
  const rowE = { entry: 300 };
  W.hgObtcPineStamp(rowE, {});
  ok(Object.keys(rowE).length === 1 && rowE.entry === 300, 'empty pm writes nothing');
}

/* ------------------------------------------------------------------ */
console.log('== 6) record-site wiring: fwdPine declared, stamp called post-literal, census window intact ==');
{
  const raw = read('omnibtc.js');
  /* match the hg-v986 census's view: strip comments before scanning so
     `entry:` text inside comments cannot mislead the window check (the
     real census does this; the sister trap drove the record array to a
     named variable precisely because inline literals had `entry:` text
     inside and around them). */
  const src = stripComments(raw);

  /* the record site declares fwdPine from the record's OWN tape */
  ok(/var\s+fwdPine\s*=\s*hgObtcPineMarks\s*\(\s*fwdTape\s*\)/.test(src),
    'fwdPine is declared from hgObtcPineMarks(fwdTape) before the fwdRow literal');

  /* the stamp runs AFTER the literal, before fwdRows */
  const beforeStamp = /if\s*\(fwdScalp\)\s*\{\s*fwdRow\.rows\s*=\s*fwdTape\s*;\s*\}\s*else\s*\{\s*fwdRow\.rows4h\s*=\s*winnerRows\s*;\s*\}/.test(src);
  ok(beforeStamp, 'the rows attachment runs before the stamp');
  ok(/if\s*\(\s*fwdPine\s*\)\s*hgObtcPineStamp\s*\(\s*fwdRow\s*,\s*fwdPine\s*\)/.test(src),
    'hgObtcPineStamp(fwdRow, fwdPine) is called after the literal (hg-v986 census window)');

  /* the hg-v986 census window: on comment-stripped source, `entry:` within
     3000 chars before the hgFwdRecordScan call */
  const callIdx = src.indexOf("W.hgFwdRecordScan('OMNIBTC',");
  ok(callIdx > 0, 'the hgFwdRecordScan OMNIBTC call is locatable');
  const window = src.slice(Math.max(0, callIdx - 3000), callIdx);
  const entryMatch = window.match(/(?<![.\w])entry\s*:/);
  ok(entryMatch && entryMatch.index >= 0,
    'the fwdRow literal\'s `entry:` sits within 3000 chars BEFORE the call on comment-stripped source');
  const entryIdx = entryMatch ? entryMatch.index : -1;
  const distance = window.length - entryIdx;
  ok(distance < 3000 && distance > 0,
    `distance from entry: to call is ${distance} chars (< 3000 — census window intact)`);

  /* the stamp is INSIDE the window (so the record carries the marks for
     the hgFwdRecordScan read, not after it) */
  const stampIdx = window.indexOf('hgObtcPineStamp(fwdRow, fwdPine)');
  ok(stampIdx >= 0 && stampIdx > entryIdx,
    `the stamp sits between entry: (${entryIdx}) and the hgFwdRecordScan call (stamp at ${stampIdx})`);
}

/* ------------------------------------------------------------------ */
console.log('== 7) scan-site pfReads.pineMarks: card reads what the record stamps ==');
{
  const src = read('omnibtc.js');
  ok(/pfReads\.pineMarks\s*=\s*hgObtcPineMarks\s*\(\s*match\s*&&\s*match\._rows\s*\)/.test(src),
    'pfReads.pineMarks is read off the winner\'s 4h tape (match._rows)');

  /* the TECHNICAL block reads reads.pineMarks and prints a PINE line */
  const techIdx = src.indexOf("'TECHNICAL'");
  ok(techIdx > 0, 'the TECHNICAL dim call is locatable');
  /* search a bounded 2500 chars BEFORE the TECHNICAL dim for the PINE line */
  const before = src.slice(Math.max(0, techIdx - 2500), techIdx);
  ok(/reads\s*&&\s*reads\.pineMarks/.test(before),
    'the TECHNICAL block guards on reads.pineMarks before reading it');
  ok(/tLines\.push\s*\(\s*['"]PINE\s/.test(before),
    'the TECHNICAL block pushes a PINE line onto tLines');
  ok(/record-only, gates nothing/i.test(before),
    'the PINE line says "record-only, gates nothing" so a reader cannot mistake it for a gate');

  /* a line with no long/short reads must be skipped: assert the gate is
     on __pineBits.length, not on pineMarks truthiness alone */
  ok(/__pineBits\.length/.test(before),
    'the push is gated on __pineBits.length (an empty mark bag prints nothing)');
}

/* ------------------------------------------------------------------ */
console.log('== 8) NO GATE READS pine* — 7 files × 10 keys × 2 shapes = 140 empty cells ==');
{
  const gateFiles = [
    'cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'
  ];
  const keys = ['pineLorKnn','pineHalfTrend','pineSqueeze','pineSmf','pineMsb',
                'pineSmc','pineCipher','pineRangeFilter','pineNwEnvelope','pineWavwap'];
  let empty = 0, total = 0;
  for (const f of gateFiles){
    let body;
    try{ body = read(f); }catch(e){ continue; }
    for (const k of keys){
      total += 2;
      const dot = new RegExp('\\b(reads|row|cand|r|setup|plan)\\s*\\.\\s*' + k + '\\b');
      const bracket = new RegExp('\\[\\s*[\'"]' + k + '[\'"]\\s*\\]');
      if (!dot.test(body)) empty++;
      if (!bracket.test(body)) empty++;
    }
  }
  ok(total === 140, `swept ${total} cells (7 files × 10 keys × 2 shapes)`);
  ok(empty === 140, `all ${empty}/140 cells empty: no gate reads any pine* key off a reads/row bag`);
}

/* ------------------------------------------------------------------ */
console.log('== 9) ship stamps align build / sw / trendtable (read via the shared helper, hg-v956) ==');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  const buildStamp = read('build-stamp.js');
  ok(new RegExp("version:\\s*['\"]" + HG_VER + "['\"]").test(buildStamp),
    'build-stamp.js version matches HG_VER (' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp HG_VER');
  const loader = read('trendtable.js');
  ok(loader.includes(HG_VER), 'trendtable.js header carries HG_VER');
  const partSuffix = HG_VER.replace(/^hg-v/, '');
  ok(loader.includes('v=' + partSuffix), 'trendtable.js part loader v=' + partSuffix);
}

/* ------------------------------------------------------------------ */
console.log('== 10) one home guard: trendtable combined and src-11 agree on the exports (hg-v1160 parts invariant) ==');
{
  const combined = read('trendtable.combined.js');
  const src11 = read('trendtable-src-11.js');
  /* both files carry the W.trendmxPineMarks line, side-by-side with
     W.trendmxScan and W.trendmxWarm (so a merge that drops one would
     be caught) */
  const cPos = combined.indexOf('W.trendmxPineMarks');
  const sPos = src11.indexOf('W.trendmxPineMarks');
  ok(cPos > 0 && sPos > 0, 'both files carry the export line');
  /* the export sits AFTER W.trendmxScan AND W.trendmxWarm in both files */
  const cScan = combined.indexOf('W.trendmxScan');
  const cWarm = combined.indexOf('W.trendmxWarm');
  const sScan = src11.indexOf('W.trendmxScan');
  const sWarm = src11.indexOf('W.trendmxWarm');
  ok(cScan < cPos && cWarm < cPos && sScan < sPos && sWarm < sPos,
    'the export sits after trendmxScan/trendmxWarm in both files (one block)');
}

/* ------------------------------------------------------------------ */
console.log('');
console.log(`== hg-v1293 OMNIBTC pine marks: ${passed} passed, ${failed} failed ==`);
process.exit(failed ? 1 : 0);
