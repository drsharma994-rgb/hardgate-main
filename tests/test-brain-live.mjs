/* HARDGATE — BRAIN tab live-fire audit at full universe scale (Node 18+, builtins only).
   Proves the BRAIN tab functions end-to-end over the 500+ contract combined
   Delta India + CoinDCX universe, driven through the WARM UP LAYERS button:
     A) deterministic 520-contract universe (half delta / half coindcx, 15
        non-crypto bases that BASE_BLOCK must gate out, shuffled turnover,
        two null-turnover rows) — exact expected candidate math pinned
     B) WARM UP -> synthesis: 3 fake HG_warmups hooks (engine registered FIRST
        must run LAST; one throws -> 'error:'), every layer getter seeded with
        realistic directional evidence (BTC PRIME 7 layers, ETH + ALT007 HIGH
        4 layers, SOL veto aside), xuCandles stubbed with house kline rows
     C) quick rescan over a 45-watch scan: the fetch cap must bind AND the
        stat line must SAY so (regression cover for the cap note)
   No live network anywhere. Run: node tests/test-brain-live.mjs */

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
async function waitFor(cond, ms){
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < (ms || 30000)) await sleep(25);
  return cond();
}

/* ---- harness, copied from tests/test-brain.mjs ---- */
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
  return globalThis.window;
}
/* house kline row shape (same as test-brain.mjs fakeRows) */
function fakeRows(n){
  const rows = []; const t0 = 1700000000 - (n || 120) * 14400;
  for (let i = 0; i < (n || 120); i++)
    rows.push({ t: t0 + i * 14400, o: 100, h: 101, l: 99, c: 100.5, v: 1000 });
  return rows;
}
async function runAndWait(stubs){
  stubs['#brainRun']._handler();
  const t0 = Date.now();
  while (stubs['#brainRun'].disabled && Date.now() - t0 < 30000)
    await sleep(25);
}
async function waitIdle(stubs){
  const t0 = Date.now();
  while (stubs['#brainRun'].disabled && Date.now() - t0 < 30000)
    await sleep(25);
}

/* ================= A) the 520-contract deterministic universe ================= */
console.log('== A) 520-contract universe generator: exact candidate math ==');
/* non-crypto bases Delta India lists as perps — brain.js BASE_BLOCK must gate
   every one of them out of the crypto candidate universe */
const BLOCKED = ['XAG','CL','SPX','BANK','XAUT','NIFTY','SLVON','NATGAS','BANKNIFTY',
                 'EURUSD','DXY','VIX','CORN','WHEAT','UK100'];   /* 15 */
const XU520 = [];
{
  const bases = BLOCKED.concat(['BTC', 'ETH', 'SOL']);
  for (let n = 1; n <= 502; n++) bases.push('ALT' + String(n).padStart(3, '0'));
  assert(bases.length === 520, 'generator builds exactly 520 contracts — got ' + bases.length);
  for (let i = 0; i < bases.length; i++){
    const ex = (i % 2 === 0) ? 'delta' : 'coindcx';
    const base = bases[i];
    XU520.push({
      sym: ex === 'delta' ? base + 'USDT' : 'B-' + base + '_USDT',
      base: base,
      exchange: ex,                                  /* xuniverse.js emits 'coindcx' verbatim */
      /* deterministic but shuffled turnover — ordering genuinely exercised;
         ALT251 + ALT502 deliberately null (unknown-turnover branch) */
      turnoverUsd: (base === 'ALT251' || base === 'ALT502') ? null : (((i * 7919) % 520) + 1) * 1e6,
      mark: 1 + (i % 97), fundingPct: null, alsoOn: null
    });
  }
}
let rawDelta = 0, rawCdcx = 0, expDelta = 0, expCdcx = 0;
for (const it of XU520){
  if (it.exchange === 'delta') rawDelta++; else rawCdcx++;
  if (BLOCKED.indexOf(it.base) >= 0) continue;
  if (it.exchange === 'delta') expDelta++; else expCdcx++;
}
const expTotal = expDelta + expCdcx;
assert(rawDelta === 260 && rawCdcx === 260, 'raw universe half delta / half coindcx (260 + 260) — got ' + rawDelta + '/' + rawCdcx);
assert(expTotal === 505 && expDelta === 252 && expCdcx === 253,
       'expected crypto candidates pinned: 505 = 520 - 15 blocked (delta 252 + cdcx 253) — got ' + expTotal + ' (' + expDelta + '/' + expCdcx + ')');

