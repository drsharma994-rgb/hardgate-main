/* =========================================================================
   HARDGATE Setup Intelligence - Unified Dashboard

   Real-time dashboard showing:
   - Overall performance across all 6 tabs
   - Per-tab metrics and win rates
   - Top performing patterns
   - Consensus signals (2+ tabs agreeing)
   - Daily insights and recommendations
   - Active setups and outcomes

   Updates every 30 seconds with live data.
   ========================================================================= */
'use strict';

class HardgateSetupIntelligenceDashboard {
  constructor(W) {
    this.W = W || window;
    this.factory = null;
    this.dashboardElement = null;
    this.updateInterval = 30000;  // Update every 30 seconds
    this.initialized = false;
  }

  /**
   * Initialize dashboard
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[Dashboard] Initializing Setup Intelligence Dashboard...');

    // Wait for factory to be ready
    const maxWait = 5000;
    const startTime = Date.now();
    while (!this.W.HG_TABS_INTEGRATION_FACTORY && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 100));
    }

    this.factory = this.W.HG_TABS_INTEGRATION_FACTORY;
    if (!this.factory) {
      console.warn('[Dashboard] Factory not available');
      return;
    }

    // Create or get dashboard container
    this.createDashboardContainer();

    // Start updates
    this.startUpdates();

    console.log('[Dashboard] ✅ Dashboard ready');
    this.initialized = true;
  }

  /**
   * Create dashboard HTML container
   */
  createDashboardContainer() {
    // Check if already exists
    let dashboard = document.getElementById('hg-setup-intelligence-dashboard-main');
    if (dashboard) {
      this.dashboardElement = dashboard;
      return;
    }

    // Create container
    dashboard = document.createElement('div');
    dashboard.id = 'hg-setup-intelligence-dashboard-main';
    dashboard.className = 'hg-dashboard';
    dashboard.style.cssText = `
      background: #0f1419;
      color: #e8ecef;
      padding: 16px;
      border-radius: 6px;
      border: 1px solid #3a4556;
      margin: 12px 0;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
    `;

    // Add to page after main content
    const mainContent = document.querySelector('main') || document.querySelector('.content') || document.body;
    mainContent.appendChild(dashboard);

    this.dashboardElement = dashboard;
  }

  /**
   * Start periodic dashboard updates
   */
  startUpdates() {
    this.updateDashboard();

    setInterval(() => {
      this.updateDashboard();
    }, this.updateInterval);

    console.log('[Dashboard] Auto-updates started');
  }

  /**
   * Update dashboard with latest data
   */
  updateDashboard() {
    if (!this.dashboardElement || !this.factory) return;

    const html = this.renderDashboard();
    this.dashboardElement.innerHTML = html;
  }

  /**
   * Render complete dashboard HTML
   */
  renderDashboard() {
    const report = this.factory.getUnifiedPerformanceReport();

    return `
      ${this.renderHeader()}
      ${this.renderSummary(report.summary)}
      ${this.renderTabsPerformance(report.byTab)}
      ${this.renderConsensusSignals(report.consensusSignals)}
      ${this.renderTopPerformers(report.topTabs)}
      ${this.renderInsights(report.insights)}
    `;
  }

  /**
   * Render header
   */
  renderHeader() {
    const timestamp = new Date().toLocaleTimeString();
    return `
      <div style="margin-bottom: 12px; border-bottom: 1px solid #3a4556; padding-bottom: 8px;">
        <h2 style="margin: 0; font-size: 16px; color: #ffd700;">
          📊 Setup Intelligence Dashboard
        </h2>
        <div style="font-size: 10px; color: #999; margin-top: 4px;">
          Last updated: ${timestamp}
        </div>
      </div>
    `;
  }

