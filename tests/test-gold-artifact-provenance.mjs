/* HARDGATE — hg-v959: the re-bake could not refresh the artifact the gold
   literals are derived from, and reported success.

   scripts/backtest-goldscalp.mjs wrote backtest-goldscalp-results.json.
   scripts/rebake-gold-literals.mjs derived every gold literal from
   backtest-goldscalp-results-FLOOR.json. Nothing in the repo wrote that file.
   Two halves of one pipeline each hardcoded a filename and the filenames
   disagreed, so `npm run gold:rebake` re-walked gold, wrote a file no literal
   reads, re-derived the literals from a file it had not touched, and printed
   "every baked literal already equals its artifact".

   Proved both ways before the fix: deleting 80% of the trades from the file
   the walk writes left the drift check reporting ZERO drift, while the same
   edit to the floor file moved 22 scalp rows and the walk span.

   What it cost beyond staleness: the two artifacts are different PIPELINES,
   by their own metadata. The literals' source records "goldRankSetups ctx
   carries NO candle rows" — its confluence scorer could not score. The walk's
   output records "carries candle rows since hg-v700 (tab parity)". The live
   desk feeds rows at goldscalp.js:2328. So the suppress / demote / prefer
   table behind GOLD SCALP, GOLD SWING, GOLD ULTRA, GOLD DIRECTION and MILLI
   GOLD was measured on a ranking context that is not the desk's.

   This guard asserts the invariant BEHAVIOURALLY and end to end: the path the
   walk really resolves (asked with --print-out) is the path the literal writer
   really opens (observed under lib/fs-trace.cjs). Neither side is grepped for
   a filename, because a path built with join() and branched on --smoke is
   exactly what a source parse gets wrong.

   Run: node tests/test-gold-artifact-provenance.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GOLD_SCALP_WALK, OMNIGOLD_WALK, OMNIGOLD_REPLAY_EVIDENCE,
         GOLD_ARTIFACTS } from '../lib/gold-artifacts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

/* Ask a script what it writes. Bounded: a script that does NOT support
   --print-out simply runs with an unrecognised flag, and one of them takes
   over 30 seconds to do its whole derivation. */
function askOutput(script, args = [], sec = 20){
  return execFileSync('timeout', ['-s', 'KILL', String(sec), 'node', script, ...args, '--print-out'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
/* Observe what a script really opens. */
function observeReads(script, args = [], sec = 60){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-prov-'));
  const trace = path.join(dir, 't.txt');
  fs.writeFileSync(trace, '');
  try{
    execFileSync('timeout', ['-s', 'KILL', String(sec), 'node',
                             '--require', path.join(ROOT, 'lib/fs-trace.cjs'), script, ...args],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, HG_FS_TRACE: trace },
        stdio: ['ignore', 'ignore', 'ignore'] });
  }catch(e){ /* reads happen at startup; the trace is read either way */ }
  const lines = fs.readFileSync(trace, 'utf8').split('\n');
  try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){}
  return lines.filter(l => l.startsWith('read\t')).map(l => l.slice(5));
}

/* =====================================================================
   1. The tracer records what it claims to record.
      (If it silently recorded nothing, every section below would pass
      vacuously — so this is asserted FIRST.)
   ===================================================================== */
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-prov-'));
  const probe = path.join(dir, 'probe.mjs');
  const target = path.join(dir, 'data.json');
  fs.writeFileSync(target, '{"x":1}');
  fs.writeFileSync(probe, `import fs from 'node:fs';\nfs.readFileSync(${JSON.stringify(target)}, 'utf8');\n`);
  const trace = path.join(dir, 't.txt');
  fs.writeFileSync(trace, '');
  execFileSync('node', ['--require', path.join(ROOT, 'lib/fs-trace.cjs'), probe],
    { cwd: ROOT, env: { ...process.env, HG_FS_TRACE: trace }, stdio: ['ignore', 'ignore', 'ignore'] });
  const got = fs.readFileSync(trace, 'utf8');
  ok(got.includes('read\t' + target), 'lib/fs-trace.cjs records a read it witnessed');

  /* and with no HG_FS_TRACE it must be inert, not throw */
  execFileSync('node', ['--require', path.join(ROOT, 'lib/fs-trace.cjs'), probe],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
  n++;
  try{ fs.rmSync(dir, { recursive: true, force: true }); }catch(e){}
}

/* =====================================================================
   2. THE INVARIANT: what the walk writes is what the literals read.
   ===================================================================== */
{
  const written = askOutput('scripts/backtest-goldscalp.mjs');
  eq(written, GOLD_SCALP_WALK,
    'the GOLD SCALP walk resolves to the one shared artifact path');

  const reads = observeReads('scripts/rebake-gold-literals.mjs');
  ok(reads.length > 0, 'the literal writer opened something — or the next assertions are vacuous');
  ok(reads.includes(GOLD_SCALP_WALK),
    'the literal writer really OPENS the artifact the walk really WRITES — the hg-v959 defect');

  /* the defect itself, stated as a negative: the literals must no longer be
     derived from the artifact the walk does NOT write */
  const strayWalk = path.join(ROOT, 'scripts', 'backtest-goldscalp-results.json');
  ok(!reads.includes(strayWalk),
    'and it does NOT open backtest-goldscalp-results.json, which no step of the chain writes into');

  eq(askOutput('scripts/backtest-omnigold.mjs'), OMNIGOLD_WALK,
    'the OMNIGOLD walk resolves to its shared path');
  ok(reads.includes(OMNIGOLD_WALK), 'and the literal writer opens that one too');
  eq(askOutput('scripts/omnigold-evidence-bake.mjs'), OMNIGOLD_REPLAY_EVIDENCE,
    'the evidence bake resolves to its shared path');
  ok(reads.includes(OMNIGOLD_REPLAY_EVIDENCE), 'and the literal writer opens that one too');
}

