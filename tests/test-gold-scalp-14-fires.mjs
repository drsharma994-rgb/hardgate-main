#!/usr/bin/env node
/* HARDGATE — behavioural fire guard for the fourteen GOLD SCALP detectors
   shipped on main's gold-suite-unified.js between hg-v1270 (initial three)
   and hg-v1285 (the current ceiling as of this file).

   Audit map:
     GS-1  London Judas Asian Sweep        hour [7,10)   Asia range swept, 1.5-5.5 depth, 55% wick, PACE OK
     GS-2  COMEX Cash Open ORB             hour [13.75, 14.25]   13:30-13:45 ORB sweep + reclaim
     GS-3  Micro FVG Wick                  hour [7,10) U [12.5,16)   FVG tap + 58% wick
     GS-4  London-NY Overlap Sweep         hour [12, 13.5)   London range swept, 65% wick
     GS-5  Dual Asia Boundary              hour [7,10)   earlier bar took one side, trigger takes the other
     GS-6  Prior Day Raid                  hour [7,10) U [13.75,16)   PDH/PDL swept 1.5-5.5, 55% wick
     GS-7  Round Ten Raid                  same windows as GS-6   $10 level swept 1-4
     GS-8  Frankfurt Book Close            hour [9.25, 9.75]   1.5*ATR run from 06:00 open
     GS-9  London PM Fix                   hour [15.08, 15.5]   1.2*ATR run from 15:00 open
     GS-10 COMEX Settlement Pin            hour [18.25, 18.5]   $5 strike run 3-5.5
     GS-11 Tokyo Compression               hour [3, 4.5]   Asian range <=$6.50, break with close out
     GS-12 London AM Fix Hunt              hour [12, 14)   $1 run past 10:30 open, close back
     GS-13 London Opening Void             hour [7, 8)   07:00 bar >=2*ATR with <=8% opposing wick
     GS-14 News Exhaustion                 hour [12.5, 12.75) U [13.5, 13.75)   requires pack.newsRelease=true

   All sweep detectors (GS-1/2/4/5/6/7/8/9/10/12/13/14) carry the hg-v1276
   participation layer: pace = trigger volume over median of last 20 readable
   bars. pace < PACE_DEAD (0.5) withholds. Null pace fails open. GS-3 (FVG
   wick) and GS-11 (compression) do not read pace.

   Doctrine (hg-v949 one home / hg-v966 no unmeasured gate): fire guards
   catch silent regressions where a mechanic was renamed, moved, broken,
   or where its id-to-fire-condition mapping drifted. The hg-v1271
   structural guard (test-gold-core-strategies.mjs) checks id presence
   and hit() shape; this guard asserts each id fires on its intended
   mechanic.
*/

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let okCount = 0;
function assert(cond, msg){
  if (!cond){ console.log('ASSERT ' + msg); process.exit(1); }
  console.log('ok  ' + msg); okCount++;
}

function loadSuite(){
  const sb = { console, Date, Math, JSON, Object, Array, Promise,
    isFinite, isNaN, parseInt, parseFloat, Error, TypeError };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  vm.runInNewContext(readFileSync('gold-suite-unified.js', 'utf8'), sb, { filename: 'gold-suite-unified.js' });
  return sb;
}

function bar(tSec, o, h, l, c, v){
  return { t: tSec, o: o, h: h, l: l, c: c, v: v || 100 };
}

function tsAt(y, m, d, hourFloat){
  const ms = Date.UTC(y, m - 1, d, Math.floor(hourFloat), Math.round((hourFloat % 1) * 60));
  return Math.floor(ms / 1000);
}

/* ============================================================= */
console.log('== 1) GS-1 London Judas fires LONG on an Asia-low sweep with 1.5-5.5 depth + 55% wick + PACE OK ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 7 Asia bars: hi=4005, lo=3998 (range 7) */
  for (let i = 0; i < 7; i++) rows.push(bar(day + i * 3600, 4000, 4005, 3998, 4001, 100));
  rows.push(bar(day + 7 * 3600, 4001, 4003, 3999, 4001, 100));
  /* trigger at hour 8: sweep Asia low by 3 dollars (3995), reclaim with 94% wick */
  rows.push(bar(day + 8 * 3600, 4001, 4002, 3995, 4001.5, 300));
  const hits = S.scalpHits(rows, rows);
  const gs1 = hits.filter(h => h.id === 'GS-1');
  assert(gs1.length >= 1,      'GS-1 fires on the London Judas tape');
  assert(gs1[0].dir === 'long', 'GS-1 fires LONG');
  assert(isFinite(gs1[0].entry) && isFinite(gs1[0].stop) && isFinite(gs1[0].target), 'GS-1 shape is finite');
}

