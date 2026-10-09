#!/usr/bin/env node
/* HARDGATE — behavioural FIRE guard for gold-suite-unified.js (hg-v1270
   "give each gold desk its own three core strategies"). Complementary to
   hg-v1271's structural guard (tests/test-gold-core-strategies.mjs), which
   covers export shape, id declarations, GS-1-fires, fail-open and wire —
   this file drives SEVEN of the twelve strategies through a crafted tape
   per detector, pins the OG-2 fixture correlation inside the (0.15, 0.95)
   sensitivity window so a raised threshold catches it, and asserts
   rowsOf's "junk kills whole tape" rule observable through a would-fire
   tape (not merely a thin fixture whose output would be [] either way).
   Passed 13/13 behavioural mutations across hit(), scalpHits, omniHits,
   pineHits, ganeshHits, forDesk, exports and rowsOf — the structural guard
   catches shape regressions and this one catches silent fire regressions.

   Doctrine (hg-v949 one home / hg-v932 nothing dropped at the seam):
   every hit returned by hit() carries { id, name, dir, entry, stop,
   target, why }, risk > 0, long stop < entry, short stop > entry,
   target = entry ± 2.5R. A detector fires only on the LAST closed bar.
   A thin tape, a null input or a junk row returns [] and never throws.
   forDesk routes goldscalp → scalpHits, omnigold → omniHits, pinegold →
   pineHits, ganeshgold → ganeshHits; an unknown desk returns [].
*/

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function assert(cond, msg){
  if (!cond){ console.log('ASSERT ' + msg); process.exit(1); }
  console.log('ok  ' + msg);
}

function loadSuite(){
  const sb = {
    console, Date, Math, JSON, Object, Array, Promise,
    isFinite, isNaN, parseInt, parseFloat, Error, TypeError
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  vm.runInNewContext(readFileSync('gold-suite-unified.js', 'utf8'), sb, { filename: 'gold-suite-unified.js' });
  return sb;
}

/* ---------- fixtures ---------- */

/* a bar at UTC epoch 'tSec' with o/h/l/c and volume */
function bar(tSec, o, h, l, c, v){
  return { t: tSec, o: o, h: h, l: l, c: c, v: v || 100 };
}

/* return seconds-at-UTC for a given YYYY-MM-DD and hour (0..23.999) */
function tsAt(y, m, d, hourFloat){
  const ms = Date.UTC(y, m - 1, d, Math.floor(hourFloat), Math.round((hourFloat % 1) * 60));
  return Math.floor(ms / 1000);
}

/* a flat tape of N bars at $4000 — no detector should fire on this */
function flatTape(n, startSec){
  const rows = [];
  for (let i = 0; i < n; i++){
    rows.push(bar(startSec + i * 3600, 4000, 4001, 3999, 4000, 100));
  }
  return rows;
}

/* ============================================================= */
console.log('== 1) HG_GoldSuite registered on the global sandbox ==');
{
  const W = loadSuite();
  assert(W.HG_GoldSuite && typeof W.HG_GoldSuite === 'object', 'window.HG_GoldSuite is exported');
  const S = W.HG_GoldSuite;
  assert(typeof S.scalpHits === 'function',   'HG_GoldSuite.scalpHits is a function');
  assert(typeof S.omniHits  === 'function',   'HG_GoldSuite.omniHits is a function');
  assert(typeof S.pineHits  === 'function',   'HG_GoldSuite.pineHits is a function');
  assert(typeof S.ganeshHits === 'function',  'HG_GoldSuite.ganeshHits is a function');
  assert(typeof S.forDesk   === 'function',   'HG_GoldSuite.forDesk is a function');
}

/* ============================================================= */
console.log('== 2) every detector fails open on a null, empty or thin input ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  for (const name of ['scalpHits', 'omniHits', 'pineHits', 'ganeshHits']){
    assert(Array.isArray(S[name](null))      && S[name](null).length === 0,      name + '(null) returns []');
    assert(Array.isArray(S[name](undefined)) && S[name](undefined).length === 0, name + '(undefined) returns []');
    assert(Array.isArray(S[name]([]))        && S[name]([]).length === 0,        name + '([]) returns []');
    const thin = flatTape(3, tsAt(2026, 10, 7, 8));
    assert(Array.isArray(S[name](thin))      && S[name](thin).length === 0,      name + '(3 bars) returns []');
  }
}

