/* HARDGATE — golddirection.js unit tests (Node 18+, builtins only, ZERO
   network — getGoldCandles is seeded). Loads modules as classic scripts via
   vm.runInThisContext with globalThis.window = {} (the tests/test-goldscalp.mjs
   harness style).

   Covers: registration + mount smoke (LONG/SHORT toggle, RUN SCAN disabled
   until a side is chosen, honest hint); never-throws with ALL globals absent;
   direction honesty (SHORT selected against a tape that yields LONG
   candidates -> zero long cards rendered, no pick fabricated, other side
   counted); suppressed kinds never crowned; demoted-only side -> NO execution
   banner + honest 'no lead-eligible … closest candidates are demoted' header;
   wrong-side geometry never shown tradable (counted + listed on rejected);
   vetoed candidates never crowned even at a higher confScore; the crowned
   pick is the first lead-eligible; AGAINST DESK TAPE stamp when the desk tape
   disagrees with the user's side (and the side is NEVER flipped); forward
   ledger records the crowned picks only (GOLDDIRECTION/1h/XAUUSD, mechanic =
   source desk + stratKey, horizonBars 24); snapshot contract fields
   (side/scalp/swing/tape/enginesDark/at, deep-frozen); BRAIN state contract;
   localStorage 'hg_golddir_side' persistence round-trip; refresh + warm-up
   contracts. Run: node tests/test-golddirection.mjs */

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

/* ---------------- shared builders (test-goldscalp.mjs style) ---------------- */
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
  return { pane, stubs };
}
function memLocalStorage(){
  const m = {};
  return { getItem: k => (k in m ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; },
           _map: m };
}
const DAY = Date.UTC(2024, 0, 15, 0, 0, 0) / 1000;   // Monday 00:00 GMT
/* the goldscalp test's own composite-long construction: bullish sweep +
   bullish RSI divergence -> LONG candidates (sweep edge-SUPPRESSED, rsidiv
   edge-DEMOTED on the current measured-edge bake) */
function compLongRows(){
  const rows = [];
  const push = (i, o, h, l, c, v) => rows.push({ t: DAY + i * 900, o, h, l, c, v: (v === undefined ? 1000 : v) });
  let c = 2320;
  for (let i = 0; i < 60; i++){ const o = c; c -= 0.2; push(i, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c); }
  for (let i = 60; i < 96; i++){
    const o = c; c = 2306 + ((i % 4) - 1.5) * 1.2;
    push(i, o, Math.max(o, c) + 0.7, Math.min(o, c) - 0.9, c, 900);
  }
  for (let i = 96; i < 106; i++){ const o = c; c = o - 1.0; push(i, o, o + 0.4, c - 0.5, c, 1100); }
  push(106, 2296, 2296.5, 2293, 2294, 1500);
  push(107, 2294, 2298, 2293.8, 2297, 1200);
  push(108, 2297, 2300, 2296.5, 2299, 1200);
  push(109, 2299, 2299.6, 2288, 2297, 4000);
  push(110, 2297, 2299.5, 2296.4, 2298.5, 1300);
  push(111, 2298.5, 2300.6, 2298, 2300, 1300);
  push(112, 2300, 2301.6, 2299.5, 2301, 1200);
  push(113, 2301, 2302.6, 2300.5, 2302, 1200);
  push(114, 2302, 2303, 2301.5, 2302.5, 1200);
  push(115, 2302.5, 2305.5, 2302, 2305, 2600);
  push(116, 2305, 2306.5, 2303.5, 2306, 1500);
  push(117, 2306, 2306.6, 2304.6, 2305.5, 1100);
  push(118, 2305.5, 2306.4, 2304.8, 2306, 1100);
  push(119, 2306, 2306.5, 2305, 2305.8, 1100);
  return rows;
}
function cloneRows(rows){ return rows.map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v })); }
const OVLP_NOW = Date.UTC(2024, 0, 16, 14, 0, 0);   // 14:00 GMT -> killzone weight 3
const PINNED = OVLP_NOW + 30 * 60 * 1000;            // 14:30 GMT

