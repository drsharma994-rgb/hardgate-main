/* HARDGATE — browser purged CV bridge for gate replay (loads after gate-replay-oos.js). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
var MAX_GRID = 24;

function sampleTime(s){
  if (s == null) return 0;
  if (isFinite(+s.at)) return +s.at;
  if (isFinite(+s.t)) return +s.t;
  if (isFinite(+s.i)) return +s.i;
  if (isFinite(+s.closedAt)) return +s.closedAt;
  return 0;
}

function purgedTrainTestSplit(samples, opts){
  opts = opts || {};
  var trainFrac = (opts.trainFrac > 0.3 && opts.trainFrac < 0.95) ? opts.trainFrac : 0.7;
  var labelHorizon = Math.max(1, opts.labelHorizon || opts.embargoBars || 14);
  var embargo = Math.max(0, opts.embargo != null ? opts.embargo : Math.ceil(labelHorizon * 0.5));
  var arr = (Array.isArray(samples) ? samples : []).slice().sort(function(a, b){ return sampleTime(a) - sampleTime(b); });
  if (!arr.length) return { train: [], test: [], purged: 0, embargo: embargo, note: 'no samples' };
  var cut = Math.max(1, Math.floor(arr.length * trainFrac));
  var testStartTime = sampleTime(arr[cut]);
  var purgeBefore = testStartTime - labelHorizon;
  var embargoEnd = testStartTime + embargo;
  var purged = 0, train = [];
  for (var i = 0; i < cut; i++){
    var s = arr[i];
    if (sampleTime(s) >= purgeBefore && sampleTime(s) < testStartTime){ purged++; continue; }
    train.push(s);
  }
  var test = [];
  for (var j = cut; j < arr.length; j++){
    if (sampleTime(arr[j]) < embargoEnd) continue;
    test.push(arr[j]);
  }
  return { train: train, test: test, purged: purged, embargo: embargo,
    note: train.length + ' train / ' + test.length + ' test · purged ' + purged + ' · embargo ' + embargo };
}

function hgReplaySweepPurged(replay, gate, thresholds, cmp, opts){
  opts = opts || {};
  var samples = (replay && replay.samples) || [];
  if (!samples.length) return { gate: gate, rows: [], note: 'no samples', oos: null, purged: null };
  if (thresholds.length > MAX_GRID) thresholds = thresholds.slice(0, MAX_GRID);
  var split = purgedTrainTestSplit(samples, opts);
  var train = split.train, test = split.test;
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
      rows.push({ t: t, setups: n, settled: settled, hitPct: settled ? wins / settled : null, expectancyR: settled ? sumR / settled : null });
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
      setups: n2,
      settled: settled2,
      hitPct: settled2 ? wins2 / settled2 : null,
      expectancyR: settled2 ? sumR2 / settled2 : null,
      verdict: settled2 < 8 ? 'INSUFFICIENT'
        : (settled2 && best.expectancyR != null && (sumR2 / settled2) >= best.expectancyR * 0.7 ? 'HOLDS' : 'DEGRADED'),
    };
  }
  return { gate: gate, rows: trainRows, note: split.note, oos: oos, purged: { count: split.purged, embargo: split.embargo } };
}

try{
  G.hgPurgedTrainTestSplit = purgedTrainTestSplit;
  G.hgReplaySweepPurged = hgReplaySweepPurged;
}catch(e){}

})();
