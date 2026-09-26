/* HARDGATE — which signal-time read separates winners on OMNIROUTE's own
   replay, measured on four DISJOINT windows and rendered on the desk (hg-v987).

   The standing instruction asks for more crypto indicators and strategies in
   setup formation. This pack asks first whether the reads the desk ALREADY
   scores by carry any out-of-sample information on its own 2,833-trade book —
   the solidity pillars, the solidity gates, HTF alignment, session, cluster,
   conviction, live-price grade, stop width — through the one separation
   method this repo keeps (v984's `separate`, the hg-v920 rule). The answer is
   baked as HG_OMNI_FACTOR_SEP by scripts/omniroute-factor-separation.mjs and
   rendered under the pooled table.

   What this pins:
     - the committed literal equals what the generator derives from the
       committed artifact (zero drift), and the generator's markers are fatal
       when missing
     - the method on synthetic rows: a cohort worse in all four windows on all
       three figures is a VERDICT; worse in three is not; net alone unanimous
       is a LEAN and never a verdict; a cohort that is the whole book is
       DEGENERATE (no complement), not thin; an in-sample factor never enters
       `verdicts`
     - the renderer branches on the verdict list, renders nothing without a
       literal, and the live literal renders the NONE branch today
     - nothing is gated on the literal: it is read by the renderer alone

   Run: node tests/test-omniroute-factor-separation.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';
import { run, literal, splice, factors, pillarInventory, loadRows, BEGIN, END, WINDOWS, MIN_SIDE, ARTIFACT }
  from '../scripts/omniroute-factor-separation.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, Error, Set, Map, setTimeout, clearTimeout, encodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-mechanics.js', 'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

/* synthetic rows: K windows of `per` trades, in the shape the artifact uses.
   `inRate(w)` / `outRate(w)` set the cohort's and complement's win rate per
   window; a win is +2R, a loss -1R, net = gross - 0.1. */
function rows(k, per, inRate, outRate, extra){
  const out = []; let t = Date.UTC(2026, 5, 1);
  for (let w = 0; w < k; w++){
    for (let i = 0; i < per; i++){
      const isIn = i % 2 === 0;
      const rate = isIn ? inRate(w) : outRate(w);
      const win = ((i * 7919 + w * 31) % 100) / 100 < rate;
      const r = { tISO: new Date(t).toISOString(), dir: 'long', outcome: win ? 'target' : 'stop', rMultiple: win ? 2 : -1,
        netR: (win ? 2 : -1) - 0.1, pillarBreakdown: { p1: isIn ? 10 : 0, flat: 4 }, solGates: { families: false, liveFresh: isIn, tape: true, nAgree: 0 },
        solGrade: 'MIXED', tier: 'weak', liveGradeAtSignal: 'fresh', withTrend: false, h1Up: true, dailyUp: true, cluster: false,
        hasConviction: false, stopBand20x: false, stopDistPct: 1.2, session: 'ASIA', kindDemoted: isIn, __in: isIn };
      if (extra) extra(r, w, i, isIn);
      out.push(r); t += 3600 * 1000;
    }
  }
  return out;
}

console.log('1. the committed literal is what the generator derives — zero drift, fatal markers');
{
  const res = run();
  const src = read('omniroute.js');
  ok(src.indexOf(BEGIN) >= 0 && src.indexOf(END) > src.indexOf(BEGIN), 'omniroute.js carries the BEGIN/END markers');
  ok(splice(src, literal(res)) === src, 'HG_OMNI_FACTOR_SEP in omniroute.js equals the generator output on the committed artifact (zero drift)');
  let threw = null; try { splice('nothing here', literal(res)); } catch (e) { threw = e; }
  ok(threw && /BEGIN marker not found/.test(threw.message), 'a missing BEGIN marker is fatal, never skipped');
  threw = null; try { splice(BEGIN + ' x', literal(res)); } catch (e) { threw = e; }
  ok(threw && /END marker not found/.test(threw.message), 'a missing END marker is fatal, never skipped');
  ok(res.n === loadRows().length && res.n > 2000, 'every walked row with a pillar map and a gate map is judged (' + res.n + ')');
  ok(res.windows === WINDOWS && WINDOWS === 4 && MIN_SIDE === 20, 'four disjoint windows, twenty a side — the hg-v920 bars');
  ok(/backtest-omniroute-v701-results\.json$/.test(ARTIFACT), 'the artifact is the v701 walk, the one that stamped every read on every row');
}

