/**
 * hg-v925 — the measured-edge gate is relaxed, on instruction, and says so.
 *
 * THIS PACK HAS NO EVIDENCE BEHIND IT AND CLAIMS NONE. The desk owner asked
 * for the gate to be relaxed after several packs of an empty ticket column.
 * Four earlier arguments for loosening this desk were tested and REFUSED on
 * measured grounds (hg-v920 grade-A and the tally/crowned splits, hg-v922 the
 * 0.28% stop bar, hg-v923 promoting sweepob on a record that was not its).
 * This is not a fifth argument; it is an instruction, and the only thing that
 * would make it dishonest is a ticket column that looks like one that was
 * earned.
 *
 * So this guard pins the disclosure at least as hard as the behaviour:
 *   1. UNKNOWN tickets again, and KNOWN-FAILURE still does not;
 *   2. whenever the gate is relaxed the tab says so, first, before any table
 *      the relaxation reframes;
 *   3. the numbers in that disclosure are re-derived from the replay, so a
 *      re-bake moves them instead of leaving a stale boast;
 *   4. it is reversible without editing the file.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' — got ' + a + ', want ~' + b);

const OG_SRC = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
function load(pre){
  const store = {};
  const ctx = {
    Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number,
    setTimeout: () => 0, clearTimeout: () => {},
    console: { log(){}, warn(){}, error(){} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
                addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); } },
    location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  if (pre) pre(ctx, store);
  vm.createContext(ctx);
  try { vm.runInContext(OG_SRC, ctx, { timeout: 30000 }); } catch (e) { /* guards its env */ }
  return { ctx, store };
}

const { ctx } = load();
const INIT = ctx.hgOgEdgeProofInit, SET = ctx.hgOgSetEdgeProof;
const TALLY = ctx.hgOgEdgeRelaxedTally, PANEL = ctx.hgOgEdgeRelaxedPanelHtml;
for (const [f, n] of [[INIT, 'hgOgEdgeProofInit'], [SET, 'hgOgSetEdgeProof'],
                      [TALLY, 'hgOgEdgeRelaxedTally'], [PANEL, 'hgOgEdgeRelaxedPanelHtml']])
  ok(typeof f === 'function', 'omnigold.js exports ' + n);

