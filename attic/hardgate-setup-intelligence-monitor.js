/* =========================================================================
   HARDGATE Setup Intelligence - Live Monitoring & Alerts

   Real-time monitoring of setup signals with alerts for:
   - High-conviction setups (threshold-based)
   - Consensus signals (2+ tabs agreeing)
   - Anomalies detected
   - Market condition changes
   - Win rate milestones

   Triggers browser notifications and logs.
   ========================================================================= */
'use strict';

class HardgateSetupIntelligenceMonitor {
  constructor(W) {
    this.W = W || window;
    this.factory = null;
    this.advanced = null;
    this.lastState = {};
    this.initialized = false;

    // Alert thresholds
    this.config = {
      highConvictionThreshold: 0.80,  // Alert if confidence >= 80%
      consensusThreshold: 2,           // Alert if 2+ tabs agree
      riskRewardMinimum: 1.5,          // Alert only if R/R >= 1.5:1
      checkInterval: 30000,            // Check every 30 seconds
      enableNotifications: true,
      enableConsoleLogging: true,
      enableUIAlerts: true
    };

    this.alerts = [];
    this.monitoringActive = false;
  }

  /**
   * Initialize monitoring
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[Monitor] Initializing Setup Intelligence Monitor...');

    // Wait for factory
    const maxWait = 5000;
    const startTime = Date.now();
    while (!this.W.HG_TABS_INTEGRATION_FACTORY && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 100));
    }

    this.factory = this.W.HG_TABS_INTEGRATION_FACTORY;
    if (!this.factory) {
      console.warn('[Monitor] Factory not available');
      return;
    }

    // Get advanced analytics
    if (this.W.HG_SETUP_INTELLIGENCE) {
      this.advanced = new this.W.HardgateSetupIntelligenceAdvanced(
        this.W.HG_SETUP_INTELLIGENCE
      );
    }

    // Request notification permission
    this.requestNotificationPermission();

    // Start monitoring loop
    this.startMonitoring();

    console.log('[Monitor] ✅ Monitor ready');
    this.initialized = true;
  }

  /**
   * Start monitoring loop
   */
  startMonitoring() {
    if (this.monitoringActive) return;

    this.monitoringActive = true;

    // Initial check
    this.checkForAlerts();

    // Periodic checks
    setInterval(() => {
      this.checkForAlerts();
    }, this.config.checkInterval);

    console.log('[Monitor] Monitoring started');
  }

  /**
   * Main monitoring loop
   */
  checkForAlerts() {
    if (!this.factory || !this.W.HG_SETUP_INTELLIGENCE) return;

    const report = this.factory.getUnifiedPerformanceReport();

    // Check for new consensus signals
    this.checkConsensusSignals(report.consensusSignals);

    // Check for high-conviction setups
    this.checkHighConvictionSetups();

    // Check for anomalies
    this.checkAnomalies();

    // Check for market condition changes
    this.checkMarketConditions();

    // Check for win rate milestones
    this.checkPerformanceMilestones(report.summary);
  }

  /**
   * Check for consensus signals (2+ tabs agreeing)
   */
  checkConsensusSignals(consensus) {
    for (const signal of consensus) {
      const key = `consensus_${signal.symbol}_${signal.direction}`;

      // Skip if already alerted
      if (this.lastState[key]) continue;

      this.lastState[key] = true;

      const message = `⭐ CONSENSUS: ${signal.symbol} ${signal.direction} (${signal.tabCount} tabs agree, avg conf: ${signal.avgConfidence})`;

      this.triggerAlert({
        type: 'CONSENSUS',
        severity: signal.tabCount >= 3 ? 'HIGH' : 'MEDIUM',
        symbol: signal.symbol,
        message: message,
        data: signal
      });
    }
  }

  /**
   * Check for high-conviction individual setups
   */
  checkHighConvictionSetups() {
    const engine = this.W.HG_SETUP_INTELLIGENCE;
    if (!engine) return;

    const today = engine.getTodaySetups();
    const open = today.filter(s => s.status === 'OPEN');

    for (const setup of open) {
      if (setup.confidence >= this.config.highConvictionThreshold &&
          setup.riskReward >= this.config.riskRewardMinimum) {

        const key = `highconv_${setup.id}`;
        if (this.lastState[key]) continue;

        this.lastState[key] = true;

        const message = `🚀 HIGH CONVICTION: ${setup.symbol} ${setup.direction} (${(setup.confidence * 100).toFixed(0)}% conf, ${setup.riskReward.toFixed(2)}:1 R/R)`;

        this.triggerAlert({
          type: 'HIGH_CONVICTION',
          severity: 'HIGH',
          symbol: setup.symbol,
          message: message,
          data: setup
        });
      }
    }
  }

  /**
   * Check for detected anomalies
   */
  checkAnomalies() {
    if (!this.advanced) return;

    const anomalies = this.advanced.detectAnomalies(2.5);

    for (const anomaly of anomalies) {
      const key = `anomaly_${anomaly.setupId}`;
      if (this.lastState[key]) continue;

      this.lastState[key] = true;

      const message = `⚠️ ANOMALY DETECTED: ${anomaly.symbol} ${anomaly.type} (z-score: ${anomaly.maxAnomalyScore})`;

      this.triggerAlert({
        type: 'ANOMALY',
        severity: 'MEDIUM',
        symbol: anomaly.symbol,
        message: message,
        data: anomaly
      });
    }
  }

