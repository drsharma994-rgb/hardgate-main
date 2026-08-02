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
| Unit + integration tests | `npm test` | Offline gate; includes carry, liqs, macro, fred, warmup; no network |
| Live data smoke test | `node tests/test-data-layer.mjs` | Optional; Binance legs skip on HTTP 451 |
| Additional suites | `node tests/test-<name>.mjs` | See README Tests section |
| Lint | *(none)* | No ESLint or formatter configured |

### Gotchas

- **Binance geo-blocking (HTTP 451):** Cloud VMs in some regions cannot reach `fapi.binance.com` directly. `npm test` still passes (offline/mocked). `tests/test-data-layer.mjs` skips Binance legs on 451. The browser UI may show degraded Binance-dependent tabs (SMART $, SQUEEZE, etc.) but Delta India, proxy-backed CoinDCX, and macro data still work.
- **Use the Node server, not `file://`:** Opening `index.html` directly skips `/api/proxy`, breaking CoinDCX, Yahoo, and gold-api fallbacks.
- **No runtime npm dependencies:** `package.json` has only `start` and `test` scripts. `npm install` is a no-op.
- **Node 18+ required:** Server and tests use ES modules and global `fetch`.
- **Alert dual clocks:** If `GH_DISPATCH_TOKEN` is set on Render, set GitHub repo variable `RENDER_DISPATCH_PRIMARY=true` so scheduled `alert-notify.yml` runs do not overlap Render's 13-min dispatch.
- **EXECUTE BRACKET:** TRADE PLAN and BOOK **EXEC** post to same-origin `POST /api/execute` when `EXECUTE_BACKEND_URL` (or `EXECUTE_WEBHOOK_URL`) is set on Render. Payload includes `bracket.stop`, `bracket.takeProfit` (T1), and optional `bracket.takeProfit2` (T2 runner). Client module `execute.js`; optional Settings → Execute URL or `HG_EXECUTE_BACKEND_OVERRIDE`. `GET /api/execute/capabilities`.
- **CoinDCX:** No third-party CORS proxy fallbacks — only direct fetch or same-origin `/api/proxy`.
- **BRAIN auto-warm:** On load, `hgBrainAutoWarm()` runs in the background (~800ms after boot) with the same bounded layer starters as synthesis auto-warm — non-blocking; engine gate scan may continue after the cap.
- **TERM BASIS tab:** Dynamic `termbasis.js` module under STRATEGIES — Binance perp vs quarterly futures curve via `binanceBasis()`.
- **FRED macro (optional):** Set `FRED_API_KEY` on the server to enable `/api/fred` (DGS10, DTWEXBGS, DFII10). Without it, macro.js falls back to Treasury/Frankfurter/Yahoo as before.
- **LIQS session persist:** Rolling 1h liquidation prints persist in `window.localStorage` key `hg_liqs_session_v1`; BRAIN reads `liqsState()` instead of minting a fresh `liqAgg()` each synthesis.
- **BRAIN layer warm hooks:** `HG_warmups` may register `carry` and `termbasis`; BRAIN snapshots `carryState` / `termBasisState` as optional context votes (hush when cold, never dark). LIQS warm accounting uses `liqSnap`.
- **EDGE Telegram alerts:** `runEdgeAlertCycle()` every **15 min** — quiet `edgeWarm({ force: true })` then `hgTabAlertsRunEdge()` (new setups only; 15-min dedup per `sym:dir@entry`). SWING/SCALP/GOLD/BRAIN stay on the 3-min cycle. GitHub/Render `alert-check.mjs` replays the same path every 15 min.
- **Hosting mode:** `hghost.js` exposes `hgHostingMode()` / `hgApiAvailable()` — carry/termbasis tabs show an honest note on static GitHub Pages hosts without `/api/proxy`.
- **PAPER BOOK:** Multi-fund store (`?fund=` / `fund` body) — `GET/POST /api/book/funds`. Default **main**; presets gold/swing/macro. Scanner routing via `book-routing.js` / `lib/book-routing.mjs` — `bookScannerFund()` pins brain (gold→gold, crypto→main), edge/startrader (metal→gold, fx/index/commodity→macro, else swing), carry/termbasis→macro, macro/goldpro→gold, squeeze/oiflow/liqs/trendmx/meanrev/execute/best→swing, smart→main, finder-*→swing (finder-gold/metals→gold); explicit `fund:` on scanner cards wins. `book.js` `bookResolveFund()` calls `hgBookScannerFund()` when `scanner:` is set on the CTA meta. Open positions show a **scanner source chip** (first `layers[]` entry, usually the scanner id); recently closed rows show strategy + source too. BOOK header **EXEC/LIVE status bar** shows proxy/webhook readiness, auto-desk/auto-EXEC flags, and last bracket blotter result. Optional **Auto EXEC bracket on add** (`hg_book_auto_exec_v1` localStorage) fires `executeTrade` with `skipConfirm` after a successful intent when `/api/execute` is configured. Optional **Auto EXEC pending on refresh** (`hg_book_auto_exec_pending_v1`) silently batch-sends brackets for active-fund rows still showing EXEC — on each mark refresh. Optional **Auto retry failed on refresh** (`hg_book_auto_retry_failed_v1`) silently retries **BRACKET FAIL** rows on refresh. **Auto pending/retry all funds** (`hg_book_auto_exec_cross_fund_v1`) applies those refresh automations across every fund when 2+ books exist. **EXPORT CSV** includes a **bracket** column for open positions; **EXPORT ALL CSV** (multi-fund) adds a **fund** column across books. **BRAIN auto-add** (`hg_brain_auto_book_v1` checkbox): after synthesis/quick rescan, PRIME/HIGH with plans call `addToBook({ silent: true })` — deduped via `bookFetchOpenKeys` + 8h seen map. Optional **PRIME only** (`hg_brain_auto_book_prime_v1`) skips HIGH tier when auto-book is on. Optional **Auto EXEC after auto-add** (`hg_brain_auto_exec_v1`) batch-brackets only the positions just added via `bookExecuteBatchPositions`. Scanner **ADD TO BOOK** CTAs pass **T2** (`meta.t2`) when the plan defines a runner target — forwarded through `addToBook` to EXEC/LIVE brackets. BOOK open rows show **Bracket** status (`BRACKET OK` / `BRACKET FAIL` / `EXEC —`) from execute blotter. Weekly/consolidated LP digest includes bracket rollup line. **FIND TRADE** valid strategy panels expose ADD TO BOOK + TRADE PLAN handoff. BRAIN cards pass **T2** to book + trade plan when present. **CARRY** and **TERM BASIS** tabs expose `ADD · MACRO` when plan levels exist. **MACRO (AUTO)** panel and **GOLD PRO** levels expose `ADD TO BOOK` via `macroGoldPlan()` / `goldProPlan`. Consolidated desk rollup: `GET /api/book/desk` (cross-fund equity, heat, open count, **daily loss halt**). **Daily loss halt** (`BOOK_MAX_DAILY_LOSS_PCT` env or default 2% of UTC day-start equity): `pbRiskCheck` vetoes new intents; desk + BOOK show **DAY HALT**; existing positions may still be managed/EXEC'd. Consolidated LP: `GET /api/book/consolidated?period=month|week`. Cross-fund attribution: `GET /api/book/attribution`. Weekly cron digest sends **all-funds consolidated** rollup unless `LP_DIGEST_FUND` is set. BOOK **EXEC PENDING** / **RETRY FAILED** batch-send brackets for open rows without a blotter record or after `BRACKET FAIL`; with 2+ funds, **ALL FUNDS PENDING** / **ALL FUNDS RETRY** run the same across every fund book. **EXEC** on a row uses `executeTrade` when `/api/execute` is configured (forwards T2 when set on the position); results append to blotter via `POST /api/book/execute-blotter` (execute_ok / execute_fail with idempotency key; `fund` body routes to the correct fund). Execute proxy retries once on 502/503/504 and forwards `Idempotency-Key`.
- **BRAIN live tests:** `tests/test-brain-live.mjs` pins `__hgBrainSetClock()` to mid-session IST so off-hours conviction haircuts do not flake CI.
- **Shared setup plans (`plans.js`):** Loaded after `cryptogates.js`. Centralizes `hgStructureStop`, `hgPlanFromRisk`, `hgPlanLevelsCore`, `hgDetectLiquiditySweep`, `hgConfirmedCascade`, `hgRegimeAllowsSetup`, `hgSwingParity`. BEST tab uses `swingTryClean`; EXECUTE requires SWING G6/G7 parity when cryptogates is loaded; EDGE requires G5 or G6 when both are explicitly false.

