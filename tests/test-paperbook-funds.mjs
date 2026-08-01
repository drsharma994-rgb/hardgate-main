/* HARDGATE — multi-fund paper book store tests */
import {
  pbNormalizeStore, pbNewStore, pbGetBook, pbSetBook, pbListFunds,
  pbCreateFund, pbResetFund, PB_DEFAULT_FUND,
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
