/* HARDGATE Crypto Trading Master Catalog v1.0 — September 2026
   Map for OMNIROUTE + OMNIPRESENT. Gates, not scores. One vote per family.
   Alert-only. No win-rate claims before 100 resolved rows.
   Live set (F2): Strict Cascade 8-gate · S19 · S20. Everything else LEAD.
   OPTIONAL frames never invent ENTER. Filters never flip dir. */
(function (W){
  'use strict';

  var FAMILIES = [
    'Structure', 'Trend', 'Momentum', 'Volatility', 'Flow',
    'Derivatives', 'OnChain', 'Macro', 'Time', 'Execution', 'Trader'
  ];

  var LIVE = ['CASCADE', 'S19', 'S20'];
  var SCHED = ['S23', 'C14', 'S59', 'C24'];
  var RULES = ['BTC-ALIGN', 'LIQ-VETO', 'LIQ-CLEAR', 'FUND-CAP', 'RSI-EXH', 'S37', 'S60', 'S61', 'S66'];
  var TIERS = ['WARMING 6/8', 'ALERT 7/8', 'FIRE 8/8', 'NO ENTRY', 'DATA_UNAVAILABLE'];

  /* [id, name, lvl, sw, sc, family, verdict, sRef, wire] */
  var IND = [
    [1,'Swing structure HH/HL BOS CHoCH/MSS',1,1,1,'Structure','CORE','S0','CORE'],
    [2,'Horizontal S/R → liquidity pools',1,1,1,'Structure','CORE','S0','CORE'],
    [3,'Asian range Judas box 00:00–08:00 UTC',2,1,1,'Structure','CORE','S0','CORE'],
    [4,'Weekly / monthly / daily open (00:00 UTC)',2,1,1,'Structure','CORE','C7','CORE'],
    [5,'Round numbers / psychological levels',1,1,1,'Structure','OPTIONAL','S0','OPTIONAL'],
    [6,'Order blocks (1H last opposing + 1.5×ATR BOS)',3,1,1,'Structure','CORE','S0','CORE'],
    [7,'Fair value gaps / imbalances',3,1,1,'Structure','OPTIONAL','S6','OPTIONAL'],
    [8,'Breaker / mitigation / inversion FVG',3,1,1,'Structure','OPTIONAL','S6','OPTIONAL'],
    [9,'Liquidity sweep / Judas / turtle soup',2,1,1,'Structure','CORE','S0','CORE'],
    [10,'Premium / discount of dealing range',3,1,0,'Structure','CORE','S9','CORE'],
    [11,'Liquidation levels as pools',3,1,1,'Structure','CORE','C17','CORE'],
    [12,'Wyckoff schematic / AMD',3,1,0,'Structure','CORE','S19','CORE'],
    [13,'Poor high / excess (Market Profile)',3,1,0,'Structure','OPTIONAL','S1','OPTIONAL'],
    [14,'Chart patterns / trendlines / candlesticks',1,1,1,'Structure','OPTIONAL','','OPTIONAL'],
    [15,'Fibonacci / pivots / harmonics / Elliott / Gann',1,1,1,'Structure','NON_FALSIFIABLE','','AVOID'],
    [16,'CME weekend gap',2,0,0,'Structure','RETIRED','C30','RETIRED'],
    [17,'Range / volume / imbalance bars',4,1,1,'Structure','OPTIONAL','','OPTIONAL'],
    [18,'EMA 21 / 55 / 200 slope (never cross)',1,1,1,'Trend','CORE','S3','CORE'],
    [19,'POC migration (session POC stepping)',3,1,0,'Trend','CORE','S3','CORE'],
    [20,'BTC 4H trend as master gate',2,1,1,'Trend','CORE','C12','CORE'],
    [21,'Cascade MTF 1D/4H/1H/15m',3,1,1,'Trend','CORE','CASCADE','CORE'],
    [22,'ETH/BTC ratio trend',2,1,0,'Trend','OPTIONAL','C12','OPTIONAL'],
    [23,'BTC dominance BTC.D',2,1,0,'Trend','OPTIONAL','C12','OPTIONAL'],
    [24,'Altcoin season / TOTAL3 vs BTC',2,1,0,'Trend','OPTIONAL','C12','OPTIONAL'],
    [25,'Relative strength vs BTC (20-day)',2,1,0,'Trend','CORE','C12','CORE'],
    [26,'Kaufman Efficiency Ratio KER 20',4,1,1,'Trend','CORE','S23','CORE'],
    [27,'ADX / SuperTrend / Ichimoku / SAR / MACD',1,0,0,'Trend','REDUNDANT','','AVOID'],
    [28,'Hurst / autocorrelation / regime cluster',5,1,0,'Trend','OPTIONAL','S23','OPTIONAL'],
    [29,'200-day / 200-week MA (BTC cycle)',1,1,0,'Trend','OPTIONAL','','OPTIONAL'],
    [30,'RSI(14) 4H exhaustion block 68/32',1,1,1,'Momentum','CORE','CASCADE','CORE'],
    [31,'RSI divergence at a node',2,1,1,'Momentum','CORE','S0','CORE'],
    [32,'CUSUM change-point on returns',3,1,1,'Momentum','OPTIONAL','CASCADE','OPTIONAL'],
    [33,'Stochastic / StochRSI / CCI / Williams / MFI / TSI',1,0,0,'Momentum','REDUNDANT','','AVOID'],
    [34,'Delta divergence CVD vs price',3,1,1,'Flow','CORE','S16','CORE'],
    [35,'ATR(14) 4H R-cap / 1H buffer / 5m scalp',1,1,1,'Volatility','CORE','S0','CORE'],
    [36,'ATR regime ATR14/ATR50',2,1,0,'Volatility','CORE','S23','CORE'],
    [37,'ADR used % (24h vs ADR10)',2,1,1,'Volatility','CORE','CASCADE','CORE'],
    [38,'Bollinger squeeze / NR7',2,1,1,'Volatility','CORE','S22','CORE'],
    [39,'DVOL Deribit 30-day IV',3,1,1,'Volatility','CORE','S21','CORE'],
    [40,'DVOL expected-move bands',4,1,1,'Volatility','CORE','S21','CORE'],
    [41,'Implied − realized (DVOL − RV20)',4,1,0,'Volatility','OPTIONAL','S21','OPTIONAL'],
    [42,'DVOL term structure 7d IV − DVOL',4,1,0,'Volatility','OPTIONAL','S21','OPTIONAL'],
    [43,'Realized vol Parkinson 10-session',3,1,0,'Volatility','OPTIONAL','','OPTIONAL'],
    [44,'Alt beta to BTC (60-day)',2,1,0,'Volatility','CORE','C12','CORE'],
    [45,'Keltner / Choppiness / Mass / Chaikin vol',2,0,0,'Volatility','REDUNDANT','','AVOID'],
    [46,'Volume / RVOL vs same hour 20 sessions',1,1,1,'Flow','CORE','S0','CORE'],
    [47,'24h turnover floor liquidity veto',2,1,1,'Flow','CORE','CASCADE','CORE'],
    [48,'Volume Profile FRVP / session / composite',3,1,1,'Flow','CORE','S1','CORE'],
    [49,'Naked POC / VAH/VAL / developing POC',3,1,0,'Flow','CORE','S2','CORE'],
    [50,'Session VWAP + σ bands (00:00 UTC)',2,1,1,'Flow','CORE','S22','CORE'],
    [51,'Anchored VWAP weekly / US / sweep',3,1,0,'Flow','CORE','S3','CORE'],
    [52,'CVD native taker buy − sell',3,1,1,'Flow','CORE','S16','CORE'],
    [53,'Taker buy/sell ratio',2,1,1,'Flow','REDUNDANT','S16','AVOID'],
    [54,'Footprint / stacked imbalance / absorption',3,1,1,'Flow','CORE','S16','CORE'],
    [55,'Spot vs perp volume ratio',3,1,0,'Flow','OPTIONAL','','OPTIONAL'],
    [56,'Liquidation volume long/short per hour',3,1,1,'Flow','CORE','C17','CORE'],
    [57,'Order-book depth / heatmap / spoof',4,1,1,'Flow','OPTIONAL','','OPTIONAL'],
    [58,'Order-flow imbalance L2 OFI',5,0,1,'Flow','OPTIONAL','','OPTIONAL'],
    [59,'VPIN native buy/sell buckets',5,1,1,'Flow','OPTIONAL','S16','OPTIONAL'],
    [60,'Amihud / Kyle λ per symbol',5,1,1,'Flow','OPTIONAL','','OPTIONAL'],
    [61,'OBV / A/D / CMF / Klinger / Force',1,0,0,'Flow','REDUNDANT','S16','AVOID'],
    [62,'Funding rate (Delta 05:30/13:30/21:30 IST)',1,1,1,'Derivatives','CORE','C18','CORE'],
    [63,'Funding percentile 90d + cross-venue',2,1,0,'Derivatives','CORE','C18','CORE'],
    [64,'Predicted next funding',2,0,1,'Derivatives','OPTIONAL','C22','OPTIONAL'],
    [65,'Open interest perp Price/OI matrix',1,1,1,'Derivatives','CORE','C19','CORE'],
    [66,'OI change % 1h / 4h / 24h',2,1,1,'Derivatives','CORE','C19','CORE'],
    [67,'OI-weighted funding crowding',3,1,0,'Derivatives','OPTIONAL','C18','OPTIONAL'],
    [68,'Perp–spot basis / dated futures basis',2,1,1,'Derivatives','CORE','C20','CORE'],
    [69,'Long/short account / top-trader ratio',2,1,0,'Derivatives','OPTIONAL','','OPTIONAL'],
    [70,'Liquidation heatmap estimated levels',3,1,1,'Derivatives','CORE','C17','CORE'],
    [71,'Options OI by strike / max pain Deribit',3,1,0,'Derivatives','OPTIONAL','S26','OPTIONAL'],
    [72,'25Δ skew / put-call ratio BTC ETH',4,1,0,'Derivatives','OPTIONAL','S31','OPTIONAL'],
    [73,'DVOL term structure (see A4)',4,1,0,'Derivatives','OPTIONAL','S21','OPTIONAL'],
    [74,'Coinbase premium index',3,1,0,'Derivatives','OPTIONAL','C15','OPTIONAL'],
    [75,'Korea kimchi premium',3,1,0,'Derivatives','OPTIONAL','','OPTIONAL'],
    [76,'Stablecoin supply / SSR / exchange reserves',3,1,0,'OnChain','OPTIONAL','C14','OPTIONAL'],
    [77,'ETF net flows 5-day streak',3,1,0,'OnChain','CORE','C15','CORE'],
    [78,'Grayscale / basis-trade unwind',4,1,0,'OnChain','OPTIONAL','C21','OPTIONAL'],
    [79,'MVRV market ÷ realized cap',3,1,0,'OnChain','CORE','C14','CORE'],
    [80,'MVRV Z-score',3,1,0,'OnChain','OPTIONAL','C14','OPTIONAL'],
    [81,'SOPR / aSOPR',3,1,0,'OnChain','CORE','C14','CORE'],
    [82,'NUPL net unrealized P/L',3,1,0,'OnChain','OPTIONAL','C14','OPTIONAL'],
    [83,'Realized price STH / LTH cost basis',3,1,0,'OnChain','CORE','C14','CORE'],
    [84,'Exchange net flows 7-day',3,1,0,'OnChain','OPTIONAL','C14','OPTIONAL'],
    [85,'Whale wallet / large-transfer counts',3,1,0,'OnChain','OPTIONAL','','OPTIONAL'],
    [86,'Miner flows / Puell / hash ribbons',4,1,0,'OnChain','OPTIONAL','','OPTIONAL'],
    [87,'Active addresses / tx count / fees',3,1,0,'OnChain','OPTIONAL','','OPTIONAL'],
    [88,'TVL / DeFi stablecoin flows',3,1,0,'OnChain','OPTIONAL','C12','OPTIONAL'],
    [89,'Token unlock / vesting calendar',2,1,0,'OnChain','CORE','C24','CORE'],
    [90,'Exchange listing / delisting',2,1,1,'OnChain','CORE','C24','CORE'],
    [91,'Economic calendar FOMC CPI NFP T1',1,1,1,'Macro','CORE','S27','CORE'],
    [92,'Crypto-native events expiry ETF upgrade unlock',2,1,1,'Macro','CORE','S35','CORE'],
    [93,'DXY / 10Y real yield / Fed path',2,1,0,'Macro','OPTIONAL','','OPTIONAL'],
    [94,'NDX / SPX 20-day correlation',2,1,0,'Macro','CORE','S32','CORE'],
    [95,'Gold vs BTC correlation',3,1,0,'Macro','CORE','S32','CORE'],
    [96,'Global liquidity Fed TGA RRP M2',4,1,0,'Macro','OPTIONAL','','OPTIONAL'],
    [97,'Fear & Greed index',1,1,0,'Macro','OPTIONAL','','OPTIONAL'],
    [98,'Social sentiment / Trends / chatter',1,1,0,'Macro','OPTIONAL','','OPTIONAL'],
    [99,'Macro-residual BTC vs NDX DXY yield',5,1,0,'Macro','OPTIONAL','','OPTIONAL'],
    [100,'Session windows Asia London US Judas',1,1,1,'Time','CORE','S0','CORE'],
    [101,'Funding timestamps 20-min pre-window',2,1,1,'Time','CORE','C22','CORE'],
    [102,'Daily / weekly / monthly close window',2,1,0,'Time','OPTIONAL','','OPTIONAL'],
    [103,'Weekend regime Sat–Sun UTC',2,1,1,'Time','CORE','C7','CORE'],
    [104,'Hour-of-day high/low histograms',4,1,1,'Time','CORE','S29','CORE'],
    [105,'KER regime / cluster BTC reference',4,1,1,'Time','CORE','S23','CORE'],
    [106,'SPRT bootstrap Monte Carlo Bayesian WF',5,0,0,'Time','CORE','S60','CORE'],
    [107,'Liquidation clearance 0.5× stop beyond L',2,1,1,'Execution','CORE','CASCADE','CORE'],
    [108,'Spread / slippage log expected cost in R',2,1,1,'Execution','CORE','CASCADE','CORE'],
    [109,'Turnover floor / depth at ±0.5%',2,1,1,'Execution','CORE','CASCADE','CORE'],
    [110,'Mark vs last vs index divergence',2,0,1,'Execution','CORE','CASCADE','CORE'],
    [111,'Insurance fund / ADL risk',4,1,0,'Execution','OPTIONAL','','OPTIONAL'],
    [112,'Exchange status / API / stale feed',1,1,1,'Execution','CORE','CASCADE','CORE'],
    [113,'Symbol age / listing recency ≥30d swing',2,1,0,'Execution','CORE','C24','CORE'],
    [114,'PDI process-discipline index',5,1,1,'Trader','CORE','S59','CORE'],
    [115,'LAT latency-to-act',5,1,1,'Trader','CORE','S59','CORE'],
    [116,'RVG revenge-trade flag',5,1,1,'Trader','CORE','S59','CORE'],
    [117,'LOAD session-hours load (flat day / week)',5,1,1,'Trader','CORE','S59','CORE'],
    [118,'OVR overtrade count',5,1,1,'Trader','CORE','S59','CORE']
  ];

  /* [id, name, lvl, sw, sc, verdict, equiv, note] */
  var STRAT = [
    [1,'Spot DCA / accumulation',1,1,0,'OPTIONAL','C14','Investing — separate account'],
    [2,'21/55 EMA pullback in BTC trend',1,1,0,'OPTIONAL','S3','UPGRADE to developing-POC / node'],
    [3,'Prior-day high/low breakout',1,1,0,'OPTIONAL','S0','Most PDH breaks are Judas — add 2-close or retest'],
    [4,'Support bounce with candle',1,1,0,'OPTIONAL','S0','Require sweep + node + OB'],
    [5,'RSI 30/70 reversion',1,1,0,'AVOID','CASCADE','Exhaustion block exists because this fails'],
    [6,'Donchian 20-day Turtle breakout',1,1,0,'OPTIONAL','S20','Test against S20 fade; KER decides'],
    [7,'Bollinger bounce in range',1,1,1,'OPTIONAL','S22','Add VWAP + node + KER < 0.3'],
    [8,'Grid trading',1,1,1,'AVOID','','Dies in trends; incompatible with liq clearance'],
    [9,'HODL + trailing stop',1,1,0,'OPTIONAL','','Investing, not trading'],
    [10,'9/21 EMA cross 5m US open',1,0,1,'AVOID','','Slope as bias only — never the trigger'],
    [11,'US-open OR 15-min breakout',1,0,1,'OPTIONAL','S5','News check + 60-min time stop'],
    [12,'VWAP first pullback trending session',1,0,1,'OPTIONAL','S22','Requires CVD confirmation'],
    [13,'Funding-time fade naive',1,0,1,'AVOID','C22','Naive version loses to spread'],
    [14,'Liquidation-wick scalp naive',1,0,1,'OPTIONAL','C17','Needs >3σ spike + reclaim'],
    [15,'Pivot / round-number bounce',1,1,1,'OPTIONAL','S0','Trade as sweeps, not bounces'],
    [16,'Judas sweep Asian-range manipulation',2,1,1,'CORE','S0','CORE — JDX must return inside'],
    [17,'BTC-aligned alt trade',2,1,1,'CORE','C12','CORE master gate'],
    [18,'Funding-crowding fade',2,1,0,'CORE','C18','Funding alone is never the trigger'],
    [19,'OI-divergence reversal',2,1,0,'OPTIONAL','C19','OPTIONAL-confirm'],
    [20,'Weekly-open reclaim',2,1,0,'CORE','C7','CORE weekly'],
    [21,'Relative-strength alt rotation',2,1,0,'CORE','C12','CORE alt selection'],
    [22,'ETH/BTC ratio regime filter',2,1,0,'OPTIONAL','C12','OPTIONAL-context'],
    [23,'Breakout-retest 4H + OI',2,1,0,'CORE','S4','CORE'],
    [24,'Session-VWAP σ reversion',2,1,1,'CORE','S22','CORE scalp'],
    [25,'Liquidation-level magnet T1',2,1,1,'CORE','C17','CORE target'],
    [26,'Perp premium spike fade',2,1,1,'OPTIONAL','C20','OPTIONAL'],
    [27,'Post-news spike fade FOMC/CPI',2,1,1,'CORE','S27','CORE'],
    [28,'Unlock short bias >2% float ≤7d',2,1,0,'CORE','C24','CORE for alts'],
    [29,'Coinbase-premium confirmation',2,1,0,'OPTIONAL','C15','OPTIONAL-adjuster'],
    [30,'CME gap fill',2,0,0,'RETIRED','','Retired 29 May 2026 — CME BTC 24/7'],
    [31,'Strict Cascade 8-gate',3,1,1,'CORE','CASCADE','The live crypto S0'],
    [32,'AMD sweep-and-reclaim 4H node + OB',3,1,0,'CORE','S0','Gold S0 verbatim'],
    [33,'Value-area rotation',3,1,0,'CORE','S1','CORE'],
    [34,'Naked POC / liq-cluster ladder',3,1,0,'CORE','S2','CORE + C25'],
    [35,'Developing-POC pullback trend day',3,1,0,'CORE','S3','CORE'],
    [36,'US-open Initial Balance extension',3,1,1,'CORE','S5','CORE'],
    [37,'FVG / MSS refined entries',3,1,1,'CORE','S6','CORE'],
    [38,'Discount/premium-node filter',3,1,0,'CORE','S9','CORE'],
    [39,'Liquidation-cascade continuation',3,1,1,'CORE','C17','Acceptance vs reclaim'],
    [40,'Liquidation-flush reversal',3,1,1,'CORE','C17','OI drop ≥5% + reclaim'],
    [41,'Funding-reset trade',3,1,0,'CORE','C18','CORE'],
    [42,'OI-flush confirmation',3,1,0,'CORE','C19','Grade +1 on sweep bar'],
    [43,'SMT divergence BTC vs ETH',3,1,1,'CORE','S36','CORE'],
    [44,'CVD absorption / delta at node',3,1,1,'CORE','S16','CORE'],
    [45,'Look-above-and-fail multi-day balance',3,1,0,'CORE','S17','CORE'],
    [46,'Wyckoff spring + test',3,1,0,'CORE','S19','LIVE SET'],
    [47,'Turtle-soup 20-day extreme',3,1,0,'CORE','S20','LIVE SET'],
    [48,'Failed-sweep continuation',3,1,1,'CORE','S37','One second-chance / day'],
    [49,'Basis-compression trade',3,1,0,'OPTIONAL','C21','OPTIONAL expression'],
    [50,'Weekend-sweep Monday reclaim',3,1,0,'CORE','C7','CORE'],
    [51,'On-chain weekly bias Saturday score',4,1,0,'CORE','C14','Scheduler — not an entry'],
    [52,'STH cost-basis reclaim / loss',4,1,0,'CORE','C14','Permission only; entries via S0'],
    [53,'Regime-switch protocol KER on BTC',4,1,1,'CORE','S23','LIVE scheduler'],
    [54,'DVOL expected-move fade',4,1,1,'CORE','S21','CORE'],
    [55,'Options max-pain / expiry pin',4,1,0,'OPTIONAL','S26','OPTIONAL last 4h'],
    [56,'Skew-flip capitulation',4,1,0,'OPTIONAL','S31','OPTIONAL permission'],
    [57,'Event templates FOMC CPI expiry ETF',4,1,1,'CORE','S35','CORE'],
    [58,'Cash-and-carry / funding harvest',4,1,0,'OPTIONAL','C21','Position expression'],
    [59,'Reverse carry',4,1,0,'OPTIONAL','C21','Same book'],
    [60,'Options expression of S0',4,1,0,'OPTIONAL','S41','OPTIONAL'],
    [61,'Alt-sector rotation',4,1,0,'OPTIONAL','C12','OPTIONAL extension'],
    [62,'Cross-exchange India premium',4,1,1,'OPTIONAL','C20','Adjuster — never arb it'],
    [63,'ETF-flow momentum 5-day',4,1,0,'CORE','C15','Permission +1'],
    [64,'Unlock / listing calendar enforcement',4,1,0,'CORE','C24','LIVE scheduler'],
    [65,'Gold–BTC correlation portfolio rule',4,0,0,'CORE','S32','CORE'],
    [66,'Sizing family A/B',4,0,0,'CORE','S44','Shadow 100 trades'],
    [67,'Exit family A/B E1–E4',4,0,0,'CORE','S46','Shadow every trade'],
    [68,'Perp-premium fade at node full gates',4,1,1,'OPTIONAL','S65','OPTIONAL'],
    [69,'Funding-timed entry / carry-aware runner',4,1,1,'CORE','C22','CORE'],
    [70,'Time-based hold extension Asia→US',4,1,0,'CORE','S29','CORE'],
    [71,'Native-CVD and VPIN gating',5,1,1,'OPTIONAL','S16','Yes retail'],
    [72,'Liquidity-scaled Amihud thresholds',5,1,1,'OPTIONAL','','Yes'],
    [73,'Regime clustering / HMM universe',5,1,1,'OPTIONAL','S23','Yes'],
    [74,'Macro-residual momentum',5,1,0,'OPTIONAL','','Yes'],
    [75,'Information-driven bars from ticks',5,1,1,'OPTIONAL','','Yes'],
    [76,'Meta-labelling on gate features',5,0,0,'OPTIONAL','','Later — 500+ rows'],
    [77,'Cross-venue stat-arb',5,0,0,'OPTIONAL','C21','Partial — carry only'],
    [78,'Funding-rate arb across venues',5,0,0,'OPTIONAL','C21','Partial'],
    [79,'Pairs / cointegration ETH/BTC',5,1,0,'OPTIONAL','C12','Yes at small size'],
    [80,'Market making on perps',5,0,0,'AVOID','','No at retail'],
    [81,'Vol surface RV Deribit',5,0,0,'AVOID','','No at retail size'],
    [82,'Systematic TSMOM top-20',5,1,0,'OPTIONAL','','Yes via perps low lev'],
    [83,'Liq-cascade prediction models',5,1,0,'OPTIONAL','C17','Partial — heatmap approx'],
    [84,'MEV / on-chain arbitrage',5,0,0,'AVOID','','No'],
    [85,'SPRT bootstrap Bayesian freeze',5,0,0,'CORE','S60','CORE validation']
  ];

  var EXCLUDED = [
    ['CME gap fill', 'RETIRED — CME Bitcoin futures 24/7 since 29 May 2026'],
    ['Grid / martingale / averaging down', 'Sizing that grows into losers; incompatible with liquidation clearance'],
    ['Signal groups / AI confidence % / composite scores', 'Circular; re-weight inputs already counted'],
    ['Leverage-first rules (always 20×)', 'Leverage is an output of risk ÷ stop distance'],
    ['Stochastic / MACD / OBV stacks', 'Vote inflation inside one family'],
    ['Elliott / harmonics / Gann / cycle-date targets', 'Non-falsifiable at decision time'],
    ['Memecoin momentum without turnover + unlock', 'Liquidity veto and event risk'],
    ['Win-rate / expectancy claims before 100 resolved rows', 'The ledger has not earned it']
  ];

  var KIND_MAP = {
    SPRING: 'S19', UTAD: 'S19', PO3: 'S0', ORB: 'S5', ABSORB: 'S16',
    VALUE: 'S1', 'EQH-SWEEP': 'S0', 'EQL-SWEEP': 'S0', 'FUND-SQUEEZE': 'C18',
    'OI-DIVERGE': 'C19', 'HTF-PULLBACK': 'S3', JUDAS: 'S0', JDX: 'S0',
    CASCADE: 'CASCADE', 'TURTLE-SOUP': 'S20', TURTLE: 'S20',
    'CME-GAP': 'RETIRED', CMEGAP: 'RETIRED', GRID: 'AVOID',
    'EMA-CROSS': 'AVOID', 'RSI-REV': 'AVOID', 'OP-ARMED': 'S0', 'OP-REJECT': 'S0'
  };

  function recInd(t){
    return { id: t[0], name: t[1], lvl: t[2], sw: !!t[3], sc: !!t[4], family: t[5],
             verdict: t[6], sRef: t[7] || '', wire: t[8] || t[6] };
  }
  function recSt(t){
    return { id: t[0], name: t[1], lvl: t[2], sw: !!t[3], sc: !!t[4], verdict: t[5],
             equiv: t[6] || '', note: t[7] || '' };
  }

  function inventory(){
    return {
      version: '1.0',
      stamp: 'hg-v578',
      indicators: IND.map(recInd),
      strategies: STRAT.map(recSt),
      families: FAMILIES.slice(),
      live: LIVE.slice(),
      schedulers: SCHED.slice(),
      rules: RULES.slice(),
      tiers: TIERS.slice(),
      excluded: EXCLUDED.map(function (x){ return { name: x[0], reason: x[1] }; }),
      doctrine: 'gates, not scores · one vote per evidence family · alert-only · no win-rate claims before 100 resolved rows'
    };
  }

  function byId(id){
    var i, t;
    for (i = 0; i < IND.length; i++) if (IND[i][0] === id) return recInd(IND[i]);
    for (i = 0; i < STRAT.length; i++){
      t = STRAT[i];
      if (t[0] === id) return recSt(t);
    }
    return null;
  }

  function findStrat(equiv){
    var i, t, hit = null;
    if (!equiv) return null;
    for (i = 0; i < STRAT.length; i++){
      t = STRAT[i];
      if (t[6] === equiv || ('C' + t[0]) === equiv || ('S' + t[0]) === equiv || String(t[0]) === String(equiv)){
        if (!hit || t[5] === 'CORE') hit = recSt(t);
      }
    }
    return hit;
  }

  function wireForKind(kind){
    var k = String(kind || '').toUpperCase();
    if (KIND_MAP[k]) return KIND_MAP[k];
    if (k.indexOf('GAP') >= 0 && k.indexOf('CME') >= 0) return 'RETIRED';
    if (k.indexOf('GRID') >= 0 || k.indexOf('MARTINGALE') >= 0) return 'AVOID';
    return '';
  }

  function isBlockVerdict(v){
    return v === 'RETIRED' || v === 'REDUNDANT' || v === 'NON_FALSIFIABLE' || v === 'AVOID';
  }

  /* OPTIONAL frames only. Never invent dir / ENTER. */
  function hgCryptoCatalogEngine(rows, opts){
    opts = opts || {};
    var now = opts.now instanceof Date ? opts.now : new Date();
    var utcDay = now.getUTCDay();
    var utcH = now.getUTCHours();
    var utcM = now.getUTCMinutes();
    var frames = [];
    var weekend = utcDay === 6 || utcDay === 0;
    if (weekend){
      frames.push({
        id: 'C-WEEKEND', family: 'Time', verdict: 'CORE', dir: null,
        note: 'Weekend regime (Sat–Sun UTC): swing half size, scalp OFF, stop buffers ×1.5. Frame only — never ENTER.'
      });
    }
    /* Delta funding 05:30 / 13:30 / 21:30 IST = 00:00 / 08:00 / 16:00 UTC */
    var fundHours = [0, 8, 16];
    var i, mins;
    for (i = 0; i < fundHours.length; i++){
      mins = (utcH * 60 + utcM) - fundHours[i] * 60;
      if (mins >= -20 && mins < 0){
        frames.push({
          id: 'C-FUND-WINDOW', family: 'Time', verdict: 'CORE', dir: null,
          note: '20-min pre-funding window (Delta IST stamps). Paying-side WAIT. Frame only — never ENTER.'
        });
        break;
      }
    }
    if (opts.adrUsedPct != null && Number(opts.adrUsedPct) > 120){
      frames.push({
        id: 'C-ADR', family: 'Volatility', verdict: 'CORE', dir: null,
        note: 'ADR used > 120% — no continuation. Frame only.'
      });
    }
    void rows;
    return {
      version: '1.0',
      stamp: 'hg-v578',
      live: LIVE.slice(),
      schedulers: SCHED.slice(),
      rules: RULES.slice(),
      tiers: TIERS.slice(),
      frames: frames,
      inventory: inventory(),
      enter: false
    };
  }

  function hgCryptoCatalogApplyVerdict(cand, cat){
    if (!cand) return cand;
    cat = cat || hgCryptoCatalogEngine([], {});
    var kind = cand.kind || (cand.plan && cand.plan.kind) || '';
    var wire = wireForKind(kind);
    var st = findStrat(wire);
    var verdict = wire === 'RETIRED' ? 'RETIRED' : wire === 'AVOID' ? 'AVOID' : (st && st.verdict) || '';
    var prevDir = cand.dir != null ? cand.dir : (cand.plan && cand.plan.plan && cand.plan.plan.dir);
    if (isBlockVerdict(verdict)){
      cand.demoted = true;
      cand.catalogExclude = true;
      cand.catalogVerdict = verdict;
      cand.catalogNote = (st && st.note) || (verdict === 'RETIRED' ? 'Retired — do not trade' : 'Catalog exclude');
      if (cand.plan && cand.plan.plan){
        cand.plan.plan.demoted = true;
        cand.plan.plan.catalogExclude = true;
      }
      return cand;
    }
    if (st && st.note && st.note.indexOf('UPGRADE') >= 0){
      cand.catalogUpgrade = st.equiv || 'S0';
      cand.catalogNote = st.note;
    }
    if (st && st.equiv && LIVE.indexOf(st.equiv) < 0 && st.verdict === 'OPTIONAL'){
      cand.catalogLead = true;
      cand.catalogNote = (cand.catalogNote ? cand.catalogNote + ' · ' : '') + 'LEAD until SPRT / 100-row cap';
    }
    /* Sacred: never flip dir. */
    if (prevDir != null){
      if (cand.dir != null) cand.dir = prevDir;
      if (cand.plan && cand.plan.plan && cand.plan.plan.dir != null) cand.plan.plan.dir = prevDir;
    }
    cand.catalogVerdict = verdict || cand.catalogVerdict || 'CORE';
    return cand;
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function famCounts(inv){
    var out = {}, i, r, f;
    for (i = 0; i < FAMILIES.length; i++) out[FAMILIES[i]] = { C: 0, O: 0, X: 0 };
    for (i = 0; i < inv.indicators.length; i++){
      r = inv.indicators[i];
      f = out[r.family] || (out[r.family] = { C: 0, O: 0, X: 0 });
      if (r.verdict === 'CORE') f.C++;
      else if (r.verdict === 'OPTIONAL') f.O++;
      else f.X++;
    }
    return out;
  }

  function hgCryptoCatalogHtml(cat){
    cat = cat || hgCryptoCatalogEngine([], {});
    var inv = cat.inventory || inventory();
    var fc = famCounts(inv);
    var famBits = FAMILIES.map(function (f){
      var n = fc[f] || { C: 0, O: 0, X: 0 };
      return '<span class="chip">' + esc(f) + ' C' + n.C + '/O' + n.O + '</span>';
    }).join(' ');
    var live = (cat.live || LIVE).map(function (x){ return '<b>' + esc(x) + '</b>'; }).join(' · ');
    var sched = (cat.schedulers || SCHED).join(' · ');
    var rules = (cat.rules || RULES).join(' · ');
    var tiers = (cat.tiers || TIERS).join(' → ');
    var frames = (cat.frames || []).map(function (fr){
      return '<div class="note">' + esc(fr.note || fr.id) + '</div>';
    }).join('');
    var excl = (inv.excluded || []).map(function (x){
      return '<li><b>' + esc(x.name) + '</b> — ' + esc(x.reason) + '</li>';
    }).join('');
    return ''
      + '<div class="panel" data-hg-crypto-catalog="1" style="margin-top:10px">'
      + '<div class="lbl">CRYPTO MASTER CATALOG v1.0 · ' + esc(inv.stamp || 'hg-v578') + '</div>'
      + '<div class="note">Venues: Delta India + CoinDCX perps. Swing 4H/1H · Scalp 5m/1m. '
      + esc(inv.doctrine) + '. <b>never ENTER</b> from this panel — map only.</div>'
      + '<div class="note"><b>LIVE SET</b> ' + live
      + ' · schedulers ' + esc(sched)
      + ' · rules ' + esc(rules) + '</div>'
      + '<div class="note">Alert tiers: ' + esc(tiers) + '</div>'
      + '<div class="note">Families (one vote each): ' + famBits + '</div>'
      + '<div class="note">Indicators ' + inv.indicators.length + ' · strategies ' + inv.strategies.length
      + ' · CME weekend gap <b>RETIRED</b> (CME BTC 24/7 since 29 May 2026).</div>'
      + '<div class="note"><b>SCALP MODULE</b> 5m/1m · US 13:30–15:30 UTC · London 07:00–09:00 UTC · '
      + 'hold ≤60 min · native CVD required · weekend OFF · suppressed if Cascade is WARMING/ALERT/FIRE same symbol/side.</div>'
      + (frames || '')
      + '<details style="margin-top:6px"><summary class="note">Part E — excluded</summary><ul style="margin:6px 0 0 18px">'
      + excl + '</ul></details>'
      + '</div>';
  }

  W.HG_CRYPTO_CATALOG = inventory();
  W.HG_CRYPTO_CATALOG_VER = '1.0';
  W.HG_CRYPTO_CATALOG_IND = IND;
  W.HG_CRYPTO_CATALOG_STRAT = STRAT;
  W.HG_CRYPTO_CATALOG_LIVE = LIVE;
  W.HG_CRYPTO_CATALOG_SCHED = SCHED;
  W.HG_CRYPTO_CATALOG_RULES = RULES;
  W.HG_CRYPTO_CATALOG_EXCLUDE = EXCLUDED;
  W.hgCryptoCatalogInventory = inventory;
  W.hgCryptoCatalogEngine = hgCryptoCatalogEngine;
  W.hgCryptoCatalogApplyVerdict = hgCryptoCatalogApplyVerdict;
  W.hgCryptoCatalogHtml = hgCryptoCatalogHtml;
  W.hgCryptoCatalogById = byId;
  W.hgCryptoCatalogKindMap = KIND_MAP;
})(typeof window !== 'undefined' ? window : globalThis);
