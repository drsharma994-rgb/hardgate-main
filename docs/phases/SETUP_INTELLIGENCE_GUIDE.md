# HARDGATE Setup Intelligence System

## Overview

**This is NOT a trading bot.** This is an intelligent setup recording and analysis system that:

1. **Records every setup** formed in each tab (GOLD ULTRA, OMNIGOLD, CRYPTO SCAN, etc.)
2. **Tracks outcomes** - whether each setup hit TP or SL
3. **Analyzes patterns** - identifies which setups perform best
4. **Provides daily intelligence** - shows you which patterns work, ranked by win rate
5. **Suggests improvements** - helps you form better setups with higher conviction

All data is recorded daily and analyzed to help you become a better trader.

---

## Quick Start

### 1. Load the System

The system loads automatically when HARDGATE starts. Check the browser console:

```javascript
// System status
HG_SETUP_INIT()

// Should show:
{
  status: 'ready',
  today: { totalSetups: 0, closedSetups: 0, openSetups: 0 },
  historical: { totalClosed: 0, winRate: '0%' },
  timestamp: '...'
}
```

### 2. Record a Setup

When you identify a setup in any tab, record it:

```javascript
// From console or tab JavaScript
HG_RECORD_SETUP({
  symbol: 'BTC/USDT',
  tabName: 'GOLD ULTRA',        // Which tab identified this
  direction: 'LONG',             // LONG or SHORT
  pattern: 'DOUBLE_BOTTOM',      // Pattern name (any string)
  
  entryPrice: 45300,
  stopLoss: 44800,
  tp1: 46000,                    // First target (50% exit)
  tp2: 47000,                    // Second target (full exit)
  
  confidence: 0.75,              // 0.0-1.0 (how sure you are)
  tier: 'PROFESSIONAL',          // STANDARD, PROFESSIONAL, PROFESSIONAL-GRADE
  
  indicators: ['RSI_DIVERGENCE', 'MOVING_AVERAGE'],
  notes: 'Break above daily resistance'
});
```

**Returns**: Setup object with unique ID for tracking

### 3. Track Setup Outcome

When the setup reaches TP or SL, record the outcome:

```javascript
// When setup hits Take Profit
HG_TRACK_OUTCOME(setupId, {
  type: 'TP2_HIT',      // TP1_HIT, TP2_HIT, SL_HIT, PARTIAL
  exitPrice: 47000
});

// When setup hits Stop Loss
HG_TRACK_OUTCOME(setupId, {
  type: 'SL_HIT',
  exitPrice: 44800
});
```

---

## Dashboard & Reports

### Live Dashboard

The setup intelligence dashboard shows:
- **Today's Performance**: Total setups, closed, win rate
- **Historical Metrics**: Overall win rate, avg risk/reward
- **Top Setups**: Best performing setups (this week/month)
- **Insights**: Patterns that work, which tabs are performing

Updates automatically every 2 minutes.

### Daily Report

At midnight (or manually):

```javascript
// Get daily analysis
HG_SETUP_INTELLIGENCE.analyzeTodaySetups()

// Returns:
{
  date: '2026-09-13',
  totalSetups: 12,
  closedSetups: 8,
  openSetups: 4,
  tpHits: 6,
  slHits: 2,
  partial: 0,
  winRate: 0.75,              // 75% win rate
  avgRiskReward: 1.85,        // Average R/R ratio
  setupsByTab: { GOLD_ULTRA: [...], ... },
  setupsByPattern: { DOUBLE_BOTTOM: [...], ... }
}
```

### Get Setup Suggestions

Before forming a new setup, check historical performance:

```javascript
// Get suggestions for a pattern
window.HG_SETUP_BOOTSTRAP.getSuggestionsForNewSetup('DOUBLE_BOTTOM', 'GOLD ULTRA')

// Returns:
{
  pattern: 'DOUBLE_BOTTOM',
  tabName: 'GOLD ULTRA',
  patternPerformance: {
    winRate: '82.5%',        // Historical win rate
    avgRiskReward: '2.1',    // Historical avg R/R
    dataPoints: 20           // Number of setups analyzed
  },
  tabPerformance: {
    winRate: '76.3%',        // Tab's overall win rate
    dataPoints: 50
  }
}
```

---

## How to Integrate with Your Tab

### Example: GOLD ULTRA Tab

In your tab's signal generation code:

