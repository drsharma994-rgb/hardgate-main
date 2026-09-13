/* smc-setups.js — SMC context rides on every setup that carries its candles.

   Wraps the shared solidity apply/chip and the pine signal enrich so row.smc
   appears without any desk changing, records one SMC_CONTEXT signal per
   distinct (sym, dir, entry, bar, score) into Setup Intelligence, and never
   touches the solidity score. Also the ?v= drift guard: every cache-buster in
   index.html must equal the build number — v725–v727 shipped with 188 tags
   stuck at ?v=724.

   Run: node tests/test-smc-setups.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function fixtureRows(){
  const text = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'smc', 'EURUSD_15M.csv.gz'))).toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.length);
  const rows = [];
  for (let i = lines.length - 800; i < lines.length; i++){
    const p = lines[i].split(',');
    const m = p[0].match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    rows.push({ t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]), o: +p[1], h: +p[2], l: +p[3], c: +p[4], v: +p[6] });
  }
  return rows;
}

function boot(pre){
  const ctx = { console, Math, Date, Number, String, Object, Array, isFinite, isNaN, parseFloat, parseInt, JSON, Error, Infinity, NaN, WeakMap };
  ctx.window = ctx; ctx.globalThis = ctx;
  if (pre) pre(ctx);
  vm.createContext(ctx);
  for (const f of ['setup-solidity.js', 'smc-lib.js', 'smc-setups.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const rows = fixtureRows();
const px = rows[rows.length - 1].c;

console.log('== exports + hooks installed ==');
{
  const W = boot();
  ok(typeof W.hgSmcEnrich === 'function', 'hgSmcEnrich exported');
  ok(typeof W.hgSmcChipHtml === 'function', 'hgSmcChipHtml exported');
  ok(W.hgSetupSolidityApply.__smcWrapped === true, 'hgSetupSolidityApply wrapped');
  ok(W.hgSetupSolidityChipHtml.__smcWrapped === true, 'hgSetupSolidityChipHtml wrapped');
  const before = W.hgSetupSolidityApply;
  W.hgSmcInstall();
  ok(W.hgSetupSolidityApply === before, 'install is idempotent — no double wrap');
}

console.log('== rows without candles: solidity untouched, no smc ==');
{
  const W = boot();
  const row = { sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, clean: true, gatesPassed: 7 };
  W.hgSetupSolidityApply(row, { asset: 'crypto' });
  ok(typeof row.solidityScore === 'number' && row.solidityTier, 'solidity still applied — ' + row.soliditySummary);
  ok(!('smc' in row), 'no candles → no smc field');
  ok(W.hgSetupSolidityChipHtml(row).indexOf('SMC') < 0, 'chip carries no SMC stamp without context');
}

console.log('== rows with candles: smc attached, solidity score moves with grade ==');
{
  const signals = [];
  const W = boot(ctx => { ctx.setupRecording = { recordSignal(tab, data){ signals.push({ tab, data }); return data; } }; });
  const base = { sym: 'EURUSD', tab: 'GOLD ULTRA', dir: 'long', entry: px, stop: px - 0.002, t1: px + 0.004, clean: true, gatesPassed: 7 };
  const expected = W.hgSetupSolidityScore(Object.assign({}, base), { asset: 'crypto' }).score;
  const row = Object.assign({ rows }, base);
  W.hgSetupSolidityApply(row, { asset: 'crypto' });
  const SMC_PTS = { STRONG: 5, WITH: 2, AGAINST: -3 };
  const adj = (row.smc && SMC_PTS[row.smc.grade]) || 0;
  ok(row.solidityScore === Math.max(0, Math.min(100, expected + adj)),
     'solidity score moves with SMC grade ' + (row.smc && row.smc.grade) + ' (' + expected + ' → ' + row.solidityScore + ')');
  ok(row.smc && typeof row.smc.score === 'number' && typeof row.smc.grade === 'string', 'row.smc present — ' + row.smc.grade + ' ' + row.smc.score);
  ok(row.smc.bias === 'bull' || row.smc.bias === 'bear', 'structure bias read — ' + row.smc.bias);
  ok(Array.isArray(row.smc.tags), 'tags array');
  ok(row.smc.swingLength === 10, 'default swing length 10');
  ok(typeof row.smc.activeOb === 'number' && typeof row.smc.activeFvg === 'number' && typeof row.smc.unsweptLiq === 'number', 'zone counts exposed');
  ok(signals.length === 1 && signals[0].data.type === 'SMC_CONTEXT', 'one SMC_CONTEXT signal recorded');
  ok(signals[0].tab === 'GOLD_ULTRA', 'tab normalised to GOLD_ULTRA');
  ok(signals[0].data.direction === 'LONG' && signals[0].data.symbol === 'EURUSD', 'signal carries symbol + direction');
  W.hgSetupSolidityApply(row, { asset: 'crypto' });
  ok(signals.length === 1, 'same setup on same bar is not re-recorded');
  const row2 = Object.assign({ rows }, base, { entry: px + 0.001 });
  W.hgSetupSolidityApply(row2, { asset: 'crypto' });
  ok(signals.length === 2, 'different entry → new record');
  const chip = W.hgSetupSolidityChipHtml(row);
  ok(/SOLID|GOOD|WATCH|WEAK/.test(chip), 'solidity chip still rendered');
  ok(/SMC [+-]?\d/.test(chip) && chip.indexOf('title="SMC ' + row.smc.grade) >= 0, 'SMC chip appended with grade in tooltip');
  const withDir = row.smc.bias === 'bull' ? 'long' : 'short';
  const sign = withDir === 'long' ? 1 : -1;
  const withRow = Object.assign({ rows }, base, { dir: withDir, entry: px, stop: px - sign * 0.002, t1: px + sign * 0.004 });
  const against = Object.assign({ rows }, base, { dir: withDir === 'long' ? 'short' : 'long', entry: px, stop: px + sign * 0.002, t1: px - sign * 0.004 });
  W.hgSetupSolidityApply(withRow, { asset: 'crypto' });
  W.hgSetupSolidityApply(against, { asset: 'crypto' });
  ok(withRow.smc.tags.some(t => t.id === 'STRUCT_WITH') && against.smc.tags.some(t => t.id === 'STRUCT_AGAINST'), 'structure tag follows setup direction vs bias');
  ok(against.smc.score < withRow.smc.score, 'counter-structure setup scores lower (' + against.smc.score + ' < ' + withRow.smc.score + ')');
}

console.log('== pine signal enrich hook ==');
{
  const signals = [];
  const W = boot(ctx => {
    ctx.setupRecording = { recordSignal(tab, data){ signals.push({ tab, data }); } };
    ctx.pineSubEnrichSignal = function(sig){ sig.pineEnriched = true; return sig; };
  });
  ok(W.pineSubEnrichSignal.__smcWrapped === true, 'pineSubEnrichSignal wrapped');
  const sig = { sym: 'XAUUSD', dir: 'short', scriptId: 'smc-core', entry: px, stop: px + 0.002, t1: px - 0.004, rows };
  const out = W.pineSubEnrichSignal(sig, {}, {});
  ok(out === sig && sig.pineEnriched === true, 'original enrich still runs and its return is preserved');
  ok(sig.smc && typeof sig.smc.grade === 'string', 'pine signal gets smc');
  ok(signals.length === 1 && signals[0].tab === 'PINE_SMC_CORE', 'recorded under PINE_<script>');
}

console.log('== never throws ==');
{
  const W = boot();
  ok(W.hgSmcEnrich(null) === null, 'null row passes through');
  ok(W.hgSmcEnrich({ rows: 'x', dir: 'long' }).smc === undefined, 'non-array rows ignored');
  ok(W.hgSmcEnrich({ rows: [1, 2, 3], dir: 'long' }).smc === undefined, 'too few / garbage bars ignored');
  ok(W.hgSmcEnrich({ rows, entry: px }).smc === undefined, 'no direction → no smc');
  ok(W.hgSmcChipHtml({}) === '' && W.hgSmcChipHtml(null) === '', 'chip empty without smc');
  const explicit = W.hgSmcEnrich({ dir: 'long', entry: px, stop: px - 0.002 }, { rows, swingLength: 5 });
  ok(explicit.smc && explicit.smc.swingLength === 5, 'explicit rows + swing length honoured');
}

console.log('== wiring: index.html, sw.js shell, version stamps ==');
{
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const qv = HG_VER.replace(/^hg-v/, '');
  ok(/^hg-v(72[8-9]|7[3-9]\d|[89]\d\d|\d{4,})$/.test(HG_VER), 'build is hg-v728 or later (saw ' + HG_VER + ')');
  ok(swCacheOk(sw), 'sw.js HG_CACHE matches build-stamp');
  ok(idx.indexOf('smc-lib.js?v=' + qv) >= 0, 'index.html loads smc-lib.js?v=' + qv);
  ok(idx.indexOf('smc-setups.js?v=' + qv) >= 0, 'index.html loads smc-setups.js?v=' + qv);
  ok(idx.indexOf('smc-lib.js?v=') < idx.indexOf('smc-setups.js?v='), 'lib loads before setups glue');
  ok(idx.indexOf('activate-setup-recording.js?v=') < idx.indexOf('smc-setups.js?v='), 'glue loads after Setup Intelligence recording');
  ok(idx.indexOf('setup-solidity.js?v=') < idx.indexOf('smc-setups.js?v='), 'glue loads after setup-solidity');
  ok(/'\.\/smc-lib\.js'/.test(sw) && /'\.\/smc-setups\.js'/.test(sw), 'both files in the offline shell');
  const stale = [...idx.matchAll(/\?v=([A-Za-z0-9.-]+)/g)].map(m => m[1]).filter(v => v !== qv);
  ok(stale.length === 0, 'every ?v= cache-buster in index.html equals ' + qv + (stale.length ? ' — stale: ' + [...new Set(stale)].join(',') + ' (' + stale.length + ' tags)' : ''));
}

console.log('\nOK - smc-setups.js: SMC context on setups, record-only, drift-guarded (' + passed + ' checks)');
