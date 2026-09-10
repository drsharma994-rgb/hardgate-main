/* HARDGATE — GOLD SCALP stop-width floor (hgGoldScalpStopFloor) tests.

   The module contract (goldind.js header + __gsLevels) says scalp stops are
   1.5×ATR14(15m), NEVER tighter — but engine plan overrides (VP stopPlan on
   liqsweep/nyexh, sweep→OB, Silver Bullet, hgGoldTakeEnginePlan binds) used
   to copy tighter stops onto minted cards with only a SIDES check. The GOLD
   SCALP tab replay (scripts/backtest-goldscalp.mjs) measured stops down to
   0.03×ATR burning 1.5–30R of round-trip cost per trade. hgGoldScalpStopFloor
   closes that hole at the push() choke point:
     - valid-side stop tighter than 1.5×ATR + TP1 still ≥1.2R at the floored
       risk -> stop re-anchored to the floor, rr/rr2 re-priced, stamped
     - floored TP1 < 1.2R -> DROPPED with a named reason (fail closed)
     - contract-true stops untouched; wrong-side stops left to the sides
       gate (the v681 lesson: never floor a wrong-side stop into a fixed one)
     - never throws on garbage
   Plus the pipeline invariant: every candidate goldScalpSetups returns
   satisfies |entry-stop| ≥ 1.5×atr (module-wide, all strategies, all
   override paths). Run: node tests/test-goldscalp-stopfloor.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
const W = globalThis.window;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

const floor = W.hgGoldScalpStopFloor;
assert(typeof floor === 'function', 'hgGoldScalpStopFloor is exported');

/* ---------- 1) tight stop + far TP1 -> floored + re-priced ---------- */
{
  const c = { dir: 'long', entry: 4432.43, stop: 4432.40, t1: 4436.43, t2: 4438.43, rr: 133, stamps: [] };
  floor(c, 0.6);
  assert(!c.dropped, 'long tight-stop with far TP1 survives');
  assert(Math.abs(c.stop - (4432.43 - 0.9)) < 1e-9, 'stop re-anchored to entry - 1.5×ATR');
  assert(Math.abs(c.rr - 4 / 0.9) < 1e-6, 'rr re-priced against the floored risk');
  assert(Math.abs(c.rr2 - 6 / 0.9) < 1e-6, 'rr2 re-priced against the floored risk');
  assert(c.stamps.indexOf('STOP FLOORED 1.5×ATR') >= 0, 'floored candidate is stamped');
  assert(Array.isArray(c.gateNotes) && /re-anchored/.test(c.gateNotes.join(' ')), 'gate note names the re-anchor');
}
{
  const c = { dir: 'short', entry: 4400, stop: 4400.03, t1: 4396, stamps: [] };
  floor(c, 0.6);
  assert(!c.dropped && Math.abs(c.stop - 4400.9) < 1e-9, 'short side floors symmetrically (stop above entry)');
}

/* ---------- 2) tight stop + near TP1 -> dropped, named reason ---------- */
{
  const c = { dir: 'short', entry: 4400, stop: 4400.10, t1: 4399.50 };
  floor(c, 0.6);
  assert(c.dropped === true, 'floored TP1 < 1.2R drops the candidate');
  assert(/1\.2R minimum/.test(c.reason || '') && /×ATR/.test(c.reason || ''), 'drop reason names the floor and the 1.2R bar');
}

/* ---------- 3) contract-true stop untouched ---------- */
{
  const c = { dir: 'long', entry: 4400, stop: 4395, t1: 4407.5, rr: 1.5 };
  floor(c, 3);
  assert(c.stop === 4395 && !c.dropped && c.rr === 1.5, 'stop already ≥1.5×ATR passes through unchanged');
}

/* ---------- 4) wrong-side stop left to the sides gate ---------- */
{
  const c = { dir: 'long', entry: 4400, stop: 4401, t1: 4405 };
  floor(c, 3);
  assert(c.stop === 4401 && !c.dropped, 'wrong-side stop is NOT floored (sides gate owns that failure)');
}

