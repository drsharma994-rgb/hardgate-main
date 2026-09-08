/* v670: reversalsniper.js strips the forming last bar off every kline fetch.

   rsAssess reads rows[n-1] for entry, RSI(2), ATR, lowest[n-1] extreme,
   and bollinger.upper[n-1] \u2014 every trigger and every plan input. Binance
   kline endpoints (and hgDeskFetchKlines / xuCandles when they wrap them)
   return the currently forming bar as the last element. Without a drop,
   sniper cards could publish against mid-bar RSI(2), ATR, and swing-low
   values that regularly re-print above the trigger threshold when the bar
   actually closes \u2014 same forming-bar defect family OMNIGOLD fixed in v665.

   Fix: new rsDropForming(rows, tf) helper in reversalsniper.js. Uses the
   shared hgDropForming when available; otherwise a timeframe-aware
   fallback (open ts + tf duration > now => bar not closed). rsFetchKlines
   applies it to every return path (hgDeskFetchKlines, xuCandles,
   binanceKlines). rsBacktest applies it belt-and-braces for external callers. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'reversalsniper.js'), 'utf8');

/* --- rationale + helpers --- */
assert.ok(/v670: strip the currently forming bar/.test(src),
  'v670 rationale comment must be present in reversalsniper.js');
assert.ok(/function rsTfSec\(tf\)\{/.test(src),
  'rsTfSec(tf) must be defined');
assert.ok(/function rsDropForming\(rows, tf\)\{/.test(src),
  'rsDropForming(rows, tf) must be defined');
assert.ok(/W\.hgDropForming \|\| W\.dropForming \|\| W\.hgOgDropForming/.test(src),
  'rsDropForming must prefer the shared helper when available');
assert.ok(/if \(t \+ per > nowSec\) return rows\.slice\(0, -1\);/.test(src),
  'timeframe-aware fallback must drop the last bar when it has not closed');

/* --- rsFetchKlines must call rsDropForming on every return path --- */
assert.ok(/return rsDropForming\(rows \|\| \[\], tf\);/.test(src),
  'rsFetchKlines must apply rsDropForming before returning');
/* stale plain-return path must be gone from the fetcher */
assert.ok(!/return await W\.hgDeskFetchKlines\(item, tf, n\);/.test(src),
  'stale bare return from hgDeskFetchKlines must be gone');
assert.ok(!/return await W\.xuCandles\(item, tf, n\);/.test(src),
  'stale bare return from xuCandles must be gone');
assert.ok(!/return await binanceKlines\(bSym, tf, n\);/.test(src),
  'stale bare return from binanceKlines must be gone');

/* --- rsBacktest belt-and-braces drop --- */
assert.ok(/v670: back-test on the closed prefix only/.test(src),
  'rsBacktest v670 rationale must be present');
assert.ok(/if \(clean\.length\) clean = rsDropForming\(clean, '4h'\);/.test(src),
  'rsBacktest must apply rsDropForming as a safety belt');

/* --- runtime extraction: rsTfSec + rsDropForming (no shared helper) --- */
const tfMatch = src.match(/function rsTfSec\(tf\)\{[\s\S]*?\n\}/);
const dropMatch = src.match(/function rsDropForming\(rows, tf\)\{[\s\S]*?\n\}/);
assert.ok(tfMatch, 'rsTfSec must be extractable');
assert.ok(dropMatch, 'rsDropForming must be extractable');
const wrap = new Function('W', 'DateNow',
  'var Date = { now: DateNow };\n' +
  tfMatch[0] + '\n' + dropMatch[0] + '\n' +
  'return { rsTfSec: rsTfSec, rsDropForming: rsDropForming };');

/* Case A: rsTfSec parses common tfs */
{
  const { rsTfSec } = wrap({}, () => 0);
  assert.equal(rsTfSec('1m'), 60);
  assert.equal(rsTfSec('5m'), 300);
  assert.equal(rsTfSec('1h'), 3600);
  assert.equal(rsTfSec('4h'), 14400);
  assert.equal(rsTfSec('1d'), 86400);
  assert.equal(rsTfSec('1w'), 604800);
  assert.equal(rsTfSec(''), 0);
  assert.equal(rsTfSec(null), 0);
  assert.equal(rsTfSec('foo'), 0);
}

/* Case B: fallback drops a forming last 4h bar */
{
  /* fake now = 2026-09-08 20:00:00Z (in ms) */
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  const { rsDropForming } = wrap({}, () => nowMs);
  /* Bars every 4h. Last bar opens at 20:00 UTC exactly \u2014 forming. */
  const t0 = Math.floor(nowMs / 1000) - 4 * 3600;
  const rows = [
    { t: t0 - 4 * 3600, o: 1, h: 1, l: 1, c: 1 },
    { t: t0, o: 1, h: 1, l: 1, c: 1 },
    { t: t0 + 4 * 3600, o: 1, h: 1, l: 1, c: 1 } /* opens = now, still forming */
  ];
  const out = rsDropForming(rows, '4h');
  assert.equal(out.length, 2, 'forming last 4h bar must be dropped');
  assert.equal(out[out.length - 1].t, t0, 'last remaining bar is the second-to-last input');
}

/* Case C: fallback keeps a closed last bar */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  const { rsDropForming } = wrap({}, () => nowMs);
  const nowSec = Math.floor(nowMs / 1000);
  /* Last bar opened 5h ago \u2014 4h TF has closed, so keep it */
  const rows = [
    { t: nowSec - 9 * 3600, o: 1, h: 1, l: 1, c: 1 },
    { t: nowSec - 5 * 3600, o: 1, h: 1, l: 1, c: 1 } /* 5h ago \u2014 closed */
  ];
  const out = rsDropForming(rows, '4h');
  assert.equal(out.length, 2, 'closed last bar must be kept');
}

/* Case D: shared helper takes precedence when available */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  var sharedCalled = 0;
  const stubW = { hgDropForming: function(rows, tf){ sharedCalled++; return rows.slice(0, -1); } };
  const { rsDropForming } = wrap(stubW, () => nowMs);
  const rows = [{ t: 100, o:1,h:1,l:1,c:1 }, { t: 200, o:1,h:1,l:1,c:1 }, { t: 300, o:1,h:1,l:1,c:1 }];
  const out = rsDropForming(rows, '4h');
  assert.equal(sharedCalled, 1, 'shared hgDropForming must have been called');
  assert.equal(out.length, 2, 'shared helper stub drops last bar');
}

