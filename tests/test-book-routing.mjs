/* HARDGATE — scanner → fund routing tests */
import { bookRouteFund, bookScannerFund } from '../lib/book-routing.mjs';

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

ok(bookRouteFund({ fund: 'gold' }) === 'gold', 'explicit fund wins');
ok(bookRouteFund({ klass: 'metals' }) === 'gold', 'metals klass → gold');
ok(bookRouteFund({ strategy: 'goldswing' }) === 'swing', 'goldswing strategy → swing');
ok(bookRouteFund({ strategy: 'edge-scalp' }) === 'swing', 'scalp in strategy → swing');
ok(bookRouteFund({ strategy: 'carry' }) === 'macro', 'carry → macro');
ok(bookRouteFund({ strategy: 'termbasis' }) === 'macro', 'termbasis → macro');
ok(bookRouteFund({ strategy: 'scanner' }, 'main') === 'main', 'unknown strategy uses fallback');
ok(bookRouteFund({ fund: '!!!' }, 'swing') === 'swing', 'invalid explicit fund uses fallback');
ok(bookRouteFund({ klass: 'metal' }) === 'gold', 'singular metal klass → gold');

ok(bookScannerFund('brain', { lane: 'gold' }) === 'gold', 'brain gold lane → gold fund');
ok(bookScannerFund('brain', { lane: 'crypto' }) === 'main', 'brain crypto lane → main fund');
ok(bookScannerFund('edge', { klass: 'metal' }) === 'gold', 'edge metal → gold fund');
ok(bookScannerFund('edge', { klass: 'crypto' }) === 'swing', 'edge crypto → swing fund');
ok(bookScannerFund('edge', { klass: 'index' }) === 'macro', 'edge index → macro fund');
ok(bookScannerFund('startrader', { klass: 'fx' }) === 'macro', 'startrader fx → macro fund');
ok(bookScannerFund('edge', { fund: 'main', klass: 'crypto' }) === 'main', 'explicit fund pins scanner routing');
ok(bookScannerFund('carry', {}) === 'macro', 'carry scanner → macro fund');
ok(bookScannerFund('termbasis', {}) === 'macro', 'termbasis scanner → macro fund');
ok(bookScannerFund('macro', {}) === 'gold', 'macro scanner → gold fund');
ok(bookScannerFund('goldpro', {}) === 'gold', 'goldpro scanner → gold fund');
ok(bookScannerFund('squeeze', {}) === 'swing', 'squeeze scanner → swing fund');
ok(bookScannerFund('oiflow', {}) === 'swing', 'oiflow scanner → swing fund');
ok(bookScannerFund('liqs', {}) === 'swing', 'liqs scanner → swing fund');
ok(bookScannerFund('meanrev', {}) === 'swing', 'meanrev scanner → swing fund');
ok(bookScannerFund('execute', {}) === 'swing', 'execute scanner → swing fund');
ok(bookScannerFund('best', {}) === 'swing', 'best scanner → swing fund');
ok(bookScannerFund('smart', {}) === 'main', 'smart scanner → main fund');
ok(bookScannerFund('goldswing', {}) === 'gold', 'goldswing scanner → gold fund');
ok(bookScannerFund('finder-scalp', {}) === 'swing', 'finder-scalp → swing fund');
ok(bookScannerFund('finder-gold', { klass: 'metals' }) === 'gold', 'finder-gold → gold fund');
ok(bookScannerFund('finder-judas', {}) === 'swing', 'finder-judas crypto → swing fund');
ok(bookScannerFund('trade-plan', {}) === 'swing', 'trade-plan scanner → swing fund');
ok(bookScannerFund('swing', {}) === 'swing', 'swing scanner → swing fund');
ok(bookScannerFund('scalp', {}) === 'swing', 'scalp scanner → swing fund');
ok(bookScannerFund('trendmx', {}) === 'swing', 'trendmx scanner → swing fund');
ok(bookScannerFund('smc', {}) === 'swing', 'smc scanner → swing fund');
ok(bookScannerFund('ob', {}) === 'swing', 'ob scanner → swing fund');
ok(bookScannerFund('divergence', {}) === 'swing', 'divergence scanner → swing fund');
ok(bookScannerFund('coil', {}) === 'swing', 'coil scanner → swing fund');
ok(bookScannerFund('apex', {}) === 'swing', 'apex scanner → swing fund');
ok(bookScannerFund('liq-trap', {}) === 'swing', 'liq-trap scanner → swing fund');
ok(bookScannerFund('gold-swing', {}) === 'gold', 'gold-swing scanner → gold fund');
ok(bookScannerFund('gold-scalp', {}) === 'gold', 'gold-scalp scanner → gold fund');
ok(bookScannerFund('gold-deep-swing', {}) === 'gold', 'gold-deep-swing → gold fund');
ok(bookScannerFund('gold-setup', {}) === 'gold', 'gold-setup → gold fund');
ok(bookScannerFund('finder-swing', {}) === 'swing', 'finder-swing → swing fund');
ok(bookScannerFund('pine', {}) === 'swing', 'pine scanner → swing fund');
ok(bookScannerFund('goldpine', { strategy: 'swing' }) === 'swing', 'goldpine swing → swing fund');
ok(bookScannerFund('goldpine', { strategy: 'scalp' }) === 'gold', 'goldpine scalp → gold fund');
ok(bookScannerFund('strats', {}) === 'main', 'strats scanner → main fund');
ok(bookScannerFund('scorecard', {}) === 'main', 'scorecard scanner → main fund');
ok(bookScannerFund('finder', {}) === 'swing', 'generic finder → swing fund');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
