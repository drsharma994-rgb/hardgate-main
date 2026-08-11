/* HARDGATE — SWING ticket liveness regression.
   Guards the 2026-08 defect where swingGateMatrix capped the stop at 2.0xATR
   while G6 required (3.5xATR)/risk >= 2.5 — i.e. risk <= 1.4xATR. The two
   constraints were mutually exclusive: dynamicRR was pinned at exactly 1.75
   on every symbol, and swingTryClean returned null on every bar, silently.
   hgEnrichSwingClean then widened the stop to a 2.0xATR FLOOR (Math.min for
   longs), so even a matrix pass could not survive hgSwingPostEnrichValid.
   Every prior test wrapped its assertions in `if (hit)`, so the suite stayed
   green while BEST / SWING / STARTRADER / BRAIN-EXECUTE emitted nothing.
   Run: node tests/test-swing-ticket.mjs                                    */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, setTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'cryptogates.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
/* Structure/regime vetoes are covered in test-indicators2.mjs — keep these
   regressions focused on the swing matrix geometry (R:R, lookback, clearance). */
ctx.hgStructureGate = () => ({ veto: false, bos: true });
ctx.detectRegime = () => ({ regime: 'trend', label: 'trend' });

function fixtureTape() {
  let s = 11279156;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const drift = 0.0025, vol = 0.02;
  const rows = [];
  let p = 100;
  for (let i = 0; i < 300; i++) {
    const o = p;
    p = p * (1 + (rnd() - 0.5) * vol + drift);
    rows.push({
      t: i * 14400, o,
      h: Math.max(o, p) * (1 + rnd() * vol * 0.4),
      l: Math.min(o, p) * (1 - rnd() * vol * 0.4),
      c: p, v: 1000 + rnd() * 500,
    });
  }
  return rows;
}
const TICKER = { symbol: 'TESTUSD', fundingPct: 0.005 };

console.log('== swingGateMatrix: R:R is measured, never pinned ==');
{
  const m = ctx.swingGateMatrix(fixtureTape(), TICKER);
  ok(m && m.dir === 'long', 'aligned long cascade on the fixture');
  ok(isFinite(m.dynamicRR) && m.dynamicRR > 0, 'dynamicRR is finite and positive');
  ok(Math.abs(m.dynamicRR - 1.75) > 1e-6,
     'dynamicRR is NOT pinned at 1.75 — the dead-ATR-cap signature is gone');
  ok(Math.abs(m.entry - m.stop) / m.a4 < 2.0 - 1e-9,
     'stop comes from structure, not from a 2.0xATR cap');
  const g6 = m.gates.find(g => String(g[0]).indexOf('G6') === 0);
  ok(g6 && g6[1] === true, 'G6 passes when structure sits inside the R:R budget');
  ok(m.clean === true, 'fixture reaches 7/7 + anchor');
}

console.log('== wide structure stop is VETOED, never capped into a fake 1.75R ==');
{
  const rows = fixtureTape();
  const k = rows.length - 11;
  rows[k] = Object.assign({}, rows[k], { l: rows[k].l * 0.80 });
  const m = ctx.swingGateMatrix(rows, TICKER);
  ok(m && m.dir === 'long', 'wide-stop tape still reads a long cascade');
  ok(Math.abs(m.dynamicRR - 1.75) > 1e-6,
     'wide stop does NOT collapse to the capped 1.75R constant');
  ok(Math.abs(m.entry - m.stop) / m.a4 > 2.0,
     'the wide structure stop is reported at its real distance, not capped');
  const g6 = m.gates.find(g => String(g[0]).indexOf('G6') === 0);
  ok(g6 && g6[1] === false, 'G6 vetoes the wide stop honestly');
  ok(ctx.swingTryClean(rows, TICKER) == null, 'no ticket is emitted for a wide stop');
}

console.log('== swingTryClean: the CLEAN path actually emits a ticket ==');
{
  const hit = ctx.swingTryClean(fixtureTape(), TICKER);
  ok(hit != null, 'swingTryClean returns a ticket on a clean fixture (NOT null)');
  ok(hit.dir === 'long', 'ticket direction long');
  ok(isFinite(hit.entry) && isFinite(hit.stop) && isFinite(hit.t1) && isFinite(hit.t2),
     'ticket carries entry, stop, T1 and T2');
  ok(hit.stop < hit.entry && hit.t1 > hit.entry && hit.t2 > hit.t1,
     'levels ordered correctly for a long');
  ok(hit.rr >= 2.0, 'ticket clears the swing R:R floor');
  ok(typeof hit.entryType === 'string' && hit.entryType.length > 2, 'entryType present');
}

console.log('== enrich chain must not widen risk past the R:R budget ==');
{
  const rows = fixtureTape();
  const m = ctx.swingGateMatrix(rows, TICKER);
  const enriched = ctx.hgEnrichSwingClean(
    { sym: 'TESTUSD', dir: m.dir, entry: m.entry, stop: m.stop, mark: m.p }, rows, m);
  ok(Math.abs(enriched.entry - enriched.stop) / m.a4 <= 3.5 / 2.0 + 1e-9,
     'hgEnrichSwingClean keeps risk inside expMove/minRr ATR (no stop-widening floor)');
  const pv = ctx.hgSwingPostEnrichValid(enriched, { rows, a4: m.a4, minRr: 2.0, expMult: 3.5 });
  ok(pv != null, 'the enriched ticket survives hgSwingPostEnrichValid');
}

console.log('\n' + passed + ' passed, 0 failed');
