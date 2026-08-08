# AGENTS.md

Guidance for AI agents and cloud development environments working on HARDGATE.

## Cursor Cloud specific instructions

### Overview

HARDGATE is a zero-dependency static SPA (`index.html` + classic JS modules) served by a small Node HTTP server (`scripts/server.mjs`). There is no build step, no Docker, and no database.

### Services

| Service | Command | Port | Required? |
|---------|---------|------|-----------|
| HARDGATE dev server | `npm start` | 10000 (or `$PORT`) | Yes — serves static files + `/api/proxy` |
| Browser | Open `http://localhost:10000` | — | Yes — for UI testing |

Start the server in a tmux session so it survives across commands:

```bash
tmux -f /exec-daemon/tmux.portal.conf new-session -d -s hardgate-dev-server -c /workspace -- npm start
```

### Lint / test / run

| Task | Command | Notes |
|------|---------|-------|
| Unit + integration tests | `npm test` | Offline gate; full suite chain (includes daemon, CCXT executor, macro-feeds); no network required |
| Deploy cache check | `npm run check:prod` | Compare local `sw.js` `HG_CACHE` vs `HARDGATE_SITE` (default Render); LIVE vs STALE |
| Live data smoke test | `npm run test:data-layer` | Optional; Binance legs skip on HTTP 451 / timeout; exits 0 |
| Additional suites | `node tests/test-<name>.mjs` | See README Tests section |
| Lint | *(none)* | No ESLint or formatter configured |

### Optional production env vars

Not required for local dev or core UI:

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default `10000`) |
| `EXECUTE_BACKEND_URL` / `EXECUTE_WEBHOOK_URL` | Live bracket orders via `/api/execute` (forwarding proxy) |
| `EXECUTE_CCXT_EXCHANGE` + `EXECUTE_CCXT_API_KEY` + `EXECUTE_CCXT_SECRET` | In-process CCXT executor (Bybit / Binance / Delta) — takes priority over `EXECUTE_BACKEND_URL` |
| `EXECUTE_CCXT_SANDBOX`, `EXECUTE_CCXT_PASSWORD`, `EXECUTE_RISK_PCT` | CCXT sandbox mode, exchange password, default 1% risk sizing when qty omitted |
| `HARDGATE_URL` | Daemon / CI Puppeteer target (default `http://127.0.0.1:10000/` or `RENDER_EXTERNAL_URL`) |
| `HARDGATE_SCAN_MS` | Daemon scan interval (default 15 min) |
| `HARDGATE_DAEMON_DRY_RUN=1` | Run daemon loop without CCXT orders |
| `HARDGATE_STATE_FILE` | JSON conviction persistence path (default `hardgate-daemon-state.json`) |

### Render daemon worker

`render.yaml` defines a **background worker** `hardgate-daemon` (`node app.js`). After blueprint sync:

1. Set `EXECUTE_CCXT_EXCHANGE`, `EXECUTE_CCXT_API_KEY`, `EXECUTE_CCXT_SECRET` on the **worker** service.
2. Set `HARDGATE_DAEMON_DRY_RUN=0` when ready for live orders (defaults to `1`).
3. Worker `buildCommand` installs Puppeteer + Chrome for headless BRAIN scans against `HARDGATE_URL`.
4. On conviction invalidation (EXPIRED / STOPPED / MOMENTUM DECAY), the daemon calls CCXT `cancelOrder` or `closePosition` via `lib/daemon-unwind.mjs` when not in dry run.
5. Optional Render **persistent disk** mount at `HARDGATE_STATE_FILE` path so `hardgate-daemon-state.json` survives redeploys.

Optional single-process dev: `HARDGATE_DAEMON_AUTOSTART=1` forks `app.js` from `scripts/server.mjs`.

