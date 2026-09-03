#!/usr/bin/env node
/* HARDGATE — distill OMNIROUTE v531 + OMNIPRESENT full-run replays into a
   compact prefer / demote / tighten report. Does not invent trades.
   Run: node scripts/analyze-omni-backtest.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const OR_SRC = path.join(ROOT, 'scripts', 'backtest-omniroute-v531-results.json');
const OP_SRC = path.join(ROOT, 'scripts', 'backtest-omnipresent-results.json');
const OUT = path.join(ROOT, 'scripts', 'omni-bt-analysis.json');

const DEMOTE_MIN_N = 50;
const DEMOTE_GROSS = -0.05;
const PREFER_MIN_N = 50;

function bag(list, keyFn){
  const m = {};
  for (const x of list){
    const k = keyFn(x);
    (m[k] = m[k] || []).push(x);
  }
  return Object.entries(m).map(([k, xs]) => {
    const n = xs.length;
    const wins = xs.filter(x => {
      const o = String(x.outcome || '');
      return o.startsWith('win') || o === 'target';
    }).length;
    const g = xs.reduce((s, x) => s + (+x.rMultiple || 0), 0);
    const net = xs.reduce((s, x) => s + (+x.netR || 0), 0);
    return {
      k, n,
      winRate: +(wins / n).toFixed(4),
      avgGrossR: +(g / n).toFixed(4),
      avgNetR: +(net / n).toFixed(4)
    };
  }).sort((a, b) => (b.avgNetR ?? -99) - (a.avgNetR ?? -99));
}

console.log('loading', OR_SRC);
const or = JSON.parse(fs.readFileSync(OR_SRC, 'utf8'));
console.log('loading', OP_SRC);
const op = JSON.parse(fs.readFileSync(OP_SRC, 'utf8'));

const mech = or.aggregates.byMechanic || {};
const rows = Object.entries(mech).map(([kind, v]) => ({ kind, ...v }))
  .sort((a, b) => (b.avgNetR ?? -99) - (a.avgNetR ?? -99));

function wouldDemote(r){
  return !!(r && r.n >= DEMOTE_MIN_N && isFinite(r.avgGrossR) && r.avgGrossR <= DEMOTE_GROSS);
}
function wouldPrefer(r){
  return !!(r && r.n >= PREFER_MIN_N
    && isFinite(r.avgGrossR) && r.avgGrossR > 0
    && isFinite(r.avgNetR) && r.avgNetR > 0);
}

const demote = rows.filter(wouldDemote);
const prefer = rows.filter(wouldPrefer);
const orTrades = (or.trades || []).filter(t => t && t.netR != null);
const preferKinds = prefer.map(r => r.kind);
const demoteKinds = demote.map(r => r.kind);

const opTrades = (op.trades || []).filter(t => t && t.netR != null);

const report = {
  generated: new Date().toISOString(),
  limitations: [
    'OMNIROUTE harness is 1h; live desk scans 4h. Directional evidence only.',
    'OMNIPRESENT replay measures RAW TRIGGERED zones, not the live shown-head ranking.',
    'Live opGates (trend / news / context / measured-edge) are not fully replayed offline.',
    'Fees 0.05% + 0.02%/side; both-touch bar = loss; fill required.',
    'Never loosen G1–G7. Never invent dir or levels. Demote / tighten only.'
  ],
  omniroute: {
    source: 'scripts/backtest-omniroute-v531-results.json',
    runAt: or.wallClockRunAt,
    overall: or.aggregates.overall,
    cohorts: or.aggregates.cohorts,
    byTier: or.aggregates.byTier,
    byQuartile: or.aggregates.byQuartile,
    finding: {
      headline: 'Overall n=2832 WR 26.0% avgNetR −0.24R PF 0.68. Prefer kinds (n≥50, gross+ and net+) are +0.10R. Dropping toxic kinds (n≥50, gross≤−0.05) takes the rest to −0.015R. Solidity / conviction / cluster do not forecast wins.',
      actions: [
        'Prefer AVWAP-RECLAIM, CUSUM-SHIFT, DONCHIAN-DRIVE, MMOVE, NR7-BREAK — stamp replay-survivor and rank first among tickets.',
        'Demote n≥50 gross-negative kinds from formation (PIN-REJECT, THREE-BAR, RSI-DIVERGE, ENGULF-LEVEL, HTF-PULLBACK, UTAD, EQH-SWEEP, SPRING, SWEEP-RECLAIM, EQL-SWEEP, BOS-RETEST, AVWAP-DEFEND, TREND-RECLAIM, FVG-FILL) unless the live forward ledger reads has paid.',
        'Do not suppress ORB (n=206, gross +0.056, net −0.011 — near even).',
        'Do not treat higher solidity as a win forecast (fair worse than weak; Q4 worst).',
        'Conviction cohort worse than legacy — do not boost conviction for MOST PROBABLE.',
        'Never invent tickets for quiet contracts.'
      ]
    },
    prefer,
    demote,
    byMechanic: rows,
    counterfactual: {
      preferOnly: bag(orTrades.filter(t => preferKinds.includes(t.mechanic)), () => 'prefer-only')[0] || null,
      dropToxic: bag(orTrades.filter(t => !demoteKinds.includes(t.mechanic)), () => 'kept')[0] || null,
      rest: bag(orTrades.filter(t => !preferKinds.includes(t.mechanic)), () => 'rest')[0] || null
    }
  },
  omnipresent: {
    source: 'scripts/backtest-omnipresent-results.json',
    runAt: op.wallClockRunAt,
    overall: op.aggregates.overall,
    byKind: op.aggregates.byKind,
    gatedCohort: op.aggregates.gatedCohort,
    byKindGated: op.aggregates.byKindGated,
    finding: {
      headline: 'Both fade kinds are net-negative at scale (−0.22R). The 3+ source AND 2+ exhaustion gated cohort is worse (−0.27R). Tight stops (costR≥0.20) lose −0.49R. Gold perps (XAU/XAG) are the worst symbols.',
      actions: [
        'Do not claim replay quality / 20X replay-evidence — both kinds fail gross+ at n≥50.',
        'Do not loosen 3+ confluence or 2+ exhaustion — gated is worse, not better.',
        'Tighten: hard-veto costR > 0.20 (fee-toxic squeezed stops).',
        'Tighten: stand XAU/XAG/PAXG aside from TICKET on this fade desk.',
        'Among remaining tickets, prefer lower costR / wider stop. ARMED stays WATCH and nearer.',
        'Do not invent a third mechanic.'
      ]
    },
    slices: {
      byConfluence: bag(opTrades, t => 'c' + t.confluence),
      byEvidenceN: bag(opTrades, t => 'e' + t.evidenceN),
      byGates: bag(opTrades, t => (t.gateConfluence3 ? 'C3' : 'c-') + '/' + (t.gateEvidence2 ? 'E2' : 'e-')),
      byDistAtr: bag(opTrades, t => {
        const d = +t.distAtr || 0;
        if (d < 0.15) return 'd<0.15';
        if (d < 0.35) return 'd<0.35';
        if (d < 0.6) return 'd<0.6';
        return 'd>=0.6';
      }),
      byCostR: bag(opTrades, t => {
        const c = +t.costR || 0;
        if (c < 0.08) return 'cost<0.08';
        if (c < 0.12) return 'cost<0.12';
        if (c < 0.20) return 'cost<0.20';
        return 'cost>=0.20';
      }),
      goldVsRest: bag(opTrades, t => /XAU|XAG|PAXG|XAUT/.test(String(t.sym || '')) ? 'gold' : 'crypto')
    }
  }
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('wrote', OUT);
console.log('\n=== OMNIROUTE prefer (n>=50, gross+, net+) ===');
for (const r of prefer){
  console.log(' ', r.kind, 'n=' + r.n, 'WR=' + (r.winRate * 100).toFixed(1) + '%',
    'g=' + r.avgGrossR.toFixed(3), 'net=' + r.avgNetR.toFixed(3), 'pf=' + (r.profitFactor || 0).toFixed(2));
}
console.log('\n=== OMNIROUTE demote (n>=50, gross<=-0.05) ===');
for (const r of demote){
  console.log(' ', r.kind, 'n=' + r.n, 'WR=' + (r.winRate * 100).toFixed(1) + '%',
    'g=' + r.avgGrossR.toFixed(3), 'net=' + r.avgNetR.toFixed(3));
}
console.log('\ncounterfactual prefer-only', report.omniroute.counterfactual.preferOnly);
console.log('counterfactual drop-toxic', report.omniroute.counterfactual.dropToxic);
console.log('\n=== OMNIPRESENT cost / gold ===');
console.log(report.omnipresent.slices.byCostR);
console.log(report.omnipresent.slices.goldVsRest);
console.log('\nfinding OR:', report.omniroute.finding.headline);
console.log('finding OP:', report.omnipresent.finding.headline);
