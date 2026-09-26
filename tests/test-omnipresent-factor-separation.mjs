/* HARDGATE — which signal-time read separates winners on OMNIPRESENT's own
   replay, measured on four DISJOINT windows and rendered on the desk (hg-v988).

   OMNIPRESENT tickets only a TRIGGERED zone that clears two HARD gates —
   confluence >= 3 zone sources and >= 2 exhaustion reads (hg-v421) — and its
   replay stamped both verdicts, the sources, the evidence, the distance, the
   score and the cost on 8,502 walked trades. This asks each read, through
   the ONE core hg-v988 extracted (scripts/factor-sep-core.mjs), whether it
   separates winners out of sample, bakes the answer as HG_OP_FACTOR_SEP and
   renders it through OMNIROUTE's one renderer.

   What this pins:
     - zero drift between the committed literal and the generator; fatal markers
     - the inventory is DERIVED from the rows: every zone source and every
       exhaustion family the replay read is a factor, the "stretched ±N×ATR"
       strings collapse to one family, and the sessions partition the rows
     - what the artifact says today: one out-of-sample verdict (the
       'stretched' exhaustion read is WORSE 4/4), the desk's own hard gates
       carry no verdict, and the leans are named as leans
     - the render: OMNIROUTE's renderer paints the VERDICT branch for this
       literal; with omniroute.js absent the desk renders nothing; the panel
       is appended on both card paths; the literal is read by nothing else
     - the OMNIROUTE generator still round-trips through the core (zero drift)

   Run: node tests/test-omnipresent-factor-separation.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';
import { run, literal, splice, factors, inventory, loadRows, BEGIN, END, WINDOWS, MIN_SIDE, ARTIFACT }
  from '../scripts/omnipresent-factor-separation.mjs';
import { run as omniRun, literal as omniLiteral, splice as omniSplice } from '../scripts/omniroute-factor-separation.mjs';
import { runFactors } from '../scripts/factor-sep-core.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(files){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, Error, TypeError, Set, Map, setTimeout, clearTimeout, encodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}
const FULL = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-mechanics.js', 'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js', 'omnigold.js', 'omnipresent.js'];

console.log('1. zero drift, fatal markers, on both desks');
{
  const res = run();
  const src = read('omnipresent.js');
  ok(src.indexOf(BEGIN) >= 0 && src.indexOf(END) > src.indexOf(BEGIN), 'omnipresent.js carries the BEGIN/END markers');
  ok(splice(src, literal(res)) === src, 'HG_OP_FACTOR_SEP equals the generator output on the committed artifact (zero drift)');
  let threw = null; try { splice('x', literal(res)); } catch (e) { threw = e; }
  ok(threw && /BEGIN marker not found in omnipresent\.js/.test(threw.message), 'a missing marker is fatal and names the file');
  ok(/backtest-omnipresent-results\.json$/.test(ARTIFACT) && res.n === loadRows().length && res.n > 8000, 'every walked row with sources and evidence is judged (' + res.n + ')');
  ok(res.windows === WINDOWS && WINDOWS === 4 && MIN_SIDE === 20, 'four disjoint windows, twenty a side — the core bars');
  const osrc = read('omniroute.js');
  ok(omniSplice(osrc, omniLiteral(omniRun())) === osrc, 'the OMNIROUTE generator, now a config over the core, still round-trips to zero drift');
}

console.log('\n2. the inventory is derived from the rows');
{
  const rows = loadRows();
  const inv = inventory(rows);
  ok(inv.srcs.length >= 9 && inv.srcs.indexOf('round number') >= 0 && inv.srcs.indexOf('value-area low') >= 0, 'every zone source the replay clustered is a factor (' + inv.srcs.length + ')');
  ok(inv.evs.indexOf('stretched') >= 0 && !inv.evs.some(e => /stretched [-+]/.test(e)), 'the "stretched ±N×ATR" evidence strings collapse to ONE family');
  ok(inv.evs.indexOf('volume climax') >= 0 && inv.evs.indexOf('bullish RSI divergence') >= 0 && inv.evs.indexOf('squeeze released this bar') >= 0, 'the other evidence families are named as the replay wrote them');
  const stretchedRows = rows.filter(r => r.evidence.some(e => /^stretched/.test(e)));
  const F = factors(rows).factors;
  const fStretched = F.find(f => f.key === 'ev:stretched');
  ok(fStretched && rows.filter(fStretched.pick).length === stretchedRows.length && stretchedRows.length > 500, 'the stretched factor picks exactly the rows carrying any stretched read (' + stretchedRows.length + ')');
  const sessions = F.filter(f => f.group === 'session');
  ok(sessions.length === 5 && rows.every(r => sessions.filter(f => f.pick(r)).length === 1), 'the five UTC sessions partition every row (exactly one each)');
  /* a synthetic row set with a source the replay never had adds a factor */
  const synth = rows.slice(0, 50).map(r => Object.assign({}, r, { srcs: r.srcs.concat(['weekly open']) }));
  ok(factors(synth).factors.some(f => f.key === 'src:weekly open'), 'a re-bake that clusters a new source adds a row without an edit here');
  ok(F.some(f => f.key === 'geom:costGe012'), 'the cost ceiling in force (0.12R, hg-v607) is measured as a read');
}

