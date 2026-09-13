/* =========================================================================
   HARDGATE Tab Integration Template

   Template for integrating any tab (GOLD ULTRA, OMNIGOLD, CRYPTO SCAN, etc.)
   with the Setup Intelligence System.

   Copy this pattern to integrate a new tab:
   1. Implement onSetupFormed(setupData)
   2. Implement onSetupOutcome(setupId, outcome)
   3. Call methods at appropriate times
   ========================================================================= */
'use strict';

class HardgateTabIntegration {
  constructor(tabName, W) {
    this.tabName = tabName;
    this.W = W || window;
    this.activeSetups = new Map();  // setupId → setup metadata
    this.initialized = false;
  }

  /**
   * Initialize tab integration
   * Call this once when tab loads
   */
  async initialize() {
    if (this.initialized) return;

    console.log(`[${this.tabName}-Integration] Initializing...`);

    // Wait for setup intelligence system to be ready
    const maxWait = 5000; // 5 seconds
    const startTime = Date.now();
    while (!this.W.HG_SETUP_INTELLIGENCE && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 100));
    }

    if (!this.W.HG_SETUP_INTELLIGENCE) {
      console.warn(`[${this.tabName}-Integration] Setup Intelligence not available`);
      return;
    }

    console.log(`[${this.tabName}-Integration] ✅ Ready`);
    this.initialized = true;
  }

  /**
   * Called when your tab detects a new setup signal
   *
   * Required fields in setupData:
   *   - symbol: 'BTC/USDT'
   *   - direction: 'LONG' or 'SHORT'
   *   - entryPrice: number
   *   - stopLoss: number
   *   - tp1: number (first target, partial exit)
   *   - tp2: number (second target, full exit)
   *   - pattern: string (your pattern name)
   *   - confidence: 0.0-1.0 (your conviction)
   *   - tier: 'STANDARD', 'PROFESSIONAL', 'PROFESSIONAL-GRADE'
   *
   * Optional fields:
   *   - indicators: ['RSI', 'MACD', ...] (what triggered the setup)
   *   - notes: string (trader notes)
   */
  recordSetup(setupData) {
    if (!this.initialized || !this.W.HG_SETUP_INTELLIGENCE) {
      console.warn(`[${this.tabName}-Integration] System not initialized`);
      return null;
    }

    // Validate required fields
    if (!setupData.symbol || !setupData.direction || !setupData.entryPrice) {
      console.error(`[${this.tabName}-Integration] Missing required setup fields`);
      return null;
    }

    // Add tab name
    const enrichedSetup = {
      ...setupData,
      tabName: this.tabName
    };

    // Record in intelligence system
    const setup = this.W.HG_SETUP_INTELLIGENCE.recordSetup(enrichedSetup);

    if (setup) {
      // Track locally for outcome matching
      this.activeSetups.set(setup.id, {
        symbol: setup.symbol,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        tp1: setup.takeProfit1,
        tp2: setup.takeProfit2,
        createdAt: new Date()
      });

      console.log(`[${this.tabName}-Integration] Setup recorded:`, setup.id, setup.symbol, setup.direction);
    }

    return setup;
  }

  /**
   * Called when setup hits TP1 (partial exit)
   */
  onTP1Hit(setupId, exitPrice) {
    this.trackOutcome(setupId, 'TP1_HIT', exitPrice);
  }

  /**
   * Called when setup hits TP2 (full exit)
   */
  onTP2Hit(setupId, exitPrice) {
    this.trackOutcome(setupId, 'TP2_HIT', exitPrice);
  }

  /**
   * Called when setup hits stop loss
   */
  onStopLossHit(setupId, exitPrice) {
    this.trackOutcome(setupId, 'SL_HIT', exitPrice);
  }

  /**
   * Called for partial fills, breakeven, trailing stop exits, etc.
   */
  onPartialExit(setupId, exitPrice, partialExitReason = 'PARTIAL') {
    this.trackOutcome(setupId, 'PARTIAL', exitPrice, partialExitReason);
  }

  /**
   * Internal: track outcome in intelligence system
   */
  trackOutcome(setupId, outcomeType, exitPrice, details = null) {
    if (!this.initialized || !this.W.HG_SETUP_INTELLIGENCE) {
      console.warn(`[${this.tabName}-Integration] System not initialized`);
      return;
    }

    const outcome = {
      type: outcomeType,
      exitPrice: exitPrice,
      details: details
    };

    this.W.HG_SETUP_INTELLIGENCE.updateSetupOutcome(setupId, outcome);
    this.activeSetups.delete(setupId);

    console.log(`[${this.tabName}-Integration] Outcome tracked:`, setupId, outcomeType);
  }

  /**
   * Get setup suggestions before forming a new setup
   * Returns: { winRate, avgRiskReward, warning (if any) }
   */
  getSuggestionsForPattern(pattern) {
    if (!this.initialized || !this.W.HG_SETUP_BOOTSTRAP) {
      return null;
    }

    return this.W.HG_SETUP_BOOTSTRAP.getSuggestionsForNewSetup(pattern, this.tabName);
  }

  /**
   * Get live performance of this tab
   */
  getTabPerformance() {
    if (!this.initialized || !this.W.HG_SETUP_INTELLIGENCE) {
      return null;
    }

    const setups = this.W.HG_SETUP_INTELLIGENCE.getSetupsByTab(this.tabName);
    const closed = setups.filter(s => s.status === 'CLOSED');

    if (closed.length === 0) {
      return {
        totalSetups: setups.length,
        closedSetups: 0,
        winRate: 0,
        avgRiskReward: 0,
        dataPoints: 0
      };
    }

    const wins = closed.filter(s => s.outcome && s.outcome.includes('TP'));
    const avgRR = closed.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closed.length;

    return {
      totalSetups: setups.length,
      closedSetups: closed.length,
      winRate: (wins.length / closed.length * 100).toFixed(1) + '%',
      avgRiskReward: avgRR.toFixed(2),
      dataPoints: closed.length
    };
  }

  /**
   * Get today's setup data from this tab
   */
  getTodaySetups() {
    if (!this.initialized || !this.W.HG_SETUP_INTELLIGENCE) {
      return [];
    }

    const today = this.W.HG_SETUP_INTELLIGENCE.getTodaySetups();
    return today.filter(s => s.tabName === this.tabName);
  }

  /**
   * Get best performing patterns for this tab
   */
  getTopPatterns(limit = 5) {
    if (!this.initialized || !this.W.HG_SETUP_INTELLIGENCE) {
      return [];
    }

    const setups = this.W.HG_SETUP_INTELLIGENCE.getSetupsByTab(this.tabName);
    const patterns = {};

    setups.forEach(s => {
      if (!patterns[s.pattern]) {
        patterns[s.pattern] = { total: 0, wins: 0, closed: 0, riskReward: 0 };
      }
      patterns[s.pattern].total++;
      if (s.status === 'CLOSED') {
        patterns[s.pattern].closed++;
        if (s.outcome && s.outcome.includes('TP')) {
          patterns[s.pattern].wins++;
        }
        patterns[s.pattern].riskReward += s.riskReward || 0;
      }
    });

    const ranked = Object.entries(patterns)
      .map(([name, stats]) => ({
        pattern: name,
        totalSetups: stats.total,
        closedSetups: stats.closed,
        winRate: stats.closed > 0 ? (stats.wins / stats.closed * 100).toFixed(1) + '%' : 'N/A',
        avgRiskReward: stats.closed > 0 ? (stats.riskReward / stats.closed).toFixed(2) : 'N/A'
      }))
      .sort((a, b) => {
        const aRate = parseFloat(a.winRate) || 0;
        const bRate = parseFloat(b.winRate) || 0;
        return bRate - aRate;
      })
      .slice(0, limit);

    return ranked;
  }

  /**
   * Check if pattern is worth trading based on historical data
   */
  isPatternReliable(pattern, minWinRate = 0.60) {
    const patterns = this.getTopPatterns(100);
    const patternData = patterns.find(p => p.pattern === pattern);

    if (!patternData || patternData.closedSetups < 5) {
      return { reliable: false, reason: 'insufficient data', dataPoints: patternData?.closedSetups || 0 };
    }

    const winRate = parseFloat(patternData.winRate);
    if (winRate >= minWinRate * 100) {
      return { reliable: true, reason: 'meets win rate threshold', winRate: patternData.winRate };
    }

    return { reliable: false, reason: 'below win rate threshold', winRate: patternData.winRate };
  }

  /**
   * Get actionable insights for this tab
   */
  getInsights() {
    const perf = this.getTabPerformance();
    const patterns = this.getTopPatterns(3);
    const today = this.getTodaySetups();

    const insights = [];

    if (perf.dataPoints === 0) {
      insights.push('No closed setups yet - start recording to build data');
      return insights;
    }

    const winRate = parseFloat(perf.winRate);
    if (winRate >= 70) {
      insights.push(`✅ Strong win rate: ${perf.winRate}`);
    } else if (winRate >= 50) {
      insights.push(`⚠️ Moderate win rate: ${perf.winRate}`);
    } else {
      insights.push(`❌ Low win rate: ${perf.winRate}`);
    }

    const rr = parseFloat(perf.avgRiskReward);
    if (rr >= 2.0) {
      insights.push(`💰 Excellent R/R: ${perf.avgRiskReward}`);
    } else if (rr >= 1.5) {
      insights.push(`💵 Good R/R: ${perf.avgRiskReward}`);
    } else if (rr < 1.0) {
      insights.push(`⚠️ Poor R/R: ${perf.avgRiskReward}`);
    }

    if (patterns.length > 0 && parseFloat(patterns[0].winRate) > 70) {
      insights.push(`⭐ Best pattern: ${patterns[0].pattern} (${patterns[0].winRate}%)`);
    }

    if (today.length > 5) {
      insights.push(`📊 Active: ${today.length} setups today`);
    }

    return insights;
  }

  /**
   * Export setup data for backup/analysis
   */
  exportData() {
    if (!this.initialized || !this.W.HG_SETUP_INTELLIGENCE) {
      return null;
    }

    const setups = this.W.HG_SETUP_INTELLIGENCE.getSetupsByTab(this.tabName);

    return {
      tabName: this.tabName,
      exportDate: new Date().toISOString(),
      totalSetups: setups.length,
      closedSetups: setups.filter(s => s.status === 'CLOSED').length,
      setups: setups
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateTabIntegration;
}

if (typeof window !== 'undefined') {
  window.HardgateTabIntegration = HardgateTabIntegration;
}