| Variable | Purpose |
|----------|---------|
| `EXECUTE_FILL_POLL_URL` | Broker fill polling endpoint |
| `BOOK_EXECUTE_FILL_SECRET` | Webhook auth for fill updates |
| `BOOK_MAX_DAILY_LOSS_PCT` | Daily loss halt threshold (default 2%) |
| `FRED_API_KEY` | `/api/fred` macro series (DGS10, DTWEXBGS, DFII10) |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | Alert pushes (also overridable in browser localStorage) |
| `GH_DISPATCH_TOKEN` | GitHub Actions workflow dispatch from Render |
| `RENDER_EXTERNAL_URL` / `SELF_PING_URL` | Render keep-alive ping |

### E2E verification

1. Start `npm start`
2. Open `http://localhost:10000` — header should show HARDGATE branding and tab nav
3. Confirm `/api/proxy` returns 200: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:10000/api/proxy?url=https://api.coindcx.com/exchange/v1/markets_details"`

Browser tabs load even when Binance/Delta REST is geo-blocked in the VM; CoinDCX/Yahoo proxy paths work server-side.

### Gotchas

- **Dual venue scan (default):** Opening a crypto scan tab auto-runs **Delta India + CoinDCX** (`hg_dual_scan` localStorage `0` disables). Header exchange toggle still sets desk context for TRADE PLAN / bias chips.
- **Binance geo-blocking (HTTP 451):** Cloud VMs may not reach `fapi.binance.com`. `npm test` passes offline. `tests/test-data-layer.mjs` skips Binance legs on 451 and exits 0.
- **Use the Node server, not `file://`:** Direct file open skips `/api/proxy`.
- **No runtime npm dependencies:** `npm install` is a no-op.
- **Node 18+ required**
- **EDGE tab:** Cards show **FRESH / ACTIVE / STALE** from `barAge` (closed 4H bars since trigger). **FORMING NOW** lists bias-aligned symbols with **×ATR distance to EMA21**; Telegram via unified **15-min** `tabalerts.js` batch (EDGE + EDGE FORMING watch rows). `scripts/edge-diagnose.mjs` uses `HARDGATE_SITE` for `/api/proxy` when run from Node.
- **PINE tab:** Background `pineWarm` runs every **15 min** with the alert cycle (after `edgeWarm` for universe). Telegram for NEW/RECENT signals via unified **tabalerts** batch (`collectPine*`); manual PINE scan still uses `pineFireAlerts` directly. Requires **Alerts ON** and Telegram configured (`sendTelegram` / `TELEGRAM_*` env). **`tests/test-pine-tab.mjs`** smoke-tests `mount` / `refresh` / `pineWarm`, empty vs gated scan, and `HG_tabs` registration; **`tests/test-pine-scan.mjs`** covers signal eval/render math.
- **GOLD PINE tab:** Displays the **top 2 highest-probability formations** per SWING (4H) and SCALP (15m) section (`topProbSetups` in `goldpine.js`); full scored universe remains in `goldPineScan()` for alerts.
- **Gold venue (hg-v169):** `getXAUCandles` prefers **Delta XAUTUSD** first; proxy fallback stamps **PROXY** + `S.goldBasisPct`. **`tests/test-gold-venue.mjs`**.
- **Scorecard fill gate (hg-v172):** `hgScoreWalk` requires price to trade to the limit (12-bar window, matches LOG); **UNFILLED** / **PENDING_FILL** states; **NET expectancy** via `hgScoreNetR` reading `index.html`'s `hgCostR`. Hint boost weights net when available. **`tests/test-scorecard-fill.mjs`**.
- **Fix Pack 7 (hg-v173):** No baked Telegram defaults — `TELEGRAM_TOKEN` + `TELEGRAM_CHAT_ID` env / browser Settings only; **`tests/test-no-baked-secrets.mjs`**. **`hgGoldBasisNote()`** on gold TRADE PLAN, GOLD setup/deep, backtest subtitles when proxy feed. Scorecard **T1S** uses recorded **`scalePct`** (TRADE PLAN `tScale`, default 50%). Live-trading-disabled copy on TRADE PLAN + Settings.
- **Productivity (hg-v174):** BOOK **Lots** column via `bookContractsCell` + `hgQtyToContracts`; **FUNDING FADE** section on SWING/SCALP scans (`renderFadeSetupCard`); **`S.posSnapCache`** for SMART $ positioning (420s TTL); Binance **418/429 backoff** pauses scans + `brainAlertWarm`. **`tests/test-productivity-pack8.mjs`**.
- **Fix Pack 9 (hg-v175):** **`hgFundingCostR`** in net R for LOG + scorecard; SCORECARD Wilson 95% CI on win rate. **`tests/test-fix-pack-9.mjs`**.
- **Fix Pack 10 (hg-v176):** **Conviction mesh** — MR oppose → ASIDE; **bybitpos** BRAIN layer + BEST F8 cross boost; **FRED** macro on FTS stack; setup cards show agree/oppose/dark/silent counts. **`tests/test-fix-pack-10.mjs`**.
- **Fix Pack 11 (hg-v177+):** **Vol mesh** (DVOL, spot-perp, stables) + **RS F10** — `hgRelStrength` 30×4H vs BTC; BEST `famMax` scales denominator. **`tests/test-fix-pack-11.mjs`**, **`tests/test-relative-strength.mjs`**.
- **Fix Pack 12 (hg-v179):** **Gate clearance** — `swingGateMatrix` margins per gate; G3/ANCHOR flagged `implied` (binding count 6); `cgClearanceLine` on BEST GC row + ticket `hit`. Reporting only — no threshold changes. **`tests/test-gate-clearance.mjs`**.
- **Fix Pack 13 (hg-v180):** **Funding billed at settlements crossed** (`hgFundingSettlements`), not `Math.ceil(hold/8h)`; scorecard charges from **`filledAt`** not signal time. **`tests/test-funding-settlements.mjs`**, **`tests/test-suite-integrity.mjs`** (orphan/empty/silent guard).
- **Fix Pack 14 (hg-v181):** **Profit-rank shrinkage** — `hgHintShrink` / `hintSigma` empirical-Bayes; `HINT_MIN_N` 10; boost auditable via `parts[].shrink`. **`tests/test-profit-rank-shrinkage.mjs`**.
- **Fix Pack 15 (hg-v182):** **MAE/MFE excursions** on settle (`maeR`/`mfeR` to exit, `maeFullR`/`mfeFullR` full window); **`hgHeatProfile`**, **`hgStopSweep`**. Console-only — no tab yet. **`tests/test-excursions.mjs`**.
- **Fix Pack 16 (hg-v183):** **Portfolio concentration** — `hgCorrMatrix`, `hgPortfolioConcentration`; TRADE PLAN heat row shows effective bets vs nominal. **`tests/test-portfolio-concentration.mjs`**.
- **Fix Pack 17 (hg-v184):** **Sole blocker funnel** — `cgSoleBlocker`; WHY EMPTY panel shows ONLY-blocker column (what relaxing a gate would buy). **`tests/test-sole-blocker.mjs`**.
- **StarTrader gold tabs (hg-v187):** STAR TRADER sub-tabs **GOLD SCALP** / **GOLD SWING** embed the same strategy engines as the GOLD-group tabs via `goldscalpMountSection` / `goldswingMountSection`, with **`useStartraderRouting`** — primary feed is **`getXAUCandles`** (same chain as confluence), setups stamped **`XAUUSD`**, proxy basis note when applicable.
- **Fix Pack 20 (hg-v190):** **CALIBRATE** button on SWING tab — `runGateDiagnostics()` runs gate replay sweep, stop placement (`hgHeatProfile`/`hgStopSweep`), and gold weekend exposure in one click. **`tests/test-calibrate-wiring.mjs`** (27 assertions).
- **Fix Pack 21 (hg-v191):** **`CG_SWING_LOOK`** parameter — stop horizon was hardcoded at 30 bars; CALIBRATE adds **SWING LOOKBACK** panel sweeping 5/8/10/15/20/30. **`tests/test-swing-lookback.mjs`** (24 assertions).
- **Fix Pack 22 (hg-v192):** **`CG_SWING_LOOK` 30 → 20** — default swing stop horizon on outcome evidence. **`plans.js`** enrichers (`hgEnrichSwingClean`, `hgEnrichSmartPlan`) read live `window.CG_SWING_LOOK` at call time. Gate-replay test bounds rescaled.
- **Fix Pack 23 (hg-v193):** **Degraded-run watchdog** in `scripts/alert-check.mjs` — persists failure count/reason to `alert-state.json`, alerts after 4 blind runs (1h), throttled to 6h; recovery push when synthesis returns. CI alert body uses `famMax` not hardcoded `/9`. **`tests/test-degraded-watchdog.mjs`** (21 assertions).
- **Fix Pack 24 (hg-v194):** **Pipeline heartbeat** — `scripts/pipeline-heartbeat.mjs` + hourly `.github/workflows/pipeline-heartbeat.yml` (no `RENDER_DISPATCH_PRIMARY` guard). Reads freshest ISO stamp in `alert-state.json`; alerts if older than 2h. **`tests/test-pipeline-heartbeat.mjs`** (25 assertions).
- **Fix Pack 25 (hg-v195):** **Synthesis lock retry** in `scripts/alert-check.mjs` — re-clicks `#brainRun` while BRAIN `__busy` guard refuses (bounded 40×4s); fixes CI deadlock after `runAlertCycle()` warm-up. **`tests/test-synthesis-lock.mjs`** (18 assertions).
- **Fix Pack 26 (hg-v196):** **`cgScanRateNote`** — WHY EMPTY panel **"Is zero normal?"** row with Wilson CI + measured 0.5% base rate; scan audit tracks `clean` count. **`tests/test-scan-base-rate.mjs`** (22 assertions).
- **Setup quality (hg-v197):** SWING/SCALP mirror BEST post-gate policy without loosening G1–G7 — **`hgEnrichTickerFundingTwin`** (Binance twin for thin G4), **`hgRegimeAllowsSetup`** on swing/scalp scans, **`hgPostGateSetupVeto`** (flow trap · BTC RS · stale momentum); gold **GS4** reads **`binanceFunding('XAUUSDT')`**. **`tests/test-setup-quality.mjs`**.
- **Setup accuracy pack (hg-v198):** **Gold post-gate** (`hgPostGateGoldVeto`, `hgFilterGoldPostGate` on GOLD SCALP/SWING); **Bybit cross** in **`hgAssessFlowTrap`**; **ledger stop sweep** → live stops via **`hgLiveStopScale`**; **multi-CLEAN rank** (`rankBoost`, profit rank, RS, flow); **NEAR quality hints**; **CLEAN card clearance/flow**; **gold weekend conviction demote** (`hgApplyGoldWeekendDemotes`); **REGIME warm** before scans.
- **Formation pipeline (hg-v199):** **`formation.js`** — **`hgFormTicket`** unified POI entry → structure stop → structure T1/T2 → fill gate → **`hgFormationScore`**; **`hgRankEntryPOI`**, **`hgStructureTargets`**, **`hgFillProbability`**, **`hgFormationParams`** (+ CALIBRATE save). Wired on SWING/SCALP/BEST/GOLD SCALP. **`tests/test-formation.mjs`**.
- **STAR TRADER NEAR levels (hg-v200):** WATCH confluence cards show **draft entry/SL/T1/T2** via **`stNearPlan`** (`swingTryNear` / `scalpTryNear`) when no 7/7 CLEAN plan — labeled **NEAR · not trade-ready**; book/trade handoff disabled until PRIME/HIGH CLEAN.
- **Fix Pack 19 (hg-v189):** **Gate replay / threshold sweep** — `cgGateReplay`, `cgReplaySettle`, `cgReplaySweep`, `cgGateReplayPanelHTML`. Walk-forward replay on SWING scan (500×4h bars); **GATE REPLAY** panel under WHY EMPTY with G6 / top ONLY-blocker / ANCHOR tables. Console: `cgGateReplay` + `cgReplaySweep`. **`tests/test-gate-replay.mjs`** (28 assertions).
- **Fix Pack 18 (hg-v186 / UI hg-v188):** **Gold weekend exposure** — `hgInGoldWeekend`, `hgSecsToGoldWeekend`, `hgGoldWeekendMoves`, `hgGoldWeekendRisk`, `hgGoldWeekendReadout`. **WEEKEND EXPOSURE** panel on GOLD SCALP / SWING (and StarTrader gold sub-tabs) after RUN SCAN; not stamped on tickets until your instrument numbers justify it. **`tests/test-gold-weekend.mjs`**.
- **Contract sizing on ticket (hg-v171):** TRADE PLAN ticket prints **CONTRACTS** (lots) from Delta `/v2/products` via `hgQtyToContracts` — rounds DOWN; sub-lot positions called out.
- **Cache reuse (hg-v171):** `HG_CANDLE_TTL_QUIET = 420` (> 5-min alert cycle) so quiet scans reuse candles across cycles.
- **Directional funding G4 (hg-v170):** `cryptogates.js` / `engine.js` veto funding only when it runs **against** the trade; `CG_FUND_SANITY` / `FUND_SANITY` = 0.30 is a broken-feed check, not a crowd cap. Favorable funding (long at negative fr) no longer blocked.
- **Non-live upgrades:** EDGE cards show **FLOW OK / PARTIAL / N/A** when Binance CVD/OBI legs missing; tabalerts cover SMART $, OI FLOW, LIQS, SQUEEZE, CARRY, TERM BASIS watch on the **15-min** cycle; `hardRefreshAll` warms macro + layer tabs; static GitHub Pages shows proxy banner via `hghost.js` (`tests/test-hghost.mjs`); gate funnel tab labeled **GATES** (id `execute`); scanner cards show **IN BOOK** via `hgBookStampChip` (slotted; repaints on tab switch / after ADD TO BOOK). Layer tabs (CARRY, TERM BASIS, GOLD PRO) wire **SEND TO TRADE PLAN →** handoffs.
- **Crypto setup accuracy (hg-v127+):** SWING G6 floor **R:R ≥ 2.0** (`CG_SWING_RR_MIN`); structure stop is never ATR-capped in the matrix. **Fix Pack 2 (hg-v168):** G1 spread **0.25×ATR**, G5 volZ **>0.5** with **RSI-slope quiet-tape stand-in** (`hgSwingG5OK` parity with `engine.js`), EMA21 anchor **≤1.5×ATR** — enforced by `tests/test-gate-parity.mjs`. **`swingTryClean` / `scalpTryClean` return 7/7 CLEAN trend only**; counter-trend funding fades use **`swingTryFundingFade` / `scalpTryFundingFade`** (honest gate tally, not CLEAN 7/7).
- **Plan alignment (hg-v128):** EXECUTE/BRAIN prefer **`swingTryClean` SWING** over `smartSetup` when 7/7 CLEAN; post-enrichment **G6 re-check** (`hgSwingPostEnrichValid`); smartSetup mean-reversion branch is **`FADE`** (not the SCALP tab).
- **Telegram setups (hg-v129):** Unified **5-min** crypto batch via `tabalerts.js` (**7/7 CLEAN + 6/7 NEAR** default). **Crypto convicted-only (hg-v165):** `hgAlertCryptoConvictedOnly=1` (default) restricts crypto Telegram to gate-clean **MOST PROBABLE** SWING/SCALP + BEST/EDGE/BRAIN clean — no 6/7 NEAR, no SMART/OI/PINE noise. Set `hgAlertCryptoConvictedOnly=0` to widen. **Gold (hg-v132):** separate **15-min** batch via `hgTabAlertsRunGold()` — **GOLD SCALP + GOLD SWING only**, **MOST PROBABLE** (`bestId`) or **grade-A locked** conviction; keys: `hgAlertGoldSeparate`, `hgAlertGoldConvictedOnly`, throttle `hg_tabalert_gold_last_run`.
- **Setup accuracy v2 (hg-v130, superseded by v168 gate parity):** cascadeAge **≥4**; SCALP G6 **volZ+wick**; scalp R:R **≥2.25**; EDGE **tally≥6**, **barAge=0** only; BEST pool **fam≥7 & rob≥1**; FADE min **2R**; watch alerts need **≥6/7 gates**. Threshold literals in `cryptogates.js` / `plans.js` must stay aligned with `engine.js` — run `node tests/test-gate-parity.mjs`.
- **Alert dual clocks:** Set `RENDER_DISPATCH_PRIMARY=true` on GitHub when Render dispatches alerts every 13 min.
- **BRAIN live tests:** `tests/test-brain-live.mjs` pins IST clock for session gates. `tests/test-brain-robust.mjs` guards browser `brainrobust.js` LIVE eligibility vs daemon `brain-robust.mjs` (`liveOk` on `__hgBrainLast` rows), including live-mode toggles, chip HTML, gold `XAUTUSD` stack resolution, partial crowding veto, and rank/constant exports. `tests/test-brain-invalidation.mjs` covers booked-layer snapshots, PRIME→WATCH / direction-flip invalidation alerts, evidence-only layer drift, fund-scoped keys, `hgTelegramFormat` / `sendAlertPush`, and the 8-line Telegram batch cap in `braininvalidation.js`. **`tabalerts.js`** calls `hgBrainInvAlertsFromLast` on each 15-min setup cycle when post-entry invalidation is ON (uses latest `__hgBrainLast` snapshot).
- **Data layer CI:** `.github/workflows/data-layer-smoke.yml` runs `npm run test:data-layer` on push/PR to `main` (optional live-network smoke; exits 0 on Binance HTTP 451 or DNS/network skip for gold-api/Treasury).
- **Deploy check:** `npm run check:prod` / `node scripts/check-production.mjs` compares local `sw.js` `HG_CACHE` to `HARDGATE_SITE` (default Render). Mismatch means production has not picked up the latest merge yet. `tests/test-check-production.mjs` guards alert timing, README thresholds, `HG_SHELL` ↔ `index.html` script parity, and **`npm test` chain ↔ `tests/test-*.mjs`** completeness.
- **Daemon brain:** `tests/test-daemon-brain.mjs` contract-smokes `lib/daemon-brain.mjs` (headless synthesis seam + fast-fail on dead port). **`tests/test-daemon.mjs`** covers `runMarketScan` live execute/rollback, merge, `brainRowToTradePlan`, and `evaluateActiveConvictions` stop invalidation via `lib/daemon-loop.mjs` + `lib/daemon-market.mjs`.
- **Book runtime:** `tests/test-book.mjs` offline-smokes `book.js` (`addToBook` vetoes/success, IN BOOK stamps, fund routing, brain layer snapshot on add). `tests/test-book-routing.mjs` includes browser `book-routing.js` ↔ `lib/book-routing.mjs` parity cases.
- **Conviction lock:** `tests/test-conviction-lock.mjs` covers `conviction-lock.js` lifecycle (`STOPPED`/`EXPIRED`/`TARGET HIT`/`TIME_STOP`, `evaluateInvalidations`, `applyHardgateConvictionLock` mint/veto/venue keys). Daemon loads the same module via `lib/daemon-conviction.mjs`.
- **Star Trader tab:** `tests/test-startradertab.mjs` covers `startradertab.js` synthesis (`stSynthesize`, `stContextVotes`, `stDropForming`, EDGE scan fallback), PRIME tier promotion (swing+scalp+edge+regime), real `swingGateMatrix` wiring, squeeze/mean-rev family votes, and context veto nulling. `tests/test-startrader.mjs` covers `startrader.js` catalog + `xuniverse.js` merge legs.
- **Cryptogates:** `tests/test-cryptogates.mjs` covers shared swing/scalp gate matrices (`swingGateMatrix`, `scalpGateMatrix`, `swingTryClean`, `scalpTryClean`) used by STAR TRADER + cryptowatch. **`tests/test-gate-parity.mjs`** locks SWING threshold parity across `engine.js`, `edge.js`, `plans.js`, `cryptogates.js` and asserts G5 quiet-tape RSI-slope behaviour. **`tests/test-swing-ticket.mjs`** regression-guards the G6 arithmetic defect (stop cap vs R:R veto) and enrich-chain stop-widening floor. **Swing G6:** `CG_SWING_RR_MIN=2.0`, `CG_SWING_EXP_ATR=3.5` — structure stop is never ATR-capped in the matrix; wide stops fail G6 honestly. **`hgPlanFromRisk` / EDGE `planFromRisk`:** structural targets below min R:R reject instead of pushing T1. **LOG fill gate:** limit entries require price touch within 12 bars or status `unfilled` (excluded from hit rate). **Execute idempotency:** key is plan-derived only (no 60s bucket). **Macro alt filter:** `hgMacroAllowsCrypto` in `plans.js` blocks alt **longs** when REGIME snapshot has `btcdPct > 55` or `dxyTrend === 'UP'` (majors BTC/ETH/SOL exempt). Warm **REGIME** before SWING/SCALP/EDGE on cold starts so BTC.D is populated — otherwise the filter passes through (null macro never blocks). **Alert/scans:** `runTabAlertScans()` and `hardRefreshAll()` call `hgWarmLayerIds(['regime', …])` before crypto scans so the macro filter is live on background cycles. **Funding-fade:** `swingTryFundingFade` / `scalpTryFundingFade` emit counter-trend FADE plans when G4 crowded and positioning score ≥ 2 — **not** returned by `swingTryClean`/`scalpTryClean` (BEST/STARTRADER treat those as 7/7 clean). Fade stack stamps real gate tally (`clean: false`). **BRAIN alerts:** `brainAlertWarm()` headless-mounts BRAIN off-screen when the tab was never opened so `__hgBrainLast` feeds Telegram on the 5-min cycle.
- **Bybit legs:** `tests/test-bybit.mjs` mocks Bybit v5 public REST (`bybitFunding`, OI history, account ratio, snapshot, linear tickers map) — used by SMART $ / CARRY cross-checks.
- **Indicators:** `tests/test-indicators.mjs` covers core `indicators.js` math (EMA/RSI/ATR, MACD, OB/liquidity pools, regime/vol profile). `tests/test-indicators2.mjs` covers `indicators2.js` helpers + `hgStructure` / `hgAVWAP`.
- **Store pub/sub:** `tests/test-store.mjs` offline-smokes `store.js` subscribe/publish/unsub error isolation (WS decoupling seam in `index.html`).
- **Binance fapi:** `tests/test-binance.mjs` mocks USD-M public REST (`binanceKlines`, funding, OI, long/short, depth, fundingInfo) — core data layer for scanners.

### Strategy → book plugin checklist

1. **Plan shape** — `entry`, `stop`, `t1`, optional `t2`
2. **CTA** — `bookBtnHTML(..., { scanner, strategy, layers, stack })` + `hgToTradePlanOnclickAttr` (or `hgSetupPanelHTML` / `carryTradeBtn` pattern)
3. **IN BOOK** — `hgBookStampChip(sym, dir, meta)` on card/panel headers (repaints via `hgBookStampRepaintDom` after tab switch / ADD TO BOOK)
4. **Routing** — `lib/book-routing.mjs` + `tests/test-book-routing.mjs`
5. **Tests** — `tests/test-<tab>.mjs`, `tests/test-handoff-coverage.mjs`; run `npm test`
6. **Ship** — bump cache in `sw.js` / script `?v=` when needed
