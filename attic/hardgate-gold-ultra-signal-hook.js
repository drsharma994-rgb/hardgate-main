/* =========================================================================
   HARDGATE GOLD ULTRA - Real Signal Integration Hook

   Hooks directly into GOLD ULTRA's signal generation to capture
   real-time setups and automatically record them in the intelligence system.

   This integrates at the point where GOLD ULTRA forms signals.
   ========================================================================= */
'use strict';

class HardgateGoldUltraSignalHook {
  constructor(W) {
    this.W = W || window;
    this.integration = null;
    this.setupCache = new Map();  // Keep track of active setups
    this.initialized = false;
  }

  /**
   * Initialize the signal hook
   * Call this when GOLD ULTRA tab loads
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[GOLD ULTRA-SignalHook] Initializing...');

    // Wait for integration to be ready
    const maxWait = 5000;
    const startTime = Date.now();
    while (!this.W.HG_GOLD_ULTRA_INTEGRATION && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 100));
    }

    if (!this.W.HG_GOLD_ULTRA_INTEGRATION) {
      console.warn('[GOLD ULTRA-SignalHook] Integration not available');
      return;
    }

    this.integration = this.W.HG_GOLD_ULTRA_INTEGRATION;

    // Hook into signal generation
    this.hookIntoSignalGeneration();

    console.log('[GOLD ULTRA-SignalHook] ✅ Ready');
    this.initialized = true;
  }

  /**
   * Hook into GOLD ULTRA's signal generation
   * This intercepts signals as they're created
   */
  hookIntoSignalGeneration() {
    console.log('[GOLD ULTRA-SignalHook] Hooking into signal generation...');

    // Save original functions (if they exist)
    const originalOnSignal = this.W.onGoldSignal;
    const originalExecuteSetup = this.W.executeGoldSetup;

    // Hook: When GOLD ULTRA generates a signal
    this.W.onGoldSignal = async (signalData) => {
      // Call original handler first
      if (originalOnSignal) await originalOnSignal(signalData);

      // Record in intelligence system
      this.recordGoldSignal(signalData);
    };

    // Hook: When signal is executed
    this.W.executeGoldSetup = async (setupData) => {
      // Call original handler first
      if (originalExecuteSetup) await originalExecuteSetup(setupData);

      // Track execution
      this.trackGoldSetupExecution(setupData);
    };

    // Hook: When price targets are hit
    this.hookPriceTargets();

    console.log('[GOLD ULTRA-SignalHook] Signal hooks installed');
  }

  /**
   * Record a GOLD ULTRA signal
   */
  recordGoldSignal(signalData) {
    if (!this.initialized || !this.integration) return;

    // Validate signal
    if (!signalData || !signalData.symbol) return;

    console.log('[GOLD ULTRA-SignalHook] Signal detected:', signalData.symbol, signalData.direction);

    // Prepare setup data for intelligence system
    const setupData = {
      symbol: signalData.symbol,
      direction: signalData.direction || signalData.side,
      entryPrice: parseFloat(signalData.currentPrice || signalData.close),
      stopLoss: parseFloat(signalData.stopLoss),
      tp1: parseFloat(signalData.tp1 || signalData.target1),
      tp2: parseFloat(signalData.tp2 || signalData.target2),

      pattern: this.extractPattern(signalData),
      confidence: this.extractConfidence(signalData),
      tier: this.extractTier(signalData),
      indicators: this.extractIndicators(signalData),
      notes: this.extractNotes(signalData)
    };

    // Record in intelligence system
    const setup = this.integration.recordSetup(setupData);

    if (setup) {
      // Cache locally
      this.setupCache.set(setup.id, {
        symbol: setup.symbol,
        direction: setup.direction,
        entryPrice: setup.entryPrice,
        tp1: setup.takeProfit1,
        tp2: setup.takeProfit2,
        sl: setup.stopLoss,
        recordedAt: new Date(),
        signalData: signalData
      });

      // Trigger UI update
      this.updateSignalUI(setup);
    }
  }

  /**
   * Extract pattern from GOLD ULTRA signal
   */
  extractPattern(signalData) {
    if (signalData.pattern) return signalData.pattern;

    // Map GOLD ULTRA patterns
    if (signalData.rsiDivergence) return 'RSI_DIVERGENCE';
    if (signalData.macdCross) return 'MACD_CROSS';
    if (signalData.bbandBreakout) return 'BOLLINGER_BAND_BREAKOUT';
    if (signalData.smaBreakout) return 'MOVING_AVERAGE_BREAKOUT';
    if (signalData.volumeSpike) return 'VOLUME_SPIKE';

    return 'GOLD_ULTRA_SIGNAL';
  }

  /**
   * Extract confidence from GOLD ULTRA
   */
  extractConfidence(signalData) {
    if (signalData.confidence !== undefined) {
      return Math.min(1, Math.max(0, parseFloat(signalData.confidence)));
    }

    // From voting system (N of M agree)
    if (signalData.voteCount !== undefined && signalData.totalIndicators !== undefined) {
      return signalData.voteCount / signalData.totalIndicators;
    }

    // Default confidence
    return 0.65;
  }

  /**
   * Extract tier from GOLD ULTRA
   */
  extractTier(signalData) {
    if (signalData.tier) return signalData.tier;

    const conf = this.extractConfidence(signalData);
    if (conf >= 0.85) return 'PROFESSIONAL-GRADE';
    if (conf >= 0.70) return 'PROFESSIONAL';
    return 'STANDARD';
  }

