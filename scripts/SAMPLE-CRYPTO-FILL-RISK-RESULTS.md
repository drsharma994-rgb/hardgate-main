# Sample Crypto Fill-Risk Results

This document shows what the output from `crypto-fill-risk-cal.mjs` looks like when the replay completes successfully.

## Console Output

```
HARDGATE — Crypto Fill-Risk Calibration Replay

Loading omniroute machinery...
OK — context loaded

BTCUSDT:
  Fetching 1000 4h bars for BTCUSDT...
  Running detection on BTCUSDT 4h...
    Tested 1,247 entries on BTCUSDT 4h
  Fetching 1000 1h bars for BTCUSDT...
  Running detection on BTCUSDT 1h...
    Tested 2,891 entries on BTCUSDT 1h

ETHUSDT:
  Fetching 1000 4h bars for ETHUSDT...
  Running detection on ETHUSDT 4h...
    Tested 1,156 entries on ETHUSDT 4h
  Fetching 1000 1h bars for ETHUSDT...
  Running detection on ETHUSDT 1h...
    Tested 2,634 entries on ETHUSDT 1h

[... continues for SOLUSDT, XRPUSDT, BNBUSDT, DOGEUSDT, ADAUSDT, LINKUSDT, AVAXUSDT, LTCUSDT ...]

========== CRYPTO FILL-RISK RATES (10 Binance Majors, 1000 bars per horizon) ==========

gap_bucket  4h_filled   4h_never_fill_pct   4h_n_settled    1h_filled   1h_never_fill_pct   1h_n_settled
0-0.25      3,455       8.2%                3,755           8,120       6.3%                8,720
0.25-0.5    2,891       16.4%               3,456           5,234       14.7%               6,123
0.5-1.0     1,205       21.8%               1,544           1,892       19.3%               2,341
1.0+        456         27.5%               629             612         31.2%               888

========== SUMMARY ==========

4h: 9,384 entries tested, 1,847 never-filled (19.7%)
1h: 16,072 entries tested, 2,458 never-filled (15.3%)

Detailed results saved to C:\Users\Lenovo\hardgate-main\scripts\crypto-fill-risk-results.json
```

## JSON Output (crypto-fill-risk-results.json)

```json
{
  "timestamp": "2026-08-28T12:34:56.789Z",
  "symbols": [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT",
    "DOGEUSDT", "ADAUSDT", "LINKUSDT", "AVAXUSDT", "LTCUSDT"
  ],
  "bars_per_horizon": 1000,
  "results_4h": [
    {
      "name": "0-0.25",
      "min": 0,
      "max": 0.25,
      "filled": 3455,
      "neverFilled": 301,
      "total": 3756
    },
    {
      "name": "0.25-0.5",
      "min": 0.25,
      "max": 0.5,
      "filled": 2891,
      "neverFilled": 565,
      "total": 3456
    },
    {
      "name": "0.5-1.0",
      "min": 0.5,
      "max": 1.0,
      "filled": 1205,
      "neverFilled": 339,
      "total": 1544
    },
    {
      "name": "1.0+",
      "min": 1.0,
      "max": "Infinity",
      "filled": 456,
      "neverFilled": 173,
      "total": 629
    }
  ],
  "results_1h": [
    {
      "name": "0-0.25",
      "min": 0,
      "max": 0.25,
      "filled": 8120,
      "neverFilled": 550,
      "total": 8670
    },
    {
      "name": "0.25-0.5",
      "min": 0.25,
      "max": 0.5,
      "filled": 5234,
      "neverFilled": 889,
      "total": 6123
    },
    {
      "name": "0.5-1.0",
      "min": 0.5,
      "max": 1.0,
      "filled": 1892,
      "neverFilled": 449,
      "total": 2341
    },
    {
      "name": "1.0+",
      "min": 1.0,
      "max": "Infinity",
      "filled": 612,
      "neverFilled": 276,
      "total": 888
    }
  ]
}
```

## Interpretation

From the sample results above:

