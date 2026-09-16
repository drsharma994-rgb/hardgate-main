#!/usr/bin/env node
/* HARDGATE — is 2R the right target, or just the one nobody tested?
   ================================================================

   Every plan OMNIGOLD publishes is exactly 2.0R. All 7,670 settled rows in
   the current walk, without exception. That is a RULE, not a measurement:
   nothing in this repo has ever compared it against what price actually
   offered.

   It is not a free choice. Breakeven at 2R is 1/(1+2) = 33.3%, and the
   walk settles between 26% and 35%. A target you cannot reach often enough
   is a losing rule however good the entry is — and the entry, measured
   separately, grosses -0.144R, so there is no surplus to spend.

   HOW THE ANSWER IS COMPUTED
   --------------------------
   backtest-omnigold.mjs now records, per filled trade:

     mfeR   max favourable excursion in R, before it resolved
     maeR   max adverse excursion in R

   Both are CONSERVATIVE: a bar that touches the stop contributes nothing
   to either, because intrabar order is unknown and that walk already
   resolves a both-touch bar as a loss. Without that rule the sweep could
   credit the high of the very bar that stopped the trade out and invent
   wins no real fill ever saw.

   A target of k R would have paid when mfeR >= k, and otherwise the trade
   keeps the outcome it actually had, floored at -1R. That is an upper
   bound on a smaller target's performance, and it is stated as one: it
   assumes the fill at k is free, which on a limit exit it roughly is and
   on a stop exit it is not.

   Costs are priced at both venues, because the answer changes: a smaller
   target earns less R per win, so a fixed cost eats proportionally more of
   it. A sweep that ignores cost always recommends the smallest target.

   Run: node scripts/target-sweep.mjs [--floor=0.5] [--json]
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const FLOOR_PCT = (() => {
  const a = argv.find(x => x.startsWith('--floor='));
  return a ? +a.split('=')[1] : 0.5;          /* GOLD_STOP_MIN_PCT, in percent */
})();

/* --in= lets the test drive this against a fixture. The sweep's arithmetic
   is the part worth testing and it must not need a network round trip to
   Binance to be exercised. */
