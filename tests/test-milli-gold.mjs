/**
 * hg-v936 — MILLI GOLD: gold setups from only the mechanics that measured
 * net-positive, and a disclosure that is load-bearing rather than decorative.
 *
 * The ask was a tab built from the profitable indicators and strategies. That
 * is a derivable question and nine of OMNIGOLD's 54 measured mechanics answer
 * it. What makes this pack honest rather than flattering is that hg-v935 had
 * already tested THIS EXACT selection out of sample — four disjoint windows,
 * mechanics ranked on the other three — and it scored 13-14 of 16, never
 * unanimous. So the cohort's +0.0565R is an upper bound, not a forecast, and
 * a tab called "the profitable ones" is precisely the shape a reader
 * over-trusts.
 *
 * What this guard pins:
 *   1. the roster is GENERATED from the committed walk, with every figure
 *      re-derived here from the artifact rather than read back from the JS;
 *   2. the admission rule is the stated one, and it uses the desk's OWN
 *      sample floor rather than a looser one invented for this tab;
 *   3. the filter runs on DETECT output, so an off-roster mechanic is never
 *      evaluated — proved behaviourally, not by reading the source;
 *   4. an EMPTY roster shows nothing and never falls back to the full
 *      register, because "only the measured ones" with no measurements is a
 *      different desk, not a smaller one;
 *   5. the disclosure states the out-of-sample result and the largest t, and
 *      cannot quietly lose either;
 *   6. nothing here loosens a gate — the roster only ever removes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import * as GEN from '../scripts/milli-gold-roster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' — got ' + a + ', want ~' + b);

const MG = join(ROOT, 'milligold.js');
const SRC = readFileSync(MG, 'utf8');
const ART = JSON.parse(readFileSync(join(ROOT, 'scripts', 'omnigold-replay-evidence.json'), 'utf8'));
const FORMED = ART.sequentialBake.formedByKind;

function load(pre){
  const ctx = { Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number,
    console: { log(){}, warn(){}, error(){} } };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  if (pre) pre(ctx);
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { timeout: 20000 });
  return ctx;
}
const W = load();

/* ---- 1. the roster is generated, and every figure re-derived ---- */
console.log('1. the roster comes from the walk, not from a hand-typed list');
{
  const r = GEN.run(false);
  eq(r.drift, false, 'the committed milligold.js round-trips to zero drift');
  const once = GEN.splice(SRC, GEN.renderBlock(r.rows, r.cohort, ART));
  eq(GEN.splice(once, GEN.renderBlock(r.rows, r.cohort, ART)), once,
     'and the splice is idempotent — the committed file is the generators fixed point');

  /* Proved on strings. hg-v935 found out what a guard that writes a real
     source file costs: under the mutation harness one wrote numbers computed
     by a BROKEN generator and the restore did not survive the process. */
  const wrecked = SRC.replace(/var HG_MILLI_ROSTER = \{[\s\S]*?\n  \};/,
    'var HG_MILLI_ROSTER = { kinds: [] };');
  ok(wrecked !== SRC, 'the corruption actually changes the source');
  eq(GEN.splice(wrecked, GEN.renderBlock(r.rows, r.cohort, ART)), SRC,
     'and the generator rebuilds it BYTE-IDENTICAL from the corrupted text');
  /* The pattern is escaped so this assertion does not match its own source —
     the first version searched for the bare identifier and found the regex
     literal itself, failing on a file that contains no write at all. */
  ok(!/writeFileSync\(/.test(readFileSync(join(ROOT, 'tests', 'test-milli-gold.mjs'), 'utf8')),
     'and THIS TEST never writes milligold.js');

  const R = W.HG_MILLI_ROSTER;
  ok(R && Array.isArray(R.kinds) && R.kinds.length > 0, 'the loaded tab carries a roster');
  for (const k of R.kinds){
    const f = FORMED[k.kind];
    ok(!!f, k.kind + ' exists in the committed walk');
    if (!f) continue;
    eq(k.settled, f.settled, k.kind + ' settled matches the artifact');
    near(k.winRate, f.winRate, 1e-4, k.kind + ' win rate matches');
    near(k.grossR, f.grossR, 1e-4, k.kind + ' gross matches');
    near(k.netXm, f.netR_xm, 1e-4, k.kind + ' net at XM matches');
    near(k.tCluster, f.effective.tCluster, 1e-2, k.kind + ' cluster-robust t matches');
  }
}

/* ---- 2. the admission rule is the stated one ---- */
console.log('2. admitted on net > 0 at XM, at the desks OWN sample floor');
{
  const R = W.HG_MILLI_ROSTER;
  eq(R.minN, GEN.MIN_N, 'the roster records the floor it used');
  eq(GEN.MIN_N, 20, 'which is 20 — omnigolds own MIN_SAMPLES, not a looser one for this tab');
  const ogSrc = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
  const m = ogSrc.match(/var MIN_SAMPLES = (\d+);/);
  ok(!!m, 'omnigold.js declares MIN_SAMPLES');
  if (m) eq(Number(m[1]), GEN.MIN_N,
    'and the roster floor equals it — a looser floor would admit mechanics that gate calls too thin');

  for (const k of R.kinds){
    ok(k.netXm > 0, k.kind + ' is net-positive at XM');
    ok(k.n >= R.minN, k.kind + ' clears the sample floor');
  }
  /* Everything excluded is excluded BY THE RULE, not by omission. */
  const admitted = new Set(R.kinds.map((k) => k.kind));
  let checked = 0;
  for (const kind of Object.keys(FORMED)){
    const f = FORMED[kind];
    if (!f || !(+f.settled > 0)) continue;
    const should = (+f.n >= GEN.MIN_N) && (+f.netR_xm > 0);
    eq(admitted.has(kind), should, kind + ' membership follows the rule exactly');
    checked++;
  }
  ok(checked > 40, 'every measured mechanic was checked against the rule — ' + checked);

  /* The cohort figure the panel quotes, recomputed independently. */
  const n = R.kinds.reduce((a, k) => a + k.settled, 0);
  eq(R.cohortN, n, 'the cohort n is the sum of its rows');
  near(R.cohortNet, R.kinds.reduce((a, k) => a + k.netXm * k.settled, 0) / n, 1e-3,
     'and the cohort net is the settled-weighted mean, not a mean of means');
  near(R.maxAbsT, Math.max(...R.kinds.map((k) => Math.abs(k.tCluster))), 1e-9,
     'the largest |t| is the largest |t|');
  ok(R.maxAbsT < 3.1,
     'and it is below the family bar — none of these is individually significant (' + R.maxAbsT + ')');
}

/* ---- 3. the filter runs before evaluation ---- */
console.log('3. an off-roster mechanic is never evaluated');
{
  const R = W.HG_MILLI_ROSTER;
  const on = R.kinds[0].kind, off = 'PIVOT-REJECT';
  ok(!R.kinds.some((k) => k.kind === off), off + ' is NOT on the roster');

  const hits = [{ kind: on, dir: 'long' }, { kind: off, dir: 'short' },
                { kind: 'ROUND-MAGNET', dir: 'long' }, { kind: on.toLowerCase(), dir: 'short' }];
  const kept = W.hgMilliFilterHits(hits);
  eq(kept.length, 2, 'only the roster hits survive, case-insensitively');
  ok(kept.every((h) => String(h.kind).toUpperCase() === on),
     'and they are the roster mechanic');
  ok(!kept.some((h) => String(h.kind).toUpperCase() === off),
     'the measured-failing mechanic never reaches evaluation');

  eq(W.hgMilliFilterHits([]).length, 0, 'no hits, no cards');
  eq(W.hgMilliFilterHits(null).length, 0, 'and a null hit list is not a crash');
  ok(W.hgMilliRecord(on), 'a roster mechanic resolves its record for the card chip');
  eq(W.hgMilliRecord(off), null, 'and an off-roster one has none to show');
}

/* ---- 3b. the card says what its mechanic's record actually is ---- */
console.log('3b. every card carries its record, and calls it in-sample');
{
  const R = W.HG_MILLI_ROSTER, on = R.kinds[0];
  const html = W.hgMilliCardsHtml([{ kind: on.kind, dir: 'long' }]);
  ok(/ROSTER RECORD/.test(html), 'the card carries a record chip');
  ok(html.indexOf(on.kind) >= 0, 'naming the mechanic');
  ok(html.indexOf(String(on.settled)) >= 0, 'with the settled count it was admitted on');
  ok(/in sample/i.test(html),
     'and saying the record is IN SAMPLE — the card must not read as a forward claim');
  ok(/inside the noise/i.test(html), 'and that it is inside the noise');

  /* Silence is a designed state here, and the tab says why rather than looking
     broken: it watches nine mechanics where OMNIGOLD watches its register. */
  const none = W.hgMilliCardsHtml([]);
  ok(/No setup from the roster/.test(none), 'an empty scan says so');
  ok(/by construction/.test(none), 'and that being quiet is designed, not a fault');
  ok(none.indexOf(String(R.kinds.length)) >= 0, 'naming how many mechanics it watches');
}

/* ---- 4. an empty roster shows NOTHING ---- */
console.log('4. no measurements means no setups, not every setup');
{
  const empty = load();
  empty.HG_MILLI_ROSTER.kinds.length = 0;
  eq(empty.hgMilliFilterHits([{ kind: 'MMOVE' }, { kind: 'ANYTHING' }]).length, 0,
     'an empty roster keeps nothing — it never falls back to the full register');
  const note = empty.hgMilliDisclosureHtml();
  ok(/NO ROSTER/.test(note), 'and the tab says so');
  ok(/not a smaller desk/.test(note), 'naming why a fallback would be wrong');
}

/* ---- 5. the disclosure is load-bearing ---- */
console.log('5. the panel states what the selection is worth');
{
  const h = W.hgMilliDisclosureHtml();
  ok(/13-14 of 16/.test(h), 'it quotes hg-v935s out-of-sample result');
  ok(/never unanimous/i.test(h), 'and that it was never unanimous');
  ok(/upper bound/i.test(h), 'and calls the cohort figure an upper bound');
  ok(new RegExp(String(W.HG_MILLI_ROSTER.maxAbsT.toFixed(2))).test(h),
     'it renders the largest t from the roster');
  ok(/inside the noise/i.test(h), 'and says what that means');
  ok(/disjoint windows/.test(h), 'and how the out-of-sample test was run');
  /* Derived, not transcribed: the measured figures come from the literal. */
  const body = SRC.slice(SRC.indexOf('function hgMilliDisclosureHtml'),
                         SRC.indexOf('function hgMilliRosterHtml'));
  ok(/R\.cohortNet/.test(body) && /R\.maxAbsT/.test(body) && /R\.cohortN/.test(body),
     'every measured number in the panel comes from the roster literal');
  ok(!/0\.0565|678|1\.55/.test(body.replace(/\/\*[\s\S]*?\*\//g, '')),
     'and none is baked into the rendered string');

  const table = W.hgMilliRosterHtml();
  for (const k of W.HG_MILLI_ROSTER.kinds)
    ok(table.indexOf(k.kind) >= 0, table ? k.kind + ' is listed in the roster table' : 'table');
  ok(/MIN_SAMPLES|own MIN_SAMPLES|desk/.test(table), 'and the table explains the sample floor');
}

/* ---- 6. it is OMNIGOLDs engine, and it only ever removes ---- */
console.log('6. no second engine, and no gate loosened');
{
  for (const fn of ['hgOgFetchRows', 'hgOgDetect', 'hgOgEvaluate'])
    ok(SRC.indexOf(fn) > 0, 'the tab consumes ' + fn + ' rather than reimplementing it');
  ok(/no-engine/.test(SRC) && /has no engine of its own/.test(SRC),
     'and with OMNIGOLD absent it says so instead of inventing a fallback engine');
  ok(!/hgOgSetEdgeProof|hgOgSetOneAtATime|COST_VETO_R|MIN_SAMPLES\s*=/.test(SRC),
     'it changes no gate, threshold or toggle');
  ok(/HG_tabs\.push\(\{ id: 'milligold'/.test(SRC), 'it registers as its own tab');

  /* The shared gold tape rule. A candle-fetching gold tab that skips it can
     print confident numbers off a stale or broken feed, and a narrow roster
     makes that worse rather than better: fewer setups means each one carries
     more weight. test-gold-tape-sanity-family enforces this across the group
     and caught this tab missing it. */
  ok(/hgGoldTapeNotes/.test(SRC), 'it calls the shared gold tape-sanity rule');
  ok(SRC.indexOf('tapeNote + hgMilliDisclosureHtml') > 0,
     'and renders the warning ABOVE its own disclosure, not below it');

  const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
  ok(/<script src="milligold\.js/.test(idx), 'index.html loads it');
  ok(idx.indexOf('milligold.js') > idx.indexOf('omnigold.js'),
     'after omnigold.js, whose exports it consumes');
  ok(/'milligold'/.test(idx), 'and it is in the GOLD nav group');
  ok(/'\.\/milligold\.js'/.test(readFileSync(join(ROOT, 'sw.js'), 'utf8')),
     'the service worker caches it');
}

console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
