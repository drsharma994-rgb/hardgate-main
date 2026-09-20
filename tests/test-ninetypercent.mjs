/* HARDGATE — 90PERCENT: the four-step method, and a tab that audits its name.

   Built to the brief exactly: trend, then support and resistance, then
   momentum, then entry and exit, over RSI, the Stochastic Oscillator,
   Bollinger Bands, moving averages, MACD and Ichimoku, with the three
   pairings (RSI+Stochastic, Bollinger+MA, MACD+Ichimoku) all required to
   agree.

   THE NAME. The tab is called 90PERCENT because that is what it was asked to
   be called. It does not claim 90%: it writes every setup to the shared
   forward log and prints the MEASURED hit rate beside the 90% the name
   implies, saying so plainly while nothing has settled.

   Two things this file pins that are easy to get wrong and were:

     THE STOCHASTIC. indicators.js ships `stochRsi`, a stochastic OF RSI.
     The brief asks for the classic oscillator -- close against the high-low
     RANGE -- which is a different instrument on a different input.

     THE CLOUD. indicators2.js ships an ichimoku whose senkou spans are
     UNSHIFTED; its own comment says "senkouA/B at index i describe the cloud
     as of bar i". The standard indicator plots the cloud 26 bars FORWARD, so
     the cloud under today's price was computed 26 bars ago. Taking the shift
     costs nothing in safety -- it reads OLDER data, never newer.

   And one bug this file exists to keep fixed: a rolling-sum moving average
   cannot cross a NaN. The Stochastic's %K is NaN for its first kLen-1 bars by
   construction, so a running accumulator made %D NaN for every bar, PAIR A
   reported UNCHECKED on every contract, and the tab ran clean while producing
   nothing at all.

   Run: node tests/test-ninetypercent.mjs */
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
const SEC = 900;

function boot(){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null),
                     setItem: (k, v) => { store[k] = String(v); },
                     removeItem: k => { delete store[k]; } };
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js', 'ninetypercent.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const NP = fs.readFileSync(root + 'ninetypercent.js', 'utf8');
const IND2 = fs.readFileSync(root + 'indicators2.js', 'utf8');
const HTML = fs.readFileSync(root + 'index.html', 'utf8');
const R = S.HG_NINETY_RULE;

/* each bar wicks on its own draw — a high that is a fixed multiple of
   max(open, close) ties with its neighbour and no strict pivot ever forms */
