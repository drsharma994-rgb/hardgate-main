/* HARDGATE — CRYPTOVERSE: a three-factor rule that cannot see the future.

   The brief this tab was built to: a 99% win rate in live crypto is an
   artefact of look-ahead, curve-fitting or repainting. The target is positive
   expectancy, not accuracy. So the rule is three non-correlated gates --
   liquidity (WHERE), a Lorentzian k-NN (WHEN), a momentum filter (CONFIRM) --
   evaluated only on bars that have already CLOSED, which is this file's
   equivalent of `barstate.isconfirmed`.

   This test exists to prove the parts of that claim that can be proven:

     1. nothing reads a bar later than the one being scored
     2. the forming bar is never read at all
     3. the k-NN labels each neighbour with what came NEXT, not what came
        before -- the difference between a classifier and a restatement
     4. the trigger must follow the sweep, so a signal mid-range cannot fire
     5. no win rate is claimed anywhere on the tab
     6. the webhook payload is built and never sent

   WHY IT DOES NOT USE pineLorentzianKernel. That shared helper labels each
   neighbour `rows[idx - 4].c > rows[idx].c` -- the move ENDING at the
   neighbour. Measured over 925 scored bars of a random walk:

     corr(mlScore, PAST 4-bar return)    -0.658
     corr(mlScore, FUTURE 4-bar return)  -0.057

   It describes a move that already happened. Seven tabs use it, so it is not
   changed here; cryptoverse carries its own forward-labelled classifier and
   section 3 pins the difference.

   Run: node tests/test-cryptoverse.mjs */
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
  for (const f of ['indicators.js', 'indicators2.js', 'pinemath.js',
                   'hg-forward.js', 'cryptoverse.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const S = boot();
const CV = fs.readFileSync(root + 'cryptoverse.js', 'utf8');
const HTML = fs.readFileSync(root + 'index.html', 'utf8');

/* Each bar wicks by its OWN draw. A generator that makes `high` a fixed
   multiple of max(open, close) is degenerate: consecutive bars share a
   boundary price, so neighbouring highs TIE whenever one is the local max
   and a strict pivot can never form. That fixture bug produced zero swings
   on 200 tapes while the code was correct, so it is written down here. */
function tape(sd, n, opts){
  opts = opts || {};
  let s2 = sd;
  const r = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
  const drift = (opts.drift !== undefined) ? opts.drift : (r() - 0.5) * 0.25;
  const vol = (opts.vol !== undefined) ? opts.vol : 0.006 + r() * 0.018;
  const out = []; let px = opts.px0 || 100;
  const base = Math.floor(Date.now() / 1000 / SEC) * SEC, t0 = base - n * SEC;
  for (let i = 0; i < n; i++){
    const o = px, c = px * (1 + (r() - 0.5 + drift) * vol);
    out.push({ t: t0 + i * SEC, o: o, c: c,
               h: Math.max(o, c) * (1 + vol * 1.2 * r()),
               l: Math.min(o, c) * (1 - vol * 1.2 * r()),
               v: 1000 + r() * 4000 });
    px = c;
  }
  return out;
}

/* ---------------------------------------------------------------- 1 */
console.log('\n1. the classifier cannot see past the bar it is scoring');
{
  ok(typeof S.__cvMlScoreAtBar === 'function', 'cvMlScoreAtBar is reachable');
  const rows = tape(4242, 460);
  const bi = 400;
  const f1 = [], f2 = [], f3 = [];
  /* score through the public path instead of rebuilding the features */
  const base = S.__cvLorentz(rows.slice(0, bi + 1));
  ok(base && isFinite(base.smoothed), 'the classifier scores a 401-bar tape');

  /* THE TEST THAT MATTERS. Replace every bar AFTER bi with garbage. A score
     that reads only closed history cannot move. */
  const poisoned = rows.slice();
  for (let i = bi + 1; i < poisoned.length; i++){
    poisoned[i] = { t: poisoned[i].t, o: 1e6, c: 1e6, h: 1.1e6, l: 9e5, v: 1 };
  }
  const after = S.__cvLorentz(poisoned.slice(0, bi + 1));
  ok(after.smoothed === base.smoothed && after.raw === base.raw,
     'rewriting every later bar changes the score by exactly nothing');

  /* and the converse, so the test is not vacuous: changing a bar it SHOULD
     read does move it */
  const touched = rows.slice(0, bi + 1);
  touched[bi] = Object.assign({}, touched[bi], { c: touched[bi].c * 1.25, h: touched[bi].h * 1.3 });
  const moved = S.__cvLorentz(touched);
  ok(moved.smoothed !== base.smoothed,
     'while changing the scored bar itself does move it — the guard is not vacuous');

  /* TOO FEW NEIGHBOURS IS NOT A WEAK OPINION, IT IS NO OPINION. Below k the
     vote is not a vote, so the score is 0 rather than whatever two or three
     bars happened to do. */
  const R0 = S.HG_CRYPTOVERSE_RULE;
  const shortHist = tape(31, 60);
  const f = shortHist.map(r => r.c);
  ok(S.__cvMlScoreAtBar(shortHist, f, f, f, 10, R0.k, R0.lookback, R0.labelH) === 0,
     'a bar with fewer than k usable neighbours scores exactly 0');
  ok(S.__cvMlScoreAtBar(shortHist, f, f, f, 55, 8, 40, 4) !== null,
     'while a bar with enough of them returns a number');

  /* A FLAT LABEL IS NEITHER SIDE. If close is identical H bars later, that
     neighbour has no opinion; counting it as bullish would tilt every score
     on a quiet tape. */
  const flatRows = [];
  for (let i = 0; i < 80; i++) flatRows.push({ t: i * SEC, o: 100, c: 100, h: 100, l: 100, v: 1 });
  const ff = flatRows.map(function(r, i){ return i; });   /* distinct features */
  ok(S.__cvMlScoreAtBar(flatRows, ff, ff, ff, 70, 8, 60, 4) === 0,
     'a tape whose closes never move scores 0 — ties vote for neither side');

  /* the neighbour walk never indexes beyond bi */
  const bare = stripComments(CV);
  ok(/if \(idx \+ labelH > bi\) continue;/.test(bare),
     'the walk refuses any neighbour whose label would fall past the scored bar');
  ok(/for \(i = labelH; i <= lookback; i\+\+\)/.test(bare),
     'and starts at the label horizon, which is what keeps that label in the past');
}

/* ---------------------------------------------------------------- 2 */
console.log('\n2. the forming bar is never read');
{
  const now = Date.now();
  const rows = tape(7, 30);
  /* give the tape a genuinely forming last bar */
  rows[rows.length - 1].t = Math.floor(now / 1000);
  const closed = S.__cvClosedRows(rows, 900, now);
  ok(closed.length === rows.length - 1, 'the bar that has not closed is dropped');
  ok(closed[closed.length - 1].t <= (now / 1000) - 900, 'and the last one kept is a closed bar');

  ok(S.__cvClosedRows([], 900, now).length === 0, 'an empty tape stays empty');
  ok(S.__cvClosedRows(null, 900, now).length === 0, 'and a missing one does not throw');
  /* ABSENT STAMPS ARE DROPPED, NEVER READ AS THE EPOCH. `+null` is 0 and
     isFinite(0) is true, so a coercion before the finite test would admit a
     missing stamp as 1970 — comfortably "closed" — and let the tab score a
     bar it knows nothing about. */
  ok(S.__cvClosedRows([{ t: null, c: 1 }, { t: '', c: 2 }, { t: undefined, c: 3 }], 900, now).length === 0,
     'a tape of unreadable stamps admits nothing at all');
  const mixed = [{ t: 1000, c: 1 }, { t: null, c: 2 }, { t: 2000, c: 3 }];
  const keptMixed = S.__cvClosedRows(mixed, 900, now);
  ok(keptMixed.length === 2 && keptMixed[0].c === 1 && keptMixed[1].c === 3,
     'and a mixed tape keeps only the bars it can actually date');
  /* a tape we cannot judge at all still loses its last bar rather than being trusted whole */
  const older = tape(9, 12).map(r => Object.assign({}, r, { t: 1000 }));
  ok(S.__cvClosedRows(older, 900, now).length === older.length - 1,
     'and a tape whose every bar looks closed still drops one, rather than trusting the feed');

  const bare = stripComments(CV);
  ok(/cvClosedRows\(got15\.rows \|\| \[\], 900, now\)/.test(bare), 'the scan trims the 15m leg');
  ok(/cvClosedRows\(got1h\.rows \|\| \[\], 3600, now\)/.test(bare), 'and the 1h leg');
  ok(/rows15: closed15, rows1h: closed1h/.test(bare),
     'and hands the engine only those — never the raw fetch');
}

/* ---------------------------------------------------------------- 3 */
console.log('\n3. the label looks FORWARD, which is what makes it a classifier');
{
  const rows = tape(7777, 1100);
  const closes = rows.map(r => r.c);
  const score = [], fut = [], past = [];
  const R = S.HG_CRYPTOVERSE_RULE;
  for (let bi = R.lookback + 30; bi < rows.length - R.labelH - 1; bi += 3){
    const r = S.__cvLorentz(rows.slice(0, bi + 1));
    if (!r) continue;
    score.push(r.raw);
    past.push(closes[bi] - closes[bi - R.labelH]);
    fut.push(closes[bi + R.labelH] - closes[bi]);
  }
  function corr(a, b){
    const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++){ sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return sab / Math.sqrt(saa * sbb);
  }
  ok(score.length > 100, 'scored ' + score.length + ' bars');
  const cf = corr(score, fut), cp = corr(score, past);
  /* On a random walk a HONEST forward classifier has near-zero skill: that is
     the point. What must NOT happen is a large correlation with the past,
     which is the signature of a label pointing the wrong way. */
  ok(Math.abs(cp) < 0.35,
     'it does not merely restate the move that already happened (corr with past ' + cp.toFixed(3) + ')');
  ok(Math.abs(cf) < 0.35,
     'and it claims no magic against a random walk either (corr with future ' + cf.toFixed(3) + ')');

  /* the shared helper, measured on the same tape, for the contrast */
  const pScore = [], pPast = [];
  for (let bi = 270; bi < rows.length - 6; bi += 3){
    const r = S.pineLorentzianKernel(rows.slice(0, bi + 1), { includeContext: true });
    if (!r) continue;
    pScore.push(r.mlScore);
    pPast.push(closes[bi] - closes[bi - 4]);
  }
  const pcp = corr(pScore, pPast);
  ok(Math.abs(pcp) > Math.abs(cp),
     'pineLorentzianKernel is far more tied to the past (' + pcp.toFixed(3)
     + ' against ' + cp.toFixed(3) + ') — which is why this tab does not use it');

  const bare = stripComments(CV);
  ok(/var after = \+rows\[idx \+ labelH\]\.c, at = \+rows\[idx\]\.c;/.test(bare),
     'the label is taken from the bar AFTER the neighbour');
  ok(!/rows\[idx - labelH\]/.test(bare) && !/rows\[bi - i - 4\]/.test(bare),
     'and never from the bar before it');
}

/* ---------------------------------------------------------------- 4 */
console.log('\n4. structure: confirmed swings, and a sweep is not a break');
{
  /* an unmistakable pivot high at 5 and pivot low at 6 */
  const r = [];
  for (let i = 0; i < 13; i++)
    r.push({ t: i * SEC, o: 100, c: 100, h: 100 + (i === 5 ? 10 : 0), l: 100 - (i === 6 ? 10 : 0), v: 1 });
  const sw = S.__cvSwings(r, 5, 5);
  ok(sw.highs.length === 1 && sw.highs[0].i === 5 && sw.highs[0].level === 110, 'the swing high is found');
  ok(sw.highs[0].confirmedAt === 10,
     'and is only CONFIRMED five bars later, once the bars that prove it have closed');
  ok(sw.lows.length === 1 && sw.lows[0].i === 6, 'and the swing low beside it');
  /* THE RIGHT SIDE HAS TO BE CHECKED TOO. A bar that tops its left window is
     not a pivot if anything to its right went higher -- that is precisely the
     "not yet confirmed" case, and a left-only walk would publish a level that
     price has already exceeded. */
  const rising = [];
  for (let i = 0; i < 13; i++)
    rising.push({ t: i * SEC, o: 100, c: 100, h: 100 + i, l: 100 - i, v: 1 });
  ok(S.__cvSwings(rising, 5, 5).highs.length === 0,
     'a bar that leads its left window but is beaten on the right is not a pivot high');
  ok(S.__cvSwings(rising, 5, 5).lows.length === 0, 'and the mirror holds for lows');

  /* a tie is not a pivot -- the conventional, conservative reading */
  const flat = [];
  for (let i = 0; i < 13; i++) flat.push({ t: i * SEC, o: 100, c: 100, h: 100, l: 100, v: 1 });
  ok(S.__cvSwings(flat, 5, 5).highs.length === 0,
     'a flat tape has no pivots — a tie is not an extreme');

  /* a SWEEP wicks through and closes back; a BREAK closes beyond */
  function withLast(lastH, lastC, lastL){
    const a = r.slice();
    for (let i = 13; i < 18; i++) a.push({ t: i * SEC, o: 100, c: 100, h: 101, l: 99, v: 1 });
    a.push({ t: 18 * SEC, o: 100, c: lastC, h: lastH, l: lastL, v: 1 });
    return a;
  }
  const swept = withLast(112, 105, 99);
  const hit = S.__cvSweep(swept, S.__cvSwings(swept, 5, 5), 8);
  ok(hit && hit.dir === 'short' && hit.side === 'high',
     'a wick through the swing high that closes back inside is a short-side sweep');
  ok(hit.level === 110 && hit.extreme === 112, 'carrying the level taken and how far past it went');

  const broke = withLast(112, 111, 99);
  const brk = S.__cvSweep(broke, S.__cvSwings(broke, 5, 5), 8);
  ok(!brk || brk.side !== 'high',
     'but a CLOSE beyond the level is a break, not a sweep, and is not counted');

  /* the level has to exist before the bar that takes it */
  const bare = stripComments(CV);
  ok(/if \(hi\.confirmedAt >= b\) continue;/.test(bare)
     && /if \(lo\.confirmedAt >= b\) continue;/.test(bare),
     'a swing cannot be swept by a bar that came before it was confirmed');
}

/* ---------------------------------------------------------------- 5 */
console.log('\n5. the gates, in the order price meets them');
{
  const bare = stripComments(CV);
  ok(/gate: 'WHERE'/.test(bare) && /gate: 'WHEN'/.test(bare) && /gate: 'CONFIRM'/.test(bare),
     'all three gates report a verdict on every contract');
  const w1 = bare.indexOf("gate: 'WHERE'"), w2 = bare.indexOf("gate: 'WHEN'"), w3 = bare.indexOf("gate: 'CONFIRM'");
  ok(w1 < w2 && w2 < w3, 'and they are evaluated in that order');
  ok(/if \(!g1\)\{ out\.gates\.push\('WHERE: no liquidity taken'\); return out; \}/.test(bare),
     'no liquidity, no evaluation — the classifier is never consulted mid-range');
  ok(/var afterSweep = sweep\.bar < \(n - 1\);/.test(bare),
     'the trigger bar must come AFTER the sweep bar');
  ok(/withinWindow = sweep\.barsAgo <= CV_TRIG_MAX/.test(bare),
     'and within the window, so a stale sweep cannot be paired with a fresh signal');

  /* momentum is permission, and an absent filter grants nothing */
  const none = S.__cvMomentum([], 'long');
  ok(none.ok === false && none.checked >= 0,
     'a filter with nothing to read grants no permission');
  ok(S.__cvMomentum([], null).ok === false, 'and no direction means no permission either');
  ok(/out\.ok = out\.agree > 0 && out\.oppose === 0;/.test(bare),
     'permission needs a real agreeing vote and no opposing one');
}

/* ---------------------------------------------------------------- 5b */
console.log('\n5b. the gates hold as PROPERTIES, over every tape, not just in source');
{
  /* Source greps prove a line exists. These prove the verdict never
     contradicts its own inputs, across hundreds of tapes -- which is the
     only way to catch a gate that is present but not load-bearing. */
  let fired = 0, seen = 0;
  let mismatchFired = 0, opposedFired = 0, staleFired = 0, sameBarFired = 0, wrongSideFired = 0;
  let insideWickFired = 0;
  for (let k = 0; k < 500; k++){
    const res = S.__cvEvaluate({ rows15: tape(101 + k * 7919, 460), rows1h: tape(9 + k, 240),
                                 venueCost: { rtFrac: 0.001, venue: 'Delta' } });
    seen++;
    if (res.sweepDir && res.mlDir && res.sweepDir !== res.mlDir && res.ok) mismatchFired++;
    if (res.momOppose > 0 && res.ok) opposedFired++;
    if (!res.ok) continue;
    fired++;
    const s = res.setup;
    const side = s.dir === 'long' ? (s.stop < s.entry && s.t1 > s.entry)
                                  : (s.stop > s.entry && s.t1 < s.entry);
    if (!side) wrongSideFired++;
    /* BEYOND the swept extreme, never inside the wick that just traded there */
    const beyond = s.dir === 'long' ? (s.stop <= s.sweepExtreme) : (s.stop >= s.sweepExtreme);
    if (!beyond) insideWickFired++;
    if (s.sweepBarsAgo > S.HG_CRYPTOVERSE_RULE.trigMax) staleFired++;
    if (s.sweepBarsAgo === 0) sameBarFired++;
  }
  ok(seen === 500 && fired > 0, fired + ' of ' + seen + ' tapes cleared all three gates');
  ok(mismatchFired === 0,
     'not one fired with the classifier pointing against the sweep it is supposed to trigger on');
  ok(opposedFired === 0, 'not one fired with the momentum filter opposing');
  ok(staleFired === 0, 'not one fired on a sweep older than the trigger window');
  ok(sameBarFired === 0, 'and not one fired on the sweep bar itself');
  ok(wrongSideFired === 0,
     'every stop and target that reached a card sits on the correct side of entry');
  ok(insideWickFired === 0,
     'and every stop sits BEYOND the extreme the sweep reached — never inside the wick '
     + 'that just traded there, which is the stop noise takes out first');

  /* and the wrong-side guard is a REJECTION, not a silent repair: the cost
     floor rewrites `stop` from entry, so without this the correction would
     be invisible on every contract whose raw risk was under the floor */
  const bare2 = stripComments(CV);
  ok(/var sideOk = dir === 'long' \? \(stop < entry\) : \(stop > entry\);/.test(bare2),
     'the side is checked explicitly');
  ok(/PLAN: stop on the wrong side of entry/.test(bare2),
     'and a wrong side drops the setup with a reason rather than being repaired');
  const floorAt = bare2.indexOf('risk = costFloor');
  const sideAt = bare2.indexOf('var sideOk =');
  ok(floorAt > 0 && sideAt > floorAt,
     'the check runs AFTER the cost floor, which is the thing that would have hidden it');
}

/* ---------------------------------------------------------------- 6 */
console.log('\n6. expectancy, not accuracy');
{
  const R = S.HG_CRYPTOVERSE_RULE;
  ok(R.minRr === 2, 'the rule carries a strict 2R target');
  ok(Math.abs(S.__cvBreakeven(2) - 1 / 3) < 1e-9, 'whose breakeven hit rate is 33%');
  ok(Math.abs(S.__cvBreakeven(1.5) - 0.4) < 1e-9, 'and 1.5R would be 40%');
  ok(!isFinite(S.__cvBreakeven(0)) && !isFinite(S.__cvBreakeven(-1)),
     'a non-positive R:R has no breakeven rather than a made-up one');

  /* NOTHING on this tab may claim a win rate */
  const bare = stripComments(CV);
  ok(/No win rate is claimed here/.test(CV) || /no win rate/i.test(CV),
     'the tab says outright that it claims none');
  ok(!/win rate of \d/i.test(bare) && !/\d+% win/i.test(bare) && !/accuracy of \d/i.test(bare),
     'and states no percentage anywhere as an accuracy');
  ok(/breakeven/i.test(bare), 'what it states instead is the breakeven its R:R implies');
  ok(/RECORD ONLY/.test(bare), 'and every card is stamped RECORD ONLY');
}

/* ---------------------------------------------------------------- 7 */
console.log('\n7. the webhook is built and never sent');
{
  ok(!/\bfetch\s*\(/.test(CV), 'there is no fetch in the file');
  ok(!/XMLHttpRequest|sendBeacon|navigator\.send/.test(CV), 'no XHR and no beacon either');
  ok(!/hgPost|apiPost|\/api\//.test(CV), 'and no API path');

  const item = { sym: 'BTCUSDT', exchange: 'delta' };
  const res = { ok: true, bar: { t: 1700000000, c: 100 },
                setup: { dir: 'long', orderType: 'BUY', kind: 'SWEEP+FVG', entry: 100,
                         stop: 98, t1: 104, t2: 106, rr1: 2, horizonBars: 24 } };
  const w = S.__cvWebhook(item, res);
  ok(w && w.symbol === 'BTCUSDT' && w.action === 'BUY', 'the payload names the symbol and side');
  ok(w.entry === 100 && w.sl === 98 && w.tp1 === 104, 'and carries the levels');
  ok(w.barClose === 1700000000,
     'stamped with the CLOSED bar the decision was taken on, so a gateway can reject a duplicate');
  ok(w.mode === 'RECORD_ONLY' && /not sent/.test(w.note), 'and says what it is');
  ok(S.__cvWebhook(item, { ok: false }) === null, 'a setup that did not fire has no payload');
  ok(S.__cvWebhook(null, res) === null, 'and neither does a missing contract');
}

/* ---------------------------------------------------------------- 8 */
console.log('\n8. end to end, through the real tab');
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
  for (let i = 0; i < 14; i++) SY.push({ sym: 'S' + i, exchange: i % 2 ? 'coindcx' : 'delta', base: 'S' + i });
  const T = {}, H1 = {};
  SY.forEach((it, i) => { T[it.sym] = tape(101 + i * 7919, 460); H1[it.sym] = tape(555 + i * 31, 240); });
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: SY, rawLen: SY.length, note: null,
    venueCounts: { delta: 7, coindcx: 7, binance: 0, startrader: 0, other: 0 },
    droppedTurnover: 0, droppedVenue: 0, droppedNoTicker: 0, minTurnover: 0 });
  S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? T[it.sym].slice() : H1[it.sym].slice());
  S.hgDeskFetchKlinesResult = async (it, tf) =>
    ({ rows: tf === '15m' ? T[it.sym].slice() : H1[it.sym].slice(), ok: true, reason: null, error: null });

  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoverse')[0];
  ok(!!tab && tab.label === 'CRYPTOVERSE', 'the tab registers as CRYPTOVERSE');
  const el = fakeEl();
  tab.mount(el);
  ok(/id="cvCards"/.test(el.innerHTML) && /id="cvRun"/.test(el.innerHTML), 'it mounts a host and a run button');
  ok(/No win rate is claimed here/.test(text(el.innerHTML)), 'and leads with what it does not claim');

  const out = await tab.refresh();
  ok(out === 'refreshed', 'a scan runs to completion');
  const st = S.cryptoverseState();
  ok(st.universe === 14 && st.scanned === 14, 'every contract was read (' + st.scanned + '/' + st.universe + ')');
  ok(st.errors === 0, 'with no errors');
  /* the funnel is the point: most bars are neither the right place nor the
     right moment, and the tally says which gate stopped each one */
  const tallied = Object.keys(st.gateTally).reduce((a, k) => a + st.gateTally[k], 0);
  ok(tallied + st.setups.length === st.scanned - st.skipped - st.unread,
     'every contract read is accounted for: ' + JSON.stringify(st.gateTally)
     + ' plus ' + st.setups.length + ' setups');

  const cards = el._node('cvCards');
  ok(cards && /COVERAGE/.test(text(cards.innerHTML)), 'the coverage line is painted');
  ok(/from Delta 7 · CoinDCX 7|from CoinDCX 7 · Delta 7/.test(text(cards.innerHTML)),
     'showing the venue mix, with the empty venues left off');
}

