# P3 Solidity Framework — Quick Reference

## Overview

P3 adds **39 points** to the OMNIROUTE solidity framework, bringing the total from 100 to **139 points**. The three P3 indicators are logically distinct from P0-P2, research-backed, performance-critical, and gracefully degrade to 0pts when data is unavailable.

---

## P3 Functions

### P3.1: Order Flow Confluence (12 pts)

**Function:** `hgOmniOrderFlowScore(setup)`

**Input:**
```javascript
setup.extra.orderFlow = {
  imbalance: <number>,      // Order flow delta (e.g., +2.45 for +2.45σ bias)
  sigma: <number>,          // Volatility of imbalance (e.g., 1.0)
  sustainedBars: <number>   // Duration of sustained imbalance (e.g., 8)
}
```

**Scoring:**
- **12 pts**: +2σ imbalance aligned with direction (strong conviction)
- **10 pts**: +1σ imbalance aligned
- **5 pts**: ±0.5σ imbalance aligned
- **0 pts**: Counterflow or order flow unavailable

**Bonus:**
- **+3 pts** if imbalance sustained >5 bars (capped at 12 total)

**Output:**
```javascript
{
  score: <0-12>,
  detail: <string>,
  maxScore: 12,
  flowAvailable: <boolean>,
  imbalance: <number>,
  aligned: <boolean>,
  sustainedBars: <number>,
  flowBonus: <number>
}
```

**Use Case:** Identifies setups where order flow (bid/ask imbalance) supports your direction. True edge many traders miss; directly measurable from broker/onchain data.

---

### P3.2: Structural Support/Resistance Confluence (15 pts)

**Function:** `hgOmniStructureConfluenceScore(setup)`

**Input:**
```javascript
setup.rows   // Array of OHLCV bars (min 20 bars)
setup.plan   // Must include entry, stop levels
```

**Scoring:**
- **15 pts**: Entry within 0.25x ATR of 2+ structural levels (strong confluence)
- **10 pts**: Entry within 0.25x ATR of 1 level, OR 0.5x ATR of 2+ levels
- **5 pts**: Entry within 0.5x ATR of 1 level, OR 1.0x ATR of 2+ levels
- **0 pts**: No structural proximity

**Bonus:**
- **+3 pts** if stop positioned on structural level (capped at 15 total)

**Structural Levels Detected:**
- Swing highs/lows (recent 15-30 bars)
- Round numbers (multiples of 0.5 or 1.0)
- Could extend to VWAP, previous highs/lows

**Output:**
```javascript
{
  score: <0-15>,
  detail: <string>,
  maxScore: 15,
  confluenceCount: <number>,
  nearestStructure: <number>,
  confluenceAt025: <number>,
  confluenceAt05: <number>,
  stopBonus: <number>
}
```

**Use Case:** Wyckoff-level thinking — entry at confluence of multiple structural levels (support, resistance, round numbers) increases edge. Stop on structure = good discipline.

---

### P3.3: Momentum Convergence (12 pts)

**Function:** `hgOmniMomentumConvergenceScore(setup)`

**Input:**
```javascript
setup.rows   // Array of OHLCV bars (min 30 bars)
setup.hit.dir // 'long' or 'short'
```

**Scoring:**
- **12 pts**: All 3+ indicators agree on direction
- **8 pts**: 2 of 3 indicators agree
- **4 pts**: 1 of 3 aligns
- **0 pts**: None available or all disagree

**Momentum Indicators Checked:**
1. **RSI(14)**: >50 = bullish, <50 = bearish
2. **MACD(12,26,9)**: >0 = bullish, <0 = bearish
3. **Stochastic(14)**: >50 = bullish, <50 = bearish

**Output:**
```javascript
{
  score: <0-12>,
  detail: <string>,
  maxScore: 12,
  agreements: <number>,
  indicatorsAvailable: <number>
}
```

**Use Case:** Confirmation layer for technical trades. When RSI, MACD, and Stochastic all agree, momentum is strong. Never vetoes (graceful degradation if data missing).

