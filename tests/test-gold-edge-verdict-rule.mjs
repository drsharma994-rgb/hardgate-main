/* HARDGATE — hg-v960: the gold edge verdicts were hand-typed on top of
   generated evidence, and the rule that produced them was not computable.

   HG_GOLD_SETUP_EDGE.scalp decides suppress / demote / prefer for GOLD SCALP,
   GOLD SWING, GOLD ULTRA, GOLD DIRECTION and MILLI GOLD. Each row carries a
   `live` block the generator writes and an `action` a human typed. Nothing
   kept the two in step, so a re-bake moved the evidence and left the decision
   frozen — hg-v946's hand-typed-prefer-book failure, in the table hg-v928
   retuned.

   And the rule was not merely unstated, it was UNCOMPUTABLE. hg-v928's bars
   are:
       suppress : live n >= 50 && live gross <= 0 && live net <= -0.20
       prefer   : live n >= 50 && live gross >  0 && live net >= +0.10
       demote   : live net < 0
   Both the suppress and the prefer bar need a gross on the live population,
   and the live block carried only `net`. Four rows had a liveGross recorded
   BY HAND inside their retune blocks; for the other twenty-one the number
   existed nowhere in the repo — so every suppress and prefer verdict in force
   was unverifiable against the evidence shipped beside it.

   hg-v960 computes that gross (validated below against all four hand-recorded
   values), states the rule once in goldind.js, and makes an UNDECLARED
   departure fatal to the bake.

   NO VERDICT MOVES: the rule reproduces 23 of 25 in-force verdicts, and the
   two it does not are the two hg-v928 deliberately refused, now declared on
   their own rows instead of in prose.

   Run: node tests/test-gold-edge-verdict-rule.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

function boot(){
  const ctx = { window: {}, console: { log(){}, warn(){}, error(){} },
    Math, JSON, Date, isFinite, String, Object, Array, RegExp, Promise, Error,
    setTimeout, localStorage: { getItem: () => null, setItem(){} } };
  ctx.window.window = ctx.window; ctx.globalThis = ctx; ctx.self = ctx.window;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js']){
    try{ vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }catch(e){}
  }
  return ctx.window;
}
const W = boot();
const scalp = W.HG_GOLD_SETUP_EDGE.scalp;

/* =====================================================================
   1. The rule is COMPUTABLE — every live population carries a gross.
      This is the hg-v960 fix; before it, 21 of 25 rows could not be judged.
   ===================================================================== */
{
  let withLive = 0, withGross = 0;
  for (const k of Object.keys(scalp)){
    const L = scalp[k].live;
    if (!L || typeof L.n !== 'number') continue;
    withLive++;
    if (typeof L.gross === 'number') withGross++;
  }
  ok(withLive >= 20, 'the table has a live population on most rows — got ' + withLive);
  eq(withGross, withLive, 'EVERY live population carries a gross, so the suppress and prefer '
    + 'bars can be evaluated on all of them and not just the four that were hand-recorded');
}

/* =====================================================================
   2. The computed gross reproduces the four values hg-v928 recorded BY
      HAND, exactly. Independent confirmation that the number the rule now
      runs on is the number the desk owner measured.
   ===================================================================== */
{
  let checked = 0;
  for (const k of Object.keys(scalp)){
    const r = scalp[k];
    if (!r.retune || typeof r.retune.liveGross !== 'number') continue;
    checked++;
    eq(r.live.gross, r.retune.liveGross,
      k + ': generated live gross equals the hand-recorded liveGross (' + r.retune.liveGross + ')');
    eq(r.live.n, r.retune.liveN, k + ': and the sample matches too');
  }
  eq(checked, 4, 'all four hand-recorded retune rows were cross-checked');
}

