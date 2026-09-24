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
import { createContext, runInContext } from 'node:vm';

/* hg-v960: exported so the two FATAL branches below can be DRIVEN. On a clean
   tree neither can be reached — there is no undeclared departure and the rule
   is present — so left inline they were untestable, and a mutation disabling
   either survived the guard. That is the "bucket nothing can land in" problem
   this repo names; hg-v937 hit the same shape and the fix is the same, an
   exported function exercised on injected inputs. */

/* hg-v961: exported so this FATAL branch can be DRIVEN. Every swing removal
   count is zero on the committed walk, so the branch is unreachable there —
   and a branch nothing can land in is a rubber stamp, which is exactly how a
   mutation disabling it survived the first pass. Same shape as hg-v960's
   enforceVerdictRule, same fix. */
export function assertSwingRemovalsModelled(removals){
  const r = removals || {};
  if (r.underCost || r.underFloor || r.suppressedKinds){
    throw new Error('rebake: the swing live population is no longer the whole settled book '
      + '(underCost=' + r.underCost + ', underFloor=' + r.underFloor
      + ', suppressedKinds=' + r.suppressedKinds + '). liveSwingPopulation() says the desk '
      + 'withholds nothing; it now withholds something. Model the removal before baking.');
  }
  /* the list of removals actually checked — the caller prints it, so
     BYPASSING this function (passing the raw counts straight through) is
     observable. Without it the bypass was invisible: the raw object has the
     same shape and the same zeros, so the report read identically and a
     mutation deleting the call survived. */
  return { underCost: r.underCost, underFloor: r.underFloor,
           suppressedKinds: r.suppressedKinds, settled: r.settled,
           checked: ['underCost', 'underFloor', 'suppressedKinds'] };
}

export function enforceVerdictRule(win){
  const fn = win && win.hgGoldEdgeVerdictDepartures;
  if (typeof fn !== 'function'){
    throw new Error('rebake: goldind.js exports no hgGoldEdgeVerdictDepartures — the verdict rule '
      + 'is what keeps the decision in step with the evidence; refusing to bake without it');
  }
  const d = fn();
  if (d.undeclared.length){
    throw new Error('rebake: ' + d.undeclared.length + ' edge verdict(s) no longer follow the rule and '
      + 'declare no reason: '
      + d.undeclared.map(x => x.key + ' in force ' + x.inForce + ', rule says ' + x.rule).join('; ')
      + '. The live evidence moved under a hand-typed verdict. Either move the verdict, or record '
      + 'actionWhy on the row saying why it stands.');
  }
  return d;
}

import { GOLD_SCALP_WALK, OMNIGOLD_WALK } from '../lib/gold-artifacts.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { liveEdgePopulation, liveSwingPopulation } from './edge-live-population.mjs';
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
        /* hg-v960: gross rides beside net, in the row's own n/gross/net order */
        const next = lm[1] + 'live: { n: ' + v.n + ', gross: ' + g(v.gross) + ', net: ' + g(v.net)
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

