/* HARDGATE — signallog.js unit tests (Node 18+, builtins only, zero network).
   Loads signallog.js as a classic script via vm.runInThisContext with
   globalThis.window = {} (mirrors the browser's script globals), exactly the
   tests/test-goldscalp.mjs harness style. window / localStorage / setInterval
   are stubbed per scenario; no fetch, no timers left running.

   Covers: HG_tabs registration; snapshot with all three sources stubbed
   (brain rows with plan/evidence, scalp + swing cands); source absent, source
   throwing, source returning null (no crash, honest 'sources live / waiting'
   header); de-dup within a round; entry shape fields + tierOrGrade mapping;
   persistence + reload; newest-first ordering; 500-entry hard cap; corrupt /
   non-array / junk-row JSON recovery with the 'journal reset (corrupt)' UI
   note; CLEAR JOURNAL behavior; signallogEntries deep-frozen + fresh copy per
   call; interval started once at 300000ms and driving snapshots; refresh()
   performing a snapshot; throwing localStorage; bare-env never-throws sweep.

   Run: node tests/test-signallog.mjs */

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

/* ---------------- stubbing helpers (test-goldscalp.mjs patterns) ---------------- */
const REAL_SET_INTERVAL = globalThis.setInterval;
function memLocalStorage(){
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; },
           _map: m };
}
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

/* load signallog.js into a fresh bare context; returns the stubs for driving */
function loadSignallog(opts){
  opts = opts || {};
  globalThis.window = {};
  globalThis.localStorage = opts.ls || memLocalStorage();
  const intervals = [];
  globalThis.setInterval = (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; };
  vm.runInThisContext(fs.readFileSync(root + 'signallog.js', 'utf8'), { filename: 'signallog.js' });
  return { W: globalThis.window, ls: globalThis.localStorage, intervals };
}
function tabOf(W){ return W.HG_tabs.find(t => t.id === 'signallog'); }

/* pinned fixtures */
function brainRows(){
  return [
    { sym: 'BTCUSDT', dir: 'long', tier: 'PRIME', agree: 4,
      plan: { entry: 60000, stop: 59000, t1: 62000 }, evidence: ['4h trend + funding + OI all agree long'] },
    { sym: 'ETHUSDT', dir: 'SHORT', tier: 'HIGH', agree: 3, entry: 3000, stop: 3100, t1: 2800 },  // flat plan fields, dir normalized
    { sym: 'BTCUSDT', dir: 'long', tier: 'WATCH', agree: 2 },                                     // dup same round -> skipped
    { sym: 'NO DIR COIN', dir: null, tier: 'ASIDE', agree: 0 },                                   // no direction -> skipped
    { dir: 'long', tier: 'WATCH', agree: 1 }                                                      // no sym -> skipped
  ];
}
function scalpSnap(){
  return { cands: [
    { sym: 'XAUUSDT', dir: 'long', grade: 'A', strategy: 'LIQUIDITY SWEEP REVERSAL', entry: 2350.5, stop: 2342.1, t1: 2367.3 },
    { sym: 'PAXGUSDT', dir: 'short', grade: 'B', strategy: 'FVG FILL', entry: 2355, stop: 2361, t1: 2343 }
  ], bestId: null, history: [], rejected: [], at: 123 };
}
function swingSnap(){
  return { cands: [
    { sym: 'XAUUSDT', dir: 'short', grade: 'A', strategy: '4H ORDER BLOCK RETEST', entry: 2360, stop: 2372, t1: 2336 }
  ] };
}

