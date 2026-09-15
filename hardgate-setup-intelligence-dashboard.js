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
    /* Styled from the app's own tokens (bright.css) rather than the hardcoded
       dark palette this panel shipped with. It was the one block on a light,
       data-dense page painted #0f1419, which read as a different product
       bolted on — and it would not follow a future theme change either. */
    dashboard.style.cssText = `
      background: var(--panel, #fff);
      color: var(--txt, #172033);
      padding: 16px;
      border-radius: var(--radius, 8px);
      border: 1px solid var(--line, #d7dee8);
      box-shadow: 0 1px 2px rgba(23,32,51,.06);
      margin: 12px 0;
      font-family: var(--mono, ui-monospace, monospace);
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

  /* ---------------------------------------------------------------------
     Absent values must never render as a measurement. The factory returns
     null for winRate and avgRiskReward when nothing has settled / no winner
     has reported its R, and parseFloat(null) is NaN — which .toFixed() then
     happily prints as the string "NaN" on a trading card. Everything below
     goes through these, so the panel says "—" and means it.
     --------------------------------------------------------------------- */

  /** A finite number, or null. Never NaN, never a coerced zero. */
  num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return isFinite(n) ? n : null;
  }

  /** Format a number to `dp` places, or the em dash when it is absent. */
  fmt(v, dp, suffix) {
    const n = this.num(v);
    if (n === null) return '—';
    return n.toFixed(dp == null ? 1 : dp) + (suffix || '');
  }

  /** Semantic colour for a win rate — absent stays neutral, never green. */
  wrColor(v) {
    const n = this.num(v);
    if (n === null) return 'var(--mut, #536175)';
    if (n >= 70) return 'var(--long, #15803d)';
    if (n >= 50) return 'var(--txt, #172033)';
    return 'var(--short, #dc2626)';
  }

  /** Section heading in the app's own idiom — uppercase, letterspaced. */
  heading(text, note) {
    return `<h3 style="margin:0 0 8px 0;font-family:var(--disp,system-ui);font-size:11px;font-weight:800;
      letter-spacing:.14em;text-transform:uppercase;color:var(--txt,#172033);">${text}${
      note ? `<span style="margin-left:8px;font-family:var(--mono,monospace);font-size:10px;font-weight:600;
      letter-spacing:.04em;text-transform:none;color:var(--mut,#536175);">${note}</span>` : ''}</h3>`;
  }

  /** Tile shell, so every metric box shares one set of edges. */
  tile(inner, accent) {
    return `<div style="background:var(--panel2,#edf1f6);border:1px solid var(--line,#d7dee8);
      border-radius:var(--radius-sm,6px);padding:10px 12px;${
      accent ? `border-left:3px solid ${accent};` : ''}">${inner}</div>`;
  }

  /** Small uppercase label above a figure. */
  label(text) {
    return `<div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;
      color:var(--mut,#536175);margin-bottom:2px;">${text}</div>`;
  }

  /** The figure itself — tabular so columns of numbers line up. */
  figure(text, color) {
    return `<div style="font-family:var(--mono,monospace);font-size:18px;font-weight:600;
      font-variant-numeric:tabular-nums;color:${color || 'var(--txt,#172033)'};">${text}</div>`;
  }

  /** Sub-note under a figure. */
  sub(text) {
    return `<div style="font-size:10px;color:var(--dim,#65758c);margin-top:2px;">${text}</div>`;
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
      <div style="margin-bottom:12px;border-bottom:1px solid var(--line,#d7dee8);padding-bottom:8px;">
        <h2 style="margin:0;font-family:var(--disp,system-ui);font-size:13px;font-weight:800;
          letter-spacing:.14em;text-transform:uppercase;color:var(--txt,#172033);">
          Setup Intelligence
          <span style="margin-left:8px;font-family:var(--mono,monospace);font-size:10px;font-weight:600;
            letter-spacing:.04em;text-transform:none;color:var(--mut,#536175);">
            measured across every integrated tab · settled outcomes only
          </span>
        </h2>
        <div style="font-size:10px;color:var(--dim,#65758c);margin-top:4px;
          font-family:var(--mono,monospace);font-variant-numeric:tabular-nums;">
          updated ${timestamp} · refreshes every ${Math.round(this.updateInterval / 1000)}s
        </div>
      </div>
    `;
  }

  /**
   * Render summary metrics
   */
  renderSummary(summary) {
    const wr = this.num(summary.overallWinRate);
    const rr = this.num(summary.overallRiskReward);
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px;">
        ${this.tile(
          this.label('Total setups') +
          this.figure(summary.totalSetups) +
          this.sub(`${summary.closedSetups} settled · ${summary.openSetups} open`)
        )}
        ${this.tile(
          this.label('Win rate') +
          this.figure(wr === null ? '—' : this.fmt(wr, 1, '%'), this.wrColor(wr)) +
          this.sub(summary.closedSetups > 0
            ? `across ${summary.closedSetups} settled`
            : 'no settled trades yet')
        )}
        ${this.tile(
          this.label('Avg risk / reward') +
          this.figure(rr === null ? '—' : this.fmt(rr, 2, ':1')) +
          this.sub(rr === null ? 'no winner has reported its R' : 'realised, across tabs')
        )}
      </div>
    `;
  }

  /**
   * Render per-tab performance
   */
  renderTabsPerformance(byTab) {
    const rows = Object.entries(byTab).filter(([, p]) => p && p.dataPoints > 0);

    let html = `<div style="margin-bottom:14px;">`
      + this.heading('Performance by tab', rows.length ? `${rows.length} with settled outcomes` : '');

    if (!rows.length) {
      html += `<div style="font-size:11px;color:var(--mut,#536175);background:var(--panel2,#edf1f6);
        border:1px dashed var(--line-strong,#aab7c8);border-radius:var(--radius-sm,6px);padding:10px 12px;">
        No tab has a settled outcome yet. A forward record cannot resolve until bars after its firing bar
        exist, so a young log is correctly all-open.</div></div>`;
      return html;
    }

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">`;

    for (const [tabName, perf] of rows) {
      const wr = this.num(perf.winRate);
      const rr = this.num(perf.avgRiskReward);
      html += this.tile(
        `<div style="font-weight:700;font-size:11px;margin-bottom:4px;color:var(--txt,#172033);">${tabName}</div>
         <div style="display:flex;justify-content:space-between;gap:8px;font-size:10px;
           font-family:var(--mono,monospace);font-variant-numeric:tabular-nums;color:var(--mut,#536175);">
           <span>WR <b style="color:${this.wrColor(wr)};">${wr === null ? '—' : this.fmt(wr, 1, '%')}</b></span>
           <span>R:R <b style="color:var(--txt,#172033);">${rr === null ? '—' : this.fmt(rr, 2)}</b></span>
           <span>${perf.closedSetups}/${perf.totalSetups}</span>
         </div>`,
        this.wrColor(wr)
      );
    }

    html += `</div></div>`;
    return html;
  }

  /**
   * Render consensus signals
   */
  renderConsensusSignals(consensus) {
    if (consensus.length === 0) {
      return `<div style="margin-bottom:14px;">`
        + this.heading('Consensus signals')
        + `<div style="font-size:11px;color:var(--mut,#536175);background:var(--panel2,#edf1f6);
          border:1px dashed var(--line-strong,#aab7c8);border-radius:var(--radius-sm,6px);padding:10px 12px;">
          No symbol is being called the same way by two or more tabs today.</div></div>`;
    }

    let html = `<div style="margin-bottom:14px;">`
      + this.heading('Consensus signals', `${consensus.length} · same symbol and direction across 2+ tabs`)
      + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">`;

    consensus.forEach(signal => {
      const long = String(signal.direction || '').toUpperCase().indexOf('LONG') === 0;
      const dirColor = long ? 'var(--long,#15803d)' : 'var(--short,#dc2626)';
      html += this.tile(
        `<div style="font-weight:700;font-size:11px;margin-bottom:3px;color:var(--txt,#172033);">
           ${signal.symbol} <span style="color:${dirColor};">${signal.direction}</span>
         </div>
         <div style="font-size:10px;font-family:var(--mono,monospace);color:var(--mut,#536175);margin-bottom:2px;">
           ${signal.tabCount} tabs agree
         </div>
         <div style="font-size:9px;color:var(--dim,#65758c);">${signal.tabs.join(' · ')}</div>`,
        dirColor
      );
    });

    html += `</div></div>`;
    return html;
  }

  /**
   * Render top performers
   */
  renderTopPerformers(topTabs) {
    if (!topTabs || !topTabs.length) {
      return `<div style="margin-bottom:14px;">`
        + this.heading('Top performers')
        + `<div style="font-size:11px;color:var(--mut,#536175);background:var(--panel2,#edf1f6);
          border:1px dashed var(--line-strong,#aab7c8);border-radius:var(--radius-sm,6px);padding:10px 12px;">
          Nothing to rank until a tab has settled outcomes.</div></div>`;
    }

    let html = `<div style="margin-bottom:14px;">`
      + this.heading('Top performers', 'ranked by settled win rate')
      /* Numbered because this IS a ranking — the position carries information.
         Medals did not: they implied a podium over what is often 1-3 tabs. */
      + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;">`;

    topTabs.forEach((tab, index) => {
      /* getTopPerformersAcrossAllTabs does parseFloat(perf.avgRiskReward), and
         that field is null whenever no winner has reported its R — which is
         independent of whether anything settled. The old code called
         .toFixed(2) on the resulting NaN and printed the string "NaN:1 R/R"
         as a measurement. Both figures now go through fmt(). */
      const wr = this.num(tab.winRate);
      const rr = this.num(tab.avgRiskReward);
      html += this.tile(
        `<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px;">
           <span style="font-family:var(--mono,monospace);font-size:10px;font-weight:700;
             color:var(--gold,#0f5cc0);">${index + 1}</span>
           <span style="font-size:11px;font-weight:700;color:var(--txt,#172033);">${tab.tabName}</span>
         </div>
         <div style="font-family:var(--mono,monospace);font-variant-numeric:tabular-nums;font-size:10px;
           color:var(--mut,#536175);line-height:1.6;">
           <div>win rate <b style="color:${this.wrColor(wr)};">${wr === null ? '—' : this.fmt(wr, 1, '%')}</b></div>
           <div>R:R <b style="color:var(--txt,#172033);">${rr === null ? '—' : this.fmt(rr, 2, ':1')}</b></div>
           <div style="color:var(--dim,#65758c);">${tab.closedSetups} settled</div>
         </div>`
      );
    });

    html += `</div></div>`;
    return html;
  }

  /**
   * Render insights
   */
  renderInsights(insights) {
    let inner = this.heading('Daily insights');

    if (!insights || insights.length === 0) {
      inner += `<div style="font-size:11px;color:var(--mut,#536175);">
        Nothing to report yet — insights are derived from settled outcomes.</div>`;
    } else {
      insights.forEach(insight => {
        inner += `<div style="font-size:11px;color:var(--txt,#172033);margin-bottom:4px;
          padding-left:12px;text-indent:-12px;">· ${insight}</div>`;
      });
    }

    return this.tile(inner, 'var(--gold, #0f5cc0)');
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
