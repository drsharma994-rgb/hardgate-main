/* =========================================================================
   HARDGATE Setup Intelligence Engine

   Records every setup formed in every tab, tracks whether it hit TP or SL,
   analyzes performance patterns, and provides intelligence to help traders
   form better setups with higher conviction and accuracy.

   NOT autonomous trading - information relay to inform better setup formation.
   ========================================================================= */
'use strict';

class HardgateSetupIntelligence {
  constructor() {
    this.setupDatabase = {
      daily: new Map(),        // Date → [setups]
      byTab: new Map(),        // Tab → [setups]
      bySymbol: new Map(),     // Symbol → [setups]
      byPattern: new Map()     // Pattern type → [setups]
    };

    this.performanceMetrics = {
      overallWinRate: 0,
      tpHitRate: 0,
      slHitRate: 0,
      avgRiskReward: 0,
      setupsByTab: {},
      setupsByPattern: {},
      topPerformers: [],
      bottomPerformers: []
    };

    this.config = {
      enableAutoRecording: true,
      trackingIntervalMs: 3600000,  // 1 hour
      analysisIntervalMs: 86400000, // Daily
      minSetupsForAnalysis: 5
    };

    this.initialized = false;
  }

  /* ===== INITIALIZATION ===== */

  async initialize() {
    if (this.initialized) return;

    console.log('[SetupIntelligence] Initializing Setup Intelligence Engine...');

    // Load historical data
    this.loadHistoricalData();

    // Hook into tab signal generation
    this.hookIntoTabSetups();

    // Start daily analysis
    this.startDailyAnalysis();

    console.log('[SetupIntelligence] ✅ Ready to record and analyze setups');
    this.initialized = true;
  }

  /* ===== SETUP RECORDING ===== */

  /**
   * Record a setup when it's formed in any tab
   * Call this when a setup is identified in GOLD ULTRA, OMNIGOLD, etc.
   */
  recordSetup(setupData) {
    if (!setupData || !setupData.symbol) return null;

    const setup = {
      id: this.generateSetupId(),
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],

      // Setup details
      symbol: setupData.symbol,
      tabName: setupData.tabName || 'UNKNOWN',
      direction: setupData.direction || setupData.signal, // LONG/SHORT
      pattern: setupData.pattern || 'UNCLASSIFIED',

      // Price levels
      entryPrice: parseFloat(setupData.entryPrice) || 0,
      stopLoss: parseFloat(setupData.stopLoss) || 0,
      takeProfit1: parseFloat(setupData.tp1 || setupData.takeProfit1) || 0,
      takeProfit2: parseFloat(setupData.tp2 || setupData.takeProfit2) || 0,

      // Setup metadata
      confidence: parseFloat(setupData.confidence) || 0.5,
      tier: setupData.tier || 'STANDARD',
      indicators: setupData.indicators || [],
      notes: setupData.notes || '',

      // Outcome tracking (updated later)
      outcome: null,           // null, 'TP1_HIT', 'TP2_HIT', 'SL_HIT', 'PARTIAL'
      exitPrice: null,
      exitTime: null,
      pnl: null,
      riskReward: null,
      duration: null,

      status: 'OPEN'           // OPEN, CLOSED
    };

    // Store in database
    this.storeSetup(setup);

    // Calculate risk/reward ratio
    setup.riskReward = this.calculateRiskReward(setup);