/* =========================================================================
   1) registration + bare-env contracts (no sources, no localStorage writes)
========================================================================= */
console.log('== 1) registration + bare-env contracts ==');
{
  const env = loadSignallog();
  const W = env.W;
  const tab = tabOf(W);
  assert(!!tab && tab.label === 'SIGNAL LOG' && typeof tab.mount === 'function' && typeof tab.refresh === 'function',
         'HG_tabs entry: id=signallog, label=SIGNAL LOG, mount + refresh');
  assert(typeof W.signallogSnapshot === 'function' && typeof W.signallogEntries === 'function',
         'diagnostic surface exposed: signallogSnapshot + signallogEntries');

  let threw = false;
  try { tab.mount(null); } catch(e){ threw = true; }
  assert(!threw, 'mount(null) does not throw');

  const n0 = W.signallogSnapshot();
  assert(n0 === 0, 'no sources available -> snapshot adds 0, never throws (got ' + n0 + ')');
  const es0 = W.signallogEntries();
  assert(Array.isArray(es0) && es0.length === 0, 'empty journal -> empty frozen array');

  const M = freshPane();
  tab.mount(M.pane);
  assert(M.pane._html.indexOf('SIGNAL LOG') >= 0 && M.pane._html.indexOf('id="slClear"') >= 0,
         'mount renders the panel + CLEAR JOURNAL button');
  assert(M.pane._html.indexOf('logs while the app is open · every 5 min + on refresh') >= 0,
         'header states honestly: logs while the app is open · every 5 min + on refresh');
  assert(M.pane._html.indexOf('no signals logged yet') >= 0, 'honest empty state rendered (nothing fabricated)');
  assert(M.stubs['#slSources'].textContent === 'sources live: none · waiting: brain, scalp, swing, supergold',
         'all sources absent -> honest header: "' + M.stubs['#slSources'].textContent + '"');
  assert(M.stubs['#slEmpty'].style.display === 'block', 'empty state visible with zero entries');
  assert(typeof M.stubs['#slClear']._handler === 'function', 'CLEAR JOURNAL wired to a click handler');

  assert(env.intervals.length === 1 && env.intervals[0].ms === 300000,
         'interval started once at 300000ms (5 min), guarded against double-start across load + mount');

  const r = await tab.refresh();
  assert(r === 'refreshed', 'refresh resolves "refreshed" in a bare env (got "' + r + '")');
}

