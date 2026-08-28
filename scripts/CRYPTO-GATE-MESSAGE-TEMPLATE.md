# OMNIROUTE Fill-Risk Gate Message Updates — Crypto Calibration

## What to Replace

In `omniroute.js`, lines **~1570–1631**, the fill-risk gate runs on every setup. The gate messages currently show gold's placeholder rates. Once crypto rates are measured, this section will be updated to show crypto-specific never-fill percentages.

---

## Current Code (Lines 1570–1610)

```javascript
/* FILL RISK — a limit away from market is not a position until it fills.

   CRYPTO MEASUREMENT STUB: The never-fill rates below are from OMNIGOLD's
   backtesting on 1,000 PAXG bars per horizon. These DO NOT apply to crypto
   yet — different asset class, different liquidity, different patterns.
   The desk must calibrate crypto-specific rates by replaying every setup
   this scan forms on crypto candles and asking whether price traded the
   entry inside the horizon. Record the rates here.

   For now: using gold's rates as a placeholder with a loud flag that
   they need crypto-specific calibration. This lets the gate wire in
   and show up on cards without claiming measured truth it does not have.

   Gold's measured rates (1,000 bars per horizon):
     |entry-market|   SCALP never fills   SWING never fills
       0-0.1R              5.3%                0.5%
       0.1-0.25R          14.0%                7.0%
       0.25-0.5R          21.3%               18.7%
       0.5-1R             15.8%               20.3%
       1R+                25.9%               33.6%

   The same replay also showed why this must be DISCLOSED and not assumed
   away: counting away-limits as if they always filled flipped a -0.285R
   population to +0.401R on paper, because the limits that never fill are
   disproportionately the trades where price ran off favourably without you.

   INFO, not a veto. Fill risk is a property of the ORDER, not of the
   setup's quality — the setup may be excellent and simply require the
   patience to miss it one time in five. The read abstains at or through
   market (the order fills now; there is nothing to argue about) and
   argues AGAINST only past 0.25R, where the measured never-fill rate
   crosses one in five on both horizons. */
var frOk = null, frWhy = 'no plan supplied — fill risk not judged', frGapR = NaN;
if (plHas && plObj && isFinite(fin(plObj.entry)) && isFinite(fin(plObj.stop))){
  var frE = fin(plObj.entry), frS = fin(plObj.stop), frPx = fin(x.livePx);
  var frRisk = Math.abs(frE - frS);
  if (!isFinite(frPx) || !(frRisk > 0)){
    frWhy = 'no live price this scan — fill risk not judged';
  } else {
    var frAway = (hit.dir === 'long') ? (frE < frPx - 1e-9) : (frE > frPx + 1e-9);
    frGapR = Math.abs(frE - frPx) / frRisk;
    if (!frAway){
      frWhy = 'entry at or through market — the order fills immediately';
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
  }
} else if (plHas && !plObj){
  frWhy = 'plan declined — nothing to fill';
}
```

---

## Replacement Template (After Crypto Calibration)

Below is a template showing the structure AFTER crypto measurements are collected. The actual numbers will be filled in based on your replay results.

```javascript
/* FILL RISK — a limit away from market is not a position until it fills.

   CRYPTO MEASURED RATES (10 Binance majors, 1,000 bars per horizon):
     |entry-market|   SCALP (1h) never-fills   SWING (4h) never-fills
       0-0.1R              X.X%                    Y.Y%
       0.1-0.25R          X.X%                    Y.Y%
       0.25-0.5R          X.X%                    Y.Y%
       0.5-1R             X.X%                    Y.Y%
       1R+                X.X%                    Y.Y%

   Measured on: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT,
                DOGEUSDT, ADAUSDT, LINKUSDT, AVAXUSDT, LTCUSDT
   Source: scripts/crypto-fill-risk-cal.mjs (results: crypto-fill-risk-results.json)
   Calibration: [DATE]

   Interpretation: A limit order placed at distance X from market has a Y% chance
   of never filling before the horizon closes. This is disclosed to the user
   so they can decide if they want the patience cost of a wider order, or if they
   prefer to take market.

   INFO, not a veto. Fill risk is a property of the ORDER, not of the
   setup's quality — the setup may be excellent and simply require the
   patience to miss it one time in five. The read abstains at or through
   market (the order fills now; there is nothing to argue about) and
   argues AGAINST only past 0.25R, where the measured never-fill rate
   crosses one in five on both horizons. */
var frOk = null, frWhy = 'no plan supplied — fill risk not judged', frGapR = NaN;
if (plHas && plObj && isFinite(fin(plObj.entry)) && isFinite(fin(plObj.stop))){
  var frE = fin(plObj.entry), frS = fin(plObj.stop), frPx = fin(x.livePx);
  var frRisk = Math.abs(frE - frS);
  if (!isFinite(frPx) || !(frRisk > 0)){
    frWhy = 'no live price this scan — fill risk not judged';
  } else {
    var frAway = (hit.dir === 'long') ? (frE < frPx - 1e-9) : (frE > frPx + 1e-9);
    frGapR = Math.abs(frE - frPx) / frRisk;
    if (!frAway){
      frWhy = 'entry at or through market — the order fills immediately';
    } else if (frGapR <= 0.1){
      frOk = true;
      frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
            + 'R) from market — very close; measured on crypto, about 1 in NN such limits never fills inside the horizon';
    } else if (frGapR <= 0.25){
      frOk = true;
      frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
            + 'R) from market — near; measured on crypto, about 1 in NN such limits never fills inside the horizon';
    } else if (frGapR <= 0.5){
      frOk = false;
      frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
            + 'R) from market — medium distance; measured on crypto, about 1 in NN never fills inside the horizon; the trade may simply not happen';
    } else if (frGapR < 1.0){
      frOk = false;
      frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
            + 'R) from market — wide; measured on crypto, about 1 in NN never fills inside the horizon; the trade may simply not happen';
    } else {
      frOk = false;
      frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
            + 'R) from market — very wide; measured on crypto, about 1 in NN never fills inside the horizon; the trade may simply not happen';
    }
  }
} else if (plHas && !plObj){
  frWhy = 'plan declined — nothing to fill';
}
```