/* =========================================================================
   0) registration + mount smoke (goldind loaded so one engine is live)
========================================================================= */
console.log('== 0) registration + mount smoke ==');
{
  globalThis.window = {};
  delete globalThis.localStorage;
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const W = globalThis.window;

  const tab = W.HG_tabs.find(t => t.id === 'golddirection');
  assert(!!tab && tab.label === 'GOLD DIRECTION' && typeof tab.mount === 'function' && typeof tab.refresh === 'function',
         'HG_tabs entry: id=golddirection, label=GOLD DIRECTION, mount + refresh');
  const warm = (W.HG_warmups || []).find(t => t.id === 'golddirection');
  assert(!!warm && warm.label === 'GOLD DIRECTION' && typeof warm.run === 'function', 'HG_warmups entry registered');
  assert(typeof W.goldDirectionScan === 'function' && W.goldDirectionScan() === null,
         'goldDirectionScan() exported, null before the first scan');
  assert(typeof W.goldDirectionState === 'function' && W.goldDirectionState() === null,
         'goldDirectionState() exported, null before the first scan');

  let threw = false;
  try { tab.mount(null); } catch(e){ threw = true; }
  assert(!threw, 'mount(null) does not throw');

  const M = freshPane();
  tab.mount(M.pane);
  assert(M.pane._html.indexOf('GOLD DIRECTION') >= 0 && M.pane._html.indexOf('id="gdRun"') >= 0,
         'mount renders the panel + RUN SCAN button');
  assert(M.pane._html.indexOf('id="gdLong"') >= 0 && M.pane._html.indexOf('id="gdShort"') >= 0,
         'LONG / SHORT direction toggle rendered');
  assert(M.stubs['#gdRun'].disabled === true, 'RUN SCAN disabled while no direction is selected (default none)');
  assert(/no direction selected/.test(M.stubs['#gdStat'].textContent) && /your call/i.test(M.stubs['#gdStat'].textContent),
         'honest hint: the side is the user’s call, scan disabled until chosen');
  assert(typeof M.stubs['#gdLong']._handler === 'function' && typeof M.stubs['#gdShort']._handler === 'function'
      && typeof M.stubs['#gdRun']._handler === 'function', 'all three buttons wired to click handlers');

  const r0 = await tab.refresh();
  assert(r0 === 'skipped: not run yet', 'refresh before first run -> "skipped: not run yet" (never a self-triggered first scan)');

  /* run with no side -> honest skip, never a fabricated scan */
  const rNoSide = await M.stubs['#gdRun']._handler();
  assert(rNoSide === 'skipped: no direction selected', 'RUN with no side -> "skipped: no direction selected"');
  assert(W.goldDirectionScan() === null, 'no snapshot published for a side-less run');
}

/* =========================================================================
   1) never-throws with ALL globals absent (only golddirection.js loaded)
========================================================================= */
console.log('== 1) bare-environment never-throws sweep ==');
{
  globalThis.window = {};
  delete globalThis.localStorage;
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const B = globalThis.window;
  const tab = B.HG_tabs.find(t => t.id === 'golddirection');
  const warm = (B.HG_warmups || []).find(t => t.id === 'golddirection');
  const M = freshPane();
  let mountThrew = false;
  try { tab.mount(M.pane); } catch(e){ mountThrew = true; }
  assert(!mountThrew, 'mount in a bare env (no localStorage, no engines, no feeds) never throws');
  assert(/ENGINES DARK AT MOUNT/.test(M.stubs['#gdCards'].innerHTML), 'dark engines named at mount, nothing fabricated');

  const w0 = await warm.run();
  assert(/^unavailable: no direction selected/.test(w0), 'warm with no side -> honest "unavailable: no direction selected …"');

  let clickThrew = false;
  try { M.stubs['#gdLong']._handler(); } catch(e){ clickThrew = true; }
  assert(!clickThrew, 'LONG click with localStorage absent never throws (soft persistence)');

  const r1 = await M.stubs['#gdRun']._handler();
  assert(r1 === 'refreshed', 'scan with zero feeds resolves "refreshed" with an honest stat (got "' + r1 + '")');
  assert(/feeds failed/.test(M.stubs['#gdStat'].textContent), 'stat line names the feed failure');
  assert(B.goldDirectionScan() === null && B.goldDirectionState() === null,
         'feeds-failed scan publishes nothing (previous snapshot — none — stands)');

  const r2 = await tab.refresh();
  assert(typeof r2 === 'string' && (r2 === 'refreshed' || /^error:/.test(r2) || /^skipped:/.test(r2) || r2 === 'busy'),
         'refresh in a bare env resolves a contract string ("' + r2 + '")');
  const w1 = await warm.run();
  assert(/^unavailable: gold klines layer not loaded/.test(w1),
         'warm with a side but no klines layer -> honest unavailable (got "' + w1 + '")');
}

