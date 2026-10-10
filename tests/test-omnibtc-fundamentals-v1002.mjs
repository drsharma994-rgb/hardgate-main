/* HARDGATE — hg-v1002: OMNIBTC FUNDAMENTAL STACK.

   The OMNIBTC evidence layer used to read onchain / term / carry / flow /
   vision only. The app was ALREADY fetching Fear & Greed, BTC dominance,
   Deribit DVOL + 25d risk reversal, and the event calendar — this tab
   never read them. Now it does, as EVIDENCE:

     - F&G extremes vote contrarian on the house S2 lines (>=80 bear,
       <=20 bull); inside the lines it is neutral.
     - 25d RR extremes vote positioning on the house |8| line (PUTS RICH
       bear, CALLS RICH bull); inside the line it is neutral.
     - DVOL and BTC.D are priors: they render INFO and never vote.
     - The news blackout REFUSES at flow-veto severity; an unchecked
       calendar says UNCHECKED and refuses nothing (hg-v992 honesty).
     - 2+ NET checked votes against the candidate demote it to watch.
       ONE WITNESS NEVER FLIPS A SETUP. A 2v1 split is not decisive.
     - The stack never mints levels and never moves rank math.

   Run: node tests/test-omnibtc-fundamentals-v1002.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild(){} },
    body: { appendChild(){} },
    documentElement: { appendChild(){} },
    addEventListener(){}
  };
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  /* hg-v1003: the stack moved to fundamental-stack.js (house-wide, shared);
     omnibtc-engines.js delegates. Load it first, exactly as index.html does. */
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'fundamental-stack.js', 'omnibtc-engines.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

const LONG = { dir: 'long', entry: 100, stop: 90, t1: 120, clean: true, passed: 7 };
const SHORT = { dir: 'short', entry: 100, stop: 110, t1: 80, clean: true, passed: 7 };
const TICKER = { symbol: 'BTCUSD', exchange: 'delta', mark: 100, fundingPct: -0.01 };

function leg(regime, key){
  return (regime.legs || []).filter(function(l){ return l && l.key === key; })[0] || null;
}

console.log('== all feeds silent: regime UNKNOWN, nothing faked ==');
{
  const W = boot();
  const r = W.hgObtcFundamentalRegime({});
  ok(r && r.regime === 'unknown', 'no directional leg measured -> unknown, never a guessed quiet');
  ok(r.bulls === 0 && r.bears === 0 && r.checked === 0, 'no votes invented from empty feeds');
  ok(r.blackout === false, 'no blackout invented from an unread calendar');
  ok(Array.isArray(r.legs) && r.legs.length === 12, 'twelve legs render even when every feed is dark');
  ok(r.legs.every(function(l){ return l.state === 'unchecked'; }),
    'every dark leg says UNCHECKED — a missing feed is never a neutral vote');

  const ev = W.hgObtcEvidenceDecide(Object.assign({}, LONG), {});
  ok(ev.ok === true && ev.demote === false && ev.refuse === false,
    'silent stack does not fake a confirm, demote or refuse');
  ok(ev.unchecked.indexOf('fundamental') >= 0, 'absent stack is stamped UNCHECKED on the verdict');
  ok(ev.unchecked.indexOf('onchain') >= 0, 'pre-existing unchecked stamps survive');
}

