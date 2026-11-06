/* test-goldpine-bar-v1507.mjs — THE OKAY-AND-ABOVE-GOOD BAR, revised.
   hg-v1506 raised the bar and the desk went BLIND: every formed row graded
   MIXED (the pine-stack holds drag the 7-gate grade down), so the lanes
   emptied and the user asked "why not showing short setup — fix it".
   hg-v1507 revises the bar at that instruction:
     • THE TRADE BAR (gpBoardPick — pin + handoff) stays strict: no case
       against the direction on fundamentals, PRIME/SOLID solidity, FTS
       near/OK. Below it a row never leads and never gets a handoff.
     • THE VISIBILITY BAR (gpLaneShow — what the lanes paint) shows every
       formed, non-killed row; below-bar rows paint MARKED (BELOW BAR chip,
       named reason, withheld handoff) instead of vanishing.
     • FUNDAMENTAL OKAY = NO CASE AGAINST: an explicit refuse/demote fails
       the leg (s.fundOk === false); a completed clean read passes whatever
       the leg count (the v1506 checked>=1 requirement blanked the desk
       when the macro cache ran cold); a gate that never ran or errored
       leaves the stamp undefined and fails OPEN (a dark board blocks
       nothing — house doctrine).
   Sections:
     §1  gpFundOk — fail-closed on the explicit headwind, fail-open on
         absent reads.
     §2  gpSolidityAboveGood — PRIME/SOLID pass, GOOD and below fail,
         killed fails, the ledger release passes on any grade.
     §3  gpBoardPick — the composite trade bar.
     §4  gpLaneShow — the visibility bar: formed shows, killed hides.
     §5  gpBarWhy + gpBarChipHtml — the reason is named, the chip renders.
     §6  textual pins — the seam stamps no-case-against; gpMayLead untouched;
         the mpList filter carries the trade bar; the below-bar fork comes
         FIRST in the actions (the handoff is withheld).
     §7  ship stamps — HG_VER >= hg-v1507 and index.html ?v= byte-match. */
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

/* --- §1 gpFundOk: explicit fail, absent pass --- */
assert.equal(typeof GP.gpFundOk, 'function', 'gpFundOk exported (test seam)');
assert.equal(GP.gpFundOk(null), true, 'null row: the fundamental leg never spoke — it does not hide the row');
assert.equal(GP.gpFundOk({}), true, 'a row without the stamp passes fail-open (dark board blocks nothing)');
assert.equal(GP.gpFundOk({ fundOk: false }), false, 'an explicit FALSE (headwind/blackout) fails the leg');
assert.equal(GP.gpFundOk({ fundOk: true }), true, 'a clean read passes');
assert.equal(GP.gpFundOk({ fundOk: 'false' }), true, 'a stringy stamp is not an explicit FALSE (strict boolean compare)');

/* --- §2 gpSolidityAboveGood: more than good --- */
assert.equal(typeof GP.gpSolidityAboveGood, 'function', 'gpSolidityAboveGood exported (test seam)');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'PRIME' } }), true, 'PRIME clears');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'SOLID' } }), true, 'SOLID clears');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'GOOD' } }), false, 'GOOD does not clear the TRADE bar (hg-v1506 rule kept)');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'MIXED' } }), false, 'MIXED does not clear');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'GOOD', killed: true } }), false, 'a killed plan never clears');
assert.equal(GP.gpSolidityAboveGood({ solidity: { grade: 'GOOD' }, recordReleased: true }), true,
  'ONE exemption: a ledger-RELEASED row is above-good by record and clears on any grade');

/* --- §3 gpBoardPick: the composite TRADE bar --- */
const okRow = { fundOk: true, solidity: { grade: 'PRIME' }, stack: { tierHint: 'near' } };
assert.equal(GP.gpBoardPick(okRow), true, 'all three legs pass — the trade is made');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { fundOk: false })), false, 'fundamental against — trade withheld');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { fundOk: undefined })), true,
  'fundamental UNREAD passes fail-open (hg-v1507 revision — the v1506 blank desk)');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { solidity: { grade: 'GOOD' } })), false, 'solidity only GOOD — trade withheld');
