/* HARDGATE — CRYPTO SCAN's "order flow" layer is candle arithmetic.

   order-flow.js declared itself "Independent of price technicals — detects
   whale accumulation, capitulation", and that claim is the stated reason
   CRYPTO SCAN gives layer 2 35% of its confidence plus a +15% bonus whenever
   it agrees with layer 1.

   There is no order book, trade tape, liquidation feed or on-chain data
   anywhere in the file. hgBidAskImbalance counts a green candle's whole volume
   as buying and a red candle's as selling. hgVWAPDivergence is
   (close - vwap) / vwap. hgSweepPattern reads candle bodies, wicks and a
   volume ratio. All three are price technicals over the same OHLCV bars that
   layer 1 votes on.

   Measured against the real engines — 60 synthetic tapes swept across drift
   and volatility, the same candles handed to cryptoUltraEngine and to
   hgOrderFlowScore, of which 55 produce a layer-1 direction:

     correlation(layer-1 direction, layer-2 score)   0.956
     layer 2 agreed with layer 1's direction          52 / 55   (95%)

   So the decorrelating layer says what layer 1 already said 95% of the time,
   and each agreement pays the bonus for one price read twice. The weights and
   the bonus are NOT changed — that is calibration, and the desk's call. What
   changed is that the reads are named for what they are, so the vote table the
   tab invites you to audit by eye stops printing "Bid-Ask Imbalance" over a
   number that has never seen a bid or an ask.

   One arithmetic bug ships with it. hgSweepPattern's volume baseline summed 19
   bars and divided by 20, so avgVol was 5% low on every call, volRatio 5.3%
   high, and the 1.5x gate written two lines below it behaved as 1.425x. Over
   144,000 rolling windows the gate passed 11.97% of the time as coded against
   7.45% with the divisor matched to the count: 37.8% of the sweeps it reported
   were under its own threshold.

   Run: node tests/test-cryptoscan-order-flow-proxy.mjs */
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
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js', 'cryptoultra.js',
                   'cryptoscan-voting-v3.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const FLOW = fs.readFileSync(root + 'order-flow.js', 'utf8');
const VOTE = fs.readFileSync(root + 'cryptoscan-voting-v3.js', 'utf8');
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');

let seed = 11;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function tape(n, drift, vol, px0){
  const rows = []; let px = px0; const t0 = Date.UTC(2026, 8, 19, 12, 0, 0) - n * 900000;
  for (let i = 0; i < n; i++){
    const o = px, c = px * (1 + (rnd() - 0.5 + drift) * vol);
    rows.push({ t: (t0 + i * 900000) / 1000 | 0, o: o, c: c,
                h: Math.max(o, c) * (1 + rnd() * vol * 0.4),
                l: Math.min(o, c) * (1 - rnd() * vol * 0.4), v: 800 + rnd() * 2000 });
    px = c;
  }
  return rows;
}
const to1h = r => { const o = []; for (let i = 0; i + 4 <= r.length; i += 4){ const q = r.slice(i, i + 4);
  o.push({ t: q[0].t, o: q[0].o, c: q[3].c, h: Math.max(...q.map(x => x.h)),
           l: Math.min(...q.map(x => x.l)), v: q.reduce((a, x) => a + x.v, 0) }); } return o; };

