/* =========================================================================
   HARDGATE Setup Intelligence - Active Recording Activation
   Manually start setup recording and monitoring
   ========================================================================= */

(function() {
  'use strict';

  function activateSetupRecording() {
    if (!window.HardgateSetupIntelligence) {
      console.warn('[Recording] Setup Intelligence not yet loaded');
      setTimeout(activateSetupRecording, 1000);
      return;
    }

    console.log('[Recording] 🔴 ACTIVATING SETUP INTELLIGENCE RECORDING...');

    const engine = window.HardgateSetupIntelligence;

    // Ensure recording is enabled
    engine.config.enableAutoRecording = true;
    engine.config.trackingIntervalMs = 300000; // 5 minutes for faster detection

    // Initialize if not already done
    if (!engine.initialized) {
      engine.initialize().then(() => {
        console.log('[Recording] ✅ Setup Intelligence Engine initialized and recording');
      });
    }

    // Start recording demo setups immediately
    const demoSetups = [
      { symbol: 'GOLD', tabName: 'GOLD ULTRA', direction: 'LONG', pattern: 'EMA_CASCADE', entryPrice: 2050, stopLoss: 2040, takeProfit1: 2060, takeProfit2: 2070, confidence: 0.85, tier: 'HIGH_CONVICTION', indicators: ['EMA9', 'EMA21', 'EMA50'] },
      { symbol: 'BTC/USDT', tabName: 'CRYPTO ULTRA', direction: 'SHORT', pattern: 'RSI_DIVERGENCE', entryPrice: 42500, stopLoss: 43000, takeProfit1: 41500, takeProfit2: 40500, confidence: 0.75, tier: 'STANDARD', indicators: ['RSI', 'MACD'] },
      { symbol: 'ETH/USDT', tabName: 'CRYPTO SCAN', direction: 'LONG', pattern: 'VOLUME_SPIKE', entryPrice: 2250, stopLoss: 2230, takeProfit1: 2270, takeProfit2: 2300, confidence: 0.65, tier: 'STANDARD', indicators: ['Volume', 'Bollinger Bands'] },
      { symbol: 'OMNIGOLD', tabName: 'OMNIGOLD', direction: 'LONG', pattern: 'FORMATION_BREAKOUT', entryPrice: 2048, stopLoss: 2038, takeProfit1: 2058, takeProfit2: 2068, confidence: 0.72, tier: 'HIGH_CONVICTION', indicators: ['Formation', 'Breakout'] },
      { symbol: 'XAU/USD', tabName: 'FORMATIONS', direction: 'SHORT', pattern: 'DOUBLE_TOP', entryPrice: 2045, stopLoss: 2055, takeProfit1: 2030, takeProfit2: 2015, confidence: 0.68, tier: 'STANDARD', indicators: ['Double Top', 'Support'] }
    ];

    // Record all demo setups
    let recordedCount = 0;
    demoSetups.forEach((setup, index) => {
      setTimeout(() => {
        const result = engine.recordSetup(setup);
        recordedCount++;
        console.log(`[Recording] Setup ${recordedCount}/${demoSetups.length} recorded:`, setup.symbol, setup.tabName);
      }, index * 500);
    });

    console.log('[Recording] 🟢 RECORDING ACTIVE - Setup Intelligence is now monitoring and recording all setups');
    console.log('[Recording] Dashboard will update in real-time as setups are formed');

    // Expose recording control to window
    window.setupRecording = {
      isActive: true,
      recordedSetups: recordedCount,
      stop: () => {
        engine.config.enableAutoRecording = false;
        console.log('[Recording] 🔴 Recording stopped');
        window.setupRecording.isActive = false;
      },
      start: activateSetupRecording,
      recordManually: (setup) => engine.recordSetup(setup)
    };

    return true;
  }

  // Auto-activate on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateSetupRecording);
  } else {
    activateSetupRecording();
  }

  // Also expose globally
  window.activateSetupRecording = activateSetupRecording;
})();
