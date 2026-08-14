/* HARDGATE — Pack 18 crypto position risk engine tests. */
import {
  hgCryptoFixedRiskSize,
  hgCryptoMaxSurvivableLev,
  hgCryptoLiqPrice,
  hgCryptoLiqClearance,
  hgCryptoCostR,
  hgCryptoNetRAtTarget,
  hgCryptoBreakevenWinRate,
  hgCryptoPositionRisk,
  hgCryptoAttachPositionSize,
  hgCryptoRiskGate,
  hgCryptoFundingCostR,
  hgCryptoIndiaTaxDragR,
  HG_CRYPTO_LIQ_CLEARANCE_MIN
} from '../lib/crypto-position-risk.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function ok(c, m){ if (c){ pass++; console.log('ok    - ' + m); } else { fail++; console.error('FAIL  - ' + m); } }

const size = hgCryptoFixedRiskSize(1000, 1, 100, 98, 3);
ok(size.positionSizeUnits === 5 && size.riskAmountUSD === 10, 'risk_to_qty: 1% on $1k with $2 stop → 5 units');
ok(size.impliedLeverage === 0.5, 'implied lev derived as notional/balance (5×100/1000)');

ok(hgCryptoMaxSurvivableLev(100, 98) === 28, 'ceiling lev matches legacy formula at 2% stop');
const liq = hgCryptoLiqPrice(100, 10, 0.005, 'long');
ok(liq != null && liq < 100, 'long liq below entry');
const clr = hgCryptoLiqClearance(100, 98, liq);
ok(clr != null && clr >= 1, 'liq clearance computable');

const costR = hgCryptoCostR(100, 99.65, 'maker', 'taker');
ok(costR > 0.23 && costR < 0.25, 'tight scalp stop has heavy fee drag in R');

const netR = hgCryptoNetRAtTarget(100, 99.65, 100.7, 'long');
ok(netR != null && netR < 2, 'net R at T1 subtracts costs from gross');

const be = hgCryptoBreakevenWinRate(2, costR);
ok(be != null && be > 0.33, 'breakeven win rate rises with costs');

const risk = hgCryptoPositionRisk(
  { dir: 'long', entry: 100, stop: 98, t1: 104, sym: 'BTCUSD', style: 'swing' },
  { balance: 1000, riskPct: 1 }
);
ok(risk.pass === true && risk.impliedLeverage < risk.ceilingLeverage, 'swing setup passes liq + sizing');
ok(risk.liqClearance >= HG_CRYPTO_LIQ_CLEARANCE_MIN - 0.05, 'liq clearance ≥ 1.5× stop');

const scalpRisk = hgCryptoPositionRisk(
  { dir: 'long', entry: 100, stop: 99.65, t1: 100.35, style: 'scalp' },
  { balance: 1000, riskPct: 1, netRFloor: 1.5 }
);
ok(scalpRisk.netR != null && scalpRisk.netR < 1.5, 'tight scalp has low net R');

const setup = { dir: 'long', entry: 100, stop: 98, t1: 104, sym: 'BTCUSD' };
hgCryptoAttachPositionSize(setup, 1000, 1);
ok(setup.positionSize && setup.positionSize.positionSizeUnits === 5, 'cryptoAttachPositionSize mirrors gold');
ok(setup.positionRisk && setup.positionRisk.impliedLeverage === 0.5, 'positionRisk attached');

const gate = hgCryptoRiskGate(risk);
ok(gate.pass === true, 'risk gate passes clean swing');

ok(hgCryptoFundingCostR(5000, 10, 24, 0.0001) > 0, 'funding cost R positive for 24h hold');
const taxDrag = hgCryptoIndiaTaxDragR(2, 0.1, 100, 98, 5000, 10, { indiaTax: true });
ok(taxDrag > 0, 'India tax drag on winning R');

const riskV2 = hgCryptoPositionRisk(
  { dir: 'long', entry: 100, stop: 99.65, t1: 100.35, style: 'scalp' },
  { balance: 1000, riskPct: 1, holdHours: 24, fundingRate8h: 0.0001, indiaTax: true }
);
ok(riskV2.fundingCostR != null && riskV2.fundingCostR > 0, 'v2 funding on worksheet');
ok(riskV2.indiaTax === true, 'v2 india tax flag');

const ctx = vm.createContext({ window: {}, document: { head: { appendChild: function(){} } } });
ctx.window = ctx; ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'crypto-position-risk.js'), 'utf8'), ctx);
ok(typeof ctx.hgCryptoPositionRisk === 'function', 'browser bridge exports hgCryptoPositionRisk');
ok(typeof ctx.hgCryptoAttachPositionSize === 'function', 'browser bridge exports attach');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/crypto-position-risk\.js/.test(html), 'index loads crypto-position-risk.js');
ok(/risk-tab\.js/.test(html), 'index loads risk-tab.js');
ok(/tabs:\['risk'/.test(html), 'RISK tab in nav group');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(swCacheOk(sw), 'sw cache matches build-stamp (' + HG_VER + ')');
ok(/crypto-position-risk\.js/.test(sw), 'sw precaches crypto-position-risk.js');

console.log('\n' + pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
