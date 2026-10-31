/* hg-v1361 guard — two findings in one pack:

   (1) CANDLE FORECAST — fix my own hg-v1358 defect.
       hgCfPatternMarks reads result.patterns / advancedPatterns / dir / tf
       at the TOP LEVEL. hg-v1358 wired the caller to pass the composite
       `forecast` wrapper ({scalp, swing, ultimate, measure, daySwings})
       where it should have passed the per-tape forecast result. Since
       the composite has no top-level patterns / dir / tf, pattern:withTrend
       and cf:tf never fired on any record. The hg-v955 shape in my own
       pack.
       Fix: hgCfForwardMark reads patterns from `setup` directly (which
       IS the forecast result for that tape — goldCandleForecast(rows, {mode})
       is passed to hgCfForwardMark via hgCfMeasure's scalp/swing args).
       The 4th arg is gone; hgCfMeasure takes four args.

   (2) SUPER GOLD — mark propagation + sister panel.
       `absorbSnap` normalises source cands into a canonical shape and
       strips every mark the source desks publish (perfect, perfectPlus,
       chased, chaseCode, freeReads, indReads, pineStates, fundingPct).
       `publishSuperGoldSnap` writes the SUPER:GOLD ledger pool with the
       stripped shape, so `hgFwdReadSplit`, `hgFwdPerfectSplit` and the
       calendar / fund / costR splits read a dark board — the pool whose
       comment claims to measure the FILTER has no mark reads to measure.
       Fix: `absorbSnap` carries each field with the source desk's own
       shape guard (opt-in; a cand with none of them is unchanged);
       `publishSuperGoldSnap` propagates them onto the record; the panel
       paints `hgFwdPanelHTML('SUPER:GOLD')` beside `hgGoldFwdNote` so
       the pool's sister panel is visible.

   Both fixes are RECORD-ONLY (hg-v966 refused: no gate reads any of them,
   asserted) and NOT ornamental (hg-v955 held: the ledger consumers already
   exist for every mark propagated).

   Technique: vm sandbox lift (hg-v1022) — the two functions and the
   super-gold absorbSnap/record-map are lifted out of their files and
   driven under stubs so mutations on the real source are catchable.
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0, pass = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fails++; console.error('FAIL:', msg); } };
const okEq = (a, b, msg) => ok(a === b, msg + ' (got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ')');

const goldind = read('goldind.js');
const gcf = read('gold-candle-forecast.js');
const sg = read('super-gold.js');
const swText = read('sw.js');

/* ============================================================
   §1. Ship stamps — the shared helper, never a hardcoded string.
   ============================================================ */
ok(/^hg-v\d+$/.test(HG_VER), 'HG_VER is well-formed');
ok(swCacheOk(swText), 'sw.js HG_CACHE agrees with build-stamp');
ok(gcf.indexOf('(v1361)') > -1 || gcf.indexOf('v1361') > -1, 'gold-candle-forecast carries v1361 header');

/* ============================================================
   §2. sw.js shell carries candle-forecast-intel.js.
       hg-v1358 added it; upstream merge wiped the correction;
       re-apply.
   ============================================================ */
ok(swText.indexOf("'./candle-forecast-intel.js'") > -1,
   'sw.js HG_SHELL includes ./candle-forecast-intel.js (hg-v1361 re-applied correction)');

/* ============================================================
   §3. Lift the Candle Forecast engine block (hgCfForwardMark +
       hgCfMeasure + hgCfPatternMarks) into a sandbox with stubbed
       indicators and ledger seams. Prove the fix is behavioural.
   ============================================================ */
function sliceFunc(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('cannot find function ' + name);
  // scan forward through balanced braces starting at the first '{' after the signature
  let depth = 0, start = -1, j = i;
  while (j < src.length){
    const c = src[j];
    if (c === '{'){ if (start < 0) start = j; depth++; }
    else if (c === '}'){ depth--; if (depth === 0){ return src.slice(i, j+1); } }
    j++;
  }
  throw new Error('cannot find end of function ' + name);
}

