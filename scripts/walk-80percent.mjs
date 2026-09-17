#!/usr/bin/env node
/* HARDGATE — walk the 80PERCENT strategy over real 5m gold bars.
   ==============================================================

   The tab implements the High-Momentum Trend Dip-Buyer exactly as supplied
   and states, from arithmetic alone, that 4.00 ATR risked for 0.75 ATR needs
   84.2105% to break even before cost and ~89.7% at XM after it. What it
   cannot say is what the entries ACTUALLY hit. This does that.

   ONE IMPLEMENTATION, NOT TWO. The strategy is not re-coded here. This loads
   eightypercent.js into a sandbox and calls its own hg80Scan, so the walk
   tests the thing the tab shows. A scanner with its own copy of the rules is
   a scanner that eventually measures a strategy nobody is trading.

   WHAT IS HARD ABOUT MEASURING THIS ONE

   1. THE EXIT ORDER, NOT THE FILL. Entry is the trigger candle's CLOSE, so
      the fill is never in doubt — a market print at the close precedes
      everything after it. The ambiguity is later: on any single resolution
      bar whose range covers BOTH the target and the stop, OHLC cannot say
      which was touched first. That is a different thing from this repo's
      unprovable FILL, and it is named separately on every row
      (ambiguityKind: 'exit-order') even though it is carried through the
      same interval machinery, because its effect is identical: an outcome
      the bars cannot establish.

      It matters here more than anywhere else on this desk. One ambiguous
      bar resolved the wrong way is worth 5.33 winners. So these rows are
      never guessed — they produce an INTERVAL, via lib/unprovable-fill.mjs,
      exactly as the gold book does.

   2. GAPS REMOVE AMBIGUITY AND COST MONEY. If a bar OPENS beyond the stop,
      the fill is at that open, not at the stop, and the loss is worse than
      -1R. Modelling every stop as exactly -1R is how a 4 ATR stop looks
      safer than it is — which is the precise failure mode the spec's own
      risk warning describes. The open is the bar's first print, so a gap is
      unambiguous; it is priced at the open, both ways.

   3. ONE POSITION AT A TIME. Signals fire on consecutive bars in a trend.
      Taking all of them is a record nobody could have traded. The book here
      is sequential: take a signal when flat, hold it to its own exit, count
      everything that fires meanwhile as skipped.

   4. COST IS THE WHOLE QUESTION. A 0.75 ATR target on 5m gold is a couple of
      dollars and the spread is most of one. Every number is reported gross
      AND net at both venues, because the gross number is not the one that
      decides anything.

   Run:
     node scripts/walk-80percent.mjs [--bars=N] [--horizon=N] [--refresh]
                                     [--symbol=PAXGUSDT] [--json]

   Writes scripts/walk-80percent-results.json.
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { boundRows, winRateBounds, thresholdVsInterval } from '../lib/unprovable-fill.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const CACHE_DIR = path.join(ROOT, '.cache', 'walk-80percent');
const OUT = path.join(ROOT, 'scripts', 'walk-80percent-results.json');

const argv = process.argv.slice(2);
const argOf = (k, d) => {
  const hit = argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const BARS     = Math.max(600, parseInt(argOf('bars', '20000'), 10) || 20000);
/* No time stop is specified by the strategy. An unbounded hold never
   resolves some trades, so one is imposed and its expiries are reported
   SEPARATELY — never folded into wins or losses. 288 x 5m is 24 hours. */
const HORIZON  = Math.max(12, parseInt(argOf('horizon', '288'), 10) || 288);
const SYMBOL   = argOf('symbol', 'PAXGUSDT');
const REFRESH  = argv.includes('--refresh');
const JSON_OUT = argv.includes('--json');

/* Venue round trips, the same two the gold desk prices every card at. */
const VENUES = { XM: 0.00020, PAXG: 0.0026 };

const log = (...a) => { if (!JSON_OUT) console.log(...a); };

