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
- **Non-live upgrades:** EDGE cards show **FLOW OK / PARTIAL / N/A** when Binance CVD/OBI legs missing; tabalerts cover SMART $, OI FLOW, LIQS, SQUEEZE, CARRY, TERM BASIS watch on the **15-min** cycle; `hardRefreshAll` warms macro + layer tabs; static GitHub Pages shows proxy banner via `hghost.js` (`tests/test-hghost.mjs`); gate funnel tab labeled **GATES** (id `execute`); scanner cards show **IN BOOK** via `hgBookStampChip` (slotted; repaints on tab switch / after ADD TO BOOK).
- **Crypto setup accuracy (hg-v127):** SWING stops cap at **2.0×ATR** (was 1.5); G5 requires **volZ > 0.5 + wick commit** (no quiet-tape path); G6 floor **R:R ≥ 2.5**; `swingTryClean` needs **cascadeAge ≥ 3**; SCALP stop buffer **0.5×ATR** and G7 **≥ 2R**; EDGE needs **G5+G6**, tally **≥ 5**, **barAge ≤ 1**, **2.0×ATR** stops; SWING/SCALP Telegram alerts skip tickets below **2.5R / 2R**; `smartSetup` SWING min **2R**; BEST ranks **famScore ≥ 6** first.
- **Plan alignment (hg-v128):** EXECUTE/BRAIN prefer **`swingTryClean` SWING** over `smartSetup` when 7/7 CLEAN; post-enrichment **G6 re-check** (`hgSwingPostEnrichValid`); smartSetup mean-reversion branch is **`FADE`** (not the SCALP tab).
- **Telegram setups (hg-v129):** Unified **15-min** batch via `tabalerts.js` for **all tabs** (SWING, SCALP, EDGE, PINE, BRAIN, GOLD, SMART, layers, watches). Per-setup dedup in `hg_tabalert_keys`; cycle throttle in `hg_tabalert_last_run`. `HG_ALERT_CYCLE_MS` = 15 min. PINE quiet warm skips duplicate `pineFireAlerts` (tabalerts handles PINE).
- **Setup accuracy v2 (hg-v130):** SWING anchor **≤1.25×ATR** (was 1.5); G5 volZ **>0.75**; G1 spread **≥0.3×ATR**; cascadeAge **≥4**; SCALP G6 **volZ+wick** (no OR slope); scalp R:R **≥2.25** + post-enrich check; EDGE **tally≥6**, **barAge=0** only; BEST pool **fam≥7 & rob≥1**; FADE min **2R**; watch alerts need **≥6/7 gates**.
- **Alert dual clocks:** Set `RENDER_DISPATCH_PRIMARY=true` on GitHub when Render dispatches alerts every 13 min.
- **BRAIN live tests:** `tests/test-brain-live.mjs` pins IST clock for session gates. `tests/test-brain-robust.mjs` guards browser `brainrobust.js` LIVE eligibility vs daemon `brain-robust.mjs` (`liveOk` on `__hgBrainLast` rows), including live-mode toggles, chip HTML, gold `XAUTUSD` stack resolution, partial crowding veto, and rank/constant exports. `tests/test-brain-invalidation.mjs` covers booked-layer snapshots, PRIME→WATCH / direction-flip invalidation alerts, evidence-only layer drift, fund-scoped keys, `hgTelegramFormat` / `sendAlertPush`, and the 8-line Telegram batch cap in `braininvalidation.js`. **`tabalerts.js`** calls `hgBrainInvAlertsFromLast` on each 15-min setup cycle when post-entry invalidation is ON (uses latest `__hgBrainLast` snapshot).
- **Data layer CI:** `.github/workflows/data-layer-smoke.yml` runs `npm run test:data-layer` on push/PR to `main` (optional live-network smoke; exits 0 on Binance HTTP 451 or DNS/network skip for gold-api/Treasury).
- **Deploy check:** `npm run check:prod` / `node scripts/check-production.mjs` compares local `sw.js` `HG_CACHE` to `HARDGATE_SITE` (default Render). Mismatch means production has not picked up the latest merge yet. `tests/test-check-production.mjs` guards alert timing, README thresholds, `HG_SHELL` ↔ `index.html` script parity, and **`npm test` chain ↔ `tests/test-*.mjs`** completeness.
- **Daemon brain:** `tests/test-daemon-brain.mjs` contract-smokes `lib/daemon-brain.mjs` (headless synthesis seam + fast-fail on dead port).
- **Book runtime:** `tests/test-book.mjs` offline-smokes `book.js` (`addToBook` vetoes/success, IN BOOK stamps, fund routing, brain layer snapshot on add). `tests/test-book-routing.mjs` includes browser `book-routing.js` ↔ `lib/book-routing.mjs` parity cases.
- **Conviction lock:** `tests/test-conviction-lock.mjs` covers `conviction-lock.js` lifecycle (`STOPPED`/`EXPIRED`/`TARGET HIT`/`TIME_STOP`, `evaluateInvalidations`, `applyHardgateConvictionLock` mint/veto/venue keys). Daemon loads the same module via `lib/daemon-conviction.mjs`.
- **Star Trader tab:** `tests/test-startradertab.mjs` covers `startradertab.js` synthesis (`stSynthesize`, `stContextVotes`, `stDropForming`, EDGE scan fallback), PRIME tier promotion (swing+scalp+edge+regime), real `swingGateMatrix` wiring, squeeze/mean-rev family votes, and context veto nulling. `tests/test-startrader.mjs` covers `startrader.js` catalog + `xuniverse.js` merge legs.
- **Cryptogates:** `tests/test-cryptogates.mjs` covers shared swing/scalp gate matrices (`swingGateMatrix`, `scalpGateMatrix`, `swingTryClean`, `scalpTryClean`) used by STAR TRADER + cryptowatch.
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
