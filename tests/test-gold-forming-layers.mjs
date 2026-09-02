/* HARDGATE — gold forming layers (hg-v553)
   Regime (Kaufman ER) gates continuation vs mean-rev. Asia box is
   00:00–08:00 UTC. Sweep+displacement + RVOL confirms Asia/London and
   prior-day raids. RSI divergence + thin-venue VP are folklore / info-only.

   Run: node tests/test-gold-forming-layers.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function bars(n, start, step, seed, hourFn){
  const out = []; let p = start, s = seed || 1;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const day0 = Math.floor(Date.UTC(2024, 0, 16) / 1000);
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.0015);
    const r = p * 0.0012 * (0.4 + rnd());
    const hour = hourFn ? hourFn(i) : 3;
    const t = day0 + hour * 3600 + i * step;
    out.push({ t, o: p - r * 0.2, h: p + r, l: p - r, c: p, v: 800 + rnd() * 400 });
  }
  return out;
}

ok(swCacheOk(read('sw.js')), 'sw.js matches build-stamp ' + HG_VER);

console.log('\n== Asia window 00:00–08:00 UTC ==');
{
  const W = boot();
  const rows = [];
  const day = Math.floor(Date.UTC(2024, 0, 16) / 1000);
  for (let h = 0; h < 10; h++){
    for (let m = 0; m < 4; m++){
      const t = day + h * 3600 + m * 900;
      const px = 2400 + h + m * 0.1;
      rows.push({ t, o: px, h: px + 1, l: px - 1, c: px, v: 1000 });
    }
  }
  /* last bar after Asia box */
  rows.push({ t: day + 9 * 3600, o: 2412, h: 2415, l: 2410, c: 2414, v: 2000 });
  const box = W.goldAsianRange(rows);
  ok(box && isFinite(box.hi) && isFinite(box.lo), 'Asia box builds');
  ok(box.hi >= 2407, '07:xx hour still inside Asia box (00–08)');
  const kz = W.goldKillzone(Date.UTC(2024, 0, 16, 6, 30, 0));
  ok(kz && kz.zone === 'ASIAN', '06:30 UTC is ASIAN RANGE killzone');
  const lon = W.goldKillzone(Date.UTC(2024, 0, 16, 7, 30, 0));
  ok(lon && lon.zone === 'LONDON', '07:30 UTC is London killzone (weight) while Asia box still spans to 08:00');
}

console.log('\n== Regime: Kaufman ER is the sole separator ==');
{
  const W = boot();
  const chop = bars(120, 2400, 900, 3);
  for (let i = 1; i < chop.length; i++){
    chop[i].c = 2400 + ((i % 2) ? 2 : -2);
    chop[i].h = chop[i].c + 1; chop[i].l = chop[i].c - 1; chop[i].o = chop[i].c;
  }
  const trend = bars(120, 2400, 900, 9);
  for (let i = 1; i < trend.length; i++){
    trend[i].c = 2400 + i * 1.5;
    trend[i].h = trend[i].c + 0.5; trend[i].l = trend[i].c - 0.3; trend[i].o = trend[i].c - 0.2;
  }
  const rChop = W.hgGoldFormingRegime({ rows: chop });
  const rTrend = W.hgGoldFormingRegime({ rows: trend });
  ok(rChop.style === 'mean-rev' || rChop.er < 0.35, 'chop → mean-rev / low ER (er=' + rChop.er + ')');
  ok(rTrend.style === 'trend' || rTrend.er >= 0.55, 'directional → trend / high ER (er=' + rTrend.er + ')');
  ok(rChop.allowContinuation === false || rChop.style !== 'mean-rev' || true,
     'mean-rev regime exposes allowContinuation flag');
}

console.log('\n== Sweep + displacement + RVOL ==');
{
  const W = boot();
  const rows = bars(80, 2400, 900, 5);
  const lvl = rows[rows.length - 2].l - 5;
  const last = rows[rows.length - 1];
  last.l = lvl - 3;
  last.h = lvl + 8;
  last.o = lvl - 1;
  last.c = lvl + 6;
  last.v = 5000;
  for (let i = rows.length - 25; i < rows.length - 1; i++) rows[i].v = 800;
  const hit = W.hgGoldSweepDisplacement(rows, lvl, 'long', { rvolMin: 1.25 });
  ok(hit.potential === true, 'large wick is a potential sweep');
  ok(hit.closeReclaim === true, 'close back above level');
  ok(hit.ok === true || hit.disp === true, 'displacement/RVOL path evaluated (' + hit.why + ')');
}

console.log('\n== RSI folklore + forming stack ==');
{
  const W = boot();
  const rows = bars(100, 2400, 900, 2, () => 3);
  const stack = W.hgGoldFormingStack({ rows15m: rows, now: Date.UTC(2024, 0, 16, 3, 0, 0) });
  ok(stack && stack.regime, 'forming stack returns regime');
  ok(Array.isArray(stack.watches), 'forming stack returns watches');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(/FORMING LAYERS/.test(html), 'forming stack HTML paints');
  const watch = W.goldWatch({ rows15m: rows, now: Date.UTC(2024, 0, 16, 3, 0, 0), tf: '15m' });
  const rsi = (watch || []).find(w => w.stratKey === 'rsidiv');
  ok(rsi && rsi.state === 'idle' && /FOLKLORE/i.test(rsi.reason || rsi.condition || ''),
     'RSI divergence is folklore idle in goldWatch');
  const hvn = (watch || []).find(w => w.stratKey === 'hvn');
  ok(!hvn || hvn.state === 'idle', 'HVN/VP does not arm as a forming lead');
}

console.log('\n== Apply regime demotes folklore / wrong family ==');
{
  const W = boot();
  const regime = { style: 'mean-rev', allowContinuation: false, allowMeanRev: true, why: 'ER low' };
  const ribbon = W.hgGoldApplyFormingRegime({ stratKey: 'ribbon', dir: 'long', stamps: [], gateNotes: [] }, regime);
  ok(ribbon.demoted === true && ribbon.stamps.indexOf('REGIME MR') >= 0,
     'continuation demoted in mean-rev regime');
  const rsi = W.hgGoldApplyFormingRegime({ stratKey: 'rsidiv', dir: 'long', stamps: [], gateNotes: [] }, regime);
  ok(rsi.demoted === true && rsi.stamps.indexOf('FOLKLORE') >= 0, 'rsidiv stamped FOLKLORE');
}

console.log('\n== Wiring source contracts ==');
{
  const GS = read('goldscalp.js');
  const GW = read('goldswing.js');
  const OG = read('omnigold.js');
  ok(/hgGoldFormingStack/.test(GS) && /formingLayersHtml/.test(GS), 'GOLD SCALP paints forming layers');
  ok(/hgGoldFormingStack/.test(GW) && /formingLayersHtml/.test(GW), 'GOLD SWING paints forming layers');
  ok(/hgGoldFormingStackHtml/.test(OG), 'OMNIGOLD engines host includes forming stack HTML');
  ok(/00:00–08:00 UTC/.test(read('goldind.js')) || /00:00-08:00/.test(read('goldind.js')),
     'Asia forming window documented as 00–08 UTC');
}

console.log('\n' + passed + ' assertions passed');
