#!/usr/bin/env node
/* HARDGATE — hg-v935: does selecting mechanics by their own record pay?

   THE QUESTION. OMNIGOLD forms setups from every registered mechanic. Its
   measured-edge gate only vetoes at -2 sigma, which almost nothing reaches, so
   in practice a mechanic whose own gate-clear record is negative still tickets.
   GOLD SCALP got a suppress/demote table in hg-v928; OMNIGOLD never did. The
   obvious fix is "only form the mechanics whose record is positive", and it is
   obvious enough that it has to be TESTED rather than shipped.

   WHY THE OBVIOUS TEST IS WORTHLESS. Ranking 54 mechanics on the whole book
   and keeping the winners then measuring on that same book is guaranteed to
   look good: the selection has already seen every outcome it is judged on.
   hg-v920 caught exactly this shape once already, where grade A beat B/C at
   all three NESTED splits and was worse in three of four DISJOINT windows.

   SO THE SELECTION NEVER SEES THE WINDOW IT IS JUDGED ON. The book is cut into
   four disjoint windows. For each window W the mechanics are ranked on the
   OTHER THREE ONLY, the rule picks a set from that, and the set is scored on W.
   Four independent out-of-sample trials. A verdict needs ALL FOUR to agree, on
   gross AND net, at BOTH fill bounds - the hg-v918/v922 bar.

   WHAT IS REPORTED BESIDE THE VERDICT, because each has sunk a rule here
   before: how much volume the rule deletes (hg-v922's 52% caveat - a filter
   that trades almost nothing is not an edge), and the whole grid of sample
   floors and criteria, because a rule that works at one setting and not its
   neighbours is a bar being searched for, not found.

   Expectancy is mean R per trade and every trade risks 1R, so it is already
   per unit of risk deployed: a rule cannot score well here by trading less.

   Re-derive: node scripts/mechanic-selection.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { ogBook, XM_RT_PCT, WINDOWS } from './factor-separation.mjs';
import { splitDisjoint } from './disjoint-windows.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ENDS = ['as-recorded', 'lower'];

/** Sample floor a mechanic must reach in the SELECTION set to be judged at all.
    A mechanic below it is UNKNOWN, and the two ways of treating an unknown are
    themselves part of what is being tested. */
export const MIN_SELECT = [10, 20, 30, 50];

/** The rules. Each takes a mechanic's record on the selection set and says
    whether to keep it. `keepUnknown` decides what happens to a mechanic too
    thin to judge - dropping it is a much harsher rule than it looks, because
    thin mechanics are most of the register. */
export const RULES = [
  { key: 'gross>0',        keepUnknown: true,  pick: (r) => r.gross > 0 },
  { key: 'net>0',          keepUnknown: true,  pick: (r) => r.net > 0 },
  { key: 'gross>0 strict', keepUnknown: false, pick: (r) => r.gross > 0 },
  { key: 'net>0 strict',   keepUnknown: false, pick: (r) => r.net > 0 },
  /* The inverse of the desk's own veto: drop only the ones measured FAILING,
     which is the least aggressive version of the idea and the closest to what
     omnigold.js already does at -2 sigma. */
  { key: 'drop gross<=-0.25', keepUnknown: true, pick: (r) => r.gross > -0.25 }
];

const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const r4 = (x) => Math.round(x * 10000) / 10000;

/** Per-mechanic record over an arbitrary set of rows. */
export function recordsOf(rows){
  const by = new Map();
  for (const t of rows){
    const k = String(t.kind || '');
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(t);
  }
  const out = new Map();
  for (const [k, v] of by){
    out.set(k, { kind: k, n: v.length, gross: mean(v.map((t) => t.g)), net: mean(v.map((t) => t.net)) });
  }
  return out;
}

/** The set of mechanics a rule keeps, given records from the SELECTION set. */
export function select(records, rule, minN){
  const keep = new Set();
  for (const [k, r] of records){
    if (r.n < minN){ if (rule.keepUnknown) keep.add(k); continue; }
    if (rule.pick(r)) keep.add(k);
  }
  return keep;
}

/** One rule, one sample floor, one fill bound: four out-of-sample trials. */
export function judge(book, rule, minN){
  const wins = splitDisjoint(book, WINDOWS);
  const trials = [];
  for (let i = 0; i < wins.length; i++){
    const test = wins[i];
    const train = wins.filter((_, j) => j !== i).flat();
    const keep = select(recordsOf(train), rule, minN);
    const kept = test.filter((t) => keep.has(String(t.kind)));
    if (!kept.length){ trials.push({ w: i, empty: true }); continue; }
    trials.push({
      w: i,
      nKept: kept.length, nAll: test.length,
      keptPct: r4(kept.length / test.length * 100),
      grossKept: r4(mean(kept.map((t) => t.g))), grossAll: r4(mean(test.map((t) => t.g))),
      netKept: r4(mean(kept.map((t) => t.net))), netAll: r4(mean(test.map((t) => t.net))),
      mechs: keep.size
    });
  }
  const usable = trials.filter((t) => !t.empty);
  const gWins = usable.filter((t) => t.grossKept > t.grossAll).length;
  const nWins = usable.filter((t) => t.netKept > t.netAll).length;
  return {
    trials, usable: usable.length,
    grossAgree: gWins, netAgree: nWins,
    unanimous: usable.length === WINDOWS && gWins === WINDOWS && nWins === WINDOWS,
    keptPct: r4(mean(usable.map((t) => t.keptPct))),
    netLift: r4(mean(usable.map((t) => t.netKept - t.netAll)))
  };
}

