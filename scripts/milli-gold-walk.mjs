#!/usr/bin/env node
/* HARDGATE — hg-v937: MILLI GOLD backtested, and forward-tested honestly.

   hg-v936 shipped a roster chosen on the WHOLE walk and said so, but the tab
   still quoted an in-sample figure as its headline. This answers the two
   questions that figure cannot.

   1. THE BACKTEST. What the roster-only desk actually did, as a book someone
      could run: all-at-once and ONE AT A TIME (the hg-v918/v926 sequential
      read, since this walk publishes 61.8 plans a day and holds dozens at
      once), at BOTH fill bounds, gross and net at XM, against the same
      measures for the full OMNIGOLD book.

   2. THE FORWARD TEST, which is the one that decides anything. Build the
      roster on the FIRST part of the walk only, then measure it on the part
      that came after. That is what a reader actually does: pick the mechanics
      that have paid so far, and trade them next. Anchored splits at 50/60/70%
      — reported separately, never averaged, because they share a test tail
      (hg-v920) and three agreements from nested sets are not three
      confirmations. The DISJOINT check from hg-v935 is the companion; this
      one asks the chronological question that matters to a live desk.

   THE COMPARISON IS AGAINST THE DESK, NOT AGAINST ZERO. A roster that loses
   less than OMNIGOLD still loses. Both are printed on every line so the
   reader can see which claim is being made.

   Re-derive: node scripts/milli-gold-walk.mjs   (npm run gold:milli-walk)
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { ogBook } from './factor-separation.mjs';
import { MIN_N } from './milli-gold-roster.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ENDS = ['as-recorded', 'lower'];
export const SPLITS = [0.5, 0.6, 0.7];

const r4 = (x) => Math.round(x * 10000) / 10000;
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);

/** The shipped roster, read from milligold.js so this walk judges what SHIPS
    rather than a list retyped here. */
export function shippedRoster(src){
  const m = src.match(/var HG_MILLI_ROSTER = \{[\s\S]*?\n  \};/);
  if (!m) throw new Error('HG_MILLI_ROSTER not found in milligold.js');
  const out = [];
  for (const line of m[0].split('\n')){
    const k = line.match(/kind:\s*'([^']+)'/);
    if (k) out.push(k[1]);
  }
  if (!out.length) throw new Error('shipped roster parsed empty');
  return new Set(out);
}

/** The admission rule, applied to an arbitrary slice. Same rule the generator
    uses, so the forward test measures the RULE and not a different one. */
export function rosterFrom(rows, minN = MIN_N){
  const by = new Map();
  for (const t of rows){
    const k = String(t.kind || '');
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(t);
  }
  const keep = new Set();
  for (const [k, v] of by){
    if (v.length < minN) continue;
    if (mean(v.map((t) => t.net)) > 0) keep.add(k);
  }
  return keep;
}

/** Expectancy of a set of trades. Every trade risks 1R, so the mean IS the
    per-unit-of-risk figure and a rule cannot look good by trading less. */
export function expectancy(rows){
  if (!rows.length) return { n: 0, gross: NaN, net: NaN, win: NaN };
  return {
    n: rows.length,
    gross: r4(mean(rows.map((t) => t.g))),
    net: r4(mean(rows.map((t) => t.net))),
    win: r4(rows.filter((t) => t.g > 0).length / rows.length)
  };
}

/** One position at a time, in time order — the book a single account could
    actually have run. Entry is the plan's own timestamp; a plan arriving while
    one is open is SKIPPED, not queued, because a queued plan is a different
    trade by the time it fills. */
export function sequential(rows){
  const sorted = rows.slice().sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));
  const taken = [];
  let freeAt = -Infinity;
  for (const t of sorted){
    const at = Date.parse(t.tISO);
    if (!isFinite(at) || at < freeAt) continue;
    const out = Date.parse(t.exitISO);
    taken.push(t);
    freeAt = isFinite(out) ? out : at;
  }
  return taken;
}

/** The verdict, as its own function so the EVERY can be tested.

    Left inline it could not be: all six real trials beat the desk, so a
    mutation swapping `every` for `some` changed nothing observable and
    survived — a verdict rule that would have accepted ONE agreeing split,
    which is the failure hg-v920 exists to prevent. Given mixed trials the two
    differ, so the rule is now exercised on mixed trials.

    Beating the desk and paying are deliberately separate: this pack's whole
    finding is that one happened unanimously and the other never did. */
