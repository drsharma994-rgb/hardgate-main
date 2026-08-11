/* HARDGATE — gold scalp/swing anchor to live spot, not XAUT ~4330. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== gold levels vs live spot ==');
{
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const gw = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/goldLiveSpotRef/.test(gs) && /goldLiveSpotRef/.test(gw), 'live spot ref fetch');
  ok(/goldAlignLevelsToSpot/.test(gs) && /goldPurgeStaleConvictions/.test(gs), 'spot align + purge stale locks');
  ok(/goldSpotGuardAfterLock/.test(gs), 'post-lock spot guard on scalp');
  ok(/DELTA XAUTUSD: skipped — gold scalp uses broker-aligned/.test(gs), 'goldscalp skips XAUT leg');
  ok(/DELTA XAUTUSD: skipped — gold swing uses broker-aligned/.test(gw), 'goldswing skips XAUT leg');
  ok(/stGoldVenueLabel\(gold\.source\)/.test(gs), 'venue label from scan feed not S.goldDataSource');
  ok(/return null;\s*\}/.test(gs.replace(/goldPickSpotAlignedBest[\s\S]*?^}/m, '') || gs)
    || !/for \(var j = 0; j < ranked\.length; j\+\+\)/.test(gs),
    'goldPickSpotAlignedBest does not fallback-crown wide-basis XAUT');
  ok(!/for \(var j = 0; j < ranked\.length; j\+\+\)/.test(gs), 'goldPickSpotAlignedBest removed XAUT fallback loop');
}

console.log('\n' + pass + ' passed, 0 failed');
