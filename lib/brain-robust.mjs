/* Node/daemon mirror of brainrobust.js eligibility checks (row shape from __hgBrainLast). */

export function brainLiveEligibleRow(row){
  var reasons = [];
  if (!row) return { ok: false, reasons: ['no row'] };
  if (row.tier !== 'PRIME') reasons.push('need PRIME tier');
  if (!(row.dir === 'long' || row.dir === 'short')) reasons.push('no direction');
  var p = row.plan;
  if (!p || !isFinite(p.entry) || !isFinite(p.stop) || !isFinite(p.t1)){
    reasons.push('plan incomplete');
  }
  if (row.liveOk === false && Array.isArray(row.liveReasons) && row.liveReasons.length){
    reasons = reasons.concat(row.liveReasons);
  }
  if (row.liveOk === true && reasons.length === 0) return { ok: true, reasons: [] };
  return { ok: reasons.length === 0, reasons: reasons };
}

export function filterDaemonBrainRows(rows, opts){
  opts = opts || {};
  var liveOnly = !!opts.liveMode;
  var tiers = opts.tiers || ['PRIME', 'HIGH'];
  var out = [];
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var row = rows[i];
    if (!row || !row.plan || !row.dir) continue;
    if (tiers.indexOf(row.tier) < 0) continue;
    var p = row.plan;
    if (!isFinite(p.entry) || !isFinite(p.stop) || !isFinite(p.t1)) continue;
    if (Math.abs(p.entry - p.stop) <= 0) continue;
    if (liveOnly){
      if (row.tier !== 'PRIME') continue;
      if (row.liveOk === false) continue;
      var el = brainLiveEligibleRow(row);
      if (!el.ok) continue;
    }
    out.push(row);
  }
  return out;
}
