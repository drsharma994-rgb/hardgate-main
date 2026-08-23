/* HARDGATE — a venue's contract code is only meaningful to that venue.

   THIS IS THE FOURTH INSTANCE OF ONE BUG. Each was found separately, each in
   production, each costing real requests that could never succeed:

     v431  desk-scan-universe.js  hgDeskFetchKlines sent B-XRP_USDT to fapi
     v432  binance.js             binanceBasis asked for quarterlies on pairs
                                  that have none (400 -4104)
     v435  binance.js             binanceSpotTakerFlow sent perp symbols to
                                  spot (400 -1121)
     v450  brain.js               fetch4h/fetch1h sent cand.sym raw to
                                  binanceKlines

   The last was measured with ?diag=1 on a cold production load: of 105 total
   failures, 94 were fapi/v1/klines 400s across 23 distinct B-*_USDT codes on
   the 4h and 1h legs — which are exactly those two functions.

   So this file does not test one call site. It asserts the RULE: nothing may
   hand a foreign venue's code to Binance, and every module that can reach
   binanceKlines maps the symbol first. brain.js reuses the mapping
   desk-scan-universe.js already exports rather than growing a second one that
   can drift out of agreement with it.

   Run: node tests/test-venue-symbol-mapping.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------- 1) the shared mapping, exercised through brain's wrapper ---------- */
{
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console, setTimeout, clearTimeout, Promise, Date, Math, JSON, isFinite
  }));
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(root + 'desk-scan-universe.js', 'utf8'), ctx,
    { filename: 'desk-scan-universe.js' });
  assert(typeof ctx.hgDeskBinanceSym === 'function',
    'desk-scan-universe.js still exports hgDeskBinanceSym for others to reuse');

  const map = ctx.hgDeskBinanceSym;
  assert(map({ sym: 'B-ETH_USDT', base: 'ETH', exchange: 'coindcx' }) === 'ETHUSDT',
    'CoinDCX B-ETH_USDT maps to ETHUSDT, never passed through raw');
  assert(map({ sym: 'BTCUSD', base: 'BTC', exchange: 'delta' }) === 'BTCUSDT',
    'Delta BTCUSD maps to BTCUSDT');
  assert(map({ sym: 'SOLUSDT', exchange: 'binance' }) === 'SOLUSDT',
    'a Binance row keeps its own symbol');
  assert(map({ sym: 'B-1000PEPE_USDT', exchange: 'coindcx' }) === '1000PEPEUSDT',
    'numeric-prefixed CoinDCX codes map correctly (B-1000PEPE_USDT)');
}

