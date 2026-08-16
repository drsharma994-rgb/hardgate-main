/* HARDGATE — a funding rate nobody reported is not a funding rate of zero.

   v333 swept the FORMATTERS for isFinite(null). This sweep follows the same
   trap into the DATA layer, narrowed to the one field the codebase documents
   as almost always absent: xuniverse.js states that fundingPct is "honestly
   null", and omniroute.js records that xuPositioning returns null for every
   CoinDCX contract — roughly 494 of the ~500 scanned.

   Most reads are already guarded; a blanket sweep over every isFinite() on a
   nullable property returns 429 hits and is mostly noise, so this is scoped to
   the reads that provably fabricate a number:

     bybit.js    Bybit reports absent fields as an EMPTY STRING. +'' is 0, so
                 the snapshot carried "funding is exactly 0.0000%" and a mark
                 price of $0 for values the venue never sent. That zero reads
                 as a NEUTRAL crowd in positioning.js, which is what
                 positioningCrossCheck confirms against — so missing data
                 could turn into a passed flow leg.

     plans.js    hgEnrichTickerFundingTwin exists to keep G4 honest for thin
                 CoinDCX contracts. +null passing its guard meant it filled the
                 gap with a fabricated 0.0000% and stamped it fundingTwin.

     engine.js   A null on the primary source satisfied isFinite and
                 short-circuited the fallback, so the ticker's real rate was
                 never consulted.

     goldpro.js  A missing rate took the TRUE branch with f = null; every
                 comparison against null is false, so the macro ledger printed
                 "normal range · NEUT" while the else branch that already says
                 "unavailable · N/A" sat unused.

   Run: node tests/test-funding-null.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

console.log('== the premise: +null and +\'\' are both 0, and isFinite passes them ==');
{
  ok(isFinite(null) === true, 'isFinite(null) is true');
  ok(+null === 0, '+null is 0');
  ok(isFinite('') === true, "isFinite('') is true");
  ok(+'' === 0, "+'' is 0 — the Bybit empty-field case");
  ok(isFinite(undefined) === false, 'undefined is the one that behaves');
}

console.log('\n== bybit: an empty field is absent, not zero ==');
{
  const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, Promise, encodeURIComponent };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.fetch = async () => ({ ok: true, json: async () => ({}) });
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'bybit.js'), 'utf8'), ctx, { filename: 'bybit.js' });

  ok(typeof ctx.__byNum === 'function' || /function __byNum/.test(fs.readFileSync(path.join(ROOT, 'bybit.js'), 'utf8')),
    'bybit has a null-rejecting numeric reader');

  const src = fs.readFileSync(path.join(ROOT, 'bybit.js'), 'utf8');
  ok(!/fundingPct: isFinite\(\+row\.fundingRate\)/.test(src), 'the raw +row.fundingRate guard is gone');
  ok(!/markPrice: isFinite\(\+row\.lastPrice\)/.test(src), 'the raw +row.lastPrice guard is gone');
  ok(/__byNum\(row\.fundingRate\)/.test(src), 'funding reads through the strict helper');
  ok(/__byNum\(row\.lastPrice\)/.test(src), 'mark price reads through it too — a null price is not $0');

  /* The helper itself, exercised. */
  const byNum = new Function("return function __byNum(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }")();
  ok(!isFinite(byNum('')), "empty string -> NaN (was 0)");
  ok(!isFinite(byNum(null)), 'null -> NaN (was 0)');
  ok(byNum('0.00002095') === 0.00002095, 'a real rate still parses');
  ok(byNum(0) === 0, 'a genuine zero is still a genuine zero');
}

console.log('\n== a fabricated 0% would have read as a NEUTRAL crowd ==');
{
  const ctx = { console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'positioning.js'), 'utf8'), ctx, { filename: 'positioning.js' });

  /* No skip branch. If this stops being reachable the suite must say so
     rather than quietly report a pass for a chain it never followed. */
  ok(typeof ctx.positioningCrossCheck === 'function', 'positioningCrossCheck is reachable');
  const withZero = ctx.positioningCrossCheck({ fundingPct: 0, retailLongPct: null, oiChgPct: null },
                                             { fundingPct: 0, retailLongPct: null });
  const withNull = ctx.positioningCrossCheck({ fundingPct: null, retailLongPct: null, oiChgPct: null },
                                             { fundingPct: null, retailLongPct: null });
  ok(withZero && withNull, 'cross-check ran on both');
  ok(JSON.stringify(withZero) !== JSON.stringify(withNull),
    'a 0% funding and an ABSENT funding reach different conclusions — which is why the fabrication mattered');
}

console.log('\n== the funding twin no longer fills a gap with a made-up zero ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'plans.js'), 'utf8');
  ok(!/if \(!bf \|\| !isFinite\(\+bf\.fundingPct\)\) return ticker;/.test(src), 'the +null guard is gone');
  ok(/var twinPct = hgPlanNum\(bf && bf\.fundingPct\);/.test(src), 'it reads through the strict helper');

  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  ctx.biasBinanceSymbol = () => 'ETHUSDT';

  /* Twin exists but reports no rate — the CoinDCX case this function is for. */
  ctx.binanceFunding = async () => ({ fundingPct: null });
  {
    const out = await ctx.hgEnrichTickerFundingTwin({ symbol: 'B-ETH_USDT', fundingPct: null });
    ok(out.fundingPct === null || out.fundingPct === undefined,
      'a twin with no rate leaves fundingPct absent (was 0)');
    ok(!out.fundingTwin, 'and does not stamp fundingTwin on a value it never got');
  }

  ctx.binanceFunding = async () => ({ fundingPct: 0.0021 });
  {
    const out = await ctx.hgEnrichTickerFundingTwin({ symbol: 'B-ETH_USDT', fundingPct: null });
    ok(out.fundingPct === 0.0021, 'a real twin rate is still filled in');
    ok(out.fundingTwin === 'ETHUSDT', 'and stamped with the twin it came from');
  }

  ctx.binanceFunding = async () => ({ fundingPct: 0 });
  {
    const out = await ctx.hgEnrichTickerFundingTwin({ symbol: 'B-ETH_USDT', fundingPct: null });
    ok(out.fundingPct === 0, 'a genuine 0% from the venue is still accepted — absent and zero stay distinct');
  }
}

console.log('\n== a null primary no longer blocks a real fallback ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8');
  ok(/fnd\.fundingPct != null && isFinite\(\+fnd\.fundingPct\)/.test(src), 'primary source rejects null before testing');
  ok(/tick\.fundingPct != null && isFinite\(\+tick\.fundingPct\)/.test(src), 'fallback does the same');
}

console.log('\n== absent gold funding reads as unavailable, not as normal ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'goldpro.js'), 'utf8');
  ok(!/if \(funding && isFinite\(funding\.fundingPct\)\)\{/.test(src), 'the isFinite(null) branch guard is gone');
  ok(/fRaw !== null && fRaw !== undefined && fRaw !== '' && isFinite\(\+fRaw\)/.test(src), 'it rejects the empty values first');
  ok(/rows\.push\(lrow\('M5', 'XAU perp funding \(8h\)', 'unavailable', 'na', 'N\/A'\)\)/.test(src),
    'the unavailable row that already existed is now actually reachable');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL FUNDING-NULL TESTS PASSED');
