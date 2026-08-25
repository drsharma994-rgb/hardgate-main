/* HARDGATE — OMNIGOLD most-probable setups are a *balanced* read.

   Field request: "find a balance among all the indicator and strategy used
   in omnigold tab and show me a most probable setups on the top".

   Before this pack the gold desk:
     - sorted tickets by hgOmniRank (nAgree, then evaluated, then R:R)
     - picked STRONGEST as the nearest tape-aligned ticket
     - pinned house MOST PROBABLE only when a tape-aligned row survived,
       so a falling tape with only LONG tickets left the top of the tab empty
       while against-tape LONGs still led the card list

   After:
     - a composite score balances strategy-family consensus against
       indicator info-reads (ema-stack, rsi-zone, session-vwap, adx, hurst…)
       plus coverage, extra mechanics on the same trade, horizon agree,
       and proximity. It is NOT a win probability.
     - among tape-aligned tickets, that score picks STRONGEST (near still
       beats far; distance is the tie-break when evidence is equal)
     - MOST PROBABLE SETUPS (SCALP + SWING) lead the tab with ENTRY / STOP
       / T1 / T2 when a tape-aligned ticket exists
     - a LONG is never the most probable setup while gold tape is short
     - against-tape cards still render, stamped, and sink below with-tape
     - G1–G7 and GOLD_STOP_MAX_PCT = 0.025 stay as they are
     - extra engines never claim 7/7 CLEAN

   Run: node tests/test-omnigold-most-probable.mjs */
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

function ticket(over){
  return Object.assign({
    horizon: 'SCALP',
    kind: 'ORB',
    dir: 'short',
    grade: { ticket: true, vetoes: [], evaluated: 40, total: 47 },
    plan: { entry: 3390, stop: 3410, t1: 3350, t2: 3320, rr1: 2.0 },
    distAtr: 0.5,
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['TREND'], against: [], split: [] },
    gates: [
      { key: 'ema-stack', info: true, pass: true },
      { key: 'rsi-zone', info: true, pass: true },
      { key: 'session-vwap', info: true, pass: true }
    ],
    horizonAgree: true,
    alsoKinds: []
  }, over || {});
}

console.log('== exports ==');
{
  const W = boot();
  ok(typeof W.hgOgInfoNet === 'function', 'hgOgInfoNet exported');
  ok(typeof W.hgOgBalanceScore === 'function', 'hgOgBalanceScore exported');
  ok(typeof W.hgOgMostProbablePanelHtml === 'function', 'hgOgMostProbablePanelHtml exported');
  ok(typeof W.hgOgDeskOrder === 'function', 'hgOgDeskOrder exported');
  ok(typeof W.hgOgPickFor === 'function', 'hgOgPickFor still exported');
}

console.log('== indicator net ignores hard gates and unread info ==');
{
  const W = boot();
  const n = W.hgOgInfoNet([
    { key: 'trend', hard: true, pass: true },
    { key: 'ema-stack', info: true, pass: true },
    { key: 'rsi-zone', info: true, pass: false },
    { key: 'adx-trend', info: true, pass: null },
    { key: 'session-vwap', info: true, pass: true }
  ]);
  ok(n.n === 4, 'four info reads counted (got ' + n.n + ')');
  ok(n.pass === 2 && n.fail === 1, 'pass/fail skip null (pass=' + n.pass + ' fail=' + n.fail + ')');
  ok(n.net === 1, 'net is pass minus fail (got ' + n.net + ')');
  ok(W.hgOgInfoNet([]).net === 0 && W.hgOgInfoNet(null).n === 0, 'empty ledger is a zero, not a throw');
}

console.log('== balanced score: strategies and indicators share the rank, tape is a hard lean ==');
{
  const W = boot();
  const lonelyNear = ticket({
    kind: 'ROUND-MAGNET', distAtr: 0.15,
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] },
    gates: [{ key: 'ema-stack', info: true, pass: false }, { key: 'rsi-zone', info: true, pass: false }]
  });
  const chorus = ticket({
    kind: 'ORB', distAtr: 1.5,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['TREND','SWEEP','IMBALANCE','INTERMARKET'], against: [], split: [] },
    gates: [
      { key: 'ema-stack', info: true, pass: true },
      { key: 'rsi-zone', info: true, pass: true },
      { key: 'session-vwap', info: true, pass: true },
      { key: 'adx-trend', info: true, pass: true }
    ]
  });
  ok(W.hgOgBalanceScore(chorus, 'short') > W.hgOgBalanceScore(lonelyNear, 'short'),
     'a chorus of families + indicators outranks a nearer lonely magnet');
  const against = ticket({ dir: 'long', kind: 'WEEKLY-OPEN', distAtr: 0.05,
    consensus: { nAgree: 5, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] } });
  ok(W.hgOgBalanceScore(lonelyNear, 'short') > W.hgOgBalanceScore(against, 'short'),
     'against-tape scores below with-tape even when the against card is nearer and louder');
}

