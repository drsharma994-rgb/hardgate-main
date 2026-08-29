# OMNIROUTE P2 Quick Reference

## The Two New Functions

### 1. Liquidation Score (12 pts + 2 bonus)
```javascript
var liqScore = hgOmniLiquidationScore(setup, 'long');
// Returns: {
//   score: 12,           // 0-14 (max 12 + 2 bonus)
//   maxScore: 12,
//   detail: '...',
//   nearestLiq: 9850,    // price level
//   stopBonus: 2,        // 0 or 2
//   direction: 'long'
// }
```

**What it does**: 
- Finds liquidation clusters from recent price action
- Scores distance from entry to nearest cluster
- Bonus if stop is positioned away from major liq

**When it scores high** (12 pts):
- Entry 0.25–0.5x ATR from liq cluster (ahead of sweep)
- Stop positioned away from major liq (+2 bonus)

**When it scores low** (0 pts):
- Entry >2x ATR from any cluster
- Liq map unavailable (graceful: not a veto)

---

### 2. Expectancy Score (8 pts max)
```javascript
var expScore = hgOmniExpectancyScore(setup);
// Returns: {
//   score: 8,                    // 0-8
//   maxScore: 8,
//   detail: '...',
//   expR: 0.45,                  // measured R
//   samples: 60,                 // backtest count
//   hitRate: 0.65,               // win rate
//   expectancyScore: 6,          // edgeR component
//   sampleScore: 8               // sample size component
// }
```

**What it does**:
- Scores measured expectancy (expR in R multiples)
- Scores confidence from sample size
- Returns max of the two (whichever is higher)

**When it scores high** (8 pts):
- Either: expR ≥ +0.50R (high edge)
- Or: ≥ 50 samples (statistically robust)

**When it scores neutral** (3 pts):
- No historical data available
- expR ≥ 0R but <0.25R (unproven edge)
- 10-19 samples (small but usable)

---

## Updated Main Function

```javascript
var solidityScore = hgOmniSolidityScore(setup, horizonLabel);
// Now includes P2 pillars in breakdown & tier classification
```

**What changed**:
- maxScore now correctly 100 (was 200)
- breakdown now has 9 pillars (was 7)
- Added `tier` field (extremely_solid | solid | fair | weak)
- Detail string includes LIQ & EXP scores

**Example output**:
```javascript
{
  score: 78,
  maxScore: 100,
  tier: 'solid',
  breakdown: {
    orderBlock: {...},
    fvg: {...},
    multiTfCascade: {...},
    riskReward: {...},
    regime: {...},
    atrExpansion: {...},
    sessionTiming: {...},
    liquidation: {...},    // NEW
    expectancy: {...}      // NEW
  },
  detail: 'OB:15/15 FVG:5/10 ... LIQ:12/12 EXP:8/8 [solid]'
}
```

---

## 9 Pillars at a Glance

| Pillar | Points | What It Measures | High Score Means |
|--------|--------|------------------|------------------|
| Order Block (P0) | 15 | Entry distance from swing extreme | Entry near recent supply/demand |
| FVG (P0) | 10 | Entry distance from liquidity gap | Fresh imbalance available to fill |
| MultiTF (P0) | 10 | Agreement across timeframes | Higher TF confluence validates setup |
| Risk-Reward (P0) | 20 | Target-to-stop ratio | Geometry rewards risk taken |
| Regime (P1) | 10 | Alignment with trend/range | Setup flows with market structure |
| ATR Expansion (P1) | 8 | Volatility trending into setup | Fuel for move to target |
| Session Timing (P1) | 7 | Time of day + macro calendar | Liquidity and participation present |
| **Liquidation (P2)** | **12** | **Entry near liq clusters** | **Sweep coming, entry ahead** |
| **Expectancy (P2)** | **8** | **Measured edge + sample size** | **Proven through backtests** |

**Total: 100 points**

---

## Tier Interpretation

| Tier | Range | Interpretation | Action |
|------|-------|-----------------|--------|
| **Extremely Solid** | 85–100 | All pillars weighted, converge | Take with standard risk |
| **Solid** | 70–84 | Most pillars aligned, <2 weak | Take with standard risk |
| **Fair** | 55–69 | Mixed signals, 3–4 pillars weak | Take with premium R:R (≥2:1) |
| **Weak** | <55 | Too many conflicts | Avoid unless edge is exceptional |

---

## Common Gotchas

### "My setup has negative expectancy but still scores 3 points for expectancy. Why?"

Because no data = no judgment. A setup with -0.10R on 30 samples is "we have measured this and it loses" (0pts on edge). A setup with no data is "we haven't proven anything yet" (3pts, neutral). The detail string distinguishes the two.

### "My weak setup still scores 70. How is that Solid?"

