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
   contracts.

   hg-v702: PROVEN-ONLY CROWNING — the proven set resolves at runtime from
   W.HG_GOLD_SETUP_EDGE prefer rows + stubbed hgOgSwingPrefer/hgFwdPaidKinds,
   each entry tagged with its source; a lead-eligible UNPROVEN candidate is
   never crowned (lands on unproven[]); the crowned card's MEASURED RECORD
   line prints the proving row's own numbers (n= asserted from the row);
   live-paid ledger evidence un-gates a kind (tagged live-paid, hgFwdPool
   stats printed); '100%' never appears as a claim — only inside the fixed
   honesty note. EXPLICIT DIRECTION CONFIRMATION — no scan without the
   user's CONFIRM & SCAN click this session (persisted side included);
   switching sides clears rendered results + snapshots and requires
   re-confirm; the board header names the confirmed side.
   Run: node tests/test-golddirection.mjs */

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
  /* hg-v702 deliberate update: crowning is now PROVEN-ONLY, and this section
     loads no goldind — bless the stub strategy through the live edge-table
     source (the same W.HG_GOLD_SETUP_EDGE read the tab resolves at scan
     time) so the tape-fidelity pick still crowns. */
  T.HG_GOLD_SETUP_EDGE = { scalp: {}, swing: { ls: { n: 40, gross: 0.3, net: 0.25, action: 'prefer',
    why: 'stub prefer row for the tape-fidelity crown (hg-v702 test)' } } };
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

