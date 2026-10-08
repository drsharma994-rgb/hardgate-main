/**
 * HARDGATE Pine Gold Library
 * Session-anchored VWAP (00:00, 07:00, 12:30 UTC) and a $3 institutional FVG.
 */
(function (root) {
  'use strict';
  function PineGoldEngine(){}
  function rowsOf(klines){ return root.hgGoldBars ? root.hgGoldBars(klines) : []; }
  PineGoldEngine.prototype.calculateSessionAvwap = function(klines){
    var rows = rowsOf(klines);
    var cumVol = 0, cumPx = 0, last = null, out = [], i, k, d, timeVal, session, tp, vol;
    for (i = 0; i < rows.length; i++){
      k = rows[i];
      d = new Date(k.time);
      timeVal = d.getUTCHours() + d.getUTCMinutes() / 60;
      session = 'ASIA';
      if (timeVal >= 7.0 && timeVal < 12.5) session = 'LONDON';
      else if (timeVal >= 12.5 && timeVal < 20.0) session = 'NY';
      else if (timeVal >= 20.0) session = 'OFF';
      if (session !== last){ cumVol = 0; cumPx = 0; last = session; }
      tp = (k.high + k.low + k.close) / 3;
      vol = k.volume > 0 ? k.volume : 1;
      cumVol += vol;
      cumPx += tp * vol;
      out.push({ time: k.time, session: session, avwap: +(cumPx / cumVol).toFixed(2) });
    }
    return out;
  };
  PineGoldEngine.prototype.detectGoldFvg = function(klines, minDollarGap){
    if (minDollarGap == null) minDollarGap = 3.00;
    var rows = rowsOf(klines), fvgs = [], i, c0, c1, c2, fvg, j, k;
    if (rows.length < 3) return fvgs;
    for (i = 2; i < rows.length; i++){
      c0 = rows[i - 2]; c1 = rows[i - 1]; c2 = rows[i];
      if (c2.low - c0.high >= minDollarGap && c1.close > c1.open){
        fvgs.push({ type: 'BULLISH_FVG', top: c2.low, bottom: c0.high, sizeDollars: +(c2.low - c0.high).toFixed(2), barIndex: i - 1, time: c1.time, mitigated: false });
      }
      if (c0.low - c2.high >= minDollarGap && c1.close < c1.open){
        fvgs.push({ type: 'BEARISH_FVG', top: c0.low, bottom: c2.high, sizeDollars: +(c0.low - c2.high).toFixed(2), barIndex: i - 1, time: c1.time, mitigated: false });
      }
    }
    for (i = 0; i < fvgs.length; i++){
      fvg = fvgs[i];
      for (j = fvg.barIndex + 2; j < rows.length; j++){
        k = rows[j];
        if (fvg.type === 'BULLISH_FVG' && k.low <= fvg.top){ fvg.mitigated = true; break; }
        if (fvg.type === 'BEARISH_FVG' && k.high >= fvg.bottom){ fvg.mitigated = true; break; }
      }
    }
    return fvgs;
  };
  root.HG_PineGoldEngine = PineGoldEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
