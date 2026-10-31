#!/usr/bin/env node
/* hg-v1438 — PINE GOLD accuracy round 3: record-only clause-attribution
   marks gp:upRsiDiv / gp:upCloud / gp:upElder / gp:upShanghai / gp:upWkOpen
   ride the reads bag and gate NOTHING. Authored, not recalibrated
   (impl-brief-r3.md, binding; census-r3.json / upstream-gate-audit.json).

   THE MEASUREMENT THE MARKS CARRY (census r3 @ hg-v1436, the desk's own
   runGoldPineScan re-walked on the r2 spans with the cross-timeframe legs
   fed so upstream's v1410 htfHold and v1414 stand-downs fire as live;
   replica chain reproduced the desk's pineBlock decision 68,700/68,700):
     upstream rsi-divergence hold (v1410): sole-holder swing cohort
       +0.968R/+0.065R at XM by half — POSITIVE BOTH HALVES (anti-selects
       in-sample; BN/taker H2 mixed, so no removal clears the bar).
     upstream cloud-inside hold (v1414): swing sole cohort mixed halves
       (H2 +1.64R at XM, n=1 — named, thin); earns on scalp both halves.
     elder-impulse (v1414): negative both halves at all three cost models
       (n=3 — passes, thin; the ledger decides).
     shanghai-hour / weekly-open (v1413): ZERO sole-holder fires on 4,381
       admissible rows — inert in-census, named.
   The house shape for a measured-but-not-removable clause is a record-only
   mark the forward ledger judges out of sample (hg-v1420 precedent). These
   marks gate NOTHING, anywhere.

   WHAT THIS SUITE PINS (mutation proof: neuter gpHoldMarks, drop the seam
   calls, or wire a mark into a gate and the suite goes red — verified):
     §1  gpHoldMarks attribution: each upstream clause's pineBlock wording
         (incl. the '4h '/'15m ' htf prefixes) maps to its own mark true,
         the other four false; a judged-and-passed row marks all five false.
     §2  the third state: recordOnly rows and pre-hold demoted rows (never
         judged by holdPine) carry NO keys; null/garbage rows abstain.
     §3  the record seam: gpHoldMarkReads runs after holdPine inside
         runGoldPineScan; through hgFwdRecordScan the reads bag carries the
         five booleans on every holdPine-judged row and never a partial set;
         the bag line in hgGpRecord stays byte-untouched.
     §4  gates nothing: gpMayLead / gpAdmissionFloor never read the marks;
         the keys appear in NO gate file; the helper is called exactly once
         (inside the seam) and the seam exactly twice (after holdPine).
     §5  the board says the audit: the static measured line names the
         swing-book collapse, the removed cohort that paid, and the empty
         scalp book — paint only.
     §6  ship stamps: HG_VER >= hg-v1438, index.html goldpine.js ?v=
         byte-match, sw.js HG_CACHE rides the stamp. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER, hgVerGte } = await import('./helpers/build-version.mjs');

const src = readFileSync(resolve(ROOT, 'goldpine.js'), 'utf8');

const ctx = vm.createContext({
  console, Math, JSON, Date, Intl, isFinite, NaN, Array, Object, String, Number, Boolean, Promise,
  setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} }, window: {}
});
ctx.window = ctx;
for (const f of ['indicators.js', 'pinemath.js', 'pinegoldmath.js', 'goldpine.js'])
  vm.runInContext(readFileSync(resolve(ROOT, f), 'utf8'), ctx, { filename: f });
const GP = ctx;

function mkRows(n, start, step, saw){
  const rows = [];
  let c = start;
  for (let i = 0; i < n; i++){
    c = saw ? start + ((i % 2) ? step : -step) : c + step;
    rows.push({ t: 1700000000 + i * 14400, o: c - step / 2, h: c + Math.abs(step), l: c - Math.abs(step), c, v: 1 });
  }
  return rows;
}
const KEYS = ['gp:upRsiDiv', 'gp:upCloud', 'gp:upElder', 'gp:upShanghai', 'gp:upWkOpen'];

/* --- §1 attribution mapping --- */
assert.equal(typeof GP.gpHoldMarks, 'function', 'gpHoldMarks exported (test seam)');
assert.equal(typeof GP.gpHoldMarkReads, 'function', 'gpHoldMarkReads exported (test seam)');
{
  const cases = [
    ['RSI divergence against the lead', 'gp:upRsiDiv'],
    ['4h RSI divergence against the lead', 'gp:upRsiDiv'],
    ['15m RSI divergence against the lead', 'gp:upRsiDiv'],
    ['Price is inside the Ichimoku cloud.', 'gp:upCloud'],
    ['4h Price is inside the Ichimoku cloud.', 'gp:upCloud'],
    ['Elder Impulse is against the lead', 'gp:upElder'],
    ['4h Elder Impulse is against the lead', 'gp:upElder'],
    ['The Shanghai hour was pierced by 0.52x ATR and the 15m bar closed back over 4312.40', 'gp:upShanghai'],
    ['wick took the weekly open 4312.40 by 0.31x ATR and closed back under it', 'gp:upWkOpen'],
    ['The weekly open was swept against this trade.', 'gp:upWkOpen']
  ];
  for (const [why, key] of cases){
    const m = GP.gpHoldMarks({ mode: 'swing', dir: 'long', demoted: true, pineBlock: why });
    for (const k of KEYS) assert.equal(m[k], k === key, why.slice(0, 28) + ' -> ' + k + ' === ' + (k === key));
  }
  const other = GP.gpHoldMarks({ mode: 'scalp', dir: 'short', demoted: true, pineBlock: 'pace Pine scripts disagree (1 with, 4 against)' });
  for (const k of KEYS) assert.equal(other[k], false, 'a clause we do not instrument marks all five false (attributed elsewhere)');
  const passed = GP.gpHoldMarks({ mode: 'swing', dir: 'long' });
  for (const k of KEYS) assert.equal(passed[k], false, 'holdPine judged and passed (no pineBlock) -> all five FALSE, not absent');
}

