/* HARDGATE — multi-fund paper book store tests */
import {
  pbNormalizeStore, pbNewStore, pbGetBook, pbSetBook, pbListFunds,
  pbCreateFund, pbResetFund, PB_DEFAULT_FUND,
  pbConsolidatedLp, pbConsolidatedHtml, pbConsolidatedDigestText, pbConsolidatedAttribution,
  pbConsolidatedDesk,
} from '../lib/paperbook-funds.mjs';
import { pbNewBook, pbAddIntent } from '../lib/paperbook-core.mjs';

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

var legacy = pbNewBook();
var migrated = pbNormalizeStore(legacy);
ok(migrated.version === 2 && migrated.funds.main && migrated.funds.main.positions.length === 0,
  'v1 book migrates to v2 main fund');

var store = pbNewStore('main');
ok(store.activeFund === 'main' && store.funds.main, 'new store seeds main');

var created = pbCreateFund(store, { id: 'gold', navUsd: 500000 });
ok(created.ok && created.store.funds.gold.navUsd === 500000, 'create gold fund');
ok(pbCreateFund(created.store, { id: 'gold' }).ok === false, 'duplicate fund rejected');

var got = pbGetBook(created.store, 'gold');
ok(got.fundId === 'gold', 'get gold fund');
var add = pbAddIntent(got.book, { sym: 'XAUUSD', dir: 'long', entry: 2000, stop: 1990, strategy: 'gold' });
got.store = pbSetBook(got.store, 'gold', add.book);
ok(pbListFunds(got.store).length === 2, 'list two funds');
ok(pbListFunds(got.store).some(function(f){ return f.id === 'gold' && f.openCount === 1; }),
  'gold fund shows open position');

var reset = pbResetFund(got.store, 'gold');
ok(reset.ok && reset.book.positions.length === 0, 'reset fund clears positions');

ok(pbNormalizeStore({ version: 2, activeFund: PB_DEFAULT_FUND, funds: { main: pbNewBook() } }).version === 2,
  'v2 store passes through');

var consStore = pbNewStore('main');
var consGold = pbCreateFund(consStore, { id: 'gold', navUsd: 500000 });
consStore = consGold.store;
var consMain = pbGetBook(consStore, 'main');
var addMain = pbAddIntent(consMain.book, { sym: 'BTCUSD', dir: 'long', entry: 50000, stop: 49000, strategy: 'brain' });
consStore = pbSetBook(consStore, 'main', addMain.book);
var consGoldBook = pbGetBook(consStore, 'gold');
var addGold = pbAddIntent(consGoldBook.book, { sym: 'XAUUSD', dir: 'long', entry: 2000, stop: 1990, strategy: 'gold' });
consStore = pbSetBook(consStore, 'gold', addGold.book);
var consolidated = pbConsolidatedLp(consStore, 'month');
ok(consolidated.fundCount === 2 && consolidated.byFund.length === 2, 'consolidated spans two funds');
ok(consolidated.openCount === 2, 'consolidated sums open positions');
var html = pbConsolidatedHtml(consolidated);
ok(html.indexOf('Consolidated LP') >= 0 && html.indexOf('gold') >= 0, 'consolidated HTML renders funds');
var text = pbConsolidatedDigestText(consolidated);
ok(text.indexOf('By fund:') >= 0 && text.indexOf('gold') >= 0, 'consolidated digest text lists funds');

var attrStore = pbNewStore('main');
attrStore = pbCreateFund(attrStore, { id: 'gold' }).store;
var attrMain = pbGetBook(attrStore, 'main');
var attrAddMain = pbAddIntent(attrMain.book, { sym: 'BTCUSD', dir: 'long', entry: 50000, stop: 49000, strategy: 'brain' });
attrStore = pbSetBook(attrStore, 'main', attrAddMain.book);
var attrGold = pbGetBook(attrStore, 'gold');
var attrAddGold = pbAddIntent(attrGold.book, { sym: 'XAUUSD', dir: 'long', entry: 2000, stop: 1990, strategy: 'gold' });
attrStore = pbSetBook(attrStore, 'gold', attrAddGold.book);
var crossAttr = pbConsolidatedAttribution(attrStore);
ok(crossAttr.fundCount === 2 && crossAttr.byFund.length === 2, 'cross-fund attribution spans funds');
ok(crossAttr.byStrategy.some(function(r){ return r.key === 'brain'; })
  && crossAttr.byStrategy.some(function(r){ return r.key === 'gold'; }), 'cross-fund strategy rollup');
ok(crossAttr.strategyByFund.length >= 2
  && crossAttr.strategyByFund.some(function(r){ return r.cells && r.cells.main != null; }),
  'strategy × fund matrix populated');

var desk = pbConsolidatedDesk(attrStore);
ok(desk.fundCount === 2 && desk.openCount === 2, 'desk rollup sums open across funds');
ok(isFinite(desk.equityUsd) && desk.equityUsd > 0, 'desk rollup equity positive');
ok((desk.funds || []).length === 2, 'desk rollup lists per-fund rows');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
