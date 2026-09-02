/* HARDGATE — Gold Trading Master Catalog v1.0 (Sep 2026)
   Map of every indicator/strategy the playbook inventory lists — including
   tools Parts 1–9 deliberately excluded, each with the reason.

   Two rules travel with it:
     1. One vote per evidence family. Ten oscillators = one momentum vote.
     2. Verdict is honest. CORE = live set / gates. OPTIONAL = test it.
        REDUNDANT = already counted. NON_FALSIFIABLE / AVOID = never a gate
        and never ENTER.

   This module never invents direction. Filters demote / stamp only.
   Live set (unchanged since Part 6): S0, S19, S20 + schedulers S23/S28/S59
   + rules S37/S60/S61/S66. Everything else stays disabled as a LEAD until
   SPRT or the 100-row cap.
*/
(function (root) {
  'use strict';
  var W = root || (typeof window !== 'undefined' ? window : globalThis);

  var HG_GOLD_CATALOG_VER = '1.0';
  var HG_GOLD_CATALOG_LIVE = ['S0', 'S19', 'S20'];
  var HG_GOLD_CATALOG_SCHED = ['S23', 'S28', 'S59'];
  var HG_GOLD_CATALOG_RULES = ['S37', 'S60', 'S61', 'S66'];

  /* [id, name, lvl, sw, sc, family, verdict, sRef, wire] */
  var I = [
    [1,'Horizontal S/R','L1',1,1,'Structure','CORE','P1§6.2','sweep'],
    [2,'Trendlines / channels','L1',1,1,'Structure','OPTIONAL','—',null],
    [3,'Candlestick patterns','L1',1,1,'Structure','OPTIONAL','reclaim close',null],
    [4,'Classical chart patterns','L1',1,0,'Structure','OPTIONAL','S0/S12',null],
    [5,'Dow swing structure','L1',1,1,'Trend','CORE','P2§2.3','bosalign'],
    [6,'BOS / CHoCH / MSS','L2',1,1,'Structure','CORE','S10','bosalign'],
    [7,'Supply / demand zones','L2',1,1,'Structure','REDUNDANT','OB P1§6.1','ob'],
    [8,'Order blocks','L3',1,1,'Structure','CORE','gate 6','ob'],
    [9,'Fair value gap','L3',1,1,'Structure','OPTIONAL','S6','fvg'],
    [10,'Breaker / mitigation','L3',1,1,'Structure','OPTIONAL','P1§8.4','ob'],
    [11,'Inversion FVG','L3',1,1,'Structure','OPTIONAL','P4§3.3','fvg'],
    [12,'Rejection block','L3',1,1,'Structure','OPTIONAL','P4§3.4',null],
    [13,'Liquidity pools','L2',1,1,'Structure','CORE','gate 4','eqhi'],
    [14,'Liquidity sweep / turtle soup','L2',1,1,'Structure','CORE','S0/S20','sweep'],
    [15,'Premium / discount EQ','L3',1,1,'Structure','CORE','S9','p4disc'],
    [16,'Wyckoff schematic','L3',1,0,'Structure','CORE','S19','p5wyck'],
    [17,'AMD / Power of Three','L2',1,1,'Time','CORE','S0','vpbook'],
    [18,'Judas swing','L2',1,1,'Structure','REDUNDANT','#14 sweep',null],
    [19,'Gaps (weekend/MCX)','L2',1,0,'Structure','OPTIONAL','S11/S40','p4gap'],
    [20,'Poor high / excess','L3',1,0,'Structure','OPTIONAL','S15','p4poor'],
    [21,'Open types','L3',1,1,'Structure','OPTIONAL','S25','p5open'],
    [22,'Fibonacci retracement','L1',1,1,'Structure','REDUNDANT','EQ #15',null],
    [23,'Fibonacci extensions','L2',1,0,'Structure','REDUNDANT','nodes',null],
    [24,'Pivot points','L1',1,1,'Structure','REDUNDANT','VAH/VAL/POC',null],
    [25,'Harmonic patterns','L2',1,0,'Structure','NON_FALSIFIABLE','—',null],
    [26,'Elliott Wave','L2',1,0,'Structure','NON_FALSIFIABLE','—',null],
    [27,'Gann / time cycles','L2',1,0,'Structure','NON_FALSIFIABLE','—',null],
    [28,'Ichimoku','L2',1,0,'Trend','REDUNDANT','EMA+POC',null],
    [29,'Andrews pitchfork','L2',1,0,'Structure','OPTIONAL','trendline',null],
    [30,'Renko / range bars','L3',1,1,'Structure','OPTIONAL','S52','p8range'],
    [31,'Heikin-Ashi','L1',1,1,'Trend','REDUNDANT','hides wick',null],
    [32,'Point and figure','L2',1,0,'Structure','OPTIONAL','VP supersedes',null],
    [33,'SMA 20/50/200','L1',1,1,'Trend','OPTIONAL','one MA family',null],
    [34,'EMA slope','L1',1,1,'Trend','CORE','P2§2.3','ribbon'],
    [35,'WMA/HMA/DEMA/…','L2',1,1,'Trend','REDUNDANT','#34',null],
    [36,'MA crossover 50/200','L1',1,0,'Trend','REDUNDANT','POC migration',null],
    [37,'MACD','L1',1,1,'Momentum','REDUNDANT','vs RSI',null],
    [38,'ADX / DMI','L2',1,0,'Trend','OPTIONAL','KER confirm',null],
    [39,'Parabolic SAR','L1',1,1,'Trend','REDUNDANT','trail only',null],
    [40,'SuperTrend','L1',1,1,'Trend','REDUNDANT','Keltner',null],
    [41,'Aroon','L2',1,0,'Trend','REDUNDANT','ADX',null],
    [42,'Vortex','L2',1,0,'Trend','REDUNDANT','ADX',null],
    [43,'Donchian 20','L1',1,0,'Structure','CORE','S20 pool','p5turt'],
    [44,'Linreg channel / slope','L2',1,0,'Trend','OPTIONAL','quant trendline','catlinreg'],
    [45,'POC migration','L3',1,0,'Trend','CORE','P1§5.4','hvn'],
    [46,'Weekly VA / monthly POC','L3',1,0,'Trend','OPTIONAL','P4§4',null],
    [47,'KER 20','L4',1,1,'Trend','CORE','S23',null],
    [48,'Hurst 100','L5',1,0,'Trend','OPTIONAL','P6§7.3',null],
    [49,'Return autocorrelation','L5',1,0,'Trend','OPTIONAL','P6§7.2',null],
    [50,'Regime cluster','L5',1,0,'Trend','OPTIONAL','S56','p8cluster'],
    [51,'Kalman trend','L5',1,1,'Trend','OPTIONAL','EMA vote',null],
    [52,'HMM regime','L5',1,0,'Trend','OPTIONAL','vs cluster',null],
    [53,'TSMOM CTA','L4',1,0,'Trend','OPTIONAL','position overlay',null],
    [54,'RSI 14','L1',1,1,'Momentum','CORE','gate 14','rsidiv'],
    [55,'RSI divergence','L2',1,1,'Momentum','CORE','P2§2.4','rsidiv'],
    [56,'Stochastic','L1',1,1,'Momentum','REDUNDANT','RSI',null],
    [57,'Stochastic RSI','L1',0,1,'Momentum','REDUNDANT','RSI',null],
    [58,'CCI','L1',1,1,'Momentum','REDUNDANT','RSI',null],
    [59,'Williams %R','L1',0,1,'Momentum','REDUNDANT','RSI',null],
    [60,'ROC / Momentum','L1',1,0,'Momentum','REDUNDANT','RSI',null],
    [61,'MFI','L2',1,1,'Momentum','REDUNDANT','RSI+CVD',null],
    [62,'Ultimate Oscillator','L2',1,0,'Momentum','REDUNDANT','RSI',null],
    [63,'Awesome Oscillator','L2',1,0,'Momentum','REDUNDANT','RSI',null],
    [64,'TSI','L2',1,0,'Momentum','REDUNDANT','RSI',null],
    [65,'Fisher Transform','L2',0,1,'Momentum','REDUNDANT','RSI',null],
    [66,'Connors RSI','L3',0,1,'Momentum','OPTIONAL','scalp MR only','catcrsi'],
    [67,'DeMarker / TD Sequential','L2',1,0,'Momentum','NON_FALSIFIABLE','—',null],
    [68,'TRIX/PPO/Chande/STC/RVI','L2',1,0,'Momentum','REDUNDANT','RSI',null],
    [69,'TTM squeeze momentum','L2',1,1,'Momentum','REDUNDANT','BB+RSI',null],
    [70,'Wave Trend / Elder','L2',1,0,'Momentum','REDUNDANT','RSI',null],
    [71,'Delta divergence BVC','L3',1,1,'Flow','CORE','S49','p8bvc'],
    [72,'ATR 14','L1',1,1,'Volatility','CORE','gate 10',null],
    [73,'ATR regime 14/50','L2',1,0,'Volatility','CORE','P2§2.5',null],
    [74,'ADR 10 + used %','L2',1,1,'Volatility','CORE','S14','adrfade'],
    [75,'AWR','L2',1,0,'Volatility','OPTIONAL','S7 runners','catawr'],
    [76,'Bollinger 20,2','L1',1,1,'Volatility','CORE','squeeze ctx',null],
    [77,'BB / TTM squeeze','L2',1,1,'Volatility','CORE','S12','p4nr7'],
    [78,'Keltner 20','L1',1,1,'Volatility','REDUNDANT','BB squeeze',null],
    [79,'Donchian width','L2',1,0,'Volatility','REDUNDANT','ADR',null],
    [80,'NR4 / NR7 / inside','L2',1,0,'Volatility','CORE','S12','p4nr7'],
    [81,'HV 20 realized','L2',1,0,'Volatility','CORE','P5§4.3',null],
    [82,'Parkinson / GK / YZ','L4',1,0,'Volatility','OPTIONAL','P5§4.5',null],
    [83,'GVZ','L3',1,0,'Volatility','CORE','P2§2.5',null],
    [84,'GVZ expected move','L4',1,1,'Volatility','CORE','S21',null],
    [85,'Implied − realized','L4',1,0,'Volatility','OPTIONAL','P5§4.3',null],
    [86,'Vol term structure','L4',1,0,'Volatility','OPTIONAL','S57','p8term'],
    [87,'GVZ / VIX ratio','L4',1,0,'Volatility','OPTIONAL','regime colour',null],
    [88,'Choppiness Index','L2',1,1,'Trend','REDUNDANT','KER',null],
    [89,'Mass Index / Chaikin vol','L2',1,0,'Volatility','REDUNDANT','ATR',null],
    [90,'Close z-score 20','L3',1,0,'Volatility','OPTIONAL','S33','p6zfade'],
    [91,'Hourly range p80','L4',1,1,'Time','CORE','P6§2.2',null],
    [92,'Session-range percentile','L3',1,0,'Volatility','OPTIONAL','P4§5.3',null],
    [93,'VPIN spike','L5',1,1,'Flow','OPTIONAL','S50','p8vpin'],
    [94,'Raw volume / MA','L1',1,1,'Flow','CORE','input',null],
    [95,'RVOL','L2',1,1,'Flow','CORE','P4§2.3',null],
    [96,'OBV','L1',1,0,'Flow','REDUNDANT','CVD',null],
    [97,'A/D / CMF / Chaikin','L1',1,0,'Flow','REDUNDANT','CVD',null],
    [98,'Klinger / Force / EOM…','L2',1,0,'Flow','REDUNDANT','CVD',null],
    [99,'VWMA','L1',1,1,'Flow','REDUNDANT','VWAP',null],
    [100,'Session VWAP ±σ','L2',1,1,'Flow','CORE','S22','p5vwap'],
    [101,'Anchored VWAP','L3',1,0,'Flow','CORE','gate 16','vwap'],
    [102,'VP fixed range','L3',1,1,'Flow','CORE','Playbook','vpbook'],
    [103,'VP session / dPOC','L3',1,1,'Flow','CORE','S3','hvn'],
    [104,'VP composite','L3',1,0,'Flow','CORE','Tier 1','vpbook'],
    [105,'VP visible range','L2',0,0,'Flow','AVOID','scroll-dependent',null],
    [106,'Session composites','L4',1,0,'Flow','OPTIONAL','S30','p6comp'],
    [107,'Naked POC / LVN','L3',1,0,'Flow','CORE','S2','hvn'],
    [108,'Market Profile TPO','L3',1,0,'Structure','OPTIONAL','S5/S15','p4poor'],
    [109,'Value Area 80%','L3',1,0,'Flow','CORE','S1','hvn'],
    [110,'Footprint','L3',1,1,'Flow','CORE','P4§2.1',null],
    [111,'CVD','L3',1,1,'Flow','CORE','gate 13',null],
    [112,'BVC → CVD proxy','L5',1,1,'Flow','CORE','S49','p8bvc'],
    [113,'Stacked imbalances','L3',1,1,'Flow','OPTIONAL','P4§2.2',null],
    [114,'Absorption / initiative','L3',1,1,'Flow','CORE','S16',null],
    [115,'Volume climax','L3',1,0,'Flow','OPTIONAL','P5§5',null],
    [116,'Open interest','L2',1,0,'Positioning','CORE','P2§2.1','oitrap'],
    [117,'Perp liquidations','L3',1,1,'Flow','OPTIONAL','pools','liqsweep'],
    [118,'DOM / heatmap','L4',1,1,'Flow','OPTIONAL','S34',null],
    [119,'L2 OFI','L5',0,1,'Flow','OPTIONAL','institutional',null],
    [120,'VPIN','L5',1,1,'Flow','OPTIONAL','S50','p8vpin'],
    [121,'Amihud / Kyle-λ','L5',1,1,'Flow','OPTIONAL','S55','p8illiq'],
    [122,'Tape speed','L4',0,1,'Flow','OPTIONAL','scalp flag','cattape'],
    [123,'Info-driven bars','L5',1,1,'Structure','OPTIONAL','S62','p9volbar'],
    [124,'COT legacy','L2',1,0,'Positioning','REDUNDANT','#125',null],
    [125,'COT managed-money','L3',1,0,'Positioning','CORE','P2§2.6',null],
    [126,'COT index / PM net','L3',1,0,'Positioning','OPTIONAL','same vote',null],
    [127,'Perp funding rate','L2',1,1,'Positioning','CORE','S63/S64','p9fund'],
    [128,'Perp premium','L3',1,1,'Positioning','OPTIONAL','S65','p9prem'],
    [129,'L/S account ratio','L2',1,1,'Positioning','OPTIONAL','weak ctx',null],
    [130,'Options OI walls','L3',1,0,'Positioning','OPTIONAL','S26',null],
    [131,'Put/call ratio','L3',1,0,'Positioning','OPTIONAL','P6§4',null],
    [132,'25Δ risk reversal','L4',1,0,'Positioning','OPTIONAL','S31',null],
    [133,'ETF flows GLD/IAU','L3',1,0,'Positioning','OPTIONAL','P4§6.3',null],
    [134,'Gold/silver ratio','L2',1,0,'Positioning','OPTIONAL','S43','p7ratio'],
    [135,'Shanghai premium','L4',1,0,'Positioning','CORE','S28',null],
    [136,'Indian premium','L4',1,0,'Positioning','CORE','S28',null],
    [137,'COMEX registered','L4',1,0,'Positioning','OPTIONAL','P5§2.3',null],
    [138,'EFP spread','L4',1,0,'Positioning','OPTIONAL','P5§2.4',null],
    [139,'Lease / GOFO / fwd','L5',1,0,'Positioning','OPTIONAL','physical desk',null],
    [140,'CB purchase trend','L4',1,0,'Positioning','CORE','P5§2.5',null],
    [141,'MCX OI / k','L4',1,0,'Positioning','OPTIONAL','P7§1.2',null],
    [142,'Retail sentiment','L1',1,0,'Positioning','OPTIONAL','never adjuster',null],
    [143,'Bank participation','L5',1,0,'Positioning','OPTIONAL','COT vote',null],
    [144,'Calendar tiers','L1',1,1,'Macro','CORE','gate 7',null],
    [145,'DXY','L1',1,1,'Macro','CORE','S36','p6smt'],
    [146,'10Y real yield','L2',1,0,'Macro','CORE','regime',null],
    [147,'10Y / 2Y nominal','L2',1,0,'Macro','OPTIONAL','P5§3',null],
    [148,'10Y breakevens','L3',1,0,'Macro','OPTIONAL','—',null],
    [149,'FedWatch path','L3',1,0,'Macro','OPTIONAL','T1 if Δ≥0.5',null],
    [150,'Gold–SPX corr','L3',1,0,'Macro','OPTIONAL','P6§6.1',null],
    [151,'Gold–BTC corr','L3',1,0,'Portfolio','CORE','S32',null],
    [152,'Gold vs JPY/oil/Cu','L3',1,0,'Macro','OPTIONAL','colour',null],
    [153,'Silver confirmation','L2',1,1,'Macro','OPTIONAL','S13',null],
    [154,'GDX relative strength','L3',1,0,'Macro','OPTIONAL','P4§7',null],
    [155,'XAUEUR/JPY/INR/CNH','L2',1,0,'Macro','OPTIONAL','P4§7',null],
    [156,'Macro residual','L5',1,0,'Macro','OPTIONAL','S51','p8resid'],
    [157,'GPR index','L4',1,0,'Macro','OPTIONAL','S53','p8geo'],
    [158,'EPU index','L4',1,0,'Macro','REDUNDANT','GPR',null],
    [159,'News-intensity z','L4',1,1,'Macro','OPTIONAL','P8§7','p8geo'],
    [160,'Seasonality','L1',1,0,'Macro','OPTIONAL','S48','p7season'],
    [161,'SHFE / SGE night','L3',1,0,'Time','OPTIONAL','Asia profile',null],
    [162,'UST / TGA / Fed BS','L4',1,0,'Macro','OPTIONAL','position ctx',null],
    [163,'Session windows','L1',1,1,'Time','CORE','gate 7',null],
    [164,'Kill zones / Silver Bullet','L2',1,1,'Time','CORE','#163','silverb'],
    [165,'LBMA AM/PM fix','L2',1,1,'Time','OPTIONAL','S8',null],
    [166,'Funding timestamps','L2',1,1,'Time','CORE','S63','p9fund'],
    [167,'OG options expiry','L3',1,0,'Time','OPTIONAL','S26',null],
    [168,'Hour-of-day H/L','L4',1,1,'Time','CORE','S29',null],
    [169,'Day-of-week stats','L3',1,0,'Time','OPTIONAL','ctx',null],
    [170,'NY Initial Balance','L3',1,1,'Structure','OPTIONAL','S5','openrange'],
    [171,'Opening range 15/30','L1',0,1,'Time','OPTIONAL','S5 scalp','openrange'],
    [172,'Event-week templates','L4',1,1,'Macro','OPTIONAL','S35',null],
    [173,'KER/Hurst/ACF/cluster','L5',1,0,'Trend','OPTIONAL','A2',null],
    [174,'Bootstrap / MC DD','L5',0,0,'Validation','CORE','S61','p9boot'],
    [175,'Wald SPRT','L5',0,0,'Validation','CORE','S60','p9sprt'],
    [176,'Bayesian gate audit','L5',0,0,'Validation','CORE','S58','p8bayes'],
    [177,'Walk-forward','L5',0,0,'Validation','CORE','P3§6',null],
    [178,'Permutation test','L5',0,0,'Validation','OPTIONAL','—',null],
    [179,'Triple-barrier / meta-label','L5',0,0,'Validation','OPTIONAL','S46','p7exit'],
    [180,'PDI','L4',1,1,'Trader','CORE','S59','p9tilt'],
    [181,'LAT','L4',1,1,'Trader','CORE','S59','p9tilt'],
    [182,'RVG','L4',1,1,'Trader','CORE','S59','p9tilt'],
    [183,'LOAD','L4',1,1,'Trader','CORE','S59','p9tilt'],
    [184,'OVR','L4',1,1,'Trader','CORE','S59','p9tilt']
  ];

  /* Beginner/intermediate strategies → playbook upgrade (never lead as L1). */
  var STRAT = [
    [1,'MA pullback','Sw','S3','UPGRADE','ribbon'],
    [2,'50/200 golden cross','Sw','POC bias','CONTEXT',null],
    [3,'S/R bounce','Sw','S0','UPGRADE','sweep'],
    [4,'PDH/PDL breakout','Sw','S4/S12','UPGRADE','openrange'],
    [5,'RSI 30/70 reversion','Sw','S33/S21','UPGRADE','rsidiv'],
    [6,'Bollinger bounce','Sw','S22','UPGRADE','p5vwap'],
    [7,'Donchian Turtle follow','Sw','inverse S20','TEST_BOTH','p5turt'],
    [8,'NR7 breakout','Sw','S12','CORE','p4nr7'],
    [9,'ATR trail follow','Sw','E3','COMPARE',null],
    [10,'Trendline break-retest','Sw','breaker','UPGRADE','ob'],
    [11,'H&S / double / flag','Sw','S0/S12','UPGRADE','sweep'],
    [12,'Gap fill','Sw','S11','OPTIONAL','p4gap'],
    [13,'EMA 9/21 cross 5m','Sc','—','AVOID',null],
    [14,'ORB 15/30 NY','Sc','S5','UPGRADE','openrange'],
    [15,'VWAP bounce','Sc','s1/s7','UPGRADE','vwap'],
    [16,'Stoch/RSI cross 5m','Sc','—','AVOID',null],
    [17,'Pivot S1/R1 bounce','Sc','VAH/VAL','REDUNDANT',null],
    [18,'Asia break at London','Sc','S0 trap','UPGRADE','asian'],
    [19,'News straddle','Sc','—','AVOID',null],
    [20,'LBMA fix scalp','Sc','S8','OPTIONAL',null]
  ];

  var EXCLUDE = [
    ['Elliott / harmonics / Gann / astro / TD Sequential counts','NON_FALSIFIABLE — cannot be a TRUE/FALSE gate'],
    ['Martingale / grid / average-down without structural stop','violates fixed-risk + drawdown ladder'],
    ['Signal services / confluence-score / AI confidence %','circular re-weight of counted votes'],
    ['News straddles / two-sided pendings','Playbook lockout window'],
    ['Fixed-leverage rules (always 20×)','leverage is an output of risk÷stop'],
    ['Win-rate claims before 100 resolved rows','journal has not earned it']
  ];

  var UPGRADE = {
    ribbon: 'S3 developing-POC pullback — keep EMA slope as bias only',
    asian: 'S0 AMD sweep — Asia break at London is the manipulation leg unless 2 closes accept',
    openrange: 'S5 IB extension — require RVOL + news check; two-close acceptance',
    rsidiv: 'gate 14 confirm — RSI <30 with higher lows is a veto, not a buy',
    vwap: 'scalp s1/s7 location — still needs sweep + CVD',
    fvg: 'S6 refine inside OB — FVG alone is not ENTER'
  };

  var OG_KIND = {
    'SPRING':'S19', 'UTAD':'S19', 'PO3':'S0', 'KZ-JUDAS':'S0',
    'PDH-SWEEP':'S0', 'PDL-SWEEP':'S0', 'PWH-SWEEP':'S0', 'PWL-SWEEP':'S0',
    'EQH-SWEEP':'S0', 'EQL-SWEEP':'S0', 'P5-WYCK':'S19', 'P5-TURT':'S20',
    'P8-RANGE':'S52', 'P9-VOLBAR':'S62', 'P9-PREM':'S65',
    'P5-VWAP':'S22', 'P4-NR7':'S12', 'P4-ADRX':'S14', 'P4-LAF':'S17',
    'P6-SMT':'S36', 'P6-FAIL':'S37', 'P6-ZFADE':'S33', 'P6-COMP':'S30',
    'P7-RATIO':'S43', 'P8-RESID':'S51', 'P8-GEO':'S53', 'P8-VPINBO':'S54',
    'ORB':'S5', 'FVG-FILL':'S6', 'ASIA-BREAK':'S0'
  };

  function recOf(row){
    return {
      id: row[0], name: row[1], lvl: row[2], sw: !!row[3], sc: !!row[4],
      family: row[5], verdict: row[6], sRef: row[7], wire: row[8]
    };
  }

  function catalogIndicators(){
    var out = [], i;
    for (i = 0; i < I.length; i++) out.push(recOf(I[i]));
    return out;
  }

  function catalogWireMap(){
    var m = {}, i, r;
    for (i = 0; i < I.length; i++){
      r = recOf(I[i]);
      if (r.wire) {
        if (!m[r.wire]) m[r.wire] = r;
        else if (r.verdict === 'CORE' && m[r.wire].verdict !== 'CORE') m[r.wire] = r;
        else if (r.verdict === 'CORE' && m[r.wire].verdict === 'CORE'
          && isLiveSetRef(r.sRef) && !isLiveSetRef(m[r.wire].sRef)) m[r.wire] = r;
      }
    }
    return m;
  }

  function catalogFamilyVotes(){
    var fam = {}, i, r, f;
    for (i = 0; i < I.length; i++){
      r = recOf(I[i]);
      f = r.family;
      if (!fam[f]) fam[f] = { family: f, core: 0, optional: 0, redundant: 0, excluded: 0, wires: {} };
      if (r.verdict === 'CORE' || r.verdict.indexOf('CORE') === 0) fam[f].core++;
      else if (r.verdict === 'OPTIONAL') fam[f].optional++;
      else if (r.verdict === 'REDUNDANT') fam[f].redundant++;
      else fam[f].excluded++;
      if (r.wire && (r.verdict === 'CORE' || r.verdict === 'OPTIONAL'))
        fam[f].wires[r.wire] = 1;
    }
    return fam;
  }

  function isLiveSetRef(s){
    if (!s) return false;
    var i;
    for (i = 0; i < HG_GOLD_CATALOG_LIVE.length; i++)
      if (s.indexOf(HG_GOLD_CATALOG_LIVE[i]) === 0) return true;
    return false;
  }

  function hgGoldCatalogLinreg(rows, n){
    var out = { ok: false, slope: NaN, why: '' };
    try{
      n = n || 50;
      rows = rows || [];
      if (rows.length < n){ out.why = 'CAT linreg need ≥' + n + ' bars'; return out; }
      var slice = rows.slice(-n), i, sx = 0, sy = 0, sxx = 0, sxy = 0, c;
      for (i = 0; i < slice.length; i++){
        c = +slice[i].c;
        if (!isFinite(c)) continue;
        sx += i; sy += c; sxx += i * i; sxy += i * c;
      }
      var den = n * sxx - sx * sx;
      out.slope = den ? (n * sxy - sx * sy) / den : 0;
      out.ok = true;
      out.why = 'CAT #44 linreg slope ' + out.slope.toFixed(4)
        + ' · OPTIONAL Trend (same vote as EMA — frame only)';
      return out;
    }catch(e){ out.why = 'CAT linreg error'; return out; }
  }

  function _rsi(closes, len){
    if (!closes || closes.length <= len) return NaN;
    var g = 0, l = 0, i;
    for (i = closes.length - len; i < closes.length; i++){
      var d = closes[i] - closes[i - 1];
      if (d >= 0) g += d; else l -= d;
    }
    if (l === 0) return 100;
    var rs = g / l;
    return 100 - 100 / (1 + rs);
  }

  function hgGoldCatalogConnorsRsi(rows){
    var out = { ok: false, crsi: NaN, why: '' };
    try{
      rows = rows || [];
      if (rows.length < 40){ out.why = 'CAT Connors RSI need bars'; return out; }
      var closes = rows.map(function(r){ return +r.c; });
      var rsi3 = _rsi(closes, 3);
      var streak = 0, i;
      for (i = closes.length - 1; i > 0 && streak < 20; i--){
        if (closes[i] > closes[i - 1]) { if (streak < 0) break; streak++; }
        else if (closes[i] < closes[i - 1]) { if (streak > 0) break; streak--; }
        else break;
      }
      var rsiStreak = 50 + Math.max(-50, Math.min(50, streak * 10));
      out.crsi = isFinite(rsi3) ? (rsi3 + rsiStreak) / 2 : NaN;
      out.ok = isFinite(out.crsi);
      out.why = 'CAT #66 Connors RSI ' + (out.ok ? out.crsi.toFixed(1) : '—')
        + ' · OPTIONAL Momentum — frame only, never both with RSI as trigger';
      return out;
    }catch(e){ out.why = 'CAT crsi error'; return out; }
  }

  function hgGoldCatalogAwr(rows){
    var out = { ok: false, awr: NaN, why: '' };
    try{
      rows = rows || [];
      if (rows.length < 30){ out.why = 'CAT AWR unread'; return out; }
      var i, s = 0, n = 0;
      for (i = Math.max(0, rows.length - 50); i < rows.length; i++){
        if (isFinite(rows[i].h) && isFinite(rows[i].l)){ s += rows[i].h - rows[i].l; n++; }
      }
      if (!n){ out.why = 'CAT AWR no ranges'; return out; }
      out.awr = (s / n) * 5;
      out.ok = true;
      out.why = 'CAT #75 AWR≈' + out.awr.toFixed(2) + ' · OPTIONAL runner context';
      return out;
    }catch(e){ out.why = 'CAT AWR error'; return out; }
  }

  function hgGoldCatalogEngine(rows, opts){
    var out = {
      ok: true, ver: HG_GOLD_CATALOG_VER, nInd: I.length, nStrat: STRAT.length,
      live: HG_GOLD_CATALOG_LIVE.slice(), sched: HG_GOLD_CATALOG_SCHED.slice(),
      rules: HG_GOLD_CATALOG_RULES.slice(), families: catalogFamilyVotes(),
      core: 0, optional: 0, redundant: 0, excluded: 0,
      linreg: null, crsi: null, awr: null, strategies: [], unchecked: [], why: ''
    };
    try{
      opts = opts || {};
      var i, r;
      for (i = 0; i < I.length; i++){
        r = recOf(I[i]);
        if (r.verdict === 'CORE') out.core++;
        else if (r.verdict === 'OPTIONAL') out.optional++;
        else if (r.verdict === 'REDUNDANT') out.redundant++;
        else out.excluded++;
      }
      if (rows && rows.length >= 40){
        out.linreg = hgGoldCatalogLinreg(rows, 50);
        out.crsi = hgGoldCatalogConnorsRsi(rows);
        out.awr = hgGoldCatalogAwr(rows);
      } else {
        out.unchecked.push('price bars for OPTIONAL frames');
      }
      function pushS(key, grade, why){
        out.strategies.push({ key: key, dir: null, grade: grade, why: why, level: NaN });
      }
      pushS('catlive', 'frame',
        'LIVE SET S0 · S19 · S20 · schedulers ' + HG_GOLD_CATALOG_SCHED.join('/')
          + ' · rules ' + HG_GOLD_CATALOG_RULES.join('/')
          + ' — everything else disabled as LEAD until SPRT or 100-row cap');
      pushS('catvote', 'frame',
        'one vote per family · ' + out.core + ' CORE · ' + out.optional
          + ' OPTIONAL · ' + out.redundant + ' REDUNDANT · ' + out.excluded + ' excluded');
      if (out.linreg && out.linreg.ok) pushS('catlinreg', 'frame', out.linreg.why);
      if (out.crsi && out.crsi.ok) pushS('catcrsi', 'frame', out.crsi.why);
      if (out.awr && out.awr.ok) pushS('catawr', 'frame', out.awr.why);
      out.why = 'Master Catalog v' + HG_GOLD_CATALOG_VER + ' · ' + I.length
        + ' indicators · ' + STRAT.length + ' L1 maps · freeze S66';
      return out;
    }catch(e){ out.ok = false; out.why = 'catalog engine error'; return out; }
  }

  function lookupWire(key, kind){
    var map = catalogWireMap();
    if (key && map[key]) return map[key];
    if (kind && OG_KIND[kind]){
      var s = OG_KIND[kind], i, r;
      for (i = 0; i < I.length; i++){
        r = recOf(I[i]);
        if (r.sRef && r.sRef.indexOf(s) >= 0 && r.verdict === 'CORE') return r;
      }
    }
    return null;
  }

  /** Permission/size/lead only. Never flips dir. Never invents ENTER. */
  function hgGoldCatalogApplyVerdict(cand, cat){
    try{
      if (!cand) return cand;
      if (!Array.isArray(cand.stamps)) cand.stamps = [];
      var rec = lookupWire(cand.stratKey, cand.kind);
      var up = UPGRADE[cand.stratKey];
      if (up && cand.stamps.indexOf('CATALOG UPGRADE') < 0){
        cand.stamps.push('CATALOG UPGRADE');
        var gn = Array.isArray(cand.gateNotes) ? cand.gateNotes.slice() : [];
        gn.push(up);
        cand.gateNotes = gn;
      }
      if (!rec) return cand;
      cand.catalogVerdict = rec.verdict;
      cand.catalogFamily = rec.family;
      cand.catalogId = rec.id;
      if (rec.verdict === 'REDUNDANT' || rec.verdict === 'NON_FALSIFIABLE' || rec.verdict === 'AVOID'){
        cand.demoted = true;
        cand.catalogExclude = true;
        if (cand.stamps.indexOf('CATALOG ' + rec.verdict) < 0)
          cand.stamps.push('CATALOG ' + rec.verdict);
        return cand;
      }
      if (isLiveSetRef(rec.sRef) && cand.stamps.indexOf('CATALOG LIVE') < 0)
        cand.stamps.push('CATALOG LIVE');
      if (rec.verdict === 'OPTIONAL' && cand.stamps.indexOf('CATALOG OPTIONAL') < 0)
        cand.stamps.push('CATALOG OPTIONAL');
      if (cat && cat.linreg && cat.linreg.ok && cand.stamps.indexOf('CAT #44 LINREG') < 0)
        cand.stamps.push('CAT #44 LINREG');
      return cand;
    }catch(e){ return cand; }
  }

  function hgGoldCatalogHtml(cat){
    try{
      if (!cat || !cat.ok) return '';
      var h = '<div class="note" data-hg-gold-catalog="1" style="margin-top:8px">';
      h += '<b>GOLD MASTER CATALOG v' + String(cat.ver || '1.0') + '</b>';
      h += ' · ' + cat.nInd + ' indicators · ' + cat.nStrat + ' L1 maps';
      h += ' · CORE ' + cat.core + ' · OPT ' + cat.optional
        + ' · REDUN ' + cat.redundant + ' · EXCL ' + cat.excluded;
      h += '<div class="dim" style="margin-top:2px">LIVE SET '
        + (cat.live || []).join(' · ')
        + ' · schedulers ' + (cat.sched || []).join('/')
        + ' · rules ' + (cat.rules || []).join('/')
        + ' — one vote per family — REDUNDANT / NON-FALSIFIABLE never ENTER</div>';
      var fams = Object.keys(cat.families || {}), i, f;
      if (fams.length){
        h += '<div class="dim" style="margin-top:4px">';
        for (i = 0; i < fams.length; i++){
          f = cat.families[fams[i]];
          h += (i ? ' · ' : '') + fams[i] + ' ' + f.core + 'C/' + f.optional + 'O';
        }
        h += '</div>';
      }
      var n = Math.min(6, (cat.strategies || []).length);
      for (i = 0; i < n; i++){
        var s = cat.strategies[i];
        h += '<div style="margin-top:3px"><b>' + String(s.key).toUpperCase() + '</b>'
          + (s.grade ? (' · ' + s.grade) : '')
          + ' — ' + String(s.why || '').replace(/[<>&]/g, '') + '</div>';
      }
      h += '<div class="dim" style="margin-top:4px">Excluded: Elliott/harmonics/Gann · martingale/grid · '
        + 'signal-service confluence % · news straddles · fixed leverage · win-rate before 100 rows</div>';
      if (cat.why) h += '<div class="dim" style="margin-top:2px">' + String(cat.why).replace(/[<>&]/g, '') + '</div>';
      h += '</div>';
      return h;
    }catch(e){ return ''; }
  }

  W.HG_GOLD_CATALOG_VER = HG_GOLD_CATALOG_VER;
  W.HG_GOLD_CATALOG_LIVE = HG_GOLD_CATALOG_LIVE;
  W.HG_GOLD_CATALOG_SCHED = HG_GOLD_CATALOG_SCHED;
  W.HG_GOLD_CATALOG_RULES = HG_GOLD_CATALOG_RULES;
  W.HG_GOLD_CATALOG_IND = I;
  W.HG_GOLD_CATALOG_STRAT = STRAT;
  W.HG_GOLD_CATALOG_EXCLUDE = EXCLUDE;
  W.hgGoldCatalogIndicators = catalogIndicators;
  W.hgGoldCatalogWireMap = catalogWireMap;
  W.hgGoldCatalogFamilyVotes = catalogFamilyVotes;
  W.hgGoldCatalogLinreg = hgGoldCatalogLinreg;
  W.hgGoldCatalogConnorsRsi = hgGoldCatalogConnorsRsi;
  W.hgGoldCatalogAwr = hgGoldCatalogAwr;
  W.hgGoldCatalogEngine = hgGoldCatalogEngine;
  W.hgGoldCatalogApplyVerdict = hgGoldCatalogApplyVerdict;
  W.hgGoldCatalogHtml = hgGoldCatalogHtml;
})(typeof window !== 'undefined' ? window : globalThis);
