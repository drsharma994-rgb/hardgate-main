# P1 Solidity Framework Implementation

## Overview

The P1 Solidity Framework adds three complementary scoring functions (25 points total) to OMNIROUTE's 200-point setup quality evaluation system. These functions enhance visibility into regime alignment, volatility dynamics, and execution timing without introducing hard vetoes.

**Total Capacity:** 80 points (P0: 55 + P1: 25)

---

## Architecture

### Scoring Structure

```
P0 Foundation (55 pts):
  ├─ Order Blocks .................. 15 pts
  ├─ Fair Value Gaps ............... 10 pts
  ├─ Multi-TF EMA Cascade .......... 10 pts
  └─ Risk:Reward Ratio ............. 20 pts

P1 Additions (25 pts):
  ├─ Regime Classification ......... 10 pts
  ├─ ATR Expansion Signal .......... 8 pts
  └─ Session/Execution Timing ...... 7 pts
```

### Integration Point

```javascript
// Main entry point - now accepts optional horizonLabel parameter
hgOmniSolidityScore(setup, horizonLabel)

// Returns enriched breakdown with P1 components:
{
  score: <number>,              // Total score (0-80)
  maxScore: 80,                 // Full P0+P1 capacity
  breakdown: {
    // P0 components...
    // P1 components:
    regime: { score, maxScore, detail, regime },
    atrExpansion: { score, maxScore, detail, status },
    sessionTiming: { score, maxScore, detail, session }
  },
  detail: "OB:X/15 FVG:X/10 MTF:X/10 RR:X/20 REG:X/10 ATR:X/8 SES:X/7"
}
```

---

## P1.1: Regime Classification Scoring (10 pts)

**Function:** `hgOmniRegimeScore(setup)`

**Purpose:** Score alignment between setup direction and market regime (TRENDING, RANGE, COMPRESSION, REVERSAL).

### Scoring Logic

| Scenario | Score | Rationale |
|----------|-------|-----------|
| Trending regime + matching direction (long up/short down) | **10 pts** | Perfect alignment; entry flows with trend |
| Range regime (any direction) | **7 pts** | Acceptable for mean-reversion/retracement plays |
| Compression regime | **5 pts** | Caution flag; low liquidity but breakout tradeable |
| Opposite regime (trending up + short entry) | **2 pts** | Counter-trend; requires higher-conviction signal |
| Regime unavailable | **0 pts** | Cannot score without regime context |

### Data Requirements

```javascript
setup = {
  hit: { dir: "LONG" | "SHORT" },           // Required: setup direction
  extra: {
    regime: {
      label: "TRENDING" | "RANGE" | "COMPRESSION" | ...,
      detail: "string explanation"
    }
  }
}
```

### Label Recognition

The function recognizes these regime labels (case-insensitive):
- `TRENDING`, `TREND` → 10 pts when aligned
- `RANGE`, `RANGING` → 7 pts (neutral for reversals)
- `COMPRESSION`, `COILING` → 5 pts (caution)
- `REVERSAL`, `FLIP` → 7 pts (favors reversals)

### Example Outputs

**Example 1: Perfect Alignment**
```javascript
const setup = {
  hit: { dir: 'LONG' },
  extra: { regime: { label: 'TRENDING' } }
};
hgOmniRegimeScore(setup);
// { score: 10, detail: 'trending regime matches long direction', regime: 'TRENDING', maxScore: 10 }
```

**Example 2: Range Market (Reversion Acceptable)**
```javascript
const setup = {
  hit: { dir: 'SHORT' },
  extra: { regime: { label: 'RANGE' } }
};
hgOmniRegimeScore(setup);
// { score: 7, detail: 'range regime acceptable for reversion plays', regime: 'RANGE', maxScore: 10 }
```

**Example 3: Missing Regime (Graceful Degradation)**
```javascript
const setup = {
  hit: { dir: 'LONG' }
  // extra or regime not available
};
hgOmniRegimeScore(setup);
// { score: 0, detail: 'regime unavailable', maxScore: 10 }
```

---

## P1.2: ATR Expansion Signal Scoring (8 pts)

**Function:** `hgOmniAtrExpansionScore(setup)`

**Purpose:** Detect and score volatility expansion (recent ATR trending up vs 20-bar MA) as a signal of increasing entry momentum.

### Scoring Logic

