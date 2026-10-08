/* =========================================================================
   HARDGATE Conviction System - Phase 3 Production Deployment

   Core system connecting:
   - All HARDGATE tabs → signal generation
   - Lean backtesting → historical validation
   - Conviction scoring → position sizing
   - Trade execution → conviction-based orders

   This is the production integration layer that makes conviction-driven
   trading the default behavior across all tabs.
   ========================================================================= */
'use strict';

const LeanBridge = require('./hardgate-lean-bridge.js');
const Adapter = require('./hardgate-lean-universal-adapter.js');
const fs = require('fs');
const path = require('path');

class HardgateConvictionSystem {
  constructor() {
    this.adapter = new Adapter();
    this.initialized = false;
    this.config = {
      enableConvictionFiltering: true,
      enableMultiTabConsensus: true,
      enableAutoValidation: true,
      minConvictionForTrade: 0.60,
      minTabsForConsensus: 2,
      updateIntervalMs: 60000  // 1 minute
    };
    this.state = {
      activeSignals: [],
      consensusSignals: [],
      convictionScores: new Map(),
      lastUpdate: null,
      validationStatus: {}
    };
    this.metrics = {
      totalSignalsProcessed: 0,
      tradesExecuted: 0,
      convictionDistribution: {}
    };
  }

  /* ===== INITIALIZATION ===== */

  async initialize() {
    if (this.initialized) return;

    console.log('[ConvictionSystem] Initializing...');

    // Initialize adapter
    await this.adapter.init();

    // Register all tabs
    this.registerAllTabs();

    // Set up auto-validation loop
    if (this.config.enableAutoValidation) {
      this.startAutoValidation();
    }

    console.log('[ConvictionSystem] ✅ Ready');
    this.initialized = true;
    return true;
  }

  /* ===== TAB REGISTRATION ===== */

  registerAllTabs() {
    // GOLD ULTRA
    this.adapter.registerTab('GOLD_ULTRA', {
      signalExtractor: (data) => this.extractGoldUltraSignals(data),
      riskPerTrade: 0.02,
      leverage: 1.5,
      validateOnExport: true,
      convictionWeights: {
        tierMultiplier: 0.40,
        confidenceScore: 0.25,
        backtestWinRate: 0.20,
        multiIndicatorAlignment: 0.15
      }
    });

    // OMNIGOLD
    this.adapter.registerTab('OMNIGOLD', {
      signalExtractor: (data) => this.extractOmnigoldSignals(data),
      riskPerTrade: 0.015,
      leverage: 1.25,
      validateOnExport: true,
      convictionWeights: {
        tierMultiplier: 0.35,
        confidenceScore: 0.30,
        backtestWinRate: 0.25,
        multiIndicatorAlignment: 0.10
      }
    });

    // CRYPTO SCAN
    this.adapter.registerTab('CRYPTO_SCAN', {
      signalExtractor: (data) => this.extractCryptoScanSignals(data),
      riskPerTrade: 0.01,
      leverage: 2.0,
      validateOnExport: true,
      convictionWeights: {
        tierMultiplier: 0.30,
        confidenceScore: 0.30,
        backtestWinRate: 0.30,
        multiIndicatorAlignment: 0.10
      }
    });

    // CRYPTO ULTRA
    this.adapter.registerTab('CRYPTO_ULTRA', {
      signalExtractor: (data) => this.extractCryptoUltraSignals(data),
      riskPerTrade: 0.015,
      leverage: 2.0,
      validateOnExport: true,
      convictionWeights: {
        tierMultiplier: 0.35,
        confidenceScore: 0.25,
        backtestWinRate: 0.30,
        multiIndicatorAlignment: 0.10
      }
    });

    // FORMATIONS
    this.adapter.registerTab('FORMATIONS', {
      signalExtractor: (data) => this.extractFormationSignals(data),
      riskPerTrade: 0.025,
      leverage: 1.5,
      validateOnExport: true,
      convictionWeights: {
        tierMultiplier: 0.40,
        confidenceScore: 0.20,
        backtestWinRate: 0.30,
        multiIndicatorAlignment: 0.10
      }
    });

    // OMNIROUTE
    this.adapter.registerTab('OMNIROUTE', {
      signalExtractor: (data) => this.extractOmnirouteSignals(data),
      riskPerTrade: 0.02,
      leverage: 1.5,
      validateOnExport: true,
      convictionWeights: {
        tierMultiplier: 0.35,
        confidenceScore: 0.25,
        backtestWinRate: 0.25,
        multiIndicatorAlignment: 0.15
      }
    });

    console.log('[ConvictionSystem] Registered 6 tabs');
  }

