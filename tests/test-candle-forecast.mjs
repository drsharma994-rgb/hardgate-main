/* HARDGATE — the CANDLE FORECAST engine had NO guard at all, and its v14-2
   body carried three real defects this test now pins shut:

     1. `confidence: Math.min(1, atr / current.c)` was the volatility RATIO
        (about 0.002 on gold), printed on the card as a "Confidence Score" --
        so it read 0% on every bar and was never a probability. The key is
        GONE; `strength` (|t| of the drift) replaces it and is not a
        probability either.
     2. Direction came from a ONE-BAR EMA9 tick and ALWAYS returned BULL or
        BEAR -- a tape whose drift is indistinguishable from zero still got a
        guessed side. It is now a SHRUNK drift (|t| >= 1) with an honest
        NEUTRAL third state.
     3. The range was an arbitrary `atr * 0.8`. It is now the empirical 60th
        percentile of the last 100 true ranges, scaled by a bounded EWMA
        volatility ratio (Parkinson blended with ATR).

   Run: node tests/test-candle-forecast.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok - ' + m); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* The function is LIFTED from source (hg-v1022) and handed the three helpers
   it reads, so this guard never boots the 18k-line goldind.js. */
const src = read('goldind.js');
/* BRACE-COUNTED lift, added by hg-v1314. The non-greedy regex stops at the first
   nested `}` once the function is no longer last before the export block, and the
   sandbox then throws "Unexpected end of input". Comment/string aware, because a
   doc comment that quotes code derails a naive counter. */
