/**
 * hg-v926 — one position at a time.
 *
 * Every pack before this looked for BETTER SETUPS. hg-v922 measured that
 * nothing either gold desk ranks by separates outcomes across four disjoint
 * windows, and that the one factor which does — stop width — holds in
 * direction but names no value. This is not about which setup; it is about
 * HOW MANY AT ONCE, and it is the only result in the evidence base that is
 * positive at BOTH fill bounds (the hg-v918 bar):
 *
 *     SCALP tickets, sequential   +0.1484R (n=73, lower)  +0.4155R (n=54)
 *     SWING tickets, sequential   -0.2399R (n=32, lower)  +0.3166R (n=35)
 *     everything at once          -0.1160R (n=8132, XM)
 *
 * The guard's job is to stop that being oversold. It pins the numbers against
 * the committed bake, pins the LIMIT (n=73 at +1.16σ is not significant), and
 * pins that SWING — which disagrees between bounds — is not claimed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, t, m) => ok(Math.abs(a - b) <= t, m + ' — got ' + a + ', want ~' + b);

const OG_SRC = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
function load(seed){
  const store = Object.assign({}, seed || {});
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
  vm.createContext(ctx);
  try { vm.runInContext(OG_SRC, ctx, { timeout: 30000 }); } catch (e) { /* guards its env */ }
  ctx.hgOgOneAtATimeInit();
  return { ctx, store };
}
const live = (n) => {
  const m = {};
  for (let i = 0; i < n; i++) m['XAUUSD|long|k' + i] = { at: 1 };
  return JSON.stringify({ v: 1, live: m, history: [] });
};

const { ctx } = load();
for (const n of ['hgOgSetOneAtATime', 'hgOgOneAtATimeInit', 'hgOgOpenGoldConvictions', 'hgOgOneAtATimeHtml'])
  ok(typeof ctx[n] === 'function', 'omnigold.js exports ' + n);

/* ---- 1. the numbers are the committed bake's, not new ones ---- */
console.log('1. the claim is the hg-v918 sequential ticket book, unchanged');
{
  const T = ctx.HG_OG_REPLAY_EVIDENCE.sequentialTicketHorizon;
  ok(T && T.SCALP && T.SWING, 'the bake carries the sequential ticket book');
  near(T.SCALP.lo[2], 0.1484, 1e-9, 'SCALP lower bound is +0.1484R');
  near(T.SCALP.hi[2], 0.4155, 1e-9, 'SCALP upper bound is +0.4155R');
  ok(T.SCALP.lo[2] > 0 && T.SCALP.hi[2] > 0, 'SCALP is positive at BOTH bounds — the whole basis');
  ok(T.SWING.lo[2] < 0 && T.SWING.hi[2] > 0, 'SWING disagrees between bounds');
  /* and the panel quotes those, not numbers of its own */
  const h = load({ hgGoldscalpConviction: live(1) }).ctx.hgOgOneAtATimeHtml();
  ok(h.indexOf('+0.148R') >= 0, 'the panel prints the SCALP lower bound');
  ok(h.indexOf('+0.416R') >= 0, 'and the upper');
  ok(/positive at <b>both<\/b> bounds/.test(h),
     'and states the both-bounds property that is the whole reason this ships');
  ok(/0\.116R/.test(h), 'beside the all-at-once book it is being compared to');
}

