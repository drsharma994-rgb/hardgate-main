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

/* ---- 1. hg-v1402: the gated ticket book is EMPTY — the panel must say so ----
   The hg-v918 claim (SCALP tickets +0.1484R/+0.4155R at the two bounds) was
   pinned here as "unchanged"; the hg-v1402 re-walk retired it — the walk's
   own ticket flag is empty offline (the hg-v1003 macro lock fails closed
   without live DXY/US10Y feeds) and the gate proxy agrees. A claim whose
   population is gone must not keep rendering. The pins now freeze the
   honest empty state AND prove the live claim branch still renders
   dynamically when a populated map is present (fixture-injected). */
console.log('1. the empty ticket book renders as the finding it is');
{
  const T = ctx.HG_OG_REPLAY_EVIDENCE.sequentialTicketHorizon;
  ok(T && typeof T === 'object' && Object.keys(T).length === 0,
     'the baked constant carries an honestly EMPTY ticket horizon map');
  const h = load({ hgGoldscalpConviction: live(1) }).ctx.hgOgOneAtATimeHtml();
  ok(/empty on the hg-v1402 walk/.test(h), 'the panel states the gated book is empty on this walk');
  ok(!/\+0\.148R|\+0\.416R|not significant/.test(h),
     'and quotes none of the retired hg-v918 claim');
}
{
  /* the live branch, exercised on a fixture map (mutation surface: if the
     dynamic rendering were deleted or re-hardcoded, these fail) */
  const c = load({ hgGoldscalpConviction: live(1) }).ctx;
  const E = c.HG_OG_REPLAY_EVIDENCE;
  const saved = E.sequentialTicketHorizon;
  try {
    E.sequentialTicketHorizon = {
      SCALP: { lo: [50, 0.4, 0.2111], hi: [40, 0.45, 0.3222] },
      SWING: { lo: [30, 0.3, -0.1111], hi: [25, 0.36, 0.1555] }
    };
    const h = c.hgOgOneAtATimeHtml();
    ok(h.indexOf('+0.211R') >= 0 && h.indexOf('+0.322R') >= 0,
       'a populated map renders its own numbers — nothing is written in');
    ok(/positive at <b>both<\/b> bounds/.test(h), 'and states the both-bounds property when it holds');
    ok(/SWING disagrees between the two bounds/.test(h), 'SWING is named as disagreeing when it does');
    ok(/carries no verdict/.test(h), 'and explicitly carries no verdict');
    ok(/n=50 at <b>\+1\.00&sigma;/.test(h),
       'the sigma is computed from the map at render time (0.4 vs 1/3 at n=50 = +1.00)');
    const z = (0.4 - 1 / 3) / Math.sqrt((1 / 3) * (2 / 3) / 50);
    near(z, 1.00, 0.02, 'matching the raw-z arithmetic the panel prints');
  } finally { E.sequentialTicketHorizon = saved; }
}

/* ---- 2. THE LIMIT IS PINNED AS HARD AS THE CLAIM ---- */
console.log('2. the retired claim stays on record, and nothing replaces it');
{
  ok(/hg-v918/.test(OG_SRC), 'the module keeps the hg-v918 walk claim on record');
  ok(/empty on the hg-v1402 walk/.test(OG_SRC),
     'and states plainly that the hg-v1402 walk has no gated ticket book');
  /* no verdict is silently upgraded: the empty book says nothing, in
     particular nothing significant */
  const h = load({ hgGoldscalpConviction: live(1) }).ctx.hgOgOneAtATimeHtml();
  ok(!/significant/.test(h.replace(/not significant/g, '')),
     'the empty-book panel makes no significance claim at all');
}

/* ---- 3. the concentration argument stands without the statistics ----
   hg-v1402 re-walk numbers: 48.2 plans/day, 56 held at once. */
console.log('3. 56 at once is one bet at 57x, which needs no p-value');
{
  const h = load({ hgGoldscalpConviction: live(1) }).ctx.hgOgOneAtATimeHtml();
  ok(/48\.2 plans a day/.test(h), 'it states the publication rate');
  ok(/56 at once/.test(h), 'and the concurrency');
  ok(/not 56 bets, it is one bet/.test(h), 'and names it as one bet, not a portfolio');
  ok(/stands without/.test(h), 'and says that argument does not lean on the numbers above');
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
