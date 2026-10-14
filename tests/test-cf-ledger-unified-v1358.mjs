/* hg-v1358 — CANDLE FORECAST ledger unified
 *
 * The defect: this tab had TWO writers to TWO pools with DIVERGENT field sets.
 * Writer A (gold-candle-forecast.js:378 pre-v1358) wrote to pool
 * 'CANDLEFORECAST' with the four hg-v1351 pattern marks and NO mechanic /
 * ticket / perfect fields. Writer B (hgCfForwardMark in goldind.js:21324)
 * wrote to pool 'CANDLE FORECAST' with mechanic / ticket / perfect / perfectPlus
 * and NO reads bag. Two homes = hg-v949 violation; the pattern marks that
 * rode records in pool A had no reader on this tab = hg-v955 ornament.
 *
 * The fix: one home, one pool, union of fields. hgCfForwardMark takes a 4th
 * optional arg (the whole forecast result) and calls hgCfPatternMarks through
 * the one home in goldind.js. hgCfMeasure takes a 5th arg and passes it
 * through. gold-candle-forecast.js:325 passes `forecast`. Writer A is DELETED.
 * The intel panel adds hgFwdReadSplitHtml('CANDLE FORECAST') so the pattern
 * marks become measurable.
 *
 * No gate moves. No threshold moves. No setup leaves any board. The split
 * reader renders nothing until a settled record carries a mark — an empty
 * split is not a clean bill.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } };

/* §1 - hgCfForwardMark gained the 4th arg and uses it. */
const goldind = read('goldind.js');
ok(/function hgCfForwardMark\(setup, rows, tf, forecastResult\)/.test(goldind),
   'hgCfForwardMark carries the 4th arg forecastResult');
ok(/reads = hgCfPatternMarks\(forecastResult, rows\)/.test(goldind),
   'hgCfForwardMark calls the ONE home hgCfPatternMarks with the forecast + rows');
ok(/if \(forecastResult && typeof hgCfPatternMarks === 'function'\)/.test(goldind),
   'the call is guarded; a missing helper or absent forecast leaves reads undefined');
ok(/record\('CANDLE FORECAST', frame,/.test(goldind),
   'the ONE pool is CANDLE FORECAST (literal space)');

/* §2 - the record carries the UNION of fields: mechanic/ticket/perfect/
   perfectPlus (Writer B) AND the reads bag (Writer A's job). */
const recBlock = goldind.match(/out\.recorded = \+record\('CANDLE FORECAST'[\s\S]*?\}\], \{ horizonBars: horizon \}\) \|\| 0;/);
ok(!!recBlock, 'record literal lifted');
if (recBlock) {
  const r = recBlock[0];
  ok(/mechanic: frame === '4h' \? 'SWING' : 'SCALP'/.test(r), 'carries mechanic');
  ok(/ticket: setup\.ticket === true/.test(r), 'carries ticket');
  ok(/perfect: setup\.perfect === true/.test(r), 'carries perfect');
  ok(/perfectPlus: setup\.perfectPlus === true/.test(r), 'carries perfectPlus');
  ok(/reads: reads/.test(r), 'carries the reads bag (hg-v1358 close)');
  ok(/t2: t2/.test(r), 'carries t2 (hg-v1358 — Writer A had it)');
  ok(/feed: feed/.test(r), 'carries feed (hg-v1358 — Writer A had it)');
}

/* §3 - hgCfMeasure takes the 5th arg and passes it through. */
ok(/function hgCfMeasure\(scalp, swing, rows15, rows4, forecastResult\)/.test(goldind),
   'hgCfMeasure carries the 5th arg');
ok(/hgCfForwardMark\(scalp, rows15, '15m', forecastResult\)/.test(goldind),
   'hgCfMeasure passes forecastResult to the scalp mark call');
ok(/hgCfForwardMark\(swing, rows4, '4h', forecastResult\)/.test(goldind),
   'hgCfMeasure passes forecastResult to the swing mark call');

/* §4 - the tab passes the forecast as the 5th arg. */
const tab = read('gold-candle-forecast.js');
ok(/hgCfMeasure\(forecast\.scalp, forecast\.swing, candles, \(Array\.isArray\(c4\) \? c4 : null\), forecast\)/.test(tab),
   'tab call passes forecast as the 5th arg');

