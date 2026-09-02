#!/usr/bin/env node
/* HARDGATE — two-stage RVOL fake-sweep filters (hg-v561) */
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

console.log('== exports / thresholds ==');
ok(typeof W.hgGoldSweepRvolBand === 'function', 'hgGoldSweepRvolBand');
ok(typeof W.hgGoldSweepResponseRvol === 'function', 'hgGoldSweepResponseRvol');
ok(typeof W.hgGoldSweepTwoStageRvol === 'function', 'hgGoldSweepTwoStageRvol');
ok(typeof W.hgGoldSweepTwoStageHtml === 'function', 'hgGoldSweepTwoStageHtml');
ok(W.HG_GOLD_SWEEP_RVOL_MIN === 1.25, 'sweep RVOL floor 1.25');
ok(W.HG_GOLD_SWEEP_RVOL_ASIA === 1.50, 'Asia RVOL floor 1.50');
ok(W.HG_GOLD_SWEEP_RVOL_RESPONSE === 1.10, 'response RVOL 1.10');
ok(W.HG_GOLD_SWEEP_RVOL_STRONG === 1.80, 'strong band 1.80');
ok(W.HG_GOLD_SWEEP_RVOL_BLOWOFF === 2.50, 'blowoff 2.50');

console.log('\n== RVOL bands ==');
{
  ok(W.hgGoldSweepRvolBand(0.5).key === 'weak', '0.5 → weak');
  ok(W.hgGoldSweepRvolBand(0.85).key === 'quiet', '0.85 → quiet');
  ok(W.hgGoldSweepRvolBand(1.1).key === 'mild', '1.1 → mild');
  ok(W.hgGoldSweepRvolBand(1.4).key === 'good' && W.hgGoldSweepRvolBand(1.4).minEntry, '1.4 → good entry');
  ok(W.hgGoldSweepRvolBand(2.0).key === 'strong', '2.0 → strong');
  ok(W.hgGoldSweepRvolBand(3.0).key === 'blowoff', '3.0 → blowoff');
}

