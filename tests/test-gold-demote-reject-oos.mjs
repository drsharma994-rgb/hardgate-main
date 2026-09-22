/* HARDGATE — A CHANGE THIS REPO MEASURED, AND DID NOT SHIP.

   Pack 912 made the GOLD SCALP cost gate reject rather than demote, on the
   finding that a demote never stopped a trade. The obvious next move is to
   do the same to the ELEVEN kinds the baked edge table demotes, and the
   in-sample arithmetic is striking:

     live book, as the replay ran it      n=2193  -0.148R  t=-5.71
     + the pack-912 cost reject           n=1522  -0.053R  t=-1.75
     + today's EDGE suppressions          n=1205  -0.020R  t=-0.58
     + demoted kinds rejected as well     n= 264  +0.173R  t=+2.19

   A significantly POSITIVE scalp book. It is also circular: those eleven
   kinds are on the demote list BECAUSE they lost in this very replay, so
   the survivors' t is inflated by the selection that produced them.

   SO IT WAS TESTED OUT OF SAMPLE, which needs no network: refit the
   negative-kind set on the first part of the book and apply it to the rest.

     split   OOS as-is            OOS with the negatives cut
     50/50   -0.090 (t=-2.14)     -0.115 (t=-1.92)   WORSE
     60/40   -0.069 (t=-1.47)     -0.037 (t=-0.48)
     70/30   -0.114 (t=-2.10)     -0.046 (t=-0.52)

   IT DOES NOT SURVIVE. At the even split the cut makes the book worse, and
   at no split does it produce a positive one — the best is -0.037R. The
   +0.173 was selection.

   So the change was NOT shipped, and this file exists so the idea cannot be
   re-derived and acted on from the in-sample number alone. It re-runs the
   whole comparison rather than remembering its conclusion: if a re-bake
   makes the cut survive, this goes red and someone looks.

   WHAT IT DOES NOT CLAIM. Not that the demoted kinds are fine — the book is
   still negative everywhere here. Only that rejecting them, on this
   evidence, is not shown to help, and would cost 88% of the desk's volume
   for a result that does not hold out of sample.

   Run: node tests/test-gold-demote-reject-oos.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const riskPct = t => {
  const e = t.entry, s = t.stop;
  return (typeof e === 'number' && typeof s === 'number' && e > 0) ? Math.abs(e - s) / e * 100 : null;
};
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
const tstat = v => {
  if (v.length < 2) return NaN;
  const m = mean(v);
  const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1));
  return m / (sd / Math.sqrt(v.length));
};

/* The live book that survives the shipped pack-912 cost reject — the only
   population on which this question is still open. */
const ALL = J('scripts/backtest-goldscalp-results-floor.json').trades
  .filter(t => typeof t.netR === 'number' && !t.shadow);
const BOOK = ALL.filter(t => (riskPct(t) ?? 0) >= 0.16).sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));

console.log('== the in-sample number is real, and it is reproducible ==');
{
  ok(ALL.length === 2193 && BOOK.length === 1522,
     `${ALL.length} live settled trades, ${BOOK.length} of them past the cost bar`);
  const edge = J('scripts/gold-setup-edge.json').scalp;
  const SUP = Object.keys(edge).filter(k => edge[k].action === 'suppress');
  const DEM = Object.keys(edge).filter(k => edge[k].action === 'demote');
  ok(DEM.length === 11, `the edge table demotes ${DEM.length} scalp kinds`);

  const afterSup = BOOK.filter(t => SUP.indexOf(String(t.stratKey)) < 0);
  const afterDem = afterSup.filter(t => DEM.indexOf(String(t.stratKey)) < 0);
  ok(Math.abs(mean(afterSup.map(t => t.netR)) + 0.020) < 0.002,
     `with today's suppressions the book is ${mean(afterSup.map(t => t.netR)).toFixed(3)}R`);
  ok(afterDem.length === 264 && Math.abs(mean(afterDem.map(t => t.netR)) - 0.173) < 0.002,
     `and rejecting the demoted kinds too gives ${mean(afterDem.map(t => t.netR)).toFixed(3)}R over n=${afterDem.length}`);
  ok(tstat(afterDem.map(t => t.netR)) > 1.96,
     `at t=+${tstat(afterDem.map(t => t.netR)).toFixed(2)} — significantly positive, in sample`);
  ok(afterDem.length / BOOK.length < 0.2,
     `on ${(100 * afterDem.length / BOOK.length).toFixed(0)}% of the volume, which is what makes it worth testing rather than taking`);
}

