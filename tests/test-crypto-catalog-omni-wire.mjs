#!/usr/bin/env node
/* HARDGATE — Crypto Master Catalog wire on OMNIROUTE + OMNIPRESENT */
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

console.log('== files ==');
{
  const or = fs.readFileSync(root + 'omniroute.js', 'utf8');
  const op = fs.readFileSync(root + 'omnipresent.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');

  ok(/hgCryptoCatalogApplyVerdict/.test(or), 'OMNIROUTE applies catalog on formation');
  ok(/catalogExclude/.test(or), 'OMNIROUTE refuses excluded formation');
  ok(/hgCryptoCatalogHtml/.test(or) && /hgOmniPaintCatalog/.test(or), 'OMNIROUTE paints catalog');
  ok(/id="omniCatalog"/.test(or), 'OMNIROUTE dedicated catalog host');
  ok(!/ui\.cards\.innerHTML = htmlFn/.test(or) && !/ui\.cards\.innerHTML = .*catalog/i.test(or),
    'OMNIROUTE does not write catalog into cards');

  ok(/hgCryptoCatalogApplyVerdict/.test(op), 'OMNIPRESENT applies catalog');
  ok(/opPaintCatalog/.test(op) && /hgCryptoCatalogHtml/.test(op), 'OMNIPRESENT paints catalog');
  ok(/id="opCatalog"/.test(op), 'OMNIPRESENT dedicated catalog host');
  ok(!/ui\.cards\.innerHTML = htmlFn/.test(op), 'OMNIPRESENT does not write catalog into cards');

  const V = HG_VER.replace(/^hg-v/, '');
  ok(new RegExp('crypto-catalog\\.js\\?v=' + V).test(html), 'index loads crypto-catalog.js');
  ok(new RegExp('<script src="crypto-catalog\\.js\\?v=' + V + '"><\\/script>\\s*<script src="omniroute\\.js').test(html),
    'catalog script loads before omniroute.js');
  ok(new RegExp('omniroute\\.js\\?v=' + V).test(html) && new RegExp('omnipresent\\.js\\?v=' + V).test(html),
    'desk scripts cache-busted to stamp');
  ok(swCacheOk(sw), 'sw cache matches stamp');
  ok(sw.indexOf('./crypto-catalog.js') >= 0, 'HG_SHELL includes crypto-catalog.js');
}

console.log('\n== runtime ==');
{
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'crypto-catalog.js', 'utf8'), { filename: 'crypto-catalog.js' });
  const W = globalThis.window;
  ok(typeof W.hgCryptoCatalogEngine === 'function', 'engine export');
  ok(typeof W.hgCryptoCatalogApplyVerdict === 'function', 'apply export');
  const html = W.hgCryptoCatalogHtml(W.hgCryptoCatalogEngine([], {}));
  ok(/LIVE SET/.test(html) && /never ENTER/.test(html), 'html live set');
  ok(!/MOST PROBABLE/.test(html) || /map only/.test(html), 'panel is a map, not a ticket');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === HG_VER, 'stamp (got ' + (m && m[1]) + ')');
  ok(/^hg-v\d+$/.test(HG_VER), 'stamp is hg-vNNN (got ' + HG_VER + ')');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
