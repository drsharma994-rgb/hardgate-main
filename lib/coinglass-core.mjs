/* HARDGATE — CoinGlass liquidation cluster parsing (pure). */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/** Parse heatmap model3 payload → [{price, notionalUsd}]. */
export function coinglassParseHeatmap(data){
  if (!data) return [];
  var yAxis = data.y_axis || data.yAxis;
  var liq = data.liquidation_leverage_data || data.liquidationLeverageData;
  if (!Array.isArray(yAxis) || !Array.isArray(liq)) return [];
  var buckets = {};
  for (var i = 0; i < liq.length; i++){
    var row = liq[i];
    if (!Array.isArray(row) || row.length < 3) continue;
    var yIdx = +row[1], usd = fin(row[2]);
    if (!isFinite(yIdx) || usd === null || !(usd > 0)) continue;
    var px = fin(yAxis[yIdx]);
    if (px === null) continue;
    var key = px.toFixed(2);
    buckets[key] = (buckets[key] || 0) + usd;
  }
  var out = [];
  for (var k in buckets){
    if (!Object.prototype.hasOwnProperty.call(buckets, k)) continue;
    out.push({ price: +k, notionalUsd: buckets[k] });
  }
  out.sort(function(a, b){ return b.notionalUsd - a.notionalUsd; });
  return out;
}

/** Parse aggregated-map payload. */
export function coinglassParseMap(data){
  var root = data && data.data ? data.data : data;
  if (!root) return [];
  var inner = root.data || root;
  var out = [];
  for (var pxKey in inner){
    if (!Object.prototype.hasOwnProperty.call(inner, pxKey)) continue;
    var px = fin(pxKey);
    var rows = inner[pxKey];
    if (px === null || !Array.isArray(rows)) continue;
    var usd = 0;
    for (var i = 0; i < rows.length; i++){
      var r = rows[i];
      if (Array.isArray(r) && r.length >= 2) usd += fin(r[1]) || 0;
    }
    if (usd > 0) out.push({ price: px, notionalUsd: usd });
  }
  out.sort(function(a, b){ return b.notionalUsd - a.notionalUsd; });
  return out;
}

export function coinglassClusterAt(clusters, price, tolerancePct){
  price = fin(price);
  tolerancePct = fin(tolerancePct);
  if (price === null || !Array.isArray(clusters)) return null;
  var tol = (tolerancePct !== null && tolerancePct > 0) ? tolerancePct / 100 : 0.002;
  for (var i = 0; i < clusters.length; i++){
    var c = clusters[i];
    if (!c || !isFinite(c.price)) continue;
    if (Math.abs(c.price - price) / price <= tol) return c;
  }
  return null;
}

export function coinglassStopWarning(clusters, stop, minNotionalUsd){
  var c = coinglassClusterAt(clusters, stop, 0.15);
  minNotionalUsd = fin(minNotionalUsd) || 500000;
  if (!c || !(c.notionalUsd >= minNotionalUsd)) return null;
  return {
    warn: true,
    cluster: c,
    note: 'stop inside $' + (c.notionalUsd / 1e6).toFixed(2) + 'M liq cluster @ ' + c.price,
  };
}

export function coinglassConfluenceTag(clusters, level, minNotionalUsd){
  var c = coinglassClusterAt(clusters, level, 0.2);
  minNotionalUsd = fin(minNotionalUsd) || 1000000;
  if (!c || !(c.notionalUsd >= minNotionalUsd)) return null;
  return 'LIQ CLUSTER $' + (c.notionalUsd / 1e6).toFixed(1) + 'M';
}
