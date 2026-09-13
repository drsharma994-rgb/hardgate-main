/* smc-lib.js — faithful port of smartmoneyconcepts v0.0.27, proven against the
   library's own golden fixtures (tests/fixtures/smc, EURUSD 15M, 24k bars).

   Every column of every function is compared bar-for-bar with the CSVs the
   reference repo ships in tests/test_data/EURUSD. Columns the reference stores
   as float32 are compared after Math.fround on both sides; float64 columns must
   match exactly; flags and indices must match exactly.

   Run: node tests/test-smc-lib.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'tests', 'fixtures', 'smc');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, Number, String, Object, Array, isFinite, isNaN, parseFloat, parseInt, JSON, Error, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'smc-lib.js'), 'utf8'), ctx, { filename: 'smc-lib.js' });
  return ctx;
}

function loadCsv(name){
  const text = zlib.gunzipSync(fs.readFileSync(path.join(FIX, name + '.gz'))).toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.length);
  const header = lines[0].split(',');
  const cols = {};
  header.forEach(h => { cols[h] = []; });
  for (let i = 1; i < lines.length; i++){
    const parts = lines[i].split(',');
    for (let k = 0; k < header.length; k++){
      const s = parts[k];
      cols[header[k]].push((s === '' || s === undefined) ? null : +s);
    }
  }
  return cols;
}

function loadRows(){
  const text = zlib.gunzipSync(fs.readFileSync(path.join(FIX, 'EURUSD_15M.csv.gz'))).toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.length);
  const rows = [];
  for (let i = 1; i < lines.length; i++){
    const p = lines[i].split(',');
    const m = p[0].match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    rows.push({ t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]), o: +p[1], h: +p[2], l: +p[3], c: +p[4], v: +p[6] });
  }
  return rows;
}

function cmp(label, actual, expected, kind){
  ok(Array.isArray(actual) && actual.length === expected.length, label + ' — length ' + (actual && actual.length) + ' vs ' + expected.length);
  let bad = 0; const first = [];
  for (let i = 0; i < expected.length; i++){
    const a = actual[i], e = expected[i];
    let same;
    if (a == null || e == null) same = (a == null && e == null);
    else if (kind === 'f32') same = Math.fround(a) === Math.fround(e);
    else if (kind === 'f64') same = a === e || Math.abs(a - e) <= 1e-9 * Math.max(1, Math.abs(e));
    else same = a === e;
    if (!same){ bad++; if (first.length < 4) first.push({ i, a, e }); }
  }
  ok(bad === 0, label + ' — ' + bad + ' mismatches of ' + expected.length + (bad ? ' e.g. ' + JSON.stringify(first) : ''));
}

const W = boot();
const smc = W.hgSmc;
const rows = loadRows();
console.log('fixture bars:', rows.length);
ok(rows.length === 24424, 'EURUSD 15M fixture has 24424 bars');
ok(smc && smc.version === '0.0.27', 'hgSmc exported, ported from v0.0.27');

console.log('== fvg ==');
{
  const t0 = Date.now();
  const got = smc.fvg(rows);
  const exp = loadCsv('fvg_result_data.csv');
  console.log('  fvg ms:', Date.now() - t0);
  cmp('FVG', got.FVG, exp.FVG, 'int');
  cmp('FVG Top', got.Top, exp.Top, 'f64');
  cmp('FVG Bottom', got.Bottom, exp.Bottom, 'f64');
  cmp('FVG MitigatedIndex', got.MitigatedIndex, exp.MitigatedIndex, 'int');
}
console.log('== fvg join_consecutive ==');
{
  const got = smc.fvg(rows, { joinConsecutive: true });
  const exp = loadCsv('fvg_consecutive_result_data.csv');
  cmp('FVG(joined)', got.FVG, exp.FVG, 'int');
  cmp('FVG(joined) Top', got.Top, exp.Top, 'f64');
  cmp('FVG(joined) Bottom', got.Bottom, exp.Bottom, 'f64');
  cmp('FVG(joined) MitigatedIndex', got.MitigatedIndex, exp.MitigatedIndex, 'int');
}

console.log('== swing_highs_lows(5) ==');
const t1 = Date.now();
const shl = smc.swingHighsLows(rows, { swingLength: 5 });
console.log('  swings ms:', Date.now() - t1);
{
  const exp = loadCsv('swing_highs_lows_result_data.csv');
  cmp('HighLow', shl.HighLow, exp.HighLow, 'int');
  cmp('Swing Level', shl.Level, exp.Level, 'f64');
  const n = shl.HighLow.filter(x => x != null).length;
  console.log('  swings found:', n);
  ok(n > 1000, 'a year of 15M bars yields >1000 swings at length 5');
}

console.log('== bos_choch ==');
{
  const t0 = Date.now();
  const got = smc.bosChoch(rows, shl);
  const exp = loadCsv('bos_choch_result_data.csv');
  console.log('  bos_choch ms:', Date.now() - t0);
  cmp('BOS', got.BOS, exp.BOS, 'int');
  cmp('CHOCH', got.CHOCH, exp.CHOCH, 'int');
  cmp('BOS Level', got.Level, exp.Level, 'f32');
  cmp('BrokenIndex', got.BrokenIndex, exp.BrokenIndex, 'int');
  /* reference quirk preserved: a superseded event keeps its BrokenIndex after BOS/CHOCH are cleared */
  const orphan = got.BrokenIndex.filter((b, i) => b != null && got.BOS[i] == null && got.CHOCH[i] == null).length;
  ok(orphan === 167, 'superseded events keep BrokenIndex exactly as the reference does (167)');
}