console.log('\n== FEAR & GREED votes contrarian on the house S2 lines ==');
{
  const W = boot();
  ok(leg(W.hgObtcFundamentalRegime({ fng: { v: 85, c: 'Extreme Greed' } }), 'fng').vote === 'bear',
    'F&G 85 votes BEAR (contrarian, S2 >=80 line)');
  ok(leg(W.hgObtcFundamentalRegime({ fng: { v: 80, c: 'Extreme Greed' } }), 'fng').vote === 'bear',
    'F&G exactly 80 is the line — bear');
  ok(leg(W.hgObtcFundamentalRegime({ fng: { v: 15, c: 'Extreme Fear' } }), 'fng').vote === 'bull',
    'F&G 15 votes BULL (contrarian, S2 <=20 line)');
  ok(leg(W.hgObtcFundamentalRegime({ fng: { v: 20, c: 'Extreme Fear' } }), 'fng').vote === 'bull',
    'F&G exactly 20 is the line — bull');
  const mid = leg(W.hgObtcFundamentalRegime({ fng: { v: 50, c: 'Neutral' } }), 'fng');
  ok(mid.vote === 'neutral' && mid.state === 'checked' && !mid.extreme,
    'F&G 50 is a checked neutral — read, but no vote');
  ok(leg(W.hgObtcFundamentalRegime({ fng: null }), 'fng').state === 'unchecked',
    'explicit null = probed and absent -> UNCHECKED, never a vote');

  const W2 = boot({ S: { fng: { v: 82, c: 'Extreme Greed' }, dom: null } });
  ok(leg(W2.hgObtcFundamentalRegime({}), 'fng').vote === 'bear',
    'undefined = never probed -> falls back to the host S read');
}

console.log('\n== 25d risk reversal votes positioning on the house |8| line ==');
{
  const W = boot();
  const puts = leg(W.hgObtcFundamentalRegime({ options: { rr25d: { rr25d: -9.2, extreme: true, bias: 'PUTS RICH' } } }), 'rr25d');
  ok(puts.vote === 'bear' && puts.extreme === true, 'PUTS RICH at an extreme votes BEAR');
  const calls = leg(W.hgObtcFundamentalRegime({ options: { rr25d: { rr25d: 9.2, extreme: true, bias: 'CALLS RICH' } } }), 'rr25d');
  ok(calls.vote === 'bull' && calls.extreme === true, 'CALLS RICH at an extreme votes BULL');
  const inside = leg(W.hgObtcFundamentalRegime({ options: { rr25d: { rr25d: 3.1, extreme: false, bias: 'CALLS RICH' } } }), 'rr25d');
  ok(inside.vote === 'neutral' && inside.state === 'checked', 'inside the |8| line there is no vote to cast');
  /* the module's fallback branch ships { rr25d } with no extreme/bias —
     the house line must be applied, not assumed */
  const raw = leg(W.hgObtcFundamentalRegime({ options: { rr25d: { rr25d: -8.4 } } }), 'rr25d');
  ok(raw.vote === 'bear' && raw.extreme === true, 'raw rr without flags: |rr| >= 8 still reads extreme');
  ok(leg(W.hgObtcFundamentalRegime({ options: { rr25d: { rr25d: 2 } } }), 'rr25d').vote === 'neutral',
    'raw rr inside the line stays neutral');
  ok(leg(W.hgObtcFundamentalRegime({ options: null }), 'rr25d').state === 'unchecked',
    'no Deribit snap -> UNCHECKED');
}

console.log('\n== onchain / term votes mirror the existing evidence rules ==');
{
  const W = boot();
  ok(leg(W.hgObtcFundamentalRegime({ onchain: { bias: 'bullish', flags: {} } }), 'onchain').vote === 'bull', 'onchain bullish votes BULL');
  ok(leg(W.hgObtcFundamentalRegime({ onchain: { bias: 'bearish', flags: {} } }), 'onchain').vote === 'bear', 'onchain bearish votes BEAR');
  ok(leg(W.hgObtcFundamentalRegime({ onchain: { bias: 'neutral', flags: {} } }), 'onchain').vote === 'neutral', 'onchain neutral is a checked neutral');
  ok(leg(W.hgObtcFundamentalRegime({ term: { regime: 'contango' } }), 'term').vote === 'bear', 'contango votes BEAR');
  ok(leg(W.hgObtcFundamentalRegime({ term: { regime: 'perp rich' } }), 'term').vote === 'bear', 'perp rich votes BEAR');
  ok(leg(W.hgObtcFundamentalRegime({ term: { regime: 'backwardation' } }), 'term').vote === 'bull', 'backwardation votes BULL');
  ok(leg(W.hgObtcFundamentalRegime({ term: { regime: 'perp cheap' } }), 'term').vote === 'bull', 'perp cheap votes BULL');
  ok(leg(W.hgObtcFundamentalRegime({ term: { regime: 'flat' } }), 'term').vote === 'neutral', 'flat term is a checked neutral');
}

