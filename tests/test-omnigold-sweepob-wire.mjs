/**
 * hg-v923 — SWEEP→OB on OMNIGOLD, and the record that was never its own.
 *
 * Two things ship together here and the second is why the first needed care.
 *
 * 1. hgGoldSweepOb has run on every gold scan since hg-v560 and mints on GOLD
 *    SCALP, but was never registered as an OMNIGOLD mechanic — every other
 *    library model got an explicit wire pack (P4 v568, P5 v569, P6 v570,
 *    P7 v571, VP v567). It now forms here, on the CONFIRMED path only.
 *
 * 2. The detector has four early returns that hand back tier:'watch' with no
 *    quality, and in two of them no targets and no R:R. On the committed GOLD
 *    SCALP replay ALL 62 sweepob firings came from one of those, and ZERO from
 *    the confirmed path — so the +0.427 gross / +0.162 net on the edge table is
 *    the PRECURSOR's record. The confirmed setup has never fired.
 *
 * This guard re-derives (2) from the replay rather than trusting the comment,
 * and pins that (1) cannot inherit it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

const ctx = {
  Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number,
  setTimeout: () => 0, clearTimeout: () => {},
  console: { log(){}, warn(){}, error(){} },
  document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
              addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem(){} },
  location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const GI_SRC = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
const OG_SRC = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
try { vm.runInContext(GI_SRC, ctx, { timeout: 30000 }); } catch (e) { /* guards its env */ }
try { vm.runInContext(OG_SRC, ctx, { timeout: 30000 }); } catch (e) { /* guards its env */ }

/* ---- 1. the claim, re-derived from the committed replay ---- */
console.log('1. every sweepob row in the walk is a PRE-TRIGGER state');
const replay = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
const sweepRows = replay.trades.filter((t) => t.stratKey === 'sweepob');
ok(sweepRows.length > 0, 'the replay has sweepob rows at all (' + sweepRows.length + ')');
/* the mint prints a numeric quality when and only when the detector scored one.
   Not a single row carries one, which is the whole finding. */
const stampOf = (t) => (t.stamps || []).find((x) => /^SWEEP→OB/.test(x)) || '';
const scored = sweepRows.filter((t) => /Q\d+\/10/.test(stampOf(t)));
eq(scored.length, 0, 'not one of the ' + sweepRows.length + ' carries a quality score');
ok(sweepRows.every((t) => stampOf(t)), 'and every one does carry a SWEEP→OB stamp, so the path did run');
/* and the edge row says so rather than quoting the number as the model's */
const TABLE = ctx.HG_GOLD_SETUP_EDGE;
const row = TABLE && TABLE.scalp && TABLE.scalp.sweepob;
ok(row, 'goldind still carries the sweepob edge row');
eq(row.action, 'neutral', 'whose action is unchanged — nothing was promoted or demoted on this finding');
ok(row.live && row.live.precursorOnly === true, 'the live block is flagged precursorOnly');
ok(/PRECURSOR/.test(row.why), 'and the why names it a precursor rather than the model');
ok(/never fired|has never/.test(row.why), 'and says the confirmed setup has not fired');

/* ---- 2. stage is set on every watch return, and only the last has a quality ---- */
console.log('2. the detector names which leg is missing');
const LABEL = ctx.hgGoldSweepObStageLabel;
ok(typeof LABEL === 'function', 'goldind exports hgGoldSweepObStageLabel');
for (const [st, want] of [['ny-open-wait', /MSS/], ['no-entry-zone', /OB\/FVG/],
                          ['awaiting-retrace', /retrace/], ['confirmed', /confirmed/]]){
  ok(want.test(LABEL(st)), 'stage ' + st + ' reads as English (' + LABEL(st) + ')');
}
ok(/not yet triggered/.test(LABEL('anything-else')) && /not yet triggered/.test(LABEL(null)),
   'an unknown or missing stage is not yet triggered, never a throw');
/* the three pre-trigger returns each set one, and the scored path sets its own */
const body = GI_SRC.slice(GI_SRC.indexOf('function hgGoldSweepOb(rows, opts)'),
                          GI_SRC.indexOf('function hgGoldSweepObHtml'));
for (const st of ['ny-open-wait', 'no-entry-zone', 'awaiting-retrace']){
  ok(body.indexOf("out.stage = '" + st + "'") >= 0, 'the ' + st + ' return sets its stage');
}
ok(/out\.stage = out\.confirmed \? 'confirmed' : 'scored'/.test(body),
   'and only the scored path distinguishes confirmed from scored');
