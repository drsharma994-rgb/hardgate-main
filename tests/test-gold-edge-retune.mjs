/**
 * hg-v928 — the suppress / demote / prefer verdicts, hand-tuned on instruction.
 *
 * NO NEW EVIDENCE SUPPORTS ANY OF THIS AND NONE IS CLAIMED. The desk owner
 * asked for it twice; hg-v916 refused one of these exact flips (bosalign) on
 * walk-forward grounds. It ships as an instruction and is recorded as one.
 *
 * The tuning is MECHANICAL: the table's own bars, applied to the population
 * the desk still forms (the `live` block) instead of the whole 2,193-trade
 * book, 45% of which it no longer forms. This guard re-derives every moved
 * verdict from the replay, so the literals cannot drift from the rule they
 * claim to follow, and pins:
 *   1. each moved verdict is what the stated bars give on the live numbers;
 *   2. none is unanimous on disjoint windows, and the row says so;
 *   3. the two flips that would TIGHTEN on n=6 and n=1 are refused;
 *   4. it is reversible, and every consumer reads the verdict in force.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { splitDisjoint } from '../scripts/disjoint-windows.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, t, m) => ok(Math.abs(a - b) <= t, m + ' — got ' + a + ', want ~' + b);

const GI_SRC = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
function load(seed){
  const store = Object.assign({}, seed || {});
  const ctx = {
    Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number,
    console: { log(){}, warn(){}, error(){} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); } }
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(GI_SRC, ctx, { timeout: 20000 }); } catch (e) {}
  ctx.hgGoldEdgeRetuneInit();
  return { ctx, store };
}
const { ctx } = load();
const TBL = ctx.HG_GOLD_SETUP_EDGE.scalp;
for (const n of ['hgGoldEdgeAction', 'hgGoldSetEdgeRetune', 'hgGoldEdgeRetunedRows', 'hgGoldEdgeRetuneNote'])
  ok(typeof ctx[n] === 'function', 'goldind.js exports ' + n);

/* ---- the live population, re-derived exactly as the table defines it ---- */
const COST_BAR = 0.16;
const sp = (t) => (typeof t.entry === 'number' && typeof t.stop === 'number' && t.entry > 0)
  ? Math.abs(t.entry - t.stop) / t.entry * 100 : 0;
const RAW = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
const BOOK = RAW.trades.filter((t) => typeof t.netR === 'number' && !t.shadow && sp(t) >= COST_BAR)
  .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const of = (k) => BOOK.filter((t) => t.stratKey === k);
/* the table's OWN stated bars — written once here, and nowhere else */
const verdict = (n, gross, net) => {
  if (n >= 50 && gross <= 0 && net <= -0.20) return 'suppress';
  if (n >= 50 && gross > 0 && net >= 0.10) return 'prefer';
  if (net < 0) return 'demote';
  return 'neutral';
};

/* ---- 1. every moved verdict is the rule applied to the live numbers ---- */
console.log('1. each retune is the stated bar on the live population, not a pick');
/* hg-v1439 re-derivation: the retune block's liveN/liveGross/liveNet are the
   HG-V928 HISTORICAL record (that walk's numbers — they do not change with
   the artifact); the CURRENT artifact's numbers live in each row's live:
   block, and the rule applied to them must reproduce the row's action today.
   bosalign's hg-v928/hg-v916 loosening LAPSED at hg-v1439 (the re-walk reads
   -0.071R net over n=94 — the demote rule fires again; the hg-v916 note
   warned the sign flips at every split, and it flipped), so its action is
   back to its baked demote. */
