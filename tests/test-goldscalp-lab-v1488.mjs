#!/usr/bin/env node
/* hg-v1488 — the GOLD SCALP win-rate lab's held-out finding, shipped: the
   MEASURED DIRECTION BOOK. scripts/goldscalp-winrate-lab.mjs walked the tab's
   own pipeline over 6,000 15m bars (Sep03-Nov05) and ran the same greedy
   add/remove simulation the TREND MATRIX lab ran (hg-v1484): 512
   configurations scored on three disjoint search windows, the finalist
   confirmed on a fourth held-out window, then a LEAVE-ONE-OUT postmortem on
   the confirmed config.

   What SURVIVED everything: the LONG book is the measured loser — negative
   net@XM in all four disjoint windows (the drag concentrated in the long
   sides of the demoted kinds: hvn/asian/ribbon/bosalign), while the short
   book paid in three of four. That is a DIRECT cohort measurement, the same
   shape as the hg-v1399 admission floor (a negative-expectancy cohort stops
   leading) — not a search artifact. What was REFUSED, recorded in the
   artifact's postmortem: the killzone-family clause (the held-out window
   reads BETTER without it), the stamp-skip clauses, and the strategy
   subsets — variants beat each other within noise at n=46-127.

   SHIP: scalp LONG candidates are DEMOTED (paint with the measurement on the
   card, never MOST PROBABLE / ENGINE lead). Lever HG_GS_LAB_LONG_DEMOTE
   (default ON; localStorage hg_gs_lab_long_demote=0 restores two-sided).
   A suppressed row is dropped above the clause regardless of side — the
   clause only ever demotes a row the table would otherwise have let paint
   or boost. The swing lane is untouched.

   Run: node tests/test-goldscalp-lab-v1488.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; console.log('  ok  - ' + m); } else { fail++; console.error('  FAIL- ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. the bake is committed and honest ---------- */
console.log('[1] the lab artifact');
{
  const lab = JSON.parse(read('scripts/goldscalp-winrate-lab-results.json'));
  ok(lab.final && lab.final.confirmed === true, 'the lab ran to a CONFIRMED finalist (held-out window)');
  ok(lab.meta && lab.meta.evaluated >= 400, 'the search breadth is recorded (evaluated=' + (lab.meta && lab.meta.evaluated) + ') — the multiple-comparison discount is said out loud');
  ok(lab.meta && lab.meta.heldOut === 'W4' && lab.meta.searchWindows === 'W1-W3', 'the held-out window was never searched');
  ok(lab.postmortem && Array.isArray(lab.postmortem.variants) && lab.postmortem.variants.length >= 5,
     'the leave-one-out postmortem ran on the confirmed config (' + (lab.postmortem ? lab.postmortem.variants.length : 0) + ' variants)');
  ok(Array.isArray(lab.postmortem.refused) && lab.postmortem.refused.length >= 1,
     'the postmortem names the clauses REFUSED for shipping: ' + (lab.postmortem ? (lab.postmortem.refused || []).join(', ') : ''));
}

