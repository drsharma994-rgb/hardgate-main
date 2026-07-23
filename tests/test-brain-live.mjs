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
     D) radar quality gates at scale: a sub-floor WATCH alt and an overextended
        WATCH chase demote to ASIDE with named reasons + a stat tally; the
        quick rescan carries the gated verdicts over with AS OF stamps
     E) TREND4H + F&G at scale: a 3-vote WATCH alt on a real 4h uptrend fetches
        first (highest turnover among the tied rows) and promotes WATCH -> HIGH
        through the unchanged bars, the 40-fetch cap named over the remaining
        radar rows, a quick rescan re-deriving the same promotion; F&G 9
        extreme fear lifting BTC to a real 3-layer WATCH + ETH/SOL to radar
        while alts sit the layer out (majors only), F&G absent restoring the
        pre-F&G verdict math exactly
     F) funding contrarian votes + click-to-audit + bounded warm-wait at
        scale: extreme funding AGAINST a row completes radar with a named fade
        vote while same-direction stays a caution; every rendered row carries
        a collapsed audit toggle with zero ledgers rendered until clicked; a
        slow warm hook lifts a layer from dark to voting while a stuck hook
        stays named-dark after the cap
     G) structure-anchored limit plans at scale: an engine-survivor HIGH keeps
        its verbatim gate-engine plan even with an anchor available; a promoted
        HIGH card + swing-fixture radar rows offer patient 4h-structure LIMITs
        while flat-candle rows keep the hgPlanLevels fallback honestly labeled;
        the quick rescan re-derives every working limit deterministically
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
/* deterministic 4h trend with real swing wiggle — EMA20 vs EMA50 separates,
   2-bar pivots confirm a higher-high (up) / lower-low (down) structure break */
function trendRows(up){
  const rows = []; const t0 = 1700000000 - 120 * 14400;
  for (let i = 0; i < 120; i++){
    const base = up ? 100 + i * 0.4 : 100 - i * 0.4;
    const c = base + Math.sin(i / 3) * 1.5;
    rows.push({ t: t0 + i * 14400, o: c - 0.1, h: c + 0.6, l: c - 0.6, c: c, v: 1000 });
  }
  return rows;
}
function lrowSeg(html, sym){
  const segs = String(html).split('<div class="lrow">');
  for (let i = 0; i < segs.length; i++){
    if (segs[i].indexOf('>' + sym + '</span>') >= 0) return segs[i];
  }
  return '';
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
  assert(bStat.indexOf('gated') === -1, 'no gate tally when nothing tripped a radar gate — got "' + bStat + '"');
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
  assert(cFull.indexOf('gated') === -1 && cQuick.indexOf('gated') === -1,
         'no gate tally when no gate tripped (all turnovers >= $201M, no tape feed)');
}

/* ================= D) radar quality gates at scale =================
   61-row universe: 55 clean radar alts + a sub-floor THINALT + an overextended
   PUMPALT. The two gated rows demote to ASIDE with named reasons, the stat
   line tallies them, the fetch cap binds over the remaining 57 watch rows,
   and a quick rescan carries the gated verdicts over with AS OF stamps. */
