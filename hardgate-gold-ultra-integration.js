/* =========================================================================
   HARDGATE GOLD ULTRA - Setup Intelligence Integration

   Integrates GOLD ULTRA tab with the Setup Intelligence System.
   Records every GOLD ULTRA setup, tracks outcomes, provides insights.

   Usage: This runs within GOLD ULTRA tab context
   ========================================================================= */
'use strict';

class HardgateGoldUltraIntegration {
  constructor(W) {
    this.W = W || window;
    this.integration = null;
    this.currentSetupId = null;
    this.activeSetups = new Map();
    this.initialized = false;
  }

  /**
   * Initialize GOLD ULTRA integration
   * Call once when GOLD ULTRA tab loads
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[GOLD ULTRA-Integration] Initializing Setup Intelligence...');

    // Wait for base integration template
    const maxWait = 5000;
    const startTime = Date.now();
    while (!this.W.HardgateTabIntegration && Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 100));
    }

    if (!this.W.HardgateTabIntegration) {
      console.warn('[GOLD ULTRA-Integration] Tab integration template not available');
      return;
    }

    // Create integration instance
    this.integration = new this.W.HardgateTabIntegration('GOLD ULTRA', this.W);
    await this.integration.initialize();

    // Hook into GOLD ULTRA signal generation
    this.hookIntoGoldUltraSignals();

    console.log('[GOLD ULTRA-Integration] ✅ Ready');
    this.initialized = true;
  }

  /**
   * Hook into GOLD ULTRA's signal generation
   * This connects to where GOLD ULTRA identifies setup candidates
   */
  hookIntoGoldUltraSignals() {
    // Save original GOLD ULTRA signal handler (if it exists)
    const originalOnSignal = this.W.onGoldUltraSignal || (() => {});

    // Replace with hooked version
    this.W.onGoldUltraSignal = async (signalData) => {
      // Call original handler
      await originalOnSignal(signalData);

      // Record setup if signal qualifies
      if (this.isQualifyingSignal(signalData)) {
        this.onSetupFormed(signalData);
      }
    };

    console.log('[GOLD ULTRA-Integration] Signals hooked');
  }

  /**
   * Determine if a signal qualifies as a recordable setup
   */
  isQualifyingSignal(signalData) {
    // Only record signals that:
    // 1. Have complete price levels (entry, SL, TP)
    // 2. Are not just exploratory signals
    // 3. Pass basic validation

    return signalData &&
      signalData.symbol &&
      signalData.entryPrice &&
      signalData.stopLoss &&
      (signalData.tp1 || signalData.takeProfit1);
  }

  /**
   * Called when GOLD ULTRA identifies a new setup
   */
  onSetupFormed(signalData) {
    if (!this.initialized || !this.integration) {
      console.warn('[GOLD ULTRA-Integration] Not initialized');
      return;
    }

    // Extract GOLD ULTRA specific metadata
    const pattern = this.determinePattern(signalData);
    const confidence = this.calculateConfidence(signalData);
    const tier = this.determineTier(signalData);
    const indicators = this.extractIndicators(signalData);

    // Build setup data
    const setupData = {
      symbol: signalData.symbol,
      direction: signalData.direction || signalData.signal,
      entryPrice: parseFloat(signalData.entryPrice),
      stopLoss: parseFloat(signalData.stopLoss),
      tp1: parseFloat(signalData.tp1 || signalData.takeProfit1 || 0),
      tp2: parseFloat(signalData.tp2 || signalData.takeProfit2 || 0),
      pattern: pattern,
      confidence: confidence,
      tier: tier,
      indicators: indicators,
      notes: signalData.notes || ''
    };

    // Record in intelligence system
    const setup = this.integration.recordSetup(setupData);

    if (setup) {
      this.currentSetupId = setup.id;
      this.activeSetups.set(setup.id, {
        symbol: signalData.symbol,
        entryPrice: setupData.entryPrice,
        tp1: setupData.tp1,
        tp2: setupData.tp2,
        stopLoss: setupData.stopLoss,
        recordedAt: new Date()
      });

      // Log to UI if available
      this.logSetupToUI(setup);
    }
  }

  /**
   * Determine setup pattern from GOLD ULTRA signal
   */
  determinePattern(signalData) {
    // GOLD ULTRA specific pattern detection
    // Adjust these based on actual GOLD ULTRA pattern names

    if (signalData.rsiDivergence) return 'RSI_DIVERGENCE';
    if (signalData.priceBreakout) return 'BREAKOUT';
    if (signalData.movingAverageCross) return 'MOVING_AVERAGE_CROSS';
    if (signalData.supportResistance) return 'SUPPORT_RESISTANCE';
    if (signalData.volumeSpike) return 'VOLUME_SPIKE';
    if (signalData.consolidationBreak) return 'CONSOLIDATION_BREAK';

    return signalData.pattern || 'UNCLASSIFIED';
  }

  /**
   * Calculate setup confidence from GOLD ULTRA indicators
   */
  calculateConfidence(signalData) {
    // GOLD ULTRA has a voting system
    // Map vote count to confidence 0-1

    let confidence = 0.5; // Default

    if (signalData.voteCount !== undefined) {
      // e.g. 5 of 8 indicators agree
      confidence = signalData.voteCount / (signalData.totalIndicators || 8);
    }

    if (signalData.confidence !== undefined) {
      // Or use provided confidence
      confidence = Math.min(1, Math.max(0, parseFloat(signalData.confidence)));
    }

    // Adjust for signal strength
    if (signalData.strongSignal) confidence = Math.min(1, confidence + 0.1);
    if (signalData.weakSignal) confidence = Math.max(0, confidence - 0.1);

    return confidence;
  }