/* =========================================================================
   6) hg-v702: proven-only crowning — runtime proven set, measured records
========================================================================= */
console.log('== 6) hg-v702: proven-only crowning ==');
{
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const C = globalThis.window;
  const realDateNow = Date.now;
  Date.now = () => PINNED;

  /* feeds: 1h + 4h long enough for the OMNIGOLD lane (>=60 bars); 15m empty
     so the GOLD SCALP lane stays held and adds no noise */
  const t0 = Date.UTC(2024, 0, 1) / 1000;
  const rows1h = []; for (let i = 0; i < 80; i++){ const o = 2300 + i * 0.5, c = o + 0.4; rows1h.push({ t: t0 + i * 3600, o, h: c + 0.5, l: o - 0.5, c, v: 1000 }); }
  const rows4h = []; for (let i = 0; i < 80; i++){ const o = 2300 + i * 1.5, c = o + 1.2; rows4h.push({ t: t0 + i * 14400, o, h: c + 1, l: o - 1, c, v: 3000 }); }
  C.getGoldCandles = async (tf) => (tf === '1h') ? { rows: rows1h.map(r => ({ ...r })), source: 'seed' }
    : (tf === '4h') ? { rows: rows4h.map(r => ({ ...r })), source: 'seed' }
    : { rows: [], source: 'seed' };

  /* OMNIGOLD lane stubs: one formed SWING kind on the proven-list stub */
  C.hgOgHorizonCfg = (label) => ({ label });
  C.hgOgDetect = () => [{ k: 1 }];
  C.hgOgEvaluate = (rows, hits, extra, cfg) => (cfg && cfg.label === 'SWING')
    ? [{ kind: 'BOS-RETEST', dir: 'long', formation: { formed: true },
         plan: { entry: 2400, stop: 2380, t1: 2440, t2: 2460, rr1: 2, rr2: 3 } }]
    : [];
  C.hgOgSwingPrefer = (kind, hz) => String(hz).toUpperCase() === 'SWING' && String(kind).toUpperCase() === 'BOS-RETEST';
  const paidCalls = [];
  C.hgFwdPaidKinds = (tab) => { paidCalls.push(tab); return tab === 'GOLDDIRECTION' ? ['GOLD-SWING-LEDGERKID'] : []; };
  C.hgFwdPool = (tab) => (tab === 'GOLDDIRECTION') ? { 'GOLD-SWING-LEDGERKID': { samples: 21, wins: 13, expR: 0.31 } } : {};

  /* swing engine: an UNPROVEN lead-eligible card OUTRANKING a proven one */
  const provenSwing = { dir: 'long', strategy: 'WEEKLY RANGE BREAKOUT', stratKey: 'weekly', grade: 'A',
    entry: 2300, stop: 2280, t1: 2340, t2: 2360, rr: 2, rr2: 3, confScore: 50, stamps: [], gateNotes: [] };
  const unprovenSwing = { dir: 'long', strategy: 'UNPROVEN THING', stratKey: 'mystery',
    entry: 2310, stop: 2290, t1: 2350, t2: 2370, rr: 2, rr2: 3, confScore: 90, stamps: [], gateNotes: [] };
  C.goldSwingSetups = () => ({ ranked: [unprovenSwing, provenSwing], rejected: [] });

  const tab = C.HG_tabs.find(t => t.id === 'golddirection');
  const M = freshPane();
  tab.mount(M.pane);

  /* fixed honesty note; '100%' appears ONLY inside its phrase */
  assert(M.pane._html.indexOf('No strategy measures 100%.') >= 0,
         'fixed honesty note rendered in the tab header area');
  {
    const html = M.pane._html;
    const PHR = 'No strategy measures 100%';
    let i = -1, stray = false;
    while ((i = html.indexOf('100%', i + 1)) >= 0){
      if (html.substring(i - (PHR.length - 4), i + 4) !== PHR) stray = true;
    }
    assert(!stray, 'every "100%" in the header sits inside the honesty phrase — no certainty claim anywhere');
  }

  M.stubs['#gdLong']._handler();
  assert(/Direction armed: LONG — press CONFIRM & SCAN/.test(M.stubs['#gdStat'].textContent),
         'picking a side ARMS it and asks for the confirm click');
  const r1 = await M.stubs['#gdRun']._handler();
  assert(r1 === 'refreshed', 'CONFIRM & SCAN completes (got "' + r1 + '")');
  const snap = C.goldDirectionScan();

  /* proven-set resolution: exactly the live table's prefer rows + the
     stubbed hgOgSwingPrefer / hgFwdPaidKinds contributions, each tagged */
  const ps = snap.provenSet;
  assert(Array.isArray(ps) && Object.isFrozen(ps), 'snapshot.provenSet published, deep-frozen');
  const replayKeys = ps.filter(e => e.source === 'replay-prefer').map(e => e.horizon + ':' + e.key).sort().join(',');
  const expReplay = ['scalp', 'swing'].flatMap(hz => Object.keys(C.HG_GOLD_SETUP_EDGE[hz])
    .filter(k => C.HG_GOLD_SETUP_EDGE[hz][k] && C.HG_GOLD_SETUP_EDGE[hz][k].action === 'prefer')
    .map(k => hz.toUpperCase() + ':' + k)).sort().join(',');
  assert(replayKeys === expReplay && expReplay.length > 0,
         'replay-prefer entries = EXACTLY the live W.HG_GOLD_SETUP_EDGE prefer rows (' + replayKeys + ')');
  const wkRow = C.HG_GOLD_SETUP_EDGE.swing.weekly;
  const psWk = ps.find(e => e.source === 'replay-prefer' && e.key === 'weekly' && e.horizon === 'SWING');
  assert(!!psWk && psWk.n === wkRow.n && psWk.net === wkRow.net && psWk.gross === wkRow.gross,
         'a replay-prefer entry carries the row\'s OWN n/gross/net — read, never retyped');
  assert(ps.some(e => e.source === 'omnigold-prefer' && e.key === 'BOS-RETEST' && e.horizon === 'SWING'),
         'hgOgSwingPrefer contribution present, tagged omnigold-prefer');
  assert(ps.some(e => e.source === 'live-paid' && e.key === 'GOLD-SWING-LEDGERKID' && e.tab === 'GOLDDIRECTION'),
         'hgFwdPaidKinds contribution present, tagged live-paid with its ledger tab');
  assert(ps.filter(e => e.source === 'live-paid').length === 1,
         'no live-paid entry fabricated for pools whose stub answered empty');
  assert(paidCalls.includes('GOLDDIRECTION') && paidCalls.includes('OMNIGOLD:SCALP') && paidCalls.includes('OMNIGOLD:SWING'),
         'hgFwdPaidKinds consulted for GOLDDIRECTION + both OMNIGOLD horizon pools');

  /* crowning: proven-only — the higher-confScore UNPROVEN card never crowns */
  assert(!!snap.swing.pick && snap.swing.pick.stratKey === 'weekly',
         'crowned = first PROVEN lead-eligible (weekly), not the higher-confScore unproven card');
  assert(snap.swing.crownedProven === true, 'crownedProven flag true on the crowned horizon');
  assert(snap.swing.pick.provenBy && snap.swing.pick.provenBy.source === 'replay-prefer',
         'the pick carries its proving entry with the source named');
  assert(Array.isArray(snap.swing.unproven) && snap.swing.unproven.some(u => u.stratKey === 'mystery'),
         'the lead-eligible UNPROVEN candidate lands on unproven[], never crowned');
  assert(Object.isFrozen(snap.swing.unproven), 'unproven[] deep-frozen with the snapshot');

  const html6 = M.stubs['#gdCards'].innerHTML;
  assert(html6.indexOf('MEASURED RECORD') >= 0, 'crowned card carries a MEASURED RECORD line');
  assert(html6.indexOf('n=' + wkRow.n) >= 0,
         'the printed n= comes from the SAME table row that proved the pick (n=' + wkRow.n + ')');
  assert(html6.indexOf('NOT MEASURED-PROVEN — paints, not crowned') >= 0,
         'clearly-headed NOT MEASURED-PROVEN list rendered');
  assert(html6.indexOf('UNPROVEN THING') >= 0, 'the unproven candidate still paints as a full card');
  assert((html6.match(/gdx-banner-in/g) || []).length === 1,
         'exactly ONE execution banner — the unproven list gets no banner treatment');
  assert(html6.indexOf('Direction confirmed: LONG — every setup below is LONG-only.') >= 0,
         'board header states the confirmed direction');
  assert(html6.indexOf('100%') < 0, 'rendered scan HTML never claims 100%');

  /* live-paid un-gating: the ledger-blessed kind becomes crownable */
  C.goldSwingSetups = () => ({ ranked: [{ dir: 'long', strategy: 'LEDGER KID', stratKey: 'ledgerkid',
    entry: 2320, stop: 2300, t1: 2360, t2: 2380, rr: 2, rr2: 3, confScore: 40, stamps: [], gateNotes: [] }], rejected: [] });
  C.hgOgEvaluate = () => [];
  const r2 = await tab.refresh();
  assert(r2 === 'refreshed', 'live-paid re-scan completes (got "' + r2 + '")');
  const snap2 = C.goldDirectionScan();
  assert(!!snap2.swing.pick && snap2.swing.pick.stratKey === 'ledgerkid'
      && snap2.swing.pick.provenBy && snap2.swing.pick.provenBy.source === 'live-paid',
         'live forward-ledger proof UN-GATES a kind beyond the tables — crowned, tagged live-paid');
  const html6b = M.stubs['#gdCards'].innerHTML;
  assert(/HAS PAID at the family-wise bar/.test(html6b), 'live-paid measured line names the ledger read');
  assert(html6b.indexOf('21 settled') >= 0 && html6b.indexOf('13 paid') >= 0 && html6b.indexOf('+0.31R/trade') >= 0,
         'live-paid stats printed are the hgFwdPool numbers, read at render');
  Date.now = realDateNow;
  delete globalThis.localStorage;
}

