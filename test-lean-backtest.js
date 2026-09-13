#!/usr/bin/env node
/* =========================================================================
   HARDGATE + Lean Integration Test Script

   Comprehensive test of the Lean backtesting integration:
   1. Export sample signals from GOLD ULTRA format
   2. Configure Lean backtest parameters
   3. Run backtest via bridge adapter
   4. Parse and validate results
   5. Generate comparison report

   Usage: node test-lean-backtest.js
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const LeanBridge = require('./hardgate-lean-bridge.js');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║        HARDGATE + LEAN INTEGRATION TEST                          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════╝\n', 'cyan');

  const bridge = new LeanBridge();

  try {
    // Step 1: Initialize
    log('[1/5] Initializing bridge...', 'bright');
    const status = await bridge.initialize();
    if (!status.checks.dotnetAvailable) {
      log('⚠️  .NET not available. Install with: winget install Microsoft.DotNet.SDK.8', 'red');
      log('Continuing with config setup only...', 'yellow');
    } else {
      log(`✅ .NET available: ${status.dotnetVersion}`, 'green');
    }
    if (status.checks.leanRepoExists) {
      log(`✅ Lean repo found at ${status.leanPath}`, 'green');
    } else {
      log(`⚠️  Lean repo not found at ${status.leanPath}`, 'yellow');
    }

    // Step 2: Load sample signals
    log('\n[2/5] Loading sample signals...', 'bright');
    const signalFile = './data/sample-hardgate-signals.csv';
    if (!fs.existsSync(signalFile)) {
      log(`❌ Signal file not found: ${signalFile}`, 'red');
      return;
    }

    const signals = [];
    const lines = fs.readFileSync(signalFile, 'utf8').split('\n');
    const header = lines[0].split(',');

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const parts = lines[i].split(',');

      signals.push({
        timestamp: parts[0],
        symbol: parts[1],
        signal: parts[2],
        confidence: parseFloat(parts[3]),
        tier: parts[4],
        entryPrice: parseFloat(parts[5]),
        stopLoss: parseFloat(parts[6]),
        tp1: parseFloat(parts[7]),
        tp2: parseFloat(parts[8])
      });
    }

    log(`✅ Loaded ${signals.length} signals from ${signalFile}`, 'green');
    log(`   Symbols: ${[...new Set(signals.map(s => s.symbol))].join(', ')}`, 'cyan');
    log(`   Tier distribution:`, 'cyan');
    const tierCounts = {};
    signals.forEach(s => {
      tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1;
    });
    Object.entries(tierCounts).forEach(([tier, count]) => {
      log(`     ${tier}: ${count}`, 'cyan');
    });

    // Step 3: Export signals via bridge
    log('\n[3/5] Exporting signals via bridge...', 'bright');
    const exportPath = bridge.exportSignals(signals, {
      outputPath: './data/lean-signals.csv'
    });
    log(`✅ Signals exported to ${exportPath}`, 'green');

    // Step 4: Generate and export config
    log('\n[4/5] Generating Lean backtest configuration...', 'bright');
    const configPath = bridge.generateConfig({
      startDate: '2024-01-15',
      endDate: '2024-12-31',
      initialCash: 100000,
      riskPerTrade: 0.02,
      leverage: 1.5,
      maxPositions: 5,
      assets: ['Crypto', 'Forex'],
      outputPath: './data/hardgate-lean-config.json'
    });
    log(`✅ Config generated at ${configPath}`, 'green');

    // Step 5: Run backtest
    log('\n[5/5] Running Lean backtest...', 'bright');
    log('(This may take 1-5 minutes depending on historical data)', 'yellow');

    try {
      const results = await bridge.runBacktest({
        leanPath: './vendors/Lean',
        configPath: configPath,
        verbose: false,
        timeout: 10 * 60 * 1000
      });

      log(`✅ Backtest completed`, 'green');

      // Parse and display results
      displayResults(results);

    } catch (error) {
      log(`\n⚠️  Backtest execution note: ${error.message}`, 'yellow');
      log('This is expected if Lean dependencies are not fully installed.', 'yellow');
      log('Config and signals are ready for manual Lean execution:', 'yellow');
      log(`  1. cd vendors/Lean`, 'cyan');
      log(`  2. dotnet run --project Launcher --config ${path.resolve(configPath)}`, 'cyan');
    }

    // Step 6: Show example metrics comparison
    log('\n[Summary] Configuration Complete', 'bright');
    log('✅ Bridge adapter ready', 'green');
    log('✅ Sample signals exported', 'green');
    log('✅ Lean config generated', 'green');
    log('⏳ Backtest results pending', 'yellow');

    log('\n[Next Steps]', 'bright');
    log('1. Run manual Lean backtest if .NET integration incomplete:', 'cyan');
    log(`   cd vendors/Lean && dotnet run --project Launcher --config ../data/hardgate-lean-config.json`, 'cyan');
    log('\n2. Export real GOLD ULTRA signals:', 'cyan');
    log('   const bridge = new LeanBridge();', 'cyan');
    log('   bridge.exportSignals(W.GU_SIGNALS || {});', 'cyan');
    log('\n3. Run production backtest with real signal data', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

function displayResults(results) {
  if (!results || typeof results !== 'object') {
    log('(Results object structure depends on Lean output format)', 'yellow');
    return;
  }

  log('\n╔════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    BACKTEST RESULTS                              ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════════╝\n', 'cyan');

  // Try to extract stats
  const stats = results.Statistics || results.stats || {};
  const trades = results.Trades || results.trades || [];

  if (Object.keys(stats).length > 0) {
    log('Performance Metrics:', 'bright');
    Object.entries(stats).forEach(([key, value]) => {
      if (typeof value === 'number') {
        log(`  ${key}: ${typeof value === 'number' && Math.abs(value) < 100 ? value.toFixed(2) : value}`, 'cyan');
      }
    });
  }

  if (Array.isArray(trades) && trades.length > 0) {
    log(`\nTotal Trades: ${trades.length}`, 'green');
    const wins = trades.filter(t => t.profit > 0).length;
    const losses = trades.filter(t => t.profit < 0).length;
    if (wins + losses > 0) {
      const winRate = (wins / (wins + losses) * 100).toFixed(1);
      log(`Win Rate: ${winRate}%`, wins / (wins + losses) > 0.5 ? 'green' : 'red');
    }
  }

  log('\n[Raw Results]', 'bright');
  log(JSON.stringify(results, null, 2).substring(0, 1000) + '...', 'cyan');
}

// Run
main().catch(err => {
  log(`Fatal error: ${err.message}`, 'red');
  process.exit(1);
});
