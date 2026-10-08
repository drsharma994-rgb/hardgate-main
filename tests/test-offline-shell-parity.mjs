/* HARDGATE — offline shell parity (task #12): index.html ⇔ sw.js HG_SHELL.
 *
   v896 lesson, automated at last: 29 tab scripts were loaded by index.html
   but never precached, so the offline app silently lost whole tabs — and the
   parity guard of the day matched ZERO scripts because every src carried a
   ?v= cachebuster. This test strips the cachebusters and asserts BOTH
   directions that matter for "key tabs work offline":

     1. every <script src> in index.html is in HG_SHELL (offline tabs complete)
     2. every local <link> asset (stylesheet/manifest/icon) is in HG_SHELL
        (found the MAIN stylesheet missing here on first run)
     3. the key tabs are explicitly present
     4. the shell is real: >200 entries, all existing on disk
   Run: node tests/test-offline-shell-parity.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.error('  FAIL —', label); }
};

const shellRaw = /const HG_SHELL = \[([\s\S]*?)\];/.exec(SW);
ok(!!shellRaw, 'HG_SHELL list found in sw.js');
const SHELL = new Set(
  [...shellRaw[1].matchAll(/'([^']+)'/g)].map(m => m[1].replace(/^\.\//, ''))
);
ok(SHELL.size > 200, 'the shell is a full app shell (' + SHELL.size + ' entries)');

const strip = s => s.replace(/^\.\//, '').split('?')[0];

console.log('\n== 1) every script index.html loads is precached (the v896 guard, cachebuster-proof) ==');
{
  const srcs = [...HTML.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)].map(m => strip(m[1]));
  ok(srcs.length > 100, 'index.html loads ' + srcs.length + ' scripts');
  const missing = [...new Set(srcs)].filter(s => !SHELL.has(s));
  ok(missing.length === 0,
    'ALL of them are in HG_SHELL' + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
}

console.log('\n== 2) local link assets are precached too ==');
{
  const links = [...HTML.matchAll(/<link\b[^>]*\bhref="([^"]+)"/gi)]
    .map(m => strip(m[1]))
    .filter(h => !/^(https?:|data:)/.test(h));
  ok(links.length >= 5, 'index.html links ' + links.length + ' local assets');
  const missing = [...new Set(links)].filter(l => !SHELL.has(l));
  ok(missing.length === 0,
    'ALL of them are in HG_SHELL' + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
  ok(SHELL.has('trading-dashboard-pro.css'),
    'the MAIN stylesheet (trading-dashboard-pro.css) is cached — the offline app is styled');
}

console.log('\n== 3) the key tabs survive offline ==');
{
  const KEY = ['index.html', 'manifest.webmanifest', 'build-stamp.js',
    'omnigold.js', 'goldind.js', 'omniroute.js', 'brain.js',
    'hgalert.js', 'trading-dashboard-pro.css'];
  const missing = KEY.filter(k => !SHELL.has(k));
  ok(missing.length === 0, 'OMNIGOLD + GOLDIND + OMNIROUTE + BRAIN + bell + shell are precached'
    + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
}

console.log('\n== 4) every shell entry exists on disk (no guaranteed-404 installs) ==');
{
  const missing = [...SHELL].filter(u => {
    if (!/\.(js|css|html|svg|webmanifest|png)$/.test(u)) return false;
    return !fs.existsSync(path.join(ROOT, u));
  });
  ok(missing.length === 0, 'all shell files exist'
    + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
console.log('ALL OFFLINE SHELL PARITY TESTS PASSED');