/** The drop-threshold sweep. A rule that holds at one bar and fails at its
    NEIGHBOUR is a bar being searched for, not found - hg-v922 ran exactly this
    check on stop width and refused a threshold on it. Reported as the pattern,
    not as the best cell, because the best cell is what a search returns. */
export const SWEEP_BARS = [-0.05, -0.10, -0.15, -0.20, -0.25, -0.30, -0.40, -0.50, -0.75, -1.00];
export const SWEEP_MIN_N = 20;

export function sweep(books){
  return SWEEP_BARS.map((bar) => {
    const rule = { key: 'gross > ' + bar.toFixed(2), keepUnknown: true, pick: (r) => r.gross > bar };
    const ends = {};
    for (const end of ENDS) ends[end] = judge(books[end], rule, SWEEP_MIN_N);
    return {
      bar: r4(bar),
      unanimous: ENDS.every((e) => ends[e].unanimous),
      agree: ENDS.reduce((a, e) => a + ends[e].grossAgree + ends[e].netAgree, 0),
      keptPct: ends['as-recorded'].keptPct,
      netLift: ends['as-recorded'].netLift
    };
  });
}

/** Is the unanimity CONTIGUOUS in the threshold? A real effect fades as the
    bar moves; a searched-for one flickers on and off between neighbours. */
export function contiguous(sweepRows){
  const flags = sweepRows.map((r) => r.unanimous);
  let runs = 0;
  for (let i = 0; i < flags.length; i++) if (flags[i] && !flags[i - 1]) runs++;
  return { runs, unanimousCount: flags.filter(Boolean).length, contiguous: runs <= 1 };
}

export function run(){
  const out = { generated: new Date().toISOString(), windows: WINDOWS, rtPct: XM_RT_PCT, grid: [] };
  const books = {};
  for (const end of ENDS) books[end] = ogBook(end);
  out.bookNet = r4(mean(books['as-recorded'].map((t) => t.net)));
  out.bookGross = r4(mean(books['as-recorded'].map((t) => t.g)));
  out.bookN = books['as-recorded'].length;
  for (const rule of RULES){
    for (const minN of MIN_SELECT){
      const row = { rule: rule.key, minN, ends: {} };
      for (const end of ENDS) row.ends[end] = judge(books[end], rule, minN);
      row.unanimousBothEnds = ENDS.every((e) => row.ends[e].unanimous);
      row.agree = ENDS.reduce((a, e) => a + row.ends[e].grossAgree + row.ends[e].netAgree, 0);
      out.grid.push(row);
    }
  }
  out.sweep = sweep(books);
  out.shape = contiguous(out.sweep);
  /* The best net lift any UNANIMOUS cell in the sweep achieved, and where the
     book still sits once it is applied. This is the ceiling of the whole idea. */
  const best = out.sweep.filter((r) => r.unanimous).sort((a, b) => b.netLift - a.netLift)[0] || null;
  out.best = best;
  out.ceilingNet = best ? r4(out.bookNet + best.netLift) : null;
  /* THE VERDICT. Unanimity alone is not enough: it must also be contiguous in
     the threshold, or the rule is the output of a search over thresholds. */
  out.ships = !!(best && out.shape.contiguous);
  return out;
}

/* ---- the literal the OMNIGOLD panel renders ------------------------------
   Generated, never typed: hg-v909 shipped a hand-transcribed evidence block
   from the wrong file and hg-v921 answered it by making the literals write
   themselves. A refusal quoted from memory drifts the same way a promotion
   does, and this one is meant to stop the idea being re-derived and shipped. */
export const OG_SRC_PATH = join(HERE, '..', 'omnigold.js');
export const BEGIN = '/* --- BEGIN GENERATED HG_OG_SELECTION';
export const END = '/* --- END GENERATED HG_OG_SELECTION --- */';

