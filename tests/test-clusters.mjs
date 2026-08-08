import { pbCluster, pbClusterCheck, pbClusterHeat } from '../lib/clusters.mjs';
import { cooldownCheck, lossStreaks } from '../lib/cooldown.mjs';
import { walkForwardSplit, monteCarloR } from '../lib/walkforward.mjs';

let fails = 0;
function ok(c, m){ if (!c){ fails++; console.error('FAIL', m); } else console.log('ok', m); }

ok(pbCluster('SOLUSDT') === 'l1-alt', 'SOL -> l1-alt');
ok(pbCluster('PAXGUSDT') === 'gold', 'PAXG -> gold');
ok(pbCluster('WIFUSDT') === 'meme', 'WIF -> meme');
ok(pbCluster('BTCUSDT') === 'btc-beta', 'BTC -> btc-beta');

const chk = pbClusterCheck(
  { sym: 'SOLUSDT', dir: 'long', riskUsd: 30000 },
  [{ sym: 'AVAXUSDT', dir: 'long', riskUsd: 20000 }],
  1_000_000
);
ok(chk.veto === true, 'two correlated L1 longs breach the 2.5% cluster cap');

const hedged = pbClusterCheck(
  { sym: 'SOLUSDT', dir: 'short', riskUsd: 20000 },
  [{ sym: 'AVAXUSDT', dir: 'long', riskUsd: 20000 }],
  1_000_000
);
ok(hedged.veto === false, 'offsetting L1 legs net out — not vetoed');

ok(pbClusterHeat([{ sym: 'BTCUSDT', dir: 'long', riskUsd: 10000 }], 1_000_000)
   .byCluster['btc-beta'].net === 0.01, 'btc-beta net heat = 1% NAV');

const now = Date.now();
const outs = [
  { sym: 'BTCUSDT', r: 1.5, closedAt: now - 9e6 },
  { sym: 'BTCUSDT', r: -1,  closedAt: now - 6e6 },
  { sym: 'BTCUSDT', r: -1,  closedAt: now - 3e6 },
];
ok(cooldownCheck('BTCUSDT', outs, null, now).blocked === true, '2 stops -> BTC blocked');
ok(cooldownCheck('ETHUSDT', outs, null, now).blocked === false, 'cooldown is per-symbol');
ok(cooldownCheck('BTCUSDT', outs, null, now + 5 * 3600e3).blocked === false,
   'cooldown expires after the window');
ok(lossStreaks(outs).bySym['BTCUSDT'].streak === 2, 'streak counts back to the last win');

const rs = Array.from({ length: 150 }, (_, i) => (i % 2 === 0 ? 2 : -1));
const wf = walkForwardSplit(rs.map((r, i) => ({ r, closedAt: i })));
ok(wf.verdict === 'HOLDS', 'stable edge -> HOLDS');
ok(wf.train.n === 105 && wf.test.n === 45, '70/30 split');

const decay = walkForwardSplit(
  rs.slice(0, 105).map((r, i) => ({ r, closedAt: i }))
    .concat(Array.from({ length: 45 }, (_, i) => ({ r: -1, closedAt: 200 + i })))
);
ok(decay.verdict === 'OVERFIT', 'edge that dies out-of-sample -> OVERFIT');

const mc = monteCarloR(rs, { trials: 500, seed: 7 });
ok(mc.ok === true && mc.medianMaxDDPct > 0, 'monte carlo returns a drawdown');
ok(monteCarloR([1, -1, 1]).ok === false, 'monte carlo refuses tiny samples');

process.exit(fails ? 1 : 0);
