/* =========================================================================
   HARDGATE + Lean Universal Adapter

   Integrates Lean backtesting validation across ALL HARDGATE tabs
   for conviction-based position sizing and signal filtering.

   Works with:
   - GOLD ULTRA (goldultra.js)
   - OMNIGOLD (omnigold.js)
   - CRYPTO SCAN (cryptoscan.js)
   - CRYPTO ULTRA (cryptoultra.js)
   - OMNIROUTE (omniroute.js)
   - FORMATIONS (formation.js)
   - Any custom trading tab

   Conviction Scoring:
   - Tier + Confidence from HARDGATE
   - Historical backtest win rate from Lean
   - Signal consistency (same setup across multiple indicators)
   - Price action confirmation
   ========================================================================= */
'use strict';

const LeanBridge = require('./hardgate-lean-bridge.js');
const fs = require('fs');

class HardgateLeanUniversalAdapter {
  constructor() {
    this.bridge = new LeanBridge();
    this.tabConfigs = new Map();
    this.backtestCache = new Map();  // Cache backtest results by signal signature
    this.convictionScores = new Map();
    this.initialized = false;
  }

  /* ===== INITIALIZATION ===== */

  async init() {
    if (this.initialized) return;

    const status = await this.bridge.initialize();
    if (!status.checks.leanRepoExists) {
      console.warn('[LeanAdapter] Lean repo not found; backtest disabled');
    }
    this.initialized = true;
    return status;
  }

  /* ===== TAB REGISTRATION ===== */

  /**
   * Register a trading tab for Lean integration
   * @param {string} tabName - Tab identifier (e.g., 'GOLD_ULTRA', 'CRYPTO_SCAN')
   * @param {Object} config - Tab configuration
   */
  registerTab(tabName, config = {}) {
    this.tabConfigs.set(tabName, {
      name: tabName,
      signalExtractor: config.signalExtractor || null,
      symbolMap: config.symbolMap || {},
      minConfidence: config.minConfidence || 0.50,
      riskPerTrade: config.riskPerTrade || 0.02,
      leverage: config.leverage || 1.5,
      validateOnExport: config.validateOnExport !== false,
      convictionWeights: config.convictionWeights || {
        tierMultiplier: 0.35,
        confidenceScore: 0.25,
        backtestWinRate: 0.25,
        multiIndicatorAlignment: 0.15
      },
      ...config
    });
    return this;
  }

  /* ===== SIGNAL EXTRACTION FROM ANY TAB ===== */

  /**
   * Extract signals from any HARDGATE tab format
   * @param {string} tabName - Registered tab name
   * @param {Object} tabData - Tab data object (W.GU_SIGNALS, W.CS_DATA, etc.)
   * @returns {Array} Normalized signal array
   */
  extractSignalsFromTab(tabName, tabData) {
    if (!tabData) return [];

    const config = this.tabConfigs.get(tabName) || {};
    const signals = [];

    // Handle custom extractor function
    if (config.signalExtractor && typeof config.signalExtractor === 'function') {
      const extracted = config.signalExtractor(tabData);
      if (Array.isArray(extracted)) {
        return extracted;
      }
    }

    // Generic extraction (works with most tab formats)
    for (const key in tabData) {
      const item = tabData[key];
      if (typeof item !== 'object' || !item) continue;

      const signal = this._normalizeSignal(item, tabName, config);
      if (signal && signal.symbol && signal.signal) {
        signals.push(signal);
      }
    }

    return signals;
  }