  /* ===== TAB-SPECIFIC EXTRACTORS ===== */

  extractGoldUltraSignals(tabData) {
    if (!tabData) return [];
    return Object.entries(tabData).map(([key, data]) => ({
      symbol: data.symbol,
      signal: data.direction,
      confidence: data.confidence || 0.5,
      tier: data.tier || 'STANDARD',
      entryPrice: data.entry || 0,
      stopLoss: data.stop || 0,
      tp1: data.tp1 || 0,
      tp2: data.tp2 || 0,
      multiIndicatorCount: (data.votes ? Object.values(data.votes).length : 0)
    })).filter(s => s.symbol && s.signal);
  }

  extractOmnigoldSignals(tabData) {
    if (!tabData) return [];
    return Object.entries(tabData).map(([key, data]) => ({
      symbol: key,
      signal: data.bias ? (data.bias.includes('bull') ? 'LONG' : 'SHORT') : 'HOLD',
      confidence: data.strength || 0.5,
      tier: data.grade || 'STANDARD',
      entryPrice: data.price || 0,
      stopLoss: data.sl || 0,
      tp1: data.tp1 || 0,
      tp2: data.tp2 || 0,
      multiIndicatorCount: data.indicators ? data.indicators.length : 1
    })).filter(s => s.signal !== 'HOLD');
  }

  extractCryptoScanSignals(tabData) {
    if (!tabData || !tabData.results) return [];
    return tabData.results.map(item => ({
      symbol: item.symbol,
      signal: item.recommendation === 'BUY' ? 'LONG' : 'SHORT',
      confidence: item.score || 0.5,
      tier: item.category === 'TOP' ? 'PROFESSIONAL-GRADE' : item.category === 'GOOD' ? 'PROFESSIONAL' : 'STANDARD',
      entryPrice: item.currentPrice || 0,
      stopLoss: item.stopLevel || 0,
      tp1: item.target1 || 0,
      tp2: item.target2 || 0,
      multiIndicatorCount: item.agreementCount || 1
    })).filter(s => s.signal !== 'HOLD');
  }

  extractCryptoUltraSignals(tabData) {
    if (!tabData) return [];
    return Object.entries(tabData).map(([key, data]) => ({
      symbol: data.symbol || key,
      signal: data.direction,
      confidence: data.confidence || 0.5,
      tier: data.tier || 'STANDARD',
      entryPrice: data.entry || 0,
      stopLoss: data.stop || 0,
      tp1: data.tp1 || 0,
      tp2: data.tp2 || 0,
      multiIndicatorCount: data.votes ? Object.values(data.votes).length : 0
    })).filter(s => s.symbol && s.signal);
  }

  extractFormationSignals(tabData) {
    if (!tabData || !tabData.formations) return [];
    return tabData.formations.map(f => ({
      symbol: f.symbol,
      signal: f.setupType && f.setupType.includes('BREAKUP') ? 'LONG' : 'SHORT',
      confidence: f.formationScore || 0.5,
      tier: f.validationTier || 'STANDARD',
      entryPrice: f.entryLevel || 0,
      stopLoss: f.stopLevel || 0,
      tp1: f.target1 || 0,
      tp2: f.target2 || 0,
      multiIndicatorCount: f.confirmations || 1
    })).filter(s => s.symbol && s.signal);
  }

  extractOmnirouteSignals(tabData) {
    if (!tabData) return [];
    return Object.entries(tabData).map(([key, data]) => ({
      symbol: data.symbol || key,
      signal: data.direction,
      confidence: data.confidence || 0.5,
      tier: data.tier || 'STANDARD',
      entryPrice: data.price || 0,
      stopLoss: data.stop || 0,
      tp1: data.tp1 || 0,
      tp2: data.tp2 || 0,
      multiIndicatorCount: 1
    })).filter(s => s.symbol && s.signal);
  }

  /* ===== CONVICTION CALCULATION & FILTERING ===== */

