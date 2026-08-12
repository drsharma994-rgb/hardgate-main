/* HARDGATE — provenance + license CI guard (static, no network). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

const provenance = fs.readFileSync(path.join(root, 'PROVENANCE.md'), 'utf8');
const license = fs.existsSync(path.join(root, 'LICENSE'));

console.log('== LICENSE ==');
ok(license, 'LICENSE file exists');

console.log('== banned header words ==');
const banned = /\b(ported from|copied from|translated from)\b/i;
const libFiles = fs.readdirSync(path.join(root, 'lib')).filter(f => f.endsWith('.mjs'));
for (const f of libFiles){
  const head = fs.readFileSync(path.join(root, 'lib', f), 'utf8').slice(0, 400);
  ok(!banned.test(head), 'lib/' + f + ' header has no banned derivative words');
}
const rootJs = fs.readdirSync(root).filter(f => f.endsWith('.js') && f !== 'sw.js');
for (const f of rootJs.slice(0, 40)){
  const head = fs.readFileSync(path.join(root, f), 'utf8').slice(0, 400);
  if (/Reference:|Inspired|style|MLFinLab|Freqtrade|OpenBB|ccxt|QuantStats|AI4Finance|TradingAgents|Arbitragelab/i.test(head)){
    ok(!banned.test(head), f + ' external-credit header has no banned words');
  }
}

console.log('== PROVENANCE rows for credited modules ==');
const requiredRows = [
  'lib/freqtrade-protections.mjs',
  'lib/purged-cv.mjs',
  'lib/meta-label.mjs',
  'lib/tear-sheet.mjs',
  'lib/reliability.mjs',
  'lib/sample-uniqueness.mjs',
  'lib/bet-size.mjs',
  'lib/vol-forecast.mjs',
  'lib/regime-router.mjs',
  'lib/gold-coint.mjs',
];
for (const mod of requiredRows){
  ok(provenance.includes(mod), 'PROVENANCE.md lists ' + mod);
}

console.log('\nprovenance guards: ' + pass + ' passed');
