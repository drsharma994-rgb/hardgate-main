/* HARDGATE — Atomic Agents (Delta + CoinDCX) integration tests. */
import {
  rankCrossVenue,
  setupScore,
  composeAtomicDesk,
  atomicCapabilities,
  ATOMIC_AGENT_CHAIN,
} from '../lib/atomic-agent-core.mjs';
import { normDeltaRows, normCdcxRows, mergeCdcxMarks, topByTurnover } from '../lib/atomic-agent-universe.mjs';
import { trySwingClean } from '../lib/atomic-agent-gates.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== atomic capabilities ==');
{
  ok(ATOMIC_AGENT_CHAIN.length === 4, 'four atomic pipeline agents');
  var caps = atomicCapabilities({});
  ok(caps.routes.scan === '/api/atomic/scan', 'scan route');
  ok(caps.inspiredBy.indexOf('atomic-agents') >= 0, 'attribution');
}

console.log('== universe normalizers ==');
{
  var delta = normDeltaRows({ result: [{ symbol: 'BTCUSD', mark_price: 100, turnover_usd: 1e8, funding_rate: 0.01 }] });
  ok(delta.length === 1 && delta[0].base === 'BTC', 'delta norm');
  var cdcx = normCdcxRows(['B-ETH_USDT']);
  ok(cdcx.length === 1 && cdcx[0].base === 'ETH', 'cdcx norm');
  var merged = mergeCdcxMarks(cdcx, { prices: { 'B-ETH_USDT': { mp: 3000, v: 5000000 } } });
  ok(merged.rows[0].mark === 3000 && merged.rows[0].turnoverUsd === 5000000, 'cdcx marks merge');
  var top = topByTurnover(delta.concat(merged.rows), 'delta', 5);
  ok(top.length === 1, 'topByTurnover delta');
}

console.log('== cross-venue ranker ==');
{
  var ranked = rankCrossVenue(
    [{ base: 'BTC', sym: 'BTCUSD', exchange: 'delta', dir: 'long', clean7: true, mark: 100, rr: 2.5 }],
    [{ base: 'BTC', sym: 'B-BTC_USDT', exchange: 'coindcx', dir: 'long', clean7: true, mark: 100.5, rr: 2.2 }]
  );
  ok(ranked.length === 1 && ranked[0].bestVenue, 'ranked one base');
  ok(ranked[0].basisBps != null, 'basis computed');
  var desk = composeAtomicDesk({
    delta: { setups: [{ base: 'ETH', sym: 'ETHUSD', exchange: 'delta', dir: 'short', clean7: true, score: 50 }] },
    coindcx: { setups: [] },
  });
  ok(desk.bestSetups.length >= 1 && desk.topFindings.length >= 1, 'desk composed');
}

console.log('== gate engine load ==');
{
  var rows = [];
  for (var i = 0; i < 260; i++){
    var c = 50000 + i * 10;
    rows.push({ t: i, o: c, h: c + 5, l: c - 5, c: c, v: 1000 });
  }
  var hit = trySwingClean(rows, { symbol: 'BTCUSD', fundingPct: 0.01, mark: rows[rows.length - 1].c });
  ok(hit === null || hit.dir === 'long' || hit.dir === 'short', 'swingTryClean callable in Node');
}

console.log('== wiring ==');
{
  ok(/createAtomicAgentApi/.test(fs.readFileSync(path.join(root, 'scripts/server.mjs'), 'utf8')), 'server atomic api');
  ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('atomic-agent-desk.js') >= 0, 'index loads atomic desk');
  ok(/atomic-agent-desk\.js/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw shell atomic');
  ok(fs.readFileSync(path.join(root, 'ai-agent.js'), 'utf8').indexOf('Setup tickets') >= 0, 'ai-agent setup detail cards');
  ok(/hg-v227/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'cache hg-v227');
  ok(fs.readFileSync(path.join(root, 'ai-agent.js'), 'utf8').indexOf('atomic-delta') >= 0, 'ai-agent atomic runners');
  ok(fs.readFileSync(path.join(root, 'ai-agent.js'), 'utf8').indexOf('ATOMIC DELTA+CDCX') >= 0, 'atomic UI button');
}

console.log('\n' + pass + ' assertions passed');
