# AGENTS.md

Guidance for AI agents and cloud development environments working on HARDGATE.

## Cursor Cloud specific instructions

### Overview

HARDGATE is a zero-dependency static SPA (`index.html` + classic JS modules) served by a small Node HTTP server (`scripts/server.mjs`). There is no build step, no Docker, and no database.

### Agent skills (Claude / Cursor)

This repo ships [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) for workflow routing (spec → plan → build → test → review → ship).

| Location | Purpose |
|----------|---------|
| `.agents/skills/<name>/SKILL.md` | Primary install (via `npx skills add addyosmani/agent-skills`) |
| `.cursor/skills/<name>/SKILL.md` | Cursor Agent discovery |
| `.claude/skills/<name>/SKILL.md` | Claude Code / Copilot skills directory |
| `.cursor/rules/agent-skills.mdc` | Always-on routing rule — start with `using-agent-skills` |
| `.claude/commands/` | Slash commands (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`, …) |
| `agent-skills-references/` | Shared checklists linked from skills |
| `skills-lock.json` | Installed skill versions + hashes |

**Claude Code plugin (local):** `claude --plugin-dir /path/to/hardgate-main` (uses `.claude-plugin/plugin.json`).

**Refresh from upstream:** `npx skills add addyosmani/agent-skills -y` then re-copy to `.cursor/skills/` and `.claude/skills/` if needed.

**HARDGATE defaults when using skills:** run `npm test` before merge; bump `build-stamp.js` + `sw.js` together for deploy; follow tab conventions in this file for UI work.

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
| `EXECUTE_CCXT_SANDBOX`, `EXECUTE_CCXT_PASSWORD`, `EXECUTE_RISK_PCT`, `EXECUTE_CCXT_DEFAULT_TYPE` | CCXT sandbox mode, exchange password, default 1% risk sizing when qty omitted, override `defaultType` |
| `CCXT_MARKET_EXCHANGE`, `CCXT_MARKET_SYMBOLS` | Public CCXT desk at `/api/ccxt/desk` (default `binanceusdm`, BTC+ETH funding) — no API keys |
| `HEY_LENS_API_URL`, `HEY_LENS_AUTHORS` | Hey/Lens social desk at `/api/hey/desk` (default `https://api.lens.xyz/graphql`, authors `stani`) — no wallet |
| `HARDGATE_URL` | Daemon / CI Puppeteer target (default `http://127.0.0.1:10000/` or `RENDER_EXTERNAL_URL`) |
| `HARDGATE_SCAN_MS` | Daemon scan interval (default 15 min) |
| `HARDGATE_DAEMON_DRY_RUN=1` | Run daemon loop without CCXT orders |
| `HARDGATE_STATE_FILE` | JSON conviction persistence path (default `hardgate-daemon-state.json`) |
| `HARDGATE_KILL_SWITCH` | Manual trading halt (`1` / `true` blocks CCXT execute + daemon orders) |
| `HARDGATE_KILL_SWITCH_PCT` | Auto halt when session PnL % falls below threshold (e.g. `-2` for −2%) |
| `HARDGATE_TRADING_HALT` | Alias for manual halt (same as `HARDGATE_KILL_SWITCH`) |
| `EXECUTE_TWAP_SLICES` | Split CCXT orders into N TWAP slices (default `1` = single order) |
| `EXECUTE_TWAP_INTERVAL_MS` | Delay between TWAP slices in ms (default `0`) |
| `EXECUTE_NAV_USD` | Account NAV for budget checker (else fetched from CCXT balance) |
| `EXECUTE_VWAP_SIZING` | Depth-aware qty clip before execute (default on; set `0` to disable) |
| `EXECUTE_BUDGET_CHECK` | Pre-trade notional lock across concurrent executes (default on; set `0` to disable) |
| `EXECUTE_VWAP_MAX_SPREAD_BPS` | Max book depth spread for VWAP clip (default `25`) |
| `HARDGATE_STATE_ENCRYPTION_KEY` / `HARDGATE_STATE_PASSPHRASE` | AES-256-GCM encrypt daemon state at rest (32-byte key or passphrase-derived) |
| `HARDGATE_WEBHOOK_SECRET` | HMAC-SHA256 secret for signed webhook payloads |
| `HARDGATE_WEBHOOK_SECRET_PREVIOUS` | Previous webhook secret during key rotation (both accepted) |
| `WORLDMONITOR_API_KEY`, `WORLDMONITOR_API_URL` | Optional [World Monitor](https://github.com/koala73/worldmonitor) API desk at `/api/worldmonitor/desk` (local fallback: F&G, Yahoo macro, FRED stress, Hyperliquid) |
| `HARDGATE_AGENT_SWARM` | Daemon (`app.js`) headless workforce each cycle — default **ON** when `TELEGRAM_*` set; set `0` to disable |
| `HARDGATE_AGENT_WATCH_MS` | Server **agent-watch** interval ms (default 5 min) — 24/7 swarm + Atomic scan + Telegram |
| `HARDGATE_AGENT_ALERT_MIN_SCORE` | Minimum quality score for AI AGENT Telegram push (default 35) |
| `/api/coindcx/*` | Cached server-side CoinDCX desk (instruments, marks, candles) — avoids public CORS proxy rate limits on Render |
| `ATOMIC_SCAN_TOP` | Top N contracts per venue for **Atomic Agents** Delta+CoinDCX pipeline (default 18) |
| `HARDGATE_FQS_GATE`, `HARDGATE_EDGE_GATE`, `HARDGATE_FT_EDGE_GATE` | Daemon formation quality gates (see Render worker section) |
| `/api/trading-stack/status` | Unified CCXT + OpenBB + Freqtrade + XM + execute status (see README Trading stack) |

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
| `TRADEOS_ACCESS_TOKEN` | TradeOS MCP OAuth bearer for `/api/tradeos/*` (run `npx -y @tradeos/tradeos-mcp oauth`) |
| `HARDGATE_FT_EDGE_GATE` | Enable Freqtrade expectancy gate on daemon formation (default off) |
| `HARDGATE_FT_PROTECT` | Enable Freqtrade cooldown + stoploss guard on formation (default off) |
| `HARDGATE_FT_MIN_EXPECTANCY` | Minimum Freqtrade expectancy to pass edge gate (default `0`) |
| `OPENBB_API_URL` | Optional self-hosted OpenBB REST backend (e.g. `http://127.0.0.1:6900`) |
| `OPENBB_API_USERNAME` / `OPENBB_API_PASSWORD` | Basic auth for OpenBB backend |
| `OPENBB_API_KEY` | Optional API key header for OpenBB backend |
| `GEMINI_API_KEY` | Chart vision (`/api/chart-vision/analyze`) — Gemini multimodal; heuristic fallback when unset. **Set on Render `hardgate-main` → Environment** (persists across deploys) or run `RENDER_API_KEY=… GEMINI_API_KEY=… node scripts/set-render-gemini-env.mjs` |
| `GEMINI_MODEL` | Gemini model for chart vision (default `gemini-3-flash-preview`; production Render sets this explicitly) |
| `CHART_VISION_VETO` | **On by default.** Set `0` / `false` to disable high-confidence vision conflict demotes |
| `CHART_VISION_PNG` | Set `0` / `false` to skip Puppeteer PNG render (Gemini falls back to SVG text) |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | Alert pushes (also overridable in browser localStorage). Update Render: `RENDER_API_KEY=… TELEGRAM_TOKEN=… node scripts/set-render-telegram-env.mjs` |
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
- **`npm install`:** Installs `ccxt`, `@modelcontextprotocol/sdk`, and optional `@resvg/resvg-js` / `puppeteer`. Re-run after pull if imports fail.
- **Stale dev server on `:10000`:** If `/api/chart-vision/capabilities` returns `not found`, kill the old `node scripts/server.mjs` process and restart (`npm start` in tmux) — an older instance may still be bound to the port.
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
- **Gold enhancement slices (hg-v232):** **`goldind.js`** — per-direction **`__gsMicroVeto` / `__swMicroVeto`** (yield / L2 / OB-CVD), **`goldCrossVenueMap`**, **`goldWatchPromote`**, **`hgGoldInlineBridge`**, GOLD PRO hard gate + cross-venue tally in **`goldRankSetups`**. **`goldswing.js`** — structure-native TP1 snap on **`__swLevels`**, **`goldSwingSetups`**, formation R:R refresh after **`hgFormTicket`**. **`goldscalp.js` / `goldswing.js`** — promoted watch rows + formation / fill / GOLD PRO chips on cards. Inline **`runGold()`** appends tab-engine scalp summary when bridge loads. **`tests/test-goldscalp.mjs`** §28.
- **Gold best-levels (hg-v241):** **`gold-best-levels.js`** — unified gold scalp/swing entry/SL/TP: **`hgBestLevelsGold`** / **`hgApplyGoldBestLevels`** (formation + ShieldGuard + MTF 4H/1H/1D + OB/FVG quality score + regime/session + calibrated min R:R + vision veto). Wired in **`goldscalp.js`** + **`goldswing.js`**. **`tests/test-gold-best-levels.mjs`**.
- **Chart vision (hg-v237):** **`/api/chart-vision/analyze`** — OHLCV → SVG/PNG + heuristic **next-bar opinion** + outcome prediction (optional **`GEMINI_API_KEY`** multimodal PNG). **Vision veto on by default** (`CHART_VISION_VETO=0` to disable). **`chart-vision-desk.js`** enriches confirmed setups across desk tabs; dedicated **`CHART VISION`** tab (`chartvision-tab.js`) scans 6/7+ / 7/7 gate-qualified contracts with charts + independent reads. Formation boost via **`hgChartVisionFormationBoost`**. **`tests/test-chart-vision.mjs`**, **`tests/test-chartvision-tab.mjs`**.
- **STAR TRADER NEAR levels (hg-v200):** WATCH confluence cards show **draft entry/SL/T1/T2** via **`stNearPlan`** (`swingTryNear` / `scalpTryNear`) when no 7/7 CLEAN plan — labeled **NEAR · not trade-ready**; book/trade handoff disabled until PRIME/HIGH CLEAN.
- **Multi-repo phases (hg-v213):** Hummingbot/StockSharp-style **kill switch**, **budget checker**, **risk rules**, **triple barrier**, **TWAP executor** (`lib/kill-switch.mjs`, `lib/budget-checker.mjs`, `lib/risk-rules.mjs`, `lib/triple-barrier.mjs`, `lib/twap-executor.mjs`); QuantDinger-style **OOS gate replay** (`lib/gate-replay-oos.mjs`, `gate-replay-oos.js`); **5+5 bps/side** cost model in **`strats.js`**; Hummingbot-style **funding arb signals** + **VWAP sizing** + **composite book** (`lib/ccxt-funding-arb.mjs`, `lib/vwap-sizing.mjs`, `lib/composite-book.mjs`); eliza/Tink-style **HMAC webhooks**, **encrypted daemon state**, **MCP read-only API** (`/api/hardgate/capabilities`, `/api/hardgate/mcp`, `/api/hardgate/replay-oos`, `/api/hardgate/funding-arb`). **`tests/test-multi-repo-phases.mjs`** (21 assertions).
- **Execute preflight + CCXT desk UI (hg-v214):** **`hgCcxtDeskPanelHtml()`** on SCORECARD formation panel (BTC/ETH funding + **Funding arb** readout); **`lib/execute-preflight.mjs`** wires **VWAP clip sizing** + **budget lock** into **`POST /api/execute`** before CCXT. Env: `EXECUTE_NAV_USD`, `EXECUTE_VWAP_SIZING`, `EXECUTE_BUDGET_CHECK`, `EXECUTE_VWAP_MAX_SPREAD_BPS`. **`tests/test-execute-preflight.mjs`**.
- **World Monitor desk (hg-v215):** **`lib/worldmonitor-*`** + **`worldmonitor-desk.js`** — macro verdict (QQQ/XLP/BTC/F&amp;G), FRED stress, gold GC=F, Hyperliquid BTC/ETH/PAXG/GOLD perp stress; formation FTS bumps via **`setup-stack.js`**; panel on SCORECARD. Optional **`WORLDMONITOR_API_KEY`** for live API. **`tests/test-worldmonitor-desk.mjs`**.
- **AI AGENT workforce (hg-v216):** Ruflo-inspired **`lib/agent-*`** + **`ai-agent.js`** tab (**TOOLS · AI AGENT**) — eight 24/7 agents (Gate Hunter, Market Analyst, Risk Analyst, Gold Smith, Pine Scout, Strategy Lab, Funding Hunter, Brain Echo) scan crypto + gold via native HARDGATE engines; **`/api/agents/desk`**, **`POST /api/agents/report`**, **`POST /api/agents/swarm`**; optional daemon hook **`HARDGATE_AGENT_SWARM=1`**. FTS bump when workforce finds matching clean setup. **`tests/test-ai-agent.mjs`**.
- **Atomic Agents Delta+CoinDCX (hg-v217):** [Eigenwise/atomic-agents](https://github.com/Eigenwise/atomic-agents)-inspired composable pipeline **`lib/atomic-agent-*`** + **`atomic-agent-desk.js`** — Delta Scout, CoinDCX Scout, Cross-Venue Ranker, Setup Composer search both venues for gate-clean swing/scalp setups; **`/api/atomic/desk`**, **`/api/atomic/scan`**; integrated into **AI AGENT** tab (**ATOMIC DELTA+CDCX** button). Env: **`ATOMIC_SCAN_TOP`** (default 18). **`tests/test-atomic-agent.mjs`**.
- **AI AGENT Telegram 24/7 (hg-v219):** **`agent-alerts.js`** + **`lib/agent-watch.mjs`** — workforce runs every 5 min (browser alert cycle + Render **agent-watch**); Telegram when a **great setup** forms with **ENTRY · SL · TP**; dedup `hg_agent_alert_keys`; **`GET /api/agent-watch`**. **`tests/test-agent-alerts.mjs`**.
- **Fix Pack 13 (hg-v202):** **Loss cooldown** (`lib/cooldown.mjs` → `filterExecutableBrainRows` + daemon `outcomes` ledger); **correlation clusters** (`lib/clusters.mjs` → paperbook cluster/beta heat caps); **walk-forward + Monte Carlo** (`lib/walkforward.mjs`, **`walkforward-ui.js`** scorecard VALIDATION panel, formation buffer calibration on train-only 70%); **anchored VWAP POI** in **`formation.js`** (+ London-open gold VWAP anchor in **`goldind.js`**). Env: `HARDGATE_COOLDOWN_*`, `HARDGATE_GLOBAL_COOLDOWN_*`. **`tests/test-clusters.mjs`**.
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

### Gold tabs (GOLD SCALP / GOLD SWING) — hg-v266
- Both tabs use `hgApplyGoldBestLevels` + `hgGoldPostApplyRefresh` after `goldRankSetups` to snap entry/stop/TPs and re-sync **grade from tally** (A≥8, B≥5, else C) plus structural R:R tally legs.
- **Scalp** min R:R 1.2 at build; **swing** build gate stays 1.2 on the 1.5R ladder, but formation enforces **2.0R** via `HG_GOLD_SWING_MIN_RR`.
- Pass `candleSource` from `gold.src['15m']` (scalp) or `gold.src['4h']` (swing) into setup bundles for volume-trust / mixed-feed A+ behavior.
- Swing tab mirrors scalp: GOLD A+ panel, `hgTallyLegAudit` chips, mixed-feed banner when `gold.mixed`.
- Tests: `node tests/test-goldscalp.mjs`, `node tests/test-goldswing.mjs`, `node tests/test-gold-best-levels.mjs`

### Header chrome key — hg-v426
- Press **backtick** or the header **MIN `** button to collapse the tools drawer, MARKET PICTURE, status chips, group chips, brand tagline, and `.hg-lead` tab intros so setup cards fill the window. Tab nav and venue toggles stay. Press again to restore.
- Persists in `localStorage` `hg_chrome_min`. Ignored while focus is in an input / textarea / select.
- Desktop always-open drawer yields (`html:not(.hg-chrome-min)`). Tests: `node tests/test-chrome-min.mjs`.

### OMNIROUTE keep last scan — hg-v425
- A finished OMNIROUTE scan **stays on screen** until a newer scan successfully replaces it. Rescans no longer blank `#omniCards` first.
- Tab-open / `hardRefreshAll` go through `refreshOmniroute` (skip when **busy** or **fresh &lt; 3 min**). `#omniRun` click is only the first-run fallback.
- A failed rescan **keeps the last cards** and names the error on the warn line (`rescan failed — keeping last scan`).
- Tests: `node tests/test-omniroute-keep-results.mjs`, `node tests/test-scan-stability.mjs`

### OMNIROUTE setup levels — hg-v424
- Tickets **are the setup**. `hgOmniPlanForHit` prices **ENTRY at `hit.level`** (ORB / FVG / VALUE), not last close. Sweeps and reversions stop beyond that level (crypto cap **6×ATR**, not gold 2.5%). Continuation uses structure **from that entry** (`skipExact`); fades never get a momentum stop.
- Cards print **SETUP {kind} @ {level}**. `hgOmniConsensusVoters` drops TREND hits the daily stack already disqualifies (no-op when HTF is absent, so existing consensus harnesses stay two-sided).
- **OMNIPRESENT is unchanged:** TRIGGERED still enters at the **live** print after rejection; ARMED stays WATCH at the zone edge. Do not copy `hgOmniPlanForHit` onto that desk.
- G1–G7, gold min-loss, and OMNIGOLD v423 setup-level tickets stay.
- Tests: `node tests/test-omniroute-setup-levels.mjs`, `node tests/test-omniroute.mjs`, `node tests/test-omniroute-consensus.mjs`

### OMNIGOLD setup levels — hg-v423
- Tickets **are the setup**. `hgOgPlanForHit` prices **ENTRY at `hit.level`** (ROUND-MAGNET @ 4530, FVG @ 4429), not live gold. Sweeps stop beyond that level; continuation still uses structure / labelled vol-stop **from that entry** (`skipExact`). Stops clip at **2.5% of gold** — a 1000-pt lastSwing is not a gold invalidation.
- Cards print **SETUP {kind} @ {level}**. `hgOgConsensusVoters` drops continuation/fade hits the daily stack already disqualifies, so rejected TREND shorts cannot empty a with-trend scalp.
- `hgOgPickFor` still prefers structure then vol-stop; among those, prefers tickets **≤ 2×ATR** from live gold so a far FVG does not float as STRONGEST over a nearby sweep.
- **Do not** run OMNIGOLD through `hgApplyGoldBestLevels`. G1–G7 and v420 min-loss vetoes stay. `momentum-stop` stays AGAINST (v422).
- Tests: `node tests/test-omnigold-setup-levels.mjs`, `node tests/test-gold-live-entry.mjs`, `node tests/test-omnigold-consensus.mjs`

### OMNIGOLD tickets — hg-v422
- Continuation with a labelled **volatility / momentum stop** can **TICKET** (`momentum-stop` is AGAINST, not a veto). Killing it as a real veto emptied the desk on a runaway gold trend (no nearby structure for with-trend; fades already stood aside).
- `hgOgPickFor` prefers a **structural** ticket; if the only ticket is a vol-stop continuation, it still picks that rather than leaving STRONGEST empty.
- Min-loss vetoes from hg-v420 **stay**: fade daily-stack, weekend closure, yield-per-direction, 20-sample losing mechanic, ShieldGuard, scalp cost-drag 0.15R.
- Tests: `node tests/test-omnigold-min-loss.mjs`, `node tests/test-momentum-stop.mjs`

### OMNIGOLD min-loss — hg-v420
- **Do not** run OMNIGOLD through `hgApplyGoldBestLevels`. The desk tickets **the named setup level** (`hgOgPlanForHit`); snapping to formation levels recreates DEAD ON ARRIVAL / stale-entry tickets.
- Yield is judged **per setup direction** (`hgOgYieldValid(rows, dir)`). Never freeze `validateYieldCorrelation(..., 'long')` for the whole scan.
- A mechanic at **20+ samples and ≤ −2σ vs breakeven VETOES** (no 20–29 info free-pass). OmniRoute crypto keeps the 20–29 AGAINST window.
- Fading the **daily stack** is enough to veto (`fade-strength`). A volatility / momentum stop is **AGAINST** (`info`) — the continuation ticket stands, otherwise a runaway tape has no nearby structure. `hgOgPickFor` prefers a structural ticket, then falls back to the labelled vol-stop rather than leaving STRONGEST empty.
- **Weekend:** inside Fri 22:00 UTC–Sun 22:00 UTC is a veto; SWING also vetoes inside one 4h bar of the Friday close. Scalp cost-drag ceiling is **0.15R** (`sessionHard`).
- Tests: `node tests/test-omnigold-min-loss.mjs`, `node tests/test-omnigold.mjs`, `node tests/test-fade-strength.mjs`, `node tests/test-momentum-stop.mjs`

### OMNIPRESENT max-quality — hg-v421
- **TICKET** only on **TRIGGERED** (1h close rejected the zone). ARMED is WATCH — hard UNCHECKED `rejection` gate, not a veto badge.
- Confluence **< 3** and exhaustion **< 2** are hard vetoes (the tab already claimed this; AGAINST notes used to still ticket).
- Daily EMA stack against the fade vetoes (`htf-daily`). Running ADX without **RSI divergence** vetoes (`trend-guard`) — stretch is the trend.
- Adverse context panel (`cx.adverse`) is a real veto. Settled `OP-HIGH-REJECT` / `OP-LOW-REJECT` at 20+ samples with negative expectancy vetoes.
- TICKET cards carry ADD TO BOOK + SEND TO TRADE PLAN. Tab open auto-scans (`HG_TAB_AUTO_SCAN.omnipresent`).
- Tests: `node tests/test-omnipresent-max.mjs`, `node tests/test-omnipresent.mjs`

### Auto hard refresh — hg-v267
- **`HG_AUTO_REFRESH_HARDCODED_MS = 120000`** in `index.html` — every **2 minutes** the app runs `hardRefreshAll()` on all inline scanners + every `HG_TAB_MODS.refresh()` (including GOLD SCALP/SWING). OFF / 3m / 5m / 15m header buttons are ignored; localStorage `hgAutoRefresh` always stores `120000`.
- **`goldscalpRefresh` / `goldswingRefresh`:** run a headless scan when the tab was never opened (stub UI, same path as `gsWarm`/`gwWarm`) so the 2m cycle never skips gold tabs cold.

### Light UI theme — hg-v267
- Theme source: [markbang/base-themes](https://github.com/markbang/base-themes) **`data-dense` / `light`** tokens in `vendor/base-themes/tokens-data-dense-light.css`.
- `bright.css` maps HARDGATE `--ink` / `--panel` / borders to those tokens; no backdrop blur (faster paint).
- Header uses Lucide-style inline SVG (`hg-icons.css`), not emoji. Shell: `<html data-style="data-dense" data-theme="light">`.

### Super conviction desks — hg-v284
- **STRATEGIES nav:** `super-setup`, `super-best`, `super-sniper`, `super-book`, `super-calibrate` (plus **GOLD → super-gold**).
- Shared helpers: **`super-desk-common.js`** (`hgSuperDeskValidationHtml`, SCORECARD link, chart vision enrich).
- **RISK v2:** TOOLS → RISK — optional **hold hours**, **funding / 8h %**, **India VDA tax + TDS** checkbox; engine in **`lib/crypto-position-risk.mjs`**.
- Tab open auto-scan hooks in `index.html` `HG_TAB_AUTO_SCAN` for each super tab.
- Tests: `tests/test-super-best.mjs`, `test-super-sniper.mjs`, `test-super-book.mjs`, `test-super-calibrate.mjs`, `test-super-gold.mjs`.
