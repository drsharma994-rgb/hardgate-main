import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
function createHarness(overrides = {}) {
  const now = Date.now();
  const baseRows15 = Array.from({ length: 40 }, (_, i) => ({
    t: Math.floor((now - (40 - i) * 900_000) / 1000),
    o: 2640 + i * 0.5,
    h: 2642 + i * 0.5,
    l: 2639 + i * 0.5,
    c: 2641 + i * 0.5
  }));
  const win = {
    Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({ aligned: 'BULL', bull: 4, bear: 1, why: '4/5 BULL', rows: [{ tf: '15m', dir: 'BULL' }] }),
      volRegime: () => ({ ok: true, regime: 'NORMAL', label: 'NORMAL (ATR 4.0)', atrNow: 4.0 }),
      forecastCone: () => ({ ok: true, why: '3-bar cone', steps: [{ bar: 1, low: 2648, high: 2660 }] }),
      structure: () => ({ ok: true, items: [{ label: 'OB', px: 2650.5 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: '3 feeds within $1.20' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP', why: 'peak liquidity' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR', why: 'no high-impact print' })
    },
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2660.5 }),
    goldspotState: () => ({ spot: 2660.2, xm: 2660.0, paxg: 2659.6 }),
    goldscalpScan: () => ({
      at: now,
      cands: [{
        id: 'scalp-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650, stop: 2640, t1: 2670, t2: 2685, rr: 2.0,
        mark: 2659.8, barT: Math.floor((now - 1800_000) / 1000),
        strategy: 'Judas Sweep Long'
      }]
    }),
    goldswingScan: () => ({
      at: now,
      cands: [{
        id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650, stop: 2640, t1: 2670, t2: 2685, rr: 2.0,
        mark: 2659.8, barT: Math.floor((now - 1800_000) / 1000),
        strategy: 'GS1 4H Cascade'
      }]
    }),
    ...overrides
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(code, win);
  return { win, baseRows15, now };
}
async function runTests() {
  const { win, baseRows15, now } = createHarness();
  const attempts = {};
  win.getGoldCandles = async (tf) => {
    attempts[tf] = (attempts[tf] || 0) + 1;
    if ((tf === '15m' || tf === '1h') && attempts[tf] === 1) return null;
    return { rows: baseRows15 };
  };
  const intel = await win.superGoldIntel(win, { retries: 1, timeoutMs: 1000 });
  assert.equal(intel.ok, true);
  assert.deepEqual([...intel.diagnostics.healedLegs].sort(), ['15m', '1h']);
  win.getGoldCandles = async () => ({ rows: baseRows15 });
  await win.superGoldRunScan({ force: true });
  const snap = win.superGoldScan();
  assert.equal(win.sgTapeDiagnostics(snap, win).status, 'CLEAN');
  const lc = win.sgCrownLifecycle(snap, win);
  assert.equal(lc.ok, true);
  const calls = { book: 0, xm: 0, exec: 0 };
  win.hgBookAddPosition = async (p) => ({ id: 'pos-1', fund: p.fund, count: ++calls.book });
  win.xmSendOrder = async (o) => ({ ticketId: 9001, lots: o.lots, count: ++calls.xm });
  win.hgExecuteBracket = async (b) => ({ status: 'BRACKET_OK', sym: b.sym, count: ++calls.exec });
  assert.equal((await win.sgDispatchToBook(snap, { win })).ok, true);
  assert.equal((await win.sgDispatchToBook(snap, { win })).duplicate, true);
  assert.equal((await win.sgDispatchToXm(snap, { win })).ok, true);
  assert.equal((await win.sgDispatchBracket(snap, { win })).ok, true);
  assert.equal(calls.book, 1);
  assert.equal(calls.xm, 1);
  assert.equal(calls.exec, 1);
  const bar = Math.floor((now - 1800_000) / 1000);
  assert.equal(snap.cands[0].barT, bar, 'the source bar time is kept');
}
runTests();