  /**
   * Normalize signal from any format to standard structure
   * @private
   */
  _normalizeSignal(item, tabName, config) {
    // Common field name variations
    const getField = (obj, ...keys) => {
      for (const key of keys) {
        if (key in obj && obj[key] !== undefined && obj[key] !== null) {
          return obj[key];
        }
      }
      return null;
    };

    const symbol = getField(item, 'symbol', 'pair', 'asset', 'ticker', 'name');
    const signal = getField(item, 'signal', 'direction', 'decision', 'side');
    const confidence = getField(item, 'confidence', 'strength', 'score', 'probability', 'likelihood');
    const tier = getField(item, 'tier', 'grade', 'level', 'quality');
    const price = getField(item, 'price', 'currentPrice', 'lastPrice', 'close');
    const stop = getField(item, 'stop', 'stopLoss', 'sl', 'stoploss');
    const tp1 = getField(item, 'tp1', 'takeProfit1', 'tp_1', 'target1');
    const tp2 = getField(item, 'tp2', 'takeProfit2', 'tp_2', 'target2');

    if (!symbol || !signal) return null;

    return {
      timestamp: new Date().toISOString(),
      tabName: tabName,
      symbol: String(symbol).toUpperCase(),
      signal: String(signal).toUpperCase(),
      confidence: Math.min(1, Math.max(0, Number(confidence) || 0.5)),
      tier: String(tier || 'STANDARD').toUpperCase(),
      entryPrice: Number(price) || 0,
      stopLoss: Number(stop) || 0,
      tp1: Number(tp1) || 0,
      tp2: Number(tp2) || 0
    };
  }

  /* ===== CONVICTION SCORING ===== */

  /**
   * Calculate conviction score for a signal (0-1 scale)
   * Higher score = higher conviction for larger position
   *
   * Factors:
   * - Tier (PROFESSIONAL-GRADE > PROFESSIONAL > STANDARD)
   * - Confidence (algorithm's confidence in signal)
   * - Historical Lean backtest win rate for this signal type
   * - Multi-indicator alignment (same signal from multiple indicators)
   */
  calculateConvictionScore(signal, config = {}, backtestResults = null) {
    const cfg = config || this.tabConfigs.get(signal.tabName) || {};
    const weights = cfg.convictionWeights || {
      tierMultiplier: 0.35,
      confidenceScore: 0.25,
      backtestWinRate: 0.25,
      multiIndicatorAlignment: 0.15
    };

    // 1. Tier component (35%)
    const tierScore = {
      'PROFESSIONAL-GRADE': 1.0,
      'PROFESSIONAL': 0.75,
      'STANDARD': 0.50
    }[signal.tier] || 0.50;

    // 2. Confidence component (25%)
    const confidenceScore = Math.min(1, signal.confidence || 0.5);

    // 3. Backtest win rate component (25%)
    let backtestScore = 0.50;  // Default neutral
    if (backtestResults && backtestResults.winRate) {
      backtestScore = Math.min(1, backtestResults.winRate);
    }

    // 4. Multi-indicator alignment (15%)
    // This would be calculated from signal metadata about indicator agreement
    const alignmentScore = signal.multiIndicatorCount
      ? Math.min(1, signal.multiIndicatorCount / 5)
      : 0.50;

    // Weighted average
    const conviction = (
      tierScore * weights.tierMultiplier +
      confidenceScore * weights.confidenceScore +
      backtestScore * weights.backtestWinRate +
      alignmentScore * weights.multiIndicatorAlignment
    );

    return Math.min(1, Math.max(0, conviction));
  }

  /**
   * Map conviction score to position sizing multiplier
   * conviction 0.50 = 1.0x base risk
   * conviction 0.75 = 1.5x base risk
   * conviction 0.90 = 2.0x base risk
   */
  convictionToPositionMultiplier(conviction) {
    if (conviction < 0.50) return 0.5;   // Half size
    if (conviction < 0.60) return 0.75;  // 3/4 size
    if (conviction < 0.70) return 1.0;   // Base size
    if (conviction < 0.80) return 1.25;  // 1.25x
    if (conviction < 0.90) return 1.5;   // 1.5x
    return 2.0;  // Full size
  }

  /**
   * Get position size in dollars based on conviction
   */
  getPositionSizeFromConviction(conviction, accountBalance, baseRiskPerTrade = 0.02) {
    const multiplier = this.convictionToPositionMultiplier(conviction);
    const riskDollars = accountBalance * baseRiskPerTrade * multiplier;
    return riskDollars;
  }

  /* ===== BACKTEST INTEGRATION ===== */

