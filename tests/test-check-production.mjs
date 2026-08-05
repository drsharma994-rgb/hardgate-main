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

function indexScriptJs(html){
  const out = [];
  const re = /<script\s+src="([^"]+\.js)"/g;
  let m;
  while ((m = re.exec(html))){
    const p = m[1].replace(/^\.\//, '');
    if (p.indexOf('http') !== 0) out.push(p);
  }
  return out;
}

function shellEntries(sw){
  const block = sw.match(/const HG_SHELL = \[([\s\S]*?)\];/);
  if (!block) return [];
  const entries = [];
  const re = /'\.\/([^']+)'/g;
  let m;
  while ((m = re.exec(block[1]))) entries.push(m[1]);
  return entries;
}

const html = fs.readFileSync(root + 'index.html', 'utf8');
const sw = fs.readFileSync(root + 'sw.js', 'utf8');
const readme = fs.readFileSync(root + 'README.md', 'utf8');
const tabalerts = fs.readFileSync(root + 'tabalerts.js', 'utf8');

console.log('== check-production script ==');
{
  const scriptPath = root + 'scripts/check-production.mjs';
  ok(fs.existsSync(scriptPath), 'scripts/check-production.mjs exists');
  const src = fs.readFileSync(scriptPath, 'utf8');
  ok(/HARDGATE_SITE/.test(src), 'script reads HARDGATE_SITE env');
  ok(/const HG_CACHE =/.test(sw), 'sw.js defines HG_CACHE');
  ok(/LIVE — cache ids match/.test(src), 'check-production prints LIVE status');
  ok(/STALE — merge \+ redeploy needed/.test(src), 'check-production prints STALE status');
  const pkg = JSON.parse(fs.readFileSync(root + 'package.json', 'utf8'));
  ok(pkg.scripts && pkg.scripts['check:prod'], 'package.json exposes check:prod');
}

console.log('== alert cycle constants (README alignment) ==');
{
  ok(/HG_TAB_ALERT_MS = 15 \* 60 \* 1000/.test(html), 'HG_TAB_ALERT_MS is 15 minutes');
  ok(/HG_ALERT_CYCLE_MS = HG_TAB_ALERT_MS/.test(html), 'HG_ALERT_CYCLE_MS aliases tab alert ms');
  ok(/HG_ALERTS_AUTO_REFRESH_MS = 900000/.test(html), 'HG_ALERTS_AUTO_REFRESH_MS is 15 minutes');
  ok(/GAP_MS = 15 \* 60 \* 1000/.test(tabalerts), 'tabalerts GAP_MS is 15 minutes');
  ok(/GOLD_MIN_TALLY = 10/.test(tabalerts), 'tabalerts gold min tally is 10');
  ok(/\+c\.tally < 6/.test(tabalerts), 'tabalerts EDGE setup filter uses tally >= 6');
}

console.log('== HG_SHELL vs index.html scripts ==');
{
  const idx = indexScriptJs(html);
  const shell = shellEntries(sw);
  const shellJs = new Set(shell.filter(f => f.endsWith('.js')));
  const missing = idx.filter(f => !shellJs.has(f));
  ok(missing.length === 0, 'every index.html script is in HG_SHELL (' + idx.length + ' files)'
    + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
  ok(shell.includes('index.html'), 'HG_SHELL precaches index.html');
  ok(shell.includes('hghost.js'), 'HG_SHELL precaches hghost.js');
  ok(shell.includes('manifest.webmanifest'), 'HG_SHELL precaches manifest');
  ok(shell.includes('bright.css'), 'HG_SHELL precaches bright.css');
}

console.log('== README doc guards ==');
{
  ok(readme.indexOf('15-minute') >= 0 || readme.indexOf('15 min') >= 0, 'README documents 15-min alert cycle');
  ok(!/EDGE uses tally ≥ 3/.test(readme) && !/EDGE uses tally >= 3/.test(readme),
    'README does not stale-document EDGE tally >= 3');
  ok(/tally.*6|≥ 6|>= 6/.test(readme), 'README documents EDGE tally >= 6');
  ok(/test-data-layer|test:data-layer/.test(readme),
    'README documents optional data-layer smoke');
  ok(!/not in `npm test`.*daemon/.test(readme), 'README does not claim daemon suite is outside npm test');
}

console.log('\n' + pass + ' passed');
