/* HARDGATE — the fourteen gold-library mechanics actually FIRE (round six).

   Its sibling, test-omnigold-full-cover.mjs, proves the three registrations
   agree. That is necessary and not sufficient: a detector can be wired into
   all three places, never throw, and still return null on every bar that will
   ever exist. From the outside that is indistinguishable from a mechanic that
   simply has not had its setup yet — the pooled table shows a permanent zero
   either way, which reads as "no samples" rather than "no code path".

   So this file drives each of the fourteen until it fires, and fails if one
   cannot be made to. Two findings from building it are worth keeping, because
   both were real defects and both were invisible until measured:

   1. STRUCT-BOS WAS A STATE, NOT AN EVENT. goldMarketStructure sets bos from
      `cur > lastHigh.price`, which stays true for every bar price holds above
      that swing high. Bar-by-bar over a trending tape it read
      BBBBBB.B.B.BBBBBBBBBBBBBBBB — 40-plus consecutive firings of one break.
      It fired on 50% of 4,200 sampled windows. A mechanic firing every other
      bar dominates the consensus vote and fills the pool with one move counted
      many times, which is how an edge gets manufactured out of nothing. The
      detector now requires the prior bar not to have been in the same broken
      state, and the last assertion here is the regression guard.

   2. OB-RETEST FIRED ZERO TIMES on 6,120 random-walk windows, and the first
      three hand-built fixtures failed too — for three DIFFERENT reasons, none
      of which was the detector:
        - the retest bar's own low reached the block's base, which marks the
          block mitigated, so it was filtered out before the retest was checked
        - a monotonic ramp produces NO swing pivots at all, so structure read
          neutral forever and the retest requires a non-neutral trend
        - a zigzag whose legs were shorter than goldSwings' 5-bar right window,
          and then one whose highs TIED the pivot (the test is >=, so a tie
          kills the pivot)
      An order block needs a displacement bar — a range past 1.5x ATR closing
      through the 20-bar extreme — and random walks essentially never produce
      one. The tape below is built to contain exactly one. This is the same
      trap recorded in test-omnigold-mechanics.mjs for LONDON-FIX and
      SMT-DIVERGE: a test that cannot tell "never fires" from "my fixture never
      asked it to" is not a test.

   Run: node tests/test-omnigold-round6.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  /* goldind.js and pinegoldmath.js are the point of this file — without them
     every detector below feature-checks itself off and the test would pass by
     asserting nothing. */
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js',
                   'goldind.js', 'pinegoldmath.js', 'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const ctx = boot();

ok(typeof ctx.goldIchimoku === 'function', 'goldind.js loaded into the sandbox');
ok(typeof ctx.pineGoldOuZscore === 'function', 'pinegoldmath.js loaded into the sandbox');
ok(typeof ctx.hgOgDetect === 'function', 'hgOgDetect is exported');

/* Deterministic LCG. Math.random() would make a failure unreproducible, and a
   firing test that passes four times in five is not a test. */
let seed = 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const T0 = 1700000000 - (1700000000 % 86400);
const B = (i, o, h, l, c, v) => ({ t: T0 + i * 3600, o, h, l, c, v: v === undefined ? 1000 : v });

/* Five tape shapes, because the mechanics answer different questions: the
   oscillator reads need mean reversion, ER-IGNITION needs chop then trend,
   SWEEP-V2 needs volume spikes at extremes. */
function series(mode, n){
  const rows = []; let p = 2000;
  for (let i = 0; i < n; i++){
    let drift;
    if (mode === 'trend') drift = 0.9;
    else if (mode === 'range') drift = Math.sin(i / 11) * 3;
    else if (mode === 'chop2trend') drift = i < n * 0.7 ? Math.sin(i / 5) * 2 : 1.4;
    else if (mode === 'spike') drift = (i % 37 === 0) ? (rnd() > 0.5 ? 14 : -14) : Math.sin(i / 8) * 2;
    else drift = (rnd() - 0.5) * 6;
    p += drift + (rnd() - 0.5) * 3;
    const o = p, c = p + (rnd() - 0.5) * 4;
    const h = Math.max(o, c) + rnd() * 5, l = Math.min(o, c) - rnd() * 5;
    rows.push(B(i, o, h, l, c, 800 + rnd() * 1500 + ((i % 23 === 0) ? 4000 : 0)));
  }
  return rows;
}

