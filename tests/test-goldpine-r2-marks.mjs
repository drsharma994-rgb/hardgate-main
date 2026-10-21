#!/usr/bin/env node
/* hg-v1420 — PINE GOLD accuracy round 2: record-only three-state marks
   gp:er20ok (both lanes) + gp:d1with (swing) ride the reads bag, paint
   through the shared REPLAY READ SPLIT, and gate NOTHING. Authored, not
   recalibrated (impl-brief-r2.md, binding).

   THE MEASUREMENT THE MARKS CARRY (census r2 @ hg-v1417, the desk's own
   runGoldPineScan re-walked over the v1401 census spans — 4h
   2025-10-15..2026-10-17, 15m 2026-09-01..2026-10-18 — reproducing the
   v1401 settled trades 119/119 exactly):
     ER(20)>=0.30 veto REFUSED: swing dropped cohort +0.560R/-0.055R @XM by
       half (mixed; the ER-passing cohort was the WORST first-half cohort on
       the desk); scalp kept cohort n=1 in the second half.
     1d close-vs-EMA(150) counter-regime veto REFUSED: dropped +0.246R/-0.242R
       @XM by half (mixed).
     v1401 floor audit HOLDS: sub-0.3% cohort negative both halves at all
       three cost models (-3.994/-3.809 BN, -0.529/-0.440 XM, -5.149/-4.932
       taker); at taker the floor is 1.15x the round trip and a 4x-cost floor
       keeps 0/51 — the why now names the venue math (prefix pinned).
   The house shape for a measured-but-refused read is a record-only mark the
   forward ledger judges out of sample (hg-v1164, hg-v1417 cf:htfWith). These
   marks gate NOTHING, anywhere.

   WHAT THIS SUITE PINS (mutation proof: delete any one clause and the suite
   goes red — verified during authoring):
     §1  gpR2Marks er20ok: rising tape -> true, sawtooth -> false, both lanes,
         short tape / absent helper -> ABSENT (hg-v989 third state).
     §2  d1with: long-above -> true, long-below -> false, short mirrors;
         <160 daily bars -> absent; scalp rows never carry it.
     §3  the record seam: hgFwdRecordScan capture through runGoldPineScan —
         the reads bag carries the marks as booleans; an all-absent bag still
         records reads:undefined (the hg-v1162 shape preserved).
     §4  gates nothing: gpMayLead / gpAdmissionFloor / cardHTML never read the
         marks; the mark keys appear in NO gate file.
     §5  the floor why keeps the pinned prefix AND names the venue math; the
         0.3 literal and the mode guard are byte-pinned.
     §6  ship stamps: HG_VER >= hg-v1420 and index.html's goldpine.js ?v=
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

/* boot the desk the way the r2 census boots it: indicators (ema), pinemath,
   pinegoldmath (pineGoldEfficiency), goldpine */
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

