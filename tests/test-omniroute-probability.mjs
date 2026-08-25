/* HARDGATE — OMNIROUTE prints a T1-first probability on every formation.

   Field request: balance every indicator and strategy into an exact
   probability percentage for each setup, with the maximum at the top
   of the OMNIROUTE tab.

   This is P(T1 prints before stop) from:
     1. this mechanic's own walk-forward / forward record, shrunk so
        2-of-2 is not 100%
     2. live tape + strategy-family consensus + indicator info-reads
        as a bounded log-odds update
   Same inputs always yield the same integer. It is not "% chance to win"
   and it is not a PnL forecast.

   Run: node tests/test-omniroute-probability.mjs */
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
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: [
      { key: 'adx-trend', info: true, pass: true },
      { key: 'macd-momentum', info: true, pass: true },
      { key: 'ichimoku', info: true, pass: true }
    ],
    alsoKinds: [],
    stats: null,
    fwd: null
  }, over || {});
}

console.log('== exports ==');
{
  const W = boot();
  ok(typeof W.hgOmniProbParts === 'function', 'hgOmniProbParts exported');
  ok(typeof W.hgOmniProbPct === 'function', 'hgOmniProbPct exported');
  ok(typeof W.hgOmniStampProb === 'function', 'hgOmniStampProb exported');
  ok(typeof W.hgOmniProbLabel === 'function', 'hgOmniProbLabel exported');
}

console.log('== exact: same inputs, same integer, always 1..99 ==');
{
  const W = boot();
  const c = ticket();
  const a = W.hgOmniProbPct(c, 'long');
  const b = W.hgOmniProbPct(c, 'long');
  ok(a === b, 'deterministic: two calls match (got ' + a + ' then ' + b + ')');
  ok(Number.isInteger(a), 'percentage is an integer (got ' + a + ')');
  ok(a >= 1 && a <= 99, 'clamped to 1..99 (got ' + a + ')');
  const parts = W.hgOmniProbParts(c, 'long');
  ok(parts.pct === a, 'parts.pct matches hgOmniProbPct');
  ok(parts.p > 0 && parts.p < 1, 'raw p is an open unit interval');
  ok(!W.hgOmniProbPct(null, 'long') || W.hgOmniProbPct(null, 'long') >= 1,
     'null candidate does not throw');
  let threw = false;
  try { W.hgOmniProbParts({}, 'aside'); W.hgOmniStampProb(null, 'long'); }
  catch (e){ threw = true; }
  ok(!threw, 'degenerate input never throws');
}

console.log('== 2-of-2 is not 100%: shrinkage is the exactness ==');
{
  const W = boot();
  const two = ticket({
    stats: { samples: 2, wins: 2, hit: 1, expR: 2 }
  });
  const pct = W.hgOmniProbPct(two, 'long');
  ok(pct < 90, 'two winning samples cannot print 90%+ (got ' + pct + '%)');
  const none = ticket({
    stats: { samples: 20, wins: 0, hit: 0, expR: -1 }
  });
  const low = W.hgOmniProbPct(none, 'long');
  ok(low < pct, '0/20 sits below 2/2 (got ' + low + '% vs ' + pct + '%)');
  ok(low >= 1, 'a losing book still prints a number, not blank (got ' + low + ')');
}

console.log('== walk-forward record is the base; live tape/indicators move it ==');
{
  const W = boot();
  const paid = ticket({
    fwd: { samples: 40, wins: 22, hit: 22 / 40, ticketOnly: { samples: 30, wins: 18, hit: 18 / 30 } }
  });
  const unpaid = ticket({
    kind: 'SPRING',
    fwd: { samples: 40, wins: 8, hit: 8 / 40, ticketOnly: { samples: 30, wins: 6, hit: 6 / 30 } }
  });
  const pPaid = W.hgOmniProbPct(paid, 'long');
  const pUnpaid = W.hgOmniProbPct(unpaid, 'long');
  ok(pPaid > pUnpaid, 'a mechanic that has paid out-of-sample outranks one that has not ('
     + pPaid + '% vs ' + pUnpaid + '%)');
  const parts = W.hgOmniProbParts(paid, 'long');
  ok(parts.kind === 'measured' || parts.kind === 'thin',
     'with 30 settled tickets the kind is measured or thin (got ' + parts.kind + ')');
  ok(parts.n >= 30, 'uses the ticket-cleared forward count when present (n=' + parts.n + ')');
}

