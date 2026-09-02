#!/usr/bin/env node
/* HARDGATE — Master Catalog wire on SCALP / SWING / OMNIGOLD (hg-v577) */
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
  const V = HG_VER.replace(/^hg-v/, '');
  ok(/hgGoldCatalogEngine/.test(gi) && /hgGoldCatalogApplyVerdict/.test(gi), 'SCALP applies catalog');
  ok(/hgGoldCatalogHtml/.test(gi), 'forming stack HTML');
  ok(/feeds failed: cards stay empty/.test(gs) && /hgGoldCatalogHtml/.test(gs),
    'SWING empty path paints catalog on empty, not cards');
  ok(/feeds failed: cards stay empty/.test(gsc) && /hgGoldCatalogHtml/.test(gsc),
    'SCALP empty path paints catalog on empty, not cards');
  ok(/catFnM/.test(gsc) && /catFnM/.test(gs), 'SCALP+SWING paint catalog on mount');
  ok(/hgGoldCatalogApplyVerdict/.test(gs), 'SWING applies catalog');
  ok(/hgGoldCatalogApplyVerdict/.test(og) && /catalogExclude/.test(og), 'OMNIGOLD formation catalog');
  ok(/hgGoldCatalogHtml/.test(og), 'OMNIGOLD coverage paints catalog');
  ok(/catFn0/.test(og) && /ui\.coverage\.innerHTML = catHtml0/.test(og),
    'OMNIGOLD paints catalog on mount');
  ok(/catHtmlM\(catFnM/.test(gsc) && /catHtmlM\(catFnM/.test(gs),
    'SCALP+SWING mount writes catalog HTML');
  ok(new RegExp('gold-catalog\\.js\\?v=' + V).test(html), 'index loads gold-catalog.js');
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
  const V = HG_VER.replace(/^hg-v/, '');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === HG_VER, 'stamp (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw cache');
  ok(new RegExp('goldind\\.js\\?v=' + V).test(html) && new RegExp('omnigold\\.js\\?v=' + V).test(html), 'index ?v= matches stamp');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
