#!/usr/bin/env node
/* HARDGATE — Part9 S59–S66 OMNIGOLD + SCALP/SWING mint wire (hg-v577) */
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

console.log('== Part9 engine live ==');
{
  ok(typeof W.hgGoldPart9Engine === 'function', 'hgGoldPart9Engine');
  ok(typeof W.hgGoldSprt === 'function', 'SPRT');
  ok(typeof W.hgGoldFundingWindow === 'function', 'funding');
  ok(W.HG_GOLD_P9_SPRT_A === 2.77, 'SPRT A');
}

console.log('\n== OMNIGOLD wiring ==');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgOgPart9Hits/.test(og), 'hgOgPart9Hits helper');
  ok(/hgOgPart9ByKind/.test(og), 'hgOgPart9ByKind for backtest');
  ok(/OG_MECHANICS[\s\S]*P9-VOLBAR/.test(og) && /P9-PREM/.test(og),
    'OG_MECHANICS lists P9 live kinds');
  ok(/'P9-VOLBAR':\s*'SWEEP'/.test(og), 'P9-VOLBAR family SWEEP');
  ok(/'P9-PREM':\s*'REVERSION'/.test(og), 'P9-PREM family REVERSION');
  ok(/hgOgPart9ByKind\(rows,\s*'P9-VOLBAR'/.test(og), 'detect pushes Part9');
  ok(/'P9-VOLBAR':\s*function/.test(og) && /'P9-PREM':\s*function/.test(og), 'backtest map');
  ok(/k === 'P9-VOLBAR'/.test(og) && /return 'p9volbar'/.test(og), 'inst key p9volbar');
  ok(/k === 'P9-PREM'/.test(og) && /return 'p9prem'/.test(og), 'inst key p9prem');
}

console.log('\n== SWING mint parity ==');
{
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/p9volbar:\s*'S62/.test(gs), 'SW_NAME p9volbar');
  ok(/p9prem:\s*'S65/.test(gs), 'SW_NAME p9prem');
  ok(/p9Live\s*=\s*\{[^}]*p9volbar/.test(gs), 'swing mints Part9 live keys');
  ok(/PART9/.test(gs), 'PART9 stamp on mint');
}

console.log('\n== SCALP mint ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/__gsCand\(p9hit\.key/.test(gi), 'scalp mints Part9');
  ok(/p9Live\s*=\s*\{[^}]*p9volbar[^}]*p9prem/.test(gi), 'scalp live keys');
  ok(/hgGoldPart9ApplyTraderState/.test(gi), 'S59 filter wired');
  ok(/hgGoldPart9ApplySprt/.test(gi), 'S60 filter wired');
  ok(/hgGoldPart9ApplyFundingWindow/.test(gi), 'S63 filter wired');
  ok(/out\.part9 = hgGoldPart9Engine/.test(gi), 'forming stack stamps part9');
  ok(/hgGoldPart9Html\(stack\.part9\)/.test(gi), 'forming stack HTML');
}

console.log('\n== runtime detect smoke ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000);
  for (let i = 0; i < 100; i++){
    rows.push({ t: t0 + i * 900, o: 2300 + i * 0.1, h: 2310, l: 2290, c: 2300 + i * 0.1, v: 100 + i });
  }
  const eng = W.hgGoldPart9Engine(rows, { now: rows[rows.length - 1].t * 1000 });
  ok(eng && (eng.ok || eng.why), 'engine runs on tape');
  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  ok(typeof W.hgOgDetect === 'function', 'hgOgDetect loaded');
  const hits = W.hgOgDetect(rows) || [];
  const p9 = hits.filter(h => h && String(h.kind || '').indexOf('P9-') === 0);
  ok(p9.every(h => isFinite(h.level)), 'any Part9 hits carry finite level (' + p9.length + ')');
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
