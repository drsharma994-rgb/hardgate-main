/* HARDGATE — CFTC COT managed-money positioning for gold (pure). */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function parseDate(row){
  var d = row.report_date_as_yyyy_mm_dd || row.report_date || row.report_dt || row.date;
  if (!d) return null;
  var t = Date.parse(String(d));
  return isFinite(t) ? t : null;
}

export function goldCotParse(rows){
  var out = [];
  var arr = Array.isArray(rows) ? rows : [];
  for (var i = 0; i < arr.length; i++){
    var r = arr[i];
    if (!r) continue;
    var name = String(r.market_and_exchange_names || r.market_name || r.contract_market_name || '').toUpperCase();
    if (name.indexOf('GOLD') < 0 || name.indexOf('COMEX') < 0 && name.indexOf('GC') < 0 && name.indexOf('GOLD') < 0) continue;
    var specL = fin(r.noncomm_positions_long_all || r.noncomm_positions_long);
    var specS = fin(r.noncomm_positions_short_all || r.noncomm_positions_short);
    var commL = fin(r.comm_positions_long_all || r.comm_positions_long);
    var commS = fin(r.comm_positions_short_all || r.comm_positions_short);
    var oi = fin(r.open_interest_all || r.open_interest);
    if (specL === null || specS === null || oi === null || !(oi > 0)) continue;
    var specNet = specL - specS;
    var commNet = (commL !== null && commS !== null) ? commL - commS : null;
    out.push({
      date: parseDate(r),
      specNet: specNet,
      commNet: commNet,
      oi: oi,
      specNetPctOi: specNet / oi,
    });
  }
  out.sort(function(a, b){ return (b.date || 0) - (a.date || 0); });
  return out;
}

function percentileRank(sorted, val){
  if (!sorted.length) return null;
  var below = 0;
  for (var i = 0; i < sorted.length; i++){
    if (sorted[i] <= val) below++;
  }
  return below / sorted.length;
}

function meanStd(arr){
  if (!arr.length) return { mean: null, std: null };
  var sum = 0;
  for (var i = 0; i < arr.length; i++) sum += arr[i];
  var mean = sum / arr.length;
  var ss = 0;
  for (var j = 0; j < arr.length; j++) ss += (arr[j] - mean) * (arr[j] - mean);
  var std = Math.sqrt(ss / arr.length);
  return { mean: mean, std: std > 0 ? std : null };
}

export function goldCotAssess(series){
  series = Array.isArray(series) ? series : [];
  if (!series.length){
    return { specNetPctOi: null, zScore: null, percentile: null, wow: null, crowding: 'N/A', note: 'no COT rows' };
  }
  var latest = series[0];
  var windowMs = 3 * 365.25 * 86400000;
  var cutoff = (latest.date || Date.now()) - windowMs;
  var hist = [];
  for (var i = 0; i < series.length; i++){
    if ((series[i].date || 0) >= cutoff) hist.push(series[i].specNetPctOi);
  }
  if (hist.length < 8){
    return {
      specNetPctOi: latest.specNetPctOi,
      zScore: null, percentile: null,
      wow: series.length >= 2 ? latest.specNetPctOi - series[1].specNetPctOi : null,
      crowding: 'N/A',
      note: 'thin COT history (' + hist.length + ' weeks)',
      reportDate: latest.date,
    };
  }
  var sorted = hist.slice().sort(function(a, b){ return a - b; });
  var pct = percentileRank(sorted, latest.specNetPctOi);
  var ms = meanStd(hist);
  var z = (ms.std !== null) ? (latest.specNetPctOi - ms.mean) / ms.std : null;
  var wow = series.length >= 2 ? latest.specNetPctOi - series[1].specNetPctOi : null;
  var crowding = 'NEUTRAL';
  if (z !== null && z >= 2) crowding = 'SPEC CROWDED LONG';
  else if (z !== null && z <= -2) crowding = 'SPEC CROWDED SHORT';
  else if (pct !== null && pct >= 0.9) crowding = 'SPEC CROWDED LONG';
  else if (pct !== null && pct <= 0.1) crowding = 'SPEC CROWDED SHORT';
  return {
    specNetPctOi: latest.specNetPctOi,
    zScore: z,
    percentile: pct,
    wow: wow,
    crowding: crowding,
    note: 'CFTC managed money · weekly (Tue as-of, Fri publish)',
    reportDate: latest.date,
  };
}

/** Setup gate from COT z-score extremes — pure, never throws.
    z > +2 → crowded-long veto on new gold longs
    z < −2 → crowded-short bonus for gold longs (contrarian)
    Within 5d of report + |z|≥2 → cotExtreme tag */
export function goldCotGate(assess, dir){
  try{
    assess = assess || {};
    dir = String(dir || '').toLowerCase();
    var z = fin(assess.zScore);
    var out = {
      veto: false, bonus: false, tag: null, note: '',
      zScore: z, crowding: assess.crowding || 'N/A',
    };
    if (z === null){
      out.note = 'COT z-score unavailable — gate unchecked';
      return out;
    }
    if (z > 2 && dir === 'long'){
      out.veto = true;
      out.note = 'COT crowded long (z=' + z.toFixed(2) + ') — reversal risk on new longs';
    } else if (z < -2 && dir === 'long'){
      out.bonus = true;
      out.note = 'COT crowded short (z=' + z.toFixed(2) + ') — contrarian long tailwind';
    } else if (z < -2 && dir === 'short'){
      out.veto = true;
      out.note = 'COT crowded short (z=' + z.toFixed(2) + ') — squeeze risk on new shorts';
    } else if (z > 2 && dir === 'short'){
      out.bonus = true;
      out.note = 'COT crowded long (z=' + z.toFixed(2) + ') — contrarian short tailwind';
    }
    var rd = assess.reportDate;
    if (rd && Math.abs(z) >= 2){
      var ageDays = (Date.now() - rd) / 86400000;
      if (ageDays >= 0 && ageDays <= 5){
        out.tag = 'COT EXTREME';
        out.note += (out.note ? ' · ' : '') + 'within 5d of weekly extreme';
      }
    }
    return out;
  }catch(e){
    return { veto: false, bonus: false, tag: null, note: 'COT gate error', zScore: null, crowding: 'N/A' };
  }
}