  /**
   * Extract indicator list
   */
  extractIndicators(signalData) {
    if (signalData.indicators && Array.isArray(signalData.indicators)) {
      return signalData.indicators;
    }

    const indicators = [];
    if (signalData.rsi !== undefined) indicators.push('RSI');
    if (signalData.macd !== undefined) indicators.push('MACD');
    if (signalData.bbands !== undefined) indicators.push('BOLLINGER_BANDS');
    if (signalData.sma !== undefined) indicators.push('SMA');
    if (signalData.volume !== undefined) indicators.push('VOLUME');
    if (signalData.stoch !== undefined) indicators.push('STOCHASTIC');

    return indicators;
  }

  /**
   * Extract notes
   */
  extractNotes(signalData) {
    if (signalData.notes) return signalData.notes;

    const parts = [];
    if (signalData.voteCount) parts.push(`${signalData.voteCount}/${signalData.totalIndicators} votes`);
    if (signalData.strength) parts.push(`strength: ${signalData.strength}`);
    if (signalData.regime) parts.push(`regime: ${signalData.regime}`);

    return parts.join(', ');
  }

  /**
   * Hook into price target monitoring
   */
  hookPriceTargets() {
    // This would hook into GOLD ULTRA's real-time price checking
    // For now, expose a method that can be called when targets are hit

    this.W.onGoldTP1Hit = (symbol, price) => {
      this.trackTargetHit(symbol, 'TP1', price);
    };

    this.W.onGoldTP2Hit = (symbol, price) => {
      this.trackTargetHit(symbol, 'TP2', price);
    };

    this.W.onGoldSLHit = (symbol, price) => {
      this.trackTargetHit(symbol, 'SL', price);
    };

    console.log('[GOLD ULTRA-SignalHook] Target hit hooks available');
  }

  /**
   * Track when a target or stop is hit
   */
  trackTargetHit(symbol, type, price) {
    if (!this.initialized) return;

    console.log('[GOLD ULTRA-SignalHook] Target hit:', symbol, type, 'at', price);

    // Find setup in cache
    for (const [setupId, setup] of this.setupCache) {
      if (setup.symbol === symbol) {
        // Match target
        let outcome = null;
        if (type === 'TP1') outcome = 'TP1_HIT';
        else if (type === 'TP2') outcome = 'TP2_HIT';
        else if (type === 'SL') outcome = 'SL_HIT';

        if (outcome && this.integration) {
          this.integration.trackOutcome(setupId, {
            type: outcome,
            exitPrice: price
          });

          // Remove from cache
          this.setupCache.delete(setupId);

          // Update UI
          this.updateOutcomeUI(symbol, outcome);
        }
        break;
      }
    }
  }

  /**
   * Track setup execution
   */
  trackGoldSetupExecution(setupData) {
    console.log('[GOLD ULTRA-SignalHook] Setup executed:', setupData.symbol);
    // Setup already recorded in recordGoldSignal
  }

  /**
   * Update UI with new signal
   */
  updateSignalUI(setup) {
    const logElement = this.W.document?.getElementById('hg-gold-ultra-signal-log');
    if (logElement) {
      const entry = document.createElement('div');
      entry.className = 'hg-signal-entry';
      entry.setAttribute('data-setup-id', setup.id);
      entry.style.cssText = `
        padding: 8px;
        margin-bottom: 4px;
        background: #1a2235;
        border-left: 3px solid #ffd700;
        border-radius: 2px;
        font-size: 11px;
      `;
      entry.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold;">${setup.symbol}</span>
          <span style="color: ${setup.direction === 'LONG' ? '#00d084' : '#ff6b6b'};">${setup.direction}</span>
          <span style="color: #ffd700;">${(setup.confidence * 100).toFixed(0)}%</span>
          <span style="font-size: 10px; color: #999;">${new Date().toLocaleTimeString()}</span>
        </div>
      `;
      logElement.insertBefore(entry, logElement.firstChild);
    }
  }

  /**
   * Update UI with outcome
   */
  updateOutcomeUI(symbol, outcome) {
    const logElement = this.W.document?.getElementById('hg-gold-ultra-outcome-log');
    if (logElement) {
      const entry = document.createElement('div');
      entry.className = 'hg-outcome-entry';
      entry.style.cssText = `
        padding: 6px;
        margin-bottom: 4px;
        background: ${outcome === 'SL_HIT' ? '#ff6b6b40' : '#00d08440'};
        border-left: 3px solid ${outcome === 'SL_HIT' ? '#ff6b6b' : '#00d084'};
        border-radius: 2px;
        font-size: 10px;
      `;
      entry.innerHTML = `
        <span style="font-weight: bold;">${symbol}</span>
        <span style="margin-left: 8px;">${outcome}</span>
        <span style="margin-left: 8px; color: #999;">${new Date().toLocaleTimeString()}</span>
      `;
      logElement.insertBefore(entry, logElement.firstChild);
    }
  }

  /**
   * Get active setups
   */
  getActiveSetups() {
    return Array.from(this.setupCache.values());
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activeSetups: this.setupCache.size,
      timestamp: new Date().toISOString()
    };
  }
}

// Auto-initialize
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const hook = new HardgateGoldUltraSignalHook(window);
      await hook.initialize();

      window.HG_GOLD_ULTRA_SIGNAL_HOOK = hook;
      console.log('[GOLD ULTRA-SignalHook] ✅ GOLD ULTRA Signal Hook LIVE');

    } catch (error) {
      console.error('[GOLD ULTRA-SignalHook] Initialization failed:', error);
    }
  });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateGoldUltraSignalHook;
}

if (typeof window !== 'undefined') {
  window.HardgateGoldUltraSignalHook = HardgateGoldUltraSignalHook;
}