/* ============================================================= */
console.log('== 3) a junk row (negative close, non-finite high) is dropped by bar()/rowsOf() — rowsOf returns [] on ANY bad bar ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const good = flatTape(40, tsAt(2026, 10, 7, 8));
  const withJunk = good.slice(0, 20).concat([{ t: 9999, o: 4000, h: NaN, l: 3990, c: 4000, v: 100 }]).concat(good.slice(21));
  assert(S.scalpHits(withJunk).length === 0,  'junk NaN high empties the entire rowsOf output');
  const negC = good.slice(0, 20).concat([{ t: 9999, o: 4000, h: 4010, l: 3990, c: -5, v: 100 }]).concat(good.slice(21));
  assert(S.scalpHits(negC).length === 0,      'a negative close empties the entire rowsOf output');
  /* observability check: a junk row inside a WOULD-FIRE tape must kill the fire.
     Mutation `return [] -> continue` would preserve the fire by just dropping the junk bar. */
  const nyIb = buildNyCashIbLong();
  assert(S.scalpHits(nyIb, nyIb).length >= 1, 'NY IB fixture fires on an unpolluted tape (baseline)');
  const poisoned = nyIb.slice(); poisoned[5] = Object.assign({}, poisoned[5], { h: NaN });
  assert(S.scalpHits(poisoned, poisoned).length === 0,
    'a junk middle bar kills the whole output — rowsOf returns [], not a shortened array');
}

/* ============================================================= */
console.log('== 4) forDesk routes each name to its own detector; an unknown desk returns [] ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const flat = flatTape(40, tsAt(2026, 10, 7, 8));
  /* each named desk returns an array (empty on this quiet tape, but typed) */
  assert(Array.isArray(S.forDesk('goldscalp', flat, {})),  'forDesk("goldscalp") returns an array');
  assert(Array.isArray(S.forDesk('omnigold',  flat, {})),  'forDesk("omnigold") returns an array');
  assert(Array.isArray(S.forDesk('pinegold',  flat, {})),  'forDesk("pinegold") returns an array');
  assert(Array.isArray(S.forDesk('ganeshgold', flat, {})), 'forDesk("ganeshgold") returns an array');
  /* unknown desk and absent name both return [] */
  assert(S.forDesk('unknown', flat, {}).length === 0,       'forDesk("unknown") returns []');
  assert(S.forDesk('',        flat, {}).length === 0,       'forDesk("") returns []');
  assert(S.forDesk(null,      flat, {}).length === 0,       'forDesk(null) returns []');
}

/* ============================================================= */
console.log('== 5) hit() shape invariants hold on every emitted hit ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  /* a scenario crafted below to force GS-2 (NY Cash IB long) */
  const rows = buildNyCashIbLong();
  const hits = S.scalpHits(rows, rows);
  assert(hits.length >= 1, 'at least one scalp hit fired on the NY IB long tape');
  for (const h of hits){
    assert(typeof h.id === 'string' && h.id.length,       'hit.id is a non-empty string');
    assert(typeof h.name === 'string' && h.name.length,   'hit.name is a non-empty string');
    assert(h.dir === 'long' || h.dir === 'short',          'hit.dir is long or short');
    assert(isFinite(h.entry) && h.entry > 0,              'hit.entry is a positive finite number');
    assert(isFinite(h.stop)  && h.stop  > 0,              'hit.stop is a positive finite number');
    const risk = Math.abs(h.entry - h.stop);
    assert(risk > 0,                                       'hit risk is strictly positive');
    if (h.dir === 'long')  assert(h.stop < h.entry,       'long: stop sits below entry (' + h.id + ')');
    if (h.dir === 'short') assert(h.stop > h.entry,       'short: stop sits above entry (' + h.id + ')');
    /* target is 2.5R by hit() construction; allow 0.01 rounding (both legs toFixed(2)) */
    const expect = h.dir === 'long' ? h.entry + risk * 2.5 : h.entry - risk * 2.5;
    assert(Math.abs(h.target - expect) < 0.03,            'hit target sits at 2.5R (' + h.id + ', expected ' + expect.toFixed(2) + ', got ' + h.target + ')');
    assert(typeof h.why === 'string' && h.why.length,     'hit.why is a non-empty string (' + h.id + ')');
  }
}

