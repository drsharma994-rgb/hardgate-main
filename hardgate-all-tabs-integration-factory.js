/* =========================================================================
   HARDGATE All Tabs Integration Factory

   Automatically creates and initializes setup intelligence for all 6 tabs:
   - GOLD ULTRA (primary gold scalp)
   - OMNIGOLD (omni-venue gold)
   - CRYPTO SCAN (crypto scanning)
   - CRYPTO ULTRA (crypto voting)
   - FORMATIONS (pattern formations)
   - OMNIROUTE (omni-routing)

   Factory creates tab-specific integrations using the base template.
   ========================================================================= */
'use strict';

class HardgateAllTabsIntegrationFactory {
  constructor(W) {
    this.W = W || window;
    this.integrations = {};
    this.initialized = false;
  }

  /**
   * Initialize all tab integrations
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[AllTabs-Integration-Factory] Initializing all tab integrations...');

    // Define all tabs with their characteristics
    const tabs = [
      {
        name: 'GOLD ULTRA',
        patterns: ['RSI_DIVERGENCE', 'BREAKOUT', 'MOVING_AVERAGE_CROSS', 'SUPPORT_RESISTANCE'],
        hasVoting: true,
        confidenceSource: 'voting'
      },
      {
        name: 'OMNIGOLD',
        patterns: ['OMNIGOLD_SIGNAL', 'MULTI_VENUE_CONFIRM', 'VOLUME_SPIKE', 'CONSOLIDATION_BREAK'],
        hasVoting: true,
        confidenceSource: 'multi_venue'
      },
      {
        name: 'CRYPTO SCAN',
        patterns: ['CRYPTO_BREAKOUT', 'ALTCOIN_DIVERGENCE', 'CORRELATION_SIGNAL', 'MARKET_STRUCTURE'],
        hasVoting: false,
        confidenceSource: 'filter_count'
      },
      {
        name: 'CRYPTO ULTRA',
        patterns: ['CRYPTO_VOTING', 'DOMINANCE_SHIFT', 'VOLATILITY_SIGNAL', 'MOMENTUM'],
        hasVoting: true,
        confidenceSource: 'voting'
      },
      {
        name: 'FORMATIONS',
        patterns: ['CHART_PATTERN', 'HARMONIC_PATTERN', 'STRUCTURE_PATTERN', 'PRICE_ACTION'],
        hasVoting: false,
        confidenceSource: 'formation_strength'
      },
      {
        name: 'OMNIROUTE',
        patterns: ['ROUTE_SIGNAL', 'LIQUIDITY_ROUTE', 'EXECUTION_SIGNAL', 'VENUE_ARBITRAGE'],
        hasVoting: false,
        confidenceSource: 'route_confidence'
      }
    ];

    // Create integration for each tab
    for (const tabConfig of tabs) {
      const integration = await this.createTabIntegration(tabConfig);
      if (integration) {
        this.integrations[tabConfig.name] = integration;
      }
    }

    console.log(`[AllTabs-Integration-Factory] ✅ Initialized ${Object.keys(this.integrations).length} tab integrations`);
    this.initialized = true;
  }

  /**
   * Create a tab-specific integration
   */
  async createTabIntegration(tabConfig) {
    try {
      // Create instance using base template
      const integration = new this.W.HardgateTabIntegration(tabConfig.name, this.W);
      await integration.initialize();

      // Store tab config for later use
      integration.tabConfig = tabConfig;

      console.log(`[AllTabs-Integration-Factory] ✅ ${tabConfig.name} initialized`);
      return integration;
    } catch (error) {
      console.error(`[AllTabs-Integration-Factory] Failed to initialize ${tabConfig.name}:`, error);
      return null;
    }
  }

  /**
   * Get integration for a specific tab
   */
  getIntegration(tabName) {
    return this.integrations[tabName] || null;
  }

  /**
   * Get all integrations
   */
  getAllIntegrations() {
    return this.integrations;
  }

  /**
   * Get performance across all tabs
   */
  getAllTabsPerformance() {
    const performance = {};

    for (const [tabName, integration] of Object.entries(this.integrations)) {
      const perf = integration.getTabPerformance();
      /* v733: only surface an integration that actually has settled data.
         All six read HG_SETUP_INTELLIGENCE, which nothing populates, so
         without this the dashboard rendered six all-zero rows and called it
         a performance report. */
      if (perf && perf.dataPoints > 0) performance[tabName] = perf;
    }

    Object.assign(performance, this.getForwardLogPerformance());
    return performance;
  }

