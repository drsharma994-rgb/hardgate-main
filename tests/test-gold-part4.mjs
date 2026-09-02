#!/usr/bin/env node
/* HARDGATE — Gold Part4 S9–S18 strategies (hg-v562) */
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
ok(typeof W.hgGoldPart4PremiumDiscount === 'function', 'P/D');
ok(typeof W.hgGoldPart4ApplyDiscountFilter === 'function', 'P/D filter');
ok(typeof W.hgGoldPart4PoorExtreme === 'function', 'poor extreme');
ok(typeof W.hgGoldPart4Nr7 === 'function', 'NR7');
ok(typeof W.hgGoldPart4AsiaSd === 'function', 'Asia SD');
ok(typeof W.hgGoldPart4LookAboveFail === 'function', 'look-above-fail');
ok(typeof W.hgGoldPart4Gap === 'function', 'gap');
ok(typeof W.hgGoldPart4Engine === 'function', 'engine');
ok(typeof W.hgGoldPart4Html === 'function', 'html');
ok(W.HG_GOLD_P4_EQ_BAND === 0.15, 'EQ band 0.15');
ok(W.HG_GOLD_P4_ADR_FADE === 1.20, 'ADR fade ≥120%');

function trendRows(n, start, step){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 1) / 1000);
  let px = start;
  for (let i = 0; i < n; i++){
    px += step;
    rows.push({
      t: t0 + i * 900,
      o: px - step * 0.3, h: px + Math.abs(step), l: px - Math.abs(step), c: px, v: 100
    });
  }
  return rows;
}

console.log('\n== S9 premium/discount ==');
{
  const disc = W.hgGoldPart4PremiumDiscount(trendRows(50, 2200, -2)); /* falling into discount */
  ok(disc.ok && disc.half === 'DISCOUNT', 'falling → DISCOUNT (' + disc.half + ')');
  ok(disc.longOk && !disc.shortOk, 'discount allows long only');
  const prem = W.hgGoldPart4PremiumDiscount(trendRows(50, 2200, 2));
  ok(prem.ok && prem.half === 'PREMIUM', 'rising → PREMIUM');
  ok(prem.shortOk && !prem.longOk, 'premium allows short only');
  const cand = { dir: 'long', stamps: [] };
  W.hgGoldPart4ApplyDiscountFilter(cand, prem);
  ok(cand.demoted && cand.stamps.indexOf('PREMIUM LONG') >= 0, 'demotes premium long');
}

console.log('\n== S15 poor / excess ==');
{
  const rows = trendRows(30, 2300, 0.1);
  /* shared high */
  rows[rows.length - 3].h = 2320; rows[rows.length - 3].c = 2310;
  rows[rows.length - 2].h = 2320.5; rows[rows.length - 2].c = 2312;
  rows[rows.length - 1].h = 2318; rows[rows.length - 1].c = 2314;
  const poor = W.hgGoldPart4PoorExtreme(rows);
  ok(poor.ok, 'poor/excess detects something');
}

console.log('\n== S18 Asia SD ==');
{
  const rows = [];
  const base = Math.floor(Date.UTC(2024, 5, 12) / 1000);
  for (let h = 0; h < 8; h++){
    for (let m = 0; m < 4; m++){
      rows.push({ t: base + h * 3600 + m * 900, o: 2305, h: 2310, l: 2300, c: 2305, v: 50 });
    }
  }
  for (let h = 8; h < 12; h++){
    for (let m = 0; m < 4; m++){
      rows.push({ t: base + h * 3600 + m * 900, o: 2308, h: 2312, l: 2304, c: 2308, v: 80 });
    }
  }
  const sd = W.hgGoldPart4AsiaSd(rows, null);
  ok(sd.ok && isFinite(sd.p2) && isFinite(sd.m2), 'Asia SD bands (mid=' + sd.mid + ')');
  ok(sd.p25 > sd.p2 && sd.m25 < sd.m2, '2.5 SD outside 2.0');
}

console.log('\n== engine + HTML ==');
{
  const rows = trendRows(100, 2250, 0.5);
  const eng = W.hgGoldPart4Engine(rows, { newsGate: { lock: false } });
  ok(eng.pd && eng.pd.ok, 'engine carries P/D');
  ok(Array.isArray(eng.unchecked) && eng.unchecked.indexOf('S13 silver') >= 0, 'S13 unchecked');
  ok(Array.isArray(eng.unchecked) && eng.unchecked.indexOf('S16 footprint') >= 0, 'S16 unchecked');
  const html = W.hgGoldPart4Html(eng.ok || eng.pd ? eng : {
    ok: true, pd: { ok: true, half: 'DISCOUNT' }, adr: { pctOfADR: 0.5 },
    unchecked: ['S13 silver', 'S16 footprint'],
    strategies: [{ key: 'p4disc', dir: 'long', level: 2300, why: 'test' }],
    why: 'test'
  });
  ok(/PART4/.test(html), 'HTML paints PART4');
}

console.log('\n== news lockout ==');
{
  const locked = W.hgGoldPart4Engine(trendRows(50, 2300, 1), { newsGate: { lock: true } });
  ok(/lockout|news/i.test(locked.why || ''), 'Part4 pauses on news');
}

console.log('\n== forming + desk ==');
{
  const stack = W.hgGoldFormingStack({ rows15m: trendRows(80, 2300, 0.2) });
  ok(stack.part4 != null, 'forming carries part4');
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/p4laf|p4nr7|hgGoldPart4Engine/.test(gi), 'goldind mints Part4');
  ok(/hgGoldPart4Engine/.test(swing) && /PART4/.test(swing), 'swing stamps PART4');
  ok(/hgGoldFormingStack/.test(scalp), 'scalp forming');
  ok(/hgGoldFormingStackHtml/.test(og), 'omnigold forming');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
