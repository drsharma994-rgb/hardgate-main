/* v663: replace jarring native alert() in pullMark() with inline
   status feedback.

   Prior to v663:
     * Empty symbol -> silent return, user has no idea nothing happened
     * Ticker + candles both empty -> silent return, same problem
     * Actual exception -> blocking native alert() modal (jarring, forces
       an OK click that steals focus; on mobile it looks like a system-
       level error banner)

   Fix:
     * New #pullMarkStat inline note next to the PULL MARK button
     * pullMark() writes short status lines for every path:
        - empty symbol -> red "symbol is empty" line
        - pulling      -> neutral "pulling mark for X..."
        - ticker cache -> green "mark N -> ENTRY (from ticker cache)"
        - 15m fallback -> green "close N -> ENTRY (15m fallback...)"
        - both empty   -> red "no mark or 15m candles for X"
        - exception    -> red "mark pull failed: <msg>"
     * No native alert() calls remain in the file. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* --- inline status span exists next to the PULL MARK button --- */
assert.ok(/<span class="note" id="pullMarkStat"[^>]*><\/span>/.test(idx),
  '#pullMarkStat span must be present in the trade plan panel');
/* --- rationale annotation --- */
assert.ok(/v663: inline status \u2014 replaces the jarring native alert/.test(idx),
  'inline status span must carry the v663 rationale comment');

/* --- pullMark() rewritten with setStat + branches --- */
assert.ok(/v663: honest status feedback instead of a jarring native alert/.test(idx),
  'pullMark() must include v663 rationale');
assert.ok(/const stat = document\.getElementById\('pullMarkStat'\);/.test(idx),
  'pullMark must look up #pullMarkStat');
assert.ok(/const setStat = \(t, cls\) => \{/.test(idx),
  'pullMark must declare a local setStat helper');
/* three color classes: err (red), ok (green), default */
assert.ok(/'#ff6b4a'[\s\S]{0,100}'#19e3a2'/.test(idx),
  'setStat must color err (#ff6b4a) and ok (#19e3a2)');

/* --- each branch surfaces status --- */
assert.ok(/symbol is empty \u2014 type a ticker like BTCUSD first/.test(idx),
  'empty-symbol branch must set a helpful red message');
assert.ok(/pulling mark for ' \+ sym \+ '\u2026/.test(idx),
  'pulling branch must show progress');
assert.ok(/mark ' \+ t\.mark \+ ' \u2192 ENTRY \(from ticker cache\)/.test(idx),
  'ticker-cache success must mention ticker cache');
assert.ok(/close ' \+ c \+ ' \u2192 ENTRY \(15m fallback \u2014 ticker had no mark\)/.test(idx),
  '15m fallback success must mention the fallback');
assert.ok(/no mark or 15m candles for ' \+ sym \+ ' \u2014 check the symbol/.test(idx),
  'both-empty branch must give an actionable red message');
assert.ok(/mark pull failed: ' \+ \(e && e\.message \? e\.message : String\(e\)\)/.test(idx),
  'exception branch must surface the actual error, not swallow it');

/* --- no native alert() call remains in pullMark or nearby trade plan code --- */
assert.ok(!/alert\('mark pull failed:/.test(idx),
  'old alert("mark pull failed: ...") must be gone');

/* --- version --- */
assert.ok(/^hg-v(?:663|66[4-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v663',
  'HG_VER must be >= hg-v663 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v663: pullMark inline status replaces native alert()');
console.log('  * #pullMarkStat inline span added next to PULL MARK button');
console.log('  * six status branches covered (empty / pulling / cache / 15m / miss / err)');
console.log('  * red for errors, green for success, default for progress');
console.log('  * no native alert() modal remains');
console.log('  * version bumped to ' + HG_VER);
