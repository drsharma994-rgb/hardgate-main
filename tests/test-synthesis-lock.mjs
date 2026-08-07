/* HARDGATE — the CI was racing itself for a lock it already held.

   THE ROOT CAUSE, finally, and it came out of pack 23's own watchdog. The
   degraded counter it added recorded this in alert-state.json:

       "degraded": { "count": 1, "since": "2026-08-07T14:46:35.791Z",
                     "lastErr": "synthesis already running — wait for done or
                                 reload after ~8 min if stuck" }

   THE SEQUENCE. alert-check.mjs runs two page.evaluate blocks in order:

     1. await runAlertCycle()  — warms BRAIN, taking brain.js's module-level
        __busy lock (brain.js:4943).
     2. the ticket read mounts a fresh BRAIN pane and clicks #brainRun. The
        re-entrancy guard at brain.js:4938 refuses it and sets that pane's own
        #brainStat to "synthesis already running — ...".

   THE BUG. The poll loop waited for /^done|failed/i. The refusal string
   matches NEITHER. So it polled a status that could never change for the full
   360 seconds, burned six minutes of a fifteen-minute job, and returned
   ok:false — which alert-check.mjs treats as a degraded run, preserving stale
   state and writing nothing.

   That is why setups.at froze at 2026-08-06T11:36 while other legs kept
   updating, and why I spent six packs reading "no setups" as a statement about
   gate thresholds.

   THE FIX. The lock does release — brain.js clears it in a finally and has an
   ~8 minute stuck-escape. So the reader keeps taking its turn: re-click on
   each 4s tick while the guard is still refusing, bounded at 40 attempts. Once
   accepted the status leaves "already running" and the normal wait resumes. A
   lock that genuinely never releases still fails, loudly, with the attempt
   count.

   Run: node tests/test-synthesis-lock.mjs                                    */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const src = fs.readFileSync(path.join(ROOT, 'scripts/alert-check.mjs'), 'utf8');
const brain = fs.readFileSync(path.join(ROOT, 'brain.js'), 'utf8');

console.log('== the guard and its exact message still exist in brain.js ==');
{
  ok(/if \(__busy && !brainBusyStuck\(\)\)\{/.test(brain), 'the re-entrancy guard is present');
  ok(/synthesis already running — wait for done or reload/.test(brain),
     'and produces the exact string the CI was choking on');
  ok(/__busy = false; __busySince = 0;/.test(brain), 'the lock IS released, so retrying is the right response');
  ok(/function brainBusyStuck\(\)/.test(brain), 'and a stuck-escape exists as a second release path');
}

console.log('== the reader now retries instead of polling a frozen status ==');
{
  ok(/already running/i.test(src), 'the reader knows the refusal string');
  ok(/retries < MAX_RETRIES/.test(src) && /runBtn\.click\(\);\s*\/\* the warm-up may have released/.test(src),
     'it re-clicks while the guard is still refusing');
  ok(/const MAX_RETRIES = 40;/.test(src), 'bounded at 40 attempts, not an unbounded spin');
  ok(/synthesis lock never released after ' \+ retries \+ ' attempts/.test(src),
     'and a lock that never releases fails loudly with the count');
  ok(/if \(\/\^done\|failed\/i\.test\(stat\)\) break;/.test(src), 'the normal done/failed exit is untouched');
}

console.log('== driving the real loop shape against a simulated lock ==');
{
  /* reproduces brain.js: refuse while the warm-up holds it, accept once free */
  /* releaseAfterMs: 0 = never contended · null = never releases · n = frees after n ms.
     Note 0 must mean "already free" synchronously — setTimeout(fn, 0) still
     fires asynchronously, so the first click would otherwise see a held lock. */
  function pane(releaseAfterMs){
    let busy = releaseAfterMs !== 0, started = false, doneAt = null;
    if (releaseAfterMs !== null && releaseAfterMs > 0) setTimeout(() => { busy = false; }, releaseAfterMs);
    return {
      stat: '',
      click(){
        if (busy){ this.stat = 'synthesis already running — wait for done or reload after ~8 min if stuck'; return; }
        if (!started){ started = true; this.stat = 'scanning…'; doneAt = Date.now() + 60; }
      },
      tick(){ if (doneAt && Date.now() >= doneAt) this.stat = 'done — 42 symbols'; return this.stat; }
    };
  }
  async function loop(p, withFix, budget){
    p.click();
    const t0 = Date.now(); let stat = '', retries = 0; const MAX = 40;
    while (Date.now() - t0 < budget){
      await new Promise(r => setTimeout(r, 20));
      stat = p.tick();
      if (/^done|failed/i.test(stat)) break;
      if (withFix && /already running/i.test(stat) && retries < MAX){ retries++; p.click(); }
    }
    return { ok: /^done/i.test(stat), stat, retries };
  }
  const BUDGET = 1600;

  const without = await loop(pane(300), false, BUDGET);
  ok(without.ok === false, 'WITHOUT the retry the run is degraded even though the lock freed');
  ok(/already running/i.test(without.stat), 'and it ends still staring at the refusal string');
  ok(without.retries === 0, 'having never tried again');

  const with_ = await loop(pane(300), true, BUDGET);
  ok(with_.ok === true, 'WITH the retry the same lock yields a completed synthesis');
  ok(/^done/i.test(with_.stat), 'ending on done');
  ok(with_.retries > 0, 'after ' + with_.retries + ' attempt(s)');

  const stuck = await loop(pane(null), true, BUDGET);
  ok(stuck.ok === false, 'a lock that NEVER releases still fails — the fix does not paper over a real hang');
  ok(stuck.retries === 40, 'and stops at the bound rather than spinning forever');

  const free = await loop(pane(0), true, BUDGET);
  ok(free.ok === true && free.retries === 0, 'an uncontended run needs no retries at all');
}

console.log('\n' + passed + ' passed, 0 failed');