console.log('== D) liquidity floor + overextension guard over a 61-row universe ==');
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
  W.binanceTickers24h = async function(){ return {
    PUMPALTUSDT: { symbol: 'PUMPALTUSDT', mark: 1, chg24: 17.3, turnoverUsd: 250e6 } }; };
  const list = [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    { sym: 'THINALTUSDT', base: 'THINALT', exchange: 'delta', turnoverUsd: 2e6, mark: 1, fundingPct: null, alsoOn: null },
    { sym: 'PUMPALTUSDT', base: 'PUMPALT', exchange: 'delta', turnoverUsd: 60e6, mark: 1, fundingPct: null, alsoOn: null }
  ];
  const ofRes = [ { sym: 'THINALTUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ];
  for (let n = 1; n <= 55; n++){
    const base = 'RALT' + String(n).padStart(3, '0');
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: null, alsoOn: null });
    ofRes.push({ sym: base + 'USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' });
  }
  W.oiflowState = function(){ return { results: ofRes }; };
  W.xuUniverse = async function(){ return list; };
  W.xuState = function(){ return { count: list.length, delta: list.length, cdcx: 0, at: Date.now(), note: null }; };
  W.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const PD = freshPane();
  W.HG_tabs[0].mount(PD.pane);
  await runAndWait(PD.stubs);
  const dStat = PD.stubs['#brainStat'].textContent;
  const dWatch = PD.stubs['#brainWatch'].innerHTML;
  const dAside = PD.stubs['#brainAside'].innerHTML;
  assert(dStat.indexOf('done · 0 PRIME · 0 HIGH · 57 watch · 4 aside') === 0,
         'full scan: 55 clean alts + ETH/SOL radar watch; THINALT + PUMPALT gated aside; BTC + gold aside — got "' + dStat + '"');
  assert(dStat.indexOf(' · 2 gated: 1 liquidity · 1 overextended') >= 0,
         'full scan: the gate tally names both kinds — got "' + dStat + '"');
  assert(dStat.indexOf('+17 more watch candidates — raise evidence to fetch') >= 0,
         'fetch cap binds over the surviving 57 watch rows, honestly — got "' + dStat + '"');
  assert(dAside.indexOf('>THINALT</span>') >= 0
         && dAside.indexOf('below liquidity floor — $2.0M 24h turnover, slippage eats the edge') >= 0,
         'THINALT ($2.0M turnover) demoted to ASIDE with the exact liquidity reason');
  assert(dAside.indexOf('>PUMPALT</span>') >= 0
         && dAside.indexOf('overextended +17.3% 24h — chasing tops is how radar dies') >= 0,
         'PUMPALT (+17.3% 24h) demoted to ASIDE with the exact overextension reason');
  assert(dWatch.indexOf('>THINALT</span>') === -1 && dWatch.indexOf('>PUMPALT</span>') === -1
         && dWatch.indexOf('>RALT001</span>') >= 0,
         'gated rows leave the WATCH ledger; the 55 clean radar rows stay');

  /* quick rescan: gated verdicts are ASIDE now — carried over with AS OF
     stamps, never re-gated, and the quick tally stays empty */
  PD.stubs['#brainQuick']._handler();
  await waitIdle(PD.stubs);
  const dQuick = PD.stubs['#brainStat'].textContent;
  const dQuickAside = PD.stubs['#brainAside'].innerHTML;
  assert(/^quick rescan: 57 checked · 4 unchanged/.test(dQuick),
         'quick rescan rechecks the 57 surviving watch rows; the 4 asides (incl. both gated) carry over — got "' + dQuick + '"');
  assert(dQuick.indexOf('gated') === -1,
         'quick pass gates nothing new — carried-over demotions are never double-counted — got "' + dQuick + '"');
  assert(dQuickAside.indexOf('below liquidity floor — $2.0M 24h turnover, slippage eats the edge') >= 0
         && dQuickAside.indexOf('overextended +17.3% 24h — chasing tops is how radar dies') >= 0
         && dQuickAside.indexOf('AS OF') >= 0,
         'gated verdicts persist through the quick rescan with their named reasons + AS OF age stamps');
}

/* ================= F1) bounded warm-wait at scale =================
   60-crypto universe; REGIME starts COLD behind a slow-but-successful warm
   hook (40ms into a 400ms test cap) and gets to VOTE; ON-CHAIN sits behind a
   never-settling hook and stays named-dark after the cap. Never hangs. */
