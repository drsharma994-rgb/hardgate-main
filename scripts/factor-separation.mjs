#!/usr/bin/env node
/**
 * hg-v922 — which signal-time factor actually separates winners, on both gold
 * desks, at both fill bounds, across DISJOINT windows.
 *
 * The question this answers is "how do we raise the win rate", and the first
 * thing it does is refuse the easy version of it: a win rate can be raised
 * arbitrarily by shrinking the target, so every factor here is reported with
 * win% AND net R together, and a factor that buys one with the other is not a
 * candidate. Mean planned R:R is printed beside each split so that trade is
 * visible when it happens.
 *
 * Method, and why each piece is here:
 *   - DISJOINT windows (scripts/disjoint-windows.mjs). hg-v920 found five
 *     packs reading three NESTED splits as three confirmations. Four windows
 *     that share no trade; a claim "holds" only when all four agree.
 *   - BOTH fill bounds. hg-v918: rows that resolved on their own fill bar are
 *     unprovable. The lower bound deletes those wins and keeps those losses,
 *     which punishes tight-stop rows hardest — exactly the cohort a stop-width
 *     claim is about. So the as-recorded end is the CONSERVATIVE one for that
 *     claim and a verdict must survive there.
 *   - GROSS reported beside NET. costR = rtCostPct / stopPct exactly, so any
 *     stop-width split moves net by arithmetic alone. Only the gross column
 *     can say whether the setups themselves are better.
 *
 * Nothing here decides an action. It reports; goldind.js and omnigold.js carry
 * the numbers and tests/test-factor-separation.mjs re-runs this against the
 * committed replays so those literals cannot drift.
 *
 * Usage: node scripts/factor-separation.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { compareDisjoint } from './disjoint-windows.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCALP_REPLAY = join(HERE, 'backtest-goldscalp-results-floor.json');
export const OG_REPLAY = join(HERE, 'backtest-omnigold-results.json');

export const WINDOWS = 4;
export const XM_RT_PCT = 0.020;          /* XM XAUUSD round trip, the desk preset */
export const COST_BAR_PCT = 0.16;        /* hg-v912 scalp cost reject */
export const SUPPRESSED = ['vwap', 'nyexh', 'liqsweep', 'sweep'];
export const MIN_SIDE_SCALP = 15;
export const MIN_SIDE_OG = 30;

const r4 = (x) => Math.round(x * 10000) / 10000;
const r1 = (x) => Math.round(x * 10) / 10;
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
export const stopPct = (t) => {
  const e = t && t.entry, s = t && t.stop;
  if (!(typeof e === 'number' && typeof s === 'number' && e > 0)) return 0;
  return Math.abs(e - s) / e * 100;
};

/* ---- the two books, each at both fill bounds ------------------------------
   `as-recorded` keeps a same-bar win as the walk scored it; `lower` demotes
   every row the walk flagged unprovable to a full stop-out. Nothing else
   differs between the two, so a verdict that changes between them is a
   verdict about the fill, not about the factor. */
/* The `outcome !== 'unfilled'` guard in both readers is REDUNDANT on the
   committed replays — an unfilled row carries no numeric netR / rMultiple, so
   the type check already drops all 160 scalp and 1,765 OMNIGOLD of them. It
   stays anyway, and the test proves it is redundant rather than assuming it:
   a re-bake that started scoring an unfilled row as 0R would otherwise fold
   every missed entry into the book as a flat trade and quietly lift both
   desks' win rates toward 50% on trades nobody took. */
export function scalpBook(end, path = SCALP_REPLAY){
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return raw.trades
    .filter((t) => typeof t.netR === 'number' && !t.shadow && t.outcome !== 'unfilled'
      && !SUPPRESSED.includes(t.stratKey) && stopPct(t) >= COST_BAR_PCT)
    .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)))
    .map((t) => {
      const g = (end === 'lower' && t.ambiguousSameBarWin) ? -1 : t.rGross;
      return Object.assign({}, t, { g: g, cost: t.costR_xm, net: g - t.costR_xm });
    });
}

export function ogBook(end, path = OG_REPLAY){
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return raw.trades
    .filter((t) => t.outcome !== 'unfilled' && typeof t.rMultiple === 'number' && t.entry > 0)
    .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)))
    .map((t) => {
      const g = (end === 'lower' && t.ambiguousSameBarWin) ? -1 : t.rMultiple;
      const cost = XM_RT_PCT / stopPct(t);
      return Object.assign({}, t, { g: g, cost: cost, net: g - cost });
    });
}

/* ---- one factor, one book -------------------------------------------------
   Every number a reader needs to judge the split without re-running this:
   both sides' n, win%, gross, net, mean planned R:R, and how many of the four
   disjoint windows agreed on each of win, gross and net. */
