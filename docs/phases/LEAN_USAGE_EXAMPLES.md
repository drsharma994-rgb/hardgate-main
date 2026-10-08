# HARDGATE + Lean Integration: Usage Examples

## Quick Start

### 1. Basic Signal Export & Backtest

```javascript
// In your trading desk (goldultra.js, omnigold.js, etc.)
const LeanBridge = require('./hardgate-lean-bridge.js');
const bridge = new LeanBridge();

// Initialize bridge
await bridge.initialize();

// Your generated signals from GOLD ULTRA or OMNIGOLD
const signals = [
  {
    timestamp: '2024-09-13T14:30:00Z',
    symbol: 'XAUUSD',
    signal: 'LONG',
    confidence: 0.92,
    tier: 'PROFESSIONAL-GRADE',
    entryPrice: 2580.50,
    stopLoss: 2575.00,
    tp1: 2590.00,
    tp2: 2600.00
  },
  {
    timestamp: '2024-09-13T15:45:00Z',
    symbol: 'EURUSD',
    signal: 'SHORT',
    confidence: 0.78,
    tier: 'PROFESSIONAL',
    entryPrice: 1.1050,
    stopLoss: 1.1080,
    tp1: 1.1020,
    tp2: 1.0990
  }
];

// Export signals to CSV for Lean
bridge.exportSignals(signals, {
  outputPath: './data/lean-signals.csv'
});

// Generate Lean configuration
bridge.generateConfig({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  initialCash: 100000,
  riskPerTrade: 0.02,
  leverage: 1.5,
  assets: ['Crypto', 'Forex']
});

// Run backtest
try {
  const results = await bridge.runBacktest({
    verbose: true,
    timeout: 10 * 60 * 1000
  });
  console.log('Backtest completed:', results);
} catch (error) {
  console.error('Backtest failed:', error.message);
}
```

### 2. Live vs Backtest Comparison

```javascript
// After running backtest
const hardgateMetrics = {
  statistics: {
    'Win Rate': 0.62,
    'Profit Factor': 1.48,
    'Sharpe Ratio': 2.3,
    'Total Return': 0.155,
    'Max Drawdown': 0.08
  }
};

const leanResults = require('./results/lean-backtest-results.json');

// Compare
const comparison = bridge.comparePerformance(
  hardgateMetrics,
  leanResults
);

// Print report
console.log(bridge.generateReport(comparison));

// Output:
// ╔════════════════════════════════════════════════════════════════════════╗
// ║         HARDGATE vs LEAN PERFORMANCE COMPARISON                       ║
// ╚════════════════════════════════════════════════════════════════════════╝
//
// METRIC                  HARDGATE (Live)      LEAN (Backtest)      DELTA
// ────────────────────────────────────────────────────────────────────────
// Win Rate                     62.0%                59.5%            -2.5%
// Profit Factor                 1.48                 1.45             -0.03
// Sharpe Ratio                  2.30                 2.18             -0.12
// Total Return                 15.5%                14.2%            -1.3%
// Max Drawdown                  8.0%                 8.5%
//
// VALIDATION
// ────────────────────────────────────────────────────────────────────────
// Metrics Agree           ✅ YES
// Win Rate Deviation      0.025
// Profit Factor Deviation 0.03
// Confidence Level        HIGH
```

## Advanced: Tab Integration

### 3. GOLD ULTRA Tab to Lean Pipeline

```javascript
// In goldultra.js - exportable function
function exportGoldUltraSignalsToLean() {
  const LeanBridge = require('./hardgate-lean-bridge.js');
  const bridge = new LeanBridge();

  // Current tab state (from goldultra tab manager)
  const currentSignals = W.GU_SIGNALS || {};  // Your signal store
  
  // Extract signals using bridge helper
  const leanSignals = bridge.extractSignalsFromTab(currentSignals);
  
  if (leanSignals.length === 0) {
    console.warn('[GOLD ULTRA] No signals to export');
    return;
  }

  // Enrich with price/stop/tp from current market data
  const enrichedSignals = leanSignals.map(sig => ({
    ...sig,
    entryPrice: W.GU_PRICES?.[sig.symbol] || 0,
    stopLoss: W.GU_STOPS?.[sig.symbol] || 0,
    tp1: W.GU_TP1S?.[sig.symbol] || 0,
    tp2: W.GU_TP2S?.[sig.symbol] || 0
  }));

  // Export
  bridge.exportSignals(enrichedSignals);
  
  console.log(`[GOLD ULTRA → LEAN] Exported ${enrichedSignals.length} signals`);
  
  return enrichedSignals;
}

// Attach to UI button
document.getElementById('export-to-lean-btn')?.addEventListener('click', () => {
  exportGoldUltraSignalsToLean();
});
```

