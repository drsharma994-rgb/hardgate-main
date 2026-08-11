/* HARDGATE — gold ticket/venue parity.
   getXAUCandles is the single choke point: index.html, brain.js, scorecard.js,
   startrader.js and macro-feeds.js all enter through it.
   Spot-aligned feeds (XM → macro.js proxies) must rank above Delta XAUTUSD
   so levels match broker ~4397, not XAUT ~4330.
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
const END = '  throw new Error(\'XAUUSD data unavailable from all sources (XM, spot proxies, Delta XAUTUSD)\');\n}';
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
    getGoldCandles: async () => ({ rows: mkRows(260, 4390), source: 'binance-xau' }),
    getXmGoldCandles: async () => ({ rows: [], source: null }),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.CDCX_PROXY = (u) => '/api/proxy?url=' + encodeURIComponent(u);
  ctx.sleep = async () => {};
  ctx.trackCall = () => {};
  ctx.deltaGet = async (url) => {
    async function readJson(r){
      if (!r || !r.ok) throw new Error('delta HTTP fail');
      return r.json();
    }
    try{ return await readJson(await ctx.fetch(ctx.CDCX_PROXY(url))); }catch(e){}
    return readJson(await ctx.fetch(url));
  };
  ctx.fetch = async (url) => {
    const probe = (function(){ try{ return decodeURIComponent(String(url)); }catch(e){ return String(url); } })();
    if (probe.indexOf('delta.exchange') < 0 && String(url).indexOf('delta.exchange') < 0) return { ok: false };
    if (scenario === 'down') return { ok: false };
    const n = scenario === 'thin' ? 40 : 260;
    return { ok: true, json: async () => ({
      result: mkRows(n, 4221).map(r => ({ time: r.t, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v })) }) };
  };
  vm.createContext(ctx);
  vm.runInContext(block, ctx, { filename: 'gold-block' });
  return ctx;
}
console.log('== spot proxy is PRIMARY gold candle source (not XAUT) ==');
{
  const ctx = run('ok');
  const rows = await ctx.getXAUCandles('4h', 260);
  ok(rows.length === 260, 'full spot history returned');
  ok(ctx.S.goldDataSource === 'binance-xau', 'source is spot-aligned proxy, not delta-xaut');
  ok(Math.abs(rows[rows.length - 1].c - 4390) < 25, 'levels priced off spot proxy (~4390), not XAUT (~4221)');
  ok(ctx.S.goldBasisPct !== null && isFinite(ctx.S.goldBasisPct), 'basis to XAUT measured for Delta tickets');
  ok(ctx.hgGoldBasisNote().indexOf('PROXY') >= 0 || ctx.hgGoldBasisNote().indexOf('binance') >= 0, 'proxy note when not native XAUT');
}
console.log('== preferDeltaXaut opts into Delta XAUTUSD ==');
{
  const ctx = run('ok');
  const rows = await ctx.getXAUCandles('4h', 260, { preferDeltaXaut: true });
  ok(ctx.S.goldDataSource === 'delta-xaut', 'explicit XAUT preference honored');
  ok(Math.abs(rows[rows.length - 1].c - 4221) < 25, 'XAUT levels when preferDeltaXaut');
  ok(ctx.hgGoldBasisNote() === '', 'no proxy warning on native XAUT read');
}
console.log('== XM broker feed wins when configured ==');
{
  const ctx = run('ok');
  ctx.getXmGoldCandles = async () => ({ rows: mkRows(260, 4397), source: 'xm-xauusd' });
  const rows = await ctx.getXAUCandles('4h', 260);
  ok(ctx.S.goldDataSource === 'xm-xauusd', 'XM source when bridge returns candles');
  ok(Math.abs(rows[rows.length - 1].c - 4397) < 25, 'broker-aligned XM price');
}
console.log('== thin proxy still beats wide-basis XAUT when enough bars ==');
{
  const ctx = run('thin');
  const rows = await ctx.getXAUCandles('4h', 260);
  ok(rows.length === 260, 'proxy history used when XAUT history is too short for EMA200');
  ok(ctx.S.goldDataSource === 'binance-xau', 'spot proxy chosen over thin XAUT');
}
console.log('== dead Delta leg still serves spot proxy ==');
{
  const ctx = run('down');
  const rows = await ctx.getXAUCandles('4h', 260);
  ok(rows.length === 260, 'spot proxy when Delta unreachable');
  ok(ctx.S.goldDataSource === 'binance-xau', 'spot source when Delta down');
}
console.log('\n' + passed + ' assertions passed');
