#!/usr/bin/env node
/* hg-v1492 — the GOLD PINE win-rate lab's findings, shipped: THE MEASURED
   BOOK. This desk had NO committed walk; the lab built one —
   scripts/goldpine-winrate-lab.mjs walked the desk's OWN scan lanes
   (collectPineUniverse + the native lanes, the exact functions
   runGoldPineScan calls) per closed 15m bar (scalp) and 4h bar (swing) over
   Sep06-Nov05: 83,624 candidates, committed as
   scripts/goldpine-walk-results.json — the desk's first walk artifact. The
   searched config (short-only + six label drops + skip-demoted) CONFIRMED
   on the held-out window (z=5.67 pooled, 864 configurations evaluated) and
   the leave-one-out postmortem REFUSED the skip-demoted clause (W4 reads
   43.6% WITH the demoted rows kept). What survived:

     - six labels whose cohorts are negative in EVERY disjoint window —
       scalp MSB+OB (−6.91R/trade over n=624!), Squeeze Mom, Smart Money
       Flow, Range Filter, HalfTrend, and swing MSB+OB — stop crowding the
       MOST PROBABLE pin;
     - the pin reads the lesser-losing direction (both cohorts are negative;
       the lab's held-out run says the direction clause carries, and the
       stamp says so honestly — "the pin reads the lesser-losing side until
       the forward ledger measures a paying cohort").

   SHIP: stamped at scan time (hgGpLabStamp), read by gpMayLead — stamped
   rows still paint and still record, they just never take the pin. Lever
   HG_GP_LAB_DEMOTE (default ON; localStorage hg_gp_lab_demote=0 restores
   the wider pin). The refused skip-demoted clause is wired NOWHERE.

   Run: node tests/test-goldpine-lab-v1492.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; console.log('  ok  - ' + m); } else { fail++; console.error('  FAIL- ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. the bake is committed ---------- */
console.log('[1] the lab + the desk\’s first walk artifact');
{
  const lab = JSON.parse(read('scripts/goldpine-winrate-lab-results.json'));
  const walk = JSON.parse(read('scripts/goldpine-walk-results.json'));
  ok(lab.final && lab.final.confirmed === true, 'the lab ran to a CONFIRMED finalist');
  ok(walk.meta && walk.meta.counters && walk.records.length >= 50000,
     'the walk artifact is committed (' + walk.records.length + ' candidates)');
  ok(lab.meta && lab.meta.evaluated >= 500, 'search breadth recorded (evaluated=' + lab.meta.evaluated + ')');
  ok(lab.postmortem && Array.isArray(lab.postmortem.refused) && lab.postmortem.refused.some(r => /native back in/.test(r)),
     'the fresh postmortem REFUSED the pine-only clause (the held-out window wants the native lanes back) — recorded, not shipped');
}

/* ---------- 2. the six cohorts re-derive from the walk artifact ---------- */
console.log('[2] the measured-losing cohorts re-derive (settled by the lab\’s own arithmetic)');
{
  const lab = await import('../scripts/goldpine-winrate-lab.mjs');
  const walk = JSON.parse(read('scripts/goldpine-walk-results.json'));
  const m15 = await lab.cachedKlines('15m', 6000);
  const h4 = await lab.cachedKlines('4h', 800);
  const grids = {
    scalp: { rows: m15, index: new Map(m15.map((b, i) => [b.t, i])) },
    swing: { rows: h4, index: new Map(h4.map((b, i) => [b.t, i])) }
  };
  const trades = lab.evalConfig({ records: walk.records, grids, settled: new Map() }, lab.baseConfig(walk.records));
  const t0 = Date.parse(walk.meta.span[0]), t1 = Date.parse(walk.meta.span[1]);
  const WANT = [['scalp', 'MSB + OB', -6.91], ['scalp', 'Squeeze Mom', -0.42], ['scalp', 'Smart Money Flow', -0.38],
                ['scalp', 'Range Filter', -0.32], ['scalp', 'HalfTrend', -0.76], ['swing', 'MSB + OB', -0.81]];
  for (const [lane, label, wantNet] of WANT){
    const list = trades.filter(t => t.lane === lane && t.label === label);
    const net = list.reduce((s, t) => s + t.net, 0) / list.length;
    const parts = []; let pos = 0;
    for (let w = 0; w < 4; w++){
      const a = t0 + (t1 - t0) * w / 4, b = t0 + (t1 - t0) * (w + 1) / 4;
      const seg = list.filter(t => t.t >= a && t.t < b);
      const wn = seg.reduce((s, t) => s + t.net, 0) / seg.length;
      parts.push(wn.toFixed(2)); if (wn > 0) pos++;
    }
    ok(list.length >= 25 && Math.abs(net - wantNet) < 0.06 && pos === 0,
       lane + '|' + label + ': ' + net.toFixed(2) + 'R/trade over n=' + list.length + ', windows ' + parts.join(' / ') + ' — negative in ALL four');
  }
  /* and the direction cohorts the pin reads between */
  for (const [dir, wantNet] of [['long', -0.784], ['short', -0.678]]){
    const list = trades.filter(t => t.dir === dir);
    const net = list.reduce((s, t) => s + t.net, 0) / list.length;
    ok(Math.abs(net - wantNet) < 0.02, dir + ' cohort: ' + net.toFixed(3) + 'R/trade over n=' + list.length + ' — both negative; the pin reads the lesser-losing side');
  }
}