const moved = ctx.hgGoldEdgeRetunedRows();
eq(moved.length, 4, 'four rows carry retune records');
eq(moved.map((m) => m.key).sort().join(','), 'bosalign,liqsweep,nyexh,ribbon', 'and they are these four');
for (const { key, row } of moved){
  const rows = of(key);
  const n = rows.length, g = mean(rows.map((t) => t.rGross)), nt = mean(rows.map((t) => t.netR));
  ok(typeof row.retune.liveN === 'number' && typeof row.retune.liveGross === 'number' && typeof row.retune.liveNet === 'number',
     key + ' keeps its hg-v928 historical record (liveN/liveGross/liveNet from that walk)');
  eq(verdict(n, g, nt), row.action,
     key + ' the rule on TODAY\'s replay (' + n + ' trades, net ' + nt.toFixed(3) + ') reproduces the in-force action ' + row.action);
  eq(row.actionBaked, row.retune.from, key + ' keeps the original under actionBaked');
  ok(/RETUNED ON INSTRUCTION|hg-v1439/.test(row.why), key + ' why records the instruction and its hg-v1439 fate');
}
/* the hg-v928 loosenings: liqsweep/nyexh/ribbon still loosen; bosalign's
   lapsed at hg-v1439 — it is back to the baked demote. */
const rank = { suppress: 0, demote: 1, neutral: 2, prefer: 3 };
for (const { key, row } of moved){
  if (key === 'bosalign'){
    eq(row.action, row.actionBaked, 'bosalign: hg-v1439 returned it to the baked demote (the instruction-retune lapsed on the re-walk)');
    ok(/hg-v1439: BACK TO DEMOTE/.test(row.why), 'bosalign why records the hg-v1439 return with numbers');
  } else {
    ok(rank[row.action] > rank[row.actionBaked], key + ' loosened rather than tightened');
  }
}

/* ---- 2. none is unanimous, and the row admits it ---- */
console.log('2. not one is unanimous on disjoint windows, and each says so');
/* hg-v1439 re-derivation: retune.windows is the HG-V928 historical record;
   TODAY's re-walk counts are pinned per row below (bosalign 3/4 — the
   hg-v1439 return-to-demote leans on exactly this flip-proneness). */
const WINDOWS_TODAY = { bosalign: '2/4', liqsweep: '3/4', nyexh: '1/4', ribbon: '3/4' };
for (const { key, row } of moved){
  const W = splitDisjoint(BOOK, 4).map((seg) => seg.filter((t) => t.stratKey === key));
  const judged = W.filter((s) => s.length >= 8);
  const pos = judged.filter((s) => mean(s.map((t) => t.netR)) > 0).length;
  eq(pos + '/' + judged.length, WINDOWS_TODAY[key], key + ' window count matches TODAY\'s replay (' + WINDOWS_TODAY[key] + ')');
  ok(/^[0-9]+\/[0-9]+$/.test(row.retune.windows), key + ' keeps its hg-v928 historical window record (' + row.retune.windows + ')');
  eq(row.retune.unanimous, false, key + ' is recorded as not unanimous');
  ok(pos > 0 && pos < judged.length, key + ' really is split (' + pos + '/' + judged.length + ')');
}
{
  const h = ctx.hgGoldEdgeRetuneNote();
  ok(/ON INSTRUCTION, NOT ON EVIDENCE/.test(h), 'the panel leads with which of the two it is');
  ok(/Not one is unanimous/.test(h), 'and says none is unanimous');
  ok(/flips sign at all three walk-forward splits/.test(h), 'naming the bosalign flip specifically');
  ok(/refused before/.test(h), 'and that this exact flip was refused before');
  for (const { key } of moved) ok(h.indexOf(key) >= 0, 'the panel names ' + key);
}

/* ---- 3. the two TIGHTENING flips are refused ---- */
console.log('3. the rule would also tighten two rows on thin samples — refused');
/* hg-v1439 re-derivation: on the re-walk p5vwap settled 8 (rule still
   demotes; still refused, now with an actionWhy); vpbook settled ZERO — the
   refusal mooted itself: there is nothing left to tighten on, and neutral
   stands because absence is not evidence. */
for (const [key, wantN] of [['p5vwap', 8], ['vpbook', 0]]){
  const rows = of(key);
  eq(rows.length, wantN, key + ' has ' + wantN + ' live trades on the hg-v1439 re-walk');
  if (wantN > 0)
    eq(verdict(rows.length, mean(rows.map((t) => t.rGross)), mean(rows.map((t) => t.netR))), 'demote',
       'and the stated rule would demote it');
  else
    ok(true, key + ' has no live trades — the rule cannot even read it, and the hg-v928 refusal stands as the record');
  eq(TBL[key].action, 'neutral', 'but it is left neutral');
  eq(TBL[key].retune, undefined, 'with no retune record, because nothing was done');
}
ok(/demote bar has no sample floor|demote bar has NO SAMPLE FLOOR/i.test(GI_SRC),
   'the source names the missing sample floor as the reason');
