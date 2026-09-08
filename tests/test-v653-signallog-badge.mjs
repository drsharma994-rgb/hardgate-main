/* v653: SIGNAL LOG rows render the gate ledger badge inline.

   Wires gateMeta through the whole persistence path:
     scan.gateMeta (v649-nearCands + v645-clean)
       -> pullBrain/pullScan pass it on the row
       -> snapshotRound stores a compact {id,label,state}[] on the entry
       -> saveJournal persists to localStorage
       -> loadJournal + normEntry rehydrate + validate
       -> tableHTML renders W.hgGateLedgerBadge inline in the note cell
     ...and the SOURCES allowlist in normEntry now accepts cswing/cscalp
     (was silently rejecting them since v646). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* --- Pullers pass gateMeta through --- */
assert.ok(/v653: pass gateMeta through so the log row can render the badge/.test(sl),
  'signallog pullers must include v653 propagate comment');
/* Both pullBrain and pullScan should assign gateMeta on the pushed row */
const pullerBlocks = sl.match(/out\.push\(\{[\s\S]{0,400}?gateMeta[\s\S]{0,80}?\}\);/g) || [];
assert.ok(pullerBlocks.length >= 2,
  'expected \u22652 pusher blocks with gateMeta (pullBrain + pullScan); saw ' + pullerBlocks.length);

/* --- snapshotRound stores a compact version --- */
assert.ok(/v653: compact gateMeta \u2014 keep id\/label\/state only/.test(sl),
  'snapshotRound must include v653 compact comment');
assert.ok(/gm = r\.gateMeta\.map\(function\(g\)/.test(sl),
  'snapshotRound must build a compact gm[]');

/* --- normEntry allowlist includes cswing/cscalp + rehydrates gateMeta --- */
assert.ok(/ALLOWED = \{ brain:1, cswing:1, cscalp:1, scalp:1, swing:1, supergold:1 \}/.test(sl),
  'normEntry ALLOWED must include cswing + cscalp (v653 fix)');
assert.ok(/v653: rehydrate compact gateMeta/.test(sl),
  'normEntry must include v653 rehydrate comment');

/* --- tableHTML renders the badge inline --- */
assert.ok(/v653: render the gate ledger badge inline/.test(sl),
  'tableHTML must include v653 render comment');
assert.ok(/badgeFn && Array\.isArray\(e\.gateMeta\)/.test(sl),
  'tableHTML must guard on Array.isArray(e.gateMeta) before calling the badge');
assert.ok(/<th>GATES<\/th>/.test(sl),
  'tableHTML column header must be renamed from NOTE to GATES');

/* --- CSS for the inline badge in log rows --- */
assert.ok(/sl-note \.hg-gld\s*\{margin:0;vertical-align:middle\}/.test(sl),
  'log-row .hg-gld override CSS required');
assert.ok(/\.sl-note-suffix\s*\{color:var/.test(sl),
  'sl-note-suffix CSS required for trailing detail');
assert.ok(/max-width:420px/.test(sl),
  'sl-note max-width should be widened from 280px to 420px for the badge');

/* --- version --- */
assert.ok(/^hg-v(?:653|65[4-9]|66\d|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v653 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v653: SIGNAL LOG rows render the gate ledger badge inline');
console.log('  * pullers propagate gateMeta onto pushed rows');
console.log('  * snapshotRound compacts to {id,label,state}[] to keep localStorage small');
console.log('  * normEntry ALLOWED includes cswing/cscalp (was rejecting them silently)');
console.log('  * tableHTML column renamed to GATES; badge rendered inline');
console.log('  * CSS: sl-note widened + .hg-gld override for log rows + suffix style');
console.log('  * version bumped to ' + HG_VER);
