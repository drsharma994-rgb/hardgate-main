# AGENTS.md

## Cursor Cloud specific instructions

### Product

HARDGATE is a vanilla JS/HTML/CSS crypto + gold trading terminal. There is no build step and **zero npm runtime dependencies** — only Node.js 18+ is required to run the dev server and tests.

### Dev server

```bash
npm start   # serves static app + /api/proxy on http://localhost:10000
```

The server entry point is `scripts/server.mjs`. It serves the repo root and mounts `/api/proxy` (CoinDCX, Yahoo Finance, news RSS allowlist in `api/proxy.js`).

### Tests

```bash
npm test                              # core suites (brain, engine, smart, hgalert, ops, inline parse)
node tests/test-tabs.mjs              # tab wiring
node tests/<suite>.mjs                # per-module suites (see README.md)
```

Tests under `tests/test-data-layer.mjs`, `tests/test-gold-deep.mjs`, and similar live-network suites call external market APIs directly. In some cloud VM environments those calls return **HTTP 451** (geo-blocked). Offline/unit suites (`npm test`, `test-tabs`, `test-squeeze`, `test-regime`, etc.) do not depend on external network access.

### Optional production env vars

Only needed for Telegram squeeze alerts, GitHub dispatch cron replacement, or Render keep-alive — not for local dev:

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default `10000`) |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | Squeeze-watch Telegram alerts |
| `GH_DISPATCH_TOKEN` | GitHub Actions workflow dispatch |
| `RENDER_EXTERNAL_URL` / `SELF_PING_URL` | Render free-tier keep-alive |

### E2E verification

1. Start `npm start`
2. Open `http://localhost:10000` — header should show HARDGATE branding and tab nav
3. Confirm `/api/proxy` returns 200: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:10000/api/proxy?url=https://api.coindcx.com/exchange/v1/markets_details"`

Browser tabs load and render even when external Binance/Delta REST calls are blocked by CORS or geo-restrictions in the VM; the proxy path for CoinDCX/Yahoo still works server-side.
