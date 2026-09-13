/* =========================================================================
   HARDGATE + Lean Bridge

   Adapter layer connecting HARDGATE's real-time signal generation with
   Lean's professional backtesting engine. Exports signals, runs backtests,
   and compares live performance vs backtest metrics.
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class HardgateLeanBridge {
  constructor(leanPath = './vendors/Lean') {
    this.leanPath = leanPath;
    this.signalPath = './data/lean-signals.csv';
    this.configPath = './data/lean-config.json';
    this.resultsPath = './results/lean-backtest-results.json';
  }

  /* ===== SIGNAL EXPORT ===== */

  /**
   * Export HARDGATE trading signals to CSV for Lean consumption
   * @param {Array} signals - Array of signal objects
   * @param {Object} options - Export options
   * @returns {string} Path to exported CSV file
   */
  exportSignals(signals, options = {}) {
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      throw new Error('No signals provided for export');
    }

    const outputPath = options.outputPath || this.signalPath;
    const ensureDir = (dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    };

    ensureDir(path.dirname(outputPath));

    // CSV header: timestamp, symbol, signal_type, confidence, tier, entry_price
    const header = [
      'timestamp',
      'symbol',
      'signal_type',
      'confidence',
      'tier',
      'entry_price',
      'stop_loss',
      'take_profit_1',
      'take_profit_2'
    ];

    const rows = signals.map(s => [
      s.timestamp || new Date().toISOString(),
      s.symbol || 'UNKNOWN',
      s.signal || s.direction || 'HOLD',
      (s.confidence || 0).toFixed(4),
      s.tier || 'STANDARD',
      (s.entryPrice || s.price || 0).toFixed(4),
      (s.stopLoss || 0).toFixed(4),
      (s.tp1 || s.takeProfitL1 || 0).toFixed(4),
      (s.tp2 || s.takeProfitL2 || 0).toFixed(4)
    ]);

    const csv = [
      header.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    fs.writeFileSync(outputPath, csv, 'utf8');
    console.log(`[LeanBridge] Exported ${signals.length} signals to ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate Lean algorithm configuration JSON
   * @param {Object} config - Configuration object
   * @returns {string} Path to config file
   */
  generateConfig(config = {}) {
    const defaultConfig = {
      "algorithm-type-name": "HardgateStrategyAdapter",
      "algorithm-language": "CSharp",
      "live-mode": false,
      "backtest-start": config.startDate || "2024-01-01",
      "backtest-end": config.endDate || "2024-12-31",
      "initial-cash": config.initialCash || 100000,
      "cash-strategy": "RoundWhole",
      "account-currency": config.currency || "USD",
      "security-price-type": "Bid",
      "asset-classes": config.assets || ["Crypto"],
      "data-folder": config.dataFolder || "./data",
      "results-destination-folder": config.resultsFolder || "./results",
      "log-level": config.logLevel || "Info",
      "parameters": {
        "risk-per-trade": config.riskPerTrade || 0.02,
        "leverage": config.leverage || 1.0,
        "max-positions": config.maxPositions || 5,
        "stop-loss-pct": config.stopLossPct || 0.02
      }
    };

    const outputPath = config.outputPath || this.configPath;
    const ensureDir = (dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    };

    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log(`[LeanBridge] Generated config at ${outputPath}`);
    return outputPath;
  }

  /* ===== BACKTEST EXECUTION ===== */

  /**
   * Run Lean backtest with HARDGATE signals
   * @param {Object} options - Backtest options
   * @returns {Promise<Object>} Backtest results
   */
  async runBacktest(options = {}) {
    return new Promise((resolve, reject) => {
      const leanPath = options.leanPath || this.leanPath;
      const configPath = options.configPath || this.configPath;

      if (!fs.existsSync(configPath)) {
        return reject(new Error(`Config file not found: ${configPath}`));
      }

      console.log(`[LeanBridge] Starting Lean backtest...`);
      console.log(`[LeanBridge] Lean path: ${leanPath}`);
      console.log(`[LeanBridge] Config: ${configPath}`);

      // Try to run with dotnet
      const proc = spawn('dotnet', [
        'run',
        '--project',
        path.join(leanPath, 'Launcher'),
        '--config',
        path.resolve(configPath)
      ], {
        cwd: leanPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.verbose) console.log(`[Lean stdout] ${data}`);
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.verbose) console.log(`[Lean stderr] ${data}`);
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn Lean process: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`[LeanBridge] Backtest completed successfully`);

          // Attempt to read results
          try {
            const resultsFile = this.findResultsFile(options.resultsFolder || './results');
            if (resultsFile) {
              const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
              resolve(results);
            } else {
              resolve({ status: 'completed', stdout });
            }
          } catch (e) {
            console.warn(`[LeanBridge] Could not parse results: ${e.message}`);
            resolve({ status: 'completed', stdout, error: e.message });
          }
        } else {
          reject(new Error(`Lean backtest failed (code ${code}): ${stderr}`));
        }
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        proc.kill();
        reject(new Error('Backtest timeout (10 min)'));
      }, 10 * 60 * 1000);
    });
  }

  /**
   * Find and parse Lean backtest results
   * @param {string} folder - Results folder
   * @returns {string|null} Path to results file
   */
  findResultsFile(folder) {
    if (!fs.existsSync(folder)) return null;

    const files = fs.readdirSync(folder);
    const resultsFile = files.find(f =>
      f.includes('results') || f === 'results.json'
    );

    return resultsFile ? path.join(folder, resultsFile) : null;
  }

  /* ===== METRICS COMPARISON ===== */

  /**
   * Compare HARDGATE live metrics vs Lean backtest metrics
   * @param {Object} hardgateMetrics - Live trading metrics
   * @param {Object} leanResults - Backtest results
   * @returns {Object} Comparison analysis
   */
  comparePerformance(hardgateMetrics, leanResults) {
    if (!hardgateMetrics || !leanResults) {
      throw new Error('Both hardgate and lean metrics required');
    }

    const hgStats = hardgateMetrics.statistics || hardgateMetrics;
    const leanStats = leanResults.Statistics || leanResults;

    const extractMetric = (obj, keys) => {
      for (const key of keys) {
        if (obj && typeof obj === 'object' && key in obj) {
          const val = obj[key];
          return typeof val === 'string' ? parseFloat(val) : val;
        }
      }
      return 0;
    };

    // Extract metrics with multiple possible key names
    const hgWinRate = extractMetric(hgStats, ['Win Rate', 'winRate', 'win_rate']) || 0;
    const hgPF = extractMetric(hgStats, ['Profit Factor', 'profitFactor', 'profit_factor']) || 0;
    const hgSharpe = extractMetric(hgStats, ['Sharpe Ratio', 'sharpe', 'sharpeRatio']) || 0;
    const hgReturn = extractMetric(hgStats, ['Total Return', 'totalReturn', 'total_return']) || 0;
    const hgDD = extractMetric(hgStats, ['Max Drawdown', 'maxDrawdown', 'max_drawdown']) || 0;

    const leanWinRate = extractMetric(leanStats, ['Win Rate', 'winRate', 'win_rate']) || 0;
    const leanPF = extractMetric(leanStats, ['Profit Factor', 'profitFactor', 'profit_factor']) || 0;
    const leanSharpe = extractMetric(leanStats, ['Sharpe Ratio', 'sharpe', 'sharpeRatio']) || 0;
    const leanReturn = extractMetric(leanStats, ['Total Return', 'totalReturn', 'total_return']) || 0;
    const leanDD = extractMetric(leanStats, ['Max Drawdown', 'maxDrawdown', 'max_drawdown']) || 0;

    const deltaWR = leanWinRate - hgWinRate;
    const deltaPF = leanPF - hgPF;
    const deltaSharpe = leanSharpe - hgSharpe;
    const deltaReturn = leanReturn - hgReturn;

    const agreement = Math.abs(deltaWR) < 0.05 && Math.abs(deltaPF) < 0.2;

    return {
      hardgate: {
        winRate: (hgWinRate * 100).toFixed(1) + '%',
        profitFactor: hgPF.toFixed(2),
        sharpe: hgSharpe.toFixed(2),
        totalReturn: (hgReturn * 100).toFixed(1) + '%',
        maxDrawdown: (hgDD * 100).toFixed(1) + '%'
      },
      lean: {
        winRate: (leanWinRate * 100).toFixed(1) + '%',
        profitFactor: leanPF.toFixed(2),
        sharpe: leanSharpe.toFixed(2),
        totalReturn: (leanReturn * 100).toFixed(1) + '%',
        maxDrawdown: (leanDD * 100).toFixed(1) + '%'
      },
      delta: {
        winRate: (deltaWR * 100).toFixed(1) + '%',
        profitFactor: deltaPF.toFixed(2),
        sharpe: deltaSharpe.toFixed(2),
        totalReturn: (deltaReturn * 100).toFixed(1) + '%'
      },
      validation: {
        metricsAgree: agreement,
        winRateDeviation: Math.abs(deltaWR).toFixed(3),
        pfDeviation: Math.abs(deltaPF).toFixed(3),
        confidence: agreement ? 'HIGH' : 'MEDIUM'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate comparison report
   * @param {Object} comparison - Comparison object from comparePerformance
   * @returns {string} Formatted report
   */
  generateReport(comparison) {
    const formatNum = (n) => n.toString().padStart(10);

    return `
╔════════════════════════════════════════════════════════════════════════╗
║         HARDGATE vs LEAN PERFORMANCE COMPARISON                       ║
╚════════════════════════════════════════════════════════════════════════╝

METRIC                  HARDGATE (Live)      LEAN (Backtest)      DELTA
────────────────────────────────────────────────────────────────────────
Win Rate                ${formatNum(comparison.hardgate.winRate)}   ${formatNum(comparison.lean.winRate)}   ${formatNum(comparison.delta.winRate)}
Profit Factor           ${formatNum(comparison.hardgate.profitFactor)}   ${formatNum(comparison.lean.profitFactor)}   ${formatNum(comparison.delta.profitFactor)}
Sharpe Ratio            ${formatNum(comparison.hardgate.sharpe)}   ${formatNum(comparison.lean.sharpe)}   ${formatNum(comparison.delta.sharpe)}
Total Return            ${formatNum(comparison.hardgate.totalReturn)}   ${formatNum(comparison.lean.totalReturn)}   ${formatNum(comparison.delta.totalReturn)}
Max Drawdown            ${formatNum(comparison.hardgate.maxDrawdown)}   ${formatNum(comparison.lean.maxDrawdown)}

VALIDATION
────────────────────────────────────────────────────────────────────────
Metrics Agree           ${comparison.validation.metricsAgree ? '✅ YES' : '⚠️ NO'}
Win Rate Deviation      ${comparison.validation.winRateDeviation}
Profit Factor Deviation ${comparison.validation.pfDeviation}
Confidence Level        ${comparison.validation.confidence}

Generated: ${comparison.timestamp}
    `;
  }

  /* ===== INTEGRATION HELPERS ===== */

  /**
   * Extract signals from HARDGATE tab (goldultra.js, omnigold.js, etc.)
   * @param {Object} tabData - Tab data object
   * @returns {Array} Extracted signals
   */
  extractSignalsFromTab(tabData) {
    const signals = [];

    if (!tabData) return signals;

    // Support multiple tab formats
    const symbolKeys = ['symbol', 'pair', 'asset'];
    const signalKeys = ['signal', 'direction', 'decision'];
    const confidenceKeys = ['confidence', 'strength', 'score'];
    const tierKeys = ['tier', 'grade', 'level'];

    for (const key in tabData) {
      const item = tabData[key];
      if (typeof item !== 'object') continue;

      const symbol = symbolKeys.reduce((acc, k) => acc || item[k], null);
      const signal = signalKeys.reduce((acc, k) => acc || item[k], null);
      const confidence = confidenceKeys.reduce((acc, k) => acc || item[k], 0);
      const tier = tierKeys.reduce((acc, k) => acc || item[k], 'STANDARD');

      if (symbol && signal) {
        signals.push({
          timestamp: new Date().toISOString(),
          symbol,
          signal: signal.toUpperCase(),
          confidence: Math.min(1, Math.max(0, Number(confidence))),
          tier: String(tier).toUpperCase()
        });
      }
    }

    return signals;
  }

  /**
   * Initialize bridge for a trading session
   * @param {Object} config - Session config
   * @returns {Promise<Object>} Initialization status
   */
  async initialize(config = {}) {
    const status = {
      leanPath: this.leanPath,
      checks: {}
    };

    // Check if Lean repo exists
    status.checks.leanRepoExists = fs.existsSync(this.leanPath);
    if (!status.checks.leanRepoExists) {
      console.warn('[LeanBridge] Lean repo not found at ' + this.leanPath);
    }

    // Check if .NET is available
    return new Promise((resolve) => {
      const proc = spawn('dotnet', ['--version']);
      let output = '';

      proc.stdout.on('data', (data) => { output += data; });
      proc.on('close', (code) => {
        status.checks.dotnetAvailable = code === 0;
        if (code === 0) {
          status.dotnetVersion = output.trim();
        }
        console.log('[LeanBridge] Bridge initialized:', status.checks);
        resolve(status);
      });

      setTimeout(() => {
        status.checks.dotnetAvailable = false;
        console.warn('[LeanBridge] .NET check timeout');
        resolve(status);
      }, 5000);
    });
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HardgateLeanBridge;
}
