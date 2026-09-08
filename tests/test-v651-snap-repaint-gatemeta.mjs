/* v651: snap-repaint path (hgRepaintCryptoScanFromSnap) must also
   propagate gateMeta so the v650 gate-ledger badge renders on the
   ACTUAL live cards.

   v650 wired the badge into cardHTML + hgSetupCardHTML and the direct
   renderSwingCleanCard / renderScalpCleanCard / near-card paths, but
   the snap-repaint helper (which re-renders on tab activation from
   __hgSwingScan / __hgScalpScan) called cardHTML with a bookMeta that
   did NOT include gateMeta. Live cards on the app all come through
   this path, so the badge was invisible. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* Both CLEAN and NEAR snap-repaint branches must pass gateMeta */
assert.ok(idx.includes("/* v650 addendum: propagate the gate ledger onto snap-repainted CLEAN cards */"),
  'snap-repaint CLEAN branch must include v650 addendum comment');
assert.ok(idx.includes("/* v650 addendum: propagate the gate ledger onto snap-repainted NEAR cards */"),
  'snap-repaint NEAR branch must include v650 addendum comment');

/* Verify the actual field is set in both places */
const cleanBlock = idx.match(/tier: isBest \? 'best' : 'clean',[\s\S]{0,300}postGateUnchecked/);
assert.ok(cleanBlock, 'could not extract CLEAN bookMeta block');
assert.ok(/gateMeta: c\.gateMeta/.test(cleanBlock[0]),
  'CLEAN snap-repaint bookMeta must set gateMeta: c.gateMeta');

/* Verify the NEAR fix directly in the file (no regex block extraction) */
assert.ok(/gateMeta: n\.gateMeta/.test(idx),
  'NEAR snap-repaint bookMeta must set gateMeta: n.gateMeta');

/* version bump */
assert.ok(/^hg-v(?:651|65[2-9]|66\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v651 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK — v651: snap-repaint path propagates gateMeta');
console.log('  * hgRepaintCryptoScanFromSnap CLEAN branch: c.gateMeta -> bookMeta');
console.log('  * hgRepaintCryptoScanFromSnap NEAR branch:  n.gateMeta -> bookMeta');
console.log('  * gate ledger badge will now render on live scan cards');
console.log('  * version bumped to ' + HG_VER);
