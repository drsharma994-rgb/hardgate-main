/* The candle forecast names a lean only when two reads agree and none oppose.
   The band is one ATR around the last close. It does not mint a target or a stop. */
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
  ok(bull.tp1 == null && bull.sl == null && bull.confidence == null, 'no target, stop, or fake confidence is minted');

  const quiet = forecast(chop(40));
  ok(quiet && quiet.dir == null && quiet.lean === 'unread', 'a mixed tape stays unread (' + (quiet && quiet.reasons || []).join(' | ') + ')');
  ok(quiet.expectedHigh > quiet.expectedLow, 'an unread tape still has a measured band');

  const flat = [];
  for (let i = 0; i < 25; i++) flat.push({ t: i, o: 100, h: 100, l: 100, c: 100, v: 1 });
  const none = forecast(flat);
  ok(none && none.lean === 'unread' && none.expectedHigh == null, 'a candle with no range casts no band');
  ok(forecast(up(10)) == null, 'a short tape stays null');
}

console.log('== the tab does not invent a trade ==');
{
  const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  ok(tab.indexOf('tp1') < 0 && tab.indexOf('Stop Loss') < 0, 'the card no longer prints a target or a stop');
  ok(tab.indexOf('getGoldCandles') >= 0 && tab.indexOf('api.binance.com/api/v3/klines') < 0,
    'the tape comes from the house gold loader, not a raw spot URL');
  ok(tab.indexOf('NO DIRECTIONAL CALL') >= 0, 'an unread lean is labeled as no call');
}

console.log('\npassed: ' + pass);
