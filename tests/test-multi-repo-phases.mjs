/* HARDGATE — multi-repo phase pack tests (Hummingbot/StockSharp/QuantDinger/eliza/security). */
import { runRiskRules, riskRulesCfgFromEnv } from '../lib/risk-rules.mjs';
import { killSwitchEvaluate } from '../lib/kill-switch.mjs';
import { hgBudgetReserve, hgBudgetRelease } from '../lib/budget-checker.mjs';
import { hgTripleBarrierBar, hgTimeBarrierExpired } from '../lib/triple-barrier.mjs';
import { hgReplaySweepOos } from '../lib/gate-replay-oos.mjs';
import { hgClassifySymbol, HG_ASSET_CLASS } from '../lib/symbols.mjs';
import { hgFormationDeclaredParams, hgClampDeclaredParams } from '../lib/params-declare.mjs';
import { hgFundingArbSignal } from '../lib/ccxt-funding-arb.mjs';
import { hgVwapClipSize } from '../lib/vwap-sizing.mjs';
import { hgCompositeFill } from '../lib/composite-book.mjs';
import { hgWebhookSign, hgWebhookVerify } from '../lib/webhook-hmac.mjs';
import { hgEncryptStateJson, hgDecryptStateJson } from '../lib/daemon-state-crypto.mjs';
import { hardgateMcpCallTool } from '../lib/hardgate-mcp-core.mjs';
import { hgIdempotencyGet, hgIdempotencySet } from '../lib/idempotency.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== Phase A risk/execution ==');
{
  ok(killSwitchEvaluate(-0.03, { lossPct: 0.02, manual: false }).halted, 'kill switch on loss');
  ok(!runRiskRules({ manualHalt: false, notionalUsd: 100 }).ok === false || runRiskRules({ manualHalt: false, notionalUsd: 100 }).ok, 'risk rules run');
  ok(runRiskRules({ manualHalt: true }).ok === false, 'manual halt blocks');
  var st = hgBudgetReserve(null, 10000, 1000);
  ok(st.ok && st.lockId, 'budget reserve');
  hgBudgetRelease(st.state, st.lockId);
  var bar = { o: 100, h: 101, l: 99, c: 100.5 };
  ok(hgTripleBarrierBar('long', bar, { entry: 100, stop: 98, tp: 105, barsHeld: 0 }).hit === null, 'barrier no hit');
  ok(hgTimeBarrierExpired({ executionBarIndex: 0, maxBarsToTp1: 5 }, 6), 'time barrier expired');
}

console.log('== Phase B formation/research ==');
{
  ok(Object.keys(hgFormationDeclaredParams()).length >= 2, 'formation param declare');
  ok(hgClampDeclaredParams({ minRr: 99 }, { minRr: { min: 1.5, max: 3, default: 2 } }).minRr === 3, 'clamp params');
  var samples = [];
  for (var i = 0; i < 20; i++){
    samples.push({ pass: { G6: true }, vals: { G6: 2 + i * 0.01 }, r: i % 3 === 0 ? 1 : -0.5 });
  }
  var oos = hgReplaySweepOos({ samples: samples }, 'G6', [1.5, 2, 2.5], 'min');
  ok(oos.rows.length === 3 && oos.oos, 'OOS sweep');
  ok(hgClassifySymbol('XAUTUSD').assetClass === HG_ASSET_CLASS.GOLD_CFD, 'gold classify');
}

console.log('== Phase C funding/vwap/composite ==');
{
  var sig = hgFundingArbSignal({ fundingRate: 0.0001, symbol: 'BTC' }, { fundingRate: -0.0002, symbol: 'ETH' });
  ok(sig && sig.annSpread != null, 'funding arb signal');
  var clip = hgVwapClipSize([], [[100, 1], [100.1, 2]], 'long', 150, 50);
  ok(clip.qty > 0, 'vwap clip');
  var fill = hgCompositeFill('long', 1, [], [[100, 0.5], [101, 1]]);
  ok(fill.filled > 0 && fill.avgPx, 'composite fill');
}

console.log('== Phase D security/mcp ==');
{
  var body = '{"ok":true}';
  var sigHdr = hgWebhookSign(body, 'test-secret');
  ok(hgWebhookVerify(body, sigHdr, 'test-secret'), 'webhook hmac');
  process.env.HARDGATE_STATE_ENCRYPTION_KEY = 'test-passphrase-32chars-min!!';
  var enc = hgEncryptStateJson({ version: 1, convictions: [] });
  var dec = hgDecryptStateJson(JSON.parse(enc));
  ok(dec && dec.version === 1, 'state encrypt roundtrip');
  delete process.env.HARDGATE_STATE_ENCRYPTION_KEY;
  ok(hardgateMcpCallTool('hardgate_status').ok, 'mcp status tool');
  hgIdempotencySet('k1', { ok: true });
  ok(hgIdempotencyGet('k1').ok, 'idempotency cache');
}

console.log('== wiring ==');
{
  var srv = fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8');
  ok(/createHardgateMcpApi/.test(srv), 'hardgate mcp api mounted');
  ok(/runRiskRules/.test(fs.readFileSync(path.join(root, 'lib/execute-api.mjs'), 'utf8')), 'execute risk rules');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v264/.test(sw), 'cache hg-v264');
  ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('gate-replay-oos.js') >= 0, 'gate-replay-oos loaded');
}

console.log('\n' + pass + ' assertions passed');
