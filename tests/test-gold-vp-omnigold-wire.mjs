#!/usr/bin/env node
/* HARDGATE — VP playbook OMNIGOLD + swing mint + §4.1 nodes + contract size (hg-v567) */
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

console.log('== contract size §9.3 ==');
{
  /* Worked example from playbook: R=$16, equity $50k, 1% → MGC×3 */
  const sz = W.hgGoldVpContractSize(16, { equity: 50000, riskPct: 0.01, entry: 4220 });
  ok(sz.ok, 'size ok');
  ok(sz.mgc === 3, 'MGC×3 (got ' + sz.mgc + ')');
  ok(sz.gc < 1, 'GC fractional <1 (got ' + sz.gc + ')');
  ok(/MGC/.test(sz.pick), 'pick prefers MGC (' + sz.pick + ')');
  const half = W.hgGoldVpContractSize(16, { equity: 50000, riskPct: 0.01, halfSize: true });
  ok(half.mgc === 1, 'half-size → MGC×1 (got ' + half.mgc + ')');
}

console.log('\n== playbook size in block ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12, 8, 0, 0) / 1000);
  for (let d = 6; d >= 0; d--){
    for (let i = 0; i < 48; i++){
      const t = t0 - d * 86400 + i * 1800;
      const c = 2305 + (i % 10);
      const v = (c >= 2308 && c <= 2312) ? 200 : 40;
      rows.push({ t, o: c, h: c + 2, l: c - 2, c, v });
    }
  }
  const pb = W.hgGoldVpPlaybook(rows, { now: Date.UTC(2024, 5, 12, 8, 30, 0), scalp: true });
  ok(pb.size && typeof pb.size.pick === 'string', 'playbook.size.pick set (' + (pb.size && pb.size.pick) + ')');
  ok(/SIZE/.test(pb.block), 'decision block includes SIZE');
}

console.log('\n== §4.1 HVN/LVN quantitative ==');
{
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12, 0, 0, 0) / 1000);
  for (let i = 0; i < 80; i++){
    const t = t0 + i * 3600;
    /* Concentrate volume mid-profile to force a clear POC/HVN + thin shelves */
    const c = 2300 + (i % 20);
    const v = (c >= 2308 && c <= 2312) ? 500 : ((c <= 2302 || c >= 2316) ? 20 : 80);
    rows.push({ t, o: c, h: c + 1, l: c - 1, c, v });
  }
  const vp = W.goldVolumeProfile(rows, 80, 40);
  ok(vp && isFinite(vp.pocPrice), 'POC set');
  ok(Array.isArray(vp.hvns), 'HVNs array');
  ok(Array.isArray(vp.lvns), 'LVNs array');
  ok(isFinite(vp.vah) && isFinite(vp.val) && vp.vah > vp.val, 'VAH > VAL');
}

console.log('\n== desk wiring ==');
{
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  ok(/VP-PLAYBOOK/.test(og) && /hgOgVpPlaybook/.test(og), 'OMNIGOLD VP-PLAYBOOK mechanic');
  ok(/OG_MECHANICS[\s\S]*VP-PLAYBOOK/.test(og), 'OG_MECHANICS lists VP-PLAYBOOK');
  ok(/'VP-PLAYBOOK':\s*'SWEEP'/.test(og), 'family SWEEP');
  ok(/vpbook:\s*'VP PLAYBOOK/.test(gs) || /SW_NAME[\s\S]*vpbook/.test(gs), 'swing SW_NAME vpbook');
  ok(/decision === 'ENTER'/.test(gs) && /vpbook/.test(gs), 'swing mints vpbook on ENTER');
  ok(/__gsCand\('vpbook'/.test(gi), 'scalp still mints vpbook');
  ok(/hgGoldVpContractSize/.test(gi), 'contract size helper');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const m = stamp.match(/version:\s*'([^']+)'/);
  ok(m && m[1] === HG_VER, 'build-stamp version (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw.js matches stamp');
  ok(/goldind\.js\?v=578/.test(html), 'index goldind ?v=');
  ok(/omnigold\.js\?v=578/.test(html) || /omnigold\.js\?v=/.test(html), 'index omnigold ?v=');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
