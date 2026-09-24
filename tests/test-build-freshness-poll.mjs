/* HARDGATE — hg-v958: the freshness check had no clock, and every check it
   did make leaked a cache entry.

   REPORTED FROM THE DESK, twice: "v951 STILL ON THIS".

   hg-v957 fixed the service-worker half — a controllerchange lockout that
   gave a tab exactly one automatic reload, ever. It did not fix the other
   half, and there are two update paths, not one.

   build-stamp.js carries a complete, correct staleness detector:
   hgBuildFreshness() fetches its own source cache-busted, parses the version
   the server is serving, compares, paints STALE and reloads once per live
   version. Its reload guard is keyed per version, so it has none of the
   hg-v957 lockout bug. It should have recovered a pinned tab on its own.

   IT HAD NO CLOCK. hgBuildInit ran the check once at DOMContentLoaded — the
   one moment a tab is current by definition — and after that only on
   visibilitychange. This desk is built to sit open all day as the FOREGROUND
   tab (HG_GLOBAL_SCAN_MS re-scans it every ten minutes without ever hiding
   it), so visibilitychange never fires. Measured by driving the real file
   before the fix: ZERO timers installed, ONE fetch at boot, none after.

   Second defect, and the reason the clock could not simply be added: the
   probe is cache-busted with Date.now(), and a cache entry is keyed by the
   FULL url — so every probe wrote its own permanent entry under a key
   nothing can ever read back. Measured: three probes, three distinct
   entries. activate() deletes only caches under a DIFFERENT HG_CACHE name,
   so on a tab pinned to one build the version never bumps and they are
   never cleared — the leak is worst exactly when the desk is stuck.

   Both are driven here by LIFTING THE REAL FILES and executing them (the
   hg-v951 technique), never by grepping for the fix.

   Run: node tests/test-build-freshness-poll.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

const STAMP = fs.readFileSync(path.join(ROOT, 'build-stamp.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

/* ===================================================================
   Harness: run the REAL build-stamp.js under a fake browser whose
   clock, storage, focus and network are all controllable.
   =================================================================== */