export function verdict(trials){
  const beats = (t) => t.onTest.n > 0 && t.onTest.net > t.deskTest.net;
  const pays  = (t) => t.onTest.n > 0 && t.onTest.net > 0;
  return {
    trials: trials.length,
    beatsDeskCount: trials.filter(beats).length,
    paysCount: trials.filter(pays).length,
    beatsDeskAll: trials.length > 0 && trials.every(beats),
    paysAll: trials.length > 0 && trials.every(pays)
  };
}

export function run(){
  const src = readFileSync(join(HERE, '..', 'milligold.js'), 'utf8');
  const ship = shippedRoster(src);
  const out = { generated: new Date().toISOString(), minN: MIN_N,
                shipped: [...ship].sort(), ends: {}, forward: {} };

  for (const end of ENDS){
    const book = ogBook(end);
    const mine = book.filter((t) => ship.has(String(t.kind)));
    out.ends[end] = {
      all:      { desk: expectancy(book),             milli: expectancy(mine) },
      oneAtATime: { desk: expectancy(sequential(book)), milli: expectancy(sequential(mine)) }
    };

    /* THE FORWARD TEST. The roster is rebuilt from the training slice ONLY,
       then judged on the slice that came after it. The shipped roster is also
       scored on the same tail, and it is CONTAMINATED there by construction —
       it was chosen on the whole walk, test tail included — so the two are
       reported side by side rather than one standing for the other. */
    const fwd = [];
    for (const f of SPLITS){
      const cut = Math.floor(book.length * f);
      const train = book.slice(0, cut), test = book.slice(cut);
      const learned = rosterFrom(train);
      fwd.push({
        split: f, trainN: train.length, testN: test.length,
        learnedSize: learned.size,
        learned: [...learned].sort(),
        overlap: [...learned].filter((k) => ship.has(k)).length,
        onTest:   expectancy(test.filter((t) => learned.has(String(t.kind)))),
        deskTest: expectancy(test),
        shippedOnTest: expectancy(test.filter((t) => ship.has(String(t.kind))))
      });
    }
    out.forward[end] = fwd;
  }

  /* A verdict needs the forward test to beat the desk at EVERY split and at
     BOTH fill bounds — the hg-v918/v922 bar. Beating the desk is not the same
     as paying, so `pays` is tracked separately and both are reported. */
  const trials = [];
  for (const end of ENDS) for (const f of out.forward[end]) trials.push(f);
  Object.assign(out, verdict(trials));
  return out;
}

/* ---- the literal the tab renders ----------------------------------------
   Generated, never typed (the hg-v921 rule). A forward result quoted from
   memory rots exactly as an in-sample boast does, and this one exists to stop
   the tab leading with the number that flatters it. */
export const SRC_PATH = join(HERE, '..', 'milligold.js');
export const BEGIN = '/* --- BEGIN GENERATED HG_MILLI_FORWARD';
export const END = '/* --- END GENERATED HG_MILLI_FORWARD --- */';

export function renderForward(r){
  const rows = [];
  for (const end of ENDS) for (const f of r.forward[end]){
    rows.push('      { end: \'' + end + '\', split: ' + f.split
      + ', n: ' + f.onTest.n + ', milliNet: ' + f.onTest.net
      + ', deskNet: ' + f.deskTest.net
      + ', learned: ' + f.learnedSize + ', shared: ' + f.overlap + ' }');
  }
  const e0 = r.ends['as-recorded'], e1 = r.ends.lower;
  return 'var HG_MILLI_FORWARD = {\n'
    + '    trials: ' + r.trials + ', beatsDesk: ' + r.beatsDeskCount
    + ', pays: ' + r.paysCount + ',\n'
    + '    beatsDeskAll: ' + (r.beatsDeskAll ? 'true' : 'false')
    + ', paysAll: ' + (r.paysAll ? 'true' : 'false') + ',\n'
    + '    shippedSize: ' + r.shipped.length
    + ', sharedMin: ' + Math.min(...ENDS.flatMap((e) => r.forward[e].map((f) => f.overlap)))
    + ', sharedMax: ' + Math.max(...ENDS.flatMap((e) => r.forward[e].map((f) => f.overlap))) + ',\n'
    + '    inSampleNet: ' + e0.all.milli.net + ', inSampleNetLower: ' + e1.all.milli.net + ',\n'
    + '    deskNet: ' + e0.all.desk.net + ', deskNetLower: ' + e1.all.desk.net + ',\n'
    + '    seqMilliNet: ' + e0.oneAtATime.milli.net + ', seqDeskNet: ' + e0.oneAtATime.desk.net + ',\n'
    + '    worstForwardNet: ' + Math.min(...ENDS.flatMap((e) => r.forward[e].map((f) => f.milliNet ?? f.onTest.net))) + ',\n'
    + '    bestForwardNet: ' + Math.max(...ENDS.flatMap((e) => r.forward[e].map((f) => f.onTest.net))) + ',\n'
    + '    splits: [\n' + rows.join(',\n') + '\n    ]\n  };';
}

