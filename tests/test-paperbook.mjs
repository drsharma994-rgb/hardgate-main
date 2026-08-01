/* HARDGATE — paper fund book core tests */
import {
  pbNewBook, pbAddIntent, pbRiskCheck, pbClosePosition, pbCloseAll,
  pbMarkBook, pbSummary, pbAttribution, pbRollDay, pbPushNavHistory,
  pbScalePosition, pbMoveStop, pbUnrealizedR, pbApplyAutoRules, pbLpReport,
  pbWeeklyDigest, pbDigestText, pbDigestHtml, pbAtrTrailStop,
  pbBuildLiveOrder, pbStopAtR, pbUnitRisk, PB_DEFAULTS,
  pbPushBlotter, pbLatestExecForPosition, pbDigestExecuteSummary, pbDailyLossState,
  parseMaxDailyLossPct, pbBookCfgFromEnv, pbApplyExecuteFill, pbFillBacklogSummary, pbBracketSentForPosition,
} from '../lib/paperbook-core.mjs';
import { pbConsolidatedLp, pbConsolidatedDigestText } from '../lib/paperbook-funds.mjs';

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

var book = pbNewBook();
ok(book.navUsd === PB_DEFAULTS.navUsd, 'new book NAV');

var intent = { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, strategy: 'test' };
var chk = pbRiskCheck(book, intent);
ok(chk.ok && chk.notionalUsd > 0 && chk.riskUsd > 0, 'risk check passes empty book');

var add = pbAddIntent(book, intent);
ok(add.ok && add.book.positions.length === 1, 'add position');
book = add.book;

var b = pbNewBook();
for (var i = 0; i < 12; i++){
  var a = pbAddIntent(b, { sym: 'S' + i, dir: 'long', entry: 100, stop: 99.9, notionalUsd: 8000, strategy: 'fill' });
  ok(a.ok, 'fill position ' + i);
  b = a.book;
}
var over = pbAddIntent(b, { sym: 'S99', dir: 'long', entry: 100, stop: 99.9, notionalUsd: 8000, strategy: 'fill' });
ok(!over.ok && over.check.reasons.some(function(r){ return r.indexOf('max open') >= 0; }), 'max positions veto');

var marked = pbMarkBook(add.book, { BTCUSD: 102 });
ok(marked.positions[0].mark === 102 && marked.unrealizedUsd > 0, 'mark book MTM long profit');

var closed = pbClosePosition(marked, marked.positions[0].id, 103);
ok(closed.ok && closed.book.positions.length === 0, 'close position');

var sum = pbSummary(closed.book);
ok(isFinite(sum.equityUsd) && isFinite(sum.maxHeatPct), 'summary equity + maxHeatPct');

var veto = pbRiskCheck(book, { sym: 'ETHUSD', dir: 'long', entry: 100, stop: 99, newsBlackout: true });
ok(veto.veto, 'news blackout veto flag');

var multi = pbNewBook();
var a1 = pbAddIntent(multi, { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, strategy: 'brain', tier: 'PRIME' });
var a2 = pbAddIntent(a1.book, { sym: 'ETHUSD', dir: 'short', entry: 200, stop: 210, t1: 180, strategy: 'edge', tier: 'HIGH' });
multi = a2.book;
var attr = pbAttribution(multi);
ok(attr.byStrategy.length >= 2 && attr.byStrategy.some(function(r){ return r.key === 'brain'; }), 'attribution by strategy');
ok(attr.byTier.some(function(r){ return r.key === 'PRIME' || r.key === 'HIGH'; }), 'attribution by tier');

var allBook = pbMarkBook(multi, { BTCUSD: 101, ETHUSD: 195 });
var allClosed = pbCloseAll(allBook, { BTCUSD: 101, ETHUSD: 195 });
ok(allClosed.ok && allClosed.book.positions.length === 0 && allClosed.closed.length === 2, 'close all positions');

var rolled = pbRollDay(pbNewBook());
ok(rolled.dayKey && isFinite(rolled.dayStartEquityUsd), 'day roll sets UTC day key + start equity');

var eqBook = pbRollDay(pbNewBook());
eqBook = Object.assign({}, eqBook, { dayStartEquityUsd: PB_DEFAULTS.navUsd });
var addEq = pbAddIntent(eqBook, { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, strategy: 'eq' });
var markedEq = pbMarkBook(addEq.book, { BTCUSD: 105 });
var sumEq = pbSummary(markedEq);
ok(isFinite(sumEq.dayPnlUsd) && sumEq.dayPnlUsd > 0, 'daily PnL tracks equity vs day start');

