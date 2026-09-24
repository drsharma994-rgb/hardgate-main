#!/usr/bin/env node
/* HARDGATE hg-v945 — does the machinery that withholds gold setups measure?
 *
 * GOLD SCALP demotes a setup with a STAMP, and since hg-v930 a demoted row can
 * never be MOST PROBABLE. Every demote is absolute and every demote is equal:
 * a row held back by CONF NO TRADE is as unable to lead as one held back by
 * EDGE DEMOTE. Nothing had ever asked whether those stamps SEPARATE OUTCOMES.
 *
 * The procedure is hg-v922's, reused rather than rebuilt: the population the
 * desk forms TODAY (hg-v916 — suppressed kinds and sub-cost stops dropped),
 * four DISJOINT windows (hg-v920 — nested splits share their tail), and BOTH
 * fill bounds (hg-v918 — the lower bound deletes unprovable wins and keeps
 * unprovable losses). A stamp carries a verdict only when every judged window
 * agrees on win AND gross AND net, at BOTH bounds, in the same direction.
 *
 * WHAT THIS IS NOT. It is not a licence to drop a demote that fails to
 * measure. hg-v920 refused three loosenings on exactly this evidence and
 * hg-v944 refused a fourth; a stamp with no verdict is a stamp nobody has
 * shown either way, not a stamp shown to be useless. Nothing here gates.
 *
 * Re-derive: node scripts/demote-separation.mjs
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { scalpBook, measure, WINDOWS, MIN_SIDE_SCALP } from './factor-separation.mjs';
import { DEMOTE_STAMPS as CO_DEMOTES } from './session-separation.mjs';

/* ONE list of what demotes, not two. hg-v944 enumerated the co-blockers of
 * OFF-SESSION, so its set is every demote EXCEPT the one that pack was
 * measuring. Union it back rather than retyping fifteen strings that would
 * then drift apart. */
export const SUBJECT_OF_V944 = 'OFF-SESSION';
export const DEMOTES = new Set([...CO_DEMOTES, SUBJECT_OF_V944]);

export const BOUNDS = ['as-recorded', 'lower'];

/* The bar, as its own function. hg-v937 shipped a verdict inline and a
 * `every`->`some` mutation survived because every trial happened to agree;
 * exported, it can be exercised on disagreeing input. */
export function verdict(a, l){
  if (!a || !l || a.thin || l.thin) return null;
  if (!a.unanimous || !l.unanimous) return null;
  if (a.sign !== l.sign) return null;
  return a.sign;                       /* 'better' | 'worse' */
}

/* WHICH WAY a stamp points is not WHETHER it carries a verdict, and the two
 * get conflated the moment one is left to prose. `lean` is the sign of the
 * net gap when both bounds agree on it -- a direction, nothing more. Three
 * stamps here lean 'better' (the desk demotes its better rows) and NONE of
 * them is unanimous, so none is a verdict and none may be acted on. Reported
 * so the distinction is in the output rather than in a sentence about it. */
export function lean(a, l){
  if (!a || !l || a.thin || l.thin) return null;
  if (!isFinite(a.dNet) || !isFinite(l.dNet)) return null;
  if (a.dNet === 0 || l.dNet === 0) return null;
  if ((a.dNet > 0) !== (l.dNet > 0)) return null;   /* the bounds disagree */
  return a.dNet > 0 ? 'better' : 'worse';
}

/* Which stamps are even testable. A stamp needs MIN_SIDE_SCALP a side in each
 * of the four windows to be judged at all, so the floor is stated once here
 * and the thin ones are REPORTED rather than dropped in silence. */
export function candidates(book){
  const freq = new Map();
  for (const t of book) for (const s of (t.stamps || [])) freq.set(s, (freq.get(s) || 0) + 1);
  const floor = MIN_SIDE_SCALP * WINDOWS;
  const out = { testable: [], thin: [], notADemote: [] };
  for (const [s, n] of [...freq.entries()].sort((x, y) => y[1] - x[1])){
    if (!DEMOTES.has(s)){ out.notADemote.push({ stamp: s, n: n }); continue; }
    if (n < floor || (book.length - n) < floor){ out.thin.push({ stamp: s, n: n }); continue; }
    out.testable.push({ stamp: s, n: n });
  }
  return out;
}

