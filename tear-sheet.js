/* HARDGATE — browser tear-sheet bridge (QuantStats-inspired, loads after scorecard.js). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function settledRs(records){
  var out = [];
  for (var i = 0; i < (records || []).length; i++){
    var r = records[i];
    if (r && r.status === 'settled' && isFinite(+r.r)) out.push(+r.r);
  }
  return out;
}

function sum(a){ return a.reduce(function(x, y){ return x + y; }, 0); }

function maxDrawdownRs(rs){
  if (!rs.length) return 0;
  var peak = 0, eq = 0, dd = 0;
  for (var i = 0; i < rs.length; i++){
    eq += rs[i];
    if (eq > peak) peak = eq;
    var cur = peak - eq;
    if (cur > dd) dd = cur;
  }
  return dd;
}

function streaks(rs){
  var win = 0, loss = 0, maxWin = 0, maxLoss = 0;
  for (var i = 0; i < rs.length; i++){
    if (rs[i] > 0){ win++; loss = 0; if (win > maxWin) maxWin = win; }
    else { loss++; win = 0; if (loss > maxLoss) maxLoss = loss; }
  }
  return { maxWinStreak: maxWin, maxLossStreak: maxLoss };
}

function sharpeProxy(rs){
  if (rs.length < 5) return null;
  var mean = sum(rs) / rs.length, varSum = 0;
  for (var i = 0; i < rs.length; i++) varSum += Math.pow(rs[i] - mean, 2);
  var std = Math.sqrt(varSum / rs.length);
  return std > 0 ? mean / std : null;
}

function sortinoProxy(rs){
  if (rs.length < 5) return null;
  var mean = sum(rs) / rs.length;
  var downs = rs.filter(function(r){ return r < 0; });
  if (!downs.length) return mean > 0 ? Infinity : null;
  var downDev = Math.sqrt(sum(downs.map(function(r){ return r * r; })) / rs.length);
  return downDev > 0 ? mean / downDev : null;
}

function hgTearSheet(records){
  var rs = settledRs(records);
  var n = rs.length;
  if (!n) return { ok: false, n: 0, note: 'no settled R-scored trades' };
  var wins = rs.filter(function(r){ return r > 0; });
  var losses = rs.filter(function(r){ return r <= 0; });
  var grossWin = sum(wins), grossLoss = Math.abs(sum(losses));
  var expectancy = sum(rs) / n;
  var winRate = wins.length / n;
  var profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
  var maxDD = maxDrawdownRs(rs);
  var st = streaks(rs);
  var sharpe = sharpeProxy(rs);
  var sortino = sortinoProxy(rs);
  var calmar = maxDD > 0 ? (sum(rs) / maxDD) : null;
  var effectiveN = (typeof G.hgEffectiveN === 'function' && typeof G.hgEventsFromRecords === 'function')
    ? G.hgEffectiveN(G.hgEventsFromRecords(records)) : n;
  return {
    ok: true, n: n, effectiveN: effectiveN,
    nLabel: 'n=' + n + ' (effective n=' + (Math.round(effectiveN * 10) / 10) + ')', wins: wins.length, losses: losses.length,
    winRate: winRate, expectancy: expectancy,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: profitFactor, totalR: sum(rs), maxDrawdownR: maxDD,
    sharpeProxy: sharpe, sortinoProxy: sortino, calmarProxy: calmar,
    maxWinStreak: st.maxWinStreak, maxLossStreak: st.maxLossStreak,
    enoughData: n >= 5,
  };
}

try{ G.hgTearSheet = hgTearSheet; }catch(e){}

})();