/* =========================================================================
   2) snapshot with ALL THREE sources stubbed — shape, mapping, de-dup, UI
========================================================================= */
console.log('== 2) all three sources stubbed ==');
{
  const env = loadSignallog();
  const W = env.W;
  W.__hgBrainLast = () => brainRows();
  W.goldscalpScan = () => scalpSnap();
  W.goldswingScan = () => swingSnap();

  const n = W.signallogSnapshot();
  assert(n === 5, 'all sources: 2 brain (de-duped) + 2 scalp + 1 swing = 5 added (got ' + n + ')');

  const es = W.signallogEntries();
  assert(es.length === 5, 'journal holds 5 entries');
  const keys = Object.keys(es[0]).sort();
  assert(JSON.stringify(keys) === JSON.stringify(['dir','entry','note','source','stop','sym','t','t1','tierOrGrade']),
         'entry shape exact: t, source, sym, dir, tierOrGrade, entry, stop, t1, note');
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(es[0].t), 't is an ISO string ("' + es[0].t + '")');
  assert(es.every(e => e.t === es[0].t), 'one timestamp shared across the whole snapshot round');

  const btc = es.find(e => e.sym === 'BTCUSDT');
  assert(btc && btc.source === 'brain' && btc.dir === 'long' && btc.tierOrGrade === 'PRIME'
      && btc.entry === 60000 && btc.stop === 59000 && btc.t1 === 62000,
         'brain row: sym/dir/tier + plan entry/stop/t1 mapped, tierOrGrade = tier');
  assert(btc.note === '4h trend + funding + OI all agree long', 'brain note = first evidence string');
  const eth = es.find(e => e.sym === 'ETHUSDT');
  assert(eth && eth.dir === 'short' && eth.tierOrGrade === 'HIGH' && eth.entry === 3000 && eth.t1 === 2800,
         'brain row: flat entry/stop/t1 fields read, dir "SHORT" normalized to "short"');
  assert(eth.note === '3 layers agree', 'brain note falls back to the evidence count ("' + eth.note + '")');
  const xau = es.find(e => e.source === 'scalp' && e.sym === 'XAUUSDT');
  assert(xau && xau.dir === 'long' && xau.tierOrGrade === 'A' && xau.entry === 2350.5 && xau.stop === 2342.1 && xau.t1 === 2367.3
      && xau.note === 'LIQUIDITY SWEEP REVERSAL',
         'scalp row: tierOrGrade = grade, note = strategy, entry/stop/t1 mapped');
  const sw = es.find(e => e.source === 'swing');
  assert(sw && sw.sym === 'XAUUSDT' && sw.dir === 'short' && sw.tierOrGrade === 'A' && sw.note === '4H ORDER BLOCK RETEST',
         'swing row: source=swing, tierOrGrade = grade, note = strategy');
  assert(es.filter(e => e.source === 'brain' && e.sym === 'BTCUSDT' && e.dir === 'long').length === 1,
         'de-dup within a round: same source+sym+dir logs once');

  /* UI render from the snapshot */
  const M = freshPane();
  tabOf(W).mount(M.pane);
  const html = M.stubs['#slBody'].innerHTML;
  assert(html.indexOf('BTCUSDT') >= 0 && html.indexOf('PRIME') >= 0 && html.indexOf('LIQUIDITY SWEEP REVERSAL') >= 0,
         'ledger table renders sym, tier/grade + note');
  assert(html.indexOf('sl-badge brain') >= 0 && html.indexOf('sl-badge scalp') >= 0 && html.indexOf('sl-badge swing') >= 0,
         'source badges rendered per source');
  assert(html.indexOf('sl-dir long') >= 0 && html.indexOf('sl-dir short') >= 0
      && html.indexOf('>LONG</span>') >= 0 && html.indexOf('>SHORT</span>') >= 0,
         'direction colored LONG/SHORT');
  assert(html.indexOf('60,000') >= 0 && html.indexOf('2,350.5') >= 0, 'entry/stop/TP1 price columns formatted');
  assert(M.stubs['#slSources'].textContent === 'sources live: brain, scalp, swing · waiting: supergold',
         'header: all three live, no waiting line ("' + M.stubs['#slSources'].textContent + '")');
  assert(M.stubs['#slEmpty'].style.display === 'none', 'empty state hidden once entries exist');
  assert(M.stubs['#slCount'].textContent.indexOf('5 / 500') >= 0, 'entry count line rendered ("' + M.stubs['#slCount'].textContent + '")');

  /* refresh() performs one snapshot round */
  const r = await tabOf(W).refresh();
  assert(r === 'refreshed' && W.signallogEntries().length === 10,
         'refresh() snapshots again: 5 + 5 = 10 entries, status "refreshed"');
}

/* =========================================================================
   3) source absent / throwing / returning null — no crash, honest header
========================================================================= */
console.log('== 3) source absent + throwing + null ==');
{
  const env = loadSignallog();
  const W = env.W;
  /* __hgBrainLast absent entirely; scalp throws; swing is live */
  W.goldscalpScan = () => { throw new Error('boom'); };
  W.goldswingScan = () => swingSnap();

  let n, threw = false;
  try { n = W.signallogSnapshot(); } catch(e){ threw = true; }
  assert(!threw, 'a throwing source never crashes the snapshot');
  assert(n === 1, 'throwing + absent sources record nothing; the live one still logs (got ' + n + ')');
  const es = W.signallogEntries();
  assert(es.length === 1 && es[0].source === 'swing', 'only the live source made it into the journal');

  const M = freshPane();
  tabOf(W).mount(M.pane);
  assert(M.stubs['#slSources'].textContent === 'sources live: swing · waiting: brain, scalp, supergold',
         'honest header names live vs waiting ("' + M.stubs['#slSources'].textContent + '")');

  /* a source returning null is "waiting" too; a recovering source flips to live */
  W.goldscalpScan = () => null;
  W.__hgBrainLast = () => null;
  W.signallogSnapshot();
  assert(M.stubs['#slSources'].textContent === 'sources live: swing · waiting: brain, scalp, supergold',
         'null-returning sources count as waiting, nothing recorded for them');
  W.goldscalpScan = () => scalpSnap();
  const n2 = W.signallogSnapshot();
  assert(n2 === 3 && M.stubs['#slSources'].textContent === 'sources live: scalp, swing · waiting: brain, supergold',
         'recovered source flips to live on the next round (2 scalp + 1 swing, "' + M.stubs['#slSources'].textContent + '")');

  /* brain present but not a function -> feature-check says waiting, never throws */
  const env2 = loadSignallog();
  env2.W.__hgBrainLast = { rows: brainRows() };
  let n3, threw3 = false;
  try { n3 = env2.W.signallogSnapshot(); } catch(e){ threw3 = true; }
  assert(!threw3 && n3 === 0, 'non-function __hgBrainLast is skipped cleanly (typeof feature-check)');
}