/* ---------- 2) brain.js maps before it asks Binance ---------- */
{
  const src = fs.readFileSync(root + 'brain.js', 'utf8');

  /* the defect, written out: cand.sym handed straight to binanceKlines */
  const raw = /binanceKlines\(\s*cand\.sym\s*,/g;
  const rawHits = (src.match(raw) || []).length;
  assert(rawHits === 0,
    'brain.js never passes cand.sym straight to binanceKlines (found ' + rawHits + ')');

  assert(/function brainBinanceSym/.test(src),
    'brain.js has a single mapping wrapper rather than inlining it twice');
  assert(/hgDeskBinanceSym/.test(src),
    'and it reuses the shared mapping instead of growing a second one');

  /* both legs must go through it — the 4h and 1h paths are separate functions
     and the diag showed BOTH producing 400s */
  /* count CALL sites only — the first cut also counted the function
     definition and "failed" at 3 */
  const viaWrapper = (src.match(/=\s*brainBinanceSym\(cand\)/g) || []).length;
  assert(viaWrapper === 2,
    'both the 4h and 1h legs map the symbol (found ' + viaWrapper + ')');

  /* the wrapper must be able to REFUSE. A candidate with no usable Binance
     symbol has no Binance data; inventing one is how this family started. */
  const ctx = vm.createContext(Object.assign(Object.create(null), { console, Math, JSON }));
  ctx.G = ctx;
  const m = src.match(/function brainBinanceSym\(cand\)\{[\s\S]*?\n\}/);
  assert(!!m, 'brainBinanceSym is extractable');
  vm.runInContext(m[0], ctx, { filename: 'brainBinanceSym.js' });
  assert(ctx.brainBinanceSym({ sym: 'B-ETH_USDT' }) === null,
    'with the shared helper absent it REFUSES a foreign code rather than guessing');
  assert(ctx.brainBinanceSym({ sym: 'BTCUSDT' }) === 'BTCUSDT',
    'and still allows an obvious Binance shape through');
  assert(ctx.brainBinanceSym(null) === null && ctx.brainBinanceSym({}) === null,
    'nothing to map yields null, so no request is made at all');
}

/* ---------- 3) the rule, swept across every module ---------- */
{
  /* Any module that calls binanceKlines with a bare `.sym` property is
     suspect: that is the exact shape all four bugs took. Known-good callers
     pass a mapped symbol or a literal. */
  /* Strip comments first. The first cut did not, and immediately flagged a
     comment in brain.js that QUOTES the defect while explaining the fix —
     the same trap the connect-src reader hit when a URL inside a note read as
     a permitted host. Prose about a bug is not the bug. */
  const stripComments = function(src){
    return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  };
  const offenders = [];
  for (const f of fs.readdirSync(root).filter(function(f){ return f.endsWith('.js'); })){
    const src = stripComments(fs.readFileSync(root + f, 'utf8'));
    for (const m of src.matchAll(/binanceKlines\(\s*([A-Za-z_$][\w$]*)\.sym\b/g)){
      offenders.push(f + ': binanceKlines(' + m[1] + '.sym …)');
    }
    /* squeeze.js and trendtable.js wrote it as `it.sym || it` — the same
       defect wearing a fallback, so catch that shape explicitly too */
    for (const m of src.matchAll(/binanceKlines\(\s*[A-Za-z_$][\w$]*\.sym\s*\|\|/g)){
      offenders.push(f + ': binanceKlines(x.sym || x …)');
    }
  }
  assert(offenders.length === 0,
    'no module hands a raw .sym to binanceKlines' +
      (offenders.length ? ' — OFFENDERS: ' + offenders.join('; ') : ''));
}

/* ---------- 4) THE BOUNDARY GUARD — because chasing callers failed twice ----------

   The source sweep in section 3 catches binanceKlines(x.sym …). It CANNOT
   catch indirection, and that is exactly how the last one survived:

       cryptoPlan:  klineRows(row.sym)
       klineRows:   binanceKlines(sym, '4h', KLINES_4H)

   88 fapi 400s per cold load, invisible to a regex. So the rule is enforced
   where every caller has to pass, and these assert that guard rather than
   trusting the sweep alone. */
{
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console, setTimeout, clearTimeout, AbortController, Promise, Date, Math, JSON,
    window: {},
    fetch: function(u){
      asked.push(String(u));
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }
  }));
  var asked = [];
  ctx.asked = asked;
  vm.runInContext(fs.readFileSync(root + 'binance.js', 'utf8'), ctx, { filename: 'binance.js' });

  /* count KLINE requests, not all requests: binanceKlines also consults
     exchangeInfo now for the 1000x resolver, and counting that would make
     these assertions measure the wrong thing. */
  const klines = function(){ return asked.filter(function(u){ return /\/klines/.test(u); }).length; };

  const before = klines();
  const r = await ctx.binanceKlines('B-ETH_USDT', '4h', 120);
  assert(Array.isArray(r) && r.length === 0,
    'a CoinDCX code yields [] — the same honest empty every other failure returns');
  assert(klines() === before,
    'and costs ZERO requests: the 400 -1121 is never provoked (got ' + (klines() - before) + ')');

  await ctx.binanceKlines('b-btc_usdt', '4h', 120);
  assert(klines() === before, 'the guard is case-insensitive');

  /* it must be NARROW. Binance really does ship dated contracts with an
     underscore — BTCUSDT_260925 and friends were live when this was written —
     so a blanket underscore ban would silently kill real data. */
  await ctx.binanceKlines('BTCUSDT_260925', '4h', 120);
  assert(klines() === before + 1,
    "Binance's own dated contract BTCUSDT_260925 is NOT blocked");
  await ctx.binanceKlines('BTCUSDT', '4h', 120);
  assert(klines() === before + 2, 'and an ordinary perp symbol is untouched');
}

