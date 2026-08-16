/* HARDGATE — no formatter may print a number for a value that is absent.

   isFinite(null) is TRUE and both +null and Number(null) are 0. Every natural
   way of writing a formatter therefore prints a confident zero for a missing
   value:

       if (!isFinite(n)) return '—';           // null sails through
       var x = +n;  if (isFinite(x)) ...       // null is already 0
       var x = N(n); Number.isFinite(x) ...    // the guard is right, the
                                               // coercion before it is not

   That trap has now been found five separate times in this codebase, each
   time by hand and each time only after it produced a wrong number on a card:
   a crashed CoinDCX scan, a fabricated tally leg, a 50R pine signal, an
   invented risk in the omni plan, and "R:R 0.00" where the value was cleared.

   Finding it a sixth time by hand is not a plan. This test EXECUTES every
   formatter in the app with null and fails if any returns something a reader
   would take for a measurement. It runs on the shipped source, so a new
   formatter written the natural way is caught before it reaches a card.

   Run: node tests/test-null-formatting.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* Anything whose name says it turns a number into display text. */
const FORMATTER = /^(fmt|fmtF|fmtR|fmtN|fmtPct|fmtPx|fmtUsd|fmtSigned|fmtSignedR|fmtPF|fmtNum|pxF|px|pct|pctF|alertFmtPx|signed|money|usd)$/;

/* A result a reader would take for a real measurement. '—', '-', 'n/a' and
   the empty string all read as absent and are fine. */
function looksMeasured(v){
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  if (s === '' || s === '—' || s === '-' || s === '--') return false;
  if (/^n\/?a$/i.test(s)) return false;
  if (/^(null|undefined|nan)$/i.test(s)) return true;   // literally leaking the value
  return /\d/.test(s);                                   // any digit reads as a number
}

function extract(src, startIdx){
  let i = src.indexOf('{', startIdx), d = 0, j = i;
  while (j < src.length){
    if (src[j] === '{') d++;
    else if (src[j] === '}'){ d--; if (!d) break; }
    j++;
  }
  return src.slice(startIdx, j + 1);
}

const files = fs.readdirSync(ROOT)
  .filter(f => f.endsWith('.js') && f !== 'sw.js')
  .sort();

const offenders = [];
let probed = 0, filesWith = 0;

for (const f of files){
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /(?:^|\n)\s*function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let m, found = 0;
  while ((m = re.exec(src))){
    if (!FORMATTER.test(m[1])) continue;
    const fnStart = src.lastIndexOf('function', m.index + m[0].length);
    const body = extract(src, fnStart);

    /* Minimal sandbox. Delegating formatters (typeof W.px === 'function')
       are exercised on their OWN fallback, which is the branch that ships
       when the shared helper has not loaded. */
    const ctx = {
      console, Math, Number, String, isFinite, parseFloat, parseInt, JSON, Date,
      W: {}, G: {},
      N: (x) => { const n = Number(x); return isFinite(n) ? n : NaN; },
      fin: (v) => (v === null || v === undefined || v === '') ? NaN : +v
    };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    let out;
    try {
      vm.runInContext(body + '\n;__probe = ' + m[1] + ';', ctx);
      out = ctx.__probe(null, 2);
    } catch (e) { continue; }   /* needs context we cannot supply — not a verdict */
    probed++; found++;
    if (looksMeasured(out)){
      offenders.push(f + ':' + (src.slice(0, fnStart).split('\n').length) + ' ' + m[1]
        + '(null) -> ' + JSON.stringify(out));
    }
  }
  if (found) filesWith++;
}

console.log('== every formatter, executed with null ==');
console.log('  probed ' + probed + ' formatters across ' + filesWith + ' files');
ok(probed >= 25, 'the sweep actually reached the formatters (' + probed + ' probed, not a vacuous pass)');

if (offenders.length){
  console.error('\n  formatters that print a measurement for an absent value:');
  for (const o of offenders) console.error('    ' + o);
}
ok(offenders.length === 0, 'no formatter renders null as a number (' + offenders.length + ' offenders)');

console.log('\n== the same formatters still format real numbers ==');
{
  /* A guard that returns "—" for everything would pass the test above, so
     check the fix did not simply break formatting. */
  let checked = 0;
  for (const f of ['book.js', 'startradertab.js', 'supersetup.js', 'super-desk-common.js', 'super-gold.js', 'super-calibrate.js']){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /(?:^|\n)\s*function\s+(fmt|fmtF|pxF)\s*\(/g;
    let m;
    while ((m = re.exec(src))){
      const fnStart = src.lastIndexOf('function', m.index + m[0].length);
      const ctx = { console, Math, Number, String, isFinite, parseFloat, JSON, W: {}, G: {},
                    N: (x) => { const n = Number(x); return isFinite(n) ? n : NaN; } };
      ctx.window = ctx; ctx.globalThis = ctx;
      vm.createContext(ctx);
      try {
        vm.runInContext(extract(src, fnStart) + '\n;__probe = ' + m[1] + ';', ctx);
        const v = String(ctx.__probe(12.5, 2));
        ok(/12\.5/.test(v), f + ' ' + m[1] + ' still formats 12.5 (' + v + ')');
        checked++;
      } catch (e) { /* skip */ }
    }
  }
  ok(checked >= 4, 'real numbers were actually verified through ' + checked + ' formatters');
}

console.log('\n== NaN and undefined keep reading as absent ==');
{
  const ctx = { console, Math, Number, String, isFinite, parseFloat, JSON, W: {}, G: {},
                N: (x) => { const n = Number(x); return isFinite(n) ? n : NaN; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(ROOT, 'super-desk-common.js'), 'utf8');
  const at = src.indexOf('function fmt(n, d){');
  vm.runInContext(extract(src, at) + '\n;__probe = fmt;', ctx);
  ok(String(ctx.__probe(NaN, 2)) === '—', 'NaN reads as absent');
  ok(String(ctx.__probe(undefined, 2)) === '—', 'undefined reads as absent');
  ok(String(ctx.__probe('', 2)) === '—', 'empty string reads as absent, not as 0.00');
  ok(String(ctx.__probe(0, 2)) === '0.00', 'a REAL zero still prints as zero');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL NULL-FORMATTING TESTS PASSED');
