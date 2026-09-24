/* HARDGATE — the measured-positive gold mechanic GOLD SWING could not form.

   MILLI GOLD's roster is DERIVED (scripts/milli-gold-roster.mjs): the OMNIGOLD
   mechanics whose GATE-CLEAR record is net-positive at XM on at least
   MIN_SAMPLES firings. Nine qualify. hg-v942 ported six of them to both gold
   tabs and called the coverage exhaustive because every remaining kind "is
   ported or has a named home".

   The home check never asked WHICH TAB the home was on. EQH-SWEEP's home is
   `smcliq`; GOLD SCALP has minted it since hg-v564; GOLD SWING read the SAME
   detector and only STAMPED candidates that already existed, inside a block
   guarded on got.length — so on a quiet tape it produced nothing at all.

   What this file pins:
     - coverage is per TAB now, and the reporter is not vacuous;
     - the three HOMED kinds are twins too, DERIVED from HG_GOLD_ROSTER_HOME
       so one list decides both, and the record generator reads that same list
       (it silently wrote a literal the runtime looked past);
     - GOLD SWING MINTS smcliq — behaviourally, through its own gates;
     - it fails CLOSED: no detector, no stop rule, no hit -> no candidate, and
       never a local re-implementation (hg-v938);
     - the ported mechanics are gated on the plan they SHIP, not on the mark;
     - the demote separation reports a verdict and a lean as different things.

   Run: node tests/test-gold-swing-smcliq.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };
const src = (f) => fs.readFileSync(root + f, 'utf8');

/* ---------- an isolated desk, loaded the way index.html loads it ---------- */
const DESK = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
  'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'structure-levels.js',
  'best-levels.js', 'gold-best-levels.js', 'regime.js', 'milligold.js',
  'gold-extra-strategies.js', 'omnigold.js', 'goldind.js'];

function deskContext(withSwing){
  const ctx = vm.createContext({ Math, Date, JSON, isFinite, isNaN, parseFloat, parseInt,
    Array, Object, String, Number, RegExp, Float64Array, Infinity, NaN,
    console: { log(){}, warn(){}, error(){} },
    setTimeout: () => 0, clearTimeout(){},
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null,
      createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                              querySelector: () => null, querySelectorAll: () => [] }),
      querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
      documentElement: { appendChild(){} }, addEventListener(){} } });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  for (const f of DESK){ try { vm.runInContext(src(f), ctx, { filename: f }); } catch (e) {} }
  if (withSwing) vm.runInContext(src('goldswing.js'), ctx, { filename: 'goldswing.js' });
  return ctx;
}

/* a deterministic 4h series — one tape, not an unrelated draw per case */
function bars(n, seed){
  const out = []; let px = 4400, sd = seed;
  const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
  for (let i = 0; i < n; i++){
    const o = px, c = 4400 + Math.sin(i / 9) * 26 + (i / n) * 70 + (rnd() - 0.5) * 9;
    out.push({ t: 1.7e12 + i * 14400000, o: +o.toFixed(2),
               h: +(Math.max(o, c) + 9).toFixed(2), l: +(Math.min(o, c) - 9).toFixed(2),
               c: +c.toFixed(2), v: 900 });
    px = c;
  }
  return out;
}

console.log('\n1. coverage is per TAB, and the reporter is not vacuous');
{
  const ctx = deskContext(false);
  ok(typeof ctx.hgGoldRosterTabGaps === 'function', 'hgGoldRosterTabGaps is exported');
  ok(Array.isArray(ctx.HG_GOLD_TABS) && ctx.HG_GOLD_TABS.length === 2,
     '  and the tabs it reports over are named, not implied');
  const gaps = ctx.hgGoldRosterTabGaps();
  ok(gaps.length === 0,
     'every kind on the derived roster can be formed on BOTH tabs — 0 gaps');

  /* NOT VACUOUS: take the tab back off and the gap must be reported. hg-v942's
     claim passed while a real hole existed, so an empty list has to be the
     result of a check that can come back non-empty. */
  const tabs = ctx.HG_GOLD_ROSTER_TABS['EQH-SWEEP'];
  ctx.HG_GOLD_ROSTER_TABS['EQH-SWEEP'] = ['goldscalp'];
  const g2 = ctx.hgGoldRosterTabGaps();
  ok(g2.length === 1 && g2[0][0] === 'EQH-SWEEP' && g2[0][1] === 'goldswing',
     '  removing the swing home reports exactly [EQH-SWEEP, goldswing]');
  /* a kind with NO entry at all is EVERY tab's gap, never silently skipped */
  delete ctx.HG_GOLD_ROSTER_TABS['EQH-SWEEP'];
  const g3 = ctx.hgGoldRosterTabGaps();
  ok(g3.length === 2 && g3.every((p) => p[0] === 'EQH-SWEEP'),
     '  and a kind named on NO tab is reported against every tab, not dropped');
  ctx.HG_GOLD_ROSTER_TABS['EQH-SWEEP'] = tabs;
  ok(ctx.hgGoldRosterTabGaps().length === 0, '  restored');
}

