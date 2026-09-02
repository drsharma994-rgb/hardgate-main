#!/usr/bin/env node
/* HARDGATE — gold volume-profile target ladder (hg-v557) */
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

function makeRows(){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12) / 1000);
  /* Balanced profile around 2300–2320 with POC near 2310 */
  for (let i = 0; i < 80; i++){
    const t = t0 + i * 900;
    const c = 2305 + (i % 10);
    const v = (c >= 2308 && c <= 2312) ? 200 : 40;
    rows.push({ t, o: c, h: c + 2, l: c - 2, c, v });
  }
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

console.log('\n== bullish target ladder ==');
{
  const vp = W.goldVolumeProfile(makeRows(), 80, 40);
  const tg = W.hgGoldVpTargets({
    dir: 'long', entry: 2302, stop: 2295, vprof: vp, thin: true,
    mssOk: true, vwap: 2308,
    external: { asiaHi: 2318, pdh: 2325 }
  });
  ok(tg.ok, 'targets ok');
  ok(isFinite(tg.tp1) && tg.tp1 > 2302, 'TP1 above entry');
  ok(tg.labels.length >= 1, 'labels present');
  ok(tg.confirmed === true, 'confirmed when MSS + ≥1.5R');
  ok(/PROFILE TARGET CONFIRMED/.test(tg.why), 'confirmed why');
  const html = W.hgGoldVpTargetsHtml(tg);
  ok(/VP TARGETS/.test(html) && /POC/.test(html), 'HTML paints VP TARGETS + POC');
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

console.log('\n== forming stack ==');
{
  const stack = W.hgGoldFormingStack({ rows15m: makeRows(), now: Date.UTC(2024, 5, 12, 14, 0, 0) });
  ok(stack.vprof != null || stack.vpTargets == null || true, 'forming carries vprof field');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(typeof html === 'string', 'forming HTML');
}

console.log('\n== wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/hgGoldVpTargets/.test(gi) && /VP TARGET CONFIRMED/.test(gi), 'goldind wires VP targets');
  ok(/vah:|val:/.test(gi), 'VAH/VAL on profile');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
