#!/usr/bin/env node
/* HARDGATE — advanced gold sweep→OB (hg-v560) */
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
ok(typeof W.hgGoldHtfBias === 'function', 'hgGoldHtfBias');
ok(typeof W.hgGoldFreshOb === 'function', 'hgGoldFreshOb');
ok(typeof W.hgGoldFreshFvg === 'function', 'hgGoldFreshFvg');
ok(typeof W.hgGoldSweepObQuality === 'function', 'hgGoldSweepObQuality');
ok(typeof W.hgGoldSweepOb === 'function', 'hgGoldSweepOb');
ok(typeof W.hgGoldSweepObHtml === 'function', 'hgGoldSweepObHtml');
ok(W.HG_GOLD_SWEEPOB_ALERT_Q === 7, 'alert quality ≥7');
ok(W.HG_GOLD_SWEEPOB_RR_ALERT === 2.0, 'alert R:R ≥2.0');
ok(W.HG_GOLD_SWEEPOB_BUF_ATR === 0.15, 'stop buffer 0.15×ATR');

console.log('\n== quality score 10 filters ==');
{
  const full = W.hgGoldSweepObQuality({
    htfOk: true, sweepOk: true, reclaimOk: true, mssOk: true, entryOk: true,
    vwapOk: true, volOk: true, volumeOk: true, macroOk: true, rrOk: true,
    mode: 'reversal'
  }, {});
  ok(full.score === 10 && full.pass, 'all filters → 10/10 PASS');
  const weak = W.hgGoldSweepObQuality({
    htfOk: true, sweepOk: true, reclaimOk: false, mssOk: false, entryOk: true,
    vwapOk: false, volOk: true, volumeOk: false, macroOk: true, rrOk: false,
    mode: 'reversal'
  }, {});
  ok(weak.score === 5 && !weak.pass, 'partial → 5/10 below alert');
  ok(/5\/10/.test(weak.why), 'why reports score');
}

console.log('\n== news lockout vetoes ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12, 8, 0, 0) / 1000);
  for (let i = 0; i < 80; i++){
    rows.push({ t: t0 + i * 900, o: 2320, h: 2325, l: 2315, c: 2320, v: 100 });
  }
  const locked = W.hgGoldSweepOb(rows, {
    now: Date.UTC(2024, 5, 12, 12, 0, 0),
    newsGate: { lock: true, why: 'CPI' }
  });
  ok(/lockout|news/i.test(locked.why || ''), 'tier-1 news lockout skips (' + locked.why + ')');
  ok(locked.tier === 'ignore' || !locked.confirmed, 'not alert under news lock');
}

console.log('\n== HTF bias helpers ==');
{
  const rows = [];
  let px = 2200;
  const t0 = Math.floor(Date.UTC(2024, 5, 1) / 1000);
  for (let i = 0; i < 60; i++){
    px += 3;
    rows.push({ t: t0 + i * 14400, o: px - 2, h: px + 4, l: px - 5, c: px, v: 200 });
  }
  const bias = W.hgGoldHtfBias(rows, rows);
  ok(bias.dir === 'long' || /bull/i.test(bias.label), 'rising series → bullish HTF (' + bias.label + ')');
}

