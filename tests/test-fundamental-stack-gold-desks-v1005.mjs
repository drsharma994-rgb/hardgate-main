/* HARDGATE — hg-v1005: EVERY GOLD SETUP TAB ANSWERS TO THE COMBINED STACK.

   hg-v1003 built the house fundamental stack (fundamental-stack.js);
   hg-v1004 proved the leadership pass on GOLD SCALP. v1005 carries the
   SAME combined fundamental + sentiment + positioning gate to every gold
   tab that forms setups — one definition (hgFundamentalScanCands /
   hgFundamentalBlackout), eleven desks, zero drift:

     GOLD SWING ... blackout locks NEW conviction minting; the demote pass
                    runs at leadership; panel beside every outcome.
     SUPER GOLD ... sgFundBlocked: a refused/demoted row is skipped in
                    every pick loop; a blackout idles the desk.
     GOLD ULTRA ... selectSetups stamps fundGate, demotes at leadership,
                    and crowns NOTHING in a checked blackout.
     OPTI GOLD .... ogFundBlocked keeps a refused/demoted setup out of both
                    TOP PICK slots.
     GOLD PINE .... sortSetups sinks a demoted row below every clean one;
                    a blackout stands the whole scan down.
     NEW GOLD ..... ngFundBlockedRec keeps a refused/demoted fire off the
                    ticket flag and the TRADABLE word.
     TAURIC ....... the verdict card carries the gate's note; the board
                    paints at mount/preflight/run.
     GOLD DIRECTION  the aggregator crowns nothing in a blackout (the
                    guard lives in selectHorizon), demotes at leadership
                    on the merged five-engine board, and renders the panel
                    beside every scan.
     GOLDCOINT / GOLD SPOT / MILLI GOLD — context boards: the full gold
                    fundamental panel beside the readout (MILLI GOLD also
                    chips each card from OMNIGOLD's own stamped verdict).

   Harness: classic scripts via vm.runInThisContext with globalThis.window
   = {} (the tests/test-goldscalp-fundamental-v1004.mjs pattern). Behavior
   is driven through the REAL seams (registration props, the desks' own
   exported test seams); the few lines a headless harness cannot reach are
   source-pinned so they cannot silently vanish.

   Run: node tests/test-fundamental-stack-gold-desks-v1005.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}
function read(f){ return fs.readFileSync(path.join(root, f), 'utf8'); }
function loadInto(files){
  for (const f of files) vm.runInThisContext(read(f), { filename: f });
}
/* a fresh window per group — desks register into HG_tabs on it */
function boot(files){
  globalThis.window = {};
  const W = globalThis.window;
  loadInto(['fundamental-stack.js'].concat(files));
  return W;
}
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
  return { pane, stubs };
}

/* ---------------- the boards (test-goldscalp-fundamental-v1004.mjs shapes) ---------------- */
/* two checked BEAR votes for gold: real-rate HEADWIND + COT crowded long */
function hostileLongBoard(W){
  W.getGoldMacroCached = function(){ return { realRateHint: 'HEADWIND', dxy: { value: 106.1, trend20: 'RISING' }, tnxTrend: 'RISING' }; };
  W.__hgGoldCot = { crowding: 'SPEC CROWDED LONG', zScore: 2.6, reportDate: Date.now() };
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [] }; };
}
/* two checked BULL votes: real-rate TAILWIND + COT crowded short */
function tailwindLongBoard(W){
  W.getGoldMacroCached = function(){ return { realRateHint: 'TAILWIND', dxy: { value: 100.4, trend20: 'FALLING' }, tnxTrend: 'FALLING' }; };
  W.__hgGoldCot = { crowding: 'SPEC CROWDED SHORT', zScore: -2.4, reportDate: Date.now() };
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [] }; };
}
/* a CHECKED red-folder window (the news leg alone decides it) */
function blackoutBoard(W){
  W.getGoldMacroCached = function(){ return { realRateHint: 'NEUTRAL', dxy: { value: 104.2, trend20: 'FLAT' }, tnxTrend: 'FLAT' }; };
  W.__hgGoldCot = { crowding: 'NEUTRAL', zScore: 0.3, reportDate: Date.now() };
  W.hgNewsRisk = function(){ return { risk: 'high', blackout: true, events: [{ name: 'US CPI' }] }; };
}
function darkBoard(W){
  delete W.getGoldMacroCached; delete W.__hgGoldCot; delete W.hgNewsRisk; delete W.S;
}
function regOf(W, id){ return (W.HG_tabs || []).filter(t => t && t.id === id)[0] || null; }

