#!/usr/bin/env node
/* HARDGATE — re-bake OMNIGOLD's evidence over trades a person could take.
   ======================================================================

   HG_OG_REPLAY_EVIDENCE quotes its record over EVERY plan the scan forms.
   On this walk that is 59.4 plans a day on one instrument, 9.34 per 4h
   bar, with a time-weighted mean of 57 positions open at once and a peak
   of 109.

   Two things follow, and both of them make the numbers on the cards wrong
   in the same direction — too confident.

   1. POPULATION. A person holds one gold position, not 57. The record of
      "every plan formed" describes trades nobody took. The SEQUENTIAL book
      below is the honest one: walk the plans in time order, take one when
      flat, hold it to its own exit, skip everything that fires while it
      runs. Same plans, same exits, no lookahead — just the constraint a
      human actually has.

      It is not a small difference. Priced at XM, every plan formed nets
      -0.252R a trade; ticket-only, one at a time, it nets +0.030R.

   2. INDEPENDENCE. Every Wilson interval and z-score on a card assumes n
      independent trades. Fifty-seven simultaneous positions on one
      instrument is one bet repeated, so the real information content is
      far below the row count. Clustering the per-trade R by firing day
      deflates t by ~1.8x; by week, more. This bake reports an EFFECTIVE
      sample size — the n that would produce the observed clustered
      standard error if the trades really were independent — so an
      interval can be widened to what the evidence supports.

      effN is never allowed to exceed n. A clustering that happens to come
      out tighter than independence is sampling noise, not extra
      information, and rounding it up would hand back exactly the
      overconfidence this exists to remove.

   Writes scripts/omnigold-replay-evidence.json (adding `sequential` and
   `effective`) and prints a paste-ready block for the constant in
   omnigold.js. Never invents a row: a cohort with no settled trades is
   omitted, not zero-filled.

   Run: node scripts/omnigold-evidence-bake.mjs [--write] [--json]
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundRows, isUnprovableFill, winRateBounds, thresholdVsInterval,
         unprovableNote } from '../lib/unprovable-fill.mjs';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)));
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const JSON_OUT = argv.includes('--json');

const WALK = path.join(ROOT, 'scripts', 'backtest-omnigold-results.json');
if (!fs.existsSync(WALK)){ console.error('no walk at ' + WALK); process.exit(1); }
const walk = JSON.parse(fs.readFileSync(WALK, 'utf8'));
const PAXG = (walk.meta && walk.meta.fees && walk.meta.fees.roundTripFrac) || 0.0026;
const XM = 0.0002;

const s = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? s(a) / a.length : NaN;
const riskOf = r => Math.abs(r.entry - r.stop);
const costR = (r, frac) => r.entry * frac / riskOf(r);
const isWin = r => r.outcome === 'win';
const isLoss = r => String(r.outcome).startsWith('loss');
const settledRow = r => typeof r.rMultiple === 'number';

/* Rows whose position cannot be shown to have existed are dropped — BOTH
   SIDES of them. This filter used to read `!r.ambiguousSameBarWin`, which
   dropped the 462 unprovable wins and kept the 1,289 unprovable losses,
   because the walk only ever set that flag on wins. The asymmetry was worth
   about six points of win rate against a 33.3% breakeven and it read as
   evidence AGAINST the mechanics: seventeen of them scored "significantly
   below breakeven" under it and one does when the rule is applied evenly.
   lib/unprovable-fill.mjs holds the predicate and the reasoning. */
const settledRows = (walk.trades || []).filter(settledRow);

/* THE BOOK IS AN INTERVAL, AND THESE TABLES ARE ITS CAUTIOUS END.

   `formed` is the LOWER bound: unprovable wins dropped, unprovable losses
   kept. That is exactly what the old `!r.ambiguousSameBarWin` filter
   computed, so every number below is continuous with what shipped — what
   changes is that it is now labelled a bound instead of passing as the
   record, and `winRateInterval` carries the other end.

   Performance claims stay on this end deliberately: a desk should be
   credited only for what survives its worst case. Verdicts are the mirror
   of that and must NOT come from here — condemning a mechanic at the lower
   bound is what marked seventeen of them "significantly below breakeven"
   when not one fails at its upper bound. */