/* =========================================================================
   4) persistence, reload, newest-first, 500-entry hard cap
========================================================================= */
console.log('== 4) persistence + cap ==');
{
  const ls = memLocalStorage();
  const env = loadSignallog({ ls });
  env.W.goldscalpScan = () => scalpSnap();
  env.W.signallogSnapshot();
  const raw = ls.getItem('hgSignalLog');
  assert(typeof raw === 'string' && JSON.parse(raw).length === 2, 'journal persisted to localStorage hgSignalLog');
  assert(JSON.parse(raw)[0].sym === 'XAUUSDT', 'stored newest first');

  /* reload the module against the same storage -> entries restored */
  const env2 = loadSignallog({ ls });
  const es2 = env2.W.signallogEntries();
  assert(es2.length === 2 && es2[0].sym === 'XAUUSDT' && es2[0].entry === 2350.5 && es2[1].sym === 'PAXGUSDT',
         'journal survives a reload (restored from localStorage)');

  /* newest-first ordering across rounds */
  env2.W.goldscalpScan = () => ({ cands: [{ sym: 'XAUTUSD', dir: 'short', grade: 'C', strategy: 'ASIAN RANGE BREAKOUT', entry: 99, stop: 101, t1: 95 }] });
  env2.W.signallogSnapshot();
  const es3 = env2.W.signallogEntries();
  assert(es3.length === 3 && es3[0].sym === 'XAUTUSD' && es3[2].sym === 'PAXGUSDT', 'newest round unshifted to the head');

  /* junk rows inside a valid stored array are dropped on load */
  const lsJ = memLocalStorage();
  lsJ.setItem('hgSignalLog', JSON.stringify([null, { foo: 1 }, { t: '2024-01-01T00:00:00Z', source: 'scalp', sym: 'XAUUSDT', dir: 'long', tierOrGrade: 'A', entry: 1, stop: 0, t1: 2, note: 'ok' }]));
  const envJ = loadSignallog({ ls: lsJ });
  const esJ = envJ.W.signallogEntries();
  assert(esJ.length === 1 && esJ[0].sym === 'XAUUSDT', 'junk rows in a valid stored array are dropped, valid rows kept');

  /* 500-entry hard cap: 498 seeded + 5 fresh -> 500, oldest dropped */
  const seed = [];
  for (let i = 0; i < 498; i++)
    seed.push({ t: '2024-01-01T00:00:00Z', source: 'brain', sym: 'OLD' + i, dir: 'long', tierOrGrade: 'WATCH', entry: 1, stop: 2, t1: 3, note: 'old' });
  const ls2 = memLocalStorage();
  ls2.setItem('hgSignalLog', JSON.stringify(seed));
  const env3 = loadSignallog({ ls: ls2 });
  env3.W.__hgBrainLast = () => ([
    { sym: 'N1', dir: 'long', tier: 'HIGH', agree: 3 },
    { sym: 'N2', dir: 'short', tier: 'HIGH', agree: 3 },
    { sym: 'N3', dir: 'long', tier: 'HIGH', agree: 3 }
  ]);
  env3.W.goldscalpScan = () => ({ cands: [
    { sym: 'N4', dir: 'long', grade: 'A', strategy: 'x', entry: 1, stop: 0, t1: 2 },
    { sym: 'N5', dir: 'short', grade: 'B', strategy: 'y', entry: 1, stop: 2, t1: 0 }
  ] });
  const added = env3.W.signallogSnapshot();
  const esC = env3.W.signallogEntries();
  assert(added === 5 && esC.length === 500, '500-entry hard cap enforced (498 + 5 -> ' + esC.length + ')');
  assert(esC[0].sym === 'N1' && esC[4].sym === 'N5', 'the 5 fresh entries sit at the head after capping');
  assert(esC[499].sym === 'OLD494', 'the oldest entries dropped off the tail (last kept: ' + esC[499].sym + ')');
  assert(JSON.parse(ls2.getItem('hgSignalLog')).length === 500, 'the cap is persisted to storage, not just in memory');
}

