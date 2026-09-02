#!/usr/bin/env node
/* HARDGATE — Master Catalog wire on SCALP / SWING / OMNIGOLD (hg-v577) */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

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

console.log('== files ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const gsc = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  ok(/hgGoldCatalogEngine/.test(gi) && /hgGoldCatalogApplyVerdict/.test(gi), 'SCALP applies catalog');
  ok(/hgGoldCatalogHtml/.test(gi), 'forming stack HTML');
  ok(/formingLayersHtml\(\)/.test(gs) && /feeds failed: keep WHY SILENT/.test(gs),
    'SWING empty path still paints catalog');
  ok(/formingLayersHtml\(\)/.test(gsc) && /feeds failed: keep WHY SILENT/.test(gsc),
    'SCALP empty path still paints catalog');
  ok(/catFnM/.test(gsc) && /catFnM/.test(gs), 'SCALP+SWING paint catalog on mount');
  ok(/hgGoldCatalogApplyVerdict/.test(gs), 'SWING applies catalog');
  ok(/hgGoldCatalogApplyVerdict/.test(og) && /catalogExclude/.test(og), 'OMNIGOLD formation catalog');
  ok(/hgGoldCatalogHtml/.test(og), 'OMNIGOLD coverage paints catalog');
  ok(/catFn0/.test(og) && /ui\.coverage\.innerHTML = catHtml0/.test(og),
    'OMNIGOLD paints catalog on mount');
  ok(/catHtmlM\(catFnM/.test(gsc) && /catHtmlM\(catFnM/.test(gs),
    'SCALP+SWING mount writes catalog HTML');
  ok(/gold-catalog\.js\?v=577/.test(html), 'index loads gold-catalog.js');
}

console.log('\n== runtime ==');
{
  ok(typeof W.hgGoldCatalogEngine === 'function', 'engine export');
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000);
  for (let i = 0; i < 60; i++)
    rows.push({ t: t0 + i * 900, o: 2300, h: 2305, l: 2295, c: 2300 + i * 0.05, v: 80 });
  const eng = W.hgGoldCatalogEngine(rows, {});
  ok(eng.ok && /LIVE SET/.test(W.hgGoldCatalogHtml(eng)), 'html live set');
  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  ok(typeof W.hgOgFormation === 'function', 'hgOgFormation loaded');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === 'hg-v577', 'stamp (got ' + (m && m[1]) + ')');
  ok(sw.indexOf("HG_CACHE = 'hg-v577'") >= 0, 'sw cache');
  ok(/goldind\.js\?v=577/.test(html) && /omnigold\.js\?v=577/.test(html), 'index ?v=577');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
