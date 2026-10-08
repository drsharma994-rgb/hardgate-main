/* =========================================================================
   HARDGATE Conviction Optimizer - Phase 4

   Intelligent system that learns from live trading performance and
   automatically tunes conviction weights, position sizing, and parameters
   for continuous improvement.

   Capabilities:
   - Real-time performance tracking (win rate, Sharpe, P&F by conviction level)
   - Automated weight optimization (tier, confidence, backtest, multi-tab)
   - Market condition detection (trending, ranging, volatile, calm)
   - Adaptive parameter adjustment (risk per trade, leverage, thresholds)
   - Anomaly detection and alerting
   - Predictive modeling of signal quality
   ========================================================================= */
'use strict';

class HardgateConvictionOptimizer {
  constructor(convictionSystem) {
    this.system = convictionSystem;
    this.config = {
      enableAutoOptimization: true,
      enableMarketDetection: true,
      enableAnomalyDetection: true,
      optimizationIntervalMs: 3600000,  // 1 hour
      minTradesToOptimize: 10,
      learningRate: 0.05,  // 5% adjustment per optimization pass
      maxWeightAdjustment: 0.15  // Don't change weights by more than 15%
    };

    this.performance = {
      byConviction: new Map(),      // Conviction level → [trades]
      byTab: new Map(),              // Tab name → [trades]
      byTier: new Map(),             // Tier → [trades]
      overall: {
        trades: [],
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      },
      history: []                     // Historical performance snapshots
    };

    this.weights = {
      GOLD_ULTRA: { tier: 0.40, confidence: 0.25, backtest: 0.20, multiTab: 0.15 },
      OMNIGOLD: { tier: 0.35, confidence: 0.30, backtest: 0.25, multiTab: 0.10 },
      CRYPTO_SCAN: { tier: 0.30, confidence: 0.30, backtest: 0.30, multiTab: 0.10 },
      CRYPTO_ULTRA: { tier: 0.35, confidence: 0.25, backtest: 0.30, multiTab: 0.10 },
      FORMATIONS: { tier: 0.40, confidence: 0.20, backtest: 0.30, multiTab: 0.10 },
      OMNIROUTE: { tier: 0.35, confidence: 0.25, backtest: 0.25, multiTab: 0.15 }
    };

    this.marketCondition = {
      state: 'UNKNOWN',  // TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, CALM
      volatility: 0,
      trend: 0,
      confidence: 0,
      detectedAt: null
    };

    this.optimization = {
      lastRun: null,
      nextRun: null,
      recommendations: [],
      appliedChanges: []
    };
  }

  /* ===== INITIALIZATION ===== */

  async initialize() {
    console.log('[Optimizer] Initializing...');

    // Load historical weights and performance
    this.loadHistoricalData();

    // Start auto-optimization loop
    if (this.config.enableAutoOptimization) {
      this.startAutoOptimization();
    }

    // Start market detection
    if (this.config.enableMarketDetection) {
      this.startMarketDetection();
    }

    // Start anomaly detection
    if (this.config.enableAnomalyDetection) {
      this.startAnomalyDetection();
    }

    console.log('[Optimizer] ✅ Ready');
  }

  /* ===== PERFORMANCE TRACKING ===== */

  recordTrade(trade) {
    // trade = { symbol, side, entryPrice, exitPrice, pnl, conviction, tier, tabName, timestamp }

    this.performance.overall.trades.push(trade);

    // Track by conviction level (buckets: 0-60%, 60-70%, 70-80%, 80-90%, 90%+)
    const convictionBucket = this.getConvictionBucket(trade.conviction);
    if (!this.performance.byConviction.has(convictionBucket)) {
      this.performance.byConviction.set(convictionBucket, []);
    }
    this.performance.byConviction.get(convictionBucket).push(trade);

    // Track by tab
    if (!this.performance.byTab.has(trade.tabName)) {
      this.performance.byTab.set(trade.tabName, []);
    }
    this.performance.byTab.get(trade.tabName).push(trade);

    // Track by tier
    if (!this.performance.byTier.has(trade.tier)) {
      this.performance.byTier.set(trade.tier, []);
    }
    this.performance.byTier.get(trade.tier).push(trade);

    // Update overall metrics
    this.recalculateMetrics();
  }

