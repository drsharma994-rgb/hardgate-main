# Crypto Fill-Risk Calibration for OMNIROUTE

## Overview

The fill-risk gate in `omniroute.js` (lines ~1570–1631) currently uses gold's measured never-fill rates as placeholders. This document describes:

1. **What to measure**: Never-fill rates on crypto limit orders at various distances from market
2. **How to measure it**: Using the provided replay scripts
3. **How to apply results**: Updating the gate messages in omniroute.js with crypto-specific rates

---

## Current Gold Rates (1,000 bars per horizon)

These are from omnigold's backtesting on PAXG spot data:

```
|entry-market|   SCALP (1h) never-fills   SWING (4h) never-fills
  0–0.1R              5.3%                     0.5%
  0.1–0.25R          14.0%                     7.0%
  0.25–0.5R          21.3%                    18.7%
  0.5–1R             15.8%                    20.3%
  1R+                25.9%                    33.6%
```

The gate currently reads these combined:
- **0–0.25R**: "about 1 in 10 such limits never fills" (~10% avg)
- **0.25–1R**: "about 1 in 5 never fills" (~20% avg)
- **1R+**: "about 1 in 3 never fills" (~33%)

---

## Measuring Crypto Rates

### Option 1: Using `crypto-fill-risk-cal.mjs` (OMNIROUTE-Integrated)

This script runs full OMNIROUTE detection and measures fill rates on actual firings:

```bash
node scripts/crypto-fill-risk-cal.mjs
```

**What it does:**
1. Fetches 1,000 bars at 4h and 1h for 10 Binance majors
2. Runs `hgOmniDetect()` on each bar prefix
3. For each detected signal, records:
   - Entry price
   - Calculated risk (stop-to-entry)
   - Market price (livePx)
   - Gap in R units: `frGapR = |entry - livePx| / risk`
4. Walks forward to check if entry was traded within horizon
5. Buckets results: [0–0.25R], [0.25–0.5R], [0.5–1.0R], [1.0R+]
6. Outputs: % never-filled for each bucket, both horizons

**Output format** (tab-separated):
```
gap_bucket  4h_filled  4h_never_fill_pct  4h_n_settled  1h_filled  1h_never_fill_pct  1h_n_settled
0-0.25      NNN        X.X%               NNN           NNN        Y.Y%               NNN
...
```

**JSON output** saved to `crypto-fill-risk-results.json` for analysis.

### Option 2: Using `crypto-fill-risk-direct.mjs` (Simpler)

This script measures fill rates without requiring detector firing:

```bash
node scripts/crypto-fill-risk-direct.mjs
```

**What it does:**
1. Fetches bars like Option 1
2. Simulates placing limit orders at various distances: 0.1R, 0.25R, 0.5R, 1.0R, 1.5R
3. For each bar, places a "long" order at each distance below market
4. Walks forward to check if order fills within horizon
5. Outputs average never-fill % per distance across all symbols

**Advantage**: Works without waiting for detectors to fire, so much faster to run.

---

## Network Considerations

Both scripts handle Binance rate limiting with:
- Sequential requests (not parallel)
- Configurable delays between symbols
- Retry logic with exponential backoff
- Proper User-Agent headers

**Current settings** (`crypto-fill-risk-cal.mjs`):
- `CHUNK_SIZE = 1` (one symbol at a time)
- `SLEEP_MS = 1000` (1 second between requests)
- `FETCH_RETRY = 3` (up to 3 attempts per request)
- `FETCH_RETRY_DELAY = 2000` (2 second delay before retry)

If still hitting 418 errors, increase `SLEEP_MS` to 2000 or 3000 ms.

---

## Expected Results and Gate Message Structure

### Sample Crypto Results (Hypothetical)

Suppose after running the replay, we measure:

**4h Horizon:**
```
0–0.25R:   7% never-fill (slightly better than gold's ~10%)
0.25–0.5R: 15% never-fill (better than gold's ~21%)
0.5–1R:    18% never-fill (comparable to gold's ~16%)
1R+:       28% never-fill (slightly better than gold's ~26%)
```

**1h Horizon:**
```
0–0.25R:   8% never-fill (slightly worse than gold's ~5%)
0.25–0.5R: 20% never-fill (slightly better than gold's ~21%)
0.5–1R:    22% never-fill (slightly worse than gold's ~15%)
1R+:       30% never-fill (slightly better than gold's ~34%)
```

### How to Convert to Gate Messages

The gate currently uses thresholds and translates them to ratios:

