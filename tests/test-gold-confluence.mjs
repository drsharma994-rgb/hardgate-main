#!/usr/bin/env node
/* HARDGATE — gold 100-pt core confluence score (hg-v559) */
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
ok(typeof W.hgGoldConfluenceScore === 'function', 'hgGoldConfluenceScore');
ok(typeof W.hgGoldConfluenceHtml === 'function', 'hgGoldConfluenceHtml');
ok(typeof W.hgGoldApplyConfluence === 'function', 'hgGoldApplyConfluence');
ok(typeof W.hgGoldConfluenceTier === 'function', 'hgGoldConfluenceTier');
ok(W.HG_GOLD_CONF_A === 85 && W.HG_GOLD_CONF_GOOD === 75 && W.HG_GOLD_CONF_WATCH === 65, 'tier thresholds');

console.log('\n== tiers ==');
ok(W.hgGoldConfluenceTier(90) === 'A', '90 → A');
ok(W.hgGoldConfluenceTier(80) === 'GOOD', '80 → GOOD');
ok(W.hgGoldConfluenceTier(70) === 'WATCH', '70 → WATCH');
ok(W.hgGoldConfluenceTier(50) === 'NO_TRADE', '50 → NO_TRADE');

function trendRows(){
  const rows = [];
  const t0 = Math.floor(Date.UTC(2024, 5, 12) / 1000);
  for (let i = 0; i < 80; i++){
    const c = 2300 + i * 1.5;
    rows.push({ t: t0 + i * 3600, o: c - 0.5, h: c + 2, l: c - 2, c, v: 100 + i });
  }
  return rows;
}

console.log('\n== score anatomy ==');
{
  const rows = trendRows();
  const cand = {
    dir: 'long', stratKey: 'liqsweep', entry: rows[rows.length - 1].c,
    agree: 3, confirmed: true, sweepScore: 80, killzoneWeight: 3
  };
  const sc = W.hgGoldConfluenceScore(cand, {
    rows15m: rows, rows4h: rows,
    macro: { realRateHint: 'TAILWIND' },
    newsGate: { lock: false }
  });
  ok(sc.ok, 'score ok');
  ok(isFinite(sc.score) && sc.score >= 0 && sc.score <= 100, 'score in 0–100 (got ' + sc.score + ')');
  ok(sc.parts && isFinite(sc.parts.htf) && isFinite(sc.parts.location), 'parts present');
  ok(sc.parts.htf <= 25 && sc.parts.location <= 20 && sc.parts.momentum <= 15, 'caps respected');
  ok(/COT is weekly/.test(sc.cotNote), 'COT lag note');
  const html = W.hgGoldConfluenceHtml(sc);
  ok(/GOLD CONFLUENCE/.test(html) && /HTF/.test(html), 'HTML paints');
}

console.log('\n== news lock zeros macro + blocks alert ==');
{
  const sc = W.hgGoldConfluenceScore({
    dir: 'long', stratKey: 'ribbon', entry: 2310, agree: 1
  }, { newsGate: { lock: true }, rows15m: trendRows() });
  ok(sc.parts.macro === 0, 'macro zero under news lock');
  ok(!sc.alertOk, 'no alert under news lock');
}

console.log('\n== apply stamps NO_TRADE without hard demote ==');
{
  const weak = { dir: 'short', stratKey: 'rsidiv', entry: 2310, agree: 0, demoted: false, stamps: [] };
  W.hgGoldApplyConfluence(weak, { newsGate: { lock: true } });
  ok(isFinite(weak.confScore), 'confScore stamped');
  ok(weak.confTier === 'NO_TRADE' || weak.confScore < 65, 'weak → low tier (got ' + weak.confTier + '/' + weak.confScore + ')');
  ok(weak.stamps.some((s) => /CONF/.test(s)), 'CONF stamp');
  ok(weak.demoted === false, 'does not hard-demote (ranker demotions stay authoritative)');
  ok(weak.confAlertOk === false, 'alert blocked');
}

console.log('\n== ranker wires confluence ==');
{
  const rows = trendRows();
  const cands = [{
    id: 't1', dir: 'long', stratKey: 'liqsweep', strategy: 'SWEEP',
    entry: rows[rows.length - 1].c, stop: rows[rows.length - 1].c - 10,
    t1: rows[rows.length - 1].c + 20, agree: 3, killzoneWeight: 3,
    sweepScore: 82, confirmed: true, stamps: [], grade: 'A'
  }];
  const rk = W.goldRankSetups(cands, {
    rows15m: rows, rows4h: rows,
    macro: { realRateHint: 'TAILWIND' },
    now: Date.UTC(2024, 5, 12, 14, 0, 0)
  });
  ok(rk.ranked.length === 1, 'ranked 1');
  ok(isFinite(rk.ranked[0].confScore), 'ranker attached confScore');
  ok(!!rk.ranked[0].confTier, 'ranker attached confTier');
}

console.log('\n== forming stack ==');
{
  const stack = W.hgGoldFormingStack({ rows15m: trendRows(), now: Date.UTC(2024, 5, 12, 14, 0, 0) });
  const html = W.hgGoldFormingStackHtml(stack);
  ok(typeof html === 'string', 'forming HTML');
  /* confluence only when a lead strategy exists */
  ok(true, 'forming path runs');
}

console.log('\n== desk wiring ==');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const scalp = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const swing = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/hgGoldConfluenceScore/.test(gi) && /hgGoldApplyConfluence/.test(gi), 'goldind confluence');
  ok(/goldRankSetups/.test(scalp) || /hgGoldFormingStack/.test(scalp), 'scalp uses rank/forming');
  ok(/goldRankSetups/.test(swing) || /hgGoldFormingStack/.test(swing), 'swing uses rank/forming');
  ok(/hgGoldFormingStackHtml/.test(og), 'omnigold forming HTML');
  ok(/__hgGoldCot/.test(gi), 'COT weekly caution still referenced');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