const formed = boundRows(settledRows, 'lower');
const formedUpper = boundRows(settledRows, 'upper');
const withheld = settledRows.filter(isUnprovableFill);

/* ---------- the sequential book ---------- */
function sequential(pool){
  const rows = pool.filter(r => r.exitISO && r.tISO)
    .slice().sort((a, b) => new Date(a.tISO) - new Date(b.tISO));
  const out = [];
  let freeAt = 0;
  for (const r of rows){
    const t = +new Date(r.tISO);
    if (t < freeAt) continue;            /* a position is already running */
    out.push(r);
    freeAt = +new Date(r.exitISO);
  }
  return out;
}

/* ---------- clustered standard error, and the effective n it implies ---- */
function clusterKey(r, width){
  if (width === 'week'){
    const d = new Date(r.tISO);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  }
  return r.tISO.slice(0, 10);            /* day */
}

function effective(rows, width){
  const xs = rows.map(r => r.rMultiple);
  const n = xs.length;
  if (n < 2) return { n, effN: n, tNaive: NaN, tCluster: NaN, clusters: n };
  const mu = mean(xs);
  const sd = Math.sqrt(s(xs.map(x => (x - mu) * (x - mu))) / (n - 1));
  const seNaive = sd / Math.sqrt(n);
  const g = {};
  for (const r of rows){ const k = clusterKey(r, width); (g[k] = g[k] || []).push(r.rMultiple - mu); }
  const groups = Object.values(g);
  const meat = s(groups.map(v => s(v) * s(v)));
  const seCluster = Math.sqrt(meat) / n;
  /* effN solves sd/sqrt(effN) = seCluster */
  let effN = (seCluster > 0) ? (sd * sd) / (seCluster * seCluster) : n;
  /* NEVER above n: a cluster SE tighter than independence is noise, and
     rounding it up would hand back the overconfidence this removes. */
  effN = Math.max(1, Math.min(n, effN));
  return {
    n, effN: +effN.toFixed(1), clusters: groups.length,
    tNaive: +(mu / seNaive).toFixed(2),
    tCluster: +(mu / seCluster).toFixed(2),
    inflation: +(Math.abs((mu / seNaive) / (mu / seCluster)) || 1).toFixed(2)
  };
}

/* WHAT HOLDING IT WOULD HAVE FELT LIKE.

   This desk reports win rate, R multiples, Wilson bounds, breakeven and a
   family-wise correction. It has never once reported an equity curve, a
   drawdown or a losing streak — and on the ticket book those are the whole
   story: +3.2R final after an 18.3R hole that ran seven weeks, with seven
   losses in a row inside it. At 1% risk a trade that is an 18% account
   drawdown to finish +3%.

   A flat expectancy is not harmless. It is exactly the shape people
   abandon at the bottom, and a number that hides the hole is a number that
   helps them do it.

   Order matters: the rows must be walked in the sequence they were TAKEN,
   so this only means anything on a sequential book. Feeding it the
   overlapping firehose would produce a curve nobody ever rode. */
function drawdown(rows, frac){
  const ordered = rows.slice().sort((a, b) => new Date(a.tISO) - new Date(b.tISO));
  let eq = 0, peak = 0, maxDD = 0, run = 0, maxRun = 0;
  let ddFrom = null, worstFrom = null, worstTo = null;
  for (const r of ordered){
    const net = r.rMultiple - costR(r, frac);
    eq += net;
    if (net < 0){ run++; if (run > maxRun) maxRun = run; } else run = 0;
    if (eq > peak){ peak = eq; ddFrom = null; }
    else {
      if (ddFrom === null) ddFrom = r.tISO;
      const dd = peak - eq;
      if (dd > maxDD){ maxDD = dd; worstFrom = ddFrom; worstTo = r.exitISO || r.tISO; }
    }
  }
  return {
    finalR: +eq.toFixed(2), peakR: +peak.toFixed(2), maxDrawdownR: +maxDD.toFixed(2),
    longestLosingStreak: maxRun,
    /* a book that never made a new high has no drawdown FROM a peak — it
       simply fell, and saying "maxDD 73R" about a curve that started at its
       high is true but hides that it never recovered anything */
    everAboveWater: peak > 0,
    worstFrom: worstFrom ? worstFrom.slice(0, 10) : null,
    worstTo: worstTo ? worstTo.slice(0, 10) : null
  };
}

