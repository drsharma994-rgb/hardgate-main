/* HARDGATE -- hg-v996: THE SETUP LOG NEVER GRADED THE FIRST BAR OF THE TRADE.

   logSetup dated every record on the wall clock (ts) and checkOutcomes walked
   CLOSED bars with t >= ts. Every scan prices on closed bars, so the bar still
   forming at log time is the first bar of the trade -- and its open time is
   before ts, so once it closed it was excluded: a fill, a stop or a target on
   it was unseen, and the 12-bar fill window started one bar late. A limit
   that filled and stopped on bar one read UNFILLED; a market entry stopped on
   bar one stayed open until a later bar decided it.

   The record carries barT now -- the open of the record's own timeframe grid
   at the log instant, through one helper -- and the walk starts there. A
   legacy record, or junk in the field, walks from the clock as before.
   Node 18+, no network. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const html = read('index.html');

/* lift the SETUP LOG block (LOG_KEY .. exportLog) out of the shell and run it under stubs */
const A = html.indexOf("const LOG_KEY='hardgate_log_v1';");
const B = html.indexOf('function exportLog(');
if (A < 0 || B < 0 || B < A) throw new Error('FAIL: SETUP LOG block not found in index.html');
const LOG_BLOCK = html.slice(A, B);

function boot(opts){
  const store = {};
  let clock = opts.now;
  const rowsBySym = opts.rows || {};
  const ctx = {
    console, Math, JSON, Date, String, Number, Boolean, isFinite, isNaN, parseFloat, Promise, Error, Array, Object, NaN, Infinity,
    S: { exchange: 'delta', tickers: [] },
    nowSec: () => clock,
    sleep: async () => {},
    $: () => ({ disabled: false, textContent: '', innerHTML: '' }),
    getCandles: async (sym, res) => (rowsBySym[sym + '|' + res] || rowsBySym[sym] || []),
    getXAUCandles: async (res) => (rowsBySym['XAUUSD|' + res] || rowsBySym['XAUUSD'] || []),
    candlesRangeRaw: async () => [],
    hgNetR: () => 0, hgCostR: () => 0.01, hgWilson: () => null, fmt: n => String(n), px: n => String(n),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(LOG_BLOCK, ctx, { filename: 'setup-log-block.js' });
  vm.runInContext('renderLog = function(){}; renderLogBadge = function(){};', ctx);
  ctx.__setClock = t => { clock = t; };
  ctx.__store = store;
  return ctx;
}
const H4 = 14400, M15 = 900;
const T0 = Math.floor(Date.UTC(2026, 8, 20, 12, 0, 0) / 1000);   /* a 4h bar open, also a 15m bar open */
ok(T0 % H4 === 0, 'the fixture instant sits on the 4h grid');
/* a long at 100 with the stop at 95 and T1 at 110; bar(t, l, h) */
const bar = (t, l, h) => ({ t, o: 100, h, l, c: 100, v: 1 });

console.log('1. the helper: one rule for the bar a record is formed on');
{
  const S = boot({ now: T0 + 180 });
  ok(typeof S.hgLogBarT === 'function', 'hgLogBarT is defined in the block');
  ok(S.hgLogBarT(T0 + 180, '4h') === T0 && S.hgLogBarT(T0 + 14399, '4h') === T0 && S.hgLogBarT(T0 + 14400, '4h') === T0 + H4, 'a 4h record logged anywhere inside the bar reads that bar\'s open');
  ok(S.hgLogBarT(T0 + 180, '15m') === T0 && S.hgLogBarT(T0 + 950, '15m') === T0 + M15, 'a 15m record reads the 15m grid');
  ok(S.hgLogBarT(T0 + 180, '1h') === T0, 'and 1h the 1h grid');
  ok(S.hgLogBarT(T0, '4h') === T0, 'an instant exactly on the grid is its own bar');
  ok(S.hgLogBarT(String(T0), '4h') === null && S.hgLogBarT(0, '4h') === null && S.hgLogBarT(null, '4h') === null && S.hgLogBarT(NaN, '4h') === null && S.hgLogBarT(-5, '4h') === null, 'a string, zero, null, NaN or a negative instant is not a bar (+null is 0, and 0 would be 1970)');
  ok(S.hgLogBarT(T0 + 180, '5m') === null && S.hgLogBarT(T0 + 180, undefined) === null, 'an unknown timeframe is no bar');
}

console.log('2. the record carries the bar it was formed on');
{
  const S = boot({ now: T0 + 180 });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  S.logSetup('ETHUSD', 'short', 'scalp', 100, 105, 90);
  S.__setClock(T0 + 950);
  S.logSetup('SOLUSD', 'long', 'gold-deep-scalp', 100, 95, 110);
  const l = S.loadLog();
  ok(l.length === 3, 'three records logged');
  ok(l[0].ts === T0 + 180 && l[0].barT === T0 && l[0].res === '4h', 'a swing record: ts is the clock, barT the 4h bar open');
  ok(l[1].ts === T0 + 180 && l[1].barT === T0 && l[1].res === '15m', 'a scalp record logged 3 min into the bar: the 15m bar open');
  ok(l[2].barT === T0 + M15 && l[2].res === '15m', 'a scalp record logged in the next 15m bar: that bar');
  ok(l[0].status === 'open' && l[0].filledTs === null && l[0].rr === 2, 'the rest of the record is as it always was');
  /* dedup still keys on the clock window, not the bar */
  S.__setClock(T0 + 3 * 3600);
  S.logSetup('BTCUSD', 'long', 'swing', 101, 96, 111);
  ok(S.loadLog().length === 3, 'the 12h dedup is untouched (same sym/dir/kind inside 12h records nothing)');
}

console.log('3. the defect, reproduced on a legacy record, and the fix on a new one');
{
  /* the first bar of the trade (the one forming at log time) fills the long at 100 and takes the stop at 95;
     every later bar stays above the entry, so the entry is never touched again */
  const rows = [bar(T0, 94, 101)];
  for (let i = 1; i <= 16; i++) rows.push(bar(T0 + i * H4, 102, 104));
  /* legacy: a record written before the field, dated on the clock 3 min into the bar */
  let S = boot({ now: T0 + 180, rows: { BTCUSD: rows } });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  let l = S.loadLog(); delete l[0].barT; S.saveLog(l);
  S.__setClock(T0 + 17 * H4);
  await S.checkOutcomes();
  let e = S.loadLog()[0];
  ok(e.status === 'unfilled' && !e.filledTs, 'LEGACY (clock-dated): the bar that filled and stopped the trade is skipped, and the record reads UNFILLED after the window (' + e.status + ')');
  /* the same record, dated on its bar */
  S = boot({ now: T0 + 180, rows: { BTCUSD: rows } });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  S.__setClock(T0 + 17 * H4);
  await S.checkOutcomes();
  e = S.loadLog()[0];
  ok(e.barT === T0 && e.status === 'sl' && e.filledTs === T0 && e.doneTs === T0, 'BAR-DATED: the first bar fills the entry and takes the stop, and the record reads SL on that bar (' + e.status + ')');
  /* junk in the field walks from the clock */
  S = boot({ now: T0 + 180, rows: { BTCUSD: rows } });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  l = S.loadLog(); l[0].barT = String(T0); S.saveLog(l);
  S.__setClock(T0 + 17 * H4);
  await S.checkOutcomes();
  ok(S.loadLog()[0].status === 'unfilled', 'a string bar is not a bar: the reader falls back to the clock (' + S.loadLog()[0].status + ')');
  S = boot({ now: T0 + 180, rows: { BTCUSD: rows } });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  l = S.loadLog(); l[0].barT = 0; S.saveLog(l);
  S.__setClock(T0 + 17 * H4);
  await S.checkOutcomes();
  ok(S.loadLog()[0].status === 'unfilled', 'a zero bar is not a bar either (0 would walk from 1970 and grade on every bar the feed returns)');
}

console.log('4. the fill window is the same length, one bar earlier; the signal bar itself is still excluded');
{
  /* the entry is first touched fourteen bars after the signal (index 13 from the first bar). The window is
     FILL_BARS long from the walk's first bar, so bar-dated it has already expired; clock-dated the walk
     started one bar late and the same touch still sits inside it */
  const rows = [];
  for (let i = 0; i <= 15; i++) rows.push(bar(T0 + i * H4, i === 13 ? 99 : 102, i === 13 ? 120 : 104));
  let S = boot({ now: T0 + 180, rows: { BTCUSD: rows } });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  S.__setClock(T0 + 16 * H4);
  await S.checkOutcomes();
  let e = S.loadLog()[0];
  ok(e.status === 'unfilled' && !e.filledTs, 'bar-dated: a touch fourteen bars after the signal is outside the window, which now counts from the first bar (' + e.status + ')');
  S = boot({ now: T0 + 180, rows: { BTCUSD: rows } });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  const l = S.loadLog(); delete l[0].barT; S.saveLog(l);
  S.__setClock(T0 + 16 * H4);
  await S.checkOutcomes();
  ok(S.loadLog()[0].status === 'tp' && S.loadLog()[0].filledTs === T0 + 13 * H4, 'legacy: the same touch was inside a window that started one bar late -- the window did not move in length, it moved in time');
  /* the bar BEFORE the forming bar (the signal bar the scan priced on) is never walked */
  const rows2 = [bar(T0 - H4, 90, 101), bar(T0, 102, 104), bar(T0 + H4, 102, 104)];
  S = boot({ now: T0 + 180, rows: { BTCUSD: rows2 } });
  S.logSetup('BTCUSD', 'long', 'swing', 100, 95, 110);
  S.__setClock(T0 + 3 * H4);
  await S.checkOutcomes();
  ok(S.loadLog()[0].status === 'open' && !S.loadLog()[0].filledTs, 'the closed signal bar the scan priced on is not the trade: its low is not a fill');
}

console.log('5. a 15m scalp and a gold record read their own grids');
{
  const rows = [bar(T0, 94, 101)];
  for (let i = 1; i <= 16; i++) rows.push(bar(T0 + i * M15, 102, 104));
  let S = boot({ now: T0 + 120, rows: { 'ETHUSD|15m': rows } });
  S.logSetup('ETHUSD', 'long', 'scalp', 100, 95, 110);
  S.__setClock(T0 + 17 * M15);
  await S.checkOutcomes();
  ok(S.loadLog()[0].barT === T0 && S.loadLog()[0].status === 'sl', 'a scalp logged 2 min into a 15m bar is graded from that bar (' + S.loadLog()[0].status + ')');
  S = boot({ now: T0 + 120, rows: { 'XAUUSD|15m': rows } });
  S.S.exchange = 'coindcx';
  S.logSetup('XAUUSD', 'long', 'gold-scalp', 100, 95, 110);
  S.__setClock(T0 + 17 * M15);
  await S.checkOutcomes();
  ok(S.loadLog()[0].barT === T0 && S.loadLog()[0].status === 'sl', 'a gold scalp reads the same rule through getXAUCandles, on any exchange selection');
}

console.log('6. nothing else on the record or its readers moved');
{
  const src = html.replace(/\/\*[\s\S]*?\*\//g, '');
  ok((src.match(/hgLogBarT\(/g) || []).length === 2, 'the helper is defined once and called once (the record site)');
  ok(!/filter\(r=>r\.t>=e\.ts\)/.test(src), 'the clock-only filter is gone from checkOutcomes');
  ok(/const cut=nowSec\(\)-12\*3600;/.test(src) && /e\.ts>cut/.test(src), 'dedup still reads the clock window');
  ok(/const maxTimeAllowed = e\.ts \+ \(maxBars \* secPer\);/.test(src), 'the time stop still counts from the clock the record was logged at');
  /* hgNetR and familyStats read status / rr / filledTs / doneTs and nothing this pack added */
  ok(!/barT/.test(read('brain.js').replace(/\/\*[\s\S]*?\*\//g, '').slice(read('brain.js').indexOf('function familyStats'), read('brain.js').indexOf('function familyStats') + 900)), 'BRAIN\'s family history reads no bar');
}

console.log('7. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(v && parseInt(v.slice(4), 10) >= 996, 'build-stamp.js at or past hg-v996 (' + v + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed');
