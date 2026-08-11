/* HARDGATE — gold-best-levels.js offline tests (phases 1–6). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function loadStack(){
  const files = [
    'indicators.js', 'indicators2.js', 'plans.js', 'structure-levels.js',
    'formation.js', 'freqtrade-formation.js', 'best-levels.js', 'gold-best-levels.js',
  ];
  for (const f of files){
    vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
  }
}

function trendRows(n, start, step, t0){
  const r = [];
  for (let i = 0; i < n; i++){
    const c = start + (i + 1) * step;
    const o = c - step;
    r.push({ t: t0 + i * 900, o, h: Math.max(o, c) + 1, l: Math.min(o, c) - 1, c, v: 1000 + i * 10 });
  }
  return r;
}

console.log('== gold best-levels module ==');
globalThis.window = {};
loadStack();
const W = globalThis.window;

ok(typeof W.hgBestLevelsGold === 'function', 'hgBestLevelsGold export');
ok(typeof W.hgApplyGoldBestLevels === 'function', 'hgApplyGoldBestLevels export');
ok(typeof W.hgGoldMtfGate === 'function', 'hgGoldMtfGate export');
ok(typeof W.hgGoldPoiQuality === 'function', 'hgGoldPoiQuality export');
ok(typeof W.hgGoldRegime === 'function', 'hgGoldRegime export');
ok(W.HG_GOLD_SCALP_MIN_RR === 1.2, 'scalp min R:R 1.2');

console.log('== phase 2 MTF ==');
{
  const rows4h = trendRows(220, 2000, 2, 1700000000);
  const mtf = W.hgGoldMtfGate('long', { style: 'gold-swing', rows4h, stratKey: 'pullback' });
  ok(mtf.ok === true, 'MTF long with uptrend 4H');
  const bear4h = trendRows(220, 2800, -3, 1700000000);
  const mtf2 = W.hgGoldMtfGate('long', { style: 'gold-swing', rows4h: bear4h, stratKey: 'pullback' });
  ok(mtf2.demote === true || mtf2.ok === false, 'MTF demote long vs bear 4H stack');
  const ex = W.hgGoldMtfGate('long', { style: 'gold-scalp', rows4h, stratKey: 'sweep', exemptMtf: true });
  ok(ex.exempt === true, 'sweep MTF exempt');
}

console.log('== phase 3 POI quality ==');
{
  const rows = trendRows(40, 2400, 1, 1700000000);
  const pq = W.hgGoldPoiQuality(rows, 'long', { stratKey: 'sweep' });
  ok(pq.score >= 50 && pq.score <= 100, 'POI quality score in range');
}

console.log('== phase 4 regime ==');
{
  const rows = trendRows(50, 2400, 3, 1700000000);
  const reg = W.hgGoldRegime(rows, 'gold-scalp');
  ok(reg.label && typeof reg.label === 'string', 'regime label');
  ok(W.hgGoldSessionBoost(Date.UTC(2024, 0, 15, 8, 30), 'ob') >= 6, 'Silver Bullet London boost');
}

console.log('== phase 1 apply on candidate ==');
{
  const rows = trendRows(50, 2400, 1, 1700000000);
  const a = (typeof atr === 'function') ? atr(rows, 14) : [];
  const atrW = a.length ? a[a.length - 1] : 5;
  const gc = {
    dir: 'long', stratKey: 'sweep', entry: rows[rows.length - 1].c,
    stop: rows[rows.length - 1].c - atrW * 1.5,
    t1: rows[rows.length - 1].c + atrW * 2,
    t2: rows[rows.length - 1].c + atrW * 3,
    anchor: rows[rows.length - 1].c - atrW,
    agree: 4, killzoneWeight: 2,
  };
  const out = W.hgApplyGoldBestLevels(gc, {
    style: 'gold-scalp', rows, rows15m: rows, rows4h: rows, rows1h: rows, atrW,
  });
  ok(out === gc, 'apply returns candidate');
  ok(isFinite(gc.entry) && isFinite(gc.stop) && isFinite(gc.t1), 'levels set after apply');
}

console.log('== wiring ==');
{
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const ix = fs.readFileSync(root + 'index.html', 'utf8');
  ok(/gold-best-levels\.js/.test(sw), 'sw shell gold-best-levels.js');
  ok(/gold-best-levels\.js/.test(ix), 'index loads gold-best-levels.js');
  ok(/hgApplyGoldBestLevels/.test(fs.readFileSync(root + 'goldscalp.js', 'utf8')), 'goldscalp uses hgApplyGoldBestLevels');
  ok(/hgApplyGoldBestLevels/.test(fs.readFileSync(root + 'goldswing.js', 'utf8')), 'goldswing uses hgApplyGoldBestLevels');
  ok(/hg-v244/.test(sw), 'cache hg-v244');
}

console.log('== gold card text contrast ==');
{
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const gw = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const bright = fs.readFileSync(root + 'bright.css', 'utf8');
  ok(/\.card\.gsx-card\{color:#F1F5F9/.test(gs), 'goldscalp card uses dark HUD text');
  ok(!/tab_goldscalp \.gsx-card/.test(gs), 'goldscalp styles unscoped (StarTrader embed)');
  ok(/\.card\.gsw-card\{color:#F1F5F9/.test(gw), 'goldswing card uses dark HUD text');
  ok(/gold setup cards — dark HUD panels/.test(bright), 'bright.css gold card contrast block');
}

console.log('\n' + pass + ' passed, 0 failed');
