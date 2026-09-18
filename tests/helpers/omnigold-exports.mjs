/* One place the timezone tests get OMNIGOLD's REAL helpers.

   Three DST tests used to scrape `function hgOgLocalHour(t, tz){ ... }` out of
   omnigold.js with a regex and eval the text in a bare sandbox. That is a copy
   of the code, not the code, and it broke the moment the function grew a
   helper of its own: hg-v844 gave it a per-timezone Intl formatter cache, the
   scraped copy called hgOgTzFormatter, and the sandbox had never heard of it.
   Three green tests went red over a change that altered no behaviour at all.

   So they run the file now and call what it exports. The structural assertions
   in those files still read the source — "hgOgLondonFix must call
   hgOgLondonHour first" is a claim about the source and belongs there — but
   anything that demonstrates a RESULT goes through this.

   Companion to build-version.mjs and csp.mjs: same reason, same shape. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let cached = null;

/** Run omnigold.js (plus the files it leans on) and return its window. */
export function omnigoldWindow(){
  if (cached) return cached;
  const store = Object.create(null);
  const el = () => ({ style: {}, dataset: {}, classList: { add(){}, remove(){}, contains: () => false },
                      appendChild(){}, removeChild(){}, remove(){}, setAttribute(){},
                      getAttribute: () => null, addEventListener(){}, removeEventListener(){},
                      querySelector: () => null, querySelectorAll: () => [],
                      insertAdjacentHTML(){}, innerHTML: '', textContent: '', value: '' });
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, WeakMap, Set, Map,
                Promise, Error, NaN, Infinity, Intl, encodeURIComponent, decodeURIComponent,
                setTimeout: f => { try { f && f(); } catch (e) {} return 0; }, clearTimeout: () => {},
                setInterval: () => 0, clearInterval: () => {},
                document: { createElement: el, createDocumentFragment: el, getElementById: () => null,
                            querySelector: () => null, querySelectorAll: () => [], head: el(), body: el(),
                            documentElement: el(), addEventListener(){}, removeEventListener(){} },
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } },
                fetch: () => Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve({}) }) };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.location = { href: '', search: '', hash: '' };
  ctx.navigator = { userAgent: 'node', onLine: true };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
                   'hg-plan.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade — omnigold.js itself must not */ }
  }
  if (typeof ctx.hgOgLocalHour !== 'function')
    throw new Error('omnigold.js did not export hgOgLocalHour — the helper is looking at the wrong thing');
  cached = ctx;
  return ctx;
}