/* =========================================================================
   2) localStorage 'hg_golddir_side' persistence round-trip
========================================================================= */
console.log('== 2) side persistence round-trip ==');
{
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  let W2 = globalThis.window;
  let tab = W2.HG_tabs.find(t => t.id === 'golddirection');
  const M1 = freshPane();
  tab.mount(M1.pane);
  M1.stubs['#gdShort']._handler();
  assert(ls._map['hg_golddir_side'] === 'short', 'SHORT click persists hg_golddir_side = "short"');
  assert(/active/.test(M1.stubs['#gdShort'].className) && !/active/.test(M1.stubs['#gdLong'].className),
         'SHORT button active, LONG not');
  assert(M1.stubs['#gdRun'].disabled === false, 'RUN SCAN enabled once a side is chosen');
  M1.stubs['#gdLong']._handler();
  assert(ls._map['hg_golddir_side'] === 'long', 'LONG click overwrites the persisted side');

  /* fresh module load — the saved side must come back without a click */
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  W2 = globalThis.window;
  tab = W2.HG_tabs.find(t => t.id === 'golddirection');
  const M2 = freshPane();
  tab.mount(M2.pane);
  assert(/active/.test(M2.stubs['#gdLong'].className), 'round-trip: fresh mount restores the saved LONG side');
  assert(M2.stubs['#gdRun'].disabled === false, 'round-trip: RUN SCAN enabled from the restored side');
  assert(/LONG/.test(M2.stubs['#gdStat'].textContent) && /saved/i.test(M2.stubs['#gdStat'].textContent),
         'round-trip: stat names the restored side as the user’s saved call');
  delete globalThis.localStorage;
}