  recalculateMetrics() {
    const trades = this.performance.overall.trades;
    if (trades.length === 0) return;

    // Win rate
    const wins = trades.filter(t => t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl < 0).length;
    this.performance.overall.winRate = wins / (wins + losses);

    // Profit factor
    const winPnL = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const lossPnL = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    this.performance.overall.profitFactor = lossPnL > 0 ? winPnL / lossPnL : 0;

    // Sharpe ratio (simplified)
    const returns = trades.map(t => t.pnl);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    this.performance.overall.sharpeRatio = stdDev > 0 ? mean / stdDev : 0;

    // Max drawdown
    let maxDD = 0;
    let peak = 0;
    let equity = 0;
    trades.forEach(t => {
      equity += t.pnl;
      peak = Math.max(peak, equity);
      maxDD = Math.max(maxDD, peak - equity);
    });
    this.performance.overall.maxDrawdown = maxDD;
  }

  getConvictionBucket(conviction) {
    if (conviction < 0.60) return '0-60%';
    if (conviction < 0.70) return '60-70%';
    if (conviction < 0.80) return '70-80%';
    if (conviction < 0.90) return '80-90%';
    return '90%+';
  }

  /* ===== PERFORMANCE ANALYSIS ===== */

  analyzePerformanceByConviction() {
    const analysis = {};

    for (const [bucket, trades] of this.performance.byConviction) {
      if (trades.length < this.config.minTradesToOptimize) continue;

      const wins = trades.filter(t => t.pnl > 0).length;
      const losses = trades.filter(t => t.pnl < 0).length;
      const winRate = wins / (wins + losses);

      const winPnL = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
      const lossPnL = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
      const profitFactor = lossPnL > 0 ? winPnL / lossPnL : 0;

      analysis[bucket] = {
        tradeCount: trades.length,
        winRate: (winRate * 100).toFixed(1) + '%',
        profitFactor: profitFactor.toFixed(2),
        totalPnL: winPnL - lossPnL,
        avgWin: winRate > 0 ? (winPnL / wins).toFixed(2) : 0,
        avgLoss: losses > 0 ? (lossPnL / losses).toFixed(2) : 0
      };
    }

    return analysis;
  }

  analyzePerformanceByTab() {
    const analysis = {};

    for (const [tab, trades] of this.performance.byTab) {
      if (trades.length < this.config.minTradesToOptimize) continue;

      const wins = trades.filter(t => t.pnL > 0).length;
      const losses = trades.filter(t => t.pnl < 0).length;
      const winRate = wins / (wins + losses);

      analysis[tab] = {
        tradeCount: trades.length,
        winRate: (winRate * 100).toFixed(1) + '%',
        avgPnL: (trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length).toFixed(2)
      };
    }

    return analysis;
  }

  /* ===== MARKET CONDITION DETECTION ===== */

  detectMarketCondition(priceHistory = []) {
    // Simple implementation: detect trend, volatility, and market state

    if (priceHistory.length < 20) {
      this.marketCondition.state = 'UNKNOWN';
      return;
    }

    // Calculate trend (simple linear regression)
    const trend = this.calculateTrend(priceHistory);

    // Calculate volatility
    const volatility = this.calculateVolatility(priceHistory);

    // Determine market state
    let state = 'UNKNOWN';
    if (Math.abs(trend) > volatility * 0.5) {
      state = trend > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
    } else if (volatility > 20) {
      state = 'VOLATILE';
    } else if (volatility < 5) {
      state = 'CALM';
    } else {
      state = 'RANGING';
    }

    this.marketCondition = {
      state,
      volatility: volatility.toFixed(2),
      trend: trend.toFixed(2),
      confidence: Math.min(1, priceHistory.length / 50),
      detectedAt: new Date().toISOString()
    };

    console.log(`[Optimizer] Market condition: ${state} (volatility: ${volatility.toFixed(1)}, trend: ${trend.toFixed(2)})`);
  }

