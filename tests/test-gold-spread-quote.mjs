/* HARDGATE — half a gold quote is no quote, not a $4,300 spread.

   hgGoldSpreadLock is the institutional filter's spread gate. When it locks,
   hgGoldInstFilter sets cand.dropped = true and the candidate is gone — no
   card, no ticket, nothing downstream. The rule it is written to is stated
   in AGENTS.md and in goldind.js's own header: "Spread lock: live bid/ask
   wider than 250 points / 2.5 pips ($0.25) kills the entry; missing quotes
   fail-open."

   Every guard inside it was a bare isFinite, and isFinite(null) is TRUE.
   Measured by handing it the shapes a quote feed actually produces:

     { spreadUsd: null }       ->  0.000  lock false  unchecked FALSE
     { spread: null }          ->  0.000  lock false  unchecked FALSE
     { bid: null, ask: null }  ->  0.000  lock false  unchecked FALSE

   an absent spread reported as a MEASURED PERFECT ZERO rather than as not
   measured — the same claim-from-nothing pack 858 found in the GOLD PRO
   ledger. And then, because +null is 0 inside the subtraction:

     { bid: 4300, ask: null }  ->  4300.000  LOCK
     { bid: null, ask: 4300 }  ->  4300.000  LOCK

     "SPREAD LOCK - live bid/ask 4300.000 > 0.25 (250 points / 2.5 pips)"

   Half a quote produced a spread equal to the PRICE and hard-dropped the
   candidate. That is a fail-CLOSED on missing data on a gate whose written
   rule is fail-open, and it is the more damaging of the two: the first only
   mislabels a pass, the second deletes every gold setup for as long as the
   feed is one-sided. A book whose asks array is empty does it too, through
   the L2 path, and so does a level object whose price is null.

   Both come from the same coercion, so both close with it. A one-sided
   quote is now no quote; a genuine zero spread is still a genuine zero.

   Run: node tests/test-gold-spread-quote.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, RegExp,
              parseInt, parseFloat, NaN, Infinity, Intl, Promise, Error, TypeError, RangeError,
              Set, Map, WeakMap, Symbol, Function, Boolean };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = [];
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }), addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'goldind.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const lock = src => S.hgGoldSpreadLock(src);

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the gate and the threshold it is written to');
{
  ok(typeof S.hgGoldSpreadLock === 'function', 'hgGoldSpreadLock is reachable');
  ok(typeof S.hgGoldSpreadUsd === 'function', 'and so is the reader underneath it');
  ok(S.HG_GOLD_SPREAD_MAX_USD === 0.25, 'the ceiling is $0.25');
  const src = stripComments(fs.readFileSync(root + 'goldind.js', 'utf8'));
  ok(/cand\.dropped = true/.test(src) && /spr\.lock/.test(src),
     'and a lock is what sets cand.dropped — this gate deletes the candidate, it does not demote it');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. no quote, or half a quote, is not a measurement');
{
  const ABSENT = [
    ['nothing at all', {}],
    ['every field undefined', { spreadUsd: undefined, spread: undefined, spreadPoints: undefined, bid: undefined, ask: undefined }],
    ['spreadUsd null', { spreadUsd: null }],
    ['spread null', { spread: null }],
    ['spreadPoints null', { spreadPoints: null }],
    ['both sides null', { bid: null, ask: null }],
    ['spreadUsd empty string', { spreadUsd: '' }],
    ['spreadUsd is text', { spreadUsd: 'n/a' }],
    ['book with empty arrays', { bids: [], asks: [] }],
    ['null itself', null],
    ['a string', 'wide']
  ];
  for (const [label, src] of ABSENT){
    const r = lock(src);
    ok(!isFinite(r.spread) && r.unchecked === true && r.lock === false,
       `${label}: unchecked, no spread, no lock`
       + (r.lock || isFinite(r.spread) ? `  (got spread ${r.spread}, lock ${r.lock}, unchecked ${r.unchecked})` : ''));
  }
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. half a quote — the one that was deleting setups');
{
  const HALF = [
    ['bid 4300, ask null', { bid: 4300, ask: null }],
    ['bid null, ask 4300', { bid: null, ask: 4300 }],
    ['bid 4300, ask undefined', { bid: 4300, ask: undefined }],
    ['bid 4300, ask empty string', { bid: 4300, ask: '' }],
    ['book: bids present, asks empty', { bids: [[4300, 1]], asks: [] }],
    ['book: a bid level whose price is null', { bids: [{ price: null }], asks: [{ price: 4300 }] }],
    ['book: an ask level whose price is null', { bids: [{ price: 4300 }], asks: [{ price: null }] }]
  ];
  for (const [label, src] of HALF){
    const r = lock(src);
    ok(r.lock === false && !isFinite(r.spread) && r.unchecked === true,
       `${label}: no spread, no lock, unchecked`
       + (r.lock ? `  (LOCKED at ${r.spread} — "${r.reason}")` : ''));
  }
  ok(lock({ bid: 4300, ask: null }).spread !== 4300,
     'and in particular the price is never mistaken for the spread');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. a real quote is read exactly as before');
{
  const REAL = [
    ['spreadUsd 0.20 — inside the ceiling', { spreadUsd: 0.20 }, 0.20, false],
    ['spreadUsd 0.25 — exactly at it, not over', { spreadUsd: 0.25 }, 0.25, false],
    ['spreadUsd 0.60 — wide', { spreadUsd: 0.60 }, 0.60, true],
    ['bid 4300.00 / ask 4300.35', { bid: 4300.00, ask: 4300.35 }, 0.35, true],
    ['bid 4300.00 / ask 4300.18', { bid: 4300.00, ask: 4300.18 }, 0.18, false],
    ['300 points', { spreadPoints: 300 }, 0.30, true],
    ['200 points', { spreadPoints: 200 }, 0.20, false],
    ['spread 0.4 in points units', { spread: 400, spreadUnit: 'points' }, 0.40, true],
    ['a bare number', 0.30, 0.30, true],
    ['numeric strings from a parsed feed', { bid: '4300.00', ask: '4300.35' }, 0.35, true],
    ['an L2 book', { bids: [[4300.00, 2]], asks: [[4300.12, 3]] }, 0.12, false],
    ['an L2 book of level objects', { bids: [{ price: 4300.00 }], asks: [{ price: 4300.80 }] }, 0.80, true]
  ];
  for (const [label, src, want, wantLock] of REAL){
    const r = lock(src);
    ok(Math.abs(r.spread - want) < 1e-9 && r.lock === wantLock && r.unchecked === false,
       `${label}: ${r.spread.toFixed(3)}, lock ${r.lock}`);
  }
  const locks = REAL.filter(x => x[3]).length;
  ok(locks >= 6, `${locks} of these do lock, so section 2 is not passing because the gate is dead`);
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. a genuine zero is a reading');
{
  const z = lock({ spreadUsd: 0 });
  ok(z.spread === 0 && z.unchecked === false && z.lock === false,
     'a locked book quoting 0.000 is measured as 0.000, not thrown away');
  const zb = lock({ bid: 4300, ask: 4300 });
  ok(zb.spread === 0 && zb.unchecked === false,
     'and bid == ask is a real zero too — this is the over-correction to avoid');
  const zp = lock({ spreadPoints: 0 });
  ok(zp.spread === 0 && zp.unchecked === false, 'zero points likewise');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. nothing in the reader still coerces a missing field');
{
  const src = stripComments(fs.readFileSync(root + 'goldind.js', 'utf8'));
  const start = src.indexOf('function hgGoldSpreadUsd');
  ok(start > 0, 'hgGoldSpreadUsd located');
  const body = src.slice(start, src.indexOf('\nfunction ', start + 10));
  ok(body.length > 400, `its body is ${body.length} characters, so the slice is real`);
  /* a name is clean if the expression it was assigned from mentions gdFin
     anywhere — `var bp = (typeof b0 === 'number') ? gdFin(b0) : ...` is the
     sanitised form, not a hole. Checked for emptiness below. */
  const sanitised = new Set(
    [...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*(?<![=!<>])=(?!=)\s*[^;]*?gdFin\(/g)].map(m => m[1]));
  ok(sanitised.size > 0,
     `${sanitised.size} local(s) come straight from gdFin (${[...sanitised].join(', ')}), so the allowance below is not vacuous`);
  const bare = [...body.matchAll(/isFinite\(\s*(?!gdFin)([A-Za-z_$][\w$.]*)\s*\)/g)]
    .map(m => m[1]).filter(n => !sanitised.has(n));
  ok(bare.length === 0,
     'every other isFinite in it reads a value gdFin produced'
     + (bare.length ? (' — these do not: ' + bare.join(', ')) : ''));
  ok(/function gdFin/.test(src), 'and gdFin is what rejects null, undefined and the empty string');
}

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'see FAILs above' : '0 failed'));