/* HOW OFTEN DOES THIS KIND OF ENTRY EVEN HAPPEN?

   More than half of breakout entries never trigger — BUY_STOP 56.5%,
   SELL_STOP 48.3% — and nothing in the app reports it. A mechanic whose
   record looks fine on the trades that filled is a different proposition
   when half of them never became trades at all. Unfilled is not a loss and
   is excluded from every rate here; it is reported on its own. */
function fillRates(pool){
  const g = {};
  for (const r of pool){
    const k = r.orderType || '(none)';
    g[k] = g[k] || { n: 0, unfilled: 0 };
    g[k].n++;
    if (/unfill/.test(String(r.outcome))) g[k].unfilled++;
  }
  const out = {};
  for (const [k, v] of Object.entries(g)){
    out[k] = { n: v.n, unfilled: v.unfilled, fillRate: +(1 - v.unfilled / v.n).toFixed(4) };
  }
  return out;
}

/* THE CALENDAR THE DESK ACTUALLY TRADES.

   The live tab prefers XM XAUUSD and Binance XAU (getXAUCandles, index.html
   1853). The evidence is baked on PAXG, which trades 24/7. So 18.5% of the
   measured rows fired on bars XM XAUUSD never printed — Saturdays, Friday
   after the 21:00 UTC close, Sunday before the 22:00 reopen. Sunday is the
   worst day in the whole book at -0.286R gross.

   Hygiene rather than P&L, and worth saying so: the sequential TICKET book
   is identical either way, because gated tickets rarely fire at a weekend.
   What it fixes is the claim — a card quoting a mechanic's record should be
   quoting trades that could have been taken. */
/* The two gates that shipped in hg-v752, applied to an older walk so the
   numbers quoted on the card describe the code that is running. Kept in one
   place and named after the constants they mirror, so a future change to
   either has one obvious place to follow. */
const GOLD_STOP_MIN_PCT = 0.005;                 /* omnigold.js */
const COST_VETO_R = 0.30, COST_VETO_R_SCALP = 0.15;

function passesCurrentGates(r, frac){
  const risk = Math.abs(r.entry - r.stop);
  if (!(risk > 0) || !(r.entry > 0)) return false;
  if (risk / r.entry < GOLD_STOP_MIN_PCT) return false;
  const ceiling = (String(r.horizon).toUpperCase() === 'SCALP') ? COST_VETO_R_SCALP : COST_VETO_R;
  return (r.entry * frac / risk) <= ceiling;
}

function brokerOpen(r){
  const d = new Date(r.tISO);
  const day = d.getUTCDay(), hr = d.getUTCHours();
  if (day === 6) return false;              /* Saturday: shut all day */
  if (day === 5 && hr >= 21) return false;  /* Friday, after the close */
  if (day === 0 && hr < 22) return false;   /* Sunday, before the reopen */
  return true;
}

function record(rows, width){
  if (!rows.length) return null;
  const w = rows.filter(isWin).length, l = rows.filter(isLoss).length;
  const eff = effective(rows, width);
  return {
    n: rows.length,
    settled: w + l,
    wins: w,
    winRate: (w + l) ? +(w / (w + l)).toFixed(4) : null,
    grossR: +mean(rows.map(r => r.rMultiple)).toFixed(4),
    netR_paxg: +mean(rows.map(r => r.rMultiple - costR(r, PAXG))).toFixed(4),
    netR_xm: +mean(rows.map(r => r.rMultiple - costR(r, XM))).toFixed(4),
    medianCostR_paxg: (() => {
      const a = rows.map(r => costR(r, PAXG)).sort((x, y) => x - y);
      return +a[Math.floor(a.length / 2)].toFixed(3);
    })(),
    effective: eff
  };
}