/* =========================================================================
   1) THE SEAM SWEEP — every gold desk carries the stack on its registration
      (the hg-v967 route) or as a named test seam
========================================================================= */
console.log('== 1) seam sweep — every gold desk ==');
{
  const W = boot(['goldscalp.js', 'goldswing.js', 'super-gold.js', 'goldultra.js',
                  'optigold.js', 'goldpine.js', 'newgold.js', 'tauric.js',
                  'golddirection.js', 'goldcoint.js', 'goldspot.js', 'milligold.js']);

  const gs = regOf(W, 'goldscalp');
  ok(gs && typeof gs.fundamentalScan === 'function' && typeof gs.fundPanelHtml === 'function',
    'GOLD SCALP registration carries fundamentalScan + fundPanelHtml (v1004)');
  const gw = regOf(W, 'goldswing');
  ok(gw && typeof gw.fundamentalScan === 'function' && typeof gw.fundPanelHtml === 'function',
    'GOLD SWING registration carries fundamentalScan + fundPanelHtml');
  ok(typeof W.sgFundBlocked === 'function' && typeof W.superGoldEvaluate === 'function',
    'SUPER GOLD exports sgFundBlocked + superGoldEvaluate (its test seams)');
  const gu = regOf(W, 'goldultra');
  ok(gu && typeof gu.fundPanelHtml === 'function' && typeof W.goldUltraSelectSetups === 'function',
    'GOLD ULTRA registration carries fundPanelHtml; selectSetups is the exported pure seam');
  const og = regOf(W, 'optigold');
  ok(og && typeof og.fundBlocked === 'function' && typeof og.fundPanelHtml === 'function'
      && typeof W.__ogFundBlocked === 'function' && typeof W.__ogTopPicks === 'function',
    'OPTI GOLD registration carries fundBlocked + fundPanelHtml; __ogTopPicks drivable');
  const gp = regOf(W, 'goldpine');
  ok(gp && typeof gp.fundamentalChip === 'function' && typeof gp.fundPanelHtml === 'function'
      && typeof W.topProbSetups === 'function',
    'GOLD PINE registration carries fundamentalChip + fundPanelHtml; topProbSetups drivable');
  const ng = regOf(W, 'newgold');
  ok(ng && typeof ng.fundamentalGate === 'function' && typeof ng.fundBlocked === 'function'
      && typeof ng.fundamentalChip === 'function' && typeof ng.fundPanelHtml === 'function',
    'NEW GOLD registration carries fundamentalGate + fundBlocked + fundamentalChip + fundPanelHtml');
  const ta = regOf(W, 'tauric');
  ok(ta && typeof ta.fundamentalGate === 'function' && typeof ta.fundPanelHtml === 'function',
    'TAURIC registration carries fundamentalGate + fundPanelHtml');
  const gd = regOf(W, 'golddirection');
  ok(gd && typeof gd.fundPanelHtml === 'function' && typeof gd.fundamentalBlackout === 'function',
    'GOLD DIRECTION registration carries fundPanelHtml + fundamentalBlackout');
  const gc = regOf(W, 'goldcoint'), gsp = regOf(W, 'goldspot'), mg = regOf(W, 'milligold');
  ok(gc && typeof gc.fundPanelHtml === 'function', 'GOLD COINT registration carries fundPanelHtml');
  ok(gsp && typeof gsp.fundPanelHtml === 'function', 'GOLD SPOT registration carries fundPanelHtml');
  ok(mg && typeof mg.fundPanelHtml === 'function' && typeof mg.fundamentalBlackout === 'function',
    'MILLI GOLD registration carries fundPanelHtml + fundamentalBlackout');
}