  async processTabs(allTabData) {
    console.log('[ConvictionSystem] Processing signals from all tabs...');

    const results = {};
    const convictionMap = new Map();

    // Extract from each tab
    for (const [tabName, data] of Object.entries(allTabData)) {
      const signals = this.adapter.extractSignalsFromTab(tabName, data);

      // Calculate conviction for each signal
      const withConviction = signals.map(s => {
        const conviction = this.adapter.calculateConvictionScore(s);
        const multiplier = this.adapter.convictionToPositionMultiplier(conviction);

        convictionMap.set(`${tabName}:${s.symbol}`, {
          conviction,
          multiplier,
          tabName
        });

        return {
          ...s,
          tabName,
          conviction,
          multiplier
        };
      });

      results[tabName] = withConviction;
    }

    // Find multi-tab consensus
    const consensus = this.adapter.findMultiTabConsensus(results);

    // Filter by conviction threshold
    const filteredSignals = [];
    for (const tabName in results) {
      results[tabName].forEach(s => {
        if (s.conviction >= this.config.minConvictionForTrade) {
          filteredSignals.push(s);
        }
      });
    }

    // Remove divergent signals
    const cleanSignals = this.adapter.removeDivergentSignals(filteredSignals);

    this.state.activeSignals = cleanSignals;
    this.state.consensusSignals = consensus;
    this.state.convictionScores = convictionMap;
    this.state.lastUpdate = new Date().toISOString();

    console.log(`[ConvictionSystem] Processed ${Object.keys(allTabData).length} tabs:`);
    console.log(`  Total signals: ${Object.values(results).reduce((sum, arr) => sum + arr.length, 0)}`);
    console.log(`  After conviction filter: ${cleanSignals.length}`);
    console.log(`  Consensus signals: ${consensus.length}`);
    console.log(`  Divergence removed: ${filteredSignals.length - cleanSignals.length}`);

    return {
      tabResults: results,
      activeSignals: cleanSignals,
      consensusSignals: consensus,
      convictionScores: convictionMap
    };
  }

  /* ===== EXECUTION ===== */

  /**
   * Execute trades based on conviction
   */
  async executeConvictionTrades(accountBalance = 100000) {
    if (!this.state.activeSignals.length) {
      console.log('[ConvictionSystem] No signals to execute');
      return { executed: [], skipped: [] };
    }

    const executed = [];
    const skipped = [];

    for (const signal of this.state.activeSignals) {
      const conviction = signal.conviction;
      const multiplier = this.adapter.convictionToPositionMultiplier(conviction);

      // Get position size from conviction
      const riskDollars = this.adapter.getPositionSizeFromConviction(
        conviction,
        accountBalance,
        0.02
      );

      const positionSize = this.calculateQuantity(signal, riskDollars);

      const trade = {
        symbol: signal.symbol,
        side: signal.signal,
        quantity: positionSize,
        conviction: (conviction * 100).toFixed(1) + '%',
        multiplier: multiplier.toFixed(2) + 'x',
        riskDollars: riskDollars.toFixed(2),
        stopLoss: signal.stopLoss,
        tp1: signal.tp1,
        tp2: signal.tp2,
        tabName: signal.tabName,
        timestamp: new Date().toISOString()
      };

      executed.push(trade);
      this.metrics.tradesExecuted++;
    }

    // Execute consensus signals at higher size
    for (const consensus of this.state.consensusSignals) {
      const tradeExists = executed.find(t => t.symbol === consensus.symbol && t.side === consensus.signal);
      if (!tradeExists) {
        const riskDollars = accountBalance * 0.02 * 2.0;  // 2.0x for consensus
        const trade = {
          symbol: consensus.symbol,
          side: consensus.signal,
          quantity: this.calculateQuantity({ entryPrice: 0, stopLoss: 0 }, riskDollars),
          conviction: (consensus.consensusStrength * 100).toFixed(1) + '% (consensus)',
          multiplier: '2.0x',
          riskDollars: riskDollars.toFixed(2),
          tabName: `Consensus: ${consensus.tabs.join(', ')}`,
          timestamp: new Date().toISOString()
        };
        executed.push(trade);
      }
    }

    console.log(`[ConvictionSystem] Executed ${executed.length} trades`);
    return { executed, skipped };
  }

  calculateQuantity(signal, riskDollars) {
    const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    if (stopDistance < 0.001) return 0;
    return Math.floor(riskDollars / stopDistance);
  }