| Condition | Score | Rationale |
|-----------|-------|-----------|
| ATR expanding (recent 5-bar avg > MA20 by >5%) | **8 pts** | Rising volatility = momentum entry opportunity |
| ATR stable (within 5% of MA20) | **4 pts** | Normal volatility; adequate but not ideal |
| ATR contracting (recent 5-bar avg < MA20 by >5%) | **1 pt** | Falling volatility = choppy, risky entry |
| + Vol forecast predicts expansion | **+2 pts** | Bonus when forecast aligns (capped at 8 total) |
| Insufficient data (<25 bars) | **0 pts** | Cannot calculate ATR reliably |

### Calculation Method

```
Expansion Ratio = (5-bar ATR average) / (20-bar ATR moving average)

  >1.05  → 8 pts (expanding)
  0.95-1.05 → 4 pts (stable)
  <0.95  → 1 pt (contracting)
```

### Data Requirements

```javascript
setup = {
  rows: [                              // Required: last 25+ bars
    { o, h, l, c },                   // OHLC bars
    // ...
  ],
  extra: {
    volForecast: {                    // Optional: external vol prediction
      expanding: true | false,
      prediction: "description"
    }
  }
}
```

### Implementation Details

- **5-bar window:** Most recent 5 bars' ATR14 averages
- **20-bar MA:** Historical 20-bar moving average of ATR14
- **ATR period:** Wilder-style ATR(14) per OMNIROUTE standard
- **Expansion threshold:** 5% above/below MA20 to avoid noise

### Example Outputs

**Example 1: Expanding Volatility**
```javascript
const setup = {
  rows: [/* 100 bars of OHLC */],
  extra: { volForecast: { expanding: true } }
};
hgOmniAtrExpansionScore(setup);
// {
//   score: 8,
//   detail: 'ATR expanding: recent avg 2.45 > MA20 2.15 (ratio 1.14) + 2pt vol forecast bonus',
//   atrStatus: 'expanding',
//   expansionRatio: 1.14,
//   volBonus: 2,
//   maxScore: 8
// }
```

**Example 2: Stable Volatility**
```javascript
// Expansion Ratio: 1.00
hgOmniAtrExpansionScore(setup);
// {
//   score: 4,
//   detail: 'ATR stable: recent avg 2.15 ~= MA20 2.15 (ratio 1.00)',
//   atrStatus: 'stable',
//   expansionRatio: 1.00,
//   maxScore: 8
// }
```

---

## P1.3: Session/Execution Timing Scoring (7 pts)

**Function:** `hgOmniSessionTimingScore(setup, horizonLabel)`

**Purpose:** Score trade timing based on current session (LONDON/NY overlap, regional opens) and horizon (SCALP vs SWING).

### Session Windows (IST Time)

| Session | IST Hours | Characteristics |
|---------|-----------|-----------------|
| **LONDON/NY OVERLAP** | 13:00-17:30 | Peak liquidity, tight spreads, high volume |
| **LONDON OPEN** | 05:00-13:00 | Good liquidity, BoE volatility triggers |
| **NY OPEN** | 20:30-00:00 | High volatility, sharp moves, economic data |
| **ASIA** | 00:00-05:00 | Lower liquidity, spread risk, consolidation |
| **QUIET HOURS** | 00:00-05:00 | Penalized: minimal volume |

### Scoring by Horizon

**SCALP (1H, high-frequency)**
| Session | Score | Rationale |
|---------|-------|-----------|
| LONDON/NY OVERLAP | 7 pts | Peak liquidity essential for 1H fills |
| LONDON OPEN | 5 pts | Good entry clarity, moderate spreads |
| NY OPEN | 3 pts | High vol but acceptable on limit orders |
| ASIA | 1 pt | Avoid: wide spreads, thin order books |
| QUIET HOURS | 0 pts | Penalized: unfillable quotes |

**SWING (4H, position trading)**
| Session | Score | Rationale |
|---------|-------|-----------|
| LONDON/NY OVERLAP | 7 pts | Peak data accuracy, clean entries |
| Other active hours | 4 pts | Sufficient volume for position sizing |
| QUIET HOURS | 0 pts | Penalized: stale price discovery |

### News & Economic Penalty

**Red-Flag News <1h away:** -2 pts (capped at 0 minimum)

Detects major scheduled economic events (FOMC, CPI, jobs reports, BoE decisions) and applies a soft penalty. The penalty is informational—it doesn't veto the setup but flags execution risk.

