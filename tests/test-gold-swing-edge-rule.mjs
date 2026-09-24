/* HARDGATE — hg-v961: the SWING half of the gold edge table had no live
   population and no rule, and it does not share the scalp one.

   hg-v916 built the `live` column for HG_GOLD_SETUP_EDGE.scalp and stopped.
   hg-v960 put the scalp BARS in code and made an undeclared departure fatal.
   Both passed over the swing half: fourteen verdicts — two of them `prefer`,
   which carries a +2 rank boost on GOLD SWING — with no live block to judge
   them on and no rule that reached them.

   THE SCALP RECIPE DOES NOT TRANSFER, and each way it fails was measured:

   1. The scalp live population DROPS rows under the 0.16% cost bar, because
      hg-v912 made that gate REJECT there. goldswing.js:1734 calls the same
      gate with `demoteOnly: true` — on swing those rows are demoted and still
      FORMED, so copying the filter would delete a cohort the desk shows.
   2. The scalp bars require n>=50 for both `prefer` and `suppress`. The
      LARGEST live population on the swing desk is n=44, so under the scalp
      rule two of the four verdicts are unreachable there by arithmetic —
      hg-v920's "tier the arithmetic cannot produce", in this table.
   3. The demote bar is SHARED, and deliberately so. The first cut of this
      pack gave swing its own floor of n>=12, taken from the prose inside
      p6zfade's `why` string. That number is a bar FITTED to reproduce the
      rows it judges: the table's own behaviour bounds the swing demote bar
      to (2, 14], and 12 is a value picked inside that interval — which is
      exactly what this pack refuses to do for `prefer` one field along.
      hg-v922 and hg-v935 refuse a searched bar; a bar searched to agree with
      the table it then validates is the same error with the search hidden.
      So both desks use the documented demote rule, which has NO sample floor
      (hg-v928 called that a real gap and it is still one), and the single row
      where that rule and the table disagree — p6zfade at n=2 — is DECLARED on
      its own row, in the same form as the two hg-v928 refusals at n=6 and
      n=1.

   WHAT IS NOT RECOVERABLE IS LEFT null. The prefer floor is bounded by the
   table's own behaviour to (23, 32] — ribbon at n=23 is positive on both legs
   and is NOT preferred, weekly at n=32 is — and no value in that interval is
   written anywhere. Picking one to reproduce two rows is fitting a bar to its
   own answer, which hg-v922 and hg-v935 refuse. So the rule returns null for
   those rows and they are counted as UNRECOVERABLE rather than folded into
   either side.

   Run: node tests/test-gold-swing-edge-rule.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
const require$tmp = () => os.tmpdir();
import { liveSwingPopulation, SWING_KEY_ALIAS, SWING_REPLAY,
         COST_BAR_PCT } from '../scripts/edge-live-population.mjs';

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
const swing = W.HG_GOLD_SETUP_EDGE.swing;
const scalp = W.HG_GOLD_SETUP_EDGE.scalp;

/* =====================================================================
   1. The gap this closes: every swing row now carries a live population.
   ===================================================================== */
{
  const keys = Object.keys(swing);
  eq(keys.length, 14, 'the swing table has fourteen rows');
  let withLive = 0;
  for (const k of keys){
    const L = swing[k].live;
    if (L && typeof L.n === 'number'){
      withLive++;
      ok(typeof L.gross === 'number', k + ': the live block carries a gross, so the bars can be applied');
      ok(typeof L.net === 'number', k + ': and a net');
    }
  }
  eq(withLive, 14, 'ALL fourteen swing rows have a live population — before hg-v961, zero did');
}

/* =====================================================================
   2. The key alias, and why a naive join loses the strongest verdict.
   ===================================================================== */
{
  const raw = JSON.parse(fs.readFileSync(SWING_REPLAY, 'utf8'));
  const walkKeys = new Set(raw.trades.filter(t => typeof t.netR === 'number').map(t => t.stratKey));
  ok(!walkKeys.has('weekly'), 'the walk records NO stratKey called weekly');
  ok(walkKeys.has('wkbreak'), 'it calls that mechanic wkbreak');
  ok(!Object.prototype.hasOwnProperty.call(swing, 'wkbreak'), 'and the table has no wkbreak row');
  ok(Object.prototype.hasOwnProperty.call(swing, 'weekly'), 'the table calls it weekly');
  eq(SWING_KEY_ALIAS.weekly, 'wkbreak', 'the alias maps the one pair that differs');

  /* the row a naive join would have starved is a PREFER — the strongest
     verdict on the desk, and one that grants a +2 rank boost */
  eq(swing.weekly.action, 'prefer', 'weekly is one of the two prefer rows');
  ok(swing.weekly.live && swing.weekly.live.n > 0,
    'and it has a population only because the alias exists — a naive join leaves it empty');

  /* NON-VACUITY: without the alias that row genuinely has nothing */
  const settled = raw.trades.filter(t => typeof t.netR === 'number');
  eq(settled.filter(t => t.stratKey === 'weekly').length, 0,
    'joining on the table key alone returns ZERO rows for weekly');
  eq(settled.filter(t => t.stratKey === 'wkbreak').length, swing.weekly.live.n,
    'and the aliased key returns exactly the population the row carries');
}

