/* One unopposed read is a directional call. Stop is one ATR against the
   last close. TP1 is one ATR with it. TP2 is two. Fighting reads stay unread. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

const src = fs.readFileSync(path.join(root, 'goldind.js'), 'utf8');
const start = src.indexOf('function goldCandleForecast');
const end = src.indexOf('if (typeof window', start);
if (start < 0 || end < 0) throw new Error('engine not found');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'indicators.js'), 'utf8')
  + '\n' + src.slice(start, end)
  + '\nthis.goldCandleForecast = goldCandleForecast;\n',
  ctx
);
const forecast = ctx.goldCandleForecast;

function up(n){
  const rows = [];
  let p = 2000;
  for (let i = 0; i < n; i++){
    p += 2;
    rows.push({ t: i, o: p - 0.4, h: p + 0.3, l: p - 0.6, c: p, v: 10 });
  }
  return rows;
}
function chop(n){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 2000 + (i % 2 ? 1 : -1);
    rows.push({ t: i, o: 2000, h: c + 2, l: c - 2, c: c, v: 10 });
  }
  return rows;
}

console.log('== candle forecast leans only when reads agree ==');
{
  const bull = forecast(up(40));
  ok(bull && bull.dir === 'BULL', 'a rising tape leans long (' + (bull && bull.reasons || []).join(' | ') + ')');
  ok(bull.against === 0 && bull.agrees >= 2, 'the long has two agreeing reads and none against');
  ok(bull.expectedHigh > bull.close && bull.expectedLow < bull.close, 'the band sits around the last close');
  ok(bull.expectedHigh > bull.expectedLow, 'the band is not inverted');
  ok(bull.sl === bull.expectedLow && bull.tp1 === bull.expectedHigh, 'long stop is one ATR under the close and TP1 is one ATR over');
  ok(Math.abs(bull.tp2 - (bull.close + bull.atr * 2)) < 0.02, 'TP2 is two ATR with the long');
  ok(bull.confidence == null, 'no fake confidence percent');

  const quiet = forecast(chop(40));
  ok(quiet && quiet.dir === 'BEAR' && quiet.sl != null && quiet.tp1 != null,
    'one unopposed read is a call with a stop and a target (' + (quiet && quiet.reasons || []).join(' | ') + ')');

  const fight = up(40);
  fight[fight.length - 1] = { t: 39, o: fight[38].c + 2, h: fight[38].c + 2.2, l: fight[38].c - 4, c: fight[38].c - 3.5, v: 10 };
  const opposed = forecast(fight);
  ok(opposed && opposed.dir == null && opposed.sl == null,
    'bull and bear reads together stay unread and mint no stop (' + (opposed && opposed.reasons || []).join(' | ') + ')');

  const flat = [];
  for (let i = 0; i < 25; i++) flat.push({ t: i, o: 100, h: 100, l: 100, c: 100, v: 1 });
  const none = forecast(flat);
  ok(none && none.lean === 'unread' && none.expectedHigh == null, 'a candle with no range casts no band');
  ok(forecast(up(10)) == null, 'a short tape stays null');
}

console.log('== the tab does not invent a trade ==');
{
  const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  ok(tab.indexOf('TP1') >= 0 && tab.indexOf('Stop:') >= 0, 'the card prints the stop and the targets');
  ok(tab.indexOf('getGoldCandles') >= 0 && tab.indexOf('api.binance.com/api/v3/klines') < 0,
    'the tape comes from the house gold loader, not a raw spot URL');
  ok(tab.indexOf('NO DIRECTIONAL CALL') >= 0, 'an unread lean is labeled as no call');
}

console.log('\npassed: ' + pass);
