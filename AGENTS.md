## Cursor Cloud specific instructions

### Gold tabs (GOLD SCALP / GOLD SWING)
- Both tabs use `hgApplyGoldBestLevels` + `hgGoldPostApplyRefresh` after `goldRankSetups` to snap entry/stop/TPs and re-sync **grade from tally** (A≥8, B≥5, else C) plus structural R:R tally legs.
- **Scalp** min R:R 1.2 at build and in `gold-best-levels.js`; **swing** build gate stays 1.2 on the 1.5R ladder, but formation enforces **2.0R** via `HG_GOLD_SWING_MIN_RR`.
- Pass `candleSource` from `gold.src['15m']` (scalp) or `gold.src['4h']` (swing) into setup bundles for volume-trust / mixed-feed A+ behavior.
- Swing tab now mirrors scalp: GOLD A+ panel, `hgTallyLegAudit` chips, mixed-feed banner when `gold.mixed`.

### Tests
- `node tests/test-goldscalp.mjs`, `node tests/test-goldswing.mjs`, `node tests/test-gold-best-levels.mjs`

### Service worker cache
- Bump `HG_CACHE` in `sw.js` when changing cached JS (currently `hg-v265`).
