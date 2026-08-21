/* HARDGATE — OMNIGOLD XM bot backtest.
   Replays the send path (TICKET + pending fill + SL/T1), not the mechanic
   walk-forward that enters at bar close.
   Run: node tests/test-omnigold-xm-bot-backtest.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { xmOrderType } from '../lib/xm-trader-order.mjs';
import { ogXmTicketOk as liveTicketOk } from '../lib/omnigold-xm-bot.mjs';
import {
  OG_XM_SPREAD_USD,
  ogXmTicketOk,
  ogXmBarTouchesEntry,
  ogXmBotWalkTrade,
  ogXmBotBacktest,
  ogXmBotBacktestFromScan,
  ogXmBotSummarize,
  ogXmBotBacktestHtml,
} from '../lib/omnigold-xm-bot-backtest.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bar(o, h, l, c, t){
  return { o: o, h: h, l: l, c: c, t: t || 0, v: 1 };
}
function flat(n, px, t0){
  const out = [];
  for (let i = 0; i < n; i++){
    out.push(bar(px, px + 0.2, px - 0.2, px, (t0 || 0) + i * 3600));
  }
  return out;
}
function ticket(over){
  return Object.assign({
    source: 'OMNIGOLD',
    horizon: 'SCALP',
    kind: 'ASIA-BREAK',
    dir: 'long',
    ticket: true,
    grade: { ticket: true, vetoes: [] },
    plan: { entry: 2640, stop: 2630, t1: 2660, t2: 2680 },
    livePx: 2650,
    symbol: 'XAUUSD',
  }, over || {});
}

console.log('== same ticket gate as live send ==');
{
  ok(ogXmTicketOk === liveTicketOk, 'walker uses the same ogXmTicketOk as live send');
  const src = read('lib/omnigold-xm-bot-backtest.mjs');
  ok(/ogXmTicketOk/.test(src) && /omnigold-xm-ticket/.test(src),
     'backtest module uses the live ticket gate, not a second copy');
  ok(/xmOrderType/.test(src), 'backtest uses xmOrderType for pending vs market');
}

console.log('== WATCH / VETO never become trades ==');
{
  const rows = flat(80, 2650);
  const watch = ogXmBotWalkTrade(rows, 50, ticket({
    ticket: false, grade: { ticket: false, vetoes: [] },
  }), { horizon: 20 });
  ok(watch.state === 'skip', 'WATCH is skipped (got ' + watch.state + ')');
  ok(watch.rGross == null, 'WATCH does not carry a loss');
  const veto = ogXmBotWalkTrade(rows, 50, ticket({
    ticket: true, grade: { ticket: true, vetoes: ['weekend'] },
  }), { horizon: 20 });
  ok(veto.state === 'skip', 'ticket-with-veto is skipped');
  const sum = ogXmBotBacktest(rows, [
    { i: 50, ticket: ticket({ ticket: false, grade: { ticket: false, vetoes: [] } }) },
  ], { horizon: 20 });
  ok(sum.sent === 0 && sum.settled === 0, 'WATCH scan produces 0 sends');
}

console.log('== fill rules match XM order types ==');
{
  ok(xmOrderType('long', 2640, 2650).name === 'BUY_LIMIT', 'pullback long is BUY_LIMIT');
  ok(ogXmBarTouchesEntry('BUY_LIMIT', 'long', bar(2650, 2651, 2639, 2645), 2640) === true,
     'BUY_LIMIT fills when the low trades to entry');
  ok(ogXmBarTouchesEntry('BUY_LIMIT', 'long', bar(2650, 2651, 2641, 2648), 2640) === false,
     'BUY_LIMIT does not fill above the limit');
  ok(ogXmBarTouchesEntry('BUY_STOP', 'long', bar(2650, 2661, 2648, 2658), 2660) === true,
     'BUY_STOP fills when the high trades through entry');
  ok(ogXmBarTouchesEntry('SELL_LIMIT', 'short', bar(2650, 2661, 2648, 2658), 2660) === true,
     'SELL_LIMIT fills when the high trades to entry');
  ok(ogXmBarTouchesEntry('SELL_STOP', 'short', bar(2650, 2651, 2639, 2645), 2640) === true,
     'SELL_STOP fills when the low trades through entry');
  ok(ogXmBarTouchesEntry('BUY', 'long', bar(2650, 2651, 2649, 2650), 2650) === true,
     'market BUY fills on the next bar without needing a touch');
}

console.log('== unfilled limit is unfilled, not a loss ==');
{
  const rows = flat(80, 2650);
  const t = ogXmBotWalkTrade(rows, 50, ticket(), { horizon: 20, fillBars: 12 });
  ok(t.state === 'unfilled', 'limit that never trades to 2640 is unfilled (got ' + t.state + ')');
  ok(t.rGross == null && t.rNet == null, 'unfilled is not scored as -1R');
  const sum = ogXmBotSummarize([t], { lots: 0.01, spreadUsd: OG_XM_SPREAD_USD });
  ok(sum.unfilled === 1 && sum.settled === 0 && sum.losses === 0,
     'summary counts unfilled separately from losses');
}

console.log('== pending fill then T1 ==');
{
  const rows = flat(50, 2650);
  /* bar 51-53 stay above the limit; 54 dips to 2639 and closes 2642; then drift to T1 */
  rows.push(bar(2650, 2651, 2648, 2649));
  rows.push(bar(2649, 2650, 2647, 2648));
  rows.push(bar(2648, 2649, 2646, 2647));
  rows.push(bar(2646, 2647, 2639, 2642)); /* fill */
  for (let i = 0; i < 8; i++){
    const px = 2642 + i * 3;
    rows.push(bar(px, px + 3, px - 0.5, px + 2));
  }
  /* last of those should have high >= 2660 */
  const t = ogXmBotWalkTrade(rows, 49, ticket(), { horizon: 20, fillBars: 12 });
  ok(t.state === 't1', 'filled limit then T1 (got ' + t.state + ')');
  ok(t.filledAt > 49, 'fill is on a later bar, not the signal close');
  ok(t.rGross > 1.9 && t.rGross < 2.1, 'T1 R is |t1-entry|/risk ≈ 2 (got ' + t.rGross + ')');
  ok(t.type === 'BUY_LIMIT', 'order type is BUY_LIMIT (got ' + t.type + ')');
}

