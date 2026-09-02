#!/usr/bin/env node
/* HARDGATE — Gold Part5 S19–S28 engine (hg-v569) */
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
ok(typeof W.hgGoldPart5Engine === 'function', 'engine');
ok(typeof W.hgGoldPart5KerRegime === 'function', 'KER');
ok(typeof W.hgGoldPart5Wyckoff === 'function', 'Wyckoff');
ok(typeof W.hgGoldPart5TurtleSoup === 'function', 'turtle');
ok(typeof W.hgGoldPart5VwapFade === 'function', 'VWAP fade');
ok(typeof W.hgGoldPart5ThreeDrive === 'function', 'three-drive');
ok(typeof W.hgGoldPart5WeeklyBias === 'function', 'weekly bias');
ok(typeof W.hgGoldPart5ApplyRegimeFilter === 'function', 'regime filter');
ok(typeof W.hgGoldPart5ApplyWeeklyBiasFilter === 'function', 'bias filter');
ok(W.HG_GOLD_P5_KER_TREND === 0.60, 'KER trend 0.60');
ok(W.HG_GOLD_P5_KER_CHOP === 0.30, 'KER chop 0.30');

function flatDays(days, lo, hi, mid){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 1) / 1000);
  for (let d = 0; d < days; d++){
    for (let h = 0; h < 24; h++){
      const i = d * 24 + h;
      rows.push({ t: t0 + i * 3600, o: mid, h: hi, l: lo, c: mid, v: 100 });
    }
  }
  return rows;
}

console.log('\n== S23 KER regime ==');
{
  const chop = flatDays(4, 2290, 2310, 2300);
  const ker = W.hgGoldPart5KerRegime(chop);
  ok(ker.ok && ker.regime === 'CHOP', 'flat tape → CHOP (' + ker.regime + ' er=' + ker.er + ')');
  ok(ker.enabled && ker.enabled.p5vwap === 1, 'CHOP enables VWAP fade');
}

console.log('\n== S19 Wyckoff spring + test ==');
{
  const rows = flatDays(6, 2290, 2310, 2300);
  const n = rows.length;
  rows[n - 8] = { t: rows[n - 8].t, o: 2295, h: 2300, l: 2280, c: 2296, v: 200 };
  for (let k = n - 7; k <= n - 5; k++){
    rows[k] = { t: rows[k].t, o: 2298, h: 2305, l: 2292, c: 2300, v: 100 };
  }
  rows[n - 2] = { t: rows[n - 2].t, o: 2298, h: 2302, l: 2285, c: 2299, v: 80 };
  rows[n - 1] = { t: rows[n - 1].t, o: 2300, h: 2305, l: 2295, c: 2301, v: 90 };
  const w = W.hgGoldPart5Wyckoff(rows);
  ok(w.ok && w.dir === 'long', 'spring long (' + w.why + ')');
  ok(w.grade === 'confirmed', 'confirmed on recent test');
  ok(isFinite(w.entry) && isFinite(w.stop) && w.stop < w.entry, 'entry/stop long geometry');
  ok(w.testExt > w.springExt, 'test shallower than spring');
}

console.log('\n== S28 weekly bias ==');
{
  const empty = W.hgGoldPart5WeeklyBias({});
  ok(!empty.ok && /unread|4H bias/.test(empty.why || ''), 'no physical → unread');
  const full = W.hgGoldPart5WeeklyBias({
    physical: {
      shanghaiPremium5d: 1.2, shanghaiRising: true,
      indianPremium: true,
      comexRegisteredFalling: true, priceRising: true,
      officialBuying: true,
      fedwatchDeltaCuts: 1,
      cotMmPct: 5
    }
  });
  ok(full.ok && full.score >= 3 && full.permission === 'long-full',
    'bullish physical → long-full (score ' + full.score + ')');
  const cand = { dir: 'short', stamps: [], demoted: false };
  W.hgGoldPart5ApplyWeeklyBiasFilter(cand, full);
  ok(cand.demoted || (cand.stamps || []).some(s => /S28|HALF|LONG/.test(s)),
    'bias filter stamps/demotes counter-side (' + JSON.stringify(cand.stamps) + ')');
}

console.log('\n== engine + HTML + lockout ==');
{
  const rows = flatDays(5, 2290, 2310, 2300);
  const eng = W.hgGoldPart5Engine(rows, {});
  ok(Array.isArray(eng.unchecked) && eng.unchecked.some(u => /S21|GVZ|Shanghai/i.test(u)),
    'S21/physical unchecked listed');
  ok(eng.ker && eng.ker.ok, 'engine carries KER');
  const html = W.hgGoldPart5Html(eng);
  ok(typeof html === 'string' && /Part5|S23|KER/i.test(html), 'html renders');
  const locked = W.hgGoldPart5Engine(rows, { newsGate: { lock: true } });
  ok(/lockout/i.test(locked.why || ''), 'news lockout pauses Part5');
  ok(!(locked.strategies && locked.strategies.some(s => s.dir && s.grade === 'confirmed')),
    'lockout does not emit live dirs');
}

console.log('\n== sacred: filter cannot invent ENTER ==');
{
  const rows = flatDays(4, 2290, 2310, 2300);
  const eng = W.hgGoldPart5Engine(rows, {});
  const live = (eng.strategies || []).filter(s =>
    s && s.dir && (s.grade === 'forming' || s.grade === 'confirmed'));
  /* flat chop may fire VWAP fade — that is a detector, not a filter inventing ENTER */
  const frames = (eng.strategies || []).filter(s => s && s.grade === 'frame');
  ok(frames.some(s => s.key === 'p5ker'), 'S23 is frame not ticket');
  ok(frames.some(s => s.key === 'p5bias'), 'S28 is frame not ticket');
  ok(live.every(s => s.key !== 'p5ker' && s.key !== 'p5bias'),
    'KER/bias never carry dir tickets');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