console.log('== F1) bounded warm-wait: slow layer votes, stuck layer named-dark ==');
{
  const W = freshBrain();
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  W.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  W.engineState = function(){ return { survivors: [], rejected: [], at: 1 }; };
  W.squeezeState = function(){ return { results: [] }; };
  W.oiflowState = function(){ return { results: [] }; };
  W.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 0 }; } }; };
  W.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  W.brainTunables.warmMs = 400;
  W.HG_warmups = [
    { id: 'regime', label: 'REGIME', run: function(){
        return new Promise(function(res){
          setTimeout(function(){
            W.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
            res('warmed');
          }, 40);
        }); } },
    { id: 'onchain', label: 'ON-CHAIN', run: function(){ return new Promise(function(){}); } },   /* never settles */
    { id: 'liqs', label: 'LIQS', run: async function(){
        return 'skipped: stream-only layer — open the LIQS tab once to start the live socket'; } }
  ];
  const list = [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50, fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null }
  ];
  for (let n = 1; n <= 57; n++){
    const base = 'WALT' + String(n).padStart(3, '0');
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: null, alsoOn: null });
  }
  W.xuUniverse = async function(){ return list; };
  W.xuState = function(){ return { count: list.length, delta: list.length, cdcx: 0, at: Date.now(), note: null }; };
  W.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const PF = freshPane();
  W.HG_tabs[0].mount(PF.pane);
  await runAndWait(PF.stubs);
  const f1Stat = PF.stubs['#brainStat'].textContent;
  const f1Read = PF.stubs['#brainRead'].textContent;
  assert(f1Stat.indexOf('done · 0 PRIME · 0 HIGH · 59 watch · 2 aside') === 0,
         'F1: the scan completes over the stuck hook (cap bound) — 59 radar watch, BTC + gold aside — got "' + f1Stat + '"');
  assert(f1Read.indexOf('RISK-ON regime') >= 0,
         'F1: the slow REGIME hook warmed its layer into voting — never judged dark — got "' + f1Read + '"');
  assert(f1Read.indexOf('dark: on-chain') >= 0,
         'F1: the never-settling ON-CHAIN hook leaves its layer named-dark after the cap — got "' + f1Read + '"');
  const f1Rows = W.__hgBrainLast().rows;
  const f1Btc = f1Rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  assert(f1Btc && f1Btc.evidence.some(function(e){ return e.indexOf('REGIME:') === 0; })
         && !f1Btc.evidence.some(function(e){ return e.indexOf('ONCHAIN:') === 0; }),
         'F1: snapshot — warmed REGIME votes for BTC, stuck ON-CHAIN never fabricated a vote');
  assert(f1Rows.length === 61, 'F1: snapshot covers the full 60-crypto universe + gold — got ' + f1Rows.length);
}

/* ================= F2) funding contrarian votes + click-to-audit at scale =================
   BTC rides a -0.12%/8h print to a funding-completed radar WATCH; ETH takes
   the same-direction caution with NO vote; SOL sub-extreme silent. Every row
   carries a collapsed audit toggle; not one ledger renders until clicked. */
console.log('== F2) funding votes + audit toggles over a 13-watch board ==');
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
  W.oiflowState = function(){ return { results: [ { sym: 'ETHUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ] }; };
  const list = [
    { sym: 'BTCUSDT', base: 'BTC', exchange: 'delta', turnoverUsd: 9e9, mark: 100, fundingPct: -0.12, alsoOn: null },
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'delta', turnoverUsd: 5e9, mark: 50,  fundingPct: 0.11,  alsoOn: null },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20,  fundingPct: -0.09, alsoOn: null }
  ];
  for (let n = 1; n <= 10; n++){
    const base = 'FALT' + String(n).padStart(2, '0');
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: null, alsoOn: null });
  }
  W.xuUniverse = async function(){ return list; };
  W.xuState = function(){ return { count: list.length, delta: list.length, cdcx: 0, at: Date.now(), note: null }; };
  W.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const PF2 = freshPane();
  W.HG_tabs[0].mount(PF2.pane);
  await runAndWait(PF2.stubs);
  const f2Stat = PF2.stubs['#brainStat'].textContent;
  const f2Watch = PF2.stubs['#brainWatch'].innerHTML;
  const f2Aside = PF2.stubs['#brainAside'].innerHTML;
  assert(f2Stat.indexOf('done · 0 PRIME · 0 HIGH · 13 watch · 1 aside') === 0,
         'F2: BTC/ETH/SOL + 10 alts all WATCH; gold the only aside — got "' + f2Stat + '"');
  const f2Rows = W.__hgBrainLast().rows;
  const f2BySym = function(s){ return f2Rows.filter(function(x){ return x.sym === s; })[0]; };
  assert(lrowSeg(f2Watch, 'BTC').indexOf('radar only') >= 0
         && f2BySym('BTCUSDT').evidence.indexOf('FUNDING: funding -0.12%/8h — shorts crowded, fade fuel for longs') >= 0,
         'F2: extreme funding AGAINST completes BTC’s radar with the named fade vote');
  assert(lrowSeg(f2Watch, 'ETH').indexOf('funding crowded same-direction — squeeze risk') >= 0
         && !f2BySym('ETHUSDT').evidence.some(function(e){ return e.indexOf('FUNDING:') === 0; }),
         'F2: +0.11%/8h WITH the LONG row = caution chip, NO vote — the crowded side is never rewarded');
  assert(lrowSeg(f2Watch, 'SOL').indexOf('funding crowded') === -1
         && !f2BySym('SOLUSDT').evidence.some(function(e){ return e.indexOf('FUNDING:') === 0; }),
         'F2: -0.09%/8h sub-extreme = silent — no chip, no vote');
  assert((f2Watch.split('data-audit="').length - 1) === 13
         && (f2Aside.split('data-audit="').length - 1) === 1
         && f2Watch.indexOf('auditRows') === -1 && f2Aside.indexOf('auditRows') === -1,
         'F2: all 14 rows carry a collapsed audit toggle and NOT ONE ledger renders until clicked');
  const btcAudit = W.__hgBrainAudit('BTCUSDT');
  assert(btcAudit && btcAudit.indexOf('>FUNDING<') >= 0 && btcAudit.indexOf('fade fuel for longs') >= 0
         && btcAudit.indexOf('>TREND4H<') >= 0 && btcAudit.indexOf('>REGIME<') >= 0,
         'F2: BTC’s on-demand audit names the funding vote + the silent trend layer');
  const xauAudit = W.__hgBrainAudit('XAU');
  assert(xauAudit && xauAudit.indexOf('>GOLDSETUP<') >= 0 && xauAudit.indexOf('>DARK</span>') >= 0
         && xauAudit.indexOf('run GOLD once') >= 0,
         'F2: the gold row audits its own lane — GOLDSETUP dark with the exact reason');
}

