/* HARDGATE — THE GOLD TABS' EVIDENCE CITATIONS ARE CHECKED AGAINST THE FILES
   THEY NAME.

   The gold sources justify live gates in prose: "the 140-day swing replay
   (scripts/backtest-goldswing-results.json) measured the MP cohort n=100 at
   -0.209R, so a stamped-no-trade card can no longer lead". That sentence IS
   the reason the rule exists, and nothing checked it.

   MEASURED (pack 910). Sweeping every scripts/*.json citation in the gold
   sources and checking the numeric claims near it against the file named:
   NINE claims in five files named a file that does not contain them. Not one
   of them was fabricated — every figure was exact — but each lived in the
   PRE-v700 twin of the file named, or in a generation of the bake that has
   since been replaced.

   THAT IS WORSE THAN A TYPO, because of WHY those cohorts moved:

     goldswing bypass mints   bySession['n/a'] n=119 -0.544R   -> bucket GONE
     goldswing MP cohort      mpOnly n=100 -0.209R             -> mpOnly n=0
     goldswing overall        n=292 -0.158R                    -> n=244 +0.081R
     omnigold1 stand-asides   byFormation STOOD-ASIDE n=229    -> key GONE

   Each vanished cohort is the PROOF THE FIX WORKED. The v700 session gate
   left no un-gated mints to measure; the NO_TRADE demote left no NO_TRADE
   card leading; the composed stop floor left no card to stand aside. Citing
   the current file for the old numbers pointed the reader at a file whose
   silence on those cohorts was the result, and made it look like an error.

   AND ONE LIVE TABLE HAD DRIFTED. gold-formation.js's HG_GOLD_SESSION_EVIDENCE
   carried a comment claiming its derivation "reproduces every line exactly".
   It no longer did: the table was baked from 8,155 rows and the file now
   holds 8,132. medCostR still matched on all five buckets, which is what said
   the METHOD was right and the data had moved under it. The table is
   re-derived here and pinned; no confirms verdict changed, because all five
   signs are what they were.

   This file holds the claims as explicit (file, path, value) triples rather
   than by scanning prose near a citation. A proximity scan produces false
   positives — it cannot tell which of two nearby files a number belongs to,
   or see a total that is summed rather than stored — and a flaky guard is
   one that gets ignored.

   Run: node tests/test-gold-evidence-citations.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b, tol) => Math.abs((+a) - (+b)) <= (tol === undefined ? 0.0011 : tol);
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const S = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const dig = (o, p) => p.split('.').reduce((a, k) => (a === null || a === undefined) ? a : a[k], o);

const GOLD_SRC = ['goldind.js', 'goldswing.js', 'goldscalp.js', 'goldultra.js', 'newgold.js',
                  'omnigold.js', 'omnigold1.js', 'gold-formation.js', 'optigold.js', 'goldpine.js',
                  'gold-best-levels.js', 'golddirection.js', 'eightypercent.js'];

console.log('== every evidence file a gold source names actually exists ==');
{
  /* The cheap half of the rule, and the one that catches a whole class: a
     citation to scripts/gold-scalp-bt-analysis-FLOOR.json reads fine and
     resolves to nothing on a case-sensitive disk. Pack 909 wrote one; pack
     910 wrote four more while correcting the others. */
  const missing = [], seen = new Set();
  for (const f of GOLD_SRC){
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const src = S(f);
    for (const m of src.matchAll(/scripts\/[A-Za-z0-9._-]+\.json/g)){
      seen.add(m[0]);
      if (!fs.existsSync(path.join(ROOT, m[0]))) missing.push(`${f} names ${m[0]}`);
    }
  }
  ok(seen.size >= 10, `${seen.size} distinct evidence files are cited across the gold sources`);
  ok(missing.length === 0,
     'and every one of them is on disk, spelled exactly'
     + (missing.length ? ('\n      ' + [...new Set(missing)].join('\n      ')) : ''));
}

