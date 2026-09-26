/* hg-v988 — the one home for "which signal-time read separates winners on a
   desk's own replay, across DISJOINT windows".

   hg-v987 built this for OMNIROUTE; hg-v988 asks the same question of
   OMNIPRESENT. Two desks, one method: the factors differ per desk (each
   desk stamps different reads on its replay rows), everything else — the
   window rule (through hg-v984's `separate`, the hg-v920 rule), the lean and
   degenerate classification, the literal writer and the marker splice — is
   written once here and configured per desk. A second copy of the rule is a
   second rule (hg-v949).

   A VERDICT needs all K windows to agree on win AND gross AND net. A LEAN is
   net unanimous while win or gross is not (hg-v945: a lean is not a
   verdict). A DEGENERATE read is a cohort that is the whole book or none of
   it — no complement to compare against. An inSample factor's verdict never
   enters `verdicts`. */
import fs from 'node:fs';
import { separate } from './omniroute-regime-separation.mjs';

export const WINDOWS = 4;
export const MIN_SIDE = 20;
const r3 = (x) => Math.round(x * 1000) / 1000;

/* rows -> the per-factor table. `factors` is [{key, group, label, pick, inSample?}] */
export function runFactors(rows, factors, opts){
  const K = (opts && opts.windows) || WINDOWS, minSide = (opts && opts.minSide) || MIN_SIDE;
  const sorted = rows.slice().sort((a, b) => (a.tISO < b.tISO ? -1 : a.tISO > b.tISO ? 1 : 0));
  const out = [];
  for (const f of factors){
    const s = separate(sorted, f.pick, K, minSide);
    const w = s.whole;
    const row = {
      f: f.key, group: f.group, label: f.label,
      n: w.in ? w.in.n : 0,
      win: w.in ? r3(w.in.win) : null, gross: w.in ? r3(w.in.gross) : null, net: w.in ? r3(w.in.net) : null,
      outWin: w.out ? r3(w.out.win) : null, outNet: w.out ? r3(w.out.net) : null,
      /* windows where the cohort was BETTER than its complement, win/gross/net */
      q: s.better.win + '/' + s.better.gross + '/' + s.better.net,
      thin: s.thin,
      verdict: (s.verdict === 'none') ? null : s.verdict
    };
    /* (a count can only reach K when every window was judged, so a thin
       window rules a lean out by arithmetic — no second guard) */
    if (!row.verdict){
      if (s.better.net === K) row.lean = 'better';
      else if (s.worse.net === K) row.lean = 'worse';
    }
    /* a cohort that is the whole book (or none of it) has no complement to
       be compared against: that is a degenerate read, not a thin one */
    if (!w.in || !w.out) row.degenerate = true;
    if (f.inSample) row.inSample = true;
    out.push(row);
  }
  return {
    sorted,
    n: sorted.length, windows: K, minSide,
    span: sorted.length ? [sorted[0].tISO.slice(0, 10), sorted[sorted.length - 1].tISO.slice(0, 10)] : null,
    rows: out,
    verdicts: out.filter(r => r.verdict && !r.inSample).map(r => r.f),
    leans: out.filter(r => r.lean && !r.inSample).map(r => r.f),
    inSampleVerdicts: out.filter(r => r.verdict && r.inSample).map(r => r.f)
  };
}

/* the committed literal: one compact row per factor. `head` is the
   generator's own path (for the re-derive note); `extra` are further
   top-level fields (starved, bound, ...) written after the standard ones. */
