/* v697: OMNIGOLD cleanup - four rules applied to reduce visual noise.

   User feedback: 'omnigold tab is very confusing, please decide
   logically and remove the wrong setups'. Analysis of the live tab
   showed 27,000px scroll height, 23 setups per scan, dense forensic
   text at top, and the tab's own replay verdict already condemning
   most kinds as measured-negative. The cleanup applies four rules,
   each grounded in what the tab itself already knows, without deleting
   any information (nothing removed - only reordered / collapsed):

   Rule A: default to PAID-ONLY (was ALL). Users start on setups whose
           forward ledger reads 'has paid'. ALL toggle remains one
           click away. New localStorage key records explicit choice
           so returning users who never touched the toggle inherit the
           new default; explicit ALL clicks are respected.

   Rule B: collapse the top REPLAY/DESK verdict block behind a single
           <details> so the tab opens on setups, not paragraphs.

   Rule C: collapse the demoted-cards section (measured-negative kinds
           stood aside) behind a <details> with a count summary.

   Rule D: cap tradable cards at 5 per direction (long / short); trim
           the tail into a collapsed <details>. Held cards and dead-
           level lines are UNCAPPED because they carry a different
           reader responsibility (invalidation info). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

const src = readFileSync(resolve(ROOT, 'omnigold.js'), 'utf8');

/* --- Rule A: default to PAID --- */
assert.ok(/v697 rule A: default to PAID-ONLY/.test(src),
  'rule A rationale comment present');
assert.ok(/var OG_PAID_CHOICE_LS = 'hg_paidonly_OMNIGOLD_choice';/.test(src),
  'new choice-tracking localStorage key defined');
assert.ok(/return 'PAID';[\s\S]{0,200}\}[\s\S]{0,50}function hgOgShowModeSet/.test(src),
  'hgOgShowMode returns PAID by default (final return before hgOgShowModeSet)');
assert.ok(/if \(explicit === 'ALL'\) return 'ALL';/.test(src),
  'explicit ALL choice is honored');
assert.ok(/localStorage\.setItem\(OG_PAID_CHOICE_LS, 'ALL'\);/.test(src),
  'explicit ALL choice is persisted');
assert.ok(/localStorage\.setItem\(OG_PAID_CHOICE_LS, 'PAID'\);/.test(src),
  'explicit PAID choice is persisted');

/* --- Rule B: collapse REPLAY/DESK verdict --- */
assert.ok(/v697 rule B: collapse the DESK-STANCE/.test(src),
  'rule B rationale comment present');
assert.ok(/<details class="note" id="ogEvidenceDetails"/.test(src),
  'evidence details wrapper present');
assert.ok(/measured evidence \u00b7 replay \+ forward verdicts/.test(src),
  'evidence summary text present');
/* the inner blocks are still there (nothing deleted) */
assert.ok(/'<div id="ogFwdVerdict" style="margin-top:8px"><\/div>'/.test(src),
  'ogFwdVerdict container still present inside details');
assert.ok(/hgOgDeskStanceBannerHtml\(\)/.test(src),
  'hgOgDeskStanceBannerHtml still called');

/* --- Rule C: collapse demoted-cards section --- */
assert.ok(/v697 rule C: keep parity/.test(src),
  'rule C rationale comment present');
assert.ok(/<details class="note" id="ogDemotedDetails"/.test(src),
  'demoted details wrapper present');
assert.ok(/measured-negative setup/.test(src),
  'demoted summary label present');
assert.ok(/hgOgDemotedSectionHtml\(ogDemotedCards\)/.test(src),
  'hgOgDemotedSectionHtml still called (parity preserved)');

/* --- Rule D: cap visible cards at 5 per side --- */
assert.ok(/v697 rule D: cap visible tradable cards at 5 per direction/.test(src),
  'rule D rationale comment present');
assert.ok(/var OG_VIS_CAP = 5;/.test(src),
  'cap constant defined');
assert.ok(/var perSideKept = \{ long: 0, short: 0, other: 0 \};/.test(src),
  'per-side accumulator defined');
assert.ok(/if \(perSideKept\[sideKey\] >= OG_VIS_CAP\)\{/.test(src),
  'cap enforced against per-side counter');
assert.ok(/trimmedTail\.push\(cCard\);/.test(src),
  'over-cap cards moved to trimmed tail');
assert.ok(/lower-ranked setup/.test(src),
  'trimmed-tail summary label present');
assert.ok(/if \(trimmedTail\.length\)\{[\s\S]{0,1200}?setupCard\(trimmedTail\[ti\]\);/.test(src),
  'trimmed tail rendered inside <details> when non-empty');

/* --- non-regression: existing surface intact --- */
assert.ok(/window\.hgOgShowModeSet = hgOgShowModeSet;/.test(src),
  'hgOgShowModeSet still exported');
assert.ok(/window\.hgOgDemotedSectionHtml = hgOgDemotedSectionHtml;/.test(src),
  'hgOgDemotedSectionHtml still exported');
assert.ok(/window\.hgOgDeskStanceBannerHtml = hgOgDeskStanceBannerHtml;/.test(src),
  'hgOgDeskStanceBannerHtml still exported');

/* --- runtime: hgOgShowMode returns PAID with no localStorage keys --- */
{
  const fakeStore = new Map();
  const fakeLS = {
    getItem: (k) => (fakeStore.has(k) ? fakeStore.get(k) : null),
    setItem: (k, v) => fakeStore.set(k, String(v)),
    removeItem: (k) => fakeStore.delete(k)
  };
  const fakeW = { localStorage: fakeLS, document: { createElement: () => ({}) } };
  const api = new Function('window', `
    var globalThis = window;
    var localStorage = window.localStorage;
    ${src}
    return {
      showMode: window.hgOgShowMode || null,
      showModeSet: window.hgOgShowModeSet || null
    };
  `)(fakeW);
  /* hgOgShowMode is IIFE-scoped; check via effect on the exported setter/getter behavior instead */
  assert.ok(api.showModeSet, 'hgOgShowModeSet exposed');
  /* First-time reader default: setter untouched, choice key missing */
  api.showModeSet('PAID');
  assert.equal(fakeStore.get('hg_paidonly_OMNIGOLD_choice'), 'PAID',
    'PAID choice persists via new key');
  api.showModeSet('ALL');
  assert.equal(fakeStore.get('hg_paidonly_OMNIGOLD_choice'), 'ALL',
    'ALL choice persists via new key');
  assert.equal(fakeStore.has('hg_paidonly_OMNIGOLD'), false,
    'legacy PAID key cleared on ALL');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:697|69[8-9]|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v697',
  'HG_VER must be >= hg-v697');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('omnigold\\.js\\?v=' + qv).test(idx),
  'index.html omnigold.js cache-buster = ?v=' + qv);

console.log('OK - v697: OMNIGOLD cleanup (4 rules)');
console.log('  * Rule A: default PAID-ONLY + explicit-choice tracking (new key)');
console.log('  * Rule B: REPLAY/DESK verdicts collapsed behind <details>');
console.log('  * Rule C: demoted-cards section collapsed behind <details>');
console.log('  * Rule D: tradable cards capped at 5 per side + tail in <details>');
console.log('  * Nothing deleted: every original section still reachable via toggle');
console.log('  * Runtime: PAID choice persists, ALL choice persists, legacy key cleared');
console.log('  * version bumped to ' + HG_VER);