/* =====================================================================
   3. The swing removals are COUNTED, not assumed — and the scalp filter
      is not applied, because on this desk the cost gate only demotes.
   ===================================================================== */
{
  const { rows, removals } = liveSwingPopulation();
  eq(removals.underCost, 0, 'no settled swing trade sits under the cost bar');
  eq(removals.underFloor, 0, 'none sits under the 1.5xATR stop floor');
  eq(removals.suppressedKinds, 0, 'no swing kind is suppressed after the walk');
  const total = Object.values(rows).reduce((s, r) => s + r.n, 0);
  eq(total, removals.settled,
    'the live population IS the whole settled book — nothing was filtered out (' + total + ')');

  /* the source property that makes copying the scalp filter wrong. Textual,
     and deliberately so: whether that call passes demoteOnly is a fact about
     the source, and no runtime comparison can see it while both desks
     happen to drop zero rows — which is exactly today. */
  const gs = fs.readFileSync(path.join(ROOT, 'goldswing.js'), 'utf8');
  const code = gs.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/hgGoldScalpCostGate[\s\S]{0,120}demoteOnly:\s*true/.test(code),
    'goldswing calls the shared cost gate with demoteOnly — those rows are demoted, not removed');
  ok(COST_BAR_PCT > 0, 'the scalp cost bar is a real number, so the count above is a real check');
}

/* =====================================================================
   3b. NON-VACUITY for section 3. Every removal count is ZERO on today's
       walk, so asserting "0" is satisfied just as well by a hardcoded
       zero, or by a filter that happens to drop nothing — three mutations
       survived on exactly that before this section existed. So the builder
       is driven on a walk where the counts are NOT zero, and is required
       both to COUNT the rows and to KEEP them.
   ===================================================================== */
{
  const raw = JSON.parse(fs.readFileSync(SWING_REPLAY, 'utf8'));
  const settled = raw.trades.filter(t => typeof t.netR === 'number');
  const base = settled[0];
  /* one row under the cost bar and one under the stop floor, both on a kind
     of their own so the counts are unambiguous */
  const tight = { ...base, stratKey: 'zz_tight', entry: 1000, stop: 999.9,   /* 0.01% */
                  stopAtr: 2.0, netR: -0.5, rGross: -0.4 };
  const shallow = { ...base, stratKey: 'zz_shallow', entry: 1000, stop: 950, /* 5% */
                    stopAtr: 0.4, netR: -0.5, rGross: -0.4 };
  const dir = fs.mkdtempSync(path.join(require$tmp(), 'hg-v961-'));
  const file = path.join(dir, 'swing.json');
  fs.writeFileSync(file, JSON.stringify({ meta: raw.meta, trades: settled.concat([tight, shallow]) }));

  const got = liveSwingPopulation(file);
  eq(got.removals.underCost, 1, 'a row under the cost bar is COUNTED (not hardcoded zero)');
  eq(got.removals.underFloor, 1, 'a row under the stop floor is COUNTED');
  eq(got.removals.settled, settled.length + 2, 'and the settled total moves with the book');

  /* and — the point of the whole function — those rows are KEPT, because on
     this desk the cost gate only demotes and the floor already bound */
  ok(got.rows.zz_tight && got.rows.zz_tight.n === 1,
    'the under-cost row is KEPT in the live population — the scalp filter must not be applied here');
  ok(got.rows.zz_shallow && got.rows.zz_shallow.n === 1, 'and so is the under-floor row');
  const total = Object.values(got.rows).reduce((s2, r) => s2 + r.n, 0);
  eq(total, settled.length + 2, 'nothing was filtered out of the live population');
  try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){}
}

