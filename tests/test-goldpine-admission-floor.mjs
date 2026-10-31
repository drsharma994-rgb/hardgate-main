#!/usr/bin/env node
/* hg-v1400 — GOLD PINE admission floor + pin/floor consistency + killzone on
   the signal bar. Authored, not recalibrated (impl-brief wave 1).

   THE MEASUREMENT THE FLOOR CARRIES (desk census, hg-v1399 measurement pack
   for this desk: the desk's OWN runGoldPineScan walked bar by bar over
   PAXGUSDT spot — 4h 2025-10-15..2026-10-17, 15m 2026-09-01..2026-10-18 —
   admitted primaries settled at the desk's own horizons 6×4h / 12×15m,
   stop-first, both-touch=loss):
     scalp stopPct<0.3% cohort n=45: −3.994R/−3.809R @0.20%RT and
       −0.529R/−0.440R @0.02%RT in the Sep/Oct halves — negative in BOTH
       halves at BOTH cost models (admissible under the hg-v1399 rule);
       kept n=6 improves both halves @XM (−0.500→−0.178, −0.350→+0.010) —
       thin, and the pack says so.
     swing sub-0.6% cohort: +0.490R / −0.496R by half — MIXED halves, so the
       floor NEVER reads a swing row (refused, named).
     pin-vs-floor: gpMayLead consulted neither floor, and the pin would have
       crowned a sub-floor row on 206/295 swing boards (70%) and 62/325
       scalp boards (19%).

   WHAT THIS SUITE PINS (mutation proof: delete any one clause and the suite
   goes red — verified during authoring):
     §1  gpAdmissionFloor fires on a <0.3% scalp stop, both directions.
     §2  fail-open (hg-v989): absent entry/stop, zero-width plan, wrong mode,
         null row — all abstain with ok:true.
     §3  NEVER floors swing, even at a microscopic stop.
     §4  gpMayLead honors recordOnly / pineBlock (hg-v1164) AND the handoff
         block (hg-v1400) AND the admission floor (hg-v1400).
     §5  the actions fork prints the ADMISSION FLOOR note and withholds both
         buttons (textual, hg-v956 — cardHTML needs the DOM helpers).
     §6  killzone reads opts.now, not the wall clock (textual + behavioural
         through pineGoldEvalDir's timing factor when goldind is absent the
         factor simply never lands — the textual pin is the rule).
     §7  ship stamps: HG_VER ≥ hg-v1400 and index.html's goldpine.js ?v=
         byte-matches it (the v693 pin's sibling). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER, hgVerGte } = await import('./helpers/build-version.mjs');

const src = readFileSync(resolve(ROOT, 'goldpine.js'), 'utf8');
const mathSrc = readFileSync(resolve(ROOT, 'pinegoldmath.js'), 'utf8');

/* boot the desk file alone, the way test-goldpine.mjs boots it */
const ctx = vm.createContext({
  console, Math, JSON, Date, Intl, isFinite, NaN, Array, Object, String, Promise,
  setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} }, window: {}
});
ctx.window = ctx;
vm.runInContext(src, ctx, { filename: 'goldpine.js' });
const GP = ctx;

/* --- §1 the floor fires --- */
assert.equal(typeof GP.gpAdmissionFloor, 'function', 'gpAdmissionFloor exported (test seam)');
{
  const r = GP.gpAdmissionFloor({ mode: 'scalp', dir: 'long', entry: 4000, stop: 4005 });
  assert.equal(r.ok, false, 'scalp stop 5pt on 4000 = 0.125% < 0.3% floors');
  assert.match(r.why, /stop under 0\.3% of entry/, 'the why names the number and the mechanism');
}
{
  const r = GP.gpAdmissionFloor({ mode: 'scalp', dir: 'short', entry: 4000, stop: 4004 });
  assert.equal(r.ok, false, 'short side floors identically (0.10%)');
}
{
  const r = GP.gpAdmissionFloor({ mode: 'scalp', dir: 'long', entry: 4000, stop: 3988 });
  assert.equal(r.ok, true, 'scalp stop at exactly 0.3% passes (strict <)');
}