/* Case E: empty / null passes through */
{
  const { rsDropForming } = wrap({}, () => 0);
  assert.deepEqual(rsDropForming([], '4h'), [], 'empty rows returns []');
  assert.deepEqual(rsDropForming(null, '4h'), [], 'null rows returns []');
}

/* Case F: unknown tf returns rows unchanged (fallback bails safely) */
{
  const { rsDropForming } = wrap({}, () => Date.UTC(2026, 8, 8, 20, 0, 0));
  const rows = [{ t: 1, o:1,h:1,l:1,c:1 }, { t: 2, o:1,h:1,l:1,c:1 }];
  const out = rsDropForming(rows, 'foo');
  assert.equal(out.length, 2, 'unknown tf must not drop bars');
}

/* Case G: millisecond timestamps are auto-normalised */
{
  const nowMs = Date.UTC(2026, 8, 8, 20, 0, 0);
  const { rsDropForming } = wrap({}, () => nowMs);
  const rows = [
    { t: nowMs - 9 * 3600 * 1000, o:1,h:1,l:1,c:1 },
    { t: nowMs, o:1,h:1,l:1,c:1 } /* ms timestamp of \"now\" \u2014 forming */
  ];
  const out = rsDropForming(rows, '4h');
  assert.equal(out.length, 1, 'ms timestamps must be normalised and forming bar dropped');
}

/* --- version --- */
assert.ok(/^hg-v(?:670|67[1-9]|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v670',
  'HG_VER must be >= hg-v670 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('reversalsniper\\.js\\?v=' + qv).test(idx),
  'index.html reversalsniper.js cache-buster must be ?v=' + qv);

console.log('OK \u2014 v670: reversalsniper.js drops the forming last bar');
console.log('  * rsTfSec parses 1m/5m/1h/4h/1d/1w');
console.log('  * rsDropForming fallback drops a forming last bar under any tf');
console.log('  * rsDropForming keeps closed last bars intact');
console.log('  * shared hgDropForming preferred when available');
console.log('  * rsFetchKlines applies drop to hgDeskFetchKlines / xuCandles / binanceKlines paths');
console.log('  * rsBacktest applies drop as safety belt for external callers');
console.log('  * version bumped to ' + HG_VER);
