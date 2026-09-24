/* HARDGATE — hg-v957: a tab got ONE automatic reload, ever, and then stayed
   pinned to the build it booted with.

   REPORTED FROM THE DESK: "HARDGATE v951 i am still on this" — with hg-v956
   deployed. Five versions of drift on an open tab.

   The service worker was never the problem: sw.js calls skipWaiting() on
   install and clients.claim() on activate, and each version bumps HG_CACHE,
   so the new worker really does install, activate and claim the page. What
   did not happen is the RELOAD, and without it the page keeps executing the
   JavaScript it parsed at first load — so the version badge keeps reading
   the old build-stamp.js while the server serves a newer one.

   THE GUARD WAS A LOCKOUT, NOT A LOOP GUARD:

       if (sessionStorage.getItem('hg_sw_reload')) return;
       sessionStorage.setItem('hg_sw_reload', '1');

   sessionStorage lives for the life of the TAB, across reloads. So the first
   controllerchange in a tab reloaded and wrote the key; every controllerchange
   after that returned early forever. This desk auto-refreshes every ten
   minutes and is built to sit open all day, so the tab is never closed and
   the key is never cleared.

   A loop is a question about ELAPSED TIME — reload, claimed again at once,
   reload again — not about whether a reload ever happened. The key now holds
   the TIMESTAMP of the last automatic reload, so a claim is honoured whenever
   the last one is old enough, and a legacy '1' reads as 1970 and is therefore
   old (an already-pinned tab recovers on its next update instead of staying
   stuck).

   SECOND DEFECT, which would have defeated even a correct reload rule:
   reg.update() ran ONCE, at registration. A tab open for a trading day never
   asked the server again, so no new worker was ever discovered to claim it.

   The real block is LIFTED OUT OF index.html AND EXECUTED here (hg-v951's
   technique) under a fake navigator / sessionStorage / location, so what is
   driven is the shipped code rather than a restatement of it.

   Covers:
     1) the block is locatable and runs
     2) a first update reloads
     3) A SECOND, LATER UPDATE ALSO RELOADS — the defect
     4) a rapid re-claim does NOT reload (the loop it must still stop)
     5) a legacy '1' recovers rather than staying pinned
     6) unreadable/absent storage never suppresses a reload
     7) reg.update() is called periodically, not only once
     8) every seam stays non-fatal
   Run: node tests/test-sw-update-reload.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

/* ---- 1) lift the shipped block ---- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const from = html.indexOf('    const HG_SW_RELOAD_MIN_MS');
assert(from > 0, 'the registration block is locatable in index.html');
const marker = 'if (typeof window !== \'undefined\' && typeof window.addEventListener === \'function\') window.addEventListener(\'load\', __hgRegister);';
const at = html.indexOf(marker, from);
assert(at > from, 'the load-wiring line follows it');
const block = html.slice(from, at);
assert(/controllerchange/.test(block) && /reg\.update\(\)/.test(block),
  'the lifted block carries both the reload rule and the update call');

/* a harness that runs the REAL block against controllable stubs */
function drive(opts){
  opts = opts || {};
  const log = { reloads: 0, updates: 0, intervals: [], stored: Object.assign({}, opts.storage || {}) };
  const listeners = [];
  const reg = { update(){ log.updates++; if (opts.updateThrows) throw new Error('nope'); } };
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Number, String, Object, Array, JSON, Error, isFinite, isNaN, parseInt, parseFloat,
    Date: { now: () => (opts.now === undefined ? 1_700_000_000_000 : opts.now) },
    Promise,
    setInterval: (fn, ms) => { log.intervals.push({ fn, ms }); return log.intervals.length; },
    navigator: {
      serviceWorker: {
        register(){ return { then(cb){ try { cb(reg); } catch(e){ log.threw = String(e); } return { catch(){ } }; } }; },
        addEventListener(ev, fn){ if (ev === 'controllerchange') listeners.push(fn); }
      }
    },
    sessionStorage: opts.storageThrows
      ? { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } }
      : { getItem: (k) => (Object.prototype.hasOwnProperty.call(log.stored, k) ? log.stored[k] : null),
          setItem: (k, v) => { log.stored[k] = String(v); } },
    location: { reload(){ log.reloads++; } }
  };
  vm.createContext(ctx);
  vm.runInContext(block + '\n this.__run = __hgRegister; this.__fire = function(){ for (var i=0;i<' + listeners.length + ';i++){} };',
    ctx, { filename: 'sw-block-lift' });
  ctx.__run();
  log.fire = (whenMs) => {
    if (whenMs !== undefined) ctx.Date.now = () => whenMs;
    for (const fn of listeners.slice()) { try { fn(); } catch(e){ log.listenerThrew = String(e); } }
  };
  log.listeners = listeners;
  log.reg = reg;
  return log;
}

