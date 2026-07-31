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
- **EXECUTE BRACKET:** Hidden until `EXECUTE_BACKEND_URL` is set in `index.html` (non-empty, not the placeholder host).
- **CoinDCX:** No third-party CORS proxy fallbacks — only direct fetch or same-origin `/api/proxy`.
- **BRAIN auto-warm:** On load, `hgBrainAutoWarm()` runs in the background (~800ms after boot) with the same bounded layer starters as synthesis auto-warm — non-blocking; engine gate scan may continue after the cap.
- **TERM BASIS tab:** Dynamic `termbasis.js` module under STRATEGIES — Binance perp vs quarterly futures curve via `binanceBasis()`.
- **FRED macro (optional):** Set `FRED_API_KEY` on the server to enable `/api/fred` (DGS10, DTWEXBGS, DFII10). Without it, macro.js falls back to Treasury/Frankfurter/Yahoo as before.
- **LIQS session persist:** Rolling 1h liquidation prints persist in `localStorage` key `hg_liqs_session_v1`; BRAIN reads `liqsState()` instead of minting a fresh `liqAgg()` each synthesis.
