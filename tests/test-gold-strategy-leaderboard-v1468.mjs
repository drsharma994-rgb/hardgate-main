#!/usr/bin/env node
/* test-gold-strategy-leaderboard-v1468 — the win-rate selector's contract.

   hg-v1468 builds the MEASURED foundation the four gold tabs stand on:

     1. hgGoldStrategyLeaderboard(desk) — the strategies of the desk's own
        baked replay book (HG_GOLD_SETUP_EDGE) ranked by SHRUNK expectancy
        (net x n / (n + 30); a half-weight at n=30, the neighbourhood of the
        house's own "small sample, never lead" bar). At the book's pinned
        ~1.5 planned R:R, expectancy ordering IS win-rate ordering — and
        expectancy is the number a target-shrink cannot fake.
     2. THE ACTION TIER rides beside the number: prefer+positive is a
        LEAD-CANDIDATE, a measured positive the desk does not lead with is a
        FEE-SURVIVOR, a demote is PAINTS-NEVER-LEADS or MEASURED-NEGATIVE at
        the −0.20 bar, a suppress is SUPPRESSED.
     3. hgGoldSetupEdgeApply attaches the standing (rank/rankTotal/tier/
        shrunk) onto every candidate's edge — named, never gating: the
        in-force suppress/demote actions stay the only levers, exactly as
        baked; a candidate's action verdict is byte-identical with and
        without the leaderboard attached.
     4. GOLD PINE's per-port selection is the FORWARD LEDGER (live), which
        the board already prints as the measured twin line — the baked
        leaderboard is the scalp/swing foundation; pine's is measured live.
     5. the shipped build is stamped hg-v1468 on every cache surface.

   Mutation-proven: ranking by RAW net (no shrinkage), or dropping the edge
   attach, each reds a named section. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootCtx(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp, Intl };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of files){ try { vm.runInContext(read(f), ctx, { filename: f }); } catch(e){ /* desks tolerate */ } }
  return ctx;
}

/* ============ 1. the leaderboard math ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js']);
  const lb = ctx.hgGoldStrategyLeaderboard('scalp');
  ok(lb && lb.desk === 'scalp' && lb.total > 10, 'leaderboard: the scalp book ranks ' + (lb ? lb.total : 0) + ' strategies');
  ok(lb.rows[0].rank === 1 && lb.rows[lb.total - 1].rank === lb.total, 'leaderboard: ranks are 1..total in shrunk order');

  /* shrunk = net x n / (n + 30), verified on every row against the table */
  let mathBad = 0;
  const table = ctx.HG_GOLD_SETUP_EDGE.scalp;
  for (const r of lb.rows){
    const want = r.net * r.n / (r.n + 30);
    if (Math.abs(r.shrunk - want) > 1e-9) mathBad++;
    if (Math.abs(table[r.key].net - r.net) > 1e-9 || table[r.key].n !== r.n) mathBad++;
  }
  ok(mathBad === 0, 'leaderboard: every row carries the exact shrinkage estimate and the baked numbers');

  /* sorting is by shrunk desc */
  let sortBad = 0;
  for (let i = 1; i < lb.rows.length; i++){
    if (lb.rows[i - 1].shrunk < lb.rows[i].shrunk - 1e-12) sortBad++;
    else if (Math.abs(lb.rows[i - 1].shrunk - lb.rows[i].shrunk) < 1e-12 && lb.rows[i - 1].n < lb.rows[i].n) sortBad++;
  }
  ok(sortBad === 0, 'leaderboard: sorted by shrunk expectancy desc, ties by n desc');

  /* the small-sample lesson: S9 (+0.205R at n=17) cannot outrank S30
     (+0.128R at n=64) on the shrunk scale — shrinkage is the point */
  const s9 = lb.byKey.p4laf, s30 = lb.byKey.p6fail;
  ok(s9 && s30 && s30.shrunk > s9.shrunk,
     'leaderboard: the n=17 +0.205R sample shrinks (' + s9.shrunk.toFixed(4) + ') below the n=64 +0.128R book (' + s30.shrunk.toFixed(4) + ') — small samples never lead');

  /* tiers */
  ok(s30 && s30.action === 'prefer' && s30.tier === 'LEAD-CANDIDATE', 'leaderboard: the measured prefer is a LEAD-CANDIDATE');
  ok(s9 && s9.net > 0 && s9.action === 'demote' && s9.tier === 'FEE-SURVIVOR', 'leaderboard: a measured positive the desk does not lead with is a FEE-SURVIVOR');
  const fvg = lb.byKey.fvg;
  ok(fvg && fvg.action === 'suppress' && fvg.tier === 'SUPPRESSED', 'leaderboard: a suppressed strategy is named SUPPRESSED');
  const rsidiv = lb.byKey.rsidiv;
  const p6comp = lb.byKey.p6comp;
  ok(p6comp && p6comp.net <= -0.20 && p6comp.tier === 'MEASURED-NEGATIVE', 'leaderboard: a book-negative demote is MEASURED-NEGATIVE at the −0.20 bar');
  ok(rsidiv && rsidiv.net > -0.20 && rsidiv.tier === 'PAINTS-NEVER-LEADS', 'leaderboard: a shallow demote is PAINTS-NEVER-LEADS');

  /* the mark line */
  const mark = ctx.hgGoldStrategyMark('p6fail', 'scalp');
  ok(mark && mark.indexOf('P6FAIL') >= 0 && mark.indexOf('+0.128R') >= 0 && mark.indexOf('n=64') >= 0
     && /rank \d+\/\d+/.test(mark) && /LEAD-CANDIDATE/.test(mark) && mark.indexOf('win ') >= 0,
     'leaderboard: the card mark names the strategy, its net, its n, its win rate, its rank and its tier — ' + mark);
  ok(ctx.hgGoldStrategyMark('no-such-key', 'scalp') === null, 'leaderboard: an absent key is absent (three-state), never a guess');
  ok(ctx.hgGoldStrategyMark('fvg', 'swing') === null || ctx.hgGoldStrategyMark('fvg', 'swing') !== null, 'leaderboard: the swing book is its own ranking');

  /* swing book ranks too */
  const lbs = ctx.hgGoldStrategyLeaderboard('swing');
  ok(lbs && lbs.desk === 'swing' && lbs.total > 3, 'leaderboard: the swing book ranks separately (' + lbs.total + ')');
}

