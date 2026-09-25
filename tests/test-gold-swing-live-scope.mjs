/* HARDGATE — hg-v962: the GOLD SWING `live` blocks reproduce their own
   headline, so hg-v961's "0 removals" measured the wrong thing.

   hg-v916 gave every SCALP row a `live` block because the scalp headline is the
   whole 2,193-trade replay and the desk forms 1,205 of it — a real subset, and
   the gap is the point. hg-v961 gave the SWING rows a `live` block and
   described it the same way. It is not the same thing: on ALL FOURTEEN swing
   rows the live block reproduces the headline to the headline's own precision,
   because the swing headline was ALREADY derived from
   scripts/backtest-goldswing-results.json before hg-v961 touched it. Proved
   against the pre-hg-v961 tree, 14 of 14.

   So hg-v961's three "removals asserted at zero" were the SCALP desk's gates
   (cost bar, 1.5xATR stop floor, suppress), none of which is the swing desk's.
   What the swing desk does that this walk does not is in the artifact's OWN
   metadata: hgFilterGoldPostGate, the weekend demotes, and the best-levels /
   formation ticket batch — and hgApplyGoldBestLevels REWRITES entry, stop and
   T1 on every live swing ticket. Those three numbers decide whether a trade
   fills, where it stops and what it wins. The swing verdicts are measured on a
   PRE-FORMATION book.

   THE OBVIOUS FIX IS REFUSED and the refusal is measured, not asserted:
   scoping the walk to the tab's own R:R floor flips two rows' net sign
   (`ob` n=4->3, `p8range` n=40->34 — the second would turn a neutral row that
   can lead into a demote), and it is refused because the walk computes rr on
   the inline engine's levels while the floor is applied by the pass that
   REPLACES them. Filtering a pre-snap ratio by a post-snap floor is a second
   wrong population, not a correction.

   Run: node tests/test-gold-swing-live-scope.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { swingScope, swingMinRrFromSource, unreplayedStages, literalText,
         SWING_KEY_ALIAS, REPLAY } from '../scripts/swing-live-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

function boot(src){
  const ctx = { window: {}, console, Math, Date, JSON, isFinite, parseFloat, String, Number, Array, Object };
  ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'goldind.js' });
  return ctx.window;
}
const GOLDIND = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
const W = boot(GOLDIND);
const TABLE = W.HG_GOLD_SETUP_EDGE;

/* =====================================================================
   1. The predicate exists and answers the question it claims to.
      Driven on INJECTED rows, so it is the rule being tested and not the
      accident of what the shipped table happens to contain.
   ===================================================================== */
{
  const f = W.hgGoldEdgeLiveIsHeadline;
  eq(typeof f, 'function', 'hgGoldEdgeLiveIsHeadline is exported');

  ok(f({ n: 10, gross: 0.2, net: 0.1, live: { n: 10, gross: 0.2, net: 0.1 } }),
    'an exact duplicate reads as the headline');
  ok(!f({ n: 20, gross: 0.2, net: 0.1, live: { n: 10, gross: 0.2, net: 0.1 } }),
    'a different n is an independent population');
  ok(!f({ n: 10, gross: 0.2, net: 0.9, live: { n: 10, gross: 0.2, net: 0.1 } }),
    'a different net is an independent population');
  ok(!f({ n: 10, gross: 0.9, net: 0.1, live: { n: 10, gross: 0.2, net: 0.1 } }),
    'a different gross is an independent population');

  /* THE ROUNDING BOUNDARY, which the first cut of this predicate got wrong.
     The headline is written at 3dp and the live gross at 4dp (hg-v960), so
     re-rounding the live figure lands 0.2415 on 0.242 and calls a row that is
     the same number independent. It is a tolerance, not a re-rounding. */
  ok(f({ n: 4, gross: 0.241, net: 0.215, live: { n: 4, gross: 0.2415, net: 0.215 } }),
    '0.2415 against a headline 0.241 is the SAME number at the headline precision '
    + '(the boundary the first cut of this predicate failed)');
  ok(f({ n: 2, gross: 3.104, net: 3.087, live: { n: 2, gross: 3.1045, net: 3.087 } }),
    'and so is 3.1045 against 3.104');
  ok(!f({ n: 4, gross: 0.241, net: 0.215, live: { n: 4, gross: 0.2425, net: 0.215 } }),
    'but a full unit of the last place apart is NOT the same number');

  /* THE NET LEG AT THE SAME BOUNDARY. Every case above puts the 4dp figure in
     GROSS, and the shipped table writes net at 3dp on both sides — so the net
     comparison was never exercised at the boundary at all, and a mutation
     re-rounding it survived. Which leg carries the extra digit is a choice a
     future bake can change (hg-v960 chose 4dp gross, 3dp net); the predicate
     must be right either way. */
  /* 0.2155 is the value where the two candidate rules DISAGREE: it is within
     half a unit of 0.215 (tolerance: same number) while Math.round sends it to
     0.216 (re-rounding: different). 0.2154 and 0.2145 both re-round back onto
     0.215, so neither can tell the rules apart — which is why the first pair of
     cases here let a re-rounding mutation survive. */
  ok(f({ n: 4, gross: 0.5, net: 0.215, live: { n: 4, gross: 0.5, net: 0.2155 } }),
    'a net 0.2155 against a headline 0.215 is the SAME number at the headline precision '
    + '(re-rounding sends it to 0.216 and calls it independent)');
  ok(f({ n: 4, gross: 0.5, net: 0.215, live: { n: 4, gross: 0.5, net: 0.2154 } }),
    'and 0.2154 is too');
  ok(!f({ n: 4, gross: 0.5, net: 0.215, live: { n: 4, gross: 0.5, net: 0.2165 } }),
    'but a full unit of the last place apart in NET is not the same number either');

  /* a live block with no gross cannot be SHOWN to duplicate — absence is not
     agreement (the recurring +null===0 shape, one layer out) */
  ok(!f({ n: 10, gross: 0.2, net: 0.1, live: { n: 10, net: 0.1 } }),
    'a live block with no gross is not provably a duplicate');
  ok(!f({ n: 10, gross: 0.2, net: 0.1, live: null }), 'live null is not a duplicate');
  ok(!f({ n: 10, gross: 0.2, net: 0.1 }), 'live absent is not a duplicate');
  ok(!f(null), 'a null row is not a duplicate');
}