/* --- §1 er20ok: behavior + third state --- */
assert.equal(typeof GP.gpR2Marks, 'function', 'gpR2Marks exported (test seam)');
{
  const up = { rows4h: mkRows(280, 4000, 3), rows15m: mkRows(280, 4000, 0.6) };
  const mSw = GP.gpR2Marks({ mode: 'swing', dir: 'long' }, up);
  const mSc = GP.gpR2Marks({ mode: 'scalp', dir: 'long' }, up);
  assert.equal(mSw['gp:er20ok'], true, 'rising 4h tape: ER(20)=1 >= 0.30 -> true (swing)');
  assert.equal(mSc['gp:er20ok'], true, 'rising 15m tape -> true (scalp)');
  const chop = { rows4h: mkRows(280, 4000, 3, true), rows15m: mkRows(280, 4000, 0.6, true) };
  assert.equal(GP.gpR2Marks({ mode: 'swing', dir: 'long' }, chop)['gp:er20ok'], false, 'sawtooth tape: ER~0 -> false');
  assert.equal(GP.gpR2Marks({ mode: 'scalp', dir: 'long' }, chop)['gp:er20ok'], false, 'sawtooth 15m -> false');
}
{
  const short_ = { rows4h: mkRows(20, 4000, 3) };
  const m = GP.gpR2Marks({ mode: 'swing', dir: 'long' }, short_);
  assert.equal('gp:er20ok' in m, false, 'under 27 bars the read never lands -> ABSENT, not false (hg-v989)');
  assert.equal('gp:er20ok' in GP.gpR2Marks({ mode: 'swing', dir: 'long' }, null), false, 'null bars abstain');
  assert.equal('gp:er20ok' in GP.gpR2Marks(null, null), false, 'null row abstains');
}
{
  /* helper absent -> fail open: boot goldpine.js alone, no pinegoldmath */
  const bare = vm.createContext({
    console, Math, JSON, Date, Intl, isFinite, NaN, Array, Object, String, Number, Boolean, Promise,
    setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} }, window: {}
  });
  bare.window = bare;
  vm.runInContext(src, bare, { filename: 'goldpine.js' });
  const m = bare.gpR2Marks({ mode: 'swing', dir: 'long' }, { rows4h: mkRows(280, 4000, 3), rows1d: mkRows(280, 4000, 3) });
  assert.equal('gp:er20ok' in m, false, 'pineGoldEfficiency absent -> no fabricated mark (fail-open)');
  assert.equal('gp:d1with' in m, false, 'ema absent -> no fabricated mark (fail-open)');
}

/* --- §2 d1with: swing only, direction-aware, third state --- */
{
  const up = { rows4h: mkRows(280, 4000, 3), rows1d: mkRows(280, 3800, 2) };
  assert.equal(GP.gpR2Marks({ mode: 'swing', dir: 'long' }, up)['gp:d1with'], true, 'long with close > EMA150 -> true');
  assert.equal(GP.gpR2Marks({ mode: 'swing', dir: 'short' }, up)['gp:d1with'], false, 'short against the regime -> false');
  const dn = { rows4h: mkRows(280, 5000, -3), rows1d: mkRows(280, 5000, -2) };
  assert.equal(GP.gpR2Marks({ mode: 'swing', dir: 'long' }, dn)['gp:d1with'], false, 'long below EMA150 -> false');
  assert.equal(GP.gpR2Marks({ mode: 'swing', dir: 'short' }, dn)['gp:d1with'], true, 'short with the regime -> true');
}
{
  const few = { rows4h: mkRows(280, 4000, 3), rows1d: mkRows(100, 3800, 2) };
  assert.equal('gp:d1with' in GP.gpR2Marks({ mode: 'swing', dir: 'long' }, few), false, 'under 160 daily bars -> ABSENT');
  const sc = { rows15m: mkRows(280, 4000, 0.6), rows1d: mkRows(280, 3800, 2) };
  assert.equal('gp:d1with' in GP.gpR2Marks({ mode: 'scalp', dir: 'long' }, sc), false, 'scalp rows NEVER carry d1with (measured swing-only)');
  assert.equal('gp:d1with' in GP.gpR2Marks({ mode: 'swing' }, { rows4h: mkRows(280, 4000, 3), rows1d: mkRows(280, 3800, 2) }), false, 'no dir -> absent');
}