/* --- §2 the third state --- */
{
  assert.equal(Object.keys(GP.gpHoldMarks({ mode: 'swing', dir: 'long', recordOnly: true })).length, 0,
    'record-only rows are never judged by holdPine -> ABSENT (hg-v989)');
  assert.equal(Object.keys(GP.gpHoldMarks({ mode: 'swing', dir: 'long', demoted: true, demotedWhy: 'fundamental' })).length, 0,
    'pre-hold demoted rows (demoted without pineBlock) carry NO keys');
  assert.equal(Object.keys(GP.gpHoldMarks(null)).length, 0, 'null row abstains');
  assert.equal(Object.keys(GP.gpHoldMarks({})).length, 0, 'no dir -> absent');
}

/* --- §3 the record seam carries the marks, additively, after holdPine --- */
{
  const captured = [];
  ctx.hgFwdRecordScan = function(tab, tf, cands){ captured.push({ tab, tf, cands }); return cands.length; };
  const bars = {
    rows15m: mkRows(280, 4000, 0.6), rows1h: mkRows(240, 3800, 1.5),
    rows4h: mkRows(280, 3600, 3), rows1d: mkRows(280, 3200, 2),
    source: 'unit-tape', srcByTf: { '4h': 'unit-tape', '15m': 'unit-tape' }
  };
  const res = GP.runGoldPineScan(bars, { macro: null, now: 1700000000 + 279 * 14400 * 1000 });
  assert.ok(res && (res.swing || res.scalp), 'scan returns sections on crafted tape');
  assert.ok(captured.length >= 1, 'hgFwdRecordScan was consulted');
  let withUp = 0, total = 0;
  for (const call of captured){
    for (const cd of call.cands){
      total++;
      const r = cd.reads;
      const present = r ? KEYS.filter(k => k in r) : [];
      assert.ok(present.length === 0 || present.length === KEYS.length,
        'a record carries ALL FIVE clause marks or none — never a partial set (' + present.length + ')');
      if (present.length){
        withUp++;
        for (const k of KEYS) assert.ok(r[k] === true || r[k] === false, k + ' is a boolean, never a verdict string');
        const trues = KEYS.filter(k => r[k] === true);
        assert.ok(trues.length <= 1, 'at most one clause is attributed per row (short-circuit first-hit semantics)');
      }
    }
  }
  assert.ok(total > 0, 'records were minted on the crafted tape');
  assert.ok(withUp > 0, 'at least one holdPine-judged record carries the five clause marks');
  /* the bag line in hgGpRecord is byte-untouched (the hg-v1162 shape and the
     80pct suite's verbatim pin stand as they are) */
  assert.ok(/reads: \(s\.freeReads && typeof s\.freeReads === 'object'\) \? s\.freeReads : undefined,/.test(src),
    'the record seam bag line is byte-preserved');
  assert.ok(/holdPine\(swing, bars && bars\.rows4h, 'swing', bars && bars\.rows15m\);/.test(src)
      && /gpHoldMarkReads\(swing\);\n    gpHoldMarkReads\(scalp\);\n    if \(typeof W\.hgGoldInstApply/.test(src)
      && src.indexOf('gpHoldMarkReads(swing)') > src.indexOf("holdPine(swing, bars && bars.rows4h"),
    'the r3 marking runs once per scan per lane AFTER holdPine, before hgGoldInstApply/records');
}

/* --- §4 the marks gate NOTHING, anywhere --- */
assert.ok(!/upRsiDiv|upCloud|upElder|upShanghai|upWkOpen|gpHoldMarks/.test(GP.gpMayLead.toString()), 'gpMayLead never reads the r3 marks');
assert.ok(!/upRsiDiv|upCloud|upElder|upShanghai|upWkOpen|gpHoldMarks/.test(GP.gpAdmissionFloor.toString()), 'gpAdmissionFloor never reads the r3 marks');
{
  const defn = (src.match(/function gpHoldMarks\(s\)/g) || []).length;
  const calls = (src.match(/gpHoldMarks\(s\)/g) || []).length;
  const seamDefn = (src.match(/function gpHoldMarkReads\(list\)/g) || []).length;
  const seamCalls = (src.match(/gpHoldMarkReads\((swing|scalp)\)/g) || []).length;
  assert.equal(defn, 1, 'one helper home (hg-v949)');
  assert.equal(calls - defn, 1, 'the helper is called exactly once — inside the marking seam');
  assert.equal(seamDefn, 1, 'one marking-seam home');
  assert.equal(seamCalls, 2, 'the seam runs exactly twice per scan (swing + scalp), after holdPine');
  assert.equal((src.match(/W\.gpHoldMarks = gpHoldMarks/g) || []).length, 1, 'one test-seam export');
}
{
  const base = { mode: 'scalp', dir: 'long', entry: 4000, stop: 3980, rr: 2.0 };
  assert.equal(GP.gpMayLead(base), true, 'lead predicate unchanged on a clean row');
  assert.equal(GP.gpMayLead(Object.assign({}, base, { 'gp:upRsiDiv': true, 'gp:upCloud': true })), true,
    'a row carrying TRUE clause marks leads identically — the marks are not a gate');
  assert.equal(GP.gpAdmissionFloor(Object.assign({}, base, { stop: 4005, 'gp:upElder': true })).ok, false,
    'the floor fires on stop width alone, marks unread');
}
for (const gf of ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js',
                  'hg-perfect-setup.js', 'setup-stack.js', 'hg-forward.js', 'pinegoldmath.js']){
  const t = readFileSync(resolve(ROOT, gf), 'utf8');
  assert.ok(!/gp:upRsiDiv|gp:upCloud|gp:upElder|gp:upShanghai|gp:upWkOpen/.test(t), gf + ' carries no r3 mark key (hg-v966 refused by construction)');
}
{
  /* in goldpine.js the keys may appear ONLY at the helper, the seam, and
     their own honesty comments */
  const hits = src.split('\n').filter(l => /gp:up(RsiDiv|Cloud|Elder|Shanghai|WkOpen)/.test(l));
  assert.ok(hits.every(l => /key:|hg-v1438|never gates|gate NOTHING|Display only|gp:up\*/.test(l)),
    'mark keys live only at the helper/seam + honesty comments: ' + hits.length + ' lines');
}