### Data Requirements

```javascript
setup = {
  extra: {
    redFlagNews: {                   // Optional: news calendar integration
      event: "FOMC Decision",
      minutesUntil: 30                // Time to event
    }
  }
}

// horizonLabel parameter
hgOmniSessionTimingScore(setup, 'SCALP')  // or 'SWING'
```

### Time Calculation

Time is calculated in **IST (Indian Standard Time, UTC+5:30)** for consistent global reference:
- Current UTC time + 5.5 hours = IST
- Session boundaries use IST half-hours (e.g., 20:30 IST = 11:00 NY open)

### Example Outputs

**Example 1: Scalp at London Open (Good Timing)**
```javascript
const setup = { extra: { regime: {...} } };
hgOmniSessionTimingScore(setup, 'SCALP');
// Assume IST = 06:30
// {
//   score: 5,
//   detail: 'SCALP setup during LONDON OPEN (6.5 IST)',
//   session: 'LONDON OPEN',
//   horizon: 'SCALP',
//   istHours: 6.5,
//   maxScore: 7
// }
```

**Example 2: Scalp During Quiet Hours (Penalized)**
```javascript
// Assume IST = 02:00
hgOmniSessionTimingScore(setup, 'SCALP');
// {
//   score: 0,
//   detail: 'setup during quiet hours (00:00-05:00 IST) — minimal liquidity',
//   session: 'QUIET HOURS (penalized)',
//   horizon: 'SCALP',
//   istHours: 2.0,
//   maxScore: 7
// }
```

**Example 3: Swing with Red-Flag News (News Penalty Applied)**
```javascript
const setup = {
  extra: {
    redFlagNews: { event: 'FOMC Decision', minutesUntil: 45 }
  }
};
hgOmniSessionTimingScore(setup, 'SWING');
// Assume IST = 14:00 (London/NY overlap)
// {
//   score: 5,  // 7 - 2 penalty = 5
//   detail: 'SWING setup during LONDON/NY OVERLAP (14:0 IST) | -2pt news penalty (45min to FOMC Decision)',
//   session: 'LONDON/NY OVERLAP',
//   horizon: 'SWING',
//   newsPenalty: 2,
//   maxScore: 7
// }
```

---

## Integration & API

### Backward Compatibility

All P0 functions remain **unchanged**. P1 functions are **independent** and can be called separately or through the enhanced solidity score:

```javascript
// Old API still works (P0 only)
const p0Score = hgOmniSolidityScore(setup);
// { score: ..., breakdown: {...}, maxScore: 55 }

// New API with P1 (opt-in horizonLabel)
const fullScore = hgOmniSolidityScore(setup, 'SCALP');
// { score: ..., breakdown: {...}, maxScore: 80 }
```

### Calling Individual P1 Functions

Each P1 function can be called independently:

```javascript
// Direct access to P1 functions
const regime = window.hgOmniRegimeScore(setup);
const atrExp = window.hgOmniAtrExpansionScore(setup);
const timing = window.hgOmniSessionTimingScore(setup, 'SCALP');

// Each returns { score, maxScore, detail, ...metadata }
```

### Setup Object Shape

```javascript
const setup = {
  // Always required:
  rows: Array<{ o, h, l, c }>,          // OHLC bars (last 25+ for P1)
  hit: { dir: 'LONG' | 'SHORT' },      // Setup direction

  // P0 requirements:
  plan: {
    entry: number,
    stop: number,
    t1: number                           // T1 target
  },

  // P1 enhancement (optional but enriches scoring):
  extra: {
    regime: {
      label: string,                     // 'TRENDING', 'RANGE', etc.
      detail: string
    },
    volForecast: {                       // Optional: external vol prediction
      expanding: boolean,
      prediction: string
    },
    redFlagNews: {                       // Optional: economic calendar
      event: string,
      minutesUntil: number
    }
  }
};
```

---

## Scoring Philosophy

### No Hard Vetoes

All P1 scores are **informational**—they contribute to total solidity but never veto a setup independently. A regime mismatch (2 pts) doesn't block an otherwise high-quality setup; it simply flags that context for trader review.

### Modular Design

Each P1 function:
- **Operates independently** of other P0/P1 functions
- **Gracefully degrades** when data is missing (returns 0, not error)
- **Provides detail** for trader interpretation
- **Does not modify** P0 calculation or existing behavior