  /* v733: the real source of settled outcomes.
     The six hardcoded integrations above read W.HG_SETUP_INTELLIGENCE, which
     nothing writes setups into — recordSetup is called from only two places,
     neither wired to a live tab — so this dashboard had never shown a number.
     Meanwhile hg-forward.js has been accumulating genuine out-of-sample
     evidence the whole time: one record per firing keyed to the bar it fired
     on, never resolved by the firing bar, settled later by candles that had
     not printed when it was written.
     The tab names are a third scheme again (forward log 'GOLDSCALP', factory
     'GOLD ULTRA', smc-setups 'GOLD_ULTRA'), so rather than translate between
     them this reads whichever tabs the log actually contains. */
  getForwardLogPerformance() {
    const W = this.W;
    if (!W || typeof W.hgFwdPool !== 'function') return {};
    let tabs = [];
    try {
      const raw = W.localStorage ? W.localStorage.getItem('hg_forward_v1') : null;
      const parsed = raw ? JSON.parse(raw) : [];
      const recs = Array.isArray(parsed) ? parsed : (parsed.records || []);
      tabs = Array.from(new Set(recs.map(r => r && r.tab).filter(Boolean)));
    } catch (e) { return {}; }

    const out = {};
    for (const tab of tabs) {
      let pool;
      try { pool = W.hgFwdPool(tab) || {}; } catch (e) { continue; }
      let settled = 0, wins = 0, open = 0, rrSum = 0, rrN = 0;
      for (const stats of Object.values(pool)) {
        if (!stats) continue;
        settled += stats.samples || 0;
        wins += stats.wins || 0;
        open += stats.open || 0;
        if (typeof stats.avgRr === 'number' && isFinite(stats.avgRr)) { rrSum += stats.avgRr; rrN++; }
      }
      if (!settled && !open) continue;
      out[tab] = {
        totalSetups: settled + open,
        closedSetups: settled,
        /* null, not 0, when nothing has settled. A forward record cannot
           resolve until bars after its firing bar exist — on a 4h record with
           a 20-bar horizon that is ~80 hours — so a young log is CORRECTLY
           all-open. Rendering that as "0%" reads as "we measured zero wins"
           when it means "no outcome yet", which is the opposite claim. */
        winRate: settled > 0 ? (wins / settled * 100).toFixed(1) + '%' : null,
        avgRiskReward: rrN > 0 ? (rrSum / rrN).toFixed(2) : null,
        dataPoints: settled,
        source: 'forward-log',
      };
    }
    return out;
  }

