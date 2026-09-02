#!/usr/bin/env node
/* HARDGATE — GOLD SCALP must populate demoted cards (not blank) under Asia + MTF bias.
   MTF bias / conflict demote so cards still paint (cannot lead). Part5–7 mint uses inp.
   Run: node tests/test-gold-scalp-populate.mjs */
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

console.log('== MTF bias demotes (does not hard-drop) on scalp ==');
{
  /* Build bearish H4+Daily stacks so scalpLongOk is false */
  function stackBear(n, mid){
    const rows = [];
    const t0 = Math.floor(Date.UTC(2024, 5, 1) / 1000);
    for (let i = 0; i < n; i++){
      const c = mid - i * 0.4; /* falling */
      rows.push({ t: t0 + i * 14400, o: c + 1, h: c + 2, l: c - 2, c: c, v: 100 });
    }
    return rows;
  }
  const rows4h = stackBear(80, 2400);
  const rows1d = stackBear(80, 2400);
  const mtf = W.hgGoldMtfMatrix({ rows4h, rows1d });
  ok(mtf.scalpLongOk === false, 'fixture: scalpLongOk false (got ' + mtf.scalpLongOk + ')');

  const cand = {
    dir: 'long', stratKey: 'vwap', entry: 2300, stop: 2280, t1: 2340,
    stamps: [], demoted: false, gateNotes: []
  };
  const asiaMs = Date.UTC(2024, 5, 3, 3, 0); /* 03:00 UTC Asia */
  const out = W.hgGoldInstFilter(cand, {
    rows: rows4h, rows4h, rows1d, nowMs: asiaMs, scalp: true, hardReject: false
  });
  ok(out && !out.dropped, 'MTF bias does not hard-drop (dropped=' + !!(out && out.dropped) + ' reason=' + (out && out.reason) + ')');
  ok(out && out.demoted, 'MTF bias demotes instead');
  ok(Array.isArray(out.stamps) && out.stamps.some(s => /MTF/i.test(s)),
    'MTF stamp present (' + ((out && out.stamps) || []).join(',') + ')');
  ok(out && (/MTF/i.test(out.reason || '') || (out.gateNotes || []).some(g => /MTF/i.test(g))),
    'MTF reason named for card/gates');
}

console.log('\n== Part5/6/7 SCALP mint uses inp (not undeclared opts) ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const p7 = gi.slice(gi.indexOf('PART7 S39'), gi.indexOf('PART7 S39') + 2500);
  ok(!/\(opts\s*&&\s*opts\.usdInr\)/.test(p7), 'Part7 mint does not reference undeclared opts.usdInr');
  ok(/inp\s*&&\s*inp\.usdInr|inp\.usdInr/.test(p7), 'Part7 mint reads inp.usdInr');
  const p5 = gi.slice(gi.indexOf('PART5 S19'), gi.indexOf('PART5 S19') + 1200);
  ok(!/\(opts\s*&&\s*opts\.physical\)/.test(p5), 'Part5 mint does not use undeclared opts');
  const p6 = gi.slice(gi.indexOf('PART6 S29'), gi.indexOf('PART6 S29') + 1500);
  ok(!/\(opts\s*&&\s*\(opts\.dxyRows/.test(p6), 'Part6 mint does not use undeclared opts');
}

console.log('\n== Asia demote path still hardReject:false ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const push = gi.slice(gi.indexOf('function push(c){'), gi.indexOf('function push(c){') + 900);
  ok(/hardReject:\s*false/.test(push), 'goldScalpSetups push keeps hardReject:false');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === 'hg-v574', 'build-stamp hg-v574 (got ' + (m && m[1]) + ')');
  ok(sw.indexOf("HG_CACHE = 'hg-v574'") >= 0, 'sw.js matches');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
