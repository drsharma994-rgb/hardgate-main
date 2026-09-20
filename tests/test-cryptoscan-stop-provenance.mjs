/* HARDGATE — the card head printed a constant, and hid where the stop came from.

   R:R WAS THE SAME NUMBER ON EVERY CARD. cryptoultra prices
   t1 = entry +/- |entry - stop| * RULE.t1R, so |t1 - entry| / |entry - stop|
   is RULE.t1R exactly, for every setup, always. Measured through the real
   engine over 359 plans across five price scales, two venues and a wide
   volatility sweep: ONE distinct value, 1.500000. The tab's own footer already says
   an R:R test "is true for every setup by construction and filters nothing" --
   and the card head went on printing it in the one row a reader scans across
   five hundred contracts.

   WHAT DOES VARY IS WHERE THE STOP CAME FROM.

     stopDist = max(RULE.stopAtr * ATR14, price * rtFrac * RULE.costFloorMult)

   so the fee floor wins exactly when ATR14 / price < (costFloorMult / stopAtr)
   * rtFrac. With the shipped 8 and 1.5 that is 0.800% on Delta (rtFrac 0.0015)
   and 1.067% on CoinDCX and Binance (0.002). A derivation, not a simulation.
   Below those ratios the invalidation level is eight times the round-trip fee
   and has nothing to do with the chart. Over the sweep the floor bound on 39%
   of plans and pushed stops to 15.15x ATR at the extreme (median 1.50x, p90
   3.67x).

   THE DRAG IS EXACT TOO. rtFrac * price / stopDist is 1 / costFloorMult =
   0.125R whenever the floor binds -- every venue, every contract -- and
   strictly less when it does not. Of a 1.5R target that is up to 8.3% paid to
   the exchange before the trade can be right.

   No threshold moves here. The floor, the ladder and the multiplier are the
   engine's. The card stops showing the one number that cannot vary and shows
   the two that do.

   Run: node tests/test-cryptoscan-stop-provenance.mjs */
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
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const SEC = 900;
const RULE = S.HG_CRYPTO_ULTRA_RULE;

let seed = 17;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function tape(n, drift, vol, px0){
  const rows = []; let px = px0;
  const t0 = Math.floor(Date.UTC(2026, 8, 19, 12, 0, 0) / 1000 / SEC) * SEC - n * SEC;
  for (let i = 0; i < n; i++){
    const o = px, c = px * (1 + (rnd() - 0.5 + drift) * vol);
    rows.push({ t: t0 + i * SEC, o: o, c: c, h: Math.max(o, c) * (1 + rnd() * vol * 0.4),
                l: Math.min(o, c) * (1 - rnd() * vol * 0.4), v: 800 + rnd() * 2000 });
    px = c;
  }
  return rows;
}
const to1h = r => { const o = []; for (let i = 0; i + 4 <= r.length; i += 4){ const q = r.slice(i, i + 4);
  o.push({ t: q[0].t, o: q[0].o, c: q[3].c, h: Math.max(...q.map(x => x.h)),
           l: Math.min(...q.map(x => x.l)), v: q.reduce((a, x) => a + x.v, 0) }); } return o; };
const VC = { delta: { venue: 'Delta', rtFrac: 0.0015 }, coindcx: { venue: 'CoinDCX', rtFrac: 0.002 } };

/* ---------------------------------------------------------------- 1
   R:R IS ONE VALUE. Through the real engine, not a re-derivation. */