console.log('\n2. a homed kind is a twin, derived from ONE list');
{
  const ctx = deskContext(false);
  const HOME = ctx.HG_GOLD_ROSTER_HOME, TWIN = ctx.HG_GOLD_SIBLING_TWIN;
  for (const kind of Object.keys(HOME)){
    ok(TWIN[HOME[kind]] === kind,
       HOME[kind] + ' -> ' + kind + ' in the twin map, from the home map');
    const rec = ctx.hgGoldSiblingRecord(HOME[kind]);
    ok(rec && rec.twin === kind && rec.settled > 0 && isFinite(rec.netXm),
       '  and carries its gate-clear record (n=' + (rec && rec.settled) + ')');
  }
  /* the DERIVATION, not the result: a new home must become a twin with no
     second edit. The first cut of this pack ran the loop where the home map
     was still hoisted-undefined and folded in ZERO entries, silently. */
  ok(ctx.HG_GOLD_SIBLING_TWIN.p5drive === 'P5-DRIVE'
     && ctx.HG_GOLD_SIBLING_TWIN.p6comp === 'P6-COMP'
     && ctx.HG_GOLD_SIBLING_TWIN.smcliq === 'EQH-SWEEP',
     'all three homes are folded in — a loop over an undefined map adds none');
  /* an explicit twin is never overwritten by a home of the same key */
  ok(ctx.HG_GOLD_SIBLING_TWIN.goldround === 'ROUND-MAGNET',
     '  and an explicitly declared twin is left alone');
}

console.log('\n3. the card attributes the record instead of denying it exists');
{
  const ctx = deskContext(false);
  const note = String(ctx.hgGoldExtraUncheckedNote('smcliq'));
  ok(/EQH-SWEEP/.test(note), 'the note names the twin EQH-SWEEP');
  ok(/OMNIGOLD/.test(note), '  and attributes the record to OMNIGOLD');
  ok(!/no OMNIGOLD mechanic reads the same thing/.test(note),
     '  and no longer claims nothing is known — v942\'s own table named one');
  ok(/cannot lead/i.test(note), '  and says the setup cannot lead');
}

console.log('\n4. the record generator reads the SAME list as the runtime');
{
  /* it did not, and so it wrote a literal the runtime looked past:
     hgGoldSiblingRecord('smcliq') came back null with the twin mapped right. */
  let out = '';
  try { out = String(execFileSync(process.execPath,
    [root + 'scripts/gold-sibling-records.mjs'], { cwd: root, stdio: 'pipe' })); }
  catch (e){ out = 'THREW ' + e.message; }
  ok(/no drift/.test(out), 'the committed literal round-trips to zero drift');
  ok(/EQH-SWEEP/.test(out) && /P5-DRIVE/.test(out) && /P6-COMP/.test(out),
     '  and the generator enumerates the homed twins too');
}

