/* HARDGATE — BRAIN warm-up tests (Node 18+, builtins only).
   Covers the WARM UP LAYERS feature + the non-crypto universe gate:
     A) brainUniverse blocks non-crypto bases (metals/energy/indices/FX/agri)
        while real crypto bases survive
     B) mount renders + wires #brainWarm
     C) warm-up runs hooks in order (engine last), captures a throwing hook as
        'error:', writes the deps note, auto-fires the synthesis, re-enables
        buttons
     D) zero hooks -> honest warn, no work
     E) busy guard: a second click mid-warm is a no-op
     F) every real layer module registers an HG_warmups hook whose run()
        resolves a string in a bare environment (honest degradation, never
        throws)
   No live network anywhere. Run: node tests/test-warmup.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
const sleep = function(ms){ return new Promise(function(res){ setTimeout(res, ms); }); };

/* ================= A) non-crypto universe gate ================= */
console.log('== A) BASE_BLOCK universe gate ==');
{
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
  const W = globalThis.window;
  assert(typeof W.brainUniverse === 'function', 'brainUniverse exposed');

  const mk = function(base, ex){
    return { sym: base + 'USDT', base: base, exchange: ex || 'delta', turnoverUsd: 1e8, mark: 1, fundingPct: null, alsoOn: null };
  };
  const blocked = ['XAG','CL','SPX','BANK','XAUT','SLVON','NATGAS','NIFTY','EURUSD','BZ','WTI','DXY','VIX','CORN','WHEAT','BANKNIFTY','UK100','JP225'];
  const kept    = ['BTC','ETH','DOGE'];
  const uni = W.brainUniverse(blocked.map(function(b){ return mk(b); }).concat(kept.map(function(b){ return mk(b, 'coindcx'); })));
  const bases = uni.candidates.map(function(c){ return c.base; });
  for (const b of blocked)
    assert(bases.indexOf(b) < 0, 'non-crypto base gated out of the BRAIN universe: ' + b);
  for (const b of kept)
    assert(bases.indexOf(b) >= 0, 'crypto base survives the gate: ' + b);
  /* deliberately NOT blocked: legit crypto tickers that look like commodities.
     brainUniverse always forces BTC/ETH/SOL candidates in (BASES contract),
     so 10 inputs -> 13 candidates. */
  const keepBases = ['GAS','GRAM','G','S','M','T','W','H','B','O'];
  const uni2 = W.brainUniverse(keepBases.map(function(b){ return mk(b); }));
  const bases2 = uni2.candidates.map(function(c){ return c.base; });
  for (const b of keepBases)
    assert(bases2.indexOf(b) >= 0, 'crypto ticker NOT blocked: ' + b);
  assert(uni2.candidates.length === 13, '10 alts + forced BTC/ETH/SOL majors = 13 — got ' + uni2.candidates.length);
}

/* shared harness for the mount/wiring tests */
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false, value: '',
           style: {}, firstElementChild: { style: {} }, _handlers: {},
           addEventListener: function(ev, fn){ this._handler = fn; this._handlers[ev] = fn; } };
}
function freshPane(){
  const stubs = {};
  const pane = {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector: function(sel){ if (!stubs[sel]) stubs[sel] = stubEl(); return stubs[sel]; }
  };
  return { pane: pane, stubs: stubs };
}
function freshBrain(){
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
  const W = globalThis.window;
  W.xuUniverse = async function(){ return []; };   /* empty combined universe -> instant synthesis */
  return W;
}
async function waitFor(cond, ms){
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < (ms || 8000)) await sleep(20);
  return cond();
}

/* ================= B) mount renders + wires WARM UP LAYERS ================= */
console.log('== B) mount renders + wires #brainWarm ==');
{
  const W = freshBrain();
  const tab = W.HG_tabs.find(function(t){ return t.id === 'brain'; });
  const M = freshPane();
  tab.mount(M.pane);
  assert(M.pane._html.indexOf('id="brainWarm"') >= 0 && M.pane._html.indexOf('WARM UP LAYERS') >= 0,
         'WARM UP LAYERS button rendered');
  assert(typeof M.stubs['#brainWarm']._handler === 'function', 'WARM UP button wired to a click handler');
}

/* ================= C) warm-up: order, error capture, deps note, auto-synthesis ================= */
console.log('== C) warm-up orchestration ==');
{
  const W = freshBrain();
  const tab = W.HG_tabs.find(function(t){ return t.id === 'brain'; });
  const ran = [];
  /* deliberately shuffled: engine first in the array — must still run LAST */
  W.HG_warmups = [
    { id: 'engine', label: 'GATES', run: async function(){ ran.push('engine'); await sleep(5); return 'warmed'; } },
    { id: 'news', label: 'NEWS', run: async function(){ ran.push('news'); return 'warmed'; } },
    { id: 'boom', label: 'BOOM', run: async function(){ ran.push('boom'); throw new Error('kaboom'); } },
    { id: 'regime', label: 'REGIME', run: async function(){ ran.push('regime'); return 'fresh'; } },
    { id: 'junk' },                                   /* no run fn — filtered out */
    { run: 'not-a-function' }                         /* no id — filtered out */
  ];
  const M = freshPane();
  tab.mount(M.pane);
  M.stubs['#brainWarm']._handler();
  const finished = await waitFor(function(){
    return M.stubs['#brainWarm'].disabled === false && M.stubs['#brainStat'].textContent.indexOf('done ·') === 0;
  });
  assert(finished, 'warm-up completes: buttons re-enabled + stat shows the auto-fired synthesis — got "'
         + M.stubs['#brainStat'].textContent + '"');
  assert(ran.length === 4 && ran[3] === 'engine', 'every hook ran, engine last — got ' + ran.join(','));
  const deps = M.stubs['#brainDeps'].textContent;
  assert(deps.indexOf('warm-up ·') >= 0, 'deps note carries the warm-up ledger — got "' + deps + '"');
  assert(deps.indexOf('BOOM: error: kaboom') >= 0, 'throwing hook captured as error, never kills the run — got "' + deps + '"');
  assert(deps.indexOf('NEWS: warmed') >= 0 && deps.indexOf('REGIME: fresh') >= 0 && deps.indexOf('GATES: warmed') >= 0,
         'per-layer results named verbatim in the ledger');
  assert(M.stubs['#brainRun'].disabled === false && M.stubs['#brainQuick'].disabled === false,
         'RUN + QUICK RESCAN re-enabled after warm-up');
}

