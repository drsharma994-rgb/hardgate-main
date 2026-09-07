/* HARDGATE — OMNIROUTE 20X section population (hg-v627).
   Run: node tests/test-omniroute-20x.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(root, 'omniroute.js'), 'utf8');
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function load(){
  const ctx = vm.createContext({ window: {}, console, setTimeout, clearTimeout });
  vm.runInContext(SRC, ctx, { filename: 'omniroute.js' });
  return ctx.window;
}

console.log('== exports ==');
const W = load();
ok(typeof W.hgOmni20xQualify === 'function', 'hgOmni20xQualify exported');
ok(typeof W.hgOmni20xSectionHtml === 'function', 'hgOmni20xSectionHtml exported');
ok(typeof W.hgOmni20xGateRun === 'function', 'hgOmni20xGateRun exported');

console.log('\n== ledger-ticket quality path populates tight tickets ==');
{
  const tight = {
    base: 'TIGHT', sym: 'TIGHTUSD', exchange: 'delta', kind: 'ORB', dir: 'long',
    grade: { ticket: true, evaluated: 18, total: 28 },
    plan: { entry: 100, stop: 98.2, t1: 103.6 },
    atr1hPct: 0.35,
    solidity: { score: 42, maxScore: 200, tier: 'weak' }
  };
  const q = W.hgOmni20xQualify(tight);
  ok(q && q.planUsed === 'primary', 'tight primary plan qualifies (' + (q && q.quality) + ')');
  ok(q && q.quality === 'ledger-ticket', 'quality path is ledger-ticket');
  const html = W.hgOmni20xSectionHtml([tight]);
  ok(/20X GEOMETRY OK/.test(html), 'section renders a qualifying card');
  ok(/ledger-ticket/.test(html), 'card names ledger-ticket quality path');
}

console.log('\n== x20 re-plan when swing stop is too wide ==');
{
  const wide = {
    base: 'WIDE', sym: 'WIDEUSD', exchange: 'delta', kind: 'SWEEP', dir: 'long',
    grade: { ticket: true, evaluated: 20, total: 30 },
    plan: { entry: 100, stop: 88, t1: 124 },
    atr1hPct: 0.4,
    x20plan: { entry: 100, stop: 98.3, t1: 103.4, stopDistPct: 1.7, src: '1h-swing', srcIdx: 0 },
    solidity: { score: 38, maxScore: 200, tier: 'weak' }
  };
  const q = W.hgOmni20xQualify(wide);
  ok(q && q.planUsed === 'x20', 'wide swing stop uses x20 re-plan');
  ok(q && q.quality === 'ledger-ticket', 're-plan still clears ledger-ticket quality');
  const html = W.hgOmni20xSectionHtml([wide]);
  ok(/20X RE-PLAN OK/.test(html), 'section labels re-plan card');
}

console.log('\n== near-miss block when shortlist is thin ==');
{
  const miss = {
    base: 'NOISY', sym: 'NOISYUSD', exchange: 'delta', kind: 'ORB', dir: 'long',
    grade: { ticket: true, evaluated: 16, total: 28 },
    plan: { entry: 100, stop: 98.2, t1: 103.6 },
    atr1hPct: 2.5
  };
  const html = W.hgOmni20xSectionHtml([miss]);
  ok(/NEAREST MISSES/.test(html), 'noise fail surfaces near-miss transparency');
  ok(/failed: noise/.test(html), 'names the noise gate');
}

console.log('\n== constants + stamp ==');
{
  ok(/ledger-ticket/.test(SRC), 'source documents ledger-ticket quality path');
  ok(/HG_OMNI_20X_SOLIDITY_FLOOR = 40/.test(SRC), 'solidity floor lowered to reachable 40');
  ok(/CARD_RENDER_MAX = 55/.test(SRC), 'card render cap raised to 55');
  const stamp = fs.readFileSync(path.join(root, 'build-stamp.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(stamp.includes("version: '" + HG_VER + "'"), 'build stamp ' + HG_VER);
  ok(swCacheOk(sw), 'sw cache matches build stamp');
}

console.log('\n' + pass + ' passed, 0 failed');
console.log('ALL OMNIROUTE 20X TESTS PASSED');