```javascript
frGapR <= 0.25:
  "about 1 in 10 such limits never fills" → 10%

0.25 < frGapR < 1.0:
  "about 1 in 5 never fills" → 20%

frGapR >= 1.0:
  "about 1 in 3 never fills" → 33%
```

If crypto measured **7% never-fill at 0–0.25R**, the message becomes:
```
"about 1 in 14 such limits never fills inside the horizon"
```

(Calculation: 1 / 0.07 ≈ 14.3, round to nearest integer or half)

---

## Updating omniroute.js with Crypto Rates

Once measurements are complete, update lines ~1570–1631 in `omniroute.js`:

### 1. Update the comment block with measured rates:

```javascript
/* FILL RISK — a limit away from market is not a position until it fills.

   CRYPTO MEASURED RATES (10 Binance majors, 1,000 bars per horizon):
     |entry-market|   SCALP (1h) never-fills   SWING (4h) never-fills
       0–0.1R              X.X%                    Y.Y%
       0.1–0.25R          X.X%                    Y.Y%
       0.25–0.5R          X.X%                    Y.Y%
       0.5–1R             X.X%                    Y.Y%
       1R+                X.X%                    Y.Y%

   Measured on BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT,
   DOGEUSDT, ADAUSDT, LINKUSDT, AVAXUSDT, LTCUSDT.
   ...
```

### 2. Update the gate logic:

**Before** (gold rates):
```javascript
} else if (frGapR <= 0.25){
  frOk = true;
  frWhy = '[CRYPTO STUB: gold rates] limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — near; measured on gold, about 1 in 10 such limits never fills inside the horizon';
} else {
  frOk = false;
  frWhy = '[CRYPTO STUB: gold rates] limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — measured on gold, at this distance about 1 in '
        + (frGapR >= 1 ? '3' : '5') + ' never fills inside the horizon; the trade may simply not happen';
}
```

**After** (crypto rates, example with 7% @ 0–0.25R, 20% @ 0.25–1R, 30% @ 1R+):
```javascript
} else if (frGapR <= 0.25){
  frOk = true;
  frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — near; measured on crypto, about 1 in 14 such limits never fills inside the horizon';
} else {
  frOk = false;
  var ratio = (frGapR >= 1) ? '3' : '5';
  frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — measured on crypto, at this distance about 1 in ' + ratio
        + ' never fills inside the horizon; the trade may simply not happen';
}
```

**Key changes:**
- Remove `[CRYPTO STUB: gold rates]` marker
- Update "measured on gold" → "measured on crypto"
- Update ratios (1 in X) based on new measurements
- Remove "STUB" designation

---

## Interpretation and Caveats

1. **Fill rates are order-specific, not setup-specific**: A setup may be excellent and simply require patience. The gate informs, it does not veto (except past 0.25R where > 20% never-fill).

2. **Crypto is 24/7 but fragmented**: Binance USDT perpetuals are highly liquid, but order book depth varies by time of day. Rates measured may be conservative (gaps wider) during low-volume hours.

3. **Horizon window matters**: The 4h and 1h horizons mean different things for scalp vs swing. A 1h entry at 1R+ away is less likely to fill than a 4h entry at the same distance (less time).

4. **Sample size**: Aim for at least 50 entries per bucket for statistical confidence. If a bucket has <20 entries, flag it as "insufficient data" in the report.

5. **Limit order slip**: This assumes a resting limit order. Market-on-close orders fill with certainty; the never-fill rate reflects the "patience" cost of a tighter fill.

---

## Files

- `scripts/crypto-fill-risk-cal.mjs` — Main OMNIROUTE-integrated replay script
- `scripts/crypto-fill-risk-direct.mjs` — Simplified direct fill-rate measurement
- `scripts/test-crypto-fill-risk.mjs` — Test harness with mock data (for development)
- `scripts/crypto-fill-risk-results.json` — Output from main replay
- `scripts/crypto-fill-risk-direct-results.json` — Output from direct measurement

---

## Next Steps

1. **Run the replay**: `node scripts/crypto-fill-risk-cal.mjs` (allow 15–30 min for full run)
2. **Review results**: Check `crypto-fill-risk-results.json` for sample counts and coverage
3. **Update omniroute.js**: Apply measured rates to lines ~1570–1631
4. **Verify gate messages**: Confirm the "[CRYPTO STUB: gold rates]" marker is gone
5. **Test on live scan**: Run a live omniroute scan and confirm gate messages show crypto rates

---

**Note on this calibration workflow**: This measurement technique is duplicated from omnigold's gate calibration and reuses the same walk-forward + bucketing logic. Any changes to the gold calibration should be mirrored here.