const IN = (() => {
  const a = argv.find(x => x.startsWith('--in='));
  return a ? a.split('=')[1] : null;
})();
const FILE = IN ? path.resolve(IN) : path.join(ROOT, 'scripts', 'backtest-omnigold-results.json');
if (!fs.existsSync(FILE)){
  console.error('no walk to sweep: ' + FILE);
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const PAXG = (j.meta && j.meta.fees && j.meta.fees.roundTripFrac) || 0.0026;
const XM = 0.0002;                             /* hgOgVenueCost() XM preset */

const rows = (j.trades || []).filter(r => typeof r.rMultiple === 'number' && !r.ambiguousSameBarWin);
const withMfe = rows.filter(r => typeof r.mfeR === 'number' && isFinite(r.mfeR));

const s = a => a.reduce((x, y) => x + y, 0);
const m = a => a.length ? s(a) / a.length : NaN;
const riskOf = r => Math.abs(r.entry - r.stop);
const stopPct = r => 100 * riskOf(r) / r.entry;
const costR = (r, frac) => r.entry * frac / riskOf(r);

if (!withMfe.length){
  const out = {
    ok: false,
    reason: 'no excursion recorded',
    settledRows: rows.length,
    designR: [...new Set(rows.map(r => +(Math.abs(r.t1 - r.entry) / riskOf(r)).toFixed(1)))]
  };
  if (JSON_OUT){ console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  console.log('TARGET SWEEP — 2R, measured');
  console.log('============================\n');
  console.log('  Every one of the ' + rows.length + ' settled plans in this walk is designed at '
    + out.designR.join('/') + 'R. That is the rule this script exists to test.\n');
  console.log('  It cannot be tested yet: no trade in this artifact carries mfeR.');
  console.log('  backtest-omnigold.mjs records it as of this change, so the next');
  console.log('  full run answers the question. Until then the honest report is');
  console.log('  that 2R remains an assumption — which is itself the finding.\n');
  console.log('    node scripts/backtest-omnigold.mjs     # needs network for klines');
  console.log('    node scripts/target-sweep.mjs\n');
  console.log('  What IS knowable from this artifact, without excursion data:');
  const be = 1 / (1 + 2);
  const w = rows.filter(r => r.outcome === 'win').length;
  const l = rows.filter(r => String(r.outcome).startsWith('loss')).length;
  const wr = (w + l) ? w / (w + l) : NaN;
  console.log('    breakeven at 2.0R      : ' + (be * 100).toFixed(1) + '% of settled trades');
  console.log('    the walk actually wins : ' + (wr * 100).toFixed(1) + '% (' + w + ' of ' + (w + l) + ')');
  console.log('    shortfall              : ' + ((wr - be) * 100).toFixed(1) + ' points');
  const kept = rows.filter(r => stopPct(r) >= FLOOR_PCT);
  const kw = kept.filter(r => r.outcome === 'win').length;
  const kl = kept.filter(r => String(r.outcome).startsWith('loss')).length;
  console.log('    above the ' + FLOOR_PCT.toFixed(2) + '% stop floor : '
    + ((kw / (kw + kl)) * 100).toFixed(1) + '% on ' + (kw + kl) + ' settled — still '
    + (((kw / (kw + kl)) - be) * 100).toFixed(1) + ' points short of 2R breakeven');
  console.log('\n  A target the entry cannot reach is a losing rule however good');
  console.log('  the entry is. That shortfall is the case for running the sweep.');
  process.exit(0);
}

/* ---- the sweep proper, once a walk carries excursion ---- */
const TARGETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

function sweep(pool, frac){
  return TARGETS.map(k => {
    /* a k-R target pays when the trade ran k R in favour before resolving;
       otherwise it keeps what it actually got, floored at -1R */
    const grossEach = pool.map(r => (r.mfeR >= k) ? k : Math.max(-1, r.rMultiple));
    const netEach = pool.map((r, i) => grossEach[i] - costR(r, frac));
    const hits = pool.filter(r => r.mfeR >= k).length;
    return { k, n: pool.length, hitRate: hits / pool.length,
             breakeven: 1 / (1 + k),
             gross: m(grossEach), net: m(netEach), total: s(netEach) };
  });
}

const pools = [
  ['all settled', withMfe],
  ['above the ' + FLOOR_PCT.toFixed(2) + '% stop floor', withMfe.filter(r => stopPct(r) >= FLOOR_PCT)]
];

if (JSON_OUT){
  console.log(JSON.stringify({
    ok: true, rows: withMfe.length,
    pools: pools.map(([label, pool]) => ({
      label, paxg: sweep(pool, PAXG), xm: sweep(pool, XM)
    }))
  }, null, 2));
  process.exit(0);
}

console.log('TARGET SWEEP — 2R, measured');
console.log('============================\n');
console.log('  ' + withMfe.length + ' filled trades carry excursion.\n');
for (const [label, pool] of pools){
  if (!pool.length) continue;
  console.log('--- ' + label + ' (n=' + pool.length + ') ---');
  for (const [vn, frac] of [['PAXG', PAXG], ['XM', XM]]){
    console.log('  ' + vn);
    console.log('    target   reached   breakeven   gross      net     total');
    for (const r of sweep(pool, frac)){
      console.log('    ' + (r.k.toFixed(2) + 'R').padStart(6)
        + (r.hitRate * 100).toFixed(1).padStart(9) + '%'
        + (r.breakeven * 100).toFixed(1).padStart(11) + '%'
        + r.gross.toFixed(3).padStart(9) + 'R'
        + r.net.toFixed(3).padStart(8) + 'R'
        + r.total.toFixed(0).padStart(9) + 'R'
        + (Math.abs(r.k - 2) < 1e-9 ? '   <- what the desk ships' : ''));
    }
    const best = sweep(pool, frac).slice().sort((a, b) => b.net - a.net)[0];
    const two = sweep(pool, frac).filter(r => Math.abs(r.k - 2) < 1e-9)[0];
    console.log('    best ' + best.k.toFixed(2) + 'R at ' + best.net.toFixed(3)
      + 'R/trade vs 2.00R at ' + two.net.toFixed(3) + 'R — '
      + ((best.net - two.net) >= 0 ? '+' : '') + (best.net - two.net).toFixed(3) + 'R per trade\n');
  }
}
console.log('  UPPER BOUND, not a backtest. "mfeR >= k" assumes the exit at k');
console.log('  fills for free. On a limit take-profit that is close to true; it');
console.log('  is not a claim that this target would have been achievable net of');
console.log('  slippage on every one of these trades.');
