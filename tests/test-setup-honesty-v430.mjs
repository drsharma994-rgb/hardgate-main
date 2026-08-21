/* HARDGATE — v430 setup honesty pack.

   The next version of the desk is not new detectors. It is fewer fake
   tickets: MOST PROBABLE must be tape-aligned and post-gate-checked when
   those exist; NEAR is never a "ticket"; OMNIPRESENT does not PASS a
   thin positive measured-edge; heuristic vision cannot buy the star.

   Run: node tests/test-setup-honesty-v430.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootPlans(){
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

console.log('== ranking: tape + checked beat junk for MOST PROBABLE ==');
{
  const W = bootPlans();
  ok(typeof W.hgRankCryptoSetups === 'function', 'hgRankCryptoSetups exported');
  ok(typeof W.hgPostGateBannerHtml === 'function', 'hgPostGateBannerHtml exported');
  const against = { id: 'short', sym: 'BZ', dir: 'short', formationScore: 90, postGateChecked: true, rr: 3 };
  const unchecked = { id: 'long-u', sym: 'ETH', dir: 'long', formationScore: 80, postGateUnchecked: true, rr: 4 };
  const checked = { id: 'long-c', sym: 'BTC', dir: 'long', formationScore: 40, postGateChecked: true, rr: 2 };
  const ranked = W.hgRankCryptoSetups([against, unchecked, checked], 'long');
  ok(ranked.best && ranked.best.id === 'long-c', 'TAKE LONGS + checked beats a hotter UNCHECKED and an against-tape star');
  ok(ranked.cands[0].id === 'long-c', 'checked with-tape sorts first');
  const allUnchecked = W.hgRankCryptoSetups([unchecked], 'long');
  ok(allUnchecked.best && allUnchecked.best.id === 'long-u', 'if every row is UNCHECKED, one still leads (honesty banner, not empty)');
  const banner = W.hgPostGateBannerHtml(unchecked);
  ok(/POST-GATE UNCHECKED/.test(banner) && /never tested/.test(banner), 'unchecked banner names the incomplete ledger');
  ok(W.hgPostGateBannerHtml({ postGateChecked: true }) === '', 'checked rows carry no warn banner');
}

console.log('== scan wiring stamps UNCHECKED and ranks through the helper ==');
{
  const html = read('index.html');
  ok(/hgApplyCryptoPostGate\(hit, qv\)/.test(html), 'swing and scalp CLEAN stamp via hgApplyCryptoPostGate');
  ok(/hgMarkGateUnchecked\(hit, qv\.uncheckedReasons\)/.test(html), 'unchecked reasons reach hgMarkGateUnchecked');
  ok(/hgRankCryptoSetups\(cands, side\)/.test(html), 'SWING/SCALP MOST PROBABLE uses hgRankCryptoSetups');
  ok(/postGateUnchecked: (hit|c)\.postGateUnchecked/.test(html), 'card bookMeta carries the unchecked stamp');
}

console.log('== SUPER SETUP: NEAR is watch-only, never a ticket ==');
{
  const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, Promise,
                document: { head: { appendChild(){} }, createElement(){ return { id: '', textContent: '' }; } } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('supersetup.js'), ctx, { filename: 'supersetup.js' });
  const W = ctx.window;
  const nearNote = W.superSetupScannerNote({
    sym: 'B-XMR_USDT', dir: 'long', entry: 409, stop: 400, t1: 420,
    tier: 'near', nearClean: true, venueTag: 'CoinDCX'
  });
  ok(nearNote.watchOnly === true, 'NEAR evaluation is watch-only');
  ok(!/ticket/i.test(nearNote.note || ''), 'NEAR copy does not say ticket: ' + (nearNote.note || ''));
  ok(/watch only/i.test(nearNote.note || ''), 'NEAR copy says watch only');

  const holdNote = W.superSetupScannerNote({
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104,
    tier: 'clean', venueTag: 'Delta India',
    minLossAudit: { pass: false, reasons: ['STALE MOMENTUM: cascade 91 bars old'] }
  });
  ok(holdNote.watchOnly !== true, 'CLEAN audit-hold is not watch-only');
  ok(/audit hold/i.test(holdNote.note || ''), 'CLEAN without min-loss says audit hold');
  ok(!/ticket/i.test(holdNote.note || ''), 'no ticket wording on a hold: ' + (holdNote.note || ''));

  W.superSetupScan = function(){
    return { at: Date.now(), hydrated: true, cands: [{
      id: 'n1', sym: 'B-XMR_USDT', dir: 'long', entry: 409, stop: 400, t1: 420,
      tier: 'near', nearClean: true, venueTag: 'CoinDCX'
    }] };
  };
  const ev = W.superSetupEvaluate(W, {});
  ok(ev && ev.watchOnly === true && !/ticket/i.test(ev.note || ''),
     'evaluateSetup surfaces NEAR as watch-only, not a ticket');
}

console.log('== SUPER BEST lite enrich is SIZE OK, not MIN LOSS PASS ==');
{
  const src = read('super-best.js');
  ok(/SIZE OK \(BEST lite/.test(src), 'lite enrich names SIZE OK');
  ok(/runFullMinimalLossAudit/.test(src), 'full audit is the only path to MIN LOSS PASS');
}

console.log('== OMNIPRESENT measured-edge: thin positive is UNCHECKED ==');
{
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
                parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Error, TypeError,
                setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
    addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }), getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], head:{appendChild(){}}, body:{appendChild(){}},
    documentElement:{appendChild(){}}, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','plans.js','hg-mechanics.js',
                   'hg-forward.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js','omnipresent.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const W = ctx;
  const rows = [];
  let p = 100;
  for (let i = 0; i < 400; i++){
    p = p * 1.0004;
    rows.push({ t: 1700000000 + i * 3600, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 800 });
  }
  const cand = {
    dir: 'short', status: 'TRIGGERED',
    zone: { lo: 110, hi: 110.4, confluence: 3, distAtr: 1.1, srcs: ['a','b','c'] },
    entry: 109.2, stop: 110.7, t1: 107.2, t2: 101.7, risk: 1.5, rr1: 2, rr2: 5, atr: 1.0,
    evidence: ['bearish RSI divergence — higher high in price, lower high in RSI',
               'stretched +1.8xATR above EMA21 — rubber band']
  };
  W.hgFwdStats = () => ({ samples: 25, hit: 0.40, expR: 0.12, wins: 10, losses: 15 });
  const gates = W.opGates(rows, cand, 109.2, 'TESTUSD');
  const ed = (gates || []).filter(g => g && g.key === 'measured-edge')[0];
  ok(ed && ed.pass === null, '25 samples at a mild +z is UNCHECKED, not PASS');
  ok(/2-mechanic bar|too thin|UNCHECKED/i.test(ed.why || ''), 'why names the family bar: ' + (ed.why || '').slice(0, 120));

  W.hgFwdStats = () => ({ samples: 22, hit: 0.18, expR: -0.45, wins: 4, losses: 18 });
  const lose = (W.opGates(rows, cand, 109.2, 'TESTUSD') || []).filter(g => g && g.key === 'measured-edge')[0];
  ok(lose && lose.pass === false, 'a losing 20+ sample mechanic still VETOES');
}

console.log('== heuristic vision does not buy MOST PROBABLE ==');
{
  const src = read('chart-vision-desk.js');
  ok(/heuristic/.test(src) && /return 0/.test(src), 'heuristic aligned boost is capped at 0');
}

console.log('== cache stamp ==');
{
  ok(HG_VER === 'hg-v430', 'build stamp is hg-v430 (got ' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches');
}

console.log('\n' + passed + ' passed');