/* ================= B) WARM UP -> full synthesis over 505 candidates ================= */
console.log('== B) #brainWarm -> warm-up ledger -> auto-fired synthesis at scale ==');
{
  const W = freshBrain();
  /* --- layer getters: realistic snapshots, directional evidence for a few --- */
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'no high-impact USD events within 36h' }; };
  W.hgNewsState = function(){ return { loaded: true, events: [] }; };
  W.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', size: 'full', sizeNote: 'full size' } }; };
  W.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
  W.onchainState = function(){ return { bias: 'bullish', evidence: [{ side: 'bull', text: 'miners healthy' }], flags: {} }; };
  W.engineState = function(){
    return { survivors: [
               { sym: 'BTCUSDT', dir: 'long', conviction: 'STRONG',
                 plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 }, gatesPassed: 6 },   /* engineState real shape: no dir on plan */
               { sym: 'ETHUSDT', dir: 'long', conviction: 'MODERATE',
                 plan: { entry: 50, stop: 47, t1: 56, t2: 60.5 }, gatesPassed: 5 },
               { sym: 'ALT007USDT', dir: 'long', conviction: 'MODERATE',
                 plan: null, gatesPassed: 4 } ],                                          /* survivor without a plan -> candle fallback */
             rejected: [ { sym: 'SOLUSDT', vetoGate: 'G4', dir: 'long', gatesPassed: 4 } ], at: 123 };
  };
  W.oiflowState = function(){ return { results: [
    { sym: 'BTCUSDT', dir: 'LONG', evidence: 3, cls: 'NEW LONGS (trend fuel)' },
    { sym: 'ETHUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
    { sym: 'ALT007USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  W.squeezeState = function(){ return { results: [
    { sym: 'BTCUSDT', kind: 'fired', dir: 'long' },
    { sym: 'ETHUSDT', kind: 'fired', dir: 'long' },
    { sym: 'ALT007USDT', kind: 'fired', dir: 'long' } ] }; };
  W.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'short-flush', ratio: 0.3, text: 'SHORT FLUSH' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 2e6 }; } }; };
  W.liqFlushSetup = function(){ return { type: 'FLUSH-REVERSAL', dir: 'long', flushSide: 'short', sym: 'BTCUSDT', flushUsd: 5e6 }; };
  W.goldspotState = function(){ return { basisPct: 0.01, verdict: 'balanced' }; };
  W.__hgGoldDeepVerdict = { label: 'BULLISH', score: 71, dir: 'long', ts: 1 };
  /* only the majors exist on the legacy ticker feed — the other 500+ contracts
     are present in the universe but absent from tickers, on purpose */
  W.binanceTickers24h = async function(){ return {
    BTCUSDT: { symbol: 'BTCUSDT', mark: 100, chg24: 2, turnoverUsd: 9e9 },
    ETHUSDT: { symbol: 'ETHUSDT', mark: 50, chg24: -1, turnoverUsd: 5e9 },
    SOLUSDT: { symbol: 'SOLUSDT', mark: 20, chg24: 3, turnoverUsd: 2e9 } }; };
  let planCalls = 0;
  W.hgPlanLevels = function(dir, rows){ planCalls++; return { dir: dir, entry: 10, stop: 9, t1: 12, t2: 13 }; };
  W.toTrade = function(){};

  /* --- combined universe + lazy candle stubs --- */
  const forces = [];
  W.xuUniverse = async function(force){ forces.push(force); return XU520; };
  const xuCalls = [], statSnaps = [];
  const PB = freshPane();
  W.xuCandles = function(item, tf, n){
    xuCalls.push(item.sym);
    statSnaps.push(PB.stubs['#brainStat'].textContent);
    return Promise.resolve(fakeRows(n));
  };

  /* --- 3 fake warm hooks: engine registered FIRST (must run LAST), one throws --- */
  const ran = [];
  W.HG_warmups = [
    { id: 'engine', label: 'EXECUTE', run: async function(){ ran.push('engine'); return 'warmed'; } },
    { id: 'news',   label: 'NEWS',    run: async function(){ ran.push('news'); return 'warmed'; } },
    { id: 'boom',   label: 'BOOM',    run: async function(){ ran.push('boom'); throw new Error('kaboom'); } }
  ];

  const tab = W.HG_tabs.find(function(t){ return t.id === 'brain'; });
  tab.mount(PB.pane);
  assert(PB.pane._html.indexOf('id="brainWarm"') >= 0 && PB.pane._html.indexOf('WARM UP LAYERS') >= 0,
         'WARM UP LAYERS button rendered');
  assert(typeof PB.stubs['#brainWarm']._handler === 'function', 'WARM UP button wired to a click handler');
  assert(PB.stubs['#brainVenue'].style.display === '', 'venue select visible with the combined feed present');

  /* fire the warm-up; it must warm the layers, then auto-fire the synthesis */
  PB.stubs['#brainWarm']._handler();
  const done = await waitFor(function(){
    return PB.stubs['#brainStat'].textContent.indexOf('done ·') === 0;
  }, 30000);
  const bStat = PB.stubs['#brainStat'].textContent;
  const bCards = PB.stubs['#brainCards'].innerHTML;
  const bWatch = PB.stubs['#brainWatch'].innerHTML;
  const bAside = PB.stubs['#brainAside'].innerHTML;
  const bDeps = PB.stubs['#brainDeps'].textContent;

  assert(done, 'stat reaches "done ·" after the warm-up auto-fires the synthesis — got "' + bStat + '"');
  assert(bStat.indexOf('done · 1 PRIME · 2 HIGH · 0 watch · 503 aside') === 0,
         'buckets over 506 rows: 1 PRIME · 2 HIGH · 0 watch · 503 aside — got "' + bStat + '"');
  assert(bStat.indexOf('universe ' + expTotal + ' (delta ' + expDelta + ' + cdcx ' + expCdcx + ')') >= 0,
         'stat universe count exact: universe 505 (delta 252 + cdcx 253) — got "' + bStat + '"');
  assert(PB.stubs['#brainReadUni'].textContent === 'universe 505 (delta 252 + cdcx 253) · 3 prime/high · 0 watch',
         'MARKET READ header carries the exact combined counts — got "' + PB.stubs['#brainReadUni'].textContent + '"');
  assert(ran.join(',') === 'news,boom,engine', 'warm hooks ran in order, engine LAST despite being registered first — got ' + ran.join(','));
  assert(bDeps.indexOf('BOOM: error: kaboom') >= 0,
         'throwing hook captured as error: in #brainDeps, never kills the run — got "' + bDeps + '"');
  assert(bDeps.indexOf('warm-up ·') >= 0 && bDeps.indexOf('NEWS: warmed') >= 0 && bDeps.indexOf('EXECUTE: warmed') >= 0,
         'warm-up ledger names every hook result — got "' + bDeps + '"');
  assert(PB.stubs['#brainWarm'].disabled === false, '#brainWarm re-enabled at the end');
  assert(PB.stubs['#brainRun'].disabled === false, '#brainRun re-enabled at the end');
  assert(forces.length >= 1 && forces.every(function(f){ return f !== true; }),
         'universe feed read from cache, never force-refetched — forces=' + JSON.stringify(forces));

  /* ---- every rendered setup card honors the TP/SL contract ---- */
  const cardSegs = bCards.split('<div class="card ').slice(1);
  assert(cardSegs.length === 3, 'exactly 3 setup cards rendered (BTC PRIME + ETH/ALT007 HIGH) — got ' + cardSegs.length);
  assert(cardSegs.every(function(s){ return s.indexOf('ENTRY <b>') >= 0 && s.indexOf('STOP <b>') >= 0 && s.indexOf('T1 <b>') >= 0; }),
         'EVERY rendered setup card contains ENTRY, STOP and T1 HTML — the TP/SL contract');

  /* ---- BTC PRIME card: alias-matched layers, engine plan verbatim ---- */
  assert(bCards.indexOf('B-BTC_USDT') >= 0 && bCards.indexOf('PRIME · 7 LAYERS') >= 0 && bCards.indexOf('>LONG</span>') >= 0,
         'BTC PRIME card: cdcx sym, LONG, 7 agreeing layers (regime+rotation+onchain+engine+oiflow+squeeze+liqs)');
  assert(bCards.indexOf('ENTRY <b>100</b> · STOP <b>95</b>') >= 0 && bCards.indexOf('T1 <b>110</b> (2R)') >= 0
         && bCards.indexOf('T2 <b>117.5</b>') >= 0 && bCards.indexOf('gate engine') >= 0,
         'BTC card uses the gate engine plan verbatim — levels never invented');
  assert(bCards.indexOf('COINDCX') >= 0 && bCards.indexOf('toTrade(&quot;B-BTC_USDT&quot;,&quot;long&quot;,100,95,110)') >= 0,
         'BTC card: COINDCX venue stamp + xu-sym toTrade payload');

  /* ---- ETH HIGH card: engine plan, DELTA stamp ---- */
  assert(bCards.indexOf('ETHUSDT') >= 0 && bCards.indexOf('HIGH · 4 LAYERS') >= 0
         && bCards.indexOf('ENTRY <b>50</b> · STOP <b>47</b>') >= 0 && bCards.indexOf('T1 <b>56</b> (2R)') >= 0,
         'ETH HIGH card: 4 layers, engine plan rendered');
  assert(bCards.indexOf('DELTA') >= 0, 'delta-listed card carries the DELTA venue stamp');

  /* ---- ALT007 HIGH card: engine survivor WITHOUT a plan -> fetched-candle fallback ---- */
  assert(bCards.indexOf('ALT007USDT') >= 0 && bCards.indexOf('ENTRY <b>10</b> · STOP <b>9</b>') >= 0
         && bCards.indexOf('T1 <b>12</b> (2R)') >= 0 && bCards.indexOf('hgPlanLevels') >= 0,
         'ALT007 card planned from prefetched 4h rows via the hgPlanLevels fallback');
  assert(planCalls === 1, 'hgPlanLevels consulted exactly once — only the engine-plan-less card (got ' + planCalls + ')');

  /* ---- lazy bounded candle fetching at scale ---- */
  assert(xuCalls.length === 3, 'candles fetched ONLY for the 3 WATCH-or-better candidates out of 505 — got ' + xuCalls.length);
  assert(xuCalls[0] === 'B-BTC_USDT', 'highest-evidence-first: the PRIME BTC candidate fetches first — got ' + xuCalls.join(','));
  assert(xuCalls.indexOf('ETHUSDT') >= 0 && xuCalls.indexOf('ALT007USDT') >= 0
         && xuCalls.indexOf('B-SOL_USDT') === -1 && xuCalls.indexOf('SOLUSDT') === -1,
         'ASIDE candidates (SOL veto) never trigger a candle fetch');
  assert(statSnaps.some(function(s){ return /^\d+\/3 candidates · delta 252 · cdcx 253$/.test(s); }),
         'fetch progress reports X/3 candidates · delta 252 · cdcx 253 — saw "' + statSnaps[0] + '"');

  /* ---- blocked non-crypto bases never appear anywhere in the render ---- */
  const ledgers = bCards + '\n' + bWatch + '\n' + bAside;
  const leaked = [];
  for (const b of BLOCKED){
    if (ledgers.indexOf('>' + b + '</span>') >= 0 || ledgers.indexOf(b + 'USDT') >= 0
        || ledgers.indexOf('B-' + b + '_USDT') >= 0) leaked.push(b);
  }
  assert(leaked.length === 0, 'all 15 blocked non-crypto bases gated out of every card/ledger — leaked: ' + (leaked.join(',') || 'none'));

  /* ---- ledgers at scale ---- */
  const lrows = bAside.split('<div class="lrow">').length - 1;
  assert(lrows === 503, 'ASIDE ledger renders all 503 aside rows (502 crypto + XAU) — got ' + lrows);
  assert(bAside.indexOf('>SOL</span>') >= 0 && bAside.indexOf('engine veto @ G4') >= 0 && bAside.indexOf('>VETO</span>') >= 0,
         'SOL hard-vetoed at G4 liquidity with the killing gate named');
  assert(bAside.indexOf('>XAU</span>') >= 0, 'gold lane lands in ASIDE when its setup layer is dark');
  assert(bWatch === '' && PB.stubs['#brainWatchWrap'].style.display === 'none',
         'WATCH panel empty + hidden when nothing is on watch');
  assert(PB.stubs['#brainEmpty'].style.display !== 'block', 'empty state stays hidden when setups exist');
  assert(PB.stubs['#brainRead'].textContent.indexOf('RISK-ON regime') >= 0
         && PB.stubs['#brainRead'].textContent.indexOf('btc season 25%') >= 0
         && PB.stubs['#brainRead'].textContent.indexOf('on-chain bullish') >= 0,
         'MARKET READ synthesizes regime + rotation + on-chain over the warmed layers');
}

