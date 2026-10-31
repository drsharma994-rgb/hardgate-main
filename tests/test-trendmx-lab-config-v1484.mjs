#!/usr/bin/env node
/* hg-v1484 — the measured mint config, shipped: the win-rate lab's confirmed
   winner rides the desk. scripts/trendmx-winrate-lab.mjs (196 configurations,
   greedy add/remove on three disjoint search windows, confirmation on a
   fourth held-out window) measured 27.6% -> 41.1% win, net -0.028R -> +0.205R,
   z = 4.52 — scripts/trendmx-winrate-lab-results.json. The four clauses:

     1. the h4Cascade leg no longer votes the direction (tmLabScore =
        score - h4Cascade, majority |2| unchanged); it still computes,
        displays and records its ledger mark.
     2. reads['tm:adx'] must be explicitly true (WITH).
     3. reads.trendQualityWith must be explicitly true (WITH).
     4. every trendmxPlan stop widens 1.25x at the one return seam; targets
        do not move; tmValidSetup judges a widened plan against the 2R bar
        in the ORIGINAL risk units (1.6R widened) — the bar is not loosened.

   Clauses 2-3 do NOT abstain on an unread mark (unlike the hg-v1399 floor):
   "trade only when both reads are explicitly WITH" is the measured rule, and
   the absent case is part of what was measured. This guard pins the wiring,
   drives the real functions on crafted fixtures, proves held rows are named
   and recorded, and sweeps the gate modules for any read of the config. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (c, label) => { if (c){ passed++; console.log('ok —', label); } else { failed++; console.log('FAIL —', label); } };

/* ---------- boot: the same stack the class-desks guard boots ---------- */
const FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js', 'omniroute.js', 'trendtable.combined.js'];
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of FILES){ try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); } catch(e){} }
  return ctx;
}

/* fixtures (v1012 shapes, t in SECONDS). The drift tape: last-14 choppiness
   36.6 (<= 38.2) and Kaufman ER 1.0 (> 0.4) read 'trend'; the 1.5xATR stop
   prices >= 2% of entry so the hg-v1399 floor passes and the lab seam is
   what the fixture exercises. */
const T0 = 1750000000;
function tape(n, tfSec, start, step, wick){
  const rows = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c; c = c + step;
    rows.push({ t: T0 - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + Math.abs(step) * wick, l: Math.min(o, c) - Math.abs(step) * wick, c, v: 1000 });
  }
  return rows;
}
function chopTape(n, tfSec, start, amp){
  const rows = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c; c = start + (i % 2 ? amp : -amp);
    rows.push({ t: T0 - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + amp * 0.2, l: Math.min(o, c) - amp * 0.2, c, v: 1000 });
  }
  return rows;
}
const D1 = tape(260, 86400, 30, 0.5, 1), H4 = tape(60, 14400, 10, 1, 1);
function gate7(){ return { gatesPassed: 7, gatesTotal: 7, clean7: true, nearClean: false, hit: null, label: '7/7 CLEAN', veto: null }; }
function mkRow(W, opts){
  const ts = W.trendScore(D1, H4);
  return Object.assign({
    sym: 'XUSDT', base: 'X', exchange: 'binance',
    score: ts.score, comps: ts.comps, freshCross: ts.freshCross, adx: ts.adx,
    price: H4[H4.length - 1].c, rows4h: H4, rows1h: H4.slice(-30), fundingPct: 0.01,
    gate: gate7()
  }, opts || {});
}

