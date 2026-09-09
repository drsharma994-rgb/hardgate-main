/* HARDGATE — backtest-tab-params.mjs
   Derives per-tab thresholds from offline replay books (never loosens G1–G7). */

import fs from 'node:fs';
import path from 'node:path';

/** Desk → v531 mechanic analogue(s) + setup-profile key */
export const DESK_BT_MAP = {
  swing: { setupKind: 'swing', analogues: [], strategy: 'SWING' },
  scalp: { setupKind: 'scalp', analogues: ['NR7-BREAK'], strategy: 'SCALP' },
  edge: { setupKind: 'swing', analogues: ['HTF-PULLBACK', 'TREND-RECLAIM'], strategy: 'EDGE' },
  best: { setupKind: 'swing', analogues: ['AVWAP-RECLAIM', 'CUSUM-SHIFT', 'DONCHIAN-DRIVE', 'MMOVE', 'NR7-BREAK'], strategy: 'SWING' },
  smart: { setupKind: 'swing', analogues: ['MMOVE'], strategy: 'SMART' },
  squeeze: { setupKind: 'swing', analogues: ['SQUEEZE-FIRE', 'COMPRESSION-BREAK'], strategy: 'SWING' },
  reversalsniper: { setupKind: 'meanrev', analogues: ['PIN-REJECT', 'EXHAUST-REVERT'], strategy: 'MEANREV' },
  smc: { setupKind: 'smc-fvg', analogues: ['FVG-FILL'], strategy: 'SMC' },
  ob: { setupKind: 'swing', analogues: ['BOS-RETEST'], strategy: 'OB' },
  trap: { setupKind: 'meanrev', analogues: ['SWEEP-RECLAIM', 'EQH-SWEEP', 'EQL-SWEEP'], strategy: 'TRAP' },
  divergence: { setupKind: 'meanrev', analogues: ['RSI-DIVERGE'], strategy: 'DIV' },
  div: { setupKind: 'meanrev', analogues: ['RSI-DIVERGE'], strategy: 'DIV' },
  coil: { setupKind: 'swing', analogues: ['COMPRESSION-BREAK', 'NR7-BREAK'], strategy: 'SWING' },
  apex: { setupKind: 'swing', analogues: ['DONCHIAN-DRIVE'], strategy: 'SWING' },
  oiflow: { setupKind: 'swing', analogues: ['MMOVE'], strategy: 'SWING' },
  liqs: { setupKind: 'trap', analogues: ['SWEEP-RECLAIM'], strategy: 'TRAP' },
  meanrev: { setupKind: 'meanrev', analogues: ['EXHAUST-REVERT', 'POC-REVERT'], strategy: 'MEANREV' },
  carry: { setupKind: 'swing', analogues: [], strategy: 'CARRY' },
  chartvision: { setupKind: 'swing', analogues: [], strategy: 'SWING' },
  'gold-swing': { setupKind: 'gold-swing', analogues: ['sweep', 'weekly'], strategy: 'SWING', lane: 'gold' },
  'gold-scalp': { setupKind: 'gold-scalp', analogues: ['fvg', 'openrange'], strategy: 'SCALP', lane: 'gold' },
  goldswing: { setupKind: 'gold-swing', analogues: ['sweep', 'weekly'], strategy: 'SWING', lane: 'gold' },
  goldscalp: { setupKind: 'gold-scalp', analogues: ['fvg', 'openrange'], strategy: 'SCALP', lane: 'gold' },
};

