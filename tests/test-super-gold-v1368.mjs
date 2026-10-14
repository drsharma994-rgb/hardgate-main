/* hg-v1368: one measured suggestion, stamped after the tape, used by the send.
   A ladder that is out of order is not sent. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');

function harness(dir){
  const now = Date.now();
  const rows = Array.from({ length: 40 }, (_, i) => ({
    t: Math.floor((now - (40 - i) * 900_000) / 1000),
    o: 2640, h: 2662, l: 2638, c: 2650, v: 1000
  }));
  const long = dir !== 'short';
  const cand = long
    ? { id: 'a', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2650.5, stop: 2640, t1: 2669.2, rr: 1.8, mark: 2659, killzone: 'NY_OPEN', barT: Math.floor((now - 1800_000) / 1000), strategy: 'long' }
    : { id: 'a', sym: 'XAUUSD', dir: 'short', grade: 'A', entry: 2699.5, stop: 2710, t1: 2680, rr: 1.8, mark: 2695, killzone: 'NY_OPEN', barT: Math.floor((now - 1800_000) / 1000), strategy: 'short' };
  const win = {
    Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({ aligned: long ? 'BEAR' : 'BEAR', bull: 1, bear: 4, why: '4/5 BEAR', rows: [{ tf: '15m', dir: 'BEAR' }] }),
      volRegime: () => ({ ok: true, regime: 'NORMAL', atrNow: 4 }),
      forecastCone: () => ({ ok: true, why: 'cone', steps: [] }),
      structure: () => ({ ok: true, items: long
        ? [{ label: '15m OB', px: 2650 }, { label: 'supply', px: 2669 }]
        : [{ label: '4H supply', px: 2700 }, { label: 'demand', px: 2680.4 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: 'aligned' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR' })
    },
    goldCandleForecast: () => ({ dir: long ? 'BULL' : 'BEAR', patterns: ['Engulfing'], close: long ? 2655 : 2690 }),
    goldspotState: () => ({ spot: long ? 2655 : 2694, xm: long ? 2655 : 2694, paxg: long ? 2654.8 : 2694.2 }),
    goldscalpScan: () => ({ at: now, cands: [Object.assign({}, cand, { id: 'scalp' })] }),
    goldswingScan: () => ({ at: now, cands: [Object.assign({}, cand, { id: 'swing' })] })
  };
  if (!long){
    win.hgCfIntel.fiveTf = () => ({ aligned: 'BEAR', bull: 1, bear: 4, why: '4/5 BEAR', rows: [{ tf: '15m', dir: 'BEAR' }] });
  } else {
    win.hgCfIntel.fiveTf = () => ({ aligned: 'BULL', bull: 4, bear: 1, why: '4/5 BULL', rows: [{ tf: '15m', dir: 'BULL' }] });
  }
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(code, win);
  win.getGoldCandles = async () => ({ rows: rows });
  return win;
}

const src = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
assert.match(src, /data-sg-send="1"/);
assert.equal(src.includes('function sgStampPrecision'), true);

{
  const win = harness('long');
  await win.superGoldRunScan({ force: true });
  const snap = win.superGoldScan();
  const row = win.sgCrownedRow(snap).row;
  const fresh = win.sgPrecisionGoldLevels(row, snap.intel);
  assert.equal(row.precision.unread, false);
  assert.equal(row.precision.ordered, true);
  assert.equal(row.precision.entry, fresh.entry);
  assert.equal(row.precision.stop, fresh.stop);
  assert.equal(row.precision.t1, fresh.t1);
  assert.equal(row.entry, 2650.5, 'the desk entry on the row is not replaced');
  const payload = win.sgCrownDispatchPayload(snap, { balance: 10000, riskPct: 1 }, win);
  assert.equal(payload.ready, true);
  assert.equal(payload.entry, row.precision.entry);
  assert.equal(payload.stop, row.precision.stop);
  assert.equal(payload.t1, row.precision.t1);
}

{
  const win = harness('short');
  const prec = win.sgPrecisionGoldLevels(
    { dir: 'short', entry: 2699.5, stop: 2710, t1: 2680 },
    { volRegime: { ok: true, regime: 'NORMAL', atrNow: 4 }, structure: { ok: true, items: [{ label: '4H supply', px: 2700 }, { label: 'demand', px: 2680.4 }] }, rows15: [] }
  );
  assert.equal(prec.entry, 2699.75);
  assert.ok(prec.stop > prec.entry && prec.entry > prec.t1 && prec.t1 > prec.t2 && prec.t2 > prec.t3);
  assert.equal(win.sgPrecisionOrdered(prec), true);
  assert.equal(win.sgPrecisionOrdered({ ok: true, unread: false, side: 'long', entry: 10, stop: 12, t1: 14, rr1: 2, t2: 16, t3: 18 }), false);
  assert.equal(win.sgPrecisionOrdered({ ok: true, unread: true, side: 'long', entry: 10, stop: 8, t1: 14, rr1: 2, t2: 16, t3: 18 }), false);
}

console.log('test-super-gold-v1368: passed');
