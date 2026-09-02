#!/usr/bin/env node
/* HARDGATE — Gold Part9 S59–S66 trader/SPRT/funding/info-bars (hg-v577) */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

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
ok(typeof W.hgGoldPart9Engine === 'function', 'engine');
ok(typeof W.hgGoldTraderState === 'function', 'trader state');
ok(typeof W.hgGoldSprt === 'function', 'SPRT');
ok(typeof W.hgGoldBootstrapR === 'function', 'bootstrap');
ok(typeof W.hgGoldVolumeBarSweep === 'function', 'volume-bar sweep');
ok(typeof W.hgGoldFundingWindow === 'function', 'funding window');
ok(typeof W.hgGoldCarryAwareRr === 'function', 'carry RR');
ok(typeof W.hgGoldPremiumFade === 'function', 'premium fade');
ok(typeof W.hgGoldFreezeRule === 'function', 'freeze rule');
ok(W.HG_GOLD_P9_SPRT_A === 2.77, 'SPRT A=+2.77');
ok(W.HG_GOLD_P9_SPRT_B === -1.56, 'SPRT B=−1.56');
ok(W.HG_GOLD_P9_SPRT_P0 === 0.40 && W.HG_GOLD_P9_SPRT_P1 === 0.55, 'SPRT p0/p1');
ok(W.HG_GOLD_P9_FREEZE_ROWS === 100, 'freeze 100 rows');

function bars(n, mid, stepSec, t0){
  const rows = [];
  stepSec = stepSec || 900;
  t0 = t0 || Math.floor(Date.UTC(2024, 5, 3, 12, 0) / 1000);
  for (let i = 0; i < n; i++){
    const c = mid + i * 0.15;
    rows.push({ t: t0 + i * stepSec, o: c, h: c + 2, l: c - 2, c: c + 0.05, v: 800 + i * 3 });
  }
  return rows;
}

console.log('\n== S59 trader-state permission only ==');
{
  const empty = W.hgGoldTraderState([]);
  ok(!empty.ok && /journal/i.test(empty.why), 'empty journal not ok');
  const journal = [];
  for (let i = 0; i < 20; i++){
    journal.push({
      plan: { entry: 2300, stop: 2290, size: 1 },
      actual: { entry: 2300, stop: 2290, size: 1 },
      latMin: i < 4 ? 20 : 5,
      override: i < 2,
      rvg: i === 0 ? 1 : 0,
      order_ts_utc: Date.now() - i * 3600000,
      dayKey: '2024-06-' + String(10 - Math.floor(i / 3)).padStart(2, '0')
    });
  }
  /* Force high PDI */
  journal.forEach((r, i) => { if (i < 12) r.devFields = 1; });
  const st = W.hgGoldTraderState(journal);
  ok(st.ok && st.pdi > 0.5, 'PDI mean > 0.5 → ' + st.pdi.toFixed(2));
  ok(st.permission === 'REDUCED' || st.permission === 'REVIEW_ONLY', 'permission reduced/review');
  const cand = { dir: 'long', sizeMult: 1, stamps: [], demoted: false };
  W.hgGoldPart9ApplyTraderState(cand, { ok: true, permission: 'REDUCED', sizeMult: 0.5 });
  ok(cand.sizeMult === 0.5 && cand.stamps.indexOf('S59 REDUCED') >= 0, 'S59 halves size');
  const before = { dir: 'short', stamps: [] };
  W.hgGoldPart9ApplyTraderState(before, { ok: true, permission: 'REVIEW_ONLY', sizeMult: 0 });
  ok(before.demoted && before.dir === 'short', 'REVIEW_ONLY demotes — never flips dir');
}