Because Solid means "most pillars aligned," not "every pillar strong." A perfect R:R (20pts) + good regime (10pts) + good structure (40pts on P0) = 70pts even if liq is poor (0pts). The breakdown shows which pillars are weak. Use that to decide risk posture.

### "Liquidation map threw an error. Did I fail the gate?"

No. Graceful degradation: if liq map fails, you score 0pts on liquidation but the rest of the setup stands. Score reduces from (e.g.) 80 to 68 (lost 12pts), which is "Fair" tier instead of "Solid," but not a veto.

---

## Setup Object Template

Minimal setup for P2 scoring:

```javascript
{
  rows: [ /* 40+ bars: {o, h, l, c} */ ],
  hit: { kind: 'PO3', dir: 'long', level: 10100, why: 'pullback' },
  plan: { entry: 10150, stop: 10050, t1: 10250, t2: 10350 },
  extra: {
    stats: {
      expR: 0.45,        // measured expectancy (R)
      samples: 60,       // backtest sample count
      hit: 0.65          // win rate (0-1)
    }
  }
}
```

**Note**: If `extra.stats` is missing, expectancy defaults to 3pts (neutral).

---

## Integration in Scan Loop

```javascript
// Typical workflow
var hits = hgOmniDetect(rows);  // detectors

for (var i = 0; i < hits.length; i++) {
  var plan = hgOmniPlanForHit(hits[i], rows, extra);
  var setup = {
    rows: rows,
    hit: hits[i],
    plan: plan,
    extra: extra
  };

  var score = hgOmniSolidityScore(setup, '1H');
  
  // Use tier for risk posture
  if (score.tier === 'extremely_solid') {
    // Standard risk, size normally
  } else if (score.tier === 'solid') {
    // Standard risk, size normally
  } else if (score.tier === 'fair') {
    // Require 2:1 R:R or better
    if (score.breakdown.riskReward.rr < 2.0) continue;
  } else {
    // Skip weak setups
    continue;
  }

  // Print with breakdown
  console.log('Setup: ' + score.score + 'pts (' + score.tier + ')');
  console.log('Detail: ' + score.detail);
}
```

---

## Tuning Thresholds

### For your desk

**Liquidation**: If your projections are unreliable, reduce max from 12 to 6 pts:
```javascript
// In hgOmniLiquidationScore, change:
if (distInAtr >= 0.25 && distInAtr <= 0.5){
  score = 6;  // was 12
} else if (distInAtr > 0.5 && distInAtr <= 1.0){
  score = 4;  // was 8
}
// Now: max liq score 6pts + 1 bonus = 7pts total
// Update maxScore in return: maxScore: 6
```

**Expectancy**: If your backtest sample sizes are small, adjust thresholds:
```javascript
// In hgOmniExpectancyScore, change:
if (samples >= 20){  // was 50
  sampleScore = 8;
} else if (samples >= 10){
  sampleScore = 6;  // was 3
}
// Recalibrate to match your historical sample distribution
```

**Tier Cutoffs**: If your traders prefer more "Solid" setups, raise cutoff:
```javascript
// In hgOmniSolidityScore, change:
if (totalScore >= 75) tier = 'solid';      // was 70
else if (totalScore >= 60) tier = 'fair';  // was 55
// Now requires 75pts for Solid tier
```

---

## Performance Tips

1. **Batch scoring**: Call `hgOmniSolidityScore` once per setup, cache the result
2. **Liq map projection**: Only done if setup has 40+ bars, skipped otherwise
3. **No external calls**: All functions are pure (no API, no DB reads)
4. **Browser-safe**: No console.warn unless debugging; safe for UI

---

## Testing Your Setup

```javascript
// Minimal test
var setup = {
  rows: generateRows(100, 10000, 'up'),
  hit: { kind: 'PO3', dir: 'long' },
  plan: { entry: 10150, stop: 10050, t1: 10250 },
  extra: { stats: { expR: 0.45, samples: 60, hit: 0.65 } }
};

var score = hgOmniSolidityScore(setup, '1H');
console.log('Score:', score.score, 'Tier:', score.tier);
console.log('LIQ:', score.breakdown.liquidation.score);
console.log('EXP:', score.breakdown.expectancy.score);
```

Run `test_p2_solidity.js` for full validation with 3 sample scenarios.

---

## Files to Read

| File | Purpose |
|------|---------|
| `omniroute.js` | Main implementation (lines 1943–2228) |
| `OMNIROUTE_SOLIDITY_FRAMEWORK.md` | Complete 100-point reference |
| `test_p2_solidity.js` | Test suite with 3 sample setups |
| `P2_IMPLEMENTATION_SUMMARY.md` | Deployment checklist & migration guide |

---

**Last Updated**: 2026-08-28  
**Status**: Production-Ready  
**Framework**: 100 points (P0: 55 + P1: 25 + P2: 20)
