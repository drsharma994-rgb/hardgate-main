/* HARDGATE — real rates and DXY resolve without a FRED key.

   THE PRODUCTION FAULT. /api/fred answers 503 "fred not configured" on the
   live deployment, because FRED_API_KEY is not set on the host. getUST10Y
   already had a Treasury fallback and survived; getRealYield10Y and
   getDXYOfficial were FRED-only and returned null. Three gates on the gold
   desk — macro-realrate, dxy-inverse, yield-guard — therefore read UNCHECKED
   on every scan, and real rates are gold's primary fundamental driver.

   THE FALLBACKS, both keyless and both already reachable:
     real yield  Treasury's TIPS curve CSV. Same host the nominal fallback
                 has used since v431, so no new origin and no CSP change.
     DXY         ICE DX-Y.NYB via Yahoo, through the allowlisted proxy the
                 other Yahoo legs already use.

   THE HONESTY CONSTRAINT. ICE DXY is NOT FRED's DTWEXBGS — that is the Fed's
   trade-weighted BROAD dollar, this is the six-currency ICE basket. They move
   together and the gate reads only the DIRECTION, which is what makes the
   substitution legitimate; naming the source is what keeps it honest. A
   reader must never be told "Fed broad dollar" while looking at ICE.

   Run: node tests/test-macro-keyless-fallback.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'macro.js'), 'utf8');

console.log('== the pieces exist ==');
ok(/function __treasuryRealCsvUrl\(/.test(SRC), 'the TIPS curve URL builder exists');
ok(/daily_treasury_real_yield_curve/.test(SRC), 'and asks for the REAL yield curve, not the nominal one');
ok(/function __parseTreasuryReal10Y\(/.test(SRC), 'the TIPS parser exists');
ok(/TREASURY_CSV_BASE \+ year/.test(SRC), 'it reuses the existing Treasury host — no new origin, no CSP change');

console.log('\n== FRED still wins when it is configured ==');
{
  /* The fallback must be a fallback. If it ever runs first, a configured desk
     would silently switch to a different index. */
  const real = SRC.slice(SRC.indexOf('async function getRealYield10Y'), SRC.indexOf('async function getGoldMacro'));
  ok(real.indexOf("__fredSeries('DFII10'") < real.indexOf('__treasuryRealCsvUrl'),
     'getRealYield10Y tries FRED before Treasury');
  ok(/source: 'fred'/.test(real) && /source: 'treasury-tips'/.test(real),
     'and labels which one answered');
  const dxy = SRC.slice(SRC.indexOf('async function getDXYOfficial'), SRC.indexOf('async function getRealYield10Y'));
  ok(dxy.indexOf("__fredSeries('DTWEXBGS'") < dxy.indexOf('DX-Y.NYB'),
     'getDXYOfficial tries FRED before Yahoo');
  ok(/source: 'ice-dxy'/.test(dxy),
     'and names ICE rather than claiming to be the Fed broad dollar');
}

console.log('\n== the parser handles the real CSV, header case and all ==');
{
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { addEventListener(){}, createElement: () => ({ style:{} }), head:{ appendChild(){} } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'macro.js' });
  const parse = ctx.__parseTreasuryReal10Y;
  ok(typeof parse === 'function', 'the parser is reachable in the sandbox');

  /* Treasury's real curve says "10 YR"; the nominal one says "10 Yr". A
     case-sensitive match finds nothing and the gate stays dark — silently. */
  const csv = 'Date,"5 YR","7 YR","10 YR","20 YR","30 YR"\n'
            + '08/26/2026,2.06,2.18,2.34,2.71,2.92\n'
            + '08/25/2026,2.04,2.16,2.32,2.70,2.92\n'
            + '08/24/2026,2.09,2.22,2.38,2.75,2.97\n';
  const rows = parse(csv);
  ok(rows.length === 3, 'three rows parsed (' + rows.length + ')');
  ok(rows[0].date === '08/24/2026' && rows[rows.length - 1].date === '08/26/2026',
     'and re-sorted OLDEST-first — Treasury serves newest-first, every consumer here expects the reverse');
  ok(Math.abs(rows[rows.length - 1].value - 2.34) < 1e-9, 'the 10 YR column is the one read');

  const lower = parse(csv.replace('"10 YR"', '"10 Yr"'));
  ok(lower.length === 3, 'header case does not matter');

  console.log('\n== it degrades rather than inventing a rate ==');
  for (const bad of ['', null, undefined, 'not,a,csv', 'Date,"5 YR"\n08/26/2026,2.06\n']){
    const r = parse(bad);
    ok(Array.isArray(r) && r.length === 0,
       JSON.stringify(String(bad).slice(0, 18)) + ' yields no rows rather than a fabricated yield');
  }
  const holes = parse('Date,"10 YR"\n08/26/2026,\n08/25/2026,2.32\n');
  ok(holes.length === 1 && Math.abs(holes[0].value - 2.32) < 1e-9,
     'a blank cell is skipped, not read as zero — a 0.00% real yield would flip the macro read');

  /* the shared trend helper must consume these rows unchanged, so FRED and
     Treasury cannot disagree about what RISING means */
  const t = ctx.__trendFromFredRows(parse(csv), 2);
  ok(t && typeof t.trend20 === 'string', '__trendFromFredRows consumes the rows directly (' + t.trend20 + ')');
}

console.log('\nmacro keyless fallback: ' + passed + ' checks passed');