---

## Integration into hgOmniSolidityScore()

The three P3 functions are automatically integrated into `hgOmniSolidityScore()`:

```javascript
const solidityScore = hgOmniSolidityScore(setup, horizonLabel);

solidityScore.score           // Total score (0-139)
solidityScore.maxScore        // 139
solidityScore.tier            // 'extremely_solid' | 'solid' | 'fair' | 'weak'

// Full 12-pillar breakdown:
solidityScore.breakdown.orderFlow             // P3.1: 0-12 pts
solidityScore.breakdown.structureConfluence   // P3.2: 0-15 pts
solidityScore.breakdown.momentumConvergence   // P3.3: 0-12 pts
```

---

## Tier Mapping (139-point scale)

| Score | Tier | Interpretation |
|-------|------|---|
| 115+ | Extremely Solid | Setup passes most pillars; high confidence entry |
| 90-114 | Solid | Setup passes major pillars; tradeable |
| 65-89 | Fair | Setup has merit but missing some confluence |
| <65 | Weak | Setup lacks sufficient confluence; caution advised |

---

## Data Requirements

### Required for All P3 Functions:
- Minimum **20 bars** of OHLCV data (4-hour or higher timeframe recommended)
- Valid `setup.hit.dir` ('long' or 'short')
- Valid `setup.plan` with entry/stop levels

### Optional (Graceful Degradation):
- **Order Flow**: If `setup.extra.orderFlow` unavailable → score 0, never veto
- **Structure**: Auto-detects from price action; 0pts if insufficient bars
- **Momentum**: If <30 bars or indicators NaN → score 0, never veto

---

## Code Quality Notes

### Performance:
- Each function executes in **<10ms** on typical setup data
- No external API calls; all calculations from OHLCV bars

### Architecture:
- **Zero modifications to P0/P1/P2** (fully backward-compatible)
- All P3 functions exported to `window` for browser testing
- Graceful degradation: missing data = 0pts, never blocks trades

### Tuning Points (in omniroute.js):
- Order Flow sigma thresholds: lines 2193-2213
- Structure ATR distances: lines 2289-2295
- Momentum RSI/MACD/Stoch levels: lines 2335-2350

---

## Browser Testing

```javascript
// Load omniroute.js, then:

// Test Order Flow
const flowScore = window.hgOmniOrderFlowScore(setup);
console.log(flowScore.score, flowScore.detail);

// Test Structural Confluence
const structScore = window.hgOmniStructureConfluenceScore(setup);
console.log(structScore.score, structScore.detail);

// Test Momentum Convergence
const momScore = window.hgOmniMomentumConvergenceScore(setup);
console.log(momScore.score, momScore.detail);

// Full Solidity Score (12 pillars)
const full = window.hgOmniSolidityScore(setup);
console.log(full.score, '/', full.maxScore, full.tier);
console.log(full.breakdown);
```

---

## Next Steps (P4+)

Remaining capacity to 200 points: **61 points**

Recommended P4 additions:
- **Liquidation Recovery Confidence (10-12 pts)**: Detect if sweeps historically precede reversals
- **Volatility Term Structure Alignment (10 pts)**: Entry during optimal vol periods
- **Risk-Adjusted Position Sizing (10-15 pts)**: Kelly criterion or expectancy-based sizing
- **Correlation/Hedge Benefit (8-12 pts)**: Multi-leg trade correlation analysis
- **Slippage & Execution Scoring (6-10 pts)**: Realistic fill scenarios

---

## References

- **P0 Pillars (55 pts)**: Order Blocks (15), FVG (10), Multi-TF EMA Cascade (10), Risk:Reward (20)
- **P1 Pillars (25 pts)**: Regime (10), ATR Expansion (8), Session Timing (7)
- **P2 Pillars (20 pts)**: Liquidation (12), Expectancy (8)
- **P3 Pillars (39 pts)**: Order Flow (12), Structural Confluence (15), Momentum (12)

**Total Framework: 139 points (toward 200-point target)**
