#!/usr/bin/env node
/**
 * hg-v962 — what the GOLD SWING edge verdicts are actually measured on, and
 * why the obvious scoping is REFUSED.
 *
 * hg-v916 gave every SCALP row a `live` block because the scalp headline is
 * the whole 2,193-trade replay and the desk forms 1,205 of it: a real subset,
 * and the gap is the point. hg-v961 gave the SWING rows a `live` block and
 * described it the same way. It is not the same thing. On all fourteen swing
 * rows the live block REPRODUCES THE HEADLINE — the swing headline was already
 * derived from this same walk before hg-v961 touched it, proved against the
 * pre-hg-v961 tree, 14 of 14. So hg-v961's "0 removals" was true and
 * uninformative: it checked the SCALP desk's three gates (cost bar, stop
 * floor, suppress), none of which is the swing desk's.
 *
 * What the swing desk actually does that this walk does not is recorded in the
 * artifact's OWN metadata, under `deviations`:
 *
 *   "runScan-only pipeline stages ... are not replayed: ... hgFilterGoldPostGate,
 *    weekend demotes, best-levels/formation ticket batch ... — candidates carry
 *    the inline engine's own levels"
 *
 * hgApplyGoldBestLevels rewrites ENTRY, STOP and T1 on every live swing
 * ticket. Those three numbers decide whether a trade fills, where it stops and
 * what it wins. So the population behind every swing verdict is a
 * PRE-FORMATION book, and the desk's own population is unmeasured.
 *
 * THE OBVIOUS FIX IS REFUSED, and this script is the measurement that shows
 * why. Scoping the walk to rows clearing the tab's own R:R floor
 * (HG_GOLD_SWING_MIN_RR, gold-best-levels.js) flips two rows' net sign. But
 * the walk's `rr` is computed on the INLINE ENGINE's levels, and the floor is
 * applied by the pass that REPLACES them — so filtering a pre-snap ratio
 * against a post-snap floor is a second wrong population, not a correction.
 * A trade the walk records at rr 1.3 may clear the floor once best-levels
 * snaps it, and one recorded at 1.9 may fail. No verdict moves.
 *
 * Nothing here decides an action. It reports; goldind.js carries the numbers
 * and tests/test-gold-swing-live-scope.mjs re-runs this against the artifact
 * so the literal cannot drift away from the file it cites.
 *
 * Usage: node scripts/swing-live-scope.mjs [--json] [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { GOLD_SWING_WALK } from '../lib/gold-artifacts.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
export const REPLAY = GOLD_SWING_WALK;      /* hg-v959: one home */

/* The tab's own formation floor. Read from gold-best-levels.js rather than
   retyped: hg-v944 found a guard asserting 15 swing keys where the table held
   14 because it parsed a fixed window instead of reading the source of truth,
   and AGENTS.md states this floor as 2.0 where the file says 1.5 — so a
   hand-typed copy here would be a third value. */
export function swingMinRrFromSource(root = ROOT){
  const src = readFileSync(join(root, 'gold-best-levels.js'), 'utf8');
  const m = /var\s+HG_GOLD_SWING_MIN_RR\s*=\s*([0-9.]+)\s*;/.exec(src);
  if (!m) throw new Error('HG_GOLD_SWING_MIN_RR not found in gold-best-levels.js — '
    + 'the floor this scoping uses has no source, and inventing one is the defect '
    + 'this script exists to refuse');
  return +m[1];
}

/* The stages the walk does not replay, quoted from the artifact rather than
   asserted here — the claim must come from the file it describes. */
export function unreplayedStages(path = REPLAY){
  const meta = JSON.parse(readFileSync(path, 'utf8')).meta || {};
  const devs = Array.isArray(meta.deviations) ? meta.deviations : [];
  return devs.filter(d => /not replayed|runScan-only/.test(String(d)));
}

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const r3 = (x) => Math.round(x * 1000) / 1000;
const r4 = (x) => Math.round(x * 10000) / 10000;

/* Table keys are evidence labels; the walk records stratKeys. One alias, the
   same one goldind.js's own apply path uses (wkbreak -> weekly). */
export const SWING_KEY_ALIAS = { wkbreak: 'weekly' };

