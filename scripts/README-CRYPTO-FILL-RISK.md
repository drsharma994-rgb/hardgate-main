# HARDGATE Crypto Fill-Risk Calibration — Complete Guide

## Overview

This package contains everything needed to measure and calibrate crypto-specific fill-risk rates for the OMNIROUTE fill-risk gate in `omniroute.js` (lines ~1570–1631).

**Current status**: The fill-risk gate uses gold's measured never-fill rates as placeholders. This calibration replaces those with crypto-measured rates from 10 Binance majors.

---

## What's Included

### Scripts

1. **`crypto-fill-risk-cal.mjs`** — Main replay script
   - Runs full OMNIROUTE detection on 1,000 bars per horizon
   - Measures actual never-fill rates for each OMNIROUTE firing
   - Outputs detailed results by bucket and horizon
   - Most representative of real trading signals
   - Runtime: ~20–40 minutes (depending on detector firing rate)

2. **`crypto-fill-risk-direct.mjs`** — Simplified measurement script
   - Measures fill rates WITHOUT requiring detectors to fire
   - Simulates limit orders at various distances (0.1R–1.5R)
   - Faster execution (~5–15 minutes)
   - Good for quick validation or when detectors are sparse
   - Less representative of actual OMNIROUTE signals

3. **`test-crypto-fill-risk.mjs`** — Test harness with mock data
   - For development/testing only
   - Generates synthetic price data
   - Validates logic without network calls
   - Run: `node scripts/test-crypto-fill-risk.mjs`

### Documentation

1. **`CRYPTO-FILL-RISK-CALIBRATION.md`** — Comprehensive guide
   - Detailed explanation of what to measure and why
   - How each script works
   - Network handling (rate limits, retries)
   - Interpretation and caveats
   - Step-by-step workflow

2. **`CRYPTO-GATE-MESSAGE-TEMPLATE.md`** — Gate update instructions
   - Shows exactly what to change in omniroute.js
   - Before/after code snippets
   - Mapping from percentages to "1 in X" ratios
   - Verification checklist
   - Example commit message

3. **`SAMPLE-CRYPTO-FILL-RISK-RESULTS.md`** — Sample output
   - Shows what results look like
   - JSON output format
   - Interpretation guide
   - Comparison to gold baseline
   - Quality check metrics

---

## Quick Start

### Option A: Measure on OMNIROUTE Fires (Recommended)

```bash
# Run the main calibration replay
cd /path/to/hardgate-main
node scripts/crypto-fill-risk-cal.mjs

# Wait 20–40 minutes...
# Results are printed to console and saved to:
#   scripts/crypto-fill-risk-results.json
```

**Output**: Never-fill rates for each gap bucket (0–0.25R, 0.25–0.5R, 0.5–1R, 1R+) for both 4h and 1h horizons.

### Option B: Direct Fill-Rate Measurement (Faster)

```bash
node scripts/crypto-fill-risk-direct.mjs

# Wait 5–15 minutes...
# Results are printed to console and saved to:
#   scripts/crypto-fill-risk-direct-results.json
```

**Output**: Average never-fill percentages at gaps 0.1R, 0.25R, 0.5R, 1.0R, 1.5R across all symbols.

### Option C: Test Logic (No Network)

```bash
node scripts/test-crypto-fill-risk.mjs

# Should complete in <10 seconds
```

---

## Workflow

### 1. Run Measurement
Choose Option A or B above and let it complete.

### 2. Review Results
- Check `crypto-fill-risk-results.json` (or `crypto-fill-risk-direct-results.json`)
- Verify sample sizes in each bucket (aim for 50+ entries minimum)
- Compare 4h vs 1h rates to understand horizon effects

### 3. Calculate Ratios
For each gap bucket, convert % never-fill to "1 in X" ratio:
```
ratio = 100 / (never_fill_percentage)
```

Example:
- 8% never-fill → 1 in 12.5 → round to 1 in 12
- 20% never-fill → 1 in 5

### 4. Update omniroute.js
See `CRYPTO-GATE-MESSAGE-TEMPLATE.md` for exact changes:
- Update comment block (lines ~1570–1605) with measured rates
- Update gate logic (lines ~1606–1631) with new message strings
- Replace gold ratios with crypto ratios
- Remove "[CRYPTO STUB]" markers

### 5. Verify & Test
- Confirm "[CRYPTO STUB]" is gone from gate messages
- Run a live omniroute scan to see crypto-specific messages on cards
- Spot-check a few entries to verify rates make sense

### 6. Commit & Document
Use commit message from `CRYPTO-GATE-MESSAGE-TEMPLATE.md`:
```bash
git add omniroute.js scripts/crypto-fill-risk-results.json
git commit -m "fix: calibrate fill-risk gate with crypto-measured never-fill rates"
```

---

## Symbols Tested

The replay measures fill rates on these 10 Binance USDT perpetual majors:
- BTCUSDT (Bitcoin)
- ETHUSDT (Ethereum)
- SOLUSDT (Solana)
- XRPUSDT (XRP)
- BNBUSDT (Binance Coin)
- DOGEUSDT (Dogecoin)
- ADAUSDT (Cardano)
- LINKUSDT (Chainlink)
- AVAXUSDT (Avalanche)
- LTCUSDT (Litecoin)

These represent ~80% of total crypto futures volume and cover different risk profiles (BTC/ETH stability, ALT volatility, meme coins, etc.).

---

## Expected Results

Based on gold's baseline:

| Distance | Gold SCALP | Gold SWING | Crypto (Expected) |
|----------|-----------|-----------|-------------------|
| 0–0.25R | ~10% | ~4% | ~6–8% |
| 0.25–0.5R | ~21% | ~19% | ~15–20% |
| 0.5–1R | ~16% | ~20% | ~18–22% |
| 1R+ | ~26% | ~34% | ~28–32% |

Crypto likely shows **similar or slightly better** fill rates than spot gold due to:
- Higher volume on Binance
- 24/7 continuous trading
- Tighter order book spreads
- No overnight gaps

However, results may vary by time-of-day and market regime. The calibration captures what we observe in real data.

---

## Troubleshooting

### HTTP 418 (Rate Limited)
**Problem**: Binance returns 418 "I'm a teapot" errors
**Solution**: 
- Increase `SLEEP_MS` in script (default 1000ms → try 2000–3000ms)
- Run fewer symbols in parallel (`CHUNK_SIZE = 1`)
- Run during low-volume hours (avoid US market open)

### 0 entries tested
**Problem**: hgOmniDetect returns no signals
**Possible causes**:
- Detectors are sensitive to real market structure; synthetic data won't trigger them
- 1,000 bars may not be enough for some symbols (try 2,000)
- Detectors may have seasonal/regime preferences

**Solution**: Use `crypto-fill-risk-direct.mjs` instead (doesn't require detectors)

### Empty JSON output
**Problem**: Script runs but produces no results
**Check**:
- Network connectivity to fapi.binance.com
- No Binance IP blocks (check console for fetch errors)
- Symbol names are correct (BTCUSDT not BTC-USDT)

---

## File Locations

All scripts and documentation are in `scripts/`:

```
scripts/
├── crypto-fill-risk-cal.mjs                    Main replay script
├── crypto-fill-risk-direct.mjs                 Simplified measurement
├── test-crypto-fill-risk.mjs                   Test harness
├── crypto-fill-risk-results.json               Output (main replay)
├── crypto-fill-risk-direct-results.json        Output (direct measurement)
├── CRYPTO-FILL-RISK-CALIBRATION.md             Complete guide
├── CRYPTO-GATE-MESSAGE-TEMPLATE.md             Gate update instructions
├── SAMPLE-CRYPTO-FILL-RISK-RESULTS.md          Sample output & interpretation
└── README-CRYPTO-FILL-RISK.md                  This file
```

The gate itself is updated in:
```
omniroute.js (lines ~1570–1631)
```

---

## Technical Details

### How the Measurement Works

1. **Fetch bars**: Get 1,000 candles from Binance for each symbol/horizon
2. **Run detectors**: For each bar prefix, call `hgOmniDetect(rows)`
3. **For each hit**:
   - Record entry price (bar close)
   - Calculate stop using `hgOmniBtStop()` (10-bar lookback + ATR fallback)
   - Calculate risk = |entry - stop|
   - Calculate gap in R: `frGapR = |entry - livePx| / risk`
   - Classify into bucket: [0–0.25R], [0.25–0.5R], [0.5–1R], [1R+]
4. **Walk forward**: Check if entry price was traded in next N bars (horizon)
   - If yes: count as FILL
   - If no after N bars: count as NEVER-FILL
5. **Aggregate**: Pool all entries across symbols and horizons
6. **Report**: % never-filled per bucket

### Why This Matters

The difference between assuming "all limit orders fill" vs "some don't" can flip a -0.285R expected loss to +0.401R on paper. The gate discloses the true cost of patience.

### Limitations

- **Intrabar ambiguity**: If a bar spans both entry and stop, we count it as stop (conservative)
- **No slippage model**: Assumes fill at exact entry; real fills may be wider
- **Fixed horizon**: 4h = 250 bars, 1h = 60 bars (not adjustable in current gate)
- **Binance only**: Different venues may have different fill characteristics
- **Spot volume only**: Uses OHLCV, not order book depth

---

## Re-Calibration

This measurement should be **re-run annually** to account for:
- Changes in Binance order book structure
- Growth or decline in alt-coin liquidity
- New market regimes (bull, bear, sideways)
- Updates to trading patterns

Add a date to the gate comment block:
```javascript
/* Measured on: BTCUSDT, ETHUSDT, ...
   Source: scripts/crypto-fill-risk-cal.mjs
   Calibration date: 2026-08-28
   Next calibration: 2027-08-28 */
```

---

## Questions?

Refer to:
1. **CRYPTO-FILL-RISK-CALIBRATION.md** — How the measurement works, network handling, interpretation
2. **CRYPTO-GATE-MESSAGE-TEMPLATE.md** — How to update omniroute.js with your results
3. **SAMPLE-CRYPTO-FILL-RISK-RESULTS.md** — What output looks like, quality checks, examples

The omniroute.js fill-risk gate itself is well-commented (lines ~1570–1631) and explains the disclosure rationale.

---

## Success Criteria

You'll know this is complete when:

- [ ] Ran crypto-fill-risk-cal.mjs successfully
- [ ] Got results in crypto-fill-risk-results.json
- [ ] Each gap bucket has 50+ entries (statistical confidence)
- [ ] Updated omniroute.js lines ~1570–1631 with crypto rates
- [ ] Removed "[CRYPTO STUB: gold rates]" from all gate messages
- [ ] Ran a live scan and confirmed gate messages show crypto-specific ratios
- [ ] Committed changes with proper commit message
- [ ] All tests pass

---

**Note**: This calibration workflow reuses the architecture and logic from omnigold's own gate calibration (see omnigold.js). Any future improvements to that process should be mirrored here.