/* ================= C) quick rescan: fetch cap binds AND says so ================= */
console.log('== C) quick rescan over 45 watch candidates: cap note honest ==');
{
  const W = freshBrain();
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  W.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  W.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  W.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  W.engineState = function(){ return { survivors: [], rejected: [], at: 1 }; };
  W.squeezeState = function(){ return { results: [] }; };
  W.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 0 }; } }; };
  W.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  const list = [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null }
  ];
  const ofRes = [];
  for (let n = 201; n <= 245; n++){   /* 45 alts, each reaching WATCH on regime+rotation+oiflow */
    const base = 'ALT' + n;
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: n * 1e6, mark: 1, fundingPct: null, alsoOn: null });
    ofRes.push({ sym: base + 'USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' });
  }
  W.oiflowState = function(){ return { results: ofRes }; };
  W.xuUniverse = async function(){ return list; };
  W.xuState = function(){ return { count: list.length, delta: list.length, cdcx: 0, at: Date.now(), note: null }; };
  let candleCalls = 0;
  W.xuCandles = function(){ candleCalls++; return Promise.resolve(fakeRows(120)); };
  const PC = freshPane();
  W.HG_tabs[0].mount(PC.pane);
  await runAndWait(PC.stubs);
  const cFull = PC.stubs['#brainStat'].textContent;
  assert(cFull.indexOf('done · 0 PRIME · 0 HIGH · 47 watch · 2 aside') === 0,
         'full scan: 45 alts reach WATCH on 3 votes, BTC+ETH join on the 2-vote radar tier — got "' + cFull + '"');
  assert(candleCalls === 40, 'full scan: fetch cap respected (40 of 47) — got ' + candleCalls);
  assert(cFull.indexOf('+7 more watch candidates — raise evidence to fetch') >= 0,
         'full scan: cap note named honestly — got "' + cFull + '"');

  candleCalls = 0;
  PC.stubs['#brainQuick']._handler();
  await waitIdle(PC.stubs);
  const cQuick = PC.stubs['#brainStat'].textContent;
  assert(/^quick rescan: 47 checked · 2 unchanged/.test(cQuick),
         'quick rescan rechecks the 47-watch set — got "' + cQuick + '"');
  assert(candleCalls === 40, 'quick rescan: fetch cap respected again (40 of 47) — got ' + candleCalls);
  assert(cQuick.indexOf('+7 more watch candidates — raise evidence to fetch') >= 0,
         'quick rescan: the binding fetch cap is NAMED on the stat line, never silently dropped — got "' + cQuick + '"');
}

console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