/* --- §2 fail-open third state --- */
assert.equal(GP.gpAdmissionFloor({ mode: 'scalp', dir: 'long' }).ok, true, 'absent levels abstain');
assert.equal(GP.gpAdmissionFloor({ mode: 'scalp', entry: 4000, stop: NaN }).ok, true, 'non-finite stop abstains');
assert.equal(GP.gpAdmissionFloor({ mode: 'scalp', entry: 4000, stop: 4000 }).ok, true, 'zero-width plan abstains');
assert.equal(GP.gpAdmissionFloor(null).ok, true, 'null row abstains');
assert.equal(GP.gpAdmissionFloor({ mode: 'scalp', entry: 0, stop: 5 }).ok, true, 'entry 0 abstains (never a divide by zero)');

/* --- §3 never floors swing --- */
{
  const r = GP.gpAdmissionFloor({ mode: 'swing', dir: 'long', entry: 4000, stop: 4001 });
  assert.equal(r.ok, true, 'swing at 0.025% stop is NOT floored (mixed halves, measured and refused)');
}
assert.ok(/String\(s\.mode\) !== 'scalp'\) return \{ ok: true \}/.test(src),
  'the mode guard is textual and scalp-only');

/* --- §4 gpMayLead honors both floors and the two legacy holds --- */
assert.equal(typeof GP.gpMayLead, 'function', 'gpMayLead exported (test seam)');
const base = { mode: 'scalp', dir: 'long', entry: 4000, stop: 3980, rr: 2.0 };
assert.equal(GP.gpMayLead(base), true, 'clean scalp row may lead');
assert.equal(GP.gpMayLead(Object.assign({}, base, { recordOnly: true })), false, 'record-only never leads (hg-v1164)');
assert.equal(GP.gpMayLead(Object.assign({}, base, { pineBlock: 'pine majority against' })), false, 'pineBlock never leads');
assert.equal(GP.gpMayLead(Object.assign({}, base, { stop: 4005 })), false, 'admission-floored scalp never leads');
assert.equal(GP.gpMayLead(Object.assign({}, base, { rr: 1.0 })), false, 'handoff-blocked row never leads (hg-v1400)');
assert.equal(GP.gpMayLead({ mode: 'swing', dir: 'long', entry: 4000, stop: 3980, rr: 1.3 }), false,
  'swing under its 1.5 R:R handoff floor never leads');
assert.equal(GP.gpMayLead({ mode: 'swing', dir: 'long', entry: 4000, stop: 4001, rr: 2.0 }), true,
  'swing with a tight stop but clean R:R still leads (no swing stopPct floor)');
assert.equal(GP.gpMayLead({ mode: 'scalp', dir: 'long', entry: 4000, stop: 3980 }), true,
  'unmeasured R:R is not a veto (hg-v1288 shape kept)');

/* --- §5 the actions fork prints the floor note and withholds the buttons --- */
assert.ok(/var adm = gpAdmissionFloor\(s\);/.test(src), 'cardHTML consults the floor');
assert.ok(/\(adm\.ok === false\)/.test(src), 'the fork branches on the floor');
assert.ok(/NO TRADE HANDOFF — ADMISSION FLOOR: /.test(src), 'the note names itself');
assert.ok(src.indexOf('(adm.ok === false)') < src.indexOf(': block\n    ?'),
  'the admission floor is consulted before the R:R handoff block branch');

/* --- §6 killzone reads the signal bar, not the wall clock --- */
assert.ok(/kzFn\(fin\(\+opts\.now\) \? \+opts\.now : Date\.now\(\)\)/.test(mathSrc),
  'pineGoldEvalDir hands opts.now to goldKillzone (Date.now only as fallback)');
assert.ok(/var scanOpts = \{ macro: macro, spot: spot, levels: levels, now: ctx\.now \};/.test(src),
  'runGoldPineScan threads now into the Pine-lane scan options');
assert.ok(/cot: feeds\.cot, now: t0 \}\);/.test(src),
  'runScan hands the fetch-time clock to runGoldPineScan');

/* --- §7 ship stamps --- */
assert.ok(hgVerGte(HG_VER, 'hg-v1400'), 'the tree is at or past hg-v1400 (at ' + HG_VER + ')');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('goldpine\\.js\\?v=' + qv).test(idx), 'index.html goldpine.js cache-buster = ?v=' + qv);
assert.ok(new RegExp('pinegoldmath\\.js\\?v=' + qv).test(idx), 'index.html pinegoldmath.js cache-buster = ?v=' + qv);

console.log('test-goldpine-admission-floor: all assertions passed at ' + HG_VER);