/* ---- the battery ---- */
/* DI-CROSS and OB-RETEST are handled separately below. Both need a specific
   conjunction that a random walk does not manufacture: DI-CROSS needs the
   +DI/-DI cross to coincide with ADX turning up, and it fired 22 times in a
   4,200-window sweep but zero in the 660-window battery here. Lowering the
   bar to "fires somewhere in a big enough sweep" would make this test slow
   and vague; giving it a tape built for it is honest and fast. */
const ROUND5 = ['ICHI-KUMO','STOCHRSI-TURN','CCI-EXTREME','RIBBON-PULLBACK','HA-FLIP',
                'VWAP-BAND','PD-EQUILIBRIUM','ER-IGNITION','STRUCT-BOS','SWEEP-V2',
                'OU-REVERT','MFI-SQUAT'];
const fired = {}; ROUND5.forEach(k => fired[k] = 0);
let windows = 0;
for (const mode of ['trend','range','chop2trend','spike','rand']){
  for (let s = 0; s < 12; s++){
    seed = 1000 + s * 7919;
    const rows = series(mode, 300);
    for (let cut = 270; cut <= 300; cut += 3){
      const hits = ctx.hgOgDetect(rows.slice(0, cut), { nowSec: rows[cut - 1].t });
      windows++;
      for (const h of hits) if (fired.hasOwnProperty(h.kind)) fired[h.kind]++;
    }
  }
}
for (const k of ROUND5) ok(fired[k] > 0, k + ' fires on the synthetic battery (' + fired[k] + ' of ' + windows + ' windows)');

/* ---- DI-CROSS, on a tape that reverses hard out of an established trend ----
   A long clean decline drives ADX well above the CHOP threshold and pins -DI
   over +DI; the sharp reversal then crosses +DI back over while ADX is still
   elevated. That is the setup the mechanic describes, and it is exactly what
   a random walk will not produce. */
function diTape(){
  const rows = []; let i = 0, p = 2200;
  for (let k = 0; k < 70; k++, i++){          /* sustained decline */
    const o = p, c = p - 6; rows.push(B(i, o, o + 1, c - 1, c)); p = c;
  }
  for (let k = 0; k < 25; k++, i++){          /* sharp reversal up */
    const o = p, c = p + 9; rows.push(B(i, o, c + 1, o - 1, c)); p = c;
  }
  return rows;
}
const diRows = diTape();
const diAdx = ctx.goldADX(diRows);
ok(diAdx && diAdx.state !== 'CHOP',
   'the DI tape reads as trending, not chop (ADX ' + (diAdx ? diAdx.adx.toFixed(0) : '?') + ')');
let diFired = null;
for (let cut = 75; cut <= diRows.length; cut++){
  const h = ctx.hgOgDiCross(diRows.slice(0, cut));
  if (h){ diFired = h; break; }
}
ok(diFired && diFired.kind === 'DI-CROSS' && diFired.dir === 'long',
   'DI-CROSS fires long when +DI crosses back over with ADX turning up');

/* ---- OB-RETEST, on a tape built to contain one order block ----
   Every constraint below was learned by watching a fixture fail; see the
   header. Do not "simplify" the wicks — the ties they avoid are load-bearing. */
function obTape(){
  const rows = []; let i = 0, p = 2000;
  /* Zigzag up. Legs are 8 up / 7 down because goldSwings needs 5 STRICTLY
     lower bars on each side of a pivot; a 4-bar leg cannot confirm one.
     Up bars carry no lower wick and down bars no upper wick, so no bar ever
     ties the pivot it is supposed to confirm. */
  for (let leg = 0; leg < 8; leg++){
    for (let k = 0; k < 8; k++, i++){ const o = p, c = p + 2.0; rows.push(B(i, o, c + 1, o, c)); p = c; }
    for (let k = 0; k < 7; k++, i++){ const o = p, c = p - 1.2; rows.push(B(i, o, o, c - 1, c)); p = c; }
  }
  /* The order block itself: one down-closing bar. */
  const obOpen = p, obClose = p - 3, obTop = obOpen + 1, obBase = obClose - 1;
  rows.push(B(i++, obOpen, obTop, obBase, obClose));
  /* Displacement: body well past 1.5x ATR, closing above the prior bar's high. */
  const disp = obClose + 40;
  rows.push(B(i++, obClose, disp + 1, obClose - 1, disp, 9000));
  p = disp;
  for (let k = 0; k < 10; k++, i++){ const o = p, c = p + 1.5; rows.push(B(i, o, c + 1, o - 1, c)); p = c; }
  for (let k = 0; k < 4; k++, i++){ const o = p, c = p - 4; rows.push(B(i, o, o + 1, c - 1, c)); p = c; }
  /* The retest: wicks down to the block's TOP and closes above. It must not
     reach obBase — a low at or below the base marks the block mitigated, and
     goldActiveOrderBlocks drops it before the retest is ever evaluated. */
  rows.push(B(i++, p, p + 1, obTop, p + 0.5));
  return { rows, obTop, obBase };
}
const { rows: obRows, obTop, obBase } = obTape();