function boot(opts){
  opts = opts || {};
  const intervals = [];          /* every setInterval the file installs */
  const docListeners = {};
  const fetched = [];
  const reloads = [];

  const el = opts.activeElement === undefined ? null : opts.activeElement;
  const doc = {
    readyState: opts.readyState || 'loading',
    visibilityState: 'visible',
    activeElement: el,
    addEventListener(name, fn){ (docListeners[name] = docListeners[name] || []).push(fn); },
    getElementById(){ return null; }
  };

  const ctx = {
    document: doc,
    sessionStorage: {
      data: {},
      getItem(k){ return (k in this.data) ? this.data[k] : null; },
      setItem(k, v){ this.data[k] = String(v); }
    },
    location: { reload(){ reloads.push(Date.now()); } },
    navigator: opts.navigator,
    fetch(u, o){
      fetched.push({ url: u, opts: o });
      if (opts.offline) return Promise.reject(new Error('offline'));
      return Promise.resolve({ ok: true, status: 200,
        text: () => Promise.resolve("version: '" + (opts.liveVersion || 'hg-v999') + "'") });
    },
    setInterval(fn, ms){ intervals.push({ fn, ms }); return intervals.length; },
    clearInterval(){}, setTimeout, clearTimeout,
    console: { log(){}, warn(){}, error(){} },
    Promise, Date, Math, JSON, String, Number, Object, Array, RegExp, isFinite, Error
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(STAMP, ctx, { filename: 'build-stamp.js' });
  return { G: ctx, intervals, docListeners, fetched, reloads, doc };
}
const settle = () => new Promise(r => setTimeout(r, 15));

/* =====================================================================
   1. The clock exists, and it is a real interval on the real file
   ===================================================================== */
{
  const env = boot({ readyState: 'complete' });
  await settle();

  ok(typeof env.G.HG_BUILD_POLL_MS === 'number' && env.G.HG_BUILD_POLL_MS > 0,
    'HG_BUILD_POLL_MS is a positive number — got ' + env.G.HG_BUILD_POLL_MS);
  eq(env.intervals.length, 1, 'booting the real file installs exactly one repeating timer');
  eq(env.intervals[0].ms, env.G.HG_BUILD_POLL_MS,
    'the timer runs at HG_BUILD_POLL_MS, not some other hand-typed number');

  /* the interval must be FASTER than the two clocks it backstops, or a
     pinned tab waits on the slower one anyway */
  ok(env.G.HG_BUILD_POLL_MS <= 15 * 60 * 1000,
    'the version poll is not slower than the 15-min service-worker update check');

  /* boot asked once — that is the behaviour that was already there */
  eq(env.fetched.length, 1, 'boot asks the server once');
}

/* =====================================================================
   2. THE DEFECT ITSELF: time passes on an always-visible tab, and the
      tab asks again. Before this pack it asked zero further times.
   ===================================================================== */
{
  const env = boot({ readyState: 'complete' });
  await settle();
  const afterBoot = env.fetched.length;
  eq(afterBoot, 1, 'one check at boot');

  /* eight hours of a foreground trading desk: the tab is NEVER hidden, so
     visibilitychange never fires. Only the clock can save it. */
  const ticks = Math.floor((8 * 60 * 60 * 1000) / env.G.HG_BUILD_POLL_MS);
  ok(ticks > 0, 'the poll fires at least once in an eight-hour session');
  for (let i = 0; i < ticks; i++){ env.intervals[0].fn(); }
  await settle();

  eq(env.fetched.length, afterBoot + ticks,
    'every tick asks the server which build it is serving — ' + ticks + ' times in eight hours');
  ok(env.docListeners.visibilitychange === undefined || env.docListeners.visibilitychange.length === 1,
    'the tab-switch check is still registered, once');
}

/* =====================================================================
   3. The poll is cache-busted and no-store, exactly like the boot check
   ===================================================================== */
{
  const env = boot({ readyState: 'complete' });
  await settle();
  env.fetched.length = 0;
  env.intervals[0].fn();
  await settle();

  eq(env.fetched.length, 1, 'one tick, one request');
  ok(/[?&]fresh=\d+/.test(env.fetched[0].url),
    'the polled request is cache-busted — got ' + env.fetched[0].url);
  eq(env.fetched[0].opts && env.fetched[0].opts.cache, 'no-store',
    'the polled request is no-store — a cached answer would always read "fresh"');
}

/* =====================================================================
   4. End to end: a deploy lands, the clock ticks, the tab reloads.
      This is the whole point of the pack.
   ===================================================================== */
{
  const env = boot({ readyState: 'complete', liveVersion: 'hg-v999' });
  await settle();
  /* boot already saw v999 and reloaded once; clear that and prove the
     POLL path reaches the reload on its own */
  env.reloads.length = 0;
  env.G.sessionStorage.data = {};

  env.intervals[0].fn();
  await settle();
  eq(env.reloads.length, 1, 'a tick that finds a newer build reloads the tab');
  ok(env.G.sessionStorage.data['hg_build_reload_hg-v999'] === '1',
    'the reload is recorded against the live version it saw');

  /* and it does not loop: the next fifty ticks must not reload again */
  for (let i = 0; i < 50; i++) env.intervals[0].fn();
  await settle();
  eq(env.reloads.length, 1, 'fifty further ticks on the same live version do NOT reload again');
}

/* =====================================================================
   5. A server on the SAME build never reloads, however long it polls.
      (If this fails the desk reboots itself every five minutes.)
   ===================================================================== */
{
  const env = boot({ readyState: 'complete' });
  const same = env.G.HG_BUILD.version;
  const env2 = boot({ readyState: 'complete', liveVersion: same });
  await settle();
  env2.reloads.length = 0;
  for (let i = 0; i < 100; i++) env2.intervals[0].fn();
  await settle();
  eq(env2.reloads.length, 0, 'a server on the same build never reloads the tab — 100 ticks, 0 reloads');
  eq(env2.G.HG_BUILD_FRESHNESS && env2.G.HG_BUILD_FRESHNESS.state, 'fresh', 'and it reads fresh');
}

/* =====================================================================
   6. Offline never reads as a new build
   ===================================================================== */
{
  const env = boot({ readyState: 'complete', offline: true });
  await settle();
  env.reloads.length = 0;
  for (let i = 0; i < 20; i++) env.intervals[0].fn();
  await settle();
  eq(env.reloads.length, 0, 'an unreachable server never triggers a reload');
  eq(env.G.HG_BUILD_FRESHNESS.state, 'unknown', 'offline reads unknown, never stale and never fresh');
}

/* =====================================================================
   7. The reload must not land on someone's typing.
      Polling makes the reload ~100x more frequent, so this is new risk
      this pack introduces and must carry.
   ===================================================================== */
{
  const G = boot({}).G;
  const stale = { state: 'stale', live: 'hg-v999' };
  const mkStore = () => ({ data: {}, getItem(k){ return this.data[k] || null; }, setItem(k, v){ this.data[k] = String(v); } });

  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']){
    const store = mkStore();
    let fired = false;
    eq(G.hgBuildMaybeReload(stale, store, () => { fired = true; }, { activeElement: { tagName: tag } }), false,
      'focus in a ' + tag + ' withholds the automatic reload');
    ok(!fired, 'and the reload really did not run for ' + tag);
    eq(store.data['hg_build_reload_hg-v999'], undefined,
      'the key is NOT written for ' + tag + ' — the update is deferred, not lost');
  }

  const ceStore = mkStore();
  eq(G.hgBuildMaybeReload(stale, ceStore, () => {}, { activeElement: { tagName: 'DIV', isContentEditable: true } }), false,
    'a contenteditable element withholds the reload too');

  /* a later attempt, once focus has left the field, must go through —
     this is what proves "deferred" rather than "lost" */
  let late = false;
  eq(G.hgBuildMaybeReload(stale, ceStore, () => { late = true; }, { activeElement: { tagName: 'DIV' } }), true,
    'once focus leaves the field the deferred reload goes through');
  ok(late, 'and it really ran');

  /* FAILS OPEN — an unreadable document must never become a new lockout.

     hgBuildEditingNow(null) falls back to G.document, so asserting it inside
     a harness that HAS a document tests nothing: the no-document branch is
     never reached and a fail-CLOSED mutation of it survives. (It did — the
     mutation pass caught this assertion being vacuous.) The only honest test
     is a context with no document at all. */
  {
    const bare = { console: { log(){}, warn(){}, error(){} },
                   Promise, Date, Math, JSON, String, Number, Object, Array, RegExp, isFinite, Error };
    bare.window = bare; bare.globalThis = bare;
    vm.createContext(bare);
    vm.runInContext(STAMP, bare, { filename: 'build-stamp.js' });
    eq(bare.document, undefined, 'the bare context really has no document — or the next line is vacuous');
    eq(bare.hgBuildEditingNow(null), false, 'with NO document anywhere, nothing is editing');
    const bareStore = { data: {}, getItem(k){ return this.data[k] || null; }, setItem(k, v){ this.data[k] = String(v); } };
    let bareFired = false;
    eq(bare.hgBuildMaybeReload({ state: 'stale', live: 'hg-v999' }, bareStore, () => { bareFired = true; }), true,
      'and a stale build still reloads with no document to consult');
    ok(bareFired, 'the reload really ran in the documentless context');
  }
  eq(G.hgBuildEditingNow({}), false, 'a document with no activeElement is not editing');
  eq(G.hgBuildEditingNow({ get activeElement(){ throw new Error('blocked'); } }), false,
    'a THROWING document is not editing — fails open');
  eq(G.hgBuildEditingNow({ activeElement: { tagName: 'BODY' } }), false, 'body focus is not editing');

  const openStore = mkStore();
  let openFired = false;
  eq(G.hgBuildMaybeReload(stale, openStore, () => { openFired = true; },
      { get activeElement(){ throw new Error('blocked'); } }), true,
    'a throwing document still reloads — an unreadable guard is not a reason to withhold an update');
  ok(openFired, 'and it ran');
}

