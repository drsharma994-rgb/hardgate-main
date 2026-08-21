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
  ok(/HG_TAB_ALERT_MS = 5 \* 60 \* 1000/.test(html), 'HG_TAB_ALERT_MS is 5 minutes');
  ok(/HG_ALERT_CYCLE_MS = HG_TAB_ALERT_MS/.test(html), 'HG_ALERT_CYCLE_MS aliases tab alert ms');
  ok(/HG_GLOBAL_SCAN_MS = 5 \* 60 \* 1000/.test(html), 'HG_GLOBAL_SCAN_MS is 5 minutes');
  ok(/HG_ALERTS_AUTO_REFRESH_MS = HG_GLOBAL_SCAN_MS/.test(html), 'HG_ALERTS_AUTO_REFRESH_MS uses global scan interval');
  ok(/HG_AUTO_REFRESH_HARDCODED_MS = HG_GLOBAL_SCAN_MS/.test(html), 'HG_AUTO_REFRESH_HARDCODED_MS uses global scan interval');
  ok(/GAP_MS = 5 \* 60 \* 1000/.test(tabalerts), 'tabalerts GAP_MS is 5 minutes');
  ok(/HG_SCAN_WARM_N\s*=\s*80/.test(html), 'alert warm uses a liquid cap, not the whole book');
  ok(!/function cryptoScanWarm\([\s\S]*?forceScanAll:\s*true/.test(html),
     'cryptoScanWarm does not forceScanAll');
  ok(/nearCands/.test(html), 'quiet scan stores near-clean candidates');
  ok(/6\/7 NEAR/.test(tabalerts), 'tabalerts labels near-clean rows honestly');
  ok(/GOLD_MIN_TALLY = 10/.test(tabalerts), 'tabalerts gold min tally is 10');
  ok(/\+c\.tally < 6/.test(tabalerts), 'tabalerts EDGE setup filter uses tally >= 6');
  ok(/LS_CLEAN_ONLY = 'hgAlertCleanOnly'/.test(tabalerts), 'tabalerts clean-only localStorage key');
  ok(/LS_GOLD_SEPARATE = 'hgAlertGoldSeparate'/.test(tabalerts), 'tabalerts gold separate batch key');
  ok(/hgTabAlertsRunGold/.test(tabalerts), 'tabalerts exposes hgTabAlertsRunGold');
  ok(/hgTabAlertsRunGold\(\)/.test(html), 'index calls hgTabAlertsRunGold on 5-min cycle');
  ok(/HG_TRENDMX_ALERT_MS = 15 \* 60 \* 1000/.test(html), 'HG_TRENDMX_ALERT_MS is 15 minutes');
  ok(/runTrendmxCrossAlerts/.test(html), 'index runs trend matrix cross alerts on 15-min cycle');
  ok(/TRENDMX_ALERT_CYCLE_MS = 15 \* 60 \* 1000/.test(tabalerts), 'tabalerts trendmx cycle is 15 minutes');
  ok(/hgTrendmxCrossAlertsRun\(\)/.test(html), 'index calls trend matrix golden-cross alerts');
  ok(/trendmxGoldenCrossSetups/.test(fs.readFileSync(root + 'trendtable.js', 'utf8')),
    'trendtable exposes golden cross setup builder');
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
  ok(shell.includes('hg-icons.css'), 'HG_SHELL precaches hg-icons.css');
  ok(shell.includes('vendor/base-themes/tokens-data-dense-light.css'), 'HG_SHELL precaches base-themes tokens');
}

console.log('== README doc guards ==');
{
  ok(readme.indexOf('5-minute') >= 0 || readme.indexOf('5 min') >= 0, 'README documents 5-min alert cycle');
  ok(!/EDGE uses tally ≥ 3/.test(readme) && !/EDGE uses tally >= 3/.test(readme),
    'README does not stale-document EDGE tally >= 3');
  ok(/tally.*6|≥ 6|>= 6/.test(readme), 'README documents EDGE tally >= 6');
  ok(/test-data-layer|test:data-layer/.test(readme),
    'README documents optional data-layer smoke');
  ok(!/not in `npm test`.*daemon/.test(readme), 'README does not claim daemon suite is outside npm test');
}

console.log('== npm test chain vs tests/*.mjs ==');
{
  const pkg = JSON.parse(fs.readFileSync(root + 'package.json', 'utf8'));
  const testScript = (pkg.scripts && pkg.scripts.test) || '';
  const usesRunner = testScript.indexOf('run-tests.mjs') >= 0;
  ok(usesRunner, 'npm test uses scripts/run-tests.mjs aggregator');
  ok(fs.existsSync(path.join(root, 'scripts/run-tests.mjs')), 'run-tests.mjs exists');

  const testFiles = fs.readdirSync(path.join(root, 'tests'))
    .filter(f => f.startsWith('test-') && f.endsWith('.mjs'))
    .sort();
  const optionalOutside = new Set(['test-data-layer.mjs']);
  ok(testFiles.filter(f => !optionalOutside.has(f)).length >= 100,
    'tests/ still has full file count (' + testFiles.length + ')');

  const runnerSrc = fs.readFileSync(path.join(root, 'scripts/run-tests.mjs'), 'utf8');
  ok(runnerSrc.indexOf('extract-inline.mjs') >= 0, 'run-tests includes extract-inline.mjs');
  ok(runnerSrc.indexOf('test-suite-integrity.mjs') >= 0, 'run-tests includes suite integrity');
  ok(testFiles.includes('test-check-production.mjs'), 'test-check-production.mjs on disk');
  ok(testFiles.includes('test-api-auth.mjs'), 'test-api-auth.mjs on disk');
  ok(testFiles.includes('test-fix-pack-12.mjs'), 'test-fix-pack-12.mjs on disk');
}

console.log('\n' + pass + ' passed');
