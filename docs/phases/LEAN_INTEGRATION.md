# HARDGATE + Lean Integration Guide

## Overview
Lean is integrated as a local dependency in `vendors/Lean/` for professional-grade backtesting with:
- **Engine**: Event-driven backtesting with realistic order handling
- **Algorithm.Framework**: Modular algorithm development
- **Indicators**: 150+ technical indicators
- **Brokerages**: Multi-exchange support (Binance, Deribit, Bybit, etc.)
- **Data**: Historical OHLCV feeds

## Directory Structure
```
vendors/Lean/
├── Engine/                 # Backtesting engine (AlgorithmManager, DataFeeds)
├── Algorithm.Framework/    # Modular framework for algorithms
├── Indicators/            # 150+ technical indicators
├── Brokerages/            # Exchange integrations
├── Data/                  # Data providers and handlers
├── Common/                # Shared utilities
├── Tests/                 # Unit tests
└── QuantConnect.Lean.sln  # C# solution file
```

## Key Components

### 1. **Engine** (Backtesting Core)
- `Engine.cs`: Main event loop, orchestrates backtest lifecycle
- `AlgorithmManager.cs`: Manages algorithm execution, orders, fills
- `DataFeeds/`: Feeds OHLCV data to algorithm
- `TransactionHandlers/`: Order execution simulation
- `Results/`: Performance metrics (Sharpe, Sortino, drawdown, etc.)

### 2. **Algorithm.Framework**
- `IAlgorithm`: Base algorithm interface
- `PortfolioConstructionModel`: Position sizing
- `ExecutionModel`: Order routing
- `RiskManagementModel`: Stop-loss, position limits
- `UniverseSelectionModel`: Asset filtering

### 3. **Indicators** (150+ Technical Indicators)
```csharp
// Example usage
var sma = new SimpleMovingAverage(20);
var rsi = new RelativeStrengthIndex(14);
var atr = new AverageTrueRange(14);
var macd = new MovingAverageConvergenceDivergence(12, 26, 9);
```

### 4. **Brokerages**
- `BinanceApi` / `BinanceWebSocket`: Spot & futures
- `DeribitBrokerage`: Options & perpetuals
- `BybitBrokerage`: Perpetuals
- `CoinExBrokerage`: Altcoin spot
- Commission models, slippage simulation

### 5. **Data**
- `HistoricalDataProvider`: OHLCV from CSV, database
- `TickDataProvider`: Tick-level backtesting
- `OptionChainProvider`: Options data
- Real-time quote handlers

## Integration Points

### Phase 1: Wrapper Layer (JavaScript/Node.js)
Create a bridge between HARDGATE's JavaScript trading engine and Lean's C# backtesting:

```javascript
// hardgate-lean-bridge.js
const { spawn } = require('child_process');
const fs = require('fs');

class LeanBacktestBridge {
  constructor(leanPath = './vendors/Lean') {
    this.leanPath = leanPath;
    this.backtest = null;
  }

  // 1. Export HARDGATE signals to Lean algorithm
  exportSignals(signals, outputPath) {
    const csv = [
      ['timestamp', 'symbol', 'signal', 'confidence', 'tier'].join(','),
      ...signals.map(s => 
        [s.timestamp, s.symbol, s.signal, s.confidence, s.tier].join(',')
      )
    ].join('\n');
    fs.writeFileSync(outputPath, csv);
    return outputPath;
  }

  // 2. Run Lean backtest with HARDGATE signals
  async runBacktest(config) {
    return new Promise((resolve, reject) => {
      const proc = spawn('dotnet', [
        'run',
        `--project=${this.leanPath}/Launcher`,
        `--config=${config}`
      ]);

      let output = '';
      proc.stdout.on('data', (data) => { output += data; });
      proc.stderr.on('data', (data) => { output += data; });
      
      proc.on('close', (code) => {
        if (code === 0) {
          // Parse results.json
          const results = JSON.parse(
            fs.readFileSync('./results.json', 'utf8')
          );
          resolve(results);
        } else {
          reject(new Error(`Backtest failed: ${output}`));
        }
      });
    });
  }

  // 3. Compare HARDGATE (live) vs Lean (backtest)
  comparePerformance(hardgateMetrics, leanResults) {
    return {
      hardgate: {
        winRate: hardgateMetrics.winRate,
        profitFactor: hardgateMetrics.profitFactor,
        sharpe: hardgateMetrics.sharpe
      },
      lean: {
        winRate: leanResults.Statistics['Win Rate'],
        profitFactor: leanResults.Statistics['Profit Factor'],
        sharpe: leanResults.Statistics['Sharpe Ratio']
      },
      delta: {
        winRateDelta: leanResults.Statistics['Win Rate'] - hardgateMetrics.winRate,
        pfDelta: leanResults.Statistics['Profit Factor'] - hardgateMetrics.profitFactor
      }
    };
  }
}

module.exports = LeanBacktestBridge;
```

