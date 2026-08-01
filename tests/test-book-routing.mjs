/* HARDGATE — scanner → fund routing tests */
import { bookRouteFund } from '../lib/book-routing.mjs';

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
