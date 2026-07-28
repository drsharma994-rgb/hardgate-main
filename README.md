# HARDGATE

**Gates, not scores.** A single-file trading terminal for crypto perpetual futures and gold, built on one
discipline: every setup must pass a ledger of explicit pass/veto gates, and any single veto stands the
trade aside. No composite scores, no black boxes — every gate shows its evidence.

Runs entirely in the browser against free public data. No build step, no backend required (one optional
execution endpoint, disabled by default). When deployed on Vercel, a small same-origin function
(`/api/proxy`) covers the CORS-blocked CoinDCX/Yahoo reads.

## The 23 tabs

Seventeen tabs are static markup in `index.html`; six more (SQUEEZE through GOLD PRO below) are classic-script
modules that register on `window.HG_tabs` and get a nav button + pane at boot, mounted lazily on first open.

| Tab | What it does |
|---|---|
| **BIAS** | Daily direction verdict: 1D structure, 4H cascade, momentum, funding crowding, TSMOM, CUSUM, sentiment + a Binance cross-exchange confirm row (informational only) |
| **SWING SCAN** | 4H swing setups across the exchange universe: EMA cascade with real spread, HTF side, RSI guard, funding clean, vol/wick commit, structural R:R ≥ 2, CUSUM |
| **SCALP SCAN** | 1H trend + 15m Judas sweep-and-reclaim triggers, RSI band, ≥25 min to funding settlement, ATR vol-alive, 1.5R vol-capped targets |
| **COIL WATCHLIST** | Compression stalker: finds stored-energy ranges, then an expansion check on volume spike |
| **APEX (RS)** | Relative-strength scan |
| **LIQUIDITY TRAP** | Trap patterns around swept levels |
| **SMC (FVG)** | Fair Value Gaps: displacement, unmitigated, tap, HTF context |
| **ORDER BLOCKS** | OB detection with mitigation tracking |
| **DIVERGENCE** | RSI divergence scan |
| **GOLD** | XAUUSD session-aware ledgers (swing GS1–GS7 + kill-zone Judas scalps), auto macro panel (DXY, 10Y, real-rate hint), 37-gate deep scan, Twelve Data key override |
| **SMART $** | Binance positioning scanner: price/OI regime, funding crowding, retail contrarian, top-vs-retail divergence, taker imbalance — evidence cards, ≥2 reads to list |
| **SQUEEZE** | TTM-squeeze + Donchian-breakout scanner on the Binance perp universe: 4H fire signals filtered by 1D trend, participation and momentum marks |
| **TREND MATRIX** | Multi-timeframe trend dashboard for the top 60 Binance perps: 1D trend, EMA50/200 cross, 4H cascade, Ichimoku cloud, ADX strength — composite −5..+5 |
| **OI FLOW** | Deep positioning scanner on the top 40 Binance perps: funding z-score, OI 24h Δ, price 24h Δ, taker flow, retail long% — squeeze/crowding classification |
| **REGIME** | Market-wide RISK-ON / RISK-OFF dashboard: 7 gauges (BTC 1D trend, ETH/BTC slope, BTC dominance, Fear & Greed, DXY, US 10Y, gold) — score ±6, ≥±3 calls the regime |
| **CARRY** | Delta-neutral funding carry: Binance vs Delta India funding APR side by side, cross-venue spread cards when the gap ≥ 25% annualized |
| **GOLD PRO** | Professional gold context: 1D/4H structure, gold-stamped macro ledger (DXY, 10Y, real-rate hint, gold/silver ratio, PAXG positioning), 60-day gold–DXY correlation |
| **BEST** | Whole-exchange cascade: the seven hard gates + evidence scoring; emails the top pick when alerts are on |
| **BASIS** | Funding/basis monitor (Delta + Binance 8h funding side by side) |
| **SEARCH** | Cross-exchange symbol lookup + on-demand Twelve Data swing backtests |
| **LOG** | Auto-logged CLEAN setups, outcomes graded against closed candles (conservative same-bar = SL rule) |
| **TRADE PLAN** | Fixed-R ticket builder with portfolio-heat check and an optional execution backend |
| **FIND TRADE** | Per-symbol evaluation of all strategies + full backtest context |

## Free data sources