/* ---- 2. THE LIMIT IS PINNED AS HARD AS THE CLAIM ---- */
console.log('2. it is positive, not significant, and says so');
{
  const T = ctx.HG_OG_REPLAY_EVIDENCE.sequentialTicketHorizon;
  const be = 1 / 3, n = T.SCALP.lo[0], hit = T.SCALP.lo[1];
  const z = (hit - be) / Math.sqrt(be * (1 - be) / n);
  near(z, 1.16, 0.02, 'the conservative-end z is +1.16');
  ok(z < 1.96, 'which does not clear even an uncorrected single test');
  ok(z < ctx.hgOgFamilyZ(78), 'let alone this desk family bar');
  const h = load({ hgGoldscalpConviction: live(1) }).ctx.hgOgOneAtATimeHtml();
  ok(/not significant/.test(h), 'the panel says not significant');
  ok(/n=73/.test(h) && /1\.16/.test(h), 'with the n and the sigma it failed at');
  ok(/clears no bar this desk applies/.test(h), 'and that it clears no bar');
  /* SWING must not be claimed */
  ok(/SWING disagrees between the two bounds/.test(h), 'SWING is named as disagreeing');
  ok(/carries no verdict/.test(h), 'and explicitly carries no verdict');
  ok(!/SWING[^.]{0,40}\+0\.317R? (is|at) (the )?(measured|evidence)/.test(h),
     'the SWING upper bound is never quoted as a result on its own');
}

/* ---- 3. the concentration argument stands without the statistics ---- */
console.log('3. 57 at once is one bet at 57x, which needs no p-value');
{
  const h = load({ hgGoldscalpConviction: live(1) }).ctx.hgOgOneAtATimeHtml();
  ok(/59\.4 plans a day/.test(h), 'it states the publication rate');
  ok(/57 at once/.test(h), 'and the concurrency');
  ok(/not 57 bets, it is one bet/.test(h), 'and names it as one bet, not a portfolio');
  ok(/stands without either/.test(h), 'and says that argument does not lean on the numbers above');
}

/* ---- 4. the gate: held while something is live, open when flat ---- */
console.log('4. it is an ordinary hard gate, and it fails OPEN');
ok(/var g = hgOgOneAtATimeGate\(\);\s*\n\s*if \(g\) gates\.push\(g\);/.test(OG_SRC),
   'pushed as a normal hard gate, so it flows through grading and the funnel');
/* EXERCISED, not just grepped: a source check alone survives `if (false)`
   in front of the push and survives the pass flag being inverted. */
{
  const g = load({ hgGoldscalpConviction: live(1) }).ctx.hgOgOneAtATimeGate();
  ok(g && g.key === 'one-at-a-time', 'the gate row exists while something is held');
  eq(g.hard, true, 'and it is hard');
  eq(g.pass, false, 'and it does NOT pass — that is what holds the ticket');
  ok(/already live/.test(g.why) && /HELD/.test(g.why), 'with a why that names the reason');
  const f = load().ctx.hgOgOneAtATimeGate();
  ok(f && f.key === 'one-at-a-time', 'the row still exists on a flat book');
  eq(f.pass, true, 'and it passes, so nothing is held');
  ok(/one position at a time/.test(f.why), 'saying what the rule is');
  /* off: no row at all, rather than a row that always passes */
  const c = load({ hgGoldscalpConviction: live(1) }).ctx;
  c.hgOgSetOneAtATime(false);
  eq(c.hgOgOneAtATimeGate(), null, 'with the guard off there is no gate row at all');
}
{
  const a = load().ctx;
  eq(a.hgOgOpenGoldConvictions().n, 0, 'a flat book has nothing open');
  eq(a.hgOgOneAtATimeHtml(), '', 'and the panel is silent — no standing lecture');
  const b = load({ hgGoldscalpConviction: live(2) }).ctx;
  eq(b.hgOgOpenGoldConvictions().n, 2, 'two live convictions are counted');
  ok(b.hgOgOneAtATimeHtml().indexOf('2 gold conviction') >= 0, 'and the panel says two');
  /* BOTH booking desks count — a position is a position whichever tab opened it */
  const c = load({ hgGoldscalpConviction: live(1), hgGoldswingConviction: live(1) }).ctx;
  eq(c.hgOgOpenGoldConvictions().n, 2, 'scalp and swing convictions are both counted');
  ok(/OG_CONVICTION_KEYS = \['hgGoldscalpConviction', 'hgGoldswingConviction'\]/.test(OG_SRC),
     'from the two real store keys');
}
{
  /* FAILS OPEN — an unreadable store must not become a gate nobody chose */
  const d = load({ hgGoldscalpConviction: 'not json at all' }).ctx;
  eq(d.hgOgOpenGoldConvictions().n, 0, 'corrupt JSON reads as nothing open');
  eq(d.hgOgOneAtATimeHtml(), '', 'so nothing is held');
  const e = load({ hgGoldscalpConviction: JSON.stringify({ v: 1 }) }).ctx;
  eq(e.hgOgOpenGoldConvictions().n, 0, 'a store with no live map reads as nothing open');
  ok(/FAILS OPEN/.test(OG_SRC), 'and the source says that is deliberate');
}

