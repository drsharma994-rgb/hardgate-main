/**
 * hg-v934 — a new detector has no record; say WHOSE record it is.
 *
 * hg-v933 added three gold-native detectors and stamped every one of them
 * NO MEASURED RECORD. That was true of the idea and FALSE about the evidence:
 * goldround's OMNIGOLD twin ROUND-MAGNET has 587 settled firings in the
 * committed walk, and goldfix's twin LONDON-FIX has 69. "Nothing is known"
 * and "hundreds of measurements of the nearest thing exist, and they are
 * negative" are different statements, and the desk shipped the wrong one.
 *
 * This pack ports the two OMNIGOLD mechanics these tabs still lacked
 * (WEEKLY-OPEN, FIB-618), quotes each detector's twin record, and REFUSES the
 * third (PIVOT-REJECT) because it is not unmeasured — it is measured at
 * -2.69 sigma, past omnigold's own known-failure bar, and GOLD SCALP / GOLD
 * SWING have no measured-edge gate that would stop it.
 *
 * What this guard pins:
 *   1. every quoted number is DERIVED from the committed artifact, and the
 *      generator round-trips the tree to zero drift and rebuilds byte-identical;
 *   2. the veto constant here and EDGE_VETO_Z in omnigold.js cannot drift apart;
 *   3. a twin measured at or below that bar is filtered BEHAVIOURALLY, not by
 *      the accident that nothing currently mints it;
 *   4. the note names the twin, quotes it, and ATTRIBUTES it to OMNIGOLD —
 *      borrowing a record silently is the failure hg-v923 already found once;
 *   5. golddxy, which genuinely has no twin, still says so;
 *   6. the two new detectors fire on the structure they claim and not on
 *      structure they do not.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import * as GEN from '../scripts/gold-sibling-records.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' — got ' + a + ', want ~' + b);

const XTRA = join(ROOT, 'gold-extra-strategies.js');
const XSRC = readFileSync(XTRA, 'utf8');
const GIND = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
const OGSRC = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
const ART = JSON.parse(readFileSync(join(ROOT, 'scripts', 'omnigold-replay-evidence.json'), 'utf8'));
const FORMED = ART.sequentialBake.formedByKind;

function load(){
  const store = {};
  const ctx = {
    Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number, Intl,
    console: { log(){}, warn(){}, error(){} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); } }
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(XSRC, ctx, { timeout: 20000 });
  return ctx;
}
const W = load();

/* ---- 1. the literal is generated, and the generator is the only author --- */
console.log('1. every quoted number is derived from the committed walk');
{
  const r = GEN.run(false);
  eq(r.drift, false, 'committed gold-extra-strategies.js round-trips to zero drift');
  eq(r.wrote, false, 'a read-only run writes nothing');

  /* Rebuild from a corrupted tree and require byte-identical recovery — the
     hg-v921 guard shape. A generator that only agrees with what is already
     there proves nothing. */
  /* Proved in memory. hg-v935 found out the hard way what a guard that writes
     a real source file costs: under the mutation harness one run wrote a
     literal computed by a BROKEN generator and the restore did not survive the
     process, leaving the repository carrying numbers no measurement produced.
     splice() and renderBlock() are pure, so nothing here needs to touch disk. */
  const twinsNow = GEN.readTwins(XSRC);
  const wrecked = XSRC.replace(/var HG_GOLD_SIBLING_RECORD = \{[\s\S]*?\n\};/,
    "var HG_GOLD_SIBLING_RECORD = { 'ROUND-MAGNET': { n: 1, settled: 1, winRate: 0.99, grossR: 9, netXm: 9, tCluster: 9, zBreakeven: 9, minRr: 2, breakevenPct: 33.3 } };");
  ok(wrecked !== XSRC, 'the corruption actually changes the source');
  eq(GEN.splice(wrecked, GEN.renderBlock(GEN.buildRecords(twinsNow, ART))), XSRC,
     'and the generator rebuilds it BYTE-IDENTICAL from the corrupted text');
  const once = GEN.splice(XSRC, GEN.renderBlock(GEN.buildRecords(twinsNow, ART)));
  eq(GEN.splice(once, GEN.renderBlock(GEN.buildRecords(twinsNow, ART))), once,
     'and the splice is idempotent — the committed file is the generators fixed point');
  ok(!/writeFileSync\(XTRA/.test(readFileSync(join(ROOT, 'tests', 'test-gold-sibling-records.mjs'), 'utf8')),
     'and THIS TEST never writes gold-extra-strategies.js');

  /* Each field re-derived here from the artifact, not read back from the JS. */
  const twins = GEN.readTwins(XSRC);
  let checked = 0;
  for (const kind of Object.keys(twins)){
    const twin = twins[kind];
    if (!twin || !FORMED[twin]) continue;
    const rec = W.HG_GOLD_SIBLING_RECORD[twin];
    ok(!!rec, twin + ' is present in the generated literal');
    if (!rec) continue;
    eq(rec.settled, FORMED[twin].settled, twin + ' settled matches the artifact');
    near(rec.winRate, FORMED[twin].winRate, 1e-4, twin + ' win rate matches the artifact');
    near(rec.grossR, FORMED[twin].grossR, 1e-4, twin + ' gross matches the artifact');
    near(rec.netXm, FORMED[twin].netR_xm, 1e-4, twin + ' net at XM matches the artifact');
    near(rec.tCluster, FORMED[twin].effective.tCluster, 1e-2, twin + ' cluster-robust t matches');
    /* significance recomputed independently of the generator's own helper */
    const pB = 1 / 3, n = FORMED[twin].settled;
    const z = (FORMED[twin].winRate - pB) / Math.sqrt(pB * (1 - pB) / n);
    near(rec.zBreakeven, z, 0.01, twin + ' sigma vs the 2R breakeven recomputes');
    checked++;
  }
  ok(checked >= 4, 'at least four twins carry a re-derived record — checked ' + checked);
}

/* ---- 1b. the generator fails LOUDLY, which is the whole hg-v921 rule ---- */
console.log('1b. a block it cannot find, or a record it cannot read, is fatal');
{
  /* A twin the walk observed but the gate-clear bake did not is a BROKEN
     artifact, not an absent record — skipping it would silently turn a
     measured mechanic into "nothing is known", which is the exact false
     statement this pack exists to delete. */
  let threw = false;
  try {
    GEN.buildRecords({ goldround: 'ROUND-MAGNET' }, {
      perKind: { 'ROUND-MAGNET': { n: 620 } },
      sequentialBake: { formedByKind: {} }
    });
  } catch (e){ threw = true; }
  ok(threw, 'a twin in perKind with no gate-clear record THROWS rather than dropping it');

  /* A mechanic in neither is genuinely never-observed — 24 of 78 are — and
     that is a real state, not an error. */
  let quiet = null;
  try { quiet = GEN.buildRecords({ golddxy: 'SMT-DIVERGE' },
        { perKind: {}, sequentialBake: { formedByKind: {} } }); }
  catch (e){ quiet = null; }
  ok(quiet && Object.keys(quiet).length === 0,
     'a never-observed twin is left out quietly — that is a state, not a fault');

  /* Markers gone = fatal. A generator that silently returns the input is a
     generator that stops generating and nobody finds out. */
  let spliceThrew = false;
  try { GEN.splice('var x = 1;\n', 'var HG_GOLD_SIBLING_RECORD = {};'); }
  catch (e){ spliceThrew = true; }
  ok(spliceThrew, 'a source with no generated-block markers THROWS');
  const round = GEN.splice(XSRC, GEN.renderBlock({}));
  ok(round !== XSRC && round.indexOf(GEN.BEGIN) > 0 && round.indexOf(GEN.END) > 0,
     'and a real splice keeps both markers so the next run can find them');

  /* The record quoted is the GATE-CLEAR one, which hg-v917 showed is the
     honest and usually worse line — not the unscoped perKind number. */
  const rm = W.HG_GOLD_SIBLING_RECORD['ROUND-MAGNET'];
  eq(rm.settled, FORMED['ROUND-MAGNET'].settled, 'the quoted record is the gate-clear population');
  ok(rm.settled !== ART.perKind['ROUND-MAGNET'].n,
     'and is distinguishable from the unscoped line — ' + rm.settled
     + ' settled vs ' + ART.perKind['ROUND-MAGNET'].n + ' unscoped firings');
  ok(Math.abs(rm.netXm - FORMED['ROUND-MAGNET'].netR_paxg) > 0.1,
     'the net is priced at XM, not at the replays PAXG cost');
}

/* ---- 2. the duplicated veto constant cannot drift ---- */
console.log('2. the -2 sigma bar is the same number omnigold vetoes at');
{
  const here = XSRC.match(/var HG_GOLD_EXTRA_VETO_Z\s*=\s*(-?\d+(?:\.\d+)?)/);
  const there = OGSRC.match(/var EDGE_VETO_Z\s*=\s*(-?\d+(?:\.\d+)?)/);
  ok(!!here, 'gold-extra-strategies.js declares HG_GOLD_EXTRA_VETO_Z');
  ok(!!there, 'omnigold.js declares EDGE_VETO_Z');
  if (here && there) eq(here[1], there[1], 'the two copies of the known-failure bar agree');
  eq(W.HG_GOLD_EXTRA_VETO_Z, -2, 'and the loaded value is -2');
}

/* ---- 3. PIVOT-REJECT is measured, and measured FAILING ---- */
console.log('3. the third port is refused on its own record');
{
  const pr = W.hgGoldSiblingRecord('goldpivot');
  ok(!!pr, 'goldpivot names PIVOT-REJECT as its twin and finds the record');
  eq(pr.twin, 'PIVOT-REJECT', 'the twin is named');
  ok(pr.zBreakeven <= W.HG_GOLD_EXTRA_VETO_Z,
     'PIVOT-REJECT is at or below the known-failure bar — ' + pr.zBreakeven + 'σ');
  ok(pr.grossR < 0 && pr.netXm < 0, 'it is negative before AND after costs');
  eq(W.hgGoldSiblingVetoed('goldpivot'), true, 'so it is flagged vetoed');
  for (const k of ['goldround', 'goldfix', 'goldwopen', 'goldfib'])
    eq(W.hgGoldSiblingVetoed(k), false, k + ' is NOT vetoed — its twin is inside the noise');
  eq(W.hgGoldSiblingVetoed('golddxy'), false, 'a kind with no twin is not vetoed by absence');

  /* The refusal is recorded where the next person to find the gap will look. */
  ok(/PIVOT-REJECT/.test(XSRC) && /REFUS/i.test(XSRC),
     'the source records the refusal, so the gap is not re-derived and re-closed');
  ok(/no measured-edge gate/i.test(XSRC) || /NO MEASURED-EDGE GATE/.test(XSRC),
     'and says WHY it matters here: these desks have no gate that would catch it');
}

/* ---- 4. the guard is behavioural, not incidental ---- */
console.log('4. a vetoed twin is filtered out of the mint, not merely never minted');
{
  /* goldround fires on this: a wick through 4500 that closed back under it. */
  const rows = [];
  let t = Date.UTC(2026, 8, 15, 6, 0, 0);
  for (let i = 0; i < 40; i++){
    rows.push({ t: t / 1000, o: 4480, h: 4486, l: 4474, c: 4480 });
    t += 15 * 60 * 1000;
  }
  rows.push({ t: t / 1000, o: 4490, h: 4506, l: 4488, c: 4492 });
  const fired = W.hgGoldExtraDetect({ rows });
  ok(fired.some(x => x.kind === 'goldround'), 'the fixture mints goldround');

  /* Now make its twin a measured failure and require the SAME input to mint
     nothing. This is the only way to prove the filter runs: goldpivot is
     never minted, so its absence proves nothing on its own. */
  const rec = W.HG_GOLD_SIBLING_RECORD['ROUND-MAGNET'];
  const keep = rec.zBreakeven;
  try {
    rec.zBreakeven = -3;
    const after = W.hgGoldExtraDetect({ rows });
    ok(!after.some(x => x.kind === 'goldround'),
       'with its twin below the bar, the SAME bars mint nothing');
  } finally { rec.zBreakeven = keep; }
  const back = W.hgGoldExtraDetect({ rows });
  ok(back.some(x => x.kind === 'goldround'), 'and it returns when the record is restored');
}

/* ---- 5. the note quotes the twin and attributes it ---- */
console.log('5. the card says whose record it is quoting');
{
  const n = W.hgGoldExtraUncheckedNote('goldround');
  ok(/ROUND-MAGNET/.test(n), 'the note names the twin mechanic');
  ok(/OMNIGOLD/.test(n), 'and attributes the record to OMNIGOLD');
  ok(/587/.test(n), 'and quotes the settled count from the record');
  ok(/cannot lead/i.test(n), 'and still says it cannot lead');
  ok(!/^NO MEASURED RECORD/.test(n),
     'it no longer claims nothing is known — that was hg-v933s error');
  ok(/gates and its 1h horizon|OMNIGOLD's gates/.test(n),
     'and marks it as OMNIGOLDs gates and horizon, not this desks');

  const d = W.hgGoldExtraUncheckedNote('golddxy');
  ok(/^NO MEASURED RECORD/.test(d), 'golddxy, which has no twin, still leads with NO MEASURED RECORD');
  ok(/no\s+OMNIGOLD mechanic reads the same thing/.test(d),
     'and says plainly that there is no sibling record to borrow');
  ok(!/ROUND-MAGNET|WEEKLY-OPEN|FIB-618/.test(d), 'and borrows nobody elses');
  eq(W.hgGoldSiblingRecord('golddxy'), null, 'hgGoldSiblingRecord is null for it');

  /* The stamp is the one-line version and carries the same distinction. */
  const sRound = W.hgGoldExtraStamp('goldround');
  ok(/ROUND-MAGNET RECORD/.test(sRound), 'the stamp names the twin');
  ok(/−/.test(sRound), 'and renders a NEGATIVE record with a minus sign, not a plus');
  ok(!/NO RECORD/.test(sRound), 'and does not say NO RECORD');
  eq(W.hgGoldExtraStamp('golddxy'), 'GOLDDXY · NO RECORD', 'the no-twin stamp is unchanged');
}

/* ---- 6. weekly open ---- */
console.log('6. the weekly open is the reopen bars open, and needs a sweep');
{
  /* Sunday 22:00 UTC is the reopen. 2026-09-20 is a Sunday. */
  const sun22 = Date.UTC(2026, 8, 20, 22, 0, 0);
  eq(W.hgGoldWeekOpenMs(Date.UTC(2026, 8, 22, 9, 0, 0)), sun22,
     'a Tuesday maps back to Sundays 22:00 reopen');
  eq(W.hgGoldWeekOpenMs(Date.UTC(2026, 8, 20, 21, 0, 0)), Date.UTC(2026, 8, 13, 22, 0, 0),
     'Sunday BEFORE the reopen still belongs to the previous week');
  eq(W.hgGoldWeekOpenMs(sun22), sun22, 'the reopen instant itself is the weekly open');

  /* 20 bars BEFORE the reopen, not 6: the detector needs 20 rows at all, so a
     short fixture returns null for the wrong reason and the minBars rule goes
     untested. A mutation removing that rule survived this test until the
     fixture was long enough to reach it. */
  function week(triggerHi, triggerClose, triggerOpen, bars){
    const rows = [];
    let t = sun22 - 20 * 3600 * 1000;
    for (let i = 0; i < 20; i++){ rows.push({ t: t / 1000, o: 4400, h: 4404, l: 4396, c: 4400 }); t += 3600e3; }
    t = sun22;
    /* the reopen bar: its OPEN is the weekly open */
    rows.push({ t: t / 1000, o: 4500, h: 4504, l: 4496, c: 4498 }); t += 3600e3;
    for (let i = 0; i < (bars == null ? 12 : bars); i++){
      rows.push({ t: t / 1000, o: 4470, h: 4476, l: 4464, c: 4470 }); t += 3600e3;
    }
    rows.push({ t: t / 1000, o: triggerOpen, h: triggerHi, l: 4470, c: triggerClose });
    return rows;
  }
  const hit = W.hgGoldWeeklyOpen(week(4512, 4494, 4488));
  ok(!!hit, 'a wick through the weekly open that closed back under it fires');
  if (hit){
    eq(hit.dir, 'short', 'from below, piercing up and failing, is a short');
    eq(hit.kind, 'goldwopen', 'kind');
    near(hit.level, 4500, 1e-9, 'the level is the reopen bars OPEN (4500), not its close (4498)');
    ok(hit.stop > hit.entry, 'the stop sits above the entry on a short');
    ok(hit.stop > 4512, 'and beyond the sweep high');
  }
  ok(!W.hgGoldWeeklyOpen(week(4512, 4506, 4488)),
     'a close back ABOVE the weekly open is not a failed sweep');
  ok(!W.hgGoldWeeklyOpen(week(4501, 4494, 4488)),
     'a pierce too shallow to clear the ATR floor does not fire');
  ok(!W.hgGoldWeeklyOpen(week(4512, 4494, 4488, 1)),
     'a week that has not traded away from the open yet gets no opinion');
  const noOpen = [];
  { let t = Date.UTC(2026, 8, 22, 0, 0, 0);
    for (let i = 0; i < 30; i++){ noOpen.push({ t: t / 1000, o: 4500, h: 4506, l: 4494, c: 4500 }); t += 3600e3; } }
  ok(!W.hgGoldWeeklyOpen(noOpen), 'a feed that starts mid-week has no weekly open in it and returns null');
}

/* ---- 7. the 61.8 retrace ---- */
console.log('7. the retrace level is defined by bars BEFORE the trigger');
{
  function swing(triggerLow, triggerClose, triggerHigh){
    const rows = [];
    let t = Date.UTC(2026, 8, 14, 0, 0, 0);
    /* impulse up: 4400 -> 4500 */
    for (let i = 0; i < 20; i++){
      const px = 4400 + i * 5;
      rows.push({ t: t / 1000, o: px, h: px + 2, l: px - 2, c: px }); t += 900e3;
    }
    /* pullback toward the 61.8 at 4500 - 0.618*100 = 4438.2 */
    for (let i = 0; i < 8; i++){
      const px = 4495 - i * 6;
      rows.push({ t: t / 1000, o: px, h: px + 2, l: px - 2, c: px }); t += 900e3;
    }
    rows.push({ t: t / 1000, o: 4445, h: triggerHigh, l: triggerLow, c: triggerClose });
    return rows;
  }
  /* The expectation is DERIVED from the fixture, not typed: the first version
     of this test asserted 4438.2 from the round numbers the generator loop was
     meant to produce, and the loop's real extremes are 4497 / 4398. The test
     was wrong and the detector was right, which is the only reason to compute
     the expectation the same way the code must. */
  function fibOf(rows){
    const pre = rows.slice(0, rows.length - 1);
    const hi = Math.max(...pre.map(r => r.h)), lo = Math.min(...pre.map(r => r.l));
    return hi - 0.618 * (hi - lo);
  }
  const base = swing(4430, 4450, 4452);
  const WANT = fibOf(base);
  const f = W.hgGoldFib618(base);
  ok(!!f, 'trading down through the 61.8 and closing back above it fires');
  if (f){
    eq(f.dir, 'long', 'an up-impulse retrace held is a long');
    eq(f.kind, 'goldfib', 'kind');
    near(f.level, WANT, 1e-3, 'the level is 61.8 of the pre-trigger swing');
    ok(f.stop < f.level, 'the stop sits beyond the 78.6, below the level');
    ok(f.stop < 4430, 'and below the trigger bars own low');
  }
  ok(!W.hgGoldFib618(swing(4430, 4432, 4452)),
     'closing BELOW the level is not a hold');
  ok(!W.hgGoldFib618(swing(4448, 4452, 4455)),
     'never trading into the level is not a hold either');

  /* The trigger bar must not define its own level. This fixture is tuned so the
     setup fires BOTH ways — at 4435.8 correctly, and at a moved level if the
     scan included the trigger's own 4600 high — so the assertion is on the
     LEVEL and not on whether anything fired. The first version closed below the
     moved level, so the mutated code returned null, the test took its
     "rejected outright" branch and passed. An assertion with an ok(true) escape
     hatch is not an assertion; it is the hg-v929 mistake again. */
  const selfHigh = swing(4430, 4490, 4600);
  const g = W.hgGoldFib618(selfHigh);
  ok(!!g, 'the self-extreme fixture fires, so the level below is a real comparison');
  if (g) near(g.level, WANT, 1e-3,
    'a trigger bar printing a new extreme does NOT move the level it is judged against');

  /* A swing too small to be an impulse is not one.

     A perfectly flat tape does NOT test this: its high and low land on the same
     bar and the detector returns on the hiI === loI guard before the span floor
     is ever reached, so a mutation deleting the floor survived. This fixture has
     a real high bar and a real low bar, and a span (10) deliberately under the
     1.5x ATR floor (~12), with a trigger that WOULD fire if the floor were gone. */
  const shallow = [];
  { let t = Date.UTC(2026, 8, 14, 0, 0, 0);
    for (let i = 0; i < 30; i++){
      const r = { t: t / 1000, o: 4500, h: 4504, l: 4496, c: 4500 };
      if (i === 10) r.h = 4505;
      if (i === 20) r.l = 4495;
      shallow.push(r); t += 900e3;
    } }
  shallow.push({ t: (Date.UTC(2026, 8, 14, 0, 0, 0) + 30 * 900e3) / 1000,
                 o: 4500, h: 4504, l: 4496, c: 4498 });
  ok(!W.hgGoldFib618(shallow),
     'a 10-point swing under the 1.5x ATR floor is not an impulse, even though the trigger sits on the level');
  const flat = [];
  { let t = Date.UTC(2026, 8, 14, 0, 0, 0);
    for (let i = 0; i < 30; i++){ flat.push({ t: t / 1000, o: 4500, h: 4501, l: 4499, c: 4500 }); t += 900e3; } }
  ok(!W.hgGoldFib618(flat), 'and a flat tape has no impulse at all');
}

/* ---- 8. both desks and the registry ---- */
console.log('8. goldind registers the kinds and uses the record-aware stamp');
{
  ok(/goldwopen:\s*'WEEKLY OPEN SWEEP \+ RECLAIM'/.test(GIND), 'GST_NAME registers goldwopen');
  ok(/goldfib:\s*'61\.8 RETRACE HOLD'/.test(GIND), 'GST_NAME registers goldfib');
  ok(/hgGoldExtraStamp/.test(GIND), 'the mint calls hgGoldExtraStamp');
  ok(/xStamp \|\| \(String\(xr\.kind\)/.test(GIND),
     'and falls back to the old stamp when the module predates this pack');
  /* as above: the rule, not the line's punctuation (hg-v945) */
  ok(/if \(!promo\)\s*\{?\s*xCand\.demoted = true;/.test(GIND),
     'the demote is untouched — a quoted twin record does not promote anything');
  const detect = XSRC.slice(XSRC.indexOf('function hgGoldExtraDetect'));
  for (const fn of ['hgGoldWeeklyOpen', 'hgGoldFib618'])
    ok(detect.indexOf(fn) > 0 && detect.indexOf(fn) < detect.indexOf('return kept'),
       fn + ' is wired into the single detect call');
}

/* ---- 9. the OMNIGOLD panel ---- */
console.log('9. OMNIGOLD publishes what tickets on no record, and what it costs');
{
  ok(/function hgOgUnobservedPanelHtml/.test(OGSRC), 'omnigold.js defines the panel');
  ok(/\+ hgOgUnobservedPanelHtml\(\)/.test(OGSRC), 'and renders it in the panel chain');
  const chain = OGSRC.indexOf('+ hgOgUnobservedPanelHtml()');
  const relaxed = OGSRC.indexOf('+ hgOgEdgeRelaxedPanelHtml()');
  ok(relaxed > 0 && chain > relaxed,
     'directly under the relaxation panel, because it is what that relaxation freed');

  /* Derived, not transcribed: no count may be written into the string. */
  const body = OGSRC.slice(OGSRC.indexOf('function hgOgUnobservedPanelHtml'),
                           OGSRC.indexOf('function hgOgWalkAgeHtml'));
  ok(/OG_MECHANICS\.length/.test(body), 'the total comes from the register');
  ok(/hgOgFamilyZ\(total\)/.test(body) && /hgOgFamilyZ\(seen\)/.test(body),
     'and both sigma bars are computed at render');
  ok(!/\b(24|78|54)\b/.test(body.replace(/\/\*[\s\S]*?\*\//g, '')),
     'no mechanic count is baked into the rendered string');
  ok(/not acted on|NOT acted on/.test(body),
     'and it states that the looser bar is published, not applied');

  /* The arithmetic the panel reports, recomputed here from the same sources. */
  const names = (OGSRC.match(/var OG_MECHANICS = \[[\s\S]*?\];/) || [''])[0]
    .replace(/\/\*[\s\S]*?\*\//g, '').match(/'[A-Z0-9][A-Z0-9-]*'/g).map(s => s.slice(1, -1));
  const kinds = ART.perKind || {};
  const seen = names.filter(n => Object.prototype.hasOwnProperty.call(kinds, n)).length;
  ok(names.length > seen, 'some registered mechanics have never been observed — '
     + (names.length - seen) + ' of ' + names.length);
  const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
  function erf(x){
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const famZ = n => { let lo = 0, hi = 8, mid; const target = Math.pow(0.95, 1 / n);
    for (let i = 0; i < 64; i++){ mid = (lo + hi) / 2; if (normCdf(mid) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2; };
  ok(famZ(names.length) > famZ(seen),
     'the whole-register bar is STRICTER than the observed-subset bar — +'
     + (famZ(names.length) - famZ(seen)).toFixed(4) + 'σ charged by mechanics no measurement can clear');
  ok(/hgOgFamilyZ\(OG_MECHANICS\.length\)/.test(OGSRC),
     'and the live gate still corrects over the whole register — nothing loosened');
}

console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