/* Assert the preconditions individually, so a future break in goldind points
   at the right function instead of at "OB-RETEST stopped firing". */
const sw = ctx.goldSwings(obRows);
ok(sw && sw.highs.length >= 2 && sw.lows.length >= 2, 'the OB tape produces confirmed swing pivots');
const st = ctx.goldMarketStructure(obRows);
ok(st && st.trend === 'bullish', 'structure on the OB tape reads bullish');
const zones = ctx.goldActiveOrderBlocks(obRows, undefined, obRows.length - 1) || [];
ok(zones.length >= 1, 'an unmitigated bullish order block survives to the last bar');
ok(zones.some(z => Math.abs(z.base - obBase) < 0.01 && Math.abs(z.top - obTop) < 0.01),
   'the surviving block is the one the tape was built around');

const obHit = ctx.hgOgObRetest(obRows);
ok(obHit && obHit.kind === 'OB-RETEST' && obHit.dir === 'long', 'hgOgObRetest fires long on the retest bar');
const obKinds = ctx.hgOgDetect(obRows, { nowSec: obRows[obRows.length - 1].t }).map(h => h.kind);
ok(obKinds.includes('OB-RETEST'), 'OB-RETEST reaches the live detect pass');

/* The zones must be computed from the PREFIX, not read from goldind's
   module-level _lastActiveZones cache — that cache is written by whichever
   gold tab ran last, and a walk-forward that read it would be scoring early
   bars against zones derived from late ones. Priming the cache with garbage
   must not change the answer. */
ctx.goldUpdateActiveZones(series('rand', 200), 199);
const obAgain = ctx.hgOgObRetest(obRows);
ok(obAgain && obAgain.kind === 'OB-RETEST',
   'OB-RETEST ignores the shared _lastActiveZones cache (no cross-tape lookahead)');

/* ---- STRUCT-BOS is an EVENT: the regression guard for defect (1) ---- */
seed = 1000;
const trendRows = series('trend', 300);
let bosFires = 0, bosWindows = 0, longestRun = 0, run = 0;
for (let cut = 200; cut <= 300; cut++){
  const hit = ctx.hgOgStructBos(trendRows.slice(0, cut));
  bosWindows++;
  if (hit){ bosFires++; run++; if (run > longestRun) longestRun = run; } else run = 0;
}
ok(bosFires > 0, 'STRUCT-BOS still fires at all (' + bosFires + ' of ' + bosWindows + ' bars)');
ok(bosFires / bosWindows < 0.25,
   'STRUCT-BOS fires on under a quarter of bars — it is an event, not a standing state (' +
   (100 * bosFires / bosWindows).toFixed(0) + '%)');
ok(longestRun <= 2,
   'STRUCT-BOS never latches across a run of bars (longest consecutive run: ' + longestRun + ')');

/* Sanity: the raw goldind read really is the latching one, so the assertion
   above is testing OUR guard rather than a property goldind already had. */
let rawRun = 0, rawLongest = 0;
for (let cut = 200; cut <= 300; cut++){
  const S = ctx.goldMarketStructure(trendRows.slice(0, cut));
  if (S && (S.bos || S.choch)){ rawRun++; if (rawRun > rawLongest) rawLongest = rawRun; } else rawRun = 0;
}
ok(rawLongest > longestRun,
   'the underlying goldMarketStructure read does latch (' + rawLongest +
   ' consecutive), so the guard is doing real work');

console.log('\nomnigold round-five: ' + passed + ' checks passed · all 14 library mechanics fire');
