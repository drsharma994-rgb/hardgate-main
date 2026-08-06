/* HARDGATE — gold ticket/venue parity.
   Guards the defect where every gold TICKET was stamped XAUTUSD (GOLD_SYM,
   brain gold lane, book, /api/execute) while its entry/stop/T1 were derived
   from Binance XAUUSDT via getXAUCandles. XAUT runs a 0.5-2% basis to spot —
   the same order of magnitude as the 1.5xATR gold stop in goldswing.js — so
   the levels were placed on an instrument they were never computed on.
   getXAUCandles is the single choke point: index.html, brain.js, scorecard.js,
   startrader.js and macro-feeds.js all enter through it.
   Run: node tests/test-gold-venue.mjs                                       */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const START = 'const GOLD_SRC_LABEL';
const END = '  S.candleCache[key] = { rows: rows, at: nowSec() };\n  return rows;\n}';
const a = html.indexOf(START);
if (a < 0) throw new Error('FAIL: GOLD_SRC_LABEL block not found in index.html');
const k = html.indexOf(END, html.indexOf('async function getXAUCandles', a));
if (k < 0) throw new Error('FAIL: getXAUCandles block not found in index.html');
const block = html.slice(a, k + END.length);
function mkRows(n, base){
  const out = [];
  for (let i = 0; i < n; i++){
    const c = base + Math.sin(i / 7) * 20;
    out.push({ t: 1754400000 - (n - i) * 14400, o: c, h: c + 5, l: c - 5, c: c, v: 100 });
  }
  return out;
}
/* scenario: 'ok' = Delta has full history, 'thin' = short listing,
   'down' = Delta leg fails outright. Proxy always returns 260 bars @ 4200. */
function run(scenario){
  const ctx = {
    console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, encodeURIComponent,
    DELTA: 'https://api.india.delta.exchange',
    DELTA_RES: { '15m':'15m','1h':'1h','2h':'2h','4h':'4h','1d':'1d' },
    GOLD_SYM: 'XAUTUSD',
    nowSec: () => 1754400000,
    S: { candleCache: {} },
    hgCandleCacheTtl: () => 60,
    $: () => null,
    dropForming: (rows) => rows,
    getGoldCandles: async () => ({ rows: mkRows(260, 4200), source: 'binance-xau' }),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.fetch = async (url) => {
    if (String(url).indexOf('delta.exchange') < 0) return { ok: false };
    if (scenario === 'down') return { ok: false };
    const n = scenario === 'thin' ? 40 : 260;
    return { ok: true, json: async () => ({
      result: mkRows(n, 4221).map(r => ({ time: r.t, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v })) }) };
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx, { filename: 'gold-block' });
  return ctx;
}
console.log('== Delta XAUTUSD is the PRIMARY gold candle source ==');
{
  const ctx = run('ok');
  const rows = await ctx.getXAUCandles('4h', 260);
  ok(rows.length === 260, 'full XAUTUSD history returned');
  ok(ctx.S.goldDataSource === 'delta-xaut', 'source is the tradable instrument, not a proxy');
  ok(Math.abs(rows[rows.length - 1].c - 4221) < 25, 'levels priced off XAUTUSD (~4221), not the proxy (~4200)');
  ok(ctx.S.goldBasisPct === null, 'no basis recorded — none exists when levels are native');
  ok(ctx.hgGoldBasisNote() === '', 'no proxy warning on a native read');
}
console.log('== a SHORT XAUTUSD listing falls back but DECLARES the basis ==');
{
  const ctx = run('thin');
  const rows = await ctx.getXAUCandles('4h', 260);
  ok(rows.length === 260, 'proxy history used when XAUT history is too short for EMA200');
  ok(ctx.S.goldDataSource === 'binance-xau', 'source honestly reports the proxy');
  ok(ctx.S.goldBasisPct !== null && isFinite(ctx.S.goldBasisPct), 'basis measured against XAUTUSD');
  ok(ctx.S.goldBasisPct > 0.4 && ctx.S.goldBasisPct < 0.6, 'basis ~+0.5% matches the fixture spread');
  const note = ctx.hgGoldBasisNote();
  ok(note.indexOf('PROXY LEVELS') === 0, 'ticket note leads with PROXY LEVELS');
  ok(note.indexOf('XAUTUSD') > 0 && note.indexOf('0.50%') > 0, 'note names the instrument and the basis');
}
console.log('== a DEAD XAUTUSD leg warns HARDER, never softer ==');
{
  const ctx = run('down');
  const rows = await ctx.getXAUCandles('4h', 260);
  ok(rows.length === 260, 'proxy still serves candles so the tab does not go dark');
  ok(ctx.S.goldBasisPct === null, 'basis cannot be measured with no XAUT candles');
  const note = ctx.hgGoldBasisNote();
  /* isFinite(null) === true in JS — a naive guard reported a -100% basis here,
     and a source-blind guard reported NO warning at all. Both are wrong. */
  ok(note !== '', 'an unmeasurable basis still produces a warning');
  ok(note.indexOf('UNMEASURED') > 0, 'the note says UNMEASURED rather than inventing a number');
  ok(note.indexOf('-100') < 0, 'no bogus -100% basis from isFinite(null)');
}
console.log('\n' + passed + ' passed, 0 failed');
