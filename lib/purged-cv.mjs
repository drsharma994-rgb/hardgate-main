/* HARDGATE — purged cross-validation for gate replay / scorecard.
   Technique: Lopez de Prado, Advances in Financial Machine Learning ch.7. */

/** Sort samples by time index or timestamp. */
function sampleTime(s){
  if (s == null) return 0;
  if (Number.isFinite(+s.at)) return +s.at;
  if (Number.isFinite(+s.t)) return +s.t;
  if (Number.isFinite(+s.i)) return +s.i;
  if (Number.isFinite(+s.closedAt)) return +s.closedAt;
  return 0;
}

/** @returns {{ train:Array, test:Array, purged:number, embargo:number, note:string }} */
export function purgedTrainTestSplit(samples, opts){
  opts = opts || {};
  const trainFrac = (opts.trainFrac > 0.3 && opts.trainFrac < 0.95) ? opts.trainFrac : 0.7;
  const labelHorizon = Math.max(1, opts.labelHorizon || opts.embargoBars || 14);
  const embargo = Math.max(0, opts.embargo || Math.ceil(labelHorizon * 0.5));

  const arr = (Array.isArray(samples) ? samples : []).slice().sort(function(a, b){
    return sampleTime(a) - sampleTime(b);
  });
  if (!arr.length){
    return { train: [], test: [], purged: 0, embargo, note: 'no samples' };
  }

  const cut = Math.max(1, Math.floor(arr.length * trainFrac));
  const testStartTime = sampleTime(arr[cut]);
  const purgeBefore = testStartTime - labelHorizon;
  const embargoEnd = testStartTime + embargo;

  let purged = 0;
  const train = [];
  for (let i = 0; i < cut; i++){
    const s = arr[i];
    const t = sampleTime(s);
    if (t >= purgeBefore && t < testStartTime){
      purged++;
      continue;
    }
    train.push(s);
  }

  const test = [];
  for (let j = cut; j < arr.length; j++){
    const s2 = arr[j];
    if (sampleTime(s2) < embargoEnd) continue;
    test.push(s2);
  }

  return {
    train,
    test,
    purged,
    embargo,
    note: train.length + ' train / ' + test.length + ' test · purged ' + purged + ' · embargo ' + embargo,
  };
}

/** Replay sweep with purged train/test split. */
export function hgReplaySweepPurged(replay, gate, thresholds, cmp, opts){
  opts = opts || {};
  const maxGrid = opts.maxGrid != null ? +opts.maxGrid : 24;
  const samples = (replay && replay.samples) || [];
  if (!samples.length){
    return { gate, rows: [], note: 'no replay samples', oos: null, purged: null };
  }
  if (thresholds.length > maxGrid) thresholds = thresholds.slice(0, maxGrid);

  const split = purgedTrainTestSplit(samples, opts);
  const train = split.train;
  const test = split.test;
  const isMax = (cmp === 'max');

  function sweepSet(set){
    const rows = [];
    for (let a = 0; a < thresholds.length; a++){
      const t = thresholds[a];
      let n = 0, settled = 0, sumR = 0, wins = 0;
      for (let s = 0; s < set.length; s++){
        const smp = set[s];
        let othersOk = true;
        for (const k in smp.pass){ if (k !== gate && !smp.pass[k]) { othersOk = false; break; } }
        if (!othersOk) continue;
        const v = smp.vals[gate];
        if (v === null || !Number.isFinite(v)) continue;
        if (isMax ? !(v <= t) : !(v >= t)) continue;
        n++;
        if (smp.r !== null){ settled++; sumR += smp.r; if (smp.r > 0) wins++; }
      }
      rows.push({ t, setups: n, settled, hitPct: settled ? wins / settled : null, expectancyR: settled ? sumR / settled : null });
    }
    return rows;
  }

  const trainRows = sweepSet(train);
  let best = null;
  for (let i = 0; i < trainRows.length; i++){
    const r = trainRows[i];
    if (!r.settled) continue;
    if (!best || (r.expectancyR != null && r.expectancyR > best.expectancyR)) best = r;
  }

  let oos = null;
  if (best && test.length){
    let n2 = 0, settled2 = 0, sumR2 = 0, wins2 = 0;
    for (let j = 0; j < test.length; j++){
      const smp2 = test[j];
      let ok2 = true;
      for (const k2 in smp2.pass){ if (k2 !== gate && !smp2.pass[k2]) { ok2 = false; break; } }
      if (!ok2) continue;
      const v2 = smp2.vals[gate];
      if (v2 === null || !Number.isFinite(v2)) continue;
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

  return {
    gate,
    rows: trainRows,
    note: split.note,
    oos,
    purged: { count: split.purged, embargo: split.embargo },
  };
}
