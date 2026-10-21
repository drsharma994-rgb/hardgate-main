#!/usr/bin/env node
/*
  tests/test-gold-candle-forecast-diagnose-v1347.mjs — Candle Forecast "failed
  closed" now names WHICH gate stopped the engine, not that it did.

  The hg-v940 trap: one message for N causes. goldCandleForecast has SIX
  distinct null returns (<30 bars; atr/ema missing; non-finite OHLC on the
  last bar; last-bar h<=l; atrLast<=0; non-finite close inside the window)
  and the module above answered all six with "The candle read failed closed."
  The user asked the same question across hg-v1338, v1342 and v1343; neither
  prior pack found the cause, because the message gave nothing to find.

  This guard DRIVES the real hgCfDiagnose on the real tape shapes that
  trigger each engine null return, requires the module to call the
  diagnostic when the engine returns null, and asserts that the two homes
  stay in sync by construction (hg-v949): the diagnostic is defined BESIDE
  goldCandleForecast in goldind.js and the module reads it through the
  window export, never through a second copy.

  Behavioural mutation pass runs at the end against the real source.
*/

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, hgVerGte, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDIND = path.join(ROOT, 'goldind.js');
const MODULE = path.join(ROOT, 'gold-candle-forecast.js');
const SW = path.join(ROOT, 'sw.js');

let fails = 0;
let total = 0;
function ok(cond, msg){ total++; if(!cond){ fails++; console.log('FAIL §' + msg); } }

function makeSandbox(goldindSrc){
  const sandbox = {
    window: {}, document: { getElementById: () => null }, console,
    localStorage: { getItem: () => null, setItem: () => {} },
    Math, Number, Date, Array, Object, String, Boolean, JSON, Error, isFinite, isNaN, parseInt, parseFloat
  };
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'indicators.js'), 'utf8'), sandbox, { filename: 'indicators.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'indicators2.js'), 'utf8'), sandbox, { filename: 'indicators2.js' });
  vm.runInContext(goldindSrc, sandbox, { filename: 'goldind.js' });
  return sandbox;
}

function tape(n, shaper){
  const rows = []; let p = 4080;
  for (let i = 0; i < n; i++){
    const o = p;
    const d = shaper ? shaper(i) : Math.sin(i*0.3)*0.6;
    const c = o + d;
    rows.push({ t: 1760000000 + i*900, o, h: Math.max(o,c)+0.5, l: Math.min(o,c)-0.5, c, v: 1000 });
    p = c;
  }
  return rows;
}

const goldindSrc = fs.readFileSync(GOLDIND, 'utf8');
const moduleSrc = fs.readFileSync(MODULE, 'utf8');
const swSrc = fs.readFileSync(SW, 'utf8');

const sb = makeSandbox(goldindSrc);
const diag = sb.hgCfDiagnose;

/* §1 — the helper exists and is exported through the one home (hg-v949). */
ok(typeof sb.hgCfDiagnose === 'function', '1.1 hgCfDiagnose defined');
ok(typeof sb.window.hgCfDiagnose === 'function', '1.2 hgCfDiagnose exported on window');
ok(sb.window.hgCfDiagnose === sb.hgCfDiagnose, '1.3 export points at the module function (one home)');
ok(/function hgCfDiagnose\(rows\)/.test(goldindSrc), '1.4 defined by name in goldind.js');
ok(/window\.hgCfDiagnose\s*=\s*hgCfDiagnose/.test(goldindSrc), '1.5 export is a direct reference');

/* §2 — every engine null return names its specific cause. */
ok(/not an array/.test(diag(null)), '2.1 null input names "not an array"');
ok(/not an array/.test(diag(undefined)), '2.2 undefined input names "not an array"');
ok(/not an array/.test(diag('nope')), '2.3 string input names "not an array"');
ok(/empty/.test(diag([])), '2.4 empty array names "empty"');

const thin25 = tape(25);
const thin25msg = diag(thin25);
ok(/too short/.test(thin25msg) && /25/.test(thin25msg) && /needs 30/.test(thin25msg), '2.5 25-bar thin tape names count and floor');

const thin29 = tape(29);
ok(/too short/.test(diag(thin29)) && /29/.test(diag(thin29)), '2.6 29-bar thin tape names count');

const thin1 = tape(1);
ok(/too short/.test(diag(thin1)) && /1 bar/.test(diag(thin1)), '2.7 1-bar thin tape names count');

const bad1 = tape(30); bad1[29].h = NaN;
ok(/missing open, high, low or close/.test(diag(bad1)), '2.8 NaN high on last bar named');
const bad2 = tape(30); bad2[29].l = Infinity;
ok(/missing open/.test(diag(bad2)), '2.9 Infinity low on last bar named');

const flat = tape(30); flat[29] = { t: 0, o: 4100, h: 4100, l: 4100, c: 4100 };
ok(/no range/.test(diag(flat)) && /4100/.test(diag(flat)), '2.10 h==l on last bar names the two values');

