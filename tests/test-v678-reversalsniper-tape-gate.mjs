/* v678: Reversal Sniper HTF tape gate.

   Reversalsniper fires long-only reversal snipes on 4H. Prior to v678 it
   had NO higher-timeframe regime awareness \u2014 long snipes fired freely on
   symbols in strong 4H downtrends, the classic \"catching a falling knife\"
   failure mode. Every other tab (omnigold, omniroute) already ranks
   against a tape/regime.

   Fix:
     * NEW rsTape(rows) derives the HTF tape from rsniper's own 4H closes
       via EMA20 vs EMA50 (the same cascade omniroute uses). Prefers the
       shared hgConfirmedCascade when loaded for parity.
     * rsAssess stamps setup.tape at construction.
     * rsConviction adds +1 for tape=='long' (with-trend dip-buy), -3 for
       tape=='short' (against-trend). MIN_CONVICTION = 4 so a lone -3
       penalty knocks weak against-tape cards off the board while strong
       ones (many triggers, deep RSI(2), big drawdown, positive backtest)
       survive.
     * Card renders a TAPE chip. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');

/* --- rsTape defined and prefers shared cascade --- */
assert.ok(/v678: HTF tape classification for the Reversal Sniper/.test(src),
  'v678 rationale block must be present');
assert.ok(/function rsTape\(rows\)\{/.test(src),
  'rsTape(rows) must be defined');
assert.ok(/if \(typeof W\.hgConfirmedCascade === 'function'\)\{/.test(src),
  'rsTape must prefer the shared hgConfirmedCascade when available');
assert.ok(/if \(e20 > e50\) return 'long';\s+if \(e20 < e50\) return 'short';/.test(src),
  'rsTape fallback: EMA20 > EMA50 => long, EMA20 < EMA50 => short');

/* --- setup.tape stamped --- */
assert.ok(/var tape = rsTape\(rows\);/.test(src),
  'rsAssess must compute tape via rsTape');
assert.ok(/tape: tape/.test(src),
  'setup must carry the tape field');

/* --- rsConviction: +1 long, -3 short, neutral null --- */
assert.ok(/if \(setup\.tape === 'long'\) c \+= 1;\s*else if \(setup\.tape === 'short'\) c -= 3;/.test(src),
  'rsConviction must add +1 for long tape and -3 for short tape');

/* --- card chip present --- */
assert.ok(/s\.tape === 'long'\s*\?\s*'<span class=\"gpip ok\">TAPE LONG<\/span>'/.test(src),
  'card must render TAPE LONG chip for aligned longs');
assert.ok(/TAPE SHORT \u2014 vs trend/.test(src),
  'card must render TAPE SHORT warning for against-tape longs');
assert.ok(/TAPE MIXED/.test(src),
  'card must render TAPE MIXED for null tape');

/* --- runtime demonstration: extract rsTape and drive it --- */
const rtMatch = src.match(/function rsTape\(rows\)\{[\s\S]*?\n\}/);
assert.ok(rtMatch, 'rsTape body must be extractable');
const wrap = new Function('W', 'ema', 'isFinite',
  rtMatch[0] + '\nreturn rsTape;');
function stubEma(vals, len){
  /* simple EMA \u2014 close enough to trigger the > / < comparison */
  const k = 2 / (len + 1);
  const out = [];
  let prev = vals[0];
  out.push(prev);
  for (let i = 1; i < vals.length; i++){
    prev = vals[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
const rsTape = wrap({}, stubEma, Number.isFinite);

/* Case A: uptrend (last close much higher than earlier) => tape long */
{
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push({ c: 100 + i * 0.5 }); /* rising */
  assert.equal(rsTape(rows), 'long', 'sustained uptrend classifies as long');
}
/* Case B: downtrend => tape short */
{
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push({ c: 200 - i * 0.5 }); /* falling */
  assert.equal(rsTape(rows), 'short', 'sustained downtrend classifies as short');
}
/* Case C: fewer than 55 bars => null (guard) */
{
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push({ c: 100 + i });
  assert.equal(rsTape(rows), null, 'fewer than 55 bars returns null');
}
/* Case D: ema absent => null */
{
  const noEma = new Function('W', 'ema', 'isFinite',
    rtMatch[0] + '\nreturn rsTape;')({}, undefined, Number.isFinite);
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push({ c: 100 + i * 0.5 });
  assert.equal(noEma(rows), null, 'no ema helper returns null');
}
/* Case E: shared hgConfirmedCascade wins when present */
{
  var sharedCalls = 0;
  const stubW = { hgConfirmedCascade: function(){ sharedCalls++; return { dir: 'short' }; } };
  const tapeW = new Function('W', 'ema', 'isFinite',
    rtMatch[0] + '\nreturn rsTape;')(stubW, stubEma, Number.isFinite);
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push({ c: 100 + i * 0.5 }); /* would be long locally */
  const t = tapeW(rows);
  assert.equal(t, 'short', 'shared cascade takes precedence over local pair');
  assert.equal(sharedCalls, 1, 'shared cascade was called');
}

/* --- conviction delta demonstration --- */
function convDelta(tape){
  if (tape === 'long') return 1;
  if (tape === 'short') return -3;
  return 0;
}
assert.equal(convDelta('long'), 1, 'long tape awards +1');
assert.equal(convDelta('short'), -3, 'short tape penalises -3');
assert.equal(convDelta(null), 0, 'null tape is neutral');
/* against-tape penalty relative to with-tape = 4 conviction pts = one full
   MIN_CONVICTION step */
assert.equal(convDelta('long') - convDelta('short'), 4,
  'with-tape vs against-tape delta = 4 conviction pts (one MIN_CONVICTION step)');

/* --- version --- */
assert.ok(/^hg-v(?:678|679|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v678',
  'HG_VER must be >= hg-v678 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('reversalsniper\\.js\\?v=' + qv).test(idx),
  'index.html reversalsniper.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v678: Reversal Sniper HTF tape gate');
console.log('  * rsTape derives EMA20 vs EMA50 cascade from 4H closes');
console.log('  * prefers shared hgConfirmedCascade when available');
console.log('  * sustained uptrend => long, downtrend => short, < 55 bars => null');
console.log('  * rsConviction: +1 with-tape, -3 against-tape, 0 mixed');
console.log('  * with-tape vs against-tape delta = 4 conviction pts');
console.log('  * card renders TAPE chip (ok / warn / neutral)');
console.log('  * version bumped to ' + HG_VER);
