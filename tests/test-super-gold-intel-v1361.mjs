/* hg-v1361: SUPER GOLD desk intelligence layer.

   The desk pins one composed intel snapshot to each scan — the five-timeframe
   matrix, the shared candle engine's 15m read, the volatility regime, the
   session clock and the calendar — all from the same hgCfIntel readers the
   Candle Forecast tab uses. This guard drives the REAL functions:

     1. superGoldIntel composes the shared readers and fails closed
     2. the candle agreement verdict answers WITH / AGAINST / UNREAD
     3. the intel is pinned to the snap at scan time (render never fetches)
     4. the crown rules are untouched — intel never crowns or uncrowns
     5. the strip renders beside the desk and stays empty without a snap read

   Run: node tests/test-super-gold-intel-v1361.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };

function tape(n, step, tfSec) {
  const rows = [];
  const t0 = 1760000000;
  let c = 4100;
  for (let i = 0; i < n; i++) {
    c += (step == null ? 0.25 : step);
    rows.push({ t: t0 + i * (tfSec || 900), o: c - 0.2, h: c + 2, l: c - 2, c, v: 10 });
  }
  return rows;
}

function boot() {
  const ctx = {
    console, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseInt, parseFloat,
    setTimeout, Promise
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.document = { head: { appendChild: function () {} }, createElement: function () { return { id: '', textContent: '' }; } };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'candle-forecast-intel.js', 'goldind.js', 'supersetup.js', 'super-gold.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window;
}

console.log('== 1) the intel layer composes the shared readers ==');
{
  const W = boot();
  ok(typeof W.superGoldIntel === 'function', 'superGoldIntel is exported');
  W.getGoldCandles = async function (tf) {
    const sec = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[tf] || 900;
    return { rows: tape(60, 0.5, sec), source: 'test-' + tf };
  };
  const intel = await W.superGoldIntel(W);
  ok(intel.ok === true, 'the intel read ran');
  ok(intel.fiveTf && intel.fiveTf.aligned === 'BULL', 'five rising tapes align BULL on the desk too');
  ok(intel.candle && (intel.candle.dir === 'BULL' || intel.candle.dir === 'NEUTRAL' || intel.candle.dir === 'BEAR'),
    'the candle engine answered (' + (intel.candle && intel.candle.dir) + ')');
  ok(intel.volRegime && intel.volRegime.ok, 'the volatility regime measured');
  ok(intel.news && intel.news.ok === false, 'no news module in the harness is UNCHECKED, not clear');
}

console.log('\n== 2) the intel layer fails closed ==');
{
  const W = boot();
  W.getGoldCandles = async function () { return { rows: [], source: null }; };
  const intel = await W.superGoldIntel(W);
  ok(intel.ok === false && /could not be read/.test(intel.why), 'dead feeds are named, not padded');
  ok(intel.candle === null, 'no tape means no candle read');
  ok(intel.fiveTf && intel.fiveTf.rows.every(function (r) { return r.dir === 'UNREAD'; }),
    'a dead-feed matrix is five UNREAD rows, not a fabricated side');
  const W2 = boot();
  delete W2.hgCfIntel;
  W2.getGoldCandles = async function (tf) { return { rows: tape(60, 0.25), source: 't' }; };
  const intel2 = await W2.superGoldIntel(W2);
  ok(intel2.fiveTf == null, 'a missing intel module is UNREAD, not invented');
}

console.log('\n== 3) the candle agreement verdict ==');
{
  const W = boot();
  ok(typeof W.sgCandleAgreement === 'function', 'the agreement read is exported');
  const bull = { candle: { dir: 'BULL', patterns: ['hammer'] } };
  ok(W.sgCandleAgreement(bull, 'long').verdict === 'WITH', 'bull candles with a long crown is WITH');
  ok(W.sgCandleAgreement(bull, 'short').verdict === 'AGAINST', 'bull candles against a short crown is AGAINST');
  ok(/hammer/.test(W.sgCandleAgreement(bull, 'long').why), 'the named pattern travels with the verdict');
  const none = { candle: { dir: 'NEUTRAL', patterns: [] } };
  ok(W.sgCandleAgreement(none, 'long').verdict === 'UNREAD', 'a neutral engine is UNREAD, never agreement');
}

console.log('\n== 4) the intel is pinned to the snap at scan time ==');
{
  const W = boot();
  const now = Date.now();
  W.getGoldCandles = async function (tf) {
    const sec = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[tf] || 900;
    return { rows: tape(60, 0.5, sec), source: 'test-' + tf };
  };
  W.goldscalpScan = function () {
    return { at: now, cands: [{ id: 'sc', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2400, stop: 2390, t1: 2420, rr: 2, tally: 9 }] };
  };
  W.goldswingScan = function () {
    return { at: now, cands: [{ id: 'sw', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2410, stop: 2400, t1: 2430, rr: 2, tally: 4 }] };
  };
  const msg = await W.superGoldRunScan({ force: true });
  const snap = W.superGoldScan();
  ok(/^ok/.test(String(msg)), 'the scan ran (' + msg + ')');
  ok(snap && snap.intel && snap.intel.ok === true, 'the intel read is pinned to the snap');
  ok(snap.intel.fiveTf && snap.intel.at > 0, 'the matrix and the stamp travelled with the snap');
  const ev = W.superGoldEvaluate(W, {});
  ok(ev.ready === true && ev.entry === 2400, 'the crown still follows the v1359 rules, untouched by intel');
}

console.log('\n== 5) the strip renders and the source pins the layer ==');
{
  const SRC = fs.readFileSync(path.join(root, 'super-gold.js'), 'utf8');
  ok(/sg-intel/.test(SRC), 'the mount owns the intel strip host');
  ok(/data-sg-intel="fivetf"/.test(SRC), 'the five-timeframe row renders');
  ok(/data-sg-intel="candle"/.test(SRC), 'the candle agreement row renders');
  ok(/They do not crown and they do not move a level/.test(SRC), 'the strip disclaims crowning power');
  ok(/await superGoldIntel/.test(SRC), 'the intel is computed in the scan, not the render');
  ok(/try\{ snap\.intel = await superGoldIntel/.test(SRC), 'a failed intel read cannot fail the scan');
}

console.log('\ntest-super-gold-intel-v1361: ' + pass + ' passed, 0 failed');