/* =========================================================================
   5) corrupt / non-array stored JSON recovery
========================================================================= */
console.log('== 5) corrupt-JSON recovery ==');
{
  const ls = memLocalStorage();
  ls.setItem('hgSignalLog', '{{{not json');
  let env = null, threw = false;
  try { env = loadSignallog({ ls }); } catch(e){ threw = true; }
  assert(!threw, 'corrupt stored JSON never crashes module load');
  assert(env.W.signallogEntries().length === 0, 'corrupt JSON -> journal starts fresh (empty)');

  const M = freshPane();
  tabOf(env.W).mount(M.pane);
  assert(M.pane._html.indexOf('journal reset (corrupt)') >= 0, 'corrupt note present in the header markup');
  assert(M.stubs['#slCorrupt'].style.display === 'block', "'journal reset (corrupt)' surfaced once in the UI");

  /* recovery: the journal keeps working after the reset */
  env.W.goldscalpScan = () => scalpSnap();
  assert(env.W.signallogSnapshot() === 2 && env.W.signallogEntries().length === 2,
         'snapshotting works normally after a corrupt reset');

  /* non-array JSON is also treated as corrupt */
  const ls2 = memLocalStorage();
  ls2.setItem('hgSignalLog', '{"a":1}');
  let envB = null, threwB = false;
  try { envB = loadSignallog({ ls: ls2 }); } catch(e){ threwB = true; }
  assert(!threwB && envB.W.signallogEntries().length === 0, 'non-array stored JSON also resets fresh, no crash');
}

/* =========================================================================
   6) CLEAR JOURNAL behavior
========================================================================= */
console.log('== 6) CLEAR JOURNAL ==');
{
  const ls = memLocalStorage();
  const env = loadSignallog({ ls });
  env.W.goldscalpScan = () => scalpSnap();
  env.W.signallogSnapshot();
  assert(JSON.parse(ls.getItem('hgSignalLog')).length === 2, 'seeded 2 entries before clearing');

  const M = freshPane();
  tabOf(env.W).mount(M.pane);
  assert(M.stubs['#slBody'].innerHTML.indexOf('XAUUSDT') >= 0, 'table populated before clearing');
  M.stubs['#slClear']._handler();
  assert(ls.getItem('hgSignalLog') === null, 'CLEAR wipes the hgSignalLog key');
  assert(env.W.signallogEntries().length === 0, 'CLEAR empties the in-memory journal');
  assert(M.stubs['#slBody'].innerHTML === '' && M.stubs['#slEmpty'].style.display === 'block',
         'CLEAR re-renders the honest empty state');
  assert(/cleared/.test(M.stubs['#slStat'].textContent), 'stat line confirms the wipe ("' + M.stubs['#slStat'].textContent + '")');

  /* logging resumes after a clear */
  env.W.signallogSnapshot();
  assert(env.W.signallogEntries().length === 2, 'logging resumes on the next snapshot after CLEAR');
}