/* ================= E1) TREND4H structural promotion at scale =================
   57-crypto universe: TRENDY rides regime+rotation+oiflow to a 3-vote WATCH,
   fetches FIRST (highest turnover among the tied 3-agree rows), and the
   uptrend TREND4H vote promotes it WATCH -> HIGH through the unchanged tier
   bars. The 40-fetch cap binds over the 56-row watch set and SAYS so; a quick
   rescan re-judges fresh, re-fetches and re-derives the same promotion. */
console.log('== E1) TREND4H promotion at scale + honest fetch cap + quick rescan ==');
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
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', turnoverUsd: 2e9, mark: 20, fundingPct: 0, alsoOn: null },
    /* highest turnover among the 3-agree radar rows -> fetches FIRST */
    { sym: 'TRENDYUSDT', base: 'TRENDY', exchange: 'delta', turnoverUsd: 60e6, mark: 1, fundingPct: 0, alsoOn: null }
  ];
  const ofRes = [ { sym: 'TRENDYUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ];
  for (let n = 1; n <= 53; n++){
    const base = 'RALT' + String(n).padStart(3, '0');
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: null, alsoOn: null });
    ofRes.push({ sym: base + 'USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' });
  }
  W.oiflowState = function(){ return { results: ofRes }; };
  W.xuUniverse = async function(){ return list; };
  W.xuState = function(){ return { count: list.length, delta: list.length, cdcx: 0, at: Date.now(), note: null }; };
  const candleCalls = [];
  W.xuCandles = function(item){
    candleCalls.push(item.sym);
    return Promise.resolve(item.sym === 'TRENDYUSDT' ? trendRows(true) : fakeRows(120));
  };
  const PE = freshPane();
  W.HG_tabs[0].mount(PE.pane);
  await runAndWait(PE.stubs);
  const eStat = PE.stubs['#brainStat'].textContent;
  const eCards = PE.stubs['#brainCards'].innerHTML;
  assert(eStat.indexOf('done · 0 PRIME · 1 HIGH · 55 watch · 2 aside') === 0,
         'E1: TRENDY promoted WATCH -> HIGH by the uptrend TREND4H vote; 55 radar rows stay WATCH; BTC + gold aside — got "' + eStat + '"');
  assert(eCards.indexOf('TRENDYUSDT') >= 0 && eCards.indexOf('HIGH · 4 LAYERS') >= 0 && eCards.indexOf('>LONG</span>') >= 0,
         'E1: the promoted card renders HIGH · 4 LAYERS LONG');
  assert(eCards.indexOf('TREND4H: 4h EMA20&gt;EMA50 + higher-high — structural long') >= 0,
         'E1: the promoting structural vote is named on the card (HTML-escaped)');
  assert(eStat.indexOf('+16 more watch candidates — raise evidence to fetch') >= 0,
         'E1: the 40-fetch cap binds over the 56-row watch set, honestly named — got "' + eStat + '"');
  assert(candleCalls.length === 40 && candleCalls[0] === 'TRENDYUSDT',
         'E1: exactly 40 fetches and TRENDY goes FIRST (turnover-ordered queue) — got ' + candleCalls.length + ' / ' + candleCalls[0]);
  const snapE = W.__hgBrainLast();
  const tRow = snapE.rows.filter(function(x){ return x.sym === 'TRENDYUSDT'; })[0];
  assert(tRow && tRow.tier === 'HIGH' && tRow.dir === 'long'
         && tRow.evidence.indexOf('TREND4H: 4h EMA20>EMA50 + higher-high — structural long') >= 0,
         'E1: __hgBrainLast carries the promoted row with the RAW TREND4H evidence string');

  /* quick rescan: the 56 WATCH-or-better rows re-judge FRESH (the trend vote
     is not carried — it is re-earned through a re-fetch), then re-promote */
  PE.stubs['#brainQuick']._handler();
  await waitIdle(PE.stubs);
  const eQuick = PE.stubs['#brainStat'].textContent;
  assert(/^quick rescan: 56 checked · 2 unchanged/.test(eQuick),
         'E1: quick rescan rechecks the 56 WATCH-or-better rows; BTC + gold carry over — got "' + eQuick + '"');
  assert(eQuick.indexOf('0 PRIME · 1 HIGH · 55 watch · 2 aside') >= 0
         && PE.stubs['#brainCards'].innerHTML.indexOf('TREND4H: 4h EMA20&gt;EMA50 + higher-high — structural long') >= 0,
         'E1: the quick pass re-derives the same promotion deterministically — got "' + eQuick + '"');
  assert(eQuick.indexOf('+16 more watch candidates — raise evidence to fetch') >= 0,
         'E1: the fetch cap binds again on the quick pass, still named — got "' + eQuick + '"');
  const snapE2 = W.__hgBrainLast();
  assert(snapE2 && snapE2.at >= snapE.at && Object.isFrozen(snapE2)
         && snapE2.rows.some(function(x){ return x.sym === 'TRENDYUSDT' && x.tier === 'HIGH'; }),
         'E1: the quick rescan IS a completed synthesis — snapshot refreshed, frozen, TRENDY still HIGH');
}