console.log('== STRONGEST pick uses the balance, after tape and near filters ==');
{
  const W = boot();
  const lonelyNear = ticket({
    kind: 'ROUND-MAGNET', distAtr: 0.15,
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] },
    gates: [{ key: 'ema-stack', info: true, pass: false }]
  });
  const chorus = ticket({
    kind: 'ORB', distAtr: 1.5,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['TREND','SWEEP','IMBALANCE','INTERMARKET'], against: [], split: [] },
    gates: [
      { key: 'ema-stack', info: true, pass: true },
      { key: 'rsi-zone', info: true, pass: true },
      { key: 'session-vwap', info: true, pass: true }
    ]
  });
  const pick = W.hgOgPickFor([lonelyNear, chorus], 'SCALP', 'short');
  ok(pick === chorus, 'STRONGEST among near tickets is the balanced chorus, not the nearest lonely magnet (got ' + (pick && pick.kind) + ')');

  const farChorus = ticket({
    kind: 'FVG-FILL', distAtr: 6.2, horizon: 'SWING',
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['IMBALANCE'], against: [], split: [] },
    gates: [{ key: 'ema-stack', info: true, pass: true }]
  });
  const nearQuiet = ticket({
    kind: 'THREE-BAR', distAtr: 1.67, horizon: 'SWING',
    consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] },
    gates: []
  });
  const nearWins = W.hgOgPickFor([farChorus, nearQuiet], 'SWING', 'short');
  ok(nearWins === nearQuiet, 'a 6×ATR chorus still loses to a near ticket (got ' + (nearWins && nearWins.kind) + ')');

  const a = ticket({ kind: 'KZ-JUDAS', distAtr: 0.12, consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] }, gates: [] });
  const b = ticket({ kind: 'THREE-BAR', distAtr: 1.67, consensus: { nAgree: 1, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] }, gates: [] });
  const closest = W.hgOgPickFor([b, a], 'SCALP', 'short');
  ok(closest === a, 'equal evidence → closer print is STRONGEST (got ' + (closest && closest.kind) + ')');

  const longFade = ticket({ dir: 'long', kind: 'ADR-FADE', distAtr: 0.2 });
  ok(W.hgOgPickFor([longFade, chorus], 'SCALP', 'short') === chorus, 'down tape keeps the short');
  ok(W.hgOgPickFor([longFade], 'SCALP', 'short') === null, 'down tape with only a LONG is not a substitute pick');
}

console.log('== card list: with-tape above against-tape ==');
{
  const W = boot();
  const withTape = ticket({ dir: 'short', kind: 'ORB', distAtr: 1.8 });
  const against = ticket({ dir: 'long', kind: 'WEEKLY-OPEN', distAtr: 0.05,
    consensus: { nAgree: 4, nAgainst: 0, nSplit: 0, agree: ['SWEEP'], against: [], split: [] } });
  const watch = Object.assign(ticket({ dir: 'short', kind: 'PIN-REJECT', distAtr: 0.4 }), {
    grade: { ticket: false, vetoes: ['trend'], evaluated: 30, total: 47 }
  });
  const ordered = W.hgOgDeskOrder([against, watch, withTape], 'short');
  ok(ordered[0] === withTape || ordered[0].dir === 'short', 'first card is with-tape (got ' + ordered[0].kind + ' ' + ordered[0].dir + ')');
  ok(ordered[ordered.length - 1] === against, 'against-tape sinks to the bottom even when it is the nearest ticket');
  ok(ordered.filter(c => c.dir === 'short').length === 2, 'with-tape cards stay in the list');
}