  /**
   * Get top performers across all tabs
   */
  getTopPerformersAcrossAllTabs(limit = 5) {
    const allPerformance = this.getAllTabsPerformance();
    const ranked = [];

    for (const [tabName, perf] of Object.entries(allPerformance)) {
      if (perf && perf.dataPoints > 0) {
        ranked.push({
          tabName: tabName,
          winRate: parseFloat(perf.winRate),
          avgRiskReward: parseFloat(perf.avgRiskReward),
          totalSetups: perf.totalSetups,
          closedSetups: perf.closedSetups
        });
      }
    }

    return ranked
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limit);
  }

  /**
   * Find consensus signals across tabs
   * (Same symbol, same direction across 2+ tabs)
   */
  findConsensusSignals() {
    const signalsBySymbol = {};

    // Collect all active (open) setups by symbol and direction
    for (const [tabName, integration] of Object.entries(this.integrations)) {
      const todaySetups = integration.getTodaySetups();
      const openSetups = todaySetups.filter(s => s.status === 'OPEN');

      openSetups.forEach(setup => {
        const key = `${setup.symbol}_${setup.direction}`;
        if (!signalsBySymbol[key]) {
          signalsBySymbol[key] = [];
        }
        signalsBySymbol[key].push({
          tabName: tabName,
          setup: setup
        });
      });
    }

    // Find consensus (2+ tabs agreeing)
    const consensus = [];
    for (const [key, signals] of Object.entries(signalsBySymbol)) {
      if (signals.length >= 2) {
        const [symbol, direction] = key.split('_');
        const avgConfidence = signals.reduce((sum, s) => sum + s.setup.confidence, 0) / signals.length;
        const avgRR = signals.reduce((sum, s) => sum + s.setup.riskReward, 0) / signals.length;

        consensus.push({
          symbol: symbol,
          direction: direction,
          tabCount: signals.length,
          tabs: signals.map(s => s.tabName),
          avgConfidence: avgConfidence.toFixed(2),
          avgRiskReward: avgRR.toFixed(2),
          strength: signals.length >= 3 ? 'VERY_STRONG' : 'STRONG'
        });
      }
    }

    return consensus.sort((a, b) => b.tabCount - a.tabCount);
  }

  /**
   * Get unified performance report
   */
  getUnifiedPerformanceReport() {
    const allPerformance = this.getAllTabsPerformance();

    // Calculate aggregate metrics
    let totalSetups = 0;
    let totalClosed = 0;
    let totalWins = 0;
    const allRiskRewards = [];

    for (const perf of Object.values(allPerformance)) {
      if (perf) {
        totalSetups += perf.totalSetups;
        totalClosed += perf.closedSetups;
        /* v733 UNIT FIX: perf.winRate is a PERCENT string ("66.7%"), so
           parseFloat gives 66.7, not 0.667. Multiplying that by closedSetups
           and then re-multiplying by 100 below inflated every win rate 100x —
           latent until now only because the store it read was always empty. */
        totalWins += ((parseFloat(perf.winRate) || 0) / 100) * perf.closedSetups;
        /* only average an R:R that exists; a tab with nothing settled was
           dragging the mean toward zero by contributing a fabricated 0 */
        const rr = parseFloat(perf.avgRiskReward);
        if (isFinite(rr)) allRiskRewards.push(rr);
      }
    }

    const overallWinRate = totalClosed > 0 ? (totalWins / totalClosed * 100).toFixed(1) : null;
    const overallRiskReward = allRiskRewards.length > 0
      ? (allRiskRewards.reduce((a, b) => a + b) / allRiskRewards.length).toFixed(2)
      : null;

    const summary = {
      totalSetups: totalSetups,
      closedSetups: totalClosed,
      openSetups: totalSetups - totalClosed,
      /* '—' rather than '0%' when nothing has settled: see the note in
         getForwardLogPerformance. No data is not a measurement of zero. */
      overallWinRate: overallWinRate === null ? '—' : overallWinRate + '%',
      overallRiskReward: overallRiskReward === null ? '—' : overallRiskReward,
      tabsActive: Object.keys(allPerformance).length
    };

    return {
      timestamp: new Date().toISOString(),
      summary: summary,
      byTab: allPerformance,
      topTabs: this.getTopPerformersAcrossAllTabs(3),
      consensusSignals: this.findConsensusSignals(),
      insights: this.generateInsights(allPerformance, summary)
    };
  }

  /**
   * Generate insights across all tabs
   */
  generateInsights(allPerformance, summary) {
    const insights = [];

    // Find best performing tab
    let bestTab = null;
    let bestWinRate = 0;
    for (const [tabName, perf] of Object.entries(allPerformance)) {
      if (perf && perf.dataPoints > 0) {
        const winRate = parseFloat(perf.winRate);
        if (winRate > bestWinRate) {
          bestWinRate = winRate;
          bestTab = tabName;
        }
      }
    }

    if (bestTab) {
      insights.push(`📈 Best performing: ${bestTab} (${bestWinRate.toFixed(1)}% win rate)`);
    }

    // Count tabs with data
    const activeTabsWithData = Object.entries(allPerformance)
      .filter(([_, perf]) => perf && perf.dataPoints > 0).length;

    if (activeTabsWithData > 0) {
      insights.push(`📊 ${activeTabsWithData} tabs have closed setups - building edge`);
    }

    // Check for consensus signals
    const consensus = this.findConsensusSignals();
    if (consensus.length > 0) {
      insights.push(`⭐ ${consensus.length} consensus signals (2+ tabs agreeing)`);
    }

    // Overall performance (summary is passed in — asking the report for it here recursed forever)
    const totalPerformance = summary || { overallWinRate: '0%' };
    const overallWR = parseFloat(totalPerformance.overallWinRate);
    if (overallWR >= 70) {
      insights.push(`✅ Strong overall performance: ${totalPerformance.overallWinRate}% win rate`);
    } else if (overallWR > 0) {
      insights.push(`⚠️ Building data - current win rate: ${totalPerformance.overallWinRate}%`);
    }

    return insights;
  }

  /**
   * Export all tabs' data
   */
  exportAllTabsData() {
    const exports = {};

    for (const [tabName, integration] of Object.entries(this.integrations)) {
      exports[tabName] = integration.exportData();
    }

    return {
      exportDate: new Date().toISOString(),
      allTabsData: exports,
      unifiedReport: this.getUnifiedPerformanceReport()
    };
  }

  /**
   * Get status of all integrations
   */
  getStatus() {
    const status = {};

    for (const [tabName, integration] of Object.entries(this.integrations)) {
      status[tabName] = {
        initialized: integration.initialized,
        performance: integration.getTabPerformance()
      };
    }

    return {
      timestamp: new Date().toISOString(),
      factoryInitialized: this.initialized,
      tabs: status,
      summary: this.getUnifiedPerformanceReport().summary
    };
  }
}

// Auto-initialize on page load
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const factory = new HardgateAllTabsIntegrationFactory(window);
      await factory.initialize();

      // Make available globally
      window.HG_TABS_INTEGRATION_FACTORY = factory;

      console.log('[AllTabs-Integration-Factory] ✅ All tabs setup intelligence READY');
      console.log('[AllTabs-Integration-Factory] Status:', factory.getStatus());

    } catch (error) {
      console.error('[AllTabs-Integration-Factory] Initialization failed:', error);
    }
  });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateAllTabsIntegrationFactory;
}

if (typeof window !== 'undefined') {
  window.HardgateAllTabsIntegrationFactory = HardgateAllTabsIntegrationFactory;
}
