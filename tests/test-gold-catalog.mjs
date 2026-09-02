#!/usr/bin/env node
/* HARDGATE — Gold Master Catalog v1.0 (hg-v577) */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { swCacheOk } from './helpers/build-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..') + '/';

let passed = 0, failed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok —', msg); }
  else { failed++; console.log('  FAIL —', msg); }
}

globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
vm.runInThisContext(fs.readFileSync(root + 'indicators2.js', 'utf8'), { filename: 'indicators2.js' });
vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
vm.runInThisContext(fs.readFileSync(root + 'gold-catalog.js', 'utf8'), { filename: 'gold-catalog.js' });
const W = globalThis.window;

console.log('== inventory ==');
ok(W.HG_GOLD_CATALOG_VER === '1.0', 'catalog version 1.0');
ok(Array.isArray(W.HG_GOLD_CATALOG_IND) && W.HG_GOLD_CATALOG_IND.length === 184, '184 indicators');
ok(Array.isArray(W.HG_GOLD_CATALOG_STRAT) && W.HG_GOLD_CATALOG_STRAT.length === 20, '20 L1 strategy maps');
ok(W.HG_GOLD_CATALOG_LIVE.join(',') === 'S0,S19,S20', 'live set S0/S19/S20');
ok(W.HG_GOLD_CATALOG_SCHED.join(',') === 'S23,S28,S59', 'schedulers');
ok(W.HG_GOLD_CATALOG_RULES.indexOf('S66') >= 0, 'freeze S66');

const ids = W.HG_GOLD_CATALOG_IND.map(r => r[0]);
ok(new Set(ids).size === 184 && ids[0] === 1 && ids[183] === 184, 'ids 1–184 unique');

console.log('\n== one vote per family ==');
{
  const fam = W.hgGoldCatalogFamilyVotes();
  ok(fam.Momentum && fam.Momentum.redundant >= 10, 'momentum REDUNDANT cluster (oscillators)');
  ok(fam.Trader && fam.Trader.core === 5, 'trader family 5 CORE metrics');
  ok(fam.Structure && fam.Structure.core >= 8, 'structure CORE present');
  const momCore = W.HG_GOLD_CATALOG_IND.filter(r => r[5] === 'Momentum' && r[6] === 'CORE');
  ok(momCore.length >= 1 && momCore.some(r => /RSI/.test(r[1])), 'momentum CORE is RSI');
}

console.log('\n== verdicts never invent ENTER ==');
{
  const blank = { dir: 'long', stamps: [], demoted: false, stratKey: 'rsidiv' };
  W.hgGoldCatalogApplyVerdict(blank, null);
  ok(blank.dir === 'long', 'apply never flips dir');
  const avoid = { dir: 'short', stamps: [], stratKey: 'openrange' };
  W.hgGoldCatalogApplyVerdict(avoid, null);
  /* openrange is OPTIONAL S5 — stamp, do not invent */
  ok(!avoid.catalogExclude, 'OPTIONAL IB/ORB not excluded');
  ok((avoid.stamps || []).indexOf('CATALOG UPGRADE') >= 0, 'L1 ORB stamped UPGRADE S5');

  const fib = { dir: 'long', stamps: [], stratKey: 'does-not-exist' };
  W.hgGoldCatalogApplyVerdict(fib, null);
  ok(!fib.catalogExclude && fib.dir === 'long', 'unknown key fail-open (no invented ticket)');

  const s0 = { dir: 'long', stamps: [], stratKey: 'sweep', kind: 'PDH-SWEEP' };
  W.hgGoldCatalogApplyVerdict(s0, null);
  ok(!s0.catalogExclude && s0.catalogVerdict === 'CORE' && s0.dir === 'long',
    'S0 sweep stays CORE — never excluded');
  ok((s0.stamps || []).indexOf('CATALOG LIVE') >= 0, 'live-set S0 stamped CATALOG LIVE');

  W.HG_GOLD_CATALOG_IND.push([999, 'Test redundant', 'L1', 1, 1, 'Momentum', 'REDUNDANT', '—', 'testredun']);
  const red = { dir: 'short', stamps: [], stratKey: 'testredun' };
  W.hgGoldCatalogApplyVerdict(red, null);
  W.HG_GOLD_CATALOG_IND.pop();
  ok(red.catalogExclude && red.demoted && red.dir === 'short',
    'REDUNDANT demotes — never invents ENTER or flips dir');
}

console.log('\n== NON_FALSIFIABLE / AVOID listed, not gates ==');
{
  const nf = W.HG_GOLD_CATALOG_IND.filter(r => r[6] === 'NON_FALSIFIABLE');
  ok(nf.length >= 3 && nf.some(r => /Elliott/.test(r[1])), 'Elliott listed NON_FALSIFIABLE');
  ok(nf.every(r => !r[8]), 'NON_FALSIFIABLE have no live wire');
  const avoid = W.HG_GOLD_CATALOG_IND.filter(r => r[6] === 'AVOID');
  ok(avoid.length >= 1 && /visible range/i.test(avoid[0][1]), 'VRVP AVOID');
  const excl = W.HG_GOLD_CATALOG_EXCLUDE;
  ok(excl.some(e => /Martingale/.test(e[0])), 'martingale excluded');
  ok(excl.some(e => /News straddle/.test(e[0])), 'news straddle excluded');
}

console.log('\n== engine frames ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000);
  for (let i = 0; i < 80; i++)
    rows.push({ t: t0 + i * 900, o: 2300 + i * 0.1, h: 2302, l: 2298, c: 2300 + i * 0.1, v: 100 });
  const eng = W.hgGoldCatalogEngine(rows, {});
  ok(eng.ok && eng.nInd === 184, 'engine ok');
  ok(eng.core >= 40 && eng.optional >= 40, 'CORE/OPTIONAL split');
  const frames = (eng.strategies || []).filter(s => s.grade === 'frame');
  ok(frames.length >= 2 && frames.every(s => !s.dir), 'frames never invent dir');
  ok(eng.linreg && eng.linreg.ok, 'linreg OPTIONAL frame');
  const html = W.hgGoldCatalogHtml(eng);
  ok(/MASTER CATALOG/i.test(html) && /LIVE SET/.test(html), 'html renders live set');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const m = stamp.match(/version\s*:\s*['"]([^'"]+)['"]/);
  ok(m && m[1] === 'hg-v577', 'build-stamp hg-v577 (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw.js matches');
  ok(sw.indexOf('gold-catalog.js') >= 0, 'HG_SHELL precaches gold-catalog.js');
}

if (failed){ console.log('\n' + failed + ' failed, ' + passed + ' passed'); process.exit(1); }
console.log('\n' + passed + ' passed, 0 failed');
