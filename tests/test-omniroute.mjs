/* HARDGATE — omniroute.js unit tests (Node 18+, builtins only).
   Loads omniroute.js in a vm context with window stub and asserts:
     A) pure detectors + backtest harness (no throw on edge rows)
     B) UTAD hits read SPRING pooled stats (same detector family)
     C) hgOmniRank ordering (tickets first, then R:R)
     D) HG_tabs registration + mount smoke (graceful missing xuniverse note)
   Run: node tests/test-omniroute.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(root, 'omniroute.js'), 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function makeCtx(extra){
  return vm.createContext(Object.assign(Object.create(null), {
    window: {},
    console,
    setTimeout,
    clearTimeout
  }, extra || {}));
}
function load(ctx){
  vm.runInContext(SRC, ctx, { filename: 'omniroute.js' });
  return ctx.window;
}

function mkRows(n, seed){
  const rows = [];
  let p = seed || 100;
  for (let i = 0; i < n; i++){
    const o = p, c = p + (Math.sin(i / 7) * 0.8), h = Math.max(o, c) + 1.2, l = Math.min(o, c) - 1.2;
    rows.push({ t: 1700000000 + i * 14400, o, h, l, c, v: 800 + (i % 5) * 120 });
    p = c;
  }
  return rows;
}

/* A) pure detectors */
console.log('== pure detectors ==');
const W = load(makeCtx());
const rows = mkRows(180);
assert(typeof W.hgOmniDetect === 'function', 'hgOmniDetect exported');
let threw = false;
try { W.hgOmniDetect([{ t: NaN, o: 0, h: 0, l: 0, c: 0, v: 0 }]); }
catch (e){ threw = true; }
assert(!threw, 'hgOmniDetect tolerates junk row');

const stats = W.hgOmniBacktestAll(rows, { rMult: 2, horizon: 20, warm: 45 });
assert(stats && typeof stats === 'object' && stats.SPRING, 'hgOmniBacktestAll returns per-detector stats');
const pool = W.hgOmniPoolStats([stats]);
assert(pool && typeof pool.SPRING === 'object', 'hgOmniPoolStats pools SPRING');

/* B) UTAD uses SPRING stats */
console.log('== UTAD stats mapping ==');
const utadHit = { kind: 'UTAD', dir: 'short', level: 1, why: 'test' };
const gatesFn = W.hgOmniGates;
assert(typeof gatesFn === 'function', 'hgOmniGates exported');
const exUtad = { stats: pool.SPRING };
const gUtad = gatesFn(rows, utadHit, null, exUtad);
const edge = gUtad.find(function(g){ return g.key === 'measured-edge'; });
assert(edge && edge.why.indexOf('samples') >= 0, 'UTAD reads SPRING pooled stats in measured-edge gate');

const item = { sym: 'BTCUSD', base: 'BTC', exchange: 'delta' };
const exPool = { stats: pool };
const cands = W.hgOmniEvaluate(item, rows, null, exPool);
assert(Array.isArray(cands), 'hgOmniEvaluate returns array');

/* C) rank ordering */
console.log('== rank ==');
const ranked = W.hgOmniRank([
  { grade: { ticket: false }, rr: 3, base: 'B' },
  { grade: { ticket: true }, rr: 2, base: 'A' },
  { grade: { ticket: true }, rr: 4, base: 'C' }
]);
assert(ranked[0].grade.ticket === true && ranked[0].rr === 4, 'tickets first, then higher R:R');

/* D) mount smoke */
console.log('== mount ==');
const ctx2 = makeCtx({ document: {
  createElement: function(){ return { style: {}, appendChild: function(){} }; }
}});
const W2 = load(ctx2);
const tab = (W2.HG_tabs || []).find(function(t){ return t.id === 'omniroute'; });
assert(tab && typeof tab.mount === 'function', 'HG_tabs omniroute registered');
const el = {
  innerHTML: '',
  querySelector: function(sel){
    const map = {
      '#omniRun': { disabled: false, addEventListener: function(){} },
      '#omniStat': { textContent: '' },
      '#omniWarn': { textContent: '', style: { display: 'none' } },
      '#omniSide': { innerHTML: '' },
      '#omniCards': { innerHTML: '' },
      '#omniPool': { innerHTML: '' },
      '#omniMatrix': { innerHTML: '' },
      '#omniEp': { value: '' },
      '#omniTok': { value: '' },
      '#omniModel': { value: '' },
      '#omniPing': { addEventListener: function(){} },
      '#omniPingStat': { textContent: '' },
      '#omniKind': { value: 'paste' },
      '#omniSrc': { value: '' },
      '#omniIngest': { disabled: false, addEventListener: function(){} },
      '#omniIStat': { textContent: '' },
      '#omniIOut': { innerHTML: '' }
    };
    return map[sel] || null;
  }
};
let mountThrew = false;
try { tab.mount(el); } catch (e){ mountThrew = true; console.error(e); }
assert(!mountThrew, 'mountOmniroute does not throw without xuniverse');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