console.log('\n2. what the committed artifact says today');
{
  const res = run();
  ok(res.verdicts.length === 0, 'NO out-of-sample read separates on all four windows on win, gross and net (' + res.verdicts.length + ')');
  ok(res.inSampleVerdicts.length === 1 && res.inSampleVerdicts[0] === 'insample:kindDemoted', 'the module own baked demotion does — flagged in-sample, never in `verdicts`');
  const byKey = {}; res.rows.forEach(r => { byKey[r.f] = r; });
  ok(byKey['insample:kindDemoted'].verdict === 'worse' && byKey['insample:kindDemoted'].inSample === true, 'kindDemoted reads WORSE 4/4 and carries the in-sample flag');
  ok(res.leans.length >= 5 && res.leans.indexOf('pillar:momentumConvergence:half') >= 0 && res.leans.indexOf('gate:liveFresh') >= 0, 'the leans are named (' + res.leans.length + '), momentum convergence and live-fresh among them');
  ok(res.leans.indexOf('geom:stopGe2') >= 0 && byKey['geom:stopGe2'].lean === 'better' && byKey['geom:stopGe2'].q.split('/')[0] === '0',
     'stop ≥ 2% leans better on NET while WORSE on win in every window — cost arithmetic, and the row carries both figures so a reader sees it');
  ok(res.starved.length >= 4 && res.starved.indexOf('fvg') >= 0 && res.starved.indexOf('orderFlow') >= 0, 'the pillars the replay could not score are listed as STARVED (' + res.starved.join(', ') + ')');
  ok(res.rows.filter(r => r.degenerate).length >= 3 && res.rows.filter(r => r.degenerate).every(r => r.n === res.n), 'a cohort that is the whole book is DEGENERATE (no complement), never thin, never a verdict');
  ok(res.rows.every(r => !(r.degenerate && (r.verdict || r.lean))), 'a degenerate read carries neither verdict nor lean');
  ok(res.rows.length >= 30, 'the table covers ' + res.rows.length + ' reads');
  const inv = pillarInventory(loadRows());
  ok(inv.varying.length + inv.starved.length === Object.keys(loadRows()[0].pillarBreakdown).length, 'every pillar is either varying or starved — the inventory partitions the map');
}

console.log('\n3. the method, on synthetic rows');
{
  /* worse in all four windows on all three figures -> verdict */
  const R1 = rows(4, 200, () => 0.20, () => 0.45);
  const F = { factors: [{ key: 'x', group: 'test', label: 'x', pick: r => r.__in }] };
  /* run() derives its factors from the rows; drive `separate` through run by
     giving the synthetic rows a pillar that IS the cohort */
  const res1 = run(R1);
  const p1 = res1.rows.find(r => r.f === 'pillar:p1:half');
  ok(p1 && p1.verdict === 'worse' && p1.q === '0/0/0', 'a cohort worse in all four windows on win, gross and net is a VERDICT (worse)');
  ok(res1.verdicts.indexOf('pillar:p1:half') >= 0, 'and it is listed under verdicts');
  ok(res1.rows.find(r => r.f === 'insample:kindDemoted').verdict === 'worse' && res1.verdicts.indexOf('insample:kindDemoted') < 0
     && res1.inSampleVerdicts.indexOf('insample:kindDemoted') >= 0, 'the same cohort under the in-sample key is a verdict that never enters `verdicts`');
  ok(res1.starved.indexOf('flat') >= 0, 'a constant pillar is STARVED');
  /* the windows are cut by SIGNAL TIME: the same rows handed in shuffled give the same answer */
  const shuffled = R1.slice(); for (let i = shuffled.length - 1; i > 0; i--){ const j = (i * 7919) % (i + 1); const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp; }
  ok(JSON.stringify(run(shuffled).rows) === JSON.stringify(res1.rows), 'rows handed in out of order are sorted by signal time before the windows are cut');

  /* worse in three windows, better in the fourth -> no verdict, no lean */
  const R2 = rows(4, 200, w => (w === 3 ? 0.60 : 0.20), () => 0.45);
  const p2 = run(R2).rows.find(r => r.f === 'pillar:p1:half');
  ok(p2 && !p2.verdict && !p2.lean && p2.q === '1/1/1', 'worse in three of four is neither a verdict nor a lean (' + p2.q + ')');

  /* net unanimous while win is not: a LEAN. Wins are worth more here, so a
     cohort with a lower win rate but bigger wins is better on net */
  const R3 = rows(4, 200, () => 0.30, () => 0.36, (r, w, i, isIn) => { if (isIn && r.outcome === 'target'){ r.rMultiple = 6; r.netR = 5.9; } });
  const p3 = run(R3).rows.find(r => r.f === 'pillar:p1:half');
  ok(p3 && !p3.verdict && p3.lean === 'better' && p3.q.split('/')[0] === '0' && p3.q.split('/')[2] === '4', 'net unanimous with win against it is a LEAN, not a verdict (' + p3.q + ')');
  ok(run(R3).leans.indexOf('pillar:p1:half') >= 0 && run(R3).verdicts.length === 0, 'and it is listed under leans, never verdicts');

  /* thin: a window with fewer than 20 a side is not judged, so no verdict */
  const R4 = rows(4, 30, () => 0.20, () => 0.45);
  const p4 = run(R4).rows.find(r => r.f === 'pillar:p1:half');
  ok(p4 && p4.thin === 4 && !p4.verdict && !p4.lean, 'windows under twenty a side are thin — no verdict and no lean can form on them');

  /* degenerate: the cohort is every row */
  /* p1 varies (10 or 6) so it is not starved, yet every row clears half its max (5) */
  const R5 = rows(4, 200, () => 0.20, () => 0.45, r => { r.pillarBreakdown.p1 = r.__in ? 10 : 6; });
  const p5 = run(R5).rows.find(r => r.f === 'pillar:p1:half');
  ok(p5 && p5.degenerate === true && p5.n === R5.length && !p5.verdict, 'a pillar every row clears at half its max has no complement — DEGENERATE');
}