```javascript
// When you identify a setup signal
function onGoldUltraSignal(symbol, direction, entryPrice, stopLoss, tp1, tp2) {
  // Record it with the setup intelligence system
  const setup = HG_RECORD_SETUP({
    symbol: symbol,
    tabName: 'GOLD ULTRA',
    direction: direction,
    pattern: determinePattern(signal),  // Your pattern detection
    entryPrice: entryPrice,
    stopLoss: stopLoss,
    tp1: tp1,
    tp2: tp2,
    confidence: calculateConfidence(signal),  // Your confidence score
    tier: determineTier(signal),  // Your tier classification
    indicators: extractIndicators(signal),
    notes: signal.notes
  });

  // Store setup ID for later outcome tracking
  window.activeSetup = setup;  // Or use your own storage

  // Display to user (DO NOT trade automatically)
  displaySetupToUser(setup);
}

// When TP or SL is reached
function onSetupOutcome(outcome) {
  if (window.activeSetup) {
    HG_TRACK_OUTCOME(window.activeSetup.id, {
      type: outcome,  // TP1_HIT, TP2_HIT, SL_HIT
      exitPrice: currentPrice
    });
  }
}
```

### Example: OMNIGOLD Tab

```javascript
// Similar pattern for OMNIGOLD
const setup = HG_RECORD_SETUP({
  ...setupData,
  tabName: 'OMNIGOLD'
});
```

### Example: CRYPTO SCAN Tab

```javascript
// And for CRYPTO SCAN
const setup = HG_RECORD_SETUP({
  ...setupData,
  tabName: 'CRYPTO SCAN'
});
```

---

## Accessing the Intelligence Engine

### From Browser Console

```javascript
// Get the engine
const engine = window.HG_SETUP_INTELLIGENCE;

// List today's setups
engine.getTodaySetups()

// List by tab
engine.getSetupsByTab('GOLD ULTRA')

// List by symbol
engine.getSetupsBySymbol('BTC/USDT')

// List by pattern
engine.getSetupsByPattern('DOUBLE_BOTTOM')

// Get all closed setups (with outcomes)
engine.getClosedSetups()

// Get all open setups (waiting for outcome)
engine.getOpenSetups()

// Rank setups by performance
engine.rankSetupsByPerformance()

// Generate full intelligence report
engine.generateIntelligenceReport()

// Get performance analysis
engine.analyzeAllSetups()
```

---

## Understanding the Data

### Setup Object

```javascript
{
  id: 'setup_1694520000000_abc123',
  timestamp: '2026-09-13T14:30:00.000Z',
  date: '2026-09-13',
  
  // Identification
  symbol: 'BTC/USDT',
  tabName: 'GOLD ULTRA',
  direction: 'LONG',
  pattern: 'DOUBLE_BOTTOM',
  
  // Price levels
  entryPrice: 45300,
  stopLoss: 44800,
  takeProfit1: 46000,
  takeProfit2: 47000,
  
  // Metadata
  confidence: 0.75,     // 0-1 (trader's conviction)
  tier: 'PROFESSIONAL', // Strength rating
  indicators: [...],
  notes: 'break above daily resistance',
  
  // Outcome (filled when setup closes)
  outcome: 'TP2_HIT',   // null if still open
  exitPrice: 47000,
  exitTime: '2026-09-13T16:45:00.000Z',
  pnl: 1700,            // Exit price - Entry price
  riskReward: 1.89,     // (TP average - Entry) / (Entry - SL)
  duration: 7200000,    // Time open in milliseconds
  
  status: 'CLOSED'      // OPEN or CLOSED
}
```

### Performance Metrics

```javascript
{
  overall: {
    winRate: 0.72,          // 72% of closed setups hit TP
    tpHitRate: 0.72,        // Setups that hit TP (TP1 or TP2)
    slHitRate: 0.18,        // Setups that hit SL
    avgRiskReward: 1.85     // Average R/R across all setups
  },
  
  byTab: {
    'GOLD ULTRA': {
      total: 25,
      closed: 22,
      winRate: 0.77,        // 77% win rate
      avgRR: 1.92
    },
    'OMNIGOLD': {
      total: 18,
      closed: 15,
      winRate: 0.67,        // 67% win rate
      avgRR: 1.71
    }
  },
  
  byPattern: {
    'DOUBLE_BOTTOM': {
      total: 12,
      closed: 10,
      winRate: 0.80,        // 80% win rate
      avgRR: 2.1
    },
    'BREAKOUT': {
      total: 8,
      closed: 7,
      winRate: 0.57,        // 57% win rate
      avgRR: 1.5
    }
  }
}
```

---

## Daily Analysis Example

