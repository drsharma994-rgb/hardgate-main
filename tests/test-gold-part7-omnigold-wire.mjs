#!/usr/bin/env node
/* HARDGATE — Part7 S39–S48 OMNIGOLD + SCALP/SWING mint wire (hg-v577) */
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

console.log('== Part7 engine live ==');
{
  ok(typeof W.hgGoldPart7Engine === 'function', 'hgGoldPart7Engine');
  ok(typeof W.hgGoldPart7ScalpModule === 'function', 'scalp module');
  ok(typeof W.hgGoldPart7RatioPair === 'function', 'ratio');
  ok(W.HG_GOLD_P7_SCALP_RR === 1.5, 'scalp RR');
}

console.log('\n== OMNIGOLD wiring ==');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgOgPart7Hits/.test(og), 'hgOgPart7Hits helper');
  ok(/hgOgPart7ByKind/.test(og), 'hgOgPart7ByKind for backtest');
  ok(/OG_MECHANICS[\s\S]*P7-SCALP/.test(og) && /P7-RATIO/.test(og),
    'OG_MECHANICS lists P7 live kinds');
  ok(/'P7-SCALP':\s*'FLOW'/.test(og), 'P7-SCALP family FLOW');
  ok(/'P7-RATIO':\s*'INTERMARKET'/.test(og), 'P7-RATIO family INTERMARKET');
  ok(/hgOgPart7ByKind\(rows,\s*'P7-SCALP'/.test(og), 'detect pushes Part7 ByKind');
  ok(/'P7-SCALP':\s*function/.test(og) && /'P7-RATIO':\s*function/.test(og), 'backtest map');
  ok(/k === 'P7-SCALP'/.test(og) && /return 'p7scalp'/.test(og), 'inst key p7scalp');
  ok(/k === 'P7-RATIO'/.test(og) && /return 'p7ratio'/.test(og), 'inst key p7ratio');
}

console.log('\n== SWING mint parity (confirmed-only ratio; no scalp module) ==');
{
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/p7ratio:\s*'S43/.test(gs), 'SW_NAME p7ratio');
  ok(/p7Live\s*=\s*\{[^}]*p7ratio/.test(gs), 'swing mints Part7 ratio');
  ok(!/p7Live\s*=\s*\{[^}]*p7scalp/.test(gs), 'swing does not mint p7scalp');
  ok(/p7hit\.grade !== 'confirmed'/.test(gs), 'SWING confirmed-only gate');
  ok(/stamps\.push\('PART7/.test(gs), 'PART7 stamp on mint');
  ok(/reads:\s*\{\s*long:/.test(gs), 'soft-mint includes reads');
}

console.log('\n== SCALP mint ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/__gsCand\(p7hit\.key/.test(gi), 'scalp mints Part7');
  ok(/p7Live\s*=\s*\{[^}]*p7scalp[^}]*p7ratio/.test(gi), 'scalp live keys scalp+ratio');
  ok(/p7hit\.grade !== 'forming' && p7hit\.grade !== 'confirmed'/.test(gi),
    'scalp allows forming+confirmed');
  ok(/unchecked:[\s\S]*S40 MCX gap/.test(gi) || /S40 MCX unread/.test(gi), 'S40 unchecked path');
  ok(/out\.part7 = hgGoldPart7Engine/.test(gi), 'forming stack stamps part7');
  ok(/hgGoldPart7Html\(stack\.part7\)/.test(gi), 'forming stack HTML');
}

console.log('\n== runtime detect smoke ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000);
  for (let i = 0; i < 80; i++){
    rows.push({ t: t0 + i * 900, o: 2300, h: 2310, l: 2290, c: 2300, v: 100 });
  }
  const eng = W.hgGoldPart7Engine(rows, { now: rows[rows.length - 1].t * 1000 });
  ok(eng && (eng.ok || eng.why), 'engine runs on flat tape');
  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  ok(typeof W.hgOgDetect === 'function', 'hgOgDetect loaded');
  const hits = W.hgOgDetect(rows) || [];
  const p7 = hits.filter(h => h && String(h.kind || '').indexOf('P7-') === 0);
  ok(p7.every(h => isFinite(h.level)), 'any Part7 hits carry finite level (' + p7.length + ')');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === HG_VER, 'build-stamp version (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw.js matches stamp');
  ok(/goldind\.js\?v=578/.test(html), 'index goldind ?v=');
  ok(/goldswing\.js\?v=578/.test(html), 'index goldswing ?v=');
  ok(/omnigold\.js\?v=578/.test(html), 'index omnigold ?v=');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
