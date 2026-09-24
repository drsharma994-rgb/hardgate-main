#!/usr/bin/env node
/**
 * hg-v944 — what the ICT killzone demote costs GOLD SCALP, and what the
 * evidence for it actually is.
 *
 * goldind.js demotes every setup formed outside an ICT killzone:
 *
 *   var inKillzone = !!(D.kz && D.kz.weight > 0);
 *   if (!inKillzone && !(key === 'asian' && ...)) { demoted = true; ... }
 *
 * A demoted row can never be MOST PROBABLE, so this is not a tie-break — it
 * decides who may lead. This script measures (a) how much of the book that
 * withholds and (b) whether time of day separates outcomes at all, using the
 * same bar every other gold verdict in this repo has to clear: four DISJOINT
 * windows agreeing on win% AND gross AND net, at BOTH fill bounds.
 *
 * It decides nothing. goldind.js carries the literal and renders it; the
 * demote is UNCHANGED, because the evidence does not clear the bar in either
 * direction (see the refusal recorded in the output).
 *
 * Usage: node scripts/session-separation.mjs [--write] [--json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { scalpBook, measure, MIN_SIDE_SCALP, WINDOWS } from './factor-separation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPLAY = join(HERE, 'backtest-goldscalp-results-floor.json');
export const TARGET = join(HERE, '..', 'goldind.js');
export const BEGIN = '/* --- BEGIN GENERATED HG_GOLD_SESSION_SEP (scripts/session-separation.mjs) ---';
export const END = '/* --- END GENERATED HG_GOLD_SESSION_SEP --- */';

const r4 = (x) => Math.round(x * 10000) / 10000;
const r1 = (x) => Math.round(x * 10) / 10;

/* The splits worth reporting: the demoted cohort itself, and each killzone
   the demote FAVOURS. A factor that decides who may lead should separate. */
export const SPLITS = [
  ['offSession',  (t) => +t.killzoneWeight === 0],
  ['kzAny',       (t) => +t.killzoneWeight >= 1],
  ['kzMax',       (t) => +t.killzoneWeight === 3],
  ['overlap',     (t) => /OVERLAP/.test(t.killzone || '')],
  ['london',      (t) => /LONDON KILLZONE/.test(t.killzone || '')],
  ['nyAm',        (t) => /NY AM/.test(t.killzone || '')],
  ['asian',       (t) => /ASIAN/.test(t.killzone || '')]
];

/* Every stamp in the walk that also demotes. Enumerated rather than inferred,
   so the SOLE-BLOCKER count below can be audited: a stamp missing from this
   list would inflate it. `CONF nn/NO_TRADE` is normalised because the score is
   in the stamp text. */
export const DEMOTE_STAMPS = new Set(['EDGE DEMOTE', 'EDGE SUPPRESS', 'CHOP',
  'MTF BIAS', 'MTF CONFLICT', 'OB TRAP', 'SWEEP BLOCK', 'NEWS-FADE',
  'CONVICTION LOCK', 'REGIME MR', 'COUNTER-TREND', 'ASIA SESSION', 'S60 HALF',
  'S56 BALANCE', 'CONF NO TRADE']);

export function otherDemotes(t){
  const out = [];
  for (const s of (t && t.stamps) || []){
    if (s === 'OFF-SESSION') continue;
    const k = (/^CONF /.test(s) && /NO/i.test(s)) ? 'CONF NO TRADE' : s;
    if (DEMOTE_STAMPS.has(k)) out.push(k);
  }
  return out;
}

/* What the demote withholds — and, the number that actually matters, how
   often it is the ONLY thing withholding it. hg-v184 built this discipline for
   crypto (cgSoleBlocker: what relaxing a gate would BUY) and hg-v929 applied
   it to the gold R:R floor. A share is not a cost. */
export function coverage(path = REPLAY){
  const all = JSON.parse(readFileSync(path, 'utf8')).trades
    .filter((t) => typeof t.killzoneWeight === 'number');
  const off = all.filter((t) => (t.stamps || []).indexOf('OFF-SESSION') >= 0);
  const offDemoted = off.filter((t) => t.demoted).length;
  const sole = off.filter((t) => otherDemotes(t).length === 0);
  const co = {};
  for (const t of off) for (const s of otherDemotes(t)) co[s] = (co[s] || 0) + 1;
  const coTop = Object.entries(co).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => [k, v]);
  const led = all.filter((t) => t.mp);
  const ledOff = led.filter((t) => t.killzoneWeight === 0).length;
  return {
    n: all.length,
    off: off.length, offPct: r1(off.length / all.length * 100),
    offDemoted, offDemotedPct: r1(offDemoted / Math.max(1, off.length) * 100),
    sole: sole.length, solePctOfOff: r1(sole.length / Math.max(1, off.length) * 100),
    solePctOfBook: r1(sole.length / all.length * 100),
    coTop,
    led: led.length, ledOff, ledOffPct: r1(ledOff / Math.max(1, led.length) * 100)
  };
}

export function run(){
  const out = { windows: WINDOWS, coverage: coverage(), splits: {} };
  for (const end of ['as-recorded', 'lower']){
    const book = scalpBook(end);
    for (const [name, f] of SPLITS){
      const m = measure(book, f, MIN_SIDE_SCALP, (t) => +t.rr);
      out.splits[name] = out.splits[name] || {};
      out.splits[name][end] = m.thin
        ? { thin: true }
        : { nA: m.nA, dWin: r1(m.dWin), dGross: r4(m.dGross), dNet: r4(m.dNet),
            windows: m.winQ[0] + '/' + m.winQ[1], unanimous: m.unanimous, sign: m.sign };
    }
  }
  /* The verdict is an EXPORTED function, not an inline expression: hg-v937
     learned that an inline `every` over trials that all agree survives being
     mutated to `some`. A split ships a verdict only when both fill bounds are
     unanimous AND agree with each other. */
  out.verdicts = {};
  for (const [name] of SPLITS) out.verdicts[name] = verdict(out.splits[name]);
  out.anyVerdict = Object.values(out.verdicts).some((v) => v !== null);
  return out;
}