/* =========================================================================
   2) THE PANELS — every desk renders the ONE shared gold board
========================================================================= */
console.log('\n== 2) the panels render the one shared board ==');
{
  const W = boot(['goldscalp.js', 'goldswing.js', 'goldultra.js', 'optigold.js', 'goldpine.js',
                  'newgold.js', 'tauric.js', 'golddirection.js', 'goldcoint.js', 'goldspot.js', 'milligold.js']);
  hostileLongBoard(W);
  const ids = ['goldscalp', 'goldswing', 'goldultra', 'optigold', 'goldpine', 'newgold',
               'tauric', 'golddirection', 'goldcoint', 'goldspot', 'milligold'];
  for (const id of ids){
    const reg = regOf(W, id);
    const html = reg.fundPanelHtml();
    ok(typeof html === 'string' && html.indexOf('FUNDAMENTAL REGIME') >= 0 && html.indexOf('REAL RATES') >= 0
        && html.indexOf('CFTC COT') >= 0 && html.indexOf('EVENT RISK') >= 0,
      id + ' renders the full gold board (regime + real rates + COT + calendar)');
  }
  blackoutBoard(W);
  ok(regOf(W, 'golddirection').fundPanelHtml().indexOf('EVENT BLACKOUT') >= 0,
    'the panel names a live blackout (GOLD DIRECTION read)');
  darkBoard(W);
  const darkHtml = regOf(W, 'goldswing').fundPanelHtml();
  ok(typeof darkHtml === 'string' && darkHtml.indexOf('FUNDAMENTAL REGIME') >= 0,
    'a dark board still renders — every leg honestly UNCHECKED, never a fake neutral');
}

/* =========================================================================
   3) GOLD SWING — the demote pass at leadership, through the registration
========================================================================= */
console.log('\n== 3) GOLD SWING behavior ==');
{
  const W = boot(['goldswing.js']);
  const reg = regOf(W, 'goldswing');
  const cand = (dir) => ({ sym: 'XAUUSD', dir: dir, strategy: 'TEST SWING', venue: 'TEST',
                           entry: 2400, stop: 2390, t1: 2420, t2: 2430 });
  hostileLongBoard(W);
  const c = cand('long');
  const res = reg.fundamentalScan([c]);
  ok(res.demoted === 1 && c.demoted === true && c.stamps.indexOf('FUNDAMENTAL HEADWIND') >= 0,
    'a 2v0 checked headwind demotes the long (stamped, reason named) — it can never lead');
  ok(/fundamental headwind 2v0/i.test((c.gateNotes || []).join(' ')), 'the gate note names the decisive split');
  ok(c.fundGate && c.fundGate.demote === true && c.fundGate.chips.join(' ').indexOf('FUNDAMENTAL HEADWIND') >= 0,
    'the compact fundGate verdict rides the candidate');
  const s = cand('short');
  const res2 = reg.fundamentalScan([s]);
  ok(res2.demoted === 0 && s.demoted !== true && s.fundGate && /TAILWIND/.test(s.fundGate.chips.join(' ')),
    'the same board is a TAILWIND for the short — chips, never a demote');
  darkBoard(W);
  const d = cand('long');
  const res3 = reg.fundamentalScan([d]);
  ok(res3.demoted === 0 && res3.gated === 0 && d.demoted !== true && !d.fundGate,
    'a dark board touches nothing — unchecked is not a veto');
}

/* =========================================================================
   4) SUPER GOLD — sgFundBlocked + the blackout idle
========================================================================= */
console.log('\n== 4) SUPER GOLD behavior ==');
{
  const W = boot(['super-gold.js']);
  ok(W.sgFundBlocked({ fund: { refuse: true, demote: false } }) === true
      && W.sgFundBlocked({ fund: { refuse: false, demote: true } }) === true
      && W.sgFundBlocked({ fund: { refuse: false, demote: false } }) === false
      && W.sgFundBlocked({}) === false && W.sgFundBlocked(null) === false,
    'sgFundBlocked: refuse OR demote blocks; anything else passes; junk is safe');
  blackoutBoard(W);
  const ev = W.superGoldEvaluate(W);
  ok(ev && ev.ready === false && ev.idle === true && /EVENT BLACKOUT/.test(ev.reason || ''),
    'a checked blackout idles the desk with the window named — no fresh setup forms');
  darkBoard(W);
  const ev2 = W.superGoldEvaluate(W);
  ok(ev2 && ev2.idle === true && !/EVENT BLACKOUT/.test(ev2.reason || ''),
    'a dark board never cries blackout — the ordinary no-setup idle stands (got "' + (ev2 && ev2.reason) + '")');
  const src = read('super-gold.js');
  ok(/hits\[i\] && hits\[i\]\.minimalLossPass && !sgFundBlocked\(hits\[i\]\)/.test(src)
      && /hits\[i\] && hits\[i\]\.tier === 'clean' && !sgFundBlocked\(hits\[i\]\)/.test(src)
      && /snap\.cands\[i\] && !sgFundBlocked\(snap\.cands\[i\]\)/.test(src),
    'source pin: every SUPER GOLD pick loop (live + snapshot) skips the fund-blocked');
}