/* =========================================================================
   3) seeded scans — honesty invariants (goldind live, other engines dark)
========================================================================= */
console.log('== 3) seeded scans: demoted-only side, direction honesty, crowning ==');
{
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const C = globalThis.window;
  const realDateNow = Date.now;
  Date.now = () => PINNED;   // pin: killzone/session gates deterministic
  const baseRows = compLongRows();
  C.getGoldCandles = async (tf) => (tf === '15m')
    ? { rows: cloneRows(baseRows), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };

  /* premise (the desks' own verdicts on this tape at this hour): every
     surviving scalp candidate is demoted, the sweep kind is suppressed */
  {
    const rows = cloneRows(baseRows);
    const raw = C.goldScalpSetups({ rows15m: rows, now: PINNED });
    const rk = C.goldRankSetups(raw, { now: PINNED, rows15m: rows, rows1h: [], rows4h: [] });
    assert(Array.isArray(rk.ranked) && rk.ranked.length >= 1, 'premise: >=1 ranked LONG candidate on the seeded tape');
    assert(rk.ranked.every(c => c.dir === 'long'), 'premise: every ranked candidate is LONG');
    assert(rk.best === null && rk.ranked.every(c => c.demoted === true),
           'premise: all ranked candidates demoted -> the desks themselves crown nothing');
    assert((raw.rejected || []).some(r => r && r.stratKey === 'sweep'), 'premise: sweep kind suppressed into the rejected channel');
  }

  const tab = C.HG_tabs.find(t => t.id === 'golddirection');
  const M = freshPane();
  tab.mount(M.pane);

  /* ---- 3a) LONG side, demoted-only board -> NO execution banner ---- */
  M.stubs['#gdLong']._handler();
  const rA = await M.stubs['#gdRun']._handler();
  assert(rA === 'refreshed', 'scan A (LONG) completes with the seeded feed (got "' + rA + '")');
  const snapA = C.goldDirectionScan();
  assert(!!snapA, 'diagnostic snapshot published after a successful scan');
  assert(snapA.side === 'long', 'snapshot.side = the user’s call (long)');
  assert(['side', 'scalp', 'swing', 'tape', 'enginesDark', 'at'].every(k => k in snapA),
         'snapshot contract fields: side / scalp / swing / tape / enginesDark / at');
  assert(['pick', 'held', 'rejected', 'otherSide'].every(k => k in snapA.scalp) &&
         ['pick', 'held', 'rejected', 'otherSide'].every(k => k in snapA.swing),
         'per-horizon contract fields: pick / held / rejected / otherSide');
  assert(Object.isFrozen(snapA) && Object.isFrozen(snapA.scalp) && Object.isFrozen(snapA.scalp.held),
         'snapshot is deep-frozen');
  assert(typeof snapA.at === 'number' && Array.isArray(snapA.enginesDark), 'at is a number, enginesDark an array');
  assert(snapA.enginesDark.length === 4
      && snapA.enginesDark.some(s => /GOLD SWING/.test(s)) && snapA.enginesDark.some(s => /OMNIGOLD 1/.test(s))
      && snapA.enginesDark.some(s => /OMNIGOLD engine dark/.test(s)) && snapA.enginesDark.some(s => /NEW GOLD/.test(s)),
         'the four unloaded engines are named dark — never a throw, never fabricated');

  assert(snapA.scalp.pick === null, 'all-demoted LONG scalp board -> NO crowned pick (v699/v700 lead invariant)');
  const htmlA = M.stubs['#gdCards'].innerHTML;
  assert(htmlA.indexOf('gdx-banner-in') < 0, 'NO execution banner anywhere on an all-demoted board');
  assert(htmlA.indexOf('no lead-eligible SCALP setup on the LONG side — closest candidates are demoted:') >= 0,
         'honest demoted-only header, exact contract wording');
  assert(/DEMOTED — paints, never leads/.test(htmlA), 'demoted cards carry the demotion chip');
  assert(/DEMOTED<\/b>/.test(htmlA) || /demoted/i.test(htmlA), 'demotion reasons visible on the card');
  /* suppressed kinds never crowned + surfaced on the held list */
  assert(snapA.scalp.held.some(r => /SWEEP/i.test(String(r.strategy || '')) || /sweep/i.test(String(r.reason || ''))),
         'suppressed sweep kind surfaces as a held-back line (the desk’s own reason string)');
  assert(snapA.scalp.held.every(r => ['source', 'horizon', 'strategy', 'dir', 'reason'].every(k => k in r)),
         'held lines carry {source, horizon, strategy, dir, reason}');
  assert(!snapA.scalp.pick || snapA.scalp.pick.stratKey !== 'sweep', 'a suppressed kind is never the crowned pick');
  const stA = C.goldDirectionState();
  assert(!!stA && Array.isArray(stA.results) && stA.results.length === 0,
         'BRAIN state: zero crowned picks -> results [] (no pick fabricated)');

  /* ---- 3b) DIRECTION HONESTY: SHORT against an all-LONG tape ---- */
  M.stubs['#gdShort']._handler();
  assert(ls._map['hg_golddir_side'] === 'short', 'side switch persisted before scan B');
  const rB = await M.stubs['#gdRun']._handler();
  assert(rB === 'refreshed', 'scan B (SHORT) completes (got "' + rB + '")');
  const snapB = C.goldDirectionScan();
  assert(snapB.side === 'short', 'snapshot.side = short — the user’s call is NEVER silently flipped');
  assert(snapB.scalp.pick === null && snapB.swing.pick === null, 'no pick fabricated from the wrong side');
  assert(snapB.scalp.otherSide >= 1, 'LONG candidates counted on otherSide (' + snapB.scalp.otherSide + '), never rendered as yours');
  const htmlB = M.stubs['#gdCards'].innerHTML;
  assert(htmlB.indexOf('<div class="gdx-card') < 0, 'ZERO candidate cards rendered — no long card shown on a SHORT call');
  assert(htmlB.indexOf('gdx-banner-in') < 0, 'no execution banner on the silent side');
  assert(/WHY SILENT/.test(htmlB) && /on the other side/.test(htmlB),
         'honest whySilent empty state names the other-side count');
  const stB = C.goldDirectionState();
  assert(!!stB && stB.results.length === 0, 'BRAIN state after honest-silent scan: results []');

  /* ---- 3c) crowning: lead-eligible first; vetoed/wrong-side/demoted never crowned;
              AGAINST DESK TAPE stamp; forward ledger = crowned picks only ---- */
  C.getGoldCandles = async (tf) =>
    (tf === '15m') ? { rows: cloneRows(baseRows), source: 'binance-xau' }
    : (tf === '4h') ? { rows: cloneRows(baseRows), source: 'binance-xau' }
    : { rows: [], source: 'binance-xau' };
  const goodSwing = { dir: 'long', strategy: 'WEEKLY RANGE BREAKOUT', stratKey: 'weekly', grade: 'A',
    entry: 2300, stop: 2280, t1: 2340, t2: 2360, rr: 2, rr2: 3, zone: { lo: 2290, hi: 2310 },
    tally: 6, confScore: 70, stamps: [], gateNotes: ['stub gate note'], why: 'stub lead — every field real' };
  const wrongSide = { dir: 'long', strategy: 'BROKEN GEOMETRY', stratKey: 'badgeo',
    entry: 2300, stop: 2320, t1: 2280, rr: 1, stamps: [], gateNotes: [] };            // long, stop ABOVE, T1 BELOW
  const vetoedC = { dir: 'long', strategy: 'VETOED THING', stratKey: 'vet',
    entry: 2300, stop: 2280, t1: 2340, confScore: 99, vetoed: true, stamps: [], gateNotes: [] };
  const demotedBetter = { dir: 'long', strategy: 'DEMOTED BETTER', stratKey: 'demo',
    entry: 2300, stop: 2280, t1: 2340, confScore: 95, demoted: true, demoteWhy: 'measured cohort negative (stub)',
    stamps: [], gateNotes: [] };
  C.goldSwingSetups = () => ({ ranked: [vetoedC, demotedBetter, wrongSide, goodSwing], rejected: [] });
  C.hgGoldUniformTape = () => 'SHORT';   // desk tape DISAGREES with the LONG call —
                                         // REAL gold-catalog.js casing (UPPERCASE); the tab must
                                         // read it case-insensitively or the stamp silently vanishes
  const fwdCalls = [];
  C.hgFwdRecordScan = (tabName, tf, rows, opts) => { fwdCalls.push({ tabName, tf, rows, opts }); return rows.length; };

  M.stubs['#gdLong']._handler();
  const rC = await M.stubs['#gdRun']._handler();
  assert(rC === 'refreshed', 'scan C (LONG, stubbed swing engine) completes (got "' + rC + '")');
  const snapC = C.goldDirectionScan();
  assert(snapC.side === 'long' && snapC.tape === 'short',
         'tape short vs LONG call: side stands, tape reported — never flipped');
  assert(!!snapC.swing.pick && snapC.swing.pick.stratKey === 'weekly' && snapC.swing.pick.source === 'GOLD SWING',
         'crowned SWING pick = first lead-eligible (weekly), not the higher-confScore vetoed/demoted cards');
  assert(snapC.swing.pick.dir === 'long' && snapC.swing.pick.demoted === false,
         'crowned pick is lead-eligible on the user’s side');
  assert(snapC.swing.rejected.some(r => r.strategy === 'VETOED THING' && /vetoed/.test(r.reason)),
         'vetoed candidate listed on rejected — never a pick even at confScore 99');
  const wrongRej = snapC.swing.rejected.find(r => r.strategy === 'BROKEN GEOMETRY');
  assert(!!wrongRej && /WRONG-SIDE GEOMETRY/.test(wrongRej.reason),
         'wrong-side geometry counted + listed with the named reason, never tradable');
  const htmlC = M.stubs['#gdCards'].innerHTML;
  const idxBroken = htmlC.indexOf('BROKEN GEOMETRY');
  assert(idxBroken >= 0
      && htmlC.lastIndexOf('class="gdx-heldrow"', idxBroken) > htmlC.lastIndexOf('class="gdx-card', idxBroken),
         'BROKEN GEOMETRY renders only as a rejected reason line, never inside a candidate card');
  assert((htmlC.match(/gdx-banner-in/g) || []).length === 1,
         'exactly ONE execution banner (SWING crowned; demoted-only SCALP still gets none)');
  assert(htmlC.indexOf('BEST SWING SETUP — YOUR LONG CALL') >= 0, 'banner names the horizon and the user’s call');
  assert(htmlC.indexOf('no lead-eligible SCALP setup on the LONG side — closest candidates are demoted:') >= 0,
         'demoted-only SCALP header still honest beside the crowned SWING');
  assert(/AGAINST DESK TAPE — your call/.test(htmlC), 'AGAINST DESK TAPE stamp rendered prominently');
  assert(/never flipped/i.test(htmlC), 'the tape line says the side is shown, never flipped');
  assert(/TRADE MANAGEMENT/.test(htmlC) && /close 50%/.test(htmlC) && htmlC.indexOf('2,340') >= 0,
         'TRADE MANAGEMENT line built from the card’s real TP1/TP2 values');
  assert(/ENTRY GUIDANCE/.test(htmlC) && /price in zone — market entry valid/.test(htmlC),
         'ENTRY GUIDANCE reads price (2305.8) inside the stub zone 2290–2310');
  assert(/stub gate note/.test(htmlC), 'gateNotes visible on the card');
  assert(/DEMOTED BETTER/.test(htmlC) && /measured cohort negative \(stub\)/.test(htmlC),
         'the demoted swing card paints with its demotion reason — it just never leads');

  /* forward ledger: crowned picks ONLY */
  assert(fwdCalls.length === 1, 'hgFwdRecordScan called exactly once per successful scan');
  const fc = fwdCalls[0];
  assert(fc.tabName === 'GOLDDIRECTION' && fc.tf === '1h' && fc.opts && fc.opts.horizonBars === 24,
         'forward call shape: GOLDDIRECTION / 1h / horizonBars 24');
  assert(fc.rows.length === 1, 'crowned picks only: 1 row (SWING pick; demoted-only SCALP records nothing)');
  assert(fc.rows[0].sym === 'XAUUSD' && fc.rows[0].dir === 'long'
      && fc.rows[0].entry === 2300 && fc.rows[0].stop === 2280 && fc.rows[0].t1 === 2340,
         'forward row: sym XAUUSD + the crowned pick’s real levels');
  assert(fc.rows[0].mechanic === 'GOLD-SWING-WEEKLY',
         'mechanic = source desk + stratKey (got "' + fc.rows[0].mechanic + '")');

  /* BRAIN contract */
  const stC = C.goldDirectionState();
  assert(!!stC && stC.results.length === 1, 'BRAIN state: one row per crowned pick');
  assert(Object.keys(stC.results[0]).sort().join(',') === 'dir,grade,horizon,source',
         'BRAIN rows carry EXACTLY {dir, horizon, grade, source}');
  assert(stC.results[0].dir === 'long' && stC.results[0].horizon === 'SWING'
      && stC.results[0].source === 'GOLD SWING' && stC.results[0].grade === 'A',
         'BRAIN row content matches the crowned pick');
  assert(Object.isFrozen(stC) && Object.isFrozen(stC.results) && Object.isFrozen(stC.results[0]),
         'BRAIN snapshot is deep-frozen');

  /* refresh + warm contracts on a warm desk */
  const rf = await tab.refresh();
  assert(rf === 'refreshed', 'refresh after a completed scan re-runs and resolves "refreshed"');
  const warm = (C.HG_warmups || []).find(t => t.id === 'golddirection');
  const wOut = await warm.run();
  assert(wOut === 'fresh', 'warm hook -> "fresh" once a snapshot exists');

  /* failed re-run keeps the previous good snapshot */
  const atBefore = C.goldDirectionScan().at;
  C.getGoldCandles = async () => { throw new Error('feed down'); };
  C.binanceKlines = undefined;
  const rFail = await tab.refresh();
  assert(rFail === 'refreshed', 'failed-data re-run still resolves refreshed with an honest stat line');
  assert(C.goldDirectionScan() && C.goldDirectionScan().at === atBefore,
         'failed re-run keeps the PREVIOUS good snapshot with its original at');
  assert(/feeds failed/.test(M.stubs['#gdStat'].textContent), 'honest stat line names the data failure');

  Date.now = realDateNow;
  delete globalThis.localStorage;
}