const watchReturns = (body.match(/out\.tier = 'watch'/g) || []).length;
const stages = (body.match(/out\.stage = '/g) || []).length;
eq(stages, watchReturns, 'every watch return has a stage (' + stages + ' of ' + watchReturns + ')');

/* ---- 3. the stamp no longer prints Q?/10 ---- */
console.log('3. a pre-trigger card says what it is waiting for');
ok(!/'SWEEP→OB Q'\s*\+\s*\(sob\.quality \? sob\.quality\.score : '\?'\)/.test(GI_SRC),
   'the Q?/10 fallback is gone');
ok(/SWEEP→OB WAITING · ' \+ hgGoldSweepObStageLabel/.test(GI_SRC),
   'and a missing quality prints the stage instead');
ok(/sobCand\.sweepObStage = sob\.stage/.test(GI_SRC), 'the stage rides on the candidate too');
/* the mint itself is UNCHANGED: those rows are the best-performing cohort in
   the scalp book (+0.30R on n=29 live) and removing them is not this pack's
   call. Only what they are CALLED changed. */
ok(/if \(sob && \(sob\.confirmed \|\| sob\.tier === 'alert' \|\| sob\.tier === 'watch'\) && sob\.dir\)/.test(GI_SRC),
   'GOLD SCALP still mints the watch tier — this pack renamed, it did not remove');
ok(/if \(sob\.tier === 'watch' && !sob\.confirmed\) sobCand\.demoted = true;/.test(GI_SRC),
   'and still demotes it');

/* ---- 4. OMNIGOLD forms it, CONFIRMED only ---- */
console.log('4. the OMNIGOLD mechanic is wired, and only to the confirmed path');
const MECH = ctx.OG_MECHANICS || (OG_SRC.match(/'SWEEP-OB'/) ? null : null);
ok(/'SWEEP-OB'\];/.test(OG_SRC) || /'SWEEP-OB',/.test(OG_SRC), 'SWEEP-OB is in the register');
ok(/function hgOgSweepObHit\(rows, opts\)/.test(OG_SRC), 'the detector exists');
ok(/d = hgOgSweepObHit\(rows, opts\);\s+if \(d\) out\.push\(d\);/.test(OG_SRC),
   'and is called in the detect list, so a live scan can form it');
ok(/'SWEEP-OB':'SWEEP'/.test(OG_SRC), 'its family is SWEEP — one vote per family still applies');
ok(/if \(k === 'SWEEP-OB'\) return 'sweepob';/.test(OG_SRC),
   'and it maps to the same institutional stratKey GOLD SCALP mints');
ok(/'SWEEP-OB':\s+function\(r\)\{ return hgOgSweepObHit\(r, \{ nowSec: hgOgBtLastSec\(r\) \}\); \}/.test(OG_SRC),
   'the walk-forward map reaches it with the BAR clock, not the wall clock');
/* the gate: confirmed AND stage, so a later edit to the tier ladder cannot
   let a precursor through this door */
const ogBody = OG_SRC.slice(OG_SRC.indexOf('function hgOgSweepObHit'),
                            OG_SRC.indexOf('function hgOgPart4ByKind'));
ok(/!sob\.confirmed \|\| sob\.stage !== 'confirmed'/.test(ogBody),
   'it refuses anything that is not confirmed, checked two ways');
ok(/if \(!isFinite\(stop\) \|\| !isFinite\(t1\)\) return null;/.test(ogBody),
   'and refuses a row without a stop and a target — the precursor has neither');
ok(!/tier === 'watch'/.test(ogBody), 'the watch tier is never accepted here');

/* ---- 5. and it cannot inherit the precursor's record ---- */
console.log('5. NEVER OBSERVED, with the sibling record attributed not borrowed');
const STATE = ctx.hgOgKindKnownState, UNOBS = ctx.hgOgUnobservedKinds;
ok(typeof STATE === 'function' && typeof UNOBS === 'function', 'the state helpers are reachable');
if (typeof STATE === 'function'){
  eq(STATE('SWEEP-OB'), 'unobserved', 'SWEEP-OB has no record on this walk');
  ok(UNOBS().indexOf('SWEEP-OB') >= 0, 'so it is in the derived unobserved set');
}
const NOTE = ctx.hgOgSiblingRecordNote, BELOW = ctx.hgOgReplayBelowBarHtml;
ok(typeof NOTE === 'function', 'omnigold exports hgOgSiblingRecordNote');
if (typeof NOTE === 'function'){
  const n = NOTE('SWEEP-OB');
  ok(/GOLD SCALP walk does have a record/.test(n), 'the note admits the sibling record exists');
  ok(/sweepob/.test(n), 'names the stratKey it is filed under');
  ok(/\+0\.162R|\+0\.16R/.test(n) || /0\.162/.test(n), 'quotes its number rather than hiding it');
  ok(/n=49/.test(n), 'with the n it was earned on');
  ok(/PRE-TRIGGER/.test(n), 'and says it measures the pre-trigger states, not this mechanic');
  ok(/not this one/.test(n) || /not this mechanic/.test(n), 'so it is attributed, never borrowed');
  /* a mechanic with no sibling row says nothing rather than inventing one.
     This is the trap the strict mapper exists for: hgOgKindToInstKey falls
     back to 'vwap' for anything unmapped, and 'vwap' HAS an edge row — so
     without strict mode every unobserved mechanic would have been handed the
     vwap record (-0.314R over n=132) as if it were its own. */
  eq(NOTE('SMT-DIVERGE'), '', 'a mechanic with no sibling row adds no note');
  eq(NOTE('NOT-A-MECHANIC'), '', 'and neither does a string that is not a mechanic');
  const K = ctx.hgOgKindToInstKey;
  ok(typeof K === 'function', 'hgOgKindToInstKey is reachable');
  if (typeof K === 'function'){
    eq(K('SWEEP-OB'), 'sweepob', 'SWEEP-OB maps explicitly, ahead of the generic SWEEP catch');
    eq(K('SWEEP-OB', true), 'sweepob', 'and the same under strict, because the mapping is named');
    eq(K('SMT-DIVERGE'), 'vwap', 'an unmapped kind still gets the generic rule set for GATING');
    eq(K('SMT-DIVERGE', true), null, 'but strict refuses to call that its record');
    eq(K('POOL-SWEEP'), 'sweep', 'the sweep family catch still applies for gating');
    eq(K('POOL-SWEEP', true), null, 'and is a fallback under strict too');
    /* the note carries a registration guard as well as the strict lookup.
       It is redundant today and the redundancy is PROVEN here rather than
       assumed: every kind with a named mapping is a registered mechanic, so
       strict already covers the unregistered case. If that ever stops being
       true the guard becomes load-bearing instead of decorative. */
    /* scoped to the mapper's own body — an unscoped scan also matches the
       prose in the comment that explains this very guard */
    const mapBody = OG_SRC.slice(OG_SRC.indexOf('function hgOgKindToInstKey(kind, strict)'),
                                 OG_SRC.indexOf('function hgOgInstNowMs'));
    const named = [...mapBody.matchAll(/if \(k === '([A-Z0-9-]+)'\) return '/g)].map((m) => m[1]);
    ok(named.length > 5, 'the mapper has named mappings to check (' + named.length + ')');
    const unregisteredButNamed = named.filter((k) => ctx.hgOgKindKnownState(k) === null);
    eq(unregisteredButNamed.length, 0,
       'every named mapping belongs to a registered mechanic' +
       (unregisteredButNamed.length ? ' — NOT: ' + unregisteredButNamed.join(', ') : ''));
  }
}
if (typeof BELOW === 'function'){
  const html = BELOW('SWEEP-OB');
  ok(/NEVER OBSERVED/.test(html), 'the card line still leads with NEVER OBSERVED');
  ok(/GOLD SCALP walk does have a record/.test(html), 'and carries the sibling note');
  ok(/13 of 78/.test(html), 'and counts the register as it now stands');
}

/* ---- 6. nothing was loosened ---- */
console.log('6. no gate, bar or action moved');
eq(row.n, 49, 'the sweepob edge n is untouched');
eq(row.gross, 0.427, 'its gross is untouched');
eq(row.net, 0.162, 'its net is untouched');
eq(row.live.n, 29, 'and the live n too — this pack re-labelled, it did not re-measure');
ok(/var HG_GOLD_SWEEPOB_ALERT_Q/.test(GI_SRC), 'the alert quality bar still exists');
ok(!/action: 'prefer'[\s\S]{0,200}sweepob/.test(GI_SRC), 'sweepob was not promoted to prefer');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
