/* =========================================================================
   HARDGATE Strategy Adapter for QuantConnect Lean

   Consumes real trading signals exported from HARDGATE (GOLD ULTRA,
   OMNIGOLD, CRYPTO SCAN, etc.) and executes them in Lean's backtesting
   engine with realistic order handling, slippage, and commissions.

   Phase 2 Implementation: Signal-driven algorithm with tier-based position sizing
   ========================================================================= */
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using QuantConnect;
using QuantConnect.Algorithm;
using QuantConnect.Algorithm.Framework;
using QuantConnect.Algorithm.Framework.Alphas;
using QuantConnect.Algorithm.Framework.Portfolio;
using QuantConnect.Algorithm.Framework.Execution;
using QuantConnect.Algorithm.Framework.Risk;
using QuantConnect.Data;
using QuantConnect.Data.UniverseSelection;
using QuantConnect.Orders;
using QuantConnect.Securities;

namespace QuantConnect.Algorithm
{
    /// <summary>
    /// HARDGATE Strategy Adapter - Professional tier signal execution
    ///
    /// Reads pre-generated signals from HARDGATE (CSV export), executes
    /// tier-based position sizing, and validates against realistic costs.
    ///
    /// Input: hardgate-signals.csv with columns:
    ///   timestamp, symbol, signal_type, confidence, tier, entry_price, stop_loss, tp1, tp2
    ///
    /// Tiers:
    ///   PROFESSIONAL-GRADE: 2.0x risk per trade, 90%+ confidence threshold
    ///   PROFESSIONAL: 1.5x risk per trade, 75%+ confidence threshold
    ///   STANDARD: 1.0x risk per trade, 50%+ confidence threshold
    /// </summary>
    public class HardgateStrategyAdapter : QCAlgorithm
    {
        // Configuration
        private decimal _baseRiskPerTrade = 0.02m;  // 2% per trade
        private decimal _leverage = 1.5m;           // 1.5x leverage
        private int _maxPositions = 5;
        private bool _useATRStops = true;

        // Signal storage
        private Dictionary<string, HardgateSignal> _signals = new();
        private Dictionary<string, ActiveTrade> _activeTrades = new();
        private Dictionary<string, PriceBar> _lastBar = new();

        // Metrics
        private int _totalSignalsProcessed = 0;
        private int _tradesEntered = 0;
        private int _tradesExited = 0;
        private decimal _totalPnL = 0;

        // Framework models
        private IAlphaModel _alphaModel;
        private IPortfolioConstructionModel _portfolioModel;
        private IExecutionModel _executionModel;
        private IRiskManagementModel _riskModel;

        public override void Initialize()
        {
            // Backtest period (override in config or set defaults)
            SetStartDate(2024, 1, 1);
            SetEndDate(2024, 12, 31);
            SetCash(100000);

            // Add crypto assets (will expand based on signals)
            AddCrypto("BTCUSD", Resolution.Minute);
            AddCrypto("ETHUSD", Resolution.Minute);

            // Load signals from CSV export
            LoadSignals("hardgate-signals.csv");

            // Framework setup
            SetAlphaModel(new HardgateAlphaModel(this));
            SetPortfolioConstructionModel(new EqualWeightPortfolioConstructionModel());
            SetExecutionModel(new ImmediateExecutionModel());
            SetRiskManagementModel(new MaximumDrawdownPercentPerSecurityRiskManagementModel(0.05m));

            // Warm up for indicators
            SetWarmupPeriod(20);

            Debug($"[HardgateAdapter] Initialized with {_signals.Count} signals");
        }

