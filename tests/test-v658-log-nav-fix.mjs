/* v658: fix two LOG-nav defects surfaced by the live audit.

   Problem 1 (naming clash):
     The COMMAND group had a tab literally labeled 'LOG' that opened
     the SETUP LOG panel (auto-graded CLEAN-setup outcomes). A separate
     SIGNAL LOG panel (persistent journal of BRAIN + SCALP + SWING
     signals) also existed but was labeled 'SIGNAL LOG'. Users clicking
     'LOG' expected the Signal Log we've been shipping features for
     (v653-v655, v657); they got the Setup Log instead.

   Problem 2 (wrong home):
     SIGNAL LOG was registered under the GOLD tab group even though
     the journal contains BRAIN + SCALP + SWING signals for BOTH crypto
     AND gold. It belongs in COMMAND, alongside SETUP LOG and TRADE
     PLAN, not tucked away with the gold-specific tools.

   Fix:
     * Rename the static 'LOG' button and its badge to 'SETUP LOG'
       (renderLogBadge template updated so the '(N)' badge still
       renders correctly).
     * Move 'signallog' from HG_NAV_GROUPS 'gold' -> 'overview',
       inserted right after 'log' so the two logs sit adjacent
       under COMMAND. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

/* --- static button label renamed --- */
assert.ok(
  /<button id="tabB_log" onclick="showTab\('log'\)">SETUP LOG<\/button>[\s\S]{0,120}v658: renamed from LOG/.test(idx),
  'static #tabB_log button must be renamed to SETUP LOG with a v658 comment');
/* the old label 'LOG' must be gone from the button body */
assert.ok(
  !/<button id="tabB_log" onclick="showTab\('log'\)">LOG<\/button>/.test(idx),
  'stale "LOG" label on #tabB_log must be gone');

/* --- badge renderer emits SETUP LOG (not LOG) --- */
assert.ok(
  /renderLogBadge\(\)\{[\s\S]{0,200}b\.textContent = n\?`SETUP LOG \(\$\{n\}\)`:'SETUP LOG';/.test(idx),
  'renderLogBadge must emit SETUP LOG with the (N) format');
assert.ok(
  !/b\.textContent = n\?`LOG \(\$\{n\}\)`:`LOG`;/.test(idx),
  'stale LOG(N) badge template must be gone');

/* --- HG_NAV_GROUPS: signallog moved from gold -> overview --- */
/* overview tabs must include signallog immediately after log */
const overviewLine = idx.match(/\{ id:'overview',\s+label:'COMMAND',\s+tabs:\[([^\]]+)\]/);
assert.ok(overviewLine, 'HG_NAV_GROUPS overview entry must exist');
const overviewTabs = overviewLine[1].split(',').map(s => s.trim().replace(/'/g, ''));
assert.ok(overviewTabs.includes('signallog'),
  'overview group tabs must include signallog');
const logIdx = overviewTabs.indexOf('log');
const slIdx = overviewTabs.indexOf('signallog');
assert.ok(logIdx >= 0 && slIdx === logIdx + 1,
  'signallog must sit immediately after log in the overview tabs (log then signallog)');

/* gold group must NOT list signallog anymore */
const goldLine = idx.match(/\{ id:'gold',\s+label:'GOLD',\s+tabs:\[([^\]]+)\]/);
assert.ok(goldLine, 'HG_NAV_GROUPS gold entry must exist');
const goldTabs = goldLine[1].split(',').map(s => s.trim().replace(/'/g, ''));
assert.ok(!goldTabs.includes('signallog'),
  'gold group tabs must not list signallog anymore');

/* the change is annotated so future edits know why */
assert.ok(/v658: SIGNAL LOG moved from GOLD -> COMMAND/.test(idx),
  'v658 relocation comment must be present near HG_NAV_GROUPS');

/* --- version --- */
assert.ok(/^hg-v(?:658|65\d|66\d|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v658',
  'HG_VER must be >= hg-v658 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v658: LOG nav clash fixed');
console.log('  * COMMAND button "LOG" -> "SETUP LOG" (button + badge template)');
console.log('  * SIGNAL LOG moved from GOLD -> COMMAND, positioned after SETUP LOG');
console.log('  * two adjacent log tabs under COMMAND, unambiguous names');
console.log('  * version bumped to ' + HG_VER);
