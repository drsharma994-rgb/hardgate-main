/* hg-v1168 — THE PERFECT COHORT MARKS reach hgFwdRecordScan.
   Three guards hg-v1022 / hg-v1025 / hg-v1030 shipped the hand-ins and tested
   either the lifted .map() body in a sandbox or the DIRECT door (hgFwdRecord);
   none of them drove hgFwdRecordScan, and the scan door's record copy had its
   own field list that dropped `perfect` and `perfectPlus` from the day they
   shipped. The hg-v1065 PERFECT COHORT SPLIT therefore read 0 marked rows for
   every desk recording through this seam, including GOLD SCALP (which stamps
   `rc.perfect` and `rc.perfectPlus` at goldind.js:6160-6161 and hands them
   through publishScan at goldscalp.js:611/744).

   This drives hgFwdRecordScan directly with a crafted cand carrying each of
   true / undefined / junk for both fields and reads the record back, so a
   mutation that drops the field, coerces its value or widens the normaliser
   is caught. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
/* hg-v1169 fix: ROOT was the author's machine path '/home/user/hardgate-main',
   which is ENOENT everywhere else — including the GitHub Actions runner, so
   this guard could only ever pass on one laptop. House pattern instead. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let PASS = 0, FAIL = 0;
function ok(cond, msg){ if (cond){ PASS++; } else { FAIL++; console.error('FAIL ' + msg); } }

function freshCtx(){
  const ctx = { console, Math, Date, Number, String, Object, Array, JSON, Error, Promise, setTimeout, clearTimeout, isFinite, isNaN, parseFloat, parseInt, Symbol, RegExp };
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.localStorage = ls; ctx.sessionStorage = ls;
  vm.createContext(ctx);
  vm.runInContext(read('hg-forward.js'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

/* 1. the record copy inside hgFwdRecordScan forwards perfect/perfectPlus.
   This is the whole point of the pack: a cand with perfect:true and
   perfectPlus:true must come back from hgFwdRecords with those values. */
{
  const W = freshCtx();
  ok(typeof W.hgFwdRecordScan === 'function', '1a hgFwdRecordScan is wired');
  const cand = {
    sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2298, t1: 2306,
    mark: 2300.5, feed: 'xm-xauusd', barT: 1759996800,
    perfect: true, perfectPlus: true, grade: 'A', ticket: true,
    killzone: 'NY AM', costR: 0.062
  };
  const added = W.hgFwdRecordScan('GS_WF1168_PP_TRUE', '15m', [cand], { horizonBars: 96 });
  ok(added === 1, '1b one record added through hgFwdRecordScan');
  const rows = W.hgFwdRecords('GS_WF1168_PP_TRUE') || [];
  ok(rows.length === 1, '1c one row read back');
  const r = rows[0] || {};
  ok(r.perfect === true, '1d perfect === true on the recorded row (actual: ' + JSON.stringify(r.perfect) + ')');
  ok(r.perfectPlus === true, '1e perfectPlus === true (actual: ' + JSON.stringify(r.perfectPlus) + ')');
}

/* 2. absent stays absent. A cand with no perfect/perfectPlus must record
   undefined for both -- never a coerced false, never a stand-in. */
{
  const W = freshCtx();
  const cand = {
    sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2298, t1: 2306,
    mark: 2300.5, feed: 'xm-xauusd', barT: 1759996800,
    grade: 'B', ticket: false
  };
  const added = W.hgFwdRecordScan('GS_WF1168_PP_ABSENT', '15m', [cand], { horizonBars: 96 });
  ok(added === 1, '2a one record added for the absent case');
  const r = (W.hgFwdRecords('GS_WF1168_PP_ABSENT') || [])[0] || {};
  ok(r.perfect === undefined, '2b perfect absent is undefined (actual: ' + JSON.stringify(r.perfect) + ')');
  ok(r.perfectPlus === undefined, '2c perfectPlus absent is undefined (actual: ' + JSON.stringify(r.perfectPlus) + ')');
}