console.log('\n4. the renderer');
{
  const ctx = boot();
  ok(typeof ctx.hgOmniFactorSepHtml === 'function' && ctx.HG_OMNI_FACTOR_SEP && Array.isArray(ctx.HG_OMNI_FACTOR_SEP.rows), 'renderer and literal are exported');
  const html = ctx.hgOmniFactorSepHtml();
  ok(/WHICH READS SEPARATE · 4 disjoint windows · 2833 walked trades/.test(html), 'the live literal renders its header');
  ok(/NONE of the \d+ signal-time reads this desk scores by separates/.test(html), 'today it renders the NONE branch');
  ok(/fitted on this window/.test(html) && /insample:kindDemoted/.test(html), 'and names the in-sample demotion as no confirmation');
  ok(/LEANS/.test(html) && /pillar:momentumConvergence:half better/.test(html), 'the leans are printed as leans');
  ok(/STARVED/.test(html) && /orderFlow/.test(html), 'the starved pillars are printed as unmeasured');
  ok(/no complement/.test(html), 'a degenerate read prints "no complement"');
  ok(/as-recorded only/.test(html), 'the single fill bound is said on the panel');
  ok(ctx.hgOmniFactorSepHtml(null) === '' && ctx.hgOmniFactorSepHtml({ rows: [] }) === '', 'no literal, no panel — nothing is invented');
  /* the verdict branch: a synthetic literal with one verdict announces it and says it gates nothing */
  const T = JSON.parse(JSON.stringify(ctx.HG_OMNI_FACTOR_SEP));
  T.rows[0].verdict = 'better'; T.rows[0].lean = undefined; T.verdicts = [T.rows[0].f];
  const h2 = ctx.hgOmniFactorSepHtml(T);
  ok(/VERDICT:/.test(h2) && new RegExp(T.rows[0].f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' is unanimously <b>BETTER<\/b>').test(h2), 'a future bake that finds a verdict announces it');
  ok(/nothing on this desk is wired to it/.test(h2) && !/NONE of the/.test(h2), 'and says it is a measurement, not a gate — the NONE branch is gone');
}

console.log('\n5. nothing is gated on it, and the panel is wired where the forward panel is');
{
  const src = read('omniroute.js');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const codeReads = (code.match(/\bHG_OMNI_FACTOR_SEP\b/g) || []).length;
  /* the declaration, the renderer's default argument, the export line
     (which names it twice: window.X = X) and — since hg-v989 — the read-mark
     builder that marks the reads the literal names on every forward record:
     five, and nothing else */
  ok(codeReads === 5, 'in code it appears exactly five times: declaration, renderer default, both sides of the export, and the hg-v989 read-mark builder (' + codeReads + ') — nothing else reads it');
  ok(/T = \(T === undefined\) \? HG_OMNI_FACTOR_SEP : T;/.test(code) && /window\.HG_OMNI_FACTOR_SEP = HG_OMNI_FACTOR_SEP;/.test(code) && /function hgOmniReadMarks\(c, livePx\)\{\s*try \{\s*var T = HG_OMNI_FACTOR_SEP;/.test(code), 'and those are the reads: the renderer default, the export, and the read-mark builder');
  ok(/renderPooled\(res\.pooled\) \+ fwdPanel \+ factorSepPanel;/.test(src), 'the panel is appended under the pooled table after the forward panel (textual, and says so: the pool line lives inside runScan)');
  ok(/try \{ factorSepPanel = hgOmniFactorSepHtml\(\) \|\| ''; \} catch \(eFs\) \{ factorSepPanel = ''; \}/.test(src), 'a panel failure degrades to nothing, never a blank pool');
  ok(!/HG_OMNI_FACTOR_SEP/.test(read('hg-solidity.js')) && !/HG_OMNI_FACTOR_SEP/.test(read('hg-gates.js')), 'no gate module reads it');
}

console.log('\n6. version stamps');
{
  const stamp = read('build-stamp.js');
  const v = (stamp.match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v), 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed');
