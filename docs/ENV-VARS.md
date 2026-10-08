# HARDGATE — environment variable reference (single source of truth)

Every variable the server, scripts, and workflows read, with where it is read and
what it does. Render deployment keys are also listed in `render.yaml`
(`sync: false` means the value lives only in the Render dashboard).

## Server, port & deploy

| Variable | Read in | Purpose |
|---|---|---|
| `PORT` | `scripts/server.mjs` | HTTP listen port (default `10000`, Render injects it) |
| `NODE_VERSION` | `render.yaml` | Pins the Render Node runtime (currently `22.11.0`) |
| `RENDER_EXTERNAL_URL` | `scripts/server.mjs`, daemon scripts | Public URL of this deployment (self-ping base) |
| `SELF_PING_URL` | `scripts/server.mjs` | Override for the keep-alive ping target |
| `TRIGGER_DEPLOY` | deploy scripts | Triggers a Render deploy via API |
| `RENDER_API_KEY` | deploy scripts | Render API key for deploy-trigger calls |
| `RENDER_SERVICE_NAME` / `RENDER_SERVICE_ID` | deploy scripts | Which Render service to redeploy |
| `HARDGATE_SITE` / `HARDGATE_URL` | daemon / alert scripts | Base URL used when the app pings or links itself |
| `HG_RATE_LIMIT` / `HG_RATE_MAX` / `HG_RATE_MUTATING_MAX` / `HG_RATE_WINDOW_MS` | `lib/rate-limit.mjs`, wired in `scripts/server.mjs` | Rate limit on all `/api/*` routes: `HG_RATE_LIMIT=0` disables; defaults **1200 reads/min + 30 writes/min** over a 60s window (reads were 300/min at first deploy — the live terminal's own polling saturated it, so real users were 429-ed; raised in hg-v1170). Client keyed by the **last `X-Forwarded-For` hop** (the trusted proxy append — a spoofed first hop lands the spoofer in their own bucket); loopback exempt; over-budget requests get `429` + `Retry-After` |
| `HG_GEO_FALLBACK` | `api/proxy.js` | `0` disables the geo-blocked-mirror fallback list |
| `HG_GEO_FALLBACK_HOST` | `api/proxy.js` | Override for the fallback mirror host list (default `hardgate-main.onrender.com`) |

## Client API auth & webhook secrets (fail-closed)

| Variable | Read in | Purpose |
|---|---|---|
| `HARDGATE_API_SECRET` | `lib/api-auth.mjs` | Shared secret for **mutating** routes. With no secret set, mutating routes return **503** (fail-closed). Send as `X-Hardgate-Key` or `Authorization: Bearer …` |
| `HARDGATE_WEBHOOK_SECRET` (+ `_PREVIOUS`) | webhook libs | HMAC secret for inbound webhooks; `_PREVIOUS` allows secret rotation overlap |
| `BOOK_EXECUTE_FILL_SECRET` | `lib/execute-api.mjs` | Secret for fill-report callbacks into the paper book |
| `BOOK_DIGEST_CRON_SECRET` | `scripts/book-digest-watch.mjs` | Secret the cron caller must present |
| `FORMATION_NIGHTLY_KEY` | `lib/formation-nightly-api.mjs` | Key for formation-nightly trigger routes |
| `GH_DISPATCH_TOKEN` | `scripts/gh-dispatch.mjs` | GitHub token used by the server-side dispatcher (repo-dispatch) |
| `GH_REPO` / `GH_WORKFLOW` | `scripts/gh-dispatch.mjs` | Target repo/workflow for dispatches |

## Market-data provider keys (read server-side only, never shipped to the client)

| Variable | Read in | Purpose |
|---|---|---|
| `COINALYZE_API_KEY` | `api/coinalyze.js` | Coinalyze REST key |
| `COINGLASS_API_KEY` | `api/coinglass.js` | Coinglass REST key |
| `FRED_API_KEY` | `api/fred.js` | FRED macro series key |
| `GLASSNODE_API_KEY` | `api/onchain-alt.js` | Glassnode on-chain key |
| `WHALE_ALERT_API_KEY` | `api/onchain-alt.js` | Whale Alert key |
| `OPENBB_API_URL` / `OPENBB_API_USERNAME` | OpenBB adapter | OpenBB backend endpoint + user |
| `HEY_LENS_API_URL` | `lib/hey-lens-api.mjs` | HeyLens backend endpoint |
| `GEMINI_API_KEY` | `render.yaml` (dashboard) | Gemini key for AI desks |
| `XM_TRADERS_URL` / `XM_TRADERS_TOKEN` / `XM_TRADERS_SYMBOL` | XM adapters | XM traders feed |
| `XM_MT5_URL` / `XM_MT5_TOKEN` / `XM_MT5_STYLE` / `XM_GOLD_SYMBOL` | XM MT5 bridge | MT5 bridge endpoint; default symbol `XAUUSD` |
| `XM_OMNIGOLD_LIVE` / `XM_OMNIGOLD_LOTS` | XM omnigold | `0` = dry-run; default lots `0.01` |
| `DELTA_EXECUTE_URL` | `lib/execute-core.mjs` | Delta exchange execution endpoint |

## Execution & risk

| Variable | Read in | Purpose |
|---|---|---|
| `EXECUTE_CCXT_EXCHANGE` | `lib/hardgate-executor.mjs` | ccxt exchange id (e.g. `binance`) |
| `EXECUTE_CCXT_API_KEY` / `EXECUTE_CCXT_API_SECRET` / `EXECUTE_CCXT_PASSWORD` | ccxt executor | Exchange credentials |
| `EXECUTE_CCXT_SECRET` | ccxt executor | Alias for the API secret on some adapters |
| `EXECUTE_CCXT_SANDBOX` | ccxt executor | `1`/`true` = sandbox/testnet |
| `EXECUTE_CCXT_DEFAULT_TYPE` | ccxt executor | ccxt `options.defaultType` (spot/future) |
| `EXECUTE_RISK_PCT` | `lib/risk-rules.mjs` | Risk per trade as percent of book |
| `EXECUTE_VWAP_DEPTH` / `EXECUTE_TWAP_SLICES` / `EXECUTE_TWAP_INTERVAL_MS` | execution algos | VWAP/TWAP slicing parameters |
| `EXECUTE_WEBHOOK_URL` / `EXECUTE_FILL_POLL_URL` | `lib/execute-*.mjs` | Outbound execution webhook + fill poll target |
| `HARDGATE_TRADING_HALT` | `lib/execute-api.mjs`, `lib/daemon-loop.mjs` | `1` = manual halt on new executions |
| `HARDGATE_KILL_SWITCH` | `lib/kill-switch.mjs` | `1`/`true` = manual kill switch |
| `HARDGATE_KILL_SWITCH_PCT` / `HARDGATE_KILL_SWITCH_PROFIT_PCT` | `lib/kill-switch.mjs` | Automatic drawdown/profit kill thresholds |

## Notifications

| Variable | Read in | Purpose |
|---|---|---|
| `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID` | alert/notify scripts + workflows | Telegram bot delivery |
| `SENDGRID_API_KEY` / `RESEND_API_KEY` | notify adapters | Email delivery |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | notify adapters | SMTP fallback delivery |
| `LP_DIGEST_WEBHOOK_URL` / `LP_DIGEST_FUND` | LP digest job | Liquidity-provider digest target |

## Daemon, agents & state

| Variable | Read in | Purpose |
|---|---|---|
| `HARDGATE_DAEMON_AUTOSTART` | `scripts/server.mjs` | `1`/`true` forks the daemon when the server boots |
| `HARDGATE_DAEMON_DRY_RUN` | daemon scripts | `1` = no side effects |
| `HARDGATE_AGENT_SWARM` | agent swarm scripts | Swarm mode selector |
| `HARDGATE_AGENT_STATE_FILE` | `lib/agent-state.mjs` | Agent state file path (default `hardgate-agent-state.json`, gitignored) |
| `HARDGATE_AGENT_TIMEOUT_MS` / `HARDGATE_BRAIN_TIMEOUT_MS` | agent/brain runners | Per-agent timeouts |
| `HARDGATE_BRAIN_LIVE` | brain runner | `1` = live brain cycle |
| `HARDGATE_SCAN_MS` | scan loop | Scan cadence override |
| `HEARTBEAT_STALE_HOURS` | `scripts/pipeline-heartbeat.mjs` | Heartbeat staleness threshold |
| `ATOMIC_SCAN_TOP` | atomic scan | How many symbols to scan |
| `HG_SCORE_JSON` | score pipeline | Score export path |
| `PAPERBOOK_PATH` | paperbook | Paper book JSON path (gitignored default) |

## GitHub repository variables (Actions `vars`, NOT server env)

| Variable | Set where | Purpose |
|---|---|---|
| `RENDER_DISPATCH_PRIMARY` | GitHub repo variable (`vars.RENDER_DISPATCH_PRIMARY`) | **Dual-clock alert switch.** When `true`, `.github/workflows/alert-notify.yml` skips every *scheduled* run (manual dispatches still fire) because the Render-side dispatcher (started by the server, `scripts/gh-dispatch.mjs`) owns the every-13-min alert clock instead of GitHub cron. `pipeline-heartbeat.yml` forwards the same value so the heartbeat knows which clock to expect. Set it **on GitHub** when Render dispatch is active — setting it as a server env var does nothing. |

### Suggested checklist when flipping the dual clock

1. Render dispatcher working (`/api/gh-dispatch` status shows armed + dispatches succeeding).
2. Set GitHub repo variable `RENDER_DISPATCH_PRIMARY=true`.
3. GitHub scheduled alert runs go quiet (they log the skip); heartbeat stays green.
4. To fall back to GitHub cron: delete the variable (or set `false`).