  /**
   * Get or run Lean backtest for a signal type
   * Caches results to avoid redundant backtests
   */
  async getBacktestResults(signalType, signals, config = {}) {
    const cacheKey = `${signalType}:${signals.length}`;

    if (this.backtestCache.has(cacheKey)) {
      return this.backtestCache.get(cacheKey);
    }

    try {
      this.bridge.exportSignals(signals);
      this.bridge.generateConfig(config);
      const results = await this.bridge.runBacktest();

      this.backtestCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.warn(`[LeanAdapter] Backtest failed for ${signalType}:`, error.message);
      return null;
    }
  }

  /**
   * Compare historical Lean backtest with current live metrics
   */
  compareWithLive(tabName, liveMetrics) {
    const cached = this.backtestCache.values();

    return {
      tabName,
      liveMetrics,
      backtestComparisons: Array.from(cached).map(bt =>
        this.bridge.comparePerformance(liveMetrics, bt)
      )
    };
  }

  /* ===== SIGNAL FILTERING & VALIDATION ===== */

  /**
   * Filter signals by conviction threshold
   */
  filterByConviction(signals, minConviction = 0.60) {
    return signals.filter(s => {
      const conviction = this.calculateConvictionScore(s);
      return conviction >= minConviction;
    });
  }

  /**
   * Filter signals by tier
   */
  filterByTier(signals, allowedTiers = ['PROFESSIONAL-GRADE', 'PROFESSIONAL']) {
    return signals.filter(s => allowedTiers.includes(s.tier));
  }

  /**
   * Filter out divergent signals (conflicting entry directions on same symbol)
   */
  removeDivergentSignals(signals) {
    const symbolSignals = {};

    signals.forEach(s => {
      if (!symbolSignals[s.symbol]) {
        symbolSignals[s.symbol] = [];
      }
      symbolSignals[s.symbol].push(s);
    });

    const filtered = [];
    for (const sym in symbolSignals) {
      const sigs = symbolSignals[sym];
      const directions = new Set(sigs.map(s => s.signal));

      // Only include if all signals agree on direction
      if (directions.size === 1) {
        const bestSignal = sigs.reduce((best, current) =>
          this.calculateConvictionScore(current) > this.calculateConvictionScore(best) ? current : best
        );
        filtered.push(bestSignal);
      }
    }

    return filtered;
  }

  /* ===== MULTI-TAB CONSENSUS ===== */

  /**
   * Find signals that agree across multiple tabs
   * High conviction = same signal from multiple tabs
   */
  findMultiTabConsensus(tabResults) {
    const symbolSignals = {};

    // Group signals by symbol and direction
    for (const [tabName, signals] of Object.entries(tabResults)) {
      signals.forEach(s => {
        const key = `${s.symbol}:${s.signal}`;
        if (!symbolSignals[key]) {
          symbolSignals[key] = { symbol: s.symbol, signal: s.signal, tabs: [] };
        }
        symbolSignals[key].tabs.push(tabName);
      });
    }

    // Filter for multi-tab agreement
    const consensus = [];
    for (const key in symbolSignals) {
      const item = symbolSignals[key];
      if (item.tabs.length >= 2) {  // 2+ tabs agree
        consensus.push({
          symbol: item.symbol,
          signal: item.signal,
          tabCount: item.tabs.length,
          tabs: item.tabs,
          consensusStrength: Math.min(1, item.tabs.length / 3)  // Stronger with more agreement
        });
      }
    }

    return consensus;
  }

  /* ===== EXPORT & VALIDATION ===== */