### 4h Horizon (Swing)
- **0–0.25R**: 8.2% never-fill (1 in 12) — very good fill rate
- **0.25–0.5R**: 16.4% never-fill (1 in 6) — moderate
- **0.5–1.0R**: 21.8% never-fill (1 in 4.6 → 1 in 5) — challenging
- **1.0R+**: 27.5% never-fill (1 in 3.6 → 1 in 4) — risky

### 1h Horizon (Scalp)
- **0–0.25R**: 6.3% never-fill (1 in 16) — excellent fill rate
- **0.25–0.5R**: 14.7% never-fill (1 in 7) — good
- **0.5–1.0R**: 19.3% never-fill (1 in 5) — moderate
- **1.0R+**: 31.2% never-fill (1 in 3.2 → 1 in 3) — risky

### Comparison to Gold Baseline

**Gold SCALP (1h):**
- 0–0.1R: 5.3%
- 0.1–0.25R: 14.0%
- 0.25–0.5R: 21.3%
- 0.5–1R: 15.8%
- 1R+: 25.9%

**Crypto SCALP (1h) — sample:**
- 0–0.25R: 6.3% (close to gold's ~10%)
- 0.25–0.5R: 14.7% (better than gold's 21.3%)
- 0.5–1R: 19.3% (slightly better than gold's 15.8%)
- 1R+: 31.2% (slightly worse than gold's 25.9%)

**Interpretation**: Crypto shows similar or slightly better fill rates than gold at most distances. The 0.25–0.5R bucket shows notably better fill rates (~14.7% vs 21.3%), suggesting better order book depth in that range. The 1R+ bucket is slightly worse, which makes sense for very wide orders during volatile market moves.

---

## Sample Gate Messages (After Update)

Based on these results, the gate messages would become:

### Before (Current)
```
"[CRYPTO STUB: gold rates] limit 125.45 pts (0.18R) from market — near; 
measured on gold, about 1 in 10 such limits never fills inside the horizon"

"[CRYPTO STUB: gold rates] limit 278.93 pts (0.62R) from market — measured on gold, 
at this distance about 1 in 5 never fills inside the horizon; the trade may simply not happen"
```

### After (With Crypto Rates)
```
"limit 125.45 pts (0.18R) from market — near; measured on crypto, about 1 in 16 
such limits never fills inside the horizon"

"limit 278.93 pts (0.62R) from market — measured on crypto, about 1 in 7 never 
fills inside the horizon; the trade may simply not happen"
```

The "[CRYPTO STUB: gold rates]" marker is removed, and the ratio (1 in X) reflects actual crypto behavior.

---

## Quality Checks

For this sample output:

| Metric | Value | Status |
|--------|-------|--------|
| Total entries tested | 25,456 | ✓ Excellent (>20k) |
| 4h entries | 9,384 | ✓ Good (>8k) |
| 1h entries | 16,072 | ✓ Excellent (>15k) |
| 0–0.25R bucket (4h) | 3,756 | ✓ Good (>3k) |
| 0–0.25R bucket (1h) | 8,670 | ✓ Excellent (>8k) |
| 1.0R+ bucket (4h) | 629 | ⚠ Marginal (>500 but <1k) |
| 1.0R+ bucket (1h) | 888 | ✓ Good (>800) |
| Coverage (symbols with data) | 10/10 | ✓ Complete |

All buckets have sufficient sample size (>500 entries minimum recommended). The 1.0R+ bucket at 4h is slightly lean but still acceptable.

---

## Recommendations

Based on this sample output:

1. **Gate threshold at 0.25R is still appropriate** — never-fill rates jump from 6-8% to 14-16% above this point, consistent with the original design.

2. **Update gate messages** with crypto-specific ratios:
   - 0–0.25R: "1 in 15" (average of 8.2% and 6.3%)
   - 0.25–0.5R: "1 in 6" (average of 16.4% and 14.7%)
   - 0.5–1R: "1 in 5" (average of 21.8% and 19.3%)
   - 1R+: "1 in 3" (average of 27.5% and 31.2%)

3. **Add calibration date** to the gate comment block so readers know when this was last measured.

4. **Re-calibrate annually** to account for changes in Binance's order book and market structure.
