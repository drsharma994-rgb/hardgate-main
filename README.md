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

## Alerts

Toggle the 🔔 chip in the header. While ON, every 15 minutes a silent cycle runs:

1. **Delta** and **CoinDCX**: full best-setup scan — emails the top CLEAN pick when it changes
   (deduped by symbol+direction).
2. **Gold**: silent swing-gate read — emails only on a fresh STRONG verdict (all GS gates clean with a
   full plan), deduped the same way.

Emails go through EmailJS (account embedded in `index.html`). Push alerts go through **ntfy.sh** — set
your own topic in the UI when enabling alerts. Every alert also lands in the LOG tab.

A GitHub Actions job (`.github/workflows/alert-notify.yml`) replays the alert cycle against the live site
every 15 minutes, goes red on email-delivery failure, and stamps at most one keep-alive commit per day so
GitHub's 60-day scheduled-workflow auto-disable never bites.

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
