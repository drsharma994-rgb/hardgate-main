/* HARDGATE — sample uniqueness / concurrent label weighting (AFML ch.4). Pure. */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/** @param {Array<{tStart:number,tEnd:number}>} events */
export function hgConcurrency(events){
  var arr = Array.isArray(events) ? events : [];
  var points = {};
  for (var i = 0; i < arr.length; i++){
    var e = arr[i];
    if (!e) continue;
    var a = fin(e.tStart), b = fin(e.tEnd);
    if (a === null || b === null) continue;
    if (b < a){ var tmp = a; a = b; b = tmp; }
    points[a] = (points[a] || 0) + 1;
    points[b + 1] = (points[b + 1] || 0) - 1;
  }
  var keys = Object.keys(points).map(Number).sort(function(x, y){ return x - y; });
  var out = {}, cur = 0;
  for (var k = 0; k < keys.length; k++){
    cur += points[keys[k]];
    if (cur > 0) out[keys[k]] = cur;
  }
  return out;
}

function countAt(concMap, tStart, tEnd){
  var keys = Object.keys(concMap).map(Number).sort(function(x, y){ return x - y; });
  var sum = 0, n = 0;
  for (var i = 0; i < keys.length; i++){
    var t = keys[i];
    if (t < tStart) continue;
    if (t > tEnd) break;
    var c = concMap[t];
    if (c > 0){ sum += 1 / c; n++; }
  }
  if (!n){
    var c0 = concMap[tStart];
    return (c0 > 0) ? 1 / c0 : 1;
  }
  return sum / n;
}

/** @returns {Array<{index:number, uniqueness:number}>} */
export function hgAvgUniqueness(events){
  var arr = Array.isArray(events) ? events : [];
  var conc = hgConcurrency(arr);
  var out = [];
  for (var i = 0; i < arr.length; i++){
    var e = arr[i];
    if (!e) continue;
    var a = fin(e.tStart), b = fin(e.tEnd);
    if (a === null || b === null) continue;
    if (b < a){ var tmp = a; a = b; b = tmp; }
    out.push({ index: i, uniqueness: countAt(conc, a, b) });
  }
  return out;
}

export function hgEffectiveN(events){
  var u = hgAvgUniqueness(events);
  var sum = 0;
  for (var i = 0; i < u.length; i++) sum += u[i].uniqueness;
  return sum;
}

/** Build label windows from scorecard ledger records. */
export function hgEventsFromRecords(records){
  var out = [];
  var arr = Array.isArray(records) ? records : [];
  for (var i = 0; i < arr.length; i++){
    var r = arr[i];
    if (!r || r.status !== 'settled') continue;
    var tStart = fin(r.at);
    if (tStart === null) continue;
    var tEnd = fin(r.closedAt);
    if (tEnd !== null && tEnd < 1e12) tEnd *= 1000;
    if (tEnd === null) tEnd = fin(r.settledAt);
    if (tEnd === null){
      var bars = fin(r.bars);
      tEnd = tStart + ((bars !== null && bars > 0) ? bars : 24) * 3600000;
    }
    if (tEnd < tStart) tEnd = tStart + 3600000;
    out.push({ tStart: tStart, tEnd: tEnd, index: i, sym: r.sym });
  }
  return out;
}

export function hgRecordEffectiveN(records){
  var events = hgEventsFromRecords(records);
  var raw = events.length;
  var eff = hgEffectiveN(events);
  return { raw: raw, effectiveN: eff, events: events };
}