/* =====================================================================
   4. The demote rule is SHARED and UNFITTED, and the one row it disagrees
      with the table about is declared rather than legislated away.
   ===================================================================== */
{
  const negatives = Object.keys(swing).filter(k => swing[k].live.net < 0);
  ok(negatives.length >= 5, 'the swing table has negative-net rows to judge — ' + negatives.length);

  /* the rule is one rule: the same bar on both desks */
  eq(W.HG_GOLD_EDGE_BARS.swing.demoteMinN, W.HG_GOLD_EDGE_BARS.scalp.demoteMinN,
    'both desks demote on the same bar — one rule, not two (hg-v949)');
  eq(W.HG_GOLD_EDGE_BARS.swing.demoteMinN, 0,
    'and that bar has no sample floor, which is the documented rule');

  for (const k of negatives){
    const L = swing[k].live;
    eq(W.hgGoldEdgeVerdictFromLive(swing[k], 'swing'), 'demote',
      k + ' (n=' + L.n + ', net=' + L.net + '): a negative live net demotes, at any sample');
    /* and the desks agree on these rows, because the bar is shared */
    eq(W.hgGoldEdgeVerdictFromLive(swing[k], 'scalp'), 'demote',
      k + ': the scalp bars say the same — the demote rule is not desk-specific');
  }

  /* THE BAR WAS NOT FITTED, and this proves the interval it would have been
     fitted inside. A floor that reproduced the shipped table would have to
     sit in (max n among negative rows the table does NOT demote,
     min n among those it does] — a non-empty interval, which is precisely
     what makes a hand-picked value look like a measurement. */
  const demoted = negatives.filter(k => swing[k].action === 'demote').map(k => swing[k].live.n);
  const spared  = negatives.filter(k => swing[k].action !== 'demote').map(k => swing[k].live.n);
  ok(demoted.length >= 4 && spared.length >= 1,
    'the table both demotes and spares negative rows — or there is no interval to refuse');
  const lo = Math.max(...spared), hi = Math.min(...demoted);
  ok(lo < hi, 'a fitted floor would have had a whole interval to hide in: (' + lo + ', ' + hi + ']');
  ok(W.HG_GOLD_EDGE_BARS.swing.demoteMinN <= lo,
    'and the shipped bar is NOT inside it — it is the unfitted one');

  /* the one disagreement is DECLARED, not removed by moving the bar */
  const thin = negatives.find(k => swing[k].action !== 'demote');
  ok(thin, 'there is a negative row the table does not demote — ' + thin);
  eq(swing[thin].live.n, 2, thin + ' is the thinnest row in the table');
  const d = W.hgGoldEdgeVerdictDepartures();
  const rec = d.declared.find(x => x.desk === 'swing' && x.key === thin);
  ok(rec, thin + ' is a DECLARED departure, not an undeclared one');
  eq(rec.rule, 'demote', thin + ': the rule would demote it');
  eq(rec.inForce, 'neutral', thin + ': the desk keeps it neutral');
  ok(/n=2/.test(rec.why || ''), thin + ': and the reason names the sample it was refused on');
  ok(/fitted|floor/.test(rec.why || ''),
    thin + ': and says the alternative was a floor fitted to this very row');
  eq(d.undeclared.length, 0, 'nothing departs without a reason — '
    + d.undeclared.map(x => x.desk + ':' + x.key).join(', '));
}

/* =====================================================================
   5. desk defaults to scalp, so every hg-v960 caller is unchanged.
   ===================================================================== */
{
  const row = { live: { n: 60, gross: 0.5, net: 0.5 } };
  eq(W.hgGoldEdgeVerdictFromLive(row), W.hgGoldEdgeVerdictFromLive(row, 'scalp'),
    'omitting desk reads exactly as scalp');
  eq(W.hgGoldEdgeVerdictFromLive(row), 'prefer', 'and the scalp bars still produce prefer at n=60');
  eq(W.hgGoldEdgeVerdictFromLive({ live: { n: 5, gross: -0.5, net: -0.5 } }), 'demote',
    'the scalp demote bar still has no sample floor — hg-v928 gap, unchanged');
}

/* =====================================================================
   6. An UNRECORDED bar yields null, never a guess.
   ===================================================================== */
{
  const preferable = { live: { n: 44, gross: 0.21, net: 0.19 } };
  eq(W.hgGoldEdgeVerdictFromLive(preferable, 'swing'), null,
    'a swing row that could be preferred returns null — the prefer floor is not recorded');
  eq(W.hgGoldEdgeVerdictFromLive({ live: { n: 60, gross: 0.21, net: 0.19 } }, 'scalp'), 'prefer',
    'the same shape on scalp, where the bar IS recorded, returns prefer');
  eq(W.HG_GOLD_EDGE_BARS.swing.preferMinN, null, 'the swing prefer floor is null = NOT RECORDED');
  eq(typeof W.HG_GOLD_EDGE_BARS.scalp.preferMinN, 'number', 'the scalp one is a number');
  ok(W.HG_GOLD_EDGE_BARS.scalp.preferMinN > 44,
    'and it is above the largest swing population, so it could not have produced the swing prefers');
}