  /* ===== VALIDATION & MONITORING ===== */

  async validateWithLean() {
    console.log('[ConvictionSystem] Running Lean validation...');

    if (!this.state.activeSignals.length) {
      console.log('  No signals to validate');
      return null;
    }

    try {
      const bridge = new LeanBridge();
      bridge.exportSignals(this.state.activeSignals);
      bridge.generateConfig({
        startDate: '2024-01-15',
        endDate: '2024-12-31',
        initialCash: 100000
      });

      const results = await bridge.runBacktest();
      this.state.validationStatus = {
        backtest: results,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      console.log('[ConvictionSystem] Lean validation complete');
      return results;
    } catch (error) {
      console.warn('[ConvictionSystem] Lean validation failed:', error.message);
      this.state.validationStatus = {
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'failed'
      };
      return null;
    }
  }

  startAutoValidation() {
    setInterval(async () => {
      if (this.state.activeSignals.length > 0) {
        await this.validateWithLean();
      }
    }, this.config.updateIntervalMs);
  }

  /* ===== REPORTING ===== */

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSignalsProcessed: this.metrics.totalSignalsProcessed,
        tradesExecuted: this.metrics.tradesExecuted,
        activeSignals: this.state.activeSignals.length,
        consensusSignals: this.state.consensusSignals.length,
        avgConviction: this.state.activeSignals.length > 0
          ? (this.state.activeSignals.reduce((sum, s) => sum + s.conviction, 0) / this.state.activeSignals.length * 100).toFixed(1) + '%'
          : '0%'
      },
      signals: this.state.activeSignals.map(s => ({
        symbol: s.symbol,
        signal: s.signal,
        tab: s.tabName,
        conviction: (s.conviction * 100).toFixed(1) + '%',
        multiplier: (s.multiplier).toFixed(2) + 'x',
        tier: s.tier
      })),
      consensus: this.state.consensusSignals.map(c => ({
        symbol: c.symbol,
        signal: c.signal,
        tabs: c.tabs,
        strength: (c.consensusStrength * 100).toFixed(1) + '%'
      })),
      validationStatus: this.state.validationStatus
    };

    return report;
  }

  generateHTMLReport() {
    const report = this.generateReport();

    let html = `
    <div class="conviction-system-report">
      <h2>HARDGATE Conviction System Status</h2>
      <div class="summary">
        <p>Active Signals: <strong>${report.summary.activeSignals}</strong></p>
        <p>Consensus Signals: <strong>${report.summary.consensusSignals}</strong></p>
        <p>Avg Conviction: <strong>${report.summary.avgConviction}</strong></p>
      </div>

      <h3>Active Signals</h3>
      <table>
        <thead>
          <tr><th>Symbol</th><th>Signal</th><th>Tab</th><th>Conviction</th><th>Position</th><th>Tier</th></tr>
        </thead>
        <tbody>`;

    report.signals.forEach(s => {
      const color = parseFloat(s.conviction) > 75 ? 'green' : parseFloat(s.conviction) > 60 ? 'yellow' : 'red';
      html += `<tr><td>${s.symbol}</td><td>${s.signal}</td><td>${s.tab}</td><td class="${color}">${s.conviction}</td><td>${s.multiplier}</td><td>${s.tier}</td></tr>`;
    });

    html += `</tbody></table>`;

    if (report.consensus.length > 0) {
      html += `<h3>Multi-Tab Consensus (Highest Conviction)</h3><table><thead><tr><th>Symbol</th><th>Signal</th><th>Tabs</th><th>Strength</th></tr></thead><tbody>`;
      report.consensus.forEach(c => {
        html += `<tr><td>${c.symbol}</td><td>${c.signal}</td><td>${c.tabs.join(', ')}</td><td>${c.strength}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `<p><small>Updated: ${report.timestamp}</small></p></div>`;

    return html;
  }

  /* ===== STATE ACCESS ===== */

  getConvictionScore(tabName, symbol) {
    return this.state.convictionScores.get(`${tabName}:${symbol}`) || null;
  }

  getActiveSignals() {
    return this.state.activeSignals;
  }

  getConsensusSignals() {
    return this.state.consensusSignals;
  }

  getState() {
    return this.state;
  }

  getMetrics() {
    return this.metrics;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateConvictionSystem;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.HardgateConvictionSystem = HardgateConvictionSystem;
}
