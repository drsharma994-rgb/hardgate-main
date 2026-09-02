#!/usr/bin/env node
/* HARDGATE — Crypto Master Catalog v1.0 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..') + '/';

let passed = 0, failed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok —', msg); }
  else { failed++; console.log('  FAIL —', msg); }
}

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'crypto-catalog.js', 'utf8'), { filename: 'crypto-catalog.js' });
const W = globalThis.window;

console.log('== inventory ==');
ok(W.HG_CRYPTO_CATALOG_VER === '1.0', 'catalog version 1.0');
ok(Array.isArray(W.HG_CRYPTO_CATALOG_IND) && W.HG_CRYPTO_CATALOG_IND.length === 118, '118 indicators');
ok(Array.isArray(W.HG_CRYPTO_CATALOG_STRAT) && W.HG_CRYPTO_CATALOG_STRAT.length === 85, '85 strategies');
ok(W.HG_CRYPTO_CATALOG_LIVE.join(',') === 'CASCADE,S19,S20', 'live set CASCADE/S19/S20');
ok(W.HG_CRYPTO_CATALOG_SCHED.join(',') === 'S23,C14,S59,C24', 'schedulers');
ok(W.HG_CRYPTO_CATALOG_RULES.indexOf('S66') >= 0, 'freeze S66');
ok(W.HG_CRYPTO_CATALOG_RULES.indexOf('FUND-CAP') >= 0, 'funding cap rule');
ok(W.HG_CRYPTO_CATALOG_RULES.indexOf('BTC-ALIGN') >= 0, 'BTC alignment rule');

const ids = W.HG_CRYPTO_CATALOG_IND.map(r => r[0]);
ok(new Set(ids).size === 118 && ids[0] === 1 && ids[117] === 118, 'ids 1–118 unique');

console.log('\n== one vote per family ==');
{
  const momCore = W.HG_CRYPTO_CATALOG_IND.filter(r => r[5] === 'Momentum' && r[6] === 'CORE');
  ok(momCore.length >= 1 && momCore.every(r => /RSI/.test(r[1])), 'momentum CORE is RSI');
  const momRed = W.HG_CRYPTO_CATALOG_IND.filter(r => r[5] === 'Momentum' && r[6] === 'REDUNDANT');
  ok(momRed.length >= 1 && /Stochastic/.test(momRed[0][1]), 'momentum REDUNDANT oscillators');
  const trader = W.HG_CRYPTO_CATALOG_IND.filter(r => r[5] === 'Trader' && r[6] === 'CORE');
  ok(trader.length === 5, 'trader family 5 CORE metrics');
}

console.log('\n== CME retired ==');
{
  const cme = W.HG_CRYPTO_CATALOG_IND.filter(r => r[0] === 16)[0];
  ok(cme && cme[6] === 'RETIRED' && /CME/.test(cme[1]), 'indicator #16 CME gap RETIRED');
  const cmeS = W.HG_CRYPTO_CATALOG_STRAT.filter(r => r[0] === 30)[0];
  ok(cmeS && cmeS[5] === 'RETIRED', 'strategy #30 CME gap fill RETIRED');
}

console.log('\n== verdicts never invent ENTER / never flip dir ==');
{
  const blank = { dir: 'long', kind: 'PO3' };
  W.hgCryptoCatalogApplyVerdict(blank, null);
  ok(blank.dir === 'long' && !blank.catalogExclude, 'Judas/PO3 stays CORE, dir intact');

  const avoid = { dir: 'short', kind: 'GRID' };
  W.hgCryptoCatalogApplyVerdict(avoid, null);
  ok(avoid.catalogExclude && avoid.demoted && avoid.dir === 'short',
    'GRID AVOID demotes — never flips dir');

  const retired = { dir: 'long', kind: 'CME-GAP' };
  W.hgCryptoCatalogApplyVerdict(retired, null);
  ok(retired.catalogExclude && retired.catalogVerdict === 'RETIRED' && retired.dir === 'long',
    'CME-GAP RETIRED excluded, dir intact');

  const unknown = { dir: 'short', kind: 'does-not-exist' };
  W.hgCryptoCatalogApplyVerdict(unknown, null);
  ok(!unknown.catalogExclude && unknown.dir === 'short', 'unknown kind fail-open');

  const armed = { dir: 'long', kind: 'OP-ARMED' };
  W.hgCryptoCatalogApplyVerdict(armed, null);
  ok(!armed.catalogExclude && armed.dir === 'long', 'OP-ARMED fail-open as S0');
}

console.log('\n== engine frames ==');
{
  const sat = W.hgCryptoCatalogEngine([], { now: new Date(Date.UTC(2026, 8, 5, 12, 0)) });
  ok(sat.enter === false, 'engine never ENTER');
  ok(sat.frames.some(f => f.id === 'C-WEEKEND') && sat.frames.every(f => f.dir == null),
    'weekend frame, no dir');
  const fund = W.hgCryptoCatalogEngine([], { now: new Date(Date.UTC(2026, 8, 2, 7, 50)) });
  ok(fund.frames.some(f => f.id === 'C-FUND-WINDOW') && fund.frames.every(f => f.dir == null),
    'funding pre-window frame, no dir');
  const html = W.hgCryptoCatalogHtml(sat);
  ok(/LIVE SET/.test(html) && /never ENTER/.test(html), 'html LIVE SET + never ENTER');
  ok(/data-hg-crypto-catalog="1"/.test(html), 'catalog panel marker');
  ok(/RETIRED/.test(html) && /CASCADE/.test(html), 'html names retired + live cascade');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const m = stamp.match(/version\s*:\s*['"]([^'"]+)['"]/);
  ok(m && m[1] === HG_VER, 'build-stamp ' + HG_VER + ' (got ' + (m && m[1]) + ')');
  ok(/^hg-v\d+$/.test(HG_VER), 'stamp is hg-vNNN (got ' + HG_VER + ')');
  ok(swCacheOk(sw), 'sw.js matches');
  ok(sw.indexOf('crypto-catalog.js') >= 0, 'HG_SHELL precaches crypto-catalog.js');
}

if (failed){ console.log('\n' + failed + ' failed, ' + passed + ' passed'); process.exit(1); }
console.log('\n' + passed + ' passed, 0 failed');