```javascript
// Get today's analysis
const todayAnalysis = HG_SETUP_INTELLIGENCE.analyzeTodaySetups();

console.log(todayAnalysis);

/* Output:
{
  date: '2026-09-13',
  totalSetups: 12,
  closedSetups: 8,
  openSetups: 4,
  tpHits: 6,
  slHits: 2,
  partial: 0,
  winRate: 0.75,
  avgRiskReward: 1.85,
  
  setupsByTab: {
    GOLD_ULTRA: { ... setups from that tab ... },
    OMNIGOLD: { ... setups from that tab ... }
  },
  
  setupsByPattern: {
    DOUBLE_BOTTOM: { ... setups with that pattern ... },
    BREAKOUT: { ... setups with that pattern ... }
  },
  
  topSymbols: [
    { name: 'BTC/USDT', totalSetups: 5, closedSetups: 4, winRate: 0.75 },
    { name: 'ETH/USDT', totalSetups: 3, closedSetups: 3, winRate: 0.67 }
  ]
}
*/
```

---

## Using Intelligence to Improve Setups

### Before Forming a New Setup

```javascript
// Check historical performance of your pattern
const pattern = 'DOUBLE_BOTTOM';
const tab = 'GOLD ULTRA';

const suggestions = window.HG_SETUP_BOOTSTRAP.getSuggestionsForNewSetup(pattern, tab);

if (suggestions.patternPerformance) {
  console.log(`Pattern ${pattern}:`);
  console.log(`  - Win Rate: ${suggestions.patternPerformance.winRate}`);
  console.log(`  - Avg R/R: ${suggestions.patternPerformance.avgRiskReward}`);
}

// Decision: Is this pattern reliable enough?
if (parseFloat(suggestions.patternPerformance.winRate) > 70) {
  // Yes - form the setup with confidence
  console.log('✅ High conviction pattern - proceed with setup');
} else {
  // No - either skip or increase stop loss to improve R/R
  console.log('⚠️ Low win rate - consider wider stops or skip');
}
```

### Tracking Pattern Quality Over Time

```javascript
// Compare patterns in your tab
const allSetups = HG_SETUP_INTELLIGENCE.getSetupsByTab('GOLD ULTRA');

const patternStats = {};
allSetups.forEach(s => {
  if (!patternStats[s.pattern]) {
    patternStats[s.pattern] = { total: 0, wins: 0 };
  }
  patternStats[s.pattern].total++;
  if (s.outcome && s.outcome.includes('TP')) {
    patternStats[s.pattern].wins++;
  }
});

// Rank by win rate
Object.entries(patternStats)
  .map(([pattern, stats]) => ({
    pattern,
    winRate: stats.wins / stats.total,
    dataPoints: stats.total
  }))
  .sort((a, b) => b.winRate - a.winRate)
  .slice(0, 5)
  .forEach(p => {
    console.log(`${p.pattern}: ${(p.winRate*100).toFixed(1)}% (${p.dataPoints} setups)`);
  });

/* Output:
DOUBLE_BOTTOM: 80.0% (10 setups)
BREAKOUT: 65.0% (8 setups)
REVERSAL: 62.5% (5 setups)
FLAG: 50.0% (4 setups)
WEDGE: 40.0% (2 setups)
*/
```

---

## Best Practices

### ✅ DO

1. **Record EVERY setup** - even ones you're unsure about
2. **Track outcomes consistently** - TP/SL/partial when they happen
3. **Use different patterns** - name your patterns clearly (DOUBLE_BOTTOM, not DB)
4. **Set confidence levels** - 0.5 = uncertain, 0.75 = confident, 0.95 = very sure
5. **Review daily reports** - what patterns work in your tab?
6. **Tier your setups** - STANDARD/PROFESSIONAL/PROFESSIONAL-GRADE
7. **Use the insights** - let historical data guide better setup formation

### ❌ DON'T

1. **Automate trading** - this system only records and analyzes
2. **Ignore low-win-rate patterns** - they'll drag down your edge
3. **Forge outcomes** - always record real TP/SL hits
4. **Skip setup recording** - the more data, the better the insights
5. **Rely solely on one tab** - compare across all 6 tabs
6. **Ignore risk/reward** - track it alongside win rate
7. **Set unrealistic targets** - base them on your historical R/R

---

## Dashboard Guide

### Status Indicators