### 4. CRYPTO SCAN Tab to Lean Pipeline

```javascript
// In cryptoscan.js or cryptoultra.js
async function backtestCryptoUltraWithLean() {
  const LeanBridge = require('./hardgate-lean-bridge.js');
  const bridge = new LeanBridge();

  // Get current CRYPTO ULTRA signals
  const tabData = window.W?.CRYPTO_SIGNALS || window.W?.CU_DATA;
  const signals = bridge.extractSignalsFromTab(tabData);

  console.log(`[CRYPTO ULTRA → LEAN] Found ${signals.length} tradeable signals`);

  // Configure for crypto assets
  bridge.generateConfig({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCash: 50000,
    riskPerTrade: 0.015,
    leverage: 2.0,
    maxPositions: 10,
    assets: ['Crypto']
  });

  // Export and run
  bridge.exportSignals(signals);
  
  try {
    const results = await bridge.runBacktest();
    
    // Store results for comparison
    window.W = window.W || {};
    window.W.CRYPTO_LEAN_RESULTS = results;
    
    // Alert user
    const winRate = results.Statistics?.['Win Rate'] || 0;
    console.log(`[CRYPTO SCAN] Backtest complete: ${(winRate * 100).toFixed(1)}% win rate`);
    
  } catch (error) {
    console.error('[CRYPTO SCAN] Backtest failed:', error.message);
  }
}

// Attach to UI
document.getElementById('lean-backtest-btn')?.addEventListener('click', backtestCryptoUltraWithLean);
```

## Continuous Monitoring: Daily Backtest Update

### 5. Scheduled Daily Comparison

```javascript
// Add to your scheduler (cron or setInterval)
async function dailyLeanValidation() {
  const LeanBridge = require('./hardgate-lean-bridge.js');
  const bridge = new LeanBridge();

  // Get yesterday's signals from HARDGATE
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  const signalFile = `./data/signals-${dateStr}.json`;
  if (!fs.existsSync(signalFile)) {
    console.log('[Daily] No signals from ' + dateStr);
    return;
  }

  const signals = JSON.parse(fs.readFileSync(signalFile, 'utf8'));

  // Configure for yesterday's backtest
  bridge.generateConfig({
    startDate: dateStr,
    endDate: dateStr,
    initialCash: 100000
  });

  bridge.exportSignals(signals);

  try {
    // Run quick backtest on that day's signals
    const results = await bridge.runBacktest({ timeout: 5 * 60 * 1000 });

    // Load yesterday's live metrics
    const liveFile = `./trading-logs/live-${dateStr}.json`;
    const liveMetrics = JSON.parse(fs.readFileSync(liveFile, 'utf8'));

    // Compare
    const comparison = bridge.comparePerformance(liveMetrics, results);

    // Log comparison
    const logFile = `./validation/lean-${dateStr}.json`;
    fs.writeFileSync(logFile, JSON.stringify(comparison, null, 2));

    // Alert if metrics diverge significantly
    if (!comparison.validation.metricsAgree) {
      console.warn(`⚠️ VALIDATION: Metrics diverged on ${dateStr}`);
      console.warn(`   Win Rate: ${comparison.delta.winRate}`);
      console.warn(`   Profit Factor: ${comparison.delta.profitFactor}`);
    } else {
      console.log(`✅ VALIDATION: ${dateStr} metrics agree`);
    }

  } catch (error) {
    console.error('[Daily] Validation failed:', error.message);
  }
}

// Schedule daily at 00:30 UTC
const schedule = require('node-schedule');
schedule.scheduleJob('30 0 * * *', dailyLeanValidation);
```