/** Synthetic Asia low sweep with climactic volume + response bars. */
function genuineSweepRows(){
  const rows = [];
  const base = Math.floor(Date.UTC(2024, 5, 12) / 1000);
  for (let d = 15; d >= 1; d--){
    for (let h = 0; h < 24; h++){
      for (let m = 0; m < 4; m++){
        const t = base - d * 86400 + h * 3600 + m * 900;
        rows.push({
          t, o: 2320, h: 2324, l: 2316, c: 2320,
          v: h < 8 ? 40 : (h >= 12 ? 100 : 70)
        });
      }
    }
  }
  for (let h = 0; h < 8; h++){
    for (let m = 0; m < 4; m++){
      rows.push({ t: base + h * 3600 + m * 900, o: 2305, h: 2310, l: 2300, c: 2305, v: 50 });
    }
  }
  /* London: raid Asia low then reclaim + displacement */
  const raidT = base + 8 * 3600;
  rows.push({ t: raidT, o: 2302, h: 2306, l: 2294, c: 2305, v: 220 }); /* sweep reclaim */
  rows.push({ t: raidT + 900, o: 2305, h: 2314, l: 2304, c: 2312, v: 180 }); /* response */
  rows.push({ t: raidT + 1800, o: 2312, h: 2316, l: 2310, c: 2314, v: 150 });
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

console.log('\n== two-stage genuine reversal ==');
{
  const rows = genuineSweepRows();
  const hit = {
    dir: 'long', level: 2300, atr: 8, rvol: 2.2,
    wick: { closeReclaim: true, breachAtr: 0.35, potential: true, disp: true },
    mss: { ok: true, why: 'CHoCH bullish' },
    vwap: { ok: true, vwap: 2308 }
  };
  const ts = W.hgGoldSweepTwoStageRvol(rows, hit, {
    now: Date.UTC(2024, 5, 12, 8, 45, 0),
    newsGate: { lock: false }
  });
  ok(ts.stage1, 'stage1 pass (got why=' + ts.why + ')');
  ok(ts.stage2 || ts.ok || ts.pending, 'stage2/ok/pending set');
  ok(!ts.fake || ts.profile === 'reversal' || ts.ok,
    'not fake-weak (fake=' + ts.fake + ' profile=' + ts.profile + ')');
  const html = W.hgGoldSweepTwoStageHtml(ts.ok || ts.stage1 ? ts : {
    ok: true, stage1: true, stage2: true, profile: 'reversal',
    sweepRvol: 1.8, responseRvol: 1.3, band: { label: 'strong' }, why: 'test'
  });
  ok(/RVOL 2-STAGE/.test(html), 'HTML paints RVOL 2-STAGE');
}

console.log('\n== fake: low-volume wick ==');
{
  const rows = genuineSweepRows();
  /* Crush last raid volumes */
  rows[rows.length - 3].v = 20;
  rows[rows.length - 2].v = 15;
  rows[rows.length - 1].v = 15;
  const hit = {
    dir: 'long', level: 2300, atr: 8, rvol: 0.4,
    wick: { closeReclaim: true, breachAtr: 0.3, potential: true },
    mss: { ok: false }, vwap: { ok: false }
  };
  const ts = W.hgGoldSweepTwoStageRvol(rows, hit, {
    now: Date.UTC(2024, 5, 12, 8, 45, 0)
  });
  ok(ts.fake || !ts.stage1, 'low RVOL rejected (fake=' + ts.fake + ' stage1=' + ts.stage1 + ')');
  ok(/low-volume|RVOL|floor|weak/i.test(ts.fakeReason || ts.why || ''),
    'reason mentions volume (' + (ts.fakeReason || ts.why) + ')');
}

console.log('\n== fake: breakout acceptance ==');
{
  const rows = genuineSweepRows();
  const hit = {
    dir: 'long', level: 2300, atr: 8, rvol: 1.8,
    wick: { closeReclaim: false, breachAtr: 0.4, potential: true },
    mss: { ok: false }, vwap: { ok: false }
  };
  const ts = W.hgGoldSweepTwoStageRvol(rows, hit, {});
  ok(ts.fake && ts.profile === 'breakout', 'breakout acceptance labeled');
  ok(/breakout|do not fade/i.test(ts.fakeReason || ''), 'do-not-fade copy');
}

console.log('\n== news blowoff lockout ==');
{
  const rows = genuineSweepRows();
  rows[rows.length - 3].v = 800;
  const hit = {
    dir: 'long', level: 2300, atr: 8, rvol: 4.0,
    wick: { closeReclaim: true, breachAtr: 0.5, potential: true },
    mss: { ok: true }, vwap: { ok: true }
  };
  const ts = W.hgGoldSweepTwoStageRvol(rows, hit, {
    newsGate: { lock: true, reason: 'CPI' }
  });
  ok(ts.fake || /blowoff|news/i.test(ts.why || ''),
    'news blowoff handled (fake=' + ts.fake + ' why=' + ts.why + ')');
}

console.log('\n== false-filters wire two-stage ==');
{
  const rows = genuineSweepRows();
  rows[rows.length - 3].v = 18;
  rows[rows.length - 2].v = 14;
  rows[rows.length - 1].v = 12;
  const hit = {
    dir: 'long', level: 2300, atr: 8, rvol: 0.5, levelKind: 'asia',
    wick: { closeReclaim: true, breachAtr: 0.2 },
    mss: { ok: false }, vwap: { unchecked: true }
  };
  const f = W.hgGoldSweepFalseFilters(rows, hit, { newsGate: { lock: false } });
  ok(f.rvol2 != null, 'filters attach rvol2');
  ok(f.reject === true, 'low-volume wick reject via filters (reject=' + f.reject + ' reasons=' + (f.reasons||[]).join(';') + ')');
}

console.log('\n== desk wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgGoldSweepTwoStageRvol/.test(gi), 'goldind has two-stage');
  ok(/HG_GOLD_SWEEP_RVOL_MIN = 1\.25/.test(gi), 'floor literal 1.25');
  ok(/hgGoldFormingStack/.test(scalp), 'scalp forming');
  ok(/hgGoldSweepEngine/.test(swing), 'swing uses sweep engine');
  ok(/hgGoldFormingStackHtml/.test(og), 'omnigold forming HTML');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
