/* HARDGATE — TradeOS MCP core router + API wiring tests (offline). */
import {
  routeTradeosQuery,
  classifyTradeosQuery,
  buildHardgateContextBlock,
  parseTradeosToolResult,
  tradeosConfigured,
  TRADEOS_PRESETS,
} from '../lib/tradeos-mcp-core.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== routeTradeosQuery presets ==');
{
  var r1 = routeTradeosQuery({ preset: 'crypto_btc_eth' });
  ok(r1.tool === 'technical_analysis', 'crypto preset -> technical_analysis');
  ok(r1.arguments.action === 'ad_hoc', 'crypto ad_hoc action');
  ok(/BTC/i.test(r1.arguments.ad_hoc.ticker), 'crypto ticker BTC');
  ok(/ETH/i.test(r1.arguments.ad_hoc.userQuestion), 'crypto question mentions ETH');

  var r2 = routeTradeosQuery({ preset: 'gold_xau' });
  ok(r2.arguments.ad_hoc.ticker.indexOf('XAU') >= 0, 'gold preset XAUUSD ticker');

  var r3 = routeTradeosQuery({ preset: 'spread_btc_eth' });
  ok(r3.arguments.ad_hoc.ticker.indexOf('/') >= 0, 'spread preset ratio ticker');

  var r4 = routeTradeosQuery({ preset: 'spread_rank' });
  ok(r4.tool === 'bloomberg-oracle-terminal', 'spread_rank -> bloomberg-oracle-terminal');
  ok(/BTC.*ETH.*XAU/i.test(r4.arguments.query), 'spread_rank mentions BTC ETH XAU');
}

console.log('== classifyTradeosQuery ==');
{
  ok(classifyTradeosQuery('latest macro news on gold') === 'bloomberg-oracle-terminal', 'macro -> bloomberg');
  ok(classifyTradeosQuery('search ticker apple') === 'search_tickers', 'search -> search_tickers');
  ok(classifyTradeosQuery('BTC daily trend levels') === 'technical_analysis', 'TA default');
}

console.log('== buildHardgateContextBlock ==');
{
  var block = buildHardgateContextBlock({
    regime: { label: 'RISK-ON', score: 4, playbook: { bias: 'LONG-ONLY' } },
    brain: { topSym: 'BTCUSD', topTier: 'PRIME', marketRead: 'majors lead' },
    rotation: { season: 'ALT SEASON' },
    goldBasisPct: 0.42,
    goldSource: 'delta-xaut',
  });
  ok(block.indexOf('RISK-ON') >= 0, 'context includes regime');
  ok(block.indexOf('BRAIN TOP') >= 0, 'context includes brain');
  ok(block.indexOf('ALT SEASON') >= 0, 'context includes rotation');
  ok(block.indexOf('0.42') >= 0, 'context includes gold basis');
}

console.log('== parseTradeosToolResult ==');
{
  var parsed = parseTradeosToolResult({ content: [{ type: 'text', text: 'hello **world**' }] });
  ok(parsed.ok && parsed.text === 'hello **world**', 'parse text content');
  ok(!parseTradeosToolResult(null).ok, 'null result -> not ok');
}

console.log('== tradeosConfigured ==');
{
  var prev = process.env.TRADEOS_ACCESS_TOKEN;
  delete process.env.TRADEOS_ACCESS_TOKEN;
  ok(!tradeosConfigured(), 'not configured without token');
  process.env.TRADEOS_ACCESS_TOKEN = '  eyJ.test  ';
  ok(tradeosConfigured(), 'configured with token');
  if (prev) process.env.TRADEOS_ACCESS_TOKEN = prev; else delete process.env.TRADEOS_ACCESS_TOKEN;
}

console.log('== presets catalog ==');
{
  ok(Object.keys(TRADEOS_PRESETS).length >= 5, 'at least 5 presets defined');
}

console.log('== wiring ==');
{
  var srv = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(srv.indexOf('createTradeosMcpApi') >= 0, 'server imports TradeOS API');
  ok(srv.indexOf('/api/tradeos') >= 0, 'server mounts /api/tradeos');
  ok(fs.existsSync(path.join(root, 'lib/tradeos-mcp-api.mjs')), 'tradeos api exists');
  ok(fs.existsSync(path.join(root, 'lib/tradeos-mcp-core.mjs')), 'tradeos core exists');
  ok(fs.existsSync(path.join(root, 'lib/tradeos-mcp-client.mjs')), 'tradeos client exists');
  ok(fs.existsSync(path.join(root, 'tradeos.js')), 'tradeos.js tab exists');
  var idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(idx.indexOf('tradeos.js') >= 0, 'index.html loads tradeos.js');
  ok(idx.indexOf("'tradeos'") >= 0, 'index.html nav includes tradeos');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v266/.test(sw), 'cache hg-v266');
}

console.log('\n' + pass + ' passed');
