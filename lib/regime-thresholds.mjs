/* HARDGATE — regime-adjusted gate thresholds (pure). */

export const HG_REGIME_BASE = {
  minRR: 2.0,
  fundingZCap: 2.5,
  maxConcurrent: 4,
  vetoCounterTrend: false,
};

function cloneThresholds(t){
  return {
    minRR: t.minRR,
    fundingZCap: t.fundingZCap,
    maxConcurrent: t.maxConcurrent,
    vetoCounterTrend: !!t.vetoCounterTrend,
  };
}

function labelForScore(score){
  if (score === null || score === undefined || !isFinite(+score)) return 'NEUTRAL';
  score = +score;
  if (score >= 3) return 'RISK-ON';
  if (score <= -3) return 'RISK-OFF';
  return 'NEUTRAL';
}

export function hgRegimeAdjust(baseThresholds, regimeScore, lane){
  var base = cloneThresholds(Object.assign({}, HG_REGIME_BASE, baseThresholds || {}));
  var applied = [];
  if (regimeScore === null || regimeScore === undefined || !isFinite(+regimeScore)){
    return {
      thresholds: cloneThresholds(base),
      regimeLabel: 'NEUTRAL',
      applied: ['regime dark — base thresholds unchanged'],
      regimeScore: 0,
    };
  }
  var score = +regimeScore;
  var label = labelForScore(score);
  var damp = (String(lane || '').toLowerCase() === 'gold') ? 0.5 : 1;

  var out = cloneThresholds(base);

  if (score >= 3){
    out.minRR = 2.0;
    out.fundingZCap = 2.5;
    out.maxConcurrent = 4;
    out.vetoCounterTrend = false;
  } else if (score <= -3){
    out.minRR = 2.0 + 0.6 * damp;
    out.fundingZCap = 2.5 - 1.0 * damp;
    out.maxConcurrent = Math.max(2, Math.round(4 - 2 * damp));
    out.vetoCounterTrend = damp >= 1;
    applied.push('minRR ' + out.minRR.toFixed(1) + ' (RISK-OFF)');
    applied.push('fundingZ cap ' + out.fundingZCap.toFixed(1));
    applied.push('maxConcurrent ' + out.maxConcurrent);
    if (out.vetoCounterTrend) applied.push('counter-trend veto ON');
  } else {
    out.minRR = 2.0 + 0.2 * damp;
    out.fundingZCap = 2.5 - 0.5 * damp;
    out.maxConcurrent = Math.max(3, Math.round(4 - 1 * damp));
    out.vetoCounterTrend = false;
    applied.push('minRR ' + out.minRR.toFixed(1) + ' (NEUTRAL)');
    applied.push('fundingZ cap ' + out.fundingZCap.toFixed(1));
    applied.push('maxConcurrent ' + out.maxConcurrent);
  }

  return { thresholds: out, regimeLabel: label, applied: applied, regimeScore: score };
}

export function hgRegimeResolveState(regimeStateFn){
  try{
    var st = (typeof regimeStateFn === 'function') ? regimeStateFn() : null;
    if (!st || typeof st.score !== 'number' || !isFinite(st.score)){
      return { score: 0, label: 'NEUTRAL', dark: true, raw: st };
    }
    return { score: st.score, label: labelForScore(st.score), dark: false, raw: st };
  }catch(e){
    return { score: 0, label: 'NEUTRAL', dark: true, raw: null };
  }
}
