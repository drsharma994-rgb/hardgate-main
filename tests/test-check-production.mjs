/* HARDGATE — static checks for deploy verification script + alert timing constants.
   Run: node tests/test-check-production.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, label) => {
  if (!cond) throw new Error('FAIL: ' + label);
  pass++;
  console.log('  ok —', label);
};

console.log('== check-production script ==');
{
  const scriptPath = root + 'scripts/check-production.mjs';
  ok(fs.existsSync(scriptPath), 'scripts/check-production.mjs exists');
  const src = fs.readFileSync(scriptPath, 'utf8');
  ok(/HARDGATE_SITE/.test(src), 'script reads HARDGATE_SITE env');
  ok(/const HG_CACHE =/.test(fs.readFileSync(root + 'sw.js', 'utf8')), 'sw.js defines HG_CACHE');
  const pkg = JSON.parse(fs.readFileSync(root + 'package.json', 'utf8'));
  ok(pkg.scripts && pkg.scripts['check:prod'], 'package.json exposes check:prod');
}

console.log('== alert cycle constants (README alignment) ==');
{
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  ok(/HG_TAB_ALERT_MS = 15 \* 60 \* 1000/.test(html), 'HG_TAB_ALERT_MS is 15 minutes');
  ok(/HG_ALERT_CYCLE_MS = HG_TAB_ALERT_MS/.test(html), 'HG_ALERT_CYCLE_MS aliases tab alert ms');
  ok(/HG_ALERTS_AUTO_REFRESH_MS = 900000/.test(html), 'HG_ALERTS_AUTO_REFRESH_MS is 15 minutes');
}

console.log('\n' + pass + ' passed');
