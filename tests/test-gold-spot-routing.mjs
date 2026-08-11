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
  ok(/fetchStartraderGoldKlines[\s\S]*?fetchGoldKlines\(\)/.test(gs),
    'goldscalp StarTrader route uses fetchGoldKlines (spot proxy)');
  ok(gs.indexOf('getXAUCandles') < 0 || /NOT Delta XAUTUSD/.test(gs),
    'goldscalp documents XAUT vs spot split');
  ok(/goldPickSpotAlignedBest/.test(gs) && /goldAnnotateXautBasis/.test(gs),
    'goldscalp spot-aligned MOST PROBABLE picker');
  ok(/fetchStartraderGoldKlines[\s\S]*?fetchGoldKlines\(\)/.test(gw),
    'goldswing StarTrader route uses fetchGoldKlines');
  ok(/XAUT trades at a discount to spot/.test(gs), 'goldscalp explains XAUT basis in scan log');
  ok(/Delta XAUTUSD<\/b> only — not spot\/StarTrader XAUUSD/.test(gs), 'goldscalp card warns on XAUT basis');
}

console.log('\n' + pass + ' passed, 0 failed');
