/* HARDGATE — Fed net liquidity composite (pure). WALCL − WTREGEN − RRPONTSYD×1000. */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/** Normalize FRED observations to [{dateMs, value}] ascending. */
export function fedLiquidityParseObs(obs){
  var out = [];
  var arr = Array.isArray(obs) ? obs : [];
  for (var i = 0; i < arr.length; i++){
    var o = arr[i];
    if (!o) continue;
    var v = fin(o.value);
    var t = Date.parse(String(o.date || ''));
    if (v === null || !isFinite(t)) continue;
    out.push({ dateMs: t, value: v });
  }
  out.sort(function(a, b){ return a.dateMs - b.dateMs; });
  return out;
}

/** Build aligned weekly net liquidity from three FRED series payloads. */
export function fedLiquidityCompose(walclObs, tgaObs, rrpObs){
  var walcl = fedLiquidityParseObs(walclObs);
  var tga = fedLiquidityParseObs(tgaObs);
  var rrp = fedLiquidityParseObs(rrpObs);
  if (!walcl.length) return null;

  function nearest(series, t){
    var best = null, bestD = Infinity;
    for (var i = 0; i < series.length; i++){
      var d = Math.abs(series[i].dateMs - t);
      if (d < bestD){ bestD = d; best = series[i]; }
    }
    return (bestD <= 8 * 86400000) ? best : null;
  }

  var points = [];
  for (var j = 0; j < walcl.length; j++){
    var w = walcl[j];
    var tg = nearest(tga, w.dateMs);
    var rp = nearest(rrp, w.dateMs);
    if (!tg || !rp) continue;
    var rrpM = rp.value * 1000; /* billions → millions */
    var net = w.value - tg.value - rrpM;
    points.push({
      dateMs: w.dateMs,
      walclM: w.value,
      tgaM: tg.value,
      rrpB: rp.value,
      netLiquidityM: net,
    });
  }
  if (!points.length) return null;
  return points;
}

/** Score Fed liquidity week-over-week for REGIME gauge. */
export function fedLiquidityAssess(points){
  points = Array.isArray(points) ? points : [];
  if (points.length < 2){
    return { score: 0, stamp: 'NA', detail: 'insufficient Fed liquidity history', wowPct: null, netM: null };
  }
  var last = points[points.length - 1];
  var prev = points[points.length - 2];
  var net = fin(last.netLiquidityM);
  var prevNet = fin(prev.netLiquidityM);
  if (net === null || prevNet === null || !(Math.abs(prevNet) > 0)){
    return { score: 0, stamp: 'NA', detail: 'Fed liquidity data unavailable', wowPct: null, netM: net };
  }
  var wow = net - prevNet;
  var wowPct = (wow / Math.abs(prevNet)) * 100;
  var walclWow = fin(last.walclM) - fin(prev.walclM);
  var tgaWow = fin(last.tgaM) - fin(prev.tgaM);
  var rrpWow = fin(last.rrpB) - fin(prev.rrpB);
  var detail = 'net liq ' + (net / 1e6).toFixed(2) + 'T · WoW ' + (wow >= 0 ? '+' : '') + (wow / 1e3).toFixed(1) + 'B'
    + ' (' + (wowPct >= 0 ? '+' : '') + wowPct.toFixed(2) + '%)'
    + ' · BS ' + (walclWow >= 0 ? '+' : '') + (walclWow / 1e3).toFixed(1) + 'B'
    + ' · TGA ' + (tgaWow >= 0 ? '+' : '') + (tgaWow / 1e3).toFixed(1) + 'B'
    + ' · RRP ' + (rrpWow >= 0 ? '+' : '') + rrpWow.toFixed(1) + 'B';
  var score = 0, stamp = 'NA';
  if (wowPct > 0.15){ score = 1; stamp = 'BULL'; }
  else if (wowPct < -0.15){ score = -1; stamp = 'BEAR'; }
  return { score: score, stamp: stamp, detail: detail, wowPct: wowPct, netM: net, wowM: wow };
}