export function swingScope(path = REPLAY, minRr = null, root = ROOT){
  const floor = (typeof minRr === 'number') ? minRr : swingMinRrFromSource(root);
  const book = JSON.parse(readFileSync(path, 'utf8')).trades
    .filter(t => typeof t.netR === 'number' && !t.shadow);

  const byKey = new Map();
  for (const t of book){
    const k = SWING_KEY_ALIAS[t.stratKey] || t.stratKey;
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(t);
  }

  const rows = {};
  let flips = 0, rrAbsent = 0;
  for (const [k, all] of byKey){
    const withRr = all.filter(t => typeof t.rr === 'number' && isFinite(t.rr));
    rrAbsent += all.length - withRr.length;
    const kept = withRr.filter(t => t.rr >= floor - 1e-9);
    const a = { n: all.length, gross: r4(mean(all.map(t => t.rGross))), net: r3(mean(all.map(t => t.netR))) };
    const s = kept.length
      ? { n: kept.length, gross: r4(mean(kept.map(t => t.rGross))), net: r3(mean(kept.map(t => t.netR))) }
      : null;
    /* "flip" is the sign of NET changing, which is the only bar the shared
       demote rule reads (hg-v961: demoteMinN is 0 on both desks). */
    const flipped = !!(s && (a.net < 0) !== (s.net < 0));
    if (flipped) flips++;
    rows[k] = { all: a, scoped: s, flipped };
  }

  const underFloor = book.filter(t => typeof t.rr === 'number' && t.rr < floor - 1e-9).length;
  return {
    walk: 'scripts/' + REPLAY.split(/[/\\]/).pop(),
    settled: book.length,
    minRr: floor,
    underFloor,
    underFloorPct: r3(100 * underFloor / book.length),
    rrAbsent,
    rows,
    flips,
    /* The verdict is a field, not a sentence: a panel branches on it, so a
       future bake that CAN replay best-levels announces itself rather than
       hiding behind today's refusal (hg-v935, hg-v944). */
    verdict: 'REFUSED',
    why: 'the walk computes rr on the inline engine levels; the floor is applied by '
       + 'the best-levels pass that REPLACES them, so scoping a pre-snap ratio by a '
       + 'post-snap floor is a second wrong population, not a correction',
    unreplayed: unreplayedStages(path).length
  };
}

/* ---- literal writer (hg-v921: generated things write themselves) ---- */
export function literalText(sc){
  const keys = Object.keys(sc.rows).sort();
  const body = keys.map(k => {
    const r = sc.rows[k];
    const s = r.scoped
      ? `{ n: ${r.scoped.n}, gross: ${r.scoped.gross}, net: ${r.scoped.net} }`
      : 'null';
    return `    ${k}: { all: { n: ${r.all.n}, gross: ${r.all.gross}, net: ${r.all.net} },`
         + ` scoped: ${s}, flipped: ${r.flipped} }`;
  }).join(',\n');
  return `var HG_GOLD_SWING_SCOPE = {
  walk: '${sc.walk}', settled: ${sc.settled}, minRr: ${sc.minRr},
  underFloor: ${sc.underFloor}, underFloorPct: ${sc.underFloorPct}, rrAbsent: ${sc.rrAbsent},
  flips: ${sc.flips}, unreplayed: ${sc.unreplayed},
  verdict: '${sc.verdict}',
  why: '${sc.why.replace(/'/g, "\\'")}',
  rows: {
${body}
  }
};`;
}

export function writeLiteral(sc, root = ROOT){
  const p = join(root, 'goldind.js');
  const src = readFileSync(p, 'utf8');
  const start = src.indexOf('var HG_GOLD_SWING_SCOPE = {');
  if (start < 0) throw new Error('HG_GOLD_SWING_SCOPE block not found in goldind.js — '
    + 'a generated block the generator cannot locate is FATAL, never skipped (hg-v921)');
  const end = src.indexOf('\n};', start);
  if (end < 0) throw new Error('HG_GOLD_SWING_SCOPE block has no terminator');
  const next = src.slice(0, start) + literalText(sc) + src.slice(end + 3);
  const changed = next !== src;
  if (changed) writeFileSync(p, next);
  return changed;
}

/* Main-module check by RESOLVED PATH, not by suffix. The first cut asked
   whether argv[1] ends with this filename, and tests/test-gold-swing-live-scope.mjs
   ends with exactly that string — so importing the module from its own guard
   ran the whole CLI report into the test output. A suffix is not an identity. */
const IS_MAIN = (() => {
  try{ return process.argv[1]
    && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)); }
  catch(e){ return false; }
})();
if (IS_MAIN){
  const sc = swingScope();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(sc, null, 1)); }
  else {
    console.log('walk            ' + sc.walk);
    console.log('settled         ' + sc.settled + '   rr absent on ' + sc.rrAbsent);
    console.log('tab R:R floor   ' + sc.minRr + '  (read from gold-best-levels.js)');
    console.log('under the floor ' + sc.underFloor + ' of ' + sc.settled + '  (' + sc.underFloorPct + '%)');
    console.log('unreplayed stage lines in the artifact meta: ' + sc.unreplayed);
    console.log('');
    console.log('row        all (n, gross, net)        scoped rr>=' + sc.minRr + '        sign');
    for (const k of Object.keys(sc.rows).sort()){
      const r = sc.rows[k];
      const a = `(${r.all.n}, ${r.all.gross}, ${r.all.net})`;
      const s = r.scoped ? `(${r.scoped.n}, ${r.scoped.gross}, ${r.scoped.net})` : '(none)';
      console.log('  ' + k.padEnd(9) + a.padEnd(26) + s.padEnd(26) + (r.flipped ? 'FLIPS' : ''));
    }
    console.log('');
    console.log('verdict: ' + sc.verdict + ' — ' + sc.why);
    console.log(sc.flips + ' row(s) would flip net sign; NO VERDICT MOVES.');
  }
  if (process.argv.includes('--write')){
    const changed = writeLiteral(sc);
    console.log(changed ? 'goldind.js — HG_GOLD_SWING_SCOPE rewritten'
                        : 'goldind.js — HG_GOLD_SWING_SCOPE already matches the artifact');
  }
}
