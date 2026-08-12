/* HARDGATE — trading stack API + gold spot-first getXAUCandles wiring tests. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tradingStackStatus, TRADING_STACK_REPOS } from '../lib/trading-stack-core.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== trading stack core ==');
{
  ok(TRADING_STACK_REPOS.length >= 4, 'repos catalog');
  var st = tradingStackStatus({ HARDGATE_DAEMON_DRY_RUN: '1' });
  ok(st.ok && st.ccxt && st.openbb && st.execute && st.xm, 'status shape');
  ok(st.dryRun === true, 'dry run flag');
  ok(st.routes && st.routes.status === '/api/trading-stack/status', 'status route');
  var ftOn = tradingStackStatus({ HARDGATE_FT_EDGE_GATE: '1', HARDGATE_FT_PROTECT: '1' });
  ok(ftOn.freqtrade.edgeGate && ftOn.freqtrade.protectGate, 'freqtrade env');
  ok(ftOn.gates.ftEdge && ftOn.gates.ftProtect, 'gates mirror ft');
}

console.log('== wiring ==');
{
  var srv = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(/createTradingStackApi/.test(srv), 'server mounts trading stack');
  ok(/trading-stack\.js/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'index loads trading-stack.js');
  ok(/hgTradingStackPanelHtml/.test(fs.readFileSync(path.join(root, 'formation-instr-ui.js'), 'utf8')), 'formation panel');
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(/getXmGoldCandles/.test(html) && /preferDeltaXaut/.test(html), 'getXAUCandles spot-first');
  ok(/hg-v264/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'cache hg-v264');
}

console.log('\n' + pass + ' assertions passed');
