/* HARDGATE — paper fund book core tests */
import { pbNewBook, pbAddIntent, pbRiskCheck, pbClosePosition, pbMarkBook, pbSummary, PB_DEFAULTS } from '../lib/paperbook-core.mjs';

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
ok(isFinite(sum.equityUsd), 'summary equity');

var veto = pbRiskCheck(book, { sym: 'ETHUSD', dir: 'long', entry: 100, stop: 99, newsBlackout: true });
ok(veto.veto, 'news blackout veto flag');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
