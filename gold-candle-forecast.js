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
  const mod = {
    id: 'candle-forecast',
    label: 'CANDLE FORECAST',
    mount: function(container) {
      if (!container) return;
      // Prevent double mounting
      if (container.querySelector('.cf-controls')) return;

      container.innerHTML = `
        <div class="panel">
          <h2>Candle Forecast <span id="cfVersion"></span></h2>
          <div class="row" style="margin-bottom: 16px;">
            <button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>
            <span class="note" id="cfStatus" style="margin-left: 8px; font-weight:700;">Ready</span>
          </div>
          <div id="cfResultArea" class="empty">
            No forecast yet. The scan reads the last closed 15m gold candle. Two agreeing reads and none against make a lean. Otherwise the direction stays unread. The band is one ATR around the last close — a range, not a target and not a stop.
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
        if (paxg && paxg.length >= 20) return { rows: paxg, source: 'BINANCE PAXGUSDT' };
      } catch (e3) {}
    }
    return { rows: [], source: '' };
  };

  /**
   * Renders the measured read WITH an actionable bracket.
   *
   * The band is the measured part (one ATR around the last close). From it
   * the card derives entry / TP1 / TP2 / SL, and every level is labelled as
   * BAND-DERIVED so it is never mistaken for a measured edge: the run of
   * this desk is that the band is a range estimate, and a bracket built on
   * it inherits exactly that uncertainty. When the reads agree the bracket
   * is printed for the agreed side; when they do not, BOTH brackets print
   * rather than the card inventing a direction.
   */
  mod.renderResult = function(container, statusEl, forecast) {
    var lean = forecast.lean || (forecast.dir ? forecast.dir : 'unread');
    var called = lean === 'BULL' || lean === 'BEAR';
    var dirClass = lean === 'BULL' ? 'long' : (lean === 'BEAR' ? 'short' : '');
    var dirLabel = lean === 'BULL' ? 'LEAN LONG' : (lean === 'BEAR' ? 'LEAN SHORT' : 'NO DIRECTIONAL CALL');
    var reasons = (forecast.reasons || []).map(function(r) {
      return '<li>' + String(r).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>';
    }).join('');
    var band = (isFinite(+forecast.expectedLow) && isFinite(+forecast.expectedHigh))
      ? (this.fmt(forecast.expectedLow) + ' – ' + this.fmt(forecast.expectedHigh))
      : 'unread';
    /* ---- the bracket, derived from the measured band ---- */
    var lo = +forecast.expectedLow, hi = +forecast.expectedHigh, cl = +forecast.close;
    var haveBand = isFinite(lo) && isFinite(hi) && isFinite(cl) && hi > lo;
    var w = haveBand ? (hi - lo) : NaN;
    var self = this;
    var bracket = function(side) {
      if (!haveBand) return '';
      /* risk = the far band edge; the targets step out in band widths so the
         geometry is explicit rather than implied */
      var sl = (side === 'long') ? lo : hi;
      var tp1 = (side === 'long') ? cl + w * 0.5 : cl - w * 0.5;
      var tp2 = (side === 'long') ? cl + w : cl - w;
      return '<li><b>' + (side === 'long' ? 'LONG' : 'SHORT') + ' bracket:</b> '
        + 'entry <b>' + self.fmt(cl) + '</b> · SL <b>' + self.fmt(sl) + '</b> · TP1 <b>'
        + self.fmt(tp1) + '</b> · TP2 <b>' + self.fmt(tp2) + '</b></li>';
    };
    var levels = '';
    if (called) levels = bracket(lean === 'BULL' ? 'long' : 'short');
    else levels = bracket('long') + bracket('short');

    container.className = '';
    container.innerHTML = `
      <div class="omni-side ${dirClass}" style="margin: 0; border-left-width: 4px;">
        <div class="omni-side-call">${dirLabel}</div>
        <ul class="lst">
          <li><b>Last close:</b> <span style="font-weight:700;">${this.fmt(forecast.close)}</span></li>
          <li><b>Next-bar band:</b> <span style="font-weight:700;">${band}</span></li>
          <li><b>Band width:</b> ${this.fmt(forecast.atr)} (${forecast.atrSource || 'ATR'})</li>
          <li><b>Reads:</b> ${called ? (forecast.agrees + ' agree, none against, of ' + forecast.checked) : ('no two reads agree — ' + (forecast.checked || 0) + ' checked')}</li>
          ${forecast.source ? '<li><b>Tape:</b> ' + String(forecast.source).replace(/</g, '') + '</li>' : ''}
        </ul>
        <ul class="lst">${levels}</ul>
        <ul class="lst">${reasons}</ul>
        <div class="note" style="margin-top:10px; border-top:1px solid var(--line); padding-top:8px;">
          ${called
            ? 'Bracket derived from the measured band (one ATR around the last close): SL at the far edge, TP1 half a band, TP2 one band. Band-derived, not a measured edge.'
            : 'No directional call - the reads did not agree, so BOTH brackets are shown instead of inventing a side. Levels are band-derived (one ATR), not a measured edge.'}
          ${forecast.note ? (' ' + forecast.note) : ''}
        </div>
      </div>
    `;
    statusEl.textContent = called ? 'Lean' : 'Unread';
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
