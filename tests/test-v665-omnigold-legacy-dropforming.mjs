/* v665: hgOgFetchRowsLegacy must strip the forming (unclosed) bar too.

   The main data path (hgOgFetchRows -> getXAUCandles) already calls
   dropForming(rows, res) on every branch before returning. The LEGACY
   fallback (hgOgFetchRowsLegacy, used when getXAUCandles is absent
   \u2014 older builds, transient module load failures) did not, so
   OMNIGOLD detectors ran with rows[rows.length - 1] pointing at an
   open, moving candle. Every wick / close-through / fib decision
   then read a moving target: mechanics could pass on transient wick
   data that reversed before close, print a live ticket, then
   invalidate the next tick.

   Fix: feature-check window.dropForming (a global declared in
   index.html) and wrap each source's rows through it. Absence
   degrades safely to raw rows. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');

/* --- rationale comment must be present so future edits know why --- */
assert.ok(/v665: strip the forming \(unclosed\) bar on this fallback path too/.test(src),
  'v665 rationale comment must be present in hgOgFetchRowsLegacy');

/* --- feature-checked dropForming lookup --- */
assert.ok(/var dropFn = gfn\('dropForming'\);/.test(src),
  'hgOgFetchRowsLegacy must feature-check gfn(\"dropForming\")');