/* 3. junk stays absent -- the normaliser's three-state rule holds across the
   scan door too. Anything other than === true records undefined. */
{
  const W = freshCtx();
  const junk = { perfect: 1, perfectPlus: 'yes' };
  const added = W.hgFwdRecordScan('GS_WF1168_PP_JUNK', '15m', [Object.assign({
    sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2298, t1: 2306,
    mark: 2300.5, feed: 'xm-xauusd', barT: 1759996800
  }, junk)], { horizonBars: 96 });
  ok(added === 1, '3a one record added for the junk case');
  const r = (W.hgFwdRecords('GS_WF1168_PP_JUNK') || [])[0] || {};
  ok(r.perfect === undefined, '3b junk perfect records undefined (actual: ' + JSON.stringify(r.perfect) + ')');
  ok(r.perfectPlus === undefined, '3c junk perfectPlus records undefined (actual: ' + JSON.stringify(r.perfectPlus) + ')');
}

/* 4. only true travels -- false records absent (the hg-v955 three-state rule
   stays with the normaliser; the seam does not override it). */
{
  const W = freshCtx();
  const cand = {
    sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2298, t1: 2306,
    mark: 2300.5, feed: 'xm-xauusd', barT: 1759996800,
    perfect: false, perfectPlus: false
  };
  W.hgFwdRecordScan('GS_WF1168_PP_FALSE', '15m', [cand], { horizonBars: 96 });
  const r = (W.hgFwdRecords('GS_WF1168_PP_FALSE') || [])[0] || {};
  ok(r.perfect === undefined, '4a perfect:false records undefined');
  ok(r.perfectPlus === undefined, '4b perfectPlus:false records undefined');
}

/* 5. the PERFECT COHORT SPLIT reads the recorded rows. Three records with
   distinct bars survive the ledger's 12h dedup and reach storage; the split
   is handed those records (with a synthetic settled state) directly so the
   SEAM proof above is composed with the hg-v1065 reader. If the normaliser
   or the seam drops perfect, the two cells read empty. */
{
  const W = freshCtx();
  const now = Math.floor(Date.now()/1000);
  const cands = [
    { sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2298, t1: 2306, mark: 2300, barT: now - 3 * 3600, perfect: true },
    { sym: 'XAUUSD', dir: 'long', entry: 2310, stop: 2308, t1: 2316, mark: 2310, barT: now - 2 * 3600, perfect: true, perfectPlus: true },
    { sym: 'XAUUSD', dir: 'long', entry: 2320, stop: 2318, t1: 2326, mark: 2320, barT: now - 1 * 3600 }
  ];
  const added = W.hgFwdRecordScan('GS_WF1168_SPLIT', '15m', cands, { horizonBars: 96 });
  ok(added === 3, '5a three records added (distinct bars survive dedup; actual: ' + added + ')');
  const rows = (W.hgFwdRecords('GS_WF1168_SPLIT') || []).slice();
  ok(rows.length >= 3, '5b three rows read back (actual: ' + rows.length + ')');
  const perfCount = rows.filter(r => r && r.perfect === true).length;
  const plusCount = rows.filter(r => r && r.perfectPlus === true).length;
  ok(perfCount === 2, '5c two rows carry perfect === true (actual: ' + perfCount + ')');
  ok(plusCount === 1, '5d one row carries perfectPlus === true (actual: ' + plusCount + ')');
  /* hand the split the records with a synthetic settled state so hg-v1065's
     reader can walk them; the pack proves the mark reached the record, not
     that the ledger's own settle clock happened to fire inside this test. */
  const settled = rows.map((r, i) => Object.assign({}, r, { state: i === 0 ? 't1' : (i === 1 ? 't1' : 'stop'), rr: i === 0 ? 2 : (i === 1 ? 3 : -1) }));
  const sp = W.hgFwdPerfectSplit(settled);
  ok(sp !== null, '5e hgFwdPerfectSplit returns a split (null means it saw no marked rows)');
  ok(sp && sp.marked === 2, '5f the split sees exactly two marked rows (actual: ' + (sp && sp.marked) + ')');
  ok(sp && sp.cells && sp.cells.PERFECT && sp.cells.PERFECT.n === 1, '5g PERFECT cell has 1 (actual: ' + JSON.stringify(sp && sp.cells && sp.cells.PERFECT) + ')');
  ok(sp && sp.cells && sp.cells['PERFECT+'] && sp.cells['PERFECT+'].n === 1, '5h PERFECT+ cell has 1 (actual: ' + JSON.stringify(sp && sp.cells && sp.cells['PERFECT+']) + ')');
}