function liftFn(text, name){
  const start = text.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('could not lift ' + name + ' from goldind.js');
  let depth = 0, i = text.indexOf('{', start);
  for (; i < text.length; i++){
    const c = text[i];
    if (c === '/' && text[i + 1] === '/'){ while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*'){ i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '\`'){ const q = c; i++; while (i < text.length && text[i] !== q){ if (text[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces lifting ' + name);
}
const mm = src.match(/function goldCandleForecast\(rows\) \{[\s\S]*?\n\}/);
ok(!!mm, 'goldCandleForecast body is readable in source (hg-v1022 lift)');
const helperStart = src.indexOf('function hgCfPack');
const helperEnd = src.indexOf('function goldCandleForecast');
ok(helperStart >= 0 && helperEnd > helperStart, 'the candlestick pattern readers sit above the engine');
const helpers = src.slice(helperStart, helperEnd);
const sandbox = {
  console, Math, isFinite,
  __last: a => (a && a.length) ? a[a.length - 1] : NaN,
  _ema: (vals, n) => {
    const k = 2 / (n + 1), out = [];
    let e = vals[0];
    for (let i = 0; i < vals.length; i++){ e = i ? (vals[i] * k + e * (1 - k)) : vals[i]; out.push(e); }
    return out;
  },
  _atr: (rows, n) => {
    /* A TRUE ATR: the mean of the last n true ranges. The earlier version in
       this file averaged the RUNNING MEANS (s / n where s was itself a sum of
       already-averaged values), which on a tape of constant range returns
       range/n — 2.0 became 0.14 on the flat fixture — and on a rising tape
       returns the WARM-UP value of the first bar rather than the current one.
       Both fed the engine a volatility figure the tape does not have. */
    const trs = rows.map((r, i) => {
      if (!i) return r.h - r.l;
      const q = rows[i - 1];
      return Math.max(r.h - r.l, Math.abs(r.h - q.c), Math.abs(r.l - q.c));
    });
    const out = [];
    for (let i = 0; i < trs.length; i++){
      if (i < n - 1) { out.push(trs[i]); continue; }
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += trs[j];
      out.push(s / n);
    }
    return out;
  }
};
/* The lifted body calls `atr(...)` and `ema(...)` — those are the names it
   guards with `typeof atr !== 'function'`. This sandbox used to expose only the
   UNDERSCORED aliases, so both guards were true on every call and the function
   returned null before reading a single bar. That made every assertion in this
   file measure the absent-helper path instead of the forecast: the "dead-flat
   tape reads NEUTRAL (got null)" failure was this, not the tape. Aliased here so
   the body sees the helpers it actually asks for. */
sandbox.atr = sandbox._atr;
sandbox.ema = sandbox._ema;
vm.createContext(sandbox);
vm.runInContext(helpers + '\n' + mm[0] + '\nthis.goldCandleForecast = goldCandleForecast;', sandbox, { filename: 'lifted-goldCandleForecast' });
const f = sandbox.goldCandleForecast;
ok(typeof f === 'function', 'the lifted engine runs in the sandbox');

const T0 = Date.UTC(2026, 0, 6, 0, 0, 0);
function tape(n, closeAt, range){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = closeAt(i);
    const h = c + range / 2, l = c - range / 2;
    rows.push({ t: T0 + i * 900000, o: c, h, l, c, v: 100 });
  }
  return rows;
}
const rising  = tape(60, i => 100 + i * 0.5, 1.0);   /* a real uptrend */
const falling = tape(60, i => 130 - i * 0.5, 1.0);   /* a real downtrend */
const flat    = tape(60, () => 100, 2.0);            /* no drift at all */
const noisy   = tape(60, i => 100 + (i % 2 ? 0.3 : -0.3), 1.0);  /* drift ~ 0 */

console.log('== the honest third state: a tape with no drift is NOT given a side ==');
{
  const fl = f(flat);
  ok(fl && fl.dir === 'NEUTRAL', 'a dead-flat tape reads NEUTRAL (got ' + (fl && fl.dir) + ')');
  ok(fl.tp1 === null && fl.tp2 === null && fl.sl === null, 'a NEUTRAL bar carries NO directional levels (never a guessed side)');
  ok(isFinite(fl.expectedHigh) && isFinite(fl.expectedLow) && fl.expectedHigh > fl.expectedLow, 'it still projects the range it CAN estimate');
  const nz = f(noisy);
  ok(nz && (nz.dir === 'NEUTRAL' || nz.dir === 'BULL' || nz.dir === 'BEAR'), 'an alternating tape returns a valid three-state verdict');
  ok(nz.dir !== 'BULL' || nz.strength >= 1, 'a directional verdict is only taken at |t| >= 1 (got strength ' + nz.strength + ')');
}

console.log('== a real trend is read, and the levels cohere ==');
{
  const up = f(rising);
  ok(up && (up.dir === 'BULL' || up.dir === 'NEUTRAL'), 'a rising tape never reads BEAR (got ' + up.dir + ')');
  if (up.dir === 'BULL'){
    ok(up.tp1 > rising[rising.length - 1].c, 'a BULL tp1 sits above the last close');
    ok(up.sl < rising[rising.length - 1].c, 'a BULL stop sits below the last close');
    ok(up.tp2 > up.tp1, 'tp2 is beyond tp1');
  } else {
    ok(up.tp1 === null, 'a NEUTRAL rising read carries no levels');
  }
  const dn = f(falling);
  ok(dn && (dn.dir === 'BEAR' || dn.dir === 'NEUTRAL'), 'a falling tape never reads BULL (got ' + dn.dir + ')');
  if (dn.dir === 'BEAR'){
    ok(dn.tp1 < falling[falling.length - 1].c, 'a BEAR tp1 sits below the last close');
    ok(dn.sl > falling[falling.length - 1].c, 'a BEAR stop sits above the last close');
  }
}

console.log('== the fabricated probability is gone ==');
{
  const r = f(rising);
  ok(!Object.prototype.hasOwnProperty.call(r, 'confidence'), 'the `confidence` key is GONE (it was atr/price, never a probability)');
  ok(isFinite(r.strength) && r.strength >= 0 && r.strength <= 4, 'strength is a bounded |t| score (' + r.strength + '), documented as a heuristic');
  ok(isFinite(r.vol) && r.vol > 0, 'the blended volatility is reported in price units (' + r.vol + ')');
  ok(isFinite(r.expectedRange) && r.expectedRange > 0, 'the projected range is reported (' + r.expectedRange + ')');
}

console.log('== honesty on thin, empty and junk input ==');
{
  ok(f(null) === null, 'a null tape returns null');
  ok(f([]) === null, 'an empty tape returns null');
  ok(f(tape(29, i => 100 + i, 1)) === null, 'below the 30-bar floor it returns null (never a fabricated forecast)');
  let threw = false;
  try { f(tape(40, () => 100, 1).concat([{ o: 'x', h: null, l: undefined, c: NaN, t: 1 }])); } catch (e) { threw = true; }
  ok(!threw, 'a junk bar never throws');
  ok(f(tape(40, () => 0, 0)) === null, 'a tape with no volatility returns null (no range can be estimated)');
}

console.log('== the source carries the honest estimators, not the old ones ==');
{
  ok(src.indexOf('confidence: Math.min(1, atr / current.c)') < 0, 'the atr/price `confidence` line is gone from the source');
  ok(src.indexOf('var expectedRange = atr * 0.8;') < 0, 'the arbitrary atr*0.8 range is gone from the source');
  ok(src.indexOf("dir = (ema9[n-1] > ema9[n-2]) ? 'BULL' : 'BEAR'") < 0, 'the one-bar EMA9 direction tick is gone from the source');
  ok(src.indexOf('4 * Math.LN2') >= 0, 'the Parkinson high-low estimator is present');
  ok(src.indexOf('lam * ew + (1 - lam) * lr0 * lr0') >= 0, 'the EWMA volatility clustering is present');
  ok(src.indexOf("Math.floor(trs.length * 0.60)") >= 0, 'the empirical 60th-percentile range is present');
  ok(src.indexOf("var dir = 'NEUTRAL';") >= 0, 'the three-state NEUTRAL verdict is present');
}

console.log('\ntest-candle-forecast: ' + pass + ' passed, 0 failed');
