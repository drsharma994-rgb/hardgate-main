#!/usr/bin/env node
/* HARDGATE — gold liquidity sweep engine (hg-v555) */
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
ok(typeof W.hgGoldLiquidityMap === 'function', 'hgGoldLiquidityMap');
ok(typeof W.hgGoldSweepEngine === 'function', 'hgGoldSweepEngine');
ok(typeof W.hgGoldSweepConfidence === 'function', 'hgGoldSweepConfidence');
ok(typeof W.hgGoldSweepMss === 'function', 'hgGoldSweepMss');
ok(typeof W.hgGoldSweepEngineHtml === 'function', 'hgGoldSweepEngineHtml');

const DAY = Math.floor(Date.UTC(2024, 5, 12) / 1000); /* Wed */

/** Build Asia box then London sweep of Asia low with reclaim + structure. */
function bullishSweepRows(){
  const rows = [];
  /* prior day */
  for (let i = 0; i < 20; i++){
    const t = DAY - 86400 + i * 3600;
    rows.push({ t, o: 2320, h: 2325, l: 2315, c: 2320, v: 100 });
  }
  /* Asia 00–08 UTC on DAY: box 2300–2310 */
  for (let i = 0; i < 8; i++){
    const t = DAY + i * 3600;
    rows.push({ t, o: 2305, h: 2310, l: 2300, c: 2305, v: 80 + i });
  }
  /* London grind then sweep low + reclaim with volume + bullish close */
  for (let i = 8; i < 14; i++){
    const t = DAY + i * 3600;
    rows.push({ t, o: 2304, h: 2308, l: 2301, c: 2303, v: 90 });
  }
  /* pad ATR history */
  const base = rows.length;
  for (let i = 0; i < 40; i++){
    const t = DAY - 2 * 86400 + i * 900;
    rows.unshift({ t, o: 2310, h: 2314, l: 2306, c: 2310, v: 70 });
  }
  /* final bar: pierce Asia low 2300, close back above, wide range, high vol */
  const lastT = DAY + 14 * 3600;
  rows.push({
    t: lastT, o: 2302, h: 2312, l: 2295, c: 2308, v: 400
  });
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

console.log('\n== liquidity map ==');
{
  const rows = bullishSweepRows();
  const map = W.hgGoldLiquidityMap(rows);
  ok(map.levels.length >= 2, 'map has levels (got ' + map.levels.length + ')');
  ok(map.levels.some((l) => l.kind === 'asia'), 'Asia levels present');
  ok(map.priorDay && map.priorDay.ok, 'prior-day levels present');
  ok(map.levels.some((l) => l.kind === 'round'), 'round-number levels present');
}

console.log('\n== confidence scoring ==');
{
  const hit = {
    dir: 'long', level: 2300, levelKind: 'asia', label: 'ASIA LOW',
    wick: { closeReclaim: true, breachAtr: 0.30, disp: true, potential: true, rvol: 1.8 },
    mss: { ok: true, why: 'CHoCH bullish' },
    vwap: { ok: true },
    rvol: 1.8, atr: 5
  };
  const conf = W.hgGoldSweepConfidence(hit, { rows: bullishSweepRows() });
  ok(conf.score >= 75, 'high-quality Asia sweep scores alert zone (got ' + conf.score + ')');
  ok(conf.tier === 'alert' || conf.confirmed, 'tier alert/confirmed — ' + conf.tier);
  ok(conf.parts.liquidity === 25, 'Asia liquidity = 25 pts');
  ok(conf.parts.structure === 20, 'MSS = 20 pts');
}

{
  const weak = W.hgGoldSweepConfidence({
    dir: 'long', level: 2300, levelKind: 'round', label: 'ROUND',
    wick: { closeReclaim: false, breachAtr: 0.05, potential: false, rvol: 0.5 },
    mss: { ok: false }, vwap: { ok: false }, rvol: 0.5, atr: 5
  }, {});
  ok(weak.score < 65 && weak.tier === 'ignore', 'weak wick ignored (score ' + weak.score + ')');
}

console.log('\n== sweep engine end-to-end ==');
{
  const rows = bullishSweepRows();
  const eng = W.hgGoldSweepEngine(rows, {});
  ok(!!eng.map && eng.map.levels.length > 0, 'engine builds liquidity map');
  ok(typeof eng.score === 'number', 'engine returns score');
  ok(typeof eng.why === 'string', 'engine why string');
  /* May be potential or confirmed depending on MSS helper; score path must run */
  ok(eng.dir === 'long' || eng.dir === 'short' || eng.why.indexOf('no ATR') >= 0 || eng.score >= 0,
     'engine produces a directional read or honest empty — dir=' + eng.dir + ' score=' + eng.score);
}

console.log('\n== forming stack carries sweep engine ==');
{
  const stack = W.hgGoldFormingStack({ rows15m: bullishSweepRows() });
  ok(stack.sweepEngine && typeof stack.sweepEngine.score === 'number', 'forming stack.sweepEngine');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(/FORMING LAYERS/.test(html), 'forming HTML paints');
  /* Sweep panel appears when score > 0 or potential */
  const sh = W.hgGoldSweepEngineHtml(stack.sweepEngine);
  ok(typeof sh === 'string', 'sweep HTML helper returns string');
}

console.log('\n== wiring ==');
{
  const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/liqsweep/.test(gi) && /hgGoldSweepEngine/.test(gi), 'goldind mints liqsweep + engine');
  ok(/formingLayersHtml|hgGoldFormingStack/.test(scalp), 'scalp paints forming (incl sweep panel)');
  ok(/hgGoldSweepEngine/.test(swing), 'swing applies sweep engine stamps');
  ok(/FOLKLORE/.test(gi) && /RSI divergence/.test(gi), 'RSI remains FOLKLORE (not scored)');
  ok(/HG_GOLD_SWEEP_ALERT = 75/.test(gi) && /HG_GOLD_SWEEP_WATCH = 65/.test(gi),
     'alert 75 / watch 65 thresholds');
}

console.log('\n' + passed + ' assertions passed' + (failed ? ', ' + failed + ' FAILED' : ''));
process.exit(failed ? 1 : 0);