export function measure(book, pick, minSide, rrOf){
  const A = book.filter(pick), B = book.filter((t) => !pick(t));
  if (A.length < minSide * WINDOWS || B.length < minSide * WINDOWS){
    return { thin: true, nA: A.length, nB: B.length };
  }
  const win = (r) => r.filter((t) => t.g > 0).length / r.length * 100;
  const w = compareDisjoint(book, WINDOWS, pick, (t) => !pick(t), (t) => (t.g > 0 ? 1 : 0), minSide);
  const g = compareDisjoint(book, WINDOWS, pick, (t) => !pick(t), (t) => t.g, minSide);
  const n = compareDisjoint(book, WINDOWS, pick, (t) => !pick(t), (t) => t.net, minSide);
  return {
    thin: false, nA: A.length, nB: B.length,
    winA: r1(win(A)), winB: r1(win(B)), dWin: r1(win(A) - win(B)),
    grossA: r4(mean(A.map((t) => t.g))), grossB: r4(mean(B.map((t) => t.g))),
    dGross: r4(mean(A.map((t) => t.g)) - mean(B.map((t) => t.g))),
    netA: r4(mean(A.map((t) => t.net))), netB: r4(mean(B.map((t) => t.net))),
    dNet: r4(mean(A.map((t) => t.net)) - mean(B.map((t) => t.net))),
    rrA: rrOf ? r4(mean(A.map(rrOf))) : null, rrB: rrOf ? r4(mean(B.map(rrOf))) : null,
    winQ: [w.aBetter, w.judged], grossQ: [g.aBetter, g.judged], netQ: [n.aBetter, n.judged],
    /* the bar: every judged window agrees, on win AND gross AND net. Net alone
       is not enough — a stop-width split moves net by arithmetic.
       `holds` is that bar met in the FAVOURABLE direction. `unanimous` is the
       bar met at all, so a factor the desk believes in that is unanimously
       WORSE (OMNIGOLD's limit orders) is not invisible for having the wrong
       sign — it is the same strength of evidence, pointing the other way. */
    unanimous: w.unanimous && g.unanimous && n.unanimous,
    sign: (w.unanimous && g.unanimous && n.unanimous)
      ? (w.aBetter === w.judged ? 'better' : 'worse') : null,
    holds: w.unanimous && g.unanimous && n.unanimous && w.aBetter === w.judged
  };
}

export const SCALP_FACTORS = [
  ['tally >= 8',      (t) => +t.tally >= 8],
  ['grade A',         (t) => /A$/.test(String(t.grade || ''))],
  ['not demoted',     (t) => !t.demoted],
  ['dir long',        (t) => t.dir === 'long'],
  ['London 07-11z',   (t) => t.utcHour >= 7 && t.utcHour < 11],
  ['NY 12-16z',       (t) => t.utcHour >= 12 && t.utcHour < 16],
  ['LIMIT order',     (t) => /LIMIT$/.test(t.orderType || '')],
  ['stopAtr > 1.5',   (t) => +t.stopAtr > 1.5],
  ['stop >= 0.28%',   (t) => stopPct(t) >= 0.28],
  ['stop >= 0.50%',   (t) => stopPct(t) >= 0.50]
];

export const OG_FACTORS = [
  ['tier STRONG',     (t) => t.tier === 'STRONG'],
  ['tier FAIR',       (t) => t.tier === 'FAIR'],
  ['confluence>=50',  (t) => +t.confluence >= 50],
  ['checksPass >= 4', (t) => +t.checksPass >= 4],
  ['ticket',          (t) => !!t.ticket],
  ['horizon SCALP',   (t) => t.horizon === 'SCALP'],
  ['dir long',        (t) => t.dir === 'long'],
  ['LIMIT order',     (t) => /LIMIT$/.test(t.orderType || '')],
  ['stop >= 0.28%',   (t) => stopPct(t) >= 0.28],
  ['stop >= 0.50%',   (t) => stopPct(t) >= 0.50]
];

export function run(){
  const out = { scalp: {}, og: {}, bars: { scalp: {}, og: {} }, book: {} };
  for (const end of ['as-recorded', 'lower']){
    const sb = scalpBook(end), ob = ogBook(end);
    out.book[end] = {
      scalp: { n: sb.length, win: r1(sb.filter((t) => t.g > 0).length / sb.length * 100),
               gross: r4(mean(sb.map((t) => t.g))), net: r4(mean(sb.map((t) => t.net))) },
      og:    { n: ob.length, win: r1(ob.filter((t) => t.g > 0).length / ob.length * 100),
               gross: r4(mean(ob.map((t) => t.g))), net: r4(mean(ob.map((t) => t.net))) }
    };
    out.scalp[end] = {};
    for (const [name, f] of SCALP_FACTORS) out.scalp[end][name] = measure(sb, f, MIN_SIDE_SCALP, (t) => +t.rr);
    out.og[end] = {};
    for (const [name, f] of OG_FACTORS) out.og[end][name] = measure(ob, f, MIN_SIDE_OG, null);
    /* The bar sweep exists to answer whether a stop bar is a MEASURED VALUE or
       a picked one. A direction that holds at every bar is a direction; one
       that holds at 0.28 and 0.50 but breaks at 0.40 names no number. */
    out.bars.scalp[end] = {};
    for (const bar of [0.20, 0.24, 0.28, 0.32, 0.40, 0.50, 0.60]){
      out.bars.scalp[end][bar.toFixed(2)] = measure(sb, (t) => stopPct(t) >= bar, MIN_SIDE_SCALP, (t) => +t.rr);
    }
    out.bars.og[end] = {};
    for (const bar of [0.28, 0.40, 0.50, 0.60, 0.80]){
      out.bars.og[end][bar.toFixed(2)] = measure(ob, (t) => stopPct(t) >= bar, MIN_SIDE_OG, null);
    }
  }
  return out;
}