/* --- trim helper guards for empty + falls back to raw rows if trim fails --- */
assert.ok(/function trim\(rows\)\{[\s\S]{0,220}if \(typeof dropFn === 'function'\)\{\s*try\{ var t = dropFn\(rows, tf\); if \(t && t\.length\) return t; \}catch\(e\)\{\}[\s\S]{0,30}\}[\s\S]{0,30}return rows;/.test(src),
  'trim(rows) must feature-check dropFn, try/catch it, and fall back to raw rows on empty/error');

/* --- all three source branches must be wrapped with trim() --- */
const legacyMatch = src.match(/function hgOgFetchRowsLegacy\(tf, n\)\{[\s\S]*?\n  \}/);
assert.ok(legacyMatch, 'hgOgFetchRowsLegacy body must be extractable');
const legacyBody = legacyMatch[0];
assert.ok(/rows: trim\(a\.rows\), source: a\.source \|\| 'xm-xauusd'/.test(legacyBody),
  'XM branch must wrap a.rows in trim()');
assert.ok(/rows: trim\(b\.rows\), source: b\.source \|\| 'gold-spot'/.test(legacyBody),
  'getGoldCandles branch must wrap b.rows in trim()');
assert.ok(/rows: trim\(c\), source: 'binance-paxg'/.test(legacyBody),
  'binanceKlines PAXG branch must wrap c in trim()');

/* --- old shape must be gone: bare `rows: a.rows` / `rows: b.rows` / `rows: c` --- */
assert.ok(!/rows: a\.rows, source: a\.source \|\| 'xm-xauusd'/.test(legacyBody),
  'stale non-trimmed XM branch must be gone');
assert.ok(!/rows: b\.rows, source: b\.source \|\| 'gold-spot'/.test(legacyBody),
  'stale non-trimmed getGold branch must be gone');
/* the c branch pre-v665: `rows: c, source: 'binance-paxg'` \u2014 must not appear */
assert.ok(!/rows: c,\s*source: 'binance-paxg'/.test(legacyBody),
  'stale non-trimmed PAXG branch must be gone');

/* --- runtime demonstration: extract hgOgFetchRowsLegacy and drive it against
       a stubbed window that has dropForming + one candle source. Prove:
       (1) forming bar gets stripped, (2) absence of dropForming falls back
       safely to raw rows. --- */
function extract(name){
  const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(m, name + ' must be extractable');
  return m[0];
}
const legacyFn = extract('hgOgFetchRowsLegacy');

/* Stub gfn(): resolves lookups on a fake `sandbox.win`. */
function runLegacy(win){
  const gfn = (name) => (typeof win[name] === 'function' ? win[name] : null);
  const W = () => win;
  const wrap = new Function('gfn', 'W', legacyFn + '\nreturn hgOgFetchRowsLegacy;');
  return wrap(gfn, W);
}

const NOW = 1_700_000_000;
const HR = 3600;

/* Case A: dropForming present and closes the last bar. Rows returned should
   be the first N-1 bars (forming bar dropped). */
{
  const rowsWithForming = [];
  for (let i = 0; i < 8; i++) rowsWithForming.push({ t: NOW - (8 - i) * HR, o:100, h:101, l:99, c:100 });
  /* The last bar is "forming" \u2014 its t is < 1h ago. */
  rowsWithForming[rowsWithForming.length - 1].t = NOW - 500;
  let dropCalls = 0;
  const win = {
    getXmGoldCandles: async () => ({ rows: rowsWithForming.slice(), source: 'xm-xauusd' }),
    dropForming: (rows, res) => { dropCalls++; return rows.slice(0, -1); }
  };
  const fetchLegacy = runLegacy(win);
  const result = await fetchLegacy('1h', 8);
  assert.equal(dropCalls, 1, 'dropForming must be called exactly once (only XM branch fired)');
  assert.equal(result.source, 'xm-xauusd');
  assert.equal(result.rows.length, 7, 'forming bar must be dropped (8 -> 7)');
}

/* Case B: dropForming absent \u2014 legacy must fall back gracefully to raw rows,
   NOT crash and NOT return empty. */
{
  const rowsWithForming = [];
  for (let i = 0; i < 5; i++) rowsWithForming.push({ t: NOW - (5 - i) * HR, o:100, h:101, l:99, c:100 });
  const win = {
    getXmGoldCandles: async () => ({ rows: rowsWithForming.slice(), source: 'xm-xauusd' }),
    /* no dropForming */
  };
  const fetchLegacy = runLegacy(win);
  const result = await fetchLegacy('1h', 5);
  assert.equal(result.rows.length, 5, 'absent dropForming must degrade to raw rows (5 in, 5 out)');
  assert.equal(result.source, 'xm-xauusd');
}

/* Case C: dropForming throws \u2014 legacy must fall back to raw rows. */
{
  const rowsIn = [
    { t: NOW - 2*HR, o:100, h:101, l:99, c:100 },
    { t: NOW - 1*HR, o:100, h:101, l:99, c:100 }
  ];
  const win = {
    getGoldCandles: async () => ({ rows: rowsIn.slice(), source: 'gold-spot' }),
    dropForming: () => { throw new Error('boom'); }
  };
  const fetchLegacy = runLegacy(win);
  const result = await fetchLegacy('1h', 2);
  assert.equal(result.rows.length, 2, 'dropForming throwing must degrade to raw rows');
  assert.equal(result.source, 'gold-spot');
}

/* Case D: PAXG binance fallback also gets trimmed. */
{
  const raw = [];
  for (let i = 0; i < 6; i++) raw.push({ t: NOW - (6 - i) * HR, o:100, h:101, l:99, c:100 });
  raw[raw.length - 1].t = NOW - 800;
  const win = {
    binanceKlines: async (sym) => (sym === 'PAXGUSDT' ? raw.slice() : null),
    dropForming: (rows) => rows.slice(0, -1)
  };
  const fetchLegacy = runLegacy(win);
  const result = await fetchLegacy('1h', 6);
  assert.equal(result.source, 'binance-paxg');
  assert.equal(result.rows.length, 5, 'PAXG fallback must also strip forming bar');
}

/* --- version --- */
assert.ok(/^hg-v(?:665|66[6-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v665',
  'HG_VER must be >= hg-v665 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v665: hgOgFetchRowsLegacy strips the forming bar');
console.log('  * all three source branches (XM / getGold / PAXG) wrapped in trim()');
console.log('  * feature-checked gfn(\"dropForming\"), safe degrade to raw rows');
console.log('  * runtime: forming bar removed (8 -> 7)');
console.log('  * runtime: absent dropForming falls back to raw rows');
console.log('  * runtime: dropForming throwing falls back to raw rows');
console.log('  * runtime: PAXG fallback path also trims');
console.log('  * version bumped to ' + HG_VER);