---

## Example Substitution (Hypothetical Results)

If your replay measured:
- 0–0.1R: 4% never-fill → 1 in 25
- 0.1–0.25R: 8% never-fill → 1 in 12
- 0.25–0.5R: 18% never-fill → 1 in 5.5 → round to 1 in 6
- 0.5–1R: 22% never-fill → 1 in 4.5 → round to 1 in 5
- 1R+: 30% never-fill → 1 in 3

The code becomes:

```javascript
} else if (frGapR <= 0.1){
  frOk = true;
  frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — very close; measured on crypto, about 1 in 25 such limits never fills inside the horizon';
} else if (frGapR <= 0.25){
  frOk = true;
  frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — near; measured on crypto, about 1 in 12 such limits never fills inside the horizon';
} else if (frGapR <= 0.5){
  frOk = false;
  frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — medium distance; measured on crypto, about 1 in 6 never fills inside the horizon; the trade may simply not happen';
} else if (frGapR < 1.0){
  frOk = false;
  frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — wide; measured on crypto, about 1 in 5 never fills inside the horizon; the trade may simply not happen';
} else {
  frOk = false;
  frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
        + 'R) from market — very wide; measured on crypto, about 1 in 3 never fills inside the horizon; the trade may simply not happen';
}
```

---

## Key Numbers to Extract from Results

When you run the replay and get `crypto-fill-risk-results.json`, extract these:

| Bucket | 4h Never-Fill % | 1h Never-Fill % | 4h Ratio | 1h Ratio |
|--------|-----------------|-----------------|----------|----------|
| 0–0.1R | X.X% | Y.Y% | 1 in round(100/X.X) | 1 in round(100/Y.Y) |
| 0.1–0.25R | X.X% | Y.Y% | 1 in round(100/X.X) | 1 in round(100/Y.Y) |
| 0.25–0.5R | X.X% | Y.Y% | 1 in round(100/X.X) | 1 in round(100/Y.Y) |
| 0.5–1.0R | X.X% | Y.Y% | 1 in round(100/X.X) | 1 in round(100/Y.Y) |
| 1.0R+ | X.X% | Y.Y% | 1 in round(100/X.X) | 1 in round(100/Y.Y) |

---

## Verification Checklist

After updating omniroute.js:

- [ ] Removed `[CRYPTO STUB: gold rates]` from all frWhy messages
- [ ] All messages now say "measured on crypto" instead of "measured on gold"
- [ ] Ratios (1 in X) reflect crypto data, not gold data
- [ ] Added date and source file reference in comment block
- [ ] Gate still has `info:true` and `hard:false` flags (not changed)
- [ ] Gate is stored at index matching fill-risk gate in gates array
- [ ] `fillRiskGapR` is still recorded on final gate for access by forward records

---

## Commit Message

```
fix: calibrate fill-risk gate with crypto-measured never-fill rates

- Measured 10 Binance majors across 1,000 bars per horizon
- Replaced gold placeholder rates with crypto-specific percentages
- Never-fill rates now reflect USDT perpetual limit order behavior
- Gate messages updated: [0–0.1R]: 1 in NN, [0.1–0.25R]: 1 in NN, etc.
- Removed [CRYPTO STUB] markers; rates are now production data

Source: scripts/crypto-fill-risk-results.json
Calibration: [DATE]
```
