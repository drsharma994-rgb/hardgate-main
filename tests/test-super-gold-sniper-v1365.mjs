/* hg-v1365 sniper suite. The measured suggestion is what a send carries.
   An unread ATR still does not invent a bracket. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
function createHarness(overrides = {}) {
  const now = Date.now();
  const baseRows15 = Array.from({ length: 40 }, (_, i) => ({
    t: Math.floor((now - (40 - i) * 900_000) / 1000),
    o: 2640 + i * 0.5,
    h: 2642 + i * 0.5,
    l: 2639 + i * 0.5,
    c: 2641 + i * 0.5,
    v: 1000 + i * 25
  }));
  const win = {
    Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({ aligned: 'BULL', bull: 4, bear: 1, why: '4/5 BULL', rows: [{ tf: '15m', dir: 'BULL' }] }),
      volRegime: () => ({ ok: true, regime: 'NORMAL', label: 'NORMAL (ATR 4.0)', atrNow: 4.0 }),
      forecastCone: () => ({ ok: true, why: '3-bar cone', steps: [{ bar: 1, low: 2648, high: 2660 }] }),
      structure: () => ({ ok: true, items: [{ label: '15m OB', px: 2650.0 }, { label: '4H Supply Wall', px: 2669.0 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: '3 feeds within $1.20' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP', why: 'peak liquidity' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR', why: 'no high-impact print' })
    },
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2660.5 }),
    goldspotState: () => ({ spot: 2660.2, xm: 2660.0, paxg: 2659.6 }),
    getGoldMacroCached: () => ({ realRateHint: 'TAILWIND' }),
    goldscalpScan: () => ({
      at: now,
      cands: [{
        id: 'scalp-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2669.2, rr: 1.8,
        mark: 2659.8, killzone: 'NY_OPEN',
        barT: Math.floor((now - 1800_000) / 1000),
        strategy: 'Judas Sweep Long'
      }]
    }),
    goldswingScan: () => ({
      at: now,
      cands: [{
        id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2669.2, rr: 1.8,
        mark: 2659.8, killzone: 'NY_OPEN',
        barT: Math.floor((now - 1800_000) / 1000),
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
  {
    const { win, baseRows15 } = createHarness();
    win.getGoldCandles = async () => ({ rows: baseRows15 });
    await win.superGoldRunScan({ force: true });
    const snap = win.superGoldScan();
    const crowned = win.sgCrownedRow(snap);
    assert.ok(crowned, 'Should crown unified Long setup');
    const prec = win.sgPrecisionGoldLevels(crowned.row, snap.intel);
    console.log('prec', JSON.stringify({ entry: prec.entry, stop: prec.stop, t1: prec.t1, t2: prec.t2, t3: prec.t3, rr: prec.blendedRr, front: prec.t1FrontRun, why: prec.why, unread: prec.unread }, null, 2));
    assert.equal(prec.ok, true, 'sgPrecisionGoldLevels should succeed');
    assert.equal(prec.entry, 2650.25, 'Entry should front-run marked 15m OB structure at 2650.0 by +$0.25');
    const shieldTest = win.sgPsychShieldStop(2650.0, 'long');
    assert.equal(shieldTest.shielded, true, 'Stop on $2650.00 round magnet should be shielded');
    assert.equal(shieldTest.stop, 2648.85, 'Long stop at 2650.00 should shift to 2648.85 (-$1.15 past $2650 magnet)');
    assert.equal(prec.t1, 2668.4, 'TP1 should front-run opposing 4H Supply Wall at 2669.0 by $0.60');
    assert.equal(prec.t1FrontRun, true);
    assert.ok(prec.t2 > prec.t1, 'TP2 should sit above TP1 for Long');
    assert.ok(prec.t3 > prec.t2, 'TP3 runner should sit above TP2 for Long');
    assert.ok(prec.blendedRr >= 2.0, 'Blended R:R across 50/30/20 ladder should be >= 2.0R');
    console.log('PASS 1');
  }
  {
    const { win, baseRows15 } = createHarness();
    win.getGoldCandles = async () => ({ rows: baseRows15 });
    await win.superGoldRunScan({ force: true });
    const snap = win.superGoldScan();
    const acc = win.sgHighAccuracyAudit(snap, win);
    console.log('acc', acc.score, acc.tier, acc.gates.filter(g => !g.passed).map(g => g.id + ':' + g.detail));
    assert.equal(acc.ok, true);
    assert.equal(acc.total, 12);
    assert.equal(acc.score, 12, 'All 12 institutional gates should pass on aligned setup');
    assert.equal(acc.tier, 'SNIPER A+', '12/12 gates should earn SNIPER A+ tier');
    snap.intel.news = { ok: true, blackout: true, state: 'BLACKOUT', why: 'FOMC rate decision' };
    const accVeto = win.sgHighAccuracyAudit(snap, win);
    assert.equal(accVeto.hardVeto, true, 'Red-folder blackout should trigger critical gate veto');
    assert.equal(accVeto.tier, 'STAND ASIDE', 'Hard veto must force STAND ASIDE tier');
    console.log('PASS 2');
  }
  {
    const { win, now } = createHarness();
    const snap = win.buildSnapFromGoldScans(win);
    snap.cands.forEach(c => { c.mark = 2649.8; });
    const prec = snap.cands[0].precision;
    console.log('built prec', prec && { unread: prec.unread, t3: prec.t3, entry: prec.entry });
    win.goldspotState = () => ({ spot: prec.t3 + 1, xm: prec.t3 + 1, paxg: prec.t3 + 0.8 });
    snap.intel = {
      ok: true,
      rows15: [
        { t: Math.floor(now / 1000) - 60, o: 2650, h: prec.t3 + 2, l: 2649.5, c: prec.t3 + 1 }
      ],
      volRegime: { ok: true, regime: 'NORMAL', atrNow: 4.0 },
      candle: { dir: 'BULL', patterns: ['Engulfing'] },
      news: { ok: true, blackout: false }
    };
    const lc = win.sgCrownLifecycle(snap, win);
    console.log('life', lc.stage, lc.scalePct, lc.why);
    assert.equal(lc.stage, 'T3_COMPLETE', 'Reaching TP3 should advance lifecycle to T3_COMPLETE');
    assert.equal(lc.scalePct, 100);
    console.log('PASS 3');
  }
  {
    const { win, baseRows15 } = createHarness();
    win.getGoldCandles = async () => ({ rows: baseRows15 });
    await win.superGoldRunScan({ force: true });
    const snap = win.superGoldScan();
    const payload = win.sgCrownDispatchPayload(snap, { balance: 10000, riskPct: 1 }, win);
    console.log('payload', payload.ready, payload.reason, payload.entry, payload.t1, payload.accuracyTier);
    assert.equal(payload.ready, true);
    assert.equal(payload.accuracyTier, 'SNIPER A+');
    assert.equal(payload.entry, 2650.25);
    assert.equal(payload.t1, 2668.4);
    assert.ok(payload.t2 > payload.t1);
    assert.ok(payload.t3 > payload.t2);
    console.log('PASS 4');
  }
  console.log('ALL PASSED');
}
runTests().catch(err => { console.error(err); process.exit(1); });
