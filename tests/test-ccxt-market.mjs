/* HARDGATE — CCXT market desk + executor config tests (offline). */
import {
  ccxtFundingAnnualPct,
  ccxtCarryLabel,
  ccxtFundingFormationBoost,
  ccxtNormalizeLeg,
  ccxtFinalizeDesk,
} from '../lib/ccxt-market-core.mjs';
import { hgCcxtExchangeOptions, hgCcxtMarketExchangeId, hgCcxtDeskSymbols } from '../lib/ccxt-config.mjs';
import { ccxtCapabilities } from '../lib/ccxt-market-api.mjs';
import { formationQuality } from '../lib/formation-quality.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== ccxt funding core ==');
{
  ok(ccxtFundingAnnualPct(0.0001) > 10, 'annualized funding from 8h rate');
  ok(ccxtCarryLabel(0.0004) === 'LONG-PAY', 'crowded long funding label');
  ok(ccxtFundingFormationBoost('long', { fundingRate: 0.0004 }) < 0, 'long penalized on positive funding');
  ok(ccxtFundingFormationBoost('long', { fundingRate: -0.0004 }) > 0, 'long boosted on negative funding');
}

console.log('== ccxt desk normalize ==');
{
  var leg = ccxtNormalizeLeg('BTC/USDT:USDT', { fundingRate: 0.00005 }, { last: 65000 });
  ok(leg.symbol === 'BTC/USDT:USDT' && leg.mark === 65000, 'normalize leg ticker + funding');
  var desk = ccxtFinalizeDesk({ legs: { 'BTC/USDT:USDT': leg, 'ETH/USDT:USDT': { mark: 3500, fundingRate: -0.0001 } } });
  ok(desk.btc && desk.eth && desk.ethBtcRatio > 0, 'finalize desk ratio');
}

console.log('== ccxt exchange config ==');
{
  var bybit = hgCcxtExchangeOptions('bybit');
  ok(bybit.defaultType === 'linear' && bybit.adjustForTimeDifference === true, 'bybit CCXT defaults');
  ok(hgCcxtMarketExchangeId({ CCXT_MARKET_EXCHANGE: 'bybit' }) === 'bybit', 'market exchange env');
  ok(hgCcxtDeskSymbols({ CCXT_MARKET_SYMBOLS: 'BTC/USDT:USDT' }).length === 1, 'desk symbols env');
}

console.log('== formation quality funding ==');
{
  var q = formationQuality({ side: 'long', fundingRate: 0.0005, oiflowState: 'NEW LONGS' });
  ok(q.pillars.participation < 80, 'high funding lowers participation pillar for long');
}

console.log('== api + shell wiring ==');
{
  var caps = ccxtCapabilities();
  ok(caps.ok && caps.deskRoute === '/api/ccxt/desk', 'capabilities route');
  var srv = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(/createCcxtApi/.test(srv) && /\/api\/ccxt\//.test(srv), 'server mounts ccxt api');
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(html.indexOf('ccxt-desk.js') >= 0, 'index loads ccxt-desk.js');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v251/.test(sw), 'cache hg-v251');
  var pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  ok(pkg.dependencies && pkg.dependencies.ccxt === '^4.5.71', 'ccxt dep bumped');
}

console.log('\n' + pass + ' assertions passed');
