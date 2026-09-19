/* HARDGATE — the one gold risk no gate can see.
   Spot gold and CME futures close Friday 17:00 New York and reopen Sunday
   17:00 New York; Saturday is a full closure. That is 22:00 UTC in EST and
   21:00 UTC in EDT — pack 859 corrected the edge from a fixed 22 to the NY
   anchor, and the fixtures below moved with it: they sit in August, where
   New York is on EDT, so the edge is 21:00 UTC and the old 22:00 numbers
   here were asserting the defect. tests/test-gold-weekend-dst.mjs pins both
   seasons, both switch weekends, and the no-Intl fallback. XAUTUSD does NOT close — it trades
   24/7/365 and becomes the only venue where gold is priced during that
   window, on a book that is a fraction of its weekday depth.
   A gold position carried across a weekend is therefore exposed twice: it can
   be moved on thin liquidity at hours nobody is watching, and it must then
   reconcile with the LBMA/CME reopen when any weekend premium or discount is
   closed. Neither is a gate failure — both happen AFTER the ticket is issued
   and the stop is set, and a stop is worth much less on a book that thin.
   Seventeen packs have gone into the crypto side. Nothing in the repo touched
   this, and gold is half the book.
   The measurement makes no assumption about the mechanism. It reads what
   XAUTUSD actually did across past closure windows, in ATR units, from the
   candles the app already fetches. If weekends are quiet on this instrument
   the numbers say so and nothing fires.
   Run: node tests/test-gold-weekend.mjs                                      */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const U = (y, m, d, h) => Math.floor(Date.UTC(y, m, d, h) / 1000);