/* ============================================================= */
console.log('== 2) GS-2 COMEX Cash Open ORB fires LONG on 13:30 ORB low sweep + reclaim at hour 14 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  for (let h = 0; h < 13; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* ORB bar at 13:30-13:45: hour 13.5, range 4000..3996 */
  rows.push(bar(day + 13 * 3600 + 1800, 4000, 4000, 3996, 3998, 100));
  /* filler at 13:45 */
  rows.push(bar(day + 13 * 3600 + 2700, 3998, 3999, 3996, 3997, 100));
  /* trigger at 14:00: sweeps ORB low 3996 then closes back above bullish */
  rows.push(bar(day + 14 * 3600, 3997, 4000, 3994, 3998, 300));
  const hits = S.scalpHits(rows, rows);
  const gs2 = hits.filter(h => h.id === 'GS-2');
  assert(gs2.length >= 1,       'GS-2 fires on the COMEX cash-open ORB tape');
  assert(gs2[0].dir === 'long',  'GS-2 fires LONG');
}

/* ============================================================= */
console.log('== 3) GS-3 Micro FVG Wick fires LONG on a 3-bar bull FVG tap + 58% wick ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* 22 bars: 12 prior-day pads, 4 same-day flat, 3-bar FVG at [16..18], 2 intermediate, trigger at hour 9 */
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  for (let h = 0; h < 4; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  rows.push(bar(day + 4 * 3600, 4000, 4001, 3999, 4001, 100));
  rows.push(bar(day + 5 * 3600, 4001, 4015, 4001, 4014, 300));
  rows.push(bar(day + 6 * 3600, 4014, 4020, 4010, 4018, 300));
  rows.push(bar(day + 7 * 3600, 4018, 4019, 4015, 4017, 100));
  rows.push(bar(day + 8 * 3600, 4017, 4019, 4015, 4016, 100));
  rows.push(bar(day + 9 * 3600, 4011, 4013, 4009, 4012.5, 400));
  const hits = S.scalpHits(rows, rows);
  const gs3 = hits.filter(h => h.id === 'GS-3');
  assert(gs3.length >= 1,       'GS-3 fires on the Micro FVG tap tape');
  assert(gs3[0].dir === 'long',  'GS-3 fires LONG');
}

/* ============================================================= */
console.log('== 4) GS-4 London-NY Overlap Sweep fires LONG on London low sweep at hour 13 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 7 pre-London bars (hours 0..6) */
  for (let h = 0; h < 7; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* London session hours 7..11: range 3998..4005 */
  for (let h = 7; h < 12; h++) rows.push(bar(day + h * 3600, 4001, 4005, 3998, 4002, 100));
  /* trigger at hour 13 (within [12, 13.5)): sweeps London low 3998, closes back with 65% wick */
  rows.push(bar(day + 13 * 3600, 4001, 4002, 3994, 4001.5, 300));
  const hits = S.scalpHits(rows, rows);
  const gs4 = hits.filter(h => h.id === 'GS-4');
  assert(gs4.length >= 1,       'GS-4 fires on the London-NY Overlap Sweep tape');
  assert(gs4[0].dir === 'long',  'GS-4 fires LONG');
}

/* ============================================================= */
console.log('== 5) GS-5 Dual Asia Boundary fires LONG when an earlier bar took the Asia high and the trigger takes the low ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* Asia session 0..6: hi=4005, lo=3998 */
  for (let i = 0; i < 7; i++) rows.push(bar(day + i * 3600, 4000, 4005, 3998, 4001, 100));
  /* earlier bar at hour 7 that TOOK the Asia high (hi > 4005) */
  rows.push(bar(day + 7 * 3600, 4001, 4010, 3999, 4003, 150));
  /* trigger at hour 8: takes Asia low 3998, closes back above with BULLISH body (c > o) */
  rows.push(bar(day + 8 * 3600, 3998, 4004, 3996, 4001, 300));
  const hits = S.scalpHits(rows, rows);
  const gs5 = hits.filter(h => h.id === 'GS-5');
  assert(gs5.length >= 1,       'GS-5 fires on the dual boundary tape');
  assert(gs5[0].dir === 'long',  'GS-5 fires LONG');
}

/* ============================================================= */
console.log('== 6) GS-6 Prior Day Raid fires LONG when prior-day low is swept 1.5-5.5 dollars at hour 14 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const yday = tsAt(2026, 10, 6, 0);
  const day  = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* prior day: 24 bars with hi=4010, lo=3990 */
  for (let h = 0; h < 24; h++) rows.push(bar(yday + h * 3600, 4000, 4010, 3990, 4005, 100));
  /* today's Asia 0..6 with range NOT overlapping prior-day low (prevents sameAsiaL guard from firing) */
  for (let h = 0; h < 7; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  for (let h = 7; h < 14; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* trigger at hour 14 (within [13.75,16)): sweeps prior-day low 3990 by 3 dollars, closes back above with 55% wick */
  rows.push(bar(day + 14 * 3600, 3998, 4000, 3987, 3998.5, 300));
  const hits = S.scalpHits(rows, rows);
  const gs6 = hits.filter(h => h.id === 'GS-6');
  assert(gs6.length >= 1,       'GS-6 fires on the prior-day raid tape');
  assert(gs6[0].dir === 'long',  'GS-6 fires LONG');
}

/* ============================================================= */
console.log('== 7) GS-7 Round Ten Raid fires LONG on a $10 level sweep 1-4 dollars at hour 8 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const yday = tsAt(2026, 10, 6, 0);
  const day  = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* prior day far from the round-ten level */
  for (let h = 0; h < 24; h++) rows.push(bar(yday + h * 3600, 3950, 3955, 3945, 3950, 100));
  /* today's early bars at 4005 (near 4010 but prior-day high was 3955 so no "nearL" overlap) */
  for (let h = 0; h < 7; h++) rows.push(bar(day + h * 3600, 4003, 4005, 4002, 4004, 100));
  /* trigger at hour 8 (within [7,10)): sweeps $10 level (under = floor((4005.5-0.01)/10)*10 = 4000) by 3 dollars, reclaims above with 55% wick */
  /* But hour 8 is in [7,10). GS-7 window check at line 230: ((hour >= 7 && hour < 10) || (hour >= 13.75 && hour < 16)). So hour 8 works. */
  rows.push(bar(day + 8 * 3600, 4001, 4003, 3997, 4001.5, 300));
  const hits = S.scalpHits(rows, rows);
  const gs7 = hits.filter(h => h.id === 'GS-7');
  assert(gs7.length >= 1,       'GS-7 fires on the round-ten raid tape');
  assert(gs7[0].dir === 'long',  'GS-7 fires LONG');
}

/* ============================================================= */
console.log('== 8) GS-8 Frankfurt Book Close fires LONG on a 1.5x ATR run below the 06:00 open at hour 9.5 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 06:00 bar (hour 6) with open at 4000 */
  for (let h = 0; h < 6; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  rows.push(bar(day + 6 * 3600, 4000, 4001, 3999, 4000, 150)); /* 06:00 open = 4000 */
  /* bars 7..9 drift down */
  for (let h = 7; h < 9; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3990, 3995, 100));
  /* ATR on this tape is small (~2), so 1.5*ATR ~= 3. Need |last.c - 4000| >= ~3 and last.c < open AND bullish body */
  /* trigger at hour 9.5 (within [9.25, 9.75]): close 3990 (well below 4000), bullish body (c > o) → mean-revert long */
  rows.push(bar(day + 9 * 3600 + 1800, 3985, 3993, 3985, 3990, 300));
  const hits = S.scalpHits(rows, rows);
  const gs8 = hits.filter(h => h.id === 'GS-8');
  assert(gs8.length >= 1,       'GS-8 fires on the Frankfurt book-close tape');
  assert(gs8[0].dir === 'long',  'GS-8 fires LONG');
}

/* ============================================================= */
console.log('== 9) GS-9 London PM Fix fires LONG on a 1.2x ATR run below the 15:00 open at hour 15.25 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  for (let h = 0; h < 15; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* 15:00 bar with open at 4000 */
  rows.push(bar(day + 15 * 3600, 4000, 4001, 3999, 4000, 150));
  /* trigger at 15:15 (within [15.08, 15.5]): close well below 4000, bullish body */
  rows.push(bar(day + 15 * 3600 + 900, 3985, 3993, 3985, 3990, 300));
  const hits = S.scalpHits(rows, rows);
  const gs9 = hits.filter(h => h.id === 'GS-9');
  assert(gs9.length >= 1,       'GS-9 fires on the London PM fix tape');
  assert(gs9[0].dir === 'long',  'GS-9 fires LONG');
}

/* ============================================================= */
console.log('== 10) GS-10 COMEX Settlement Pin fires LONG at 18:15 when the bar ran $3-5.5 below the nearest $5 strike ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  for (let h = 0; h < 18; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* trigger at 18:15 (within [18.25, 18.5]): open at 4000 (strike = round(4000/5)*5 = 4000), low 3996 (dnExt = 4 within [3, 5.5]), close 4001 > strike bullish */
  rows.push(bar(day + 18 * 3600 + 900, 4000, 4002, 3996, 4001, 300));
  const hits = S.scalpHits(rows, rows);
  const gs10 = hits.filter(h => h.id === 'GS-10');
  assert(gs10.length >= 1,      'GS-10 fires on the COMEX settlement pin tape');
  assert(gs10[0].dir === 'long', 'GS-10 fires LONG');
}

/* ============================================================= */
console.log('== 11) GS-11 Tokyo Compression fires LONG at hour 4 when the Asia range so far is <= $6.50 and the bar breaks above ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  /* 20 prior-day pads so rows.length clears the 20-bar scalpHits floor */
  for (let h = 4; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 4 Asia bars (hours 0..3) within $4 range */
  for (let h = 0; h < 4; h++) rows.push(bar(day + h * 3600, 4000, 4002, 3998, 4001, 100));
  /* trigger at hour 4 (within [3, 4.5]): closes above tHi=4002 bullish */
  rows.push(bar(day + 4 * 3600, 4001, 4010, 4001, 4008, 300));
  const hits = S.scalpHits(rows, rows);
  const gs11 = hits.filter(h => h.id === 'GS-11');
  assert(gs11.length >= 1,      'GS-11 fires on the Tokyo compression tape');
  assert(gs11[0].dir === 'long', 'GS-11 fires LONG');
}

/* ============================================================= */
console.log('== 12) GS-12 London AM Fix Hunt fires LONG when price ran $1 below the 10:30 open and closed back above at hour 13 ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  for (let h = 0; h < 10; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* 10:30 bar (hour 10.5) with open at 4000 */
  rows.push(bar(day + 10 * 3600 + 1800, 4000, 4001, 3999, 4000, 150));
  /* filler bars until trigger */
  for (let h = 11; h < 13; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* trigger at hour 13 (within [12, 14)): ran $1 under 4000, closes back above with bullish body */
  rows.push(bar(day + 13 * 3600, 3998, 4000.5, 3996, 4000.2, 300));
  const hits = S.scalpHits(rows, rows);
  const gs12 = hits.filter(h => h.id === 'GS-12');
  assert(gs12.length >= 1,      'GS-12 fires on the London AM fix hunt tape');
  assert(gs12[0].dir === 'long', 'GS-12 fires LONG');
}

/* ============================================================= */
console.log('== 13) GS-13 London Opening Void fires LONG at hour 7.5 when the 07:00 bar had >=2*ATR body with <=8% opposing wick ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  for (let h = 0; h < 7; h++) rows.push(bar(day + h * 3600, 4000, 4002, 3998, 4000, 100));
  /* 07:00 bar: big bullish body with tiny lower wick. ATR on this tape ~4. body >= 2*4 = 8. */
  rows.push(bar(day + 7 * 3600, 4000, 4015, 4000, 4015, 300));
  /* trigger at hour 7.5 (within [7, 8)): tags the midpoint of the void bar (4007.5) and closes back above bullish */
  /* midpoint = (4015 + 4000)/2 = 4007.5. last.l <= 4007.5, last.c > 4007.5, bullish body */
  rows.push(bar(day + 7 * 3600 + 1800, 4008, 4012, 4005, 4010, 300));
  const hits = S.scalpHits(rows, rows);
  const gs13 = hits.filter(h => h.id === 'GS-13');
  assert(gs13.length >= 1,      'GS-13 fires on the London opening void tape');
  assert(gs13[0].dir === 'long', 'GS-13 fires LONG');
}

/* ============================================================= */
console.log('== 14) GS-14 News Exhaustion fires on marked release bar at 12:30 or 13:30 UTC — requires pack.newsRelease=true ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 100));
  /* 7 pre-release bars with range 3990..4005 — pre-5 window on indices [rows.length-6..rows.length-2] */
  for (let h = 0; h < 12; h++) rows.push(bar(day + h * 3600, 4000, 4001, 3999, 4000, 100));
  /* 5 bars right before the trigger with preHi=4005, preLo=3990 */
  for (let h = 7; h < 12; h++) rows[rows.length - (12 - h) - 1] = bar(day + h * 3600, 4000, 4005, 3990, 4000, 100);
  /* trigger at hour 12.5 (within [12.5, 12.75)): short case — ran above preHi then closed back inside */
  rows.push(bar(day + 12 * 3600 + 1800, 4005, 4015, 4000, 3998, 300));
  /* without pack.newsRelease — should NOT fire */
  assert(S.scalpHits(rows, rows).filter(h => h.id === 'GS-14').length === 0,
    'GS-14 does NOT fire without pack.newsRelease flag');
  /* with pack.newsRelease=true */
  const hits = S.scalpHits(rows, rows, { newsRelease: true });
  const gs14 = hits.filter(h => h.id === 'GS-14');
  assert(gs14.length >= 1,       'GS-14 fires on a marked release bar with pack.newsRelease=true');
  assert(gs14[0].dir === 'short', 'GS-14 fires SHORT (ran above prior range + closed back inside)');
}

/* ============================================================= */
console.log('== 15) hg-v1276 PACE_DEAD gate withholds a GS-1 Judas that would otherwise fire — participation layer is live ==');
{
  const W = loadSuite(); const S = W.HG_GoldSuite;
  const day = tsAt(2026, 10, 7, 0);
  const rows = [];
  for (let h = 12; h < 24; h++) rows.push(bar(day - (24 - h) * 3600, 4000, 4001, 3999, 4000, 1000));
  for (let i = 0; i < 7; i++) rows.push(bar(day + i * 3600, 4000, 4005, 3998, 4001, 1000));
  rows.push(bar(day + 7 * 3600, 4001, 4003, 3999, 4001, 1000));
  /* trigger with LOW volume (pace = 100/1000 = 0.1 << PACE_DEAD=0.5) */
  rows.push(bar(day + 8 * 3600, 4001, 4002, 3995, 4001.5, 100));
  const hits = S.scalpHits(rows, rows);
  const gs1 = hits.filter(h => h.id === 'GS-1');
  assert(gs1.length === 0,     'GS-1 withheld when PACE_DEAD gate fires (trigger volume << median)');
}

/* ============================================================= */
console.log('== 16) all fourteen GS-* ids are declared in gold-suite-unified.js (sibling-shipped roster, hg-v1270 → v1285) ==');
{
  const src = readFileSync('gold-suite-unified.js', 'utf8');
  for (let n = 1; n <= 14; n++){
    const id = 'GS-' + n;
    assert(src.indexOf("'" + id + "'") >= 0, id + ' is declared in gold-suite-unified.js');
  }
}

/* ============================================================= */
console.log('== 17) consumer wires + shell + sw.js precache all name the suite ==');
{
  const goldind = readFileSync('goldind.js', 'utf8');
  const idx = readFileSync('index.html', 'utf8');
  const sw = readFileSync('sw.js', 'utf8');
  assert(/HG_GoldSuite/.test(goldind) && /scalpHits/.test(goldind), 'goldind.js wires HG_GoldSuite.scalpHits');
  assert(/gold-suite-unified\.js\?v=\d+/.test(idx), 'index.html loads gold-suite-unified.js with a cache-buster');
  assert(/gold-suite-unified\.js/.test(sw), 'sw.js precaches gold-suite-unified.js');
}

console.log('\n[ok] test-gold-scalp-14-fires.mjs — ' + okCount + ' assertions');