export function verdict(byEnd){
  if (!byEnd) return null;
  const a = byEnd['as-recorded'], b = byEnd['lower'];
  if (!a || !b || a.thin || b.thin) return null;
  if (!a.unanimous || !b.unanimous) return null;
  if (a.sign !== b.sign) return null;
  return a.sign;
}

export function renderLiteral(res){
  const s = (k) => res.splits[k];
  const line = (k) => {
    const a = s(k)['as-recorded'], b = s(k).lower;
    if (a.thin || b.thin) return `    ${k}: { thin: true },`;
    return `    ${k}: { dWin: [${a.dWin}, ${b.dWin}], dGross: [${a.dGross}, ${b.dGross}], `
      + `dNet: [${a.dNet}, ${b.dNet}], windows: ['${a.windows}', '${b.windows}'], `
      + `verdict: ${res.verdicts[k] ? `'${res.verdicts[k]}'` : 'null'} },`;
  };
  const c = res.coverage;
  return BEGIN + `
   Re-derive with \`node scripts/session-separation.mjs --write\`. Do not
   hand-edit — hg-v921 made these literals write themselves. Every figure is
   from scripts/backtest-goldscalp-results-floor.json.

   dWin / dGross / dNet are [as-recorded, lower-fill-bound]; \`windows\` is how
   many of the ${res.windows} DISJOINT windows agreed, at each bound. A verdict
   needs BOTH bounds unanimous AND agreeing — nothing here has one. */
  var HG_GOLD_SESSION_SEP = {
    windows: ${res.windows},
    coverage: { n: ${c.n}, off: ${c.off}, offPct: ${c.offPct},
                offDemoted: ${c.offDemoted}, offDemotedPct: ${c.offDemotedPct},
                sole: ${c.sole}, solePctOfOff: ${c.solePctOfOff}, solePctOfBook: ${c.solePctOfBook},
                coTop: ${JSON.stringify(c.coTop)},
                led: ${c.led}, ledOff: ${c.ledOff}, ledOffPct: ${c.ledOffPct} },
    splits: {
${SPLITS.map(([k]) => line(k)).join('\n')}
    },
    anyVerdict: ${res.anyVerdict}
  };
  ` + END;
}

export function splice(src, block){
  const i = src.indexOf(BEGIN);
  if (i < 0) throw new Error('BEGIN marker not found in goldind.js — fatal, never skipped');
  const j = src.indexOf(END, i);
  if (j < 0) throw new Error('END marker not found in goldind.js — fatal, never skipped');
  return src.slice(0, i) + block + src.slice(j + END.length);
}

function main(){
  const res = run();
  const write = process.argv.includes('--write');
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); return; }
  const c = res.coverage;
  console.log('hg-v944 — the ICT killzone demote on GOLD SCALP\n');
  console.log(`  formed setups outside every killzone: ${c.off} of ${c.n} (${c.offPct}%)`);
  console.log(`  ...of which DEMOTED:                  ${c.offDemoted} (${c.offDemotedPct}%)`);
  console.log(`  MOST PROBABLE rows that were off-session: ${c.ledOff} of ${c.led} (${c.ledOffPct}%)`);
  console.log(`  ...but OFF-SESSION is the SOLE demote on only ${c.sole} rows `
    + `(${c.solePctOfOff}% of those, ${c.solePctOfBook}% of the walk)`);
  console.log(`  co-occurring demotes: ${c.coTop.map(([k, v]) => k + ' ' + v).join(' · ')}\n`);
  /* built as a template string: console.log does not honour %-11s width
     specifiers, and a half-formatted table is how a number gets misread */
  console.log('  ' + 'split'.padEnd(11) + 'dWin'.padStart(12) + 'dGross'.padStart(18)
    + 'dNet'.padStart(18) + 'windows'.padStart(10) + 'verdict'.padStart(10));
  for (const [k] of SPLITS){
    const a = res.splits[k]['as-recorded'], b = res.splits[k].lower;
    if (a.thin || b.thin){ console.log('  ' + k.padEnd(11) + 'thin'); continue; }
    console.log('  ' + k.padEnd(11)
      + `${a.dWin}/${b.dWin}`.padStart(12)
      + `${a.dGross}/${b.dGross}`.padStart(18)
      + `${a.dNet}/${b.dNet}`.padStart(18)
      + `${a.windows},${b.windows}`.padStart(10)
      + (res.verdicts[k] || 'none').padStart(10));
  }
  console.log('\n  any split with a verdict at both bounds: %s', res.anyVerdict ? 'YES' : 'NO');
  const block = renderLiteral(res);
  const src = readFileSync(TARGET, 'utf8');
  const next = splice(src, block);
  if (next === src){ console.log('\nno drift'); return; }
  if (!write){ console.log('\nDRIFT — run with --write'); process.exitCode = 1; return; }
  writeFileSync(TARGET, next);
  console.log('\nWROTE goldind.js');
}
/* basename, not endsWith: tests/test-session-separation.mjs also ends with
   this filename, and hg-v934/v935 both shipped that bug. */
if (basename(process.argv[1] || '') === 'session-separation.mjs') main();
