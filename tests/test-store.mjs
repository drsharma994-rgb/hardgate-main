/* HARDGATE — store.js pub/sub tests (Node 18+, offline).
   store.js declares `const Store`; expose on vm context for assertions.
   Run: node tests/test-store.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warns = [];
const ctx = vm.createContext(Object.create(null));
ctx.console = {
  warn: (...a) => { warns.push(a.map(x => (x && x.message) ? x.message : String(x)).join(' ')); },
  log: () => {},
};
const src = readFileSync(path.join(root, 'store.js'), 'utf8') + '\nthis.Store = Store;\n';
vm.runInContext(src, ctx, { filename: 'store.js' });
const Store = ctx.Store;

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

console.log('== subscribe / publish ==');
{
  let seen = null;
  const unsub = Store.subscribe('PRICE_UPDATE', d => { seen = d; });
  assert(typeof unsub === 'function', 'subscribe returns unsub function');

  Store.publish('PRICE_UPDATE', { symbol: 'BTCUSD', price: 64500 });
  assert(seen && seen.symbol === 'BTCUSD' && seen.price === 64500, 'publish delivers payload');

  const log = [];
  Store.subscribe('PRICE_UPDATE', d => log.push('a:' + d.price));
  Store.subscribe('PRICE_UPDATE', d => log.push('b:' + d.price));
  Store.publish('PRICE_UPDATE', { symbol: 'ETHUSD', price: 3200 });
  assert(log.join(',') === 'a:3200,b:3200', 'multiple subscribers all invoked in order');

  unsub();
  seen = null;
  Store.publish('PRICE_UPDATE', { symbol: 'X', price: 1 });
  assert(seen === null, 'unsub stops delivery to removed callback');
}

console.log('== error isolation / unknown events ==');
{
  let okOther = false;
  warns.length = 0;

  Store.subscribe('FUNDING_UPDATE', () => { throw new Error('boom'); });
  Store.subscribe('FUNDING_UPDATE', () => { okOther = true; });
  Store.publish('FUNDING_UPDATE', { rate: 0.0001 });
  assert(okOther === true, 'subscriber throw does not block others');
  assert(warns.length > 0, 'subscriber throw logs console.warn');

  let unknownCalled = false;
  assert(() => Store.publish('NO_SUCH_EVENT', {}) === undefined, 'publish unknown event: no throw');
  Store.subscribe('NO_SUCH_EVENT', () => { unknownCalled = true; });
  Store.publish('NO_SUCH_EVENT', { x: 1 });
  assert(unknownCalled === true, 'late subscribe to new event works');
}

console.log('== re-subscribe / idempotent unsub ==');
{
  let n = 0;
  const cb = () => { n++; };
  const off = Store.subscribe('TICK', cb);
  Store.publish('TICK', {});
  off();
  off();
  Store.publish('TICK', {});
  assert(n === 1, 'idempotent unsub + no duplicate delivery');

  const off2 = Store.subscribe('TICK', cb);
  Store.publish('TICK', {});
  assert(n === 2, 're-subscribe after unsub works');
  off2();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