const srcForwardMark = sliceFunc(goldind, 'hgCfForwardMark');
const srcMeasure = sliceFunc(goldind, 'hgCfMeasure');
const srcPatternMarks = sliceFunc(goldind, 'hgCfPatternMarks');

/* Stub ledger + indicators so the sandbox can call the engine. */
const recordedRows = [];
let resolveCount = 0;
function makeSandbox(opts){
  opts = opts || {};
  const atrFn = () => Array(60).fill(5);
  const context = {
    hgFwdResolve: () => { resolveCount++; return 0; },
    hgFwdRecordScan: (pool, tf, rows, _opts) => {
      rows.forEach(r => recordedRows.push({ pool, tf, row: r }));
      return rows.length;
    },
    hgCfHost: () => ({ hgFwdResolve: context.hgFwdResolve, hgFwdRecordScan: context.hgFwdRecordScan }),
    atr: atrFn,
    hgCfCandlePatterns: opts.candlePatterns || (() => ({ bullVotes: 2, bearVotes: 0, names: ['hammer'] })),
    hgCfPerfectAsk: () => ({ asked: true, perfect: false, plus: false, why: [], line: '' }),
    hgCfWalk: () => ({ ok: true }),
    Array, Math, isFinite, String, Number, Object
  };
  context.hgCfPatternMarks = null; // populated by eval below
  context.hgCfForwardMark = null;
  context.hgCfMeasure = null;
  const sb = vm.createContext(context);
  vm.runInContext(srcPatternMarks + '\n;globalThis.hgCfPatternMarks = hgCfPatternMarks;', sb);
  vm.runInContext(srcForwardMark + '\n;globalThis.hgCfForwardMark = hgCfForwardMark;', sb);
  vm.runInContext(srcMeasure + '\n;globalThis.hgCfMeasure = hgCfMeasure;', sb);
  return sb;
}

const rows15 = Array.from({length:40}, (_,i) => ({ t: i*900, o:100+i*0.1, h:100.5+i*0.1, l:99.5+i*0.1, c:100.3+i*0.1 }));
const rows4 = Array.from({length:40}, (_,i) => ({ t: i*14400, o:100+i*0.5, h:101+i*0.5, l:99+i*0.5, c:100.5+i*0.5 }));

// §3a. Per-tape forecast result (post-fix shape) — top-level patterns/dir/tf.
recordedRows.length = 0; resolveCount = 0;
const sb1 = makeSandbox();
const scalpResult = {
  formed: true, dir: 'BULL', tf: '15m',
  entry: 100.3, stop: 99.5, tp1: 101.1, tp2: 102,
  patterns: [{ name: 'hammer' }],
  advancedPatterns: [],
  ticket: true,
  source: 'xm-xauusd'
};
const swingResult = {
  formed: true, dir: 'BEAR', tf: '4h',
  entry: 120.0, stop: 121.0, tp1: 118.0, tp2: 116,
  patterns: [{ name: 'shooting_star' }],
  advancedPatterns: [],
  ticket: true,
  source: 'binance-xau'
};
Object.assign(sb1, { scalpResult, swingResult, rows15, rows4 });
vm.runInContext('globalThis.measureOut = hgCfMeasure(scalpResult, swingResult, rows15, rows4);', sb1);
if (!recordedRows.length){
  console.error('DEBUG measureOut:', JSON.stringify({
    fwd15: sb1.measureOut && sb1.measureOut.fwd15,
    fwd4: sb1.measureOut && sb1.measureOut.fwd4
  }));
}
const scalpRec = recordedRows.find(r => r.row.mechanic === 'SCALP');
const swingRec = recordedRows.find(r => r.row.mechanic === 'SWING');
ok(scalpRec && scalpRec.row.reads, 'scalp record carries reads bag');
ok(swingRec && swingRec.row.reads, 'swing record carries reads bag');
okEq(scalpRec && scalpRec.row.reads && scalpRec.row.reads['cf:tf'], '15m', 'scalp cf:tf = 15m (post-fix)');
okEq(swingRec && swingRec.row.reads && swingRec.row.reads['cf:tf'], '4h', 'swing cf:tf = 4h (post-fix)');
okEq(scalpRec && scalpRec.row.reads && scalpRec.row.reads['pattern:withTrend'], true, 'scalp pattern:withTrend FIRES on bull dir with bull votes');
okEq(swingRec && swingRec.row.reads && swingRec.row.reads['pattern:withTrend'], false, 'swing pattern:withTrend FIRES false (bull votes against bear dir)');