/* ---- 5. on by default, and reversible without an edit ---- */
console.log('5. on by default, off in one call');
{
  ok(/var OG_ONE_AT_A_TIME_DEFAULT = true;/.test(OG_SRC), 'the default is on');
  const { ctx: a } = load({ hgGoldscalpConviction: live(1) });
  ok(a.hgOgOneAtATimeHtml().length > 200, 'it holds by default');
  eq(a.hgOgSetOneAtATime(false), false, 'the setter turns it off');
  eq(a.hgOgOneAtATimeHtml(), '', 'and then it holds nothing');
  const { ctx: b, store: bs } = load({ hgGoldscalpConviction: live(1), hg_og_one_at_a_time: '0' });
  eq(b.hgOgOneAtATimeHtml(), '', 'a stored off survives a reload');
  /* and the setter actually WRITES, or "survives a reload" is untested */
  const { ctx: p2, store: ps } = load({ hgGoldscalpConviction: live(1) });
  p2.hgOgSetOneAtATime(false);
  eq(ps.hg_og_one_at_a_time, '0', 'turning it off persists to localStorage');
  p2.hgOgSetOneAtATime(true);
  eq(ps.hg_og_one_at_a_time, '1', 'and turning it back on persists too');
  const { ctx: c } = load({ hgGoldscalpConviction: live(1), hg_og_one_at_a_time: 'rubbish' });
  ok(c.hgOgOneAtATimeHtml().length > 200, 'and a corrupt stored value falls back to the default');
  ok(/hgOgSetOneAtATime\(false\)/.test(a.hgOgOneAtATimeHtml.toString())
     || /hgOgSetOneAtATime\(false\)/.test(OG_SRC), 'the panel tells the reader how to turn it off');
  ok(/hgOgEdgeProofInit\(\);\s*\n\s*hgOgOneAtATimeInit\(\);/.test(OG_SRC), 'and it initialises at mount');
  ok(/\+ hgOgOneAtATimeHtml\(\)/.test(OG_SRC), 'and the panel is wired into the chain');
  ok(/\+ hgOgEdgeRelaxedPanelHtml\(\)[\s\S]{0,200}\+ hgOgOneAtATimeHtml\(\)/.test(OG_SRC),
     'right after the relaxation notice, which it partly answers');
}

/* ---- 6. nothing else moved ---- */
console.log('6. no threshold, no venue, no ceiling');
ok(/var COST_VETO_R = 0\.30;/.test(OG_SRC), 'the swing cost ceiling is unchanged');
ok(/var COST_VETO_R_SCALP = 0\.15;/.test(OG_SRC), 'and the scalp ceiling');
ok(/var EDGE_VETO_Z = -2;/.test(OG_SRC), 'the known-failure veto is unchanged');
ok(/var OG_EDGE_PROOF_DEFAULT = false;/.test(OG_SRC), 'and hg-v925 relaxation stands as instructed');
{
  const body = OG_SRC.slice(OG_SRC.indexOf('function hgOgOpenGoldConvictions'),
                            OG_SRC.indexOf('function hgOgOneAtATimeHtml'));
  ok(!/setItem|\.dropped|hgOgSetVenue/.test(body),
     'reading the conviction store writes nothing and drops nothing');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
