/* hg-v1364: a failed candle leg is retried, then read from the fallback.
   The tape can lock a send. The source stop is not moved. Nothing is sent
   without a real size and a real bar time. */
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

console.log('== a dead primary leg is healed from the fallback ==');
{
  const W = boot();
  let primary = 0, fallback = 0;
  W.getGoldCandles = async function () { primary++; return { rows: [] }; };
  W.getXAUCandles = async function (tf) { fallback++; return { rows: tape(40, 0.4, 900) }; };
  const intel = await W.superGoldIntel(W);
  ok(intel.diagnostics && intel.diagnostics.legsRead === 5, 'all five legs were read (' + (intel.diagnostics && intel.diagnostics.legsRead) + ')');
  ok(intel.diagnostics.healedLegs.length === 5, 'each empty primary was healed');
  ok(fallback === 5 && primary > 5, 'the fallback ran only after the primary missed (' + primary + '/' + fallback + ')');
  ok(intel.ok === true, 'a healed tape is a real read');
}

console.log('\n== a primary that answers is not retried ==');
{
  const W = boot();
  let primary = 0;
  W.getGoldCandles = async function (tf) {
    primary++;
    return { rows: tape(40, 0.2, 900) };
  };
  const intel = await W.superGoldIntel(W);
  ok(primary === 5 && intel.diagnostics.retriesUsed === 0 && intel.diagnostics.healedLegs.length === 0, 'a good primary is read once');
}

console.log('\n== both sources empty stays unread ==');
{
  const W = boot();
  W.getGoldCandles = async function () { return { rows: [] }; };
  W.getXAUCandles = async function () { return { candles: [] }; };
  const intel = await W.superGoldIntel(W);
  ok(intel.ok === false && intel.diagnostics.missingLegs.length === 5, 'five missing legs are named, not padded');
}

console.log('\n== the tape locks a wide cross-venue spread ==');
{
  const W = boot();
  W.goldspotState = function () { return { spot: 2420 }; };
  const snap = { at: Date.now(), sourceAt: Date.now(), cands: [], intel: { rows15: [{ t: 1760000000, o: 2398, h: 2402, l: 2396, c: 2400 }] } };
  const tapeDx = W.sgTapeDiagnostics(snap, W);
  ok(tapeDx.lock === true && tapeDx.status === 'LOCKED' && tapeDx.maxSpreadUsd === 20, 'a 20 USD gap locks (' + tapeDx.why + ')');
  const near = W.sgTapeDiagnostics({ at: Date.now(), sourceAt: Date.now(), cands: [], intel: { rows15: [{ c: 2400 }] } }, Object.assign(W, { goldspotState: function () { return { spot: 2402 }; } }));
  ok(near.lock === false && near.status === 'CLEAN', 'a 2 USD gap does not lock');
}

console.log('\n== the lifecycle does not move the source stop ==');
{
  const W = boot();
  const now = Date.now();
  const row = {
    id: 'sc', sym: 'XAUUSD', dir: 'long', scanner: 'gold-scalp',
    entry: 2400, stop: 2390, t1: 2420, mark: 2395, barT: 1760000000, minimalLossPass: true
  };
  const swing = {
    id: 'sw', sym: 'XAUUSD', dir: 'long', scanner: 'gold-swing',
    entry: 2410, stop: 2400, t1: 2430, mark: 2405, barT: 1760000000, minimalLossPass: true
  };
  const snap = {
    at: now, sourceAt: now,
    cands: [row, swing],
    intel: {
      rows15: [
        { t: 1750000000, o: 2300, h: 2500, l: 2200, c: 2480 },
        { t: 1760001000, o: 2396, h: 2430, l: 2392, c: 2425 }
      ]
    }
  };
  const life = W.sgCrownLifecycle(snap, W);
  ok(life.activeStop === 2390 && life.initialStop === 2390, 'the source stop stays 2390');
  ok(life.t1Touched === true && /does not trail/.test(life.why), 'T1 can be named without a new stop (' + life.stage + ')');
  const before = W.sgCrownLifecycle(Object.assign({}, snap, { intel: { rows15: [{ t: 1750000000, h: 2500, l: 2200, c: 2480 }] } }), W);
  ok(before.mfeR == null && before.stoppedOut === false, 'a bar from before the signal is not the trade path');
}

console.log('\n== a send needs a real size and is not fired by the scan ==');
{
  const W = boot();
  const bare = W.sgCrownDispatchPayload({ at: Date.now(), sourceAt: Date.now(), cands: [] });
  ok(bare.ready === false && /No crowned/.test(bare.reason), 'an empty board is not sent');
  const src = fs.readFileSync(path.join(root, 'super-gold.js'), 'utf8');
  ok(/No size on the crowned row/.test(src), 'a missing size is named');
  ok(/no ticket key was invented/.test(src), 'a missing bar time does not become a key');
  ok(!/effectiveGoldRr\(r\) \|\| 2/.test(src), 'a missing reward is not filled in as 2');
  const scan = src.slice(src.indexOf('async function superGoldRunScanInner'), src.indexOf('async function superGoldRunScan('));
  ok(scan.indexOf('sgDispatchToBook') < 0 && scan.indexOf('sgDispatchToXm') < 0 && scan.indexOf('sgDispatchBracket') < 0, 'the scan does not send');
  ok(/data-sg-dispatch="book"/.test(src) && /data-sg-intel="tape"/.test(src) && /data-sg-intel="life"/.test(src), 'the board shows the tape, the path, and a send button');
}

console.log('\ntest-super-gold-v1364: ' + pass + ' passed');
