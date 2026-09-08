/* v652: BIAS panel gains the compact gate ledger badge, and glyph
   derivation extended to handle BIAS categorized ids (T1..T6, S1, S2,
   F1, B1) as 2-char pill glyphs instead of the '•' fallback. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const setupUi = readFileSync(resolve(ROOT, 'setup-ui.js'), 'utf8');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* --- BIAS render calls hgGateLedgerBadge on gMeta --- */
assert.ok(/v652: BIAS panel now shows the compact gate ledger badge/.test(idx),
  'BIAS render must include v652 comment');
assert.ok(/const biasBadge = \(typeof hgGateLedgerBadge/.test(idx),
  'BIAS render must resolve hgGateLedgerBadge lazily');
assert.ok(/hgGateLedgerBadge\(gMeta\)/.test(idx),
  'BIAS render must call hgGateLedgerBadge(gMeta)');
assert.ok(/\$\{biasBadge\}/.test(idx),
  'BIAS out.innerHTML must interpolate ${biasBadge}');

/* --- glyph derivation covers categorized ids --- */
assert.ok(/v652: derive a short glyph from the gate id/.test(setupUi),
  'setup-ui.js must include v652 glyph comment');
assert.ok(/mCategorized = rawId\.match\(\/\^\(\[A-Z\]\[0-9\]\)\$\/\)/.test(setupUi),
  'glyph derivation must match A-Z followed by single digit');

/* --- CSS: dot is now a pill so 2-char ids fit --- */
assert.ok(/v652: pill not circle so 2-char BIAS ids/.test(idx),
  'CSS must include v652 pill comment');
assert.ok(/\.hg-gld-dot\{[\s\S]{0,200}border-radius:8px/.test(idx),
  'dot must use border-radius:8px (pill) not 50%');

/* --- behavioural: extract helper + verify BIAS ids get letter+digit --- */
const helperMatch = setupUi.match(/function hgGateLedgerBadge\(gateMeta, opts\)\s*\{[\s\S]*?\n\}/);
assert.ok(helperMatch, 'could not extract hgGateLedgerBadge');
const ctx = {
  W: {},
  suEsc: (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  out: null
};
vm.createContext(ctx);
vm.runInContext(helperMatch[0] + '\nout = hgGateLedgerBadge;', ctx);
const badge = ctx.out;

/* Crypto ids still render as single digit */
const cryptoBadge = badge([
  { id: 'G1', label: 'G1 trend', state: 'pass' },
  { id: 'G6', label: 'G6 vol+wick', state: 'veto' },
]);
assert.ok(/hg-gld-dot pass"[^>]*>1</.test(cryptoBadge), 'G1 dot glyph must be 1');
assert.ok(/hg-gld-dot veto"[^>]*>6</.test(cryptoBadge), 'G6 dot glyph must be 6');

/* EDGE ids still work (EG3) */
const edgeBadge = badge([
  { id: 'EG3', label: 'EG3 HTF', state: 'pass' },
]);
assert.ok(/hg-gld-dot pass"[^>]*>3</.test(edgeBadge), 'EG3 dot glyph must be 3');

/* BIAS categorized ids now render as full 2-char pill glyphs */
const biasBadge = badge([
  { id: 'T1', label: 'T1 1D structure', state: 'veto', detail: 'MIXED' },
  { id: 'T3', label: 'T3 1H MACD', state: 'na' },
  { id: 'S2', label: 'S2 F&G', state: 'pass', detail: '71 Greed' },
  { id: 'F1', label: 'F1 macro', state: 'na' },
  { id: 'B1', label: 'B1 Binance', state: 'na' },
]);
assert.ok(/hg-gld-dot veto"[^>]*>T1</.test(biasBadge), 'T1 glyph must be "T1"');
assert.ok(/hg-gld-dot na"[^>]*>T3</.test(biasBadge), 'T3 glyph must be "T3"');
assert.ok(/hg-gld-dot pass"[^>]*>S2</.test(biasBadge), 'S2 glyph must be "S2"');
assert.ok(/hg-gld-dot na"[^>]*>F1</.test(biasBadge), 'F1 glyph must be "F1"');
assert.ok(/hg-gld-dot na"[^>]*>B1</.test(biasBadge), 'B1 glyph must be "B1"');
/* Unknown / freeform ids still fall back to bullet */
const oddBadge = badge([{ id: 'freeform-id-here', state: 'pass' }]);
assert.ok(/hg-gld-dot pass"[^>]*>\u2022</.test(oddBadge), 'unknown id must fall back to bullet');

/* --- version --- */
assert.ok(/^hg-v(?:652|65[3-9]|66\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v652 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK — v652: BIAS gate ledger badge + categorized-id glyphs');
console.log('  * BIAS render calls hgGateLedgerBadge(gMeta) below the header');
console.log('  * G1..G9/EG1..EG9 → single-digit glyph (unchanged)');
console.log('  * T1..T6/S1..S2/F1/B1 → 2-char pill glyph (new)');
console.log('  * dot CSS now border-radius:8px pill so 2-char ids fit');
console.log('  * version bumped to ' + HG_VER);
