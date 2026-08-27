/* HARDGATE — every tab scan runs every 5 minutes, always.

   Owner policy: one locked 5-minute sweep of every scan in every tab via
   hardRefreshAll → hgScanAllTabs. Alert-cycle scans share the same clock.

   G1–G7 and crypto execute stay untouched.

   Run: node tests/test-scan-every-10m.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const HTML = read('index.html');
const EXEC = read('execute.js');
const APP = read('app.js');
const GATES = read('cryptogates.js');
const BEST = read('super-best.js');
const SNIPER = read('super-sniper.js');
const GOLD = read('super-gold.js');
const SETUP = read('supersetup.js');
const README = read('README.md');
const AGENTS = read('AGENTS.md');

console.log('== clock: 5 minutes, always ==');
ok(/const HG_GLOBAL_SCAN_MS = 5 \* 60 \* 1000/.test(HTML), 'HG_GLOBAL_SCAN_MS is 5 minutes');
ok(/const HG_TAB_ALERT_MS = HG_GLOBAL_SCAN_MS/.test(HTML), 'tab-alert scan clock aliases global 5-min');
ok(/const HG_BEST_ALERT_MS = HG_GLOBAL_SCAN_MS/.test(HTML), 'BEST alert clock aliases global 5-min');
ok(/HG_ALERT_CYCLE_MS = HG_TAB_ALERT_MS/.test(HTML), 'alert interval aliases the tab clock');
ok(/HG_ALERTS_AUTO_REFRESH_MS = HG_GLOBAL_SCAN_MS/.test(HTML), 'AUTO refresh uses the global 5-min clock');
ok(/HG_AUTO_REFRESH_HARDCODED_MS = HG_GLOBAL_SCAN_MS/.test(HTML), 'AUTO is hard-coded to the global clock');
ok(!/const HG_GLOBAL_SCAN_MS = 10 \* 60 \* 1000/.test(HTML), '10-minute global scan clock is gone');

console.log('== header: AUTO 5m locked ==');
ok(/AUTO 5m/.test(HTML), 'header label says AUTO 5m');
ok(/id="autoRef300000"/.test(HTML), '5m segment exists');
ok(/id="autoRef300000"[^>]*class="on"/.test(HTML) || /id="autoRef300000" class="on"/.test(HTML),
   '5m segment is the painted default');
ok(/'300000':300000/.test(HTML) || /"300000":300000/.test(HTML), 'setAutoRefresh knows 300000ms');
ok(/autoRef300000/.test(HTML) && /hgAutoPaint/.test(HTML), 'paint list includes the 5m button');
ok(/locked at 5 minutes/.test(HTML), 'control title says the 5-minute lock');

console.log('== every tab rides the same sweep ==');
ok(/function hgScanAllTabs/.test(HTML) && /function hgCollectAllScanTabIds/.test(HTML),
   'full-desk orchestrator is present');
ok(/hardRefreshAll\(\)[\s\S]{0,800}hgScanAllTabs/.test(HTML),
   'HARD REFRESH / AUTO tick runs hgScanAllTabs');
ok(/async function runTabAlertScans\(\)[\s\S]{0,300}hgScanAllTabs/.test(HTML),
   'alert cycle uses the same all-tab sweep');
ok(/hgCollectAllScanTabIds[\s\S]{0,400}HG_NAV_GROUPS/.test(HTML),
   'sweep enumerates every nav group tab');
ok(/HG_TAB_AUTO_SCAN/.test(HTML) && /goldscalp:/.test(HTML) && /goldswing:/.test(HTML)
   && /swing:/.test(HTML) && /scalp:/.test(HTML) && /best:/.test(HTML) && /edge:/.test(HTML),
   'SWING / SCALP / EDGE / BEST / GOLD SCALP / GOLD SWING are on the sweep');

console.log('== super desks share the 5-min interval ==');
ok(/SCAN_INTERVAL_MS = 5 \* 60 \* 1000/.test(BEST), 'SUPER BEST scans every 5 minutes');
ok(/SCAN_INTERVAL_MS = 5 \* 60 \* 1000/.test(SNIPER), 'SUPER SNIPER scans every 5 minutes');
ok(/SCAN_INTERVAL_MS = 5 \* 60 \* 1000/.test(GOLD), 'SUPER GOLD scans every 5 minutes');
ok(/SCAN_INTERVAL_MS = 5 \* 60 \* 1000/.test(SETUP), 'SUPER SETUP scans every 5 minutes');

console.log('== quiet candle cache outlives the 5-min cycle ==');
{
  const ttl = +(/const HG_CANDLE_TTL_QUIET = (\d+);/.exec(HTML) || [])[1];
  ok(isFinite(ttl) && ttl > 300, 'quiet TTL ' + ttl + 's exceeds the 300s cycle');
}

console.log('== docs match the lock ==');
ok(/5-minute/.test(README) || /5 min/.test(README), 'README names the 5-minute scan cycle');
ok(/5 minutes/.test(AGENTS) || /5-minute/.test(AGENTS), 'AGENTS.md names the 5-minute lock');

console.log('== G1–G7 and crypto execute unchanged ==');
ok(/var CG_G1_SPREAD_ATR = 0\.25;/.test(GATES), 'G1 spread still 0.25×ATR');
ok(!/HG_EXECUTE_LIVE\s*=\s*true/.test(EXEC), 'crypto execute not forced live');
ok(!/EXECUTE_LIVE\s*=\s*true/.test(APP), 'daemon execute not forced live');

console.log('\nscan every 5m: ' + passed + ' checks passed');