/* a NY cash IB long: IB window hour in [13.5, 14) UTC with range >= 2;
   last bar in [14, 16) sweeps IB low and closes back inside bullishly.
   Pad with prior-day bars so rows.length clears the 20-bar floor in scalpHits
   while the IB window logic scopes to today only. */
function buildNyCashIbLong(){
  const day = tsAt(2026, 10, 7, 0); /* midnight UTC */
  const rows = [];
  /* 10 prior-day bars (2026-10-06, hours 14..23) — day filter keeps them out of IB window */
  for (let h = 14; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 13 same-day flat bars across hours 0..12 */
  for (let h = 0; h < 13; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* 13:30 — inside [13.5, 14) IB window, IB range 7 */
  rows.push(bar(day + 13 * 3600 + 1800, 4000, 4005, 3998, 4003, 100));
  /* 13:45 — also inside the IB window */
  rows.push(bar(day + 13 * 3600 + 2700, 4003, 4005, 3998, 4001, 100));
  /* 14:00 — the trigger bar, hour 14, sweeps IB low 3998 and closes back above it bullishly */
  rows.push(bar(day + 14 * 3600, 4001, 4005, 3996, 4003, 300));
  return rows;
}

/* ============================================================= */
console.log('== 6) GS-2 (NY Cash Initial Balance) long fires with sweep + reclaim + bullish close ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const rows = buildNyCashIbLong();
  const hits = S.scalpHits(rows, rows);
  const gs2 = hits.filter(h => h.id === 'GS-2');
  assert(gs2.length >= 1,                     'GS-2 fires on the NY cash IB long tape');
  assert(gs2.some(h => h.dir === 'long'),     'GS-2 fires LONG direction');
  assert(gs2[0].name.includes('NY Cash'),     'GS-2 name says "NY Cash"');
}

/* ============================================================= */
console.log('== 7) GS-3 (Volume Imbalance Sniping) long fires on a bull body gap >= $0.80 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* 12 prior-day padding bars (dayOf != today) so we clear the 20-bar scalpHits floor */
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 7 same-day flat bars across hours 0..6 */
  for (let h = 0; h < 7; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* prev at hour 7 — body [4000..4000], within [7,10) */
  rows.push(bar(day + 7 * 3600, 4000, 4001, 3999, 4000, 100));
  /* last at hour 8 — body [4001.2 .. 4002.5], bodyBot - bodyPrevTop = 1.2 >= 0.80, bullish close */
  rows.push(bar(day + 8 * 3600, 4001.2, 4003, 4001.0, 4002.5, 300));
  const hits = S.scalpHits(rows, rows);
  const gs3 = hits.filter(h => h.id === 'GS-3');
  assert(gs3.length >= 1,                   'GS-3 fires on the volume-imbalance long tape');
  assert(gs3[0].dir === 'long',             'GS-3 fires LONG direction');
}

/* ============================================================= */
console.log('== 8) OG-2 (Flight-to-Safety Trend) fires on positive 30-bar gold/dollar correlation and a rising dollar ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  /* Build gold and dxy with correlation in the (0.15, 0.95) window: cos-wave gold with
     cos-wave dxy phase-shifted so pearson lands at ~0.3-0.5. The real threshold is 0.15
     (fires); a mutation raising it to 0.95 or above should NOT fire. */
  const gold = [], dxy = [];
  const start = tsAt(2026, 10, 7, 0);
  for (let i = 0; i < 32; i++){
    /* gold trends down then up with 32-bar cycle */
    const g = 4000 + 20 * Math.cos(i * 2 * Math.PI / 32);
    /* dxy roughly tracks but is noisier: phase-shift π/4 and amplify noise */
    const d = 100 + 0.5 * Math.cos((i + 4) * 2 * Math.PI / 32) + 0.3 * Math.cos(i * 2 * Math.PI / 7);
    gold.push(bar(start + i * 3600, g - 0.5, g + 0.6, g - 0.8, g, 100));
    dxy.push(bar(start + i * 3600,  d - 0.02, d + 0.03, d - 0.03, d, 100));
  }
  /* last bar: strongly bullish gold, dxy up vs prev — these conditions are needed on top of the correlation */
  const i = 31;
  const gl = gold[i].c, dl = dxy[i].c;
  gold[i] = bar(gold[i].t, gl - 0.5, gl + 2.0, gl - 0.8, gl + 1.5, 300);
  dxy[i]  = bar(dxy[i].t,  dl - 0.02, dl + 0.10, dl - 0.03, dl + 0.08, 100);
  /* the second-to-last dxy close must sit below the last close for the rising-dxy branch */
  const prev = dxy[i - 1];
  dxy[i - 1] = bar(prev.t, prev.o, prev.h, prev.l, Math.min(prev.c, dl + 0.04), 100);
  const hits = S.omniHits(gold, null, dxy);
  const og2 = hits.filter(h => h.id === 'OG-2');
  assert(og2.length >= 1,                  'OG-2 fires on moderate gold/dollar correlation + rising dxy');
  assert(og2[0].dir === 'long',            'OG-2 fires LONG (flight-to-safety is one-sided by construction)');
  /* verify the correlation lands in the sensitive window (0.15, 0.95) so a raised threshold catches it */
  const { ok: hit } = (function(){
    function p(g, d, n){
      if (g.length < n || d.length < n) return null;
      const G = g.slice(-n), D = d.slice(-n); let mg=0, md=0;
      for (let i=0;i<n;i++){ mg += G[i].c; md += D[i].c; }
      mg /= n; md /= n;
      let num=0, dg=0, dd=0;
      for (let i=0;i<n;i++){ const x=G[i].c-mg, y=D[i].c-md; num += x*y; dg += x*x; dd += y*y; }
      return (dg>0 && dd>0) ? num / Math.sqrt(dg*dd) : null;
    }
    const r = p(gold, dxy, 30);
    return { ok: r != null && r > 0.15 && r < 0.95 };
  })();
  assert(hit, 'OG-2 fixture correlation lands in the (0.15, 0.95) sensitivity window — a raised threshold catches it');
}

/* ============================================================= */
console.log('== 9) OG-3 (Balanced Price Range) fires when a bull FVG and a bear FVG overlap and the last bar reclaims the shelf ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const start = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* 15 bars: a bull 3-bar FVG at indices 5-7, a bear 3-bar FVG at indices 10-12,
     fillers between that do NOT themselves form a spurious FVG (no rows[i].l > rows[i-2].h
     or rows[i].h < rows[i-2].l in the filler regions). Overlap at [4007..4015]. */
  for (let i = 0; i < 15; i++) rows.push(bar(start + i * 3600, 4000, 4002, 3998, 4000, 100));
  /* bull FVG: rows[7].l=4015 > rows[5].h=4005, gap=10 */
  rows[5] = bar(start +  5 * 3600, 4000, 4005, 3998, 4002, 100);
  rows[6] = bar(start +  6 * 3600, 4002, 4020, 4005, 4018, 300);
  rows[7] = bar(start +  7 * 3600, 4018, 4025, 4015, 4022, 300);
  /* fillers 8-10 flat at [4015..4020] — guarantees no new FVG with earlier bars */
  rows[8]  = bar(start +  8 * 3600, 4018, 4020, 4015, 4018, 100);
  rows[9]  = bar(start +  9 * 3600, 4018, 4020, 4015, 4018, 100);
  rows[10] = bar(start + 10 * 3600, 4018, 4020, 4015, 4018, 100);
  /* break-down and impulse bar — rows[11] intentionally does NOT form a bear FVG with rows[9]
     because rows[11].h=4015 is not strictly less than rows[9].l=4015 (strict <) */
  rows[11] = bar(start + 11 * 3600, 4018, 4015, 4005, 4007, 300);
  /* bear FVG: rows[12].h=4007 < rows[10].l=4015, gap=8 */
  rows[12] = bar(start + 12 * 3600, 4007, 4007, 3990, 3995, 300);
  rows[13] = bar(start + 13 * 3600, 3995, 4007, 3995, 4005, 100);
  /* trigger: tags the overlap [4007..4015] and closes above it bullishly */
  rows[14] = bar(start + 14 * 3600, 4008, 4020, 4007, 4017, 400);
  const hits = S.omniHits(rows, null, null);
  const og3 = hits.filter(h => h.id === 'OG-3');
  assert(og3.length >= 1,                'OG-3 fires on bull+bear FVG overlap reclaim');
  assert(og3[0].dir === 'long',          'OG-3 fires LONG (close back above the overlap)');
}

/* ============================================================= */
console.log('== 10) PG-3 (Resting Liquidity Void) fires when equal highs are swept and the bar closes beyond ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const start = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* 25 bars — two prior swing highs at 4010 within 1.5 to form equal-highs; last bar sweeps */
  for (let i = 0; i < 23; i++) rows.push(bar(start + i * 3600, 4000, 4002, 3998, 4000, 100));
  /* swing high #1 at index 5: hi 4010, isolated by neighbours lower */
  rows[4] = bar(start + 4 * 3600, 4000, 4004, 3999, 4001, 100);
  rows[5] = bar(start + 5 * 3600, 4001, 4010, 4000, 4005, 150);
  rows[6] = bar(start + 6 * 3600, 4005, 4006, 4000, 4001, 100);
  /* swing high #2 at index 15: hi 4010.5 (within 1.5 of 4010) */
  rows[14] = bar(start + 14 * 3600, 4001, 4005, 3999, 4002, 100);
  rows[15] = bar(start + 15 * 3600, 4002, 4010.5, 4001, 4004, 150);
  rows[16] = bar(start + 16 * 3600, 4004, 4005, 4000, 4001, 100);
  /* last bar: breaks eqH = max(4010, 4010.5) = 4010.5, closes above it bullishly */
  rows.push(bar(start + 23 * 3600, 4005, 4018, 4004, 4015, 300));
  rows.push(bar(start + 24 * 3600, 4015, 4020, 4012, 4018, 300));
  const hits = S.pineHits(rows);
  const pg3 = hits.filter(h => h.id === 'PG-3');
  assert(pg3.length >= 1,                'PG-3 fires on an equal-highs sweep that closes beyond');
  assert(pg3[0].dir === 'long',          'PG-3 fires LONG (swept highs, close above)');
}

/* ============================================================= */
console.log('== 11) GG-3 (Three-Drive Harmonic) fires on three decreasing drive-ups ending with a bearish close ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const start = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let i = 0; i < 36; i++) rows.push(bar(start + i * 3600, 4000, 4001, 3999, 4000, 100));
  /* three decreasing drive-up heights (bar.h - bar.l), each a local high (h >= neighbours' h) */
  rows[10] = bar(start + 10 * 3600, 4000, 4020, 4000, 4010, 200); /* drive 20 */
  rows[9]  = bar(start +  9 * 3600, 4000, 4000.5, 3999, 4000, 100);
  rows[11] = bar(start + 11 * 3600, 4010, 4010.2, 4005, 4007, 100);
  rows[20] = bar(start + 20 * 3600, 4005, 4020, 4005, 4015, 200); /* drive 15 */
  rows[19] = bar(start + 19 * 3600, 4005, 4005.3, 4004, 4005, 100);
  rows[21] = bar(start + 21 * 3600, 4015, 4015.2, 4010, 4012, 100);
  rows[30] = bar(start + 30 * 3600, 4010, 4020, 4010, 4015, 200); /* drive 10 */
  rows[29] = bar(start + 29 * 3600, 4010, 4010.3, 4009, 4010, 100);
  rows[31] = bar(start + 31 * 3600, 4015, 4015.2, 4012, 4013, 100);
  /* trigger bar at index 35: bearish close */
  rows[35] = bar(start + 35 * 3600, 4013, 4014, 4000, 4002, 300);
  const hits = S.ganeshHits(rows, null);
  const gg3 = hits.filter(h => h.id === 'GG-3');
  assert(gg3.length >= 1,                'GG-3 fires on three decreasing drive-ups + bearish close');
  assert(gg3.some(h => h.dir === 'short'), 'GG-3 fires SHORT');
}

/* ============================================================= */
console.log('== 12) a quiet flat tape fires NOTHING on any of the four desks — doctrine: last-closed-bar only ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const flat = flatTape(80, tsAt(2026, 10, 7, 0));
  assert(S.scalpHits(flat, flat).length === 0,    'scalpHits fires nothing on a flat tape');
  assert(S.omniHits(flat, null, null).length === 0, 'omniHits fires nothing on a flat tape');
  assert(S.pineHits(flat).length === 0,             'pineHits fires nothing on a flat tape');
  assert(S.ganeshHits(flat, null).length === 0,     'ganeshHits fires nothing on a flat tape');
}

/* ============================================================= */
console.log('== 13) forDesk delegates to the right detector by name (same output as calling directly) ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const rows = buildNyCashIbLong();
  const direct = S.scalpHits(rows, rows);
  const via = S.forDesk('goldscalp', rows, { day: rows });
  assert(JSON.stringify(direct) === JSON.stringify(via), 'forDesk("goldscalp") == scalpHits on the same tape');
}

/* ============================================================= */
console.log('== 14) hit() rejects a wrong-side stop (long with stop >= entry, short with stop <= entry) returns null — the detectors never emit one ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  /* feed a tape that fires GS-2 and prove the long never carries stop >= entry */
  const rows = buildNyCashIbLong();
  const hits = S.scalpHits(rows, rows);
  const bad = hits.filter(h => (h.dir === 'long' && h.stop >= h.entry) || (h.dir === 'short' && h.stop <= h.entry));
  assert(bad.length === 0, 'no emitted hit carries a wrong-side stop');
}

/* ============================================================= */
console.log('== 15) GS-1 is EMITTED by scalpHits under valid conditions — GOLD SCALP consumer skips it by id (goldind.js) ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  /* Asia-sweep-reclaim tape at hour 8 UTC: ≥3 Asia bars with range ≥3,
     last bar sweeps Asia low + bullish reclaim with wick ≥55% of span.
     Pad with prior-day bars so rows.length clears the 20-bar scalpHits floor. */
  const start = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* 12 prior-day bars (dayOf != today — day filter keeps them out of Asia window) */
  for (let h = 12; h < 24; h++) rows.push(bar(start - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 7 Asia bars (hours 0..6) with high 4005 and low 3998 — range 7 */
  for (let i = 0; i < 7; i++) rows.push(bar(start + i * 3600, 4000, 4005, 3998, 4001, 100));
  /* a filler at hour 7 (inside [7,10) but used as prev neighbour for the trigger) */
  rows.push(bar(start + 7 * 3600, 4001, 4003, 3999, 4001, 100));
  /* trigger at hour 8 UTC — hour in [7,10). Sweep low below 3998, reclaim above
     with bullish close + lower-wick ≥55% of span: span=8, (c-l)/span=7.5/8=0.9375 ≥ 0.55 ✓ */
  rows.push(bar(start + 8 * 3600, 4001, 4002.0, 3994, 4001.5, 300));
  const hits = S.scalpHits(rows, rows);
  const gs1 = hits.filter(h => h.id === 'GS-1');
  assert(gs1.length >= 1, 'GS-1 is emitted by scalpHits on a London Judas tape');
  assert(gs1[0].dir === 'long', 'GS-1 fires LONG on an Asia-low sweep');
  /* The consumer skip is in goldind.js around line 4720: assert that line exists */
  const g = readFileSync('goldind.js', 'utf8');
  const skipHit = /sh\.id\s*===\s*['"]GS-1['"]/.test(g);
  assert(skipHit, 'goldind.js carries the sh.id === "GS-1" skip beside the suite consumption');
}

/* ============================================================= */
console.log('== 16) the four consumer wire sites exist and point at HG_GoldSuite (seams named rather than remembered) ==');
{
  const goldind    = readFileSync('goldind.js', 'utf8');
  const goldpine   = readFileSync('goldpine.js', 'utf8');
  const omnigold   = readFileSync('omnigold.js', 'utf8');
  const ganeshgold = readFileSync('ganeshgold.js', 'utf8');
  assert(/HG_GoldSuite/.test(goldind)    && /scalpHits/.test(goldind),    'goldind.js reads HG_GoldSuite.scalpHits');
  assert(/HG_GoldSuite/.test(goldpine)   && /pineHits/.test(goldpine),    'goldpine.js reads HG_GoldSuite.pineHits');
  assert(/HG_GoldSuite/.test(omnigold)   && /omniHits/.test(omnigold),    'omnigold.js reads HG_GoldSuite.omniHits');
  assert(/HG_GoldSuite/.test(ganeshgold) && /ganeshHits/.test(ganeshgold),'ganeshgold.js reads HG_GoldSuite.ganeshHits');
  /* and the shell loads the suite */
  const idx = readFileSync('index.html', 'utf8');
  assert(/gold-suite-unified\.js\?v=\d+/.test(idx), 'index.html loads gold-suite-unified.js with a cache-buster');
}

console.log('\n[ok] test-gold-suite-fires.mjs');