console.log('\n5. GOLD SWING MINTS smcliq — behaviourally, through its own gates');
{
  const h4 = bars(260, 11);
  const lastC = h4[h4.length - 1].c, now = 1.7e12 + 260 * 14400000;
  /* DROP is its own signal. Passing `undefined` to mean "take the stop rule
     away" reads identically to "do not touch it", so the absent-rule case
     silently ran against the real one and passed for the wrong reason. */
  const DROP = Symbol('drop');
  const drive = (stub, stopFn) => {
    const ctx = deskContext(true);
    ctx.hgGoldSmcLiquidityHit = stub;
    if (stopFn === DROP) ctx.hgGoldRosterStop = undefined;
    else if (stopFn !== undefined) ctx.hgGoldRosterStop = stopFn;
    let res = null;
    try { res = ctx.goldSwingSetups({ rows4h: h4, rows1d: h4, now: now }); } catch (e){}
    const R = ((res && res.ranked) || []).filter((r) => r.stratKey === 'smcliq');
    const J = ((res && res.rejected) || []).filter((r) => r.stratKey === 'smcliq');
    return { ran: !!res, ranked: R, rejected: J };
  };
  const LVL = +(lastC - 3).toFixed(2);
  const hit = () => ({ ok: true, dir: 'long', level: LVL, sweptAge: 3,
                       why: 'equal lows swept and reclaimed', pool: { count: 4 } });

  const a = drive(undefined);
  ok(a.ran && !a.ranked.length && !a.rejected.length,
     'with the SMC detector ABSENT the tab mints nothing under this key');
  const b = drive(() => null);
  ok(b.ran && !b.ranked.length && !b.rejected.length, 'no hit -> no candidate');
  const c = drive(hit);
  ok(c.ranked.length === 1, 'a real hit mints exactly one smcliq candidate');
  const cand = c.ranked[0];
  ok(Math.abs(cand.entry - LVL) < 1e-6,
     '  ENTRY is the swept level, not the last close (hg-v423)');
  /* ATTRIBUTED, not just present: the desk demotes this row on most tapes
     anyway (ASIA SESSION, CONF NO TRADE), so asserting `demoted` alone passes
     whether or not the mint's own line ran — it survived mutation saying so. */
  ok(cand.demoted === true && /EQH-SWEEP/.test(String(cand.demotedWhy || '')),
     '  and THIS line demotes it, naming the record it lacks');
  const smcStamps = (cand.stamps || []).filter((s) => /^SMC LIQ/.test(s));
  ok(smcStamps.length === 1 && smcStamps[0] === 'SMC LIQ',
     '  stamped EXACTLY \'SMC LIQ\' — the live scan\'s SMC pass dedupes on that '
     + 'string, so a richer label here would sit beside a bare duplicate');
  ok(cand.smcSweptAge === 3 && cand.smcPoolCount === 4,
     '  with the swept age and pool size as FIELDS, not parsed out of a label');
  ok(/EQH-SWEEP/.test(String(cand.extraWhy || '')),
     '  and carries the attributed record, not a bare NO RECORD');

  /* and lifting the lever removes THIS demote (other gates may still hold it) */
  const ctxP = deskContext(true);
  ctxP.hgGoldSmcLiquidityHit = hit;
  ctxP.hgGoldExtraPromotable = () => true;
  let resP = null;
  try { resP = ctxP.goldSwingSetups({ rows4h: h4, rows1d: h4, now: now }); } catch (e){}
  const pr = [...((resP && resP.ranked) || []), ...((resP && resP.rejected) || [])]
    .filter((r) => r.stratKey === 'smcliq');
  ok(pr.length === 1 && !pr[0].demotedWhy,
     '  hgGoldExtraPromotable() lifts the mint\'s own demote — one deliberate call');

  /* the gates RAN. A stop three ATR out cannot pay 1.2R whatever structure
     the desk snaps to, and only push() runs that floor — a grep for push()
     would also match a bypass that skipped every gate (hg-v942). */
  const d = drive(hit, (rows, dir, level) => level - 120);
  ok(!d.ranked.length && d.rejected.length === 1,
     'a stop the desk\'s R:R floor cannot pay is REJECTED, not waved through');
  ok(d.rejected[0].rr < 1.2 && d.rejected[0].rrFloor === 1.2,
     '  carrying the numeric rr and floor the hg-v929 readout needs');

  /* fails CLOSED rather than inventing a stop here (hg-v938) */
  const e = drive(hit, DROP);
  ok(e.ran && !e.ranked.length && !e.rejected.length,
     'with the SHARED stop rule absent it mints nothing — no local fallback');

  ok(/smcliq/.test(src('goldswing.js').slice(src('goldswing.js').indexOf('var SW_NAME'),
     src('goldswing.js').indexOf('var SW_NAME') + 3000)),
     'SW_NAME names smcliq, so the card has a strategy to print');
}

