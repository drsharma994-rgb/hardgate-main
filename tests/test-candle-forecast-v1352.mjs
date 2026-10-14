/* hg-v1352: desks on the bars already loaded can confirm. The long
   read sits one step under the first line. The location line names the
   session from the shared killzone read. Unread is not agreement. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };

function boot(files) {
  const ctx = { console, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseInt, parseFloat, Intl };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.document = { getElementById: function () { return null; }, querySelector: function () { return null; } };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
function tape(n, dir, t0) {
  const rows = [];
  let p = 4080;
  const step = dir === 'bear' ? -0.4 : 0.4;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o + step;
    rows.push({ t: (t0 || 1760000000) + i * 900, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.4, c, v: 1000 });
    p = c;
  }
  return rows;
}
function quiet(ctx, shape) {
  ctx.hgCfCandlePatterns = function () {
    return {
      bullVotes: shape === 'bull' ? 1 : 0,
      bearVotes: shape === 'bear' ? 1 : 0,
      names: shape === 'none' ? [] : ['test shape'],
      bullNames: shape === 'bull' ? ['bullish engulfing'] : [],
      bearNames: shape === 'bear' ? ['bearish engulfing'] : [],
      notes: [], longStop: null, shortStop: null
    };
  };
  ctx.hgCfAdvancedPatterns = function () { return { names: [], notes: [], leans: [], where: 'at the range high', aligned: 'up' }; };
  ctx.hgCfStructure = function () { return { bullVotes: 0, bearVotes: 0, bullNames: [], bearNames: [], notes: [] }; };
  ctx.hgCfGoldDesk = function () { return { bullVotes: 0, bearVotes: 0, bullNames: [], bearNames: [], notes: ['no fresh gold-desk cross'] }; };
  ctx.hgCfHigherFrame = function () { return { bullNames: [], bearNames: [], notes: ['higher timeframes unread'], line: 'higher timeframes unread' }; };
  ctx.optiGoldState = function () { return null; };
  ctx.superGoldScan = function () { return null; };
  ctx.goldUltraState = function () { return null; };
  ctx.ganeshGoldState = function () { return null; };
  ctx.goldScalpSetups = function () { return []; };
  ctx.goldSwingSetups = function () { return { ranked: [] }; };
  ctx.ngAssess = function () { return null; };
  ctx.goldPineScan = function () { return null; };
}

console.log('== a desk on the loaded bars can confirm, and its price cannot ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  quiet(ctx, 'bull');
  const rows = tape(48);
  ctx.goldScalpSetups = function (inp) {
    ok(inp && inp.news === null && Array.isArray(inp.rows15m), 'the scalp mint is handed the bars already loaded');
    return [{ dir: 'long', entry: 1, stop: 999, t1: 2 }];
  };
  const on = ctx.goldCandleForecast(rows, null, { cachedDesks: true, tf: '15m' });
  ok(on && on.setup === 'LONG SETUP' && /GOLD SCALP/.test(on.setupParts), 'GOLD SCALP confirms the named shape (' + (on && on.setupParts) + ')');
  ok(on.sl !== 999, 'the scalp stop is not copied (' + (on && on.sl) + ')');
  quiet(ctx, 'bull');
  ctx.ngAssess = function () { return { dir: 'long', stop: 999, entry: 1 }; };
  const ng = ctx.goldCandleForecast(rows, null, { cachedDesks: true, tf: '15m' });
  ok(ng && ng.setup === 'LONG SETUP' && /NEW GOLD/.test(ng.setupParts) && ng.sl !== 999, 'NEW GOLD confirms and does not price the stop');
  quiet(ctx, 'bear');
  let scalpCalls = 0;
  ctx.goldScalpSetups = function () { scalpCalls++; return [{ dir: 'short' }]; };
  ctx.goldSwingSetups = function (inp) {
    ok(inp && Array.isArray(inp.rows4h) && inp.rows4h.length === 48, 'the swing mint reads the 4h bars in hand');
    return { ranked: [{ dir: 'short', stop: 999 }] };
  };
  const sw = ctx.goldCandleForecast(tape(48, 'bear'), null, { cachedDesks: true, tf: '4h' });
  ok(scalpCalls === 0, 'the 15m scalp mint is not run on the 4h tape');
  ok(sw && sw.setup === 'SHORT SETUP' && /GOLD SWING/.test(sw.setupParts) && sw.sl !== 999, 'GOLD SWING confirms the 4h shape');
  quiet(ctx, 'bull');
  ctx.goldPineScan = function () { return { scalp: [{ dir: 'long' }], swing: [{ dir: 'short' }] }; };
  const split = ctx.goldCandleForecast(rows, null, { cachedDesks: true, tf: '15m' });
  ok(split && !split.setup, 'a split pine snap does not confirm');
  ctx.goldPineScan = function () { return null; };
  const none = ctx.goldCandleForecast(rows, null, { cachedDesks: true, tf: '15m' });
  ok(none && !none.setup && none.missing === 'no structure or desk confirm', 'an engine that forms nothing stays unread');
}

console.log('\n== the session is named, and it does not vote ==');
{
  const ctx = boot(['gold-session.js', 'indicators.js', 'indicators2.js', 'goldind.js']);
  quiet(ctx, 'bull');
  const t0 = Math.floor(Date.UTC(2026, 9, 14, 7, 30, 0) / 1000) - 47 * 900;
  const rows = tape(48, 'bull', t0);
  const a = ctx.goldCandleForecast(rows, null, { cachedDesks: true, tf: '15m' });
  const line = (a.reasons || []).join(' | ');
  ok(/pattern location: at the range high · the 20-bar drift is up · session London/.test(line), 'London is named on the location line (' + line.slice(line.indexOf('pattern location'), line.indexOf('pattern location') + 120) + ')');
  ctx.hgGoldKillzoneRead = function () { return { zone: 'NY_AM', weight: 99, label: 'NY AM' }; };
  const b = ctx.goldCandleForecast(rows, null, { cachedDesks: true, tf: '15m' });
  ok(/session New York/.test((b.reasons || []).join(' | ')), 'New York is the same read');
  ok(b.agrees === a.agrees && b.checked === a.checked && b.sl === a.sl && b.setup === a.setup, 'the session does not change the call, the count, or the stop');
  ok(!/99/.test((b.reasons || []).join(' | ')), 'the session weight is not printed');
}

console.log('\n== the long read sits one step under the first line ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-candle-forecast.js']);
  const tab = (ctx.HG_tabs || []).filter(function (t) { return t && t.id === 'candle-forecast'; }).pop();
  const el = { innerHTML: '', className: '' };
  tab.renderResult(el, { textContent: '' }, {
    close: 4100, agrees: 1, against: 0, checked: 1, reasons: ['drift'], patterns: [],
    scalp: { ok: true, tf: '15m', dir: 'BULL', formed: false, patterns: [] },
    swing: {
      ok: true, tf: '4h', dir: 'BULL', formed: false, label: 'LONG READ',
      entry: 4100, stop: 4090, tp1: 4110, tp2: 4120, stopSource: 'ATR', riskAtr: 1,
      missing: 'no named shape', patterns: []
    },
    daySwings: { setups: [], why: 'none' }
  });
  const html = el.innerHTML;
  const callAt = html.indexOf('omni-side-call');
  const swingAt = html.indexOf('data-cf-swing-always');
  const restAt = html.indexOf('<details');
  const readsAt = html.indexOf('Reads:');
  ok(callAt >= 0 && swingAt > callAt && restAt > swingAt && readsAt > restAt, 'the call and the swing come before the rest of the read');
  ok(/The rest of the read/.test(html) && /not published/.test(html), 'the long read is still there, and the scalp is still not published');
  const src = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  ok(/hgCfDaySwings[\s\S]{0,200}limit:\s*2/.test(src), 'the day list is still capped at two');
  ok(!/stop\s*=\s*[^=]/.test(src) && !/tp1\s*=\s*[^=]/.test(src), 'the tab still assigns no stop and no target');
}

console.log('\ntest-candle-forecast-v1352: ' + pass + ' passed');