/* 6. GOLD SWING's own hand-ins also reach the scan door via the same fix. */
{
  const W = freshCtx();
  const cand = {
    sym: 'XAUUSD', dir: 'short', entry: 2300, stop: 2302, t1: 2294,
    mark: 2300, feed: 'xm-xauusd', barT: 1759996800,
    perfect: true, perfectPlus: true
  };
  W.hgFwdRecordScan('GW_WF1168_PP', '4h', [cand], { horizonBars: 48 });
  const r = (W.hgFwdRecords('GW_WF1168_PP') || [])[0] || {};
  ok(r.perfect === true, '6a goldswing perfect === true through hgFwdRecordScan');
  ok(r.perfectPlus === true, '6b goldswing perfectPlus === true');
}

/* 7. a cand with perfect but no feed/mark still records the mark (the seam
   does not disable the perfect pass-through if other fields are missing). */
{
  const W = freshCtx();
  const added = W.hgFwdRecordScan('GS_WF1168_PP_MIN', '15m', [{
    sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2298, t1: 2306, perfect: true
  }], { horizonBars: 96 });
  const r = (W.hgFwdRecords('GS_WF1168_PP_MIN') || [])[0] || {};
  ok(r.perfect === true, '7 perfect still travels with the minimal shape (added:' + added + ', perf:' + JSON.stringify(r.perfect) + ')');
}

/* 8. the seam MUST pass each field by its own name. A cross-wire that reads
   perfectPlus as perfect is caught here. */
{
  const W = freshCtx();
  const cand = { sym: 'XAUUSD', dir: 'long', entry: 2300, stop: 2298, t1: 2306, perfect: undefined, perfectPlus: true };
  W.hgFwdRecordScan('GS_WF1168_PP_CROSS', '15m', [cand], { horizonBars: 96 });
  const r = (W.hgFwdRecords('GS_WF1168_PP_CROSS') || [])[0] || {};
  ok(r.perfectPlus === true, '8a perfectPlus true travels alone');
  ok(r.perfect === undefined, '8b perfect stays undefined when the hand-in has none');
}

/* 9. a textual anchor: the hgFwdRecordScan body carries the fix. This is the
   deliberately-textual bar (hg-v956): a mutation deleting the two lines would
   be caught behaviourally by 1-8, but this names the shape so a later edit
   that renames the fields trips here first. */
{
  const src = read('hg-forward.js');
  ok(/\bperfect:\s*c\.perfect\s*,/.test(src), '9a perfect: c.perfect, present in hg-forward.js');
  ok(/\bperfectPlus:\s*c\.perfectPlus\s*,/.test(src), '9b perfectPlus: c.perfectPlus, present');
  const scanAt = src.indexOf('W.hgFwdRecordScan = function');
  const scanEnd = src.indexOf('return added;', scanAt);
  ok(scanAt > 0 && scanEnd > scanAt, '9c located the hgFwdRecordScan body');
  const scanBody = src.slice(scanAt, scanEnd);
  ok(scanBody.indexOf('perfect: c.perfect,') > 0, '9d perfect pass-through sits inside hgFwdRecordScan');
  ok(scanBody.indexOf('perfectPlus: c.perfectPlus,') > 0, '9e perfectPlus pass-through sits inside hgFwdRecordScan');
}

console.log('files: 1 | failed: ' + FAIL + ' | tests: ' + (PASS + FAIL));
process.exit(FAIL ? 1 : 0);
