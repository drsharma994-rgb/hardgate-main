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
   'only gateCandidate + HG_tabs leak onto window');

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

console.log('\nALL ' + passed + ' ENGINE ASSERTIONS PASSED');
