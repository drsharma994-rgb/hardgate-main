#!/usr/bin/env node
/* hg-v1490 — the OMNIGOLD win-rate lab's findings, shipped: the MEASURED
   DIRECTION BOOK on the MOST-PROBABLE seam.

   scripts/omnigold-winrate-lab.mjs worked from the COMMITTED walk artifact
   (every minted candidate with its gate-ledger bitmasks) plus the cached
   tapes, re-settled every candidate under a 16-geometry grid on its own
   horizon grid, and ran 1,496 configurations of greedy add/remove —
   per-kind, direction, horizon, source, tier/confluence floors, and the
   GATE LEDGER itself (require-passed / skip-when-failed per gate key: the
   add/remove axis for this desk's indicators). The searched finalist
   CONFIRMED on the held-out window at PAXG costs — and the leave-one-out
   postmortem refused half of it (structure-shift and three kind-drops read
   BETTER without them on W4); the searched gains were marginal (+0.2R on a
   book whose problem is structural, see below) and unstable.

   THE STRUCTURAL MEASUREMENT (lab Phase F, measured not searched): the
   whole book's GROSS expectancy is +0.015R — the desk is not signal-broke,
   it is cost-drowned at the walk's PAXG cost model (1.4R of venue bill per
   trade at 0.59% average stop). And the DIRECTION cohort at both cost
   models: LONG gross −0.102R/trade over n=4,574 (win 28.3%, negative in
   three of four disjoint windows, the held-out window among them; net@XM
   −0.207R) while SHORT paid +0.144R gross / +0.033R net@XM over n=4,158
   (three of four windows positive). Gross-negative = signal quality, not
   venue cost — and the SAME asymmetry the GOLD SCALP desk's own lab
   measured independently (hg-v1488) on the same instrument and period.

   SHIP: LONG candidates are refused the MOST PROBABLE ticket in hgOgPickFor
   (the same refuse-line shape as fundGate / pineBlock / instBlock); they
   still paint, with the measurement stamped on the candidate. Lever
   HG_OG_LAB_LONG_DEMOTE (default ON; localStorage hg_og_lab_long_demote=0
   restores two-sided leading). The searched gate clauses are wired NOWHERE.

   Run: node tests/test-omnigold-lab-v1490.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; console.log('  ok  - ' + m); } else { fail++; console.error('  FAIL- ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. the bake is committed and honest ---------- */
console.log('[1] the lab artifact');
{
  const lab = JSON.parse(read('scripts/omnigold-winrate-lab-results.json'));
  ok(lab.final && lab.final.confirmed === true, 'the lab ran to a CONFIRMED finalist (held-out W4)');
  ok(lab.meta && lab.meta.evaluated >= 1000, 'the search breadth is recorded (evaluated=' + (lab.meta && lab.meta.evaluated) + ')');
  ok(Array.isArray(lab.postmortem && lab.postmortem.refused) && lab.postmortem.refused.length >= 1,
     'the leave-one-out postmortem names the REFUSED clauses: ' + ((lab.postmortem && lab.postmortem.refused) || []).join(', '));
  ok(!!lab.meta.deviations && lab.meta.deviations.some(d => /overlap lock/.test(d)),
     'the slot-freed deviation is stated, not hidden (' + ((lab.meta.deviations || []).find(d => /overlap lock/.test(d)) || '').slice(0, 60) + '...)');
  const f = lab.directionCohort;
  ok(f && f.directions && f.directions.long && f.directions.short, 'Phase F measured the direction cohort at both cost models');
  const L = f.directions.long, S = f.directions.short;
  ok(L.n === 4574 && Math.abs(L.gross - (-0.102)) < 0.0015 && L.grossPositiveWindows === 1,
     'LONG: n=4,574, gross ' + L.gross + 'R, gross-positive in ' + L.grossPositiveWindows + '/4 windows');
  ok(S.n === 4158 && Math.abs(S.gross - 0.144) < 0.0015 && S.grossPositiveWindows === 3,
     'SHORT: n=4,158, gross +' + S.gross + 'R, gross-positive in ' + S.grossPositiveWindows + '/4 windows');
  ok(Math.abs(L.netXm - (-0.207)) < 0.0015 && Math.abs(S.netXm - 0.033) < 0.0015,
     'and at the desk\\u2019s own venue (XM 0.020% RT): long ' + L.netXm + 'R, short +' + S.netXm + 'R');
}

/* ---------- 2. the cohort re-derives from the committed walk ---------- */
console.log('[2] the direction cohorts re-derive from the committed walk artifact');
{
  const j = JSON.parse(read('scripts/backtest-omnigold-results.json'));
  const t0 = Date.parse(j.meta.span.from), t1 = Date.parse(j.meta.span.to);
  for (const [dir, wantGross, wantPos] of [['long', -0.102, 1], ['short', 0.144, 3]]){
    const list = j.trades.filter(t => t.netR != null && t.dir === dir);
    const overall = list.reduce((s, t) => s + t.rMultiple, 0) / list.length;
    let pos = 0; const parts = [];
    for (let w = 0; w < 4; w++){
      const a = t0 + (t1 - t0) * w / 4, b = t0 + (t1 - t0) * (w + 1) / 4;
      const seg = list.filter(t => { const x = Date.parse(t.tISO); return x >= a && x < b; });
      const g = seg.reduce((s, t) => s + t.rMultiple, 0) / seg.length;
      parts.push(g.toFixed(2)); if (g > 0) pos++;
    }
    ok(Math.abs(overall - wantGross) < 0.0015 && pos === wantPos,
       dir + ' book: gross ' + overall.toFixed(3) + 'R over n=' + list.length + ', windows ' + parts.join(' / ') + ' (' + pos + '/4 positive) — re-derives');
  }
}

