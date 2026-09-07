/* HARDGATE — Coinalyze aggregated OI merge (pure). */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/** Map USDT perp base (BTCUSDT) → Coinalyze symbols for major venues. */
export function coinalyzeSymbolsForBase(base){
  base = String(base || '').toUpperCase().replace(/USDT$/, '');
  if (!base) return [];
  var sym = base + 'USDT_PERP';
  /* Exchange codes from Coinalyze /exchanges: A=Binance, 6=Bybit, 3=OKX, 2=Deribit, 4=BitMEX */
  return [
    sym + '.A',
    sym + '.6',
    sym + '.3',
    sym + '.2',
    sym + '.4',
  ];
}

/** Sum open-interest rows; binance leg is symbol ending in .A */
export function coinalyzeMergeOI(rows){
  rows = Array.isArray(rows) ? rows : [];
  var agg = 0, bin = null, n = 0;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    var v = fin(r.value != null ? r.value : r.open_interest);
    if (v === null || !(v > 0)) continue;
    agg += v;
    n++;
    var s = String(r.symbol || '');
    if (s.indexOf('_PERP.A') >= 0 || s.endsWith('.A')) bin = v;
  }
  if (!(agg > 0)) return null;
  return { aggOIUsd: agg, binanceOIUsd: bin, venues: n };
}

/** Merge OI history series (array of {t, v}) per venue into aggregated % change. */
export function coinalyzeOIChgPct(histories){
  histories = histories || {};
  var keys = Object.keys(histories);
  if (!keys.length) return null;
  var series = [];
  var tSet = {};
  for (var i = 0; i < keys.length; i++){
    var h = histories[keys[i]];
    if (!Array.isArray(h)) continue;
    for (var j = 0; j < h.length; j++){
      var p = h[j];
      if (!p || !isFinite(p.t) || !isFinite(p.v)) continue;
      tSet[p.t] = true;
    }
  }
  var times = Object.keys(tSet).map(Number).sort(function(a, b){ return a - b; });
  for (var k = 0; k < times.length; k++){
    var t = times[k], sum = 0, c = 0;
    for (var vi = 0; vi < keys.length; vi++){
      var arr = histories[keys[vi]];
      if (!Array.isArray(arr)) continue;
      for (var m = 0; m < arr.length; m++){
        if (arr[m] && arr[m].t === t && isFinite(arr[m].v)){ sum += arr[m].v; c++; }
      }
    }
    if (c > 0) series.push({ t: t, oi: sum });
  }
  if (series.length < 2) return null;
  var first = series[0].oi, last = series[series.length - 1].oi;
  if (!(first > 0)) return null;
  return { chgPct: (last / first - 1) * 100, first: first, last: last, points: series.length };
}

/** Venue rotation read: Binance-only vs aggregated. */
export function coinalyzeVenueDelta(merged){
  if (!merged || !isFinite(merged.aggOIUsd) || !isFinite(merged.binanceOIUsd)) return null;
  if (!(merged.aggOIUsd > 0)) return null;
  var binShare = merged.binanceOIUsd / merged.aggOIUsd;
  return {
    binanceSharePct: binShare * 100,
    note: 'Binance ' + (binShare * 100).toFixed(1) + '% of aggregated OI',
  };
}
