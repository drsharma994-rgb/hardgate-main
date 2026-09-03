/* HARDGATE — OMNIGOLD tape is gold's own bars, honest about direction.

   Field report (hg-v582): the tab printed "gold tape SHORT / gold is going
   down" and featured a SHORT ADR-FADE VETO while gold had rallied +2.7%
   in 24 bars (live spot above the short entry). A 5-bar dip below EMA21
   in an UP stack was treated as "going down"; desk tape then let SHORT
   win whenever either horizon dipped, which hid every LONG GOLD SCALP /
   GOLD SWING catalog setup from MOST PROBABLE.

   Contract:
     - gold tape is read from gold bars (last vs EMA21 AND EMA21 vs EMA50)
     - a 5-bar dip in an up stack is unread, not SHORT
     - when a horizon's tape is short, that horizon's STRONGEST is a short
       or nothing — a long is not substituted; a short is not invented
     - mixed horizons (scalp DOWN + swing UP) are MIXED, not "going down"
     - each horizon's pick follows THAT horizon's tape so a LONG swing
       engine/catalog setup can lead when 4h gold is up
     - unknown / mixed tape does not empty the desk and does not claim
       gold is going down
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

console.log('== a pullback in an UP stack is not "gold is going down" ==');
{
  const W = boot();
  /* Rise for 190 bars, then a late dip under EMA21 — the live +2.7% shape.
     EMA21 stays above EMA50. Calling that SHORT hid every LONG catalog setup. */
  const rows = [];
  let p = 2000;
  for (let i = 0; i < 200; i++){
    p += (i < 190) ? 1.2 : -6;
    rows.push({ t: 1700000000 + i * 3600, o: p, h: p + 2, l: p - 2, c: p, v: 1000 });
  }
  const dipTape = W.hgOgTapeDir(rows);
  ok(dipTape !== 'short',
     'late dip in an up stack is not SHORT tape (got ' + JSON.stringify(dipTape) + ')');
  ok(W.hgOgTapeDir(risingGold(80)) === 'long', 'a clean rising series is still LONG');
  ok(W.hgOgTapeDir(fallingGold(80)) === 'short', 'a clean falling series is still SHORT');
}

console.log('== desk tape: mixed horizons are mixed, not "going down" ==');
{
  const W = boot();
  ok(typeof W.hgOgDeskTape === 'function', 'hgOgDeskTape exported');
  ok(W.hgOgDeskTape('short', 'long') === '',
     'scalp DOWN + swing UP → MIXED, not desk SHORT');
  ok(W.hgOgDeskTape('long', 'short') === '',
     'swing DOWN + scalp UP → MIXED, not desk SHORT');
  ok(W.hgOgDeskTape('short', 'short') === 'short', 'both down → short');
  ok(W.hgOgDeskTape('long', 'long') === 'long', 'both up → long');
  ok(W.hgOgDeskTape('', '') === '', 'both unread → empty, not a guessed side');
  ok(W.hgOgDeskTape('', 'long') === 'long', 'one unread, one up → long');
  ok(W.hgOgDeskTape('short', '') === 'short', 'one down, one unread → short');
  ok(W.hgOgPickFor([swingLong], 'SWING', 'long') === swingLong,
     'swing LONG ticket stays STRONGEST on the swing\'s own UP tape');
  ok(W.hgOgPickFor([longTix], 'SCALP', 'short') === null,
     'scalp LONG is still refused when the scalp tape itself is down');
  ok(W.hgOgPickFor([shortTix], 'SCALP', 'short') === shortTix,
     'scalp SHORT ticket is kept when scalp tape is down — not invented the other way');
  const banner = W.hgOgTapeBannerHtml('short', 'long');
  ok(!/going down/.test(banner),
     'the banner does not say gold is going down when swing is UP');
  ok(/[Mm]ixed/.test(banner) || /own bars/.test(banner) || /UNREAD/.test(banner),
     'the banner names the disagreement instead of picking a side');
  ok(!/going down/.test(W.hgOgMpNoneWhy('', null)),
     'mixed/unread stand-aside copy does not claim gold is going down');
}

console.log('== scan wires per-horizon tape into picks ==');
{
  ok(/hgOgTapeDir\(/.test(GOLD) && /hgOgDeskTape\(scalpTape, swingTape\)/.test(GOLD),
     'the scan computes per-horizon tape then a desk tape');
  ok(/hgOgPickFor\((ranked|ogCollapsed), HORIZONS\.scalp\.label, scalpTape\)/.test(GOLD)
      && /hgOgPickFor\((ranked|ogCollapsed), HORIZONS\.swing\.label, swingTape\)/.test(GOLD),
     'each STRONGEST pick follows that horizon\'s tape, not a SHORT-wins merge');
  ok(/hgOgPickWatchFor\([^,]+, HORIZONS\.scalp\.label, scalpTape\)/.test(GOLD)
      && /hgOgPickWatchFor\([^,]+, HORIZONS\.swing\.label, swingTape\)/.test(GOLD),
     'WATCH picks are also per-horizon');
  ok(/hgOgPickGoldEngineForMp\(bridge, HORIZONS\.scalp\.label, scalpTape\)/.test(GOLD)
      && /hgOgPickGoldEngineForMp\(bridge, HORIZONS\.swing\.label, swingTape\)/.test(GOLD),
     'GOLD SCALP/SWING engine fallback follows that horizon\'s tape');
  ok(/hgOgZonesPanel\(res\.scalp\.rows, res\.scalp\.livePx, (deskTape|scalpTape)\)/.test(GOLD),
     'NEXT GOLD LEVELS still filters against a one-sided desk tape');
  ok(/__og\.tape && __og\.tape\.desk/.test(GOLD),
     'XM strongest and card stamps still read the desk tape when it is one-sided');
  ok(/AGAINST GOLD TAPE/.test(GOLD), 'against-tape cards are stamped, not sold as STRONGEST');
  ok(/hgMpPin\(\s*'omnigold'/.test(GOLD), 'MOST PROBABLE pin is still on the gold desk');
}

console.log('== MOST PROBABLE uses the swing catalog engine when swing tape is UP ==');
{
  const W = boot();
  ok(typeof W.hgOgBridgeSetupToPick === 'function', 'engine bridge is exported');
  const eng = W.hgOgBridgeSetupToPick({
    dir: 'long', strategy: 'LIQUIDITY SWEEP', entry: 4410, stop: 4388, t1: 4454,
    grade: 'A', tally: 8
  }, 'SWING');
  ok(eng && eng.plan && eng.dir === 'long', 'LONG swing catalog setup converts to an MP pick');
  const html = W.hgOgMostProbablePanelHtml(
    null, null, '', null, null, null, null, eng,
    { scalp: 'short', swing: 'long' }
  );
  ok(/LIQUIDITY SWEEP/.test(html) && /4410/.test(html),
     'LONG GOLD SWING engine levels lead MOST PROBABLE when swing tape is UP');
  ok(/ACTIONABLE/.test(html), 'tape-aligned engine is ACTIONABLE, not against-tape');
  ok(!/gold tape SHORT/.test(html) && !/XAUUSD SHORT OMNIGOLD/.test(html),
     'mixed desk tape does not headline gold tape SHORT');
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
