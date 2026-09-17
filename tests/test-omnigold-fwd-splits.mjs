/* HARDGATE — four measurements were being taken and none of them could be
   read.

   hgFwdStatsOf has returned byGrade, byStack, byBal and byDir on every
   call. Grepping every consumer of hgFwdStats across the app: not one of
   the four was read anywhere outside hg-forward.js. They were computed on
   every scan and discarded.

   That is worst for byBal. hg-v763 shipped it under the heading "the desk
   has ranked its gold cards since it was written and never checked the
   ranking" — and then left the answer reachable only from a browser
   console, which is not checking it either. byDir (hg-v765) landed in the
   same drawer a version later. Two commits that claimed to make something
   answerable, and the answer was never on screen.

   WHAT THE PANEL HAS TO GET RIGHT, and what this file pins:

     it reads the GATE-CLEAR population, because that is what the desk
     judges on and the only one still growing while no ticket issues;

     an empty bucket prints a dash and NEVER a rate — zero settled is
     unknown, not 0%;

     with nothing settled at all it says so in a sentence, rather than
     drawing a grid of dashes that looks like a measurement;

     it can report AGAINST the desk. A ranking that is backwards has to be
     able to say so in the copy, or the panel is decoration;

     and it decides nothing. No gate, no weight, no ordering reads these
     buckets.

   Run: node tests/test-omnigold-fwd-splits.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

function boot(){
  const store = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
                Float64Array, setTimeout: () => 0, clearTimeout: () => {},
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } } };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                     querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                   'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

/* geometry must match the side or hgFwdNormalize rejects the record */
const geo = d => (d === 'short') ? { entry: 4700, stop: 4730, t1: 4640 }
                                 : { entry: 4700, stop: 4670, t1: 4760 };
function seed(ctx, rows){
  const N = ctx.hgFwdNormalize, out = [];
  rows.forEach((o, i) => {
    const r = N(Object.assign({ tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h',
      horizonBars: 24, barT: 1700000000 + i * 3600, dir: o.dir, balScore: o.bal,
      grade: o.grade, stack3: o.stack }, geo(o.dir)));
    if (!r) throw new Error('fixture row ' + i + ' was rejected by hgFwdNormalize');
    r.state = o.state; r.gateClear = true; out.push(r);
  });
  ctx.localStorage.setItem('hg_forward_v1', JSON.stringify(out));
  return out;
}
const text = h => String(h || '').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ');

const OG = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const FWD = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');

console.log('== a bucket with nothing in it is a dash, never a rate ==');
{
  const ctx = boot();
  const B = ctx.hgOgFwdBucketTxt, be = 1 / 3;
  ok(B({ n: 0, w: 0 }, be) === '—', 'zero settled is a dash');
  ok(B(null, be) === '—', 'a missing bucket is a dash');
  ok(B(undefined, be) === '—', 'and so is an absent one — never 0%');
  ok(B({ n: 4, w: 0 }, be) === '4 · 0%', 'but four losses IS 0%, and says so');
  ok(/✓/.test(B({ n: 4, w: 3 }, be)), 'a bucket above breakeven is ticked');
  ok(!/✓/.test(B({ n: 3, w: 1 }, be)),
     'a bucket sitting EXACTLY on breakeven is not — it made nothing, and a tick would read as a result');
  ok(!/✓/.test(B({ n: 4, w: 1 }, be)), 'and one below is not');
}

console.log('\n== an empty log says so, instead of drawing a grid of dashes ==');
{
  const ctx = boot();
  const t = text(ctx.hgOgFwdSplitsPanelHtml());
  ok(t !== '', 'the panel renders');
  ok(/Nothing has settled yet/.test(t), 'and says nothing has settled');
  ok(/genuinely unknown rather than neutral/.test(t), 'naming the difference that matters');
  ok(!/BY RANK|BY DIRECTION/.test(t), 'with no bucket rows at all');
  ok(!/—.*—.*—/.test(t), 'so a reader never sees a row of dashes that looks like a measurement');
  ok(!/NaN|undefined/.test(t), 'and nothing leaks');
}

console.log('\n== with records, all four splits reach the screen ==');
{
  const ctx = boot();
  seed(ctx, [
    { dir: 'long',  bal: 150, state: 'stop', grade: 'A', stack: 3 },
    { dir: 'long',  bal: 140, state: 'stop', grade: 'A', stack: 3 },
    { dir: 'long',  bal: 120, state: 't1',   grade: 'B', stack: 2 },
    { dir: 'short', bal: -20, state: 't1',   grade: 'B', stack: 1 },
    { dir: 'short', bal: -40, state: 't1',   grade: 'C', stack: 1 },
    { dir: 'short', bal: 50,  state: 'stop', grade: 'C', stack: 2 }
  ]);
  const t = text(ctx.hgOgFwdSplitsPanelHtml());

  ok(/BY RANK/.test(t), 'the ranking split is on screen — v763\'s deliverable, finally readable');
  ok(/BY DIRECTION/.test(t), 'the direction split too — v765\'s');
  ok(/BY GRADE/.test(t), 'the engine grade split');
  ok(/BY GATE STACK/.test(t), 'and the gate stack split');

  ok(/top 3 · 33%/.test(t), 'the top rank bucket carries its three settled records');
  ok(/low 2 · 100%/.test(t), 'and the bottom bucket its two');
  ok(/long 3 · 33%/.test(t) && /short 3 · 67%/.test(t), 'both sides are counted separately');
  ok(/1 gate 2/.test(t) && /2 gates 2/.test(t), 'and the stack buckets read as English, not "1 gates"');

  ok(/Breakeven is 33% at 2R/.test(t), 'the bar every rate is read against is stated');
  ok(!/NaN|undefined/.test(t), 'with nothing leaked');
}

