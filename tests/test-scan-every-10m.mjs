/* HARDGATE — every tab scan runs every 10 minutes, always.

   The header used to offer OFF / 2m / 3m / 5m / 15m and the global clock
   was 5 minutes. Owner policy: one locked 10-minute sweep of every scan
   in every tab via hardRefreshAll → hgScanAllTabs. Competing 5-minute
   alert-cycle scans would break that, so they share the same clock.

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

console.log('== clock: 10 minutes, always ==');
ok(/const HG_GLOBAL_SCAN_MS = 10 \* 60 \* 1000/.test(HTML), 'HG_GLOBAL_SCAN_MS is 10 minutes');
ok(/const HG_TAB_ALERT_MS = 10 \* 60 \* 1000/.test(HTML), 'tab-alert scan clock is 10 minutes');
ok(/const HG_BEST_ALERT_MS = 10 \* 60 \* 1000/.test(HTML), 'BEST alert clock is 10 minutes');
ok(/HG_ALERT_CYCLE_MS = HG_TAB_ALERT_MS/.test(HTML), 'alert interval aliases the 10-min tab clock');
ok(/HG_ALERTS_AUTO_REFRESH_MS = HG_GLOBAL_SCAN_MS/.test(HTML), 'AUTO refresh uses the global 10-min clock');
ok(/HG_AUTO_REFRESH_HARDCODED_MS = HG_GLOBAL_SCAN_MS/.test(HTML), 'AUTO is hard-coded to the global clock');
ok(!/const HG_GLOBAL_SCAN_MS = 5 \* 60 \* 1000/.test(HTML), '5-minute global scan clock is gone');
ok(!/const HG_TAB_ALERT_MS = 5 \* 60 \* 1000/.test(HTML), '5-minute tab-alert scan clock is gone');

console.log('== header: AUTO 10m locked ==');
ok(/AUTO 10m/.test(HTML), 'header label says AUTO 10m');
ok(/id="autoRef600000"/.test(HTML), '10m segment exists');
ok(/id="autoRef600000"[^>]*class="on"/.test(HTML) || /id="autoRef600000" class="on"/.test(HTML),
   '10m segment is the painted default');
ok(/'600000':600000/.test(HTML) || /"600000":600000/.test(HTML), 'setAutoRefresh knows 600000ms');
ok(/autoRef600000/.test(HTML) && /hgAutoPaint/.test(HTML), 'paint list includes the 10m button');
ok(/locked at 10 minutes/.test(HTML), 'control title says the 10-minute lock');

console.log('== every tab rides the same sweep ==');
ok(/function hgScanAllTabs/.test(HTML) && /function hgCollectAllScanTabIds/.test(HTML),
   'full-desk orchestrator is present');
ok(/hardRefreshAll\(\)[\s\S]{0,800}hgScanAllTabs/.test(HTML),
   'HARD REFRESH / AUTO tick runs hgScanAllTabs');
ok(/async function runTabAlertScans\(\)[\s\S]{0,300}hgScanAllTabs/.test(HTML),
   'alert cycle uses the same all-tab sweep (no 5-min side door)');
ok(/hgCollectAllScanTabIds[\s\S]{0,400}HG_NAV_GROUPS/.test(HTML),
   'sweep enumerates every nav group tab');
ok(/HG_TAB_AUTO_SCAN/.test(HTML) && /goldscalp:/.test(HTML) && /goldswing:/.test(HTML)
   && /swing:/.test(HTML) && /scalp:/.test(HTML) && /best:/.test(HTML) && /edge:/.test(HTML),
   'SWING / SCALP / EDGE / BEST / GOLD SCALP / GOLD SWING are on the sweep');

console.log('== super desks share the 10-min interval ==');
ok(/SCAN_INTERVAL_MS = 10 \* 60 \* 1000/.test(BEST), 'SUPER BEST scans every 10 minutes');
ok(/SCAN_INTERVAL_MS = 10 \* 60 \* 1000/.test(SNIPER), 'SUPER SNIPER scans every 10 minutes');
ok(/SCAN_INTERVAL_MS = 10 \* 60 \* 1000/.test(GOLD), 'SUPER GOLD scans every 10 minutes');
ok(/SCAN_INTERVAL_MS = 10 \* 60 \* 1000/.test(SETUP), 'SUPER SETUP scans every 10 minutes');

console.log('== quiet candle cache outlives the 10-min cycle ==');
{
  const ttl = +(/const HG_CANDLE_TTL_QUIET = (\d+);/.exec(HTML) || [])[1];
  ok(isFinite(ttl) && ttl > 600, 'quiet TTL ' + ttl + 's exceeds the 600s cycle');
}

console.log('== docs match the lock ==');
ok(/10-minute/.test(README) || /10 min/.test(README), 'README names the 10-minute scan cycle');
ok(/10 minutes/.test(AGENTS) || /10-minute/.test(AGENTS), 'AGENTS.md names the 10-minute lock');

console.log('== G1–G7 and crypto execute unchanged ==');
ok(/var CG_G1_SPREAD_ATR = 0\.25;/.test(GATES), 'G1 spread still 0.25×ATR');
ok(/var CG_G5_VZ_MIN = 0\.5;/.test(GATES), 'G5 volZ still 0.5');
ok(/var CG_SWING_ANCHOR_ATR = 1\.5;/.test(GATES), 'ANCHOR still 1.5×ATR');
ok(/var CG_SWING_RR_MIN = 2\.0;/.test(GATES), 'G6 R:R still 2.0');
ok(/var HG_LIVE_TRADING_ENABLED = false;/.test(EXEC), 'browser live trading stays disabled');
ok(/const HG_DAEMON_EXECUTION_ENABLED = false;/.test(APP), 'daemon execute stays disabled');

console.log('\nALL 10-MIN SCAN TESTS PASSED (' + passed + ')');