/* ---------- 5) the indirection that hid from the sweep is closed ---------- */
{
  const src = fs.readFileSync(root + 'brain.js', 'utf8');
  assert(!/klineRows\(\s*row\.sym\s*\)/.test(src),
    'brain.js no longer passes a bare row.sym into klineRows');
  assert(/async function klineRows\(row\)/.test(src),
    'klineRows takes the row so it can map the symbol itself');
  assert(/klineRows[\s\S]{0,400}brainBinanceSym/.test(src),
    'and it maps through the shared helper before asking Binance');
}

/* ---------- 6) the 1000x denomination, and the trap in fixing it ----------

   After the venue codes were gone, the remaining fapi klines 400s on a cold
   load were all one symbol: SHIBUSDT, answered 400 -1121 "Invalid symbol".
   Binance denominates cheap tokens in 1000x contracts — 1000SHIBUSDT — and
   fifteen listings are affected. For all fifteen the bare form does not exist,
   so the rewrite is unambiguous.

   THE TRAP: the obvious implementation checks membership and refuses on
   absence. binancePerpUniverse() filters to contractType PERPETUAL, and
   XAUUSDT is TRADIFI_PERPETUAL — real, tradeable, and absent from that list.
   Refusing on absence would have silently killed gold. These assert the
   rewrite AND that it never refuses. */
{
  const asked = [];
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console, setTimeout, clearTimeout, AbortController, Promise, Date, Math, JSON,
    window: {},
    fetch: function(u){
      const s2 = String(u);
      asked.push(s2);
      if (s2.indexOf('exchangeInfo') >= 0){
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ symbols: [
          { symbol: 'BTCUSDT',      quoteAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING' },
          { symbol: '1000SHIBUSDT', quoteAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING' },
          { symbol: '1000PEPEUSDT', quoteAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING' }
          /* XAUUSDT deliberately absent: it is TRADIFI_PERPETUAL in reality */
        ]}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }
  }));
  vm.runInContext(fs.readFileSync(root + 'binance.js', 'utf8'), ctx, { filename: 'binance.js' });

  const symOf = function(u){ const m = u.match(/symbol=([A-Za-z0-9_]+)/); return m ? m[1] : null; };
  const klineSyms = function(){ return asked.filter(function(u){ return /\/klines/.test(u); }).map(symOf); };

  await ctx.binanceKlines('SHIBUSDT', '4h', 5);
  assert(klineSyms().indexOf('1000SHIBUSDT') >= 0,
    'SHIBUSDT is rewritten to the contract that exists, 1000SHIBUSDT');
  assert(klineSyms().indexOf('SHIBUSDT') < 0,
    'and the non-existent bare form is never requested');

  await ctx.binanceKlines('BTCUSDT', '4h', 5);
  assert(klineSyms().indexOf('BTCUSDT') >= 0, 'a symbol that exists passes through untouched');

  /* THE GOLD TRAP: absent from the PERPETUAL universe, must still be asked */
  await ctx.binanceKlines('XAUUSDT', '4h', 5);
  assert(klineSyms().indexOf('XAUUSDT') >= 0,
    'XAUUSDT is absent from the perp universe and is STILL requested — the resolver never refuses');

  /* already-1000 symbols must not become 10001000... */
  await ctx.binanceKlines('1000PEPEUSDT', '4h', 5);
  assert(klineSyms().indexOf('1000PEPEUSDT') >= 0 && klineSyms().every(function(x){ return !/^10001000/.test(x || ''); }),
    'an already-1000 symbol is left alone, never double-prefixed');
}

console.log(String.fromCharCode(10) + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL VENUE SYMBOL MAPPING TESTS PASSED');
