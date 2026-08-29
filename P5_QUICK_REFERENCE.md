# P5 Quick Reference — The Final 24 Points

Framework status: **COMPLETE — 200 / 200 points, 18 pillars.**
Location: `omniroute.js`, section `P5 SOLIDITY FRAMEWORK (24 pts total) — FINAL`
(immediately after the end-of-P4 marker, immediately before `hgOmniSolidityScore`).

All three functions: ES5 `var` style, try/catch guarded, `{score, maxScore, detail, ...}`
return shape, graceful degradation to 0 (news degrades to 6 — it defaults clear),
**zero network calls** — every input is read from state the app already fetched.

---

## 1. `hgOmniSectorMomentumScore(setup)` — 8 pts

Alignment of trade direction with sector tide + broad market tide.

| Condition | Score |
|---|---|
| Aligned with BOTH sector and market bias | 8 |
| Aligned with sector, market neutral/unknown | 5 |
| Against sector but market aligned (or sector aligned, market against) | 3 |
| Against both, or no data at all | 0 |

**Data sources (in order):**
- Sector bias: `setup.extra.htf` (`e21` vs `e50` — the resampled daily EMA pair pass-2
  enrichment already computed), else EMA21/EMA50 on `setup.rows` (needs `P5_EMA_SLOW + 10` bars).
- Market bias: `setup.extra.regime` → `setup.regime` → `setup.btcRegime` →
  cached `window.regimeState()` (synchronous cache read).
  `RISK-ON` = long bias, `RISK-OFF` = short bias, anything else = neutral.

Extra return fields: `sectorBias`, `marketBias`, `tradeSide`.

## 2. `hgOmniMultiAssetScore(setup)` — 10 pts

Three macro signals, scored by how many align with the trade direction.

| Aligned signals | Score |
|---|---|
| 3/3 | 10 |
| 2/3 | 7 |
| 1/3 | 4 |
| 0/3 or no data | 0 |

**Signals + data sources:**
- **(a) BTC trend** — `setup.btcRegime` / `setup.extra.btcRegime` (the scan's pass-2
  wiring attaches the BTC daily proxy here on every scan) → the regime read on the
  setup ONLY when its `source` is `'btc-daily-proxy'` (a genuine BTC read) → EMA21/50
  slope on `setup.btcRows` if the caller supplied BTC bars. The generic 8-gauge
  composite (`regimeState()` / a plain `extra.regime`) is **never** read here — P5.1's
  market bias and P1's regime pillar already score that exact datum, so an absent BTC
  read scores n/a instead of double-counting. `RISK-ON` confirms longs, `RISK-OFF`
  confirms shorts.
- **(b) Funding rate** — `setup.positioning.fundingPct` / `.funding.rate` /
  `setup.extra.fundingPct` (the same `xuPositioning` object the perp gates receive —
  the scan's pass-2 wiring attaches it as `setup.extra.positioning`). Contrarian read:
  negative funding (shorts paying) supports longs; positive funding supports shorts.
  The band centers on the perp baseline: `|funding - P5_FUNDING_BASELINE_PCT (0.01%)| <=
  P5_FUNDING_NEUTRAL_PCT (0.01%)` = neutral, no vote — funding at its resting +0.01%/8h
  must not read as "longs crowded".
- **(c) OI trend** — `setup.extra.oi.changePct` / `positioning.oi.changePct` /
  `positioning.oiChangePct`, confirmed against price drift over the last
  `P5_PRICE_DRIFT_BARS (12)` bars of `setup.rows`. Rising OI
  (`>= P5_OI_RISING_PCT (2%)`) **with** price drifting the trade's way = aligned.

Extra return fields: `aligned`, `checked`.

## 3. `hgOmniNewsCalendarScore(setup)` — 6 pts

Blackout logic. **This pillar defaults HIGH** — an unloaded calendar is not evidence of danger.

| Condition | Score |
|---|---|
| No high-impact event nearby, or no calendar available at all | 6 |
| Minor/medium event more than 1 hour away (`risk 'med'`) | 3 |
| Major event within ~1 hour, not blacking out the pair (`risk 'high'` or non-major blackout) | 1 |
| FOMC/CPI/NFP-class event within 30 min, or blackout naming one | 0 |

**Data sources (in order):**
- `setup.extra.redFlagNews` `{minutesUntil, event}` — the same source P1's
  session-timing penalty reads (checked first: it has minutes resolution).
- `setup.extra.news` / `setup.news` — the `hgNewsRisk()` shape
  `{risk:'high'|'med'|'low', blackout:boolean, note}`.
- Fallback: `window.hgNewsRisk(sym)` — a pure cache read, never fetches.
- Major-event class: `P5_NEWS_MAJOR_RE = /FOMC|FED\b|CPI|NFP|NON.?FARM|PAYROLL|RATE\s*DECISION|GDP|PCE/i`.

Extra return field: `status` (`'clear' | 'minor' | 'caution' | 'blackout'`).

---

## Named constants (top of the P5 section)

| Constant | Value | Meaning |
|---|---|---|
| `P5_SECTOR_MAX` | 8 | P5.1 max |
| `P5_ASSET_MAX` | 10 | P5.2 max |
| `P5_NEWS_MAX` | 6 | P5.3 max |
| `P5_EMA_FAST` / `P5_EMA_SLOW` | 21 / 50 | sector-trend EMA pair |
| `P5_FUNDING_BASELINE_PCT` | 0.01 | perp baseline funding the band centers on |
| `P5_FUNDING_NEUTRAL_PCT` | 0.01 | half-width of the neutral funding band |
| `P5_OI_RISING_PCT` | 2 | OI change % counting as "building" |
| `P5_PRICE_DRIFT_BARS` | 12 | bars for OI-confirmation drift |
| `P5_NEWS_BLACKOUT_MIN` | 30 | FOMC-class window → 0 pts |
| `P5_NEWS_CAUTION_MIN` | 60 | major-event window → 1 pt |
| `P5_NEWS_RED_HORIZON_MIN` | 240 | red-flag entries beyond this defer to the calendar read |

## Integration notes

- `hgOmniSolidityScore(setup, horizonLabel)` calls all three, adds them to `totalScore`,
  extends the breakdown with `sectorMomentum`, `multiAsset`, `newsCalendar`, and appends
  `SECTOR:x/8 ASSET:x/10 NEWS:x/6` to the detail string.
- No-setup early return: `maxScore: 200`.
- **Tier mapping (200-point scale):** `>=170` extremely_solid · `>=140` solid ·
  `>=105` fair · else weak.
- Window exports (next to the P0-P4 exports): `window.hgOmniSectorMomentumScore`,
  `window.hgOmniMultiAssetScore`, `window.hgOmniNewsCalendarScore`.
- Zero modifications to any P0-P4 function body — purely additive.

## Test

```
node tests/solidity/test_p5_solidity.js
```

Extracts the real P5 section out of `omniroute.js` and runs it under node:
3 scenarios (full macro alignment 24/24, partial confirmation 12/24, news
blackout 0/24) plus graceful-degradation checks and a no-double-count
regression check on the multi-asset BTC leg — 19/19 green.