console.log('== same-bar SL and T1 counts as STOP ==');
{
  const rows = flat(50, 2650);
  rows.push(bar(2650, 2665, 2625, 2655)); /* next bar spans entry, stop, and T1 */
  const t = ogXmBotWalkTrade(rows, 49, ticket({
    plan: { entry: 2640, stop: 2630, t1: 2660 },
    livePx: 2650,
  }), { horizon: 20, fillBars: 12 });
  ok(t.state === 'stop', 'intrabar fill+SL+T1 is STOP (got ' + t.state + ')');
  ok(t.rGross === -1, 'stop is -1R gross');
}

console.log('== market BUY fills the next bar, then stop-first ==');
{
  const rows = flat(50, 2650);
  rows.push(bar(2650, 2651, 2649, 2650)); /* market fill */
  rows.push(bar(2650, 2651, 2639, 2645)); /* stop */
  const t = ogXmBotWalkTrade(rows, 49, ticket({
    plan: { entry: 2650, stop: 2640, t1: 2670 },
    livePx: 2650.2,
  }), { horizon: 20 });
  ok(t.type === 'BUY' || t.type === 'SELL', 'near-market is a market type (got ' + t.type + ')');
  ok(t.state === 'stop', 'after market fill the next stop bar is STOP');
}

console.log('== net R is gross minus round-trip spread ==');
{
  const rows = flat(50, 2650);
  rows.push(bar(2650, 2665, 2639, 2642)); /* fill + later T1 on subsequent bars */
  for (let i = 0; i < 6; i++){
    const px = 2645 + i * 4;
    rows.push(bar(px, px + 4, px - 0.4, px + 3));
  }
  const t = ogXmBotWalkTrade(rows, 49, ticket(), { horizon: 20, fillBars: 12, spreadUsd: 0.30, lots: 0.01 });
  ok(t.state === 't1' || t.state === 'stop', 'trade settled (got ' + t.state + ')');
  const costR = (0.30 * 2) / 10; /* $0.60 on a $10 stop */
  ok(t.rNet != null && t.rGross != null, 'settled trade has gross and net R');
  ok(Math.abs((t.rGross - t.rNet) - costR) < 1e-9,
     'net = gross − $0.60/risk (Δ=' + (t.rGross - t.rNet) + ', want ' + costR + ')');
  ok(t.rNet < t.rGross, 'net R is strictly less than gross');
}