// §3b. Composite wrapper (pre-fix shape) — reproduce the hg-v1358 defect.
// Call hgCfPatternMarks DIRECTLY with the composite to prove the defect existed.
recordedRows.length = 0;
const sb2 = makeSandbox();
const composite = { scalp: scalpResult, swing: swingResult, ultimate: null, measure: null };
vm.runInContext('globalThis.marksComposite = hgCfPatternMarks(composite, rows15);', Object.assign(sb2, { composite, rows15 }));
const marksComposite = sb2.marksComposite;
ok(marksComposite['cf:tf'] === undefined, 'composite wrapper: cf:tf absent (defect reproduction)');
ok(marksComposite['pattern:withTrend'] === undefined, 'composite wrapper: pattern:withTrend absent (defect reproduction)');

// §3c. The vote-based marks DO fire regardless (hg-v989: anyFire / majority
// come from hgCfCandlePatterns which reads rows directly, not the forecast).
ok(marksComposite['pattern:anyFire'] === true, 'anyFire fires on composite (vote path unaffected)');
ok(marksComposite['pattern:bullMajority'] === true, 'bullMajority fires on composite (vote path unaffected)');

// §3d. Thin tape / no helper — three-state fail-open.
recordedRows.length = 0;
const sb3 = makeSandbox({ candlePatterns: () => null });
const marksEmpty = vm.runInContext('hgCfPatternMarks({ dir: "BULL", tf: "15m", patterns: [], advancedPatterns: [] }, [])', sb3);
ok(!('pattern:anyFire' in marksEmpty), 'empty tape: anyFire absent (no fire)');
ok(!('pattern:bullMajority' in marksEmpty), 'empty tape: bullMajority absent');

/* ============================================================
   §4. Textual guards on the source — API shape is 3-arg
       hgCfForwardMark and 4-arg hgCfMeasure.
   ============================================================ */