console.log('== MOST PROBABLE SETUPS panel: two horizons, real levels, no invented ticket ==');
{
  const W = boot();
  const scalp = ticket({ horizon: 'SCALP', dir: 'short', kind: 'ORB' });
  const swing = ticket({
    horizon: 'SWING', dir: 'short', kind: 'MMOVE',
    plan: { entry: 3380, stop: 3420, t1: 3300, t2: 3260, rr1: 2.0 }
  });
  const html = W.hgOgMostProbablePanelHtml(scalp, swing, 'short');
  ok(/MOST PROBABLE/.test(html), 'panel uses house MOST PROBABLE language');
  ok(/SCALP/.test(html) && /SWING/.test(html), 'both horizons appear');
  ok(/ENTRY/.test(html) && /STOP/.test(html) && /T1/.test(html), 'levels are printed');
  ok(/3390/.test(html) && /3380/.test(html), 'each horizon keeps its own entry');
  ok(/XAUUSD/.test(html), 'instrument is gold, not a crypto pair');
  ok(!/7\/7 CLEAN/.test(html), 'gold panel never claims crypto 7/7 CLEAN');
  ok(!/% chance|most likely to win|win rate of|probability to win/i.test(html),
     'no win-probability language on the panel');
  ok(/not a win probability/i.test(html), 'the panel says the score is not a probability');
  ok(/data-hg-mp="omnigold"/.test(html) || /data-og-mp/.test(html),
     'panel is tagged so house pin can find it');
}

console.log('== LONG against short tape is not MOST PROBABLE ==');
{
  const W = boot();
  const longOnly = ticket({ dir: 'long', kind: 'WEEKLY-OPEN', plan: { entry: 3511, stop: 3480, t1: 3560, t2: 3590, rr1: 2 } });
  const pick = W.hgOgPickFor([longOnly], 'SCALP', 'short');
  ok(pick === null, 'no STRONGEST long on a short tape');
  const html = W.hgOgMostProbablePanelHtml(pick, null, 'short');
  ok(/MOST PROBABLE/.test(html), 'the tab still leads with MOST PROBABLE when standing aside');
  ok(/going down/.test(html), 'stand-aside copy names the down tape');
  ok(!/3511/.test(html), 'against-tape long levels are not printed as the setup');
  ok(!/WEEKLY-OPEN/.test(html), 'against-tape mechanic is not sold as most probable');
}

console.log('== scan wires the panel to the top of the tab ==');
{
  ok(/id="ogMp"/.test(GOLD) && GOLD.indexOf('id="ogMp"') < GOLD.indexOf('id="ogXmBot"'),
     'MOST PROBABLE host sits above the XM bot so it leads the tab');
  ok(/hgOgPaintMostProbable\(/.test(GOLD), 'scan paints the dual panel onto that host');
  ok(/hgOgDeskOrder\(/.test(GOLD) || /hgOgBalanceScore\(/.test(GOLD),
     'scan uses the gold-specific balance, not a crypto-wide ranker rewrite');
  ok(/hgMpPin\(\s*'omnigold'/.test(GOLD), 'house MOST PROBABLE pin remains');
  ok(/STRONGEST ' \+ c\.horizon/.test(GOLD), 'cards still badge STRONGEST, not "most likely to win"');
  ok(/NOT a win probability/.test(GOLD), 'pick card still refuses a fake probability');
  const code = GOLD.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/probability to win|win rate of|% chance|most likely to win/i.test(code),
     'no win-probability language can reach the card');
}

console.log('== G1–G7, gold min-loss, version ==');
{
  ok(/CG_SWING_SPREAD_ATR\s*=\s*0\.25/.test(GATES) || /0\.25/.test(GATES), 'G1 spread unchanged');
  ok(/CG_SWING_RR_MIN\s*=\s*2(?:\.0)?/.test(GATES), 'G6 R:R still 2.0');
  ok(/GOLD_STOP_MAX_PCT\s*=\s*0\.025/.test(GOLD), 'gold min-loss stop cap unchanged');
  ok(/LIVE_TRADING_DISABLED|live trading/i.test(EXEC) || /hgLiveTradingEnabled/.test(EXEC),
     'crypto execute module still present');
  ok(HG_VER === 'hg-v468', 'build stamp is hg-v468 (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp ' + HG_VER);
}

console.log('\npassed: ' + passed);