/* ---------- 5) garbage-safe ---------- */
{
  let threw = false;
  try {
    floor(null, 1); floor(undefined, 1); floor({}, 1);
    floor({ dir: 'long', entry: 4400, stop: 4399.9, t1: 4405 }, NaN);
    floor({ dir: 'long', entry: NaN, stop: 4399, t1: 4405 }, 1);
    floor({ dir: 'sideways', entry: 4400, stop: 4399, t1: 4405 }, 1);
  } catch (e) { threw = true; }
  assert(!threw, 'never throws on null/NaN/garbage inputs');
  const c = { dir: 'long', entry: 4400, stop: 4399.9, t1: 4405 };
  floor(c, NaN);
  assert(c.stop === 4399.9 && !c.dropped, 'non-finite ATR leaves the candidate unchanged');
}

/* ---------- 5b) COST-HEAVY gate (hgGoldScalpCostGate) ---------- */
{
  const gate = W.hgGoldScalpCostGate;
  assert(typeof gate === 'function', 'hgGoldScalpCostGate is exported');
  /* risk 0.05% of entry < 8x 0.020% = 0.16% -> demoted, stamped, never dropped */
  const c = { dir: 'long', entry: 4400, stop: 4397.8, t1: 4404, stamps: [] };
  gate(c);
  assert(c.demoted === true && !c.dropped, 'sub-0.16%-risk geometry is DEMOTED, never dropped (gross-positive cohort)');
  assert(c.stamps.indexOf('COST-HEAVY') >= 0, 'COST-HEAVY stamp present');
  assert(Array.isArray(c.gateNotes) && /0\.125R/.test(c.gateNotes.join(' ')), 'gate note cites the 0.125R cost bar');
  /* risk 0.32% of entry -> untouched */
  const ok = { dir: 'short', entry: 4400, stop: 4414.1, t1: 4380 };
  gate(ok);
  assert(!ok.demoted && !ok.costHeavy, 'risk >= 8x RT cost passes untouched');
  /* venue override: cheaper venue lowers the bar */
  const cheap = { dir: 'long', entry: 4400, stop: 4397.8, t1: 4404 };
  gate(cheap, 0.005);   /* 8x 0.005% = 0.04% bar; risk 0.05% clears it */
  assert(!cheap.demoted, 'inp.rtCostPct override moves the bar (cheaper venue passes)');
  /* garbage-safe */
  let threw = false;
  try { gate(null); gate({}); gate({ dir: 'long', entry: NaN, stop: 1 }); } catch (e) { threw = true; }
  assert(!threw, 'cost gate never throws on garbage');
}

/* ---------- 6) pipeline invariant: no candidate ships below the floor ---------- */
function mkRows(n, start, step, t0, tf, wick){
  const r = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c;
    c += (i % 3 === 2) ? -step * 0.6 : step;
    r.push({ t: t0 + i * tf, o, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, c, v: 900 + (i % 7) * 260 });
  }
  return r;
}
{
  const t0 = Math.floor(Date.UTC(2026, 2, 9, 0, 0, 0) / 1000);  /* a Monday */
  let checked = 0, violations = 0, sampled = 0;
  /* several tapes x several 'now' instants across sessions */
  for (const step of [0.8, 2.4]){
    for (const hour of [2, 9, 14, 19]){
      const nBars = 240;
      const rows15 = mkRows(nBars, 4300, step, t0, 900, step * 0.5);
      const rows1h = mkRows(220, 4300 - 60, step * 3, t0 - 220 * 3600, 3600, step);
      const rows4h = mkRows(220, 4100, step * 8, t0 - 220 * 14400, 14400, step * 2);
      const now = (rows15[nBars - 1].t + 900) * 1000 + hour * 0;  /* bar-close instant */
      const got = W.goldScalpSetups({ rows15m: rows15, rows1h, rows4h, now: now + hour * 3600 * 1000, news: null });
      const cands = Array.isArray(got) ? got : [];
      sampled += cands.length;
      for (const c of cands){
        if (!c || !isFinite(c.entry) || !isFinite(c.stop) || !isFinite(c.atr) || !(c.atr > 0)) continue;
        checked++;
        if (Math.abs(c.entry - c.stop) < 1.5 * c.atr * (1 - 1e-6)) violations++;
      }
    }
  }
  assert(violations === 0, 'pipeline invariant: every returned candidate has |entry-stop| ≥ 1.5×ATR ('
    + checked + ' checked across synthetic tapes, ' + sampled + ' candidates)');
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