var haltBook = pbNewBook({ navUsd: 1000000 });
haltBook = pbRollDay(haltBook);
haltBook.dayStartEquityUsd = 1000000;
haltBook.cashUsd = 970000;
var dl = pbDailyLossState(haltBook);
ok(dl.halted && dl.dayPnlUsd <= -20000, 'daily loss halt trips at -3% vs 2% limit');
ok(!pbRiskCheck(haltBook, intent).ok, 'new intent vetoed under daily loss halt');
ok(pbSummary(haltBook).dailyLossHalt === true, 'summary exposes dailyLossHalt flag');

ok(parseMaxDailyLossPct('') === PB_DEFAULTS.maxDailyLossPct, 'empty env uses default daily loss pct');
ok(Math.abs(parseMaxDailyLossPct('3') - 0.03) < 1e-9, 'integer percent parses as fraction');
ok(Math.abs(parseMaxDailyLossPct('0.025') - 0.025) < 1e-9, 'fraction env parses directly');
ok(pbBookCfgFromEnv({ BOOK_MAX_DAILY_LOSS_PCT: '1.5' }).maxDailyLossPct === 0.015, 'cfg from env');

var halt3 = pbNewBook({ navUsd: 1000000 });
halt3 = pbRollDay(halt3);
halt3.dayStartEquityUsd = 1000000;
halt3.cashUsd = 970000;
var dl3 = pbDailyLossState(halt3, { maxDailyLossPct: 0.03 });
ok(dl3.halted && dl3.pct === 0.03, 'custom 3% daily loss limit');

var histBook = pbPushNavHistory(markedEq, sumEq);
ok(Array.isArray(histBook.navHistory) && histBook.navHistory.length === 1, 'nav history snapshot');

var omsBook = pbAddIntent(pbNewBook(), { sym: 'ETHUSD', dir: 'long', entry: 200, stop: 190, t1: 220, strategy: 'oms' }).book;
var scaled = pbScalePosition(pbMarkBook(omsBook, { ETHUSD: 210 }), omsBook.positions[0].id, 0.5, 210);
ok(scaled.ok && scaled.book.positions.length === 1 && scaled.book.positions[0].notionalUsd < omsBook.positions[0].notionalUsd, 'scale 50% reduces open notional');
var moved = pbMoveStop(scaled.book, scaled.book.positions[0].id, scaled.book.positions[0].entry);
ok(moved.ok && moved.position.stop === moved.position.entry, 'move stop to breakeven');
var rVal = pbUnrealizedR(Object.assign({}, scaled.book.positions[0], { mark: 215 }));
ok(rVal != null && rVal > 0, 'unrealized R positive on winner');

var t1Book = pbAddIntent(pbNewBook(), { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, strategy: 'auto' }).book;
var t1Marked = pbMarkBook(t1Book, { BTCUSD: 111 });
var t1Auto = pbApplyAutoRules(t1Marked, {});
ok(t1Auto.actions.some(function(a){ return a.action === 'scale_t1'; }), 'auto scales 50% at T1');
ok(t1Auto.book.positions.length === 1 && t1Auto.book.positions[0].t1Scaled, 'remainder tagged t1Scaled');

var beBook = pbAddIntent(pbNewBook(), { sym: 'SOLUSD', dir: 'long', entry: 100, stop: 90, t1: 120, strategy: 'auto' }).book;
var beMarked = pbMarkBook(beBook, { SOLUSD: 110 });
var beAuto = pbApplyAutoRules(beMarked, { t1Scale: false });
ok(beAuto.actions.some(function(a){ return a.action === 'trail_be'; }), 'auto trails stop to BE at 1R');

var stopBook = pbAddIntent(pbNewBook(), { sym: 'XRPUSD', dir: 'long', entry: 100, stop: 95, t1: 110, strategy: 'auto' }).book;
var stopMarked = pbMarkBook(stopBook, { XRPUSD: 94 });
var stopAuto = pbApplyAutoRules(stopMarked, { t1Scale: false, trailBeAtR: 0 });
ok(stopAuto.actions.some(function(a){ return a.action === 'stop_out'; }), 'auto stop-out when mark hits stop');

var lp = pbLpReport(pbNewBook(), new Date().toISOString().slice(0, 7));
ok(lp.month && isFinite(lp.equityUsd) && Array.isArray(lp.byStrategy), 'LP report month + equity + strategies');

var dig = pbWeeklyDigest(pbNewBook(), 'week');
ok(dig.period === 'week' && isFinite(dig.equityUsd), 'weekly digest equity');
ok(pbDigestText(dig).indexOf('HARDGATE') >= 0, 'digest text header');
ok(pbDigestHtml(dig).indexOf('HARDGATE') >= 0, 'digest html header');