console.log('== strongest-only: one send per cooldown ==');
{
  const rows = flat(120, 2650);
  /* force fills: every bar from 61 dips to 2639 then rallies through T1 */
  for (let i = 60; i < 120; i++){
    rows[i] = bar(2650, 2665, 2639, 2655, i * 3600);
  }
  const a = ticket({ kind: 'ASIA-BREAK' });
  const b = ticket({ kind: 'KZ-JUDAS' });
  const sum = ogXmBotBacktest(rows, [
    { i: 50, ticket: a },
    { i: 52, ticket: b },
  ], { horizon: 20, fillBars: 20, cooldown: 20 });
  ok(sum.sent === 1, 'second ticket inside the cooldown is not a second send (sent=' + sum.sent + ')');
}

console.log('== fromScan cooldown + skip null tickets ==');
{
  const rows = flat(100, 2650);
  for (let i = 60; i < 100; i++) rows[i] = bar(2650, 2665, 2639, 2655, i * 3600);
  let calls = 0;
  const sum = ogXmBotBacktestFromScan(rows, function(prefix, i){
    calls++;
    if (i === 50 || i === 51) return ticket();
    return null;
  }, { warm: 50, horizon: 20, fillBars: 20, cooldown: 20 });
  ok(sum.sent === 1, 'fromScan sends once at the first ticket (sent=' + sum.sent + ')');
  ok(calls < 40, 'cooldown skips scanFn calls inside the occupied window (calls=' + calls + ')');
}

console.log('== dollar PnL assumes 0.01 lot = 1 ounce ==');
{
  const rows = flat(50, 2650);
  rows.push(bar(2650, 2651, 2625, 2635)); /* market-ish fill + stop. live far → LIMIT, may unfilled */
  const t = ogXmBotWalkTrade(rows, 49, ticket({
    plan: { entry: 2650, stop: 2640, t1: 2670 },
    livePx: 2650,
  }), { horizon: 20, lots: 0.01, spreadUsd: 0.30 });
  if (t.state === 'stop'){
    ok(t.usdGross === -10, '0.01 lot × $10 stop = −$10 gross (got ' + t.usdGross + ')');
    ok(t.usdNet === -(10 + 0.60), 'net subtracts $0.60 round-trip (got ' + t.usdNet + ')');
  } else {
    ok(false, 'near-market long should fill and stop on the next bar (got ' + t.state + ')');
  }
}

console.log('== HTML names the method honestly ==');
{
  const html = ogXmBotBacktestHtml(ogXmBotSummarize([], { lots: 0.01, spreadUsd: 0.30 }));
  ok(/IN-SAMPLE/.test(html) && /GROSS/.test(html) && /NET/.test(html),
     'panel says in-sample GROSS vs NET');
  ok(/unfilled/i.test(html), 'panel names unfilled');
  ok(/not a live XM statement/i.test(html) || /not a broker statement/i.test(html),
     'panel says this is not a live XM statement');
  ok(!/profit forecast/i.test(html) || /not a profit forecast/i.test(html),
     'does not claim a forecast');
}

console.log('== backtest never talks to XM ==');
{
  const src = read('lib/omnigold-xm-bot-backtest.mjs');
  ok(!/xmPlaceOrder|fetchImpl|XM_MT5_TOKEN/.test(src),
     'backtest module has no order POST / token path');
  ok(!/HG_LIVE_TRADING_ENABLED\s*=\s*true/.test(src), 'does not flip crypto live');
}

console.log('== OMNIGOLD panel wires BACKTEST BOT ==');
{
  const og = read('omnigold.js');
  ok(/id="ogXmBt"/.test(og) || /BACKTEST BOT/.test(og), 'XM panel has a BACKTEST BOT control');
  ok(/ogXmBotBacktest|hgOgXmRunBacktest/.test(og), 'tab calls the bot backtest, not hgOmniBacktestOne as PnL');
  ok(/unfilled/.test(og) && /GROSS/.test(og), 'tab copy mentions unfilled + GROSS');
}

console.log('\n' + passed + ' passed, 0 failed');