/* ---- 2) a first update reloads ---- */
{
  const d = drive({ now: 1_700_000_000_000 });
  assert(d.listeners.length === 1, 'REACHABILITY: the block registered a controllerchange listener');
  d.fire();
  assert(d.reloads === 1, 'a first controllerchange reloads the page (' + d.reloads + ')');
  assert(d.stored.hg_sw_reload && +d.stored.hg_sw_reload === 1_700_000_000_000,
    'and records WHEN it reloaded, not merely that it did (' + d.stored.hg_sw_reload + ')');
}

/* ---- 3) A SECOND, LATER UPDATE ALSO RELOADS — the reported defect ---- */
{
  /* the old code wrote '1' and returned early forever; a tab that had ever
     reloaded once never reloaded again, which is five versions of drift */
  const T0 = 1_700_000_000_000;
  const d = drive({ now: T0, storage: { hg_sw_reload: String(T0) } });
  /* a genuinely later deploy: an hour on */
  d.fire(T0 + 60 * 60 * 1000);
  assert(d.reloads === 1,
    'THE DEFECT: a LATER update on a tab that already auto-reloaded once DOES reload (' + d.reloads + ')');
  assert(+d.stored.hg_sw_reload === T0 + 60 * 60 * 1000,
    'and the stamp advances to the new reload time');
}

/* ---- 4) a rapid re-claim does NOT reload — the loop it must still stop ---- */
{
  const T0 = 1_700_000_000_000;
  const d = drive({ now: T0, storage: { hg_sw_reload: String(T0) } });
  d.fire(T0 + 1000);            /* one second later — a loop, not a deploy */
  assert(d.reloads === 0,
    'LOOP GUARD INTACT: a re-claim one second after the last reload does NOT reload');
  const d2 = drive({ now: T0, storage: { hg_sw_reload: String(T0) } });
  d2.fire(T0 + 59 * 1000);
  assert(d2.reloads === 0, 'nor 59 seconds after');
  const d3 = drive({ now: T0, storage: { hg_sw_reload: String(T0) } });
  d3.fire(T0 + 61 * 1000);
  assert(d3.reloads === 1, 'but 61 seconds after, it does — the window is a duration, not a latch');
}

/* ---- 5) a legacy '1' recovers rather than staying pinned ---- */
{
  const d = drive({ now: 1_700_000_000_000, storage: { hg_sw_reload: '1' } });
  d.fire();
  assert(d.reloads === 1,
    'LEGACY RECOVERY: a tab carrying the old sentinel \'1\' reloads on its next update instead of staying pinned');
  assert(+d.stored.hg_sw_reload === 1_700_000_000_000, 'and the sentinel is replaced by a real timestamp');
}

/* ---- 6) unreadable or absent storage never suppresses a reload ---- */
{
  const d = drive({});
  d.fire();
  assert(d.reloads === 1, 'no stored value at all -> reload');
  for (const v of ['', 'abc', '-1']){
    const x = drive({ now: 1_700_000_000_000, storage: { hg_sw_reload: v } });
    x.fire();
    assert(x.reloads === 1, 'an unreadable stored value (' + JSON.stringify(v) + ') -> reload, never a silent lockout');
  }
  const blocked = drive({ storageThrows: true });
  blocked.fire();
  assert(blocked.reloads === 1,
    'FAILS OPEN: sessionStorage throwing (private mode, blocked site data) still reloads');
}

/* ---- 7) reg.update() is called periodically, not only once ---- */
{
  const d = drive({});
  assert(d.updates === 1, 'REACHABILITY: reg.update() ran once at registration (' + d.updates + ')');
  assert(d.intervals.length === 1, 'AND a repeating check was scheduled — the tab keeps asking');
  const iv = d.intervals[0];
  assert(iv.ms >= 60 * 1000 && iv.ms <= 60 * 60 * 1000,
    'the interval is a sane cadence (' + (iv.ms / 60000) + ' min)');
  iv.fn(); iv.fn();
  assert(d.updates === 3,
    'each tick asks the server again (' + d.updates + ') — reg.update() only at registration is why no worker was ever discovered');
}

/* ---- 8) every seam stays non-fatal ---- */
{
  const d = drive({ updateThrows: true });
  assert(d.listeners.length === 1, 'a throwing reg.update() does not stop the listener being registered');
  d.fire();
  assert(d.reloads === 1, 'and does not stop the reload');
  assert(!d.threw, 'registration never propagates a throw (' + (d.threw || 'none') + ')');
  const iv = d.intervals[0];
  let boom = false;
  try { iv.fn(); } catch(e){ boom = true; }
  assert(!boom, 'a throwing periodic update is swallowed rather than killing the timer');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : 'PASSED ') + (pass + fail) + ' assertions');
process.exit(fail ? 1 : 0);