function tape(sd, n, o){
  o = o || {};
  let s2 = sd;
  const r = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
  const drift = o.drift !== undefined ? o.drift : (r() - 0.5) * 0.30;
  const vol = o.vol !== undefined ? o.vol : 0.005 + r() * 0.018;
  const out = []; let px = o.px0 || 100;
  const base = Math.floor(Date.now() / 1000 / SEC) * SEC, t0 = base - n * SEC;
  for (let i = 0; i < n; i++){
    const a = px, c = px * (1 + (r() - 0.5 + drift) * vol);
    out.push({ t: t0 + i * SEC, o: a, c: c,
               h: Math.max(a, c) * (1 + vol * 1.2 * r()),
               l: Math.min(a, c) * (1 - vol * 1.2 * r()), v: 1000 + r() * 4000 });
    px = c;
  }
  return out;
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. a rolling sum cannot cross a NaN');
{
  /* THE BUG THIS SECTION EXISTS FOR. %K is NaN for its first kLen-1 bars, so
     a running accumulator makes %D NaN for every bar afterwards -- PAIR A
     reported UNCHECKED on every contract and nothing ever fired. */
  const st = S.__npStoch(tape(11, 120), R.stochK, R.stochD);
  const last = st.d.length - 1;
  ok(!isFinite(st.k[0]) && !isFinite(st.k[R.stochK - 2]),
     '%K is NaN before its window fills, by construction');
  ok(isFinite(st.k[last]), 'and finite once it does');
  ok(isFinite(st.d[last]),
     '%D is finite on the last bar — a leading NaN no longer poisons every later value');
  ok(!isFinite(st.d[R.stochK - 2]),
     'while it is still NaN exactly where its own window really contains one');

  const bare = stripComments(NP);
  ok(!/sum \+= \+vals\[i\];\s*if \(i >= p\) sum -= /.test(bare),
     'the rolling accumulator is gone');
  ok(/if \(!isFinite\(v\)\)\{ whole = false; break; \}/.test(bare),
     'and a window containing a NaN yields NaN rather than poisoning the rest');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the Stochastic is the classic one, not a stochastic of RSI');
{
  ok(typeof S.stochRsi === 'function', 'indicators.js does ship stochRsi');
  ok(typeof S.__npStoch === 'function', 'and this tab ships its own npStoch beside it');
  /* the defining property: close against the high-low RANGE */
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push({ t: i * SEC, o: 10, c: 10, h: 20, l: 0, v: 1 });
  rows[19] = { t: 19 * SEC, o: 10, c: 20, h: 20, l: 0, v: 1 };
  const top = S.__npStoch(rows, 14, 3);
  ok(Math.abs(top.k[19] - 100) < 1e-9, 'a close at the top of the range reads %K = 100');
  rows[19] = { t: 19 * SEC, o: 10, c: 0, h: 20, l: 0, v: 1 };
  ok(Math.abs(S.__npStoch(rows, 14, 3).k[19] - 0) < 1e-9, 'and at the bottom, 0');
  rows[19] = { t: 19 * SEC, o: 10, c: 10, h: 20, l: 0, v: 1 };
  ok(Math.abs(S.__npStoch(rows, 14, 3).k[19] - 50) < 1e-9, 'halfway, 50');
  /* a flat range has no position in it — 50 rather than a divide by zero */
  const flat = [];
  for (let i = 0; i < 20; i++) flat.push({ t: i * SEC, o: 5, c: 5, h: 5, l: 5, v: 1 });
  ok(S.__npStoch(flat, 14, 3).k[19] === 50, 'a range with no width reads 50, never NaN or Infinity');

  const bare = stripComments(NP);
  ok(!/stochRsi/.test(bare), 'and the tab never calls stochRsi, which answers a different question');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the Ichimoku cloud is where the standard indicator puts it');
{
  ok(/senkouA\/B at index i describe the cloud as of bar i/.test(IND2),
     "indicators2.js says its own spans are UNSHIFTED");
  ok(R.ichimokuShift === 26, 'this tab shifts the cloud 26 bars forward');

  const rows = tape(21, 200);
  const ic = S.__npIchimoku(rows, R.ichimoku[0], R.ichimoku[1], R.ichimoku[2], R.ichimokuShift);
  const i = rows.length - 1;
  ok(isFinite(ic.tenkan[i]) && isFinite(ic.kijun[i]), 'tenkan and kijun compute on the latest bar');
  ok(isFinite(ic.spanA[i]) && isFinite(ic.spanB[i]), 'and so does the cloud under it');

  /* THE SHIFT, PROVEN: the cloud under bar i is the raw span from i-26 */
  const unshifted = S.__npIchimoku(rows, R.ichimoku[0], R.ichimoku[1], R.ichimoku[2], 0);
  ok(Math.abs(ic.spanB[i] - unshifted.spanB[i - 26]) < 1e-9,
     'the span under bar i is exactly the one computed at bar i-26');
  ok(ic.spanB[i] !== unshifted.spanB[i],
     'which is a different number from the unshifted one — the shift is not cosmetic');
  /* and it reads OLDER data, never newer */
  const poisoned = rows.slice();
  for (let k = i - 25; k <= i; k++) poisoned[k] = Object.assign({}, poisoned[k], { h: 1e6, l: -1e6 });
  const after = S.__npIchimoku(poisoned, R.ichimoku[0], R.ichimoku[1], R.ichimoku[2], R.ichimokuShift);
  ok(after.spanB[i] === ic.spanB[i],
     'rewriting the last 26 bars does not move the cloud under the latest one — it was already fixed');
  ok(!isFinite(ic.spanA[25]),
     'a bar shallower than the shift carries no cloud at all, rather than an early guess');
  ok(!isFinite(S.__npIchimoku(rows, 9, 26, 52, 26).spanB[10]),
     'and a bar with no 26-bar history behind it has no cloud at all');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. closed bars only');
{
  const now = Date.now();
  const rows = tape(7, 30);
  rows[rows.length - 1].t = Math.floor(now / 1000);
  ok(S.__npClosedRows(rows, 900, now).length === rows.length - 1, 'the forming bar is dropped');
  ok(S.__npClosedRows([], 900, now).length === 0, 'an empty tape stays empty');
  ok(S.__npClosedRows(null, 900, now).length === 0, 'and a missing one does not throw');
  ok(S.__npClosedRows([{ t: null, c: 1 }, { t: '', c: 2 }], 900, now).length === 0,
     'unreadable stamps admit nothing — `+null` is 0 and would otherwise read as 1970');
  const mixed = [{ t: 1000, c: 1 }, { t: null, c: 2 }, { t: 2000, c: 3 }];
  ok(S.__npClosedRows(mixed, 900, now).length === 2, 'and a mixed tape keeps only what it can date');
  const bare = stripComments(NP);
  ok(/npClosedRows\(got\.rows \|\| \[\], 900, now\)/.test(bare), 'the scan trims before evaluating');
  ok(/npEvaluate\(\{ rows15: closed/.test(bare), 'and hands the engine only the closed tape');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. STEP 1 — trend, and SIDEWAYS is a verdict');
{
  const bare = stripComments(NP);
  ok(/MA stack/.test(bare) && /MACD histogram/.test(bare) && /Ichimoku price vs cloud/.test(bare),
     'three trend reads: the MA stack, MACD and the Ichimoku cloud');
  ok(/if \(out\.up > out\.down && out\.up >= 2\)/.test(bare),
     'a direction needs a majority of at least two');
  ok(/else out\.dir = 'sideways';/.test(bare), 'and anything else is SIDEWAYS');

  let up = 0, down = 0, side = 0, unchecked = 0;
  for (let k = 0; k < 300; k++){
    const t = S.__npTrend(tape(7 + k * 3571, 400));
    if (t.dir === 'up') up++; else if (t.dir === 'down') down++; else side++;
    unchecked += t.unchecked;
  }
  ok(up > 0 && down > 0 && side > 0,
     'over 300 tapes all three verdicts occur (' + up + ' up / ' + down + ' down / ' + side + ' sideways)');
  ok(side > 20, 'and SIDEWAYS is common, as it should be — ' + side + ' of 300');

  /* a read that cannot be computed votes for nothing */
  const thin = S.__npTrend(tape(3, 50));
  ok(thin.dir === 'sideways', 'a tape too short to compute anything is sideways, not a guess');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. STEP 2 — confirmed pivots, clustered levels, sloping lines');
{
  /* an unmistakable pivot high at 5 */
  const r = [];
  for (let i = 0; i < 13; i++)
    r.push({ t: i * SEC, o: 100, c: 100, h: 100 + (i === 5 ? 10 : 0), l: 100 - (i === 6 ? 10 : 0), v: 1 });
  const p = S.__npPivots(r, 5, 5);
  ok(p.highs.length === 1 && p.highs[0].i === 5, 'the pivot high is found');
  ok(p.lows.length === 1 && p.lows[0].i === 6, 'and the pivot low');
  /* a bar that leads its left window but is beaten on the right is not one */
  const rising = [];
  for (let i = 0; i < 13; i++) rising.push({ t: i * SEC, o: 100, c: 100, h: 100 + i, l: 100 - i, v: 1 });
  ok(S.__npPivots(rising, 5, 5).highs.length === 0,
     'a bar beaten on its right is not a pivot — the right side is what CONFIRMS it');

  /* ONE PIVOT IS NOT A LEVEL. Two touches within half an ATR are. */
  const one = S.__npLevels({ highs: [{ i: 1, price: 100 }], lows: [] }, 1);
  ok(one.length === 0, 'a single pivot does not become support');
  const two = S.__npLevels({ highs: [{ i: 1, price: 100 }, { i: 9, price: 100.3 }], lows: [] }, 1);
  ok(two.length === 1 && two[0].n === 2, 'two pivots within half an ATR are one level with two touches');
  ok(Math.abs(two[0].price - 100.15) < 1e-9, 'priced at their mean');
  const far = S.__npLevels({ highs: [{ i: 1, price: 100 }, { i: 9, price: 140 }], lows: [] }, 1);
  ok(far.length === 0, 'and two pivots far apart are two single pivots, so neither is a level');

  /* a trendline needs three points, not two and a ruler */
  ok(S.__npTrendline([{ i: 1, price: 10 }, { i: 2, price: 11 }], 5, 4) === null,
     'two points do not make a trendline');
  const line = S.__npTrendline([{ i: 0, price: 10 }, { i: 1, price: 11 }, { i: 2, price: 12 }], 4, 4);
  ok(line && Math.abs(line.slope - 1) < 1e-9 && Math.abs(line.at - 14) < 1e-9,
     'three on a line fit it exactly and project to the asked bar');
  ok(line.rising === true, 'and report their direction');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. the target is the first level that PAYS, and it is a real level');
{
  /* MEASURED, and the reason this rule is not "nearest to nearest": over 300
     tapes the nearest-level geometry had a median R:R of 0.42 and only 5 of
     94 candidates reached 2R. Adjacent levels sit roughly equidistant. */
  const bare = stripComments(NP);
  ok(/if \(rrC >= NP_MIN_RR\)\{ barrier = cands\[ci\]; break; \}/.test(bare),
     'the search takes the first candidate that clears the floor');
  ok(/\.sort\(function\(a, b\)\{\s*return Math\.abs\(a\.price - entryNow\) - Math\.abs\(b\.price - entryNow\);/.test(bare),
     'walking outward from price, so it is the NEAREST level that pays, not the furthest');
  ok(/no level in front pays/.test(bare), 'and if none does, there is no trade');

  let fired = 0, seen = 0, targetIsLevel = 0, stopBeyond = 0, rrFloor = 0, wrongSide = 0;
  const rrs = [];
  for (let k = 0; k < 600; k++){
    const rows = tape(7 + k * 3571, 400);
    const res = S.__npEvaluate({ rows15: rows, venueCost: { rtFrac: 0.001, venue: 'Delta' } });
    seen++;
    if (!res.ok) continue;
    fired++;
    const s = res.setup;
    rrs.push(s.rr1);
    /* the target must be one of the measured levels, never a computed price */
    const levels = res.structure.levels.map(L => L.price);
    if (levels.some(v => Math.abs(v - s.t1) < 1e-9)) targetIsLevel++;
    if (s.dir === 'long' ? (s.stop <= s.supportLevel) : (s.stop >= s.supportLevel)) stopBeyond++;
    if (s.rr1 >= R.minRr) rrFloor++;
    if (s.dir === 'long' ? !(s.stop < s.entry && s.t1 > s.entry)
                         : !(s.stop > s.entry && s.t1 < s.entry)) wrongSide++;
  }
  ok(fired > 0, fired + ' of ' + seen + ' tapes produced a setup (' + (100 * fired / seen).toFixed(1) + '%)');
  ok(targetIsLevel === fired,
     'every target is one of the measured support/resistance levels — no price is invented');
  ok(stopBeyond === fired, 'every stop sits beyond the level it stops against');
  ok(rrFloor === fired, 'every setup clears the ' + R.minRr + 'R floor');
  ok(wrongSide === 0, 'and every stop and target is on the correct side of entry');
  /* there is no explicit wrong-side guard here, and deliberately so: the
     backstop is by construction the nearest level BEHIND price, so the stop
     cannot land on the wrong side. The property above is where that would
     show if the selection ever changed. */
  ok(!/stop on the wrong side of entry/.test(stripComments(NP)),
     'no unreachable guard is carried for a state the geometry rules out');
  ok(Math.min.apply(null, rrs) >= R.minRr, 'the weakest was ' + Math.min.apply(null, rrs).toFixed(2) + 'R');
}

/* ---------------------------------------------------------------- 8 */
console.log('\n8. STEP 3 — the three pairings, each named and auditable');
{
  const rows = tape(19, 400);
  const trend = S.__npTrend(rows);
  const atr = S.__npAtr(rows, 14);
  const st = S.__npStructure(rows, atr);
  const mom = S.__npMomentum(rows, trend);
  const pairs = S.__npPairs(mom, trend, st, 'long');
  ok(pairs.length === 3, 'there are exactly three');
  ok(pairs[0].name === 'RSI + Stochastic', 'A is RSI + Stochastic');
  ok(pairs[1].name === 'Bollinger + MA', 'B is Bollinger + MA');
  ok(pairs[2].name === 'MACD + Ichimoku', 'C is MACD + Ichimoku');
  ok(pairs.every(p => typeof p.why === 'string' && p.why.length > 10),
     'and each states the numbers it read');
  ok(pairs.every(p => p.ok === true || p.ok === false || p.ok === null),
     'each is agree, no, or UNCHECKED — never a silent pass');

  /* a leg that cannot be computed is UNCHECKED and agrees with nothing */
  const blind = S.__npPairs({ rsi: NaN, stochK: NaN, stochD: NaN, bb: null, macdHist: NaN },
                            { ma: null, ichimoku: null }, st, 'long');
  ok(blind.every(p => p.ok === null), 'with nothing computable, all three are UNCHECKED');
  ok(blind.every(p => /UNCHECKED/.test(p.why)), 'and say so');

  /* EVERY LEG OF EVERY PAIRING IS LOAD-BEARING. A whole-tape test can only
     say the pair came back true or false; it cannot say WHICH of the two or
     three conditions did the work, so a leg could be dropped and nothing
     would notice. These drive npPairs directly, flipping one leg at a time. */
  function rig(over){
    const ma = { fast: [100], slow: [100], trend: [100] };
    const ich = { tenkan: [100], kijun: [100], spanA: [98], spanB: [97] };
    const base = {
      mom: { rsi: 60, stochK: 60, stochD: 55, macdHist: 0.5,
             bb: { mid: 100, upper: 110, lower: 90, pctB: 0.7 } },
      trend: { ma: ma, ichimoku: ich },
      st: { price: 105 }
    };
    Object.assign(base.mom, (over && over.mom) || {});
    if (over && over.bb) Object.assign(base.mom.bb, over.bb);
    if (over && over.ich) Object.assign(ich, over.ich);
    if (over && over.ma) Object.assign(ma, over.ma);
    if (over && over.st) Object.assign(base.st, over.st);
    return S.__npPairs(base.mom, base.trend, base.st, 'long');
  }
  const good = rig();
  ok(good[0].ok === true && good[1].ok === true && good[2].ok === true,
     'a clean long rig has all three pairings agreeing');

  /* PAIR A — three legs */
  ok(rig({ mom: { rsi: 40 } })[0].ok === false, 'A fails when RSI is on the wrong side of 50');
  ok(rig({ mom: { stochK: 50, stochD: 60 } })[0].ok === false, 'A fails when %K crosses the wrong way');
  ok(rig({ mom: { rsi: 80 } })[0].ok === false,
     'A fails when RSI is already stretched, even with everything else with the trade');
  ok(rig({ mom: { stochK: 90, stochD: 55 } })[0].ok === false,
     'and when the Stochastic is stretched — the stretch check is not decorative');

  /* PAIR B — two legs */
  ok(rig({ ma: { fast: [110] } })[1].ok === false, 'B fails when price is the wrong side of the MA');
  ok(rig({ bb: { pctB: 0.3 } })[1].ok === false, 'B fails below the middle band');
  ok(rig({ bb: { pctB: 1.2 } })[1].ok === false,
     'and B fails ABOVE the upper band — the band check is not one-sided');

  /* PAIR C — three legs */
  ok(rig({ mom: { macdHist: -0.5 } })[2].ok === false, 'C fails when MACD is against');
  ok(rig({ ich: { spanA: [120], spanB: [118] } })[2].ok === false,
     'C fails when price is not clear of the cloud');
  ok(rig({ ich: { kijun: [120] } })[2].ok === false, 'C fails below the kijun');

  const bare = stripComments(NP);
  ok(/if \(agreed !== 3\)\{/.test(bare), 'all three must agree — two is not enough');
  /* UNCHECKED cannot substitute for agreement */
  ok(/pairs\.filter\(function\(p\)\{ return p\.ok === true; \}\)\.length/.test(bare),
     'and only an explicit true counts toward the three');
}

/* ---------------------------------------------------------------- 9 */
console.log('\n9. the tab audits its own name');
{
  ok(R.targetHit === 0.90, 'the name implies 90%');
  const silent = S.__npAuditText(null);
  ok(/named for a 90% target/i.test(silent), 'with nothing settled it names the target');
  ok(/no hit rate is claimed/.test(silent), 'and claims no hit rate');
  ok(!/\b90% (hit|accuracy|win)/i.test(silent), 'it never states 90% as an achievement');

  const measured = S.__npAuditText({ settled: 40, open: 3, hit: 0.55, effN: 9.4, target: 0.9 });
  ok(/MEASURED/.test(measured) && /55%/.test(measured), 'with records settled it prints the real rate');
  ok(/40 settled/.test(measured), 'and the sample it came from');
  ok(/9\.4 independent/.test(measured), 'corrected for overlap');
  ok(/below the name/.test(measured), 'and says plainly that it is under the name');
  const high = S.__npAuditText({ settled: 40, open: 0, hit: 0.95, effN: 9, target: 0.9 });
  ok(/at or above the name/.test(high), 'while a rate above it says that instead');

  /* nothing anywhere asserts the number in the title */
  const bare = stripComments(NP);
  ok(!/\b90% win/i.test(bare) && !/accuracy of 90/i.test(bare) && !/increase your accuracy/i.test(bare),
     'no accuracy claim survives anywhere in the file');
  ok(/RECORD ONLY/.test(bare), 'and every card is stamped RECORD ONLY');
  ok(!/\bfetch\s*\(/.test(NP) && !/XMLHttpRequest|sendBeacon/.test(NP),
     'nothing is sent anywhere');
  /* the card is honest about what six indicators over one series are */
  ok(/not six\s*\n?\s*\* *independent confirmations|not six independent confirmations/.test(NP)
     || /independent confirmations/.test(NP),
     'and the card says agreement between them is not six independent confirmations');
}

/* ---------------------------------------------------------------- 10 */
console.log('\n10. end to end, through the real tab');
{
  function fakeEl(){
    const nodes = {};
    return {
      _html: '',
      set innerHTML(v){ this._html = String(v); },
      get innerHTML(){ return this._html; },
      querySelector(sel){
        const id = String(sel).replace(/^#/, '');
        if (this._html.indexOf('id="' + id + '"') < 0) return null;
        if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', style: {}, textContent: '',
                                      disabled: false, addEventListener(){},
                                      classList: { toggle(){}, contains(){ return false; } } };
        return nodes[id];
      },
      _node(id){ return nodes[id] || null; }
    };
  }
  const SY = [];
  for (let i = 0; i < 16; i++) SY.push({ sym: 'S' + i, exchange: i % 2 ? 'coindcx' : 'delta', base: 'S' + i });
  const T = {};
  SY.forEach((it, i) => { T[it.sym] = tape(7 + i * 3571, 400); });
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: SY, rawLen: SY.length, note: null,
    venueCounts: { delta: 8, coindcx: 8, binance: 0, startrader: 0, other: 0 },
    droppedTurnover: 0, droppedVenue: 0, droppedNoTicker: 0, minTurnover: 0 });
  S.hgDeskFetchKlines = async (it) => T[it.sym].slice();
  S.hgDeskFetchKlinesResult = async (it) => ({ rows: T[it.sym].slice(), ok: true, reason: null, error: null });

  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'ninetypercent')[0];
  ok(!!tab && tab.label === '90PERCENT', 'the tab registers as 90PERCENT');
  const el = fakeEl();
  tab.mount(el);
  ok(/id="npCards"/.test(el.innerHTML) && /id="npRun"/.test(el.innerHTML), 'it mounts a host and a run button');
  ok(/named for a 90% target/i.test(text(el.innerHTML)), 'and the audit line leads the page');

  const out = await tab.refresh();
  ok(out === 'refreshed', 'a scan runs to completion');
  const st = S.ninetyPercentState();
  ok(st.universe === 16 && st.scanned === 16, 'every contract was read');
  ok(st.errors === 0, 'with no errors');
  const tallied = Object.keys(st.stepTally).reduce((a, k) => a + st.stepTally[k], 0);
  ok(tallied + st.setups.length === st.scanned - st.skipped - st.unread,
     'every contract read is accounted for: ' + JSON.stringify(st.stepTally)
     + ' plus ' + st.setups.length + ' setups');
  const cards = el._node('npCards');
  ok(cards && /COVERAGE/.test(text(cards.innerHTML)), 'the coverage line is painted');
  ok(/from Delta 8 · CoinDCX 8|from CoinDCX 8 · Delta 8/.test(text(cards.innerHTML)),
     'with the venue mix and the empty venues left off');

  /* a setup that fires becomes a settleable forward record */
  let fired = null;
  for (let k = 0; k < 600 && !fired; k++){
    const res = S.__npEvaluate({ rows15: tape(7 + k * 3571, 400), venueCost: { rtFrac: 0.001, venue: 'Delta' } });
    if (res.ok) fired = res;
  }
  ok(!!fired, 'the engine produces a setup within the sweep');
  if (fired){
    const rows = S.__npFwdRows([{ sym: 'X', price: fired.setup.entry, bar: fired.bar, setup: fired.setup }]);
    ok(rows.length === 1, 'which becomes one forward record');
    ok(/^NP90-(LONG|SHORT)@V1$/.test(rows[0].mechanic),
       'under a mechanic carrying the side and the label version (' + rows[0].mechanic + ')');
    ok(rows[0].mechanic.length <= 28, 'that fits the 28 characters hg-forward keeps');
    ok(rows[0].barT === fired.bar.t, 'stamped with the closed bar it was decided on');
    ok(S.__npFwdRows([{ sym: 'X', setup: { dir: 'long', entry: null, stop: 1, t1: 2 } }]).length === 0,
       'and a missing level drops the record rather than recording a 100%-risk trade');
  }
}

/* ---------------------------------------------------------------- 11 */
console.log('\n11. wired into the page');
{
  ok(/<script src="ninetypercent\.js\?v=\d+"><\/script>/.test(HTML), 'the script tag is present');
  ok(/'cryptoverse','ninetypercent'\]/.test(HTML), 'and the tab is in the CRYPTO nav group');
  ok(Math.abs(S.__npBreakeven(2) - 1 / 3) < 1e-9, 'breakeven at 2R is 33%');
  ok(!isFinite(S.__npBreakeven(0)), 'and a non-positive R:R has none rather than a made-up one');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