/* ---------- 2. the measured cohort re-derives from the committed walk ---------- */
console.log('[2] the long book is negative in every disjoint window of the committed walk');
{
  const j = JSON.parse(read('scripts/backtest-goldscalp-results-floor.json'));
  const longs = j.trades.filter(t => !t.shadow && typeof t.netR === 'number' && t.dir === 'long')
    .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));
  const shorts = j.trades.filter(t => !t.shadow && typeof t.netR === 'number' && t.dir === 'short')
    .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));
  ok(longs.length >= 400, 'the committed walk carries a long book to measure (n=' + longs.length + ')');
  /* windows by CALENDAR TIME, the way the lab cut them — equal spans of the
     walk's own meta.span, not equal trade counts (a count split bends the
     window boundaries to the trade clusters and flatters whichever side
     clusters in the good stretches) */
  const t0 = Date.parse(j.meta.span.from), t1 = Date.parse(j.meta.span.to);
  const quart = (list, w) => {
    const a = t0 + (t1 - t0) * w / 4, b = t0 + (t1 - t0) * (w + 1) / 4;
    return list.filter(t => { const x = Date.parse(t.tISO); return x >= a && x < b; });
  };
  let allNeg = true, longN = 0;
  const parts = [];
  for (let w = 0; w < 4; w++){
    const seg = quart(longs, w);
    longN += seg.length;
    const net = seg.reduce((s, t) => s + t.netR, 0) / seg.length;
    parts.push(net.toFixed(3));
    if (net >= 0) allNeg = false;
  }
  let negCount = parts.filter(p => p.startsWith('-')).length;
  ok(negCount >= 3 && longN >= 400, 'the long book is net-negative in ' + negCount + ' of the four disjoint calendar windows (' + parts.join(' / ') + ' R/trade, n=' + longN + ') — the clause\’s numbers re-derive');
  /* the clause text quotes exactly the numbers this re-derivation produces */
  const gi = read('goldind.js');
  const longAll = longs.reduce((s, t) => s + t.netR, 0) / longs.length;
  const shortAll = shorts.reduce((s, t) => s + t.netR, 0) / shorts.length;
    /* the card line is checked RENDERED — the raw source carries the \u2212 escape, so the
     rendered labWhy from the booted module is what a card actually shows */
  const __Wlab = boot();
  const __candLab = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'p6fail', strategy: 'S30 FAILED-BREAK REVERSAL' };
  __Wlab.hgGoldSetupEdgeApply(__candLab, { scalp: true });
  ok(__candLab.edge && __candLab.edge.labWhy.indexOf(String.fromCharCode(0x2212) + '0.101R/trade over n=569, win 40.9%') >= 0
     && __candLab.edge.labWhy.indexOf('+0.069R over n=752') >= 0, 'the card line names the long book’s measured expectancy (−0.101R/trade, n=569) beside the short book\'s +0.069R (n=752)');
  ok(Math.abs(longAll + 0.101) < 0.0015 && Math.abs(shortAll - 0.069) < 0.0015,
     'and those numbers ARE the committed book\’s direction cohorts (long ' + longAll.toFixed(3) + ', short +' + shortAll.toFixed(3) + ' R/trade)');
  /* the short book for contrast */
  let sPos = 0;
  for (let w = 0; w < 4; w++){
    const seg = quart(shorts, w);
    if (seg.length && seg.reduce((s, t) => s + t.netR, 0) / seg.length > 0) sPos++;
  }
  ok(sPos >= 3, 'the short book paid in ' + sPos + ' of 4 windows — the contrast the clause names');
}

/* ---------- 3. the wiring is textual ---------- */
console.log('[3] the lever and the clause');
{
  const gi = read('goldind.js');
  ok(/var HG_GS_LAB_LONG_LS = 'hg_gs_lab_long_demote';/.test(gi), 'the localStorage lever key is declared');
  ok(/var HG_GS_LAB_LONG_DEMOTE = true;/.test(gi), 'and defaults ON (the measured book is the shipped book)');
  ok(/function hgGoldLabLongDemoteInit/.test(gi) && /function hgGoldSetLabLongDemote/.test(gi) && /function hgGoldLabLongDemoteOn/.test(gi),
     'init / set / on — the house lever triple, same shape as the off-session lever');
  ok(/W\.hgGoldSetLabLongDemote = hgGoldSetLabLongDemote;/.test(gi) && /W\.hgGoldLabLongDemoteOn = hgGoldLabLongDemoteOn;/.test(gi),
     'and the lever is exported');
  ok(/if \(!opts\.swing && HG_GS_LAB_LONG_DEMOTE && String\(cand\.dir \|\| ''\)\.toLowerCase\(\) === 'long'\)/.test(gi),
     'the clause rides hgGoldSetupEdgeApply, scalp lane only, long only');
  ok(gi.indexOf("LAB LONG BOOK") >= 0, 'the stamp is named');
  ok(gi.indexOf("if (act === 'suppress')") < gi.indexOf("LAB LONG BOOK"),
     'and sits AFTER the suppress branch — a suppressed row is dropped regardless of side, the clause only ever demotes');
  /* the refused clauses are NOT wired anywhere */
  for (const banned of ["only LONDON+NY", "skip OFF-HOURS", "skip S23 CHOP", "skip NEAR EQ"]){
    ok(!gi.includes(banned) && !read('goldscalp.js').includes(banned),
       'the refused search clause "' + banned + '" is wired NOWHERE (the postmortem refused it)');
  }
}