console.log('\n== DVOL and BTC.D are priors — INFO, never a vote ==');
{
  const W = boot();
  const r = W.hgObtcFundamentalRegime({ dvol: { dvol: 91.2, regime: 'extreme' }, dom: 61.3 });
  ok(r.regime === 'unknown' && r.checked === 0 && r.bulls === 0 && r.bears === 0,
    'an extreme DVOL + a dominance print still cast ZERO directional votes');
  ok(leg(r, 'dvol').info === true && leg(r, 'dvol').extreme === true, 'DVOL renders as an info prior, extreme flagged');
  ok(leg(r, 'dom').info === true && /61.3/.test(leg(r, 'dom').text), 'BTC.D renders as an info prior');

  const r2 = W.hgObtcFundamentalRegime({ fng: { v: 50, c: 'Neutral' }, term: { regime: 'flat' } });
  ok(r2.regime === 'quiet' && r2.checked === 2, 'checked but voteless reads QUIET, not unknown');

  const r3 = W.hgObtcFundamentalRegime({ fng: { v: 85, c: 'Extreme Greed' }, onchain: { bias: 'bullish', flags: {} } });
  ok(r3.regime === 'mixed' && r3.bulls === 1 && r3.bears === 1, 'a tied board reads MIXED');
}

console.log('\n== the stack in the evidence verdict ==');
{
  const W = boot();
  const fund = function(extra){ return W.hgObtcFundamentalRegime(extra); };

  const hw = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: fund({ fng: { v: 85, c: 'Extreme Greed' }, options: { rr25d: { rr25d: -9.2, extreme: true, bias: 'PUTS RICH' } } }) });
  ok(hw.demote === true && hw.refuse === false, 'a 2-0 fundamental headwind demotes the long to watch');
  ok(hw.chips.some(function(c){ return /FUNDAMENTAL HEADWIND 2v0/.test(c); }), 'the headwind chip carries the vote split');
  ok(hw.chips.indexOf('F&G EXTREME') >= 0 && hw.chips.indexOf('RR25 EXTREME') >= 0, 'extreme legs print their chips');

  const one = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: fund({ fng: { v: 85, c: 'Extreme Greed' }, term: { regime: 'flat' } }) });
  ok(one.demote === false && !one.chips.some(function(c){ return /HEADWIND/.test(c); }),
    'ONE WITNESS NEVER FLIPS A SETUP — a single opposing vote does nothing');

  const split = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: fund({ fng: { v: 85, c: 'Extreme Greed' }, options: { rr25d: { rr25d: -9.2, extreme: true, bias: 'PUTS RICH' } }, onchain: { bias: 'bullish', flags: {} } }) });
  ok(split.demote === false, 'a 2v1 split is not decisive — no demote');

  const tw = W.hgObtcEvidenceDecide(Object.assign({}, SHORT),
    { fundamental: fund({ fng: { v: 85, c: 'Extreme Greed' }, options: { rr25d: { rr25d: -9.2, extreme: true, bias: 'PUTS RICH' } } }) });
  ok(tw.demote === false && tw.chips.some(function(c){ return /FUNDAMENTAL TAILWIND 2v0/.test(c); }),
    'the same board WITH the short prints a tailwind chip and touches nothing');

  const dvOnly = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: fund({ dvol: { dvol: 91.2, regime: 'extreme' } }) });
  ok(dvOnly.demote === false && dvOnly.chips.indexOf('DVOL EXTREME') >= 0,
    'a DVOL extreme is a chip, never a demote — a vol prior must not override measured edge');

  const black = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: fund({ news: { risk: 'high', blackout: true, events: [{ title: 'CPI' }] } }) });
  ok(black.ok === false && black.refuse === true && /blackout/.test(black.reason),
    'a red-folder blackout REFUSES at flow-veto severity');
  ok(black.chips.indexOf('EVENT BLACKOUT') >= 0, 'the blackout chip explains the refuse');

  const cold = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: fund({ news: { risk: 'low', blackout: false, unchecked: true, note: 'news not loaded' } }) });
  ok(cold.ok === true && cold.refuse === false,
    'an UNCHECKED calendar refuses nothing — hg-v992 honesty, no fake clear');

  const both = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { flow: { veto: true, reason: 'cvd against' },
      fundamental: fund({ news: { risk: 'high', blackout: true, events: [{}] } }) });
  ok(both.reason === 'cvd against', 'an earlier veto keeps its own reason — first refusal speaks');
}

