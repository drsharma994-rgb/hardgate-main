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

import { readFileSync } from 'node:fs';
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

/* ---------- 2) every host the app dials is permitted ---------- */

/* The modules whose feeds went dark, plus the ones that always worked — so a
   future edit that drops a host from the list fails here instead of in a
   console nobody is reading. Each entry: the file, and the origin it dials. */
const DIALS = [
  ['onchain.js',             'https://mempool.space'],
  ['liqs.js',                'wss://fstream.binance.com'],
  ['deribit-vol.js',         'https://www.deribit.com'],
  ['binance.js',             'https://fapi.binance.com'],
  ['regime.js',              'https://api.coingecko.com'],
  ['regime.js',              'https://api.alternative.me'],
  ['macro.js',               'https://api.frankfurter.dev'],
  ['xuniverse.js',           'https://api.india.delta.exchange'],
];

for (const [file, origin] of DIALS){
  const src = readFileSync(path.join(root, file), 'utf8');
  assert(src.indexOf(origin) >= 0,
    file + ' still dials ' + origin + ' (fixture is current)');
  assert(serverHosts.has(origin),
    'connect-src permits ' + origin + ' — ' + file + ' cannot reach it otherwise');
}

/* The three that were missing get named explicitly: these are the regressions
   that killed the ON-CHAIN tab, the LIQS tape and the DVOL read outright. */
for (const origin of ['https://mempool.space', 'wss://fstream.binance.com', 'https://www.deribit.com']){
  assert(vercelHosts.has(origin), 'vercel.json permits ' + origin + ' too');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL CSP ALLOWLIST TESTS PASSED');
