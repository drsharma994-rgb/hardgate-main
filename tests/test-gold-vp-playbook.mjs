#!/usr/bin/env node
/* HARDGATE — VP playbook §10 ENTER/WAIT/NO ENTRY gates (hg-v565) */
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
ok(typeof W.hgGoldVpPlaybook === 'function', 'hgGoldVpPlaybook');
ok(typeof W.hgGoldVpPlaybookHtml === 'function', 'hgGoldVpPlaybookHtml');
ok(typeof W.hgGoldVpBias4h === 'function', 'hgGoldVpBias4h');
ok(typeof W.hgGoldVpLocationGrade === 'function', 'hgGoldVpLocationGrade');
ok(typeof W.hgGoldVpLvnBetween === 'function', 'hgGoldVpLvnBetween');
ok(W.HG_GOLD_VP_RR_ENTER === 2.0, 'RR enter 2.0');
ok(W.HG_GOLD_VP_RR_HALF === 1.5, 'RR half 1.5');
ok(W.HG_GOLD_VP_R_ATR_MAX === 0.6, 'R atr max 0.6');
ok(/vpbook/.test(fs.readFileSync(root + 'goldind.js', 'utf8')), 'vpbook strat wired');

function makeRows(){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12, 8, 0, 0) / 1000); /* London */
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

console.log('\n== bias + location + LVN path ==');
{
  const rows = makeRows();
  const bias = W.hgGoldVpBias4h(rows, null, {});
  ok(bias.bias === 'LONG' || bias.bias === 'SHORT' || bias.bias === 'BOTH' || bias.bias === 'NO_TRADE',
    'bias enum (' + bias.bias + ')');
  const vp = W.goldVolumeProfile(rows, 80, 40);
  const loc = W.hgGoldVpLocationGrade({
    vprof: vp, entry: vp.pocPrice, dir: 'long', atr: 8, obOk: true, poolNear: true
  });
  ok(loc.grade === 'A' || loc.grade === 'B+' || loc.grade === 'B',
    'POC+OB+pool grades A/B+/B (got ' + loc.grade + ')');
  const lvnOk = W.hgGoldVpLvnBetween(2300, 2320, {
    lvns: [2310], binSize: 1
  });
  ok(lvnOk === true, 'LVN between entry and T1');
  ok(W.hgGoldVpLvnBetween(2300, 2305, { lvns: [2310], binSize: 1 }) === false,
    'no LVN in short path');
}

console.log('\n== playbook decision shape ==');
{
  const rows = makeRows();
  const now = Date.UTC(2024, 5, 12, 8, 30, 0);
  const pb = W.hgGoldVpPlaybook(rows, { now, scalp: true });
  ok(pb.ok, 'playbook ok');
  ok(pb.decision === 'ENTER' || pb.decision === 'WAIT' || pb.decision === 'NO ENTRY',
    'decision enum (' + pb.decision + ')');
  ok(pb.gatesTotal === 12 && pb.gates.length === 12, '12 gates');
  ok(pb.gatesPass >= 0 && pb.gatesPass <= 12, 'gatesPass in range (' + pb.gatesPass + ')');
  ok(typeof pb.block === 'string' && /DECISION/.test(pb.block), 'decision block text');
  ok(typeof pb.why === 'string', 'why set');
  const html = W.hgGoldVpPlaybookHtml(pb);
  ok(/VP PLAYBOOK/.test(html), 'HTML paints VP PLAYBOOK');
  ok(new RegExp(pb.decision.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(html),
    'HTML shows decision');
}

console.log('\n== news lock fails gate 7 ==');
{
  const rows = makeRows();
  const now = Date.UTC(2024, 5, 12, 8, 30, 0);
  const pb = W.hgGoldVpPlaybook(rows, {
    now,
    newsGate: { lock: true, why: 'CPI lockout' }
  });
  const g7 = pb.gates.find(g => g.n === 7);
  ok(g7 && g7.pass === false, 'G7 fails on news lock');
  ok(pb.decision !== 'ENTER' || pb.gatesPass < 12, 'news lock prevents full ENTER');
}

console.log('\n== forming stack carries playbook ==');
{
  const rows = makeRows();
  const stack = W.hgGoldFormingStack({
    rows15m: rows, scalp: true,
    now: Date.UTC(2024, 5, 12, 8, 30, 0)
  });
  ok(stack.vpPlaybook && stack.vpPlaybook.ok, 'forming.vpPlaybook');
  const html = W.hgGoldFormingStackHtml(stack);
  ok(/VP PLAYBOOK|FORMING LAYERS/.test(html), 'forming HTML includes playbook or layers');
}

console.log('\n== desk wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const gs = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/vpbook/.test(gi) && /VP PLAYBOOK/.test(gi), 'scalp mint vpbook');
  ok(/VP ENTER/.test(gs), 'swing stamps VP ENTER');
  ok(/omnigold|forming/i.test(gi), 'shared forming path covers omnigold');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const idx = fs.readFileSync(root + 'index.html', 'utf8');
  ok(/hg-v565/.test(stamp), 'build-stamp hg-v565');
  ok(/HG_CACHE\s*=\s*'hg-v565'/.test(sw), 'sw.js hg-v565');
  ok(/goldind\.js\?v=565/.test(idx), 'index goldind ?v=565');
  ok(/build-stamp\.js\?v=565/.test(idx), 'index build-stamp ?v=565');
}

console.log('\n' + (failed ? 'FAILED ' + failed : 'ALL PASSED') + ' (' + passed + ' assertions)');
process.exit(failed ? 1 : 0);