/* ==================== 1. DATA ==================== */

async function jget(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'hardgate-80percent-walk/1.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.json();
}

async function fetchKlines(symbol, target){
  const ivMs = 5 * 60 * 1000;
  let out = [], endTime;
  while (out.length < target){
    const lim = Math.min(1000, target - out.length + 2);
    let url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol
            + '&interval=5m&limit=' + lim;
    if (endTime) url += '&endTime=' + endTime;
    const batch = await jget(url);
    if (!Array.isArray(batch) || !batch.length) break;
    out = batch.concat(out);
    endTime = batch[0][0] - 1;
    if (batch.length < lim) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const seen = new Set();
  const rows = out
    .filter(k => { if (seen.has(k[0])) return false; seen.add(k[0]); return true; })
    .map(k => ({ t: Math.floor(k[0] / 1000), o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))
    .sort((a, b) => a.t - b.t);
  /* the forming bar has not closed, so it is not a bar */
  while (rows.length && (rows[rows.length - 1].t * 1000 + ivMs) > Date.now()) rows.pop();
  return rows;
}

async function cachedKlines(symbol, target){
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, symbol + '-5m.json');
  if (!REFRESH && fs.existsSync(file)){
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j.rows && j.rows.length >= target){
        log('  cache hit: ' + j.rows.length + ' bars ('
          + ((Date.now() - j.fetchedAt) / 3.6e6).toFixed(1) + 'h old)');
        return j.rows.slice(-target);
      }
    } catch (e) { /* refetch */ }
  }
  log('  fetching ' + symbol + ' 5m x' + target + ' ...');
  const rows = await fetchKlines(symbol, target);
  if (rows.length) fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), symbol, rows }));
  return rows;
}

/* ==================== 2. THE STRATEGY — the tab's own code ==================== */

export function loadStrategy(){
  const store = {};
  const el = () => ({ style: {}, innerHTML: '', textContent: '', className: '',
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    appendChild(){}, setAttribute(){}, addEventListener(){},
    querySelector: () => null, querySelectorAll: () => [], dataset: {} });
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
    parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
    Float64Array, setTimeout: () => 0, clearTimeout: () => {},
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); },
                    removeItem: k => { delete store[k]; } } };
  ctx.document = { createElement: el, getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], head: el(), body: el(), documentElement: el(),
    addEventListener(){}, readyState: 'complete' };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  /* indicators.js for ema/rsi/atr, then the tab itself */
  for (const f of ['indicators.js', 'indicators2.js', 'eightypercent.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  if (typeof ctx.hg80Scan !== 'function') throw new Error('eightypercent.js did not export hg80Scan');
  return ctx;
}

/* ==================== 3. RESOLUTION ==================== */

/* Walk bars forward from the signal and settle one position.

   Order within a bar is decided by what OHLC can actually establish:
     the OPEN is the first print, so a gap through either level is certain;
     otherwise, if only one level is inside the bar's range, that one was hit;
     if BOTH are, nothing can be established and the row is flagged.

   THE TAB OWNS THIS TOO. eightypercent.js exports hg80Resolve and its own
   STILL OPEN / RESOLVED panels call it, so the resolver lives beside the
   strategy it resolves and this file delegates rather than keeping a second
   copy. Two copies of an exit rule is how a walk ends up measuring outcomes
   the tab would never have printed — the same failure a second copy of the
   ENTRY rules would cause, and it is guarded the same way.

   The sandbox is loaded once and cached, so importing resolve() costs one
   file read and no network. */
let __ctx = null;
function strategy(){
  if (!__ctx) __ctx = loadStrategy();
  return __ctx;
}

export function resolve(rows, i, plan, horizon){
  return strategy().hg80Resolve(rows, i, plan, horizon);
}

/* ==================== 4. THE WALK ==================== */

export function wilson(wins, n, z){
  z = isFinite(z) ? z : 1.96;
  if (!(n > 0) || !(wins >= 0) || wins > n) return null;
  const p = wins / n, z2 = z * z, denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p };
}

