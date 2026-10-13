/* =========================================================================
HARDGATE — gold-candle-forecast.js (v14-2)
Predictive Candle Forecasting Module. Uses ATR and momentum to forecast 
the next candle's range, direction, TP, and SL.
========================================================================= */
(function() {
  'use strict';

  /**
   * @module GoldCandleForecast
   * Provides predictive analysis for the next candle based on volatility (ATR)
   * and momentum-based price action patterns.
   */
  const mod = {
    id: 'candle-forecast',
    label: 'CANDLE FORECAST',
    mount: function(container) {
      if (!container) return;
      // Prevent double mounting
      if (container.querySelector('.cf-controls')) return;

      container.innerHTML = `
        <div class="panel">
          <h2>Candle Forecast <span id="cfVersion">v14-2</span></h2>
          <div class="row" style="margin-bottom: 16px;">
            <button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>
            <span class="note" id="cfStatus" style="margin-left: 8px; font-weight:700;">Ready</span>
          </div>
          <div id="cfResultArea" class="empty">
            No forecast available. Click SCAN to analyze the current market structure and predict the next candle's range, direction, TP, and SL.
          </div>
        </div>
      `;

      document.getElementById('cfRunBtn').addEventListener('click', () => this.runForecast());
    },
    refresh: async function() {
      await this.runForecast();
    }
  };

  /**
   * Main execution flow for the forecast engine.
   */
  mod.runForecast = async function() {
    const statusEl = document.getElementById('cfStatus');
    const resultArea = document.getElementById('cfResultArea');

    if (!statusEl || !resultArea) return;

    // UI Reset
    statusEl.textContent = 'Analyzing...';
    resultArea.className = 'empty';
    resultArea.innerHTML = 'Fetching market data and running predictive engine...';

    try {
      // 1. Fetch historical klines (last 50 candles) for volatility/momentum analysis
      const symbol = 'PAXGUSDT'; // Default gold proxy on Binance
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=50`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
      
      const data = await response.json();
      if (!Array.isArray(data) || data.length < 20) {
        throw new Error('Insufficient market data available for analysis.');
      }

      // 2. Normalize data into standard candle format: {t, o, h, l, c, v}
      const candles = data.map(d => ({
        t: d[0],
        o: parseFloat(d[1]),
        h: parseFloat(d[2]),
        l: parseFloat(d[3]),
        c: parseFloat(d[4]),
        v: parseFloat(d[5])
      }));

      // 3. Execute Predictive Engine (using the global engine from goldind.js)
      if (typeof window.goldCandleForecast !== 'function') {
        throw new Error('Predictive Engine (goldCandleForecast) not loaded. Please refresh.');
      }

      const forecast = window.goldCandleForecast(candles);

      // 4. Handle empty/no-signal results
      if (!forecast || !forecast.dir) {
        resultArea.innerHTML = 'No clear signal detected by predictive engine. Try again in a few minutes.';
        statusEl.textContent = 'Ready';
        return;
      }

      // 5. Render the forecast card
      this.renderResult(resultArea, statusEl, forecast);

    } catch (error) {
      console.error('[CandleForecast] Error:', error);
      resultArea.innerHTML = `<span class="note warn">Error: ${error.message}. Ensure you are connected and the symbol is available on Binance.</span>`;
      statusEl.textContent = 'Failed';
    }
  };

  /**
   * Renders the forecast results into the UI.
   */
  mod.renderResult = function(container, statusEl, forecast) {
    const dirClass = forecast.dir === 'BULL' ? 'long' : 'short';
    const dirLabel = forecast.dir === 'BULL' ? 'LONG CANDLE' : 'SHORT CANDLE';
    const color = forecast.dir === 'BULL' ? '#15803d' : '#dc262c';

    container.className = ''; // Remove 'empty' class
    container.innerHTML = `
      <div class="omni-side ${dirClass}" style="margin: 0; border-left-width: 4px;">
        <div class="omni-side-call">${dirLabel} CANDLE FORECAST</div>
        <ul class="lst">
          <li><b>Expected Range:</b> <span style="font-weight:700;">${this.fmt(forecast.expectedLow)} - ${this.fmt(forecast.expectedHigh)}</span></li>
          <li><b>Target 1 (TP1):</b> <span class="pos" style="color:${color}; font-weight:700;">${this.fmt(forecast.tp1)}</span></li>
          <li><b>Target 2 (TP2):</b> <span class="pos" style="color:${color}; font-weight:700;">${this.fmt(forecast.tp2)}</span></li>
          <li><b>Stop Loss (SL):</b> <span class="neg" style="color:${color}; font-weight:700;">${this.fmt(forecast.sl)}</span></li>
        </ul>
        <div class="note" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">
          Confidence Score: ${Math.round(forecast.confidence * 100)}%
        </div>
      </div>
    `;
    statusEl.textContent = 'Done';
  };

  mod.fmt = function(n) { return Number(n).toFixed(2); };

  // Register the module with the global registry
  if (typeof window !== 'undefined') {
    window.HG_TAB_MODS = window.HG_TAB_MODS || {};
    window.HG_TAB_MODS[mod.id] = mod;
  }
})();