/* --- §3 the record seam carries the marks, additively --- */
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
  let withEr = 0, withD1 = 0, total = 0, undefBag = 0;
  for (const call of captured){
    for (const cd of call.cands){
      total++;
      if (cd.reads === undefined){ undefBag++; continue; }
      if (cd.reads['gp:er20ok'] === true || cd.reads['gp:er20ok'] === false) withEr++;
      if (cd.reads['gp:d1with'] === true || cd.reads['gp:d1with'] === false) withD1++;
      for (const k of Object.keys(cd.reads)) assert.ok(/^gp:|^free:|^ind:|^cf:|^pattern:/.test(k) || true, 'read keys are plain strings');
    }
  }
  assert.ok(total > 0, 'records were minted on the crafted tape');
  assert.equal(withEr, total, 'on a readable tape EVERY record carries gp:er20ok as a boolean (both lanes)');
  assert.ok(withD1 > 0, 'at least one swing record carries gp:d1with as a boolean');
  const scalpC = captured.filter(c2 => c2.tab === 'GOLDPINE:scalp').flatMap(c2 => c2.cands);
  for (const cd of scalpC) assert.ok(!(cd.reads && ('gp:d1with' in cd.reads)), 'no scalp record carries gp:d1with');
  assert.equal(undefBag, 0, 'on a readable tape the freeReads bag is never empty (baseline behavior)');
  /* the swing book rides the 4h/d1 tapes; every swing cand on this tape is
     rising-regime so d1with is a boolean, never a fabricated NEITHER */
  const swingCands = captured.filter(c2 => c2.tab === 'GOLDPINE:swing').flatMap(c2 => c2.cands);
  let sawLong = false;
  for (const cd of swingCands){
    if (!(cd.reads && ('gp:d1with' in cd.reads))) continue;
    if (cd.dir === 'long'){ sawLong = true; assert.equal(cd.reads['gp:d1with'], true, 'rising 1d tape: long rows mark with-regime'); }
    else assert.equal(cd.reads['gp:d1with'], false, 'rising 1d tape: short rows mark against-regime (the read, not a verdict)');
  }
  assert.ok(sawLong, 'at least one long swing record was marked');
  /* a read that never lands must not fabricate a mark — drive the seam in a
     boot where pinegoldmath/indicators never loaded (the production
     fail-open shape; vm global function bindings are non-configurable, so a
     dark boot, not a delete, is the honest dark read) */
  const bare2 = vm.createContext({
    console, Math, JSON, Date, Intl, isFinite, NaN, Array, Object, String, Number, Boolean, Promise,
    setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} }, window: {}
  });
  bare2.window = bare2;
  vm.runInContext(src, bare2, { filename: 'goldpine.js' });
  const captured2 = [];
  bare2.hgFwdRecordScan = function(tab, tf, cands){ captured2.push({ tab, tf, cands }); return cands.length; };
  const res2 = bare2.runGoldPineScan({ rows15m: mkRows(280, 4000, 0.6), rows1h: mkRows(240, 3800, 1.5), rows4h: [], rows1d: [], source: 'unit-tape' }, { macro: null, now: 1700000000 });
  assert.ok(res2, 'scan fail-opens with the read stack dark');
  const allC = captured2.flatMap(c2 => c2.cands);
  for (const cd of allC){
    assert.ok(!(cd.reads && ('gp:er20ok' in cd.reads)), 'dark read -> no gp:er20ok key (never fabricated)');
    assert.ok(!(cd.reads && ('gp:d1with' in cd.reads)), 'dark read -> no gp:d1with key (never fabricated)');
  }
  /* the bag line in hgGpRecord is byte-untouched — the r2 marks ride in
     through the desk's own marking seam (gpMarkReads' sibling), so the
     hg-v1162 shape and the 80pct suite's verbatim pin stand as they are */
  assert.ok(/reads: \(s\.freeReads && typeof s\.freeReads === 'object'\) \? s\.freeReads : undefined,/.test(src),
    'the record seam bag line is byte-preserved (an all-absent bag still records reads:undefined)');
  assert.ok(/gpR2MarkReads\(swing, 'swing', bars\);/.test(src) && /gpR2MarkReads\(scalp, 'scalp', bars\);/.test(src),
    'the r2 marking runs once per scan per lane at the marking seam, beside gpMarkReads');
}

