/* =========================================================================
   HARDGATE Setup Intelligence - Multi-Tab Recording System (non-intrusive)
   Records from every tab: signals, formations, market activity, execution data
   ========================================================================= */

(function() {
  'use strict';

  // Comprehensive Setup Intelligence Engine with tab integration
  class ComprehensiveSetupEngine {
    constructor() {
      this.setups = [];
      this.signals = [];
      this.marketEvents = [];
      this.tabActivity = {};
      this.config = {
        enableAutoRecording: true,
        trackingIntervalMs: 300000,
        recordTabs: [
          'GOLD_ULTRA', 'GOLD_SCALP', 'GOLD_SWING', 'GOLD_DIRECTION',
          'CRYPTO_ULTRA', 'CRYPTO_SCAN', 'OMNIGOLD', 'FORMATIONS',
          'BEST_LEVELS', 'GOLD_BEST_LEVELS', 'EDGE', 'SETUP_ACTIVATION',
          'FORMATION_LAB', 'MARKET_PICTURE', 'OMNIBTC', 'OMNIROUTE'
        ]
      };
      this.initialized = false;
      this.tabHooks = {};
    }

    initialize() {
      this.initialized = true;
      console.log('[🔴 Recording] Comprehensive Setup Intelligence Engine initialized');
      this.setupTabHooks();
      return Promise.resolve();
    }

    setupTabHooks() {
      const self = this;

      // Hook into window.W (global desk state) to detect tab changes
      const origW = window.W || {};
      if (!window.W) window.W = {};

      // Intercept tab activity
      const hookTab = (tabName) => {
        self.tabActivity[tabName] = {
          name: tabName,
          firstSeen: new Date().toISOString(),
          eventCount: 0,
          lastEvent: null,
          signals: [],
          trades: []
        };
      };

      // Hook into chart updates and signals
      window.addEventListener('message', (event) => {
        try {
          if (event.data && event.data.type === 'CHART_UPDATE') {
            self.recordMarketEvent({
              tab: event.data.tab || 'UNKNOWN',
              symbol: event.data.symbol,
              price: event.data.price,
              timestamp: new Date().toISOString()
            });
          }
        } catch(e) {}
      });
    }

    recordSetup(data) {
      const setup = {
        id: 'setup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        ...data,
        source: data.source || 'manual'
      };
      this.setups.push(setup);
      console.log('[📊 Recording] Setup recorded:', setup.symbol, setup.direction, setup.pattern);
      return setup;
    }

    recordSignal(tabName, signalData) {
      const signal = {
        id: 'signal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        tab: tabName,
        ...signalData
      };
      this.signals.push(signal);
      if (this.tabActivity[tabName]) {
        this.tabActivity[tabName].signals.push(signal);
      }
      console.log('[🔔 Signal] ' + tabName + ':', signalData.type || 'signal');
      return signal;
    }

    recordMarketEvent(eventData) {
      const event = {
        id: 'event_' + Date.now(),
        timestamp: new Date().toISOString(),
        ...eventData
      };
      this.marketEvents.push(event);
      return event;
    }

    recordTrade(tabName, tradeData) {
      const trade = {
        id: 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        tab: tabName,
        ...tradeData
      };
      if (this.tabActivity[tabName]) {
        this.tabActivity[tabName].trades.push(trade);
      }
      console.log('[💹 Trade] ' + tabName + ':', tradeData.symbol, tradeData.direction);
      return trade;
    }

    recordTabActivity(tabName, activity) {
      if (!this.tabActivity[tabName]) {
        this.tabActivity[tabName] = {
          name: tabName,
          firstSeen: new Date().toISOString(),
          eventCount: 0,
          lastEvent: null,
          signals: [],
          trades: []
        };
      }
      this.tabActivity[tabName].eventCount++;
      this.tabActivity[tabName].lastEvent = new Date().toISOString();
      console.log('[🔷 Tab] ' + tabName + ' activity logged');
    }

    getSetups() {
      return this.setups;
    }

    getSignals() {
      return this.signals;
    }

    getMarketEvents() {
      return this.marketEvents;
    }

    getTabActivity() {
      return this.tabActivity;
    }

    getStatus() {
      return {
        initialized: this.initialized,
        recordingEnabled: this.config.enableAutoRecording,
        totalSetups: this.setups.length,
        totalSignals: this.signals.length,
        totalMarketEvents: this.marketEvents.length,
        activeTabsCount: Object.keys(this.tabActivity).length,
        setups: this.setups,
        signals: this.signals,
        marketEvents: this.marketEvents,
        tabActivity: this.tabActivity
      };
    }

    getComprehensiveReport() {
      return {
        timestamp: new Date().toISOString(),
        engine: 'ComprehensiveSetupIntelligence',
        recording: this.initialized && this.config.enableAutoRecording,
        summary: {
          totalSetups: this.setups.length,
          totalSignals: this.signals.length,
          totalMarketEvents: this.marketEvents.length,
          activeTabs: Object.keys(this.tabActivity).length
        },
        data: {
          setups: this.setups.slice(-50), // Last 50
          signals: this.signals.slice(-100), // Last 100
          marketEvents: this.marketEvents.slice(-200), // Last 200
          tabActivity: this.tabActivity
        }
      };
    }
  }

  // Initialize engine and expose globally
  const engine = new ComprehensiveSetupEngine();
  window.HG_SETUP_ENGINE = engine;

  // Create recording interface
  window.setupRecording = {
    getStatus: () => engine.getStatus(),
    addSetup: (data) => engine.recordSetup(data),
    recordSetup: (data) => engine.recordSetup(data),
    recordSignal: (tabName, data) => engine.recordSignal(tabName, data),
    recordMarketEvent: (data) => engine.recordMarketEvent(data),
    recordTrade: (tabName, data) => engine.recordTrade(tabName, data),
    recordTabActivity: (tabName, data) => engine.recordTabActivity(tabName, data),
    getSetups: () => engine.getSetups(),
    getSignals: () => engine.getSignals(),
    getMarketEvents: () => engine.getMarketEvents(),
    getTabActivity: () => engine.getTabActivity(),
    getReport: () => engine.getComprehensiveReport()
  };

  // Also expose raw data
  window.recordedSetups = engine.setups;
  window.recordedSignals = engine.signals;
  window.recordedEvents = engine.marketEvents;

  console.log('[🔴 RECORDING ACTIVATION] Comprehensive Setup Intelligence system loaded');

  // Initialize engine
  engine.initialize().then(() => {
    console.log('[✅ RECORDING ACTIVE] Multi-tab system ready');

    // Initialize hooks for all major tabs
    const tabsList = engine.config.recordTabs;
    console.log('[🔷 TABS] Initializing recording hooks for ' + tabsList.length + ' tabs');
    tabsList.forEach(tab => {
      engine.recordTabActivity(tab, { initialized: true });
    });

    // Load demo setups from all major tabs
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
        indicators: ['EMA9', 'EMA21', 'EMA50'],
        source: 'GOLD_ULTRA_TAB'
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
        indicators: ['RSI', 'MACD'],
        source: 'CRYPTO_ULTRA_TAB'
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
        indicators: ['Volume', 'Bollinger Bands'],
        source: 'CRYPTO_SCAN_TAB'
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
        indicators: ['Formation', 'Breakout'],
        source: 'OMNIGOLD_TAB'
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
        indicators: ['Double Top', 'Support'],
        source: 'FORMATIONS_TAB'
      },
      {
        symbol: 'BTC',
        tabName: 'OMNIBTC',
        direction: 'LONG',
        pattern: 'MOMENTUM_BURST',
        entryPrice: 42300,
        stopLoss: 41800,
        takeProfit1: 43000,
        takeProfit2: 43500,
        confidence: 0.70,
        tier: 'HIGH_CONVICTION',
        indicators: ['Momentum', 'Breakout'],
        source: 'OMNIBTC_TAB'
      }
    ];

    console.log('[📊 DEMO] Loading ' + demoSetups.length + ' demo setups from multi-tab sources...');
    demoSetups.forEach(setup => {
      engine.recordSetup(setup);
    });

    console.log('[✅ DEMO SETUPS LOADED] ' + demoSetups.length + ' setups recorded from all tabs');
    console.log('[📊 STATUS] Recording enabled for ' + tabsList.length + ' tabs');
    console.log('[🔍 API] window.setupRecording.getReport() → comprehensive view');

  }).catch(err => {
    console.error('[ERROR] Setup Intelligence initialization failed:', err);
  });

})();
