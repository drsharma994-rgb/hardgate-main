/* HARDGATE — lib/daemon-brain.mjs contract smoke (no full synthesis required).
   Run: node tests/test-daemon-brain.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBrainSynthesis } from '../lib/daemon-brain.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

const src = fs.readFileSync(root + 'lib/daemon-brain.mjs', 'utf8');

console.log('== exports + source contract ==');
{
  ok(typeof runBrainSynthesis === 'function', 'runBrainSynthesis exported');
  ok(/export async function runBrainSynthesis/.test(src), 'named export in source');
  ok(/__hgBrainLast/.test(src), 'reads __hgBrainLast after synthesis');
  ok(/#brainRun/.test(src), 'clicks brainRun in headless pane');
  ok(/liveOk/.test(src) && /liveReasons/.test(src), 'maps liveOk + liveReasons on rows');
  ok(/SCAN_TIMEOUT_MS/.test(src), 'scan timeout constant defined');
  ok(/puppeteer not installed/.test(src), 'graceful skip when puppeteer missing');
}

console.log('== unreachable site (fast fail) ==');
{
  const r = await runBrainSynthesis('http://127.0.0.1:59999/');
  ok(r && r.ok === false && typeof r.reason === 'string' && r.reason.length > 0,
    'dead port returns ok:false with reason');
  ok(!r.rows, 'failure result has no rows payload');
}

console.log('\n' + pass + ' passed');