console.log('== the closure window matches the real gold calendar ==');
{
  /* 2026-08-07 is a Friday, and August is EDT: the edge is 21:00 UTC */
  ok(typeof ctx.hgInGoldWeekend === 'function', 'hgInGoldWeekend is not a function');
  ok(ctx.hgInGoldWeekend(U(2026, 7, 7, 20)) === false, 'Fri 20:00 UTC — still open');
  ok(ctx.hgInGoldWeekend(U(2026, 7, 7, 21)) === true,  'Fri 21:00 UTC — the closure starts here in EDT (17:00 NY)');
  ok(ctx.hgInGoldWeekend(U(2026, 7, 8, 12)) === true,  'Sat 12:00 UTC — full closure');
  ok(ctx.hgInGoldWeekend(U(2026, 7, 9, 20)) === true,  'Sun 20:00 UTC — still closed');
  ok(ctx.hgInGoldWeekend(U(2026, 7, 9, 21)) === false, 'Sun 21:00 UTC — reopen, exactly here in EDT');
  ok(ctx.hgInGoldWeekend(U(2026, 7, 10, 3)) === false, 'Mon 03:00 UTC — open');
  /* the same week in JANUARY, where New York is on EST and the edge is 22:00 */
  ok(ctx.hgInGoldWeekend(U(2026, 0, 16, 21)) === false, 'Fri 21:00 UTC in January — still open, EST');
  ok(ctx.hgInGoldWeekend(U(2026, 0, 16, 22)) === true,  'Fri 22:00 UTC in January — the closure starts here');
  ok(ctx.hgInGoldWeekend(U(2026, 0, 18, 21)) === true,  'Sun 21:00 UTC in January — still closed');
  ok(ctx.hgInGoldWeekend(U(2026, 0, 18, 22)) === false, 'Sun 22:00 UTC in January — reopen');
  /* the DAILY break is not a weekend and must not be confused with one */
  ok(ctx.hgInGoldWeekend(U(2026, 7, 5, 21)) === false, 'Wed 21:00 UTC is the daily break, NOT a closure');
  ok(ctx.hgInGoldWeekend(U(2026, 7, 5, 22)) === false, 'nor is Wed 22:00 UTC');
  ok(ctx.hgInGoldWeekend(NaN) === false && ctx.hgInGoldWeekend(null) === false, 'bad input -> false, never throws');
}
console.log('== the countdown is in real hours ==');
{
  ok(Math.abs(ctx.hgSecsToGoldWeekend(U(2026, 7, 7, 20)) - 1 * 3600) < 300, 'Fri 20:00 -> ~1h to the close (EDT)');
  ok(Math.abs(ctx.hgSecsToGoldWeekend(U(2026, 7, 5, 10)) - 59 * 3600) < 300, 'Wed 10:00 -> ~59h to the close (EDT)');
  ok(Math.abs(ctx.hgSecsToGoldWeekend(U(2026, 0, 16, 20)) - 2 * 3600) < 300, 'Fri 20:00 in January -> ~2h (EST)');
  ok(ctx.hgSecsToGoldWeekend(U(2026, 7, 8, 12)) === 0, 'inside a closure -> 0, not a negative or a next-week number');
  ok(ctx.hgSecsToGoldWeekend(NaN) === null, 'bad input -> null');
}
console.log('== the move measurement recovers a planted answer ==');
{
  const ATR = 20;
  /* 4h bars over 20 weeks; the entire weekend move lands at the closure */
  function build(jumpAtr){
    const start = U(2026, 2, 2, 0);          /* a Monday */
    const rows = []; let p = 4000, wasWk = false;
    for (let i = 0; i < 20 * 42; i++){
      const t = start + i * 14400;
      const inWk = ctx.hgInGoldWeekend(t);
      if (inWk && !wasWk) p += jumpAtr * ATR;
      wasWk = inWk;
      rows.push({ t, o: p, h: p, l: p, c: p, v: 1 });
    }
    return rows;
  }
  const quiet = ctx.hgGoldWeekendMoves(build(0.2), ATR);
  ok(quiet.n >= 15, 'a 20-week history yields ' + quiet.n + ' closure windows');
  ok(Math.abs(quiet.p50 - 0.2) < 1e-6, 'a planted 0.20xATR weekend measures 0.20');
  const violent = ctx.hgGoldWeekendMoves(build(2.5), ATR);
  ok(Math.abs(violent.p50 - 2.5) < 1e-6, 'a planted 2.50xATR weekend measures 2.50');
  ok(violent.max >= violent.p90 && violent.p90 >= violent.p50, 'the percentiles are ordered');
}
console.log('== risk is expressed against YOUR stop, not a generic threshold ==');
{
  const ATR = 20;
  function build(jumpAtr){
    const start = U(2026, 2, 2, 0);
    const rows = []; let p = 4000, wasWk = false;
    for (let i = 0; i < 20 * 42; i++){
      const t = start + i * 14400;
      const inWk = ctx.hgInGoldWeekend(t);
      if (inWk && !wasWk) p += jumpAtr * ATR;
      wasWk = inWk; rows.push({ t, o: p, h: p, l: p, c: p, v: 1 });
    }
    return rows;
  }
  const quiet = ctx.hgGoldWeekendRisk(ctx.hgGoldWeekendMoves(build(0.2), ATR), 1.5);
  ok(quiet.exceedPct === 0, 'quiet weekends never exceed a 1.5xATR stop — nothing fires');
  const violent = ctx.hgGoldWeekendRisk(ctx.hgGoldWeekendMoves(build(2.5), ATR), 1.5);
  ok(violent.exceedPct === 1, 'a 2.5xATR weekend exceeds a 1.5xATR stop every time');
  const wide = ctx.hgGoldWeekendRisk(ctx.hgGoldWeekendMoves(build(2.5), ATR), 3.0);
  ok(wide.exceedPct === 0, 'and the SAME history is safe against a 3.0xATR stop');
  ok(/of \d+ weekend closures/.test(violent.note), 'the note gives the count, not just a percentage');
}
console.log('== it degrades honestly and never invents a number ==');
{
  ok(/needs 50\+ bars/.test(ctx.hgGoldWeekendMoves([{ t: 1, c: 1 }], 20).note), 'thin history says what it needs');
  ok(ctx.hgGoldWeekendMoves(null, 20).p50 === null, 'null rows -> null percentiles');
  ok(/no ATR/.test(ctx.hgGoldWeekendMoves(new Array(60).fill({ t: 1, c: 1 }), 0).note), 'no ATR is stated, not defaulted');
  const noWin = ctx.hgGoldWeekendMoves(
    new Array(60).fill(0).map((_, i) => ({ t: U(2026, 7, 10, 0) + i * 3600, c: 4000 })), 20);
  ok(/no complete closure window/.test(noWin.note), 'a history with no full closure says so');
  ok(ctx.hgGoldWeekendRisk(null, 1.5).exceedPct === null, 'no stats -> null, not 0%');
  ok(ctx.hgGoldWeekendRisk({ moves: [1, 2] }, 0).exceedPct === null, 'no stop distance -> null');
}
console.log('== readout picks warn level from measured history ==');
{
  ok(typeof ctx.hgGoldWeekendReadout === 'function', 'hgGoldWeekendReadout exported');
  const ATR = 20;
  function build(jumpAtr){
    const start = U(2026, 2, 2, 0);
    const rows = []; let p = 4000, wasWk = false;
    for (let i = 0; i < 20 * 42; i++){
      const t = start + i * 14400;
      const inWk = ctx.hgInGoldWeekend(t);
      if (inWk && !wasWk) p += jumpAtr * ATR;
      wasWk = inWk; rows.push({ t, o: p, h: p, l: p, c: p, v: 1 });
    }
    return rows;
  }
  const quiet = ctx.hgGoldWeekendReadout(build(0.2), ATR, 1.5, U(2026, 7, 7, 20));
  ok(quiet.level === 'ok' || quiet.level === 'muted' || quiet.level === 'caution', 'quiet weekends read calm');
  ok(/1\.0h to Fri 21:00/.test(quiet.headline),
     'Fri 20:00 countdown in headline names the EDT close, 1h out at 21:00 UTC — got: ' + quiet.headline);
  const winterQuiet = ctx.hgGoldWeekendReadout(build(0.2), ATR, 1.5, U(2026, 0, 16, 20));
  ok(/2\.0h to Fri 22:00/.test(winterQuiet.headline),
     'and the same clock in January names 22:00 UTC, 2h out — got: ' + winterQuiet.headline);
  const violent = ctx.hgGoldWeekendReadout(build(2.5), ATR, 1.5, U(2026, 7, 8, 12));
  ok(violent.level === 'warn', 'violent history inside closure warns');
  ok(/inside spot\/CME closure/.test(violent.headline), 'inside closure headline');
}
console.log('\n' + passed + ' passed, 0 failed');
