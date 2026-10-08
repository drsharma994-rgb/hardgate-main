/* =========================================================================
   HARDGATE Conviction System - Bootstrap & Initialization

   This file initializes and connects all 4 phases into the main HARDGATE
   application. It hooks into existing HARDGATE architecture and starts
   the conviction-driven trading system.

   Usage: Load this in your main HARDGATE initialization (hghost.js)
   ========================================================================= */
'use strict';

class HardgateConvictionBootstrap {
  constructor(window_context) {
    this.W = window_context || window;
    this.system = null;
    this.optimizer = null;
    this.initialized = false;
  }

  /**
   * Initialize the complete conviction system
   * Call this once on app startup
   */
  async initialize() {
    if (this.initialized) {
      console.log('[Bootstrap] Already initialized');
      return;
    }

    console.log('[Bootstrap] 🚀 Starting HARDGATE Conviction System...');

    try {
      // Load Phase 3: Conviction System
      const ConvictionSystem = require('./hardgate-conviction-system.js');
      this.system = new ConvictionSystem();
      await this.system.initialize();
      console.log('[Bootstrap] ✅ Phase 3: Conviction System initialized');

      // Load Phase 4: Optimizer
      const Optimizer = require('./hardgate-conviction-optimizer.js');
      this.optimizer = new Optimizer(this.system);
      await this.optimizer.initialize();
      console.log('[Bootstrap] ✅ Phase 4: Optimizer initialized');

      // Expose to global scope for debugging
      this.W.HG_CONVICTION_SYSTEM = this.system;
      this.W.HG_CONVICTION_OPTIMIZER = this.optimizer;

      // Hook into tab signals
      this.hookIntoTabSignals();

      // Start UI updates
      this.startUIUpdates();

      // Start auto-trading
      this.startAutoTrading();

      console.log('[Bootstrap] ✅ HARDGATE Conviction System LIVE');
      this.initialized = true;

      return {
        status: 'ready',
        system: this.system,
        optimizer: this.optimizer,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[Bootstrap] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Hook into all HARDGATE tab signals
   */
  hookIntoTabSignals() {
    console.log('[Bootstrap] Hooking into tab signals...');

    // GOLD ULTRA
    const onGUSignal = async () => {
      await this.processTabSignals('GOLD_ULTRA', this.W.GU_SIGNALS);
    };
    this.W.GU_ON_SIGNAL = onGUSignal;

    // OMNIGOLD
    const onOmniSignal = async () => {
      await this.processTabSignals('OMNIGOLD', this.W.OMNIGOLD);
    };
    this.W.OMNIGOLD_ON_SIGNAL = onOmniSignal;

    // CRYPTO SCAN
    const onCSSignal = async () => {
      await this.processTabSignals('CRYPTO_SCAN', this.W.CS_DATA);
    };
    this.W.CS_ON_SIGNAL = onCSSignal;

    // CRYPTO ULTRA
    const onCUSignal = async () => {
      await this.processTabSignals('CRYPTO_ULTRA', this.W.CU_SIGNALS);
    };
    this.W.CU_ON_SIGNAL = onCUSignal;

    // FORMATIONS
    const onFormSignal = async () => {
      await this.processTabSignals('FORMATIONS', this.W.FORMATIONS);
    };
    this.W.FORMATIONS_ON_SIGNAL = onFormSignal;

    // OMNIROUTE
    const onRouteSignal = async () => {
      await this.processTabSignals('OMNIROUTE', this.W.OMNIROUTE);
    };
    this.W.OMNIROUTE_ON_SIGNAL = onRouteSignal;

    console.log('[Bootstrap] ✅ Tab hooks connected');
  }

  /**
   * Process signals from a tab
   */
  async processTabSignals(tabName, tabData) {
    try {
      const result = await this.system.processTabs({
        [tabName]: tabData,
        // Also include other tabs if available for consensus
        GOLD_ULTRA: this.W.GU_SIGNALS,
        OMNIGOLD: this.W.OMNIGOLD,
        CRYPTO_SCAN: this.W.CS_DATA,
        FORMATIONS: this.W.FORMATIONS
      });

      if (result.activeSignals.length > 0) {
        console.log(`[Bootstrap] ${tabName}: ${result.activeSignals.length} signals, ${result.consensusSignals.length} consensus`);

        // Execute trades
        const trades = await this.system.executeConvictionTrades(this.W.ACCOUNT_BALANCE || 100000);

        if (trades.executed.length > 0) {
          console.log(`[Bootstrap] Executed ${trades.executed.length} trades`);

          // Record trades in optimizer
          trades.executed.forEach(trade => {
            this.optimizer.recordTrade({
              symbol: trade.symbol,
              side: trade.side,
              entryPrice: parseFloat(trade.riskDollars), // Simplified for demo
              exitPrice: 0,
              pnl: 0,
              conviction: parseFloat(trade.conviction),
              tier: 'UNKNOWN',
              tabName: trade.tabName,
              timestamp: trade.timestamp
            });
          });
        }
      }

    } catch (error) {
      console.error(`[Bootstrap] Error processing ${tabName}:`, error);
    }
  }

  /**
   * Start UI updates (dashboards)
   */
  startUIUpdates() {
    // Update conviction dashboard every 30 seconds
    setInterval(() => {
      try {
        const convictionReport = this.system.generateHTMLReport();
        const element = document.getElementById('hg-conviction-dashboard');
        if (element) {
          element.innerHTML = convictionReport;
        }
      } catch (error) {
        console.warn('[Bootstrap] Conviction dashboard update failed:', error);
      }
    }, 30000);

    // Update optimizer dashboard every 5 minutes
    setInterval(() => {
      try {
        const optimizerReport = this.optimizer.generateHTMLReport();
        const element = document.getElementById('hg-optimizer-dashboard');
        if (element) {
          element.innerHTML = optimizerReport;
        }
      } catch (error) {
        console.warn('[Bootstrap] Optimizer dashboard update failed:', error);
      }
    }, 300000);

    console.log('[Bootstrap] ✅ UI updates started');
  }

  /**
   * Start auto-trading
   */
  startAutoTrading() {
    // Periodically check all tabs for signals
    setInterval(() => {
      try {
        // Check if any tab has new signals
        if (this.W.GU_SIGNALS) this.processTabSignals('GOLD_ULTRA', this.W.GU_SIGNALS);
        if (this.W.OMNIGOLD) this.processTabSignals('OMNIGOLD', this.W.OMNIGOLD);
        if (this.W.CS_DATA) this.processTabSignals('CRYPTO_SCAN', this.W.CS_DATA);
      } catch (error) {
        console.error('[Bootstrap] Auto-trading error:', error);
      }
    }, 60000); // Every minute

    console.log('[Bootstrap] ✅ Auto-trading started');
  }

  /**
   * Get current status
   */
  getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    const systemState = this.system.getState();
    const optimizerMetrics = this.optimizer.getMetrics();

    return {
      status: 'ready',
      system: {
        activeSignals: systemState.activeSignals.length,
        consensusSignals: systemState.consensusSignals.length,
        lastUpdate: systemState.lastUpdate
      },
      optimizer: {
        tradesProcessed: optimizerMetrics.tradesExecuted,
        winRate: this.optimizer.performance.overall.winRate.toFixed(2),
        profitFactor: this.optimizer.performance.overall.profitFactor.toFixed(2)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get HTML snippet for embedding in UI
   */
  getUISnippet() {
    return `
    <!-- HARDGATE Conviction System Dashboards -->
    <div id="hg-conviction-dashboards" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px;">

      <div id="hg-conviction-dashboard" style="background: #0f1419; color: #e8ecef; padding: 12px; border-radius: 6px; border: 1px solid #3a4556; max-height: 600px; overflow-y: auto;">
        <p style="text-align: center; color: #ffd700;">Loading conviction dashboard...</p>
      </div>

      <div id="hg-optimizer-dashboard" style="background: #0f1419; color: #e8ecef; padding: 12px; border-radius: 6px; border: 1px solid #3a4556; max-height: 600px; overflow-y: auto;">
        <p style="text-align: center; color: #ffd700;">Loading optimizer dashboard...</p>
      </div>

    </div>

    <style>
      #hg-conviction-dashboards table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; }
      #hg-conviction-dashboards th { background: #242c3f; padding: 6px; text-align: left; border-bottom: 1px solid #3a4556; }
      #hg-conviction-dashboards td { padding: 6px; border-bottom: 1px solid #3a4556; }
      #hg-conviction-dashboards .green { color: #00d084; font-weight: bold; }
      #hg-conviction-dashboards .yellow { color: #ffd700; font-weight: bold; }
      #hg-conviction-dashboards .red { color: #ff4444; font-weight: bold; }
      #hg-conviction-dashboards h2, #hg-conviction-dashboards h3 { margin: 8px 0 6px 0; font-size: 13px; }
      #hg-conviction-dashboards p { margin: 4px 0; }
    </style>
    `;
  }

  /**
   * Shutdown system
   */
  shutdown() {
    console.log('[Bootstrap] Shutting down...');
    this.initialized = false;
    // Add cleanup code here
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateConvictionBootstrap;
}

// Auto-initialize if loaded in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const bootstrap = new HardgateConvictionBootstrap(window);
      await bootstrap.initialize();

      // Make available globally
      window.HG_BOOTSTRAP = bootstrap;

      console.log('[Bootstrap] ✅ HARDGATE Conviction System is LIVE');
      console.log('[Bootstrap] Status:', bootstrap.getStatus());

    } catch (error) {
      console.error('[Bootstrap] Failed to initialize:', error);
    }
  });
}