console.log('\n== apply: fundamental demote strips the badge, keeps the levels ==');
{
  const W = boot();
  const row = Object.assign({}, LONG, { sym: 'BTCUSD' });
  const app = W.hgObtcApplyEvidence(row, {
    fng: { v: 85, c: 'Extreme Greed' },
    options: { rr25d: { rr25d: -9.2, extreme: true, bias: 'PUTS RICH' } }
  });
  ok(app.ok === true && app.row && app.row.clean === false && app.row.near === true,
    'headwind demotes CLEAN to watch — the row is not dropped');
  ok(app.row.entry === 100 && app.row.stop === 90 && app.row.t1 === 120,
    'demote leaves ENTRY / STOP / T1 untouched');
  ok((app.row.evidenceChips || []).some(function(c){ return /FUNDAMENTAL HEADWIND/.test(c); }),
    'the headwind chip rides the card');

  const drop = W.hgObtcApplyEvidence(Object.assign({}, LONG, { sym: 'BTCUSD' }),
    { news: { risk: 'high', blackout: true, events: [{}] } });
  ok(drop.ok === false && drop.row === null, 'a blackout refuses the candidate out of the bag');
}

console.log('\n== pick: the stack gates the MOST PROBABLE tier ==');
{
  const W = boot();
  const swing = function(extra){
    return { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106,
             clean: true, passed: 7, engine: 'SWING clean plan', _extra: extra };
  };
  const fighting = { fng: { v: 85, c: 'Extreme Greed' },
                     options: { rr25d: { rr25d: -9.2, extreme: true, bias: 'PUTS RICH' } } };
  const pickNear = W.hgObtcPick([swing(fighting)]);
  ok(pickNear && pickNear.tier === 'near' && pickNear.row,
    'a 2-0 fundamental headwind turns a CLEAN pick into a NEAR watch — not a ticket, not a vanish');

  const aligned = { fng: { v: 15, c: 'Extreme Fear' },
                    options: { rr25d: { rr25d: 9.2, extreme: true, bias: 'CALLS RICH' } } };
  const pickClean = W.hgObtcPick([swing(aligned)]);
  ok(pickClean && pickClean.tier === 'clean', 'a 2-0 tailwind leaves the CLEAN ticket standing');

  const oneWitness = { fng: { v: 85, c: 'Extreme Greed' } };
  const pickOne = W.hgObtcPick([swing(oneWitness)]);
  ok(pickOne && pickOne.tier === 'clean', 'one opposing witness does not touch the tier');

  const blackout = { news: { risk: 'high', blackout: true, events: [{}] } };
  ok(W.hgObtcPick([swing(blackout)]) === null,
    'a blackout refuses the only candidate -> WAIT, nothing invented');
}

console.log('\n== the panel renders the whole stack, marked honestly ==');
{
  const W = boot();
  ok(W.hgObtcFundamentalPanelHtml(null) === '' && W.hgObtcFundamentalPanelHtml({}) === '',
    'no regime -> no panel, never a fabricated board');
  const r = W.hgObtcFundamentalRegime({
    onchain: { bias: 'bullish', flags: {} },
    fng: { v: 50, c: 'Neutral' },
    dvol: { dvol: 72.4, regime: 'high' },
    dom: 58.4,
    news: { risk: 'low', blackout: false, events: [] }
  });
  const html = W.hgObtcFundamentalPanelHtml(r);
  ok(/FUNDAMENTAL REGIME — BULLISH/.test(html), 'the header names the regime');
  ok(/1 bull \/ 0 bear of 2 directional checked/.test(html), 'the vote tally prints');
  ok(/ON-CHAIN/.test(html) && /BULL · bias bullish/.test(html), 'voting legs render their mark and text');
  ok(/DVOL \(Deribit\)/.test(html) && /INFO · DVOL 72.4 · high/.test(html), 'DVOL renders INFO');
  ok(/BTC DOMINANCE/.test(html) && /58.4%/.test(html), 'BTC.D renders INFO');
  ok(/25Δ RISK REVERSAL/.test(html) && /— · Deribit options snap absent/.test(html),
    'an unread leg renders the — mark, not a fake neutral');

  const bHtml = W.hgObtcFundamentalPanelHtml(W.hgObtcFundamentalRegime({
    news: { risk: 'high', blackout: true, events: [{}] }
  }));
  ok(/BLACKOUT/.test(bHtml) && /EVENT BLACKOUT/.test(bHtml), 'a blackout board says BLACKOUT in the panel');
}

