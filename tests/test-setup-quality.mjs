/* HARDGATE — setup quality pack: post-gate vetoes mirror BEST policy on SWING/SCALP
   without loosening G1–G7. Binance twin funding fills thin CoinDCX G4; gold GS4
   reads XAUUSDT perp crowd. Gates unchanged — quality filters sit AFTER clean.
   Run: node tests/test-setup-quality.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, Promise };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const W = ctx;

function synthRows(n, start, step){
  step = step || 0.15;
  const out = [];
  for (let i = 0; i < n; i++){
    const c = start + i * step + Math.sin(i / 12) * 0.05;
    out.push({ t: i * 14400, o: c, h: c + 0.4, l: c - 0.4, c: c, v: 1000 + i * 5 });
  }
  return out;
}

console.log('== exports on plans.js ==');
{
  ok(typeof W.hgEnrichTickerFundingTwin === 'function', 'hgEnrichTickerFundingTwin exported');
  ok(typeof W.hgPostGateSetupVeto === 'function', 'hgPostGateSetupVeto exported');
  ok(typeof W.hgStaleMomentumVeto === 'function', 'hgStaleMomentumVeto exported');
  ok(typeof W.hgPostGateGoldVeto === 'function', 'hgPostGateGoldVeto exported');
  ok(typeof W.hgAssessFlowTrap === 'function', 'hgAssessFlowTrap exported');
  ok(typeof W.hgNearQualityHint === 'function', 'hgNearQualityHint exported');
  ok(typeof W.hgFilterGoldPostGate === 'function', 'hgFilterGoldPostGate exported');
}

console.log('== Binance twin funding for thin tickers (G4 honest) ==');
{
  W.biasBinanceSymbol = function(sym){ return sym === 'B-ETH_USDT' ? 'ETHUSDT' : null; };
  W.binanceFunding = async function(sym){
    return sym === 'ETHUSDT' ? { fundingPct: 0.0123 } : null;
  };
  const t0 = { symbol: 'B-ETH_USDT', fundingPct: null, mark: 100 };
  const t1 = await W.hgEnrichTickerFundingTwin(t0);
  ok(t1.fundingPct === 0.0123, 'fills missing fundingPct from Binance twin');
  ok(t1.fundingTwin === 'ETHUSDT', 'records fundingTwin symbol');
  const tKeep = await W.hgEnrichTickerFundingTwin({ symbol: 'BTCUSDT', fundingPct: -0.01 });
  ok(tKeep.fundingPct === -0.01, 'does not overwrite existing funding');
  delete W.biasBinanceSymbol;
  delete W.binanceFunding;
}

console.log('== BTC symbol helpers ==');
{
  ok(W.hgIsBtcSymbol('B-BTC_USDT') === true, 'CoinDCX BTC symbol recognized');
  ok(W.hgIsBtcSymbol('ETHUSDT') === false, 'alt is not BTC');
  ok(W.hgBtcCandleSymbol({ symbol: 'B-ETH_USDT' }) === 'B-BTC_USDT', 'CoinDCX BTC candle pair');
  ok(W.hgBtcCandleSymbol({ symbol: 'ETHUSDT' }) === 'BTCUSD', 'Delta BTC candle pair');
}

console.log('== stale momentum veto (BEST parity) ==');
{
  const rows = synthRows(80, 100, 0.02);
  const entry = rows[rows.length - 1].c;
  const stale = W.hgStaleMomentumVeto(rows, 'long', entry);
  ok(stale && typeof stale.veto === 'boolean', 'returns veto shape');
  ok(stale.veto === true, 'flat price at entry on aged cascade vetoes');
  ok(/STALE MOMENTUM/.test(stale.reason || ''), 'reason names stale momentum');
  const fresh = W.hgStaleMomentumVeto(rows, 'long', entry - 50);
  ok(fresh.veto === false, 'large displacement passes stale check');
}

console.log('== post-gate veto: flow trap ==');
{
  W.biasBinanceSymbol = () => 'ETHUSDT';
  W.binanceTakerRatio = async () => ({ series: Array.from({ length: 25 }, () => ({ buySellRatio: 0.7 })) });
  W.binanceDepth = async () => ({ bids: [[100, 1]], asks: [[101, 1]] });
  W.binanceSpotTakerFlow = async () => ({ series: Array.from({ length: 25 }, () => ({ buySellRatio: 0.7 })) });
  W.hgFlowTrapAssess = () => ({ veto: true, reason: 'FLOW TRAP test' });
  const hit = { dir: 'long', entry: 100, stop: 95, t1: 110 };
  const qv = await W.hgPostGateSetupVeto({ symbol: 'ETHUSDT' }, hit, synthRows(80, 100), 'swing', async () => synthRows(80, 100));
  ok(qv.ok === false && qv.tag === 'flow', 'flow trap blocks post-gate');
  delete W.hgFlowTrapAssess;
  delete W.biasBinanceSymbol;
  delete W.binanceTakerRatio;
  delete W.binanceDepth;
  delete W.binanceSpotTakerFlow;
}

console.log('== post-gate veto: relative strength ==');
{
  function ramp(n, total){
    const step = Math.pow(1 + total, 1 / (n - 1));
    const out = []; let p = 100;
    for (let i = 0; i < n; i++){
      out.push({ t: i * 14400, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 1 });
      p *= step;
    }
    return out;
  }
  const alt = ramp(70, 0.02);
  const btc = ramp(70, 0.20);
  const hit = { dir: 'long', entry: alt[alt.length - 1].c - 50, stop: alt[0].c, t1: alt[alt.length - 1].c * 1.05 };
  const qv = await W.hgPostGateSetupVeto(
    { symbol: 'ETHUSDT' }, hit, alt, 'swing',
    async () => btc
  );
  ok(qv.ok === false && qv.tag === 'rs', 'lagging BTC blocks alt long post-gate');
  const btcHit = await W.hgPostGateSetupVeto(
    { symbol: 'B-BTC_USDT' }, hit, btc, 'swing', async () => btc
  );
  ok(btcHit.ok === true, 'BTC itself skips RS denominator');
}

console.log('== regime filter applies to swing and scalp ==');
{
  ok(/hgRegimeAllowsSetup\(rows, 'swing'\)/.test(html), 'swing scan calls regime filter');
  ok(/hgRegimeAllowsSetup\(h1, 'scalp'\)/.test(html), 'scalp scan calls regime filter on 1h');
  ok(/audit\.regimeSkip/.test(html), 'audit tracks regime skips');
}

console.log('== scan wiring: enrich → clean → post-gate veto ==');
{
  ok(/hgEnrichTickerFundingTwin\(t\)/.test(html), 'scan enriches ticker before gates');
  ok(/hgPostGateSetupVeto\(tScan, hit, rows, 'swing'/.test(html), 'swing CLEAN passes post-gate veto');
  ok(/hgPostGateSetupVeto\(tScan, hit, h1, 'scalp'/.test(html), 'scalp CLEAN passes post-gate veto');
  ok(/audit\.qualitySkip\[qv\.tag/.test(html), 'quality skips tracked by tag');
}

console.log('== WHY EMPTY funnel shows quality filters ==');
{
  ok(/Quality filter · /.test(html), 'funnel labels quality filter rows');
  ok(/flow · RS · stale — gates unchanged/.test(html), 'funnel says gates unchanged');
}

console.log('== gold GS4 reads Binance XAUUSDT funding ==');
{
  ok(/binanceFunding\('XAUUSDT'\)/.test(html), 'runGold fetches XAUUSDT perp funding');
  ok(/XAUUSDT perp/.test(html), 'GS4 detail cites Binance crowd read');
  ok(!/fr = null/.test(html.slice(html.indexOf('async function runGold'), html.indexOf('async function runGold') + 800)),
     'runGold no longer hardcodes fr = null');
}

console.log('== accuracy pack wiring (hg-v198) ==');
{
  ok(/hgWarmLayerIds\(\['regime'\]\)/.test(html), 'scan warms REGIME before crypto leg');
  ok(/hgNearQualityHint/.test(html), 'NEAR path runs quality hint');
  ok(/rankBoost/.test(html), 'multi-CLEAN rank uses rankBoost');
  ok(/hgSetupCardExtras/.test(html), 'CLEAN cards show clearance/flow extras');
  ok(/hgFilterGoldPostGate/.test(fs.readFileSync(path.join(ROOT, 'goldscalp.js'), 'utf8')),
     'goldscalp calls hgFilterGoldPostGate');
  ok(/hgApplyGoldWeekendDemotes/.test(fs.readFileSync(path.join(ROOT, 'goldswing.js'), 'utf8')),
     'goldswing applies weekend demotion');
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scorecard.js'), 'utf8'), ctx, { filename: 'scorecard.js' });
  ok(typeof W.hgLiveStopScale === 'function', 'hgLiveStopScale exported');
  ok(W.hgLiveStopScale() === 1, 'thin ledger -> unit stop scale');
  ok(W.hgFlowBinanceSymbol('XAUTUSD') === 'XAUUSDT', 'gold maps to XAUUSDT flow leg');
  ok(W.hgFlowBinanceSymbol('B-ETH_USDT') === 'ETHUSDT', 'CoinDCX maps to Binance twin');
}

console.log('\n' + passed + ' passed, 0 failed');