/* =====================================================================
   8. One page, one clock. Double-init must not stack timers or listeners.
   ===================================================================== */
{
  const env = boot({ readyState: 'complete' });
  await settle();
  eq(env.intervals.length, 1, 'one timer after boot');
  const listenersAfterBoot = (env.docListeners.visibilitychange || []).length;

  eq(env.G.hgBuildInit(), false, 'a second hgBuildInit() reports that it did nothing');
  eq(env.G.hgBuildInit(), false, 'and a third');
  await settle();
  eq(env.intervals.length, 1, 'still exactly one timer — init does not stack clocks');
  eq((env.docListeners.visibilitychange || []).length, listenersAfterBoot,
    'still exactly one tab-switch listener');

  eq(env.G.hgBuildStartPolling(), null, 'hgBuildStartPolling is idempotent once started');
  eq(env.intervals.length, 1, 'and installs no second timer');
}

/* =====================================================================
   9. No setInterval at all (a host that does not provide one) must not
      break the boot check.
   ===================================================================== */
{
  const ctx = {
    document: { readyState: 'complete', visibilityState: 'visible', activeElement: null,
                addEventListener(){}, getElementById(){ return null; } },
    sessionStorage: { data: {}, getItem(){ return null; }, setItem(){} },
    location: { reload(){} },
    fetch(){ return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("version: 'hg-v999'") }); },
    console: { log(){}, warn(){}, error(){} },
    Promise, Date, Math, JSON, String, Number, Object, Array, RegExp, isFinite, Error
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(STAMP, ctx, { filename: 'build-stamp.js' });
  await settle();
  ok(ctx.HG_BUILD_FRESHNESS && ctx.HG_BUILD_FRESHNESS.state === 'stale',
    'with no setInterval the boot check still ran and still detected the new build');
  eq(ctx.hgBuildStartPolling(), null, 'and starting the clock returns null rather than throwing');
}