/* ---- 1. the default is relaxed, and that is the whole change ---- */
console.log('1. the requirement is off by default');
ok(/var OG_EDGE_PROOF_DEFAULT = false;/.test(OG_SRC), 'the default constant is false');
eq(INIT(), false, 'a fresh browser reads relaxed');
/* the gate is still PUSHED, and still hard-or-soft off the same flag */
ok(/gates\.push\(\{ key:'measured-edge', hard: OG_EDGE_PROOF_REQUIRED/.test(OG_SRC),
   'the gate still rides the flag rather than being deleted');
/* and the flag is resolved AT MOUNT, beside the venue control, or a stored
   choice would never be read on a real page load */
ok(/hgOgVenueInit\(\);\s*\n\s*hgOgEdgeProofInit\(\);/.test(OG_SRC),
   'hgOgEdgeProofInit runs at mount, next to hgOgVenueInit');

/* ---- 2. UNKNOWN tickets, KNOWN FAILURE does not ---- */
console.log('2. unknown passes now; a measured failure still does not');
{
  const t = TALLY();
  ok(t, 'the tally comes back');
  eq(t.mechanics, 78, 'over the whole register');
  eq(t.clears, 0, 'nothing clears the family bar — the relaxation is not a promotion');
  ok(t.fails >= 1, 'at least one mechanic fails outright (' + t.fails + ')');
  ok(t.unknown > 40, 'and the unknown cohort is what gets freed (' + t.unknown + ')');
  ok(t.unobserved > 0, 'as do the mechanics with no record at all (' + t.unobserved + ')');
}
/* the veto branch is untouched — this is the half that IS evidence-backed */
ok(/if \(fz <= EDGE_VETO_Z\)\{\s*\n\s*ed = false;/.test(OG_SRC),
   'the out-of-sample known-failure veto still sets pass=false');
ok(/else if \(z <= EDGE_VETO_Z\)\{/.test(OG_SRC), 'and the in-sample one');
ok(/var EDGE_VETO_Z = -2;/.test(OG_SRC), 'at the same -2 sigma it always used');

/* ---- 3. the disclosure is not optional ---- */
console.log('3. there is no state where it tickets on unknowns and says nothing');
{
  const h = PANEL();
  ok(h && h.length > 400, 'the panel renders while relaxed');
  ok(/BY INSTRUCTION, NOT BY EVIDENCE/.test(h), 'and says which of the two it is');
  ok(/No evidence was found for this and none is claimed/.test(h),
     'in words, not just a header');
  ok(/known-failure veto is untouched/.test(h), 'it says what was NOT relaxed');
  ok(h.indexOf(String(ctx.EDGE_VETO_Z !== undefined ? ctx.EDGE_VETO_Z : -2) + '&sigma;') >= 0
     || /-2&sigma;/.test(h),
     'naming the sigma a mechanic must stay above, not just the fact of a veto');
  ok(/hgOgSetEdgeProof\(true\)/.test(h), 'and how to put the requirement back');
  SET(true);
  eq(PANEL(), '', 'and it goes quiet once the requirement is back — nothing to disclose');
  SET(false);
  ok(PANEL().length > 400, 'and returns when it is off again');
}
/* it must sit ABOVE the tables it reframes */
ok(/\+ hgOgEdgeRelaxedPanelHtml\(\)[\s\S]*?\+ hgOgEvidenceStaleHtml\(\)/.test(OG_SRC),
   'the panel chain renders it before the evidence tables');
{
  const chain = OG_SRC.slice(OG_SRC.indexOf('+ hgOgEdgeRelaxedPanelHtml()'));
  ok(chain.indexOf('+ hgOgFactorSepPanelHtml();') > 0, 'and before the factor-separation panel');
  ok(chain.indexOf('+ hgOgBlockerFunnelHtml()') > 0, 'and before the blocker funnel');
}

/* ---- 4. the numbers are re-derived, never written in ---- */
console.log('4. the disclosure numbers come from the replay at render time');
{
  const E = ctx.HG_OG_REPLAY_EVIDENCE, Z = ctx.hgOgReplayZ, FZ = ctx.hgOgFamilyZ;
  const famZ = FZ(78), be = 1 / 3, rtP = E.rtCostPct, rtX = 0.020;
  let n = 0, w = 0, g = 0, xm = 0, unk = 0, cl = 0, fl = 0;
  for (const k of Object.keys(E.kinds)){
    const r = E.kinds[k], z = Z(r, be);
    if (!isFinite(z)) continue;
    if (z >= famZ){ cl++; continue; }
    if (z <= -2){ fl++; continue; }
    unk++;
    n += r[0]; w += r[1] * r[0]; g += r[3] * r[0];
    xm += (r[3] - r[4] * (rtX / rtP)) * r[0];
  }
  const t = TALLY();
  eq(t.clears, cl, 'clears matches an independent count');
  eq(t.fails, fl, 'fails matches');
  eq(t.unknown, unk, 'unknown matches');
  eq(t.n, n, 'the cohort n matches');
  near(t.win, w / n, 1e-9, 'the win rate matches');
  near(t.gross, g / n, 1e-9, 'the gross matches');
  near(t.netXm, xm / n, 1e-9, 'and the XM net, re-priced on the fee leg only');
  /* and it is BELOW breakeven, which is the number the reader most needs */
  ok(t.win < t.breakeven, 'the freed cohort wins less often than breakeven');
  ok(t.gross < 0, 'and is negative before costs');
  const h = PANEL();
  ok(h.indexOf((t.win * 100).toFixed(1) + '%') >= 0, 'the panel prints that win rate');
  ok(h.indexOf((t.breakeven * 100).toFixed(1) + '%') >= 0, 'beside the breakeven it fails');
  ok(/Below breakeven before costs/.test(h), 'and says so in words');
  ok(/not an edge, and a ticket here does not say it is/.test(h),
     'refusing to let a ticket read as a measured edge');
  /* no figure is hard-coded into the string */
  for (const lit of ['30.5%', '7,595', '53 are unknown', '-0.0726'])
    ok(OG_SRC.indexOf("'" + lit) < 0, 'the literal ' + lit + ' is not written into the panel string');
}

/* ---- 5. reversible without editing the file ---- */
console.log('5. the instruction can be taken back from the console or a flag');
{
  eq(SET(true), true, 'the setter turns it back on');
  eq(SET(false), false, 'and off');
  const { ctx: c2 } = load((c, store) => { store.hg_og_edge_proof = '1'; });
  eq(c2.hgOgEdgeProofInit(), true, 'a stored choice survives a reload');
  const { ctx: c3 } = load((c) => { c.HG_OG_EDGE_PROOF = true; });
  eq(c3.hgOgEdgeProofInit(), true, 'and a window override wins over the default');
  const { ctx: c4 } = load((c, store) => { store.hg_og_edge_proof = '1'; c.HG_OG_EDGE_PROOF = false; });
  eq(c4.hgOgEdgeProofInit(), false, 'the override also wins over the stored choice');
  const { ctx: c5 } = load((c, store) => { store.hg_og_edge_proof = 'nonsense'; });
  eq(c5.hgOgEdgeProofInit(), false, 'and a corrupt stored value falls back to the default');
}

/* ---- 6. nothing else was relaxed on the way past ---- */
console.log('6. only this gate moved');
ok(/var COST_VETO_R = 0\.30;/.test(OG_SRC), 'the swing cost ceiling is unchanged');
ok(/var COST_VETO_R_SCALP = 0\.15;/.test(OG_SRC), 'and the scalp ceiling');
ok(/var MIN_SAMPLES = 20;/.test(OG_SRC), 'the sample floor is unchanged');
ok(/var FWD_MIN_JUDGE = 20;/.test(OG_SRC), 'and the forward-judgement floor');
ok(/var OG_EFF_N_RATIO = 0\.406;/.test(OG_SRC), 'the overlap deflation is unchanged');
ok(/function hgOgFamilyZ/.test(OG_SRC), 'the family-wise correction still exists');
{
  const t = TALLY();
  near(t.famZ, 3.2128, 0.001, 'and still computes the same bar — it is applied, not lowered');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
