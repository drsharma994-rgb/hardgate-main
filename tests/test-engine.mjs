/* HARDGATE — engine.js unit tests (Node 18+, builtins only).
   Loads engine.js as a classic script (vm.runInThisContext, like the
   browser's <script> tag) with NOTHING but a window stub present, then:
     A) load + HG_tabs registration ({id:execute, label:EXECUTE, mount})
     K) mount(el) smoke test BEFORE any global is stubbed (graceful deps note)
     B) G0 UNIVERSE — no symbol / no klines / thin history / trail shape
     C) G1 STRUCTURE — cascade dir long+short, mixed veto, anti-chop spread,
        EMA200 HTF side, missing ema/atr, hgStructure BOS/CHoCH, bad closes
     D) G2 MOMENTUM — RSI extremes (70/30 boundaries), volZ floor, close-pos
     E) G3 POSITIONING — funding hard/dir vetoes, null funding, smartClassify
        absent/present/agreeing/opposing/throwing, N/A path, cls input shape
     F) G4 LIQUIDITY/VOL — ATR% floor+ceiling, turnover floor, EMA21 anchor
     G) G5 NEWS RISK — inp.news veto with event name, hgNewsRisk stubbed /
        absent / throwing / vetoing, N/A conviction impact
     H) conviction + suggested-risk policy (STRONG/MODERATE x confirmed)
     I) plan — smartSetup passthrough long+short, cls adaptation, garbage
        sanity veto, smartSetup-null respected, ATR fallback math long+short,
        confirmed flag, no-builders path
     J) trail integrity — short-circuit, vetoGate, gatesPassed, field shape
     L) full RUN integration: fallback universe, 2 survivors + 1 WHY-ASIDE,
        verdict/trail/plan/toTrade/chart rendering, stat line
     M) graceful absence of every optional global at scan level
     N) Stage-0 scanner-results preference + staleness (window.HG_*Results)
     O) empty-universe honest abort
     P) HARD-REFRESH contract — registration carries refresh; 'skipped: not
        run yet' before the first run (a global refresh never auto-triggers
        an expensive first scan, even with data available), 'refreshed'
        after a completed run, 'busy' while a scan is in flight, double-
        refresh still busy, never throws with every global absent
     Q) BRAIN state getter — window.engineState: null pre-run, exact
        {survivors, rejected, at} shape post-run, deep-frozen copies,
        stale-good snapshot preserved after an honest abort, never throws
        with sabotaged internals
   No live network. Run: node tests/test-engine.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

/* ---- load the module in a pristine global scope: only a window stub ---- */
globalThis.window = {};
vm.runInThisContext(fs.readFileSync(root + 'engine.js', 'utf8'), { filename: 'engine.js' });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const gateCandidate = globalThis.window.gateCandidate;

/* ---------------- synthetic data + indicator stubs ---------------- */
/* rows ramp up to lastClose; the LAST bar carries shaped wicks so
   closePos = wickDown/(wickUp+wickDown) is exactly controllable. */
function mkRows(n, lastClose, wickUp, wickDown, step){
  step = step || 0.1;
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = lastClose - step*(n - 1 - i);
    const isLast = i === n - 1;
    rows.push({
      t: 1700000000 + i*14400,
      o: c - 0.3,
      h: isLast ? lastClose + wickUp : c + 0.5,
      l: isLast ? lastClose - wickDown : c - 0.5,
      c: c,
      v: 1000
    });
  }
  return rows;
}

/* direction-aware EMA stub: last close 106 => long cascade, 94 => short */
const DIR_BY_CLOSE = { 106: 'long', 94: 'short' };
function emaStub(vals, p){
  const lc = vals[vals.length - 1];
  const d = DIR_BY_CLOSE[lc];
  const table = d === 'long'
    ? { 9: lc + 4, 20: lc + 2, 21: lc - 1, 50: lc - 6, 200: lc - 16 }
    : { 9: lc - 4, 20: lc - 2, 21: lc + 1, 50: lc + 6, 200: lc + 16 };
  const v = table[p];
  return vals.map(function(){ return v; });
}
function stubIndicators(){
  globalThis.ema = emaStub;
  globalThis.rsi = function(){ return [50, 58]; };           // __last -> 58
  globalThis.atr = function(rows){ return rows.map(function(){ return 2; }); };
  globalThis.volZ = function(){ return 1.2; };
}
function stubSmartClassifyAgree(){
  globalThis.smartClassify = function(d){
    return d.chg24 > 0
      ? { dir: 'long',  longEv: ['trend fuel: price+OI rising'],      shortEv: [], regime: ['new longs entering'], score: 1, total: 1 }
      : { dir: 'short', longEv: [], shortEv: ['trend fuel: price down, OI rising'], regime: ['new shorts entering'], score: 1, total: 1 };
  };
}
function stubSmartSetup(){
  globalThis.smartSetup = function(cls){
    if (cls.dir === 'long')
      return { type: 'SWING', dir: 'long', entry: 106, stop: 101, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 4.72, confirmed: true, note: '' };
    return { type: 'SWING', dir: 'short', entry: 94, stop: 99, t1: 84, t2: 76.5, rr1: 2, rr2: 3.5, riskPct: 5.32, confirmed: true, note: '' };
  };
}
function cleanOptional(){
  delete globalThis.smartClassify;
  delete globalThis.smartSetup;
  delete globalThis.hgStructure;
  delete globalThis.hgNewsRisk;
  delete globalThis.toTrade;
  delete globalThis.hgMiniChart;
  delete globalThis.hgChartAvailable;
  delete globalThis.hgPlanLevels;
}

function longInp(over){
  return Object.assign({
    sym: 'BTCUSDT', source: 'test',
    rows4h: mkRows(260, 106, 0.25, 1.0),       // closePos 0.80
    rows1h: mkRows(120, 106, 0.25, 1.0),
    chg24: 2, turnoverUsd: 800e6, fundingPct: 0.01,
    oiChgPct: 3, retailLongPct: 50, topLongPct: 55, takerRatio: 1.1,
    news: null
  }, over || {});
}
function shortInp(over){
  return Object.assign({
    sym: 'ETHUSDT', source: 'test',
    rows4h: mkRows(260, 94, 1.0, 0.25),        // closePos 0.20
    rows1h: mkRows(120, 94, 1.0, 0.25),
    chg24: -2, turnoverUsd: 500e6, fundingPct: -0.01,
    oiChgPct: 3, retailLongPct: 50, topLongPct: 45, takerRatio: 0.9,
    news: null
  }, over || {});
}

/* ================= A) load + registration ================= */
console.log('== load + registration ==');
ok(typeof gateCandidate === 'function', 'window.gateCandidate exposed');
ok(Array.isArray(globalThis.window.HG_tabs) && globalThis.window.HG_tabs.length === 1, 'HG_tabs array created with one entry');
const tab = globalThis.window.HG_tabs[0];
ok(tab.id === 'execute' && tab.label === 'EXECUTE' && typeof tab.mount === 'function',
   'HG_tabs entry = {id:execute, label:EXECUTE, mount}');
ok(['bias','regime','trendmx','swing','scalp','squeeze','smart','oiflow','liqs','coil','apex','trap','smc','ob','div','gold','goldpro','strats','meanrev','best','carry','basis','search','log','trade','finder'].indexOf(tab.id) === -1,
   'tab id "execute" does not collide with any taken id');
ok(globalThis.window.runScan === undefined && globalThis.window.gatherSymbol === undefined
   && globalThis.window.collectUniverse === undefined && globalThis.window.cardHTML === undefined
   && globalThis.window.buildPlan === undefined && globalThis.window.atrFallbackPlan === undefined,
   'internal helpers stay private (only the documented exports reach window)');

/* ================= K) mount(el) smoke test — BEFORE stubbing any global ================= */
console.log('== mount(el) smoke test (graceful, nothing stubbed) ==');
function stubEl(){
  return { innerHTML: '', textContent: '', className: '', disabled: false,
           style: {}, firstElementChild: { style: {} },
           addEventListener: function(ev, fn){ this._handler = fn; } };
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
const K0 = freshPane();
tab.mount(K0.pane);
ok(K0.pane._html.indexOf('class="panel"') >= 0 && K0.pane._html.indexOf('<h2>EXECUTE — master gate engine') >= 0,
   'mount builds .panel with EXECUTE h2');
ok(K0.pane._html.indexOf('id="engineRun"') >= 0 && K0.pane._html.indexOf('RUN THE GATES') >= 0, 'RUN .btn present');
ok(K0.pane._html.indexOf('id="engineStat"') >= 0 && K0.pane._html.indexOf('id="engineProg"') >= 0
   && K0.pane._html.indexOf('id="engineCards"') >= 0 && K0.pane._html.indexOf('id="engineEmpty"') >= 0,
   'stat / prog / cards / empty containers present');
ok(K0.pane._html.indexOf('id="engineAside"') >= 0 && K0.pane._html.indexOf('WHY ASIDE') >= 0
   && K0.pane._html.indexOf('id="engineAsideList"') >= 0, 'WHY ASIDE panel + ledger present');
ok(K0.pane._html.indexOf('G0 UNIVERSE') >= 0 && K0.pane._html.indexOf('G5 NEWS RISK') >= 0,
   'panel copy documents all six gates');
ok(typeof K0.stubs['#engineRun']._handler === 'function', 'RUN button wired to a click handler');
ok(K0.stubs['#engineDeps'].className === 'note warn' && K0.stubs['#engineDeps'].textContent.indexOf('missing globals') >= 0
   && K0.stubs['#engineDeps'].textContent.indexOf('binanceKlines') >= 0,
   'graceful .note.warn lists missing globals when the data layer is absent');
tab.mount(K0.pane);
ok(true, 'mount is idempotent (second call does not throw)');
tab.mount(null);
ok(true, 'mount(null) tolerated without throwing');

/* ================= B) G0 UNIVERSE ================= */
console.log('== G0 UNIVERSE ==');
let r = gateCandidate();
ok(r.pass === false && r.vetoGate === 'G0' && r.dir === null && r.plan === null, 'no argument at all → G0 veto, no throw');
r = gateCandidate(null);
ok(r.pass === false && r.vetoGate === 'G0', 'explicit null → G0 veto, no throw');
r = gateCandidate('BTCUSDT');
ok(r.pass === false && r.vetoGate === 'G0' && r.trail[0].note.indexOf('no symbol') >= 0, 'bare string → G0 veto "no symbol"');
r = gateCandidate({ sym: 'BTCUSDT' });
ok(r.pass === false && r.trail[0].note.indexOf('no 4h klines') >= 0, 'symbol but no rows4h → G0 veto');
r = gateCandidate({ sym: 'BTCUSDT', rows4h: mkRows(120, 106, 0.25, 1.0) });
ok(r.pass === false && r.trail[0].note.indexOf('120 bars < 210') >= 0, 'thin 4h history (120 < 210) → G0 veto with counts');
ok(r.trail.length === 6 && r.trail[0].gate === 'G0' && r.trail[0].ok === false
   && r.trail.slice(1).every(function(t){ return t.ok === null && t.note === 'not reached'; }),
   'G0 veto short-circuits: trail = 6 entries, G1..G5 "not reached"');
ok(r.trail.map(function(t){ return t.gate; }).join(',') === 'G0,G1,G2,G3,G4,G5', 'trail gate order is always G0..G5');

/* ================= C) G1 STRUCTURE ================= */
console.log('== G1 STRUCTURE ==');
stubIndicators(); cleanOptional(); stubSmartClassifyAgree(); stubSmartSetup();
r = gateCandidate(longInp());
ok(r.pass === true && r.dir === 'long' && r.trail[1].ok === true && r.trail[1].note.indexOf('LONG') >= 0,
   'bullish cascade → dir long, G1 PASS');
r = gateCandidate(shortInp());
ok(r.pass === true && r.dir === 'short' && r.trail[1].note.indexOf('SHORT') >= 0, 'bearish cascade → dir short, G1 PASS');

globalThis.ema = function(vals){ return vals.map(function(){ return 100; }); }; // flat = mixed
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G1' && r.trail[1].note.indexOf('mixed') >= 0, 'mixed cascade → G1 veto (chop)');
globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc+4, 21:lc-0.05, 50:lc-0.15, 200:lc-16}; return vals.map(function(){ return t[p]; }); };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G1' && r.trail[1].note.indexOf('anti-chop') >= 0, 'spread 0.05xATR < 0.25 → anti-chop veto');
globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc+4, 21:lc-1, 50:lc-6, 200:lc+10}; return vals.map(function(){ return t[p]; }); };
r = gateCandidate(longInp());
ok(r.pass === false && r.trail[1].note.indexOf('below 4H EMA200') >= 0, 'long below EMA200 → HTF-side veto');
globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc-4, 21:lc+1, 50:lc+6, 200:lc-10}; return vals.map(function(){ return t[p]; }); };
r = gateCandidate(shortInp());
ok(r.pass === false && r.trail[1].note.indexOf('above 4H EMA200') >= 0, 'short above EMA200 → HTF-side veto');
stubIndicators();

