# CRYPTO SCAN v2 Architecture — Fix the Correlation Problem

## Problem Statement

**Current system:** 470 indicators, 100% correlated
- All measure price direction: up/down, trending/choppy, strong/weak
- When price breaks up: ALL indicators agree LONG
- When price breaks down: ALL indicators agree SHORT
- Result: 50/50 split → zero trades settled

**Why it fails:**
- Simple majority vote (>=25 reads agree, >=55% consensus)
- Consensus reached equally often on both sides
- Longs and shorts fire same bar → merge logic cancels

**Solution:** Decorrelate voting sources across three independent layers

---

## Three-Layer Uncorrelated Voting

### Layer 1: Price Action (Current, 470 indicators)
**What it measures:** Price direction, trend strength, volatility, volume confirmation
**Pros:** Fast, responsive, in-sample accurate
**Cons:** Perfectly correlated, no external validation
**Vote weight:** 40% (primary signal)

```
Read count: 127 directional indicators
Entry rule: >=25 reads agree, >=55-80% consensus
Output: LONG/SHORT/neutral with confidence 0-100%
```

### Layer 2: Order Flow + Market Microstructure (NEW)
**What it measures:** Buying pressure, seller capitulation, liquidity sweeps, order imbalances
**Decorrelation:** Order flow is independent of price — can go up while price falls (institutional accumulation)
**Sources:**
- Delta/Bid-Ask imbalance ratio
- Volume-weighted VWAP divergence
- Liquidation cascade detection (Coinglass, Bybit alerts)
- Order block validation (ICT: price revisit = rejection confirmation)
- Sweep patterns (SMC: liquidity hunter activity)
**Vote weight:** 35% (confluence + confirmation)

```
Read count: 15-20 order flow reads per symbol
Entry rule: >=8 reads agree, >=60% consensus
Output: ACCUMULATION/DISTRIBUTION/neutral
Gate: Only trade when Layer 1 agrees with Layer 2 direction
Boost: If both layers agree +20% confidence
Caution: If Layer 1 & 2 diverge, require 85%+ confidence to trade
```

### Layer 3: External Validation (NEW, via Agent-Reach + on-chain)
**What it measures:** Real-world events, sentiment, supply/demand imbalance
**Decorrelation:** Independent of technicals — captures black swan events, institutional flows
**Sources:**
- News sentiment (Agent-Reach RSS, Reddit, Twitter)
- Exchange flows (OKEx, Binance, Coinbase Premium Index)
- Whale alerts (transfers, accumulation, dumping)
- Liquidation cascades (real-time alerts)
- Funding rates (long/short leverage imbalance)
- On-chain metrics (SOPR, MVRV, Whale Ratio)
**Vote weight:** 25% (validation + tail-risk filter)

```
Read count: 8-12 external reads per symbol
Entry rule: Score sentiment/flows; if bullish boost entry, if bearish block
Output: BULLISH/BEARISH/NEUTRAL + risk flag
Gate: Block trades if extreme liquidation risk or adverse whale activity
Boost: If external sources confirm technical signal +15% confidence
Block: If strong divergence (bearish whale activity vs bullish technicals) = BLOCK
```

---

## Voting Logic (Fixed)

### New Consensus Algorithm

**Instead of:** "Count votes, pick majority"
**Use:** "Score all three layers, require agreement across 2+ layers"

```
Entry Signal Fired IF:
  1. Layer 1 (Price Action) votes LONG/SHORT with >=60% consensus
  AND
  2. (Layer 2 (Order Flow) votes same direction) OR (Layer 3 (External) is not contradictory)
  
  Confidence = (L1_score * 0.4) + (L2_score * 0.35) + (L3_score * 0.25)
  
Gate Rules:
  - If Confidence >= 85%: Trade
  - If 75% <= Confidence < 85%: Trade with caution flag
  - If Layer 1 & Layer 2 diverge: Require Confidence >= 80% + Layer 3 agreement
  - If Layer 3 flags major risk (liquidation cascade, whale dump): BLOCK regardless of L1/L2
```

---

## Implementation: Add to CRYPTO SCAN

### Phase 1: Order Flow Layer (Week 1)
**Add 15 order flow reads:**
- Delta bid-ask ratio (>1.0 = buying pressure)
- Volume VWAP divergence (price > VWAP = institutional support)
- Liquidation risk score (Coinglass API or on-chain liquidation flow)
- Order block proximity (price within 1-2% of recent resistance/support blocks)
- Sweep pattern detection (high volume, quick reversal = liquidity sweep)