/* HOW OFTEN EACH CONDITION HOLDS, AND HOW OFTEN THEY COINCIDE.

   Without this, a walk that returns three trades looks like a bug or a data
   problem. It is neither, and the reason is structural rather than
   incidental:

     a LONG needs close > EMA50 (price above its recent mean) AND RSI(14)
     < 45 (the last fourteen bars net DOWN). On a 5m chart those two are
     close to mutually exclusive — fourteen net-down bars usually leave the
     close below a 50-period EMA.

   So the breakdown reports each condition's own frequency, the pair
   frequency, and what INDEPENDENCE would have predicted. The ratio between
   the last two is the number that explains the trade count, and it is the
   kind of thing that should be measured on the user's real bars rather
   than argued about. */
export function conditionCensus(rows, ctx){
  const ind = ctx.hg80Indicators(rows);
  if (!ind) return null;
  const side = () => ({ trend: 0, pullback: 0, trigger: 0, trendPull: 0, three: 0, fired: 0 });
  const out = { evaluable: 0, session: 0, long: side(), short: side() };
  for (let i = 0; i < rows.length; i++){
    const s = ctx.hg80SignalAt(rows, ind, i);
    if (!s) continue;
    out.evaluable++;
    if (s.longChecks.session) out.session++;
    for (const [key, ch] of [['long', s.longChecks], ['short', s.shortChecks]]){
      const x = out[key];
      if (ch.trend) x.trend++;
      if (ch.pullback) x.pullback++;
      if (ch.trigger) x.trigger++;
      if (ch.trend && ch.pullback) x.trendPull++;
      if (ch.trend && ch.pullback && ch.trigger) x.three++;
      if (ch.trend && ch.pullback && ch.trigger && ch.session) x.fired++;
    }
  }
  const n = out.evaluable || 1;
  for (const key of ['long', 'short']){
    const x = out[key];
    x.pTrend = x.trend / n;
    x.pPullback = x.pullback / n;
    x.pTrendPull = x.trendPull / n;
    /* what you would see if trend and pullback were unrelated */
    x.pIfIndependent = x.pTrend * x.pPullback;
    x.rarerThanIndependent = x.pTrendPull > 0 ? (x.pIfIndependent / x.pTrendPull) : null;
  }
  return out;
}

export function run(rows, ctx){
  const scan = ctx.hg80Scan(rows);
  if (!scan.ok) throw new Error(scan.why);
  const spec = ctx.HG_P80_SPEC;

  /* sequential book: one position at a time */
  const trades = [];
  let skipped = 0, openUntil = -1;

  for (const s of scan.signals){
    if (s.i <= openUntil){ skipped++; continue; }
    const plan = s.plan;
    const res = resolve(rows, s.i, plan, HORIZON);
    if (!res) continue;
    openUntil = s.i + res.bars;

    const row = {
      tISO: new Date(s.t * 1000).toISOString(),
      dir: s.dir, kind: 'P80-DIP-' + s.dir.toUpperCase(),
      entry: plan.entry, stop: plan.stop, t1: plan.t1,
      atr: s.atr, rsi: s.rsi, ema50: s.ema50, ema200: s.ema200,
      riskPx: Math.abs(plan.entry - plan.stop),
      rewardPx: Math.abs(plan.t1 - plan.entry),
      stopPct: (Math.abs(plan.entry - plan.stop) / plan.entry) * 100,
      /* MARKET entry at the close — the fill itself is never in doubt */
      orderType: 'MARKET',
      outcome: res.outcome, exit: res.exit, rMultiple: res.rMultiple,
      barsHeld: res.bars, exitISO: new Date(res.exitT * 1000).toISOString(),
      gapped: res.gapped,
      /* the ambiguity here is the EXIT ORDER, not the fill. Carried on the
         repo's flag so the interval machinery works unchanged, and named
         so nobody reads it as a fill problem. */
      unprovableFill: res.ambiguous,
      ambiguityKind: res.ambiguous ? 'exit-order' : null
    };
    for (const [v, rt] of Object.entries(VENUES)){
      row['costR_' + v] = (plan.entry * rt) / row.riskPx;
      row['netR_' + v] = row.rMultiple - row['costR_' + v];
    }
    trades.push(row);
  }
  return { trades, skipped, scanned: scan.signals.length, spec,
           census: conditionCensus(rows, ctx) };
}

