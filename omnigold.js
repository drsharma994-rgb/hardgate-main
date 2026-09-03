/* =========================================================================
HARDGATE — omnigold.js
OMNIGOLD — gold desk setups, SCALP and SWING, on the OmniRoute engine.

WHAT THIS IS. OMNIROUTE's method (mechanical detectors → hard-gate ledger →
walk-forward self-measurement → evidence coverage) pointed at XAUUSD, with
the mechanics gold desks actually trade added on top. It answers one
question per horizon: "is there a gold setup right now whose geometry and
evidence both hold up, and has this mechanic ever paid?"

BUILT ON OMNIROUTE, NOT COPIED FROM IT. The detectors, walk-forward,
pooling, plan derivation, grading and ranking are consumed from
omniroute.js's exports (all feature-checked). A fix there — the isFinite(null)
trap, the stale-risk R:R, the forming-bar rule, the significance test —
lands here automatically. Duplicating that engine would have meant
duplicating its bugs.

GOLD TAPE IS GOLD, NOT THE CRYPTO CASCADE.
  STRONGEST / MOST PROBABLE / NEXT GOLD LEVELS / XM strongest follow
  gold's own bars (last vs EMA21 AND EMA21 vs EMA50). A 5-bar dip
  below EMA21 while the stack is still up is unread, not SHORT — that
  lie hid every LONG GOLD SCALP/SWING catalog setup on a rally
  (hg-v582). Each horizon's pick follows THAT horizon's tape. When
  scalp and swing disagree the desk tape is MIXED: the tab will not
  say "gold is going down" while 4h is up. No side is invented.
  Unread tape does not empty the desk. Crypto MARKET PICTURE is
  BTC/ETH/SOL/GOLD and is the wrong instrument for this call.

MOST PROBABLE SETUPS sit at the top of the tab: up to one SCALP and
  one SWING tape-aligned TICKET, ranked on a balanced score of
  independent mechanic families + indicator info-reads (ema-stack,
  rsi-zone, session-vwap, adx, hurst, …) + coverage + proximity +
  formationScore (hgOgFormTicket: named ENTRY locked, structure-wide
  stop clipped at 2.5% of gold, T1 at OG_T1_R of formed risk with the
  first gold magnet named beyond it).
  That score is not a win probability. Against-tape cards still
  render; they sink. Empty pick = stand aside.

TWO HORIZONS, MEASURED SEPARATELY.
  SCALP  1h bars. Session-driven: Asia range, London/NY killzones, ADR
         budget. Tighter R floor.
  SWING  4h bars, daily context. Structure and macro driven.
A mechanic that pays on the swing horizon need not pay intraday, so the two
pools are measured and reported apart — never merged into one flattering
number.

HOW MANY MECHANICS, AND WHERE THEY COME FROM. OG_MECHANICS is the single
source of truth and currently holds 55. Six are OmniRoute's, consumed from
its exports. Four are the classic gold desk setups described just below.
Thirty more were added in later rounds from the shared hg-mechanics library
and gold-specific session/structure work. The last fifteen come from
goldind.js and pinegoldmath.js — about ninety gold functions that were being
loaded on every scan while this desk called two of them. See the block above
hgOgIchiKumo for which of those ninety became mechanics, which stayed as
gates, and why: the dividing line is whether a read is a pure function of
bars, because the walk-forward replays over candle prefixes and anything
needing live depth or funding can never earn a record at all.

WHAT IS DELIBERATELY NOT WIRED, so nobody re-derives it:
  goldOpeningRange   its box is ONE hour and it needs two bars inside it.
                     This desk runs 1h and 4h bars, so the box holds one bar
                     or none and the function returns null on every scan.
                     Verified on both horizons; it needs 15m data to work.
  goldRangeBound     duplicates regime-fit, which already asks the same
                     family-aware question (a fade wants a ranging tape, a
                     continuation wants a trending one) off detectRegime.
  book / CVD /       calculateOrderBookImbalance, validateDomLiquidity,
  funding reads      validateOBWithCVD, evaluateFundingRate — none can be
                     replayed over candles, and spot gold has no funding at
                     all. Nothing on this desk pretends otherwise.

EVERY MECHANIC IS REGISTERED IN THREE PLACES — the live detect pass, the
walk-forward backtest map, and OG_MECHANICS. tests/test-omnigold-full-cover.mjs
fails the build if those three ever disagree, because each way of getting it
wrong fails silently: miss the backtest map and the measured-edge gate has
nothing to read; miss OG_MECHANICS and the record exists but never reaches
the card.

GOLD-SPECIFIC MECHANICS (added to OmniRoute's six):
  ASIA-BREAK   Asia-session range, then a London break holding beyond it —
               the most widely taught gold intraday setup there is.
  KZ-JUDAS     Asia range swept during a killzone, then reclaimed: the
               stop-run before the real move (ICT's gold variant).
  ADR-FADE     Day has already spent its average daily range and is pressing
               the extreme — fade the exhaustion.
  ROUND-MAGNET Gold respects round dollars far more than alts do; a rejection
               wick at a $10/$25/$50/$100 level with a close back inside.
  NY-OPEN-DRIVE London session box, then a NY-hour close through it.
  WEEKLY-OPEN  Wick through the weekly open, close back — gold's weekly magnet.
  PIVOT-REJECT Classic floor-trader S1/R1 rejection.
  INSIDE-BREAK Compression (inside bar) then a close beyond the parent.
  EMA50-HOLD   With-trend bounce that holds the 50 EMA.
  FIB-618      Bounce at 61.8 of the last swing.

  INDICATOR READS (info only — they do not veto, they do not invent a ticket):
  ema-stack · rsi-zone · session-vwap.

GOLD GATE LEDGER (deliberately NOT the crypto one — perp gates do not
exist here; there is no funding, OI, retail ratio or taker flow on spot
gold, and pretending otherwise would fabricate confluence):
  HARD          trend (family-aware), vol-alive
  CONDITIONAL   htf-daily · session/killzone · macro real-rate · DXY
                alignment · yield guard · ADR budget · news window ·
                participation · measured-edge
  SHARED        hgIndicatorGates (hg-gates.js) adds about eighteen more —
                ichimoku, stoch-rsi, cci-stretch, ema-ribbon, heikin-trend,
                donchian, keltner, macd, bollinger, volume-z and the rest —
                each asked whether it agrees with THIS direction
  GOLD-ONLY     premium-discount, the one gold read the shared set lacks
Nothing on this ledger reads the same indicator twice. That is a rule, not
an accident: a first attempt at a combined "indicator stack" tally was cut
because five of its six members were already gates in their own right, and
counting one reading twice inflates a ticket's check count without adding
any evidence behind it.
WHAT A GATE AUDIT FOUND, AND WHY ALMOST NOTHING WAS CHANGED. Every gate on
this ledger was split by its own verdict and resolved at the 2R where T1
sits, on 1,000 PAXG bars per horizon. On SCALP, ELEVEN gates read
"backwards" — the firings they rejected outperformed the ones they kept:
adx-trend -7.4, value-area -7.3, vol-alive -7.2, weekend-exposure -6.6,
adx-regime -6.3, obv-flow -6.1, squeeze-state -5.9, participation -5.4,
cci-stretch -4.3, premium-discount -4.0, trend -3.5 sigma.

That is not eleven broken gates. Look at what they have in common: every one
PASSES when the tape is active and FAILS when it is quiet. It is one effect
seen eleven ways — on 1h gold, a setup fired into confirmed activity does
worse, because by the time the indicators agree the move is largely spent.
Counting it eleven times would be counting one thing eleven times.

And most of it does not survive the second horizon. value-area is -7.3 on
SCALP and +4.9 on SWING. structure-shift is +8.1 on SCALP and -4.4 on SWING.
stoch-rsi is -2.8 and +4.2. A gate that reverses sign between horizons is
reading noise, not structure.

So the standard for touching a gate on evidence is: it must replicate on
BOTH horizons, past the family-wise bar, in the same direction. Exactly one
gate met it — participation, -5.4 on SCALP and -2.2 on SWING — and that is
the only one changed. The rest stand, including the ones that look worst on
a single horizon.

Three that EARN their keep on both horizons, for the record, since a ledger
is easier to distrust than to credit: regime-fit (+3.0 / +4.5),
htf-confirm (+3.3 / +5.5) and hurst-regime (+6.4 / +2.8). They are info
reads and were left as such — promoting them to vetoes on in-sample
evidence would be the same overfit in the opposite direction.

Participation is an INFO read here, unlike OmniRoute, for two reasons.
Several gold feeds publish no volume at all, and a hard volume gate would
silently disqualify every setup sourced from them. And on the feeds that DO
publish it, the gate was measured pointing the wrong way: splitting every
gold firing by its own verdict and resolving at 2R gave passed 27.7% against
vetoed 35.2% on SCALP (z -5.38) and 27.7% against 30.7% on SWING (z -2.19).
The bars it discarded outperformed the ones it kept, and it was discarding
38% of scalp firings to do it. A high-volume bar on a metal is often the move
already spent; on crypto it confirms a breakout. OmniRoute keeps it hard,
which is where that rule belongs. It is NOT inverted here — that would fit
the sign of one instrument's sample.

DATA. Same choke point as GOLD SCALP/SWING: getXAUCandles (index.html) —
XM XAUUSD → macro.js spot proxies → Delta XAUTUSD — with hgOgFetchRowsLegacy
only when that export is absent. Whichever answers is named on screen,
because a PAXG-derived setup is not the same instrument as XAUUSD spot and
the difference belongs in front of the user, not buried. Proxy feeds are
scaled to live spot (gold-api.com) before render, matching the gold tabs.

ON EDGE. Same discipline as OMNIROUTE: cards are ordered by evidence
coverage, the measured-edge gate vetoes a mechanic whose own history is
significantly below breakeven, and nothing here is a profit forecast. Gold
trends differently from alts — the measurement will say whether these
mechanics pay on YOUR feed, and that answer is the only edge claim made.

Classic script, IIFE. Never throws at load; every global is feature-checked;
every fetch carries a timeout. refresh() is async, never throws, returns a
terse status, and never launches a first-time scan on a global refresh.
========================================================================= */
'use strict';

(function(){

  var LS_KEY = 'hg_omnigold_v1';

  /* Horizon shapes. Bar counts are deliberately much larger than OmniRoute's. That scan
     pools its walk-forward across ~500 contracts; gold is ONE instrument, so
     the only way to reach a sample count worth reading is depth of history.
     At 180x4h the first live run returned 5-12 samples per mechanic on the
     swing horizon — every row read "too few to judge", which is an honest
     report of a useless measurement. Deeper history also makes the daily
     resample possible on the scalp horizon (1000x1h ~ 41 days, where 320x1h
     was 13 days and could not fill a 21-period daily EMA).
     minAtrPct is per-horizon because ATR% scales with the square root of bar
     length: holding 1h bars to a 4h threshold vetoed live setups as "too
     dead" that were merely intraday. */
  /* 1500 is the ceiling the data layer can actually deliver: getGoldCandles
     accepts up to 5000 but delegates to binanceKlines, which caps a single
     request at 1500 and offers no pagination. Taking all of it is free and
     it is the only lever left on sample count — 1500x1h is ~62 days,
     1500x4h ~250 days. The swing horizon gains most (3x), which is where
     nearly every row read "too few to judge". */
  /* WHERE T1 ACTUALLY SITS, and why it is not cfg.minRr.

     Two different numbers were being used as though they were one:

       cfg.minRr   an ACCEPTANCE FLOOR. The plan engine rejects any structure
                   whose reachable R:R falls below it. 1.5 on SCALP, 2.0 on
                   SWING.
       t1R         where T1 is PLACED. Hard-coded 2.0 on both horizons, on
                   both plan paths.

     The walk-forward, the pooled expectancy, the measured-edge breakeven and
     the forward panel were all keyed to cfg.minRr — so on SCALP the desk
     measured "did price reach 1.5R before the stop" and printed that number
     beside a ticket whose T1 is at 2.0R. Reaching 2R is strictly harder, so
     the card overstated its own plan.

     Measured on 1,000 hours of live PAXG bars: 39.9% at 1.5R against 30.9%
     at 2.0R — the headline hit rate was 9.0 points too generous. A survey of
     1,957 scalp plans and 1,838 swing plans found T1 at exactly 2.00R on
     100% of them, zero variance, so this is a constant and not an average.

     SWING never showed it because its floor happens to equal 2.0 — the same
     shape as the pooled-expectancy bug before it: wrong on one horizon,
     invisible on the other, and the wrong one trades more often.

     One constant now feeds BOTH the plan and every measurement of it, so
     they cannot drift apart again. cfg.minRr keeps its real job: the floor. */
  var OG_T1_R = 2;
  var OG_T2_R = 3.5;

  var HORIZONS = {
    scalp: { tf: '1h', bars: 1500, minRr: 1.5, horizonBars: 24, warm: 60, label: 'SCALP',
             minAtrPct: 0.05, sessionHard: true },
    swing: { tf: '4h', bars: 1500, minRr: 2.0, horizonBars: 20, warm: 45, label: 'SWING',
             minAtrPct: 0.12, sessionHard: false }
  };

  /* Assumed round-trip transaction cost in DOLLARS per ounce, used only to
     express what a stop distance costs to trade. Gold retail spreads run
     roughly $0.20-0.50 and widen off-hours; $0.30 is a middling, not a
     generous, assumption. This is the difference between a measured edge and
     a tradeable one: the walk-forward is GROSS, and on a 3-point scalp stop
     a $0.30 spread is ~19% of 1R. */
  var ASSUMED_SPREAD_USD = 0.30;
  var COST_WARN_R = 0.15;   // cost above this share of 1R is worth flagging
  var COST_VETO_R = 0.30;   // swing / unspecified — a wide stop can carry more drag
  var COST_VETO_R_SCALP = 0.15; // scalp: the live 3.16-pt stop was 19% of 1R paying the spread
  /* A lastSwing from a three-month rally is not a gold invalidation. 2.5% of
     XAUUSD is already a very wide swing stop; anything larger is a different
     instrument than the setup on the card. */
  var GOLD_STOP_MAX_PCT = 0.025;
  /* STRONGEST prefers a ticket whose named level is actually in reach.
     A 4H FVG 6×ATR behind the market is a real limit, not the trade to
     float first when a sweep 1.5×ATR away already has a ticket. */
  var GOLD_NEAR_ATR = 2;
  /* SETTLED EXECUTE — only promote setups whose cleared TICKETS have a
     measured forward win rate with Wilson 95% CI lower bound >= 95%.
     Requires enough settled out-of-sample tickets; most mechanics never
     reach this bar — the panel says so rather than inventing a number. */
  var OG_EXEC_MIN_N = 15;
  var OG_EXEC_WILSON_LO = 0.95;
  var OG_EXEC_WILSON_Z = 1.96;
  /* SCALP VERDICT — pooled settled TICKET record across gold desks.
     Wilson 95% lower ≥ 90% with enough settled trades. Lower bar than the
     95% execute tier; still requires real forward history, not in-sample. */
  var OG_SCALP_FWD_TABS = ['OMNIGOLD:SCALP', 'GOLDSCALP', 'SUPER:GOLD'];
  var OG_VERDICT_SCALP_LO = 0.90;
  var OG_VERDICT_MIN_N = 10;

  var FWD_MIN_JUDGE = 20;   // settled out-of-sample trades before it can conclude
  var MIN_SAMPLES = 20;
  var EDGE_VETO_Z = -2;
  var EDGE_VETO_SAMPLES = 30;
  var DAILY_FAST = 10, DAILY_SLOW = 21;
  /* THERE WERE THREE DEFINITIONS OF "REVERSION" AND THEY DISAGREED.

     A live card showed all three contradicting each other in eleven lines,
     on one mechanic:

       VETO    htf-daily      daily EMA10 >= EMA21 - disagrees with the setup
       PASS    regime-fit     a trending tape is what a CONTINUATION mechanic wants
       AGAINST hurst-regime   a REVERSION mechanic against a trending tape

     The mechanic was POC-REVERT. htf-daily and regime-fit read
     REVERSION_KINDS, a seven-name literal written before rounds two, three
     and four added their detectors; hurst-regime read a private regex. So
     VWAP-REVERT, POC-REVERT, RSI-DIVERGE and AVWAP-RECLAIM — mechanics whose
     whole job is fading a move — were judged as continuation trades and
     vetoed by htf-daily for disagreeing with the higher timeframe, which is
     the condition a fade REQUIRES. A mean-reversion setup that agrees with
     the daily trend is not a mean-reversion setup.

     One derivation now, from the family map consensus already uses, so it
     cannot drift again when a detector is added. A mechanic trades against
     the prevailing move if it is REVERSION (price is stretched, fade it) or
     SWEEP (liquidity taken and rejected). That is a strict superset of both
     old lists: every name in either is REVERSION or SWEEP. */
  function hgOgIsReversion(kind){
    var f = hgOgFamilyOf(kind);
    return f === 'REVERSION' || f === 'SWEEP';
  }

  /* Every mechanic this desk scans. ONE list: renderPooled shows these, and
     the measured-edge gate divides its significance threshold by this many,
     so the multiple-comparisons correction can never drift out of step with
     the number of mechanics actually being tried. Adding a detector without
     adding it here would understate the correction. */
  var OG_MECHANICS = ['SPRING','PO3','ORB','ABSORB','VALUE','MMOVE',
                      'ASIA-BREAK','KZ-JUDAS','ADR-FADE','ROUND-MAGNET',
                      'PDH-SWEEP','PDL-SWEEP','LONDON-FIX','VWAP-REVERT','NR7-BREAK',
                      'SMT-DIVERGE','TREND-RECLAIM',
                      'PWH-SWEEP','PWL-SWEEP','FVG-FILL','BOS-RETEST','EQH-SWEEP','EQL-SWEEP',
                      'SQUEEZE-FIRE','RSI-DIVERGE','GSR-EXTREME','AVWAP-RECLAIM',
                      'CUSUM-SHIFT','VOL-EXPANSION','PIN-REJECT','ENGULF-LEVEL',
                      'POC-REVERT','COINT-SPREAD','THREE-BAR',
                      'NY-OPEN-DRIVE','WEEKLY-OPEN','PIVOT-REJECT',
                      'INSIDE-BREAK','EMA50-HOLD','FIB-618',
                      /* round six — the goldind.js / pinegoldmath.js library,
                         which this desk had loaded on every scan and was using
                         two functions out of. See the block above hgOgIchiKumo
                         for why these and not the other eighty. */
                      'ICHI-KUMO','STOCHRSI-TURN','CCI-EXTREME','RIBBON-PULLBACK',
                      'HA-FLIP','VWAP-BAND','PD-EQUILIBRIUM','ER-IGNITION',
                      'STRUCT-BOS','SWEEP-V2','OB-RETEST','OU-REVERT',
                      'MFI-SQUAT','DI-CROSS','FVG-HVN','VP-PLAYBOOK',
                      /* Part4 S9–S18 live directional forming hits (S13/S16 unchecked) */
                      'P4-NR7','P4-ADRX','P4-LAF',
                      /* Part5 S19–S28 live directional (S21/S26 + physical feeds unchecked) */
                      'P5-WYCK','P5-TURT','P5-VWAP','P5-DRIVE','P5-NEWS',
                      /* Part6 S29–S38 live directional (S31/S34 unchecked without skew/DOM) */
                      'P6-COMP','P6-ZFADE','P6-SMT','P6-FAIL',
                      /* Part7 S39–S48 — separated scalp + ratio (S40 MCX-native; options frames) */
                      'P7-SCALP','P7-RATIO',
                      'P8-RESID','P8-RANGE','P8-GEO','P8-VPINBO',
                      'P9-VOLBAR','P9-PREM'];

  var __og = { ui: null, busy: false, ran: false, snap: null, lastStat: '', src: null, shared: null, btBusy: false,
               lastCardsHtml: null, lastPoolHtml: null, lastMpHtml: null,
               lastVerdictHtml: null, lastSettledExecHtml: null, lastCoverageHtml: null, lastGoldEnginesHtml: null,
               correlationRegime: null, lastRegimeUpdate: 0,
               rollingStats: null, topSetupView: null, lastRollingUpdate: 0,
               /* hg-v540: the ALL view's exact bytes + the inputs behind
                  them, so PAID-ONLY filters a snapshot and ALL restores
                  verbatim. */
               lastAllView: null, lastView: null };
  var OG_FRESH_MS = 180000;   /* tab-open / hardRefreshAll skip when scan is still fresh */

  function W(){ return (typeof window !== 'undefined') ? window : null; }
  function gfn(name){
    var w = W();
    return (w && typeof w[name] === 'function') ? w[name] : null;
  }
  function num(v){ var n = +v; return isFinite(n) ? n : NaN; }
  /* null/undefined/'' -> NaN. isFinite(null) is TRUE in JS; see omniroute. */
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  /* Directional yield read. The scan used to freeze validateYieldCorrelation
     against 'long' and reuse that verdict on every setup — so a short into
     falling yields was cleared by a long-side check. Prefer goldind's
     validator when loaded; otherwise the same last-vs-5-bars test. */
  function hgOgYieldValid(rows, dir){
    var fn = gfn('validateYieldCorrelation');
    if (fn){
      try {
        var r = fn(rows, dir);
        if (r && typeof r.valid === 'boolean') return r;
      } catch (e) {}
    }
    if (!rows || rows.length < 5) return null;
    var cur = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    var prior = fin(rows[rows.length - 5] && rows[rows.length - 5].c);
    if (!isFinite(cur) || !isFinite(prior)) return null;
    var d = String(dir || '').toLowerCase();
    if (d === 'long' && cur > prior)
      return { valid: false, reason: 'US10Y yields are rising — headwind for a gold long' };
    if (d === 'short' && cur < prior)
      return { valid: false, reason: 'US10Y yields are falling — headwind for a gold short' };
    return { valid: true, reason: 'yield move does not fight this direction' };
  }

  /* ==================== DXY-gold correlation regime detector ==================== */

  /* Fetch DXY daily closes from Binance USDT data (current day + last 30 days).
     Returns array of { t: timestamp_sec, c: close } or null on failure. */
  function hgOgFetchDxyData(){
    var w = W();
    var bkFn = gfn('binanceKlines');
    if (!bkFn) return Promise.resolve(null);
    return Promise.race([
      Promise.resolve().then(function(){
        return bkFn('DXYUSDT', '1d', 31);
      }).catch(function(){ return null; }),
      new Promise(function(rp){ setTimeout(function(){ rp(null); }, 5000); })
    ]).then(function(klines){
      if (!klines || !Array.isArray(klines)) return null;
      var out = [];
      for (var i = 0; i < klines.length; i++){
        var k = klines[i];
        if (!k || !isFinite(fin(k.t)) || !isFinite(fin(k.c))) continue;
        out.push({ t: Math.floor(fin(k.t) / 1000), c: fin(k.c) });
      }
      return out.length >= 5 ? out : null;
    }).catch(function(){ return null; });
  }

  /* Calculate rolling correlation: gold 4h close vs DXY daily close (lagged 1 day).
     goldRows: array of { t, c }, dxyRows: array of { t, c }.
     Returns { correlation, beta, sampleCount } or null. */
  function hgOgCalculateCorrelation(goldRows, dxyRows){
    if (!goldRows || !goldRows.length || !dxyRows || !dxyRows.length) return null;
    var goldCloses = [], dxyCloses = [], i, j, g, d, gIdx;
    /* Gold 4h: align to daily close times. DXY is daily, so we match gold
       daily closes (23:00 UTC start of next day) against DXY close (00:00 UTC). */
    for (i = 0; i < Math.min(goldRows.length, 30); i++){
      g = goldRows[i];
      if (!isFinite(fin(g.c))) continue;
      var gTime = fin(g.t);
      if (!isFinite(gTime)) continue;
      var gDayStart = Math.floor(gTime / 86400) * 86400;
      var dxyFound = null;
      /* Find DXY from same day (within a day window) */
      for (j = 0; j < dxyRows.length; j++){
        d = dxyRows[j];
        if (!isFinite(fin(d.c))) continue;
        var dTime = fin(d.t);
        if (!isFinite(dTime)) continue;
        var dDayStart = Math.floor(dTime / 86400) * 86400;
        /* Match same calendar day or previous day (lagged 1 day) */
        if (dDayStart === gDayStart || dDayStart === gDayStart - 86400){
          dxyFound = d;
          break;
        }
      }
      if (dxyFound && isFinite(fin(dxyFound.c))){
        goldCloses.push(fin(g.c));
        dxyCloses.push(fin(dxyFound.c));
      }
    }
    if (goldCloses.length < 5) return null;
    /* Pearson correlation */
    var n = goldCloses.length, sumG = 0, sumD = 0, sumGD = 0, sumG2 = 0, sumD2 = 0;
    for (i = 0; i < n; i++){
      sumG += goldCloses[i];
      sumD += dxyCloses[i];
      sumGD += goldCloses[i] * dxyCloses[i];
      sumG2 += goldCloses[i] * goldCloses[i];
      sumD2 += dxyCloses[i] * dxyCloses[i];
    }
    var num = n * sumGD - sumG * sumD;
    var den = Math.sqrt((n * sumG2 - sumG * sumG) * (n * sumD2 - sumD * sumD));
    var corr = den > 0 ? num / den : 0;
    /* Beta: gold return per 1% DXY move. When DXY up 1%, gold down ~-0.9 is "normal". */
    var betaNum = n * sumGD - sumG * sumD;
    var betaDen = n * sumD2 - sumD * sumD;
    var beta = betaDen > 0 ? betaNum / betaDen : NaN;
    return { correlation: isFinite(corr) ? corr : 0, beta: isFinite(beta) ? beta : 0, sampleCount: n };
  }

  /* Compute real rate: 10Y yield - inflation expectation (breakeven rate).
     yields: array of { t, c }. Returns realRate (as %, e.g., 2.1) or NaN. */
  function hgOgRealRate(yields, macro){
    if (!yields || !yields.length) return NaN;
    var rate10y = fin(yields[yields.length - 1] && yields[yields.length - 1].c);
    if (!isFinite(rate10y)) return NaN;
    /* Inflation breakeven: if macro has it, use it; otherwise default to 2.3% */
    var breakeven = (macro && isFinite(fin(macro.breakeven))) ? fin(macro.breakeven) : 2.3;
    return rate10y - breakeven;
  }

  /* Regime state machine: returns { regime, dxyValue, correlation, beta, realRate, reason } */
  function hgOgDetectRegime(dxyRows, goldRows, yields, macro){
    var regime = 'NORMAL', reason = '';
    var dxyValue = NaN, correlation = NaN, beta = NaN, realRate = NaN;
    /* Get latest DXY */
    if (dxyRows && dxyRows.length){
      dxyValue = fin(dxyRows[dxyRows.length - 1].c);
    }
    /* Calculate correlation and beta */
    var corr = hgOgCalculateCorrelation(goldRows, dxyRows);
    if (corr){
      correlation = corr.correlation;
      beta = corr.beta;
    }
    /* Calculate real rate */
    realRate = hgOgRealRate(yields, macro);
    /* Apply regime rules */
    if (!isFinite(dxyValue)) dxyValue = 103;   /* fallback */
    if (!isFinite(correlation)) correlation = -0.92;   /* fallback */
    if (!isFinite(beta)) beta = -0.95;   /* fallback */
    if (!isFinite(realRate)) realRate = 2.1;   /* fallback */
    /* EXTREME regime: beta < -1.5 (unusual inverse) or real rates shift +50bp */
    if (beta < -1.5){
      regime = 'EXTREME';
      reason = 'extreme inverse correlation (' + beta.toFixed(2) + ') — unusual positioning';
    } else if (realRate > 2.5){   /* assuming baseline ~2.0, this is +50bp */
      regime = 'EXTREME';
      reason = 'real rates elevated — rate shock risk';
    }
    /* DECOUPLING regime: beta > -0.3 (correlation weakens) or DXY > 105 */
    else if (beta > -0.3){
      regime = 'DECOUPLING';
      reason = 'gold decoupling from DXY (' + beta.toFixed(2) + ') — regime shift';
    } else if (isFinite(dxyValue) && dxyValue > 105){
      regime = 'DECOUPLING';
      reason = 'DXY > 105 extreme — real-rate drivers';
    }
    /* NORMAL: correlation -0.8 to -1.2, DXY 100-105, real rates stable */
    else {
      regime = 'NORMAL';
      reason = 'DXY-gold dynamics stable';
    }
    return {
      regime: regime,
      dxyValue: isFinite(dxyValue) ? dxyValue : NaN,
      correlation: isFinite(correlation) ? correlation : NaN,
      beta: isFinite(beta) ? beta : NaN,
      realRate: isFinite(realRate) ? realRate : NaN,
      reason: reason,
      lastUpdate: Date.now()
    };
  }

  /* Regime scale multiplier for risk sizing: applied ON TOP of stack3 scaling.
     Returns 1.0 (NORMAL), 0.7 (DECOUPLING), or 0.6 (EXTREME). */
  function hgOgRegimeScaleFactor(regime){
    if (regime === 'DECOUPLING') return 0.7;
    if (regime === 'EXTREME') return 0.6;
    return 1.0;   /* NORMAL */
  }

  /* ==================== gold-specific pure detectors ==================== */

  /* Asia session = 23:00-07:00 UTC (Tokyo through pre-London). Returns the
     range of the CURRENT day's Asia session from the bar-open seconds the
     app's candle contract guarantees. Pure. */
  function hgOgAsiaRange(rows, nowSec){
    if (!rows || rows.length < 6) return null;
    var last = num(rows[rows.length - 1].t);
    if (!isFinite(last)) return null;
    var refN = fin(nowSec);                       /* NOT isFinite(nowSec): null passes it */
    var ref = isFinite(refN) ? refN : last;
    var dayStart = Math.floor(ref / 86400) * 86400;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l, hr;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t)) continue;
      hr = ((t % 86400) / 3600);
      /* Asia wraps midnight: 23:00-24:00 of the prior day plus 00:00-07:00 */
      var inAsia = (hr >= 23) || (hr < 7);
      var sameWindow = (t >= dayStart - 3600) && (t <= dayStart + 7 * 3600);
      if (!inAsia || !sameWindow) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 3 || !isFinite(hi) || !isFinite(lo) || hi <= lo) return null;
    return { hi: hi, lo: lo, height: hi - lo, bars: n };
  }

  /* ASIA-BREAK: last bar closes beyond the Asia range and holds. Pure. */
  function hgOgAsiaBreak(rows, asia){
    if (!rows || !rows.length || !asia) return null;
    var last = rows[rows.length - 1];
    var c = num(last.c), o = num(last.o);
    if (!isFinite(c) || !isFinite(o)) return null;
    if (c > asia.hi && o <= asia.hi){
      return { kind:'ASIA-BREAK', dir:'long', level: asia.hi,
               why:'closed above the Asia range high ' + asia.hi.toFixed(2) };
    }
    if (c < asia.lo && o >= asia.lo){
      return { kind:'ASIA-BREAK', dir:'short', level: asia.lo,
               why:'closed below the Asia range low ' + asia.lo.toFixed(2) };
    }
    return null;
  }

  /* KZ-JUDAS: the Asia range is swept and RECLAIMED inside a killzone — the
     stop-run before the real move. Requires goldKillzone for the session
     read; without it the setup is not claimed rather than guessed. Pure
     given the killzone function. */
  function hgOgKzJudas(rows, asia, kzFn){
    if (!rows || rows.length < 3 || !asia || typeof kzFn !== 'function') return null;
    var last = rows[rows.length - 1];
    var t = num(last.t), h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(t) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var kz = null;
    try { kz = kzFn(t * 1000); } catch (e) { return null; }
    if (!kz || !kz.zone || kz.zone === 'OFF') return null;
    if (l < asia.lo && c > asia.lo){
      return { kind:'KZ-JUDAS', dir:'long', level: asia.lo, zone: kz.zone,
               why:'swept Asia low in the ' + kz.zone + ' killzone and reclaimed' };
    }
    if (h > asia.hi && c < asia.hi){
      return { kind:'KZ-JUDAS', dir:'short', level: asia.hi, zone: kz.zone,
               why:'swept Asia high in the ' + kz.zone + ' killzone and rejected' };
    }
    return null;
  }

  /* Average daily range over the last n complete days, from intraday rows. */
  function hgOgAdr(rows, days){
    if (!rows || rows.length < 24) return null;
    var byDay = {}, i, t, d, h, l;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t); h = num(rows[i].h); l = num(rows[i].l);
      if (!isFinite(t) || !isFinite(h) || !isFinite(l)) continue;
      d = Math.floor(t / 86400);
      if (!byDay[d]) byDay[d] = { hi: h, lo: l };
      else { if (h > byDay[d].hi) byDay[d].hi = h; if (l < byDay[d].lo) byDay[d].lo = l; }
    }
    var keys = Object.keys(byDay).sort();
    if (keys.length < 3) return null;
    var take = keys.slice(-(days || 14) - 1, -1);   // exclude today (incomplete)
    if (!take.length) return null;
    var sum = 0, n = 0;
    for (i = 0; i < take.length; i++){
      var r = byDay[take[i]].hi - byDay[take[i]].lo;
      if (isFinite(r) && r > 0){ sum += r; n++; }
    }
    if (!n) return null;
    var today = byDay[keys[keys.length - 1]];
    var todayRange = today ? (today.hi - today.lo) : NaN;
    var adr = sum / n;
    return { adr: adr, todayRange: todayRange, usedPct: isFinite(todayRange) ? (todayRange / adr * 100) : NaN,
             todayHi: today ? today.hi : NaN, todayLo: today ? today.lo : NaN };
  }

  /* ADR-FADE: the day has already spent >=100% of its average range and is
     pressing the extreme — fade toward the mean. Pure. */
  function hgOgAdrFade(rows, adr){
    if (!rows || !rows.length || !adr || !isFinite(adr.usedPct)) return null;
    if (adr.usedPct < 100) return null;
    var last = rows[rows.length - 1];
    var c = num(last.c);
    if (!isFinite(c) || !isFinite(adr.todayHi) || !isFinite(adr.todayLo)) return null;
    var span = adr.todayHi - adr.todayLo;
    if (!(span > 0)) return null;
    var pos = (c - adr.todayLo) / span;      // 0 = at the low, 1 = at the high
    if (pos >= 0.85){
      return { kind:'ADR-FADE', dir:'short', level: adr.todayHi,
               why:'day has used ' + adr.usedPct.toFixed(0) + '% of ADR and is at the high' };
    }
    if (pos <= 0.15){
      return { kind:'ADR-FADE', dir:'long', level: adr.todayLo,
               why:'day has used ' + adr.usedPct.toFixed(0) + '% of ADR and is at the low' };
    }
    return null;
  }

  /* ROUND-MAGNET: gold respects round dollars far more than alts. A wick
     through a $10/$25/$50/$100 level with the close back inside. Pure. */
  function hgOgRoundMagnet(rows){
    if (!rows || rows.length < 20) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var steps = [100, 50, 25, 10], i, s, lvl;
    /* the wick must be a real rejection, not a rounding artefact */
    var atrLike = 0, n = 0, j;
    for (j = Math.max(1, rows.length - 15); j < rows.length; j++){
      var hh = num(rows[j].h), ll = num(rows[j].l);
      if (isFinite(hh) && isFinite(ll)){ atrLike += (hh - ll); n++; }
    }
    if (!n) return null;
    atrLike /= n;
    if (!(atrLike > 0)) return null;
    for (i = 0; i < steps.length; i++){
      s = steps[i];
      lvl = Math.round(c / s) * s;
      if (!isFinite(lvl) || lvl <= 0) continue;
      var pierceUp = h - lvl, pierceDn = lvl - l;
      if (h > lvl && c < lvl && pierceUp >= atrLike * 0.15){
        return { kind:'ROUND-MAGNET', dir:'short', level: lvl,
                 why:'rejected the $' + lvl.toFixed(0) + ' round level from above' };
      }
      if (l < lvl && c > lvl && pierceDn >= atrLike * 0.15){
        return { kind:'ROUND-MAGNET', dir:'long', level: lvl,
                 why:'reclaimed the $' + lvl.toFixed(0) + ' round level from below' };
      }
    }
    return null;
  }

  /* Every detector for a horizon: OmniRoute's six (consumed from its
     exports, so its fixes land here) plus the four gold mechanics. Pure
     given the injected omniroute functions. */
  function hgOgDetect(rows, opts){
    var out = [], w = W(), d;
    if (!rows || rows.length < 40) return out;
    opts = opts || {};

    /* --- shared mechanics, borrowed from the omniroute engine --- */
    if (w && typeof w.hgOmniDetect === 'function'){
      try {
        var shared = w.hgOmniDetect(rows) || [];
        for (var i = 0; i < shared.length; i++) out.push(shared[i]);
      } catch (e) { /* engine absent or unhappy — gold mechanics still run */ }
    }

    /* --- gold-specific mechanics --- */
    var asia = hgOgAsiaRange(rows, opts.nowSec);
    if (asia){
      d = hgOgAsiaBreak(rows, asia); if (d) out.push(d);
      d = hgOgKzJudas(rows, asia, opts.kzFn || gfn('goldKillzone')); if (d) out.push(d);
    }
    var adr = hgOgAdr(rows, 14);
    if (adr){ d = hgOgAdrFade(rows, adr); if (d) out.push(d); }
    d = hgOgRoundMagnet(rows); if (d) out.push(d);
    /* --- added mechanics: each also registered in the backtest map and the
       pooled key list, so none of them can produce setups without a
       measurable record --- */
    var pd = hgOgPrevDay(rows, opts.nowSec);
    if (pd){ d = hgOgPdSweep(rows, pd); if (d) out.push(d); }
    d = hgOgLondonFix(rows);     if (d) out.push(d);
    d = hgOgVwapRevert(rows);    if (d) out.push(d);
    d = hgOgNr7Break(rows);      if (d) out.push(d);
    d = hgOgSmtDiverge(rows);    if (d) out.push(d);
    d = hgOgTrendReclaim(rows);  if (d) out.push(d);

    /* second round */
    var pw = hgOgPrevWeek(rows, opts.nowSec);
    if (pw){ d = hgOgPwSweep(rows, pw); if (d) out.push(d); }
    d = hgOgFvgFill(rows);       if (d) out.push(d);
    d = hgOgBosRetest(rows);     if (d) out.push(d);
    d = hgOgPoolSweep(rows);     if (d) out.push(d);
    d = hgOgSqueezeFire(rows);   if (d) out.push(d);
    d = hgOgRsiDiverge(rows);    if (d) out.push(d);
    d = hgOgGsrExtreme(rows);    if (d) out.push(d);
    d = hgOgAvwapReclaim(rows);  if (d) out.push(d);

    /* round four */
    d = hgOgCusumShift(rows);    if (d) out.push(d);
    d = hgOgVolExpansion(rows);  if (d) out.push(d);
    d = hgOgPinReject(rows);     if (d) out.push(d);
    d = hgOgEngulfLevel(rows);   if (d) out.push(d);
    d = hgOgPocRevert(rows);     if (d) out.push(d);
    d = hgOgCointSpread(rows);   if (d) out.push(d);
    d = hgOgThreeBar(rows);      if (d) out.push(d);
    /* round five — gold session / structure, still measured */
    d = hgOgNyOpenDrive(rows);   if (d) out.push(d);
    d = hgOgWeeklyOpen(rows);    if (d) out.push(d);
    d = hgOgPivotReject(rows);   if (d) out.push(d);
    d = hgOgInsideBreak(rows);   if (d) out.push(d);
    d = hgOgEma50Hold(rows);     if (d) out.push(d);
    d = hgOgFib618(rows);        if (d) out.push(d);
    /* round six: the gold indicator library */
    d = hgOgIchiKumo(rows);        if (d) out.push(d);
    d = hgOgStochTurn(rows);       if (d) out.push(d);
    d = hgOgCciExtreme(rows);      if (d) out.push(d);
    d = hgOgRibbonPullback(rows);  if (d) out.push(d);
    d = hgOgHaFlip(rows);          if (d) out.push(d);
    d = hgOgVwapBand(rows);        if (d) out.push(d);
    d = hgOgPdEquilibrium(rows);   if (d) out.push(d);
    d = hgOgErIgnition(rows);      if (d) out.push(d);
    d = hgOgStructBos(rows);       if (d) out.push(d);
    d = hgOgSweepV2(rows);         if (d) out.push(d);
    d = hgOgObRetest(rows);        if (d) out.push(d);
    d = hgOgOuRevert(rows);        if (d) out.push(d);
    d = hgOgMfiSquat(rows);        if (d) out.push(d);
    d = hgOgDiCross(rows);         if (d) out.push(d);
    d = hgOgFvgHvn(rows);          if (d) out.push(d);
    d = hgOgVpPlaybook(rows, opts); if (d) out.push(d);
    /* Part4 S12 / S14 / S17 — call ByKind so walk-forward map detectors are
       live-reachable (full-cover parity). S9 stays a filter; S13/S16 unchecked. */
    d = hgOgPart4ByKind(rows, 'P4-NR7', opts);  if (d) out.push(d);
    d = hgOgPart4ByKind(rows, 'P4-ADRX', opts); if (d) out.push(d);
    d = hgOgPart4ByKind(rows, 'P4-LAF', opts);  if (d) out.push(d);
    d = hgOgPart5ByKind(rows, 'P5-WYCK', opts); if (d) out.push(d);
    d = hgOgPart5ByKind(rows, 'P5-TURT', opts); if (d) out.push(d);
    d = hgOgPart5ByKind(rows, 'P5-VWAP', opts); if (d) out.push(d);
    d = hgOgPart5ByKind(rows, 'P5-DRIVE', opts); if (d) out.push(d);
    d = hgOgPart5ByKind(rows, 'P5-NEWS', opts); if (d) out.push(d);
    d = hgOgPart6ByKind(rows, 'P6-COMP', opts); if (d) out.push(d);
    d = hgOgPart6ByKind(rows, 'P6-ZFADE', opts); if (d) out.push(d);
    d = hgOgPart6ByKind(rows, 'P6-SMT', opts); if (d) out.push(d);
    d = hgOgPart6ByKind(rows, 'P6-FAIL', opts); if (d) out.push(d);
    d = hgOgPart7ByKind(rows, 'P7-SCALP', opts); if (d) out.push(d);
    d = hgOgPart7ByKind(rows, 'P7-RATIO', opts); if (d) out.push(d);
    d = hgOgPart8ByKind(rows, 'P8-RESID', opts); if (d) out.push(d);
    d = hgOgPart8ByKind(rows, 'P8-RANGE', opts); if (d) out.push(d);
    d = hgOgPart8ByKind(rows, 'P8-GEO', opts); if (d) out.push(d);
    d = hgOgPart8ByKind(rows, 'P8-VPINBO', opts); if (d) out.push(d);
    d = hgOgPart9ByKind(rows, 'P9-VOLBAR', opts); if (d) out.push(d);
    d = hgOgPart9ByKind(rows, 'P9-PREM', opts); if (d) out.push(d);
    return out;
  }


  /* ==================== additional gold mechanics ====================

     Each of these is a mechanic a gold desk actually trades, and each is
     registered in THREE places: the live detect pass, the walk-forward
     backtest map, and the pooled-results key list. That wiring is the point.
     A detector added only to the scan would produce setups with no in-sample
     history and no out-of-sample record — a strategy that can never be judged
     is worse than no strategy, because it still costs money.

     Every one starts at zero samples. Their measured-edge gate reads "not yet
     measured" until their own record says otherwise, and the forward log
     scores each separately from the first firing. None is assumed to work. */

  /* The prior day high/low — the liquidity gold reaches for most reliably.
     Distinct from ASIA-BREAK, which uses the Asian session box rather than
     the whole previous day. */
  function hgOgPrevDay(rows, nowSec){
    if (!rows || rows.length < 24) return null;
    var last = num(rows[rows.length - 1].t);
    if (!isFinite(last)) return null;
    var refN = fin(nowSec);                       /* NOT isFinite(nowSec): null passes it */
    var ref = isFinite(refN) ? refN : last;
    var dayStart = Math.floor(ref / 86400) * 86400;
    var prevStart = dayStart - 86400;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < prevStart || t >= dayStart) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 6 || !isFinite(hi) || !isFinite(lo) || !(hi > lo)) return null;
    return { pdh: hi, pdl: lo, bars: n };
  }

  function hgOgPdSweep(rows, pd){
    if (!rows || !pd || rows.length < 4) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    /* swept the level then closed back inside it — a failed continuation */
    if (h > pd.pdh && c < pd.pdh && (h - pd.pdh) >= rng * 0.2){
      return { kind:'PDH-SWEEP', dir:'short', level: pd.pdh,
               why:'swept the prior day high ' + pd.pdh.toFixed(2) + ' and closed back below it' };
    }
    if (l < pd.pdl && c > pd.pdl && (pd.pdl - l) >= rng * 0.2){
      return { kind:'PDL-SWEEP', dir:'long', level: pd.pdl,
               why:'swept the prior day low ' + pd.pdl.toFixed(2) + ' and reclaimed it' };
    }
    return null;
  }

  /* The London PM fix at 15:00 is a scheduled, documented gold flow. Taken as
     a decisive drive through the fix hour rather than a fade of it. */
  function hgOgLondonFix(rows){
    if (!rows || rows.length < 6) return null;
    var last = rows[rows.length - 1];
    var t = num(last.t);
    if (!isFinite(t)) return null;
    var hr = Math.floor((t % 86400) / 3600);
    if (hr !== 15 && hr !== 16) return null;
    var c = num(last.c), o = num(last.o), h = num(last.h), l = num(last.l);
    if (!isFinite(c) || !isFinite(o) || !isFinite(h) || !isFinite(l)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    if (Math.abs(c - o) < rng * 0.5) return null;      /* needs a decisive body */
    var pc = num(rows[rows.length - 2] && rows[rows.length - 2].c);
    if (!isFinite(pc)) return null;
    if (c > o && c > pc){
      return { kind:'LONDON-FIX', dir:'long', level: c,
               why:'decisive up bar through the ' + hr + ':00 London fix window' };
    }
    if (c < o && c < pc){
      return { kind:'LONDON-FIX', dir:'short', level: c,
               why:'decisive down bar through the ' + hr + ':00 London fix window' };
    }
    return null;
  }

  /* Session VWAP stretch and reversion. Uses the shared vwapAt when present
     so this cannot drift from the rest of the app.s VWAP. */
  /* ---- the instrument-agnostic mechanics now live in hg-mechanics.js ----

     Not one of these sixteen knew anything about gold: every threshold was in
     ATR or in percent, so they read a BTC 4h chart as well as an XAUUSD 1h
     one. OMNIROUTE wanted them, and copying would have doubled the
     maintenance surface and guaranteed the two copies drift — the app already
     carries ~300 lines of exactly that between the gold desks.

     They are thin delegations rather than deletions so that every call site,
     every export and every test keeps its existing name. Feature-checked: a
     missing hg-mechanics.js means those mechanics stop firing, which is
     visible in the pooled table, rather than a thrown scan. */

  function hgOgVwapRevert(rows){ var f = gfn('hgMechVwapRevert'); return f ? f(rows) : null; }

  /* NR7 — the narrowest range of seven bars, then expansion out of it.
     Compression precedes expansion; direction is taken from the break. */
  function hgOgNr7Break(rows){ var f = gfn('hgMechNr7Break'); return f ? f(rows) : null; }

  /* Gold against silver. Real desks watch the pair; macro-feeds.js already
     fetches the silver series. With no silver this returns null rather than
     guessing — a mechanic that cannot see its second leg has no signal. */
  function hgOgSmtDiverge(rows){
    if (!rows || rows.length < 20) return null;
    var w = W();
    var xag = w && w.__hgXagCandles;
    if (!xag || xag.length < 20) return null;
    function legs(src){
      var n = src.length - 1;
      return { last: num(src[n].c), prior: num(src[n - 10] && src[n - 10].c) };
    }
    var g = legs(rows), s = legs(xag);
    if (!isFinite(g.last) || !isFinite(g.prior) || !isFinite(s.last) || !isFinite(s.prior)) return null;
    var gUp = g.last > g.prior, sUp = s.last > s.prior;
    if (gUp === sUp) return null;                      /* aligned — no divergence */
    var gMove = Math.abs(g.last - g.prior) / Math.max(1e-9, Math.abs(g.prior));
    var sMove = Math.abs(s.last - s.prior) / Math.max(1e-9, Math.abs(s.prior));
    if (gMove < 0.002 || sMove < 0.002) return null;   /* both legs must have moved */
    return { kind:'SMT-DIVERGE', dir: gUp ? 'short' : 'long', level: g.last,
             why:'gold ' + (gUp ? 'up' : 'down') + ' while silver ' + (sUp ? 'up' : 'down')
                 + ' over 10 bars — the metals disagree' };
  }

  /* Trend reclaim: an established stack, a pullback through the fast EMA, and
     a close back the right side of it. The continuation counterpart to the
     reversion mechanics above. */
  function hgOgTrendReclaim(rows){ var f = gfn('hgMechTrendReclaim'); return f ? f(rows) : null; }


  /* ============ second round of gold mechanics ============

     Same rule as the first round: every kind is registered in the live detect
     pass, the walk-forward backtest map and the pooled key list, so it earns
     an in-sample record and a forward record from its first firing and can be
     judged. None is assumed to work.

     These lean on the shared indicator library rather than re-deriving what
     it already computes. Every return shape below was checked against the
     real function output, not inferred from the name — the previous round
     wired two gates to shapes that did not exist (ichimokuState has no
     .state; donchian returns arrays, not scalars) and both read "unavailable"
     forever without ever throwing. */

  /* Fair value gap: a three-bar imbalance where the middle bar runs so hard
     that bar 1 and bar 3 do not overlap. Price returning into that gap is the
     rebalance. Pure — no library dependency. */
  function hgOgFvgFill(rows){ var f = gfn('hgMechFvgFill'); return f ? f(rows) : null; }

  /* Break of structure, then a retest of the level that broke. hgStructure
     returns { swings, lastBOS:{dir,level,i}, lastCHoCH, trend }. */
  function hgOgBosRetest(rows){ var f = gfn('hgMechBosRetest'); return f ? f(rows) : null; }

  /* Equal highs and lows are resting liquidity. findLiquidityPools returns
     { buySide:{level,count}|null, sellSide:{level,count}|null }. Fire on the
     sweep-and-reject of a pool, which is where the stops actually sat. */
  function hgOgPoolSweep(rows){ var f = gfn('hgMechPoolSweep'); return f ? f(rows) : null; }

  /* TTM squeeze release. ttmSqueeze returns { on:[], fired:[], momentum:[] }
     as parallel arrays; direction comes from the momentum sign at the fire. */
  function hgOgSqueezeFire(rows){ var f = gfn('hgMechSqueezeFire'); return f ? f(rows) : null; }

  /* Regular RSI divergence at a confirmed pivot: price makes the extreme, the
     oscillator does not. findPivots returns [{i,type:'high'|'low',v}]. */
  function hgOgRsiDiverge(rows){ var f = gfn('hgMechRsiDiverge'); return f ? f(rows) : null; }

  /* The prior WEEK high and low. A different pool from the prior day: weekly
     levels are where swing stops sit, and gold reaches for them on the
     Monday/Tuesday expansion. */
  function hgOgPrevWeek(rows, nowSec){
    if (!rows || rows.length < 48) return null;
    var last = num(rows[rows.length - 1].t);
    if (!isFinite(last)) return null;
    var refN = fin(nowSec);
    var ref = isFinite(refN) ? refN : last;
    /* Unix epoch was a Thursday; shift so weeks start Monday 00:00 UTC. */
    var wkStart = Math.floor((ref - 345600) / 604800) * 604800 + 345600;
    var prevStart = wkStart - 604800;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < prevStart || t >= wkStart) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 24 || !isFinite(hi) || !isFinite(lo) || !(hi > lo)) return null;
    return { pwh: hi, pwl: lo, bars: n };
  }

  function hgOgPwSweep(rows, pw){
    if (!rows || !pw || rows.length < 4) return null;
    var last = rows[rows.length - 1];
    var h = num(last.h), l = num(last.l), c = num(last.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    if (h > pw.pwh && c < pw.pwh && (h - pw.pwh) >= rng * 0.2){
      return { kind:'PWH-SWEEP', dir:'short', level: pw.pwh,
               why:'swept the prior week high ' + pw.pwh.toFixed(2) + ' and closed back below it' };
    }
    if (l < pw.pwl && c > pw.pwl && (pw.pwl - l) >= rng * 0.2){
      return { kind:'PWL-SWEEP', dir:'long', level: pw.pwl,
               why:'swept the prior week low ' + pw.pwl.toFixed(2) + ' and reclaimed it' };
    }
    return null;
  }

  /* Gold/silver ratio at an extreme. Distinct from SMT-DIVERGE, which reads
     the two legs disagreeing in DIRECTION; this reads the ratio itself
     stretched against its own recent distribution. */
  function hgOgGsrExtreme(rows){
    if (!rows || rows.length < 60) return null;
    var w = W();
    var xag = w && w.__hgXagCandles;
    if (!xag || xag.length < 60) return null;
    var zf = gfn('zscoreLast');
    if (!zf) return null;
    var m = Math.min(rows.length, xag.length);
    var ratio = [], i, g, s;
    for (i = 0; i < m; i++){
      g = num(rows[rows.length - m + i].c);
      s = num(xag[xag.length - m + i].c);
      if (!isFinite(g) || !isFinite(s) || !(s > 0)) continue;
      ratio.push(g / s);
    }
    if (ratio.length < 50) return null;
    var z;
    try { z = num(zf(ratio, 50)); } catch (e) { return null; }
    if (!isFinite(z)) return null;
    var c = num(rows[rows.length - 1].c);
    if (!isFinite(c)) return null;
    var gsr = ratio[ratio.length - 1];
    /* A stretched ratio mean-reverts through the gold leg as often as the
       silver leg, so this is a fade of the stretch, stated as such. */
    if (z >= 2){
      return { kind:'GSR-EXTREME', dir:'short', level: c,
               why:'gold/silver ratio ' + gsr.toFixed(1) + ' at +' + z.toFixed(1) + 'σ — gold stretched rich to silver' };
    }
    if (z <= -2){
      return { kind:'GSR-EXTREME', dir:'long', level: c,
               why:'gold/silver ratio ' + gsr.toFixed(1) + ' at ' + z.toFixed(1) + 'σ — gold stretched cheap to silver' };
    }
    return null;
  }

  /* Anchored VWAP from the last significant swing, reclaimed. hgAVWAP returns
     { value, upper, lower, stdev } measured from the anchor index forward. */
  function hgOgAvwapReclaim(rows){ var f = gfn('hgMechAvwapReclaim'); return f ? f(rows) : null; }



  /* ============ round four: robustness ============

     Twenty-seven mechanics already scan here. A fourth round of detectors
     alone would buy less than it costs: every added mechanic raises the
     multiple-comparisons bar for all of them and makes a two-sided tape more
     likely. So this round is weighted toward reads that make an existing
     setup more trustworthy — higher-timeframe agreement, regime fit and a
     volatility forecast — with the new mechanics chosen for being genuinely
     different in kind rather than for the count.

     Shapes below were probed against the real functions first, as always. */

  /* Resample to a coarser timeframe. The desk already holds 1500 bars, so the
     higher timeframe is built from what is in hand rather than fetched: no
     extra request, no second source to disagree with the first, and the two
     views are guaranteed to describe the same bars. */
  function hgOgResample(rows, factor){ var f = gfn('hgMechResample'); return f ? f(rows, factor) : null; }

  /* A CUSUM shift is a structural change in the mean, not a pattern: the
     series has genuinely moved to a new level. cusumLast returns
     { dir, barsAgo }. */
  function hgOgCusumShift(rows){ var f = gfn('hgMechCusumShift'); return f ? f(rows) : null; }

  /* Volatility breaking out of its own long-run level. hgVolFromCloses
     returns { sigmaNow, sigmaForecast, sigmaLongRun, ... }. Direction comes
     from the bar doing the expanding, not from the volatility itself. */
  function hgOgVolExpansion(rows){ var f = gfn('hgMechVolExpansion'); return f ? f(rows) : null; }

  /* A pin bar: most of the range is wick on one side, and the close is back
     in the body. The oldest reversal read there is, and pure. */
  function hgOgPinReject(rows){ var f = gfn('hgMechPinReject'); return f ? f(rows) : null; }

  /* An engulfing bar that also takes out the prior extreme: the reversal has
     to actually trade through the level, not merely close past it on a
     bigger body. */
  function hgOgEngulfLevel(rows){ var f = gfn('hgMechEngulfLevel'); return f ? f(rows) : null; }

  /* Price stretched away from the volume-profile point of control, which is
     where the most business was actually done. volumeProfile returns
     { poc, vah, val, bins }. */
  function hgOgPocRevert(rows){ var f = gfn('hgMechPocRevert'); return f ? f(rows) : null; }

  /* The cointegrated gold/silver residual at an extreme. Distinct from
     GSR-EXTREME, which reads the raw ratio: this reads the spread AFTER
     fitting the hedge ratio, and only when the pair is actually cointegrated
     — an uncointegrated spread has no mean to revert to, and trading it as
     though it did is the classic way to lose money on a pairs trade. */
  function hgOgCointSpread(rows){
    if (!rows || rows.length < 120) return null;
    var w = W();
    var xag = w && w.__hgXagCandles;
    if (!xag || xag.length < 120) return null;
    var f = gfn('hgCoint');
    if (!f) return null;
    var m = Math.min(rows.length, xag.length, 300);
    var a = [], b = [], i, ga, sa;
    for (i = 0; i < m; i++){
      ga = num(rows[rows.length - m + i].c);
      sa = num(xag[xag.length - m + i].c);
      if (!isFinite(ga) || !isFinite(sa)) continue;
      a.push(ga); b.push(sa);
    }
    if (a.length < 100 || a.length !== b.length) return null;
    var co;
    try { co = f(a, b); } catch (e) { return null; }
    if (!co || co.cointegrated !== true) return null;
    var z = num(co.spreadZ), hl = num(co.halfLifeBars);
    if (!isFinite(z) || Math.abs(z) < 2) return null;
    /* A half-life longer than the horizon means the reversion cannot land in
       time even if it is real. */
    if (isFinite(hl) && hl > 40) return null;
    var c = num(rows[rows.length - 1].c);
    if (!isFinite(c)) return null;
    return { kind:'COINT-SPREAD', dir: z > 0 ? 'short' : 'long', level: c,
             why:'gold/silver spread ' + (z >= 0 ? '+' : '') + z.toFixed(1)
                 + ' SD from its fitted mean, half-life ' + (isFinite(hl) ? hl.toFixed(0) + ' bars' : 'unknown') };
  }

  /* Three-bar reversal: a low (or high) with a higher (lower) bar either
     side, confirmed by the close. Structure, not indicator. */
  function hgOgThreeBar(rows){ var f = gfn('hgMechThreeBar'); return f ? f(rows) : null; }

  /* ==================== round five: gold session / structure ====================

     Gold desks actually trade these. Each one is in detect, the walk-forward
     map, OG_MECHANICS and OG_FAMILY. None of them invents a ticket — the
     ledger still grades, and desk tape still refuses a LONG pick while gold
     is going down. */

  function hgOgBarHour(bar){
    var t = num(bar && bar.t);
    if (!isFinite(t)) return NaN;
    var sec = t % 86400;
    if (sec < 0) sec += 86400;
    return sec / 3600;
  }

  function hgOgLondonRange(rows){
    if (!rows || rows.length < 8) return null;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT)) return null;
    var dayStart = Math.floor(lastT / 86400) * 86400;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l, hr;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < dayStart || t >= dayStart + 86400) continue;
      hr = hgOgBarHour(rows[i]);
      if (!(hr >= 7 && hr < 13)) continue;
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 3 || !isFinite(hi) || !isFinite(lo) || !(hi > lo)) return null;
    return { hi: hi, lo: lo, bars: n };
  }

  function hgOgNyOpenDrive(rows){
    try{
      if (!rows || rows.length < 16) return null;
      var london = hgOgLondonRange(rows);
      if (!london) return null;
      var last = rows[rows.length - 1];
      var hr = hgOgBarHour(last);
      if (!(hr >= 13 && hr < 16)) return null;
      var o = num(last.o), h = num(last.h), l = num(last.l), c = num(last.c);
      if (!isFinite(o) || !isFinite(c)) return null;
      if (c > london.hi && o <= london.hi)
        return { kind:'NY-OPEN-DRIVE', dir:'long', level: london.hi,
                 why:'NY hour closed above the London high ' + london.hi.toFixed(2) };
      if (c < london.lo && o >= london.lo)
        return { kind:'NY-OPEN-DRIVE', dir:'short', level: london.lo,
                 why:'NY hour closed below the London low ' + london.lo.toFixed(2) };
      return null;
    }catch(e){ return null; }
  }

  function hgOgWeekOpenPx(rows){
    if (!rows || !rows.length) return NaN;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT)) return NaN;
    var dayStart = Math.floor(lastT / 86400) * 86400;
    var dow = new Date(dayStart * 1000).getUTCDay();
    var fromMon = (dow + 6) % 7;
    var weekStart = dayStart - fromMon * 86400;
    var i, t, first = null;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < weekStart) continue;
      first = rows[i];
      break;
    }
    return first ? num(first.o) : NaN;
  }

  function hgOgWeeklyOpen(rows){
    try{
      if (!rows || rows.length < 24) return null;
      var wo = hgOgWeekOpenPx(rows);
      if (!isFinite(wo)) return null;
      var last = rows[rows.length - 1];
      var h = num(last.h), l = num(last.l), c = num(last.c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
      var rng = h - l;
      if (!(rng > 0)) return null;
      var atrN = atrOf(rows, 14);
      var need = isFinite(atrN) && atrN > 0 ? atrN * 0.12 : rng * 0.2;
      if (l < wo && c > wo && (wo - l) >= need)
        return { kind:'WEEKLY-OPEN', dir:'long', level: wo,
                 why:'swept the weekly open ' + wo.toFixed(2) + ' and closed back above it' };
      if (h > wo && c < wo && (h - wo) >= need)
        return { kind:'WEEKLY-OPEN', dir:'short', level: wo,
                 why:'swept the weekly open ' + wo.toFixed(2) + ' and closed back below it' };
      return null;
    }catch(e){ return null; }
  }

  function hgOgPrevDayHlc(rows){
    if (!rows || rows.length < 24) return null;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT)) return null;
    var dayStart = Math.floor(lastT / 86400) * 86400;
    var prevStart = dayStart - 86400;
    var hi = -Infinity, lo = Infinity, close = NaN, n = 0, i, t, h, l, c;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < prevStart || t >= dayStart) continue;
      h = num(rows[i].h); l = num(rows[i].l); c = num(rows[i].c);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      if (isFinite(c)) close = c;
      n++;
    }
    if (n < 6 || !isFinite(hi) || !isFinite(lo) || !isFinite(close) || !(hi > lo)) return null;
    return { h: hi, l: lo, c: close, bars: n };
  }

  function hgOgPivotReject(rows){
    try{
      var pd = hgOgPrevDayHlc(rows);
      if (!pd || !rows || !rows.length) return null;
      var P = (pd.h + pd.l + pd.c) / 3;
      var R1 = 2 * P - pd.l, S1 = 2 * P - pd.h;
      var last = rows[rows.length - 1];
      var h = num(last.h), l = num(last.l), c = num(last.c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(c) || !isFinite(R1) || !isFinite(S1)) return null;
      var rng = h - l;
      if (!(rng > 0)) return null;
      if (h > R1 && c < R1 && (h - R1) >= rng * 0.12)
        return { kind:'PIVOT-REJECT', dir:'short', level: R1,
                 why:'swept classic R1 ' + R1.toFixed(2) + ' and closed back below it' };
      if (l < S1 && c > S1 && (S1 - l) >= rng * 0.12)
        return { kind:'PIVOT-REJECT', dir:'long', level: S1,
                 why:'swept classic S1 ' + S1.toFixed(2) + ' and closed back above it' };
      return null;
    }catch(e){ return null; }
  }

  function hgOgInsideBreak(rows){
    try{
      if (!rows || rows.length < 3) return null;
      var a = rows[rows.length - 3], b = rows[rows.length - 2], z = rows[rows.length - 1];
      var ah = num(a.h), al = num(a.l), bh = num(b.h), bl = num(b.l);
      var zo = num(z.o), zc = num(z.c);
      if (!isFinite(ah) || !isFinite(al) || !isFinite(bh) || !isFinite(bl) || !isFinite(zo) || !isFinite(zc)) return null;
      if (!(bh < ah && bl > al && ah > al)) return null;
      if (zc > ah && zo <= ah)
        return { kind:'INSIDE-BREAK', dir:'long', level: ah,
                 why:'inside bar then closed above the parent high ' + ah.toFixed(2) };
      if (zc < al && zo >= al)
        return { kind:'INSIDE-BREAK', dir:'short', level: al,
                 why:'inside bar then closed below the parent low ' + al.toFixed(2) };
      return null;
    }catch(e){ return null; }
  }

  function hgOgEma50Hold(rows){
    try{
      if (!rows || rows.length < 60) return null;
      var closes = closesOf(rows);
      if (closes.length < 55) return null;
      var e50 = emaOf(closes, 50), e21 = emaOf(closes, 21);
      var last = rows[rows.length - 1];
      var h = num(last.h), l = num(last.l), c = num(last.c);
      if (!isFinite(e50) || !isFinite(e21) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
      var atrN = atrOf(rows, 14);
      if (!(atrN > 0)) atrN = Math.max(h - l, Math.abs(c) * 0.001);
      var tagged = (l <= e50 && h >= e50) || Math.abs(l - e50) <= atrN * 0.5 || Math.abs(h - e50) <= atrN * 0.5;
      if (!tagged) return null;
      if (e21 > e50 && c > e50 && l <= e50 + atrN * 0.2)
        return { kind:'EMA50-HOLD', dir:'long', level: e50,
                 why:'up-stack held EMA50 at ' + e50.toFixed(2) + ' and closed back above it' };
      if (e21 < e50 && c < e50 && h >= e50 - atrN * 0.2)
        return { kind:'EMA50-HOLD', dir:'short', level: e50,
                 why:'down-stack held EMA50 at ' + e50.toFixed(2) + ' and closed back below it' };
      return null;
    }catch(e){ return null; }
  }

  function hgOgFib618(rows){
    try{
      if (!rows || rows.length < 22) return null;
      var win = rows.slice(0, -1);
      if (win.length < 20) return null;
      win = win.slice(-20);
      var hi = -Infinity, lo = Infinity, hiI = -1, loI = -1, i, h, l;
      for (i = 0; i < win.length; i++){
        h = num(win[i].h); l = num(win[i].l);
        if (isFinite(h) && h >= hi){ hi = h; hiI = i; }
        if (isFinite(l) && l <= lo){ lo = l; loI = i; }
      }
      if (!(hi > lo) || hiI < 0 || loI < 0) return null;
      var last = rows[rows.length - 1];
      var lh = num(last.h), ll = num(last.l), lc = num(last.c), loP = num(last.o);
      if (!isFinite(lh) || !isFinite(ll) || !isFinite(lc)) return null;
      var rng = hi - lo;
      var longLvl = hi - 0.618 * rng, shortLvl = lo + 0.618 * rng;
      var atrN = atrOf(rows, 14);
      var slop = (isFinite(atrN) && atrN > 0) ? atrN * 0.45 : rng * 0.08;
      if (loI <= hiI && ll <= longLvl + slop && lc > longLvl && (isFinite(loP) ? lc >= loP : true))
        return { kind:'FIB-618', dir:'long', level: longLvl,
                 why:'held 61.8 of the last swing at ' + longLvl.toFixed(2) };
      if (hiI <= loI && lh >= shortLvl - slop && lc < shortLvl && (isFinite(loP) ? lc <= loP : true))
        return { kind:'FIB-618', dir:'short', level: shortLvl,
                 why:'held 61.8 of the last swing at ' + shortLvl.toFixed(2) };
      return null;
    }catch(e){ return null; }
  }

  function hgOgSessionVwap(rows){
    if (!rows || !rows.length) return NaN;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT)) return NaN;
    var dayStart = Math.floor(lastT / 86400) * 86400;
    var pv = 0, vv = 0, i, t, h, l, c, v, tp;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < dayStart) continue;
      h = num(rows[i].h); l = num(rows[i].l); c = num(rows[i].c); v = num(rows[i].v);
      if (!isFinite(c)) continue;
      tp = (isFinite(h) && isFinite(l)) ? (h + l + c) / 3 : c;
      if (!isFinite(v) || v <= 0) v = 1;
      pv += tp * v; vv += v;
    }
    return vv > 0 ? pv / vv : NaN;
  }

  /* ============ round six: the gold indicator library, finally asked ======

     goldind.js is 4,496 lines and exports about ninety gold functions. This
     desk was using TWO of them: goldKillzone for the session read and
     validateYieldCorrelation for the yield gate. Ichimoku, StochRSI, CCI, the
     EMA ribbon, Heikin-Ashi, VWAP bands, premium/discount, the v2 structure
     and sweep reads, order-block retest and Kaufman efficiency were all
     loaded in the page on every scan and never asked a question.
     pineGoldOuZscore in pinegoldmath.js likewise.

     EVERY ONE BELOW IS A PURE FUNCTION OF BARS, and that is not a style
     preference. The walk-forward replays each detector over candle prefixes
     (hgOmniBacktestOne), so a mechanic reaching for the order book, funding
     or a live macro print cannot be measured at all — and the rule this file
     has enforced since its first added mechanic is that an unmeasurable
     strategy is worse than none, because it still costs money and nothing can
     ever judge it. goldind's depth, CVD and funding reads are therefore NOT
     promoted to mechanics; they inform the gate ledger instead, where they
     carry no implied track record.

     STATE, AND WHY IT IS PASSED IN. goldOrderBlockRetest falls back to a
     module-level _lastActiveZones cache when no zones are handed to it. That
     cache is written by whichever gold tab ran last, so a walk-forward replay
     could score bar 300 against zones derived from bar 1500 — lookahead, and
     the flattering kind. Zones and structure are therefore both computed from
     the prefix here and passed explicitly.

     THE PRICE, STATED PLAINLY. The measured-edge gate is a family-wise
     significance test over OG_MECHANICS.length. Going from 40 mechanics to 54
     raises the per-mechanic bar from about +3.02 sigma to about +3.11. Every
     mechanic already here now clears a slightly higher hurdle. That is the
     correct direction — widening the search while holding the threshold still
     is how a desk manufactures false positives — but it is a real cost paid
     by the existing mechanics, and the pooled table prints the count so the
     reader can see what the bar is being set against.

     All feature-checked: without goldind.js these return null and the pooled
     table shows them as never having fired, which is the truth. */

  /* BOUNDED HISTORY, AND WHY EVERY CALL BELOW USES IT.

     The walk-forward calls each detector once per bar over a GROWING prefix —
     about 1,440 times on a 1,500-bar horizon. The goldind reads rebuild their
     whole indicator array on every call, so an O(n) indicator becomes O(n^2)
     across the replay. Measured on a 1500-bar horizon before this helper:
     OB-RETEST took 360 SECONDS for one horizon, and the other thirteen came
     to about ten seconds between them, against a 5-20ms baseline for the
     mechanics already here. OB-RETEST was the worst by three orders of
     magnitude because goldActiveOrderBlocks walks every bar looking for a
     displacement and then walks forward again from each one it finds.

     Each call is therefore handed only the tail it needs. The window is sized
     from the indicator's own memory, not guessed: Wilder-smoothed reads (RSI,
     ADX, ATR) converge in roughly five periods and get 300 bars, an EMA200
     gets 600, and reads with a fixed lookback get a small multiple of it.
     These are not approximations of the full-history answer — they are the
     same answer, because the bars dropped could not have influenced it.

     The one deliberate semantic choice is VWAP-BAND, whose anchor becomes a
     rolling 300 bars rather than the start of the prefix. That is the better
     definition anyway: an anchor at bar zero drifts further into the past on
     every bar of the replay, so the mechanic being measured at bar 1400 was
     not the mechanic being measured at bar 100. */
  function ogTail(rows, n){
    if (!rows) return rows;
    return (rows.length > n) ? rows.slice(rows.length - n) : rows;
  }

  /* ICHI-KUMO. Price closes clear of the Ichimoku cloud AND the Tenkan/Kijun
     cross agrees. Cloud state alone is a condition, not an event — it reads
     ABOVE for every bar of a trend that left the cloud weeks ago — so the
     prior bar must still have been inside or on the far side. */
  function hgOgIchiKumo(rows){
    var f = gfn('goldIchimoku');
    if (!f || !rows || rows.length < 60) return null;
    var k = null;
    try { k = f(ogTail(rows, 200)); } catch (e) { return null; }
    if (!k) return null;
    var top = fin(k.cloudTop), bot = fin(k.cloudBot);
    if (!isFinite(top) || !isFinite(bot)) return null;
    var n = rows.length;
    var c = fin(rows[n - 1] && rows[n - 1].c), p = fin(rows[n - 2] && rows[n - 2].c);
    if (!isFinite(c) || !isFinite(p)) return null;
    if (k.state === 'ABOVE' && k.tkCross === 'BULL' && p <= top && c > top)
      return { kind:'ICHI-KUMO', dir:'long', level: top,
               why:'closed out above the Ichimoku cloud at ' + top.toFixed(2) + ' with Tenkan over Kijun' };
    if (k.state === 'BELOW' && k.tkCross === 'BEAR' && p >= bot && c < bot)
      return { kind:'ICHI-KUMO', dir:'short', level: bot,
               why:'closed out below the Ichimoku cloud at ' + bot.toFixed(2) + ' with Tenkan under Kijun' };
    return null;
  }

  /* STOCHRSI-TURN. StochRSI leaving an extreme. goldStochRSI already reports
     that as a discrete cross rather than a level, so this is an event by
     construction and needs no prior-bar recomputation. */
  function hgOgStochTurn(rows){
    var f = gfn('goldStochRSI');
    if (!f || !rows || rows.length < 40) return null;
    var s = null;
    try { s = f(ogTail(rows, 300)); } catch (e) { return null; }
    if (!s) return null;
    var lv = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    if (!isFinite(lv)) return null;
    if (s.crossUp)   return { kind:'STOCHRSI-TURN', dir:'long',  level: lv,
                              why:'StochRSI crossed up out of oversold' };
    if (s.crossDown) return { kind:'STOCHRSI-TURN', dir:'short', level: lv,
                              why:'StochRSI crossed down out of overbought' };
    return null;
  }

  /* CCI-EXTREME. The fade: CCI was past +/-100 on the prior bar and has come
     back inside. Costs a second goldCCI pass on the prefix, which is the
     reason this is a fade rather than a breakout read — a breakout read would
     need no prior bar at all, but it would be firing INTO the move rather
     than after it has turned. */
  function hgOgCciExtreme(rows){
    var f = gfn('goldCCI');
    if (!f || !rows || rows.length < 40) return null;
    var cur = null, prv = null;
    var win = ogTail(rows, 200);
    try { cur = f(win); prv = f(win.slice(0, win.length - 1)); } catch (e) { return null; }
    if (!cur || !prv) return null;
    var lv = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    if (!isFinite(lv)) return null;
    if (prv.zone === 'EXTREME_HIGH' && cur.zone !== 'EXTREME_HIGH')
      return { kind:'CCI-EXTREME', dir:'short', level: lv,
               why:'CCI fell back inside +100 after an extreme high' };
    if (prv.zone === 'EXTREME_LOW' && cur.zone !== 'EXTREME_LOW')
      return { kind:'CCI-EXTREME', dir:'long', level: lv,
               why:'CCI rose back inside -100 after an extreme low' };
    return null;
  }

  /* RIBBON-PULLBACK. Continuation, not reversal: the 20/50/200 stack is
     aligned and price has pulled back within half an ATR of the EMA20. The
     ribbon's own sellOnly flag (price under the 200) vetoes the long side, so
     a counter-trend bounce cannot be dressed up as a continuation. */
  function hgOgRibbonPullback(rows){
    var f = gfn('goldRibbon');
    if (!f || !rows || rows.length < 60) return null;
    var rb = null;
    try { rb = f(ogTail(rows, 600)); } catch (e) { return null; }
    if (!rb || !rb.pullback20) return null;
    var e20 = fin(rb.e20);
    if (!isFinite(e20)) return null;
    if (rb.mode === 'BULL' && rb.above20 === true && !rb.sellOnly)
      return { kind:'RIBBON-PULLBACK', dir:'long', level: e20,
               why:'20/50/200 stacked bullish and price pulled back to the EMA20 at ' + e20.toFixed(2) };
    if (rb.mode === 'BEAR' && rb.above20 === false)
      return { kind:'RIBBON-PULLBACK', dir:'short', level: e20,
               why:'20/50/200 stacked bearish and price pulled back to the EMA20 at ' + e20.toFixed(2) };
    return null;
  }

  /* HA-FLIP. The FIRST Heikin-Ashi bar of a new direction — consecutive === 1
     — with a body worth the name. Any higher count is the middle of a run
     this already fired on. */
  function hgOgHaFlip(rows){
    var f = gfn('goldHeikinAshi');
    if (!f || !rows || rows.length < 40) return null;
    var ha = null;
    try { ha = f(ogTail(rows, 300)); } catch (e) { return null; }
    if (!ha || ha.consecutive !== 1) return null;
    var sz = fin(ha.lastSize);
    if (!(sz > 0.5)) return null;
    var lv = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    if (!isFinite(lv)) return null;
    if (ha.dir === 'bull') return { kind:'HA-FLIP', dir:'long', level: lv,
                                    why:'first Heikin-Ashi bull bar after a bear run, body ' + (sz * 100).toFixed(0) + '% of range' };
    if (ha.dir === 'bear') return { kind:'HA-FLIP', dir:'short', level: lv,
                                    why:'first Heikin-Ashi bear bar after a bull run, body ' + (sz * 100).toFixed(0) + '% of range' };
    return null;
  }

  /* VWAP-BAND. Traded outside the second VWAP deviation band and closed back
     inside it. Anchored at the start of the prefix rather than at a session
     open — deliberate, since the session anchor is already AVWAP-RECLAIM's
     job and two mechanics on one anchor would double-count a single edge. */
  function hgOgVwapBand(rows){
    var f = gfn('goldVWAPBands');
    if (!f || !rows || rows.length < 60) return null;
    var vb = null;
    try { vb = f(ogTail(rows, 300), 0); } catch (e) { return null; }
    if (!vb) return null;
    var up = fin(vb.upper2), dn = fin(vb.lower2);
    if (!isFinite(up) || !isFinite(dn)) return null;
    var b = rows[rows.length - 1];
    var h = fin(b && b.h), l = fin(b && b.l), c = fin(b && b.c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    if (h > up && c < up) return { kind:'VWAP-BAND', dir:'short', level: up,
                                   why:'rejected the upper 2-sigma VWAP band at ' + up.toFixed(2) };
    if (l < dn && c > dn) return { kind:'VWAP-BAND', dir:'long', level: dn,
                                   why:'rejected the lower 2-sigma VWAP band at ' + dn.toFixed(2) };
    return null;
  }

  /* PD-EQUILIBRIUM. ICT premium/discount: fade the extreme quartile of the
     recent range back toward equilibrium — but ONLY where goldPremiumDiscount
     reads the tape as CHOP. In a trend the premium quartile is where price
     lives, and fading it there is the most reliable way to lose money on this
     read, which is why the adxContext check is not optional. */
  function hgOgPdEquilibrium(rows){
    var f = gfn('goldPremiumDiscount');
    if (!f || !rows || rows.length < 40) return null;
    var pd = null;
    try { pd = f(ogTail(rows, 300)); } catch (e) { return null; }
    if (!pd || pd.adxContext !== 'CHOP') return null;
    var hi = fin(pd.rangeHi), lo = fin(pd.rangeLo);
    if (!isFinite(hi) || !isFinite(lo)) return null;
    var eq = (hi + lo) / 2;
    if (pd.zone === 'PREMIUM')  return { kind:'PD-EQUILIBRIUM', dir:'short', level: hi,
                                         why:'in the premium quartile of a ranging tape, equilibrium ' + eq.toFixed(2) };
    if (pd.zone === 'DISCOUNT') return { kind:'PD-EQUILIBRIUM', dir:'long', level: lo,
                                         why:'in the discount quartile of a ranging tape, equilibrium ' + eq.toFixed(2) };
    return null;
  }

  /* ER-IGNITION. Kaufman efficiency crossing out of chop: the prior bar was
     noise (ER < 0.25) and this one is directional. Direction comes from the
     close over the window, not from ER, which is unsigned. */
  function hgOgErIgnition(rows){
    var f = gfn('calculateKaufmanER');
    if (!f || !rows || rows.length < 40) return null;
    var cur = null, prv = null;
    var win = ogTail(rows, 100);
    try { cur = f(win, 20); prv = f(win.slice(0, win.length - 1), 20); } catch (e) { return null; }
    if (!cur || !prv) return null;
    if (!(prv.isChop === true && cur.isChop === false)) return null;
    var n = rows.length;
    var c = fin(rows[n - 1] && rows[n - 1].c), back = fin(rows[n - 21] && rows[n - 21].c);
    if (!isFinite(c) || !isFinite(back) || c === back) return null;
    return { kind:'ER-IGNITION', dir: (c > back) ? 'long' : 'short', level: back,
             why:'Kaufman efficiency broke out of chop to ' + fin(cur.er).toFixed(2) + ' over the last 20 bars' };
  }

  /* STRUCT-BOS. goldMarketStructure's break of structure or change of
     character, taken only when it reports the breaking LEVEL — a BOS with no
     level is a label, and this desk cannot place a trade against a label.

     THE TRANSITION CHECK IS NOT OPTIONAL. goldMarketStructure sets bos from
     `cur > lastHigh.price`, which is a STANDING CONDITION: it stays true for
     every bar price holds above that swing high, which in a trend is most of
     them. Measured over 4,200 synthetic windows this fired on 50% of bars
     before the check below — a mechanic firing every other bar would have
     dominated the consensus vote and flooded the pooled table with samples
     that are one move counted many times. Requiring the PRIOR bar not to have
     been in the same broken state turns the condition back into the event it
     is described as. Costs a second structure read on the prefix. */
  function hgOgStructBos(rows){
    var f = gfn('goldMarketStructure');
    if (!f || !rows || rows.length < 40) return null;
    var ms = null, prv = null;
    var win = ogTail(rows, 300);
    try { ms = f(win); prv = f(win.slice(0, win.length - 1)); } catch (e) { return null; }
    if (!ms || (!ms.bos && !ms.choch)) return null;
    if (prv && prv.trend === ms.trend && (prv.bos || prv.choch)) return null;
    var lv = fin(ms.level);
    if (!isFinite(lv)) return null;
    var what = ms.choch ? 'change of character' : 'break of structure';
    if (ms.trend === 'bullish') return { kind:'STRUCT-BOS', dir:'long', level: lv,
                                         why: what + ' up through ' + lv.toFixed(2) };
    if (ms.trend === 'bearish') return { kind:'STRUCT-BOS', dir:'short', level: lv,
                                         why: what + ' down through ' + lv.toFixed(2) };
    return null;
  }

  /* SWEEP-V2. goldind's liquidity sweep: the bar takes out a prior extreme,
     closes back inside it, and does so on a volume spike. Distinct from
     POOL-SWEEP, the shared candle-only version with no volume condition — on
     feeds that publish no volume this one simply never fires and POOL-SWEEP
     still covers the geometry. */
  function hgOgSweepV2(rows){
    var f = gfn('goldSweepV2');
    if (!f || !rows || rows.length < 40) return null;
    var s = null;
    try { s = f(ogTail(rows, 100)); } catch (e) { return null; }
    if (!s || !s.trigger) return null;
    var lv = fin(s.level);
    if (!isFinite(lv) || (s.dir !== 'long' && s.dir !== 'short')) return null;
    return { kind:'SWEEP-V2', dir: s.dir, level: lv,
             why:'swept ' + lv.toFixed(2) + ' on a volume spike and closed back inside' };
  }

  /* OB-RETEST. Price returns into an unmitigated order block with structure
     agreeing. Zones and structure are both computed from THIS prefix and
     passed in explicitly — see the note above on _lastActiveZones. */
  function hgOgObRetest(rows){
    var f = gfn('goldOrderBlockRetest'), zf = gfn('goldActiveOrderBlocks'), sf = gfn('goldMarketStructure');
    if (!f || !zf || !sf || !rows || rows.length < 40) return null;
    var r = null;
    /* 90 bars — the tightest window on this desk, and the only one chosen from
       a measurement rather than from an indicator's memory.

       goldActiveOrderBlocks walks every bar hunting displacement and then
       walks FORWARD from each candidate to test mitigation, so it is
       quadratic in its input and the walk-forward calls it once per bar. On a
       full 1,500-bar prefix this single mechanic measured 360 SECONDS for one
       horizon. Windowed, on the same tape and the same replay:

           300 bars   36.0 s        150 bars    9.9 s
           200 bars   18.3 s        120 bars    5.5 s
                                     90 bars    2.1 s

       For scale, the 24 measurable mechanics that predate round five come to
       5.5 s per horizon between them, and the other thirteen added here come
       to 2.5 s. At 300 bars this one mechanic would have cost five times the
       entire backtest phase; at 90 it costs about what the other thirteen do
       together, which is the most it can justify.

       The trading argument agrees with the cost one. 90 bars is roughly four
       days on the scalp horizon and fifteen on the swing, and an order block
       older than that is not what anyone means by unmitigated supply. The
       zones and the structure read must come from the SAME window, or the
       retest is checked against a trend the blocks never saw. */
    var win = ogTail(rows, 90);
    try {
      var st = sf(win);
      if (!st || !st.trend || st.trend === 'neutral') return null;
      var zones = zf(win, undefined, win.length - 1) || [];
      if (!zones.length) return null;
      r = f(win, win.length - 1, st, zones);
    } catch (e) { return null; }
    if (!r || !r.trigger) return null;
    var lv = fin(r.anchor);
    if (!isFinite(lv) || (r.direction !== 'long' && r.direction !== 'short')) return null;
    return { kind:'OB-RETEST', dir: r.direction, level: lv,
             why:'retested an unmitigated order block at ' + lv.toFixed(2) + ' with structure agreeing' };
  }

  /* OU-REVERT. The Ornstein-Uhlenbeck exhaustion read from pinegoldmath: a
     FITTED mean-reverting process rather than a raw z-score, so the mean it
     reverts to is estimated rather than assumed. Distinct from POC-REVERT
     (volume mean) and VWAP-BAND (volume-weighted price mean). */
  function hgOgOuRevert(rows){
    var f = gfn('pineGoldOuZscore');
    if (!f || !rows || rows.length < 80) return null;
    var ou = null;
    try { ou = f(ogTail(rows, 300)); } catch (e) { return null; }
    if (!ou) return null;
    var m = fin(ou.mean), z = fin(ou.z);
    if (!isFinite(m) || !isFinite(z)) return null;
    if (ou.shortExhaust) return { kind:'OU-REVERT', dir:'short', level: m,
                                  why:'OU z-score at ' + z.toFixed(2) + ', stretched above the fitted mean ' + m.toFixed(2) };
    if (ou.longExhaust)  return { kind:'OU-REVERT', dir:'long',  level: m,
                                  why:'OU z-score at ' + z.toFixed(2) + ', stretched below the fitted mean ' + m.toFixed(2) };
    return null;
  }

  /* MFI-SQUAT. Williams' market facilitation index: a SQUAT bar is heavy
     volume that bought no range — the classic pre-break compression — and the
     trade is the bar after it, with range restored on rising volume. Needs
     volume, so on feeds that publish none goldMFI returns NONE and this never
     fires, which is the honest outcome rather than a fabricated one. */
  function hgOgMfiSquat(rows){
    var f = gfn('goldMFI');
    if (!f || !rows || rows.length < 40) return null;
    var m = null;
    try { m = f(ogTail(rows, 100)); } catch (e) { return null; }
    if (!m || m.last !== 'GREEN') return null;
    var ser = m.series || [];
    if (ser.length < 2 || ser[ser.length - 2] !== 'SQUAT') return null;
    var n = rows.length;
    var c = fin(rows[n - 1] && rows[n - 1].c), o = fin(rows[n - 1] && rows[n - 1].o);
    if (!isFinite(c) || !isFinite(o) || c === o) return null;
    return { kind:'MFI-SQUAT', dir: (c > o) ? 'long' : 'short', level: o,
             why:'range expanded on rising volume straight out of a squat bar' };
  }

  /* DI-CROSS. The directional-movement cross, confirmed by ADX TURNING UP.

     The obvious gate — require goldADX to report a trending state at the cross
     — is wrong, and measurably so. ADX is definitionally at its trough on a DI
     cross, because ADX measures the SPREAD between +DI and -DI and that spread
     is zero at the crossover by construction. On a tape built to contain a
     textbook reversal the cross landed with ADX at 7.5, labelled CHOP, three
     bars before the same tape read ADX 30 and TRENDING. Gating on the state
     label meant the mechanic vetoed itself: it fired 22 times in 4,200 sampled
     windows, and every one of those was an accident of a cross drifting into a
     still-elevated reading rather than the setup being described.

     Rising ADX is the honest confirmation. It says the spread is opening after
     the cross, which is the thing a DI cross is supposed to signal, and it is
     available on the cross bar itself rather than three bars late. Whether it
     pays is not decided here — that is the measured-edge gate's job, and it
     now has a mechanic that fires often enough to have an opinion about. */
  function hgOgDiCross(rows){
    var f = gfn('goldADX');
    if (!f || !rows || rows.length < 40) return null;
    var cur = null, prv = null;
    var win = ogTail(rows, 300);
    try { cur = f(win); prv = f(win.slice(0, win.length - 1)); } catch (e) { return null; }
    if (!cur || !prv) return null;
    if (!(fin(cur.adx) > fin(prv.adx))) return null;
    var cp = fin(cur.plusDI), cm = fin(cur.minusDI), pp = fin(prv.plusDI), pm = fin(prv.minusDI);
    if (!isFinite(cp) || !isFinite(cm) || !isFinite(pp) || !isFinite(pm)) return null;
    var lv = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    if (!isFinite(lv)) return null;
    if (pp <= pm && cp > cm) return { kind:'DI-CROSS', dir:'long', level: lv,
                                      why:'+DI crossed above -DI with ADX turning up from ' + fin(prv.adx).toFixed(0) };
    if (pp >= pm && cp < cm) return { kind:'DI-CROSS', dir:'short', level: lv,
                                      why:'-DI crossed above +DI with ADX turning up from ' + fin(prv.adx).toFixed(0) };
    return null;
  }

  /* FVG-HVN. goldind's v2 fair-value gap: a three-bar imbalance that ALSO
     sits on a high-volume node. goldFVGV2 applies that filter itself through
     goldFVGHasHVNSupport, building the profile with goldVolumeProfile when
     none is handed in — so this one mechanic is what puts all three of those
     functions to work.

     DISTINCT FROM FVG-FILL, AND MEASURABLY SO. The obvious objection is that
     the desk already trades imbalances. It does, and they are not the same
     trade: across 300 synthetic tapes FVG-FILL fired 40 times, this fired 21,
     and they landed on the same bar 3 times. FVG-FILL trades price returning
     INTO an old unfilled gap; this trades a FRESH gap that opened where volume
     was already transacting, so the level has a reason to hold beyond its own
     geometry. Two mechanics on one idea would be double-counting, which this
     file has cut a gate for before — an 87% disjoint firing set is not that. */
  function hgOgFvgHvn(rows){
    var f = gfn('goldFVGV2');
    if (!f || !rows || rows.length < 60) return null;
    var g = null;
    /* goldFVGV2 builds a volume profile over its whole input when none is
       supplied, so it carries the same O(n)-per-bar cost as the rest of the
       library. Bounded like every other call here — see the note on ogTail. */
    try { g = f(ogTail(rows, 300)); } catch (e) { return null; }
    if (!g || !g.trigger) return null;
    var lv = fin(g.anchor);
    if (!isFinite(lv) || (g.dir !== 'long' && g.dir !== 'short')) return null;
    var bot = fin(g.bottom), top = fin(g.top);
    var span = (isFinite(bot) && isFinite(top))
             ? (' ' + bot.toFixed(2) + '–' + top.toFixed(2)) : '';
    return { kind:'FVG-HVN', dir: g.dir, level: lv,
             why:'fresh ' + (g.dir === 'long' ? 'bullish' : 'bearish') + ' imbalance'
               + span + ' opened on a high-volume node' };
  }

  /* VP-PLAYBOOK. Gold Volume Profile Playbook §10 — explicit ENTER/WAIT/NO ENTRY
     gates (bias, location A/B+, sweep+reclaim, OB, session, LVN path, RR≥2.0).
     Fires only on ENTER so OMNIGOLD tickets are playbook-clean, not score-blended. */
  function hgOgVpPlaybook(rows, opts){
    var f = gfn('hgGoldVpPlaybook');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var pb = null;
    try {
      pb = f(rows, {
        now: isFinite(opts.nowSec) ? (opts.nowSec > 1e12 ? opts.nowSec : opts.nowSec * 1000) : Date.now(),
        scalp: false,
        news: opts.news || null
      });
    } catch (e) { return null; }
    if (!pb || pb.decision !== 'ENTER' || !pb.dir || !isFinite(pb.entry)) return null;
    var lv = fin(pb.entry);
    if (!isFinite(lv)) return null;
    return {
      kind: 'VP-PLAYBOOK', dir: pb.dir, level: lv,
      stop: isFinite(pb.stop) ? pb.stop : NaN,
      t1: isFinite(pb.t1) ? pb.t1 : NaN,
      t2: isFinite(pb.t2) ? pb.t2 : NaN,
      vpPlaybook: pb,
      why: 'VP playbook ' + pb.decision + ' ' + pb.gatesPass + '/12'
        + (pb.halfSize ? ' half-size' : '')
        + (pb.grade && pb.grade.grade ? (' loc ' + pb.grade.grade) : '')
        + (pb.size && pb.size.pick ? (' · ' + pb.size.pick) : '')
    };
  }

  /* Part4 S9–S18 — live directional forming strategies as native OMNIGOLD
     mechanics. S9 remains a premium/discount filter (not a ticket). S13 silver
     and S16 footprint stay unchecked without XAG / bid-ask feeds. */
  var OG_P4_KIND = {
    p4nr7: 'P4-NR7',
    p4adrx: 'P4-ADRX',
    p4laf: 'P4-LAF'
  };
  function hgOgPart4Hits(rows, opts){
    var f = gfn('hgGoldPart4Engine');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var eng = null;
    try {
      eng = f(rows, {
        newsGate: opts.newsGate || null,
        asia: opts.asia || null
      });
    } catch (e) { return null; }
    if (!eng || !eng.strategies || !eng.strategies.length) return null;
    var out = [], i, s, kind, lv, stop, t1, t2;
    for (i = 0; i < eng.strategies.length; i++){
      s = eng.strategies[i];
      if (!s || !s.dir || (s.grade !== 'forming' && s.grade !== 'confirmed')) continue;
      kind = OG_P4_KIND[s.key];
      if (!kind) continue; /* frame/watch keys stay off the ticket board */
      lv = fin(s.level);
      if (!isFinite(lv) && s.plan) lv = fin(s.plan.entry);
      if (!isFinite(lv)) continue;
      stop = (s.plan && isFinite(s.plan.stop)) ? s.plan.stop : NaN;
      t1 = (s.plan && isFinite(s.plan.t1)) ? s.plan.t1 : NaN;
      t2 = (s.plan && isFinite(s.plan.t2)) ? s.plan.t2 : NaN;
      out.push({
        kind: kind, dir: s.dir, level: lv,
        stop: stop, t1: t1, t2: t2,
        part4: s, part4Engine: eng,
        why: String(s.why || kind)
      });
    }
    return out.length ? out : null;
  }
  function hgOgPart4ByKind(rows, wantKind, opts){
    var hits = hgOgPart4Hits(rows, opts);
    if (!hits) return null;
    var i;
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].kind === wantKind) return hits[i];
    }
    return null;
  }

  /* Part5 S19–S28 — Wyckoff / turtle / VWAP fade / three-drive / news spike.
     S23 KER + S28 weekly bias are filters (not tickets). S21/S26 unchecked
     without GVZ / options OI. Physical feeds unchecked without opts.physical. */
  var OG_P5_KIND = {
    p5wyck: 'P5-WYCK',
    p5turt: 'P5-TURT',
    p5vwap: 'P5-VWAP',
    p5drive: 'P5-DRIVE',
    p5news: 'P5-NEWS'
  };
  function hgOgPart5Hits(rows, opts){
    var f = gfn('hgGoldPart5Engine');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var eng = null;
    try {
      eng = f(rows, {
        newsGate: opts.newsGate || null,
        now: opts.nowSec ? opts.nowSec * 1000 : opts.now,
        physical: opts.physical || null
      });
    } catch (e) { return null; }
    if (!eng || !eng.strategies || !eng.strategies.length) return null;
    var out = [], i, s, kind, lv, stop, t1, t2;
    for (i = 0; i < eng.strategies.length; i++){
      s = eng.strategies[i];
      if (!s || !s.dir || (s.grade !== 'forming' && s.grade !== 'confirmed')) continue;
      kind = OG_P5_KIND[s.key];
      if (!kind) continue;
      lv = fin(s.level);
      if (!isFinite(lv) && s.plan) lv = fin(s.plan.entry);
      if (!isFinite(lv)) continue;
      stop = (s.plan && isFinite(s.plan.stop)) ? s.plan.stop : NaN;
      t1 = (s.plan && isFinite(s.plan.t1)) ? s.plan.t1 : NaN;
      t2 = (s.plan && isFinite(s.plan.t2)) ? s.plan.t2 : NaN;
      out.push({
        kind: kind, dir: s.dir, level: lv,
        stop: stop, t1: t1, t2: t2,
        part5: s, part5Engine: eng,
        why: String(s.why || kind)
      });
    }
    return out.length ? out : null;
  }
  function hgOgPart5ByKind(rows, wantKind, opts){
    var hits = hgOgPart5Hits(rows, opts);
    if (!hits) return null;
    var i;
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].kind === wantKind) return hits[i];
    }
    return null;
  }

  /* Part6 S29–S38 — session composite / z-fade / SMT / failed-sweep.
     S31 skew + S34 DOM unchecked without feeds. S29/S32/S35/S38 are frames. */
  var OG_P6_KIND = {
    p6comp: 'P6-COMP',
    p6zfade: 'P6-ZFADE',
    p6smt: 'P6-SMT',
    p6fail: 'P6-FAIL'
  };
  function hgOgPart6Hits(rows, opts){
    var f = gfn('hgGoldPart6Engine');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var eng = null;
    try {
      eng = f(rows, {
        newsGate: opts.newsGate || null,
        now: opts.nowSec ? opts.nowSec * 1000 : opts.now,
        dxyRows: opts.dxyRows || opts.dxyCandles || null,
        btcRows: opts.btcRows || null,
        events: opts.events || null,
        skew: opts.skew || null,
        dom: opts.dom || null
      });
    } catch (e) { return null; }
    if (!eng || !eng.strategies || !eng.strategies.length) return null;
    var out = [], i, s, kind, lv, stop, t1, t2;
    for (i = 0; i < eng.strategies.length; i++){
      s = eng.strategies[i];
      if (!s || !s.dir || (s.grade !== 'forming' && s.grade !== 'confirmed')) continue;
      kind = OG_P6_KIND[s.key];
      if (!kind) continue;
      lv = fin(s.level);
      if (!isFinite(lv) && s.plan) lv = fin(s.plan.entry);
      if (!isFinite(lv)) continue;
      stop = (s.plan && isFinite(s.plan.stop)) ? s.plan.stop : NaN;
      t1 = (s.plan && isFinite(s.plan.t1)) ? s.plan.t1 : NaN;
      t2 = (s.plan && isFinite(s.plan.t2)) ? s.plan.t2 : NaN;
      out.push({
        kind: kind, dir: s.dir, level: lv,
        stop: stop, t1: t1, t2: t2,
        part6: s, part6Engine: eng,
        why: String(s.why || kind)
      });
    }
    return out.length ? out : null;
  }
  function hgOgPart6ByKind(rows, wantKind, opts){
    var hits = hgOgPart6Hits(rows, opts);
    if (!hits) return null;
    var i;
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].kind === wantKind) return hits[i];
    }
    return null;
  }

  /* Part7 S39–S48 — separated 15m scalp + gold/silver ratio.
     S40 MCX gap is venue-native (not XAUUSD tickets). S41–S48 frames. */
  var OG_P7_KIND = {
    p7scalp: 'P7-SCALP',
    p7ratio: 'P7-RATIO'
  };
  function hgOgPart7Hits(rows, opts){
    var f = gfn('hgGoldPart7Engine');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var eng = null;
    try {
      eng = f(rows, {
        newsGate: opts.newsGate || null,
        now: opts.nowSec ? opts.nowSec * 1000 : opts.now,
        usdInr: opts.usdInr || null,
        kToday: opts.kToday || null,
        silverRows: opts.silverRows || null,
        mcxRows: opts.mcxRows || null,
        priorDay: opts.priorDay || null,
        gvzMinusRealized: opts.gvzMinusRealized,
        newsInHold: opts.newsInHold
      });
    } catch (e) { return null; }
    if (!eng || !eng.strategies || !eng.strategies.length) return null;
    var out = [], i, s, kind, lv, stop, t1, t2;
    for (i = 0; i < eng.strategies.length; i++){
      s = eng.strategies[i];
      if (!s || !s.dir || (s.grade !== 'forming' && s.grade !== 'confirmed')) continue;
      kind = OG_P7_KIND[s.key];
      if (!kind) continue;
      lv = fin(s.level);
      if (!isFinite(lv) && s.plan) lv = fin(s.plan.entry);
      if (!isFinite(lv)) continue;
      stop = (s.plan && isFinite(s.plan.stop)) ? s.plan.stop : NaN;
      t1 = (s.plan && isFinite(s.plan.t1)) ? s.plan.t1 : NaN;
      t2 = (s.plan && isFinite(s.plan.t2)) ? s.plan.t2 : NaN;
      out.push({
        kind: kind, dir: s.dir, level: lv,
        stop: stop, t1: t1, t2: t2,
        part7: s, part7Engine: eng,
        why: String(s.why || kind)
      });
    }
    return out.length ? out : null;
  }
  function hgOgPart7ByKind(rows, wantKind, opts){
    var hits = hgOgPart7Hits(rows, opts);
    if (!hits) return null;
    var i;
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].kind === wantKind) return hits[i];
    }
    return null;
  }

  /* Part8 S49–S58 — quant microstructure. Live: residual / range-bar / geo / VPIN-BO.
     S49/S50/S55/S56/S57/S58 are upgrades/frames (one Flow-family vote). */
  var OG_P8_KIND = {
    p8resid: 'P8-RESID',
    p8range: 'P8-RANGE',
    p8geo: 'P8-GEO',
    p8vpinbo: 'P8-VPINBO'
  };
  function hgOgPart8Hits(rows, opts){
    var f = gfn('hgGoldPart8Engine');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var eng = null;
    try {
      eng = f(rows, {
        newsGate: opts.newsGate || null,
        now: opts.nowSec ? opts.nowSec * 1000 : opts.now,
        calendarEvent: !!opts.calendarEvent,
        headlineCounts: opts.headlineCounts || null,
        residSeries: opts.residSeries || null,
        rGold: opts.rGold || null, rDxy: opts.rDxy || null,
        dReal: opts.dReal || null, rSpx: opts.rSpx || null, rOil: opts.rOil || null,
        weeklyIv: opts.weeklyIv, gvz: opts.gvz,
        journal: opts.gateJournal || opts.journal || null,
        tfHourMult: opts.tfHourMult
      });
    } catch (e) { return null; }
    if (!eng || !eng.strategies || !eng.strategies.length) return null;
    var out = [], i, s, kind, lv, stop, t1, t2;
    for (i = 0; i < eng.strategies.length; i++){
      s = eng.strategies[i];
      if (!s || !s.dir || (s.grade !== 'forming' && s.grade !== 'confirmed')) continue;
      kind = OG_P8_KIND[s.key];
      if (!kind) continue;
      lv = fin(s.level);
      if (!isFinite(lv) && s.plan) lv = fin(s.plan.entry);
      if (!isFinite(lv)) continue;
      stop = (s.plan && isFinite(s.plan.stop)) ? s.plan.stop : NaN;
      t1 = (s.plan && isFinite(s.plan.t1)) ? s.plan.t1 : NaN;
      t2 = (s.plan && isFinite(s.plan.t2)) ? s.plan.t2 : NaN;
      out.push({
        kind: kind, dir: s.dir, level: lv,
        stop: stop, t1: t1, t2: t2,
        part8: s, part8Engine: eng,
        why: String(s.why || kind)
      });
    }
    return out.length ? out : null;
  }
  function hgOgPart8ByKind(rows, wantKind, opts){
    var hits = hgOgPart8Hits(rows, opts);
    if (!hits) return null;
    var i;
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].kind === wantKind) return hits[i];
    }
    return null;
  }

  /* Part9 S59–S66 — trader/SPRT/funding frames + live volume-bar / premium fade.
     S59/S60/S61/S63/S64/S66 are permission/meta (never invent ENTER). */
  var OG_P9_KIND = {
    p9volbar: 'P9-VOLBAR',
    p9prem: 'P9-PREM'
  };
  function hgOgPart9Hits(rows, opts){
    var f = gfn('hgGoldPart9Engine');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var eng = null;
    try {
      eng = f(rows, {
        newsGate: opts.newsGate || null,
        now: opts.nowSec ? opts.nowSec * 1000 : opts.now,
        venue: opts.venue || 'XAUTUSD',
        fundingRate: opts.fundingRate,
        traderJournal: opts.traderJournal || null,
        sprtHits: opts.sprtHits || null,
        rMultiples: opts.rMultiples || null,
        premiumSeries: opts.premiumSeries || null,
        premium: opts.premium,
        indexLast: opts.indexLast,
        indexAtExtreme: !!opts.indexAtExtreme,
        plan: opts.runnerPlan || opts.plan || null,
        nPayments: opts.nPayments,
        holdHours: opts.holdHours
      });
    } catch (e) { return null; }
    if (!eng || !eng.strategies || !eng.strategies.length) return null;
    var out = [], i, s, kind, lv, stop, t1, t2;
    for (i = 0; i < eng.strategies.length; i++){
      s = eng.strategies[i];
      if (!s || !s.dir || (s.grade !== 'forming' && s.grade !== 'confirmed')) continue;
      kind = OG_P9_KIND[s.key];
      if (!kind) continue;
      lv = fin(s.level);
      if (!isFinite(lv) && s.plan) lv = fin(s.plan.entry);
      if (!isFinite(lv)) continue;
      stop = (s.plan && isFinite(s.plan.stop)) ? s.plan.stop : NaN;
      t1 = (s.plan && isFinite(s.plan.t1)) ? s.plan.t1 : NaN;
      t2 = (s.plan && isFinite(s.plan.t2)) ? s.plan.t2 : NaN;
      out.push({
        kind: kind, dir: s.dir, level: lv,
        stop: stop, t1: t1, t2: t2,
        part9: s, part9Engine: eng,
        why: String(s.why || kind)
      });
    }
    return out.length ? out : null;
  }
  function hgOgPart9ByKind(rows, wantKind, opts){
    var hits = hgOgPart9Hits(rows, opts);
    if (!hits) return null;
    var i;
    for (i = 0; i < hits.length; i++){
      if (hits[i] && hits[i].kind === wantKind) return hits[i];
    }
    return null;
  }

  /* ==================== consensus across mechanics ====================

     THE DEFECT THIS EXISTS FOR: on 42% of tapes the desk graded a LONG
     ticket and a SHORT ticket at the same moment, on the same instrument and
     the same horizon, each with a clean ledger. The user is handed two
     contradictory trades and nothing on the card says which one the app
     believes. That is not a confidence problem, it is a correctness problem —
     and every mechanic added makes it more likely, not less.

     Nothing in the twelve-gate ledger ever asked the one question a desk asks
     first: is anything else firing, and does it agree?

     Counting raw agreeing mechanics would be the multiple-comparisons error
     in a different suit. PDH-SWEEP, PWH-SWEEP and EQH-SWEEP are three names
     for "liquidity taken from above and rejected" — they agree with each
     other by construction, not by evidence, and treating them as three
     independent confirmations manufactures confidence out of redundancy. So
     the vote is by FAMILY: mechanics that read the same thing about the tape
     count once between them. */

  var OG_FAMILY = {
    /* liquidity taken and rejected */
    'SPRING':'SWEEP', 'UTAD':'SWEEP', 'KZ-JUDAS':'SWEEP', 'ROUND-MAGNET':'SWEEP',
    'PDH-SWEEP':'SWEEP', 'PDL-SWEEP':'SWEEP', 'PWH-SWEEP':'SWEEP', 'PWL-SWEEP':'SWEEP',
    'EQH-SWEEP':'SWEEP', 'EQL-SWEEP':'SWEEP',
    /* the tape is going somewhere and this joins it */
    'ORB':'TREND', 'MMOVE':'TREND', 'PO3':'TREND', 'ASIA-BREAK':'TREND',
    'NR7-BREAK':'TREND', 'SQUEEZE-FIRE':'TREND', 'TREND-RECLAIM':'TREND',
    'BOS-RETEST':'TREND', 'LONDON-FIX':'TREND',
    /* price is stretched and this fades it */
    'VWAP-REVERT':'REVERSION', 'ADR-FADE':'REVERSION', 'VALUE':'REVERSION',
    'ABSORB':'REVERSION', 'RSI-DIVERGE':'REVERSION',
    /* AVWAP-RECLAIM IS NOT A FADE, AND CALLING IT ONE BROKE A LIVE CARD.
         The detector fires LONG when price crosses UP through the VWAP anchored
         to a swing LOW, and SHORT when it crosses DOWN through one anchored to a
         swing HIGH. Both trade WITH the cross: an up-move resuming after a
         pullback, or a down-move resuming. That is continuation.
         Classed REVERSION, it was exempted from every trend gate, and a live
         gold TICKET came out reading "above the upper Keltner band - the stretch
         a reversion mechanic is fading" on a LONG that was buying that stretch,
         with stoch RSI 100 and the 20-bar range broken above. Six gates
         describing a long as a fade of the move it was joining.
         Every other REVERSION member genuinely fades: VWAP-REVERT, POC-REVERT,
         ADR-FADE, VALUE, ABSORB and RSI-DIVERGE all trade against a stretch.
         This one was alone in being wrong. */
    'AVWAP-RECLAIM':'TREND',
    /* an unfilled inefficiency */
    'FVG-FILL':'IMBALANCE',
    /* round four */
    'PIN-REJECT':'SWEEP', 'ENGULF-LEVEL':'SWEEP', 'THREE-BAR':'SWEEP',
    'POC-REVERT':'REVERSION', 'COINT-SPREAD':'INTERMARKET',
    'CUSUM-SHIFT':'TREND', 'VOL-EXPANSION':'TREND',
    /* round five — gold session / structure */
    'NY-OPEN-DRIVE':'TREND', 'INSIDE-BREAK':'TREND', 'EMA50-HOLD':'TREND', 'FIB-618':'TREND',
    'WEEKLY-OPEN':'SWEEP', 'PIVOT-REJECT':'SWEEP',
    /* the other metal disagrees with this one */
    'SMT-DIVERGE':'INTERMARKET', 'GSR-EXTREME':'INTERMARKET',
    /* ROUND FIVE — the gold indicator library.

       Mapping these is not bookkeeping. hgOgFamilyOf returns 'OTHER' for
       anything unlisted, so fourteen unmapped mechanics would have formed one
       enormous pseudo-family, and consensus counts votes PER FAMILY precisely
       so that correlated mechanics cannot each be counted as independent
       agreement. Seven trend-following reads landing in one bucket called
       OTHER would have voted as a bloc while claiming to be a consensus.

       Seven of them are continuation reads and that is not a mistake in the
       classification — an EMA-ribbon pullback, a cloud break, a structure
       break and a DI cross really are the same idea measured four ways, and
       the family is what stops the desk from mistaking that for four
       independent confirmations. */
    'ICHI-KUMO':'TREND', 'RIBBON-PULLBACK':'TREND', 'HA-FLIP':'TREND',
    'ER-IGNITION':'TREND', 'STRUCT-BOS':'TREND', 'MFI-SQUAT':'TREND',
    'DI-CROSS':'TREND',
    'STOCHRSI-TURN':'REVERSION', 'CCI-EXTREME':'REVERSION',
    'VWAP-BAND':'REVERSION', 'PD-EQUILIBRIUM':'REVERSION', 'OU-REVERT':'REVERSION',
    'SWEEP-V2':'SWEEP',
    'VP-PLAYBOOK':'SWEEP',
    /* Part4 live strategies — one vote per family still applies */
    'P4-NR7':'TREND',
    'P4-ADRX':'REVERSION',
    'P4-LAF':'SWEEP',
    'P5-WYCK':'STRUCTURE',
    'P5-TURT':'SWEEP',
    'P5-VWAP':'FLOW',
    'P5-DRIVE':'STRUCTURE',
    'P5-NEWS':'SWEEP',
    'P6-COMP':'FLOW',
    'P6-ZFADE':'REVERSION',
    'P6-SMT':'SWEEP',
    'P6-FAIL':'SWEEP',
    'P7-SCALP':'FLOW',
    'P7-RATIO':'INTERMARKET',
    /* Part8 — residual is Macro; range/geo are Sweep; VPIN-timed break is Trend.
       BVC/VPIN/ILLIQ upgrades share the existing FLOW vote (not separate). */
    'P8-RESID':'MACRO',
    'P8-RANGE':'SWEEP',
    'P8-GEO':'SWEEP',
    'P8-VPINBO':'TREND',
    /* Part9 — volume-bar is Sweep (parallel S0); premium fade is Fade/reversion. */
    'P9-VOLBAR':'SWEEP',
    'P9-PREM':'REVERSION',
    /* An unmitigated order block is an unfilled inefficiency being revisited,
       which is FVG-FILL's idea with a different name for the zone. */
    'OB-RETEST':'IMBALANCE',
    /* Same family as FVG-FILL by construction — both trade an unfilled
       inefficiency, so consensus must not count them as two independent
       votes even though they fire on different bars. */
    'FVG-HVN':'IMBALANCE'
  };
  /* COLLAPSE FIRST, THEN COUNT — AND LET THE CLEARED ONE KEEP THE CARD.

     The gold header read "12 setup(s) · 2 ticket(s)" and the desk rendered
     ONE ticket. Both numbers were counted over the pre-collapse list while
     the cards were rendered after it. Several mechanics firing the same bar
     produce the same entry, stop, direction and horizon — one trade with
     several names — and when two members of a group both graded TICKET the
     header counted two and the collapse showed one. A ticket count you cannot
     act on twice is a count of positions the reader might size twice.

     The owner rule was the worse half. The FIRST member kept the card, so a
     group holding one cleared setup and one vetoed setup showed whichever
     happened to sort first — and a ticket could be hidden behind a VETO card
     entirely, invisible on the desk while still being counted in the header.
     That is not hypothetical: mechanics on identical levels genuinely grade
     differently, because measured-edge is per mechanic and consensus is per
     family. A cleared member now takes the card. */
  function ogTradeKey(c){
    var pl = (c && c.plan) || {};
    var e = isFinite(fin(pl.entry)) ? fin(pl.entry).toPrecision(8) : 'na';
    var st = isFinite(fin(pl.stop)) ? fin(pl.stop).toPrecision(8) : 'na';
    /* Horizon is part of the key: the same levels on SCALP and SWING are
       genuinely two tickets, with different targets and different time stops. */
    return String(c && c.horizon) + '|' + String(c && c.dir) + '|' + e + '|' + st;
  }
  /* PURE. Counts only — choosing which member keeps the card is the render's
     job, and a counter that mutated the candidates would make the two passes
     depend on each other. */
  function ogDistinctCounts(list){
    var seen = {}, trades = 0, tickets = 0, i, k, c, t;
    for (i = 0; i < (list || []).length; i++){
      c = list[i]; if (!c) continue;
      k = ogTradeKey(c);
      t = !!(c.grade && c.grade.ticket);
      if (seen[k] === undefined){ seen[k] = t; trades++; if (t) tickets++; }
      else if (t && !seen[k]){ seen[k] = true; tickets++; }
    }
    return { trades: trades, tickets: tickets };
  }

  function hgOgFamilyOf(kind){ return OG_FAMILY[String(kind || '')] || 'OTHER'; }

  /* Families voting each way on the bar this hit fired on. */
  function hgOgConsensus(allHits, hit){
    if (!allHits || !allHits.length || !hit) return null;
    /* A family is only a vote if it speaks with ONE voice. SPRING long and
       ROUND-MAGNET short are both SWEEP; counting SWEEP as agreeing AND
       opposing put the same family on both sides of the ledger, inflated
       both counts, and manufactured ties out of a family that simply had no
       opinion. A split family is neutral, and is reported as neutral rather
       than quietly dropped — "the sweep reads are split" is worth knowing. */
    var seen = {}, i, h, fam, k;
    for (i = 0; i < allHits.length; i++){
      h = allHits[i];
      if (!h || !h.kind || (h.dir !== 'long' && h.dir !== 'short')) continue;
      fam = hgOgFamilyOf(h.kind);
      if (!seen[fam]) seen[fam] = { mine: false, theirs: false };
      if (h.dir === hit.dir) seen[fam].mine = true; else seen[fam].theirs = true;
    }
    var agree = [], against = [], split = [];
    for (k in seen){
      if (!Object.prototype.hasOwnProperty.call(seen, k)) continue;
      if (seen[k].mine && seen[k].theirs) split.push(k);
      else if (seen[k].mine) agree.push(k);
      else against.push(k);
    }
    return { agree: agree.sort(), against: against.sort(), split: split.sort(),
             nAgree: agree.length, nAgainst: against.length, nSplit: split.length };
  }

  /* Hits that the ledger has already disqualified must not vote. Live scalp
     tapes were empty because ORB/MMOVE/BOS shorts (which fail `trend` on an
     up stack) and POC shorts (which fail fade-strength into a rally) still
     counted in consensus, so the with-trend ROUND-MAGNET / PO3 long was the
     "minority read". A vetoed setup is not disagreement. */
  function hgOgConsensusVoters(allHits, rows, extra){
    if (!allHits || !allHits.length) return allHits || [];
    extra = extra || {};
    var he21 = extra.htf ? fin(extra.htf.e21) : NaN, he50 = extra.htf ? fin(extra.htf.e50) : NaN;
    var dailyUp = (isFinite(he21) && isFinite(he50)) ? (he21 >= he50) : null;
    var out = [], i, h, rev, agrees;
    for (i = 0; i < allHits.length; i++){
      h = allHits[i];
      if (!h || (h.dir !== 'long' && h.dir !== 'short')) continue;
      rev = hgOgIsReversion(h.kind);
      if (dailyUp === null){ out.push(h); continue; }
      if (!rev){
        agrees = (h.dir === 'long') ? dailyUp : !dailyUp;
        if (!agrees) continue;
      } else if (dailyUp === (h.dir === 'short')) continue;
      out.push(h);
    }
    return out;
  }

  function hgOgClipStop(dir, entry, stop){
    var e = fin(entry), s = fin(stop);
    if (!isFinite(e) || e <= 0 || !isFinite(s)) return NaN;
    var risk = (dir === 'long') ? (e - s) : (s - e);
    if (!(risk > 0)) return NaN;
    var cap = e * GOLD_STOP_MAX_PCT;
    if (risk <= cap) return s;
    return (dir === 'long') ? (e - cap) : (e + cap);
  }

  /* The printed trade IS the mechanic. Pricing entry at live gold while the
     detector named Asia high / a round / an FVG produced the live defect:
     FVG-FILL LONG at 4429 printed ENTRY 4535 / STOP 3415. Sweeps get a stop
     beyond the named level (that is the invalidation). Continuation still
     uses structure from that entry, skipExact so enrichers cannot move it.
     Fades never get a momentum stop: a fade's premise IS the level. */
  function hgOgPlanForHit(hit, rows, extra, cfg){
    cfg = cfg || {};
    extra = extra || {};
    if (!hit || (hit.dir !== 'long' && hit.dir !== 'short')) return null;
    var live = fin(extra.livePx);
    var lvl = fin(hit.level);
    var entry = (isFinite(lvl) && lvl > 0) ? lvl
              : ((isFinite(live) && live > 0) ? live : undefined);
    var minRr = isFinite(fin(cfg.minRr)) ? fin(cfg.minRr) : 1.5;
    var reversion = hgOgIsReversion(hit.kind);
    var fromRisk = gfn('hgPlanFromRisk');
    var planFn = gfn('hgPlanLevels');
    var a = atrOf(rows, 14);
    if (!(isFinite(a) && a > 0) && isFinite(entry)) a = entry * 0.003;

    if (reversion && isFinite(entry) && fromRisk){
      var last = (rows && rows.length) ? rows[rows.length - 1] : null;
      var stop, wick;
      if (hit.dir === 'long'){
        wick = last ? fin(last.l) : NaN;
        stop = ((isFinite(wick) && wick < entry) ? wick : entry) - 0.35 * a;
      } else {
        wick = last ? fin(last.h) : NaN;
        stop = ((isFinite(wick) && wick > entry) ? wick : entry) + 0.35 * a;
      }
      stop = hgOgClipStop(hit.dir, entry, stop);
      if (!isFinite(stop)) return null;
      var sweepPl = fromRisk(hit.dir, entry, stop, {
        t1R: OG_T1_R, t2R: OG_T2_R, minRr: minRr,
        targetPolicy: 'R-multiples of setup-level risk'
      });
      if (sweepPl){
        sweepPl.note = 'SETUP ' + String(hit.kind) + ' @ ' + entry.toFixed(2)
                     + ' — stop beyond the level that is the trade';
        sweepPl.planSrc = 'hgOgPlanForHit';
        sweepPl.dir = hit.dir;
      }
      return sweepPl;
    }

    if (!planFn || !isFinite(entry)) return null;
    var plan = null;
    try {
      plan = planFn(hit.dir, rows, entry, {
        minRr: cfg.minRr, capMode: 'structure', skipExact: true,
        momentumOk: !hgOgIsReversion(hit.kind)
      });
    } catch (eP) { plan = null; }
    if (plan && fromRisk && isFinite(fin(plan.entry)) && isFinite(fin(plan.stop))){
      var clipped = hgOgClipStop(hit.dir, plan.entry, plan.stop);
      if (isFinite(clipped) && Math.abs(clipped - plan.stop) > 1e-9){
        var repl = fromRisk(hit.dir, plan.entry, clipped, {
          t1R: OG_T1_R, t2R: OG_T2_R, minRr: minRr,
          targetPolicy: plan.targetPolicy || 'R-multiples'
        });
        if (repl){
          /* A clipped stop is no longer the WIDE lastSwing the plan engine
             named. Drop that clause or the card's note disagrees with its
             own ENTRY/STOP (test-stop-note-restate). */
          var prevNote = String(plan.note || '');
          if (/\bWIDE\b/.test(prevNote)) prevNote = '';
          repl.note = (prevNote ? (prevNote + ' — ') : '')
                    + 'stop capped at ' + (GOLD_STOP_MAX_PCT * 100).toFixed(1)
                    + '% of gold: a lastSwing that far is not this setup\'s invalidation';
          if (plan.momentumStop === true) repl.momentumStop = true;
          repl.planSrc = plan.planSrc;
          repl.dir = hit.dir;
          plan = repl;
        }
      }
    }
    return plan;
  }

  /* ==================== gold gate ledger ==================== */

  /* Standard normal CDF (Abramowitz & Stegun 26.2.17). Inlined rather than
     borrowed from the indicator library so that a piece of pure arithmetic
     can never read "unavailable" because a script did not load. */
  function hgOgNormCdf(z){
    if (!isFinite(z)) return NaN;
    var sgn = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2;
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sgn * y);
  }

  /* THE MULTIPLE-COMPARISONS BAR.

     This desk scans OG_MECHANICS.length mechanics and reports the ones that
     look good. Judging each against a lone 5% threshold answers the wrong
     question: with 27 mechanics tried, the BEST of them clears +1.6σ by pure
     chance most of the time, so "+1.47σ vs breakeven" on a card is not
     evidence of anything — it is what searching twenty-seven ways looks like.

     Sidak: the per-mechanic threshold that holds the FAMILY-wise false
     positive rate at 5% across k independent tries. Inverted by bisection
     because the closed form is not worth carrying. */
  function hgOgFamilyZ(k){
    var n = Math.floor(fin(k));
    if (!isFinite(n) || n < 1) n = 1;
    var target = Math.pow(0.95, 1 / n);        /* per-test confidence needed */
    var lo = 0, hi = 8, mid, i;
    for (i = 0; i < 64; i++){
      mid = (lo + hi) / 2;
      if (hgOgNormCdf(mid) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function emaOf(vals, n){
    if (!vals || vals.length < n || n <= 0) return NaN;
    var k = 2 / (n + 1), e = vals[0], i;
    for (i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
    return e;
  }

  /* Gold's own direction. Not crypto MARKET PICTURE (that majority is
     BTC/ETH/SOL/GOLD and can stay LONG-LEANING while XAU is dropping).
     Side requires the EMA stack to agree: last below EMA21 AND EMA21
     below EMA50 is SHORT; last above EMA21 AND EMA21 above EMA50 is
     LONG. A 5-bar dip under EMA21 while the stack is still up is a
     pullback — unread — not "gold is going down". Empty = unread. */
  function hgOgTapeDir(rows){
    try{
      if (!rows || rows.length < 55) return '';
      var closes = closesOf(rows);
      if (closes.length < 55) return '';
      var last = closes[closes.length - 1];
      var e21 = emaOf(closes, 21);
      var e50 = emaOf(closes, 50);
      if (!isFinite(last) || !isFinite(e21) || !isFinite(e50)) return '';
      var below = last < e21, above = last > e21;
      var downStack = e21 < e50, upStack = e21 > e50;
      if (below && downStack) return 'short';
      if (above && upStack) return 'long';
      return '';
    }catch(e){ return ''; }
  }
  /* One side for the whole tab only when both horizons agree (or one is
     unread). Scalp DOWN + swing UP is MIXED — not "gold is going down".
     Each horizon's pick still follows that horizon's own tape. Empty =
     mixed or both unread. */
  function hgOgDeskTape(scalpDir, swingDir){
    var a = String(scalpDir || ''), b = String(swingDir || '');
    if (a && b && a !== b) return '';
    if (a === 'short' || b === 'short') return 'short';
    if (a === 'long' || b === 'long') return 'long';
    return '';
  }
  function hgOgTapeLabel(dir){
    if (dir === 'short') return 'DOWN';
    if (dir === 'long') return 'UP';
    return 'UNREAD';
  }
  function hgOgTapeBannerHtml(scalpDir, swingDir){
    var desk = hgOgDeskTape(scalpDir, swingDir);
    var a = String(scalpDir || ''), b = String(swingDir || '');
    var h = '<div class="note og-tape" role="status"><b>GOLD TAPE</b> — gold\'s own bars, not the crypto cascade. ';
    h += 'Scalp ' + hgOgTapeLabel(scalpDir) + ' · Swing ' + hgOgTapeLabel(swingDir) + '.';
    if (desk === 'short')
      h += ' Gold is going down — this tab will not pick a LONG.';
    else if (desk === 'long')
      h += ' Gold is going up — this tab will not pick a SHORT.';
    else if (a && b && a !== b)
      h += ' Mixed tape — each horizon follows its own bars; this tab will not call gold down while swing is up.';
    h += '</div>';
    return h;
  }
  function closesOf(rows){
    var out = [], i, c;
    if (!rows || !rows.length) return out;
    /* A null ENTRY, not just a null array: a feed that drops a bar leaves a
       hole in the middle, and reaching through it threw from inside whatever
       gate happened to call this first. Skip the hole, keep the series. */
    for (i = 0; i < rows.length; i++){
      if (!rows[i]) continue;
      c = num(rows[i].c);
      if (isFinite(c)) out.push(c);
    }
    return out;
  }
  function atrOf(rows, n){
    if (!rows || rows.length < n + 1) return NaN;
    var sum = 0, cnt = 0, i, h, l, pc, tr;
    for (i = rows.length - n; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l); pc = num(rows[i - 1].c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
      tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      sum += tr; cnt++;
    }
    return cnt ? sum / cnt : NaN;
  }
  /* Moved to hg-gates.js. These two helpers were byte-identical in both desks
     (1,330 chars, verbatim) because the fix was written once and pasted; the
     shim keeps this file working if hg-gates.js somehow fails to load, rather
     than throwing a ReferenceError mid-scan. */
  function hgSlotMeanVol(rows, want){
    var w = W();
    return (w && typeof w.hgSlotMeanVol === 'function')
      ? w.hgSlotMeanVol(rows, want)
      : { mean: NaN, n: 0 };
  }

  function meanVol(rows, n){
    if (!rows || !rows.length) return NaN;
    var s = 0, c = 0, i, v;
    for (i = Math.max(0, rows.length - n); i < rows.length; i++){
      v = num(rows[i].v); if (isFinite(v)) { s += v; c++; }
    }
    return c ? s / c : NaN;
  }

  /* Map a native detector kind onto goldind's institutional stratKey.
     Sweep families must clear MSS + displacement + IFVG. OB-RETEST is
     volume-weighted. ASIA-BREAK is allowed inside the Asian box. Every
     other mechanic still runs news / spread / macro / session / MTF. */
  function hgOgKindToInstKey(kind){
    var k = String(kind || '').toUpperCase();
    if (k === 'ASIA-BREAK') return 'asian';
    if (k === 'OB-RETEST') return 'ob';
    if (k === 'VP-PLAYBOOK') return 'vpbook';
    if (k === 'P4-NR7') return 'p4nr7';
    if (k === 'P4-ADRX') return 'p4adrx';
    if (k === 'P4-LAF') return 'p4laf';
    if (k === 'P5-WYCK') return 'p5wyck';
    if (k === 'P5-TURT') return 'p5turt';
    if (k === 'P5-VWAP') return 'p5vwap';
    if (k === 'P5-DRIVE') return 'p5drive';
    if (k === 'P5-NEWS') return 'p5news';
    if (k === 'P6-COMP') return 'p6comp';
    if (k === 'P6-ZFADE') return 'p6zfade';
    if (k === 'P6-SMT') return 'p6smt';
    if (k === 'P6-FAIL') return 'p6fail';
    if (k === 'P7-SCALP') return 'p7scalp';
    if (k === 'P7-RATIO') return 'p7ratio';
    if (k === 'P8-RESID') return 'p8resid';
    if (k === 'P8-RANGE') return 'p8range';
    if (k === 'P8-GEO') return 'p8geo';
    if (k === 'P8-VPINBO') return 'p8vpinbo';
    if (k === 'P9-VOLBAR') return 'p9volbar';
    if (k === 'P9-PREM') return 'p9prem';
    if (k === 'KZ-JUDAS' || k === 'SWEEP-V2' || k === 'POOL-SWEEP'
        || k.indexOf('SWEEP') >= 0)
      return 'sweep';
    return 'vwap';
  }

  function hgOgInstNowMs(extra){
    extra = extra || {};
    var ms = fin(extra.nowMs);
    if (isFinite(ms) && ms > 0) return ms;
    var sec = fin(extra.nowSec);
    if (isFinite(sec) && sec > 1e11) return sec;
    if (isFinite(sec) && sec > 0) return sec * 1000;
    return NaN;
  }

  /* Same hgGoldInstFilter stack as GOLD SCALP / GOLD SWING. Fail-open when
     goldind.js is not loaded (the core omnigold harness does not boot it).
     Does not move hit.level or rewrite the stop — it only returns a veto. */
  function hgOgInstFilterHit(hit, rows, extra){
    extra = extra || {};
    hit = hit || {};
    var fn = gfn('hgGoldInstFilter');
    if (typeof fn !== 'function'){
      return { dropped: false, reason: 'goldind inst filter not loaded — fail-open', unchecked: true };
    }
    var dir = String(hit.dir || extra.dir || '').toLowerCase();
    var scalp = extra.sessionHard === true;
    var nowMs = hgOgInstNowMs(extra);
    var w = W();
    var quote = extra.quote || extra.spread || (w && w.__hgGoldQuote) || null;
    var l2 = extra.l2 || extra.l2OrderBook || extra.l2Book || (w && w.__hgGoldL2Book) || null;
    var cand = {
      dir: dir,
      stratKey: hgOgKindToInstKey(hit.kind),
      why: extra.why || hit.why || '',
      stamps: [],
      gateNotes: []
    };
    var ctx = {
      rows: rows,
      scalp: scalp,
      hardReject: scalp,
      macro: extra.macro,
      dxyRows: extra.dxyRows || (extra.macro && extra.macro.dxyRows),
      tnxRows: extra.tnxRows || extra.yieldRows
             || (extra.macro && (extra.macro.tnxRows || extra.macro.us10yRows)),
      news: extra.news,
      rows4h: extra.rows4h,
      rows1d: extra.rows1d || extra.dailyCandles,
      l2OrderBook: l2,
      spreadUsd: extra.spreadUsd,
      spread: extra.spread,
      bid: extra.bid || (quote && (quote.bid != null ? quote.bid : quote.b)),
      ask: extra.ask || (quote && (quote.ask != null ? quote.ask : quote.a)),
      nowMs: nowMs
    };
    var r;
    try { r = fn(cand, ctx); }
    catch (eInst){
      return { dropped: false, reason: 'inst filter threw — fail-open', unchecked: true };
    }
    r = r || cand;
    return {
      dropped: !!r.dropped,
      reason: r.reason || '',
      unchecked: false,
      demoted: !!r.demoted,
      sessionWeight: r.sessionWeight,
      stopFloorAtr: r.stopFloorAtr,
      cand: r
    };
  }

  /* Gold's ledger. Perp gates (funding, OI, retail, taker) do not exist on
     spot gold and are deliberately absent rather than faked. */
  function hgOgGates(rows, hit, extra){
    var gates = [], x = extra || {};
    /* One guarded read of the trigger bar. rows[rows.length-1] on an empty
       array is undefined, and reaching through it threw before any gate had
       been pushed — so the whole ledger vanished rather than degrading to
       UNCHECKED. Not reachable from the live scan (detect needs 40 bars
       first) but a ledger that can throw is a ledger that can take the card
       with it. */
    var lastBar = (rows && rows.length) ? rows[rows.length - 1] : null;
    var closes = closesOf(rows || []);
    var e21 = emaOf(closes.slice(-60), 21), e50 = emaOf(closes.slice(-120), 50);
    var last = closes.length ? closes[closes.length - 1] : NaN;
    /* PLAN-LEVELS — a TICKET with nothing to place is not a ticket.

       The desk's single ticket read:

         GOLD · SCALP · AVWAP-RECLAIM LONG   TICKET 29/32 checks
         no plan — structure could not clear the R floor, so no levels are shown.
         UNCHECKED cost-drag    no plan risk to cost
         UNCHECKED stop-width   no plan yet — stop width cannot be judged

       The plan engine had returned null, the card said so plainly, and the
       ledger graded it TICKET anyway. Nothing in thirty-two gates asked
       whether there was a trade to take. cost-drag and stop-width both
       noticed and both are soft, so their UNCHECKED could not block it.

       A ticket is the desk saying "this cleared, act on it". With no entry,
       no stop and no target there is nothing to act on, and calling it a
       ticket is the worst thing this ledger can do: every other veto tells
       you why to stand aside, and this one invited you in with no levels.

       THREE STATES, deliberately:
         plan present and complete -> PASS
         plan explicitly null      -> VETO. The engine ran and produced
                                      nothing; that is a decision, not a gap.
         no plan key at all        -> UNCHECKED and soft. The caller never
                                      offered one, so this gate has nothing to
                                      judge and must not invent a veto. */
    var plHas = !!(x && Object.prototype.hasOwnProperty.call(x, 'plan'));
    var plObj = plHas ? x.plan : undefined;
    var plOk = null, plWhy = 'no plan supplied to the ledger — not judged here';
    if (plHas){
      if (!plObj){
        plOk = false;
        /* SAY WHY THERE ARE NO LEVELS. "no plan" and the card's own subtitle
           "structure could not clear the R floor" both point at R:R, and on
           live gold the real cause was stop DISTANCE: price had run 2.74% in
           a day, the nearest swing low sat 165 points below at 7.76xATR, and
           the plan engine refuses anything past 6xATR rather than inventing a
           tighter stop. Six of nine scalp cards were dropped for that, and
           the card blamed the wrong thing. Diagnosed here from the same swing
           and ATR the engine used, so the reader learns the actual geometry
           instead of a category. */
        plWhy = 'NO LEVELS — the plan engine produced no entry, stop or target, '
              + 'so there is nothing to place';
        try {
          var pSwFn = gfn('lastSwing');
          var pAtr = atrOf(rows, 14);
          var pSw = pSwFn ? fin(pSwFn(rows, hit.dir, 20)) : NaN;
          var pLast = (rows && rows.length) ? fin(rows[rows.length - 1].c) : NaN;
          if (isFinite(pSw) && isFinite(pAtr) && pAtr > 0 && isFinite(pLast)){
            var pMult = Math.abs(pLast - pSw) / pAtr;
            plWhy += ' — the nearest swing ' + (hit.dir === 'long' ? 'low' : 'high')
                   + ' is ' + Math.abs(pLast - pSw).toFixed(0) + ' points away ('
                   + pMult.toFixed(1) + '×ATR)'
                   + (pMult > 6 ? ', past the 6×ATR limit, so no stop can be placed on structure'
                                : ', which the engine could not turn into a usable plan');
          }
        } catch (ePl){}
      } else {
        var pE = fin(plObj.entry), pS = fin(plObj.stop), pT = fin(plObj.t1);
        if (isFinite(pE) && isFinite(pS) && isFinite(pT) && pE !== pS){
          plOk = true;
          plWhy = 'entry, stop and target all present';
        } else {
          plOk = false;
          plWhy = 'INCOMPLETE LEVELS — '
                + (!isFinite(pE) ? 'no entry' : !isFinite(pS) ? 'no stop'
                   : !isFinite(pT) ? 'no target' : 'entry equals stop')
                + ', so there is nothing to place';
        }
      }
    }
    gates.push({ key:'plan-levels', hard:false, pass: plOk, why: plWhy });

    /* LEVEL-FRESH — the levels must survive contact with the CURRENT price.

       The desk drops the forming candle before anything reads a bar, which is
       right for every indicator. But the plan then prices its entry at the
       last CLOSED bar — up to four hours stale on the swing horizon — and no
       gate ever compared it against where the market actually is.

       Demonstrated live: every swing card quoted entry 4391.83 while the
       market traded 4499.23, 107 points off the reader's chart. The two
       SHORT cards carried stops at 4449 with the market at 4499 — fifty
       points beyond the stop before the trade was ever placed — and earlier
       the desk TICKETED one of those. A ticket whose stop the market has
       already crossed is dead on arrival: filled at market, it is an instant
       stop-out presented as a 2R setup.

       Three states:
         market beyond the stop            -> VETO, dead on arrival
         entry more than 1.5xATR from      -> AGAINST (info). The levels are a
         the market                           resting-order plan around stale
                                              structure, not a market entry,
                                              and the card must say which
         otherwise                         -> PASS, quoting the gap

       UNCHECKED when no live price is supplied — harnesses and callers that
       predate this gate keep working, and unknown reads UNCHECKED, never
       PASS. */
    /* THE UNCHECKED REASON MUST BE TRUE. This printed "no live price supplied"
       on a card whose own DEAD LEVELS block quoted the live price — the plan
       was what was missing, and a diagnostic that misreports its own inputs
       sends the reader chasing the wrong absence. Three distinct reasons. */
    var lfOk = null, lfWhy = 'no live price supplied — freshness not judged', lfInfo = false;
    /* Prefer gold-api live spot when supplied — closed-bar livePx alone
       leaves swing entries priced off a 4h print the market has left. */
    var lfPx = NaN;
    if (x){
      if (isFinite(fin(x.marketPx)) && fin(x.marketPx) > 0) lfPx = fin(x.marketPx);
      else lfPx = fin(x.livePx);
    }
    if (isFinite(lfPx) && lfPx > 0 && !(plHas && plObj)){
      lfWhy = 'live price in hand (' + lfPx.toFixed(2) + ') but no plan to judge — see plan-levels';
    }
    if (isFinite(lfPx) && lfPx > 0 && plHas && plObj){
      var lfE = fin(plObj.entry), lfS = fin(plObj.stop);
      if (isFinite(lfE) && isFinite(lfS)){
        var lfAtr = atrOf(rows, 14);
        var lfGap = lfPx - lfE;
        var crossed = (hit.dir === 'short') ? (lfPx >= lfS) : (lfPx <= lfS);
        if (crossed){
          lfOk = false;
          lfWhy = 'DEAD ON ARRIVAL — the market (' + lfPx.toFixed(2) + ') is already '
                + Math.abs(lfPx - lfS).toFixed(0) + ' points beyond the stop ('
                + lfS.toFixed(2) + '): these levels were priced off a closed bar the market has left behind';
        } else if (isFinite(lfAtr) && lfAtr > 0 && Math.abs(lfGap) > 1.5 * lfAtr){
          lfOk = false; lfInfo = true;
          lfWhy = 'entry ' + lfE.toFixed(2) + ' sits ' + Math.abs(lfGap).toFixed(0) + ' points ('
                + (Math.abs(lfGap) / lfAtr).toFixed(1) + '×ATR) from the market (' + lfPx.toFixed(2)
                + ') — a resting-order plan around stale structure, not a market entry';
        } else {
          lfOk = true;
          lfWhy = 'levels within reach of the market (' + lfPx.toFixed(2) + ', '
                + Math.abs(lfGap).toFixed(0) + ' points from entry)';
        }
      }
    }
    gates.push({ key:'level-fresh', hard:false, info: lfInfo, pass: lfOk, why: lfWhy });

    /* MOMENTUM-STOP — a volatility stop, not structure. Continuation
       mechanics may still RECEIVE one from the plan engine (otherwise a
       runaway tape has no levels at all). The ledger flags it AGAINST
       (info) so the compromise is on the card; it does NOT veto the
       ticket. v420 made this a real veto and emptied the desk: fades
       already fail fade-strength, continuation had only a vol stop, and
       the user saw "no setup with ticket". Fades never get a momentum
       stop (momentumOk is off for reversions). */
    var msOk = null, msWhy = 'stop is on structure, or no plan to judge';
    if (plHas && plObj){
      if (plObj.momentumStop === true){
        msOk = false;
        msWhy = 'stop is a VOLATILITY stop, not structure — noise can stop this trade '
              + 'without the idea being wrong; size accordingly';
      } else {
        msOk = true;
        msWhy = 'stop rests on structure';
      }
    }
    gates.push({ key:'momentum-stop', hard:false, info:true, pass: msOk, why: msWhy });

    var reversion = hgOgIsReversion(hit.kind);

    /* 1 — trend, graded by family (see omniroute: vetoing a reversion setup
       for being counter-trend is a category error) */
    var trendOk = null, trendWhy = 'EMA unavailable';
    if (isFinite(e21) && isFinite(e50) && isFinite(last)){
      var up = e21 >= e50;
      var agrees = (hit.dir === 'long') ? up : !up;
      if (reversion){
        trendOk = true;
        trendWhy = 'EMA21 ' + (up ? '≥' : '<') + ' EMA50 — '
                 + (agrees ? 'trend agrees' : 'counter-trend, which is what this setup IS')
                 + ' (context only for a reversion setup)';
      } else {
        trendOk = agrees;
        trendWhy = 'EMA21 ' + (up ? '≥' : '<') + ' EMA50' + (agrees ? ' — with the setup' : ' — against the setup');
      }
    }
    gates.push({ key:'trend', hard: !reversion, pass: trendOk, why: trendWhy });

    /* 2 — volatility alive */
    var atr = atrOf(rows, 14), atrPct = (isFinite(atr) && isFinite(last) && last > 0) ? (atr / last * 100) : NaN;
    /* Per-horizon: ATR% scales with sqrt(bar length), so a 1h bar cannot be
       held to a 4h floor. Gold is also far less volatile than alts. */
    var minAtr = isFinite(fin(x.minAtrPct)) ? fin(x.minAtrPct) : 0.12;
    var volOk = isFinite(atrPct) ? (atrPct >= minAtr) : null;
    gates.push({ key:'vol-alive', hard:true, pass: volOk,
      /* 3dp, not 2. Gold ATR% sits right on the scalp floor, so at 2dp a
         vetoed 0.0499% and a passing 0.0501% both printed "0.05%" — the card
         showed a number that appeared to satisfy the very floor it had just
         failed. A gate must not display a value that contradicts its own
         verdict. */
      why: isFinite(atrPct) ? ('ATR ' + atrPct.toFixed(3) + '% of price (floor ' + minAtr + '%)' + (volOk ? '' : ' — too dead')) : 'ATR unavailable' });

    /* 3 — participation. CONDITIONAL on gold, unlike crypto: several gold
       feeds (spot proxies especially) publish no volume at all, and a hard
       volume gate would silently disqualify every setup sourced from them. */
    /* fin, not num: +null is 0 and isFinite(0) is true, so a feed publishing
       a null volume would score 0.00x and be vetoed rather than read as
       "no volume published". */
    var lv = lastBar ? fin(lastBar.v) : NaN;
    var slotV = hgSlotMeanVol(rows, 20);
    var usedSlot = isFinite(slotV.mean);
    var mv = usedSlot ? slotV.mean
                      : (lastBar ? meanVol(rows.slice(0, rows.length - 1), 20) : NaN);
    var partOk = null, partWhy = 'this gold feed publishes no volume';
    if (isFinite(mv) && isFinite(lv) && mv > 0){
      partOk = lv >= mv * 0.7;
      partWhy = 'trigger vol ' + (lv / mv).toFixed(2)
              + (usedSlot ? '× the mean for THIS TIME OF DAY over the last ' + slotV.n + ' sessions'
                          : '× 20-bar mean — too little history to correct for the session');
    }
    /* INFO, NOT A VETO — and that is a correction, not a loosening.

       The comment above says participation is "CONDITIONAL on gold", and the
       header says a hard volume gate "would silently disqualify" gold setups.
       The code did not implement that intent: hard:false WITHOUT info:true
       still vetoes in hgOmniGrade — test-info-gate-grading.mjs asserts exactly
       that ("a hard:false gate with no info flag STILL vetoes"). So on any
       feed that does publish volume, PAXG included, this was a full veto.

       It was also pointing the wrong way. Split every gold firing by this
       gate's own verdict and resolve at the 2R where T1 sits:

         SCALP   passed 27.7% (n=2856)   vetoed 35.2% (n=1737)   z = -5.38
         SWING   passed 27.7% (n=2330)   vetoed 30.7% (n=2039)   z = -2.19

       Both horizons, thousands of samples, well outside noise: the bars this
       gate threw away did BETTER than the ones it kept, and it was discarding
       38% of scalp firings and 47% of swing firings to do it.

       That is economically unsurprising for gold. A high-volume bar on a
       metal is frequently the move already spent — a fix print, a data
       release, an exhaustion candle — whereas crypto breakouts genuinely need
       turnover behind them. The rule came from the crypto desk, where it
       belongs, and does not transfer.

       NOT INVERTED. Vetoing high volume instead would fit the sign of this
       sample on one instrument, which is how a backtest edge gets
       manufactured. The reading stays on the card, under "against:", and
       stops standing trades aside. Whether low participation actually PAYS on
       gold is a question for the forward log, not for this gate. */
    gates.push({ key:'participation', hard:false, info:true, pass: partOk, why: partWhy });

    /* 4 — daily agreement */
    var he21 = x.htf ? fin(x.htf.e21) : NaN, he50 = x.htf ? fin(x.htf.e50) : NaN;
    var d1 = null, d1Why = 'daily bars unavailable';
    if (isFinite(he21) && isFinite(he50)){
      var upD = he21 >= he50;
      var dAgrees = (hit.dir === 'long') ? upD : !upD;
      d1 = reversion ? true : dAgrees;
      d1Why = 'daily EMA' + DAILY_FAST + (upD ? ' ≥ ' : ' < ') + 'EMA' + DAILY_SLOW
            + (reversion ? (dAgrees ? ' — agrees' : ' — counter-trend (expected for a reversion setup)')
                         : (dAgrees ? ' — agrees' : ' — disagrees with the setup'));
    }
    gates.push({ key:'htf-daily', hard:false, pass: d1, why: d1Why });

    /* 5 — session. Gold's character is session-bound in a way alts are not:
       the London and NY killzones carry the volume that makes intraday
       structure mean anything. Off-hours is not a veto (swing setups are
       legitimately born there) but it is reported. */
    var sess = null, sessWhy = 'killzone module unavailable';
    if (x.killzone && x.killzone.zone){
      var z = String(x.killzone.zone);
      var inKz = (z !== 'OFF');
      /* Session is decisive INTRADAY and merely contextual on the swing
         horizon — a 4h structure is legitimately born at any hour, and
         vetoing it for the clock (as the first live build did) grades it
         against a scalper's model. The comment said this; the code did not. */
      if (x.sessionHard === false){
        sess = true;
        sessWhy = 'session ' + (x.killzone.label || z)
                + (inKz ? '' : ' — off-hours, context only at swing horizon');
      } else {
        sess = inKz;
        sessWhy = 'session ' + (x.killzone.label || z) + (inKz ? '' : ' — outside the London/NY killzones');
      }
    }
    gates.push({ key:'session', hard:false, pass: sess, why: sessWhy });

    /* 6 — real-rate macro. Gold's primary fundamental driver. */
    var mac = null, macWhy = 'macro module has not run';
    if (x.macro && x.macro.realRateHint){
      var hint = String(x.macro.realRateHint).toUpperCase();
      if (hint === 'TAILWIND') mac = (hit.dir === 'long');
      else if (hint === 'HEADWIND') mac = (hit.dir === 'short');
      else mac = true;                                  // NEUTRAL blocks nothing
      macWhy = 'real rates ' + hint + (mac ? '' : ' — against the setup side');
    }
    gates.push({ key:'macro-realrate', hard:false, pass: mac, why: macWhy });

    /* 7 — DXY. Gold trades inversely to the dollar often enough that a
       strongly trending DXY on the wrong side is a genuine headwind. */
    var dxy = null, dxyWhy = 'DXY unavailable';
    if (x.macro && x.macro.dxy && typeof x.macro.dxy.trend20 === 'string'){
      var dt = String(x.macro.dxy.trend20).toUpperCase();
      if (dt.indexOf('UP') >= 0) dxy = (hit.dir === 'short');
      else if (dt.indexOf('DOWN') >= 0) dxy = (hit.dir === 'long');
      else dxy = true;
      dxyWhy = 'DXY 20d ' + dt + (dxy ? ' — inverse supports the setup' : ' — inverse opposes the setup');
    }
    gates.push({ key:'dxy-inverse', hard:false, pass: dxy, why: dxyWhy });

    /* 8 — yield guard, from goldind's own validator */
    /* getGoldMacro() exposes tnxTrend (US10Y direction), NOT a US10Y candle
       series — the first build asked for rows that never existed, so this
       gate read UNCHECKED on every card. Rising nominal yields are a
       headwind for gold longs; falling yields for shorts. */
    var yld = null, yldWhy = 'US10Y trend unavailable';
    if (x.macro && typeof x.macro.tnxTrend === 'string' && x.macro.tnxTrend){
      var yt = String(x.macro.tnxTrend).toUpperCase();
      if (yt.indexOf('RIS') >= 0) yld = (hit.dir === 'short');
      else if (yt.indexOf('FALL') >= 0) yld = (hit.dir === 'long');
      else yld = true;                                   // FLAT blocks nothing
      yldWhy = 'US10Y ' + yt + (yld ? ' — supports this direction' : ' — headwind for this direction');
    } else if (x.yieldRows){
      var yv = hgOgYieldValid(x.yieldRows, hit.dir);
      if (yv && typeof yv.valid === 'boolean'){
        yld = yv.valid;
        yldWhy = yv.reason || (yld ? 'yield guard clear' : 'yield guard flags this direction');
      }
    } else if (x.yield && typeof x.yield.valid === 'boolean'){
      yld = x.yield.valid;
      yldWhy = 'yield guard ' + (yld ? 'clear' : 'flags this direction')
             + (x.yield.reason ? (' — ' + x.yield.reason) : '');
    }
    gates.push({ key:'yield-guard', hard:false, pass: yld, why: yldWhy });

    /* 9 — ADR budget. Chasing a breakout after the day has spent its range
       is how intraday gold trades die. */
    var adr = null, adrWhy = 'ADR unavailable';
    if (x.adr && isFinite(fin(x.adr.usedPct))){
      var used = fin(x.adr.usedPct);
      var continuation = !reversion;
      adr = continuation ? (used < 100) : true;   // fades WANT an exhausted day
      adrWhy = 'day has used ' + used.toFixed(0) + '% of ADR'
             + (adr ? '' : ' — too late to chase a continuation');
    }
    gates.push({ key:'adr-budget', hard:false, pass: adr, why: adrWhy });

    /* 10 — news. Gold is the most event-sensitive instrument in the app;
       NFP/CPI/FOMC routinely move it multiples of ATR in seconds.
       An unloaded module reads UNCHECKED, never a low-risk pass. */
    /* Moved to hg-gates.js — the decision was byte-identical in both desks
       (2,730 chars, verbatim). It emptied BOTH tabs for days and the fix had
       to be written twice; that is what this module exists to stop. */
    var __nwG = W(), __nw;
    if (__nwG && typeof __nwG.hgNewsGate === 'function'){
      __nw = __nwG.hgNewsGate(x.news);
    } else {
      /* hg-gates.js absent: UNCHECKED, never a quiet pass. */
      __nw = { pass: null, info: false, why: 'news gate module (hg-gates.js) not loaded' };
    }
    var nw = __nw.pass, nwWhy = __nw.why, nwInfo = __nw.info;
    gates.push({ key:'news-window', hard:false, info: nwInfo, pass: nw, why: nwWhy });

    /* 11 — cost drag. A stop can be structurally correct and still be
       untradeable: the walk-forward measures GROSS outcomes, so a tight
       intraday stop can show a healthy R multiple that the spread then eats.
       On the first live scalp card a 3.16-point stop meant a $0.30 spread
       was 19% of 1R, turning a measured +0.38R into roughly +0.19R net. */
    var cost = null, costWhy = 'no plan risk to cost';
    var planRisk = fin(x.planRisk);
    if (isFinite(planRisk) && planRisk > 0){
      var rt = ASSUMED_SPREAD_USD * 2;
      var costR = rt / planRisk;
      var costCeil = (x.sessionHard === true) ? COST_VETO_R_SCALP : COST_VETO_R;
      cost = costR <= costCeil;
      costWhy = 'round-trip ~$' + rt.toFixed(2) + ' on a $' + planRisk.toFixed(2) + ' stop = '
              + (costR * 100).toFixed(0) + '% of 1R'
              + (costR > costCeil ? ' — the spread would eat most of the edge'
                 : (costR > COST_WARN_R ? ' — material drag, size accordingly' : ''));
    }
    gates.push({ key:'cost-drag', hard:false, pass: cost, why: costWhy });

    /* FILL RISK — a limit away from market is not a position until it fills.

       Nothing on the card said so, and it is not a small effect. Replaying
       every gold setup the desk forms (near setups only, the ones the picker
       shows) and asking whether price ever traded the plan's entry inside the
       horizon, on 1,000 PAXG bars per horizon:

         |entry-market|   SCALP never fills   SWING never fills
           0-0.1R              5.3%                0.5%
           0.1-0.25R          14.0%                7.0%
           0.25-0.5R          21.3%               18.7%
           0.5-1R             15.8%               20.3%
           1R+                25.9%               33.6%

       Roughly one in ten shown setups overall never trades, and past a
       quarter-R from market it is one in five. The same replay also showed
       why this must be DISCLOSED and not assumed away: counting away-limits
       as if they always filled flipped a -0.285R population to +0.401R on
       paper, because the limits that never fill are disproportionately the
       trades where price ran off favourably without you.

       INFO, not a veto. Fill risk is a property of the ORDER, not of the
       setup's quality — the setup may be excellent and simply require the
       patience to miss it one time in five. The read abstains at or through
       market (the order fills now; there is nothing to argue about) and
       argues AGAINST only past 0.25R, where the measured never-fill rate
       crosses one in five on both horizons. */
    var frOk = null, frWhy = 'no plan supplied — fill risk not judged';
    if (plHas && plObj && isFinite(fin(plObj.entry)) && isFinite(fin(plObj.stop))){
      var frE = fin(plObj.entry), frS = fin(plObj.stop), frPx = fin(x.livePx);
      var frRisk = Math.abs(frE - frS);
      if (!isFinite(frPx) || !(frRisk > 0)){
        frWhy = 'no live price this scan — fill risk not judged';
      } else {
        var frAway = (hit.dir === 'long') ? (frE < frPx - 1e-9) : (frE > frPx + 1e-9);
        var frGapR = Math.abs(frE - frPx) / frRisk;
        if (!frAway){
          frWhy = 'entry at or through market — the order fills immediately';
        } else if (frGapR <= 0.25){
          frOk = true;
          frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
                + 'R) from market — near; measured, about 1 in 10 such limits never fills inside the horizon';
        } else {
          frOk = false;
          frWhy = 'limit ' + Math.abs(frE - frPx).toFixed(2) + ' pts (' + frGapR.toFixed(2)
                + 'R) from market — measured on gold, at this distance about 1 in '
                + (frGapR >= 1 ? '3' : '5') + ' never fills inside the horizon; the trade may simply not happen';
        }
      }
    } else if (plHas && !plObj){
      frWhy = 'plan declined — nothing to fill';
    }
    gates.push({ key:'fill-risk', hard:false, info:true, pass: frOk, why: frWhy });

    /* 12 — measured edge: this mechanic's own walk-forward on THIS horizon,
       judged by significance against the breakeven rate for this R floor. */
    var minRr = isFinite(fin(x.minRr)) ? fin(x.minRr) : 2;
    var sExp = x.stats ? fin(x.stats.expR) : NaN;
    var sHit = x.stats ? fin(x.stats.hit) : NaN;
    var sN = x.stats ? fin(x.stats.samples) : NaN;
    var ed = null, edWhy = 'not yet measured', edInfo = false;
    if (isFinite(sExp) && isFinite(sHit) && isFinite(sN)){
      var pBreak = 1 / (1 + minRr);
      var se = Math.sqrt(pBreak * (1 - pBreak) / Math.max(1, sN));
      var z = se > 0 ? ((sHit - pBreak) / se) : 0;
      var stat = sN + ' samples · ' + (sHit * 100).toFixed(0) + '% T1-first · '
               + (sExp >= 0 ? '+' : '') + sExp.toFixed(2) + 'R [' + (z >= 0 ? '+' : '') + z.toFixed(2) + 'σ vs breakeven]';
      /* The bar a single mechanic must clear once you account for how many
         were tried. A positive read that does not clear it is not a weaker
         edge — it is no evidence at all, and PASS would say otherwise. */
      var famZ = hgOgFamilyZ(OG_MECHANICS.length);
      var famTxt = ' · ' + OG_MECHANICS.length + ' mechanics scanned, so +'
                 + famZ.toFixed(2) + 'σ is the bar before one this good means anything';

      if (sN < MIN_SAMPLES) edWhy = 'only ' + sN + ' past samples — too few to judge';
      else if (z <= EDGE_VETO_Z){
        /* Min-loss: the pool table already says "has not paid" at MIN_SAMPLES
           (20). The 20–29 window used to report AGAINST as info so the TICKET
           still issued — a mechanic at −2σ with 22 samples was the live
           recommendation. Too thin to be a *large* sample is not a reason to
           take a losing trade. Under 20 stays UNCHECKED (too few to judge). */
        ed = false; edInfo = false;
        edWhy = stat + ' — significantly below breakeven, this mechanic has not paid';
      }
      else if (z >= famZ){ ed = true; edWhy = stat + ' — clears the ' + OG_MECHANICS.length + '-mechanic significance bar (+' + famZ.toFixed(2) + 'σ)'; }
      else {
        /* UNCHECKED, not PASS: searching 27 ways and reporting the best one
           does not demonstrate an edge, and the ledger's own rule is that
           what has not been established does not read as established. The
           gate is soft, so this does not veto — the ticket stands and the
           card stops claiming a measurement it has not got. */
        ed = null;
        edWhy = stat + (z < 0 ? ' — below breakeven but within noise' : '') + famTxt;
      }
      edWhy = 'in-sample ' + edWhy;
    }

    /* ---- OUT-OF-SAMPLE OVERRIDE ----------------------------------------

       Everything above is the walk-forward pool, re-read from the same window
       on every scan. It is what this gate has always used, and on the live
       gold desk it passed a ticket reading

         'PASS measured-edge 41 samples · 51% T1-first · +0.54R [+1.47σ]'

       for ROUND-MAGNET, while the forward log for that same mechanic on that
       same horizon stood at 0 wins in 5 settled trades. A gate calling itself
       measured-edge cannot quote the number the forward log exists to
       distrust and then ignore the forward log.

       Precedence: enough settled forward trades and the forward record IS the
       verdict; too few but CONTRADICTING a positive in-sample read and the
       gate reads UNCHECKED rather than passing on the agreeable half; nothing
       forward and the in-sample number stands, labelled as in-sample. */
    var fwd = x.fwd || null;
    var fN = fwd ? fin(fwd.samples) : NaN;
    if (isFinite(fN) && fN > 0){
      var fHit = fin(fwd.hit);
      var fBreak = 1 / (1 + minRr);
      var fTxt = fN + ' settled out-of-sample · ' + (isFinite(fHit) ? (fHit * 100).toFixed(0) + '%' : '—') + ' T1-first';
      /* THE VETO USES THE TICKET-ONLY RECORD. See omniroute: the all-firings
         figure is what the card reports, because it is the only one
         comparable with the in-sample pool — but vetoing on it is circular.
         Most firings are rejected by this very ledger, the rejects are
         recorded, they lose, and the mechanic is then condemned by trades the
         desk refused to take. That is what emptied both tabs. */
      var tix = fwd.ticketOnly;
      var tN = tix ? fin(tix.samples) : NaN;
      var tHit = tix ? fin(tix.hit) : NaN;
      var judgeN = (isFinite(tN) && tN >= FWD_MIN_JUDGE) ? tN : NaN;
      var judgeHit = isFinite(judgeN) ? tHit : NaN;

      if (isFinite(judgeN) && isFinite(judgeHit)){
        var fse = Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / judgeN));
        var fz = (judgeHit - fBreak) / fse;
        var fzTxt = ' [' + (fz >= 0 ? '+' : '') + fz.toFixed(2) + 'σ vs breakeven]';
        var tixTxt = judgeN + ' settled TICKETS · ' + (judgeHit * 100).toFixed(0) + '% T1-first';
        if (fz <= EDGE_VETO_Z){
          ed = false;
          edWhy = tixTxt + fzTxt + ' — the trades this ledger actually cleared have not paid'
                + (fN > judgeN ? ' (of ' + fN + ' settled firings overall)' : '');
        } else {
          ed = true;
          edWhy = tixTxt + fzTxt + ' — measured out-of-sample on cleared setups';
        }
      } else if (fN >= FWD_MIN_JUDGE && isFinite(fHit)){
        /* Enough settled FIRINGS to describe, not enough cleared TICKETS to
           condemn. Report, do not veto. */
        var az = (fHit - fBreak) / Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / fN));
        ed = null;
        edWhy = fTxt + ' [' + (az >= 0 ? '+' : '') + az.toFixed(2) + 'σ vs breakeven]'
              + ' — but only ' + (isFinite(tN) ? tN : 0) + ' of those were setups this ledger cleared, '
              + 'too few to judge the mechanic on. Reported, not vetoed.';
      } else if (isFinite(fHit) && isFinite(z) && z > 0 && fHit < fBreak){
        ed = null;
        edWhy = fTxt + ' vs ' + edWhy
              + ' — CONTRADICTORY: the walk-forward pool is positive while every settled out-of-sample '
              + 'trade has lost. Too few to judge either way, so this reads UNCHECKED rather than PASS.';
      } else {
        edWhy = fTxt + ' (too few to judge) · ' + edWhy;
      }
    } else if (fwd && fin(fwd.open) > 0){
      edWhy = fin(fwd.open) + ' out-of-sample trade' + (fin(fwd.open) === 1 ? '' : 's') + ' still open · ' + edWhy;
    }

    gates.push({ key:'measured-edge', hard:false, info: edInfo, pass: ed, why: edWhy });

    /* The 14 indicator context reads moved to hg-gates.js so OMNIROUTE gets
       them too — a gold card carried 34 checks to crypto\'s 21, and the gap
       was exactly these. Verbatim move; verified by gate-output equivalence. */
    /* ZONE ANCHOR — is this setup AT a level, or in no-man's land?

       The NEXT GOLD LEVELS panel already computes where the multi-source
       zones sit (swings, prior day/week, ADR, Asia, value area, rounds,
       AVWAP), but the mechanic cards never knew: a POC-REVERT firing at a
       four-source overhead zone and one firing in the middle of nowhere
       graded identically. They are not the same trade — a level everyone
       can see is where liquidity rests and where a rejection has odds; a
       setup far from any structure is leaning on nothing. Info-only: being
       unanchored costs standing, never existence. */
    (function(){
      var za = null, zaWhy = 'zone context unavailable';
      var zc = x.zoneCtx;
      if (Array.isArray(zc) && zc.length){
        var ref = fin(hit.level);
        if (!isFinite(ref)) ref = fin(x.livePx);
        var aRef2 = atrOf(rows, 14);
        if (isFinite(ref) && isFinite(aRef2) && aRef2 > 0){
          var best = null, zi2, zz, dEdge;
          for (zi2 = 0; zi2 < zc.length; zi2++){
            zz = zc[zi2] && zc[zi2].zone;
            if (!zz || !isFinite(fin(zz.lo)) || !isFinite(fin(zz.hi))) continue;
            dEdge = (ref < zz.lo) ? (zz.lo - ref) : (ref > zz.hi ? ref - zz.hi : 0);
            if (!best || dEdge < best.d) best = { d: dEdge, z: zz };
          }
          if (best){
            var dAtr = best.d / aRef2;
            zaWhy = 'nearest structural zone (' + (best.z.confluence || '?') + ' sources: '
                  + best.z.srcs.join(', ') + ') sits ' + dAtr.toFixed(1) + 'xATR from the setup level';
            if (dAtr <= 0.5){ za = true; zaWhy += ' — anchored AT the level'; }
            else if (dAtr > 1.5){ za = false; zaWhy += ' — no structure within reach: a setup in no-man’s-land'; }
            else { za = true; zaWhy += ' — within working distance'; }
          } else zaWhy = 'no multi-source zone computed on this tape';
        }
      }
      gates.push({ key:'zone-anchor', hard:false, info:true, pass: za, why: zaWhy });
    })();

    (function(){
      var shFn = gfn('hgIndicatorGates');
      var sh = shFn ? shFn(rows, hit, x, reversion) : null;
      if (sh && sh.length){ for (var si = 0; si < sh.length; si++) gates.push(sh[si]); }
      else gates.push({ key:'context-gates', hard:false, info:true, pass:null,
                        why:'shared context gates unavailable (hg-gates.js not loaded)' });
    })();




    /* --- second round of indicator reads --------------------------------

       Same standing as the first four: info gates. They report, they can
       argue against a setup on the card, and they never veto. Nothing here
       has a measured record on gold, so nothing here has earned the right to
       stand a trade aside.

       Every return shape below was read off the real function, not guessed.
       adx/keltner/ttmSqueeze all return PARALLEL ARRAYS; hgAtrPercentile
       returns a bare number; hgStructureGate returns an object with a note.
       Getting that wrong is silent — the gate simply reads unavailable for
       ever — which is how the previous round shipped two dead gates. */

    /* 17 — ADX: is there a trend here at all, and does it point our way? */
    var adxOk = null, adxWhy = 'ADX unavailable';
    var adxFn = gfn('adx');
    if (adxFn){
      try {
        var ax = adxFn(rows, 14);
        var aArr = ax && ax.adx, pArr = ax && ax.plusDI, mArr = ax && ax.minusDI;
        var aV = (aArr && aArr.length) ? fin(aArr[aArr.length - 1]) : NaN;
        var pV = (pArr && pArr.length) ? fin(pArr[pArr.length - 1]) : NaN;
        var mV = (mArr && mArr.length) ? fin(mArr[mArr.length - 1]) : NaN;
        if (isFinite(aV) && isFinite(pV) && isFinite(mV)){
          var trending = aV >= 25;
          var diUp = pV > mV;
          adxWhy = 'ADX ' + aV.toFixed(0) + (trending ? ' — trending' : ' — no trend')
                 + ', DI ' + (diUp ? 'up' : 'down');
          if (!trending){
            /* No trend is not an argument against a reversion mechanic; it is
               the condition it wants. */
            adxOk = reversion ? true : false;
            adxWhy += reversion ? ' — which is the tape a reversion mechanic wants'
                                : ' — a continuation mechanic with no trend behind it';
          } else {
            var diAgrees = (hit.dir === 'long') ? diUp : !diUp;
            adxOk = reversion ? true : diAgrees;
            adxWhy += diAgrees ? ' — agrees' : (reversion ? ' — counter-trend by design' : ' — DI points the other way');
          }
        }
      } catch (eAdx){ adxOk = null; adxWhy = 'ADX threw: ' + ((eAdx && eAdx.message) || eAdx); }
    }
    gates.push({ key:'adx-trend', hard:false, info:true, pass: adxOk, why: adxWhy });



    /* 20 — ATR percentile: gold's own volatility, ranked against its history.
       Both tails matter. A dead tape will not reach a 1.5R target before the
       horizon expires; a top-decile tape moves the stop into the noise. */
    var vp = null, vpWhy = 'ATR percentile unavailable';
    var vpFn = gfn('hgAtrPercentile');
    if (vpFn){
      try {
        var pct = fin(vpFn(rows, 14, 100));
        if (isFinite(pct)){
          vpWhy = 'ATR in the ' + hgOgOrdinal(pct) + ' percentile of the last 100 bars';
          if (pct < 15){ vp = false; vpWhy += ' — too quiet to reach the target inside the horizon'; }
          else if (pct > 90){ vp = false; vpWhy += ' — top-decile volatility, the stop sits inside the noise'; }
          else vp = true;
        }
      } catch (eVp){ vp = null; vpWhy = 'ATR percentile threw: ' + ((eVp && eVp.message) || eVp); }
    }
    gates.push({ key:'atr-percentile', hard:false, info:true, pass: vp, why: vpWhy });


    /* 22 — CONSENSUS. The one gate that reads the rest of the scan.

       A hard veto, and deliberately so: unlike the indicator reads above,
       this makes no claim about whether a mechanic works. It states a fact
       about this bar — that the desk's own mechanics are pointing both ways
       and this setup is on the side with fewer of them. Presenting that as a
       ticket is the app disagreeing with itself in front of the user.

       Ties veto BOTH directions. When the tape is genuinely two-sided the
       honest output is no trade, not a coin flip dressed as a setup. */
    var con = null, conWhy = 'no other mechanics to compare against';
    var conHard = false;
    var cons = x.allHits ? hgOgConsensus(hgOgConsensusVoters(x.allHits, rows, x), hit) : null;
    if (cons){
      conHard = true;
      var aTxt = cons.nAgree + ' famil' + (cons.nAgree === 1 ? 'y agrees' : 'ies agree')
               + (cons.agree.length ? ' (' + cons.agree.join(', ') + ')' : '');
      var splitTxt = cons.nSplit ? '; ' + cons.split.join(', ')
                   + (cons.nSplit === 1 ? ' is' : ' are') + ' split and counted for neither' : '';
      if (cons.nAgree === 0 && cons.nAgainst === 0){
        /* Every family that fired is internally divided, so not one of them
           has an opinion. The nAgainst===0 branch below would read that as
           "nothing firing against it" and PASS — which it did, printing
           "0 families agree, nothing firing against it" and letting a long
           and a short ticket simultaneously. Nothing agreeing is not the same
           as nothing disagreeing, and this is the most two-sided tape there
           is. A latent hole since the split rule landed; round four made
           splits common enough to hit it. */
        con = false;
        conWhy = 'every mechanic family that fired is split (' + cons.split.join(', ')
               + ') — the desk has no directional opinion at all';
      } else if (cons.nAgainst === 0){
        con = true;
        conWhy = aTxt + ', nothing firing against it' + splitTxt;
      } else if (cons.nAgree > cons.nAgainst){
        /* Outnumbering is not immunity. The minority branch below can now
           be rescued by the regime; if this side could still pass on raw
           count, the two directions would ticket TOGETHER — the exact
           contradiction this gate exists to prevent. Both branches read
           the same signal, so exactly one side can win: a majority whose
           regime-favoured family fired ONLY on the other side is the
           chorus that fires against every such regime, and it stands
           aside. */
        var mjReg = null;
        var mjFn = gfn('detectRegime');
        if (mjFn){ try { var mjR = mjFn(rows); mjReg = mjR ? String(mjR.regime || '') : null; } catch (eMj){ mjReg = null; } }
        var mjFam = /trend/i.test(mjReg || '') ? 'TREND'
                  : /range|chop|mean/i.test(mjReg || '') ? 'REVERSION' : null;
        if (mjFam && cons.against.indexOf(mjFam) >= 0 && cons.agree.indexOf(mjFam) < 0){
          con = false;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — outnumbers it, but the ' + mjReg + ' regime favours ' + mjFam
                 + ', which fired only on the other side: this majority is the chorus that fires against every '
                 + String(mjReg).toLowerCase();
        } else {
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt;
        }
      } else if (cons.nAgree === cons.nAgainst){
        /* A TIE between TREND and REVERSION is not a contradiction — it is
           what those two families ARE. In a trending tape the continuation
           mechanics fire with the move and the fades fire against it, every
           time, so vetoing both throws the trade away for being exactly what
           it should be. Found on OMNIROUTE, where the veto rate ROSE from 36%
           on a random walk to 56% on a trending one with 87% of those being
           ties; here ties were ~60% of every consensus veto.

           The structural regime already says which family belongs, so let it
           break the tie. Only one side can win, so this cannot reintroduce a
           contradictory pair, and with no clear regime both still stand
           aside. */
        var tieReg = null;
        var tieFn = gfn('detectRegime');
        if (tieFn){ try { var tr = tieFn(rows); tieReg = tr ? String(tr.regime || '') : null; } catch (eT){ tieReg = null; } }
        var wantFam = /trend/i.test(tieReg || '') ? 'TREND'
                    : /range|chop|mean/i.test(tieReg || '') ? 'REVERSION' : null;
        var mineHas = wantFam && cons.agree.indexOf(wantFam) >= 0;
        var theirsHas = wantFam && cons.against.indexOf(wantFam) >= 0;
        if (wantFam && mineHas && !theirsHas){
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — tied, broken by the ' + tieReg + ' regime, which favours ' + wantFam;
        } else if (wantFam && theirsHas && !mineHas){
          con = false;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — tied, and the ' + tieReg + ' regime favours the other side (' + wantFam + ')';
        } else {
          con = false;
          /* Say WHICH of the three tie-break failures happened. "No regime
             read" was printed for all of them, including on cards where
             regime-fit had just reported WEAK TREND three lines below — which
             sends the reader looking for a missing regime that is not
             missing. */
          var tieWhy = !wantFam
            ? 'no regime read to break it'
            : (cons.split.indexOf(wantFam) >= 0
                ? 'the ' + tieReg + ' regime favours ' + wantFam + ', and ' + wantFam
                  + ' is itself split — it cannot break its own tie'
                : (mineHas && theirsHas
                    ? wantFam + ' fired on BOTH sides, so the regime cannot separate them'
                    : wantFam + ' did not fire at all, so the ' + tieReg
                      + ' regime has nothing here to favour'));
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ')
                 + ')' + splitTxt + ' — tied, and ' + tieWhy + ': the desk cannot pick a side';
        }
      } else {
        /* MINORITY READ — but the tie-break's own measurement applies here
           too: in a trending tape the fades fire against the move EVERY
           time, so the continuation family is structurally outnumbered by
           mechanics that add no information. Observed live: the only
           with-trend setup on the tape (MMOVE long, ADX 40 up) vetoed
           1-v-2 by the same fades fade-strength had just rejected as
           invalid in that exact regime — REJECTED SETUPS WERE VOTING.
           Same break as the tie above, same conditions, nothing new to
           game: a clear regime read, the regime's own family on THIS side,
           and not on the other. A minority the regime disowns still
           vetoes, and TREND firing on both sides still cannot be
           separated. */
        var mnReg = null;
        var mnFn = gfn('detectRegime');
        if (mnFn){ try { var mnR = mnFn(rows); mnReg = mnR ? String(mnR.regime || '') : null; } catch (eMn){ mnReg = null; } }
        var mnFam = /trend/i.test(mnReg || '') ? 'TREND'
                  : /range|chop|mean/i.test(mnReg || '') ? 'REVERSION' : null;
        if (mnFam && cons.agree.indexOf(mnFam) >= 0 && cons.against.indexOf(mnFam) < 0){
          con = true;
          conWhy = aTxt + ' vs ' + cons.nAgainst + ' against (' + cons.against.join(', ') + ')' + splitTxt
                 + ' — outnumbered, but the ' + mnReg + ' regime favours ' + mnFam
                 + ' and it fired on this side only: a headcount of mechanics that fire against every '
                 + String(mnReg).toLowerCase() + ' is noise, not disagreement';
        } else {
          con = false;
          conWhy = 'only ' + aTxt + ' vs ' + cons.nAgainst + ' against ('
                 + cons.against.join(', ') + ')' + splitTxt + ' — this is the minority read';
        }
      }
    }
    gates.push({ key:'consensus', hard: conHard, pass: con, why: conWhy });

    /* STOP-WIDTH — what this stop actually asks of the trade. See omniroute:
       the card printed the risk percentage and never said anything about it,
       so a 13% stop and a 0.9% stop rendered identically. Info, not a veto: a
       wide stop is often correct, and the v351 work established that
       truncating one to make the number look better only relocates the risk. */
    var sw = null, swWhy = 'no plan yet — stop width cannot be judged';
    var swPlan = x.plan;
    if (swPlan){
      var swE = fin(swPlan.entry), swS = fin(swPlan.stop), swT = fin(swPlan.t1);
      if (isFinite(swE) && isFinite(swS) && swE > 0){
        var swPct = Math.abs(swE - swS) / swE * 100;
        if (isFinite(swPct) && swPct > 0){
          var needPct = isFinite(swT) ? (Math.abs(swT - swE) / swE * 100) : (swPct * (fin(x.minRr) || 1.5));
          swWhy = 'stop is ' + swPct.toFixed(2) + '% from entry; T1 needs a ' + needPct.toFixed(1) + '% move';
          /* Gold is far less volatile than an alt, so the wide threshold is
             tighter here: 3% on XAUUSD is a very large stop. */
          if (swPct >= 3){
            sw = false;
            swWhy += ' — a very wide stop for gold: at fixed account risk this sizes to a small position';
          } else if (swPct <= 0.08){
            sw = false;
            swWhy += ' — a very tight stop: ordinary noise and spread will take it out before the idea fails';
          } else {
            sw = true;
          }
        }
      }
    }
    gates.push({ key:'stop-width', hard:false, info:true, pass: sw, why: swWhy });








    /* FADE-STRENGTH — the gate that was missing, and that v376 made necessary.

       Reported as "the setups are absolutely wrong — shorts in a rally", and
       the ledger could not stop one. For a reversion mechanic:

         trend             passes by design  (trendOk = true)
         htf-daily         passes by design  (d1 = reversion ? true : ...)
         hurst-regime      info:true
         regime-fit        info:true
         adx-trend         info:true
         structure-shift   info:true
         htf-confirm       info:true
         regression-slope  info:true

       Eight trend-aware gates and not one of them can veto a fade. A live
       ticket carried "AGAINST hurst-regime — a reversion mechanic against a
       trending tape" and "AGAINST regime-fit — fading a trending tape" side
       by side, and cleared anyway.

       v376 widened that hole. Before it, VWAP-REVERT, POC-REVERT, RSI-DIVERGE
       and AVWAP-RECLAIM were classed as continuation and WERE vetoed by trend
       and htf-daily. Reclassifying them as reversion was right — the trend
       gate's own comment says vetoing a fade for being counter-trend is a
       category error, and it is — but it handed those four a free pass on
       every trend check at the same time.

       The distinction the ledger never drew: fading a STRETCHED market is the
       trade; fading a STRONG TREND is the classic way to lose. Direction is
       not the question for a fade. STRENGTH is.

       Three independent reads of strength against this fade. The daily
       stack alone is enough to veto — that is the "shorts in a rally"
       complaint. ADX and regime still need TWO to agree when the daily
       is missing, so one noisy oscillator cannot kill a setup:

         1. the daily stack, which is what "a rally" usually means
         2. ADX >= 25 with DI pointing against the fade
         3. the structural regime reading trend, with the local EMA stack
            confirming the direction

       Soft, so it reports rather than silently disappearing the card. */
    var fadeOk = true, fadeWhy = 'continuation setup — this gate only judges fades';
    if (reversion){
      var adverse = [], dailyAgainst = false, neutralN = 0;
      /* A short fade fights an UPtrend; a long fade fights a DOWNtrend. */
      var fadeShort = (hit.dir === 'short');

      /* 1 — the higher timeframe. The live complaint was "shorts in a rally";
         the daily stack IS that rally. One noisy oscillator must not kill a
         fade, but fading the daily trend is the classic gold loss. */
      var fhe21 = x.htf ? fin(x.htf.e21) : NaN, fhe50 = x.htf ? fin(x.htf.e50) : NaN;
      if (isFinite(fhe21) && isFinite(fhe50)){
        var dailyUp = fhe21 >= fhe50;
        if (dailyUp === fadeShort){
          dailyAgainst = true;
          adverse.push('the daily stack is ' + (dailyUp ? 'up' : 'down'));
        }
      } else neutralN++;

      /* 2 — ADX with direction. */
      var fAdxFn = gfn('adx');
      if (fAdxFn){
        try {
          var fx = fAdxFn(rows, 14);
          var fa = (fx && fx.adx && fx.adx.length) ? fin(fx.adx[fx.adx.length - 1]) : NaN;
          var fp = (fx && fx.plusDI && fx.plusDI.length) ? fin(fx.plusDI[fx.plusDI.length - 1]) : NaN;
          var fm = (fx && fx.minusDI && fx.minusDI.length) ? fin(fx.minusDI[fx.minusDI.length - 1]) : NaN;
          if (isFinite(fa) && isFinite(fp) && isFinite(fm)){
            if (fa >= 25 && ((fp > fm) === fadeShort))
              adverse.push('ADX ' + fa.toFixed(0) + ' with DI ' + (fp > fm ? 'up' : 'down'));
          } else neutralN++;
        } catch (eFa){ neutralN++; }
      } else neutralN++;

      /* 3 — the structural regime, with the local stack agreeing on which way. */
      var fRegFn = gfn('detectRegime');
      if (fRegFn && isFinite(e21) && isFinite(e50)){
        try {
          var fr = fRegFn(rows);
          var frName = fr ? String(fr.regime || '') : '';
          if (/trend/i.test(frName)){
            var localUp = e21 >= e50;
            if (localUp === fadeShort)
              adverse.push('regime ' + ((fr && fr.label) || frName) + ' running ' + (localUp ? 'up' : 'down'));
          }
        } catch (eFr){ neutralN++; }
      } else neutralN++;

      if (dailyAgainst || adverse.length >= 2){
        fadeOk = false;
        fadeWhy = 'fading a STRONG trend — ' + adverse.join('; ')
                + '. A fade wants a stretched tape, not a running one';
      } else if (adverse.length === 1){
        fadeWhy = 'fade is counter-trend on one read (' + adverse[0]
                + '), which is what a fade IS — one oscillator is not enough to stand it aside';
      } else if (neutralN >= 3){
        fadeOk = null;
        fadeWhy = 'no usable trend-strength read — cannot judge this fade';
      } else {
        fadeWhy = 'nothing strong running against this fade';
      }
    }
    gates.push({ key:'fade-strength', hard:false, pass: fadeOk, why: fadeWhy });

    /* 30 — VOLATILITY FORECAST. hgVolFromCloses returns
       { sigmaNow, sigmaForecast, sigmaLongRun, source, ... }.

       Every target on this desk is an R multiple of the stop, so whether the
       target is reachable inside the horizon depends on volatility going
       FORWARD, not on what it has just done. A target set in an expanding
       tape and a target set into a collapse are not the same bet, and the
       ladder alone cannot show the difference. */
    var vf = null, vfWhy = 'volatility forecast unavailable';
    var vfFn = gfn('hgVolFromCloses');
    if (vfFn){
      try {
        var vpk = vfFn(closesOf(rows), {});
        var sNow = vpk ? fin(vpk.sigmaNow) : NaN;
        var sFwd = vpk ? fin(vpk.sigmaForecast) : NaN;
        if (isFinite(sNow) && isFinite(sFwd) && sNow > 0){
          var chg = (sFwd - sNow) / sNow;
          vfWhy = 'volatility forecast ' + (chg >= 0 ? '+' : '') + (chg * 100).toFixed(0)
                + '% vs now (' + (vpk.source || 'model') + ')';
          if (chg <= -0.35){
            vf = false;
            vfWhy += ' — contracting hard, the target may not be reachable inside the horizon';
          } else {
            vf = true;
          }
        }
      } catch (eVf){ vf = null; vfWhy = 'volatility forecast threw: ' + ((eVf && eVf.message) || eVf); }
    }
    gates.push({ key:'vol-forecast', hard:false, info:true, pass: vf, why: vfWhy });

    /* WEEKEND EXPOSURE — spot/CME closes Fri 22:00 UTC. A ticket issued
       inside that window is a gap bet on a closed book, not a gold trade.
       SWING also vetoes inside one 4h bar of the close: that hold will
       still be open when the book gaps. SCALP may still trade the last
       live hours. */
    var wkOk = null, wkWhy = 'no scan clock supplied — weekend exposure not judged';
    var wkNow = fin(x.nowSec);
    var wkFn = gfn('hgInGoldWeekend');
    if (isFinite(wkNow) && wkNow > 0 && wkFn){
      try {
        if (wkFn(wkNow)){
          wkOk = false;
          wkWhy = x.sessionHard
            ? 'inside gold weekend — spot/CME is closed; a scalp ticket is not a live XAU book'
            : 'inside gold weekend — a swing hold is a gap across a closed spot/CME book';
        } else {
          var secsFn = gfn('hgSecsToGoldWeekend');
          var secsLeft = secsFn ? fin(secsFn(wkNow)) : NaN;
          if (x.sessionHard !== true && isFinite(secsLeft) && secsLeft >= 0 && secsLeft < 4 * 3600){
            wkOk = false;
            wkWhy = 'Friday close in ' + (secsLeft / 3600).toFixed(1)
                  + 'h — a swing hold would gap a closed spot/CME book';
          } else {
            wkOk = true;
            wkWhy = 'outside the gold weekend closure';
          }
        }
      } catch (eWk){ wkWhy = 'weekend check threw'; }
    } else if (isFinite(wkNow) && wkNow > 0 && !wkFn){
      wkWhy = 'weekend helper unavailable — not judged';
    }
    gates.push({ key:'weekend-exposure', hard:false, pass: wkOk, why: wkWhy });

    /* ShieldGuard — gold tabs already refuse these tapes. Feature-checked:
       UNCHECKED when the module is not loaded, never a silent pass. */
    var shOk = null, shWhy = 'ShieldGuard not loaded — not judged';
    var shFn = gfn('hgShieldGuardVeto');
    if (shFn && rows && hit && hit.dir){
      try {
        var sh = shFn(rows, hit.dir, {});
        if (sh && sh.veto){
          shOk = false;
          shWhy = 'ShieldGuard: ' + (sh.reason || 'veto');
        } else {
          shOk = true;
          shWhy = 'ShieldGuard clear';
        }
      } catch (eSh){ shWhy = 'ShieldGuard threw: ' + ((eSh && eSh.message) || eSh); }
    }
    gates.push({ key:'shield-guard', hard:false, pass: shOk, why: shWhy });

    /* Round five indicator reads. INFO only — they argue whether the
       existing setup is standing on gold structure, they never veto a
       ticket and they never invent one. */
    var stackOk = null, stackWhy = 'EMA stack unread';
    try{
      var e8 = emaOf(closes, 8);
      if (isFinite(e8) && isFinite(e21) && isFinite(e50) && isFinite(last)){
        var bull = e8 > e21 && e21 > e50;
        var bear = e8 < e21 && e21 < e50;
        if (reversion){
          stackOk = true;
          stackWhy = bull ? '8>21>50 — a fade is counter-stack by design'
                   : bear ? '8<21<50 — a fade is counter-stack by design'
                   : 'EMA 8/21/50 mixed — no stack for the fade to fight';
        } else if (hit.dir === 'long'){
          stackOk = bull ? true : (bear ? false : null);
          stackWhy = bull ? '8>21>50 — stack agrees with the long'
                   : bear ? '8<21<50 — stack is against this long'
                   : 'EMA 8/21/50 mixed — no clean stack';
        } else if (hit.dir === 'short'){
          stackOk = bear ? true : (bull ? false : null);
          stackWhy = bear ? '8<21<50 — stack agrees with the short'
                   : bull ? '8>21>50 — stack is against this short'
                   : 'EMA 8/21/50 mixed — no clean stack';
        }
      }
    }catch(eSt){ stackWhy = 'EMA stack unread'; }
    gates.push({ key:'ema-stack', hard:false, info:true, pass: stackOk, why: stackWhy });

    var rsiOk = null, rsiWhy = 'RSI unread';
    try{
      var rsiFn = gfn('rsi');
      var rsiArr = rsiFn ? rsiFn(closes, 14) : null;
      var rsiLast = (rsiArr && rsiArr.length) ? fin(rsiArr[rsiArr.length - 1]) : NaN;
      if (isFinite(rsiLast)){
        if (reversion){
          if (hit.dir === 'long'){
            rsiOk = rsiLast <= 40 ? true : (rsiLast >= 70 ? false : null);
            rsiWhy = 'RSI ' + rsiLast.toFixed(0) + (rsiLast <= 40 ? ' — stretched for a long fade' : rsiLast >= 70 ? ' — chasing a high RSI fade' : ' — mid band, not a stretch');
          } else {
            rsiOk = rsiLast >= 60 ? true : (rsiLast <= 30 ? false : null);
            rsiWhy = 'RSI ' + rsiLast.toFixed(0) + (rsiLast >= 60 ? ' — stretched for a short fade' : rsiLast <= 30 ? ' — chasing a low RSI fade' : ' — mid band, not a stretch');
          }
        } else if (hit.dir === 'long'){
          rsiOk = rsiLast >= 78 ? false : true;
          rsiWhy = 'RSI ' + rsiLast.toFixed(0) + (rsiLast >= 78 ? ' — continuation is chasing the stretch' : ' — not an extreme chase');
        } else {
          rsiOk = rsiLast <= 22 ? false : true;
          rsiWhy = 'RSI ' + rsiLast.toFixed(0) + (rsiLast <= 22 ? ' — continuation is chasing the stretch' : ' — not an extreme chase');
        }
      }
    }catch(eRsi){ rsiWhy = 'RSI unread'; }
    gates.push({ key:'rsi-zone', hard:false, info:true, pass: rsiOk, why: rsiWhy });

    var vwapOk = null, vwapWhy = 'session VWAP unread';
    try{
      var vwap = hgOgSessionVwap(rows);
      if (isFinite(vwap) && isFinite(last) && vwap > 0){
        var above = last > vwap;
        if (reversion){
          vwapOk = true;
          vwapWhy = 'session VWAP ' + vwap.toFixed(2) + (above ? ' — price above (fade is counter-VWAP by design)' : ' — price below (fade is counter-VWAP by design)');
        } else if (hit.dir === 'long'){
          vwapOk = above ? true : false;
          vwapWhy = 'session VWAP ' + vwap.toFixed(2) + (above ? ' — price holds above, agrees with the long' : ' — price is below, against this long');
        } else {
          vwapOk = above ? false : true;
          vwapWhy = 'session VWAP ' + vwap.toFixed(2) + (above ? ' — price is above, against this short' : ' — price holds below, agrees with the short');
        }
      }
    }catch(eVw){ vwapWhy = 'session VWAP unread'; }
    gates.push({ key:'session-vwap', hard:false, info:true, pass: vwapOk, why: vwapWhy });

    /* PREMIUM / DISCOUNT — the one gold read the ledger did not already have.

       A first pass at this was an "indicator stack" gate: a tally of six gold
       indicators asked whether they agreed with the direction. It was cut,
       and the reason is worth recording so it does not get rebuilt.

       hg-gates.js already contributes about eighteen indicator gates to THIS
       ledger through hgIndicatorGates, and five of them — ichimoku, stoch-rsi,
       cci-stretch, ema-ribbon, heikin-trend — already ask their indicator
       whether it agrees with the direction. The stack duplicated five of its
       six members. Every duplicate would have counted one reading twice: once
       as its own gate and again inside the tally, inflating the ticket's check
       count and quietly double-weighting five indicators over the rest. A desk
       that counts the same evidence twice is how a marginal setup becomes a
       confident one on paper and nothing at all in the market.

       What survived is the single read nothing else asks: ICT premium/discount,
       which is where price sits in its own recent range. Buy the discount, sell
       the premium. Reported the same way the shared indicator gates are —
       soft, informational, and abstaining in the middle of the range rather
       than voting, because a mid-range read has no view and counting silence
       as agreement is the same double-count in a different coat. */
    var pdG = null, pdWhy = 'premium/discount unavailable (goldind.js not loaded)';
    var pdFn = gfn('goldPremiumDiscount');
    if (pdFn){
      try {
        var pdR = pdFn(ogTail(rows || [], 300));
        if (!pdR){
          pdWhy = 'premium/discount could not be read from these bars';
        } else if (pdR.zone === 'NEUTRAL'){
          pdWhy = 'mid-range at ' + (fin(pdR.pct) * 100).toFixed(0)
                + '% of the ' + fin(pdR.range).toFixed(0) + '-point range — no premium/discount view';
        } else {
          var pdLong = (hit && hit.dir === 'long');
          var pdDisc = (pdR.zone === 'DISCOUNT');
          pdG = pdLong ? pdDisc : !pdDisc;
          pdWhy = 'price in the ' + String(pdR.zone).toLowerCase() + ' quartile ('
                + (fin(pdR.pct) * 100).toFixed(0) + '% of range)'
                + (pdG ? ' — agrees with this ' + (pdLong ? 'long' : 'short')
                       : ' — against this ' + (pdLong ? 'long' : 'short') + ' (context, not a veto)');
        }
      } catch (ePd){ pdG = null; pdWhy = 'premium/discount threw: ' + ((ePd && ePd.message) || ePd); }
    }
    gates.push({ key:'premium-discount', hard:false, info:true, pass: pdG, why: pdWhy });

    /* SEASONALITY — a weak prior, reported as one.

       goldind's own note ends "context only, not a vote", and this gate keeps
       it that way: info, never a veto, and NEUTRAL months abstain rather than
       agreeing. The read is keyed to the TRIGGER BAR's timestamp, not to
       Date.now(), so a replayed setup is judged by the month it fired in
       rather than the month the replay was run in. */
    var seaG = null, seaWhy = 'seasonal context unavailable (goldind.js not loaded)';
    var seaFn = gfn('goldSeason');
    if (seaFn){
      try {
        var seaSec = (lastBar && isFinite(fin(lastBar.t))) ? fin(lastBar.t) : fin(x.nowSec);
        if (!isFinite(seaSec)){
          seaWhy = 'no timestamp on the trigger bar — season not read';
        } else {
          var sea = seaFn(seaSec * 1000);
          if (!sea || !isFinite(sea.month)){
            seaWhy = 'season could not be read from the trigger bar';
          } else if (sea.bias === 'STRONG'){
            seaG = (hit.dir === 'long');
            seaWhy = 'Jan–Feb, historically gold’s strongest stretch'
                   + (seaG ? ' — agrees with this long' : ' — against this short (context, not a veto)');
          } else if (sea.bias === 'CONSOLIDATION'){
            /* Spring consolidation favours fades and argues against
               continuation. A trend mechanic here is not wrong, just
               unsupported by the calendar — which is why this is info. */
            seaG = reversion ? true : false;
            seaWhy = 'spring/early-summer, historically a consolidation stretch'
                   + (reversion ? ' — a fade suits a consolidating month'
                                : ' — against a continuation (context, not a veto)');
          } else {
            seaWhy = 'no strong seasonal bias this month — the calendar abstains';
          }
        }
      } catch (eSea){ seaG = null; seaWhy = 'season threw: ' + ((eSea && eSea.message) || eSea); }
    }
    gates.push({ key:'gold-season', hard:false, info:true, pass: seaG, why: seaWhy });

    /* SPOT BASIS — tokenised gold against the desk's own feed.

       PAXG trading at a premium to spot XAU means crypto-side demand is
       paying up for gold; a discount means the opposite. It is a real read and
       it is LIVE-ONLY: the walk-forward replays one candle series, and there
       is no retained paired PAXG/spot history to replay against, so this can
       never earn an in-sample record. That is exactly why it is a gate and not
       a mechanic — the same rule that keeps goldind's book and funding reads
       off the mechanic list.

       SKIPPED when the desk is already reading PAXG. The fetch chain falls
       back to binanceKlines('PAXGUSDT') when XM and the spot proxy both fail,
       and pricing PAXG against itself would return a flat PARITY that looks
       like a measurement. Saying so is better than printing a zero. */
    var basG = null, basWhy = 'gold basis unavailable';
    var basFn = gfn('calculateGoldSpotBasis');
    var basSrc = String((x && x.srcId) || '');
    var basPaxg = fin(x && x.paxg), basFeed = fin(x && x.livePx);
    if (basSrc.indexOf('paxg') !== -1){
      basWhy = 'the desk is reading PAXG itself, so there is no second series to price it against';
    } else if (!basFn){
      basWhy = 'gold basis unavailable (goldind.js not loaded)';
    } else if (!isFinite(basPaxg) || !isFinite(basFeed)){
      basWhy = 'no PAXG print this scan — basis not read';
    } else {
      try {
        var bas = basFn(basPaxg, basFeed);
        var basPct = fin(bas && bas.basisPercent);
        var basTal = fin(bas && bas.basisTally);
        if (!isFinite(basPct)){
          basWhy = 'basis could not be computed from this scan’s prints';
        } else if (!isFinite(basTal) || basTal === 0){
          basWhy = 'PAXG within 0.15% of the feed (' + basPct.toFixed(2)
                 + '%) — at parity, no basis view';
        } else {
          var basLong = (hit.dir === 'long');
          basG = basTal > 0 ? basLong : !basLong;
          basWhy = 'PAXG at ' + (basPct >= 0 ? '+' : '') + basPct.toFixed(2)
                 + '% to the feed — tokenised gold is ' + (basTal > 0 ? 'bid' : 'offered')
                 + (basG ? ', agrees with this ' + (basLong ? 'long' : 'short')
                         : ', against this ' + (basLong ? 'long' : 'short') + ' (context, not a veto)');
        }
      } catch (eBas){ basG = null; basWhy = 'basis threw: ' + ((eBas && eBas.message) || eBas); }
    }
    gates.push({ key:'spot-basis', hard:false, info:true, pass: basG, why: basWhy });

    /* Institutional gold filter — same hgGoldInstFilter as GOLD SCALP/SWING.
       One hard ledger row so the INFO_GATES regex does not swallow eight
       new keys. goldind absent → fail-open PASS (not UNCHECKED-hard). */
    var inst = hgOgInstFilterHit(hit, rows, x);
    var instHard = true, instOk = true, instWhy = 'institutional gold filter OK';
    if (inst.unchecked){
      instHard = false;
      instOk = true;
      instWhy = inst.reason || 'goldind inst filter not loaded — fail-open';
    } else if (inst.dropped){
      instHard = true;
      instOk = false;
      instWhy = inst.reason || 'institutional gold filter';
    } else {
      instHard = true;
      instOk = true;
      instWhy = inst.reason || 'institutional gold filter OK';
      if (inst.demoted) instWhy = inst.reason || 'ASIA SESSION — swing demote';
      if (isFinite(fin(inst.sessionWeight)) && fin(inst.sessionWeight) >= 3)
        instWhy += ' · session weight ' + fin(inst.sessionWeight);
    }
    gates.push({ key:'inst-filter', hard: instHard, pass: instOk, why: instWhy });

    return gates;
  }

  /* This mechanic's OUT-OF-SAMPLE record, or null when the log is absent.
     Never throws: no forward log must leave the gate on the in-sample number
     saying so, not break the scan. */
  function hgOgFwdFor(tab, mechanic){
    try{
      var w = W();
      if (!w || typeof w.hgFwdStats !== 'function' || !tab || !mechanic) return null;
      /* TWO records, and they answer different questions.

         'all' is every firing that carried a plan. It is what the in-sample
         pool measures, so it is the only one comparable with it, and it is
         what the card reports.

         'ticket' is the subset the ledger actually cleared. That is the only
         honest basis for a VETO: a mechanic fires, the ledger rejects most of
         them for reasons of its own — no trend, no participation, wrong
         regime — those rejects are recorded and they lose, and the mechanic
         is then condemned by trades this desk refused to take. Judging it
         that way is circular, and it is what emptied both tabs: every
         mechanic crossed twenty settled all-firings at zero wins and was
         vetoed, including on the setups the ledger had cleared.

         ticketOnly cannot be answered from the pruned aggregate, so it is a
         view of the recent window rather than of all time. That is a reason
         to require enough of it before acting, not a reason to ignore it. */
      var all = w.hgFwdStats(tab, mechanic, false);
      var tix = w.hgFwdStats(tab, mechanic, true);
      if (!all || !isFinite(fin(all.samples))) return null;
      all.ticketOnly = (tix && isFinite(fin(tix.samples))) ? tix : null;
      return all;
    }catch(e){ return null; }
  }

  /* ==================== gold-native ticket formation ====================
     The printed trade IS the mechanic. ENTRY stays hit.level (ROUND / FVG /
     Asia). Formation then uses gold maths on stop, targets, type and score:

       STOP  widen-only via structure, then re-clip at GOLD_STOP_MAX_PCT.
             Never tighten. A lastSwing 1000 pts away is not this setup.
       T1    OG_T1_R of formed risk (walk-forward measures here). First
             gold magnet beyond that print is named on the card.
       TYPE  MARKET when live is inside 0.25×ATR of the named entry; else LIMIT.
       SCORE conviction 0–100. Cost / thin fill / weekend DEMOTE. Never
             refuse a placeable plan — that verdict is hgOgFormation's.

     Native tickets must not go through hgApplyGoldBestLevels or
     hgFormTicket({style:'gold-*'}): both can move the named entry. */

  function hgOgRewardPts(dir, entry, px){
    var e = fin(entry), p = fin(px);
    if (!isFinite(e) || !isFinite(p)) return NaN;
    return (dir === 'long') ? (p - e) : (e - p);
  }

  function hgOgNextRound(entry, step, dir){
    var e = fin(entry), s = fin(step);
    if (!(isFinite(e) && s > 0)) return NaN;
    if (dir === 'long'){
      var up = Math.ceil((e + 1e-6) / s) * s;
      if (Math.abs(up - e) < 1e-6) up += s;
      return up;
    }
    var dn = Math.floor((e - 1e-6) / s) * s;
    if (Math.abs(dn - e) < 1e-6) dn -= s;
    return dn;
  }

  function hgOgGoldMagnets(dir, entry, rows, extra){
    extra = extra || {};
    var out = [], seen = {};
    function put(px, src){
      var v = fin(px);
      if (!isFinite(v) || v <= 0) return;
      var rew = hgOgRewardPts(dir, entry, v);
      if (!(rew > 0.05)) return;
      var k = v.toFixed(2) + '|' + src;
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ px: v, src: src, rew: rew });
    }
    var steps = [5, 10, 25, 50], i;
    for (i = 0; i < steps.length; i++) put(hgOgNextRound(entry, steps[i], dir), 'ROUND-' + steps[i]);
    var adr = extra.adr;
    if (!adr && rows) adr = hgOgAdr(rows, 14);
    if (adr){
      if (isFinite(fin(adr.adr))){
        if (isFinite(fin(adr.todayLo))) put(fin(adr.todayLo) + fin(adr.adr), 'ADR-CEILING');
        if (isFinite(fin(adr.todayHi))) put(fin(adr.todayHi) - fin(adr.adr), 'ADR-FLOOR');
      }
      put(adr.todayHi, 'DAY-HIGH');
      put(adr.todayLo, 'DAY-LOW');
    }
    var asia = extra.asia || hgOgAsiaRange(rows, extra.nowSec);
    if (asia){
      put(asia.hi, 'ASIA-HIGH');
      put(asia.lo, 'ASIA-LOW');
    }
    var zc = extra.zoneCtx;
    if (Array.isArray(zc)){
      var zi, z, zz;
      for (zi = 0; zi < zc.length; zi++){
        zz = zc[zi];
        z = (zz && zz.zone) ? zz.zone : zz;
        if (!z) continue;
        put(z.hi, 'ZONE-HIGH');
        put(z.lo, 'ZONE-LOW');
      }
    }
    var live = fin(extra.livePx);
    if (!(live > 0)) live = entry;
    try {
      var zl = hgOgZoneLevels(rows, live);
      if (zl){
        var side = (dir === 'long') ? zl.above : zl.below, j;
        for (j = 0; j < (side || []).length; j++){
          if (side[j]) put(side[j].px, side[j].src || 'ZONE');
        }
      }
    } catch (eZ) {}
    return out;
  }

  function hgOgPickMagnet(magnets, risk, minR, maxR){
    if (!magnets || !magnets.length || !(risk > 0)) return null;
    var lo = minR * risk, hi = maxR * risk;
    var best = null, i, m;
    for (i = 0; i < magnets.length; i++){
      m = magnets[i];
      if (!m || !(m.rew >= lo - 1e-9) || m.rew > hi + 1e-9) continue;
      if (!best || m.rew < best.rew) best = m;
    }
    return best;
  }

  function hgOgFormTicket(plan, hit, rows, extra, cfg){
    extra = extra || {};
    cfg = cfg || {};
    if (!plan || !hit) return plan;
    var dir = String(hit.dir || plan.dir || '').toLowerCase();
    if (dir !== 'long' && dir !== 'short') return plan;
    var entry = fin(plan.entry);
    var stop0 = fin(plan.stop);
    if (!(isFinite(entry) && entry > 0) || !isFinite(stop0)) return plan;
    var minRr = isFinite(fin(cfg.minRr)) ? fin(cfg.minRr) : 1.5;
    var live = fin(extra.livePx);
    var a = atrOf(rows, 14);
    if (!(isFinite(a) && a > 0)) a = entry * 0.003;

    /* 1. ENTRY locked. */
    plan.entry = entry;
    plan.dir = dir;

    /* 2. STOP: structure-widen at most 1×ATR extra, then 2.5% clip.
          Never pull it closer than the setup-level invalidation. */
    var stop = stop0;
    var stopFn = gfn('hgStructureStop');
    if (stopFn){
      try {
        var st = stopFn(dir, entry, rows, {
          atrLen: 14, look: 20, buffer: 0, capMode: 'structure'
        });
        if (st && isFinite(st.stop)){
          var wider = (dir === 'long') ? (st.stop < stop && st.stop < entry)
                                       : (st.stop > stop && st.stop > entry);
          if (wider){
            var widenAtr = Math.abs(st.stop - stop) / a;
            if (widenAtr <= 1.0 + 1e-9){
              var clipped = hgOgClipStop(dir, entry, st.stop);
              if (isFinite(clipped)){
                var stillWider = (dir === 'long') ? (clipped <= stop) : (clipped >= stop);
                var stillValid = (dir === 'long') ? (clipped < entry) : (clipped > entry);
                if (stillWider && stillValid){
                  stop = clipped;
                  plan.stopWidened = true;
                  plan.stopSource = st.note || 'structure';
                  plan.stopNote = (plan.stopNote ? plan.stopNote + '; ' : '')
                    + (st.note || 'stop widened to structure, clipped at 2.5% of gold');
                }
              }
            }
          }
        }
      } catch (eSt) {}
    }
    var clipped0 = hgOgClipStop(dir, entry, stop);
    if (isFinite(clipped0)) stop = clipped0;
    if (dir === 'long' && stop > stop0) stop = stop0;
    if (dir === 'short' && stop < stop0) stop = stop0;
    plan.stop = stop;

    var risk = Math.abs(entry - stop);
    if (!(risk > 0)){
      plan.stop = stop0;
      stop = stop0;
      risk = Math.abs(entry - stop0);
    }
    if (!(risk > 0)) return plan;

    /* 3. T1 is ALWAYS OG_T1_R of formed risk. Walk-forward and the card
          measure the same number; snapping T1 to a 2.5R round would
          reprint the original defect (measure 2R, print something harder).
          Gold magnets are named as the first liquidity BEYOND that 2R
          print, and T2 may sit on one when it still pays. */
    var magnets = hgOgGoldMagnets(dir, entry, rows, extra);
    var t1, t2, t1Source = 'R-multiple';
    var fromRisk = gfn('hgPlanFromRisk');
    if (fromRisk){
      try {
        var mech = fromRisk(dir, entry, stop, {
          t1R: OG_T1_R, t2R: OG_T2_R, minRr: minRr,
          targetPolicy: 'R-multiples of formed gold risk'
        });
        if (mech && isFinite(fin(mech.t1))){
          t1 = fin(mech.t1);
          if (isFinite(fin(mech.t2))) t2 = fin(mech.t2);
        }
      } catch (eR) {}
    }
    if (!isFinite(t1)) t1 = (dir === 'long') ? entry + OG_T1_R * risk : entry - OG_T1_R * risk;
    if (!isFinite(t2)) t2 = (dir === 'long') ? entry + OG_T2_R * risk : entry - OG_T2_R * risk;

    var magBeyond = hgOgPickMagnet(magnets, risk, OG_T1_R, OG_T2_R + 1.25);
    if (magBeyond && isFinite(magBeyond.px)){
      plan.t1Magnet = magBeyond.px;
      plan.t1MagnetSrc = magBeyond.src;
      plan.t1MagnetR = magBeyond.rew / risk;
      t1Source = 'R-multiple · toward ' + magBeyond.src;
    }
    var magT2 = hgOgPickMagnet(magnets, risk, Math.max(OG_T2_R * 0.95, OG_T1_R + 0.5), OG_T2_R + 1.5);
    if (magT2 && isFinite(magT2.px)){
      var t2Ahead = (dir === 'long') ? (magT2.px > t1) : (magT2.px < t1);
      if (t2Ahead){ t2 = magT2.px; plan.t2Source = magT2.src; }
    }
    if ((dir === 'long') ? t2 <= t1 : t2 >= t1){
      t2 = (dir === 'long') ? entry + OG_T2_R * risk : entry - OG_T2_R * risk;
      if ((dir === 'long') ? t2 <= t1 : t2 >= t1)
        t2 = (dir === 'long') ? t1 + 0.5 * risk : t1 - 0.5 * risk;
      if (!plan.t2Source) plan.t2Source = 'R-multiple';
    }

    plan.t1 = t1;
    plan.t2 = t2;
    plan.t1Source = t1Source;
    plan.rr1 = Math.abs(t1 - entry) / risk;
    plan.rr2 = Math.abs(t2 - entry) / risk;
    plan.rr = plan.rr1;
    plan.risk = risk;
    plan.riskPct = (entry > 0) ? (risk / entry * 100) : null;
    plan.formedBy = 'hgOgFormTicket';

    /* 4. TYPE + fill. Thin LIMIT demotes — it does not chase live gold. */
    var gapAtr = (isFinite(live) && live > 0 && a > 0) ? Math.abs(live - entry) / a : NaN;
    var atMarket = isFinite(gapAtr) && gapAtr <= 0.25;
    var kind = String(hit.kind || 'SETUP');
    plan.entryType = (atMarket ? 'MARKET @ ' : 'LIMIT @ ') + kind;
    if (atMarket) plan.fillProb = 90;
    else if (isFinite(gapAtr)){
      plan.fillProb = Math.max(5, Math.round(100 / (1 + gapAtr)));
      if (gapAtr > 1.5) plan.fillDemote = true;
    }
    var fillFn = gfn('hgFillProbability');
    if (fillFn && !atMarket){
      try {
        var fill = fillFn(rows, entry, dir, null, 12);
        if (fill && isFinite(+fill.pct)){
          plan.fillProb = +fill.pct;
          plan.fillNote = fill.note;
          if (plan.fillProb < 35) plan.fillDemote = true;
        }
      } catch (eF) {}
    }

    /* 5. Conviction. Demote on cost / weekend / thin fill / against-tape.
          Never return null for a placeable plan. */
    var score = 48;
    var parts = [];
    if (/ROUND/i.test(kind) || Math.abs(entry - Math.round(entry / 10) * 10) < 0.51){
      score += 10; parts.push('round');
    }
    if (/FVG|ASIA|KZ-JUDAS|SWEEP|SPRING/i.test(kind)){ score += 6; parts.push('named-poi'); }
    var kz = extra.killzone && String(extra.killzone.zone || extra.killzone.label || '').toLowerCase();
    if (/london|new.?york|\bny\b/.test(kz)){ score += 12; parts.push('killzone'); }
    else if (/asia/.test(kz)){ score += 3; parts.push('asia-session'); }
    else if (kz){ score -= 4; parts.push('off-killzone'); }
    var tape = hgOgTapeDir(rows);
    if (tape === dir){ score += 10; parts.push('with-tape'); }
    else if (tape && tape !== dir){ score -= 14; parts.push('against-tape'); }
    if (atMarket){ score += 10; parts.push('at-market'); }
    else if (plan.fillDemote){ score -= 10; parts.push('thin-fill'); }
    if (hgOgIsSurvivor(kind)){ score += 8; parts.push('replay-survivor'); }
    if (plan.t1Magnet){ score += 6; parts.push('magnet-t1'); }
    if (plan.stopWidened){ score += 3; parts.push('structure-stop'); }
    if (plan.momentumStop === true){ score -= 6; parts.push('vol-stop'); }

    var wkFn = gfn('hgInGoldWeekend');
    var nowSec = fin(extra.nowSec);
    if (wkFn && isFinite(nowSec) && nowSec > 0){
      try {
        if (wkFn(nowSec)){ score -= 16; parts.push('weekend'); plan.weekendDemote = true; }
        else {
          var secsFn = gfn('hgSecsToGoldWeekend');
          var secsLeft = secsFn ? fin(secsFn(nowSec)) : NaN;
          if (isFinite(secsLeft) && secsLeft >= 0 && secsLeft < 8 * 3600){
            score -= 8; parts.push('near-weekend');
          }
        }
      } catch (eWk) {}
    }
    try {
      var drag = hgOgCostDrag(plan);
      if (drag && isFinite(drag.costR) && drag.costR > 0.15){
        score -= Math.min(22, Math.round(drag.costR * 50));
        plan.costDemote = true;
        parts.push('cost');
      }
    } catch (eC) {}
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    plan.formationScore = Math.round(score);
    plan.formationParts = parts;
    return plan;
  }

  /* Grade + plan for one horizon. Reuses omniroute's grade/derive so the
     ticket rule and the R:R correction stay in one place. */
  function hgOgEvaluate(rows, hits, extra, cfg){
    var w = W(), out = [], i;
    if (!hits || !hits.length) return out;
    var gradeFn = (w && typeof w.hgOmniGrade === 'function') ? w.hgOmniGrade : null;
    var deriveFn = (w && typeof w.hgOmniDerivePlan === 'function') ? w.hgOmniDerivePlan : null;
    var planFn = gfn('hgPlanLevels');
    for (i = 0; i < hits.length; i++){
      var hit = hits[i];
      var ex = {}, k;
      for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) ex[k] = extra[k];
      /* UTAD is measured under SPRING — same family in the pool */
      var statKey = (hit.kind === 'UTAD') ? 'SPRING' : hit.kind;
      ex.stats = (extra && extra.stats && extra.stats[statKey]) ? extra.stats[statKey] : null;
      /* Tell the shared gate which forward pool is this desk's, so
         measured-edge can weigh the out-of-sample record for this mechanic
         against the in-sample one instead of only seeing the latter. */
      ex.fwdTab = 'OMNIGOLD:' + cfg.label;
      ex.fwd = hgOgFwdFor(ex.fwdTab, statKey);
      /* the gate computes breakeven as 1/(1+minRr); it must be the R the
         hit rate was measured at, which is where T1 sits */
      ex.minRr = OG_T1_R;
      ex.minAtrPct = cfg.minAtrPct;
      ex.sessionHard = cfg.sessionHard;
      /* Plan BEFORE gates: the cost-drag gate needs the actual stop distance,
         so the levels must exist before the ledger runs.

         The printed trade IS the mechanic. Live gold as the entry produced
         FVG-FILL @ 4429 with ENTRY 4535 / STOP 3415, and ROUND-MAGNET @ 4530
         with no plan. hgOgPlanForHit prices entry at hit.level, puts a
         sweep stop beyond that level, and keeps skipExact so enrichers
         cannot hijack continuation structure. livePx is for freshness. */
      var plan = null;
      try { plan = hgOgPlanForHit(hit, rows, ex, cfg); }
      catch (e) { plan = null; }
      /* Gold-native formation AFTER the named entry is priced. Never send
         native detector tickets through hgApplyGoldBestLevels / hgFormTicket
         gold-style — those move ROUND-MAGNET / FVG-FILL off hit.level. */
      if (plan){
        try { plan = hgOgFormTicket(plan, hit, rows, ex, cfg) || plan; }
        catch (eFmPl) {}
        if (deriveFn) plan = deriveFn(plan);
        /* Same floor the GOLD tabs use. Native stops stay ATR-based +
           GOLD_STOP_MAX_PCT clip — this stamp does not tighten them. */
        if (!isFinite(fin(plan.stopFloorAtr))) plan.stopFloorAtr = 1.5;
      }
      ex.planRisk = (plan && isFinite(fin(plan.risk))) ? fin(plan.risk) : NaN;
      /* Attach only when the engine exists. An absent engine is not a
         declined plan — stamping plan:null vetoed the whole desk in
         harnesses without plans.js. When the engine IS here, null is a
         real decline (plan-levels vetoes) so a ticket cannot print with
         no levels. */
      if (planFn) ex.plan = plan;
      ex.allHits = hits;          /* so the consensus gate can see the rest of the scan */
      var gates = hgOgGates(rows, hit, ex);
      var grade = gradeFn ? gradeFn(gates) : { ticket:false, vetoes:[], unknown:[], degraded:[], evaluated:0, total:gates.length, verdict:'engine unavailable' };
      var livePx = fin(ex.livePx);
      var setupPx = fin(hit.level);
      if (!isFinite(setupPx) && plan) setupPx = fin(plan.entry);
      var atrN = atrOf(rows, 14);
      var distAtr = (isFinite(livePx) && isFinite(setupPx) && isFinite(atrN) && atrN > 0)
                  ? Math.abs(livePx - setupPx) / atrN : NaN;
      /* FORMATION at plan construction (hg-v533): the venue stop floor and
         the measured-toxic kind demotion are decided HERE, where the plan
         is built, and stamped on the card. A throwing check is a
         fail-closed not-formed, never a silently tradable card. */
      var formation;
      try { formation = hgOgFormation({ kind: hit.kind, horizon: cfg.label, plan: plan, dir: hit.dir }); }
      catch (eFm) {
        formation = { formed: false, drag: null, failClosed: true,
          reasons: ['formation check threw — fail closed: ' + ((eFm && eFm.message) || eFm)] };
      }
      out.push({
        horizon: cfg.label, kind: hit.kind, dir: hit.dir, level: hit.level, why: hit.why,
        gates: gates, grade: grade, plan: plan,
        formation: formation,
        formationScore: (plan && isFinite(fin(plan.formationScore))) ? fin(plan.formationScore) : NaN,
        replaySurvivor: hgOgIsSurvivor(hit.kind) || !!(formation && formation.edgePrefer),
        edgePrefer: !!(formation && formation.edgePrefer),
        /* Carried on the candidate so the ranker can put the setup the rest
           of the desk agrees with above the one nothing supports. */
        consensus: hgOgConsensus(hgOgConsensusVoters(hits, rows, ex), hit),
        family: hgOgFamilyOf(hit.kind),
        rr: (plan && isFinite(fin(plan.rr1))) ? fin(plan.rr1) : NaN,
        distAtr: distAtr
      });
      try {
        var stampFn = (w && typeof w.hgOmniStampEdge === 'function') ? w.hgOmniStampEdge : null;
        if (stampFn) stampFn(out[out.length - 1], { fwd: ex.fwd, stats: ex.stats });
      } catch (eOgEdge) {}
    }
    return out;
  }

  /* ==================== data ==================== */

  /* The app's gold chain, in order, all feature-checked. Whichever answers
     is NAMED — a PAXG-derived setup is not XAUUSD spot and the user should
     see which instrument produced their levels. */
  /* WHOSE GOLD IS THIS?

     The status line said "source: scalp binance-xau". That is an internal
     key, and it was the only thing on screen telling a reader which
     instrument produced their entry, stop and target. Asked directly whether
     the prices matched their broker, the honest answer needed three lookups
     through two files.

     binance-xau is Binance's USD-M XAUUSDT PERPETUAL. Measured live it sat
     $4374.58 against $4369.70 spot — 0.11% above, which on a 21.94-point
     scalp stop is 22% of 1R. The trade's SHAPE survives, because entry, stop
     and target all come from the same feed, but the printed levels are not
     the ones a broker on spot XAUUSD is showing. It also trades 24/7 while
     spot gold brokers close from Friday night to Sunday night, so a weekend
     scan is built on bars the broker never printed.

     None of that is fixable from here — pointing the desk at a broker's own
     feed needs the XM bridge configured, which is infrastructure, not code.
     What IS fixable is the desk claiming less than it knows. It now names the
     instrument in plain words and states its distance from spot. */
  var OG_SRC_LABEL = {
    'xm-xauusd':   'XM XAUUSD (your broker feed)',
    'delta-xaut':  'DELTA XAUTUSD',
    'gold-spot':   'spot XAU',
    'binance-xau': 'BINANCE XAUUSDT perp',
    'binance-paxg':'BINANCE PAXGUSDT (tokenised gold)',
    'binance-xaut':'BINANCE XAUTUSDT (tokenised gold)',
    'twelvedata':  'TWELVE DATA XAU/USD',
    'yahoo':       'YAHOO GC=F'
  };
  function hgOgSrcLabel(src){
    var k = String(src || '');
    return OG_SRC_LABEL[k] || (k || 'none');
  }
  /* True only for a feed that IS the instrument a spot-gold broker quotes. */
  function hgOgSrcIsBroker(src){ return String(src || '') === 'xm-xauusd'; }
  /* Execution-native feeds — levels are already the tradable instrument. */
  function hgOgSrcIsVenueNative(src){
    var k = String(src || '');
    return k === 'xm-xauusd' || k === 'delta-xaut';
  }

  function hgOgFeedSourceFor(tf){
    var w = W();
    if (w && w.S){
      if (w.S.goldSrcByTf && w.S.goldSrcByTf[tf]) return w.S.goldSrcByTf[tf];
      if (w.S.goldDataSource) return w.S.goldDataSource;
    }
    return null;
  }

  function hgOgFetchRowsLegacy(tf, n){
    var xm = gfn('getXmGoldCandles'), gg = gfn('getGoldCandles'), bk = gfn('binanceKlines');
    return Promise.resolve()
      .then(function(){ return xm ? xm(tf, n) : null; })
      .catch(function(){ return null; })
      .then(function(a){
        if (a && a.rows && a.rows.length) return { rows: a.rows, source: a.source || 'xm-xauusd' };
        return Promise.resolve().then(function(){ return gg ? gg(tf, n) : null; })
          .catch(function(){ return null; })
          .then(function(b){
            if (b && b.rows && b.rows.length) return { rows: b.rows, source: b.source || 'gold-spot' };
            return Promise.resolve().then(function(){ return bk ? bk('PAXGUSDT', tf, n) : null; })
              .catch(function(){ return null; })
              .then(function(c){
                if (c && c.length) return { rows: c, source: 'binance-paxg' };
                return { rows: [], source: null };
              });
          });
      });
  }

  /* Prefer getXAUCandles — the same spot-first chain GOLD SCALP/SWING use. */
  function hgOgFetchRows(tf, n){
    var xauFn = gfn('getXAUCandles');
    if (xauFn){
      return Promise.resolve()
        .then(function(){ return xauFn(tf, n); })
        .then(function(rows){
          if (rows && rows.length){
            return { rows: rows, source: hgOgFeedSourceFor(tf) || 'binance-xau' };
          }
          return hgOgFetchRowsLegacy(tf, n);
        })
        .catch(function(){ return hgOgFetchRowsLegacy(tf, n); });
    }
    return hgOgFetchRowsLegacy(tf, n);
  }

  /* Scale printed plans to live spot — mirrors goldscalp goldAlignLevelsToSpot. */
  function hgOgAlignPlansToSpot(list, klineRef, liveRef, minPct){
    if (!list || !list.length) return;
    klineRef = fin(klineRef); liveRef = fin(liveRef);
    if (!(klineRef > 0) || !(liveRef > 0)) return;
    var ratio = liveRef / klineRef;
    var floorPct = (isFinite(fin(minPct)) && fin(minPct) > 0) ? fin(minPct) : 0.35;
    if (Math.abs(ratio - 1) * 100 < floorPct) return;
    var i, c, p, keys;
    for (i = 0; i < list.length; i++){
      c = list[i];
      if (!c) continue;
      if (isFinite(fin(c.level))) c.level = fin(c.level) * ratio;
      p = c.plan;
      if (p){
        keys = ['entry', 'stop', 't1', 't2', 'risk'];
        for (var ki = 0; ki < keys.length; ki++){
          if (isFinite(fin(p[keys[ki]]))) p[keys[ki]] = fin(p[keys[ki]]) * ratio;
        }
      }
      c.spotAligned = true;
      c.spotAlignRatio = ratio;
    }
  }

  /* Live spot anchor (gold-api.com) — bounded, never stalls a scan. */
  function hgOgResolveLiveSpot(klineHint){
    var sfFn = gfn('hgGoldLiveSpot');
    if (!sfFn) return Promise.resolve(NaN);
    return Promise.race([
      Promise.resolve().then(function(){ return sfFn(klineHint); }).catch(function(){ return NaN; }),
      new Promise(function(r){ setTimeout(function(){ r(NaN); }, 2500); })
    ]).then(function(sp){ return (isFinite(fin(sp)) && fin(sp) > 0) ? fin(sp) : NaN; });
  }

  /* Fetch and cache correlation regime data. Updates cache only if it's older than 1 hour. */
  function hgOgFetchCorrelationRegime(goldRows, macro){
    var now = Date.now();
    var lastUpdate = __og.lastRegimeUpdate || 0;
    var hourMs = 3600000;
    /* Check cache freshness: only fetch if >1 hour stale */
    if (isFinite(lastUpdate) && (now - lastUpdate) < hourMs && __og.correlationRegime){
      return Promise.resolve(__og.correlationRegime);
    }
    /* Fetch DXY data and detect regime */
    return hgOgFetchDxyData().then(function(dxyRows){
      if (!dxyRows) {
        /* Graceful: use cached or default */
        if (__og.correlationRegime) return __og.correlationRegime;
        return hgOgDetectRegime(null, goldRows, null, macro);
      }
      var regime = hgOgDetectRegime(dxyRows, goldRows, (macro && macro.us10yRows) || null, macro);
      __og.correlationRegime = regime;
      __og.lastRegimeUpdate = now;
      return regime;
    }).catch(function(){
      /* On fetch error: return cached or default */
      if (__og.correlationRegime) return __og.correlationRegime;
      return hgOgDetectRegime(null, goldRows, null, macro);
    });
  }

  function hgOgRefreshDistAtr(list, livePx, rows){
    if (!list || !list.length || !(fin(livePx) > 0)) return;
    var atrN = atrOf(rows, 14);
    if (!(isFinite(atrN) && atrN > 0)) return;
    var i, c, setupPx;
    for (i = 0; i < list.length; i++){
      c = list[i];
      if (!c) continue;
      c.livePx = fin(livePx);
      setupPx = fin(c.level);
      if (!isFinite(setupPx) && c.plan) setupPx = fin(c.plan.entry);
      if (isFinite(setupPx)) c.distAtr = Math.abs(fin(livePx) - setupPx) / atrN;
    }
  }

  /* How far the setup entry sits from the live market — limit retest vs at-market. */
  function hgOgEntryMarketNote(row, plan){
    var mkt = fin(__og.spotAnchor) || fin(row && row.livePx);
    var e = plan && fin(plan.entry);
    if (!(mkt > 0) || !(e > 0)) return '';
    var gap = mkt - e;
    var pts = Math.abs(gap);
    if (pts < 0.5) return 'MARKET ' + fmtPx(mkt) + ' · at entry';
    var dir = String(row.dir || '').toLowerCase();
    if (dir === 'short'){
      return 'MARKET ' + fmtPx(mkt) + (gap < 0
        ? ' · +' + pts.toFixed(0) + ' pts below entry · limit retest · not a market short'
        : ' · +' + pts.toFixed(0) + ' pts above entry');
    }
    if (dir === 'long'){
      return 'MARKET ' + fmtPx(mkt) + (gap > 0
        ? ' · +' + pts.toFixed(0) + ' pts above entry · limit retest · not a market long'
        : ' · +' + pts.toFixed(0) + ' pts below entry');
    }
    return 'MARKET ' + fmtPx(mkt) + ' · ' + pts.toFixed(0) + ' pts from entry';
  }

  /* ==================== anticipation: the next gold levels ==================== */

  /* The desk's own levels, fed into the shared zone engine on equal terms:
     ADR bands (the day's statistical ceiling and floor), the Asia range
     (the liquidity London and New York hunt), and the prior ISO week's
     extremes. Everything else — swing points, prior day, Donchian, value
     area, round hundreds, AVWAP bands — the engine already reads. */
  function hgOgZoneLevels(rows, livePx){
    var above = [], below = [];
    /* survive feed-shaped garbage standalone: a hole-punched array (venue
       dropped a candle) must not throw — same rule as every other export */
    if (!Array.isArray(rows)) rows = [];
    rows = rows.filter(function(r){ return r && typeof r === 'object' && isFinite(fin(r.c)); });
    livePx = fin(livePx);
    if (!rows.length || !(livePx > 0)) return { above: above, below: below };
    function put(px, src){
      var v = fin(px);
      if (!isFinite(v) || v <= 0) return;
      if (v > livePx) above.push({ px: v, src: src });
      else if (v < livePx) below.push({ px: v, src: src });
    }
    var adr = hgOgAdr(rows, 14);
    if (adr && isFinite(fin(adr.adr))){
      if (isFinite(fin(adr.todayLo))) put(adr.todayLo + adr.adr, 'ADR ceiling');
      if (isFinite(fin(adr.todayHi))) put(adr.todayHi - adr.adr, 'ADR floor');
    }
    var asia = hgOgAsiaRange(rows);
    if (asia){
      put(asia.hi, 'Asia high');
      put(asia.lo, 'Asia low');
    }
    /* prior complete ISO week's extremes */
    var byWk = {}, i, t, wk;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t)) continue;
      wk = Math.floor((t - 345600) / 604800);   /* ISO-ish: weeks anchored Monday */
      if (!byWk[wk]) byWk[wk] = { hi: num(rows[i].h), lo: num(rows[i].l) };
      else {
        if (num(rows[i].h) > byWk[wk].hi) byWk[wk].hi = num(rows[i].h);
        if (num(rows[i].l) < byWk[wk].lo) byWk[wk].lo = num(rows[i].l);
      }
    }
    var wks = Object.keys(byWk).sort();
    if (wks.length >= 2){
      var pw = byWk[wks[wks.length - 2]];
      put(pw.hi, 'prior-week high');
      put(pw.lo, 'prior-week low');
    }
    return { above: above, below: below };
  }

  /* The NEXT GOLD LEVELS panel — anticipation, not a ticket. The 35-gate
     mechanic cards below stay the only path to a TICKET; this panel exists
     so the reader holds the next high and the next bottom BEFORE the
     market reaches them, with the trigger rule and the times it can fire. */
  function hgOgZonesPanel(rows, livePx, tapeDir){
    var opFn = gfn('opAssess'), tmFn = gfn('opNextCloses');
    if (!opFn || !rows || rows.length < 120 || !isFinite(fin(livePx))) return '';
    var cands;
    try { cands = opFn(rows, livePx, hgOgZoneLevels(rows, livePx)); }
    catch (e) { return ''; }
    if (!cands || !cands.length) return '';
    tapeDir = String(tapeDir || '').toLowerCase();
    if (tapeDir === 'long' || tapeDir === 'short'){
      cands = cands.filter(function(zc){ return String(zc.dir || '').toLowerCase() === tapeDir; });
      if (!cands.length) return '';
    }
    /* A gold zone flipping to TRIGGERED reaches the reader even off-tab —
       chime + Telegram through the alert bell's ZONES class, keyed per
       tab+zone (seeded silently on the first scan, never fires twice). */
    var azFn = gfn('hgAlertZones');
    if (azFn){
      try{
        azFn(cands.filter(function(zc){ return zc.status === 'TRIGGERED'; })
          .map(function(zc){
            return { sym: 'XAUUSD', dir: zc.dir, tab: 'OMNIGOLD',
                     zoneLo: zc.zone.lo, zoneHi: zc.zone.hi,
                     entry: zc.entry, stop: zc.stop, t1: zc.t1, t2: zc.t2, rr2: zc.rr2,
                     verdict: 'anticipation zone — the gated OMNIGOLD cards decide tickets' };
          }), 'OMNIGOLD');
      }catch(eAz){}
    }
    var zoneSpan = 'anticipation — the nearest high-confluence zone each way · tickets are decided by the gated cards below';
    if (tapeDir === 'short')
      zoneSpan = 'anticipation — gold is going down, so the long zone is not shown · tickets are decided by the gated cards below';
    else if (tapeDir === 'long')
      zoneSpan = 'anticipation — gold is going up, so the short zone is not shown · tickets are decided by the gated cards below';
    var h = '<div class="panel"><h2>NEXT GOLD LEVELS <span>' + zoneSpan + '</span></h2>';
    if (tmFn){
      try { h += '<div class="dim">triggers evaluate at 1h closes: ' + esc(tmFn(Date.now(), 3).join(' · ')) + '</div>'; } catch (e2) {}
    }
    for (var i = 0; i < cands.length; i++){
      var c = cands[i];
      h += '<div style="margin-top:6px">'
        + '<b>' + (c.dir === 'short' ? 'SHORT from' : 'LONG from') + ' ' + fmtPx(c.zone.lo) + '–' + fmtPx(c.zone.hi) + '</b>'
        + ' <span class="gpip' + (c.status === 'TRIGGERED' ? ' ok' : '') + '">' + c.status + '</span>'
        + ' <span class="dim">' + c.zone.confluence + ' sources: ' + esc(c.zone.srcs.join(', '))
        + ' · ' + c.zone.distAtr.toFixed(1) + '×ATR from ' + fmtPx(livePx) + '</span>'
        + '<div class="dim">if it rejects: entry ' + fmtPx(c.entry) + ' · SL ' + fmtPx(c.stop)
        + ' (squeezed) · TP1 ' + fmtPx(c.t1) + ' (2R) · TP2 ' + fmtPx(c.t2) + ' (' + c.rr2.toFixed(1) + 'R)'
        + ' · trigger: ' + esc(c.trigger) + '</div>'
        + (c.evidence && c.evidence.length
            ? '<div class="dim">evidence: ' + esc(c.evidence.join(' · ')) + '</div>'
            : '<div class="dim">no exhaustion evidence yet — a level, not a setup, until the tape argues for it</div>')
        + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ==================== render ==================== */

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function pill(t, c){ return '<span class="gpip ' + (c || '') + '">' + esc(t) + '</span>'; }
  /* Gold prints in dollars — 2dp is right for XAUUSD and PAXG alike. */
  /* isFinite(null) is TRUE and +null is 0, so formatting a null through the
     natural guard prints a confident "0.00" for a value that is absent. Every
     cleared R:R and every venue field that legitimately arrives as null went
     through here. fin() maps null/undefined/'' to NaN first. */
  function fmtPx(n){ var v = fin(n); return isFinite(v) ? v.toFixed(2) : '—'; }

  function hgOgHorizonCfg(label){
    var L = String(label || '').toUpperCase();
    return (L === 'SWING') ? HORIZONS.swing : HORIZONS.scalp;
  }

  /* Plain readout under T1: where the target sits in R, points, %, and the
     horizon window the desk uses to judge whether it is reachable. */
  function hgOgTargetReadout(plan, horizonLabel){
    if (!plan) return '';
    try {
      var e = fin(plan.entry), s = fin(plan.stop), t1 = fin(plan.t1);
      var dir = String(plan.dir || '').toLowerCase();
      if (!(e > 0) || !(t1 > 0) || (dir !== 'long' && dir !== 'short')) return '';
      var risk = fin(plan.risk);
      if (!(risk > 0) && isFinite(s)){
        risk = (dir === 'long') ? (e - s) : (s - e);
      }
      if (!(risk > 0)) return '';
      var rew = (dir === 'long') ? (t1 - e) : (e - t1);
      if (!(rew > 0)) return '';
      var t1R = fin(plan.t1R);
      if (!(t1R > 0)) t1R = rew / risk;
      var hz = hgOgHorizonCfg(horizonLabel);
      var bars = hz.horizonBars || 24;
      var tf = hz.tf || '1h';
      var pct = (rew / e) * 100;
      return 'T1 · ' + fmt(t1R, 1) + 'R · ' + rew.toFixed(0) + ' pts · '
           + pct.toFixed(2) + '% · ' + bars + '×' + tf + ' window';
    } catch (e){ return ''; }
  }
  function fmt(n, d){ var v = fin(n); return isFinite(v) ? v.toFixed(d == null ? 2 : d) : '—'; }

  /* 62th, 23th, 2th. Ordinals are not "th" for everything. */
  function hgOgOrdinal(n){
    var v = Math.round(n), t = v % 100, u = v % 10;
    var suf = (t >= 11 && t <= 13) ? 'th' : (u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
    return v + suf;
  }

  function gateLine(g){
    /* An info gate does not veto, so it must not print VETO next to a TICKET
       badge — the row would contradict the card. It reads AGAINST: the app
       disagrees, and is saying so without standing the trade aside. */
    var vetoed = (g.pass === false) && !g.info;
    var against = (g.pass === false) && g.info;
    var cls = g.pass === true ? 'ok' : (vetoed ? 'bad' : '');
    var mark = g.pass === true ? 'PASS'
             : vetoed ? 'VETO'
             : against ? 'AGAINST'
             : (g.hard ? 'NO DATA' : 'UNCHECKED');
    return '<li>' + pill(mark, cls) + ' <b>' + esc(g.key) + '</b> <span class="dim">' + esc(g.why) + '</span></li>';
  }


  /* ==================== the pick ====================

     One setup per horizon, marked out from the rest.

     It is called the STRONGEST CASE and not "highest probability to win",
     because the desk cannot honestly say the second thing. A probability
     needs a settled record; most of these 27 mechanics have never settled a
     trade here, and the ones that have are 0 for 13. Printing a win
     percentage next to a setup that has no measured record would be inventing
     the one number the user would most reasonably act on.

     So the pick is ranked on the evidence that DOES exist, in this order:

       1. it must be a TICKET — a vetoed setup is never promoted
       2. it must agree with gold tape — a LONG is not the pick on a down tape
       3. a structural stop beats a labelled volatility stop
       4. a level inside GOLD_NEAR_ATR beats a far ticket
       5. among those, a balanced score of strategy families + indicator
          info-reads + coverage + extra mechanics + horizon agree
       6. closer print is the tie-break when the evidence is equal

     and the card states which of those it is standing on, so "strongest" is
     auditable rather than a colour. Where a measured record exists it is
     quoted with its sample count; where none exists the card says so in those
     words instead of leaving a confident-looking gap. */

  /* The pick's own colour, injected once and scoped to this tab's cards.

     Deliberately VIOLET, not green: green already means PASS on every gate
     row in the app, and reusing it here would read as "this one passed" —
     which says nothing, since every pick is a ticket by construction. A
     colour that means nothing elsewhere can mean exactly one thing here.

     Colours are set explicitly rather than inherited so the card reads the
     same on the light and dark stylesheets, and the accent is carried by a
     left rule and a tint, never by text colour alone — a card that says what
     it means only in colour says nothing to a reader who cannot see it, which
     is why the badge and the reasons are spelled out in words too. */
  function hgOgInjectPickStyles(){
    var d = (typeof document !== 'undefined') ? document : null;
    if (!d || !d.head) return;
    if (d.getElementById('og-pick-css')) return;
    var st = d.createElement('style');
    st.id = 'og-pick-css';
    st.textContent =
      '#ogCards .card.og-pick{'
    +   'border-left:4px solid #7c3aed;'
    +   'background:linear-gradient(90deg,rgba(124,58,237,.075),transparent 42%);'
    +   'box-shadow:0 0 0 1px rgba(124,58,237,.30),0 6px 20px -8px rgba(124,58,237,.40);'
    + '}'
    + '#ogCards .card.og-pick .ttl{color:#6d28d9}'
    + '#ogCards .gpip.pick{'
    +   'background:#7c3aed;border:1px solid #6d28d9;color:#fff;'
    +   'font-weight:700;letter-spacing:.04em;'
    + '}'
    + '#ogCards .og-pick-why{'
    +   'margin:8px 0;padding:8px 10px;'
    +   'border:1px solid rgba(124,58,237,.32);border-left:3px solid #7c3aed;'
    +   'background:rgba(124,58,237,.06);border-radius:4px;font-size:12px;line-height:1.5;'
    + '}'
    + '#ogCards .og-pick-why b{color:#6d28d9}'
    + '#ogCards .og-pick-why ul{margin:5px 0 5px 16px;padding:0}'
    + '#ogCards .og-pick-why li{margin:2px 0}'
    + '#ogCards .og-pick-none{'
    +   'border-left:3px solid rgba(124,58,237,.42);'
    +   'background:rgba(124,58,237,.04);margin-bottom:8px;'
    + '}'
    /* Dark stylesheets: same hue, lifted so it holds on a dark ground. */
    + '@media (prefers-color-scheme:dark){'
    +   '#ogCards .card.og-pick{border-left-color:#a78bfa;'
    +     'background:linear-gradient(90deg,rgba(167,139,250,.13),transparent 42%);'
    +     'box-shadow:0 0 0 1px rgba(167,139,250,.34),0 6px 20px -8px rgba(167,139,250,.34)}'
    +   '#ogCards .card.og-pick .ttl{color:#c4b5fd}'
    +   '#ogCards .gpip.pick{background:#7c3aed;border-color:#a78bfa;color:#fff}'
    +   '#ogCards .og-pick-why{border-color:rgba(167,139,250,.36);border-left-color:#a78bfa;'
    +     'background:rgba(167,139,250,.10)}'
    +   '#ogCards .og-pick-why b{color:#c4b5fd}'
    +   '#ogCards .og-pick-none{border-left-color:rgba(167,139,250,.45);background:rgba(167,139,250,.07)}'
    + '}'
    + '#ogCards .og-mp-hz{margin-top:12px}'
    + '#ogCards .og-mp-hz + .og-mp-hz{border-top:1px solid #E2E8F0;padding-top:12px;margin-top:12px}'
    + '#ogCards .og-mp-hz .hg-mp-head{font-size:14px}'
    + '.og-grade-chip{display:inline-block;font-weight:800;font-size:13px;line-height:1;'
    +   'padding:4px 10px;border-radius:6px;letter-spacing:.06em;vertical-align:middle;'
    +   'border:2px solid transparent;box-shadow:0 1px 0 rgba(0,0,0,.06)}'
    + '.og-grade-chip.og-grade-lg{font-size:20px;padding:6px 14px;border-radius:8px;'
    +   'min-width:2rem;text-align:center}'
    + '.og-grade-a{color:#14532d;background:linear-gradient(180deg,#bbf7d0,#4ade80);border-color:#16a34a}'
    + '.og-grade-b{color:#1e3a8a;background:linear-gradient(180deg,#bfdbfe,#60a5fa);border-color:#2563eb}'
    + '.og-grade-c{color:#92400e;background:linear-gradient(180deg,#fde68a,#fbbf24);border-color:#d97706}'
    + '.og-grade-d{color:#7f1d1d;background:linear-gradient(180deg,#fecaca,#f87171);border-color:#dc2626}'
    + '.og-grade-legend{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;margin-left:4px}'
    + '.og-gold-engine-row .og-grade-chip{margin-left:8px}'
    + '[data-hg-mp] .og-mp-hz .og-grade-chip{margin-left:6px}'
    + '@media (prefers-color-scheme:dark){'
    +   '.og-grade-a{color:#ecfdf5;background:linear-gradient(180deg,#166534,#22c55e);border-color:#4ade80}'
    +   '.og-grade-b{color:#eff6ff;background:linear-gradient(180deg,#1d4ed8,#3b82f6);border-color:#93c5fd}'
    +   '.og-grade-c{color:#fffbeb;background:linear-gradient(180deg,#b45309,#f59e0b);border-color:#fcd34d}'
    +   '.og-grade-d{color:#fef2f2;background:linear-gradient(180deg,#991b1b,#ef4444);border-color:#fca5a5}'
    + '}'
    + '@media (prefers-color-scheme:dark){'
    +   '#ogCards .og-mp-hz + .og-mp-hz{border-top-color:rgba(167,139,250,.28)}'
    + '}';
    d.head.appendChild(st);
  }

  function hgOgPickBasis(c){
    var bits = [], fwd = null, cons = c && c.consensus;
    if (cons && cons.nAgree > 0){
      bits.push(cons.nAgree + ' mechanic famil' + (cons.nAgree === 1 ? 'y agrees' : 'ies agree')
              + (cons.agree && cons.agree.length ? ' (' + cons.agree.join(', ') + ')' : '')
              + (cons.nAgainst ? ', ' + cons.nAgainst + ' against' : ', none against'));
    }
    /* The only number here that is out-of-sample. */
    var g, i;
    for (i = 0; c && c.gates && i < c.gates.length; i++){
      g = c.gates[i];
      if (g && g.key === 'measured-edge'){ fwd = g; break; }
    }
    if (fwd){
      if (/settled out-of-sample/.test(String(fwd.why))) bits.push('own settled record: ' + fwd.why);
      else bits.push('no settled out-of-sample record yet — nothing here is a measured win rate');
    }
    var ev = (c && c.grade && c.grade.evaluated) || 0;
    var tot = (c && c.grade && c.grade.total) || 0;
    if (tot) bits.push(ev + ' of ' + tot + ' checks could be evaluated');
    var info = hgOgInfoNet(c && c.gates);
    if (info.n){
      bits.push(info.pass + ' indicator read' + (info.pass === 1 ? '' : 's') + ' with the setup, '
              + info.fail + ' against (' + info.net + ' net across ' + info.n + ' info checks)');
    }
    if (c && c.horizonAgree === true) bits.push('the other gold horizon agrees');
    else if (c && c.horizonAgree === false) bits.push('the other gold horizon disagrees');
    if (c && c.alsoKinds && c.alsoKinds.length){
      bits.push((c.alsoKinds.length + 1) + ' mechanics fired on these same levels — one trade');
    }
    bits.push('ranked on a balanced score of strategy families + indicator reads + coverage + proximity — not a win probability');
    if (c && c.plan && c.plan.momentumStop === true){
      bits.push('stop is a labelled VOLATILITY / MOMENTUM stop — structure was too far; this is the compromise, not invalidation');
    }
    return bits;
  }

  /* Info-gate net: indicator reads that never veto and never invent a ticket.
     Hard/conditional gates stay on the ledger; they are not double-counted here. */
  function hgOgInfoNet(gates){
    var pass = 0, fail = 0, n = 0, i, g;
    for (i = 0; i < (gates || []).length; i++){
      g = gates[i];
      if (!g || g.info !== true) continue;
      n++;
      if (g.pass === true) pass++;
      else if (g.pass === false) fail++;
    }
    return { pass: pass, fail: fail, net: pass - fail, n: n };
  }

  /* Composite rank, not a probability. Strategy families and indicator
     reads share the scale (ratios, so 40 mechanics cannot drown 12
     oscillators or the other way around). Tape is a large sort key so
     against-tape cards sink. Tickets stay above watches. Proximity is
     a bonus, not the whole argument — hgOgPickFor still prefers the
     GOLD_NEAR_ATR pool before this score runs. */
  function hgOgBalanceParts(c, tape){
    var cons = (c && c.consensus) || {};
    var nAgree = cons.nAgree || 0;
    var nAgainst = cons.nAgainst || 0;
    var nSplit = cons.nSplit || 0;
    var famDen = nAgree + nAgainst + nSplit;
    var family = famDen ? (nAgree - nAgainst) / famDen : 0;
    var info = hgOgInfoNet(c && c.gates);
    var infoRatio = info.n ? (info.net / info.n) : 0;
    var tot = (c && c.grade && c.grade.total) || 0;
    var ev = (c && c.grade && c.grade.evaluated) || 0;
    var coverage = tot ? (ev / tot) : 0;
    var also = (c && c.alsoKinds && c.alsoKinds.length) ? c.alsoKinds.length : 0;
    var alsoNorm = Math.min(also, 4) / 4;
    var horizon = (c && c.horizonAgree) ? 1 : 0;
    var dist = (c && isFinite(fin(c.distAtr))) ? fin(c.distAtr) : 99;
    var near = 1;
    if (isFinite(dist) && dist > GOLD_NEAR_ATR){
      near = Math.max(0, 1 - (dist - GOLD_NEAR_ATR) / 4);
    }
    var dir = String((c && c.dir) || '').toLowerCase();
    var tapeDir = String(tape || '').toLowerCase();
    var tapeScore = 0;
    if (tapeDir === 'long' || tapeDir === 'short'){
      tapeScore = (dir === tapeDir) ? 1 : -1;
    }
    var ticketN = (c && c.grade && c.grade.ticket) ? 1 : 0;
    var edgeN = 0;
    if (c && isFinite(fin(c.edgeScore))) edgeN = Math.max(0, Math.min(100, fin(c.edgeScore))) / 100;
    var score = 100 * tapeScore
              + 120 * ticketN
              + 30 * family
              + 30 * infoRatio
              + 12 * coverage
              + 10 * alsoNorm
              + 8 * horizon
              + 10 * near
              + 8 * edgeN;
    return {
      score: score, family: family, infoRatio: infoRatio, coverage: coverage,
      alsoNorm: alsoNorm, horizon: horizon, near: near, tapeScore: tapeScore,
      ticket: ticketN, info: info, dist: dist, edge: edgeN,
      nAgree: nAgree, nAgainst: nAgainst
    };
  }
  function hgOgBalanceScore(c, tape){
    return hgOgBalanceParts(c, tape).score;
  }

  function hgOgDeskOrder(list, tape){
    var tapeDir = String(tape || '').toLowerCase();
    /* replay-survivor class key (hg-v533): within the SAME section — same
       ticket state, same tape side — a kind the replay measured
       gross-positive at scale with a low fee load sorts ahead of untagged
       kinds. Ranking only: it never crosses a section boundary (a survivor
       WATCH cannot outrank a TICKET), and pick selection is untouched. */
    function ordCls(c){
      return ((c && c.grade && c.grade.ticket) ? 2 : 0)
        + (((tapeDir === 'long' || tapeDir === 'short')
            && String((c && c.dir) || '').toLowerCase() === tapeDir) ? 1 : 0);
    }
    function surv(c){
      return (c && (c.replaySurvivor || hgOgIsSurvivor(c.kind))) ? 1 : 0;
    }
    return (list || []).slice().sort(function(a, b){
      if (!!a.topPick !== !!b.topPick) return a.topPick ? -1 : 1;
      if (!!a.topWatch !== !!b.topWatch) return a.topWatch ? -1 : 1;
      if (ordCls(a) === ordCls(b)){
        var va = surv(a), vb = surv(b);
        if (va !== vb) return vb - va;
      }
      var sa = hgOgBalanceScore(a, tapeDir);
      var sb = hgOgBalanceScore(b, tapeDir);
      if (sb !== sa) return sb - sa;
      var da = isFinite(fin(a.distAtr)) ? a.distAtr : 99;
      var db = isFinite(fin(b.distAtr)) ? b.distAtr : 99;
      if (da !== db) return da - db;
      return String(a.kind || '') < String(b.kind || '') ? -1 : 1;
    });
  }

  /* The price a CLOSED bar must print for hgOgTapeDir(rows) to read `want`.
     Mirrors that function: side requires the stack. 'long' is close above
     EMA21 when EMA21 is already over EMA50; 'short' is close below EMA21
     when the stack is already down. One bar cannot invent a stack cross,
     so the level is NaN when the stack disagrees — honest empty, not a
     fake release. The level moves as the EMA does. */
  function hgOgTapeFlipLevel(rows, want){
    try{
      if (!rows || rows.length < 55) return NaN;
      var closes = closesOf(rows);
      if (closes.length < 55) return NaN;
      var e21 = emaOf(closes, 21), e50 = emaOf(closes, 50);
      if (!isFinite(e21) || !isFinite(e50)) return NaN;
      if (want === 'long')  return (e21 > e50) ? e21 : NaN;
      if (want === 'short') return (e21 < e50) ? e21 : NaN;
      return NaN;
    }catch(e){ return NaN; }
  }

  /* WHY THIS SAYS MORE THAN "STANDING ASIDE".

     The desk was telling the reader that gold is going down and a long is not
     the setup. True, and it left out the two things the reader actually needs:
     how many tickets are being HELD, and what would release them. From the
     outside, a desk holding four cleared longs 0.35% below its trigger looks
     exactly like a desk that found nothing. Reported as "still no trade" when
     the honest answer was "four trades, waiting on one level".

     Nothing here loosens the tape rule. That rule is the best-evidenced thing
     on this desk — firings that agree with it hit 37.4% against 24.0% for
     those that do not, z +9.79 on the scalp horizon — so the setups stay held.
     They are simply no longer held in silence. */
  function hgOgMpNoneWhy(tape, held){
    var base;
    if (tape === 'short')
      base = 'gold is going down — a LONG is not the setup. Standing aside is the position when no short ticket cleared.';
    else if (tape === 'long')
      base = 'gold is going up — a SHORT is not the setup. Standing aside is the position when no long ticket cleared.';
    else
      base = 'nothing on this horizon cleared the ledger this scan. Standing aside is the position.';
    if (!held || !held.n) return base;
    var side = (tape === 'short') ? 'LONG' : 'SHORT';
    var s = base + ' ' + held.n + ' ticket' + (held.n === 1 ? '' : 's')
          + ' cleared the ledger and ' + (held.n === 1 ? 'is' : 'are') + ' HELD — all '
          + side + ' while the tape reads ' + String(tape).toUpperCase() + '.';
    if (isFinite(fin(held.level)) && isFinite(fin(held.from)) && fin(held.from) > 0){
      var lvl = fin(held.level), from = fin(held.from);
      var pct = Math.abs(lvl - from) / from * 100;
      s += ' They release if a closed ' + (held.tf || '1h') + ' bar prints '
        +  (tape === 'short' ? 'above ' : 'below ') + lvl.toFixed(2)
        +  ' (' + (lvl >= from ? '+' : '') + (lvl - from).toFixed(2) + ', '
        +  pct.toFixed(2) + '% from ' + from.toFixed(2) + ')'
        +  ' — that level moves with the EMA, so it is a reading of now.';
    }
    return s;
  }

  function hgOgNormalizeGrade(g){
    var s = String(g || '').toUpperCase().trim();
    if (s === 'CLEAN') return 'A';
    if (s === 'A' || s === 'B' || s === 'C' || s === 'D') return s;
    return '';
  }

  /* A CONFLUENCE GRADE FOR THE DESK'S OWN CARDS.

     Until now only ENGINE picks bridged from the GOLD SCALP/SWING tabs wore a
     letter; OMNIGOLD's own mechanic cards printed "50/54 checks" and nothing
     else, so a reader comparing an ORB against a STRUCT-BOS had no glanceable
     quality read at all.

     WHY NOT THE ENGINE'S OWN TALLY. The engine grades on a raw count — A at
     eight or more agreeing reads. Reconstructing that count over 1,000 PAXG
     bars per horizon put 97% of setups in grade A and produced a non-monotone
     hit rate across tally buckets (34.6% at 8, 57.6% at 10, 20.0% at 11,
     26.6% at 12). A letter that says A for almost everything grades nothing.

     So this grades on the two NORMALISED terms the balance score already
     computes — net agreeing families over families that voted, and net
     agreeing indicator reads over reads that answered. Both sit in [-1,1] and
     neither saturates, so the letters actually separate.

     WHAT THE LETTER IS NOT. It is not a probability, and it is not permission.
     Confluence has never been shown to predict outcome on gold — eleven gates
     measured BACKWARDS on the scalp horizon, and every one of them passes when
     the tape is active, which is when a move is largely spent. A VETO still
     outranks any letter: an A on a gate-blocked card means "many reads agree",
     not "take it". Whether A beats C is now recorded per firing and answered
     out-of-sample by the forward panel's BY GRADE line. */
  function hgOgConfluenceGrade(c, tape){
    try {
      if (!c) return '';
      var b = (c.balance && isFinite(fin(c.balance.family))) ? c.balance : hgOgBalanceParts(c, tape);
      if (!b) return '';
      var fam = fin(b.family), inf = fin(b.infoRatio);
      if (!isFinite(fam)) fam = 0;
      if (!isFinite(inf)) inf = 0;
      /* An unread ledger is not a grade. Without indicator reads the score
         would be carried entirely by the family term and a lone mechanic
         would print C on no evidence at all. */
      var n = (b.info && isFinite(fin(b.info.n))) ? fin(b.info.n) : 0;
      if (n < 5) return '';
      /* ONE VOTING FAMILY IS NOT A CONSENSUS.

         hgOgConsensusVoters filters the voter pool by the DAILY trend before
         anyone votes: when the daily is up, every short — trend and reversion
         alike — is dropped from the pool. So a day when gold's daily is up but
         the 1h/4h tape reads short leaves exactly one family voting (a lone
         long), and the family term is pinned to -1.000 for every short on the
         board no matter how many fired or how many reads back them.

         Live, that produced the contradiction a reader spotted immediately:
         the tab announced "gold tape reads SHORT", offered only shorts, and
         graded all five of them D — while the single opposing long took an A.
         Five short mechanics had fired against one long.

         A denominator of one carries no information about agreement, so it
         does not get to carry half the grade. Below two voting families the
         letter comes from the indicator reads alone, on the same principle as
         the five-read floor above: silence beats a number that looks like
         evidence and is not. */
      var famDen = 0;
      if (b && isFinite(fin(b.nAgree)) && isFinite(fin(b.nAgainst))){
        famDen = fin(b.nAgree) + fin(b.nAgainst);
      }
      /* THE INDICATOR READ CARRIES THE LETTER; STRATEGIES ADJUST IT.

         Giving the family term half the score was wrong twice over. It is
         pinned to -1 whenever the pool is degenerate — which is 25% of scalp
         setups and 41% of swing ones — and a term that extreme swamped 37
         indicator reads on a denominator of one. Weighting it to zero instead
         threw away the strategy half of the question and pushed five of six
         live setups to A.

         So the letter rides on infoRatio, and agreeing families move it by at
         most 0.15 — about one band — and only when at least two families
         actually voted. Strategies can promote or demote a card; they cannot
         define it from a single vote. */
      var s = inf + ((famDen >= 2) ? (0.15 * fam) : 0);
      /* Cuts are the QUARTILES of infoRatio measured over 3,769 real gold
         setups (1,924 scalp / 1,845 swing): p25 0.43, median 0.60, p75 0.69.
         So A is genuinely top-quartile confluence for this instrument rather
         than an arbitrary line — the mistake that let a raw tally grade 97%
         of setups A. Recalibrate these if the indicator set changes size. */
      if (s >= 0.69) return 'A';
      if (s >= 0.60) return 'B';
      if (s >= 0.43) return 'C';
      return 'D';
    } catch (e) { return ''; }
  }

  function hgOgGradeChipHtml(grade, opts){
    opts = opts || {};
    var g = hgOgNormalizeGrade(grade);
    if (!g) return '';
    var label = opts.label || g;
    return '<span class="og-grade-chip og-grade-' + g.toLowerCase()
      + (opts.large ? ' og-grade-lg' : '')
      + '" title="Setup grade ' + g + '">' + esc(label) + '</span>';
  }

  function hgOgGradeLegendHtml(){
    return '<span class="og-grade-legend">'
      /* The engine's raw-tally wording ("≥8", "≥5") described a count that
         graded 97% of setups A. The desk's own cards grade on measured
         quartiles of indicator agreement instead, so the legend says what the
         letters mean rather than quoting a threshold that no longer applies
         to half the cards on screen. */
      + hgOgGradeChipHtml('A', { large: true }) + ' top quarter '
      + hgOgGradeChipHtml('B', { large: true }) + ' above median '
      + hgOgGradeChipHtml('C', { large: true }) + ' below median '
      + hgOgGradeChipHtml('D', { large: true }) + ' bottom quarter'
      + '</span>';
  }

  function hgOgMpHorizonHtml(label, pick, tape, watchPick, heldMeta, enginePick){
    var h = '<div class="og-mp-hz">';
    var row = (pick && pick.plan) ? pick
      : ((enginePick && enginePick.plan) ? enginePick
      : ((watchPick && watchPick.plan) ? watchPick : null));
    var isEngine = !(pick && pick.plan) && enginePick && enginePick.plan;
    var isWatch = !(pick && pick.plan) && !isEngine && watchPick && watchPick.plan;
    if (row && row.plan){
      var p = row.plan;
      var ev = (row.grade && row.grade.evaluated) || 0;
      var tot = (row.grade && row.grade.total) || 0;
      var grade = isEngine
        ? ('GOLD ENGINE ' + hgOgGradeChipHtml(row.engineGrade || 'A', { large: true })
          + (row.engineDemoted ? ' · demoted' : '')
          + (row.engineLowGrade ? ' · forming · need tally ≥5 for B' : ''))
        : (function(){
            /* the desk's own cards carry a letter too — see hgOgConfluenceGrade
               for why it is the normalised score and not the engine's raw
               tally, which graded 97% of setups A */
            var lg = hgOgConfluenceGrade(row, tape);
            var base = tot ? (ev + '/' + tot + (row.grade.ticket ? ' TICKET' : ' checks'))
                           : (row.grade.ticket ? 'TICKET' : 'WATCH');
            return (lg ? (hgOgGradeChipHtml(lg, { large: true }) + ' ') : '') + base;
          })();
      var info = row.gates ? hgOgInfoNet(row.gates) : { n: 0, pass: 0 };
      var cons = row.consensus || {};
      var nAg = cons.nAgree || 0;
      var fam = isEngine
        ? (row.engineSrc || 'GOLD tab engine')
        : (function(){
            /* SHOW THE DENOMINATOR. "0 families agree" reads as "the desk
               disagrees with this"; the truth is often "only one family was
               allowed to vote, because hgOgConsensusVoters drops every setup
               fighting the DAILY trend before the vote". Those are different
               statements and the reader was drawing the wrong one. */
            var vAg = cons.nAgree || 0, vAg2 = cons.nAgainst || 0;
            var den = vAg + vAg2;
            if (!den) return 'no family voted (all filtered by the daily trend)';
            return vAg + ' of ' + den + ' famil' + (den === 1 ? 'y agrees' : 'ies agree')
                 + (den < 2 ? ' — too few to weigh' : '');
          })();
      var ind = isEngine
        ? (isFinite(fin(row.engineTally)) ? ('tally +' + fin(row.engineTally) + ' · multi-strategy catalog') : 'multi-strategy catalog')
        : (info.n ? (info.pass + '/' + info.n + ' indicators with') : 'indicators unread');
      h += '<div class="hg-mp-head">XAUUSD ' + esc(String(row.dir || '').toUpperCase())
        +  ' <span>' + esc(label) + ' · ' + esc(isEngine ? String(row.kind).slice(0, 48) : row.kind) + ' · ' + grade
        +  (isWatch ? ' · VETO' : '')
        +  (isEngine
             /* AGAINST THE TAPE IS NOT ACTIONABLE, whoever found it.
                hgOgPickGoldEngineFor falls back to an against-tape engine pick
                when no aligned one exists, and this badge called it
                ACTIONABLE — while the same panel was holding OMNIGOLD's own
                against-tape tickets in a queue and saying they are "not shown
                as setups". One rule, two answers, on the same screen.
                The tape rule is the best-evidenced thing on this desk:
                with-tape firings hit 37.4% for +0.121R, against-tape 24.0%
                for -0.280R, z +9.79 on scalp. A counter-trend read is worth
                seeing and is not worth taking, so it keeps its card and loses
                the word that invites the click. */
             ? (row.engineAgainstTape ? ' · AGAINST TAPE — NOT ACTIONABLE'
                                      : (row.engineLowGrade ? ' · FORMING' : ' · ACTIONABLE'))
             : '') + '</span></div>';
      h += '<div class="hg-mp-note">' + esc(fam) + ' · ' + esc(ind)
        +  (isEngine
            ? (row.engineAgainstTape
                ? ' · AGAINST GOLD TAPE · counter-trend engine read · not an OMNIGOLD TICKET · use GOLD SCALP/SWING for book'
                : ' · WITH GOLD TAPE · not an OMNIGOLD TICKET · use GOLD SCALP/SWING for book')
            : (isWatch
            ? ' · WITH GOLD TAPE · gate blocked · not trade-ready'
            : ' · WITH GOLD TAPE · not a win probability.')) + '</div>';

      /* CONFLUENCE SCORE & SPECTRUM RATING — truth-labeled (hg-v532).
         A scalar confResult means the score came from the engine grade
         fallback in hgOgAdvancedConfluenceScore, not from multi-factor
         arithmetic; the badge says so ('GRADE-A CLASS', never
         'EXCEPTIONAL') and every tier carries its measured replay record.
         COST QUARANTINE: heavy/fatal fee tiers print COSTS FIRST above
         the badge; a fatal tier suppresses the medal entirely — the
         score stays, as plain text. */
      var confResult = hgOgAdvancedConfluenceScore(row);
      var confScore = typeof confResult === 'number' ? confResult : (confResult && fin(confResult.score));
      if (isFinite(fin(confScore))){
        var confFromGrade = (typeof confResult === 'number');
        var confB = hgOgTierBadgeInfo(confScore, row, confFromGrade);
        var confColor = confB.color;
        var confDrag = hgOgCostDrag(row);
        if (confDrag && (confDrag.tier === 'heavy' || confDrag.tier === 'fatal')){
          h += hgOgCostsFirstHtml(row, confDrag);
        }
        if (confDrag && confDrag.tier === 'fatal'){
          h += '<div class="dim og-conf-plain" style="margin:12px 0">MULTI-FACTOR CONFLUENCE '
            + confScore.toFixed(0) + '/100 — badge withheld: the fee is '
            + confDrag.costR.toFixed(2) + 'R of this stop'
            + (confB.suffix ? ' · ' + esc(confB.suffix) : '') + '</div>';
        } else {
          h += '<div style="margin:12px 0;padding:8px;border:2px solid ' + confColor + ';border-radius:4px;background:rgba(34,197,94,0.05)">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<div style="font-size:1.4em;font-weight:bold;color:' + confColor + '">' + confScore.toFixed(0) + '/100</div>';
          h += '<div style="background:' + confColor + ';color:white;padding:4px 8px;border-radius:6px;font-size:0.8em;font-weight:bold">' + esc(confB.label)
            + (confB.suffix ? ' <span style="font-weight:normal;opacity:.92">· ' + esc(confB.suffix) + '</span>' : '') + '</div>';
          /* replay fit hook (ADDITIVE): '' while the baked verdict is not-predictive */
          h += hgOgConfluenceFitPwinHtml(confScore);
          h += '</div></div>';
        }
      }

      /* Replay evidence + cost drag (ADDITIVE). Cost chip only when the fee
         load on this plan's stop is heavy/fatal; engine picks carry the
         grade-A/B record and the scalp cost-drag caution, desk picks carry
         their mechanic's own settled replay line. All null-safe. */
      var mpCostChip = hgOgCostChipHtml(row);
      if (mpCostChip) h += '<div style="margin:4px 0">' + mpCostChip + '</div>';
      if (isEngine) h += hgOgReplayLineHtml(row.kind) + hgOgEngineReplayLinesHtml(row, label);
      else h += hgOgReplayLineHtml(row.kind);

      h += '<div class="hg-mp-grid">';
      var mktShow = fin(__og.spotAnchor);
      if (mktShow > 0){
        h += '<div><i>MARKET</i><b>' + fmtPx(mktShow) + '</b><u>live spot now</u></div>';
      }
      h += '<div><i>ENTRY</i><b>' + fmtPx(p.entry) + '</b><u>' + (String(row.dir).toLowerCase() === 'short' ? 'SELL ZONE' : 'BUY ZONE') + '</u></div>';
      h += '<div><i>STOP</i><b>' + fmtPx(p.stop) + '</b><u>invalidation</u></div>';
      h += '<div><i>T1</i><b>' + fmtPx(p.t1) + '</b><u>' + esc(hgOgTargetReadout(Object.assign({ dir: row.dir }, p), label) || 'take profit') + '</u></div>';
      h += '<div><i>T2</i><b>' + (isFinite(fin(p.t2)) ? fmtPx(p.t2) : '—') + '</b><u>runner</u></div>';
      h += '</div>';
      var mktNote = hgOgEntryMarketNote(row, p);
      if (mktNote) h += '<div class="hg-mp-note dim">' + esc(mktNote) + '</div>';
    } else {
      h += '<div class="hg-mp-head">' + esc(label) + ' · STAND ASIDE <span>no tape-aligned ticket</span></div>';
      h += '<div class="hg-mp-note">' + esc(hgOgMpNoneWhy(tape, heldMeta)) + '</div>';
    }
    h += '</div>';
    return h;
  }

  function hgOgWilsonHit(wins, n, z){
    var wf = gfn('hgWilson');
    wins = fin(wins); n = fin(n);
    if (!wf || !(n > 0) || wins < 0 || wins > n) return null;
    try { return wf(wins, n, isFinite(fin(z)) ? fin(z) : OG_EXEC_WILSON_Z); }
    catch (eW){ return null; }
  }

  function hgOgScorecardGoldEvidence(dir){
    var statsFn = gfn('hgScoreStats');
    if (!statsFn) return null;
    var raw = null;
    try {
      if (typeof localStorage !== 'undefined' && localStorage){
        raw = localStorage.getItem('hg_score_v1');
      }
    } catch (eLs){ return null; }
    if (!raw) return null;
    var list;
    try { list = JSON.parse(raw); } catch (eJ){ return null; }
    if (!Array.isArray(list) || !list.length) return null;
    var wins = 0, n = 0, i, rec;
    for (i = 0; i < list.length; i++){
      rec = list[i];
      if (!rec || rec.status !== 'settled') continue;
      if (typeof rec.r !== 'number' || !isFinite(rec.r)) continue;
      var sym = String(rec.sym || '').toUpperCase();
      if (sym.indexOf('XAU') < 0 && sym.indexOf('GOLD') < 0 && sym.indexOf('PAXG') < 0) continue;
      if (dir && rec.dir !== dir) continue;
      n++;
      if (rec.r > 0) wins++;
    }
    if (!(n > 0)) return null;
    var w = hgOgWilsonHit(wins, n);
    return { source: 'scorecard-gold', wins: wins, samples: n, hit: wins / n, wilson: w };
  }

  function hgOgFwdTicketStats(tab, mechanic){
    try {
      var w = W();
      if (!w || typeof w.hgFwdStats !== 'function' || !tab) return null;
      var st = w.hgFwdStats(tab, mechanic || null, true);
      if (!st || !(fin(st.samples) > 0)) return null;
      return st;
    } catch (e){ return null; }
  }

  function hgOgMergeSettledEvidence(tabs, mechanic, dir){
    tabs = tabs || [];
    var wins = 0, losses = 0, sources = [], i, st;
    for (i = 0; i < tabs.length; i++){
      st = hgOgFwdTicketStats(tabs[i], mechanic);
      if (!st) continue;
      wins += fin(st.wins) || 0;
      losses += fin(st.losses) || 0;
      sources.push(tabs[i] + (mechanic ? ':' + mechanic : ' · all TICKETs'));
    }
    var settled = wins + losses;
    if (!(settled > 0)) return null;
    return {
      source: sources.join(' + '),
      sources: sources,
      wins: wins,
      losses: losses,
      samples: settled,
      hit: wins / settled,
      wilson: hgOgWilsonHit(wins, settled),
      pooled: true
    };
  }

  /* ==================== rolling performance tracking ==================== */

  /* Extract timezone from barT (bar timestamp in seconds).
     Returns 'asia', 'london', or 'ny' based on UTC hour. */
  function hgOgTimezoneFromBarT(barT){
    if (!isFinite(barT)) return null;
    var hr = Math.floor((barT % 86400) / 3600);
    if (hr >= 0 && hr < 8) return 'asia';
    if (hr >= 8 && hr < 16) return 'london';
    if (hr >= 16 && hr < 24) return 'ny';
    return null;
  }

  /* Get settled records from forward log in localStorage.
     Reads from 'hg_forward_v1' key and filters for settled records.
     Returns array of settled records with state, barT, rr, mechanic, tab, etc. */
  function hgOgGetSettledRecords(){
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem('hg_forward_v1');
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      var settled = [];
      for (var i = 0; i < list.length; i++){
        var rec = list[i];
        if (rec && (rec.state === 't1' || rec.state === 'stop' || rec.state === 'expired')){
          settled.push(rec);
        }
      }
      return settled;
    } catch (e){ return []; }
  }

  /* Update rolling stats from settled records.
     Tracks last 20/100 settled trades, timezone breakdown, today vs 30-day baseline.
     Stores in __og.rollingStats: { last20: {n, w}, last100: {n,w}, byTimezone: {...},
     todayHitRate, baselineHitRate, lastUpdate } */
  function hgOgUpdateRollingStats(){
    try {
      var now = Date.now() / 1000;
      var todayStart = Math.floor(now / 86400) * 86400;
      var thirtyDaysAgo = todayStart - (30 * 86400);

      var recs = hgOgGetSettledRecords();

      /* Sort by barT descending (newest first) */
      recs.sort(function(a, b){ return (b.barT || 0) - (a.barT || 0); });

      /* Calculate last 20 and last 100 hit rates */
      var last20 = recs.slice(0, 20);
      var last100 = recs.slice(0, 100);
      var last20Wins = 0, last20Total = 0;
      var last100Wins = 0, last100Total = 0;

      last20.forEach(function(r){
        if (r && (r.state === 't1' || r.state === 'stop' || r.state === 'expired')){
          last20Total++;
          if (r.state === 't1') last20Wins++;
        }
      });
      last100.forEach(function(r){
        if (r && (r.state === 't1' || r.state === 'stop' || r.state === 'expired')){
          last100Total++;
          if (r.state === 't1') last100Wins++;
        }
      });

      /* Calculate timezone breakdown for last 100 */
      var byTimezone = { asia: {n: 0, w: 0}, london: {n: 0, w: 0}, ny: {n: 0, w: 0} };
      last100.forEach(function(r){
        if (!r || !isFinite(r.barT)) return;
        var tz = hgOgTimezoneFromBarT(r.barT);
        if (!tz || !byTimezone[tz]) return;
        if (r.state === 't1' || r.state === 'stop' || r.state === 'expired'){
          byTimezone[tz].n++;
          if (r.state === 't1') byTimezone[tz].w++;
        }
      });

      /* Calculate today's hit rate (from todayStart to now) */
      var todayRecs = recs.filter(function(r){ return r && r.barT >= todayStart; });
      var todayWins = 0, todayTotal = 0;
      todayRecs.forEach(function(r){
        if (r && (r.state === 't1' || r.state === 'stop' || r.state === 'expired')){
          todayTotal++;
          if (r.state === 't1') todayWins++;
        }
      });

      /* Calculate 30-day baseline (average per day, computed from full history) */
      var thirtyDayRecs = recs.filter(function(r){ return r && r.barT >= thirtyDaysAgo && r.barT < now; });
      var thirtyDayWins = 0, thirtyDayTotal = 0;
      thirtyDayRecs.forEach(function(r){
        if (r && (r.state === 't1' || r.state === 'stop' || r.state === 'expired')){
          thirtyDayTotal++;
          if (r.state === 't1') thirtyDayWins++;
        }
      });
      var baselineHitRate = thirtyDayTotal > 0 ? (thirtyDayWins / thirtyDayTotal) : NaN;
      var todayHitRate = todayTotal > 0 ? (todayWins / todayTotal) : NaN;

      __og.rollingStats = {
        last20: { n: last20Total, w: last20Wins },
        last100: { n: last100Total, w: last100Wins },
        byTimezone: byTimezone,
        todayHitRate: todayHitRate,
        baselineHitRate: baselineHitRate,
        lastUpdate: now
      };
    } catch (e){
      __og.rollingStats = null;
    }
  }

  /* Detect open setups and their age. Scans forward log for 'open' state
     and calculates time since entry fire. Returns array of open setup objects. */
  /* Market Condition Scoring Engine — 3 dimensions */

  /* Technical Score: Gate quality + regime fit + structure */
  function hgOgTechnicalScore(setup){
    if (!setup) return 0;
    var score = 0;

    /* Gate confluence weight: 3-gate = 100%, 2-gate = 70%, 1-gate = 40% */
    var gateConf = fin(setup.gateConf) || 0;
    var gateScore = (gateConf / 3) * 100;
    score += gateScore * 0.4;

    /* Regime fit quality: If setup passed regime-fit gate, it's aligned */
    var hasBtfConfirm = setup.checks && setup.checks.htfRegime ? 1 : 0;
    score += hasBtfConfirm * 30;

    /* Structure quality: Based on risk/reward ratio */
    if (setup.stop && setup.entry && setup.t1){
      var risk = Math.abs(setup.stop - setup.entry);
      var reward = Math.abs(setup.t1 - setup.entry);
      if (risk > 0){
        var rr = reward / risk;
        var rrScore = Math.min(100, (rr / 2.5) * 100);  /* 2.5R = 100% */
        score += rrScore * 0.3;
      }
    }

    return Math.min(100, score);
  }

  /* Sentiment Score: Correlation regime + risk-on/off bias */
  function hgOgSentimentScore(corrRegime){
    if (!corrRegime) corrRegime = 'NORMAL';

    /* NORMAL correlation = gold uncorrelated from risk, highest score */
    if (corrRegime === 'NORMAL') return 80;

    /* DECOUPLING = uncertain regime, medium score */
    if (corrRegime === 'DECOUPLING') return 50;

    /* EXTREME = gold correlates with equities (risk-on) or USD (risk-off), risky */
    if (corrRegime === 'EXTREME') return 20;

    return 50;  /* Default: medium */
  }

  /* Fundamental Score: News risk + macro event proximity */
  function hgOgFundamentalScore(age, corrRegime){
    var score = 50;  /* Base: neutral */

    /* Setups older than 4 hours may have missed news cycles */
    if (age && age > 4 * 3600){
      score -= 15;
    }

    /* EXTREME correlation = elevated news risk, reduce score */
    if (corrRegime === 'EXTREME'){
      score -= 20;
    }

    /* Recent setups (< 30 min) = fresh market read */
    if (age && age < 30 * 60){
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /* Composite Market Quality Score */
  function hgOgCompositeScore(setup, corrRegime){
    if (!setup) return 0;

    var technical = hgOgTechnicalScore(setup);
    var sentiment = hgOgSentimentScore(corrRegime);
    var fundamental = hgOgFundamentalScore(setup.age, corrRegime);

    /* Weighted composite: 40% technical, 35% sentiment, 25% fundamental */
    var composite = (technical * 0.4) + (sentiment * 0.35) + (fundamental * 0.25);

    return Math.min(100, composite);
  }

  /* ==================== TOP SETUP — from the gate ledger (hg-v541) ====================

     REPLACES the old open-setups watch suite, which was fed from RAW
     hg_forward_v1 records — any tab, any age, TICKET or not (the recorder
     deliberately logs every firing that carries a plan) — scored by a
     self-invented confluence formula over checklist fields the forward log
     never stores, "regenerated" to invented levels when price drifted, and
     judged against a spot anchor frozen at scan time. None of that survives
     here: the card sources EXCLUSIVELY from this tab's audited pipeline —
     the same hgOgPickFor() TICKET winner that MOST PROBABLE renders — and
     when that pipeline offers nothing, the card says so instead of showing
     anything. */

  /* The single best gate-passed pick across both horizons: TICKET only,
     FORMED only, tape-aligned by construction (hgOgPickFor already refuses
     against-tape). Ranked by the same balance score the desk order uses;
     nearest-to-market breaks the tie. Pure; exported for the harness. */
  function hgOgTopSetupPick(mpArgs){
    if (!mpArgs) return null;
    var pool = [], i, c;
    var cand = [mpArgs.pickScalp, mpArgs.pickSwing];
    for (i = 0; i < cand.length; i++){
      c = cand[i];
      if (!c || !c.plan) continue;
      if (!(c.grade && c.grade.ticket)) continue;          /* gate-passed only */
      if (c.formation && c.formation.formed === false) continue;
      pool.push(c);
    }
    if (!pool.length) return null;
    var tape = String(mpArgs.tape || '').toLowerCase();
    pool.sort(function(a, b){
      var sa = hgOgBalanceScore(a, tape), sb = hgOgBalanceScore(b, tape);
      if (sb !== sa) return sb - sa;
      var da = isFinite(fin(a.distAtr)) ? a.distAtr : 99;
      var db = isFinite(fin(b.distAtr)) ? b.distAtr : 99;
      return da - db;
    });
    return pool[0];
  }

  /* The card ledger's own level-fresh judgement, re-read before render.
     The stamped 'level-fresh' gate from hgOgEvaluate is the verdict of
     record: hard fail = DEAD ON ARRIVAL (belt-and-braces — a hard fail
     vetoes the ticket in hgOmniGrade, so it can never reach this card),
     info fail = stale resting levels (the gate's own why carries the
     points and ×ATR IT measured — entry gap against the horizon's own
     ATR), PASS = fresh. THE STAMP IS NEVER RE-DERIVED OR OVERRIDDEN:
     the card's anchor (topSetupView.mkt) is frozen at scan time, so
     nothing available at render is fresher than what the gate judged —
     and the pick's distAtr is a DIFFERENT measure (|anchor − level| over
     the scalp rows' ATR, from hgOgRefreshDistAtr) that must not be
     passed off as the ledger's. The one re-check on a stamped pick is
     the crossed-stop test against the frozen anchor — the gate's exact
     test, and tighten-only (it can turn PASS into DOA when the anchor
     landed beyond the stop, never un-stale a stamp). Only when the gate
     is UNCHECKED (no live price ever reached the evaluator) does the
     card judge the anchor pass's distAtr against the same 1.5×
     tolerance, saying exactly which measure it used. Fail-closed
     everywhere else: no stamp and no derivable distance = not fresh.
     Pure; exported for the harness. */
  function hgOgTopSetupFresh(pick, mktPx){
    if (!pick || !pick.plan) return { ok: false, why: 'no plan to judge' };
    var g = null, i;
    for (i = 0; i < (pick.gates || []).length; i++){
      if (pick.gates[i] && pick.gates[i].key === 'level-fresh'){ g = pick.gates[i]; break; }
    }
    if (g && g.pass === false && g.info !== true){
      return { ok: false, doa: true, why: String(g.why || 'levels dead on arrival') };
    }
    var px = fin(mktPx);
    var e = fin(pick.plan.entry), s = fin(pick.plan.stop);
    /* Crossed-stop re-check against the scan's frozen anchor — the gate's
       exact test, tighten-only. Catches an anchor that settled beyond the
       stop after the evaluator's own price read (XM/Delta feed alignment). */
    if (px > 0 && isFinite(e) && isFinite(s)){
      var crossed = (String(pick.dir || '').toLowerCase() === 'short') ? (px >= s) : (px <= s);
      if (crossed){
        return { ok: false, doa: true,
                 why: 'the market (' + px.toFixed(2) + ') is already '
                    + Math.abs(px - s).toFixed(0) + ' points beyond the stop (' + s.toFixed(2)
                    + ') — these levels were priced off a bar the market has left behind' };
      }
    }
    /* The stamped gate is the ledger's own verdict at the scan's price, and
       the anchor here is frozen at that same scan — nothing at render time
       is better informed, so the stamp carries. */
    if (g && g.pass === false){
      return { ok: false, stale: true, why: String(g.why || 'levels stale at scan time') };
    }
    if (g && g.pass === true){
      return { ok: true, why: String(g.why || 'level-fresh passed at scan time') };
    }
    /* UNCHECKED — no live price ever reached the evaluator, so there is no
       ledger verdict to carry. If the scan's anchor pass left a distance
       behind (hgOgRefreshDistAtr), judge THAT against the same 1.5×
       tolerance, named as what it is; otherwise fail closed. */
    var dAtr = fin(pick.distAtr);
    if (px > 0 && isFinite(dAtr) && isFinite(e)){
      if (dAtr > 1.5){
        return { ok: false, stale: true,
                 why: 'the ledger never judged these levels (no live price reached the evaluator); '
                    + 'the scan anchor (' + px.toFixed(2) + ') sits ' + Math.abs(px - e).toFixed(0)
                    + ' points from entry ' + e.toFixed(2) + ' and the setup level is ' + dAtr.toFixed(1)
                    + '×ATR away — beyond the 1.5×ATR level-fresh tolerance' };
      }
      return { ok: true,
               why: 'level-fresh was UNCHECKED at scan (no live price reached the evaluator); '
                  + 'the scan anchor (' + px.toFixed(2) + ') sits ' + Math.abs(px - e).toFixed(0)
                  + ' points from entry, setup level ' + dAtr.toFixed(1) + '×ATR away — within the 1.5×ATR tolerance' };
    }
    return { ok: false, why: 'no live price to judge freshness — standing aside rather than trusting old levels' };
  }

  function hgOgTopSetupAgeText(atMs){
    var at = fin(atMs);
    if (!(at > 0)) return '';
    var mins = Math.max(0, Math.round((Date.now() - at) / 60000));
    if (mins < 1) return 'scanned just now';
    if (mins < 60) return 'scanned ' + mins + 'm ago';
    return 'scanned ' + Math.floor(mins / 60) + 'h' + (mins % 60) + 'm ago';
  }

  /* TOP SETUP panel. Renders EXACTLY what the pipeline offers:
       - the gate-passed, level-fresh MOST PROBABLE winner, with LONG/SHORT
         printed at the entry and the same confluence badge / cost chip /
         replay lines the MOST PROBABLE card carries (hgOgMpHorizonHtml IS
         that renderer), or
       - an honest stand-aside naming why: nothing cleared, levels stale
         (distance stated), or no scan yet.
     Pure over its inputs; exported for the harness. */
  function hgOgTopSetupPanelHtml(mpArgs, mktPx, scanAtMs){
    var h = '<section class="hg-mp og-open-watch-panel" data-og-watch="1" aria-label="Top setup">';
    h += '<div class="hg-mp-eye">🏆 TOP SETUP · GATE LEDGER WINNER</div>';
    var age = hgOgTopSetupAgeText(scanAtMs);
    h += '<div class="hg-mp-head">XAUUSD <span>the MOST PROBABLE ticket, level-fresh checked'
      +  (age ? ' · ' + esc(age) : '') + '</span>'
      +  ' <button type="button" class="btn" data-og-ts-refresh="1"'
      +  ' style="padding:2px 10px;font-size:0.8em;margin-left:8px"'
      +  ' onclick="window.hgOgManualRefresh && window.hgOgManualRefresh()">🔄 Refresh</button></div>';
    if (!mpArgs){
      h += '<div class="hg-mp-note warn">No scan yet — run a gold scan. This card only shows a setup that cleared the full gate ledger; it never reads raw logs.</div>';
      return h + '</section>';
    }
    var tape = String(mpArgs.tape || '').toLowerCase();
    var pick = hgOgTopSetupPick(mpArgs);
    if (!pick){
      h += '<div class="hg-mp-note warn">No gate-passed setup at current price — standing aside. '
        +  esc(hgOgMpNoneWhy(tape, mpArgs.held)) + '</div>';
      return h + '</section>';
    }
    var freshRead = hgOgTopSetupFresh(pick, mktPx);
    if (!freshRead.ok){
      h += '<div class="hg-mp-note warn">'
        +  (freshRead.doa ? 'Ticket levels are DEAD ON ARRIVAL' : 'No gate-passed setup at current price')
        +  ' — standing aside. ' + esc(freshRead.why) + '. Run a scan for fresh levels.</div>';
      return h + '</section>';
    }
    var dir = String(pick.dir || '').toLowerCase();
    h += '<div style="margin:10px 0 2px 0;font-weight:bold">'
      +  '<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-weight:bold;color:#fff;background:'
      +  (dir === 'short' ? '#dc2626' : '#16a34a') + '">' + (dir === 'short' ? 'SHORT' : 'LONG') + '</span>'
      +  ' XAUUSD · ENTRY ' + esc(fmtPx(pick.plan.entry))
      +  ' · ' + esc(String(pick.horizon || '')) + ' · ' + esc(String(pick.kind || '')) + '</div>';
    h += '<div class="hg-mp-note dim">' + esc(freshRead.why) + '</div>';
    h += hgOgMpHorizonHtml(pick.horizon || 'SCALP', pick, tape, null, mpArgs.held, null);
    return h + '</section>';
  }

  /* Replace-in-place injector: ONE [data-*] section per host, never stacked.
     The old panels were prepended blind on every rescan and piled up. */
  function hgOgInjectSection(host, attr, html){
    if (!host) return;
    try {
      var old = host.querySelector ? host.querySelector('[' + attr + ']') : null;
      if (old){
        if (html) old.outerHTML = html;
        else if (old.parentNode) old.parentNode.removeChild(old);
      } else if (html && host.insertAdjacentHTML){
        host.insertAdjacentHTML('afterbegin', html);
      }
    } catch (eInj) {}
  }

  function hgOgPaintTopSetup(ui){
    var host = (ui && ui.mp) || (ui && ui.cards);
    if (!host) return;
    var v = __og.topSetupView || null;
    var html;
    try { html = hgOgTopSetupPanelHtml(v, v ? v.mkt : NaN, v ? v.at : NaN); }
    catch (eTs){ html = ''; }
    hgOgInjectSection(host, 'data-og-watch', html);
  }

  /* Manual refresh — re-pulls from the PIPELINE snapshot (never a price
     fetch, never raw logs): repaints the TOP SETUP card from the last
     completed scan's picks, or paints the honest run-a-scan message. */
  function hgOgManualRefresh(){
    try {
      var ui = __og.ui;
      if (!ui) return false;
      hgOgPaintTopSetup(ui);
      return true;
    } catch (e){
      if (typeof console !== 'undefined') console.error('Refresh failed:', e);
      return false;
    }
  }

  /* Expose to global scope for onclick handlers */
  if (typeof window !== 'undefined'){
    window.hgOgManualRefresh = hgOgManualRefresh;
  }


  /* MULTI-FACTOR CONFLUENCE SCORING — Advanced setup quality assessment */
  function hgOgAdvancedConfluenceScore(setup){
    if (!setup) return { score: 0, factors: [] };
    var factors = [];
    var totalScore = 0;

    /* FALLBACK FOR ENGINE SETUPS: Grade-based scoring when confluence data missing */
    var isEngineSetup = setup.engineGrade && !setup.gateConf;
    var baseFromGrade = 0;
    if (isEngineSetup){
      if (setup.engineGrade === 'A') baseFromGrade = 85;
      else if (setup.engineGrade === 'B') baseFromGrade = 70;
      else if (setup.engineGrade === 'C') baseFromGrade = 50;
      else if (setup.engineGrade === 'D') baseFromGrade = 30;
      if (setup.engineDemoted) baseFromGrade -= 10;  /* Penalize demoted */
      if (setup.engineTally && setup.engineTally < 5) baseFromGrade -= 5;  /* Low tally penalty */
      return baseFromGrade;  /* Return scalar for engine setups */
    }

    /* 1. TREND CONFLUENCE (25 pts max) — Multi-MA alignment */
    var trendScore = 0;
    if (setup.gateConf >= 3) trendScore = 25;  /* 3-gate PRIME */
    else if (setup.gateConf >= 2) trendScore = 15;  /* 2-gate HIGH */
    else if (setup.gateConf >= 1) trendScore = 8;  /* 1-gate LOW */
    factors.push({ name: 'Trend Confluence', value: trendScore, max: 25 });
    totalScore += trendScore;

    /* 2. ENTRY GEOMETRY (20 pts max) — Risk-Reward + Entry precision */
    var rr = setup.entry && setup.stop ? Math.abs(setup.t1 - setup.entry) / Math.abs(setup.stop - setup.entry) : 0;
    var geometryScore = 0;
    if (rr >= 2.0) geometryScore = 20;  /* Excellent R:R */
    else if (rr >= 1.5) geometryScore = 15;  /* Good R:R */
    else if (rr >= 1.0) geometryScore = 8;  /* Acceptable */
    factors.push({ name: 'Entry Geometry', value: geometryScore, max: 20 });
    totalScore += geometryScore;

    /* 3. MARKET CONDITIONS (20 pts max) — Technical + Sentiment + Fundamental */
    var marketScore = Math.min(20, (fin(setup.compositeScore) || 0) / 5);
    factors.push({ name: 'Market Conditions', value: marketScore, max: 20 });
    totalScore += marketScore;

    /* 4. PRE-ENTRY CONFIRMATION (15 pts max) — Checklist passing */
    var checkScore = 0;
    if (setup.checksPass >= 5) checkScore = 15;  /* All checks pass */
    else if (setup.checksPass >= 4) checkScore = 12;  /* 4/5 pass */
    else if (setup.checksPass >= 3) checkScore = 6;  /* 3/5 pass */
    factors.push({ name: 'Pre-Entry Checks', value: checkScore, max: 15 });
    totalScore += checkScore;

    /* 5. WIN RATE CONFIDENCE (15 pts max) — Wilson Lower Bound */
    var wilsonScore = 0;
    if (setup.wilsonLo && isFinite(setup.wilsonLo)){
      wilsonScore = Math.min(15, setup.wilsonLo * 0.3);  /* Scale 0-50% to 0-15 pts */
    }
    factors.push({ name: 'Win Rate Confidence', value: wilsonScore, max: 15 });
    totalScore += wilsonScore;

    /* 6. SETUP AGE & FRESHNESS (5 pts max) — Recent > Stale */
    var ageScore = 0;
    if (setup.age < 3600) ageScore = 5;  /* Fresh (< 1h) */
    else if (setup.age < 86400) ageScore = 2;  /* Recent (< 24h) */
    factors.push({ name: 'Setup Freshness', value: ageScore, max: 5 });
    totalScore += ageScore;

    return {
      score: Math.round(totalScore),
      maxScore: 100,
      factors: factors,
      interpretation: totalScore >= 85 ? 'EXCEPTIONAL' : totalScore >= 70 ? 'STRONG' : totalScore >= 50 ? 'FAIR' : 'WEAK'
    };
  }

  /* Factor bars, shared by the medal box and the quarantined plain render —
     a factor checklist stays useful even where the medal would be a lie. */
  function hgOgConfluenceFactorsHtml(setup){
    if (!setup || !setup.confluenceFactors || !setup.confluenceFactors.length) return '';
    var html = '<div style="font-size:0.9em;color:var(--fg-muted,#666)">';
    setup.confluenceFactors.forEach(function(f){
      var barColor = f.value >= (f.max * 0.8) ? '#22c55e' : f.value >= (f.max * 0.6) ? '#f59e0b' : '#dc2626';
      html += '<div style="margin-bottom:6px">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:2px">';
      html += '<span>' + f.name + '</span>';
      html += '<span style="font-weight:bold;color:' + barColor + '">' + Math.round(f.value) + '/' + f.max + '</span>';
      html += '</div>';
      html += '<div style="height:8px;background:rgba(0,0,0,0.1);border-radius:2px;overflow:hidden">';
      html += '<div style="height:100%;width:' + (f.value/f.max*100) + '%;background:' + barColor + '"></div>';
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  /* Multi-Factor Confluence Display — truth-labeled (hg-v532).
     - A score that came from the engine grade scalar (setup.confluenceFromGrade,
       or the same predicate the scorer uses: engineGrade && !gateConf) is
       labeled GRADE-A CLASS at >=85 instead of EXCEPTIONAL, because 85 is
       reachable ONLY through that fallback (grade-A = 85): the multi-factor
       scan arithmetic tops out near 82 (market-conditions factor caps at
       84.25/5 = 16.85, Wilson factor at 0.3) and the replay's own byTierNote
       says the same. Every tier badge carries its measured replay record.
     - COST QUARANTINE: heavy/fatal cost tiers render COSTS FIRST above the
       badge; fatal additionally suppresses the medal — score as plain text,
       factors kept, setup still rendered. */
  function hgOgRenderConfluenceBreakdown(setup){
    if (!setup || setup.confluenceScore === null || setup.confluenceScore === undefined) return '';
    var score = isFinite(fin(setup.confluenceScore)) ? fin(setup.confluenceScore) : 0;
    var fromGrade = setup.confluenceFromGrade === true || !!(setup.engineGrade && !setup.gateConf);
    var b = hgOgTierBadgeInfo(score, setup, fromGrade);
    var color = b.color;
    var drag = hgOgCostDrag(setup);
    var html = '';
    if (drag && (drag.tier === 'heavy' || drag.tier === 'fatal')){
      html += hgOgCostsFirstHtml(setup, drag);
    }
    if (drag && drag.tier === 'fatal'){
      html += '<div class="og-conf-plain" style="margin:12px 0;padding:8px;border:1px solid var(--hr);border-radius:4px">';
      html += '<div style="font-weight:bold;margin-bottom:4px">MULTI-FACTOR CONFLUENCE ' + score + '/100</div>';
      html += '<div class="dim" style="font-size:11px">badge withheld — the fee is ' + drag.costR.toFixed(2)
        + 'R of this stop (fatal tier): a medal on a structurally unpayable trade is a lie'
        + (b.suffix ? ' · ' + esc(b.suffix) : '') + '</div>';
      html += hgOgConfluenceFactorsHtml(setup);
      html += '</div>';
      return html;
    }

    html += '<div style="margin:12px 0;padding:8px;border:2px solid ' + color + ';border-radius:4px;background:rgba(34,197,94,0.05)">';
    html += '<div style="font-weight:bold;margin-bottom:8px;color:' + color + '">⭐ MULTI-FACTOR CONFLUENCE</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<div style="font-size:2em;font-weight:bold;color:' + color + '">' + score + '/100</div>';
    html += '<div style="background:' + color + ';color:white;padding:4px 8px;border-radius:6px;font-size:0.85em;font-weight:bold">' + esc(b.label)
      + (b.suffix ? ' <span style="font-weight:normal;opacity:.92">· ' + esc(b.suffix) + '</span>' : '') + '</div>';
    /* replay fit hook (ADDITIVE): '' while the baked verdict is not-predictive */
    html += hgOgConfluenceFitPwinHtml(score);
    html += '</div>';
    html += hgOgConfluenceFactorsHtml(setup);
    html += '</div>';
    return html;
  }

  /* ==================== replay evidence + cost drag (ADDITIVE) ====================

     PROVENANCE. Baked from scripts/omnigold-replay-evidence.json — a replay
     of this desk's own logged setups against PAXGUSDT 1h-proxy bars,
     window 2026-03-15..2026-08-29, n=7270 settled. Per-trade cost was
     recovered as rMultiple - netR and verified against the 0.26% round-trip
     fee model. Only kinds with n >= 40 settled are baked; smaller samples
     say nothing worth printing on a card.

     THE HEADLINE FINDINGS, so the numbers below have a reading:
       - fit verdict NOT-PREDICTIVE. Test AUC 0.4924 on a chronological
         60/40 split; top-decile lift 0.929 vs bottom-decile 0.864 — the
         aggregate confluence score does not rank outcomes out of sample.
         (The records carry no per-factor breakdown, so this is the honest
         "does the total score rank outcomes" test, not a re-weighting.)
       - EVERY kind — including the best, OPENING RANGE BREAKOUT at +0.220R
         gross — is NET-NEGATIVE after the 0.26% RT cost. Fees eat the
         edge, hardest on tight-stop scalps.
       - engine grade ordering A > B > C holds on win rate
         (54.3 / 36.1 / 34.8%), so the selection edge is real; the cost
         drag is not survivable on the scalp horizon (ENGINE:SCALP
         -2.603R/trade net) while swing geometry roughly broke even
         (ENGINE:SWING -0.056R net, PF ~0.90). */

  /* Round trip cost as percent of price. PAXG-calibrated: taker both sides
     plus spread, 0.26% RT, verified against recovered per-trade costs in
     the replay. TUNABLE: assign window.HG_OG_RT_COST_PCT before a render
     to model a different venue; hgOgRtCostPct() reads the override. */
  var HG_OG_RT_COST_PCT = 0.26;

  function hgOgRtCostPct(){
    var w = W();
    var ovr = w ? fin(w.HG_OG_RT_COST_PCT) : NaN;
    return (isFinite(ovr) && ovr > 0) ? ovr : HG_OG_RT_COST_PCT;
  }

  /* ==================== venue-true cost model (hg-v533) ====================

     WHY. The 0.26% round trip above is PAXG-calibrated — it is the cost model
     the replay was measured under, and it stayed the only cost model even
     though this desk EXECUTES gold on XM XAUUSD (xm-trader.js, the same
     broker bridge every SEND TICKET TO XM button feeds), where the round
     trip is spread-driven and roughly 13x cheaper. Pricing an XM execution
     at PAXG fees mislabels the fee-R of every stop; pricing PAXG at XM fees
     would be worse. So the venue is named, and each preset carries its own
     documented basis.

     XM PRESET ARITHMETIC (documented, overridable):
       spread   ~$0.35 on XAUUSD (typical XM standard-account spread), taken
                against a conservative LOW spot reference of $3,500/oz — a
                lower reference makes the spread a LARGER percent, so the
                assumption errs against the trade: 0.35 / 3500 = 0.010%.
       slippage 0.010% round trip (both sides pooled) — same class of
                assumption as the replay's 0.03%/side on thin PAXG, scaled
                for a deep spot-gold book.
       total    ~0.020% round trip.
     Override window.HG_OG_XM_SPREAD_USD to re-derive from a different
     spread; the slippage and reference-spot constants are deliberate
     constants, not knobs.

     VENUE SELECTION (hg-v537: visible control). Precedence, highest first:
       1. window.HG_OG_VENUE ('XM' | 'PAXG') — the console/test override.
          If SET it always wins, even over the UI control; anything
          unrecognised there fails closed to PAXG with the basis saying so.
       2. The tab's EXECUTION VENUE control — __ogVenueSel, persisted in
          localStorage under 'hg_og_venue', read back at mount by
          hgOgVenueInit(). UI DEFAULT: 'XM' — because XM XAUUSD is the venue
          this desk ACTUALLY EXECUTES on: every SEND TICKET TO XM button and
          the auto-send path POST to the xm-trader.js MT5 bridge
          (XM_GOLD_SYMBOL / XM_MT5_URL; render.yaml carries the
          XM_OMNIGOLD_LIVE / XM_OMNIGOLD_LOTS envs that arm it). PAXG fees
          (0.26% RT, 13x XM) are fees this desk never pays, and pricing every
          stop at them at formation killed nearly all gold scalps (stop floor
          2.08% vs 0.16%) for a cost model belonging to a different venue.
          PAXG stays one click away on the control.
       3. Nothing selected (fresh page whose localStorage is unavailable, or
          a harness that never mounts) -> PAXG, the CONSERVATIVE fallback:
          assuming the expensive venue can only overstate fees, never
          understate them. This is unchanged from hg-v533, so every pure-
          function harness still sees PAXG unless it declares a venue.
     window.HG_OG_RT_COST_PCT keeps its old meaning as the PAXG-preset
     override (hgOgRtCostPct reads it), so nothing that tuned it breaks.

     HONESTY RULE, enforced at every render site via
     hgOgVenueCostNoteHtml(): the replay outcomes were measured AT PAXG
     COSTS. A cheaper venue changes the COST arithmetic (fee-R of a stop,
     venue-adjusted net), never the measured outcomes (n, WR, grossR). */
  var HG_OG_VENUE_UI_DEFAULT = 'XM';
  var HG_OG_VENUE_LS_KEY = 'hg_og_venue';
  /* The UI-selected venue. '' until hgOgVenueInit()/hgOgSetVenue() runs, so
     un-mounted contexts keep the PAXG fail-closed behavior they always had. */
  var __ogVenueSel = '';
  var HG_OG_XM_SPREAD_USD = 0.35;     /* assumed XAUUSD spread, $/oz */
  var HG_OG_XM_SPOT_REF_USD = 3500;   /* conservative LOW spot reference */
  var HG_OG_XM_SLIP_PCT = 0.010;      /* round-trip slippage assumption, % */

  /* The cost object for ONE NAMED venue, ignoring the active selection —
     so the banner can price "what would PAXG demote" while XM is active.
     -> { venue: 'XM'|'PAXG', rtCostPct, basis }. Anything that is not a
     well-formed XM preset is the PAXG preset. Never throws. */
  function hgOgVenuePresetCost(name){
    var w = W();
    var venue = '';
    try { venue = String(name || '').toUpperCase().replace(/^\s+|\s+$/g, ''); }
    catch (eN) { venue = ''; }
    if (venue === 'XM'){
      var spread = NaN;
      try { spread = w ? fin(w.HG_OG_XM_SPREAD_USD) : NaN; } catch (eS) { spread = NaN; }
      if (!(isFinite(spread) && spread > 0)) spread = HG_OG_XM_SPREAD_USD;
      var spreadPct = spread / HG_OG_XM_SPOT_REF_USD * 100;
      var rt = spreadPct + HG_OG_XM_SLIP_PCT;
      if (isFinite(rt) && rt > 0){
        return {
          venue: 'XM', rtCostPct: rt,
          basis: 'XM XAUUSD assumed $' + spread.toFixed(2) + ' spread on $'
            + HG_OG_XM_SPOT_REF_USD + ' ref spot (' + spreadPct.toFixed(3)
            + '%) + ' + HG_OG_XM_SLIP_PCT.toFixed(3) + '% slippage = '
            + rt.toFixed(3) + '% round trip'
        };
      }
      /* degenerate override -> fall through to the conservative preset */
    }
    return {
      venue: 'PAXG', rtCostPct: hgOgRtCostPct(),
      basis: 'PAXG replay cost model: 0.1% taker/side + 0.03% slippage/side = '
        + hgOgRtCostPct().toFixed(2) + '% round trip'
        + (venue && venue !== 'PAXG' ? ' (venue "' + venue + '" unrecognised — conservative fallback)' : '')
    };
  }

  /* -> { venue: 'XM'|'PAXG', rtCostPct, basis } for the ACTIVE venue, per
     the precedence documented above: window.HG_OG_VENUE override first,
     then the UI selection, then PAXG fail-closed. Never throws. */
  function hgOgVenueCost(){
    var w = W();
    var venue = '';
    try { venue = String((w && w.HG_OG_VENUE) || '').toUpperCase().replace(/^\s+|\s+$/g, ''); }
    catch (eV) { venue = ''; }
    if (!venue){
      try { venue = String(__ogVenueSel || '').toUpperCase().replace(/^\s+|\s+$/g, ''); }
      catch (eU) { venue = ''; }
    }
    return hgOgVenuePresetCost(venue);
  }

  /* Set the UI-selected venue. Only the two known presets are accepted —
     an unknown name changes nothing (fail closed) and returns false.
     Persists to localStorage where available; the selection still applies
     for this page-load when storage is denied. */
  function hgOgSetVenue(name){
    var v = '';
    try { v = String(name || '').toUpperCase().replace(/^\s+|\s+$/g, ''); }
    catch (eN) { return false; }
    if (v !== 'XM' && v !== 'PAXG') return false;
    __ogVenueSel = v;
    try { localStorage.setItem(HG_OG_VENUE_LS_KEY, v); } catch (eS) {}
    return true;
  }

  /* Read the persisted venue selection at mount. A stored valid choice is
     restored; nothing stored -> the XM UI default (the desk's actual
     execution venue — see the precedence note above); localStorage itself
     UNAVAILABLE (throws) -> no selection at all, so hgOgVenueCost stays on
     the PAXG conservative fallback. Returns the selection ('' when none). */
  function hgOgVenueInit(){
    var stored = null, failed = false;
    try { stored = localStorage.getItem(HG_OG_VENUE_LS_KEY); }
    catch (eL) { failed = true; }
    if (failed){
      __ogVenueSel = '';
      return '';
    }
    var v = '';
    try { v = String(stored || '').toUpperCase().replace(/^\s+|\s+$/g, ''); }
    catch (eV) { v = ''; }
    if (v !== 'XM' && v !== 'PAXG') v = HG_OG_VENUE_UI_DEFAULT;
    __ogVenueSel = v;
    return v;
  }

  /* One dim line for anywhere replay numbers sit beside venue-cost numbers.
     '' at PAXG costs (nothing to reconcile); at a cheaper venue it states
     that the measured outcomes are PAXG-cost facts. */
  function hgOgVenueCostNoteHtml(){
    var vc = hgOgVenueCost();
    var rt = fin(vc && vc.rtCostPct);
    if (!isFinite(rt) || Math.abs(rt - HG_OG_REPLAY_EVIDENCE.rtCostPct) < 1e-9) return '';
    return '<div class="dim og-venue-note" style="font-size:11px;margin-top:2px">venue '
      + esc(String(vc.venue)) + ' costs (' + rt.toFixed(3) + '% RT) price the FEES here — the replay record itself was measured AT PAXG COSTS ('
      + HG_OG_REPLAY_EVIDENCE.rtCostPct.toFixed(2)
      + '% RT): cheaper execution changes the cost math, not the measured outcomes</div>';
  }
  /* ================== end venue-true cost model (hg-v533) ================== */

  /* COMPACT baked evidence.
     kinds: [n, winRate, avgNetR, avgGrossR, medianCostR] — the 5th element
       (hg-v533) is that kind's MEDIAN per-trade fee load in R, measured at
       the replay's 0.26% PAXG round trip (perKind.medianCostR in
       scripts/omnigold-replay-evidence.json). It is what lets a cheaper
       venue's fee math be recomputed HONESTLY: fees scale with the venue's
       round-trip cost, the measured gross outcomes do not.
     cohorts: [n, winRate, avgNetR, avgGrossR];
     grades: [n, winRate, avgNetR] (per-grade gross was not recoverable).
     Keys are uppercase so lookup can normalise case. */
  var HG_OG_REPLAY_EVIDENCE = {
    src: 'scripts/omnigold-replay-evidence.json',
    window: '2026-03-15..2026-08-29',
    barBasis: 'PAXGUSDT 1h proxy',
    settled: 7270,
    rtCostPct: 0.26,
    fit: { verdict: 'not-predictive', testAUC: 0.4924,
           topDecileLift: 0.929, bottomDecileLift: 0.864 },
    kinds: {
      'ADR-FADE':        [242, 0.3388, -1.415,  0.017, 1.462],
      'THREE-BAR':       [283, 0.3392, -4.220,  0.018, 2.325],
      'ENGULF-LEVEL':    [115, 0.3652, -3.351,  0.096, 1.868],
      'CCI-EXTREME':     [372, 0.3118, -1.095, -0.046, 0.679],
      'STOCHRSI-TURN':   [495, 0.3394, -0.737,  0.053, 0.532],
      'PIN-REJECT':      [195, 0.3590, -4.018,  0.077, 2.383],
      'SPRING':          [132, 0.2879, -1.555, -0.136, 0.944],
      'ROUND-MAGNET':    [713, 0.3745, -0.783,  0.133, 0.720],
      'VWAP-BAND':       [ 71, 0.2535, -1.217, -0.239, 0.646],
      'SWEEP-V2':        [205, 0.3220, -1.818, -0.034, 0.932],
      'LONDON-FIX':      [133, 0.2481, -0.465, -0.063, 0.241],
      'HA-FLIP':         [109, 0.2936, -0.387,  0.069, 0.268],
      'FVG-HVN':         [151, 0.2450, -0.714, -0.166, 0.322],
      'SQUEEZE-FIRE':    [ 53, 0.3019, -0.310,  0.094, 0.245],
      'CUSUM-SHIFT':     [ 53, 0.3019, -0.185,  0.082, 0.238],
      'NY-OPEN-DRIVE':   [ 62, 0.1774, -0.433, -0.106, 0.214],
      'STRUCT-BOS':      [104, 0.3077, -0.164,  0.165, 0.211],
      'BOS-RETEST':      [ 87, 0.3218, -0.299,  0.112, 0.224],
      'NR7-BREAK':       [143, 0.2587, -0.529, -0.102, 0.260],
      'MMOVE':           [212, 0.3019, -0.250,  0.072, 0.226],
      'MFI-SQUAT':       [117, 0.2650, -0.732, -0.092, 0.354],
      'PIVOT-REJECT':    [177, 0.2994, -1.139, -0.094, 0.803],
      'INSIDE-BREAK':    [126, 0.3016, -0.394,  0.044, 0.284],
      'ASIA-BREAK':      [ 91, 0.2198, -0.463, -0.068, 0.231],
      'KZ-JUDAS':        [158, 0.2975, -2.206, -0.108, 1.242],
      'ORB':             [142, 0.2817, -0.332,  0.024, 0.235],
      'TREND-RECLAIM':   [107, 0.3364, -0.397,  0.082, 0.341],
      'DI-CROSS':        [107, 0.2710, -0.358, -0.001, 0.240],
      'PO3':             [158, 0.3038, -0.823, -0.048, 0.461],
      'FIB-618':         [126, 0.2778, -0.635, -0.115, 0.373],
      'PD-EQUILIBRIUM':  [307, 0.2964, -5.185, -0.111, 2.307],
      'FVG-FILL':        [155, 0.2774, -0.346,  0.039, 0.261],
      'ER-IGNITION':     [ 80, 0.2500, -1.392, -0.250, 0.622],
      'RSI-DIVERGE':     [ 51, 0.3529, -2.720,  0.071, 1.947],
      'PDL-SWEEP':       [ 76, 0.1974, -1.588, -0.408, 0.780],
      'RIBBON-PULLBACK': [102, 0.2451, -0.447, -0.093, 0.244],
      'VWAP-REVERT':     [ 61, 0.2951, -0.662, -0.077, 0.306],
      'AVWAP-RECLAIM':   [117, 0.3419, -0.370,  0.080, 0.305],
      'ICHI-KUMO':       [107, 0.2617, -0.401, -0.053, 0.232],
      'EQH-SWEEP':       [ 47, 0.3404, -1.390,  0.021, 0.848],
      'WEEKLY-OPEN':     [150, 0.3533, -0.645,  0.076, 0.619],
      'EMA50-HOLD':      [118, 0.2712, -1.131, -0.108, 0.412],
      'UTAD':            [107, 0.3364, -1.493,  0.009, 1.022],
      'PDH-SWEEP':       [ 81, 0.3210, -1.174, -0.024, 0.745],
      'EQL-SWEEP':       [ 53, 0.3774, -1.033,  0.132, 0.887],
      'OPENING RANGE BREAKOUT':   [69, 0.4928, -1.798,  0.220, 0.880],
      'HVN / VOLUME NODE RETEST': [65, 0.3846, -3.071, -0.038, 1.304]
    },
    grades: {
      'A':         [70, 0.5429, -1.714],
      'B':         [36, 0.3611, -2.291],
      'C':         [23, 0.3478, -0.511],
      'A-DEMOTED': [40, 0.4250, -2.677],
      'B-DEMOTED': [88, 0.4091, -3.133],
      'C-DEMOTED': [20, 0.5500, -2.764]
    },
    /* SCAN multi-factor score tiers, [n, winRate, avgNetR], baked from
       scripts/backtest-omnigold-results.json aggregates.byTier (the same
       replay the evidence file distills). The ordering is the point:
       WEAK 34% WR beat STRONG 30% — the tiers did not rank outcomes.
       No EXCEPTIONAL row exists because >=85 is unreachable by the scan
       arithmetic (byTierNote says so; independently: the market-conditions
       factor caps at 84.25/5 = 16.85 and the Wilson factor at 0.3, so the
       scan total tops out near 82). ENGINE grade rows above are a separate
       scalar scale — never pooled with these. */
    tiers: {
      'WEAK':   [ 330, 0.3420, -0.243],
      'FAIR':   [5422, 0.3100, -1.547],
      'STRONG': [1241, 0.3040, -0.536]
    },
    /* Median per-trade fee load in R over settled replay trades, computed
       from trades[] in scripts/backtest-omnigold-results.json as
       rMultiple - netR (settled = win/loss/both-touch/timeout, n=7270).
       NOTE: an earlier draft of the desk-stance wording quoted 0.79R;
       that figure does not reproduce from the shipped trades — these do. */
    medianCostR: { all: 0.626, scalp: 0.738, swing: 0.335 },
    /* Profit factor of the one near-breakeven cohort, from
       aggregates.bySource['ENGINE:SWING'].profitFactor. */
    pf: { 'ENGINE:SWING': 0.90 },
    cohorts: {
      'SCAN:SCALP':   [5466, 0.3035, -1.524, -0.012],
      'SCAN:SWING':   [1527, 0.3353, -0.523,  0.024],
      'ENGINE:SCALP': [ 250, 0.4520, -2.603,  0.123],
      'ENGINE:SWING': [  27, 0.3704, -0.056,  0.195]
    }
  };

  function hgOgReplayRow(map, key){
    return (map && Object.prototype.hasOwnProperty.call(map, key)) ? map[key] : null;
  }

  /* The mechanic's / grade's / cohort's own settled replay record, or null.
     Accepts a mechanic kind ('ROUND-MAGNET'), an engine grade ('A',
     'B-demoted'), or a cohort key ('ENGINE:SCALP'), any case.
     Returns { n, winRate, avgNetR, avgGrossR } — avgGrossR is null for
     engine grades, where gross was not recoverable per grade. */
  function hgOgReplayEvidence(kindOrGrade){
    if (kindOrGrade === null || kindOrGrade === undefined) return null;
    var key = String(kindOrGrade).toUpperCase().replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
    if (!key) return null;
    var E = HG_OG_REPLAY_EVIDENCE;
    var row = hgOgReplayRow(E.kinds, key);
    if (row) return { n: row[0], winRate: row[1], avgNetR: row[2], avgGrossR: row[3],
                      medianCostR: (row.length > 4 ? row[4] : null) };
    row = hgOgReplayRow(E.grades, key);
    if (row) return { n: row[0], winRate: row[1], avgNetR: row[2], avgGrossR: null };
    row = hgOgReplayRow(E.cohorts, key);
    if (row) return { n: row[0], winRate: row[1], avgNetR: row[2], avgGrossR: row[3] };
    /* SCAN score tiers ('WEAK'/'FAIR'/'STRONG') — ADDITIVE keys, no gross. */
    row = hgOgReplayRow(E.tiers, key);
    if (row) return { n: row[0], winRate: row[1], avgNetR: row[2], avgGrossR: null };
    return null;
  }

  /* '7270' -> '7,270' — the banner and legend quote the settled count. */
  function hgOgFmtCount(n){
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* SPECTRUM TRUTH LABELS (hg-v532). One place decides what a confluence
     badge is allowed to claim:
       - fromGrade (the engine-grade scalar path in
         hgOgAdvancedConfluenceScore): >=85 is labeled GRADE-A CLASS, never
         EXCEPTIONAL — 85 is exactly the grade-A scalar and the ONLY way to
         reach 85 (scan arithmetic tops out near 82, see the tiers bake
         above). The suffix is that grade's own settled replay record
         ('replay 54% WR, -1.71R net on scalps' for grade-A).
       - scan path: the tier word keeps its measured record as a suffix
         (STRONG '· replay 30% WR', FAIR '· replay 31% WR',
         WEAK '· replay 34% WR') — printed precisely because the ordering
         is upside down and the reader deserves to see it on the badge,
         not in a footnote.
     Returns { color, label, suffix }; suffix '' when no record exists. */
  function hgOgTierBadgeInfo(score, setup, fromGrade){
    var s = isFinite(fin(score)) ? fin(score) : 0;
    var color = s >= 85 ? '#10b981' : s >= 70 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#dc2626';
    var label = s >= 85 ? '🏆 EXCEPTIONAL' : s >= 70 ? '✓ STRONG' : s >= 50 ? '⚠ FAIR' : '✗ WEAK';
    var suffix = '';
    if (fromGrade){
      if (s >= 85) label = 'GRADE-A CLASS';
      var g = String((setup && (setup.engineGrade
        || ((typeof setup.grade === 'string') ? setup.grade : ''))) || (s >= 85 ? 'A' : '')).toUpperCase();
      var demoted = !!(setup && (setup.engineDemoted || setup.demoted));
      var gkey = g ? (g + (demoted ? '-DEMOTED' : '')) : '';
      var gev = gkey ? hgOgReplayEvidence(gkey) : null;
      if (gev && isFinite(fin(gev.winRate)) && isFinite(fin(gev.avgNetR))){
        /* 'on scalps' is a per-grade measured fact, not a template: the
           grade rows pool horizons, and in the replay only A / A-DEMOTED /
           B-DEMOTED / C-DEMOTED settled 100% on scalp geometry. B settled
           30 scalp + 6 swing and C settled 2 scalp + 21 swing (trades[] in
           scripts/backtest-omnigold-results.json, keyed by the engine
           scalar: A=85, A-dem=75, B=70, B-dem=60, C=45, C-dem=35) — so the
           horizon claim prints only where it is true of every trade. */
        var gAllScalp = (gkey === 'A' || gkey === 'A-DEMOTED'
          || gkey === 'B-DEMOTED' || gkey === 'C-DEMOTED');
        suffix = 'replay ' + (gev.winRate * 100).toFixed(0) + '% WR, '
          + gev.avgNetR.toFixed(2) + 'R net' + (gAllScalp ? ' on scalps' : '');
      }
    } else if (s >= 85){
      /* Practically unreachable: no scan trade in the 7,270-trade replay
         scored 85 and the arithmetic cannot get there. Stated, not hidden. */
      suffix = 'unreached in replay — scan arithmetic tops out near 82';
    } else {
      var tev = hgOgReplayEvidence(s >= 70 ? 'STRONG' : s >= 50 ? 'FAIR' : 'WEAK');
      if (tev && isFinite(fin(tev.winRate))){
        suffix = 'replay ' + (tev.winRate * 100).toFixed(0) + '% WR';
      }
    }
    return { color: color, label: label, suffix: suffix };
  }

  /* COST QUARANTINE (hg-v532). A heavy/fatal fee load must be read BEFORE
     any medal: this block renders above the confluence badge in the warn
     style. The 2.60R figure is the measured ENGINE:SCALP cohort net loss —
     named explicitly, because this warning also renders on SCAN cards
     whose own cohort record differs; ENGINE:SCALP is quoted as the cohort
     that actually carried this drag class (its settled trades measured
     median 1.16R of fees per stop, 89% at heavy-or-fatal tier, from
     trades[] in scripts/backtest-omnigold-results.json).
     '' when the fee tier is ok/thin or the cost is unmeasurable. */
  function hgOgCostsFirstHtml(setup, drag){
    var d = drag || hgOgCostDrag(setup);
    if (!d || (d.tier !== 'heavy' && d.tier !== 'fatal')) return '';
    var coh = hgOgReplayEvidence('ENGINE:SCALP');
    var cohNet = (coh && isFinite(fin(coh.avgNetR))) ? fin(coh.avgNetR) : -2.603;
    var cohTxt = (cohNet < 0)
      ? ('lost ' + Math.abs(cohNet).toFixed(2) + 'R/trade net')
      : ('netted +' + cohNet.toFixed(2) + 'R/trade');
    var txt = 'COSTS FIRST: ' + d.rtCostPct.toFixed(2) + '% round trip is '
      + d.costR.toFixed(2) + 'R of this stop — the replay\'s ENGINE scalp cohort '
      + cohTxt + ' under fee loads like this';
    return '<div class="note warn og-costs-first" style="margin:8px 0;padding:6px 8px;'
      + 'border:1px solid #f59e0b;border-left:3px solid #dc2626;border-radius:4px;'
      + 'background:rgba(245,158,11,0.08);font-weight:bold;font-size:0.85em">'
      + esc(txt) + '</div>'
      /* replay-vs-venue honesty (hg-v533): the cohort loss above is a
         PAXG-cost fact; a cheaper venue re-prices the fee, not the record. */
      + hgOgVenueCostNoteHtml();
  }

  /* The legend's honest header — above the four tier cells, in warn style,
     because the tier table below it did NOT rank outcomes and saying so in
     a footnote while the cells said 'Trade immediately' is how a reader
     took real losses on 'EXCEPTIONAL' labels. */
  function hgOgSpectrumTruthHeaderHtml(){
    var E = HG_OG_REPLAY_EVIDENCE;
    var txt = 'measured reality: these tiers did NOT rank outcomes in the '
      + hgOgFmtCount(E.settled) + '-trade replay (WEAK outperformed STRONG); '
      + 'grade-A selection is real but scalp costs erased it. '
      + 'The tiers are a checklist, not a ranking.';
    return '<div class="warn og-spectrum-truth" style="margin-bottom:8px;padding:6px 8px;'
      + 'border-left:3px solid #f59e0b;background:rgba(245,158,11,0.08);'
      + 'font-size:0.85em;font-weight:bold">' + esc(txt) + '</div>';
  }

  /* The four legend cells, captioned with the measured record instead of an
     instruction ('Trade immediately' told a reader to click; 34% > 30% is
     what actually happened). Numbers come from the baked tables only. */
  function hgOgSpectrumLegendCellsHtml(){
    var A = hgOgReplayEvidence('A');
    var wrTxt = function(ev){
      return (ev && isFinite(fin(ev.winRate)))
        ? ('replay ' + (ev.winRate * 100).toFixed(0) + '% WR') : 'no replay record';
    };
    var capA = (A && isFinite(fin(A.avgNetR)))
      ? ('engine grade-A scalar only — ' + wrTxt(A) + ', ' + A.avgNetR.toFixed(2) + 'R net on scalps')
      : 'engine grade-A scalar only';
    var h = '';
    h += '<div style="padding:6px;border-left:3px solid #10b981;background:#10b98111"><span style="color:#10b981;font-weight:bold">🏆 ≥85</span><br>GRADE-A CLASS<br><span style="color:var(--fg-muted,#666);font-size:0.8em">' + esc(capA) + '</span></div>';
    h += '<div style="padding:6px;border-left:3px solid #22c55e;background:#22c55e11"><span style="color:#22c55e;font-weight:bold">✓ 70-84</span><br>STRONG<br><span style="color:var(--fg-muted,#666);font-size:0.8em">' + esc(wrTxt(hgOgReplayEvidence('STRONG'))) + '</span></div>';
    h += '<div style="padding:6px;border-left:3px solid #f59e0b;background:#f59e0b11"><span style="color:#f59e0b;font-weight:bold">⚠️ 50-69</span><br>FAIR<br><span style="color:var(--fg-muted,#666);font-size:0.8em">' + esc(wrTxt(hgOgReplayEvidence('FAIR'))) + '</span></div>';
    h += '<div style="padding:6px;border-left:3px solid #dc2626;background:#dc262611"><span style="color:#dc2626;font-weight:bold">✗ <50</span><br>WEAK<br><span style="color:var(--fg-muted,#666);font-size:0.8em">' + esc(wrTxt(hgOgReplayEvidence('WEAK'))) + '</span></div>';
    return h;
  }

  /* DESK-STANCE BANNER (hg-v532). Permanent, at the top of the tab beside
     the scan controls — the replay's verdict before any card decorates
     anything. Every figure is baked from the two replay files; the median
     fee figures are the measured ones (see the medianCostR bake note).
     An earlier draft called ENGINE:SWING 'the only cohort that survived
     costs' and its makeup 'grade-A/B' — neither traces: PF 0.90 is a net
     LOSS (avgNetR -0.056), and its 27 settled trades were engine scalar
     45 x21 (grade-C, low tally) + scalar 70 x6, with no grade-A at all
     (trades[] in scripts/backtest-omnigold-results.json). */
  function hgOgDeskStanceBannerHtml(){
    var E = HG_OG_REPLAY_EVIDENCE;
    var med = E.medianCostR || {};
    var pfSw = fin(E.pf && E.pf['ENGINE:SWING']);
    var sw = hgOgReplayEvidence('ENGINE:SWING');
    var swNet = (sw && isFinite(fin(sw.avgNetR))) ? fin(sw.avgNetR).toFixed(2) : '-0.06';
    var txt = 'REPLAY VERDICT (' + hgOgFmtCount(E.settled) + ' settled PAXG trades): '
      + 'scalp-geometry setups lost net of costs across every tier — the median trade paid '
      + fin(med.all).toFixed(2) + 'R in fees (' + fin(med.scalp).toFixed(2) + 'R on scalp geometry). '
      + 'No cohort finished net-positive; the closest was ENGINE setups on SWING geometry ('
      + swNet + 'R/trade net, PF ' + (isFinite(pfSw) ? pfSw.toFixed(2) : '0.90')
      + ' — still a net loss). '
      + 'Confluence tiers did not rank outcomes. Every number here is measured, in '
      + E.src + ' + scripts/backtest-omnigold-results.json.';
    /* ACTIVE-VENUE LINE (hg-v537): the venue the cost machinery is pricing
       right now, its round trip, and how many baked kinds stand demoted at
       those costs — with the other preset's count beside it, so switching
       venue is never a silent change in what the desk stands aside from. */
    var vline = '';
    try {
      var vc = hgOgVenueCost();
      var nHere = hgOgDemotedKindCount(vc);
      var other = hgOgVenuePresetCost(vc.venue === 'XM' ? 'PAXG' : 'XM');
      var nOther = hgOgDemotedKindCount(other);
      vline = 'venue ' + (vc.venue === 'XM' ? 'XM XAUUSD' : 'PAXG')
        + ' ~' + fin(vc.rtCostPct).toFixed(3) + '% RT — '
        + nHere + ' measured-negative kind' + (nHere === 1 ? '' : 's')
        + ' stood aside; at ' + other.venue + ' costs ('
        + fin(other.rtCostPct).toFixed(3) + '% RT) it would be ' + nOther;
    } catch (eVl) { vline = ''; }
    return '<div class="note warn og-replay-banner" data-og-replay-banner="1" '
      + 'style="margin-bottom:10px;border-left:3px solid #dc2626">' + esc(txt)
      + (vline ? '<div class="og-venue-stance" style="margin-top:4px">' + esc(vline) + '</div>' : '')
      + '</div>';
  }

  /* Cost drag of the round trip measured in R. costR = RT% / stop distance %:
     0.26% RT against a 0.30% stop is 0.87R of fees — the trade must
     clear nearly a full R before the reader is flat. Tiers:
       ok    <= 0.125  fees are noise
       thin  <= 0.25   a quarter R of drag — the edge must be real
       heavy <= 0.5    half an R — no measured kind's gross edge pays this
       fatal >  0.5    the stop is tighter than the fee: structurally unpayable
     Accepts an OMNIGOLD card ({ plan:{entry,stop} }) or a raw engine setup
     ({ entry, stop }). venueCost is optional (hg-v533): pass an
     hgOgVenueCost() result to price a specific venue; omitted, the ACTIVE
     venue is read (PAXG conservative fallback — identical numbers to before
     the venue model existed). Null-safe: non-finite -> null, never a throw. */
  function hgOgCostDrag(setup, venueCost){
    if (!setup) return null;
    var src = (setup.plan && typeof setup.plan === 'object') ? setup.plan : setup;
    var entry = fin(src.entry), stop = fin(src.stop);
    if (!isFinite(entry) || !isFinite(stop) || entry <= 0) return null;
    var stopPct = Math.abs(entry - stop) / entry * 100;
    if (!(stopPct > 0)) return null;
    var vc = (venueCost && isFinite(fin(venueCost.rtCostPct))) ? venueCost : hgOgVenueCost();
    var rt = fin(vc && vc.rtCostPct);
    if (!(isFinite(rt) && rt > 0)) return null;
    var costR = rt / stopPct;
    if (!isFinite(costR)) return null;
    var tier = (costR <= 0.125) ? 'ok'
      : (costR <= 0.25) ? 'thin'
      : (costR <= 0.5) ? 'heavy' : 'fatal';
    return { costR: costR, stopPct: stopPct, rtCostPct: rt, tier: tier,
             venue: String((vc && vc.venue) || 'PAXG') };
  }

  /* 'COST 0.42R — fees eat the edge' chip. Renders ONLY when the fee load
     is heavy (amber) or fatal (red); ok/thin stay silent, because a chip on
     every card is a chip on no card. '' on missing data, never a throw. */
  function hgOgCostChipHtml(setup){
    var d = hgOgCostDrag(setup);
    if (!d || (d.tier !== 'heavy' && d.tier !== 'fatal')) return '';
    return pill('COST ' + d.costR.toFixed(2) + 'R — fees eat the edge',
                d.tier === 'fatal' ? 'bad' : 'warn');
  }

  /* 'replay: 37% WR, -0.78R net (n=713)' — the mechanic's settled replay
     record in muted small text, negative numbers included. The reader gets
     the honest history or nothing; '' when the kind has no n>=40 record. */
  function hgOgReplayLineHtml(kind){
    var ev = hgOgReplayEvidence(kind);
    if (!ev || !isFinite(fin(ev.winRate)) || !isFinite(fin(ev.avgNetR))) return '';
    var netTxt = (ev.avgNetR >= 0 ? '+' : '') + ev.avgNetR.toFixed(2) + 'R';
    return '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">replay: '
      + (ev.winRate * 100).toFixed(0) + '% WR, ' + netTxt + ' net (n=' + ev.n + ')</div>';
  }

  /* ENGINE pick annotations. Grade A/B carry the replay's one genuinely
     positive finding — the selection ordering held (A 54.3% > B 36.1% >
     C 34.8% win rate) — WITH its cost warning attached; a SCALP-horizon
     pick whose fee tier is heavy/fatal gets the cohort caution too
     (ENGINE:SCALP -2.603R/trade net vs ENGINE:SWING -0.056R). '' when the
     grade has no record; never a throw. */
  function hgOgEngineReplayLinesHtml(pick, horizon){
    if (!pick) return '';
    var h = '';
    var g = pick.engineGrade || ((typeof pick.grade === 'string') ? pick.grade : '');
    g = String(g || '').toUpperCase();
    if (g === 'A' || g === 'B'){
      var demoted = !!(pick.engineDemoted || pick.demoted);
      var ev = hgOgReplayEvidence(g + (demoted ? '-DEMOTED' : ''));
      if (ev && isFinite(fin(ev.winRate))){
        h += '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">replay: grade-'
          + g + (demoted ? ' (demoted)' : '') + ' ' + (ev.winRate * 100).toFixed(0)
          + '% WR (n=' + ev.n + ') — selection edge real, mind the costs</div>';
      }
    }
    var hz = String(horizon || pick.horizon || '').toUpperCase();
    if (hz === 'SCALP'){
      var d = hgOgCostDrag(pick);
      if (d && (d.tier === 'heavy' || d.tier === 'fatal')){
        var coh = hgOgReplayEvidence('ENGINE:SCALP');
        var drag = (coh && isFinite(fin(coh.avgNetR))) ? coh.avgNetR.toFixed(1) : '-2.6';
        h += '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">replay: scalp cost drag '
          + drag + 'R/trade net — swing geometry survived (PF 0.90)</div>';
      }
    }
    return h;
  }

  /* One muted footnote where the confluence legend renders. The replay's
     honest answer on the aggregate score: test AUC 0.4924, no monotonic
     decile ranking — so the legend's tiers are a checklist of agreement,
     not a probability. If a future refit flips the baked verdict to
     predictive/weak this returns '' and hgOgConfluenceFitPwin supplies a
     fitted P(win) beside the badge instead. */
  function hgOgConfluenceFitNoteHtml(){
    var fit = HG_OG_REPLAY_EVIDENCE && HG_OG_REPLAY_EVIDENCE.fit;
    if (!fit || fit.verdict !== 'not-predictive') return '';
    return '<div class="dim" style="font-size:11px;margin-top:6px">replay note: confluence rank not yet predictive OOS (PAXG window, test AUC '
      + fin(fit.testAUC).toFixed(2) + ') — treat as checklist, not probability</div>';
  }

  /* Fitted P(win) for a confluence score — ONLY when the baked verdict is
     predictive/weak AND the refit published a raw-score logistic
     (fit.pwin = { intercept, slope } on the 0-100 score). Today's verdict
     is not-predictive and no such fit exists, so this returns null and no
     probability is invented. */
  function hgOgConfluenceFitPwin(score){
    var fit = HG_OG_REPLAY_EVIDENCE && HG_OG_REPLAY_EVIDENCE.fit;
    if (!fit || fit.verdict === 'not-predictive') return null;
    var pw = fit.pwin;
    var s = fin(score);
    if (!pw || !isFinite(fin(pw.intercept)) || !isFinite(fin(pw.slope)) || !isFinite(s)) return null;
    var z = fin(pw.intercept) + fin(pw.slope) * s;
    var p = 1 / (1 + Math.exp(-z));
    return isFinite(p) ? p : null;
  }

  /* ' fit P(win) 34%' beside the confluence badge, or '' (always '' while
     the verdict is not-predictive). */
  function hgOgConfluenceFitPwinHtml(score){
    var p = hgOgConfluenceFitPwin(score);
    if (p === null) return '';
    return ' <span class="dim" style="font-size:11px">fit P(win) ' + (p * 100).toFixed(0) + '%</span>';
  }

  /* ==================== setup FORMATION (hg-v533) ====================

     WHY THIS EXISTS. A reader took real losses on setups this desk drew as
     tradable cards while its own baked replay had already measured those
     kinds losing at scale, and while the stop geometry meant fees consumed
     a material share of 1R before the idea could speak. Chips and footnotes
     were not enough — the fix is at FORMATION: a setup that fails these
     bars never becomes a tradable card. It renders, demoted and levelless,
     in the MEASURED-NEGATIVE section instead, so nothing is hidden and
     nothing toxic looks tradable. */

  /* Formation stop floor: venue round trip may cost at most this share of
     1R. 0.125 is hgOgCostDrag's own 'ok' ceiling — the tier this file has
     always called 'fees are noise'. Equivalent stop-distance floor:
     stopDistPct >= rtCostPct / 0.125 = 8x the venue round trip
     (XM ~0.020% RT -> stops >= 0.16% form; PAXG 0.26% RT -> only stops
     >= 2.08% form. The floor adapts to the venue honestly). */
  var HG_OG_FORM_COST_R_MAX = 0.125;

  /* Measured-toxic kind demotion thresholds, applied to the baked per-kind
     replay rows (n >= 100 so one regime cannot condemn a kind):
       grossR <= -0.05          direction measured wrong at scale, costs aside
       venue-adj netR <= -0.5   still toxic after re-pricing fees at the venue
     venue-adjusted netR = avgGrossR - (venueRt / 0.26) * medianCostR:
     the kind's median fee load was measured at the 0.26% PAXG round trip,
     so a venue's fee load is that median scaled by the round-trip ratio;
     gross outcomes are measured facts and are NOT rescaled. */
  var HG_OG_DEMOTE_MIN_N = 100;
  var HG_OG_DEMOTE_GROSS_R = -0.05;
  var HG_OG_DEMOTE_VENUE_NET_R = -0.5;

  /* Replay-survivor bar: positive gross at scale with a low measured fee
     load — the kinds whose edge was real and cheap to hold (STRUCT-BOS,
     BOS-RETEST, SQUEEZE-FIRE, CUSUM-SHIFT class). Ranking preference only. */
  var HG_OG_SURVIVOR_MIN_N = 50;
  var HG_OG_SURVIVOR_MAX_MED_COST_R = 0.3;

  /* The kind's venue-adjusted net R, or NaN when the row lacks the pieces. */
  function hgOgVenueNetR(row, venueCost){
    if (!row) return NaN;
    var gross = fin(row.avgGrossR), med = fin(row.medianCostR);
    var rt = fin(venueCost && venueCost.rtCostPct);
    if (!isFinite(gross) || !isFinite(med) || !(rt > 0)) return NaN;
    return gross - (rt / HG_OG_REPLAY_EVIDENCE.rtCostPct) * med;
  }

  /* Demotion verdict for ONE kind at the given (or active) venue.
     null = not demoted (including: no baked row, or n < 100 — demotion is an
     evidence claim and only measured evidence can make it).
     Else { kind, n, winRate, grossR, paxgNetR, medCostR, venueNetR, venue,
            reasons[] }. */
  function hgOgKindDemotion(kind, venueCost){
    try{
      var ev = hgOgReplayEvidence(kind);
      if (!ev || !isFinite(fin(ev.avgGrossR))) return null;   /* kinds only carry gross */
      if (!(fin(ev.n) >= HG_OG_DEMOTE_MIN_N)) return null;
      var vc = (venueCost && isFinite(fin(venueCost.rtCostPct))) ? venueCost : hgOgVenueCost();
      var reasons = [];
      if (fin(ev.avgGrossR) <= HG_OG_DEMOTE_GROSS_R){
        reasons.push('grossR ' + fin(ev.avgGrossR).toFixed(3) + ' <= ' + HG_OG_DEMOTE_GROSS_R
          + ' at n=' + ev.n + ' — direction measured wrong at scale regardless of costs');
      }
      var vnet = hgOgVenueNetR(ev, vc);
      if (isFinite(vnet) && vnet <= HG_OG_DEMOTE_VENUE_NET_R){
        reasons.push('venue-adjusted netR ' + vnet.toFixed(3) + ' <= ' + HG_OG_DEMOTE_VENUE_NET_R
          + ' at ' + vc.venue + ' costs (gross ' + fin(ev.avgGrossR).toFixed(3)
          + ' - ' + (fin(vc.rtCostPct) / HG_OG_REPLAY_EVIDENCE.rtCostPct).toFixed(3)
          + ' x medCostR ' + fin(ev.medianCostR).toFixed(3) + ')');
      }
      if (!reasons.length) return null;
      return {
        kind: String(kind).toUpperCase(), n: ev.n, winRate: ev.winRate,
        grossR: ev.avgGrossR, paxgNetR: ev.avgNetR, medCostR: ev.medianCostR,
        venueNetR: isFinite(vnet) ? vnet : null, venue: vc.venue, reasons: reasons
      };
    }catch(eKd){
      /* An unreadable evidence row cannot prove toxicity — but it cannot
         clear the kind either; the caller's stop floor still applies. */
      return null;
    }
  }

  /* How many baked kinds stand demoted at a venue's costs — the number the
     desk-stance banner quotes. Counted by running the SAME verdict function
     the formation gate runs (hgOgKindDemotion) over the baked table, never
     a hand-kept list, so a re-bake or threshold change moves it. At today's
     bake: 12 at XM (~0.020% RT), 22 at PAXG (0.26% RT). */
  function hgOgDemotedKindCount(venueCost){
    var vc = (venueCost && isFinite(fin(venueCost.rtCostPct))) ? venueCost : hgOgVenueCost();
    var kinds = HG_OG_REPLAY_EVIDENCE.kinds, k, n = 0;
    for (k in kinds){
      if (!Object.prototype.hasOwnProperty.call(kinds, k)) continue;
      if (hgOgKindDemotion(k, vc)) n++;
    }
    return n;
  }

  /* Has this kind's LIVE forward ledger genuinely paid? THE SAME READ the
     FORWARD table renders — hgFwdPool per tab, judged by the same
     hgOmniPoolRead call hgFwdPanelHTML makes for these panels (minRr =
     OG_T1_R exactly as runScan passes it at render, minSamples = the
     panel's 20, barZ = the family-wise bar over the mechanics that pool
     actually holds). Nothing reimplemented: this gate and the READ column
     cannot disagree. Fail closed: any missing piece -> null, never a pass. */
  function hgOgForwardPaid(kind, horizon){
    try{
      var w = W();
      if (!w || typeof w.hgFwdPool !== 'function' || typeof w.hgOmniPoolRead !== 'function') return null;
      var k = String(kind || '');
      if (!k) return null;
      var hz = String(horizon || '').toUpperCase();
      var tabs = (hz === 'SCALP' || hz === 'SWING')
        ? ['OMNIGOLD:' + hz]
        : ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING'];
      for (var ti = 0; ti < tabs.length; ti++){
        var pool = null;
        try { pool = w.hgFwdPool(tabs[ti]); } catch (ePl) { pool = null; }
        if (!pool || typeof pool !== 'object') continue;
        var p = pool[k];
        if (!p || !(fin(p.samples) > 0)) continue;
        var keys = [], kk;
        for (kk in pool) if (Object.prototype.hasOwnProperty.call(pool, kk)) keys.push(kk);
        var barZ = hgOgFamilyZ(Math.max(1, keys.length));
        var v = null;
        try { v = w.hgOmniPoolRead(p, OG_T1_R, 20, barZ); } catch (eV) { v = null; }
        if (v && v.read === 'has paid'){
          return { tab: tabs[ti], read: 'has paid', z: fin(v.z), bar: fin(v.bar),
                   samples: fin(p.samples), hit: fin(p.hit) };
        }
      }
      return null;
    }catch(eFp){ return null; }
  }

  /* The replay-survivor list, DERIVED from the baked rows (never written by
     hand, so a re-bake moves it): grossR > 0, n >= 50, medianCostR <= 0.3.
     Cached — the baked table cannot change within a load. */
  var __ogSurvivors = null;
  function hgOgSurvivorKinds(){
    if (__ogSurvivors) return __ogSurvivors.slice();
    var out = [], kinds = HG_OG_REPLAY_EVIDENCE.kinds, k, r;
    for (k in kinds){
      if (!Object.prototype.hasOwnProperty.call(kinds, k)) continue;
      r = kinds[k];
      if (r && r.length > 4 && fin(r[3]) > 0 && fin(r[0]) >= HG_OG_SURVIVOR_MIN_N
          && fin(r[4]) <= HG_OG_SURVIVOR_MAX_MED_COST_R){
        out.push(k);
      }
    }
    out.sort();
    __ogSurvivors = out;
    return out.slice();
  }
  function hgOgIsSurvivor(kind){
    if (kind === null || kind === undefined) return false;
    var key = String(kind).toUpperCase().replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    return hgOgSurvivorKinds().indexOf(key) >= 0;
  }

  /* THE FORMATION VERDICT, at plan construction, for every OMNIGOLD setup —
     scan cards ({ kind, horizon, plan }) and engine setups
     ({ strategy|stratKey, entry, stop }) alike.
     -> { formed, venue, drag, reasons[], stopFloor?, kindDemotion?,
          unDemoted? }.
       - STOP FLOOR: venueRt / stopDistPct > 0.125 -> not formed.
       - KIND DEMOTION: measured-toxic per hgOgKindDemotion -> not formed,
         UNLESS the kind's live forward ledger reads 'has paid' (the same
         read the FORWARD table renders) — then unDemoted carries both the
         demotion and the forward evidence, shown on the card.
       - No measurable stop -> no stop-floor verdict (a card without levels
         is already not tradable); kind demotion still applies.
     Never throws. Callers treat their OWN failure to obtain a verdict as
     not-formed (fail closed); this function only fails closed on evidence
     (absent forward ledger = still demoted), not on absent geometry. */
  function hgOgFormation(setup){
    var vc = hgOgVenueCost();
    var out = { formed: true, venue: vc, drag: null, reasons: [] };
    if (!setup) return out;
    var kind = String(setup.kind || setup.strategy || setup.stratKey || '');
    var drag = null;
    try { drag = hgOgCostDrag(setup, vc); } catch (eD) { drag = null; }
    out.drag = drag;
    if (drag && fin(drag.costR) > HG_OG_FORM_COST_R_MAX){
      out.formed = false;
      out.stopFloor = { costR: drag.costR, maxR: HG_OG_FORM_COST_R_MAX,
                        stopPct: drag.stopPct, rtCostPct: drag.rtCostPct, venue: vc.venue };
      out.reasons.push('stop inside ' + (1 / HG_OG_FORM_COST_R_MAX)
        + 'x the venue round-trip — fees are ' + drag.costR.toFixed(2)
        + 'R of 1R before the idea speaks (' + vc.venue + ' '
        + fin(vc.rtCostPct).toFixed(3) + '% RT vs ' + drag.stopPct.toFixed(2) + '% stop)');
    }
    var dem = kind ? hgOgKindDemotion(kind, vc) : null;
    if (dem){
      var paid = hgOgForwardPaid(kind, setup.horizon);
      if (paid){
        out.unDemoted = { demotion: dem, forward: paid };
      } else {
        out.formed = false;
        out.kindDemotion = dem;
        out.reasons.push('measured-negative kind in the ' + hgOgFmtCount(HG_OG_REPLAY_EVIDENCE.settled)
          + '-trade replay: ' + dem.reasons.join('; '));
      }
    }
    /* ENGINE / gold-tab edge bake (hg-v574): plan sides + suppress/demote/prefer
       from scripts/gold-setup-edge.json. Does not invent levels. Demote/suppress
       stand aside from tradable formation (never MOST PROBABLE / engine lead). */
    try{
      var wEdge = W();
      var edgeApply = wEdge && typeof wEdge.hgGoldSetupEdgeApply === 'function'
        ? wEdge.hgGoldSetupEdgeApply : null;
      if (edgeApply && out.formed !== false){
        var plan = setup.plan || {};
        var horizon = String(setup.horizon || '').toUpperCase();
        var isSwing = horizon === 'SWING'
          || /^4H\b/.test(String(kind).toUpperCase())
          || /WEEKLY|SWING/.test(String(kind).toUpperCase());
        var probe = {
          dir: setup.dir,
          entry: isFinite(fin(plan.entry)) ? fin(plan.entry) : fin(setup.entry),
          stop: isFinite(fin(plan.stop)) ? fin(plan.stop) : fin(setup.stop),
          t1: isFinite(fin(plan.t1)) ? fin(plan.t1) : fin(setup.t1),
          strategy: kind,
          stratKey: setup.stratKey || '',
          stamps: [],
          demoted: !!setup.demoted
        };
        edgeApply(probe, isSwing ? { swing: true } : { scalp: true });
        if (probe.dropped){
          out.formed = false;
          out.edgeSuppress = probe.edge || { action: 'suppress', why: probe.reason };
          out.reasons.push(probe.reason || 'gold setup edge suppress');
        } else if (probe.demoted && probe.edge && probe.edge.action === 'demote'){
          out.formed = false;
          out.edgeDemote = probe.edge;
          out.reasons.push(probe.edge.why || 'gold setup edge demote');
        } else if (probe.edgeBoost > 0 && probe.edge && probe.edge.action === 'prefer'){
          out.edgePrefer = true;
          out.edgeBoost = probe.edgeBoost;
          out.edge = probe.edge;
        }
        var catApply = wEdge && typeof wEdge.hgGoldCatalogApplyVerdict === 'function'
          ? wEdge.hgGoldCatalogApplyVerdict : null;
        if (catApply){
          probe.kind = kind;
          var catRows = setup.rows || setup.rows15m || setup.rows4h || [];
          var catEngFn = wEdge && typeof wEdge.hgGoldCatalogEngine === 'function'
            ? wEdge.hgGoldCatalogEngine : null;
          var catEng = catEngFn ? catEngFn(catRows, {}) : null;
          catApply(probe, catEng);
          if (probe.catalogExclude){
            out.formed = false;
            out.catalogExclude = true;
            out.catalogVerdict = probe.catalogVerdict;
            out.reasons.push('catalog ' + (probe.catalogVerdict || 'exclude')
              + ' — REDUNDANT / NON-FALSIFIABLE / AVOID never ENTER');
          } else if (probe.catalogVerdict){
            out.catalogVerdict = probe.catalogVerdict;
            out.catalogFamily = probe.catalogFamily;
          }
        }
      }
    }catch(eEdge){ /* edge bake optional — stop floor / kind demotion still bind */ }
    return out;
  }

  /* The stood-aside section: every setup that fired but did NOT form.
     Collapsed, listed with each kind's replay row — n, WR, grossR,
     venue-net — and the formation reason. NO entry/stop/target renders
     here, deliberately: a level on a measured-negative card is an
     invitation. */
  function hgOgDemotedSectionHtml(cards){
    if (!cards || !cards.length) return '';
    var vc = hgOgVenueCost();
    var h = '<details class="note og-demoted-kinds" data-og-demoted="1" style="margin-top:12px">';
    h += '<summary style="cursor:pointer"><b>MEASURED-NEGATIVE KINDS — stood aside</b> ('
      + cards.length + ' setup' + (cards.length === 1 ? '' : 's')
      + ' fired, none tradable)</summary>';
    h += '<div class="dim" style="margin:8px 0;font-size:0.85em">These fired and are on the record — they are NOT tradable cards, and no levels are printed. '
      + 'A kind stands aside when the replay measured it negative at scale (grossR &le; '
      + HG_OG_DEMOTE_GROSS_R + ', n &ge; ' + HG_OG_DEMOTE_MIN_N
      + ') or venue-adjusted net toxic (netR &le; ' + HG_OG_DEMOTE_VENUE_NET_R
      + ' at ' + esc(vc.venue) + ' costs, n &ge; ' + HG_OG_DEMOTE_MIN_N
      + '); a stop stands aside when ' + esc(vc.venue) + ' fees exceed '
      + HG_OG_FORM_COST_R_MAX + 'R of 1R on it. A demoted kind whose LIVE forward ledger reads '
      + '\'has paid\' (the FORWARD table\'s own read) forms again, with that evidence shown.</div>';
    h += hgOgVenueCostNoteHtml();
    var i, c, ev, vnet;
    for (i = 0; i < cards.length; i++){
      c = cards[i];
      if (!c) continue;
      h += '<div class="dim og-demoted-row" style="margin:4px 0;font-size:0.85em">'
        + esc(String(c.horizon || '') + ' · ' + String(c.kind || '?') + ' '
              + String(c.dir || '').toUpperCase());
      ev = hgOgReplayEvidence(c.kind);
      if (ev && isFinite(fin(ev.avgGrossR))){
        vnet = hgOgVenueNetR(ev, vc);
        h += ' · replay n=' + ev.n + ', WR ' + (ev.winRate * 100).toFixed(0)
          + '%, gross ' + (ev.avgGrossR >= 0 ? '+' : '') + ev.avgGrossR.toFixed(3) + 'R'
          + (isFinite(vnet) ? (', venue-net ' + (vnet >= 0 ? '+' : '') + vnet.toFixed(3) + 'R') : '');
      } else {
        h += ' · no baked replay row (n &lt; 40)';
      }
      if (c.formation && c.formation.reasons && c.formation.reasons.length){
        h += '<br><span style="opacity:.85">— ' + esc(c.formation.reasons.join(' · ')) + '</span>';
      }
      h += '</div>';
    }
    h += '</details>';
    return h;
  }

  /* POPULATION COUNTS for one scan (hg-v537): what formed, what stood
     aside, and how many desk-order sections a replay-survivor kind leads.
     'Sections' are hgOgDeskOrder's own ordering classes — ticket state x
     tape alignment — and a survivor 'leads' one when it is the first card
     of that class in desk order (the survivor class key sorts it there).
     Computed from the REAL partitioned scan lists; nothing invented. */
  function hgOgScanCounts(orderedTradable, demotedCards, tape){
    var tapeDir = String(tape || '').toLowerCase();
    function cls(c){
      return ((c && c.grade && c.grade.ticket) ? 2 : 0)
        + (((tapeDir === 'long' || tapeDir === 'short')
            && String((c && c.dir) || '').toLowerCase() === tapeDir) ? 1 : 0);
    }
    var seen = {}, led = 0, i, c, k;
    var list = orderedTradable || [];
    for (i = 0; i < list.length; i++){
      c = list[i];
      if (!c) continue;
      k = String(cls(c));
      if (seen[k]) continue;             /* only the FIRST card of a section */
      seen[k] = true;
      if (c.replaySurvivor || hgOgIsSurvivor(c.kind)) led++;
    }
    return {
      tradable: list.length,
      demoted: (demotedCards && demotedCards.length) || 0,
      survivorLedSections: led
    };
  }

  /* The one-line counts strip under the banner. textContent (never
     innerHTML) so the numbers cannot smuggle markup; hidden until a scan
     has real counts to show. */
  function hgOgPaintCounts(ui, counts){
    if (!ui || !ui.counts || !counts) return;
    try {
      ui.counts.style.display = '';
      ui.counts.textContent = 'tradable setups ' + counts.tradable
        + ' · demoted ' + counts.demoted
        + ' · survivors leading ' + counts.survivorLedSections + ' section'
        + (counts.survivorLedSections === 1 ? '' : 's');
    } catch (eC) {}
  }

  /* ==================== end setup FORMATION (hg-v533) ==================== */

  /* ==================== end replay evidence + cost drag ==================== */

  function hgOgSettledEvidence(row){
    if (!row) return null;
    var horizon = String(row.horizon || 'SWING').toUpperCase();
    var mechanic = row.kind || row.stratKey || row.strategy;
    var tabs = (horizon === 'SCALP') ? OG_SCALP_FWD_TABS.slice()
              : ['OMNIGOLD:SWING', 'GOLDSWING', 'SUPER:GOLD'];
    var out = hgOgMergeSettledEvidence(tabs, mechanic, row.dir);
    if (!out){
      var tab = 'OMNIGOLD:' + (horizon === 'SCALP' ? 'SCALP' : 'SWING');
      var fwd = hgOgFwdFor(tab, mechanic);
      if (fwd && fwd.ticketOnly && fin(fwd.ticketOnly.samples) > 0){
        var t = fwd.ticketOnly;
        out = {
          source: tab + ':' + mechanic,
          wins: fin(t.wins) || 0,
          samples: fin(t.samples),
          hit: fin(t.hit),
          expR: fin(t.expR),
          wilson: hgOgWilsonHit(t.wins, t.samples)
        };
      }
    }
    var sc = hgOgScorecardGoldEvidence(row.dir);
    if (sc && sc.wilson){
      if (!out || sc.wilson.lo > (out.wilson ? out.wilson.lo : -1)){
        out = sc;
      }
    }
    /* Desk-wide scalp pool when mechanic-specific history is thin. */
    if (horizon === 'SCALP' && (!out || fin(out.samples) < OG_VERDICT_MIN_N)){
      var desk = hgOgMergeSettledEvidence(OG_SCALP_FWD_TABS, null, row.dir);
      if (desk && desk.wilson && (!out || desk.wilson.lo > (out.wilson ? out.wilson.lo : -1))){
        desk.source = 'desk-pool · ' + desk.source;
        out = desk;
      }
    }
    return out;
  }

  function hgOgSettledExecuteOk(ev, minLo, minN){
    if (!ev || !ev.wilson) return false;
    minLo = isFinite(fin(minLo)) ? fin(minLo) : OG_EXEC_WILSON_LO;
    minN = isFinite(fin(minN)) ? fin(minN) : OG_EXEC_MIN_N;
    return fin(ev.samples) >= minN && ev.wilson.lo >= minLo;
  }

  function hgOgPickSettledExecutes(ranked, tapeDir, opts){
    opts = opts || {};
    var minLo = opts.minWilsonLo != null ? opts.minWilsonLo : OG_EXEC_WILSON_LO;
    var minN = opts.minN != null ? opts.minN : OG_EXEC_MIN_N;
    tapeDir = String(tapeDir || '').toLowerCase();
    var execute = [], pool = [], i, c, ev;
    for (i = 0; i < (ranked || []).length; i++){
      c = ranked[i];
      if (!c || !(c.grade && c.grade.ticket) || !c.plan) continue;
      if (tapeDir === 'long' || tapeDir === 'short'){
        if (String(c.dir || '').toLowerCase() !== tapeDir) continue;
      }
      ev = hgOgSettledEvidence(c);
      c.settledEv = ev;
      if (hgOgSettledExecuteOk(ev, minLo, minN)) execute.push(c);
      else if (ev && ev.wilson) pool.push(c);
    }
    pool.sort(function(a, b){
      return (b.settledEv.wilson.lo - a.settledEv.wilson.lo)
          || (b.settledEv.samples - a.settledEv.samples);
    });
    return { execute: execute, best: pool.slice(0, 2), minLo: minLo, minN: minN };
  }

  function hgOgSettledExecuteRowHtml(c, tier){
    var p = c.plan, ev = c.settledEv;
    var w = ev && ev.wilson;
    var pct = w ? (w.p * 100).toFixed(0) : '—';
    var lo = w ? (w.lo * 100).toFixed(0) : '—';
    var hi = w ? (w.hi * 100).toFixed(0) : '—';
    var h = '<div class="og-settled-row' + (tier === 'execute' ? ' og-settled-exec' : '') + '">';
    h += '<div class="hg-mp-head">XAUUSD ' + esc(String(c.dir || '').toUpperCase())
      + ' <span>' + esc(c.horizon) + ' · ' + esc(c.kind) + ' · TICKET</span></div>';
    h += '<div class="hg-mp-note">SETTLED ' + esc(ev.source) + ' · '
      + esc(String(ev.wins)) + '/' + esc(String(ev.samples)) + ' wins · '
      + pct + '% hit · Wilson 95% CI ' + lo + '–' + hi + '%'
      + (tier === 'execute' ? ' · <b>meets execute bar</b>' : ' · below ' + (OG_EXEC_WILSON_LO * 100) + '% lower bound') + '</div>';
    h += '<div class="hg-mp-grid">';
    var mkt = fin(__og.spotAnchor);
    if (mkt > 0) h += '<div><i>MARKET</i><b>' + fmtPx(mkt) + '</b><u>live spot</u></div>';
    h += '<div><i>ENTRY</i><b>' + fmtPx(p.entry) + '</b><u>limit</u></div>';
    h += '<div><i>STOP</i><b>' + fmtPx(p.stop) + '</b><u>invalidation</u></div>';
    h += '<div><i>T1</i><b>' + fmtPx(p.t1) + '</b><u>' + esc(hgOgTargetReadout(Object.assign({ dir: c.dir }, p), c.horizon) || 'target') + '</u></div>';
    h += '</div>';
    h += '<div class="row" style="margin-top:8px">'
      + '<button type="button" class="btn og-xm-send" data-og-key="' + esc(ogTradeKey(c)) + '">SEND TICKET TO XM</button>'
      + '</div></div>';
    return h;
  }

  function hgOgRegimeWatchPanelHtml(regime){
    if (!regime) regime = { regime: 'NORMAL', dxyValue: NaN, correlation: NaN, beta: NaN, realRate: NaN, reason: '' };
    var h = '<section class="hg-mp og-regime-watch" data-og-regime="1" aria-label="Regime watch">';
    h += '<div class="hg-mp-eye">REGIME WATCH · CORRELATION TRACKING</div>';
    h += '<div class="hg-mp-head">DXY-GOLD DYNAMICS '
      + '<span style="color:' + (regime.regime === 'NORMAL' ? 'var(--long,#16a34a)' : (regime.regime === 'DECOUPLING' ? 'var(--warn,#ca8a04)' : 'var(--short,#dc2626)'))
      + '"><b>' + esc(regime.regime) + '</b></span></div>';
    var items = [];
    if (isFinite(regime.dxyValue)) items.push('DXY: ' + regime.dxyValue.toFixed(1));
    if (isFinite(regime.correlation)) items.push('Corr: ' + regime.correlation.toFixed(2));
    if (isFinite(regime.beta)) items.push('Beta: ' + regime.beta.toFixed(2));
    if (isFinite(regime.realRate)) items.push('Real Rate: ' + regime.realRate.toFixed(1) + '%');
    if (items.length){
      h += '<div class="hg-mp-note"><b>Snapshot:</b> ' + esc(items.join(' · ')) + '</div>';
    }
    var alert = '';
    if (regime.regime === 'DECOUPLING'){
      alert = '⚠ DXY-gold correlation weakened — caution on shorts, prefer longs';
    } else if (regime.regime === 'EXTREME'){
      alert = '🚨 Real rate shock or extreme inverse — reduce all positions 40%';
    }
    if (alert){
      h += '<div class="hg-mp-note' + (regime.regime === 'EXTREME' ? ' warn' : '') + '">' + esc(alert) + '</div>';
    }
    if (regime.reason){
      h += '<div class="dim">' + esc(regime.reason) + '</div>';
    }
    h += '</section>';
    return h;
  }

  function hgOgPaintRegimeWatch(ui, regime){
    var host = ui && ui.regime;
    if (!host) return;
    try { host.innerHTML = hgOgRegimeWatchPanelHtml(regime); }
    catch (eR){ host.innerHTML = ''; }
  }

  function hgOgSettledExecutePanelHtml(bag){
    bag = bag || { execute: [], best: [], minLo: OG_EXEC_WILSON_LO, minN: OG_EXEC_MIN_N };
    var h = '<section class="hg-mp og-settled-exec-panel" data-og-settled="1" aria-label="Settled execute setups">';
    h += '<div class="hg-mp-eye">SETTLED EXECUTE · 95% BAR</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>TICKET + forward settled evidence · Wilson lower ≥ '
      + (bag.minLo * 100).toFixed(0) + '% · min ' + bag.minN + ' trades</span></div>';
    if (bag.execute && bag.execute.length){
      h += '<div class="hg-mp-note">These cleared the full ledger <b>and</b> their mechanic\'s settled TICKET record meets the bar. Not a forecast — measured on trades this desk already cleared.</div>';
      var ei;
      for (ei = 0; ei < bag.execute.length; ei++) h += hgOgSettledExecuteRowHtml(bag.execute[ei], 'execute');
    } else {
      h += '<div class="hg-mp-note warn">No setup meets TICKET + ' + bag.minN + ' settled forward tickets + Wilson 95% lower bound ≥ '
        + (bag.minLo * 100).toFixed(0) + '%. Even 15/15 wins only yields ~80% Wilson lower — you need roughly <b>80+ cleared wins</b> at near-perfect rate. '
        + 'Gold in-sample grids peak near ~54% hit, so this bar is intentionally rare. '
        + 'Use <b>GOLD SCALP / GOLD SWING</b> for 7/7 grade-A setups, or keep scanning to build the forward log below.</div>';
      if (bag.best && bag.best.length){
        h += '<div class="hg-mp-note">Best <b>available</b> settled edge on current TICKETs (still below the execute bar):</div>';
        var bi;
        for (bi = 0; bi < bag.best.length; bi++) h += hgOgSettledExecuteRowHtml(bag.best[bi], 'best');
      }
    }
    h += '<div class="hg-mp-note dim">Also check SCORECARD → BY LANE → gold for your booked LOG history. OMNIGOLD forward log grows each scan — run regularly to settle mechanics.</div>';
    h += '</section>';
    return h;
  }

  /* ==================== rolling confidence UI ==================== */

  function hgOgRollingConfidencePanelHtml(stats){
    if (!stats) return '';
    var h = '<section class="hg-mp og-rolling-panel" data-og-rolling="1" aria-label="Rolling performance">';
    h += '<div class="hg-mp-eye">ROLLING CONFIDENCE</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>settled trades · last 20, 100 · timezone breakdown</span></div>';

    /* Last 20/100 hit rates */
    var last20Hit = (stats.last20 && stats.last20.n > 0) ? (stats.last20.w / stats.last20.n * 100).toFixed(1) : '—';
    var last100Hit = (stats.last100 && stats.last100.n > 0) ? (stats.last100.w / stats.last100.n * 100).toFixed(1) : '—';

    h += '<div class="hg-mp-grid">';
    h += '<div><i>LAST 20</i><b>' + esc(last20Hit === '—' ? '—' : last20Hit + '%') + '</b>'
      + '<u>' + esc(String(stats.last20.w || 0)) + '/' + esc(String(stats.last20.n || 0)) + ' wins</u></div>';
    h += '<div><i>LAST 100</i><b>' + esc(last100Hit === '—' ? '—' : last100Hit + '%') + '</b>'
      + '<u>' + esc(String(stats.last100.w || 0)) + '/' + esc(String(stats.last100.n || 0)) + ' wins</u></div>';
    h += '</div>';

    /* Today vs baseline */
    if (isFinite(stats.todayHitRate) || isFinite(stats.baselineHitRate)){
      var todayPct = isFinite(stats.todayHitRate) ? (stats.todayHitRate * 100).toFixed(1) : '—';
      var baselinePct = isFinite(stats.baselineHitRate) ? (stats.baselineHitRate * 100).toFixed(1) : '—';
      var diff = isFinite(stats.todayHitRate) && isFinite(stats.baselineHitRate)
        ? (stats.todayHitRate - stats.baselineHitRate) * 100 : NaN;
      var bgStyle = '';
      if (isFinite(diff)){
        if (diff > 5) bgStyle = ' style="border-left:3px solid var(--ok,#16a34a);padding-left:10px"';  /* Green: today > baseline + 5pp */
        else if (diff < -5) bgStyle = ' style="border-left:3px solid var(--err,#dc2626);padding-left:10px"';  /* Red: today < baseline - 5pp */
      }

      h += '<div class="hg-mp-note"' + bgStyle + '>';
      h += '<b>TODAY</b> ' + esc(todayPct === '—' ? '—' : todayPct + '%')
        + (isFinite(diff) ? ' ' + (diff > 0 ? '+' : '') + esc(diff.toFixed(1)) + 'pp' : '');
      h += ' vs <b>30D BASELINE</b> ' + esc(baselinePct === '—' ? '—' : baselinePct + '%');
      h += '</div>';
    }

    /* Timezone breakdown */
    if (stats.byTimezone){
      h += '<div class="hg-mp-note" style="margin-top:8px"><b>BY TIMEZONE (last 100):</b>';
      ['asia', 'london', 'ny'].forEach(function(tz){
        var tzStats = stats.byTimezone[tz];
        if (!tzStats || !(tzStats.n > 0)) return;
        var tzHit = (tzStats.w / tzStats.n * 100).toFixed(1);
        var tzLabel = tz === 'asia' ? 'ASIA' : (tz === 'london' ? 'LONDON' : 'NY');
        h += ' · ' + esc(tzLabel) + ' ' + esc(tzStats.w) + '/' + esc(tzStats.n)
          + ' (' + esc(tzHit) + '%)';
      });
      h += '</div>';
    }

    h += '</section>';
    return h;
  }

  function hgOgPaintSettledExecute(ui, bag){
    var host = ui && ui.settledExec;
    if (!host) return;
    try { host.innerHTML = hgOgSettledExecutePanelHtml(bag); }
    catch (eSe){ host.innerHTML = ''; }
  }

  function hgOgBridgeToVerdictCand(setup, label){
    if (!setup || !setup.dir) return null;
    if (!(isFinite(fin(setup.entry)) && isFinite(fin(setup.stop)) && isFinite(fin(setup.t1)))) return null;
    var gradeA = (setup.grade === 'A' || setup.grade === 'clean' || setup.locked);
    return {
      horizon: 'SCALP',
      kind: String(setup.stratKey || setup.strategy || 'GOLD-ENGINE').toUpperCase(),
      dir: setup.dir,
      plan: { entry: fin(setup.entry), stop: fin(setup.stop), t1: fin(setup.t1),
              t2: isFinite(fin(setup.t2)) ? fin(setup.t2) : undefined },
      grade: { ticket: gradeA },
      engineSrc: label || 'gold-engine'
    };
  }

  function hgOgCollectScalpVerdictCandidates(ranked, bridge){
    var out = [], seen = {}, i, c, key;
    for (i = 0; i < (ranked || []).length; i++){
      c = ranked[i];
      if (!c || String(c.horizon || '').toUpperCase() !== 'SCALP') continue;
      if (!(c.grade && c.grade.ticket) || !c.plan) continue;
      /* not-FORMED (hg-v533): the scalp verdict never argues from a card
         the desk stood aside on */
      if (c.formation && c.formation.formed === false) continue;
      key = ogTradeKey(c);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(c);
    }
    if (bridge && bridge.ok && bridge.scalp){
      var picks = [];
      if (bridge.scalp.best) picks.push(bridge.scalp.best);
      var rankedSc = bridge.scalp.ranked || [];
      for (i = 0; i < Math.min(4, rankedSc.length); i++){
        if (rankedSc[i] && rankedSc[i] !== bridge.scalp.best) picks.push(rankedSc[i]);
      }
      for (i = 0; i < picks.length; i++){
        c = hgOgBridgeToVerdictCand(picks[i], 'GOLDSCALP engine');
        if (!c || !(c.grade && c.grade.ticket)) continue;
        /* bridge setups carry no stamp — run FORMATION live (hg-v533);
           a throwing check is a fail-closed skip, and the setup stays
           visible on the engines panel row */
        var vf = null;
        try { vf = hgOgFormation(c); } catch (eVf){ vf = { formed: false }; }
        if (vf && vf.formed === false) continue;
        key = ogTradeKey(c);
        if (seen[key]) continue;
        seen[key] = true;
        out.push(c);
      }
    }
    return out;
  }

  function hgOgPickScalpVerdict(ranked, bridge, tapeDir){
    tapeDir = String(tapeDir || '').toLowerCase();
    var pool = [], verdict = [], i, c, ev;
    var cands = hgOgCollectScalpVerdictCandidates(ranked, bridge);
    for (i = 0; i < cands.length; i++){
      c = cands[i];
      if (tapeDir === 'long' || tapeDir === 'short'){
        if (String(c.dir || '').toLowerCase() !== tapeDir) continue;
      }
      ev = hgOgSettledEvidence(c);
      c.verdictEv = ev;
      if (hgOgSettledExecuteOk(ev, OG_VERDICT_SCALP_LO, OG_VERDICT_MIN_N)) verdict.push(c);
      else if (ev && ev.wilson) pool.push(c);
    }
    verdict.sort(function(a, b){
      return (b.verdictEv.wilson.lo - a.verdictEv.wilson.lo)
          || (b.verdictEv.samples - a.verdictEv.samples);
    });
    pool.sort(function(a, b){
      return (b.verdictEv.wilson.lo - a.verdictEv.wilson.lo)
          || (b.verdictEv.samples - a.verdictEv.samples);
    });
    return {
      go: verdict[0] || null,
      alternates: verdict.slice(1, 3),
      bestBelow: pool.slice(0, 2),
      minLo: OG_VERDICT_SCALP_LO,
      minN: OG_VERDICT_MIN_N,
      tabs: OG_SCALP_FWD_TABS.slice()
    };
  }

  function hgOgScalpVerdictRowHtml(c, tier){
    var p = c.plan, ev = c.verdictEv || c.settledEv;
    var w = ev && ev.wilson;
    var pct = w ? (w.p * 100).toFixed(0) : '—';
    var lo = w ? (w.lo * 100).toFixed(0) : '—';
    var hi = w ? (w.hi * 100).toFixed(0) : '—';
    var src = c.engineSrc ? (' · ' + c.engineSrc) : '';
    var h = '<div class="og-verdict-row' + (tier === 'go' ? ' og-verdict-go' : '') + '">';
    h += '<div class="hg-mp-head">XAUUSD ' + esc(String(c.dir || '').toUpperCase())
      + ' <span>SCALP · ' + esc(c.kind) + src + '</span></div>';
    /* Cost-drag chip (ADDITIVE): heavy/fatal fee load on this stop. */
    var vCostChip = hgOgCostChipHtml(c);
    if (vCostChip) h += '<div style="margin-top:2px">' + vCostChip + '</div>';
    var confResult = hgOgAdvancedConfluenceScore(c);
    if (confResult !== null && confResult !== undefined){
      var confObj = typeof confResult === 'number' ? { confluenceScore: confResult } : confResult;
      if (confObj && isFinite(fin(confObj.confluenceScore || confObj.score))){
        var displayScore = fin(confObj.confluenceScore || confObj.score);
        /* Truth labels + cost quarantine (hg-v532): the renderer needs to
           know whether the score is the engine grade scalar and what the
           stop geometry is — a bare { confluenceScore } hid both. */
        h += hgOgRenderConfluenceBreakdown({
          confluenceScore: displayScore,
          confluenceFromGrade: (typeof confResult === 'number'),
          engineGrade: c.engineGrade, engineDemoted: c.engineDemoted,
          plan: c.plan, entry: c.entry, stop: c.stop
        });
      }
    }
    h += '<div class="hg-mp-note">SETTLED ' + esc(ev.source) + ' · '
      + esc(String(ev.wins)) + '/' + esc(String(ev.samples)) + ' wins · '
      + pct + '% hit · Wilson 95% CI ' + lo + '–' + hi + '%'
      + (tier === 'go' ? ' · <b>meets 90% verdict bar</b>' : ' · below 90% lower bound') + '</div>';
    h += '<div class="hg-mp-grid">';
    var mkt = fin(__og.spotAnchor);
    if (mkt > 0) h += '<div><i>MARKET</i><b>' + fmtPx(mkt) + '</b><u>live spot</u></div>';
    h += '<div><i>ENTRY</i><b>' + fmtPx(p.entry) + '</b><u>limit</u></div>';
    h += '<div><i>STOP</i><b>' + fmtPx(p.stop) + '</b><u>invalidation</u></div>';
    h += '<div><i>T1</i><b>' + fmtPx(p.t1) + '</b><u>' + esc(hgOgTargetReadout(Object.assign({ dir: c.dir }, p), 'SCALP') || 'target') + '</u></div>';
    h += '</div>';
    /* Replay evidence line (ADDITIVE): the mechanic's settled PAXG-replay
       record; '' for engine-bridged kinds with no n>=40 record. */
    h += hgOgReplayLineHtml(c.kind);
    /* replay-vs-venue honesty (hg-v533) */
    h += hgOgVenueCostNoteHtml();
    if (tier === 'go' && !c.engineSrc){
      h += '<div class="row" style="margin-top:8px">'
        + '<button type="button" class="btn og-xm-send" data-og-key="' + esc(ogTradeKey(c)) + '">SEND TICKET TO XM</button>'
        + '</div>';
    }
    h += '</div>';
    return h;
  }

  function hgOgScalpVerdictPanelHtml(bag){
    bag = bag || { go: null, alternates: [], bestBelow: [], minLo: OG_VERDICT_SCALP_LO, minN: OG_VERDICT_MIN_N };
    var h = '<section class="hg-mp og-scalp-verdict" data-og-verdict="1" aria-label="Scalp verdict">';
    h += '<div class="hg-mp-eye">SCALP VERDICT · 90% SETTLED</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>pooled TICKET history · '
      + (bag.tabs ? bag.tabs.join(' + ') : OG_SCALP_FWD_TABS.join(' + '))
      + ' + scorecard gold · Wilson lower ≥ ' + (bag.minLo * 100).toFixed(0)
      + '% · min ' + bag.minN + ' settled</span></div>';
    if (bag.go){
      h += '<div class="hg-mp-note" style="border-left:3px solid var(--long,#16a34a);padding-left:10px">'
        + '<b>VERDICT: GO</b> — this scalp setup\'s settled TICKET record across gold desks clears the 90% bar. '
        + 'Measured on trades already cleared, not a win-probability forecast.</div>';
      h += hgOgScalpVerdictRowHtml(bag.go, 'go');
      if (bag.alternates && bag.alternates.length){
        h += '<div class="hg-mp-note">Also cleared the bar:</div>';
        var ai;
        for (ai = 0; ai < bag.alternates.length; ai++) h += hgOgScalpVerdictRowHtml(bag.alternates[ai], 'go');
      }
    } else {
      h += '<div class="hg-mp-note warn"><b>VERDICT: NO GO</b> — no current scalp setup (OMNIGOLD TICKET or GOLD SCALP engine grade-A) '
        + 'has ' + bag.minN + '+ settled TICKETs with Wilson 95% lower bound ≥ '
        + (bag.minLo * 100).toFixed(0) + '% across pooled gold forward logs. '
        + 'Run GOLD SCALP / SUPER GOLD regularly to build history; scorecard gold LOG also counts.</div>';
      if (bag.bestBelow && bag.bestBelow.length){
        h += '<div class="hg-mp-note">Best available settled edge on current scalp candidates (still below 90% lower bound):</div>';
        var bi;
        for (bi = 0; bi < bag.bestBelow.length; bi++) h += hgOgScalpVerdictRowHtml(bag.bestBelow[bi], 'below');
      }
    }
    h += '<div class="hg-mp-note dim">The 95% SETTLED EXECUTE panel below is a stricter tier. This verdict pools mechanic + desk-wide gold TICKET history so thin single-tab records still count when the combined log is strong.</div>';
    h += '</section>';
    return h;
  }

  function hgOgPaintScalpVerdict(ui, bag){
    var host = ui && ui.verdict;
    if (!host) return;
    try { host.innerHTML = hgOgScalpVerdictPanelHtml(bag); }
    catch (eV){ host.innerHTML = ''; }
  }

  /* ==================== scan coverage + gold-tab engines ==================== */

  function hgOgBuildScanCoverage(horizonRes){
    var cands = (horizonRes && horizonRes.cands) || [];
    var fired = {}, i, c, k;
    var tickets = 0, vetoes = 0;
    for (i = 0; i < cands.length; i++){
      c = cands[i];
      if (!c || !c.kind) continue;
      if (!fired[c.kind]) fired[c.kind] = { long: 0, short: 0, ticket: 0, veto: 0 };
      if (c.dir === 'long') fired[c.kind].long++;
      else if (c.dir === 'short') fired[c.kind].short++;
      if (c.grade && c.grade.ticket) { fired[c.kind].ticket++; tickets++; }
      else if (c.grade && c.grade.vetoes && c.grade.vetoes.length) { fired[c.kind].veto++; vetoes++; }
    }
    var firedKeys = Object.keys(fired).sort();
    var silent = [];
    for (i = 0; i < OG_MECHANICS.length; i++){
      k = OG_MECHANICS[i];
      if (!fired[k]) silent.push(k);
    }
    return {
      label: (horizonRes && horizonRes.cfg && horizonRes.cfg.label) || 'HORIZON',
      tf: (horizonRes && horizonRes.cfg && horizonRes.cfg.tf) || '',
      mechanicsTotal: OG_MECHANICS.length,
      fired: fired,
      firedKeys: firedKeys,
      firedCount: firedKeys.length,
      silent: silent,
      silentCount: silent.length,
      candidates: cands.length,
      tickets: tickets,
      vetoes: vetoes
    };
  }

  function hgOgScanCoveragePanelHtml(scalpCov, swingCov){
    scalpCov = scalpCov || {};
    swingCov = swingCov || {};
    var h = '<section class="hg-mp og-scan-coverage" data-og-coverage="1" aria-label="Scan coverage">';
    h += '<div class="hg-mp-eye">SCAN COVERAGE · ALL MECHANICS</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>every scan runs all ' + OG_MECHANICS.length
      + ' mechanics + ~34 indicator ledger checks per firing — quiet ≠ unwired</span></div>';
    h += '<div class="hg-mp-note">OMNIGOLD mechanics are detectors; the gold ledger grades each hit. '
      + 'Most bars fire few mechanics and veto most cards — that is the desk being strict, not strategies missing. '
      + 'GOLD SCALP/SWING tab engines run separately below on the same bars.</div>';
    [scalpCov, swingCov].forEach(function(cov){
      if (!cov || !cov.label) return;
      h += '<div class="hg-mp-note" style="margin-top:8px"><b>' + esc(cov.label) + ' (' + esc(cov.tf) + ')</b> · '
        + 'evaluated <b>' + cov.mechanicsTotal + '</b> mechanics · fired <b>' + cov.firedCount + '</b>'
        + ' · ' + cov.candidates + ' candidate(s) · <b>' + cov.tickets + '</b> TICKET'
        + ' · ' + cov.vetoes + ' VETO</div>';
      if (cov.firedKeys && cov.firedKeys.length){
        var parts = [], fi, fd;
        for (fi = 0; fi < cov.firedKeys.length; fi++){
          fd = cov.fired[ cov.firedKeys[fi] ];
          parts.push(cov.firedKeys[fi] + (fd.ticket ? ' ✓' : '') + ' ('
            + (fd.long ? fd.long + 'L' : '') + (fd.long && fd.short ? '/' : '') + (fd.short ? fd.short + 'S' : '') + ')');
        }
        h += '<div class="dim" style="margin:4px 0 0 12px">fired: ' + esc(parts.join(' · ')) + '</div>';
      } else {
        h += '<div class="dim" style="margin:4px 0 0 12px">fired: none this bar — detectors are meant to be quiet</div>';
      }
      if (cov.silentCount > 0 && cov.silentCount <= 12){
        h += '<div class="dim" style="margin:2px 0 0 12px">silent: ' + esc(cov.silent.join(', ')) + '</div>';
      } else if (cov.silentCount > 12){
        h += '<div class="dim" style="margin:2px 0 0 12px">silent: ' + cov.silentCount + ' mechanics (no trigger on this bar)</div>';
      }
    });
    h += '<div class="hg-mp-note dim">Indicator reads (ichimoku, stoch-rsi, ADX, Hurst, premium/discount, …) apply on every card via hgIndicatorGates — INFO gates argue; HARD gates veto.</div>';
    h += '</section>';
    return h;
  }

  function hgOgPaintScanCoverage(ui, scalpCov, swingCov){
    var host = ui && ui.coverage;
    if (!host) return;
    try {
      var html = hgOgScanCoveragePanelHtml(scalpCov, swingCov);
      var catFn = gfn('hgGoldCatalogEngine');
      var catHtml = gfn('hgGoldCatalogHtml');
      if (catFn && catHtml){
        try { html += catHtml(catFn([], {})); } catch (eCat) {}
      }
      host.innerHTML = html;
    }
    catch (eCov){ host.innerHTML = ''; }
  }

  function hgOgGoldEngineGradeOk(c, opts){
    opts = opts || {};
    if (!c || !c.dir || c.vetoed) return false;
    if (!(isFinite(fin(c.entry)) && isFinite(fin(c.stop)) && isFinite(fin(c.t1)))) return false;
    var g = String(c.grade || '').toUpperCase();
    if (c.locked || g === 'A' || g === 'CLEAN') return true;
    if (opts.allowB && g === 'B' && fin(c.tally) >= 5) return true;
    if (opts.allowC && g === 'C') return true;
    return false;
  }

  function hgOgEngineListHasAb(list){
    var i;
    for (i = 0; i < (list || []).length; i++){
      if (hgOgGoldEngineGradeOk(list[i], { allowB: true })) return true;
    }
    return false;
  }

  function hgOgEngineGradeBannerHtml(ranked){
    if (!ranked || !ranked.length || hgOgEngineListHasAb(ranked)) return '';
    var bestT = 0, i;
    for (i = 0; i < ranked.length; i++) bestT = Math.max(bestT, fin(ranked[i].tally) || 0);
    return '<div class="hg-mp-note warn" style="margin:4px 0 0 12px">No '
      + hgOgGradeChipHtml('A') + ' / ' + hgOgGradeChipHtml('B')
      + ' this bar — best tally +' + bestT + '. Grading: '
      + hgOgGradeLegendHtml()
      + '. More agreeing reads push tally up.</div>';
  }

  function hgOgApplyBridgeBestLevels(inp, scalpOut, swingOut){
    var applyBlFn = gfn('hgApplyGoldBestLevels');
    var postFn = gfn('hgGoldPostApplyRefresh');
    if (!applyBlFn) return;
    var m15 = (inp && inp.rows15m) || [];
    var atrFn = gfn('atr');
    var atrW = NaN;
    if (atrFn && m15.length >= 20){
      try {
        var aArr = atrFn(m15, 14);
        atrW = (aArr && aArr.length) ? fin(aArr[aArr.length - 1]) : NaN;
      } catch (eAtr){}
    }
    var nowMs = (inp && inp.now) || Date.now();
    var batches = [
      { out: scalpOut, style: 'gold-scalp', rows: m15, rows15m: m15,
        rows1h: inp.rows1h, rows4h: inp.rows4h },
      { out: swingOut, style: 'gold-swing', rows: (inp.rows4h || []),
        rows15m: m15, rows1h: inp.rows1h, rows4h: inp.rows4h }
    ];
    var bi, b, ri, gc, ranked;
    for (bi = 0; bi < batches.length; bi++){
      b = batches[bi];
      if (!b.out) continue;
      ranked = b.out.ranked || [];
      for (ri = 0; ri < ranked.length; ri++){
        gc = ranked[ri];
        if (!gc || gc.vetoed || gc.locked) continue;
        try {
          applyBlFn(gc, {
            style: b.style,
            rows: b.rows,
            rows15m: b.rows15m,
            rows1h: b.rows1h,
            rows4h: b.rows4h,
            atrW: atrW,
            nowMs: nowMs,
            rankBoost: (gc.agree || 0) + (gc.killzoneWeight || 0),
            vision: gc.vision
          });
          if (postFn){
            postFn(gc, {
              style: b.style,
              rows: b.rows,
              rows15m: b.rows15m,
              rows1h: b.rows1h,
              rows4h: b.rows4h
            });
          }
        } catch (eBl){}
      }
      if (b.out.best && ranked.indexOf(b.out.best) < 0 && !b.out.best.vetoed && !b.out.best.locked){
        try {
          applyBlFn(b.out.best, {
            style: b.style, rows: b.rows, rows15m: b.rows15m,
            rows1h: b.rows1h, rows4h: b.rows4h, atrW: atrW, nowMs: nowMs
          });
          if (postFn) postFn(b.out.best, { style: b.style, rows: b.rows, rows15m: b.rows15m,
            rows1h: b.rows1h, rows4h: b.rows4h });
        } catch (eBb){}
      }
      ranked = ranked.filter(function(x){ return x && !x.vetoed; });
      b.out.ranked = ranked;
      if (b.out.best && b.out.best.vetoed){
        b.out.best = ranked.length ? ranked[0] : null;
      } else if (!b.out.best && ranked.length){
        b.out.best = ranked[0];
      }
    }
  }

  function hgOgBridgeSetupToPick(setup, horizon){
    if (!setup || !setup.dir) return null;
    if (!(isFinite(fin(setup.entry)) && isFinite(fin(setup.stop)) && isFinite(fin(setup.t1)))) return null;
    var risk = Math.abs(fin(setup.entry) - fin(setup.stop));
    var rr1 = isFinite(fin(setup.rr)) ? fin(setup.rr)
      : (risk > 0 ? Math.abs(fin(setup.t1) - fin(setup.entry)) / risk : NaN);
    return {
      horizon: horizon,
      kind: String(setup.strategy || setup.stratKey || 'GOLD-ENGINE'),
      dir: setup.dir,
      stratKey: setup.stratKey || '',
      demoted: !!setup.demoted,
      plan: {
        entry: fin(setup.entry),
        stop: fin(setup.stop),
        t1: fin(setup.t1),
        t2: isFinite(fin(setup.t2)) ? fin(setup.t2) : undefined,
        rr1: rr1
      },
      grade: { ticket: false, evaluated: 0, total: 0, engine: true },
      enginePick: true,
      engineGrade: setup.grade,
      engineTally: setup.tally,
      engineSrc: (horizon === HORIZONS.swing.label) ? 'GOLD SWING tab' : 'GOLD SCALP tab',
      why: (setup.strategy || setup.stratKey || 'gold engine')
        + (setup.grade ? (' · grade ' + setup.grade) : '')
        + (isFinite(fin(setup.tally)) ? (' · tally +' + fin(setup.tally)) : '')
    };
  }

  function hgOgPickGoldEngineFor(bridge, horizon, tapeDir, opts){
    opts = opts || {};
    if (!bridge || !bridge.ok) return null;
    var bucket = (horizon === HORIZONS.swing.label) ? bridge.swing : bridge.scalp;
    if (!bucket) return null;
    tapeDir = String(tapeDir || '').toLowerCase();
    var ranked = (bucket.ranked || []).slice();
    if (bucket.best && ranked.indexOf(bucket.best) < 0) ranked.unshift(bucket.best);

    function poolFor(alignedOnly, gradeOpts){
      gradeOpts = gradeOpts || { allowB: true };
      var i, c, pool = [];
      for (i = 0; i < ranked.length; i++){
        c = ranked[i];
        if (!hgOgGoldEngineGradeOk(c, gradeOpts)) continue;
        /* EDGE DEMOTE / suppress from gold tabs never leads the ENGINE pick. */
        if (c.demoted || c.dropped) continue;
        /* FORMATION live-check (hg-v533): engine setups carry no stamp.
           A not-formed setup is never an engine pick — its row still
           renders (levelless) on the engines panel. Fail closed on throw. */
        var fm = null;
        try { fm = hgOgFormation(c); } catch (eFm){ fm = { formed: false }; }
        if (fm && fm.formed === false) continue;
        if (alignedOnly && (tapeDir === 'long' || tapeDir === 'short')){
          if (String(c.dir || '').toLowerCase() !== tapeDir) continue;
        }
        if (fm && fm.edgePrefer){ c.edgePrefer = true; c.edgeBoost = fm.edgeBoost; }
        pool.push(c);
      }
      if (!pool.length) return pool;
      pool.sort(function(a, b){
        var ga = String(a.grade || '').toUpperCase(), gb = String(b.grade || '').toUpperCase();
        if (ga === 'A' && gb !== 'A') return -1;
        if (gb === 'A' && ga !== 'A') return 1;
        if (ga === 'B' && gb === 'C') return -1;
        if (gb === 'B' && ga === 'C') return 1;
        if (a.demoted && !b.demoted) return 1;
        if (b.demoted && !a.demoted) return -1;
        /* Prefer fee-survivor ENGINE kinds (SWING sweep / weekly) over peers. */
        var ea = (a.edgePrefer || a.edgeBoost > 0) ? 1 : 0;
        var eb = (b.edgePrefer || b.edgeBoost > 0) ? 1 : 0;
        if (ea !== eb) return eb - ea;
        return (fin(b.tally) || 0) - (fin(a.tally) || 0);
      });
      return pool;
    }

    var gradeOpts = { allowB: true };
    if (opts.allowC) gradeOpts.allowC = true;
    var aligned = poolFor(true, gradeOpts);
    var pick = aligned[0] || null;
    var againstTape = false;
    if (!pick && opts.allowAgainstTape !== false){
      var any = poolFor(false, gradeOpts);
      pick = any[0] || null;
      if (pick && (tapeDir === 'long' || tapeDir === 'short')
          && String(pick.dir || '').toLowerCase() !== tapeDir) againstTape = true;
    }
    if (!pick) return null;
    var out = hgOgBridgeSetupToPick(pick, horizon);
    if (out){
      out.engineDemoted = !!pick.demoted;
      out.engineAgainstTape = againstTape;
      out.engineLowGrade = !!(opts.allowC && String(pick.grade || '').toUpperCase() === 'C');
    }
    return out;
  }

  function hgOgPickGoldEngineForMp(bridge, horizon, tapeDir){
    var ab = hgOgPickGoldEngineFor(bridge, horizon, tapeDir, { allowC: false });
    if (ab) return ab;
    return hgOgPickGoldEngineFor(bridge, horizon, tapeDir, { allowC: true });
  }

  function hgOgEngineSidesOk(c){
    var dir = String((c && c.dir) || '').toLowerCase();
    var e = fin(c && c.entry), s = fin(c && c.stop), t1 = fin(c && c.t1);
    if ((dir !== 'long' && dir !== 'short') || !isFinite(e) || !isFinite(s)) return false;
    var fn = gfn('hgGoldPlanSidesOk');
    if (fn){
      try{
        var r = fn(c);
        return !!(r && r.ok);
      }catch(eS){}
    }
    if (dir === 'short') return (s > e) && (!isFinite(t1) || t1 < e);
    return (s < e) && (!isFinite(t1) || t1 > e);
  }

  /* Catalog ENTRY / STOP / T1 already on the engine row. Never invents
     missing levels. notFormed = print the plan, label it not a ticket. */
  function hgOgEngineLevelsGridHtml(c, opts){
    opts = opts || {};
    if (!c || !hgOgEngineSidesOk(c)) return '';
    var h = '<div class="hg-mp-grid" data-og-engine-levels="' + (opts.notFormed ? 'plan' : '1') + '">';
    h += '<div><i>ENTRY</i><b>' + fmtPx(c.entry) + '</b></div>';
    h += '<div><i>STOP</i><b>' + fmtPx(c.stop) + '</b></div>';
    h += '<div><i>T1</i><b>' + fmtPx(c.t1) + '</b></div>';
    if (isFinite(fin(c.t2))) h += '<div><i>T2</i><b>' + fmtPx(c.t2) + '</b></div>';
    if (isFinite(fin(c.rr))) h += '<div><i>R:R</i><b>' + fin(c.rr).toFixed(2) + '</b></div>';
    h += '</div>';
    if (opts.notFormed){
      h += '<div class="dim og-engine-plan-note">Engine plan — not a ticket, not bookable. '
        + 'Fees eat the stop; see MEASURED-NEGATIVE KINDS.</div>';
    }
    return h;
  }

  function hgOgGoldEngineRowHtml(c, tier, horizon){
    /* horizon is an ADDITIVE optional arg ('SCALP'/'SWING') — callers that
       omit it just lose the scalp cost-drag caution line, nothing else. */
    if (!c || !c.dir) return '';
    var h = '<div class="og-gold-engine-row' + (tier === 'best' ? ' og-gold-engine-best' : '') + '">';
    h += '<div class="hg-mp-head">XAUUSD ' + esc(String(c.dir).toUpperCase())
      + (c.grade ? (' ' + hgOgGradeChipHtml(c.grade, { large: true })) : '')
      + ' <span>' + esc(c.strategy || c.stratKey || 'SETUP') + '</span></div>';
    h += '<div class="hg-mp-note">'
      + (isFinite(fin(c.tally)) ? ('tally +' + fin(c.tally)) : '')
      + (c.demoted ? ' · demoted' : '')
      + (c.vetoed ? ' · vetoed' : '')
      + (c.formationScore ? (' · formation ' + fin(c.formationScore)) : '')
      + (tier === 'best' ? ' · <b>tab best</b>' : '') + '</div>';
    if (isFinite(fin(c.entry)) && isFinite(fin(c.stop))){
      /* FORMATION (hg-v533 / hg-v584): not-formed stays visible and still
         prints the catalog ENTRY / STOP / T1 so the reader can see the
         plan. It is labeled not a ticket / not bookable — never ENTER. */
      var rowFm = null;
      try { rowFm = hgOgFormation(c); } catch (eRf){ rowFm = { formed: false, reasons: ['formation check threw — fail closed'] }; }
      if (rowFm && rowFm.formed === false){
        h += '<div class="hg-mp-note warn og-engine-not-formed">did not FORM — '
          + esc((rowFm.reasons && rowFm.reasons.length) ? rowFm.reasons.join(' · ') : 'stood aside')
          + '. Engine plan below is the catalog levels — not a ticket, not bookable.</div>';
        h += hgOgEngineLevelsGridHtml(c, { notFormed: true });
        h += hgOgReplayLineHtml(c.strategy || c.stratKey);
        h += hgOgVenueCostNoteHtml();
        h += '</div>';
        return h;
      }
      h += hgOgEngineLevelsGridHtml(c, {});
      /* Replay evidence + cost drag (ADDITIVE) — only where entry+stop render. */
      var engCostChip = hgOgCostChipHtml(c);
      if (engCostChip) h += '<div style="margin-top:2px">' + engCostChip + hgOgVenueCostNoteHtml() + '</div>';
      h += hgOgReplayLineHtml(c.strategy || c.stratKey);
      h += hgOgEngineReplayLinesHtml(c, horizon);
    }
    h += '</div>';
    return h;
  }

  /* ================= APEX GOLD — GRADE-GATED SETUPS (ADDITIVE) =============
     The gold setups an elite, extremely selective trader would take, grounded
     ONLY in what this app has measured on the PAXG 1h replay
     (2026-03-15..08-29, n=7270 settled — HG_OG_REPLAY_EVIDENCE):
       1. ENGINE grade A/B only — the one selection ordering that held
          (A 54.3% WR n=70 vs B 36.1% vs C 34.8%, ~31% scan baseline) — taken
          from the REAL pick gate hgOgPickGoldEngineFor (tape-aligned per
          horizon), never demoted grades, never grade-C FORMING fallbacks.
       2. SWING geometry preferred — ENGINE:SWING was the only near-breakeven
          cohort (-0.06R net, PF 0.90); a SCALP pick qualifies ONLY when its
          cost tier is ok (0.26% PAXG round trip <= 0.125R of the stop),
          because ENGINE:SCALP was cost-dominated at -2.603R/trade net.
          A SWING pick rides its cohort through thin/heavy tiers (the cohort
          net already paid those fees) but a FATAL tier — the stop tighter
          than the fee, 'structurally unpayable' per hgOgCostDrag — blocks
          ANY horizon. Either cost failure shows as a labeled NEAR MISS,
          never a card; an unmeasurable cost fails closed to null.
       3. TAPE-ALIGNED — the pick's direction must agree with hgOgDeskTape;
          a MIXED/absent tape read means no APEX. Empty is a position.
       4. CONFLUENCE FLOOR — the real hgOgAdvancedConfluenceScore path must
          read >= 70 (STRONG), OR the grade is A (the grade already encodes
          the measured selection). Unscorable = fail closed.
       5. BANKING EXIT — both designs printed with the app's own measured
          line, plus the mechanic's replay record via hgOgReplayEvidence.
     No promised win rates anywhere — only stats the replay settled. */

  /* hgOgApexQualify(pick, horizon, tapeDir)
     -> null | { grade, horizon, quality, costTier, confluence, bank1R,
                 dir, kind, plan?, nearMiss? }
     pick is an hgOgPickGoldEngineFor output ({ plan, engineGrade, ... }).
     Null-safe: any degenerate input returns null, never a throw. */
  function hgOgApexQualify(pick, horizon, tapeDir){
    try{
      if (!pick || !pick.plan || typeof pick.plan !== 'object') return null;
      var entry = fin(pick.plan.entry), stop = fin(pick.plan.stop), t1 = fin(pick.plan.t1);
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1)) return null;
      if (!(Math.abs(entry - stop) > 0)) return null;
      var dir = String(pick.dir || '').toLowerCase();
      if (dir !== 'long' && dir !== 'short') return null;
      /* RULE 1 — grade gate. A/B only, never demoted, never the grade-C
         FORMING fallback (engineLowGrade). */
      var g = String(pick.engineGrade || '').toUpperCase();
      if (g !== 'A' && g !== 'B') return null;
      if (pick.engineDemoted || pick.engineLowGrade || pick.demoted) return null;
      /* FORMATION (hg-v533): defensive — the pick gate already filters, but
         APEX must never print what did not form. Fail closed on throw. */
      var apxFm = null;
      try { apxFm = hgOgFormation(pick); } catch (eApFm){ apxFm = { formed: false }; }
      if (apxFm && apxFm.formed === false) return null;
      /* RULE 3 — tape alignment. MIXED/absent tape = no APEX. */
      var tape = String(tapeDir || '').toLowerCase();
      if (tape !== 'long' && tape !== 'short') return null;
      if (dir !== tape || pick.engineAgainstTape) return null;
      /* RULE 4 — confluence floor via the real scorer. Engine picks come
         back as a scalar (grade-based path), cards as { score }. Fail
         closed when unscorable, unless the grade is A — grade A already
         encodes the measured selection edge. */
      var confRaw = null;
      try { confRaw = hgOgAdvancedConfluenceScore(pick); } catch (eConf){ confRaw = null; }
      var conf = fin(typeof confRaw === 'number' ? confRaw : (confRaw && confRaw.score));
      if (g !== 'A' && !(isFinite(conf) && conf >= 70)) return null;
      /* RULE 2 — horizon geometry. SWING rides the near-breakeven cohort
         through thin/heavy tiers (the cohort's net already paid those fees),
         but a FATAL tier — the fee over half of 1R, 'structurally unpayable'
         per hgOgCostDrag — blocks ANY horizon. SCALP additionally demands
         the ok tier (ENGINE:SCALP was cost-dominated). Unmeasurable cost on
         a cost-tiered tier = fail closed. */
      var hz = String(horizon || pick.horizon || '').toUpperCase();
      if (hz !== 'SCALP' && hz !== 'SWING') return null;
      var drag = hgOgCostDrag(pick);
      if (!drag) return null;
      var tier = drag.tier;
      var costFail = (hz === 'SCALP') ? (tier !== 'ok') : (tier === 'fatal');
      if (costFail){
        var why;
        if (hz === 'SCALP'){
          /* measured cohort drag, printed only when the record exists */
          var coh = hgOgReplayEvidence('ENGINE:SCALP');
          why = 'scalp cost drag' + ((coh && isFinite(fin(coh.avgNetR)))
            ? ' — replay: ' + coh.avgNetR.toFixed(1) + 'R/trade net'
            : ' — the replay cohort was cost-dominated');
        } else {
          why = 'a stop tighter than the fee — ' + drag.rtCostPct.toFixed(2)
            + '% RT is ' + drag.costR.toFixed(2) + 'R of 1R (' + tier + ' tier)';
        }
        return {
          grade: g, horizon: hz, quality: 'NEAR-MISS', costTier: tier,
          confluence: isFinite(conf) ? conf : null, bank1R: null,
          dir: dir, kind: String(pick.kind || ''),
          nearMiss: why
        };
      }
      /* +1R in the trade's own direction: one full risk unit past entry.
         2*entry - stop works for both sides (long stop below -> above). */
      var bank1R = entry + (entry - stop);
      return {
        grade: g, horizon: hz, quality: 'APEX', costTier: tier,
        confluence: isFinite(conf) ? conf : null, bank1R: bank1R,
        dir: dir, kind: String(pick.kind || ''),
        plan: { entry: entry, stop: stop, t1: t1 }
      };
    }catch(eApex){ return null; }
  }

  /* Cost chip for an APEX card — unlike hgOgCostChipHtml this prints ALL
     tiers, because on a grade-gated card the ok tier is the point. */
  function hgOgApexCostChipHtml(drag){
    if (!drag || !isFinite(fin(drag.costR))) return '';
    var cls = (drag.tier === 'ok') ? 'ok' : (drag.tier === 'thin') ? 'warn' : 'bad';
    return pill('COST ' + drag.costR.toFixed(2) + 'R of 1R — ' + drag.tier
      + ' (' + drag.rtCostPct.toFixed(2) + '% RT)', cls);
  }

  /* 'grade-A · replay 54% WR n=70 — mind the costs' — the grade's own
     settled record, nothing promised. '' when the grade has no record. */
  function hgOgApexGradeReplayLine(grade){
    var ev = hgOgReplayEvidence(grade);
    if (!ev || !isFinite(fin(ev.winRate))) return '';
    return '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">grade-'
      + esc(String(grade)) + ' · replay ' + (ev.winRate * 100).toFixed(0)
      + '% WR n=' + ev.n + ' — mind the costs</div>';
  }

  function hgOgApexCardHtml(q, pick, tapeDir){
    if (!q) return '';
    if (q.nearMiss){
      /* No tradable levels beyond what the engine rows below already show
         for this pick — APEX does not re-print a trade the costs ate. */
      return '<div class="hg-mp-note warn og-apex-nearmiss">near miss — '
        + esc(q.horizon) + ' ' + hgOgGradeChipHtml(q.grade)
        + ' ' + esc(String(q.dir || '').toUpperCase())
        + ' is tape-aligned but ' + esc(q.nearMiss)
        + '. Its levels stay on the engine row below.</div>';
    }
    if (!q.plan) return '';
    var entry = q.plan.entry, stop = q.plan.stop, t1 = q.plan.t1;
    var h = '<div class="og-gold-engine-row og-gold-engine-best og-apex-card">';
    h += '<div class="hg-mp-head">XAUUSD ' + esc(String(q.dir).toUpperCase())
      + ' ' + hgOgGradeChipHtml(q.grade, { large: true })
      + ' <span>' + esc(q.horizon + ' · ' + (q.kind || 'GOLD ENGINE')) + '</span></div>';
    h += hgOgApexGradeReplayLine(q.grade);
    h += '<div class="hg-mp-grid">'
      + '<div><i>ENTRY</i><b>' + fmtPx(entry) + '</b></div>'
      + '<div><i>STOP</i><b>' + fmtPx(stop) + '</b></div>'
      + '<div><i>1R BANK</i><b>' + fmtPx(q.bank1R) + '</b></div>'
      + '<div><i>T1</i><b>' + fmtPx(t1) + '</b></div>'
      + '</div>';
    /* BOTH exit designs, with the app's own measured banking line —
       reused verbatim from the SHADOW bank note in hg-forward.js. */
    h += '<div class="hg-mp-note">EXIT A — bank half at +1R (' + fmtPx(q.bank1R)
      + '), stop to breakeven (' + fmtPx(entry) + '), rest runs to T1 (' + fmtPx(t1) + '). '
      + 'EXIT B — full position to T1 (' + fmtPx(t1) + '), no partial.'
      + '<div class="dim" style="font-size:11px;margin-top:2px">in-sample, 48% of stopped gold scalps had first reached +1R</div></div>';
    h += hgOgReplayLineHtml(q.kind);
    var cohKey = (q.horizon === 'SWING') ? 'ENGINE:SWING' : 'ENGINE:SCALP';
    var coh = hgOgReplayEvidence(cohKey);
    if (coh && isFinite(fin(coh.avgNetR))){
      h += '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">cohort '
        + esc(cohKey) + ': ' + (coh.winRate * 100).toFixed(0) + '% WR, '
        + (coh.avgNetR >= 0 ? '+' : '') + coh.avgNetR.toFixed(2)
        + 'R net (n=' + coh.n + ') — settled replay, not a promise</div>';
    }
    var chip = hgOgApexCostChipHtml(hgOgCostDrag(pick));
    if (chip) h += '<div style="margin-top:2px">' + chip + '</div>';
    /* replay-vs-venue honesty (hg-v533): the cohort/replay lines above are
       PAXG-cost facts; the chip prices the ACTIVE venue. */
    h += hgOgVenueCostNoteHtml();
    h += '<div class="dim" style="font-size:11px;margin-top:2px">tape-aligned: pick '
      + esc(String(q.dir).toUpperCase()) + ' · gold tape ' + esc(hgOgTapeLabel(String(tapeDir || '').toLowerCase())) + '</div>';
    if (isFinite(fin(q.confluence)))
      h += '<div class="dim" style="font-size:11px;margin-top:2px">confluence '
        + fin(q.confluence).toFixed(0) + '/100 via engine-grade path'
        + (q.grade === 'A' ? ' (grade A clears the floor by selection)' : ' (floor 70)') + '</div>';
    h += '</div>';
    return h;
  }

  /* The APEX panel. tapeDir optional — falls back to the tab's own last
     desk-tape read (__og.tape.desk); no tape = honest empty state. */
  function hgOgApexPanelHtml(bridge, tapeDir){
    var tape = String(tapeDir || '').toLowerCase();
    if (tape !== 'long' && tape !== 'short'){
      try { tape = String((__og.tape && __og.tape.desk) || '').toLowerCase(); } catch (eTp){ tape = ''; }
    }
    var h = '<section class="hg-mp og-apex-gold" data-og-apex="1" aria-label="APEX gold grade-gated setups">';
    h += '<div class="hg-mp-eye">APEX GOLD — GRADE-GATED SETUPS</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>grade-A/B engine pick · tape-aligned · swing geometry (non-fatal costs) or ok-tier scalp · replay-measured stats only, not a win probability</span></div>';
    var cards = '', near = '';
    if (bridge && bridge.ok && (tape === 'long' || tape === 'short')){
      /* Swing first — the only near-breakeven cohort leads the tier. */
      var hzs = [HORIZONS.swing.label, HORIZONS.scalp.label], i, pick, q;
      for (i = 0; i < hzs.length; i++){
        pick = null;
        try {
          pick = hgOgPickGoldEngineFor(bridge, hzs[i], tape,
            { allowC: false, allowAgainstTape: false });
        } catch (ePk){ pick = null; }
        if (!pick) continue;
        q = hgOgApexQualify(pick, hzs[i], tape);
        if (!q) continue;
        if (q.nearMiss) near += hgOgApexCardHtml(q, pick, tape);
        else cards += hgOgApexCardHtml(q, pick, tape);
      }
    }
    h += cards + near;
    if (!cards){
      h += '<div class="hg-mp-note">no grade-A/B tape-aligned pick clears the APEX bar right now — the bar existing is the point.'
        + ((tape === 'long' || tape === 'short') ? ''
           : ' Gold tape reads UNREAD/MIXED — an unread tape is a stand-aside, not a coin flip.')
        + '</div>';
    }
    h += '</section>';
    return h;
  }
  /* ================= end APEX GOLD ========================================= */

  function hgOgGoldEnginesPanelHtml(bridge, tapeDir){
    bridge = bridge || {};
    /* APEX GOLD mounts at the head of the engines panel (ADDITIVE) —
       fail closed to plain engines panel if the apex block ever throws. */
    var apex = '';
    try { apex = hgOgApexPanelHtml(bridge, tapeDir); } catch (eApexPanel){ apex = ''; }
    var h = '<section class="hg-mp og-gold-engines" data-og-gold-engines="1" aria-label="Gold tab engines">';
    h += '<div class="hg-mp-eye">GOLD SCALP / SWING ENGINES</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>same multi-strategy catalog as GOLD SCALP + GOLD SWING tabs</span></div>';
    if (!bridge.ok){
      h += '<div class="hg-mp-note warn">' + esc(bridge.why || 'goldind.js / goldswing.js not loaded') + '</div></section>';
      return apex + h;
    }
    h += '<div class="hg-mp-note">Liquidity sweep, OB retest, FVG fill, session VWAP, EMA ribbon, Asian breakout, RSI divergence, swing structure — ranked with goldRankSetups + hgApplyGoldBestLevels when loaded. '
      + 'Grades: ' + hgOgGradeLegendHtml()
      + '. A/B surface in <b>MOST PROBABLE</b> first; '
      + hgOgGradeChipHtml('C', { large: true }) + ' shows as <b>FORMING</b> when nothing stronger cleared. '
      + 'Open <b>GOLD SCALP</b> / <b>GOLD SWING</b> for full cards and book handoff.</div>';
    var sc = bridge.scalp || {}, sw = bridge.swing || {};
    var scRanked = sc.ranked || [], swRanked = sw.ranked || [];
    h += '<div class="hg-mp-note" style="margin-top:8px"><b>GOLD SCALP engine</b> · ' + scRanked.length + ' setup(s)'
      + ((sc.rejected && sc.rejected.length) ? (' · ' + sc.rejected.length + ' rejected by quality gates') : '') + '</div>';
    if (sc.best) h += hgOgGoldEngineRowHtml(sc.best, 'best', 'SCALP');
    var si;
    for (si = 0; si < Math.min(3, scRanked.length); si++){
      if (scRanked[si] === sc.best) continue;
      h += hgOgGoldEngineRowHtml(scRanked[si], 'alt', 'SCALP');
    }
    if (!scRanked.length) h += '<div class="dim" style="margin-left:12px">no scalp strategy triggered on this bar</div>';
    else h += hgOgEngineGradeBannerHtml(scRanked);
    h += '<div class="hg-mp-note" style="margin-top:8px"><b>GOLD SWING engine</b> · ' + swRanked.length + ' setup(s)'
      + ((sw.rejected && sw.rejected.length) ? (' · ' + sw.rejected.length + ' rejected') : '') + '</div>';
    if (sw.best) h += hgOgGoldEngineRowHtml(sw.best, 'best', 'SWING');
    var wi;
    for (wi = 0; wi < Math.min(3, swRanked.length); wi++){
      if (swRanked[wi] === sw.best) continue;
      h += hgOgGoldEngineRowHtml(swRanked[wi], 'alt', 'SWING');
    }
    if (!swRanked.length) h += '<div class="dim" style="margin-left:12px">no swing strategy triggered on this bar</div>';
    else h += hgOgEngineGradeBannerHtml(swRanked);
    h += '</section>';
    return apex + h;
  }

  function hgOgRunGoldTabEngines(shared, scalpRows, swingRows){
    var setupsFn = gfn('goldScalpSetups');
    var swingFn = gfn('goldSwingSetups');
    if (!setupsFn && !swingFn){
      return Promise.resolve({ ok: false, why: 'goldScalpSetups / goldSwingSetups unavailable — load goldind.js + goldswing.js' });
    }
    /* Bound the extra 15m/1d fetch so MOST PROBABLE + GOLD ENGINES never
       stay blank while a slow/geo-blocked candle leg hangs the bridge. */
    var fetchP = Promise.all([
      Promise.resolve().then(function(){ return hgOgFetchRows('15m', 500); })
        .catch(function(){ return { rows: [] }; }),
      Promise.resolve().then(function(){ return hgOgFetchRows('1d', 400); })
        .catch(function(){ return { rows: [] }; })
    ]);
    var timed = Promise.race([
      fetchP,
      new Promise(function(resolve){
        setTimeout(function(){ resolve({ __timeout: true }); }, 8000);
      })
    ]);
    return timed.then(function(extra){
      if (extra && extra.__timeout){
        return { ok: false, why: 'GOLD SCALP/SWING engines timed out waiting for 15m/1d candles — cards still show OMNIGOLD native reads' };
      }
      var m15 = (extra[0] && extra[0].rows) || [];
      var d1 = (extra[1] && extra[1].rows) || [];
      var inp = {
        rows15m: m15,
        rows1h: scalpRows || [],
        rows4h: swingRows || [],
        rows1d: d1,
        now: Date.now(),
        macro: shared && shared.macro,
        news: shared && shared.news
      };
      var gpsFn = gfn('goldProState');
      if (gpsFn){ try { inp.goldPro = gpsFn(); } catch (eGp){} }
      var scalpOut = { ranked: [], best: null, rejected: [] };
      if (setupsFn){
        var got = setupsFn(inp);
        var cands = Array.isArray(got) ? got : [];
        var rankFn = gfn('goldRankSetups');
        var ctx = { now: inp.now, macro: inp.macro, goldPro: inp.goldPro,
                    crossVenue: gfn('goldCrossVenueMap') ? gfn('goldCrossVenueMap')(cands) : null };
        scalpOut = rankFn ? rankFn(cands, ctx) : { ranked: cands, best: cands[0] || null, rejected: [] };
        if (got && got.rejected) scalpOut.rejected = (scalpOut.rejected || []).concat(got.rejected);
      }
      var swingOut = swingFn ? swingFn(inp) : { ranked: [], best: null, rejected: [] };
      hgOgApplyBridgeBestLevels(inp, scalpOut, swingOut);
      var anchor = fin(__og.spotAnchor);
      if (anchor > 0){
        var swingRanked = swingOut.ranked || [];
        var alignList = (scalpOut.ranked || []).concat(swingRanked);
        var kline = (scalpRows && scalpRows.length) ? fin(scalpRows[scalpRows.length - 1].c) : NaN;
        if (isFinite(kline) && kline > 0){
          var ratio = anchor / kline;
          if (Math.abs(ratio - 1) * 100 >= 0.15){
            var ai, ac, keys = ['entry', 'stop', 't1', 't2'];
            for (ai = 0; ai < alignList.length; ai++){
              ac = alignList[ai];
              if (!ac) continue;
              for (var kj = 0; kj < keys.length; kj++){
                if (isFinite(fin(ac[keys[kj]]))) ac[keys[kj]] = fin(ac[keys[kj]]) * ratio;
              }
            }
          }
        }
      }
      return { ok: true, scalp: scalpOut, swing: swingOut };
    }).catch(function(err){
      return { ok: false, why: (err && err.message) || String(err) };
    });
  }

  function hgOgPaintGoldEngines(ui, bridge, tapeDir){
    /* tapeDir is ADDITIVE optional — omitted, the APEX head block falls
       back to the tab's stored desk-tape read; nothing else changes. */
    var host = ui && ui.goldEngines;
    if (!host) return;
      try {
        var formHtml = '';
        try {
          var fsFn = gfn('hgGoldFormingStack');
          var fhFn = gfn('hgGoldFormingStackHtml');
          if (fsFn && fhFn && __og && __og.lastRows){
            formHtml = fhFn(fsFn({
              rows15m: __og.lastRows.m15 || __og.lastRows.scalp || [],
              rows4h: __og.lastRows.swing || [],
              macro: __og.shared && __og.shared.macro,
              dxyRows: __og.shared && __og.shared.macro && __og.shared.macro.dxyRows,
              now: Date.now(),
              perpNative: __og.perpNative || null,
              oiRows: __og.perpNative && __og.perpNative.oi,
              fundingRows: __og.perpNative && __og.perpNative.funding
            }));
          }
        } catch (eForm) { formHtml = ''; }
        host.innerHTML = formHtml + hgOgGoldEnginesPanelHtml(bridge, tapeDir);
      }
    catch (eGe){ host.innerHTML = ''; }
  }

  function hgOgPaintOgPostScan(ui, res, shared, ogCollapsed, deskTape, bridgeIn){
    hgOgPaintScanCoverage(ui, hgOgBuildScanCoverage(res.scalp), hgOgBuildScanCoverage(res.swing));
    hgOgPaintSettledExecute(ui, hgOgPickSettledExecutes(ogCollapsed || [], deskTape));
    /* Paint regime watch panel with correlation data */
    hgOgPaintRegimeWatch(ui, __og.correlationRegime);
    /* Update rolling performance tracking */
    hgOgUpdateRollingStats();
    /* TOP SETUP + rolling confidence above MOST PROBABLE — replace-in-place
       (data-og-watch / data-og-rolling), never stacked on rescan. The TOP
       SETUP view is the SAME hgOgPickFor() winner MOST PROBABLE renders,
       frozen with the spot anchor it was judged against so the level-fresh
       re-check judges the same picture the ledger did. */
    try {
      __og.topSetupView = {
        pickScalp: hgOgPickFor(ogCollapsed || [], HORIZONS.scalp.label,
          (__og.tape && __og.tape.scalp) || deskTape),
        pickSwing: hgOgPickFor(ogCollapsed || [], HORIZONS.swing.label,
          (__og.tape && __og.tape.swing) || deskTape),
        tape: deskTape || null,
        held: __og.held || null,
        mkt: fin(__og.spotAnchor),
        at: Date.now()
      };
      hgOgPaintTopSetup(ui);
      var hostRc = (ui && ui.mp) || (ui && ui.cards);
      hgOgInjectSection(hostRc, 'data-og-rolling', hgOgRollingConfidencePanelHtml(__og.rollingStats));
    } catch (eRoll) {}
    var bridgeP = bridgeIn ? Promise.resolve(bridgeIn)
      : hgOgRunGoldTabEngines(shared, res.scalp.rows, res.swing.rows);
    return bridgeP.then(function(bridge){
      __og.bridge = bridge;
      hgOgPaintGoldEngines(ui, bridge, deskTape);
      hgOgPaintScalpVerdict(ui, hgOgPickScalpVerdict(ogCollapsed || [], bridge,
        (__og.tape && __og.tape.scalp) || deskTape));
    });
  }

  function hgOgMostProbablePanelHtml(pickScalp, pickSwing, tape, held, watchScalp, watchSwing, engineScalp, engineSwing, tapes){
    tape = String(tape || '').toLowerCase();
    var scalpT = (tapes && tapes.scalp != null) ? String(tapes.scalp).toLowerCase() : tape;
    var swingT = (tapes && tapes.swing != null) ? String(tapes.swing).toLowerCase() : tape;
    var anyTrade = (pickScalp && pickScalp.plan) || (pickSwing && pickSwing.plan);
    var anyWatch = (watchScalp && watchScalp.plan) || (watchSwing && watchSwing.plan);
    var anyEngine = (engineScalp && engineScalp.plan) || (engineSwing && engineSwing.plan);
    var tier = anyTrade ? 'clean'
      : (anyEngine
          ? (((engineScalp && engineScalp.engineLowGrade) || (engineSwing && engineSwing.engineLowGrade))
              ? 'forming' : 'engine')
          : 'forming');
    var note = anyTrade
      ? 'Balanced across mechanic families and indicator reads on gold\'s own tape. Tickets only. Not a win probability.'
      : (anyEngine
          ? ((engineScalp && engineScalp.engineLowGrade) || (engineSwing && engineSwing.engineLowGrade)
              ? 'No grade-A/B engine this bar — showing best <b>grade-C FORMING</b> setup from GOLD SCALP/SWING (tally below 5). Not a win probability.'
              : 'No OMNIGOLD TICKET cleared on this horizon — showing the best grade-A/B setup from <b>GOLD SCALP / GOLD SWING</b> engines. Demoted or against-tape engines are labeled honestly. Not a win probability.')
          : (anyWatch
          ? ('Gold tape reads ' + tape.toUpperCase()
             + ' — no ticket cleared; best WITH-tape level read below is gate-blocked (VETO). '
             + (held && held.n
                ? ('Against-tape tickets (' + held.n + ') stay in the HELD queue — not shown as setups. ')
                : '')
             + 'Hard refresh after a tape flip.')
          : hgOgMpNoneWhy(tape, held)));
    var h = '<section class="hg-mp" data-hg-mp="omnigold" data-og-mp="1" data-tier="' + tier + '" aria-label="Most probable gold setups">';
    h += '<div class="hg-mp-eye">MOST PROBABLE SETUPS</div>';
    h += '<div class="hg-mp-head">XAUUSD';
    if ((anyTrade || anyWatch) && (tape === 'long' || tape === 'short')) h += ' ' + tape.toUpperCase();
    h += ' <span>OMNIGOLD · ';
    if (!anyTrade && (tape === 'long' || tape === 'short')){
      h += 'gold tape ' + tape.toUpperCase() + ' · ';
      h += anyWatch ? 'with-tape veto · ' : 'stand aside · ';
    }
    h += 'strategies + indicators, balanced · not a win probability</span></div>';
    h += '<div class="hg-mp-note">' + esc(note) + '</div>';

    /* CONFLUENCE SPECTRUM LEGEND — truth-labeled (hg-v532). The header
       states the replay's finding ABOVE the cells; each cell's caption is
       the measured record ('Trade immediately' used to sit under a tier
       whose >=85 row does not exist and whose ordering ran backwards). */
    h += '<div style="margin:12px 0;padding:12px;border:1px solid var(--hr);border-radius:4px;background:var(--bg-muted,rgba(0,0,0,0.02))">';
    h += '<div style="font-weight:bold;margin-bottom:8px;color:var(--fg-muted,#666)">Confluence Rating Spectrum</div>';
    h += hgOgSpectrumTruthHeaderHtml();
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:0.85em">';
    h += hgOgSpectrumLegendCellsHtml();
    h += '</div>';
    /* Replay footnote (ADDITIVE): the OOS verdict on this very legend. */
    h += hgOgConfluenceFitNoteHtml();
    h += '</div>';
    h += hgOgMpHorizonHtml('SCALP', pickScalp, scalpT, watchScalp, held, engineScalp);
    h += hgOgMpHorizonHtml('SWING', pickSwing, swingT, watchSwing, held, engineSwing);
    h += '</section>';
    return h;
  }

  function hgOgCardAsUniformCand(c, horizon){
    if (!c || !c.plan) return null;
    var hz = String(c.horizon || '').toUpperCase();
    if (hz && hz !== String(horizon || '').toUpperCase()) return null;
    var letter = '';
    if (c.grade && c.grade.letter) letter = c.grade.letter;
    else if (c.grade && c.grade.ticket) letter = 'A';
    else letter = 'C';
    var fams = (c.consensus && (c.consensus.families || c.consensus.alsoKinds)) || [];
    return {
      dir: c.dir,
      entry: c.plan.entry,
      stop: c.plan.stop,
      t1: c.plan.t1,
      t2: c.plan.t2,
      grade: letter,
      strategy: c.kind,
      stratKey: c.kind,
      kind: c.kind,
      tally: c.consensus && c.consensus.score,
      demoted: !(c.grade && c.grade.ticket),
      dropped: !!(c.formation && c.formation.formed === false),
      confluence: Array.isArray(fams) ? fams : []
    };
  }

  function hgOgUniformCands(horizon){
    var out = [], i, r;
    var bridge = __og && __og.bridge;
    var bucket = (bridge && bridge.ok)
      ? ((String(horizon).toUpperCase() === 'SWING') ? bridge.swing : bridge.scalp)
      : null;
    if (bucket && bucket.best) out.push(bucket.best);
    var ranked = (bucket && bucket.ranked) || [];
    for (i = 0; i < ranked.length; i++) if (ranked[i]) out.push(ranked[i]);
    var cards = (__og && __og.uniformCards)
      || (__og && __og.lastView && __og.lastView.collapsed) || [];
    for (i = 0; i < cards.length; i++){
      r = hgOgCardAsUniformCand(cards[i], horizon);
      if (r) out.push(r);
    }
    return out;
  }

  function hgOgUniformLeadHtml(){
    try{
      var compose = gfn('hgGoldUniformCompose');
      var htmlFn = gfn('hgGoldUniformHtml');
      if (!compose || !htmlFn) return '';
      var tapes = (__og && __og.tape) || {};
      var rows = (__og && __og.lastRows) || {};
      return '<div data-hg-gold-uniform-desk="1" style="grid-column:1/-1;display:block;width:100%">';
        + htmlFn(compose(hgOgUniformCands('SCALP'), {
            horizon: 'SCALP', tape: tapes.scalp, rows: rows.scalp || rows.m15 || []
          }))
        + htmlFn(compose(hgOgUniformCands('SWING'), {
            horizon: 'SWING', tape: tapes.swing, rows: rows.swing || []
          }))
        + '</div>';
    }catch(e){ return ''; }
  }

  function hgOgPaintMostProbable(ui, pickScalp, pickSwing, tape, mpBag, held, watchScalp, watchSwing, engineScalp, engineSwing, tapes){
    var host = (ui && ui.mp) || (ui && ui.cards);
    if (!host) return;
    try {
      var wPin = W();
      if (wPin && typeof wPin.hgMpPin === 'function') wPin.hgMpPin('omnigold', mpBag || [], tape || null, host);
    } catch (eMp) {}
    try {
      var dual = hgOgMostProbablePanelHtml(pickScalp, pickSwing, tape, held, watchScalp, watchSwing, engineScalp, engineSwing, tapes);
      var oldMp = host.querySelector ? host.querySelector('[data-hg-mp]') : null;
      if (!dual) return;
      if (oldMp) oldMp.outerHTML = dual;
      else if (host.insertAdjacentHTML) host.insertAdjacentHTML('afterbegin', dual);
      else host.innerHTML = dual + (host.innerHTML || '');
    } catch (eDual) {}
    try {
      var uni = hgOgUniformLeadHtml();
      if (!uni) return;
      var oldUni = host.querySelector ? host.querySelector('[data-hg-gold-uniform-desk]') : null;
      if (oldUni) oldUni.outerHTML = uni;
      else if (host.insertAdjacentHTML) host.insertAdjacentHTML('afterbegin', uni);
      else host.innerHTML = uni + (host.innerHTML || '');
    } catch (eUni) {}
  }

  function hgOgMpRow(c){
    if (!c || !c.plan) return null;
    if (!(c.grade && c.grade.ticket)) return null;
    /* not-FORMED (hg-v533): never a MOST PROBABLE row */
    if (c.formation && c.formation.formed === false) return null;
    return {
      sym: 'XAUUSD',
      dir: c.dir,
      entry: c.plan.entry,
      stop: c.plan.stop,
      t1: c.plan.t1,
      t2: c.plan.t2,
      rr: c.plan.rr1,
      clean: true,
      confirmed: true,
      gatesPassed: (c.grade && c.grade.evaluated) || 0,
      gatesTotal: (c.grade && c.grade.total) || 0,
      venue: c.horizon,
      kind: c.kind,
      horizon: c.horizon,
      plan: c.plan,
      grade: c.grade,
      consensus: c.consensus
    };
  }

  /* Highest-ranked TICKET on one horizon, or null. Deliberately null rather
     than "the best of a bad lot": promoting a vetoed setup because it was the
     least-vetoed would defeat the entire ledger.

     Structural tickets win. If the only remaining ticket is a labelled
     volatility stop (runaway tape, no nearby pivot), take that rather than
     leave STRONGEST empty — empty is how the desk showed "no setup with
     ticket" while a with-trend continuation was the correct trade.

     Among those, prefer a level inside GOLD_NEAR_ATR of live gold, and
     among those the balanced score (families + indicators + coverage),
     with the closest print as the tie-break. A 100-point FVG is still a
     ticket on the list; it is not the first card when a sweep two points
     off the market already has matching entry/stop. Far tickets remain if
     nothing nearer survived. */
  function hgOgPickFor(ranked, horizon, tapeDir){
    if (!ranked || !ranked.length) return null;
    var i, c, structural = [], vol = [];
    for (i = 0; i < ranked.length; i++){
      c = ranked[i];
      if (!c || c.horizon !== horizon) continue;
      if (!(c.grade && c.grade.ticket)) continue;
      if (!c.plan) continue;              /* no levels means nothing to act on */
      /* not-FORMED (hg-v533): never a pick, whatever its grade says */
      if (c.formation && c.formation.formed === false) continue;
      if (c.plan.momentumStop === true) vol.push(c);
      else structural.push(c);
    }
    var pool = structural.length ? structural : vol;
    if (!pool.length) return null;
    tapeDir = String(tapeDir || '').toLowerCase();
    if (tapeDir === 'long' || tapeDir === 'short'){
      var aligned = [];
      for (i = 0; i < pool.length; i++){
        if (String(pool[i].dir || '').toLowerCase() === tapeDir) aligned.push(pool[i]);
      }
      /* Against-tape is not the setup. Do not invent the other side. */
      if (!aligned.length) return null;
      pool = aligned;
    }
    var near = [], anyDist = false;
    for (i = 0; i < pool.length; i++){
      if (isFinite(fin(pool[i].distAtr))){
        anyDist = true;
        if (pool[i].distAtr <= GOLD_NEAR_ATR) near.push(pool[i]);
      }
    }
    if (anyDist && near.length) pool = near;
    pool = pool.slice().sort(function(a, b){
      var sa = hgOgBalanceScore(a, tapeDir);
      var sb = hgOgBalanceScore(b, tapeDir);
      if (sb !== sa) return sb - sa;
      var da = isFinite(fin(a.distAtr)) ? a.distAtr : 99;
      var db = isFinite(fin(b.distAtr)) ? b.distAtr : 99;
      return da - db;
    });
    var picked = pool[0] || null;
    if (picked) picked.balance = hgOgBalanceParts(picked, tapeDir);
    return picked;
  }

  /* Best tape-ALIGNED setup with levels when no TICKET cleared — VETO/WATCH
     only, never against-tape. Shows SHORT reads when tape is down without
     promoting a blocked ticket to trade-ready. */
  function hgOgPickWatchFor(ranked, horizon, tapeDir){
    if (!ranked || !ranked.length) return null;
    tapeDir = String(tapeDir || '').toLowerCase();
    if (tapeDir !== 'long' && tapeDir !== 'short') return null;
    var i, c, structural = [], vol = [];
    for (i = 0; i < ranked.length; i++){
      c = ranked[i];
      if (!c || c.horizon !== horizon) continue;
      if (c.grade && c.grade.ticket) continue;
      if (!c.plan) continue;
      if (String(c.dir || '').toLowerCase() !== tapeDir) continue;
      /* not-FORMED (hg-v533): not even as a WATCH — it lives in the
         MEASURED-NEGATIVE section instead */
      if (c.formation && c.formation.formed === false) continue;
      if (c.plan.momentumStop === true) vol.push(c);
      else structural.push(c);
    }
    var pool = structural.length ? structural : vol;
    if (!pool.length) return null;
    var near = [], anyDist = false;
    for (i = 0; i < pool.length; i++){
      if (isFinite(fin(pool[i].distAtr))){
        anyDist = true;
        if (pool[i].distAtr <= GOLD_NEAR_ATR) near.push(pool[i]);
      }
    }
    /* A far limit level is not the desk's "most probable" read — stand aside
       instead of showing ORB @ 4633 when gold prints 4597. */
    if (anyDist && !near.length) return null;
    if (anyDist && near.length) pool = near;
    pool = pool.slice().sort(function(a, b){
      var sa = hgOgBalanceScore(a, tapeDir);
      var sb = hgOgBalanceScore(b, tapeDir);
      if (sb !== sa) return sb - sa;
      var da = isFinite(fin(a.distAtr)) ? a.distAtr : 99;
      var db = isFinite(fin(b.distAtr)) ? b.distAtr : 99;
      return da - db;
    });
    var picked = pool[0] || null;
    if (picked){
      picked.balance = hgOgBalanceParts(picked, tapeDir);
      picked.tapeWatch = true;
    }
    return picked;
  }

  function hgOgHeldQueueHtml(cards, tape){
    if (!cards || !cards.length) return '';
    tape = String(tape || '').toLowerCase();
    var side = (tape === 'short') ? 'LONG' : 'SHORT';
    var h = '<div class="note og-held-queue" style="margin-top:12px"><b>HELD AGAINST TAPE</b> — '
      + cards.length + ' cleared ' + side + ' ticket' + (cards.length === 1 ? '' : 's')
      + ' while gold tape reads ' + esc(tape.toUpperCase())
      + '. Not setups — they stay queued until the tape flips.<ul style="margin:8px 0 0 16px">';
    var ci;
    for (ci = 0; ci < cards.length; ci++){
      var hc = cards[ci];
      h += '<li class="dim">' + esc(hc.horizon + ' · ' + hc.kind + ' ' + String(hc.dir || '').toUpperCase());
      if (hc.plan) h += ' · ENTRY ' + fmtPx(hc.plan.entry) + ' · STOP ' + fmtPx(hc.plan.stop) + ' · T1 ' + fmtPx(hc.plan.t1);
      h += '</li>';
    }
    h += '</ul></div>';
    return h;
  }

  function setupCard(c){
    var ev = (c.grade.evaluated || 0), tot = (c.grade.total || 0);
    var badge = c.grade.ticket ? pill('TICKET','ok') : pill(c.grade.vetoes.length ? 'VETO' : 'WATCH', c.grade.vetoes.length ? 'bad' : '');
    if (tot) badge += ' ' + pill(ev + '/' + tot + ' checks', ev * 2 >= tot ? '' : 'bad');
    if (c.topPick) badge = pill('STRONGEST ' + c.horizon, 'pick') + ' ' + badge;
    else if (c.topWatch) badge = pill('WITH TAPE ' + c.horizon, 'warn') + ' ' + badge;
    var tapeNow = '';
    if (__og.tape){
      tapeNow = (__og.tape.desk === 'long' || __og.tape.desk === 'short')
        ? __og.tape.desk
        : ((c.horizon === HORIZONS.scalp.label) ? __og.tape.scalp : __og.tape.swing);
    }
    if (tapeNow === 'long' || tapeNow === 'short'){
      badge += ' ' + (String(c.dir).toLowerCase() === tapeNow
        ? pill('WITH GOLD TAPE', 'ok')
        : pill('AGAINST GOLD TAPE', 'bad'));
    }
    /* Risk sizing badge based on stack3 gates and held queue */
    var stack3Calc = (function(gs){
      var keep = { 'regime-fit':1, 'htf-confirm':1, 'hurst-regime':1 };
      var n = 0, j;
      for (j = 0; j < (gs || []).length; j++){
        if (gs[j] && keep[gs[j].key] && gs[j].pass === true) n++;
      }
      return n;
    })(c.gates);
    var heldCount = (__og && __og.held && isFinite(__og.held.n)) ? __og.held.n : 0;
    var riskBadge = hgOgRiskBadgeHtml(stack3Calc, heldCount);
    if (riskBadge) badge += ' ' + riskBadge;
    /* Regime badge: show if regime is DECOUPLING or EXTREME */
    var regime = __og.correlationRegime;
    if (regime && (regime.regime === 'DECOUPLING' || regime.regime === 'EXTREME')){
      var regimeBadgeColor = (regime.regime === 'DECOUPLING') ? 'warn' : 'bad';
      var regimeBadgeText = (regime.regime === 'DECOUPLING')
        ? 'Decoupling: prefer longs'
        : 'Extreme regime: reduce size';
      badge += ' ' + pill(regimeBadgeText, regimeBadgeColor);
    }
    /* Cost-drag chip (ADDITIVE): heavy/fatal fee load on this plan's stop.
       hgOgCostChipHtml is null-safe — no plan, no chip. */
    var costChip = hgOgCostChipHtml(c);
    if (costChip) badge += ' ' + costChip;
    /* replay-survivor tag (hg-v533): kind measured gross-POSITIVE at scale
       with a low fee load in the PAXG replay. A ranking tag, not a promise. */
    if (c.replaySurvivor || hgOgIsSurvivor(c.kind)) badge += ' ' + pill('replay-survivor', 'ok');
    var h = '<div class="card' + (c.topPick ? ' og-pick' : '') + (c.topWatch ? ' og-watch' : '') + '">';
    h += '<div class="ttl">GOLD · ' + esc(c.horizon) + ' · ' + esc(c.kind) + ' ' + esc(c.dir.toUpperCase()) + ' ' + badge + '</div>';
    var confResult = hgOgAdvancedConfluenceScore(c);
    if (confResult !== null && confResult !== undefined){
      var confObj = typeof confResult === 'number' ? { confluenceScore: confResult } : confResult;
      if (confObj && isFinite(fin(confObj.confluenceScore || confObj.score))){
        var displayScore = fin(confObj.confluenceScore || confObj.score);
        /* Truth labels + cost quarantine (hg-v532): pass the grade-scalar
           flag and the stop geometry through — see hgOgRenderConfluenceBreakdown. */
        h += hgOgRenderConfluenceBreakdown({
          confluenceScore: displayScore,
          confluenceFromGrade: (typeof confResult === 'number'),
          engineGrade: c.engineGrade, engineDemoted: c.engineDemoted,
          plan: c.plan, entry: c.entry, stop: c.stop
        });
      }
    }
    h += '<div class="dim">' + esc(c.why) + '</div>';
    /* the cross-horizon read — agreement is standing, disagreement is a
       warning the reader deserves before entering */
    if (c.horizonNote){
      h += '<div class="dim">' + pill(c.horizonAgree ? 'HORIZONS ALIGNED' : 'HORIZON CONFLICT', c.horizonAgree ? 'ok' : 'bad')
        +  ' ' + esc(c.horizonNote) + '</div>';
    }
    if (c.alsoKinds && c.alsoKinds.length){
      h += '<div class="dim">also fired here on identical levels: ' + esc(c.alsoKinds.join(', '))
        +  ' — ' + (c.alsoKinds.length + 1) + ' mechanics, one trade</div>';
    }
    if (c.topPick){
      /* What the pick is standing on, in words, so the colour is never the
         whole argument. */
      var basis = hgOgPickBasis(c), bi;
      h += '<div class="og-pick-why"><b>Strongest case on ' + esc(c.horizon)
        +  '</b> — ranked on the evidence the desk actually has:<ul>';
      for (bi = 0; bi < basis.length; bi++) h += '<li>' + esc(basis[bi]) + '</li>';
      h += '</ul><span class="dim">Strongest of what fired now. NOT a win probability: '
        +  'a probability needs a settled record, and this desk does not have one yet.</span></div>';
    }
    if (isFinite(fin(c.level))){
      h += '<div class="dim">SETUP ' + esc(c.kind) + ' @ ' + fmtPx(c.level)
        +  ((c.plan && isFinite(fin(c.plan.entry)) && Math.abs(c.plan.entry - c.level) > 0.05)
              ? (' · plan entry ' + fmtPx(c.plan.entry)) : '')
        +  '</div>';
    }
    if (c.plan){
      /* Apply regime scale factor to risk % display */
      var regimeScale = 1.0;
      if (__og.correlationRegime){
        regimeScale = hgOgRegimeScaleFactor(__og.correlationRegime.regime);
      }
      var displayRiskPct = fin(c.plan.riskPct) * regimeScale;
      h += '<div class="plan">ENTRY ' + fmtPx(c.plan.entry) + ' · STOP ' + fmtPx(c.plan.stop)
        +  ' · T1 ' + fmtPx(c.plan.t1) + ' · T2 ' + fmtPx(c.plan.t2)
        +  ' · <b>R:R ' + fmt(c.plan.rr1, 2) + '</b> · risk ' + fmt(displayRiskPct, 2) + '%'
        +  (regimeScale < 1.0 ? (' <span class="dim">(regime adj ' + (regimeScale * 100).toFixed(0) + '%)</span>') : '') + '</div>';
      /* Replay evidence line (ADDITIVE): the mechanic's settled PAXG-replay
         record, negative numbers included; '' when it has no n>=40 record. */
      h += hgOgReplayLineHtml(c.kind);
      /* venue-vs-replay honesty (hg-v533): cost figures on this card are
         venue-priced, the replay line above is a PAXG-cost fact. */
      h += hgOgVenueCostNoteHtml();
      /* UN-DEMOTED evidence (hg-v533): this kind is measured-negative in
         the replay, and it forms ONLY because its live forward ledger reads
         'has paid' — the reader sees both facts, not neither. */
      if (c.formation && c.formation.unDemoted){
        var ud = c.formation.unDemoted;
        h += '<div class="dim og-undemoted-line" style="font-size:11px;margin-top:2px">replay-demoted kind ('
          + esc((ud.demotion && ud.demotion.reasons) ? ud.demotion.reasons.join('; ') : 'measured negative at scale')
          + ') — UN-DEMOTED: live forward ledger reads \'has paid\' ('
          + esc(String((ud.forward && ud.forward.tab) || ''))
          + ', n=' + fin(ud.forward && ud.forward.samples)
          + ' settled, hit ' + (fin(ud.forward && ud.forward.hit) * 100).toFixed(0)
          + '%, +' + fin(ud.forward && ud.forward.z).toFixed(2) + 'σ past the family-wise bar)</div>';
      }
      var t1Note = hgOgTargetReadout(Object.assign({ dir: c.dir }, c.plan), c.horizon);
      if (t1Note) h += '<div class="dim og-t1-readout">' + esc(t1Note) + '</div>';
      var mktNote = hgOgEntryMarketNote(c, c.plan);
      if (mktNote) h += '<div class="dim og-market-note">' + esc(mktNote) + '</div>';
      var formScore = isFinite(fin(c.formationScore)) ? fin(c.formationScore)
                    : (c.plan && isFinite(fin(c.plan.formationScore)) ? fin(c.plan.formationScore) : NaN);
      if (c.plan.entryType || c.plan.stopWidened || c.plan.t1Source || isFinite(formScore)){
        h += '<div class="dim og-form-line">'
          + (c.plan.entryType ? esc(c.plan.entryType) : 'formed')
          + (c.plan.stopWidened ? ' · structure-wide stop' : '')
          + (c.plan.t1Source ? ' · T1 ' + esc(String(c.plan.t1Source)) : '')
          + (isFinite(fin(c.plan.t1Magnet)) ? (' @ ' + fmtPx(c.plan.t1Magnet)) : '')
          + (isFinite(formScore) ? ' · conviction ' + Math.round(formScore) : '')
          + (isFinite(fin(c.edgeScore)) ? ' · EDGE ' + Math.round(fin(c.edgeScore)) : '')
          + (c.plan.costDemote ? ' · cost demote' : '')
          + (c.plan.fillDemote ? ' · thin fill' : '')
          + '</div>';
      }
      if (c.plan.note) h += '<div class="dim">' + esc(c.plan.note) + '</div>';
      /* The same levels in the reader's instrument. Only when the factor is
         real and the basis is worth mentioning — a broker-bridge feed, a
         failed spot fetch, or a sub-0.05% basis all render nothing. */
      var sf = fin(__og.spotFactor);
      if (isFinite(sf) && sf > 0 && Math.abs(sf - 1) > 0.0005 && !c.spotAligned){
        h += '<div class="dim">&#8776; SPOT-EQUIVALENT (basis ' + ((sf - 1) >= 0 ? '+' : '')
          +  ((sf - 1) * 100).toFixed(2) + '% applied, R:R unchanged): '
          +  'ENTRY ' + fmtPx(c.plan.entry * sf) + ' · STOP ' + fmtPx(c.plan.stop * sf)
          +  ' · T1 ' + fmtPx(c.plan.t1 * sf)
          +  (isFinite(fin(c.plan.t2)) ? ' · T2 ' + fmtPx(c.plan.t2 * sf) : '') + '</div>';
      }
    } else {
      h += '<div class="dim">no plan — structure could not clear the R floor, so no levels are shown.</div>';
    }
    h += '<ul class="lst">';
    for (var i = 0; i < c.gates.length; i++) h += gateLine(c.gates[i]);
    h += '</ul>';
    if (c.grade && c.grade.ticket && c.plan){
      h += '<div class="row" style="margin-top:8px">'
        +  '<button type="button" class="btn og-xm-send" data-og-key="' + esc(ogTradeKey(c)) + '">SEND TICKET TO XM</button>'
        +  '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderPooled(pool, label, minRr, fwdTab){
    if (!pool) return '';
    var keys = OG_MECHANICS.slice();
    /* Forward (out-of-sample) counts for the same mechanics. These accumulate
       one record per firing across scans and are the only numbers here that
       are not re-read from the same window every time. */
    var fwdPool = null;
    var fwdFn = gfn('hgFwdPool');
    if (fwdFn && fwdTab){ try { fwdPool = fwdFn(fwdTab); } catch (e) { fwdPool = null; } }
    var h = '<h4>' + esc(label) + ' — measured on this horizon</h4>';
    h += '<table class="tbl"><thead><tr><th>MECHANIC</th><th>SAMPLES</th><th>T1-FIRST</th><th>EXPECTANCY</th><th>σ</th><th>READ</th><th>FORWARD</th></tr></thead><tbody>';
    var pBreak = 1 / (1 + minRr);
    for (var i = 0; i < keys.length; i++){
      var k = keys[i], p = pool[k];
      var fwd = fwdPool ? fwdPool[k] : null;
      var fwdTxt = fwdCell(fwd);
      if (!p || !p.samples){
        h += '<tr><td><b>' + k + '</b></td><td class="dim">0</td><td class="dim">—</td><td class="dim">—</td><td class="dim">—</td><td class="dim">never fired here</td><td>' + fwdTxt + '</td></tr>';
        continue;
      }
      /* Same shared verdict helper omniroute's table uses, so the two
         cannot drift apart in wording or in threshold. */
      var rd = (W() && typeof W().hgOmniPoolRead === 'function')
             /* Gold scans OG_MECHANICS.length mechanics — 48 since the gold
                indicator library was wired in — so its bar is its own, and it
                is read from the array rather than written down here, because a
                hard-coded count silently understates the correction the moment
                a mechanic is added. Passing none
                would judge a gold row against the crypto count. */
             ? W().hgOmniPoolRead(p, minRr, MIN_SAMPLES, hgOgFamilyZ(OG_MECHANICS.length))
             : { z: NaN, read: 'engine unavailable', need: null, cls: '' };
      var z = rd.z, read = rd.read, cls = rd.cls;
      /* Shared with omniroute, which already refuses to print a sample size
         nobody can act on. Raising the bar to the family-wise threshold made
         those numbers 2.2x larger, so the guard matters more, not less. */
      var needTxt = (W() && typeof W().hgOmniNeedText === 'function')
                  ? W().hgOmniNeedText(rd.need)
                  : (rd.need ? (' <span class="dim">(needs ~' + rd.need + ')</span>') : '');
      h += '<tr><td><b>' + k + '</b></td><td>' + p.samples + needTxt + '</td><td>' + (p.hit * 100).toFixed(0) + '%</td>'
        +  '<td>' + (p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R</td>'
        +  '<td>' + (z >= 0 ? '+' : '') + z.toFixed(2) + 'σ</td>'
        +  '<td>' + pill(read, cls) + '</td>'
        +  '<td>' + fwdTxt + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  /* Forward column. Deliberately terse: settled count, hit rate, and how many
     are still open. Until a mechanic has settled trades this reads "—", which
     is the honest state on day one — the log has to be fed by scans over time
     before it can say anything. */
  function fwdCell(f){
    if (!f || (!f.samples && !f.open && !f.stale)) return '<span class="dim">—</span>';
    /* STALE is shown apart from OPEN. A record whose bars were never going to
       arrive — the contract was delisted, renamed, or simply stopped being
       scanned — is not a trade still running, and counting the two together
       overstates how much evidence is still in flight. */
    var st = (f.stale > 0) ? (' <span class="dim">· ' + f.stale + ' stale</span>') : '';
    if (!f.samples) return '<span class="dim">' + (f.open || 0) + ' open</span>' + st;
    return '<b>' + f.samples + '</b> · ' + (f.hit * 100).toFixed(0) + '%'
         + (f.open ? (' <span class="dim">(+' + f.open + ' open)</span>') : '') + st;
  }

  /* THE DESK READ — one plain sentence on why the desk is quiet.

     "Why does it show the wrong setups?" was asked four times, and each time
     the answer was recoverable only by reading every gate on every card and
     tallying by hand. The status line named the top blocking GATE, but a gate
     name is a category; the reader needed the market condition it implies.

     Live example this was built from: gold +2.7% in 24h, STRONG TREND up.
     With-trend entries had no placeable stop — the nearest structure sat
     6.8xATR away because the rally never paused long enough to print a
     pivot — while every setup WITH placeable structure was a counter-trend
     fade, vetoed by policy. Eleven coherent cards, zero tickets, and no
     sentence anywhere saying that. This derives one from the cards already
     graded: no refetch, no recompute. */
  function hgOgDeskRead(ranked, rows){
    try {
      if (!ranked || !ranked.length) return '';
      var tally = {}, i, j, g;
      for (i = 0; i < ranked.length; i++){
        var vs = (ranked[i].grade && ranked[i].grade.vetoes) || [];
        for (j = 0; j < vs.length; j++) tally[vs[j]] = (tally[vs[j]] || 0) + 1;
      }
      var keys = Object.keys(tally).sort(function(a, b){ return tally[b] - tally[a]; });
      if (!keys.length) return '';
      var move = NaN;
      if (rows && rows.length > 25){
        var c0 = fin(rows[rows.length - 25].c), c1 = fin(rows[rows.length - 1].c);
        if (isFinite(c0) && isFinite(c1) && c0 > 0) move = (c1 / c0 - 1) * 100;
      }
      var moveTxt = isFinite(move)
        ? ('gold has moved ' + (move >= 0 ? '+' : '') + move.toFixed(1) + '% in 24 bars')
        : 'the tape';
      var PLAIN = {
        'plan-levels': 'price has run without pausing, so there is no nearby structure to stop against — with-trend entries cannot place a stop',
        'fade-strength': 'the only placeable setups fade a strong trend, and the desk stands fades aside against a running tape',
        'adr-budget': 'the day has already spent its range, so chasing continuation late is blocked',
        'consensus': "the desk's own mechanics point both ways, and a two-sided tape earns no ticket",
        'participation': 'the trigger bars are thin for this time of day',
        'trend': 'the setups that fired point against the prevailing EMA stack',
        'htf-daily': 'the setups that fired disagree with the daily stack',
        'news-window': 'a news blackout is standing the whole desk aside',
        'level-fresh': 'the market has moved past the levels the mechanics fired at — the plans are priced off bars the tape has left behind',
        'measured-edge': 'the mechanics that fired have measurably not paid here'
      };
      var parts = [], used = 0;
      for (i = 0; i < keys.length && used < 2; i++){
        if (PLAIN[keys[i]]){ parts.push(PLAIN[keys[i]]); used++; }
      }
      if (!parts.length) return '';
      return 'DESK READ: ' + moveTxt + ' — ' + parts.join('; ')
           + '. Standing aside IS the read; a consolidation that prints new structure changes it.';
    } catch (e){ return ''; }
  }

  /* ==================== the scan ==================== */

  function scanHorizon(cfg, shared, ui){
    var w = W();
    var dropFn = (w && typeof w.hgOmniDropForming === 'function') ? w.hgOmniDropForming : null;
    var dailyFn = (w && typeof w.hgOmniDailyHtf === 'function') ? w.hgOmniDailyHtf : null;
    var btFn = (w && typeof w.hgOmniBacktestOne === 'function') ? w.hgOmniBacktestOne : null;
    var poolFn = (w && typeof w.hgOmniPoolStats === 'function') ? w.hgOmniPoolStats : null;

    if (ui) ui.stat.textContent = 'fetching gold ' + cfg.tf + ' bars…';
    return hgOgFetchRows(cfg.tf, cfg.bars).then(function(got){
      var rows = got.rows || [];
      /* Sanitise before anything reads a bar. dropFn (omniroute's) now does
         this too, but it is feature-checked — without it gold would ingest a
         hole-punched array straight into the detectors, and a venue dropping
         one candle would take the whole horizon down. A hole in the data is a
         data problem, not something each detector should have to guard. */
      var okRows = [], ri, rr;
      for (ri = 0; ri < rows.length; ri++){
        rr = rows[ri];
        if (!rr || typeof rr !== 'object') continue;
        /* fin(), NOT num(): num(null) is 0 because +null is 0, which would
           admit a null close as the price zero. */
        if (!isFinite(fin(rr.c))) continue;
        okRows.push(rr);
      }
      rows = okRows;
      var livePx = rows.length ? fin(rows[rows.length - 1].c) : NaN;
      if (dropFn) rows = dropFn(rows, cfg.tf);        // closed candles only
      if (!rows.length) return { cfg: cfg, rows: [], source: got.source, cands: [], pooled: null, livePx: NaN };

      /* walk-forward every mechanic on THIS horizon */
      var stats = {}, pooled = null;
      if (btFn){
        var fns = {
          SPRING: function(r){ var g = w.hgOmniRange ? w.hgOmniRange(r, 40) : null; return g && w.hgOmniSpring ? w.hgOmniSpring(r, g) : null; },
          PO3:    function(r){ return w.hgOmniPo3 ? w.hgOmniPo3(r, 6) : null; },
          ORB:    function(r){ return w.hgOmniOrb ? w.hgOmniOrb(r, 3) : null; },
          ABSORB: function(r){ var g = w.hgOmniRange ? w.hgOmniRange(r, 40) : null; return g && w.hgOmniAbsorb ? w.hgOmniAbsorb(r, g) : null; },
          VALUE:  function(r){ var p = w.hgOmniProfile ? w.hgOmniProfile(r, 24) : null; return p && w.hgOmniValueReject ? w.hgOmniValueReject(r, p) : null; },
          MMOVE:  function(r){ return w.hgOmniMeasuredMove ? w.hgOmniMeasuredMove(r, 10) : null; },
          'ASIA-BREAK':   function(r){ var a = hgOgAsiaRange(r); return a ? hgOgAsiaBreak(r, a) : null; },
          'KZ-JUDAS':     function(r){ var a = hgOgAsiaRange(r); return a ? hgOgKzJudas(r, a, gfn('goldKillzone')) : null; },
          'ADR-FADE':     function(r){ var a = hgOgAdr(r, 14); return a ? hgOgAdrFade(r, a) : null; },
          'ROUND-MAGNET': function(r){ return hgOgRoundMagnet(r); },
          'PDH-SWEEP':    function(r){ var p = hgOgPrevDay(r); var h = p ? hgOgPdSweep(r, p) : null; return (h && h.kind === 'PDH-SWEEP') ? h : null; },
          'PDL-SWEEP':    function(r){ var p = hgOgPrevDay(r); var h = p ? hgOgPdSweep(r, p) : null; return (h && h.kind === 'PDL-SWEEP') ? h : null; },
          'LONDON-FIX':   function(r){ return hgOgLondonFix(r); },
          'VWAP-REVERT':  function(r){ return hgOgVwapRevert(r); },
          'NR7-BREAK':    function(r){ return hgOgNr7Break(r); },
          'SMT-DIVERGE':  function(r){ return hgOgSmtDiverge(r); },
          'TREND-RECLAIM':function(r){ return hgOgTrendReclaim(r); },
          'PWH-SWEEP':    function(r){ var q = hgOgPrevWeek(r); var h = q ? hgOgPwSweep(r, q) : null; return (h && h.kind === 'PWH-SWEEP') ? h : null; },
          'PWL-SWEEP':    function(r){ var q = hgOgPrevWeek(r); var h = q ? hgOgPwSweep(r, q) : null; return (h && h.kind === 'PWL-SWEEP') ? h : null; },
          'FVG-FILL':     function(r){ return hgOgFvgFill(r); },
          'BOS-RETEST':   function(r){ return hgOgBosRetest(r); },
          'EQH-SWEEP':    function(r){ var h = hgOgPoolSweep(r); return (h && h.kind === 'EQH-SWEEP') ? h : null; },
          'EQL-SWEEP':    function(r){ var h = hgOgPoolSweep(r); return (h && h.kind === 'EQL-SWEEP') ? h : null; },
          'SQUEEZE-FIRE': function(r){ return hgOgSqueezeFire(r); },
          'RSI-DIVERGE':  function(r){ return hgOgRsiDiverge(r); },
          'GSR-EXTREME':  function(r){ return hgOgGsrExtreme(r); },
          'AVWAP-RECLAIM':function(r){ return hgOgAvwapReclaim(r); },
          'CUSUM-SHIFT':  function(r){ return hgOgCusumShift(r); },
          'VOL-EXPANSION':function(r){ return hgOgVolExpansion(r); },
          'PIN-REJECT':   function(r){ return hgOgPinReject(r); },
          'ENGULF-LEVEL': function(r){ return hgOgEngulfLevel(r); },
          'POC-REVERT':   function(r){ return hgOgPocRevert(r); },
          'COINT-SPREAD': function(r){ return hgOgCointSpread(r); },
          'THREE-BAR':    function(r){ return hgOgThreeBar(r); },
          'NY-OPEN-DRIVE':function(r){ return hgOgNyOpenDrive(r); },
          'WEEKLY-OPEN':  function(r){ return hgOgWeeklyOpen(r); },
          'PIVOT-REJECT': function(r){ return hgOgPivotReject(r); },
          'INSIDE-BREAK': function(r){ return hgOgInsideBreak(r); },
          'EMA50-HOLD':   function(r){ return hgOgEma50Hold(r); },
          'FIB-618':      function(r){ return hgOgFib618(r); },
          /* round six. Each is the same pure function the live pass calls,
             so the in-sample record and the live firing cannot diverge. */
          'ICHI-KUMO':       function(r){ return hgOgIchiKumo(r); },
          'STOCHRSI-TURN':   function(r){ return hgOgStochTurn(r); },
          'CCI-EXTREME':     function(r){ return hgOgCciExtreme(r); },
          'RIBBON-PULLBACK': function(r){ return hgOgRibbonPullback(r); },
          'HA-FLIP':         function(r){ return hgOgHaFlip(r); },
          'VWAP-BAND':       function(r){ return hgOgVwapBand(r); },
          'PD-EQUILIBRIUM':  function(r){ return hgOgPdEquilibrium(r); },
          'ER-IGNITION':     function(r){ return hgOgErIgnition(r); },
          'STRUCT-BOS':      function(r){ return hgOgStructBos(r); },
          'SWEEP-V2':        function(r){ return hgOgSweepV2(r); },
          'OB-RETEST':       function(r){ return hgOgObRetest(r); },
          'OU-REVERT':       function(r){ return hgOgOuRevert(r); },
          'MFI-SQUAT':       function(r){ return hgOgMfiSquat(r); },
          'DI-CROSS':        function(r){ return hgOgDiCross(r); },
          'FVG-HVN':         function(r){ return hgOgFvgHvn(r); },
          'VP-PLAYBOOK':     function(r){ return hgOgVpPlaybook(r); },
          'P4-NR7':          function(r){ return hgOgPart4ByKind(r, 'P4-NR7'); },
          'P4-ADRX':         function(r){ return hgOgPart4ByKind(r, 'P4-ADRX'); },
          'P4-LAF':          function(r){ return hgOgPart4ByKind(r, 'P4-LAF'); },
          'P5-WYCK':         function(r){ return hgOgPart5ByKind(r, 'P5-WYCK'); },
          'P5-TURT':         function(r){ return hgOgPart5ByKind(r, 'P5-TURT'); },
          'P5-VWAP':         function(r){ return hgOgPart5ByKind(r, 'P5-VWAP'); },
          'P5-DRIVE':        function(r){ return hgOgPart5ByKind(r, 'P5-DRIVE'); },
          'P5-NEWS':         function(r){ return hgOgPart5ByKind(r, 'P5-NEWS'); },
          'P6-COMP':         function(r){ return hgOgPart6ByKind(r, 'P6-COMP'); },
          'P6-ZFADE':        function(r){ return hgOgPart6ByKind(r, 'P6-ZFADE'); },
          'P6-SMT':          function(r){ return hgOgPart6ByKind(r, 'P6-SMT'); },
          'P6-FAIL':         function(r){ return hgOgPart6ByKind(r, 'P6-FAIL'); },
          'P7-SCALP':        function(r){ return hgOgPart7ByKind(r, 'P7-SCALP'); },
          'P7-RATIO':        function(r){ return hgOgPart7ByKind(r, 'P7-RATIO'); },
          'P8-RESID':        function(r){ return hgOgPart8ByKind(r, 'P8-RESID'); },
          'P8-RANGE':        function(r){ return hgOgPart8ByKind(r, 'P8-RANGE'); },
          'P8-GEO':          function(r){ return hgOgPart8ByKind(r, 'P8-GEO'); },
          'P8-VPINBO':       function(r){ return hgOgPart8ByKind(r, 'P8-VPINBO'); },
          'P9-VOLBAR':       function(r){ return hgOgPart9ByKind(r, 'P9-VOLBAR'); },
          'P9-PREM':         function(r){ return hgOgPart9ByKind(r, 'P9-PREM'); }
        };
        var k;
        for (k in fns) if (Object.prototype.hasOwnProperty.call(fns, k)){
          stats[k] = btFn(rows, fns[k], { rMult: OG_T1_R, horizon: cfg.horizonBars, warm: cfg.warm });
        }
        /* OG_T1_R, the multiple T1 is actually placed at — the same one the
           walk-forward above measured with. Passing cfg.minRr here priced
           SCALP expectancy at a 1.5R the plan never targets. */
        pooled = poolFn ? poolFn([stats], OG_T1_R) : stats;
      }

      /* Settle any forward records this symbol has open, using the bars just
         fetched. Done BEFORE recording the current firing, so a setup can
         never be settled by the bar it was written on. */
      var fwdResolve = gfn('hgFwdResolve');
      /* tf is passed as null on purpose: settle EVERY open XAUUSD record, not
         only ones from this horizon. GOLD SWING, GOLD SCALP and GOLD PRO all
         record against XAUUSD, and a user who runs only one gold tab should
         still see their records resolve. Settling a 4h record with 1h bars is
         FINER, not coarser; the reverse is conservative under the "one bar
         spanning both counts as a stop" rule. Both directions are safe. */
      if (fwdResolve){
        try { fwdResolve('XAUUSD', null, rows); }
        catch (e) { var wf = gfn('hgFwdWarn'); if (wf) { try { wf('omnigold:resolve', e); } catch (eW) {} } }
      }

      var hits = hgOgDetect(rows, { nowSec: shared.nowSec });
      /* the anticipation zones, computed once per horizon and handed to the
         ledger so zone-anchor can place every mechanic against real
         structure (best-effort: an absent engine reads UNCHECKED) */
      var zoneCtx = null;
      var opFn2 = gfn('opAssess');
      var mktPx = (shared.liveSpotPx > 0) ? fin(shared.liveSpotPx) : NaN;
      var zonePx = (mktPx > 0) ? mktPx : livePx;
      if (opFn2){
        try { zoneCtx = opFn2(rows, zonePx, hgOgZoneLevels(rows, zonePx)); } catch (eZc){ zoneCtx = null; }
      }
      var extra = {
        htf: dailyFn ? dailyFn(rows) : null,
        killzone: shared.killzone, macro: shared.macro,
        yieldRows: shared.yieldRows || null,
        nowSec: shared.nowSec,
        adr: hgOgAdr(rows, 14), news: shared.news, stats: pooled,
        livePx: livePx, marketPx: mktPx, zoneCtx: zoneCtx,
        /* for the spot-basis gate: the tokenised print, and which feed the
           desk itself is on (so it does not price PAXG against PAXG) */
        paxg: shared.paxg, srcId: got.source,
        sessionHard: cfg.sessionHard,
        rows4h: (cfg.tf === '4h') ? rows : (shared.rows4h || null),
        rows1d: shared.rows1d || null,
        dxyRows: (shared.macro && (shared.macro.dxyRows || shared.macro.dxyCandles)) || null,
        tnxRows: shared.yieldRows || (shared.macro && (shared.macro.tnxRows || shared.macro.us10yCandles)) || null,
        quote: shared.quote || null,
        l2: shared.l2 || null,
        spreadUsd: shared.spreadUsd,
        bid: shared.bid,
        ask: shared.ask
      };
      function runEval(){
        extra.rows4h = extra.rows4h || shared.rows4h || ((cfg.tf === '4h') ? rows : null);
        extra.rows1d = extra.rows1d || shared.rows1d || null;
        extra.quote = extra.quote || shared.quote || null;
        extra.l2 = extra.l2 || shared.l2 || null;
        extra.bid = extra.bid != null ? extra.bid : shared.bid;
        extra.ask = extra.ask != null ? extra.ask : shared.ask;
        extra.spreadUsd = extra.spreadUsd != null ? extra.spreadUsd : shared.spreadUsd;
        var cands = hgOgEvaluate(rows, hits, extra, cfg);

        /* Record every firing that carries a plan — not only tickets. The
           in-sample pool measures the raw mechanic, so the forward pool must
           measure the same thing or the two cannot be compared. The ticket flag
           rides along so the gates can be judged separately later. */
        var fwdRecord = gfn('hgFwdRecord');
        if (fwdRecord && rows.length){
          var barT = num(rows[rows.length - 1].t);
          for (var ci = 0; ci < cands.length; ci++){
            var c = cands[ci];
            if (!c.plan) continue;
            try {
              fwdRecord({
                tab: 'OMNIGOLD:' + cfg.label, mechanic: c.kind, sym: 'XAUUSD', tf: cfg.tf,
                dir: c.dir, entry: c.plan.entry, stop: c.plan.stop, t1: c.plan.t1,
                barT: barT, horizonBars: cfg.horizonBars, ticket: !!(c.grade && c.grade.ticket),
                /* The A/B/C chip this setup wore when it fired. Written now so
                   the forward panel can judge the chips rather than trust them:
                   the grade counts CONFLUENCE, and confluence has never been
                   shown to predict outcome on gold. c.grade is the gate ledger's
                   object, so the letter comes off the engine bridge instead. */
                grade: c.engineGrade || (c.grade && c.grade.letter) || hgOgConfluenceGrade(c) || '',
                /* the three gates that replicated on both horizons — recorded so
                   the in-sample 45%-at-2R swing result earns an out-of-sample
                   verdict rather than being traded on faith */
                stack3: (function(gs){
                  var keep = { 'regime-fit':1, 'htf-confirm':1, 'hurst-regime':1 };
                  var n = 0, j;
                  for (j = 0; j < (gs || []).length; j++){
                    if (gs[j] && keep[gs[j].key] && gs[j].pass === true) n++;
                  }
                  return n;
                })(c.gates)
              });
            } catch (e) { var wr = gfn('hgFwdWarn'); if (wr) { try { wr('omnigold:record', e); } catch (eW) {} } }
          }
        }
        return { cfg: cfg, rows: rows, source: got.source, cands: cands, pooled: pooled, livePx: livePx };
      }
      if (shared && shared.htfP) return shared.htfP.then(runEval);
      return runEval();
    }).catch(function(){
      return { cfg: cfg, rows: [], source: null, cands: [], pooled: null };
    });
  }

  function ogSafeStat(ui, msg){
    try{ if (ui && ui.stat) ui.stat.textContent = msg; }catch(e){}
  }

  function ogRememberPaint(ui){
    try { if (ui && ui.cards) __og.lastCardsHtml = ui.cards.innerHTML; } catch (eC) {}
    try { if (ui && ui.pool) __og.lastPoolHtml = ui.pool.innerHTML; } catch (eP) {}
    try { if (ui && ui.mp) __og.lastMpHtml = ui.mp.innerHTML; } catch (eM) {}
    try { if (ui && ui.verdict) __og.lastVerdictHtml = ui.verdict.innerHTML; } catch (eV) {}
    try { if (ui && ui.settledExec) __og.lastSettledExecHtml = ui.settledExec.innerHTML; } catch (eSe) {}
    try { if (ui && ui.coverage) __og.lastCoverageHtml = ui.coverage.innerHTML; } catch (eCo) {}
    try { if (ui && ui.goldEngines) __og.lastGoldEnginesHtml = ui.goldEngines.innerHTML; } catch (eGe) {}
  }

  function ogKeepLast(ui, why){
    try {
      if (ui && ui.cards && __og.lastCardsHtml) ui.cards.innerHTML = __og.lastCardsHtml;
    } catch (eC) {}
    try {
      if (ui && ui.pool && __og.lastPoolHtml != null) ui.pool.innerHTML = __og.lastPoolHtml;
    } catch (eP) {}
    try {
      if (ui && ui.mp && __og.lastMpHtml != null) ui.mp.innerHTML = __og.lastMpHtml;
    } catch (eM) {}
    try {
      if (ui && ui.verdict && __og.lastVerdictHtml != null) ui.verdict.innerHTML = __og.lastVerdictHtml;
    } catch (eV) {}
    try {
      if (ui && ui.settledExec && __og.lastSettledExecHtml != null) ui.settledExec.innerHTML = __og.lastSettledExecHtml;
    } catch (eSe) {}
    try {
      if (ui && ui.coverage && __og.lastCoverageHtml != null) ui.coverage.innerHTML = __og.lastCoverageHtml;
    } catch (eCo) {}
    try {
      if (ui && ui.goldEngines && __og.lastGoldEnginesHtml != null) ui.goldEngines.innerHTML = __og.lastGoldEnginesHtml;
    } catch (eGe) {}
    if (__og.lastStat) ogSafeStat(ui, __og.lastStat);
    try {
      if (ui && ui.warn){
        ui.warn.textContent = 'scan failed — keeping last results. ' + String(why || '');
        ui.warn.style.display = 'block';
      }
    } catch (eW) {}
  }

  function runScan(ui){
    if (__og.busy) return Promise.resolve();
    var w = W();
    if (!w || typeof w.hgOmniDetect !== 'function'){
      ui.stat.textContent = 'omniroute.js engine unavailable — OMNIGOLD builds on it; load order problem.';
      return Promise.resolve();
    }
    __og.busy = true;
    __og.spotFactor = NaN;
    __og.spotAnchor = NaN;
    ui.btn.disabled = true;
    /* Never blank a finished desk to start a rescan. A failed fetch or render
       used to leave that blank standing — the last snapshot was still in
       memory and the reader saw only the error. */
    if (!__og.lastCardsHtml){
      try { ui.cards.innerHTML = ''; } catch (eClr) {}
      try { ui.pool.innerHTML = ''; } catch (eClr2) {}
      try { if (ui.mp) ui.mp.innerHTML = ''; } catch (eClr3) {}
      try { if (ui.settledExec) ui.settledExec.innerHTML = ''; } catch (eClr4) {}
      try { if (ui.verdict) ui.verdict.innerHTML = ''; } catch (eClr5) {}
      try { if (ui.coverage) ui.coverage.innerHTML = ''; } catch (eClr6) {}
      try { if (ui.goldEngines) ui.goldEngines.innerHTML = ''; } catch (eClr7) {}
      ogSafeStat(ui, 'reading macro + session context…');
    } else {
      ogSafeStat(ui, 'rescanning… previous results still showing');
    }

    /* market-wide context, fetched once for both horizons */
    var macroFn = gfn('getGoldMacro') || gfn('getGoldMacroCached');
    var shared = { killzone: null, macro: null, yieldRows: null, nowSec: Date.now() / 1000, news: null,
                   liveSpotPx: NaN,
                   /* ONE extra request per scan, shared by both horizons, for the
                      spot-basis gate. NaN on any failure or timeout — the gate
                      then reads "no PAXG print this scan" rather than waiting or
                      inventing a parity. */
                   paxg: NaN,
                   rows4h: null, rows1d: null, quote: null, l2: null };
    try { var kz = gfn('goldKillzone'); if (kz) shared.killzone = kz(Date.now()); } catch (e) {}
    try { var nr = gfn('hgNewsRisk'); if (nr) shared.news = nr('XAUUSD'); } catch (e) {}
    try {
      var qw = W();
      if (qw){
        if (qw.__hgGoldQuote) shared.quote = qw.__hgGoldQuote;
        if (qw.__hgGoldL2Book) shared.l2 = qw.__hgGoldL2Book;
        if (qw.__hgGoldQuote && qw.__hgGoldQuote.bid != null) shared.bid = qw.__hgGoldQuote.bid;
        if (qw.__hgGoldQuote && qw.__hgGoldQuote.ask != null) shared.ask = qw.__hgGoldQuote.ask;
      }
    } catch (eQ) {}
    /* HTF for the MTF matrix. Fail-open if these miss; do not block the scan. */
    shared.htfP = Promise.all([
      hgOgFetchRows('4h', 400).catch(function(){ return { rows: [] }; }),
      hgOgFetchRows('1d', 260).catch(function(){ return { rows: [] }; })
    ]).then(function(htf){
      shared.rows4h = (htf[0] && htf[0].rows) || [];
      shared.rows1d = (htf[1] && htf[1].rows) || [];
    }).catch(function(){});
    __og.shared = shared;

    return Promise.resolve()
      .then(function(){ return macroFn ? macroFn() : null; })
      .catch(function(){ return null; })
      .then(function(m){
        shared.macro = m || null;
        shared.yieldRows = (m && m.us10yRows) ? m.us10yRows : null;
        shared.nowSec = Date.now() / 1000;
        /* Delta OI/funding + Fed FOMC calendar — bounded, fail-open */
        return Promise.race([
          Promise.all([
            Promise.resolve().then(function(){
              var lp = gfn('hgGoldLoadDeltaPerp');
              return lp ? lp({ symbol: 'XAUTUSD', resolution: '1h' }) : null;
            }).catch(function(){ return null; }),
            Promise.resolve().then(function(){
              var lf = gfn('hgGoldLoadFedCalendar');
              return lf ? lf() : null;
            }).catch(function(){ return null; })
          ]).then(function(pair){
            __og.perpNative = pair[0] || null;
            shared.perpNative = __og.perpNative;
            var mergeF = gfn('hgGoldMergeFedFomc');
            if (mergeF && pair[1] && pair[1].ok){
              shared.news = mergeF(shared.news || {}, pair[1]);
            }
          }),
          new Promise(function(r){ setTimeout(r, 8000); })
        ]).then(function(){
        return hgOgResolveLiveSpot(NaN).then(function(sp){
          if (isFinite(sp) && sp > 0) shared.liveSpotPx = sp;
          return Promise.race([
          Promise.resolve().then(function(){
            var bkFn = gfn('binanceKlines');
            return bkFn ? bkFn('PAXGUSDT', '1h', 2) : null;
          }).catch(function(){ return null; }),
          new Promise(function(rp){ setTimeout(function(){ rp(null); }, 2500); })
        ]).then(function(pk){
          try {
            if (pk && pk.length) shared.paxg = fin(pk[pk.length - 1].c);
          } catch (ePk){ shared.paxg = NaN; }
          return scanHorizon(HORIZONS.scalp, shared, ui);
        });
        });
        });
      })
      .then(function(scalp){
        return scanHorizon(HORIZONS.swing, shared, ui).then(function(swing){
          return { scalp: scalp, swing: swing };
        });
      })
      .then(async function(res){
        var rankFn = (w && typeof w.hgOmniRank === 'function') ? w.hgOmniRank : function(a){ return a; };
        var all = (res.scalp.cands || []).concat(res.swing.cands || []);
        /* HORIZON AGREEMENT — a scalp aligned with the swing horizon's read
           is a different trade from one fighting it, and until now the two
           scans never looked at each other. A chip, not a gate: each
           horizon's ledger was graded before the other existed, and an
           honest ledger is not edited after the fact. */
        (function(){
          var dirsOf = function(cands){
            var d = { long: [], short: [] }, i2, c2;
            for (i2 = 0; i2 < (cands || []).length; i2++){
              c2 = cands[i2];
              if (c2 && (c2.dir === 'long' || c2.dir === 'short') && d[c2.dir].indexOf(c2.kind) < 0) d[c2.dir].push(c2.kind);
            }
            return d;
          };
          var scalpD = dirsOf(res.scalp.cands), swingD = dirsOf(res.swing.cands);
          var mark2 = function(cands, other, otherLabel){
            for (var i3 = 0; i3 < (cands || []).length; i3++){
              var c3 = cands[i3];
              if (!c3 || (c3.dir !== 'long' && c3.dir !== 'short')) continue;
              var withMe = other[c3.dir], against = other[c3.dir === 'long' ? 'short' : 'long'];
              if (withMe.length){
                c3.horizonNote = otherLabel + ' horizon agrees (' + withMe.slice(0, 3).join(', ') + ')';
                c3.horizonAgree = true;
              } else if (against.length){
                c3.horizonNote = otherLabel + ' horizon reads the OTHER way (' + against.slice(0, 3).join(', ') + ')';
                c3.horizonAgree = false;
              }
            }
          };
          mark2(res.scalp.cands, swingD, 'SWING');
          mark2(res.swing.cands, scalpD, 'SCALP');
        })();
        var ranked = rankFn(all);

        /* Fetch correlation regime data (once per hour, cached) */
        return hgOgFetchCorrelationRegime(
          (res.swing.rows && res.swing.rows.length) ? res.swing.rows : res.scalp.rows,
          shared.macro
        ).then(async function(regime){
          __og.correlationRegime = regime;

        /* SPOT ALIGN — same discipline as GOLD SCALP/SWING. Proxy feeds
           (twelvedata, perp, PAXG) can sit off live spot; scale every printed
           plan to the gold-api anchor before render. R:R unchanged. XM and
           Delta XAUT are execution-native and are not scaled. */
        __og.spotFactor = NaN;
        __og.spotAnchor = NaN;
        var spotAlignNote = '';
        try {
          var sfFn = gfn('hgGoldLiveSpot');
          /* Feed anchor: swing 4h close first (where SWING mechanics fire),
             then scalp 1h — not the pre-drop forming tick. */
          var klineSpot = NaN;
          if (res.swing.rows && res.swing.rows.length){
            klineSpot = fin(res.swing.rows[res.swing.rows.length - 1].c);
          }
          if (!(klineSpot > 0) && res.scalp.rows && res.scalp.rows.length){
            klineSpot = fin(res.scalp.rows[res.scalp.rows.length - 1].c);
          }
          if (!(klineSpot > 0)) klineSpot = fin(res.swing.livePx) || fin(res.scalp.livePx);
          var srcKey = res.scalp.source || res.swing.source;
          if (sfFn && isFinite(klineSpot) && klineSpot > 0 && !hgOgSrcIsBroker(res.scalp.source)
              && !hgOgSrcIsVenueNative(srcKey)){
            var sfSpot = fin(shared.liveSpotPx);
            if (!(sfSpot > 0)){
              sfSpot = await Promise.race([
                Promise.resolve(sfFn(klineSpot)),
                new Promise(function(r2){ setTimeout(function(){ r2(NaN); }, 2500); })
              ]);
            }
            var sfFeed = klineSpot;
            if (isFinite(sfSpot) && sfSpot > 0){
              __og.spotAnchor = sfSpot;
              __og.spotFactor = sfSpot / sfFeed;
              var driftPct = Math.abs(sfFeed / sfSpot - 1) * 100;
              var driftPts = Math.abs(sfFeed - sfSpot);
              /* 11 pts @ ~4590 is only 0.24% — still too far to place on a
                 live chart; align from 0.15% or 8 pts (whichever comes first). */
              if (driftPct >= 0.15 || driftPts >= 8){
                hgOgAlignPlansToSpot(ranked, sfFeed, sfSpot, 0.15);
                res.scalp.livePx = sfSpot;
                res.swing.livePx = sfSpot;
                spotAlignNote = ' · levels scaled to live spot ~$' + sfSpot.toFixed(2)
                              + ' (feed ~$' + sfFeed.toFixed(2) + ')';
              }
            }
          }
        } catch (eSf){}
        if (!(fin(__og.spotAnchor) > 0) && fin(shared.liveSpotPx) > 0) __og.spotAnchor = fin(shared.liveSpotPx);
        var mktPx = fin(__og.spotAnchor) || fin(shared.liveSpotPx);
        if (mktPx > 0){
          hgOgRefreshDistAtr(ranked, mktPx, (res.scalp.rows && res.scalp.rows.length)
            ? res.scalp.rows : (res.swing.rows || []));
        }

        __og.snap = { at: Date.now(), rows: ranked, scalp: res.scalp.pooled, swing: res.swing.pooled };
        /* Bars kept for the R/horizon grid — it re-runs the walk-forward on
           what the scan already fetched, so it costs no network. */
        __og.gridRows = { scalp: res.scalp.rows || [], swing: res.swing.rows || [] };
        __og.lastRows = {
          scalp: res.scalp.rows || [],
          swing: res.swing.rows || [],
          m15: (res.scalp && res.scalp.rows) || []
        };
        __og.ran = true;
        __og.src = { scalp: res.scalp.source, swing: res.swing.source };

        var i;
        /* Over DISTINCT TRADES, not raw candidates — see ogDistinctCounts. */
        var dcounts = ogDistinctCounts(ranked);
        var tickets = dcounts.tickets;
        var srcNote = 'source: scalp ' + hgOgSrcLabel(res.scalp.source)
                    + ' · swing ' + hgOgSrcLabel(res.swing.source);
        /* Add drawdown metrics to status line */
        var drawdownState = hgOgResetWeeklyDrawdown();
        var drawdownMetrics = hgOgDrawdownMetricsHtml(drawdownState);
        __og.lastStat = ranked.length + ' setup(s)'
                      + (dcounts.trades < ranked.length
                          ? ' · ' + dcounts.trades + ' distinct trade(s) after collapsing '
                            + (ranked.length - dcounts.trades) + ' duplicate card(s) on identical levels'
                          : '')
                      + ' · ' + tickets + ' ticket(s) · ' + srcNote + spotAlignNote
                      + '  ·  RISK METRICS: ' + drawdownMetrics;
        /* When the desk produces NO tickets, name the gate responsible in the
           status line. A scan that reports "11 setups, 0 tickets" and nothing
           else sends the reader through every card looking for the common
           veto — and when a single market-wide gate is the cause, as a news
           blackout is, that is a long way to travel for one sentence. */
        if (!tickets && ranked.length){
          var blockTally = {}, bi, bj, bg;
          for (bi = 0; bi < ranked.length; bi++){
            for (bj = 0; bj < (ranked[bi].gates || []).length; bj++){
              bg = ranked[bi].gates[bj];
              if (bg && bg.pass === false && bg.info !== true){
                blockTally[bg.key] = (blockTally[bg.key] || 0) + 1;
              }
            }
          }
          var bKeys = Object.keys(blockTally).sort(function(a, b){ return blockTally[b] - blockTally[a]; });
          if (bKeys.length){
            var top = bKeys[0];
            __og.lastStat += '  ·  NO TICKETS: ' + top + ' vetoed '
                          + blockTally[top] + ' of ' + ranked.length + ' setups'
                          + (bKeys.length > 1 ? ' (then ' + bKeys.slice(1, 3).join(', ') + ')' : '')
                          + ' — run hgOgWhyNoTickets() for the full tally';
            /* And the condition behind the category, in words. */
            var deskRead = hgOgDeskRead(ranked, res.scalp.rows && res.scalp.rows.length ? res.scalp.rows : res.swing.rows);
            if (deskRead) __og.lastStat += '  ·  ' + deskRead;
          }
        }
        var warn = '';
        if (!res.scalp.rows.length && !res.swing.rows.length){
          warn = '  · NO gold bars from any source (XM bridge, spot proxy, PAXG) — this is a data problem, not a quiet market';
        }
        ui.stat.textContent = __og.lastStat + warn;

        /* THE BASIS, stated rather than left to be discovered. Fired after the
           status line is already up, so a slow or dead spot feed delays
           nothing and simply leaves the line as it was. */
        (function(){
          try {
            var spotFn = gfn('hgGoldLiveSpot');
            var srcKey = res.scalp.source || res.swing.source;
            if (!spotFn || !srcKey) return;
            if (hgOgSrcIsBroker(srcKey)) return;
            if (spotAlignNote) return;   /* primary levels already scaled */
            var lastRow = (res.scalp.rows && res.scalp.rows.length)
                        ? res.scalp.rows[res.scalp.rows.length - 1]
                        : ((res.swing.rows && res.swing.rows.length)
                            ? res.swing.rows[res.swing.rows.length - 1] : null);
            var feedPx = lastRow ? fin(lastRow.c) : NaN;
            if (!isFinite(feedPx) || feedPx <= 0) return;
            Promise.resolve(spotFn(feedPx)).then(function(spot){
              if (!isFinite(spot) || spot <= 0) return;
              var driftPct = (feedPx / spot - 1) * 100;
              var msg = '  ·  NOT a broker feed: ' + hgOgSrcLabel(srcKey)
                      + ' is ' + (driftPct >= 0 ? '+' : '') + driftPct.toFixed(2)
                      + '% vs spot ($' + feedPx.toFixed(2) + ' vs $' + spot.toFixed(2) + ')'
                      + ' — these levels are this instrument\'s, not your broker\'s XAUUSD';
              __og.lastStat += msg;
              ui.stat.textContent = __og.lastStat + warn;
            }).catch(function(){});
          } catch (eB){}
        })();

        /* Labelled and judged at OG_T1_R, not the acceptance floor: the table
           reports whether price reached T1, so the R it names must be T1's. */
        ui.pool.innerHTML = renderPooled(res.scalp.pooled, 'SCALP (' + HORIZONS.scalp.tf + ', ' + OG_T1_R + 'R)', OG_T1_R, 'OMNIGOLD:SCALP')
                          + renderPooled(res.swing.pooled, 'SWING (' + HORIZONS.swing.tf + ', ' + OG_T1_R + 'R)', OG_T1_R, 'OMNIGOLD:SWING')
                          + (function(){
                              /* The two horizons record under separate tabs, so the shared
                                 panel is rendered twice — a mechanic that pays on 1h need not
                                 pay on 4h, and merging them would hide exactly that. */
                              var pf = gfn('hgFwdPanelHTML');
                              if (!pf) return '';
                              return pf('OMNIGOLD:SCALP', { minRr: OG_T1_R, title: 'FORWARD — SCALP, out-of-sample' })
                                   + pf('OMNIGOLD:SWING', { minRr: OG_T1_R, title: 'FORWARD — SWING, out-of-sample' });
                            })()
                          + '<div class="note">Walk-forward on the same bars just read, per horizon and never merged — a mechanic that pays on 4h need not pay on 1h. '
                          + 'A bar spanning both stop and target counts as a STOP. In-sample on a short window; under ' + MIN_SAMPLES + ' samples is noise. '
                          + '"needs ~N" is the sample this mechanic would take to clear the '
                          + OG_MECHANICS.length + '-mechanic significance bar (+' + hgOgFamilyZ(OG_MECHANICS.length).toFixed(2) + '&sigma;), '
                          + 'which is the same bar the measured-edge gate uses — not a lone 5% threshold. '
                          + '<b>Every figure above is GROSS of spread and commission.</b> That matters most intraday: at an assumed $'
                          + ASSUMED_SPREAD_USD.toFixed(2) + ' gold spread, a $3 scalp stop gives up ~20% of 1R round-trip, so a +0.38R gross read is nearer +0.19R net. '
                          + 'The per-card <b>cost-drag</b> gate prices this against each setup’s own stop.</div>';

        if (!ranked.length){
          ui.cards.innerHTML = (!res.scalp.rows.length && !res.swing.rows.length)
            ? '<div class="note warn">No gold candles were returned by any source, so nothing could be scanned. Check the XM bridge / spot proxy before reading anything into this.</div>'
            : '<div class="empty">no gold setup fired on either horizon. That is a normal result — the detectors are meant to be quiet.</div>';
          var emptyScalpTape = hgOgTapeDir(res.scalp && res.scalp.rows);
          var emptySwingTape = hgOgTapeDir(res.swing && res.swing.rows);
          __og.tape = { scalp: emptyScalpTape, swing: emptySwingTape, desk: hgOgDeskTape(emptyScalpTape, emptySwingTape) };
          __og.uniformCards = [];
          hgOgPaintMostProbable(ui, null, null, __og.tape.desk, []);
          var emptyTape = hgOgDeskTape(hgOgTapeDir(res.scalp && res.scalp.rows), hgOgTapeDir(res.swing && res.swing.rows));
          /* Counts strip on an empty scan: zeros are the honest counts. */
          try { hgOgPaintCounts(ui, hgOgScanCounts([], [], emptyTape)); } catch (eCt0) {}
          /* verdict strip refreshes on every scan, empty ones included —
             settlements may have landed even when nothing fired (hg-v540). */
          try { hgOgPaintDeskVerdict(ui); } catch (ePvE) {}
          /* An empty scan is a REAL result — refresh the show-mode snapshot
             so the SHOW toggle can never restore a previous scan's cards
             over the honest empty / no-candles state. Nothing to filter, so
             lastView is null: the empty state is the view under BOTH modes
             (hg-v540). */
          try{
            __og.lastAllView = { cards: ui.cards.innerHTML, mp: ui.mp ? ui.mp.innerHTML : null };
            __og.lastView = null;
          }catch(eCap0){}
          try {
            hgOgPaintGoldEngines(ui, { ok: false, why: 'loading GOLD SCALP / GOLD SWING engines…' }, emptyTape);
          } catch (eGeE) {}
          return hgOgPaintOgPostScan(ui, res, shared, [], emptyTape);
        }
        /* ONE pick per horizon, marked and floated to the top so the answer
           to "what do I trade" is the first thing on the page rather than
           something to be reconstructed from a list. A horizon with no ticket
           says so outright — an empty result is an answer, and dressing up
           the least-vetoed setup as a pick would defeat the ledger. */
        var scalpTape = hgOgTapeDir(res.scalp && res.scalp.rows);
        var swingTape = hgOgTapeDir(res.swing && res.swing.rows);
        var deskTape = hgOgDeskTape(scalpTape, swingTape);
        __og.tape = { scalp: scalpTape, swing: swingTape, desk: deskTape };
        /* Collapse first so several mechanics on identical levels count as
           one trade in the balance (alsoKinds), then pick STRONGEST from
           that list. Putting picks onto the pre-collapse list used to let
           a lonely magnet outrank a chorus that later collapsed together. */
        var ogSeen = {}, ogCollapsed = [];
        for (i = 0; i < ranked.length; i++){
          var cur = ranked[i], ok2 = ogTradeKey(cur);
          if (ogSeen[ok2] === undefined){
            ogSeen[ok2] = ogCollapsed.length;
            ogCollapsed.push(cur);
            continue;
          }
          var own = ogCollapsed[ogSeen[ok2]];
          if ((cur.grade && cur.grade.ticket) && !(own.grade && own.grade.ticket)){
            /* The cleared setup takes the card from the vetoed one, carrying
               the names already collected and adding the displaced owner. */
            var also = (own.alsoKinds || []).slice();
            if (also.indexOf(own.kind) < 0) also.push(own.kind);
            var drop = also.indexOf(cur.kind);
            if (drop >= 0) also.splice(drop, 1);
            cur.alsoKinds = also;
            ogCollapsed[ogSeen[ok2]] = cur;
            continue;
          }
          if (!own.alsoKinds) own.alsoKinds = [];
          if (own.alsoKinds.indexOf(cur.kind) < 0 && cur.kind !== own.kind){
            own.alsoKinds.push(cur.kind);
          }
        }

        /* FORMATION PARTITION (hg-v533). Cards stamped not-formed at plan
           construction leave the tradable list HERE, before any pick,
           verdict or MOST PROBABLE row can see them, and land in the
           MEASURED-NEGATIVE section below — visible, levelless, never
           tradable-looking. A card without a stamp is treated as formed
           (the stamp is written by hgOgEvaluate on every scan card; only
           synthetic shapes lack it). */
        var ogDemotedCards = [];
        (function(){
          var keep = [], fi, fc;
          for (fi = 0; fi < ogCollapsed.length; fi++){
            fc = ogCollapsed[fi];
            if (fc && fc.formation && fc.formation.formed === false) ogDemotedCards.push(fc);
            else keep.push(fc);
          }
          ogCollapsed = keep;
        })();
        if (ogDemotedCards.length){
          __og.lastStat += '  ·  ' + ogDemotedCards.length + ' stood aside (measured-negative kind / venue stop floor)';
          ui.stat.textContent = __og.lastStat + warn;
        }

        var pickScalp = hgOgPickFor(ogCollapsed, HORIZONS.scalp.label, scalpTape);
        var pickSwing = hgOgPickFor(ogCollapsed, HORIZONS.swing.label, swingTape);
        var watchScalp = pickScalp ? null : hgOgPickWatchFor(ogCollapsed, HORIZONS.scalp.label, scalpTape);
        var watchSwing = pickSwing ? null : hgOgPickWatchFor(ogCollapsed, HORIZONS.swing.label, swingTape);
        if (pickScalp) pickScalp.topPick = true;
        if (pickSwing) pickSwing.topPick = true;
        if (watchScalp) watchScalp.topWatch = true;
        if (watchSwing) watchSwing.topWatch = true;
        ogCollapsed = hgOgDeskOrder(ogCollapsed, deskTape);

        /* POPULATION COUNTS strip (hg-v537) — from the REAL partition just
           made: the desk-ordered tradable list and the stood-aside list. */
        try { hgOgPaintCounts(ui, hgOgScanCounts(ogCollapsed, ogDemotedCards, deskTape)); }
        catch (eCts) {}

        var h = hgOgTapeBannerHtml(scalpTape, swingTape);
        /* The next levels FIRST: the reader asked to hold the high and the
           bottom before the market arrives — that answer leads the page. */
        try {
          if (res.scalp && res.scalp.rows && res.scalp.rows.length){
            h += hgOgZonesPanel(res.scalp.rows, res.scalp.livePx, deskTape);
          }
        } catch (eZp) {}
        var hzTapes = { scalp: scalpTape, swing: swingTape };
        [[HORIZONS.scalp.label, pickScalp, watchScalp, scalpTape], [HORIZONS.swing.label, pickSwing, watchSwing, swingTape]].forEach(function(pair){
          if (pair[1] || pair[2]) return;
          var hzTape = String(pair[3] || '');
          var noneWhy = 'nothing on that horizon cleared the ledger this scan. That is a result, not a gap — the alternative would be promoting a setup the desk already vetoed.';
          if (hzTape === 'short')
            noneWhy = 'gold is going down — a LONG is not the setup. Standing aside is the position when no short ticket cleared.';
          else if (hzTape === 'long')
            noneWhy = 'gold is going up — a SHORT is not the setup. Standing aside is the position when no long ticket cleared.';
          h += '<div class="note og-pick-none">No ' + esc(pair[0]) + ' pick: ' + noneWhy + '</div>';
        });
        /* A CARD WHOSE LEVELS ARE DEAD IS NOT A CARD.

           level-fresh already vetoes a plan the market has crossed, so it
           could not ticket — but the tab still drew it full size, ENTRY,
           STOP and T1 in large type, a hundred points from the chart. The
           veto badge was there; the numbers were what registered, and the
           reader kept seeing "a short trade with not even close levels".
           Reported three times before this landed.

           A dead card collapses to one dim line naming the gap and the
           cause. AGAINST (a genuine resting-order plan at real structure)
           still renders in full — those levels are meant to be far. */
        var deadLines = '';
        var heldCards = [];
        for (i = 0; i < ogCollapsed.length; i++){
          var cCard = ogCollapsed[i];
          if ((deskTape === 'long' || deskTape === 'short')
              && cCard && cCard.grade && cCard.grade.ticket
              && String(cCard.dir || '').toLowerCase() !== deskTape){
            heldCards.push(cCard);
            continue;
          }
          var lfG = null, gj;
          for (gj = 0; gj < (cCard.gates || []).length; gj++){
            if (cCard.gates[gj] && cCard.gates[gj].key === 'level-fresh'){ lfG = cCard.gates[gj]; break; }
          }
          if (lfG && lfG.pass === false && lfG.info !== true){
            deadLines += '<div class="dim">' + esc(cCard.kind + ' ' + String(cCard.dir).toUpperCase())
                      +  ' — levels dead on arrival: ' + esc(String(lfG.why).replace(/^DEAD ON ARRIVAL — /, ''))
                      +  ' · card not rendered</div>';
            continue;
          }
          h += setupCard(cCard);
        }
        if (deadLines){
          h += '<div class="note" style="margin-top:10px"><b>DEAD LEVELS — priced off a closed bar the market has left behind:</b>'
            +  deadLines + '</div>';
        }
        if (heldCards.length){
          h += hgOgHeldQueueHtml(heldCards, deskTape);
        }
        /* MEASURED-NEGATIVE KINDS — stood aside (hg-v533). Every setup that
           fired but did not FORM renders here: visible, with its replay row
           and the formation reason, and with NO levels. Rendered-information
           parity: nothing the scan generated is silently dropped. */
        if (ogDemotedCards.length){
          h += hgOgDemotedSectionHtml(ogDemotedCards);
        }
        /* Prepend circuit breaker warning banner if active */
        var drawdownStateBanner = hgOgResetWeeklyDrawdown();
        var circuitBannerHtml = hgOgDrawdownCircuitBannerHtml(drawdownStateBanner);
        if (circuitBannerHtml) h = circuitBannerHtml + h;
        ui.cards.innerHTML = h;
        var goldSide = deskTape;
        var mpBag = [];
        for (i = 0; i < ogCollapsed.length; i++){
          if (goldSide && String(ogCollapsed[i].dir || '').toLowerCase() !== goldSide) continue;
          var mpRow = hgOgMpRow(ogCollapsed[i]);
          if (mpRow) mpBag.push(mpRow);
        }
        /* Tickets the tape is holding: cleared the whole ledger, carry a plan,
           and point the other way. Counted from the COLLAPSED list so several
           mechanics on one set of levels count as the one trade they are. */
        var ogHeld = { n: 0, level: NaN, from: NaN, tf: HORIZONS.scalp.tf };
        try {
          if (deskTape === 'long' || deskTape === 'short'){
            for (var hj = 0; hj < ogCollapsed.length; hj++){
              var hc = ogCollapsed[hj];
              if (hc && hc.plan && hc.grade && hc.grade.ticket
                  && String(hc.dir || '').toLowerCase() !== deskTape) ogHeld.n++;
            }
            /* Name the level on whichever horizon is actually blocking. Scalp
               is checked first: it is the faster of the two and the one a
               reader watching a 1h chart can act on. */
            var blockRows = (scalpTape === deskTape) ? (res.scalp && res.scalp.rows)
                                                     : (res.swing && res.swing.rows);
            ogHeld.tf = (scalpTape === deskTape) ? HORIZONS.scalp.tf : HORIZONS.swing.tf;
            var wantDir = (deskTape === 'short') ? 'long' : 'short';
            if (blockRows && blockRows.length){
              ogHeld.level = hgOgTapeFlipLevel(blockRows, wantDir);
              var sfHeld = fin(__og.spotFactor);
              if (isFinite(ogHeld.level) && isFinite(sfHeld) && sfHeld > 0
                  && Math.abs(sfHeld - 1) > 0.005){
                ogHeld.level = ogHeld.level * sfHeld;
              }
              var liveFrom = (scalpTape === deskTape) ? fin(res.scalp && res.scalp.livePx)
                            : fin(res.swing && res.swing.livePx);
              ogHeld.from = (liveFrom > 0) ? liveFrom : fin(blockRows[blockRows.length - 1].c);
            }
          }
        } catch (eHeld){ ogHeld = { n: 0, level: NaN, from: NaN, tf: HORIZONS.scalp.tf }; }
        __og.held = ogHeld;
        __og.uniformCards = ogCollapsed;
        /* Paint MOST PROBABLE + a loading engines strip BEFORE the gold-tab
           bridge fetch. A hung 15m/1d re-fetch used to leave #ogMp and
           #ogGoldEngines blank even when VETO cards already painted. */
        try {
          hgOgPaintMostProbable(ui, pickScalp, pickSwing, deskTape, mpBag, ogHeld, watchScalp, watchSwing, null, null, hzTapes);
        } catch (eMp0) {}
        try {
          hgOgPaintGoldEngines(ui, { ok: false, why: 'loading GOLD SCALP / GOLD SWING engines…' }, deskTape);
        } catch (eGe0) {}
        return hgOgRunGoldTabEngines(shared, res.scalp.rows, res.swing.rows).then(function(bridge){
          __og.bridge = bridge;
          var engineScalp = !pickScalp ? hgOgPickGoldEngineForMp(bridge, HORIZONS.scalp.label, scalpTape) : null;
          var engineSwing = !pickSwing ? hgOgPickGoldEngineForMp(bridge, HORIZONS.swing.label, swingTape) : null;
          try {
            hgOgPaintMostProbable(ui, pickScalp, pickSwing, deskTape, mpBag, ogHeld, watchScalp, watchSwing, engineScalp, engineSwing, hzTapes);
          } catch (eRender) {
            if (__og.lastCardsHtml) ogKeepLast(ui, 'scan finished but mostProbable render failed: ' + ((eRender && eRender.message) || eRender));
            throw eRender;
          }
          return hgOgPaintOgPostScan(ui, res, shared, ogCollapsed, deskTape, bridge).then(function(){
            /* DESK VERDICT + PAID-ONLY (hg-v540): capture the ALL bytes the
               render above just painted, remember the inputs, refresh the
               verdict strip from the live pools, then apply the persisted
               show mode — a DOM no-op when the mode is ALL. */
            try{
              __og.lastAllView = { cards: ui.cards.innerHTML, mp: ui.mp ? ui.mp.innerHTML : null };
              __og.lastView = { collapsed: ogCollapsed,
                                mpArgs: { pickScalp: pickScalp, pickSwing: pickSwing, tape: deskTape,
                                          tapes: hzTapes,
                                          mpBag: mpBag, held: ogHeld,
                                          watchScalp: watchScalp, watchSwing: watchSwing,
                                          engineScalp: engineScalp, engineSwing: engineSwing } };
              hgOgPaintDeskVerdict(ui);
              hgOgApplyShowMode(ui);
            }catch(ePv){}
            ogRememberPaint(ui);
            __og.lastStat = ui.stat.textContent;
            if (ui.xmAuto && ui.xmAuto.checked) hgOgXmSendStrongest(ui);
          }).catch(function(eRender){
            if (__og.lastCardsHtml) ogKeepLast(ui, 'scan finished but postScan render failed: ' + ((eRender && eRender.message) || eRender));
            throw eRender;
          });
        });
        }); /* Close regime .then() */
      })
      .catch(function(err){
        if (__og.lastCardsHtml) {
          ogKeepLast(ui, 'scan failed: ' + ((err && err.message) || err));
        } else {
          ogSafeStat(ui, 'scan failed: ' + ((err && err.message) || err));
        }
        try { if (typeof console !== 'undefined' && console.error) console.error('[omnigold] scan failed', err); } catch (e) {}
      })
      .then(function(){
        __og.busy = false;
        ui.btn.disabled = false;
      });
  }

  /* ==================== XM order bot ==================== */

  function hgOgXmLivePx(){
    var gr = __og.gridRows;
    var rows = (gr && gr.scalp && gr.scalp.length) ? gr.scalp
             : (gr && gr.swing && gr.swing.length ? gr.swing : null);
    if (!rows || !rows.length) return undefined;
    var px = fin(rows[rows.length - 1] && rows[rows.length - 1].c);
    return isFinite(px) && px > 0 ? px : undefined;
  }

  function hgOgXmSlim(c, liveOverride){
    if (!c || !(c.grade && c.grade.ticket) || !c.plan) return null;
    if (c.grade.vetoes && c.grade.vetoes.length) return null;
    if (c.dir !== 'long' && c.dir !== 'short') return null;
    /* not-FORMED (hg-v533): the execution path is the LAST place a
       stood-aside setup may leak through */
    if (c.formation && c.formation.formed === false) return null;
    var live = fin(liveOverride);
    if (!(live > 0)) live = isFinite(fin(c.livePx)) ? fin(c.livePx) : hgOgXmLivePx();
    return {
      source: 'OMNIGOLD',
      horizon: c.horizon,
      kind: c.kind,
      dir: c.dir,
      ticket: true,
      grade: { ticket: true, vetoes: [] },
      plan: { entry: c.plan.entry, stop: c.plan.stop, t1: c.plan.t1, t2: c.plan.t2 },
      livePx: live,
      symbol: 'XAUUSD'
    };
  }

  function hgOgXmStrongest(){
    var rows = __og.snap && __og.snap.rows;
    if (!rows || !rows.length) return [];
    var out = [], seen = {};
    var desk = __og.tape && __og.tape.desk;
    var scalp = hgOgPickFor(rows, HORIZONS.scalp.label, desk);
    var swing = hgOgPickFor(rows, HORIZONS.swing.label, desk);
    [scalp, swing].forEach(function(c){
      var slim = hgOgXmSlim(c);
      if (!slim) return;
      var k = ogTradeKey(c);
      if (seen[k]) return;
      seen[k] = true;
      out.push(slim);
    });
    return out;
  }

  function hgOgXmFindByKey(key){
    var rows = __og.snap && __og.snap.rows;
    var i, c;
    for (i = 0; i < (rows || []).length; i++){
      c = rows[i];
      if (c && ogTradeKey(c) === key) return hgOgXmSlim(c);
    }
    return null;
  }

  function hgOgXmSetStat(ui, text){
    if (ui && ui.xmStat) ui.xmStat.textContent = text;
  }

  function hgOgXmPaintStatus(ui, st){
    if (!ui || !ui.xmStat) return;
    if (!st){ ui.xmStat.textContent = 'XM bot status unavailable'; return; }
    var bits = [];
    bits.push(st.configured ? ('bridge on · ' + (st.symbol || 'XAUUSD')) : 'bridge off — set XM_MT5_URL on Render');
    bits.push(st.live ? 'LIVE lots' : 'DRY RUN');
    bits.push((st.lots || 0.01) + ' lots (max ' + (st.maxLots || 0.10) + ')');
    if (st.halted) bits.push('HALTED');
    if (!st.authConfigured) bits.push('set HARDGATE_API_SECRET to send');
    else bits.push('API key required in header');
    if (st.last && st.last.reason) bits.push('last: ' + st.last.reason);
    ui.xmStat.textContent = bits.join(' · ');
  }

  function hgOgXmRefreshStatus(ui){
    if (typeof fetch !== 'function'){
      hgOgXmSetStat(ui, 'fetch unavailable');
      return Promise.resolve(null);
    }
    return fetch('/api/xm/bot', { cache: 'no-store' }).then(function(r){
      return r.json();
    }).then(function(st){
      hgOgXmPaintStatus(ui, st);
      return st;
    }).catch(function(){
      hgOgXmSetStat(ui, 'XM bot status failed');
      return null;
    });
  }

  function hgOgXmSendTickets(ui, tickets, label){
    tickets = tickets || [];
    if (!tickets.length){
      hgOgXmSetStat(ui, (label || 'XM') + ': no OMNIGOLD ticket to send (WATCH / VETO are never sent)');
      return Promise.resolve(null);
    }
    if (typeof fetch !== 'function'){
      hgOgXmSetStat(ui, 'fetch unavailable');
      return Promise.resolve(null);
    }
    var headers = gfn('hgApiHeaders')
                ? gfn('hgApiHeaders')()
                : { 'Content-Type': 'application/json' };
    hgOgXmSetStat(ui, 'sending ' + tickets.length + ' ticket(s) to XM…');
    return fetch('/api/xm/order', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ tickets: tickets })
    }).then(function(r){
      return r.json().then(function(j){ return { status: r.status, json: j }; });
    }).then(function(out){
      var j = out.json || {};
      var first = (j.results && j.results[0]) || j;
      var mode = first.dryRun ? 'DRY RUN' : 'LIVE';
      var msg;
      if (j.ok){
        msg = mode + ' ok — ' + tickets.length + ' ticket(s) '
            + (first.dryRun ? 'previewed, not sent' : 'posted to XM');
      } else {
        msg = mode + ' refused: ' + (j.reason || (first && first.reason) || ('HTTP ' + out.status));
      }
      hgOgXmSetStat(ui, msg);
      return j;
    }).catch(function(err){
      hgOgXmSetStat(ui, 'XM send failed: ' + ((err && err.message) || err));
      return null;
    });
  }

  function hgOgXmSendStrongest(ui){
    return hgOgXmSendTickets(ui, hgOgXmStrongest(), 'strongest');
  }

  /* Bot backtest: replay SEND STRONGEST on the bars this scan fetched.
     Not the mechanic R/HORIZON GRID (that enters at bar close). Macro and
     news are the last scan's snapshot; session/killzone read the prefix bar. */
  function hgOgXmBtExtra(prefix, cfg){
    var last = prefix && prefix.length ? prefix[prefix.length - 1] : null;
    var livePx = last ? fin(last.c) : NaN;
    var nowSec = last ? num(last.t) : NaN;
    var w = W();
    var dailyFn = (w && typeof w.hgOmniDailyHtf === 'function') ? w.hgOmniDailyHtf : null;
    var shared = __og.shared || {};
    var pooled = (__og.snap && cfg && (cfg.label === HORIZONS.scalp.label ? __og.snap.scalp : __og.snap.swing)) || null;
    var kzFn = gfn('goldKillzone');
    var killzone = null;
    try { if (kzFn && isFinite(nowSec)) killzone = kzFn(nowSec * 1000); } catch (eK) {}
    var zoneCtx = null;
    var opFn = gfn('opAssess');
    if (opFn && isFinite(livePx) && livePx > 0){
      try { zoneCtx = opFn(prefix, livePx, hgOgZoneLevels(prefix, livePx)); } catch (eZ) { zoneCtx = null; }
    }
    return {
      htf: dailyFn ? dailyFn(prefix) : null,
      killzone: killzone,
      macro: shared.macro,
      yieldRows: shared.yieldRows,
      nowSec: nowSec,
      adr: hgOgAdr(prefix, 14),
      news: shared.news,
      stats: pooled,
      livePx: livePx,
      zoneCtx: zoneCtx
    };
  }

  function hgOgXmBtTicketAt(prefix, cfg){
    if (!prefix || prefix.length < 40) return null;
    var last = prefix[prefix.length - 1];
    var hits = hgOgDetect(prefix, { nowSec: last ? num(last.t) : undefined });
    if (!hits || !hits.length) return null;
    var cands = hgOgEvaluate(prefix, hits, hgOgXmBtExtra(prefix, cfg), cfg);
    var pick = hgOgPickFor(cands, cfg.label, hgOgTapeDir(prefix));
    var live = last ? fin(last.c) : NaN;
    return hgOgXmSlim(pick, live);
  }

  function hgOgXmBtWalkHorizon(mod, rows, cfg, onProgress){
    return new Promise(function(resolve){
      if (!mod || !rows || rows.length < (cfg.warm + cfg.horizonBars + 2)){
        resolve(mod ? mod.ogXmBotSummarize([], { lots: 0.01, spreadUsd: ASSUMED_SPREAD_USD }) : null);
        return;
      }
      var i = cfg.warm;
      var takenUntil = -1;
      var trades = [];
      var cap = rows.length - cfg.horizonBars;
      function step(){
        var n = 0;
        while (n < 6 && i < cap){
          n++;
          if (i <= takenUntil){ i++; continue; }
          var slim = null;
          try { slim = hgOgXmBtTicketAt(rows.slice(0, i + 1), cfg); } catch (eT) { slim = null; }
          if (slim){
            var t = mod.ogXmBotWalkTrade(rows, i, slim, {
              horizon: cfg.horizonBars, fillBars: cfg.horizonBars,
              spreadUsd: ASSUMED_SPREAD_USD, lots: 0.01
            });
            if (t && t.state !== 'skip'){
              trades.push(t);
              takenUntil = i + cfg.horizonBars;
            }
          }
          i++;
        }
        if (typeof onProgress === 'function') onProgress(cfg.label, i, cap, trades.length);
        if (i >= cap){
          resolve(mod.ogXmBotSummarize(trades, { lots: 0.01, spreadUsd: ASSUMED_SPREAD_USD }));
          return;
        }
        setTimeout(step, 0);
      }
      setTimeout(step, 0);
    });
  }

  function hgOgXmBtPaint(ui, html){
    if (ui && ui.xmBtOut) ui.xmBtOut.innerHTML = html;
  }

  function hgOgXmRunBacktest(ui){
    ui = ui || __og.ui;
    if (!ui) return Promise.resolve(null);
    if (__og.btBusy || __og.busy){
      hgOgXmBtPaint(ui, '<div class="note">scan or backtest already running</div>');
      return Promise.resolve(null);
    }
    var gr = __og.gridRows;
    var scalpRows = gr && gr.scalp ? gr.scalp : [];
    var swingRows = gr && gr.swing ? gr.swing : [];
    if (!scalpRows.length && !swingRows.length){
      hgOgXmBtPaint(ui, '<div class="note warn">Run a gold scan first — the bot backtest uses the bars that scan fetched, and there are none yet.</div>');
      return Promise.resolve(null);
    }
    __og.btBusy = true;
    if (ui.xmBt) ui.xmBt.disabled = true;
    hgOgXmBtPaint(ui, '<div class="note">loading bot backtest…</div>');
    var ver = '434';
    try {
      var w = W();
      if (w && w.HG_BUILD && w.HG_BUILD.version) ver = String(w.HG_BUILD.version).replace(/^hg-v/, '');
    } catch (eV) {}
    return import('./lib/omnigold-xm-bot-backtest.mjs?v=' + ver).then(function(mod){
      var parts = [];
      function prog(label, i, cap, n){
        hgOgXmBtPaint(ui, '<div class="note">replaying ' + label + ' · bar ' + i + '/' + cap
          + ' · ' + n + ' send(s) so far — TICKET fill at setup entry, not bar close</div>'
          + parts.join(''));
      }
      var chain = Promise.resolve();
      if (scalpRows.length){
        chain = chain.then(function(){
          return hgOgXmBtWalkHorizon(mod, scalpRows, HORIZONS.scalp, prog).then(function(sum){
            parts.push(mod.ogXmBotBacktestHtml(sum, 'SCALP · XM bot'));
          });
        });
      }
      if (swingRows.length){
        chain = chain.then(function(){
          return hgOgXmBtWalkHorizon(mod, swingRows, HORIZONS.swing, prog).then(function(sum){
            parts.push(mod.ogXmBotBacktestHtml(sum, 'SWING · XM bot'));
          });
        });
      }
      return chain.then(function(){
        hgOgXmBtPaint(ui, parts.join('') || '<div class="note">no horizon had enough bars</div>');
        return parts;
      });
    }).catch(function(err){
      hgOgXmBtPaint(ui, '<div class="note warn">bot backtest failed: '
        + esc((err && err.message) || err) + '</div>');
      return null;
    }).then(function(out){
      __og.btBusy = false;
      if (ui.xmBt) ui.xmBt.disabled = false;
      return out;
    });
  }

  /* ==================== mount / refresh ==================== */

  /* EXECUTION VENUE control (hg-v537). Sits under the desk-stance banner,
     beside the scan controls. Formation verdicts are stamped by
     hgOgEvaluate AT SCAN TIME (the stop floor and the demotion partition
     live on each card), so a venue change cannot honestly re-price cards
     already on screen — the control says 'applies on next scan' and the
     stat line repeats it after a change. The banner and its demotion
     counts ARE pure reads, so those repaint immediately.
     Precedence is hgOgVenueCost's: a window.HG_OG_VENUE override wins over
     this control, and the control says so and disables itself while one is
     set. */
  function hgOgVenueControlHtml(){
    return '<div class="row og-venue-row" style="margin:0 0 8px 0;align-items:center">'
      + '<span class="note" style="margin:0"><b>EXECUTION VENUE</b> <span class="dim">(applies on next scan)</span>:</span>'
      + ' <button type="button" class="btn ghost og-venue-btn" id="ogVenueXm" data-og-venue="XM">XM XAUUSD</button>'
      + ' <button type="button" class="btn ghost og-venue-btn" id="ogVenuePaxg" data-og-venue="PAXG">PAXG</button>'
      + ' <span class="note dim" id="ogVenueNote" style="font-size:11px;margin:0"></span>'
      + '</div>'
      /* POPULATION COUNTS strip (hg-v537) — filled by hgOgPaintCounts after
         each scan; display:none until there are real counts. */
      + '<div class="note dim og-counts" id="ogCounts" style="display:none;margin-bottom:8px"></div>';
  }

  function hgOgVenuePaint(ui){
    if (!ui) return;
    var w = W(), ovr = '';
    try { ovr = String((w && w.HG_OG_VENUE) || '').toUpperCase().replace(/^\s+|\s+$/g, ''); }
    catch (eO) { ovr = ''; }
    var vc = hgOgVenueCost();
    function mark(btn, on){
      if (!btn) return;
      try {
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.style.borderColor = on ? '#10b981' : '';
        btn.style.color = on ? '#10b981' : '';
        btn.style.fontWeight = on ? 'bold' : '';
        btn.disabled = !!ovr;
      } catch (eB) {}
    }
    mark(ui.venueXm, vc.venue === 'XM');
    mark(ui.venuePaxg, vc.venue === 'PAXG');
    if (ui.venueNote){
      try {
        ui.venueNote.textContent = ovr
          ? ('window.HG_OG_VENUE="' + ovr + '" override active — it wins over this control')
          : ('active: ' + vc.venue + ' ~' + fin(vc.rtCostPct).toFixed(3) + '% RT');
      } catch (eN) {}
    }
  }

  function hgOgVenueApply(ui, el, name){
    if (!hgOgSetVenue(name)) return;
    hgOgVenuePaint(ui);
    /* The banner's venue line is a pure read — repaint it in place. */
    try {
      var b = el && el.querySelector ? el.querySelector('[data-og-replay-banner]') : null;
      if (b) b.outerHTML = hgOgDeskStanceBannerHtml();
    } catch (eR) {}
    /* Cards on screen still carry the OLD venue's formation stamps — say
       so instead of quietly showing mixed arithmetic. */
    if (__og.ran && ui && ui.stat){
      try {
        ui.stat.textContent = (__og.lastStat || '')
          + '  ·  venue changed to ' + String(name).toUpperCase()
          + ' — press RUN GOLD SCAN to re-price formation at its costs';
      } catch (eS) {}
    }
  }

  /* ==================== PAID-ONLY MODE + DESK VERDICT (hg-v540) ====================
     ADDITIVE display layer, same shape as the crypto desk's: the scan paints
     exactly what it painted before, those bytes are captured, and only then
     is the persisted mode applied — ALL is byte-identical to the pre-toggle
     desk, PAID-ONLY is a filter over a snapshot. The paid set comes from the
     shared hgFwdPaidKinds (hg-forward.js) read PER HORIZON POOL — a mechanic
     that pays on 1h need not pay on 4h, so a card is judged against its own
     horizon's pool. DEMOTIONS ARE UNTOUCHED: the formation partition removed
     measured-negative kinds from the tradable list before any of this runs,
     so a demoted kind can no more appear under PAID-ONLY than under ALL. */
  var OG_PAID_LS = 'hg_paidonly_OMNIGOLD';

  function hgOgShowMode(){
    try{
      if (typeof localStorage === 'undefined') return 'ALL';
      return localStorage.getItem(OG_PAID_LS) === '1' ? 'PAID' : 'ALL';
    }catch(e){ return 'ALL'; }
  }
  function hgOgShowModeSet(mode){
    try{
      if (typeof localStorage === 'undefined') return;
      if (mode === 'PAID') localStorage.setItem(OG_PAID_LS, '1');
      else localStorage.removeItem(OG_PAID_LS);
    }catch(e){}
  }

  /* Paid kinds per horizon pool, judged at OG_T1_R exactly as this desk's
     FORWARD tables and hgOgForwardPaid judge. Fail closed to empty sets. */
  function hgOgPaidSets(){
    var out = { SCALP: [], SWING: [], union: [] };
    var fn = gfn('hgFwdPaidKinds');
    if (!fn) return out;
    try{ out.SCALP = fn('OMNIGOLD:SCALP', OG_T1_R) || []; }catch(e1){ out.SCALP = []; }
    try{ out.SWING = fn('OMNIGOLD:SWING', OG_T1_R) || []; }catch(e2){ out.SWING = []; }
    var i;
    for (i = 0; i < out.SCALP.length; i++) if (out.union.indexOf(out.SCALP[i]) < 0) out.union.push(out.SCALP[i]);
    for (i = 0; i < out.SWING.length; i++) if (out.union.indexOf(out.SWING[i]) < 0) out.union.push(out.SWING[i]);
    out.union.sort();
    return out;
  }

  /* Is this card's mechanic paid in ITS OWN horizon's pool? A card with no
     stated horizon is judged against the union — generous only about WHICH
     pool, never about the bar. */
  function hgOgKindPaid(c, sets){
    if (!c || !c.kind || !sets) return false;
    var hz = String(c.horizon || '').toUpperCase();
    var list = (hz === 'SCALP') ? sets.SCALP : (hz === 'SWING') ? sets.SWING : sets.union;
    return (list || []).indexOf(String(c.kind)) >= 0;
  }

  function hgOgPaintDeskVerdict(ui){
    try{
      var fn = gfn('hgFwdDeskVerdictHtml');
      if (ui && ui.fwdVerdict && fn)
        ui.fwdVerdict.innerHTML = fn(['OMNIGOLD:SCALP', 'OMNIGOLD:SWING']) || '';
    }catch(e){}
  }

  function hgOgShowToggleHtml(){
    var mode = hgOgShowMode();
    return '<div class="note" data-og-showmode="' + esc(mode) + '">SHOW: '
      + '<button type="button" class="btn" id="ogShowAll"' + (mode === 'ALL' ? ' disabled' : '') + '>ALL</button> '
      + '<button type="button" class="btn ghost" id="ogShowPaid"' + (mode === 'PAID' ? ' disabled' : '') + '>PAID-ONLY</button>'
      + ' <span class="dim">PAID-ONLY keeps only setups whose mechanic’s own forward ledger reads ‘has paid’ on its horizon. '
      + 'Nothing is deleted — ALL restores everything. Demoted kinds stay stood aside on both modes.</span></div>';
  }

  function hgOgWireShowToggle(ui, el){
    try{
      if (!ui || !ui.showMode) return;
      ui.showMode.innerHTML = hgOgShowToggleHtml();
      var root = el || ui.showMode;
      var bAll = root.querySelector ? root.querySelector('#ogShowAll') : null;
      var bPaid = root.querySelector ? root.querySelector('#ogShowPaid') : null;
      if (bAll && bAll.addEventListener) bAll.addEventListener('click', function(){
        hgOgShowModeSet('ALL'); hgOgWireShowToggle(ui, el); hgOgApplyShowMode(ui); ogRememberPaint(ui);
      });
      if (bPaid && bPaid.addEventListener) bPaid.addEventListener('click', function(){
        hgOgShowModeSet('PAID'); hgOgWireShowToggle(ui, el); hgOgApplyShowMode(ui); ogRememberPaint(ui);
      });
    }catch(e){}
  }

  /* The PAID-ONLY card view — a summary of what was hidden and why, then the
     surviving cards through the SAME setupCard renderer. Dead-level cards
     keep the ALL view's one-line treatment (a paid mechanic does not revive
     dead levels). Pure over its inputs, exported for the harness. */
  function hgOgPaidCardsHtml(cards, sets){
    var list = (Object.prototype.toString.call(cards) === '[object Array]') ? cards : [];
    var s = sets || { SCALP: [], SWING: [], union: [] };
    var kept = [], hidden = 0, i, c;
    for (i = 0; i < list.length; i++){
      c = list[i]; if (!c) continue;
      if (hgOgKindPaid(c, s)) kept.push(c); else hidden++;
    }
    var h = '<div class="note warn" data-og-paidonly="1" style="display:block"><b>PAID-ONLY</b> — ';
    if (!s.union.length){
      var settled = 0;
      try{
        var scFn = gfn('hgFwdSettledCount');
        if (scFn) settled = scFn(['OMNIGOLD:SCALP', 'OMNIGOLD:SWING']) || 0;
      }catch(eS){}
      h += 'no mechanic on this desk currently reads ‘has paid’ on either horizon (pool: '
        + settled + ' settled across SCALP+SWING) — ' + hidden
        + ' setup(s) hidden, mechanics without a paid forward record. ';
    } else {
      h += hidden + ' setup(s) hidden by PAID-ONLY — mechanics without a paid forward record on their horizon '
        + '(paid: ' + esc(s.union.join(', ')) + '). ';
    }
    h += 'Demoted kinds remain stood aside exactly as under ALL. '
      + 'Click ALL to restore everything (tape banner, zones, held queue and the stood-aside section render there).</div>';
    var deadLines = '';
    for (i = 0; i < kept.length; i++){
      c = kept[i];
      var lfG = null, gj;
      for (gj = 0; gj < (c.gates || []).length; gj++){
        if (c.gates[gj] && c.gates[gj].key === 'level-fresh'){ lfG = c.gates[gj]; break; }
      }
      if (lfG && lfG.pass === false && lfG.info !== true){
        deadLines += '<div class="dim">' + esc(String(c.kind || '') + ' ' + String(c.dir || '').toUpperCase())
                  +  ' — levels dead on arrival · card not rendered</div>';
        continue;
      }
      try{ h += setupCard(c); }catch(eC){}
    }
    if (deadLines) h += '<div class="note" style="margin-top:10px"><b>DEAD LEVELS:</b>' + deadLines + '</div>';
    if (!kept.length) h += '<div class="empty">no PAID-ONLY setup this scan.</div>';
    return h;
  }

  /* Apply the persisted mode to the last completed paint. ALL restores the
     captured bytes verbatim; PAID rebuilds cards + MOST PROBABLE from the
     snapshot, with every pick judged against its own horizon's pool. */
  function hgOgApplyShowMode(ui){
    try{
      if (!ui || !ui.cards) return;
      var mode = hgOgShowMode();
      if (mode !== 'PAID'){
        if (__og.lastAllView){
          try{ ui.cards.innerHTML = __og.lastAllView.cards; }catch(e1){}
          try{ if (ui.mp && __og.lastAllView.mp != null) ui.mp.innerHTML = __og.lastAllView.mp; }catch(e2){}
        }
        return;
      }
      if (!__og.lastView) return;   /* no scan yet — nothing to filter */
      var sets = hgOgPaidSets();
      ui.cards.innerHTML = hgOgPaidCardsHtml(__og.lastView.collapsed, sets);
      try{
        var a = __og.lastView.mpArgs || {};
        var pk = function(c){ return (c && hgOgKindPaid(c, sets)) ? c : null; };
        var pkEng = function(e2, hz){
          if (!e2) return null;
          return hgOgKindPaid({ kind: e2.strategy || e2.stratKey, horizon: hz }, sets) ? e2 : null;
        };
        var bag = [], bi;
        for (bi = 0; bi < (a.mpBag || []).length; bi++){
          if (a.mpBag[bi] && hgOgKindPaid(a.mpBag[bi], sets)) bag.push(a.mpBag[bi]);
        }
        hgOgPaintMostProbable(ui, pk(a.pickScalp), pk(a.pickSwing), a.tape, bag, a.held,
                              pk(a.watchScalp), pk(a.watchSwing),
                              pkEng(a.engineScalp, 'SCALP'), pkEng(a.engineSwing, 'SWING'),
                              a.tapes);
      }catch(eMp){}
    }catch(e){}
  }

  function mountOmnigold(el){
    if (!el) return;
    /* Venue selection FIRST — the desk-stance banner below prices its
       demotion counts at the active venue, so the persisted choice (or the
       XM default; PAXG when storage is unavailable) must be applied before
       any HTML is built. */
    hgOgVenueInit();
    el.innerHTML =
      '<div class="panel">'
      + '<h2>OmniGold — gold desk setups <span>XAUUSD · scalp ' + HORIZONS.scalp.tf + ' + swing ' + HORIZONS.swing.tf
      +   ' · asia break · ny drive · weekly open · pivot · ema50 · fib 618 · + the OmniRoute six</span></h2>'
      + '<div class="note" style="margin-bottom:10px">OmniRoute’s method pointed at gold: mechanical detectors, a hard-gate ledger, '
      + 'walk-forward self-measurement and evidence coverage — plus the mechanics gold desks actually trade. '
      + '<b>Two horizons are measured separately</b>, because a mechanic that pays on 4h need not pay intraday. '
      + 'The perp gates have no meaning here (spot gold has no funding, OI, retail ratio or taker flow) and are deliberately absent rather than faked; '
      + 'in their place sit session, real-rate macro, DXY inverse, yield guard and ADR budget. '
      + 'Levels come from the house plan engine. <b>MOST PROBABLE SETUPS</b> lead the tab: one SCALP and one SWING ticket when the mechanic ledger clears; otherwise grade-A/B setups from the <b>GOLD SCALP / GOLD SWING</b> engines (15m + 4h). Cards still badge STRONGEST. Nothing here is a profit forecast.</div>'
      /* DESK-STANCE BANNER (hg-v532) — permanent, before any scan runs:
         the replay's verdict on this tab's own labels, in the reader's
         face where the scan button is, not in a footnote below a card. */
      + hgOgDeskStanceBannerHtml()
      /* EXECUTION VENUE control + counts strip (hg-v537) — see
         hgOgVenueControlHtml for why changes apply on the next scan. */
      + hgOgVenueControlHtml()
      + '<div class="row"><button class="btn" id="ogRun">RUN GOLD SCAN</button>'
      +   ' <button class="btn" id="ogGrid">R / HORIZON GRID</button></div>'
      + '<div class="note" id="ogStat">idle — press RUN. Fetches two horizons of gold bars, then measures every mechanic on each.</div>'
      + '<div class="note warn" id="ogWarn" style="display:none"></div>'
      /* DESK VERDICT + PAID-ONLY toggle (hg-v540) — under the banners, above
         the picks. The strip fills from the live pools at mount and again
         after every scan. */
      + '<div id="ogFwdVerdict" style="margin-top:8px"></div>'
      + '<div id="ogShowMode" style="margin-top:8px"></div>'
      + '<div id="ogMp" style="margin-top:12px"></div>'
      + '<div id="ogVerdict" style="margin-top:12px"></div>'
      + '<div id="ogSettledExec" style="margin-top:12px"></div>'
      + '<div id="ogCoverage" style="margin-top:12px"></div>'
      + '<div id="ogGoldEngines" style="margin-top:12px"></div>'
      + '<div class="panel" id="ogXmBot" style="margin-top:12px">'
      +   '<h3>XM trader bot</h3>'
      +   '<p class="note">Sends this tab’s <b>TICKET</b> rows to your XM MT5 account through the same bridge as gold candles (<code>XM_MT5_URL</code>). '
      +   'WATCH and VETO are never sent. Crypto EXECUTE stays disabled. Default is <b>DRY RUN</b> — live lots require <code>XM_OMNIGOLD_LIVE=1</code> on Render plus the header API key matching <code>HARDGATE_API_SECRET</code>. '
      +   '<code>HARDGATE_KILL_SWITCH</code> / <code>HARDGATE_TRADING_HALT</code> block live sends. '
      +   '<b>BACKTEST BOT</b> replays that send path on the gold bars this scan fetched: pending fill at the setup entry, stop-first, GROSS vs NET of the $'
      +   (ASSUMED_SPREAD_USD * 2).toFixed(2) + ' round-trip spread. Unfilled is not a loss. In-sample — not a live XM statement.</p>'
      +   '<div class="note" id="ogXmStat" role="status">checking XM bot…</div>'
      +   '<div class="row" style="margin-top:8px">'
      +     '<button type="button" class="btn" id="ogXmSend">SEND STRONGEST TICKETS TO XM</button>'
      +     '<button type="button" class="btn ghost" id="ogXmRefresh">REFRESH XM STATUS</button>'
      +     '<button type="button" class="btn ghost" id="ogXmBt" title="Replay the XM send path on the bars this scan fetched. Takes a minute on a full gold history. Does not POST to XM.">BACKTEST BOT</button>'
      +   '</div>'
      +   '<label class="note" style="display:flex;gap:8px;align-items:center;margin-top:8px">'
      +     '<input type="checkbox" id="ogXmAuto">'
      +     ' Auto-send strongest tickets after each scan (still dry-run unless the server is live)'
      +   '</label>'
      +   '<div id="ogXmBtOut" style="margin-top:10px"></div>'
      + '</div>'
      + '<div id="ogGridOut" style="margin-top:10px"></div>'
      + '<div id="ogPool" style="margin-top:10px"></div>'
      + '<div class="cards" id="ogCards" style="margin-top:12px"></div>'
      + '</div>';

    var ui = {
      btn: el.querySelector('#ogRun'), stat: el.querySelector('#ogStat'), warn: el.querySelector('#ogWarn'),
      mp: el.querySelector('#ogMp'),
      fwdVerdict: el.querySelector('#ogFwdVerdict'), showMode: el.querySelector('#ogShowMode'),
      verdict: el.querySelector('#ogVerdict'),
      settledExec: el.querySelector('#ogSettledExec'),
      coverage: el.querySelector('#ogCoverage'),
      goldEngines: el.querySelector('#ogGoldEngines'),
      pool: el.querySelector('#ogPool'), cards: el.querySelector('#ogCards'),
      grid: el.querySelector('#ogGrid'), gridOut: el.querySelector('#ogGridOut'),
      xmStat: el.querySelector('#ogXmStat'), xmSend: el.querySelector('#ogXmSend'),
      xmRefresh: el.querySelector('#ogXmRefresh'), xmAuto: el.querySelector('#ogXmAuto'),
      xmBt: el.querySelector('#ogXmBt'), xmBtOut: el.querySelector('#ogXmBtOut'),
      venueXm: el.querySelector('#ogVenueXm'), venuePaxg: el.querySelector('#ogVenuePaxg'),
      venueNote: el.querySelector('#ogVenueNote'), counts: el.querySelector('#ogCounts')
    };
    if (!ui.btn || !ui.stat || !ui.cards || !ui.pool) return;

    /* Master Catalog map is visible before the first scan (feeds may fail). */
    try {
      var catFn0 = gfn('hgGoldCatalogEngine');
      var catHtml0 = gfn('hgGoldCatalogHtml');
      if (ui.coverage && catFn0 && catHtml0) ui.coverage.innerHTML = catHtml0(catFn0([], {}));
    } catch (eCat0) {}

    /* EXECUTION VENUE wiring (hg-v537). Fail-open on a missing element —
       an older shell without the control keeps every previous behavior. */
    try {
      if (ui.venueXm) ui.venueXm.addEventListener('click', function(){ hgOgVenueApply(ui, el, 'XM'); });
      if (ui.venuePaxg) ui.venuePaxg.addEventListener('click', function(){ hgOgVenueApply(ui, el, 'PAXG'); });
      hgOgVenuePaint(ui);
    } catch (eVc) {}

    /* DESK VERDICT + PAID-ONLY toggle (hg-v540): live pool numbers at mount,
       before any scan, and the persisted show mode wired. */
    try { hgOgPaintDeskVerdict(ui); } catch (ePv0) {}
    try { hgOgWireShowToggle(ui, el); } catch (eTg0) {}

    /* THE R/HORIZON GRID, WHICH THIS DESK DID NOT HAVE.

       OMNIROUTE has carried this since the day its own test established the
       finding: the SAME six detectors run from -18.7 sigma at 3R/10 bars to
       +2.5 sigma at 1.5R/40 bars. Nothing about the detectors changes between
       those numbers — target and horizon do all the work. The gold desk trades
       SCALP at 1.5R/24 and SWING at 2R/20 and had no way to see whether that
       frame was throwing the edge away.

       Measured on 1,500 real XAUUSDT 1h bars, every one of the twelve cells
       came back inside noise: best +1.37 sigma at 1R/10, gold's own frame
       +0.36, the best reachable +0.83 at 1.5R/40, worst -1.50 at 3R/10
       against a family-wise bar of +2.97. So the frame is NOT the main
       problem here, and that is worth being able to see rather than assume.

       Same six detectors as the crypto grid — the ones this tab's own header
       calls "the OmniRoute six" — so the numbers are comparable across desks.
       A button, not part of every scan: it re-runs the walk-forward twelve
       times. */
    if (ui.grid){
      ui.grid.addEventListener('click', function(){
        var gw = W();
        if (!gw || typeof gw.hgOmniGridProgressive !== 'function'){
          ui.gridOut.innerHTML = '<div class="note warn">grid engine unavailable (omniroute.js not loaded)</div>';
          return;
        }
        var gr = __og.gridRows;
        var lists = [];
        if (gr && gr.scalp && gr.scalp.length) lists.push(gr.scalp);
        if (gr && gr.swing && gr.swing.length) lists.push(gr.swing);
        if (!lists.length){
          ui.gridOut.innerHTML = '<div class="note warn">Run a scan first — the grid measures the bars '
                               + 'that scan fetched, and there are none yet.</div>';
          return;
        }
        ui.grid.disabled = true;
        ui.gridOut.innerHTML = '<div class="note">measuring both gold horizons at 12 settings…</div>';
        /* T1 sits at OG_T1_R on BOTH horizons; the per-horizon minRr is the
           acceptance floor, not the target. Saying "trades SCALP at 1.5R"
           described the floor and read as the target. */
        var frame = '<div class="note">Gold places T1 at ' + OG_T1_R + 'R on both horizons — SCALP over '
                  + HORIZONS.scalp.horizonBars + ' bars, SWING over '
                  + HORIZONS.swing.horizonBars + ' bars (the ' + HORIZONS.scalp.minRr + 'R / '
                  + HORIZONS.swing.minRr + 'R per-horizon figures are plan-acceptance floors, not targets). '
                  + 'The grid sweeps around both. '
                  + 'Every figure is IN-SAMPLE and GROSS, and the best of twelve cells is the best of '
                  + 'twelve searches — the same multiple-comparisons bar that applies to picking a '
                  + 'mechanic applies to picking a setting.</div>';
        try {
          gw.hgOmniGridProgressive(lists,
            function(html){ ui.gridOut.innerHTML = frame + html; },
            function(html){ ui.gridOut.innerHTML = frame + html; ui.grid.disabled = false; });
        } catch (eG){
          ui.gridOut.innerHTML = '<div class="note warn">grid failed: ' + ((eG && eG.message) || eG) + '</div>';
          ui.grid.disabled = false;
        }
      });
    }
    __og.ui = ui;
    /* Remount must not look like a first visit — restore the last completed scan. */
    if (__og.lastCardsHtml){
      try { ui.cards.innerHTML = __og.lastCardsHtml; } catch (eM) {}
      if (__og.lastPoolHtml != null){ try { ui.pool.innerHTML = __og.lastPoolHtml; } catch (eP) {} }
      if (ui.mp && __og.lastMpHtml != null){ try { ui.mp.innerHTML = __og.lastMpHtml; } catch (eMp) {} }
      if (ui.verdict && __og.lastVerdictHtml != null){ try { ui.verdict.innerHTML = __og.lastVerdictHtml; } catch (eV) {} }
      if (ui.settledExec && __og.lastSettledExecHtml != null){ try { ui.settledExec.innerHTML = __og.lastSettledExecHtml; } catch (eSe) {} }
      if (ui.coverage && __og.lastCoverageHtml != null){ try { ui.coverage.innerHTML = __og.lastCoverageHtml; } catch (eCo) {} }
      if (ui.goldEngines && __og.lastGoldEnginesHtml != null){ try { ui.goldEngines.innerHTML = __og.lastGoldEnginesHtml; } catch (eGe) {} }
      if (__og.lastStat) ogSafeStat(ui, __og.lastStat);
    }
    hgOgInjectPickStyles();
    /* TOP SETUP paints honestly at mount: this session's last ledger winner
       when there is one, otherwise the run-a-scan message — never raw logs. */
    try { hgOgPaintTopSetup(ui); } catch (eTs0) {}
    try {
      var autoOn = false;
      try { autoOn = localStorage.getItem('hg_og_xm_auto') === '1'; } catch (eA) {}
      if (ui.xmAuto){
        ui.xmAuto.checked = autoOn;
        ui.xmAuto.addEventListener('change', function(){
          try { localStorage.setItem('hg_og_xm_auto', ui.xmAuto.checked ? '1' : '0'); } catch (eS) {}
        });
      }
      if (ui.xmSend) ui.xmSend.addEventListener('click', function(){ hgOgXmSendStrongest(ui); });
      if (ui.xmRefresh) ui.xmRefresh.addEventListener('click', function(){ hgOgXmRefreshStatus(ui); });
      if (ui.xmBt) ui.xmBt.addEventListener('click', function(){ hgOgXmRunBacktest(ui); });
      if (ui.cards){
        ui.cards.addEventListener('click', function(ev){
          var t = ev.target;
          if (!t || !t.getAttribute) return;
          if (!/\bog-xm-send\b/.test(t.className || '')) return;
          var key = t.getAttribute('data-og-key');
          var slim = hgOgXmFindByKey(key);
          hgOgXmSendTickets(ui, slim ? [slim] : [], 'ticket');
        });
      }
      hgOgXmRefreshStatus(ui);
    } catch (eXm) {}

    var w = W(), missing = [];
    if (typeof fetch !== 'function') missing.push('fetch');
    if (!w || typeof w.hgOmniDetect !== 'function') missing.push('omniroute.js engine');
    if (!gfn('getXmGoldCandles') && !gfn('getGoldCandles') && !gfn('binanceKlines')) missing.push('every gold candle source');
    if (!gfn('hgPlanLevels')) missing.push('hgPlanLevels (no entry/stop/target)');
    if (missing.length){
      ui.stat.textContent = 'missing: ' + missing.join(', ') + ' — the scan degrades honestly where it can.';
    }
    if (!w || typeof w.hgOmniDetect !== 'function' || typeof fetch !== 'function'){
      ui.btn.disabled = true;
      return;
    }
    ui.btn.addEventListener('click', function(){ return runScan(ui); });
  }

  function refreshOmnigold(){
    return Promise.resolve().then(function(){
      if (__og.busy) return 'busy';
      if (!__og.ran) return 'skipped: not run yet';
      if (__og.snap && isFinite(__og.snap.at) && (Date.now() - __og.snap.at) < OG_FRESH_MS)
        return 'skipped: fresh';
      var ui = __og.ui;
      if (ui) return runScan(ui).then(function(){ return __og.lastStat || 'rescanned'; });
      return __og.lastStat || 'no ui mounted';
    }).catch(function(){ return 'refresh failed'; });
  }

  /* ============================ exports ============================ */
  if (typeof window !== 'undefined'){
    window.hgOgAsiaRange = hgOgAsiaRange;
    window.hgOgAsiaBreak = hgOgAsiaBreak;
    window.hgOgKzJudas = hgOgKzJudas;
    window.hgOgAdr = hgOgAdr;
    window.hgOgAdrFade = hgOgAdrFade;
    window.hgOgRoundMagnet = hgOgRoundMagnet;
    window.hgOgResample = hgOgResample;   /* exported so the higher-timeframe build is testable directly */
    window.hgOgDetect = hgOgDetect;
    window.hgOgNyOpenDrive = hgOgNyOpenDrive;
    window.hgOgWeeklyOpen = hgOgWeeklyOpen;
    window.hgOgPivotReject = hgOgPivotReject;
    window.hgOgInsideBreak = hgOgInsideBreak;
    window.hgOgEma50Hold = hgOgEma50Hold;
    window.hgOgFib618 = hgOgFib618;
    /* Round six, exported for the same reason hgOgAdrFade and hgOgRoundMagnet
       are: a detector reachable only through hgOgDetect can be tested for
       "something fired" but not for "THIS fired, and nothing else did". The
       firing test needs to drive each one alone, and the cost measurement
       needs to time each one alone. */
    window.hgOgIchiKumo = hgOgIchiKumo;
    window.hgOgStochTurn = hgOgStochTurn;
    window.hgOgCciExtreme = hgOgCciExtreme;
    window.hgOgRibbonPullback = hgOgRibbonPullback;
    window.hgOgHaFlip = hgOgHaFlip;
    window.hgOgVwapBand = hgOgVwapBand;
    window.hgOgPdEquilibrium = hgOgPdEquilibrium;
    window.hgOgErIgnition = hgOgErIgnition;
    window.hgOgStructBos = hgOgStructBos;
    window.hgOgSweepV2 = hgOgSweepV2;
    window.hgOgObRetest = hgOgObRetest;
    window.hgOgOuRevert = hgOgOuRevert;
    window.hgOgMfiSquat = hgOgMfiSquat;
    window.hgOgDiCross = hgOgDiCross;
    window.hgOgFvgHvn = hgOgFvgHvn;
    /* The family map decides how much a mechanic contributes to the
       combined SCALP/SWING pick, because the balance score reads
       consensus per FAMILY rather than per mechanic. Exported so a test
       can assert nothing falls through to OTHER — an unmapped mechanic
       still fires and still shows a card, so the miss is invisible. */
    window.hgOgFamilyOf = hgOgFamilyOf;
    window.hgOgGates = hgOgGates;
    window.hgOgKindToInstKey = hgOgKindToInstKey;
    window.hgOgInstFilterHit = hgOgInstFilterHit;

  /* ==================== RISK SIZING & DRAWDOWN CIRCUIT BREAKER ==================== */

  function hgOgLoadDrawdownState(){
    try {
      var stored = localStorage.getItem('hg_og_drawdown_state');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    /* Default state: Monday 00:00 IST, 0 P&L, no loss streak, circuit not active */
    return {
      weekStart: new Date().toISOString().split('T')[0],
      weekPnl: 0,
      losStreak: 0,
      isCircuitBreakerActive: false
    };
  }

  function hgOgSaveDrawdownState(state){
    try {
      localStorage.setItem('hg_og_drawdown_state', JSON.stringify(state));
    } catch (e) {}
  }

  function hgOgMondayIstIso(dateObj){
    if (!dateObj) dateObj = new Date();
    /* Simple Monday calculation: find the most recent Monday in UTC (close enough for IST) */
    var dayOfWeek = dateObj.getUTCDay() || 7;
    var daysToMonday = (dayOfWeek === 1) ? 0 : (dayOfWeek - 1);
    var monday = new Date(dateObj);
    monday.setUTCDate(monday.getUTCDate() - daysToMonday);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  function hgOgResetWeeklyDrawdown(){
    var state = hgOgLoadDrawdownState();
    var now = new Date();
    var currentMonday = hgOgMondayIstIso(now);
    if (state.weekStart !== currentMonday){
      state.weekStart = currentMonday;
      state.weekPnl = 0;
      state.losStreak = 0;
      state.isCircuitBreakerActive = false;
      hgOgSaveDrawdownState(state);
    }
    return state;
  }

  function hgOgCalculateRiskScale(stack3, heldCount){
    if (!isFinite(stack3)) stack3 = 3;
    if (!isFinite(heldCount)) heldCount = 0;

    var baseScale = 1.0;
    var stackReason = '';

    /* Stack3-based scaling: 3 gates passing = 100%, down to 0% if no gates */
    if (stack3 >= 3){
      baseScale = 1.0;
      stackReason = 'Full 100%';
    } else if (stack3 === 2){
      baseScale = 0.70;
      stackReason = '70% (1 gate weak)';
    } else if (stack3 === 1){
      baseScale = 0.50;
      stackReason = '50% (thin confluence)';
    } else {
      baseScale = 0.0;
      stackReason = 'DO NOT TRADE';
    }

    /* Held-queue crowding penalty */
    var heldScale = 1.0;
    var heldReason = '';
    if (heldCount > 5){
      heldScale = 0.60; /* -40% */
      heldReason = ' -40% (queue > 5)';
    } else if (heldCount > 3){
      heldScale = 0.80; /* -20% */
      heldReason = ' -20% (queue > 3)';
    }

    var finalScale = baseScale * heldScale;
    var finalReason = stackReason + (heldReason || '');

    return {
      scale: finalScale,
      reason: finalReason,
      baseScale: baseScale,
      stackReason: stackReason,
      heldScale: heldScale,
      heldReason: heldReason
    };
  }

  function hgOgRiskBadgeHtml(stack3, heldCount){
    if (stack3 === 0) return '';
    var sizing = hgOgCalculateRiskScale(stack3, heldCount);
    var scale = sizing.scale;
    var reason = sizing.reason;

    var cls = scale >= 1.0 ? 'ok' : (scale >= 0.5 ? 'warn' : 'bad');
    var txt = (scale * 100).toFixed(0) + '% sizing';
    if (reason) txt += ' (' + reason + ')';

    return pill(txt, cls);
  }

  function hgOgDrawdownMetricsHtml(state){
    if (!state) state = hgOgResetWeeklyDrawdown();
    var html = '<span class="dim">Week P&L: ';
    html += (isFinite(state.weekPnl) && state.weekPnl !== 0)
      ? ((state.weekPnl >= 0 ? '+' : '') + state.weekPnl.toFixed(1) + '%')
      : '0%';
    html += ' | Streak: ' + state.losStreak + 'L';
    if (state.losStreak >= 3){
      html += ' | Sizing: auto-50%';
    }
    if (state.isCircuitBreakerActive){
      html += ' | <b style="color:red">CIRCUIT BREAKER ACTIVE</b>';
    }
    html += '</span>';
    return html;
  }

  function hgOgDrawdownCircuitBannerHtml(state){
    if (!state || !state.isCircuitBreakerActive) return '';
    var html = '<div style="background:#ffe0e0;border:1px solid #ff6666;border-radius:4px;'
             + 'padding:10px;margin:8px 0;color:#cc0000;font-weight:bold;">'
             + '⚠ Drawdown Circuit Breaker: ' + (state.weekPnl >= 0 ? '+' : '') + state.weekPnl.toFixed(1) + '% week | '
             + 'PAUSE ENTRIES until next Mon</div>';
    return html;
  }

  function hgOgUpdateDrawdownOnSettle(outcome, pnl){
    /* Called when a setup settles (outcome = 'win' or 'loss', pnl = numeric or null) */
    var state = hgOgResetWeeklyDrawdown();

    if (!outcome) return state;

    /* Update consecutive loss streak */
    if (outcome === 'loss'){
      state.losStreak++;
    } else if (outcome === 'win'){
      state.losStreak = 0;
    }

    /* Accumulate weekly P&L if provided */
    if (isFinite(pnl) && pnl !== 0){
      state.weekPnl += pnl;
    }

    /* Check circuit breaker: -2% threshold */
    state.isCircuitBreakerActive = (state.weekPnl <= -2.0);

    hgOgSaveDrawdownState(state);
    return state;
  }

  function hgOgGetConsecutiveLossReduction(losStreak){
    /* Returns 1.0 (no reduction) for < 3 losses, 0.5 for 3+ losses */
    return (losStreak >= 3) ? 0.5 : 1.0;
  }

  function hgOgApplyDrawdownSizing(riskScale, state){
    /* Apply consecutive loss auto-reduction (50%) on top of other sizing */
    if (!state) state = hgOgResetWeeklyDrawdown();
    var lossReduction = hgOgGetConsecutiveLossReduction(state.losStreak);
    return riskScale * lossReduction;
  }

  window.hgOgLoadDrawdownState = hgOgLoadDrawdownState;
  window.hgOgSaveDrawdownState = hgOgSaveDrawdownState;
  window.hgOgResetWeeklyDrawdown = hgOgResetWeeklyDrawdown;
  window.hgOgCalculateRiskScale = hgOgCalculateRiskScale;
  window.hgOgRiskBadgeHtml = hgOgRiskBadgeHtml;
  window.hgOgDrawdownMetricsHtml = hgOgDrawdownMetricsHtml;
  window.hgOgDrawdownCircuitBannerHtml = hgOgDrawdownCircuitBannerHtml;
  window.hgOgUpdateDrawdownOnSettle = hgOgUpdateDrawdownOnSettle;
  window.hgOgGetConsecutiveLossReduction = hgOgGetConsecutiveLossReduction;
  window.hgOgApplyDrawdownSizing = hgOgApplyDrawdownSizing;

    /* Exported so the ticket count can be tested apart from a live scan —
       the header and the rendered cards disagreed for want of exactly this. */
    window.ogDistinctCounts = ogDistinctCounts;
    window.ogTradeKey = ogTradeKey;
    window.hgOgEvaluate = hgOgEvaluate;
    window.hgOgPlanForHit = hgOgPlanForHit;
    window.hgOgFormTicket = hgOgFormTicket;
    window.hgOgXmSlim = hgOgXmSlim;
    window.hgOgXmStrongest = hgOgXmStrongest;
    window.hgOgXmRunBacktest = hgOgXmRunBacktest;
    window.hgOgConsensusVoters = hgOgConsensusVoters;
    window.hgOgPickFor = hgOgPickFor;
    window.hgOgPickWatchFor = hgOgPickWatchFor;
    window.hgOgWilsonHit = hgOgWilsonHit;
    window.hgOgSettledEvidence = hgOgSettledEvidence;
    window.hgOgSettledExecuteOk = hgOgSettledExecuteOk;
    window.hgOgPickSettledExecutes = hgOgPickSettledExecutes;
    window.hgOgSettledExecutePanelHtml = hgOgSettledExecutePanelHtml;
    window.hgOgMergeSettledEvidence = hgOgMergeSettledEvidence;
    window.hgOgPickScalpVerdict = hgOgPickScalpVerdict;
    window.hgOgScalpVerdictPanelHtml = hgOgScalpVerdictPanelHtml;
    window.hgOgPaintScalpVerdict = hgOgPaintScalpVerdict;
    window.hgOgBuildScanCoverage = hgOgBuildScanCoverage;
    window.hgOgScanCoveragePanelHtml = hgOgScanCoveragePanelHtml;
    window.hgOgRunGoldTabEngines = hgOgRunGoldTabEngines;
    window.hgOgGoldEngineGradeOk = hgOgGoldEngineGradeOk;
    window.hgOgApplyBridgeBestLevels = hgOgApplyBridgeBestLevels;
    window.hgOgBridgeSetupToPick = hgOgBridgeSetupToPick;
    window.hgOgPickGoldEngineFor = hgOgPickGoldEngineFor;
    window.hgOgPickGoldEngineForMp = hgOgPickGoldEngineForMp;
    window.hgOgGoldEngineRowHtml = hgOgGoldEngineRowHtml;  /* catalog levels print even when not formed (hg-v584) — not a ticket */
    window.hgOgEngineGradeBannerHtml = hgOgEngineGradeBannerHtml;
    window.hgOgGoldEnginesPanelHtml = hgOgGoldEnginesPanelHtml;
    window.hgOgPaintOgPostScan = hgOgPaintOgPostScan;
    window.hgOgHeldQueueHtml = hgOgHeldQueueHtml;
    window.hgOgInfoNet = hgOgInfoNet;
    window.hgOgBalanceScore = hgOgBalanceScore;
    window.hgOgBalanceParts = hgOgBalanceParts;
    window.hgOgDeskOrder = hgOgDeskOrder;
    window.hgOgMostProbablePanelHtml = hgOgMostProbablePanelHtml;
    /* TOP SETUP — gate-ledger-fed card (hg-v541); exported so the pick,
       the level-fresh re-check and the stand-aside copy are testable
       without a mount. */
    window.hgOgTopSetupPick = hgOgTopSetupPick;
    window.hgOgTopSetupFresh = hgOgTopSetupFresh;
    window.hgOgTopSetupPanelHtml = hgOgTopSetupPanelHtml;
    window.hgOgPaintTopSetup = hgOgPaintTopSetup;
    window.hgOgInjectSection = hgOgInjectSection;
    window.hgOgNormalizeGrade = hgOgNormalizeGrade;
    window.hgOgGradeChipHtml = hgOgGradeChipHtml;
    window.hgOgGradeLegendHtml = hgOgGradeLegendHtml;
    window.hgOgMpHorizonHtml = hgOgMpHorizonHtml;
    window.hgOgTargetReadout = hgOgTargetReadout;
    window.hgOgHorizonCfg = hgOgHorizonCfg;
    window.hgOgAlignPlansToSpot = hgOgAlignPlansToSpot;
    window.hgOgFetchRows = hgOgFetchRows;
    window.hgOgResolveLiveSpot = hgOgResolveLiveSpot;
    window.hgOgRefreshDistAtr = hgOgRefreshDistAtr;
    window.hgOgEntryMarketNote = hgOgEntryMarketNote;
    window.hgOgMpNoneWhy = hgOgMpNoneWhy;           /* the stand-aside copy, testable */
    window.hgOgTapeDir = hgOgTapeDir;
    window.hgOgTapeFlipLevel = hgOgTapeFlipLevel;
    window.hgOgConfluenceGrade = hgOgConfluenceGrade;  /* the card letter, testable */
    window.hgOgDeskTape = hgOgDeskTape;
    window.hgOgTapeBannerHtml = hgOgTapeBannerHtml;
    window.hgOgZoneLevels = hgOgZoneLevels;   /* the desk's own anticipation levels, testable */
    window.hgOgZonesPanel = hgOgZonesPanel;
    /* Replay evidence + cost drag (ADDITIVE) — PAXG 1h replay 2026-03-15..
       08-29, n=7270 settled; see scripts/omnigold-replay-evidence.json.
       HG_OG_RT_COST_PCT on window is the tunable venue override that
       hgOgRtCostPct() reads back. */
    window.HG_OG_RT_COST_PCT = HG_OG_RT_COST_PCT;
    window.HG_OG_REPLAY_EVIDENCE = HG_OG_REPLAY_EVIDENCE;
    window.hgOgRtCostPct = hgOgRtCostPct;
    window.hgOgCostDrag = hgOgCostDrag;
    /* Venue-true cost model + setup FORMATION (hg-v533) — exported so the
       venue arithmetic, the stop floor, the measured-toxic demotion list
       and the survivor list are testable without a mount. HG_OG_VENUE /
       HG_OG_XM_SPREAD_USD are read from window at call time (set them
       there); the PAXG preset stays tunable via HG_OG_RT_COST_PCT. */
    window.hgOgVenueCost = hgOgVenueCost;
    window.hgOgVenueCostNoteHtml = hgOgVenueCostNoteHtml;
    /* VENUE control internals (hg-v537) — exported so the selection
       precedence (override > UI selection > PAXG fail-closed), the per-venue
       demotion counts, and the counts strip are testable without a mount. */
    window.hgOgVenuePresetCost = hgOgVenuePresetCost;
    window.hgOgSetVenue = hgOgSetVenue;
    window.hgOgVenueInit = hgOgVenueInit;
    window.hgOgDemotedKindCount = hgOgDemotedKindCount;
    window.hgOgScanCounts = hgOgScanCounts;
    window.hgOgPaintCounts = hgOgPaintCounts;
    window.hgOgVenueControlHtml = hgOgVenueControlHtml;
    window.hgOgVenueNetR = hgOgVenueNetR;
    window.hgOgKindDemotion = hgOgKindDemotion;
    window.hgOgForwardPaid = hgOgForwardPaid;
    window.hgOgSurvivorKinds = hgOgSurvivorKinds;
    window.hgOgIsSurvivor = hgOgIsSurvivor;
    window.hgOgFormation = hgOgFormation;
    window.hgOgDemotedSectionHtml = hgOgDemotedSectionHtml;
    window.HG_OG_FORM_COST_R_MAX = HG_OG_FORM_COST_R_MAX;
    window.hgOgCostChipHtml = hgOgCostChipHtml;
    window.hgOgReplayEvidence = hgOgReplayEvidence;
    window.hgOgReplayLineHtml = hgOgReplayLineHtml;
    window.hgOgEngineReplayLinesHtml = hgOgEngineReplayLinesHtml;
    window.hgOgConfluenceFitNoteHtml = hgOgConfluenceFitNoteHtml;
    window.hgOgConfluenceFitPwin = hgOgConfluenceFitPwin;
    window.hgOgConfluenceFitPwinHtml = hgOgConfluenceFitPwinHtml;
    /* Spectrum truth labels + cost quarantine + desk-stance banner
       (hg-v532) — exported so the honest wording is testable without a
       full mount. */
    window.hgOgTierBadgeInfo = hgOgTierBadgeInfo;
    window.hgOgCostsFirstHtml = hgOgCostsFirstHtml;
    window.hgOgRenderConfluenceBreakdown = hgOgRenderConfluenceBreakdown;
    window.hgOgSpectrumTruthHeaderHtml = hgOgSpectrumTruthHeaderHtml;
    window.hgOgDeskStanceBannerHtml = hgOgDeskStanceBannerHtml;
    /* APEX GOLD (ADDITIVE) — grade-gated, tape-aligned, cost-tiered tier
       built ONLY from measured replay evidence; see hgOgApexQualify. */
    window.hgOgApexQualify = hgOgApexQualify;
    window.hgOgApexPanelHtml = hgOgApexPanelHtml;
    /* hgOgReport() — the desk record, on demand, from the console.

       The forward log lives in localStorage, so it can only be read in the
       browser that produced it. Asking someone to paste a twenty-line
       snippet to see their own results is a way of not showing them. */
    /* Same diagnosis for the gold desk. The helper lives in omniroute, which
       loads first and which this tab already borrows its grader from. */
    /* Exported so the plain-language read is testable apart from a live scan. */
    window.hgOgDeskRead = hgOgDeskRead;
    window.hgOgWhyNoTickets = function(){
      var w = W();
      if (!w || typeof w.hgWhyNoTicketsFrom !== 'function'){
        return 'omniroute.js is not loaded — the shared diagnostic is unavailable.';
      }
      return w.hgWhyNoTicketsFrom(__og.snap && __og.snap.rows, 'OMNIGOLD');
    };

    window.hgOgReport = function hgOgReport(){
      var sf = gfn('hgFwdStats'), pf = gfn('hgFwdPool');
      if (!sf || !pf) return 'hg-forward.js is not loaded — no record to read.';
      var out = [];
      ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING'].forEach(function(tab){
        var st, pool;
        try { st = sf(tab, null, false); pool = pf(tab) || {}; }
        catch (e) { out.push(tab + ': unreadable (' + ((e && e.message) || e) + ')'); return; }
        out.push('=== ' + tab + ' ===');
        out.push('  settled ' + st.samples + '  wins ' + st.wins + '  losses ' + st.losses
               + '  open ' + st.open + '  expired ' + st.expired
               + (st.stale ? '  STALE ' + st.stale : ''));
        out.push('  hit ' + (isFinite(st.hit) ? (st.hit * 100).toFixed(0) + '%' : '—')
               + '   expectancy ' + (isFinite(st.expR) ? ((st.expR >= 0 ? '+' : '') + st.expR.toFixed(2) + 'R') : '—'));
        var rows = [], k;
        for (k in pool){
          if (!Object.prototype.hasOwnProperty.call(pool, k)) continue;
          if (pool[k] && (pool[k].samples || pool[k].open || pool[k].stale)) rows.push([k, pool[k]]);
        }
        rows.sort(function(a, b){ return (b[1].samples || 0) - (a[1].samples || 0); });
        if (!rows.length){ out.push('  no mechanic has recorded anything yet on this horizon'); return; }
        rows.forEach(function(r){
          var p = r[1];
          out.push('    ' + String(r[0] + '               ').slice(0, 15)
                 + ' settled ' + String('  ' + p.samples).slice(-3)
                 + '  W' + String('  ' + p.wins).slice(-3) + ' L' + String('  ' + p.losses).slice(-3)
                 + '  open ' + String('  ' + p.open).slice(-3)
                 + (p.stale ? '  stale ' + p.stale : '')
                 + '  hit ' + (isFinite(p.hit) ? String('   ' + (p.hit * 100).toFixed(0) + '%').slice(-4) : '   —')
                 + '  exp ' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—'));
        });
      });
      out.push('');
      out.push('Out-of-sample only. Every figure is GROSS of spread and commission.');
      out.push('STALE = recorded, then the bars to settle it never arrived (delisted, renamed,');
      out.push('or the contract stopped being scanned). Not a win, not a loss, not still running.');
      var txt = out.join('\n');
      if (typeof console !== 'undefined' && console.log) console.log(txt);
      return txt;
    };

    /* PAID-ONLY + DESK VERDICT (hg-v540) — mode state, the per-horizon paid
       sets, the filter view and the apply step, exported so the harness
       proves the filter keeps exactly the paid mechanics per horizon and
       ALL restores the captured bytes. */
    window.hgOgShowMode = hgOgShowMode;
    window.hgOgShowModeSet = hgOgShowModeSet;
    window.hgOgPaidSets = hgOgPaidSets;
    window.hgOgKindPaid = hgOgKindPaid;
    window.hgOgPaidCardsHtml = hgOgPaidCardsHtml;
    window.hgOgApplyShowMode = hgOgApplyShowMode;
    window.hgOgState = function hgOgState(){
      try { return __og.snap ? JSON.parse(JSON.stringify(__og.snap)) : null; } catch (e) { return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'omnigold', label: 'OMNIGOLD', mount: mountOmnigold, refresh: refreshOmnigold });
  }

})();