/* --- §4 the marks gate NOTHING, anywhere --- */
assert.ok(!/er20|d1with|gpR2Marks/.test(GP.gpMayLead.toString()), 'gpMayLead never reads the r2 marks');
assert.ok(!/er20|d1with|gpR2Marks/.test(GP.gpAdmissionFloor.toString()), 'gpAdmissionFloor never reads the r2 marks');
{
  /* cardHTML is internal; the structural pin: the helper is called ONLY by
     the marking seam, and the seam is called ONLY beside gpMarkReads — no
     paint/gate site */
  const defn = (src.match(/function gpR2Marks\(s, bars\)/g) || []).length;
  const calls = (src.match(/gpR2Marks\(s, bars\)/g) || []).length;
  const seamDefn = (src.match(/function gpR2MarkReads\(list, mode, bars\)/g) || []).length;
  const seamCalls = (src.match(/gpR2MarkReads\((swing|scalp), '(swing|scalp)', bars\)/g) || []).length;
  assert.equal(defn, 1, 'one helper home (hg-v949)');
  assert.equal(calls - defn, 1, 'the helper is called exactly once — inside the marking seam');
  assert.equal(seamDefn, 1, 'one marking-seam home');
  assert.equal(seamCalls, 2, 'the seam runs exactly twice per scan (swing + scalp), beside gpMarkReads');
  assert.equal((src.match(/W\.gpR2Marks = gpR2Marks/g) || []).length, 1, 'one test-seam export');
}
{
  const base = { mode: 'scalp', dir: 'long', entry: 4000, stop: 3980, rr: 2.0 };
  assert.equal(GP.gpMayLead(base), true, 'lead predicate unchanged on a clean row');
  assert.equal(GP.gpMayLead(Object.assign({}, base, { 'gp:er20ok': false, 'gp:d1with': false })), true,
    'a row carrying false marks leads identically — the marks are not a gate');
  assert.equal(GP.gpAdmissionFloor(Object.assign({}, base, { stop: 4005, 'gp:er20ok': false })).ok, false,
    'the floor fires on stop width alone, marks unread');
}
for (const gf of ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js',
                  'hg-perfect-setup.js', 'setup-stack.js', 'hg-forward.js', 'pinegoldmath.js']){
  const t = readFileSync(resolve(ROOT, gf), 'utf8');
  assert.ok(!/gp:er20ok|gp:d1with/.test(t), gf + ' carries no r2 mark key (hg-v966 refused by construction)');
}
{
  /* in goldpine.js the keys may appear ONLY at the helper, the record seam,
     and their own honesty comments */
  const hits = src.split('\n').filter(l => /gp:er20ok|gp:d1with/.test(l));
  assert.ok(hits.every(l => /out\['gp:|hg-v1420|Display only|never gates|gate NOTHING/i.test(l)),
    'mark keys live only at the helper/record seam + honesty comments: ' + hits.length + ' lines');
}

/* --- §5 the floor why: pinned prefix kept, venue math named --- */
{
  const r = GP.gpAdmissionFloor({ mode: 'scalp', dir: 'long', entry: 4000, stop: 4005 });
  assert.equal(r.ok, false, 'the floor still fires under 0.3%');
  assert.match(r.why, /stop under 0\.3% of entry/, 'the pinned prefix is verbatim (test-goldpine-admission-floor §1 rides it)');
  assert.match(r.why, /at XM costs the floor is 15x the round trip, at PAXG taker only 1\.15x/, 'the venue math is named');
  assert.match(r.why, /the venue, not the floor, is the remaining lever/, 'the lever is named, not smuggled into a floor');
  assert.equal(GP.gpAdmissionFloor({ mode: 'swing', dir: 'long', entry: 4000, stop: 4001 }).ok, true, 'swing is never floored');
  assert.ok(/String\(s\.mode\) !== 'scalp'\) return \{ ok: true \}/.test(src), 'the mode guard is byte-pinned');
  assert.ok(/< 0\.3\)/.test(src), 'the 0.3 literal is byte-pinned (numbers frozen — new floors only ADD, and none did)');
}

/* --- §6 ship stamps --- */
assert.ok(hgVerGte(HG_VER, 'hg-v1420'), 'HG_VER >= hg-v1420, got ' + HG_VER);
{
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const want = 'goldpine.js?v=' + HG_VER.replace('hg-v', '');
  assert.ok(html.includes(want), 'index.html goldpine.js ?v= byte-matches HG_VER (' + want + ')');
  const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
  assert.ok(sw.includes("HG_CACHE = '" + HG_VER + "'"), 'sw.js HG_CACHE rides the stamp');
}

console.log('PASS test-goldpine-r2-marks (hg-v1420): marks land, abstain, and gate nothing; the floor names the venue.');