export function run(opts){
  opts = opts || {};
  const books = {};
  for (const end of BOUNDS) books[end] = scalpBook(end, opts.path);
  const base = books['as-recorded'];
  const cand = candidates(base);
  const rows = [];
  for (const c of cand.testable){
    const pick = (t) => (t.stamps || []).indexOf(c.stamp) >= 0;
    const m = {};
    for (const end of BOUNDS) m[end] = measure(books[end], pick, MIN_SIDE_SCALP, (t) => +t.rr);
    const v = verdict(m['as-recorded'], m.lower);
    rows.push({ stamp: c.stamp, n: c.n, asRecorded: m['as-recorded'], lower: m.lower,
                verdict: v, lean: lean(m['as-recorded'], m.lower) });
  }
  return {
    bookN: base.length,
    family: cand.testable.length,
    testable: cand.testable, thin: cand.thin, notADemote: cand.notADemote,
    rows: rows,
    supported: rows.filter((r) => r.verdict === 'worse').map((r) => r.stamp),
    wrongWay: rows.filter((r) => r.verdict === 'better').map((r) => r.stamp),
    noVerdict: rows.filter((r) => !r.verdict).map((r) => r.stamp),
    /* leans the wrong way and carries NO verdict: the strongest thing a
       re-bake could be pointed at, and the weakest thing to act on today */
    leansBetterNoVerdict: rows.filter((r) => !r.verdict && r.lean === 'better')
      .map((r) => r.stamp)
  };
}

function fmt(x, w){ return String(x).padStart(w); }

if (basename(process.argv[1] || '') === 'demote-separation.mjs'){
  const out = run();
  console.log('hg-v945 demote separation — %d trades the desk forms today, '
    + '%d disjoint windows, both fill bounds', out.bookN, WINDOWS);
  console.log('family: %d demote stamps testable; %d too thin to judge; '
    + '%d stamps in the book are not demotes\n',
    out.family, out.thin.length, out.notADemote.length);
  const head = 'stamp'.padEnd(20) + fmt('n', 6) + fmt('dWin', 8) + fmt('dGross', 10)
    + fmt('dNet', 10) + '  windows(w/g/n)   verdict';
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const r of out.rows){
    for (const end of BOUNDS){
      const m = r[end === 'lower' ? 'lower' : 'asRecorded'];
      const q = `${m.winQ[0]}/${m.winQ[1]} ${m.grossQ[0]}/${m.grossQ[1]} ${m.netQ[0]}/${m.netQ[1]}`;
      console.log((end === 'lower' ? '' : r.stamp).padEnd(20)
        + fmt(end === 'lower' ? 'lower' : r.n, 6)
        + fmt(m.dWin, 8) + fmt(m.dGross, 10) + fmt(m.dNet, 10)
        + '  [' + q + ']'
        + (end === 'lower' ? ''
             : '  ' + (r.verdict ? r.verdict.toUpperCase()
                                 : (r.lean ? 'no verdict (leans ' + r.lean + ')'
                                           : 'no verdict'))));
    }
  }
  console.log('\nsupported (demoted rows measurably WORSE): %s',
    out.supported.length ? out.supported.join(', ') : 'none');
  console.log('point the WRONG way WITH a verdict: %s',
    out.wrongWay.length ? out.wrongWay.join(', ') : 'none');
  console.log('lean the wrong way with NO verdict (not actionable, but where a '
    + 're-bake should look): %s',
    out.leansBetterNoVerdict.length ? out.leansBetterNoVerdict.join(', ') : 'none');
  console.log('no verdict: %s', out.noVerdict.join(', '));
  console.log('\nNothing here gates. A stamp with no verdict is one nobody has shown '
    + 'either way\n(hg-v920 refused three loosenings on this evidence; hg-v944 a fourth).');
  if (out.thin.length) console.log('\ntoo thin to judge: '
    + out.thin.map((t) => t.stamp + ' (' + t.n + ')').join(', '));
}