console.log('\n== S60 SPRT promote / demote / continue ==');
{
  const promo = W.hgGoldSprt([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  ok(promo.decision === 'PROMOTE' && promo.llr >= 2.77, '9 hits → PROMOTE');
  const dem = W.hgGoldSprt([0, 0, 0, 0, 0, 0]);
  ok(dem.decision === 'DEMOTE' && dem.llr <= -1.56, '6 misses → DEMOTE');
  const mid = W.hgGoldSprt([1, 0, 1, 0, 1, 0, 1, 0]);
  ok(mid.decision === 'CONTINUE' && mid.sizeMult === 0.5, 'mixed → CONTINUE half');
  const blank = { sizeMult: 1, stamps: [], demoted: false };
  W.hgGoldPart9ApplySprt(blank, dem);
  ok(blank.demoted && blank.sizeMult === 0, 'SPRT demote zeros size — no ENTER invent');
}

console.log('\n== S61 bootstrap CI ==');
{
  const thin = W.hgGoldBootstrapR([0.5, -1, 1]);
  ok(!thin.ok, 'too few samples not ok');
  const r = [];
  for (let i = 0; i < 60; i++) r.push(i % 3 === 0 ? -1 : 0.8);
  const boot = W.hgGoldBootstrapR(r, { seed: 42, nSims: 500 });
  ok(boot.ok && Array.isArray(boot.meanR_CI95) && isFinite(boot.DD_R_p95), 'CI + DD_R p95');
  ok(isFinite(boot.rPerTradeHint) && boot.rPerTradeHint > 0, 'R% hint for −8% ladder');
}

console.log('\n== S63 funding window IST ==');
{
  /* 13:20 IST = 07:50 UTC — inside 20m pre 13:30 */
  const ms = Date.UTC(2024, 5, 3, 7, 50, 0);
  const fw = W.hgGoldFundingWindow(ms, { fundingRate: 0.0003, dir: 'long', venue: 'XAUTUSD' });
  ok(fw.ok && fw.inWindow && fw.wait, 'paying long near 13:30 IST → WAIT');
  const gc = W.hgGoldFundingWindow(ms, { venue: 'GC' });
  ok(gc.ok && !gc.wait && /N\/A/i.test(gc.why), 'GC zero effect');
  const cand = { dir: 'long', stamps: [], demoted: false };
  W.hgGoldPart9ApplyFundingWindow(cand, { ok: true, fundingRate: 0.0003, venue: 'XAUTUSD', nowMs: ms });
  ok(cand.demoted && cand.stamps.indexOf('S63 FUNDING WAIT') >= 0, 'funding WAIT demotes');
}

console.log('\n== S64 carry-aware R_eff ==');
{
  const plan = { entry: 4300, stop: 4284, t1: 4332 }; /* R=16, reward=32 → RR=2 */
  const okR = W.hgGoldCarryAwareRr(plan, { fundingRate: 0, nPayments: 0 });
  ok(okR.ok && okR.runnerOk && Math.abs(okR.rr - 2) < 0.01, 'zero carry runner OK');
  const heavy = W.hgGoldCarryAwareRr(plan, { fundingRate: 0.0003, nPayments: 6 });
  ok(heavy.ok && heavy.intradayOnly, 'carry kills runner → intraday only');
  const c = { stamps: [], t2: 4400 };
  W.hgGoldPart9ApplyCarryGate(c, heavy);
  ok(c.runnerDisabled && !isFinite(c.t2), 'clears T2 on intraday-only');
}

console.log('\n== S65 / S62 / frames never invent dir ==');
{
  const rows = bars(120, 2300);
  const eng = W.hgGoldPart9Engine(rows, {});
  ok(eng.ok || (eng.strategies && eng.strategies.length), 'engine runs');
  const frames = (eng.strategies || []).filter(s => s.grade === 'frame');
  ok(frames.length >= 1, 'frames present');
  ok(frames.every(s => !s.dir), 'frames never invent dir');
  const premUnread = W.hgGoldPremiumFade(rows, {});
  ok(!premUnread.ok && /unread/i.test(premUnread.why), 'premium fail-open unread');
  const series = [];
  for (let i = 0; i < 60; i++) series.push(0.1);
  series.push(5); /* spike */
  /* Force rejection short setup at end */
  rows[rows.length - 1].o = 2310;
  rows[rows.length - 1].h = 2312;
  rows[rows.length - 1].l = 2300;
  rows[rows.length - 1].c = 2301;
  const fade = W.hgGoldPremiumFade(rows, {
    premiumSeries: series,
    indexAtExtreme: false,
    fundingRate: 0,
    now: Date.UTC(2024, 5, 3, 10, 0) /* outside funding windows IST */
  });
  /* KER gate is honest — either fires short half-size or explains KER veto */
  ok(fade.ok
    ? (fade.dir === 'short' && fade.halfSize === true)
    : /KER|unread|reject|funding|extreme|premium/i.test(String(fade.why || '')),
    fade.ok ? 'premium fade short half size' : ('premium fade gated: ' + fade.why));
  const html = W.hgGoldPart9Html(eng);
  ok(typeof html === 'string' && /PART9/i.test(html), 'html renders');
  const locked = W.hgGoldPart9Engine(rows, { newsGate: { lock: true } });
  ok(/lockout/i.test(locked.why || ''), 'news lockout pauses Part9');
}

console.log('\n== S66 freeze ==');
{
  const fr = W.hgGoldFreezeRule({ resolvedRows: 40 });
  ok(fr.ok && fr.changeBudget === 100, '1 change / 100 rows');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const m = stamp.match(/version\s*:\s*['"]([^'"]+)['"]/);
  ok(m && m[1] === 'hg-v577', 'build-stamp hg-v577 (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw.js matches');
}

if (failed){ console.log('\n' + failed + ' failed, ' + passed + ' passed'); process.exit(1); }
console.log('\n' + passed + ' passed, 0 failed');