export function literalFor(name, R, opts){
  const begin = opts.begin, end = opts.end;
  const rows = R.rows.map(r => {
    const parts = ['f: ' + JSON.stringify(r.f), 'g: ' + JSON.stringify(r.group), 'n: ' + r.n,
      'win: ' + r.win, 'gross: ' + r.gross, 'net: ' + r.net, 'outWin: ' + r.outWin, 'outNet: ' + r.outNet,
      'q: ' + JSON.stringify(r.q), 'verdict: ' + JSON.stringify(r.verdict)];
    if (r.thin) parts.push('thin: ' + r.thin);
    if (r.degenerate) parts.push('degenerate: true');
    if (r.lean) parts.push('lean: ' + JSON.stringify(r.lean));
    if (r.inSample) parts.push('inSample: true');
    return '      { ' + parts.join(', ') + ' }';
  });
  const extra = [];
  for (const k of Object.keys(opts.extra || {})) extra.push('    ' + k + ': ' + JSON.stringify(opts.extra[k]) + ',');
  return [
    begin,
    '     Re-derive with `node ' + opts.script + ' --write`. Do not',
    '     hand-edit — generated literals write themselves (hg-v921). Every figure is',
    '     read off ' + R.artifact + '; the guard re-runs the generator and fails on drift. */',
    '  var ' + name + ' = {',
    '    artifact: ' + JSON.stringify(R.artifact) + ', n: ' + R.n + ', windows: ' + R.windows + ', minSide: ' + R.minSide + ',',
    '    span: ' + JSON.stringify(R.span) + ','
  ].concat(extra, [
    '    verdicts: ' + JSON.stringify(R.verdicts) + ',',
    '    leans: ' + JSON.stringify(R.leans) + ',',
    '    inSampleVerdicts: ' + JSON.stringify(R.inSampleVerdicts) + ',',
    '    rows: [',
    rows.join(',\n'),
    '    ]',
    '  };',
    '  ' + end
  ]).join('\n');
}

/* write the literal between the markers; a marker that cannot be found is
   fatal, never skipped */
export function spliceBetween(src, lit, begin, end, fileLabel){
  const i = src.indexOf(begin);
  if (i < 0) throw new Error('BEGIN marker not found in ' + fileLabel + ' — fatal, never skipped');
  const j = src.indexOf(end, i);
  if (j < 0) throw new Error('END marker not found in ' + fileLabel + ' — fatal, never skipped');
  return src.slice(0, i) + lit.slice(0, lit.length - end.length) + src.slice(j);
}

/* the CLI tail every desk script shares: print, then drift-check or write */
export function cliTail(res, lit, target, fileLabel, name){
  const src = fs.readFileSync(target, 'utf8');
  const next = spliceBetween(src, lit, name.begin, name.end, fileLabel);
  if (next === src){ console.log('\n' + name.literal + ': zero drift'); }
  else if (process.argv.includes('--write')){ fs.writeFileSync(target, next); console.log('\n' + name.literal + ' written'); }
  else { console.log('\nDRIFT — run with --write'); process.exitCode = 1; }
}

export function printRows(res){
  const pc = (x) => (typeof x === 'number') ? (100 * x).toFixed(1) + '%' : '—';
  const sR = (x) => (typeof x === 'number') ? ((x >= 0 ? '+' : '') + x.toFixed(3)) : '—';
  for (const r of res.rows){
    console.log(`  ${r.f.padEnd(34)} n=${String(r.n).padStart(4)} win ${pc(r.win)} net ${sR(r.net)} | out win ${pc(r.outWin)} net ${sR(r.outNet)} | better w/g/n ${r.q}${r.thin ? ' thin ' + r.thin : ''} -> ${r.verdict ? r.verdict.toUpperCase() : (r.lean ? 'lean ' + r.lean : (r.degenerate ? 'no complement' : '-'))}${r.inSample ? '  [IN-SAMPLE]' : ''}`);
  }
  console.log(`\nverdicts (out of sample): ${res.verdicts.length ? res.verdicts.join(', ') : 'NONE'}`);
  console.log(`leans (net unanimous, win or gross not): ${res.leans.join(', ') || 'none'}`);
  console.log(`in-sample verdicts (fitted on this window, no confirmation): ${res.inSampleVerdicts.join(', ') || 'none'}`);
}