| Source | Used for | Key? |
|---|---|---|
| **Delta Exchange India** public API + WebSocket | Primary crypto perp tickers, funding, candles | No |
| **CoinDCX** public API (via same-origin Vercel function `/api/proxy`) | Secondary crypto perps (no funding/turnover fields — gates degrade honestly) | No |
| **Binance USD-M futures `fapi`** | SMART $ positioning (funding, OI history, retail/top-trader ratios, taker flow), **XAUUSDT TradFi perp — primary gold instrument** (klines, funding, OI), PAXG gold candles, B1 cross-exchange confirm | No |
| **US Treasury** daily yield-curve CSV | US 10Y yield for the macro panels (replaces the dead Yahoo `^TNX` leg) | No |
| **gold-api.com** | Spot XAU/XAG (gold/silver ratio + spot context) | No |
| **DeFiLlama** stablecoins API | Stablecoin-supply gauge (market-regime context) | No |
| **Frankfurter (ECB reference rates)** | DXY proxy computed from 6 currency pairs | No |
| **alternative.me** | Fear & Greed sentiment index | No |
| **CoinGecko** | BTC dominance | No |
| **Twelve Data** | Crypto backtest history + gold candle fallback | Free key — built-in, overridable in the GOLD tab (stored in `localStorage` as `hg_td_key`) |
| **Yahoo Finance via `/api/proxy`** | Gold `GC=F` fallback, silver | Best-effort, nullable legs degrade to "—" |
| **ntfy.sh** | Push alerts to your phone — topic set in the UI | No (your own topic) |

The Binance **XAUUSDT TradFi perp** is the primary gold instrument (klines, funding and open interest on
`fapi`), with candle fallbacks **Binance PAXG → Twelve Data → Yahoo `GC=F`**; the active source is shown on
the GOLD tab's DATA chip and in backtest footers.

## Run it

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages). Everything loads from the folder
plus one CDN library (EmailJS).

## Deploy & version workflow

Production lives at **https://hardgate-main.onrender.com** (Render web service, `render.yaml` blueprint,
auto-deploys on every push to `main`; `scripts/server.mjs` serves the static app + `/api/proxy` on one
origin). The Vercel project (`.vercel/`, team apex-terminal1) is parked — deploys blocked by team billing
since 2026-07-29; `vercel --prod --yes` resumes it if billing is reactivated.

1. Make the change; run the affected test suites (`node tests/test-brain.mjs`, …) — all assertions must pass.
2. Ship: commit → push. **Render auto-deploys from `main`** (no CLI step); `vercel --prod --yes` only if
   the Vercel team is live again.
3. **Commit immediately after every change** — the git history on `main` always mirrors what Render
   deploys. Include what changed + test status in the message.
4. Push to GitHub (`git push origin main`) — the repo is the source of truth for the alert workflow.
5. Full snapshots on request: `hardgate-vN.zip` of the whole folder, kept in the parent directory.

### Hosting state (decided 2026-07-24)

- **Repo visibility: PUBLIC** (`github.com/drsharma994-rgb/hardgate-main`). Nothing secret is exposed —
  the EmailJS keys are client-side and already visible on the live site. Bonus: scheduled Actions are
  free/unlimited on public repos.
- **GitHub Pages mirror: ENABLED — owner decided to KEEP it** at
  https://drsharma994-rgb.github.io/hardgate-main/ — serves the same `main` as Vercel and rebuilds on
  every push, but STATIC-only: `/api/proxy` does not exist there, so CoinDCX and Yahoo macro reads
  degrade to "—". Delta India / Binance / BRAIN / Entry Ticket / alerts all work.
- **Primary site: Render** (https://hardgate-main.onrender.com — full functionality incl. the proxy;
  auto-deploys from `main`). Vercel parked (team billing block). The push updates the Pages mirror on
  its own.

## Alerts

Toggle the 🔔 chip in the header. While ON, every 15 minutes a silent cycle runs:

1. **Delta** and **CoinDCX**: full best-setup scan — alerts the top CLEAN pick when it changes
   (deduped by symbol+direction).
2. **Gold**: silent swing-gate read — alerts only on a fresh STRONG verdict (all GS gates clean with a
   full plan), deduped the same way.