    console.log(`[SetupIntelligence] ✅ Recorded: ${setup.symbol} ${setup.direction} (${setup.tabName})`);
    return setup;
  }

  /**
   * Update setup outcome when TP or SL is hit
   */
  updateSetupOutcome(setupId, outcome) {
    // Find setup in database
    for (const [date, setups] of this.setupDatabase.daily) {
      const setup = setups.find(s => s.id === setupId);
      if (setup) {
        setup.outcome = outcome.type;        // 'TP1_HIT', 'TP2_HIT', 'SL_HIT', etc.
        setup.exitPrice = outcome.exitPrice;
        setup.exitTime = new Date().toISOString();
        setup.status = 'CLOSED';

        // Calculate PnL
        if (setup.direction === 'LONG') {
          setup.pnl = setup.exitPrice - setup.entryPrice;
        } else {
          setup.pnl = setup.entryPrice - setup.exitPrice;
        }

        // Calculate duration
        setup.duration = new Date(setup.exitTime) - new Date(setup.timestamp);

        console.log(`[SetupIntelligence] Updated: ${setupId} → ${outcome.type}`);
        return setup;
      }
    }
    return null;
  }

  /* ===== SETUP STORAGE ===== */

  storeSetup(setup) {
    const date = setup.date;
    const symbol = setup.symbol;
    const tab = setup.tabName;
    const pattern = setup.pattern;

    // Store by date
    if (!this.setupDatabase.daily.has(date)) {
      this.setupDatabase.daily.set(date, []);
    }
    this.setupDatabase.daily.get(date).push(setup);

    // Store by tab
    if (!this.setupDatabase.byTab.has(tab)) {
      this.setupDatabase.byTab.set(tab, []);
    }
    this.setupDatabase.byTab.get(tab).push(setup);

    // Store by symbol
    if (!this.setupDatabase.bySymbol.has(symbol)) {
      this.setupDatabase.bySymbol.set(symbol, []);
    }
    this.setupDatabase.bySymbol.get(symbol).push(setup);

    // Store by pattern
    if (!this.setupDatabase.byPattern.has(pattern)) {
      this.setupDatabase.byPattern.set(pattern, []);
    }
    this.setupDatabase.byPattern.get(pattern).push(setup);
  }

  generateSetupId() {
    return 'setup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  calculateRiskReward(setup) {
    const risk = Math.abs(setup.entryPrice - setup.stopLoss);
    if (risk === 0) return 0;

    const reward1 = Math.abs(setup.takeProfit1 - setup.entryPrice);
    const reward2 = Math.abs(setup.takeProfit2 - setup.entryPrice);
    const avgReward = (reward1 + reward2) / 2;

    return avgReward / risk;
  }

  /* ===== PERFORMANCE ANALYSIS ===== */

  /**
   * Analyze all setups recorded today
   */
  analyzeTodaySetups() {
    const today = new Date().toISOString().split('T')[0];
    const todaySetups = this.setupDatabase.daily.get(today) || [];

    if (todaySetups.length === 0) {
      console.log('[SetupIntelligence] No setups recorded today');
      return null;
    }

    const closedSetups = todaySetups.filter(s => s.status === 'CLOSED');
    const openSetups = todaySetups.filter(s => s.status === 'OPEN');

    // Calculate metrics
    const analysis = {
      date: today,
      totalSetups: todaySetups.length,
      closedSetups: closedSetups.length,
      openSetups: openSetups.length,

      // Outcomes
      tpHits: closedSetups.filter(s => s.outcome && s.outcome.includes('TP')).length,
      slHits: closedSetups.filter(s => s.outcome === 'SL_HIT').length,
      partial: closedSetups.filter(s => s.outcome === 'PARTIAL').length,

      // Rates (closed setups only)
      winRate: closedSetups.length > 0 ?
        closedSetups.filter(s => s.outcome && s.outcome.includes('TP')).length / closedSetups.length : 0,

      // Risk/Reward
      avgRiskReward: closedSetups.length > 0 ?
        closedSetups.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closedSetups.length : 0,

      // By tab
      setupsByTab: this.groupByTab(todaySetups),

      // By pattern
      setupsByPattern: this.groupByPattern(todaySetups),

      // By symbol
      topSymbols: this.getTopPerformers(todaySetups, 'symbol', 3)
    };

    console.log(`[SetupIntelligence] Daily analysis for ${today}:`);
    console.log(`  Total: ${analysis.totalSetups}, Closed: ${analysis.closedSetups}, Open: ${analysis.openSetups}`);
    console.log(`  Win rate: ${(analysis.winRate * 100).toFixed(1)}%`);
    console.log(`  Avg R/R: ${analysis.avgRiskReward.toFixed(2)}`);

    return analysis;
  }

  /**
   * Analyze all historical setups
   */
  analyzeAllSetups() {
    const allSetups = Array.from(this.setupDatabase.daily.values()).flat();
    const closedSetups = allSetups.filter(s => s.status === 'CLOSED');

    if (closedSetups.length < this.config.minSetupsForAnalysis) {
      return null;
    }

    // Overall metrics
    this.performanceMetrics.overallWinRate =
      closedSetups.filter(s => s.outcome && s.outcome.includes('TP')).length / closedSetups.length;

    this.performanceMetrics.tpHitRate =
      closedSetups.filter(s => s.outcome && s.outcome.includes('TP')).length / closedSetups.length;

    this.performanceMetrics.slHitRate =
      closedSetups.filter(s => s.outcome === 'SL_HIT').length / closedSetups.length;

    this.performanceMetrics.avgRiskReward =
      closedSetups.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closedSetups.length;

    // By tab
    for (const [tab, setups] of this.setupDatabase.byTab) {
      const closedTab = setups.filter(s => s.status === 'CLOSED');
      if (closedTab.length > 0) {
        this.performanceMetrics.setupsByTab[tab] = {
          total: setups.length,
          closed: closedTab.length,
          winRate: (closedTab.filter(s => s.outcome && s.outcome.includes('TP')).length / closedTab.length).toFixed(2),
          avgRR: (closedTab.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closedTab.length).toFixed(2)
        };
      }
    }

    // By pattern
    for (const [pattern, setups] of this.setupDatabase.byPattern) {
      const closedPattern = setups.filter(s => s.status === 'CLOSED');
      if (closedPattern.length > 0) {
        this.performanceMetrics.setupsByPattern[pattern] = {
          total: setups.length,
          closed: closedPattern.length,
          winRate: (closedPattern.filter(s => s.outcome && s.outcome.includes('TP')).length / closedPattern.length).toFixed(2),
          avgRR: (closedPattern.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closedPattern.length).toFixed(2)
        };
      }
    }

    // Top performers
    this.performanceMetrics.topPerformers = this.getTopPerformers(allSetups, 'pattern', 5);
    this.performanceMetrics.bottomPerformers = this.getBottomPerformers(allSetups, 'pattern', 5);

    return this.performanceMetrics;
  }

  groupByTab(setups) {
    const grouped = {};
    setups.forEach(s => {
      if (!grouped[s.tabName]) grouped[s.tabName] = [];
      grouped[s.tabName].push(s);
    });
    return grouped;
  }

  groupByPattern(setups) {
    const grouped = {};
    setups.forEach(s => {
      if (!grouped[s.pattern]) grouped[s.pattern] = [];
      grouped[s.pattern].push(s);
    });
    return grouped;
  }

  getTopPerformers(setups, groupBy, limit = 5) {
    const grouped = {};
    setups.forEach(s => {
      const key = s[groupBy];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    const ranked = Object.entries(grouped).map(([name, items]) => {
      const closed = items.filter(s => s.status === 'CLOSED');
      const wins = closed.filter(s => s.outcome && s.outcome.includes('TP'));
      return {
        name,
        totalSetups: items.length,
        closedSetups: closed.length,
        winRate: closed.length > 0 ? (wins.length / closed.length).toFixed(2) : 0,
        topSetups: items.slice(0, 3)
      };
    });

    return ranked.sort((a, b) => b.winRate - a.winRate).slice(0, limit);
  }

  getBottomPerformers(setups, groupBy, limit = 5) {
    const grouped = {};
    setups.forEach(s => {
      const key = s[groupBy];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    const ranked = Object.entries(grouped).map(([name, items]) => {
      const closed = items.filter(s => s.status === 'CLOSED');
      const wins = closed.filter(s => s.outcome && s.outcome.includes('TP'));
      return {
        name,
        totalSetups: items.length,
        closedSetups: closed.length,
        winRate: closed.length > 0 ? (wins.length / closed.length).toFixed(2) : 0
      };
    });

    return ranked.sort((a, b) => a.winRate - b.winRate).slice(0, limit);
  }

  /* ===== SETUP RANKING ===== */

  /**
   * Rank setups by TP/SL performance
   */
  rankSetupsByPerformance(setups = null) {
    const allSetups = setups || Array.from(this.setupDatabase.daily.values()).flat();
    const closedSetups = allSetups.filter(s => s.status === 'CLOSED');

    const ranked = closedSetups.map(s => ({
      ...s,
      performanceScore: this.calculatePerformanceScore(s)
    })).sort((a, b) => b.performanceScore - a.performanceScore);

    return ranked;
  }

  calculatePerformanceScore(setup) {
    // Score based on: TP/SL outcome, risk/reward, confidence, tier
    let score = 0;

    if (setup.outcome === 'TP2_HIT') score += 100;
    else if (setup.outcome === 'TP1_HIT') score += 75;
    else if (setup.outcome === 'PARTIAL') score += 50;
    else if (setup.outcome === 'SL_HIT') score += 0;

    score += setup.riskReward * 10;
    score += setup.confidence * 30;

    return score;
  }

  /* ===== INTELLIGENCE REPORTING ===== */

  /**
   * Generate intelligence report for traders
   */
  generateIntelligenceReport() {
    const today = new Date().toISOString().split('T')[0];
    const todayAnalysis = this.analyzeTodaySetups();
    const allAnalysis = this.analyzeAllSetups();
    const topRanked = this.rankSetupsByPerformance().slice(0, 10);

    const report = {
      generated: new Date().toISOString(),

      // Today's performance
      today: {
        date: today,
        ...todayAnalysis
      },

      // Historical performance
      historical: allAnalysis,

      // Top performing setups (for reference)
      topPerformers: topRanked.map(s => ({
        id: s.id,
        symbol: s.symbol,
        pattern: s.pattern,
        tabName: s.tabName,
        direction: s.direction,
        confidence: s.confidence,
        riskReward: s.riskReward.toFixed(2),
        outcome: s.outcome,
        performanceScore: s.performanceScore.toFixed(0)
      })),

      // Insights
      insights: this.generateInsights(todayAnalysis, allAnalysis)
    };

    return report;
  }

  generateInsights(todayAnalysis, allAnalysis) {
    const insights = [];

    if (!todayAnalysis) {
      insights.push('No setups recorded today yet.');
      return insights;
    }

    // Win rate insight
    if (todayAnalysis.winRate >= 0.70) {
      insights.push(`✅ Today's win rate is strong: ${(todayAnalysis.winRate * 100).toFixed(1)}%`);
    } else if (todayAnalysis.winRate >= 0.50) {
      insights.push(`⚠️ Today's win rate is acceptable: ${(todayAnalysis.winRate * 100).toFixed(1)}%`);
    } else if (todayAnalysis.winRate > 0) {
      insights.push(`❌ Today's win rate below 50%: ${(todayAnalysis.winRate * 100).toFixed(1)}%`);
    }

    // Best tab
    const tabWinRates = Object.entries(todayAnalysis.setupsByTab || {}).map(([tab, data]) => ({
      tab,
      rate: parseFloat(data.winRate)
    })).sort((a, b) => b.rate - a.rate);

    if (tabWinRates.length > 0) {
      insights.push(`📊 Best performing tab today: ${tabWinRates[0].tab} (${(tabWinRates[0].rate * 100).toFixed(1)}%)`);
    }

    // Risk/Reward insight
    if (todayAnalysis.avgRiskReward >= 2.0) {
      insights.push(`💰 Excellent risk/reward: ${todayAnalysis.avgRiskReward.toFixed(2)}`);
    } else if (todayAnalysis.avgRiskReward >= 1.0) {
      insights.push(`💵 Good risk/reward: ${todayAnalysis.avgRiskReward.toFixed(2)}`);
    }

    // Pattern insight
    if (allAnalysis && allAnalysis.topPerformers.length > 0) {
      const bestPattern = allAnalysis.topPerformers[0];
      insights.push(`⭐ Best pattern historically: ${bestPattern.name} (${(bestPattern.winRate * 100).toFixed(1)}% win rate over ${bestPattern.closedSetups} setups)`);
    }

    return insights;
  }

  /* ===== SETUP SUGGESTIONS ===== */

  /**
   * Suggest setup improvements based on historical analysis
   */
  suggestSetupImprovements(currentSetup) {
    const suggestions = [];

    // Check historical performance of this pattern
    const patternSetups = this.setupDatabase.byPattern.get(currentSetup.pattern) || [];
    const closedPattern = patternSetups.filter(s => s.status === 'CLOSED');

    if (closedPattern.length >= this.config.minSetupsForAnalysis) {
      const winRate = closedPattern.filter(s => s.outcome && s.outcome.includes('TP')).length / closedPattern.length;
      const avgRR = closedPattern.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closedPattern.length;

      if (winRate < 0.50) {
        suggestions.push(`⚠️ Pattern '${currentSetup.pattern}' has low historical win rate: ${(winRate * 100).toFixed(1)}%`);
      }

      if (avgRR < 1.5) {
        suggestions.push(`💡 Consider wider TP levels. Historical avg R/R for this pattern: ${avgRR.toFixed(2)}`);
      }
    }

    // Check tab performance
    const tabSetups = this.setupDatabase.byTab.get(currentSetup.tabName) || [];
    const closedTab = tabSetups.filter(s => s.status === 'CLOSED');

    if (closedTab.length >= this.config.minSetupsForAnalysis) {
      const tabWinRate = closedTab.filter(s => s.outcome && s.outcome.includes('TP')).length / closedTab.length;

      if (tabWinRate >= 0.70 && currentSetup.confidence < 0.75) {
        suggestions.push(`📈 ${currentSetup.tabName} has high historical win rate. Consider higher confidence threshold.`);
      }
    }

    return suggestions;
  }

  /* ===== HOOKS & AUTO-RECORDING ===== */

  hookIntoTabSetups() {
    // This would connect to each tab's signal generation
    // For now, exposing public recordSetup method for tabs to call
    console.log('[SetupIntelligence] Setup hooks ready - tabs can call recordSetup()');
  }

  startDailyAnalysis() {
    // Analyze every day at midnight
    setInterval(() => {
      const analysis = this.analyzeTodaySetups();
      console.log('[SetupIntelligence] Daily analysis complete');
    }, this.config.analysisIntervalMs);
  }

  loadHistoricalData() {
    // In production, load from database/localStorage
    console.log('[SetupIntelligence] Historical data loaded');
  }

  /* ===== DATA ACCESS ===== */

  getSetupsByDate(date) {
    return this.setupDatabase.daily.get(date) || [];
  }

  getSetupsByTab(tabName) {
    return this.setupDatabase.byTab.get(tabName) || [];
  }

  getSetupsBySymbol(symbol) {
    return this.setupDatabase.bySymbol.get(symbol) || [];
  }

  getSetupsByPattern(pattern) {
    return this.setupDatabase.byPattern.get(pattern) || [];
  }

  getTodaySetups() {
    const today = new Date().toISOString().split('T')[0];
    return this.getSetupsByDate(today);
  }

  getClosedSetups() {
    const allSetups = Array.from(this.setupDatabase.daily.values()).flat();
    return allSetups.filter(s => s.status === 'CLOSED');
  }

  getOpenSetups() {
    const allSetups = Array.from(this.setupDatabase.daily.values()).flat();
    return allSetups.filter(s => s.status === 'OPEN');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateSetupIntelligence;
}

if (typeof window !== 'undefined') {
  window.HardgateSetupIntelligence = HardgateSetupIntelligence;
}
