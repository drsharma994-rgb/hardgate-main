/* HARDGATE — Stage 3 tests: SMART $ scanner + BIAS Binance-confirm row.
   - smartClassify driven with synthetic positioning data (all 8 regime groups)
   - biasBinanceSymbol mapping
   - runBias B1 row: PASS (agree) / VETO (opposite) / N/A (no data)
   - runSmartScan end-to-end with stubbed binance legs, incl. per-symbol failure
     tolerance, setup-vs-context ranking and the XAUUSDT gold-perp callout.
   - smartSetup: SWING continuation / SCALP reversion plans, stop geometry,
     ATR fallback, confirmed cascade, reject paths
   - smartScreenCandidates: ≥$5M universe + |chg24|≥2 / top-120 screening
   - smartCardHTML: setup badge, plan line, toTrade handoff
   Run: node tests/test-smart.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const load = f => vm.runInThisContext(fs.readFileSync(root + f, 'utf8'), { filename: f });
load('indicators.js'); load('binance.js'); load('macro.js');

const html = fs.readFileSync(root + 'index.html', 'utf8');
const smartBlock = html.match(/\/\* >>> SMART MONEY \(BINANCE\) >>>[\s\S]*?<<< SMART MONEY END <<< \*\//);
if (!smartBlock) throw new Error('smart-money markers not found in index.html');
const biasFn = html.match(/async function runBias\(\)\{[\s\S]*?\n\}(?=\n\n\/\* =+\n   SCANNERS)/);
if (!biasFn) throw new Error('runBias not found ahead of the SCANNERS banner');

// ---- browser/DOM stubs ----
globalThis.window = {};
const elements = {};
globalThis.$ = id => (elements[id] = elements[id] || { innerHTML: '', textContent: '', title: '', value: '', disabled: false, checked: false, style: {} });
globalThis.setProg = () => {};
globalThis.S = { exchange: 'delta', tickers: [], fng: null, dom: null, candleCache: {} };
globalThis.nowSec = () => Math.floor(Date.now() / 1000);
globalThis.sleep = ms => new Promise(r => setTimeout(r, ms));
globalThis.fmt = (n, d = 2) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
globalThis.px = n => isFinite(n) ? Number(n).toFixed(2) : '—';
globalThis.pct = (n, d = 1) => isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(d) + '%' : '—';
globalThis.gateRow = (id, name, state, detail) => `GATE:${id}|${state}|${name} :: ${detail}\n`;
// v53 waitAlertIdle stub — mirrors the real contract: false only when the alert
// cycle is genuinely busy (tests never set S.alertBusy, so scans proceed).
globalThis.waitAlertIdle = async statEl => {
  if (globalThis.S.alertBusy && globalThis.S.alertBusySince && Date.now() - globalThis.S.alertBusySince > 4*60*1000) globalThis.S.alertBusy = false;
  return !globalThis.S.alertBusy;
};

// ---- load the extracted smart block + runBias ----
vm.runInThisContext(smartBlock[0], { filename: 'smart-extract.js' });
vm.runInThisContext(biasFn[0], { filename: 'rungold-bias-extract.js' });

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* ================= 1) smartClassify — all 8 regime groups ================= */
console.log('== smartClassify (synthetic positioning data) ==');
const C = globalThis.smartClassify;

