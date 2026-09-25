/* HARDGATE — the forward log settles a record on ITS OWN bars.

   THE DEFECT. hgFwdSettleOne counts `seen` in the rows it is HANDED and
   compares that count against rec.horizonBars, which is expressed in the
   RECORD's timeframe. Hand it the wrong bars and the horizon silently
   rescales. hgFwdResolve(sym, null, rows) settles EVERY open record for a
   symbol whatever its timeframe, and four gold desks called it that way with
   whichever candles happened to be in scope:

     goldscalp.js     records 1h,  resolved with rows4h
     golddirection.js records 1h,  resolved with rows4h
     goldswing.js     records 4h,  resolved with rows4h  (fine for itself)
     goldultra.js     records 15m, resolved with rows15m (fine for itself)

   Because the timeframe was null, every one of them also settled the OTHER
   gold desks' records with its own bars. Measured over 600 tapes each:

     1h records walked over 4H bars   5.2% of outcomes flipped, and EVERY
                                      one was a win turned into a loss --
                                      a 4H bar touching stop and target in
                                      the same bar resolves as STOP, because
                                      candles cannot say which printed first.
                                      Hit rate 21.5% -> 16.3%.

     4H records walked over 15m bars  86.3% of outcomes changed. 518 of 600
                                      real wins and losses were thrown away
                                      as premature EXPIRY -- twenty 15-minute
                                      bars is five hours, not the three days
                                      twenty 4-hour bars would have been --
                                      and expired records are excluded from
                                      the hit rate entirely.

   THE FIX. Measure the bars' spacing and refuse a KNOWN mismatch, so the
   caller's mistake is impossible rather than merely discouraged; and give the
   desks hgFwdResolveMulti so each timeframe is walked over its own candles.

   Run: node tests/test-gold-settle-timeframe.mjs */
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

function boot(){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Set, Map, Error };
  s.window = s; s.globalThis = s;
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  vm.createContext(s);
  vm.runInContext(fs.readFileSync(root + 'hg-forward.js', 'utf8'), s, { filename: 'hg-forward.js' });
  s.__store = store;
  return s;
}
const S = boot();
const LS = 'hg_forward_v1';
const NOW = Math.floor(Date.now() / 1000);

/* a rising tape: every record reaches T1 if given enough of its own bars */
function tape(sec, n, t0, step){
  const r = []; let c = 2400;
  for (let i = 0; i < n; i++){
    const o = c; c = o + (step === undefined ? 2 : step);
    r.push({ t: t0 + i * sec, o, h: Math.max(o, c) + 1, l: Math.min(o, c) - 1, c, v: 1 });
  }
  return r;
}
const T0 = Math.floor((NOW - 400 * 14400) / 86400) * 86400;
const r15 = tape(900, 400, T0);
const r1h = tape(3600, 400, T0);
const r4h = tape(14400, 400, T0);

