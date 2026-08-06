/* HARDGATE — TRADE PLAN FTS handoff tests (Node 18+, builtins only). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

globalThis.window = globalThis;
const W = globalThis.window;

vm.runInThisContext(fs.readFileSync(root + 'setup-stack.js', 'utf8'), { filename: 'setup-stack.js' });
vm.runInThisContext(fs.readFileSync(root + 'setup-ui.js', 'utf8'), { filename: 'setup-ui.js' });

assert(typeof W.hgToTradePlan === 'function', 'hgToTradePlan exported');
assert(typeof W.hgTradeHandoffFor === 'function', 'hgTradeHandoffFor exported');
assert(typeof W.hgToTradePlanOnclickJs === 'function', 'hgToTradePlanOnclickJs exported');

const stack = W.hgSetupStack({
  dir: 'long', sym: 'BTCUSD', style: 'swing', clean: true,
  gatesPassed: 7, gatesTotal: 7, asset: 'crypto'
});
assert(stack && stack.summary, 'fixture stack has summary');

let tradeCalled = null;
W.toTrade = function(sym, dir, entry, stop, t1, t2){
  tradeCalled = { sym, dir, entry, stop, t1, t2 };
};

W.hgToTradePlan('BTCUSD', 'long', 100, 95, 110, { t2: 115, stack, scanner: 'edge', strategy: 'edge' });
assert(tradeCalled && tradeCalled.sym === 'BTCUSD', 'hgToTradePlan invokes toTrade');
assert(W._hgTradeHandoff && W._hgTradeHandoff.stack === stack, 'handoff caches FTS stack');

const matched = W.hgTradeHandoffFor('BTCUSD', 'long', 100, 95);
assert(matched && matched.scanner === 'edge', 'hgTradeHandoffFor matches sym/dir/levels');

const miss = W.hgTradeHandoffFor('ETHUSD', 'long', 100, 95);
assert(!miss, 'hgTradeHandoffFor rejects wrong sym');

const onclick = W.hgToTradePlanOnclickJs('BTCUSD', 'long', 100, 95, 110, { scanner: 'pine', stack });
assert(/hgToTradePlan\(/.test(onclick) && /pine/.test(onclick), 'onclick builder uses hgToTradePlan');

assert(typeof W.hgToTradePlanFromBook === 'function', 'hgToTradePlanFromBook exported');

const bookStack = W.hgTradeStackFromBookPosition({ strategy: 'edge', layers: ['edge', 'SWING'] });
assert(bookStack && /BOOK/.test(bookStack.summary) && /edge/.test(bookStack.summary), 'book position stack summary');

W.hgToTradePlanFromBook({ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 95, t1: 110, t2: 115, strategy: 'edge', layers: ['edge'] });
assert(W._hgTradeHandoff && W._hgTradeHandoff.source === 'book', 'book manage sets handoff source');

const indexHtml = fs.readFileSync(root + 'index.html', 'utf8');
assert(indexHtml.indexOf('hgTradeHandoffFor') >= 0, 'planTrade reads handoff');
assert(indexHtml.indexOf('tradeDesk') >= 0, 'trade tab has desk banner slot');
assert(indexHtml.indexOf('_hgTradeHandoffPending') >= 0, 'toTrade clears stale handoff');

const sw = fs.readFileSync(root + 'sw.js', 'utf8');
assert(/hg-v167/.test(sw), 'sw cache bumped for swing ticket fix pack');

console.log(fail ? '\nTESTS FAILED' : '\nALL TRADE-PLAN TESTS PASSED');
process.exit(fail ? 1 : 0);
