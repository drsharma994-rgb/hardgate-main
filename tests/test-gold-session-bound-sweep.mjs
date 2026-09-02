#!/usr/bin/env node
/* HARDGATE — session-bounded Silver Bullet twin (hg-v566) */
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
ok(typeof W.hgGoldSessionBoundSweep === 'function', 'hgGoldSessionBoundSweep');
ok(typeof W.hgGoldSessionBoundWindow === 'function', 'hgGoldSessionBoundWindow');
ok(typeof W.hgGoldPriorHourRange === 'function', 'hgGoldPriorHourRange');
ok(typeof W.hgGoldSessionBoundSweepHtml === 'function', 'hgGoldSessionBoundSweepHtml');
ok(W.HG_GOLD_SB_LON_START === 7, 'London start 07:00');
ok(W.HG_GOLD_SB_LON_END === 9.5, 'London end 09:30');
ok(W.HG_GOLD_SB_NY_START === 12, 'NY start 12:00');
ok(W.HG_GOLD_SB_NY_END === 13.5, 'NY end 13:30');
ok(/silverb/.test(fs.readFileSync(root + 'goldind.js', 'utf8')), 'silverb strat wired');

console.log('\n== session windows ==');
{
  const lon = W.hgGoldSessionBoundWindow(Date.UTC(2024, 5, 12, 8, 15, 0));
  ok(lon.inWindow && lon.name === 'LONDON_SB', '08:15 → LONDON_SB');
  const ny = W.hgGoldSessionBoundWindow(Date.UTC(2024, 5, 12, 12, 45, 0));
  ok(ny.inWindow && ny.name === 'NY_SB', '12:45 → NY_SB');
  const off = W.hgGoldSessionBoundWindow(Date.UTC(2024, 5, 12, 4, 0, 0));
  ok(!off.inWindow && !off.name, '04:00 outside windows');
  const late = W.hgGoldSessionBoundWindow(Date.UTC(2024, 5, 12, 10, 0, 0));
  ok(!late.inWindow, '10:00 past London SB window');
}

/** Synthetic Asia box + London sweep reclaim of Asia low. */
function makeAsiaLondonRows(){
  const rows = [];
  /* Build prior days for ATR warmth */
  const day0 = Math.floor(Date.UTC(2024, 5, 12, 0, 0, 0) / 1000);
  for (let d = 5; d >= 1; d--){
    for (let i = 0; i < 96; i++){
      const t = day0 - d * 86400 + i * 900;
      const c = 2305 + (i % 8);
      rows.push({ t, o: c, h: c + 1.5, l: c - 1.5, c, v: 80 + (i % 5) * 10 });
    }
  }
  /* Asia 00:00–08:00: tight 2300–2310 box */
  for (let i = 0; i < 32; i++){
    const t = day0 + i * 900; /* 15m */
    const c = 2304 + (i % 4);
    rows.push({ t, o: c, h: Math.min(2310, c + 1), l: Math.max(2300, c - 1), c, v: 60 });
  }
  /* 08:00–08:15: still inside */
  rows.push({
    t: day0 + 8 * 3600,
    o: 2304, h: 2306, l: 2302, c: 2304, v: 90
  });
  /* 08:15 London: wick below Asia low 2300, close reclaim */
  rows.push({
    t: day0 + 8 * 3600 + 900,
    o: 2303, h: 2305, l: 2294, c: 2303, v: 220
  });
  /* follow-through bars with a down-candle then impulse (OB seed) */
  rows.push({
    t: day0 + 8 * 3600 + 1800,
    o: 2303, h: 2304, l: 2298, c: 2299, v: 140
  });
  rows.push({
    t: day0 + 8 * 3600 + 2700,
    o: 2299, h: 2312, l: 2298, c: 2310, v: 260
  });
  return rows;
}

console.log('\n== Asia→London sweep detection ==');
{
  const rows = makeAsiaLondonRows();
  const now = Date.UTC(2024, 5, 12, 8, 45, 0);
  const asia = W.goldAsianRange(rows);
  ok(asia && isFinite(asia.lo) && isFinite(asia.hi) && asia.hi > asia.lo,
    'Asia box formed (' + (asia && asia.lo) + '–' + (asia && asia.hi) + ')');
  const sb = W.hgGoldSessionBoundSweep(rows, { now, asia });
  ok(sb.ok, 'detector ok');
  ok(sb.inWindow && sb.window === 'LONDON_SB', 'in London SB window');
  ok(sb.dir === 'long', 'dir long after Asia low sweep (got ' + sb.dir + ')');
  ok(sb.reclaimOk, 'close reclaim flagged');
  ok(isFinite(sb.sweepLevel) && Math.abs(sb.sweepLevel - asia.lo) < 0.01, 'sweepLevel = Asia low');
  ok(sb.tier === 'alert' || sb.tier === 'watch', 'tier alert|watch (got ' + sb.tier + ')');
  ok(/SILVER BULLET|Asia/i.test(sb.why || ''), 'why mentions silver bullet / Asia');
  const html = W.hgGoldSessionBoundSweepHtml(sb);
  ok(/SILVER BULLET/.test(html), 'HTML paints SILVER BULLET');
}

console.log('\n== outside window stays idle ==');
{
  const rows = makeAsiaLondonRows();
  const sb = W.hgGoldSessionBoundSweep(rows, {
    now: Date.UTC(2024, 5, 12, 4, 0, 0)
  });
  ok(!sb.inWindow, 'not in window at 04:00');
  ok(sb.tier === 'idle' || !sb.confirmed, 'idle / not confirmed outside window');
}

console.log('\n== news lockout ==');
{
  const rows = makeAsiaLondonRows();
  const sb = W.hgGoldSessionBoundSweep(rows, {
    now: Date.UTC(2024, 5, 12, 8, 45, 0),
    newsGate: { lock: true, why: 'CPI' }
  });
  ok(sb.tier === 'idle' || !sb.confirmed, 'news lock prevents alert');
  ok(/news|lock/i.test(sb.why || ''), 'why mentions lockout');
}

console.log('\n== forming stack carries sessionBound ==');
{
  const rows = makeAsiaLondonRows();
  const stack = W.hgGoldFormingStack({
    rows15m: rows, scalp: true,
    now: Date.UTC(2024, 5, 12, 8, 45, 0)
  });
  ok(stack.sessionBound && stack.sessionBound.ok, 'forming.sessionBound');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(/SILVER BULLET|FORMING LAYERS/.test(html), 'forming HTML includes SB or layers');
}

console.log('\n== desk wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/__gsCand\('silverb'/.test(gi), 'scalp mint silverb');
  ok(/SILVER BULLET/.test(gs), 'swing stamps SILVER BULLET');
  ok(/SESSION SILVER BULLET|hgGoldSessionBoundSweep/.test(gi), 'engine present');
  ok(/research\/vectorbt|vectorbt stays/i.test(
    fs.readFileSync(root + 'research/vectorbt-research-boundary.md', 'utf8')
  ) || fs.existsSync(root + 'research/vectorbt-research-boundary.md'),
    'vectorbt research boundary note exists');
}

console.log('\n== prior-hour helper ==');
{
  const rows = makeAsiaLondonRows();
  const ph = W.hgGoldPriorHourRange(rows, Date.UTC(2024, 5, 12, 8, 45, 0));
  ok(ph.ok || ph.why, 'priorHour returns shape (ok=' + !!ph.ok + ')');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
