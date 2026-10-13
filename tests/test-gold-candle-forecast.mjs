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
const start = src.indexOf('function hgCfPack');
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
  ok(bull.setup == null, 'a staircase with no candle pattern does not form a setup');

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

  const base = up(30);
  base[27] = { t: 27, o: 2060, h: 2060.6, l: 2055, c: 2055.4, v: 10 };
  base[28] = { t: 28, o: 2054.8, h: 2055.6, l: 2054.2, c: 2055.1, v: 10 };
  base[29] = { t: 29, o: 2055.2, h: 2060.2, l: 2054.6, c: 2059.4, v: 10 };
  const star = forecast(base);
  ok(star && star.patterns.indexOf('morning star') >= 0 && star.dir === 'BULL',
    'a morning star is named and votes long (' + (star && star.patterns || []).join(', ') + ')');
  ok(star.stopSource === 'pattern' && Math.abs(star.sl - 2054.2) < 0.02,
    'the morning-star stop is the pattern low (' + (star && star.sl) + ' via ' + (star && star.stopSource) + ')');

  const eng = up(30);
  const prev = eng[28].c;
  eng[28] = { t: 28, o: prev - 1, h: prev + 0.4, l: prev - 1.4, c: prev, v: 10 };
  eng[29] = { t: 29, o: prev + 0.2, h: prev + 0.4, l: prev - 3.2, c: prev - 3, v: 10 };
  const bear = forecast(eng);
  ok(bear && bear.patterns.indexOf('bearish engulfing') >= 0,
    'a bearish engulfing is named (' + (bear && bear.patterns || []).join(', ') + ' | ' + (bear && bear.reasons || []).join(' | ') + ')');

  const noise = up(30);
  const nc = noise[29].c;
  noise[29] = { t: 29, o: nc, h: nc + 0.05, l: nc - 0.2, c: nc + 0.02, v: 10 };
  const tiny = forecast(noise);
  ok(tiny && tiny.patterns.indexOf('hammer') < 0, 'a wick smaller than the ATR gate is not a hammer');

  const decline = [];
  let dp = 2200;
  for (let i = 0; i < 30; i++) {
    dp -= 2;
    decline.push({ t: i, o: dp + 0.5, h: dp + 0.7, l: dp - 0.2, c: dp, v: 10 });
  }
  decline[29] = { t: 29, o: dp + 1.2, h: dp + 1.5, l: dp - 4, c: dp + 1.1, v: 10 };
  const ham = forecast(decline);
  ok(ham && ham.patterns.indexOf('hammer after a decline') >= 0 && ham.dir === 'BULL',
    'a hammer after a decline is a long (' + (ham && ham.patterns || []).join(', ') + ' dir=' + (ham && ham.dir) + ')');

  const climb = up(30);
  const top = climb[29].c;
  climb[29] = { t: 29, o: top - 0.4, h: top, l: top - 5, c: top - 0.2, v: 10 };
  const hang = forecast(climb);
  ok(hang && hang.patterns.indexOf('hanging man') >= 0 && hang.patterns.indexOf('hammer after a decline') < 0,
    'the same lower wick after a rise is a hanging man, not a hammer (' + (hang && hang.patterns || []).join(', ') + ')');

  const sweep = up(30);
  const sc = sweep[28].c;
  sweep[29] = { t: 29, o: sc - 1, h: sc + 0.3, l: sc - 20, c: sc + 0.1, v: 10 };
  const sw = forecast(sweep);
  ok(sw && sw.patterns.indexOf('low sweep reclaimed') >= 0,
    'a wick through the prior lows that closes back is a sweep (' + (sw && sw.patterns || []).join(', ') + ')');

  const rev = [];
  let rp = 2000;
  for (let i = 0; i < 12; i++) {
    rp += 1.5;
    rev.push({ t: i, o: rp - 1, h: rp + 0.4, l: rp - 1.4, c: rp, v: 10 });
  }
  const peak = rp + 0.4;
  for (let i = 12; i < 28; i++) {
    rp -= 1.2;
    rev.push({ t: i, o: rp + 1, h: rp + 1.3, l: rp - 0.3, c: rp, v: 10 });
  }
  rev.push({ t: 28, o: rp + 0.2, h: rp + 0.5, l: rp - 1.6, c: rp - 1.3, v: 10 });
  rev.push({ t: 29, o: rp - 1.5, h: peak + 2, l: rp - 1.8, c: peak + 1.4, v: 10 });
  const formed = forecast(rev);
  ok(formed && formed.setup === 'LONG SETUP',
    'a reversal candle through the prior high is a long setup (' + (formed && formed.setup) + ' | ' + (formed && formed.setupParts) + ' | ' + (formed && formed.reasons || []).join(' | ') + ')');

  const withFunds = forecast(decline, { realRateHint: 'TAILWIND', silverTrend: 'RISING' });
  ok(withFunds && withFunds.setup === 'LONG SETUP' && String(withFunds.setupParts).indexOf('real rate tailwind') >= 0
      && String(withFunds.setupParts).indexOf('silver rising') >= 0,
    'two measured gold-macro legs plus a hammer form the setup (' + (withFunds && withFunds.setupParts) + ')');
  const oneFund = forecast(decline, { realRateHint: 'TAILWIND' });
  ok(oneFund && String(oneFund.desk).indexOf('one desk read') >= 0 && String(oneFund.setupParts).indexOf('real rate tailwind') < 0,
    'one macro leg is shown and does not confirm the setup (' + (oneFund && oneFund.desk) + ')');
  ok(bull.desk && String(bull.desk).indexOf('fundamentals unread') >= 0,
    'a scan with no macro leaves fundamentals unread');
}

console.log('== the tab does not invent a trade ==');
{
  const tab = fs.readFileSync(path.join(root, 'gold-candle-forecast.js'), 'utf8');
  ok(tab.indexOf('TP1') >= 0 && tab.indexOf('Stop:') >= 0, 'the card prints the stop and the targets');
  ok(tab.indexOf('getGoldCandles') >= 0 && tab.indexOf('api.binance.com/api/v3/klines') < 0,
    'the tape comes from the house gold loader, not a raw spot URL');
  ok(tab.indexOf('Patterns:') >= 0 && tab.indexOf('NEUTRAL') >= 0, 'the card names the patterns and a neutral tape');
}

console.log('\npassed: ' + pass);
