/* HARDGATE — GOLD SCALP backtest cohort analysis.
   Run:  node scripts/analyze-goldscalp-backtest.mjs [path-to-results.json]
   Reads scripts/backtest-goldscalp-results.json (or the given file) and
   prints the decision tables the re-bake rules read:
     - stop-width bands (xATR) and risk%-of-entry bands vs venue cost
     - per-strategy at XM and PAXG costs with n / WR / gross / net
     - strategy x session, grade ladder, MP-only, demoted flood
     - shadow (EDGE-suppressed) verdicts
   Writes scripts/gold-scalp-bt-analysis.json for the evidence trail. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const IN = process.argv[2] || path.join(ROOT, 'scripts', 'backtest-goldscalp-results.json');
const OUT = path.join(ROOT, 'scripts', 'gold-scalp-bt-analysis.json');

const j = JSON.parse(fs.readFileSync(IN, 'utf8'));
const all = j.trades;
const main = all.filter(t => !t.shadow);
const shadow = all.filter(t => t.shadow);
const settled = ts => ts.filter(t => t.netR != null);

function agg(ts){
  const s = settled(ts);
  const wins = s.filter(t => t.outcome.startsWith('win')).length;
  const sum = k => s.reduce((a, t) => a + t[k], 0);
  const med = arr => { const x = arr.filter(Number.isFinite).sort((a, b) => a - b); return x.length ? x[Math.floor(x.length / 2)] : null; };
  return {
    n: s.length,
    unfilled: ts.filter(t => t.outcome === 'unfilled').length,
    winRate: s.length ? +(wins / s.length).toFixed(3) : null,
    avgR_gross: s.length ? +(sum('rGross') / s.length).toFixed(3) : null,
    avgR_net_xm: s.length ? +(sum('netR') / s.length).toFixed(3) : null,
    avgR_net_paxg: s.length ? +(sum('netR_paxg') / s.length).toFixed(3) : null,
    medCostR_xm: med(s.map(t => t.costR_xm)),
    medStopAtr: med(s.map(t => t.stopAtr)),
    sumR_net_xm: +sum('netR').toFixed(1)
  };
}
function group(ts, keyFn){
  const g = {};
  for (const t of ts){ const k = keyFn(t); (g[k] = g[k] || []).push(t); }
  const out = {};
  for (const k of Object.keys(g).sort()) out[k] = agg(g[k]);
  return out;
}
const sess = t => { const h = t.utcHour; return h < 7 ? 'ASIA' : h < 12 ? 'LONDON' : h < 17 ? 'NY-OL' : 'LATE'; };
const stopBand = t => !Number.isFinite(t.stopAtr) ? 'atr?' :
  t.stopAtr < 0.5 ? '<0.5xATR' : t.stopAtr < 1.0 ? '0.5-1xATR' : t.stopAtr < 1.45 ? '1-1.45xATR' : '>=1.45xATR';
const riskPct = t => Math.abs(t.entry - t.stop) / t.entry * 100;
const riskBand = t => { const r = riskPct(t); return r < 0.08 ? '<0.08%' : r < 0.16 ? '0.08-0.16%' : r < 0.32 ? '0.16-0.32%' : '>=0.32%'; };

const analysis = {
  generated: new Date().toISOString(),
  source: path.basename(IN),
  span: j.meta.span, mode: j.meta.mode,
  counts: { main: main.length, shadow: shadow.length, settledMain: settled(main).length, counters: j.meta.counters },
  overall: agg(main),
  byStopBand: group(main, stopBand),
  byRiskPctBand: group(main, riskBand),
  floorSplit: {
    'stop<1.45xATR (floor violators)': agg(main.filter(t => Number.isFinite(t.stopAtr) && t.stopAtr < 1.45)),
    'stop>=1.45xATR (contract-true)': agg(main.filter(t => !(Number.isFinite(t.stopAtr) && t.stopAtr < 1.45)))
  },
  byStrategy: group(main, t => t.stratKey),
  byStrategyContractTrue: group(main.filter(t => !(Number.isFinite(t.stopAtr) && t.stopAtr < 1.45)), t => t.stratKey),
  bySession: group(main, sess),
  byStrategySession: group(main, t => t.stratKey + '|' + sess(t)),
  gradeLadder: group(main, t => (t.demoted ? 'demoted-' : '') + (t.grade || '?')),
  mpOnly: agg(main.filter(t => t.mp)),
  leadEligible: agg(main.filter(t => !t.demoted)),
  demotedShare: main.length ? +(main.filter(t => t.demoted).length / main.length).toFixed(3) : null,
  shadow: { overall: agg(shadow), byStrategy: group(shadow, t => t.stratKey) }
};

fs.writeFileSync(OUT, JSON.stringify(analysis, null, 1));

const pad = (s, n) => String(s == null ? '-' : s).padEnd(n);
const rp = (s, n) => String(s == null ? '-' : s).padStart(n);
function show(title, obj){
  console.log('\n--- ' + title + ' ---');
  console.log(pad('group', 30) + rp('n', 6) + rp('win%', 7) + rp('gross', 8) + rp('net@XM', 9)
    + rp('net@PAXG', 10) + rp('medCostR', 10) + rp('medStopATR', 12));
  for (const k of Object.keys(obj)){
    const a = obj[k];
    if (!a || typeof a.n !== 'number') continue;
    console.log(pad(k, 30) + rp(a.n, 6)
      + rp(a.winRate == null ? '-' : (a.winRate * 100).toFixed(0) + '%', 7)
      + rp(a.avgR_gross, 8) + rp(a.avgR_net_xm, 9) + rp(a.avgR_net_paxg, 10)
      + rp(a.medCostR_xm == null ? '-' : a.medCostR_xm.toFixed(3), 10)
      + rp(a.medStopAtr == null ? '-' : a.medStopAtr.toFixed(2), 12));
  }
}
console.log('=== GOLD SCALP replay analysis · ' + analysis.source + ' · span '
  + (j.meta.span ? j.meta.span.from.slice(0, 10) + '..' + j.meta.span.to.slice(0, 10) : '?')
  + ' · settled ' + analysis.overall.n + ' ===');
show('overall / selection', { ALL: analysis.overall, 'MP-only': analysis.mpOnly, 'lead-eligible': analysis.leadEligible });
console.log('demoted share of issued trades: ' + analysis.demotedShare);
show('stop-width bands (the 1.5xATR floor question)', analysis.byStopBand);
show('floor split', analysis.floorSplit);
show('risk % of entry (cost-floor question; XM RT=0.02%)', analysis.byRiskPctBand);
show('by strategy (ALL)', analysis.byStrategy);
show('by strategy (contract-true stops only)', analysis.byStrategyContractTrue);
show('by session', analysis.bySession);
show('grade ladder', analysis.gradeLadder);
show('SHADOW (EDGE-suppressed, never pooled)', analysis.shadow.byStrategy);
console.log('\nwritten: ' + OUT);