/* =========================================================================
   4) desk-tape fidelity: real gold-catalog casing + the OMNIGOLD 1 lane's
      closed-bar tape cut (the hg-v700 one-clock rule, held here too)
========================================================================= */
console.log('== 4) desk-tape fidelity ==');
{
  const ls = memLocalStorage();
  ls._map['hg_golddir_side'] = 'long';
  globalThis.localStorage = ls;
  globalThis.window = {};
  /* gold-catalog.js loaded for REAL — its hgGoldUniformTape answers UPPERCASE;
     no omnigold.js, so there is NO hgOgDeskTape fallback to hide a casing bug */
  vm.runInThisContext(fs.readFileSync(root + 'gold-catalog.js', 'utf8'), { filename: 'gold-catalog.js' });
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const T = globalThis.window;

  /* clean downtrend: close < EMA21 < EMA50 -> uniform tape SHORT */
  const t0 = Date.UTC(2024, 0, 1) / 1000;
  const down = [];
  for (let i = 0; i < 120; i++){
    const o = 2500 - i * 2, c = o - 2;
    down.push({ t: t0 + i * 3600, o, h: o + 1, l: c - 1, c, v: 1000 });
  }
  assert(T.hgGoldUniformTape(down) === 'SHORT', 'premise: real hgGoldUniformTape answers UPPERCASE SHORT');

  T.getGoldCandles = async () => ({ rows: down.map(r => ({ ...r })), source: 'seed' });
  T.goldSwingSetups = () => ({ ranked: [{ dir: 'long', strategy: 'LONG STUB', stratKey: 'ls',
    entry: 2260, stop: 2250, t1: 2280, t2: 2290, rr: 2, rr2: 3, stamps: [], gateNotes: [] }], rejected: [] });
  const og1Inputs = [];
  T.hgOg1Engine = (inp) => { og1Inputs.push(inp); return { ok: false, why: 'stub' }; };
  /* forming 4h bar: a violent up-bar whose close time is AFTER now — the tape
     must be cut on CLOSED bars only, so it must NOT flip the read.
     60 closed 4h bars (>= the uniform tape's 55-bar floor), downtrend. */
  const rows4h = [];
  for (let i = 0; i < 60; i++){
    const o = 2700 - i * 6, c = o - 6;
    rows4h.push({ t: t0 + i * 14400, o, h: o + 2, l: c - 2, c, v: 3000 });
  }
  assert(T.hgGoldUniformTape(rows4h) === 'SHORT', 'premise: closed 4h series reads SHORT');
  const lastT4 = rows4h[rows4h.length - 1].t;
  rows4h.push({ t: lastT4 + 14400, o: 2340, h: 3400, l: 2335, c: 3390, v: 9000 });   // forming
  assert(T.hgGoldUniformTape(rows4h) !== 'SHORT', 'premise: the forming up-bar flips a raw-rows tape read');
  T.getGoldCandles = async (tf) => ({
    rows: (tf === '4h') ? rows4h.map(r => ({ ...r })) : down.map(r => ({ ...r })), source: 'seed' });
  T.HG_GOLD7 = {
    closedRows: (rows, tfSec, nowMs) => {
      const nowSec = Math.floor(nowMs / 1000);
      const out = rows.map(r => ({ ...r }));
      while (out.length && out[out.length - 1].t + tfSec > nowSec) out.pop();
      return out;
    }
  };
  const realNow2 = Date.now;
  Date.now = () => (lastT4 + 14400 + 600) * 1000;   // 10 min into the forming 4h bar

  const tab4 = T.HG_tabs.find(t => t.id === 'golddirection');
  const M4 = freshPane();
  tab4.mount(M4.pane);
  const r4 = await M4.stubs['#gdRun']._handler();
  assert(r4 === 'refreshed', 'tape-fidelity scan completes (got "' + r4 + '")');
  const snap4 = T.goldDirectionScan();
  assert(snap4.tape === 'short', 'UPPERCASE uniform tape read as "short" — no omnigold fallback needed (got "' + snap4.tape + '")');
  const html4 = M4.stubs['#gdCards'].innerHTML;
  assert(/AGAINST DESK TAPE — your call/.test(html4), 'AGAINST DESK TAPE stamp survives the real gold-catalog casing');
  assert(snap4.side === 'long' && snap4.swing.pick && snap4.swing.pick.dir === 'long',
         'the side still stands — tape is shown, never flipped');
  const scalpInp = og1Inputs.find(x => x.horizon === 'SCALP');
  assert(!!scalpInp && scalpInp.tape === 'short',
         'OMNIGOLD 1 lane tape cut on CLOSED 4h bars (forming up-bar ignored) and case-normalized (got "' + (scalpInp && scalpInp.tape) + '")');
  Date.now = realNow2;
  delete globalThis.localStorage;
}

