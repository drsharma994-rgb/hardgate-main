/* HARDGATE — CRYPTO SCAN's records could never be settled by the fill model,
   and when they finally could, the model called them unprovable.

   hg-forward.js runs TWO settlements on the same bars. hgFwdSettleOne walks
   from barT and tests stop and target immediately, with nothing requiring
   price to have reached `entry`. hgFwdSettleFill models the order. The file
   says why both exist: the naive walk's error is not random, because one side
   of the plan always sits past the entry — a limit records PHANTOM WINS, a
   stop entry records PHANTOM LOSSES.

   The fill walk needs one field: `mark`, the price when the plan fired.
   hgFwdNormalize has accepted it since the model was written. hgFwdRecordScan
   — the entry point every batch-recording desk uses — never forwarded it. So
   hgFwdOrderType returned null on every one of their records and the
   fill-aware pass stood aside for all of them, silently.

   CRYPTO SCAN has the mark: cryptoultra prices entry = res.price and stamps
   the plan BUY / SELL, so this desk enters AT THE CLOSE — a market order,
   with no fill ambiguity at all. Passing it exposed the second defect.

   A market order has no fill bar. It filled at the close of barT, before the
   first bar of the walk opened. The walk treated that first bar as the fill
   bar anyway, and its rule for "the fill bar itself carrying an exit" — right
   for a resting limit, where the order inside the bar is unknowable — fired on
   trades whose position certainly existed. Measured over 4,000 synthetic 15m
   trades: 7.0% came back 'unprovable' at CRYPTO SCAN's 1.5R ladder, 8.3% at
   1.2R.

   Not neutral. Unprovable rows are resolved at the cautious end (omnigold.js:
   delete unprovable wins, keep unprovable losses), so the mislabel deletes
   real wins and keeps real losses on a population that was never ambiguous.
   Of the 330 at 1.2R, 52 would have been targets.

   Run: node tests/test-cryptoscan-fill-model.mjs */
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
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.fetch = () => Promise.reject(new Error('no network in tests'));
  vm.createContext(s);
  for (const f of ['hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900, BAR = 1000 * SEC;
const rec = over => Object.assign({
  tab: 'CRYPTO SCAN', mechanic: 'VOTE-WEAK@V4', sym: 'X', tf: '15m', dir: 'long',
  entry: 100, stop: 95, t1: 110, mark: 100, barT: BAR, horizonBars: 24,
  rr: 2, risk: 5, state: 'open', r: null, settledT: null, at: BAR
}, over || {});

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the field the fill model needs was never forwarded');
{
  const fwd = stripComments(FWD);
  /* hg-v980 tightened the normaliser to refuse a mark at or below zero; the pin
     matches the rule (a mark is accepted and forwarded) rather than the old text. */
  ok(/mark: (\(isFinite\(fin\(rec\.mark\)\) && fin\(rec\.mark\) > 0\)|isFinite\(fin\(rec\.mark\)\)) \? fin\(rec\.mark\) : undefined/.test(fwd),
     'hgFwdNormalize has always accepted a mark');
  ok(/mark: c\.mark,/.test(fwd), 'and hgFwdRecordScan forwards it now');
  ok(/if \(!type\) return null;/.test(fwd), 'without one, the fill walk returns null and stands aside');

  ok(S.hgFwdOrderType(rec({ mark: undefined })) === null, 'no mark, no order type');
  ok(S.hgFwdSettleFill(rec({ mark: undefined }), [{ t: BAR + SEC, h: 111, l: 99 }]) === null,
     'so the fill walk produces nothing for a record without one');

  /* a caller that passes none still records none — other desks are untouched */
  S.localStorage.removeItem('hg_forward_v1');
  S.hgFwdRecordScan('OTHER', '15m', [{ sym: 'Z', dir: 'long', entry: 100, stop: 95, t1: 110,
                                       mechanic: 'M' }], { horizonBars: 20 });
  const bare = JSON.parse(S.localStorage.getItem('hg_forward_v1'))[0];
  ok(bare.mark === undefined, 'a desk that passes no mark records none');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. CRYPTO SCAN has the mark, and it makes the order a MARKET one');
{
  const scan = stripComments(SCAN);
  ok(/var mk = isFinite\(\+s\.price\) && \+s\.price > 0 \? \+s\.price : undefined;/.test(scan),
     'csFwdRows reads the fire-time price off the setup');
  ok(/mark: mk,/.test(scan), 'and puts it on the row');

  const rows = S.__csFwdRows([{ sym: 'BTCUSDT', dir: 'long', voteTier: 'weak', isHighQuality: false,
                                price: 100, bar: { t: BAR }, plan: { entry: 100, stop: 95, t1: 110 } }]);
  ok(rows[0].mark === 100, 'the row carries it');
  ok(S.hgFwdOrderType(rows[0].mark === undefined ? rec({ mark: undefined })
                      : rec({ mark: rows[0].mark })) === 'BUY',
     'entry === mark, so the log derives a MARKET order');

  const noPrice = S.__csFwdRows([{ sym: 'B', dir: 'long', voteTier: 'weak', isHighQuality: false,
                                   bar: { t: BAR }, plan: { entry: 100, stop: 95, t1: 110 } }]);
  ok(noPrice[0].mark === undefined, 'a setup with no price carries no mark, never a substitute');

  /* it is derived, not assumed: a snapped entry would read as a limit or stop */
  ok(S.hgFwdOrderType(rec({ entry: 98, mark: 100 })) === 'BUY_LIMIT',
     'an entry below the mark would read as a limit');
  ok(S.hgFwdOrderType(rec({ entry: 102, mark: 100 })) === 'BUY_STOP',
     'and above it as a stop — passing the mark does not assert the type, it recovers it');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. a market order has no fill bar');
{
  const fwd = stripComments(FWD);
  ok(/var market = \(type === 'BUY' \|\| type === 'SELL'\);/.test(fwd),
     'the walk knows which orders are market ones');
  ok(/var filled = market,/.test(fwd), 'and starts them filled, because they filled at barT\'s close');

  /* the first bar after entry spans BOTH levels */
  const both = [{ t: BAR, h: 101, l: 99 }, { t: BAR + SEC, h: 111, l: 94 }, { t: BAR + 2 * SEC, h: 101, l: 99 }];
  const m = S.hgFwdSettleFill(rec(), both);
  ok(m.fillState === 'filled', 'a market trade whose first bar spans both levels is FILLED, not unprovable');
  ok(m.stateFill === 'stop' && m.rFill === -1,
     'and takes the both-in-one-bar STOP convention this file already states');

  /* the resting orders keep the unprovable rule, which is right for them */
  const lim = S.hgFwdSettleFill(rec({ entry: 98, mark: 100, stop: 93, t1: 108 }),
                                [{ t: BAR + SEC, h: 109, l: 92 }]);
  ok(lim.orderType === 'BUY_LIMIT' && lim.fillState === 'unprovable',
     'a LIMIT whose fill bar also spans an exit is still unprovable');
  const stp = S.hgFwdSettleFill(rec({ entry: 102, mark: 100, stop: 97, t1: 112 }),
                                [{ t: BAR + SEC, h: 113, l: 96 }]);
  ok(stp.orderType === 'BUY_STOP' && stp.fillState === 'unprovable',
     'and so is a STOP entry — the rule is untouched where it belongs');

  /* a limit that never trades still reports unfilled, not filled */
  const nev = S.hgFwdSettleFill(rec({ entry: 90, mark: 100, stop: 85, t1: 100, horizonBars: 2 }),
                                [{ t: BAR + SEC, h: 101, l: 99 }, { t: BAR + 2 * SEC, h: 101, l: 99 }]);
  ok(nev.fillState === 'unfilled', 'a limit price never reached is unfilled');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. how often it bit, measured');
{
  let seed = 17;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  function sweep(RR){
    let unprov = 0, tot = 0;
    seed = 17;
    for (let k = 0; k < 4000; k++){
      const vol = 0.002 + rnd() * 0.006;
      const rows = []; let px = 100;
      for (let i = 0; i < 40; i++){
        const o = px, c = px * (1 + (rnd() - 0.5) * vol * 2);
        rows.push({ t: (1000 + i) * SEC, o: o, c: c,
                    h: Math.max(o, c) * (1 + rnd() * vol), l: Math.min(o, c) * (1 - rnd() * vol) });
        px = c;
      }
      const bar = rows[0].t, entry = rows[0].c, atr = entry * vol;
      const long = rnd() > 0.5, risk = 1.5 * atr;
      const f = S.hgFwdSettleFill({
        tab: 'T', mechanic: 'M', sym: 'X', tf: '15m', dir: long ? 'long' : 'short',
        entry: entry, mark: entry,
        stop: long ? entry - risk : entry + risk,
        t1: long ? entry + RR * risk : entry - RR * risk,
        barT: bar, horizonBars: 24, rr: RR, risk: risk,
        state: 'open', r: null, settledT: null, at: bar }, rows);
      if (!f) continue;
      tot++;
      if (f.fillState === 'unprovable') unprov++;
    }
    return { tot: tot, unprov: unprov };
  }
  const a = sweep(1.5), b = sweep(1.2);
  ok(a.tot === 4000 && b.tot === 4000, 'the sweep is the 4,000 trades the report measured');
  ok(a.unprov === 0 && b.unprov === 0,
     'no market trade comes back unprovable at either ladder (' + a.unprov + ', ' + b.unprov + ')');

  /* and the numbers the comment quotes are what the OLD rule produced */
  function oldRule(RR){
    let unprov = 0, tot = 0;
    seed = 17;
    for (let k = 0; k < 4000; k++){
      const vol = 0.002 + rnd() * 0.006;
      const rows = []; let px = 100;
      for (let i = 0; i < 40; i++){
        const o = px, c = px * (1 + (rnd() - 0.5) * vol * 2);
        rows.push({ t: (1000 + i) * SEC, o: o, c: c,
                    h: Math.max(o, c) * (1 + rnd() * vol), l: Math.min(o, c) * (1 - rnd() * vol) });
        px = c;
      }
      const bar = rows[0].t, entry = rows[0].c, atr = entry * vol;
      const long = rnd() > 0.5, risk = 1.5 * atr;
      const stop = long ? entry - risk : entry + risk, t1 = long ? entry + RR * risk : entry - RR * risk;
      tot++;
      /* the old walk: the first bar after barT was the fill bar, and an exit
         on it made the row unprovable */
      const first = rows.find(r => r.t > bar);
      if (!first) continue;
      const hitStop = long ? (first.l <= stop) : (first.h >= stop);
      const hitT1 = long ? (first.h >= t1) : (first.l <= t1);
      if (hitStop || hitT1) unprov++;
    }
    return Math.round(1000 * unprov / tot) / 10;
  }
  ok(oldRule(1.5) === 7.0, 'the old rule lost 7.0% of them at the 1.5R ladder');
  ok(oldRule(1.2) === 8.3, 'and 8.3% at 1.2R, which are the figures written into the code');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. end to end, through the recorder the tab actually calls');
{
  S.localStorage.removeItem('hg_forward_v1');
  const rows = S.__csFwdRows([{ sym: 'BTCUSDT', dir: 'long', voteTier: 'weak', isHighQuality: false,
                                price: 100, bar: { t: BAR }, plan: { entry: 100, stop: 95, t1: 110 } }]);
  ok(S.hgFwdRecordScan('CRYPTO SCAN', '15m', rows, { horizonBars: 24 }) === 1, 'the record is written');
  const stored = JSON.parse(S.localStorage.getItem('hg_forward_v1'))[0];
  ok(stored.mark === 100, 'with the mark on it');
  ok(S.hgFwdOrderType(stored) === 'BUY', 'so the log can read its order type');

  const bars = [{ t: BAR, h: 101, l: 99, c: 100 }, { t: BAR + SEC, h: 111, l: 99, c: 110 }];
  const out = S.hgFwdSettle([stored], 'BTCUSDT', '15m', bars).list[0];
  ok(out.state === 't1', 'the naive walk settles it as before — this pack did not touch it');
  ok(out.fillState === 'filled' && out.stateFill === 't1',
     'and the fill-aware walk now settles it too, where it used to produce nothing at all');
  ok(out.rFill === 2, 'with the R the plan promised (' + out.rFill + ')');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
