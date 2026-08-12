/* HARDGATE — tear sheet on the R ledger (QuantStats-style metrics + deflated Sharpe).
   Deflated Sharpe: Bailey & Lopez de Prado (2014). Pure, no throws. */

import { hgEventsFromRecords, hgEffectiveN } from './sample-uniqueness.mjs';

function settledRs(records){
  const out = [];
  const arr = Array.isArray(records) ? records : [];
  for (let i = 0; i < arr.length; i++){
    const r = arr[i];
    if (r && r.status === 'settled' && Number.isFinite(+r.r)) out.push(+r.r);
  }
  return out;
}

function sum(a){ return a.reduce(function(x, y){ return x + y; }, 0); }

function maxDrawdownRs(rs){
  if (!rs.length) return 0;
  let peak = 0, eq = 0, dd = 0;
  for (let i = 0; i < rs.length; i++){
    eq += rs[i];
    if (eq > peak) peak = eq;
    const cur = peak - eq;
    if (cur > dd) dd = cur;
  }
  return dd;
}

function streaks(rs){
  let win = 0, loss = 0, maxWin = 0, maxLoss = 0;
  for (let i = 0; i < rs.length; i++){
    if (rs[i] > 0){ win++; loss = 0; if (win > maxWin) maxWin = win; }
    else { loss++; win = 0; if (loss > maxLoss) maxLoss = loss; }
  }
  return { maxWinStreak: maxWin, maxLossStreak: maxLoss };
}

/** Sharpe proxy on R-multiples (not annualized — comparable within ledger). */
function sharpeProxy(rs){
  if (rs.length < 5) return null;
  const mean = sum(rs) / rs.length;
  let varSum = 0;
  for (let i = 0; i < rs.length; i++) varSum += (rs[i] - mean) ** 2;
  const std = Math.sqrt(varSum / rs.length);
  return std > 0 ? mean / std : null;
}

/** Sortino proxy — downside deviation only. */
function sortinoProxy(rs){
  if (rs.length < 5) return null;
  const mean = sum(rs) / rs.length;
  const downs = rs.filter(function(r){ return r < 0; });
  if (!downs.length) return mean > 0 ? Infinity : null;
  const downDev = Math.sqrt(sum(downs.map(function(r){ return r * r; })) / rs.length);
  return downDev > 0 ? mean / downDev : null;
}

/** Deflated Sharpe ratio (Bailey & Lopez de Prado, 2014) — uses effective n for trials. */
export function hgDeflatedSharpe(sharpe, nObs, numTrials){
  if (sharpe === null || !Number.isFinite(sharpe) || !(nObs >= 5)) return null;
  const trials = Math.max(1, numTrials || 1);
  const z = sharpe * Math.sqrt(Math.max(1, nObs - 1));
  const euler = 0.5772156649;
  const emax = (1 - euler) * approxInvNorm(1 - 1 / trials) + euler * approxInvNorm(1 - 1 / (trials * Math.E));
  const deflated = (z - emax) / Math.sqrt(Math.max(1, nObs - 1));
  return { sharpe: sharpe, deflated: deflated, nObs: nObs, numTrials: trials, emax: emax };
}

function approxInvNorm(p){
  if (!(p > 0 && p < 1)) return 0;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285084469138e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894430510475e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709091636e-03, 3.223964580411365e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const plow = 0.02425, phigh = 1 - plow;
  let q, r;
  if (p < plow){
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > phigh){
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** @returns tear sheet object for UI / formation lab */
export function hgTearSheet(records, opts){
  opts = opts || {};
  const rs = settledRs(records);
  const n = rs.length;
  if (!n){
    return { ok: false, n: 0, note: 'no settled R-scored trades' };
  }
  const events = hgEventsFromRecords(records);
  const effectiveN = hgEffectiveN(events);
  const wins = rs.filter(function(r){ return r > 0; });
  const losses = rs.filter(function(r){ return r <= 0; });
  const grossWin = sum(wins);
  const grossLoss = Math.abs(sum(losses));
  const expectancy = sum(rs) / n;
  const winRate = wins.length / n;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
  const maxDD = maxDrawdownRs(rs);
  const st = streaks(rs);
  const sharpe = sharpeProxy(rs);
  const sortino = sortinoProxy(rs);
  const calmar = maxDD > 0 ? (sum(rs) / maxDD) : null;
  const numTrials = opts.numTrials || Math.max(1, Math.round(effectiveN));
  const deflated = sharpe !== null ? hgDeflatedSharpe(sharpe, effectiveN >= 5 ? effectiveN : n, numTrials) : null;

  return {
    ok: true,
    n,
    effectiveN,
    wins: wins.length,
    losses: losses.length,
    winRate,
    expectancy,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor,
    totalR: sum(rs),
    maxDrawdownR: maxDD,
    sharpeProxy: sharpe,
    sortinoProxy: sortino,
    calmarProxy: calmar,
    deflatedSharpe: deflated,
    maxWinStreak: st.maxWinStreak,
    maxLossStreak: st.maxLossStreak,
    enoughData: n >= 5,
    nLabel: 'n=' + n + ' (effective n=' + (Math.round(effectiveN * 10) / 10) + ')',
  };
}