console.log('\n6. a ported mechanic is gated on the plan it SHIPS');
{
  /* hg-v942 called mkCand with no zone, and __swEntryFromZone IGNORES the
     anchor without one and returns the MARK — so the 1.2R build gate judged
     the mark while the ticket shipped the mechanic's level. The five v933/v934
     extras set entry to the last close, so for THEM mark and entry coincide
     and nothing was wrong; the roster ports set entry to the level, and there
     it was. */
  const h4 = bars(260, 11);
  const lastC = h4[h4.length - 1].c, now = 1.7e12 + 260 * 14400000;
  const LEVEL = +(lastC - 55).toFixed(2), STOP = +(LEVEL - 8).toFixed(2);
  const ctx = deskContext(true);
  ctx.hgGoldExtraDetect = () => ([{ ok: true, dir: 'long', kind: 'ogmmove',
    level: LEVEL, entry: LEVEL, stop: STOP, why: 'port-shaped probe',
    invalidates: 'probe' }]);
  let res = null;
  try { res = ctx.goldSwingSetups({ rows4h: h4, rows1d: h4, now: now }); } catch (e){}
  const R = ((res && res.ranked) || []).filter((r) => r.stratKey === 'ogmmove');
  ok(R.length === 1, 'a port whose LEVEL plan pays 1.2R reaches the board');
  ok(R.length === 1 && Math.abs(R[0].entry - LEVEL) < 1e-6,
     '  at the level it named, which is the plan the gate judged');
  ok(R.length === 1 && R[0].rr >= 1.2,
     '  and its recorded R:R clears the floor it was measured against');
}

console.log('\n7. the demote separation says verdict and lean are different things');
{
  const M = await import(root + 'scripts/demote-separation.mjs');
  const out = M.run();
  ok(out.bookN > 0 && out.family > 0,
     'it measures a non-empty book over a stated family (' + out.bookN
       + ' trades, ' + out.family + ' stamps)');
  /* hg-v944's DEMOTE_STAMPS is every demote EXCEPT the one that pack was
     measuring, so the union has to put OFF-SESSION back. Forget it and the
     desk's THIRD-largest demote silently goes unmeasured, with the table
     still looking complete. */
  ok(M.DEMOTES.has(M.SUBJECT_OF_V944) && M.SUBJECT_OF_V944 === 'OFF-SESSION',
     'the demote set unions hg-v944\'s subject back in');
  ok(out.testable.some((c) => c.stamp === 'OFF-SESSION'),
     '  and OFF-SESSION really is measured, not just listed');
  ok(out.supported.length === 1 && out.supported[0] === 'EDGE DEMOTE',
     'exactly ONE demote is supported at both bounds on four disjoint windows');
  ok(out.noVerdict.indexOf('CONF NO TRADE') >= 0,
     '  and the desk\'s LARGEST demote is not one of them');
  ok(out.leansBetterNoVerdict.length > 0
     && out.leansBetterNoVerdict.every((s) => out.wrongWay.indexOf(s) < 0),
     'a stamp that LEANS the wrong way is never reported as a verdict');

  /* the bar, exercised on input that DISAGREES — hg-v937 shipped a verdict
     inline and every->some survived because every trial happened to agree. */
  const A = { thin: false, unanimous: true, sign: 'worse', dNet: -0.2 };
  const B = { thin: false, unanimous: true, sign: 'worse', dNet: -0.3 };
  ok(M.verdict(A, B) === 'worse', 'both bounds unanimous and agreeing -> verdict');
  ok(M.verdict(A, { ...B, sign: 'better' }) === null,
     '  bounds unanimous but DISAGREEING -> no verdict');
  ok(M.verdict(A, { ...B, unanimous: false }) === null,
     '  one bound not unanimous -> no verdict');
  ok(M.verdict(A, { ...B, thin: true }) === null, '  a thin side -> no verdict');
  ok(M.lean(A, B) === 'worse' && M.lean({ ...A, dNet: 0.2 }, { ...B, dNet: 0.3 }) === 'better',
     'lean reads the sign of the net gap');
  ok(M.lean(A, { ...B, dNet: 0.3 }) === null,
     '  and reports nothing when the two bounds point opposite ways');

  /* thin stamps are REPORTED, not dropped in silence */
  ok(Array.isArray(out.thin), 'stamps too thin to judge are listed, not hidden');
  ok(out.testable.length + out.thin.length > out.testable.length,
     '  and at least one really is too thin here');
}

console.log('\n' + passed + ' assertions passed');
