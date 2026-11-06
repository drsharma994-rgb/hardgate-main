/* test-goldpine-fund-ok-v1506.mjs — THE OKAY-AND-ABOVE-GOOD BAR.
   hg-v1506: the user set the GOLD PINE lane bar higher. A trade is only
   MADE and SHOWN when BOTH reads clear it:
     • FUNDAMENTAL OKAY — the trade's own hgFundamentalGate read ran, the
       board actually READ at least one directional leg (regime.checked >= 1;
       a dark board is unread, and unread is not okay), and it neither
       refused nor demoted the direction. Stamped s.fundOk at the scan seam
       (per-row pass after hgFundamentalScanCands) and on the accurate-pack
       row.
     • SOLIDITY MORE THAN GOOD — gpSolidityAboveGood accepts PRIME or SOLID
       only; GOOD no longer clears the lane. ONE exemption: a row the
       forward ledger RELEASED (s.recordReleased) is above-good by record.
   gpBoardPick is the single gate the two lanes, the MOST PROBABLE lead and
   the failed-sweep lead all read. gpMayLead is byte-untouched — its
   admission-floor suite pins its exact shape, so the bar lives at the
   board-pick layer, not inside the lead predicate.
   Sections:
     §1  gpFundOk — the stamp is the only door (undefined never passes).
     §2  gpSolidityAboveGood — PRIME/SOLID pass, GOOD and below fail,
         killed fails, the ledger release passes on any grade.
     §3  gpBoardPick — the composite: all three legs must pass.
     §4  textual pins — the scan seam and the accurate-pack row both stamp
         fundOk; gpMayLead never reads it; the lane texts name the bar.
     §5  ship stamps — HG_VER >= hg-v1506 and index.html ?v= byte-match. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER, hgVerGte } = await import('./helpers/build-version.mjs');

const src = readFileSync(resolve(ROOT, 'goldpine.js'), 'utf8');

/* boot the desk file alone, the way test-goldpine-admission-floor.mjs boots it */
const ctx = vm.createContext({
  console, Math, JSON, Date, Intl, isFinite, NaN, Array, Object, String, Promise,
  setTimeout, clearTimeout, setInterval, clearInterval, module: { exports: {} }, window: {}
});
ctx.window = ctx;
vm.runInContext(src, ctx, { filename: 'goldpine.js' });
const GP = ctx;

/* --- §1 gpFundOk: the stamp is the only door --- */
assert.equal(typeof GP.gpFundOk, 'function', 'gpFundOk exported (test seam)');
assert.equal(GP.gpFundOk(null), false, 'null row is not okay');
assert.equal(GP.gpFundOk({}), false, 'a row without the stamp is not okay — absent is never okay');
assert.equal(GP.gpFundOk({ fundOk: false }), false, 'an explicit false is not okay');
assert.equal(GP.gpFundOk({ fundOk: true }), true, 'the stamped TRUE is okay');
assert.equal(GP.gpFundOk({ fundOk: 'true' }), false, 'a stringy stamp is not okay (strict boolean)');

/* --- §2 gpSolidityAboveGood: more than good --- */
assert.equal(typeof GP.gpSolidityAboveGood, 'function', 'gpSolidityAboveGood exported (test seam)');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'PRIME' } }), true, 'PRIME clears');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'SOLID' } }), true, 'SOLID clears');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'GOOD' } }), false, 'GOOD no longer clears the lane (hg-v1506)');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'MIXED' } }), false, 'MIXED never cleared and still does not');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'THIN' } }), false, 'THIN does not clear');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'WEAK' } }), false, 'WEAK does not clear');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'good' } }), false, 'the grade compare is case-normalised: lowercase good is still good, still fails');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'GOOD', killed: true } }), false, 'a killed plan never clears');
assert.equal(GP.gpSolidityAboveGood({}), false, 'no solidity grade does not clear');
assert.equal(GP.gpSolidityAboveGood(null), false, 'null row does not clear');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'GOOD' }, recordReleased: true }), true,
  'ONE exemption: a ledger-RELEASED row is above-good by record and clears on any grade');
