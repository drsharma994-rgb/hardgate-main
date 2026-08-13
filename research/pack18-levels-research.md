# Pack 18: Determining Exact Trade Levels and Position Size — Research Reference

**Purpose of this document:** a citation-backed reference for a manually-executed crypto-perpetuals and gold signal terminal. The app has no order routing — it must *tell* the trader an exact entry, stop, take-profit(s), and what leverage/position size to set. This document does not cover execution, API automation, or bots; it covers only the math and evidence behind the numbers the app should display.

Every number pulled from a source is cited inline. Where sources disagree, that is stated explicitly rather than silently picking one. All formulas are written in plain arithmetic notation for direct transcription into JavaScript.

---

## 1. Stop Placement

### 1.1 ATR-multiple stops

There is **no single authoritative ATR multiplier** — conventions range from 1× to 4×+ depending on source and trading style, and this spread should be treated as genuine disagreement, not a gap in research:

- A widely-cited answer on stop distance explains that **1× ATR is too tight** — an average-ranging day alone will stop you out — **2× ATR is still close**, and **3×–4× ATR is what most trend-following traders use** to avoid noise stop-outs. The original Turtle Trading system used **2N** stops, where N is an ATR-like volatility unit (worked example: corn contract N = 7¢, contract risk = 7¢ × $50 = $350, so a 2N stop = $700 risk per contract) ([money.stackexchange.com](https://money.stackexchange.com/questions/47603/how-is-atr-multiple-calculated-in-trend-turtle-trading)).
- A TradingView explainer on why ATR stops work uses **2× ATR as a standard fixed-stop** example (GBP/USD with 50-pip ATR → 100-pip stop) and **1.5× ATR** for a trailing stop under the most recent high in an uptrend. It explicitly warns against blindly applying 2× ATR without checking the level against actual support/resistance, and states the stop should never be widened once set ([TradingView](https://www.tradingview.com/chart/EURUSD/cUakoBgc-Why-ATR-Stops-Work-And-When-They-Don-t/)).
- Investopedia's ATR reference cites the **Chandelier Exit** (Chuck LeBeau) — a trailing stop placed under the highest high since entry at "some multiple × ATR," without specifying a fixed multiple, and gives the underlying True Range and ATR formulas ([Investopedia](https://www.investopedia.com/terms/a/atr.asp)):
  ```
  TR = Max[(High - Low), |High - PrevClose|, |Low - PrevClose|]
  ATR = (Previous ATR * (n - 1) + TR) / n
  ```

**Practical range to encode:** 1.5×–2× ATR for tight/high-conviction setups, 2×–3× ATR for standard swing setups, 3×–4× ATR for position trading with correspondingly smaller size. Treat any single fixed multiplier as a starting default, not a proven optimum — no primary source establishes one multiplier as objectively correct across assets/timeframes.

**Position-sizing worked example (ATR-based stop):** $10,000 account, 2% risk = $200, stop = 4×ATR = $0.80 away → position size = $200 / $0.80 = 250 units ([money.stackexchange.com](https://money.stackexchange.com/questions/47603/how-is-atr-multiple-calculated-in-trend-turtle-trading)).

### 1.2 Structure-based stops and the "noise band" principle

The task brief's instinct — stops belong beyond a noise band, not on round numbers — is directly supported by primary market-microstructure research on where stop and take-profit orders actually cluster and what happens when price reaches those clusters.

**Primary source: Osler (2003), "Currency Orders and Exchange Rate Dynamics," *Journal of Finance* 58(5):1791–1819** ([full text, Georgetown mirror](https://faculty.georgetown.edu/evansm1/New%20Micro/osler1.pdf); [abstract, IDEAS/RePEc](https://ideas.repec.org/a/bla/jfinan/v58y2003i5p1791-1819.html)). This is a large, real order-book dataset from a major FX dealing bank (August 1999–April 2000; 9,655 orders, aggregate face value >$55 billion; 3,935 stop-loss orders and 5,720 take-profit orders across USD/JPY, USD/GBP, EUR/USD). Key, specific findings:

- **Stop-loss buy orders cluster just above round numbers** (prices ending in 00 or 50); **stop-loss sell orders cluster just below round numbers**. **Take-profit orders cluster more strongly exactly at round numbers.**
- At price levels ending in 00: 14.3% of executed stop-loss buy orders had execution prices ending 01–10, versus only 6.9% ending 90–99 (statistical significance 0.028). At levels ending in 50: 18.1% of stop-loss buys ended 51–60 versus 6.3% ending 40–49 (significance 0.002).
- Take-profit orders clustered exactly at price levels ending in 00 for 9.9% of total value, versus only 3.8% for stop-loss orders — confirming take-profits sit *at* round numbers while stops sit just *beyond* them.
- **Rates trend faster and further after crossing a round number than after crossing an arbitrary number** — direct evidence of stop-loss cascades: e.g., DEM moved 0.061% in the 15 minutes after crossing a round number versus 0.054% after an arbitrary number (significance <0.001%), consistent across DEM, JPY, and GBP.
- Rates also **reverse more often** right at round numbers (take-profit dominance): 59.3% reversal frequency at round numbers vs. 54.8% at arbitrary levels (significance <0.001%).
- The stop-loss cascade effect is **larger and longer-lasting** (significant for 2+ hours) than the take-profit reversal effect (significant for under 30 minutes).
- The very largest orders in the dataset are disproportionately stop-losses clustered near round numbers: 62% of face value of the largest stop-loss orders sat within 1–10 or 90–99 of a round number, versus only 28% for the largest take-profit orders.
- Osler's own caveat, worth repeating rather than glossing over: **"statistical analysis cannot prove the connection [between clustering and cascades] is causal"** — the paper describes stop-loss orders as something that "may contribute to" cascades, not a proven mechanical cause.

**Implication for stop design:** placing a stop exactly at a round number, or exactly at an obvious swing low, puts it inside a zone with statistically elevated triggering activity and, once triggered, elevated subsequent momentum in the adverse direction. A stop should sit *beyond* the level that would look "obvious" on a chart (swing low, round number, wick low) by an amount tied to measured volatility (ATR) rather than an arbitrary fixed offset — this is the quantitative justification for a "noise band" beyond structure rather than a stop parked directly on the structure level.

Additional related clustering literature exists (order clustering on Euronext, FX price clustering, and a 2024 Georgetown CRI working paper on round-number price allure for retail investors) but was not deep-dived here since the Osler paper alone is a sufficient, primary, heavily-cited source for this section; further citation available at [cri.georgetown.edu (Bloomfield, Chin & Craig 2024)](https://cri.georgetown.edu/wp-content/uploads/2024/08/Bloomfield-Chin-Craig-2024-Georgetown-CRI-WP.pdf) if deeper treatment is wanted later.

---

## 2. Position Sizing and Leverage (the most important section)

### 2.1 The core formula: leverage is derived, not chosen

Standard risk-based sizing, converged across many sources (Turtle example above; Van Tharp's classic "P = C/R" framework, [Van Tharp Institute](https://vantharpinstitute.com/van-tharp-teaches-position-sizing-strategies-and-risk-management/)):

```
Position Size ($ or units) = Account Risk ($) / Stop Distance ($ per unit)
Position Size (%)          = Account Risk (%) / Stop Distance (%)
```

Leverage is **not** an independent input the trader picks. It falls out afterward:

```
Leverage = Position Notional Value / Margin Allocated
```

**This is the single most important design implication for the app.** The UI flow should be: user/system picks account risk % (e.g. 1%) → app calculates stop distance from the setup → app computes required position size → app computes the leverage that size implies at the chosen margin allocation → app *displays* that leverage as an output, not a dial the user turns first. Letting the user pick leverage first and back into a position size inverts the correct order of operations and is the most common source of oversized risk in retail trading.

### 2.2 Liquidation price mechanics (isolated margin)

The simplified approximation formula is consistent (with only cosmetic notation differences) across Binance, Bybit, KuCoin, Bitunix, Gate.io, MEXC, BingX, and DigiFinex documentation, and is also reproduced in an independent calculator ([CoinCalc Lab isolated-margin liquidation calculator](https://coincalclab.github.io/futures-liquidation-calculator/)):

```
Long:  Liquidation Price ≈ Entry Price × (1 − 1/Leverage + Maintenance Margin Rate)
Short: Liquidation Price ≈ Entry Price × (1 + 1/Leverage − Maintenance Margin Rate)
```

A more precise version used by Bybit-style venues, which accounts for extra margin manually added to an isolated position:

```
Long:  Liq Price = Entry − [(Initial Margin − Maintenance Margin) / Position Size] − (Extra Margin Added / Position Size)
Short: Liq Price = Entry + [(Initial Margin − Maintenance Margin) / Position Size] + (Extra Margin Added / Position Size)
```

Maintenance Margin itself is tiered by notional size on most exchanges:

```
Maintenance Margin = Position Notional × Maintenance Margin Rate − Maintenance Amount (deduction, tiered)
```

Binance's own worked example: a BTCUSDT position with notional value $260,000 at MMR 1% and a maintenance-amount deduction of $1,300 gives Maintenance Margin = $1,300 net ([Binance liquidation FAQ](https://www.binance.com/en/support/faq/detail/b3c689c1f50a44cabb3a84e663b81d93)).

**Worked numeric table (illustrative, entry = $100,000, using Maintenance Margin Rate ≈ half of Initial Margin Rate — a common real-world tiering pattern, NOT a universal rule):**

| Leverage | Initial Margin % | Maintenance Margin Rate (illustrative) | Long liquidation price | Adverse move to liquidation |
|---|---|---|---|---|
| 10× | 10.0% | 5.00% | $95,000 | 5.00% |
| 25× | 4.0% | 2.00% | $98,000 | 2.00% |
| 50× | 2.0% | 1.00% | $99,000 | 1.00% |
| 100× | 1.0% | 0.50% | $99,500 | 0.50% |

**Caveat on this table, stated plainly:** the Maintenance-Margin-Rate = half of Initial-Margin-Rate relationship used above is an illustrative simplification for demonstrating the shape of the curve, not a fixed rule — actual MMR tiers vary by exchange, by asset, and by position-size bracket, and must be pulled live from the exchange's contract-specification endpoint rather than hard-coded. What does **not** vary across exchanges is the qualitative conclusion: **each doubling of leverage roughly halves the adverse move required to wipe the position**, and this relationship is corroborated qualitatively by independent commentary that "at 100x leverage, a 1% adverse move can wipe a position entirely" ([Cryptonews.net Delta Exchange review](https://cryptonews.net/editorial/analytics/analyzing-delta-exchange-a-hub-for-inr-settled-derivatives-and-advanced-crypto-trading-strategies/)).

### 2.3 Delta Exchange India — specific mechanics (primary source: exchange's own docs)

From Delta's official API and user-guide documentation ([docs.delta.exchange](https://docs.delta.exchange), [guides.delta.exchange](https://guides.delta.exchange/delta-exchange-india-user-guide/derivatives-guide/docs)):

- **Fees:** Futures maker 0.02%, taker 0.05%, plus 18% GST on the trading fee itself (effective taker fee ≈ 0.059%). Options ~0.03% maker/taker, capped at 3.5% of premium. Spot: 0% maker / 0.1% taker. Fee is charged as a percentage of notional value, not margin. Official worked example: buying 1000 lots of BTCUSD Perpetual as maker at BTC = $100,000 (lot size 0.001 BTC) → notional $100,000 → fee $100,000 × 0.02% = $20 → total with GST = $20 × 1.18 = $23.60 ([delta.exchange/fees](https://www.delta.exchange/fees)).
- **Margin parameters (BTCUSD product, from Delta's own API fields):** `initial_margin = 0.5%`, `maintenance_margin = 0.25%`, `initial_margin_scaling_factor = 0.0000025`, `maintenance_margin_scaling_factor = 0.00000125`, `max_leverage_notional = 100,000`, `default_leverage = 200`, `taker_commission_rate = 0.0005`, `maker_commission_rate = 0.0002`, `liquidation_penalty_factor = 0.5`, `isolated_liq_penalty_factor = 0.01`.
- **Important gap to flag:** Delta's public documentation states isolated-margin liquidation triggers when Maintenance Margin Ratio (Maintenance Margin / Collateral Available) exceeds 100%, and gives portfolio-margin formulas (`IM = max(risk_margin, margin_floor) − UCF`; `MM = 80% × max(risk_margin, margin_floor) − UCF`), but does **not** publish an explicit plain-algebra isolated-margin liquidation *price* formula on any page fetched during this research. **Recommendation: use the generic isolated-margin approximation formula from §2.2 as the app's calculation engine, but cross-check the displayed number against Delta's own in-app liquidation-price display before shipping**, and do not assume Delta's number will match a generic-exchange formula exactly.
- **Leverage marketing vs. practice:** Delta markets up to 100×–200× on BTC/ETH perpetuals (the `default_leverage` field itself shows 200 for BTCUSD). Independent reviewer commentary explicitly cautions that maximum leverage is "best treated as theoretical," with most consistent traders using 2×–5× effective leverage in practice ([tradflakes](https://tradflakes.com) / [plisio.net](https://plisio.net) commentary as cited in prior research pass — treat as secondary/directional, not primary-sourced).
- **Maintenance margin tiers by notional size** were not found published as a clean table anywhere on Delta's public pages during this research — only the flat per-product base rate (0.5% IM / 0.25% MM for BTCUSD) was confirmed via the API schema. **This is a genuine gap**: the app should pull live tier data from Delta's contract-specs endpoint at runtime rather than hard-coding a single flat rate, since real exchanges typically increase MMR at higher notional brackets.

### 2.4 Risk of ruin

**Gambler's-ruin-style formula for a trading edge** (equal win/loss size case):

```
Edge = Win Rate − Loss Rate
Risk of Ruin = ((1 − Edge) / (1 + Edge)) ^ (Capital Units)
```

where Capital Units = how many risk-sized bets your account can absorb before hitting a defined "ruin" threshold (commonly a 50% or greater drawdown) ([journalplus.co](https://journalplus.co/learn/glossary/risk-of-ruin)).

A refined version incorporating a payoff ratio R (average win / average loss), used by an illustrative risk-of-ruin calculator:

```
e = (W × R − L) / (R + 1)          [per-trade edge, W = win rate, L = loss rate = 1−W]
Risk of Ruin ≈ ((1 − e) / (1 + e)) ^ N     [N = number of worst-case losses between current capital and the ruin threshold]
```
Source: [tradeonmath.com risk-of-ruin calculator](https://tradeonmath.com/tools/risk-of-ruin/).

**Illustrative survival table** reproduced from a risk-of-ruin explainer (treat as illustrative/directional rather than exchange-verified, since it depends heavily on the specific edge and payoff assumptions baked into the source, which were not fully disclosed):

| Risk per trade | Typical risk of ruin | Approx. survival |
|---|---|---|
| 1% | <1% | 99%+ survive |
| 2% | 2–5% | 95–98% survive |
| 5% | 10–25% | 75–90% survive |
| 10% | 30–50% | 50–70% survive |
| 20% | 60–80% | 20–40% survive |

Source: [journalplus.co](https://journalplus.co/learn/glossary/risk-of-ruin). The clear, source-independent takeaway that should inform the app: **risk of ruin rises sharply and non-linearly, not proportionally, as risk-per-trade increases** — going from 1% to 5% risk per trade is not "5x the danger," it can be an order of magnitude or more increase in the probability of eventual account destruction.

### 2.5 Drawdown recovery math

The identity referenced in the task brief is simple algebra and is consistently reproduced across sources:

```
Required Gain (%) = Drawdown (%) / (1 − Drawdown (%))
```

Reference table (consistent across multiple independent calculators — [alphaexcapital.com](https://www.alphaexcapital.com/tools/drawdown-recovery), [provencalc.com](https://provencalc.com/investing/drawdown-recovery-calculator/), [nuvora-app.com](https://www.nuvora-app.com/tools/drawdown-recovery-calculator)):

| Drawdown | Gain required to recover |
|---|---|
| 5% | 5.3% |
| 10% | 11.1% |
| 20% | 25.0% |
| 25% | 33.3% |
| 30% | 42.9% |
| 40% | 66.7% |
| 50% | 100.0% |
| 80% | 400.0% |

This is not a probabilistic model — it is pure arithmetic (loss of half your capital literally requires doubling what remains to get back to even) — but it is the single most important number for a leveraged trader to internalize, because high leverage makes 30–50%+ single-trade-sequence drawdowns realistic, not hypothetical.

### 2.6 Kelly Criterion, fractional Kelly, and why full Kelly is dangerous in practice

**Binary-outcome Kelly formula** ([Wikipedia, Kelly criterion — cross-checked against QuantStart](https://en.wikipedia.org/wiki/Kelly_criterion)):

```
f = p/l − q/g
```
where p = win probability, q = 1 − p, g = fraction gained on a win, l = fraction lost on a loss.

**Trading-common form** (using win/loss payoff ratio):

```
f* = (b × p − q) / b
```
equivalently
```
Kelly % = W − (1 − W) / R
```
where W = win rate, R = average win / average loss ratio, b = R.

**Continuous/market form** (excess return over variance — used for portfolio-level rather than single-bet sizing):

```
f = (μ − r) / σ²
```
Source: [QuantStart, "Money Management via the Kelly Criterion"](https://www.quantstart.com/articles/Money-Management-via-the-Kelly-Criterion/). Full derivation (maximizing expected log wealth) is in the [Wikipedia proof section](https://en.wikipedia.org/wiki/Kelly_criterion).

**Critique of full Kelly — consistently documented, not a fringe view:**
- Full Kelly requires *exactly known* win probability and payoff ratio — a condition that essentially never holds in live discretionary trading, where these are estimates from a limited trade sample.
- Even when the edge estimate is *correct*, full Kelly produces drawdowns of 50–80% along the way to its long-run growth optimum — a mathematically "optimal" strategy that is behaviorally and financially unsurvivable for most traders and businesses.
- **Overestimating win probability — the single most common trader error — increases risk of ruin sharply**, because Kelly sizing is highly sensitive to the accuracy of the probability input; a small overestimate of edge translates into an oversized bet.
- Even Kelly's own strongest proponents (e.g., Ed Thorp) advocate **fractional Kelly** rather than full Kelly for real portfolios.

**Fractional Kelly — the standard practical adjustment:**
- **Half-Kelly (0.5×)** retains roughly 75% of full Kelly's long-run growth rate while cutting drawdown/variance roughly in half.
- **Quarter-Kelly (0.25×)** retains roughly 44–50% of full-Kelly growth at roughly a quarter of the drawdown.
- A consistent practical recipe found across (lower-trust but mutually consistent) trading-education sources: backtest 50–100+ trades out-of-sample, compute the full-Kelly fraction from that sample, apply a haircut of roughly 20% for real-world execution friction the backtest doesn't capture, then size at half or a quarter of the resulting number — and separately cap position size at a hard ceiling (e.g. 5–10% of capital) regardless of what the Kelly formula outputs, as a backstop against model error.
- Wikipedia's Kelly-criterion article documents this fractional-Kelly practice explicitly, citing reduced ruin risk, reduced volatility, and protection against parameter-estimation error as the rationale, and notes a real-market illustration: naive full-Kelly sizing applied to the S&P 500 has been estimated (citing Thorp) at roughly 85–117% of capital — clearly unusable at face value — versus the commonly recommended half-Kelly compromise.

**Design implication:** if the app ever surfaces a Kelly-derived size, it must default to fractional Kelly (¼–½) with an explicit hard cap, and should visibly warn when a computed full-Kelly number would exceed, say, 10–15% of account equity, since that is a strong signal the win-rate/payoff-ratio inputs are themselves unreliable (a large recommended bet size is often itself evidence of an over-fit or over-optimistic edge estimate, not evidence of a genuinely large edge).

### 2.7 Why maximum leverage is hostile to survival even at a high win rate

This is a direct mathematical consequence of §2.2 and §2.5 combined, and is corroborated by the retail base-rate evidence in §6: at 100× leverage, the worked table in §2.2 shows liquidation from roughly a 0.5% adverse move. Crypto's typical intraday and even intraminute volatility routinely exceeds 0.5%–1% moves, meaning a position sized at 100x can be liquidated by ordinary noise, independent of whether the trader's directional thesis was ultimately correct. A trader can have a genuinely positive expectancy system and still be ruined by leverage-driven liquidation before that edge has a chance to play out over enough trades — because liquidation is an absorbing state (the position and its allocated margin are gone; there is no "waiting for the trade to come back"), whereas a stopped-out-but-not-liquidated trade at lower leverage simply registers as one loss in a longer expectancy sequence. This is precisely the mechanism the NYU Stern simulation below quantifies directly.

### 2.8 Quantitative evidence on leverage and liquidation/loss rates in crypto perpetuals

This is the strongest primary evidence found and should anchor the app's risk messaging.

- **Jia, Lin, Wu, Yan et al., "Liquidation, Leverage and Optimal Margin in Bitcoin Futures Markets"** ([arxiv.org/pdf/2102.04591](https://arxiv.org/pdf/2102.04591)) — an empirical academic study applying generalized extreme value theory to real BitMEX perpetual futures data. Key findings, stated plainly:
  - **Daily average forced-liquidation rate: 3.51% of outstanding long open interest and 1.89% of outstanding short open interest are forcibly liquidated every single day** on the venue studied.
  - **The average leverage among traders who get liquidated is at least 58.13× for longs and 59.94× for shorts** — liquidated traders are disproportionately using very high leverage, not moderate leverage.
  - Traders who get force-liquidated tend to trade aggressively (consistent with re-entering at similarly high leverage after a loss, discussed further below).
- **NYU Stern working paper, "Is There A Future In Perpetual Futures?"** ([stern.nyu.edu PDF](https://www.stern.nyu.edu/sites/default/files/assets/documents/Duron-Carielo_Is%20There%20A%20Future%20In%20Perpetual%20Futures.pdf)) ran leverage simulations and reports: **at 125× leverage, 98.32% of all simulated trades were liquidated**, with average time-to-liquidation of ~22.5 minutes and *median* time-to-liquidation of only 46 seconds; **at 75× leverage, 97.30% of trades were liquidated**, average time ~30.5 minutes, median 117 seconds. The paper also states that roughly 90% of daily liquidations across crypto futures contracts generally occur specifically in perpetual futures (as opposed to dated/quarterly futures) — though it notes no perpetual-specific liquidation dataset broken out separately from the wider futures market was available to it at the time of writing.
- **Independent (secondary, not academically peer-reviewed) analysis claiming to cover 50,000 liquidated positions across Binance, Bybit, and OKX over 18 months** reports **92.7% of retail leverage traders lost money**, average leverage used among the liquidated sample of 18.3×, median account size $847, and — notably — that 73% of liquidated traders redeposited within 24 hours, and 84% of those re-deposits used *higher* leverage than the trade that just liquidated them ([Google Sites "Decentralised News" post](https://sites.google.com/view/decentralised-news/home/why-most-retail-traders-lose-money-on-leverage)). **This source should be treated with real caution** — it is a blog/personal-site post, not a regulator disclosure or peer-reviewed paper, and its methodology (how the 50,000 positions were sampled, what counts as "lost money") is not independently verifiable. It is included because the qualitative pattern it describes (higher leverage after a liquidation, not lower) is directionally consistent with the academic BitMEX finding above that liquidated traders trade aggressively, but the specific 92.7% figure should not be presented in the app as an established statistic — it should be flagged as unverified if cited at all.
- **Binance's own community-authored posts** repeat a widely-circulated but unsourced "over 90% of contract traders lose money" claim, and separately cite a claim that "among traders using over 10x leverage, 98% see their assets drop to zero within three months" attributed to "TokenInsight research" — this attribution could not be traced to a locatable, checkable TokenInsight publication during this research and should be treated as **unverified/blog-spam-tier**, explicitly excluded from any number displayed to the user as fact ([Binance Square posts](https://www.binance.com/en/square/post/27242952252698), [Binance Square](https://www.binance.com/en/square/post/24666121612402)).

**Bottom line for this subsection:** the credible, source-traceable evidence (the BitMEX academic study and the NYU Stern simulation) both point the same direction — liquidation rates rise extremely fast with leverage, average leverage among liquidated traders is far higher than typically-recommended trading leverage, and very high leverage (75×–125×) liquidates the overwhelming majority of positions within minutes even before accounting for any directional edge. The widely-quoted "90%+ of crypto traders lose money" claims circulating on social/blog sources are directionally plausible given the above but are **not independently verifiable at that specific percentage** and should not be presented to the user as a hard number.

---

## 3. Take Profit

### 3.1 R-multiples and expectancy — the core math

**R-multiple** (primary source: [Van Tharp Institute, "A Short Lesson on R and R-multiples"](https://vantharp.com/wp-content/uploads/2018/06/A_Short_Lesson_on_R_and_R-multiple.pdf)): profit or loss expressed as a multiple of the initial dollar risk (R) taken on the trade. Example: $10 initial risk, $100 profit realized = a 10R winning trade.

**Expectancy** (the average R-multiple a system produces per trade over a large sample):

```
Expectancy = (Win Rate × Average Win) − (Loss Rate × Average Loss)          [dollar/percent form]
Expectancy (R) = (Win Rate × R) − (1 − Win Rate)                             [R-multiple form, R = reward:risk ratio]
```

**Breakeven win rate** (the win rate at which a given R:R ratio produces zero expectancy):

```
Breakeven Win Rate = 1 / (1 + R:R ratio)
Breakeven R:R ratio = (1 − Win Rate) / Win Rate
```

Reference table (consistently reproduced across multiple independent sources, e.g. [journalplus.co](https://journalplus.co/learn/guides/win-rate-vs-risk-reward/), [traderssecondbrain.com](https://traderssecondbrain.com/guides/win-rate-vs-risk-reward)):

| R:R Ratio | Breakeven Win Rate |
|---|---|
| 0.5 : 1 | 66.7% |
| 1 : 1 | 50.0% |
| 1.5 : 1 | 40.0% |
| 2 : 1 | 33.3% |
| 3 : 1 | 25.0% |
| 4 : 1 | 20.0% |
| 5 : 1 | 16.7% |

**Direct answer to the task brief's example:** at a **40% win rate**, breakeven R:R = (1 − 0.40) / 0.40 = 0.60 / 0.40 = **1.5 : 1**. Any R:R above 1.5:1 at a 40% win rate is net profitable; below it is a net loser regardless of how good the entries "feel." At a 30% win rate, breakeven R:R rises to (0.70/0.30) ≈ **2.33 : 1** ([edgeflo.com](https://www.edgeflo.com/blog/trading-expectancy)).

**Professional benchmark:** Van Tharp's own stated range for what counts as a genuinely good professional trading-system expectancy is **0.2R to 0.8R per trade** ([journalplus.co](https://journalplus.co/learn/guides/how-to-calculate-expectancy/)) — a useful sanity check for the app to surface: an expectancy calculation coming back above ~1R per trade on a discretionary manual system should raise suspicion about the input data (small sample, survivorship/hindsight bias in labeling setups) rather than be taken as confirmed edge.

### 3.2 Structure-based, measured-move, and ATR-based targets

- **Chandelier Exit** (cited via Investopedia's ATR page, §1.1 above) doubles as both a trailing-stop *and* an effective way to let winners run to a volatility-adjusted target rather than a fixed R-multiple, by trailing a multiple of ATR behind the highest high reached since entry ([Investopedia](https://www.investopedia.com/terms/a/atr.asp)).
- Measured-move and structure targets (prior swing highs/lows, order-block levels, liquidity pools on the opposite side of the market) were touched on tangentially through the stop-placement research in §1.2 but were not given an equally deep, separately-sourced academic treatment in this pass — the core quantitative content of this section (expectancy math and the win-rate/R:R relationship) is fully sourced above and is the more decision-relevant part for a system that must output an exact number.

### 3.3 Partial scale-out, breakeven stops, and trailing stops

The general mechanics — take partial profit at a first R-multiple target, move the stop to breakeven (or better) on the remainder, then trail the remaining size — are standard practice reflected in the Jesse framework's own example strategies (§5 below), which explicitly implement stop-loss, take-profit, and position-sizing as three separate outputs per trade rather than a single number, e.g.:

```python
self.stop_loss = qty, stop
self.take_profit = qty, entry_price * 1.2   # or a measured/ATR-based level
```
([jesse-ai/jesse README](https://github.com/jesse-ai/jesse/blob/master/README.md))

This section's mechanics (partial exits specifically) were not given a dedicated primary-source deep-dive beyond the general trailing-stop literature already cited in §1.1 — flagged here rather than presented as more thoroughly researched than it is.

---

## 4. Costs

### 4.1 Funding rates — mechanics and compounding at high leverage

**General cross-exchange mechanic** (reference standard, Binance):

```
Funding Rate = Average Premium Index + clamp(Interest Rate − Average Premium Index, −0.05%, +0.05%)
Funding Payment = Position Notional Value × Funding Rate
```

Interest rate is typically fixed around 0.01% per 8-hour period (~0.03%/day); settlement every 8 hours ([Binance funding rate FAQ](https://www.binance.com/en/support/faq/detail/360033525031); academic treatment in [arxiv.org/html/2212.06888v5, "Fundamentals of Perpetual Futures"](https://arxiv.org/html/2212.06888v5); also [Bitnomial exchange docs](https://bitnomial.com/exchange/docs/market-operations/perpetual-futures-pricing/)).

**Critical point for high-leverage positions:** funding is charged on **notional (leveraged) position value, not on margin posted**. This means for a fixed amount of capital, funding cost scales *linearly* with leverage — a position levered at 50x pays roughly 50x the funding dollar-cost of the same margin at 1x, even though the funding *rate* itself is unchanged. This is a frequently underappreciated cost that compounds specifically at high leverage and should be surfaced by the app whenever it recommends a high-leverage setup held across a funding settlement time.

### 4.2 Delta Exchange India — funding rate formula (primary source)

From Delta's own India user guide ([guides.delta.exchange](https://guides.delta.exchange/delta-exchange-india-user-guide/derivatives-guide/docs)):

```
Premium = (Mark Price − Underlying Index Price) / Underlying Index Price     [measured every minute]
Average Premium = 8-hour time-weighted average of Premium
Interest Rate = 0.01% per 8 hours                                            [current default, subject to change]
Funding Rate = Average Premium + clamp(Interest Rate − Average Premium, 0.05%, −0.05%)
Funding Payment = Current Position Value × Funding Rate
```

- Funding is settled **3 times per day at 5:30am IST, 1:30pm IST, and 9:30pm IST** (this changed from a previous minute-by-minute accrual method as of 8-Sep-2025 5:30pm IST — flag that any hard-coded settlement schedule needs periodic verification against Delta's live docs, since it has already changed once).
- Worked example from Delta's own docs: 1000 lots of BTCUSD perpetual (= 1 BTC), Average Premium 0.04%, Interest Rate 0.01% → clamped Funding Rate = 0.01% → Funding Paid = 1 × $100,000 × 0.01% = **$10**.
- Most Delta perpetuals cap funding at **1% per settlement period**; caps are published live at [india.delta.exchange/contracts](https://india.delta.exchange/contracts) and are subject to change without notice, so should not be hard-coded as a permanent constant.
- Funding on Delta is peer-to-peer (longs pay shorts when the perpetual trades at a premium to the index, and vice versa) — **Delta itself charges no separate fee on the funding flow**, only on the underlying trade.

### 4.3 Fees — Delta Exchange India specifics

- **Futures:** maker 0.02%, taker 0.05%, plus 18% GST on the trading fee (effective taker ≈ 0.059%).
- **Options:** ~0.03% maker/taker, capped at 3.5% of the option premium.
- **Spot:** 0% maker, 0.1% taker.
- Fees are charged on notional trade value, not margin — meaning, exactly like funding, fee drag as a percentage of *account equity* scales up with leverage even though the fee *rate* itself does not change.
- Source: [delta.exchange/fees](https://www.delta.exchange/fees).

### 4.4 Slippage

Slippage was not given a dedicated primary-source search pass in this research round beyond what is implicit in the liquidation-speed data in §2.8 (e.g., the NYU Stern paper's median 46-second liquidation time at 125x leverage implicitly reflects execution against a moving, adverse price during a forced-liquidation cascade, which is a slippage-adjacent phenomenon). **This is a stated gap**: no exchange-published or academic slippage-vs-leverage dataset specific to Delta Exchange or comparable venues was located and verified in this pass. Directionally, slippage should be expected to scale with (a) order size relative to order-book depth at the moment of execution and (b) volatility at the moment of execution — both of which are elevated exactly when high-leverage positions are being forcibly closed, meaning realized losses on liquidation are generally somewhat worse than the theoretical liquidation price calculated in §2.2, not equal to it. The app should treat the liquidation-price formulas in §2.2 as a *floor* estimate of loss, not an exact prediction, precisely because slippage during forced closes is not modeled by those formulas.

### 4.5 India tax specifics (primary source: Income Tax Department of India)

- **Section 115BBH — flat 30% tax** on income from transfer of any Virtual Digital Asset (VDA, which includes cryptocurrency and NFTs), plus applicable surcharge and a 4% health-and-education cess. **No deduction is allowed except cost of acquisition. Losses cannot be set off against other income, and in most interpretations cannot be set off even against gains from other VDAs.** No distinction is made for holding period — there is no long-term vs. short-term treatment as exists for equities. Confirmed directly on the Income Tax Department's own site: [incometaxindia.gov.in/w/section-115bbh-1](https://www.incometaxindia.gov.in/w/section-115bbh-1) and [incometaxindia.gov.in/w/taxation-of-virtual-digital-asset-vda-](https://www.incometaxindia.gov.in/w/taxation-of-virtual-digital-asset-vda-).
- **Section 194S — 1% TDS** on the consideration for a VDA transfer, deducted by the payer (typically the exchange) at the time of credit or payment, whichever is earlier. Threshold: ₹50,000/year for "specified persons" (individuals/HUFs not subject to tax audit — i.e. business turnover under ₹1 crore or professional receipts under ₹50 lakh); ₹10,000/year for everyone else. Confirmed at [incometaxindia.gov.in/w/section-194s](https://www.incometaxindia.gov.in/w/section-194s) (statutory text) and [incometaxindia.gov.in/w/tds-on-payment-for-the-transfer-of-virtual-digital-assets-vdas-](https://www.incometaxindia.gov.in/w/tds-on-payment-for-the-transfer-of-virtual-digital-assets-vdas-) (confirms the 1% rate is not further increased by surcharge or cess).
- **Renumbering note:** under the 2025 Income Tax Bill, this content is being carried into a new Act with different section numbers in some secondary summaries (referred to variously as "Section 194" or "Section 393" of the 2025 Act in some non-government sources) — this is flagged explicitly as a likely source of confusion rather than resolved definitively here; see [taxtmi.com](https://www.taxtmi.com/tmi_notes?id=1676) and [nrifinancialservices.com](https://www.nrifinancialservices.com/guides/news/crypto-tax-update-india-2026) for secondary discussion, but treat the original Income Tax Department citations above as authoritative for the underlying rates and mechanics.
- **Practical implication for a manual scalper:** the 1% TDS is charged on **gross transfer consideration, not net profit**, on every single transfer. For a trader making frequent small-edge trades, this creates a real capital-velocity drag even though the TDS amount is ultimately creditable against final tax liability at year-end — money is tied up between the trade and the tax filing. Combined with the flat 30% rate and the inability to offset losses, **frequent small-edge scalping is structurally tax-disadvantaged in India relative to fewer, larger, higher-conviction trades** — this is a quantifiable reason (not just a trading-psychology reason) to prefer a system that outputs fewer, higher-quality setups over one that outputs many marginal ones.

---

## 5. Open-Source Repositories

Prioritized by relevance to risk sizing, stop placement, and level calculation (not full bot/execution frameworks, per the task's explicit ordering).

| Repo | Stars (approx.) | Language | License | Last activity | What to borrow |
|---|---|---|---|---|---|
| [jesse-ai/jesse](https://github.com/jesse-ai/jesse) | ~6,300–7,600 (sources vary: [GitHub Topics](https://github.com/topics/jesse) shows 6.3k; [freebacktesting.com](https://freebacktesting.com/code-based/jesse) shows ~7,600) | Python | MIT | Active (2026 commits visible) | **`jesse.utils.risk_to_qty(capital, risk_per_capital, entry_price, stop_loss_price, precision, fee_rate)`** — directly implements the exact formula in §2.1: `risk_amount = balance * (risk_percent/100); stop_distance = abs(entry - stop); qty = risk_amount / stop_distance`. Also has `size_to_qty()`, `qty_to_size()`, and a documented `kelly_criterion()` utility used in example strategies for Kelly-based sizing with a hard 25%-of-capital ceiling as a backstop. See [docs.jesse.trade/docs/utils](https://docs.jesse.trade/docs/utils) and the worked Kelly-sizing example at [docs.jesse.trade/docs/strategies/example-strategies](https://docs.jesse.trade/docs/strategies/example-strategies). This is the single most directly transferable repo for the app's core sizing logic. |
| [freqtrade/freqtrade](https://github.com/freqtrade/freqtrade) | ~50,000–54,000 ([trendingbots.ai](https://www.trendingbots.ai/agents/freqtrade) reports 49,972; [coincodecap.com](https://coincodecap.com/open-source-trading-bots-on-github) reports 53,000+) | Python | GPL-3.0 | Active (push activity into 2026) | **`custom_stoploss()` callback** — a per-strategy override that computes a dynamic stop as a function of current price, current profit, and elapsed time; example implementations use a Parabolic SAR-based trailing stop ([freqtrade-strategies/CustomStoplossWithPSAR.py](https://github.com/freqtrade/freqtrade-strategies/blob/main/user_data/strategies/CustomStoplossWithPSAR.py)) that can be adapted to an ATR-trailing model directly analogous to §1.1's Chandelier Exit. Worth reviewing for the general *pattern* of stop-loss-as-a-function-of-market-state rather than a fixed number, even though this app has no order execution to attach it to. |
| [kernc/backtesting.py](https://github.com/kernc/backtesting.py) | ~7,400–8,600 depending on source/date ([star-history.com](https://www.star-history.com/kernc/backtesting.py) shows 8.4–8.7k; [trendingbots.ai](https://www.trendingbots.ai/agents/backtesting-py) shows 8,073) | Python | AGPL-3.0 | Active | Its `backtesting.lib` module contains reusable position-sizing and trailing-stop helper building blocks; useful primarily as a reference implementation for validating the app's own expectancy/R-multiple math (§3.1) against a widely-used backtest engine's statistics module (`backtesting/_stats.py`) before trusting any in-app expectancy number. |
| [ranaroussi/quantstats](https://github.com/ranaroussi/quantstats) | ~6,500–6,800 (multiple sources converge: [github.com](https://github.com/ranaroussi/quantstats) 6.5k, [ossinsight.io](https://ossinsight.io/analyze/ranaroussi/quantstats) 6,603, [context7.com](https://context7.com/ranaroussi/quantstats) trust score 9.4) | Python | Apache-2.0 | Active | 50+ performance/risk metrics (Sharpe, Sortino, max drawdown, tail-risk measures) in `quantstats/reports.py` — useful as a validated reference implementation for the drawdown-recovery math in §2.5 and for computing realized expectancy/variance from the app's own logged trade history, rather than for real-time signal generation. |
| [nautechsystems/nautilus_trader](https://github.com/nautechsystems/nautilus_trader) | ~24,800 ([olud.ai](https://olud.ai/project/nautechsystems-nautilus-trader.html)) | Rust (Python bindings) | LGPL-3.0 | Active | **`calculate_fixed_risk_position_size()`** in `crates/risk/src/sizing.rs` — a production-grade, commission-and-exchange-rate-aware version of the same core formula as Jesse's `risk_to_qty`, with an explicit `hard_limit` parameter and unit-batching logic. Its `RiskEngine` pre-trade validation pattern (notional limits, max-risk-per-trade config) is a good structural reference for how to encode hard position-size ceilings in the app even without order routing. See [docs.rs/nautilus-risk](https://docs.rs/nautilus-risk) and the full source at [aidoczh.com mirror of sizing.rs](https://www.aidoczh.com/nautilustrader/docs/core-latest/src/nautilus_risk/sizing.rs.html). |
| [twopirllc/pandas-ta](https://github.com/twopirllc/pandas-ta) | ~5,300+ ([pythonfix.com](https://pythonfix.com/pkg/p/pandas-ta/) reports 5,299) | Python | MIT | Last major push reported ~2 months prior to a 2025 snapshot; treat as moderately active, not high-velocity | Direct source for the ATR calculation itself (and 130+ other indicators) if the app's ATR-stop logic (§1.1) needs a validated reference implementation to check a custom JS port against. |
| [hummingbot/hummingbot](https://github.com/hummingbot/hummingbot) | ~19,300 ([olud.ai](https://olud.ai/project/hummingbot-hummingbot.html)) | Python | Apache-2.0 | Active | Primarily a market-making/execution framework (lower relevance given no order routing), but its position-sizing config schema for perpetual-futures strategies is a reasonable secondary reference for leverage/margin parameter naming conventions. |
| [Drakkar-Software/OctoBot](https://github.com/Drakkar-Software/OctoBot) | ~4,900–6,100 depending on source/date (figures range from 4.9k on the main repo page to a claimed 6,151 on a mirror; treat ~5,000–6,000 as the reasonable estimate) | Python | GPL-3.0 | Active | Lower relevance — full trading-bot framework; not a distinctive source for risk-sizing or stop logic beyond what Jesse and freqtrade already provide more directly. Included for completeness since it was named as a candidate. |
| Liquidation-price calculators (non-framework, narrow utilities) | N/A (small/unstarred utility repos) | TypeScript / Deno | Varies | Varies | [zynesis/perpetual-futures](https://github.com/zynesis/perpetual-futures) — a small Deno/TypeScript module implementing exactly the long/short liquidation-price formula from §2.2, plus P&L and target-price calculators, with a runnable worked example (`Liquidation({position: Long, entry: "9500", quantity: "5.12", wallet: "5000", minMaintainMargin: "0.005"})` → 8528.32 USDT). Small and unstarred, but directly useful as a sanity-check reference implementation for the app's own liquidation-price JS, since the algebra matches §2.2 exactly. |
| Kelly-sizing utilities (narrow, small repos) | N/A (small/unstarred) | Python | Varies | Varies | [liamfayle/Kelly-Position-Sizing](https://github.com/liamfayle/Kelly-Position-Sizing) — implements full Kelly (maximizing expected log-wealth growth) via Monte Carlo (GBM path simulation) for options-style payoffs; more elaborate than needed but a good reference for *how* to numerically find the Kelly-optimal fraction when payoffs aren't a simple binary win/loss. [lightningRalf/PositionSizing](https://github.com/lightningRalf/PositionSizing) — a simpler entry/TP/SL/win-rate → Kelly-adjusted position size calculator closer to what this app needs directly. Both are small, low-star utility repos — useful as algorithm references, not as dependencies to pull in wholesale. |

**Note on star-count precision:** GitHub star counts drift constantly and different indexing services (star-history.com, trendingbots.ai, ossinsight.io, olud.ai, direct GitHub page scrapes) report figures that can diverge by 10–20% depending on when they last synced. The figures above are reported with their source explicitly named so the actual current count can be re-verified directly against the live GitHub repo page at build time rather than trusted as a frozen number.

---

## 6. Honest Statement of Limits

This section states plainly what can and cannot be known in advance, and what "success" realistically looks like — per the task's explicit instruction not to be encouraging for its own sake.

### 6.1 What is knowable in advance vs. not

**Knowable and computable in advance, with confidence:**
- Exact liquidation price for a given entry, leverage, and margin mode (§2.2) — this is a deterministic function of exchange parameters, not a probabilistic forecast.
- Exact position size for a given account-risk percentage and stop distance (§2.1) — pure arithmetic.
- Exact breakeven win rate for a chosen R:R ratio (§3.1) — pure arithmetic.
- Exact funding and fee cost for a position of known size held for a known duration (§4) — deterministic given the exchange's published rate schedule at that moment (though the rate itself, e.g. the funding rate, is not knowable further into the future than its next settlement).
- The *arithmetic* consequence of a drawdown (§2.5) — not a forecast, just what recovery requires.

**Not knowable in advance, and this is the crucial distinction:**
- Whether any specific trade will win or lose. No amount of stop/target/leverage math changes this — all of §1–§4 governs the *consequences* of being right or wrong, not whether you will be right.
- The trader's *true* win rate and payoff ratio going forward — these can only be estimated from a trade history, and any estimate from fewer than roughly 50–100 trades carries wide statistical uncertainty. The Kelly-criterion critique in §2.6 exists precisely because this number is unknowable with precision, not just difficult to estimate.
- Whether a "setup" identified by technical confluence (structure + indicator + volume, etc.) has genuinely elevated odds versus looking correct only in hindsight. Nothing in this research establishes that any specific discretionary setup type has a provable statistical edge — that can only be established, if at all, by the trader's own forward-tested track record.

### 6.2 Is a "setup with minimal chance of loss" achievable?

**No, not in the sense the phrase implies.** Every source reviewed in this research — from the market-microstructure evidence on stop-hunting (§1.2) to the Kelly-criterion literature (§2.6) to the retail base-rate data below — describes a probabilistic environment where a defined, non-trivial fraction of trades lose by construction. A "setup" can have a favorable *expectancy* (positive average R-multiple across many occurrences) without any individual instance of it having a minimal chance of loss. Marketing language claiming near-certain setups is not supported by anything found in this research and should not be a design goal for the app's signal output — the app's job is to make the odds and consequences explicit (entry, stop, size, expectancy math), not to manufacture false certainty.

### 6.3 Realistic best case for a discretionary trader

Based on the sourced material above:
- Van Tharp's own benchmark for what counts as a **good professional system** is **0.2R–0.8R expectancy per trade** (§3.1) — modest by the standards implied by most retail trading marketing, and achieved by professional systematic traders, not typically by discretionary manual traders without a large, disciplined sample size behind them.
- At a realistic discretionary win rate in the 35–50% range, the breakeven-R:R table in §3.1 shows the trader needs R:R ratios in the 1:1 to 2:1 range just to reach zero expectancy — meaning genuinely profitable discretionary trading requires *both* a defensible edge in setup selection *and* consistent execution of adequate R:R, not either alone.
- Variance around even a positive expectancy is large: the drawdown-recovery math in §2.5 means a run of losses well within normal statistical variation for a 40–50% win-rate system can produce a 20–40% drawdown that then requires a 25–67% gain just to recover — this is a structural feature of the math, not a sign the system is broken.

### 6.4 Base rates on retail leveraged-trading outcomes

**Best available primary sources, in descending order of direct relevance:**

- **Regulator-grade analogue (not crypto-specific, but the closest primary regulatory disclosure available):** the EU securities regulator **ESMA** states that national competent authorities' analyses across EU jurisdictions show **74–89% of retail accounts typically lose money** trading CFDs, with average losses per losing client ranging from **€1,600 to €29,000** ([ESMA press release, 2018](https://www.esma.europa.eu/press-news/esma-news/esma-agrees-prohibit-binary-options-and-restrict-cfds-protect-retail-investors); confirmed also at [ESMA NCA analyses](https://www.esma.europa.eu/press-news/esma-news/ncas-analyses-show-between-74-and-89-retail-cfd-accounts-lose-money)). CFDs are leveraged derivatives structurally similar to perpetual futures in their risk mechanics, but this is EU-regulated retail CFD trading, not crypto perpetuals specifically, and not India-specific.
- **Academic, crypto-perpetuals-specific:** Jia et al.'s BitMEX study (§2.8) found **3.51% of long open interest and 1.89% of short open interest forcibly liquidated every single day**, with average leverage among liquidated traders of ~58–60x ([arxiv.org/pdf/2102.04591](https://arxiv.org/pdf/2102.04591)) — this is a genuinely crypto-perpetuals-specific, peer-reviewed-adjacent (arXiv preprint) primary data source, and the strongest one found for this specific asset class.
- **Simulation-based, crypto-perpetuals-specific:** the NYU Stern paper (§2.8) found simulated liquidation rates of **97.3% of trades at 75x leverage and 98.32% at 125x leverage** ([stern.nyu.edu PDF](https://www.stern.nyu.edu/sites/default/files/assets/documents/Duron-Carielo_Is%20There%20A%20Future%20In%20Perpetual%20Futures.pdf)).
- **Non-crypto but rigorously studied analogue — day trading generally:** Chague, De-Losso & Giovannetti, **"Day Trading for a Living?"** ([SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3423101)), a peer-reviewed-adjacent academic study of every individual who began day trading in the Brazilian equity futures market (the world's third-largest futures market by volume) between 2013–2015, found that **97% of all individuals who persisted for more than 300 trading days lost money**, only **1.1% earned more than the Brazilian minimum wage**, and only **0.5% earned more than a bank teller's starting salary — "with great risk."** The paper's own stated conclusion: **"it is virtually impossible for individuals to day trade for a living, contrary to what course providers claim."** This is not a leverage-specific study, but it is one of the most rigorous population-level studies of discretionary short-horizon trading outcomes available, and its population (all who began day trading, tracked over years, not a self-selected successful subset) is exactly the right kind of sample to avoid survivorship bias.

**Explicit gap, stated rather than papered over:** no crypto-exchange-published, India-specific, or Delta-Exchange-specific retail-outcome disclosure exists in the way ESMA forces EU brokers to disclose CFD loss rates. Crypto exchanges generally do not publish ESMA-style "percentage of retail accounts that lose money" figures. The widely-circulated claims that "90%+ of crypto traders lose money" (§2.8) are **directionally consistent** with the ESMA CFD data, the BitMEX liquidation-rate data, and the Brazilian day-trading study, but the specific percentage is not independently verifiable from a primary, checkable source and should not be presented to the user as an established fact — the honest position is: *multiple independent lines of evidence, from a different asset class (CFDs, regulator-verified), a similar asset class (BTC perpetuals, academically studied at the liquidation-rate level), and a different but related activity (day trading generally, rigorously studied at the population level), all point toward the substantial majority of active retail leveraged/short-horizon traders losing money over time — but no single number pins this down precisely for crypto perpetuals specifically.*

### 6.5 What this means for the app's design, stated directly

- The app should never imply a setup is "safe" or has "minimal risk" — every signal should carry its stop, its expectancy math, and its dollar/percentage risk-at-stop as inseparable, equally-prominent parts of the same output, not a confidence score that could be mistaken for a win-probability guarantee.
- Leverage should be displayed as a *computed consequence* of the user's risk percentage and the setup's stop distance — never as an input the app invites the user to maximize.
- Given §2.8's finding that traders average ~58–60x leverage specifically among those who get liquidated, and the NYU Stern finding that 75–125x leverage liquidates 97–98% of positions largely irrespective of direction being right or wrong, the app should treat any leverage recommendation above roughly 10–20x as requiring an explicit, hard-to-miss warning, not a routine output — the mathematically "allowed" leverage on Delta (up to 200x default on BTCUSD) is not the same as a survivable leverage.
