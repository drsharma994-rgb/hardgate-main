# HARDGATE — technique provenance ledger

Clean-room reimplementations from published techniques (papers, books, documentation).
No upstream source files are copied or translated.

| module | technique | upstream cited | upstream licence | how implemented |
|--------|-----------|----------------|------------------|-----------------|
| lib/freqtrade-protections.mjs | cooldown + stoploss guard | documented Freqtrade protection behaviour | GPL-3.0 (package) | clean-room from documented behaviour |
| lib/freqtrade-edge.mjs | expectancy edge ranking | Freqtrade edge documentation | GPL-3.0 (package) | clean-room from documented formulas |
| lib/purged-cv.mjs | purged K-fold + embargo | Lopez de Prado, *Advances in Financial Machine Learning* ch.7 | book | clean-room from published algorithm |
| lib/triple-barrier.mjs | triple-barrier labelling | Lopez de Prado, AFML ch.3 | book | clean-room |
| lib/meta-label.mjs | meta-labelling | Lopez de Prado, AFML ch.3 | book | clean-room |
| lib/tear-sheet.mjs | tear sheet + deflated Sharpe | Bailey & Lopez de Prado (2014) | paper | clean-room |
| lib/reliability.mjs | calibration + gate IC | Alphalens information coefficient concept | Apache-2.0 (package) | clean-room Spearman IC statistic |
| lib/sample-uniqueness.mjs | average uniqueness / concurrent labels | Lopez de Prado, AFML ch.4 | book | clean-room |
| lib/bet-size.mjs | bet sizing from predicted probability | Lopez de Prado, AFML ch.10 | book | clean-room |
| lib/vol-forecast.mjs | EWMA + GARCH(1,1) vol forecast | RiskMetrics; Bollerslev (1986) | papers | clean-room |
| lib/regime-router.mjs | Hurst exponent + sample entropy | Hurst (1951); Richman & Moorman (2000) | papers | clean-room |
| lib/gold-coint.mjs | Engle–Granger cointegration + half-life | Engle & Granger (1987); textbook pairs trading | textbook | clean-room |
| lib/clusters.mjs | correlation clusters + beta heat | standard portfolio math | — | independent |
| lib/gold-cot.mjs | CFTC COT positioning | CFTC public reports | public data | independent parser |
| lib/cost-model.mjs | round-trip cost vs R distance | market microstructure practice | — | independent |
| lib/regime-thresholds.mjs | regime-adjusted gate thresholds | HARDGATE internal | — | independent |
| lib/stand-down.mjs | consecutive-loss stand-down | trading discipline practice | — | independent |
| lib/ccxt-market-core.mjs | CCXT market desk patterns | ccxt/ccxt | MIT | API integration only |
| lib/openbb-desk-core.mjs | macro desk fallback | OpenBB documentation | NOASSERTION | data desk only |
| tear-sheet.js | browser tear-sheet bridge | QuantStats-style metrics | — | mirrors lib/tear-sheet.mjs |
| meta-label.js | browser meta-label bridge | AFML ch.3 | book | mirrors lib/meta-label.mjs |
