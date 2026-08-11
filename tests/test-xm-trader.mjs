/* HARDGATE — XM / MT5 gold feed wiring for scalp/swing tabs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { xmNormBars, xmTraderConfig } from '../lib/xm-trader-fetch.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== xm trader gold feed ==');
{
  var bars = xmNormBars({
    rates: [
      { time: 1700000000, open: 4380, high: 4390, low: 4375, close: 4388, tick_volume: 12 },
      { time: 1700000900, open: 4388, high: 4395, low: 4385, close: 4392, tick_volume: 9 },
    ],
  });
  ok(bars.length === 2 && bars[1].c === 4392, 'xmNormBars parses mt5-bridge rates');
  ok(xmTraderConfig().symbol === 'XAUUSD', 'default XM gold symbol XAUUSD');
}

console.log('\n== gold scalp/swing prefer XM ==');
{
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const gw = fs.readFileSync(root + 'goldswing.js', 'utf8');
  const st = fs.readFileSync(root + 'startrader.js', 'utf8');
  const xm = fs.readFileSync(root + 'xm-trader.js', 'utf8');
  ok(/getXmGoldCandles/.test(xm), 'xm-trader.js exports getXmGoldCandles');
  ok(/fetchGoldKlines[\s\S]*?getXmGoldCandles/.test(gs), 'goldscalp tries XM first');
  ok(/fetchGoldKlines[\s\S]*?getXmGoldCandles/.test(gw), 'goldswing tries XM first');
  ok(/xm-xauusd/.test(gs) && /xm-xauusd/.test(gw), 'XM source label in gold tabs');
  ok(/getXmGoldCandles/.test(st), 'startrader gold route tries XM');
  ok(/createXmTraderApi/.test(fs.readFileSync(root + 'scripts/server.mjs', 'utf8')), 'server mounts /api/xm');
}

console.log('\n' + pass + ' passed, 0 failed');