export function splice(src, body){
  const i = src.indexOf(BEGIN), j = src.indexOf(END);
  if (i < 0 || j < 0 || j < i) throw new Error('HG_MILLI_FORWARD markers not found in milligold.js');
  const headEnd = src.indexOf('*/', i);
  if (headEnd < 0 || headEnd > j) throw new Error('HG_MILLI_FORWARD header unterminated');
  return src.slice(0, headEnd + 2) + '\n  ' + body + '\n  ' + src.slice(j);
}

export function write(r){
  const src = readFileSync(SRC_PATH, 'utf8');
  const next = splice(src, renderForward(r));
  const drift = next !== src;
  if (drift) writeFileSync(SRC_PATH, next);
  return drift;
}

if (process.argv[1] && basename(process.argv[1]) === 'milli-gold-walk.mjs'){
  const r = run();
  const pc = (x) => (isFinite(x) ? (x * 100).toFixed(1) + '%' : '—');
  const rr = (x) => (isFinite(x) ? ((x >= 0 ? '+' : '') + x.toFixed(4)) : '—');
  console.log('MILLI GOLD — the roster as a book, and as a forward test');
  console.log('shipped roster: ' + r.shipped.length + ' mechanics · ' + r.shipped.join(' ') + '\n');

  console.log('1. BACKTEST — the roster book vs the whole desk');
  for (const end of ENDS){
    const e = r.ends[end];
    console.log('  [' + end + ']');
    for (const [label, k] of [['all at once', 'all'], ['one at a time', 'oneAtATime']]){
      const d = e[k].desk, m = e[k].milli;
      console.log('    ' + label.padEnd(14)
        + 'desk  n=' + String(d.n).padStart(5) + '  win ' + pc(d.win) + '  gross ' + rr(d.gross) + '  net ' + rr(d.net));
      console.log('    ' + ''.padEnd(14)
        + 'MILLI n=' + String(m.n).padStart(5) + '  win ' + pc(m.win) + '  gross ' + rr(m.gross) + '  net ' + rr(m.net));
    }
  }

  console.log('\n2. FORWARD TEST — roster built on the PAST, judged on what came after');
  for (const end of ENDS){
    console.log('  [' + end + ']');
    for (const f of r.forward[end]){
      console.log('    train ' + (f.split * 100).toFixed(0) + '%  (' + f.learnedSize
        + ' mechanics, ' + f.overlap + ' shared with the shipped roster)');
      console.log('      learned roster on test : n=' + String(f.onTest.n).padStart(4)
        + '  win ' + pc(f.onTest.win) + '  gross ' + rr(f.onTest.gross) + '  net ' + rr(f.onTest.net));
      console.log('      whole desk on test     : n=' + String(f.deskTest.n).padStart(4)
        + '  win ' + pc(f.deskTest.win) + '  gross ' + rr(f.deskTest.gross) + '  net ' + rr(f.deskTest.net));
      console.log('      SHIPPED roster on test : n=' + String(f.shippedOnTest.n).padStart(4)
        + '  net ' + rr(f.shippedOnTest.net) + '   (contaminated — chosen on the whole walk)');
    }
  }
  console.log('\nbeats the desk in ' + r.beatsDeskCount + ' of ' + r.trials + ' forward trials'
    + (r.beatsDeskAll ? '  — UNANIMOUS' : ''));
  console.log('net-positive in   ' + r.paysCount + ' of ' + r.trials + ' forward trials'
    + (r.paysAll ? '  — UNANIMOUS' : ''));
  if (process.argv.includes('--write')) console.log(write(r) ? 'WROTE milligold.js' : 'no drift');
  else { const src2 = readFileSync(SRC_PATH, 'utf8');
         if (splice(src2, renderForward(r)) !== src2){ console.log('DRIFT — run with --write'); process.exitCode = 1; } }
}