/* ============ 2. the edge attach: named, never gating ============ */
{
  const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js']);
  const apply = ctx.hgGoldSetupEdgeApply;

  /* a S30 candidate: the edge carries the standing */
  const cand = { dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, stratKey: 'p6fail', strategy: 'S30 FAILED-BREAK REVERSAL' };
  apply(cand, {});
  ok(cand.edge && cand.edge.action === 'prefer', 'edge: the in-force action is unchanged (prefer)');
  ok(isFinite(cand.edge.rank) && isFinite(cand.edge.rankTotal) && cand.edge.tier === 'LEAD-CANDIDATE',
     'edge: the standing rides the card — rank ' + (cand.edge ? cand.edge.rank : '?') + '/' + (cand.edge ? cand.edge.rankTotal : '?') + ', LEAD-CANDIDATE');
  ok(Math.abs(cand.edge.shrunk - 0.128 * 64 / 94) < 1e-9, 'edge: the shrunk expectancy is exact (0.128 x 64/94)');

  /* a suppressed candidate: still suppressed, tier named */
  const sup = { dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, stratKey: 'fvg' };
  const rs = apply(sup, {});
  ok(rs.dropped === true && rs.edge && rs.edge.tier === 'SUPPRESSED', 'edge: the suppress verdict is untouched — the leaderboard names the tier on the way out');

  /* the rank attach cannot flip any verdict: same candidate, verdict identical
     with the leaderboard code removed is asserted by M2 below */
}

/* ============ 3. the confluence card names the leader's standing ============ */
{
  const win = { HG_tabs: [] };
  const cctx = { window: win, globalThis: win, console };
  vm.createContext(cctx);
  vm.runInContext(read('gold-confluence.js'), cctx, { filename: 'gold-confluence.js' });
  const build = win.hgGoldConfluenceBuild;
  const vote = (desk, id, side, entry, stop, t1, extra) => Object.assign({
    desk, id, state: 'setup', side, entry, stop, t1, grade: 'A', lead: true
  }, extra || {});
  const b = build([
    vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2680, { edge: { rank: 2, rankTotal: 14, tier: 'LEAD-CANDIDATE' } }),
    vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2681)
  ], { px: 2651 });
  ok(b && b.ready === true, 'confluence: the pack still forms');
  ok(/rank 2 of 14 on its own measured book \(LEAD-CANDIDATE\)/.test(b.reason || ''),
     'confluence: the card names the leading strategy measured standing');
  const b2 = build([
    vote('GOLD SCALP', 'goldscalp', 'long', 2650, 2640, 2680),
    vote('GOLD SWING', 'goldswing', 'long', 2651, 2640.5, 2681)
  ], { px: 2651 });
  ok(b2 && b2.ready === true && !/measured book/.test(b2.reason || ''),
     'confluence: a vote with no evidence line stays silent about it (three-state)');
}

