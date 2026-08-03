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
| Unit + integration tests | `npm test` | Offline gate; full suite chain; no network required |
| Live data smoke test | `node tests/test-data-layer.mjs` | Optional; Binance legs skip on HTTP 451; exits 0 |
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
- **Shared setup plans (`plans.js`):** Loaded after `cryptogates.js`. `hgApplyExactEntry` unifies EDGE-parity exact entries (EMA21/9, sweep, OTE via `edgeSignal` when loaded) across SWING/SCALP/SMART/EXECUTE and scanner tabs. Also: `hgStructureStop`, `hgPlanSwingTargets`, `hgEnrichSwingClean`, `hgSwingParity`, etc.
- **Alert dual clocks:** Set `RENDER_DISPATCH_PRIMARY=true` on GitHub when Render dispatches alerts every 13 min.
- **BRAIN live tests:** `tests/test-brain-live.mjs` pins IST clock for session gates.

### Strategy → book plugin checklist

1. **Plan shape** — `entry`, `stop`, `t1`, optional `t2`
2. **CTA** — `bookBtnHTML(..., { scanner, strategy, layers })`
3. **Routing** — `lib/book-routing.mjs` + `tests/test-book-routing.mjs`
4. **Tests** — `tests/test-<tab>.mjs`; run `npm test`
5. **Ship** — bump cache in `sw.js` / script `?v=` when needed