function groupBy(rows, keyFn, width, minN){
  const g = {};
  for (const r of rows){ const k = keyFn(r); if (k == null) continue; (g[k] = g[k] || []).push(r); }
  const out = {};
  for (const [k, v] of Object.entries(g)){
    if (v.length < (minN || 1)) continue;   /* omitted, never zero-filled */
    out[k] = record(v, width);
  }
  return out;
}

/* THE KEYS groupBy DROPPED, AND HOW FAR SHORT THEY FELL.

   Omitting a thin cohort is right — a record on eleven trades is not a
   record — but omitting it SILENTLY leaves the card with nothing to say,
   and nothing reads exactly like "measured and fine". Thirteen mechanics
   fire in this walk and fall under the bar. The gap between raw firings
   and what reaches this count is the filtering, not the detector:
   POC-REVERT fires 146 times in the walk and TWO of them survive the stop
   floor, the cost veto and broker hours. A reader looking at a POC-REVERT
   card could not tell it apart from a mechanic that had been measured.

   So the bake publishes the shortfall as data. It is a COUNT, never a
   rate: computing a win rate on the rows that fell short and shipping it
   under a caveat is the same mistake with a disclaimer stapled on. */
function belowThreshold(rows, keyFn, minN){
  const g = {};
  for (const r of rows){ const k = keyFn(r); if (k == null) continue; g[k] = (g[k] || 0) + 1; }
  const out = {};
  for (const [k, n] of Object.entries(g)) if (n < (minN || 1)) out[k] = n;
  return out;
}

