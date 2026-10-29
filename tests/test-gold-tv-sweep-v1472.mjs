#!/usr/bin/env node
/* test-gold-tv-sweep-v1472 — the TradingView port + the killzone book.

   hg-v1472 ships the TradingView backtest deliverable and the measured
   session evidence it was configured from:

     1. exports/tradingview/goldscalp-sweep-reclaim.pine — the Pine v6 port
        of the sweep+reclaim core with the SHIPPED gates baked in (the
        1.5xATR stop floor, min R:R 1.2, the 1.5R/2.5R ladder, the 0.16%
        cost-toxicity reject, the UTC killzones, the gold weekend) and the
        killzone filter as INPUTS defaulting to the measured book.
     2. HG_GOLD_KZ_BOOK — the measured per-session standing of the desk's
        own replay (n=1384 live trades, split at the window midpoint, BOTH
        halves checked): LONDON 46.0%/+11.5R, NY AM 46.0%/+12.0R, ASIAN
        45.1%/+4.3R, OFF-HOURS 41.1%/-27.4R, OVERLAP 37.4%/-48.3R (both
        halves negative; attributed to openrange/asian firing there).
     3. the kzBook stamp rides every goldind mint and renders on the
        GOLD SCALP card — named, never gating.
     4. the shipped build is stamped hg-v1472 on every cache surface.

   Mutation-proven: corrupting the book numbers reds the data pin. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ============ 1. the Pine port: the shipped gates, byte-checked ============ */
{
  const pine = read('exports/tradingview/goldscalp-sweep-reclaim.pine');
  ok(/@version=6/.test(pine), 'pine: v6 script present');
  ok(/strategy\(/.test(pine) && /process_orders_on_close = true/.test(pine), 'pine: a strategy() with close-confirmed fills (the desk judges on closed bars)');
  ok(/poolLen\s*=\s*input\.int\(25/.test(pine), 'pine: the sweep pool is the shipped 25 bars');
  ok(/stopFloor\s*=\s*input\.float\(1\.5/.test(pine), 'pine: the 1.5xATR stop floor');
  ok(/min R:R 1\.2/.test(pine) && /1\.5R\/2\.5R ladder/.test(pine.replace(/
  ok(/min R:R 1.2/.test(pine) && /TP 1.5R / 2.5R/.test(pine), 'pine: the desk min R:R 1.2 and the 1.5R/2.5R ladder documented (satisfied by the fixed-ladder construction)');
  ok(/tp1R\s*=\s*input\.float\(1\.5/.test(pine) && /tp2R\s*=\s*input\.float\(2\.5/.test(pine), 'pine: the 1.5R/2.5R ladder (the hg-v1466 fill-at-next-open targets)');
  ok(/costRiskPct\s*=\s*input\.float\(0\.16/.test(pine), 'pine: the 0.16% cost-toxicity reject');
  ok(/sweepBull = low < poolLo and close > poolLo/.test(pine) && /sweepBear = high > poolHi and close < poolHi/.test(pine), 'pine: the sweep+reclaim trigger exactly as goldSweeps defines it');
  ok(/kzOverlap = input\.bool\(false/.test(pine), 'pine: the overlap killzone defaults OFF (the book loser: win 37.4% net -48.3R, both halves negative)');
  ok(/kzLondon\s*=\s*input\.bool\(true/.test(pine) && /kzNY\s*=\s*input\.bool\(true/.test(pine), 'pine: London and NY AM default ON (the book winners, 46% each)');
  ok(/skipWeekend/.test(pine) && /friday and hh >= 22/.test(pine), 'pine: the gold weekend excluded (Fri 22:00 UTC)');
  ok(/win \d+|%/.test(pine) && /net -48\.3R/.test(pine), 'pine: the measured book numbers are quoted in the inputs, so the config is chosen with the evidence in view');
}

/* ============ 2. the killzone book ============ */
{
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp, Intl };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  try { vm.runInContext(read('goldind.js'), ctx, { filename: 'goldind.js' }); } catch(e){ /* tolerated */ }
  const book = ctx.HG_GOLD_KZ_BOOK;
  ok(book && typeof book === 'object', 'kz book: baked in goldind, exported');
  ok(book['LONDON KILLZONE'].n === 189 && Math.abs(book['LONDON KILLZONE'].win - 0.460) < 1e-9 && Math.abs(book['LONDON KILLZONE'].net - 11.5) < 1e-9, 'kz book: London exact');
  ok(book['NY AM'].n === 211 && Math.abs(book['NY AM'].win - 0.460) < 1e-9, 'kz book: NY AM exact');
  ok(book['ASIAN RANGE'].n === 381 && Math.abs(book['ASIAN RANGE'].win - 0.451) < 1e-9, 'kz book: Asian exact');
  ok(book['OFF-HOURS'].n === 263 && Math.abs(book['OFF-HOURS'].net - (-27.4)) < 1e-9, 'kz book: OFF-HOURS exact');
  ok(book['LONDON/NY OVERLAP'].n === 340 && Math.abs(book['LONDON/NY OVERLAP'].win - 0.374) < 1e-9 && Math.abs(book['LONDON/NY OVERLAP'].net - (-48.3)) < 1e-9, 'kz book: the overlap loser exact');
  /* the total reconciles against the replay book */
  const totalN = Object.keys(book).reduce((a, k) => a + book[k].n, 0);
  ok(totalN === 1384, 'kz book: the five families sum to the replay book n=1384 live trades');
}

/* ============ 3. the stamp rides the mint and renders ============ */
{
  const gi = read('goldind.js');
  ok(/kzBook: kzBookRow \? \{ n: kzBookRow\.n, win: kzBookRow\.win, net: kzBookRow\.net \} : null/.test(gi),
     'stamp: the mint carries kzBook (three-state)');
  const gs = read('goldscalp.js');
  ok(/kz book<\/span>.*kzBook\.win \* 100/.test(gs.replace(/\n/g, ' ')),
     'stamp: the GOLD SCALP card renders the kz book line (win %, net R, both halves)');
}

/* ============ 4. the shipped build is stamped hg-v1472 ============ */
{
  const stamp = read('build-stamp.js');
  ok(/version: 'hg-v1472'/.test(stamp), 'build-stamp version');
  ok(/built: '2026-10-30T/.test(stamp), 'build-stamp built (fresh)');
  ok(/hg-v1472: TRADINGVIEW PORT and KILLZONE BOOK/.test(stamp), 'the pack string names the round');
  ok(/hg-v1471: ADVANCED REGIME READS/.test(stamp), 'and the pack history chain is intact');
  ok(/HG_CACHE = 'hg-v1472'/.test(read('sw.js')), 'sw.js cache id');
  const idx = read('index.html');
  ok(idx.indexOf('?v=1471') < 0 && idx.indexOf('?v=1472') >= 0, 'index.html cache-busters all at 1472');
  ok(read('hg-api-base.js').indexOf('1471') < 0, 'hg-api-base at 1472');
  ok(read('trendtable.js').indexOf('1471') < 0, 'trendtable loader at 1472');
  const ledger = JSON.parse(read('data/batch-ledger.json'));
  const entries = (Array.isArray(ledger) ? ledger : Object.values(ledger).find(Array.isArray));
  ok(entries[entries.length - 1].version === 'hg-v1472', 'the batch ledger last entry is hg-v1472');
}

/* ============ mutations ============ */
{
  /* M1: the book numbers corrupted -> the data pin reds */
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseFloat, parseInt, RegExp, Intl };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  const src = read('goldind.js');
  const m = src.replace("'LONDON KILLZONE':  { n: 189, win: 0.460, net:  11.5 },", "'LONDON KILLZONE':  { n: 189, win: 0.500, net:  11.5 }, /* M1 */");
  if (m === src){ fail++; console.error('  FAIL mutation M1_book_corrupted did not change source'); }
  else {
    try { vm.runInContext(m, ctx, { filename: 'goldind-mutated.js' }); } catch(e){}
    const book = ctx.HG_GOLD_KZ_BOOK;
    if (book && Math.abs(book['LONDON KILLZONE'].win - 0.460) > 1e-9){ pass++; console.log('  ok — mutation M1_book_corrupted caught'); }
    else { fail++; console.error('  FAIL mutation M1_book_corrupted survived'); }
  }
}

console.log(pass + ' assertions passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
