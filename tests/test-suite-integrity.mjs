/* HARDGATE — suite integrity. The test that tests the tests.
   WHY THIS EXISTS. While building fix pack 12 a script of mine truncated
   tests/test-trade-plan.mjs to ZERO BYTES, and `npm test` still reported
   "3368 passed, 0 failed". An empty .mjs exits 0, so the file silently stopped
   running and the suite stayed green. It was caught only because that pack was
   diffed byte-for-byte against a separately built tree.
   A suite that cannot tell "this test passed" from "this test never ran" is
   not evidence. Every gate fix, fill gate, cost model and clearance readout in
   this repo rests on the suite being real.
   This guard checks three things no individual test can check about itself:
     1. every tests/*.mjs is either RUN by npm test or on an explicit,
        documented exclusion list — nothing is orphaned by accident
     2. no chained file is empty or assertion-free
     3. every file named in the chain actually exists on disk
   Run: node tests/test-suite-integrity.mjs                                   */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const TESTS = path.join(ROOT, 'tests');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
/* Files deliberately NOT in `npm test`. Each needs a stated reason — an
   undocumented exclusion is indistinguishable from an accident. */
const EXCLUDED = {
  'test-data-layer.mjs':
    'LIVE-NETWORK smoke test — hits fapi.binance.com, api.frankfurter.dev and '
    + 'api.gold-api.com for real. Excluded so CI cannot go red on a geo-blocked '
    + 'runner (HTTP 451) or a rate limit. Run it by hand before a data-layer change.',
  'test-suite-integrity.mjs':
    'this file — it is chained, the self-reference is expected',
};
const chain = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.test;
const usesRunner = chain.indexOf('run-tests.mjs') >= 0;
const onDisk = fs.readdirSync(TESTS).filter(f => f.endsWith('.mjs'));
const inChain = usesRunner
  ? new Set(onDisk.filter(f => (f.startsWith('test-') && !EXCLUDED[f]) || f === 'extract-inline.mjs'))
  : new Set([...chain.matchAll(/node (tests\/[\w.-]+\.mjs)/g)].map(m => m[1].replace('tests/', '')));
console.log('== nothing is orphaned by accident ==');
{
  const orphans = onDisk.filter(f => !inChain.has(f) && !EXCLUDED[f]);
  ok(orphans.length === 0,
     'every test file is chained or documented as excluded' +
     (orphans.length ? ' — ORPHANED: ' + orphans.join(', ') : ''));
  Object.keys(EXCLUDED).forEach(f => {
    ok(onDisk.indexOf(f) >= 0 || inChain.has(f),
       'the exclusion list has no stale entry for ' + f);
  });
  ok(onDisk.length >= 100, 'the suite still has its full file count (' + onDisk.length + ')');
}
console.log('== every chained file exists and can actually fail ==');
{
  const missing = [...inChain].filter(f => onDisk.indexOf(f) < 0);
  ok(missing.length === 0,
     'no chained file is missing from disk' + (missing.length ? ' — MISSING: ' + missing.join(', ') : ''));
  const empty = [], silent = [];
  for (const f of inChain){
    const src = fs.readFileSync(path.join(TESTS, f), 'utf8');
    if (src.trim().length < 100){ empty.push(f); continue; }
    /* An assertion is anything that can make the file exit non-zero. This
       suite uses THREE conventions and the guard must know all of them, or it
       flags healthy files as silent:
         1. assert(...) / ok(...)          — most test-*.mjs
         2. bare `if (x) throw new Error`  — test-gold-deep.mjs
         3. process.exit(fail ? 1 : 0)     — extract-inline.mjs
       Each was found by this check failing on a file that was actually fine. */
    if (!/\b(assert|ok|equal|throws)\s*\(|throw new Error|process\.exit\s*\(/.test(src)) silent.push(f);
  }
  ok(usesRunner, 'npm test uses scripts/run-tests.mjs aggregator');
  ok(empty.length === 0,
     'no chained test file is empty or a stub' + (empty.length ? ' — EMPTY: ' + empty.join(', ') : ''));
  ok(silent.length === 0,
     'every chained test file contains at least one assertion'
     + (silent.length ? ' — SILENT: ' + silent.join(', ') : ''));
}
console.log('== the guard would catch the failure that motivated it ==');
{
  /* simulate the exact pack-12 accident against the real check, in memory —
     nothing on disk is touched */
  const truncated = '';
  ok(truncated.trim().length < 100, 'a zero-byte file is detected as empty');
  const stub = '/* TODO: write these tests */\nconsole.log("hello");\n';
  ok(!/\b(assert|ok|equal|throws)\s*\(|throw new Error/.test(stub),
     'a file that only logs and never asserts is detected as silent');
  const styles = ['if (!x) throw new Error("bad");', 'assert(x, "m");', 'process.exit(fail ? 1 : 0);'];
  styles.forEach(function(src, i){
    ok(/\b(assert|ok|equal|throws)\s*\(|throw new Error|process\.exit\s*\(/.test(src),
       'assertion style ' + (i + 1) + ' of 3 is recognised, not falsely flagged');
  });
  const real = fs.readFileSync(path.join(TESTS, 'test-trade-plan.mjs'), 'utf8');
  ok(real.trim().length > 100 && /\bassert\s*\(/.test(real),
     'the file that was truncated in pack 12 is intact and asserting today');
}
console.log('\n' + passed + ' passed, 0 failed');