let sweep = null;
{
  seed = 17;
  const ratios = new Set(), stopAtrs = [], drags = [];
  let n = 0, bound = 0;
  /* 120 tapes rather than the 400 the headline numbers were measured on: the
     R:R claim is a property of the formula and one tape would settle it, and
     the floor-bind rate only has to come out strictly between 0 and 1 here.
     The 359-plan figures in the header stand as the measurement; this is the
     regression guard, and it has to finish fast enough to mutate against. */
  for (let t = 0; t < 120; t++){
    const vol = 0.0015 + rnd() * 0.03;
    const px0 = [0.35, 4.2, 68, 1900, 64000][t % 5];
    const vc = (t % 2) ? VC.delta : VC.coindcx;
    const rows = tape(280, (rnd() - 0.5) * 0.4, vol, px0);
    const res = S.cryptoUltraEngine({ rows15m: rows, rows1h: to1h(rows),
      now: (rows[rows.length - 1].t + SEC * 2) * 1000, venueCost: vc });
    if (!res.ok || !res.plan) continue;
    n++;
    const p = res.plan;
    ratios.add(S.__csRR(p.entry, p.stop, p.t1));
    stopAtrs.push(p.stopAtr);
    drags.push((vc.rtFrac * res.price) / Math.abs(p.entry - p.stop));
    if (res.price * vc.rtFrac * RULE.costFloorMult > RULE.stopAtr * res.atr) bound++;
  }
  const q = (a, f) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(f * (b.length - 1))]; };
  sweep = { n, ratios, stopAtrs, drags, bound, q };

  ok(n > 80, n + ' plans were built across the sweep');
  ok(ratios.size === 1, 'they carry exactly ' + ratios.size + ' distinct R:R value');
  ok([...ratios][0] === RULE.t1R,
     'and it is RULE.t1R (' + [...ratios][0] + '), not anything measured');

  /* it is a constant of the FORMULA, so the sweep can only confirm it */
  const bare = stripComments(fs.readFileSync(root + 'cryptoultra.js', 'utf8'));
  ok(/var t1 = entry \+ dir2 \* risk \* rule\.t1R;/.test(bare),
     'because t1 is defined as risk * t1R, so the ratio cannot be anything else');
}

/* ---------------------------------------------------------------- 2
   THE STOP SOURCE VARIES, and it is what the head now shows. */
{
  ok(sweep.bound > 0 && sweep.bound < sweep.n,
     'the fee floor bound on ' + sweep.bound + ' of ' + sweep.n + ' plans ('
     + (100 * sweep.bound / sweep.n).toFixed(0) + '%) — it is neither always nor never');
  const q = sweep.q;
  ok(Math.abs(q(sweep.stopAtrs, 0.5) - RULE.stopAtr) < 0.01,
     'the median stop is the rule\'s ' + RULE.stopAtr + 'x ATR');
  ok(Math.max(...sweep.stopAtrs) > 5,
     'but the widest is ' + Math.max(...sweep.stopAtrs).toFixed(2)
     + 'x — a stop the chart had no part in');
  ok(q(sweep.stopAtrs, 0.9) > RULE.stopAtr,
     'and the p90 (' + q(sweep.stopAtrs, 0.9).toFixed(2) + 'x) is above it');

  /* the drag ceiling is exact, not empirical */
  const ceiling = 1 / RULE.costFloorMult;
  ok(Math.max(...sweep.drags) <= ceiling + 1e-9,
     'no plan pays more than 1/costFloorMult = ' + ceiling.toFixed(4) + 'R in fees');
  ok(Math.abs(Math.max(...sweep.drags) - ceiling) < 1e-9,
     'and the ones whose floor bound pay exactly that, on every venue');
  ok(Math.min(...sweep.drags) < ceiling * 0.8,
     'while the volatile ones pay as little as ' + Math.min(...sweep.drags).toFixed(4) + 'R');
  ok(ceiling / RULE.t1R > 0.08,
     'at the ceiling that is ' + (100 * ceiling / RULE.t1R).toFixed(1)
     + '% of the target paid to the exchange');
}