### Phase 2: Lean Algorithm Template
Create a template algorithm that consumes HARDGATE signals:

```csharp
// HardgateStrategyAdapter.cs
using QuantConnect;
using QuantConnect.Algorithm;
using QuantConnect.Algorithm.Framework.Alphas;
using QuantConnect.Algorithm.Framework.Portfolio;
using QuantConnect.Algorithm.Framework.Execution;
using QuantConnect.Algorithm.Framework.Risk;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

public class HardgateStrategyAdapter : QCAlgorithm
{
    private Dictionary<string, GoldUltraSignal> _signals;
    private decimal _leverage = 2.0m;
    private decimal _riskPerTrade = 0.02m;

    public override void Initialize()
    {
        SetStartDate(2024, 1, 1);
        SetEndDate(2024, 12, 31);
        SetCash(100000);
        
        AddCrypto("BTCUSD", Resolution.Minute);
        AddCrypto("ETHUSD", Resolution.Minute);
        
        // Load HARDGATE signals
        LoadSignals("hardgate-signals.csv");
        
        // Framework models
        SetAlphaModel(new HardgateAlphaModel(_signals));
        SetPortfolioConstructionModel(new EqualWeightPortfolioConstructionModel());
        SetExecutionModel(new ImmediateExecutionModel());
        SetRiskManagementModel(new TrailingStopRiskManagementModel(0.02m));
    }

    private void LoadSignals(string filePath)
    {
        _signals = new Dictionary<string, GoldUltraSignal>();
        
        foreach (var line in File.ReadAllLines(filePath).Skip(1))
        {
            var parts = line.Split(',');
            var timestamp = DateTime.Parse(parts[0]);
            var symbol = parts[1];
            var signal = parts[2];
            var confidence = decimal.Parse(parts[3]);
            var tier = parts[4];
            
            _signals[symbol] = new GoldUltraSignal
            {
                Timestamp = timestamp,
                Symbol = symbol,
                Direction = signal == "LONG" ? OrderDirection.Buy : OrderDirection.Sell,
                Confidence = confidence,
                Tier = tier
            };
        }
        
        Debug($"Loaded {_signals.Count} signals from {filePath}");
    }

    public override void OnData(Slice data)
    {
        // Per-minute: check for signals matching timestamp
        foreach (var kvp in _signals)
        {
            if (!data.ContainsKey(kvp.Key)) continue;
            
            var signal = kvp.Value;
            var price = data[kvp.Key].Price;
            
            // Tier-based position sizing
            var positionSize = signal.Tier switch
            {
                "PROFESSIONAL-GRADE" => _riskPerTrade * 2m,
                "PROFESSIONAL" => _riskPerTrade * 1.5m,
                _ => _riskPerTrade
            };
            
            // Entry logic
            SetHoldings(kvp.Key, positionSize * (signal.Direction == OrderDirection.Buy ? 1 : -1));
        }
    }

    private class GoldUltraSignal
    {
        public DateTime Timestamp { get; set; }
        public string Symbol { get; set; }
        public OrderDirection Direction { get; set; }
        public decimal Confidence { get; set; }
        public string Tier { get; set; }
    }
}

public class HardgateAlphaModel : IAlphaModel
{
    private readonly Dictionary<string, GoldUltraSignal> _signals;
    
    public HardgateAlphaModel(Dictionary<string, GoldUltraSignal> signals)
    {
        _signals = signals;
    }
    
    public IEnumerable<Insight> Update(QCAlgorithm algorithm, Slice data)
    {
        foreach (var kvp in _signals)
        {
            var symbol = kvp.Key;
            if (!data.ContainsKey(symbol)) continue;
            
            var signal = kvp.Value;
            var magnitude = signal.Confidence;
            var direction = signal.Direction == OrderDirection.Buy 
                ? InsightDirection.Up 
                : InsightDirection.Down;
            
            yield return Insight.Price(symbol, TimeSpan.FromHours(1), direction, magnitude);
        }
    }
    
    public void OnSecuritiesChanged(QCAlgorithm algorithm, SecurityChanges changes) { }
}
```