## Full Integration: Signal → Backtest → Validate Loop

### 6. Complete Trading Day Workflow

```javascript
class HardgateLeanTradingDay {
  constructor() {
    this.bridge = new LeanBridge();
    this.daySignals = [];
    this.dayResults = null;
  }

  async initialize() {
    console.log('[Trading Day] Initializing...');
    const status = await this.bridge.initialize();
    console.log('[Trading Day] Status:', status);
    return status;
  }

  // Morning: Setup
  async setupBacktest(config = {}) {
    console.log('[Trading Day] Setting up backtest config...');
    
    this.bridge.generateConfig({
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      initialCash: config.cash || 100000,
      riskPerTrade: config.risk || 0.02,
      ...config
    });
  }

  // Intraday: Collect signals
  addSignal(signal) {
    this.daySignals.push({
      timestamp: new Date().toISOString(),
      ...signal
    });
    console.log(`[Trading Day] Signal collected: ${signal.symbol} ${signal.signal}`);
  }

  // EOD: Export and backtest
  async validateDay() {
    if (this.daySignals.length === 0) {
      console.log('[Trading Day] No signals to validate');
      return null;
    }

    console.log(`[Trading Day] Validating ${this.daySignals.length} signals...`);
    
    this.bridge.exportSignals(this.daySignals);

    try {
      this.dayResults = await this.bridge.runBacktest();
      console.log('[Trading Day] Backtest completed');
      return this.dayResults;
    } catch (error) {
      console.error('[Trading Day] Validation failed:', error.message);
      return null;
    }
  }

  // EOD: Compare with live trading
  compareWithLive(liveMetrics) {
    if (!this.dayResults) {
      console.warn('[Trading Day] No backtest results to compare');
      return null;
    }

    const comparison = this.bridge.comparePerformance(
      liveMetrics,
      this.dayResults
    );

    console.log(this.bridge.generateReport(comparison));
    return comparison;
  }
}

// Usage
const tradingDay = new HardgateLeanTradingDay();

// Morning
await tradingDay.initialize();
await tradingDay.setupBacktest({
  cash: 100000,
  risk: 0.02,
  leverage: 1.5
});

// Intraday - as signals are generated
tradingDay.addSignal({
  symbol: 'BTCUSD',
  signal: 'LONG',
  confidence: 0.85,
  tier: 'PROFESSIONAL'
});

// EOD
await tradingDay.validateDay();
tradingDay.compareWithLive(todaysLiveMetrics);
```

## Troubleshooting

### Issue: "Lean repo not found"
```bash
# Verify Lean is cloned
ls -la vendors/Lean/
# If missing:
cd vendors
git clone https://github.com/QuantConnect/Lean.git --depth 1
```

### Issue: ".NET not available"
```bash
# Install .NET 6+ (required for Lean)
# Windows:
winget install Microsoft.DotNet.SDK.8

# Linux/Mac:
brew install dotnet
```

### Issue: "Backtest timeout"
- Increase timeout: `await bridge.runBacktest({ timeout: 20 * 60 * 1000 })`
- Or run smaller date ranges in backtest config

### Issue: "Results file not found"
- Check if Lean execution created output (check console output)
- Verify config has correct `results-destination-folder`
- Try running a simple Lean backtest manually to debug

## Performance Tips

1. **Export signals efficiently**: Batch export rather than one-by-one
2. **Parallel backtests**: Run multiple config variations in parallel
3. **Data caching**: Pre-download historical OHLCV data
4. **Config reuse**: Generate config once, reuse for multiple backtests

## Next Phase

- [ ] Create HardgateStrategyAdapter.cs (Lean algorithm template)
- [ ] Auto-download historical data for backtesting
- [ ] Implement result caching to avoid re-running identical backtests
- [ ] Add parameter optimization loop (leverage, risk per trade, etc.)
- [ ] Create web dashboard showing live vs backtest metrics