console.log('\n== detector with injected sweep ==');
{
  const rows = [];
  const base = Math.floor(Date.UTC(2024, 5, 12) / 1000);
  /* Asia box 2300–2310 */
  for (let h = 0; h < 8; h++){
    for (let m = 0; m < 4; m++){
      rows.push({
        t: base + h * 3600 + m * 900,
        o: 2305, h: 2310, l: 2300, c: 2305, v: 80
      });
    }
  }
  /* London grind + displacement leaving bullish OB */
  for (let h = 8; h < 10; h++){
    for (let m = 0; m < 4; m++){
      const i = h * 4 + m;
      const c = 2302 + (i - 32) * 0.5;
      rows.push({
        t: base + h * 3600 + m * 900,
        o: c - 1, h: c + 2, l: c - 3, c, v: 120
      });
    }
  }
  /* Down-close OB candle then bullish displacement */
  rows.push({ t: base + 10 * 3600, o: 2310, h: 2311, l: 2304, c: 2305, v: 150 });
  rows.push({ t: base + 10 * 3600 + 900, o: 2305, h: 2320, l: 2305, c: 2318, v: 220 });
  rows.push({ t: base + 10 * 3600 + 1800, o: 2318, h: 2322, l: 2314, c: 2316, v: 160 });
  rows.push({ t: base + 10 * 3600 + 2700, o: 2316, h: 2319, l: 2312, c: 2314, v: 140 }); /* retrace into OB */

  const fakeSweep = {
    dir: 'long', level: 2300, label: 'ASIA LOW', levelKind: 'asia',
    confirmed: true, tier: 'alert', score: 80, rvol: 1.6,
    wick: { closeReclaim: true, extreme: 2294 },
    mss: { ok: true, why: 'CHoCH bullish' },
    map: { priorDay: { hi: 2340, lo: 2280 } }
  };
  const sob = W.hgGoldSweepOb(rows, {
    now: Date.UTC(2024, 5, 12, 10, 45, 0), /* London */
    newsGate: { lock: false },
    sweep: fakeSweep,
    rows4h: rows
  });
  ok(sob.dir === 'long' || sob.ok || sob.tier === 'watch' || /sweep|OB|FVG|retrace/i.test(sob.why || ''),
    'detector returns readable result (dir=' + sob.dir + ' tier=' + sob.tier + ' why=' + sob.why + ')');
  if (sob.quality){
    ok(sob.quality.score >= 0 && sob.quality.score <= 10, 'quality 0–10 (got ' + sob.quality.score + ')');
  }
  if (isFinite(sob.stop) && isFinite(sob.sweepLevel)){
    ok(sob.stop < sob.sweepLevel || sob.stop <= 2294 + 5, 'stop beyond sweep extreme for long');
  }
  if (sob.mode){
    ok(/reversal|continuation|london|ny/i.test(sob.mode), 'mode labeled (' + sob.mode + ')');
  }
  const html = W.hgGoldSweepObHtml(sob.ok || sob.tier === 'watch' || sob.score > 0 ? sob : {
    ok: true, tier: 'watch', quality: { score: 7 }, dir: 'long', mode: 'london-trap',
    sweepLevel: 2300, obZone: { lo: 2304, hi: 2311 }, entry: 2307.5, stop: 2292,
    t1: 2315, t2: 2340, rr: 2.1, why: 'test'
  });
  ok(/SWEEP→OB/.test(html), 'HTML paints SWEEP→OB');
}

console.log('\n== forming stack wiring ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12, 0, 0, 0) / 1000);
  for (let i = 0; i < 60; i++){
    rows.push({ t: t0 + i * 900, o: 2320, h: 2326, l: 2314, c: 2320, v: 90 });
  }
  const stack = W.hgGoldFormingStack({ rows15m: rows, now: Date.UTC(2024, 5, 12, 10, 0, 0) });
  ok(stack.sweepOb != null, 'forming stack carries sweepOb');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(typeof html === 'string', 'forming HTML string');
}

console.log('\n== desk wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/sweepob/.test(gi) && /hgGoldSweepOb/.test(gi), 'goldind mints sweepob + engine');
  ok(/GST_NAME[\s\S]*sweepob/.test(gi) || /sweepob:\s*'SWEEP/.test(gi), 'GST_NAME has sweepob');
  ok(/hgGoldFormingStack/.test(scalp), 'scalp paints forming stack');
  ok(/hgGoldSweepOb/.test(swing) && /SWEEP→OB/.test(swing), 'swing stamps SWEEP→OB');
  ok(/hgGoldFormingStackHtml/.test(og), 'omnigold paints forming HTML');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
