/* HARDGATE — crypto scan audit regression (hg-v630) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cg = fs.readFileSync(path.join(ROOT, 'cryptogates.js'), 'utf8');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

ok(swCacheOk(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), 'sw.js matches ' + HG_VER);
ok(/function hgSpecialtyScanUni/.test(html), 'hgSpecialtyScanUni helper exists');
ok(/hgSpecialtyScanUni\(/.test(html) && !/runTrapScanLeg[\s\S]{0,400}hgVenueFullUni/.test(html), 'TRAP uses specialty universe');
ok(/dropForming\(await binanceKlines\(bSym/.test(html), 'BIAS B1 applies dropForming to Binance confirm');
ok(/rows\[k\]\.l < bbOuter\.lower\[k\]/.test(html), 'TRAP sweep uses per-bar Bollinger lower');
ok(/smcDispOk\(bar2/.test(html), 'SMC FVG requires displacement magnitude');
ok(/for \(let j = rows\.length - 2; j >=/.test(html), 'SMC FVG scans newest-first with HTF break');
ok(/e21a\[n - 1\]/.test(cg), 'scalpGateMatrix e21 uses n-1 index');
ok(/minsToFunding == null/.test(cg), 'scalpGateMatrix null-safe funding settle gate');
ok(/G6 ATR-capacity R:R/.test(cg), 'swing G6 labelled as ATR-capacity R:R');

console.log('\n' + passed + ' assertions passed');