/* ================= E2) F&G extreme fear at scale =================
   F&G 9: BTC reaches a REAL 3-layer WATCH (regime+rotation+F&G), ETH/SOL ride
   radar on regime+F&G, and 10 alts sit the layer out entirely (majors-only —
   no vote, not dark, never a cap). With F&G deleted the verdicts fall back to
   the exact pre-F&G math — the layer never existed. */
console.log('== E2) F&G extreme fear: majors vote, alts sit out, absent restores ==');
{
  const W = freshBrain();
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  W.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  W.rotationState = function(){ return { season: 'btc', altPct: 25, evidence: [] }; };
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
  for (let n = 1; n <= 10; n++){
    const base = 'FALT' + String(n).padStart(2, '0');
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: null, alsoOn: null });
  }
  W.oiflowState = function(){ return { results: [] }; };
  W.xuUniverse = async function(){ return list; };
  W.xuState = function(){ return { count: list.length, delta: list.length, cdcx: 0, at: Date.now(), note: null }; };
  W.xuCandles = function(){ return Promise.resolve(fakeRows(120)); };
  const PF = freshPane();
  W.HG_tabs[0].mount(PF.pane);

  globalThis.S = { fng: { v: 9, c: 'Extreme Fear' } };
  await runAndWait(PF.stubs);
  const fStat = PF.stubs['#brainStat'].textContent;
  const fWatch = PF.stubs['#brainWatch'].innerHTML;
  const fAside = PF.stubs['#brainAside'].innerHTML;
  assert(fStat.indexOf('done · 0 PRIME · 0 HIGH · 3 watch · 11 aside') === 0,
         'E2: F&G 9 — BTC a real 3-layer WATCH, ETH/SOL radar WATCH, 10 alts + gold aside — got "' + fStat + '"');
  assert(lrowSeg(fWatch, 'BTC').indexOf('3 layers agree LONG') >= 0 && lrowSeg(fWatch, 'BTC').indexOf('radar only') === -1,
         'E2: the F&G vote counts as a real third layer for BTC (not radar)');
  assert(lrowSeg(fWatch, 'ETH').indexOf('radar only') >= 0,
         'E2: ETH rides radar on regime + F&G (2 layers, uncontested)');
  assert(fWatch.indexOf('>FALT01</span>') === -1 && fAside.indexOf('>FALT01</span>') >= 0,
         'E2: majors-only — the alts stay ASIDE on their lone regime vote');
  assert(PF.stubs['#brainRead'].textContent.indexOf('F&G 9 Extreme Fear') >= 0,
         'E2: MARKET READ carries the F&G print');
  const snapF = W.__hgBrainLast();
  const bRow = snapF.rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  const eRow = snapF.rows.filter(function(x){ return x.sym === 'ETHUSDT'; })[0];
  const aRow = snapF.rows.filter(function(x){ return x.sym === 'FALT01USDT'; })[0];
  assert(bRow && bRow.evidence.indexOf('FNG: F&G 9 extreme fear — contrarian long context') >= 0
         && eRow && eRow.evidence.some(function(x){ return x.indexOf('FNG: F&G 9 extreme fear') === 0; }),
         'E2: snapshot evidence names the contrarian long vote for both BTC and ETH (majors)');
  assert(aRow && !aRow.evidence.some(function(x){ return x.indexOf('FNG:') === 0; }),
         'E2: the alt row carries zero F&G evidence — the layer sat out');

  /* F&G absent -> the layer sits out ENTIRELY: the pre-F&G math returns */
  delete globalThis.S;
  await runAndWait(PF.stubs);
  const f2Stat = PF.stubs['#brainStat'].textContent;
  const snapF2 = W.__hgBrainLast();
  const bRow2 = snapF2.rows.filter(function(x){ return x.sym === 'BTCUSDT'; })[0];
  assert(f2Stat.indexOf('done · 0 PRIME · 0 HIGH · 1 watch · 13 aside') === 0
         && bRow2 && !bRow2.evidence.some(function(x){ return x.indexOf('FNG:') === 0; }),
         'E2: F&G absent — BTC back to 2-layer radar, ETH/SOL thin aside, zero F&G evidence — got "' + f2Stat + '"');
}