/* =========================================================================
   5) GOLD ULTRA — selectSetups: demote at leadership, blackout crowns nothing
========================================================================= */
console.log('\n== 5) GOLD ULTRA behavior ==');
{
  const W = boot(['goldultra.js']);
  /* a crownable card: prefer-book stratKey + AGAINST the consensus lead */
  W.HG_GOLD_SETUP_EDGE = { scalp: { p6fail: { action: 'prefer', n: 37, net: 0.36 } }, swing: {} };
  const mkCard = (dir) => ({ source: 'GOLD SCALP', strategy: 'S30 FAILED-BREAK REVERSAL', stratKey: 'p6fail',
                             dir: dir, entry: 2400, stop: 2390, t1: 2420, t2: 2430, rr: 2 });
  const againstCount = { decisive: 30, pct: 0.7, lead: 'short' };   /* long card AGAINST the lead */

  darkBoard(W);
  const ctl = W.goldUltraSelectSetups([mkCard('long')], againstCount);
  ok(ctl.pick && ctl.pick.stratKey === 'p6fail' && ctl.fundBlackout === false,
    'control: a crownable prefer row IS crowned on a dark board (the stack refuses nothing it cannot read)');

  hostileLongBoard(W);
  const hos = W.goldUltraSelectSetups([mkCard('long')], againstCount);
  ok(hos.pick === null && hos.cards.length === 1 && hos.cards[0].demoted === true
      && hos.cards[0].stamps.indexOf('FUNDAMENTAL HEADWIND') >= 0,
    'a 2v0 checked headwind demotes the card — the crown rule already refuses a demoted row');
  ok(hos.cards[0].fundGate && hos.cards[0].fundGate.demote === true,
    'the compact fundGate verdict stays on the card for the verdict chip');

  blackoutBoard(W);
  const blo = W.goldUltraSelectSetups([mkCard('long')], againstCount);
  ok(blo.fundBlackout === true && blo.pick === null && blo.cards.length === 1
      && blo.cards[0].crownable === true,
    'a checked blackout crowns NOTHING — the card stays crownable on the board, the crown is withheld');
  ok(blo.cards[0].fundGate && blo.cards[0].fundGate.refuse === true,
    'every card wears EVENT BLACKOUT (the gate checks the window before direction)');
}

/* =========================================================================
   6) OPTI GOLD — a fund-blocked setup never takes a TOP PICK slot
========================================================================= */
console.log('\n== 6) OPTI GOLD behavior ==');
{
  const W = boot(['optigold.js']);
  const reg = regOf(W, 'optigold');
  ok(reg.fundBlocked({ fundGate: { refuse: true } }) === true
      && reg.fundBlocked({ fundGate: { demote: true } }) === true
      && reg.fundBlocked({ fundGate: { refuse: false, demote: false } }) === false
      && reg.fundBlocked({}) === false && reg.fundBlocked(null) === false,
    'ogFundBlocked: refuse OR demote blocks; junk safe (registration and export agree)');
  const mk = (lane, entry, extra) => Object.assign(
    { state: 'waiting', lane: lane, dir: 'long', entry: entry, stop: entry - 5,
      t1: entry + 10, risk: 5, rr: 2, atr: 2, barsLeft: 30 }, extra || {});
  const blocked = mk('scalp', 99, { fundGate: { refuse: true, demote: false, chips: ['EVENT BLACKOUT'] } });
  const clean = mk('scalp', 99.5, {});
  const picks = W.__ogTopPicks([blocked, clean], 100);
  ok(picks.scalp && picks.scalp.setup === clean,
    'a refused setup never occupies the TOP PICK slot — the clean row takes it');
  const onlyBlocked = W.__ogTopPicks([blocked], 100);
  ok(onlyBlocked.scalp === null,
    'a lane whose only setup is fund-blocked has NO pick — never the blocked one');
}