/* =========================================================================
   7) hg-v702: explicit direction confirmation
========================================================================= */
console.log('== 7) hg-v702: explicit direction confirmation ==');
{
  const ls = memLocalStorage();
  ls._map['hg_golddir_side'] = 'long';   /* persisted from a "previous session" */
  globalThis.localStorage = ls;
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const C = globalThis.window;
  const realDateNow = Date.now;
  Date.now = () => PINNED;
  const t0 = Date.UTC(2024, 0, 1) / 1000;
  const rows = []; for (let i = 0; i < 80; i++){ const o = 2300 + i, c = o + 0.5; rows.push({ t: t0 + i * 3600, o, h: c + 1, l: o - 1, c, v: 1000 }); }
  C.getGoldCandles = async () => ({ rows: rows.map(r => ({ ...r })), source: 'seed' });
  C.HG_GOLD_SETUP_EDGE = { scalp: {}, swing: { stub: { n: 77, gross: 0.4, net: 0.3, action: 'prefer',
    why: 'stub prefer row (hg-v702 test)' } } };
  C.goldSwingSetups = () => ({ ranked: [{ dir: 'long', strategy: 'STUB PROVEN', stratKey: 'stub',
    entry: 2300, stop: 2280, t1: 2340, t2: 2360, rr: 2, rr2: 3, stamps: [], gateNotes: [] }], rejected: [] });

  const tab = C.HG_tabs.find(t => t.id === 'golddirection');
  const warm = (C.HG_warmups || []).find(t => t.id === 'golddirection');
  const M = freshPane();
  tab.mount(M.pane);
  assert(M.pane._html.indexOf('CONFIRM &amp; SCAN') >= 0, 'the scan button reads CONFIRM & SCAN');
  assert(/CONFIRM & SCAN/.test(M.stubs['#gdStat'].textContent) && /saved/i.test(M.stubs['#gdStat'].textContent),
         'persisted side restored ARMED with the confirm-required hint');
  assert(M.stubs['#gdRun'].disabled === false, 'button enabled — the armed side awaits the user\'s own click');

  /* a persisted side NEVER scans without a this-session confirm */
  const w0 = await warm.run();
  assert(/^unavailable: direction not confirmed this session/.test(w0),
         'warm-up refuses to scan a persisted side without this session\'s confirm (got "' + w0 + '")');
  const rf0 = await tab.refresh();
  assert(rf0 === 'skipped: not run yet', 'refresh still never triggers a first-time scan');
  assert(C.goldDirectionScan() === null, 'no snapshot published before the user confirms');

  /* the user's CONFIRM & SCAN click IS the confirmation */
  const r1 = await M.stubs['#gdRun']._handler();
  assert(r1 === 'refreshed', 'the confirm click runs the scan (got "' + r1 + '")');
  const html1 = M.stubs['#gdCards'].innerHTML;
  assert(html1.indexOf('Direction confirmed: LONG — every setup below is LONG-only.') >= 0,
         'board header states the confirmed LONG direction');
  assert(html1.indexOf('n=77') >= 0, 'crowned card prints the stub row\'s own n=77');
  assert(!!C.goldDirectionScan() && C.goldDirectionScan().side === 'long', 'snapshot published for the confirmed scan');

  /* SWITCHING sides clears results + snapshots and demands a fresh confirm */
  M.stubs['#gdShort']._handler();
  assert(M.stubs['#gdCards'].innerHTML === '', 'side switch CLEARS rendered results — no stale LONG cards remain');
  assert(C.goldDirectionScan() === null && C.goldDirectionState() === null,
         'side switch clears the published snapshots — no stale other-side picks');
  assert(/Direction armed: SHORT — press CONFIRM & SCAN/.test(M.stubs['#gdStat'].textContent),
         'switch re-arms and asks for a fresh confirm');
  const rf1 = await tab.refresh();
  assert(rf1 === 'skipped: direction not confirmed this session',
         'refresh after a side switch refuses to scan until re-confirmed (got "' + rf1 + '")');
  const w1 = await warm.run();
  assert(/^unavailable: direction not confirmed this session/.test(w1),
         'warm-up refuses after a side switch too (got "' + w1 + '")');

  const r2 = await M.stubs['#gdRun']._handler();
  assert(r2 === 'refreshed', 'the re-confirm click scans the switched side (got "' + r2 + '")');
  const snap7 = C.goldDirectionScan();
  assert(snap7.side === 'short', 'the switched side scans as SHORT — never inferred, never flipped');
  const html2 = M.stubs['#gdCards'].innerHTML;
  assert(html2.indexOf('Direction confirmed: SHORT — every setup below is SHORT-only.') >= 0,
         'board header states the confirmed SHORT direction');
  assert(html2.indexOf('<div class="gdx-card') < 0 && snap7.swing.otherSide >= 1,
         'no LONG card survives on the confirmed SHORT board — other side counted only');

  /* ---- hg-v702 audit fatal closed: a side switch WHILE a scan is in
     flight discards that scan whole — the stale async scan must never
     repaint the board the switch just cleared, republish the old-side
     snapshots, or record its picks to the ledger. ---- */
  {
    let release; let gate = new Promise(res => { release = res; });
    C.getGoldCandles = async () => { await gate; return { rows: rows.map(r => ({ ...r })), source: 'seed' }; };
    const fwdRace = [];
    C.hgFwdRecordScan = (tabName, tf, rws) => { fwdRace.push(rws); return rws.length; };
    M.stubs['#gdLong']._handler();                     /* arm LONG */
    const inFlight = M.stubs['#gdRun']._handler();     /* confirm LONG; scan blocks on feeds */
    await new Promise(res => setTimeout(res, 0));      /* let it reach the feed await */
    M.stubs['#gdShort']._handler();                    /* the user switches mid-flight */
    assert(M.stubs['#gdCards'].innerHTML === '', 'mid-flight switch clears the board immediately');
    release();
    const rRace = await inFlight;
    assert(rRace === 'skipped: side switched mid-scan',
           'the in-flight scan discards itself on a mid-flight switch (got "' + rRace + '")');
    assert(M.stubs['#gdCards'].innerHTML === '',
           'RACE: the stale LONG scan never repaints the cleared board');
    assert(C.goldDirectionScan() === null && C.goldDirectionState() === null,
           'RACE: no old-side snapshot is republished by the discarded scan');
    assert(fwdRace.length === 0, 'RACE: the discarded scan records nothing to the forward ledger');
    assert(/side switched mid-scan/.test(M.stubs['#gdStat'].textContent)
        && /SHORT/.test(M.stubs['#gdStat'].textContent),
           'stat names the discard and the newly armed side');
    /* the fresh confirm still scans the new side normally */
    const rAfter = await M.stubs['#gdRun']._handler();
    assert(rAfter === 'refreshed', 'a fresh CONFIRM & SCAN after the discarded scan runs (got "' + rAfter + '")');
    assert(C.goldDirectionScan() && C.goldDirectionScan().side === 'short',
           'the post-discard scan publishes the NEW side');
  }
  Date.now = realDateNow;
  delete globalThis.localStorage;
}

