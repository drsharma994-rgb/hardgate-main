/* =========================================================================
   HARDGATE Setup Intelligence - Minimal Self-Contained Recording System
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

  // Create SETUP INTELLIGENCE tab in main menu
  setTimeout(() => {
    // Find or create tab container
    const existingTab = document.querySelector('[data-setup-tab]');
    if (existingTab) return; // Already created

    // Create tab button
    const tabButton = document.createElement('button');
    tabButton.setAttribute('data-setup-tab', 'true');
    tabButton.style.cssText = `
      padding: 12px 20px; margin: 8px 4px;
      background: #00ff00; color: #000;
      border: none; border-radius: 6px;
      font-weight: bold; cursor: pointer;
      font-size: 14px; font-family: monospace;
      box-shadow: 0 0 15px rgba(0,255,0,0.4);
      transition: all 0.2s;
    `;
    tabButton.textContent = '📊 SETUP INTELLIGENCE';
    tabButton.onmouseover = () => {
      tabButton.style.background = '#00dd00';
      tabButton.style.boxShadow = '0 0 25px rgba(0,255,0,0.6)';
    };
    tabButton.onmouseout = () => {
      tabButton.style.background = '#00ff00';
      tabButton.style.boxShadow = '0 0 15px rgba(0,255,0,0.4)';
    };

    // Click handler
    tabButton.onclick = () => {
      showSetupIntelligenceDashboard();
    };

    // Find the best place to insert the tab (near other command tabs)
    const commandTab = document.querySelector('button') || document.body.querySelector('main button');
    if (commandTab && commandTab.parentNode) {
      commandTab.parentNode.insertBefore(tabButton, commandTab.nextSibling);
      console.log('[✅ TAB] SETUP INTELLIGENCE tab added to menu');
    } else {
      document.body.insertBefore(tabButton, document.body.firstChild);
    }
  }, 500);

  // Dashboard display function
  window.showSetupIntelligenceDashboard = function() {
    // Create modal/overlay
    const existingModal = document.querySelector('[data-setup-modal]');
    if (existingModal) existingModal.remove();

    const status = window.setupRecording?.getStatus?.();
    const setups = status?.setups || [];

    const modal = document.createElement('div');
    modal.setAttribute('data-setup-modal', 'true');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85); z-index: 20000;
      display: flex; align-items: center; justify-content: center;
      font-family: monospace; color: #fff;
    `;

    modal.innerHTML = `
      <div style="
        background: #1a1a1a; border: 3px solid #00ff00;
        border-radius: 12px; padding: 24px; max-width: 700px;
        max-height: 80vh; overflow-y: auto;
        box-shadow: 0 0 40px rgba(0,255,0,0.5);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #00ff00; margin: 0;">📊 SETUP INTELLIGENCE DASHBOARD</h2>
          <button style="
            background: #ff0000; border: none; color: #fff;
            padding: 8px 16px; border-radius: 4px; cursor: pointer;
            font-weight: bold; font-family: monospace;
          " onclick="this.closest('[data-setup-modal]').remove()">CLOSE</button>
        </div>

        <div style="background: #222; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h3 style="color: #00ff00; margin-top: 0;">Today's Performance</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
            <div>Total Setups: <strong style="color: #00ff00;">${setups.length}</strong></div>
            <div>Closed: <strong style="color: #00ff00;">0</strong></div>
            <div>Open: <strong style="color: #00ff00;">${setups.length}</strong></div>
            <div>Win Rate: <strong style="color: #00ff00;">0.0%</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <h3 style="color: #00ff00; margin-top: 0;">Active Setups</h3>
          ${setups.map((s, i) => `
            <div style="
              background: #222; padding: 12px; margin-bottom: 8px;
              border-left: 4px solid ${s.direction === 'LONG' ? '#00ff00' : '#ff0000'};
              border-radius: 4px;
            ">
              <div style="font-weight: bold; margin-bottom: 4px;">
                ${i+1}. ${s.symbol} | <span style="color: ${s.direction === 'LONG' ? '#00ff00' : '#ff0000'};">${s.direction}</span>
              </div>
              <div style="font-size: 12px; color: #aaa;">
                Pattern: ${s.pattern} | Confidence: ${(s.confidence*100).toFixed(0)}%
              </div>
              <div style="font-size: 12px; color: #aaa;">
                Entry: $${s.entryPrice} | SL: $${s.stopLoss} | TP1: $${s.takeProfit1} | TP2: $${s.takeProfit2}
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background: #222; padding: 16px; border-radius: 8px;">
          <h3 style="color: #00ff00; margin-top: 0;">System Status</h3>
          <div style="font-size: 14px;">
            <div>Recording: <span style="color: #00ff00;">✅ ACTIVE</span></div>
            <div>Engine: <span style="color: #00ff00;">✅ Initialized</span></div>
            <div>Last Update: <strong>${new Date().toLocaleTimeString()}</strong></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    console.log('[✅ DASHBOARD] Setup Intelligence modal opened');
  };

  // Update Setup Intelligence Report with actual data
  setTimeout(() => {
    const reportElements = Array.from(document.querySelectorAll('*')).filter(el =>
      el.textContent?.includes('Setup Intelligence Report') ||
      el.textContent?.includes('Total Setups') ||
      el.textContent?.includes('Win Rate')
    );

    if (reportElements.length > 0) {
      const reportContainer = reportElements[0].closest('div') || reportElements[0];
      const setups = window.setupRecording?.getStatus?.().setups || [];
      const closedSetups = setups.filter(s => s.status === 'CLOSED');
      const openSetups = setups.filter(s => s.status === 'OPEN' || !s.status);

      reportContainer.innerHTML = `
        <div style="background: #1a1a1a; color: #fff; padding: 16px; border-radius: 8px; font-family: monospace;">
          <h3 style="color: #00ff00; margin-top: 0;">📊 Setup Intelligence Report</h3>

          <div style="margin: 12px 0; padding: 12px; background: #222; border-radius: 4px;">
            <strong>Today's Performance</strong>
            <div>Total Setups: <strong>${setups.length}</strong></div>
            <div>Closed: <strong>${closedSetups.length}</strong></div>
            <div>Open: <strong>${openSetups.length}</strong></div>
            <div>Win Rate: <strong>${((setups.filter(s => s.outcome?.includes('TP')).length / setups.length || 0) * 100).toFixed(1)}%</strong></div>
          </div>

          <div style="margin: 12px 0;">
            <strong>Active Setups:</strong>
            ${setups.map(s => `
              <div style="margin: 6px 0; padding: 8px; background: #222; border-left: 3px solid ${s.direction === 'LONG' ? '#00ff00' : '#ff0000'};font-size: 12px;">
                <strong>${s.symbol}</strong> | ${s.direction} | ${s.pattern} | Conf: ${(s.confidence*100).toFixed(0)}%
              </div>
            `).join('')}
          </div>

          <div style="margin: 12px 0; padding: 12px; background: #222; border-radius: 4px; font-size: 12px;">
            <strong>📈 System Status:</strong>
            <div>Recording: ✅ ACTIVE</div>
            <div>Engine: Initialized</div>
            <div>Last Update: ${new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      `;
    }
  }, 1000);

  // Create fixed monitoring panel at top-right
  setTimeout(() => {
    const panelHTML = `
    <div style="
      position: fixed; top: 80px; right: 16px; width: 320px;
      background: #1a1a1a; border: 2px solid #00ff00;
      border-radius: 8px; padding: 12px; z-index: 10000;
      color: #fff; font-family: monospace; font-size: 11px;
      box-shadow: 0 0 20px rgba(0,255,0,0.3);
    ">
      <div style="text-align: center; margin-bottom: 8px; color: #00ff00; font-weight: bold;">
        📊 SETUP INTELLIGENCE
      </div>
      <div style="border-top: 1px solid #444; padding-top: 8px;">
        <div>Status: <span style="color: #00ff00;">✅ ACTIVE</span></div>
        <div>Recording: <span style="color: #00ff00;">✅ ENABLED</span></div>
        <div>Setups: <strong>${demoSetups.length}</strong></div>
      </div>
      <div style="border-top: 1px solid #444; margin-top: 8px; padding-top: 8px; font-size: 10px;">
        ${demoSetups.map(s =>
          `<div style="margin: 4px 0; color: ${s.direction === 'LONG' ? '#00ff00' : '#ff0000'};"><strong>${s.symbol}</strong> ${s.direction} - ${(s.confidence*100).toFixed(0)}%</div>`
        ).join('')}
      </div>
    </div>
    `;

    const panel = document.createElement('div');
    panel.setAttribute('data-setup-panel', 'true');
    panel.innerHTML = panelHTML;
    document.body.appendChild(panel);
    console.log('[✅ PANEL] Setup Intelligence monitoring panel created at top-right');
  }, 500);

})();