  /**
   * Render summary metrics
   */
  renderSummary(summary) {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
        <div style="background: #1a2235; padding: 12px; border-radius: 4px;">
          <div style="font-size: 10px; color: #999;">Total Setups</div>
          <div style="font-size: 18px; font-weight: bold; color: #ffd700;">${summary.totalSetups}</div>
          <div style="font-size: 10px; color: #666;">Closed: ${summary.closedSetups}, Open: ${summary.openSetups}</div>
        </div>

        <div style="background: #1a2235; padding: 12px; border-radius: 4px;">
          <div style="font-size: 10px; color: #999;">Win Rate</div>
          <div style="font-size: 18px; font-weight: bold; color: ${parseFloat(summary.overallWinRate) >= 70 ? '#00d084' : '#ffd700'};">
            ${summary.overallWinRate}%
          </div>
          <div style="font-size: 10px; color: #666;">Overall performance</div>
        </div>

        <div style="background: #1a2235; padding: 12px; border-radius: 4px;">
          <div style="font-size: 10px; color: #999;">Avg Risk/Reward</div>
          <div style="font-size: 18px; font-weight: bold; color: #ffd700;">
            ${summary.overallRiskReward}:1
          </div>
          <div style="font-size: 10px; color: #666;">Across all setups</div>
        </div>
      </div>
    `;
  }

  /**
   * Render per-tab performance
   */
  renderTabsPerformance(byTab) {
    let html = `
      <div style="margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px 0; font-size: 12px; color: #ffd700;">📈 Performance by Tab</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px;">
    `;

    for (const [tabName, perf] of Object.entries(byTab)) {
      if (perf && perf.dataPoints > 0) {
        const winRate = parseFloat(perf.winRate);
        const color = winRate >= 70 ? '#00d084' : winRate >= 50 ? '#ffd700' : '#ff6b6b';

        html += `
          <div style="background: #1a2235; padding: 8px; border-radius: 4px; border-left: 3px solid ${color};">
            <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">${tabName}</div>
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
              <span>WR: <span style="color: ${color};">${perf.winRate}</span></span>
              <span>RR: ${perf.avgRiskReward}</span>
              <span>${perf.closedSetups}/${perf.totalSetups}</span>
            </div>
          </div>
        `;
      }
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render consensus signals
   */
  renderConsensusSignals(consensus) {
    if (consensus.length === 0) {
      return `
        <div style="margin-bottom: 12px; background: #1a2235; padding: 12px; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; font-size: 12px; color: #ffd700;">⭐ Consensus Signals</h3>
          <div style="font-size: 11px; color: #999;">No consensus signals today</div>
        </div>
      `;
    }

    let html = `
      <div style="margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px 0; font-size: 12px; color: #ffd700;">⭐ Consensus Signals (${consensus.length})</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">
    `;

    consensus.forEach(signal => {
      html += `
        <div style="background: #1a2235; padding: 8px; border-radius: 4px; border: 1px solid #00d084;">
          <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px;">
            ${signal.symbol} ${signal.direction}
          </div>
          <div style="font-size: 10px; color: #00d084; margin-bottom: 2px;">
            ${signal.tabCount} tabs agree
          </div>
          <div style="font-size: 9px; color: #999;">
            ${signal.tabs.join(', ')}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render top performers
   */
  renderTopPerformers(topTabs) {
    let html = `
      <div style="margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px 0; font-size: 12px; color: #ffd700;">🏆 Top Performers</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
    `;

    topTabs.forEach((tab, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      html += `
        <div style="background: #1a2235; padding: 10px; border-radius: 4px;">
          <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">
            ${medal} ${tab.tabName}
          </div>
          <div style="font-size: 10px; color: #00d084;">
            ${tab.winRate.toFixed(1)}% win rate
          </div>
          <div style="font-size: 10px; color: #ffd700;">
            ${tab.avgRiskReward.toFixed(2)}:1 R/R
          </div>
          <div style="font-size: 9px; color: #999;">
            ${tab.closedSetups} closed setups
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render insights
   */
  renderInsights(insights) {
    let html = `
      <div style="background: #1a2235; padding: 12px; border-radius: 4px; border-left: 3px solid #ffd700;">
        <h3 style="margin: 0 0 8px 0; font-size: 12px; color: #ffd700;">💡 Daily Insights</h3>
    `;

    if (insights.length === 0) {
      html += `<div style="font-size: 11px; color: #999;">Build data to see insights</div>`;
    } else {
      insights.forEach(insight => {
        html += `<div style="font-size: 11px; color: #e8ecef; margin-bottom: 4px;">• ${insight}</div>`;
      });
    }

    html += `</div>`;

    return html;
  }

  /**
   * Get status
   */
  getStatus() {
    if (!this.factory) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'ready',
      initialized: this.initialized,
      factory: this.factory.getStatus(),
      timestamp: new Date().toISOString()
    };
  }
}

// Auto-initialize
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const dashboard = new HardgateSetupIntelligenceDashboard(window);
      await dashboard.initialize();

      window.HG_SETUP_INTELLIGENCE_DASHBOARD = dashboard;
      console.log('[Dashboard] ✅ Setup Intelligence Dashboard LIVE');

    } catch (error) {
      console.error('[Dashboard] Initialization failed:', error);
    }
  });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateSetupIntelligenceDashboard;
}

if (typeof window !== 'undefined') {
  window.HardgateSetupIntelligenceDashboard = HardgateSetupIntelligenceDashboard;
}
