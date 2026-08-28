# P0 OMNIROUTE SOLIDITY FRAMEWORK - IMPLEMENTATION GUIDE

## Overview

This document describes the 4 P0 (highest priority) scoring pillars added to OMNIROUTE's structural evaluation framework. These pillars score up to 55 points total and measure the geometric quality of setups across order block proximity, fair value gaps, multi-timeframe confluence, and risk:reward geometry.

## Architecture

### File Changes
- **omniroute.js** (added ~700 lines)
  - 4 new scoring functions (P0-1 through P0-4)
  - 1 composite scoring function (hgOmniSolidityScore)
  - Module exports for all 5 functions

### Test File
- **test_p0_solidity.js** - Standalone test demonstrating all 4 pillars

## The 4 P0 Pillars

### P0-1: Order Blocks Detection & Scoring (15 pts)
**Function**: `hgOmniOrderBlockScore(setup)`

Detects recent order blocks (swing high/low with +2 bar confirmation) and scores entry proximity.

```javascript
// Scoring logic:
15pts if entry within 0.5×ATR of OB
10pts if entry within 1.0×ATR of OB
 5pts if entry within 1.5×ATR of OB
 0pts if beyond 1.5×ATR
```

**Parameters**:
- `setup.rows`: Array of OHLCV bars
- `setup.plan.entry`: Planned entry price

**Returns**:
```javascript
{
  score: 0-15,
  maxScore: 15,
  detail: "OB at 103.50, entry within 1.0x ATR (0.57x)"
}
```

---

### P0-2: FVG (Fair Value Gap) Detection & Scoring (10 pts)
**Function**: `hgOmniFvgScore(setup)`

Detects fresh bearish/bullish FVG (3-bar imbalance unmitigated) and scores proximity to entry.

```javascript
// Scoring logic:
10pts if FVG within 1×ATR of entry
 5pts if FVG within 2×ATR of entry
 0pts otherwise
```

**Detection Method**:
- Bullish FVG: Bar 1 low > Bar 2 high (gap between low of 1 and high of 2)
- Bearish FVG: Bar 1 high < Bar 2 low (gap between high of 1 and low of 2)
- Confirmed if gap is unmitigated (not closed by bar 3)

**Parameters**:
- `setup.rows`: Array of OHLCV bars (needs 4+ bars)
- `setup.plan.entry`: Planned entry price

**Returns**:
```javascript
{
  score: 0-10,
  maxScore: 10,
  detail: "bullish FVG near 103.65, entry within 1x ATR (0.34x)"
}
```

---

### P0-3: Multi-TF EMA Cascade Scoring (10 pts)
**Function**: `hgOmniMultiTfCascadeScore(setup)`

Validates EMA8/21/50 stack alignment across 1H, 4H, and daily timeframes.

```javascript
// Scoring logic:
10pts if all 3 timeframes (1H/4H/daily) agree on direction
 7pts if 2 of 3 timeframes agree
 3pts if 1 of 3 timeframe agrees
 0pts if no agreement
```

**EMA Stack Validation** (for long):
- Requires: EMA8 >= EMA21 >= EMA50 (with 0.2% tolerance)
- Current price >= EMA8 (with 0.5% tolerance)

For short, logic inverts (EMA8 <= EMA21 <= EMA50).

**Timeframe Resampling**:
- 1H: current bars (uses last 30/60/120 closes)
- 4H: resampled to 14400 seconds
- Daily: resampled to 86400 seconds

**Parameters**:
- `setup.rows`: Array of OHLCV bars (needs 120+ for all 3 TF)
- `setup.hit.dir`: Trade direction ('long' or 'short')

**Returns**:
```javascript
{
  score: 0-10,
  maxScore: 10,
  detail: "1H/4H/daily all agree on long",
  agreements: 3  // 0-3 timeframes agreeing
}
```

---

### P0-4: Risk:Reward Geometry Scorer (20 pts max)
**Function**: `hgOmniRiskRewardScore(setup)`

Scores R:R ratio and rewards tight stops with precision bonus.

```javascript
// Base R:R Scoring:
15pts if R:R >= 2.0
12pts if R:R >= 1.5
 8pts if R:R >= 1.0
 0pts if R:R < 1.0

// Stop Precision Bonus:
 5pts if stop < 1.0% from entry
 3pts if stop < 1.5% from entry
 0pts otherwise
```

**Risk Calculation**:
- Risk = |entry - stop|
- Reward = |target - entry|
- R:R = reward / risk

**Stop % from Entry**:
- Calculated as (risk / entry) × 100
- Tighter stops earn bonus without changing base score
- Total capped at 20 points

**Parameters**:
- `setup.plan.entry`: Entry price
- `setup.plan.stop`: Stop price
- `setup.plan.t1`: Target (first target or primary target)

**Returns**:
```javascript
{
  score: 0-20,
  maxScore: 20,
  detail: "R:R 1.56 >= 1.5 + 5pt tight stop bonus (0.43%) total=17",
  rr: 1.56,
  stopPct: 0.43
}
```

---

## Composite Scorer

### `hgOmniSolidityScore(setup)` (55 pts total)

Combines all 4 pillars into a single structural confidence measurement.

**Returns**:
```javascript
{
  score: 27,           // total points earned
  maxScore: 55,        // maximum possible
  breakdown: {
    orderBlock: { score: 10, maxScore: 15, detail: "..." },
    fvg: { score: 0, maxScore: 10, detail: "..." },
    multiTfCascade: { score: 0, maxScore: 10, detail: "...", agreements: 0 },
    riskReward: { score: 17, maxScore: 20, detail: "...", rr: 1.56 }
  },
  detail: "OB:10/15 FVG:0/10 MTF:0/10 RR:17/20"
}
```