/* ================= D) zero hooks -> honest warn, no work ================= */
console.log('== D) no warmable layers ==');
{
  const W = freshBrain();
  const tab = W.HG_tabs.find(function(t){ return t.id === 'brain'; });
  W.HG_warmups = [];
  const M = freshPane();
  tab.mount(M.pane);
  M.stubs['#brainWarm']._handler();
  await waitFor(function(){ return M.stubs['#brainStat'].textContent.length > 0; });
  assert(M.stubs['#brainStat'].className === 'note warn'
         && M.stubs['#brainStat'].textContent.indexOf('no warmable layers found') >= 0,
         'zero hooks -> named, honest warn — got "' + M.stubs['#brainStat'].textContent + '"');
  assert(M.stubs['#brainStat'].textContent.indexOf('done ·') !== 0, 'synthesis NOT auto-fired when nothing was warmed');
}

/* ================= E) busy guard: second click mid-warm is a no-op ================= */
console.log('== E) busy guard ==');
{
  const W = freshBrain();
  const tab = W.HG_tabs.find(function(t){ return t.id === 'brain'; });
  let calls = 0;
  W.HG_warmups = [
    { id: 'slow', label: 'SLOW', run: async function(){ calls++; await sleep(120); return 'warmed'; } }
  ];
  const M = freshPane();
  tab.mount(M.pane);
  M.stubs['#brainWarm']._handler();
  await sleep(30);                       /* mid-warm */
  M.stubs['#brainWarm']._handler();      /* must be ignored */
  await waitFor(function(){ return M.stubs['#brainWarm'].disabled === false
                                && M.stubs['#brainStat'].textContent.indexOf('done ·') === 0; });
  assert(calls === 1, 'overlapping click swallowed — hook ran exactly once (got ' + calls + ')');
}

/* ================= F) real modules: hook registered + never throws ================= */
console.log('== F) real layer modules publish honest warm hooks ==');
{
  const mods = [
    ['regime.js', 'regime', 'REGIME'],
    ['rotation.js', 'rotation', 'ROTATION'],
    ['oiflow.js', 'oiflow', 'OI FLOW'],
    ['engine.js', 'engine', 'GATES'],
    ['onchain.js', 'onchain', 'ON-CHAIN'],
    ['news.js', 'news', 'NEWS'],
    ['liqs.js', 'liqs', 'LIQS'],
    ['squeeze.js', 'squeeze', 'SQUEEZE']
  ];
  for (const [file, id, label] of mods){
    globalThis.window = {};
    try{
      vm.runInThisContext(fs.readFileSync(root + file, 'utf8'), { filename: file });
    }catch(e){
      assert(false, file + ' loads in a bare environment — threw: ' + e.message);
      continue;
    }
    const W = globalThis.window;
    const hooks = Array.isArray(W.HG_warmups) ? W.HG_warmups : [];
    const h = hooks.find(function(x){ return x && x.id === id; });
    assert(!!h && h.label === label && typeof h.run === 'function',
           file + ' registers {id:' + id + ', label:' + label + ', run}');
    if (h){
      let out = null, threw = null;
      try{ out = await Promise.race([h.run(), sleep(15000).then(function(){ return '__timeout__'; })]); }
      catch(e){ threw = e; }
      assert(threw === null, file + ' warm hook never throws (got ' + (threw && threw.message) + ')');
      assert(typeof out === 'string' && out.length > 0 && out !== '__timeout__',
             file + ' warm hook resolves a status string — got "' + out + '"');
    }
  }
}

/* ================= G) hgBrainAutoWarm boot hook ================= */
console.log('== G) hgBrainAutoWarm ==');
{
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'brain.js', 'utf8'), { filename: 'brain.js' });
  const W = globalThis.window;
  assert(typeof W.hgBrainAutoWarm === 'function', 'hgBrainAutoWarm exported on window');
  W.HG_warmups = [{ id: 'news', label: 'NEWS', run: async function(){ return 'warmed'; } }];
  W.hgNewsRefresh = async function(){ return { loaded: true }; };
  let out = null;
  try{ out = await W.hgBrainAutoWarm(); }catch(e){ out = 'threw:' + e.message; }
  assert(typeof out === 'string' && out.indexOf('threw:') !== 0, 'hgBrainAutoWarm resolves without throwing — got ' + out);
}

console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
