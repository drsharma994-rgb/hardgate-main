# VectorBT research boundary (HARDGATE)

**Status:** out-of-repo research only — nothing from vectorbt (or forks) is imported into HARDGATE production.

## Why this note exists

HARDGATE is a browser JS terminal with an offline `npm test` gate. Validation tools that need Numba/pandas (parameter heatmaps, walk-forward OOS, QuantStats tearsheets, fee/funding-adjusted expectancy surfaces) belong in a **separate research environment**, not in the deployable app.

This keeps the Claude-sourced / app-owned file rule clean: third-party Python stacks never land in the repo; only **conclusions** (thresholds, vetoes, calibrated constants) may return as hand-written JS after review.

## What to use outside HARDGATE

| Tool | Role | Do not |
|------|------|--------|
| [polakowo/vectorbt](https://github.com/polakowo/vectorbt) (community) | Walk-forward, robustness sweeps, param heatmaps, CCXT pulls | `pip install` into HARDGATE, vendor into `lib/` |
| [marketcalls/vectorbt-backtesting-skills](https://github.com/marketcalls/vectorbt-backtesting-skills) | Agent skills for realistic costs, Monte Carlo, QuantStats | Copy skill packs into `.cursor/skills` as production deps |
| [kernc/backtesting.py](https://github.com/kernc/backtesting.py) | Simpler backtests; weaker first-class walk-forward | Rely on it alone for indicator warm-up / OOS slicing without care |

## What already lives in HARDGATE (do not duplicate via vectorbt)

- Gate replay / threshold sweep (`cgGateReplay`, CALIBRATE)
- Walk-forward + Monte Carlo UI (`lib/walkforward.mjs`, scorecard VALIDATION)
- Cost / funding-adjusted R (`hgCostR`, `hgFundingCostR`, scorecard NET)
- OOS gate replay (`lib/gate-replay-oos.mjs`)

Use vectorbt when you need a **parameter-sensitivity surface** across windows/instruments that is awkward in the browser suite — then encode the chosen constants in JS with a test.

## Process

1. Run sweeps offline (local venv or notebook), not on Render.
2. Record the decision (e.g. “SB lookback 8 bars, RR floor 1.8”) in the PR / pack note.
3. Port only the constant or gate into HARDGATE; never the library.
4. Cover with `tests/test-*.mjs`.

See also: SMC liquidity was ported by algorithm into `goldind.js` (hg-v564) — same rule: read upstream, do not install.