**Telegram is the primary alert channel** (free Bot API, no quota) — save your bot token + chat id in the
header (stored in this browser only) and hit TEST. EmailJS is the automatic fallback when Telegram is not
configured or fails. Push alerts can also go through **ntfy.sh** as a second free channel. Every alert
lands in the LOG tab.

A GitHub Actions job (`.github/workflows/alert-notify.yml`) replays the alert cycle against the live site
every 15 minutes. With the `TELEGRAM_TOKEN` + `TELEGRAM_CHAT_ID` repo secrets set, CI injects them into
the page so setup alerts send natively with full levels (EmailJS quota irrelevant); CI-side pushes
(entry-ticket changes, engine-dark watchdog, email-failure fallback) cascade Telegram → ntfy. The job
goes red only when an alert could NOT be delivered on any channel, and stamps at most one keep-alive
commit per day.

A GitHub Actions job (`.github/workflows/alert-notify.yml`) replays the alert cycle against the live site
every 15 minutes, goes red on email-delivery failure, and stamps at most one keep-alive commit per day so
GitHub's 60-day scheduled-workflow auto-disable never bites. The same job also completes one BRAIN
synthesis per run and watches the **ENTRY TICKET**: a new symbol, a moved entry price, or a side
appearing/vanishing triggers a **Telegram push straight from the runner** (ntfy as fallback channel) —
so ticket alerts reach you even with the app closed. First recorded state seeds silently; a failed
synthesis leaves the committed ticket state untouched. The same run also
verifies the **gate engine is publishing** after the synthesis: a null or 45-min-stale `engineState`
(the 2026-07-25 all-ASIDE outage class) fires one throttled push per 2h per continuous outage, and
recovery clears the stamp.

## Tests

```
node tests/extract-inline.mjs     # inline <script> blocks parse + key markers present
node tests/test-tabs.mjs          # tab wiring: HG_tabs registration, boot, nav/panes, lazy mount
node tests/test-data-layer.mjs    # live-network smoke: binance.js, macro.js, DXY, PAXG
node tests/test-gold-deep.mjs     # 37-gate gold deep scan, macro-null degradation, quick ledgers
node tests/test-smart.mjs         # SMART $ classifier, symbol mapping, B1 confirm, scan end-to-end
node tests/test-backtest-ux.mjs   # chunked backtests: identical results, progress, cooperative cancel
node tests/test-indicators2.mjs   # extended indicators (TTM squeeze, z-score, correlation…)
node tests/test-squeeze.mjs       # SQUEEZE classifier + scanner
node tests/test-trendtable.mjs    # TREND MATRIX components + composite
node tests/test-oiflow.mjs        # OI FLOW pure classifier
node tests/test-regime.mjs        # REGIME gauges + aggregate verdict + mount smoke
node tests/test-carry.mjs         # CARRY spread math + matching
node tests/test-goldpro.mjs       # GOLD PRO structure/macro/correlation logic
node tests/test-ops.mjs           # ops: /api/proxy allowlist + passthrough, alert heartbeat/email gate, config sanity
```

## Repo layout

```
index.html      the whole app shell (markup + core app logic inline)
indicators.js   shared indicators (EMA/RSI/ATR/CUSUM/swing/vol-profile…)
indicators2.js  extended indicators (TTM squeeze, z-score, correlation, Ichimoku…)
store.js        tiny localStorage helpers
binance.js      Binance fapi data layer + token bucket
macro.js        gold candle fallback chain + gold macro (DXY/10Y/silver) + DXY-from-rates
squeeze.js      SQUEEZE tab module (window.HG_tabs)
trendtable.js   TREND MATRIX tab module
oiflow.js       OI FLOW tab module
regime.js       REGIME tab module
carry.js        CARRY tab module
goldpro.js      GOLD PRO tab module
api/proxy.js    same-origin Vercel proxy (CoinDCX + Yahoo allowlist) — replaces the dead Render proxy
alert-state.json
scripts/        alert-check helper (CI alert replay + email gate + keep-alive heartbeat)
tests/          node test suites above
archive/        dead source modules kept for reference only — never loaded by index.html
```

## Disclaimer

Educational tool, not financial advice. Gates replay what already happened and filter what is happening;
neither is a promise about what happens next. Backtests exclude funding and volume-z where the data
doesn't exist, include no fees/slippage, and the app says so wherever it shows them. Any real order
routing is your own endpoint, your own keys, your own responsibility.
