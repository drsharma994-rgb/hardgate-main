#!/usr/bin/env node
/**
 * hg-v921 — write the baked gold literals from the artifacts, instead of by hand.
 *
 * Five literal blocks in two browser files are derived numbers, and every one
 * of them was hand-transcribed into place:
 *
 *   goldind.js   HG_GOLD_SETUP_EDGE.scalp[*].live   <- scripts/edge-live-population.mjs
 *   omnigold.js  HG_OG_REPLAY_EVIDENCE.kinds[5..8]  <- scripts/omnigold-formed-population.mjs
 *   omnigold.js  sequentialCells                    <- omnigold-replay-evidence.json
 *   omnigold.js  sequentialTicketHorizon            <- omnigold-replay-evidence.json
 *   omnigold.js  stopBandGross                      <- omnigold-replay-evidence.json
 *
 * Hand-transcription is not a style complaint here: hg-v909 derived a block
 * from the wrong analysis file and shipped it, and three separate packs had a
 * figure go stale in one comment while its twin kept the guard green. A
 * re-bake that ends in "now paste 25 rows into two files" will drift again.
 *
 * This rewrites them in place from the committed artifacts. It changes no
 * threshold, no action and no prose — only the numbers that are supposed to
 * equal what the artifacts say. The existing guards
 * (test-gold-edge-live-population, test-omnigold-formed-population,
 * test-omnigold-sequential-cells, test-omnigold-cost-ceiling) re-derive every
 * one of them independently, so a bad write turns the suite red rather than
 * shipping.
 *
 * Usage:
 *   node scripts/rebake-gold-literals.mjs          report drift, write nothing
 *   node scripts/rebake-gold-literals.mjs --write  apply it
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { liveEdgePopulation } from './edge-live-population.mjs';
import { formedPopulation } from './omnigold-formed-population.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const WRITE = process.argv.includes('--write');

const g = (x) => {
  /* %g-style: shortest round-tripping form, matching what was written by hand */
  const s = String(x);
  return s;
};

/** Replace one `key: { ... },` block inside a slice, preserving indentation.
 *  entries is a Map of rowKey -> rendered value text.
 *
 *  KEY ORDER IS TAKEN FROM THE FILE, not from the artifact. A tool that
 *  rewrites source should produce the smallest diff that is correct: emitting
 *  JSON key order re-sorted the stop bands to >=1.733, <0.5, <0.32, <0.133 —
 *  same numbers, unreadable table, and a diff that hides what actually moved.
 *  Keys the file does not have are appended in artifact order; keys the
 *  artifact no longer has are dropped. */
function replaceBlock(src, from, to, key, entries){
  const region = src.slice(from, to);
  const re = new RegExp('^([ \\t]*)' + key + ': \\{[\\s\\S]*?^\\1\\},$', 'm');
  const m = region.match(re);
  if (!m) return null;
  const ind = m[1];
  const existing = [...m[0].matchAll(/^\s*'([^']+)':/gm)].map((x) => x[1]);
  const order = existing.filter((k) => entries.has(k))
    .concat([...entries.keys()].filter((k) => !existing.includes(k)));
  const lines = order.map((k, i) => "'" + k + "': " + entries.get(k) + (i < order.length - 1 ? ',' : ''));
  const rebuilt = ind + key + ': {\n'
    + lines.map((l) => ind + '  ' + l).join('\n') + '\n'
    + ind + '},';
  if (m[0] === rebuilt) return { src, changed: false };
  return { src: src.slice(0, from) + region.replace(re, rebuilt) + src.slice(to), changed: true };
}

const changes = [];

