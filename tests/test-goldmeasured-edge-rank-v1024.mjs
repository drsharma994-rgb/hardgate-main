/* HARDGATE — hg-v1024: MEASURED-EDGE veto in the gold ranker.

   goldRankSetups now asks hgSolGateMeasuredEdge (tab, kind) for each ranked
   row, keyed on ctx.scanner (the desk's own forward-tab). A mechanic the
   forward ledger has measured at negative expectancy (n≥20, expR<−0.25) is
   DEMOTED — it can never crown MOST PROBABLE — with a named reason, and the
   row keeps a `perfect`/evidence read regardless (evidence stays honest,
   only the measured verdict moves the rank). A missing tab or helper stands
   aside (fail-open): it never invents a veto.

   Covers:
     1) a measured-losing mechanic is demoted + edgeVetoed, and cannot lead
     2) a measured-clean mechanic is untouched and keeps its rank
     3) a missing scanner / helper stands aside (no veto)
   Run: node tests/test-goldmeasured-edge-rank-v1024.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

const BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
              'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
              'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'hg-setup-core.js'];

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} };
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
  for (const f of BASE){ try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); } catch(e){ console.error('boot ' + f + ': ' + e.message); } }
  return ctx;
}

const W = boot();
assert(typeof W.goldRankSetups === 'function', 'goldRankSetups exported');

const cand = () => ({ sym: 'XAUUSD', dir: 'long', stratKey: 'TREND', strategy: 'trend-pullback',
  entry: 2300, stop: 2290, t1: 2320, agree: 5, killzoneWeight: 0 });
const ctxOf = () => ({ scanner: 'GOLDSCALP', now: Date.now(), news: { caution: false }, rows15m: [], rows4h: [], rows1h: [] });

console.log('== the measured-edge veto ==');
W.hgSolGateMeasuredEdge = () => ({ pass: false, source: 'measured', expR: -0.30, samples: 25 });
let r = W.goldRankSetups([cand()], ctxOf());
assert(Array.isArray(r.ranked) && r.ranked.length === 1, 'one ranked row');
assert(r.ranked[0].demoted === true, 'a measured-losing mechanic is demoted');
assert(r.ranked[0].edgeVetoed === true, 'the veto is tagged (edgeVetoed)');
assert(Array.isArray(r.ranked[0].stamps) && /measured-edge veto/.test(r.ranked[0].stamps.join(' ')), 'the reason is named on the row');
assert(r.best === null, 'a measured-losing mechanic can never lead (best null)');

console.log('== a measured-clean mechanic is untouched ==');
W.hgSolGateMeasuredEdge = () => ({ pass: true, source: 'measured', expR: 0.20, samples: 25 });
r = W.goldRankSetups([cand()], ctxOf());
assert(r.ranked[0].demoted !== true, 'measured-clean mechanic is not demoted');
assert(r.ranked[0].edgeProven === true, 'measured-clean mechanic tags edgeProven');
assert(r.best !== null && r.best.stratKey === 'TREND', 'measured-clean mechanic still leads');

console.log('== fail-open: missing scanner / helper ==');
W.hgSolGateMeasuredEdge = () => ({ pass: false, source: 'measured', expR: -0.30, samples: 25 });
r = W.goldRankSetups([cand()], Object.assign(ctxOf(), { scanner: undefined }));
assert(r.ranked[0].demoted !== true, 'no scanner → the veto stands aside (fail-open)');
assert(r.best !== null, 'fail-open does not fabricate a demotion');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