assert.equal(GP.gpBoardPick(Object.assign({}, okRow, { stack: { tierHint: 'forming' } })), false, 'FTS forming — trade withheld');
assert.equal(GP.gpBoardPick({ fundOk: true, solidity: { grade: 'SOLID' }, stack: { tierHint: 'clean' } }), true, 'clean FTS is OK');
assert.equal(GP.gpBoardPick(null), false, 'null never picks');

/* --- §4 gpLaneShow: the visibility bar --- */
assert.equal(typeof GP.gpLaneShow, 'function', 'gpLaneShow exported (test seam)');
assert.equal(GP.gpLaneShow({ solidity: { grade: 'MIXED' } }), true, 'a MIXED row still SHOWS (the v1506 silent-lane fix)');
assert.equal(GP.gpLaneShow({ solidity: { grade: 'GOOD' } }), true, 'a GOOD row still shows');
assert.equal(GP.gpLaneShow({ solidity: { grade: 'PRIME', killed: true } }), false, 'a killed row never shows');
assert.equal(GP.gpLaneShow({}), true, 'an ungraded formed row shows');
assert.equal(GP.gpLaneShow(null), false, 'null never shows');

/* --- §5 gpBarWhy + gpBarChipHtml: the reason is named --- */
assert.equal(typeof GP.gpBarWhy, 'function' , 'gpBarWhy exported (test seam)');
{
  const got = GP.gpBarWhy({ solidity: { grade: 'MIXED' }, stack: { tierHint: 'near' }, fundOk: true });
  assert.equal(got.length, 1, 'a below-bar row names exactly one leg');
  assert.ok(got[0].indexOf('solidity MIXED') === 0 && /bar is PRIME\/SOLID/.test(got[0]), 'a below-bar row names its leg');
}
{
  const got = GP.gpBarWhy({ solidity: { grade: 'PRIME' }, stack: { tierHint: 'forming' }, fundOk: false });
  assert.equal(got.length, 2, 'both failing legs name');
  assert.ok(/FTS forming/.test(got[0]) && /bar is near\/OK/.test(got[0]), 'the FTS leg names in bar order first');
  assert.equal(got[1], 'fundamental against', 'the fundamental leg names second');
}
assert.equal(GP.gpBarWhy(okRow).length, 0, 'a picked row names nothing');
assert.equal(typeof GP.gpBarChipHtml, 'function', 'gpBarChipHtml exported (test seam)');
/* the chip only speaks when the board bar is ON — stub the two readers the
   browser loads (hg-solidity.js + setup-stack.js) */
GP.hgSolidityGrade = function(){ return null; };
GP.hgSetupStackForPineSig = function(){ return null; };
assert.equal(GP.gpBarChipHtml(okRow), '', 'a picked row wears no BELOW BAR chip');
const held = { dir: 'short', solidity: { grade: 'MIXED' }, stack: { tierHint: 'near' }, fundOk: true };
const chip = GP.gpBarChipHtml(held);
assert.ok(/BELOW BAR/.test(chip), 'a below-bar row wears the chip');
assert.ok(/solidity MIXED/.test(chip), 'the chip tooltip names the reason');
assert.equal(GP.gpBarChipHtml(Object.assign({}, held, { recordOnly: true })), '', 'a record-only row keeps its own chip, not this one');

/* --- §6 textual pins --- */
const pickBody = src.slice(src.indexOf('function gpBoardPick'), src.indexOf('function gpAttachFts'));
assert.ok(/gpSolidityAboveGood\(s\)/.test(pickBody), 'gpBoardPick reads the above-good solidity leg');
assert.ok(/gpFundOk\(s\)/.test(pickBody), 'gpBoardPick reads the no-case-against fundamental leg');
assert.ok(/gpFtsNearOk\(s\)/.test(pickBody), 'gpBoardPick keeps the v694 FTS leg');