console.log('== every strategy family AND every indicator read moves the number ==');
{
  const W = boot();
  const lonely = ticket({
    distAtr: 0.15,
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: [{ key: 'adx-trend', info: true, pass: false }, { key: 'macd-momentum', info: true, pass: false }]
  });
  const chorus = ticket({
    kind: 'MMOVE', distAtr: 1.5,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0,
      agree: ['TREND','SWEEP','POSITIONING','CROSS-SECTIONAL'], against: [], split: [] },
    gates: [
      { key: 'adx-trend', info: true, pass: true },
      { key: 'macd-momentum', info: true, pass: true },
      { key: 'ichimoku', info: true, pass: true },
      { key: 'rsi-classic', info: true, pass: true }
    ],
    alsoKinds: ['ORB', 'PO3']
  });
  const pChorus = W.hgOmniProbPct(chorus, 'long');
  const pLonely = W.hgOmniProbPct(lonely, 'long');
  ok(pChorus > pLonely, 'chorus of families + indicators > lonely ticket ('
     + pChorus + '% vs ' + pLonely + '%)');
  const against = ticket({ dir: 'short' });
  ok(W.hgOmniProbPct(ticket(), 'long') > W.hgOmniProbPct(against, 'long'),
     'against-tape prints a lower % than the same book with the tape');
  const watch = Object.assign(ticket({ kind: 'ABSORB' }), {
    grade: { ticket: false, vetoes: ['trend'], evaluated: 20, total: 47 }
  });
  ok(W.hgOmniProbPct(ticket(), 'long') > W.hgOmniProbPct(watch, 'long'),
     'a vetoed watch prints below a cleared ticket');
}

console.log('== stamp + rank: max % leads, every formation carries the integer ==');
{
  const W = boot();
  const low = ticket({
    sym: 'AAAUSD', kind: 'SPRING',
    stats: { samples: 40, wins: 8, hit: 0.2 }
  });
  const high = ticket({
    sym: 'BTCUSD', kind: 'ORB',
    stats: { samples: 40, wins: 24, hit: 0.6 },
    consensus: { nAgree: 3, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] }
  });
  const mid = ticket({
    sym: 'ETHUSD', kind: 'MMOVE',
    plan: { entry: 3400, stop: 3200, t1: 3800, t2: 4000, rr1: 2 },
    stats: { samples: 40, wins: 16, hit: 0.4 }
  });
  const stamped = W.hgOmniStampProb([low, mid, high], 'long');
  ok(stamped.every(c => Number.isInteger(c.probPct) && c.probPct >= 1 && c.probPct <= 99),
     'every formation is stamped with an integer %');
  const ordered = W.hgOmniDeskOrder(stamped, 'long');
  ok(ordered[0].sym === 'BTCUSD', 'highest probability leads the desk (got ' + ordered[0].sym + ')');
  ok(ordered[0].probPct >= ordered[1].probPct && ordered[1].probPct >= ordered[2].probPct,
     'desk order is descending % (' + ordered.map(c => c.sym + ':' + c.probPct).join(', ') + ')');
  const few = W.hgOmniPickFew(stamped, 'long', 3);
  ok(few[0].sym === 'BTCUSD', 'MOST PROBABLE first row is the max (got ' + few[0].sym + ')');
  ok(few[0].probPct === Math.max(...stamped.map(c => c.probPct)),
     'first pick is the max percentage');
}