delete globalThis.ema;
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G1' && r.trail[1].note.indexOf('indicator layer not loaded') >= 0,
   'ema absent → honest G1 veto, no crash');
stubIndicators();
delete globalThis.atr;
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G1' && r.trail[1].note.indexOf('indicator layer not loaded') >= 0,
   'atr absent → honest G1 veto (indicator layer), no crash');
stubIndicators();
globalThis.atr = function(rows){ return rows.map(function(){ return NaN; }); };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G1' && r.trail[1].note.indexOf('ATR(4h) not computable') >= 0,
   'atr present but all-NaN → G1 veto (spread unverifiable)');
stubIndicators();

globalThis.hgStructure = function(){ return { dir: 'short', bos: false, choch: true }; };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G1' && r.trail[1].note.indexOf('CHoCH SHORT') >= 0,
   'hgStructure CHoCH against the cascade → G1 veto');
globalThis.hgStructure = function(rows){ return { dir: 'long', bos: true, choch: false }; };
r = gateCandidate(longInp());
ok(r.pass === true && r.trail[1].note.indexOf('BOS confirms LONG') >= 0, 'hgStructure agreeing BOS → pass + strengthening note');
globalThis.hgStructure = function(){ throw new Error('structure module exploded'); };
r = gateCandidate(longInp());
ok(r.pass === true && r.trail[1].note.indexOf('hgStructure errored') >= 0, 'hgStructure throwing → ignored with honest note');
delete globalThis.hgStructure;

const badRows = mkRows(260, 106, 0.25, 1.0); badRows[badRows.length-1].c = NaN;
r = gateCandidate(longInp({ rows4h: badRows }));
ok(r.pass === false && r.trail[1].note.indexOf('bad 4h closes') >= 0, 'NaN last close → G1 veto "bad 4h closes"');

/* ================= D) G2 MOMENTUM ================= */
console.log('== G2 MOMENTUM ==');
globalThis.rsi = function(){ return [50, 75]; };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G2' && r.trail[2].note.indexOf('> 70') >= 0, 'long + RSI 75 → overbought chase veto');
globalThis.rsi = function(){ return [50, 70]; };
r = gateCandidate(longInp());
ok(r.pass === true, 'long + RSI exactly 70 → boundary passes (veto is >70)');
globalThis.rsi = function(){ return [50, 25]; };
r = gateCandidate(shortInp());
ok(r.pass === false && r.vetoGate === 'G2' && r.trail[2].note.indexOf('< 30') >= 0, 'short + RSI 25 → oversold chase veto');
globalThis.rsi = function(){ return [50, 30]; };
r = gateCandidate(shortInp());
ok(r.pass === true, 'short + RSI exactly 30 → boundary passes (veto is <30)');
globalThis.rsi = function(){ return [50, 58]; };

globalThis.volZ = function(){ return 0.5; };
r = gateCandidate(longInp());
ok(r.pass === false && r.trail[2].note.indexOf('volume z') >= 0, 'volZ exactly 0.5 → veto (needs > 0.5)');
globalThis.volZ = function(){ return NaN; };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G2', 'volZ NaN → veto, no fabricated participation');
globalThis.volZ = function(){ return 1.2; };

r = gateCandidate(longInp({ rows4h: mkRows(260, 106, 7, 3) })); // closePos 0.30
ok(r.pass === false && r.vetoGate === 'G2' && r.trail[2].note.indexOf('sellers hit the close') >= 0,
   'long with close 30% up the bar → weak-close veto');
r = gateCandidate(shortInp({ rows4h: mkRows(260, 94, 3, 7) })); // closePos 0.70
ok(r.pass === false && r.vetoGate === 'G2' && r.trail[2].note.indexOf('buyers hit the close') >= 0,
   'short with close 70% up the bar → weak-close veto');
r = gateCandidate(longInp({ rows4h: mkRows(260, 106, 1, 1.5) })); // closePos 0.60
ok(r.pass === true, 'long closePos exactly 0.60 → boundary passes');
r = gateCandidate(shortInp({ rows4h: mkRows(260, 94, 1.5, 1) })); // closePos 0.40
ok(r.pass === true, 'short closePos exactly 0.40 → boundary passes');

delete globalThis.rsi;
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G2' && r.trail[2].note.indexOf('momentum indicators missing') >= 0,
   'rsi absent → honest G2 veto, no crash');
stubIndicators();

/* ================= E) G3 POSITIONING ================= */
console.log('== G3 POSITIONING ==');
r = gateCandidate(longInp({ fundingPct: 0.05 }));
ok(r.pass === false && r.vetoGate === 'G3' && r.trail[3].note.indexOf('|fr| >= 0.05') >= 0, '|funding| = 0.05 → hard crowded veto');
r = gateCandidate(shortInp({ fundingPct: 0.0499 }));
ok(r.pass === true, 'funding +0.0499 on a short → inside the hard band and not against dir, passes');
r = gateCandidate(longInp({ fundingPct: 0.04 }));
ok(r.pass === false && r.trail[3].note.indexOf('longs paying') >= 0, 'long + funding +0.04 → crowded-side veto');
r = gateCandidate(longInp({ fundingPct: 0.0399 }));
ok(r.pass === true, 'long + funding +0.0399 → passes');
r = gateCandidate(shortInp({ fundingPct: -0.04 }));
ok(r.pass === false && r.trail[3].note.indexOf('shorts paying') >= 0, 'short + funding −0.04 → crowded-side veto');
r = gateCandidate(shortInp({ fundingPct: -0.0399 }));
ok(r.pass === true, 'short + funding −0.0399 → passes');

r = gateCandidate(longInp({ fundingPct: null }));
ok(r.pass === true && r.trail[3].note.indexOf('funding n/a') >= 0, 'funding null → gate evaluates on smart-$ only, honest note');
delete globalThis.smartClassify;
r = gateCandidate(longInp({ fundingPct: null }));
ok(r.pass === true && r.trail[3].ok === null && r.trail[3].note.indexOf('gate cannot evaluate') >= 0
   && r.conviction === 'MODERATE',
   'funding null + smartClassify absent → G3 N/A (never fabricated), conviction drops to MODERATE');
stubSmartClassifyAgree();

globalThis.smartClassify = function(){
  return { dir: 'short', longEv: [], shortEv: ['covering rally: price up, OI down', 'funding extreme'], regime: [], score: 2, total: 3 };
};
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G3' && r.trail[3].note.indexOf('AGAINST') >= 0
   && r.trail[3].note.indexOf('covering rally') >= 0,
   'smart-$ opposing majority score 2 → G3 veto with lead evidence shown');
globalThis.smartClassify = function(){
  return { dir: 'short', longEv: [], shortEv: ['retail 12% long (≤35) — contrarian'], regime: [], score: 1, total: 1 };
};
r = gateCandidate(longInp());
ok(r.pass === true && r.trail[3].note.indexOf('mildly against') >= 0, 'smart-$ opposing score 1 → noted, not a veto');
stubSmartClassifyAgree();
r = gateCandidate(longInp());
ok(r.pass === true && r.trail[3].note.indexOf('smart $ confirms LONG') >= 0, 'smart-$ agreeing → pass + strengthening note');
globalThis.smartClassify = function(){ throw new Error('classifier exploded'); };
r = gateCandidate(longInp());
ok(r.pass === true && r.trail[3].note.indexOf('smartClassify errored') >= 0, 'smartClassify throwing → funding-only read, no crash');
stubSmartClassifyAgree();

let capturedClsInp = null;
globalThis.smartClassify = function(d){ capturedClsInp = d; return { dir: 'long', longEv: ['x'], shortEv: [], regime: [], score: 1, total: 1 }; };
gateCandidate(longInp());
ok(capturedClsInp && capturedClsInp.chg24 === 2 && capturedClsInp.oiChgPct === 3 && capturedClsInp.fundingPct === 0.01
   && capturedClsInp.retailLongPct === 50 && capturedClsInp.topLongPct === 55 && capturedClsInp.takerRatio === 1.1,
   'smartClassify receives {chg24, oiChgPct, fundingPct, retailLongPct, topLongPct, takerRatio} verbatim');
globalThis.smartClassify = function(){ return { dir: null, longEv: [], shortEv: [], regime: [], score: 0, total: 2 }; };
r = gateCandidate(longInp());
ok(r.pass === true && r.trail[3].note.indexOf('split') >= 0, 'smart-$ tie → pass with "split" note');

/* ================= F) G4 LIQUIDITY / VOL ================= */
console.log('== G4 LIQUIDITY/VOL ==');
stubSmartClassifyAgree();
globalThis.atr = function(rows){ return rows.map(function(){ return 0.01; }); };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G4' && r.trail[4].note.indexOf('dead book') >= 0, 'ATR 0.009% of price → dead-book veto');
globalThis.atr = function(rows){ return rows.map(function(){ return 30; }); };
globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc-2, 21:lc-8, 50:lc-16, 200:lc-20}; return vals.map(function(){ return t[p]; }); };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G4' && r.trail[4].note.indexOf('untradeable volatility') >= 0, 'ATR 28% of price → vol-ceiling veto');
stubIndicators();
r = gateCandidate(longInp({ turnoverUsd: 9e6 }));
ok(r.pass === false && r.vetoGate === 'G4' && r.trail[4].note.indexOf('turnover $9M') >= 0, 'turnover $9M < $10M floor → veto');
r = gateCandidate(longInp({ turnoverUsd: 10e6 }));
ok(r.pass === true, 'turnover exactly $10M → boundary passes');
r = gateCandidate(longInp({ turnoverUsd: null }));
ok(r.pass === true && r.trail[4].note.indexOf('turnover n/a') >= 0, 'turnover unknown → noted, not vetoed');
globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc+12, 21:lc+10, 50:lc-6, 200:lc-16}; return vals.map(function(){ return t[p]; }); };
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G4' && r.trail[4].note.indexOf('too extended') >= 0,
   'price 5xATR from EMA21 > 1.5 → anti-chase anchor veto');
globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc+5, 21:lc+3, 50:lc-6, 200:lc-16}; return vals.map(function(){ return t[p]; }); };
r = gateCandidate(longInp());
ok(r.pass === true, 'price exactly 1.5xATR from EMA21 → boundary passes');
stubIndicators();

/* ================= G) G5 NEWS RISK ================= */
console.log('== G5 NEWS RISK ==');
r = gateCandidate(longInp({ news: { blackout: true, event: 'FOMC' } }));
ok(r.pass === false && r.vetoGate === 'G5' && r.trail[5].note.indexOf('NEWS BLACKOUT') >= 0
   && r.trail[5].note.indexOf('FOMC') >= 0, 'blackout input → G5 veto WITH the event name shown');
r = gateCandidate(longInp({ news: { blackout: true, event: 'CPI', until: '2026-07-19 14:00 UTC' } }));
ok(r.pass === false && r.trail[5].note.indexOf('until 2026-07-19 14:00 UTC') >= 0, 'blackout until-stamp shown in the note');
r = gateCandidate(longInp({ news: { veto: true } }));
ok(r.pass === false && r.trail[5].note.indexOf('high-impact event') >= 0, 'veto:true shape honored, generic event fallback');
r = gateCandidate(longInp({ news: { blackout: false } }));
ok(r.pass === true && r.trail[5].note.indexOf('no high-impact events') >= 0, 'clean calendar object → G5 PASS');
r = gateCandidate(longInp({ news: null }));
ok(r.pass === true && r.trail[5].ok === true && r.trail[5].note.indexOf('news calendar clear') >= 0, 'explicit null news → clear');

const inpNoNews = longInp(); delete inpNoNews.news;
delete globalThis.hgNewsRisk;
r = gateCandidate(inpNoNews);
ok(r.pass === true && r.trail[5].ok === null && r.trail[5].note.indexOf('hgNewsRisk not loaded') >= 0
   && r.conviction === 'MODERATE',
   'hgNewsRisk absent → G5 N/A with manual-calendar note, conviction MODERATE');
globalThis.hgNewsRisk = function(){ return { blackout: false }; };
r = gateCandidate(inpNoNews);
ok(r.pass === true && r.trail[5].ok === true && r.conviction === 'STRONG',
   'hgNewsRisk present + clean → G5 PASS, conviction back to STRONG');