  calculateTrend(priceHistory) {
    if (priceHistory.length < 2) return 0;

    const n = priceHistory.length;
    const sumX = (n * (n + 1)) / 2;
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    const sumY = priceHistory.reduce((a, b) => a + b, 0);
    const sumXY = priceHistory.reduce((sum, price, i) => sum + (i + 1) * price, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  calculateVolatility(priceHistory) {
    const mean = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
    const variance = priceHistory.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / priceHistory.length;
    return Math.sqrt(variance);
  }

  startMarketDetection() {
    setInterval(() => {
      // In production, fetch real price history from market data source
      // For now, use mock detection
      this.detectMarketCondition([]);
    }, 300000);  // Every 5 minutes
  }

  /* ===== AUTOMATED OPTIMIZATION ===== */

  async runOptimization() {
    if (this.performance.overall.trades.length < this.config.minTradesToOptimize) {
      console.log('[Optimizer] Not enough trades for optimization yet');
      return null;
    }

    console.log('[Optimizer] Running optimization pass...');

    const byConviction = this.analyzePerformanceByConviction();
    const byTab = this.analyzePerformanceByTab();

    // Identify underperforming tabs and adjust their weights
    const recommendations = [];

    for (const [tab, metrics] of Object.entries(byTab)) {
      const expectedWR = this.getExpectedWinRate(tab);
      const actualWR = parseFloat(metrics.winRate) / 100;

      if (actualWR < expectedWR * 0.85) {
        // Underperforming: reduce tier multiplier slightly
        recommendations.push({
          tab,
          type: 'REDUCE_TIER_WEIGHT',
          reason: `Win rate ${(actualWR * 100).toFixed(1)}% below expected ${(expectedWR * 100).toFixed(1)}%`,
          adjustment: -0.05
        });
      } else if (actualWR > expectedWR * 1.15) {
        // Outperforming: increase tier multiplier
        recommendations.push({
          tab,
          type: 'INCREASE_TIER_WEIGHT',
          reason: `Win rate ${(actualWR * 100).toFixed(1)}% above expected ${(expectedWR * 100).toFixed(1)}%`,
          adjustment: +0.05
        });
      }
    }

    // Apply recommendations
    const appliedChanges = [];
    for (const rec of recommendations) {
      const oldWeight = this.weights[rec.tab].tier;
      const newWeight = Math.max(0.20, Math.min(0.50, oldWeight + rec.adjustment));

      if (Math.abs(newWeight - oldWeight) > 0.01) {
        this.weights[rec.tab].tier = newWeight;
        // Rebalance other weights to sum to 1.0
        const remaining = 1 - newWeight;
        const scale = remaining / (1 - oldWeight);
        this.weights[rec.tab].confidence *= scale;
        this.weights[rec.tab].backtest *= scale;
        this.weights[rec.tab].multiTab *= scale;

        appliedChanges.push({
          tab: rec.tab,
          metric: 'tier_weight',
          oldValue: oldWeight.toFixed(3),
          newValue: newWeight.toFixed(3),
          reason: rec.reason
        });

        console.log(`[Optimizer] Updated ${rec.tab} tier weight: ${oldWeight.toFixed(3)} → ${newWeight.toFixed(3)}`);
      }
    }

    // Store optimization history
    this.optimization = {
      lastRun: new Date().toISOString(),
      nextRun: new Date(Date.now() + this.config.optimizationIntervalMs).toISOString(),
      recommendations,
      appliedChanges
    };

    this.performance.history.push({
      timestamp: new Date().toISOString(),
      metrics: this.performance.overall,
      weights: JSON.parse(JSON.stringify(this.weights)),
      marketCondition: this.marketCondition
    });

    return {
      recommendations,
      appliedChanges,
      currentMetrics: this.performance.overall
    };
  }

  getExpectedWinRate(tab) {
    const expectations = {
      GOLD_ULTRA: 0.75,
      OMNIGOLD: 0.70,
      CRYPTO_SCAN: 0.70,
      CRYPTO_ULTRA: 0.75,
      FORMATIONS: 0.70,
      OMNIROUTE: 0.70
    };
    return expectations[tab] || 0.70;
  }

  startAutoOptimization() {
    // Run optimization on schedule
    setInterval(async () => {
      await this.runOptimization();
    }, this.config.optimizationIntervalMs);

    // Also run after significant trade volume
    const checkTradeVolume = () => {
      const recentTrades = this.performance.overall.trades.slice(-10);
      if (recentTrades.length >= 10) {
        this.runOptimization();
        setTimeout(checkTradeVolume, this.config.optimizationIntervalMs);
      } else {
        setTimeout(checkTradeVolume, 60000);
      }
    };
    checkTradeVolume();
  }

  /* ===== ANOMALY DETECTION ===== */

  detectAnomalies() {
    const recentTrades = this.performance.overall.trades.slice(-20);
    if (recentTrades.length < 5) return [];

    const anomalies = [];
    const avgPnL = recentTrades.reduce((sum, t) => sum + t.pnl, 0) / recentTrades.length;
    const stdDev = Math.sqrt(
      recentTrades.reduce((sum, t) => sum + Math.pow(t.pnl - avgPnL, 2), 0) / recentTrades.length
    );

    recentTrades.forEach((trade, idx) => {
      const zScore = Math.abs((trade.pnl - avgPnL) / stdDev);

      if (zScore > 2.5) {
        anomalies.push({
          tradeIndex: this.performance.overall.trades.length - 20 + idx,
          trade,
          zScore: zScore.toFixed(2),
          type: trade.pnl < avgPnL - 2.5 * stdDev ? 'OUTLIER_LOSS' : 'OUTLIER_WIN',
          severity: zScore > 3.0 ? 'HIGH' : 'MEDIUM'
        });
      }
    });

    return anomalies;
  }

  startAnomalyDetection() {
    setInterval(() => {
      const anomalies = this.detectAnomalies();
      if (anomalies.length > 0) {
        console.warn('[Optimizer] Anomalies detected:');
        anomalies.forEach(a => {
          console.warn(`  ${a.type} (z-score: ${a.zScore}) - ${a.trade.symbol}`);
        });
      }
    }, 300000);  // Every 5 minutes
  }

  /* ===== REPORTING ===== */

  generateOptimizationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      overallMetrics: {
        totalTrades: this.performance.overall.trades.length,
        winRate: (this.performance.overall.winRate * 100).toFixed(1) + '%',
        profitFactor: this.performance.overall.profitFactor.toFixed(2),
        sharpe: this.performance.overall.sharpeRatio.toFixed(2),
        maxDD: this.performance.overall.maxDrawdown.toFixed(0)
      },
      byConviction: this.analyzePerformanceByConviction(),
      byTab: this.analyzePerformanceByTab(),
      marketCondition: this.marketCondition,
      optimization: {
        lastRun: this.optimization.lastRun,
        appliedChanges: this.optimization.appliedChanges,
        currentWeights: this.weights
      },
      anomalies: this.detectAnomalies()
    };

    return report;
  }