/* =====================================================================
   3. Every artifact the literal writer opens is one the chain produces.
      This is the general form of the defect, not just the one instance.
   ===================================================================== */
{
  const produced = new Set([GOLD_SCALP_WALK, OMNIGOLD_WALK, OMNIGOLD_REPLAY_EVIDENCE]);
  const reads = observeReads('scripts/rebake-gold-literals.mjs')
    .filter(p => /scripts[/\\][^/\\]+\.json$/.test(p) && !/[/\\]\.bt-cache[/\\]/.test(p));
  ok(reads.length > 0, 'the literal writer opens at least one committed artifact');
  for (const r of new Set(reads)){
    ok(produced.has(r), 'artifact opened by the literal writer is produced by the chain: '
       + path.basename(r) + ' — an orphan here means a re-bake cannot refresh it');
  }
}

/* =====================================================================
   4. One home. Every consumer resolves through lib/gold-artifacts.mjs.
   ===================================================================== */
{
  const m = await import('../scripts/edge-live-population.mjs');
  eq(m.REPLAY, GOLD_SCALP_WALK,
    'edge-live-population reads the shared constant, not a second copy of the filename');
  eq(Object.keys(GOLD_ARTIFACTS).length, 3, 'three artifacts have a home');
  for (const [k, v] of Object.entries(GOLD_ARTIFACTS)){
    ok(path.isAbsolute(v), k + ' resolves to an absolute path');
    ok(fs.existsSync(v), k + ' exists on disk — ' + path.basename(v));
  }
}

/* =====================================================================
   5. --out= exists so the chain CAN be pointed, and refuses the two ways
      it could recreate the incident the walk's own comment records.
   ===================================================================== */
{
  eq(askOutput('scripts/backtest-goldscalp.mjs', ['--out=backtest-goldscalp-results.json']),
     path.join(ROOT, 'scripts', 'backtest-goldscalp-results.json'),
     '--out= names the artifact');
  eq(askOutput('scripts/backtest-goldscalp.mjs', ['--smoke']),
     path.join(ROOT, 'scripts', 'backtest-goldscalp-smoke-results.json'),
     '--smoke still writes to its own file');

  const refuses = (args) => {
    try{
      execFileSync('timeout', ['-s', 'KILL', '20', 'node', 'scripts/backtest-goldscalp.mjs',
                               ...args, '--print-out'],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return false;
    }catch(e){ return true; }
  };
  ok(refuses(['--smoke', '--out=backtest-goldscalp-results-floor.json']),
    '--smoke with --out= is REFUSED: a 700-bar smoke run must never overwrite a full-run artifact');
  ok(refuses(['--out=../lib/gold-artifacts.mjs']), '--out= refuses to escape scripts/');
  ok(refuses(['--out=sub/dir/x.json']), '--out= refuses a path rather than a bare filename');
}

/* =====================================================================
   6. --print-out is READ-ONLY. A probe that wrote would be worse than
      no probe at all.
   ===================================================================== */
{
  const before = fs.readFileSync(GOLD_SCALP_WALK);
  askOutput('scripts/backtest-goldscalp.mjs');
  askOutput('scripts/backtest-omnigold.mjs');
  askOutput('scripts/omnigold-evidence-bake.mjs');
  const after = fs.readFileSync(GOLD_SCALP_WALK);
  ok(before.equals(after), 'asking the chain what it writes does not write anything');
}

/* =====================================================================
   7. The rebake chain still runs the walk before the literal writer, and
      the literal writer before the sibling records — order is the other
      half of a pipeline being correct.
   ===================================================================== */
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const chain = pkg.scripts['gold:rebake'];
  const at = s => chain.indexOf(s);
  ok(at('backtest-goldscalp.mjs') >= 0, 'the chain walks GOLD SCALP');
  ok(at('backtest-goldscalp.mjs') < at('rebake-gold-literals.mjs'),
    'the walk runs BEFORE the literals are derived from it');
  ok(at('omnigold-evidence-bake.mjs') < at('rebake-gold-literals.mjs'),
    'the evidence is baked before the literals read it');
  ok(!/gold-artifact-provenance/.test(chain),
    'the chain does not contain a checker that would enumerate and spawn itself');
}

/* =====================================================================
   8. DELIBERATELY TEXTUAL, and it says so.

      Section 4 compares VALUES, and a consumer that re-hardcodes the same
      filename compares equal to the constant — so that check passes whether
      the path has one home or three, and a mutation restoring the literal
      survives it. Whether a path is IMPORTED or RETYPED is a property of the
      source, and no runtime comparison can tell the two apart while they
      agree, which is exactly when the drift starts. That is hg-v956's
      finding, and this is the assertion it argues for.
   ===================================================================== */
{
  for (const f of ['scripts/backtest-goldscalp.mjs',
                   'scripts/rebake-gold-literals.mjs',
                   'scripts/edge-live-population.mjs']){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(/import\s*\{[^}]*\}\s*from\s*'\.\.\/lib\/gold-artifacts\.mjs'/.test(src),
      f + ' imports the artifact path rather than retyping it (source property — see above)');
    /* Comments are stripped first, in BOTH directions. A bare search for the
       filename fails on the honest state (these files legitimately NAME the
       artifact in their header comments — hg-v957 was caught by a guard that
       matched a word in a comment), while requiring a leading quote misses
       'scripts/<file>.json', which is how the surviving mutation wrote it.
       What must be absent is the filename in CODE. */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    ok(!/backtest-goldscalp-results-floor\.json/.test(code),
      f + ' carries no second copy of the walk filename in code');
  }
}

console.log('\nOK — ' + n + ' assertions passed (gold artifact provenance)');
