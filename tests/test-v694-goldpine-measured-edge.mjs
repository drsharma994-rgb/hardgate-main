/* v694: GOLD PINE wired into the shared measured-edge loop.

   Before v694 GOLD PINE ranked setups on a purely heuristic probScore
   (isNew/isRecent/tier/grade/rr/familyCount) with no outcome evidence.
   v694 wires it into the SAME forward-log loop the rest of the desk
   uses: record fires, settle them, veto proven losers (G6), promote
   proven winners (G7), kill destructive kinds (30+ samples, expR <
   -0.5R), and surface a SOLIDITY chip with per-gate reasons.

   This test asserts the structural contract — no live forward-log data
   is needed because every call is feature-checked and degrades
   gracefully when hg-solidity/hg-forward are absent (the exact situation
   in this Node harness). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const src = readFileSync(resolve(ROOT, 'goldpine.js'), 'utf8');

/* --- helper functions exist --- */
assert.ok(/function hgGpKind\(s\)\{/.test(src), 'hgGpKind defined');
assert.ok(/function hgGpStampSolidity\(list, mode, ctx\)\{/.test(src), 'hgGpStampSolidity defined');
assert.ok(/function hgGpRecord\(list, mode\)\{/.test(src), 'hgGpRecord defined');
assert.ok(/function hgGpReorder\(list\)\{/.test(src), 'hgGpReorder defined');

/* --- hgGpKind: layerLabel > nativeStrategy > kind --- */
assert.ok(/if \(s\.layerLabel\) return String\(s\.layerLabel\);/.test(src),
  'hgGpKind returns layerLabel first');
assert.ok(/if \(s\.nativeStrategy\) return String\(s\.nativeStrategy\);/.test(src),
  'hgGpKind returns nativeStrategy second');
assert.ok(/return String\(s\.kind \|\| 'confluence'\);/.test(src),
  'hgGpKind falls back to kind');

/* --- hgGpStampSolidity: feature-checked + passes tab/kind + minRr --- */
assert.ok(/typeof W2\.hgSolidityGrade !== 'function'/.test(src),
  'hgGpStampSolidity feature-checks hgSolidityGrade');
assert.ok(/tab: 'GOLDPINE:' \+ mode/.test(src),
  'solidity lookup tab = GOLDPINE:<mode>');
assert.ok(/kind: hgGpKind\(s\)/.test(src),
  'solidity lookup kind = hgGpKind(s) (matches record mechanic)');
assert.ok(/minRr: 2\.0/.test(src),
  'solidity minRr floor = 2.0');
assert.ok(/consensus: \{ nAgree: famN \}/.test(src),
  'G1 families fed from familyCount/consensus');
assert.ok(/livePx: fin\(\+s\.price\) \? \+s\.price : spotPx/.test(src),
  'G2 live-fresh fed from mark price / spot');
assert.ok(/s\.solidity = W2\.hgSolidityGrade\(planForSol/.test(src),
  'solidity grade attached to each setup');

/* --- hgGpRecord: feature-checked + mechanic==kind + tf --- */
assert.ok(/var rec = gfn\('hgFwdRecordScan'\);/.test(src),
  'hgGpRecord feature-checks hgFwdRecordScan');
assert.ok(/var tf = \(mode === 'swing'\) \? '4h' : '15m';/.test(src),
  'swing -> 4h, scalp -> 15m');
assert.ok(/mechanic: hgGpKind\(s\)/.test(src),
  'record mechanic = hgGpKind(s) (matches solidity kind)');
assert.ok(/rec\('GOLDPINE:' \+ mode, tf, cands/.test(src),
  'records under GOLDPINE:<mode>');

/* --- hgGpReorder: feature-checked + tab GOLDPINE --- */
assert.ok(/typeof W2\.hgSolidityReorder !== 'function'/.test(src),
  'hgGpReorder feature-checks hgSolidityReorder');
assert.ok(/\{ tab: 'GOLDPINE' \}/.test(src),
  'reorder stashes under tab GOLDPINE');

/* --- runGoldPineScan wires settle -> stamp -> record -> reorder --- */
assert.ok(/var fwdResolve = gfn\('hgFwdResolve'\);/.test(src),
  'runGoldPineScan settles forward records at scan start');
assert.ok(/fwdResolve\('XAUUSD', '4h', bars\.rows4h\)/.test(src),
  'settles 4h forward records');
assert.ok(/fwdResolve\('XAUUSD', '15m', bars\.rows15m\)/.test(src),
  'settles 15m forward records');
assert.ok(/hgGpStampSolidity\(swing, 'swing', scanCtx\);/.test(src),
  'stamps swing solidity');
assert.ok(/hgGpStampSolidity\(scalp, 'scalp', scanCtx\);/.test(src),
  'stamps scalp solidity');
assert.ok(/hgGpRecord\(swing, 'swing'\);/.test(src),
  'records swing fires');
assert.ok(/hgGpRecord\(scalp, 'scalp'\);/.test(src),
  'records scalp fires');
assert.ok(/swing = hgGpReorder\(swing\);/.test(src),
  'reorders swing');
assert.ok(/scalp = hgGpReorder\(scalp\);/.test(src),
  'reorders scalp');

/* --- render respects reorder (slice, not re-sort) + killed note --- */
assert.ok(/result\.swing\.slice\(0, TOP_SETUPS\)/.test(src),
  'render slices reordered list (does not re-sort via topProbSetups)');
assert.ok(/result\.scalp\.slice\(0, TOP_SETUPS\)/.test(src),
  'render slices reordered scalp list');
assert.ok(/W\.hgSolidityKilledNoteHtml\(result\.swing\)/.test(src),
  'render shows killed note for swing');
assert.ok(/W\.hgSolidityKilledNoteHtml\(result\.scalp\)/.test(src),
  'render shows killed note for scalp');

/* --- chip render in cardHTML --- */
assert.ok(/W\.hgSolidityChipHtml\(s\.solidity\)/.test(src),
  'cardHTML renders SOLIDITY chip');

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:694|69[5-9]|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v694',
  'HG_VER must be >= hg-v694');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');

console.log('OK - v694: GOLD PINE wired into the measured-edge loop');
console.log('  * hgGpKind / hgGpStampSolidity / hgGpRecord / hgGpReorder defined');
console.log('  * solidity lookup tab=GOLDPINE:<mode>, kind==record mechanic==hgGpKind(s)');
console.log('  * G1 families from familyCount, G2 live-fresh from mark/spot, G4 minRr=2.0');
console.log('  * record under GOLDPINE:<mode> (swing->4h, scalp->15m)');
console.log('  * runGoldPineScan: settle -> stamp -> record -> reorder');
console.log('  * render slices reordered list + killed note + SOLIDITY chip');
console.log('  * all calls feature-checked (degrades gracefully without hg-solidity/hg-forward)');
console.log('  * version bumped to ' + HG_VER);