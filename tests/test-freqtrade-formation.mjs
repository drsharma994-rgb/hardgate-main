/* HARDGATE — Freqtrade edge + protections + formation wiring (offline). */
import {
  ftExpectancy,
  ftRequiredRiskReward,
  ftEdgeRow,
  ftEdgeTable,
  ftStoplossSweep,
  ftEdgeGate,
} from '../lib/freqtrade-edge.mjs';
import {
  ftCooldownCheck,
  ftStoplossGuardCheck,
  ftProtectionGate,
} from '../lib/freqtrade-protections.mjs';
import {
  ftFormationScoreBoost,
  ftFormationFilter,
} from '../lib/freqtrade-formation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== ftExpectancy (freqtrade formula) ==');
{
  ok(ftExpectancy(0.6, 2) === 0.8, '60% WR @ 2R RRR -> E=0.8');
  ok(ftExpectancy(0.5, 1) === 0, '50% @ 1R -> E=0');
  ok(ftRequiredRiskReward(0.5, 0) === 1, 'required RRR at 50% WR for E>=0 is 1');
}

console.log('== ftEdgeRow ==');
{
  var trades = [{ r: 2 }, { r: -1 }, { r: 1.5 }, { r: -1 }, { r: 2 }];
  var row = ftEdgeRow(trades);
  ok(row.n === 5 && row.winRate === 0.6, 'edge row win rate');
  ok(row.expectancy != null && row.expectancy > 0, 'positive expectancy on winning set');
}

console.log('== ftEdgeTable whitelist ==');
{
  var rows = [
    { fpKey: 'btc|long|fvg', r: 1.2 }, { fpKey: 'btc|long|fvg', r: -1 },
    { fpKey: 'eth|long|fvg', r: -1 }, { fpKey: 'eth|long|fvg', r: -1 },
  ];
  var tbl = ftEdgeTable(rows, { keyFn: (r) => r.fpKey, minTrades: 2 });
  ok(tbl.families.length === 2, 'two fingerprint families');
  ok(tbl.whitelist.length >= 1, 'at least one whitelisted family');
}

console.log('== ftStoplossSweep ==');
{
  var withMae = [
    { r: 2, maeR: 0.3 }, { r: -1, maeR: 1.2 }, { r: 1.5, maeR: 0.5 },
  ];
  var sweep = ftStoplossSweep(withMae, [0.5, 0.8, 1.0]);
  ok(sweep.grid.length === 3, 'stop grid rows');
  ok(sweep.best != null, 'best stop scale found');
}

console.log('== protections ==');
{
  var now = Date.now();
  var hist = [{ sym: 'BTCUSD', closedAt: now - 5 * 60000, r: -1 }];
  var cd = ftCooldownCheck(hist, 'BTCUSD', now, { cooldownMinutes: 30 });
  ok(cd.lock === true, 'cooldown locks after recent close');
  var stops = [];
  for (var i = 0; i < 5; i++) stops.push({ sym: 'ETHUSD', closedAt: now - 60000, r: -1, stopped: true });
  var guard = ftStoplossGuardCheck(stops, 'ETHUSD', 'long', now, { tradeLimit: 4 });
  ok(guard.lock === true, 'stoploss guard triggers');
  var pg = ftProtectionGate({ sym: 'BTCUSD', side: 'long' }, hist, now, { cooldown: { cooldownMinutes: 30 } });
  ok(pg.ok === false, 'protection gate blocks on cooldown');
}

console.log('== ftFormationFilter ==');
{
  var cands = [{ sym: 'BTCUSD', fpKey: 'btc|long|fvg', side: 'long', fqs: 80 }];
  var ledger = [{ fpKey: 'btc|long|fvg', r: 2 }, { fpKey: 'btc|long|fvg', r: 1 }, { fpKey: 'btc|long|fvg', r: -1 }];
  var res = ftFormationFilter(cands, { ledgerRows: ledger, tradeHistory: [], env: {} });
  ok(res.passed.length === 1, 'candidate passes when protections clear');
  ok(res.passed[0].ftExpectancy != null || res.passed[0].ftEdgeReason, 'ft edge stamped');
}

console.log('== ftFormationScoreBoost ==');
{
  var ledger2 = [];
  for (var j = 0; j < 5; j++) ledger2.push({ fpKey: 'btc|long|x', symbol: 'BTCUSD', r: j % 2 ? 1.5 : -0.5 });
  var boost = ftFormationScoreBoost({ fpKey: 'btc|long|x', symbol: 'BTCUSD' }, ledger2);
  ok(typeof boost === 'number', 'formation boost is numeric');
}

console.log('== wiring ==');
{
  ok(fs.existsSync(path.join(root, 'lib/freqtrade-edge.mjs')), 'freqtrade-edge exists');
  ok(fs.existsSync(path.join(root, 'freqtrade-formation.js')), 'browser bridge exists');
  var instr = fs.readFileSync(path.join(root, 'lib/formation-instr.mjs'), 'utf8');
  ok(instr.indexOf('ftFormationFilter') >= 0, 'formation-instr wires ft filter');
  var idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(idx.indexOf('freqtrade-formation.js') >= 0, 'index loads freqtrade-formation.js');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v209/.test(sw), 'cache hg-v209');
}

console.log('\n' + pass + ' passed');