/* ================= G) STRUCTURE-ANCHORED LIMITS at scale =================
   26-crypto universe: an engine-survivor HIGH keeps its gate-engine plan even
   with an anchor available (precedence); LTREND promotes WATCH -> HIGH and its
   card offers a 4h-FVG LIMIT; three swing-fixture radar rows offer swing-zone
   limits; ten flat rows keep the hgPlanLevels fallback with the honest
   no-structure label. Quick rescan re-derives every limit deterministically. */
console.log('== G) anchored limit plans at scale: engine precedence, LIMIT render, honest fallback, quick persistence ==');
{
  const W = freshBrain();
  W.hgNewsRisk = function(){ return { risk: 'low', blackout: false, events: [], note: 'clear' }; };
  W.regimeState = function(){ return { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY', sizeNote: 'full size' } }; };
  W.rotationState = function(){ return { season: 'alt', altPct: 80, evidence: [] }; };
  W.onchainState = function(){ return { bias: 'neutral', evidence: [], flags: {} }; };
  W.engineState = function(){ return { survivors: [
    { sym: 'ENGWINUSDT', dir: 'long', conviction: 'MODERATE',
      plan: { entry: 100, stop: 95, t1: 110, t2: 117.5 }, gatesPassed: 5 } ], rejected: [], at: 1 }; };
  W.squeezeState = function(){ return { results: [] }; };
  W.liqAgg = function(){ return { snapshot: function(){ return { imbalance: { cls: 'balanced', ratio: 1, text: 'BALANCED' }, top: [], window: { ms: 3.6e6 }, spikeUsd: 0 }; } }; };
  W.goldspotState = function(){ return { basisPct: 0, verdict: 'balanced' }; };
  const ofRes = [ { sym: 'ENGWINUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' },
                  { sym: 'LTRENDUSDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' } ];
  const list = [
    { sym: 'BTCUSDT',    base: 'BTC',    exchange: 'delta', turnoverUsd: 9e9,  mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'ETHUSDT',    base: 'ETH',    exchange: 'delta', turnoverUsd: 5e9,  mark: 50,  fundingPct: 0, alsoOn: null },
    { sym: 'SOLUSDT',    base: 'SOL',    exchange: 'delta', turnoverUsd: 2e9,  mark: 20,  fundingPct: 0, alsoOn: null },
    { sym: 'ENGWINUSDT', base: 'ENGWIN', exchange: 'delta', turnoverUsd: 90e6, mark: 100, fundingPct: 0, alsoOn: null },
    { sym: 'LTRENDUSDT', base: 'LTREND', exchange: 'delta', turnoverUsd: 80e6, mark: 1,   fundingPct: 0, alsoOn: null }
  ];
  for (let n = 1; n <= 3; n++){
    const base = 'WALT0' + n;
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: 70e6, mark: 1, fundingPct: 0, alsoOn: null });
    ofRes.push({ sym: base + 'USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' });
  }
  for (let n = 1; n <= 18; n++){
    const base = 'FALT' + String(n).padStart(2, '0');
    list.push({ sym: base + 'USDT', base: base, exchange: 'delta', turnoverUsd: 50e6, mark: 1, fundingPct: null, alsoOn: null });
    if (n <= 10) ofRes.push({ sym: base + 'USDT', dir: 'LONG', evidence: 2, cls: 'NEW LONGS' });
  }
  W.oiflowState = function(){ return { results: ofRes }; };
  W.xuUniverse = async function(){ return list; };
  W.xuState = function(){ return { count: list.length, delta: list.length, cdcx: 0, at: Date.now(), note: null }; };
  const bar = function(c, hh, ll){ return { t: 0, o: c, h: hh !== undefined ? hh : c + 0.5, l: ll !== undefined ? ll : c - 0.5, c: c, v: 1000 }; };
  const swingLongRows = function(){
    const rows = [];
    for (let i = 0; i < 120; i++) rows.push(bar(100));
    rows[113] = bar(99.6, 99.9, 99.3);
    rows[114] = bar(99.3, 99.7, 99.0);
    rows[115] = bar(99.2, 99.5, 98.8);
    rows[116] = bar(99.5, 99.8, 99.1);
    rows[117] = bar(99.8, 100.1, 99.4);
    rows[118] = bar(100, 100.3, 99.7);
    rows[119] = bar(100, 100.3, 99.7);
    return rows;
  };
  W.xuCandles = function(item){
    if (item.sym === 'LTRENDUSDT') return Promise.resolve(trendRows(true));
    if (item.sym === 'ENGWINUSDT' || item.sym.indexOf('WALT') === 0) return Promise.resolve(swingLongRows());
    return Promise.resolve(fakeRows(120));
  };
  let planCalls = 0;
  W.hgPlanLevels = function(dir){ planCalls++; return { dir: dir, entry: 10, stop: 9, t1: 12, t2: 13 }; };
  W.toTrade = function(){};
  const PG = freshPane();
  W.HG_tabs[0].mount(PG.pane);
  await runAndWait(PG.stubs);
  const gStat = PG.stubs['#brainStat'].textContent;
  const gCards = PG.stubs['#brainCards'].innerHTML;
  const gWatch = PG.stubs['#brainWatch'].innerHTML;
  assert(gStat.indexOf('done · 0 PRIME · 2 HIGH · 23 watch · 2 aside') === 0,
         'G: 27 rows — ENGWIN + LTREND HIGH, ETH/SOL + 3 WALT + 18 FALT watch (oiflow 3-layer or radar), BTC + gold aside — got "' + gStat + '"');

  /* engine survivor precedence: an anchor EXISTS on ENGWIN's candles (swing
     zone), yet the gate-engine plan renders verbatim — never overridden */
  const engSeg = gCards.split('<div class="card ').filter(function(s){ return s.indexOf('ENGWINUSDT') >= 0; })[0] || '';
  assert(engSeg.indexOf('ENTRY <b>100</b> · STOP <b>95</b>') >= 0 && engSeg.indexOf('gate engine') >= 0
         && engSeg.indexOf('LIMIT @') === -1,
         'G: engine survivor plan wins even with an anchor available — verbatim gate-engine levels, no LIMIT override');

  /* the promoted card + the radar rows offer patient limits */
  assert(gCards.indexOf('LIMIT @ <b>147.65</b> — pullback to 4h FVG') >= 0
         && gCards.indexOf('stop <b>146.85</b> (0.5xATR beyond 4h FVG)') >= 0
         && gCards.indexOf('TP1 <b>148.85</b> · TP2 <b>149.64</b> · R:R 1.5') >= 0
         && gCards.indexOf('cancel if 4h closes beyond <b>147.49</b>') >= 0
         && gCards.indexOf('limit working ~24h or until structure breaks') >= 0,
         'G: LTREND promoted WATCH -> HIGH renders the full anchored LIMIT block on the card');
  assert(lrowSeg(gWatch, 'WALT01').indexOf('LIMIT @ <b>99.1</b> — pullback to swing-low zone') >= 0
         && lrowSeg(gWatch, 'WALT02').indexOf('LIMIT @ <b>99.1</b>') >= 0
         && lrowSeg(gWatch, 'WALT03').indexOf('LIMIT @ <b>99.1</b>') >= 0,
         'G: all three swing-fixture radar rows offer the swing-low zone limit');
  assert(lrowSeg(gWatch, 'FALT01').indexOf('ENTRY <b>10</b>') >= 0
         && lrowSeg(gWatch, 'FALT01').indexOf('no nearby 4h structure — gate-engine levels') >= 0,
         'G: flat-candle rows keep the hgPlanLevels plan UNTOUCHED with the honest no-structure label');
  assert(planCalls === 20, 'G: hgPlanLevels consulted ONLY for the 20 anchor-less flat-candle rows (ETH/SOL + 18 FALT) — got ' + planCalls);

  /* snapshot + audit at scale */
  const gSnap = W.__hgBrainLast();
  const gL = gSnap.rows.filter(function(x){ return x.sym === 'LTRENDUSDT'; })[0];
  const gW = gSnap.rows.filter(function(x){ return x.sym === 'WALT01USDT'; })[0];
  assert(gL && gL.plan && Object.keys(gL.plan).sort().join(',') === 'entry,stop,t1,t2'
         && gL.plan.entry === 147.64569307942614 && gL.plan.entry < 148.9834776804744
         && gW && gW.plan && gW.plan.entry === 99.1 && gW.plan.stop < 99.1,
         'G: snapshot rows keep the exact {entry,stop,t1,t2} shape; limits sit BELOW the mark (patient, never a chase)');
  const lAudit = W.__hgBrainAudit('LTRENDUSDT');
  const fAudit = W.__hgBrainAudit('FALT01USDT');
  assert(lAudit && lAudit.indexOf('>PLAN<') >= 0 && lAudit.indexOf('>LIMIT<') >= 0
         && lAudit.indexOf('4h FVG 147.65 (zone 147.49–147.65) · 1.04×ATR below mark') >= 0
         && fAudit && fAudit.indexOf('>GATE<') >= 0
         && fAudit.indexOf('hgPlanLevels levels — no nearby 4h structure — gate-engine levels') >= 0,
         'G: the audit PLAN line names the anchor source for limits and the gate-engine provenance for fallbacks');

  /* quick rescan: every limit re-derived deterministically, population intact */
  PG.stubs['#brainQuick']._handler();
  await waitIdle(PG.stubs);
  const gQuick = PG.stubs['#brainStat'].textContent;
  assert(/^quick rescan: 25 checked · 2 unchanged/.test(gQuick) && gQuick.indexOf('2 HIGH · 23 watch · 2 aside') >= 0,
         'G: quick rescan rechecks the 25 WATCH-or-better rows with the same buckets — got "' + gQuick + '"');
  assert(PG.stubs['#brainCards'].innerHTML.indexOf('LIMIT @ <b>147.65</b> — pullback to 4h FVG') >= 0
         && lrowSeg(PG.stubs['#brainWatch'].innerHTML, 'WALT01').indexOf('LIMIT @ <b>99.1</b> — pullback to swing-low zone') >= 0
         && lrowSeg(PG.stubs['#brainWatch'].innerHTML, 'FALT01').indexOf('no nearby 4h structure — gate-engine levels') >= 0,
         'G: the quick pass re-derives the same limits + fallbacks — WATCH rows keep their working orders');
}

console.log('\n' + pass + ' assertions passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