/* ---- 1a. hg-v961: the live block on every SWING edge row ----------------
   The swing rows had no `live` key at all, so this INSERTS on the first bake
   and REPLACES afterwards. Everything else about the block is the scalp
   convention: it sits on its own line directly under the row's opening line,
   in the row's own n/gross/net order. */
{
  const p = join(ROOT, 'goldind.js');
  let src = readFileSync(p, 'utf8');
  const a = src.indexOf('var HG_GOLD_SETUP_EDGE');
  const sw = src.indexOf('\n  swing: {', a);
  const end = src.indexOf('\n};', sw);
  if (a < 0 || sw < 0 || end < 0) throw new Error('rebake: could not locate the swing edge region — refusing to guess');
  const { rows, removals } = liveSwingPopulation();
  const lines = src.slice(sw, end).split('\n');
  const out = [];
  let n = 0;
  for (let i = 0; i < lines.length; i++){
    const line = lines[i];
    const km = line.match(/^\s{4}(\w+):\s+\{\s*n:\s/);
    out.push(line);
    if (!km) continue;
    const v = rows[km[1]];
    if (!v) continue;
    const want = '      live: { n: ' + v.n + ', gross: ' + g(v.gross) + ', net: ' + g(v.net)
      + ', oosHeld: ' + v.oosHeld + ', oosBroke: ' + v.oosBroke + ' },';
    /* Scan forward to the END OF THIS ROW for an existing live block rather
       than peeking at the next line only. A row may carry actionWhy between
       its header and its live block (hg-v961 added two), and a one-line
       lookahead would not see past it — it would insert a SECOND live block
       and the drift check would never settle. The row ends at the first line
       closing it, so the search cannot run into the next row. */
    let at = -1;
    for (let j = i + 1; j < lines.length; j++){
      if (/^\s{4}\w+:\s+\{/.test(lines[j])) break;          /* next row started */
      if (/^\s+live: \{/.test(lines[j])){ at = j; break; }
      if (/\},?\s*$/.test(lines[j]) && !/^\s+\w+: \{/.test(lines[j])) break;  /* row closed */
    }
    if (at >= 0){
      if (lines[at] !== want) n++;
      lines[at] = want;                          /* replace in place, order kept */
    } else { out.push(want); n++; }              /* insert one that was never there */
  }
  const rebuilt = src.slice(0, sw) + out.join('\n') + src.slice(end);
  changes.push({ file: 'goldind.js', what: 'swing live blocks', rows: n,
                 p, next: rebuilt === src ? null : rebuilt });
  /* the three removals are zero TODAY and that is a coincidence, not a rule —
     a non-zero one means the swing live population has stopped being the
     whole settled book and the claim in edge-live-population.mjs is stale */
  /* reported, not merely checked: with every count zero on the committed walk
     the check produces no observable effect, so removing the CALL was
     invisible and a mutation deleting it survived. What it verified is now
     printed, which is also the honest line for a reader — "the live
     population is the whole settled book" is a measurement, not a rule. */
  const rem = assertSwingRemovalsModelled(removals);
  console.log('  swing live population: %d settled, withheld %d cost / %d floor / %d suppressed '
    + '(%d removals checked)',
    rem.settled, rem.underCost, rem.underFloor, rem.suppressedKinds,
    (rem.checked || []).length);
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
  const gRaw = JSON.parse(readFileSync(GOLD_SCALP_WALK, 'utf8'));
  const r = walkBlock(gsrc, 'HG_GOLD_EDGE_WALK', gRaw.meta, gRaw.trades.length,
                      'scripts/' + basename(GOLD_SCALP_WALK));
  /* a block it cannot locate is FATAL, never skipped — the hg-v921 rule */
  if (r.err) throw new Error('rebake: ' + r.err);
  changes.push({ file: 'goldind.js', what: 'walk span', rows: r.next === gsrc ? 0 : 1,
                 p: gp, next: r.next === gsrc ? null : r.next });
}
{
  const op = join(ROOT, 'omnigold.js');
  let osrc = readFileSync(op, 'utf8');
  const oRaw = JSON.parse(readFileSync(OMNIGOLD_WALK, 'utf8'));
  const r = walkBlock(osrc, 'HG_OG_WALK', oRaw.meta, oRaw.trades.length,
                      'scripts/' + basename(OMNIGOLD_WALK));
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

/* ---- hg-v960: the decision may not be left behind the evidence ----------
   Every `action` on the scalp edge table is hand-typed; every `live` block
   under it is generated here. Nothing kept the two in step, so a re-bake
   moved the evidence and froze the verdict — the hg-v946 hand-typed book
   failure, in the table that decides what GOLD SCALP, GOLD SWING, GOLD ULTRA,
   GOLD DIRECTION and MILLI GOLD present as tradeable.

   The rule now lives once, in goldind.js, and is checked HERE against the
   file as it stands on disk after any write. A row whose verdict departs from
   the rule is allowed — hg-v928 refused two flips the bars would have made on
   n=6 and n=1 — but the departure must be DECLARED on the row as `actionWhy`.
   An UNDECLARED departure is fatal, never a warning: this is the hg-v921 rule
   (a generated thing the generator cannot account for stops the bake) applied
   to a verdict rather than to a block. */
{
  const ctx = {
    window: {}, console: { log(){}, warn(){}, error(){} },
    Math, JSON, Date, isFinite, String, Object, Array, RegExp, Promise, Error,
    setTimeout, localStorage: { getItem: () => null, setItem(){} }
  };
  ctx.window.window = ctx.window; ctx.globalThis = ctx; ctx.self = ctx.window;
  createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js']){
    try{ runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch(e){ /* a desk leg that will not boot headless is not this check's business */ }
  }
  const d = enforceVerdictRule(ctx.window);
  /* counted from the reporter rather than from a hardcoded total — hg-v960
     hardcoded 25, which was the scalp row count and silently wrong the moment
     hg-v961 brought the swing table under the same rule */
  console.log('  verdict rule: %d row(s) follow it, %d declared, %d undeclared, '
    + '%d unrecoverable (a bar this desk uses but never wrote down)',
    d.followed.length, d.declared.length, d.undeclared.length, d.unrecoverable.length);
}
