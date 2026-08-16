/* HARDGATE — a test that skips its subject must not report a pass.

   Everything this session has claimed about correctness rests on the suite.
   That is only worth something if the assertions actually run, and three times
   this session I have written one that could not fail. So the suite is now
   checked the same way the app is: sweep for the shape.

   The shape that matters is `ok(true, ...)` reached because the code under
   test was NOT exercised — a skip reported as a pass:

       if (hit){ ...real assertions... }
       else ok(true, 'fixture may not pass all gates — path still wired');

   Instrumenting test-cryptogates.mjs showed exactly that: swingTryClean and
   swingTryNear both returned null on the shipped fixture, so nine assertions
   about the enrich and near-clean paths had never run once. The file reported
   17 passes; two of them tested nothing.

   `ok(true, ...)` is NOT banned outright. Used inline after an operation that
   would have thrown — mount() called twice, node --check on a file — it is a
   real observation, just written awkwardly. What is banned is reaching it from
   an else or a skip branch, because that is the form that silently trades
   coverage for a green tick.

   Run: node tests/test-suite-not-vacuous.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const files = fs.readdirSync(HERE).filter(f => f.startsWith('test-') && f.endsWith('.mjs'));

function stripComments(src){
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

console.log('== no assertion passes because its subject was skipped ==');
{
  const offenders = [];
  let seen = 0;
  for (const f of files){
    const lines = stripComments(fs.readFileSync(path.join(HERE, f), 'utf8')).split('\n');
    for (let i = 0; i < lines.length; i++){
      const line = lines[i];
      if (!/\bok\(\s*true\s*,/.test(line)) continue;
      seen++;
      /* same-line skip: `else ok(true, ...)` or `if (x === null) ok(true, ...)` */
      if (/\belse\b[^;]*ok\(\s*true\s*,/.test(line) || /^\s*if\s*\([^)]*\)\s*ok\(\s*true\s*,/.test(line)){
        offenders.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 76));
        continue;
      }
      /* preceding-line skip: an else block whose body is the ok(true) */
      for (let j = i - 1; j >= Math.max(0, i - 4); j--){
        const prev = lines[j].trim();
        if (!prev) continue;
        if (/^\}?\s*else\b/.test(prev)){
          offenders.push(f + ':' + (i + 1) + '  (in else) ' + line.trim().slice(0, 62));
        }
        break;
      }
    }
  }
  ok(files.length >= 100, 'the sweep reached the suite (' + files.length + ' test files)');
  ok(seen >= 5, 'it found ok(true, ...) uses to classify (' + seen + ') — not vacuous itself');
  if (offenders.length) console.error('\n  assertions that pass when the subject was skipped:\n    ' + offenders.join('\n    '));
  ok(offenders.length === 0, 'no assertion passes from a skip branch (' + offenders.length + ')');
}

console.log('\n== no tautological assertions ==');
{
  const offenders = [];
  for (const f of files){
    const lines = stripComments(fs.readFileSync(path.join(HERE, f), 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (/\bok\([^,]*\|\|\s*true\s*[,)]/.test(line) || /\bok\(\s*(1|!0|!!1)\s*,/.test(line)){
        offenders.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 70));
      }
    });
  }
  if (offenders.length) console.error('\n  assertions that cannot fail:\n    ' + offenders.join('\n    '));
  ok(offenders.length === 0, 'no `x || true` style assertion (' + offenders.length + ')');
}

console.log('\n== the gate fixtures still reach the gates ==');
{
  /* The specific regression this test was written for: if these fixtures stop
     clearing the gates, the enrich assertions stop running, and without this
     check the file would go on reporting green. */
  const src = fs.readFileSync(path.join(HERE, 'test-cryptogates.mjs'), 'utf8');
  ok(/CLEAN fixture clears all seven gates/.test(src), 'cryptogates asserts its CLEAN fixture reaches 7/7');
  ok(/swingTryClean returns a hit on the CLEAN fixture/.test(src), 'and that swingTryClean actually returns a hit');
  ok(/swingTryNear returns a watch row on the NEAR fixture/.test(src), 'and that swingTryNear actually returns a row');
  ok(/wide-stop fixture aligns, so the G6 assertions below actually run/.test(src), 'and that the G6 fixture aligns');
  ok(!/fixture may not pass all gates/.test(src), 'the old skip-branch passes are gone');
}

console.log('\n== every test file asserts something ==');
{
  const thin = [];
  for (const f of files){
    const src = stripComments(fs.readFileSync(path.join(HERE, f), 'utf8'));
    /* Three assertion styles are in use across the suite: ok(), assert(), and
       a bare `if (...) throw new Error(...)`. Counting only ok() reported 56
       files as having none — that was my detector being wrong, not the files
       being empty. test-gold-deep.mjs alone carries 14 throw-based checks. */
    const n = (src.match(/\b(?:ok|assert)\(/g) || []).length
            + (src.match(/\bthrow new Error\(/g) || []).length;
    if (n < 2) thin.push(f + ' (' + n + ' checks)');
  }
  if (thin.length) console.error('\n  test files with almost no checks:\n    ' + thin.join('\n    '));
  ok(thin.length === 0, 'no test file carries fewer than 2 checks (' + thin.length + ')');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SUITE-INTEGRITY TESTS PASSED');
