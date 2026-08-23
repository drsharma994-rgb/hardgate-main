/* HARDGATE — the connect-src allowlist is ONE list, and it covers every host
   the app actually dials.

   TWO DEFECTS THIS GUARDS.

   1) DRIFT. The allowlist lived as a long inline string in scripts/server.mjs
      and a second hand-maintained copy in vercel.json. They drifted:
      server.mjs gained api.hyperliquid.xyz, api.worldmonitor.app and
      generativelanguage.googleapis.com, vercel.json never did. The same
      commit therefore worked on Render and silently lost three feeds on
      Vercel — silently, because a CSP block is a console line, not a failed
      build. This test compares the two files token for token.

   2) HOSTS THE APP DIALS THAT WERE NEVER LISTED AT ALL. Three whole features
      were dead on every deploy: the ON-CHAIN tab (mempool.space, five legs),
      the LIQS tab (wss://fstream.binance.com, the liquidation tape) and the
      Deribit DVOL implied-vol read. Each one fetched a host that connect-src
      did not permit, so the browser refused the request before it left the
      page — while BRAIN's status line still reported those layers as present.
      This test walks the source files and asserts every host they dial is
      permitted.

   Run: node tests/test-csp-allowlist.mjs */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverConnectSrc, vercelConnectSrc } from './helpers/csp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------- pull connect-src out of both files ---------- */
/* tests/helpers/csp.mjs is the single reader; test-core-fixes.mjs and
   test-supply-chain-and-runtime.mjs ask it the same question. */
const serverHosts = serverConnectSrc();
const vercelHosts = vercelConnectSrc();
assert(serverHosts.size > 10, 'scripts/server.mjs CONNECT_SRC parsed (' + serverHosts.size + ' entries)');
assert(vercelHosts.size > 10, 'vercel.json connect-src parsed (' + vercelHosts.size + ' entries)');

/* ---------- 1) the two files must agree exactly ---------- */
{
  const onlyServer = [...serverHosts].filter(function(h){ return !vercelHosts.has(h); });
  const onlyVercel = [...vercelHosts].filter(function(h){ return !serverHosts.has(h); });
  assert(onlyServer.length === 0,
    'no host is permitted on Render but blocked on Vercel' +
    (onlyServer.length ? ' — vercel.json is missing: ' + onlyServer.join(', ') : ''));
  assert(onlyVercel.length === 0,
    'no host is permitted on Vercel but blocked on Render' +
    (onlyVercel.length ? ' — server.mjs is missing: ' + onlyVercel.join(', ') : ''));
}

/* ---------- 2) EVERY host the app dials is reachable ----------

   THIS USED TO BE A HAND-WRITTEN LIST, AND THAT WAS THE BUG.

   The first cut enumerated eight (file, origin) pairs I had seen fail in a
   console. api.bybit.com was not among them, so bybit.js kept dialling a host
   connect-src did not permit and the whole BYBIT feed stayed dead — measured
   later on the deployed desk at 726 throwing requests per synthesis, 23% of
   everything the desk asked for. A fixture can only ever encode what its
   author already knew.

   So the source is swept instead: every https/wss host literal in every
   module must be reachable — permitted by connect-src, or routed through
   /api/proxy. A new host is unreachable until someone makes a decision about
   it, and that decision has to be recorded HERE, which is the point. */

/* Hosts that appear in source but are never fetched. Each needs a reason,
   because "it is fine" is exactly what was assumed about bybit. */
const NOT_FETCHED = {
  'github.com': 'anchor hrefs only (credits in ai-agent.js / worldmonitor-desk.js) — connect-src does not govern navigation',
  'hardgate-main.onrender.com': "the app own origin in production, already covered by 'self'"
};

{
  const proxySrc = readFileSync(path.join(root, 'api', 'proxy.js'), 'utf8');
  const pi = proxySrc.indexOf('ALLOWED_HOSTS');
  const proxied = new Set([...proxySrc.slice(pi, pi + 1500).matchAll(/'([a-z0-9.-]+[.][a-z]{2,})'/g)].map(m => m[1]));
  assert(proxied.size > 5, 'api/proxy.js ALLOWED_HOSTS parsed (' + proxied.size + ' hosts)');

  const bare = new Set([...serverHosts].map(function(h){ return h.replace(/^(https|wss):[/][/]/, ''); }));

  const dialled = new Map();
  for (const f of readdirSync(root).filter(function(f){ return f.endsWith('.js') && f !== 'sw.js'; })){
    const src = readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(/["'`](?:https|wss):[/][/]([a-z0-9.-]+)/gi)){
      const h = m[1].toLowerCase();
      if (!dialled.has(h)) dialled.set(h, new Set());
      dialled.get(h).add(f);
    }
  }
  assert(dialled.size > 10, 'swept the modules for dialled hosts (' + dialled.size + ' distinct)');

  const unreachable = [];
  for (const [h, files] of dialled){
    if (bare.has(h) || proxied.has(h) || NOT_FETCHED[h]) continue;
    unreachable.push(h + ' (' + [...files].join(', ') + ')');
  }
  assert(unreachable.length === 0,
    'every dialled host is reachable — permitted by connect-src or proxied' +
    (unreachable.length ? '. UNREACHABLE: ' + unreachable.join('; ') : ''));

  /* the exemptions must stay honest: if a host stops appearing at all, the
     excuse for it should not linger and quietly cover a future re-add */
  for (const h of Object.keys(NOT_FETCHED)){
    assert(dialled.has(h), 'exemption for ' + h + ' still describes a host that appears in source');
  }

  /* the four regressions this file was born from, named so they cannot
     silently come back */
  for (const origin of ['https://mempool.space', 'wss://fstream.binance.com',
                        'https://www.deribit.com', 'https://api.bybit.com']){
    assert(serverHosts.has(origin), 'connect-src permits ' + origin);
    assert(vercelHosts.has(origin), 'vercel.json permits ' + origin + ' too');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL CSP ALLOWLIST TESTS PASSED');