/* =========================================================================
   7) GOLD PINE — the demote-sink comparator + the blackout stand-down pin
========================================================================= */
console.log('\n== 7) GOLD PINE behavior ==');
{
  const W = boot(['goldpine.js']);
  const reg = regOf(W, 'goldpine');
  const strong = { strategy: 'STRONG BUT DEMOTED', dir: 'long', score: 100, maxScore: 100,
                   isNew: true, tier: 'primary', grade: 'A+', rr: 4, familyCount: 3,
                   demoted: true, stamps: ['FUNDAMENTAL HEADWIND'] };
  const weak = { strategy: 'WEAK BUT CLEAN', dir: 'long', score: 10, maxScore: 100,
                 isNew: false, tier: 'native', grade: 'C', rr: 1, familyCount: 0 };
  const top = W.topProbSetups([strong, weak], 2);
  ok(top[0] === weak && top[1] === strong,
    'sortSetups sinks a demoted row below EVERY clean one — before any probability comparison');
  const chip = reg.fundamentalChip({ fundGate: { refuse: false, demote: true, chips: ['FUNDAMENTAL HEADWIND 2v0'],
                                                 asset: 'gold', regime: { bulls: 0, bears: 2, checked: 2 } } });
  ok(typeof chip === 'string' && chip.indexOf('FUNDAMENTAL HEADWIND 2v0') >= 0,
    'the card chip paints the stamped verdict');
  const src = read('goldpine.js');
  ok(/fundBlackout: true, fundStoodDown:/.test(src),
    'source pin: a checked blackout stands the whole scan down (empty lanes, count named)');
  ok(/hgFundamentalScanCands'\);\s*\n\s*fsFn\(swing/.test(src) || /fsFn\(swing, \{ scanner: 'goldpine' \}\)/.test(src),
    'source pin: the shared pass runs on both lanes before the re-sort');
}

/* =========================================================================
   8) NEW GOLD — the ticket flag and the TRADABLE word answer to the stack
========================================================================= */
console.log('\n== 8) NEW GOLD behavior ==');
{
  const W = boot(['newgold.js']);
  const reg = regOf(W, 'newgold');
  ok(reg.fundBlocked({ fund: { refuse: true } }) === true
      && reg.fundBlocked({ fund: { demote: true } }) === true
      && reg.fundBlocked({ fund: { refuse: false, demote: false } }) === false
      && reg.fundBlocked({}) === false,
    'ngFundBlockedRec: refuse OR demote on the recorded verdict blocks; anything else passes');
  hostileLongBoard(W);
  const g1 = reg.fundamentalGate('long');
  ok(g1 && g1.demote === true && /2v0/.test(g1.chips.join(' ')),
    'fundamentalGate(long) on a 2v0 bear board demotes');
  const g2 = reg.fundamentalGate('short');
  ok(g2 && g2.demote !== true && /TAILWIND/.test(g2.chips.join(' ')),
    'fundamentalGate(short) on the same board is a tailwind — chips only');
  blackoutBoard(W);
  const g3 = reg.fundamentalGate('long');
  ok(g3 && g3.refuse === true && /EVENT BLACKOUT/.test(g3.chips.join(' ')),
    'a checked blackout refuses — before direction is even read');
  darkBoard(W);
  const g4 = reg.fundamentalGate('long');
  ok(g4 && g4.refuse !== true && g4.demote !== true,
    'a dark board neither refuses nor demotes');
  const src = read('newgold.js');
  ok(/!ngFundBlockedRec\(r\)/.test(src),
    'source pin: the ticket flag and the TRADABLE word both AND the fund predicate');
}