console.log('\n== the figures the gold sources quote are in the files they now name ==');
{
  /* (source file, evidence file, json path, expected, tolerance) — the claims
     pack 910 traced, each pinned where it actually lives. */
  const CLAIMS = [
    ['goldind.js',   'scripts/backtest-goldswing-results.json',          'aggregates.overall.n',                  244],
    ['goldind.js',   'scripts/backtest-goldswing-results-pre-v700.json', 'aggregates.mpOnly.n',                   100],
    ['goldind.js',   'scripts/backtest-goldswing-results-pre-v700.json', 'aggregates.mpOnly.avgR_net_xm',      -0.209],
    ['goldind.js',   'scripts/backtest-goldswing-results-pre-v700.json', 'aggregates.overall.n',                  292],
    ['goldind.js',   'scripts/backtest-goldswing-results-pre-v700.json', 'aggregates.overall.avgR_net_xm',     -0.158],
    ['goldswing.js', 'scripts/backtest-goldswing-results-pre-v700.json', 'aggregates.bySession.n/a.n',            119],
    ['goldswing.js', 'scripts/backtest-goldswing-results-pre-v700.json', 'aggregates.bySession.n/a.avgR_net_xm', -0.544],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results-pre-v700.json', 'tabLane.aggregates.byHorizon.SCALP.n',  250],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results-pre-v700.json', 'tabLane.aggregates.byHorizon.SCALP.avgR_gross', -0.287],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results-pre-v700.json', 'tabLane.aggregates.byHorizon.SCALP.avgR_net_xm', -0.455],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results-pre-v700.json', 'tabLane.aggregates.byHorizon.SWING.n',  135],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results-pre-v700.json', 'tabLane.aggregates.byHorizon.SWING.avgR_gross', 0.137],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results-pre-v700.json', 'tabLane.aggregates.byFormation.STOOD-ASIDE.n', 229],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results.json',          'tabLane.aggregates.byHorizon.SCALP.n',  531],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results.json',          'tabLane.aggregates.byHorizon.SCALP.avgR_gross', -0.127],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results.json',          'tabLane.aggregates.byHorizon.SWING.n',  358],
    ['omnigold1.js', 'scripts/backtest-omnigold1-results.json',          'tabLane.aggregates.byHorizon.SWING.avgR_gross', 0.148],
    ['omnigold.js',  'scripts/omnigold-replay-evidence.json',            'testAUC',                            0.5044],
    ['goldind.js',   'scripts/backtest-goldswing-results.json',          'aggregates.byStrategy.bos.n',             9],
    ['goldind.js',   'scripts/backtest-goldswing-results.json',          'aggregates.byStrategy.bos.avgR_net_xm', 0.369],
  ];
  const bad = [];
  for (const [src, jf, p, want, tol] of CLAIMS){
    const got = dig(J(jf), p);
    if (got === undefined || got === null || !near(got, want, tol)) bad.push(`${src} quotes ${jf} ${p} = ${want}, file says ${got}`);
  }
  ok(CLAIMS.length >= 20, `${CLAIMS.length} quoted figures pinned to a file and a path`);
  ok(bad.length === 0, 'and every one of them is exactly what that file says'
     + (bad.length ? ('\n      ' + bad.join('\n      ')) : ''));

  /* Each cited path is spelled in the source that quotes it, so a rename
     there fails here rather than drifting silently. */
  const unspelled = [];
  for (const [src, jf] of CLAIMS){
    if (!S(src).includes(jf)) unspelled.push(`${src} no longer names ${jf}`);
  }
  ok(unspelled.length === 0, 'and each source still names the file its figures come from'
     + (unspelled.length ? ('\n      ' + [...new Set(unspelled)].join('\n      ')) : ''));
}

console.log('\n== the vanished cohorts: the proof each v700 fix worked ==');
{
  const cur = J('scripts/backtest-goldswing-results.json');
  const pre = J('scripts/backtest-goldswing-results-pre-v700.json');
  ok(dig(pre, 'aggregates.bySession.n/a.n') === 119 && dig(cur, 'aggregates.bySession.n/a') === undefined,
     'the un-gated swing mints were 119 trades at -0.544R before v700, and there is NO n/a session bucket now');
  ok(dig(pre, 'aggregates.mpOnly.n') === 100 && dig(cur, 'aggregates.mpOnly.n') === 0,
     'the MOST PROBABLE cohort was 100 NO_TRADE cards before v700 and is n=0 now — the demote holds');
  ok(dig(pre, 'aggregates.overall.avgR_net_xm') < 0 && dig(cur, 'aggregates.overall.avgR_net_xm') > 0,
     `and the swing lane went from ${dig(pre, 'aggregates.overall.avgR_net_xm')}R to ${dig(cur, 'aggregates.overall.avgR_net_xm')}R per trade`);

  const o1pre = J('scripts/backtest-omnigold1-results-pre-v700.json');
  const o1cur = J('scripts/backtest-omnigold1-results.json');
  ok(dig(o1pre, 'tabLane.aggregates.byFormation.STOOD-ASIDE.n') === 229
     && dig(o1cur, 'tabLane.aggregates.byFormation.STOOD-ASIDE') === undefined,
     'omnigold1 stood 229 cards aside on the stop floor before v700, and has no STOOD-ASIDE bucket now');

  /* The finding has to survive the re-bake even though the numbers moved —
     otherwise the rule it justifies is standing on nothing. */
  ok(dig(o1cur, 'tabLane.aggregates.byHorizon.SCALP.avgR_gross') < 0,
     'and OG1 SCALP is STILL gross-negative on the current bake, so the demote is still the measured call');
  ok(dig(o1cur, 'tabLane.aggregates.byHorizon.SWING.avgR_gross') > 0,
     'while SWING is still gross-positive — the direction of the v700 finding survived the re-bake');
}