/* ---------- 3. the wiring is textual ---------- */
console.log('[3] the lever, the table and the pin');
{
  const gp = read('goldpine.js');
  ok(/var HG_GP_LAB_LS = 'hg_gp_lab_demote';/.test(gp), 'the localStorage lever key is declared');
  ok(/var HG_GP_LAB_DEMOTE = true;/.test(gp), 'and defaults ON');
  ok(/function hgGpLabDemoteInit/.test(gp) && /function hgGpSetLabDemote/.test(gp) && /function hgGpLabDemoteOn/.test(gp),
     'init / set / on — the house lever triple');
  ok(/W\.hgGpSetLabDemote = hgGpSetLabDemote;/.test(gp), 'and the lever is exported');
  ok(/'scalp\|MSB \+ OB'/.test(gp) && /'swing\|MSB \+ OB'/.test(gp) && /'scalp\|HalfTrend'/.test(gp),
     'the measured table names the six lane|label cohorts');
  ok(gp.indexOf('hgGpLabStamp(swing') >= 0 && gp.indexOf('hgGpLabStamp(swing') < gp.indexOf('hgGpRecord(swing'),
     'the stamp rides the scan seam BEFORE the record, so the ledger carries it');
  ok(/if \(s && s\.labMeasured && hgGpLabDemoteOn\(\)\) return false;/.test(gp),
     'gpMayLead reads the stamp — stamped rows paint and record but never take the pin');
  /* the refused skip-demoted clause is wired NOWHERE */
  ok(!/skipDemoted/.test(gp), 'the refused skip-demoted clause is wired NOWHERE (the demoted rows keep painting AND leading per the desk\’s own rules)');
}

/* ---------- 4. the behavior, on the real module ---------- */
console.log('[4] the desk behaves');
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity, Float64Array };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'setup-ui.js',
                   'gold-forward-read.js', 'hg-forward.js', 'gold-formation.js',
                   'goldind.js', 'gold-catalog.js', 'gold-best-levels.js',
                   'goldswing.js', 'pinemath.js', 'pinegoldmath.js'])
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) {}
  let GP = read('goldpine.js');
  const ANCHOR = 'W.gpBoardPick = gpBoardPick;';
  GP = GP.replace(ANCHOR, ANCHOR
    + '\nW.collectPineUniverse = collectPineUniverse;'
    + '\nW.collectNativeScalp = collectNativeScalp;'
    + '\nW.collectNativeSwing = collectNativeSwing;');
  vm.runInContext(GP, ctx, { filename: 'goldpine.js(patched-exports)' });
  return ctx;
}
{
  const W = boot();
  ok(typeof W.gpMayLead === 'function' && typeof W.hgGpSetLabDemote === 'function', 'the module booted with the pin + lever exported');
  ok(W.HG_GP_LAB_BOOK && Object.keys(W.HG_GP_LAB_BOOK).length === 6, 'the measured table carries exactly six cohorts');
  const mk = (lane, label, dir) => ({ mode: lane, layerLabel: label, nativeStrategy: null, kind: 'confluence',
                                      dir, entry: 3300, stop: 3290, t1: 3320, grade: 'A', score: 5 });
  const msb = mk('scalp', 'MSB + OB', 'short');
  W.hgGpLabStamp([msb], 'scalp');          /* the stamp, exactly as the scan seam applies it */
  ok(typeof msb.labMeasured === 'string' && msb.labMeasured.indexOf('MEASURED LOSING') === 0,
     'an MSB+OB scalp row is stamped MEASURED LOSING with its cohort');
  ok(W.gpMayLead(msb) === false, 'and the pin refuses it');
  const okRow = mk('scalp', 'SMC Core', 'short');
  W.hgGpLabStamp([okRow], 'scalp');
  ok(W.gpMayLead(okRow) === true, 'a label outside the measured table still leads (SMC Core)');
  const longRow = mk('scalp', 'ORB', 'long');
  W.hgGpLabStamp([longRow], 'scalp');
  ok(typeof longRow.labMeasured === 'string' && longRow.labMeasured.indexOf('DIRECTION') >= 0 && W.gpMayLead(longRow) === false,
     'a LONG row is stamped with the direction cohort and refused the pin (the lesser-losing side reads)');
  W.hgGpSetLabDemote(false);
  ok(W.gpMayLead(msb) === true && W.gpMayLead(longRow) === true, 'lever OFF restores the wider pin');
  W.hgGpSetLabLongDemote && W.hgGoldSetLabLongDemote;   /* (other desks\’ levers untouched) */
  W.hgGpSetLabDemote(true);
  /* localStorage restore path */
  const W2 = boot();
  W2.localStorage.getItem = () => '0';
  W2.hgGpLabDemoteInit();
  ok(W2.hgGpLabDemoteOn() === false, 'localStorage hg_gp_lab_demote=0 restores the wider pin across boots');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD PINE LAB TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
