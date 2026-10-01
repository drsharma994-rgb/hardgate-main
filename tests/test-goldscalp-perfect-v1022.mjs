/* HARDGATE — hg-v1022: THE PERFECT SETUP tier (GOLD SCALP side).

   The desk already crowns a MOST PROBABLE SETUP from a transparent confluence
   tally and pins every issued setup under a conviction lock. The PERFECT tier
   is the strictest confluence read it can honestly print: the leader is not
   demoted or vetoed (it leads on its own merit), its grade is exactly 'A',
   nothing on the books opposes it (oppose === 0) and its tally is strictly
   positive and readable. It is a FILTER, not a promise — the forward ledger's
   `perfect` read-mark is how it earns a measured outcome, exactly as the MOST
   PROBABLE cohort already is.

   goldscalp.js is IIFE-scoped and keeps a deliberately small module-scope
   surface (test-gold-render-integrity.mjs turns red at 20 exports), so the
   predicate travels on the HG_tabs registration — the same hg-v967/v968 route
   as the fundamental / session-floor / taker-flow passes — and the bannerHTML
   + forward-record wiring is asserted at the source level (those functions are
   intentionally not exported).

   Covers:
     1) the PERFECT predicate: true only at full confluence, false on each leg
     2) the banner stamp: the ★ PERFECT badge is gated on gsxPerfect(best)
     3) the forward-ledger read-mark: `perfect` rides the GOLDSCALP record
   Run: node tests/test-goldscalp-perfect-v1022.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
      querySelector: () => null, querySelectorAll: () => [] }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  try {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8'), ctx, { filename: 'goldscalp.js' });
  } catch(e){ console.error('boot failed: ' + e.message); }
  return ctx;
}
function seam(W){ const t = W.HG_tabs.filter(function(x){ return x.id === 'goldscalp'; })[0]; return t || {}; }

const W = boot();
const gsxPerfect = seam(W).gsxPerfect;

/* ---- 1) the predicate ---- */
console.log('== the PERFECT predicate ==');
assert(typeof gsxPerfect === 'function', 'gsxPerfect reachable on the HG_tabs seam (no 20th export)');
/* a clean leader: not demoted/vetoed, grade A, nothing opposing, +tally */
const perfect = { demoted: false, vetoed: false, grade: 'A', oppose: 0, tally: 5 };
assert(gsxPerfect(perfect) === true, 'a grade-A leader with +tally and no opposes is PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { demoted: true })) === false, 'demoted → not PERFECT (leads on merit only)');
assert(gsxPerfect(Object.assign({}, perfect, { vetoed: true })) === false, 'vetoed → not PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { grade: 'B' })) === false, 'grade B → not PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { grade: 'clean' })) === false, 'grade clean → not PERFECT (needs exact A)');
assert(gsxPerfect(Object.assign({}, perfect, { grade: null })) === false, 'grade unread → not PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { oppose: 1 })) === false, 'one opposing read → not PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { oppose: null })) === false, 'oppose unread (null) → not PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { tally: 0 })) === false, 'tally 0 → not PERFECT (needs strictly positive)');
assert(gsxPerfect(Object.assign({}, perfect, { tally: -2 })) === false, 'negative tally → not PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { tally: null })) === false, 'tally unread (null) → not PERFECT');
assert(gsxPerfect(Object.assign({}, perfect, { tally: NaN })) === false, 'tally NaN → not PERFECT');
assert(gsxPerfect(null) === false, 'null → not PERFECT');
assert(gsxPerfect({}) === false, 'empty → not PERFECT');

/* ---- 2) the banner stamp (source wiring) ---- */
console.log('== the banner stamp ==');
const src = fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8');
assert(/var perfectBadge = gsxPerfect\(best\)/.test(src), 'the banner badge is gated on gsxPerfect(best)');
assert(/\\u2605 PERFECT/.test(src), 'the ★ PERFECT badge string (star as \\u2605, like the trendmx stamp) is wired');
assert(/MOST PROBABLE SETUP' \+ perfectBadge/.test(src), 'the badge rides the banner eye, not a separate line');

/* ---- 3) the forward-ledger read-mark (source wiring) ---- */
console.log('== the forward-ledger read-mark ==');
assert(/perfect: \(!c\.demoted && !c\.vetoed && c\.grade === 'A' && c\.oppose === 0/.test(src),
  'the record rebuild adds the `perfect` read-mark — inlined (not gsxPerfect) so the lifted-map test stays self-contained');
assert(/typeof c\.tally === 'number' && isFinite\(c\.tally\) && c\.tally > 0\) \? true : undefined/.test(src),
  'the read-mark is strictly-positive-tally gated and stores true/undefined (measured, not promised)');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
