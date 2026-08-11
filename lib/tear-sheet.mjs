/* HARDGATE — QuantStats/Empyrical-inspired tear sheet on the R ledger. Pure, no throws. */

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

/** @returns tear sheet object for UI / formation lab */
export function hgTearSheet(records){
  const rs = settledRs(records);
  const n = rs.length;
  if (!n){
    return { ok: false, n: 0, note: 'no settled R-scored trades' };
  }
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

  return {
    ok: true,
    n,
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
    maxWinStreak: st.maxWinStreak,
    maxLossStreak: st.maxLossStreak,
    enoughData: n >= 5,
  };
}
