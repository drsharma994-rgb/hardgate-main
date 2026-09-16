#!/usr/bin/env node
/* HARDGATE — does the market-geometry flag predict anything?
   ==========================================================

   hgPlanMarketGeometry says a published plan can be dead on arrival two
   ways: the stop is already breached, or T1 sits between the mark and the
   entry so the retest crosses the target before the fill. Every desk in
   this app now renders that verdict. This script asks the only question
   that makes it worth its space: DOES A FLAGGED PLAN DO WORSE?

   A gate you cannot measure is a decoration. The rule is cheap and the
   card is honest either way, but "cheap and honest" is not the same as
   "predictive", and until this script prints a number nobody should claim
   it is.

   WHAT IT READS
   -------------
   Every scripts/backtest-*-results.json in the repo. Each is a settled
   walk: one row per published plan, with entry / stop / t1 and what
   actually happened to it.

   TWO GRADES OF ANSWER
   --------------------
   EXACT      the row carries markAtFire, so the full rule runs and both
              codes are decidable. Added to the emitters in this change;
              artifacts produced before it do not have it.
   PARTIAL    the row carries only orderType. That is derived from
              xmOrderType(dir, entry, mark), so it recovers the RETEST side
              exactly — LIMIT means price must still travel to the entry,
              STOP means it has already passed it — but not where T1 sits
              relative to the mark. Retest is a NECESSARY condition for
              target-crossed, so the partial answer is an upper bound on
              prevalence and an outcome split over the population the
              defect lives in. It is not the measurement; it is what is
              left when the mark was never written down.

   Rows with neither are counted as unjudgeable and excluded from every
   rate, never quietly folded into the pass side.

   Run: node scripts/geometry-audit.mjs [--json]
*/
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const JSON_OUT = process.argv.includes('--json');

/* the real rule, loaded from the app — not a copy */
const ctx = { console, Math, isFinite, isNaN, parseFloat, Number, String, Object, Array, JSON };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'plans.js', 'hg-plan.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const geometry = ctx.hgPlanMarketGeometry;
if (typeof geometry !== 'function'){
  console.error('hgPlanMarketGeometry did not load — nothing to audit.');
  process.exit(1);
}

/* ---------------------------------------------------------------- */

const num = v => { const n = +v; return isFinite(n) ? n : NaN; };

/* LIMIT means the entry is a price still to be travelled to; STOP means
   price has already gone past it. That IS the retest test, recovered. */
function retestFromOrderType(name){
  const n = String(name || '').toUpperCase().replace(/[\s-]/g, '_');
  if (n === 'BUY_LIMIT' || n === 'SELL_LIMIT') return true;
  if (n === 'BUY_STOP' || n === 'SELL_STOP') return false;
  if (n === 'BUY' || n === 'SELL') return false;   /* at the mark, within 3bp */
  return null;
}

/* win / loss / neither, from the vocabulary these walks use */
function outcomeOf(row){
  const o = String(row.outcome || row.state || '').toLowerCase();
  if (o.startsWith('win') || o === 't1' || o === 't2') return 'win';
  if (o.startsWith('loss') || o === 'stop') return 'loss';
  if (o.startsWith('unfilled')) return 'unfilled';
  if (o.startsWith('timeout') || o.startsWith('expire')) return 'timeout';
  return 'other';
}

function emptyBucket(){
  return { n: 0, win: 0, loss: 0, unfilled: 0, timeout: 0, other: 0, rSum: 0, rN: 0 };
}
function addTo(b, row){
  b.n++;
  b[outcomeOf(row)]++;
  /* net of the venue-true round trip where the walk recorded one, gross
     otherwise — stated rather than silently mixed */
  const r = num(row.netR != null ? row.netR : row.rGross);
  if (isFinite(r)){ b.rSum += r; b.rN++; }
}
const winRate = b => (b.win + b.loss) > 0 ? b.win / (b.win + b.loss) : NaN;
const avgR = b => b.rN > 0 ? b.rSum / b.rN : NaN;

/* Wilson 95%, the same interval the desks quote */
function wilson(k, n){
  if (!(n > 0)) return null;
  const z = 1.959964, p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d) };
}

/* ---------------------------------------------------------------- */

const files = fs.readdirSync(path.join(ROOT, 'scripts'))
  .filter(f => /^backtest-.*results.*\.json$/.test(f))
  .filter(f => !/smoke/.test(f))          /* smoke runs are 700 bars, not evidence */
  .sort();

const report = { generatedAt: new Date().toISOString(), desks: [], totals: null };
let anyExact = false;

