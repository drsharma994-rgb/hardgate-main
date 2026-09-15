/* =========================================================================
   HARDGATE Setup Intelligence Bootstrap

   Integrates setup recording, analysis, and intelligence into HARDGATE.
   Instead of autonomous trading, this system:
   - Records every setup formed in every tab
   - Tracks TP/SL outcomes for each setup
   - Analyzes historical performance by pattern/tab/symbol
   - Provides daily intelligence reports
   - Suggests better setups based on historical data
   ========================================================================= */
'use strict';

class HardgateSetupIntelligenceBootstrap {
  constructor(window_context) {
    this.W = window_context || window;
    this.setupIntelligence = null;
    this.initialized = false;
  }

  /**
   * Initialize the setup intelligence system
   */
  async initialize() {
    if (this.initialized) {
      console.log('[SetupIntelligence-Bootstrap] Already initialized');
      return;
    }

    console.log('[SetupIntelligence-Bootstrap] 🚀 Starting HARDGATE Setup Intelligence...');

    try {
      // Load setup intelligence engine
      const SetupIntelligence = window.HardgateSetupIntelligence;
      if (!SetupIntelligence) {
        console.error('[SetupIntelligence-Bootstrap] HardgateSetupIntelligence not found');
        return;
      }

      this.setupIntelligence = new SetupIntelligence();
      await this.setupIntelligence.initialize();
      console.log('[SetupIntelligence-Bootstrap] ✅ Setup Intelligence Engine initialized');

      // Expose to global scope
      this.W.HG_SETUP_INTELLIGENCE = this.setupIntelligence;

      // Hook into tab signal formation
      this.hookIntoTabSetupFormation();

      // Start daily analysis
      this.startDailyAnalysis();

      // Start dashboard updates
      this.startDashboardUpdates();

      console.log('[SetupIntelligence-Bootstrap] ✅ HARDGATE Setup Intelligence System READY');
      this.initialized = true;

      return {
        status: 'ready',
        setupIntelligence: this.setupIntelligence,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[SetupIntelligence-Bootstrap] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Hook into each tab's setup formation
   * Call recordSetup() when a setup is formed
   */
  hookIntoTabSetupFormation() {
    console.log('[SetupIntelligence-Bootstrap] Hooking into tab setup formation...');

    // Create a global helper for all tabs to record setups
    this.W.HG_RECORD_SETUP = (setupData) => {
      return this.setupIntelligence.recordSetup(setupData);
    };

    // Example: Hook for when GOLD ULTRA forms a setup
    // This is called when a new setup signal is identified
    this.W.HG_ON_GOLD_ULTRA_SETUP = (setupData) => {
      setupData.tabName = 'GOLD ULTRA';
      this.setupIntelligence.recordSetup(setupData);
      console.log('[SetupIntelligence] GOLD ULTRA setup recorded:', setupData.symbol, setupData.direction);
    };

    // Similar hooks for other tabs
    this.W.HG_ON_OMNIGOLD_SETUP = (setupData) => {
      setupData.tabName = 'OMNIGOLD';
      this.setupIntelligence.recordSetup(setupData);
    };

    this.W.HG_ON_CRYPTO_SCAN_SETUP = (setupData) => {
      setupData.tabName = 'CRYPTO SCAN';
      this.setupIntelligence.recordSetup(setupData);
    };

    this.W.HG_ON_CRYPTO_ULTRA_SETUP = (setupData) => {
      setupData.tabName = 'CRYPTO ULTRA';
      this.setupIntelligence.recordSetup(setupData);
    };

    this.W.HG_ON_FORMATIONS_SETUP = (setupData) => {
      setupData.tabName = 'FORMATIONS';
      this.setupIntelligence.recordSetup(setupData);
    };

    this.W.HG_ON_OMNIROUTE_SETUP = (setupData) => {
      setupData.tabName = 'OMNIROUTE';
      this.setupIntelligence.recordSetup(setupData);
    };

    console.log('[SetupIntelligence-Bootstrap] ✅ Setup formation hooks ready');
  }

  /**
   * Track when a setup hits TP or SL
   * Tabs should call this when an outcome is known
   */
  trackSetupOutcome(setupId, outcome) {
    // outcome = { type: 'TP1_HIT' | 'TP2_HIT' | 'SL_HIT' | 'PARTIAL', exitPrice }
    this.setupIntelligence.updateSetupOutcome(setupId, outcome);
    console.log('[SetupIntelligence] Setup outcome tracked:', setupId, outcome.type);
  }

  /**
   * Generate setup suggestions for improving future setups
   */
  getSuggestionsForNewSetup(pattern, tabName) {
    const suggestions = {
      pattern,
      tabName,
      timestamp: new Date().toISOString()
    };

    // Get historical performance of this pattern
    const patternSetups = this.setupIntelligence.getSetupsByPattern(pattern);
    const tabSetups = this.setupIntelligence.getSetupsByTab(tabName);

    if (patternSetups.length > 0) {
      const closedPattern = patternSetups.filter(s => s.status === 'CLOSED');
      if (closedPattern.length >= 5) {
        const winRate = closedPattern.filter(s => s.outcome && s.outcome.includes('TP')).length / closedPattern.length;
        const avgRR = closedPattern.reduce((sum, s) => sum + (s.riskReward || 0), 0) / closedPattern.length;

        suggestions.patternPerformance = {
          winRate: (winRate * 100).toFixed(1) + '%',
          avgRiskReward: avgRR.toFixed(2),
          dataPoints: closedPattern.length
        };

        if (winRate < 0.50) {
          suggestions.warning = 'Low historical win rate for this pattern';
        }
      }
    }

    if (tabSetups.length > 0) {
      const closedTab = tabSetups.filter(s => s.status === 'CLOSED');
      if (closedTab.length >= 5) {
        const tabWinRate = closedTab.filter(s => s.outcome && s.outcome.includes('TP')).length / closedTab.length;
        suggestions.tabPerformance = {
          winRate: (tabWinRate * 100).toFixed(1) + '%',
          dataPoints: closedTab.length
        };
      }
    }

    return suggestions;
  }

  /**
   * Start daily analysis of all setups
   */
  startDailyAnalysis() {
    // Analyze every day at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow - now;

    setTimeout(() => {
      this.runDailyAnalysis();
      // Then run every 24 hours
      setInterval(() => this.runDailyAnalysis(), 86400000);
    }, timeUntilMidnight);

    console.log('[SetupIntelligence-Bootstrap] Daily analysis scheduled');
  }

  runDailyAnalysis() {
    const analysis = this.setupIntelligence.analyzeTodaySetups();
    const fullReport = this.setupIntelligence.generateIntelligenceReport();

    console.log('[SetupIntelligence-Bootstrap] Daily analysis complete');
    console.log('[SetupIntelligence-Bootstrap] Report:', fullReport);

    // Store report for access
    this.W.HG_SETUP_DAILY_REPORT = fullReport;

    // Trigger event so dashboard can update
    window.dispatchEvent(new CustomEvent('hg-daily-analysis-complete', {
      detail: fullReport
    }));
  }

  /**
   * Start dashboard updates
   */
  startDashboardUpdates() {
    // Update intelligence dashboard every 2 minutes
    setInterval(() => {
      this.updateIntelligenceDashboard();
    }, 120000);

    // Update once immediately
    this.updateIntelligenceDashboard();

    console.log('[SetupIntelligence-Bootstrap] Dashboard updates started');
  }

  updateIntelligenceDashboard() {
    const element = document.getElementById('hg-setup-intelligence-dashboard');
    if (!element) return;

    const report = this.setupIntelligence.generateIntelligenceReport();
    const html = this.generateDashboardHTML(report);
    element.innerHTML = html;
  }

  /* ---------------------------------------------------------------------
     A rate computed from ZERO closed setups is not zero — it is unmeasured.
     setup-intelligence.js falls back to `: 0` for winRate and avgRiskReward,
     so this panel used to print "0.0%" and "0.00" the moment the log was
     young, directly contradicting the panel above it (which correctly says
     "—, no settled trades yet"). "0% win rate" reads as "we measured zero
     wins"; the truth is "nothing has settled". Render the em dash instead,
     and only trust a rate when something actually closed.
     --------------------------------------------------------------------- */
  ratio(value, closedCount, dp, suffix, scale) {
    if (!closedCount || closedCount <= 0) return '—';
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (!isFinite(n)) return '—';
    return (n * (scale == null ? 1 : scale)).toFixed(dp == null ? 1 : dp) + (suffix || '');
  }

  /* Neutral until measured — an em dash painted green reads as a pass. */
  rateColor(value, closedCount) {
    if (!closedCount || closedCount <= 0) return 'var(--mut, #536175)';
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    if (!isFinite(n)) return 'var(--mut, #536175)';
    if (n >= 0.70) return 'var(--long, #15803d)';
    if (n >= 0.50) return 'var(--txt, #172033)';
    return 'var(--short, #dc2626)';
  }

  generateDashboardHTML(report) {
    if (!report) {
      return '<p style="color:var(--mut,#536175);font-family:var(--mono,monospace);font-size:10px;letter-spacing:.08em;">loading setup intelligence…</p>';
    }

    const today = report.today;
    const historical = report.historical;
    const H = (t) => `<div style="font-family:var(--disp,system-ui);font-size:11px;font-weight:800;
      letter-spacing:.14em;text-transform:uppercase;color:var(--txt,#172033);margin-bottom:6px;">${t}</div>`;
    const cell = (k, v, color) => `<div style="font-size:11px;color:var(--mut,#536175);">${k}
      <b style="font-family:var(--mono,monospace);font-variant-numeric:tabular-nums;
      color:${color || 'var(--txt,#172033)'};">${v}</b></div>`;

    let html = `
    <div style="font-size:12px;color:var(--txt,#172033);font-family:var(--mono,monospace);">
      <h3 style="margin:0 0 10px 0;font-family:var(--disp,system-ui);font-size:12px;font-weight:800;
        letter-spacing:.14em;text-transform:uppercase;color:var(--txt,#172033);">Setup Intelligence Report</h3>

      <div style="margin-bottom:12px;">
        ${H("Today")}
    `;

    /* analyzeTodaySetups() returns NULL when nothing was recorded today, and
       generateIntelligenceReport spreads it into `{ date, ...null }` — which
       is a truthy object carrying only `date`. A plain `if (today)` therefore
       passed and printed "undefined" into every cell. Test a field that only
       a real analysis has. */
    const haveToday = today && typeof today.totalSetups === 'number';
    if (haveToday) {
      const closed = today.closedSetups;
      html += `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;">
          ${cell('total', today.totalSetups)}
          ${cell('settled', closed)}
          ${cell('open', today.openSetups)}
          ${cell('win rate', this.ratio(today.winRate, closed, 1, '%', 100), this.rateColor(today.winRate, closed))}
        </div>
        ${closed > 0 ? '' : `<div style="font-size:10px;color:var(--dim,#65758c);margin-top:4px;">nothing has settled today — the rate is unmeasured, not zero</div>`}
      `;
    } else {
      html += `<div style="font-size:11px;color:var(--mut,#536175);">No setup recorded today.</div>`;
    }

    html += `
      </div>

      <div style="margin-bottom:12px;">
        ${H("Historical")}
    `;

    /* analyzeAllSetups() is null until something has been recorded, which
       used to leave this heading standing over nothing at all. */
    if (historical) {
      const closedAll = this.setupIntelligence.getClosedSetups().length;
      html += `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;">
          ${cell('win rate', this.ratio(historical.overallWinRate, closedAll, 1, '%', 100), this.rateColor(historical.overallWinRate, closedAll))}
          ${cell('avg R:R', this.ratio(historical.avgRiskReward, closedAll, 2))}
          ${cell('settled', closedAll)}
        </div>
      `;
    } else {
      html += `<div style="font-size:11px;color:var(--mut,#536175);">Nothing recorded yet — history builds as setups are logged.</div>`;
    }

    html += `
      </div>
    `;

    // Insights
    if (report.insights && report.insights.length > 0) {
      html += `<div style="margin-bottom:12px;">${H("Insights")}`;
      report.insights.forEach(insight => {
        html += `<div style="font-size:11px;margin:2px 0;color:var(--txt,#172033);
          padding-left:12px;text-indent:-12px;">· ${insight}</div>`;
      });
      html += `</div>`;
    }

    // Top performers
    if (report.topPerformers && report.topPerformers.length > 0) {
      html += `
        <div style="margin-bottom:8px;">
          ${H("Top setups")}
          <div style="overflow-x:auto;">
          <table style="width:100%;font-size:10px;border-collapse:collapse;
            font-family:var(--mono,monospace);font-variant-numeric:tabular-nums;">
            <tr style="border-bottom:1px solid var(--line,#d7dee8);">
              <th style="padding:4px 6px;text-align:left;font-size:9px;letter-spacing:.09em;
                text-transform:uppercase;color:var(--dim,#65758c);font-weight:600;">Symbol</th>
              <th style="padding:4px 6px;text-align:left;font-size:9px;letter-spacing:.09em;
                text-transform:uppercase;color:var(--dim,#65758c);font-weight:600;">Pattern</th>
              <th style="padding:4px 6px;text-align:left;font-size:9px;letter-spacing:.09em;
                text-transform:uppercase;color:var(--dim,#65758c);font-weight:600;">Outcome</th>
              <th style="padding:4px 6px;text-align:left;font-size:9px;letter-spacing:.09em;
                text-transform:uppercase;color:var(--dim,#65758c);font-weight:600;">R:R</th>
            </tr>
      `;
      report.topPerformers.slice(0, 5).forEach(s => {
        /* s.outcome has been assumed a string here; a setup closed without one
           would throw on .includes and take the whole panel down with it. */
        const outcome = String(s.outcome == null ? '' : s.outcome);
        const won = outcome.indexOf('TP') !== -1;
        const rr = (typeof s.riskReward === 'number' && isFinite(s.riskReward))
          ? s.riskReward.toFixed(2)
          : (s.riskReward == null || s.riskReward === '' ? '—' : s.riskReward);
        html += `
          <tr style="border-bottom:1px solid var(--line,#d7dee8);">
            <td style="padding:4px 6px;color:var(--txt,#172033);font-weight:600;">${s.symbol}</td>
            <td style="padding:4px 6px;font-size:9px;color:var(--mut,#536175);">${s.pattern}</td>
            <td style="padding:4px 6px;color:${won ? 'var(--long,#15803d)' : 'var(--short,#dc2626)'};">${outcome || '—'}</td>
            <td style="padding:4px 6px;color:var(--txt,#172033);">${rr}</td>
          </tr>
        `;
      });
      html += `
          </table>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  /**
   * Get current status
   */
  getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    const todaySetups = this.setupIntelligence.getTodaySetups();
    const closedSetups = this.setupIntelligence.getClosedSetups();

    return {
      status: 'ready',
      today: {
        totalSetups: todaySetups.length,
        closedSetups: todaySetups.filter(s => s.status === 'CLOSED').length,
        openSetups: todaySetups.filter(s => s.status === 'OPEN').length
      },
      historical: {
        totalClosed: closedSetups.length,
        winRate: closedSetups.length > 0 ?
          (closedSetups.filter(s => s.outcome && s.outcome.includes('TP')).length / closedSetups.length * 100).toFixed(1) + '%' :
          '0%'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get UI snippet for embedding
   */
  getUISnippet() {
    return `
    <!-- HARDGATE Setup Intelligence Dashboard -->
    <div id="hg-setup-intelligence-dashboard" style="background: #0f1419; color: #e8ecef; padding: 12px; border-radius: 6px; border: 1px solid #3a4556; margin: 12px 0;">
      <p style="text-align: center; color: #ffd700;">Loading setup intelligence dashboard...</p>
    </div>

    <style>
      #hg-setup-intelligence-dashboard table { width: 100%; border-collapse: collapse; }
      #hg-setup-intelligence-dashboard th { background: #242c3f; padding: 6px; text-align: left; border-bottom: 1px solid #3a4556; font-size: 11px; }
      #hg-setup-intelligence-dashboard td { padding: 4px 6px; border-bottom: 1px solid #3a4556; }
    </style>
    `;
  }

  /**
   * Shutdown
   */
  shutdown() {
    console.log('[SetupIntelligence-Bootstrap] Shutting down...');
    this.initialized = false;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateSetupIntelligenceBootstrap;
}

/* The class itself on the global, the way the sibling dashboard module does
   it. A top-level `class` is lexically scoped, so without this the type is
   unreachable from outside the script — including from the tests. */
if (typeof window !== 'undefined') {
  window.HardgateSetupIntelligenceBootstrap = HardgateSetupIntelligenceBootstrap;
}

// Auto-initialize if loaded in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const bootstrap = new HardgateSetupIntelligenceBootstrap(window);
      await bootstrap.initialize();

      // Make available globally
      window.HG_SETUP_BOOTSTRAP = bootstrap;

      console.log('[SetupIntelligence-Bootstrap] ✅ HARDGATE Setup Intelligence is READY');
      console.log('[SetupIntelligence-Bootstrap] Status:', bootstrap.getStatus());

    } catch (error) {
      console.error('[SetupIntelligence-Bootstrap] Failed to initialize:', error);
    }
  });
}
