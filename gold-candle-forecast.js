/* =========================================================================
HARDGATE — gold-candle-forecast.js (v14-3)
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
          <h2>Candle Forecast <span id="cfVersion">v14-3</span></h2>
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
      /* v14-2 fetched api.binance.com DIRECTLY, which is CORS- and
         geo-blocked in exactly the environments this desk runs in (the repo
         routes every candle read through the house chain for that reason).
         Prefer the shared gold venue reader, then the house proxy. */
      let candles = null;
      if (typeof window.getXAUCandles === 'function') {
        try {
          const viaVenue = await window.getXAUCandles('15m');
          if (Array.isArray(viaVenue) && viaVenue.length >= 30) candles = viaVenue.slice(-200);
        } catch (e) { /* fall through to the proxy */ }
      }
      if (!candles) {
        const symbol = 'PAXGUSDT'; // gold proxy on Binance
        const upstream = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=200`;
        const response = await fetch('/api/proxy?url=' + encodeURIComponent(upstream));
        if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
        const data = await response.json();
        if (!Array.isArray(data) || data.length < 30) {
          throw new Error('Insufficient market data available for analysis.');
        }
        // normalize to {t, o, h, l, c, v}
        candles = data.map(d => ({
          t: d[0],
          o: parseFloat(d[1]),
          h: parseFloat(d[2]),
          l: parseFloat(d[3]),
          c: parseFloat(d[4]),
          v: parseFloat(d[5])
        }));
      }

      // 3. Execute Predictive Engine (using the global engine from goldind.js)
      if (typeof window.goldCandleForecast !== 'function') {
        throw new Error('Predictive Engine (goldCandleForecast) not loaded. Please refresh.');
      }

      const forecast = window.goldCandleForecast(candles);

      // 4. Handle empty/no-signal results
      if (!forecast || !forecast.dir) {   /* null only: NEUTRAL is a real verdict */
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
    const neutral = (forecast.dir === 'NEUTRAL');
    const dirClass = neutral ? '' : (forecast.dir === 'BULL' ? 'long' : 'short');
    const dirLabel = neutral ? 'NO DIRECTIONAL EDGE' : (forecast.dir === 'BULL' ? 'LONG CANDLE' : 'SHORT CANDLE');
    const color = forecast.dir === 'BULL' ? '#15803d' : '#dc262c';

    container.className = ''; // Remove 'empty' class
    container.innerHTML = `
      <div class="omni-side ${dirClass}" style="margin: 0; border-left-width: 4px;">
        <div class="omni-side-call">${dirLabel} CANDLE FORECAST</div>
        <ul class="lst">
          <li><b>Expected Range:</b> <span style="font-weight:700;">${this.fmt(forecast.expectedLow)} - ${this.fmt(forecast.expectedHigh)}</span></li>
          ${neutral
            ? '<li><b>Levels:</b> none - the drift is indistinguishable from zero, so no TP or SL is projected.</li>'
            : `<li><b>Target 1 (TP1):</b> <span class="pos" style="color:${color}; font-weight:700;">${this.fmt(forecast.tp1)}</span></li>
          <li><b>Target 2 (TP2):</b> <span class="pos" style="color:${color}; font-weight:700;">${this.fmt(forecast.tp2)}</span></li>
          <li><b>Stop Loss (SL):</b> <span class="neg" style="color:${color}; font-weight:700;">${this.fmt(forecast.sl)}</span></li>`}
        </ul>
        <div class="note" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">
          Directional strength: <b>${this.fmt(forecast.strength)}</b> (|t| of the 40-bar drift - a heuristic, NOT a probability).
          Volatility ${this.fmt(forecast.vol)} - projected bar range ${this.fmt(forecast.expectedRange)}.
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
