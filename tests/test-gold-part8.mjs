#!/usr/bin/env node
/* HARDGATE — Gold Part8 S49–S58 quantitative microstructure (hg-v577) */
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
ok(typeof W.hgGoldPart8Engine === 'function', 'engine');
ok(typeof W.hgGoldBvcDelta === 'function', 'BVC delta');
ok(typeof W.hgGoldVpin === 'function', 'VPIN');
ok(typeof W.hgGoldAmihudIlliq === 'function', 'Amihud');
ok(typeof W.hgGoldMacroResidual === 'function', 'macro residual');
ok(typeof W.hgGoldRegimeCluster === 'function', 'regime cluster');
ok(typeof W.hgGoldRangeBarSweep === 'function', 'range-bar sweep');
ok(typeof W.hgGoldBayesianGateAudit === 'function', 'bayesian audit');
ok(W.HG_GOLD_P8_VPIN_VETO === 97, 'VPIN veto 97');
ok(W.HG_GOLD_P8_RESID_TRADE === 2.5, 'resid trade |z|>2.5');

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

console.log('\n== BVC / CDF ==');
{
  ok(Math.abs(W.hgGoldNormCdf(0) - 0.5) < 0.01, 'Φ(0)≈0.5');
  ok(W.hgGoldNormCdf(3) > 0.99, 'Φ(3)>0.99');
  const rows = bars(220, 2300);
  const d = W.hgGoldBvcDelta(rows, 200);
  ok(Array.isArray(d) && d.length === rows.length, 'BVC delta length');
  const cvd = W.hgGoldBvcCvd(rows);
  ok(cvd.quality === 'bvc_proxy', 'cvd labelled bvc_proxy');
  ok(Array.isArray(cvd.cvd) && cvd.cvd.length === rows.length, 'CVD series');
}

console.log('\n== VPIN / ILLIQ filters demote, never invent ENTER ==');
{
  const rows = bars(200, 2300);
  const vpin = W.hgGoldVpin(rows, {});
  ok(vpin.ok && isFinite(vpin.pct), 'VPIN pct ' + vpin.pct);
  const cand = { dir: 'long', entry: 2300, stop: 2290, atr: 10, stratKey: 'p5vwap', stamps: [] };
  W.hgGoldPart8ApplyVpinFilter(cand, { ok: true, pct: 98, toxic: true, veto: true, why: 'veto' });
  ok(cand.demoted === true && cand.stamps.indexOf('S50 VPIN WAIT') >= 0, 'S50 veto demotes');
  const fade = { dir: 'long', entry: 2300, stop: 2290, atr: 10, stratKey: 'p6zfade', stamps: [] };
  W.hgGoldPart8ApplyVpinFilter(fade, { ok: true, pct: 92, toxic: true, veto: false, why: 'toxic' });
  ok(fade.demoted === true && fade.stamps.indexOf('S50 NO FADE') >= 0, 'toxic demotes fades');
  const illiq = W.hgGoldAmihudIlliq(rows);
  ok(illiq.ok && isFinite(illiq.illiqPct), 'ILLIQ pct');
  const c2 = { dir: 'long', sizeMult: 1, stamps: [] };
  W.hgGoldPart8ApplyIlliqScale(c2, { ok: true, illiqPct: 90, thin: true, sizeMult: 0.7 });
  ok(c2.sizeMult === 0.7 && c2.stamps.indexOf('S55 THIN') >= 0, 'S55 thin size cut');
}

console.log('\n== residual / cluster / bayes sacred ==');
{
  const eps = [];
  for (let i = 0; i < 80; i++) eps.push((i < 60) ? 0.001 : 0.02);
  const resid = W.hgGoldMacroResidual({ residSeries: eps });
  ok(resid.ok && isFinite(resid.residZ), 'resid_z computed');
  const unread = W.hgGoldMacroResidual({});
  ok(!unread.ok && /unread/i.test(unread.why), 'residual fail-open unread');
  const cl = W.hgGoldRegimeCluster(bars(100, 2300), { vpin: { pct: 80 } });
  ok(cl.ok && /TREND|BALANCE|STRESS/.test(cl.label), 'cluster label ' + cl.label);
  const stressCand = { stratKey: 'p5vwap', stamps: [], demoted: false };
  W.hgGoldPart8ApplyClusterFilter(stressCand, { ok: true, label: 'STRESS' });
  ok(stressCand.demoted && stressCand.stamps.indexOf('S56 STRESS NO FADE') >= 0, 'STRESS demotes fades');
  const bayes = W.hgGoldBayesianGateAudit([]);
  ok(!bayes.ok, 'S58 empty journal not ok');
  const journal = [];
  for (let i = 0; i < 65; i++) journal.push({ gates: { g13: true }, hitT1: i % 2 === 0 });
  const audited = W.hgGoldBayesianGateAudit(journal);
  ok(audited.ok && audited.gates.length >= 1, 'S58 audits gates');
  ok(Array.isArray(audited.demotePropose), 'S58 demote proposals only (never promote)');
}

console.log('\n== engine frames never invent dir ==');
{
  const eng = W.hgGoldPart8Engine(bars(100, 2300), {});
  ok(eng.ok || (eng.strategies && eng.strategies.length), 'engine runs');
  const frames = (eng.strategies || []).filter(s => s.grade === 'frame');
  ok(frames.length >= 1, 'frames present');
  ok(frames.every(s => !s.dir), 'frames never invent dir tickets');
  const html = W.hgGoldPart8Html(eng);
  ok(typeof html === 'string' && /PART8/i.test(html), 'html renders');
  const locked = W.hgGoldPart8Engine(bars(80, 2300), { newsGate: { lock: true } });
  ok(/lockout/i.test(locked.why || ''), 'news lockout pauses Part8');
}

console.log('\n== S49 boost does not invent ENTER ==');
{
  const blank = { agree: 2, stamps: [] };
  W.hgGoldPart8ApplyBvcBoost(blank, { diverge: false });
  ok(blank.agree === 2 && !(blank.stamps || []).length, 'absence does nothing');
  W.hgGoldPart8ApplyBvcBoost(blank, { diverge: true, why: 'div' });
  ok(blank.agree === 3 && blank.stamps.indexOf('S49 BVC+') >= 0, 'diverge grade+1 stamp');
}

console.log('\n== stamp ==');
{
  const stamp = fs.readFileSync(root + 'build-stamp.js', 'utf8');
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const m = stamp.match(/version\s*:\s*['"]([^'"]+)['"]/);
  ok(m && m[1] === HG_VER, 'build-stamp hg-v577 (got ' + (m && m[1]) + ')');
  ok(swCacheOk(sw), 'sw.js matches');
}

if (failed){ console.log('\n' + failed + ' failed, ' + passed + ' passed'); process.exit(1); }
console.log('\n' + passed + ' passed, 0 failed');
