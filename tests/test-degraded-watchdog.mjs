/* HARDGATE — a blind pipeline must say so.
   WHAT THIS COST. For six consecutive fix packs I read alert-state.json,
   saw `setups: { keys: {} }`, and reported "your funnel is empty" — using it
   as evidence about gate thresholds. It was not evidence about gates at all.
   alert-check.mjs gates the setups sweep on ticketResult.ok, which is
   /^done/i.test(stat) over the BRAIN synthesis status. On failure it takes:
       } else if (prevState.setups !== undefined) {
         newState.setups = prevState.setups;   // degraded run: keep, change nothing
       }
   That is the RIGHT behaviour — inventing state from a failed page read would
   be worse — but it is silent. The evidence was in the timestamps all along:
       bookDayHalt.at   2026-08-07T12:15   <- today, so the workflow IS running
       setups.at        2026-08-06T11:36   <- 25h stale
       newsBlackout.at  2026-08-06T11:36   <- same stamp, same gate
   Two legs that need the page read were frozen while legs that do not kept
   updating, on a fifteen-minute cron. Roughly 100 blind runs, none of which
   said anything. (Yes, writing the cron expression literally would have closed
   this comment block — which is its own small lesson about silent failures.)
   An empty result and an absent measurement are different claims, and a state
   file that renders them identically will mislead whoever reads it — including
   me, repeatedly.
   Run: node tests/test-degraded-watchdog.mjs                                 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const src = fs.readFileSync(path.join(ROOT, 'scripts/alert-check.mjs'), 'utf8');
console.log('== the degraded branch is still preserve-not-invent ==');
{
  ok(/newState\.setups = prevState\.setups;\s*\/\* degraded run: keep, change nothing \*\//.test(src),
     'a failed page read still preserves the previous setups state');
  ok(/newState\.newsBlackout = prevState\.newsBlackout;/.test(src),
     'and the previous blackout state');
  ok(!/newState\.setups = \{ keys: \{\} \}/.test(src),
     'it never fabricates an empty result from a failed read');
}
console.log('== but it is no longer silent ==');
{
  ok(/newState\.degraded = \{ count: count, since: since/.test(src), 'the failure count persists to state');
  ok(/lastErr: lastErr/.test(src), 'along with the reason');
  ok(/since: prevDeg\.since \|\| new Date\(\)\.toISOString\(\)/.test(src) || /const since = prevDeg\.since \|\|/.test(src),
     'the FIRST failure timestamp is kept, not overwritten each run');
  ok(/DEGRADED run ' \+ count/.test(src), 'every degraded run logs its count');
  ok(/newState\.degraded = \{ count: 0, since: null, lastErr: null \}/.test(src),
     'a good run resets the counter');
}
console.log('== it alerts, once, and does not spam ==');
{
  ok(/const DEGRADED_ALERT_RUNS = 4;/.test(src), 'alerts after 4 runs = 1 hour blind, not on a single blip');
  ok(/const DEGRADED_REMIND_MS = 6 \* 3600 \* 1000;/.test(src), 'and repeats at most every 6h');
  ok(/count >= DEGRADED_ALERT_RUNS && \(!lastAlertAt \|\| \(Date\.now\(\) - lastAlertAt\) > DEGRADED_REMIND_MS\)/.test(src),
     'both conditions gate the push');
  ok(/alertAt = new Date\(\)\.toISOString\(\)/.test(src), 'the push stamp persists so the throttle survives a restart');
  ok(/HARDGATE pipeline BLIND/.test(src), 'the alert says BLIND, not "no setups"');
  ok(/means UNKNOWN, not none/.test(src), 'and spells out that an empty list is unknown, not empty');
  ok(/Check the newest alert-notify run log/.test(src), 'and points at where the real reason is');
}
console.log('== recovery is reported too ==');
{
  ok(/RECOVERED after/.test(src), 'a recovery is logged');
  ok(/HARDGATE pipeline recovered/.test(src), 'and pushed when the outage was long enough to have alerted');
  ok(/was BLIND for that window/.test(src),
     'the recovery message warns that readings from the window are not evidence');
  ok(/prevState\.degraded && prevState\.degraded\.count/.test(src),
     'recovery only fires if there was actually an outage');
}
console.log('== and the family denominator follows famMax ==');
{
  /* pack 11 added F10 and made the denominator variable; index.html was updated
     and this CI alert body was not, so Telegram kept saying "/9 families". */
  ok(!/\+ '\/9 families'/.test(src), 'no hardcoded /9 left in the CI alert body');
  ok(/snap\.famMax != null \? snap\.famMax : 9/.test(src), 'it reads famMax with a 9 fallback');
}
console.log('\n' + passed + ' passed, 0 failed');