/* ---- 1. goldind.js: the live block on every scalp edge row ---- */
{
  const p = join(ROOT, 'goldind.js');
  let src = readFileSync(p, 'utf8');
  const a = src.indexOf('var HG_GOLD_SETUP_EDGE');
  const b = src.indexOf('  swing:', a);
  const rows = liveEdgePopulation().rows;
  let cur = null, out = [], n = 0;
  for (const line of src.slice(a, b).split('\n')){
    const lm = line.match(/^(\s+)live: (\{|null)/);
    if (lm){
      if (cur && rows[cur]){
        const v = rows[cur];
        const fn = v.formsNone ? ', formsNone: true' : '';
        /* hg-v923: precursorOnly is derived by the generator like every other
           field on this line, so it is emitted here rather than hand-kept —
           the writer stripping it is what the byte-identical guard caught. */
        const po = v.precursorOnly ? ', precursorOnly: true' : '';
        const next = lm[1] + 'live: { n: ' + v.n + ', net: ' + g(v.net)
          + ', oosHeld: ' + v.oosHeld + ', oosBroke: ' + v.oosBroke + fn + po + ' },';
        if (next !== line) n++;
        out.push(next); cur = null; continue;
      }
      out.push(line); cur = null; continue;
    }
    const km = line.match(/^\s{4}(\w+):\s+\{\s*n:\s/);
    if (km) cur = km[1];
    out.push(line);
  }
  const rebuilt = src.slice(0, a) + out.join('\n') + src.slice(b);
  if (rebuilt !== src){ changes.push({ file: 'goldind.js', what: 'scalp live blocks', rows: n, p, next: rebuilt }); }
  else changes.push({ file: 'goldind.js', what: 'scalp live blocks', rows: 0, p, next: null });
}

/* ---- 1b. the WALK SPAN blocks on both desks (hg-v927) ----------------
   Every verdict on either desk comes from one replay, and the only record of
   WHEN it ran used to be prose in a comment — which no desk can read and no
   re-bake updates. These two blocks are the machine-readable span, rewritten
   from the artifacts' own meta so the age the tabs print can never be a
   number somebody typed. */
function walkBlock(src, varName, meta, trades, srcPath){
  const a = src.indexOf('var ' + varName + ' = {');
  if (a < 0) return { err: varName + ' block not found' };
  const b = src.indexOf('};', a);
  if (b < 0) return { err: varName + ' block is unterminated' };
  /* slice to the LINE START, not to `a`: src.slice(0, a) already carries the
     original indent, so prepending it again doubled it. */
  const lineStart = src.lastIndexOf('\n', a) + 1;
  const m = /^(\s*)var /.exec(src.slice(lineStart));
  if (!m) return { err: varName + ' declaration is not at a line start' };
  const indent = m[1];
  const i2 = indent + '  ';
  const next = indent + 'var ' + varName + ' = {\n'
    + i2 + "from: '" + meta.span.from + "',\n"
    + i2 + "to: '" + meta.span.to + "',\n"
    + i2 + "generated: '" + meta.generated + "',\n"
    + i2 + 'trades: ' + trades + ',\n'
    + i2 + "src: '" + srcPath + "'\n"
    + indent;
  return { next: src.slice(0, lineStart) + next + src.slice(b) };
}
{
  const gp = join(ROOT, 'goldind.js');
  let gsrc = readFileSync(gp, 'utf8');
  const gRaw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
  const r = walkBlock(gsrc, 'HG_GOLD_EDGE_WALK', gRaw.meta, gRaw.trades.length,
                      'scripts/backtest-goldscalp-results-floor.json');
  /* a block it cannot locate is FATAL, never skipped — the hg-v921 rule */
  if (r.err) throw new Error('rebake: ' + r.err);
  changes.push({ file: 'goldind.js', what: 'walk span', rows: r.next === gsrc ? 0 : 1,
                 p: gp, next: r.next === gsrc ? null : r.next });
}
{
  const op = join(ROOT, 'omnigold.js');
  let osrc = readFileSync(op, 'utf8');
  const oRaw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-omnigold-results.json'), 'utf8'));
  const r = walkBlock(osrc, 'HG_OG_WALK', oRaw.meta, oRaw.trades.length,
                      'scripts/backtest-omnigold-results.json');
  if (r.err) throw new Error('rebake: ' + r.err);
  changes.push({ file: 'omnigold.js', what: 'walk span', rows: r.next === osrc ? 0 : 1,
                 p: op, next: r.next === osrc ? null : r.next });
}

/* ---- 2. omnigold.js: kinds[5..8], and the three evidence tables ---- */
{
  const p = join(ROOT, 'omnigold.js');
  let src = readFileSync(p, 'utf8');
  const before = src;

  /* 2a. the gate-clear tail on every kinds row */
  {
    const a = src.indexOf('    kinds: {', src.indexOf('var HG_OG_REPLAY_EVIDENCE'));
    const b = src.indexOf('\n    },', a);
    const rows = formedPopulation().rows;
    const out = [];
    for (const line of src.slice(a, b).split('\n')){
      const m = line.match(/^(\s+)'([A-Z0-9\-]+)': \[([^\]]*)\](,?)$/);
      if (!m){ out.push(line); continue; }
      const [, ind, key, body, comma] = m;
      const v = rows[key];
      if (!v || v.formedN === null){ out.push(line); continue; }
      const base = body.split(',').slice(0, 5).map((x) => x.trim()).join(', ');
      out.push(ind + "'" + key + "': [" + base + ', ' + v.formedN + ', ' + g(v.formedWr)
        + ', ' + g(v.formedNetXm) + ', ' + g(v.formedGross) + ']' + comma);
    }
    src = src.slice(0, a) + out.join('\n') + src.slice(b);
  }

  /* 2b/c/d. the three tables that come straight off the evidence bake */
  const ev = JSON.parse(readFileSync(join(ROOT, 'scripts/omnigold-replay-evidence.json'), 'utf8')).sequentialBake;
  const pair = (lo, hi, pick) => new Map(Object.keys(lo)
    .map((k) => [k, '{ lo: [' + pick(lo[k]).join(', ') + '], hi: [' + pick(hi[k]).join(', ') + '] }']));
  const evAt = src.indexOf('var HG_OG_REPLAY_EVIDENCE');
  const evEnd = src.indexOf('\n  };', evAt);
  for (const [key, lo, hi, pick] of [
    ['sequentialCells', ev.sequentialByCell, ev.sequentialByCellUpper, (v) => [v.n, g(v.winRate), g(v.netR_xm)]],
    ['sequentialTicketHorizon', ev.sequentialTicketsByHorizon, ev.sequentialTicketsByHorizonUpper, (v) => [v.n, g(v.winRate), g(v.netR_xm)]],
    ['stopBandGross', ev.sequentialByStopBand, ev.sequentialByStopBandUpper, (v) => [v.n, g(v.grossR)]]
  ]){
    const r = replaceBlock(src, evAt, evEnd, key, pair(lo, hi, pick));
    if (r === null) throw new Error('could not locate ' + key + ' — refusing to guess');
    src = r.src;
  }

  changes.push({ file: 'omnigold.js', what: 'kinds tail + 3 evidence tables',
                 rows: src === before ? 0 : 1, p, next: src === before ? null : src });
}

let dirty = 0;
for (const c of changes){
  if (!c.next){ console.log('  %s — %s: already matches the artifacts', c.file, c.what); continue; }
  dirty++;
  console.log('  %s — %s: DIFFERS from the artifacts%s', c.file, c.what,
    c.rows > 1 ? (' (' + c.rows + ' rows)') : '');
  if (WRITE){ writeFileSync(c.p, c.next); console.log('    written'); }
}
if (!WRITE && dirty) console.log('\n  run with --write to apply');
if (!dirty) console.log('\n  every baked literal already equals its artifact');