/* the stamp is no-case-against: no checked>=1 requirement anywhere */
assert.ok(!/checked >= 1/.test(src), 'the v1506 checked>=1 requirement is GONE (it blanked the desk on a cold macro cache)');
assert.ok(/fr\.fundOk = !\(fg2 && \(fg2\.refuse === true \|\| fg2\.demote === true\)\) \? true : false;/.test(src),
  'the scan seam stamps no-case-against');
assert.ok(/s\.fundOk = !\(fund && \(fund\.refuse === true \|\| fund\.demote === true\)\);/.test(src),
  'the accurate-pack row carries the same stamp');

/* gpMayLead stays byte-untouched: the bar lives at the board-pick layer */
const leadBody = src.slice(src.indexOf('function gpMayLead'), src.indexOf('function gpAccuratePack'));
assert.ok(!/fundOk|SolidityAboveGood/.test(leadBody),
  'gpMayLead never reads the bar (the admission-floor suite pins its shape)');

/* the mpList filter carries the trade bar — a below-bar row paints but never leads */
assert.ok(/gpMayLead\(s\) && \(!boardBar \|\| gpBoardPick\(s\)\)/.test(src),
  'the pin list passes the trade bar as well as gpMayLead');

/* the below-bar fork comes FIRST in the actions — the handoff is withheld */
const barWhyIdx = src.indexOf('var barWhy = (gpBoardBarOn()');
const actFork = src.slice(barWhyIdx, src.indexOf('SEND TO TRADE PLAN', barWhyIdx));
assert.ok(actFork.indexOf('barWhy && barWhy.length') < actFork.indexOf('adm.ok === false'),
  'the below-bar note outranks the admission floor in the fork');
assert.ok(/BELOW THE TRADE BAR/.test(src), 'the withheld-handoff note names the bar');
assert.ok(/gpBarChipHtml\(s\)/.test(src), 'the card head carries the BELOW BAR chip');

/* the lanes filter through gpLaneShow, not gpBoardPick */
assert.ok(/result\.swing\.filter\(gpLaneShow\)/.test(src) && /result\.scalp\.filter\(gpLaneShow\)/.test(src),
  'the lanes paint through the visibility bar');
assert.ok(/swingFit\.sort\(function\(a, b\)\{ var pa = gpBoardPick\(a\), pb = gpBoardPick\(b\)/.test(src),
  'picks sort first inside the lane (stable, bar owns the top)');

/* the audit line names the legs */
assert.ok(/TRADE BAR \u2014 fundamental OKAY/.test(src) && /held below the bar/.test(src),
  'the fit note is the bar audit');
assert.ok(/legSolid|legFts|legFund/.test(src), 'the audit counts per leg');

/* the exports ride after the v1492 lab injection anchor, byte-intact */
assert.ok(src.indexOf('W.gpBoardPick = gpBoardPick;') >= 0, 'the lab injection anchor is intact');
assert.ok(/W\.gpFundOk = gpFundOk;/.test(src) && /W\.gpSolidityAboveGood = gpSolidityAboveGood;/.test(src)
  && /W\.gpBarWhy = gpBarWhy;/.test(src) && /W\.gpLaneShow = gpLaneShow;/.test(src)
  && /W\.gpBarChipHtml = gpBarChipHtml;/.test(src), 'the bar suite is exported');

/* --- §7 ship stamps --- */
assert.ok(hgVerGte(HG_VER, 'hg-v1507'), 'the tree is at or past hg-v1507 (at ' + HG_VER + ')');
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('goldpine\\.js\\?v=' + qv).test(idx), 'index.html goldpine.js cache-buster = ?v=' + qv);

console.log('test-goldpine-bar-v1507: all assertions passed at ' + HG_VER);