export const TAB_DEFAULTS = {
  swing: { minRR: 2.0, minTurnoverUsd: 200000, timeStopBars: 60, atrStopMult: 1.5, minEvidence: 7 },
  scalp: { minRR: 2.25, minTurnoverUsd: 200000, timeStopBars: 12, atrStopMult: 1.5, minEvidence: 7 },
  edge: { minRR: 2.0, minTurnoverUsd: 5000000, minTally: 6, stopAtr: 2.0, maxHold: 12 },
  best: { minRR: 2.0, minFamScore: 7, minTurnoverUsd: 200000 },
  smart: { minRR: 2.0, minTurnoverUsd: 5000000, minEvidence: 2, minAbsChg24: 2 },
  squeeze: { minRR: 2.0, stopAtr: 1.5, t1R: 2.0, t2R: 3.5, volZMin: 0.5 },
  reversalsniper: { minRR: 1.5, minConviction: 4, minLev: 30 },
  smc: { minRR: 2.5, minTurnoverUsd: 5000000 },
  ob: { minRR: 2.0, minTurnoverUsd: 5000000 },
  trap: { minRR: 1.5, minTurnoverUsd: 5000000 },
  divergence: { minRR: 2.5, minTurnoverUsd: 5000000 },
  div: { minRR: 2.5, minTurnoverUsd: 5000000 },
  coil: { minRR: 2.0, minTurnoverUsd: 2000000 },
  apex: { minRR: 2.0, minTurnoverUsd: 2000000 },
  oiflow: { minRR: 2.0, minTurnoverUsd: 30000000, minEvidence: 2 },
  liqs: { minRR: 2.0, minTapeUsd: 100000, spikeUsd: 2000000 },
  meanrev: { minRR: 1.2, minTurnoverUsd: 20000000, maxHold: 10 },
  carry: { minSpreadApr: 25, minTurnoverUsd: 20000000 },
  chartvision: { minRR: 2.0, minGates: 6 },
  'gold-swing': { minRR: 1.5, minTurnoverUsd: 0 },
  'gold-scalp': { minRR: 1.2, minTurnoverUsd: 0 },
  goldswing: { minRR: 1.5 },
  goldscalp: { minRR: 1.2 },
};

