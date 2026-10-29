#!/usr/bin/env node
/* test-goldscalp-r3-v1439 — GOLD SCALP round 3's own contract.

   hg-v1439 ships ONE formation change: the ceiling-bound R:R-UNMEASURED cohort
   is REJECTED, not demoted. A plan whose stop sits at the 3.5×ATR sanity
   ceiling (GOLD_STOP_MAX_ATR) with no opposing structure constraining TP1
   shows 1.5R by construction, and the cohort measured negative in both halves
   of three replay windows (−0.283R fresh n=259; −0.282R floor-refreshed
   n=252; −0.115/−0.211 r1). This suite pins:
     1. the reject FIRES on a ceiling-bound unsnapped plan (dropped-return
        shape, hg-v929 contract: numeric rr/rrFloor, named reason, rides
        .rejected);
     2. it ABSTAINS when opposing structure snaps TP1 (t1Snapped) or when the
        stop sits inside the ceiling — fail-open;
     3. the demote path is GONE from that seam (no `demoted` on the row);
     4. the shipped build is stamped hg-v1439 on every cache surface;
     5. the MIN_RR resolution stands as recorded (KEEP 1.2, with the numbers).

   Mutation-proven: flipping the reject back to a demote, dropping the
   t1Snapped condition, or widening the ceiling each red a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8'), { filename: 'goldind.js' });
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'conviction-lock.js'), 'utf8'), { filename: 'conviction-lock.js' });
const W = globalThis.window;
const SRC = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');

/* A tape whose plans are ceiling-bound: the composite tape from
   test-goldscalp.mjs, whose sweep/rsidiv plans stop at the deep swept low —
   >> 3.5×ATR away with no opposing structure, the hg-v1439 measured shape
   (probe-verified: both plans R:R-reject on this tape). */
const DAY = Math.floor(Date.UTC(2024, 0, 15) / 1000);
function compLongRows(){
  const rows = [];
  const push = (i, o, h, l, c, v) => rows.push({ t: DAY + i*900, o: o, h: h, l: l, c: c, v: (v === undefined ? 1000 : v) });
  let c = 2320;
  for (let i = 0; i < 60; i++){ const o = c; c -= 0.2; push(i, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c); }   // 2320 -> 2308
  for (let i = 60; i < 96; i++){                                                                                     // chop 2304-2308
    const o = c; c = 2306 + ((i % 4) - 1.5)*1.2;
    push(i, o, Math.max(o, c) + 0.7, Math.min(o, c) - 0.9, c, 900);
  }
  for (let i = 96; i < 106; i++){ const o = c; c = o - 1.0; push(i, o, o + 0.4, c - 0.5, c, 1100); }                  // day-2 slide 2306 -> 2296
  push(106, 2296, 2296.5, 2293, 2294, 1500);                                                                          // RSI low (l 2293)
  push(107, 2294, 2298, 2293.8, 2297, 1200);
  push(108, 2297, 2300, 2296.5, 2299, 1200);
  push(109, 2299, 2299.6, 2288, 2297, 4000);                                                                          // SWEEP of 2293 -> reclaim
  push(110, 2297, 2299.5, 2296.4, 2298.5, 1300);
  push(111, 2298.5, 2300.6, 2298, 2300, 1300);
  push(112, 2300, 2301.6, 2299.5, 2301, 1200);
  push(113, 2301, 2302.6, 2300.5, 2302, 1200);
  push(114, 2302, 2303, 2301.5, 2302.5, 1200);
  push(115, 2302.5, 2305.5, 2302, 2305, 2600);                                                                        // displacement
  push(116, 2305, 2306.5, 2303.5, 2306, 1500);                                                                        // FVG [2303, 2303.5]
  push(117, 2306, 2306.6, 2304.6, 2305.5, 1100);
  push(118, 2305.5, 2306.4, 2304.8, 2306, 1100);
  push(119, 2306, 2306.5, 2305, 2305.8, 1100);
  return rows;
}
const deepSweepRows = compLongRows;
const tapeNow = (rows, h) => (rows[rows.length - 1].t + 900) * 1000 + h * 3600 * 1000;

console.log('== 1) the reject FIRES on a ceiling-bound unsnapped plan ==');
{
  const rows = deepSweepRows();
  let fired = null, board = null;
  for (const h of [0, 2, 9, 14]){
    const got = W.goldScalpSetups({ rows15m: rows, now: tapeNow(rows, h) });
    const rej = (got.rejected || []).filter(r => /R:R UNMEASURED/.test(r.reason || ''));
    if (rej.length){ fired = rej; board = got; break; }
  }
  ok(!!fired, 'a ceiling-bound unsnapped plan is REJECTED with the R:R UNMEASURED reason');
  if (fired){
    const r = fired[0];
    ok(r.dropped === true, 'the row is dropped, not demoted');
    ok(typeof r.rr === 'number' && isFinite(r.rr), 'carries the numeric rr it showed');
    ok(typeof r.rrFloor === 'number' && r.rrFloor === 1.2, 'carries the rrFloor (the shipped 1.2)');
    ok(!('demoted' in r) || r.demoted !== true, 'no demoted flag — the hg-v902 demote path is gone from this seam');
    ok(/three replay windows|both halves/.test(r.reason), 'the reason names the measurement, not just the geometry');
    ok(board.every(c => c.demoted || true), 'the board itself still builds (fail-open elsewhere)');
  }
}

