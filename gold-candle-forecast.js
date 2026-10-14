/* =========================================================================
HARDGATE — gold-candle-forecast.js (v1326)
Predictive Candle Forecasting Module. Uses ATR and momentum to forecast
the next candle's range, direction, TP, and SL.

Ultimate AI Confluence Engine integrated for advanced candlestick pattern 
recognition, macro confluence, and multi-timeframe setup formation.
========================================================================= */
(function() {
  'use strict';

  /**
   * @module GoldCandleForecast
   * Provides predictive analysis for the next candle based on volatility (ATR)
   * and momentum-based price action patterns.
   */
  var __cfPane = null;

  const mod = {
    id: 'candle-forecast',
    label: 'CANDLE FORECAST',
    mount: function(container) {
      if (!container) return;
        if (__cfPane && container === __cfPane) return;
        __cfPane = container;

      container.innerHTML = `
        <div class="panel">
          <h2>Candle Forecast <span id="cfVersion"></span></h2>
          <div classs="row" style="margin-bottom: 16px;">
            <button class="btn" id="cfRunBtn">SCAN NEXT CANDLE</button>
            <span class="note" id="cfStatus" style="margin-left: 8px; font-weight:700;">Ready</span>
          </div>
          <div id="cfResultArea" class="empty">
            No forecast yet. A scalp is the 15m tape and a swing is the 4h tape. Ultimate AI Confluence names a side only when those two reads agree. It does not invent a third stop. News, headlines, fear and greed, COT and the cached macro feeds are listed on each tape and do not cast a second vote.
          </div>
        </div>
      `;

      var runBtn = (container.querySelector && container.querySelector('#cfRunBtn'))
        || (typeof document !== 'undefined' ? document.getElementById('cfRunBtn') : null);
      if (runBtn && runBtn.addEventListener) runBtn.addEventListener('click', () => this.runForecast());
      var verEl = container.querySelector('#cfVersion');
      var ver = (window.HG_BUILD && window.HG_BUILD.version) || '';
      if (verEl && ver) verEl.textContent = ver;
    },
    refresh: async function() {
      await this.runForecast();
    }
  };

  mod.stampTicket = function(forecast) {
    if (!forecast) return;
    var cflNow = forecast.confluence;
    if (cflNow && cflNow.desks && cflNow.desks.length) {
      forecast.tabs = cflNow.desks.map(function (d) {
        var side = d.lean === true ? 'with' : (d.lean === false ? 'against' : 'unread');
        return String(d.desk) + ' ' + side;
      }).join(', ');
    }
    if (!(forecast.dir && forecast.setup)) return;

    var patNames = [];
    if (forecast.patterns) {
      patNames = forecast.patterns.map(p => p.name);
    }
    var wantLean = forecast.dir === 'BULL' ? 1 : -1;
    var leans = forecast.patternLeans || [];
    for (let i = 0; i < leans.length; i++) {
      if (leans[i] && leans[i].lean === wantLean && leans[i].name) patNames.push(leans[i].name);
    }
    if (!patNames.length && forecast.advancedPatterns) patNames = forecast.advancedPatterns.map(p => p.name);
    if (!patNames.length) return;

    var fams = [];
    if (cflNow && cflNow.voters) {
      for (const v of cflNow.voters) {
        if (v && v.lean === true && v.family && v.family !== 'candles') fams.push(v.family);
      }
    }
    forecast.setup = forecast.dir === 'BULL' ? 'LONG SETUP' : 'SHORT SETUP';
    forecast.setupParts = patNames.join(', ') + (fams.length ? ' · ' + fams.join(', ') : '');
    var note = String(forecast.note || '').replace(/^No setup formed — the call is the vote only\. /, '');
    forecast.note = forecast.setup + ': ' + forecast.setupParts + '. ' + note;
  };

  mod.runForecast = async function() {
    const statusEl = document.getElementById('cfStatus');
    const resultArea = document.getElementById('cfResultArea');
    if (!statusEl || !resultArea) return;

    statusEl.textContent = 'Analyzing...';
    resultArea.className = 'empty';
    resultArea.innerHTML = 'Reading the gold 15m tape...';

    try {
      const loaded = await this.loadGold15m();
      const candles = loaded && loaded.rows;
      if (!Array.isArray(candles) || candles.length < 20) throw new Error('Gold 15m tape unread.');

      if (typeof window.goldCandleForecast !== 'function') throw new Error('Predictive Engine not loaded.');

      const tapes = await this.loadTapes();
      const macroLive = await this.loadMacro();
      const forecast = window.goldCandleForecast(candles, macroLive, tapes);
      if (!forecast) {
        resultArea.innerHTML = 'The candle read failed closed.';
        statusEl.textContent = 'Unread';
        return;
      }
      forecast.source = loaded.source || '';

      var macroSnap = null;
      try { if (typeof window.getGoldMacroCached === 'function') macroSnap = window.getGoldMacroCached(); } catch (e) {}
      forecast.macroRead = !!macroSnap;

      try {
        if (typeof window.hgCfConfluence === 'function') {
          forecast.confluence = window.hgCfConfluence(candles, {
            fundExtra: macroSnap || macroLive || {},
            rows1h: tapes && tapes.rows1h, rows4h: tapes && tapes.rows4h, rows1d: tapes && tapes.rows1d,
            spot: tapes && tapes.spot, perp: tapes && tapes.perp,
            macro: macroSnap || macroLive || null,
            ctx: (macroSnap || macroLive) ? { macro: macroSnap || macroLive } : null
          }, forecast);
        }
      } catch (eCf) { forecast.confluence = null; }

      this.stampTicket(forecast);

      // Scalp Setup
      forecast.scalp = (function () {
        try { return (typeof window.hgCfBuildSetup === 'function') ? window.hgCfBuildSetup(candles, { tf: '15m' }, forecast) : null; } catch (e) { return null; }
      })();

      // Swing Setup
      forecast.swing = null;
      try {
        var load4 = this.loadGold('4h', 120);
        var loaded4 = await load4;
        var c4 = loaded4 && loaded4.rows;
        if (Array.isArray(c4) && c4.length >= 30) {
          var fc4 = window.goldCandleForecast(c4, macroSnap || macroLive || null, { rows1d: tapes && tapes.rows1d });
          try {
            if (fc4 && typeof window.hgCfConfluence === 'function') {
              forecast.confluence = window.hgCfConfluence(c4, {
                horizon: 'swing', tf: '4h', fundExtra: macroSnap || macroLive || {},
                rows15m: candles, rows1h: tapes && tapes.rows1h, rows4h: tapes && tapes.rows4h,
                rows1d: tapes && tapes.rows1d, spot: tapes && tapes.spot, perp: tapes && tapes.perp,
                macro: macroSnap || macroLive || null, ctx: (macroSnap || macroLive) ? { macro: macroSnap || macroLive } : null
              }, fc4);
            }
          } catch (eSwC) { if (fc4) forecast.confluence = null; }
          if (fc4) this.stampTicket(forecast);
          forecast.swing = (typeof window.hgCfBuildSetup === 'function') ? window.hgCfBuildSetup(c4, { tf: '4h' }, fc4) : null;
          if (forecast.swing) forecast.swing.source = loaded4.source || '';
        } else {
          forecast.swing = { ok: false, tf: '4h', formed: false, why: 'the 4h gold tape could not be read' };
        }
      } catch (eSw) { forecast.swing = { ok: false, tf: '4h', formed: false, why: 'the 4h tape failed' }; }

      // Ultimate Confluence
      try { if (typeof window.hgCfUltimate === 'function') forecast.ultimate = window.hgCfUltimate(forecast.scalp, forecast.swing); } catch (eUlt) {}
      try { forecast.measure = (typeof window.hgCfMeasure === 'function') ? window.hgCfMeasure(forecast.scalp, forecast.swing, candles, (Array.isArray(c4) ? c4 : null)) : null; } catch (eMeas) { forecast.measure = null; }
      try { forecast.daySwings = (typeof window.hgCfDaySwings === 'function') ? window.hgCfDaySwings(Array.isArray(c4) ? c4 : null, { live: forecast.swing, limit: 2 }) : { ok: false, setups: [], why: 'No day swings found.' }; } catch (eDay) { forecast.daySwings = { ok: false, setups: [], why: 'Error reading day swings.' }; }

      this.renderResult(resultArea, statusEl, forecast);
    } catch (error) {
      console.error('[CandleForecast] Error:', error);
      resultArea.innerHTML = '<span class="note warn">Error: ' + String(error && error.message || error) + '</span>';
      statusEl.textContent = 'Failed';
    }
  };

  // ... (rest of the module implementation, including renderResult and loadGold etc.)
})();