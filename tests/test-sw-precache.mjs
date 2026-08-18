/* HARDGATE — one missing file emptied the entire offline cache, silently.

   The service worker precaches a 125-file app shell, and the comment above
   that list says:

     "A single missing file must never fail install — runtime network-first
      backfills."

   The code did the opposite. cache.addAll() is ATOMIC by specification: if any
   one request fails, the returned promise rejects and NOTHING is written to
   the cache. So a single renamed, mistyped or deleted entry among 125 left
   the offline shell completely empty — and the .catch() around it swallowed
   the rejection, so install completed looking perfectly healthy.

   Nothing would surface that. The app works online, and the failure only
   shows the first time someone opens it without a connection.

   Each file is added on its own now, so one 404 costs exactly one file. The
   outcome is recorded on self.__hgPrecache so a half-cached shell can be seen
   instead of guessed at.

   Run: node tests/test-sw-precache.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

/* Run sw.js in a stub worker scope, capturing its listeners so install can be
   driven directly. missingUrls decide which cache.add() calls reject. */
function boot(missingUrls){
  const missing = new Set(missingUrls || []);
  const added = [];
  const cache = {
    add(u){
      if (missing.has(u)) return Promise.reject(new TypeError('Request failed'));
      added.push(u);
      return Promise.resolve();
    },
    addAll(list){
      /* Faithful to the spec: atomic. Present so a regression back to addAll
         is caught by behaviour, not just by reading the source. */
      for (const u of list) if (missing.has(u)) return Promise.reject(new TypeError('Request failed'));
      list.forEach(u => added.push(u));
      return Promise.resolve();
    },
    put(){ return Promise.resolve(); },
    match(){ return Promise.resolve(undefined); }
  };
  const listeners = {};
  const self_ = {
    addEventListener(name, fn){ listeners[name] = fn; },
    skipWaiting(){ return Promise.resolve(); },
    clients: { claim(){ return Promise.resolve(); } },
    location: { href: 'http://localhost/sw.js' },
    registration: {}
  };
  const ctx = { self: self_, caches: { open: () => Promise.resolve(cache), keys: () => Promise.resolve([]),
                  delete: () => Promise.resolve(true), match: () => Promise.resolve(undefined) },
                console: { log(){}, warn(){}, error(){} }, Promise, Set, Map, Date, Math, JSON,
                Array, Object, String, Number, isFinite, setTimeout, clearTimeout, TypeError, Error,
                fetch: () => Promise.reject(new Error('offline')), URL, Response: function(){}, Request: function(){} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW, ctx, { filename: 'sw.js' });
  return { self_, listeners, added, cache };
}

/* Drive the install listener and wait for whatever it passed to waitUntil. */
async function install(env){
  let waited = null;
  await env.listeners.install({ waitUntil(p){ waited = p; } });
  if (waited) await waited;
}

console.log('== the shell list is real ==');
{
  const m = /const HG_SHELL = \[([\s\S]*?)\];/.exec(SW);
  ok(!!m, 'HG_SHELL was found');
  const urls = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  ok(urls.length > 100, 'it precaches ' + urls.length + ' entries');
  /* Every local entry must exist on disk, or it is a guaranteed 404 on every
     install for every user. */
  const missing = urls.filter(u => {
    if (!/\.(js|css|html|svg|webmanifest)$/.test(u)) return false;
    return !fs.existsSync(path.join(ROOT, u.replace(/^\.\//, '')));
  });
  ok(missing.length === 0, 'every precached file exists on disk'
    + (missing.length ? ' — missing: ' + missing.join(', ') : ''));
}

console.log('\n== THE DEFECT: one missing file used to empty the whole cache ==');
{
  /* Prove the old behaviour is gone by proving the new one holds: with a
     single unreachable entry, everything else must still be cached. */
  const env = boot(['./mobile.css']);
  await install(env);
  ok(env.added.length > 100, 'the shell is cached despite one failure (' + env.added.length + ' files)');
  ok(env.added.indexOf('./mobile.css') < 0, 'the unreachable file is not in the cache');
  ok(env.added.indexOf('./index.html') >= 0, 'and index.html — which addAll would have discarded — is');
  ok(env.added.indexOf('./omniroute.js') >= 0, 'as is every other module');
}

console.log('\n== the outcome is recorded, not guessed at ==');
{
  const env = boot(['./mobile.css', './annunciator.css']);
  await install(env);
  const p = env.self_.__hgPrecache;
  ok(!!p, 'the precache result is published on self.__hgPrecache');
  ok(p.failed.length === 2, 'it names how many failed (' + p.failed.length + ')');
  ok(p.failed.indexOf('./mobile.css') >= 0, 'and which ones');
  ok(p.cached === p.total - 2, 'and how many were cached (' + p.cached + ' of ' + p.total + ')');
  ok(p.cached > 100, 'a half-cached shell is visible rather than silent');
}

console.log('\n== a clean install caches everything ==');
{
  const env = boot([]);
  await install(env);
  const p = env.self_.__hgPrecache;
  ok(p.failed.length === 0, 'nothing failed');
  ok(p.cached === p.total, 'every file cached (' + p.cached + '/' + p.total + ')');
}

console.log('\n== install still never fails, whatever happens ==');
{
  /* The whole point of the .catch() was that install must complete. That must
     remain true now that the failure mode has changed. */
  const shellLen = (SW.match(/'\.\/[^']+'/g) || []).length;
  const env = boot(Array.from({ length: shellLen }, (_, i) => '') .concat(
    [...(/const HG_SHELL = \[([\s\S]*?)\];/.exec(SW)[1]).matchAll(/'([^']+)'/g)].map(x => x[1])));
  let threw = null;
  try { await install(env); } catch (e){ threw = e; }
  ok(!threw, 'install completes even when EVERY file 404s');
  ok(env.self_.__hgPrecache.cached === 0, 'with an honest zero recorded (' + env.self_.__hgPrecache.cached + ')');
  ok(env.self_.__hgPrecache.failed.length > 100, 'and every failure listed');
}

console.log('\n== the atomic call is gone ==');
{
  ok(!/c\.addAll\(HG_SHELL\)/.test(SW), 'install no longer calls addAll on the shell');
  ok(/function hgSwPrecache\(cache, urls\)/.test(SW), 'it uses a per-file precache');
  ok(/cache\.add\(u\)\.then\(/.test(SW), 'adding each entry on its own');
  ok(/ATOMIC by specification/.test(SW), 'and records why, so it is not undone by a tidy-up');
}

console.log('\n== degenerate input does not break install ==');
{
  /* hgSwPrecache is internal, so it is exercised through install; what must
     always hold is that the published result is a complete shape. */
  const env = boot([]);
  await install(env);
  const p = env.self_.__hgPrecache;
  ok(typeof p.cached === 'number' && typeof p.total === 'number' && Array.isArray(p.failed),
     'the published result always has cached, total and failed');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL SERVICE WORKER PRECACHE TESTS PASSED');