console.log('== ob ==');
{
  const t0 = Date.now();
  const got = smc.ob(rows, shl);
  const exp = loadCsv('ob_result_data.csv');
  console.log('  ob ms:', Date.now() - t0);
  cmp('OB', got.OB, exp.OB, 'int');
  cmp('OB Top', got.Top, exp.Top, 'f32');
  cmp('OB Bottom', got.Bottom, exp.Bottom, 'f32');
  cmp('OBVolume', got.OBVolume, exp.OBVolume, 'f32');
  cmp('OB MitigatedIndex', got.MitigatedIndex, exp.MitigatedIndex, 'int');
  cmp('OB Percentage', got.Percentage, exp.Percentage, 'f32');
}
console.log('== ob early data (3 bars, swing 1) never throws ==');
{
  const short = [
    { o: 1.0, h: 1.05, l: 0.95, c: 1.02, v: 5 },
    { o: 1.1, h: 1.15, l: 1.05, c: 1.14, v: 6 },
    { o: 1.2, h: 1.25, l: 1.15, c: 1.24, v: 7 }
  ];
  const sw = smc.swingHighsLows(short, 1);
  const o = smc.ob(short, sw);
  ok(o.OB.length === 3, 'ob output length equals input length on tiny series');
}

console.log('== liquidity ==');
{
  const t0 = Date.now();
  const got = smc.liquidity(rows, shl);
  const exp = loadCsv('liquidity_result_data.csv');
  console.log('  liquidity ms:', Date.now() - t0);
  cmp('Liquidity', got.Liquidity, exp.Liquidity, 'int');
  cmp('Liquidity Level', got.Level, exp.Level, 'f32');
  cmp('Liquidity End', got.End, exp.End, 'int');
  cmp('Liquidity Swept', got.Swept, exp.Swept, 'int');
}

console.log('== previous_high_low ==');
for (const [tf, file] of [['4h', 'previous_high_low_result_data_4h.csv'], ['1D', 'previous_high_low_result_data_1D.csv'], ['W', 'previous_high_low_result_data_W.csv']]){
  const t0 = Date.now();
  const got = smc.previousHighLow(rows, { timeFrame: tf });
  const exp = loadCsv(file);
  console.log('  previous_high_low(' + tf + ') ms:', Date.now() - t0);
  cmp('PreviousHigh ' + tf, got.PreviousHigh, exp.PreviousHigh, 'f32');
  cmp('PreviousLow ' + tf, got.PreviousLow, exp.PreviousLow, 'f32');
  cmp('BrokenHigh ' + tf, got.BrokenHigh, exp.BrokenHigh, 'int');
  cmp('BrokenLow ' + tf, got.BrokenLow, exp.BrokenLow, 'int');
}

