/* HARDGATE — hg-v1003: THE FUNDAMENTAL STACK, HOUSE-WIDE.

   hg-v1002 proved the pattern on OMNIBTC: the tape is only half the read.
   v1003 moves the stack into fundamental-stack.js — one asset-aware source
   of truth — and answers EVERY crypto and gold setup tab with it:

     - BTC: onchain / term / F&G / 25d RR vote; DVOL + BTC.D are INFO;
       the news blackout refuses.
     - ETH/alts: F&G + the coin's own term row vote; on-chain honestly
       UNCHECKED (BTC-only feed); the BTC 25d RR renders as a complex
       PRIOR — INFO, never a vote for an alt.
     - GOLD: realRateHint (FRED DFII10 measured first, DXY+US10Y heuristic
       second) and CFTC COT crowding (contrarian at the house |z|>=2 line)
       vote; the USD calendar blackout refuses; DXY / US10Y / gold-silver
       are INFO priors.

   The gate answers at every choke point a card's buttons already pass:
   cardHTML, smartCardHTML, both BEST paths, bookBtnHTML (the ADD builder
   every bespoke desk calls) and hgToTradePlanOnclickJs (the SEND builder).
   OMNIBTC delegates; OMNIGOLD renders the gold board beside REGIME WATCH.

   Run: node tests/test-fundamental-stack-v1003.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function docStub(){
  return {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild(){} },
    body: { appendChild(){} },
    documentElement: { appendChild(){} },
    addEventListener(){},
    readyState: 'complete'
  };
}

/* bare boot: just the module (plus anything extra the caller names) */
function boot(files, extra){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError,
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){}
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = docStub();
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  for (const f of ['fundamental-stack.js'].concat(files || [])){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function leg(regime, key){
  return (regime.legs || []).filter(function(l){ return l && l.key === key; })[0] || null;
}

console.log('== asset classification — one stack per coin, gold apart ==');
{
  const W = boot();
  ok(W.hgFundamentalAssetOf('BTCUSD') === 'btc', 'BTCUSD -> btc');
  ok(W.hgFundamentalAssetOf('[Delta India] BTCUSD') === 'btc', 'venue tag strips -> btc');
  ok(W.hgFundamentalAssetOf('B-BTC_USDT') === 'btc', 'CoinDCX B- prefix -> btc');
  ok(W.hgFundamentalAssetOf('ETHUSDT') === 'eth', 'ETHUSDT -> eth');
  ok(W.hgFundamentalAssetOf('B-ETH_USDT') === 'eth', 'B-ETH_USDT -> eth');
  ok(W.hgFundamentalAssetOf('SOLUSDT') === 'crypto', 'SOLUSDT -> crypto');
  ok(W.hgFundamentalAssetOf('XAUUSD') === 'gold', 'XAUUSD -> gold');
  ok(W.hgFundamentalAssetOf('PAXGUSDT') === 'gold', 'PAXGUSDT -> gold');
  ok(W.hgFundamentalAssetOf('XAUTUSD') === 'gold', 'XAUTUSD -> gold');
  ok(W.hgFundamentalAssetOf('') === '', 'empty symbol -> no asset, fail-open');
}

console.log('\n== the boards: 7 legs BTC / 7 crypto / 6 gold ==');
{
  const W = boot();
  const btc = W.hgFundamentalRegime('btc', {});
  ok(btc.legs.length === 7, 'BTC keeps the exact v1002 seven-leg board');
  ok(btc.legs.every(function(l){ return l.state === 'unchecked'; }) && btc.regime === 'unknown',
    'dark feeds -> every leg UNCHECKED and regime unknown, never a guessed read');
  const alt = W.hgFundamentalRegime('crypto', {});
  ok(alt.legs.length === 7 && leg(alt, 'onchain').state === 'unchecked'
      && /BTC-only/.test(leg(alt, 'onchain').text),
    'an alt\'s on-chain leg says BTC-only instead of faking a read');
  const gold = W.hgFundamentalRegime('gold', {});
  ok(gold.legs.length === 8 && gold.regime === 'unknown' && gold.blackout === false,
    'gold board: real rates, COT, risk-sentiment, PAXG positioning, event risk + three INFO priors — dark until fetched');
  ok(leg(gold, 'realrate').state === 'unchecked' && leg(gold, 'cot').state === 'unchecked'
      && leg(gold, 'fng').state === 'unchecked' && leg(gold, 'position').state === 'unchecked',
    'gold votes stay UNCHECKED while macro / COT / F&G / spot have never landed');
}

console.log('\n== ETH/alts: the BTC options snap is a PRIOR, never their vote ==');
{
  const W = boot();
  const r = W.hgFundamentalRegime('eth', {
    fng: { v: 85, c: 'Extreme Greed' },
    options: { rr25d: { rr25d: -9.4, extreme: true, bias: 'PUTS RICH' } }
  });
  ok(leg(r, 'fng').vote === 'bear', 'F&G extreme votes on an alt (market sentiment is the asset\'s weather)');
  const rr = leg(r, 'rr25d');
  ok(rr.info === true && rr.vote === 'neutral' && rr.extreme === true && /complex prior/.test(rr.text),
    'an extreme BTC 25d RR renders INFO on an alt — positioning of the complex, not of the alt');
  ok(r.bears === 1 && r.checked === 1,
    'one bear, one directional check (F&G) — the measured prior renders but never joins the tally');
  const gate = W.hgFundamentalGate('ETHUSDT', 'long', { extra: {
    fng: { v: 85, c: 'Extreme Greed' },
    options: { rr25d: { rr25d: -9.4, extreme: true, bias: 'PUTS RICH' } }
  }});
  ok(gate.demote === false && gate.refuse === false,
    'one witness + a prior NEVER demote an alt — the 2-vote bar is real');
  ok(gate.chips.indexOf('F&G EXTREME') >= 0 && gate.chips.indexOf('RR25 EXTREME') === -1,
    'the alt card chips the F&G extreme but not the prior\'s');
}

console.log('\n== GOLD legs: real rates and COT vote, the priors never do ==');
{
  const W = boot();
  const tw = W.hgFundamentalRegime('gold', { macro: { realRateHint: 'TAILWIND', dxy: { value: 103.2, trend20: 'FALLING' }, tnx: 4.21, tnxTrend: 'FALLING', goldSilverRatio: 86.4 } });
  ok(leg(tw, 'realrate').vote === 'bull', 'real-rate TAILWIND votes BULL for gold');
  ok(leg(tw, 'dxy').info === true && leg(tw, 'us10y').info === true && leg(tw, 'gsr').info === true,
    'DXY / US10Y / gold-silver render INFO — priors, never votes');
  const hw = W.hgFundamentalRegime('gold', { macro: { realRateHint: 'HEADWIND', dxy: { value: 106.1, trend20: 'RISING' }, tnxTrend: 'RISING' } });
  ok(leg(hw, 'realrate').vote === 'bear', 'real-rate HEADWIND votes BEAR for gold');
  const fred = W.hgFundamentalRegime('gold', { macro: { realRateHint: 'HEADWIND', realRateMeasured: { measured: true, trend: 'RISING' } } });
  ok(/FRED DFII10/.test(leg(fred, 'realrate').text), 'a FRED-measured real rate says so on the leg');
  const fakeNeutral = W.hgFundamentalRegime('gold', { macro: { realRateHint: 'NEUTRAL' } });
  ok(leg(fakeNeutral, 'realrate').state === 'unchecked',
    'a NEUTRAL hint with every leg null is a failed fetch — UNCHECKED, not a neutral vote');

  const crowded = W.hgFundamentalRegime('gold', { cot: { crowding: 'SPEC CROWDED LONG', zScore: 2.6, reportDate: Date.now() } });
  ok(leg(crowded, 'cot').vote === 'bear' && leg(crowded, 'cot').extreme === true,
    'COT SPEC CROWDED LONG (z>=2) votes contrarian BEAR — the goldCotGate line');
  const crowdedShort = W.hgFundamentalRegime('gold', { cot: { crowding: 'SPEC CROWDED SHORT', zScore: -2.4 } });
  ok(leg(crowdedShort, 'cot').vote === 'bull', 'COT SPEC CROWDED SHORT votes contrarian BULL');
  const calm = W.hgFundamentalRegime('gold', { cot: { crowding: 'NEUTRAL', zScore: 0.4 } });
  ok(leg(calm, 'cot').vote === 'neutral' && !leg(calm, 'cot').extreme, 'inside |z|>=2 COT is a checked neutral');

  /* the gold GATE: both voting legs against = demote; one witness = nothing */
  const g2 = W.hgFundamentalGate('XAUUSD', 'long', { extra: {
    macro: { realRateHint: 'HEADWIND', dxy: { value: 106, trend20: 'RISING' } },
    cot: { crowding: 'SPEC CROWDED LONG', zScore: 2.6 }
  }});
  ok(g2.demote === true && g2.refuse === false && g2.chips.some(function(c){ return /FUNDAMENTAL HEADWIND 2v0/.test(c); }),
    'a gold long into HEADWIND + CROWDED LONG demotes to watch — both legs against');
  ok(g2.chips.indexOf('COT EXTREME') >= 0, 'the COT extreme chips on the gate');
  const g1 = W.hgFundamentalGate('XAUUSD', 'long', { extra: {
    macro: { realRateHint: 'HEADWIND', dxy: { value: 106, trend20: 'RISING' } }
  }});
  ok(g1.demote === false && g1.refuse === false, 'one gold witness never flips the setup');
  const gs = W.hgFundamentalGate('XAUUSD', 'short', { extra: {
    macro: { realRateHint: 'HEADWIND', dxy: { value: 106, trend20: 'RISING' } },
    cot: { crowding: 'SPEC CROWDED LONG', zScore: 2.6 }
  }});
  ok(gs.demote === false && gs.chips.some(function(c){ return /FUNDAMENTAL TAILWIND 2v0/.test(c); }),
    'the same board WITH a gold short prints the tailwind and touches nothing');

  /* hg-v1033: SENTIMENT now votes in the gate, not just chips. F&G extreme
     (risk-on → bear) + PAXG crowding join real-rate + COT as the four
     directional legs. Two witnesses still demote; one never does. */
  const fgGreed = leg(W.hgFundamentalRegime('gold', { fng: { v: 88, c: 'Extreme Greed' } }), 'fng');
  ok(fgGreed.vote === 'bear' && fgGreed.extreme === true,
    'gold F&G extreme greed votes BEAR (risk-on weighs on gold)');
  const fgFear = leg(W.hgFundamentalRegime('gold', { fng: { v: 12, c: 'Extreme Fear' } }), 'fng');
  ok(fgFear.vote === 'bull' && fgFear.extreme === true,
    'gold F&G extreme fear votes BULL (risk-off bids gold)');
  const posCrowd = leg(W.hgFundamentalRegime('gold', { spot: { verdict: 'longs-crowding' } }), 'position');
  ok(posCrowd.vote === 'bear' && posCrowd.info !== true,
    'PAXG longs-crowding votes BEAR (fade longs) — a real positioning vote');
  const posSqueeze = leg(W.hgFundamentalRegime('gold', { spot: { verdict: 'shorts-crowding' } }), 'position');
  ok(posSqueeze.vote === 'bull', 'PAXG shorts-crowding votes BULL (squeeze fuel)');
  const posProxy = leg(W.hgFundamentalRegime('gold', { spot: { verdict: 'paxg-premium' } }), 'position');
  ok(posProxy.info === true && posProxy.vote === 'neutral',
    'a PAXG proxy premium is INFO — token spread, never a vote');
  const gSent = W.hgFundamentalGate('XAUUSD', 'long', { extra: {
    fng: { v: 88, c: 'Extreme Greed' }, spot: { verdict: 'longs-crowding' }
  }});
  ok(gSent.demote === true && gSent.chips.some(function(c){ return /FUNDAMENTAL HEADWIND 2v0/.test(c); }),
    'two SENTIMENT witnesses (F&G greed + PAXG crowding) demote the gold long — sentiment now gates');
  ok(gSent.chips.indexOf('F&G EXTREME') >= 0, 'the F&G extreme chips beside the headwind');
  const gOneSent = W.hgFundamentalGate('XAUUSD', 'long', { extra: {
    fng: { v: 88, c: 'Extreme Greed' }
  }});
  ok(gOneSent.demote === false && gOneSent.refuse === false,
    'one sentiment witness never flips the gold setup');
  const gMixed = W.hgFundamentalGate('XAUUSD', 'long', { extra: {
    fng: { v: 88, c: 'Extreme Greed' }, spot: { verdict: 'shorts-crowding' }
  }});
  ok(gMixed.demote === false, 'a 1v1 sentiment split is not decisive — the 2-vote bar is real');
}

console.log('\n== the blackout refuses — crypto and gold alike ==');
{
  const W = boot();
  const btc = W.hgFundamentalGate('BTCUSD', 'long', { extra: { news: { risk: 'high', blackout: true, events: [{}] } } });
  ok(btc.refuse === true && /blackout/.test(btc.reason) && btc.chips.indexOf('EVENT BLACKOUT') >= 0,
    'a BTC card into a red-folder window refuses');
  const gold = W.hgFundamentalGate('PAXGUSDT', 'short', { extra: { news: { risk: 'high', blackout: true, events: [{}] } } });
  ok(gold.refuse === true, 'a gold card into the same USD window refuses — the calendar is shared');
  const cold = W.hgFundamentalGate('BTCUSD', 'long', { extra: { news: { risk: 'low', blackout: false, unchecked: true, note: 'news not loaded' } } });
  ok(cold.refuse === false && cold.demote === false, 'an UNCHECKED calendar refuses nothing (hg-v992 honesty)');
  const empty = W.hgFundamentalGate('', 'long', {});
  ok(empty.refuse === false && empty.demote === false && !empty.regime, 'no symbol -> fail-open, no invented gate');
}

console.log('\n== display: chips, blocked note, panel ==');
{
  const W = boot();
  const hw = W.hgFundamentalGate('BTCUSD', 'long', { extra: {
    fng: { v: 88, c: 'Extreme Greed' }, options: { rr25d: { rr25d: -9.1, extreme: true, bias: 'PUTS RICH' } } } });
  ok(hw.demote === true, 'fixture demotes (2 bear vs long)');
  const chip = W.hgFundamentalChipHtml(hw);
  ok(/gpip bad/.test(chip) && /FUNDAMENTAL HEADWIND 2v0/.test(chip), 'the headwind chip renders bad with the split');
  const note = W.hgFundamentalBlockedNoteHtml(hw);
  ok(/FUNDAMENTAL HEADWIND/.test(note) && /still recorded/.test(note),
    'the blocked note names the gate and the anti-deadlock invariant');
  const tw = W.hgFundamentalGate('BTCUSD', 'long', { extra: {
    fng: { v: 12, c: 'Extreme Fear' }, term: { regime: 'backwardation' } } });
  ok(/gpip ok/.test(W.hgFundamentalChipHtml(tw)), 'the tailwind chip renders ok');
  ok(W.hgFundamentalChipHtml(W.hgFundamentalGate('BTCUSD', 'long', { extra: {} })) === '',
    'a dark board prints no chip at all');
  const panel = W.hgFundamentalPanelHtml(W.hgFundamentalRegime('gold', {
    cot: { crowding: 'SPEC CROWDED LONG', zScore: 2.6 },
    news: { risk: 'high', blackout: true, events: [{}] }
  }));
  ok(/FUNDAMENTAL REGIME/.test(panel) && /GOLD/.test(panel) && /BLACKOUT/.test(panel) && /CFTC COT/.test(panel),
    'the gold panel names the asset, the blackout and the COT leg');
  ok(W.hgFundamentalPanelHtml(null) === '', 'no regime -> no panel');
  /* the blocked trade-plan click answers with the reason */
  let alerted = '';
  const W2 = boot([], { alert: function(m){ alerted = String(m); } });
  W2.hgNewsRisk = function(){ return { risk: 'high', blackout: true, events: [{}] }; };
  W2.hgFundamentalNotify('BTCUSD', 'long');
  ok(/BLACKOUT/.test(alerted), 'hgFundamentalNotify explains the block on click');
}

console.log('\n== bookBtnHTML: the ADD button answers every bespoke desk ==');
{
  const W = boot(['book.js']);
  const clearBtn = W.bookBtnHTML('SOLUSDT', 'long', 100, 95, 110, { scanner: 'edge' });
  ok(/addToBook\(/.test(clearBtn), 'a dark board leaves the ADD button live (no deadlock)');
  W.hgNewsRisk = function(){ return { risk: 'high', blackout: true, events: [{ title: 'CPI' }] }; };
  const blocked = W.bookBtnHTML('SOLUSDT', 'long', 100, 95, 110, { scanner: 'edge' });
  ok(!/addToBook\(/.test(blocked) && /EVENT BLACKOUT/.test(blocked) && /WATCH ONLY/.test(blocked),
    'a blackout swaps the ADD button for a WATCH ONLY stamp — any desk, no per-tab edit');
  const bypass = W.bookBtnHTML('SOLUSDT', 'long', 100, 95, 110, { scanner: 'edge', fundGate: false });
  ok(/addToBook\(/.test(bypass), 'fundGate:false opts an internal caller out');
  delete W.hgNewsRisk;
  W.S = { fng: { v: 90, c: 'Extreme Greed' }, dom: null };
  W.termBasisState = function(){ return { rows: [{ sym: 'SOLUSDT', curve: { regime: 'contango' } }] }; };
  const hwBtn = W.bookBtnHTML('SOLUSDT', 'long', 100, 95, 110, { scanner: 'edge' });
  ok(/FUNDAMENTAL HEADWIND/.test(hwBtn) && !/addToBook\(/.test(hwBtn),
    'F&G extreme + contango against a SOL long blocks the button — two checked votes');
  const shortBtn = W.bookBtnHTML('SOLUSDT', 'short', 100, 105, 90, { scanner: 'edge' });
  ok(/addToBook\(/.test(shortBtn), 'the same board WITH the short leaves its button live');
}

console.log('\n== hgToTradePlanOnclickJs: the SEND button answers too ==');
{
  const W = boot(['setup-ui.js']);
  const clear = W.hgToTradePlanOnclickJs('BTCUSD', 'long', 100, 95, 110, { scanner: 'swing' });
  ok(/hgToTradePlan\(/.test(clear) || /toTrade\(/.test(clear), 'a clear board builds the real handoff');
  W.hgNewsRisk = function(){ return { risk: 'high', blackout: true, events: [{}] }; };
  const blocked = W.hgToTradePlanOnclickJs('BTCUSD', 'long', 100, 95, 110, { scanner: 'swing' });
  ok(/hgFundamentalNotify\(/.test(blocked) && !/hgToTradePlan\("BTCUSD"/.test(blocked),
    'a blackout turns the SEND click into the explanation, not the handoff');
  const attr = W.hgToTradePlanOnclickAttr('BTCUSD', 'long', 100, 95, 110, { scanner: 'swing' });
  ok(/hgFundamentalNotify\(/.test(attr), 'the Attr wrapper inherits the gate');
}

console.log('\n== OMNIBTC delegates to the shared stack, behaviour intact ==');
{
  const W = boot(['indicators.js', 'indicators2.js', 'plans.js', 'omnibtc-engines.js', 'omnibtc.js']);
  const r = W.hgObtcFundamentalRegime({ fng: { v: 85, c: 'Extreme Greed' } });
  ok(r.regime === 'bearish' && r.bears === 1 && r.legs.length === 7,
    'the delegate returns the shared BTC board with the v1002 semantics');
  const ev = W.hgObtcEvidenceDecide({ dir: 'long', entry: 100, stop: 90, t1: 120 }, {
    fundamental: W.hgObtcFundamentalRegime({
      fng: { v: 85, c: 'Extreme Greed' }, options: { rr25d: { rr25d: -9.2, extreme: true, bias: 'PUTS RICH' } } })
  });
  ok(ev.demote === true && ev.chips.some(function(c){ return /FUNDAMENTAL HEADWIND/.test(c); }),
    'the evidence verdict still demotes on a decisive headwind');
  const swing = { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, clean: true, passed: 7,
    engine: 'SWING clean plan', _extra: { news: { risk: 'high', blackout: true, events: [{}] } } };
  ok(W.hgObtcPick([swing]) === null, 'a blackout still refuses the only candidate -> WAIT');
}

console.log('\n== wiring pins ==');
{
  const html = read('index.html');
  const sw = read('sw.js');
  ok(/src="fundamental-stack\.js\?v=/.test(html), 'index.html loads fundamental-stack.js');
  ok(html.indexOf('fundamental-stack.js') < html.indexOf('omnibtc-engines.js'),
    'the shared stack loads before the OMNIBTC delegate');
  ok(/'\.\/fundamental-stack\.js'/.test(sw), 'sw.js precaches the module in the app shell');
  ok(html.indexOf('hgFundamentalGate(sym, dir') !== -1
      && (html.match(/!fundBlocks/g) || []).length === 2
      && html.indexOf('${fundChip}') !== -1 && html.indexOf('${fundBlockedHtml}') !== -1,
    'cardHTML computes the gate, renders chip + blocked note, and gates BOTH buttons');
  ok((html.match(/!smartFundBlocks/g) || []).length === 2 && html.indexOf('+ smartFundNote') !== -1,
    'smartCardHTML gates both its buttons and renders the blocked note');
  ok((html.match(/\(bestPEBlocks \|\| bestAgreeBlocks \|\| bestFundBlocks\)/g) || []).length === 2
      && (html.match(/\$\{bestFundChip\}/g) || []).length === 2,
    'BOTH BEST paths carry the gate and the chip');
  const book = read('book.js');
  ok(/hgFundamentalGate\(sym, dir/.test(book) && /WATCH ONLY/.test(book),
    'bookBtnHTML answers for every bespoke desk');
  const su = read('setup-ui.js');
  ok(/hgFundamentalNotify\(/.test(su) && /hgFundamentalGate\(sym, dir/.test(su),
    'hgToTradePlanOnclickJs answers for every bespoke desk');
  const og = read('omnigold.js');
  ok(/hgFundamentalRegime\('gold'\)/.test(og), 'OMNIGOLD renders the gold fundamental board');
  const eng = read('omnibtc-engines.js');
  ok(/hgFundamentalLegs\('btc'/.test(eng) && /hgFundamentalRegime\('btc'/.test(eng),
    'OMNIBTC delegates — no parallel stack to drift');
  const stack = read('fundamental-stack.js');
  ok(!/dxyMock/i.test(stack), 'the mock macro feed is NOT wired in — no fabricated fundamentals');
}

console.log('\npassed: ' + passed);
