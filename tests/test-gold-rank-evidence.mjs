/* HARDGATE — THE DESK'S OWN RANKING SIGNALS, MEASURED.

   The gold desks order a board and present the top of it. MOST PROBABLE is a
   claim about which setup is best. Lead-eligibility decides which cards may
   be crowned. The A/B/C grade is printed on every card as quality. All three
   are rankings, and a ranking earns its keep only if the cards it puts first
   do better than the ones it puts last.

   MEASURED (pack 911) on the largest committed replays in this repo — 2,445
   settled GOLD SCALP trades and 244 settled GOLD SWING trades, net R at the
   desk's own XM venue cost, Welch's t on the difference of means:

     lane   signal                  nSel  nRest   selR    restR   diff     t
     SCALP  MOST PROBABLE vs rest    111   2334  -0.231  -0.154  -0.078  -0.74
     SCALP  lead-eligible vs demoted 381   2064  -0.221  -0.146  -0.075  -1.15
     SCALP  grade A vs B and C      1463    730  -0.165  -0.113  -0.053  -0.95
     SWING  grade A vs B and C         9    235  +0.972  +0.047  +0.926  +1.58

   NOT ONE CLEARS 95% IN EITHER DIRECTION, and the file is careful about what
   that does and does not mean:

     - it is NOT evidence the rankings are backwards. A t of -0.74 is a
       shrug. Four of the six comparisons in the original sweep leaned that
       way and none of them is significant.
     - it is NOT evidence they work. Nothing here shows a card the desk puts
       first beating one it puts last.

   So the desks say so, and change nothing else. No board is reordered, no
   card suppressed, no grade altered: there is no better ordering on hand,
   and swapping a ranking nobody has measured for a different ranking nobody
   has measured is motion, not improvement.

   ONE THING THE SWEEP FOUND ON THE WAY. Every one of the 277 settled GOLD
   SWING trades in its replay carries demoted:true — leadEligible n=0, mpOnly
   n=0. The swing desk never crowned a leader across the whole 140-day walk,
   so it has no measurement of its own MOST PROBABLE to show. That is why the
   swing banner carries the grade row instead.

   Every number is RE-DERIVED here from the committed per-trade files rather
   than compared to a copy of itself, because pack 910 is what happens when a
   transcription is trusted.

   Run: node tests/test-gold-rank-evidence.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const S = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const ctx = { Math, isFinite, isNaN, Number, String, Array, Object, JSON, RegExp };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(S('gold-rank-evidence.js'), ctx, { filename: 'gold-rank-evidence.js' });

/* ---- the derivation, run here rather than trusted ---- */
const SCALP = J('scripts/backtest-goldscalp-results-floor.json').trades.filter(t => typeof t.netR === 'number');
const SWING = J('scripts/backtest-goldswing-results.json').trades.filter(t => typeof t.netR === 'number');
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
function se(v){
  const m = mean(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1)) / Math.sqrt(v.length);
}
function welch(a, b){
  const d = mean(a) - mean(b), s = Math.sqrt(se(a) ** 2 + se(b) ** 2);
  return { diff: d, t: d / s };
}
const R = t => t.netR;
const SPLITS = {
  'scalp|mp':     () => [SCALP.filter(t => t.mp === true).map(R), SCALP.filter(t => t.mp !== true).map(R)],
  'scalp|lead':   () => [SCALP.filter(t => t.demoted !== true).map(R), SCALP.filter(t => t.demoted === true).map(R)],
  'scalp|gradeA': () => [SCALP.filter(t => String(t.grade) === 'A').map(R),
                         SCALP.filter(t => String(t.grade) === 'B' || String(t.grade) === 'C').map(R)],
  'swing|gradeA': () => [SWING.filter(t => String(t.grade) === 'A').map(R),
                         SWING.filter(t => String(t.grade) === 'B' || String(t.grade) === 'C').map(R)]
};

