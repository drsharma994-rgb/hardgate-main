#!/usr/bin/env node
/* HARDGATE — behavioural FIRE guard for gold-suite-unified.js. Originally
   shipped at hg-v1271 beside hg-v1271's structural guard
   (tests/test-gold-core-strategies.mjs) to catch silent fire regressions.

   Scope was retracted at hg-v1278 after main's hg-v1272 → v1278 cascade
   (calibrate / add six / confirmation / cross-market / 108/144 Gann /
   participation layer / prior-day+yield) reorganized the id-to-mechanic
   mapping — GS-2 became "COMEX Cash Open ORB", GS-3 "Micro FVG Wick",
   OG-2 "London Fix Auction Drift", OG-3 "Flight-to-Safety Decouple",
   plus new GS-4/5/6, OG-4/5/6/7, PG-4/5/6, GG-4/5/6. The mechanic-
   specific fire sections this guard originally carried depended on
   hg-v1270's mapping and did not survive. Rather than track every
   rename, the fire sections for the renamed/moved mechanics were
   retired — hg-v1271's structural guard tests all current mechanics by
   id and shape and remains the authority for them. What stays here is
   the invariant layer that outlasts any renaming: export shape,
   fail-open on null/empty/thin/junk, forDesk routing, hit() invariants
   (R > 0, correct-side stop, 2.5R target), the "junk kills whole tape"
   rowsOf observable, and the four desks + shell + sw.js wire pins.

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
  assert(gs2[0].name.includes('Cash Open') || gs2[0].name.includes('NY Cash'),
    'GS-2 name says "Cash Open" (hg-v1274 renamed from "NY Cash Initial Balance" to "COMEX Cash Open ORB")');
}

/* ============================================================= */
console.log('== 7) GS-3 (hg-v1274-renamed "Micro FVG Wick") long fires on a bullish FVG tap with a 58% wick ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* Build 22 rows so the FVG scan window [rows.length-16, rows.length-4] contains a 3-bar FVG. */
  /* 12 prior-day pads (indices 0..11) */
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 4 same-day flat bars (indices 12..15, hours 0..3) */
  for (let h = 0; h < 4; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* FVG triplet at indices 16, 17, 18 (hours 4..6):
     rows[18].l > rows[16].h + 0.8 → gap exists at fi=18 inside scan window [6..18]
     gap: lo = rows[16].h = 4001, hi = rows[18].l = 4010 */
  rows.push(bar(day + 4 * 3600, 4000, 4001, 3999, 4001, 100));
  rows.push(bar(day + 5 * 3600, 4001, 4015, 4001, 4014, 300));
  rows.push(bar(day + 6 * 3600, 4014, 4020, 4010, 4018, 300));
  /* two intermediate bars that stay above the gap top (don't close back into it) */
  rows.push(bar(day + 7 * 3600, 4018, 4019, 4015, 4017, 100));
  rows.push(bar(day + 8 * 3600, 4017, 4019, 4015, 4016, 100));
  /* trigger at hour 9 (within [7,10)): tags the gap top (last.l <= 4010), closes above with 58% lower wick */
  rows.push(bar(day + 9 * 3600, 4011, 4013, 4009, 4012.5, 400));
  /* span = 4, lower wick (c - l) = 3.5, 3.5/4 = 0.875 >= 0.58 ✓, last.l <= 4010 ✓, last.c > 4010 ✓, bullish ✓ */
  const hits = S.scalpHits(rows, rows);
  const gs3 = hits.filter(h => h.id === 'GS-3');
  assert(gs3.length >= 1,                   'GS-3 (Micro FVG Wick) fires on the FVG-tap-reclaim tape');
  assert(gs3[0].dir === 'long',             'GS-3 fires LONG direction');
  assert(gs3[0].name.includes('Micro FVG') || gs3[0].name.includes('Volume Imbalance'),
    'GS-3 name says "Micro FVG" (hg-v1274) or "Volume Imbalance" (hg-v1270 fallback)');
}

/* Sections 8-11 (OG-2 Flight-to-Safety fires, OG-3 BPR fires, PG-3 Liquidity Void
   fires, GG-3 Three-Drive fires) retired at hg-v1278 — hg-v1272 → v1278 renamed
   OG-2 to "London Fix Auction Drift" and OG-3 to "Flight-to-Safety Decouple",
   plus added GS-4..6, OG-4..7, PG-4..6, GG-4..6. The retired sections' id-to-
   mechanic mapping is stale. The structural guard test-gold-core-strategies.mjs
   (hg-v1271, 69 assertions after main's expansion) is the mechanic-specific
   authority now; this guard keeps the id-independent invariants below. */

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
