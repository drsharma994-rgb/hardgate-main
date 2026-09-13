/* =========================================================================
   HARDGATE Setup Intelligence - Historical Analysis Dashboard

   Deep dive into what works:
   - Win rates by pattern
   - Risk/reward by pattern
   - Performance by confidence level
   - Performance by tier
   - Performance by tab
   - Best symbols
   - Worst patterns to avoid

   ========================================================================= */
'use strict';

class HardgateHistoricalAnalysisDashboard {
  constructor(W) {
    this.W = W || window;
    this.engine = null;
    this.initialized = false;
  }

  /**
   * Initialize historical analysis
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[HistoricalAnalysis] Initializing...');

    // Wait for engine
    const maxWait = 5000;
    const startTime = Date.now();
    while (!this.W.HG_SETUP_INTELLIGENCE && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 100));
    }

    this.engine = this.W.HG_SETUP_INTELLIGENCE;
    if (!this.engine) {
      console.warn('[HistoricalAnalysis] Engine not available');
      return;
    }

    console.log('[HistoricalAnalysis] ✅ Ready');
    this.initialized = true;
  }

  /**
   * Get complete historical analysis report
   */
  getCompleteReport() {
    if (!this.engine) return null;

    return {
      timestamp: new Date().toISOString(),
      overall: this.getOverallStats(),
      byPattern: this.analyzeByPattern(),
      byConfidence: this.analyzeByConfidence(),
      byTier: this.analyzeByTier(),
      byTab: this.analyzeByTab(),
      bySymbol: this.analyzeBySymbol(),
      bestPatterns: this.getBestPatterns(),
      worstPatterns: this.getWorstPatterns(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Get overall statistics
   */
  getOverallStats() {
    const closed = this.engine.getClosedSetups();

    if (closed.length === 0) {
      return { message: 'No closed setups yet' };
    }

    const wins = closed.filter(s => s.outcome && s.outcome.includes('TP'));
    const losses = closed.filter(s => s.outcome === 'SL_HIT');

    const avgRR = closed.length > 0
      ? closed.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closed.length
      : 0;

    const totalPnL = closed.reduce((sum, s) => sum + (s.pnl || 0), 0);
    const avgDuration = closed.length > 0
      ? closed.reduce((sum, s) => sum + (s.duration || 0), 0) / closed.length
      : 0;

    return {
      totalSetups: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: (wins.length / closed.length * 100).toFixed(1) + '%',
      avgRiskReward: avgRR.toFixed(2) + ':1',
      totalPnL: totalPnL.toFixed(0),
      avgPnL: (totalPnL / closed.length).toFixed(0),
      avgDurationHours: (avgDuration / 3600000).toFixed(1),
      profitFactor: this.calculateProfitFactor(closed),
      sharpeRatio: this.calculateSharpeRatio(closed)
    };
  }

  /**
   * Analyze performance by pattern
   */
  analyzeByPattern() {
    const closed = this.engine.getClosedSetups();
    const byPattern = {};

    closed.forEach(s => {
      const pattern = s.pattern || 'UNKNOWN';
      if (!byPattern[pattern]) {
        byPattern[pattern] = { total: 0, wins: 0, losses: 0, rrs: [], pnls: [] };
      }
      byPattern[pattern].total++;
      if (s.outcome && s.outcome.includes('TP')) {
        byPattern[pattern].wins++;
      }
      if (s.outcome === 'SL_HIT') {
        byPattern[pattern].losses++;
      }
      if (s.riskReward) byPattern[pattern].rrs.push(s.riskReward);
      if (s.pnl) byPattern[pattern].pnls.push(s.pnl);
    });

    const analysis = {};
    for (const [pattern, stats] of Object.entries(byPattern)) {
      analysis[pattern] = {
        totalSetups: stats.total,
        winRate: stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) + '%' : 'N/A',
        wins: stats.wins,
        losses: stats.losses,
        avgRR: stats.rrs.length > 0
          ? (stats.rrs.reduce((a, b) => a + b) / stats.rrs.length).toFixed(2)
          : 'N/A',
        totalPnL: stats.pnls.reduce((a, b) => a + b, 0).toFixed(0),
        recommendation: this.getPatternRecommendation(stats)
      };
    }

    return analysis;
  }

  /**
   * Analyze performance by confidence level
   */
  analyzeByConfidence() {
    const closed = this.engine.getClosedSetups();
    const buckets = {
      'Very Low (0-0.4)': { total: 0, wins: 0, rrs: [] },
      'Low (0.4-0.6)': { total: 0, wins: 0, rrs: [] },
      'Medium (0.6-0.75)': { total: 0, wins: 0, rrs: [] },
      'High (0.75-0.9)': { total: 0, wins: 0, rrs: [] },
      'Very High (0.9-1.0)': { total: 0, wins: 0, rrs: [] }
    };

    closed.forEach(s => {
      const conf = s.confidence || 0.5;
      let bucket;
      if (conf < 0.4) bucket = 'Very Low (0-0.4)';
      else if (conf < 0.6) bucket = 'Low (0.4-0.6)';
      else if (conf < 0.75) bucket = 'Medium (0.6-0.75)';
      else if (conf < 0.9) bucket = 'High (0.75-0.9)';
      else bucket = 'Very High (0.9-1.0)';

      buckets[bucket].total++;
      if (s.outcome && s.outcome.includes('TP')) {
        buckets[bucket].wins++;
      }
      if (s.riskReward) buckets[bucket].rrs.push(s.riskReward);
    });

    const analysis = {};
    for (const [level, stats] of Object.entries(buckets)) {
      if (stats.total > 0) {
        analysis[level] = {
          totalSetups: stats.total,
          winRate: (stats.wins / stats.total * 100).toFixed(1) + '%',
          avgRR: stats.rrs.length > 0
            ? (stats.rrs.reduce((a, b) => a + b) / stats.rrs.length).toFixed(2)
            : 'N/A'
        };
      }
    }

    return analysis;
  }

  /**
   * Analyze performance by tier
   */
  analyzeByTier() {
    const closed = this.engine.getClosedSetups();
    const byTier = {
      'STANDARD': { total: 0, wins: 0, rrs: [] },
      'PROFESSIONAL': { total: 0, wins: 0, rrs: [] },
      'PROFESSIONAL-GRADE': { total: 0, wins: 0, rrs: [] }
    };

    closed.forEach(s => {
      const tier = s.tier || 'STANDARD';
      if (byTier[tier]) {
        byTier[tier].total++;
        if (s.outcome && s.outcome.includes('TP')) {
          byTier[tier].wins++;
        }
        if (s.riskReward) byTier[tier].rrs.push(s.riskReward);
      }
    });

    const analysis = {};
    for (const [tier, stats] of Object.entries(byTier)) {
      if (stats.total > 0) {
        analysis[tier] = {
          totalSetups: stats.total,
          winRate: (stats.wins / stats.total * 100).toFixed(1) + '%',
          avgRR: stats.rrs.length > 0
            ? (stats.rrs.reduce((a, b) => a + b) / stats.rrs.length).toFixed(2)
            : 'N/A'
        };
      }
    }

    return analysis;
  }

  /**
   * Analyze performance by tab
   */
  analyzeByTab() {
    const closed = this.engine.getClosedSetups();
    const byTab = {};

    closed.forEach(s => {
      const tab = s.tabName || 'UNKNOWN';
      if (!byTab[tab]) {
        byTab[tab] = { total: 0, wins: 0, rrs: [], pnls: [] };
      }
      byTab[tab].total++;
      if (s.outcome && s.outcome.includes('TP')) {
        byTab[tab].wins++;
      }
      if (s.riskReward) byTab[tab].rrs.push(s.riskReward);
      if (s.pnl) byTab[tab].pnls.push(s.pnl);
    });

    const analysis = {};
    for (const [tab, stats] of Object.entries(byTab)) {
      analysis[tab] = {
        totalSetups: stats.total,
        winRate: (stats.wins / stats.total * 100).toFixed(1) + '%',
        avgRR: stats.rrs.length > 0
          ? (stats.rrs.reduce((a, b) => a + b) / stats.rrs.length).toFixed(2)
          : 'N/A',
        totalPnL: stats.pnls.reduce((a, b) => a + b, 0).toFixed(0)
      };
    }

    return analysis;
  }

  /**
   * Analyze performance by symbol
   */
  analyzeBySymbol(limit = 20) {
    const closed = this.engine.getClosedSetups();
    const bySymbol = {};

    closed.forEach(s => {
      if (!bySymbol[s.symbol]) {
        bySymbol[s.symbol] = { total: 0, wins: 0, rrs: [] };
      }
      bySymbol[s.symbol].total++;
      if (s.outcome && s.outcome.includes('TP')) {
        bySymbol[s.symbol].wins++;
      }
      if (s.riskReward) bySymbol[s.symbol].rrs.push(s.riskReward);
    });

    const analysis = [];
    for (const [symbol, stats] of Object.entries(bySymbol)) {
      if (stats.total >= 3) { // Only symbols with 3+ setups
        analysis.push({
          symbol: symbol,
          totalSetups: stats.total,
          winRate: (stats.wins / stats.total * 100).toFixed(1) + '%',
          avgRR: stats.rrs.length > 0
            ? (stats.rrs.reduce((a, b) => a + b) / stats.rrs.length).toFixed(2)
            : 'N/A'
        });
      }
    }

    return analysis
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
      .slice(0, limit);
  }

  /**
   * Get best performing patterns
   */
  getBestPatterns(limit = 5) {
    const analysis = this.analyzeByPattern();
    const ranked = [];

    for (const [pattern, stats] of Object.entries(analysis)) {
      if (stats.totalSetups >= 5) { // Min 5 setups
        ranked.push({
          pattern: pattern,
          ...stats
        });
      }
    }

    return ranked
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
      .slice(0, limit);
  }

  /**
   * Get worst performing patterns
   */
  getWorstPatterns(limit = 5) {
    const analysis = this.analyzeByPattern();
    const ranked = [];

    for (const [pattern, stats] of Object.entries(analysis)) {
      if (stats.totalSetups >= 3) { // Min 3 setups
        ranked.push({
          pattern: pattern,
          ...stats
        });
      }
    }

    return ranked
      .sort((a, b) => parseFloat(a.winRate) - parseFloat(b.winRate))
      .slice(0, limit);
  }

  /**
   * Generate trading recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Best patterns
    const best = this.getBestPatterns(1);
    if (best.length > 0) {
      recommendations.push(`✅ Best pattern: ${best[0].pattern} (${best[0].winRate})`);
    }

    // Worst patterns
    const worst = this.getWorstPatterns(1);
    if (worst.length > 0 && parseFloat(worst[0].winRate) < 50) {
      recommendations.push(`❌ Avoid pattern: ${worst[0].pattern} (${worst[0].winRate})`);
    }

    // Confidence insight
    const byConf = this.analyzeByConfidence();
    const bestConf = Object.entries(byConf)
      .sort((a, b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate))[0];
    if (bestConf) {
      recommendations.push(`📈 Optimal confidence level: ${bestConf[0]} (${bestConf[1].winRate})`);
    }

    // Best tab
    const byTab = this.analyzeByTab();
    const bestTab = Object.entries(byTab)
      .sort((a, b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate))[0];
    if (bestTab) {
      recommendations.push(`⭐ Best performing tab: ${bestTab[0]} (${bestTab[1].winRate})`);
    }

    return recommendations;
  }

  /**
   * Calculate profit factor
   */
  calculateProfitFactor(setups) {
    const wins = setups.filter(s => s.outcome && s.outcome.includes('TP'));
    const losses = setups.filter(s => s.outcome === 'SL_HIT');

    const grossProfit = wins.reduce((sum, s) => sum + Math.max(0, s.pnl || 0), 0);
    const grossLoss = losses.reduce((sum, s) => sum + Math.abs(Math.min(0, s.pnl || 0)), 0);

    return grossLoss === 0 ? grossProfit.toFixed(2) : (grossProfit / grossLoss).toFixed(2);
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(setups) {
    if (setups.length < 2) return 'N/A';

    const pnls = setups.map(s => s.pnl || 0);
    const mean = pnls.reduce((a, b) => a + b) / pnls.length;
    const variance = pnls.reduce((sum, pnl) => sum + Math.pow(pnl - mean, 2), 0) / pnls.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 'N/A' : (mean / stdDev).toFixed(2);
  }

  /**
   * Get pattern recommendation
   */
  getPatternRecommendation(stats) {
    const winRate = stats.total > 0 ? stats.wins / stats.total : 0;

    if (winRate >= 0.75) return '✅ Excellent';
    if (winRate >= 0.65) return '👍 Good';
    if (winRate >= 0.50) return '⚠️ Acceptable';
    return '❌ Poor';
  }

  /**
   * Export analysis as JSON
   */
  exportAnalysis() {
    const report = this.getCompleteReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      totalClosed: this.engine ? this.engine.getClosedSetups().length : 0,
      timestamp: new Date().toISOString()
    };
  }
}

// Auto-initialize
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const analysis = new HardgateHistoricalAnalysisDashboard(window);
      await analysis.initialize();

      window.HG_HISTORICAL_ANALYSIS = analysis;
      console.log('[HistoricalAnalysis] ✅ Dashboard READY');

    } catch (error) {
      console.error('[HistoricalAnalysis] Initialization failed:', error);
    }
  });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateHistoricalAnalysisDashboard;
}

if (typeof window !== 'undefined') {
  window.HardgateHistoricalAnalysisDashboard = HardgateHistoricalAnalysisDashboard;
}
