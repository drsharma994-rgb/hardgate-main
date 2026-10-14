/* hg-v1355: the live swing is not priced twice. A confirmed swing names
   its bar time and session. The 4h forward sentence sits on the face. */
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

console.log('== one price, a clock, and the forward sentence ==');
{
  const ctx = boot(['gold-session.js', 'indicators.js', 'indicators2.js', 'goldind.js', 'gold-candle-forecast.js']);
  const tab = (ctx.HG_tabs || []).filter(function (t) { return t && t.id === 'candle-forecast'; }).pop();
  const london = Date.UTC(2026, 9, 14, 7, 30, 0);
  const ny = Date.UTC(2026, 9, 14, 15, 0, 0);
  const el = { innerHTML: '', className: '' };
  tab.renderResult(el, { textContent: '' }, {
    close: 4100, source: 'HOUSE GOLD', agrees: 1, against: 0, checked: 1, reasons: [], patterns: [],
    scalp: { ok: true, tf: '15m', dir: 'BULL', formed: false, patterns: [] },
    swing: {
      ok: true, tf: '4h', dir: 'BULL', formed: true, label: 'LONG SETUP', session: 'New York',
      entry: 4100, stop: 4090.25, tp1: 4110, tp2: 4120, stopSource: 'ATR', riskAtr: 1, patterns: []
    },
    daySwings: {
      setups: [
        { dir: 'BULL', label: 'LONG SETUP', entry: 4000, stop: 3990, tp1: 4010, tp2: 4020, parts: 'hammer', barT: london, tf: '4h' },
        { dir: 'BULL', label: 'LONG SETUP', entry: 4100, stop: 4090.25, tp1: 4110, tp2: 4120, parts: 'engulfing', barT: ny, tf: '4h' }
      ],
      why: '2 confirmed swing setups. Two are enough for the day.'
    },
    measure: {
      fwd4: { why: 'Recorded 1 new setup on the forward ledger. Settled 2 older records on bars that printed after they were logged.' },
      walk4: { why: '3 formed, 1 reached TP1. in-sample on this tape only.' }
    }
  });
  const html = el.innerHTML;
  const cut = html.indexOf('<details');
  const face = html.slice(0, cut);
  const rest = html.slice(cut);
  ok((face.match(/4090\.25/g) || []).length === 1, 'the live swing stop is priced once');
  ok(/This is the swing above/.test(face) && /3990/.test(face), 'the other confirmed swing keeps its own stop');
  ok(/time 2026-10-14 07:30 UTC · session London/.test(face), 'the earlier swing names its bar and London');
  ok(/time 2026-10-14 15:00 UTC · session London and New York/.test(face), 'the live swing names its bar and the overlap, without a second price');
  ok(face.indexOf('data-cf-forward') >= 0 && /Recorded 1 new setup/.test(face) && /Settled 2 older records/.test(face), 'the forward sentence is on the face');
  ok(!/reached TP1/.test(face) && /in-sample on this tape only/.test(rest), 'the in-sample walk stays folded and is not called a win');
  ok(/not published/.test(rest), 'the scalp is still not published');
  ok(/Out of sample. Not a probability/.test(face), 'the forward line is not a probability');
}

console.log('\n== no time and no ledger stay unread ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'gold-candle-forecast.js']);
  const tab = (ctx.HG_tabs || []).filter(function (t) { return t && t.id === 'candle-forecast'; }).pop();
  const el = { innerHTML: '', className: '' };
  tab.renderResult(el, { textContent: '' }, {
    close: 4100, agrees: 0, against: 0, checked: 0, reasons: [], patterns: [],
    swing: { ok: true, tf: '4h', dir: 'BULL', formed: true, label: 'LONG SETUP', entry: 4100, stop: 4090, tp1: 4110, tp2: 4120, stopSource: 'ATR', riskAtr: 1 },
    daySwings: { setups: [{ dir: 'BULL', label: 'LONG SETUP', entry: 4000, stop: 3990, tp1: 4010, barT: null, tf: '4h' }], why: '1 confirmed' }
  });
  const face = el.innerHTML.slice(0, el.innerHTML.indexOf('<details'));
  ok(/time unread/.test(face) && !/session London/.test(face), 'a bar with no time says so and invents no session');
  ok(/was not read this scan/.test(face) && /Nothing was counted as a win/.test(face), 'a missing ledger is not a win');
  ok(/3990/.test(face), 'a swing that is not the one on the face still shows its stop');
}

console.log('\n== the pins ==');
{
  const src = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  const gold = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
  ok(/hgCfDaySwings[\s\S]{0,200}limit:\s*2/.test(src), 'the day list is still capped at two');
  ok(!/stop\s*=\s*[^=]/.test(src) && !/tp1\s*=\s*[^=]/.test(src), 'the tab still assigns no stop and no target');
  ok(/window\.hgCfSessionName/.test(src) && !/Europe\/London/.test(src), 'the day clock is the shared session read');
  ok(/goldCandleForecast\(slice, null, null\)/.test(gold), 'the day walk still passes no higher tape');
  ok(/this\.renderResult\(resultArea, statusEl, forecast\);[\s\S]{0,500}hgUltimateConfluence\(candles\)/.test(src), 'the wide tally still paints after the card');
}

console.log('\ntest-candle-forecast-v1355: ' + pass + ' passed');