## Usage

### Step 1: Export HARDGATE Signals
```javascript
// In your goldultra.js or omnigold.js
const LeanBridge = require('./hardgate-lean-bridge.js');
const bridge = new LeanBridge();

// After generating signals
const signals = [
  { timestamp: '2024-01-15 14:30', symbol: 'XAUUSD', signal: 'LONG', confidence: 0.92, tier: 'PROFESSIONAL-GRADE' },
  { timestamp: '2024-01-15 15:45', symbol: 'EURUSD', signal: 'SHORT', confidence: 0.78, tier: 'PROFESSIONAL' }
];

bridge.exportSignals(signals, './hardgate-signals.csv');
```

### Step 2: Run Backtest in Lean
```bash
cd vendors/Lean
dotnet run --project Launcher --config hardgate-config.json
```

### Step 3: Compare Results
```javascript
const hardgateMetrics = { winRate: 0.62, profitFactor: 1.48, sharpe: 2.3 };
const leanResults = require('./results.json');
const comparison = bridge.comparePerformance(hardgateMetrics, leanResults);

console.log('Win Rate Delta:', comparison.delta.winRateDelta);
console.log('Profit Factor Delta:', comparison.delta.pfDelta);
```

## Benefits

| Aspect | HARDGATE | Lean | Combined |
|--------|----------|------|----------|
| **Real-time Trading** | ✅ Live APIs | ❌ Backtest only | ✅ Both modes |
| **Order Realism** | Basic fills | ✅ Realistic slippage/commissions | ✅ Validated |
| **Indicator Library** | Custom | ✅ 150+ built-in | ✅ Both |
| **Optimization** | Manual | ✅ Parallel optimization | ✅ Parameter tuning |
| **Multi-asset** | 3-5 focus | ✅ Unlimited | ✅ Unlimited |
| **Community** | Internal | ✅ QuantConnect | ✅ Hybrid |

## Next Steps

1. **Phase 1**: Build JavaScript bridge (hardgate-lean-bridge.js)
2. **Phase 2**: Create HardgateStrategyAdapter.cs in Lean
3. **Phase 3**: Export Phase 1 signals from GOLDULTRA/OMNIGOLD
4. **Phase 4**: Run 6-month backtest at realistic costs (XM, Binance, Deribit)
5. **Phase 5**: Compare live P&L vs backtest (validation)

## References
- [Lean GitHub](https://github.com/QuantConnect/Lean)
- [Lean Algorithm API](https://www.quantconnect.com/docs/v2/lean-engine)
- [Indicators Reference](https://www.quantconnect.com/docs/v2/lean-engine/indicators)
- [Framework Models](https://www.quantconnect.com/docs/v2/lean-engine/algorithm-framework)