/* =====================================================================
   3. The rule reproduces the verdicts in force, and every departure is
      DECLARED. This is the invariant the bake is now fatal on.
   ===================================================================== */
{
  const d = W.hgGoldEdgeVerdictDepartures();
  eq(d.undeclared.length, 0,
    'no verdict departs from the rule without a recorded reason — '
    + d.undeclared.map(x => x.key).join(', '));
  /* hg-v961 gave the SWING desk the same rule, and it departs on exactly one
     more row — p6zfade at n=2, refused for the reason the two scalp rows were
     refused. The scalp pair is asserted on its own so this stays the hg-v960
     claim it was, rather than a count that any new row could satisfy. */
  const scalpDecl = d.declared.filter(x => (x.desk || 'scalp') === 'scalp');
  eq(scalpDecl.length, 2, 'exactly the two hg-v928 refusals depart on scalp, and both are declared');
  const keys = scalpDecl.map(x => x.key).sort().join(',');
  ok(keys === 'p5vwap,vpbook', 'the declared departures are p5vwap and vpbook — got ' + keys);
  for (const x of scalpDecl){
    eq(x.rule, 'demote', x.key + ': the rule would demote it');
    eq(x.inForce, 'neutral', x.key + ': the desk keeps it neutral');
    ok(typeof x.why === 'string' && x.why.length > 20, x.key + ': the reason is recorded on the row');
    ok(/n=\d/.test(x.why), x.key + ': and the reason names the sample it was refused on');
  }
  /* both refusals really are the thinnest rows — the stated reason must be true */
  for (const k of ['p5vwap', 'vpbook']) ok(scalp[k].live.n <= 6, k + ' really is that thin');
}

/* =====================================================================
   4. NON-VACUITY: the reporter is not a rubber stamp. A row whose verdict
      contradicts the rule with no reason must be named.
   ===================================================================== */
{
  const W2 = boot();
  W2.HG_GOLD_SETUP_EDGE.scalp.__synthetic = {
    n: 999, gross: 0.5, net: 0.5, action: 'suppress',      /* rule says prefer */
    live: { n: 400, gross: 0.4, net: 0.4, oosHeld: 3, oosBroke: 0 }
  };
  const d2 = W2.hgGoldEdgeVerdictDepartures();
  ok(d2.undeclared.some(x => x.key === '__synthetic'),
    'a verdict that contradicts the rule with no reason is reported UNDECLARED');
  const row = d2.undeclared.find(x => x.key === '__synthetic');
  eq(row.rule, 'prefer', 'and the reporter names what the rule would have said');
  eq(row.inForce, 'suppress', 'and what is actually in force');

  /* give it a reason and it moves to declared, not silent */
  W2.HG_GOLD_SETUP_EDGE.scalp.__synthetic.actionWhy = 'deliberate, for this test (n=400)';
  const d3 = W2.hgGoldEdgeVerdictDepartures();
  ok(!d3.undeclared.some(x => x.key === '__synthetic'), 'declaring a reason clears the undeclared list');
  ok(d3.declared.some(x => x.key === '__synthetic'), 'and moves it to declared — never silently dropped');

  /* an EMPTY reason is not a reason */
  W2.HG_GOLD_SETUP_EDGE.scalp.__synthetic.actionWhy = '';
  ok(W2.hgGoldEdgeVerdictDepartures().undeclared.some(x => x.key === '__synthetic'),
    'an empty actionWhy does not count as declaring anything');
}

/* =====================================================================
   5. The bars themselves, driven at their boundaries.
   ===================================================================== */
{
  const v = (liveN, gross, net) => W.hgGoldEdgeVerdictFromLive({ live: { n: liveN, gross, net } });
  eq(v(50, -0.01, -0.20), 'suppress', 'suppress at exactly n=50, gross<=0, net<=-0.20');
  eq(v(49, -0.01, -0.20), 'demote',   'n=49 is under the suppress floor — demoted, not suppressed');
  eq(v(50,  0.01, -0.20), 'demote',   'positive gross blocks suppress');
  eq(v(50, -0.01, -0.19), 'demote',   'net above the suppress bar only demotes');
  eq(v(50,  0.01,  0.10), 'prefer',   'prefer at exactly n=50, gross>0, net>=+0.10');
  eq(v(49,  0.01,  0.10), 'neutral',  'n=49 is under the prefer floor');
  eq(v(50,  0.00,  0.10), 'neutral',  'gross must be strictly positive to prefer');
  eq(v(50,  0.01,  0.09), 'neutral',  'net under the prefer bar is neutral, not prefer');
  eq(v(10, -0.5,  -0.001), 'demote',  'the demote bar has NO sample floor — this is the gap hg-v928 named');
  eq(v(10,  0.5,   0.001), 'neutral', 'a non-negative net on a thin row is neutral');
}

