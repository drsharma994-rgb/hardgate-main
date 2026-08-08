#!/usr/bin/env node
/* HARDGATE — run every tests/test-*.mjs and report ALL failures (no fail-fast &&). */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const testsDir = path.join(root, 'tests');

/** Same exclusions documented in tests/test-suite-integrity.mjs */
const EXCLUDED = new Set(['test-data-layer.mjs']);
const RUNNER_EXTRA = new Set(['extract-inline.mjs']);

const files = fs.readdirSync(testsDir)
  .filter(f => (f.endsWith('.mjs') && f.startsWith('test-') && !EXCLUDED.has(f)) || RUNNER_EXTRA.has(f))
  .sort((a, b) => {
    if (a === 'test-suite-integrity.mjs') return 1;
    if (b === 'test-suite-integrity.mjs') return -1;
    return a.localeCompare(b);
  });

const failed = [];
const t0 = Date.now();

for (const f of files){
  process.stdout.write('\n▶ ' + f + '\n');
  const r = spawnSync(process.execPath, [path.join(testsDir, f)], { stdio: 'inherit', cwd: root, env: process.env });
  if (r.status !== 0) failed.push(f);
}

console.log('\n=== test summary ===');
console.log('files:', files.length, '| failed:', failed.length, '| ms:', Date.now() - t0);

if (failed.length){
  console.error('\nFailed:');
  for (const f of failed) console.error('  - ' + f);
  process.exit(1);
}
