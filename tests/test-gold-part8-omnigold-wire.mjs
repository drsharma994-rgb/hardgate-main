#!/usr/bin/env node
/* HARDGATE — Part8 S49–S58 OMNIGOLD + SCALP/SWING mint wire (hg-v575) */
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

console.log('== Part8 engine live ==');
{
  ok(typeof W.hgGoldPart8Engine === 'function', 'hgGoldPart8Engine');
  ok(typeof W.hgGoldBvcCvd === 'function', 'BVC CVD');
  ok(typeof W.hgGoldVpin === 'function', 'VPIN');
  ok(W.HG_GOLD_P8_VPIN_VETO === 97, 'VPIN veto');
}

console.log('\n== OMNIGOLD wiring ==');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgOgPart8Hits/.test(og), 'hgOgPart8Hits helper');
  ok(/hgOgPart8ByKind/.test(og), 'hgOgPart8ByKind for backtest');
  ok(/OG_MECHANICS[\s\S]*P8-RESID/.test(og) && /P8-RANGE/.test(og) && /P8-GEO/.test(og) && /P8-VPINBO/.test(og),
    'OG_MECHANICS lists P8 live kinds');
  ok(/'P8-RESID':\s*'MACRO'/.test(og), 'P8-RESID family MACRO');
  ok(/'P8-RANGE':\s*'SWEEP'/.test(og), 'P8-RANGE family SWEEP');
  ok(/'P8-GEO':\s*'SWEEP'/.test(og), 'P8-GEO family SWEEP');
  ok(/'P8-VPINBO':\s*'TREND'/.test(og), 'P8-VPINBO family TREND');
  ok(/hgOgPart8ByKind\(rows,\s*'P8-RESID'/.test(og), 'detect pushes Part8');
  ok(/'P8-RESID':\s*function/.test(og) && /'P8-VPINBO':\s*function/.test(og), 'backtest map');
  ok(/k === 'P8-RESID'/.test(og) && /return 'p8resid'/.test(og), 'inst key p8resid');
  ok(/k === 'P8-RANGE'/.test(og) && /return 'p8range'/.test(og), 'inst key p8range');
}

console.log('\n== SWING mint parity ==');
{
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/p8resid:\s*'S51/.test(gs), 'SW_NAME p8resid');
  ok(/p8range:\s*'S52/.test(gs), 'SW_NAME p8range');
  ok(/p8Live\s*=\s*\{[^}]*p8resid/.test(gs), 'swing mints Part8 live keys');
  ok(/PART8/.test(gs), 'PART8 stamp on mint');
}

console.log('\n== SCALP mint ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/__gsCand\(p8hit\.key/.test(gi), 'scalp mints Part8');
  ok(/p8Live\s*=\s*\{[^}]*p8resid[^}]*p8range/.test(gi), 'scalp live keys');
  ok(/hgGoldPart8ApplyVpinFilter/.test(gi), 'S50 filter wired');
  ok(/hgGoldPart8ApplyBvcBoost/.test(gi), 'S49 boost wired');
  ok(/out\.part8 = hgGoldPart8Engine/.test(gi), 'forming stack stamps part8');
  ok(/hgGoldPart8Html\(stack\.part8\)/.test(gi), 'forming stack HTML');
}

console.log('\n== runtime detect smoke ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000);
  for (let i = 0; i < 100; i++){
    rows.push({ t: t0 + i * 900, o: 2300 + i * 0.1, h: 2310, l: 2290, c: 2300 + i * 0.1, v: 100 + i });
  }
  const eng = W.hgGoldPart8Engine(rows, { now: rows[rows.length - 1].t * 1000 });
  ok(eng && (eng.ok || eng.why), 'engine runs on tape');
  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  ok(typeof W.hgOgDetect === 'function', 'hgOgDetect loaded');
  const hits = W.hgOgDetect(rows) || [];
  const p8 = hits.filter(h => h && String(h.kind || '').indexOf('P8-') === 0);
  ok(p8.every(h => isFinite(h.level)), 'any Part8 hits carry finite level (' + p8.length + ')');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === 'hg-v575', 'build-stamp version (got ' + (m && m[1]) + ')');
  ok(sw.indexOf("HG_CACHE = 'hg-v575'") >= 0, 'sw.js matches stamp');
  ok(/goldind\.js\?v=575/.test(html), 'index goldind ?v=');
  ok(/goldswing\.js\?v=575/.test(html), 'index goldswing ?v=');
  ok(/omnigold\.js\?v=575/.test(html), 'index omnigold ?v=');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
