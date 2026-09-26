#!/usr/bin/env node
/* hg-v990 — HG_CRYPTO_ULTRA_EVIDENCE writes itself from the walk's artifact.

   The literal in cryptoultra.js was hand-typed. It said `measured: true` and
   carried a verdict — "architectural failure", "long and short always fire on
   identical bars, canceling each other through merge logic" — against an
   artifact (scripts/backtest-cryptoultra-results.json) whose `evidence` is
   null, whose `chosen` is null and whose every grid cell settled ZERO trades.
   Zero was not a measurement of the strategy: every harness handed the
   engine `rule: { minPct: 0, minAvail: 0, regimeGate: false }`, the engine
   took that object AS the rule (`inp.rule || RULE`), and a rule with no
   stopAtr / t1R / timeoutBars prices every plan at stop null, target null.
   A trade with no stop and no target never exits on price, times out with
   NaN R, and every aggregate silently dropped it. The desk then gated itself
   MEASURED NOT TRADABLE on that.

   So the literal is generated (the hg-v921 rule: a generated thing writes
   itself, and a re-bake cannot leave a hand-typed verdict behind):
     - artifact carries `evidence` (a rule was chosen)  -> measured: true,
       every figure copied from the artifact, tradable as the walk judged it
     - artifact chose nothing                            -> measured: false,
       and the note says what the walk did and did not do, from the
       artifact's own counts (fired, merged, cells, settled) -- never a
       diagnosis typed by hand
   The read-only run is the drift check; `--write` splices between the
   markers; a missing marker is fatal, never skipped.

   Usage: node scripts/cryptoultra-evidence-literal.mjs [--json] [--write] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ARTIFACT = path.join(HERE, 'backtest-cryptoultra-results.json');
export const TARGET = path.join(HERE, '..', 'cryptoultra.js');
export const BEGIN = '/* --- BEGIN GENERATED HG_CRYPTO_ULTRA_EVIDENCE (scripts/cryptoultra-evidence-literal.mjs) ---';
export const END = '/* --- END GENERATED HG_CRYPTO_ULTRA_EVIDENCE --- */';

const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;

export function loadArtifact(file){
  return JSON.parse(fs.readFileSync(file || ARTIFACT, 'utf8'));
}

/* the evidence object the tab reads, derived from the artifact and nothing else */
export function evidenceFrom(a){
  if (!a || !a.meta || !Array.isArray(a.grid)) throw new Error('cryptoultra artifact: meta and grid are required');
  const m = a.meta;
  const grid = a.grid;
  const settled = grid.reduce((s, g) => s + ((g.all && num(g.all.n)) || 0), 0);
  const fired = grid.length ? Math.max.apply(null, grid.map(g => num(g.fired) || 0)) : 0;
  const merged = grid.length ? Math.max.apply(null, grid.map(g => num(g.merged) || 0)) : 0;
  const unpriced = num(m.unpriced);
  const base = {
    symbol: String(m.symbol || ''),
    bars: num(m.bars && m.bars.m15),
    interval: '15m',
    span: String(m.span || ''),
    walk: { cells: grid.length, fired, merged, settled, unpriced: unpriced === null ? undefined : unpriced, barsWithLead: num(m.barsWithLead) },
    limitations: Array.isArray(m.limitations) ? m.limitations.slice() : []
  };
  const ev = a.evidence;
  if (ev && ev.rule && ev.ins && ev.oos){
    return Object.assign({ measured: true }, base, {
      rule: ev.rule,
      isAvgR: num(ev.ins.avgR_net), isN: num(ev.ins.n) || 0, isWin: num(ev.ins.winRate),
      oosAvgR: num(ev.oos.avgR_net), oosN: num(ev.oos.n) || 0, oosWin: num(ev.oos.winRate),
      tradable: ev.tradable === true,
      verdict: String(ev.verdict || ''),
      note: null
    });
  }
  /* nothing chosen: NOT MEASURED, and the note is the artifact's own account */
  let why;
  if (settled === 0 && fired > 0){
    why = 'the committed walk (' + base.span + ', ' + base.bars + ' x 15m bars) fired ' + fired + ' times at its loosest cell and settled 0 trades in every one of its ' + grid.length + ' cells'
      + (unpriced !== null ? ' — ' + unpriced + ' of its plans carried no stop or target' : ' — the walk had priced every plan without a stop or a target (a harness override replaced the rule, hg-v990)')
      + ', so no rule was chosen and NOTHING WAS MEASURED. A zero here is a defect of the walk, not a verdict on the strategy; fires print as RECORD ONLY until a walk that prices its plans is re-run.';
  } else if (fired === 0){
    why = 'the committed walk (' + base.span + ') fired nothing at any cell, so no rule was chosen and nothing was measured.';
  } else {
    why = 'the committed walk (' + base.span + ') settled ' + settled + ' trades across ' + grid.length + ' cells and no cell reached the in-sample floor (' + (m.grid && m.grid.minNPick) + '), so no rule was chosen and nothing was measured.';
  }
  return Object.assign({ measured: false }, base, {
    rule: null, isAvgR: null, isN: 0, isWin: null, oosAvgR: null, oosN: 0, oosWin: null,
    tradable: false, verdict: null, note: 'NOT YET MEASURED — ' + why
  });
}

export function literal(ev){
  const E = ev || evidenceFrom(loadArtifact());
  const line = (k, v) => '  ' + k + ': ' + JSON.stringify(v) + ',';
  const keys = ['measured', 'symbol', 'bars', 'interval', 'span', 'walk', 'rule', 'isAvgR', 'isN', 'isWin', 'oosAvgR', 'oosN', 'oosWin', 'tradable', 'verdict', 'note'];
  const body = keys.map(k => line(k, E[k] === undefined ? null : E[k]));
  body.push('  limitations: ' + JSON.stringify(E.limitations));
  return [
    BEGIN,
    '   Re-derive with `node scripts/cryptoultra-evidence-literal.mjs --write`. Do not',
    '   hand-edit -- generated literals write themselves (hg-v921). Every figure is',
    '   read off ' + path.basename(ARTIFACT) + '; the guard re-runs the generator and fails on drift. */',
    'var HG_CRYPTO_ULTRA_EVIDENCE = {'
  ].concat(body, ['};', END]).join('\n');
}

export function splice(src, lit){
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  if (a < 0) throw new Error('BEGIN marker not found in cryptoultra.js');
  if (b < 0 || b < a) throw new Error('END marker not found in cryptoultra.js');
  return src.slice(0, a) + lit + src.slice(b + END.length);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const ev = evidenceFrom(loadArtifact());
  const lit = literal(ev);
  if (process.argv.includes('--json')) console.log(JSON.stringify(ev, null, 2));
  else console.log('CRYPTO ULTRA evidence: measured=' + ev.measured + ' · ' + (ev.measured ? ('OOS n=' + ev.oosN + ' ' + ev.oosAvgR + 'R · tradable=' + ev.tradable) : ev.note));
  const src = fs.readFileSync(TARGET, 'utf8');
  const next = splice(src, lit);
  if (process.argv.includes('--write')){
    if (next !== src){ fs.writeFileSync(TARGET, next); console.log('HG_CRYPTO_ULTRA_EVIDENCE written'); }
    else console.log('HG_CRYPTO_ULTRA_EVIDENCE: zero drift');
  } else if (next !== src){ console.error('HG_CRYPTO_ULTRA_EVIDENCE: DRIFT — run with --write'); process.exit(1); }
  else console.log('HG_CRYPTO_ULTRA_EVIDENCE: zero drift');
}