/* ---------------------------------------------------------------- 3
   csStopProvenance says which, and the bind threshold is derived. */
{
  const P = S.__csStopProvenance;
  ok(typeof P === 'function', 'csStopProvenance is exported');

  const mk = (over) => Object.assign({
    item: { exchange: 'delta' }, price: 100,
    plan: { entry: 100, stop: 98.5, t1: 102.25, stopAtr: 1.5 }
  }, over || {});

  const volStop = P(mk());
  ok(volStop.byFloor === false && volStop.source === 'volatility',
     'a plan at the rule multiple reads as a volatility stop');
  ok(Math.abs(volStop.atrMult - 1.5) < 1e-9, 'carrying its ATR multiple');

  const feeStop = P(mk({ plan: { entry: 100, stop: 88, t1: 118, stopAtr: 8 } }));
  ok(feeStop.byFloor === true && feeStop.source === 'fee floor',
     'a plan wider than the rule multiple reads as a fee-floor stop');

  /* the threshold is (costFloorMult / stopAtr) * rtFrac, computed not typed */
  const dExp = (RULE.costFloorMult / RULE.stopAtr) * 0.0015;
  const cExp = (RULE.costFloorMult / RULE.stopAtr) * 0.002;
  ok(Math.abs(volStop.bindPct - dExp) < 1e-12,
     'Delta binds below ATR/price of ' + (100 * volStop.bindPct).toFixed(3) + '%');
  const cd = P(mk({ item: { exchange: 'coindcx' } }));
  ok(Math.abs(cd.bindPct - cExp) < 1e-12,
     'CoinDCX below ' + (100 * cd.bindPct).toFixed(3) + '% — a different venue, a different line');
  ok(cd.bindPct > volStop.bindPct, 'the dearer venue takes over sooner');
  ok(!/0\.800%|0\.80%|1\.067%/.test(stripComments(SCAN)),
     'and neither percentage is typed into the code');

  /* the drag follows the venue and the risk, and refuses to invent */
  ok(Math.abs(volStop.dragR - (0.0015 * 100) / 1.5) < 1e-9,
     'drag is rtFrac * price / risk (' + volStop.dragR.toFixed(4) + 'R)');
  ok(cd.dragR > volStop.dragR, 'and the dearer venue drags more on the same plan');
  ok(!isFinite(P(mk({ item: null })).dragR),
     'with no venue on the row the drag is NaN, never a fabricated zero');
  ok(!isFinite(P(mk({ price: null })).dragR), 'nor with no price');
  ok(P(mk({ plan: null })) === null, 'no plan, no provenance');
  ok(P(null) === null, 'and a missing setup does not throw');
}

/* ---------------------------------------------------------------- 4
   THE CARD HEAD. */
{
  const bare = stripComments(SCAN);
  ok(!/R:R ' \+ \(rrv/.test(bare), 'the constant R:R slot is gone from the head');
  ok(!/rrv/.test(bare), 'and the variable that fed it with it');
  ok(/csStopNote\(s\)/.test(bare), 'the head calls csStopNote instead');

  const s1 = { item: { exchange: 'delta' }, price: 100, label: 'BTC', dir: 'long', pct: 0.8,
               count: { decisive: 40, total: 470, kinds: {} }, line: 'x',
               plan: { entry: 100, stop: 98.5, t1: 102.25, stopAtr: 1.5, rr1: 1.5, rr2: 2.5,
                       timeoutBars: 24, orderType: 'BUY' } };
  const h1 = text(S.__csSetupCardHTML(s1, 0));
  ok(/stop 1.50×ATR \(volatility\)/.test(h1), 'a volatility stop says so on the head');
  ok(/fees 0.100R of the 1.5R/.test(h1), 'with the drag it carries');
  ok(!/R:R 1.5/.test(h1), 'and no constant ratio');

  const s2 = JSON.parse(JSON.stringify(s1));
  s2.plan = { entry: 100, stop: 88, t1: 118, stopAtr: 8, rr1: 1.5, rr2: 2.5,
              timeoutBars: 24, orderType: 'BUY' };
  const h2 = text(S.__csSetupCardHTML(s2, 0));
  ok(/stop 8.00×ATR \(fee floor, not volatility\)/.test(h2),
     'a fee-floor stop says THAT on the head — the fact the reader needs');
  ok(/fees 0.012R/.test(h2),
     'and its much smaller drag per R — 0.15 of cost over 12 of risk');

  /* the two heads must actually differ, or the note is decoration */
  ok(h1 !== h2 && /volatility\)/.test(h1) && /fee floor/.test(h2),
     'the same tab, two contracts, two different stories');

  /* a plan the engine could not price says nothing rather than guessing */
  const s3 = JSON.parse(JSON.stringify(s1));
  delete s3.plan.stopAtr;
  ok(S.__csStopNote(s3) === '', 'no ATR multiple, no note');
  ok(S.__csStopNote({}) === '' && S.__csStopNote(null) === '', 'and no setup, no note');

  /* the ladder is still stated once, where a ladder belongs */
  ok(/TP1 \(1\.5R\)/.test(String(S.__csSetupCardHTML(s1, 0))),
     'the plan block still labels the ladder — that is a label, not a measurement');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