globalThis.hgNewsRisk = function(){ throw new Error('calendar feed down'); };
r = gateCandidate(inpNoNews);
ok(r.pass === true && r.trail[5].ok === null && r.trail[5].note.indexOf('hgNewsRisk errored') >= 0
   && r.trail[5].note.indexOf('calendar feed down') >= 0,
   'hgNewsRisk throwing → N/A with the error surfaced, never a crash');
globalThis.hgNewsRisk = function(sym){ return { blackout: true, event: 'NFP', symSeen: sym }; };
r = gateCandidate(inpNoNews);
ok(r.pass === false && r.vetoGate === 'G5' && r.trail[5].note.indexOf('NFP') >= 0, 'module-reported blackout → veto with event name');
delete globalThis.hgNewsRisk;

/* ================= H) conviction + suggested risk policy ================= */
console.log('== conviction + risk policy ==');
stubSmartSetup();
r = gateCandidate(longInp());
ok(r.conviction === 'STRONG' && r.gatesPassed === 6 && r.riskPct === 1.0,
   'all 6 gates pass + confirmed plan → STRONG, 6/6, risk 1.0%');
globalThis.smartSetup = function(cls){ return { type: 'SCALP', dir: cls.dir, entry: 106, stop: 101, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 4.72, confirmed: false, note: '' }; };
r = gateCandidate(longInp());
ok(r.conviction === 'STRONG' && r.riskPct === 0.5, 'STRONG + UNCONFIRMED plan → risk halved to 0.5%');
const inpNN = longInp(); delete inpNN.news;
r = gateCandidate(inpNN);
ok(r.conviction === 'MODERATE' && r.gatesPassed === 5 && r.riskPct === 0.25,
   'MODERATE (5/6, news N/A) + UNCONFIRMED → risk 0.25%');
delete globalThis.smartClassify;
const inpNN2 = longInp({ fundingPct: null }); delete inpNN2.news;
r = gateCandidate(inpNN2);
ok(r.conviction === 'MODERATE' && r.gatesPassed === 4, 'G3 N/A + G5 N/A → 4/6 gates, still MODERATE, never a numeric "score"');
stubSmartClassifyAgree(); stubSmartSetup();
r = gateCandidate(longInp({ fundingPct: 0.05 }));
ok(r.riskPct === null && r.conviction === null && r.plan === null, 'vetoed candidate carries no conviction/risk/plan');

/* ================= I) plan — smartSetup passthrough + ATR fallback ================= */
console.log('== plan: smartSetup passthrough, sanity, fallback ==');
stubSmartClassifyAgree(); stubSmartSetup();
r = gateCandidate(longInp());
ok(r.plan && r.plan.dir === 'long' && r.plan.stop < r.plan.entry && r.plan.t1 > r.plan.entry && r.plan.t2 > r.plan.t1
   && r.plan.entry === 106 && r.plan.stop === 101 && r.plan.t1 === 116 && r.plan.t2 === 123.5,
   'LONG plan sanity: stop 101 < entry 106 < T1 116 < T2 123.5 (passthrough)');
r = gateCandidate(shortInp());
ok(r.plan && r.plan.dir === 'short' && r.plan.stop > r.plan.entry && r.plan.t1 < r.plan.entry && r.plan.t2 < r.plan.t1
   && r.plan.entry === 94 && r.plan.stop === 99 && r.plan.t1 === 84 && r.plan.t2 === 76.5,
   'SHORT plan sanity: stop 99 > entry 94 > T1 84 > T2 76.5 (passthrough)');

let capturedSetupCls = null;
globalThis.smartSetup = function(cls){ capturedSetupCls = cls; return null; };
delete globalThis.smartClassify;
gateCandidate(longInp());
ok(capturedSetupCls && capturedSetupCls.dir === 'long' && Array.isArray(capturedSetupCls.longEv)
   && capturedSetupCls.longEv.length === 0 && Array.isArray(capturedSetupCls.shortEv),
   'smartClassify absent → smartSetup gets an honest synthesized cls (dir + empty evidence)');
stubSmartClassifyAgree();
gateCandidate(longInp());
ok(capturedSetupCls && capturedSetupCls.dir === 'long' && capturedSetupCls.longEv[0] === 'trend fuel: price+OI rising',
   'smartClassify present → its result is passed to smartSetup verbatim (SWING typing stays consistent)');

globalThis.smartSetup = function(){ return { type: 'SWING', dir: 'long', entry: 106, stop: 110, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 3, confirmed: true, note: '' }; };
r = gateCandidate(longInp());
ok(r.pass === true && r.plan === null, 'garbage plan (stop above entry on a long) → sanity-checked to null, gates still pass');
globalThis.smartSetup = function(){ return null; };
r = gateCandidate(longInp());
ok(r.pass === true && r.plan === null, 'smartSetup null (structure broken) is respected — never fabricated around');
globalThis.smartSetup = function(){ throw new Error('builder exploded'); };
r = gateCandidate(longInp());
ok(r.pass === true && r.plan === null, 'smartSetup throwing → plan null, no crash');

delete globalThis.smartSetup; // -> local ATR fallback
r = gateCandidate(longInp());
ok(r.plan && r.plan.type === 'ATR' && r.plan.entry === 106 && r.plan.stop === 103 && r.plan.t1 === 112 && r.plan.t2 === 116.5
   && r.plan.rr1 === 2 && r.plan.rr2 === 3.5 && Math.abs(r.plan.riskPct - 300/106) < 1e-9
   && r.plan.note.indexOf('local ATR fallback') >= 0,
   'ATR fallback LONG: entry 106 · stop 103 (1.5xATR) · T1 112 (2R) · T2 116.5 (3.5R) · risk 2.83%');
ok(r.plan.confirmed === true, 'fallback CONFIRMED flag from 4H EMA20/50 cascade (long: 108 > 100)');
r = gateCandidate(shortInp());
ok(r.plan && r.plan.type === 'ATR' && r.plan.entry === 94 && r.plan.stop === 97 && r.plan.t1 === 88 && r.plan.t2 === 83.5
   && r.plan.confirmed === true,
   'ATR fallback SHORT: entry 94 · stop 97 · T1 88 · T2 83.5 · confirmed (92 < 100)');
globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc+4, 20:lc-8, 21:lc-1, 50:lc-6, 200:lc-16}; return vals.map(function(){ return t[p]; }); };
r = gateCandidate(longInp());
ok(r.plan && r.plan.confirmed === false, 'fallback UNCONFIRMED when the 20/50 cascade disagrees (long: 98 < 100)');
stubIndicators();
delete globalThis.atr;
r = gateCandidate(longInp());
ok(r.pass === false && r.vetoGate === 'G1', 'no smartSetup AND no atr → dies honestly at G1 (ATR unverifiable)');
stubIndicators(); stubSmartSetup();

/* ================= J) trail integrity ================= */
console.log('== trail integrity ==');
globalThis.volZ = function(){ return 0.1; };
r = gateCandidate(longInp());
ok(r.trail.length === 6 && r.trail[0].ok === true && r.trail[1].ok === true && r.trail[2].ok === false
   && r.trail[3].ok === null && r.trail[4].ok === null && r.trail[5].ok === null,
   'G2 veto: G0-G1 PASS, G2 VETO, G3-G5 not reached');
ok(r.vetoGate === 'G2' && r.dir === 'long' && r.plan === null && r.gatesPassed === 2,
   'veto keeps the dir found at G1, gatesPassed counts only true gates (2)');
ok(r.trail.every(function(t){ return typeof t.gate === 'string' && typeof t.name === 'string'
   && (t.ok === true || t.ok === false || t.ok === null) && typeof t.note === 'string'; }),
   'every trail entry is {gate, name, ok:true|false|null, note}');
ok(r.trail.map(function(t){ return t.name; }).join(',') === 'UNIVERSE,STRUCTURE,MOMENTUM,POSITIONING,LIQUIDITY/VOL,NEWS RISK',
   'trail carries the six stage names in funnel order');
stubIndicators(); // restores volZ 1.2

/* ================= L) full RUN integration ================= */
console.log('== full RUN integration (fallback universe) ==');
stubIndicators(); stubSmartClassifyAgree(); stubSmartSetup();
globalThis.hgNewsRisk = function(){ return { blackout: false }; };
globalThis.toTrade = function(){};
const chartCalls = [];
globalThis.hgMiniChart = function(el, rows, plan){ chartCalls.push({ n: rows && rows.length, plan: plan }); return { fake: true }; };

