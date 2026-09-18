/* HARDGATE — the interval that decides every evidence tier has one definition.

   hgWilson is the estimator behind the whole OMNIGOLD evidence stack.
   hgOgWilsonHit resolves it by NAME at call time, and hgOgSettledExecuteOk,
   hgOgProvenEdgeOk and hgOgEdgeMargin all return false or NaN the moment
   ev.wilson is null — so the 95% SETTLED EXECUTE panel, the 90% SCALP VERDICT
   and the PROVEN EDGE ranking are every one of them downstream of it.

   It lived inline in index.html and in no module. Anything outside the page
   that needed it had to carry its own:

     index.html                     the original
     scripts/backtest-omnigold.mjs  "copied VERBATIM from index.html:6624"
     scripts/backtest-newgold.mjs   the same copy again
     three omnigold tests           a stub, written by hand

   The two script copies were still byte-identical, so nothing had drifted in
   the numbers. The THREE TEST STUBS had drifted: they omit

     if (!(n > 0) || !(wins >= 0) || wins > n) return null;

   and answer {lo:NaN, hi:NaN, p:NaN} exactly where the shipped function
   answers null — in the degenerate cases the promotion logic guards. Those
   three tests were checking the tab's promotion rules against a more
   permissive estimator than the tab ships.

   test-omnigold-effective-sample.mjs had already diagnosed the shape of this
   and worked around it by lifting the source out of index.html with a brace
   matcher, noting "a stub would test the stub". It was right; the answer is
   one home rather than five ways to reach it.

   Run: node tests/test-wilson-single-source.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { Math, isFinite, isNaN, console: { log(){}, warn(){}, error(){} }, JSON, Date,
              Number, String, Object, Array };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'fixpack14-core.js'), 'utf8'), ctx,
                { filename: 'fixpack14-core.js' });

console.log('== it has a home ==');
{
  ok(typeof ctx.hgWilson === 'function', 'hgWilson is exported from fixpack14-core.js');
  ok(typeof ctx.hgEffectiveN === 'function',
     'from the same module as the rest of the sample statistics, not a new one');
}

console.log('== and only one ==');
{
  /* A DEFINITION, not a mention. Feature checks and call sites are fine and
     are the whole point; a second implementation is not. */
  const DEF = /function\s+hgWilson\s*\(|hgWilson\s*=\s*(function|\()/;
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })){
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'data') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|mjs|html)$/.test(e.name)) files.push(full);
    }
  };
  walk(ROOT);
  ok(files.length > 50, `${files.length} source files scanned`);

  const defs = [];
  for (const f of files){
    const src = fs.readFileSync(f, 'utf8');
    for (const line of src.split('\n')){
      /* a comment quoting the old copy is not a copy */
      const t = line.trim();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) continue;
      if (DEF.test(line)) defs.push(path.relative(ROOT, f) + ': ' + t.slice(0, 70));
    }
  }
  ok(defs.length === 1,
     'exactly one definition in the tree' + (defs.length ? ' — ' + defs.join(' | ') : ''));
  ok(/fixpack14-core\.js/.test(defs[0] || ''), 'and it is the module one');

  /* the consumers still reach it — a single definition nobody can see would
     be worse than five */
  const reach = ['index.html', 'omnigold.js', 'scorecard.js',
                 'scripts/backtest-omnigold.mjs', 'scripts/backtest-newgold.mjs'];
  for (const f of reach){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(/hgWilson/.test(src), `${f} still references it`);
  }
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(idx.indexOf('fixpack14-core.js') < idx.indexOf('hgWilson(tp, closed)'),
     'and index.html loads the module before its own first call');
}

console.log('== the estimator is the one that baked data/ ==');
{
  /* THE SHIPPED FORMULA, byte for byte as it stood in index.html, so a
     silent edit during the move would fail here rather than quietly
     re-pricing every baked number. */
  const reference = (wins, n, z) => {
    z = isFinite(z) ? z : 1.96;
    wins = +wins; n = +n;
    if (!(n > 0) || !(wins >= 0) || wins > n) return null;
    const p = wins / n, z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / denom;
    const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p: p };
  };
  let checked = 0, live = 0;
  for (let n = 0; n <= 120; n++){
    for (let w = 0; w <= n; w++){
      for (const z of [1.96, 2.576, 1.645, 3.21]){
        const a = ctx.hgWilson(w, n, z), b = reference(w, n, z);
        checked++;
        if (a === null || b === null){
          if (a !== b) throw new Error('FAIL: null disagreement at ' + w + '/' + n);
          continue;
        }
        live++;
        if (a.lo !== b.lo || a.hi !== b.hi || a.p !== b.p)
          throw new Error('FAIL: ' + w + '/' + n + ' z=' + z + ' -> '
                          + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
      }
    }
  }
  ok(checked > 29000 && live > 29000,
     `${checked} (wins, n, z) combinations match the shipped formula exactly, ${live} of them real intervals`);

  /* the guards the stubs dropped */
  ok(ctx.hgWilson(0, 0) === null, 'no trades is null, not an interval');
  ok(ctx.hgWilson(3, 2) === null, 'more wins than trades is null');
  ok(ctx.hgWilson(-1, 10) === null, 'negative wins is null');
  const stub = (wins, n, z) => {
    z = z || 1.96; const p = wins / n, z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / denom;
    const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p: p };
  };
  ok(stub(0, 0) !== null && isNaN(stub(0, 0).lo),
     'while the stub these tests used answered {lo:NaN} for the same input — the drift was real, '
     + 'not hypothetical');
  ok(stub(3, 2) !== null, 'and accepted more wins than trades');
}

console.log('== and the properties a bound has to have ==');
{
  const w = ctx.hgWilson;
  ok(w(5, 5).hi === 1 && w(5, 5).lo > 0 && w(5, 5).lo < 1,
     '5/5 does not collapse to a point — where the normal approximation breaks');
  ok(w(0, 5).lo === 0 && w(0, 5).hi > 0, '0/5 likewise');
  const tight = w(55, 100), wide = w(9, 15);
  ok((tight.hi - tight.lo) < (wide.hi - wide.lo), 'more trades is a tighter interval');
  ok(w(20, 30).lo < 20 / 30 && w(20, 30).hi > 20 / 30, 'the interval brackets the observed rate');
  for (let n = 1; n <= 60; n++){
    for (let k = 0; k <= n; k++){
      const r = w(k, n);
      if (!(r.lo >= 0 && r.hi <= 1 && r.lo <= r.hi))
        throw new Error('FAIL: ' + k + '/' + n + ' produced ' + JSON.stringify(r));
    }
  }
  ok(true, 'every bound over 1891 (wins, n) pairs stays inside [0,1] with lo <= hi');
  /* a wider z is a wider interval — the Sidak family correction depends on it */
  const z196 = w(20, 30, 1.96), z321 = w(20, 30, 3.21);
  ok((z321.hi - z321.lo) > (z196.hi - z196.lo),
     'a bigger z widens the interval, which is what the family correction relies on');
}

console.log('\n' + passed + ' passed, 0 failed');
