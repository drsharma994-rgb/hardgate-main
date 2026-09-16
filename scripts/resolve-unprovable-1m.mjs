#!/usr/bin/env node
/* HARDGATE — settle the rows the hourly bars cannot, by looking inside them.
   =======================================================================

   THE PROBLEM THIS EXISTS FOR. 1,751 of the omnigold walk's 7,734 settled
   rows (21.5%) are pending orders that resolved on their own fill bar. Four
   prices cannot order the entry touch against the exit touch, so each row is
   either the trade the walk scored or no trade at all, and the book's win
   rate is an interval — 27.61% to 38.32% against a 33.33% breakeven at 2R.
   The interval contains breakeven, so on hourly data this walk cannot say
   whether the book wins or loses. lib/unprovable-fill.mjs sets that out.

   No estimator narrows it. Only more resolution does: one minute bars inside
   the fill hour put the prints in order.

   WHAT IT DOES. Fetches the 1m series across the walk's own window (about
   260k bars, cached like every other series this repo pulls), then for each
   unprovable row replays the trade inside its fill bar minute by minute:

     order rests at entry
       -> a minute touches entry, and later minutes settle stop or target
          the trade existed and its outcome is now known
       -> an exit level prints and the order is still resting
          that touch was not this trade's; keep walking, the order may still
          fill later in the bar
       -> the minute bar ends with the position open
          a real trade, still running — resolved forward on the hourly bars
          the walk already had, stop-first, exactly as the walk does
       -> one MINUTE spans both levels
          the same ambiguity, sixty times smaller. Stays unprovable and is
          reported, never guessed

   Rows it settles are written back with `unprovableFill: false` and their
   corrected outcome, which narrows the interval automatically for every
   consumer that reads the shared predicate. Rows it cannot settle keep the
   flag. Nothing is overwritten in place without --write.

   THIS NEEDS NETWORK. Binance klines are not reachable from every
   environment this repo runs in, and when they are not, the script says so
   and changes nothing rather than degrading to a guess.

   Run:
     node scripts/resolve-unprovable-1m.mjs              # report only
     node scripts/resolve-unprovable-1m.mjs --write      # rewrite the artifact
     node scripts/resolve-unprovable-1m.mjs --limit=200  # try a subset first
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ogXmBarTouchesEntry } from '../lib/omnigold-xm-bot-backtest.mjs';
import { isUnprovableFill, winRateBounds } from '../lib/unprovable-fill.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(name + '='));
  return a ? a.split('=')[1] : dflt;
};
const WRITE = has('--write');
const JSON_OUT = has('--json');
const LIMIT = +opt('--limit', 0) || 0;
const WALK = path.join(ROOT, 'scripts', opt('--in', 'backtest-omnigold-results.json'));
const CACHE_DIR = path.join(ROOT, '.cache', 'klines');

const TF_SEC = { SCALP: 3600, SWING: 14400 };
const tfSecOf = row => TF_SEC[String(row.horizon).toUpperCase()] || 3600;

/* ================= THE ORDERING RULE (pure, and the part worth testing) ===

   Replays one trade across a series of finer bars. Returns a verdict object
   and never throws: a caller feeding it nothing gets 'no-data', not a
   guess.

     settled    'win' | 'loss' | 'open' | 'never-filled' | null
     reason     why, in one word, for the report
     residual   true when a single fine bar spanned two levels — the same
                unprovability, one resolution finer

   `open` means the position existed and was still running when the fine
   series ran out; the caller resolves it forward on coarser bars. That is
   not a failure, it is the normal case for a trade that outlived its fill
   bar, and it is the reason this returns a state rather than a boolean. */
export function resolveInsideBar(fineBars, trade){
  const { dir, orderType, entry, stop, t1 } = trade || {};
  if (!Array.isArray(fineBars) || !fineBars.length) return { settled: null, reason: 'no-data' };
  if (!(entry > 0) || !(stop > 0) || !(t1 > 0)) return { settled: null, reason: 'no-levels' };

  const long = dir === 'long';
  const hitStop = b => long ? (+b.l <= stop) : (+b.h >= stop);
  const hitT1 = b => long ? (+b.h >= t1) : (+b.l <= t1);

  let filled = false;
  for (const b of fineBars){
    if (!filled){
      const touchEntry = ogXmBarTouchesEntry(orderType, dir, b, entry);
      if (!touchEntry) continue;                 /* still resting; exits are not ours */
      filled = true;
      /* the fill minute itself can also carry an exit, and then we are back
         where we started, one resolution finer. Say so rather than pick. */
      if (hitStop(b) || hitT1(b)) return { settled: null, reason: 'residual', residual: true };
      continue;                                  /* filled cleanly; resolve from the next bar */
    }
    /* open position: a bar spanning both levels is a STOP — the position
       certainly exists and only the exit order is unknown, which is exactly
       the case hg-forward.js resolves this way. */
    if (hitStop(b) && hitT1(b)) return { settled: 'loss', reason: 'both-touch', bothTouch: true };
    if (hitStop(b)) return { settled: 'loss', reason: 'stop' };
    if (hitT1(b)) return { settled: 'win', reason: 'target' };
  }
  return filled
    ? { settled: 'open', reason: 'still-open-at-bar-end' }
    : { settled: 'never-filled', reason: 'order-never-touched' };
}