assert.equal(GP.gpSolidityAboveGood({ recordReleased: true }), false,
  'the release exemption does not conjure a grade out of nothing — a released row still shows its solidity chip');

/* --- §3 gpBoardPick: the composite bar --- */
const okRow = { fundOk: true, solidity: { grade: 'PRIME' }, stack: { tierHint: 'near' } };
assert.equal(GP.gpBoardPick(okRow), true, 'all three legs pass — the trade is made and shown');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { fundOk: false })), false, 'fundamental not okay — hidden');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { fundOk: undefined })), false, 'fundamental unstamped (dark board) — hidden');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { solidity: { grade: 'GOOD' } })), false, 'solidity only GOOD — hidden (more than good required)');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { stack: { tierHint: 'forming' } })), false, 'FTS forming — hidden (unchanged v694 leg)');
assert.equal(GP.gpBoardPick({ fundOk: true, solidity: { grade: 'SOLID' }, stack: { tierHint: 'clean' } }), true,
  'clean FTS is OK — passes');
assert.equal(GP.gpBoardPick(null), false, 'null never picks');

/* --- §4 textual pins --- */
const pickBody = src.slice(src.indexOf('function gpBoardPick'), src.indexOf('function gpAttachFts'));
assert.ok(/gpSolidityAboveGood\(s\)/.test(pickBody), 'gpBoardPick reads the above-good solidity leg');
assert.ok(/gpFundOk\(s\)/.test(pickBody), 'gpBoardPick reads the okay-fundamental leg');
assert.ok(/gpFtsNearOk\(s\)/.test(pickBody), 'gpBoardPick keeps the v694 FTS leg');

/* the stamp exists at the scan seam AND on the accurate-pack row */
assert.ok(/gpFundStamp\(swing\);/.test(src) && /gpFundStamp\(scalp\);/.test(src),
  'the scan seam stamps both lanes');
assert.ok(/fg2\.regime && fg2\.regime\.checked >= 1/.test(src),
  'the stamp requires the board to have READ at least one directional leg — a dark board is unread, not okay');
assert.ok(/s\.fundOk = !!\(fund && fund\.refuse !== true && fund\.demote !== true/.test(src),
  'the accurate-pack row carries the same stamp');

/* gpMayLead stays byte-untouched: the bar lives at the board-pick layer */
const leadBody = src.slice(src.indexOf('function gpMayLead'), src.indexOf('function gpAccuratePack'));
assert.ok(!/fundOk|SolidityAboveGood/.test(leadBody),
  'gpMayLead never reads the v1506 bar (the admission-floor suite pins its shape)');

/* the texts name the bar */
assert.ok(/MORE THAN GOOD/.test(src), 'the lane text names the raised solidity bar');
assert.ok(/fundamental read is OKAY/.test(src), 'the lane text names the okay-fundamental bar');
assert.ok(/No setup clears the bar/.test(src), 'the NO LEAD state names the bar');
assert.ok((src.match(/more-than-good solidity \(PRIME\/SOLID\)/g) || []).length >= 2,
  'both lane empty states name the bar');

/* the exports ride after the v1492 lab injection anchor, byte-intact */
assert.ok(src.indexOf('W.gpBoardPick = gpBoardPick;') >= 0, 'the lab injection anchor is intact');
assert.ok(/W\.gpFundOk = gpFundOk;/.test(src) && /W\.gpSolidityAboveGood = gpSolidityAboveGood;/.test(src),
  'both halves of the bar are exported for the suite');

/* --- §5 ship stamps --- */
assert.ok(hgVerGte(HG_VER, 'hg-v1506'), 'the tree is at or past hg-v1506 (at ' + HG_VER + ')');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('goldpine\\.js\\?v=' + qv).test(idx), 'index.html goldpine.js cache-buster = ?v=' + qv);

console.log('test-goldpine-fund-ok-v1506: all assertions passed at ' + HG_VER);