function fin(v){
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function worstAnalogue(analogues, byMech){
  let worst = null;
  for (const k of analogues || []){
    const row = byMech && byMech[k];
    if (!row || !(row.n >= 50)) continue;
    const net = fin(row.avgNetR) ?? fin(row.expectancyNetR);
    if (net === null) continue;
    if (!worst || net < worst.net) worst = { kind: k, n: row.n, net, gross: row.avgGrossR };
  }
  return worst;
}

function bestAnalogue(analogues, byMech){
  let best = null;
  for (const k of analogues || []){
    const row = byMech && byMech[k];
    if (!row || !(row.n >= 50)) continue;
    const net = fin(row.avgNetR) ?? fin(row.expectancyNetR);
    const gross = fin(row.avgGrossR);
    if (net === null || gross === null || !(gross > 0) || !(net > 0)) continue;
    if (!best || net > best.net) best = { kind: k, n: row.n, net, gross };
  }
  return best;
}

/** Tighten-only RR bump from measured net R (never loosens). */
export function btRrTighten(baseMinRr, worstNetR){
  baseMinRr = fin(baseMinRr) || 2.0;
  if (worstNetR === null || !isFinite(worstNetR)) return baseMinRr;
  if (worstNetR <= -0.35) return Math.min(4.0, baseMinRr + 0.75);
  if (worstNetR <= -0.15) return Math.min(3.5, baseMinRr + 0.5);
  if (worstNetR <= -0.05) return Math.min(3.0, baseMinRr + 0.25);
  return baseMinRr;
}

export function btBuildTabParams(opts){
  opts = opts || {};
  const byMech = opts.byMechanic || {};
  const global = Object.assign({}, opts.global || {});
  const tabs = {};
  const notes = [];

  Object.keys(DESK_BT_MAP).forEach(function(tab){
    const meta = DESK_BT_MAP[tab];
    const base = Object.assign({}, TAB_DEFAULTS[tab] || TAB_DEFAULTS.swing || {});
    const worst = worstAnalogue(meta.analogues, byMech);
    const best = bestAnalogue(meta.analogues, byMech);
    if (fin(global.rrMin) !== null && (tab === 'swing' || tab === 'best' || tab === 'edge')){
      base.minRR = Math.max(base.minRR || 2, global.rrMin);
    }
    if (fin(global.rrMin) !== null && tab === 'scalp'){
      base.minRR = Math.max(base.minRR || 2.25, global.rrMin + 0.25);
    }
    if (fin(global.timeStopSwingBars) !== null && base.timeStopBars >= 40){
      base.timeStopBars = global.timeStopSwingBars;
    }
    if (fin(global.timeStopScalpBars) !== null && base.timeStopBars <= 20){
      base.timeStopBars = global.timeStopScalpBars;
    }
    if (fin(global.atrStopMult) !== null && base.atrStopMult != null){
      base.atrStopMult = Math.min(base.atrStopMult, global.atrStopMult);
    }
    if (worst){
      base.minRR = btRrTighten(base.minRR, worst.net);
      base.backtestWorst = worst;
      if (worst.net <= -0.15) base.minEvidence = Math.max(base.minEvidence || 2, 3);
      notes.push(tab + ': tightened minRR to ' + base.minRR + ' (' + worst.kind + ' net ' + worst.net.toFixed(2) + 'R n=' + worst.n + ')');
    }
    if (best) base.backtestBest = best;
    tabs[tab] = base;
  });

  return { global, tabs, notes };
}

export function btBuildSetupProfileFromBacktest(byMech, opts){
  opts = opts || {};
  const minSample = opts.minSample || 20;
  const setups = {};
  const kindMap = {
    swing: ['TREND-RECLAIM', 'HTF-PULLBACK', 'DONCHIAN-DRIVE', 'MMOVE'],
    scalp: ['NR7-BREAK', 'ORB'],
    'smc-fvg': ['FVG-FILL'],
    meanrev: ['RSI-DIVERGE', 'EXHAUST-REVERT', 'POC-REVERT', 'PIN-REJECT'],
    trap: ['SWEEP-RECLAIM', 'EQH-SWEEP', 'EQL-SWEEP'],
  };
  function blank(){ return { n: 0, wins: 0, losses: 0, wr: null, avgWinR: null, avgLossR: null, expectancy: null, medianWinBars: null }; }
  Object.keys(kindMap).forEach(function(setupKind){
    setups[setupKind] = { 'risk-on': blank(), 'risk-off': blank(), chop: blank(), trend: blank(), all: blank() };
    let sumN = 0, sumWins = 0, sumLosses = 0, sumR = 0;
    kindMap[setupKind].forEach(function(mech){
      const row = byMech[mech];
      if (!row || !row.n) return;
      sumN += row.n;
      sumWins += row.wins || 0;
      sumLosses += row.losses || 0;
      const net = fin(row.avgNetR) ?? fin(row.expectancyNetR) ?? 0;
      sumR += net * row.n;
    });
    if (sumN > 0){
      const wr = sumWins / sumN;
      const exp = sumR / sumN;
      const bucket = { n: sumN, wins: sumWins, losses: sumLosses, wr: Math.round(wr * 1000) / 1000,
        avgWinR: 1.5, avgLossR: 1.0, expectancy: Math.round(exp * 1000) / 1000, medianWinBars: null };
      setups[setupKind].all = bucket;
      setups[setupKind].chop = Object.assign({}, bucket);
      if (exp >= 0.05) setups[setupKind]['risk-on'] = Object.assign({}, bucket);
      if (exp <= -0.05) setups[setupKind]['risk-off'] = Object.assign({}, bucket);
    }
  });
  return { version: 1, minSample, computedAt: Date.now(),
    note: 'Synthesized from backtest-omniroute-v531 byMechanic aggregates (offline replay, not live LOG)',
    setups };
}

export function btBuildRegimeExpectancy(analysis, goldEdge){
  const exp = {};
  const strategies = ['SWING', 'SCALP', 'EDGE', 'SMC', 'OB', 'DIV', 'TRAP', 'MEANREV', 'CARRY', 'SMART', 'BEST'];
  strategies.forEach(function(s){ exp[s] = { 'RISK-ON': 0.1, MIXED: 0, 'RISK-OFF': -0.05 }; });
  if (analysis && analysis.omniroute && analysis.omniroute.overall){
    const o = analysis.omniroute.overall;
    const net = fin(o.avgNetR) ?? fin(o.expectancyNetR) ?? -0.24;
    exp.SWING.MIXED = Math.round(net * 1000) / 1000;
    exp.BEST.MIXED = Math.round(net * 1000) / 1000;
    exp.SCALP.MIXED = Math.round((net + 0.05) * 1000) / 1000;
  }
  if (analysis && Array.isArray(analysis.omniroute && analysis.omniroute.prefer)){
    analysis.omniroute.prefer.forEach(function(p){
      if (p && fin(p.avgNetR) > 0) exp.EDGE['RISK-ON'] = Math.max(exp.EDGE['RISK-ON'], p.avgNetR);
    });
  }
  if (analysis && Array.isArray(analysis.omniroute && analysis.omniroute.demote)){
    analysis.omniroute.demote.forEach(function(d){
      if (!d || !fin(d.avgNetR)) return;
      if (d.kind === 'FVG-FILL') exp.SMC.MIXED = d.avgNetR;
      if (d.kind === 'RSI-DIVERGE') exp.DIV.MIXED = d.avgNetR;
      if (String(d.kind || '').indexOf('SWEEP') >= 0) exp.TRAP.MIXED = Math.min(exp.TRAP.MIXED, d.avgNetR);
    });
  }
  if (goldEdge && goldEdge.overallNetR != null){
    exp.SWING['RISK-ON'] = Math.max(exp.SWING['RISK-ON'], goldEdge.swing && goldEdge.swing.sweep ? goldEdge.swing.sweep.net : -1);
  }
  return exp;
}

export function readJsonSafe(p){
  try{
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }catch(e){ return null; }
}

export function syncBacktestTabParams(root){
  root = root || process.cwd();
  const omniPath = path.join(root, 'scripts', 'backtest-omniroute-v531-results.json');
  const analysisPath = path.join(root, 'scripts', 'omni-bt-analysis.json');
  const goldEdgePath = path.join(root, 'scripts', 'gold-setup-edge.json');
  const exitPath = path.join(root, 'scripts', 'exit-optimization-results.json');
  const paramDriftPath = path.join(root, 'data', 'param-drift.json');

  const omni = readJsonSafe(omniPath);
  const analysis = readJsonSafe(analysisPath);
  const goldEdge = readJsonSafe(goldEdgePath);
  const exitOpt = readJsonSafe(exitPath);
  const paramDrift = readJsonSafe(paramDriftPath) || {};

  const byMech = (omni && omni.aggregates && omni.aggregates.byMechanic) || {};
  const global = Object.assign({
    rrMin: 2.0,
    timeStopScalpBars: 12,
    timeStopSwingBars: 60,
    macroVetoAbs: 3,
    atrStopMult: 1.5,
    costToxicR: 0.125,
  }, paramDrift.params || {});

  if (exitOpt && exitOpt.families && exitOpt.families.TREND && exitOpt.families.TREND.chosen){
    const ch = exitOpt.families.TREND.chosen;
    if (ch.horizon) global.timeStopSwingBars = Math.min(72, Math.max(40, ch.horizon));
    if (ch.T) global.swingTargetR = ch.T;
  }

  const built = btBuildTabParams({ byMechanic: byMech, global });
  const out = {
    version: 1,
    updatedAt: new Date().toISOString(),
    sources: [
      'scripts/backtest-omniroute-v531-results.json',
      'scripts/omni-bt-analysis.json',
      'scripts/gold-setup-edge.json',
      'scripts/exit-optimization-results.json',
      'data/param-drift.json',
    ],
    global: built.global,
    tabs: built.tabs,
    notes: built.notes,
    preferKinds: (analysis && analysis.omniroute && analysis.omniroute.prefer || []).map(function(p){ return p.kind; }),
    demoteKinds: (analysis && analysis.omniroute && analysis.omniroute.demote || []).map(function(p){ return p.kind; }),
  };

  const deskOut = path.join(root, 'data', 'desk-tab-params.json');
  fs.writeFileSync(deskOut, JSON.stringify(out, null, 2) + '\n');

  const profilePath = path.join(root, 'data', 'setup-profile.json');
  let seed = readJsonSafe(profilePath) || {};
  const profile = btBuildSetupProfileFromBacktest(byMech, { minSample: seed.minSample || 20 });
  profile.timeStopDefaults = seed.timeStopDefaults || {
    scalp: { bars: global.timeStopScalpBars, res: '15m' },
    swing: { bars: global.timeStopSwingBars, res: '4h' },
    best: { bars: global.timeStopSwingBars, res: '4h' },
    'gold-swing': { bars: 30, res: '4h' },
    judas: { bars: 8, res: '1h' },
    'smc-fvg': { bars: 5, res: '4h' },
  };
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n');

  const regimePath = path.join(root, 'data', 'strategy-regime-state.json');
  let regimeSeed = readJsonSafe(regimePath) || {};
  const expectancy = btBuildRegimeExpectancy(analysis, goldEdge);
  fs.writeFileSync(regimePath, JSON.stringify({
    updated: new Date().toISOString(),
    note: 'Backtest-derived 60d-style expectancy prior + hand-tuned RISK-ON boosts. Negative → REGIME PAUSED.',
    expectancy,
  }, null, 2) + '\n');

  return { deskOut, profilePath, regimePath, tabCount: Object.keys(built.tabs).length, notes: built.notes };
}