const nonfin = tape(30); nonfin[10].c = NaN;
const nonfinMsg = diag(nonfin);
ok(/non-finite close/.test(nonfinMsg) && /bar 11/.test(nonfinMsg) && /of 30/.test(nonfinMsg), '2.11 non-finite close names the index and total');

/* §3 — a healthy tape (engine returns a verdict) still gets a legible
   fallback through the diagnoser, because the caller only invokes it after
   the engine already returned null — but a reader of the engine would read
   the same no-verdict shape. */
const healthy = tape(50);
const healthyMsg = diag(healthy);
ok(/read every gate/.test(healthyMsg) || /stood aside/.test(healthyMsg), '3.1 healthy tape says gates read, no verdict (the engine ran)');

/* §4 — fail OPEN: the diagnoser must never throw and must always return a
   string. The module above wraps the call in try/catch too — asserted — but
   both layers must be robust. */
ok(typeof diag(null) === 'string', '4.1 returns string on null');
ok(typeof diag({}) === 'string', '4.2 returns string on non-array object');
ok(typeof diag(42) === 'string', '4.3 returns string on number');
const circ = { get length(){ throw new Error('boom'); } };
let threw = false;
try { diag(circ); } catch (e) { threw = true; }
ok(!threw, '4.4 does not throw on an iterable that throws');

/* §5 — the module reads the diagnoser through the window export (one call
   site), inside a try/catch, and renders a specific message instead of the
   old shrug. We assert on the module source: three facts in one block, each
   a line a mutation must preserve, each a different question. */
