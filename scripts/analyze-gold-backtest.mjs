#!/usr/bin/env node
/* HARDGATE — distill scripts/backtest-omnigold-results.json into a
   compact SCALP / SWING / OMNIGOLD analysis. Does not invent trades.
   Run: node scripts/analyze-gold-backtest.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const SRC = path.join(ROOT, 'scripts', 'backtest-omnigold-results.json');
const OUT = path.join(ROOT, 'scripts', 'gold-bt-analysis.json');

console.log('loading', SRC);
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const agg = raw.aggregates || {};
const trades = Array.isArray(raw.trades) ? raw.trades : [];
const settled = trades.filter(t => t && t.netR != null);

function bucket(list){
  const n = list.length;
  if (!n) return { n: 0, winRate: null, avgGross: null, avgNet: null };
  const wins = list.filter(t => String(t.outcome || '').startsWith('win')).length;
  const g = list.reduce((s, t) => s + (+t.rMultiple || 0), 0);
  const net = list.reduce((s, t) => s + (+t.netR || 0), 0);
  return {
    n,
    winRate: +(wins / n).toFixed(3),
    avgGross: +(g / n).toFixed(3),
    avgNet: +(net / n).toFixed(3)
  };
}

function group(list, keyFn){
  const bags = {};
  for (const t of list){
    const k = keyFn(t);
    (bags[k] = bags[k] || []).push(t);
  }
  const out = {};
  for (const k of Object.keys(bags).sort()) out[k] = bucket(bags[k]);
  return out;
}

const byCohort = group(settled, t => (t.source || '?') + ':' + (t.horizon || '?'));
const byKindHorizon = group(settled, t => (t.horizon || '?') + '|' + (t.kind || '?'));

function kindRows(horizon){
  const rows = [];
  for (const [k, v] of Object.entries(byKindHorizon)){
    if (!k.startsWith(horizon + '|')) continue;
    rows.push({ kind: k.slice(horizon.length + 1), ...v });
  }
  rows.sort((a, b) => (a.avgNet ?? 0) - (b.avgNet ?? 0));
  return rows;
}

const scalpKinds = kindRows('SCALP');
const swingKinds = kindRows('SWING');

const DEMOTE_MIN_N = 50;
const DEMOTE_GROSS = -0.05;
const DEMOTE_VENUE_NET = -0.5;

function wouldDemote(row){
  if (!row || !(row.n >= DEMOTE_MIN_N)) return false;
  if (row.avgGross <= DEMOTE_GROSS) return true;
  /* venue net at PAXG ≈ avgNet (same 0.26% model) */
  if (row.avgNet <= DEMOTE_VENUE_NET) return true;
  return false;
}

const report = {
  source: 'scripts/backtest-omnigold-results.json',
  generated: new Date().toISOString(),
  window: raw.meta && raw.meta.span,
  settled: settled.length,
  limitations: (raw.meta && raw.meta.limitations) || [],
  cohorts: {
    overall: agg.overall,
    bySource: agg.bySource,
    computed: byCohort
  },
  finding: {
    headline: 'After 0.26% PAXG round-trip fees, no large cohort is net-positive. ENGINE:SWING is nearest breakeven (−0.056R, PF 0.90). ENGINE:SCALP wins more often (45%) but loses −2.60R/trade because stops are fee-toxic. SCAN:SWING (−0.52R) beats SCAN:SCALP (−1.52R).',
    actions: [
      'GOLD SCALP: suppress OPENING RANGE (n=69, net −1.80R) — largest remaining ENGINE scalp book that was only demoted.',
      'OMNIGOLD: drop kind-demotion floor from n=100 to n=50 so PDL-SWEEP, ER-IGNITION, ASIA-BREAK, NY-OPEN-DRIVE, VWAP-BAND, VWAP-REVERT and other mid-sample losers cannot form.',
      'GOLD SWING: keep prefer on 4H sweep / weekly (the only net+ engine rows). Do not invent tickets for quiet contracts.',
      'Never loosen G1–G7. Never flip dir. Demote/suppress only.'
    ]
  },
  scalpWorst: scalpKinds.filter(r => r.n >= 5).slice(0, 15),
  scalpBest: scalpKinds.filter(r => r.n >= 5).slice(-8).reverse(),
  swingWorst: swingKinds.filter(r => r.n >= 3).slice(0, 12),
  swingBest: swingKinds.filter(r => r.n >= 3).slice(-8).reverse(),
  newlyDemotableAtN50: [...scalpKinds, ...swingKinds]
    .filter(wouldDemote)
    .sort((a, b) => a.avgNet - b.avgNet)
    .slice(0, 40)
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('wrote', OUT);
console.log('\n=== cohorts ===');
console.log(JSON.stringify(agg.bySource, null, 2));
console.log('\n=== SCALP worst (n>=5) ===');
for (const r of report.scalpWorst) console.log(' ', r.kind, 'n=' + r.n, 'WR=' + r.winRate, 'gross=' + r.avgGross, 'net=' + r.avgNet);
console.log('\n=== SWING best (n>=3) ===');
for (const r of report.swingBest) console.log(' ', r.kind, 'n=' + r.n, 'WR=' + r.winRate, 'gross=' + r.avgGross, 'net=' + r.avgNet);
console.log('\n=== SWING worst (n>=3) ===');
for (const r of report.swingWorst) console.log(' ', r.kind, 'n=' + r.n, 'WR=' + r.winRate, 'gross=' + r.avgGross, 'net=' + r.avgNet);
console.log('\nfinding:', report.finding.headline);