console.log('\n3. what the committed artifact says today');
{
  const res = run();
  const byKey = {}; res.rows.forEach(r => { byKey[r.f] = r; });
  ok(res.verdicts.length === 1 && res.verdicts[0] === 'ev:stretched', 'ONE out-of-sample verdict: the stretched exhaustion read (' + res.verdicts.join(',') + ')');
  const st = byKey['ev:stretched'];
  ok(st.verdict === 'worse' && st.q === '0/0/0' && st.n > 500 && st.win < st.outWin && st.net < st.outNet, 'stretched-from-EMA21 is WORSE in all four windows on win, gross and net (n=' + st.n + ', net ' + st.net + ' vs ' + st.outNet + ')');
  ok(!byKey['gate:confluence3'].verdict && !byKey['gate:evidence2'].verdict && !byKey['gate:both'].verdict, 'neither hard gate, nor the ticket population, carries a verdict');
  ok(byKey['gate:confluence3'].lean === 'better' && byKey['gate:confluence3'].q.split('/')[2] === '4', 'the confluence gate leans better on net alone');
  ok(!byKey['gate:evidence2'].lean && byKey['gate:evidence2'].q === '1/1/1', 'the evidence gate is worse in three of four on all three figures — not a lean, not a verdict, and not the direction the gate assumes (' + byKey['gate:evidence2'].q + ')');
  ok(res.leans.length >= 6 && res.leans.indexOf('geom:costGe012') >= 0 && byKey['geom:costGe012'].lean === 'worse' && byKey['geom:costGe012'].q.split('/')[0] === '3',
     'the cost ceiling in force leans worse on net while better on win in three windows — cost arithmetic, said on the row');
  ok(res.inSampleVerdicts.length === 0, 'this desk bakes no in-sample verdict');
  ok(!res.rows.some(r => r.degenerate), 'no read is degenerate on this book');
  ok(Array.isArray(res.sources) && Array.isArray(res.evidenceKinds) && /ambiguity flag/.test(res.bound), 'the literal names the sources, the evidence kinds and the single fill bound');
}