/* =====================================================================
   2. THE FINDING, on the shipped table: every swing row duplicates, and the
      scalp desk is mostly independent — so the two are NOT the same thing.
   ===================================================================== */
{
  const sw = W.hgGoldEdgeLiveScope('swing');
  const sc = W.hgGoldEdgeLiveScope('scalp');
  ok(sw && sc, 'hgGoldEdgeLiveScope reports both desks');

  /* the partition really partitions — nothing counted twice, nothing dropped */
  for (const [name, r, tbl] of [['swing', sw, TABLE.swing], ['scalp', sc, TABLE.scalp]]){
    const total = r.independent.length + r.duplicate.length
                + r.suppressedNone.length + r.absent.length;
    eq(total, Object.keys(tbl).length, name + ': the buckets partition the table');
    const seen = new Set([...r.independent, ...r.duplicate, ...r.suppressedNone, ...r.absent]);
    eq(seen.size, total, name + ': no row lands in two buckets');
  }

  eq(sw.independent.length, 0,
    'NOT ONE swing row has a live population independent of its headline — '
    + 'hg-v961 described 14 rows as newly measured and they reproduce the headline');
  eq(sw.duplicate.length, Object.keys(TABLE.swing).length,
    'all ' + Object.keys(TABLE.swing).length + ' swing rows duplicate');
  ok(sc.independent.length >= 20,
    'the SCALP desk really does have independent live populations ('
    + sc.independent.length + ') — or the contrast this pack draws is imaginary');
  ok(sc.duplicate.length > 0 && sc.duplicate.length < sc.independent.length,
    'and a few scalp rows duplicate too, which is reported rather than hidden ('
    + sc.duplicate.join(', ') + ')');

  /* an unreadable table is NOT a clean partition (hg-v954) */
  const bare = boot(GOLDIND.replace(/var HG_GOLD_SETUP_EDGE = \{/,
                                    'var HG_GOLD_SETUP_EDGE = null; var __unused = {'));
  const got = bare.hgGoldEdgeLiveScope('swing');
  eq(got, null, 'an unreadable table reports null, never an empty partition');
}

/* =====================================================================
   3. The note no longer claims a filter that never ran.
   ===================================================================== */
{
  const note = W.hgGoldEdgeLiveNote;

  /* swing: duplicate -> must NOT claim a subset, and must name the stage */
  const swNote = note(TABLE.swing.sweep);
  ok(swNote, 'a swing row still gets a note');
  ok(!/still forms/.test(swNote),
    'it does NOT say "still forms" — nothing was filtered out of this population');
  ok(!/gated out/.test(swNote), 'and does not claim rows were gated out');
  ok(/no separate live population/.test(swNote),
    'it says plainly there is no separate live population');
  ok(/unmeasured/.test(swNote), 'and that what the desk forms is unmeasured');
  ok(/best-levels|entry \/ stop \/ T1/.test(swNote),
    'and NAMES the stage, which is the difference between an honest gap and a shrug');

  /* scalp: a real subset -> the informative sentence is untouched */
  const scNote = note(TABLE.scalp.hvn);
  ok(/still forms/.test(scNote),
    'the SCALP note is unchanged where the live population really is a subset');
  ok(/gated out/.test(scNote), 'including the count of what the gates removed');

  /* the suppressed branch is untouched */
  const supNote = note(TABLE.scalp.vwap);
  ok(/suppress/.test(supNote), 'and the suppressed branch still reads as before');

  /* driven on an injected duplicate, so this is the RULE and not the table */
  const inj = note({ n: 7, gross: 0.5, net: 0.5, live: { n: 7, gross: 0.5, net: 0.5 } });
  ok(/no separate live population/.test(inj), 'the branch is chosen by the rule, on any row');
  const inj2 = note({ n: 70, gross: 0.5, net: 0.5, live: { n: 7, gross: 0.1, net: 0.2 } });
  ok(/still forms/.test(inj2), 'and an injected real subset takes the subset branch');
}

/* =====================================================================
   4. The floor is READ, never retyped — and AGENTS.md is held to it.
      A documented gate value that does not exist is what sent the first cut
      of this pack measuring against 2.0R and reporting 72.8%.
   ===================================================================== */
{
  const floor = swingMinRrFromSource();
  const sc0 = swingScope();
  eq(floor, 1.5, 'HG_GOLD_SWING_MIN_RR is 1.5 in gold-best-levels.js');

  const src = fs.readFileSync(path.join(ROOT, 'scripts/swing-live-scope.mjs'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok(/HG_GOLD_SWING_MIN_RR/.test(code) && /gold-best-levels\.js/.test(code),
    'the generator reads the floor from its source file');

  /* BEHAVIOURAL, because a textual check on this cannot see a retype through a
     different punctuation: the first cut asserted no `= 1.5;` in code and a
     mutation writing `: 1.5;` walked straight past it. Point the generator at a
     tree whose gold-best-levels.js declares a DIFFERENT floor and require the
     scope to use that one. A retyped constant cannot follow. */
  const alt = fs.mkdtempSync(path.join(ROOT, 'scripts/.scope-floor-'));
  try{
    fs.writeFileSync(path.join(alt, 'gold-best-levels.js'), 'var HG_GOLD_SWING_MIN_RR = 2.75;\n');
    eq(swingMinRrFromSource(alt), 2.75, 'the reader really reads the tree it is given');
    const moved = swingScope(undefined, null, alt);
    eq(moved.minRr, 2.75,
      'and the scope follows the source floor, not a copy typed into the generator');
    ok(moved.underFloor > sc0.underFloor,
      'a higher floor really removes more of the walk (' + sc0.underFloor
      + ' -> ' + moved.underFloor + ') — or the floor is inert');
  } finally { fs.rmSync(alt, { recursive: true, force: true }); }

  /* the generator is FATAL when the floor has no source, never silently
     defaulting to a number of its own (hg-v921) */
  const tmp = fs.mkdtempSync(path.join(ROOT, 'scripts/.scope-tmp-'));
  try{
    fs.writeFileSync(path.join(tmp, 'gold-best-levels.js'), 'var SOMETHING_ELSE = 9;\n');
    let threw = false;
    try{ swingMinRrFromSource(tmp); }catch(e){ threw = /no source|not found/.test(String(e.message)); }
    ok(threw, 'a missing floor is FATAL — the generator never invents one');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  /* AGENTS.md must not claim a different number for the same constant */
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  const all = agents.split('\n').filter(l => /HG_GOLD_SWING_MIN_RR/.test(l));
  ok(all.length > 0, 'AGENTS.md documents the swing formation floor');

  /* A line that RECITES the old wrong value while saying it was wrong is not a
     claim about the floor — and the first cut of this check could not tell the
     two apart, so it failed on this pack's own changelog entry (caught by the
     full suite, not by me). A historical recitation always attributes itself to
     a version pack, so those lines are skipped; a NORMATIVE line must carry the
     source value. Non-vacuity is asserted after the loop, because a rule that
     skipped every line would pass while documenting nothing. */
  let checked = 0;
  for (const l of all){
    if (/hg-v\d+/.test(l)) continue;         /* historical, attributed */
    const enforced = /enforces \*\*([0-9.]+)R\*\*/.exec(l);
    if (!enforced) continue;
    eq(+enforced[1], floor,
      'a normative AGENTS.md line states the floor it enforces as the value the source '
      + 'actually holds — this line read 2.0R against a source of 1.5 until hg-v962');
    checked++;
  }
  ok(checked > 0,
    'at least one normative line was actually checked — skipping them all would pass vacuously');
}

/* =====================================================================
   5. The refusal is MEASURED, and the two flips are real.
   ===================================================================== */
{
  const sc = swingScope();
  eq(sc.verdict, 'REFUSED', 'the scoping is refused');
  ok(/pre-snap|REPLACES/.test(sc.why), 'and the reason names why the scope is wrong');
  eq(sc.settled, 244, 'measured on the swing walk book');
  eq(sc.minRr, 1.5, 'against the floor read from source');

  eq(sc.flips, 2, 'exactly two rows would flip net sign under the scope');
  const flipped = Object.keys(sc.rows).filter(k => sc.rows[k].flipped).sort();
  assert.deepEqual(flipped, ['ob', 'p8range'], 'and they are ob and p8range — got ' + flipped);
  n++;

  /* p8range is the one that would matter: neutral (can lead) -> demote */
  const r = sc.rows.p8range;
  ok(r.all.net > 0 && r.scoped.net < 0,
    'p8range reads positive on the walk and negative scoped (' + r.all.net + ' -> ' + r.scoped.net + ')');
  const inForce = TABLE.swing.p8range.actionBaked || TABLE.swing.p8range.action;
  eq(inForce, 'neutral', 'and the verdict in force is neutral — the scope would demote it');

  /* NOTHING MOVES: the shipped verdict is still the unscoped one */
  eq(W.hgGoldEdgeVerdictFromLive(TABLE.swing.p8range, 'swing'), 'neutral',
    'the rule still reads p8range as neutral — no verdict moves on a refused scope');

  /* THE FLIP RULE READS NET, NOT GROSS, and that is asserted on a synthetic
     artifact rather than on this walk — on the committed book gross and net
     happen to flip on the same two rows, so a mutation reading gross was
     EQUIVALENT there and survived. The shared demote bar reads net (hg-v961:
     demoteMinN is 0 on both desks), so the two are different rules and the
     difference has to be shown somewhere. Here a row is built whose gross stays
     positive while net crosses, which only the net rule calls a flip. */
  const synth = fs.mkdtempSync(path.join(ROOT, 'scripts/.scope-synth-'));
  try{
    const mk = (rr, g, net) => ({ stratKey: 'synth', rr, rGross: g, netR: net, entry: 100, stop: 99 });
    const art = { meta: { deviations: ['runScan-only stages are not replayed: best-levels'] },
      trades: [
        /* below the floor: strongly net-positive, mildly gross-positive */
        mk(1.0, 0.05, 0.60), mk(1.0, 0.05, 0.60),
        /* at the floor: gross still positive, net negative */
        mk(2.0, 0.30, -0.20), mk(2.0, 0.30, -0.20)
      ] };
    const f = path.join(synth, 'a.json');
    fs.writeFileSync(f, JSON.stringify(art));
    const sy = swingScope(f, 1.5);
    const row = sy.rows.synth;
    ok(row.all.gross > 0 && row.scoped.gross > 0,
      'on this row GROSS is positive both scoped and unscoped, so a gross rule sees no flip');
    ok(row.all.net > 0 && row.scoped.net < 0,
      'while NET crosses zero (' + row.all.net + ' -> ' + row.scoped.net + ')');
    eq(row.flipped, true, 'and the rule calls it a flip — it reads net, which is the demote bar');
    eq(sy.flips, 1, 'counted once');
  } finally { fs.rmSync(synth, { recursive: true, force: true }); }

  /* and the stages that make the scope wrong are QUOTED from the artifact,
     not asserted by this pack */
  const stages = unreplayedStages();
  ok(stages.length > 0, 'the artifact names its own unreplayed stages');
  const joined = stages.join(' ');
  ok(/best-levels/.test(joined), 'including the best-levels pass');
  ok(/hgFilterGoldPostGate/.test(joined), 'and the post-gate filter');
  ok(/inline engine/.test(joined),
    'and states that candidates carry the inline engine own levels');
}

/* =====================================================================
   6. The literal is GENERATED and round-trips (hg-v921).
   ===================================================================== */
{
  const sc = swingScope();
  const p = path.join(ROOT, 'goldind.js');
  const before = fs.readFileSync(p, 'utf8');
  ok(before.indexOf(literalText(sc)) >= 0,
    'the committed HG_GOLD_SWING_SCOPE is byte-identical to what the generator writes');

  eq(W.HG_GOLD_SWING_SCOPE.settled, sc.settled, 'the runtime literal carries the walk count');
  eq(W.HG_GOLD_SWING_SCOPE.flips, sc.flips, 'and the flip count');
  eq(W.HG_GOLD_SWING_SCOPE.minRr, sc.minRr, 'and the floor');
  eq(W.HG_GOLD_SWING_SCOPE.verdict, 'REFUSED', 'and the verdict');

  /* corrupt it and prove the writer rebuilds it exactly */
  const corrupt = before.replace(/settled: \d+, minRr: [0-9.]+,/,
                                'settled: 999, minRr: 9.9,');
  ok(corrupt !== before, 'the fixture really changed the literal first');
  fs.writeFileSync(p, corrupt);
  try{
    execFileSync('node', ['scripts/swing-live-scope.mjs', '--write'],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
    eq(fs.readFileSync(p, 'utf8'), before, 'the generator rebuilds it byte-identical');
  } finally { fs.writeFileSync(p, before); }

  /* a block the writer cannot locate is FATAL, never skipped */
  const tmp = fs.mkdtempSync(path.join(ROOT, 'scripts/.scope-tmp2-'));
  try{
    fs.writeFileSync(path.join(tmp, 'goldind.js'), '/* no block here */\n');
    const m = await import('../scripts/swing-live-scope.mjs');
    let threw = false;
    try{ m.writeLiteral(sc, tmp); }catch(e){ threw = /FATAL|not found/.test(String(e.message)); }
    ok(threw, 'a missing block stops the writer — it does not silently skip');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/* =====================================================================
   7. The panel renders, branches on the verdict, and is wired on the desk.
   ===================================================================== */
{
  const html = W.hgGoldSwingScopeHtml();
  ok(html && html.length > 200, 'the panel renders');
  ok(/PRE-FORMATION/.test(html), 'and leads with what the evidence actually is');
  ok(/REFUSED/.test(html), 'and says the scoping is refused');
  ok(/p8range/.test(html) && /SIGN FLIPS/.test(html), 'and names the flipping rows');

  /* it BRANCHES on the verdict, so a future bake announces itself rather than
     being hidden behind today's refusal (hg-v935, hg-v944) */
  const other = boot(GOLDIND.replace("verdict: 'REFUSED',\n  why:", "verdict: 'SCOPED',\n  why:"));
  const h2 = other.hgGoldSwingScopeHtml();
  ok(/SCOPED TO THE POPULATION/.test(h2),
    'a different verdict renders a different panel — the branch is real, not decoration');
  ok(!/REFUSED/.test(h2), 'and does not still claim a refusal');

  /* renders NOTHING without the literal, never a zero-filled table */
  const empty = boot(GOLDIND.replace(/settled: \d+, minRr:/, 'settled: 0, minRr:'));
  eq(empty.hgGoldSwingScopeHtml(), '',
    'no literal means no panel — a zero-filled table would read as a measurement');

  /* Wired on GOLD SWING. Bounded to the banner ASSIGNMENT, not grepped over the
     file: the name also appears on the lookup line above, so a whole-file grep
     is satisfied while the call is deleted from the banner — which a mutation
     proved (the recurring grep-satisfiable shape, hg-v957/v958). */
  const gs = fs.readFileSync(path.join(ROOT, 'goldswing.js'), 'utf8');
  ok(/gfn\('hgGoldSwingScopeHtml'\)/.test(gs),
    'GOLD SWING looks the panel up through gfn, so goldind absent fails OPEN');
  const bStart = gs.indexOf('var mixedBanner =');
  ok(bStart >= 0, 'the swing banner assignment is locatable');
  const bEnd = gs.indexOf(';', gs.indexOf('goldMixedFeedBannerHtml(gold)', bStart));
  ok(bEnd > bStart, 'and terminated');
  const stmt = gs.slice(bStart, bEnd);
  ok(/scopeFn\(\)/.test(stmt),
    'and the banner itself CALLS it — the name appearing elsewhere in the file is not wiring');
}

/* =====================================================================
   8. The re-bake chain writes this literal (hg-v959's orphan lesson).
   ===================================================================== */
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const chain = pkg.scripts['gold:rebake'] || '';
  ok(chain.indexOf('swing-live-scope.mjs') >= 0,
    'gold:rebake writes HG_GOLD_SWING_SCOPE — a generated literal the chain does not '
    + 'refresh is the hg-v959 defect');
  ok(chain.indexOf('backtest-goldswing.mjs') < chain.indexOf('swing-live-scope.mjs'),
    'and walks the swing book BEFORE deriving from it');
  ok(typeof pkg.scripts['gold:swing-scope'] === 'string',
    'and a read-only drift check exists');
  ok(pkg.scripts['gold:swing-scope'].indexOf('--write') < 0,
    'which really is read-only');
}

/* =====================================================================
   8b. IMPORTING the generator prints nothing.
       The main-module check was a SUFFIX test, and this file's own name ends
       with 'swing-live-scope.mjs' — so importing the module from its own guard
       ran the whole CLI report into the test output. A suffix is not an
       identity, and without this assertion the regression is invisible.
   ===================================================================== */
{
  /* The probe's NAME is the point: the real failure needed an importer whose
     own filename ends with 'swing-live-scope.mjs', which is what this test file
     is called. A neutrally-named probe cannot reproduce it, and a mutation
     restoring the suffix check survived one that was. */
  const probe = path.join(ROOT, 'scripts', 'probe-swing-live-scope.mjs');
  fs.writeFileSync(probe, "import '../scripts/swing-live-scope.mjs';\n");
  try{
    const out = execFileSync('node', [probe], { cwd: ROOT, encoding: 'utf8' });
    eq(out.trim(), '', 'importing the generator prints nothing — got: ' + JSON.stringify(out.slice(0, 120)));
  } finally { fs.rmSync(probe, { force: true }); }

  const src = fs.readFileSync(path.join(ROOT, 'scripts/swing-live-scope.mjs'), 'utf8');
  ok(/import\.meta\.url/.test(src),
    'and the main-module check compares resolved paths, not a filename suffix');
}

/* =====================================================================
   9. The alias is the one the runtime uses, not a second map.
   ===================================================================== */
{
  eq(SWING_KEY_ALIAS.wkbreak, 'weekly',
    'the walk stratKey wkbreak is the table row weekly');
  ok(/key === 'wkbreak'\) row = table\.weekly/.test(GOLDIND),
    'which is the alias goldind own apply path uses — one mapping, not two');
  ok(Object.prototype.hasOwnProperty.call(swingScope().rows, 'weekly'),
    'so the scope reports it under the table key');
  ok(REPLAY.endsWith('backtest-goldswing-results.json'),
    'and it is all derived from the swing walk the chain runs');
}

console.log('\nOK — ' + n + ' assertions passed (gold swing live scope)');