console.log('\n== gather pulls the real feeds, state-only ==');
{
  const W = boot({
    S: { fng: { v: 77, c: 'Greed' }, dom: 58.4 },
    deribitOptionsState: function(){ return Object.freeze({ rr25d: Object.freeze({ rr25d: -9, extreme: true, bias: 'PUTS RICH' }) }); },
    deribitVolState: function(){ return Object.freeze({ dvol: 72.4, regime: 'high' }); },
    hgNewsRisk: function(){ return { risk: 'low', blackout: false, events: [] }; }
  });
  const extra = await W.hgObtcGatherExtra('BTCUSD', TICKER);
  ok(extra && extra.fng && extra.fng.v === 77, 'gather reads Fear & Greed off the host S');
  ok(extra.dom === 58.4, 'gather reads BTC dominance off the host S');
  ok(extra.options && extra.options.rr25d && extra.options.rr25d.rr25d === -9,
    'gather reads the Deribit options STATE — never a fresh book fetch mid-scan');
  ok(extra.dvol && extra.dvol.dvol === 72.4, 'gather reads the DVOL state');
  ok(extra.news && extra.news.blackout === false, 'gather reads the synchronous news risk');
  const regime = W.hgObtcFundamentalRegime(extra);
  ok(regime.legs.filter(function(l){ return l.state === 'checked'; }).length >= 5,
    'a warmed host checks five-plus legs of the seven');
}

console.log('\n== Binance retail long/short votes only at the house 65/35 lines ==');
{
  const W = boot();
  const retail = function(pct){
    return W.hgObtcFundamentalRegime({ retailLs: { latest: { longPct: pct } } });
  };
  ok(leg(retail(71.2), 'retail').vote === 'bear' && leg(retail(71.2), 'retail').extreme === true,
    '71% long is a crowded-long fade — bear');
  ok(leg(retail(65), 'retail').vote === 'bear', 'exactly 65 is the house line — bear');
  ok(leg(retail(35), 'retail').vote === 'bull', 'exactly 35 is the house line — bull');
  ok(leg(retail(28), 'retail').vote === 'bull', '28% long is a crowded-short fade — bull');
  const mid = leg(retail(52), 'retail');
  ok(mid.state === 'checked' && mid.vote === 'neutral' && !mid.extreme,
    '52% long is checked and silent — a lean is not a vote');
  ok(leg(W.hgObtcFundamentalRegime({}), 'retail').state === 'unchecked',
    'no Binance print stays unread');
  ok(leg(W.hgObtcFundamentalRegime({ retailLs: { latest: { longPct: 6500 } } }), 'retail').state === 'unchecked',
    'a percent outside 0-100 is unread, not a fabricated crowd');

  const alone = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: retail(71.2) });
  ok(alone.demote === false && alone.chips.indexOf('RETAIL EXTREME') >= 0,
    'ONE WITNESS NEVER FLIPS A SETUP — retail alone chips and does not demote');

  const both = W.hgObtcFundamentalRegime({
    fng: { v: 85, c: 'Extreme Greed' },
    retailLs: { latest: { longPct: 71.2 } }
  });
  const hw = W.hgObtcEvidenceDecide(Object.assign({}, LONG), { fundamental: both });
  ok(hw.demote === true && /FUNDAMENTAL HEADWIND 2v0/.test((hw.chips || []).join(' ')),
    'F&G extreme plus crowded retail is two witnesses — the long becomes a watch');
  ok(both.bulls === 0 && both.bears === 2, 'the two bear votes are counted, nothing else invented');
}