/* =====================================================================
   10. sw.js — the probe must stop leaking a cache entry per check.
       The REAL fetch handler is driven, not read.
   ===================================================================== */
function bootSw(opts){
  opts = opts || {};
  const puts = [];
  const store = opts.cached || {};
  const cache = {
    add: () => Promise.resolve(),
    put(req){ puts.push(req.url); return Promise.resolve(); },
    match(req){ return Promise.resolve(store[typeof req === 'string' ? req : req.url]); }
  };
  const listeners = {};
  const self_ = {
    addEventListener(name, fn){ listeners[name] = fn; },
    skipWaiting(){ return Promise.resolve(); },
    clients: { claim(){ return Promise.resolve(); } },
    location: { href: 'https://desk/sw.js', origin: 'https://desk' },
    registration: {}
  };
  const netRes = { ok: true, headers: { get(){ return ''; } }, clone(){ return this; } };
  const ctx = {
    self: self_,
    caches: { open: () => Promise.resolve(cache), keys: () => Promise.resolve([]),
              delete: () => Promise.resolve(true),
              match(req){ return cache.match(req); } },
    console: { log(){}, warn(){}, error(){} },
    Promise, Set, Map, Date, Math, JSON, Array, Object, String, Number, isFinite,
    setTimeout, clearTimeout, TypeError, Error, URL,
    fetch: () => opts.offline ? Promise.reject(new Error('offline')) : Promise.resolve(netRes),
    Response: function(){}, Request: function(){}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW, ctx, { filename: 'sw.js' });

  async function hit(url, cacheMode){
    let out = null, err = null;
    await listeners.fetch({ request: { url, method: 'GET', mode: 'no-cors', cache: cacheMode || 'default' },
                            respondWith(p){ out = p; } });
    if (out) { try { out = await out; } catch (e) { err = e; out = null; } }
    await new Promise(r => setTimeout(r, 0));
    return { res: out, err };
  }
  return { hit, puts, netRes };
}

{
  const sw = bootSw();
  /* twelve polls — an hour of the new clock */
  for (let i = 0; i < 12; i++) await sw.hit('https://desk/build-stamp.js?fresh=' + (1000 + i), 'no-store');
  eq(sw.puts.length, 0, 'twelve freshness probes write ZERO cache entries (before: twelve)');

  /* the probe still gets its answer — this must not become an offline check */
  const r = await sw.hit('https://desk/build-stamp.js?fresh=9999', 'no-store');
  ok(r.res === sw.netRes, 'the probe still receives the live network response');

  /* and an ordinary shell script is still cached, or this fix broke offline */
  await sw.hit('https://desk/goldind.js?v=958', 'default');
  eq(sw.puts.length, 1, 'an ordinary versioned shell script is still cached');
  eq(sw.puts[0], 'https://desk/goldind.js?v=958', 'under its own url');
}

