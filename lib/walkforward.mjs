/* HARDGATE — walk-forward split + bootstrap Monte Carlo on the R ledger. */

import { hgEventsFromRecords, hgEffectiveN } from './sample-uniqueness.mjs';

export function wfExpectancy(rs){
  var arr = (Array.isArray(rs) ? rs : []).filter(function(r){ return isFinite(+r); }).map(Number);
  var n = arr.length;
  if (!n) return { n: 0, expectancy: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0 };
  var wins = arr.filter(function(r){ return r > 0; });
  var losses = arr.filter(function(r){ return r <= 0; });
  function sum(a){ return a.reduce(function(x, y){ return x + y; }, 0); }
  var grossWin = sum(wins), grossLoss = Math.abs(sum(losses));
  return {
    n: n,
    expectancy: sum(arr) / n,
    winRate: wins.length / n,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
  };
}

export function walkForwardSplit(records, trainFrac){
  trainFrac = (trainFrac > 0.3 && trainFrac < 0.95) ? trainFrac : 0.7;
  var arr = (Array.isArray(records) ? records : []).slice().sort(function(a, b){
    return (+a.closedAt || 0) - (+b.closedAt || 0);
  });
  var rs = arr.map(function(r){ return +r.r; }).filter(function(r){ return isFinite(r); });
  var cut = Math.floor(rs.length * trainFrac);
  var train = wfExpectancy(rs.slice(0, cut));
  var test = wfExpectancy(rs.slice(cut));
  var decay = (train.expectancy !== 0) ? (test.expectancy - train.expectancy) / Math.abs(train.expectancy) : 0;
  var settled = arr.filter(function(r){ return r && r.status === 'settled'; });
  var events = hgEventsFromRecords(settled);
  var effectiveN = hgEffectiveN(events);
  var minTestN = Math.max(12, Math.ceil(effectiveN * 0.15));
  return {
    train: train, test: test, decayPct: decay * 100,
    rawN: rs.length,
    effectiveN: effectiveN,
    nLabel: 'n=' + rs.length + ' (effective n=' + (Math.round(effectiveN * 10) / 10) + ')',
    verdict: (test.n < minTestN) ? 'INSUFFICIENT'
           : (test.expectancy <= 0) ? 'OVERFIT'
           : (decay < -0.5) ? 'DEGRADED' : 'HOLDS',
  };
}

function _mulberry(seed){
  var a = seed >>> 0;
  return function(){
    a += 0x6D2B79F5; a >>>= 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function monteCarloR(rs, opts){
  opts = opts || {};
  var trials = opts.trials || 2000;
  var riskPct = (opts.riskPct > 0) ? opts.riskPct : 0.01;
  var seed = opts.seed || 12345;
  var rnd = _mulberry(seed);
  var arr = (Array.isArray(rs) ? rs : []).map(Number).filter(function(r){ return isFinite(r); });
  if (arr.length < 20) return { ok: false, note: 'need >= 20 closed trades', n: arr.length };
  var len = opts.horizon || arr.length;
  var finals = [], maxDDs = [], ruin = 0;
  for (var t = 0; t < trials; t++){
    var eq = 1, peak = 1, dd = 0;
    for (var i = 0; i < len; i++){
      var r = arr[Math.floor(rnd() * arr.length)];
      eq *= (1 + r * riskPct);
      if (eq > peak) peak = eq;
      var cur = 1 - eq / peak;
      if (cur > dd) dd = cur;
      if (eq <= 0.5){ ruin++; break; }
    }
    finals.push(eq - 1);
    maxDDs.push(dd);
  }
  function q(a, p){
    var s = a.slice().sort(function(x, y){ return x - y; });
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
  }
  return {
    ok: true, n: arr.length, trials: trials, riskPct: riskPct,
    medianReturnPct: q(finals, 0.5) * 100,
    p05ReturnPct: q(finals, 0.05) * 100,
    p95ReturnPct: q(finals, 0.95) * 100,
    medianMaxDDPct: q(maxDDs, 0.5) * 100,
    p95MaxDDPct: q(maxDDs, 0.95) * 100,
    ruinProbPct: (ruin / trials) * 100,
  };
}