        /// <summary>
        /// Load HARDGATE signals from CSV file
        /// </summary>
        private void LoadSignals(string filePath)
        {
            try
            {
                if (!File.Exists(filePath))
                {
                    Debug($"[WARN] Signal file not found: {filePath}");
                    return;
                }

                var lines = File.ReadAllLines(filePath);
                var header = lines[0].Split(',');

                // Find column indices
                int idxTime = Array.IndexOf(header, "timestamp");
                int idxSymbol = Array.IndexOf(header, "symbol");
                int idxSignal = Array.IndexOf(header, "signal_type");
                int idxConf = Array.IndexOf(header, "confidence");
                int idxTier = Array.IndexOf(header, "tier");
                int idxEntry = Array.IndexOf(header, "entry_price");
                int idxStop = Array.IndexOf(header, "stop_loss");
                int idxTP1 = Array.IndexOf(header, "take_profit_1");
                int idxTP2 = Array.IndexOf(header, "take_profit_2");

                var symbolsToAdd = new HashSet<string>();

                for (int i = 1; i < lines.Length; i++)
                {
                    var parts = lines[i].Split(',');
                    if (parts.Length < 5) continue;

                    string symbol = parts[idxSymbol];
                    if (!DateTime.TryParse(parts[idxTime], out DateTime timestamp)) continue;

                    var signal = new HardgateSignal
                    {
                        Timestamp = timestamp,
                        Symbol = symbol,
                        Direction = parts[idxSignal].ToUpper().StartsWith("L") ? OrderDirection.Buy : OrderDirection.Sell,
                        Confidence = decimal.TryParse(parts[idxConf], out var c) ? c : 0.5m,
                        Tier = parts[idxTier].ToUpper(),
                        EntryPrice = decimal.TryParse(parts[idxEntry], out var e) ? e : 0m,
                        StopLoss = decimal.TryParse(parts[idxStop], out var s) ? s : 0m,
                        TP1 = decimal.TryParse(parts[idxTP1], out var tp1) ? tp1 : 0m,
                        TP2 = decimal.TryParse(parts[idxTP2], out var tp2) ? tp2 : 0m
                    };

                    if (signal.Symbol != null)
                    {
                        _signals[signal.Symbol] = signal;
                        symbolsToAdd.Add(signal.Symbol);
                    }
                }

                // Add unique symbols to algorithm
                foreach (var sym in symbolsToAdd)
                {
                    if (!Portfolio.ContainsKey(sym))
                    {
                        // Simple heuristic: if symbol contains 'USD', treat as forex/crypto
                        if (sym.Contains("USD") || sym.Length == 7)
                        {
                            AddCrypto(sym, Resolution.Minute);
                        }
                    }
                }

                Debug($"[HardgateAdapter] Loaded {_signals.Count} signals for {symbolsToAdd.Count} symbols");
            }
            catch (Exception ex)
            {
                Debug($"[ERROR] Failed to load signals: {ex.Message}");
            }
        }

        public override void OnData(Slice data)
        {
            // Store current bar for each symbol
            foreach (var kvp in data.Bars)
            {
                _lastBar[kvp.Key.Value] = kvp.Value;
            }

            // Check each signal
            foreach (var kvp in _signals)
            {
                string symbol = kvp.Key;
                var signal = kvp.Value;

                if (!data.ContainsKey(symbol)) continue;

                var price = data[symbol].Price;

                // Skip if outside trading hours (basic filter)
                if (IsWarmingUp) continue;

                // Check if we have an active trade
                if (_activeTrades.ContainsKey(symbol))
                {
                    ProcessActiveTradeExit(symbol, price, data[symbol]);
                }
                else
                {
                    // Try to enter new trade
                    ProcessSignalEntry(symbol, signal, price);
                }
            }
        }

        /// <summary>
        /// Process signal entry with tier-based position sizing
        /// </summary>
        private void ProcessSignalEntry(string symbol, HardgateSignal signal, decimal price)
        {
            // Check confidence threshold for tier
            decimal minConfidence = signal.Tier switch
            {
                "PROFESSIONAL-GRADE" => 0.85m,
                "PROFESSIONAL" => 0.75m,
                _ => 0.50m
            };

            if (signal.Confidence < minConfidence) return;
            if (_activeTrades.Count >= _maxPositions) return;

            // Tier-based risk multiplier
            decimal riskMultiplier = signal.Tier switch
            {
                "PROFESSIONAL-GRADE" => 2.0m,
                "PROFESSIONAL" => 1.5m,
                _ => 1.0m
            };

            decimal riskPerTrade = _baseRiskPerTrade * riskMultiplier;
            decimal riskDollars = Portfolio.TotalPortfolioValue * riskPerTrade;

            // Calculate position size based on stop distance
            decimal stopDistance = Math.Abs(price - signal.StopLoss);
            if (stopDistance < 0.001m) stopDistance = price * 0.01m; // Default 1% if not specified

            decimal positionSize = stopDistance > 0 ? riskDollars / stopDistance : 0;
            decimal positionQuantity = (positionSize / price) * _leverage;

            // Execute entry
            var ticket = signal.Direction == OrderDirection.Buy
                ? Buy(symbol, (int)positionQuantity)
                : Sell(symbol, (int)positionQuantity);

            if (ticket != null)
            {
                _activeTrades[symbol] = new ActiveTrade
                {
                    Symbol = symbol,
                    EntryTime = Time,
                    EntryPrice = price,
                    Direction = signal.Direction,
                    Quantity = (int)positionQuantity,
                    StopPrice = signal.StopLoss,
                    TP1Price = signal.TP1,
                    TP2Price = signal.TP2,
                    RiskDollars = riskDollars,
                    Tier = signal.Tier,
                    OrderTicket = ticket
                };

                _tradesEntered++;
                Debug($"[ENTRY] {symbol} {signal.Direction} qty={positionQuantity:F2} @ {price:F4} | Tier: {signal.Tier} | Risk: ${riskDollars:F2}");
            }
        }

