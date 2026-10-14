/* hg-v1354: the session is on the first line. The swing price is printed
   once, with the close and the feed beside it. An empty day names what
   stopped the last 4h bar. */
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
      bullVotes: shape === 'bull' ? 1 : 0, bearVotes: shape === 'bear' ? 1 : 0,
      names: ['test shape'], bullNames: shape === 'bull' ? ['bullish engulfing'] : [],
      bearNames: shape === 'bear' ? ['bearish engulfing'] : [], notes: [], longStop: null, shortStop: null
    };
  };
  ctx.hgCfAdvancedPatterns = function () { return { names: [], notes: [], leans: [], where: 'at the range high', aligned: 'up' }; };
  ctx.hgCfStructure = function () { return { bullVotes: 0, bearVotes: 0, bullNames: [], bearNames: [], notes: [] }; };
  ctx.hgCfGoldDesk = function () { return { bullVotes: 0, bearVotes: 0, bullNames: [], bearNames: [], notes: ['no fresh gold-desk cross'] }; };
  ctx.hgCfHigherFrame = function () { return { bullNames: [], bearNames: [], notes: ['higher timeframes unread'], line: 'higher timeframes unread' }; };
  ctx.goldScalpSetups = function () { return []; };
  ctx.goldSwingSetups = function () { return { ranked: [] }; };
  ctx.ngAssess = function () { return null; };
  ctx.goldPineScan = function () { return null; };
}

console.log('== the session rides the read and does not vote ==');
{
  const ctx = boot(['gold-session.js', 'indicators.js', 'indicators2.js', 'goldind.js']);
  quiet(ctx, 'bull');
  const t0 = Math.floor(Date.UTC(2026, 9, 14, 7, 30, 0) / 1000) - 47 * 900;
  const rows = tape(48, 'bull', t0);
  const a = ctx.goldCandleForecast(rows, null, null);
  ok(a && a.session === 'London', 'the read names London (' + (a && a.session) + ')');
  const built = ctx.hgCfBuildSetup(rows, { tf: '4h' }, a);
  ok(built.session === 'London' && built.missing === 'no structure or desk confirm', 'the swing carries the session and the missing confirm');
  const sl = a.sl, agrees = a.agrees, setup = a.setup;
  ctx.hgGoldKillzoneRead = function () { return { zone: 'NY_AM', weight: 99, label: 'NY AM' }; };
  const b = ctx.goldCandleForecast(rows, null, null);
  ok(b.session === 'New York' && b.sl === sl && b.agrees === agrees && b.setup === setup, 'a different session does not move the stop or the call');
  ok(!/99/.test((b.reasons || []).join(' | ')), 'the session weight is not printed');
}

console.log('\n== the first line, one price, the close, and the feed ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-candle-forecast.js']);
  const tab = (ctx.HG_tabs || []).filter(function (t) { return t && t.id === 'candle-forecast'; }).pop();
  const el = { innerHTML: '', className: '' };
  tab.renderResult(el, { textContent: '' }, {
    close: 4100, source: 'HOUSE GOLD', agrees: 1, against: 0, checked: 1, reasons: ['drift'], patterns: [],
    scalp: { ok: true, tf: '15m', dir: 'BULL', formed: false, patterns: [] },
    swing: {
      ok: true, tf: '4h', dir: 'BULL', formed: false, label: 'LONG READ', session: 'London',
      entry: 4100, stop: 4090.25, tp1: 4110, tp2: 4120, stopSource: 'ATR', riskAtr: 1,
      missing: 'no structure or desk confirm', patterns: ['bullish engulfing'], source: 'HOUSE GOLD'
    },
    daySwings: { setups: [], why: 'none' }
  });
  const html = el.innerHTML;
  const call = html.slice(html.indexOf('omni-side-call'), html.indexOf('omni-side-call') + 180);
  ok(/LONG READ · SWING · no structure or desk confirm · session London/.test(call), 'the first line names the session beside the missing confirm');
  const face = html.slice(0, html.indexOf('<details'));
  const rest = html.slice(html.indexOf('data-cf-horizons'));
  ok((face.match(/4090\.25/g) || []).length === 1, 'the swing stop is on the face once');
  ok(face.indexOf('Last close:') >= 0 && face.indexOf('Feed:') >= 0 && /HOUSE GOLD/.test(face), 'the last close and the feed sit with the levels');
  ok(!/4090\.25/.test(rest) && /not priced again here/.test(rest), 'the folded table does not price the swing again');
  ok(/not published/.test(html), 'the scalp is still not published');
}

console.log('\n== an empty day names the stop and the bars walked ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  const t0 = Date.UTC(2026, 9, 14, 8, 0, 0);
  const rows = [];
  for (let i = 0; i < 36; i++) rows.push({ t: t0 + i * 60000, o: 100, h: 101, l: 99, c: 100 });
  let asked = 0;
  ctx.goldCandleForecast = function (slice, macro, tapes) {
    if (tapes) asked++;
    return { dir: 'BULL', close: slice[slice.length - 1].c };
  };
  ctx.hgCfBuildSetup = function () {
    return { formed: false, dir: 'BULL', missing: 'higher timeframe against', entry: 100, stop: 99, tp1: 101 };
  };
  const none = ctx.hgCfDaySwings(rows, {
    live: { formed: false, dir: 'BULL', missing: 'no named shape', entry: 100, stop: 99, tp1: 101 },
    limit: 2
  });
  ok(asked === 0 && none.setups.length === 0, 'the walk still asks for no higher tape, and nothing unconfirmed is listed');
  ok(/The last 4h bar stopped on no named shape/.test(none.why), 'the empty day names what stopped the last bar (' + none.why + ')');
  ok(none.walked === 6 && /6 bars of this day were walked/.test(none.why), 'it counts the bars of this day that were walked');
  ok(/Nothing was invented/.test(none.why) && !/Entry/.test(none.why), 'an unconfirmed read is not given a price');
  ctx.hgCfBuildSetup = function (slice, opts, fc) {
    return { formed: true, dir: 'BULL', label: 'LONG SETUP', entry: fc.close, stop: fc.close - 1, tp1: fc.close + 1, tp2: fc.close + 2, parts: 'hammer' };
  };
  const full = ctx.hgCfDaySwings(rows, { live: { formed: true, dir: 'BULL', label: 'LONG SETUP', entry: 999, stop: 998, tp1: 1000, tp2: 1001 }, limit: 2 });
  ok(full.setups.length === 2 && /Two are enough for the day/.test(full.why) && !/stopped on/.test(full.why), 'a full day still caps at two and does not invent a missing line');
}

console.log('\n== the pins ==');
{
  const src = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  const gold = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
  ok(/hgCfDaySwings[\s\S]{0,200}limit:\s*2/.test(src), 'the day list is still capped at two');
  ok(!/stop\s*=\s*[^=]/.test(src) && !/tp1\s*=\s*[^=]/.test(src), 'the tab still assigns no stop and no target');
  ok(/goldCandleForecast\(slice, null, null\)/.test(gold), 'the day walk still passes no higher tape');
}

console.log('\ntest-candle-forecast-v1354: ' + pass + ' passed');