console.log('== the table is re-derived from the replays, not copied ==');
{
  ok(SCALP.length === 2445, `${SCALP.length} settled scalp trades carry a net R`);
  ok(SWING.length === 244, `${SWING.length} settled swing trades carry a net R`);
  ok(Array.isArray(ctx.HG_GOLD_RANK_EVIDENCE) && ctx.HG_GOLD_RANK_EVIDENCE.length === 4,
     `the module holds ${ctx.HG_GOLD_RANK_EVIDENCE.length} measured comparisons`);

  const drift = [];
  for (const row of ctx.HG_GOLD_RANK_EVIDENCE){
    const key = row.lane + '|' + row.signal;
    const split = SPLITS[key];
    if (!split){ drift.push(`${key} has no derivation in this test`); continue; }
    const [sel, rest] = split();
    const w = welch(sel, rest);
    if (sel.length !== row.nSel) drift.push(`${key} nSel: table ${row.nSel} vs replay ${sel.length}`);
    if (rest.length !== row.nRest) drift.push(`${key} nRest: table ${row.nRest} vs replay ${rest.length}`);
    if (Math.abs(mean(sel) - row.selR) > 0.0006) drift.push(`${key} selR: table ${row.selR} vs replay ${mean(sel).toFixed(3)}`);
    if (Math.abs(mean(rest) - row.restR) > 0.0006) drift.push(`${key} restR: table ${row.restR} vs replay ${mean(rest).toFixed(3)}`);
    if (Math.abs(w.diff - row.diff) > 0.0011) drift.push(`${key} diff: table ${row.diff} vs replay ${w.diff.toFixed(3)}`);
    if (Math.abs(w.t - row.t) > 0.006) drift.push(`${key} t: table ${row.t} vs replay ${w.t.toFixed(2)}`);
  }
  ok(drift.length === 0,
     'and every cell matches what the per-trade rows actually say'
     + (drift.length ? ('\n      ' + drift.join('\n      ')) : ''));
}

console.log('\n== not one signal clears 95%, in either direction ==');
{
  const verdicts = ctx.HG_GOLD_RANK_EVIDENCE.map(r => ctx.hgGoldRankVerdict(r));
  ok(verdicts.every(v => v === 'undemonstrated'),
     `all ${verdicts.length} read "undemonstrated" — no ranking is shown to work, and none is shown to be backwards`);
  ok(ctx.HG_GOLD_RANK_EVIDENCE.every(r => Math.abs(r.t) < 1.96),
     'every |t| is under 1.96: ' + ctx.HG_GOLD_RANK_EVIDENCE.map(r => r.t.toFixed(2)).join(', '));
  /* The one that leans positive leans on almost nothing, and the file says so. */
  const swA = ctx.hgGoldRankEvidenceFor('swing', 'gradeA');
  ok(swA.t > 0 && swA.nSel === 9,
     `the only positive lean is SWING grade A at t=+${swA.t.toFixed(2)} — on ${swA.nSel} settled trades`);
  /* The verdict function must be able to say the other two things, or
     "undemonstrated" is just what it always returns. */
  ok(ctx.hgGoldRankVerdict({ t: 3.0 }) === 'ranks', 'a t of +3.0 would read "ranks"');
  ok(ctx.hgGoldRankVerdict({ t: -3.0 }) === 'backwards', 'a t of -3.0 would read "backwards"');
  ok(ctx.hgGoldRankVerdict({ t: NaN }) === null && ctx.hgGoldRankVerdict(null) === null,
     'and an unreadable row returns null rather than a fourth answer');
}

console.log('\n== the swing desk never crowned a leader at all ==');
{
  const all = J('scripts/backtest-goldswing-results.json');
  const demoted = all.trades.filter(t => t.demoted === true).length;
  const crowned = all.trades.filter(t => t.mp === true).length;
  ok(demoted === all.trades.length && crowned === 0,
     `${demoted} of ${all.trades.length} settled swing trades are demoted and ${crowned} were crowned`);
  ok(all.aggregates.leadEligible.n === 0 && all.aggregates.mpOnly.n === 0,
     'which the aggregates agree with: leadEligible n=0, mpOnly n=0');
  ok(!ctx.hgGoldRankEvidenceFor('swing', 'mp'),
     'so the module carries NO swing MOST PROBABLE row — there is nothing measured to carry');
  ok(ctx.hgGoldRankEvidenceNote('swing', 'mp') === '',
     'and asks for one render nothing, rather than a claim built from no trades');
}

