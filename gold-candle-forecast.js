/* =========================================================================
HARDGATE — gold-candle-forecast.js (v14-1)
Predictive Candle Forecasting Module. Uses ATR and momentum to forecast 
the next candle's range, direction, TP, and SL.
========================================================================= */
(function(){
  'use strict';

  var mod = {
    id: 'candle-forecast',
    label: 'CANDLE FORECAST',
    mount: function(container) {
      if (container.querySelector('.cf-controls')) return;
      const html = `
        <div class="panel">
          <h2>Candle Forecast <span id="cfVersion">v14-1</span></h2>
          <div class="row" style="margin-bottom: 16px;">
            <button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>
            <span class="note" id="cfStatus" style="margin-left: 8px; font-weight:700;">Ready</span>
          </div>
          <div id="cfResultArea" class="empty">No forecast available. Click SCAN to analyze the current market structure and predict the next candle's range, direction, TP, and SL.</div>
        </div>
      `;
      container.innerHTML = html;
      document.getElementById('cfRunBtn').addEventListener('click', runForecast);
    },
    refresh: async function() {
       runForecast();
    }
  };

  async function runForecast() {
    const status = document.getElementById('cfStatus');
    const resultArea = document.getElementById('cfResultArea');
    status.textContent = 'Analyzing...';
    resultArea.className = 'empty';
    resultArea.innerHTML = 'Fetching market data and running predictive engine...';

    try {
      // 1. Fetch candles (using Binance for PAXGUSDT as a reliable gold proxy)
      const url = 'https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=15m&limit=50';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch market data from Binance.');
      const rawData = await res.json();
      if (!Array.isArray(rawData)) throw new Error('Invalid data format received.');

      // 2. Normalize rows: {t:<unix seconds>, o,h,l,c,v}
      const rows = rawData.map(r => ({
        t: r[0],
        o: parseFloat(r[1]),
        h: parseFloat(r[2]),
        l: parseFloat(r[3]),
        c: parseFloat(r[4]),
        v: parseFloat(r[5])
      }));

      // 3. Call the engine (defined in goldind.js)
      if (typeof window.goldCandleForecast !== 'function') {
          throw new Error('Predictive Engine (goldCandleForecast) not loaded. Please refresh.');
      }
      const forecast = window.goldCandleForecast(rows);

      // 4. Render result
      if (!forecast || !forecast.dir) {
        resultArea.innerHTML = 'No clear signal detected by predictive engine. Try again in a few minutes.';
        status.textContent = 'Ready';
        return;
      }

      const dirClass = forecast.dir === 'BULL' ? 'long' : 'short';
      const dirLabel = forecast.dir === 'BULL' ? 'LONG CANDLE' : 'SHORT CANDLE';
      const color = forecast.dir === 'BULL' ? '#15803d' : '#dc2626';

      resultArea.className = ''; // remove empty class
      resultArea.innerHTML = `
        <div class="omni-side ${dirClass}" style="margin: 0; border-left-width: 4px;">
          <div class="omni-side-call">${dirLabel} CANDLE FORECAST</div>
          <ul class="lst">
            <li><b>Expected Range:</b> <span style="font-weight:700;">${fmtF(forecast.expectedLow)} - ${fmtF(forecast.expectedHigh)}</span></li>
            <li><b>Target 1 (TP1):</b> <span class="pos" style="color:${color}; font-weight:700;">${fmtF(forecast.tp1)}</span></li>
            <li><b>Target 2 (TP2):</b> <span class="pos" style="color:${color}; font-weight:700;">${fmtF(forecast.tp2)}</span></li>
            <li><b>Stop Loss (SL):</b> <span class="neg" style="color:${color}; font-weight:700;">${fmtF(forecast.sl)}</span></li>
          </ul>
          <div class="note" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">Confidence Score: ${Math.round(forecast.confidence * 100)}%</div>
        </div>
      `;
      status.textContent = 'Done';

    } catch (e) {
      console.error('Forecast error:', e);
      resultArea.innerHTML = '<span class="note warn">Error: ' + e.message + '. Ensure you are connected and the symbol is available on Binance.</span>';
      status.textContent = 'Failed';
    }
  }

  function fmtF(n) { return Number(n).toFixed(2); }

  if (typeof window !== 'undefined') {
    window.HG_TAB_MODS = window.HG_TAB_MODS || {};
    window.HG_TAB_MODS[mod.id] = mod;
  }
})();