**Green (#00d084)** - Good/Winning metric
- Win rate 70%+
- Avg R/R 1.5+
- Setup hit TP

**Yellow (#ffd700)** - Neutral/Needs attention
- Win rate 50-70%
- Avg R/R 1.0-1.5
- Setup in progress

**Red (#ff4444)** - Poor/Losing metric
- Win rate <50%
- Avg R/R <1.0
- Setup hit SL

### Updating Dashboards

Dashboards update automatically every 2 minutes. To force an update:

```javascript
// Manually update intelligence dashboard
window.HG_SETUP_BOOTSTRAP.updateIntelligenceDashboard();

// Run daily analysis manually
window.HG_SETUP_BOOTSTRAP.runDailyAnalysis();
```

---

## Advanced: Custom Analysis

```javascript
// Analyze win rate by confidence level
const allClosed = HG_SETUP_INTELLIGENCE.getClosedSetups();

const byConfidence = {
  low: { total: 0, wins: 0 },     // 0.0-0.6
  medium: { total: 0, wins: 0 },  // 0.6-0.8
  high: { total: 0, wins: 0 }     // 0.8-1.0
};

allClosed.forEach(s => {
  const bucket = s.confidence < 0.6 ? 'low' : s.confidence < 0.8 ? 'medium' : 'high';
  byConfidence[bucket].total++;
  if (s.outcome && s.outcome.includes('TP')) {
    byConfidence[bucket].wins++;
  }
});

console.log('Win Rate by Confidence:');
Object.entries(byConfidence).forEach(([level, stats]) => {
  if (stats.total > 0) {
    const rate = (stats.wins / stats.total * 100).toFixed(1);
    console.log(`${level.toUpperCase()}: ${rate}% (${stats.total} setups)`);
  }
});

/* Output:
LOW: 58.0% (15 setups)
MEDIUM: 71.0% (25 setups)
HIGH: 85.0% (20 setups)
*/
```

---

## Data Storage

Setup data is stored in memory during the session. For persistence:

```javascript
// Export today's data
const today = HG_SETUP_INTELLIGENCE.getTodaySetups();
const json = JSON.stringify(today, null, 2);
console.log(json);

// Copy and save to file or database
// This ensures you don't lose historical data
```

---

## Troubleshooting

### Dashboard not appearing

```javascript
// Check if system is initialized
console.log(HG_SETUP_INTELLIGENCE);  // Should not be undefined

// Check status
HG_SETUP_INIT();

// Manually update dashboard
HG_SETUP_BOOTSTRAP.updateIntelligenceDashboard();
```

### Setups not recording

```javascript
// Check if helper is available
console.log(typeof HG_RECORD_SETUP);  // Should be 'function'

// Try recording manually
const setup = HG_RECORD_SETUP({
  symbol: 'TEST/TEST',
  tabName: 'TEST',
  direction: 'LONG',
  pattern: 'TEST',
  entryPrice: 100,
  stopLoss: 95,
  tp1: 110,
  tp2: 120,
  confidence: 0.5
});

console.log('Setup created:', setup);  // Should show setup object
```

### Outcomes not tracking

```javascript
// Verify setup ID
const setup = HG_RECORD_SETUP(...);
console.log('Setup ID:', setup.id);

// Track outcome with correct ID
HG_TRACK_OUTCOME(setup.id, {
  type: 'TP1_HIT',
  exitPrice: 110
});

// Check if outcome was recorded
const updated = HG_SETUP_INTELLIGENCE.getSetupsBySymbol('TEST/TEST')[0];
console.log('Updated setup:', updated);  // Should show outcome
```

---

## Next Steps

1. **Start recording setups** from one tab (GOLD ULTRA recommended)
2. **Track outcomes** consistently for 2-4 weeks
3. **Analyze results** - what patterns work in your style?
4. **Adjust approach** - increase conviction on high-win-rate patterns
5. **Expand to other tabs** - compare performance across HARDGATE
6. **Optimize entry/exit** - use R/R analysis to improve setups
7. **Build edge** - let data guide your setup formation

---

## System API Reference

### Engine (HG_SETUP_INTELLIGENCE)

```javascript
// Recording
recordSetup(setupData)
updateSetupOutcome(setupId, outcome)

// Retrieval
getSetupsByDate(date)
getSetupsByTab(tabName)
getSetupsBySymbol(symbol)
getSetupsByPattern(pattern)
getTodaySetups()
getClosedSetups()
getOpenSetups()

// Analysis
analyzeTodaySetups()
analyzeAllSetups()
rankSetupsByPerformance()
suggestSetupImprovements(setup)

// Reporting
generateIntelligenceReport()
generateInsights(todayAnalysis, allAnalysis)
```

### Bootstrap (HG_SETUP_BOOTSTRAP)

```javascript
// Initialization
initialize()
getStatus()

// Hooks
hookIntoTabSetupFormation()
trackSetupOutcome(setupId, outcome)
getSuggestionsForNewSetup(pattern, tabName)

// Dashboard
startDailyAnalysis()
runDailyAnalysis()
startDashboardUpdates()
updateIntelligenceDashboard()

// UI
getUISnippet()
```

### Global Helpers

```javascript
HG_RECORD_SETUP(setupData)        // Record new setup
HG_TRACK_OUTCOME(setupId, outcome) // Track TP/SL
HG_SETUP_INIT()                   // Get system status
```

---

**Ready to start building your setup intelligence? Record your first setup with `HG_RECORD_SETUP()`!**
