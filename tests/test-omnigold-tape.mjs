/* HARDGATE — OMNIGOLD must not pick LONG when gold is going down.

   Field report: the tab printed a LONG STRONGEST / MOST PROBABLE while
   gold was falling. Reversion/sweep longs are allowed through the trend
   gate (counter-trend is what a fade IS). The pick then promoted that
   long because it was the nearest TICKET. Crypto MARKET PICTURE is the
   wrong tape — gold can drop while BTC/ETH/SOL cascade is long-leaning.

   Contract:
     - gold tape is read from gold bars (EMA21 / EMA50 / recent closes)
     - when that tape is short, STRONGEST is a short or nothing
     - a long ticket is not substituted; a short is not invented
     - unknown tape does not empty the desk
     - mixed horizons: scalp DOWN + swing UP → desk SHORT. A 4H lean
       does not sell a LONG while 1h gold is falling
     - gold min-loss and crypto G1–G7 stay as they are

   Run: node tests/test-omnigold-tape.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk, HG_VER } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const GOLD = read('omnigold.js');
const HTML = read('index.html');
const GATES = read('cryptogates.js');
const EXEC = read('execute.js');

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
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

function fallingGold(n){
  const out = [];
  let px = 3600;
  for (let i = 0; i < n; i++){
    const o = px, c = px - 2.4;
    out.push({ t: 1700000000 + i * 14400, o, h: o + 0.8, l: c - 0.8, c, v: 800 });
    px = c;
  }
  return out;
}
function risingGold(n){
  const out = [];
  let px = 2400;
  for (let i = 0; i < n; i++){
    const o = px, c = px + 2.4;
    out.push({ t: 1700000000 + i * 14400, o, h: c + 0.8, l: o - 0.8, c, v: 800 });
    px = c;
  }
  return out;
}

const longTix = {
  horizon: 'SCALP', kind: 'ADR-FADE', dir: 'long',
  grade: { ticket: true, vetoes: [] },
  plan: { entry: 3400, stop: 3380, t1: 3440 },
  distAtr: 0.4
};
const shortTix = {
  horizon: 'SCALP', kind: 'MMOVE', dir: 'short',
  grade: { ticket: true, vetoes: [] },
  plan: { entry: 3390, stop: 3410, t1: 3350 },
  distAtr: 0.6
};
const swingLong = {
  horizon: 'SWING', kind: 'VWAP-REVERT', dir: 'long',
  grade: { ticket: true, vetoes: [] },
  plan: { entry: 3400, stop: 3360, t1: 3480 },
  distAtr: 0.3
};

console.log('== gold tape is gold bars, not crypto MARKET PICTURE ==');
{
  const W = boot();
  ok(typeof W.hgOgTapeDir === 'function', 'hgOgTapeDir exported');
  ok(W.hgOgTapeDir(fallingGold(80)) === 'short',
     'a falling gold series (last < EMA21, stack down) is SHORT tape');
  ok(W.hgOgTapeDir(risingGold(80)) === 'long',
     'a rising gold series is LONG tape');
  ok(W.hgOgTapeDir(null) === '' && W.hgOgTapeDir([]) === '',
     'unread gold bars are empty tape, not a guessed side');
  ok(W.hgOgTapeDir(fallingGold(10)) === '',
     'too few bars stay unread rather than a fake lean');
  ok(!/__hgMarketPicture/.test(GOLD) && !/hgOmniMarketSide/.test(GOLD),
     'OMNIGOLD does not borrow the BTC/ETH/SOL cascade as gold direction');
}

console.log('== STRONGEST does not pick LONG when gold is going down ==');
{
  const W = boot();
  ok(W.hgOgPickFor([longTix, shortTix], 'SCALP', 'short') === shortTix,
     'down tape keeps the short ticket, not the nearer long fade');
  ok(W.hgOgPickFor([longTix], 'SCALP', 'short') === null,
     'down tape with only a LONG ticket → no pick, not a long substitute');
  ok(W.hgOgPickFor([longTix, shortTix], 'SCALP', 'short')
      && W.hgOgPickFor([longTix, shortTix], 'SCALP', 'short').dir === 'short',
     'the surviving pick is short');
  const invented = W.hgOgPickFor([longTix], 'SCALP', 'short');
  ok(invented === null, 'a missing short is not invented from the long levels');
  ok(W.hgOgPickFor([longTix], 'SCALP') === longTix,
     'unknown tape does not empty a long that already cleared the ledger');
  ok(W.hgOgPickFor([swingLong], 'SWING', 'short') === null,
     'swing STRONGEST also refuses a long fade when 4H gold is going down');
  ok(W.hgOgPickFor([shortTix], 'SCALP', 'long') === null,
     'symmetric: up tape does not promote a short as STRONGEST');
}

console.log('== desk tape: either horizon down means no LONG pick ==');
{
  const W = boot();
  ok(typeof W.hgOgDeskTape === 'function', 'hgOgDeskTape exported');
  ok(W.hgOgDeskTape('short', 'long') === 'short',
     'scalp DOWN + swing UP → desk SHORT (do not sell the swing long)');
  ok(W.hgOgDeskTape('long', 'short') === 'short',
     'swing DOWN + scalp UP → desk SHORT');
  ok(W.hgOgDeskTape('short', 'short') === 'short', 'both down → short');
  ok(W.hgOgDeskTape('long', 'long') === 'long', 'both up → long');
  ok(W.hgOgDeskTape('', '') === '', 'both unread → empty, not a guessed side');
  ok(W.hgOgDeskTape('', 'long') === 'long', 'one unread, one up → long');
  ok(W.hgOgDeskTape('short', '') === 'short', 'one down, one unread → short');
  ok(W.hgOgPickFor([swingLong], 'SWING', W.hgOgDeskTape('short', 'long')) === null,
     'swing LONG ticket is not STRONGEST when scalp gold is going down');
  ok(W.hgOgPickFor([longTix], 'SCALP', W.hgOgDeskTape('short', 'long')) === null,
     'scalp LONG is also refused on mixed down tape');
  const banner = W.hgOgTapeBannerHtml('short', 'long');
  ok(/will not pick a LONG/.test(banner),
     'the banner says this tab will not pick a LONG when either horizon is down');
}

console.log('== scan wires gold tape into the pick and the banner ==');
{
  ok(/hgOgTapeDir\(/.test(GOLD) && /hgOgDeskTape\(scalpTape, swingTape\)/.test(GOLD),
     'the scan computes per-horizon tape then a desk tape');
  ok(/hgOgPickFor\(ranked, HORIZONS\.scalp\.label, deskTape\)/.test(GOLD)
      && /hgOgPickFor\(ranked, HORIZONS\.swing\.label, deskTape\)/.test(GOLD),
     'both STRONGEST picks follow the desk tape, not the other horizon\'s lean');
  ok(/hgOgZonesPanel\(res\.scalp\.rows, res\.scalp\.livePx, deskTape\)/.test(GOLD),
     'NEXT GOLD LEVELS hides the against-tape zone');
  ok(/__og\.tape && __og\.tape\.desk/.test(GOLD),
     'XM strongest and card stamps read the desk tape');
  ok(/AGAINST GOLD TAPE/.test(GOLD), 'against-tape cards are stamped, not sold as STRONGEST');
  ok(/going down/.test(GOLD) || /GOLD TAPE/.test(GOLD),
     'the desk names gold tape so a long-on-a-drop is explained');
  ok(/hgMpPin\(\s*'omnigold'/.test(GOLD), 'MOST PROBABLE pin is still on the gold desk');
}

console.log('== G1–G7 and gold min-loss unchanged ==');
{
  ok(/CG_SWING_SPREAD_ATR\s*=\s*0\.25/.test(GATES) || /0\.25/.test(GATES),
     'G1 spread still in cryptogates');
  ok(/CG_SWING_RR_MIN\s*=\s*2(?:\.0)?/.test(GATES), 'G6 R:R still 2.0');
  ok(/GOLD_STOP_MAX_PCT/.test(GOLD), 'gold min-loss stop cap still in omnigold.js');
  ok(/LIVE_TRADING_DISABLED|live trading/i.test(EXEC) || /hgLiveTradingEnabled/.test(EXEC),
     'crypto execute module still present');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\npassed: ' + passed);