/* =========================================================================
   7) signallogEntries — deep-frozen, fresh copy per call
========================================================================= */
console.log('== 7) deep-frozen diagnostic surface ==');
{
  const env = loadSignallog();
  const W = env.W;
  W.goldscalpScan = () => scalpSnap();
  W.signallogSnapshot();

  const es = W.signallogEntries();
  assert(Object.isFrozen(es) && Object.isFrozen(es[0]) && Object.isFrozen(es[1]),
         'returned journal + every entry is Object.isFrozen');
  let mThrew = false;
  try { es[0].sym = 'HACKED'; } catch(e){ mThrew = true; }
  assert(mThrew && es[0].sym === 'XAUUSDT', 'frozen entries resist mutation (strict-mode TypeError)');
  let pThrew = false;
  try { es.push({ sym: 'FAKE' }); } catch(e){ pThrew = true; }
  assert(pThrew && es.length === 2, 'frozen array resist push (no fabricated entries possible)');
  const es2 = W.signallogEntries();
  assert(es2 !== es && es2[0] !== es[0] && es2[0].sym === es[0].sym,
         'each call returns a fresh deep copy (same data, new references)');
  /* deep-freeze survives new rounds too */
  W.signallogSnapshot();
  assert(Object.isFrozen(W.signallogEntries()[0]), 'still frozen after later snapshot rounds');
}

/* =========================================================================
   8) interval drives snapshots; started exactly once
========================================================================= */
console.log('== 8) interval behavior ==');
{
  const env = loadSignallog();
  const W = env.W;
  W.goldscalpScan = () => scalpSnap();
  assert(env.intervals.length === 1, 'one interval registered at load');
  assert(W.signallogEntries().length === 0, 'nothing logged before the first tick');
  env.intervals[0].fn();                                    /* simulate the 5-minute tick */
  assert(W.signallogEntries().length === 2, 'interval tick performs a snapshot round');
  env.intervals[0].fn();
  assert(W.signallogEntries().length === 4, 'each tick logs another round (dedup is per-round only)');

  const M = freshPane();
  tabOf(W).mount(M.pane);
  tabOf(W).mount(M.pane);                                   /* defensive double-mount */
  assert(env.intervals.length === 1, 'interval still registered exactly once after mounts (double-start guard)');
}

/* =========================================================================
   9) hostile storage + bare-env never-throws sweep
========================================================================= */
console.log('== 9) hostile env never-throws ==');
{
  /* localStorage.setItem throws (quota/private mode) */
  const lsBad = memLocalStorage();
  lsBad.setItem = () => { throw new Error('QuotaExceededError'); };
  const env = loadSignallog({ ls: lsBad });
  env.W.goldscalpScan = () => scalpSnap();
  let n, threw = false;
  try { n = env.W.signallogSnapshot(); } catch(e){ threw = true; }
  assert(!threw && n === 2, 'throwing localStorage.setItem: snapshot still logs in memory, never throws');
  const M = freshPane();
  let mThrew = false;
  try { tabOf(env.W).mount(M.pane); } catch(e){ mThrew = true; }
  assert(!mThrew && M.stubs['#slBody'].innerHTML.indexOf('XAUUSDT') >= 0, 'mount + render work without storage');

  /* everything absent */
  globalThis.window = {};
  delete globalThis.localStorage;
  const iv = [];
  globalThis.setInterval = (fn, ms) => { iv.push({ fn, ms }); return 1; };
  vm.runInThisContext(fs.readFileSync(root + 'signallog.js', 'utf8'), { filename: 'signallog.js' });
  const B = globalThis.window;
  const tab = B.HG_tabs.find(t => t.id === 'signallog');
  let threw2 = 0;
  try { tab.mount(null); } catch(e){ threw2++; }
  try { tab.mount(freshPane().pane); } catch(e){ threw2++; }
  try { B.signallogSnapshot(); } catch(e){ threw2++; }
  try { B.signallogEntries(); } catch(e){ threw2++; }
  try { await tab.refresh(); } catch(e){ threw2++; }
  assert(threw2 === 0, 'no localStorage, no sources, no DOM: nothing throws across mount/snapshot/entries/refresh');
  assert(Array.isArray(B.signallogEntries()) && B.signallogEntries().length === 0, 'bare env -> honest empty journal');
  assert(iv.length === 1 && iv[0].ms === 300000, 'interval still registered exactly once in the bare env');
}

globalThis.setInterval = REAL_SET_INTERVAL;
console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
