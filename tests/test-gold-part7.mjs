#!/usr/bin/env node
/* HARDGATE — Gold Part7 S39–S48 engine (hg-v571) */
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
ok(typeof W.hgGoldPart7Engine === 'function', 'engine');
ok(typeof W.hgGoldPart7ScalpModule === 'function', 'scalp module');
ok(typeof W.hgGoldPart7RatioPair === 'function', 'ratio pair');
ok(typeof W.hgGoldPart7McxParity === 'function', 'MCX parity');
ok(typeof W.hgGoldPart7Seasonal === 'function', 'seasonal');
ok(W.HG_GOLD_P7_SCALP_RR === 1.5, 'scalp RR 1.5');
ok(W.HG_GOLD_P7_GAP_PCT === 0.004, 'gap pct 0.4%');

function bars(n, mid, stepSec, t0){
  const rows = [];
  stepSec = stepSec || 900;
  t0 = t0 || Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000); /* 12:00 UTC — in scalp window */
  for (let i = 0; i < n; i++){
    rows.push({ t: t0 + i * stepSec, o: mid, h: mid + 5, l: mid - 5, c: mid, v: 100 });
  }
  return rows;
}

console.log('\n== MCX parity + expression frames ==');
{
  const p = W.hgGoldPart7McxParity(2300, 83.5, 1.02);
  ok(p.ok && isFinite(p.theoretical), 'parity theoretical (' + p.theoretical + ')');
  const mcx = W.hgGoldPart7McxExpress({ entry: 2300, stop: 2290, t1: 2320 }, { usdInr: 83.5, kToday: 1.02 });
  ok(mcx.ok && isFinite(mcx.entry) && mcx.sizeMult === 0.8, 'S39 GOLDM expression');
  const blocked = W.hgGoldPart7McxExpress({ entry: 2300 }, { usdInr: 83.5, usdinrAgainst: true });
  ok(!blocked.ok, 'S39 blocked when USDINR against');
}

console.log('\n== S47 hedge + expression apply ==');
{
  const idle = W.hgGoldPart7UsdinrHedge({ holdDays: 1, goldDir: 'long', usdinrAgainst: true });
  ok(/≥2|idle/i.test(idle.why || ''), 'S47 idle under 2d');
  const hedge = W.hgGoldPart7UsdinrHedge({
    holdDays: 3, goldDir: 'long', usdinrAgainst: true, accountInr: true
  });
  ok(hedge.ok && hedge.hedge && /S47/.test(hedge.why), 'S47 hedge fires for multi-day');
  ok(W.hgGoldPart7UsdinrAgainst('long', { trend20: 'FALLING' }) === true, 'USDINR FALLING against long');
  ok(W.hgGoldPart7UsdinrAgainst('long', { trend20: 'RISING' }) === false, 'USDINR RISING not against long');
  const feeds = W.hgGoldPart7ResolveFeeds({ usdInr: 83.2, usdInrTrend: 'FALLING' });
  ok(feeds.usdInr === 83.2, 'resolve feeds usdInr');
  const eng = W.hgGoldPart7Engine(bars(80, 2300), {
    now: Date.now(), usdInr: 83.5, kToday: 1.01, accountInr: true, mcxOpen: true
  });
  const cand = { dir: 'long', stamps: [], notes: [], demoted: false };
  W.hgGoldPart7ApplyExpression(cand, eng);
  ok(cand.stamps.some(s => /TREE|S39|S46|S44/i.test(s)), 'expression stamps applied (' + cand.stamps.join(',') + ')');
  ok(cand.dir === 'long', 'expression never flips dir');
  ok(!cand.demoted, 'expression does not demote by itself');
  const engH = W.hgGoldPart7Engine(bars(80, 2300), {
    now: Date.now(), holdDays: 3, goldDir: 'long', usdinrAgainst: true, usdInr: 83
  });
  ok((engH.strategies || []).some(s => s.key === 'p7hedge'), 'engine pushes p7hedge frame');
  ok(!(engH.strategies || []).some(s => s.grade === 'frame' && s.dir), 'frames still never invent dir');
}