### Thresholds & Tuning

All thresholds are **documented and tunable**:

| Parameter | Current | Notes |
|-----------|---------|-------|
| ATR expansion threshold | 5% | Ratio > 1.05 = expanding |
| ATR recent window | 5 bars | Most recent candles |
| ATR MA window | 20 bars | Historical comparison |
| Session overlap window | 13:00-17:30 IST | Configurable if markets shift |
| News penalty | -2 pts | Applied if <60 min to event |
| Quiet hours | 00:00-05:00 IST | Minimum liquidity window |

To adjust any threshold, edit the corresponding function directly—each threshold is inline-commented with its purpose.

---

## Testing & Validation

The implementation includes a comprehensive test suite (`test-p1-solidity.js`) covering:

1. **Regime Scoring:**
   - Trending + matching direction (10 pts)
   - Range regime (7 pts)
   - Compression (5 pts)
   - Mismatch scenarios (2 pts)
   - Missing regime (0 pts, graceful)

2. **ATR Expansion:**
   - Expanding volatility (8 pts)
   - Stable volatility (4 pts)
   - Contracting volatility (1 pt)
   - Vol forecast bonus (+2 pts)
   - Insufficient data (0 pts)

3. **Session Timing:**
   - Scalp at peak session (7 pts)
   - Swing at active session (7 pts)
   - Off-hours penalty (0 pts)
   - Red-flag news penalty (-2 pts)

4. **Full Solidity Integration:**
   - All 7 pillars in single call
   - maxScore = 80 validation
   - Backward compatibility (no P0 changes)

**Run tests:**
```bash
node tests/solidity/test-p1-solidity.js
```

Expected output:
```
═══════════════════════════════════════════════════════════
  ALL TESTS PASSED
═══════════════════════════════════════════════════════════

P1 FRAMEWORK SUMMARY:
  ✓ Regime Scoring (10 pts) - Implemented
  ✓ ATR Expansion Scoring (8 pts) - Implemented
  ✓ Session Timing Scoring (7 pts) - Implemented
  ✓ Integration with Main Solidity Score - Implemented
  ✓ Function Exports - Implemented
  ✓ Backward Compatibility - Verified

TOTAL SCORE CAPACITY: 80 points (P0: 55 + P1: 25)
```

---

## Future Extensions (P2/P3)

The framework is designed to accommodate 200 total points. Remaining capacity for future phases:

**P2 Potential (75 pts):**
- Order flow alignment (15 pts)
- Volume profile (15 pts)
- Recent win-rate context (15 pts)
- Drawdown cycle phase (15 pts)
- Catalyst confluence (15 pts)

**P3 Potential (100 pts):**
- Custom trader profile scoring (25 pts)
- Seasonal/calendar anomalies (25 pts)
- Liquidity depth analysis (25 pts)
- Correlated instrument reads (25 pts)

All future phases will follow the same modular, non-veto philosophy and integrate seamlessly with existing P0/P1 functions.

---

## Summary

| Pillar | Points | Status |
|--------|--------|--------|
| P0.1: Order Blocks | 15 | Existing |
| P0.2: Fair Value Gaps | 10 | Existing |
| P0.3: Multi-TF Cascade | 10 | Existing |
| P0.4: Risk:Reward | 20 | Existing |
| **P1.1: Regime Scoring** | **10** | **✓ Implemented** |
| **P1.2: ATR Expansion** | **8** | **✓ Implemented** |
| **P1.3: Session Timing** | **7** | **✓ Implemented** |
| **P0+P1 Total** | **80** | **✓ Ready** |
| P2-P3 Future | 120 | Planned |
| **Framework Capacity** | **200** | **✓ Architected** |

---

## Code Quality Checklist

- ✓ Zero modifications to P0 functions
- ✓ Each P1 function is independent and modular
- ✓ Graceful degradation when data missing
- ✓ All thresholds documented and tunable
- ✓ Comprehensive test coverage (10 test scenarios)
- ✓ Backward compatible (old code works unchanged)
- ✓ Functions exported to global scope
- ✓ Detail strings human-readable for trader review
- ✓ All scoring pillars visible in breakdown object
- ✓ Ready for production integration

---

**Implementation Date:** 2026-08-28  
**Version:** 1.0 (P0+P1 Complete)  
**Commit Ready:** Yes
