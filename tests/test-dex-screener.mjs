/* HARDGATE — DEX SCREENER tab smoke tests.
   Run: node tests/test-dex-screener.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  vm.runInContext(read('dex-screener.js'), ctx, { filename: 'dex-screener.js' });
  return ctx;
}

console.log('== meme filter ==');
{
  const W = boot();
  ok(W.dexIsMeme({ base: 'PEPE', sym: 'PEPEUSD', exchange: 'delta' }), 'PEPE is meme');
  ok(W.dexIsMeme({ base: 'WIF', sym: 'WIFUSD', exchange: 'coindcx' }), 'WIF is meme');
  ok(!W.dexIsMeme({ base: 'BTC', sym: 'BTCUSD', exchange: 'delta' }), 'BTC is not meme');
  ok(!W.dexIsMeme({ base: 'ETH', sym: 'ETHUSD', exchange: 'delta' }), 'ETH is not meme');
  var uni = [
    { sym: 'DOGEUSD', base: 'DOGE', exchange: 'delta', turnoverUsd: 8e6 },
    { sym: 'BTCUSD', base: 'BTC', exchange: 'delta', turnoverUsd: 1e9 },
    { sym: 'B-BONK_USDT', base: 'BONK', exchange: 'coindcx', turnoverUsd: 2e6 }
  ];
  var memes = W.dexMemeFilter(uni);
  ok(memes.length === 2, 'meme filter keeps DOGE + BONK, drops BTC');
}

console.log('== explode score ==');
{
  const W = boot();
  var rows = Array.from({ length: 80 }, (_, i) => ({ t: i, o: 1, h: 1.05, l: 0.95, c: 1 + i * 0.002, v: 10 }));
  var cand = {
    kind: 'SQUEEZE-FIRE', dir: 'long',
    grade: { ticket: true, vetoes: [] },
    plan: { rr1: 2.8, entry: 1, stop: 0.9, t1: 1.2 }
  };
  var s = W.dexExplodeScore(cand, { turnoverUsd: 15e6 }, rows);
  ok(s >= 10, 'squeeze-fire ticket with momentum scores high — got ' + s);
  var chase = W.dexExplodeScore({ kind: 'ORB', dir: 'long', grade: { ticket: false, vetoes: ['x'] } },
    { chg24: 22 }, rows);
  ok(chase < s, 'overextended chase scores lower than building squeeze');
}

console.log('== HG_tabs + wiring ==');
{
  const W = boot();
  ok(W.HG_tabs.some(t => t.id === 'dexscreener'), 'HG_tabs registers dexscreener');
  const tab = W.HG_tabs.filter(t => t.id === 'dexscreener')[0];
  ok(tab && typeof tab.mount === 'function', 'mount is a function');
  ok(tab && typeof tab.refresh === 'function', 'refresh is a function');
  const html = read('index.html');
  const sw = read('sw.js');
  ok(/dex-screener\.js/.test(html), 'index.html loads dex-screener.js');
  ok(html.indexOf('dex-screener.js') < html.indexOf('desk-scan-universe.js') || html.indexOf('dex-screener.js') > html.indexOf('omniroute.js'),
    'dex-screener loads after omniroute.js');
  ok(/dexscreener/.test(html) && /DEX SCREENER/.test(read('dex-screener.js')),
    'nav group includes dexscreener');
  ok(/\.\/dex-screener\.js/.test(sw), 'sw.js HG_SHELL precaches dex-screener.js');
  ok(/const HG_CACHE = 'hg-v615'/.test(sw), 'sw.js HG_CACHE matches hg-v615');
  ok(/hgOmniSetupCard/.test(read('omniroute.js')), 'omniroute exports hgOmniSetupCard for cards');
  ok(/dexscreener:\s*'dexCards'/.test(read('setup-ui.js')), 'HG_MP_HOST maps dexscreener');
}

console.log('\npassed: ' + passed);