console.log('\n== the session table is re-derived from the file it cites ==');
{
  /* The claim in gold-formation.js is that bucketing trades[] by UTC hour
     reproduces the table. This re-runs exactly that, so the claim is a test
     rather than a sentence. */
  const d = J('scripts/backtest-omnigold-results.json');
  const rows = d.trades.filter(t => t && t.rMultiple !== null && t.rMultiple !== undefined
                                     && t.netR !== null && t.netR !== undefined);
  ok(rows.length === 8132, `${rows.length} filled rows in the cited bake (rMultiple and netR both present)`);

  const src = S('gold-formation.js');
  const tbl = [...src.matchAll(/\{ from: (\d+),\s+to: (\d+),\s+key: '([A-Z-]+)',[^}]*?n:\s+(\d+), grossR:\s*(-?[\d.]+), medCostR:\s+([\d.]+)/g)]
    .map(m => ({ from: +m[1], to: +m[2], key: m[3], n: +m[4], grossR: +m[5], medCostR: +m[6] }));
  ok(tbl.length === 5, `HG_GOLD_SESSION_EVIDENCE has ${tbl.length} buckets, read out of the source`);

  const hourOf = t => new Date(t.tISO).getUTCHours();
  const median = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const drift = [];
  let covered = 0;
  for (const r of tbl){
    const sub = rows.filter(t => { const h = hourOf(t); return h >= r.from && h < r.to; });
    covered += sub.length;
    const g = sub.reduce((s, t) => s + t.rMultiple, 0) / sub.length;
    const mc = median(sub.map(t => t.rMultiple - t.netR));
    if (sub.length !== r.n) drift.push(`${r.key} n: table ${r.n} vs file ${sub.length}`);
    if (!near(g, r.grossR)) drift.push(`${r.key} grossR: table ${r.grossR} vs file ${g.toFixed(3)}`);
    if (!near(mc, r.medCostR, 0.006)) drift.push(`${r.key} medCostR: table ${r.medCostR} vs file ${mc.toFixed(2)}`);
  }
  ok(covered === rows.length, `the five buckets partition all ${covered} rows — no hour is counted twice or dropped`);
  ok(drift.length === 0,
     'and every line of the table re-derives from the file it cites'
     + (drift.length ? ('\n      ' + drift.join('\n      ')) : ''));

  /* What the table is FOR. A number can drift without changing a decision,
     and this says which of the two happened. */
  const signs = tbl.map(r => r.key + (r.grossR >= 0 ? '+' : '-')).join(' ');
  ok(signs === 'ASIA+ LONDON- NY-OVERLAP- NY-PM+ OFF-',
     `and confirms (grossR >= 0) reads ${signs} — unchanged by the re-derivation`);
}