console.log('\n== a dark host fetches the free sentiment reads, and a failure stays unread ==');
{
  const hits = [];
  const W = boot({
    fetch: async function(url){
      hits.push(String(url));
      if (String(url).indexOf('alternative.me') >= 0){
        return { ok: true, json: async function(){ return { data: [{ value: '18', value_classification: 'Extreme Fear' }] }; } };
      }
      if (String(url).indexOf('coingecko') >= 0){
        return { ok: true, json: async function(){ return { data: { market_cap_percentage: { btc: 54.2 } } }; } };
      }
      return { ok: false, json: async function(){ return null; } };
    },
    binanceLongShort: async function(sym, period, limit){
      hits.push(sym + '|' + period + '|' + limit);
      return { latest: { longPct: 71.2, shortPct: 28.8, ratio: 2.47, t: 1 }, series: [{}] };
    }
  });
  const extra = await W.hgObtcGatherExtra('BTCUSD', TICKER);
  ok(extra.fng && extra.fng.v === 18 && extra.fng.c === 'Extreme Fear',
    'alternative.me fills Fear & Greed when the host has none');
  ok(extra.dom === 54.2, 'CoinGecko fills BTC dominance when the host has none');
  ok(extra.retailLs && extra.retailLs.latest.longPct === 71.2, 'Binance BTCUSDT long/short is on the bag');
  ok(hits.indexOf('BTCUSDT|4h|6') >= 0, 'the retail read is the 4h BTCUSDT print, six bars');
  const regime = W.hgObtcFundamentalRegime(extra);
  ok(leg(regime, 'fng').vote === 'bull' && leg(regime, 'retail').vote === 'bear',
    'fear is contrarian bull and crowded retail is bear — they do not agree');

  const W2 = boot({
    fetch: async function(){ throw new Error('offline'); },
    binanceLongShort: async function(){ throw new Error('fapi down'); }
  });
  const dead = await W2.hgObtcGatherExtra('BTCUSD', TICKER);
  ok(dead && !(dead.fng && isFinite(+dead.fng.v)), 'a failed Fear & Greed fetch does not invent a number');
  ok(dead.dom == null, 'a failed dominance fetch does not invent a number');
  ok(dead.retailLs === null, 'a failed long/short fetch is null, not a throw');

  let called = 0;
  const W3 = boot({
    S: { fng: { v: 77, c: 'Greed' }, dom: 58.4 },
    fetch: async function(){ called++; return { ok: true, json: async function(){ return { data: [{ value: '1' }] }; } }; }
  });
  const held = await W3.hgObtcGatherExtra('BTCUSD', TICKER);
  ok(held.fng.v === 77 && held.dom === 58.4,
    'a warmed Fear & Greed and dominance print is not overwritten');
  ok(called > 0, 'hashrate and CoinMetrics are still asked when the host has no copy');
}