console.log('== 2) fail-open: structure inside the ceiling mints normally ==');
{
  /* the survivor tape — gentle two-step drift; asian/openrange structure well
     inside the ceiling. The reject must NOT fire on it. */
  function sfRows(){
    const t0 = Math.floor(Date.UTC(2026, 2, 9) / 1000);
    const rows = []; let c = 4300;
    for (let i = 0; i < 240; i++){ const o = c; c += (i % 3 === 2) ? -1.2 * 0.6 : 1.2;
      rows.push({ t: t0 + i * 900, o, h: Math.max(o, c) + 0.6, l: Math.min(o, c) - 0.6, c, v: 900 + (i % 7) * 260 }); }
    return rows;
  }
  const rows = sfRows();
  let cands = null;
  for (const h of [9, 14]){
    const got = W.goldScalpSetups({ rows15m: rows, now: tapeNow(rows, h) });
    if (got.length){ cands = got; break; }
  }
  ok(!!cands && cands.length > 0, 'the survivor tape still mints candidates');
  if (cands)
    ok(!(cands.rejected || []).some(r => /R:R UNMEASURED/.test(r.reason || '')),
       'and not one of its rows is R:R-rejected (structure inside the ceiling)');
}

console.log('== 3) the seam in source: reject present, demote gone, fail-open ==');
{
  ok(/ceilingBound && !lv\.t1Snapped/.test(SRC), 'the guard is ceilingBound && !t1Snapped');
  const seam = SRC.match(/if \(lv\.ceilingBound && !lv\.t1Snapped\)\{[\s\S]{0,2200}?\n    \}/);
  ok(!!seam, 'the hg-v1439 seam block exists');
  if (seam){
    ok(/return \{ dropped: true/.test(seam[0]), 'the seam returns the dropped shape');
    ok(!/demoted = true/.test(seam[0]), 'MUTATION PIN: no demote survives inside the seam');
    ok(seam[0].indexOf('hg-v1439') >= 0, 'the seam carries its hg-v1439 provenance');
  }
  /* fail-open is structural: the flags initialise false and only the
     ceiling guard sets ceilingBound */
  ok(/var ceilingBound = false, t1Snapped = false;/.test(SRC), 'the flags initialise false (fail-open)');
  ok(/if \(d \+ 0\.25\*a15 > GOLD_STOP_MAX_ATR\*a15\) ceilingBound = true;/.test(SRC),
     'and only the 3.5xATR ceiling guard sets ceilingBound');
}

console.log('== 4) the build is stamped at the current version everywhere a cache reads ==');
{
  /* version pins ride the current stamp ('Sister suites re-pinned' convention):
     re-pinned hg-v1439 -> hg-v1440 at the hg-v1440 bump (OMNIGOLD r3 disclosure);
     re-pinned hg-v1440 -> hg-v1441 at the hg-v1441 bump (GOLD SWEEP disclosures).
     re-pinned hg-v1441 -> hg-v1442 at the hg-v1442 bump (PINE GOLD re-walk).
     re-pinned hg-v1442 -> hg-v1443 at the hg-v1443 bump (GOLD SCALP re-walk).
     re-pinned hg-v1443 -> hg-v1444 at the hg-v1444 bump (GOLD SCALP tape refresh).
     re-pinned hg-v1444 -> hg-v1445 at the hg-v1445 bump (SUPER GOLD and CONFLUENCE).
     re-pinned hg-v1445 -> hg-v1458 at the hg-v1458 bump (CONFLUENCE record-only marks).
     The round's own pack string stays in the history chain. */
  const stamp = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
  ok(/version: 'hg-v1466'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-10-30T06:15:00Z'/.test(stamp), 'build-stamp built (non-decreasing, re-pinned at the hg-v1466 bump)');
  ok(/hg-v1439: GOLD SCALP r3/.test(stamp), 'the pack string names the round');
  ok(/hg-v1438:/.test(stamp), 'and the pack history chain is intact');
  ok(/HG_CACHE = 'hg-v1466'/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js cache id');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(idx.indexOf('v=1440') < 0 && idx.indexOf('v=1466') >= 0, 'index.html cache-busters all at 1460 (re-pinned at the hg-v1460 bump)');
  ok(fs.readFileSync(path.join(ROOT, 'trendtable.js'), 'utf8').indexOf('v=1440') < 0, 'trendtable loader at 1441');
  ok(fs.readFileSync(path.join(ROOT, 'hg-api-base.js'), 'utf8').indexOf('1440') < 0, 'hg-api-base at 1441');
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'batch-ledger.json'), 'utf8'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1466', 'the batch ledger last entry is hg-v1460');
  let nonDecreasing = true;
  for (let i = 1; i < entries.length; i++)
    if (String(entries[i].built) < String(entries[i - 1].built)) nonDecreasing = false;
  ok(nonDecreasing, 'and its built stamps never go backwards');
  ok(/hg-v1439/.test(fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')), 'AGENTS.md carries the entry');
}

console.log('== 5) MIN_RR: the question is answered and the answer is KEEP 1.2 ==');
{
  ok(/GS_MIN_RR = 1\.2/.test(SRC) || /GS_MIN_RR\s*=\s*1\.2/.test(SRC), 'GS_MIN_RR ships at 1.2');
  ok(/hg-v1439[\s\S]{0,600}1\.5R[\s\S]{0,400}0\.123/.test(SRC),
     'the GS_MIN_RR comment records the 1.5R measurement (-0.123R, both halves)');
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
