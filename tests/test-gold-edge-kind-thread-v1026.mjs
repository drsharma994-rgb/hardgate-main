/* HARDGATE — hg-v1026: the measured-edge veto threads to the borrowed-cand desks.

   v1024 threaded hgSolGateMeasuredEdge into the CORE desks (SCALP/SWING/ULTRA),
   whose forward records key `mechanic = stratKey`. The AGGREGATOR desks that
   re-rank BORROWED scalp cands (GOLD PINE, GOLD DIRECTION) ranked by confluence
   alone, so a measured-losing scalp mechanic could still crown their view.

   Two contracts hold here:
     1) goldRankSetups honours ctx.edgeKindOf — a desk may name its OWN
        mechanic key; when absent it falls back to stratKey (v1024 default),
        so the change is strictly backward-compatible.
     2) GOLD PINE and GOLD DIRECTION thread ctx.scanner='GOLDSCALP' on the
        re-rank of borrowed goldScalpSetups cands — the SOURCE desk's ledger,
        keyed by stratKey — so the same veto the source applies holds here.

   Run: node tests/test-gold-edge-kind-thread-v1026.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const assert = (c, m) => { if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } };

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

console.log('== ctx.edgeKindOf is honoured ==');
{
  let seen = null;
  W.hgSolGateMeasuredEdge = (plan, opts) => { seen = opts && opts.kind; return { pass: true, source: 'measured', expR: 0.2, samples: 25 }; };
  W.goldRankSetups([cand()], Object.assign(ctxOf(), { edgeKindOf: c => (c.stratKey || '') + '-SPECIAL' }));
  assert(seen === 'TREND-SPECIAL', 'edgeKindOf names the desk\'s own key (got ' + seen + ')');
}

console.log('== the default stays stratKey (backward-compatible) ==');
{
  let seen = null;
  W.hgSolGateMeasuredEdge = (plan, opts) => { seen = opts && opts.kind; return { pass: true, source: 'measured', expR: 0.2, samples: 25 }; };
  W.goldRankSetups([cand()], ctxOf());
  assert(seen === 'TREND', 'no hook → stratKey default (got ' + seen + ')');
}

console.log('== the hook throwing stands aside (fail-open) ==');
{
  W.hgSolGateMeasuredEdge = () => { throw new Error('boom'); };
  const r = W.goldRankSetups([cand()], Object.assign(ctxOf(), { edgeKindOf: () => { throw new Error('no key'); } }));
  assert(Array.isArray(r.ranked) && r.ranked[0].demoted !== true, 'a throwing hook does not fabricate a demotion');
}

console.log('== the borrowed-cand desks thread the SOURCE tab ==');
{
  const pine = fs.readFileSync(path.join(ROOT, 'goldpine.js'), 'utf8');
  const dir = fs.readFileSync(path.join(ROOT, 'golddirection.js'), 'utf8');
  const ind = fs.readFileSync(path.join(ROOT, 'goldind.js'), 'utf8');
  assert(/scanner:\s*'GOLDSCALP'/.test(pine), 'GOLD PINE threads scanner GOLDSCALP on its scalp re-rank');
  assert(/scanner:\s*'GOLDSCALP'/.test(dir), 'GOLD DIRECTION threads scanner GOLDSCALP on its scalp re-rank');
  assert(/edgeKindOf/.test(ind), 'goldRankSetups reads ctx.edgeKindOf (the desk\'s own key)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