console.log('\n4. the core, on synthetic rows (the second desk through the same rule)');
{
  function rows(k, per, inRate){
    const out = []; let t = Date.UTC(2026, 5, 1);
    for (let w = 0; w < k; w++) for (let i = 0; i < per; i++){
      const isIn = i % 2 === 0; const rate = isIn ? inRate(w) : 0.45;
      const win = ((i * 7919 + w * 31) % 100) / 100 < rate;
      out.push({ tISO: new Date(t).toISOString(), dir: 'long', outcome: win ? 'target' : 'stop', rMultiple: win ? 2 : -1, netR: (win ? 2 : -1) - 0.1, __in: isIn });
      t += 3600 * 1000;
    }
    return out;
  }
  const F = [{ key: 'x', group: 't', label: 'x', pick: r => r.__in }, { key: 'y', group: 't', label: 'y', pick: r => r.__in, inSample: true }];
  const R1 = runFactors(rows(4, 200, () => 0.2), F);
  ok(R1.rows[0].verdict === 'worse' && R1.verdicts.length === 1 && R1.verdicts[0] === 'x', 'worse in all four on all three: a VERDICT');
  ok(R1.inSampleVerdicts.length === 1 && R1.inSampleVerdicts[0] === 'y' && R1.verdicts.indexOf('y') < 0, 'the same cohort flagged in-sample never enters verdicts');
  const R2 = runFactors(rows(4, 200, w => (w === 2 ? 0.7 : 0.2)), F);
  ok(!R2.rows[0].verdict && !R2.rows[0].lean, 'three of four is neither a verdict nor a lean');
  ok(Array.isArray(R1.sorted) && R1.sorted.length === 800 && R1.sorted.every((r, i) => i === 0 || r.tISO >= R1.sorted[i - 1].tISO), 'the core hands the time-sorted rows back on `sorted`');
  ok(!('sorted' in run()) && !('sorted' in omniRun()), 'and both desk generators drop that field before it reaches a literal');
}

console.log('\n5. the render: one renderer, two desks');
{
  const ctx = boot(FULL);
  ok(ctx.HG_OP_FACTOR_SEP && Array.isArray(ctx.HG_OP_FACTOR_SEP.rows) && typeof ctx.opFactorSepHtml === 'function', 'literal and renderer call are exported');
  const html = ctx.opFactorSepHtml();
  ok(/WHICH READS SEPARATE · 4 disjoint windows · 8502 walked trades · backtest-omnipresent-results\.json/.test(html), 'the OMNIPRESENT literal renders through OMNIROUTE\'s renderer with its own artifact named');
  ok(/VERDICT:/.test(html) && /ev:stretched is unanimously <b>WORSE<\/b>/.test(html), 'today it renders the VERDICT branch for the stretched read');
  ok(/nothing on this desk is wired to it/.test(html), 'and says a verdict is a measurement, not a gate');
  ok(/LEANS/.test(html) && /gate:confluence3 better/.test(html), 'the leans are printed as leans');
  ok(/as-recorded only/.test(html) && /live print/.test(html), 'the single fill bound, and why it matters less on a market-order desk, is said');
  /* with omniroute.js absent the desk renders nothing rather than a second renderer */
  const lone = boot(['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-mechanics.js', 'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'omnipresent.js']);
  ok(typeof lone.hgOmniFactorSepHtml !== 'function' && lone.opFactorSepHtml() === '', 'with omniroute.js absent OMNIPRESENT renders nothing — there is no second renderer');
  ok(!/function hgOmniFactorSepHtml|WHICH READS SEPARATE/.test(read('omnipresent.js')), 'omnipresent.js carries no renderer of its own');
}

console.log('\n6. wired on both card paths, read by nothing else');
{
  const src = read('omnipresent.js');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const codeReads = (code.match(/\bHG_OP_FACTOR_SEP\b/g) || []).length;
  /* declaration, the renderer call's guard and its argument, and both sides of the export line */
  ok(codeReads === 5, 'in code the literal appears five times: declaration, renderer guard, renderer argument, both sides of the export (' + codeReads + ') — nothing else reads it');
  ok(/\+ \(h \|\| empty\) \+ opFactorSepHtml\(\);/.test(src), 'the scan paint appends the panel under the cards (textual, and says so: the paint lives inside runScan)');
  ok(/opPaidCardsHtml\(__op\.lastView\.top, __op\.lastView\.sideRead, paid\) \+ opFactorSepHtml\(\);/.test(src), 'the PAID view keeps the panel (textual)');
  ok(!/HG_OP_FACTOR_SEP/.test(read('hg-gates.js')) && !/HG_OP_FACTOR_SEP/.test(read('omniroute.js')), 'no gate module and no other desk reads it');
}

console.log('\n7. version stamps');
{
  const stamp = read('build-stamp.js');
  const v = (stamp.match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(/^hg-v\d+$/.test(v), 'build-stamp version ' + v);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}
console.log('\n' + passed + ' assertions passed');