for (const file of files){
  let j;
  try{ j = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', file), 'utf8')); }
  catch(e){ continue; }
  const rows = j.trades || j.rows || j.results || [];
  if (!Array.isArray(rows) || !rows.length) continue;

  const desk = {
    file, n: rows.length, grade: 'none',
    exact: { flagged: emptyBucket(), clean: emptyBucket(),
             stopBreached: 0, targetCrossed: 0, unjudgeable: 0 },
    partial: { retest: emptyBucket(), noRetest: emptyBucket(), unjudgeable: 0 }
  };

  for (const row of rows){
    const dir = String(row.dir || row.side || '').toLowerCase();
    const plan = { dir, entry: num(row.entry), stop: num(row.stop), t1: num(row.t1) };
    const mark = num(row.markAtFire != null ? row.markAtFire : row.mark);

    if (isFinite(mark) && mark > 0){
      const g = geometry(plan, mark);
      if (!g){ desk.exact.unjudgeable++; }
      else if (g.ok){ addTo(desk.exact.clean, row); }
      else {
        addTo(desk.exact.flagged, row);
        if (g.code === 'stop-breached') desk.exact.stopBreached++;
        else desk.exact.targetCrossed++;
      }
    } else {
      desk.exact.unjudgeable++;
    }

    const retest = retestFromOrderType(row.orderType);
    if (retest === null) desk.partial.unjudgeable++;
    else addTo(retest ? desk.partial.retest : desk.partial.noRetest, row);
  }

  const exactN = desk.exact.flagged.n + desk.exact.clean.n;
  desk.grade = exactN > 0 ? 'exact' : (desk.partial.retest.n + desk.partial.noRetest.n > 0 ? 'partial' : 'none');
  if (exactN > 0) anyExact = true;
  report.desks.push(desk);
}

/* ---------------------------------------------------------------- */

if (JSON_OUT){
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const pct = v => isFinite(v) ? (v * 100).toFixed(1) + '%' : '—';
const r2 = v => isFinite(v) ? (v >= 0 ? '+' : '') + v.toFixed(3) + 'R' : '—';

console.log('MARKET-GEOMETRY AUDIT — does a dead-on-arrival plan do worse?');
console.log('=============================================================\n');

if (!report.desks.length){
  console.log('No settled backtest artifacts found. Nothing measured, nothing claimed.');
  process.exit(0);
}

const tot = { retest: emptyBucket(), noRetest: emptyBucket(),
              flagged: emptyBucket(), clean: emptyBucket(),
              stopBreached: 0, targetCrossed: 0 };
const merge = (a, b) => {
  a.n += b.n; a.win += b.win; a.loss += b.loss; a.unfilled += b.unfilled;
  a.timeout += b.timeout; a.other += b.other; a.rSum += b.rSum; a.rN += b.rN;
};

for (const d of report.desks){
  merge(tot.retest, d.partial.retest);
  merge(tot.noRetest, d.partial.noRetest);
  merge(tot.flagged, d.exact.flagged);
  merge(tot.clean, d.exact.clean);
  tot.stopBreached += d.exact.stopBreached;
  tot.targetCrossed += d.exact.targetCrossed;

  const p = d.partial;
  console.log(d.file.replace(/^backtest-|-results.*\.json$/g, '') + '  (' + d.n + ' published plans, ' + d.grade + ')');
  if (d.grade === 'exact'){
    console.log('   FLAGGED dead on arrival : ' + d.exact.flagged.n
      + '  (' + d.exact.stopBreached + ' stop-breached, ' + d.exact.targetCrossed + ' target-crossed)'
      + '   win ' + pct(winRate(d.exact.flagged)) + '   ' + r2(avgR(d.exact.flagged)));
    console.log('   passed the rule        : ' + d.exact.clean.n
      + '   win ' + pct(winRate(d.exact.clean)) + '   ' + r2(avgR(d.exact.clean)));
  }
  console.log('   retest entries (LIMIT)  : ' + p.retest.n
    + '   win ' + pct(winRate(p.retest)) + '   ' + r2(avgR(p.retest))
    + '   unfilled ' + p.retest.unfilled);
  console.log('   already past (STOP/MKT) : ' + p.noRetest.n
    + '   win ' + pct(winRate(p.noRetest)) + '   ' + r2(avgR(p.noRetest))
    + '   unfilled ' + p.noRetest.unfilled);
  if (p.unjudgeable) console.log('   unjudgeable             : ' + p.unjudgeable + ' (no order type recorded)');
  console.log('');
}

console.log('-------------------------------------------------------------');
console.log('WHOLE BOOK\n');

if (anyExact){
  const fW = winRate(tot.flagged), cW = winRate(tot.clean);
  console.log('  EXACT — rows carrying the mark at fire');
  console.log('    flagged dead on arrival : ' + tot.flagged.n
    + '  (' + tot.stopBreached + ' stop-breached, ' + tot.targetCrossed + ' target-crossed)');
  console.log('      win ' + pct(fW) + '   ' + r2(avgR(tot.flagged)));
  console.log('    passed                  : ' + tot.clean.n + '   win ' + pct(cW) + '   ' + r2(avgR(tot.clean)));
  const ci = wilson(tot.flagged.win, tot.flagged.win + tot.flagged.loss);
  if (ci) console.log('    flagged win Wilson 95%  : ' + pct(ci.lo) + ' – ' + pct(ci.hi));
  if (isFinite(fW) && isFinite(cW)){
    console.log('    VERDICT: flagged plans win ' + ((fW - cW) * 100).toFixed(1)
      + ' points ' + (fW < cW ? 'LESS' : 'MORE') + ' than plans that pass.');
    if (ci && ci.hi >= cW && ci.lo <= cW)
      console.log('             That gap sits INSIDE the flagged interval — not yet a measured edge.');
  }
} else {
  console.log('  EXACT — nothing to report.');
  console.log('    No settled artifact in this repo carries the mark it was');
  console.log('    published against. The emitters record markAtFire as of this');
  console.log('    change, so the next full backtest run answers this properly.');
  console.log('    Re-run e.g.  node scripts/backtest-goldswing.mjs  then this script.');
}

console.log('\n  PARTIAL — the retest side, recovered exactly from order type');
const rW = winRate(tot.retest), nW = winRate(tot.noRetest);
console.log('    retest entries (LIMIT)  : ' + tot.retest.n + '   win ' + pct(rW)
  + '   ' + r2(avgR(tot.retest)) + '   unfilled ' + tot.retest.unfilled);
console.log('    already past (STOP/MKT) : ' + tot.noRetest.n + '   win ' + pct(nW)
  + '   ' + r2(avgR(tot.noRetest)) + '   unfilled ' + tot.noRetest.unfilled);
const share = (tot.retest.n + tot.noRetest.n) > 0 ? tot.retest.n / (tot.retest.n + tot.noRetest.n) : NaN;
console.log('    at most ' + pct(share) + ' of published plans could be target-crossed:');
console.log('    a retest is NECESSARY for it, so this is a ceiling, not a count.');
if (isFinite(rW) && isFinite(nW)){
  console.log('    retest entries win ' + ((rW - nW) * 100).toFixed(1) + ' points '
    + (rW < nW ? 'LESS' : 'MORE') + ' than entries price has already passed.');
  /* A gap this size on ~8k a side needs a number, not an adjective: two
     proportions, pooled z. Settled trades only — unfilled is neither a win
     nor a loss and folding it either way would invent the answer. */
  const n1 = tot.retest.win + tot.retest.loss, n2 = tot.noRetest.win + tot.noRetest.loss;
  if (n1 > 0 && n2 > 0){
    const pPool = (tot.retest.win + tot.noRetest.win) / (n1 + n2);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
    const z = se > 0 ? (rW - nW) / se : NaN;
    /* difference CI uses the UNpooled standard error */
    const seD = Math.sqrt(rW * (1 - rW) / n1 + nW * (1 - nW) / n2);
    const d = rW - nW, lo = d - 1.959964 * seD, hi = d + 1.959964 * seD;
    console.log('    two-proportion z = ' + (isFinite(z) ? z.toFixed(2) : '—')
      + ' on ' + n1 + ' vs ' + n2 + ' settled');
    console.log('    difference 95% CI : ' + (lo * 100).toFixed(1) + ' to ' + (hi * 100).toFixed(1) + ' points');
    console.log('    ' + ((lo < 0 && hi < 0) || (lo > 0 && hi > 0)
      ? 'The interval excludes zero: the retest population really is the worse one.'
      : 'The interval spans zero: no separation worth acting on.'));
  }
  console.log('    UNFILLED, stated rather than buried: ' + tot.retest.unfilled + ' of the retest');
  console.log('    plans never filled at all, against ' + tot.noRetest.unfilled + ' of the others.');
  console.log('    Those are excluded from every win rate above — an order that');
  console.log('    never filled is not a loss, and counting it as one would be');
  console.log('    the easiest way to manufacture this result.');
  console.log('');
  console.log('    WHAT THIS DOES NOT SHOW. The retest population is EVERY limit');
  console.log('    entry, and target-crossed plans are a subset of it. A limit');
  console.log('    order fills only when price comes back to you, which is often');
  console.log('    a move failing — adverse selection alone predicts a worse win');
  console.log('    rate across the whole population, with no help from geometry.');
  console.log('    So this bounds the defect; it does not isolate it. Only the');
  console.log('    EXACT section can, and that needs markAtFire on a settled walk.');
}

const noOrderType = report.desks.filter(d => d.grade === 'none');
if (noOrderType.length){
  console.log('\n  NOT MEASURABLE from what these walks wrote down:');
  for (const d of noOrderType){
    console.log('    ' + d.file.replace(/^backtest-|-results.*\.json$/g, '') + ' — ' + d.n
      + ' plans, no order type and no mark recorded');
  }
}
console.log('\n  A gate that changes nothing is a decoration. Print this before');
console.log('  claiming the geometry rule earns its place on the card.');