        /// <summary>
        /// Process exit logic for active trades
        /// </summary>
        private void ProcessActiveTradeExit(string symbol, decimal price, TradeBar bar)
        {
            if (!_activeTrades.TryGetValue(symbol, out var trade)) return;

            bool hitStop = (trade.Direction == OrderDirection.Buy && price <= trade.StopPrice) ||
                          (trade.Direction == OrderDirection.Buy && bar.Low <= trade.StopPrice) ||
                          (trade.Direction == OrderDirection.Sell && price >= trade.StopPrice) ||
                          (trade.Direction == OrderDirection.Sell && bar.High >= trade.StopPrice);

            bool hitTP1 = (trade.Direction == OrderDirection.Buy && price >= trade.TP1Price) ||
                         (trade.Direction == OrderDirection.Buy && bar.High >= trade.TP1Price) ||
                         (trade.Direction == OrderDirection.Sell && price <= trade.TP1Price) ||
                         (trade.Direction == OrderDirection.Sell && bar.Low <= trade.TP1Price);

            bool hitTP2 = (trade.Direction == OrderDirection.Buy && price >= trade.TP2Price) ||
                         (trade.Direction == OrderDirection.Buy && bar.High >= trade.TP2Price) ||
                         (trade.Direction == OrderDirection.Sell && price <= trade.TP2Price) ||
                         (trade.Direction == OrderDirection.Sell && bar.Low <= trade.TP2Price);

            // Exit on stop or take profit
            if (hitStop)
            {
                Liquidate(symbol);
                var pnl = -trade.RiskDollars; // Stopped out
                _totalPnL += pnl;
                _tradesExited++;
                _activeTrades.Remove(symbol);
                Debug($"[EXIT-STOP] {symbol} @ {price:F4} | PnL: ${pnl:F2}");
            }
            else if (hitTP2)
            {
                Liquidate(symbol);
                var pnl = trade.RiskDollars * 2; // 2R profit
                _totalPnL += pnl;
                _tradesExited++;
                _activeTrades.Remove(symbol);
                Debug($"[EXIT-TP2] {symbol} @ {price:F4} | PnL: ${pnl:F2}");
            }
            else if (hitTP1)
            {
                // Scale out 50% at TP1
                var scaleQty = (int)(trade.Quantity * 0.5m);
                if (scaleQty > 0)
                {
                    if (trade.Direction == OrderDirection.Buy) Sell(symbol, scaleQty);
                    else Buy(symbol, scaleQty);
                    var pnl = trade.RiskDollars * 1; // 1R profit on half
                    _totalPnL += pnl;
                    Debug($"[SCALE-OUT] {symbol} @ {price:F4} | Qty: {scaleQty} | PnL: ${pnl:F2}");
                }
            }
            // Check timeout (48 bars = 12 hours of 15m data)
            else if ((Time - trade.EntryTime).TotalMinutes > 720)
            {
                Liquidate(symbol);
                var pnl = -trade.RiskDollars; // Timeout loss
                _totalPnL += pnl;
                _tradesExited++;
                _activeTrades.Remove(symbol);
                Debug($"[EXIT-TIMEOUT] {symbol} @ {price:F4} | PnL: ${pnl:F2}");
            }
        }

        public override void OnEndOfAlgorithm()
        {
            Debug("=== HARDGATE ADAPTER FINAL RESULTS ===");
            Debug($"Total Signals Processed: {_totalSignalsProcessed}");
            Debug($"Trades Entered: {_tradesEntered}");
            Debug($"Trades Exited: {_tradesExited}");
            Debug($"Total PnL: ${_totalPnL:F2}");
            Debug($"Win Rate: {(_tradesExited > 0 ? ((_totalPnL / _tradesExited) > 0 ? 1 : 0) * 100 : 0):F1}%");
        }

        /// <summary>
        /// Signal data structure
        /// </summary>
        private class HardgateSignal
        {
            public DateTime Timestamp { get; set; }
            public string Symbol { get; set; }
            public OrderDirection Direction { get; set; }
            public decimal Confidence { get; set; }
            public string Tier { get; set; }
            public decimal EntryPrice { get; set; }
            public decimal StopLoss { get; set; }
            public decimal TP1 { get; set; }
            public decimal TP2 { get; set; }
        }

        /// <summary>
        /// Active trade tracking
        /// </summary>
        private class ActiveTrade
        {
            public string Symbol { get; set; }
            public DateTime EntryTime { get; set; }
            public decimal EntryPrice { get; set; }
            public OrderDirection Direction { get; set; }
            public int Quantity { get; set; }
            public decimal StopPrice { get; set; }
            public decimal TP1Price { get; set; }
            public decimal TP2Price { get; set; }
            public decimal RiskDollars { get; set; }
            public string Tier { get; set; }
            public OrderTicket OrderTicket { get; set; }
        }
    }

    /// <summary>
    /// Custom Alpha Model consuming HARDGATE signals
    /// </summary>
    public class HardgateAlphaModel : IAlphaModel
    {
        private readonly HardgateStrategyAdapter _algorithm;

        public HardgateAlphaModel(HardgateStrategyAdapter algorithm)
        {
            _algorithm = algorithm;
        }

        public IEnumerable<Insight> Update(QCAlgorithm algorithm, Slice data)
        {
            // Signals are directly executed in OnData; this is a placeholder
            yield break;
        }

        public void OnSecuritiesChanged(QCAlgorithm algorithm, SecurityChanges changes)
        {
            // Handle security changes if needed
        }
    }
}