/* =====================================================================
   7. "bar not recorded" and "tier never used" are DIFFERENT, and the
      difference is derived from the table rather than typed.
   ===================================================================== */
{
  eq(W.hgGoldEdgeTierInUse('swing', 'prefer'), true, 'swing rows do carry prefer');
  eq(W.hgGoldEdgeTierInUse('swing', 'suppress'), false, 'no swing row carries suppress');
  eq(W.hgGoldEdgeTierInUse('scalp', 'suppress'), true, 'scalp rows do');

  /* because suppress is unobserved on swing, a deeply negative row falls
     THROUGH to the demote floor instead of reading unrecoverable */
  const deep = { live: { n: 30, gross: -0.4, net: -0.5 } };
  eq(W.hgGoldEdgeVerdictFromLive(deep, 'swing'), 'demote',
    'a deeply negative swing row is demoted, not called unrecoverable');

  /* NON-VACUITY: give the swing table a suppress row and the same input
     becomes unrecoverable, because the tier now exists with no bar */
  const W2 = boot();
  W2.HG_GOLD_SETUP_EDGE.swing.__synthetic = { n: 1, gross: -1, net: -1, action: 'suppress',
                                              live: { n: 99, gross: -1, net: -1 } };
  eq(W2.hgGoldEdgeTierInUse('swing', 'suppress'), true, 'the synthetic row puts the tier in use');
  eq(W2.hgGoldEdgeVerdictFromLive(deep, 'swing'), null,
    'and now the same negative row cannot be ruled on — the distinction is real, not cosmetic');
}

/* =====================================================================
   8. Reachability: a verdict the arithmetic cannot produce is NAMED.
   ===================================================================== */
{
  const sw = W.hgGoldEdgeBarReach('swing');
  const sc = W.hgGoldEdgeBarReach('scalp');
  eq(sw.demote, 'reachable', 'swing can demote');
  eq(sw.prefer, 'IN USE, BAR NOT RECORDED', 'swing prefers rows under a bar nobody wrote down');
  eq(sw.suppress, 'tier unobserved on this desk', 'and never suppresses');
  eq(sc.prefer, 'reachable', 'scalp prefer is reachable');
  eq(sc.suppress, 'reachable', 'scalp suppress is reachable');
  ok(sw.largestLiveN < sc.largestLiveN, 'the swing book is the smaller one');
  ok(sw.largestLiveN < W.HG_GOLD_EDGE_BARS.scalp.preferMinN,
    'and its largest population (' + sw.largestLiveN + ') is under the scalp n>='
    + W.HG_GOLD_EDGE_BARS.scalp.preferMinN + ' bar — so reusing the scalp rule would make '
    + 'prefer UNREACHABLE on this desk, the hg-v920 failure');
}

/* =====================================================================
   9. The departures reporter covers BOTH desks and partitions the rows.
   ===================================================================== */
{
  const d = W.hgGoldEdgeVerdictDepartures();
  eq(d.undeclared.length, 0, 'nothing departs the rule without a recorded reason');
  ok(d.followed.some(x => x.desk === 'swing'), 'swing rows are now judged at all');
  ok(d.followed.some(x => x.desk === 'scalp'), 'and scalp rows still are');
  ok(d.unrecoverable.length > 0, 'the unrecoverable bucket is populated, not decorative');
  ok(d.unrecoverable.every(x => x.desk === 'swing'),
    'and every unrecoverable row is on swing — scalp records both its bars');

  for (const key of ['weekly', 'p9volbar']){
    const row = d.unrecoverable.find(x => x.key === key);
    ok(row, key + ' is reported unrecoverable rather than silently accepted');
    eq(row.inForce, 'prefer', key + ' is in force as prefer');
    ok(typeof row.why === 'string' && row.why.length > 40,
      key + ' carries a recorded reason on the row itself');
    ok(/not recorded|recorded nowhere/.test(row.why), key + ': and the reason names the missing bar');
  }

  /* the buckets partition every judgeable row on both desks */
  const judgeable = [['scalp', scalp], ['swing', swing]]
    .reduce((s, [, t]) => s + Object.keys(t).filter(k => t[k].live && typeof t[k].live.n === 'number').length, 0);
  eq(d.followed.length + d.declared.length + d.undeclared.length + d.unrecoverable.length, judgeable,
    'followed + declared + undeclared + unrecoverable partitions every judgeable row (' + judgeable + ')');
}