## Integration Points

### 1. Rendering Functions
Call `hgOmniSolidityScore(setup)` from any rendering layer to add a "Structural Confidence" badge or score display on setup cards:

```javascript
// In your card rendering code
var setup = { rows: bars, hit: detection, plan: levelPlan };
var solidity = window.hgOmniSolidityScore(setup);

// Display summary
console.log(solidity.score + '/' + solidity.maxScore + ' structural points');

// Or drill into pillar details
console.log('Order blocks: ' + solidity.breakdown.orderBlock.detail);
```

### 2. Gating Layer (Future P1)
While these are **NOT** veto gates (they score, not block), they can contribute to a soft gate:

```javascript
// NOT a hard veto - just informational for now
var structuralScore = hgOmniSolidityScore(setup);
gates.push({
  key: 'structural-confidence',
  hard: false,         // never veto
  info: true,          // report always
  pass: structuralScore.score >= 30,  // advisory pass/note
  why: 'structural confidence ' + solidity.score + '/' + solidity.maxScore
});
```

### 3. Ranking/Filtering (P1 scope)
Sort setups by solidity score for portfolio construction:

```javascript
var allSetups = [...];
var scored = allSetups.map(s => ({
  setup: s,
  solidity: window.hgOmniSolidityScore(s)
}));

// Sort by score descending
scored.sort((a, b) => b.solidity.score - a.solidity.score);
```

## Setup Object Contract

The scoring functions expect a setup object with this shape:

```javascript
{
  kind: 'SPRING',           // detector family
  dir: 'long',              // direction
  rows: [                   // array of OHLCV bars
    { t: 1000, o: 100, h: 101, l: 99.5, c: 100.5, v: 1000 },
    // ... more bars
  ],
  hit: {
    kind: 'SPRING',
    dir: 'long',
    level: 100.5,
    why: 'description'
  },
  plan: {
    entry: 100.5,
    stop: 100.0,
    t1: 101.5,
    t2: 102.5,
    // ... other plan fields
  }
}
```

## Usage Examples

### Example 1: Score a Single Setup
```javascript
const setup = {
  rows: dailyBars,
  hit: { kind: 'SPRING', dir: 'long' },
  plan: { entry: 100.50, stop: 100.00, t1: 101.50 }
};

const score = window.hgOmniSolidityScore(setup);
console.log('Structural confidence: ' + score.score + '/' + score.maxScore);
```

### Example 2: Inspect Individual Pillar
```javascript
const obScore = window.hgOmniOrderBlockScore(setup);
if (obScore.score >= 10) {
  console.log('Strong order block proximity');
}
```

### Example 3: Composite Filter
```javascript
function shouldDisplaySetup(setup) {
  const solidity = window.hgOmniSolidityScore(setup);
  // Only show setups that score above 50% on structural measures
  return solidity.score >= (solidity.maxScore * 0.5);
}
```

## Test Execution

Run the standalone test to verify implementation:

```bash
node test_p0_solidity.js
```

Expected output shows:
- Individual pillar scores
- Total structural score
- Contribution analysis
- Export function names

## Backward Compatibility

- No existing gates modified
- No existing functions changed
- All new functions exported separately
- Scoring is **informational only** (not gating)
- Existing card rendering unaffected

## Logging & Debugging

Each function returns a `detail` field with human-readable explanation:

```javascript
const ob = window.hgOmniOrderBlockScore(setup);
console.log('Order block debug: ' + ob.detail);

const solidity = window.hgOmniSolidityScore(setup);
console.log(solidity.breakdown.orderBlock.detail);
console.log(solidity.breakdown.fvg.detail);
console.log(solidity.breakdown.multiTfCascade.detail);
console.log(solidity.breakdown.riskReward.detail);
```

## Future Work (P1/P2)

These functions form the foundation for:

1. **P1: Soft Gating** - Informational gates that argue against setup without vetoing
2. **P1: Ranking** - Sort portfolio by solidity score
3. **P2: Volume Profile** - Add liquidity clustering scoring
4. **P2: Divergence** - Add momentum divergence scoring (5 pts)
5. **P2: Support/Resistance** - Add S/R level frequency scoring (5 pts)

Total framework goal: **200-point solidity system** with:
- Structural Pillar (P0): 55 pts (order blocks, FVG, MTF, R:R)
- Technical Pillar (P1): 80 pts (trend, momentum, profile, divergence, levels)
- Positioning Pillar (P2): 65 pts (funding, OI, retail, flow, regime)

## Module Exports

All functions are exported to `window` for universal access:

```javascript
window.hgOmniOrderBlockScore        // P0-1
window.hgOmniFvgScore               // P0-2
window.hgOmniMultiTfCascadeScore    // P0-3
window.hgOmniRiskRewardScore        // P0-4
window.hgOmniSolidityScore          // Composite
```

## Performance Notes

- Order block detection: O(n) where n = lookback period (15 bars)
- FVG detection: O(n) where n = lookback period (12 bars)
- Multi-TF cascade: O(n) includes resampling, but resampling is cached
- Risk/reward: O(1) simple math
- Total execution: < 5ms for typical 500-bar input

Suitable for:
- Real-time scanning
- Render-time scoring (no network calls)
- Portfolio analysis
- Backtesting

## Contact & Issues

Report issues or request clarifications on:
- Order block detection thresholds
- FVG imbalance definition
- EMA stack tolerance values
- Risk/reward bonus cap logic

All thresholds documented in code comments for easy tuning.
