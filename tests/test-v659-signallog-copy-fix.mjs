/* v659: fix SIGNAL LOG copy that was stale since v646.

   Three user-visible strings were still naming only the pre-v646 sources
   (BRAIN + GOLD SCALP + GOLD SWING) even though the log has been pulling
   from cswing, cscalp, and supergold since v646. Users looking at an
   empty log would reasonably think crypto isn't wired.

   Fix: all three strings are now rebuilt from the SOURCES array at
   render/mount time, so they name every active source and future
   source additions get named automatically. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* --- 1. subtitle rebuilt from SOURCES --- */
assert.ok(
  /v659: subtitle was stuck at 'brain \+ scalp \+ swing'/.test(sl),
  'subtitle rebuild must include v659 rationale comment');
assert.ok(
  /'<h2>SIGNAL LOG <span>persistent journal of ' \+ SOURCES\.join\(' \+ '\)/.test(sl),
  'subtitle must be built from SOURCES.join(\" + \") at render time');
assert.ok(
  !/journal of brain \+ scalp \+ swing signals/.test(sl),
  'stale "brain + scalp + swing" subtitle wording must be gone');

/* --- 2. dynamic empty-state text in render() rebuilt from SOURCES --- */
assert.ok(
  /v659: empty-state text was stuck at 'BRAIN, GOLD SCALP or GOLD SWING'/.test(sl),
  'dynamic empty-state rebuild must include v659 rationale');
assert.ok(
  /whenever any of these sources have '\n\s+\+ 'live results: ' \+ SOURCES\.map\(function\(s\)\{ return s\.toUpperCase\(\); \}\)\.join\(', '\)/.test(sl),
  'dynamic empty-state must list sources upper-cased and comma-joined');
assert.ok(
  !/whenever BRAIN, GOLD SCALP or GOLD SWING have live results\./.test(sl),
  'stale "BRAIN, GOLD SCALP or GOLD SWING" wording must be gone');

/* --- 3. static #slEmpty template also rebuilt from SOURCES --- */
assert.ok(
  /v659: static empty-state text also rebuilt from SOURCES for parity/.test(sl),
  'static empty-state rebuild must include v659 rationale');
/* both empty-state variants use the same phrasing — the dynamic version
   splits the string across concatenated lines so match with a tolerant
   pattern that treats intra-string "' + '" concatenation as whitespace */
const emptyPattern = /whenever any of these sources have(?: ')?\s*(?:\+ ')?live results:/g;
const occurrences = (sl.match(emptyPattern) || []).length;
assert.equal(occurrences, 2,
  'exactly 2 empty-state strings should exist (dynamic in render + static in mount); saw ' + occurrences);

/* --- SOURCES constant is still correct --- */
assert.ok(/var SOURCES = \['cswing', 'cscalp', 'scalp', 'swing', 'supergold', 'brain'\];/.test(sl),
  'SOURCES array shape must still match the pullers so the rebuilt strings are accurate');

/* --- version --- */
assert.ok(/^hg-v(?:659|66\d|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v659',
  'HG_VER must be >= hg-v659 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v659: SIGNAL LOG copy fixed (subtitle + empty-state)');
console.log('  * subtitle rebuilt from SOURCES.join(" + ") \u2014 lists all 6 sources');
console.log('  * dynamic empty-state text (render()) rebuilt from SOURCES');
console.log('  * static empty-state text (mount HTML) rebuilt from SOURCES');
console.log('  * stale "BRAIN, GOLD SCALP or GOLD SWING" wording removed');
console.log('  * version bumped to ' + HG_VER);
