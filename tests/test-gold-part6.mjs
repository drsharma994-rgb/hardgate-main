#!/usr/bin/env node
/* HARDGATE — Gold Part6 S29–S38 engine (hg-v570) */
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

console.log('== exports ==');
ok(typeof W.hgGoldPart6Engine === 'function', 'engine');
ok(typeof W.hgGoldPart6TimeStats === 'function', 'time stats');
ok(typeof W.hgGoldPart6ZScore === 'function', 'z-score');
ok(typeof W.hgGoldPart6Hurst === 'function', 'Hurst');
ok(typeof W.hgGoldPart6FailedSweep === 'function', 'failed-sweep');
ok(typeof W.hgGoldPart6ApplyEventFilter === 'function', 'event filter');
ok(W.HG_GOLD_P6_Z_GATE === 2.0, 'z gate 2.0');

function flatDays(days, lo, hi, mid, stepH){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 1) / 1000);
  stepH = stepH || 1;
  for (let d = 0; d < days; d++){
    for (let h = 0; h < 24; h += stepH){
      const i = d * 24 + h;
      rows.push({ t: t0 + i * 3600, o: mid, h: hi, l: lo, c: mid, v: 100 });
    }
  }
  return rows;
}

console.log('\n== time stats + z + hurst ==');
{
  const rows = flatDays(40, 2290, 2310, 2300);
  /* Bias highs into NY hours + give each day a distinct close for z/Hurst */
  for (let d = 0; d < 35; d++){
    const base = d * 24;
    const drift = d * 1.5;
    rows[base + 13].h = 2320 + drift; rows[base + 13].c = 2315 + drift;
    rows[base + 8].l = 2280; rows[base + 8].c = 2285;
    /* last bar of day = daily close */
    rows[base + 23].c = 2300 + drift;
    rows[base + 23].o = 2300 + drift - 1;
    rows[base + 23].h = 2310 + drift;
    rows[base + 23].l = 2290 + drift;
  }
  const ts = W.hgGoldPart6TimeStats(rows);
  ok(ts.ok && isFinite(ts.nyHighShare), 'time stats ok (ny=' + ts.nyHighShare + ')');
  const z = W.hgGoldPart6ZScore(rows);
  ok(z.ok && isFinite(z.z), 'z-score (' + z.z + ')');
  const h = W.hgGoldPart6Hurst(rows);
  ok(h.ok && isFinite(h.H), 'Hurst (' + h.H + ' ' + h.regime + ')');
}

console.log('\n== S37 failed-sweep fixture ==');
{
  const rows = flatDays(6, 2290, 2310, 2300);
  /* Asia low ~2290 — make a reclaim then fail */
  const n = rows.length;
  /* mark asia by ensuring early-day lows */
  rows[n - 6] = { t: rows[n - 6].t, o: 2295, h: 2300, l: 2280, c: 2296, v: 150 }; /* reclaim */
  rows[n - 1] = { t: rows[n - 1].t, o: 2290, h: 2292, l: 2275, c: 2278, v: 120 }; /* fail below wick */
  const f = W.hgGoldPart6FailedSweep(rows);
  ok(f && (f.ok || /reclaim|RR|Asia/i.test(f.why || '')), 'failed-sweep responds (' + (f && f.why) + ')');
}

console.log('\n== engine frames + unchecked ==');
{
  const rows = flatDays(25, 2290, 2310, 2300);
  const eng = W.hgGoldPart6Engine(rows, {});
  ok(Array.isArray(eng.unchecked) && eng.unchecked.some(u => /S31|skew/i.test(u)), 'S31 unchecked');
  ok(Array.isArray(eng.unchecked) && eng.unchecked.some(u => /S34|DOM/i.test(u)), 'S34 unchecked');
  const frames = (eng.strategies || []).filter(s => s.grade === 'frame');
  ok(frames.some(s => s.key === 'p6hold' || s.key === 'p6corr' || s.key === 'p6event' || s.key === 'p6ladder'),
    'management/scheduler frames present');
  ok(!(eng.strategies || []).some(s => (s.key === 'p6hold' || s.key === 'p6corr') && s.dir),
    'frames never invent dir tickets');
  const html = W.hgGoldPart6Html(eng);
  ok(typeof html === 'string' && /Part6|PART6/i.test(html), 'html renders');
  const locked = W.hgGoldPart6Engine(rows, { newsGate: { lock: true } });
  ok(/lockout/i.test(locked.why || ''), 'news lockout pauses Part6');
}

console.log('\n== S35 event filter demote ==');
{
  const cand = { dir: 'long', stamps: [], demoted: false };
  const tpl = W.hgGoldPart6EventTemplate({ events: { kind: 'FOMC', day: 'WED' } });
  ok(tpl.ok && tpl.disabled && tpl.disabled.allNew, 'FOMC Wed disables new');
  W.hgGoldPart6ApplyEventFilter(cand, tpl);
  ok(cand.demoted && cand.stamps.some(s => /S35/.test(s)), 'event filter demotes');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