console.log('== 5) hg-v701: scalp lane runs hgFilterGoldPostGate (source-desk parity) ==');
/* The GOLD SCALP tab post-gates its ranked set right after ranking
   (goldscalp.js ~1574); without the same gate this tab could crown a card
   the source desk itself demotes as POST-GATE STALE. Audit major, closed. */
{
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const C = globalThis.window;
  const realDateNow = Date.now;
  Date.now = () => PINNED;
  const mk = () => ({ id: 'stub|long|1', dir: 'long', stratKey: 'p6fail', strategy: 'S30 FAILED-BREAK REVERSAL',
    entry: 2400, stop: 2390, t1: 2420, t2: 2430, rr: 2, grade: 'A', tally: 8, agree: 4, atr: 6,
    demoted: false, vetoed: false, stamps: [] });
  const rows = cloneRows(compLongRows());
  C.getGoldCandles = async (tf) => ({ rows: cloneRows(rows), source: 'binance-xau' });
  C.goldScalpSetups = () => { const a = [mk()]; a.rejected = []; return a; };
  C.goldRankSetups = (cands) => ({ ranked: cands, best: cands[0] || null, rejected: [] });
  C.hgGoldPlanSidesOk = () => ({ ok: true });
  let pgArgs = null;
  C.hgFilterGoldPostGate = async (ranked, venueRows, rows4h, style) => {
    pgArgs = { style: style, gotRows4h: Array.isArray(rows4h) };
    ranked.forEach(c => { c.demoted = true; (c.stamps = c.stamps || []).push('POST-GATE STALE'); });
    return ranked;
  };
  const tab = C.HG_tabs.find(t => t.id === 'golddirection');
  const M = freshPane();
  tab.mount(M.pane);
  M.stubs['#gdLong']._handler();
  const r = await M.stubs['#gdRun']._handler();
  assert(r === 'refreshed', 'scan completes with the post-gate stub (got "' + r + '")');
  assert(pgArgs && pgArgs.style === 'gold-scalp' && pgArgs.gotRows4h === true,
         'hgFilterGoldPostGate invoked with the desk\'s own style + rows4h');
  const snap = C.goldDirectionScan();
  assert(!snap.scalp.pick, 'a card the post-gate demotes is never crowned here either');

  /* gate THROWS -> every candidate marked unchecked (desk semantics), never silently clean */
  let marked = 0;
  C.hgMarkGateUnchecked = (c, whys) => { marked++; (c.stamps = c.stamps || []).push('GATE UNCHECKED'); };
  C.hgFilterGoldPostGate = async () => { throw new Error('boom'); };
  const r2 = await tab.refresh();
  assert(r2 === 'refreshed', 'gate-throw scan still completes (got "' + r2 + '")');
  assert(marked >= 1, 'a throwing post-gate marks candidates UNCHECKED — never silently clean');
  Date.now = realDateNow;
  delete globalThis.localStorage;
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