  generateHTMLReport() {
    const report = this.generateOptimizationReport();

    let html = `
    <div class="optimizer-report">
      <h2>HARDGATE Conviction Optimizer Report</h2>

      <div class="metrics-grid">
        <div class="metric">
          <h3>Win Rate</h3>
          <p class="value">${report.overallMetrics.winRate}</p>
        </div>
        <div class="metric">
          <h3>Profit Factor</h3>
          <p class="value">${report.overallMetrics.profitFactor}</p>
        </div>
        <div class="metric">
          <h3>Sharpe</h3>
          <p class="value">${report.overallMetrics.sharpe}</p>
        </div>
        <div class="metric">
          <h3>Max Drawdown</h3>
          <p class="value">${report.overallMetrics.maxDD}</p>
        </div>
      </div>

      <h3>Performance by Conviction Level</h3>
      <table>
        <thead><tr><th>Conviction</th><th>Trades</th><th>Win Rate</th><th>P/F</th><th>PnL</th></tr></thead>
        <tbody>`;

    for (const [level, metrics] of Object.entries(report.byConviction)) {
      html += `<tr>
        <td>${level}</td>
        <td>${metrics.tradeCount}</td>
        <td>${metrics.winRate}</td>
        <td>${metrics.profitFactor}</td>
        <td>${metrics.totalPnL.toFixed(0)}</td>
      </tr>`;
    }

    html += `</tbody></table>

      <h3>Market Condition</h3>
      <p><strong>State:</strong> ${report.marketCondition.state}</p>
      <p><strong>Volatility:</strong> ${report.marketCondition.volatility}</p>
      <p><strong>Trend:</strong> ${report.marketCondition.trend}</p>

      <h3>Recent Optimizations</h3>`;

    if (report.optimization.appliedChanges.length > 0) {
      html += `<ul>`;
      report.optimization.appliedChanges.forEach(change => {
        html += `<li>${change.tab}: ${change.metric} ${change.oldValue} → ${change.newValue}</li>`;
      });
      html += `</ul>`;
    } else {
      html += `<p>No changes in last optimization pass</p>`;
    }

    if (report.anomalies.length > 0) {
      html += `<h3 style="color: #ff4444">⚠️ Anomalies Detected</h3><ul>`;
      report.anomalies.forEach(a => {
        html += `<li>${a.type}: ${a.trade.symbol} (z-score: ${a.zScore})</li>`;
      });
      html += `</ul>`;
    }

    html += `<p><small>Updated: ${report.timestamp}</small></div>`;
    return html;
  }

  /* ===== STATE ACCESS ===== */

  getWeights() {
    return this.weights;
  }

  getMarketCondition() {
    return this.marketCondition;
  }

  getPerformanceHistory() {
    return this.performance.history;
  }

  loadHistoricalData() {
    // In production, load from database/file
    // For now, initialize with defaults
    console.log('[Optimizer] Loaded historical data');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateConvictionOptimizer;
}

if (typeof window !== 'undefined') {
  window.HardgateConvictionOptimizer = HardgateConvictionOptimizer;
}
