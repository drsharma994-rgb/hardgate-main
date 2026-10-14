/* hg-v1351: the first line names the missing confirm. A desk already
   scanned can confirm a named shape. Unread is not agreement. The scalp
   stays unpublished, the day list stays capped at two, and the stop is
   still the engine's own. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok -', m); };

function boot(files) {
  const ctx = { console, Math, Date, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseInt, parseFloat };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.document = { getElementById: function () { return null; }, querySelector: function () { return null; } };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
function tape(n, dir) {
  const rows = [];
  let p = 4080;
  const step = dir === 'bear' ? -0.4 : 0.4;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o + step;
    rows.push({ t: 1760000000 + i * 900, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.4, c, v: 1000 });
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
      notes: [],
      longStop: null,
      shortStop: null
    };
  };
  ctx.hgCfAdvancedPatterns = function () { return { names: [], notes: [], leans: [] }; };
  ctx.hgCfStructure = function () { return { bullVotes: 0, bearVotes: 0, bullNames: [], bearNames: [], notes: [] }; };
  ctx.hgCfGoldDesk = function () { return { bullVotes: 0, bearVotes: 0, bullNames: [], bearNames: [], notes: ['no fresh gold-desk cross'] }; };
  ctx.hgCfHigherFrame = function () {
    return { bullNames: [], bearNames: [], notes: ['higher timeframes unread'], line: 'higher timeframes unread' };
  };
}
function opti(dir) {
  return function () {
    return { setups: [{ state: 'open', dir: dir, entry: 1, stop: 999, tp1: 2 }] };
  };
}

console.log('== a scanned desk confirms, and its prices are not the stop ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  quiet(ctx, 'bull');
  const rows = tape(48);
  const bare = ctx.goldCandleForecast(rows, null, { cachedDesks: true });
  ok(bare && !bare.setup && bare.missing === 'no structure or desk confirm', 'no scanned desk leaves the confirm missing (' + (bare && bare.missing) + ')');
  const builtBare = ctx.hgCfBuildSetup(rows, { tf: '4h' }, bare);
  ok(builtBare.formed !== true && builtBare.missing === 'no structure or desk confirm', 'the builder keeps that missing line');
  ctx.optiGoldState = opti('long');
  const off = ctx.goldCandleForecast(rows, null, null);
  ok(off && !off.setup, 'a cached desk does not confirm a walk that did not ask for the cache');
  const on = ctx.goldCandleForecast(rows, null, { cachedDesks: true });
  ok(on && on.setup === 'LONG SETUP' && /OPTI GOLD/.test(on.setupParts), 'the scanned desk confirms the named shape (' + (on && on.setupParts) + ')');
  ok(on.dir === bare.dir && on.agrees === bare.agrees && on.checked === bare.checked, 'the desk does not change the call or the count');
  ok(on.sl === bare.sl && on.tp1 === bare.tp1 && on.sl !== 999, 'the desk stop is not copied (' + on.sl + ')');
  const built = ctx.hgCfBuildSetup(rows, { tf: '4h' }, on);
  ok(built.formed === true && built.missing == null, 'a formed swing has no missing line');
}

console.log('\n== unread, split, against, and record-only do not confirm ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  quiet(ctx, 'bull');
  const rows = tape(48);
  ctx.optiGoldState = function () { return null; };
  ctx.superGoldScan = function () { return { cands: [{ dir: 'long', stop: 999 }, { dir: 'short', stop: 1 }] }; };
  ctx.goldUltraState = function () { return { fire: true, recordOnly: true, dir: 'long' }; };
  const split = ctx.goldCandleForecast(rows, null, { cachedDesks: true });
  ok(split && !split.setup && split.missing === 'no structure or desk confirm', 'a split scan and a record-only print stay unread');
  ctx.superGoldScan = function () { return null; };
  ctx.goldUltraState = function () { return null; };
  ctx.optiGoldState = opti('short');
  const against = ctx.goldCandleForecast(rows, null, { cachedDesks: true });
  ok(against && against.dir === 'BULL' && !against.setup, 'a desk against the call does not confirm and does not flip the call');
}

console.log('\n== the other two missing lines, and a short confirm ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  quiet(ctx, 'none');
  ctx.optiGoldState = opti('long');
  const none = ctx.goldCandleForecast(tape(48), null, { cachedDesks: true });
  ok(none && !none.setup && none.missing === 'no named shape', 'no named shape stays unnamed (' + (none && none.missing) + ')');
  quiet(ctx, 'bull');
  ctx.hgCfHigherFrame = function () {
    return { bullNames: [], bearNames: ['1d break of structure'], notes: [], line: '1d against' };
  };
  const blocked = ctx.goldCandleForecast(tape(48), null, { cachedDesks: true });
  ok(blocked && !blocked.setup && blocked.missing === 'higher timeframe against', 'a higher timeframe against is named (' + (blocked && blocked.missing) + ')');
  quiet(ctx, 'bear');
  ctx.hgCfHigherFrame = function () {
    return { bullNames: [], bearNames: [], notes: ['higher timeframes unread'], line: 'higher timeframes unread' };
  };
  ctx.optiGoldState = opti('short');
  const short = ctx.goldCandleForecast(tape(48, 'bear'), null, { cachedDesks: true });
  ok(short && short.setup === 'SHORT SETUP' && /OPTI GOLD/.test(short.setupParts), 'a scanned short desk confirms a short shape');
}

console.log('\n== the card, the scalp, the cap, and the stop ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-candle-forecast.js']);
  const tab = (ctx.HG_tabs || []).filter(function (t) { return t && t.id === 'candle-forecast'; }).pop();
  ok(tab && typeof tab.renderResult === 'function', 'the candle tab is mounted');
  const el = { innerHTML: '', className: '' };
  const status = { textContent: '' };
  tab.renderResult(el, status, {
    close: 4100, agrees: 1, against: 0, checked: 1, reasons: [], patterns: [],
    scalp: { ok: true, tf: '15m', dir: 'BULL', formed: false, patterns: [] },
    swing: {
      ok: true, tf: '4h', dir: 'BULL', formed: false, label: 'LONG READ',
      entry: 4100, stop: 4090, tp1: 4110, tp2: 4120, stopSource: 'ATR', riskAtr: 1,
      missing: 'no structure or desk confirm', patterns: ['bullish engulfing']
    },
    daySwings: { setups: [], why: 'none' }
  });
  ok(el.innerHTML.indexOf('LONG READ · SWING · no structure or desk confirm') >= 0, 'the first line names the missing confirm');
  ok(el.innerHTML.indexOf('not published') >= 0, 'the scalp is still not published');
  const src = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  const gold = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
  ok(/hgCfDaySwings[\s\S]{0,160}limit:\s*2/.test(src), 'the day list is still capped at two');
  ok(!/stop\s*=\s*[^=]/.test(src) && !/tp1\s*=\s*[^=]/.test(src), 'the tab still assigns no stop and no target');
  ok(/no named shape/.test(gold) && /higher timeframe against/.test(gold) && /no structure or desk confirm/.test(gold), 'the three missing lines live in the engine');
  ok(gold.indexOf('goldCandleForecast(slice, null, null)') >= 0, 'the walk still does not ask the live cache');
}

console.log('\ntest-candle-forecast-v1351: ' + pass + ' passed');
