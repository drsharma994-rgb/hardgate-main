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

/* GNU `timeout -s KILL` does not exist on Windows; execFileSync's own
   `timeout` option provides the same bound there (CI keeps the GNU wrapper). */
function boundedNode(sec, nodeArgs, opts){
  if (process.platform === 'win32'){
    return execFileSync(process.execPath, nodeArgs, Object.assign({}, opts, { timeout: sec * 1000 }));
  }
  return execFileSync('timeout', ['-s', 'KILL', String(sec), 'node', ...nodeArgs], opts);
}

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
   2. The computed live gross traces to the committed measurement of the
      CURRENT artifact. hg-v1439 re-derivation: the original pinned
      live.gross === retune.liveGross — the four values hg-v928 recorded by
      hand on the v928-era walk. The artifact has been re-walked since (the
      hg-v1439 walk, Aug21–Oct22, post ceiling-reject), so live.gross now
      equals the hg-v1439 analysis of that walk, and the hg-v928 hand-recorded
      numbers stand as the historical record inside each retune block.
   ===================================================================== */
{
  const an = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'gold-scalp-bt-analysis-floor.json'), 'utf8')).byStrategy;
  let checked = 0;
  for (const k of Object.keys(scalp)){
    const r = scalp[k];
    if (!r.live || typeof r.live.gross !== 'number') continue;
    const a = an[k];
    if (!a) continue;
    checked++;
    eq(Math.abs(r.live.gross - a.avgR_gross) < 0.01, true,
      k + ': generated live gross equals the committed analysis of the current artifact (' + a.avgR_gross + ')');
    eq(r.live.n, a.n, k + ': and the sample matches too');
  }
  eq(checked >= 20, true, 'the live-block chain is cross-checked against the artifact (' + checked + ' rows)');
  /* the hg-v928 hand-recorded numbers survive as the historical record */
  const hist = Object.keys(scalp).filter(k => scalp[k].retune && typeof scalp[k].retune.liveGross === 'number');
  eq(hist.length >= 4, true, 'the four hand-recorded retune rows still carry their hg-v928 numbers (' + hist.join(', ') + ')');
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
  /* hg-v1439: four MORE declared departures, all recorded with the measured
     numbers on their rows — p4laf and p5drive keep their DEMOTES against a
     rule-neutral read (loosening refused on thin mixed evidence), p5wyck and
     p7scalp keep their NEUTRALS against a rule-demote read at n=6/n=2 (the
     hg-v928 sample-floor refusals, same shape). Every one is declared, so the
     bake's fatal-on-undeclared invariant is untouched. */
  /* hg-v1439 (second pass): vpbook's refusal MOOTED itself — the re-walk
     settled zero vpbook trades, the live block nulled, and a rule with no
     population cannot depart from anything. sweep JOINED the list: its
     suppress no longer clears the −0.20R bar on the cost-gated withheld
     ledger (n=55, net −0.008R) and stands as a declared tightening refusal. */
  eq(scalpDecl.length, 6, 'six declared departures on scalp: the four hg-v1439 ones plus p5vwap and sweep (vpbook mooted at zero settles)');
  const keys = scalpDecl.map(x => x.key).sort().join(',');
  ok(keys === 'p4laf,p5drive,p5vwap,p5wyck,p7scalp,sweep', 'the declared departures are the hg-v1439 four plus p5vwap and sweep — got ' + keys);
  for (const x of scalpDecl.filter(x => x.key === 'p5vwap' || x.key === 'vpbook')){
    eq(x.rule, 'demote', x.key + ': the rule would demote it');
    eq(x.inForce, 'neutral', x.key + ': the desk keeps it neutral');
    ok(typeof x.why === 'string' && x.why.length > 20, x.key + ': the reason is recorded on the row');
    ok(/n=\d/.test(x.why), x.key + ': and the reason names the sample it was refused on');
  }
  /* both refusals really are the thinnest rows — the stated reason must be true
     (hg-v1439: p5vwap is n=8 on the re-walk; p7scalp n=2 carries the same-shaped
     hg-v1439 refusal, pinned in section 3's declared-departures list) */
  /* hg-v1439: vpbook's live block is null (zero settles on the re-walk) —
     thinner than thin: there is nothing left to read. */
  ok(scalp.p5vwap.live.n <= 8, 'p5vwap really is that thin');
  ok(scalp.vpbook.live === null, 'vpbook is thinner than thin — zero settles on the hg-v1439 walk, live null');
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
  const out = boundedNode(120, ['scripts/rebake-gold-literals.mjs'],
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
