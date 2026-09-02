#!/usr/bin/env node
/* HARDGATE — Part6 S29–S38 OMNIGOLD + SCALP/SWING mint wire (hg-v577) */
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

console.log('== Part6 engine live ==');
{
  ok(typeof W.hgGoldPart6Engine === 'function', 'hgGoldPart6Engine');
  ok(typeof W.hgGoldPart6ApplyEventFilter === 'function', 'S35 filter');
  ok(typeof W.hgGoldPart6ApplyCorrFilter === 'function', 'S32 filter');
  ok(W.HG_GOLD_P6_Z_GATE === 2.0, 'z gate');
}

console.log('\n== OMNIGOLD wiring ==');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgOgPart6Hits/.test(og), 'hgOgPart6Hits helper');
  ok(/hgOgPart6ByKind/.test(og), 'hgOgPart6ByKind for backtest');
  ok(/OG_MECHANICS[\s\S]*P6-COMP/.test(og) && /P6-ZFADE/.test(og)
    && /P6-SMT/.test(og) && /P6-FAIL/.test(og),
    'OG_MECHANICS lists P6 live kinds');
  ok(/'P6-COMP':\s*'FLOW'/.test(og), 'P6-COMP family FLOW');
  ok(/'P6-ZFADE':\s*'REVERSION'/.test(og), 'P6-ZFADE family REVERSION');
  ok(/'P6-SMT':\s*'SWEEP'/.test(og), 'P6-SMT family SWEEP');
  ok(/'P6-FAIL':\s*'SWEEP'/.test(og), 'P6-FAIL family SWEEP');
  ok(/hgOgPart6ByKind\(rows,\s*'P6-COMP'/.test(og), 'detect pushes Part6 ByKind');
  ok(/'P6-COMP':\s*function/.test(og) && /'P6-FAIL':\s*function/.test(og), 'backtest map');
  ok(/k === 'P6-COMP'/.test(og) && /return 'p6comp'/.test(og), 'inst key p6comp');
  ok(/k === 'P6-ZFADE'/.test(og) && /return 'p6zfade'/.test(og), 'inst key p6zfade');
}

console.log('\n== SWING mint parity (confirmed-only) ==');
{
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/p6comp:\s*'S30/.test(gs), 'SW_NAME p6comp');
  ok(/p6zfade:\s*'S33/.test(gs), 'SW_NAME p6zfade');
  ok(/p6smt:\s*'S36/.test(gs), 'SW_NAME p6smt');
  ok(/p6fail:\s*'S37/.test(gs), 'SW_NAME p6fail');
  ok(/p6Live\s*=\s*\{[^}]*p6comp/.test(gs), 'swing mints Part6 live keys');
  ok(/p6hit\.grade !== 'confirmed'/.test(gs), 'SWING confirmed-only gate');
  ok(/stamps\.push\('PART6/.test(gs), 'PART6 stamp on mint');
  ok(/reads:\s*\{\s*long:/.test(gs), 'soft-mint includes reads');
}

console.log('\n== SCALP mint ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/__gsCand\(p6hit\.key/.test(gi), 'scalp mints Part6');
  ok(/p6hit\.grade !== 'forming' && p6hit\.grade !== 'confirmed'/.test(gi),
    'scalp allows forming+confirmed');
  ok(/unchecked:\s*\[[^\]]*S31 options skew/.test(gi)
    && /S34 DOM walls/.test(gi), 'S31/S34 unchecked');
}

console.log('\n== runtime detect smoke ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 1) / 1000);
  for (let d = 0; d < 25; d++){
    for (let h = 0; h < 24; h++){
      rows.push({ t: t0 + (d * 24 + h) * 3600, o: 2300, h: 2310, l: 2290, c: 2300, v: 100 });
    }
  }
  const eng = W.hgGoldPart6Engine(rows, {});
  ok(eng && (eng.ok || eng.why), 'engine runs on flat tape');
  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  ok(typeof W.hgOgDetect === 'function', 'hgOgDetect loaded');
  const hits = W.hgOgDetect(rows) || [];
  const p6 = hits.filter(h => h && String(h.kind || '').indexOf('P6-') === 0);
  ok(p6.every(h => isFinite(h.level)), 'any Part6 hits carry finite level (' + p6.length + ')');
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