function fmt(x, d){ return (x >= 0 ? '+' : '') + x.toFixed(d === undefined ? 4 : d); }
function row(name, m){
  if (m.thin) return '  ' + name.padEnd(17) + ' thin (' + m.nA + '/' + m.nB + ')';
  return '  ' + name.padEnd(17)
    + ' n=' + String(m.nA).padStart(5)
    + '  win ' + String(m.winA.toFixed(1)).padStart(5) + '% (' + fmt(m.dWin, 1) + ')'
    + '  gross ' + fmt(m.grossA) + ' (' + fmt(m.dGross) + ')'
    + '  net ' + fmt(m.netA) + ' (' + fmt(m.dNet) + ')'
    + (m.rrA !== null ? '  rr ' + m.rrA.toFixed(2) + '/' + m.rrB.toFixed(2) : '')
    + '  | ' + m.winQ.join('/') + ' ' + m.grossQ.join('/') + ' ' + m.netQ.join('/')
    + (m.holds ? '  HOLDS' : (m.sign === 'worse' ? '  HOLDS (WORSE)' : ''));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])){
  const res = run();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); }
  else {
    console.log('hg-v922 factor separation — %d disjoint windows, both fill bounds\n', WINDOWS);
    console.log('  columns: n of the TRUE side, win% (difference vs the false side),');
    console.log('  gross R (difference), net R at XM (difference), mean planned R:R true/false,');
    console.log('  then windows agreeing on win / gross / net. HOLDS = all three unanimous.\n');
    for (const end of ['as-recorded', 'lower']){
      console.log('=== %s bound ===', end);
      console.log('  GOLD SCALP  n=%d  win %s%%  gross %s  net %s', res.book[end].scalp.n,
        res.book[end].scalp.win.toFixed(1), fmt(res.book[end].scalp.gross), fmt(res.book[end].scalp.net));
      for (const [name] of SCALP_FACTORS) console.log(row(name, res.scalp[end][name]));
      console.log('  OMNIGOLD    n=%d  win %s%%  gross %s  net %s', res.book[end].og.n,
        res.book[end].og.win.toFixed(1), fmt(res.book[end].og.gross), fmt(res.book[end].og.net));
      for (const [name] of OG_FACTORS) console.log(row(name, res.og[end][name]));
      console.log('');
    }
    console.log('=== stop bar sweep — does the direction name a VALUE? ===');
    for (const desk of ['scalp', 'og']){
      for (const end of ['as-recorded', 'lower']){
        const bars = res.bars[desk][end];
        console.log('  %s %s: %s', desk.toUpperCase().padEnd(5), end.padEnd(11),
          Object.keys(bars).map((b) => b + (bars[b].thin ? ':thin' : (bars[b].holds ? ':HOLDS' : ':' + bars[b].grossQ.join('/')))).join('  '));
      }
    }
  }
}

/* ---- the committed literal --------------------------------------------- */
/* One compact row per factor, both bounds side by side, so a reader can see
   at a glance whether a verdict survived the fill ambiguity or only exists at
   one end. `q` is "win/gross/net" windows agreeing, per bound. */
export function bake(res){
  const r = res || run();
  const pack = (deskKey, factors) => {
    const rows = factors.map(([name]) => {
      const a = r[deskKey]['as-recorded'][name], l = r[deskKey].lower[name];
      if (a.thin) return { f: name, thin: true, n: a.nA };
      return {
        f: name, n: a.nA,
        dWin: [a.dWin, l.dWin], dGross: [a.dGross, l.dGross], dNet: [a.dNet, l.dNet],
        q: [a.winQ.join('/') + ' ' + a.grossQ.join('/') + ' ' + a.netQ.join('/'),
            l.winQ.join('/') + ' ' + l.grossQ.join('/') + ' ' + l.netQ.join('/')],
        /* a verdict only when BOTH bounds agree in the same direction — the
           hg-v918 rule. One end is not a verdict. */
        verdict: (a.sign && a.sign === l.sign) ? a.sign : null
      };
    });
    const barKeys = Object.keys(r.bars[deskKey]['as-recorded']);
    return {
      book: { asRecorded: r.book['as-recorded'][deskKey], lower: r.book.lower[deskKey] },
      rows: rows,
      bars: barKeys.map((b) => ({
        bar: +b,
        n: r.bars[deskKey]['as-recorded'][b].nA,
        holds: [!!r.bars[deskKey]['as-recorded'][b].holds, !!r.bars[deskKey].lower[b].holds]
      }))
    };
  };
  return {
    windows: WINDOWS, rtPct: XM_RT_PCT,
    scalp: pack('scalp', SCALP_FACTORS),
    og: pack('og', OG_FACTORS)
  };
}
