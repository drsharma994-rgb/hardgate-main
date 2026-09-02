#!/usr/bin/env node
/* HARDGATE — Part4 S12/S14/S17 OMNIGOLD + SWING mint wire (hg-v568) */
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
const W = globalThis.window;

console.log('== Part4 engine still live ==');
{
  ok(typeof W.hgGoldPart4Engine === 'function', 'hgGoldPart4Engine');
  ok(typeof W.hgGoldPart4ApplyDiscountFilter === 'function', 'P/D filter');
  ok(W.HG_GOLD_P4_ADR_FADE === 1.20, 'ADR fade ≥120%');
}

console.log('\n== OMNIGOLD wiring ==');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgOgPart4Hits/.test(og), 'hgOgPart4Hits helper');
  ok(/hgOgPart4ByKind/.test(og), 'hgOgPart4ByKind for backtest');
  ok(/OG_MECHANICS[\s\S]*P4-NR7/.test(og) && /P4-ADRX/.test(og) && /P4-LAF/.test(og),
    'OG_MECHANICS lists P4-NR7/ADRX/LAF');
  ok(/'P4-NR7':\s*'TREND'/.test(og), 'P4-NR7 family TREND');
  ok(/'P4-ADRX':\s*'REVERSION'/.test(og), 'P4-ADRX family REVERSION');
  ok(/'P4-LAF':\s*'SWEEP'/.test(og), 'P4-LAF family SWEEP');
  ok(/hgOgPart4Hits\(rows/.test(og), 'detect pushes Part4 hits');
  ok(/'P4-NR7':\s*function/.test(og) && /'P4-ADRX':\s*function/.test(og)
    && /'P4-LAF':\s*function/.test(og), 'backtest map entries');
  ok(/k === 'P4-NR7'/.test(og) && /return 'p4nr7'/.test(og), 'inst key p4nr7');
  ok(/k === 'P4-ADRX'/.test(og) && /return 'p4adrx'/.test(og), 'inst key p4adrx');
  ok(/k === 'P4-LAF'/.test(og) && /return 'p4laf'/.test(og), 'inst key p4laf');
}

console.log('\n== SWING mint parity ==');
{
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/p4nr7:\s*'S12/.test(gs), 'SW_NAME p4nr7');
  ok(/p4adrx:\s*'S14/.test(gs), 'SW_NAME p4adrx');
  ok(/p4laf:\s*'S17/.test(gs), 'SW_NAME p4laf');
  ok(/p4Live\s*=\s*\{\s*p4nr7:\s*1/.test(gs) || /p4Live\s*=\s*\{[^}]*p4nr7/.test(gs),
    'swing mints Part4 live keys');
  ok(/PART4 ' \+ String\(p4hit\.key\)/.test(gs) || /stamps\.push\('PART4/.test(gs),
    'PART4 stamp on mint');
}

console.log('\n== SCALP mint unchanged ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/__gsCand\(p4hit\.key/.test(gi), 'scalp still mints Part4');
  ok(/unchecked:\s*\['S13 silver',\s*'S16 footprint'\]/.test(gi), 'S13/S16 unchecked');
}

console.log('\n== runtime OMNIGOLD Part4 hit ==');
{
  /* Shallow look-above-and-fail: balance then wick above with close back inside */
  const rows = [];
  const base = Math.floor(Date.UTC(2024, 6, 1) / 1000);
  for (let i = 0; i < 80; i++){
    const t = base + i * 3600;
    rows.push({ t, o: 2300, h: 2306, l: 2294, c: 2300, v: 60 });
  }
  /* last 3 bars: probe high by <0.4 ATR then reclaim */
  const atrGuess = 12; /* ~ATR from 12-pt range */
  const balHi = 2306;
  rows[77] = { t: base + 77 * 3600, o: 2300, h: balHi + 0.2 * atrGuess, l: 2295, c: 2302, v: 80 };
  rows[78] = { t: base + 78 * 3600, o: 2302, h: 2305, l: 2296, c: 2301, v: 70 };
  rows[79] = { t: base + 79 * 3600, o: 2301, h: 2304, l: 2297, c: 2300, v: 70 };

  const laf = W.hgGoldPart4LookAboveFail(rows);
  ok(laf && laf.ok && laf.dir === 'short', 'LAF fixture fires short (' + (laf && laf.why) + ')');

  /* Load omnigold after goldind so gfn resolves */
  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  const hits = typeof W.hgOgDetect === 'function' ? W.hgOgDetect(rows) : [];
  const p4 = (hits || []).filter(h => h && String(h.kind || '').indexOf('P4-') === 0);
  ok(p4.some(h => h.kind === 'P4-LAF' && h.dir === 'short'),
    'hgOgDetect emits P4-LAF (' + p4.map(h => h.kind).join(',') + ')');
  ok(p4.every(h => isFinite(h.level)), 'Part4 hits carry finite level');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const V = HG_VER.replace(/^hg-v/, '');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === HG_VER, 'build-stamp version (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw.js matches stamp');
  ok(new RegExp('goldind\\.js\\?v=' + V).test(html), 'index goldind ?v=');
  ok(new RegExp('goldswing\\.js\\?v=' + V).test(html), 'index goldswing ?v=');
  ok(new RegExp('omnigold\\.js\\?v=' + V).test(html), 'index omnigold ?v=');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
