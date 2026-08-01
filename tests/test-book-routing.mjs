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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
