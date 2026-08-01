/* HARDGATE — paper fund book core tests */
import {
  pbNewBook, pbAddIntent, pbRiskCheck, pbClosePosition, pbCloseAll,
  pbMarkBook, pbSummary, pbAttribution, pbRollDay, pbPushNavHistory,
  pbScalePosition, pbMoveStop, pbUnrealizedR, pbApplyAutoRules, pbLpReport,
  pbBuildLiveOrder, pbStopAtR, pbUnitRisk, PB_DEFAULTS,
} from '../lib/paperbook-core.mjs';

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

var trail2 = pbAddIntent(pbNewBook(), { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 90, t1: 120, strategy: 'trail' }).book;
var trail2Auto = pbApplyAutoRules(pbMarkBook(trail2, { BTCUSD: 120 }), { t1Scale: false, trailBeAtR: 0 });
ok(trail2Auto.actions.some(function(a){ return a.action === 'trail_lock_half'; }), 'auto locks +0.5R at 2R');
ok(pbUnrealizedR(trail2Auto.book.positions[0]) >= 1.9, 'R uses origStop after trail');

var liveOrd = pbBuildLiveOrder({ sym: 'BTCUSD', dir: 'long', notionalUsd: 10000, mark: 100, stop: 95, t1: 110, id: 'pb_x' });
ok(liveOrd && liveOrd.qty === 100 && liveOrd.bracket.stop === 95, 'live order payload from position');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
