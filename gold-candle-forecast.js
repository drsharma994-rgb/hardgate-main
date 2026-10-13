/* =========================================================================
HARDGATE — gold-candle-forecast.js (v14-3)
Predictive Candle Forecasting Module. Uses ATR and momentum to forecast
the next candle's range, direction, TP, and SL.

v14-3 fixes two defects that kept the tab painting "Waiting for data..."
on every page load since v14-2:

  (1) Registration pattern. v14-2 wrote `window.HG_TAB_MODS[mod.id] = mod`.
      That writes to the GLOBAL `window.HG_TAB_MODS`, not the lexically-
      scoped `const HG_TAB_MODS = {}` at the top of index.html's shell
      script (line 11004) that `showTab()` reads. A `const` declared at
      script scope is a LEXICAL binding, not a window property, so the two
      objects are different, and showTab's `const mod = HG_TAB_MODS[id]`
      found nothing. We now push onto `window.HG_tabs` — the array
      `bootHgTabs` iterates — and it copies into the shell's const + auto-
      creates both the nav button and the tab pane in one place.

  (2) Script load order. v14-2 placed the script at the body bottom
      (line 11188). `bootHgTabs` is an IIFE at line 11006; it runs
      synchronously and only sees modules whose push already landed. A
      script loading at the body bottom pushes AFTER that iteration, so
      the auto-wire never happened. We also deliberately removed the
      duplicate inlined script tag at the body bottom — the import at
      the top of the body (beside book.js) is the one home.
========================================================================= */
(function() {
  'use strict';

  /**
   * @module GoldCandleForecast
   * Provides predictive analysis for the next candle based on volatility (ATR)
   * and momentum-based price action patterns.
   */
  var __cfMounted = false;   /* the pane this module has already painted */
  var __cfPane = null;

  const mod = {
    id: 'candle-forecast',
    label: 'CANDLE FORECAST',
    mount: function(container) {
      if (!container) return;
        /* Double-mount guard, on MODULE STATE rather than a DOM query.
           could never match what it was guarding. A real selector does not fix
           it either: a shell whose querySelector is a permissive stub answers
           EVERY selector truthy, so any such guard fires on the FIRST mount and
           the tab renders nothing - that is the "blank: candle-forecast"
           failure. State answers the actual question, and is consulted only
           after the container guard, so it can never be why nothing renders. */
        if (__cfMounted) return;
        __cfMounted = true;
        __cfPane = container;

      container.innerHTML = `
        <div class="panel">
          <h2>Candle Forecast <span id="cfVersion"></span></h2>
          <div class="row" style="margin-bottom: 16px;">
            <button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>
            <span class="note" id="cfStatus" style="margin-left: 8px; font-weight:700;">Ready</span>
          </div>
          <div id="cfResultArea" class="empty">
            No forecast yet. A setup prints only when a candlestick pattern and a structure read agree. Structure is a break of structure, a change of character, a fair-value gap, an order block that holds, or equal highs or lows raided. The stop is still the pattern extreme when that sits between 0.25 and 2.5 ATR, otherwise one ATR.
          </div>
        </div>
      `;

      document.getElementById('cfRunBtn').addEventListener('click', () => this.runForecast());
      var verEl = container.querySelector('#cfVersion');
      var ver = (window.HG_BUILD && window.HG_BUILD.version) || '';
      if (verEl && ver) verEl.textContent = ver;
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
    resultArea.innerHTML = 'Reading the gold 15m tape...';

    try {
      const loaded = await this.loadGold15m();
      const candles = loaded && loaded.rows;
      if (!Array.isArray(candles) || candles.length < 20) {
        throw new Error('Gold 15m tape unread. No prices were invented.');
      }

      if (typeof window.goldCandleForecast !== 'function') {
        throw new Error('Predictive Engine (goldCandleForecast) not loaded. Please refresh.');
      }

      const forecast = window.goldCandleForecast(candles);
      if (!forecast) {
        resultArea.innerHTML = 'The candle read failed closed. Nothing was invented.';
        statusEl.textContent = 'Unread';
        return;
      }
      forecast.source = loaded.source || '';
      this.renderResult(resultArea, statusEl, forecast);

    } catch (error) {
      console.error('[CandleForecast] Error:', error);
      resultArea.innerHTML = '<span class="note warn">Error: ' + String(error && error.message || error) + '</span>';
      statusEl.textContent = 'Failed';
    }
  };

  mod.loadGold15m = async function() {
    var pack = null;
    if (typeof window.getGoldCandles === 'function') {
      try { pack = await window.getGoldCandles('15m', 80); } catch (e) { pack = null; }
    }
    var rows = pack && pack.rows;
    if (rows && rows.length >= 20) return { rows: rows, source: pack.source || 'gold tape' };
    if (typeof window.binanceKlines === 'function') {
      try {
        var xau = await window.binanceKlines('XAUUSDT', '15m', 80);
        if (xau && xau.length >= 20) return { rows: xau, source: 'BINANCE XAUUSDT' };
      } catch (e2) {}
      try {
        var paxg = await window.binanceKlines('PAXGUSDT', '15m', 80);
        if (paxg && paxg.length >= 20) {
          /* hg-v1310: a DIRECT PAXG fallback leaves the shared macro chain, so it
             is anchored here through the one home (gold-iux.js), exactly as
             getGoldCandles and goldscalp.js anchor their own packs — PAXG is a
             token, not the metal, and a forecast built on its unanchored level
             would disagree with every other gold desk. Module absent or anchor
             unreadable: the feed's own bars (fail open). */
          try {
            var iuxFn = (typeof window.hgGoldIuxApplyRows === 'function') ? window.hgGoldIuxApplyRows : null;
            if (iuxFn) {
              var anchored = await iuxFn(paxg, 'binance-paxg');
              if (anchored && anchored.length) return { rows: anchored, source: 'BINANCE PAXGUSDT · IUX anchored' };
            }
          } catch (eIx) {}
          return { rows: paxg, source: 'BINANCE PAXGUSDT' };
        }
      } catch (e3) {}
    }
    return { rows: [], source: '' };
  };

  /**
   * One unopposed read is the call. Stop and targets are one and two ATR
   * from the last close. A fight between reads prints no side.
   */
  mod.renderResult = function(container, statusEl, forecast) {
    var lean = forecast.lean || (forecast.dir ? forecast.dir : 'unread');
    var called = lean === 'BULL' || lean === 'BEAR';
    var dirClass = lean === 'BULL' ? 'long' : (lean === 'BEAR' ? 'short' : '');
    var dirLabel = forecast.setup ? forecast.setup : (lean === 'BULL' ? 'LONG' : (lean === 'BEAR' ? 'SHORT' : 'NEUTRAL'));
    var reasons = (forecast.reasons || []).map(function(r) {
      return '<li>' + String(r).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>';
    }).join('');
    var patLine = (forecast.patterns && forecast.patterns.length)
      ? forecast.patterns.join(', ')
      : 'none';
    var setupLine = forecast.setup ? (forecast.setup + ' — ' + (forecast.setupParts || '')) : 'not formed';
    var levels = '<li><b>Setup:</b> ' + setupLine.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>'
      + '<li><b>Patterns:</b> ' + patLine.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>'
      + (called
        ? '<li><b>Stop:</b> <span class="neg" style="font-weight:700;">' + this.fmt(forecast.sl) + '</span> <span class="note">(' + (forecast.stopSource === 'pattern' ? 'pattern extreme' : 'one ATR') + ')</span></li>'
          + '<li><b>TP1:</b> <span class="pos" style="font-weight:700;">' + this.fmt(forecast.tp1) + '</span></li>'
          + '<li><b>TP2:</b> <span class="pos" style="font-weight:700;">' + this.fmt(forecast.tp2) + '</span></li>'
        : '<li><b>Stop:</b> none — no side</li>');

    container.className = '';
    container.innerHTML = `
      <div class="omni-side ${dirClass}" style="margin: 0; border-left-width: 4px;">
        <div class="omni-side-call">${dirLabel}</div>
        <ul class="lst">
          <li><b>Last close:</b> <span style="font-weight:700;">${this.fmt(forecast.close)}</span></li>
          ${levels}
          <li><b>Reads:</b> ${forecast.agrees} for the call, ${forecast.against} against, of ${forecast.checked}</li>
          ${forecast.source ? '<li><b>Tape:</b> ' + String(forecast.source).replace(/</g, '') + '</li>' : ''}
        </ul>
        <ul class="lst">${reasons}</ul>
        <div class="note" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">
          ${forecast.note || ''}
        </div>
      </div>
    `;
    statusEl.textContent = called ? dirLabel : 'NEUTRAL';
  };

  mod.fmt = function(n) { return Number(n).toFixed(2); };

  // v14-3: register through window.HG_tabs, the array bootHgTabs iterates.
  // Writing to window.HG_TAB_MODS directly misses the shell's lexical const
  // of the same name (see header above) and skips the auto-wiring that
  // creates the nav button + pane.
  if (typeof window !== 'undefined') {
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push(mod);
    // Defensive write: if a page has already run bootHgTabs and seeded the
    // registry object onto window (shell dev builds do this), carry the
    // module there too so a late-loaded tab can still mount on click.
    if (window.HG_TAB_MODS && typeof window.HG_TAB_MODS === 'object') {
      window.HG_TAB_MODS[mod.id] = mod;
    }
  }
})();