console.log('== MOST PROBABLE panel: max % on top, % on every ticket ==');
{
  const W = boot();
  const btc = ticket({
    sym: 'BTCUSD',
    stats: { samples: 40, wins: 24, hit: 0.6 },
    consensus: { nAgree: 3, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] }
  });
  const eth = ticket({
    sym: 'ETHUSD', kind: 'MMOVE',
    plan: { entry: 3400, stop: 3200, t1: 3800, t2: 4000, rr1: 2 },
    stats: { samples: 40, wins: 16, hit: 0.4 }
  });
  W.hgOmniStampProb([btc, eth], 'long');
  const html = W.hgOmniMostProbablePanelHtml([btc, eth], 'long');
  ok(/MOST PROBABLE/.test(html), 'panel heading stays MOST PROBABLE SETUPS');
  ok(/data-omni-prob-max="\d+"/.test(html) || /omni-prob-max/.test(html),
     'MAX percentage is tagged at the top of the panel');
  const max = Math.max(btc.probPct, eth.probPct);
  ok(html.indexOf(String(max) + '%') >= 0, 'the max integer is printed (max=' + max + ')');
  ok(/data-omni-prob="/.test(html), 'each ticket row carries data-omni-prob');
  ok(/BTCUSD/.test(html) && /ETHUSD/.test(html), 'both tickets still show');
  ok(/ENTRY/.test(html) && /STOP/.test(html) && /T1/.test(html), 'levels stay on the max row');
  ok(/T1-first/.test(html), 'the unit is T1-first, not a fortune');
  ok(!/% chance|most likely to win|probability to win/i.test(html),
     'no fortune-telling language');
  ok(!/7\/7 CLEAN/.test(html), 'still never claims 7/7 CLEAN');
}

console.log('== cards print the same integer as the rank ==');
{
  const W = boot();
  ok(/function setupCard/.test(ROUTE) && /omni-prob/.test(ROUTE.slice(ROUTE.indexOf('function setupCard'), ROUTE.indexOf('function setupCard') + 2500)),
     'setup cards render the omni-prob badge');
  const c = ticket({ stats: { samples: 40, wins: 20, hit: 0.5 } });
  W.hgOmniStampProb([c], 'long');
  ok(c.probPct >= 1, 'stamp writes probPct onto the candidate');
  const label = W.hgOmniProbLabel(W.hgOmniProbParts(c, 'long'));
  ok(/%/.test(label) && /T1-first/.test(label), 'label names the unit (got ' + label + ')');
}

console.log('== evaluate carries stats/fwd onto the candidate so the % can use them ==');
{
  ok(/stats:\s*exForHit\.stats/.test(ROUTE) || /stats: exForHit.stats/.test(ROUTE),
     'evaluate attaches per-mechanic walk-forward stats to the candidate');
  ok(/fwd:\s*exForHit\.fwd/.test(ROUTE) || /fwd: exForHit.fwd/.test(ROUTE),
     'evaluate attaches the out-of-sample forward record to the candidate');
  ok(/hgOmniStampProb/.test(ROUTE), 'the scan stamps probability before it ranks');
}

console.log('== stand-aside still has no against-tape levels or fake % ==');
{
  const W = boot();
  const shortOnly = ticket({ dir: 'short', kind: 'VALUE', plan: { entry: 69000, stop: 71000, t1: 65000, t2: 63000, rr1: 2 } });
  const few = W.hgOmniPickFew([shortOnly], 'long', 3);
  ok(few.length === 0, 'long tape with only a SHORT is not the max');
  const html = W.hgOmniMostProbablePanelHtml(few, 'long');
  ok(/MOST PROBABLE/.test(html), 'panel still leads the tab when standing aside');
  ok(!/69000/.test(html), 'against-tape levels are not the setup');
  ok(!/data-omni-prob-max="\d+"/.test(html), 'stand-aside does not invent a max %');
}

console.log('== hard constraints stay closed ==');
{
  ok(/CG_SWING_RR_MIN\s*=\s*2/.test(GATES) || /CG_SWING_RR_MIN = 2/.test(GATES),
     'G6 R:R floor is untouched');
  ok(!/LIVE TRADING ENABLED|execute live crypto/i.test(EXEC.slice(0, 800)),
     'crypto live trading stays disabled');
  ok(/GOLD_STOP_MAX_PCT\s*=\s*0\.025/.test(GOLD), 'gold min-loss is untouched');
}

console.log('== version stamp ==');
{
  ok(HG_VER === 'hg-v470', 'build stamp is hg-v470 (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches the stamp');
  ok(new RegExp('omniroute\\.js\\?v=470').test(read('index.html')), 'index pins omniroute.js?v=470');
}

console.log('\n' + passed + ' passed');