  /**
   * Check for market condition changes
   */
  checkMarketConditions() {
    if (!this.advanced) return;

    const condition = this.advanced.detectMarketCondition();
    const lastCondition = this.lastState.marketCondition;

    if (condition !== lastCondition && condition !== 'INSUFFICIENT_DATA') {
      this.lastState.marketCondition = condition;

      let emoji = '📊';
      if (condition === 'TRENDING_UP') emoji = '📈';
      else if (condition === 'TRENDING_DOWN') emoji = '📉';
      else if (condition === 'VOLATILE') emoji = '⚡';

      const message = `${emoji} MARKET CONDITION CHANGED: ${condition}`;

      this.triggerAlert({
        type: 'MARKET_CONDITION',
        severity: 'INFO',
        message: message,
        data: { condition: condition }
      });
    }
  }

  /**
   * Check for performance milestones
   */
  checkPerformanceMilestones(summary) {
    const milestones = [50, 100, 150, 200];

    for (const milestone of milestones) {
      const key = `milestone_${milestone}`;
      if (this.lastState[key]) continue;

      if (summary.totalSetups >= milestone) {
        this.lastState[key] = true;

        const message = `🎯 MILESTONE: ${summary.totalSetups} total setups recorded (${summary.overallWinRate}% win rate)`;

        this.triggerAlert({
          type: 'MILESTONE',
          severity: 'LOW',
          message: message,
          data: summary
        });
      }
    }
  }

  /**
   * Trigger an alert
   */
  triggerAlert(alert) {
    alert.timestamp = new Date().toISOString();

    // Store alert
    this.alerts.unshift(alert);
    if (this.alerts.length > 100) {
      this.alerts.pop();  // Keep last 100 alerts
    }

    // Console log
    if (this.config.enableConsoleLogging) {
      const style = this.getAlertStyle(alert.severity);
      console.log(`%c[${alert.type}] ${alert.message}`, style);
    }

    // Browser notification
    if (this.config.enableNotifications && Notification.permission === 'granted') {
      this.sendNotification(alert);
    }

    // UI alert
    if (this.config.enableUIAlerts) {
      this.showUIAlert(alert);
    }
  }

  /**
   * Send browser notification
   */
  sendNotification(alert) {
    try {
      const icon = this.getAlertIcon(alert.type);
      new Notification(`HARDGATE: ${alert.type}`, {
        body: alert.message,
        icon: icon,
        tag: alert.type + '_' + Date.now(),
        requireInteraction: alert.severity === 'HIGH'
      });
    } catch (e) {
      console.warn('[Monitor] Notification failed:', e);
    }
  }

  /**
   * Show UI alert
   */
  showUIAlert(alert) {
    const container = document.getElementById('hg-monitor-alerts') ||
                      this.createAlertContainer();

    if (!container) return;

    const alertEl = document.createElement('div');
    alertEl.className = 'hg-monitor-alert';
    alertEl.style.cssText = `
      padding: 12px;
      margin-bottom: 8px;
      background: ${this.getAlertBackground(alert.severity)};
      border-left: 4px solid ${this.getAlertColor(alert.severity)};
      border-radius: 4px;
      font-size: 11px;
      animation: slideInRight 0.3s ease;
    `;

    const timestamp = new Date(alert.timestamp).toLocaleTimeString();
    alertEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
        <div style="flex: 1;">
          <div style="font-weight: bold; margin-bottom: 2px;">${alert.message}</div>
          <div style="font-size: 10px; color: #999;">${timestamp}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 12px;
        ">✕</button>
      </div>
    `;

    container.insertBefore(alertEl, container.firstChild);

    // Auto-remove low severity alerts after 10 seconds
    if (alert.severity === 'LOW') {
      setTimeout(() => {
        if (alertEl.parentElement) alertEl.remove();
      }, 10000);
    }
  }

  /**
   * Create alert container
   */
  createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'hg-monitor-alerts';
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 350px;
      max-height: 400px;
      overflow-y: auto;
      z-index: 10000;
    `;

    document.body.appendChild(container);
    return container;
  }

  /**
   * Get alert styling
   */
  getAlertColor(severity) {
    if (severity === 'HIGH') return '#ff6b6b';
    if (severity === 'MEDIUM') return '#ffd700';
    return '#00d084';
  }

  getAlertBackground(severity) {
    if (severity === 'HIGH') return '#ff6b6b22';
    if (severity === 'MEDIUM') return '#ffd70022';
    return '#00d08422';
  }

  getAlertIcon(type) {
    if (type === 'CONSENSUS') return '⭐';
    if (type === 'HIGH_CONVICTION') return '🚀';
    if (type === 'ANOMALY') return '⚠️';
    if (type === 'MARKET_CONDITION') return '📊';
    return '📢';
  }

  getAlertStyle(severity) {
    if (severity === 'HIGH') return 'color: #ff6b6b; font-weight: bold;';
    if (severity === 'MEDIUM') return 'color: #ffd700; font-weight: bold;';
    return 'color: #00d084;';
  }

  /**
   * Request notification permission
   */
  requestNotificationPermission() {
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 10) {
    return this.alerts.slice(0, limit);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      monitoringActive: this.monitoringActive,
      totalAlerts: this.alerts.length,
      recentAlerts: this.getRecentAlerts(3),
      timestamp: new Date().toISOString()
    };
  }
}

// Auto-initialize
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const monitor = new HardgateSetupIntelligenceMonitor(window);
      await monitor.initialize();

      window.HG_SETUP_INTELLIGENCE_MONITOR = monitor;
      console.log('[Monitor] ✅ Setup Intelligence Monitor LIVE');

    } catch (error) {
      console.error('[Monitor] Initialization failed:', error);
    }
  });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateSetupIntelligenceMonitor;
}

if (typeof window !== 'undefined') {
  window.HardgateSetupIntelligenceMonitor = HardgateSetupIntelligenceMonitor;
}