/* ---------- §1: the bake is committed and the wiring is textual ---------- */
console.log('\n[§1] the bake + the wiring, textual');
{
  const src = read('trendtable.combined.js'), p1 = read('trendtable-src-1.js'),
    p7 = read('trendtable-src-7.js'), p11 = read('trendtable-src-11.js');
  const lab = JSON.parse(read('scripts/trendmx-winrate-lab-results.json'));
  ok(lab.final && lab.final.confirmed === true, 'the bake is committed: lab results carry final.confirmed === true');
  ok(Math.abs(lab.final.all.win - 0.411) < 0.01 && lab.baseline.all.win < 0.29,
    'the measured jump the config stands on: ' + (100 * lab.baseline.all.win).toFixed(1) + '% -> ' + (100 * lab.final.all.win).toFixed(1) + '%');
  ok(lab.final.z >= 3.5 && lab.meta && lab.meta.heldOut === 'W4', 'held-out confirmation window and the z statistic ride the artifact');
  ok(/var TM_LAB_STOP_WIDEN = 1\.25;/.test(src) && /var TM_LAB_STOP_WIDEN = 1\.25;/.test(p1), 'TM_LAB_STOP_WIDEN = 1.25 declared (combined + part)');
  ok(/function tmLabScore\(r\)/.test(src) && /function tmLabDirOf\(r\)/.test(src) && /function tmLabConfig\(r, dir\)/.test(src) && /function tmLabStopWiden\(plan\)/.test(src),
    'the four helpers are defined');
  ok((src.match(/return tmLabStopWiden\(trendmxApplyCrossLimit\(plan, inp, dir\)\);/g) || []).length === 1
    && (p1.match(/return tmLabStopWiden\(trendmxApplyCrossLimit\(plan, inp, dir\)\);/g) || []).length === 1,
    'the stop widening rides trendmxPlan\'s ONE return seam, exactly once');
  ok(/TM_MIN_RR \/ TM_LAB_STOP_WIDEN/.test(src), 'tmValidSetup judges a widened plan in the bar\'s original risk units');
  ok(/tmLabConfig\(r, \(plan && plan\.dir\) \|\| tmDirOf\(r\)\)/.test(src), 'tmTicketClaim means what the mint means');
  ok((p7.match(/var tmLab = tmLabConfig\(r, dir\);/g) || []).length === 1 && (src.match(/var tmLab = tmLabConfig\(r, dir\);/g) || []).length === 1,
    'the mint consults tmLabConfig exactly once (part + combined)');
  ok(/floor: 0, lab: 0 \}, conv: \{/.test(p7) && /heldBy: 'lab', floorWhy: tmLab\.why/.test(p7),
    'held rows are counted under heldWhy.lab and kept with their reason');
  ok(/measured mint config \(4-leg direction/.test(p7) && /removed 4h-cascade leg/.test(p7),
    'the desk disclosure names the hold (never a silent desk)');
  ok(/W\.tmLabConfig = tmLabConfig;/.test(p11) && /W\.tmLabStopWiden = tmLabStopWiden;/.test(p11),
    'the helpers are exported (the replay harness and this guard drive the desk\'s own)');
  /* parts are the combined file (the hg-v1160 parity rule) */
  const combined = src.split('\n').filter(l => l.trim() !== '').join('\n');
  let joined = '';
  for (let i = 0; i < 12; i++) joined += read('trendtable-src-' + i + '.js') + '\n';
  ok(joined.split('\n').filter(l => l.trim() !== '').join('\n') === combined, 'the twelve parts ARE the combined file');
}

/* ---------- §2: clause 1 — the cascade no longer casts a vote ---------- */
console.log('\n[§2] clause 1: tmLabScore / tmLabDirOf');
{
  const W = boot();
  ok(W.tmLabScore({ score: 2, comps: { h4Cascade: 1 } }) === 1, 'score 2 with the cascade FOR it: the majority dies with the leg removed');
  ok(W.tmLabDirOf({ score: 2, comps: { h4Cascade: 1 } }) === null, 'a direction the cascade alone carried mints nothing');
  ok(W.tmLabScore({ score: 2, comps: { h4Cascade: -1 } }) === 3, 'score 2 against the cascade: the four-leg read is 3');
  ok(W.tmLabDirOf({ score: 2, comps: { h4Cascade: -1 } }) === 'long', '... and still mints long');
  ok(W.tmLabDirOf({ score: -2, comps: { h4Cascade: 1 } }) === 'short', 'mirror: -2 with the cascade against strengthens to -3 -> short');
  ok(W.tmLabDirOf({ score: 0, comps: { h4Cascade: 1 } }) === null, 'a bare cascade is no direction');
  ok(W.tmLabDirOf({ dir: 'LONG', score: -5, comps: { h4Cascade: -1 } }) === 'long', 'an explicit dir always wins (tmDirOf\'s own rule)');
  ok(W.tmLabDirOf({ score: 5, comps: { h4Cascade: 0 } }) === 'long' && W.tmLabDirOf({ score: -5, comps: { h4Cascade: 0 } }) === 'short',
    'a cascade at zero changes nothing');
}

/* ---------- §3: clauses 2-3 — the two reads must be explicitly WITH ---------- */
console.log('\n[§3] clauses 2-3: tmLabConfig on crafted rows');
{
  const W = boot();
  const pass = mkRow(W);
  const passCfg = W.tmLabConfig(pass, 'long');
  ok(passCfg.ok === true && passCfg.why.length === 0, 'a trending tape with every leg WITH passes (fixture sanity: ' + JSON.stringify(passCfg) + ')');

  /* clause 1 at the mint level: the direction rests on the removed leg */
  const cascRow = mkRow(W, { score: 2, comps: { d1Trend: 1, d1Cross: 1, h4Cascade: 1, cloud: 0, adxPt: 0 }, freshCross: null });
  const cCfg = W.tmLabConfig(cascRow, 'long');
  ok(cCfg.ok === false && cCfg.why.indexOf('labMajorityMissing') >= 0, 'cascade-carried direction is held, named labMajorityMissing');

  /* clause 2: the ADX leg against -> adxNotWith, and ONLY that */
  const adxRow = mkRow(W, { score: 3, comps: { d1Trend: 1, d1Cross: 1, h4Cascade: 1, cloud: 1, adxPt: -1 }, freshCross: null });
  const aCfg = W.tmLabConfig(adxRow, 'long');
  ok(aCfg.ok === false && aCfg.why.join() === 'adxNotWith', 'ADX leg against names exactly adxNotWith (got ' + aCfg.why.join() + ')');

  /* clause 3: a chop tape -> tqNotWith, and ONLY that */
  const chopRow = mkRow(W, { rows4h: chopTape(60, 14400, 40, 2), rows1h: null });
  const tCfg = W.tmLabConfig(chopRow, 'long');
  ok(tCfg.ok === false && tCfg.why.indexOf('tqNotWith') >= 0, 'a chop tape names tqNotWith (got ' + tCfg.why.join() + ')');

  /* the unread case does NOT abstain — the measured rule, pinned on purpose */
  const thin = mkRow(W, { rows4h: [], rows1h: null, comps: { d1Trend: 1, d1Cross: 1, h4Cascade: 0, cloud: 1, adxPt: 0 }, score: 3, freshCross: null, adx: NaN });
  const thCfg = W.tmLabConfig(thin, 'long');
  ok(thCfg.ok === false && thCfg.why.indexOf('adxNotWith') >= 0 && thCfg.why.indexOf('tqNotWith') >= 0,
    'unread marks hold too — explicitly-WITH is the measured rule, not the floor\'s abstain');
}

/* ---------- §4: clause 4 — the 1.25x stop, targets unmoved, honest bar ---------- */
console.log('\n[§4] clause 4: tmLabStopWiden + tmValidSetup');
{
  const W = boot();
  const p = W.tmLabStopWiden({ entry: 100, stop: 98, t1: 104, t2: 107, riskPct: 2, dir: 'long', note: 'x' });
  ok(p.stop === 97.5, 'long stop widens away from price: 98 -> 97.5');
  ok(p.t1 === 104 && p.t2 === 107, 'targets do not move');
  ok(Math.abs(p.rr1 - 1.6) < 1e-9 && Math.abs(p.rr2 - 2.8) < 1e-9, 'honest multiples: 2R/3.5R of the old risk read 1.6R/2.8R of the widened risk');
  ok(p.tmStopWiden === 1.25 && /stop widened 1\.25x/.test(p.note), 'the widening is marked and named on the plan');
  const s = W.tmLabStopWiden({ entry: 100, stop: 102, t1: 96, dir: 'short' });
  ok(s.stop === 102.5, 'mirror: short stop widens upward 102 -> 102.5');
  ok(W.tmValidSetup(p) === true, 'a widened plan answers to 2R in the ORIGINAL units (1.6R widened) — valid');
  ok(W.tmValidSetup({ entry: 100, stop: 98.5, t1: 102.55 }) === false, 'an unmarked 1.7R plan still fails the 2R bar — the bar is not loosened');
  ok(W.tmLabStopWiden(null) === null && W.tmLabStopWiden({ entry: NaN, stop: 1 }) .stop === 1, 'garbage in passes through untouched (fail-open)');
}

/* ---------- §5: the mint — a passing row mints, a held row is named and recorded ---------- */
console.log('\n[§5] trendmxLimitClasses end to end');
{
  const W = boot();
  const passRow = mkRow(W);
  const out = W.trendmxLimitClasses([passRow]);
  ok(out.clean.length === 1 && out.conv.length === 0, 'the passing fixture mints into the GATE-CLEAN bag');
  const plan = out.clean.length ? out.clean[0].plan : null;
  ok(plan && plan.tmStopWiden === 1.25 && Math.abs(Math.abs(plan.entry - plan.stop) - 5.625) < 0.01,
    'the minted plan carries the widened stop (entry ' + (plan && plan.entry) + ', stop ' + (plan && plan.stop && plan.stop.toFixed(3)) + ')');
  ok(plan && Math.abs(plan.rr1 - 1.6) < 1e-9, 'the minted plan reads an honest 1.6R');

  const held = W.trendmxLimitClasses([mkRow(W, { sym: 'YUSDT', score: 2, comps: { d1Trend: 1, d1Cross: 1, h4Cascade: 1, cloud: 0, adxPt: 0 }, freshCross: null })]);
  ok(held.clean.length === 0 && held.heldWhy.clean.lab === 1, 'a cascade-carried row is held off, counted under heldWhy.clean.lab');
  ok(held.heldWitness.length === 1 && held.heldWitness[0].heldBy === 'lab'
    && Array.isArray(held.heldWitness[0].floorWhy) && held.heldWitness[0].floorWhy.indexOf('labMajorityMissing') >= 0,
    'the held row is KEPT with its plan and its reason — ticket:false measurability, the hg-v1159 shape');

  const html = W.trendmxConvictionDeskHTML([], 1, { flow: 0, mom: 0, vol: 0, fund: 0, postgate: 0, floor: 0, lab: 1 });
  ok(/measured mint config/.test(html), 'an empty desk with a lab-held row SAYS so — never a blank desk');
}

/* ---------- §6: no gate module reads the config (it is the mint, not a hidden lever) ---------- */
console.log('\n[§6] sweep');
{
  for (const gf of ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js', 'hg-setup-core.js', 'setup-stack.js', 'hg-forward.js']){
    const src = read(gf).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    ok(!/tmLabConfig|tmLabDirOf|tmLabScore|tmLabStopWiden|TM_LAB_STOP_WIDEN/.test(src), gf + ': nothing outside the desk reads the config');
  }
}

/* ---------- §7: ship stamps ---------- */
console.log('\n[§7] ship stamps');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  ok(/^hg-v\d+$/.test(HG_VER), 'HG_VER: ' + HG_VER);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches ' + HG_VER);
  const tt = read('trendtable.js');
  ok(new RegExp('\\?v=' + HG_VER.replace(/^hg-v/, '') + '\\b').test(tt), 'trendtable.js loader pin matches');
}

console.log('\n== hg-v1484 TREND MATRIX measured mint config: ' + passed + ' passed, ' + failed + ' failed ==');
process.exit(failed === 0 ? 0 : 1);