/* =========================================================================
   9) TAURIC — the verdict card answers to the gate
========================================================================= */
console.log('\n== 9) TAURIC behavior ==');
{
  const W = boot(['tauric.js']);
  const reg = regOf(W, 'tauric');
  hostileLongBoard(W);
  const g1 = reg.fundamentalGate('long');
  ok(g1 && g1.demote === true, 'fundamentalGate(long) demotes on a 2v0 bear board');
  blackoutBoard(W);
  const g2 = reg.fundamentalGate('short');
  ok(g2 && g2.refuse === true, 'a checked blackout refuses in either direction');
  darkBoard(W);
  const g3 = reg.fundamentalGate('long');
  ok(g3 && g3.refuse !== true && g3.demote !== true, 'a dark board speaks not at all');
  const src = read('tauric.js');
  ok(/hgTauricFundNote/.test(src) && /paintTauricFund/.test(src),
    'source pin: the fund note rides the verdict card and the board repaints at mount/preflight/run');
}

/* =========================================================================
   10) GOLD DIRECTION — the crown itself answers to the stack (full drive)
========================================================================= */
console.log('\n== 10) GOLD DIRECTION — the full crown drive ==');
{
  const PIN = Date.UTC(2024, 0, 16, 14, 30, 0);
  const rows5 = [];
  for (let i = 0; i < 5; i++){
    rows5.push({ t: Math.floor(PIN / 1000) - (5 - i) * 900, o: 2290 + i, h: 2292 + i, l: 2289 + i, c: 2291 + i, v: 100 });
  }
  const mkCand = () => ({ id: 'stub|long|1', dir: 'long', stratKey: 'p6fail',
    strategy: 'S30 FAILED-BREAK REVERSAL', entry: 2400, stop: 2390, t1: 2420, t2: 2430,
    rr: 2, grade: 'A', tally: 8, agree: 4, atr: 6, demoted: false, vetoed: false, stamps: [] });

  async function drive(boardFn, label){
    globalThis.localStorage = memLocalStorage();
    globalThis.window = {};
    const C = globalThis.window;
    loadInto(['fundamental-stack.js', 'golddirection.js']);
    boardFn(C);
    C.getGoldCandles = async (tf) => (tf === '15m')
      ? { rows: rows5.map(r => ({ ...r })), source: 'binance-xau' }
      : { rows: [], source: 'binance-xau' };
    C.goldScalpSetups = () => { const a = [mkCand()]; a.rejected = []; return a; };
    C.goldRankSetups = (cands) => ({ ranked: cands, best: cands[0] || null, rejected: [] });
    C.hgGoldPlanSidesOk = () => ({ ok: true });
    /* the measured-proven row that lets the crown fall at all */
    C.HG_GOLD_SETUP_EDGE = { scalp: { p6fail: { action: 'prefer', n: 37, gross: 0.36, net: 0.36, why: 'test row' } }, swing: {} };
    let fwdCalls = 0;
    C.hgFwdRecordScan = function(){ fwdCalls++; };
    const tab = regOf(C, 'golddirection');
    const M = freshPane();
    tab.mount(M.pane);
    M.stubs['#gdLong']._handler();
    const r = await M.stubs['#gdRun']._handler();
    const snap = C.goldDirectionScan();
    return { r, snap, cardsHtml: M.stubs['#gdCards'].innerHTML, fwdCalls: () => fwdCalls };
  }

  /* control — a DARK board: the proven pick is crowned and recorded */
  {
    const d = await drive(darkBoard, 'dark');
    ok(d.r === 'refreshed', 'control scan completes (got "' + d.r + '")');
    ok(d.snap && d.snap.scalp.pick && d.snap.scalp.pick.stratKey === 'p6fail',
      'control: the measured-proven lead-eligible card IS crowned when the stack cannot read');
    ok(d.snap.fundBlackout === false, 'control: snapshot.fundBlackout false on a dark board');
    ok(d.fwdCalls() === 1, 'control: the crowned pick reaches the forward ledger');
    ok(d.cardsHtml.indexOf('FUNDAMENTAL REGIME') >= 0, 'control: the gold board renders beside the scan');
  }

  /* BLACKOUT — nothing crowned, nothing recorded, the header names the window */
  {
    const d = await drive(blackoutBoard, 'blackout');
    ok(d.r === 'refreshed', 'blackout scan completes (got "' + d.r + '")');
    ok(d.snap && d.snap.scalp.pick === null && d.snap.swing.pick === null,
      'a checked red-folder blackout crowns NOTHING — not even the measured-proven card');
    ok(d.snap.fundBlackout === true, 'snapshot.fundBlackout true — the refusal to crown is auditable');
    ok(d.fwdCalls() === 0, 'no crowned pick -> nothing reaches the forward ledger');
    ok(d.cardsHtml.indexOf('EVENT BLACKOUT') >= 0 && d.cardsHtml.indexOf('WHY SILENT') === -1,
      'the honest EVENT BLACKOUT header stands where a lying WHY SILENT would have');
    ok(d.cardsHtml.indexOf('S30 FAILED-BREAK REVERSAL') >= 0,
      'the matched card still paints, uncrowned, for information only');
  }

  /* HEADWIND — the 2v0 demote; the desk's own lead invariant holds it off */
  {
    const d = await drive(hostileLongBoard, 'hostile');
    ok(d.r === 'refreshed', 'headwind scan completes (got "' + d.r + '")');
    ok(d.snap && d.snap.scalp.pick === null,
      'a 2v0 checked headwind demotes the card — never crowned');
    ok(d.fwdCalls() === 0, 'no crown -> no ledger write');
    ok(d.cardsHtml.indexOf('FUNDAMENTAL HEADWIND') >= 0 && d.cardsHtml.indexOf('no lead-eligible') >= 0,
      'the honest demoted-only header + the verdict chip name the cause');
  }

  /* TAILWIND — chips only; the crown still falls (no tally here to double-count) */
  {
    const d = await drive(tailwindLongBoard, 'tailwind');
    ok(d.r === 'refreshed' && d.snap && d.snap.scalp.pick && d.snap.scalp.pick.stratKey === 'p6fail',
      'a 2v0 tailwind changes NO crown — it chips and touches nothing');
    ok(d.cardsHtml.indexOf('FUNDAMENTAL TAILWIND') >= 0, 'the tailwind chip paints on the board');
    ok(d.fwdCalls() === 1, 'the crowned pick records as usual');
  }
  delete globalThis.localStorage;
}

