#!/usr/bin/env node
/* HARDGATE — Part5 S19–S28 OMNIGOLD + SCALP/SWING mint wire (hg-v574) */
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
const W = globalThis.window;

console.log('== Part5 engine live ==');
{
  ok(typeof W.hgGoldPart5Engine === 'function', 'hgGoldPart5Engine');
  ok(typeof W.hgGoldPart5ApplyRegimeFilter === 'function', 'S23 filter');
  ok(typeof W.hgGoldPart5ApplyWeeklyBiasFilter === 'function', 'S28 filter');
  ok(W.HG_GOLD_P5_KER_TREND === 0.60, 'KER trend');
}

console.log('\n== OMNIGOLD wiring ==');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgOgPart5Hits/.test(og), 'hgOgPart5Hits helper');
  ok(/hgOgPart5ByKind/.test(og), 'hgOgPart5ByKind for backtest');
  ok(/OG_MECHANICS[\s\S]*P5-WYCK/.test(og) && /P5-TURT/.test(og) && /P5-VWAP/.test(og)
    && /P5-DRIVE/.test(og) && /P5-NEWS/.test(og),
    'OG_MECHANICS lists P5 live kinds');
  ok(/'P5-WYCK':\s*'STRUCTURE'/.test(og), 'P5-WYCK family STRUCTURE');
  ok(/'P5-TURT':\s*'SWEEP'/.test(og), 'P5-TURT family SWEEP');
  ok(/'P5-VWAP':\s*'FLOW'/.test(og), 'P5-VWAP family FLOW');
  ok(/'P5-DRIVE':\s*'STRUCTURE'/.test(og), 'P5-DRIVE family STRUCTURE');
  ok(/'P5-NEWS':\s*'SWEEP'/.test(og), 'P5-NEWS family SWEEP');
  ok(/hgOgPart5ByKind\(rows,\s*'P5-WYCK'/.test(og), 'detect pushes Part5 ByKind');
  ok(/'P5-WYCK':\s*function/.test(og) && /'P5-TURT':\s*function/.test(og)
    && /'P5-VWAP':\s*function/.test(og) && /'P5-DRIVE':\s*function/.test(og)
    && /'P5-NEWS':\s*function/.test(og), 'backtest map entries');
  ok(/k === 'P5-WYCK'/.test(og) && /return 'p5wyck'/.test(og), 'inst key p5wyck');
  ok(/k === 'P5-TURT'/.test(og) && /return 'p5turt'/.test(og), 'inst key p5turt');
}

console.log('\n== SWING mint parity (confirmed-only) ==');
{
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/p5wyck:\s*'S19/.test(gs), 'SW_NAME p5wyck');
  ok(/p5turt:\s*'S20/.test(gs), 'SW_NAME p5turt');
  ok(/p5vwap:\s*'S22/.test(gs), 'SW_NAME p5vwap');
  ok(/p5drive:\s*'S24/.test(gs), 'SW_NAME p5drive');
  ok(/p5news:\s*'S27/.test(gs), 'SW_NAME p5news');
  ok(/p5Live\s*=\s*\{[^}]*p5wyck/.test(gs), 'swing mints Part5 live keys');
  ok(/p5hit\.grade !== 'confirmed'/.test(gs), 'SWING confirmed-only gate');
  ok(/PART5 ' \+ String\(p5hit\.key\)/.test(gs) || /stamps\.push\('PART5/.test(gs),
    'PART5 stamp on mint');
  ok(/reads:\s*\{\s*long:/.test(gs), 'soft-mint includes reads for cardHTML');
}

console.log('\n== SCALP mint ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/__gsCand\(p5hit\.key/.test(gi), 'scalp mints Part5');
  ok(/p5hit\.grade !== 'forming' && p5hit\.grade !== 'confirmed'/.test(gi),
    'scalp allows forming+confirmed');
  ok(/unchecked:\s*\[[^\]]*S21 implied-move/.test(gi)
    && /S26 expiry pin/.test(gi), 'S21/S26 unchecked');
}

console.log('\n== runtime OMNIGOLD Part5 hit ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 1) / 1000);
  for (let d = 0; d < 6; d++){
    for (let h = 0; h < 24; h++){
      const i = d * 24 + h;
      rows.push({ t: t0 + i * 3600, o: 2300, h: 2310, l: 2290, c: 2300, v: 100 });
    }
  }
  const n = rows.length;
  rows[n - 8] = { t: rows[n - 8].t, o: 2295, h: 2300, l: 2280, c: 2296, v: 200 };
  for (let k = n - 7; k <= n - 5; k++){
    rows[k] = { t: rows[k].t, o: 2298, h: 2305, l: 2292, c: 2300, v: 100 };
  }
  rows[n - 2] = { t: rows[n - 2].t, o: 2298, h: 2302, l: 2285, c: 2299, v: 80 };
  rows[n - 1] = { t: rows[n - 1].t, o: 2300, h: 2305, l: 2295, c: 2301, v: 90 };

  const wy = W.hgGoldPart5Wyckoff(rows);
  ok(wy && wy.ok && wy.dir === 'long' && wy.grade === 'confirmed',
    'Wyckoff fixture confirmed long');

  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  const hits = typeof W.hgOgDetect === 'function' ? W.hgOgDetect(rows) : [];
  const p5 = (hits || []).filter(h => h && String(h.kind || '').indexOf('P5-') === 0);
  ok(p5.some(h => h.kind === 'P5-WYCK' && h.dir === 'long'),
    'hgOgDetect emits P5-WYCK (' + p5.map(h => h.kind).join(',') + ')');
  ok(p5.every(h => isFinite(h.level)), 'Part5 hits carry finite level');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === 'hg-v574', 'build-stamp version (got ' + (m && m[1]) + ')');
  ok(sw.indexOf("HG_CACHE = 'hg-v574'") >= 0, 'sw.js matches stamp');
  ok(/goldind\.js\?v=572/.test(html), 'index goldind ?v=');
  ok(/goldswing\.js\?v=572/.test(html), 'index goldswing ?v=');
  ok(/omnigold\.js\?v=572/.test(html), 'index omnigold ?v=');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