/* Continue an open position on coarser bars, stop-first — the walk's own
   rule, reused so a row settled here cannot disagree with a row settled
   there. */
export function resolveForward(coarseBars, trade, timeoutBars){
  const { dir, stop, t1 } = trade || {};
  const long = dir === 'long';
  let n = 0;
  for (const b of coarseBars || []){
    n++;
    const hs = long ? (+b.l <= stop) : (+b.h >= stop);
    const ht = long ? (+b.h >= t1) : (+b.l <= t1);
    if (hs && ht) return { settled: 'loss', reason: 'both-touch', bothTouch: true, bars: n };
    if (hs) return { settled: 'loss', reason: 'stop', bars: n };
    if (ht) return { settled: 'win', reason: 'target', bars: n };
    if (timeoutBars && n >= timeoutBars) return { settled: 'timeout', reason: 'timeout', bars: n };
  }
  return { settled: 'open', reason: 'ran-out-of-bars', bars: n };
}

/* ================= data ================= */

async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-unprovable-1m/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.json();
}

/* Forward pagination over a closed window — the 1m series for a six-month
   walk is ~260k bars, so it is pulled once and cached rather than fetched
   per trade. */
async function fetch1m(symbol, fromMs, toMs){
  const out = [];
  let cursor = fromMs;
  while (cursor < toMs){
    const url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol
              + '&interval=1m&limit=1000&startTime=' + cursor + '&endTime=' + toMs;
    const batch = await jget(url);
    if (!Array.isArray(batch) || !batch.length) break;
    for (const k of batch) out.push({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4] });
    cursor = batch[batch.length - 1][0] + 60000;
    if (batch.length < 1000) break;
    process.stderr.write('\r  1m bars: ' + out.length);
    await new Promise(r => setTimeout(r, 200));
  }
  process.stderr.write('\n');
  return out;
}

async function cached1m(symbol, fromMs, toMs){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-1m-' + fromMs + '-' + toMs + '.json');
  if (fs.existsSync(file)){
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j.rows && j.rows.length){
        console.log('  cache hit 1m: ' + j.rows.length + ' bars');
        return j.rows;
      }
    } catch (e) { /* refetch */ }
  }
  console.log('  fetching ' + symbol + ' 1m across the walk window from Binance spot...');
  const rows = await fetch1m(symbol, fromMs, toMs);
  if (rows.length) fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, rows }));
  return rows;
}

/* ================= main ================= */