console.log('\n== sizing / exit / seasonal ==');
{
  const sz = W.hgGoldPart7Sizing({ equity: 10000, R: 10, daily1s: 8, pointValue: 1 });
  ok(sz.ok && sz.pick > 0, 'sizing pick ' + sz.pick);
  const ex = W.hgGoldPart7ExitAb({ t1: 2310 });
  ok(ex.live === 'E2' && ex.shadows.indexOf('E1') >= 0, 'exit A/B shadows');
  const sea = W.hgGoldPart7Seasonal(Date.UTC(2024, 9, 15)); /* Oct */
  ok(sea.ok && sea.active, 'S48 active in Oct');
  const off = W.hgGoldPart7Seasonal(Date.UTC(2024, 4, 15)); /* May */
  ok(off.ok && !off.active, 'S48 inactive in May');
}

console.log('\n== engine frames + unchecked ==');
{
  const rows = bars(80, 2300);
  const eng = W.hgGoldPart7Engine(rows, { now: rows[rows.length - 1].t * 1000 });
  ok(Array.isArray(eng.unchecked) && eng.unchecked.some(u => /S40|MCX/i.test(u)), 'S40 unchecked without mcx');
  ok(eng.unchecked.some(u => /S43|silver/i.test(u)), 'S43 unchecked without silver');
  const frames = (eng.strategies || []).filter(s => s.grade === 'frame');
  ok(frames.some(s => s.key === 'p7size' || s.key === 'p7exit' || s.key === 'p7season' || s.key === 'p7opt'),
    'management frames present');
  ok(!(eng.strategies || []).some(s => s.grade === 'frame' && s.dir),
    'frames never invent dir tickets');
  const html = W.hgGoldPart7Html(eng);
  ok(typeof html === 'string' && /Part7|PART7/i.test(html), 'html renders');
  const locked = W.hgGoldPart7Engine(rows, { newsGate: { lock: true } });
  ok(/lockout/i.test(locked.why || ''), 'news lockout pauses Part7');
}

console.log('\n== S40 gap + S43 ratio fixtures ==');
{
  const mcx = bars(40, 70000, 3600);
  const n = mcx.length;
  mcx[n - 2].c = 70000;
  mcx[n - 1] = { t: mcx[n - 1].t, o: 71000, h: 71100, l: 70500, c: 70600, v: 200 }; /* −gap fade long forming */
  const gap = W.hgGoldPart7McxGapFade(mcx, {});
  ok(gap && (gap.ok || /gap|MCX|RR/i.test(gap.why || '')), 'gap fade responds (' + (gap && gap.why) + ')');

  const gold = [], silver = [];
  const t0 = Math.floor(Date.UTC(2023, 0, 1) / 1000);
  for (let d = 0; d < 80; d++){
    const g = 2000 + d * 0.5;
    const s = 25 + (d < 75 ? d * 0.02 : 0.1); /* push ratio extreme at end */
    gold.push({ t: t0 + d * 86400, o: g, h: g + 2, l: g - 2, c: g, v: 100 });
    silver.push({ t: t0 + d * 86400, o: s, h: s + 0.2, l: s - 0.2, c: s, v: 100 });
  }
  /* last day: gold high vs silver low → high ratio */
  gold[79].c = 2400; silver[79].c = 20;
  const ratio = W.hgGoldPart7RatioPair(gold, silver);
  ok(ratio.ok && ratio.dir === 'short' && isFinite(ratio.entry) && ratio.entry > 2000,
    'ratio short gold at extreme (entry=' + (ratio && ratio.entry) + ' why=' + (ratio && ratio.why) + ')');
  ok(ratio.grade === 'confirmed', 'ratio grade confirmed at p95');
  ok(isFinite(ratio.ratio) && ratio.ratio > 50, 'advisory ratio extreme (' + (ratio && ratio.ratio) + ')');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