/* ---------- 3. the wiring is textual ---------- */
console.log('[3] the lever and the clause');
{
  const src = read('omnigold.js');
  ok(/var OG_LAB_LONG_LS = 'hg_og_lab_long_demote';/.test(src), 'the localStorage lever key is declared');
  ok(/var OG_LAB_LONG_DEMOTE = true;/.test(src), 'and defaults ON');
  ok(/function hgOgLabLongDemoteInit/.test(src) && /function hgOgSetLabLongDemote/.test(src) && /function hgOgLabLongDemoteOn/.test(src),
     'init / set / on — the house lever triple');
  ok(/window\.hgOgSetLabLongDemote = hgOgSetLabLongDemote;/.test(src), 'and the lever is exported');
  ok(/if \(OG_LAB_LONG_DEMOTE && String\(c\.dir \|\| ''\)\.toLowerCase\(\) === 'long'\)\{/.test(src),
     'the clause rides hgOgPickFor\\u2019s refuse chain, long only');
  ok(src.indexOf('if (c.fundGate') < src.indexOf("c.labLongBook = 'LONG BOOK MEASURED NEGATIVE") && src.indexOf("c.labLongBook = 'LONG BOOK MEASURED NEGATIVE") < src.indexOf('hgGoldInstBlocks'),
     'and sits in the refuse chain beside fundGate / pineBlock / instBlock');
  ok(src.indexOf('LONG BOOK MEASURED NEGATIVE') >= 0, 'the stamp names the measurement');
  /* the refused search clauses are wired NOWHERE */
  for (const banned of ['require:consensus', 'require:structure-shift', 'skipfail:participation']){
    ok(!src.includes(banned), 'the refused search clause "' + banned + '" is wired NOWHERE');
  }
}

/* ---------- 4. the behavior, on the real module ---------- */
console.log('[4] the desk behaves');
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                   'goldind.js', 'goldswing.js'])
    try { vm.runInContext(read(f), ctx, { filename: f }); } catch (e) {}
  let SRC = read('omnigold.js');
  const ANCHOR = 'window.hgOgManualRefresh = hgOgManualRefresh;';
  if (SRC.includes(ANCHOR)) SRC = SRC.replace(ANCHOR, ANCHOR
    + '\n    window.hgOgAdvancedConfluenceScore = hgOgAdvancedConfluenceScore;'
    + '\n    window.hgOgCompositeScore = hgOgCompositeScore;');
  /* the measured-standing gate has its own guards; in THIS file's in-memory
     copy it reads the candidate's own __measOk flag instead, so the direction
     clause is the only thing under test */
  SRC = SRC.replace('if (!hgOgLeadMeasOk(c)) continue;', 'if (!c.__measOk) continue;');
  vm.runInContext(SRC, ctx, { filename: 'omnigold.js(patched)' });
  return ctx;
}
{
  const W = boot();
  ok(typeof W.hgOgPickFor === 'function' && typeof W.hgOgSetLabLongDemote === 'function', 'the module booted with the pick + lever exported');
  const mk = (dir) => ({ horizon: 'SCALP', dir, grade: { ticket: true }, plan: { entry: 3300, stop: 3290, t1: 3320 },
                         formation: { formed: true }, kind: 'ORB', strategy: 'ORB', __measOk: true });
  const longC = mk('long'), shortC = mk('short');
  const pick = W.hgOgPickFor([longC, shortC], 'SCALP', null);
  ok(pick === shortC, 'the MOST PROBABLE ticket is the SHORT candidate — the measured-negative long book cannot crown');
  ok(longC.labLongBook && longC.labLongBook.length > 40, 'and the long candidate carries the measurement on it');
  ok(!shortC.labLongBook, 'the short candidate carries none');
  W.hgOgSetLabLongDemote(false);
  const longOnly = mk('long');
  const pick2 = W.hgOgPickFor([longOnly], 'SCALP', null);
  ok(pick2 === longOnly, 'lever OFF restores two-sided leading (the long candidate can crown again)');
  W.hgGoldSetLabLongDemote && W.hgGoldSetLabLongDemote(true);
  W.hgOgSetLabLongDemote(true);
  /* localStorage restore path */
  const W2 = boot();
  W2.localStorage.getItem = () => '0';
  W2.hgOgLabLongDemoteInit();
  ok(W2.hgOgLabLongDemoteOn() === false, 'localStorage hg_og_lab_long_demote=0 restores two-sided across boots');
}

console.log('\n' + (fail === 0
  ? 'ALL OMNIGOLD LAB TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