async function main(){
  if (!fs.existsSync(WALK)){
    console.error('no walk to resolve: ' + WALK);
    process.exit(1);
  }
  const walk = JSON.parse(fs.readFileSync(WALK, 'utf8'));
  const settled = (walk.trades || []).filter(r => typeof r.rMultiple === 'number');
  const targets = settled.filter(isUnprovableFill);
  const before = winRateBounds(settled);

  console.log('RESOLVE UNPROVABLE FILLS — one minute at a time');
  console.log('===============================================\n');
  console.log('  ' + targets.length + ' of ' + settled.length + ' filled rows cannot be ordered on hourly bars.');
  console.log('  win rate today: ' + (100 * before.lower).toFixed(2) + '% .. '
    + (100 * before.upper).toFixed(2) + '%  (breakeven at 2R is 33.33%)\n');

  if (!targets.length){
    console.log('  Nothing to resolve.');
    return;
  }

  const symbol = (walk.meta && walk.meta.symbol) || 'PAXGUSDT';
  const span = walk.meta && walk.meta.span;
  if (!span){
    console.error('  the artifact has no span — cannot tell which minutes to fetch');
    process.exit(1);
  }
  /* the fill bar of the LAST trade can end a full timeframe past the span */
  const fromMs = +new Date(span.from);
  const toMs = +new Date(span.to) + 5 * 3600 * 1000;

  let m1;
  try {
    m1 = await cached1m(symbol, fromMs, toMs);
  } catch (e) {
    console.error('\n  COULD NOT FETCH 1m BARS: ' + (e && e.message));
    console.error('  Binance klines are not reachable from here, so nothing was resolved and');
    console.error('  nothing was written. The interval above stands until this runs somewhere');
    console.error('  with egress. No estimate is offered in its place — that is the point.');
    process.exit(2);
  }
  if (!m1.length){
    console.error('  no 1m bars returned; nothing resolved, nothing written.');
    process.exit(2);
  }

  /* index by minute open for O(1) slicing */
  const byT = new Map();
  for (let i = 0; i < m1.length; i++) byT.set(m1[i].t, i);

  const work = LIMIT ? targets.slice(0, LIMIT) : targets;
  const tally = { win: 0, loss: 0, neverFilled: 0, openForward: 0, residual: 0, noData: 0, timeout: 0 };
  const patched = new Map();

  for (const r of work){
    /* for an unprovable row the fill bar IS the exit bar, so exitISO is the
       open of the bar to look inside */
    const barOpen = r.exitISO ? Math.floor(+new Date(r.exitISO) / 1000) : null;
    if (barOpen == null){ tally.noData++; continue; }
    const tf = tfSecOf(r);
    const startIdx = byT.get(barOpen);
    if (startIdx == null){ tally.noData++; continue; }

    const fine = [];
    for (let i = startIdx; i < m1.length && m1[i].t < barOpen + tf; i++) fine.push(m1[i]);

    const trade = { dir: r.dir, orderType: r.orderType, entry: r.entry, stop: r.stop, t1: r.t1 };
    let v = resolveInsideBar(fine, trade);

    if (v.settled === 'open'){
      /* it filled and outlived its bar: carry on across the following
         minutes, which is finer than the walk managed and never coarser */
      const rest = [];
      for (let i = startIdx + fine.length; i < m1.length && rest.length < 96 * 60; i++) rest.push(m1[i]);
      v = resolveForward(rest, trade, 96 * 60);
      if (v.settled === 'open' || v.settled === 'timeout'){ tally.openForward++; continue; }
    }

    if (v.residual){ tally.residual++; continue; }
    if (v.settled === 'never-filled'){
      tally.neverFilled++;
      patched.set(r, { unprovableFill: false, outcome: 'unfilled', rMultiple: null, netR: null,
                       resolvedBy: '1m' });
      continue;
    }
    if (v.settled === 'win'){
      tally.win++;
      const rr = Math.abs(r.t1 - r.entry) / Math.abs(r.stop - r.entry);
      patched.set(r, { unprovableFill: false, outcome: 'win', rMultiple: +rr.toFixed(3), resolvedBy: '1m' });
      continue;
    }
    if (v.settled === 'loss'){
      tally.loss++;
      patched.set(r, { unprovableFill: false, rMultiple: -1, resolvedBy: '1m',
                       outcome: 'loss' + (v.bothTouch ? ' (both-touch)' : '') });
      continue;
    }
    tally.noData++;
  }

  console.log('\n  RESOLVED');
  console.log('    the trade existed and won      ' + String(tally.win).padStart(5));
  console.log('    the trade existed and lost     ' + String(tally.loss).padStart(5));
  console.log('    the order never filled at all  ' + String(tally.neverFilled).padStart(5));
  console.log('  STILL OPEN');
  console.log('    residual (one MINUTE spanned both levels) ' + String(tally.residual).padStart(5));
  console.log('    unresolved after the horizon              ' + String(tally.openForward).padStart(5));
  console.log('    no 1m coverage for that bar               ' + String(tally.noData).padStart(5));

  /* the interval, recomputed as if the patches were applied */
  const projected = settled.map(r => (patched.has(r) ? Object.assign({}, r, patched.get(r)) : r))
    .filter(r => typeof r.rMultiple === 'number');
  const after = winRateBounds(projected);
  console.log('\n  THE INTERVAL');
  console.log('    before : ' + (100 * before.lower).toFixed(2) + '% .. ' + (100 * before.upper).toFixed(2)
    + '%   (width ' + (100 * (before.upper - before.lower)).toFixed(2) + ' pts)');
  console.log('    after  : ' + (100 * after.lower).toFixed(2) + '% .. ' + (100 * after.upper).toFixed(2)
    + '%   (width ' + (100 * (after.upper - after.lower)).toFixed(2) + ' pts)');
  const be = 1 / 3;
  console.log('    breakeven at 2R (33.33%) is '
    + (after.lower > be ? 'BELOW the interval — the book wins on this evidence'
      : after.upper < be ? 'ABOVE the interval — the book loses on this evidence'
      : 'still inside it — still nothing established'));

  if (JSON_OUT){
    console.log('\n' + JSON.stringify({ tally, before, after, patched: patched.size }, null, 2));
  }

  if (!WRITE){
    console.log('\n  Nothing written. Re-run with --write to apply ' + patched.size + ' resolutions.');
    return;
  }
  for (const [row, patch] of patched) Object.assign(row, patch);
  walk.meta = walk.meta || {};
  walk.meta.unprovableResolution = {
    ranAt: new Date().toISOString(), resolved: patched.size, tally,
    intervalBefore: { lower: before.lower, upper: before.upper },
    intervalAfter: { lower: after.lower, upper: after.upper }
  };
  fs.writeFileSync(WALK, JSON.stringify(walk));
  console.log('\n  Wrote ' + patched.size + ' resolutions into ' + path.relative(ROOT, WALK));
  console.log('  Re-run the evidence bake so the tab picks them up:  npm run og:bake -- --write');
}

/* importable for tests without firing the network */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))){
  main().catch(e => { console.error(e); process.exit(1); });
}