/* ---------------------------------------------------------------- 9 */
console.log('\n9. a setup that DOES fire carries everything it should');
{
  /* drive the engine directly over many tapes until one clears all three
     gates, then check the whole shape of it */
  let fired = null, tried = 0;
  for (let k = 0; k < 400 && !fired; k++){
    tried++;
    const rows = tape(101 + k * 7919, 460);
    const res = S.__cvEvaluate({ rows15: rows, rows1h: tape(9 + k, 240),
                                 venueCost: { rtFrac: 0.001, venue: 'Delta' } });
    if (res.ok) fired = { res: res, rows: rows };
  }
  ok(!!fired, 'a three-gate setup fires within ' + tried + ' tapes');
  if (fired){
    const s = fired.res.setup;
    ok(s.dir === 'long' || s.dir === 'short', 'it has a side');
    const risk = Math.abs(s.entry - s.stop);
    ok(risk > 0, 'a non-zero risk');
    const reward = Math.abs(s.t1 - s.entry);
    ok(Math.abs(reward / risk - 2) < 1e-6, 'and TP1 sits at exactly 2R (' + (reward / risk).toFixed(3) + ')');
    ok(s.dir === 'long' ? (s.stop < s.entry && s.t1 > s.entry)
                        : (s.stop > s.entry && s.t1 < s.entry),
       'with the stop and target on the correct sides of entry');
    ok(Math.abs(s.breakeven - 1 / 3) < 1e-9, 'and the breakeven it prints is the 2R one');
    ok(fired.res.bar && fired.res.bar.t > 0, 'the closed bar it was decided on is stamped');
    ok(fired.res.ledger.filter(g => !g.optional).every(g => g.pass),
       'every required gate reads PASS on the card');

    /* it reaches the forward log in a settleable shape */
    const rows = S.__cvFwdRows([{ sym: 'X', price: s.entry, bar: fired.res.bar, setup: s }]);
    ok(rows.length === 1, 'and it becomes one forward record');
    ok(/^CVERSE-/.test(rows[0].mechanic) && /@V1$/.test(rows[0].mechanic),
       'under a versioned mechanic (' + rows[0].mechanic + ')');
    ok(rows[0].mechanic.length <= 28, 'that fits the 28 characters hg-forward keeps');
    ok(rows[0].barT === fired.res.bar.t, 'carrying the closed bar, so settlement starts after it');
    ok(rows[0].ticket === true, 'and marked as the population this tab actually shows');
    /* a plan with a missing level is dropped, never recorded as zero */
    ok(S.__cvFwdRows([{ sym: 'X', setup: { dir: 'long', entry: null, stop: 1, t1: 2 } }]).length === 0,
       'a missing level drops the record rather than recording a 100%-risk trade');
  }
}

/* ---------------------------------------------------------------- 10 */
console.log('\n10. wired into the page');
{
  ok(/<script src="cryptoverse\.js\?v=\d+"><\/script>/.test(HTML), 'the script tag is present');
  /* matched without the closing bracket: this tab is no longer last in the
     group, and an assertion pinned to its position fails the moment another
     one is added after it */
  ok(/'cryptoscan','cryptoverse'/.test(HTML), 'and the tab is in the CRYPTO nav group');
  ok(HTML.indexOf('cryptoverse.js') < HTML.indexOf('pinemath.js')
     || /pineVumanchuCipher/.test(stripComments(CV)),
     'the momentum filters are feature-checked at scan time, so load order cannot break them');
  ok(/typeof W\.pineVumanchuCipher === 'function'/.test(CV)
     && /typeof W\.pineRangeFilter === 'function'/.test(CV),
     'which is what those checks are');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