console.log('\n== it can report against the desk, which is the whole point ==');
{
  /* top-ranked cards lose, bottom-ranked cards win. If the panel cannot
     say that, it is decoration. */
  const ctx = boot();
  seed(ctx, [
    { dir: 'long',  bal: 150, state: 'stop', grade: 'A', stack: 3 },
    { dir: 'long',  bal: 140, state: 'stop', grade: 'A', stack: 3 },
    { dir: 'long',  bal: 120, state: 't1',   grade: 'B', stack: 2 },
    { dir: 'short', bal: -20, state: 't1',   grade: 'B', stack: 1 },
    { dir: 'short', bal: -40, state: 't1',   grade: 'C', stack: 1 },
    { dir: 'short', bal: 50,  state: 'stop', grade: 'C', stack: 2 }
  ]);
  const t = text(ctx.hgOgFwdSplitsPanelHtml());
  ok(/BACKWARDS so far/.test(t), 'it says the ordering is backwards when it is');
  ok(/top 33% against bottom 100%/.test(t), 'and quotes both sides of that claim');
  ok(/Too few to conclude/.test(t), 'while refusing to conclude on six records');
  ok(/until each bucket carries 20/.test(t), 'and naming what would be enough');
}

console.log('\n== and holding, when it holds ==');
{
  const ctx = boot();
  seed(ctx, [
    { dir: 'long',  bal: 150, state: 't1',   grade: 'A', stack: 3 },
    { dir: 'long',  bal: 140, state: 't1',   grade: 'A', stack: 3 },
    { dir: 'short', bal: -40, state: 'stop', grade: 'C', stack: 1 },
    { dir: 'short', bal: -50, state: 'stop', grade: 'C', stack: 1 }
  ]);
  const t = text(ctx.hgOgFwdSplitsPanelHtml());
  ok(/holding so far/.test(t), 'the same copy reports in the desk\'s favour when the data does');
  ok(!/BACKWARDS/.test(t), 'and does not hedge it into a complaint');
}

console.log('\n== the panel is wired in, and decides nothing ==');
{
  ok(/\+ hgOgFwdSplitsPanelHtml\(\)/.test(OG), 'it is rendered, not merely defined');
  ok(/gateClear: true/.test(OG), 'off the gate-clear population');

  /* REPORTING, NOT DECIDING. The buckets must not be read by anything that
     ranks, filters or weights — the same line this desk has held since the
     stop floor was found fitted to one end of an interval. */
  const body = OG.replace(/\/\*[\s\S]*?\*\//g, '');   /* prose may discuss them */
  const reads = (body.match(/\.byBal|\.byStack|\.byGrade|\.byDir/g) || []).length;
  const inPanel = (body.match(/st\.byBal|st\.byStack|st\.byGrade|st\.byDir/g) || []).length;
  ok(reads === inPanel && reads > 0,
     `every read of the four splits is the panel's own (${reads})`);
  ok(/100 \* tapeScore/.test(OG) && /120 \* ticketN/.test(OG), 'every ranker weight is as it was');

  /* the ranker's OWN body, bounded at the next top-level function, not
     everything after it — which would sweep in the panel itself */
  const after = body.split('function hgOgBalanceParts')[1] || '';
  const rankerBody = after.split(/\n  function /)[0];
  ok(rankerBody.length > 200, 'the ranker body was actually isolated');
  ok(!/byBal|byDir|byGrade|byStack/.test(rankerBody),
     'and it reads none of the four splits — the ordering is not tuned on them');
}

console.log('\n== hg-forward still owns the arithmetic ==');
{
  ok(/byGrade: byGrade, byStack: byStack, byBal: byBal, byDir: byDir/.test(FWD),
     'all four are returned from one place');
  /* scorecard.js carries its own unrelated st.byDir, built from the trade
     journal with a different shape (.winRate/.avgR, not .n/.w). The two
     never meet — scorecard never calls hgFwdStats — so this is a name
     collision and not a bug, pinned here so it stays one. */
  const SC = fs.readFileSync(path.join(ROOT, 'scorecard.js'), 'utf8');
  ok(/byDir/.test(SC), 'scorecard has a byDir of its own');
  ok(!/hgFwdStats/.test(SC),
     'but never consumes hgFwdStats, so the two shapes cannot be confused at runtime');
}

console.log('\n' + passed + ' passed, 0 failed');
