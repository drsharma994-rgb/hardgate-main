/* v654: SIGNAL LOG filter chips + symbol search.

   Three combinable filters render above the table:
     - source: multi-toggle chips, one per SOURCES entry, plus an ALL chip
     - direction: 3-way ALL / LONG / SHORT
     - symbol: substring search box

   The render() function applies these before calling tableHTML so the
   badge column reflects only the filtered rows. Count chip shows
   "N shown of M · M / MAX entries" when a filter is active. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* --- filter state + applyFilters exist --- */
assert.ok(/var __filters = \{ sources: null, dir: 'all', q: '' \};/.test(sl),
  '__filters state must be declared');
assert.ok(/function applyFilters\(entries\)/.test(sl),
  'applyFilters() must be defined');
/* early-exit fast path when no filter is set */
assert.ok(/if \(\(!sources \|\| !sources\.size\) && dir === 'all' && !q\) return entries/.test(sl),
  'applyFilters must short-circuit when no filter is active');
/* source, direction, and query predicates all present */
assert.ok(/sources && sources\.size && !sources\.has\(e\.source\)/.test(sl),
  'source Set membership check required');
assert.ok(/dir !== 'all' && e\.dir !== dir/.test(sl),
  'direction inequality check required');
assert.ok(/e\.sym[\s\S]{0,40}\.toUpperCase\(\)\.indexOf\(q\) === -1/.test(sl),
  'case-insensitive symbol substring check required');

/* --- render() uses filter + updates count with "shown of" --- */
assert.ok(/v654: apply source\/direction\/query filters before render/.test(sl),
  'render() must include v654 filter comment');
assert.ok(/var filtered = applyFilters\(__journal\);/.test(sl),
  'render() must call applyFilters on the journal');
assert.ok(/filtered\.length !== __journal\.length[\s\S]{0,120}shown of/.test(sl),
  'count chip must show "N shown of M" when filter narrows the list');
assert.ok(/tableHTML\(filtered\)/.test(sl),
  'render() must pass the filtered array to tableHTML');
assert.ok(/no rows match the current filter/.test(sl),
  'empty state must distinguish "no rows match filter" from "no signals logged"');

/* --- filter chip UI + handlers --- */
assert.ok(/function rebuildFilterChips\(\)/.test(sl),
  'rebuildFilterChips() must be defined');
assert.ok(/function bindFilterHandlers\(\)/.test(sl),
  'bindFilterHandlers() must be defined');
assert.ok(/data-sl-src="__all__"/.test(sl),
  'source chip group must contain an "__all__" chip');
/* one chip per SOURCE must render dynamically from the SOURCES array */
assert.ok(/for \(var si = 0; si < SOURCES\.length; si\+\+\)/.test(sl),
  'source chips must be generated from the SOURCES array (not hardcoded)');
assert.ok(/data-sl-dir="all"[\s\S]{0,200}data-sl-dir="long"[\s\S]{0,200}data-sl-dir="short"/.test(sl),
  'direction chip group must contain all three (all / long / short)');
assert.ok(/id="slQ"/.test(sl),
  'symbol search input must have id=slQ');
assert.ok(/__filters\.sources = new Set\(\)/.test(sl),
  'source chip click handler must lazily create the Set');
assert.ok(/__ui\.q\.addEventListener\('input'/.test(sl),
  'symbol input must be bound to input event for live filtering');
assert.ok(/__ui\.srcChips\.addEventListener\('click'/.test(sl),
  'source chip group must use event delegation on click');
assert.ok(/__ui\.dirChips\.addEventListener\('click'/.test(sl),
  'direction chip group must use event delegation on click');
assert.ok(/bindFilterHandlers\(\);/.test(sl),
  'mount() must call bindFilterHandlers');

/* --- __ui exposes the new refs --- */
assert.ok(/srcChips: el\.querySelector\('#slSrcChips'\)/.test(sl),
  '__ui.srcChips must point at #slSrcChips');
assert.ok(/dirChips: el\.querySelector\('#slDirChips'\)/.test(sl),
  '__ui.dirChips must point at #slDirChips');
assert.ok(/q:\s*el\.querySelector\('#slQ'\)/.test(sl),
  '__ui.q must point at #slQ');

/* --- CSS for chips + search --- */
assert.ok(/#tab_signallog \.sl-filters/.test(sl),
  '.sl-filters wrapper CSS required');
assert.ok(/#tab_signallog \.sl-chip\{/.test(sl),
  '.sl-chip base style required');
assert.ok(/#tab_signallog \.sl-chip\.sl-chip-on/.test(sl),
  '.sl-chip-on active state required');
assert.ok(/#tab_signallog \.sl-search\{/.test(sl),
  '.sl-search input style required');
assert.ok(/#tab_signallog \.sl-search:focus/.test(sl),
  '.sl-search:focus style required');

/* --- version --- */
assert.ok(/^hg-v(?:654|65[5-9]|66\d|[7-9]\d\d|\d{4,})$/.test(HG_VER),
  'HG_VER must be >= hg-v654 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v654: SIGNAL LOG filter chips + symbol search');
console.log('  * source multi-toggle chips (rebuilt from SOURCES array)');
console.log('  * direction 3-way (ALL / LONG / SHORT)');
console.log('  * symbol substring search (case-insensitive, live-filter)');
console.log('  * render() applies filters + shows "N shown of M" in the count');
console.log('  * distinct empty-state text when filter matches zero rows');
console.log('  * chip + search CSS wired');
console.log('  * version bumped to ' + HG_VER);