  /**
   * Determine tier based on GOLD ULTRA classification
   */
  determineTier(signalData) {
    // GOLD ULTRA tier classification
    if (signalData.tier) return signalData.tier;

    // Or derive from confidence
    const conf = this.calculateConfidence(signalData);
    if (conf >= 0.85) return 'PROFESSIONAL-GRADE';
    if (conf >= 0.7) return 'PROFESSIONAL';
    return 'STANDARD';
  }

  /**
   * Extract indicators that triggered the setup
   */
  extractIndicators(signalData) {
    const indicators = [];

    // GOLD ULTRA standard indicators
    if (signalData.rsi !== undefined) indicators.push('RSI');
    if (signalData.macd !== undefined) indicators.push('MACD');
    if (signalData.bollingerBands !== undefined) indicators.push('BOLLINGER_BANDS');
    if (signalData.movingAverages !== undefined) indicators.push('MOVING_AVERAGES');
    if (signalData.volume !== undefined) indicators.push('VOLUME');
    if (signalData.stochastic !== undefined) indicators.push('STOCHASTIC');

    return indicators.length > 0 ? indicators : (signalData.indicators || []);
  }

  /**
   * Called when GOLD ULTRA signal reaches TP1
   */
  onTP1HitInGoldUltra(setupId, exitPrice) {
    if (!this.integration) return;

    this.integration.onTP1Hit(setupId, parseFloat(exitPrice));
    this.activeSetups.delete(setupId);
    this.logOutcomeToUI(setupId, 'TP1_HIT');
  }

  /**
   * Called when GOLD ULTRA signal reaches TP2
   */
  onTP2HitInGoldUltra(setupId, exitPrice) {
    if (!this.integration) return;

    this.integration.onTP2Hit(setupId, parseFloat(exitPrice));
    this.activeSetups.delete(setupId);
    this.logOutcomeToUI(setupId, 'TP2_HIT');
  }

  /**
   * Called when GOLD ULTRA signal hits stop loss
   */
  onStopLossHitInGoldUltra(setupId, exitPrice) {
    if (!this.integration) return;

    this.integration.onStopLossHit(setupId, parseFloat(exitPrice));
    this.activeSetups.delete(setupId);
    this.logOutcomeToUI(setupId, 'SL_HIT');
  }

  /**
   * Get GOLD ULTRA tab performance summary
   */
  getPerformanceSummary() {
    if (!this.integration) return null;

    const perf = this.integration.getTabPerformance();
    const topPatterns = this.integration.getTopPatterns(3);
    const insights = this.integration.getInsights();

    return {
      tabName: 'GOLD ULTRA',
      performance: perf,
      topPatterns: topPatterns,
      insights: insights,
      activeSetups: this.activeSetups.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get recommended action based on GOLD ULTRA data
   */
  getRecommendedAction(signalData) {
    if (!this.integration) return null;

    const pattern = this.determinePattern(signalData);
    const isReliable = this.integration.isPatternReliable(pattern);

    if (isReliable.reliable) {
      return {
        action: 'PROCEED',
        pattern: pattern,
        confidence: isReliable.winRate,
        reason: `Pattern has ${isReliable.winRate} historical win rate`
      };
    }

    return {
      action: 'CAUTION',
      pattern: pattern,
      reason: isReliable.reason,
      dataPoints: isReliable.dataPoints
    };
  }

  /**
   * Log setup event to UI
   */
  logSetupToUI(setup) {
    // Post to UI element if it exists
    const logElement = this.W.document?.getElementById('gold-ultra-setup-log');
    if (logElement) {
      const entry = document.createElement('div');
      entry.className = 'setup-log-entry';
      entry.innerHTML = `
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        <span class="symbol">${setup.symbol}</span>
        <span class="direction ${setup.direction.toLowerCase()}">${setup.direction}</span>
        <span class="pattern">${setup.pattern}</span>
        <span class="confidence">${(setup.confidence * 100).toFixed(0)}%</span>
      `;
      logElement.insertBefore(entry, logElement.firstChild);
    }

    console.log('[GOLD ULTRA-Integration] Setup recorded:', setup.symbol, setup.direction);
  }

  /**
   * Log outcome to UI
   */
  logOutcomeToUI(setupId, outcome) {
    const logElement = this.W.document?.getElementById('gold-ultra-outcome-log');
    if (logElement) {
      const entry = document.createElement('div');
      entry.className = 'outcome-log-entry ' + outcome.toLowerCase();
      entry.innerHTML = `
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        <span class="outcome">${outcome}</span>
      `;
      logElement.insertBefore(entry, logElement.firstChild);
    }

    console.log('[GOLD ULTRA-Integration] Outcome:', outcome);
  }

  /**
   * Export GOLD ULTRA setup data for backup
   */
  exportSetupData() {
    if (!this.integration) return null;
    return this.integration.exportData();
  }
}

// Auto-initialize if loaded in GOLD ULTRA context
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const goldUltraIntegration = new HardgateGoldUltraIntegration(window);
      await goldUltraIntegration.initialize();

      // Make available globally
      window.HG_GOLD_ULTRA_INTEGRATION = goldUltraIntegration;

      console.log('[GOLD ULTRA-Integration] ✅ GOLD ULTRA Setup Intelligence READY');

    } catch (error) {
      console.error('[GOLD ULTRA-Integration] Initialization failed:', error);
    }
  });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateGoldUltraIntegration;
}

if (typeof window !== 'undefined') {
  window.HardgateGoldUltraIntegration = HardgateGoldUltraIntegration;
}