let r = C({ chg24: 2, oiChgPct: 3, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
ok(r.dir === 'long' && r.longEv.some(e => e.includes('trend fuel')), 'price↑+OI↑ → LONG trend fuel');

r = C({ chg24: 2, oiChgPct: 3, fundingPct: 0.06, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
ok(r.dir === 'short' && !r.longEv.some(e => e.includes('trend fuel')) && r.shortEv.some(e => e.includes('funding extreme')), 'price↑+OI↑ but funding extreme → fuel suppressed, SHORT fade');

r = C({ chg24: 2, oiChgPct: -3, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
ok(r.dir === 'short' && r.regime.some(e => e.includes('short-covering')), 'price↑+OI↓ → short-covering rally, SHORT fade risk');

r = C({ chg24: -2, oiChgPct: 3, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
ok(r.dir === 'short' && r.shortEv.some(e => e.includes('trend fuel')), 'price↓+OI↑ → SHORT trend fuel');

r = C({ chg24: -2, oiChgPct: -3, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
ok(r.dir === 'long' && r.regime.some(e => e.includes('long liquidation')), 'price↓+OI↓ → long liquidation, capitulation LONG');

r = C({ chg24: 0, oiChgPct: 0, fundingPct: -0.06, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
ok(r.dir === 'long' && r.longEv.some(e => e.includes('shorts pay')), 'funding −0.06% → shorts crowded, LONG');

r = C({ chg24: 0, oiChgPct: 0, fundingPct: 0.01, retailLongPct: 70, topLongPct: 70, takerRatio: 1.0 });
ok(r.dir === 'short' && r.shortEv.some(e => e.includes('≥65')), 'retail 70% long → contrarian SHORT');

r = C({ chg24: 0, oiChgPct: 0, fundingPct: 0.01, retailLongPct: 30, topLongPct: 30, takerRatio: 1.0 });
ok(r.dir === 'long' && r.longEv.some(e => e.includes('≤35')), 'retail 30% long → contrarian LONG');

r = C({ chg24: 0, oiChgPct: 0, fundingPct: 0.01, retailLongPct: 40, topLongPct: 60, takerRatio: 1.0 });
ok(r.dir === 'long' && r.longEv.some(e => e.includes('follow top')), 'top 60 vs retail 40 (+20pp) → follow top LONG');

r = C({ chg24: 0, oiChgPct: 0, fundingPct: 0.01, retailLongPct: 60, topLongPct: 40, takerRatio: 1.0 });
ok(r.dir === 'short' && r.shortEv.some(e => e.includes('follow top')), 'top 40 vs retail 60 (−20pp) → follow top SHORT');

r = C({ chg24: 0, oiChgPct: 0, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.25 });
ok(r.dir === 'long' && r.longEv.some(e => e.includes('aggressive buyers')), 'taker 1.25 → LONG');

r = C({ chg24: 0, oiChgPct: 0, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 0.8 });
ok(r.dir === 'short' && r.shortEv.some(e => e.includes('aggressive sellers')), 'taker 0.80 → SHORT');

r = C({ chg24: 0.1, oiChgPct: 0.5, fundingPct: 0.01, retailLongPct: 50, topLongPct: 52, takerRatio: 1.0 });
ok(r.dir === null && r.total === 0, 'inside deadzones → no direction, no fabricated evidence');

r = C({ chg24: null, oiChgPct: null, fundingPct: null, retailLongPct: null, topLongPct: null, takerRatio: null });
ok(r.dir === null, 'all null → null dir (tolerated)');

/* ================= 2) biasBinanceSymbol ================= */
console.log('== biasBinanceSymbol ==');
ok(globalThis.biasBinanceSymbol('BTCUSD') === 'BTCUSDT', 'BTCUSD → BTCUSDT');
ok(globalThis.biasBinanceSymbol('B-ETH_USDT') === 'ETHUSDT', 'B-ETH_USDT → ETHUSDT');
ok(globalThis.biasBinanceSymbol('XAUTUSD') === 'XAUUSDT', 'XAUTUSD → XAUUSDT (TradFi gold perp)');
ok(globalThis.biasBinanceSymbol('SOLUSD') === 'SOLUSDT', 'SOLUSD → SOLUSDT');

/* ================= 3) runBias B1 confirm row ================= */
console.log('== runBias B1 row (PASS / VETO / N/A) ==');
function trendRows(n, start, slope, stepSec){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = start + i * slope + Math.sin(i / 2.7) * Math.abs(slope) * 3;
    rows.push({ t: 1700000000 + i * stepSec, o: c - slope * 0.4, h: c + Math.abs(slope) * 0.6, l: c - Math.abs(slope) * 0.8, c: c, v: 100 });
  }
  return rows;
}
globalThis.getCandles = async (sym, res) => trendRows(res === '1d' ? 260 : res === '4h' ? 300 : 200, 100, 0.4, res === '1d' ? 86400 : res === '4h' ? 14400 : 3600);
globalThis.S = { exchange: 'delta', tickers: [{ symbol: 'BTCUSD', fundingPct: 0.01, mark: 250, chg24: 2 }], fng: null, dom: null, candleCache: {} };
$('biasSym').value = 'BTCUSD';

async function biasB1State(binanceRowsFn){
  globalThis.binanceKlines = binanceRowsFn;
  $('biasOut').innerHTML = '';
  await globalThis.runBias();
  const m = $('biasOut').innerHTML.match(/GATE:B1\|(pass|veto|na)\|/);
  return m ? m[1] : '(row missing)';
}
let st = await biasB1State(async (s, res) => trendRows(120, 100, 0.5, res === '1d' ? 86400 : 14400));
ok(st === 'pass', 'B1 = PASS when Binance trend agrees (got ' + st + ')');
ok(/BINANCE CONFIRM/.test($('biasOut').innerHTML), 'B1 row labeled BINANCE CONFIRM');

st = await biasB1State(async (s, res) => trendRows(120, 400, -0.5, res === '1d' ? 86400 : 14400));
ok(st === 'veto', 'B1 = VETO when Binance trend disagrees (got ' + st + ')');

st = await biasB1State(async () => []);
ok(st === 'na', 'B1 = N/A when Binance has no data (got ' + st + ')');

st = await biasB1State(async () => { throw new Error('network down'); });
ok(st === 'na', 'B1 = N/A when Binance fetch throws (got ' + st + ')');

/* ================= 4) runSmartScan end-to-end with failures ================= */
console.log('== runSmartScan (stubbed binance legs + per-symbol failure) ==');
globalThis.binancePerpUniverse = async () => ['AAAUSDT', 'BBBUSDT', 'CCCUSDT', 'XAUUSDT'];
globalThis.binanceTickers24h = async () => ({
  AAAUSDT: { symbol: 'AAAUSDT', mark: 10, chg24: 2.1, turnoverUsd: 5e7 },
  BBBUSDT: { symbol: 'BBBUSDT', mark: 5, chg24: -1.2, turnoverUsd: 3e7 },
  CCCUSDT: { symbol: 'CCCUSDT', mark: 2, chg24: -3.0, turnoverUsd: 2.5e7 },
  XAUUSDT: { symbol: 'XAUUSDT', mark: 4000, chg24: 0.8, turnoverUsd: 2.2e7 }
});
globalThis.binanceFunding = async s => s === 'BBBUSDT' ? null : { fundingPct: s === 'XAUUSDT' ? 0.07 : 0.01, markPrice: 1, nextFundingTime: 0 };
globalThis.binanceOIHistory = async s => s === 'BBBUSDT' ? null : { latest: { oi: 110, oiUsd: 1e6, t: 1 }, series: [{ oi: 100, oiUsd: 9e5, t: 0 }, { oi: 110, oiUsd: 1e6, t: 1 }] };
globalThis.binanceLongShort = async s => s === 'BBBUSDT' ? null : { latest: { longPct: s === 'XAUUSDT' ? 72 : 55, shortPct: 45, ratio: 1.2, t: 1 }, series: [{ longPct: 55, shortPct: 45, ratio: 1.2, t: 1 }] };
globalThis.binanceTopTraders = async s => s === 'BBBUSDT' ? null : { latest: { longPct: 45, shortPct: 55, ratio: 0.8, t: 1 }, series: [{ longPct: 45, shortPct: 55, ratio: 0.8, t: 1 }] };
globalThis.binanceTakerRatio = async s => s === 'BBBUSDT' ? null : { latest: { buySellRatio: s === 'AAAUSDT' ? 1.3 : (s === 'CCCUSDT' ? 0.8 : 1.0), t: 1 }, series: [{ buySellRatio: 1.0, t: 1 }] };
/* AAAUSDT gets a real 120-bar uptrend on both TFs (→ confirmed SWING setup);
   every other symbol gets no klines (→ context card, setup = null). */
globalThis.binanceKlines = async (s, res) => s === 'AAAUSDT' ? trendRows(120, 100, 0.5, res === '4h' ? 14400 : 3600) : [];

await globalThis.runSmartScan();
const cards = $('smartCards').innerHTML, stat = $('smartStat').textContent, gold = $('smartGold').innerHTML;
console.log('  stat:', stat);
ok(cards.includes('AAAUSDT'), 'AAAUSDT card rendered (trend fuel + taker = LONG 2 evidence)');
ok(cards.includes('CCCUSDT'), 'CCCUSDT card rendered (trend fuel + taker = SHORT 2 evidence)');
ok(!cards.includes('BBBUSDT'), 'BBBUSDT skipped — total failure, counted');
ok(stat.includes('1 symbols failed'), 'stat reports "1 symbols failed"');
ok(stat.includes('universe 4') && stat.includes('(4 screened)'), 'stat reports universe 4 ≥$5M, 4 screened');
ok(stat.includes('1 setups (1 confirmed)') && stat.includes('2 context'), 'stat tallies 1 confirmed setup + 2 context cards');
ok(cards.indexOf('AAAUSDT') < cards.indexOf('CCCUSDT'), 'confirmed-setup card ranks above context card');
const aaaCard = cards.slice(cards.indexOf('AAAUSDT'), cards.indexOf('CCCUSDT'));
ok(aaaCard.includes('>SWING<') && aaaCard.includes('CONFIRMED') && aaaCard.includes('SEND TO TRADE PLAN'),
   'AAAUSDT card: SWING badge + CONFIRMED pip + trade button');
ok(gold.includes('XAUUSDT') && gold.includes('POSITIONING EXTREME') && gold.includes('GOLD PERP'),
   'XAUUSDT gold-perp callout rendered (funding 0.07 extreme + retail 72%)');
ok(!$('smartEmpty') || $('smartEmpty').style.display !== 'block' || cards.length > 0, 'empty state only when no cards');

/* ================= 5) smartSetup — swing/scalp plan builder ================= */
console.log('== smartSetup ==');
const SU = globalThis.smartSetup;
const lastOf = a => a[a.length - 1];
/* deterministic rows: constant bar range → stable ATR for exact stop math */
function mkRows(n, start, step, stepSec, range){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = start + i * step;
    const r = range !== undefined ? range : Math.abs(step) * 2 + 0.5;
    rows.push({ t: 1700000000 + i * stepSec, o: c - step, h: c + r * 0.6, l: c - r * 0.6, c: c, v: 100 });
  }
  return rows;
}

// 5a) SWING continuation long — structure stop inside the 2.5×ATR cap
{
  const rows4h = mkRows(120, 100, 0.02, 14400, 0.5);
  const cls = C({ chg24: 3, oiChgPct: 2, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
  const s = SU(cls, rows4h, null);
  const a4 = lastOf(atr(rows4h, 14)), sw = lastSwing(rows4h, 'long', 30);
  const entry = rows4h[rows4h.length - 1].c;
  ok(!!s && s.type === 'SWING' && s.dir === 'long', 'swing: trend-fuel evidence + agreeing 24h window → SWING long');
  ok(Math.abs(s.entry - entry) < 1e-9, 'swing: entry = last 4h close');
  ok(Math.abs(s.stop - (sw - 0.25 * a4)) < 1e-9 && s.note === '', 'swing: structure stop kept when risk ≤ 2.5×ATR');
  ok(s.stop < s.entry && s.entry < s.t1 && s.t1 < s.t2, 'swing long: stop < entry < T1 < T2');
  ok(Math.abs((s.t1 - s.entry) - 2 * (s.entry - s.stop)) < 1e-9
     && Math.abs((s.t2 - s.entry) - 3.5 * (s.entry - s.stop)) < 1e-9, 'swing: T1 = 2R, T2 = 3.5R');
  ok(Math.abs(s.rr1 - 2) < 1e-9 && Math.abs(s.rr2 - 3.5) < 1e-9 && s.riskPct > 0, 'swing: rr1/rr2/riskPct fields');
  ok(s.confirmed === true, 'swing: uptrend EMA20>EMA50 → CONFIRMED');
}

// 5b) SWING risk fallback — 30-bar structure too far → entry − 1.5×ATR
{
  const rows4h = mkRows(120, 100, 0.5, 14400);
  const cls = C({ chg24: 3, oiChgPct: 2, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
  const a4 = lastOf(atr(rows4h, 14)), entry = rows4h[rows4h.length - 1].c;
  const swRisk = entry - (lastSwing(rows4h, 'long', 30) - 0.25 * a4);
  ok(swRisk > 2.5 * a4, 'swing fallback fixture: structure risk > 2.5×ATR');
  const s = SU(cls, rows4h, null);
  ok(!!s && Math.abs(s.stop - (entry - 1.5 * a4)) < 1e-9 && s.note.indexOf('stop capped') !== -1,
     'swing: stop falls back to entry − 1.5×ATR with capped note');
}

// 5c) SWING short — mirrored stop side
{
  const rows4h = mkRows(120, 200, -0.02, 14400, 0.5);
  const cls = C({ chg24: -3, oiChgPct: 2, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
  const s = SU(cls, rows4h, null);
  ok(!!s && s.type === 'SWING' && s.dir === 'short', 'swing short: trend fuel down → SWING short');
  ok(s.stop > s.entry && s.entry > s.t1 && s.t1 > s.t2, 'swing short: stop > entry > T1 > T2');
  ok(s.confirmed === true, 'swing short: downtrend EMA20<EMA50 → CONFIRMED');
}

// 5d) UNCONFIRMED — 24h window agrees but the EMA cascade does not
{
  const rows4h = mkRows(112, 200, -0.5, 14400).concat(mkRows(8, 146, 2, 14400));
  const closes = rows4h.map(r => r.c);
  const e20 = lastOf(ema(closes, 20)), e50 = lastOf(ema(closes, 50));
  ok(e20 < e50, 'unconfirmed fixture: EMA20 still below EMA50 after the bounce');
  const cls = C({ chg24: 2, oiChgPct: 3, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
  const s = SU(cls, rows4h, null);
  ok(!!s && s.type === 'SWING' && s.confirmed === false, 'bounce against the cascade → SWING but UNCONFIRMED');
}

// 5e) SCALP reversion short after a short-covering rally (1H-based)
{
  const rows4h = mkRows(120, 100, 0.3, 14400);
  const rows1h = mkRows(120, 130, 0.1, 3600, 0.4);
  const cls = C({ chg24: 5, oiChgPct: -3, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 0.85 });
  const s = SU(cls, rows4h, rows1h);
  const a1 = lastOf(atr(rows1h, 14)), entry = rows1h[rows1h.length - 1].c;
  const exHi = Math.max(...rows1h.slice(-24).map(r => r.h));
  ok(!!s && s.type === 'SCALP' && s.dir === 'short', 'scalp: covering-rally reversion → SCALP short');
  ok(Math.abs(s.entry - entry) < 1e-9 && Math.abs(s.stop - (exHi + 0.5 * a1)) < 1e-9, 'scalp: 1h entry, stop beyond the 24h extreme');
  ok(s.stop > s.entry && s.entry > s.t1 && s.t1 > s.t2, 'scalp short: stop > entry > T1 > T2');
  ok(Math.abs(s.rr1 - 1.5) < 1e-9 && Math.abs(s.rr2 - 2.5) < 1e-9, 'scalp: T1 = 1.5R, T2 = 2.5R');
  ok(s.note.indexOf('time-stop') !== -1, 'scalp: 24h time-stop note');
}

// 5f) SCALP long from capitulation; short 1H history falls back to 4H
{
  const rows4h = mkRows(120, 200, -0.3, 14400);
  const cls = C({ chg24: -4, oiChgPct: -2, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
  const s = SU(cls, rows4h, mkRows(10, 160, 0.1, 3600));
  const entry4 = rows4h[rows4h.length - 1].c;
  ok(!!s && s.type === 'SCALP' && s.dir === 'long', 'scalp: capitulation evidence → SCALP long');
  ok(Math.abs(s.entry - entry4) < 1e-9 && s.note.indexOf('4H-based') !== -1, 'scalp: <30 1H bars → 4H entry + fallback note');
  ok(s.stop < s.entry && s.t1 > s.entry && s.t2 > s.t1, 'scalp long: stop < entry < T1 < T2');
}

// 5g) rejects — null on unusable input
{
  const rows = mkRows(120, 100, 0.1, 14400);
  const longCls = C({ chg24: 3, oiChgPct: 2, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.0 });
  ok(SU(null, rows, null) === null, 'null cls → null');
  ok(SU(C({ chg24: 0.1, oiChgPct: 0.1, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1 }), rows, null) === null,
     'null cls.dir → null');
  ok(SU(longCls, null, null) === null, 'null rows4h → null');
  ok(SU(longCls, mkRows(50, 100, 0.1, 14400), null) === null, 'rows4h < 60 bars → null');
  const flat = [];
  for (let i = 0; i < 120; i++) flat.push({ t: 1700000000 + i * 14400, o: 100, h: 100, l: 100, c: 100, v: 1 });
  ok(SU(longCls, flat, null) === null, 'zero ATR (flat tape) → null (no fabricated risk)');
  /* the two defensive guards (wrong-side stop → risk ≤ 0, and rr1 < 1.5) are
     unreachable through real kline geometry — the trendAgree gate flips broken
     structures to SCALP, and T1 is 2R by construction — so they are pinned at
     source level instead of through a contrived fixture. */
  ok(/!\(risk > 0\)/.test(smartBlock[0]) && /!\(sRisk > 0\)/.test(smartBlock[0]),
     'defensive risk ≤ 0 rejects present in source (swing + scalp)');
  ok(/rr1 < 1\.5/.test(smartBlock[0]), 'defensive rr1 < 1.5 reject present in source');
}

/* ================= 6) smartScreenCandidates — full-universe 2-pass filter ================= */
console.log('== smartScreenCandidates ==');
{
  const perps = [], ticks = {};
  for (let i = 0; i < 130; i++){
    const s = 'S' + i + 'USDT';
    perps.push(s);
    ticks[s] = { symbol: s, mark: 1, chg24: 0.5, turnoverUsd: (200 - i) * 1e6 };
  }
  ticks.S125USDT.chg24 = 5;    // mover outside the top-120
  ticks.S129USDT.chg24 = -3;   // mover outside the top-120
  perps.push('LOWUSDT');
  ticks.LOWUSDT = { symbol: 'LOWUSDT', mark: 1, chg24: 40, turnoverUsd: 4e6 }; // below $5M
  const scr = globalThis.smartScreenCandidates(perps, ticks);
  ok(scr.universe.length === 130, 'universe = all perps ≥$5M (sub-$5M mover excluded despite |chg24|=40)');
  ok(scr.candidates.length === 122, 'candidates = top-120 turnover + 2 movers = 122');
  ok(scr.candidates.includes('S125USDT') && scr.candidates.includes('S129USDT'), '|chg24| ≥ 2 pulls in movers outside top-120');
  ok(!scr.candidates.includes('S120USDT') && !scr.candidates.includes('LOWUSDT'), 'flat sub-top-120 and sub-$5M excluded');
  ok(scr.candidates[0] === 'S0USDT' && scr.candidates.indexOf('S125USDT') < scr.candidates.indexOf('S129USDT'),
     'candidates stay turnover-descending');
}

/* ================= 7) smartCardHTML — badge, plan, trade button ================= */
console.log('== smartCardHTML ==');
{
  const clsL = C({ chg24: 3, oiChgPct: 2, fundingPct: 0.01, retailLongPct: 50, topLongPct: 50, takerRatio: 1.15 });
  const base = { sym: 'TESTUSDT', tick: { symbol: 'TESTUSDT', mark: 100, chg24: 3, turnoverUsd: 5e7 },
                 markPrice: 102.38, fundingPct: 0.01, oiUsd: 1.2e6, oiChgPct: 2,
                 retailLongPct: 50, topLongPct: 55, takerRatio: 1.15, cls: clsL };
  const setup = { type: 'SWING', dir: 'long', entry: 102.38, stop: 101.33, t1: 104.48, t2: 106.05,
                  rr1: 2, rr2: 3.5, riskPct: 1.03, confirmed: true, note: '' };
  const h = globalThis.smartCardHTML(Object.assign({ setup: setup }, base));
  ok(h.indexOf('>SWING<') !== -1 && h.indexOf('CONFIRMED') !== -1, 'setup card: SWING badge + CONFIRMED pip');
  ok(h.indexOf('ENTRY <b>') !== -1 && h.indexOf('STOP <b>') !== -1 && h.indexOf('T1 <b>') !== -1
     && h.indexOf('T2 <b>') !== -1 && h.indexOf('risk ') !== -1, 'setup card: full plan line rendered');
  ok(h.indexOf('class="toTrade"') !== -1 && h.indexOf('SEND TO TRADE PLAN') !== -1
     && h.indexOf('toTrade(&quot;TESTUSDT&quot;,&quot;long&quot;,102.38,101.33,104.48)') !== -1,
     'setup card: toTrade handoff button with escaped payload');
  /* SAFE-leverage chip: smartCardHTML calls the global hgSafeLevChip when the
     full app provides it (index.html inline block) and degrades cleanly when
     the block is absent (standalone test harness). */
  ok(h.indexOf('x SAFE') === -1, 'chip absent without the global helper (clean degradation)');
  globalThis.hgSafeLevChip = (entry, stop) => ' · <span>TESTCHIP ' + entry + '/' + stop + ' x SAFE</span>';
  const hChip = globalThis.smartCardHTML(Object.assign({ setup: setup }, base));
  ok(hChip.indexOf('TESTCHIP 102.38/101.33 x SAFE') !== -1, 'SAFE chip rendered on the plan line when the helper exists');
  delete globalThis.hgSafeLevChip;
  /* session chip in the chead: absent standalone, rendered when the app
     provides hgSessionChip */
  ok(h.indexOf('LONDON KZ') === -1 && h.indexOf('OFF-HOURS') === -1, 'session chip absent without the global helper');
  globalThis.hgSessionChip = () => ' <span class="gpip">TESTKZ</span>';
  const hKz = globalThis.smartCardHTML(Object.assign({ setup: setup }, base));
  ok(hKz.indexOf('TESTKZ') !== -1, 'session chip rendered in the card header when the helper exists');
  delete globalThis.hgSessionChip;
  const h2 = globalThis.smartCardHTML(Object.assign({ setup: Object.assign({}, setup, { confirmed: false }) }, base));
  ok(h2.indexOf('UNCONFIRMED') !== -1, 'unconfirmed setup: UNCONFIRMED pip');
  const h3 = globalThis.smartCardHTML(Object.assign({ setup: null }, base));
  ok(h3.indexOf('toTrade') === -1 && h3.indexOf('evidence majority') !== -1,
     'no-setup card: old informational text, no trade button');
}

/* ================= 8) +COINDCX twin mapping ================= */
console.log('== smartCdcxMap ==');
{
  const perps = ['BTCUSDT', 'AEVOUSDT', 'SOLUSDT'];
  const xu = [
    { sym: 'B-BTC_USDT',  base: 'BTC',  exchange: 'cdcx' },
    { sym: 'B-AEVO_USDT', base: 'AEVO', exchange: 'coindcx' },   /* xuniverse.js's own spelling */
    { sym: 'B-SOL_USDT',  base: 'SOL',  exchange: 'coindcx' },
    { sym: 'B-GHOST_USDT', base: 'GHOST', exchange: 'cdcx' },
    { sym: 'ETHUSD',      base: 'ETH',  exchange: 'delta' },   /* other venue ignored */
    null, {}
  ];
  const m = globalThis.smartCdcxMap(xu, perps);
  ok(m.twinOf.BTCUSDT === 'B-BTC_USDT' && m.twinOf.AEVOUSDT === 'B-AEVO_USDT' && m.twinOf.SOLUSDT === 'B-SOL_USDT',
     'every CoinDCX row with a Binance twin maps base -> twin sym');
  ok(!m.twinOf.GHOSTUSDT && m.noTwin.length === 1 && m.noTwin[0] === 'B-GHOST_USDT',
     'CoinDCX-only contracts are named, never fabricated — GHOST has no positioning data anywhere');
  ok(!m.twinOf.ETHUSDT, 'delta rows never enter the CoinDCX map');
  const g = globalThis.smartCdcxMap(null, null);
  ok(Object.keys(g.twinOf).length === 0 && g.noTwin.length === 0, 'garbage input -> empty map, never throws');
}

/* ================= 9) venue stamping on the card ================= */
console.log('== venue stamping (COINDCX chip + toTrade target) ==');
{
  const clsL = { dir: 'long', longEv: ['trend fuel: price+OI rising'], shortEv: [], regime: ['new longs entering'], score: 1, total: 1 };
  const base = { sym: 'AEVOUSDT', tick: { symbol: 'AEVOUSDT', mark: 1, chg24: 3, turnoverUsd: 5e7 },
                 markPrice: 1.02, fundingPct: 0.01, oiUsd: 1.2e6, oiChgPct: 2,
                 retailLongPct: 50, topLongPct: 55, takerRatio: 1.15, cls: clsL,
                 venue: 'cdcx', venueSym: 'B-AEVO_USDT' };
  const setup = { type: 'SWING', dir: 'long', entry: 1.02, stop: 0.99, t1: 1.08, t2: 1.12,
                  rr1: 2, rr2: 3.5, riskPct: 2.9, confirmed: true, note: '' };
  const h = globalThis.smartCardHTML(Object.assign({ setup: setup }, base));
  ok(h.indexOf('B-AEVO_USDT') !== -1 && h.indexOf('>COINDCX<') !== -1,
     'COINDCX-stamped card shows the CoinDCX sym + venue chip');
  ok(h.indexOf('positioning via AEVOUSDT on Binance') !== -1,
     'the chip honestly names the Binance twin the positioning came from');
  ok(h.indexOf('toTrade(&quot;B-AEVO_USDT&quot;') !== -1,
     'the trade handoff targets the CoinDCX contract, not the twin');
  const h2 = globalThis.smartCardHTML(Object.assign({ setup: setup },
    Object.assign({}, base, { venue: undefined, venueSym: undefined })));
  ok(h2.indexOf('AEVOUSDT') !== -1 && h2.indexOf('>COINDCX<') === -1,
     'plain Binance rows carry no venue chip');
}

/* ================= 10) hgSessionChip — kill-zone windows (IST) ================= */
console.log('== hgSessionChip ==');
{
  const chipFn = html.match(/function hgSessionChip\(now\)\{[\s\S]*?\n\}/);
  if (!chipFn) throw new Error('hgSessionChip not found in index.html');
  vm.runInThisContext(chipFn[0], { filename: 'sessionchip-extract.js' });
  const chip = globalThis.hgSessionChip;
  /* UTC anchors → IST = UTC + 5:30 regardless of machine tz */
  ok(chip(Date.UTC(2026, 6, 29, 7, 30)).indexOf('LONDON KZ') !== -1, '13:00 IST Wed → LONDON KZ');
  ok(chip(Date.UTC(2026, 6, 29, 13, 0)).indexOf('NY KZ') !== -1, '18:30 IST Wed → NY KZ');
  ok(chip(Date.UTC(2026, 6, 29, 20, 0)).indexOf('OFF-HOURS') !== -1, '01:30 IST → OFF-HOURS');
  ok(chip(Date.UTC(2026, 6, 26, 4, 0)).indexOf('OFF-HOURS') !== -1, 'Sunday 09:30 IST → OFF-HOURS');
  ok(chip(Date.UTC(2026, 6, 29, 5, 0)).indexOf('MID-SESSION') !== -1, '10:30 IST Wed → MID-SESSION');
  ok(chip(Date.UTC(2026, 6, 29, 7, 0)).indexOf('LONDON KZ') !== -1, '12:30 IST boundary → LONDON KZ');
  ok(typeof chip('garbage') === 'string', 'garbage input never throws, always returns a string');
}

console.log(`\nALL ${passed} SMART-MONEY ASSERTIONS PASSED`);