console.log('\n== the PROSE copy of the session table matches the live one ==');
{
  /* Two copies of a measurement are two things to drift, and this one drifted
     furthest: the header block still carried the 7,270-row generation while
     the live table had already moved twice. A mutation run found this file
     could not see it, so the prose numbers are now read out and compared to
     the array they describe. */
  const gf = S('gold-formation.js');
  const prose = [...gf.matchAll(/^\s{5}(ASIA|LONDON|NY-OVERLAP|NY-PM|OFF)\s+\d\d-\d\d\s+n=\s*([\d,]+)\s+gross\s*([+-][\d.]+)\s+medCostR\s+([\d.]+)/gm)]
    .map(m => ({ key: m[1], n: +m[2].replace(/,/g, ''), grossR: +m[3], medCostR: +m[4] }));
  ok(prose.length === 5, `the header block prints all ${prose.length} session cohorts`);
  const tblRows = [...gf.matchAll(/key: '([A-Z-]+)',[^}]*?n:\s+(\d+), grossR:\s*(-?[\d.]+), medCostR:\s+([\d.]+)/g)]
    .map(m => ({ key: m[1], n: +m[2], grossR: +m[3], medCostR: +m[4] }));
  const mismatch = [];
  for (const p of prose){
    const t = tblRows.find(r => r.key === p.key);
    if (!t){ mismatch.push(`${p.key} is in the prose and not in the table`); continue; }
    if (t.n !== p.n) mismatch.push(`${p.key} n: prose ${p.n} vs table ${t.n}`);
    if (!near(t.grossR, p.grossR)) mismatch.push(`${p.key} grossR: prose ${p.grossR} vs table ${t.grossR}`);
    if (!near(t.medCostR, p.medCostR, 0.006)) mismatch.push(`${p.key} medCostR: prose ${p.medCostR} vs table ${t.medCostR}`);
  }
  ok(mismatch.length === 0,
     'and every figure in it matches the array the desk actually reads'
     + (mismatch.length ? ('\n      ' + mismatch.join('\n      ')) : ''));
  /* The sentence that turns the table into the rule quotes two of them. */
  ok(/ASIA \(\+0\.064 at n=2,320\) and NY-PM \(\+0\.109 at n=1,044\)/.test(gf),
     'and the rule sentence beneath it quotes the same two confirming windows');
}

console.log('\n== the corrected windows and spans are the files\' own ==');
{
  const ev = J('scripts/omnigold-replay-evidence.json');
  ok(ev.window === '2026-03-27..2026-09-10', `the replay evidence window is ${ev.window}`);
  ok(S('omnigold.js').includes('2026-03-27..2026-09-10'),
     'and omnigold.js quotes that window, not the 2026-03-15..2026-08-29 it used to');
  /* The superseded window is still PRESENT on purpose — it is recorded as
     history. What must not happen is it being asserted as current, so every
     occurrence has to sit inside the hg-v910 note that marks it superseded.
     A bare "does this string appear" check cannot tell those apart, and an
     earlier draft of this line failed on the disclosure it was written to
     allow. */
  const ogLines = S('omnigold.js').split('\n');
  const oldWin = ogLines
    .map((l, i) => ({ l, i }))
    .filter(x => x.l.includes('2026-03-15'));
  ok(oldWin.length > 0, `the superseded window appears ${oldWin.length}x, kept as history`);
  const bare = oldWin.filter(x => {
    const ctx = ogLines.slice(Math.max(0, x.i - 3), x.i + 2).join(' ');
    return !/hg-v910|read "|used to/.test(ctx);
  });
  ok(bare.length === 0,
     'and every occurrence sits inside the note that marks it superseded, never asserted as current'
     + (bare.length ? (' — bare at line ' + bare.map(x => x.i + 1).join(', ')) : ''));
  const kinds = Object.keys(ev.perKind).length;
  const sumN = Object.values(ev.perKind).reduce((a, v) => a + (v.n || 0), 0);
  ok(kinds === 54 && sumN === 7953, `${kinds} kinds summing to n=${sumN}, which is what omnigold.js now says`);
  ok(/54 kinds summing to n=7953/.test(S('omnigold.js')),
     'and it says summing, because the file stores per-kind n and not the total');
}

console.log('\n== the figures that were replaced are recorded, not deleted ==');
{
  /* A number that once justified a live table is worth being able to
     recognise if it surfaces again somewhere else. */
  const gf = S('gold-formation.js');
  ok(/n=2,082 \+0\.097 for ASIA/.test(gf) && /7,270-row generation/.test(gf),
     'gold-formation.js still records the superseded session figures it used to assert');
  ok(/reproduce from NEITHER the table below NOR the current file/.test(gf),
     'and says plainly that they reproduce from neither');
  const og = S('omnigold.js');
  ok(/read AUC 0\.4924 with deciles/.test(og) && /n=7270\s*\n?\s*settled|n=7270/.test(og),
     'omnigold.js records the superseded AUC and n it used to assert');
  ok(/comment read 0\.4924/.test(og) && /RENDERED footnote was never wrong/.test(og),
     'and is precise about which drifted: the prose, not the card, because the footnote reads the constant');
}

console.log(`\n${passed} passed, 0 failed`);