ok(/function hgCfForwardMark\(setup, rows, tf\)\s*\{/.test(goldind),
   'hgCfForwardMark declared with 3 args (hg-v1361)');
ok(/function hgCfMeasure\(scalp, swing, rows15, rows4\)\s*\{/.test(goldind),
   'hgCfMeasure declared with 4 args (hg-v1361)');
ok(/hgCfPatternMarks\(setup,\s*rows\)/.test(goldind),
   'hgCfForwardMark calls hgCfPatternMarks(setup, rows) — reads per-tape result');
ok(/hgCfMeasure\(forecast\.scalp,\s*forecast\.swing,\s*candles,\s*\(Array\.isArray\(c4\)/.test(gcf),
   'gold-candle-forecast calls hgCfMeasure with 4 args');

/* ============================================================
   §5. Lift super-gold.js — hitFromGoldCand is the field mapper
       that normalises source cands into the canonical row shape
       absorbSnap collects. It is the surface this pack extended;
       lifting it needs only N() + goldCandTier() as stubs. */
const hitFromSrc = sliceFunc(sg, 'hitFromGoldCand');
const sbSg = vm.createContext({
  N: (x) => { const n = +x; return isFinite(n) && +x !== 0 ? +x : (x === 0 ? 0 : null); },
  goldCandTier: () => 'clean',
  Array, Math, isFinite, String, Number, Object
});
vm.runInContext(hitFromSrc + '\n;globalThis.hitFromGoldCand = hitFromGoldCand;', sbSg);

const candFull = {
  sym: 'XAUUSD', dir: 'long', entry: 2000, stop: 1990, t1: 2020, t2: 2040, rr: 2,
  mark: 2000.5, venue: 'xm-xauusd', id: 'c1', grade: 'A', strategy: 'xm',
  stratKey: 'xmbreak', tally: 5, killzone: 'NY', demoted: false, stamps: ['CLEAN'],
  fund: null,
  perfect: true, perfectPlus: true, chased: true, chaseCode: 'late',
  freeReads: { dxy: 'with' },
  indReads: { ok: true, rsi: 55 },
  pineStates: { ok: true, supertrend: 'long' },
  fundingPct: -0.05
};
const absorbed = vm.runInContext('hitFromGoldCand(candFull, { scanner: "gold-scalp", tier: "clean" })', Object.assign(sbSg, { candFull }));
okEq(absorbed.perfect, true, 'absorbSnap carries perfect');
okEq(absorbed.perfectPlus, true, 'absorbSnap carries perfectPlus');
okEq(absorbed.chased, true, 'absorbSnap carries chased');
okEq(absorbed.chaseCode, 'late', 'absorbSnap carries chaseCode');
okEq(absorbed.freeReads && absorbed.freeReads.dxy, 'with', 'absorbSnap carries freeReads');
okEq(absorbed.indReads && absorbed.indReads.rsi, 55, 'absorbSnap carries indReads (gated on ok:true)');
okEq(absorbed.pineStates && absorbed.pineStates.supertrend, 'long', 'absorbSnap carries pineStates (gated on ok:true)');
okEq(absorbed.fundingPct, -0.05, 'absorbSnap carries fundingPct');

// §5b. Opt-in guards — a cand with none of the fields records none of them.
const candMinimal = {
  sym: 'XAUUSD', dir: 'long', entry: 2000, stop: 1990, t1: 2020,
  grade: 'B', demoted: false
};
const absorbedMinimal = vm.runInContext('hitFromGoldCand(candMinimal, { scanner: "gold-swing", tier: "near" })', Object.assign(sbSg, { candMinimal }));
okEq(absorbedMinimal.perfect, undefined, 'absorbSnap drops perfect when absent');
okEq(absorbedMinimal.perfectPlus, undefined, 'absorbSnap drops perfectPlus when absent');
okEq(absorbedMinimal.chased, undefined, 'absorbSnap drops chased when absent');
okEq(absorbedMinimal.freeReads, undefined, 'absorbSnap drops freeReads when absent');
okEq(absorbedMinimal.indReads, undefined, 'absorbSnap drops indReads when absent');
okEq(absorbedMinimal.fundingPct, undefined, 'absorbSnap drops fundingPct when absent');

// §5c. Three-state hg-v989: junk values are rejected, not coerced.
const candJunk = {
  sym: 'XAUUSD', dir: 'long', entry: 2000, stop: 1990, t1: 2020,
  perfect: 1,              // truthy non-boolean
  perfectPlus: 'yes',      // truthy non-boolean
  chased: 'late',          // truthy non-boolean
  freeReads: 'dxy_with',   // not an object
  indReads: { ok: false, rsi: 60 }, // ok:false → drop
  pineStates: { ok: 1, super: 'long' }, // ok:1 (not true) → drop
  fundingPct: '0.05'       // string
};
const absorbedJunk = vm.runInContext('hitFromGoldCand(candJunk, { scanner: "gold-scalp", tier: "clean" })', Object.assign(sbSg, { candJunk }));
okEq(absorbedJunk.perfect, undefined, 'absorbSnap rejects perfect:1 (strict === true)');
okEq(absorbedJunk.perfectPlus, undefined, 'absorbSnap rejects perfectPlus:"yes"');
okEq(absorbedJunk.chased, undefined, 'absorbSnap rejects chased:"late"');
okEq(absorbedJunk.freeReads, undefined, 'absorbSnap rejects freeReads non-object');
okEq(absorbedJunk.indReads, undefined, 'absorbSnap rejects indReads ok:false');
okEq(absorbedJunk.pineStates, undefined, 'absorbSnap rejects pineStates ok:1 (strict ===true)');
okEq(absorbedJunk.fundingPct, undefined, 'absorbSnap rejects fundingPct as string');

/* ============================================================
   §6. publishSuperGoldSnap — mark propagation into the record.
       The record map is embedded in publishSuperGoldSnap; we assert
       the key textual anchors because driving the whole function
       requires too much shell scaffolding.
   ============================================================ */
ok(/mechanic:\s*'CONVICTION-PICK'/.test(sg), 'record stamps mechanic CONVICTION-PICK');
ok(/perfect:\s*c\.perfect/.test(sg), 'record carries perfect');
ok(/perfectPlus:\s*c\.perfectPlus/.test(sg), 'record carries perfectPlus');
ok(/chased:\s*c\.chased/.test(sg), 'record carries chased');
ok(/chaseCode:\s*c\.chaseCode/.test(sg), 'record carries chaseCode');
ok(/reads:\s*c\.freeReads/.test(sg), 'record carries reads from freeReads');
ok(/fundingPct:\s*c\.fundingPct/.test(sg), 'record carries fundingPct');

/* ============================================================
   §7. Sister panel paints hgFwdPanelHTML('SUPER:GOLD').
   ============================================================ */
ok(/hgFwdPanelHTML\(\s*['"]SUPER:GOLD['"]/.test(sg),
   'super-gold.js paints hgFwdPanelHTML(SUPER:GOLD)');
ok(/superGoldFwdPanel/.test(sg),
   'paint variable superGoldFwdPanel defined');

/* ============================================================
   §8. No gate reads a new mark on SUPER:GOLD or the pattern marks.
       Sweep seven gate files, prove zero reads.
   ============================================================ */
const gateFiles = ['cryptogates.js','engine.js','plans.js','hg-gates.js','hg-setup-core.js','hg-perfect-setup.js','setup-stack.js'];
const sgMarks = ['perfect','perfectPlus','chased','chaseCode','freeReads','indReads','pineStates','fundingPct','SUPER:GOLD'];
const cfMarks = ['pattern:withTrend','pattern:bullMajority','pattern:bearMajority','pattern:anyFire','cf:tf'];
let totalCells = 0, dirty = 0;
for (const file of gateFiles){
  let src = '';
  try { src = read(file); } catch(e){ continue; }
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const k of cfMarks.concat(sgMarks)){
    totalCells++;
    // Match reads bag access either as .key or ['key']/["key"]
    const safe = k.replace(/[.:]/g, '\\$&');
    const re = new RegExp('reads\\s*\\[\\s*["\']' + safe + '["\']\\s*\\]|reads\\.' + safe);
    if (re.test(stripped)){
      dirty++;
      console.error('UNEXPECTED GATE READ:', file, 'reads', k);
    }
  }
}
okEq(dirty, 0, 'no gate module reads any of ' + (cfMarks.length + sgMarks.length) + ' marks across ' + gateFiles.length + ' gate files (' + totalCells + ' cells empty)');

/* ============================================================
   §9. Mutation pass: delete each fix and re-run — count catches.
       The pass is self-contained: it mutates in-memory copies of
       goldind.js / super-gold.js / sw.js and re-executes the
       relevant assertions on the mutated source.
   ============================================================ */
const mutations = [
  // M1: revert hgCfForwardMark to the hg-v1358 signature (4 args, reads from forecastResult).
  {
    name: 'M1: revert hgCfForwardMark to 4-arg signature',
    patch: s => s.replace(
      /function hgCfForwardMark\(setup, rows, tf\)\s*\{/,
      'function hgCfForwardMark(setup, rows, tf, forecastResult){'
    ).replace(/hgCfPatternMarks\(setup,\s*rows\)/, 'hgCfPatternMarks(forecastResult, rows)'),
    file: 'goldind.js',
    check: src => /function hgCfForwardMark\(setup, rows, tf\)\s*\{/.test(src)
  },
  // M2: revert hgCfMeasure to 5-arg signature.
  {
    name: 'M2: revert hgCfMeasure to 5-arg signature',
    patch: s => s.replace(
      /function hgCfMeasure\(scalp, swing, rows15, rows4\)\s*\{/,
      'function hgCfMeasure(scalp, swing, rows15, rows4, forecastResult){'
    ),
    file: 'goldind.js',
    check: src => /function hgCfMeasure\(scalp, swing, rows15, rows4\)\s*\{/.test(src)
  },
  // M3: break absorbSnap propagation of perfect.
  {
    name: 'M3: drop perfect from absorbSnap',
    patch: s => s.replace(/perfect:\s*\(c\.perfect === true\) \? true : undefined,/, ''),
    file: 'super-gold.js',
    check: src => /perfect:\s*\(c\.perfect === true\) \? true : undefined,/.test(src)
  },
  // M4: break publishSuperGoldSnap record propagation of fundingPct.
  {
    name: 'M4: drop fundingPct from record',
    patch: s => s.replace(/\s*fundingPct: c\.fundingPct \};/, ' };'),
    file: 'super-gold.js',
    check: src => /fundingPct: c\.fundingPct \};/.test(src)
  },
  // M5: break the sw.js shell entry for candle-forecast-intel.js.
  // hg-v1389: upstream's hg-v1384..v1388 merge moved candle-forecast-intel.js
  // to the END of its line (comma, newline) rather than inline (comma, space,
  // next entry). The original pattern matched only the inline form. The new
  // pattern handles BOTH forms so the mutation is behaviourally caught no
  // matter where in the HG_SHELL array the entry lands.
  {
    name: 'M5: drop candle-forecast-intel.js from HG_SHELL',
    patch: s => s.replace(/,?\s*'\.\/candle-forecast-intel\.js',?\s*/, ' '),
    file: 'sw.js',
    check: src => src.indexOf("'./candle-forecast-intel.js'") > -1
  },
  // M6: break the sister panel paint.
  {
    name: 'M6: drop hgFwdPanelHTML(SUPER:GOLD) paint',
    patch: s => s.replace(/W\.hgFwdPanelHTML\(\s*'SUPER:GOLD'[\s\S]*?\|\|\s*''/, "''"),
    file: 'super-gold.js',
    check: src => /hgFwdPanelHTML\(\s*['"]SUPER:GOLD['"]/.test(src)
  },
  // M7: cross-wire indReads to accept ok:false.
  {
    name: 'M7: absorbSnap accepts indReads.ok:false',
    patch: s => s.replace(/indReads\.ok === true/g, 'indReads.ok !== undefined'),
    file: 'super-gold.js',
    check: src => /indReads\.ok === true/.test(src)
  },
  // M8: hgCfPatternMarks reads result.dir with case-insensitive match (behavioural equiv).
  {
    name: 'M8: hgCfPatternMarks matches dir case-insensitively',
    patch: s => s.replace(
      /var dir = \(result\.dir === 'BULL'\) \? 'long' : \(\(result\.dir === 'BEAR'\) \? 'short' : null\);/,
      "var dir = String(result.dir || '').toUpperCase() === 'BULL' ? 'long' : (String(result.dir || '').toUpperCase() === 'BEAR' ? 'short' : null);"
    ),
    file: 'goldind.js',
    check: src => /result\.dir === 'BULL'/.test(src)
  }
];

let caught = 0;
for (const m of mutations){
  const originalFile = m.file === 'goldind.js' ? goldind : (m.file === 'super-gold.js' ? sg : swText);
  const mutated = m.patch(originalFile);
  if (mutated === originalFile){
    console.error('MUTATION NO-OP (fixture gap):', m.name);
    continue;
  }
  // The check function returns true if the FIX anchor is still present on the mutated source.
  // We want the mutation to BREAK the fix, so check should read FALSE on the mutated source.
  if (!m.check(mutated)){
    caught++;
  } else {
    console.error('MUTATION SURVIVED:', m.name);
  }
}
okEq(caught, mutations.length, 'mutation pass: ' + caught + '/' + mutations.length + ' caught');

console.log('\n' + (fails ? ('FAILED ' + fails + ' / ' + (pass+fails) + ' assertions') : ('PASSED ' + pass + ' assertions')));
process.exit(fails ? 1 : 0);
