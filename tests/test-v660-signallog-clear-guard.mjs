/* v660: CLEAR JOURNAL guard \u2014 confirm before destroying + destructive styling.

   Prior to v660: one tap on CLEAR JOURNAL destroyed the entire 500-row
   log with no confirmation. On mobile where a stray tap on a scrolling
   list can catch the button, this is a real landmine. The button also
   looked identical to EXPORT CSV beside it, so there was no visual cue
   the action was destructive.

   Fix:
     1. clearJournal(opts) now shows confirm() unless opts.force===true.
        The prompt names the row count and warns "cannot be undone".
     2. The button carries a new .sl-btn-danger class \u2014 muted red border
        by default, hover paints a clear red so intent is unambiguous
        before the tap lands. focus-visible outline matches for keyboard.
     3. Return value: true on cleared, false on cancelled/error. Existing
        callers that ignore the return still work. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');
const sl = readFileSync(resolve(ROOT, 'signallog.js'), 'utf8');

/* --- clearJournal takes an opts arg + implements the confirm guard --- */
assert.ok(/function clearJournal\(opts\)\{/.test(sl),
  'clearJournal must accept an opts arg (so opts.force can bypass confirm)');
assert.ok(/var force = opts && opts\.force === true;/.test(sl),
  'clearJournal must derive `force` from opts.force === true');
assert.ok(/if \(!force && typeof confirm === 'function'\)\{/.test(sl),
  'confirm() must be gated on force being false AND confirm existing');
assert.ok(/Delete the entire signal log' \+ \(n \?/.test(sl),
  'confirm prompt must be built with row-count interpolation');
assert.ok(/This cannot be undone\./.test(sl),
  'confirm prompt must warn "cannot be undone"');
assert.ok(/if \(!confirm\(msg\)\) return false;/.test(sl),
  'must return false when confirm() is declined');
assert.ok(/return true;\n\s+\}catch\(e\)\{ return false; \}/.test(sl),
  'success path returns true, catch returns false');
/* the v660 rationale must live in a comment */
assert.ok(/v660: CLEAR JOURNAL is destructive/.test(sl),
  'v660 rationale comment must be present on clearJournal');

/* --- button carries the destructive class + tooltip --- */
assert.ok(/<button class="btn sl-btn-danger" id="slClear" title="delete the entire signal log \(asks to confirm first\)">CLEAR JOURNAL<\/button>/.test(sl),
  'CLEAR JOURNAL button must carry class sl-btn-danger + a descriptive title tooltip');

/* --- CSS for the destructive button --- */
assert.ok(/#tab_signallog \.sl-btn-danger\{border-color:rgba\(255,107,74,\.35\)\}/.test(sl),
  '.sl-btn-danger default state must have a muted red border');
assert.ok(/#tab_signallog \.sl-btn-danger:hover\{background:rgba\(255,107,74,\.12\);'\s*\+\s*'border-color:rgba\(255,107,74,\.7\);color:#ff8b6a\}/.test(sl),
  '.sl-btn-danger:hover must paint red background + strong red border + red text');
assert.ok(/#tab_signallog \.sl-btn-danger:focus-visible\{outline:2px solid rgba\(255,107,74,\.6\);outline-offset:2px\}/.test(sl),
  '.sl-btn-danger:focus-visible must have a matching red outline for keyboard users');
/* the CSS rationale is annotated */
assert.ok(/v660: destructive-button styling for CLEAR JOURNAL/.test(sl),
  'v660 CSS rationale comment must be present');

/* --- CSS assembles cleanly (SL_CSS chain still parses) — use new Function
   so the module scope doesn't leak the SL_CSS binding into the eval frame */
const cssBlock = sl.match(/var SL_CSS = ''[\s\S]*?';/)[0];
const css = new Function(cssBlock + '\nreturn SL_CSS;')();
assert.ok(css.includes('.sl-btn-danger{'), 'assembled CSS must contain .sl-btn-danger rule');
assert.ok(css.includes('.sl-btn-danger:hover{'), 'assembled CSS must contain hover variant');
assert.ok(css.includes('.sl-btn-danger:focus-visible{'), 'assembled CSS must contain focus-visible variant');

/* --- click handler is unchanged (still calls clearJournal()) --- */
assert.ok(/__ui\.clear\.addEventListener\('click', function\(\)\{ clearJournal\(\); \}\)/.test(sl),
  'click handler must still call clearJournal() \u2014 the guard lives inside the function');

/* --- version --- */
assert.ok(/^hg-v(?:660|66[1-9]|67\d|6[8-9]\d|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v660',
  'HG_VER must be >= hg-v660 (saw ' + HG_VER + ')');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw),
  'sw.js HG_CACHE must match ' + HG_VER);
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('build-stamp\\.js\\?v=' + qv).test(idx),
  'index.html cache-buster must be ?v=' + qv);

console.log('OK \u2014 v660: CLEAR JOURNAL guard');
console.log('  * confirm() prompt with row count + "cannot be undone" warning');
console.log('  * opts.force bypass for programmatic callers');
console.log('  * destructive .sl-btn-danger class \u2014 muted red border, red hover');
console.log('  * focus-visible outline for keyboard users');
console.log('  * descriptive tooltip on the button');
console.log('  * version bumped to ' + HG_VER);
