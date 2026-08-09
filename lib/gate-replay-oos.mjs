/* HARDGATE — capped OOS gate replay sweep (QuantDinger-style). */

export const HG_REPLAY_SWEEP_MAX = 500;

/** Split samples 70/30 train/test; sweep only on train, validate best on test. */
export function hgReplaySweepOos(replay, gate, thresholds, cmp, opts){
  opts = opts || {};
  var maxGrid = opts.maxGrid != null ? +opts.maxGrid : 24;
  var samples = (replay && replay.samples) || [];
  if (!samples.length){
    return { gate: gate, rows: [], note: 'no replay samples', oos: null };
  }
  if (thresholds.length > maxGrid){
    thresholds = thresholds.slice(0, maxGrid);
  }
  var split = Math.max(1, Math.floor(samples.length * 0.7));
  var train = samples.slice(0, split);
  var test = samples.slice(split);

  function sweepSet(set){
    var isMax = (cmp === 'max');
    var rows = [];
    for (var a = 0; a < thresholds.length; a++){
      var t = thresholds[a];
      var n = 0, settled = 0, sumR = 0, wins = 0;
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
    var isMax = (cmp === 'max');
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
      setups: n2,
      settled: settled2,
      hitPct: settled2 ? wins2 / settled2 : null,
      expectancyR: settled2 ? sumR2 / settled2 : null,
      verdict: settled2 < 8 ? 'INSUFFICIENT' : (settled2 && best.expectancyR != null && (sumR2 / settled2) >= best.expectancyR * 0.7 ? 'HOLDS' : 'DEGRADED'),
    };
  }

  return {
    gate: gate,
    rows: trainRows,
    note: train.length + ' train / ' + test.length + ' test · max grid ' + maxGrid,
    oos: oos,
    cappedAt: HG_REPLAY_SWEEP_MAX,
  };
}