console.log('\n== hashrate, NVT and OI divergence vote only when measured ==');
{
  const W = boot();
  const hash = function(ch){ return W.hgObtcFundamentalRegime({ hashrate: { change30d: ch } }); };
  ok(leg(hash(-0.06), 'hashrate').vote === 'bear' && leg(hash(-0.06), 'hashrate').extreme === true,
    'hashrate -6% over 30d is miner stress — bear');
  ok(leg(hash(-0.04), 'hashrate').state === 'checked' && leg(hash(-0.04), 'hashrate').vote === 'neutral',
    'hashrate inside -5% is checked and silent');
  ok(leg(W.hgObtcFundamentalRegime({}), 'hashrate').state === 'unchecked',
    'a missing hashrate is unread, not a pass');

  const cm = W.hgObtcCoinmetricsRead([
    { AdrActCnt: '800000', TxTfrValMeanUSD: '500', CapMrktCurUSD: '1000000000000' },
    { AdrActCnt: '1000000', TxTfrValMeanUSD: '400', CapMrktCurUSD: '40000000000' }
  ]);
  ok(cm && cm.activeAddresses === 1000000 && cm.nvt === 100, 'NVT is cap / (mean transfer * active addresses)');
  const rich = W.hgObtcFundamentalRegime({ coinmetrics: { activeAddresses: 1000000, adrChange30d: 0.1, nvt: 100 } });
  ok(leg(rich, 'nvt').vote === 'bear', 'NVT 100 is at or above 90 — bear');
  ok(leg(rich, 'addr').info === true && leg(rich, 'addr').vote === 'neutral',
    'active addresses render and never vote');
  const cheap = W.hgObtcFundamentalRegime({ coinmetrics: { activeAddresses: 1000000, nvt: 40 } });
  ok(leg(cheap, 'nvt').vote === 'neutral' && leg(cheap, 'nvt').state === 'checked',
    'NVT under 90 is checked and silent');
  const noNvt = W.hgObtcFundamentalRegime({ coinmetrics: { activeAddresses: 1000000, nvt: null } });
  ok(leg(noNvt, 'nvt').state === 'unchecked', 'a null NVT is unread — it does not pass a gate');

  const rows = [];
  const ois = [];
  for (let i = 0; i < 15; i++){
    rows.push({ t: i, o: 100, h: 101, l: 99, c: 100 + i, v: 1 });
    ois.push({ oi: 1000 + i, t: i });
  }
  for (let i = 15; i < 20; i++){
    rows.push({ t: i, o: 100, h: 121, l: 99, c: 100 + i, v: 1 });
    ois.push({ oi: 1014 - (i - 14) * 10, t: i });
  }
  const fresh = W.hgObtcOiDivRead(rows, { series: ois });
  ok(fresh && fresh.dir === 'short', 'price up and open interest down is a fresh bearish divergence');
  const standingRows = rows.slice();
  const standingOi = ois.slice();
  for (let k = 0; k < 5; k++){
    standingRows.push({ t: 20 + k, o: 120, h: 121, l: 119, c: 120 + k, v: 1 });
    standingOi.push({ oi: 980 - k, t: 20 + k });
  }
  ok(W.hgObtcOiDivRead(standingRows, { series: standingOi }) === null,
    'the same divergence five bars earlier is a standing bias and does not vote');
  const board = W.hgObtcFundamentalRegime({ oiDiv: { dir: 'short' }, hashrate: { change30d: -0.08 } });
  const hw = W.hgObtcEvidenceDecide(Object.assign({}, LONG), { fundamental: board });
  ok(hw.demote === true && /HEADWIND 2v0/.test((hw.chips || []).join(' ')),
    'hashrate stress plus a fresh OI divergence is two witnesses — the long is a watch');
  const one = W.hgObtcEvidenceDecide(Object.assign({}, LONG),
    { fundamental: W.hgObtcFundamentalRegime({ oiDiv: { dir: 'short' } }) });
  ok(one.demote === false && one.chips.indexOf('OI DIVERGENCE') >= 0,
    'OI divergence alone does not flip the setup');
}

console.log('\n== wiring: scan gathers, paint renders, header is honest ==');
{
  const src = read('omnibtc.js');
  const eng = read('omnibtc-engines.js');
  ok(/hgObtcFundamentalRegime/.test(src), 'the scan computes the fundamental regime');
  ok(/fundamental: fundamental/.test(src), 'the snap carries the regime to paint');
  ok(/hgObtcFundamentalPanelHtml/.test(src), 'paint renders the panel under the card');
  ok(/FUNDAMENTAL STACK/.test(src), 'the tab header names the stack it runs');
  ok(/fundamental stack/i.test(src) && /red-folder blackout refuses/.test(src),
    'the mount note tells the operator what the stack does');
  ok(/W\.hgObtcFundamentalLegs/.test(eng) && /W\.hgObtcFundamentalRegime/.test(eng)
      && /W\.hgObtcFundamentalPanelHtml/.test(eng), 'the stack is exported for the tab');
  ok(/one witness never flips/i.test(eng), 'the engine header states the one-witness rule');
  ok(!/dxyMock|dxyMock/i.test(eng), 'the mock macro feed is NOT wired in — no fabricated fundamentals');
}

console.log('\npassed: ' + passed);
