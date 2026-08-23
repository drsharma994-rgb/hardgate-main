/* HARDGATE — live internet context for setup formation.
   Never invents ENTRY / STOP / T1. Silent feeds stay UNCHECKED.
   Run: node tests/test-formation-live.mjs */
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
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  vm.runInContext(read('formation-live.js'), ctx, { filename: 'formation-live.js' });
  return ctx;
}

function bootForm(extra){
  const ctx = boot(extra);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'scorecard.js', 'formation.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

console.log('== OI vs price ==');
{
  const W = boot();
  const c = W.hgLiveOiDivergence('long', 1.2, 4.0);
  ok(c.state === 'confirm' && c.regime === 'NEW LONGS', 'rising px + rising OI confirms a long');
  const w = W.hgLiveOiDivergence('long', -1.2, 4.0);
  ok(w.state === 'warning' && w.align === 'against', 'falling px + rising OI warns a long');
  const u = W.hgLiveOiDivergence('long', null, null);
  ok(u.state === 'unchecked' && u.score === 0, 'missing OI is UNCHECKED, not a fake confirm');
  const dead = W.hgLiveOiDivergence('long', 0.1, 0.4);
  ok(dead.state === 'unchecked', 'dead-zone OI/px does not vote');
}

console.log('== funding + predicted funding ==');
{
  const W = boot();
  const flip = W.hgLiveFundingPredict('long', 0.01, 0.08);
  ok(flip.refuseMarket === true, 'predicted funding flip against a long refuses MARKET');
  const clean = W.hgLiveFundingPredict('long', -0.01, -0.02);
  ok(clean.refuseMarket === false && clean.align === 'with', 'negative funding with a long stays clean');
  const miss = W.hgLiveFundingPredict('long', null, null);
  ok(miss.state === 'unchecked', 'silent funding is UNCHECKED');
}

console.log('== liquidation-aware stop (widen only) ==');
{
  const W = boot();
  const adj = W.hgLiveLiqStopAdjust('long', 100, 96, [{ price: 96.1, usd: 3e6 }], 2);
  ok(adj.moved === true && adj.stop < 96, 'stop widens beyond a cluster at the stop');
  ok(adj.stop < 100, 'widened long stop stays below entry');
  const same = W.hgLiveLiqStopAdjust('long', 100, 90, [{ price: 96.1, usd: 3e6 }], 2);
  ok(same.moved === false, 'a stop already beyond the cluster is left alone');
  const tight = W.hgLiveLiqStopAdjust('long', 100, 99, [{ price: 90, usd: 3e6 }], 0.2);
  ok(tight.moved === false || tight.stop <= 99, 'stop is never tightened');
  const huge = W.hgLiveLiqStopAdjust('long', 100, 99, [{ price: 99, usd: 3e6 }], 20);
  ok(huge.refuse === true, 'a cluster that would force >3× risk refuses rather than invent a huge stop');
  const none = W.hgLiveLiqStopAdjust('long', 100, 96, [], 2);
  ok(none.moved === false && none.stop === 96, 'no clusters → original stop');
}

console.log('== book / implied / CVD / basis / traps ==');
{
  const W = boot();
  const walk = W.hgLiveBookFillOk('long', 100, 90, { impactBuy: 103 });
  ok(walk.refuse === true, 'impact that walks >25% of risk refuses');
  const thin = W.hgLiveBookFillOk('long', 100, 90, { depthUsd: 1000, notionalUsd: 2000 });
  ok(thin.refuse === true, 'book thinner than 2× size refuses');
  const bookOk = W.hgLiveBookFillOk('long', 100, 90, { impactBuy: 100.2, depthUsd: 1e7, notionalUsd: 2000 });
  ok(bookOk.refuse === false && bookOk.state === 'confirm', 'a fillable book confirms');
  const bookMiss = W.hgLiveBookFillOk('long', 100, 90, {});
  ok(bookMiss.state === 'unchecked' && bookMiss.refuse === false, 'silent book is UNCHECKED');

  ok(W.hgLiveImpliedDailyPct(50) > 2 && W.hgLiveImpliedDailyPct(50) < 3, 'DVOL 50 → ~2.6% implied daily');
  const far = W.hgLiveImpliedMoveOk('long', 100, 110, 40);
  ok(far.refuse === true && far.dropT1 === true, 'T1 beyond implied daily range is marked refuse — no closer T1 is invented');
  const swingHold = W.hgLiveFormationApply(
    { dir: 'long', entry: 100, stop: 90, t1: 110 },
    { dvol: 40 },
    { a4: 2, style: 'swing' }
  );
  ok(swingHold.ok === true && swingHold.plan.t1 === 110,
    'swing keeps a multi-day T1 when DVOL is a 1-day number — score demotes, levels stay');
  const scalpFar = W.hgLiveFormationApply(
    { dir: 'long', entry: 100, stop: 90, t1: 110 },
    { dvol: 40 },
    { a4: 2, style: 'scalp' }
  );
  ok(scalpFar.ok === false && scalpFar.tag === 'implied',
    'scalp refuses a T1 the 1-day implied move cannot cover');
  const near = W.hgLiveImpliedMoveOk('long', 100, 101.5, 50);
  ok(near.refuse === false, 'T1 inside implied daily range is allowed');
  const dvolMiss = W.hgLiveImpliedMoveOk('long', 100, 110, null);
  ok(dvolMiss.state === 'unchecked', 'silent DVOL is UNCHECKED');

  const cvd = W.hgLiveCvdConfirms('long', 1, 0.4);
  ok(cvd.flowOk === true && cvd.align === 'with', 'CVD+OBI with the long sets flowOk');
  const cvdAgainst = W.hgLiveCvdConfirms('long', -1, null);
  ok(cvdAgainst.align === 'against' && cvdAgainst.flowOk === false, 'CVD against does not fake flowOk');
  ok(W.hgLiveCvdConfirms('long', null, null).state === 'unchecked', 'silent CVD is UNCHECKED');

  ok(W.hgLiveBasisCaution('long', 1.2).align === 'caution', 'extreme basis is caution, not a new ticket');
  ok(W.hgLiveBasisCaution('long', 0.05).state === 'confirm', 'quiet basis is fine');

  ok(W.hgLiveSpotPerpVeto('long', { veto: true, reason: 'trap' }).refuse === true, 'spot-perp trap refuses');
  ok(W.hgLiveStablesVeto({ depeg: true }).refuse === true, 'stables depeg refuses');
  ok(W.hgLiveEventRisk({ block: true, title: 'FOMC' }).refuse === true, 'news block refuses');
  ok(W.hgLiveEventRisk(null).refuse === false, 'silent calendar does not refuse');
}

console.log('== apply never invents levels ==');
{
  const W = boot();
  const plan = { dir: 'long', entry: 100, stop: 90, t1: 120, entryType: 'MARKET @ sweep' };
  const empty = W.hgLiveFormationApply(plan, {}, { a4: 2 });
  ok(empty.ok === true, 'empty live is a no-op');
  ok(empty.plan.entry === 100 && empty.plan.stop === 90 && empty.plan.t1 === 120, 'empty live leaves levels alone');

  const lim = W.hgLiveFormationApply(
    { dir: 'long', entry: 100, stop: 90, t1: 120, entryType: 'MARKET @ sweep' },
    { predictedFundingPct: 0.08, fundingPct: 0.01 },
    { a4: 2 }
  );
  ok(/LIMIT/.test(lim.plan.entryType), 'funding flip converts MARKET → LIMIT');
  ok(lim.plan.entry === 100 && lim.plan.t1 === 120, 'funding flip does not invent a new entry or T1');

  const gold = W.hgLiveFormationApply(
    { dir: 'long', entry: 3300, stop: 3280, t1: 3360 },
    { clusters: [{ price: 3280, usd: 5e6 }] },
    { a4: 8, preserveLevels: true, gold: true }
  );
  ok(gold.plan.stop === 3280, 'gold preserveLevels does not move the stop');

  const blocked = W.hgLiveFormationApply(
    { dir: 'long', entry: 100, stop: 90, t1: 120 },
    { news: { block: true, title: 'CPI' } },
    { a4: 2 }
  );
  ok(blocked.ok === false && blocked.tag === 'event', 'event block refuses the ticket');

  const scored = W.hgLiveFormationScoreDelta(
    { dir: 'long', entry: 100, stop: 90, t1: 102 },
    { pxChg: 1.2, oiChg: 4, fundingPct: -0.01, cvdSign: 1, dvol: 60 }
  );
  ok(scored.delta > 0 && scored.delta <= 18, 'confirming live data adds a bounded score');
  const against = W.hgLiveFormationScoreDelta(
    { dir: 'long', entry: 100, stop: 90, t1: 102 },
    { pxChg: -1.2, oiChg: 4, fundingPct: 0.12 }
  );
  ok(against.delta < 0 && against.delta >= -18, 'opposing live data subtracts a bounded score');
}

console.log('== liqFlushSetup recovery ==');
{
  const W = boot();
  const snap = {
    imbalance: { cls: 'long-flush', ratio: 8, text: 'LONG FLUSH' },
    window: { ms: 3600000 },
    top: [{ sym: 'BTCUSDT', side: 'long', usd: 3e6, t: Date.now() - 1000 }],
    spikeUsd: 2e6
  };
  let seen = null;
  W.liqFlushSetup = function(s, rows){ seen = { snap: s, rows: rows }; return { dir: 'short', entry: 100, stop: 110, t1: 80 }; };
  ok(W.hgLiveLiqFlushSetup(snap, [{ c: 100 }]).dir === 'short', 'a real snap still goes through');
  const bars = [{ t: 1, o: 1, h: 1, l: 1, c: 100 }];
  seen = null;
  const miss = W.hgLiveLiqFlushSetup(bars, { symbol: 'BTCUSD' });
  ok(miss === null, 'candles-as-snap with no recovered tape returns null — nothing invented');
  W.__hgLiqRecoverSnap = snap;
  const recovered = W.hgLiveLiqFlushSetup(bars, { symbol: 'BTCUSD' });
  ok(recovered && recovered.dir === 'short', 'candles-as-snap recovers the real tape and mints from it');
  ok(seen && seen.snap === snap && seen.rows === bars, 'recovered call is (snap, rows), not (rows, ticker)');
}

console.log('== hgFormTicket reads live context ==');
{
  const W = bootForm();
  const rows = [];
  let c = 100;
  for (let i = 0; i < 120; i++){
    c += 0.15;
    rows.push({ t: i * 14400, o: c, h: c + 0.4, l: c - 0.4, c: c, v: 1000 });
  }
  const mark = rows[rows.length - 1].c;
  const hit = { dir: 'long', entry: mark, stop: mark - 4, t1: mark + 8, rr: 2, mark: mark,
    planSrc: 'swingTryClean', entryType: 'LIMIT @ EMA21' };
  const okForm = W.hgFormTicket(hit, { rows, style: 'swing', a4: 1.2, skipPoi: true, live: {} });
  ok(okForm.ok === true, 'empty live does not break formation (' + (okForm.reason || 'ok') + ')');
  ok(okForm.hit.entry === hit.entry || isFinite(okForm.hit.entry), 'formed ticket still has an engine entry');

  const blocked = W.hgFormTicket(hit, {
    rows, style: 'swing', a4: 1.2, skipPoi: true,
    live: { news: { block: true, title: 'FOMC' } }
  });
  ok(blocked.ok === false && /FOMC|event/i.test(blocked.reason + blocked.tag),
    'hgFormTicket refuses on a live event block');
}

console.log('== wiring ==');
{
  const html = read('index.html');
  const sw = read('sw.js');
  const form = read('formation.js');
  const stack = read('setup-stack.js');
  const obtc = read('omnibtc.js');
  const cr = read('contract-report.js');
  const liq = read('liqs.js');
  ok(/formation-live\.js/.test(html), 'index.html loads formation-live.js');
  ok(/\.\/formation-live\.js/.test(sw), 'sw.js HG_SHELL precaches formation-live.js');
  ok(/hgLiveFormationApply/.test(form), 'hgFormTicket calls hgLiveFormationApply');
  ok(/hgLiveFormationFts/.test(stack), 'FTS stack reads live formation items');
  ok(/hgLiveLiqFlushSetup|liqRecoverSnap/.test(obtc) || /hgLiveLiqFlushSetup/.test(liq),
    'OMNIBTC / liqs recover a real flush snap');
  ok(/hgLiveLiqFlushSetup/.test(cr) || /liqRecoverSnap/.test(liq),
    'contract-report flush path is recovered at the boundary');
  ok(/Array\.isArray\(snap\)/.test(liq), 'liqFlushSetup itself recovers when candles are passed as the snap');
}

console.log('\n' + passed + ' passed');