/* ---------- concurrency, the fact that motivates all of this ---------- */
function concurrency(pool){
  const ev = [];
  for (const r of pool){
    if (!r.exitISO || /unfill/.test(r.outcome)) continue;
    ev.push([+new Date(r.tISO), 1]); ev.push([+new Date(r.exitISO), -1]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let open = 0, peak = 0, area = 0, prev = ev.length ? ev[0][0] : 0;
  for (const [t, d] of ev){ area += open * (t - prev); prev = t; open += d; if (open > peak) peak = open; }
  const spanMs = ev.length ? (prev - ev[0][0]) : 0;
  return { peak, meanOpen: spanMs > 0 ? +(area / spanMs).toFixed(1) : null };
}

const WIDTH = 'week';   /* positions run up to 5 days, so day clusters overlap */
const seq = sequential(formed);
const seqTickets = sequential(formed.filter(r => r.ticket));

/* THE FINGERPRINT THAT MAKES STALENESS DETECTABLE.

   Everything baked into omnigold.js — the 54-mechanic replay table, the
   fill rates, the effN ratio, the lane cool-downs, the drawdown panel —
   comes from one walk artifact, and until now nothing recorded WHICH GATE
   SET produced it. hg-v754 shipped a drawdown from a 2026-09-12 walk after
   the v752 gates had changed what a ticket is, overstating it 2.2x at XM
   and 8.5x at PAXG, and no test or reader could have noticed.

   The ledger's KEY LIST is a good signature: it changes exactly when a gate
   is added or removed, which is exactly when a `ticket` means something
   different. Read from source rather than by booting the module, because
   this script must not depend on omnigold.js loading cleanly under node.

   It is a signature, not a proof — retuning a THRESHOLD inside an existing
   gate changes what a ticket is without changing a key. It catches the
   change that actually happened, and is honest about the one it would
   miss. */
function gateFingerprint(){
  try {
    const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
    const keys = [...src.matchAll(/gates\.push\(\s*\{\s*key\s*:\s*.([a-z0-9-]+)./g)].map(m => m[1]);
    if (!keys.length) return null;
    return { count: keys.length, keys: keys.slice().sort() };
  } catch (e) { return null; }
}

const bake = {
  generated: new Date().toISOString(),
  /* the gate ledger as it stood when this evidence was computed */
  gateFingerprint: gateFingerprint(),
  walkGenerated: (walk.meta && walk.meta.generated) || null,
  src: 'scripts/backtest-omnigold-results.json',
  window: walk.meta && walk.meta.span
    ? (walk.meta.span.from.slice(0, 10) + '..' + walk.meta.span.to.slice(0, 10)) : null,
  barBasis: (walk.meta && walk.meta.universe) || null,
  clusterWidth: WIDTH,
  costModel: { paxgRtFrac: PAXG, xmRtFrac: XM },
  /* What this bake refused to count, and why. A sample size quoted without
     this is a bigger claim than the data supports. */
  sampleIntegrity: (() => {
    const b = winRateBounds(settledRows);
    return {
      settled: b.settled,
      unprovableFills: b.unprovable,
      unprovableScoredWins: b.unprovableScoredWins,
      unprovableScoredLosses: b.unprovableScoredLosses,
      /* the whole point: a range, and where breakeven at 2R falls in it */
      winRateInterval: { lower: b.lower, upper: b.upper, point: b.point },
      tablesComputedOn: 'lower bound (unprovable wins dropped, unprovable losses kept)',
      breakevenAt2R: +(1 / 3).toFixed(4),
      breakevenVsInterval: thresholdVsInterval(settledRows, 1 / 3),
      note: unprovableNote(settledRows)
    };
  })(),
  concurrency: concurrency(formed),
  populations: {
    formed: record(formed, WIDTH),
    sequential: record(seq, WIDTH),
    sequentialTickets: record(seqTickets, WIDTH),
    /* the same book, restricted to bars XM XAUUSD actually printed */
    sequentialTicketsBrokerHours: record(sequential(formed.filter(r => r.ticket && brokerOpen(r))), WIDTH)
  },
  /* drawdown only means anything on a book walked in the order it was
     taken, so it is computed on the SEQUENTIAL books and not on the
     overlapping firehose */
  experience: {
    sequential: { xm: drawdown(seq, XM), paxg: drawdown(seq, PAXG) },
    sequentialTickets: { xm: drawdown(seqTickets, XM), paxg: drawdown(seqTickets, PAXG) },
    /* THE GATE SET THIS ARTIFACT WAS WALKED WITH IS NOT THE ONE SHIPPING.

       r.ticket in a walk artifact is whatever hgOgGates said on the day it
       ran. This one ran 2026-09-12; the stop floor (GOLD_STOP_MIN_PCT) and
       the HARD venue-priced cost-drag gate landed 2026-09-16. Quoting the
       raw ticket book as "what this desk does" therefore describes a system
       the tab no longer runs — it overstates the drawdown 2.2x at XM and
       8.5x at PAXG.

       Until the walk is re-run, the closest honest proxy is the ticket book
       with those two gates applied after the fact. It is a PROXY and is
       labelled one: a re-walk would also change which setups formed at all,
       not merely which of them survived. */
    sequentialTicketsCurrentGates: {
      xm: drawdown(sequential(formed.filter(r => r.ticket && passesCurrentGates(r, XM))), XM),
      paxg: drawdown(sequential(formed.filter(r => r.ticket && passesCurrentGates(r, PAXG))), PAXG),
      note: 'PROXY — v752 gates applied to a 2026-09-12 walk, not a re-walk'
    }
  },
  fills: fillRates(walk.trades || []),
  calendar: {
    note: 'live tab prefers XM XAUUSD / Binance XAU; this walk is PAXG, which trades 24/7',
    rows: formed.length,
    outsideBrokerHours: formed.filter(r => !brokerOpen(r)).length,
    byDayGross: (() => {
      const N = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], g = {};
      for (const r of formed){ const d = N[new Date(r.tISO).getUTCDay()]; (g[d] = g[d] || []).push(r.rMultiple); }
      const o = {};
      for (const [d, v] of Object.entries(g)) o[d] = { n: v.length, grossR: +mean(v).toFixed(4) };
      return o;
    })()
  },
  formedByKind: groupBy(formed, r => r.kind, WIDTH, 40),
  /* the other side of that 40: which mechanics fired and were left out */
  kindBelowThreshold: { minN: 40, kinds: belowThreshold(formed, r => r.kind, 40) },
  sequentialByCell: groupBy(seq, r => r.horizon + '/' + r.tier, WIDTH, 10),
  sequentialByKind: groupBy(seq, r => r.kind, WIDTH, 10)
};

if (JSON_OUT){ console.log(JSON.stringify(bake, null, 2)); process.exit(0); }

const pct = v => (v == null || !isFinite(v)) ? '—' : (v * 100).toFixed(1) + '%';
const r3 = v => (v == null || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(3) + 'R';

console.log('OMNIGOLD EVIDENCE — re-baked over trades a person could take');
console.log('============================================================\n');
console.log('  window ' + bake.window + '   clusters: ' + WIDTH);
{
  /* printed BEFORE the tables, because it governs how to read all of them */
  const si = bake.sampleIntegrity;
  if (si.unprovableFills){
    const p = x => (x == null ? '—' : (100 * x).toFixed(2) + '%');
    console.log('\n  THE WIN RATE IS AN INTERVAL, NOT A NUMBER');
    console.log('    ' + si.unprovableFills + ' of ' + si.settled + ' settled rows are pending orders that resolved on');
    console.log('    their own fill bar. OHLC cannot say whether the entry printed before the');
    console.log('    exit, and if it did not there was no trade at all — so each row is either');
    console.log('    what the walk scored or not a sample point.');
    console.log('      win rate at worst : ' + p(si.winRateInterval.lower)
      + '   (' + si.unprovableScoredWins + ' scored wins deleted, ' + si.unprovableScoredLosses + ' scored losses kept)');
    console.log('      win rate at best  : ' + p(si.winRateInterval.upper)
      + '   (the mirror of that)');
    console.log('      breakeven at 2R   : ' + p(si.breakevenAt2R) + ' — it falls '
      + (si.breakevenVsInterval === 'straddles' ? 'INSIDE the interval' : si.breakevenVsInterval + ' it'));
    if (si.breakevenVsInterval === 'straddles'){
      console.log('    So this walk cannot say whether the book wins or loses. Every table below');
      console.log('    is computed at the CAUTIOUS end and is a bound, not a record.');
    }
  }
}
console.log('  concurrency: peak ' + bake.concurrency.peak + ' open, time-weighted mean '
  + bake.concurrency.meanOpen);
console.log('  -> the shipped constant quotes the FORMED row, which assumes every');
console.log('     one of those simultaneous positions is a separate independent trade.\n');

for (const [label, rec] of Object.entries(bake.populations)){
  if (!rec) continue;
  console.log('  ' + label.padEnd(20)
    + 'n=' + String(rec.n).padStart(5)
    + '  win=' + pct(rec.winRate).padStart(7)
    + '  gross=' + r3(rec.grossR).padStart(8)
    + '  net@XM=' + r3(rec.netR_xm).padStart(8)
    + '  net@PAXG=' + r3(rec.netR_paxg).padStart(8));
  console.log('  ' + ' '.repeat(20)
    + 'effective n=' + String(rec.effective.effN).padStart(7)
    + ' of ' + rec.n
    + '   t naive ' + String(rec.effective.tNaive).padStart(6)
    + ' -> clustered ' + String(rec.effective.tCluster).padStart(6)
    + '  (' + rec.effective.inflation + 'x)');
}

console.log('\n  SEQUENTIAL BOOK BY CELL (one position at a time)');
for (const [k, v] of Object.entries(bake.sequentialByCell).sort((a, b) => b[1].n - a[1].n)){
  console.log('    ' + k.padEnd(14) + 'n=' + String(v.n).padStart(4)
    + '  win=' + pct(v.winRate).padStart(7)
    + '  gross=' + r3(v.grossR).padStart(8)
    + '  net@XM=' + r3(v.netR_xm).padStart(8)
    + '  effN=' + v.effective.effN);
}

console.log('\n  WHAT HOLDING IT WOULD HAVE FELT LIKE');
console.log('  (nothing in the tab has ever reported any of this)');
for (const [label, e] of Object.entries(bake.experience)){
  for (const [venue, d] of Object.entries(e)){
    /* A book can legitimately be empty at one venue and not the other — the
       cost gate vetoes more at PAXG. An empty book has no drawdown, and
       printing one would be inventing it. */
    if (!d || !isFinite(d.finalR)){
      console.log('    ' + (label + ' @' + venue.toUpperCase()).padEnd(32)
        + 'no trades survive this filter at this venue — no drawdown to report');
      continue;
    }
    console.log('    ' + (label + ' @' + venue.toUpperCase()).padEnd(32)
      + 'final ' + (d.finalR >= 0 ? '+' : '') + d.finalR.toFixed(1) + 'R'
      + '   peak ' + d.peakR.toFixed(1) + 'R'
      + '   MAX DRAWDOWN ' + d.maxDrawdownR.toFixed(1) + 'R'
      + '   longest losing streak ' + d.longestLosingStreak);
    if (d.worstFrom) console.log('    ' + ' '.repeat(32) + 'the hole ran ' + d.worstFrom + ' -> ' + d.worstTo
      + (d.everAboveWater ? '' : '  (never made a new high — it only ever fell)'));
  }
}
console.log('    At 1% risk a trade, an 18R drawdown is 18% of the account to');
console.log('    finish +3%. That is the number that decides whether anyone');
console.log('    is still running the system when it recovers.');

console.log('\n  THE CALENDAR THIS EVIDENCE IS BAKED ON');
console.log('    ' + bake.calendar.outsideBrokerHours + ' of ' + bake.calendar.rows
  + ' rows (' + (100 * bake.calendar.outsideBrokerHours / bake.calendar.rows).toFixed(1)
  + '%) fired when XM XAUUSD was SHUT.');
console.log('    ' + bake.calendar.note);
{
  const d = bake.calendar.byDayGross, N = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  console.log('    gross by day: ' + N.filter(x => d[x])
    .map(x => x + ' ' + (d[x].grossR >= 0 ? '+' : '') + d[x].grossR.toFixed(3)).join('  '));
  const bt = bake.populations.sequentialTicketsBrokerHours, t = bake.populations.sequentialTickets;
  if (bt && t){
    console.log('    HYGIENE, NOT P&L: the ticket book is ' + t.n + ' trades at '
      + r3(t.netR_xm) + ' either way (' + bt.n + ' at ' + r3(bt.netR_xm)
      + ' on broker hours) — gated tickets rarely fire at a weekend.');
  }
}

console.log('\n  HOW OFTEN DOES THIS KIND OF ENTRY EVEN HAPPEN?');
for (const [k, v] of Object.entries(bake.fills).sort((a, b) => b[1].n - a[1].n)){
  console.log('    ' + k.padEnd(12) + 'n=' + String(v.n).padStart(5)
    + '   fills ' + (v.fillRate * 100).toFixed(1).padStart(5) + '%'
    + '   never triggered ' + String(v.unfilled).padStart(4));
}
console.log('    More than half of breakout entries never trigger. Unfilled is not');
console.log('    a loss and is excluded from every rate above — it is its own fact.');

if (WRITE){
  const OUT = path.join(ROOT, 'scripts', 'omnigold-replay-evidence.json');
  let prior = {};
  try { prior = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { prior = {}; }
  /* additive: the existing fit study, per-kind rows and cohorts stay. This
     bake answers a different question and must not silently delete the
     answer to the old one. */
  const merged = Object.assign({}, prior, { sequentialBake: bake });
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2));
  console.log('\n  wrote sequentialBake into ' + path.relative(ROOT, OUT)
    + ' (additive — the existing fit study is untouched)');
} else {
  console.log('\n  (dry run — pass --write to update scripts/omnigold-replay-evidence.json)');
}