function rec(tf, barT, hz){
  const p = 2402;
  return { tab: 'T', mechanic: 'M', sym: 'XAUUSD', tf, dir: 'long',
           entry: p, stop: p - 6, t1: p + 12, risk: 6, rr: 2,
           barT, horizonBars: hz, state: 'open' };
}
const load = rows => S.localStorage.setItem(LS, JSON.stringify(rows));
const read = () => JSON.parse(S.localStorage.getItem(LS) || '[]');

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the bar spacing is measured from the rows themselves');
{
  ok(typeof S.hgFwdBarSecs === 'function', 'hgFwdBarSecs is reachable');
  ok(S.hgFwdBarSecs(r15) === 900, '15m bars measure 900s');
  ok(S.hgFwdBarSecs(r1h) === 3600, '1h bars measure 3600s');
  ok(S.hgFwdBarSecs(r4h) === 14400, '4h bars measure 14400s');

  /* a weekend gap must not decide the answer — gold has one every week */
  const holed = r1h.slice(0, 50).concat(r1h.slice(100, 150));
  ok(S.hgFwdBarSecs(holed) === 3600,
     'a two-day hole in the middle does not move the median (' + S.hgFwdBarSecs(holed) + ')');
  ok(!isFinite(S.hgFwdBarSecs([{ t: 1 }])), 'one bar measures nothing');
  ok(!isFinite(S.hgFwdBarSecs(null)), 'and neither does nothing at all');

  /* THE FIRST GAP IS NOT THE ANSWER. A gold feed routinely begins just after
     a weekend, so the leading gap is a long one; reading it instead of the
     median would call an hourly feed a daily one and wave every mismatch
     through. */
  const leadGap = [{ t: T0 }].concat(r1h.slice(60, 160).map(b => ({ t: b.t })));
  ok(S.hgFwdBarSecs(leadGap) === 3600,
     'a long gap at the very start does not decide it either (' + S.hgFwdBarSecs(leadGap) + ')');

  /* a duplicated or out-of-order bar contributes no gap at all, rather than a
     zero that would drag the median down */
  const dupes = [];
  for (const b of r1h.slice(0, 40)){ dupes.push({ t: b.t }); dupes.push({ t: b.t }); dupes.push({ t: b.t }); }
  ok(S.hgFwdBarSecs(dupes) === 3600,
     'a feed that repeats bars still measures 3600s, not the zero-length gaps between the copies ('
     + S.hgFwdBarSecs(dupes) + ')');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. a KNOWN mismatch is refused; anything unknown fails open');
{
  ok(S.hgFwdBarsFitRec('4h', 14400) === true, '4h record, 4h bars: fits');
  ok(S.hgFwdBarsFitRec('1h', 3600) === true, '1h record, 1h bars: fits');
  ok(S.hgFwdBarsFitRec('1h', 14400) === false, '1h record, 4H bars: refused');
  ok(S.hgFwdBarsFitRec('4h', 900) === false, '4h record, 15m bars: refused');

  /* FAIL OPEN, deliberately. Refusing what cannot be checked would strand
     records unsettled for ever, which is the louder failure. */
  ok(S.hgFwdBarsFitRec('', 900) === true, 'a record with no timeframe settles as it always did');
  ok(S.hgFwdBarsFitRec('7h', 900) === true, 'and so does one on a timeframe the table does not name');
  ok(S.hgFwdBarsFitRec('4h', NaN) === true, 'unmeasurable bars settle as they always did');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the defect itself: a horizon rescaled by the wrong bars');
{
  /* 1h record, horizon 24 — a day. Walked over 4H bars it would get four. */
  load([rec('1h', r1h[0].t - 1, 24)]);
  S.hgFwdResolve('XAUUSD', null, r4h);
  ok(read()[0].state === 'open',
     'a 1h record is NOT settled by 4H candles — it waits for its own bars');

  S.hgFwdResolve('XAUUSD', null, r1h);
  ok(read()[0].state === 't1', 'and settles the moment those bars arrive');

  /* 4h record, horizon 20 — over three days. Twenty 15m bars is five hours. */
  load([rec('4h', r4h[0].t - 1, 20)]);
  S.hgFwdResolve('XAUUSD', null, r15);
  ok(read()[0].state === 'open',
     'a 4h record is NOT expired by five hours of 15m candles');
  ok(read()[0].state !== 'expired',
     'which is the outcome that used to be thrown away — expired records are excluded from the hit rate');

  S.hgFwdResolve('XAUUSD', null, r4h);
  ok(read()[0].state === 't1', 'given its own bars it resolves honestly');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. one desk can no longer settle another desk\'s records');
{
  /* the shape that actually happened: three gold desks, one open scan */
  load([rec('15m', r15[0].t - 1, 24), rec('1h', r1h[0].t - 1, 24), rec('4h', r4h[0].t - 1, 20)]);
  S.hgFwdResolve('XAUUSD', null, r4h);            /* goldswing's old call */
  const after = read();
  ok(after[0].state === 'open' && after[1].state === 'open',
     'handing 4H candles settles neither the 15m nor the 1h record');
  ok(after[2].state === 't1', 'only the 4h record, which is the one those bars describe');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. hgFwdResolveMulti walks each timeframe over its own candles');
{
  ok(typeof S.hgFwdResolveMulti === 'function', 'the multi-timeframe resolver exists');
  load([rec('15m', r15[0].t - 1, 24), rec('1h', r1h[0].t - 1, 24), rec('4h', r4h[0].t - 1, 20)]);
  const n = S.hgFwdResolveMulti('XAUUSD', { '15m': r15, '1h': r1h, '4h': r4h });
  const out = read();
  ok(n === 3, 'one call settles all three (' + n + ')');
  ok(out.every(r => r.state === 't1'), 'each on the bars it was written on');

  /* absent feeds are skipped, never guessed at */
  load([rec('1h', r1h[0].t - 1, 24), rec('4h', r4h[0].t - 1, 20)]);
  S.hgFwdResolveMulti('XAUUSD', { '1h': r1h, '4h': null });
  const part = read();
  ok(part[0].state === 't1' && part[1].state === 'open',
     'a missing 4h feed leaves the 4h record open rather than settling it on 1h bars');
  ok(S.hgFwdResolveMulti('XAUUSD', null) === 0, 'and no feeds at all settles nothing');

  /* THE EXPLICIT TIMEFRAME IS NOT REDUNDANT WITH THE GUARD. The guard can only
     refuse a timeframe it can measure against TF_SEC; a record on one the
     table does not name fails open by design. Naming the timeframe on the
     call is what still protects it, because r.tf === tf then excludes it. */
  load([{ tab: 'T', mechanic: 'M', sym: 'XAUUSD', tf: '7h', dir: 'long',
          entry: 2402, stop: 2396, t1: 2414, risk: 6, rr: 2,
          barT: r15[0].t - 1, horizonBars: 20, state: 'open' }]);
  S.hgFwdResolveMulti('XAUUSD', { '15m': r15, '1h': r1h, '4h': r4h });
  ok(read()[0].state === 'open',
     'a record on an unnamed timeframe is not settled by bars that are not its own');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. the four gold desks pass their own bars');
{
  const src = f => fs.readFileSync(root + f, 'utf8');
  for (const f of ['goldscalp.js', 'goldswing.js', 'golddirection.js', 'goldultra.js']){
    const s = src(f);
    ok(/hgFwdResolveMulti/.test(s), f + ' resolves per timeframe');
    /* the exact call that caused this — a null timeframe with one row set */
    ok(!/hgFwdResolve\(\s*'XAUUSD'\s*,\s*null\s*,/.test(s),
       f + ' no longer settles every timeframe with one set of candles');
  }
  /* the desks that already did it right are untouched */
  /* hg-v979: matched on the rule (timeframe passed), not the closing paren --
     the call now also names its feed */
  ok(/hgFwdResolve\('XAUUSD', def\.tf, rows[,)]/.test(src('eightypercent.js')),
     'eightypercent.js already passed its timeframe and still does');
  ok(/hgFwdResolve\('XAUUSD', rr\.tf, rr\.rows[,)]/.test(src('newgold.js')),
     'and so does newgold.js');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. nothing else changed');
{
  /* the crypto path passes a matching timeframe and is unaffected */
  load([{ tab: 'CRYPTO SCAN', mechanic: 'M', sym: 'BTCUSDT', tf: '15m', dir: 'long',
          entry: 2402, stop: 2396, t1: 2414, risk: 6, rr: 2,
          barT: r15[0].t - 1, horizonBars: 24, state: 'open' }]);
  S.hgFwdResolve('BTCUSDT', '15m', r15);
  ok(read()[0].state === 't1', 'a 15m crypto record still settles on 15m bars');

  /* a record for another symbol is still never touched */
  load([rec('4h', r4h[0].t - 1, 20)]);
  S.hgFwdResolve('EURUSD', null, r4h);
  ok(read()[0].state === 'open', 'and a different symbol is left alone');

  const fwd = fs.readFileSync(root + 'hg-forward.js', 'utf8');
  ok(/fails OPEN/.test(fwd), 'the file states which way it fails when it cannot check');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