console.log('\n== out of sample it does not survive ==');
{
  /* Refit on the first part, apply to the rest. The fit rule is the one the
     edge table documents for a demote — negative net — with a small sample
     floor so a three-trade kind cannot join the set. */
  function walk(share){
    const cut = Math.floor(BOOK.length * share);
    const ins = BOOK.slice(0, cut), oos = BOOK.slice(cut);
    const by = new Map();
    for (const t of ins){
      const k = String(t.stratKey);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(t.netR);
    }
    const bad = new Set();
    for (const [k, v] of by) if (v.length >= 12 && mean(v) < 0) bad.add(k);
    const kept = oos.filter(t => !bad.has(String(t.stratKey))).map(t => t.netR);
    return { bad, oos: oos.map(t => t.netR), kept };
  }

  const results = [];
  for (const share of [0.5, 0.6, 0.7]){
    const w = walk(share);
    results.push({ share, nBad: w.bad.size, base: mean(w.oos), cut: mean(w.kept),
                   tBase: tstat(w.oos), tCut: tstat(w.kept), kept: w.kept.length, n: w.oos.length });
  }
  for (const r of results)
    ok(r.nBad >= 5 && r.kept > 50,
       `${(r.share * 100).toFixed(0)}/${(100 - r.share * 100).toFixed(0)}: ${r.nBad} kinds judged negative in-sample, `
       + `${r.kept} of ${r.n} OOS trades survive the cut`);

  /* THE FINDING. Stated as two independent facts so neither alone carries it. */
  const positive = results.filter(r => r.cut > 0);
  ok(positive.length === 0,
     'at NO split does cutting them produce a positive out-of-sample book — best is '
     + Math.max(...results.map(r => r.cut)).toFixed(3) + 'R');
  const worse = results.filter(r => r.cut < r.base);
  ok(worse.length >= 1,
     `and at ${worse.length} of ${results.length} splits the cut makes the OOS book WORSE than leaving them in`);
  const even = results.find(r => r.share === 0.5);
  ok(even.cut < even.base,
     `the even split is one of them: ${even.base.toFixed(3)}R as-is against ${even.cut.toFixed(3)}R cut`);
  ok(results.every(r => Math.abs(r.tCut) < 1.96),
     'and no split leaves the cut book significantly anything: t = '
     + results.map(r => r.tCut.toFixed(2)).join(', '));

  /* The contrast that makes the point: in-sample it cleared 95%, out of
     sample not one split does. */
  const edge = J('scripts/gold-setup-edge.json').scalp;
  const DEM = Object.keys(edge).filter(k => edge[k].action === 'demote');
  const SUP = Object.keys(edge).filter(k => edge[k].action === 'suppress');
  const inSample = BOOK.filter(t => SUP.indexOf(String(t.stratKey)) < 0 && DEM.indexOf(String(t.stratKey)) < 0)
                       .map(t => t.netR);
  ok(tstat(inSample) > 1.96 && results.every(r => r.tCut < 1.96),
     `in sample t=+${tstat(inSample).toFixed(2)}, out of sample the best is t=`
     + Math.max(...results.map(r => r.tCut)).toFixed(2) + ' — the gap IS the selection');
}

console.log('\n== so the change is not in the code ==');
{
  const gi = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  const applier = gi.slice(gi.indexOf('function hgGoldSetupEdgeApply'), gi.indexOf('function hgGoldScalpCostGate'));
  ok(/if \(row\.action === 'demote'\)\{[\s\S]{0,300}?cand\.demoted = true;/.test(applier),
     'a demote row still sets demoted');
  ok(!/if \(row\.action === 'demote'\)\{[\s\S]{0,300}?cand\.dropped = true;/.test(applier),
     'and does NOT set dropped — the out-of-sample test is why');
  /* The cost gate's rejection is a separate finding and stays. */
  const cost = gi.slice(gi.indexOf('function hgGoldScalpCostGate'), gi.indexOf('function hgGoldScalpStopFloor'));
  ok(/c\.dropped = true;/.test(cost),
     'while the pack-912 cost reject remains — that one held up, this one did not');
}

console.log(`\n${passed} passed, 0 failed`);