**Entry:** Add `hgOrderFlowScore(symbol, rows15m, rows1h)` function to cryptoultra.js

### Phase 2: External Validation Layer (Week 2)
**Add 10 external reads:**
- Sentiment score (Agent-Reach RSS, already built in sentiment.js)
- Exchange flow delta (Coinbase Premium = institutional interest)
- Liquidation pressure (real-time cascade alerts)
- Whale activity (transfer alerts, accumulation phases)
- Funding rates (long/short leverage imbalance = reversal signal)

**Entry:** Add `hgExternalValidation(symbol)` function using sentiment.js + on-chain APIs

### Phase 3: Voting Logic Fix (Week 3)
**Update cryptoultra.js RULE:**
```javascript
var RULE = {
  minAvail: 40,           // Layer 1: >=40 decisive reads
  minPct: 0.75,           // Layer 1: >=75% consensus
  orderFlowMin: 8,        // Layer 2: >=8 order flow agrees
  orderFlowPct: 0.60,     // Layer 2: >=60% order flow consensus
  externalWeight: 0.25,   // Layer 3: 25% of final confidence
  requireTwoLayers: true, // MUST have L1 + (L2 OR L3 agreement)
  regimeGate: true        // Trend only
};
```

**Update confidence calculation:**
```javascript
var confidence = 
  (L1_pct * 0.40) +           // Price action
  (L2_pct * 0.35) +           // Order flow
  (L3_sentiment * 0.25);      // External

// Apply divergence penalty
if (L1_dir !== L2_dir) confidence *= 0.80;  // 20% hit if layers disagree
if (L1_dir === -L3_sentiment) confidence *= 0.70;  // 30% hit if news contradicts

// Apply gates
if (liquidationCascade) confidence *= 0.5;  // Liquidation risk halves confidence
if (whaleAccumulation && L1_dir === 'long') confidence *= 1.1;  // Boost if whales agree
```

---

## Expected Results

**Current (v717):**
- 470 correlated indicators
- 0 trades settled (50/50 cancel)
- Signal: 1,768 per scan (99% low quality)

**After Phase 1 (Order Flow):**
- L1: 470 price indicators (40%)
- L2: 15 order flow reads (35%)
- Consensus required on 2+ layers
- Expected: 20-50 trades per scan (10-15% settled)

**After Phase 2 (External Validation):**
- L1: 470 price indicators (40%)
- L2: 15 order flow reads (35%)
- L3: 10 external sources (25%)
- Expected: 5-20 trades per scan (40-60% settled) ← Professional-grade accuracy

**After Phase 3 (Voting Logic):**
- Three-layer consensus with confidence weighting
- Divergence penalties
- Risk-aware gating
- Expected: 3-8 trades per scan with 65%+ win rate

---

## Why This Works

**Uncorrelated sources catch what others miss:**
1. **Price Action** captures momentum + trend
2. **Order Flow** detects institutional accumulation (price may not move yet)
3. **External Validation** catches news-driven reversals + cascade risks

**Examples where fixed system wins:**

| Scenario | L1 (Price) | L2 (Order Flow) | L3 (External) | v717 Result | v2 Result |
|----------|-----------|-----------------|---------------|------------|-----------|
| Whale buying (price flat) | NEUTRAL | LONG | BULLISH | SKIP ❌ | LONG ✅ |
| News dump (fast down) | SHORT (delayed) | SHORT | BEARISH | Misses entry | Catches early |
| Liquidation cascade | SHORT bounce | SHORT pressure | BEARISH CASCADE | Weak short | STRONG SHORT ✅ |
| Institutional buildup | NEUTRAL/sideways | LONG accumulation | BULLISH whale | SKIP ❌ | LONG ✅ |
| Fake pump (dump) | LONG momentum | SHORT divergence | BEARISH news | FALSE LONG ❌ | BLOCKED ✅ |

---

## Implementation Timeline

**Week 1:** Add order flow layer (15 reads, Layer 2)
**Week 2:** Add external validation (sentiment + on-chain, Layer 3)  
**Week 3:** Implement three-layer consensus voting logic
**Week 4:** Backtest all symbols (BTCUSDT, ETHUSDT, SOLUSDT)
**Week 5:** Deploy hg-v720 with new architecture

**Expected ship date:** 2026-09-20
