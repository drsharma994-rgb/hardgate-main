/* HARDGATE — OMNIROUTE most-probable setups are a *balanced* read.

   Field request: add more indicators and strategies, use every fed-in
   engine, balance the output, pin a few MOST PROBABLE setups at the top.

   Before this pack the crypto desk:
     - sorted by hgOmniRank (nAgree, then evaluated, then R:R)
     - pinned one house MOST PROBABLE into #omniCards, so the walk-forward
       pool and the first vetoed card could bury the answer
     - did not share indicator info-reads with the rank
     - did not call house EDGE / MR / squeeze / sniper / G1–G7 as extra
       votes on every scanned contract

   After:
     - a composite score balances strategy-family consensus against
       indicator info-reads plus coverage and extra mechanics on the same
       trade. It is NOT a win probability.
     - house extra engines vote on every scanned contract and never claim 7/7 CLEAN
     - MOST PROBABLE SETUPS (up to three tape-aligned tickets, distinct
       symbols) lead the tab with ENTRY / STOP / T1 / T2
     - a LONG is never the most probable setup while MARKET PICTURE is short
     - G1–G7 and crypto execute stay as they are

   Run: node tests/test-omniroute-most-probable.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUTE = read('omniroute.js');
const GATES = read('cryptogates.js');
const EXEC = read('execute.js');
const HG_GATES = read('hg-gates.js');
const GOLD = read('omnigold.js');

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function ticket(over){
  return Object.assign({
    sym: 'BTCUSD',
    base: 'BTC',
    kind: 'ORB',
    dir: 'long',
    grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
    plan: { entry: 68000, stop: 66000, t1: 72000, t2: 74000, rr1: 2.0 },
    distAtr: 0.5,
    consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: [
      { key: 'adx-trend', info: true, pass: true },
      { key: 'macd-momentum', info: true, pass: true },
      { key: 'ichimoku', info: true, pass: true }
    ],
    alsoKinds: []
  }, over || {});
}

console.log('== exports ==');
{
  const W = boot();
  ok(typeof W.hgOmniInfoNet === 'function', 'hgOmniInfoNet exported');
  ok(typeof W.hgOmniBalanceScore === 'function', 'hgOmniBalanceScore exported');
  ok(typeof W.hgOmniMostProbablePanelHtml === 'function', 'hgOmniMostProbablePanelHtml exported');
  ok(typeof W.hgOmniDeskOrder === 'function', 'hgOmniDeskOrder exported');
  ok(typeof W.hgOmniPickFew === 'function', 'hgOmniPickFew exported');
  ok(typeof W.hgOmniHouseHits === 'function', 'hgOmniHouseHits exported');
  ok(typeof W.hgOmniRank === 'function', 'hgOmniRank stays exported for other desks');
}

console.log('== indicator net ignores hard gates and unread info ==');
{
  const W = boot();
  const n = W.hgOmniInfoNet([
    { key: 'trend', hard: true, pass: true },
    { key: 'adx-trend', info: true, pass: true },
    { key: 'macd-momentum', info: true, pass: false },
    { key: 'ichimoku', info: true, pass: null },
    { key: 'rsi-classic', info: true, pass: true }
  ]);
  ok(n.n === 4, 'four info reads counted (got ' + n.n + ')');
  ok(n.pass === 2 && n.fail === 1, 'pass/fail skip null (pass=' + n.pass + ' fail=' + n.fail + ')');
  ok(n.net === 1, 'net is pass minus fail (got ' + n.net + ')');
  ok(W.hgOmniInfoNet([]).net === 0 && W.hgOmniInfoNet(null).n === 0, 'empty ledger is a zero, not a throw');
}

console.log('== balanced score: strategies and indicators share the rank, tape is a hard lean ==');
{
  const W = boot();
  const lonely = ticket({
    kind: 'ORB', distAtr: 0.15, rr: 4,
    consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: [{ key: 'adx-trend', info: true, pass: false }, { key: 'macd-momentum', info: true, pass: false }]
  });
  const chorus = ticket({
    kind: 'MMOVE', distAtr: 1.5, rr: 2,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['TREND','SWEEP','POSITIONING','CROSS-SECTIONAL'], against: [], split: [] },
    gates: [
      { key: 'adx-trend', info: true, pass: true },
      { key: 'macd-momentum', info: true, pass: true },
      { key: 'ichimoku', info: true, pass: true },
      { key: 'rsi-classic', info: true, pass: true }
    ]
  });
  ok(W.hgOmniBalanceScore(chorus, 'long') > W.hgOmniBalanceScore(lonely, 'long'),
     'a chorus of families + indicators outranks a nearer lonely high-R:R ticket');
  const against = ticket({ dir: 'short', kind: 'VALUE', distAtr: 0.05,
    consensus: { nAgree: 5, nAgainst: 0, nSplit: 0, agree: ['REVERSION'], against: [], split: [] } });
  ok(W.hgOmniBalanceScore(lonely, 'long') > W.hgOmniBalanceScore(against, 'long'),
     'against-tape scores below with-tape even when the against card is nearer and louder');
}

console.log('== pick few: tape-aligned tickets, distinct symbols, never invent ==');
{
  const W = boot();
  const btc = ticket({ sym: 'BTCUSD', base: 'BTC', kind: 'ORB' });
  const eth = ticket({
    sym: 'ETHUSD', base: 'ETH', kind: 'MMOVE',
    plan: { entry: 3400, stop: 3200, t1: 3800, t2: 4000, rr1: 2 },
    consensus: { nAgree: 3, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] }
  });
  const sol = ticket({
    sym: 'SOLUSD', base: 'SOL', kind: 'PO3',
    plan: { entry: 180, stop: 170, t1: 200, t2: 210, rr1: 2 },
    consensus: { nAgree: 2, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] }
  });
  const dupBtc = ticket({
    sym: 'BTCUSD', base: 'BTC', kind: 'SPRING',
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] }
  });
  const few = W.hgOmniPickFew([btc, eth, sol, dupBtc], 'long', 3);
  ok(few.length === 3, 'caps at three (got ' + few.length + ')');
  ok(new Set(few.map(c => c.sym)).size === 3, 'one trade per symbol');
  ok(few.every(c => c.dir === 'long'), 'only longs on a long tape');

  const shortFade = ticket({ dir: 'short', kind: 'VALUE', plan: { entry: 69000, stop: 71000, t1: 65000, t2: 63000, rr1: 2 } });
  ok(W.hgOmniPickFew([shortFade], 'long', 3).length === 0, 'long tape with only a SHORT is not a substitute pick');
  ok(W.hgOmniPickFew([shortFade, btc], 'aside', 3).length === 0, 'STAND ASIDE market picture does not invent a pick');
  const watch = Object.assign(ticket({ kind: 'ABSORB' }), { grade: { ticket: false, vetoes: ['trend'], evaluated: 20, total: 47 }, plan: { entry: 1, stop: 2, t1: 0.5, rr1: 2 } });
  ok(W.hgOmniPickFew([watch], 'long', 3).length === 0, 'a watch is not promoted to MOST PROBABLE');
}

console.log('== card list: with-tape above against-tape ==');
{
  const W = boot();
  const withTape = ticket({ dir: 'long', kind: 'ORB', distAtr: 1.8 });
  const against = ticket({ dir: 'short', kind: 'VALUE', distAtr: 0.05,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['REVERSION'], against: [], split: [] } });
  const watch = Object.assign(ticket({ dir: 'long', kind: 'PIN-REJECT', distAtr: 0.4 }), {
    grade: { ticket: false, vetoes: ['trend'], evaluated: 30, total: 47 }
  });
  const ordered = W.hgOmniDeskOrder([against, watch, withTape], 'long');
  ok(ordered[0] === withTape || ordered[0].dir === 'long', 'first card is with-tape (got ' + ordered[0].kind + ' ' + ordered[0].dir + ')');
  ok(ordered[ordered.length - 1] === against, 'against-tape sinks to the bottom even when it is the nearest ticket');
}

console.log('== MOST PROBABLE SETUPS panel: few tickets, real levels, no invented 7/7 ==');
{
  const W = boot();
  const btc = ticket({ sym: 'BTCUSD', kind: 'ORB' });
  const eth = ticket({
    sym: 'ETHUSD', base: 'ETH', kind: 'MMOVE',
    plan: { entry: 3400, stop: 3200, t1: 3800, t2: 4000, rr1: 2 }
  });
  const html = W.hgOmniMostProbablePanelHtml([btc, eth], 'long');
  ok(/MOST PROBABLE/.test(html), 'panel uses house MOST PROBABLE language');
  ok(/BTCUSD/.test(html) && /ETHUSD/.test(html), 'both symbols appear');
  ok(/ENTRY/.test(html) && /STOP/.test(html) && /T1/.test(html), 'levels are printed');
  ok(/68000/.test(html) && /3400/.test(html), 'each row keeps its own entry');
  ok(!/XAUUSD/.test(html), 'crypto panel is not gold');
  ok(!/7\/7 CLEAN/.test(html), 'OMNIROUTE never claims crypto 7/7 CLEAN');
  ok(!/% chance|most likely to win|win rate of|probability to win/i.test(html),
     'no win-probability language on the panel');
  ok(/not a win probability/i.test(html), 'the panel says the score is not a probability');
  ok(/data-hg-mp="omniroute"/.test(html) || /data-omni-mp/.test(html),
     'panel is tagged so house pin can find it');
}

console.log('== SHORT against long tape is not MOST PROBABLE ==');
{
  const W = boot();
  const shortOnly = ticket({ dir: 'short', kind: 'VALUE', plan: { entry: 69000, stop: 71000, t1: 65000, t2: 63000, rr1: 2 } });
  const few = W.hgOmniPickFew([shortOnly], 'long', 3);
  ok(few.length === 0, 'no STRONGEST short on a long tape');
  const html = W.hgOmniMostProbablePanelHtml(few, 'long');
  ok(/MOST PROBABLE/.test(html), 'the tab still leads with MOST PROBABLE when standing aside');
  ok(/going up|TAKE LONGS|long tape/i.test(html), 'stand-aside copy names the long tape');
  ok(!/69000/.test(html), 'against-tape short levels are not printed as the setup');
}

console.log('== host sits above the pool so it leads the tab ==');
{
  ok(/id="omniMp"/.test(ROUTE), 'dedicated MOST PROBABLE host exists');
  const mount = ROUTE.slice(ROUTE.indexOf('function mountOmniroute'), ROUTE.indexOf('function refreshOmniroute'));
  const mpAt = mount.indexOf('id="omniMp"');
  const poolAt = mount.indexOf('id="omniPool"');
  const cardsAt = mount.indexOf('id="omniCards"');
  ok(mpAt > 0 && mpAt < poolAt && mpAt < cardsAt,
     'MOST PROBABLE host sits above the walk-forward pool and the card list');
  ok(/hgMpPin\(\s*'omniroute'/.test(ROUTE), 'house MOST PROBABLE pin remains');
}

console.log('== all fed-in shared mechanics still run, plus house extra engines ==');
{
  ok(/hgMechRunAll/.test(ROUTE), 'shared hg-mechanics detectors still run on every contract');
  ok(/hgIndicatorGates/.test(ROUTE), 'shared indicator bank still lands on every card');
  const house = ROUTE.slice(ROUTE.indexOf('function hgOmniHouseHits'), ROUTE.indexOf('function hgOmniInfoNet'));
  ok(/edgeSignal/.test(house), 'EDGE is a house extra vote');
  ok(/mrSignal/.test(house), 'mean-reversion is a house extra vote');
  ok(/squeezeClassify/.test(house), 'squeeze is a house extra vote');
  ok(/rsAssess/.test(house), 'reversal sniper is a house extra vote');
  ok(/swingTryClean/.test(house), 'SWING 7/7 path is read as a vote, not claimed as 7/7');
  ok(/swingTryFundingFade/.test(house) && /scalpTryFundingFade/.test(house),
     'both funding-fade paths vote when their bars exist');
  ok(/extra:\s*true/.test(house) || /extra:true/.test(house), 'house hits are stamped extra');
  ok(!/clean:\s*true/.test(house), 'house hits never stamp clean:true');
}

console.log('== house extra hits never claim 7/7 and do not throw when engines are missing ==');
{
  const W = boot();
  const rows = [];
  let p = 60000;
  for (let i = 0; i < 120; i++){
    p = p * (1 + Math.sin(i / 9) * 0.002);
    rows.push({ t: 1700000000 + i * 14400, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 900 });
  }
  let threw = false;
  let hits = [];
  try { hits = W.hgOmniHouseHits(rows, { sym: 'BTCUSD', base: 'BTC' }, {}); }
  catch (e){ threw = true; }
  ok(!threw, 'missing house engines do not take the scan down');
  ok(Array.isArray(hits), 'returns an array');
  ok(hits.every(h => h && h.extra === true), 'every hit is extra');
  ok(hits.every(h => h.clean !== true), 'none claim CLEAN');
  ok(hits.every(h => h.dir === 'long' || h.dir === 'short'), 'dir is long or short');

  W.edgeSignal = function(){ return { dir: 'long', entry: 60100, stop: 59000, t1: 63000 }; };
  W.mrSignal = function(){ return { dir: 'short', entry: 59900, stop: 61000, target: 58000 }; };
  W.squeezeClassify = function(){ return { state: 'FIRED_LONG' }; };
  W.rsAssess = function(){ return { dir: 'long', entry: 60050 }; };
  W.swingTryClean = function(){ return { dir: 'long', entry: 60000, stop: 58000, t1: 64000, clean: true }; };
  const wired = W.hgOmniHouseHits(rows, { sym: 'BTCUSD' }, {});
  ok(wired.some(h => h.kind === 'EDGE'), 'EDGE reaches the bag when the engine fires');
  ok(wired.some(h => h.kind === 'MR'), 'mean-rev reaches the bag');
  ok(wired.some(h => h.kind === 'HOUSE-SQUEEZE'), 'squeeze fire reaches the bag');
  ok(wired.some(h => h.kind === 'SNIPER'), 'sniper reaches the bag');
  ok(wired.some(h => h.kind === 'SWING'), 'house SWING vote reaches the bag');
  ok(wired.every(h => h.clean !== true && h.extra === true),
     'a 7/7 SWING return is stripped to an extra vote — 7/7 stays on the SWING tab');
}

console.log('== evaluate merges house hits into the same ledger ==');
{
  ok(/hgOmniHouseHits\(/.test(ROUTE) && /hgOmniDetect\(/.test(ROUTE),
     'evaluate still detects, then adds house hits');
  const famSrc = ROUTE.slice(ROUTE.indexOf('var OMNI_FAMILY'), ROUTE.indexOf('function hgOmniFamilyOf'));
  for (const k of ['EDGE', 'MR', 'HOUSE-SQUEEZE', 'SNIPER', 'SWING', 'SCALP', 'COIL', 'TRAP', 'SMC', 'FUND-FADE']){
    ok(famSrc.indexOf("'" + k + "'") >= 0, k + ' is mapped to a consensus family');
  }
}

console.log('== shared indicator bank grew with unused tape reads ==');
{
  ok(/key:'rsi-classic'/.test(HG_GATES), 'classic RSI is a shared info read');
  ok(/key:'roc-thrust'/.test(HG_GATES), 'rate-of-change thrust is a shared info read');
  ok(/key:'vwap-stretch'/.test(HG_GATES), 'VWAP stretch is a shared info read');
  ok(/hard:false, info:true/.test(HG_GATES.slice(HG_GATES.indexOf("key:'rsi-classic'"), HG_GATES.indexOf("key:'rsi-classic'") + 80)),
     'rsi-classic is info, not a veto');
}

console.log('== two-sided house votes must not throw on an undefined gfn ==');
{
  ok(!/\bgfn\(/.test(ROUTE), 'omniroute consensus looks up detectRegime on window, not an undefined gfn');
  const W = boot();
  const rows = [];
  let p = 60000;
  for (let i = 0; i < 120; i++){
    p = p * (1 + Math.sin(i / 9) * 0.002);
    rows.push({ t: 1700000000 + i * 14400, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 900 });
  }
  W.mrSignal = function(){ return { dir: 'short', entry: p * 0.999, stop: p * 1.01, target: p * 0.97 }; };
  W.edgeSignal = function(){ return { dir: 'long', entry: p, stop: p * 0.98, t1: p * 1.04 }; };
  let threw = false, found = [];
  try { found = W.hgOmniEvaluate({ sym: 'BTCUSD', base: 'BTC' }, rows, null, {}); }
  catch (e){ threw = true; }
  ok(!threw, 'evaluate does not throw when extra engines vote both ways');
  ok(Array.isArray(found), 'still returns an array');
}

console.log('== hard constraints stay closed ==');
{
  ok(/CG_SWING_RR_MIN\s*=\s*2/.test(GATES) || /CG_SWING_RR_MIN = 2/.test(GATES),
     'G6 R:R floor is untouched');
  ok(/0\.25/.test(GATES) && /G1/.test(GATES) || /CG_SWING_SPREAD/.test(GATES) || /0\.25\s*\*\s*a/.test(GATES),
     'G1 spread path remains in cryptogates');
  ok(!/LIVE TRADING ENABLED|execute live crypto/i.test(EXEC.slice(0, 800)),
     'crypto live trading stays disabled in execute.js head');
  ok(/GOLD_STOP_MAX_PCT\s*=\s*0\.025/.test(GOLD), 'gold min-loss is untouched');
}

console.log('== version stamp ==');
{
  ok(/^hg-v\d+$/.test(HG_VER), 'build stamp is a hg-vN version (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches the stamp');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIROUTE MOST-PROBABLE TESTS PASSED');