/* =========================================================================
   11) SOURCE PINS — the seams a headless harness cannot reach
========================================================================= */
console.log('\n== 11) source pins ==');
{
  const gd = read('golddirection.js');
  ok(/if \(!pick && !fundBlackout\) pick = m;/.test(gd),
    'GOLD DIRECTION: the crown guard lives in selectHorizon');
  ok(/hgFundamentalScanCands'\)/.test(gd) && /scanner: 'golddirection'/.test(gd),
    'GOLD DIRECTION: the shared pass runs on the merged board');
  ok(/ui\.cards\.innerHTML = gdFundPanelHtml\(\) \+ tapeNote907 \+ html;/.test(gd),
    'GOLD DIRECTION: the panel splices ahead of the cards');
  const gw = read('goldswing.js');
  ok(/fundBlackout/.test(gw) && /gwFundamentalScan\(ranked\)/.test(gw),
    'GOLD SWING: the blackout probe + the leadership pass are wired into the scan');
  const og = read('omnigold.js');
  ok(/gfn\('hgFundamentalScanCands'\)/.test(og) && /\(ogCollapsed, \{ scanner: 'omnigold' \}\)/.test(og),
    'OMNIGOLD: the shared pass stamps fundGate on the collapsed board (MILLI GOLD chips from it)');
  const gpr = read('goldpro.js');
  ok(/hgFundamentalGate\('XAUUSD'/.test(gpr),
    'GOLD PRO: the bias chip asks the stack directly');
  const mg = read('milligold.js');
  ok(/chip \+= mgFundChipHtml\(c\);/.test(mg) && /mgFundPanelHtml\(\)/.test(mg),
    'MILLI GOLD: per-card chip from the source desk’s verdict + the board beside every outcome');
  const gsp = read('goldspot.js');
  ok(/gsFundPanelHtml\(\) \+ renderBasisPanel/.test(gsp),
    'GOLD SPOT: the board renders beside the basis monitor');
  const gco = read('goldcoint.js');
  ok(/gcFundPanelHtml\(\) \+ tapeNote907/.test(gco),
    'GOLD COINT: the board renders beside the context ledger');
  const fsrc = read('fundamental-stack.js');
  ok(/W\.hgFundamentalScanCands = hgFundamentalScanCands;/.test(fsrc)
      && /W\.hgFundamentalBlackout = hgFundamentalBlackout;/.test(fsrc),
    'fundamental-stack.js exports the ONE pass and the ONE probe the desks share');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