/* =====================================================================
   10. The bake reports the derived counts and still round-trips clean.
   ===================================================================== */
{
  const out = execFileSync('timeout', ['-s', 'KILL', '120', 'node', 'scripts/rebake-gold-literals.mjs'],
    { cwd: ROOT, encoding: 'utf8' });
  ok(/swing live blocks/.test(out), 'the bake now writes the swing live blocks');
  const rm = out.match(/swing live population: (\d+) settled, withheld (\d+) cost \/ (\d+) floor \/ (\d+) suppressed \((\d+) removals checked\)/);
  ok(rm, 'the bake REPORTS what the removal check verified — got: '
     + (out.split('\n').filter(l => /swing live population/.test(l))[0] || '(no line)'));
  eq(+rm[2] + +rm[3] + +rm[4], 0, 'and reports that the desk withholds nothing today');
  ok(+rm[1] > 200, 'on a settled book of ' + rm[1] + ' trades');
  eq(+rm[5], 3, 'and names that all three removals were CHECKED — a bypass reports none');
  ok(/every baked literal already equals its artifact/.test(out),
    'and the committed tree round-trips to zero drift');
  const m = out.match(/verdict rule: (\d+) row\(s\) follow it, (\d+) declared, (\d+) undeclared, (\d+) unrecoverable/);
  ok(m, 'the bake reports the rule it enforced — got: '
     + (out.split('\n').filter(l => /verdict rule/.test(l))[0] || '(no line)'));
  eq(+m[3], 0, 'zero undeclared');
  ok(+m[1] > 25, 'more rows follow the rule than the scalp table holds — swing is now covered ('
     + m[1] + ')');
  ok(+m[4] > 0, 'and the unrecoverable count is reported rather than hidden');
}

/* =====================================================================
   11. No verdict moved. The swing writer only ever emits live blocks.
   ===================================================================== */
{
  const gen = fs.readFileSync(path.join(ROOT, 'scripts/rebake-gold-literals.mjs'), 'utf8');
  const swingBlock = gen.slice(gen.indexOf('swing live blocks') - 3000, gen.indexOf('swing live blocks') + 200);
  ok(!/action:\s*'/.test(swingBlock),
    'the swing writer never emits an action — a re-bake moves evidence, never a verdict');
  /* and the in-force verdicts are exactly the four kinds the table uses */
  const kinds = new Set(Object.keys(swing).map(k => swing[k].action));
  for (const a of kinds) ok(['suppress', 'demote', 'prefer', 'neutral'].includes(a),
    'swing verdict in force is one of the four: ' + a);
  eq(kinds.has('suppress'), false, 'and swing still carries no suppress row');
}

/* =====================================================================
   12. The bake's swing FATAL branch, DRIVEN. All three removal counts are
       zero on the committed walk, so it cannot be reached there — and a
       mutation disabling it survived until this section existed.
   ===================================================================== */
{
  const { assertSwingRemovalsModelled } = await import('../scripts/rebake-gold-literals.mjs');
  const threw = (r) => { try{ assertSwingRemovalsModelled(r); return null; }catch(e){ return e.message; } };

  eq(threw({ underCost: 0, underFloor: 0, suppressedKinds: 0 }), null,
    'a walk the desk withholds nothing from bakes clean');
  for (const [field, r] of [['underCost', { underCost: 3, underFloor: 0, suppressedKinds: 0 }],
                            ['underFloor', { underCost: 0, underFloor: 7, suppressedKinds: 0 }],
                            ['suppressedKinds', { underCost: 0, underFloor: 0, suppressedKinds: 2 }]]){
    const msg = threw(r);
    ok(msg && /no longer the whole settled book/.test(msg),
      'a non-zero ' + field + ' STOPS the bake — the coincidence broke and must be modelled');
    ok(msg.indexOf(String(r[field])) >= 0, 'and the refusal names the count it saw for ' + field);
  }
  eq(threw({}), null, 'an empty removals object does not throw on undefined');
  /* and the real walk passes it */
  const live = liveSwingPopulation();
  const verified = assertSwingRemovalsModelled(live.removals);
  eq(verified.settled, live.removals.settled,
    'the committed swing walk passes the check the bake now runs');
  eq(verified.checked.length, 3, 'and the check reports all three removals it looked at');
  ok(verified !== live.removals,
    'it returns its OWN result, so passing the raw counts through instead of calling it '
    + 'is observable — that bypass survived mutation until this held');
}

console.log('\nOK — ' + n + ' assertions passed (gold swing edge rule)');