console.log('\n== the note says what was measured, and what it does not mean ==');
{
  const n = strip(ctx.hgGoldRankEvidenceNote('scalp', 'mp'));
  ok(/MOST PROBABLE IS NOT A MEASURED CLAIM/.test(n), 'it leads with what the signal is not');
  ok(/-0\.231R against -0\.154R/.test(n), 'it gives both sides of the comparison');
  ok(/n=111 against n=2334/.test(n), 'and both sample sizes');
  ok(/t=-0\.74/.test(n), 'and the statistic');
  ok(/does not clear 95% in EITHER direction/.test(n), 'it says the test is inconclusive');
  ok(/not evidence the ranking is backwards/.test(n) && /not evidence it works/.test(n),
     'and spells out BOTH things it does not mean — the temptation runs in both directions');
  ok(/still ordered this way/.test(n) && /unproven ordering beats an arbitrary one/.test(n),
     'while saying why the board is still ordered this way');

  /* It must not creep into being a gate. The promise clause is the one place
     this vocabulary is allowed — it is what makes the promise — so it is
     checked first and then set aside, and the rest is held to the ban. Three
     earlier packs wrote this check the naive way and each failed on the very
     sentence it was written to protect. */
  ok(/nothing here is suppressed or re-ranked/i.test(n), 'and it promises, in as many words, to do neither');
  const body = n.replace(/nothing here is suppressed or re-ranked[\s\S]*$/i, ' ');
  for (const claim of ['suppressed', 'removed', 're-ranked', 'excluded', 'dropped'])
    ok(!new RegExp('\\b' + claim + '\\b', 'i').test(body),
       `and nowhere else says a card was ${claim} on the strength of it`);
}

console.log('\n== absent is absent ==');
{
  for (const [lane, sig] of [['scalp', 'nope'], ['nope', 'mp'], ['', ''], [null, null]]){
    ok(ctx.hgGoldRankEvidenceFor(lane, sig) === null, `no row for (${lane}, ${sig})`);
    ok(ctx.hgGoldRankEvidenceNote(lane, sig) === '', `and no note either`);
  }
}

console.log('\n== it is wired where the claim is actually made ==');
{
  const gs = S('goldscalp.js'), gw = S('goldswing.js');
  ok(/WHY THIS ONE LEADS[\s\S]{0,700}?hgGoldRankEvidenceNote\('scalp', 'mp'\)/.test(gs),
     'GOLD SCALP renders it inside the MOST PROBABLE banner, right after the line claiming why it leads');
  ok(/WHY THIS ONE LEADS[\s\S]{0,700}?hgGoldRankEvidenceNote\('swing', 'gradeA'\)/.test(gw),
     'GOLD SWING renders the grade row there, since its replay never crowned a leader to measure');
  for (const [f, src] of [['goldscalp.js', gs], ['goldswing.js', gw]])
    ok(/typeof W\.hgGoldRankEvidenceNote === 'function'/.test(src),
       `${f} guards on the helper being loaded, so a missing module is silence and not a throw`);

  const idx = S('index.html');
  ok(/<script src="gold-rank-evidence\.js\?v=\d+"><\/script>/.test(idx), 'index.html loads the module');
  const iRank = idx.indexOf('gold-rank-evidence.js');
  for (const tab of ['goldscalp.js', 'goldswing.js'])
    ok(iRank < idx.indexOf('<script src="' + tab), `and loads it before ${tab}`);
  ok(/'\.\/gold-rank-evidence\.js'/.test(S('sw.js')), 'and the offline shell caches it');
}

console.log(`\n${passed} passed, 0 failed`);