/* --- §5 the board says the audit (paint only) --- */
{
  assert.ok(/MEASURED \(r3 census @ hg-v1436/.test(src), 'the static measured line is painted on the board');
  assert.ok(/68 \\u2192 24 walked trades/.test(src) || /68 \u2192 24 walked trades/.test(src), 'the swing-book collapse is named');
  assert.ok(/\+0\.968R\/\+0\.065R/.test(src), 'the v1410 rsi-divergence removed cohort is named');
  assert.ok(/The scalp book is EMPTY at shipped parameters/.test(src), 'the empty scalp book is named');
  assert.ok(/the ledger decides/i.test(src), 'the doctrine line closes it');
}

/* --- §6 ship stamps --- */
assert.ok(hgVerGte(HG_VER, 'hg-v1438'), 'HG_VER >= hg-v1438, got ' + HG_VER);
{
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const want = 'goldpine.js?v=' + HG_VER.replace('hg-v', '');
  assert.ok(html.includes(want), 'index.html goldpine.js ?v= byte-matches HG_VER (' + want + ')');
  const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
  assert.ok(sw.includes("HG_CACHE = '" + HG_VER + "'"), 'sw.js HG_CACHE rides the stamp');
}

console.log('PASS test-goldpine-hold-marks (hg-v1438): clause-attribution marks land, abstain, and gate nothing; the board says the audit.');