export function renderLiteral(r){
  const rows = r.sweep.map((x) => '      { bar: ' + x.bar.toFixed(2) + ', agree: ' + x.agree
    + ', keptPct: ' + x.keptPct + ', netLift: ' + x.netLift
    + ', unanimous: ' + (x.unanimous ? 'true' : 'false') + ' }').join(',\n');
  return 'var HG_OG_SELECTION = {\n'
    + '    windows: ' + r.windows + ', minN: ' + SWEEP_MIN_N + ',\n'
    + '    bookN: ' + r.bookN + ', bookGross: ' + r.bookGross + ', bookNet: ' + r.bookNet + ',\n'
    + '    unanimousCells: ' + r.shape.unanimousCount + ', runs: ' + r.shape.runs
    + ', contiguous: ' + (r.shape.contiguous ? 'true' : 'false') + ',\n'
    + '    bestBar: ' + (r.best ? r.best.bar.toFixed(2) : 'null')
    + ', bestLift: ' + (r.best ? r.best.netLift : 'null')
    + ', ceilingNet: ' + (r.ceilingNet === null ? 'null' : r.ceilingNet) + ',\n'
    + '    ships: ' + (r.ships ? 'true' : 'false') + ',\n'
    + '    sweep: [\n' + rows + '\n    ]\n  };';
}

export function splice(src, body){
  const i = src.indexOf(BEGIN), j = src.indexOf(END);
  if (i < 0 || j < 0 || j < i) throw new Error('HG_OG_SELECTION markers not found in omnigold.js');
  const headEnd = src.indexOf('*/', i);
  if (headEnd < 0 || headEnd > j) throw new Error('HG_OG_SELECTION header unterminated');
  return src.slice(0, headEnd + 2) + '\n  ' + body + '\n  ' + src.slice(j);
}

export function write(r){
  const src = readFileSync(OG_SRC_PATH, 'utf8');
  const next = splice(src, renderLiteral(r));
  const drift = next !== src;
  if (drift) writeFileSync(OG_SRC_PATH, next);
  return drift;
}

/* basename, not endsWith: tests/test-mechanic-selection.mjs ends with this
   filename too, so an endsWith guard runs the whole CLI — and its drift
   check sets process.exitCode — from inside someone else's test. The same
   bug was found and fixed in hg-v934's generator; it is written down here
   because the shape recurs every time a guard is added next to its test. */
if (process.argv[1] && basename(process.argv[1]) === 'mechanic-selection.mjs'){
  const r = run();
  console.log('OMNIGOLD mechanic selection — leave-one-window-out, ' + WINDOWS
    + ' disjoint windows, both fill bounds');
  console.log('a verdict needs 16/16: gross AND net better in all four windows, at both ends');
  console.log('whole book: n=' + r.bookN + '  gross ' + r.bookGross.toFixed(4)
    + 'R  net ' + r.bookNet.toFixed(4) + 'R at XM\n');
  console.log('A. SELECT THE WINNERS — the obvious rule');
  console.log('rule                minN  agree  keeps%   net lift');
  for (const row of r.grid){
    console.log('  ' + row.rule.padEnd(18) + String(row.minN).padStart(3)
      + '   ' + String(row.agree).padStart(2) + '/16'
      + '   ' + (row.ends['as-recorded'].keptPct).toFixed(1).padStart(5) + '%'
      + '   ' + (row.ends['as-recorded'].netLift >= 0 ? '+' : '')
      + row.ends['as-recorded'].netLift.toFixed(4)
      + (row.unanimousBothEnds ? '   UNANIMOUS' : ''));
  }
  console.log('\nB. DROP ONLY THE MEASURED DISASTERS — sweeping the bar');
  console.log('bar      agree  keeps%   net lift');
  for (const row of r.sweep){
    console.log(row.bar.toFixed(2).padStart(6) + '   ' + String(row.agree).padStart(2) + '/16'
      + '   ' + row.keptPct.toFixed(1).padStart(5) + '%'
      + '   ' + (row.netLift >= 0 ? '+' : '') + row.netLift.toFixed(4)
      + (row.unanimous ? '   UNANIMOUS' : ''));
  }
  console.log('\nunanimous cells: ' + r.shape.unanimousCount + ' in ' + r.shape.runs
    + ' separate run(s) — ' + (r.shape.contiguous ? 'contiguous' : 'NOT CONTIGUOUS'));
  if (r.best) console.log('best unanimous cell: bar ' + r.best.bar.toFixed(2)
    + ', net lift +' + r.best.netLift.toFixed(4) + 'R, leaving the book at '
    + r.ceilingNet.toFixed(4) + 'R');
  if (process.argv.includes('--write')) console.log(write(r) ? 'WROTE omnigold.js' : 'no drift');
  else { const src = readFileSync(OG_SRC_PATH, 'utf8');
         if (splice(src, renderLiteral(r)) !== src){ console.log('DRIFT — run with --write'); process.exitCode = 1; } }
  console.log('\nVERDICT: ' + (r.ships
    ? 'a rule survives — read its windows before shipping it'
    : 'NO SELECTION RULE SHIPS. Unanimity that switches on and off between '
      + 'neighbouring thresholds is a bar being searched for, not found.'));
}