export function summarise(trades){
  const settled = trades.filter(r => r.outcome === 'win' || r.outcome === 'loss');
  const expired = trades.filter(r => r.outcome === 'expired');
  const bounds = winRateBounds(settled);

  /* the bar this configuration has to clear, from the spec's own multiples */
  const specTP = 0.75, specSL = 4.0;
  const grossBE = specSL / (specSL + specTP);

  const out = {
    trades: trades.length, settled: settled.length, expired: expired.length,
    ambiguous: settled.filter(r => r.unprovableFill).length,
    gapped: settled.filter(r => r.gapped).length,
    grossBreakeven: grossBE,
    winRate: bounds,
    /* AMBIGUITY ONLY — what the bars can establish if the sample were
       infinite. Reported because it isolates one of the two uncertainties,
       NEVER as the verdict: on 9 wins and 1 loss it says 'below' (i.e.
       established above the bar), which is nonsense on ten trades. */
    verdictVsAmbiguityOnly: thresholdVsInterval(settled, grossBE),
    byBound: {}
  };

  for (const bound of ['lower', 'point', 'upper']){
    const rs = boundRows(settled, bound);
    const w = rs.filter(r => r.outcome === 'win').length;
    const n = rs.length;
    const mean = key => n ? rs.reduce((s, r) => s + (r[key] || 0), 0) / n : null;
    out.byBound[bound] = {
      n, wins: w, hit: n ? w / n : null,
      wilson95: wilson(w, n, 1.96),
      grossR: mean('rMultiple'),
      netR_XM: mean('netR_XM'),
      netR_PAXG: mean('netR_PAXG')
    };
  }

  /* THE VERDICT COMBINES BOTH UNCERTAINTIES.

     There are two independent reasons this walk might not know the win
     rate, and either alone is not enough to decide anything:

       AMBIGUITY   bars that cannot order the target against the stop, which
                   spread the rate between a lower and an upper bound
       SAMPLING    the ordinary error of measuring a rate on n trades

     A claim in the desk's favour has to survive BOTH at their worst: the
     Wilson lower limit computed on the LOWER bound's rows. A condemnation
     has to survive both at their best. Anything else is 'not established',
     which is the answer this will almost certainly give for a long time and
     is a real answer rather than a failure.

     Using thresholdVsInterval alone here would have reported nine wins out
     of ten as an established edge. */
  const lo = out.byBound.lower, hi = out.byBound.upper;
  const loW = lo && lo.n ? wilson(lo.wins, lo.n, 1.96) : null;
  const hiW = hi && hi.n ? wilson(hi.wins, hi.n, 1.96) : null;
  out.verdict = {
    threshold: grossBE,
    worstCaseLo: loW ? loW.lo : null,
    bestCaseHi: hiW ? hiW.hi : null,
    state: (!loW || !hiW) ? 'no-data'
         : (loW.lo > grossBE) ? 'established-above'
         : (hiW.hi < grossBE) ? 'established-below'
         : 'not-established',
    why: 'the Wilson 95% lower limit on the ambiguity LOWER bound must clear '
       + (100 * grossBE).toFixed(4) + '% for an edge, and the upper limit on the UPPER '
       + 'bound must fail it for a condemnation'
  };

  /* AND THE ONE THAT ACTUALLY DECIDES. A win rate above the gross bar still
     loses money if net R is negative, which is the entire question for a
     0.75 ATR target priced against a fixed spread. */
  out.paysAtVenue = {};
  for (const v of Object.keys(VENUES)){
    out.paysAtVenue[v] = {
      lower: lo ? lo['netR_' + v] : null,
      point: out.byBound.point ? out.byBound.point['netR_' + v] : null,
      upper: hi ? hi['netR_' + v] : null,
      positiveAtEveryBound: [lo, out.byBound.point, hi]
        .every(x => x && isFinite(x['netR_' + v]) && x['netR_' + v] > 0)
    };
  }
  return out;
}