var exBook = pbAddIntent(pbNewBook(), { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, strategy: 'brain' }).book;
var pid = exBook.positions[0].id;
exBook = pbPushBlotter(exBook, { type: 'execute_ok', sym: 'BTCUSD', dir: 'long', positionId: pid, status: 200 });
ok(pbLatestExecForPosition(exBook.blotter, pid).type === 'execute_ok', 'latest exec blotter row for position');
var liveBook = pbAddIntent(pbNewBook(), { sym: 'ETHUSD', dir: 'short', entry: 200, stop: 210, t1: 180, strategy: 'live' }).book;
var livePid = liveBook.positions[0].id;
liveBook = pbPushBlotter(liveBook, { type: 'live_send', sym: 'ETHUSD', dir: 'short', positionId: livePid, ok: true, status: 200 });
ok(pbLatestExecForPosition(liveBook.blotter, livePid).type === 'live_send', 'live_send counts as latest bracket event');
ok(pbDigestExecuteSummary(liveBook, Date.now() - 86400000).pending === 0, 'live_send clears pending bracket count');

var fillBook = pbAddIntent(pbNewBook(), { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, strategy: 'fill' }).book;
var fillPid = fillBook.positions[0].id;
var fillRun = pbApplyExecuteFill(fillBook, { positionId: fillPid, filledQty: 0.5, qty: 1 });
ok(fillRun.ok && fillRun.position.brokerFillPct === 0.5, 'execute fill records 50% on position');
ok(fillRun.book.blotter[0].type === 'execute_fill', 'execute fill pushes blotter row');

var backlogBook = pbAddIntent(pbNewBook(), { sym: 'ETHUSD', dir: 'long', entry: 200, stop: 190, t1: 220, strategy: 'bk' }).book;
var bkPid = backlogBook.positions[0].id;
backlogBook = pbPushBlotter(backlogBook, { type: 'execute_ok', sym: 'ETHUSD', positionId: bkPid });
var bk = pbFillBacklogSummary(backlogBook);
ok(bk.unfilled === 1 && bk.total === 1, 'fill backlog counts bracket without fill');
backlogBook = pbApplyExecuteFill(backlogBook, { positionId: bkPid, filledQty: 0.25, qty: 1 }).book;
var bkPart = pbFillBacklogSummary(backlogBook);
ok(bkPart.partial === 1, 'fill backlog counts partial fill');
ok(pbBracketSentForPosition(backlogBook.blotter, bkPid), 'bracket sent helper');
var exSum = pbDigestExecuteSummary(exBook, Date.now() - 86400000);
ok(exSum.ok === 1 && exSum.pending === 0, 'digest execute summary counts OK + no pending when bracket sent');
var exDig = pbWeeklyDigest(exBook, 'week');
ok(pbDigestText(exDig).indexOf('Brackets: 1 OK') >= 0, 'weekly digest text includes bracket rollup');

var cons = pbConsolidatedLp({ version: 2, activeFund: 'main', funds: { main: exBook } }, 'week');
ok(cons.execute && cons.execute.ok === 1, 'consolidated LP rolls up execute stats');
ok(pbConsolidatedDigestText(cons).indexOf('Brackets: 1 OK') >= 0, 'consolidated digest text includes brackets');

var atrBook = pbAddIntent(pbNewBook(), { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, strategy: 'atr' }).book;
var atrStop = pbAtrTrailStop(Object.assign({}, atrBook.positions[0], { mark: 105 }), 5, 2);
ok(atrStop === 95, 'ATR trail stop long mark-2*atr');
var atrAuto = pbApplyAutoRules(pbMarkBook(atrBook, { BTCUSD: 105 }), {
  t1Scale: false, trailBeAtR: 0, trailLockHalfRAt2R: false, trailLock1RAt3R: false,
  atrMarks: { BTCUSD: 5 },
});
ok(atrAuto.actions.some(function(a){ return a.action === 'trail_atr'; }), 'auto ATR trail at 0.5R+');

var trail2 = pbAddIntent(pbNewBook(), { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, strategy: 'trail' }).book;
var trail2Auto = pbApplyAutoRules(pbMarkBook(trail2, { BTCUSD: 120 }), { t1Scale: false, trailBeAtR: 0 });
ok(trail2Auto.actions.some(function(a){ return a.action === 'trail_lock_half'; }), 'auto locks +0.5R at 2R');
ok(pbUnrealizedR(trail2Auto.book.positions[0]) >= 1.9, 'R uses origStop after trail');

var liveOrd = pbBuildLiveOrder({ sym: 'BTCUSD', dir: 'long', notionalUsd: 10000, mark: 100, stop: 95, t1: 110, t2: 115, id: 'pb_x' });
ok(liveOrd && liveOrd.qty === 100 && liveOrd.bracket.stop === 95, 'live order payload from position');
ok(liveOrd.bracket.takeProfit2 === 115, 'live order forwards T2 when set');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