### Strategy → book plugin checklist

When adding a scanner/strategy that should land in the paper book:

1. **Plan shape** — expose `entry`, `stop`, `t1`, optional `t2` (never invent levels).
2. **CTA** — `bookBtnHTML(sym, dir, entry, stop, t1, { scanner: '<id>', strategy, tier, klass, layers })` or `addToBook({...})`.
3. **Routing** — add `scanner:` pin in `lib/book-routing.mjs` + `tests/test-book-routing.mjs`.
4. **Fund** — explicit `fund:` on meta when routing is special; else `bookScannerFund()` decides.
5. **Tests** — string or fixture test in `tests/test-<tab>.mjs`; run `npm test`.
6. **Ship** — bump `HG_CACHE` in `sw.js`, update this file if non-obvious.

BOOK **EXEC/LIVE status bar** shows auto EXEC, **BRAIN auto-book**, active-fund **7d bracket** chips, cross-fund **desk 7d** rollup when multi-fund, and last blotter event. **LIVE OK** / **LIVE FAIL** chips reflect successful `live_send` blotter rows (not just proxy EXEC). Multi-fund **desk rollup** (`GET /api/book/desk`) includes cross-fund 7d bracket counts and clickable **EXEC all pending** / **retry all failed** chips. With 2+ funds, BOOK shows **ALL FUNDS PENDING** / **ALL FUNDS RETRY**, **EXPORT ALL CSV**, **Auto pending/retry all funds**, a **cross-fund open positions** table (fund column + EXEC/LIVE/fill chips on every row), a **Recently closed (all funds)** panel (12 rows, fund column + scanner source), and a **Cross-fund execute events** blotter panel; `execute.js` routes blotter writes via `plan.fund` / `position._fundId`. **EXPORT BLOTTER** downloads execution blotter CSV (all funds when multi-fund; respects **EXEC only** filter when set). Per-fund and **EXPORT ALL CSV** include **stop**, **t1**, **t2**, **bracket**, and **fill** columns (`FILL OK` / `FILL n%` / `UNFILLED` when bracket sent). `POST /api/book/execute-fill` records broker fill qty (`FILL OK` / `FILL n%` chips on open rows); **`POST /api/book/poll-fills`** and **`GET /api/execute/fill-status`** poll the execute backend (`EXECUTE_FILL_POLL_URL` or `{origin}/fill-status` derived from `EXECUTE_BACKEND_URL`). BOOK **POLL FILLS** button, desk **poll fills** chip, optional **auto poll broker fills on refresh**, per-row **UNFILLED** / partial **FILL n%** chips (click to poll single position via `POST /api/book/poll-fill`), clickable **fills** chip on the exec bar to filter open positions to fill backlog only, and clickable **7d pending** chip to filter to bracket-pending rows. **LIVE** `live_send` blotter rows count in 7d bracket rollup and **last bracket** chip. **LIVE** webhook responses with fill JSON auto-apply via `pbApplyExecuteFill` (same as EXEC proxy path). Desk rollup + `alert-check` nudge when brackets are sent but fills are missing/partial. Optional `BOOK_EXECUTE_FILL_SECRET` on the fill webhook. `scripts/alert-check.mjs` probes `/api/book/desk` every 15 min and pushes when positions lack brackets or sends failed (4h throttle while backlog persists), when the desk enters or leaves **daily loss halt**, and when broker fills are missing/partial (auto-attempts `POST /api/book/poll-fills` before alerting when `fillPoll` is configured). Weekly/consolidated LP digests include **Broker fills** backlog lines and a **LIVE webhook** line when `live_send` blotter events exist in the period.
