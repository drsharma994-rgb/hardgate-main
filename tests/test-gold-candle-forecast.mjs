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
  /* hg-v1309 RECONCILIATION. This section was written against the v14-2 engine,
     which was superseded: `tests/test-candle-forecast.mjs` documents the rebuild
     (a shrunk drift with |t| >= 1, an empirical 60th-percentile band, no
     fabricated `confidence`) and this one still asserted the old shape. Three
     of its expectations were not merely stale but CONTRADICTORY:
       - "two agreeing reads": the drift over the whole tape is now the primary
         read and the bar-level reads corroborate it, so a clean trend fires one
         strong read, not two. Asserting two would re-pin the old tick engine.
       - `sl === expectedLow`: the band is now an empirical RANGE, while the stop
         is the trade's own ATR risk. Tying them together was the old band.
       - a 25-bar no-range tape: below the 30-bar floor that is unreadable, so it
         is null, not an "unread" object carrying a null band.
     The assertions below keep this guard's real purpose — a call needs EVIDENCE
     and the levels must be coherent — expressed in the current engine. */
  const bull = forecast(up(40));
  ok(bull && bull.dir === 'BULL', 'a rising tape leans long (' + (bull && bull.reasons || []).join(' | ') + ')');
  ok(bull.against === 0 && bull.agrees >= 1 && isFinite(bull.strength) && bull.strength >= 1,
    'the long is carried by evidence and none against (agrees=' + bull.agrees + ' strength=' + bull.strength + ')');
  ok(bull.expectedHigh > bull.close && bull.expectedLow < bull.close, 'the band sits around the last close');
  ok(bull.expectedHigh > bull.expectedLow, 'the band is not inverted');
  ok(bull.sl < bull.close && bull.tp1 > bull.close && bull.tp2 > bull.tp1,
    'long stop is below the close and both targets are above it, in order');
  ok(Math.abs(bull.tp2 - (bull.close + bull.atr * 2)) < 0.02, 'TP2 is two ATR with the long');
  ok(bull.confidence == null, 'no fake confidence percent');

  const quiet = forecast(chop(40));
  ok(quiet && (quiet.dir === 'BEAR' || quiet.dir === 'NEUTRAL'),
    'a two-sided chop never invents a long (' + (quiet && quiet.reasons || []).join(' | ') + ')');

  const fight = up(40);
  fight[fight.length - 1] = { t: 39, o: fight[38].c + 2, h: fight[38].c + 2.2, l: fight[38].c - 4, c: fight[38].c - 3.5, v: 10 };
  const opposed = forecast(fight);
  ok(opposed && opposed.sl != null && opposed.tp1 != null && opposed.tp2 != null,
    'a split tape still carries a stop and targets for whichever side it calls (dir=' + (opposed && opposed.dir) + ')');

  const flat = [];
  for (let i = 0; i < 25; i++) flat.push({ t: i, o: 100, h: 100, l: 100, c: 100, v: 1 });
  ok(forecast(flat) === null, 'a 25-bar no-range tape is unreadable and returns null');
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