/* ---------------------------------------------------------------- 1 */
console.log('\n1. what the file can actually see');
{
  const src = stripComments(FLOW);
  ok(typeof S.hgOrderFlowScore === 'function', 'hgOrderFlowScore is reachable');
  for (const word of ['orderbook', 'order_book', 'depth', 'bids', 'asks', 'trades', 'liquidations']){
    ok(!new RegExp('\\b' + word + '\\b', 'i').test(src),
       'no ' + word + ' anywhere in the module');
  }
  ok(!/fetch\(|XMLHttpRequest|\/api\//.test(src), 'and it makes no network call of any kind');
  ok(/close > open\) buyVolume \+= vol/.test(src),
     'the "bid-ask imbalance" is a green candle counted as buying');
  ok(/divergence = \(currentPrice - vwap\) \/ vwap/.test(src),
     'the VWAP read is price against its own volume-weighted average');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. it is not independent of layer 1, and here is the number');
{
  const pairs = []; let agree = 0, disagree = 0, neutral = 0;
  for (const d of [-0.30, -0.24, -0.18, -0.12, -0.08, -0.04, 0.04, 0.08, 0.12, 0.18, 0.24, 0.30]){
    for (const v of [0.004, 0.006, 0.008, 0.011, 0.014]){
      const r = tape(340, d, v, 100), r1 = to1h(r);
      let res = null;
      try{ res = S.cryptoUltraEngine({ rows15m: r, rows1h: r1, now: Date.now(),
                                       venueCost: { venue: 'Delta', rtFrac: 0.0015 },
                                       }); }catch(e){ }
      if (!res || !res.dir) continue;
      const of_ = S.hgOrderFlowScore('X', r, r1);
      pairs.push([res.dir === 'long' ? 1 : -1, of_.score]);
      if (of_.direction === 'neutral') neutral++;
      else if (of_.direction === res.dir) agree++;
      else disagree++;
    }
  }
  /* 56 until pack 892. One of those tapes was an exact 40-long / 40-short
     split, which the engine used to report as a LONG direction because
     `lead = L >= S ? 'long' : 'short'` handed the long side every tie. It now
     produces no side, so it is no longer a tape with a layer-1 direction and
     no longer belongs in a sample of layer-1 directions. The correlation
     barely moves (0.957 -> 0.956); what changed is that a coin flip has
     stopped being counted as one of the directions layer 2 is agreeing with. */
  ok(pairs.length === 55, 'the sample is the 55 tapes that produce a layer-1 direction (' + pairs.length + ')');
  const n = pairs.length;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n, my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs){ sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy);
  ok(r > 0.80, 'correlation with layer 1 is ' + r.toFixed(3) + ', not the independence the header claimed');
  ok(Math.abs(r - 0.956) < 0.02, 'and it is the 0.956 written into the module header');
  ok(agree === 52 && disagree === 1 && neutral === 2,
     'layer 2 agreed with layer 1 on ' + agree + ' of ' + n + ', disagreed on ' + disagree);
  ok(agree / n > 0.9, 'which is ' + Math.round(100 * agree / n) + '% — and every one of those pays the +15% bonus');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the reads are named for what they are');
{
  const src = stripComments(FLOW);
  ok(!/read: 'Bid-Ask Imbalance/.test(src),
     'nothing in the vote table is called a bid-ask imbalance any more');
  ok(/Candle-volume imbalance 15m · PROXY/.test(src) && /Candle-volume imbalance 1h · PROXY/.test(src),
     'both imbalance reads are stamped PROXY on the card');
  ok(/Candle sweep 15m · PROXY/.test(src), 'and so is the sweep read');
  ok(/price technical/.test(src), 'the VWAP read is labelled a price technical');
  /* assert on the RENDERED votes, not on the file: a source scan for
     "no order book" passed a mutation that stripped one of the two, and it
     also let the VWAP vote keep claiming "Institutional support above" for a
     close-versus-average calculation, which is how that slipped through. */
  const live = []; let lp = 100;
  for (let i = 0; i < 60; i++){ const o = lp, c = lp * 1.004; live.push({ o: o, c: c, h: c, l: o, v: 1000 }); lp = c; }
  const votes = S.hgOrderFlowScore('X', live, []).votes;
  ok(votes.length >= 2, 'a trending tape produces at least two votes');
  const honest = votes.filter(v => /no order book|no liquidation feed|price technical, not participation/.test(v.why || ''));
  ok(honest.length === votes.length,
     'every vote\'s why line names what it is not (' + honest.length + '/' + votes.length + ')');
  ok(!votes.some(v => /Institutional support|Buying pressure|Selling pressure/.test(v.why || '')),
     'and none of them claims institutional or bid-side participation');

  /* the flag travels on the result, so callers do not have to know the file */
  const r = tape(200, 0.15, 0.008, 100);
  const out = S.hgOrderFlowScore('X', r, to1h(r));
  ok(out.proxyOnly === true, 'the result carries proxyOnly');
  ok(/candle-derived proxy/.test(out.proxyNote || ''), 'with a note the card can print');
  /* a genuinely flat tape, so NO read clears its gate and the early return
     fires — the previous fixture still tripped a read and took the normal path */
  const dead = []; for (let i = 0; i < 40; i++) dead.push({ o: 100, c: 100, h: 100, l: 100, v: 1000 });
  const flat = S.hgOrderFlowScore('X', dead, []);
  ok(flat.score === 0 && flat.direction === 'neutral', 'a flat tape fires no read at all');
  ok(flat.proxyOnly === true, 'and the no-read early return carries proxyOnly too');

  ok(/proxyOnly \? ' \(candle proxy\)' : ''/.test(stripComments(SCAN)),
     'and the card prints "(candle proxy)" beside the flow direction');
  ok(/correlation between layer-1\s+direction and layer-2 score is\s+0\.956/.test(VOTE),
     'the confidence function records the measurement beside the bonus it justifies');
  ok(/52 of 55/.test(VOTE), 'including the agreement count, re-stated after pack 892');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. the sweep volume baseline divides by what it summed');
{
  const bars = n => { const r = []; for (let i = 0; i < n; i++) r.push({ o: 100, c: 100, h: 101, l: 99, v: 1000 }); return r; };

  /* 19 bars of 1000 summed and divided by 20 gave 950, so a last bar at
     1.45x the TRUE average (1450) used to clear a gate documented as 1.5x */
  const rows = bars(24);
  rows[rows.length - 3] = { o: 100, c: 100.5, h: 101.0, l: 99, v: 1000 };   /* prev2: lower high */
  rows[rows.length - 2] = { o: 101, c: 100, h: 101.5, l: 99.5, v: 1000 };   /* prev1: red */
  rows[rows.length - 1] = { o: 100, c: 101, h: 102, l: 99.5, v: 1450 };     /* last: bull sweep */
  ok(S.hgSweepPattern(rows).detected === false,
     'a bar at 1.45x the true average no longer reports a sweep (1450/1000 = 1.45 < 1.5)');

  rows[rows.length - 1] = { o: 100, c: 101, h: 102, l: 99.5, v: 1550 };
  const hit = S.hgSweepPattern(rows);
  ok(hit.detected === true && hit.type === 'bull-sweep', 'a bar at 1.55x still does');
  ok(Math.abs(hit.confidence - 1.55 / 3) < 1e-9,
     'and its confidence is volRatio/3 off the corrected average (' + hit.confidence.toFixed(4) + ')');

  ok(/avgVol \/= volN;/.test(stripComments(FLOW)), 'the divisor is the count that was summed');
  ok(!/Math\.min\(20, rows\.length - 1\)/.test(stripComments(FLOW)),
     'and the old mismatched divisor is gone');

  /* short tapes, where the window and the old divisor differed most */
  const shortRows = bars(6);
  shortRows[3] = { o: 100, c: 100.5, h: 101.0, l: 99, v: 1000 };
  shortRows[4] = { o: 101, c: 100, h: 101.5, l: 99.5, v: 1000 };
  shortRows[5] = { o: 100, c: 101, h: 102, l: 99.5, v: 1550 };
  ok(S.hgSweepPattern(shortRows).detected === true, 'a six-bar tape still works');

  /* a feed with no volume gives avgVol 0, and lastVol / 0 is Infinity, which
     sails past a `volRatio < 1.5` gate and reports confidence 1 */
  const noVol = bars(24).map(b => Object.assign({}, b, { v: 0 }));
  noVol[noVol.length - 3] = { o: 100, c: 100.5, h: 101.0, l: 99, v: 0 };
  noVol[noVol.length - 2] = { o: 101, c: 100, h: 101.5, l: 99.5, v: 0 };
  noVol[noVol.length - 1] = { o: 100, c: 101, h: 102, l: 99.5, v: 0 };
  ok(S.hgSweepPattern(noVol).detected === false,
     'a volume-less tape reports no sweep rather than an Infinity ratio at full confidence');
  noVol[noVol.length - 1] = { o: 100, c: 101, h: 102, l: 99.5, v: 5000 };
  ok(S.hgSweepPattern(noVol).detected === false,
     'and neither does a real last bar against a zero baseline');

  /* the measured rate over rolling windows */
  const coded = r => { let a = 0; for (let i = Math.max(0, r.length - 20); i < r.length - 1; i++) a += r[i].v || 0;
                       return a / Math.min(20, r.length - 1); };
  const fixed = r => { let a = 0, n = 0; for (let i = Math.max(0, r.length - 20); i < r.length - 1; i++){ a += r[i].v || 0; n++; }
                       return n ? a / n : 0; };
  let windows = 0, was = 0, now = 0;
  for (let k = 0; k < 500; k++){
    const t = tape(60, (rnd() - 0.5) * 0.4, 0.004 + rnd() * 0.012, 100);
    for (let end = 25; end <= t.length; end++){
      const r = t.slice(0, end); windows++;
      if (r[r.length - 1].v / coded(r) >= 1.5) was++;
      if (r[r.length - 1].v / fixed(r) >= 1.5) now++;
    }
  }
  ok(windows === 18000, 'the rolling sweep is ' + windows + ' windows');
  ok(was > now, 'the old divisor passed the gate more often (' + was + ' against ' + now + ')');
  ok((was - now) / was > 0.25,
     Math.round(100 * (was - now) / was) + '% of the sweeps it used to report were under its own 1.5x threshold');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. what was measured and deliberately left alone');
{
  ok(/NOTE, measured and deliberately not changed/.test(FLOW),
     'the mean-of-firing-reads cliff is recorded in the code');
  ok(/at 0\.099 is excluded and the aggregate is 0\.900, at 0\.101 it/.test(FLOW),
     'with the numbers that show it (0.900 against 0.501 on a 0.002 move)');
  ok(/calibration decision rather than this defect/.test(FLOW),
     'and why it is not fixed here');
  ok(/The weights and the bonus are LEFT ALONE/.test(VOTE),
     'the 0.35 weight and the +15% bonus are untouched, and say so');

  /* prove the cliff is still there, so the note is not describing a fixed bug */
  const src = stripComments(FLOW);
  ok(/if \(Math\.abs\(vwap15\) > 0\.1\) scores\.push\(vwap15\)/.test(src),
     'the vwap gate still admits only reads over 0.1');
  ok(/scores\.reduce\(function\(a, b\)\{ return a \+ b; \}\) \/ scores\.length/.test(src),
     'and the aggregate is still their mean — the note describes live behaviour');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
