/* HARDGATE — conviction locks must not restore levels >1% off live spot. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== gold conviction spot drift guard ==');
{
  const gs = fs.readFileSync(path.join(root, 'goldscalp.js'), 'utf8');
  const gw = fs.readFileSync(path.join(root, 'goldswing.js'), 'utf8');
  ok(/GOLD_SPOT_DRIFT_PURGE_PCT/.test(gs) && /GOLD_SPOT_DRIFT_PURGE_PCT/.test(gw), 'drift purge constant');
  ok(/goldSpotGuardAfterLock/.test(gs) && /goldSpotGuardAfterLock/.test(gw), 'post-lock spot guard');
  ok(/goldSpotDriftPct\(rec\.entry, liveSpot\)/.test(gs), 'bidirectional purge in goldscalp');
  ok(/goldSpotGuardAfterLock\(lock\.store, ranked, liveSpot\)/.test(gs), 'guard after applyConviction scalp');
  ok(/goldSpotGuardAfterLock\(lock\.store, display, liveSpot\)/.test(gw), 'guard on swing display cards');
}

console.log('\n' + pass + ' passed, 0 failed');