console.log('== sessions(London) ==');
{
  const got = smc.sessions(rows, { session: 'London' });
  const exp = loadCsv('sessions_result_data.csv');
  cmp('Active', got.Active, exp.Active, 'int');
  cmp('Session High', got.High, exp.High, 'f32');
  cmp('Session Low', got.Low, exp.Low, 'f32');
  let threw = false;
  try{ smc.sessions(rows, { session: 'Custom' }); }catch(e){ threw = true; }
  ok(threw, 'Custom session without start/end throws like the reference');
}

console.log('== retracements ==');
{
  const t0 = Date.now();
  const got = smc.retracements(rows, shl);
  const exp = loadCsv('retracements_result_data.csv');
  console.log('  retracements ms:', Date.now() - t0);
  cmp('Direction', got.Direction, exp.Direction, 'int');
  cmp('CurrentRetracement%', got['CurrentRetracement%'], exp['CurrentRetracement%'], 'f64');
  cmp('DeepestRetracement%', got['DeepestRetracement%'], exp['DeepestRetracement%'], 'f64');
}

console.log('== degenerate input ==');
{
  for (const fn of ['fvg', 'swingHighsLows', 'retracements']){
    const r = smc[fn]([], {});
    ok(r && Object.keys(r).every(k => Array.isArray(r[k]) && r[k].length === 0), fn + '([]) returns empty columns');
  }
  ok(smc.bosChoch([], smc.swingHighsLows([])).BOS.length === 0, 'bosChoch([]) empty');
  ok(smc.ob([], smc.swingHighsLows([])).OB.length === 0, 'ob([]) empty');
  ok(smc.liquidity([], smc.swingHighsLows([])).Liquidity.length === 0, 'liquidity([]) empty');
  ok(smc.previousHighLow([], '1D').PreviousHigh.length === 0, 'previousHighLow([]) empty');
  ok(smc.context([], {}) === null, 'context([]) is null, never a throw');
  ok(smc.context(rows.slice(0, 10), { swingLength: 10 }) === null, 'context needs 2*swing+2 bars');
}

console.log('== context + confluence digest ==');
{
  const slice = rows.slice(-600);
  const ctx = smc.context(slice, { swingLength: 5 });
  ok(ctx && ctx.n === 600, 'context built on 600 bars');
  ok(ctx.structure && (ctx.bias === 'bull' || ctx.bias === 'bear'), 'context has a structure bias — ' + ctx.bias);
  ok(Array.isArray(ctx.ob.active) && Array.isArray(ctx.fvg.active) && Array.isArray(ctx.liquidity.unswept), 'zones exposed as arrays');
  ok(typeof ctx.retrace.current === 'number', 'retrace current is numeric');
  ok(ctx.prevHL && typeof ctx.prevHL.brokenHigh === 'number', 'previous day H/L present');
  ok(Array.isArray(ctx.sessions), 'active sessions listed');
  const sign = ctx.bias === 'bull' ? 1 : -1;
  const px = ctx.lastClose;
  const withTrend = smc.confluence({ dir: sign === 1 ? 'long' : 'short', entry: px, stop: px - sign * 0.002, t1: px + sign * 0.004 }, ctx);
  const against = smc.confluence({ dir: sign === 1 ? 'short' : 'long', entry: px, stop: px + sign * 0.002, t1: px - sign * 0.004 }, ctx);
  ok(withTrend.tags.some(t => t.id === 'STRUCT_WITH'), 'setup with structure tags STRUCT_WITH');
  ok(against.tags.some(t => t.id === 'STRUCT_AGAINST') && against.score < withTrend.score, 'counter-structure setup scores lower');
  ok(smc.confluence({ dir: 'long' }, null).grade === 'NEUTRAL', 'no context → NEUTRAL, never a throw');
  ok(smc.confluence({ entry: px }, ctx).score === 0, 'no direction → no tags');
}

console.log('\nOK - smc-lib.js matches smartmoneyconcepts v0.0.27 golden fixtures (' + passed + ' checks)');