console.log('== 8) hg-v702 audit closeout: live-paid proof is CADENCE-SCOPED ==');
/* A kind that has paid ONLY on the OMNIGOLD:SCALP (1h) ledger must not crown
   a 4h SWING candidate — omnigold.js's HG_OG_SWING_PREFER comment warns the
   same names lose across cadence in the reverse direction. GOLDDIRECTION's
   own ledger entries stay unscoped (they are recorded per horizon-tagged
   mechanic name and match by that exact name). */
{
  const ls = memLocalStorage();
  globalThis.localStorage = ls;
  globalThis.window = {};
  vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' });
  vm.runInThisContext(fs.readFileSync(root + 'golddirection.js', 'utf8'), { filename: 'golddirection.js' });
  const C = globalThis.window;
  const realDateNow = Date.now;
  Date.now = () => PINNED;
  const t0 = Math.floor((PINNED - 90 * 86400 * 1000) / 1000);
  const rows1h = []; for (let i = 0; i < 300; i++){ const o = 2300 + i * 0.3, c2 = o + 0.2; rows1h.push({ t: t0 + i * 3600, o, h: c2 + 0.5, l: o - 0.5, c: c2, v: 2000 }); }
  const rows4h = []; for (let i = 0; i < 80; i++){ const o = 2300 + i * 1.5, c2 = o + 1.2; rows4h.push({ t: t0 + i * 14400, o, h: c2 + 1, l: o - 1, c: c2, v: 3000 }); }
  const rows15 = []; const t15 = Math.floor(PINNED / 1000) - 300 * 900;
  for (let i = 0; i < 300; i++){ const o = 2305 + (i % 7) * 0.4, c2 = o + 0.3; rows15.push({ t: t15 + i * 900, o, h: c2 + 0.5, l: o - 0.5, c: c2, v: 1200 }); }
  C.getGoldCandles = async (tf) => (tf === '1h') ? { rows: rows1h.map(r => ({ ...r })), source: 'seed' }
    : (tf === '4h') ? { rows: rows4h.map(r => ({ ...r })), source: 'seed' }
    : (tf === '15m') ? { rows: rows15.map(r => ({ ...r })), source: 'seed' }
    : { rows: [], source: 'seed' };
  /* the kind is paid ONLY on the OMNIGOLD:SCALP ledger */
  C.hgFwdPaidKinds = (tab) => tab === 'OMNIGOLD:SCALP' ? ['LEDGER-ONLY-KIND'] : [];
  C.hgFwdPool = (tab) => tab === 'OMNIGOLD:SCALP' ? { 'LEDGER-ONLY-KIND': { samples: 25, wins: 14, expR: 0.2 } } : {};
  /* same-named lead-eligible candidates on BOTH horizons via the swing/scalp engines */
  C.goldSwingSetups = () => ({ ranked: [{ dir: 'long', strategy: 'LEDGER-ONLY-KIND', stratKey: 'LEDGER-ONLY-KIND',
    entry: 2310, stop: 2290, t1: 2350, t2: 2370, rr: 2, rr2: 3, confScore: 80, stamps: [], gateNotes: [] }], rejected: [] });
  C.goldScalpSetups = () => { const a = [{ dir: 'long', strategy: 'LEDGER-ONLY-KIND', stratKey: 'LEDGER-ONLY-KIND',
    entry: 2310, stop: 2300, t1: 2330, t2: 2345, rr: 2, rr2: 3.5, confScore: 80, stamps: [], gateNotes: [], atr: 6 }]; a.rejected = []; return a; };
  C.goldRankSetups = (cands) => ({ ranked: cands, best: cands[0] || null, rejected: [] });
  C.hgGoldPlanSidesOk = () => ({ ok: true });
  const tab8 = C.HG_tabs.find(t => t.id === 'golddirection');
  const M8 = freshPane();
  tab8.mount(M8.pane);
  M8.stubs['#gdLong']._handler();
  const r8 = await M8.stubs['#gdRun']._handler();
  assert(r8 === 'refreshed', 'cadence-scope scan completes (got "' + r8 + '")');
  const s8 = C.goldDirectionScan();
  assert(!!(s8.scalp.pick && s8.scalp.pick.provenBy && s8.scalp.pick.provenBy.source === 'live-paid'
      && s8.scalp.pick.provenBy.tab === 'OMNIGOLD:SCALP'),
         'SCALP candidate IS crowned by the OMNIGOLD:SCALP live-paid proof (matching cadence)');
  assert(!s8.swing.pick && Array.isArray(s8.swing.unproven)
      && s8.swing.unproven.some(u => u.stratKey === 'LEDGER-ONLY-KIND'),
         'the same-named 4h SWING candidate is NOT crowned by scalp-cadence proof — lands on unproven[] (hg-v702 closeout)');
  Date.now = realDateNow;
  delete globalThis.localStorage;
}

console.log('\n' + pass + ' assertions passed' + (fail ? (', ' + fail + ' FAILED') : ''));
if (fail) process.exit(1);