/* =====================================================================
   11. THE COST OF THE RULE, named and proved: ./data/*.json are fetched
       no-store too, so they stop being backfilled at runtime. They are
       precached, so offline must still serve them.
   ===================================================================== */
{
  const shellJson = ['./data/param-drift.json', './data/symbol-tier.json', './data/alert-precision.json',
                     './data/desk-tab-params.json', './data/strategy-weights.json',
                     './data/strategy-regime-state.json', './data/fund-config.json'];
  for (const f of shellJson){
    ok(SW.indexOf("'" + f + "'") >= 0, f + ' is in the precache shell, so no-store does not cost it offline');
  }

  /* behavioural: offline, a no-store request for a precached path still
     gets the cached copy — the rule changes the WRITE path only */
  const cachedBody = { ok: true, __cached: true };
  const sw = bootSw({ offline: true, cached: { 'https://desk/data/param-drift.json': cachedBody } });
  const r = await sw.hit('https://desk/data/param-drift.json', 'no-store');
  eq(r.res, cachedBody, 'offline, a precached no-store file is still served from the cache');

  /* but an offline PROBE must not be answered from a cache — a stale
     version read as the live one would say "fresh" and pin the tab */
  const sw2 = bootSw({ offline: true, cached: { 'https://desk/build-stamp.js': cachedBody } });
  const p = await sw2.hit('https://desk/build-stamp.js?fresh=4242', 'no-store');
  ok(p.res !== cachedBody, 'an offline freshness probe is NOT answered with a cached build-stamp.js');
}

/* =====================================================================
   12. The probe's own file must really be precached — DRIVEN, not grepped.

       tests/test-build-stamp.mjs asserts this with
         sw.indexOf("'./build-stamp.js'") >= 0
       which is satisfied by the string appearing inside a COMMENT: commenting
       the shell entry out survives that check. Same shape as the hg-v957
       localhost guard that matched the word in a comment above the code.
       Here install() is driven and the cache is asked what it actually holds.
   ===================================================================== */
{
  const added = [];
  const cache = { add(u){ added.push(u); return Promise.resolve(); },
                  addAll(list){ list.forEach(u => added.push(u)); return Promise.resolve(); },
                  put(){ return Promise.resolve(); }, match(){ return Promise.resolve(undefined); } };
  const listeners = {};
  const self_ = { addEventListener(name, fn){ listeners[name] = fn; },
                  skipWaiting(){ return Promise.resolve(); },
                  clients: { claim(){ return Promise.resolve(); } },
                  location: { href: 'https://desk/sw.js', origin: 'https://desk' }, registration: {} };
  const ctx = { self: self_,
    caches: { open: () => Promise.resolve(cache), keys: () => Promise.resolve([]),
              delete: () => Promise.resolve(true), match: () => Promise.resolve(undefined) },
    console: { log(){}, warn(){}, error(){} },
    Promise, Set, Map, Date, Math, JSON, Array, Object, String, Number, isFinite,
    setTimeout, clearTimeout, TypeError, Error, URL,
    fetch: () => Promise.reject(new Error('offline')), Response: function(){}, Request: function(){} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW, ctx, { filename: 'sw.js' });

  let waited = null;
  await listeners.install({ waitUntil(p){ waited = p; } });
  if (waited) await waited;

  ok(added.indexOf('./build-stamp.js') >= 0,
    'install() really precaches ./build-stamp.js — the freshness probe falls back to it offline');
  ok(added.length > 100, 'and the shell as a whole was precached — ' + added.length + ' files');
}

/* =====================================================================
   13. Drift guard: index.html must still load the stamp first
   ===================================================================== */
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(html.indexOf('build-stamp.js') < html.indexOf('hghost.js'),
    'build-stamp.js still loads before the rest of the app, so the clock starts on every page');
}

console.log('\nOK — ' + n + ' assertions passed (build freshness poll + probe cache leak)');