globalThis.binancePerpUniverse = async function(){ return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']; };
globalThis.binanceTickers24h = async function(){
  return {
    BTCUSDT: { mark: 106, chg24: 2,  turnoverUsd: 800e6 },
    ETHUSDT: { mark: 94,  chg24: -2, turnoverUsd: 500e6 },
    SOLUSDT: { mark: 106, chg24: 3,  turnoverUsd: 900e6 }
  };
};
globalThis.binanceFunding    = async function(sym){ return { markPrice: sym === 'ETHUSDT' ? 94 : 106, fundingPct: 0.01 }; };
globalThis.binanceOIHistory  = async function(){ return { series: [{ oi: 100 }, { oi: 103 }] }; };
globalThis.binanceLongShort  = async function(){ return { latest: { longPct: 50 } }; };
globalThis.binanceTopTraders = async function(){ return { latest: { longPct: 55 } }; };
globalThis.binanceTakerRatio = async function(){ return { latest: { buySellRatio: 1.1 } }; };
globalThis.binanceKlines     = async function(sym, interval, limit){
  if (sym === 'BTCUSDT') return mkRows(limit || 260, 106, 0.25, 1.0); // long, strong close
  if (sym === 'ETHUSDT') return mkRows(limit || 260, 94, 1.0, 0.25);  // short, strong close
  if (sym === 'SOLUSDT') return mkRows(limit || 260, 106, 7, 3);      // long shape, weak close → G2 veto
  return [];
};

async function waitScan(stubs){
  const t0 = Date.now();
  while (stubs['#engineRun'].disabled && Date.now() - t0 < 8000)
    await new Promise(function(res){ setTimeout(res, 25); });
}

const L = freshPane();
tab.mount(L.pane);
L.pane.querySelector('#engineCards').querySelectorAll = function(sel){
  return sel === '.engineChart'
    ? [{ getAttribute: function(){ return 'BTCUSDT'; } }, { getAttribute: function(){ return 'ETHUSDT'; } }]
    : [];
};
L.stubs['#engineRun']._handler();
await waitScan(L.stubs);
const lStat = L.stubs['#engineStat'].textContent, lHtml = L.stubs['#engineCards'].innerHTML,
      lAside = L.stubs['#engineAsideList'].innerHTML;

ok(lStat.indexOf('done · 2 executions (2 STRONG · 2 with plans) · 1 aside') === 0,
   'L: stat reports 2 executions (2 STRONG, 2 plans) + 1 aside');
ok(lStat.indexOf('universe 3 (fallback: top 24 USDT perps by 24h turnover') >= 0,
   'L: stat names the fallback universe source honestly');
ok(lHtml.indexOf('BTCUSDT') >= 0 && lHtml.indexOf('ETHUSDT') >= 0 && lHtml.indexOf('SOLUSDT') === -1,
   'L: survivor cards render, rejected SOLUSDT is NOT in the cards');
ok(lHtml.indexOf('<div class="vword">LONG</div>') >= 0 && lHtml.indexOf('<div class="vword">SHORT</div>') >= 0
   && lHtml.indexOf('STRONG CONVICTION') >= 0 && lHtml.indexOf('6 of 6 gates') >= 0,
   'L: big LONG/SHORT verdicts + STRONG conviction + gate count on every card');
ok(lHtml.indexOf('class="stamp pass"') >= 0 && lHtml.indexOf('G0') >= 0 && lHtml.indexOf('NEWS RISK') >= 0,
   'L: full PASS trail ledger printed on execution cards');
ok(lHtml.indexOf('ENTRY <b>106</b> · STOP <b>101</b> · T1 116 (2R) · T2 123.5 (3.5R)') >= 0,
   'L: LONG plan block renders ENTRY/STOP/T1/T2 from smartSetup');
ok(lHtml.indexOf('ENTRY <b>94</b> · STOP <b>99</b> · T1 84 (2R) · T2 76.5 (3.5R)') >= 0,
   'L: SHORT plan block renders mirrored levels');
ok(lHtml.indexOf('toTrade(&quot;BTCUSDT&quot;,&quot;long&quot;,106,101,116)') >= 0
   && lHtml.indexOf('toTrade(&quot;ETHUSDT&quot;,&quot;short&quot;,94,99,84)') >= 0,
   'L: SEND TO TRADE PLAN carries escaped toTrade(sym,dir,entry,stop,t1) payloads');
ok(lHtml.indexOf('suggested risk <b>1%</b>') >= 0, 'L: suggested risk fraction rendered (STRONG + confirmed = 1%)');
ok(chartCalls.length === 2 && chartCalls[0].plan.dir === 'long' && chartCalls[0].plan.entry === 106
   && chartCalls[1].plan.dir === 'short' && chartCalls[1].plan.stop === 99,
   'L: hgMiniChart painted once per survivor with the {dir,entry,stop,t1,t2} contract');
ok(L.stubs['#engineAside'].style.display === 'block' && lAside.indexOf('SOLUSDT') >= 0
   && lAside.indexOf('G2') >= 0 && lAside.indexOf('MOMENTUM') >= 0 && lAside.indexOf('stamp veto') >= 0
   && lAside.indexOf('sellers hit the close') >= 0,
   'L: WHY ASIDE shows SOLUSDT killed at G2 MOMENTUM with the exact reason');
ok(L.stubs['#engineAsideCount'].textContent === '1 rejected', 'L: aside count rendered');
ok(L.stubs['#engineEmpty'].style.display === 'none', 'L: empty state stays hidden with survivors present');

/* ================= M) graceful absence of every optional global ================= */
console.log('== graceful absence of optionals at scan level ==');
delete globalThis.smartClassify; delete globalThis.smartSetup; delete globalThis.hgNewsRisk;
delete globalThis.toTrade; delete globalThis.hgMiniChart; delete globalThis.hgChartAvailable;
const M = freshPane();
tab.mount(M.pane);
M.stubs['#engineRun']._handler();
await waitScan(M.stubs);
const mStat = M.stubs['#engineStat'].textContent, mHtml = M.stubs['#engineCards'].innerHTML;
ok(mStat.indexOf('done · 2 executions (0 STRONG · 2 with plans) · 1 aside') === 0,
   'M: scan completes with every optional global absent (2 MODERATE executions)');
ok(mHtml.indexOf('local ATR fallback (smartSetup unavailable)') >= 0, 'M: plans fall back to local ATR math, labelled honestly');
ok(mHtml.indexOf('MODERATE CONVICTION') >= 0 && mHtml.indexOf('5 of 6 gates') >= 0,
   'M: conviction degrades to MODERATE 5/6 (news N/A), never faked as STRONG');
ok(mHtml.indexOf('class="stamp na"') >= 0, 'M: G5 renders an N/A stamp in the trail');
ok(mHtml.indexOf('toTrade(') === -1, 'M: no SEND TO TRADE PLAN button when toTrade is absent');
ok(mHtml.indexOf('suggested risk <b>0.5%</b>') >= 0, 'M: suggested risk halves with conviction (0.5%)');

/* ================= N) Stage-0 scanner-results preference + staleness ================= */
console.log('== Stage-0 scanner results (fresh / stale) ==');
stubSmartClassifyAgree(); stubSmartSetup(); globalThis.hgNewsRisk = function(){ return { blackout: false }; };
globalThis.window.HG_oiflowResults = ['BTCUSDT'];
const N1 = freshPane();
tab.mount(N1.pane);
N1.stubs['#engineRun']._handler();
await waitScan(N1.stubs);
ok(N1.stubs['#engineStat'].textContent.indexOf('universe 1 (scanner results · HG_oiflowResults') >= 0
   && N1.stubs['#engineStat'].textContent.indexOf('1 executions') >= 0,
   'N: fresh scanner results (array form) preferred over the turnover fallback');
globalThis.window.HG_oiflowResults = { syms: ['BTCUSDT'], at: Date.now() - 11*60*1000 }; // stale
const N2 = freshPane();
tab.mount(N2.pane);
N2.stubs['#engineRun']._handler();
await waitScan(N2.stubs);
ok(N2.stubs['#engineStat'].textContent.indexOf('fallback: top 24') >= 0,
   'N: scanner results older than 10 minutes are stale → turnover fallback');
globalThis.window.HG_oiflowResults = { syms: [{ sym: 'ETHUSDT' }, { symbol: 'BTCUSDT' }, 'BTCUSDT'], at: Date.now() };
const N3 = freshPane();
tab.mount(N3.pane);
N3.stubs['#engineRun']._handler();
await waitScan(N3.stubs);
ok(N3.stubs['#engineStat'].textContent.indexOf('universe 2 (scanner results') >= 0,
   'N: object rows normalized + deduped ({sym}/{symbol}/string → 2 unique symbols)');
delete globalThis.window.HG_oiflowResults;

/* ================= O) empty-universe honest abort ================= */
console.log('== empty universe ==');
delete globalThis.binancePerpUniverse; delete globalThis.binanceTickers24h;
const O = freshPane();
tab.mount(O.pane);
O.stubs['#engineRun']._handler();
await waitScan(O.stubs);
ok(O.stubs['#engineStat'].className === 'note warn'
   && O.stubs['#engineStat'].textContent.indexOf('empty universe') >= 0,
   'O: no scanner results + no binance.js → honest warn, no fabricated candidates');
ok(O.stubs['#engineEmpty'].style.display === 'block', 'O: empty state shown');

/* ================= P) HARD-REFRESH contract ================= */
console.log('== hard-refresh: registration + skip/refreshed/busy paths ==');
ok(typeof tab.refresh === 'function', 'P: HG_tabs registration carries a refresh function (hard-refresh contract)');

/* pristine module load → fresh closure state (never mounted, never run) */
vm.runInThisContext(fs.readFileSync(root + 'engine.js', 'utf8'), { filename: 'engine.js' });
const tab2 = globalThis.window.HG_tabs[1];
ok(tab2 && tab2.id === 'execute' && typeof tab2.refresh === 'function',
   'P: a freshly loaded registration also carries refresh');

/* data fully available, but the tab was NEVER run → refresh must skip,
   never trigger an expensive first-time full-universe scan */
stubIndicators(); stubSmartClassifyAgree(); stubSmartSetup();
globalThis.hgNewsRisk = function(){ return { blackout: false }; };
globalThis.binancePerpUniverse = async function(){ return ['BTCUSDT']; };
globalThis.binanceTickers24h = async function(){ return { BTCUSDT: { mark: 106, chg24: 2, turnoverUsd: 800e6 } }; };
globalThis.binanceKlines = async function(sym, interval, limit){ return mkRows(limit || 260, 106, 0.25, 1.0); };
globalThis.binanceFunding = async function(){ return { markPrice: 106, fundingPct: 0.01 }; };
delete globalThis.binanceOIHistory; delete globalThis.binanceLongShort;
delete globalThis.binanceTopTraders; delete globalThis.binanceTakerRatio;

let status = null, threw = false;
try{ status = await tab2.refresh(); }catch(e){ threw = true; }
ok(!threw, 'P: refresh before mount / first run does not throw');
ok(status === 'skipped: not run yet',
   'P: data available but never run → "skipped: not run yet" (no first-time scan from a global refresh)');

const P0 = freshPane();
tab2.mount(P0.pane);
status = await tab2.refresh();
ok(status === 'skipped: not run yet', 'P: mounted but never run → still skipped');
ok(P0.pane.querySelector('#engineStat').textContent === '', 'P: a skipped refresh started NO scan (stat line untouched)');

/* baseline user run via the RUN handler, then refresh → 'refreshed' */
P0.stubs['#engineRun']._handler();
await waitScan(P0.stubs);
ok(P0.stubs['#engineStat'].textContent.indexOf('done · 1 executions') === 0, 'P: baseline RUN completes (1 execution)');
status = await tab2.refresh();
ok(status === 'refreshed', 'P: refresh after a completed run → "refreshed"');
ok(P0.stubs['#engineStat'].textContent.indexOf('done · 1 executions') === 0
   && P0.stubs['#engineCards'].innerHTML.indexOf('BTCUSDT') >= 0,
   'P: refresh re-ran the same funnel and repainted the results');

/* busy path: klines hang in a controllable deferred so the scan stays in flight */
const deferreds = [];
globalThis.binanceKlines = function(sym, interval, limit){
  return new Promise(function(res){ deferreds.push(function(){ res(mkRows(limit || 260, 106, 0.25, 1.0)); }); });
};
P0.stubs['#engineRun']._handler();
await new Promise(function(res){ setTimeout(res, 60); }); // let the scan reach the pending klines legs
ok(P0.stubs['#engineRun'].disabled === true, 'P: scan in flight (RUN button disabled)');
status = await tab2.refresh();
ok(status === 'busy', 'P: refresh during a running scan → "busy"');
status = await tab2.refresh();
ok(status === 'busy', 'P: double-refresh during a run → "busy" again (no double-fetch)');
ok(deferreds.length === 2, 'P: busy refreshes fired no extra fetches (still just the 4h+1h legs of the running scan)');
deferreds.forEach(function(r){ r(); });
await waitScan(P0.stubs);

globalThis.binanceKlines = async function(sym, interval, limit){ return mkRows(limit || 260, 106, 0.25, 1.0); };
status = await tab2.refresh();
ok(status === 'refreshed', 'P: refresh after the busy scan completed → "refreshed" again');

/* refresh never throws when globals are absent */
vm.runInThisContext(fs.readFileSync(root + 'engine.js', 'utf8'), { filename: 'engine.js' });
const tab3 = globalThis.window.HG_tabs[2];
ok(tab3 && typeof tab3.refresh === 'function', 'P: third registration also carries refresh');
delete globalThis.binancePerpUniverse; delete globalThis.binanceTickers24h;
delete globalThis.binanceKlines; delete globalThis.binanceFunding;
delete globalThis.ema; delete globalThis.rsi; delete globalThis.atr; delete globalThis.volZ;
delete globalThis.smartClassify; delete globalThis.smartSetup; delete globalThis.hgNewsRisk;
const P3 = freshPane();
tab3.mount(P3.pane);
P3.stubs['#engineRun']._handler();
await waitScan(P3.stubs);
ok(P3.stubs['#engineStat'].textContent.indexOf('empty universe') >= 0,
   'P: a run with no data layer aborts honestly (empty universe)');
threw = false; status = null;
try{ status = await tab3.refresh(); }catch(e){ threw = true; }
ok(!threw && typeof status === 'string' && status.length > 0,
   'P: refresh with every global absent never throws and still returns a terse status string');
ok(status === 'refreshed', 'P: refresh re-runs the honest abort path → "refreshed" (no fabricated work claimed)');

/* ================= Q) BRAIN state getter — window.engineState =================
   Fresh module instance (clean closure state). Covers: getter exposed; null
   before the first successful run; populated with the exact contract shape
   after a successful scan (survivors = execution cards, rejected = WHY
   ASIDE rows); DEEP-FROZEN deep copies each call; an honest-abort re-run
   keeps the PREVIOUS good snapshot with its original `at`; the getter never
   throws, even with sabotaged internals. */
console.log('== BRAIN state getter (window.engineState) ==');
vm.runInThisContext(fs.readFileSync(root + 'engine.js', 'utf8'), { filename: 'engine.js' });
const tabQ = globalThis.window.HG_tabs[globalThis.window.HG_tabs.length - 1];
ok(tabQ && tabQ.id === 'execute', 'Q: fresh registration found');
ok(typeof globalThis.window.engineState === 'function', 'Q: window.engineState exposed');
ok(globalThis.window.engineState() === null, 'Q: null before the first successful run');

stubIndicators(); stubSmartClassifyAgree(); stubSmartSetup();
globalThis.hgNewsRisk = function(){ return { blackout: false }; };
globalThis.binancePerpUniverse = async function(){ return ['BTCUSDT', 'SOLUSDT']; };
globalThis.binanceTickers24h = async function(){
  return { BTCUSDT: { mark: 106, chg24: 2, turnoverUsd: 800e6 },
           SOLUSDT: { mark: 106, chg24: 3, turnoverUsd: 900e6 } };
};
globalThis.binanceFunding = async function(){ return { markPrice: 106, fundingPct: 0.01 }; };
globalThis.binanceKlines = async function(sym, interval, limit){
  if (sym === 'SOLUSDT') return mkRows(limit || 260, 106, 7, 3); // weak close -> G2 veto
  return mkRows(limit || 260, 106, 0.25, 1.0);
};
delete globalThis.binanceOIHistory; delete globalThis.binanceLongShort;
delete globalThis.binanceTopTraders; delete globalThis.binanceTakerRatio;
delete globalThis.window.HG_oiflowResults; delete globalThis.window.HG_squeezeResults;

const Q = freshPane();
tabQ.mount(Q.pane);
Q.stubs['#engineRun']._handler();
await waitScan(Q.stubs);
ok(Q.stubs['#engineStat'].textContent.indexOf('done · 1 executions') === 0,
   'Q: fixture scan completes (1 execution, 1 aside)');

const qState = globalThis.window.engineState();
ok(qState && typeof qState === 'object', 'Q: populated after the successful run');
ok(typeof qState.at === 'number' && isFinite(qState.at)
   && Array.isArray(qState.survivors) && Array.isArray(qState.rejected),
   'Q: shape = {survivors:[], rejected:[], at:<epochMs>}');
ok(qState.survivors.length === 1 && qState.rejected.length === 1,
   'Q: 1 survivor + 1 rejected mirrors the rendered cards / WHY ASIDE');
const qSv = qState.survivors[0];
ok(Object.keys(qSv).sort().join(',') === 'conviction,dir,gatesPassed,plan,sym',
   'Q: survivor row keys exactly {sym, dir, conviction, plan, gatesPassed}');
ok(qSv.sym === 'BTCUSDT' && qSv.dir === 'long' && qSv.conviction === 'STRONG' && qSv.gatesPassed === 6,
   'Q: survivor carries sym/dir/conviction/gatesPassed from the funnel result');
ok(qSv.plan && qSv.plan.entry === 106 && qSv.plan.stop === 101 && qSv.plan.t1 === 116 && qSv.plan.t2 === 123.5
   && Object.keys(qSv.plan).sort().join(',') === 'entry,stop,t1,t2',
   'Q: survivor plan reduced to exactly {entry, stop, t1, t2}');
ok(qState.rejected[0].sym === 'SOLUSDT' && qState.rejected[0].vetoGate === 'G2'
   && Object.keys(qState.rejected[0]).sort().join(',') === 'sym,vetoGate',
   'Q: rejected rows carry exactly {sym, vetoGate}');
ok(Object.isFrozen(qState) && Object.isFrozen(qState.survivors) && Object.isFrozen(qSv)
   && Object.isFrozen(qSv.plan) && Object.isFrozen(qState.rejected),
   'Q: the view is deep-frozen (state, rows and plan all frozen)');
const qState2 = globalThis.window.engineState();
ok(qState2 !== qState && qState2.survivors !== qState.survivors
   && JSON.stringify(qState2) === JSON.stringify(qState),
   'Q: each call hands a fresh deep copy with identical content');

/* honest abort (data layer gone) keeps the PREVIOUS good snapshot + original at */
delete globalThis.binancePerpUniverse; delete globalThis.binanceTickers24h;
const Q2 = freshPane();
tabQ.mount(Q2.pane);
Q2.stubs['#engineRun']._handler();
await waitScan(Q2.stubs);
ok(Q2.stubs['#engineStat'].textContent.indexOf('empty universe') >= 0,
   'Q: re-run aborts honestly (empty universe)');
const qState3 = globalThis.window.engineState();
ok(qState3 && qState3.at === qState.at && qState3.survivors.length === 1
   && qState3.survivors[0].sym === 'BTCUSDT' && qState3.rejected[0].vetoGate === 'G2',
   'Q: stale-good snapshot preserved after the abort (same at, same content)');

/* sabotaged internals: getter degrades to null, never throws, then recovers */
const keepIsArray = Array.isArray;
let qThrew = false, qGot = 'unset';
Array.isArray = undefined;
try{ qGot = globalThis.window.engineState(); }catch(e){ qThrew = true; }
Array.isArray = keepIsArray;
ok(!qThrew && qGot === null,
   'Q: getter never throws with sabotaged internals (Array.isArray removed) — returns null');
ok(globalThis.window.engineState() !== null, 'Q: getter recovers once internals are restored');

/* ================= R) combined universe — precedence, venue filter, config =================
   Fresh module instance (clean busy/hasRun closure). window.xuUniverse /
   window.xuCandles stub the parallel xuniverse.js contract. */
console.log('== xu combined universe: Stage-0 precedence + venue filter + config ==');
vm.runInThisContext(fs.readFileSync(root + 'engine.js', 'utf8'), { filename: 'engine.js' });
const tabX = globalThis.window.HG_tabs[globalThis.window.HG_tabs.length - 1];
const gateX = globalThis.window.gateCandidate;
const cfgX = globalThis.window.engineConfig;
ok(tabX && tabX.id === 'execute', 'R: fresh registration found');
ok(typeof cfgX === 'function', 'R: window.engineConfig exposed (pure config getter/setter)');

async function waitScan2(stubs){
  const t0 = Date.now();
  while (stubs['#engineRun'].disabled && Date.now() - t0 < 30000)
    await new Promise(function(res){ setTimeout(res, 25); });
}
function xuItem(sym, exchange, over){
  return Object.assign({ sym: sym, base: sym.replace('USDT', ''), exchange: exchange,
                         turnoverUsd: 50e6, mark: 106, fundingPct: 0.01, alsoOn: [] }, over || {});
}
let XU_SHAPES = {};
let xuCalls = [];
function stubXuCandles(){
  xuCalls = [];
  globalThis.window.xuCandles = function(item, tf){
    xuCalls.push({ sym: item.sym, tf: tf, ex: item.exchange });
    const shape = XU_SHAPES[item.sym] || 'pass';
    if (shape === 'throw') return Promise.reject(new Error('venue candle feed down'));
    if (shape === 'thin') return Promise.resolve(mkRows(120, 106, 0.25, 1.0));
    if (shape === 'weakclose') return Promise.resolve(mkRows(tf === '4h' ? 260 : 120, 106, 7, 3));
    if (shape === 'poison') return Promise.resolve(mkRows(tf === '4h' ? 260 : 120, 55555, 0.25, 1.0));
    return Promise.resolve(mkRows(tf === '4h' ? 260 : 120, 106, 0.25, 1.0));
  };
}
function stubBinanceLegacy(){
  globalThis.binancePerpUniverse = async function(){ return ['BTCUSDT']; };
  globalThis.binanceTickers24h = async function(){ return { BTCUSDT: { mark: 106, chg24: 2, turnoverUsd: 800e6 } }; };
  globalThis.binanceKlines = async function(sym, interval, limit){ return mkRows(limit || 260, 106, 0.25, 1.0); };
  globalThis.binanceFunding = async function(){ return { markPrice: 106, fundingPct: 0.01 }; };
}
function dropBinanceLegacy(){
  delete globalThis.binancePerpUniverse; delete globalThis.binanceTickers24h;
  delete globalThis.binanceKlines; delete globalThis.binanceFunding;
}
function stubXuPrereqs(){
  stubIndicators();
  globalThis.smartClassify = function(){ return { dir: 'long', longEv: ['stub: trend fuel'], shortEv: [], regime: [], score: 1, total: 1 }; };
  stubSmartSetup();
  globalThis.hgNewsRisk = function(){ return { blackout: false }; };
}
stubXuPrereqs(); cfgX({ venue: 'all', minTurnover: 1000000 });

/* R1 — fresh scanner results beat the xu universe (existing contract first) */
let xuUniCalls = 0;
globalThis.window.xuUniverse = async function(){ xuUniCalls++; return [xuItem('AAAUSDT', 'delta')]; };
stubXuCandles(); stubBinanceLegacy();
globalThis.window.HG_smartResults = ['BTCUSDT'];
const R1 = freshPane();
tabX.mount(R1.pane);
R1.stubs['#engineRun']._handler();
await waitScan2(R1.stubs);
ok(R1.stubs['#engineStat'].textContent.indexOf('scanner results · HG_smartResults') >= 0,
   'R: fresh scanner results take precedence over the xu combined universe');
ok(xuUniCalls === 0, 'R: xuUniverse is never even called while scanner results are fresh');
delete globalThis.window.HG_smartResults;

/* R2 — no scanner results, xu present, binance layer gone: combined universe used */
dropBinanceLegacy();
globalThis.window.xuUniverse = async function(){
  return [ xuItem('AAAUSDT', 'delta'), xuItem('BBBUSDT', 'coindcx', { turnoverUsd: null, fundingPct: null }) ];
};
stubXuCandles();
const R2 = freshPane();
tabX.mount(R2.pane);
ok(R2.pane._html.indexOf('id="engineVenue"') >= 0 && R2.pane._html.indexOf('id="engineTurn"') >= 0,
   'R: EXECUTE tab renders the VENUE + MIN TURNOVER config row');
ok(R2.pane._html.indexOf('$0.5M') >= 0 && R2.pane._html.indexOf('$1M') >= 0
   && R2.pane._html.indexOf('$10M') >= 0 && R2.pane._html.indexOf('$50M') >= 0,
   'R: turnover select offers $0.5M / $1M / $10M / $50M');
R2.stubs['#engineRun']._handler();
await waitScan2(R2.stubs);
const r2Stat = R2.stubs['#engineStat'].textContent, r2Html = R2.stubs['#engineCards'].innerHTML;
ok(r2Stat.indexOf('universe 2 (combined delta+coindcx universe · delta 1 · cdcx 1') >= 0,
   'R: combined universe drives the scan with per-exchange counts in the stat line');
ok(r2Stat.indexOf('done · 2 executions (2 STRONG · 2 with plans)') === 0,
   'R: both xu candidates pass the full funnel (delta + cdcx)');
ok(xuCalls.filter(function(c){ return c.tf === '4h'; }).length === 2
   && xuCalls.filter(function(c){ return c.tf === '1h'; }).length === 2,
   'R: passers fetch 4h then 1h through xuCandles (exchange-aware routing)');
ok(xuCalls.every(function(c){ return c.ex === 'delta' || c.ex === 'coindcx'; })
   && xuCalls.some(function(c){ return c.sym === 'BBBUSDT' && c.ex === 'coindcx'; }),
   'R: xuCandles receives the ORIGINAL universe row (raw exchange "coindcx", never the normalized key)');
ok(r2Html.indexOf('AAAUSDT') >= 0 && r2Html.indexOf('BBBUSDT') >= 0
   && r2Html.indexOf('turnover unverified — size down') >= 0,
   'R: CoinDCX card with unknown turnover renders the honest size-down warning');

/* R5 — venue filter DELTA pre-filters the combined universe */
cfgX({ venue: 'delta' });
globalThis.window.xuUniverse = async function(){
  return [ xuItem('AAAUSDT', 'delta'), xuItem('BBBUSDT', 'coindcx'), xuItem('CCCUSDT', 'delta') ];
};
stubXuCandles();
const R5 = freshPane();
tabX.mount(R5.pane);
ok(R5.stubs['#engineVenue'].value === 'delta', 'R: venue select reflects the effective config at mount');
R5.stubs['#engineRun']._handler();
await waitScan2(R5.stubs);
ok(R5.stubs['#engineStat'].textContent.indexOf('universe 2 (combined delta+coindcx universe · delta 2 · cdcx 0') >= 0
   && R5.stubs['#engineStat'].textContent.indexOf('venue DELTA (1 filtered out)') >= 0,
   'R: VENUE=DELTA scans delta items only and says what was filtered out');
ok(xuCalls.length === 4 && xuCalls.every(function(c){ return c.sym !== 'BBBUSDT'; }),
   'R: no candle request is ever fired for a filtered-out cdcx item');

/* R6 — venue filter CDCX */
cfgX({ venue: 'cdcx' });
stubXuCandles();
const R6 = freshPane();
tabX.mount(R6.pane);
R6.stubs['#engineRun']._handler();
await waitScan2(R6.stubs);
ok(R6.stubs['#engineStat'].textContent.indexOf('universe 1 (combined delta+coindcx universe · delta 0 · cdcx 1') >= 0,
   'R: VENUE=CDCX scans cdcx items only');
ok(xuCalls.every(function(c){ return c.sym === 'BBBUSDT'; }), 'R: only the cdcx item is gated');

/* R7 — venue filter empties the list: honest abort, NO silent binance fallback */
cfgX({ venue: 'delta' });
globalThis.window.xuUniverse = async function(){ return [ xuItem('BBBUSDT', 'coindcx') ]; };
stubBinanceLegacy();   /* present on purpose — must NOT be substituted */
const R7 = freshPane();
tabX.mount(R7.pane);
R7.stubs['#engineRun']._handler();
await waitScan2(R7.stubs);
ok(R7.stubs['#engineStat'].className === 'note warn'
   && R7.stubs['#engineStat'].textContent.indexOf('empty universe') >= 0
   && R7.stubs['#engineStat'].textContent.indexOf('venue DELTA') >= 0
   && R7.stubs['#engineStat'].textContent.indexOf('fallback') === -1,
   'R: a venue filter that empties the combined list aborts honestly (no silent Binance substitution)');
dropBinanceLegacy();

/* R8 — defensive dedupe by base asset per venue */
cfgX({ venue: 'all' });
globalThis.window.xuUniverse = async function(){
  return [ xuItem('AAAUSDT', 'delta'), xuItem('AAAUSDT', 'delta'), xuItem('AAABUSDT', 'coindcx', { base: 'AAA' }) ];
};
stubXuCandles();
const R8 = freshPane();
tabX.mount(R8.pane);
R8.stubs['#engineRun']._handler();
await waitScan2(R8.stubs);
ok(R8.stubs['#engineStat'].textContent.indexOf('universe 2 (combined') >= 0
   && xuCalls.filter(function(c){ return c.sym === 'AAAUSDT' && c.tf === '4h'; }).length === 1,
   'R: duplicate base-asset rows are deduped (3 raw → 2 unique candidates)');

/* R3 — xu returns an empty list: Binance fallback engages */
globalThis.window.xuUniverse = async function(){ return []; };
stubBinanceLegacy();
const R3 = freshPane();
tabX.mount(R3.pane);
R3.stubs['#engineRun']._handler();
await waitScan2(R3.stubs);
ok(R3.stubs['#engineStat'].textContent.indexOf('fallback: top 24 USDT perps') >= 0,
   'R: empty xu universe falls back to Binance top-24 honestly');

/* R4 — xu throws: Binance fallback engages */
globalThis.window.xuUniverse = async function(){ throw new Error('both venues down'); };
const R4 = freshPane();
tabX.mount(R4.pane);
R4.stubs['#engineRun']._handler();
await waitScan2(R4.stubs);
ok(R4.stubs['#engineStat'].textContent.indexOf('fallback: top 24 USDT perps') >= 0,
   'R: a throwing xuUniverse degrades to the Binance fallback, never a crash');

/* R9 — config persistence via localStorage (feature-checked, try-caught) */
const r9c = cfgX();
ok(r9c.venue === 'all' && r9c.minTurnover === 1000000, 'R: config defaults are ALL venues + $1M floor');
const r9store = {};
globalThis.localStorage = {
  getItem: function(k){ return (k in r9store) ? r9store[k] : null; },
  setItem: function(k, v){ r9store[k] = String(v); },
  removeItem: function(k){ delete r9store[k]; }
};
cfgX({ venue: 'cdcx' });
ok(r9store.hgEngineVenue === 'cdcx', 'R: venue choice persists to localStorage (hgEngineVenue)');
cfgX({ minTurnover: 50000000 });
ok(r9store.hgEngineMinTurn === '50000000', 'R: min-turnover choice persists to localStorage (hgEngineMinTurn)');
const r9eff = cfgX();
ok(r9eff.venue === 'cdcx' && r9eff.minTurnover === 50000000, 'R: getter reflects the stored effective config');
cfgX({ venue: 'all', minTurnover: 1000000 });
delete globalThis.localStorage;

/* ================= S) turnover floor math (pure gateCandidate) ================= */
console.log('== turnover floor: runtime select + null-turnover conviction halving ==');
stubXuPrereqs();
let s = gateX(longInp({ turnoverUsd: 9e6, minTurnover: 1e6 }));
ok(s.pass === true && s.trail[4].ok === true, 'S: $9M turnover passes when the runtime floor is $1M');
s = gateX(longInp({ turnoverUsd: 40e6, minTurnover: 50e6 }));
ok(s.pass === false && s.vetoGate === 'G4' && s.trail[4].note.indexOf('$50M floor') >= 0
   && s.trail[4].note.indexOf('$40M') >= 0,
   'S: $40M turnover vetoes at the $50M runtime floor with both numbers in the reason');
s = gateX(longInp({ turnoverUsd: 0.6e6, minTurnover: 0.5e6 }));
ok(s.pass === true, 'S: $600k turnover passes at the $0.5M floor (long tail judged by structure first)');
s = gateX(longInp({ turnoverUsd: 9e6, minTurnover: NaN }));
ok(s.pass === false && s.vetoGate === 'G4', 'S: NaN floor is rejected — gate falls back to the $10M default');
s = gateX(longInp({ turnoverUsd: 9e6, minTurnover: -5 }));
ok(s.pass === false && s.vetoGate === 'G4', 'S: negative floor is rejected — gate falls back to the $10M default');
s = gateX(longInp({ turnoverUsd: null, minTurnover: 50e6 }));
ok(s.pass === true && s.turnoverUnverified === true
   && s.trail[4].note.indexOf('turnover unverified — size down') >= 0,
   'S: null turnover NEVER auto-dies on the floor — passes with the unverified warning');
ok(s.riskPct === 0.5, 'S: null turnover halves conviction-backed risk (STRONG confirmed 1.0% → 0.5%)');
s = gateX(longInp({ turnoverUsd: 800e6 }));
ok(s.riskPct === 1.0 && !s.turnoverUnverified, 'S: verified turnover keeps the full 1.0% risk');
globalThis.smartSetup = function(cls){ return { type: 'SWING', dir: cls.dir, entry: 106, stop: 101, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 4.72, confirmed: false, note: '' }; };
s = gateX(longInp({ turnoverUsd: null }));
ok(s.riskPct === 0.25, 'S: unconfirmed plan + unverified turnover stack both halvings (1.0 → 0.5 → 0.25)');
stubSmartSetup();
s = gateX(longInp({ turnoverUsd: null }));
ok(s.trail[4].note.indexOf('turnover n/a') >= 0, 'S: legacy "turnover n/a" phrasing preserved in the G4 note');

/* ================= T) staged fetching + combined counts =================
   7 xu candidates: 2 pass (4h+1h), G0/G2/G3/G4 casualties + 1 candle-feed
   failure must NEVER trigger a 1h request. */
console.log('== staged fetching: 1h only for survivors, combined counts ==');
stubXuPrereqs(); cfgX({ venue: 'all', minTurnover: 1000000 });
dropBinanceLegacy();
XU_SHAPES = { WEAKUSDT: 'weakclose', THINUSDT: 'thin', BADUSDT: 'throw' };
globalThis.window.xuUniverse = async function(){
  return [
    xuItem('PASSAUSDT', 'delta'),
    xuItem('PASSBUSDT', 'coindcx', { turnoverUsd: null, fundingPct: null }),
    xuItem('WEAKUSDT', 'delta'),
    xuItem('THINUSDT', 'coindcx'),
    xuItem('FUNDYUSDT', 'delta', { fundingPct: 0.05 }),
    xuItem('POORUSDT', 'coindcx', { turnoverUsd: 0.4e6 }),
    xuItem('BADUSDT', 'delta')
  ];
};
stubXuCandles();
const T1 = freshPane();
tabX.mount(T1.pane);
const tStatEl = T1.pane.querySelector('#engineStat');
const tSeen = []; let tCur = '';
Object.defineProperty(tStatEl, 'textContent', { get: function(){ return tCur; }, set: function(v){ tCur = v; tSeen.push(v); } });
T1.stubs['#engineRun']._handler();
await waitScan2(T1.stubs);
const tCalls4 = xuCalls.filter(function(c){ return c.tf === '4h'; });
const tCalls1 = xuCalls.filter(function(c){ return c.tf === '1h'; });
ok(tCalls4.length === 7, 'T: 4h candles fetched for all 7 candidates (staged leg 1)');
ok(tCalls1.length === 2, 'T: 1h candles fetched ONLY for the 2 survivors — dead candidates never cost a 2nd request');
ok(tCalls1.map(function(c){ return c.sym; }).sort().join(',') === 'PASSAUSDT,PASSBUSDT',
   'T: the 1h requests are exactly the passing candidates');
ok(tCur.indexOf('done · 2 executions') === 0 && tCur.indexOf('5 aside') >= 0
   && tCur.indexOf('universe 7 (combined delta+coindcx universe · delta 4 · cdcx 3') >= 0
   && tCur.indexOf('ALL contracts') >= 0,
   'T: final stat carries survivors/aside + combined per-exchange universe counts');
ok(tSeen.some(function(v){ return /gating \d+\/7 · [A-Z0-9]+ · delta \d+ · cdcx \d+ · failed \d+/.test(v); }),
   'T: progress line shows "X/Y · sym · delta n · cdcx m · failed k" while scanning');
ok(T1.stubs['#engineAsideCount'].textContent === '5 rejected · delta 3 · cdcx 2',
   'T: WHY ASIDE header tallies rejections per exchange');
const tAside = T1.stubs['#engineAsideList'].innerHTML;
ok(tAside.indexOf('WEAKUSDT · delta') >= 0 && tAside.indexOf('THINUSDT · cdcx') >= 0
   && tAside.indexOf('POORUSDT · cdcx') >= 0,
   'T: WHY ASIDE rows carry the exchange tag next to each rejected symbol');
const tHtml = T1.stubs['#engineCards'].innerHTML;
ok(tHtml.indexOf('PASSAUSDT') >= 0 && tHtml.indexOf('PASSBUSDT') >= 0 && tHtml.indexOf('WEAKUSDT') === -1,
   'T: only survivors render cards');
const tState = globalThis.window.engineState();
ok(tState && tState.survivors.length === 2 && tState.rejected.length === 5,
   'T: BRAIN snapshot mirrors the xu scan (2 survivors / 5 rejected)');

/* G1-massacre: every candidate dies at structure — zero 1h requests */
globalThis.ema = function(vals){ return vals.map(function(){ return 100; }); };
globalThis.window.xuUniverse = async function(){
  return [ xuItem('G1AUSDT', 'delta'), xuItem('G1BUSDT', 'coindcx'), xuItem('G1CUSDT', 'delta') ];
};
stubXuCandles();
const T2 = freshPane();
tabX.mount(T2.pane);
T2.stubs['#engineRun']._handler();
await waitScan2(T2.stubs);
ok(xuCalls.filter(function(c){ return c.tf === '4h'; }).length === 3
   && xuCalls.filter(function(c){ return c.tf === '1h'; }).length === 0,
   'T: G1 casualties fetch 4h only — 1h is never requested for structure failures');
ok(T2.stubs['#engineStat'].textContent.indexOf('done · 0 executions') === 0
   && T2.stubs['#engineStat'].textContent.indexOf('3 aside') >= 0,
   'T: G1-massacre scan completes honestly (0 executions, 3 aside)');
stubIndicators();

/* ================= U) per-symbol failure isolation at 120-symbol scale ================= */
console.log('== failure isolation at scale (120-symbol fixture universe) ==');
stubXuPrereqs(); cfgX({ venue: 'all', minTurnover: 1000000 });
XU_SHAPES = {};
const uItems = [];
for (let ui = 0; ui < 120; ui++){
  const usym = 'U' + ui + 'USDT';
  if (ui >= 100 && ui < 110) XU_SHAPES[usym] = 'weakclose';
  else if (ui >= 110 && ui < 115) XU_SHAPES[usym] = 'throw';
  else if (ui >= 115) XU_SHAPES[usym] = 'poison';
  uItems.push(xuItem(usym, ui % 2 === 0 ? 'delta' : 'coindcx'));
}
globalThis.window.xuUniverse = async function(){ return uItems; };
stubXuCandles();
const uBaseEma = emaStub;
globalThis.ema = function(vals, p){
  if (vals[vals.length - 1] === 55555) throw new Error('poisoned rows');
  return uBaseEma(vals, p);
};
const U1 = freshPane();
tabX.mount(U1.pane);
U1.stubs['#engineRun']._handler();
await waitScan2(U1.stubs);
const uStat = U1.stubs['#engineStat'].textContent;
ok(xuCalls.filter(function(c){ return c.tf === '4h'; }).length === 120,
   'U: all 120 candidates got exactly one 4h request');
ok(xuCalls.filter(function(c){ return c.tf === '1h'; }).length === 100,
   'U: 1h fetched for the 100 survivors only (G2/G0 casualties + failures skipped)');
ok(uStat.indexOf('done · 100 executions') === 0 && uStat.indexOf('15 aside') >= 0,
   'U: 100 survivors + 15 gated rejections at 120-symbol scale');
ok(uStat.indexOf('5 symbols failed (skipped)') >= 0,
   'U: 5 hard per-symbol exceptions isolated as failures, never killing the scan');
ok(uStat.indexOf('universe 120 (combined delta+coindcx universe · delta 60 · cdcx 60') >= 0,
   'U: combined per-exchange universe counts honest at scale');
const uState = globalThis.window.engineState();
ok(uState && uState.survivors.length === 100 && uState.rejected.length === 15,
   'U: BRAIN snapshot consistent with the 120-symbol scan');
stubIndicators();

/* ================= V) xu* absent → legacy behavior intact ================= */
console.log('== xu absent: legacy Binance behavior intact ==');
delete globalThis.window.xuUniverse; delete globalThis.window.xuCandles;
XU_SHAPES = {};
stubXuPrereqs(); cfgX({ venue: 'all', minTurnover: 1000000 });
globalThis.binancePerpUniverse = async function(){ return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']; };
globalThis.binanceTickers24h = async function(){
  return { BTCUSDT: { mark: 106, chg24: 2,  turnoverUsd: 800e6 },
           ETHUSDT: { mark: 94,  chg24: -2, turnoverUsd: 500e6 },
           SOLUSDT: { mark: 106, chg24: 3,  turnoverUsd: 900e6 } };
};
globalThis.binanceFunding = async function(sym){ return { markPrice: sym === 'ETHUSDT' ? 94 : 106, fundingPct: 0.01 }; };
globalThis.binanceKlines = async function(sym, interval, limit){
  if (sym === 'BTCUSDT') return mkRows(limit || 260, 106, 0.25, 1.0);
  if (sym === 'ETHUSDT') return mkRows(limit || 260, 94, 1.0, 0.25);
  if (sym === 'SOLUSDT') return mkRows(limit || 260, 106, 7, 3);
  return [];
};
const V1 = freshPane();
tabX.mount(V1.pane);
V1.stubs['#engineRun']._handler();
await waitScan2(V1.stubs);
ok(V1.stubs['#engineStat'].textContent.indexOf('done · 2 executions') === 0
   && V1.stubs['#engineStat'].textContent.indexOf('universe 3 (fallback: top 24 USDT perps') >= 0,
   'V: with xu* absent the Binance top-24 fallback behaves exactly as before');
ok(V1.stubs['#engineAsideCount'].textContent === '1 rejected',
   'V: legacy aside count format unchanged (no exchange tallies without xu)');

/* ================= W) smartSetup decline → hgPlanLevels fallback =================
   USER BUG REPRO ('execute tab shows setups without tp and sl'): in combined
   mode the positioning legs are all null → the real smartClassify fires zero
   evidence → cls.dir = null → the real smartSetup guard (!cls.dir) declines.
   Pre-fix buildPlan respected that null with NO fallback — the ATR fallback
   only fired when the smartSetup GLOBAL was absent, which never happens in
   the browser (index.html defines it inline) → survivor cards rendered with
   no ENTRY/STOP/T1/T2. The hgPlanLevels fallback is now MANDATORY; only its
   absence or failure may leave the honest 'levels unavailable — size down'
   note — never a bare card. */
console.log('== smartSetup decline → hgPlanLevels fallback (plan-less survivor repro) ==');
stubXuPrereqs(); cfgX({ venue: 'all', minTurnover: 1000000 });
/* the REAL index.html behavior with null positioning evidence */
globalThis.smartClassify = function(){ return { dir: null, longEv: [], shortEv: [], regime: [], score: 0, total: 0 }; };
globalThis.smartSetup = function(cls, rows4h){
  if (!cls || !cls.dir || !rows4h || rows4h.length < 60) return null;   // the REAL index.html guard
  return { type: 'SWING', dir: cls.dir, entry: 106, stop: 101, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 4.72, confirmed: true, note: '' };
};
function stubHgPlanLevels(){
  globalThis.hgPlanLevels = function(dir, rows){                        // faithful index.html semantics
    if (dir !== 'long' && dir !== 'short') return null;
    if (!rows || !rows.length || typeof atr !== 'function') return null;
    const entry = +rows[rows.length - 1].c;
    const av = atr(rows, 14), a = av[av.length - 1];
    if (!isFinite(entry) || entry <= 0 || !isFinite(a) || a <= 0) return null;
    const stop = dir === 'long' ? entry - 1.5*a : entry + 1.5*a;
    const risk = Math.abs(entry - stop);
    return { dir: dir, entry: entry, stop: stop,
             t1: dir === 'long' ? entry + 2*risk : entry - 2*risk,
             t2: dir === 'long' ? entry + 3.5*risk : entry - 3.5*risk,
             risk: risk, note: 'ATR stop (no clean swing)' };
  };
}
delete globalThis.hgPlanLevels;
let w = gateX(longInp());
ok(w.pass === true && w.plan === null,
   'W-REPRO: cls.dir null (the combined-mode norm) → smartSetup declines and, with no fallback module loaded, the survivor is plan-less');

let hplArgs = [];
stubHgPlanLevels();
globalThis.hgPlanLevels = (function(orig){ return function(dir, rows){ hplArgs.push({ dir: dir, n: rows && rows.length }); return orig(dir, rows); }; })(globalThis.hgPlanLevels);
w = gateX(longInp());
ok(w.pass === true && w.plan !== null,
   'W-FIX: a smartSetup decline now falls back to hgPlanLevels — a survivor never renders bare');
ok(hplArgs.length === 1 && hplArgs[0].dir === 'long' && hplArgs[0].n === 260,
   'W: hgPlanLevels is called with (dir, rows4h)');
ok(w.plan && w.plan.type === 'LEVELS' && w.plan.entry === 106 && w.plan.stop === 103 && w.plan.t1 === 112 && w.plan.t2 === 116.5,
   'W: fallback levels normalized into the plan shape (entry 106 · stop 103 · T1 112 · T2 116.5)');
ok(Math.abs(w.plan.rr1 - 2) < 1e-9 && Math.abs(w.plan.rr2 - 3.5) < 1e-9 && Math.abs(w.plan.riskPct - 300/106) < 1e-9,
   'W: rr1/rr2/riskPct derived from the fallback levels, never fabricated');
ok(w.plan.note.indexOf('hgPlanLevels') >= 0, 'W: the fallback is labelled honestly in the plan note');
ok(w.plan.confirmed === true && w.riskPct === 1.0,
   'W: fallback plan CONFIRMED by the 4H 20/50 cascade → full STRONG risk policy');

hplArgs = [];
globalThis.smartSetup = function(cls){ return { type: 'SWING', dir: cls.dir || 'long', entry: 106, stop: 101, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 4.72, confirmed: true, note: '' }; };
w = gateX(longInp());
ok(w.plan && w.plan.type === 'SWING' && w.plan.entry === 106 && w.plan.stop === 101 && hplArgs.length === 0,
   'W: a sane smartSetup plan still wins — the fallback is never consulted');

globalThis.smartSetup = function(){ return { type: 'SWING', dir: 'long', entry: 106, stop: 110, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 3, confirmed: true, note: '' }; };
w = gateX(longInp());
ok(w.plan && w.plan.type === 'LEVELS' && w.plan.stop === 103,
   'W: garbage smartSetup output (stop above entry on a long) → sanity veto → hgPlanLevels fallback');

globalThis.smartSetup = function(){ return null; };
globalThis.hgPlanLevels = function(){ throw new Error('levels module exploded'); };
w = gateX(longInp());
ok(w.pass === true && w.plan === null, 'W: hgPlanLevels throwing → plan null, gates still pass, no crash');
globalThis.hgPlanLevels = function(){ return { dir: 'long', entry: 106, stop: 120, t1: 112, t2: 116.5, risk: 14, note: '' }; };
w = gateX(longInp());
ok(w.pass === true && w.plan === null, 'W: hgPlanLevels returning a wrong-side stop → sanity veto → null, never rendered');

stubHgPlanLevels();
globalThis.smartSetup = function(cls){ if (!cls || !cls.dir) return null; return { type: 'SWING', dir: 'short', entry: 94, stop: 99, t1: 84, t2: 76.5, rr1: 2, rr2: 3.5, riskPct: 5.32, confirmed: true, note: '' }; };
w = gateX(shortInp());
ok(w.pass === true && w.plan && w.plan.type === 'LEVELS' && w.plan.dir === 'short'
   && w.plan.entry === 94 && w.plan.stop === 97 && w.plan.t1 === 88 && w.plan.t2 === 83.5,
   'W: short fallback levels mirror (stop 97 > entry 94 > T1 88 > T2 83.5)');

globalThis.ema = function(vals, p){ const lc = vals[vals.length-1]; const t = {9:lc+4, 20:lc-8, 21:lc-1, 50:lc-6, 200:lc-16}; return vals.map(function(){ return t[p]; }); };
w = gateX(longInp());
ok(w.plan && w.plan.type === 'LEVELS' && w.plan.confirmed === false && w.riskPct === 0.5,
   'W: fallback plan UNCONFIRMED when the 20/50 cascade disagrees → suggested risk halved');
stubIndicators();

/* card-level repro: a full combined-mode scan must render ENTRY/STOP/T1/T2
   for a declined survivor, or a visible honest note — never a bare card */
stubXuPrereqs();
globalThis.smartClassify = function(){ return { dir: null, longEv: [], shortEv: [], regime: [], score: 0, total: 0 }; };
globalThis.smartSetup = function(cls, rows4h){ if (!cls || !cls.dir || !rows4h || rows4h.length < 60) return null; return { type: 'SWING', dir: cls.dir, entry: 106, stop: 101, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 4.72, confirmed: true, note: '' }; };
stubHgPlanLevels();
dropBinanceLegacy();
XU_SHAPES = {};
globalThis.window.xuUniverse = async function(){ return [ xuItem('BAREUSDT', 'delta') ]; };
stubXuCandles();
const W1 = freshPane();
tabX.mount(W1.pane);
W1.stubs['#engineRun']._handler();
await waitScan2(W1.stubs);
const wHtml = W1.stubs['#engineCards'].innerHTML;
ok(W1.stubs['#engineStat'].textContent.indexOf('done · 1 executions (1 STRONG · 1 with plans)') === 0,
   'W: the declined survivor now counts as planned in the stat line');
ok(wHtml.indexOf('ENTRY <b>106</b>') >= 0 && wHtml.indexOf('STOP <b>103</b>') >= 0
   && wHtml.indexOf('T1 112') >= 0 && wHtml.indexOf('T2 116.5') >= 0 && wHtml.indexOf('LEVELS') >= 0,
   'W: the survivor card renders real ENTRY/STOP/T1/T2 via the hgPlanLevels fallback');
delete globalThis.hgPlanLevels;
stubXuCandles();
const W2 = freshPane();
tabX.mount(W2.pane);
W2.stubs['#engineRun']._handler();
await waitScan2(W2.stubs);
const w2Html = W2.stubs['#engineCards'].innerHTML;
ok(w2Html.indexOf('BAREUSDT') >= 0 && w2Html.indexOf('class="plan"') >= 0
   && w2Html.toLowerCase().indexOf('levels unavailable') >= 0 && w2Html.toLowerCase().indexOf('size down') >= 0
   && w2Html.indexOf('ENTRY <b>') === -1,
   'W: fallback unavailable → the card still carries a visible "levels unavailable — size down" plan block (never bare)');
ok(W2.stubs['#engineStat'].textContent.indexOf('0 with plans') >= 0,
   'W: the stat line counts the plan-less survivor honestly');

/* ================= X) staged 1h fetch preserved for declining survivors ================= */
console.log('== staged 1h fetch feeds the plan builder even when smartSetup declines ==');
stubXuPrereqs(); cfgX({ venue: 'all', minTurnover: 1000000 });
globalThis.smartClassify = function(){ return { dir: null, longEv: [], shortEv: [], regime: [], score: 0, total: 0 }; };
const setupCalls = [];
globalThis.smartSetup = function(cls, rows4h, rows1h){
  setupCalls.push({ n4: rows4h && rows4h.length, n1: (rows1h && rows1h.length) || 0 });
  if (!cls || !cls.dir) return null;
  return { type: 'SWING', dir: cls.dir, entry: 106, stop: 101, t1: 116, t2: 123.5, rr1: 2, rr2: 3.5, riskPct: 4.72, confirmed: true, note: '' };
};
stubHgPlanLevels();
XU_SHAPES = { WEAKUSDT: 'weakclose' };
globalThis.window.xuUniverse = async function(){ return [ xuItem('PASSAUSDT', 'delta'), xuItem('PASSBUSDT', 'coindcx'), xuItem('WEAKUSDT', 'delta') ]; };
stubXuCandles();
const X1 = freshPane();
tabX.mount(X1.pane);
X1.stubs['#engineRun']._handler();
await waitScan2(X1.stubs);
ok(xuCalls.filter(function(c){ return c.tf === '4h'; }).length === 3
   && xuCalls.filter(function(c){ return c.tf === '1h'; }).length === 2,
   'X: staged fetch intact — 4h for all 3 candidates, 1h for the 2 survivors only');
ok(setupCalls.filter(function(c){ return c.n1 === 120; }).length === 2,
   'X: smartSetup re-invoked with the staged 1h rows for both survivors (the 1h leg still feeds the plan builder)');
ok(X1.stubs['#engineStat'].textContent.indexOf('done · 2 executions (2 STRONG · 2 with plans)') === 0,
   'X: both declining survivors still render plans (via hgPlanLevels) after the staged re-run');

/* ================= Y) QUICK RESCAN =================
   New button beside RUN: reuses the cached universe (never a forced refetch),
   re-gates ONLY last scan's survivors + new listings on fresh candles; every
   other candidate keeps its prior verdict + age. */
console.log('== QUICK RESCAN: cached universe, survivors + new listings only ==');
vm.runInThisContext(fs.readFileSync(root + 'engine.js', 'utf8'), { filename: 'engine.js' });
const tabY = globalThis.window.HG_tabs[globalThis.window.HG_tabs.length - 1];
ok(typeof globalThis.window.engineQuickTargets === 'function', 'Y: window.engineQuickTargets exposed (pure quick-rescan diff)');

let qt = globalThis.window.engineQuickTargets(['A','B','C'], ['A'], ['A','B','C']);
ok(qt.recheck.join(',') === 'A' && qt.newListings.length === 0 && qt.unchanged.join(',') === 'B,C' && qt.gone.length === 0,
   'Y: engineQuickTargets — the survivor is rechecked, the rest unchanged');
qt = globalThis.window.engineQuickTargets(['A','B','C'], ['A'], ['A','B','C','D']);
ok(qt.recheck.join(',') === 'A' && qt.newListings.join(',') === 'D' && qt.unchanged.join(',') === 'B,C',
   'Y: engineQuickTargets — universe additions surface as new listings');
qt = globalThis.window.engineQuickTargets(['A','B','C'], ['A'], ['B','C']);
ok(qt.recheck.length === 0 && qt.gone.join(',') === 'A' && qt.unchanged.join(',') === 'B,C',
   'Y: engineQuickTargets — a vanished survivor is "gone" (verdict kept), never silently dropped');
qt = globalThis.window.engineQuickTargets(null, null, null);
ok(qt && qt.recheck.length === 0 && qt.newListings.length === 0 && qt.unchanged.length === 0 && qt.gone.length === 0,
   'Y: engineQuickTargets tolerates null inputs without throwing');

const Y0 = freshPane();
tabY.mount(Y0.pane);
ok(Y0.pane._html.indexOf('id="engineQuick"') >= 0 && Y0.pane._html.indexOf('QUICK RESCAN') >= 0,
   'Y: QUICK RESCAN button rendered beside RUN');
ok(typeof Y0.stubs['#engineQuick']._handler === 'function', 'Y: QUICK RESCAN wired to a click handler');

stubXuPrereqs();
delete globalThis.hgPlanLevels;
dropBinanceLegacy();
XU_SHAPES = { WEAKUSDT: 'weakclose' };
const yUniForce = [];
globalThis.window.xuUniverse = async function(force){ yUniForce.push(force); return [ xuItem('GOODUSDT', 'delta'), xuItem('WEAKUSDT', 'delta') ]; };
stubXuCandles();
Y0.stubs['#engineQuick']._handler();
await new Promise(function(res){ setTimeout(res, 50); });
ok(Y0.stubs['#engineStat'].className === 'note warn'
   && Y0.stubs['#engineStat'].textContent.indexOf('run a full scan first') >= 0,
   'Y: QUICK before any full scan → honest visible note, no work fabricated');
ok(xuCalls.length === 0, 'Y: pre-run QUICK fires zero candle requests');

Y0.stubs['#engineRun']._handler();
await waitScan2(Y0.stubs);
ok(Y0.stubs['#engineStat'].textContent.indexOf('done · 1 executions') === 0, 'Y: baseline full scan completes (1 execution, 1 aside)');
const yUniCallsAfterFull = yUniForce.length;
stubXuCandles();
Y0.stubs['#engineQuick']._handler();
await waitScan2(Y0.stubs);
const yStat = Y0.stubs['#engineStat'].textContent;
ok(yStat.indexOf('quick rescan: 1 checked · 1 unchanged') === 0,
   'Y: stat reports "quick rescan: 1 checked · 1 unchanged"');
ok(yUniForce.length === yUniCallsAfterFull + 1 && yUniForce[yUniForce.length - 1] !== true,
   'Y: the universe list is cache-served — never a forced refetch');
ok(xuCalls.length === 2 && xuCalls.every(function(c){ return c.sym === 'GOODUSDT'; })
   && xuCalls.filter(function(c){ return c.tf === '4h'; }).length === 1
   && xuCalls.filter(function(c){ return c.tf === '1h'; }).length === 1,
   'Y: fresh candles re-fetched for the prior survivor only (4h+1h) — the rejected candidate keeps its verdict for free');
ok(Y0.stubs['#engineCards'].innerHTML.indexOf('GOODUSDT') >= 0
   && Y0.stubs['#engineAsideList'].innerHTML.indexOf('WEAKUSDT') >= 0,
   'Y: survivor card + prior WHY ASIDE verdict both still rendered');
const yState = globalThis.window.engineState();
ok(yState && yState.survivors.length === 1 && yState.rejected.length === 1 && yState.survivors[0].sym === 'GOODUSDT',
   'Y: BRAIN snapshot refreshed after the quick rescan');

globalThis.window.xuUniverse = async function(force){ yUniForce.push(force); return [ xuItem('GOODUSDT', 'delta'), xuItem('WEAKUSDT', 'delta'), xuItem('NEWUSDT', 'coindcx') ]; };
stubXuCandles();
Y0.stubs['#engineQuick']._handler();
await waitScan2(Y0.stubs);
const y2Stat = Y0.stubs['#engineStat'].textContent;
ok(y2Stat.indexOf('quick rescan: 2 checked · 1 unchanged') === 0 && y2Stat.indexOf('1 new listing') >= 0,
   'Y: a new listing is detected from the cached universe and gated — "2 checked · 1 unchanged (1 new listing)"');
ok(xuCalls.filter(function(c){ return c.sym === 'NEWUSDT' && c.tf === '4h'; }).length === 1
   && xuCalls.filter(function(c){ return c.sym === 'NEWUSDT' && c.tf === '1h'; }).length === 1
   && xuCalls.filter(function(c){ return c.sym === 'WEAKUSDT'; }).length === 0,
   'Y: the new listing gets the full staged treatment; the rejected one is still untouched');
ok(Y0.stubs['#engineCards'].innerHTML.indexOf('NEWUSDT') >= 0, 'Y: new-listing survivor card rendered');

XU_SHAPES = { GOODUSDT: 'weakclose', NEWUSDT: 'weakclose' };
stubXuCandles();
Y0.stubs['#engineQuick']._handler();
await waitScan2(Y0.stubs);
const y3Stat = Y0.stubs['#engineStat'].textContent;
ok(y3Stat.indexOf('quick rescan: 2 checked · 1 unchanged') === 0 && y3Stat.indexOf('0 executions') >= 0,
   'Y: survivors whose fresh candles now veto are re-gated honestly — 0 executions remain');
ok(Y0.stubs['#engineCards'].innerHTML.indexOf('GOODUSDT') === -1
   && Y0.stubs['#engineAsideList'].innerHTML.indexOf('GOODUSDT') >= 0
   && Y0.stubs['#engineAsideList'].innerHTML.indexOf('NEWUSDT') >= 0,
   'Y: flipped survivors leave the cards and land in WHY ASIDE with their new veto');
ok(Y0.stubs['#engineEmpty'].style.display === 'block', 'Y: empty state returns when no survivors remain');
const y3State = globalThis.window.engineState();
ok(y3State && y3State.survivors.length === 0 && y3State.rejected.length === 3,
   'Y: BRAIN snapshot mirrors the flips (0 survivors / 3 rejected)');

stubXuCandles();
Y0.stubs['#engineQuick']._handler();
await waitScan2(Y0.stubs);
ok(Y0.stubs['#engineStat'].textContent.indexOf('quick rescan: 0 checked · 3 unchanged') === 0
   && xuCalls.length === 0,
   'Y: nothing to re-gate → "0 checked · 3 unchanged", zero candle requests');

XU_SHAPES = { WEAKUSDT: 'weakclose' };
stubXuCandles();
Y0.stubs['#engineRun']._handler();
await waitScan2(Y0.stubs);
ok(Y0.stubs['#engineStat'].textContent.indexOf('done · 2 executions') === 0, 'Y: fresh full scan re-seeds the cache (2 executions)');
globalThis.window.xuUniverse = async function(){ throw new Error('universe feed down'); };
stubXuCandles();
Y0.stubs['#engineQuick']._handler();
await waitScan2(Y0.stubs);
const y4Stat = Y0.stubs['#engineStat'].textContent;
ok(y4Stat.indexOf('quick rescan: 2 checked') === 0 && y4Stat.indexOf('cached universe') >= 0,
   'Y: universe-list failure during QUICK → cached universe reused with an honest note, survivors still re-gated');
ok(xuCalls.filter(function(c){ return c.sym === 'GOODUSDT' && c.tf === '4h'; }).length === 1,
   'Y: re-gating continued on the cached universe items despite the list failure');

/* legacy mode + busy guard */
console.log('== QUICK RESCAN: legacy mode + busy guard ==');
vm.runInThisContext(fs.readFileSync(root + 'engine.js', 'utf8'), { filename: 'engine.js' });
const tabZ = globalThis.window.HG_tabs[globalThis.window.HG_tabs.length - 1];
stubXuPrereqs();
delete globalThis.hgPlanLevels;
delete globalThis.window.xuUniverse; delete globalThis.window.xuCandles;
globalThis.binancePerpUniverse = async function(){ return ['BTCUSDT', 'SOLUSDT']; };
globalThis.binanceTickers24h = async function(){
  return { BTCUSDT: { mark: 106, chg24: 2, turnoverUsd: 800e6 },
           SOLUSDT: { mark: 106, chg24: 3, turnoverUsd: 900e6 } };
};
globalThis.binanceFunding = async function(){ return { markPrice: 106, fundingPct: 0.01 }; };
let zKlineCalls = [];
globalThis.binanceKlines = async function(sym, interval, limit){
  zKlineCalls.push({ sym: sym, tf: interval });
  if (sym === 'SOLUSDT') return mkRows(limit || 260, 106, 7, 3);
  return mkRows(limit || 260, 106, 0.25, 1.0);
};
const Z0 = freshPane();
tabZ.mount(Z0.pane);
Z0.stubs['#engineRun']._handler();
await waitScan2(Z0.stubs);
ok(Z0.stubs['#engineStat'].textContent.indexOf('done · 1 executions') === 0, 'Y-legacy: baseline full scan (1 execution, 1 aside)');
zKlineCalls = [];
Z0.stubs['#engineQuick']._handler();
await waitScan2(Z0.stubs);
const zStat = Z0.stubs['#engineStat'].textContent;
ok(zStat.indexOf('quick rescan: 1 checked · 1 unchanged') === 0, 'Y-legacy: stat counts hold in legacy mode');
ok(zStat.indexOf('new-listing detection needs the combined universe') >= 0,
   'Y-legacy: honest note that new-listing detection needs the combined universe');
ok(zKlineCalls.length === 2 && zKlineCalls.every(function(c){ return c.sym === 'BTCUSDT'; }),
   'Y-legacy: only the prior survivor re-gathers fresh candles (4h+1h)');

const zDef = [];
globalThis.binanceKlines = function(sym, interval, limit){
  return new Promise(function(res){ zDef.push(function(){ res(mkRows(limit || 260, 106, 0.25, 1.0)); }); });
};
Z0.stubs['#engineRun']._handler();
await new Promise(function(res){ setTimeout(res, 60); });
const zDefBefore = zDef.length, zStatBusy = Z0.stubs['#engineStat'].textContent;
Z0.stubs['#engineQuick']._handler();
await new Promise(function(res){ setTimeout(res, 60); });
ok(Z0.stubs['#engineStat'].textContent === zStatBusy && zDef.length === zDefBefore,
   'Y: QUICK during a running scan is a no-op (busy guard) — stat untouched, zero extra fetches');
zDef.forEach(function(r){ r(); });
await waitScan2(Z0.stubs);

console.log('\nALL ' + passed + ' ENGINE ASSERTIONS PASSED');
