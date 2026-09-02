#!/usr/bin/env node
/* HARDGATE — gold volume-profile target ladder + triple profiles (hg-v557/v558) */
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
ok(typeof W.goldVolumeProfile === 'function', 'goldVolumeProfile');
ok(typeof W.hgGoldVpTargets === 'function', 'hgGoldVpTargets');
ok(typeof W.hgGoldVpTargetsHtml === 'function', 'hgGoldVpTargetsHtml');
ok(typeof W.hgGoldVpBundle === 'function', 'hgGoldVpBundle');
ok(typeof W.hgGoldVpAuction === 'function', 'hgGoldVpAuction');
ok(typeof W.hgGoldVpStop === 'function', 'hgGoldVpStop');

function makeRows(){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12) / 1000);
  for (let d = 6; d >= 0; d--){
    for (let i = 0; i < 48; i++){
      const t = t0 - d * 86400 + i * 1800;
      const c = 2305 + (i % 10);
      const v = (c >= 2308 && c <= 2312) ? 200 : 40;
      rows.push({ t, o: c, h: c + 2, l: c - 2, c, v });
    }
  }
  return rows;
}

/** Failed auction: last bar sweeps below VAL then closes inside. */
function failedAuctionRows(){
  const rows = makeRows();
  const vp = W.goldVolumeProfile(rows.slice(0, -1), 80, 40);
  const val = vp.val;
  const t = rows[rows.length - 1].t + 1800;
  rows.push({
    t, o: val + 1, h: val + 3, l: val - 4, c: val + 2, v: 400
  });
  return rows;
}

console.log('\n== profile levels ==');
{
  const vp = W.goldVolumeProfile(makeRows(), 80, 40);
  ok(!!vp && isFinite(vp.pocPrice), 'POC present (' + (vp && vp.pocPrice) + ')');
  ok(isFinite(vp.vah) && isFinite(vp.val), 'VAH/VAL present');
  ok(vp.vah > vp.val, 'VAH > VAL');
  ok(isFinite(vp.profileHigh) && isFinite(vp.profileLow), 'profile high/low');
  ok(Array.isArray(vp.hvns), 'HVNs array');
  ok(Array.isArray(vp.lvns), 'LVNs array');
  ok(/COMEX|venue/i.test(vp.venueNote || ''), 'venue limitation note');
}

console.log('\n== triple profile bundle ==');
{
  const b = W.hgGoldVpBundle(makeRows(), {});
  ok(b.ok, 'bundle ok');
  ok(!!b.session && isFinite(b.session.pocPrice), 'session profile');
  ok(!!b.weekly && isFinite(b.weekly.pocPrice), 'weekly composite');
  ok(!!b.anchored && isFinite(b.anchored.pocPrice), 'anchored event profile');
  ok(Array.isArray(b.singlePrints), 'single prints list');
}

console.log('\n== failed auction + VAL reclaim targets ==');
{
  const rows = failedAuctionRows();
  const b = W.hgGoldVpBundle(rows, {});
  ok(b.auction && b.auction.key === 'failed-auction', 'failed-auction detected (got ' + (b.auction && b.auction.key) + ')');
  const vp = b.session || b.weekly;
  const entry = vp.val + 0.5;
  const wideStop = entry - Math.abs(vp.pocPrice - vp.val) * 0.4;
  const tg = W.hgGoldVpTargets({
    dir: 'long', entry: entry, stop: wideStop, vprof: vp, bundle: b,
    thin: true, mssOk: true,
    /* leave VWAP unset so POC (pri 5) leads after VAL reclaim */
    sweepExtreme: wideStop + 0.05, atr: Math.abs(vp.profileHigh - vp.profileLow) / 10,
    auction: b.auction,
    external: { asiaHi: vp.profileHigh + 2, pdh: vp.profileHigh + 5 }
  });
  ok(tg.ok, 'targets ok after failed auction');
  ok(/POC|VWAP|VAH/i.test(tg.labels[0] || ''), 'TP1 prefers profile magnet after VAL reclaim (got ' + tg.labels[0] + ')');
  /* Confirmed badge: external liquidity far enough for ≥1.5R with MSS */
  const tgFar = W.hgGoldVpTargets({
    dir: 'long', entry: entry, stop: entry - 1, vprof: vp, bundle: b,
    thin: true, mssOk: true, auction: { key: 'failed-auction', dir: 'long' },
    external: { asiaHi: entry + 5, pdh: entry + 8 }
  });
  ok(tgFar.confirmed === true, 'confirmed when MSS + ≥1.5R (got ' + tgFar.confirmed + ' ' + tgFar.why + ')');
  ok(tg.dashboard && /POC/.test(tg.dashboard.session), 'dashboard SESSION line');
  ok(tg.dashboard && /TARGETS/.test('TARGETS') && tg.dashboard.targets, 'dashboard TARGETS line');
  ok(tg.stopPlan && isFinite(tg.stopPlan.stop), 'profile stop beyond extreme');
  const html = W.hgGoldVpTargetsHtml(tg);
  ok(/SESSION/.test(html) && /WEEKLY/.test(html) && /TARGETS/.test(html), 'HTML paints dashboard labels');
}

console.log('\n== no confirm without MSS ==');
{
  const vp = W.goldVolumeProfile(makeRows(), 80, 40);
  const tg = W.hgGoldVpTargets({
    dir: 'short', entry: 2315, stop: 2322, vprof: vp, thin: true,
    mssOk: false, external: { asiaLo: 2300, pdl: 2290 }
  });
  ok(tg.ok && !tg.confirmed, 'hint without MSS');
  ok(/need MSS/.test(tg.why), 'why mentions MSS');
}

console.log('\n== VP stop buffer ==');
{
  const st = W.hgGoldVpStop({ dir: 'long', extreme: 2290, atr: 10 });
  ok(Math.abs(st.stop - (2290 - 1.5)) < 1e-9, '0.15×ATR buffer (got ' + st.stop + ')');
  const late = W.hgGoldVpStop({ dir: 'short', extreme: 2320, atr: 10, lateSession: true });
  ok(Math.abs(late.stop - (2320 + 2.5)) < 1e-9, 'late session 0.25×ATR');
}

console.log('\n== forming stack ==');
{
  const stack = W.hgGoldFormingStack({ rows15m: makeRows(), now: Date.UTC(2024, 5, 12, 14, 0, 0) });
  ok(stack.vpBundle != null, 'forming carries vpBundle');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(typeof html === 'string', 'forming HTML');
}

console.log('\n== wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgGoldVpBundle/.test(gi) && /hgGoldVpAuction/.test(gi), 'goldind has triple VP + auction');
  ok(/VP TARGET CONFIRMED/.test(gi), 'confirmed badge');
  ok(/hgGoldFormingStack/.test(scalp), 'scalp forming');
  ok(/hgGoldFormingStack/.test(swing), 'swing forming');
  ok(/hgGoldFormingStackHtml/.test(og), 'omnigold forming HTML');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
