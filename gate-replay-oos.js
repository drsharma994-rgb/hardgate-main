/* HARDGATE — browser OOS gate replay sweep (mirrors lib/gate-replay-oos.mjs). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
var MAX_GRID = 24;

function hgReplaySweepOos(replay, gate, thresholds, cmp){
  var samples = (replay && replay.samples) || [];
  if (!samples.length) return { gate: gate, rows: [], note: 'no samples', oos: null };
  if (thresholds.length > MAX_GRID) thresholds = thresholds.slice(0, MAX_GRID);
  var split = Math.max(1, Math.floor(samples.length * 0.7));
  var train = samples.slice(0, split);
  var test = samples.slice(split);
  var isMax = (cmp === 'max');

  function sweepSet(set){
    var rows = [];
    for (var a = 0; a < thresholds.length; a++){
      var t = thresholds[a], n = 0, settled = 0, sumR = 0, wins = 0;
      for (var s = 0; s < set.length; s++){
        var smp = set[s];
        var othersOk = true;
        for (var k in smp.pass){ if (k !== gate && !smp.pass[k]) { othersOk = false; break; } }
        if (!othersOk) continue;
        var v = smp.vals[gate];
        if (v === null || !isFinite(v)) continue;
        if (isMax ? !(v <= t) : !(v >= t)) continue;
        n++;
        if (smp.r !== null){ settled++; sumR += smp.r; if (smp.r > 0) wins++; }
      }
      rows.push({ t: t, setups: n, settled: settled,
        hitPct: settled ? wins / settled : null,
        expectancyR: settled ? sumR / settled : null });
    }
    return rows;
  }

  var trainRows = sweepSet(train);
  var best = null;
  for (var i = 0; i < trainRows.length; i++){
    var r = trainRows[i];
    if (!r.settled) continue;
    if (!best || (r.expectancyR != null && r.expectancyR > best.expectancyR)) best = r;
  }
  var oos = null;
  if (best && test.length){
    var n2 = 0, settled2 = 0, sumR2 = 0, wins2 = 0;
    for (var j = 0; j < test.length; j++){
      var smp2 = test[j];
      var ok2 = true;
      for (var k2 in smp2.pass){ if (k2 !== gate && !smp2.pass[k2]) { ok2 = false; break; } }
      if (!ok2) continue;
      var v2 = smp2.vals[gate];
      if (v2 === null || !isFinite(v2)) continue;
      if (isMax ? !(v2 <= best.t) : !(v2 >= best.t)) continue;
      n2++;
      if (smp2.r !== null){ settled2++; sumR2 += smp2.r; if (smp2.r > 0) wins2++; }
    }
    oos = {
      threshold: best.t,
      settled: settled2,
      expectancyR: settled2 ? sumR2 / settled2 : null,
      verdict: settled2 < 8 ? 'INSUFFICIENT' : 'HOLDS',
    };
  }
  return { gate: gate, rows: trainRows, oos: oos, note: train.length + ' train / ' + test.length + ' test' };
}

G.hgReplaySweepOos = hgReplaySweepOos;
})();
