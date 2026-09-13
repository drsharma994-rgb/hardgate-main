/* =========================================================================
   HARDGATE Setup Intelligence - Recording System ONLY (non-intrusive)
   ========================================================================= */

(function() {
  'use strict';

  // Minimal Setup Intelligence Engine
  class MinimalSetupEngine {
    constructor() {
      this.setups = [];
      this.config = {
        enableAutoRecording: true,
        trackingIntervalMs: 300000
      };
      this.initialized = false;
    }

    initialize() {
      this.initialized = true;
      console.log('[🔴 Recording] Setup Intelligence Engine initialized');
      return Promise.resolve();
    }

    recordSetup(data) {
      const setup = {
        id: 'setup_' + Date.now(),
        timestamp: new Date().toISOString(),
        ...data
      };
      this.setups.push(setup);
      console.log('[📊 Recording] Setup recorded:', setup.symbol, setup.direction, setup.pattern);
      return setup;
    }

    getSetups() {
      return this.setups;
    }

    getStatus() {
      return {
        initialized: this.initialized,
        recordingEnabled: this.config.enableAutoRecording,
        totalSetups: this.setups.length,
        setups: this.setups
      };
    }
  }

  // Initialize engine and expose globally
  const engine = new MinimalSetupEngine();
  window.HG_SETUP_ENGINE = engine;

  // Create recording interface
  window.setupRecording = {
    getStatus: () => engine.getStatus(),
    addSetup: (data) => engine.recordSetup(data),
    recordSetup: (data) => engine.recordSetup(data),
    getSetups: () => engine.getSetups()
  };

  // Also expose raw setups
  window.recordedSetups = engine.setups;

  console.log('[🔴 RECORDING ACTIVATION] Setup Intelligence system loaded');

  // Initialize engine
  engine.initialize().then(() => {
    console.log('[✅ RECORDING ACTIVE] System ready for setup recording');

    // Load demo setups
    const demoSetups = [
      {
        symbol: 'GOLD',
        tabName: 'GOLD ULTRA',
        direction: 'LONG',
        pattern: 'EMA_CASCADE',
        entryPrice: 2050,
        stopLoss: 2040,
        takeProfit1: 2060,
        takeProfit2: 2070,
        confidence: 0.85,
        tier: 'HIGH_CONVICTION',
        indicators: ['EMA9', 'EMA21', 'EMA50']
      },
      {
        symbol: 'BTC/USDT',
        tabName: 'CRYPTO ULTRA',
        direction: 'SHORT',
        pattern: 'RSI_DIVERGENCE',
        entryPrice: 42500,
        stopLoss: 43000,
        takeProfit1: 41500,
        takeProfit2: 40500,
        confidence: 0.75,
        tier: 'STANDARD',
        indicators: ['RSI', 'MACD']
      },
      {
        symbol: 'ETH/USDT',
        tabName: 'CRYPTO SCAN',
        direction: 'LONG',
        pattern: 'VOLUME_SPIKE',
        entryPrice: 2250,
        stopLoss: 2230,
        takeProfit1: 2270,
        takeProfit2: 2300,
        confidence: 0.65,
        tier: 'STANDARD',
        indicators: ['Volume', 'Bollinger Bands']
      },
      {
        symbol: 'OMNIGOLD',
        tabName: 'OMNIGOLD',
        direction: 'LONG',
        pattern: 'FORMATION_BREAKOUT',
        entryPrice: 2048,
        stopLoss: 2038,
        takeProfit1: 2058,
        takeProfit2: 2068,
        confidence: 0.72,
        tier: 'HIGH_CONVICTION',
        indicators: ['Formation', 'Breakout']
      },
      {
        symbol: 'XAU/USD',
        tabName: 'FORMATIONS',
        direction: 'SHORT',
        pattern: 'DOUBLE_TOP',
        entryPrice: 2045,
        stopLoss: 2055,
        takeProfit1: 2030,
        takeProfit2: 2015,
        confidence: 0.68,
        tier: 'STANDARD',
        indicators: ['Double Top', 'Support']
      }
    ];

    console.log('[📊 DEMO] Loading 5 demo setups into recording system...');
    demoSetups.forEach(setup => {
      engine.recordSetup(setup);
    });

    console.log('[✅ DEMO SETUPS LOADED] ' + demoSetups.length + ' setups now being tracked');
    console.log('[📊 STATUS] Recording enabled. Access status via: window.setupRecording.getStatus()');

  }).catch(err => {
    console.error('[ERROR] Setup Intelligence initialization failed:', err);
  });

  // All data accessible via: window.setupRecording.getStatus()
  // The Setup Intelligence engine is initialized and 5 demo setups are recorded

})();
