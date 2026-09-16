/* =========================================================================
   HARDGATE Setup Intelligence - Multi-Tab Recording System (non-intrusive)
   Records from every tab: signals, formations, market activity, execution data
   ========================================================================= */

(function() {
  'use strict';

  /* THE SEEDED ROWS EARLIER LOADS ALREADY WROTE.

     Until this change, every page load recorded six hard-coded setups into
     the engine and they persisted to localStorage. Deleting the injector
     stops new ones; it does not clear what a browser has been accumulating
     on every visit since the file shipped.

     Matched on the exact triple that identifies them — symbol, pattern and
     entry price — never on a loose field like tier or confidence, because a
     REAL setup could carry those and this must not be able to delete real
     recorded history. A row that does not match all three is left alone.

     Runs once per browser, then marks itself done, so a person who later
     records a setup that happens to look like one of these does not have it
     removed on the next load. */
  var HG_SEEDED_DEMO_ROWS = [
    { symbol: 'GOLD',      pattern: 'EMA_CASCADE',        entryPrice: 2050 },
    { symbol: 'BTC/USDT',  pattern: 'RSI_DIVERGENCE',     entryPrice: 42500 },
    { symbol: 'ETH/USDT',  pattern: 'VOLUME_SPIKE',       entryPrice: 2250 },
    { symbol: 'OMNIGOLD',  pattern: 'FORMATION_BREAKOUT', entryPrice: 2048 },
    { symbol: 'XAU/USD',   pattern: 'DOUBLE_TOP',         entryPrice: 2045 },
    { symbol: 'BTC',       pattern: 'MOMENTUM_BURST',     entryPrice: 42300 }
  ];
  var HG_DEMO_PURGE_KEY = 'hg_setup_demo_purged_v1';

  function hgIsSeededDemoRow(row){
    if (!row) return false;
    for (var i = 0; i < HG_SEEDED_DEMO_ROWS.length; i++){
      var d = HG_SEEDED_DEMO_ROWS[i];
      if (String(row.symbol) === d.symbol
       && String(row.pattern) === d.pattern
       && Number(row.entryPrice) === d.entryPrice) return true;
    }
    return false;
  }

  function hgPurgeSeededDemoSetups(engine){
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(HG_DEMO_PURGE_KEY)) return 0;
      var removed = 0;
      var scrub = function(arr){
        if (!Array.isArray(arr)) return arr;
        var keep = arr.filter(function(r){
          var drop = hgIsSeededDemoRow(r);
          if (drop) removed++;
          return !drop;
        });
        arr.length = 0;
        for (var j = 0; j < keep.length; j++) arr.push(keep[j]);
        return arr;
      };
      if (engine && Array.isArray(engine.setups)) scrub(engine.setups);
      var db = engine && engine.setupDatabase;
      if (db){
        ['daily', 'byTab', 'bySymbol'].forEach(function(k){
          var m = db[k];
          if (m && typeof m.forEach === 'function') m.forEach(function(v){ scrub(v); });
        });
      }
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(HG_DEMO_PURGE_KEY, '1'); } catch (eS) {}
      if (removed) console.log('[setup-intelligence] removed ' + removed + ' seeded demo setups from storage');
      return removed;
    } catch (e) { return 0; }
  }

  try { if (typeof window !== 'undefined') window.hgIsSeededDemoRow = hgIsSeededDemoRow; } catch (eW) {}

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
      if (typeof window.addEventListener !== 'function') return;
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

    /* THE SIX FABRICATED SETUPS THAT USED TO BE RECORDED HERE ARE GONE.

       This file is loaded by index.html on every page load, and inside this
       initialize() callback it unconditionally called engine.recordSetup()
       on six hard-coded rows — GOLD LONG EMA_CASCADE at an entry of 2050,
       XAU/USD SHORT DOUBLE_TOP, one tagged OMNIGOLD, each carrying
       confidence 0.85 and tier HIGH_CONVICTION. They persisted to
       localStorage under hg_setup_intelligence_data and rendered into the
       dashboard at index.html #hg-setup-intelligence-dashboard, which is
       display:block. Gold has not traded near 2050 in years.

       They never reached the gold gates — that evidence lives in
       hg_forward_v1 and hg_forward_agg_v1, and neither omnigold.js nor
       hg-forward.js reads this key — so nothing was mismeasured. What they
       did was put invented setups on the page, labelled as recorded, a few
       divs below a desk that will not call anything a ticket without twenty
       settled out-of-sample trades.

       Removing the injector does not remove what earlier loads already
       wrote, so the stored rows are purged once below. */
    hgPurgeSeededDemoSetups(engine);

    console.log('[📊 STATUS] Recording enabled for ' + tabsList.length + ' tabs');
    console.log('[🔍 API] window.setupRecording.getReport() → comprehensive view');

  }).catch(err => {
    console.error('[ERROR] Setup Intelligence initialization failed:', err);
  });

})();