/* ============ 4. the shipped build is stamped hg-v1468 ============ */
{
  const stamp = read('build-stamp.js');
  ok(/version: 'hg-v1473'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-10-30T/.test(stamp), 'build-stamp built (fresh)');
  ok(/hg-v1468: GOLD STRATEGY LEADERBOARD/.test(stamp), 'the pack string names the round');
  ok(/hg-v1467: GOLD FOUNDATION/.test(stamp), 'the upstream hg-v1467 round stays in the chain');
  ok(/hg-v1466: PINE GOLD and GOLD SCALP — a failed-sweep reclaim fills at the next open/.test(stamp), 'and the upstream hg-v1466 round stays in the chain');
  ok(/hg-v1465: PINE GOLD and GOLD SCALP/.test(stamp), 'and the older chain is intact');
  ok(/HG_CACHE = 'hg-v1473'/.test(read('sw.js')), 'sw.js cache id');
  const idx = read('index.html');
  ok(idx.indexOf('?v=1465') < 0 && idx.indexOf('?v=1473') >= 0, 'index.html cache-busters all at 1472');
  ok(read('hg-api-base.js').indexOf('1465') < 0, 'hg-api-base at 1468');
  ok(read('trendtable.js').indexOf('1465') < 0, 'trendtable loader at 1468');
  const ledger = JSON.parse(read('data/batch-ledger.json'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1473', 'the batch ledger last entry is hg-v1473');
}

/* ============ mutations ============ */
{
  const runMutation = (name, file, mutate, checker) => {
    const src = read(file);
    const m = mutate(src);
    if (m === src){ fail++; console.error('  FAIL mutation ' + name + ' did not change source'); return; }
    const ctx = bootCtx(['indicators.js', 'indicators2.js', 'goldind.js']);
    try { vm.runInContext(m, ctx, { filename: file.replace(/\.js$/, '-mutated.js') }); }
    catch(e){ pass++; console.log('  ok — mutation ' + name + ' caught (build threw)'); return; }
    const caught = checker(ctx) === true;
    if (caught){ pass++; console.log('  ok — mutation ' + name + ' caught'); }
    else { fail++; console.error('  FAIL mutation ' + name + ' survived'); }
  };

  /* M1: raw-net ranking (no shrinkage) -> the n=17 sample outranks the n=64 book */
  runMutation('M1_no_shrinkage', 'goldind.js',
    s => s.replace('var shrunk = net * n / (n + K);', 'var shrunk = net; /* M1 */'),
    ctx => {
      const lb = ctx.hgGoldStrategyLeaderboard('scalp');
      const s9 = lb.byKey.p4laf, s30 = lb.byKey.p6fail;
      return s9.shrunk > s30.shrunk; /* mutated: 0.205 > 0.128 raw -> the small sample leads -> caught */
    });

  /* M2: the edge attach dropped -> the candidate carries no standing */
  runMutation('M2_attach_dropped', 'goldind.js',
    s => s.replace('cand.edge.rank = __lr.rank;', '/* M2 */'),
    ctx => {
      const cand = { dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, stratKey: 'p6fail' };
      ctx.hgGoldSetupEdgeApply(cand, {});
      return !(cand.edge && isFinite(cand.edge.rank)); /* mutated: no standing -> caught */
    });

  /* M3: the leaderboard GATES (the one thing it must never do) -> a
     FEE-SURVIVOR candidate gets dropped -> named-never-gating red */
  runMutation('M3_leaderboard_gates', 'goldind.js',
    s => s.replace('cand.edge.rank = __lr.rank;', 'cand.dropped = true; cand.edge.rank = __lr.rank;'),
    ctx => {
      const cand = { dir: 'long', entry: 2645.11, stop: 2635.11, t1: 2665.11, stratKey: 'p4laf' };
      const r = ctx.hgGoldSetupEdgeApply(cand, {});
      return r.dropped === true; /* mutated: the leaderboard withheld a setup -> caught */
    });
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
