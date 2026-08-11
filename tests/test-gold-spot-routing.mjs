/* HARDGATE — gold scalp/swing use spot-aligned feeds for StarTrader XAUUSD (not XAUT). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== gold spot vs XAUT routing ==');
{
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const gw = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/fetchGoldKlines[\s\S]*?getXmGoldCandles/.test(gs),
    'goldscalp fetchGoldKlines tries XM MT5 first');
  ok(/fetchGoldKlines[\s\S]*?getXmGoldCandles/.test(gw),
    'goldswing fetchGoldKlines tries XM MT5 first');
  ok(/xm-xauusd/.test(gs), 'goldscalp labels XM XAUUSD source');
  ok(/goldPickSpotAlignedBest/.test(gs) && /goldAnnotateXautBasis/.test(gs),
    'goldscalp spot-aligned MOST PROBABLE picker');
  ok(/goldPurgeStaleConvictions/.test(gs), 'goldscalp purges stale XAUT convictions');
}

console.log('\n' + pass + ' passed, 0 failed');