/* ==================== 5. MAIN ==================== */

const IS_MAIN = (() => {
  try { return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch (e){ return false; }
})();

/* Guarded so a test can import resolve() and friends without the walk
   firing a network fetch on import — the engine has to be checkable
   without the data it cannot reach. */
async function main(){
  log('80PERCENT — 5m walk');
  log('===================\n');

  let rows;
  try {
    rows = await cachedKlines(SYMBOL, BARS);
  } catch (e){
    const msg = String((e && e.message) || e);
    const blocked = /403|CONNECT|ENOTFOUND|fetch failed|EAI_AGAIN/i.test(msg);
    const payload = { ok: false, ran: false,
      blocked: blocked ? 'network' : 'fetch',
      error: msg,
      note: blocked
        ? 'the kline host is unreachable from here (a gateway policy denial answers 403 to '
          + 'CONNECT and will not clear on a retry) — this walk needs open outbound access'
        : 'the fetch failed for a reason other than a network block' };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else { console.error('\n  CANNOT RUN: ' + payload.note); console.error('  ' + msg); }
    process.exit(1);
  }

  if (!rows || rows.length < 600){
    const payload = { ok: false, ran: false, blocked: 'data',
      error: 'got ' + (rows ? rows.length : 0) + ' bars, need at least 600',
      note: 'EMA(200) alone needs 200 bars before the first evaluable candle' };
    if (JSON_OUT) console.log(JSON.stringify(payload, null, 2));
    else console.error('\n  CANNOT RUN: ' + payload.note);
    process.exit(1);
  }

  log('  ' + rows.length + ' bars  ' + new Date(rows[0].t * 1000).toISOString().slice(0, 16)
    + ' .. ' + new Date(rows[rows.length - 1].t * 1000).toISOString().slice(0, 16) + ' UTC\n');

  const ctx = loadStrategy();
  const { trades, skipped, scanned, spec, census } = run(rows, ctx);
  const sum = summarise(trades);

  const bake = {
    ok: true, ran: true,
    generated: new Date().toISOString(),
    symbol: SYMBOL,
    note: SYMBOL + ' 5m is a proxy for XAUUSD; it prints 24/7 bars a gold broker never did, '
        + 'and its basis to spot runs 0.1-0.5%. The session filter is applied on the bar\'s '
        + 'own UTC hour, so the window is honoured, but weekend bars inside 13:00-18:00 are '
        + 'bars no broker offered.',
    spec, horizonBars: HORIZON, venues: VENUES,
    window: { from: new Date(rows[0].t * 1000).toISOString(),
              to: new Date(rows[rows.length - 1].t * 1000).toISOString(), bars: rows.length },
    signals: { fired: scanned, taken: trades.length, skippedWhileInPosition: skipped },
    conditions: census,
    summary: sum,
    trades
  };

  fs.writeFileSync(OUT, JSON.stringify(bake, null, 2));

  if (JSON_OUT){ console.log(JSON.stringify(bake, null, 2)); return; }

  const pct = v => (v == null ? '—' : (100 * v).toFixed(2) + '%');
  const r3 = v => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(4) + 'R');

  if (census){
    const p2 = v => (100 * v).toFixed(2) + '%';
    log('  WHY THE TRADE COUNT IS WHAT IT IS');
    log('    evaluable bars ' + census.evaluable + ', of which ' + census.session
      + ' (' + p2(census.session / census.evaluable) + ') are inside 13:00-18:00 UTC');
    log('    side   trend     pullback   together   if independent   rarer by');
    for (const k of ['long', 'short']){
      const x = census[k];
      log('    ' + k.padEnd(7) + p2(x.pTrend).padEnd(10) + p2(x.pPullback).padEnd(11)
        + p2(x.pTrendPull).padEnd(11) + p2(x.pIfIndependent).padEnd(17)
        + (x.rarerThanIndependent ? x.rarerThanIndependent.toFixed(1) + 'x' : '—'));
    }
    log('    A long needs price ABOVE its 50 EMA while RSI(14) says the last fourteen bars');
    log('    were net DOWN. Those two fight each other, which is why the pair is far rarer');
    log('    than either alone — not a bug, and not a data problem.');
    log('');
  }
  log('  signals fired            ' + scanned);
  log('  taken (one at a time)    ' + trades.length + '   skipped while in a position ' + skipped);
  log('  settled / expired        ' + sum.settled + ' / ' + sum.expired);
  log('  ambiguous exit bars      ' + sum.ambiguous
    + '   (both target and stop inside one bar — OHLC cannot order them)');
  log('  gapped exits             ' + sum.gapped + '   (filled at the open, past the level)');
  log('');
  log('  THE BAR: ' + pct(sum.grossBreakeven) + ' before cost, from the spec\'s own 4.00 / 0.75.');
  log('');
  log('  bound      n      hit       Wilson 95%            gross      net XM     net PAXG');
  for (const b of ['lower', 'point', 'upper']){
    const x = sum.byBound[b];
    const w = x.wilson95;
    log('  ' + b.padEnd(9) + String(x.n).padEnd(7)
      + pct(x.hit).padEnd(10)
      + (w ? (pct(w.lo) + ' .. ' + pct(w.hi)).padEnd(22) : '—'.padEnd(22))
      + r3(x.grossR).padEnd(11) + r3(x.netR_XM).padEnd(11) + r3(x.netR_PAXG));
  }
  log('');
  const V = sum.verdict;
  log('  VERDICT (ambiguity AND sampling error, both at their worst):');
  if (V.state === 'established-above')
    log('    the win rate IS established above ' + pct(sum.grossBreakeven)
      + ' — worst-case lower limit ' + pct(V.worstCaseLo) + '.');
  else if (V.state === 'established-below')
    log('    the win rate IS established BELOW ' + pct(sum.grossBreakeven)
      + ' — best-case upper limit ' + pct(V.bestCaseHi) + '.');
  else if (V.state === 'not-established')
    log('    NOT ESTABLISHED either way — worst case ' + pct(V.worstCaseLo)
      + ', best case ' + pct(V.bestCaseHi) + ', and ' + pct(sum.grossBreakeven) + ' sits inside.');
  else log('    no settled trades to judge.');
  log('    (ambiguity alone would say: ' + (sum.verdictVsAmbiguityOnly || 'n/a')
    + ' — reported separately because on its own it ignores sample size)');
  log('');
  log('  DOES IT PAY? A win rate above ' + pct(sum.grossBreakeven)
    + ' still loses money if net R is negative.');
  for (const v of Object.keys(VENUES)){
    const p = sum.paysAtVenue[v];
    log('    ' + v.padEnd(5) + ' net R  lower ' + r3(p.lower) + '  point ' + r3(p.point)
      + '  upper ' + r3(p.upper)
      + '   -> ' + (p.positiveAtEveryBound ? 'pays at EVERY bound' : 'does NOT pay at every bound'));
  }
  log('\n  wrote ' + path.relative(ROOT, OUT));
}

if (IS_MAIN) main();
