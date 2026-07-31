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
| Unit + integration tests | `npm test` | 144 assertions; no network required |
| Live data smoke test | `node tests/test-data-layer.mjs` | Hits Binance, Frankfurter, gold-api directly |
| Additional suites | `node tests/test-<name>.mjs` | See README "Tests" section for the full list |
| Lint | *(none)* | No ESLint or formatter configured |

### Gotchas

- **Binance geo-blocking (HTTP 451):** Cloud VMs in some regions cannot reach `fapi.binance.com` directly. `npm test` still passes (offline/mocked). `tests/test-data-layer.mjs` will fail with HTTP 451 in those environments. The browser UI may show degraded Binance-dependent tabs (SMART $, SQUEEZE, etc.) but Delta India, proxy-backed CoinDCX, and macro data still work.
- **Use the Node server, not `file://`:** Opening `index.html` directly skips `/api/proxy`, breaking CoinDCX, Yahoo, and gold-api fallbacks.
- **No runtime npm dependencies:** `package.json` has only `start` and `test` scripts. `npm install` is a no-op.
- **Node 18+ required:** Server and tests use ES modules and global `fetch`.