/* =====================================================================
   6. Fails to NULL, never to a default verdict. A row the rule cannot
      judge must not be handed one.
   ===================================================================== */
{
  const f = W.hgGoldEdgeVerdictFromLive;
  eq(f(null), null, 'no row -> null');
  eq(f({}), null, 'no live block -> null');
  eq(f({ live: null }), null, 'null live -> null');
  eq(f({ live: { n: 50, net: -0.5 } }), null, 'live with NO gross -> null, not a guessed demote');
  eq(f({ live: { n: 50, gross: 0.1 } }), null, 'live with no net -> null');
  eq(f({ live: { gross: 0.1, net: -0.5 } }), null, 'live with no n -> null');
  eq(f({ live: { n: '50', gross: 0.1, net: -0.5 } }), null, 'a STRING n is not a sample — null');
  /* a suppressed kind forms nothing and still carries a population: it is judged */
  const supp = Object.keys(scalp).find(k => scalp[k].live && scalp[k].live.formsNone);
  if (supp) ok(f(scalp[supp]) !== null, 'a suppressed kind still has a live read and is judged: ' + supp);
  else n++;
}

/* =====================================================================
   7. The bake reports the rule and exits clean on the committed tree.
   ===================================================================== */
{
  const out = execFileSync('timeout', ['-s', 'KILL', '120', 'node', 'scripts/rebake-gold-literals.mjs'],
    { cwd: ROOT, encoding: 'utf8' });
  /* hg-v961 extended the report with the SWING desk's own partition, so the
     line now carries a fourth bucket. What this asserts is the invariant, not
     the wording: rows follow the rule, exactly the two hg-v928 refusals are
     declared, and NOTHING is undeclared. */
  const m = /verdict rule: (\d+) row\(s\) follow it, (\d+) declared, (\d+) undeclared, (\d+) unrecoverable/.exec(out);
  ok(m, 'the bake reports the verdict rule it enforced — got: '
    + (out.split('\n').filter(l => /verdict rule/.test(l))[0] || '(no line)'));
  ok(+m[1] > 0, 'and some rows really do follow it (' + m[1] + ')');
  eq(+m[2], W.hgGoldEdgeVerdictDepartures().declared.length,
    'the report counts exactly the declared refusals the table carries');
  eq(+m[3], 0, 'and nothing undeclared');
  ok(+m[4] > 0, 'the unrecoverable bucket is reported too — a bar the desk uses '
    + 'but never wrote down is named, not hidden (' + m[4] + ')');
  ok(/every baked literal already equals its artifact/.test(out),
    'and the committed tree still round-trips to zero drift — no literal moved');
}

/* =====================================================================
   8. The bake's FATAL branches, DRIVEN. On a clean tree neither can be
      reached — there is no undeclared departure and the rule is present —
      so left unexercised they are a bucket nothing can land in, and a
      mutation disabling either survived this guard until it was driven.
   ===================================================================== */
{
  const { enforceVerdictRule } = await import('../scripts/rebake-gold-literals.mjs');
  const threw = (win) => { try{ enforceVerdictRule(win); return null; }catch(e){ return e.message; } };

  ok(/exports no hgGoldEdgeVerdictDepartures/.test(threw({}) || ''),
    'a goldind.js with NO verdict rule stops the bake — it does not bake without one');
  ok(/exports no hgGoldEdgeVerdictDepartures/.test(threw({ hgGoldEdgeVerdictDepartures: 42 }) || ''),
    'and a non-function under that name is no rule either');

  const bad = threw({ hgGoldEdgeVerdictDepartures: () => ({
    declared: [], undeclared: [{ key: 'openrange', inForce: 'demote', rule: 'prefer' }] }) });
  ok(bad && /no longer follow the rule/.test(bad),
    'an UNDECLARED departure stops the bake');
  ok(bad && /openrange in force demote, rule says prefer/.test(bad),
    'and the refusal names the row, the verdict in force and what the rule says — got: ' + bad);

  const good = enforceVerdictRule({ hgGoldEdgeVerdictDepartures: () => ({
    declared: [{ key: 'p5vwap', inForce: 'neutral', rule: 'demote', why: 'n=6' }], undeclared: [] }) });
  eq(good.declared.length, 1, 'a DECLARED departure does not stop the bake');
  eq(good.undeclared.length, 0, 'and reports none undeclared');

  /* and the real table passes it — the committed tree is bakeable */
  const live = enforceVerdictRule(W);
  eq(live.undeclared.length, 0, 'the committed table passes the enforcement it now runs under');
}

console.log('\nOK — ' + n + ' assertions passed (gold edge verdict rule)');
