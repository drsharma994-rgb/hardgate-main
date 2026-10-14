/* hg-v1348: a later script must not replace the candle engine.
   Replacing hgCfCandlePatterns dropped .names, the forecast threw, and the
   tab said every gate had passed. */
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
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
function tape(n) {
  const rows = [];
  let p = 4080;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o + Math.sin(i * 0.35) * 1.4;
    rows.push({ t: 1760000000 + i * 900, o, h: Math.max(o, c) + 0.6, l: Math.min(o, c) - 0.6, c, v: 1000 });
    p = c;
  }
  return rows;
}

console.log('== page order keeps the gold engine ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js', 'candlestick_patterns.js', 'gold_confluence_engine.js']);
  const rows = tape(48);
  const fc = ctx.goldCandleForecast(rows, null, null);
  ok(fc && (fc.dir === 'BULL' || fc.dir === 'BEAR' || fc.dir === 'NEUTRAL'), 'a readable tape returns a verdict (' + (fc && fc.dir) + ')');
  ok(!ctx.goldCandleForecast.lastError, 'the engine did not throw');
  const pat = ctx.hgCfCandlePatterns(rows, 2);
  ok(pat && Array.isArray(pat.names), 'the pattern reader still returns names');
  ok(String(ctx.hgCfBuildSetup).indexOf('ONE HOME') >= 0, 'the setup builder is still the goldind builder');
  ok(String(ctx.hgCfDaySwings).indexOf('Two are enough') >= 0, 'the day-swing reader was not replaced');
  ok(String(ctx.hgCfMeasure).indexOf('formed flag') >= 0, 'the measure reader was not replaced');
  ok(typeof ctx.hgCandleDeskPatterns === 'function', 'the newest-triad reader is still available under its own name');
}

console.log('\n== a nameless pattern reader cannot blank the tape ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  ctx.hgCfCandlePatterns = function () { return { bullVotes: 1, bearVotes: 0, bullNames: ['hammer after a decline'] }; };
  ctx.hgCfAdvancedPatterns = function () { return { bullNames: ['x'] }; };
  const fc = ctx.goldCandleForecast(tape(40), null, null);
  ok(fc && fc.dir, 'the forecast still returns a side (' + (fc && fc.dir) + ')');
  ok(Array.isArray(fc.patterns), 'patterns is an array');
  ok(Array.isArray(fc.advancedPatterns), 'advanced patterns is an array');
}

console.log('\n== a thrown engine names the throw ==');
{
  const ctx = boot(['indicators.js', 'indicators2.js', 'goldind.js']);
  ctx.hgCfCandlePatterns = function () { throw new Error('pattern reader down'); };
  const fc = ctx.goldCandleForecast(tape(40), null, null);
  ok(fc == null, 'a throw still returns null');
  const why = ctx.hgCfDiagnose(tape(40));
  ok(/engine threw: pattern reader down/.test(why), 'the diagnostic names the throw (' + why + ')');
}

console.log('\ntest-candle-forecast-v1348: ' + pass + ' passed');