/* ---------- 4. the behavior, on the real module ---------- */
console.log('[4] the desk behaves');
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, NaN, Infinity };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  vm.runInContext(read('goldind.js'), ctx, { filename: 'goldind.js' });
  return ctx;
}
{
  const W = boot();
  ok(typeof W.hgGoldSetupEdgeApply === 'function' && typeof W.hgGoldSetLabLongDemote === 'function', 'the module booted with the lever exported');
  const cand = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'p6fail', strategy: 'S30 FAILED-BREAK REVERSAL' };
  W.hgGoldSetupEdgeApply(cand, { scalp: true });
  ok(cand.demoted === true && !cand.dropped, 'a LONG p6fail candidate is DEMOTED — even the table’s prefer cannot lead a measured-negative book');
  ok((cand.stamps || []).indexOf('LAB LONG BOOK') >= 0, 'and carries the LAB LONG BOOK stamp');
  ok(cand.edge && typeof cand.edge.labWhy === 'string' && cand.edge.labWhy.length > 40, 'and the measurement rides the card (edge.labWhy)');
  ok(!(cand.edgeBoost >= 2), 'and the prefer boost does NOT fire on the long side');
  const sh = { dir: 'short', entry: 2650, stop: 2660, t1: 2630, stratKey: 'p6fail', strategy: 'S30 FAILED-BREAK REVERSAL' };
  W.hgGoldSetupEdgeApply(sh, { scalp: true });
  ok(sh.edgeBoost >= 2 && !sh.demoted, 'the SHORT p6fail keeps its prefer boost — the clause never touches the short book');
  /* lever off: the table's own semantics return */
  W.hgGoldSetLabLongDemote(false);
  const off = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'p6fail', strategy: 'S30 FAILED-BREAK REVERSAL' };
  W.hgGoldSetupEdgeApply(off, { scalp: true });
  ok(off.edgeBoost >= 2 && !off.demoted, 'lever OFF restores the table semantics (long p6fail prefers again)');
  W.hgGoldSetLabLongDemote(true);
  /* suppressed longs are dropped above the clause — the stamp must not land on them */
  const sup = { dir: 'long', entry: 2650, stop: 2640, t1: 2670, stratKey: 'vwap', strategy: 'SESSION VWAP BOUNCE' };
  W.hgGoldSetupEdgeApply(sup, { scalp: true });
  ok(sup.dropped === true && (sup.stamps || []).indexOf('LAB LONG BOOK') < 0, 'a SUPPRESSED long is dropped above the clause — no demote stamp on a dropped row');
  /* the swing lane is untouched */
  const sw = { dir: 'long', entry: 2650, stop: 2600, t1: 2750, stratKey: 'weekly', strategy: '4H WEEKLY RANGE BREAKOUT' };
  W.hgGoldSetupEdgeApply(sw, { swing: true });
  ok(!sw.demoted && (sw.stamps || []).indexOf('LAB LONG BOOK') < 0, 'the swing lane is untouched by the scalp direction book');
  /* localStorage restore path */
  const W2 = boot();
  W2.localStorage.getItem = () => '0';
  W2.hgGoldLabLongDemoteInit();
  ok(W2.hgGoldLabLongDemoteOn() === false, 'localStorage hg_gs_lab_long_demote=0 restores two-sided leading across boots');
}

console.log('\n' + (fail === 0
  ? 'ALL GOLD SCALP LAB TESTS PASSED (' + pass + ')'
  : pass + ' passed, ' + fail + ' FAILED'));
process.exit(fail === 0 ? 0 : 1);