const nullBlock = (() => {
  const idx = moduleSrc.indexOf('const forecast = window.goldCandleForecast(candles, macroLive, tapes)');
  if (idx < 0) return '';
  return moduleSrc.slice(idx, idx + 2000);
})();
ok(nullBlock.length > 0, '5.1 engine call site found in module');
ok(/if\s*\(!forecast\)/.test(nullBlock), '5.2 null guard present at the call site');
ok(/hgCfDiagnose/.test(nullBlock), '5.3 diagnoser named inside the null branch');
ok(/typeof\s+window\.hgCfDiagnose\s*===\s*'function'/.test(nullBlock), '5.4 typeof-guarded (fail open to old line)');
ok(/try\s*\{\s*return\s+window\.hgCfDiagnose\(candles\)/.test(nullBlock), '5.5 called with candles inside try');
ok(/catch\s*\(eDg\)/.test(nullBlock), '5.6 catch block names the error');
/* The old line must still be present as the fallback, so an absent helper
   does not blank the tab. */
ok(/'The candle read failed closed\. Nothing was invented\.'/.test(nullBlock), '5.7 old line kept as fallback');
/* Rendered output goes through a String()+replace sanitiser (XSS discipline
   the rest of the module already uses), so the diagnostic cannot smuggle
   HTML onto the panel even if the helper's string were ever user-tainted. */
ok(/String\(diagWhy\)\.replace\(\/</.test(nullBlock), '5.8 output HTML-sanitised');

/* §6 — the diagnostic lives in goldind.js, NOT in gold-candle-forecast.js
   (hg-v949: one home). A second copy of the rule-set would drift the
   moment the engine's null set changes. */
ok(!/function hgCfDiagnose\b/.test(moduleSrc), '6.1 module does not define a second hgCfDiagnose');
/* Count occurrences of the specific null-reason strings in the module — the
   diagnoser's phrasing should appear only in the goldind one home, so a
   drift between the two files is detectable. */
ok(!/engine needs 30/.test(moduleSrc), '6.2 "engine needs 30" lives only in goldind.js');
ok(!/no range \(high/.test(moduleSrc), '6.3 flat-bar phrasing lives only in goldind.js');

/* §7 — no gate reads the diagnostic. It is a user-facing string, nothing
   more; a reader that gates on its CONTENT would be a new rule riding a
   diagnostic — the hg-v966 trap. Asserted over every gate file. */
const gateFiles = [
  'cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
  'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'
];
for (const g of gateFiles){
  const p = path.join(ROOT, g);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  ok(!/hgCfDiagnose/.test(src), '7.' + g + ' does not read hgCfDiagnose');
}

/* §8 — ship stamps. The pack ships at hg-v1347 or later; sw.js matches
   build-stamp.js. */
ok(hgVerGte(HG_VER, 'hg-v1347'), '8.1 version ' + HG_VER + ' is >= hg-v1347');
ok(swCacheOk(swSrc), '8.2 sw.js HG_CACHE matches build-stamp version');

/* §9 — behavioural mutation pass. Each mutation flips one deliberate
   behaviour in the SHIPPED source and the guard above must catch it. */
const mutations = [
  { name: 'drop <30 floor',
    patch: s => s.replace("if (rows.length < 30)", "if (rows.length < 1)") },
  { name: 'drop array check',
    patch: s => s.replace("if (!Array.isArray(rows)) return 'The 15m tape was not an array of bars, so no read was attempted.';",
                          "if (false) return 'The 15m tape was not an array of bars, so no read was attempted.';") },
  { name: 'drop empty check',
    patch: s => s.replace("if (rows.length === 0) return 'The 15m tape was empty, so no read was attempted.';",
                          "if (false) return 'The 15m tape was empty, so no read was attempted.';") },
  { name: 'drop OHLC-finite check',
    patch: s => s.replace("if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) {",
                          "if (false) {") },
  { name: 'drop h>l check',
    patch: s => s.replace("if (!(h > l)) {", "if (false) {") },
  { name: 'drop close-finite loop check',
    patch: s => s.replace("if (!isFinite(ci)) {", "if (false) {") },
  { name: 'remove window export',
    patch: s => s.replace("window.hgCfDiagnose = hgCfDiagnose;", "window.hgCfDiagnose_was = hgCfDiagnose;") }
];

let caughtMut = 0;
for (const m of mutations){
  const mutated = m.patch(goldindSrc);
  if (mutated === goldindSrc) { console.log('WARN mutation did not change source: ' + m.name); continue; }
  const sbm = makeSandbox(mutated);
  const dm = sbm.hgCfDiagnose;
  const expM = sbm.window.hgCfDiagnose;
  let caught = false;
  try {
    switch (m.name){
      case 'drop <30 floor':
        if (typeof dm === 'function'){
          const out = dm(tape(25));
          if (!/too short/.test(out)) caught = true;
        }
        break;
      case 'drop array check':
        if (typeof dm === 'function'){
          try { const out = dm(null); if (!/not an array/.test(out)) caught = true; }
          catch (e) { caught = true; }
        }
        break;
      case 'drop empty check':
        if (typeof dm === 'function'){
          const out = dm([]);
          if (!/empty/.test(out)) caught = true;
        }
        break;
      case 'drop OHLC-finite check':
        if (typeof dm === 'function'){
          const bad = tape(30); bad[29].h = NaN;
          const out = dm(bad);
          if (!/missing open/.test(out)) caught = true;
        }
        break;
      case 'drop h>l check':
        if (typeof dm === 'function'){
          const f = tape(30); f[29] = { t: 0, o: 4100, h: 4100, l: 4100, c: 4100 };
          const out = dm(f);
          if (!/no range/.test(out)) caught = true;
        }
        break;
      case 'drop close-finite loop check':
        if (typeof dm === 'function'){
          const b = tape(30); b[10].c = NaN;
          const out = dm(b);
          if (!/non-finite close/.test(out)) caught = true;
        }
        break;
      case 'remove window export':
        if (typeof expM !== 'function') caught = true;
        break;
    }
  } catch (e) { caught = true; }
  if (caught) caughtMut++;
  else console.log('MUTATION SURVIVED: ' + m.name);
}
ok(caughtMut === mutations.length, '9.1 behavioural mutations: ' + caughtMut + '/' + mutations.length + ' caught');

/* §10 — module wire mutation pass. Reverting the module to its shrug line
   or deleting the diagnoser call must be caught by §5. */
const moduleMutations = [
  { name: 'revert to shrug (drop diagnoser call)',
    patch: s => s.replace(
      /var diagWhy = \(typeof window\.hgCfDiagnose === 'function'\)[\s\S]+?: 'The candle read failed closed\. Nothing was invented\.';/,
      "resultArea.innerHTML = 'The candle read failed closed. Nothing was invented.';") },
  { name: 'remove typeof guard',
    patch: s => s.replace("(typeof window.hgCfDiagnose === 'function')",
                          "(true)") },
  { name: 'drop try/catch around diagnoser call',
    patch: s => s.replace(
      /\(function\(\)\{ try \{ return window\.hgCfDiagnose\(candles\); \} catch \(eDg\) \{ return null; \} \}\)\(\)/,
      'window.hgCfDiagnose(candles)') }
];

let caughtModMut = 0;
for (const m of moduleMutations){
  const mutated = m.patch(moduleSrc);
  if (mutated === moduleSrc) { console.log('WARN module mutation did not change source: ' + m.name); continue; }
  const nb = (() => {
    const idx = mutated.indexOf('const forecast = window.goldCandleForecast(candles, macroLive, tapes)');
    return idx < 0 ? '' : mutated.slice(idx, idx + 2000);
  })();
  let survived = false;
  switch (m.name){
    case 'revert to shrug (drop diagnoser call)':
      survived = /hgCfDiagnose/.test(nb) && /typeof\s+window\.hgCfDiagnose/.test(nb);
      break;
    case 'remove typeof guard':
      survived = /typeof\s+window\.hgCfDiagnose\s*===\s*'function'/.test(nb);
      break;
    case 'drop try/catch around diagnoser call':
      survived = /try\s*\{\s*return\s+window\.hgCfDiagnose\(candles\)/.test(nb);
      break;
  }
  if (!survived) caughtModMut++;
  else console.log('MODULE MUTATION SURVIVED: ' + m.name);
}
ok(caughtModMut === moduleMutations.length, '10.1 module mutations: ' + caughtModMut + '/' + moduleMutations.length + ' caught');

if (fails) { console.log('FAILED ' + fails + ' / ' + total + ' assertions'); process.exit(1); }
console.log(total + ' assertions, 0 failed; ' + (caughtMut + caughtModMut) + '/' + (mutations.length + moduleMutations.length) + ' mutations caught');
