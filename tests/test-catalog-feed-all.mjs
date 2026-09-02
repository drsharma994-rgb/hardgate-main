#!/usr/bin/env node
/* HARDGATE — catalog feed on every listed desk (hg-v579)
   Walks 118+85 crypto and 184+20 gold. Stamps USED vs UNCHECKED.
   Never invents ENTER. Never flips dir. Catalog HTML never lands in cards. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..') + '/';
const V = HG_VER.replace(/^hg-v/, '');

let passed = 0, failed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok —', msg); }
  else { failed++; console.log('  FAIL —', msg); }
}

function bars(n, start, step){
  const out = [];
  const t0 = Math.floor(Date.UTC(2026, 5, 3, 12, 0) / 1000);
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    out.push({ t: t0 + i * 900, o: c - 1, h: c + 2, l: c - 2, c: c, v: 80 + (i % 5) });
  }
  return out;
}

console.log('== files ==');
{
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const or = fs.readFileSync(root + 'omniroute.js', 'utf8');
  const op = fs.readFileSync(root + 'omnipresent.js', 'utf8');
  const cg = fs.readFileSync(root + 'cryptogates.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');

  ok(/id="swingCatalog"/.test(html), 'SWING has dedicated catalog host');
  ok(/id="scalpCatalog"/.test(html), 'SCALP has dedicated catalog host');
  ok(html.indexOf('id="swingCatalog"') < html.indexOf('id="swingCards"'),
    'SWING catalog host sits before cards');
  ok(html.indexOf('id="scalpCatalog"') < html.indexOf('id="scalpCards"'),
    'SCALP catalog host sits before cards');
  ok(/hgCryptoCatalogPaint/.test(html), 'SWING/SCALP scan paints catalog host');
  ok(!/swingCards.*hgCryptoCatalogHtml/.test(html) && !/scalpCards.*hgCryptoCatalogHtml/.test(html),
    'SWING/SCALP cards are not catalog hosts');

  ok(/hgCryptoCatalogFeed|catalogEng/.test(or), 'OMNIROUTE caches catalog engine/feed');
  ok(/desk: 'OMNIROUTE'/.test(or) && /extra\.rows|rows: rows/.test(or),
    'OMNIROUTE apply receives rows');
  ok(/desk: 'OMNIPRESENT'/.test(op) && /rows: rows/.test(op),
    'OMNIPRESENT apply receives rows');
  ok(/desk: 'SWING'/.test(cg) && /desk: 'SCALP'/.test(cg),
    'cryptogates stamps SWING + SCALP');
  ok(/hgGoldCatalogEngine/.test(og) && /catApply\(probe/.test(og),
    'OMNIGOLD apply uses gold engine');
  ok(/hgGoldCatalogApplyVerdict/.test(gi) && /hgGoldCatalogApplyVerdict/.test(gs),
    'GOLD SCALP + GOLD SWING still apply');

  ok(new RegExp('crypto-catalog\\.js\\?v=' + V).test(html), 'crypto-catalog pin');
  ok(new RegExp('gold-catalog\\.js\\?v=' + V).test(html), 'gold-catalog pin');
  ok(swCacheOk(sw), 'sw cache matches stamp');
}

console.log('\n== crypto feed ==');
{
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'crypto-catalog.js', 'utf8'), { filename: 'crypto-catalog.js' });
  const W = globalThis.window;
  ok(typeof W.hgCryptoCatalogFeed === 'function', 'crypto feed export');
  const rows = bars(80, 100, 0.2);
  const feed = W.hgCryptoCatalogFeed(rows, { dir: 'long', now: new Date(Date.UTC(2026, 8, 2, 12, 0)) });
  ok(feed.totalInd === 118 && feed.totalStrat === 85, 'walks 118 + 85');
  ok(feed.usedN + feed.uncheckedN + feed.excludedN === 203,
    'every crypto item classified (got ' + (feed.usedN + feed.uncheckedN + feed.excludedN) + ')');
  ok(feed.usedN >= 8, 'bar-computable CORE items USED (got ' + feed.usedN + ')');
  ok(feed.enter === false, 'feed never ENTER');
  ok((feed.frames || []).every(f => f.dir == null), 'frames have no dir');
  const rsi = (feed.used || []).find(x => x.id === 30);
  ok(rsi && rsi.status === 'USED', 'RSI 68/32 USED as stamp');
  const cme = (feed.excluded || []).find(x => x.id === 16);
  ok(cme && cme.status === 'EXCLUDE', 'CME gap EXCLUDE');

  const sat = W.hgCryptoCatalogFeed([], { now: new Date(Date.UTC(2026, 8, 5, 12, 0)) });
  ok((sat.frames || []).some(f => f.id === 'C-WEEKEND') && sat.frames.every(f => f.dir == null),
    'weekend frame, no dir');

  const long = { dir: 'long', kind: 'PO3' };
  W.hgCryptoCatalogApplyVerdict(long, null, { rows: rows, dir: 'long', desk: 'SWING' });
  ok(long.dir === 'long' && long.catalogUsedN >= 1 && !long.catalogExclude,
    'apply attaches feed, keeps dir, no invented exclude');
  const grid = { dir: 'short', kind: 'GRID' };
  W.hgCryptoCatalogApplyVerdict(grid, null, { rows: rows, dir: 'short' });
  ok(grid.dir === 'short' && grid.catalogExclude && grid.catalogUsedN >= 1,
    'GRID exclude keeps dir and still attaches feed');

  const eng = W.hgCryptoCatalogEngine(rows, { dir: 'long' });
  ok(eng.enter === false && eng.usedN === feed.usedN, 'engine carries feed counts');
  const html = W.hgCryptoCatalogHtml(eng);
  ok(/USED/.test(html) && /never ENTER/.test(html) && /data-hg-crypto-catalog/.test(html),
    'crypto html names USED + never ENTER');
  ok(typeof W.hgCryptoCatalogPaint === 'function', 'paint helper exported');
}

console.log('\n== gold feed ==');
{
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
  vm.runInThisContext(fs.readFileSync(root + 'indicators2.js', 'utf8'), { filename: 'indicators2.js' });
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'gold-catalog.js', 'utf8'), { filename: 'gold-catalog.js' });
  const W = globalThis.window;
  ok(typeof W.hgGoldCatalogFeed === 'function', 'gold feed export');
  const rows = bars(80, 2300, 0.15);
  const feed = W.hgGoldCatalogFeed(rows, {});
  ok(feed.totalInd === 184 && feed.totalStrat === 20, 'walks 184 + 20');
  ok(feed.usedN + feed.uncheckedN + feed.excludedN === 204,
    'every gold item classified (got ' + (feed.usedN + feed.uncheckedN + feed.excludedN) + ')');
  ok(feed.usedN >= 10, 'wired + bar-computable USED (got ' + feed.usedN + ')');
  ok(feed.enter === false, 'gold feed never ENTER');
  const sweep = { dir: 'short', stamps: [], stratKey: 'sweep', kind: 'PDH-SWEEP' };
  W.hgGoldCatalogApplyVerdict(sweep, W.hgGoldCatalogEngine(rows, {}));
  ok(sweep.dir === 'short' && sweep.catalogUsedN >= 1 && !sweep.catalogExclude,
    'gold apply keeps dir and attaches feed');
  const eng = W.hgGoldCatalogEngine(rows, {});
  ok(/USED/.test(W.hgGoldCatalogHtml(eng)), 'gold html names USED');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === HG_VER, 'stamp ' + HG_VER);
  ok(/^hg-v\d+$/.test(HG_VER), 'stamp is hg-vN (got ' + HG_VER + ')');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