/* §5 - Writer A is REMOVED. No reference to pool CANDLEFORECAST as a WRITE
   target. (Aggregate at line 940 still reads both pools for backward compat.) */
ok(!/hgFwdRecordScan\('CANDLEFORECAST'/.test(tab),
   'Writer A deleted: no hgFwdRecordScan call to CANDLEFORECAST pool');
/* the backward-compat read is still there. */
ok(/hgFwdStats\(\['CANDLE FORECAST', 'CANDLEFORECAST'\]\)/.test(tab),
   'aggregate still reads BOTH pools so legacy records stay counted');

/* §6 - the split reader is wired in the intel panel. */
ok(/hgFwdReadSplitHtml\('CANDLE FORECAST'\)/.test(tab),
   'split reader wired for the pattern marks (hg-v955 close)');
ok(/splitHtml = ''/.test(tab) && /try \{/.test(tab),
   'split call fails open to empty string');

/* §7 - behavioural: lift hgCfForwardMark + hgCfPatternMarks and prove the
   record carries the four pattern marks when a formed BULL forecast is handed
   in. The pattern marks are three-state (hg-v989): a tie or unread records
   nothing, never a guessed false. */
import vm from 'node:vm';

function liftFunction(src, name) {
  // Extract the full function declaration via brace counting
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not locate ' + name);
  let depth = 0, i = src.indexOf('{', start), end = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('could not close ' + name);
  return src.slice(start, end);
}

const fwdMarkSrc = liftFunction(goldind, 'hgCfForwardMark');
const measureSrc = liftFunction(goldind, 'hgCfMeasure');
const patternMarksSrc = liftFunction(goldind, 'hgCfPatternMarks');

/* lightweight stubs for the ledger seams */
let lastRecord = null;
const sandbox = {
  console,
  hgCfHost: () => null,
  hgFwdResolve: () => 0,
  hgFwdRecordScan: (pool, frame, recs) => {
    lastRecord = { pool, frame, rec: recs && recs[0] };
    return recs ? recs.length : 0;
  },
  hgCfPatternMarks: null,
  hgCfPerfectAsk: () => null,
  hgCfWalk: () => null,
  atr: (rows, n) => {
    const out = [];
    for (let i = 0; i < rows.length; i++) out.push(1); /* non-zero ATR */
    return out;
  },
  hgCfCandlePatterns: (rows, atrLast) => ({ bullVotes: 3, bearVotes: 1, names: ['hammer'] }),
};
vm.createContext(sandbox);
vm.runInContext(patternMarksSrc + '\n' + fwdMarkSrc + '\n' + measureSrc + '\n' +
  'this.hgCfForwardMark = hgCfForwardMark; this.hgCfMeasure = hgCfMeasure; this.hgCfPatternMarks = hgCfPatternMarks;', sandbox);

const rows = [];
for (let i = 0; i < 60; i++) rows.push({ t: 1700000000 + i * 900, o: 2500 + i, h: 2510 + i, l: 2490 + i, c: 2500 + i });

/* BULL scalp forecast with named patterns rides. */
const scalp = { formed: true, dir: 'BULL', entry: 2600, stop: 2590, tp1: 2620, tp2: 2640, tf: '15m', source: 'delta-xaut', ticket: true, perfect: false };
const forecast = { dir: 'BULL', tf: '15m', patterns: ['hammer'], advancedPatterns: [] };
lastRecord = null;
const r = sandbox.hgCfForwardMark(scalp, rows, '15m', forecast);
ok(r && r.recorded === 1, 'behaviourally: a formed BULL scalp is recorded');
ok(lastRecord && lastRecord.pool === 'CANDLE FORECAST', 'the ONE pool is used');
ok(lastRecord && lastRecord.frame === '15m', 'frame is 15m for scalp');
ok(lastRecord && lastRecord.rec && lastRecord.rec.mechanic === 'SCALP', 'mechanic SCALP rides');
ok(lastRecord && lastRecord.rec && lastRecord.rec.ticket === true, 'ticket rides');
ok(lastRecord && lastRecord.rec && lastRecord.rec.reads && lastRecord.rec.reads['pattern:anyFire'] === true,
   'the FOUR pattern marks ride the record (anyFire fired on a named pattern)');
ok(lastRecord && lastRecord.rec && lastRecord.rec.reads['pattern:bullMajority'] === true,
   'bullMajority rides (3>1 on crafted votes)');
ok(lastRecord && lastRecord.rec && lastRecord.rec.reads['pattern:withTrend'] === true,
   'withTrend rides (BULL + bull majority)');
ok(lastRecord && lastRecord.rec && lastRecord.rec.t2 === 2640, 't2 rides');
ok(lastRecord && lastRecord.rec && lastRecord.rec.feed === 'delta-xaut', 'feed rides');

/* §8 - swing path: frame 4h, mechanic SWING. */
const swing = { formed: true, dir: 'BEAR', entry: 2600, stop: 2615, tp1: 2570, tf: '4h' };
const forecast4h = { dir: 'BEAR', tf: '4h', patterns: ['shooting_star'], advancedPatterns: [] };
sandbox.hgCfCandlePatterns = () => ({ bullVotes: 1, bearVotes: 3 });
lastRecord = null;
const r2 = sandbox.hgCfForwardMark(swing, rows, '4h', forecast4h);
ok(r2 && r2.recorded === 1, 'swing BEAR forecast records');
ok(lastRecord && lastRecord.frame === '4h' && lastRecord.rec.mechanic === 'SWING', 'frame 4h, mechanic SWING');
ok(lastRecord && lastRecord.rec.reads['pattern:bearMajority'] === true, 'bearMajority rides on bear swing');

/* §9 - fail open: missing forecast means no reads bag, record still writes. */
lastRecord = null;
const r3 = sandbox.hgCfForwardMark(scalp, rows, '15m', null);
ok(r3 && r3.recorded === 1, 'null forecast still writes the record');
ok(lastRecord && lastRecord.rec && lastRecord.rec.reads === undefined,
   'no forecast → reads is undefined (hg-v989: absent, never a guessed false)');

/* §10 - fail open: throwing hgCfPatternMarks does not break the write. */
sandbox.hgCfPatternMarks = () => { throw new Error('boom'); };
lastRecord = null;
const r4 = sandbox.hgCfForwardMark(scalp, rows, '15m', forecast);
ok(r4 && r4.recorded === 1, 'throwing hgCfPatternMarks does not break the write');
ok(lastRecord && lastRecord.rec && lastRecord.rec.reads === undefined, 'throw → reads undefined');

/* §11 - a non-formed setup records NOTHING (unchanged from pre-v1358). */
sandbox.hgCfPatternMarks = (f, r) => ({ 'pattern:anyFire': true });
lastRecord = null;
const r5 = sandbox.hgCfForwardMark({ formed: false, dir: 'BULL' }, rows, '15m', forecast);
ok(r5 && r5.recorded === 0, 'non-formed records nothing');
ok(lastRecord === null, 'non-formed does not call record()');

/* §12 - stamp parity across build-stamp, sw and trendtable. */
ok(/^hg-v\d+$/.test(HG_VER), 'HG_VER has the expected shape');
ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js version');
ok(read('trendtable.js').includes(HG_VER), 'trendtable.js carries the live version');

/* §13 - no gate module reads 'CANDLE FORECAST' pool or the pattern marks as a
   setup gate. The marks are display and measurement only. */
const gateFiles = [
  'cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
  'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js',
];
const patternKeys = ['pattern:anyFire', 'pattern:bullMajority', 'pattern:bearMajority', 'pattern:withTrend'];
let gateReads = 0;
for (const gf of gateFiles) {
  const src = read(gf);
  // strip comments crudely so a comment mentioning a key doesn't count
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const k of patternKeys) {
    if (stripped.includes("'" + k + "'") || stripped.includes('"' + k + '"')) {
      gateReads++;
      console.log('UNEXPECTED gate read:', gf, k);
    }
  }
}
ok(gateReads === 0, 'no gate module reads the four pattern marks (hg-v966 refused)');

console.log(`\nhg-v1358 CF ledger unified: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
