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
  ok(/freshness is judged at CALL time/.test(SRC) && /SNAP_MAX_MS\) return null/.test(SRC),
    'a published alert expires with the scan that earned it');
}

console.log('\n== 6) hg-v1362: the crown audit grades the crowned row ==');
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
  ok(typeof W.sgCrownChecks === 'function', 'the crown audit is exported');
  const empty = W.sgCrownChecks({ cands: [], at: now });
  ok(empty.ok === false && /nothing is crowned/.test(empty.why), 'an empty board grades nothing');
  await W.superGoldRunScan({ force: true });
  const snap = W.superGoldScan();
  const cc = W.sgCrownChecks(snap);
  ok(cc.ok === true && cc.crowned && cc.crowned.entry === 2400, 'the crowned row is audited');
  ok(cc.checks.length === 9, 'nine checks are printed');
  ok(cc.checks.every(function (c) { return typeof c.label === 'string' && typeof c.passed === 'boolean'; }), 'every check is printed with a verdict');
  ok(/never uncrowns/.test(cc.why), 'the audit disclaims crowning power');
  ok(cc.grade === 'A' || cc.grade === 'B' || cc.grade === 'C', 'the grade is a letter (' + cc.grade + ')');
  /* a feed lock caps the grade at C */
  const locked = Object.assign({}, snap, {
    intel: Object.assign({}, snap.intel, { feedQuality: { ok: true, lock: true, worst: 'DIVERGED', why: 'diverged', legs: [] } })
  });
  ok(W.sgCrownChecks(locked).grade === 'C', 'a feed lock caps the crown audit at C');
  /* a stale scan crowns nothing and grades nothing */
  const stale = Object.assign({}, snap, { at: now - 25 * 60 * 1000, sourceAt: now - 25 * 60 * 1000 });
  ok(W.sgCrownChecks(stale).ok === false, 'a stale scan has no crown to audit');
}

console.log('\n== 7) hg-v1362: the desk alert path ==');
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
  await W.superGoldRunScan({ force: true });
  ok(typeof W.superGoldAlertState === 'function', 'the alert state function is published after a scan');
  const alertState = W.superGoldAlertState();
  const cc = W.sgCrownChecks(W.superGoldScan());
  if (cc.grade === 'A' || cc.grade === 'B') {
    ok(alertState && alertState.dir === 'long' && alertState.entry === 2400 && alertState.stop === 2390,
      'a gradeable crown publishes its own bracket');
    ok(/^CROWN [AB]$/.test(alertState.tier), 'the alert tier names the crown grade');
  } else {
    ok(alertState === null, 'a C-grade crown stays silent');
  }
  /* the collector validates and dispatches */
  const SRC = fs.readFileSync(path.join(root, 'tabalerts.js'), 'utf8');
  ok(/function collectSuperGold/.test(SRC), 'tabalerts owns the collector');
  ok(/collectSuperGold\(out\)/.test(SRC), 'the collector is wired into the batch');
  /* a split board publishes nothing */
  W.goldswingScan = function () {
    return { at: now, cands: [{ id: 'sw', sym: 'XAUUSD', dir: 'short', grade: 'A', entry: 2410, stop: 2420, t1: 2390, rr: 1, tally: 4 }] };
  };
  await W.superGoldRunScan({ force: true });
  ok(W.superGoldAlertState() === null, 'a split board publishes no alert');
}