  /**
   * Export signals from tab with Lean validation
   */
  async exportSignalsWithValidation(tabName, tabData, config = {}) {
    if (!this.initialized) {
      await this.init();
    }

    const signals = this.extractSignalsFromTab(tabName, tabData);

    // Add conviction scores
    const withConviction = signals.map(s => ({
      ...s,
      conviction: this.calculateConvictionScore(s)
    }));

    // Filter by conviction if configured
    const cfg = this.tabConfigs.get(tabName) || {};
    const filtered = cfg.validateOnExport
      ? this.filterByConviction(withConviction, 0.60)
      : withConviction;

    // Export
    this.bridge.exportSignals(filtered);

    return {
      tabName,
      totalSignals: signals.length,
      validatedSignals: filtered.length,
      signals: filtered,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Comprehensive multi-tab export
   */
  async exportAllTabsWithConsensus(allTabData) {
    const results = {};

    // Extract from each tab
    for (const [tabName, tabData] of Object.entries(allTabData)) {
      const signals = this.extractSignalsFromTab(tabName, tabData);
      results[tabName] = signals;
    }

    // Find consensus signals
    const consensus = this.findMultiTabConsensus(results);

    // High-conviction signals: PROFESSIONAL tier OR multi-tab consensus
    const highConviction = [];
    for (const tabName in results) {
      results[tabName].forEach(s => {
        const isMultiTab = consensus.some(c => c.symbol === s.symbol && c.signal === s.signal);
        const isProTier = ['PROFESSIONAL-GRADE', 'PROFESSIONAL'].includes(s.tier);

        if (isMultiTab || isProTier) {
          highConviction.push(s);
        }
      });
    }

    // Export high-conviction signals
    this.bridge.exportSignals(highConviction);

    return {
      tabResults: results,
      consensus: consensus,
      highConvictionSignals: highConviction,
      summary: {
        totalTabs: Object.keys(allTabData).length,
        totalSignals: Object.values(results).reduce((sum, sigs) => sum + sigs.length, 0),
        consensusSignals: consensus.length,
        highConvictionSignals: highConviction.length
      }
    };
  }

  /* ===== REPORTING ===== */

  /**
   * Generate conviction report for display in UI
   */
  generateConvictionReport(signals, title = 'Signal Conviction Analysis') {
    const report = {
      title,
      timestamp: new Date().toISOString(),
      totalSignals: signals.length,
      signals: signals.map(s => ({
        symbol: s.symbol,
        signal: s.signal,
        tier: s.tier,
        confidence: (s.confidence * 100).toFixed(1) + '%',
        conviction: (this.calculateConvictionScore(s) * 100).toFixed(1) + '%',
        positionMultiplier: this.convictionToPositionMultiplier(this.calculateConvictionScore(s)).toFixed(2) + 'x'
      })),
      summary: {
        avgConviction: (signals.reduce((sum, s) => sum + this.calculateConvictionScore(s), 0) / signals.length * 100).toFixed(1) + '%',
        highConviction: signals.filter(s => this.calculateConvictionScore(s) > 0.75).length,
        mediumConviction: signals.filter(s => this.calculateConvictionScore(s) > 0.60 && this.calculateConvictionScore(s) <= 0.75).length,
        lowConviction: signals.filter(s => this.calculateConvictionScore(s) <= 0.60).length
      }
    };

    return report;
  }

  /**
   * Format conviction report as HTML for display
   */
  formatConvictionReportHTML(signals) {
    const report = this.generateConvictionReport(signals);

    let html = `<div class="conviction-report">
      <h3>${report.title}</h3>
      <table>
        <thead>
          <tr>
            <th>Symbol</th><th>Signal</th><th>Tier</th><th>Confidence</th><th>Conviction</th><th>Position</th>
          </tr>
        </thead>
        <tbody>`;

    report.signals.forEach(s => {
      const convictionNum = parseFloat(s.conviction);
      const color = convictionNum > 75 ? 'green' : convictionNum > 60 ? 'yellow' : 'red';
      html += `
        <tr>
          <td>${s.symbol}</td>
          <td>${s.signal}</td>
          <td>${s.tier}</td>
          <td>${s.confidence}</td>
          <td class="conviction-${color}">${s.conviction}</td>
          <td>${s.positionMultiplier}</td>
        </tr>`;
    });

    html += `</tbody></table>
      <div class="summary">
        <p>Avg Conviction: <strong>${report.summary.avgConviction}</strong></p>
        <p>High: ${report.summary.highConviction} | Medium: ${report.summary.mediumConviction} | Low: ${report.summary.lowConviction}</p>
      </div>
    </div>`;

    return html;
  }
}

// Export for use in all tabs
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateLeanUniversalAdapter;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.HardgateLeanUniversalAdapter = HardgateLeanUniversalAdapter;
}