ok(/far too thin to demote on/.test(GI_SRC),
   "and vpbook's own why still says it is too thin — the judgement that was not overridden");
{
  const h = ctx.hgGoldEdgeRetuneNote();
  ok(/p5vwap/.test(h) && /vpbook/.test(h), 'the panel names both refused rows');
  ok(/refused/.test(h) && /tighten/.test(h), 'and says they were refused because they tighten');
}

/* ---- 4. reversible, and every consumer reads the verdict in force ---- */
console.log('4. one call puts every original verdict back');
{
  const { ctx: a, store } = load();
  for (const { key, row } of moved) eq(a.hgGoldEdgeAction(a.HG_GOLD_SETUP_EDGE.scalp[key]), row.action,
    key + ' resolves to the retuned verdict by default');
  a.hgGoldSetEdgeRetune(false);
  eq(store.hg_gold_edge_retune, '0', 'turning it off persists');
  for (const { key, row } of moved) eq(a.hgGoldEdgeAction(a.HG_GOLD_SETUP_EDGE.scalp[key]), row.actionBaked,
    key + ' resolves back to the baked verdict');
  eq(a.hgGoldEdgeRetuneNote(), '', 'and the panel goes quiet — nothing to disclose');
  /* a row that was never retuned is unaffected either way */
  eq(a.hgGoldEdgeAction(a.HG_GOLD_SETUP_EDGE.scalp.hvn), 'demote', 'an untouched row reads the same when off');
  a.hgGoldSetEdgeRetune(true);
  eq(a.hgGoldEdgeAction(a.HG_GOLD_SETUP_EDGE.scalp.hvn), 'demote', 'and the same when on');
  eq(a.hgGoldEdgeAction(null), null, 'a missing row is null, never a throw');
  const { ctx: b } = load({ hg_gold_edge_retune: '0' });
  eq(b.hgGoldEdgeAction(b.HG_GOLD_SETUP_EDGE.scalp.nyexh), 'suppress', 'a stored off survives a reload');
  const { ctx: c } = load({ hg_gold_edge_retune: 'rubbish' });
  eq(c.hgGoldEdgeAction(c.HG_GOLD_SETUP_EDGE.scalp.nyexh), 'demote', 'and a corrupt value falls back to the default');
}
/* the apply path must branch on the RESOLVED verdict, not the raw field */
ok(/var act = hgGoldEdgeAction\(row\);/.test(GI_SRC), 'hgGoldSetupEdgeApply resolves the verdict once');
for (const v of ['suppress', 'demote', 'prefer', 'neutral'])
  ok(new RegExp("if \\(act === '" + v + "'\\)").test(GI_SRC), "and branches on act for '" + v + "'");
ok(!/if \(row\.action === '(suppress|demote|prefer|neutral)'\)/.test(GI_SRC),
   'no branch still reads row.action directly, which would ignore the revert');

/* ---- 5. the bars themselves did not move ---- */
console.log('5. the bars are unchanged — only the population they are applied to');
ok(/suppress\s+n>=50 AND gross <= 0 AND netXm <= -0\.20/.test(GI_SRC), 'the suppress bar is unchanged');
ok(/demote\s+netXm < 0/.test(GI_SRC), 'the demote bar is unchanged');
ok(/prefer\s+n>=50 AND gross > 0\s+AND netXm >= \+0\.10/.test(GI_SRC), 'the prefer bar is unchanged');
ok(/NO NEW EVIDENCE\s+SUPPORTS ANY OF IT/.test(GI_SRC),
   'and the source says no evidence supports the change');
ok(/none is claimed/.test(GI_SRC), 'and that none is claimed');
ok(/recorded as theirs/.test(GI_SRC), 'and whose decision it was');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