console.log('\n== 8) hg-v1363: the crown execution state machine ==');
{
  const W = boot();
  const now = Date.now();
  ok(typeof W.sgCrownExecution === 'function', 'the execution read is exported');
  ok(W.sgCrownExecution({ cands: [], at: now }).state === 'NO-TRADE', 'an empty board is NO-TRADE');
  const mkRow = function (id, scanner, mark) {
    return { id: id, sym: 'XAUUSD', dir: 'long', scanner: scanner, grade: 'A', entry: 2400, stop: 2390, t1: 2420, rr: 2, tally: 9, minimalLossPass: true, mark: mark };
  };
  const snapArmed = {
    at: now, sourceAt: now,
    audit: { venues: ['gold-scalp', 'gold-swing'] },
    cands: [mkRow('a', 'gold-scalp', 2410), mkRow('b', 'gold-swing', 2410)]
  };
  const exA = W.sgCrownExecution(snapArmed);
  ok(exA.state === 'ARMED' && exA.entry === 2400, 'a long crown with the mark above the entry waits (ARMED)');
  const snapTrig = {
    at: now, sourceAt: now,
    audit: { venues: ['gold-scalp', 'gold-swing'] },
    cands: [mkRow('a', 'gold-scalp', 2399), mkRow('b', 'gold-swing', 2399)]
  };
  const exT = W.sgCrownExecution(snapTrig);
  ok(exT.state === 'TRIGGERED' && exT.mark === 2399, 'the mark at the entry is TRIGGERED');
  const snapNoMark = {
    at: now, sourceAt: now,
    audit: { venues: ['gold-scalp', 'gold-swing'] },
    cands: [mkRow('a', 'gold-scalp', null), mkRow('b', 'gold-swing', null)]
  };
  const exN = W.sgCrownExecution(snapNoMark);
  ok(exN.state === 'ARMED' && /trigger is unchecked/.test(exN.why), 'a missing mark is ARMED with the trigger unread, never a fabricated fill');
  const stale = Object.assign({}, snapArmed, { at: now - 25 * 60 * 1000, sourceAt: now - 25 * 60 * 1000 });
  ok(W.sgCrownExecution(stale).state === 'NO-TRADE', 'a stale scan has nothing to execute');
}

console.log('\n== 9) hg-v1363: the cone and the tape pin to the snap ==');
{
  const W = boot();
  const now = Date.now();
  W.getGoldCandles = async function (tf) {
    const sec = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[tf] || 900;
    return { rows: tape(70, 0.5, sec), source: 'test-' + tf };
  };
  W.goldscalpScan = function () {
    return { at: now, cands: [{ id: 'sc', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2400, stop: 2390, t1: 2420, rr: 2, tally: 9, mark: 2410 }] };
  };
  W.goldswingScan = function () {
    return { at: now, cands: [{ id: 'sw', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2410, stop: 2400, t1: 2430, rr: 2, tally: 4, mark: 2410 }] };
  };
  await W.superGoldRunScan({ force: true });
  const snap = W.superGoldScan();
  ok(snap.intel && snap.intel.cone && snap.intel.cone.ok && snap.intel.cone.steps.length === 3,
    'the forecast cone is pinned to the snap');
  ok(/not a target and not a stop/.test(snap.intel.cone.why), 'the desk cone carries the same disclaimer');
  ok(Array.isArray(snap.intel.rows15) && snap.intel.rows15.length === 60,
    'the closed 15m window is pinned for the chart');
  const ex = W.sgCrownExecution(snap);
  ok(ex.state === 'ARMED' || ex.state === 'TRIGGERED', 'the crowned scan answers an execution state (' + ex.state + ')');
}

console.log('\n== 10) hg-v1363: the render contract and the countdown ==');
{
  const SRC = fs.readFileSync(path.join(root, 'super-gold.js'), 'utf8');
  ok(/data-sg-intel="exec"/.test(SRC), 'the execution block renders');
  ok(/data-sg-intel="cone"/.test(SRC), 'the cone row renders');
  ok(/data-sg-intel="fwd"/.test(SRC), 'the forward split renders');
  ok(/crowned only/.test(SRC), 'the crowned-only split is named');
  ok(/function sgDrawChart/.test(SRC) && /sg-crown-chart/.test(SRC), 'the mini chart exists and has a host');
  ok(/next scan in/.test(SRC), 'the next-scan countdown renders');
  ok(/NO early return on a missing intel read/.test(SRC), 'the execution state survives a failed intel read');
}

console.log('\ntest-super-gold-intel-v1361: ' + pass + ' passed, 0 failed');
