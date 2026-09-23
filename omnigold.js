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

HOW MANY MECHANICS, AND WHERE THEY COME FROM. OG_MECHANICS is the list this
desk advertises. It said "currently holds 55" for long enough to be 21 out
of date — a count written into prose drifts silently, so the number lives in
tests/test-omnigold-full-cover.mjs now, which counts it from the source on
every run and prints it. Ask that, not this paragraph.

Nor is it quite the single source of truth. hgOgDetect calls hgOmniDetect,
OmniRoute's whole pass, so this desk consumes a SUPERSET: two CV detectors
(DONCHIAN-DRIVE, COMPRESSION-BREAK) reach the gold book without being
listed here. Four firings in 9,897 rows, declared and bounded by that same
test rather than left to be rediscovered.

Six are OmniRoute's, consumed from
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
  /* ...AND A FLOOR, which there never was.
     Measured on the desk's own settled walk (scripts/backtest-omnigold-
     results.json, 7,670 settled plans after dropping the ambiguous same-bar
     wins), sorted into deciles by stop distance:

       stop 0.069% of entry   win 18.1%   GROSS -0.456R
       stop 0.157%            win 19.4%   GROSS -0.417R
       stop 0.244%            win 23.7%   GROSS -0.288R
       ...
       stop 1.265%            win 26.1%   GROSS +0.001R
       stop 2.019%            win 21.6%   GROSS +0.042R

     THAT TABLE IS ONE END OF AN INTERVAL, NOT A MEASUREMENT (hg-v760).

     Every figure above was computed on the walk with unprovable fills
     resolved at the cautious end — deleting unprovable wins, keeping
     unprovable losses. A tight stop is exactly the plan whose fill bar
     spans both levels, so the unprovable population is concentrated in the
     bucket this table judges. Re-running the same split across the
     interval:

       below 0.50%        above 0.50%
         -0.2989R           +0.0084R     cautious end (the table above)
         +0.0030R           +0.0474R     all unprovable rows dropped
         +0.2888R           +0.0568R     optimistic end

     The sign reverses, and at the far end this floor removes the most
     profitable half of the book. "0.50% is where gross crosses zero and
     stays there" is true of one bound and false of the other.

     THE FLOOR STAYS, ON THE COST ARGUMENT, WHICH IS ARITHMETIC. A stop
     inside 0.5% of gold pays a spread that is a large fraction of 1R — no
     walk is needed to know that, and cost-drag prices it at the live venue.
     This constant is the venue-independent floor beneath it. What has been
     withdrawn is the claim that a tight stop is measurably negative GROSS;
     this walk cannot establish that in either direction.

     scripts/resolve-unprovable-1m.mjs is the only thing that can settle it.
     Until it has run, nothing here should be re-tuned on these numbers.

     VETO, NEVER WIDEN. plans.js already states the rule for the other
     direction — "DO NOT TIGHTEN A FAR STOP" — and it holds symmetrically:
     pushing a tight stop out to satisfy a floor invents a risk distance the
     setup never argued for and falsifies the R:R printed on the card. The
     two honest answers are decline, or trade the stop the structure gave. */
  var GOLD_STOP_MIN_PCT = 0.005;
  /* STRONGEST prefers a ticket whose named level is actually in reach.
     A 4H FVG 6×ATR behind the market is a real limit, not the trade to
     float first when a sweep 1.5×ATR away already has a ticket.
     hg-v626: horizon-specific reach — swing levels sit farther from spot
     than scalp ORB/VWAP; a single 2×ATR cap hid good weekly/sweep tickets. */
  var GOLD_NEAR_ATR_SCALP = 2.5;
  var GOLD_NEAR_ATR_SWING = 3.5;
  var GOLD_WATCH_MAX_ATR_SCALP = 4.0;
  var GOLD_WATCH_MAX_ATR_SWING = 5.5;
  function hgOgNearAtrFor(horizon){
    var h = String(horizon || '').toUpperCase();
    return (h === 'SWING') ? GOLD_NEAR_ATR_SWING : GOLD_NEAR_ATR_SCALP;
  }
  function hgOgWatchMaxAtrFor(horizon){
    var h = String(horizon || '').toUpperCase();
    return (h === 'SWING') ? GOLD_WATCH_MAX_ATR_SWING : GOLD_WATCH_MAX_ATR_SCALP;
  }
  /* NEAR-CERTAINTY (was "SETTLED EXECUTE") — Wilson 95% CI lower bound >= 95%.
     KEPT, BUT NO LONGER THE HEADLINE, because it cannot be cleared by a
     mechanic that trades a real edge rather than a near-sure thing.

     The Wilson lower bound converges UPWARD to the true win rate, so the bar
     is a statement about the true rate, not about sample size. Measured with
     this app's own hgWilson:

       perfect records:   15/15 -> 79.6%   50/50 -> 92.9%   80/80 -> 95.4%
       at a true 54% hit: n=100 -> 44.3%   n=1e4 -> 53.0%   n=1e5 -> 53.7%

     The minimum TRUE win rate that can ever clear 95% is about 97%. Gold
     in-sample grids peak near 54%, so at this bar the tier can never fire and
     "keep scanning" is advice that never pays off. It stays as an aspirational
     ceiling — a mechanic that somehow did reach it should still be flagged —
     and PROVEN EDGE below is the bar the desk actually trades. */
  var OG_EXEC_MIN_N = 15;
  var OG_EXEC_WILSON_LO = 0.95;
  var OG_EXEC_WILSON_Z = 1.96;
  /* PROVEN EDGE — the reachable bar, and the panel's headline.
     Promote a mechanic when its settled forward record is profitable at 95%
     confidence: Wilson 95% LOWER bound above the win rate the plan needs just
     to break even, which is 1/(1+avgRr) at the reward multiple the WINNERS
     actually carried. At avgRr 1.5 that is 40%, so a genuine 54% mechanic can
     clear it with enough settled trades, while a 39% one never does no matter
     how many it accumulates.

     Still a lower-bound test, so thin records cannot promote themselves: the
     bound only rises above breakeven once the sample is big enough to rule out
     the mechanic being a loser. avgRr comes from the recorded winners — when
     it is unknown there is no breakeven to clear and the tier stays silent
     rather than assuming one. */
  var OG_EDGE_MIN_N = 25;
  var OG_EDGE_MARGIN = 0.02;   /* clear breakeven by 2 points, not by rounding */
  /* SCALP VERDICT — pooled settled TICKET record across gold desks.
     Wilson 95% lower ≥ 90% with enough settled trades. Lower bar than the
     95% execute tier; still requires real forward history, not in-sample. */
  var OG_SCALP_FWD_TABS = ['OMNIGOLD:SCALP', 'GOLDSCALP', 'SUPER:GOLD'];
  /* The swing equivalent, which existed only as a literal inside
     hgOgSettledEvidence. Named because measured-edge now reads it too, and
     two copies of the same list are two chances to pool different tabs. */
  var OG_SWING_FWD_TABS = ['OMNIGOLD:SWING', 'GOLDSWING', 'SUPER:GOLD'];
  /* How many horizon-pool tests the desk runs — one per horizon. The
     promotion bar is corrected for exactly this many comparisons, so it is
     COUNTED from the horizon table rather than written down: adding a third
     horizon must tighten the bar on its own. */
  function hgOgHorizonPoolTests(){
    try {
      var n = Object.keys(HORIZONS || {}).length;
      return (n > 0) ? n : 1;
    } catch (e) { return 1; }
  }

  function hgOgFwdTabsFor(horizon){
    return (String(horizon || '').toUpperCase() === 'SCALP')
      ? OG_SCALP_FWD_TABS.slice() : OG_SWING_FWD_TABS.slice();
  }
  var OG_VERDICT_SCALP_LO = 0.90;
  var OG_VERDICT_MIN_N = 10;

  var FWD_MIN_JUDGE = 20;   // settled out-of-sample trades before it can conclude
  var MIN_SAMPLES = 20;
  var EDGE_VETO_Z = -2;
  /* hg-v917: VESTIGIAL ON THIS DESK, AND SAID SO RATHER THAN DELETED.
     This is the crypto twin's bar. omniroute.js:7213 reads it — a mechanic
     there needs 30 settled before the gate will veto, so its 20-29 window
     counts AGAINST instead. THIS FILE NEVER READS IT: the gold measured-edge
     gate vetoes at MIN_SAMPLES (20) above, which is hg-v420's deliberate
     choice ("no 20-29 info free-pass") and what AGENTS.md documents.
     It stays because gold-forward-read.js borrows 30 from it by name for its
     own demote bar, and three tests assert that borrowing. Changing the
     number here would silently move that bar, so the value is untouched and
     only the misreading is fixed. test-omnigold-formed-population pins that
     the gate does not read it. */
  var EDGE_VETO_SAMPLES = 30;

  /* ===== MEASURED EDGE: PROOF REQUIRED, OR NO TICKET =====================

     The measured-edge gate has three verdicts. It vetoes on a KNOWN failure
     (pass false) and it has always done so. What it did NOT do is stand a
     setup aside when the answer is UNKNOWN (pass null) — soft gates let an
     unknown through, so the ticket stood and the card said UNCHECKED. That
     is how every OMNIGOLD ticket has ever been issued, because nothing
     clears the bar:

       54 mechanics in the replay ledger
        0 clear the 54-comparison significance bar (the best, P6-FAIL, is
          +1.71 sigma against a bar of +3.11)
        8 fail it outright
       46 are unknown

     With this true the gate is hard, and an unknown stands the setup aside
     like any other missing evidence. The honest reading of the ledger is
     that the desk cannot show any mechanic pays, and a ticket is a claim
     that it does.

     SO THIS WILL EMPTY THE TICKET COLUMN. That is not a side effect, it is
     the change: every card becomes WATCH, with its levels, its gates and
     its reasoning intact, and none of them is called a ticket until
     something earns it. hgOgEdgeProofPanelHtml renders WHY the column is
     empty and what would refill it, because an unexplained empty tab is
     worse than a wrong one.

     One constant, so this is one line to reverse. Turning it off restores
     exactly the previous behaviour: unknown stops standing setups aside and
     tickets issue on UNCHECKED evidence again.

     ===================================================================
     hg-v925 — RELAXED, ON INSTRUCTION. THE DEFAULT IS NOW false.
     ===================================================================

     The desk owner asked for this gate to be relaxed after several packs of
     an empty ticket column. It is their call and it is recorded as theirs:
     NO EVIDENCE WAS FOUND FOR IT, and none is claimed. Four separate
     arguments for loosening this desk were tested and refused on measured
     grounds (hg-v920 grade-A fallback and the tally/crowned splits, hg-v922
     the 0.28% stop bar, hg-v923 promoting sweepob on a record that was not
     its). This is not a fifth argument. It is an instruction.

     WHAT IT FREES, measured on the committed replay at 78 registered
     mechanics and a Sidak bar of +3.21 sigma:

        0  of 54 measured mechanics clear the bar
        1  fails it outright at <= -2 sigma (n=358) and STAYS VETOED
       53  are UNKNOWN — these now ticket again
       13  registered mechanics have no record at all, read UNCHECKED, and
           now ticket too, including SWEEP-OB wired in hg-v923

     So 66 of 78 mechanics can issue a ticket, against 0 before.

     WHAT THAT COHORT MEASURED, n-weighted over its 7,595 settled firings:

       win rate    30.5%    against a 33.3% breakeven at 2R
       gross R    -0.0179
       net R @XM  -0.0726   (median cost re-priced 0.26% -> 0.020%)

     Below breakeven before costs, and about -0.07R a trade after them at XM.
     That is what a ticket from this desk now means. It is not a prediction
     of loss — the cohort is not significantly below breakeven either, which
     is exactly why it reads UNKNOWN — but it is not an edge, and the card
     must not let it read as one.

     WHAT DID NOT CHANGE. The KNOWN-FAILURE veto is untouched: a mechanic
     measured at or below -2 sigma still cannot ticket, in-sample or out.
     That half of the gate is evidence-backed and the instruction was to
     relax, not to remove. G1-G7, the cost ceilings, the stop floors and
     every suppress / demote / prefer bar are also untouched.

     REVERSIBLE WITHOUT AN EDIT. hgOgSetEdgeProof(true) restores it for the
     session and persists to localStorage, and window.HG_OG_EDGE_PROOF
     overrides both. hgOgEdgeRelaxedPanelHtml states the relaxation and these
     numbers on the tab, so nobody meets a ticket from this desk without
     meeting what it is worth. */
  var OG_EDGE_PROOF_LS_KEY = 'hg_og_edge_proof';
  var OG_EDGE_PROOF_DEFAULT = false;   /* hg-v925: relaxed on instruction */
  var OG_EDGE_PROOF_REQUIRED = OG_EDGE_PROOF_DEFAULT;
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
  /* 'UTAD' sits beside 'SPRING' rather than folding into it: hgOmniSpring
     emits both, they are the two sides of one detector, and their records
     differ by 19 points of win rate. Registering only the long side left
     106 firings judged on the other half's evidence. See OG_KIND_ALIAS. */
  var OG_MECHANICS = ['SPRING','UTAD','PO3','ORB','ABSORB','VALUE','MMOVE',
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
                      'P9-VOLBAR','P9-PREM',
                      /* hg-v923 — the sweep->OB model, CONFIRMED path only */
                      'SWEEP-OB'];

  var __og = { ui: null, busy: false, ran: false, snap: null, lastStat: '', src: null, shared: null, btBusy: false,
               lastCardsHtml: null, lastPoolHtml: null, lastMpHtml: null,
               lastVerdictHtml: null, lastSettledExecHtml: null, lastCoverageHtml: null, lastGoldEnginesHtml: null,
               correlationRegime: null, lastRegimeUpdate: 0,
               rollingStats: null, topSetupView: null, lastRollingUpdate: 0,
               /* hg-v540: the ALL view's exact bytes + the inputs behind
                  them, so PAID-ONLY filters a snapshot and ALL restores
                  verbatim. */
               lastAllView: null, lastView: null,
               /* lane -> scan timestamp of the last card published into it.
                  See hgOgLaneThrottle: a lane is one direction on one
                  horizon, and a reader holds one gold position. */
               laneLastPub: {}, laneThrottled: 0,
               /* the gate ledger's key list as this build actually produces
                  it — see hgOgEvidenceStale */
               liveGateKeys: null };
  var OG_FRESH_MS = 180000;   /* tab-open / hardRefreshAll skip when scan is still fresh */

  function W(){ return (typeof window !== 'undefined') ? window : null; }
  function gfn(name){
    var w = W();
    return (w && typeof w[name] === 'function') ? w[name] : null;
  }
  /* null/undefined/'' -> NaN. isFinite(null) is TRUE in JS; see omniroute. */
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  /* num() WAS `+v`, WHICH MAKES A MISSING PRICE THE PRICE ZERO.

     The sanitiser in runScan already states this rule for the close —
     "fin(), NOT num(): num(null) is 0 because +null is 0, which would admit
     a null close as the price zero" — and then some fifty other sites read
     bar fields through num() anyway, including atrOf:

       h = num(rows[i].h); l = num(rows[i].l); pc = num(rows[i - 1].c);
       if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;

     The guard cannot fire, because num(null) is 0 and isFinite(0) is true.
     So a single null high in the 14-bar window makes h = 0 and the true
     range Math.max(0 - l, |0 - pc|, |l - pc|) becomes the GOLD PRICE. On a
     4000 fixture that takes ATR from 7.79 to 293.39 — 38x — and a 1.5xATR
     stop from 11.68 points to 440. ATR sets stop width, stop width sets
     position size and the cost gate, so one absent field in one bar
     rewrites every number on the card.

     Every caller wants the strict reading. The three that do not read a bar
     want it too: a null spreadZ is not a z of zero, and num(bar && bar.t)
     on a missing bar was returning a 1970 timestamp. So num is fin now,
     kept as a name because ~58 call sites use it and a rename would bury a
     one-line behaviour fix in a mechanical diff. */
  function num(v){ return fin(v); }

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
  /* ====================================================================
     WHERE A TIME WINDOW STARTS, WITHOUT READING THE WHOLE ARRAY

     The session helpers below each filter to a bounded recent window — Asia
     is nine hours, the previous day is twenty-four — and each did it by
     scanning all 1,500 bars and skipping the ones outside. That is free
     when a helper is called once. It is not free in the walk-forward, which
     calls the detector on EVERY scanned bar: hgOgAsiaRange alone is 0.17ms
     on 1,500 rows, and ASIA-BREAK plus KZ-JUDAS spend 183ms of a scan
     re-deriving the same nine hours 2,832 times.

     Bars are time-ordered, so the window is a suffix and the scan can start
     at its first bar instead of at zero. Walking back from the end and
     stopping at the first bar before `fromT` finds that index in as many
     steps as the window is wide.

     Returns 0 when the window reaches past the start of the array, so a
     caller whose window predates its data still reads everything it has —
     the answer is identical, only the work changes. Callers keep their own
     loop bodies and their own filters; this moves the starting line and
     nothing else. */
  function hgOgWindowStart(rows, fromT){
    var from = fin(fromT);
    if (!rows || !rows.length || !isFinite(from)) return 0;
    var i = rows.length - 1, t;
    for (; i >= 0; i--){
      /* a null ENTRY, not just a null field: a feed that drops a bar leaves a
         hole in the middle of the array, and reaching through it threw. Same
         hazard closesOf() in hg-mechanics.js documents. */
      if (!rows[i]) continue;
      t = fin(rows[i].t);
      /* a bar with no usable time cannot end the walk — the caller's own
         filter will skip it, and stopping here could cut the window short */
      if (!isFinite(t)) continue;
      if (t < from) return i + 1;
    }
    return 0;
  }

  function hgOgAsiaRange(rows, nowSec){
    if (!rows || rows.length < 6) return null;
    var last = num(rows[rows.length - 1].t);
    if (!isFinite(last)) return null;
    var refN = fin(nowSec);                       /* NOT isFinite(nowSec): null passes it */
    var ref = isFinite(refN) ? refN : last;
    var dayStart = Math.floor(ref / 86400) * 86400;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l, hr;
    /* the window's own lower bound, so the scan starts where it opens */
    for (i = hgOgWindowStart(rows, dayStart - 3600); i < rows.length; i++){
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
    d = hgOgSweepObHit(rows, opts);             if (d) out.push(d);
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

    /* v677: stamp every hit with the formation-bar timestamp. Detectors
       identify a pattern relative to the closing bar (rows[n-1]) but do
       not record WHEN. The formation timestamp lets the desk enforce
       freshness (soft penalty for stale setups) and lets the walk-forward
       replay compare replay hits to live hits by bar. Cannot regress: a
       detector that already returned t keeps its value (no override). */
    var formT = NaN;
    if (rows.length){
      var lastBar = rows[rows.length - 1];
      if (lastBar && isFinite(fin(lastBar.t))) formT = fin(lastBar.t);
    }
    if (isFinite(formT)){
      for (var oi = 0; oi < out.length; oi++){
        var h = out[oi];
        if (h && !isFinite(fin(h.t))) h.t = formT;
      }
    }
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
    for (i = hgOgWindowStart(rows, prevStart); i < rows.length; i++){
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
  /* v667: London PM Fix is 15:00 LONDON local time. Prior to v667 the
     mechanic hard-coded hr === 15 || hr === 16 in UTC. That works during
     GMT (winter), when London = UTC, but during BST (roughly late March
     to late October, ~7 months of the year) London = UTC+1, so the actual
     15:00 London fix bar lands at 14:00 UTC. Under BST the mechanic never
     fired — half a year of gold trading with LONDON-FIX silently dead.

     Fix: resolve the LONDON local hour from the bar timestamp using
     Intl.DateTimeFormat with Europe/London (DST-aware in every modern
     browser and Node). Feature-checked so an ancient runtime falls back
     to the widened UTC window 14..16, which still catches BST 15:00 (=14
     UTC) and GMT 15:00 (=15 UTC) — not perfect on the shoulder days but
     honest instead of silent. */
  /* v668: generalized version of v667's London-hour helper. Returns the
     local hour in the given IANA tz for a timestamp (seconds since epoch),
     using Intl.DateTimeFormat (DST-aware in every modern runtime). Returns
     NaN if Intl is absent or the tz string is invalid — callers must guard.

     Two callers now depend on this:
       * LONDON-FIX (v667)
       * hgOgLondonRange (v668) — was hard-coded UTC 07..13, wrong under BST
       * hgOgNyOpenDrive (v668) — was hard-coded UTC 13..16, wrong under EST

     Prior to v668 those two used UTC hours as if they were local hours,
     so each mechanic silently skipped roughly half the year: London range
     mis-shifted by an hour under BST, and NY-open-drive missed EST entirely
     (the correct EST 09..12 NY equals 14..17 UTC, but the code checked
     13..16 UTC which is EDT summer only). */
  /* ONE FORMATTER PER TIMEZONE, NOT ONE PER CALL.

     Building an Intl.DateTimeFormat is the expensive half of this function —
     it resolves locale and timezone data — and a fresh one was built on every
     call. Three mechanics ask for a local hour (LONDON-FIX, hgOgLondonRange,
     hgOgNyOpenDrive), the replay walks every bar, and a 600-bar scan spent
     1,467ms in here: 6.2% of the whole scan, more than goldADX or
     goldVolumeProfile. A formatter is stateless and reusable, so it is built
     once per timezone and kept.

     A failed construction is remembered too, so an invalid tz answers NaN
     once per bar instead of throwing once per bar. Behaviour is unchanged on
     every branch: no Intl, a bad tz and a non-finite t all still read NaN,
     and callers still guard for it. */
  var HG_OG_TZ_FMT = Object.create(null);
  function hgOgTzFormatter(tz){
    if (tz in HG_OG_TZ_FMT) return HG_OG_TZ_FMT[tz];
    var f = null;
    try {
      f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false });
    } catch (e) { f = null; }
    HG_OG_TZ_FMT[tz] = f;
    return f;
  }
  function hgOgLocalHour(t, tz){
    if (!isFinite(t) || !tz) return NaN;
    var fmt = hgOgTzFormatter(tz);
    if (!fmt) return NaN;
    try{
      var parts = fmt.formatToParts(new Date(t * 1000));
      for (var i = 0; i < parts.length; i++){
        if (parts[i].type === 'hour') return parseInt(parts[i].value, 10);
      }
    }catch(e){}
    return NaN;
  }
  function hgOgLondonHour(t){
    /* v668: delegate to hgOgLocalHour so both London and NY share one
       DST-aware code path. v667's inline Europe/London Intl block moved
       into hgOgLocalHour so future timezones don't require a new helper. */
    return hgOgLocalHour(t, 'Europe/London');
  }
  function hgOgLondonFix(rows){
    if (!rows || rows.length < 6) return null;
    var last = rows[rows.length - 1];
    var t = num(last.t);
    if (!isFinite(t)) return null;
    /* Try LONDON local hour first (DST-aware). PM Fix is 15:00 London;
       the fix WINDOW extends into 16:00 for late-cross prints. */
    var lhr = hgOgLondonHour(t);
    var inWindow;
    if (isFinite(lhr)){
      inWindow = (lhr === 15 || lhr === 16);
    } else {
      /* Fallback: widen UTC to 14..16 so BST 15:00 (= 14 UTC) still
         qualifies, alongside the prior GMT 15/16 UTC coverage. */
      var uhr = Math.floor((t % 86400) / 3600);
      inWindow = (uhr === 14 || uhr === 15 || uhr === 16);
    }
    if (!inWindow) return null;
    var hr = Math.floor((t % 86400) / 3600);
    /* keep hr in the why-string as the observed UTC hour, unchanged from v666 */
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

  /* v666: gold/silver bars aligned by TIMESTAMP, not by tail-index.

     Prior to v666, three gold-vs-silver mechanics (SMT-DIVERGE, GSR-EXTREME,
     COINT-SPREAD) paired bars by array index: xag[n-1] with rows[m-1],
     xag[n-2] with rows[m-2], etc. That silently assumed both series had
     the same length AND were aligned on the same timestamps.

     Two things break that assumption on real feeds:

       * XAG can arrive with fewer bars than XAU (different provider, gaps,
         session offsets). goldind.js's shared __smtAlignIdx exists exactly
         for this reason, and detectSMTDivergence in goldind.js was already
         fixed to align by timestamp.

       * A single data gap in XAG shifts ALL subsequent pairs by one bar,
         so "gold 10 bars ago vs silver 10 bars ago" can compare different
         time windows. On a fast market that produces phantom divergence
         and phantom GSR z-scores that don't reflect reality.

     hgOgAlignXag walks XAU rows newest -> oldest and, for each, finds the
     nearest XAG bar within maxSkewSec (default 8 min, matching goldind's
     __smtAlignIdx tolerance). It returns pairs oldest-to-newest so callers
     don't have to reverse. Missing XAG for a XAU bar drops that pair, not
     the whole result. */
  function hgOgAlignXag(rows, xag, maxSkewSec){
    if (!rows || !rows.length || !xag || !xag.length) return [];
    var skew = (isFinite(maxSkewSec) && maxSkewSec > 0) ? maxSkewSec : 480;
    /* Prefer the shared __smtAlignIdx helper (goldind.js) so both this
       module and detectSMTDivergence use the exact same tolerance and
       search behaviour. Feature-checked: if absent, fall back to an
       inline linear scan with the same shape. */
    var alignFn = gfn('__smtAlignIdx');
    function findIdx(t){
      if (typeof alignFn === 'function'){
        try{ var i = alignFn(xag, t, skew); if (isFinite(i)) return i; }catch(e){}
      }
      var best = -1, bestD = Infinity, i2;
      for (i2 = xag.length - 1; i2 >= 0; i2--){
        var xg = xag[i2];
        if (!xg || !isFinite(xg.t)) continue;
        var d = Math.abs(xg.t - t);
        if (d <= skew && d < bestD){ bestD = d; best = i2; }
      }
      return best;
    }
    var pairs = [], i, r, j;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      if (!r || !isFinite(r.t)) continue;
      j = findIdx(r.t);
      if (j < 0) continue;
      var sr = xag[j];
      if (!sr) continue;
      var gc = num(r.c), sc = num(sr.c);
      if (!isFinite(gc) || !isFinite(sc)) continue;
      pairs.push({ t: r.t, gc: gc, sc: sc, gh: num(r.h), gl: num(r.l), sh: num(sr.h), sl: num(sr.l) });
    }
    return pairs;
  }

  /* Gold against silver. Real desks watch the pair; macro-feeds.js already
     fetches the silver series. With no silver this returns null rather than
     guessing — a mechanic that cannot see its second leg has no signal. */
  function hgOgSmtDiverge(rows){
    if (!rows || rows.length < 20) return null;
    var w = W();
    var xag = w && w.__hgXagCandles;
    if (!xag || xag.length < 20) return null;
    /* v666: timestamp-align the two series before comparing 10-bar legs. */
    var pairs = hgOgAlignXag(rows, xag);
    if (pairs.length < 12) return null;
    var last = pairs[pairs.length - 1];
    var prior = pairs[pairs.length - 11];
    if (!last || !prior) return null;
    if (!isFinite(last.gc) || !isFinite(last.sc)
     || !isFinite(prior.gc) || !isFinite(prior.sc)) return null;
    var gUp = last.gc > prior.gc, sUp = last.sc > prior.sc;
    if (gUp === sUp) return null;                      /* aligned — no divergence */
    var gMove = Math.abs(last.gc - prior.gc) / Math.max(1e-9, Math.abs(prior.gc));
    var sMove = Math.abs(last.sc - prior.sc) / Math.max(1e-9, Math.abs(prior.sc));
    if (gMove < 0.002 || sMove < 0.002) return null;   /* both legs must have moved */
    return { kind:'SMT-DIVERGE', dir: gUp ? 'short' : 'long', level: last.gc,
             why:'gold ' + (gUp ? 'up' : 'down') + ' while silver ' + (sUp ? 'up' : 'down')
                 + ' over 10 aligned bars — the metals disagree' };
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
    /* v666: pair each XAU bar with its TIMESTAMP-nearest XAG bar. Tail-index
       pairing broke the ratio series any time XAG was a different length or
       had a data gap. */
    var pairs = hgOgAlignXag(rows, xag);
    if (pairs.length < 60) return null;
    var ratio = [], i, g, s;
    for (i = 0; i < pairs.length; i++){
      g = pairs[i].gc; s = pairs[i].sc;
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
    /* v666: pair by timestamp so the cointegration test sees real synchronous
       observations. Tail-index pairing broke the alignment on data-gap days
       and on cross-provider legs of different length. */
    var pairsAll = hgOgAlignXag(rows, xag);
    var pairs = pairsAll.length > 300 ? pairsAll.slice(-300) : pairsAll;
    if (pairs.length < 120) return null;
    var a = [], b = [], i, ga, sa;
    for (i = 0; i < pairs.length; i++){
      ga = pairs[i].gc; sa = pairs[i].sc;
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

  /* v668: London session range measured in LONDON local hours, not UTC.
     Previously hard-coded UTC 07..13, which is correct under GMT but under
     BST (~7 months of the year) drops to UTC 06..12, so bars at 07:00 UTC
     (= 08:00 BST) were included when they should have been the *second*
     hour of the London session, and bars at 06:00 UTC (= 07:00 BST) — the
     real London open under BST — were excluded. This propagates into
     NY-OPEN-DRIVE, which reads london.hi/lo as the level to break through.
     Falls back to the prior UTC window if Intl is absent. */
  function hgOgLondonRange(rows){
    if (!rows || rows.length < 8) return null;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT)) return null;
    var dayStart = Math.floor(lastT / 86400) * 86400;
    var hi = -Infinity, lo = Infinity, n = 0, i, t, h, l, lhr;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < dayStart || t >= dayStart + 86400) continue;
      lhr = hgOgLocalHour(t, 'Europe/London');
      if (isFinite(lhr)){
        if (!(lhr >= 7 && lhr < 13)) continue;
      } else {
        /* Intl absent — fall back to a widened UTC window that catches BST
           07:00 London (= 06:00 UTC) alongside GMT 07:00 (= 07:00 UTC). */
        var uhr = hgOgBarHour(rows[i]);
        if (!(uhr >= 6 && uhr < 13)) continue;
      }
      h = num(rows[i].h); l = num(rows[i].l);
      if (isFinite(h) && h > hi) hi = h;
      if (isFinite(l) && l < lo) lo = l;
      n++;
    }
    if (n < 3 || !isFinite(hi) || !isFinite(lo) || !(hi > lo)) return null;
    return { hi: hi, lo: lo, bars: n };
  }

  /* v668: NY-open-drive window measured in NEW YORK local hours (09..12),
     not UTC. Previously hard-coded UTC 13..16 — correct under EDT (summer,
     NY = UTC-4) but under EST (winter, NY = UTC-5) 09..12 NY = 14..17 UTC,
     so the mechanic missed the entire NY morning window for ~5 months of
     the year. Falls back to a widened UTC window (13..17) if Intl is
     absent, catching both EDT and EST NY 09..12. */
  function hgOgNyOpenDrive(rows){
    try{
      if (!rows || rows.length < 16) return null;
      var london = hgOgLondonRange(rows);
      if (!london) return null;
      var last = rows[rows.length - 1];
      var t = num(last.t);
      if (!isFinite(t)) return null;
      var nhr = hgOgLocalHour(t, 'America/New_York');
      var inWindow;
      if (isFinite(nhr)){
        inWindow = (nhr >= 9 && nhr < 12);
      } else {
        /* Intl absent — fall back to a widened UTC window that covers both
           EDT NY 09..12 (= 13..16 UTC) and EST NY 09..12 (= 14..17 UTC). */
        var uhr = hgOgBarHour(last);
        inWindow = (uhr >= 13 && uhr < 17);
      }
      if (!inWindow) return null;
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

  /* v669: FX/gold trading week opens at 17:00 NEW YORK time on Sunday,
     not Monday 00:00 UTC. Under EST that's Sunday 22:00 UTC; under EDT
     that's Sunday 21:00 UTC. Prior to v669 the week open was pinned to
     Monday 00:00 UTC, so the WEEKLY-OPEN mechanic:
       * missed the first 2–3 hours of every real trading week (Sunday
         22:00–24:00 UTC in EST, or 21:00–24:00 UTC in EDT), and
       * during Monday 00:00–17:00 UTC it read the Monday-00:00 hourly bar
         as the "weekly open" instead of the actual Sunday-evening bar
         where the true weekly-open price prints.
     Fix: resolve the most recent Sunday 17:00 America/New_York and treat
     the first bar at-or-after that instant as the weekly open. Falls back
     to a widened UTC window (Sunday 21:00 UTC) if Intl is absent — correct
     under EDT, off by an hour in EST but still much better than Monday 00. */
  function hgOgWeekOpenPx(rows){
    if (!rows || !rows.length) return NaN;
    var lastT = num(rows[rows.length - 1].t);
    if (!isFinite(lastT)) return NaN;
    /* Walk back day-by-day up to 8 days looking for a Sunday whose local NY
       hour crosses 17. Cap the walk at 8 days so an Intl misfire cannot
       spin. `stepStart` is a UTC-midnight-aligned second-of-day for the day
       we are testing. */
    var todayStart = Math.floor(lastT / 86400) * 86400;
    var weekOpenT = NaN;
    var stepStart, dow, cand, nhr;
    for (var back = 0; back <= 8; back++){
      stepStart = todayStart - back * 86400;
      dow = new Date(stepStart * 1000).getUTCDay(); /* 0 = Sunday */
      if (dow !== 0) continue;
      /* Try each hour of that Sunday from 20..23 UTC and pick the first that
         hits 17 NY local (that covers both EDT 21 UTC and EST 22 UTC). */
      var picked = NaN;
      for (var hh = 20; hh <= 23; hh++){
        cand = stepStart + hh * 3600;
        nhr = (typeof hgOgLocalHour === 'function') ? hgOgLocalHour(cand, 'America/New_York') : NaN;
        if (isFinite(nhr) && nhr === 17){ picked = cand; break; }
      }
      if (isFinite(picked)){ weekOpenT = picked; }
      else {
        /* Intl absent — use Sunday 21:00 UTC as the widened fallback (correct
           under EDT summer, one hour early under EST winter). Still better
           than Monday 00:00 which lost 2–4 hours of every trading week. */
        weekOpenT = stepStart + 21 * 3600;
      }
      if (weekOpenT > lastT) continue; /* Sunday in the future — rare, skip */
      break;
    }
    if (!isFinite(weekOpenT)) return NaN;
    var i, t, first = null;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t < weekOpenT) continue;
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
        /* fin(), NOT isFinite(): isFinite(null) is true and +null is 0, so a
           null clock became midnight 1970 rather than falling back to now */
        now: isFinite(fin(opts.nowSec))
               ? (fin(opts.nowSec) > 1e12 ? fin(opts.nowSec) : fin(opts.nowSec) * 1000)
               : Date.now(),
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
  /* hg-v923 — SWEEP->OB as a native OMNIGOLD mechanic, CONFIRMED ONLY.

     goldind's hgGoldSweepOb has run on every gold scan since hg-v560 and mints
     on GOLD SCALP, stamps on GOLD SWING, and paints in the forming panel here
     — but it was never registered as a mechanic of this desk, so OMNIGOLD
     could not form it. Every other library model got an explicit wire pack
     (P4 in v568, P5 v569, P6 v570, P7 v571, VP v567). This one was missed.

     IT MINTS ONLY ON `confirmed`. That is the full four-leg model: HTF
     location, liquidity raid, MSS, retrace into a fresh OB/FVG, quality
     >= 7/10 AND R:R >= 2.0. The GOLD SCALP mint also accepts tier 'watch' and
     demotes it; this desk does not, because an OMNIGOLD card IS a ticket
     candidate and the watch tier has no target and no R:R to ticket with.

     THIS MECHANIC HAS NO RECORD, and that is not a formality. All 62 sweepob
     firings in the GOLD SCALP walk came from a pre-trigger early return —
     0 confirmed — so the +0.16R on HG_GOLD_SETUP_EDGE.scalp.sweepob is the
     precursor's record, not this one's. hgOgKindKnownState derives 'unobserved'
     for it automatically from the baked maps, so the card says NEVER OBSERVED
     without a list to maintain. Nothing here promotes it and no gate moves:
     hgOgKindToInstKey maps it to `sweepob`, whose edge action is `neutral`. */
  function hgOgSweepObHit(rows, opts){
    var f = gfn('hgGoldSweepOb');
    if (!f || !rows || rows.length < 40) return null;
    opts = opts || {};
    var sob = null;
    try {
      sob = f(rows, {
        newsGate: opts.newsGate || null,
        now: opts.nowSec ? opts.nowSec * 1000 : opts.now,
        rows4h: opts.rows4h || null,
        rows1h: opts.rows1h || null
      });
    } catch (e) { return null; }
    /* confirmed is the whole gate. `stage` is checked too so a future edit to
       the tier ladder cannot quietly let a precursor through this door. */
    if (!sob || !sob.confirmed || sob.stage !== 'confirmed' || !sob.dir) return null;
    var lv = fin(sob.entry);
    if (!isFinite(lv)) return null;
    var stop = fin(sob.stop), t1 = fin(sob.t1), t2 = fin(sob.t2);
    if (!isFinite(stop) || !isFinite(t1)) return null;
    return {
      kind: 'SWEEP-OB', dir: sob.dir, level: lv,
      stop: stop, t1: t1, t2: isFinite(t2) ? t2 : NaN,
      sweepOb: sob,
      why: String(sob.why || 'SWEEP-OB confirmed')
    };
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
    'SWEEP-OB':'SWEEP',
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
  /* TWO PLANS A FEW CENTS APART ARE ONE TRADE.

     This key used to compare entry and stop at EIGHT significant figures,
     so 4713.89 and 4713.91 were two separate cards wearing two mechanic
     names. Measured on the walk, that exactness is most of why the desk
     published 9.34 plans per 4h bar.

     The tolerance is a share of price, not of the plan's own risk: keying
     on each plan's risk would make the key asymmetric — A collapses into B
     but B does not collapse into A. At 0.10% of a $4,700 gold price the
     grid is about $4.70, comfortably inside the $23 the stop floor
     already requires, so nothing this merges could have been two trades a
     person would size differently. */
  var OG_TRADE_KEY_TICK_PCT = 0.10;

  /* A LOG GRID, and the reason matters.

     The obvious implementation — divide by a tick that is a percentage of
     the level itself — is broken, and broken in a way that silently merges
     everything: 4366.19 / (4366.19 * 0.001) and 4300.00 / (4300.00 * 0.001)
     are BOTH 1000. Every price maps to the same bucket because the divisor
     scales with the dividend. A test that had two setups 66 dollars apart
     caught it; without that test this would have collapsed the whole book
     into one card per direction.

     ln(x) / ln(1 + tick) is the same proportional tolerance on ONE shared
     grid, so it is symmetric — A and B agree on whether they are the same
     trade regardless of which is asked — and it works on a $30 silver
     price and a $4,700 gold price alike.

     GRID BOUNDARIES ARE A REAL LIMIT, stated rather than glossed. Two
     levels a hair apart that straddle a bucket edge do NOT collapse —
     4713.89 and 4713.91 are four thousandths of a tick apart and land
     either side of one. Merging those needs neighbour-aware clustering,
     which a key function used as a hash cannot do.

     For a separation d and tick t the miss rate is d/t, so at two cents on
     a $4.70 tick it is about 0.4% of such pairs. It is a MISSED merge, not
     a wrong one: the desk shows two cards where one would have done, which
     is the safe direction to fail.

     This is also the minor lever. Measured on the walk, level tolerance
     takes the desk from 42 cards a day to 31; the lane throttle below
     takes it to 6.3, and boundary misses do not touch that at all. */
  var OG_TRADE_KEY_LOG_STEP = Math.log(1 + OG_TRADE_KEY_TICK_PCT / 100);

  function ogQuantiseLevel(v){
    var x = fin(v);
    if (!isFinite(x) || !(x > 0)) return 'na';
    if (!(OG_TRADE_KEY_LOG_STEP > 0)) return x.toPrecision(8);
    return String(Math.round(Math.log(x) / OG_TRADE_KEY_LOG_STEP));
  }

  function ogTradeKey(c){
    var pl = (c && c.plan) || {};
    var e = ogQuantiseLevel(pl.entry);
    var st = ogQuantiseLevel(pl.stop);
    /* Horizon is part of the key: the same levels on SCALP and SWING are
       genuinely two tickets, with different targets and different time stops. */
    return String(c && c.horizon) + '|' + String(c && c.dir) + '|' + e + '|' + st;
  }

  /* HOW LONG A LANE STAYS OCCUPIED.

     A lane is one direction on one horizon. Publishing a second card into
     a lane whose last card is still running is publishing a trade the
     reader cannot take — they hold one gold position, not fifty-five.

     These numbers are the MEASURED median time from fire to exit on the
     walk, including the wait for a fill, not a swept parameter:

       SCALP long   n=3273   median  8h   p75 22h
       SCALP short  n=3136   median  8h   p75 22h
       SWING long   n= 910   median 28h   p75 68h
       SWING short  n= 813   median 32h   p75 88h

     Applied per lane this takes the desk from 45.9 cards a day to 6.3.

     IT IS NOT AN EDGE PLAY, and the measurement says so plainly. Sweeping
     cool-down lengths from 4h to 48h, every gross confidence interval
     spans zero (max |t| 1.04 across five tries, Bonferroni bar 2.58), and
     the apparent gain at 24-48h evaporates under randomisation: taking the
     FIRST eligible signal grosses +0.061R where a RANDOM eligible one in
     the same window grosses -0.032R. The gap is the artifact. What the
     cool-down actually buys is a publication rate a person can act on, and
     rows that overlap less so the intervals mean something. */
  var OG_LANE_COOLDOWN_H = { SCALP: 8, SWING: 28 };
  var OG_LANE_COOLDOWN_DEFAULT_H = 8;

  function hgOgLaneCooldownMs(horizon){
    var h = String(horizon || '').toUpperCase();
    var hrs = OG_LANE_COOLDOWN_H[h];
    if (!isFinite(hrs) || !(hrs > 0)) hrs = OG_LANE_COOLDOWN_DEFAULT_H;
    return hrs * 3600000;
  }

  function ogLaneKey(c){
    return String(c && c.dir) + '|' + String(c && c.horizon);
  }

  /* PURE. Takes the already-collapsed, already-ranked list and the map of
     when each lane last published; returns the list to show plus the map
     to keep. Mutates nothing — a filter that edited the caller's state
     would make two renders of the same scan disagree.

     `now` is passed in rather than read from the clock so a test can drive
     it, and so a re-render of the SAME scan cannot age its own cards out
     from under the reader. */
  function hgOgLaneThrottle(list, lastByLane, now){
    var out = [], held = {}, i, c, lane, at, k;
    for (k in (lastByLane || {})) if (Object.prototype.hasOwnProperty.call(lastByLane, k)) held[k] = lastByLane[k];
    var t = fin(now);
    if (!isFinite(t)) t = 0;
    for (i = 0; i < (list || []).length; i++){
      c = list[i];
      if (!c) continue;
      lane = ogLaneKey(c);
      at = fin(held[lane]);
      /* a card whose lane is quiet publishes and claims the lane; one whose
         lane is still running is suppressed, with the reason recorded on it
         so the desk can say why rather than silently showing less */
      if (isFinite(at) && t > 0 && (t - at) < hgOgLaneCooldownMs(c.horizon)){
        c.laneThrottled = true;
        continue;
      }
      c.laneThrottled = false;
      held[lane] = t;
      out.push(c);
    }
    return { shown: out, lastByLane: held };
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
      /* a null ENTRY, not just a null field — closesOf() in hg-mechanics.js
         documents the same hazard: a dropped bar leaves a hole in the array
         and reaching through it threw from inside whichever gate called first */
      if (!rows[i] || !rows[i - 1]) continue;
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
  function hgOgKindToInstKey(kind, strict){
    var k = String(kind || '').toUpperCase();
    if (k === 'ASIA-BREAK') return 'asian';
    if (k === 'OB-RETEST') return 'ob';
    if (k === 'VP-PLAYBOOK') return 'vpbook';
    /* the same stratKey GOLD SCALP mints, so the inst filter applies the same
       sweep rules (MSS + displacement + IFVG) and the edge table finds the
       same `neutral` row. Nothing is given a new lane. */
    if (k === 'SWEEP-OB') return 'sweepob';
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
      return (strict ? null : 'sweep');
    /* hg-v923: the two lines above and below are FALLBACKS — a kind with no
       named mapping still has to run through SOME institutional rule set, so
       it gets the generic one. That is right for gating and wrong for
       attribution: it means every unmapped mechanic resolves to `vwap`, and a
       caller that looks up an edge record by this key would hand that
       mechanic the vwap row's number. `strict` returns null instead, for
       callers that need "which record is genuinely this mechanic's". */
    return (strict ? null : 'vwap');
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

  /* Same hgGoldInstFilter stack as GOLD SCALP / GOLD SWING. Reports
     UNCHECKED when goldind.js is not loaded or the filter throws — the
     caller turns that into an unchecked-soft ledger row, which does not veto
     and does not count as a check that ran. Does not move hit.level or
     rewrite the stop — it only returns a veto. */
  function hgOgInstFilterHit(hit, rows, extra){
    extra = extra || {};
    hit = hit || {};
    var fn = gfn('hgGoldInstFilter');
    if (typeof fn !== 'function'){
      return { dropped: false, reason: 'goldind inst filter not loaded — not checked', unchecked: true };
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
      return { dropped: false, reason: 'inst filter threw — not checked', unchecked: true };
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

    /* FILL-PATH — a limit ticket whose retest route crosses T1 before the
       entry can fill is not a coherent resting-order plan. Example: SHORT
       limit above market with T1 sitting between market and entry — the
       rally to fill crosses TP1 first. */
    var fpOk = null, fpWhy = 'fill path not judged';
    if (plHas && plObj && isFinite(lfPx) && lfPx > 0){
      var fpE = fin(plObj.entry), fpT1 = fin(plObj.t1);
      if (isFinite(fpE) && isFinite(fpT1)){
        if (hit.dir === 'short' && lfPx < fpE && fpT1 > lfPx && fpT1 < fpE){
          fpOk = false;
          fpWhy = 'T1 ' + fpT1.toFixed(2) + ' sits between market ' + lfPx.toFixed(2)
                + ' and entry ' + fpE.toFixed(2) + ' — retest crosses TP1 before the limit fills';
        } else if (hit.dir === 'long' && lfPx > fpE && fpT1 < lfPx && fpT1 > fpE){
          fpOk = false;
          fpWhy = 'T1 ' + fpT1.toFixed(2) + ' sits between market ' + lfPx.toFixed(2)
                + ' and entry ' + fpE.toFixed(2) + ' — retest dips through TP1 before the limit fills';
        } else {
          fpOk = true;
          fpWhy = 'retest path does not cross T1 before entry';
        }
      }
    } else if (plObj && plObj.fillPathCross === true){
      fpOk = false;
      fpWhy = 'retest path crosses T1 before the limit can fill';
    }
    gates.push({ key:'fill-path', hard:false, info:true, pass: fpOk, why: fpWhy });

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
       legitimately born there) but it is reported.

       THE INSTANT (hg-v698 audit closeout). This gate used to read the stamp
       runScan computed once per scan from Date.now() (extra.killzone — the
       WALL CLOCK) while the session confluence LEG reads the CLOSED SIGNAL
       BAR through hgGoldSignalBarMs. One session rule, two instants: on a
       5-minute auto-refresh the gate and the leg could describe different
       moments on the same card, and the gate's answer moved with no new bar.
       The stamp is now taken on the SAME closed-bar instant, through the
       SAME shared helper the leg uses, whenever gold-formation.js and the
       killzone module are both loaded. Pass semantics are unchanged —
       decisive intraday, contextual on swing. Reads that genuinely ARE about
       "now" keep the wall clock on purpose: the weekend-exposure gate (can
       this ticket be placed on a live book?) and the inst-filter news
       lockout still read x.nowSec. Without the shared helper this falls back
       to the caller's stamp exactly as before, so harnesses that do not load
       gold-formation.js are unchanged. Unreadable bars fail closed to
       UNCHECKED — never borrowed from the wall clock, matching the leg. */
    var sessKz = x.killzone || null;
    var sessWhy = 'killzone module unavailable';
    try {
      var sgBarMsFn = gfn('hgGoldSignalBarMs');
      var sgKzFn = gfn('goldKillzone');
      if (sgBarMsFn && sgKzFn){
        var sgBarMs = fin(sgBarMsFn(rows));
        if (isFinite(sgBarMs)){
          var sgStamp = null;
          try { sgStamp = sgKzFn(sgBarMs); } catch (eSgKz){ sgStamp = null; }
          if (sgStamp && sgStamp.zone) sessKz = sgStamp;
        } else {
          sessKz = null;
          sessWhy = 'session instant unreadable on the closed signal bar — session not judged (fail closed)';
        }
      }
    } catch (eSessKz){}
    var sess = null;
    if (sessKz && sessKz.zone){
      var z = String(sessKz.zone);
      var inKz = (z !== 'OFF');
      /* Session is decisive INTRADAY and merely contextual on the swing
         horizon — a 4h structure is legitimately born at any hour, and
         vetoing it for the clock (as the first live build did) grades it
         against a scalper's model. The comment said this; the code did not. */
      if (x.sessionHard === false){
        sess = true;
        sessWhy = 'session ' + (sessKz.label || z)
                + (inKz ? '' : ' — off-hours, context only at swing horizon');
      } else {
        sess = inKz;
        sessWhy = 'session ' + (sessKz.label || z) + (inKz ? '' : ' — outside the London/NY killzones');
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

    /* A plan is priceable only when the engine produced one. Both gates
       below are HARD when there is a plan to judge and UNCHECKED when there
       is not: "we cannot price a plan that does not exist" is missing data,
       not a veto, and plans.js is absent in some harnesses by design (see
       the ex.plan note at the call site). */
    var planRisk = fin(x.planRisk);
    /* Both gates below are a ratio of the STOP DISTANCE to the PRICE OF
       GOLD, and the price of gold does not depend on there being a plan —
       the bars carry it. So the reference falls back: the plan's own entry
       first, then the live mark, then the last close. Requiring plan.entry
       here made both gates read UNCHECKED for every caller that supplies a
       stop distance without a plan object, which is most of the harnesses
       and was never the intent. */
    var planEntry = (x.plan && isFinite(fin(x.plan.entry)) && fin(x.plan.entry) > 0)
      ? fin(x.plan.entry)
      : ((isFinite(fin(x.livePx)) && fin(x.livePx) > 0) ? fin(x.livePx)
        : ((lastBar && isFinite(fin(lastBar.c)) && fin(lastBar.c) > 0) ? fin(lastBar.c) : NaN));
    var priceable = isFinite(planRisk) && planRisk > 0 && isFinite(planEntry) && planEntry > 0;

    /* 11a — STOP FLOOR.

       WHAT THIS GATE USED TO CLAIM, AND WHY IT NO LONGER DOES.

       hg-v752 shipped this floor on a measurement: a stop inside ~0.5% of
       entry "loses GROSS, before any cost, in every decile", total -9,768R
       -> -1,092R, gross flipping positive at +0.008R. That number is the
       LOWER BOUND of the unprovable-fill interval — the end that deletes
       every unprovable win and keeps every unprovable loss. Re-run across
       the interval on the same walk:

         below the floor   above the floor
           -0.2989R          +0.0084R      lower bound (what v752 quoted)
           +0.0030R          +0.0474R      dropping all unprovable rows
           +0.2888R          +0.0568R      upper bound

       The sign reverses. At the far end this floor deletes the most
       profitable half of the book. And it reverses for a reason that is not
       coincidence: a tight stop is exactly the plan whose fill bar spans
       both levels, so the unprovable population is concentrated precisely
       in the bucket being judged. The floor was fitted to an artifact of
       the bound it was measured at.

       IT STAYS, ON THE OTHER ARGUMENT. A stop inside 0.5% of gold pays a
       spread that is a large fraction of 1R, and that is arithmetic rather
       than a fitted outcome. cost-drag enforces it at the live venue and is
       the load-bearing gate; this floor is the venue-independent floor
       under it. What has gone is the claim to a measured outcome edge,
       because the walk cannot carry it.

       Only finer bars inside the fill hour can settle which end of that
       interval is true — scripts/resolve-unprovable-1m.mjs. Until then this
       gate says what it is: a cost floor, not a measurement. */
    var stopPct = priceable ? (planRisk / planEntry) : NaN;
    var floorOk = priceable ? (stopPct >= GOLD_STOP_MIN_PCT) : null;
    gates.push({ key:'stop-floor', hard: priceable, pass: floorOk,
      why: priceable
        ? ('stop $' + planRisk.toFixed(2) + ' = ' + (stopPct * 100).toFixed(3)
           + '% of entry (floor ' + (GOLD_STOP_MIN_PCT * 100).toFixed(2) + '%)'
           + (floorOk ? '' : ' — too tight to carry a spread. This floor is a COST rule: '
                + 'the outcome evidence once quoted for it spans a sign change across the '
                + 'unprovable-fill interval and is not a measurement'))
        : 'no plan risk to measure' });

    /* 11b — cost drag. A stop can be structurally correct and still be
       untradeable: the walk-forward measures GROSS outcomes, so a tight
       intraday stop can show a healthy R multiple that the spread then eats.
       On the first live scalp card a 3.16-point stop meant a $0.30 spread
       was 19% of 1R, turning a measured +0.38R into roughly +0.19R net.

       PRICED AT THE VENUE ACTUALLY SELECTED, and HARD. It used to be
       neither. It read ASSUMED_SPREAD_USD — the XM spread — whatever venue
       the desk was set to, and then pushed hard:false, so it flagged the
       trade and let it through. At XM that threshold declines 7% of the
       walk's plans; priced at PAXG, where the same walk's outcomes were
       measured, it declines 85%. Those 85% average -1.24R net. A gate that
       names the reason a trade cannot pay and then waves it through is not
       a gate, and hgOgVenueCost() has been sitting here the whole time. */
    var cost = null, costWhy = 'no plan risk to cost';
    if (priceable){
      var vc = null;
      try { vc = hgOgVenueCost(); } catch (eVc) { vc = null; }
      /* fail closed: an unreadable venue prices as the conservative preset,
         never as free */
      var rtPct = (vc && isFinite(fin(vc.rtCostPct)) && fin(vc.rtCostPct) > 0)
        ? fin(vc.rtCostPct) : hgOgRtCostPct();
      var venueName = (vc && vc.venue) ? String(vc.venue) : 'PAXG';
      var rt = planEntry * rtPct / 100;
      var costR = rt / planRisk;
      var costCeil = (x.sessionHard === true) ? COST_VETO_R_SCALP : COST_VETO_R;
      cost = costR <= costCeil;
      costWhy = venueName + ' round-trip ' + rtPct.toFixed(3) + '% ≈ $' + rt.toFixed(2)
              + ' on a $' + planRisk.toFixed(2) + ' stop = '
              + (costR * 100).toFixed(0) + '% of 1R (ceiling ' + (costCeil * 100).toFixed(0) + '%)'
              + (costR > costCeil ? ' — the spread would eat most of the edge'
                 : (costR > COST_WARN_R ? ' — material drag, size accordingly' : ''));
      /* hg-v919: when it VETOES, say what the ceiling actually demands. A
         reader told "43% of 1R (ceiling 15%)" knows the trade failed; they do
         not know the rule is asking for a $78 stop because the venue is PAXG,
         and would ask $6 at XM. The ratio is the rule; the width is the ask. */
      if (costR > costCeil){
        var demand = hgOgCostCeilingNote({ scalp: x.sessionHard === true, px: planEntry, venueCost: vc });
        if (demand) costWhy += ' · ' + demand;
      }
    }
    gates.push({ key:'cost-drag', hard: priceable, pass: cost, why: costWhy });

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
       judged by significance against the breakeven rate for this R floor.

       WHY THIS Z IS NOT DEFLATED FOR OVERLAP, WHEN EVERY OTHER ONE IS.

       hg-v818 put the replay panel's sigma on the effective sample and the
       horizon-pool promotion refuses to promote at all without a measured
       overlap ratio. This one deliberately does neither, and the reason
       lives in ANOTHER FILE: hgOmniBacktestOne (omniroute.js) advances
       `i += horizon` after every signal, so the samples it returns are
       already sequential — a trade one account could have taken, one at a
       time. hgOgEffN states the rule this satisfies: a book with no overlap
       is not deflated, and effN == n for it.

       So there is nothing here to correct, and correcting it anyway would
       count the same discount twice. But the validity of this gate's sigma
       is a property of a line in a different file, which is the kind of
       coupling that gets refactored away by someone who has no idea it is
       load-bearing: delete that stride and this sigma inflates by about
       sqrt(horizon), 4.5x at horizon 20, and mechanics start reading "has
       paid" on one move counted twenty times. test-omnigold-round2 asserts
       the stride behaviourally — a detector firing on every bar must still
       come back with about one sample per horizon — so the invariant fails
       loudly here rather than silently promoting. */
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
      /* WHICH POPULATION IS STILL GROWING.

         Judging on tickets alone was a deadlock the moment measured-edge
         went hard: no ticket issues, so ticketOnly can never reach
         FWD_MIN_JUDGE, so this branch never runs, so the gate can never
         promote a mechanic — the gate became the only thing able to clear
         the gate. gateClear is the same ledger with the gate under test
         excluded from its own entry requirement, so it keeps accumulating
         and the anti-circularity `ticket` was protecting stays intact: it
         is still only setups this ledger cleared, never all firings.

         Tickets are preferred when there are enough of them, so records
         written before hg-v757 keep deciding exactly as they used to. */
      var tix = fwd.ticketOnly;
      var tN = tix ? fin(tix.samples) : NaN;
      var tHit = tix ? fin(tix.hit) : NaN;
      var clr = fwd.gateClear;
      var cN = clr ? fin(clr.samples) : NaN;
      var cHit = clr ? fin(clr.hit) : NaN;

      var judgeN = NaN, judgeHit = NaN, judgeLabel = '';
      if (isFinite(tN) && tN >= FWD_MIN_JUDGE){
        judgeN = tN; judgeHit = tHit; judgeLabel = 'settled TICKETS';
      } else if (isFinite(cN) && cN >= FWD_MIN_JUDGE){
        judgeN = cN; judgeHit = cHit;
        judgeLabel = 'settled setups that cleared every gate but this one';
      }
      /* AND IF THOSE RECORDS KNOW WHETHER THE ORDER FILLED, USE THAT.

         The hit rate above assumes the position opened at `entry` on the
         bar after the signal. A resting order does no such thing, and the
         error runs one way per order type: a limit can book a win it never
         opened for, a stop entry a loss it never opened for. Records
         carrying a mark are settled both ways (hgFwdSettleFill), and where
         enough of them exist the fill-aware count is the one that describes
         a trade somebody could have had.

         Preferred only when it clears FWD_MIN_JUDGE on its own, so a log
         that is mostly legacy records keeps deciding exactly as before
         rather than on a handful of new ones. */
      var judgeSrc = (isFinite(tN) && tN >= FWD_MIN_JUDGE) ? tix
                   : ((isFinite(cN) && cN >= FWD_MIN_JUDGE) ? clr : null);
      if (judgeSrc){
        var fillN = fin(judgeSrc.fillSamples), fillHit = fin(judgeSrc.fillHit);
        if (isFinite(fillN) && fillN >= FWD_MIN_JUDGE && isFinite(fillHit)){
          judgeN = fillN; judgeHit = fillHit;
          judgeLabel = judgeLabel.replace(/^settled /, 'FILLED ');
          if (fin(judgeSrc.fillUnfilled) > 0){
            judgeLabel += ' (' + fin(judgeSrc.fillUnfilled) + ' never filled, excluded)';
          }
        }
      }

      if (isFinite(judgeN) && isFinite(judgeHit)){
        var fse = Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / judgeN));
        var fz = (judgeHit - fBreak) / fse;
        var fzTxt = ' [' + (fz >= 0 ? '+' : '') + fz.toFixed(2) + 'σ vs breakeven]';
        var tixTxt = judgeN + ' ' + judgeLabel + ' · ' + (judgeHit * 100).toFixed(0) + '% T1-first';
        /* THE VETO IS MECHANIC-SPECIFIC AND STAYS THAT WAY.

           Condemning a mechanic is a claim about that mechanic, so it is
           made on evidence about that mechanic. Nothing here changed. */
        if (fz <= EDGE_VETO_Z){
          ed = false;
          edWhy = tixTxt + fzTxt + ' — the trades this ledger actually cleared have not paid'
                + (fN > judgeN ? ' (of ' + fN + ' settled firings overall)' : '');
        } else if (fz >= hgOgFamilyZ(OG_MECHANICS.length)){
          /* THE MECHANIC CARRIED IT ON ITS OWN. Rare, and the strongest
             evidence available: this mechanic, out of sample, clearing the
             bar set for having searched every mechanic. Kept because when
             it does happen it beats any pooled argument. */
          ed = true;
          edWhy = tixTxt + fzTxt + ' — clears the ' + OG_MECHANICS.length
                + '-mechanic bar on its own out-of-sample record';
        } else {
          /* NOT CONDEMNED IS NOT PROOF.

             This used to read PASS for anything merely better than -2σ, so
             a mechanic sitting at breakeven on twenty trades was "measured
             out-of-sample" and issued tickets. That is not evidence of an
             edge, it is an absence of evidence against one. Such a mechanic
             can still be promoted below, on the horizon's whole book, where
             the sample is big enough to carry the claim. */
          ed = null;
          edWhy = tixTxt + fzTxt + ' — not condemned, but not proof of an edge on its own record';
        }
      } else if (fN >= FWD_MIN_JUDGE && isFinite(fHit)){
        /* Enough settled FIRINGS to describe, not enough cleared TICKETS to
           condemn. Report, do not veto. */
        var az = (fHit - fBreak) / Math.sqrt(Math.max(1e-9, fBreak * (1 - fBreak) / fN));
        ed = null;
        var clearedN = isFinite(cN) ? cN : (isFinite(tN) ? tN : 0);
        edWhy = fTxt + ' [' + (az >= 0 ? '+' : '') + az.toFixed(2) + 'σ vs breakeven]'
              + ' — but only ' + clearedN + ' of those were setups this ledger cleared, '
              + 'too few to judge the mechanic on (' + FWD_MIN_JUDGE + ' needed). Reported, not vetoed.';
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

    /* ===== PROMOTION RUNS ON THE HORIZON'S WHOLE BOOK =====================

       Per-mechanic evidence costs twice over. The data splits 108 ways (54
       mechanics x 2 horizons), AND the significance bar is +3.11 sigma
       precisely BECAUSE there are 54 of them. Together those put a verdict
       out of reach: about 0.05 usable records per cell per day against a
       threshold of 20 is roughly a year per mechanic, and the log's own cap
       prunes faster than that. A test that can never conclude is not a
       strict test, it is no test.

       So promotion asks a question the data can answer: does this HORIZON's
       cleared book beat breakeven? One test per horizon, so the bar is the
       2-comparison one rather than the 54-comparison one, and every cleared
       setup on the desk feeds it instead of one mechanic's slice.

       The asymmetry is deliberate and is the whole design:
         CONDEMN a mechanic only on evidence about that mechanic
         PROMOTE only on evidence big enough to mean something
       A mechanic already vetoed above is NEVER promoted here — the pooled
       book cannot rehabilitate something measured bad on its own record. */
    if (ed !== false && fwd && fwd.horizonPool){
      var hp = fwd.horizonPool;
      /* the fill-aware count when it stands on its own, the raw one
         otherwise — same precedence as the mechanic-level judge above */
      var hpFillN = fin(hp.fillSamples), hpFillHit = fin(hp.fillHit);
      var useFill = isFinite(hpFillN) && hpFillN >= FWD_MIN_JUDGE && isFinite(hpFillHit);
      var hpN = useFill ? hpFillN : fin(hp.samples);
      var hpHit = useFill ? hpFillHit : fin(hp.hit);
      /* THE POOL'S ROWS ARE NOT INDEPENDENT BETS.

         Deflated by the ratio the log measures on its own cleared records.
         A ratio rather than the raw effN, because the overlap is counted
         over records with usable timing and the test runs on settled ones —
         the two counts need not match, and the ratio is what transfers.

         NO MEASUREMENT, NO PROMOTION. Treating an unmeasurable overlap as
         1.0 is precisely the assumption that inflates the statistic, and
         this is the only path by which anything becomes a ticket. */
      var ovl = fwd.horizonOverlap;
      var ovlRatio = (ovl && isFinite(fin(ovl.effN)) && isFinite(fin(ovl.n)) && fin(ovl.n) > 0)
        ? (fin(ovl.effN) / fin(ovl.n)) : NaN;
      if (isFinite(hpN) && hpN >= FWD_MIN_JUDGE && isFinite(hpHit) && !isFinite(ovlRatio)){
        edWhy = edWhy + ' · horizon book has ' + hpN + ' cleared setups but its overlap cannot be '
              + 'measured, so no promotion is offered — concurrent rows are not independent bets';
      }
      if (isFinite(hpN) && hpN >= FWD_MIN_JUDGE && isFinite(hpHit) && isFinite(ovlRatio)){
        var hpEffN = Math.max(1, hpN * ovlRatio);
        var hpBreak = 1 / (1 + minRr);
        var hpZ = (hpHit - hpBreak) / Math.sqrt(Math.max(1e-9, hpBreak * (1 - hpBreak) / hpEffN));
        /* ONE TEST PER HORIZON — counted, never written as a literal.
           test-omnigold-full-cover asserts that this bar always tracks the
           number of comparisons actually made, and it is right to: a
           hard-coded count silently stops correcting the moment a horizon
           is added. */
        var hpBar = hgOgFamilyZ(hgOgHorizonPoolTests());
        var hpTxt = hpN + (useFill ? ' FILLED' : ' settled') + ' cleared setups across '
                  + (fwd.pooledTabs ? fwd.pooledTabs.length : 1) + ' gold tabs · '
                  + (hpHit * 100).toFixed(0) + '% T1-first ['
                  + (hpZ >= 0 ? '+' : '') + hpZ.toFixed(2) + 'σ vs breakeven]';
        /* PARTIAL POOLING — the pool may not carry a mechanic that is
           pulling away from it.

           Promotion needs 20 pooled records, about three days. Condemnation
           needs 20 for one MECHANIC, about a year. So for the first year a
           clearing pool would promote every mechanic, including one at
           0-for-3, because nothing can condemn it yet. All-or-nothing
           pooling is the wrong shape.

           Each mechanic's own rate is shrunk toward the pool with weight
           n/(n+K), K = FWD_MIN_JUDGE: with no record of its own a mechanic
           simply IS the pool, and with enough it pulls away. The shrunken
           rate must still clear breakeven. A mechanic at 10% on ten records
           against a 40% pool shrinks to 30% and is held back — at an n the
           per-mechanic veto could not act on for another eleven months. */
        var ownN = fin(cN), ownHit = fin(cHit);
        var shrunk = hpHit, shrinkTxt = '';
        if (isFinite(ownN) && ownN > 0 && isFinite(ownHit)){
          var wOwn = ownN / (ownN + FWD_MIN_JUDGE);
          shrunk = wOwn * ownHit + (1 - wOwn) * hpHit;
          shrinkTxt = ' · this mechanic ' + ownN + ' of its own at '
                    + (ownHit * 100).toFixed(0) + '%, shrunk to ' + (shrunk * 100).toFixed(0) + '%';
        }
        var shrunkOk = shrunk > hpBreak;

        if (hpZ >= hpBar && shrunkOk){
          ed = true;
          edWhy = hpTxt + shrinkTxt + ' — the horizon\'s cleared book clears the '
                + hgOgHorizonPoolTests() + '-test bar (+' + hpBar.toFixed(2)
                + 'σ) on ' + hpEffN.toFixed(0) + ' effective rows of ' + hpN
                + ', and this mechanic is not pulling away from it.';
        } else if (hpZ >= hpBar && !shrunkOk){
          edWhy = edWhy + ' · the horizon book clears its bar, but this mechanic\'s own record'
                + shrinkTxt + ' sits below breakeven — the desk is not asked to carry it';
        } else {
          edWhy = edWhy + ' · horizon book: ' + hpTxt + ', short of the +'
                + hpBar.toFixed(2) + 'σ bar';
        }
      }
    }

    /* HARD when proof is required: pass===null then reads NO DATA in
       hgOmniGrade and stands the setup aside, instead of UNCHECKED letting
       it through. A known failure (pass===false) vetoed either way — that
       never depended on this flag. See OG_EDGE_PROOF_REQUIRED. */
    if (OG_EDGE_PROOF_REQUIRED && ed === null && !edInfo){
      edWhy = edWhy + ' · NO TICKET: this desk now requires a measured edge, and this mechanic '
            + 'has not got one. The setup stands as a WATCH with its levels intact.';
    }
    gates.push({ key:'measured-edge', hard: OG_EDGE_PROOF_REQUIRED, info: edInfo, pass: ed, why: edWhy });

    /* hg-v926 — ONE POSITION AT A TIME. Pushed as an ordinary hard gate so it
       flows through hgOmniGrade, the blocker funnel and the card exactly like
       every other constraint, instead of being a special case in the grader.
       FAILS OPEN: an unreadable conviction store reads 0 open and the ticket
       stands — refusing to ticket because localStorage is unavailable would
       be a gate nobody chose. */
    (function(){
      var g = hgOgOneAtATimeGate();
      if (g) gates.push(g);
    })();

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
       new keys.

       UNCHECKED-SOFT WHEN IT CANNOT RUN, NOT PASS. This row used to read
       pass:true whenever the filter was unavailable, with a why line that
       said so — "inst filter threw — fail-open". The intent was right, the
       shape was not: the comment framed the choice as PASS versus
       UNCHECKED-HARD, and those are not the only two. pass:null with
       hard:false is UNCHECKED-SOFT, which hgOmniGrade puts in `degraded`,
       does not veto, and excludes from `evaluated` — the same non-veto with
       none of the lie.

       It matters because `pass === true` is what every consumer counts. A
       throwing filter and a clean institutional check were indistinguishable:
       both read PASS, and the card's checks badge counted 35 of 57 either
       way. goldind.js IS loaded in the app, so the absent branch is rare —
       but the throw branch is live on any exception inside the filter, and
       it was recording an institutional check that never ran as one that
       passed. Every other gate in this file that sets true does so in the
       else of an evaluated comparison; this was the only one setting it
       from "I could not evaluate". */
    var inst = hgOgInstFilterHit(hit, rows, x);
    var instHard = true, instOk = true, instWhy = 'institutional gold filter OK';
    if (inst.unchecked){
      instHard = false;
      instOk = null;
      instWhy = inst.reason || 'goldind inst filter not loaded — not checked';
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

    /* THE LIVE LEDGER'S SIGNATURE, captured where it is free. Every baked
       number in this file was measured against SOME gate set, and until
       hg-v755 nothing recorded which — so hg-v754 shipped a drawdown from a
       walk that predated the v752 gates and overstated the hole 2.2x.
       hgOgEvidenceStale compares this against the baked list. */
    try {
      if (!__og.liveGateKeys || __og.liveGateKeys.length !== gates.length){
        var gk = [], gi;
        for (gi = 0; gi < gates.length; gi++) if (gates[gi] && gates[gi].key) gk.push(gates[gi].key);
        __og.liveGateKeys = gk;
      }
    } catch (eGk) {}

    return gates;
  }

  /* This mechanic's OUT-OF-SAMPLE record, or null when the log is absent.
     Never throws: no forward log must leave the gate on the in-sample number
     saying so, not break the scan. */
  /* Did this setup clear every gate EXCEPT measured-edge?

     A ticket did, by definition. Anything else qualifies when the only key
     standing in its way is the edge gate itself — nothing else vetoed and
     nothing else is missing data.

     Reads the grade's own lists so it says exactly what the card said. A
     grade object that is absent or malformed yields undefined, never false:
     "we could not tell" must not be recorded as "it failed", or the
     population this exists to grow would be quietly poisoned. */
  function hgOgGateClear(grade){
    if (!grade || !Array.isArray(grade.vetoes) || !Array.isArray(grade.unknown)) return undefined;
    if (grade.ticket === true) return true;
    var blocking = grade.vetoes.concat(grade.unknown);
    for (var i = 0; i < blocking.length; i++){
      if (blocking[i] !== 'measured-edge') return false;
    }
    /* nothing blocking at all cannot happen here (that would be a ticket),
       but an empty list is still honestly "cleared" rather than a guess */
    return true;
  }

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
      /* POOL THE THREE TABS THAT RUN THESE MECHANICS.

         OMNIGOLD:SCALP, GOLDSCALP and SUPER:GOLD are the same mechanics on
         the same instrument, and hgOgSettledEvidence has pooled them since
         it was written. This gate read one, and so discarded two thirds of
         its own evidence at the exact point where evidence is what it is
         short of. A `tab` that is a LIST pools inside hgFwdStats, where
         rrSum is still in scope — summing three finished stat blocks would
         average the ratios wrong. */
      var tabs = hgOgFwdTabsFor(String(tab).indexOf('SCALP') >= 0 ? 'SCALP' : 'SWING');
      var all = w.hgFwdStats(tabs, mechanic, false);
      var tix = w.hgFwdStats(tabs, mechanic, true);
      /* AND the population that did not stop growing. `ticket` has been
         false on every card since measured-edge went hard, so ticketOnly is
         frozen; gateClear is the same ledger minus the gate under test. */
      var clr = w.hgFwdStats(tabs, mechanic, { gateClear: true });
      /* AND THE SAME POOL WITH NO MECHANIC FILTER — the horizon's whole
         book. Per-mechanic evidence costs twice: it splits the data 108
         ways AND pays the 54-comparison significance bar precisely because
         there are 54 of them, which puts a verdict out of reach on any
         human timescale. This is the population a promotion can actually be
         measured on. It is never used to condemn — see the gate. */
      var pooled = w.hgFwdStats(tabs, null, { gateClear: true });
      /* HOW MUCH OF THAT POOL IS ONE BET.

         The pooled book is the MOST overlapping population this desk has —
         every mechanic firing on the same bar is one trade wearing several
         names. The in-sample replay measures the same thing at an effective
         n of 3,111 from 7,670 rows, a ratio of 0.406, and z scales with the
         square root of n: uncorrected, a pooled reading is inflated by
         about 1.57x, so a +1.96σ bar is really +1.25σ.

         Measured on the log's OWN records rather than borrowing 0.406 —
         importing a constant measured on one population into another is the
         error hgOgEffN exists to fix. Null when the records cannot answer
         it, and the gate then refuses to promote rather than assuming
         independence. */
      var poolOverlap = null;
      try { poolOverlap = w.hgFwdOverlap(tabs, null, { gateClear: true }); } catch (eO) { poolOverlap = null; }
      if (!all || !isFinite(fin(all.samples))) return null;
      all.ticketOnly = (tix && isFinite(fin(tix.samples))) ? tix : null;
      all.gateClear = (clr && isFinite(fin(clr.samples))) ? clr : null;
      all.horizonPool = (pooled && isFinite(fin(pooled.samples))) ? pooled : null;
      all.horizonOverlap = poolOverlap;
      all.pooledTabs = tabs;
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
    var magT2 = hgOgPickMagnet(magnets, risk, OG_T2_R, OG_T2_R + 1.5);
    var t2Floor = (dir === 'long') ? entry + OG_T2_R * risk : entry - OG_T2_R * risk;
    if (!isFinite(t2)) t2 = t2Floor;
    if (dir === 'long' && t2 < t2Floor) t2 = t2Floor;
    if (dir === 'short' && t2 > t2Floor) t2 = t2Floor;
    if (magT2 && isFinite(magT2.px)){
      var t2Ahead = (dir === 'long') ? (magT2.px > t1) : (magT2.px < t1);
      var beyondFloor = (dir === 'long') ? (magT2.px >= t2Floor - 1e-9) : (magT2.px <= t2Floor + 1e-9);
      if (t2Ahead && beyondFloor){ t2 = magT2.px; plan.t2Source = magT2.src; }
    }
    if ((dir === 'long') ? t2 <= t1 : t2 >= t1){
      t2 = t2Floor;
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
    plan.fillPathCross = false;

    /* 4. TYPE + fill. Thin LIMIT demotes — it does not chase live gold. */
    var gapAtr = (isFinite(live) && live > 0 && a > 0) ? Math.abs(live - entry) / a : NaN;
    var atMarket = isFinite(gapAtr) && gapAtr <= 0.25;
    if (isFinite(live) && live > 0 && !atMarket){
      if (dir === 'short' && entry > live && t1 > live && t1 < entry) plan.fillPathCross = true;
      else if (dir === 'long' && entry < live && t1 < live && t1 > entry) plan.fillPathCross = true;
    }
    var kind = String(hit.kind || 'SETUP');
    plan.entryType = (atMarket ? 'MARKET @ ' : 'LIMIT @ ') + kind;
    if (atMarket) plan.fillProb = 90;
    else if (isFinite(gapAtr)){
      plan.fillProb = Math.max(5, Math.round(100 / (1 + gapAtr)));
      if (gapAtr > 1.5) plan.fillDemote = true;
    }
    /* hgFillProbability RETURNS A SENTINEL, NOT A ZERO, WHEN IT CANNOT MEASURE.

       Its no-evidence answer is { prob: null, pct: null, note: 'fill history
       n/a' } — too few bars to build a window from, or a bad entry, or a
       throw. The guard here was `isFinite(+fill.pct)`, and +null is 0 and
       isFinite(0) is true, so "I have no history" arrived as a measured 0%
       fill chance. That overwrote the gap-ATR estimate, tripped the < 35
       demote, cost the setup ten conviction points and printed "· thin fill"
       on its card — a claim about how this market fills, from a function
       that had just said it did not know.

       fin() tells the sentinel from a measurement, and fillMeasured records
       which one the number is, so the card can quote its evidence instead of
       only its verdict. An unmeasured fill leaves the gap-ATR estimate
       standing and demotes nothing. */
    var fillFn = gfn('hgFillProbability');
    if (fillFn && !atMarket){
      try {
        var fill = fillFn(rows, entry, dir, null, 12);
        var fPct = fill ? fin(fill.pct) : NaN;
        if (isFinite(fPct)){
          plan.fillProb = fPct;
          plan.fillNote = fill.note;
          plan.fillMeasured = true;
          if (plan.fillProb < 35) plan.fillDemote = true;
        } else {
          /* the estimate stands, and the card says it is an estimate */
          plan.fillMeasured = false;
          plan.fillNote = (fill && fill.note) ? String(fill.note) : 'fill history n/a';
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
    /* fill-path is an info gate on the ledger — do not demote formation here;
       limit retests above/below market are valid structure, not thin-fill. */
    if (plan.fillPathCross){ parts.push('fill-path-crosses-t1'); }
    if (hgOgIsSurvivor(kind)){ score += 8; parts.push('replay-survivor'); }
    if (hgOgSwingPrefer(kind, extra.horizon || extra.deskHorizon || cfg.label)){
      score += 8; parts.push('swing-replay-prefer');
    }
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

  /* ============ UNIFIED CONFLUENCE (hg-v698) ============================

     The shared >=3-DISTINCT-CLASS contract every gold desk now runs
     (gold-formation.js). OMNIGOLD feeds it from the gate ledger it already
     builds, through the SHARED gate->class table (HG_GOLD_CONF_GATE_CLASS)
     so OMNIGOLD 1 and NEW GOLD classify the same evidence the same way.

     Only pass === true counts. An UNCHECKED (null) gate is not evidence, and
     geometry gates (plan-levels / stop-width / cost-drag / fill-*) are not in
     the table at all — they say whether a trade is placeable, not whether
     anything confirms the side.

     THE SESSION LEG carries the measured window rule from the recon's UTC
     session cohorts (recon 3.3, 7,270 settled): the clock confirms only where
     measured gross is >= 0 — ASIA 00-06 (+0.097R, n=2,082) and NY-PM 17-20
     (+0.053R, n=994). In LONDON 07-11 (-0.080R, n=1,305), NY-OVERLAP 12-16
     (-0.061R, n=2,247) and OFF 21-23 (-0.011R, n=642) a passing `session`
     gate is NOT a confirmation. The gate itself stays soft and unchanged —
     this only decides whether the clock may be one of the three classes.
     htf-daily / macro / dxy / season can still satisfy the same class.

     Fail closed: no shared helper -> no confluence object, and the caller
     treats a missing verdict as not formed. */
  function hgOgConfluenceFor(gates, extra){
    var w = W();
    if (!w || typeof w.hgGoldConfluence !== 'function') return null;
    var confs = [];
    try {
      confs = (typeof w.hgGoldConfluenceFromGates === 'function')
        ? w.hgGoldConfluenceFromGates(gates) : [];
    } catch (eC){ confs = []; }
    /* SESSION LEG: re-decided against the measured UTC cohort, ON THE CLOSED
       SIGNAL BAR. It used to read `extra.nowSec` (runScan sets that to
       Date.now()/1000, line ~10022) and fell back to Date.now() — the WALL
       CLOCK. The measured cohorts are keyed on the signal bar's own
       timestamp (backtest-omnigold-results.json trades[].tISO; the fill is
       bar sigIdx+1), so a wall-clock read asks a different question and lets
       the SAME closed bar answer FORMED on one scan and WATCH on the next
       with no new data. The instant and the rule both come from
       gold-formation.js now, so OMNIGOLD, OMNIGOLD 1 and NEW GOLD cannot
       drift apart on either. Unreadable bars -> the leg fails closed. */
    try {
      var applyFn = (typeof w.hgGoldApplySessionLeg === 'function') ? w.hgGoldApplySessionLeg : null;
      var barMsFn = (typeof w.hgGoldSignalBarMs === 'function') ? w.hgGoldSignalBarMs : null;
      /* extra.barMs is the closed signal bar's own open instant; extra.rows
         is the tape it is read from. Nothing else is accepted — a caller
         that supplies neither gets a fail-closed session leg rather than a
         verdict borrowed from the wall clock. */
      var whenMs = fin(extra && extra.barMs);
      if (!isFinite(whenMs) && barMsFn) whenMs = barMsFn(extra && extra.rows);
      if (applyFn) applyFn(confs, 'session', whenMs);
    } catch (eS){}
    /* the desk's own family consensus is the structural read the gate ledger
       reports as `consensus`; nothing extra is added here so a card cannot
       count the same evidence twice. */
    try { return w.hgGoldConfluence(confs, {}); } catch (eG){ return null; }
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
      /* The mechanic reads its OWN record — see OG_KIND_ALIAS, which is
         empty. This was an inline UTAD-to-SPRING special case, which judged
         short setups on the long half's 104 trades; folding the pair fixed
         the wrong half of that. Both stats and fwd key off statKey, so the
         in-sample and out-of-sample records stay the same population. */
      var statKey = Object.prototype.hasOwnProperty.call(OG_KIND_ALIAS, hit.kind)
        ? OG_KIND_ALIAS[hit.kind] : hit.kind;
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
           GOLD_STOP_MAX_PCT clip — this stamp does not tighten them.
           v681 made plans.js stamp its generic 0.5 crypto floor on every
           plan, which silently kept the "only if absent" stamp here from
           ever recording gold's 1.5 — raise to the gold floor instead
           (Math.max: a floor stamp, never a cap; goldind.js pattern). */
        plan.stopFloorAtr = Math.max(fin(plan.stopFloorAtr) || 0, 1.5);
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
      /* UNIFIED CONFLUENCE (hg-v698) — the same >=3-distinct-class bar
         OMNIGOLD 1 and NEW GOLD now apply, computed from THIS card's gate
         ledger through the shared class table. A card short of three classes
         is not a ticket: it becomes WATCH, keeps its levels off the tradable
         list, and names the missing class. It is NOT hidden — the stood-aside
         section prints it with the missing class spelled out.
         Fail closed: no shared helper -> not formed, reason named. */
      try {
        /* `rows` — the CLOSED bars this card was detected on — not `ex`,
           whose nowSec is the wall clock. The session leg is a property of
           the signal bar. */
        var ogConf = hgOgConfluenceFor(gates, { rows: rows });
        formation.confluence = ogConf;
        if (!ogConf){
          formation.formed = false;
          formation.confluenceUnavailable = true;
          formation.reasons = (formation.reasons || []).concat(
            ['confluence contract unavailable — gold-formation.js is not loaded; fail closed']);
        } else if (!ogConf.ok){
          formation.formed = false;
          formation.confluenceShort = true;
          formation.reasons = (formation.reasons || []).concat([ogConf.why]);
        }
      } catch (eCf){
        formation.formed = false;
        formation.confluenceUnavailable = true;
        formation.reasons = (formation.reasons || []).concat(
          ['confluence check threw — fail closed: ' + ((eCf && eCf.message) || eCf)]);
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
    /* v665: strip the forming (unclosed) bar on this fallback path too.
       getXAUCandles already calls dropForming(rows, res) on every branch
       before returning; hgOgFetchRowsLegacy did not, so when getXAUCandles
       was absent (older builds, transient failures) OMNIGOLD detectors ran
       with rows[rows.length - 1] pointing at an OPEN candle. Every wick /
       close-through / fib decision then read a moving target: mechanics
       could pass on transient wick data that reversed before close, print
       a live ticket, then invalidate the next tick — exactly the "setups
       are not good" experience a user reports. dropForming is a global
       function declared in index.html; feature-checked here so absence
       degrades to the raw rows (still safer than silently accepting a
       partial bar). */
    var dropFn = gfn('dropForming');
    function trim(rows){
      if (!rows || !rows.length) return rows || [];
      if (typeof dropFn === 'function'){
        try{ var t = dropFn(rows, tf); if (t && t.length) return t; }catch(e){}
      }
      return rows;
    }
    return Promise.resolve()
      .then(function(){ return xm ? xm(tf, n) : null; })
      .catch(function(){ return null; })
      .then(function(a){
        if (a && a.rows && a.rows.length) return { rows: trim(a.rows), source: a.source || 'xm-xauusd' };
        return Promise.resolve().then(function(){ return gg ? gg(tf, n) : null; })
          .catch(function(){ return null; })
          .then(function(b){
            if (b && b.rows && b.rows.length) return { rows: trim(b.rows), source: b.source || 'gold-spot' };
            return Promise.resolve().then(function(){ return bk ? bk('PAXGUSDT', tf, n) : null; })
              .catch(function(){ return null; })
              .then(function(c){
                if (c && c.length) return { rows: trim(c), source: 'binance-paxg' };
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
        /* EVERY PRICE ON THE PLAN, and t1Magnet is one.

           hgOgFormTicket writes plan.t1Magnet — a PRICE, the first gold
           liquidity beyond the 2R print — and it was missing from this
           list, so a proxy feed scaled to live spot moved entry, stop, T1
           and T2 while the magnet stayed at the kline price. The card
           renders it (' @ 4050.00'), so the reader saw a target and a
           magnet quoted on two different instruments.

           At a 1.005 ratio on 4000 gold it printed 40 points adrift, and
           the direction of the error is the damaging part: the magnet
           landed BELOW T1 on a long, reading as liquidity before the
           target when the whole point of the field is liquidity beyond it.
           The stored t1MagnetR said 2.5R while the printed pair implied
           0.49R.

           SCALE-INVARIANT FIELDS ARE NOT LISTED AND MUST NOT BE: rr1, rr2,
           riskPct, t1MagnetR and stopFloorAtr are ratios and multiples,
           which a common factor cancels out of. `risk` IS listed because
           it is a distance, and distances scale with the prices they are
           measured between. */
        keys = ['entry', 'stop', 't1', 't2', 'risk', 't1Magnet'];
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
    var t1 = plan && fin(plan.t1);
    var t2 = plan && fin(plan.t2);
    if (!(mkt > 0) || !(e > 0)) return '';
    var gap = mkt - e;
    var pts = Math.abs(gap);
    var bits = ['MARKET ' + fmtPx(mkt)];
    /* A stop price has already traded through is a trade that lost before it
       filled, and it outranks every other thing this note can say. The shared
       rule in hg-plan.js judges it (hgPlanMarketGeometry), so the same verdict
       is available to the gold desks that do not have this renderer. */
    try {
      var geoFn = gfn('hgPlanMarketGeometry');
      if (geoFn){
        var g = geoFn({ dir: row && row.dir, entry: e, stop: plan && plan.stop,
                        t1: t1 }, mkt);
        if (g && g.code === 'stop-breached'){
          return bits.join('') + ' · STOP ALREADY BREACHED — ' + esc(g.why);
        }
      }
    } catch (eG) { /* the note below still stands on its own */ }
    if (pts < 0.5) return bits.join('') + ' · at entry';
    var dir = String(row.dir || '').toLowerCase();
    if (dir === 'short'){
      bits.push(gap < 0
        ? '+' + pts.toFixed(0) + ' pts below entry · limit retest · not a market short'
        : '+' + pts.toFixed(0) + ' pts above entry');
      if (gap < 0 && isFinite(t1) && t1 > mkt && t1 < e){
        bits.push('T1 between market and entry — retest crosses TP1 before fill');
      }
      if (isFinite(t2) && t2 < mkt){
        bits.push('T2 ' + fmtPx(t2) + ' · ' + Math.abs(mkt - t2).toFixed(0) + ' pts below market');
      }
    } else if (dir === 'long'){
      bits.push(gap > 0
        ? '+' + pts.toFixed(0) + ' pts above entry · limit retest · not a market long'
        : '+' + pts.toFixed(0) + ' pts below entry');
      if (gap > 0 && isFinite(t1) && t1 < mkt && t1 > e){
        bits.push('T1 between market and entry — retest crosses TP1 before fill');
      }
      if (isFinite(t2) && t2 > mkt){
        bits.push('T2 ' + fmtPx(t2) + ' · ' + Math.abs(t2 - mkt).toFixed(0) + ' pts above market');
      }
    } else {
      bits.push(pts.toFixed(0) + ' pts from entry');
    }
    return bits.join(' · ');
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

  function hgOgRunnerReadout(plan, horizonLabel){
    if (!plan) return 'runner';
    try {
      var e = fin(plan.entry), t2 = fin(plan.t2);
      var dir = String(plan.dir || '').toLowerCase();
      if (!(e > 0) || !(t2 > 0) || (dir !== 'long' && dir !== 'short')) return 'runner';
      var risk = fin(plan.risk);
      if (!(risk > 0)){
        var s = fin(plan.stop);
        if (isFinite(s)) risk = (dir === 'long') ? (e - s) : (s - e);
      }
      if (!(risk > 0)) return 'runner';
      var rew = (dir === 'long') ? (t2 - e) : (e - t2);
      if (!(rew > 0)) return 'wrong side';
      var t2R = fin(plan.rr2);
      if (!(t2R > 0)) t2R = rew / risk;
      var hz = hgOgHorizonCfg(horizonLabel);
      var bars = hz.horizonBars || 24;
      var tf = hz.tf || '1h';
      var pct = (rew / e) * 100;
      var src = plan.t2Source ? (' · ' + plan.t2Source) : '';
      return 'T2 · ' + fmt(t2R, 1) + 'R · ' + rew.toFixed(0) + ' pts · '
           + pct.toFixed(2) + '% · ' + bars + '×' + tf + ' runner' + src;
    } catch (e){ return 'runner'; }
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
    var nearCap = hgOgNearAtrFor(c && c.horizon);
    var near = 1;
    if (isFinite(dist) && dist > nearCap){
      near = Math.max(0, 1 - (dist - nearCap) / 4);
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
    var edgeDemoteN = (c && c.formation && c.formation.edgeDemote) ? -0.35 : 0;
    /* v664: rebalanced so measured-edge has real say among ticket survivors.

       Prior weights (edgeN=8, edgeDemoteN weight=15 with a fixed -0.35
       multiplier -> effective -5.25 penalty) meant walk-forward history
       barely tipped the pick order. Tape (100), ticket (120), family (30)
       and infoRatio (30) dominated so completely that a mechanic with 100%
       measured edge outranked an unmeasured mechanic by 8 points — less
       than one gate agreeing. The whole point of walk-forward is to prefer
       setups that have actually paid on the user's feed, and it was doing
       almost nothing.

       v664 raises the positive-edge weight (8 -> 25) and demote weight
       (15 -> 40, so measured-negative-but-not-vetoed cards fall harder
       among survivors: 40 * -0.35 = -14 vs -5.25 before). Neither change
       affects what QUALIFIES as a ticket — gates still decide that. This
       is ordering only. The measured-edge VETO already keeps significantly
       negative mechanics out of the pool entirely; this fix affects the
       remaining ambiguity between measured-positive, measured-neutral,
       and unmeasured cards, which is where the pick actually lived. */
    /* v677: freshness component. hgOgDetect (v677 upstream change) stamps
       every hit with its formation-bar timestamp (rows[n-1].t). A gold
       setup that formed several bars ago has usually already resolved —
       ADR-FADE from three 4H bars ago is no longer a fade opportunity;
       ASIA-BREAK four bars past London-close is no longer a break. This is
       ORDERING only, not a veto: fresh setups gain up to +15 pts (~half a
       family delta), stale setups lose up to -15 pts. Requires c.t; if the
       upstream stamp fails, freshN=0 and this term contributes nothing. */
    var freshN = 0;
    if (c && isFinite(fin(c.t))){
      var nowSecFr = Math.floor(Date.now() / 1000);
      /* Gold desk scans on 1H (scalp) and 4H (swing). Detect from horizon
         if available; fallback to 4H which is the more conservative — an
         over-forgiving tf inflates freshN, an under-forgiving tf deflates
         it. Use the more stringent default. */
      var tfFr = (c && c.tfSec && isFinite(fin(c.tfSec))) ? fin(c.tfSec) : (4 * 3600);
      var barsSince = Math.max(0, Math.floor((nowSecFr - fin(c.t)) / tfFr));
      if (barsSince <= 1) freshN = 1;
      else if (barsSince === 2) freshN = 0.5;
      else if (barsSince <= 4) freshN = -0.5;
      else freshN = -1;
    }
    /* v679: live-price sanity. Uses hgLivePriceGrade (exposed by omniroute
       which loads first) to classify each candidate's plan against current
       price. Cards where price has already crossed the stop, reached T1,
       or ran past entry get downgraded in the ranker. Falls back to 0 if
       the helper isn't loaded (test harness). See omniroute.js hgLivePriceGrade
       docblock for the full state map. */
    var liveN = 0;
    var liveGrade = null;
    try {
      var lpFn = (typeof W === 'function' ? W().hgLivePriceGrade : null)
              || (typeof window !== 'undefined' ? window.hgLivePriceGrade : null);
      var lpPx = fin(c && c.livePx);
      var lpPlan = (c && c.plan) || null;
      if (typeof lpFn === 'function' && lpPlan && isFinite(lpPx)){
        var lpDir = String((c && c.dir) || (lpPlan.dir) || '').toLowerCase();
        var lp = lpFn(lpDir, lpPlan.entry, lpPlan.stop, lpPlan.t1, lpPlan.t2, lpPx);
        if (lp){ liveGrade = lp.grade; liveN = lp.delta; }
      }
    } catch(eLp){}
    /* THE 120 IS INERT WHILE THE EDGE GATE IS HARD.

       ticketN exists to hold tickets above watches, and it is the largest
       weight here for that reason. Since hg-v756 made measured-edge hard,
       no card is a ticket, so this term is 0 for every card on every scan.
       A constant adds nothing to an ordering, so nothing is WRONG — but the
       note above this function still describes a scheme in which "ticket"
       dominates, and that has not been true for six releases.

       What actually separates WATCH cards now is tape (100), then the two
       normalised agreement terms at 30 each, the edge pair (25 / -40), and
       freshness and live-price sanity at 15 and 20. Nobody re-examined that
       ordering for a book in which EVERY card is a watch — it was tuned
       when the ticket term did the heavy lifting.

       Left in place deliberately: the moment a mechanic clears its bar this
       term does its job again, and removing it would have to be undone.
       hgOgDeskOrder's section key carries the same inert `ticket ? 2 : 0`
       for the same reason. */
    var score = 100 * tapeScore
              + 120 * ticketN
              + 30 * family
              + 30 * infoRatio
              + 12 * coverage
              + 10 * alsoNorm
              + 8 * horizon
              + 10 * near
              + 25 * edgeN          /* v664: 8 -> 25 (walk-forward positive edge) */
              + 40 * edgeDemoteN    /* v664: 15 -> 40 (measured-negative demotion) */
              + 15 * freshN         /* v677: NEW (freshness: +15 fresh, -15 stale) */
              + 20 * liveN;         /* v679: NEW (live-price sanity: +20 fresh, -30 past-stop) */
    return {
      score: score, family: family, infoRatio: infoRatio, coverage: coverage,
      alsoNorm: alsoNorm, horizon: horizon, near: near, tapeScore: tapeScore,
      ticket: ticketN, info: info, dist: dist, edge: edgeN,
      freshN: freshN,
      liveN: liveN, liveGrade: liveGrade,
      nAgree: nAgree, nAgainst: nAgainst
    };
  }
  function hgOgBalanceScore(c, tape){
    return hgOgBalanceParts(c, tape).score;
  }

  /* v682: attach shared solidity grade before ordering (mirror of the
     omniroute pattern so both tabs speak the same language for "solid").
     Feature-checked: helper missing = no chip, no reorder, native ranker
     order preserved. */
  function hgOgStampSolidity(list, tape){
    var W = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : null);
    if (!W || typeof W.hgSolidityGrade !== 'function') return;
    if (!Array.isArray(list)) return;
    var tapeDir = String(tape || '').toLowerCase();
    for (var i = 0; i < list.length; i++){
      var c = list[i];
      if (!c) continue;
      try {
        if (!c.tape){
          if (tapeDir === 'long' || tapeDir === 'short') c.tape = tapeDir;
        }
        if (!c.liveGrade && c.plan && isFinite(fin(c.livePx)) && typeof W.hgLivePriceGrade === 'function'){
          var lpDir = String((c.dir) || (c.plan.dir) || '').toLowerCase();
          var lp = W.hgLivePriceGrade(lpDir, c.plan.entry, c.plan.stop, c.plan.t1, c.plan.t2, fin(c.livePx));
          if (lp && lp.grade) c.liveGrade = lp.grade;
        }
        if (!c.consensus && c.balance && isFinite(fin(c.balance.nAgree))){
          c.consensus = { nAgree: fin(c.balance.nAgree) };
        }
      } catch(eStamp){}
      var planForSol = c.plan ? Object.assign({
        dir: c.dir,
        tape: c.tape,
        liveGrade: c.liveGrade,
        livePx: c.livePx,
        consensus: c.consensus,
        alsoKinds: c.alsoKinds,
        strategyConfirm: c.strategyConfirm
      }, c.plan) : c;
      /* v686: pass tab + kind so the measured-edge veto (G6) can look up
         this (horizon, mechanic) pair in the forward log. omnigold records
         with tab='OMNIGOLD:'+cfg.label (line 9680) and mechanic=c.kind,
         so the lookup key here must match. Fallback to 'OMNIGOLD' when
         c.horizon is absent so we still hit any records written under a
         bare tab prefix (defensive).

         v687: opt into tapeOverride so a PRIME (measured-winning) kind
         with adverse tape still leads the omnigold desk. Empirical
         performance over 20+ samples with expR >= +0.5R overrides the
         current-tape heuristic for lead ordering only. The tape gate
         still fails honestly in the tooltip; only the composite grade
         and score get promoted, with a ★ tape-override marker so the
         trader sees why an against-tape card is on top. */
      var ogTab = c.horizon ? ('OMNIGOLD:' + String(c.horizon)) : 'OMNIGOLD';
      try { c.solidity = W.hgSolidityGrade(planForSol, {
        minRr: (typeof MIN_RR === 'number') ? MIN_RR : 2.0,
        tab: ogTab,
        kind: c.kind,
        tapeOverride: true /* v687 omnigold-only opt-in */
      }); }
      catch(eSol){}
    }
  }

  function hgOgDeskOrder(list, tape){
    var tapeDir = String(tape || '').toLowerCase();
    /* v682: stamp solidity BEFORE sort so downstream reorder sees it. */
    hgOgStampSolidity(list, tapeDir);
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
      return (c && (c.replaySurvivor || hgOgIsSurvivor(c.kind)
        || hgOgSwingPrefer(c.kind, c.horizon))) ? 1 : 0;
    }
    var sorted = (list || []).slice().sort(function(a, b){
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
    /* v682: reorder so SOLID/GOOD cards lead. Preserves score order
       WITHIN each solidity bucket (helper does stable partition).
       v689: pass tab='OMNIGOLD' so the reorder can stash aggregate
       killed stats (across both horizons) for the KILLED note rendered
       later in the MP section. */
    var W2 = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : null);
    if (W2 && typeof W2.hgSolidityReorder === 'function') return W2.hgSolidityReorder(sorted, { tab: 'OMNIGOLD' });
    return sorted;
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
  /* The tape/held reasoning, plus the gate reason when the gate is why
     nothing cleared. Two sentences, because they answer two questions a
     reader has at once: which side is eligible, and why no side is a
     ticket. hgOgEdgeSilenceNote returns '' whenever the gate is not the
     reason, so this collapses to exactly the old copy. */
  function hgOgMpNoneWhy(tape, held){
    var base = hgOgMpNoneWhyTape(tape, held);
    var edge = hgOgEdgeSilenceNote();
    return edge ? (base + ' ' + edge) : base;
  }

  function hgOgMpNoneWhyTape(tape, held){
    /* THE TAPE REASON AND THE GATE REASON ARE BOTH TRUE.

       An earlier pass at this returned the gate note INSTEAD of the tape
       copy, which threw away the thing a reader most wants — which side is
       even eligible. Appended, not substituted: the tape says why this side
       is wrong today, the gate says why no side is a ticket at all. */
    var base;
    if (tape === 'short')
      base = 'gold is going down — a LONG is not the setup. Standing aside is the position when no short ticket cleared.';
    else if (tape === 'long')
      base = 'gold is going up — a SHORT is not the setup. Standing aside is the position when no long ticket cleared.';
    else
      base = 'nothing on this horizon cleared the ledger this scan. Standing aside is the position.';
    if (!held || !held.n){
      /* Field report: "why short setups are not shown?" when the card
         only said a SHORT is not the setup. That reads as hidden.
         When nothing opposite cleared, say so — shorts are not erased. */
      if (tape === 'long')
        return base + ' No SHORT ticket cleared either — shorts are not hidden.';
      if (tape === 'short')
        return base + ' No LONG ticket cleared either — longs are not hidden.';
      return base;
    }
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
    /* the horizon's own name heads this card; a non-string reached the
       headline as "NaN · STAND ASIDE" */
    label = (typeof label === 'string' && label.trim()) ? label.trim() : 'HORIZON';
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
            /* ev and tot two lines up already read row.grade defensively;
               these two did not, so a card that reached here without a grade
               threw and took MOST PROBABLE — the panel at the top of the
               tab — off the page entirely. */
            var tik = !!(row.grade && row.grade.ticket);
            var base = tot ? (ev + '/' + tot + (tik ? ' TICKET' : ' checks'))
                           : (tik ? 'TICKET' : 'WATCH');
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
      /* v683: render the shared SOLIDITY chip in the head line so the user
         sees which of the 5 gates the card cleared. Chip is drawn from
         hg-solidity.js; feature-checked so a missing helper renders no chip. */
      var solChip = '';
      try {
        var Wc = (typeof window !== 'undefined') ? window : ((typeof globalThis !== 'undefined') ? globalThis : null);
        if (row.solidity && Wc && typeof Wc.hgSolidityChipHtml === 'function'){
          solChip = Wc.hgSolidityChipHtml(row.solidity);
        }
      } catch(eSc){}
      /* hg-v729: SMC context chip beside the SOLIDITY chip. '' when the
         helper is absent or the row carries no .smc (engine-bridge picks
         from hgOgBridgeSetupToPick never do), so the head is unchanged. */
      var smcChipMp = '';
      try {
        var smcChipFnMp = gfn('hgSmcChipHtml');
        if (smcChipFnMp) smcChipMp = smcChipFnMp(row) || '';
      } catch (eSmcMp) { smcChipMp = ''; }

      h += '<div class="hg-mp-head">XAUUSD ' + esc(String(row.dir || '').toUpperCase())
        +  ' <span>' + esc(label) + ' · ' + esc(isEngine ? String(row.kind).slice(0, 48) : row.kind) + ' · ' + grade
        +  (solChip ? ' ' + solChip : '') + (smcChipMp ? ' ' + smcChipMp : '')
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
      var confResult = hgOgAdvancedConfluenceScore(row, tape);
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
      h += '<div><i>T2</i><b>' + (isFinite(fin(p.t2)) ? fmtPx(p.t2) : '—') + '</b><u>'
        + esc(hgOgRunnerReadout(Object.assign({ dir: row.dir }, p), label) || 'runner') + '</u></div>';
      h += '</div>';
      var mktNote = hgOgEntryMarketNote(row, p);
      if (mktNote) h += '<div class="hg-mp-note dim">' + esc(mktNote) + '</div>';
      /* how often this kind of entry becomes a trade at all */
      try {
        h += hgOgFillRateNoteHtml(row.dir, p && p.entry,
          fin(row.livePx) || fin(row.mark)) || '';
      } catch (eFr2) {}
    } else {
      h += '<div class="hg-mp-head">' + esc(label) + ' · STAND ASIDE <span>no tape-aligned ticket</span></div>';
      h += '<div class="hg-mp-note">' + esc(hgOgMpNoneWhy(tape, heldMeta)) + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* SEVENTY-SEVEN TRADES' WORTH OF INFORMATION IN A HUNDRED ROWS.

     Every interval this desk prints treats its replay rows as independent
     trades. They are not. Measured on the walk (scripts/backtest-omnigold-
     results.json, and scripts/omnigold-evidence-bake.mjs which computes
     this number): the desk publishes 59.4 plans a day on ONE instrument,
     9.34 per 4h bar, with a time-weighted mean of 55 positions open at
     once and a peak of 109. Fifty-five simultaneous gold positions is one
     bet repeated, not fifty-five independent draws.

     Clustering the per-trade R by week — positions run up to five days, so
     day-clusters still overlap each other — puts the effective sample at
     3,111 of 7,670 rows. The ratio is what this applies.

     It is not a cosmetic correction. On the one cell that looked like an
     edge, SWING/STRONG above the stop floor, the per-trade t goes 3.28
     naive, 1.85 day-clustered, 1.17 week-clustered. Read independently it
     cleared the family-wise bar; read honestly it does not clear the naive
     one. A Wilson bound built on the row count is narrower than the
     evidence supports, and this desk's whole PROVEN EDGE tier rests on
     Wilson bounds.

     A book with no overlap is not deflated: hgOgEffN is for the replay
     population, whose rows are simultaneous by construction. A sequential
     book — one position at a time — already has effN == n and callers pass
     overlapping:false for it. */
  var OG_EFF_N_RATIO = 0.406;   /* 3111.1 / 7670, week-clustered */

  function hgOgEffN(n, overlapping){
    n = fin(n);
    if (!(n > 0)) return NaN;
    if (overlapping === false) return n;
    /* never below 1 — a deflated sample is still at least one observation,
       and a zero would make every interval degenerate rather than wide */
    return Math.max(1, n * OG_EFF_N_RATIO);
  }

  /* THE SAME DEFLATION, FOR A Z INSTEAD OF A WILSON BOUND.

     hgOgReplayEdgeVerdict has applied the effective sample since the round
     that measured it — "the replay population overlaps, so its row count is
     not its sample" — because that verdict promotes a mechanic to PROVEN
     EDGE. hgOgEdgeProofPanelHtml computes a z against breakeven on THE SAME
     baked rows and was using the raw count, so the panel that exists to
     report how far the best mechanic sits from the bar was overstating
     every distance by 1/sqrt(0.406) = 1.57x.

     It cut both ways, which is the honest description of a sample that is
     smaller than it looks: the best kind read +1.71σ where the effective
     sample supports +1.09σ, and EIGHT kinds read as proven losers past -2σ
     where only ONE is. Fewer clear AND fewer fail, because 55 simultaneous
     gold positions carry less information about anything.

     The verdict does not move: nothing cleared the family bar before and
     nothing does now. What moves is the distance the panel reports, which
     is the only number in it a reader can act on.

     The live measured-edge gate is deliberately NOT changed. It reads
     x.stats.samples from the FORWARD log, which publishes aggregates with
     no timing to measure its own overlap with; borrowing this ratio there
     would be importing a constant from a different population, which is
     the error being fixed here, pointed the other way. */
  function hgOgReplayZ(row, be){
    var n = fin(row && row[0]), hit = fin(row && row[1]), b = fin(be);
    if (!isFinite(n) || !isFinite(hit) || !(n > 0)) return NaN;
    if (!(b > 0 && b < 1)) return NaN;
    var eff = hgOgEffN(n, true);
    if (!(eff > 0)) return NaN;
    return (hit - b) / Math.sqrt(b * (1 - b) / eff);
  }

  /* THE BAR A PROMOTION IS ACTUALLY TESTED AGAINST.

     hgOgReplayEdgeVerdict already keeps two bounds: lo95 for the panel to
     display and loFw at hgOgFamilyZ(78) for the verdict to act on, with the
     note that "every other site asking 'did this beat breakeven, allowing
     for how many were tried' calls hgOgFamilyZ(OG_MECHANICS.length)".

     That was not true of the forward tiers. hgOgProvenEdgeOk asks exactly
     that question — "the Wilson lower bound sits above breakeven by a real
     margin" — and asked it at an uncorrected 1.96, across all 78 mechanics
     the desk scans, on every bake.

     One-sided alpha 2.5% per test over 78 tests:

       P(at least one mechanic clears by luck)  86.1%
       expected false promotions per bake       1.95

     The corrected z is 3.2091, the same Sidak one-sided bar the replay
     verdict uses over the same family. Sweeping every (wins, n) from 25 to
     200 trades at R = 1.5 / 2 / 3: 6,296 records clear both bars, 5,304
     clear neither, and 658 — 9.5% of everything that promoted — cleared
     only the uncorrected one. Those are the thin just-over-the-line records
     a 78-way search manufactures: 12/25 at R=3, 14/25 at R=2.

     TWO BOUNDS, NOT ONE, deliberately. ev.wilson stays at 1.96 because the
     card prints it as "Wilson 95% CI" and that is what a reader understands
     a 95% interval to be. ev.wilsonFam is the bar promotion reads. Changing
     the displayed interval instead would have relabelled a descriptive
     statistic to make a decision rule fit, which is backwards. */
  function hgOgPromotionZ(){
    return hgOgFamilyZ(OG_MECHANICS.length);
  }

  /* WHY THIS IS NOT THE GATE'S "NO MEASUREMENT, NO PROMOTION".

     The measured-edge gate refuses to promote when it cannot measure the
     horizon book's overlap, and is right to: it is "the only path by which
     anything becomes a ticket", one chokepoint, and withholding there costs
     a ticket nobody was owed.

     Applying the same rule here was my first attempt and it is wrong. The
     evidence tiers read a record whose `samples` include history long since
     folded into the pruned aggregate, while spans can only be measured on
     raw records still in the live list. A mechanic with a long, strong,
     fully-pruned history would have become permanently unpromotable — its
     tier decided by the ledger's retention window rather than by its
     evidence. That is not the conservative direction, it is a different
     defect.

     So: deflate by the measured ratio wherever one exists, which is the
     common case, and say on the card when none does. The family-corrected
     bound still stands in that case; what is withheld is a claim to have
     measured the overlap, not the tier. */
  function hgOgOverlapKnown(ev){
    return !!(ev && isFinite(fin(ev.overlapRatio)) && fin(ev.overlapRatio) > 0);
  }

  /* what the card says when a tier is withheld for want of that measurement,
     rather than the panel simply going quiet */
  function hgOgOverlapScopeTxt(ev){
    if (!ev || !ev.wilson) return '';
    if (hgOgOverlapKnown(ev)){
      var eff = fin(ev.effSamples);
      return isFinite(eff)
        ? (' · ' + fin(ev.samples) + ' settled, effective ' + eff.toFixed(1) + ' after overlap')
        : '';
    }
    return ' · overlap not measurable on these records, so this sample is read as '
         + 'independent trades — concurrent ones are not independent bets, and this '
         + 'bound may be tighter than the evidence supports';
  }

  /* the bound a tier tests, with the displayed 95% one as the fallback so a
     record built before this existed is not silently un-promotable */
  function hgOgEvBound(ev){
    if (!ev) return null;
    return ev.wilsonFam || ev.wilson || null;
  }

  /* wins scale with the sample, or the deflation would move the observed
     rate as well as the width, which is not what overlap does */
  function hgOgWilsonHit(wins, n, z, opts){
    var wf = gfn('hgWilson');
    wins = fin(wins); n = fin(n);
    if (!wf || !(n > 0) || wins < 0 || wins > n) return null;
    /* A MEASURED ratio when the caller has one, the replay constant when it
       asks for `overlapping`. The two must not be confused: 0.406 was
       measured on the in-sample walk and belongs to it, which is the whole
       reason hgFwdOverlap exists for the forward log. */
    var ratio = NaN;
    if (opts && isFinite(fin(opts.effRatio)) && fin(opts.effRatio) > 0 && fin(opts.effRatio) <= 1){
      ratio = fin(opts.effRatio);
    } else if (opts && opts.overlapping === true){
      var eff0 = hgOgEffN(n, true);
      if (isFinite(eff0) && eff0 > 0 && eff0 < n) ratio = eff0 / n;
    }
    if (isFinite(ratio) && ratio > 0 && ratio < 1){
      var eff = Math.max(1, n * ratio);
      wins = wins * (eff / n);
      n = eff;
    }
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
    return { source: 'scorecard-gold', wins: wins, samples: n, hit: wins / n, wilson: w,
             wilsonFam: hgOgWilsonHit(wins, n, hgOgPromotionZ()) };
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

  /* HOW MUCH OF THIS SETTLED RECORD IS ONE BET.

     The measured-edge gate already answers this for the horizon book, from
     the log's own barT and horizonBars rather than by borrowing the replay's
     0.406, and states the rule it acts on:

       "NO MEASUREMENT, NO PROMOTION. Treating an unmeasurable overlap as 1.0
        is precisely the assumption that inflates the statistic."

     The three evidence tiers read the same ledger and did not. A mechanic
     firing on consecutive bars holds several positions at once — that is
     one bet wearing several names, and counting it as several independent
     trades is what makes a Wilson bound look tighter than the evidence is.

     A RATIO, not the raw effN, for the reason the gate gives: overlap is
     counted over records with usable timing and the test runs on settled
     ones, the two counts need not match, and the ratio is what transfers. */
  function hgOgSettledOverlapRatio(tabs, mechanic){
    var f = gfn('hgFwdOverlap');
    if (!f) return NaN;
    var o = null;
    try { o = f(tabs, mechanic || null, null); } catch (e) { return NaN; }
    var n = fin(o && o.n), eff = fin(o && o.effN);
    if (!isFinite(n) || !isFinite(eff) || !(n > 0) || !(eff > 0)) return NaN;
    var r = eff / n;
    return (r > 0 && r <= 1) ? r : NaN;
  }

  function hgOgMergeSettledEvidence(tabs, mechanic, dir){
    tabs = tabs || [];
    var wins = 0, losses = 0, sources = [], i, st;
    /* Reward multiple, pooled across the desks the same way the wins are.
       rrWins counts only the winners whose avgRr was actually reported, so a
       tab that cannot supply one dilutes nothing — it just does not vote. */
    var rrSum = 0, rrWins = 0, stWins, stRr;
    for (i = 0; i < tabs.length; i++){
      st = hgOgFwdTicketStats(tabs[i], mechanic);
      if (!st) continue;
      stWins = fin(st.wins) || 0;
      wins += stWins;
      losses += fin(st.losses) || 0;
      stRr = fin(st.avgRr);
      if (stWins > 0 && isFinite(stRr) && stRr > 0){ rrSum += stRr * stWins; rrWins += stWins; }
      sources.push(tabs[i] + (mechanic ? ':' + mechanic : ' · all TICKETs'));
    }
    var settled = wins + losses;
    if (!(settled > 0)) return null;
    var ovlRatio = hgOgSettledOverlapRatio(tabs, mechanic);
    return {
      source: sources.join(' + '),
      sources: sources,
      wins: wins,
      losses: losses,
      samples: settled,
      hit: wins / settled,
      /* NaN, not a default, when no winner reported a multiple — see
         hgOgBreakevenHit for why an assumed R must never promote a setup. */
      avgRr: rrWins > 0 ? (rrSum / rrWins) : NaN,
      wilson: hgOgWilsonHit(wins, settled),
      /* THE DECISION BOUND CARRIES EVERY CORRECTION, the displayed one none.
         ev.wilson is the interval a reader would compute from wins/samples
         and is printed as "Wilson 95% CI". ev.wilsonFam is what a tier
         tests: the family z over 77 mechanics AND this population's own
         measured overlap. One number to read, one to decide. */
      overlapRatio: ovlRatio,
      effSamples: isFinite(ovlRatio) ? Math.max(1, settled * ovlRatio) : NaN,
      wilsonFam: hgOgWilsonHit(wins, settled, hgOgPromotionZ(),
                               isFinite(ovlRatio) ? { effRatio: ovlRatio } : null),
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

  /* Confirmed activation verdict for the OMNIGOLD tab.
     ACTIVATED only when the same pick TOP SETUP already uses is a
     gate-passed, formed, level-fresh, tape-aligned TICKET. Everything
     else is NOT ACTIVATED. A scan that finds nothing is CONFIRMED
     (the miss is the read). No scan is UNCONFIRMED. Never invents a
     ticket, never flips dir, never loosens the tape rule. Pure. */
  function hgOgSetupActivation(mpArgs, mktPx){
    var tape = String((mpArgs && mpArgs.tape) || '').toLowerCase();
    var held = mpArgs && mpArgs.held;
    var checks = [];
    function push(key, pass, why){
      checks.push({ key: key, pass: pass, why: String(why || '') });
    }
    if (!mpArgs){
      push('scan', false, 'no scan yet');
      push('ticket', false, 'no ticket');
      push('formed', false, 'not judged');
      push('level-fresh', false, 'not judged');
      push('tape', null, 'unread');
      return {
        activated: false,
        state: 'NOT_ACTIVATED',
        confirm: 'UNCONFIRMED',
        why: 'No scan yet — run a gold scan. Activation is confirmed only after the gate ledger clears a ticket.',
        checks: checks,
        pick: null
      };
    }
    push('scan', true, 'scan complete');
    var pick = hgOgTopSetupPick(mpArgs);
    if (!pick){
      var tapeWhy = tape === 'long'
        ? 'gold tape UP — SHORT is not the setup'
        : tape === 'short'
          ? 'gold tape DOWN — LONG is not the setup'
          : 'tape unread — no side invented';
      push('ticket', false, 'no gate-passed ticket');
      push('formed', false, 'no formed winner');
      push('level-fresh', false, 'no levels to confirm');
      push('tape', (tape === 'long' || tape === 'short') ? true : null, tapeWhy);
      return {
        activated: false,
        state: 'NOT_ACTIVATED',
        confirm: 'CONFIRMED',
        why: hgOgMpNoneWhy(tape, held),
        checks: checks,
        pick: null
      };
    }
    var formed = !(pick.formation && pick.formation.formed === false);
    var dir = String(pick.dir || '').toLowerCase();
    var tapeOk = !(tape === 'long' || tape === 'short') || dir === tape;
    var fresh = hgOgTopSetupFresh(pick, mktPx);
    /* "not a TICKET" was true and useless once the edge gate went hard —
       it is the reason for every non-ticket on this desk, and a reader
       deserves the reason rather than the restatement. */
    push('ticket', !!(pick.grade && pick.grade.ticket),
         (pick.grade && pick.grade.ticket) ? 'gate ledger TICKET'
           : (hgOgGateClear(pick.grade) === true
               ? 'cleared every gate except measured-edge — no proven edge, so no ticket'
               : 'not a TICKET'));
    push('formed', formed, formed ? 'formation formed' : 'did not form');
    push('level-fresh', !!fresh.ok, fresh.why || (fresh.ok ? 'levels fresh' : 'levels not fresh'));
    push('tape', tapeOk,
         tapeOk
           ? ('with gold tape ' + (tape || dir).toUpperCase())
           : ('against gold tape ' + tape.toUpperCase()));
    var activated = !!(pick.grade && pick.grade.ticket) && formed && !!(fresh && fresh.ok) && tapeOk;
    var why;
    if (activated){
      why = String(dir || '').toUpperCase() + ' ' + String(pick.horizon || '') + ' ' + String(pick.kind || '')
          + ' — gate ledger + formation + level-fresh + tape confirmed.';
    } else if (fresh && !fresh.ok){
      why = (fresh.doa ? 'Ticket levels are DEAD ON ARRIVAL' : 'Levels failed freshness')
          + ' — ' + String(fresh.why || 'standing aside');
    } else {
      why = hgOgMpNoneWhy(tape, held);
    }
    return {
      activated: activated,
      state: activated ? 'ACTIVATED' : 'NOT_ACTIVATED',
      confirm: 'CONFIRMED',
      why: why,
      checks: checks,
      pick: pick,
      fresh: fresh
    };
  }

  function hgOgSetupActivationHtml(act){
    act = act || { activated: false, state: 'NOT_ACTIVATED', confirm: 'UNCONFIRMED',
                   why: 'No activation read.', checks: [] };
    var on = !!act.activated;
    var conf = String(act.confirm || (on ? 'CONFIRMED' : 'UNCONFIRMED'));
    var cls = on ? 'ok' : 'veto';
    var edge = on ? 'var(--long)' : 'var(--veto)';
    var h = '<div class="note og-setup-activation" data-og-activation="1" data-og-activated="'
      + (on ? '1' : '0') + '" role="status" aria-live="polite"'
      + ' style="display:block;margin:8px 0;padding:8px 10px;border-left:3px solid ' + edge + '">';
    h += '<div style="font-weight:bold;margin-bottom:4px">'
      + '<span class="gpip ' + cls + '">SETUP ' + (on ? 'ACTIVATED' : 'NOT ACTIVATED') + '</span>'
      + ' · <span class="gpip ' + (conf === 'CONFIRMED' ? 'ok' : 'na') + '">' + esc(conf) + '</span>'
      + '</div>';
    h += '<div>' + esc(act.why || '') + '</div>';
    var i, c, mark;
    if (act.checks && act.checks.length){
      h += '<div class="og-setup-activation-checks" style="margin-top:6px">';
      for (i = 0; i < act.checks.length; i++){
        c = act.checks[i];
        if (!c) continue;
        mark = (c.pass === true) ? 'ok' : (c.pass === false ? 'veto' : 'na');
        h += '<span class="gpip ' + mark + '" title="' + esc(c.why || '') + '">'
          + esc(String(c.key || '')) + '</span> ';
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  /* TOP SETUP panel. Renders EXACTLY what the pipeline offers:
       - a confirmed SETUP ACTIVATED / NOT ACTIVATED banner (same pick
         the gate ledger already uses — never an invented ticket), then
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
    var act = hgOgSetupActivation(mpArgs, mktPx);
    h += hgOgSetupActivationHtml(act);
    if (!mpArgs){
      h += '<div class="hg-mp-note warn">No scan yet — run a gold scan. This card only shows a setup that cleared the full gate ledger; it never reads raw logs.</div>';
      return h + '</section>';
    }
    var tape = String(mpArgs.tape || '').toLowerCase();
    var pick = hgOgTopSetupPick(mpArgs);
    var heldCards = mpArgs.heldCards || [];
    if (!pick){
      h += '<div class="hg-mp-note warn">No gate-passed setup at current price — standing aside. '
        +  esc(hgOgMpNoneWhy(tape, mpArgs.held)) + '</div>';
      h += hgOgOppositeAsideHtml(tape, heldCards);
      return h + '</section>';
    }
    var freshRead = hgOgTopSetupFresh(pick, mktPx);
    if (!freshRead.ok){
      h += '<div class="hg-mp-note warn">'
        +  (freshRead.doa ? 'Ticket levels are DEAD ON ARRIVAL' : 'No gate-passed setup at current price')
        +  ' — standing aside. ' + esc(freshRead.why) + '. Run a scan for fresh levels.</div>';
      h += hgOgOppositeAsideHtml(tape, heldCards);
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
    h += hgOgOppositeAsideHtml(tape, heldCards);
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


  /* Letter → spectrum band. Same cuts the header chip already uses:
     A ≥85, B 70–84 STRONG, C 50–69 FAIR, D <50 WEAK. */
  function hgOgLetterConfluenceScore(letter){
    var g = String(letter || '').toUpperCase();
    if (g === 'A') return 85;
    if (g === 'B') return 70;
    if (g === 'C') return 55;
    if (g === 'D') return 30;
    return NaN;
  }

  /* MULTI-FACTOR CONFLUENCE SCORING — Advanced setup quality assessment */
  function hgOgAdvancedConfluenceScore(setup, tape){
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

    /* DESK LETTER IS THE CARD'S REAL CONFLUENCE (hg-v585).
       MOST PROBABLE / WATCH picks stamp the letter via hgOgConfluenceGrade
       (indicator quartiles) but never stamp gateConf / checksPass /
       compositeScore / age. Feeding them to the scan arithmetic below
       printed 0/100 WEAK next to a B. Use the same letter the header
       already shows. Object (not scalar) so the badge stays STRONG/FAIR/
       WEAK — not the engine GRADE-A CLASS path. */
    var deskLetter = '';
    try { deskLetter = hgOgConfluenceGrade(setup, tape); } catch (eLetter){ deskLetter = ''; }
    var fromLetter = hgOgLetterConfluenceScore(deskLetter);
    if (isFinite(fromLetter)){
      return {
        score: fromLetter,
        maxScore: 100,
        factors: factors,
        interpretation: fromLetter >= 85 ? 'EXCEPTIONAL' : fromLetter >= 70 ? 'STRONG' : fromLetter >= 50 ? 'FAIR' : 'WEAK',
        fromDeskLetter: deskLetter
      };
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
    var html = '<div style="font-size:0.9em;color:var(--mut)">';
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
      html += '<div class="og-conf-plain" style="margin:12px 0;padding:8px;border:1px solid var(--line);border-radius:4px">';
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
     window 2026-03-27..2026-09-10, 54 kinds summing to n=7953 settled
     (perKind totals; the file stores the per-kind n, not the sum). Per-trade
     cost was recovered as rMultiple - netR and verified against the 0.26%
     round-trip fee model. Only kinds with n >= 40 settled are baked; smaller
     samples say nothing worth printing on a card.

     (hg-v910: this paragraph read "window 2026-03-15..2026-08-29, n=7270
     settled" and the block below read AUC 0.4924 with deciles 0.929 / 0.864.
     None of those five figures is in the file the paragraph names — 7270 is
     gold-setup-edge.json's settledScan — so they belong to a generation of
     the bake that has since been replaced. Every figure here is now read back
     out of the cited file, and test-gold-evidence-citations.mjs re-reads them
     on every run.)

     THE HEADLINE FINDINGS, so the numbers below have a reading:
       - fit verdict NOT-PREDICTIVE. Test AUC 0.5044 on a chronological
         60/40 split; the test deciles run 0.635 at the bottom to 1.051 at
         the top and are non-monotonic in between (decile 2 lifts 1.280,
         decile 6 sinks to 0.829) — the aggregate confluence score does not
         rank outcomes out of sample.
         (The records carry no per-factor breakdown, so this is the honest
         "does the total score rank outcomes" test, not a re-weighting.)
       - EVERY kind — including the best, OPENING RANGE BREAKOUT at +0.220R
         gross — is NET-NEGATIVE after the 0.26% RT cost. Fees eat the
         edge, hardest on tight-stop scalps.
       - engine grade ordering A > B > C held on win rate when that bake
         ran, on n=70 at grade A. IT IS NOT RESTATED HERE, for the same
         reason the cohort figures below are not: the current bake settles
         ONE trade per grade, so the ordering is not measurable in it at
         all, and this paragraph went on asserting it into four rendered
         strings. Ask hgOgGradeOrder(). The cost
         drag is not survivable on the scalp horizon.
         THE COHORT FIGURES THAT USED TO SIT HERE (ENGINE:SCALP -2.603R,
         ENGINE:SWING -0.056R, PF 0.90) ARE FROM A PRE-v699 BAKE and are
         deliberately not restated: they were copied out of this comment
         into four rendered strings and went on printing after the
         evidence was re-baked underneath them. ENGINE:SCALP has no row at
         all now. Ask hgOgCohortClaim(key), which reads the current
         bake. */

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
  /* hg-v917: `kinds` below is `perKind` from the evidence file — EVERY settled
     firing of a detector across the whole walk, priced at the replay's PAXG
     round trip. hgOgReplayNetAtVenue re-prices that number to the desk's venue
     when it renders, and until now that was the only correction applied.

     The SAME committed file carries sequentialBake.formedByKind: the same 54
     mechanics scoped to the GATE-CLEAR population — what survived the 35-gate
     stack its own fingerprint names — with netR_xm already computed. Nothing
     read it. Re-pricing an unscoped population and measuring the scoped one
     are different corrections, and they do not agree: for 42 of the 54 the
     gate-clear record is WORSE than the re-priced line, net-positive at XM
     falls from 12 kinds to 9, and 7 change sign.

     So each row now carries both. Positions 0-4 are the unscoped record as
     before; 5-8 are [formedN, formedWinRate, formedNetXm, formedGrossR].
     Derived by scripts/omnigold-formed-population.mjs, which a test re-runs
     against the evidence JSON rather than trusting these literals.

     NOTHING IS PROMOTED OR VETOED DIFFERENTLY. At naive n — the most generous
     case, since the real path deflates by overlap — no kind reaches the
     family bar on either basis. One reaches the naive 95% bar as displayed
     and not on the gate-clear record: P6-FAIL, over by +0.0005 and under by
     -0.0260. That is the whole behavioural difference, and it is recorded
     rather than acted on. */
  /* hg-v935: SELECTING MECHANICS BY THEIR OWN RECORD, MEASURED AND REFUSED.

     This desk forms setups from every registered mechanic, and its
     measured-edge gate only vetoes at -2 sigma, which almost nothing reaches.
     So the obvious improvement is "only form the mechanics whose record is
     positive". It is obvious enough that it had to be TESTED, because ranking
     54 mechanics on the whole book and then scoring on that same book cannot
     fail - the selection has already seen every outcome it is judged on, and
     hg-v920 caught that exact shape once already.

     scripts/mechanic-selection.mjs never lets the selection see the window it
     is judged on: the book is cut into four disjoint windows, the mechanics
     are ranked on the OTHER THREE, and the chosen set is scored on the held-out
     one. Four independent out-of-sample trials, at both fill bounds.

     THE OBVIOUS RULE FAILS. "Keep the gross-positive mechanics" scores 13-14
     of 16 at every sample floor - never unanimous, in either the gross or the
     net column. The idea that the desk can pick its winners is not supported.

     THE WEAK RULE IS UNANIMOUS AND IS STILL REFUSED. Dropping only the
     mechanics measured at or below a bar IS unanimous at some bars - and the
     sweep below shows it switching ON and OFF between NEIGHBOURING thresholds
     (-0.05 yes, -0.10 yes, -0.15 no, -0.20 no, -0.25 yes, -0.30 yes, -0.40
     no). A real effect fades as the bar moves. One that flickers is the output
     of a search over bars, which is hg-v922's finding about stop width
     restated, and that refusal stands for the same reason.

     AND THE CEILING IS THE POINT FOR ANYONE HOPING THIS IS THE LEVER. The best
     unanimous cell in the whole sweep lifts net expectancy by +0.03R and leaves
     the book at about -0.09R. Mechanic selection, at its most generous reading,
     does not make this desk profitable - it makes it slightly less negative.

     NOTHING IS GATED ON ANY OF IT. No mechanic is dropped, no threshold moves,
     and hgOgUnobservedPanelHtml's family bar is unchanged. This is published
     so the next person to have the idea finds the measurement instead of
     re-deriving it. Re-derive: node scripts/mechanic-selection.mjs */
  /* --- BEGIN GENERATED HG_OG_SELECTION (scripts/mechanic-selection.mjs) ---
     Do not hand-edit; `node scripts/mechanic-selection.mjs` is the drift check. */
  var HG_OG_SELECTION = {
    windows: 4, minN: 20,
    bookN: 8132, bookGross: -0.0222, bookNet: -0.116,
    unanimousCells: 4, runs: 2, contiguous: false,
    bestBar: -0.05, bestLift: 0.0299, ceilingNet: -0.0861,
    ships: false,
    sweep: [
      { bar: -0.05, agree: 16, keptPct: 63.8219, netLift: 0.0299, unanimous: true },
      { bar: -0.10, agree: 16, keptPct: 73.0202, netLift: 0.0252, unanimous: true },
      { bar: -0.15, agree: 14, keptPct: 82.0954, netLift: 0.0107, unanimous: false },
      { bar: -0.20, agree: 15, keptPct: 91.4166, netLift: 0.0096, unanimous: false },
      { bar: -0.25, agree: 16, keptPct: 94.4048, netLift: 0.0071, unanimous: true },
      { bar: -0.30, agree: 16, keptPct: 95.3763, netLift: 0.0071, unanimous: true },
      { bar: -0.40, agree: 12, keptPct: 99.336, netLift: 0.0006, unanimous: false },
      { bar: -0.50, agree: 12, keptPct: 99.5819, netLift: 0.0001, unanimous: false },
      { bar: -0.75, agree: 10, keptPct: 99.9754, netLift: -0.0001, unanimous: false },
      { bar: -1.00, agree: 4, keptPct: 99.9754, netLift: -0.0001, unanimous: false }
    ]
  };
  /* --- END GENERATED HG_OG_SELECTION --- */

  var HG_OG_REPLAY_EVIDENCE = {
    src: 'scripts/omnigold-replay-evidence.json',
    window: '2026-03-27..2026-09-10',   /* refreshed 2026-09-10 post hg-v699 */
    barBasis: 'PAXGUSDT 1h proxy',
    settled: 8155,
    rtCostPct: 0.26,
    fit: { verdict: 'not-predictive', testAUC: 0.5044,
           topDecileLift: 1.051, bottomDecileLift: 0.635 },
    kinds: {
      'ROUND-MAGNET': [620, 0.3403, -0.834, 0.036, 0.630, 587, 0.3169, -0.109, -0.043],
      'STOCHRSI-TURN': [434, 0.3249, -0.689, 0.026, 0.487, 425, 0.3318, -0.04, 0.015],
      'P8-RANGE': [358, 0.2542, -2.163, -0.235, 1.177, 323, 0.1765, -0.613, -0.47],
      'CCI-EXTREME': [328, 0.3323, -0.748, 0.023, 0.521, 322, 0.3385, -0.033, 0.027],
      'P9-VOLBAR': [315, 0.2952, -1.487, -0.112, 0.982, 274, 0.2007, -0.499, -0.397],
      'PD-EQUILIBRIUM': [288, 0.3090, -5.158, -0.073, 2.311, 237, 0.1603, -0.926, -0.519],
      'THREE-BAR': [279, 0.3513, -3.732, 0.054, 2.087, 207, 0.1208, -0.927, -0.638],
      'ADR-FADE': [210, 0.3476, -1.260, 0.043, 1.353, 161, 0.1988, -0.498, -0.404],
      'MMOVE': [206, 0.3107, -0.236, 0.088, 0.233, 177, 0.3559, 0.059, 0.084],
      'P6-FAIL': [197, 0.3909, -1.670, 0.203, 0.914, 182, 0.3736, -0.02, 0.123],
      'PIN-REJECT': [192, 0.3646, -3.838, 0.094, 2.208, 138, 0.1232, -0.94, -0.63],
      'SWEEP-V2': [189, 0.2963, -1.600, -0.087, 0.688, 172, 0.2558, -0.329, -0.22],
      'PIVOT-REJECT': [171, 0.2749, -1.126, -0.168, 0.610, 159, 0.2327, -0.373, -0.303],
      'PO3': [162, 0.2963, -0.841, -0.071, 0.484, 148, 0.2905, -0.185, -0.126],
      'FVG-HVN': [161, 0.2484, -0.680, -0.135, 0.336, 145, 0.2621, -0.204, -0.162],
      'P4-LAF': [156, 0.3782, -0.653, 0.141, 0.578, 150, 0.3333, -0.057, 0],
      'FVG-FILL': [155, 0.2774, -0.387, 0.027, 0.286, 132, 0.2955, -0.069, -0.038],
      'WEEKLY-OPEN': [154, 0.3312, -0.936, 0.020, 0.639, 140, 0.3, -0.159, -0.09],
      'KZ-JUDAS': [150, 0.2800, -1.992, -0.160, 0.924, 140, 0.2429, -0.414, -0.271],
      'ORB': [146, 0.2740, -0.346, 0.028, 0.236, 125, 0.296, -0.049, -0.02],
      'P5-VWAP': [139, 0.2806, -0.805, -0.120, 0.406, 133, 0.2857, -0.188, -0.135],
      'NR7-BREAK': [139, 0.2590, -0.539, -0.107, 0.280, 119, 0.2857, -0.164, -0.131],
      'FIB-618': [132, 0.2955, -0.635, -0.064, 0.391, 127, 0.2992, -0.131, -0.087],
      'P7-SCALP': [132, 0.3409, -0.884, 0.054, 0.680, 127, 0.3543, -0.01, 0.063],
      'INSIDE-BREAK': [122, 0.2869, -0.446, 0.018, 0.294, 108, 0.3148, -0.034, 0.002],
      'AVWAP-RECLAIM': [118, 0.3305, -0.460, 0.046, 0.321, 112, 0.3304, -0.043, -0.005],
      'MFI-SQUAT': [117, 0.2821, -0.627, -0.041, 0.367, 105, 0.2952, -0.12, -0.077],
      'EMA50-HOLD': [116, 0.2586, -0.893, -0.144, 0.434, 109, 0.2752, -0.201, -0.144],
      'ENGULF-LEVEL': [114, 0.3421, -3.175, 0.026, 1.571, 95, 0.2211, -0.572, -0.337],
      'DI-CROSS': [112, 0.2321, -0.485, -0.118, 0.241, 96, 0.2813, -0.112, -0.083],
      'HA-FLIP': [109, 0.2936, -0.415, 0.052, 0.295, 97, 0.3196, -0.011, 0.025],
      'TREND-RECLAIM': [106, 0.3491, -0.369, 0.121, 0.344, 99, 0.3636, 0.055, 0.092],
      'ICHI-KUMO': [106, 0.2358, -0.453, -0.106, 0.236, 89, 0.2697, -0.161, -0.134],
      'STRUCT-BOS': [105, 0.3048, -0.202, 0.145, 0.213, 87, 0.3448, 0.082, 0.109],
      'SPRING': [104, 0.1923, -1.429, -0.382, 0.523, 97, 0.1649, -0.554, -0.477],
      'RIBBON-PULLBACK': [103, 0.2524, -0.563, -0.070, 0.286, 88, 0.2614, -0.168, -0.132],
      'P6-COMP': [95, 0.2526, -0.320, -0.018, 0.227, 82, 0.3293, 0.019, 0.042],
      'UTAD': [91, 0.3846, -1.043, 0.154, 0.644, 83, 0.3494, -0.045, 0.048],
      'ASIA-BREAK': [90, 0.2222, -0.461, -0.042, 0.233, 75, 0.2667, -0.073, -0.042],
      'LONDON-FIX': [89, 0.2022, -0.547, -0.189, 0.256, 69, 0.2464, -0.233, -0.205],
      'BOS-RETEST': [85, 0.3059, -0.392, 0.067, 0.233, 74, 0.3378, 0.003, 0.037],
      'ER-IGNITION': [81, 0.2593, -1.339, -0.222, 0.626, 74, 0.1892, -0.504, -0.432],
      'PDL-SWEEP': [81, 0.2222, -1.452, -0.333, 0.716, 80, 0.2, -0.484, -0.4],
      'PDH-SWEEP': [75, 0.3467, -0.955, 0.054, 0.648, 67, 0.3284, -0.095, -0.013],
      'VWAP-REVERT': [65, 0.3077, -0.658, -0.041, 0.346, 63, 0.3175, -0.089, -0.041],
      'VWAP-BAND': [63, 0.2381, -0.890, -0.286, 0.487, 57, 0.2281, -0.359, -0.316],
      'P5-WYCK': [58, 0.2241, -0.693, -0.219, 0.352, 56, 0.25, -0.231, -0.195],
      'EQL-SWEEP': [53, 0.2075, -1.168, -0.366, 0.625, 53, 0.2264, -0.383, -0.322],
      'NY-OPEN-DRIVE': [51, 0.2157, -0.358, -0.025, 0.216, 41, 0.2683, -0.051, -0.025],
      'SQUEEZE-FIRE': [50, 0.3200, -0.328, 0.108, 0.258, 45, 0.3556, 0.075, 0.108],
      'P5-DRIVE': [48, 0.3333, -0.226, 0.228, 0.307, 41, 0.3902, 0.18, 0.215],
      'RSI-DIVERGE': [46, 0.3696, -1.931, 0.123, 1.379, 39, 0.2308, -0.457, -0.309],
      'CUSUM-SHIFT': [45, 0.2444, -0.237, 0.041, 0.247, 32, 0.3438, 0.071, 0.092],
      'EQH-SWEEP': [42, 0.3571, -0.971, 0.071, 0.612, 41, 0.3659, 0.016, 0.098]
    },
    /* hg-v918 — THE ONE POSITION A PERSON ACTUALLY HOLDS, AT BOTH ENDS.

       Every table above counts each plan the scan formed. This walk forms
       59.4 a day on one instrument and holds a time-weighted 57 at once, so
       those tables describe a book nobody could run. sequentialByCell in the
       evidence file is the honest one — walk the plans in time order, take
       one when flat, hold it to its own exit, skip whatever fires while it
       runs — and NOTHING HAS EVER READ IT. Neither has sequentialByKind or
       sequentialTickets. They sit in the committed JSON, unshown.

       Read alone, that table says the scalp side is the problem:

         SCALP/FAIR   n=210   net@XM -0.343R   effN 210

       the only cell in the sequential book with real power, losing hard.
       It is the obvious thing to gate, and gating it would be wrong.

       IT IS ONE END OF AN INTERVAL. The bake computes those cells on
       `formed`, its LOWER bound: 1,751 of 7,734 settled rows resolved on
       their own fill bar, OHLC cannot say whether the entry printed before
       the exit, and the lower bound deletes those wins while keeping those
       losses. scripts/omnigold-evidence-bake.mjs states the rule in its own
       words — performance CLAIMS belong at that end, verdicts must not come
       from it, and condemning at the lower bound is what once marked
       seventeen mechanics significantly below breakeven when not one failed
       at its upper bound.

       So the mirror is baked and published beside it, and a cell is only
       read as losing when BOTH ends agree. Not one does:

         SCALP/FAIR    lower -0.343R (n=210)  upper +0.145R (n=156)
         SCALP/STRONG  lower +0.149R (n= 37)  upper +0.212R (n= 24)
         SCALP/WEAK    lower -0.087R (n= 15)  upper +0.493R (n= 12)
         SWING/FAIR    lower -0.133R (n= 10)  upper +0.173R (n= 10)

       And on the TICKET book one at a time — the split anyone asking
       "is the scalp side the problem" actually wants — the sign is the
       other way round from the whole-book reading:

         SCALP  lower +0.148R (n=73)  upper +0.415R (n=54)
         SWING  lower -0.240R (n=32)  upper +0.317R (n=35)

       THERE IS NO DEMONSTRATED SCALP LOSS. Positive at both ends on tickets
       taken one at a time; the negative whole-book scalp reading is the
       unscoped, overlapping, lower-bound view of a population nobody trades.
       Nothing is gated on any of this — it is published so the next reader
       who finds SCALP/FAIR at -0.343R sees the other end in the same place.

       [n, winRate, netR_xm] at each bound, from the evidence file's
       sequentialByCell / sequentialByCellUpper and the horizon twins.
       Re-derive: node scripts/omnigold-evidence-bake.mjs */
    /* hg-v919 — THE INFERENCE THE COST ARITHMETIC INVITES, AND WHY IT IS NOT
       TAKEN.

       costR = rtCostPct / stopPct exactly. At a fixed venue the fee load in R
       is a DETERMINISTIC function of stop width and of nothing else — not the
       mechanic, not the session, not the direction. That is arithmetic, it
       holds at both bounds, and it is what hgOgCostCeilingDemand inverts.

       One step further is the obvious conclusion: if the fee is fixed by
       geometry, and geometry buys nothing, then the widest stop the structure
       allows is strictly better and the desk should be pushing stops out.
       THAT STEP IS NOT SUPPORTED, and the reason is specific rather than a
       shrug about sample size.

       Gross R by stop-width band on the sequential book, at both ends of the
       fill-ambiguity interval, [n, grossR]:

         band        lower bound          upper bound
         <0.133%     -0.600R (n=30)       +0.500R (n=18)
         <0.16%      -0.471R (n=17)       +0.909R (n=11)
         <0.32%      -0.051R (n=79)       +0.500R (n=48)
         <0.50%      -0.195R (n=41)       +0.250R (n=36)
         <0.867%     -0.109R (n=62)       -0.017R (n=47)
         <1.733%     -0.080R (n=36)       -0.033R (n=36)
         >=1.733%    +0.013R (n=10)       +0.026R (n=11)

       The slope FLIPS SIGN between the ends. At the lower bound gross rises
       as stops widen, which says tighten nothing and widen everything. At the
       upper bound it falls, which says the opposite. Both cannot be true, and
       the mechanism is not mysterious: a tight stop is precisely the trade
       most likely to resolve on its own fill bar, so the tight bands are
       where the unprovable-fill rows concentrate and where the bound swings
       hardest. This walk cannot answer the question, and a re-bake on a feed
       with intrabar sequence is what would.

       So nothing here widens a stop, moves a ceiling, or ranks a setup. The
       table is carried so the next reader who derives the same tempting
       conclusion from the same correct arithmetic finds this underneath it.
       [n, grossR] per band at each bound, from the evidence file's
       sequentialByStopBand / sequentialByStopBandUpper. */
    stopBandGross: {
      '<0.133': { lo: [30, -0.6], hi: [18, 0.5] },
      '<0.16': { lo: [17, -0.4706], hi: [11, 0.9091] },
      '<0.32': { lo: [79, -0.0506], hi: [48, 0.5] },
      '<0.5': { lo: [41, -0.1951], hi: [36, 0.25] },
      '<0.867': { lo: [62, -0.1093], hi: [47, -0.0166] },
      '<1.733': { lo: [36, -0.0796], hi: [36, -0.0326] },
      '>=1.733': { lo: [10, 0.0128], hi: [11, 0.0262] }
    },
    /* What the ceiling costs the book at each venue, measured on the replay.
       Share of rows the cost gate alone vetoes — stable across the fill
       bounds (95.9% / 44.4% at the lower one), because the bound deletes
       rows without changing anyone's stop. */
    costCeilingVeto: {
      SCALP: { XM: 0.164, PAXG: 0.961 },
      SWING: { XM: 0.001, PAXG: 0.474 }
    },
    sequentialCells: {
      'SCALP/FAIR': { lo: [210, 0.2414, -0.3434], hi: [156, 0.404, 0.1449] },
      'SCALP/STRONG': { lo: [37, 0.3889, 0.1491], hi: [24, 0.4167, 0.2122] },
      'SCALP/WEAK': { lo: [15, 0.2857, -0.0873], hi: [12, 0.5, 0.4932] },
      'SWING/FAIR': { lo: [10, 0.3, -0.1325], hi: [10, 0.4, 0.1731] }
    },
    sequentialTicketHorizon: {
      'SCALP': { lo: [73, 0.3971, 0.1484], hi: [54, 0.4902, 0.4155] },
      'SWING': { lo: [32, 0.2581, -0.2399], hi: [35, 0.4412, 0.3166] }
    },
    /* THE OTHER SIDE OF THE 40-TRADE BAR.

       `kinds` above is every mechanic the bake could measure. These are the
       ones it could not: they fire on this walk and settle too few times to
       carry a record, so the bake omits them rather than zero-fill — right,
       and until now silent. A card for a mechanic with no row rendered NO
       replay line, which reads exactly like a mechanic that was measured
       and came back fine.

       Counts only, deliberately. These are settled firings after the stop
       floor, the cost veto and broker hours; the walk's raw count is much
       larger (POC-REVERT fires 146 times and two survive), and the gap is
       the filtering rather than the detector. A win rate is NOT published
       here: a rate on eleven trades under a caveat is the same overclaim
       with a disclaimer attached.

       From scripts/omnigold-replay-evidence.json sequentialBake
       .kindBelowThreshold — baked, never hand-counted. */
    kindsBelowBar: { minN: 40, counts: {
      'VALUE': 29, 'VOL-EXPANSION': 26, 'P8-VPINBO': 25, 'P6-ZFADE': 23,
      'PWH-SWEEP': 22, 'PWL-SWEEP': 22, 'ABSORB': 14, 'OB-RETEST': 12,
      'P5-TURT': 7, 'P4-ADRX': 3, 'POC-REVERT': 2,
      'COMPRESSION-BREAK': 1, 'DONCHIAN-DRIVE': 1
    } },
    /* hg-v700 refresh note: the ENGINE cohort collapsed from 277 to 3 settled
       trades — the hg-v699 GOLD SCALP overhaul (stop floor + edge suppressions)
       made bridge picks scarce, so per-grade ENGINE rows are no longer
       statistically meaningful. Rows kept for shape; n says everything. */
    grades: {
      'A': [1, 0.0000, 0.874],
      'B': [1, 1.0000, 1.391],
      'C': [1, 0.0000, 0.283]
    },
    /* SCAN multi-factor score tiers, [n, winRate, avgNetR], baked from
       scripts/backtest-omnigold-results.json aggregates.byTier (refreshed
       window). The ordering is still the point: WEAK 32% ~= STRONG 32% >
       FAIR 30% — the tiers still do not rank outcomes (fit not-predictive,
       deciles non-monotonic 0.635..1.28..1.051). No EXCEPTIONAL row exists
       because >=85 is unreachable by the scan arithmetic offline. */
    tiers: {
      'WEAK':   [ 407, 0.3220, -0.370],
      'FAIR':   [6338, 0.2980, -1.463],
      'STRONG': [1407, 0.3180, -0.492]
    },
    /* Median per-trade fee load in R over settled replay trades (n=8155),
       computed from trades[] as rMultiple - netR at the 0.26% PAXG RT. */
    medianCostR: { all: 0.546, scalp: 0.635, swing: 0.282 },
    /* ENGINE:SWING n=3 this window — no meaningful profit factor exists
       (the old 0.90 was measured on n=27 pre-v699). null, not a number. */
    pf: { 'ENGINE:SWING': null },
    cohorts: {
      'SCAN:SCALP':   [6461, 0.2959, -1.438, -0.034],
      'SCAN:SWING':   [1691, 0.3294, -0.488,  0.009],
      'ENGINE:SWING': [   3, 0.3333,  0.849,  0.954]
    }
  };

  /* ONE DETECTOR, TWO DIRECTION LABELS — AND THE LABELS ARE NOT
     INTERCHANGEABLE, SO EACH KEEPS ITS OWN RECORD.

     hgOmniSpring (omniroute.js) returns kind 'SPRING' when the last bar
     sweeps the range LOW and closes back inside, and kind 'UTAD' when it
     sweeps the HIGH. Same function, same rule. The walk confirms the labels
     are pure direction: SPRING is 123 of 123 long, UTAD 106 of 106 short.

     THE BUG THAT WAS REAL. The gate read UTAD's stats under 'SPRING', so a
     short setup was judged on 104 long trades and none of its own 91. That
     half is the worse half — 19.2%, z -3.05, a VETO — and it condemned
     every short firing of the detector on evidence that was not its own.

     THE FIX THAT WAS WRONG. hg-v764 answered that by pooling: one detector,
     one record, 28.2%. But pooling is only correct if the halves are
     interchangeable draws from one distribution, and they are not. Measured
     across the unprovable-fill interval, SPRING settles 16.5 / 22.2 / 27.3%
     and UTAD 34.9 / 42.0 / 45.9% (lower / point / upper). A pooled 28.2%
     describes NEITHER: it condemns the short half on the long half's record
     and flatters the long half with the short half's.

     Nor is the split peculiar to this detector. Three more omnigold
     detectors emit a direction-labelled pair the same way — hgOgPdSweep
     (PDL / PDH), the EQ sweep in hg-mechanics.js (EQL / EQH), hgOgPwSweep
     (PWL / PWH) — and in all four the short half is the better one, at
     every bound: 12 of 12 comparisons, none reversing. The ledger already
     keeps those three as separate rows and the gate already judges them
     separately. SPRING/UTAD was the only pooled pair, so the fold was also
     the inconsistency.

     WHAT THIS DOES AND DOES NOT CLAIM. Un-pooling is not a bet that shorts
     work. Overlap-corrected, no pair reaches +/-1.9 at any bound and the
     combined statistic peaks at -2.15 against a family-wise bar of 2.234
     for four tests, so the asymmetry is NOT established — it is recorded
     forward (hgFwdNormalize's dirHalf) for an out-of-sample test. What is
     established is narrower and enough on its own: a record measured on one
     direction does not describe the other, so it must not be used to judge
     it. Each label reads its own row, in the gate and in the panel alike.

     WHAT CHANGES AT THE GATE, BOTH WAYS. Pooled, each half read 28.2% at
     z -1.28 and both came back UNCHECKED — so the fold did not only spare
     the short half, it LIFTED A VETO off the long one. Un-pooled:

       SPRING  n=104  19.2%  z -3.05  ->  VETO      (was UNCHECKED)
       UTAD    n= 91  38.5%  z +1.04  ->  UNCHECKED (was UNCHECKED)

     Which is the point, and it cuts against the desk as often as for it:
     the long half is condemned on the long half's record rather than
     rescued by the short half's. It also brings the pair into line with
     PDL-SWEEP, already vetoed on its own -2.12 while PDH-SWEEP is not.
     NOTHING IS PROMOTED — UTAD at +1.04 is nowhere near the 54-mechanic
     bar, and no gold mechanic clears at any tier. This buys no tickets.

     (The in-sample veto sits at a naive -2 while promotion needs family-
     wise +3.11. That asymmetry is deliberate and older than this change:
     condemning one mechanic is cheap and reversible, promoting one spends
     the desk's money. Untouched here.)

     The fold machinery below stays. It is the right answer for labels that
     genuinely ARE one sample, and emptying the map rather than deleting the
     code keeps that one line away from the callers. Nothing folds today, so
     hgOgReplayFamilySize counts 54 again: two records judged against two
     bars are two tests, and the correction has to say so. */
  var OG_KIND_ALIAS = {};

  /* THE FOUR PAIRS, NAMED SO THE SPLIT CAN BE READ INSTEAD OF REMEMBERED.

     Not an alias — the whole point above is that these do NOT fold. This is
     the map that lets a card show the other half of its own detector, and
     lets the forward log be asked the pair question later without anyone
     having to know which labels go together. Long label first.

     Each detector is one function returning one label per side, so the walk
     shows every firing of a label on one side: SPRING 123/123 long, UTAD
     106/106 short, and the same for the other three. */
  var OG_DIR_PAIRS = [
    ['SPRING',    'UTAD'],
    ['PDL-SWEEP', 'PDH-SWEEP'],
    ['EQL-SWEEP', 'EQH-SWEEP'],
    ['PWL-SWEEP', 'PWH-SWEEP']
  ];

  /* The other half of `kind`'s detector, with which side it is, or null for
     a mechanic that has no direction twin. */
  function hgOgDirSibling(kind){
    var key = String(kind || '').toUpperCase(), i;
    for (i = 0; i < OG_DIR_PAIRS.length; i++){
      if (OG_DIR_PAIRS[i][0] === key) return { kind: OG_DIR_PAIRS[i][1], side: 'short', selfSide: 'long' };
      if (OG_DIR_PAIRS[i][1] === key) return { kind: OG_DIR_PAIRS[i][0], side: 'long',  selfSide: 'short' };
    }
    return null;
  }

  /* Merge two [n, winRate, avgNetR, avgGrossR, medianCostR] rows. Counts
     add; the rates are re-weighted by n, which is the only correct way to
     combine them — averaging two win rates from unequal samples is how a
     19-point gap becomes an invented midpoint. */
  function hgOgMergeReplayRows(a, b){
    if (!a) return b || null;
    if (!b) return a;
    var na = fin(a[0]) || 0, nb = fin(b[0]) || 0, n = na + nb;
    if (!(n > 0)) return a;
    var wavg = function(ia, ib){
      var va = fin(a[ia]), vb = fin(b[ib]);
      if (!isFinite(va) && !isFinite(vb)) return null;
      if (!isFinite(va)) return vb;
      if (!isFinite(vb)) return va;
      return (va * na + vb * nb) / n;
    };
    return [n, wavg(1, 1), wavg(2, 2), wavg(3, 3), wavg(4, 4)];
  }

  /* Every key that folds into `key`, the key itself first. */
  function hgOgKindGroup(key){
    var out = [key], k;
    for (k in OG_KIND_ALIAS){
      if (!Object.prototype.hasOwnProperty.call(OG_KIND_ALIAS, k)) continue;
      if (OG_KIND_ALIAS[k] === key && out.indexOf(k) < 0) out.push(k);
    }
    return out;
  }

  function hgOgReplayRow(map, key){
    if (!map) return null;
    /* an aliased label resolves to its mechanic, so 'UTAD' and 'SPRING'
       reach the same row rather than two different ones */
    var canon = Object.prototype.hasOwnProperty.call(OG_KIND_ALIAS, key)
      ? OG_KIND_ALIAS[key] : key;
    var group = hgOgKindGroup(canon), merged = null, i;
    for (i = 0; i < group.length; i++){
      if (Object.prototype.hasOwnProperty.call(map, group[i])){
        merged = hgOgMergeReplayRows(merged, map[group[i]]);
      }
    }
    return merged;
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
                      medianCostR: (row.length > 4 ? row[4] : null),
                      /* hg-v917: the gate-clear half of the SAME bake —
                         sequentialBake.formedByKind, already priced at XM.
                         row[2] above is every firing across the whole walk at
                         PAXG; this is what survived the 35-gate stack, at the
                         venue the desk's order path uses. Absent stays absent:
                         a short row yields null, never a zero-filled record. */
                      /* n here is SETTLED, the denominator winRate and netXm
                         are both over - not the firing count. 43 of the 54
                         kinds have the two differing (MMOVE fires 204 and
                         settles 177), so quoting the firing count beside a
                         rate computed on settles would misstate it. */
                      formed: (row.length > 8
                        ? { n: row[5], winRate: row[6], netXm: row[7], grossR: row[8] }
                        : null) };
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

  /* ====================================================================
     A COHORT IS QUOTED FROM THE RECORD, OR IT IS NOT QUOTED

     Four places on this tab described a replay cohort in prose. All four
     wrote the NUMBER into the sentence and the JUDGEMENT into the grammar,
     and then the evidence was re-baked underneath them. What the reader
     actually saw, measured on the shipped build:

       "the replay's ENGINE scalp cohort lost 2.60R/trade net"
       "replay: scalp cost drag -2.6R/trade net — swing geometry
        survived (PF 0.90)"
       "No cohort finished net-positive; the closest was ENGINE setups on
        SWING geometry (0.85R/trade net, PF 0.90 — still a net loss).
        ... Every number here is measured"

     ENGINE:SCALP has no row in the current bake at all, so both -2.6
     figures came from the literal fallback every single render — a number
     from a previous bake, printed as a measurement. PF 0.90 is printed
     while this file's own evidence object carries
     pf: { 'ENGINE:SWING': null } with the note "the old 0.90 was measured
     on n=27 pre-v699. null, not a number". And the banner calls +0.85R
     "still a net loss" one clause after declaring that no cohort finished
     net-positive, having just computed +0.85 from the record.

     This file's header already states the rule that was broken: a count
     written into prose drifts silently. It applied it to the mechanic
     count and not to the cohort numbers.

     So: one resolver, and every sentence derived from what it returns.
     The sign decides the verb, the record decides the number, and a
     cohort with no row says so instead of falling back to a literal.

     SAMPLE SIZE IS PART OF THE CLAIM, not a footnote. ENGINE:SWING is
     THREE trades. MIN_SAMPLES is this desk's own "too few to judge" bar
     everywhere else, and a cohort under it cannot be called the closest,
     cannot have survived, and is not evidence of an edge in either
     direction. Reporting +0.85R without n=3 beside it would be the same
     failure as the one above, flattering instead of stale. */

  /* -> { key, missing, n, net, winRate, gross, pf, thin } — never a literal.
     `missing` when the bake has no such cohort; `thin` when it has fewer
     than MIN_SAMPLES settled trades. */
  function hgOgCohortClaim(key){
    var k = (key === null || key === undefined) ? '' : String(key);
    var ev = k ? hgOgReplayEvidence(k) : null;
    if (!ev) return { key: k, missing: true, n: 0, net: NaN, winRate: NaN,
                      gross: NaN, pf: NaN, thin: true };
    var n = fin(ev.n);
    var pfMap = (HG_OG_REPLAY_EVIDENCE && HG_OG_REPLAY_EVIDENCE.pf) || {};
    return {
      key: k, missing: false,
      n: isFinite(n) ? n : 0,
      net: fin(ev.avgNetR), winRate: fin(ev.winRate), gross: fin(ev.avgGrossR),
      /* A PLAIN LOOKUP, NOT hgOgReplayRow. That helper resolves aliases and
         MERGES rows, which is right for [n, winRate, net, gross] and wrong
         for a scalar: it only returns a bare number at all because
         hgOgMergeReplayRows(null, x) short-circuits to x, and a second key
         in the same group would have it index a[0] on a number. A profit
         factor has no aliases and two of them cannot be averaged without
         their trade counts anyway.
         null in the pf map is a deliberate "no meaningful value" rather
         than a missing key — fin(null) is NaN, which is exactly right. */
      pf: fin(Object.prototype.hasOwnProperty.call(pfMap, k.toUpperCase())
                ? pfMap[k.toUpperCase()] : null),
      thin: !(isFinite(n) && n >= MIN_SAMPLES)
    };
  }

  /* '-1.44R/trade net' / '+0.85R/trade net', or null when there is no
     number to print. The sign is read off the record, never assumed. */
  function hgOgCohortNetTxt(c, dp){
    if (!c || c.missing || !isFinite(c.net)) return null;
    var d = (dp === 1 || dp === 2) ? dp : 2;
    return (c.net >= 0 ? '+' : '') + c.net.toFixed(d) + 'R/trade net';
  }

  /* How many trades the claim rests on. The thin case always says so —
     it is the most important thing about the row — but in two lengths,
     because a banner sentence and a dim card line punctuate differently
     and the long form nested inside a dash clause reads as two thoughts.
       short: '3 trades — too few to judge'  (caller parenthesises)
       long : 'on 3 trades, under the 20 this desk needs before it will
               judge anything' */
  function hgOgCohortNTxt(c, short){
    if (!c || c.missing || !(c.n > 0)) return null;
    var n = hgOgFmtCount(c.n) + ' trade' + (c.n === 1 ? '' : 's');
    if (short) return c.thin ? (n + ' — too few to judge') : n;
    return c.thin
      ? ('on ' + n + ', under the ' + MIN_SAMPLES
         + ' this desk needs before it will judge anything')
      : ('over ' + n);
  }

  /* ' · PF 0.90' when the bake carries one, '' when it carries null. */
  function hgOgCohortPfTxt(c){
    return (c && isFinite(c.pf)) ? (' · PF ' + c.pf.toFixed(2)) : '';
  }

  /* The cohort book, read rather than asserted: every cohort key in the
     bake, the best of them by net R, and whether ANY of them finished
     net-positive. This is what replaces "No cohort finished net-positive"
     as a hardcoded clause. */
  function hgOgCohortBook(){
    var E = HG_OG_REPLAY_EVIDENCE;
    var keys = (E && E.cohorts) ? Object.keys(E.cohorts) : [];
    var rows = [], i, c;
    for (i = 0; i < keys.length; i++){
      c = hgOgCohortClaim(keys[i]);
      if (!c.missing && isFinite(c.net)) rows.push(c);
    }
    rows.sort(function(a, b){ return b.net - a.net; });
    var positive = rows.filter(function(r){ return r.net > 0; });
    return {
      rows: rows,
      best: rows.length ? rows[0] : null,
      positiveN: positive.length,
      /* a positive cohort that is too thin to judge is NOT a finding, and
         the banner must not be able to read it as one */
      positiveJudgeableN: positive.filter(function(r){ return !r.thin; }).length
    };
  }

  /* ====================================================================
     A WIN RATE NEEDS TRADES TO BE A RATE

     hg-v814 made every COHORT sentence derive from the record. It did not
     look at the GRADES map, which has the same disease and further along:
     the current bake settles ONE trade per engine grade.

       grades: { A: [1, 0.000, 0.874], B: [1, 1.000, 1.391], C: [1, 0.000, 0.283] }

     Every site that quotes a grade divides by that n without ever reading
     it, so the tab renders, today:

       "engine grade-A scalar only — replay 0% WR, 0.87R net on scalps"
       "replay: grade-A 0% WR (n=1) — selection edge real, mind the costs"
       "grade-A selection is real but scalp costs erased it"

     A 0% win rate beside a POSITIVE net R is not a surprising finding, it
     is one trade that lost less than its stop; printing it as a percentage
     invites a reader to compare it with the STRONG cell beside it, which
     carries 1,407. And "selection edge real" is asserted in the same
     sentence as the n=1 that refutes it — the ordering it refers to
     (A 54.3% > B 36.1% > C 34.8%, n=70 on A) is from a pre-v699 bake and
     survives only as prose, exactly like the cohort figures v814 removed.

     So: no percentage is printed from a record too thin to carry one, and
     whether the selection ordering holds is COMPUTED from the bake rather
     than asserted. The grade filter itself does not move — see the note at
     hgOgPickGoldEngineFor. Dropping a selection prior because this window
     settled three trades would be the same overfit in the other direction. */

  /* The record as a sentence, or an honest refusal to state a rate.
     opts.net includes the net R; opts.n appends the sample. */
  function hgOgClaimRecordTxt(c, opts){
    if (!c || c.missing) return null;
    var o = opts || {};
    var bits = [];
    if (c.thin){
      /* A RATE FROM ONE TRADE IS THAT TRADE. Say what settled instead. */
      if (!(c.n > 0)) return null;
      bits.push(hgOgFmtCount(c.n) + ' settled trade' + (c.n === 1 ? '' : 's')
                + ' (too few for a rate)');
      if (o.net && isFinite(c.net)){
        bits.push((c.net >= 0 ? '+' : '') + c.net.toFixed(2) + 'R on ' + (c.n === 1 ? 'it' : 'them'));
      }
      return bits.join(', ');
    }
    if (isFinite(c.winRate)) bits.push((c.winRate * 100).toFixed(0) + '% WR');
    if (o.net && isFinite(c.net)) bits.push((c.net >= 0 ? '+' : '') + c.net.toFixed(2) + 'R net');
    if (!bits.length) return null;
    if (o.n && c.n > 0) return bits.join(', ') + ' (n=' + hgOgFmtCount(c.n) + ')';
    return bits.join(', ');
  }

  /* Does the engine's selection ordering — A better than B better than C —
     actually hold in the bake, on records big enough to mean it?
     -> { judgeable, holds, why }. Never asserts; reads. */
  function hgOgGradeOrder(){
    var a = hgOgCohortClaim('A'), b = hgOgCohortClaim('B'), c = hgOgCohortClaim('C');
    var have = [a, b, c].filter(function(x){ return !x.missing && isFinite(x.winRate); });
    if (have.length < 3){
      return { judgeable: false, holds: false, why: 'the bake does not carry all three grades' };
    }
    var thin = [a, b, c].filter(function(x){ return x.thin; });
    if (thin.length){
      return { judgeable: false, holds: false,
               why: thin.length === 3
                 ? ('every grade settled under ' + MIN_SAMPLES + ' trades in this window')
                 : (thin.length + ' of the three grades settled under ' + MIN_SAMPLES + ' trades') };
    }
    var holds = (a.winRate > b.winRate && b.winRate > c.winRate);
    return { judgeable: true, holds: holds,
             why: 'A ' + (a.winRate * 100).toFixed(1) + '% · B ' + (b.winRate * 100).toFixed(1)
                  + '% · C ' + (c.winRate * 100).toFixed(1) + '%' };
  }

  /* The clause the spectrum header and the grade line both used to assert.
     One sentence, three shapes, decided by the bake. */
  function hgOgGradeOrderTxt(short){
    var o = hgOgGradeOrder();
    if (!o.judgeable){
      return short ? 'grade ordering not measurable here'
                   : ('the grade ordering is not measurable in this window (' + o.why + ')');
    }
    var verb = o.holds ? 'ordered outcomes' : 'did NOT order outcomes';
    return short ? ('grade selection ' + verb + ' here')
                 : ('grade selection ' + verb + ' in this window (' + o.why + ')');
  }

  /* The banner's cohort sentence, in full, derived. Three shapes, and
     which one renders is decided by the record. */
  function hgOgCohortStanceTxt(){
    var book = hgOgCohortBook();
    var b = book.best;
    if (!b) return 'No cohort carries a settled record in this window';
    var net = hgOgCohortNetTxt(b), nTxt = hgOgCohortNTxt(b);
    var label = 'the ' + b.key + ' cohort';
    var pf = hgOgCohortPfTxt(b);
    if (b.net <= 0){
      return 'No cohort finished net-positive; the closest was ' + label
        + ' (' + net + pf + (nTxt ? ', ' + nTxt : '') + ')';
    }
    if (b.thin){
      return 'One cohort finished net-positive — ' + label + ', ' + net + pf
        + ' — but ' + nTxt + ', so it is not evidence of an edge in either direction';
    }
    return book.positiveJudgeableN + ' cohort'
      + (book.positiveJudgeableN === 1 ? '' : 's') + ' finished net-positive; the best was '
      + label + ' (' + net + pf + (nTxt ? ', ' + nTxt : '') + ')';
  }

  /* ====================================================================
     TESTING EVERY MECHANIC, PRICED AT THE VENUE YOU ACTUALLY TRADE
     ====================================================================

     The replay measured 54 mechanics over 7,953 settled trades and every
     one of them is NET NEGATIVE — but that net is PAXG-priced at 0.26%
     round trip, and this desk executes on XM at ~0.020%, thirteen times
     cheaper. hgOgReplayLineHtml quoted the PAXG net on every setup card
     regardless of the selected venue, so each mechanic was labelled far
     worse than it is where the SEND TICKET TO XM button sends it.

     Re-pricing is arithmetic on numbers the record already carries:

       netAtVenue = avgGrossR - (avgGrossR - avgNetR) x (venueRtPct / replayRtPct)

     because avgGrossR - avgNetR IS the mean fee in R at the replay's own
     fee level (the bake defines costR as rMultiple - netR), and every
     trade's fee is linear in the round trip, so the mean of them scales
     with it. The gross outcome does not move — only what it costs to take
     it. Evaluated at the replay's own cost the whole thing collapses to
     avgNetR, which is the check the earlier version failed; see
     hgOgVenueNet for what it used to be and why it was wrong.

     At XM that turns 0 net-positive mechanics into 12. Which is the point
     where it would be very easy to fool ourselves, so nothing here stops
     at the sign of a number — see hgOgReplayEdgeVerdict. The earlier
     arithmetic said 18, and being six mechanics too generous about the
     venue this desk actually trades is precisely the direction that would
     not have been questioned. */
  /* ====================================================================
     THE RE-PRICING MUST REPRODUCE THE RECORD IT RE-PRICES

     Both copies of this arithmetic subtracted a MEDIAN cost from a MEAN
     gross:  avgGrossR - medianCostR x (venueRt / replayRt).

     Each half is defensible alone. Together they fail the one check that
     matters: evaluated at the replay's OWN cost, where the ratio is 1, the
     formula has to return the replay's OWN measured avgNetR. It did not,
     on 53 of the 54 baked kinds, by 0.407R per trade on average and by
     2.774R on PD-EQUILIBRIUM (measured -5.158, formula -2.384).

     The cost distribution is heavily right-skewed — costR is
     rt% / stop%, so a tight stop produces an enormous fee in R — and the
     median throws away exactly the trades where cost dominated, which is
     the population a cost gate exists for. SCAN:SCALP's mean fee is
     1.404R against a 0.635R median, 2.2x.

     The mean cost needs no re-bake: scripts/refit-confluence-weights.mjs
     defines costR as rMultiple - netR, so by linearity of the mean it is
     exactly avgGrossR - avgNetR, and both are already in the row. Scaling
     is exact for the mean too — every trade's costR is linear in the round
     trip, so the mean of them is — where the median only preserved order.

     The correction is not cosmetic and it is not flattering: at XM it takes
     the count of net-positive kinds from 18 to 12, and at PAXG it demotes
     more, not fewer. medianCostR stays in the row and keeps its own job as
     a typical-fee-load descriptor (HG_OG_SURVIVOR_MAX_MED_COST_R). */
  function hgOgVenueNet(gross, paxgNet, venueRt, replayRt){
    var g = fin(gross), nR = fin(paxgNet), vrt = fin(venueRt), rrt = fin(replayRt);
    if (!isFinite(g) || !isFinite(nR) || !(vrt >= 0) || !(rrt > 0)) return NaN;
    return g - (g - nR) * (vrt / rrt);
  }

  function hgOgReplayNetAtVenue(ev){
    if (!ev) return null;
    var gross = fin(ev.avgGrossR), cost = fin(ev.avgNetR);
    /* Engine grades and score tiers carry no gross, so they cannot be
       re-priced. Say nothing rather than quote a number as if it were. */
    if (!isFinite(gross) || !isFinite(cost)) return null;
    var vc = null;
    try { vc = hgOgVenueCost(); } catch (eV) { vc = null; }
    var venueRt = fin(vc && vc.rtCostPct);
    var replayRt = fin(HG_OG_REPLAY_EVIDENCE.rtCostPct);
    if (!(venueRt > 0) || !(replayRt > 0)) return null;
    return { net: hgOgVenueNet(gross, cost, venueRt, replayRt),
             venue: (vc && vc.venue) || '', venueRt: venueRt, replayRt: replayRt,
             repriced: Math.abs(venueRt - replayRt) > 1e-9 };
  }

  /* Inverse standard normal CDF (Acklam's rational approximation, |err| <
     1.15e-9). Needed because the family-wise bound below uses a z for an
     alpha that depends on how many mechanics were tested, so it cannot be
     a hardcoded 1.96. */
  function hgOgInvNorm(p){
    if (!(p > 0 && p < 1)) return NaN;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
              1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
              6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var dd = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
              3.754408661907416e+00];
    var pl = 0.02425, q, r;
    if (p < pl){
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((dd[0]*q+dd[1])*q+dd[2])*q+dd[3])*q+1);
    }
    if (p > 1 - pl){
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
              ((((dd[0]*q+dd[1])*q+dd[2])*q+dd[3])*q+1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }

  /* How many mechanics the replay tested — the size of the family a "best"
     mechanic was selected from. Counted, not hardcoded, so adding kinds
     tightens the bar automatically. */
  function hgOgReplayFamilySize(){
    try {
      /* DISTINCT MECHANICS, not distinct labels. A correction for having
         tested N things must count the things actually tested: SPRING and
         UTAD are one detector under two direction labels, so counting both
         inflates the family and tightens the bar for a search nobody
         performed. Folded through OG_KIND_ALIAS, the same map the ledger
         accessor uses, so the count and the records can never disagree. */
      var seen = {}, k, n = 0;
      for (k in (HG_OG_REPLAY_EVIDENCE.kinds || {})){
        if (!Object.prototype.hasOwnProperty.call(HG_OG_REPLAY_EVIDENCE.kinds, k)) continue;
        var canon = Object.prototype.hasOwnProperty.call(OG_KIND_ALIAS, k) ? OG_KIND_ALIAS[k] : k;
        if (!seen[canon]){ seen[canon] = 1; n++; }
      }
      return n || 1;
    }
    catch (eF) { return 1; }
  }

  /* DOES THIS MECHANIC'S EDGE SURVIVE HAVING TESTED 54 OF THEM?

     Two traps sit between "positive net R" and "worth trading", and this
     answers both on the mechanic's OWN numbers.

     1. Sampling noise. A 33% win rate over 48 trades is not a 33% win
        rate. Compare the Wilson LOWER bound against the win rate the
        mechanic needs just to break even at its own payoff:
        breakeven = 1/(1+R), where R is implied by gross avgR.

     2. Selection. Ranking 54 mechanics and trading the top one is the
        multiple-comparisons trap: at a naive 95% bound you expect ~2.7 of
        54 to clear by chance with no edge at all. The family-wise bound
        raises z for alpha/m so "best of 54" has to mean something.

     Measured on the shipped table: 18 of 54 are net-positive at XM, ONE
     clears its own breakeven at the naive bound — fewer than the ~2.7
     chance alone would produce — and NONE clears family-wise. */
  function hgOgReplayEdgeVerdict(ev){
    if (!ev) return null;
    var n = fin(ev.n), wr = fin(ev.winRate), gross = fin(ev.avgGrossR);
    if (!(n > 0) || !isFinite(wr) || !isFinite(gross)) return null;
    /* gross = wr*R - (1-wr)  =>  R = (gross + 1 - wr)/wr */
    if (!(wr > 0)) return null;
    var R = (gross + 1 - wr) / wr;
    if (!(R > 0)) return null;
    var be = 1 / (1 + R);
    var wins = Math.round(wr * n);
    /* ONE FAMILY CORRECTION, NOT A THIRD ONE. Every other site asking
       "did this beat breakeven, allowing for how many were tried" calls
       hgOgFamilyZ(OG_MECHANICS.length) — Sidak, one-sided, over the 77
       mechanics the desk scans. This alone rolled its own: Bonferroni,
       TWO-sided, over the 54 that carry a replay row. Two axes of
       disagreement about one question, so the bar the panel displays
       (+3.21σ) was not the bar promotion applied (+3.31σ) — the same shape
       as hg-v815, one function further in.

       ONE-SIDED IS THE CORRECT HALF: this compares a Wilson LOWER bound
       against breakeven, which is a directional claim, and a two-sided
       bar spends half its alpha on a tail nothing here acts on.
       SEVENTY-SEVEN IS THE CONSERVATIVE FAMILY: the 23 mechanics without a
       replay row were scanned, not skipped, and a larger family is the
       stricter choice on the axis that is genuinely arguable.

       Net the bar moves 3.312 -> 3.209, and being explicit about that
       matters more than the size of it: nothing reaches either, the tier
       assignments are unchanged, and hgOgReplayFamilySize stays as what it
       honestly is — how many mechanics carry a record — rather than
       doubling as a promotion family. */
    var m = OG_MECHANICS.length;
    var zFw = hgOgFamilyZ(m);
    /* THE REPLAY POPULATION OVERLAPS, so its row count is not its sample.
       This verdict is what promotes a mechanic to PROVEN EDGE, and it was
       reading n rows as n independent trades while the walk that produced
       them held 55 positions at once. Deflated to the measured effective
       sample — see hgOgEffN. The other two hgOgWilsonHit callers are left
       alone deliberately: the scorecard is the user's own settled
       positions, taken one at a time, and the forward log publishes only
       aggregates, so there is no timing in hand to measure ITS overlap
       with. Importing this ratio there would be borrowing a constant from
       a different population, which is the error this fixes. */
    var lo95 = hgOgWilsonHit(wins, n, OG_EXEC_WILSON_Z, { overlapping: true });
    var loFw = isFinite(zFw) ? hgOgWilsonHit(wins, n, zFw, { overlapping: true }) : null;
    if (!lo95) return null;
    var tier = (loFw && loFw.lo > be) ? 'family'
             : (lo95.lo > be) ? 'naive'
             : 'none';
    return { breakeven: be, impliedR: R, lo95: lo95.lo,
             loFw: loFw ? loFw.lo : NaN, family: m, zFw: zFw, tier: tier,
             expectedByChance: m * 0.05 };
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
  /* THE BADGE STOPPED CLAIMING A RANKING IT DOES NOT HAVE.

     The comment above already said the ordering is upside down. The PIXELS
     said otherwise: green for STRONG, red for WEAK, a tick, a cross and a
     trophy. A reader takes the colour before the suffix, so the badge was
     asserting exactly what its own footnote denied.

     Measured on the desk's settled walk (7,670 plans, ambiguous same-bar
     wins dropped) the score does not rank OUTCOMES — it ranks STOP WIDTH,
     inversely:

       conf band   median stop   below the 0.50% floor   GROSS
         40s          1.098%              14%            +0.095R
         70s          0.775%              31%            +0.037R
         50s          0.539%              47%            -0.181R
         60s          0.274%              74%            -0.241R

     The worst band is the one whose stops are tightest. Control for that —
     apply GOLD_STOP_MIN_PCT — and no band separates at all: t runs -1.57
     to +2.30 across five bands, none clearing the family-wise bar.

     So the number stays on the card, because it describes the setup and a
     reader may want it. What goes is the verdict dressing: one neutral
     colour for every band, no tick, no cross, no trophy, and a suffix that
     says what the record actually is. The engine-grade path below keeps
     its own labels — that is a different scalar with its own measured
     record, and it is not what this measurement is about. */
  var OG_TIER_NEUTRAL = '#64748B';

  function hgOgTierBadgeInfo(score, setup, fromGrade){
    var s = isFinite(fin(score)) ? fin(score) : 0;
    var color = OG_TIER_NEUTRAL;
    var label = s >= 85 ? 'EXCEPTIONAL' : s >= 70 ? 'STRONG' : s >= 50 ? 'FAIR' : 'WEAK';
    var suffix = '';
    if (fromGrade){
      if (s >= 85) label = 'GRADE-A CLASS';
      var g = String((setup && (setup.engineGrade
        || ((typeof setup.grade === 'string') ? setup.grade : ''))) || (s >= 85 ? 'A' : '')).toUpperCase();
      var demoted = !!(setup && (setup.engineDemoted || setup.demoted));
      var gkey = g ? (g + (demoted ? '-DEMOTED' : '')) : '';
      var gclaim = gkey ? hgOgCohortClaim(gkey) : null;
      var grec = hgOgClaimRecordTxt(gclaim, { net: true });
      if (grec){
        /* 'on scalps' is a per-grade measured fact, not a template: the
           grade rows pool horizons, and in the replay only A / A-DEMOTED /
           B-DEMOTED / C-DEMOTED settled 100% on scalp geometry. B settled
           30 scalp + 6 swing and C settled 2 scalp + 21 swing (trades[] in
           scripts/backtest-omnigold-results.json, keyed by the engine
           scalar: A=85, A-dem=75, B=70, B-dem=60, C=45, C-dem=35) — so the
           horizon claim prints only where it is true of every trade. */
        /* AND THE HORIZON CLAIM RESTS ON THAT SAME TRADE COUNT. The list
           above was derived from a distribution ('B settled 30 scalp + 6
           swing') that this bake no longer has — every grade settles ONE
           trade in it. A per-horizon claim off one trade says nothing, so
           it prints only where the record can carry it. */
        var gAllScalp = (gkey === 'A' || gkey === 'A-DEMOTED'
          || gkey === 'B-DEMOTED' || gkey === 'C-DEMOTED');
        suffix = 'replay ' + grec + ((gAllScalp && !gclaim.thin) ? ' on scalps' : '');
      }
    } else if (s >= 85){
      /* Practically unreachable: no scan trade in the 7,270-trade replay
         scored 85 and the arithmetic cannot get there. Stated, not hidden. */
      suffix = 'unreached in replay — scan arithmetic tops out near 82';
    } else {
      var tev = hgOgReplayEvidence(s >= 70 ? 'STRONG' : s >= 50 ? 'FAIR' : 'WEAK');
      if (tev && isFinite(fin(tev.winRate))){
        /* the record, and then what the record means — a band with no
           measured ranking must not read like a grade */
        suffix = 'replay ' + (tev.winRate * 100).toFixed(0) + '% WR · '
               + 'this score does not rank outcomes (it tracks stop width)';
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
    /* THE COST ARITHMETIC IS LIVE AND STAYS. What follows it is a claim
       about a measured cohort, and ENGINE:SCALP has no row in this bake —
       so the old literal fallback printed 'lost 2.60R/trade net' on every
       single render. Quote whichever scalp cohort actually has a record,
       named exactly, or say nothing after the cost fact. */
    var coh = hgOgCohortClaim('ENGINE:SCALP');
    var label = 'ENGINE scalp';
    if (coh.missing){ coh = hgOgCohortClaim('SCAN:SCALP'); label = 'scalp scan'; }
    var net = hgOgCohortNetTxt(coh), nTxt = hgOgCohortNTxt(coh);
    var txt = 'COSTS FIRST: ' + d.rtCostPct.toFixed(2) + '% round trip is '
      + d.costR.toFixed(2) + 'R of this stop';
    if (net){
      txt += ' — the replay\'s ' + label + ' cohort ran ' + net
        + (nTxt ? ' ' + nTxt : '');
    } else {
      txt += ' — no settled scalp cohort in this replay window to price it against';
    }
    return '<div class="note warn og-costs-first" style="margin:8px 0;padding:6px 8px;'
      + 'border:1px solid #f59e0b;border-left:3px solid #dc2626;border-radius:4px;'
      + 'background:rgba(245,158,11,0.08);font-weight:bold;font-size:0.85em">'
      + esc(txt) + '</div>'
      /* replay-vs-venue honesty (hg-v533): the cohort loss above is a
         PAXG-cost fact; a cheaper venue re-prices the fee, not the record. */
      + hgOgVenueCostNoteHtml()
      /* hg-v925: FIRST of all when the edge requirement is off — it reframes
         what a ticket on this page means, so it cannot sit below the tables. */
      /* hg-v927: the age of everything below, before anything below */
      + hgOgBreakevenPanelHtml()
      + hgOgWalkAgeHtml()
      + hgOgEdgeRelaxedPanelHtml()
      /* hg-v926: and, while something is held, why nothing new is ticketing */
      + hgOgOneAtATimeHtml()
      /* hg-v934: then what that relaxation freed in the general case — the
         mechanics with no record at all, and the bar they charge the ones
         that have one. BELOW the hold, deliberately: hg-v926 put the hold
         directly under the relaxation notice because it answers the live
         question a reader has RIGHT NOW (why is nothing new ticketing),
         and this is standing disclosure. The urgent answer keeps the
         adjacency it was given. */
      + hgOgUnobservedPanelHtml()
      /* hg-v935: and the refusal that follows from the same arithmetic —
         selecting mechanics by their record does not survive out of sample */
      + hgOgSelectionRefusedHtml()
      /* if the ledger has moved on since the evidence was baked, that comes
         next — every number under it is about a different system */
      + hgOgEvidenceStaleHtml()
      /* and its sibling: the ledger check watches the CODE moving under the
         evidence; this watches the evidence moving under the code */
      + hgOgEvidenceHealthHtml()
      /* then why there are no tickets to read at all, before the numbers a
         reader would otherwise scan looking for one */
      + hgOgEdgeProofPanelHtml()
      /* then what the forward log says about the desk's OWN judgement —
         its ranking, its direction, its grades, its gate stack. Below the
         edge panel because that one explains why the ticket column is
         empty; this one is about whether the ordering of what remains is
         worth anything. */
      + hgOgFwdSplitsPanelHtml()
      /* and what the book it belongs to actually did to an account */
      + hgOgBookExperienceHtml()
      /* hg-v918: LAST, because it reframes every table above it. Everything
         higher counts all 59.4 plans a day this walk forms; these rows count
         the one a person could hold, at both ends of the fill interval. The
         sequential book has been in the committed evidence since the v12 bake
         and nothing has ever rendered it. */
      + hgOgSequentialCellsHtml()
      /* hg-v919: and what the cost ceiling asks at the venue in force —
         silent everywhere else on the default one. */
      + hgOgCostCeilingPanelHtml()
      /* hg-v924: and, when this scan's own ledger says the ceiling is the top
         hard blocker and nothing ticketed, that the empty board is the venue
         rather than the tape. Silent otherwise. */
      + hgOgBlockerFunnelHtml()
      /* hg-v922: after the ceiling, because it is the same question asked of
         the outcomes rather than of the arithmetic — and it answers it with
         two verdicts out of ten rather than a rule. */
      + hgOgFactorSepPanelHtml();
  }

  /* The legend's honest header — above the four tier cells, in warn style,
     because the tier table below it did NOT rank outcomes and saying so in
     a footnote while the cells said 'Trade immediately' is how a reader
     took real losses on 'EXCEPTIONAL' labels. */
  function hgOgSpectrumTruthHeaderHtml(){
    var E = HG_OG_REPLAY_EVIDENCE;
    /* THE COUNT A CLAIM RESTS ON, NOT THE DESK-WIDE ONE. E.settled is every
       settled trade (8,155); the tier rows this sentence is about carry
       8,152 of them, because three settled without a confluence score. */
    var tierN = hgOgGroupSettled('tiers');
    var txt = 'measured reality: these tiers did NOT rank outcomes across the '
      + hgOgFmtCount(isFinite(tierN) ? tierN : E.settled)
      + ' scored trades in the replay (WEAK outperformed STRONG); '
      /* WAS: 'grade-A selection is real but scalp costs erased it.' — an
         assertion about an ordering the bake no longer carries. Read it. */
      + hgOgGradeOrderTxt() + '. '
      + 'The tiers are a checklist, not a ranking.';
    return '<div class="warn og-spectrum-truth" style="margin-bottom:8px;padding:6px 8px;'
      + 'border-left:3px solid #f59e0b;background:rgba(245,158,11,0.08);'
      + 'font-size:0.85em;font-weight:bold">' + esc(txt) + '</div>';
  }

  /* The four legend cells, captioned with the measured record instead of an
     instruction ('Trade immediately' told a reader to click; 34% > 30% is
     what actually happened). Numbers come from the baked tables only. */
  function hgOgSpectrumLegendCellsHtml(){
    /* THE FOUR CELLS SIT SIDE BY SIDE, so they must be comparable. STRONG
       carries 1,407 settled trades and grade A carries one; printing both
       as a bare percentage invited exactly the comparison the numbers
       cannot support. */
    var wrTxt = function(key){
      var rec = hgOgClaimRecordTxt(hgOgCohortClaim(key), {});
      return rec ? ('replay ' + rec) : 'no replay record';
    };
    var A = hgOgCohortClaim('A');
    var aRec = hgOgClaimRecordTxt(A, { net: true });
    /* hg-v920: AND THE SCAN PATH CANNOT REACH THIS CELL AT ALL.
       'engine grade-A scalar only' was true and too quiet: a reader watching
       scan cards waits for a tier the scan arithmetic cannot award. Measured
       on the replay, the scan score tops out at 78 and ZERO of 9,897 rows
       reached 85. Say the number, so waiting for it is a choice rather than
       a misunderstanding. */
    var capA = (aRec
      ? ('engine grade-A scalar only — replay ' + aRec + (A.thin ? '' : ' on scalps'))
      : 'engine grade-A scalar only')
      + ' · SCAN CARDS NEVER REACH THIS: scan scoring tops out near 78 and 0 of 9,897 replay rows scored 85';
    /* THE TIER LABELS WERE DARK-THEME COLOURS ON A WHITE CARD.

       Each cell tints its own background at ~6.7% alpha, which over
       --panel #ffffff is still white for contrast purposes — so the label
       sat on white. Measured against it: emerald #10b981 2.54:1, green
       #22c55e 2.28:1, amber #f59e0b 2.15:1. WCAG AA wants 4.5:1, and 3:1
       even for large bold text. Only the red cell passed, at 4.83:1.

       This is the legend a reader uses to interpret the badge on every
       card, so it is the last thing that should be hard to read. The app's
       own light-theme tokens are AA by construction (--pass 5.02:1,
       --veto 5.18:1, --short 4.83:1); the top tier takes the darker green
       that already appears in this file at 9.11:1 so GRADE-A CLASS and
       STRONG stay distinguishable without either dropping below the bar.
       The tint and the left border keep the colour coding intact. */
    var h = '';
    h += '<div style="padding:6px;border-left:3px solid #14532d;background:#14532d11"><span style="color:#14532d;font-weight:bold">🏆 ≥85</span><br>GRADE-A CLASS<br><span style="color:var(--mut);font-size:0.8em">' + esc(capA) + '</span></div>';
    h += '<div style="padding:6px;border-left:3px solid var(--pass);background:#15803d11"><span style="color:var(--pass);font-weight:bold">✓ 70-84</span><br>STRONG<br><span style="color:var(--mut);font-size:0.8em">' + esc(wrTxt('STRONG')) + '</span></div>';
    h += '<div style="padding:6px;border-left:3px solid var(--veto);background:#c2410c11"><span style="color:var(--veto);font-weight:bold">⚠️ 50-69</span><br>FAIR<br><span style="color:var(--mut);font-size:0.8em">' + esc(wrTxt('FAIR')) + '</span></div>';
    h += '<div style="padding:6px;border-left:3px solid var(--short);background:#dc262611"><span style="color:var(--short);font-weight:bold">✗ &lt;50</span><br>WEAK<br><span style="color:var(--mut);font-size:0.8em">' + esc(wrTxt('WEAK')) + '</span></div>';
    return h;
  }

  /* DESK-STANCE BANNER (hg-v532). Permanent, at the top of the tab beside
     the scan controls — the replay's verdict before any card decorates
     anything. Every figure is baked from the two replay files; the median
     fee figures are the measured ones (see the medianCostR bake note).
     An earlier draft called ENGINE:SWING 'the only cohort that survived
     costs' and its makeup 'grade-A/B' — neither traced, and the correction
     written here then became stale in its turn: it argued against the
     claim using the pre-v699 numbers (PF 0.90, avgNetR -0.056, n=27), all
     three of which the current bake has moved or dropped. The cohort
     sentence is derived from the live record now (hgOgCohortStanceTxt), so
     neither the claim nor the rebuttal is written down as prose. What
     survives from that audit is the part that is not a number: a cohort's
     MAKEUP is not its grade label, and n=3 is not a finding. */
  function hgOgDeskStanceBannerHtml(){
    var E = HG_OG_REPLAY_EVIDENCE;
    var med = E.medianCostR || {};
    /* THE CLAUSE THAT SIGNED OFF 'Every number here is measured' WAS THE
       ONE THAT WAS NOT. It hardcoded 'No cohort finished net-positive',
       then printed the best cohort's +0.85R from the record and called it
       'still a net loss' in the same breath, with a PF of 0.90 the
       evidence object sets to null. The sentence is derived now — see
       hgOgCohortStanceTxt — so the verdict cannot disagree with the
       numbers under it, in either direction. */
    var txt = 'REPLAY VERDICT (' + hgOgFmtCount(E.settled) + ' settled PAXG trades): '
      + 'scalp-geometry setups lost net of costs across every tier — the median trade paid '
      + fin(med.all).toFixed(2) + 'R in fees (' + fin(med.scalp).toFixed(2) + 'R on scalp geometry). '
      + hgOgCohortStanceTxt() + '. '
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
/* hg-v919 — THE CEILING IS A STOP WIDTH, AND IT DEPENDS ENTIRELY ON VENUE.

     costR = rtCostPct / stopPct exactly — hgOgCostDrag computes it that way
     and so does the cost gate. Invert it and the two ceilings stop being
     abstract fractions of 1R and become a minimum stop the geometry must
     reach:

       lane    ceiling      at XM (0.020% RT)       at PAXG (0.26% RT)
       SCALP     0.15R    >= 0.133%  ($6 / $4500)   >= 1.733%  ($78 / $4500)
       SWING     0.30R    >= 0.067%  ($3 / $4500)   >= 0.867%  ($39 / $4500)

     The rule is venue-neutral in R, which is correct and is the point of
     expressing it in R. What it is NOT is venue-neutral in what it demands
     of a chart: at PAXG a gold scalp needs a $78 stop, and the same rule
     asks $6 at XM. On the replay that gap is the whole desk — the ceiling
     alone vetoes 96.1% of scalp rows and 47.4% of swing rows at PAXG,
     against 16.4% and 0.1% at XM (stable at both fill bounds: 95.9% /
     44.4%). PAXG is the fail-closed default, so a reader who has never
     touched the venue selector is running the strict one and reading an
     empty scan as a quiet market.

     Returns null when the venue or lane cannot be resolved — absent stays
     absent, and no minimum is invented for a venue this desk does not price. */
  function hgOgCostCeilingDemand(opts){
    try{
      opts = opts || {};
      var vc = (opts.venueCost && isFinite(fin(opts.venueCost.rtCostPct)))
        ? opts.venueCost : hgOgVenueCost();
      var rt = fin(vc && vc.rtCostPct);
      if (!(isFinite(rt) && rt > 0)) return null;
      var scalp = opts.scalp === true;
      var ceil = scalp ? COST_VETO_R_SCALP : COST_VETO_R;
      if (!(isFinite(ceil) && ceil > 0)) return null;
      var minPct = rt / ceil;
      if (!isFinite(minPct)) return null;
      /* dollars are a READING AID and need a price. No price, no dollars —
         never a default spot silently standing in for the live one. */
      var px = fin(opts.px);
      var minUsd = (isFinite(px) && px > 0) ? px * minPct / 100 : null;
      return { venue: String((vc && vc.venue) || ''), rtCostPct: rt,
               lane: scalp ? 'SCALP' : 'SWING', ceilingR: ceil,
               minStopPct: minPct, minStopUsd: minUsd, px: (isFinite(px) && px > 0) ? px : null };
    }catch(e){ return null; }
  }

  /* One line: what this venue's ceiling asks of the chart. '' when unknown. */
  function hgOgCostCeilingNote(opts){
    var d = hgOgCostCeilingDemand(opts);
    if (!d) return '';
    var s = d.lane + ' cost ceiling ' + d.ceilingR.toFixed(2) + 'R at ' + (d.venue || 'this venue')
      + ' (' + d.rtCostPct.toFixed(3) + '% round trip) means a stop of at least '
      + d.minStopPct.toFixed(3) + '% of entry';
    if (d.minStopUsd !== null) s += ' — $' + d.minStopUsd.toFixed(2) + ' at $' + d.px.toFixed(0) + ' gold';
    return s;
  }

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
  /* ====================================================================
     WHAT HOLDING THIS BOOK WOULD HAVE FELT LIKE
     ====================================================================

     Everything else this desk prints is a per-trade statistic: win rate,
     R multiple, Wilson bound, breakeven, family-wise correction. Not one
     of them tells a reader what the EQUITY did, and on this book that is
     the whole story.

     Sequential ticket book — one position at a time, ticket-only, which is
     the only book a person can actually run — over 2026-03-29..2026-09-12,
     priced at XM:

         final +3.2R     peak +4.2R     MAX DRAWDOWN 18.3R
         longest losing streak 7        the hole ran 01 Apr -> 21 May

     At 1% risk a trade that is an 18% account drawdown, held for seven
     weeks, to finish +3%. A flat expectancy is not harmless — that shape
     is exactly what people abandon at the bottom, and a card that reports
     only the win rate helps them do it.

     Numbers from scripts/omnigold-evidence-bake.mjs (bake.experience),
     which computes them on the SEQUENTIAL book because a drawdown only
     means anything walked in the order the trades were taken. Running it
     on the overlapping firehose would draw a curve nobody ever rode. */
  var HG_OG_BOOK_EXPERIENCE = {
    window: '2026-03-29..2026-09-12',
    src: 'scripts/omnigold-evidence-bake.mjs',
    /* THE GATE SET MATTERS, and getting it wrong here shipped a wrong
       number for a day. hg-v754 quoted the raw ticket book from a walk
       generated 2026-09-12 — before GOLD_STOP_MIN_PCT and the hard
       venue-priced cost gate landed on 2026-09-16. Those numbers described
       a system this tab no longer runs, and they overstated the drawdown
       2.2x at XM (18.3R against 8.2R) and 8.5x at PAXG (83R against 9.8R).

       The rows below are the ticket book with the CURRENT gates applied to
       that walk. It is a PROXY, and `proxy` says so: a genuine re-walk
       would change which setups formed at all, not merely which of them
       survived the ledger. Re-run scripts/backtest-omnigold.mjs and this
       bake to replace it with the real thing. */
    gateSet: 'hg-v752 (stop floor + hard venue cost)',
    proxy: true,
    /* [finalR, peakR, maxDrawdownR, longestLosingStreak, n, from, to] */
    ticketsXm:   [  1.66,  9.34,   8.21, 6,  58, '2026-04-01', '2026-05-21'],
    ticketsPaxg: [ -6.09,  1.90,   9.81, 7,  34, '2026-04-01', '2026-05-15'],
    /* every plan formed, one at a time — pre-gate, kept for contrast */
    allXm:       [-69.30,  0.00,  73.40, 16, 275, '2026-03-27', '2026-09-03']
  };

  /* HOW OFTEN DOES THIS KIND OF ENTRY EVEN HAPPEN?

     A resting order is not a trade until price comes to it, and the rate
     at which that happens is not uniform. Measured over the walk's 9,435
     published plans:

         BUY        100.0%      SELL        100.0%   (at the market)
         BUY_LIMIT   79.2%      SELL_LIMIT   75.3%
         BUY_STOP    43.7%      SELL_STOP    52.5%

     MORE THAN HALF OF BREAKOUT ENTRIES NEVER TRIGGER, and nothing in this
     app said so. A mechanic whose record looks respectable on the trades
     that filled is a different proposition when half of them never became
     trades — the record is conditioned on filling, and the card was
     quoting it as if it were unconditional.

     Unfilled is NOT a loss and is excluded from every hit rate this desk
     prints, here and in the replay. It is reported as its own fact,
     because "this idea never happened" is a different outcome from "this
     idea lost". Numbers from scripts/omnigold-evidence-bake.mjs (bake.fills). */
  var HG_OG_FILL_RATES = {
    'BUY': 1.0, 'SELL': 1.0,
    'BUY_LIMIT': 0.792, 'SELL_LIMIT': 0.753,
    'BUY_STOP': 0.437, 'SELL_STOP': 0.525
  };

  /* The order type a plan implies, priced against the live mark — the same
     xmOrderType rule the bot and the backtest use, so the card, the walk
     and the ticket cannot disagree about what kind of order this is. */
  function hgOgFillRate(dir, entry, mark){
    var e = fin(entry), m = fin(mark);
    var long = String(dir || '').toLowerCase() !== 'short';
    if (!(e > 0) || !(m > 0)) return null;
    var rel = Math.abs(e - m) / m;
    var name;
    if (rel <= 0.0003) name = long ? 'BUY' : 'SELL';
    else if (long) name = (e < m) ? 'BUY_LIMIT' : 'BUY_STOP';
    else name = (e > m) ? 'SELL_LIMIT' : 'SELL_STOP';
    var rate = HG_OG_FILL_RATES[name];
    return (typeof rate === 'number') ? { orderType: name, fillRate: rate } : null;
  }

  function hgOgFillRateNoteHtml(dir, entry, mark){
    try {
      var f = hgOgFillRate(dir, entry, mark);
      if (!f) return '';
      /* silent at the market: "100% of market orders fill" is not news */
      if (f.fillRate >= 0.999) return '';
      var pct = (f.fillRate * 100).toFixed(0);
      var warn = f.fillRate < 0.6;
      return '<div class="dim og-fill-rate" style="font-size:10px;margin-top:1px'
        + (warn ? ';color:#b45309;font-weight:600' : '') + '">'
        + esc(f.orderType.replace('_', ' ') + ' — on the record this kind of entry triggers '
          + pct + '% of the time'
          + (warn ? '; more often than not it never becomes a trade at all' : ''))
        + '</div>';
    } catch (e) { return ''; }
  }

  /* ==================== IS THE EVIDENCE STILL ABOUT THIS CODE? ==========

     Every baked number in this file — the 54-mechanic replay table, the
     fill rates, OG_EFF_N_RATIO, the lane cool-downs, the drawdown panel —
     came from one walk, and nothing recorded which GATE SET produced it.
     hg-v754 shipped a drawdown computed before the v752 gates existed: it
     overstated the hole 2.2x at XM and 8.5x at PAXG, and no test, reader or
     assertion could have caught it. The number was simply about a different
     system than the one running.

     The ledger's key list is the signature. It changes exactly when a gate
     is added or removed, which is exactly when `ticket` starts meaning
     something else. The live list costs nothing to obtain — hgOgGates runs
     on every scan — so it is captured there and compared here.

     A signature, not a proof: retuning a THRESHOLD inside an existing gate
     changes what a ticket is without changing a key, and this will not see
     that. It catches the change that actually happened. */
  var HG_OG_EVIDENCE_GATESET = {
    bakedFrom: '2026-09-12 walk',
    count: 35,
    keys: ['adr-budget','adx-trend','atr-percentile','consensus','context-gates','cost-drag',
           'dxy-inverse','ema-stack','fade-strength','fill-path','fill-risk','gold-season',
           'htf-daily','inst-filter','level-fresh','macro-realrate','measured-edge',
           'momentum-stop','news-window','participation','plan-levels',
           'premium-discount','rsi-zone','session','session-vwap','shield-guard','spot-basis',
           'stop-floor','stop-width','trend','vol-alive','vol-forecast','weekend-exposure',
           'yield-guard','zone-anchor']
  };

  /* Returns null when there is nothing to say — no live ledger seen yet, or
     it matches. A missing observation is not a mismatch. */
  function hgOgEvidenceStale(liveKeys){
    try {
      if (!liveKeys || !liveKeys.length) return null;
      var baked = HG_OG_EVIDENCE_GATESET.keys;
      var live = liveKeys.slice().sort();
      var added = [], removed = [], i;
      for (i = 0; i < live.length; i++) if (baked.indexOf(live[i]) < 0) added.push(live[i]);
      for (i = 0; i < baked.length; i++) if (live.indexOf(baked[i]) < 0) removed.push(baked[i]);
      if (!added.length && !removed.length) return null;
      return { added: added, removed: removed, bakedFrom: HG_OG_EVIDENCE_GATESET.bakedFrom };
    } catch (e) { return null; }
  }

  /* ====================================================================
     THE EVIDENCE'S OWN CONDITION

     hg-v814 and hg-v815 both fixed the same shape of bug: a sentence that
     quoted a baked number after the bake underneath it had thinned or
     vanished. ENGINE:SCALP went from a cohort to nothing. ENGINE:SWING
     fell from 27 settled trades to 3. Every engine grade fell from tens to
     ONE. Each was found by hand, months after the fact, by reading the
     rendered text and not believing it.

     Nothing on this tab could have said so. hgOgEvidenceStale — the only
     detector there was — compares the baked GATE LEDGER against the live
     one. That catches the code moving under the evidence. It is blind to
     the evidence moving under the code, which is what actually happened
     three times.

     So this reads the shipped bake's own condition and reports what it can
     still support. No baseline, deliberately: a fingerprint of the
     evidence's shape would be baked WITH the evidence and would move with
     it, which is how you get a staleness check that is never stale. The
     honest question is not "has this changed" but "can this carry the
     claims the tab makes on it", and MIN_SAMPLES already answers it
     everywhere else here.

     THE FOUR GROUPS COVER DIFFERENT POPULATIONS and their totals are
     SUPPOSED to differ — which is itself worth printing, because the tab
     quotes one settled count ('the 8,155-trade replay') beside claims that
     rest on another. From scripts/refit-confluence-weights.mjs:
       kinds    settled trades whose mechanic cleared the bake's 40-trade
                floor — smaller kinds are dropped whole (7,953 today)
       grades   settled ENGINE-source trades only (3 today: the entire
                engine book for this window)
       cohorts  every settled trade (8,155 — this is E.settled)
       tiers    settled trades carrying a confluence score (8,152) */
  var OG_EVIDENCE_GROUPS = [
    { key: 'kinds',   label: 'mechanic',
      covers: 'settled trades whose mechanic cleared the bake\'s 40-trade floor',
      feeds:  'the per-mechanic replay lines and the measured-edge bar' },
    { key: 'grades',  label: 'engine grade',
      covers: 'settled ENGINE-source trades only',
      feeds:  'the grade legend and the grade line on engine cards' },
    { key: 'cohorts', label: 'cohort',
      covers: 'every settled trade',
      feeds:  'the replay verdict banner' },
    { key: 'tiers',   label: 'confluence tier',
      covers: 'settled trades carrying a confluence score',
      feeds:  'the confluence spectrum cells' }
  ];

  /* -> { groups: [...], blind: [...], declaredSettled }. A group is BLIND
     when it has rows but not one of them reaches MIN_SAMPLES: the tab can
     still name those rows, and can state nothing about their rates. */
  function hgOgEvidenceHealth(){
    var E = HG_OG_REPLAY_EVIDENCE, out = [], i, j;
    for (i = 0; i < OG_EVIDENCE_GROUPS.length; i++){
      var g = OG_EVIDENCE_GROUPS[i];
      var map = (E && E[g.key]) || {};
      var keys = Object.keys(map);
      var judgeable = 0, thin = 0, settled = 0, thinKeys = [];
      for (j = 0; j < keys.length; j++){
        var row = map[keys[j]];
        var n = fin(row && row[0]);
        if (!isFinite(n)) continue;
        settled += n;
        if (n >= MIN_SAMPLES) judgeable++;
        else { thin++; thinKeys.push(keys[j] + ' (n=' + hgOgFmtCount(n) + ')'); }
      }
      out.push({ key: g.key, label: g.label, covers: g.covers, feeds: g.feeds,
                 keys: keys.length, judgeable: judgeable, thin: thin,
                 settled: settled, thinKeys: thinKeys,
                 blind: keys.length > 0 && judgeable === 0 });
    }
    return {
      groups: out,
      blind: out.filter(function(x){ return x.blind; }),
      anyThin: out.some(function(x){ return x.thin > 0; }),
      declaredSettled: fin(E && E.settled),
      minSamples: MIN_SAMPLES
    };
  }

  /* The settled count a claim about ONE group rests on, rather than the
     desk-wide total. Quoting 8,155 beside a statement about the tier table
     overstates the tier table by three trades — small here, and the same
     habit that let a cohort figure outlive its cohort. */
  function hgOgGroupSettled(key){
    var h = hgOgEvidenceHealth(), i;
    for (i = 0; i < h.groups.length; i++) if (h.groups[i].key === key) return h.groups[i].settled;
    return NaN;
  }

  /* Renders only when the evidence cannot carry something the tab quotes on
     it. Silent on a healthy bake, on purpose: a warning on every render is
     a warning on none. */
  function hgOgEvidenceHealthHtml(){
    try {
      var h = hgOgEvidenceHealth();
      if (!h.blind.length && !h.anyThin) return '';
      var lines = [], i;
      for (i = 0; i < h.groups.length; i++){
        var g = h.groups[i];
        if (!g.thin) continue;
        lines.push('<div style="margin-top:3px">'
          + '<b>' + esc(g.label) + '</b> — '
          + (g.blind
              ? ('not one of its ' + g.keys + ' rows reaches ' + h.minSamples
                 + ' settled trades (' + hgOgFmtCount(g.settled) + ' in total), so '
                 + esc(g.feeds) + ' report samples instead of rates')
              : (g.judgeable + ' of ' + g.keys + ' rows can carry a rate; '
                 + esc(g.thinKeys.join(', ')) + ' cannot'))
          + '</div>');
      }
      if (!lines.length) return '';
      return '<div class="note warn og-evidence-health" data-og-evidence-health="1" '
        + 'style="margin:8px 0;padding:6px 8px;border:1px solid #f59e0b;'
        + 'border-left:3px solid #f59e0b;border-radius:4px;'
        + 'background:rgba(245,158,11,0.08);font-size:0.85em">'
        + '<b>WHAT THIS BAKE CAN STILL ANSWER</b> — the gate ledger check beside this '
        + 'one watches the code moving under the evidence; this watches the evidence '
        + 'moving under the code, which is what happened three times before anyone '
        + 'noticed. Rows under ' + h.minSamples + ' settled trades are named, never rated.'
        + lines.join('')
        + '<div style="margin-top:4px">Re-run scripts/backtest-omnigold.mjs then '
        + 'scripts/refit-confluence-weights.mjs to refill them.</div>'
        + '</div>';
    } catch (e) { return ''; }
  }

  function hgOgEvidenceStaleHtml(){
    try {
      var st = hgOgEvidenceStale(__og.liveGateKeys);
      if (!st) return '';
      var what = [];
      if (st.added.length) what.push('added ' + st.added.join(', '));
      if (st.removed.length) what.push('removed ' + st.removed.join(', '));
      return '<div class="note warn og-evidence-stale" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #dc2626;border-left:3px solid #dc2626;border-radius:4px;'
        + 'background:rgba(220,38,38,0.07);font-size:0.85em">'
        + '<b>EVIDENCE PREDATES THIS GATE LEDGER</b> — every baked number below was '
        + 'measured on the ' + esc(st.bakedFrom) + ', and the ledger has since '
        + esc(what.join(' and ')) + '. A ticket now means something different from the '
        + 'ticket those numbers counted. Re-run scripts/backtest-omnigold.mjs and '
        + 'scripts/omnigold-evidence-bake.mjs --write.'
        + '</div>';
    } catch (e) { return ''; }
  }

  /* WHY THE TICKET COLUMN IS EMPTY.

     OG_EDGE_PROOF_REQUIRED stands aside every setup whose mechanic has no
     measured edge, and no mechanic in the ledger has one. So the tab shows
     WATCH cards and no tickets, and without this panel a reader would be
     left to guess whether the desk had broken.

     It reads the SHIPPED ledger rather than a hard-coded sentence, so the
     day a mechanic does clear its bar this panel stops claiming otherwise
     on its own. */
  /* HOW FAR THE WAIT HAS GOT, AND WHETHER IT IS STILL RUNNING.

     The panel above tells a reader the forward log is collecting the
     evidence that would bring tickets back. That was a promise with nothing
     behind it: hgFwdHealthHTML has existed since the log was written and
     renders only on the FORWARD LEDGER tab, so someone waiting weeks on THIS
     tab could not tell 2-of-20 from 19-of-20, nor either from a pipeline
     that stopped recording a fortnight ago. hg-forward.js says so itself —
     "a SILENT logging failure is worse than the crash it prevents".

     Three things, per horizon: how many cleared setups have settled against
     the threshold, how they are doing against breakeven, and — separately —
     how the cards a reader ACTUALLY SAW have done. That last one is the
     question a person has, and until now nothing in this repo asked it:
     `shown` has been stamped on every record since hg-v753 and queried by
     nothing.

     Absent numbers read as absent. A log with no records says so rather
     than rendering zeros that look like a measured nothing. */
  function hgOgEdgeProgressHtml(){
    try {
      var w = W();
      if (!w || typeof w.hgFwdStats !== 'function') return '';
      var be = 1 / (1 + OG_T1_R);
      var rows = [], i, hz = ['SCALP', 'SWING'];
      for (i = 0; i < hz.length; i++){
        var tabs = hgOgFwdTabsFor(hz[i]);
        var clr = null, shw = null;
        try { clr = w.hgFwdStats(tabs, null, { gateClear: true }); } catch (e1) { clr = null; }
        try { shw = w.hgFwdStats(tabs, null, { shown: true }); } catch (e2) { shw = null; }
        var n = clr ? fin(clr.samples) : NaN;
        var hit = clr ? fin(clr.hit) : NaN;
        var open = clr ? fin(clr.open) : NaN;
        var bit = '<b>' + hz[i] + '</b> ';
        if (!isFinite(n) || n <= 0){
          bit += 'no cleared setups have settled yet'
              + (isFinite(open) && open > 0 ? ' (' + open + ' still running)' : '');
        } else {
          bit += n + ' of ' + FWD_MIN_JUDGE + ' settled'
              + (isFinite(open) && open > 0 ? ', ' + open + ' running' : '')
              + (isFinite(hit) ? (' · ' + (hit * 100).toFixed(0) + '% vs '
                   + (be * 100).toFixed(0) + '% breakeven') : '');
          if (n >= FWD_MIN_JUDGE) bit += ' — enough to judge';
        }
        if (shw && fin(shw.samples) > 0){
          bit += ' · cards actually shown: ' + fin(shw.samples) + ' settled'
              + (isFinite(fin(shw.hit)) ? ' at ' + (fin(shw.hit) * 100).toFixed(0) + '%' : '');
        }
        rows.push(bit);
      }

      /* the log's own fault report, where the promise is made rather than on
         a tab nobody waiting is looking at */
      var bad = '';
      try {
        var h = (typeof w.hgFwdHealth === 'function') ? w.hgFwdHealth() : null;
        if (h && fin(h.recent) > 0){
          bad = '<br><span style="color:#dc2626"><b>THE LOG IS REPORTING ERRORS</b> — '
              + fin(h.recent) + ' recent. Evidence may not be accumulating at all; '
              + 'see the FORWARD LEDGER tab.</span>';
        }
      } catch (eH) { bad = ''; }

      return '<br><span style="opacity:0.85">' + rows.join('<br>') + '</span>' + bad;
    } catch (e) { return ''; }
  }

  /* FOUR SPLITS WERE BEING COMPUTED AND NOBODY COULD READ ANY OF THEM.

     hgFwdStatsOf has returned byGrade, byStack, byBal and byDir on every
     call, and until this panel not one of them was read anywhere outside
     hg-forward.js. They were computed on every scan and thrown away.

     That is worst for byBal. hg-v763 added it under the heading "the desk
     has ranked its gold cards since it was written and never checked the
     ranking" — and then left the answer reachable only from a browser
     console, which is not checking it either. byDir (hg-v765) landed in
     the same drawer the week after.

     So: one panel, four questions, each of which the desk has been
     claiming to have made answerable.

       BY RANK       does the card we put at the top beat the one we put
                     at the bottom? If not, the ordering is decoration.
       BY DIRECTION  the short-beats-long asymmetry the replay found in
                     four detectors, now out of sample.
       BY GRADE      does the engine's own letter rank outcomes?
       BY GATE STACK do more agreeing gates mean a better trade?

     Read off the GATE-CLEAR population — setups that passed everything but
     measured-edge — because that is the population the desk judges on and
     the only one still growing while no ticket issues.

     REPORTING, NOT DECIDING. Nothing reads these buckets to rank, filter
     or weight anything; they exist to be looked at. A bucket with nothing
     in it prints a dash, never a rate, and when nothing has settled at all
     the panel says that in a sentence instead of drawing a grid of dashes
     that looks like a measurement. */
  function hgOgFwdBucketTxt(b, be){
    var n = fin(b && b.n), w = fin(b && b.w);
    if (!isFinite(n) || n <= 0) return '—';
    var hit = w / n;
    var txt = n + ' · ' + (hit * 100).toFixed(0) + '%';
    /* strictly ABOVE, not at: a bucket sitting exactly on breakeven made
       nothing, and a tick beside it would read as a result */
    if (isFinite(be)) txt += (hit > be ? ' ✓' : '');
    return txt;
  }

  function hgOgFwdSplitsPanelHtml(){
    try {
      var w = W();
      if (!w || typeof w.hgFwdStats !== 'function') return '';
      var tabs = hgOgFwdTabsFor('SCALP').concat(hgOgFwdTabsFor('SWING'));
      var st = null;
      try { st = w.hgFwdStats(tabs, null, { gateClear: true }); } catch (e1) { return ''; }
      if (!st) return '';
      var be = 1 / (1 + OG_T1_R);

      var bal = st.byBal || {}, dir = st.byDir || {}, grd = st.byGrade || {}, stk = st.byStack || {};
      var tot = 0, k;
      for (k in bal) tot += fin(bal[k] && bal[k].n) || 0;
      for (k in dir) tot += fin(dir[k] && dir[k].n) || 0;

      var head = '<div class="note og-fwd-splits" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #64748B;border-left:3px solid #64748B;border-radius:4px;'
        + 'background:rgba(100,116,139,0.05);font-size:0.82em">'
        + '<b>WHAT THE FORWARD LOG SAYS ABOUT THIS DESK\'S OWN JUDGEMENT</b><br>'
        + '<span style="opacity:0.8">Settled setups that cleared every gate but measured-edge. '
        + 'Breakeven is ' + (be * 100).toFixed(0) + '% at ' + OG_T1_R + 'R; ✓ marks a bucket above it. '
        + 'Reported only — nothing here ranks, filters or weights anything.</span><br>';

      if (!(tot > 0)){
        return head + '<span style="opacity:0.85">Nothing has settled yet, so every one of these '
          + 'is genuinely unknown rather than neutral. '
          + (isFinite(fin(st.open)) && fin(st.open) > 0
              ? fin(st.open) + ' still running.' : 'No cleared setups are open either.')
          + '</span></div>';
      }

      var line = function(label, pairs){
        var bits = [], i;
        for (i = 0; i < pairs.length; i++){
          bits.push(esc(pairs[i][0]) + ' ' + hgOgFwdBucketTxt(pairs[i][1], be));
        }
        return '<b>' + label + '</b> ' + bits.join(' &nbsp;|&nbsp; ');
      };

      var rows = [];
      rows.push(line('BY RANK', [['top', bal.top], ['mid', bal.mid], ['low', bal.low]]));
      rows.push(line('BY DIRECTION', [['long', dir.long], ['short', dir.short]]));

      var gk = Object.keys(grd), gp = [], gi;
      for (gi = 0; gi < gk.length; gi++) if (fin(grd[gk[gi]] && grd[gk[gi]].n) > 0) gp.push([gk[gi], grd[gk[gi]]]);
      if (gp.length) rows.push(line('BY GRADE', gp));

      var sk = Object.keys(stk), sp = [], si;
      for (si = 0; si < sk.length; si++){
        if (!(fin(stk[sk[si]] && stk[sk[si]].n) > 0)) continue;
        sp.push([sk[si] + (String(sk[si]) === '1' ? ' gate' : ' gates'), stk[sk[si]]]);
      }
      if (sp.length) rows.push(line('BY GATE STACK', sp));

      /* the honest reading, stated rather than left to the eye: a ranking
         that is backwards is the finding, not a rendering glitch */
      var note = '';
      var tN = fin(bal.top && bal.top.n), lN = fin(bal.low && bal.low.n);
      if (isFinite(tN) && tN > 0 && isFinite(lN) && lN > 0){
        var tH = fin(bal.top.w) / tN, lH = fin(bal.low.w) / lN;
        note = '<br><span style="opacity:0.85">The ordering is '
          + (tH > lH ? 'holding so far' : (tH < lH ? '<b>BACKWARDS so far</b>' : 'flat so far'))
          + ' — top ' + (tH * 100).toFixed(0) + '% against bottom ' + (lH * 100).toFixed(0)
          + '% on ' + tN + ' and ' + lN + ' settled. Too few to conclude anything either way '
          + 'until each bucket carries ' + FWD_MIN_JUDGE + '.</span>';
      }

      return head + '<span style="opacity:0.9">' + rows.join('<br>') + '</span>' + note + '</div>';
    } catch (e) { return ''; }
  }

  function hgOgEdgeProofPanelHtml(){
    try {
      if (!OG_EDGE_PROOF_REQUIRED) return '';
      var kinds = (HG_OG_REPLAY_EVIDENCE && HG_OG_REPLAY_EVIDENCE.kinds) || null;
      if (!kinds) return '';
      var keys = Object.keys(kinds);
      if (!keys.length) return '';

      /* THE FAMILY IS WHAT THE DESK SEARCHED, NOT WHAT IT RECORDED.
         This corrected over keys.length — the 54 mechanics that carry a
         replay row — while the measured-edge gate that actually stands
         setups aside corrects over OG_MECHANICS.length, all 77 scanned.
         So the panel whose whole job is to explain the empty ticket
         column quoted +3.11σ while the rule producing that column applied
         +3.21σ, and a reader working out the shortfall from "+1.71σ
         against the bar" got a different answer than the gate did. Same
         family as the gate, so the explanation is of the rule in force. */
      var famZ = hgOgFamilyZ(OG_MECHANICS.length);
      var be = 1 / 3;                      /* every plan this desk writes is 2R */
      var clears = 0, fails = 0, best = null;
      for (var i = 0; i < keys.length; i++){
        var row = kinds[keys[i]];
        var n = fin(row && row[0]), hit = fin(row && row[1]);
        if (!isFinite(n) || !isFinite(hit) || !(n > 0)) continue;
        /* on the EFFECTIVE sample, not the row count — see hgOgReplayZ */
        var z = hgOgReplayZ(row, be);
        if (!isFinite(z)) continue;
        if (z >= famZ) clears++;
        else if (z <= EDGE_VETO_Z) fails++;
        if (!best || z > best.z) best = { kind: keys[i], z: z, n: n, hit: hit,
                                          effN: hgOgEffN(n, true) };
      }
      /* the moment something clears, this panel has nothing to say */
      if (clears > 0) return '';

      return '<div class="note og-edge-proof" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #64748B;border-left:3px solid #64748B;border-radius:4px;'
        + 'background:rgba(100,116,139,0.07);font-size:0.85em">'
        + '<b>NO TICKETS — BY DESIGN, NOT BY FAULT</b><br>'
        + 'This desk issues a ticket only for a mechanic whose edge has been measured. '
        /* 'mechanics in the ledger' was wrong twice over: the ledger holds
           OG_MECHANICS.length of them, and keys.length is how many carry a
           replay row. The coverage panel on this same page prints the
           first number, so the two disagreed in front of the reader. */
        + 'Of ' + OG_MECHANICS.length + ' mechanics scanned, ' + keys.length
        + ' carry a replay record and <b>none</b> of those clears the '
        + OG_MECHANICS.length + '-comparison significance bar (+' + famZ.toFixed(2) + 'σ), '
        + fails + (fails === 1 ? ' fails' : ' fail') + ' it outright'
        /* THE EFFECTIVE COUNT IS PRINTED, not just used. Quoting 197 trades
           beside a z computed on 80 leaves a reader unable to reproduce the
           number, which is how the rest of this tab's stale arithmetic
           survived. */
        + (best ? ', and the best — ' + esc(best.kind) + ', ' + hgOgFmtCount(best.n)
                  + ' trades at ' + (best.hit * 100).toFixed(1) + '%, '
                  + hgOgFmtCount(Math.round(best.effN))
                  + ' after the overlap deflation — reaches only +'
                  + best.z.toFixed(2) + 'σ' : '')
        + '. Searching ' + OG_MECHANICS.length + ' ways and taking the best one is not evidence, '
        + 'which is what that bar exists to say.<br>'
        + 'Every σ here is on the EFFECTIVE sample: the replay held a mean of 55 gold '
        + 'positions at once, so its rows are one bet repeated rather than independent '
        + 'draws, and ' + (OG_EFF_N_RATIO * 100).toFixed(1) + '% of them survive the '
        + 'week-clustering. That cuts both ways — fewer clear, and fewer fail.<br>'
        + 'Every setup below still shows its levels, its gates and its reasoning as a '
        + '<b>WATCH</b>. What would refill this column is ' + FWD_MIN_JUDGE + ' settled setups '
        + 'that passed every other gate, beating breakeven — recorded whether or not they '
        + 'ticket, which is what stops this gate being the only thing able to clear itself.'
        + hgOgEdgeProgressHtml()
        + '</div>';
    } catch (e) { return ''; }
  }

  /* ONE SENTENCE, FOR EVERY SURFACE hg-v756 SILENCED.

     Making measured-edge hard emptied more than the ticket column. Anything
     keyed on grade.ticket went with it — the MOST PROBABLE panel, the pick
     selector, the XM bot payload, the activation row — and the explanation
     lived in exactly one place, the evidence panel further down. A reader
     on MOST PROBABLE saw an empty box and no reason, which reads as a
     broken desk rather than a deliberate one.

     Returns '' when the gate is not the reason, so a genuinely quiet tape
     is not mislabelled: the flag off, or any mechanic clearing its bar,
     and this says nothing. hgOgEdgeProofPanelHtml is the long form; this is
     the line that goes where a reader is already looking. */
  function hgOgEdgeSilenceNote(){
    try {
      if (!OG_EDGE_PROOF_REQUIRED) return '';
      if (hgOgEdgeProofPanelHtml() === '') return '';   /* something clears — not this */
      return 'No ticket can clear while no gold mechanic has a measured edge: '
           + 'this desk stopped issuing them rather than imply one. The setups below are '
           + 'WATCH cards with their levels and gates intact.';
    } catch (e) { return ''; }
  }

  function hgOgBookExperienceHtml(){
    try {
      var vc = null;
      try { vc = hgOgVenueCost(); } catch (eV) { vc = null; }
      var xm = vc && String(vc.venue).toUpperCase() === 'XM';
      var row = xm ? HG_OG_BOOK_EXPERIENCE.ticketsXm : HG_OG_BOOK_EXPERIENCE.ticketsPaxg;
      var venue = xm ? 'XM' : 'PAXG';
      var fin0 = row[0], peak = row[1], dd = row[2], streak = row[3], n = row[4];
      return '<div class="note warn og-book-experience" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #f59e0b;border-left:3px solid #f59e0b;border-radius:4px;'
        + 'background:rgba(245,158,11,0.06);font-size:0.85em">'
        + '<b>WHAT HOLDING IT FELT LIKE</b> — ' + esc(venue) + ', ticket-only, one position at a time, '
        + n + ' trades over ' + esc(HG_OG_BOOK_EXPERIENCE.window) + ': '
        + 'finished <b>' + (fin0 >= 0 ? '+' : '') + fin0.toFixed(1) + 'R</b> '
        + 'after a <b>' + dd.toFixed(1) + 'R drawdown</b> '
        + '(peak ' + peak.toFixed(1) + 'R, ' + streak + ' losses in a row, the hole ran '
        + esc(row[5]) + ' to ' + esc(row[6]) + '). '
        + 'At 1% risk a trade that is ' + dd.toFixed(0) + '% of the account to finish '
        + (fin0 >= 0 ? '+' : '') + fin0.toFixed(0) + '%.'
        /* never let a reader mistake a proxy for a measurement */
        + (HG_OG_BOOK_EXPERIENCE.proxy
          ? '<div class="dim" style="font-size:0.9em;margin-top:3px">'
            + esc('Proxy: ' + HG_OG_BOOK_EXPERIENCE.gateSet + ' applied to a '
                + HG_OG_BOOK_EXPERIENCE.window.slice(-10) + ' walk, not a re-walk — '
                + 'a fresh walk would change which setups formed, not only which survived.')
            + '</div>'
          : '')
        + '</div>';
    } catch (e) { return ''; }
  }

  /* WHAT IS KNOWN ABOUT A MECHANIC, IN THREE STATES.

     There are three and the desk used to render two of them identically —
     as nothing at all:

       MEASURED     a row in `kinds`. Renders its record and its verdict.
       THIN         fired, settled under the 40-trade bar. hg-v765 gave it
                    a line.
       UNOBSERVED   registered, runs on every scan, and this walk produced
                    NOT ONE ROW for it. Twelve of the 77.

     The third is the worst of the three to render silently: a reader sees
     a card for P8-GEO with levels, a rank and a gate verdict, and nothing
     anywhere says the desk has never once seen this thing fire.

     DERIVED, NOT LISTED. The unobserved set is OG_MECHANICS minus the two
     baked maps, computed here, so registering a mechanic puts it straight
     into the disclosure with no list to remember to update. That is only
     sound while the two maps between them cover everything the walk saw —
     a kind that fired and was filtered away to zero rows would sit in
     neither and be misreported as never seen. It cannot happen on this
     bake (the union is exactly the 67 kinds in sequentialBake.kindSeenRaw)
     and test-omnigold-unobserved pins that equality against the artifact,
     so the day a bake breaks it the suite says so instead of the card
     lying. */
  function hgOgKindKnownState(kind){
    var key = String(kind || '').toUpperCase();
    if (!key) return null;
    var E = HG_OG_REPLAY_EVIDENCE;
    if (!E) return null;
    if (E.kinds && Object.prototype.hasOwnProperty.call(E.kinds, key)) return 'measured';
    var below = E.kindsBelowBar && E.kindsBelowBar.counts;
    if (below && Object.prototype.hasOwnProperty.call(below, key)) return 'thin';
    /* only a REGISTERED mechanic can be unobserved. An unknown string is
       not a mechanic of this desk's and has nothing to disclose. */
    for (var i = 0; i < OG_MECHANICS.length; i++) if (OG_MECHANICS[i] === key) return 'unobserved';
    return null;
  }

  /* hg-v923 — a mechanic with NO record here may still have one on the GOLD
     SCALP walk, under the stratKey hgOgKindToInstKey maps it to. Saying only
     'no record' would hide that; pasting the sibling number as if it were this
     desk's would be worse. So it is named, attributed, and — where the sibling
     row measured something other than this mechanic — said so.

     SWEEP-OB is exactly that case and is why this exists: its sibling row
     reads +0.16R over n=49, and every one of those 49 is a PRE-TRIGGER state
     of the detector, not the confirmed setup this desk forms. Returns '' when
     goldind is absent or has no row, so the caller appends unconditionally. */
  function hgOgSiblingRecordNote(kind){
    try {
      /* Only a REGISTERED mechanic has anything to attribute. This is
         REDUNDANT TODAY — the strict lookup below already returns null for
         every unregistered string, because no unregistered kind has a named
         mapping — and the test proves that rather than assuming it. It stays
         because the two conditions are independent: the day someone adds an
         explicit `if (k === 'X') return 'y'` for a kind that is not in
         OG_MECHANICS, strict stops covering this and the guard does. */
      if (hgOgKindKnownState(kind) === null) return '';
      var key = null;
      /* strict: a fallback mapping is not this mechanic's record. */
      try { key = hgOgKindToInstKey(kind, true); } catch (eK) { key = null; }
      if (!key) return '';
      var w = W();
      var tbl = w && w.HG_GOLD_SETUP_EDGE;
      var row = tbl && tbl.scalp && tbl.scalp[key];
      if (!row || !isFinite(fin(row.net))) return '';
      var pre = !!(row.live && row.live.precursorOnly);
      return ' <b>The GOLD SCALP walk does have a record under <code>' + esc(key)
        + '</code></b> — net ' + (fin(row.net) >= 0 ? '+' : '') + fin(row.net).toFixed(3)
        + 'R over n=' + (fin(row.n) || 0) + ' — but it is that desk\u2019s book, not this one\u2019s'
        + (pre ? ', and every firing in it is a PRE-TRIGGER state of this detector rather than the '
                 + 'confirmed setup formed here, so it is not this mechanic\u2019s record either'
               : '')
        + '.';
    } catch (e) { return ''; }
  }

  /* Every registered mechanic the walk never produced a row for. Pure,
     derived, and the number the header quotes rather than a literal. */
  function hgOgUnobservedKinds(){
    var out = [], i;
    for (i = 0; i < OG_MECHANICS.length; i++){
      if (hgOgKindKnownState(OG_MECHANICS[i]) === 'unobserved') out.push(OG_MECHANICS[i]);
    }
    return out;
  }

  function hgOgReplayBelowBarHtml(kind){
    try {
      var state = hgOgKindKnownState(kind);
      if (state === 'thin'){
        var tbl = HG_OG_REPLAY_EVIDENCE.kindsBelowBar;
        var n = fin(tbl.counts[String(kind).toUpperCase()]), bar = fin(tbl.minN);
        if (!isFinite(n) || !isFinite(bar)) return '';
        return '<div class="dim og-replay-line og-replay-edge-none" style="font-size:11px;margin-top:2px">'
          + 'replay: NOT MEASURED — ' + n + ' settled firing' + (n === 1 ? '' : 's')
          + ' in the walk, under the ' + bar + ' this desk needs before it will quote a '
          + 'record. No win rate is shown because none would mean anything at that n.</div>';
      }
      if (state === 'unobserved'){
        var tot = hgOgUnobservedKinds().length;
        return '<div class="dim og-replay-line og-replay-edge-none" style="font-size:11px;margin-top:2px">'
          + 'replay: NEVER OBSERVED — this mechanic is registered and runs on every scan, and the '
          + 'walk behind every number on this page did not produce a single firing of it. Not a '
          + 'weak record: no record. ' + tot + ' of ' + OG_MECHANICS.length
          + ' registered mechanics are in this state.'
          + hgOgSiblingRecordNote(kind) + '</div>';
      }
      return '';
    } catch (e) { return ''; }
  }

  /* hg-v918 — the sequential book at both bounds, as a panel.

     Never a verdict and never a gate: every cell here disagrees between its
     ends, so the only honest output is both numbers and the word disagree.
     Returns '' when the constant carries nothing, so a caller can append it
     unconditionally. */
/* hg-v919 — WHAT THIS VENUE'S COST CEILING ASKS, AND WHAT IT COSTS THE BOOK.

     hgOgVenueCostNoteHtml only renders when the venue DIFFERS from the
     replay's PAXG, so on the fail-closed default it says nothing at all —
     exactly the case where the cost gate is doing the most work. On the
     replay the ceiling alone vetoes 96.1% of scalp rows at PAXG against
     16.4% at XM, and a reader who has never opened the venue selector reads
     that as a quiet market rather than as their venue.

     Never a verdict and never a gate: this panel moves nothing, it states
     what the shipped ceiling demands here and what the same rule demanded on
     the measured book at each venue. '' when the venue cannot be priced. */
  /* hg-v924 — WHEN THE COST CEILING IS WHAT EMPTIED THE SCAN, SAY SO.

     hg-v919 made the ceiling legible in two places: the per-plan veto reason
     now names the stop width it demands, and hgOgCostCeilingPanelHtml renders
     both lanes against the replay. Neither of them fires on the case that
     matters most. hgOgVenueCostNoteHtml renders only when the venue DIFFERS
     from the replay's, and the replay is PAXG — so on the fail-closed default
     the desk says nothing at all, which is exactly the setting where the
     ceiling is doing the most work. On the replay it alone vetoes 84.5% of
     every plan and 94.7% of the scalp lane at PAXG, against 13.0% / 16.6% at
     XM. A near-empty board then reads as a quiet market rather than a venue.

     This tallies THE SCAN IN FRONT OF THE READER, not the replay, and only
     claims what the ledger supports:

       priceable  plans whose cost-drag gate could be evaluated at all
       vetoed     of those, how many the ceiling failed
       sole       of THOSE, how many had cost-drag as their ONLY failing hard
                  gate — the honest denominator for "what relaxing it buys",
                  the same discipline as the crypto WHY EMPTY sole-blocker
                  column. A plan that also fails confluence is not a ticket
                  the venue is withholding.
       wouldClear of the sole-blocker set, how many clear the SAME ceiling
                  when re-priced at the other venue preset.

     DOMINANT IS MEASURED, NOT ASSERTED. The note fires only when cost-drag is
     the top hard blocker in this scan's own ledger — more plans failed on it
     than on any other gate — and only when nothing ticketed. Anything less and
     the ceiling is one reason among several, which is not what "the ceiling
     emptied the scan" claims. Returns '' otherwise, so the caller appends it
     unconditionally. */
  function hgOgCostCeilingScanTally(rows, opts){
    try{
      opts = opts || {};
      var list = Array.isArray(rows) ? rows
        : ((__og && __og.snap && Array.isArray(__og.snap.rows)) ? __og.snap.rows : null);
      if (!list || !list.length) return null;
      var vc = (opts.venueCost && isFinite(fin(opts.venueCost.rtCostPct)))
        ? opts.venueCost : hgOgVenueCost();
      var venue = String((vc && vc.venue) || 'PAXG');
      var otherName = (venue === 'XM') ? 'PAXG' : 'XM';
      var other = null;
      try { other = hgOgVenuePresetCost(otherName); } catch (eO) { other = null; }
      var otherRt = fin(other && other.rtCostPct);

      var scanned = 0, priceable = 0, vetoed = 0, sole = 0, wouldClear = 0, tickets = 0;
      var byKey = {}, i, j, r, g, gl, failedHard, costGate, ceil, stopPct;
      /* The dollar reading aid needs a price, and the honest one is THIS
         scan's own: the median entry of the plans being counted. A module
         global could be stale; these entries are what the plans were priced
         at. No priceable plan -> no price -> no dollars, per
         hgOgCostCeilingDemand's own rule. */
      var entries = [];
      for (i = 0; i < list.length; i++){
        r = list[i];
        if (!r || !Array.isArray(r.gates)) continue;
        scanned++;
        if (r.grade && r.grade.ticket) tickets++;
        gl = r.gates; failedHard = []; costGate = null;
        for (j = 0; j < gl.length; j++){
          g = gl[j];
          if (!g || g.hard !== true) continue;
          if (g.key === 'cost-drag') costGate = g;
          if (g.pass === true) continue;
          failedHard.push(g.key);
          byKey[g.key] = (byKey[g.key] || 0) + 1;
        }
        if (!costGate) continue;
        priceable++;
        var pe = fin(r.plan && r.plan.entry);
        if (isFinite(pe) && pe > 0) entries.push(pe);
        if (costGate.pass === true) continue;
        vetoed++;
        if (failedHard.length !== 1) continue;   /* not the sole blocker */
        sole++;
        /* would the SAME ceiling clear at the other venue? Only the fee
           changes; the geometry and the lane do not. */
        if (!(isFinite(otherRt) && otherRt > 0)) continue;
        var pl = (r.plan && typeof r.plan === 'object') ? r.plan : null;
        var e = fin(pl && pl.entry), st = fin(pl && pl.stop);
        if (!(isFinite(e) && e > 0 && isFinite(st))) continue;
        stopPct = Math.abs(e - st) / e * 100;
        if (!(stopPct > 0)) continue;
        ceil = (String(r.horizon).toUpperCase() === 'SCALP') ? COST_VETO_R_SCALP : COST_VETO_R;
        if ((otherRt / stopPct) <= ceil) wouldClear++;
      }
      if (!priceable) return null;
      /* STRICTLY more, and ties broken by name rather than by object key
         order — "the binding gate" must be the same gate on every render. */
      var topKey = null, topN = 0, topTie = false, k;
      for (k in byKey){
        if (!Object.prototype.hasOwnProperty.call(byKey, k)) continue;
        if (byKey[k] > topN || (byKey[k] === topN && topKey !== null && k < topKey)){
          if (byKey[k] === topN) topTie = true; else topTie = false;
          topN = byKey[k]; topKey = k;
        } else if (byKey[k] === topN){ topTie = true; }
      }
      entries.sort(function(x, y){ return x - y; });
      var medPx = entries.length ? entries[Math.floor(entries.length / 2)] : null;
      /* the WHOLE breakdown, not just the winner: "binding gate X" is only
         readable beside the gates that also blocked, and a reader chasing an
         empty board needs the list, not the headline. */
      var blockers = [];
      for (k in byKey){
        if (!Object.prototype.hasOwnProperty.call(byKey, k)) continue;
        blockers.push({ key: k, n: byKey[k] });
      }
      blockers.sort(function(x, y){ return (y.n - x.n) || (x.key < y.key ? -1 : 1); });
      return { px: medPx, blockers: blockers, hardFails: blockers.length,
               scanned: scanned, priceable: priceable, vetoed: vetoed, sole: sole,
               wouldClear: wouldClear, tickets: tickets,
               venue: venue, rtCostPct: fin(vc && vc.rtCostPct),
               otherVenue: otherName, otherRt: isFinite(otherRt) ? otherRt : null,
               topKey: topKey, topN: topN, topTie: topTie,
               /* dominant = the ceiling is the SOLE leader. A tie is not a
                  cause, it is two causes, and the note must not pick one. */
               dominant: (topKey === 'cost-drag' && vetoed > 0 && !topTie) };
    }catch(e){ return null; }
  }

  /* hg-v924 — WHY NOTHING TICKETED, for whatever gate is actually doing it.

     GOLD SCALP has had this since gsRejectFunnelHTML: "N setups held back
     across M gates · binding gate: X (P%)", with the per-gate breakdown under
     it. OMNIGOLD never had one. A reader looking at an empty OMNIGOLD board
     could read every panel on the page and still not learn which gate emptied
     it — the panels describe the RULES and the REPLAY; none of them counts
     this scan.

     So the funnel is general, and the cost ceiling is the special case it
     folds in: when cost-drag is the binding gate, the venue paragraph below
     runs as well, because there the answer is a setting rather than the tape.
     Silent when anything ticketed — an empty ticket column is the only thing
     this claims to explain. */
  /* hg-v927 — WHEN THE WALK BEHIND THIS DESK ENDED.

     hgOgEvidenceStaleHtml watches the GATE SET moving under the evidence and
     hgOgEvidenceHealthHtml watches the evidence's own thinness. Neither one
     watches the CALENDAR, so a reader opening this tab was gated by a replay
     of entirely unstated age, presented as current.

     Written by scripts/rebake-gold-literals.mjs from
     scripts/backtest-omnigold-results.json, so a re-bake moves it. The age is
     computed at RENDER TIME against the real clock — a baked "11 days old"
     would be wrong the next morning.

     NO THRESHOLD. Nothing here measures how fast gold edge decays, so there is
     no honest "too old to trade" line and inventing one would be the fitted
     number this desk refuses everywhere else. It states the age and what the
     walk cannot have seen. */
  var HG_OG_WALK = {
    from: '2026-03-29T14:00:00.000Z',
    to: '2026-09-12T04:00:00.000Z',
    generated: '2026-09-12T07:15:34.424Z',
    trades: 9897,
    src: 'scripts/backtest-omnigold-results.json'
  };

  function hgOgWalkAgeDays(nowMs){
    try{
      var end = Date.parse(HG_OG_WALK.to);
      var now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
      if (!isFinite(end) || !isFinite(now) || now < end) return null;
      return Math.floor((now - end) / 86400000);
    }catch(e){ return null; }
  }

  /* hg-v931: OMNIGOLD against ITS OWN breakeven, and the 672 trades the fill
     bounds disagree about. The literal and the renderer live in goldind.js so
     ONE definition serves both gold desks — a second copy here would drift the
     first time either was re-baked, which is the hg-v921 lesson. goldind
     absent renders nothing rather than throwing; this panel leads the chain
     because a reader scanning for a ticket should meet the desk's own
     unproven-edge statement before any of the numbers below it. */
  function hgOgBreakevenPanelHtml(){
    try{
      var f = gfn('hgGoldBreakevenHtml');
      return (typeof f === 'function') ? (f('omnigold') || '') : '';
    }catch(e){ return ''; }
  }

  /* hg-v934: THE MECHANICS THAT HAVE NEVER FIRED, AND WHAT THEY COST THE ONES
     THAT HAVE.

     OG_MECHANICS is the registered family. Not all of it has ever been
     OBSERVED: a mechanic can be wired at all three sites, pass the coverage
     guard, and still never have produced a single settled firing in the walk
     the evidence comes from. Before hg-v925 that barely mattered, because an
     UNKNOWN mechanic stood the setup aside. Since hg-v925 it tickets.

     So this states the two things a reader cannot otherwise see:

     WHAT TICKETS ON NOTHING. The never-observed count, and that those
     mechanics reach a card with no record behind them at all — not a thin
     record, not a negative one, none.

     WHAT IT COSTS EVERYONE ELSE. hgOgFamilyZ(OG_MECHANICS.length) is a Sidak
     correction over the whole REGISTERED family, so a mechanic that can never
     be tested still raises the promotion bar for every mechanic that can. The
     arithmetic is the desk's own, run twice at render — once over the whole
     register, once over the observed subset — so the gap is measured here, not
     asserted. Strictly speaking a hypothesis that is never evaluated is not a
     test and should not inflate the family, which is an argument for counting
     the observed subset; it LOOSENS the bar, so it is published and NOT acted
     on. hgOgFamilyZ still reads OG_MECHANICS.length and nothing is gated on
     this panel. Every figure is derived; no count is written into the string. */
  function hgOgUnobservedPanelHtml(){
    try{
      var kinds = (HG_OG_REPLAY_EVIDENCE && HG_OG_REPLAY_EVIDENCE.kinds) || {};
      var total = OG_MECHANICS.length, seen = 0, never = [];
      for (var i = 0; i < total; i++){
        if (Object.prototype.hasOwnProperty.call(kinds, OG_MECHANICS[i])) seen++;
        else never.push(OG_MECHANICS[i]);
      }
      if (!never.length || !seen) return '';
      var zAll = hgOgFamilyZ(total), zSeen = hgOgFamilyZ(seen);
      return '<div class="note og-unobserved" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #6B7280;border-left:3px solid #6B7280;border-radius:4px;'
        + 'background:rgba(107,114,128,0.07);font-size:0.85em">'
        + '<b>' + never.length + ' OF THE ' + total + ' REGISTERED MECHANICS HAVE NEVER '
        + 'FIRED IN THIS WALK</b> &mdash; ' + seen + ' carry a measured record; the rest '
        + 'have produced no settled firing at all in ' + esc(String(HG_OG_REPLAY_EVIDENCE.window))
        + '. Since hg-v925 an unknown mechanic no longer stands its setup aside, so those '
        + ' can reach a ticket on no evidence whatsoever &mdash; not a thin record, not a '
        + 'negative one, none. Each such card says so itself.'
        + '<div style="margin-top:4px">And they are not free to the mechanics that DO have '
        + 'a record: the promotion bar is a Sidak correction over the whole register, so it '
        + 'sits at +' + zAll.toFixed(4) + '&sigma; across ' + total + ' rather than +'
        + zSeen.toFixed(4) + '&sigma; across the ' + seen + ' that can actually be tested '
        + '&mdash; <b>+' + (zAll - zSeen).toFixed(4) + '&sigma; stricter for every measured '
        + 'mechanic</b>, charged by mechanics no measurement can ever clear or fail.</div>'
        + '<div style="margin-top:4px">Published, <b>not acted on</b>. Narrowing the family to '
        + 'the observed subset is the defensible statistic &mdash; a hypothesis that is never '
        + 'evaluated is not a test &mdash; but it LOWERS a bar, and this desk does not loosen '
        + 'on an argument. The gate still corrects over all ' + total + '.</div>'
        + '<div style="margin-top:4px;opacity:0.85">Never observed: ' + esc(never.join(' · ')) + '</div>'
        + '</div>';
    }catch(e){ return ''; }
  }

  /* hg-v935: render the refusal, with the sweep that produced it.

     Every figure comes from HG_OG_SELECTION, which scripts/mechanic-selection.mjs
     writes from the replay — nothing here is transcribed, so a re-bake moves
     the numbers instead of leaving a stale claim. It renders whether or not the
     verdict is negative: if a future bake DOES produce a contiguous unanimous
     rule, this panel says so rather than going quiet and leaving the old
     refusal standing as the last word. */
  function hgOgSelectionRefusedHtml(){
    try{
      var S = HG_OG_SELECTION;
      if (!S || !S.sweep || !S.sweep.length) return '';
      var cells = '';
      for (var i = 0; i < S.sweep.length; i++){
        var r = S.sweep[i];
        cells += '<span style="display:inline-block;margin:0 6px 2px 0;'
          + (r.unanimous ? 'font-weight:700' : 'opacity:0.65') + '">'
          + r.bar.toFixed(2) + ' ' + (r.unanimous ? '✓' : '✗') + '</span>';
      }
      var head = S.ships
        ? 'A MECHANIC-SELECTION RULE NOW SURVIVES OUT OF SAMPLE'
        : 'SELECTING MECHANICS BY THEIR OWN RECORD WAS MEASURED, AND REFUSED';
      return '<div class="note og-selection" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #6B7280;border-left:3px solid #6B7280;border-radius:4px;'
        + 'background:rgba(107,114,128,0.07);font-size:0.85em">'
        + '<b>' + head + '</b> &mdash; the desk forms setups from every registered '
        + 'mechanic, so the obvious improvement is to keep only the ones whose record '
        + 'is positive. Tested on ' + S.windows + ' disjoint windows with the selection '
        + 'made on the OTHER three each time, so it never sees the window it is scored '
        + 'on, at both fill bounds. <b>Keeping the gross-positive mechanics is never '
        + 'unanimous.</b> Dropping only those at or below a bar is unanimous at some '
        + 'bars &mdash; and it switches on and off between NEIGHBOURING ones:'
        + '<div style="margin-top:4px;font-family:monospace">' + cells + '</div>'
        + '<div style="margin-top:4px">' + S.unanimousCells + ' unanimous cells in '
        + S.runs + ' separate runs'
        + (S.contiguous ? ' &mdash; contiguous.' : ' &mdash; <b>not contiguous</b>. A real '
          + 'effect fades as the bar moves; one that flickers is the output of a search '
          + 'over bars, which is why hg-v922 refused a stop-width threshold on the same '
          + 'evidence.') + '</div>'
        + '<div style="margin-top:4px">And the ceiling is the part worth knowing: the '
        + 'best unanimous cell lifts net expectancy by <b>+' + S.bestLift.toFixed(4)
        + 'R</b> and leaves the book at <b>' + S.ceilingNet.toFixed(4) + 'R</b> on '
        + hgOgFmtCount(S.bookN) + ' filled plans. Mechanic selection at its most generous '
        + 'reading does not make this desk pay &mdash; it makes it less negative.</div>'
        + '<div style="margin-top:4px;opacity:0.85">Nothing is gated on this. No mechanic '
        + 'is dropped and no threshold moved. Re-derive: '
        + '<code>node scripts/mechanic-selection.mjs</code></div>'
        + '</div>';
    }catch(e){ return ''; }
  }

  function hgOgWalkAgeHtml(nowMs){
    try{
      var d = hgOgWalkAgeDays(nowMs);
      if (d === null) return '';
      return '<div class="note og-walk-age" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #B45309;border-left:3px solid #B45309;border-radius:4px;'
        + 'background:rgba(180,83,9,0.07);font-size:0.85em">'
        + '<b>THE EVIDENCE ON THIS PAGE IS ' + d + ' DAY' + (d === 1 ? '' : 'S')
        + ' OLD</b> &mdash; every table below, every mechanic verdict and the gate that '
        + 'reads them come from one replay of ' + hgOgFmtCount(HG_OG_WALK.trades)
        + ' plans spanning ' + esc(String(HG_OG_WALK.from).slice(0, 10)) + ' to '
        + esc(String(HG_OG_WALK.to).slice(0, 10)) + '. It has not seen a bar since.'
        + '<div style="margin-top:4px">Re-run it with <code>npm run gold:rebake</code> on a '
        + 'machine that can reach the data and every number here, including this line, '
        + 'rewrites itself. <b>No staleness threshold is attached</b>: nothing measures how '
        + 'fast gold edge decays, so a "too old to trade" line would be invented rather than '
        + 'measured.</div></div>';
    }catch(e){ return ''; }
  }

  /* ====================================================================
     hg-v926 — ONE POSITION AT A TIME
     ====================================================================

     Every pack in this sequence has looked for BETTER SETUPS and none of the
     dials moved: hg-v922 found that nothing either gold desk ranks by (tally,
     grade, demote, tier, confluence, checks) separates outcomes across four
     disjoint windows; the one factor that does — stop width — holds in
     DIRECTION but names no value. That is a finding, not a failure to search.

     This is not about which setup. It is about HOW MANY AT ONCE, and it is
     the only result in the whole evidence base that is positive at both fill
     bounds — the hg-v918 bar.

     THE WALK PUBLISHES 59.4 PLANS A DAY ON ONE INSTRUMENT and holds a
     time-weighted 57 at once. Every headline table on this tab describes that
     book. Nobody can run it, and it is not 57 bets: it is ONE bet on gold at
     57x size. That half of the argument needs no statistics.

     The other half is the sequential book — walk the plans in time order,
     take one when flat, hold it to its own exit:

                        lower bound          upper bound
       SCALP tickets    +0.1484R  n=73       +0.4155R  n=54
       SWING tickets    -0.2399R  n=32       +0.3166R  n=35
       all at once      -0.1160R  n=8132     (parallel book, XM)

     SCALP is positive at BOTH ends. SWING disagrees between them, so by this
     desk's own rule it carries no verdict and is not claimed here.

     AND THE LIMIT, STATED: at the conservative end the scalp read is n=73 at
     +1.16 sigma against breakeven. Positive, NOT significant. It clears no
     bar this desk applies to a mechanic. It is not offered as proof of an
     edge — it is offered because the comparison is stark (+0.148 against
     -0.116), because it is the only both-bounds positive there is, and
     because the concentration argument stands on its own without it.

     WHAT IT DOES. While a gold conviction is live, a new OMNIGOLD ticket is
     held: the card keeps its levels, its gates and its reasoning and reads
     HELD instead of TICKET. Nothing is hidden and no gate threshold moved.
     hgOgSetOneAtATime(false) turns it off and persists, window.HG_OG_ONE_AT_A_TIME
     overrides both. */
  var OG_ONE_AT_A_TIME_LS_KEY = 'hg_og_one_at_a_time';
  var OG_ONE_AT_A_TIME_DEFAULT = true;
  var OG_ONE_AT_A_TIME = OG_ONE_AT_A_TIME_DEFAULT;
  /* the two gold desks that book convictions; OMNIGOLD reads both because a
     position is a position whichever tab opened it */
  var OG_CONVICTION_KEYS = ['hgGoldscalpConviction', 'hgGoldswingConviction'];

  function hgOgOneAtATimeInit(){
    try{
      var w = W();
      var ovr = (w && w.HG_OG_ONE_AT_A_TIME);
      if (ovr === true || ovr === false){ OG_ONE_AT_A_TIME = ovr; return OG_ONE_AT_A_TIME; }
      var stored = null;
      try { stored = localStorage.getItem(OG_ONE_AT_A_TIME_LS_KEY); } catch (eL) { stored = null; }
      if (stored === '1' || stored === 'true') OG_ONE_AT_A_TIME = true;
      else if (stored === '0' || stored === 'false') OG_ONE_AT_A_TIME = false;
      else OG_ONE_AT_A_TIME = OG_ONE_AT_A_TIME_DEFAULT;
    }catch(e){ OG_ONE_AT_A_TIME = OG_ONE_AT_A_TIME_DEFAULT; }
    return OG_ONE_AT_A_TIME;
  }
  function hgOgSetOneAtATime(on){
    OG_ONE_AT_A_TIME = (on === true);
    try { localStorage.setItem(OG_ONE_AT_A_TIME_LS_KEY, OG_ONE_AT_A_TIME ? '1' : '0'); } catch (eS) {}
    return OG_ONE_AT_A_TIME;
  }

  /* Live gold convictions across both booking desks. Returns
     { n, keys: [..] } and NEVER throws — a store this cannot read is 0 open,
     which fails OPEN (the ticket stands). Refusing to ticket because
     localStorage is unavailable would be a gate nobody chose. */
  function hgOgOpenGoldConvictions(nowMs){
    /* hg-v941: `rows` carries what each holding record IS \u2014 symbol, direction,
       venue and age. The hold was previously a bare count, so a record that
       could not expire (its venue had left the feed chain, see conviction-lock
       hg-v941) held three desks while reading exactly like a position someone
       had just taken. An age on the line makes that visible on sight. */
    var out = { n: 0, keys: [], rows: [] };
    var now = (isFinite(+nowMs) && +nowMs > 0) ? +nowMs : Date.now();
    try{
      for (var i = 0; i < OG_CONVICTION_KEYS.length; i++){
        var raw = null;
        try { raw = localStorage.getItem(OG_CONVICTION_KEYS[i]); } catch (eR) { raw = null; }
        if (!raw) continue;
        var j = null;
        try { j = JSON.parse(raw); } catch (eP) { j = null; }
        if (!j || !j.live || typeof j.live !== 'object') continue;
        for (var k in j.live){
          if (!Object.prototype.hasOwnProperty.call(j.live, k)) continue;
          out.n++; out.keys.push(String(k));
          var rec = j.live[k] || {};
          var at = isFinite(+rec.issuedAt) ? +rec.issuedAt : NaN;
          out.rows.push({
            key: String(k),
            store: OG_CONVICTION_KEYS[i],
            desk: (OG_CONVICTION_KEYS[i] === 'hgGoldswingConviction') ? 'SWING' : 'SCALP',
            sym: rec.sym || null, dir: rec.dir || null, venue: rec.venue || null,
            issuedAt: isFinite(at) ? at : null,
            ageMs: isFinite(at) ? Math.max(0, now - at) : null
          });
        }
      }
    }catch(e){}
    return out;
  }

  /* One line per holding record: what it is and how old. Returns '' when
     nothing is held or no record carries an age \u2014 an age-less store is an
     older write, not a fault, and inventing one would be worse than silence. */
  function hgOgHoldingRowsHtml(open){
    try{
      var o = open || hgOgOpenGoldConvictions();
      var rows = (o && o.rows) || [];
      if (!rows.length) return '';
      var out = [], i;
      for (i = 0; i < rows.length; i++){
        var r = rows[i] || {};
        var bits = [r.desk || 'GOLD'];
        if (r.sym) bits.push(String(r.sym));
        if (r.dir) bits.push(String(r.dir).toUpperCase());
        if (r.venue) bits.push(String(r.venue));
        var age = '';
        /* NOT isFinite(+r.ageMs): +null is 0, which reads as "held 0m" — a
           made-up age on a record whose store never recorded one. */
        if (typeof r.ageMs === 'number' && isFinite(r.ageMs)){
          var h = Math.floor(r.ageMs / 3600000);
          var m = Math.floor((r.ageMs % 3600000) / 60000);
          age = ' \u2014 held ' + (h > 0 ? (h + 'h ' + m + 'm') : (m + 'm'));
        } else {
          age = ' \u2014 age not recorded';
        }
        out.push('<div>' + esc(bits.join(' \u00b7 ')) + esc(age) + '</div>');
      }
      return '<div class="og-holding" style="margin-top:4px;opacity:.9">'
        + '<b>What is holding:</b>' + out.join('') + '</div>';
    }catch(e){ return ''; }
  }

  /* The gate row itself, as a pure function so it can be exercised without
     running a whole scan. Returns null when the guard is off — the ledger
     then has no such row at all, rather than a row that always passes.
     FAILS OPEN: hgOgOpenGoldConvictions reports 0 for an unreadable store. */
  function hgOgOneAtATimeGate(open){
    if (!OG_ONE_AT_A_TIME) return null;
    var o = open || hgOgOpenGoldConvictions();
    var free = !(o && o.n > 0);
    return { key: 'one-at-a-time', hard: true, pass: free,
      why: free
        ? 'no gold conviction is live — this desk takes one position at a time'
        : (o.n + ' gold conviction' + (o.n === 1 ? ' is' : 's are') + ' already live'
           + ' — HELD. The walk publishes 59.4 plans a day on one instrument and holds 57'
           + ' at once, which is one bet at 57x size; taken one at a time the SCALP ticket'
           + ' book is +0.148R at the conservative fill bound and +0.416R at the other,'
           + ' against -0.116R all at once. hgOgSetOneAtATime(false) turns this off.') };
  }

  /* The panel. Renders only while something is actually held — a standing
     lecture about concentration on an empty book is noise. */
  function hgOgOneAtATimeHtml(open){
    try{
      if (!OG_ONE_AT_A_TIME) return '';
      var o = open || hgOgOpenGoldConvictions();
      if (!o || !(o.n > 0)) return '';
      return '<div class="note og-one-at-a-time" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #0F766E;border-left:3px solid #0F766E;border-radius:4px;'
        + 'background:rgba(15,118,110,0.07);font-size:0.85em">'
        + '<b>ONE POSITION AT A TIME &mdash; ' + o.n + ' gold conviction'
        + (o.n === 1 ? ' is' : 's are') + ' live</b>, so new tickets are <b>HELD</b>. '
        + 'Cards keep their levels, gates and reasoning; none of them is hidden and no '
        + 'threshold moved.'
        + '<div style="margin-top:4px">This walk publishes <b>59.4 plans a day</b> on one '
        + 'instrument and holds <b>57 at once</b> &mdash; which is not 57 bets, it is one bet '
        + 'on gold at 57&times; size. Taken one at a time instead, the SCALP ticket book is '
        + '<b>+0.148R</b> at the conservative fill bound and <b>+0.416R</b> at the other, '
        + 'against <b>&minus;0.116R</b> for the all-at-once book. It is the only read in this '
        + 'desk&rsquo;s evidence that is positive at <b>both</b> bounds.</div>'
        + '<div style="margin-top:4px;opacity:.85">The limit, stated: at the conservative end '
        + 'that is n=73 at <b>+1.16&sigma;</b> &mdash; positive, <b>not significant</b>, and it '
        + 'clears no bar this desk applies to a mechanic. SWING disagrees between the two bounds '
        + '(&minus;0.240 / +0.317) and carries no verdict, so nothing is claimed for it. The '
        + 'concentration argument above stands without either. '
        + '<code>hgOgSetOneAtATime(false)</code> turns this off.</div>'
        + hgOgHoldingRowsHtml(o) + '</div>';
    }catch(e){ return ''; }
  }

  /* hg-v925 — the setter and the override, so the instruction is reversible
     without editing this file. Precedence matches the venue control's:
     window.HG_OG_EDGE_PROOF wins, then the stored choice, then the default. */
  function hgOgEdgeProofInit(){
    try{
      var w = W();
      var ovr = (w && w.HG_OG_EDGE_PROOF);
      if (ovr === true || ovr === false){ OG_EDGE_PROOF_REQUIRED = ovr; return OG_EDGE_PROOF_REQUIRED; }
      var stored = null;
      try { stored = localStorage.getItem(OG_EDGE_PROOF_LS_KEY); } catch (eL) { stored = null; }
      if (stored === '1' || stored === 'true') OG_EDGE_PROOF_REQUIRED = true;
      else if (stored === '0' || stored === 'false') OG_EDGE_PROOF_REQUIRED = false;
      else OG_EDGE_PROOF_REQUIRED = OG_EDGE_PROOF_DEFAULT;
    }catch(e){ OG_EDGE_PROOF_REQUIRED = OG_EDGE_PROOF_DEFAULT; }
    return OG_EDGE_PROOF_REQUIRED;
  }
  function hgOgSetEdgeProof(on){
    OG_EDGE_PROOF_REQUIRED = (on === true);
    try { localStorage.setItem(OG_EDGE_PROOF_LS_KEY, OG_EDGE_PROOF_REQUIRED ? '1' : '0'); } catch (eS) {}
    return OG_EDGE_PROOF_REQUIRED;
  }

  /* WHAT A TICKET FROM THIS DESK IS NOW WORTH.

     The relaxation is an instruction, not a finding, and the one thing that
     would make it dishonest is a ticket column that looks the same as one
     earned. hgOgEdgeProofPanelHtml explained an EMPTY column; this explains a
     FULL one. It renders whenever the gate is relaxed — there is no state in
     which the desk issues tickets on unproven mechanics and says nothing.

     Every number is from HG_OG_REPLAY_EVIDENCE and hgOgReplayZ at render
     time, not written in, so a re-bake moves them. */
  function hgOgEdgeRelaxedTally(){
    try{
      var E = HG_OG_REPLAY_EVIDENCE;
      if (!E || !E.kinds) return null;
      var famZ = hgOgFamilyZ(OG_MECHANICS.length), be = 1 / (1 + OG_T1_R);
      var rtP = fin(E.rtCostPct), rtX = 0.020;
      var clears = 0, fails = 0, unknown = 0, uN = 0, uW = 0, uG = 0, uXm = 0, k, r, z;
      for (k in E.kinds){
        if (!Object.prototype.hasOwnProperty.call(E.kinds, k)) continue;
        r = E.kinds[k]; z = hgOgReplayZ(r, be);
        if (!isFinite(z)) continue;
        if (z >= famZ){ clears++; continue; }
        if (z <= EDGE_VETO_Z){ fails++; continue; }
        unknown++;
        var n = fin(r[0]), win = fin(r[1]), gross = fin(r[3]), med = fin(r[4]);
        if (!(isFinite(n) && n > 0)) continue;
        uN += n; uW += win * n; uG += gross * n;
        /* re-price the fee leg only: the measured gross does not move with
           the venue, which is the whole hg-v533 correction */
        if (isFinite(med) && isFinite(rtP) && rtP > 0) uXm += (gross - med * (rtX / rtP)) * n;
      }
      if (!uN) return null;
      return { mechanics: OG_MECHANICS.length, famZ: famZ,
               clears: clears, fails: fails, unknown: unknown,
               unobserved: hgOgUnobservedKinds().length,
               n: uN, win: uW / uN, gross: uG / uN, netXm: uXm / uN,
               breakeven: be };
    }catch(e){ return null; }
  }

  function hgOgEdgeRelaxedPanelHtml(){
    try{
      if (OG_EDGE_PROOF_REQUIRED) return '';   /* nothing to disclose */
      var t = hgOgEdgeRelaxedTally();
      var sg = function(x, d){ return (x >= 0 ? '+' : '') + Number(x).toFixed(d); };
      var h = '<div class="note og-edge-relaxed" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #B45309;border-left:3px solid #B45309;border-radius:4px;'
        + 'background:rgba(180,83,9,0.07);font-size:0.85em">'
        + '<b>MEASURED-EDGE GATE RELAXED &mdash; BY INSTRUCTION, NOT BY EVIDENCE</b><br>'
        + 'This desk normally issues a ticket only for a mechanic whose edge has been '
        + 'measured. That requirement is switched off, so a mechanic whose record is '
        + '<b>UNKNOWN</b> can ticket again. No evidence was found for this and none is '
        + 'claimed &mdash; it was asked for, and it is recorded as asked for.';
      if (t){
        h += '<div style="margin-top:4px">Of <b>' + t.mechanics + '</b> registered mechanics: <b>'
          + t.clears + '</b> clear the ' + t.mechanics + '-comparison bar (+' + t.famZ.toFixed(2)
          + '&sigma;), <b>' + t.fails + '</b> fail it outright and <b>stay vetoed</b>, <b>'
          + t.unknown + '</b> are unknown and now ticket, and <b>' + t.unobserved
          + '</b> have no record at all and now ticket too.</div>'
          + '<div style="margin-top:4px">What that cohort measured over <b>'
          + hgOgFmtCount(Math.round(t.n)) + '</b> settled firings: win rate <b>'
          + (t.win * 100).toFixed(1) + '%</b> against a <b>' + (t.breakeven * 100).toFixed(1)
          + '%</b> breakeven at ' + OG_T1_R + 'R, gross <b>' + sg(t.gross, 4)
          + '</b>, net <b>' + sg(t.netXm, 4) + '</b> at XM. Below breakeven before costs. '
          + 'It is not significantly below either &mdash; that is precisely why it reads '
          + 'unknown &mdash; but it is not an edge, and a ticket here does not say it is.</div>';
      }
      h += '<div style="margin-top:4px;opacity:.9">The <b>known-failure veto is untouched</b>: '
        + 'a mechanic measured at or below ' + EDGE_VETO_Z + '&sigma; still cannot ticket. '
        + 'To put the requirement back for this browser, run '
        + '<code>hgOgSetEdgeProof(true)</code> in the console and rescan.</div></div>';
      return h;
    }catch(e){ return ''; }
  }

  function hgOgBlockerFunnelHtml(rows, opts){
    try{
      var t = hgOgCostCeilingScanTally(rows, opts);
      if (!t || t.tickets > 0 || !t.blockers.length) return '';
      var lead = t.blockers[0];
      var held = 0, bi;
      for (bi = 0; bi < t.blockers.length; bi++) held += t.blockers[bi].n;
      var pctOf = function(n){ return t.scanned > 0 ? Math.round(n / t.scanned * 100) : 0; };
      var h = '<div class="note og-blocker-funnel" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #64748B;border-left:3px solid #64748B;border-radius:4px;'
        + 'background:rgba(100,116,139,0.07);font-size:0.85em">'
        + '<b>WHY NOTHING TICKETED</b> &mdash; ' + t.scanned + ' plan'
        + (t.scanned === 1 ? '' : 's') + ' scanned, held back across '
        + t.blockers.length + ' hard gate' + (t.blockers.length === 1 ? '' : 's')
        /* named even when it is the ONLY gate that blocked: one blocker is
           the clearest possible answer to "why is my board empty", and
           leaving it unnamed there was the first draft of this line. */
        + (!t.topTie
            ? ' &middot; binding gate: <b>' + esc(t.topKey) + '</b> (' + pctOf(lead.n) + '%)'
            : ' &middot; no single binding gate &mdash; ' + lead.n
              + ' plans each on more than one')
        + '<div style="margin-top:4px">';
      for (bi = 0; bi < t.blockers.length; bi++){
        h += '<div style="display:flex;gap:8px;align-items:baseline">'
          + '<b style="min-width:3.2em;text-align:right">' + t.blockers[bi].n + '</b>'
          + '<span style="min-width:3em;color:#64748B">' + pctOf(t.blockers[bi].n) + '%</span>'
          + '<span>' + esc(t.blockers[bi].key) + '</span></div>';
      }
      h += '</div>';
      /* a plan usually fails several gates, so the counts do not add to the
         plan count and saying so stops a reader summing them */
      if (held > t.scanned){
        h += '<div style="margin-top:4px;opacity:.85">A plan can fail more than one gate, so '
          + 'these add to more than ' + t.scanned + '.</div>';
      }
      h += '</div>';
      return h + hgOgCostCeilingScanNoteHtml(rows, opts);
    }catch(e){ return ''; }
  }

  function hgOgCostCeilingScanNoteHtml(rows, opts){
    try{
      var t = hgOgCostCeilingScanTally(rows, opts);
      if (!t) return '';
      /* the claim is "the ceiling emptied THIS scan" — both halves required */
      if (t.tickets > 0 || !t.dominant) return '';
      var pct = function(a, b){ return b > 0 ? (a / b * 100).toFixed(0) + '%' : '—'; };
      var s = '<div class="note og-cost-emptied" style="margin:8px 0;padding:6px 8px;'
        + 'border:1px solid #B45309;border-left:3px solid #B45309;border-radius:4px;'
        + 'background:rgba(180,83,9,0.07);font-size:0.85em">'
        + '<b>THE COST CEILING EMPTIED THIS SCAN</b> &mdash; not a quiet market. '
        + 'Of <b>' + t.priceable + '</b> plan' + (t.priceable === 1 ? '' : 's')
        + ' this scan could price, the ' + esc(t.venue) + ' cost ceiling vetoed <b>'
        + t.vetoed + '</b> (' + pct(t.vetoed, t.priceable) + ') &mdash; more than any other '
        + 'gate, which is the only sense in which it is the reason the board is empty.';
      /* the honest denominator: only a sole-blocker plan is one the venue is
         withholding. Saying "vetoed 14" and letting a reader read that as
         "14 tickets lost" is the error this sentence exists to prevent. */
      s += ' <b>' + t.sole + '</b> of those had the ceiling as their <b>only</b> failing hard gate';
      if (t.sole === 0){
        s += ' &mdash; so every one of them fails something else too, and a cheaper venue '
          + 'would not have ticketed a single extra plan here.';
      } else if (isFinite(t.otherRt)){
        s += ', and re-priced at ' + esc(t.otherVenue) + ' (' + t.otherRt.toFixed(3)
          + '% round trip) <b>' + t.wouldClear + '</b> of them clear the same ceiling'
          + (t.wouldClear === 0
              ? ' &mdash; so the venue is not what is withholding them.'
              : '. That is what the venue setting is costing this scan, and nothing more: '
                + 'they would still have to pass every other gate they already pass.');
      } else {
        s += '.';
      }
      /* and what the rule is actually asking of a chart, per lane */
      var px = fin(t.px);
      if (!(isFinite(px) && px > 0)) px = null;
      var lines = [];
      for (var li = 0; li < 2; li++){
        var note = hgOgCostCeilingNote({ scalp: li === 0, px: px });
        if (note) lines.push(note);
      }
      if (lines.length){
        s += '<div style="margin-top:4px;opacity:.85">' + esc(lines.join(' · ')) + '</div>';
      }
      s += '<div style="margin-top:4px;opacity:.85">The ceiling is a ratio, so it asks a '
        + 'different width of the chart at every venue. Change the venue on this tab only '
        + 'if it is where you actually execute &mdash; the fail-closed preset is the '
        + 'conservative one, not the wrong one.</div></div>';
      return s;
    }catch(e){ return ''; }
  }

  function hgOgCostCeilingPanelHtml(opts){
    try{
      opts = opts || {};
      var E = HG_OG_REPLAY_EVIDENCE;
      var veto = E && E.costCeilingVeto;
      var px = fin(opts.px);
      var sc = hgOgCostCeilingDemand({ scalp: true, px: px });
      var sw = hgOgCostCeilingDemand({ scalp: false, px: px });
      if (!sc || !sw) return '';
      var here = String(sc.venue || '').toUpperCase();
      function row(d){
        var v = veto && veto[d.lane];
        var share = v && isFinite(fin(v[here])) ? fin(v[here]) : null;
        return '<tr><td style="padding:2px 8px 2px 0"><b>' + esc(d.lane) + '</b></td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right">' + d.ceilingR.toFixed(2) + 'R</td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right">&ge; ' + d.minStopPct.toFixed(3) + '%</td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right">'
            + (d.minStopUsd === null ? '<span class="dim">price unavailable</span>'
               : '$' + d.minStopUsd.toFixed(2)) + '</td>'
          + '<td style="padding:2px 0">'
            + (share === null ? '<span class="dim">not measured at this venue</span>'
               : 'vetoed <b>' + (share * 100).toFixed(1) + '%</b> of replay rows')
          + '</td></tr>';
      }
      return '<div class="og-costceil" style="font-size:11px;margin-top:8px;line-height:1.5">'
        + '<div style="font-weight:600">WHAT THE COST CEILING ASKS AT ' + esc(here || 'THIS VENUE') + '</div>'
        + '<div class="dim">The fee load in R is fixed by geometry alone: cost = round trip / stop width. '
        + 'So the ceiling is not a score, it is a minimum stop — and it moves with the venue, not the chart. '
        + 'At ' + esc(here || 'this venue') + ' the round trip is ' + sc.rtCostPct.toFixed(3) + '%.</div>'
        + '<table style="margin-top:4px;border-collapse:collapse"><tr class="dim">'
        + '<td style="padding:2px 8px 2px 0">lane</td>'
        + '<td style="padding:2px 8px 2px 0;text-align:right">ceiling</td>'
        + '<td style="padding:2px 8px 2px 0;text-align:right">min stop</td>'
        + '<td style="padding:2px 8px 2px 0;text-align:right">on live gold</td>'
        + '<td style="padding:2px 0">on the measured book</td></tr>'
        + row(sc) + row(sw) + '</table>'
        + (here === 'PAXG'
           ? '<div class="dim" style="margin-top:4px">PAXG is the fail-closed default. The same rule asks '
             + '0.133% (SCALP) and 0.067% (SWING) at XM, where it vetoed 16.4% and 0.1% instead. '
             + 'An empty scan here may be the venue rather than the tape.</div>'
           : '')
        + '<div class="dim" style="margin-top:4px">Whether a tighter stop buys better gross is NOT settled — '
        + 'the two ends of the fill-ambiguity interval give opposite slopes, because tight stops are the '
        + 'trades most likely to resolve on their own fill bar. Nothing here widens a stop or moves a ceiling.</div>'
        + '</div>';
    }catch(e){ return ''; }
  }

  /* hg-v922 — WHICH SIGNAL-TIME FACTOR ACTUALLY SEPARATES WINNERS, here.
     Re-derive: node scripts/factor-separation.mjs. Guard:
     tests/test-factor-separation.mjs re-runs it against the committed replay.

     Same bar as the GOLD SCALP twin in goldind.js: four DISJOINT windows must
     agree on win% AND gross AND net (hg-v920), at BOTH fill bounds (hg-v918),
     before a factor carries a verdict. Net alone never suffices, because
     costR = rtCostPct / stopPct exactly and so any stop-width split moves net
     by arithmetic alone; only the gross column speaks to the setups.

     TWO VERDICTS OUT OF TEN, AND ONE OF THEM IS BAD NEWS:

       stop >= 0.50%   +4.7 pts win, +0.0762 gross, +0.2128 net   4/4 both ends
       LIMIT order     -3.2 pts win, -0.0737 gross, -0.1025 net   0/4 both ends

     The limit row is the uncomfortable one, and it needs a caveat the other
     rows do not. A pending entry is unanimously WORSE in every window at both
     ends, across 4,988 of 8,132 settled rows. But THE LOWER BOUND IS NOT
     NEUTRAL FOR THIS PARTICULAR SPLIT: `ambiguousSameBarWin` is set only on a
     PENDING fill (457 of 4,988 limit rows, 5 of 269 stop rows, and 0 of 2,875
     market rows), because a market entry's touch never needs proving. So the
     lower bound demotes only one side of this comparison and its -12.2 pts is
     not independent evidence. The verdict rests on the as-recorded end, where
     the same 0/4 0/4 0/4 holds at -3.2 pts and -0.0737 gross — which is the
     conservative end here, and enough.
     Adverse selection is the OFFERED EXPLANATION, not a measured one: a
     resting order fills when price comes back to it, disproportionately when
     it is about to keep going. The competing explanation is the walk's own
     fill model, and nothing in this table separates the two. Nothing is
     changed on it either way: the alternative is a market fill, which pays
     the spread twice and is not what this measured.

     WHAT THE DESK RANKS BY REACHES NO VERDICT. tier STRONG is 2/4 and 3/4;
     confluence >= 50 is 1/4 at both ends; checksPass >= 4 is 2/4 at both. The
     score this desk sorts by is not separating outcomes in a way that survives
     four windows — which is the same finding the GOLD SCALP tally produced,
     on a different desk and a different book. Note tier FAIR: unanimously
     worse at the lower bound (0/4 0/4 0/4) but only 2/4 on GROSS at the
     as-recorded end, so by the both-ends rule it carries NO verdict. Reading
     the lower bound alone would have retired 77% of the book on one end of an
     interval hg-v918 built precisely to stop that.

     NO STOP THRESHOLD IS SHIPPED. The direction holds and a number does not:
     unanimity across the sweep runs 0.28 no, 0.40 no, 0.50 yes, 0.60 yes,
     0.80 no at the as-recorded end. And at 0.50% the book goes from -0.116R to
     -0.005R — from losing to flat, not to positive — while deleting 52% of its
     volume. Picking that bar would be choosing a number, not measuring one.
     hg-v919's cost ceiling stays exactly where it is. */
  var HG_OG_FACTOR_SEP = {
    windows: 4, rtPct: 0.02,
    book: { asRecorded: { n: 8132, win: 33.6, gross: -0.0222, net: -0.116 },
            lower:      { n: 8132, win: 28, gross: -0.1927, net: -0.2864 } },
    rows: [
      { f: 'tier STRONG', n: 1420, dWin: [4.5, 10], dGross: [0.0983, 0.2638], dNet: [0.1591, 0.3247],
        q: ['2/4 2/4 2/4', '3/4 3/4 4/4'], verdict: null },
      { f: 'tier FAIR', n: 6300, dWin: [-6.1, -10.6], dGross: [-0.1398, -0.2753], dNet: [-0.2068, -0.3423],
        q: ['0/4 2/4 0/4', '0/4 0/4 0/4'], verdict: null },
      { f: 'confluence>=50', n: 7720, dWin: [-8.8, -8.6], dGross: [-0.2129, -0.2083], dNet: [-0.2736, -0.269],
        q: ['1/4 1/4 1/4', '1/4 1/4 1/4'], verdict: null },
      { f: 'checksPass >= 4', n: 3431, dWin: [1.9, 0.7], dGross: [0.0674, 0.0295], dNet: [-0.006, -0.0439],
        q: ['2/4 2/4 2/4', '2/4 2/4 2/4'], verdict: null },
      { f: 'ticket', n: 1199, dWin: [1, -1.3], dGross: [0.0268, -0.0432], dNet: [0.0686, -0.0015],
        q: ['3/4 3/4 3/4', '3/4 1/4 3/4'], verdict: null },
      { f: 'horizon SCALP', n: 6409, dWin: [-0.5, -0.2], dGross: [-0.0392, -0.0323], dNet: [-0.1096, -0.1027],
        q: ['1/4 1/4 0/4', '2/4 2/4 0/4'], verdict: null },
      { f: 'dir long', n: 4183, dWin: [-6.6, -6.7], dGross: [-0.1772, -0.1807], dNet: [-0.1693, -0.1727],
        q: ['1/4 1/4 1/4', '1/4 1/4 1/4'], verdict: null },
      { f: 'LIMIT order', n: 4988, dWin: [-3.2, -12.2], dGross: [-0.0737, -0.3438], dNet: [-0.1025, -0.3726],
        q: ['0/4 0/4 0/4', '0/4 0/4 0/4'], verdict: 'worse' },
      { f: 'stop >= 0.28%', n: 5502, dWin: [2.5, 15.9], dGross: [0.029, 0.4295], dNet: [0.2216, 0.6222],
        q: ['3/4 2/4 4/4', '4/4 4/4 4/4'], verdict: null },
      { f: 'stop >= 0.50%', n: 3884, dWin: [4.7, 14.7], dGross: [0.0762, 0.3759], dNet: [0.2128, 0.5125],
        q: ['4/4 4/4 4/4', '4/4 4/4 4/4'], verdict: 'better' }
    ],
    bars: [{ bar: 0.28, n: 5502, holds: [false, true] },
           { bar: 0.4, n: 4580, holds: [false, true] },
           { bar: 0.5, n: 3884, holds: [true, true] },
           { bar: 0.6, n: 3263, holds: [true, true] },
           { bar: 0.8, n: 2357, holds: [false, true] }]
  };

  /* Renders every row, not the two with verdicts. Eight of ten reaching none
     IS the finding; a shortlist of winners would read as though the desk had
     found eight and shown the best two. */
  function hgOgFactorSepPanelHtml(sep){
    try{
      var T = sep || HG_OG_FACTOR_SEP;
      if (!T || !T.rows || !T.rows.length) return '';
      var sg = function(x, d){ return (fin(x) >= 0 ? '+' : '') + Number(x).toFixed(d); };
      var held = 0, judged = 0, body = '', i, r;
      for (i = 0; i < T.rows.length; i++){
        r = T.rows[i];
        if (r.thin) continue;
        judged++;
        if (r.verdict) held++;
        body += '<tr><td style="padding:2px 8px 2px 0"><b>' + esc(r.f) + '</b></td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right">n=' + r.n + '</td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right">' + sg(r.dWin[0], 1) + ' pts</td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right">' + sg(r.dGross[0], 4) + '</td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right">' + sg(r.dNet[0], 4) + '</td>'
          + '<td style="padding:2px 8px 2px 0;text-align:right;opacity:.75">' + esc(r.q[0]) + ' &middot; ' + esc(r.q[1]) + '</td>'
          + '<td style="padding:2px 0;text-align:right"><b>' + (r.verdict === 'better' ? 'HOLDS'
              : (r.verdict === 'worse' ? 'HOLDS (WORSE)' : '&mdash;')) + '</b></td></tr>';
      }
      var bars = [], k;
      for (k = 0; k < (T.bars || []).length; k++){
        bars.push(T.bars[k].bar.toFixed(2) + '% ' + (T.bars[k].holds[0] && T.bars[k].holds[1] ? 'holds' : 'no'));
      }
      return '<div class="og-panel og-factorsep" style="margin-top:10px">'
        + '<div><b>WHAT SEPARATES WINNERS</b> &mdash; ' + judged + ' signal-time factors on the '
        + T.book.asRecorded.n + ' settled replay rows (win ' + T.book.asRecorded.win.toFixed(1)
        + '%, gross ' + sg(T.book.asRecorded.gross, 4) + ', net ' + sg(T.book.asRecorded.net, 4)
        + ' re-priced at XM). A factor carries a verdict only when all ' + T.windows
        + ' <b>disjoint</b> windows agree on win rate AND gross AND net, at <b>both</b> fill bounds. '
        + '<b>' + held + ' of ' + judged + '</b> do.</div>'
        + '<table style="border-collapse:collapse;font-size:11px;margin-top:6px">' + body + '</table>'
        + '<div style="margin-top:6px;opacity:.8">Columns are the difference against the rest of the '
        + 'book at the as-recorded bound; the second-to-last is windows agreeing (win/gross/net) at '
        + 'each bound. <b>The score this desk sorts by reaches no verdict</b> &mdash; tier STRONG 2/4, '
        + 'confluence 1/4, checks 2/4. <b>tier FAIR is unanimous at the lower bound only</b>, so by the '
        + 'both-ends rule it carries none either; reading one end would have retired 77% of the book. '
        + '<b>The limit-order verdict rests on the as-recorded end alone</b>: the lower bound flags only '
        + 'PENDING fills as unprovable (457 of 4,988 limit rows, 0 of 2,875 market rows), so it demotes '
        + 'one side of that comparison and is not independent evidence for it. Adverse selection is the '
        + 'explanation offered, not a measured one &mdash; the walk&rsquo;s own fill model is the competing '
        + 'one and nothing here separates them. '
        + '<b>No stop threshold is shipped from this</b>: unanimity across the sweep runs ' + bars.join(', ')
        + ', and at 0.50% the book goes from ' + sg(T.book.asRecorded.net, 3) + 'R to -0.005R &mdash; '
        + 'losing to flat, not to positive &mdash; while deleting 52% of its volume.</div></div>';
    }catch(eFsep){ return ''; }
  }

  function hgOgSequentialCellsHtml(){
    try{
      var E = HG_OG_REPLAY_EVIDENCE;
      if (!E || !E.sequentialCells) return '';
      function rows(map, label){
        var out = '', k, v, lo, hi, agree;
        for (k in map){
          if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
          v = map[k]; lo = v && v.lo; hi = v && v.hi;
          if (!lo || !hi || !isFinite(fin(lo[2])) || !isFinite(fin(hi[2]))) continue;
          /* both ends below zero is the ONLY reading that counts as losing */
          agree = (lo[2] < 0 && hi[2] < 0);
          out += '<tr><td style="padding:2px 8px 2px 0"><b>' + esc(k) + '</b></td>'
            + '<td style="padding:2px 8px 2px 0;text-align:right">n=' + lo[0] + '</td>'
            + '<td style="padding:2px 8px 2px 0;text-align:right">'
              + (lo[2] >= 0 ? '+' : '') + lo[2].toFixed(3) + 'R</td>'
            + '<td style="padding:2px 8px 2px 0;text-align:right">n=' + hi[0] + '</td>'
            + '<td style="padding:2px 8px 2px 0;text-align:right">'
              + (hi[2] >= 0 ? '+' : '') + hi[2].toFixed(3) + 'R</td>'
            + '<td style="padding:2px 0">' + (agree ? '<b>loses at both ends</b>' : 'ends disagree — no verdict')
            + '</td></tr>';
        }
        return out ? ('<tr><td colspan="6" style="padding:6px 0 2px;font-weight:600">' + esc(label)
          + '</td></tr>' + out) : '';
      }
      var body = rows(E.sequentialCells, 'every plan formed, by horizon / tier')
               + rows(E.sequentialTicketHorizon, 'tickets only, by horizon');
      if (!body) return '';
      return '<div class="og-seqcells" style="font-size:11px;margin-top:8px;line-height:1.5">'
        + '<div style="font-weight:600">ONE POSITION AT A TIME — the book a person could actually hold</div>'
        + '<div class="dim">This walk forms 59.4 plans a day and holds 57 at once; every other table on '
        + 'this tab counts all of them. These rows take one plan when flat and hold it to its own exit. '
        + 'Each is shown at BOTH ends of the fill-ambiguity interval — 1,751 of 7,734 settled rows '
        + 'resolved on their own fill bar and OHLC cannot say whether the entry printed first. '
        + 'A cell is read as losing only when both ends agree, and none here does.</div>'
        + '<table style="margin-top:4px;border-collapse:collapse"><tr class="dim">'
        + '<td style="padding:2px 8px 2px 0">cell</td>'
        + '<td colspan="2" style="padding:2px 8px 2px 0;text-align:right">cautious end</td>'
        + '<td colspan="2" style="padding:2px 8px 2px 0;text-align:right">generous end</td>'
        + '<td style="padding:2px 0">reading</td></tr>' + body + '</table>'
        + '<div class="dim" style="margin-top:4px">Nothing on this tab is gated on these rows. '
        + 'Re-derive with <code>node scripts/omnigold-evidence-bake.mjs</code>.</div>'
        + '</div>';
    }catch(e){ return ''; }
  }

  function hgOgReplayLineHtml(kind){
    var ev = hgOgReplayEvidence(kind);
    if (!ev || !isFinite(fin(ev.winRate)) || !isFinite(fin(ev.avgNetR))) {
      /* measured-and-bad and never-measured used to render identically —
         as nothing at all. Only the second gets a line here. */
      return hgOgReplayBelowBarHtml(kind);
    }
    var netTxt = (ev.avgNetR >= 0 ? '+' : '') + ev.avgNetR.toFixed(2) + 'R';
    var h = '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">replay: '
      + (ev.winRate * 100).toFixed(0) + '% WR, ' + netTxt + ' net (n=' + ev.n + ')';

    /* The net above is the replay's own PAXG price. When the desk is set to
       a cheaper venue, say what the same record costs THERE — otherwise every
       mechanic is quoted 13x more expensive than the button next to it pays. */
    var rp = hgOgReplayNetAtVenue(ev);
    if (rp && rp.repriced){
      h += ' · <b>' + (rp.net >= 0 ? '+' : '') + rp.net.toFixed(2) + 'R at '
        + esc(rp.venue || 'venue') + '</b> (' + rp.venueRt.toFixed(3) + '% vs '
        + rp.replayRt.toFixed(2) + '% round trip)';
    }
    h += '</div>';

    /* hg-v917: AND THE GATE-CLEAR HALF, WHICH IS USUALLY WORSE.

       The line above is every firing of this detector across the walk, with
       its PAXG net re-priced to the venue. Re-pricing an unscoped population
       is not the same correction as measuring the scoped one, and the bake
       already did the second: sequentialBake.formedByKind, 54 of 54 kinds,
       what survived the 35-gate stack, netR_xm computed there.

       For 42 of the 54 that record is WORSE than the line above — PIN-REJECT
       reads -0.21R re-priced and -0.94R gate-clear, THREE-BAR -0.24R against
       -0.93R. Net-positive at XM goes from 12 kinds to 9, and 7 change sign.
       So this is not a softer number shown next to a harsh one; it is the
       harsher one, and it is the population the gates actually let through. */
    var fm = ev.formed;
    if (fm && isFinite(fin(fm.n)) && fin(fm.n) > 0 && isFinite(fin(fm.netXm))){
      h += '<div class="dim og-replay-line og-replay-formed" style="font-size:11px;margin-top:2px">'
        + 'gate-clear: ' + (fm.winRate * 100).toFixed(0) + '% WR, <b>'
        + (fm.netXm >= 0 ? '+' : '') + fm.netXm.toFixed(2) + 'R at XM</b> (n=' + fm.n + ')'
        + ' — the rows that cleared the gate stack';
      /* THE COMPARISON IS ONLY MADE WHEN THERE IS SOMETHING TO COMPARE TO.
         The line above is only re-priced to XM when the desk has a venue
         preset; without one there is no XM figure on it, and the first cut of
         this said 'better than the line above' in exactly that case — a
         comparative claim with nothing on the other side of it. Absent stays
         absent: no venue, no verdict, just the record. */
      var shownXm = fin(rp && rp.repriced ? rp.net : NaN);
      if (isFinite(shownXm)){
        h += ', which is ' + (fm.netXm < shownXm ? 'WORSE than'
             : (fm.netXm > shownXm ? 'better than' : 'the same as')) + ' the line above';
      }
      h += '</div>';
    }

    /* A positive number is where self-deception starts, so the verdict goes
       on the same card: does it clear its own breakeven, and does it still
       clear once you account for having ranked the whole family? */
    var vd = hgOgReplayEdgeVerdict(ev);
    if (vd){
      var beTxt = 'breakeven ' + (vd.breakeven * 100).toFixed(0) + '% at '
        + vd.impliedR.toFixed(2) + 'R · Wilson lo ' + (vd.lo95 * 100).toFixed(0) + '%';
      var verdict, cls;
      if (vd.tier === 'family'){
        verdict = 'edge holds even against ' + vd.family + ' mechanics tested';
        cls = 'og-replay-edge-ok';
      } else if (vd.tier === 'naive'){
        verdict = 'clears breakeven at 95%, but ~' + vd.expectedByChance.toFixed(1)
                + ' of ' + vd.family + ' do so by chance — not a selection you can trust';
        cls = 'og-replay-edge-noise';
      } else {
        verdict = 'lower bound does not clear its own breakeven — no measured edge';
        cls = 'og-replay-edge-none';
      }
      h += '<div class="dim og-replay-edge ' + cls + '" style="font-size:10px;margin-top:1px">'
        + esc(beTxt + ' · ' + verdict) + '</div>';
    }
    h += hgOgDirSiblingLineHtml(kind, ev);
    return h;
  }

  /* THE OTHER HALF OF THE SAME DETECTOR, ON THE SAME CARD.

     A SPRING card quoting 19% and a UTAD card quoting 38% are the same
     function measured on its two sides, and a reader seeing one of them has
     no way to know the other exists. That asymmetry is the most interesting
     thing this walk found and it was invisible on the surface that matters.

     Shown as CONTEXT, not as a recommendation: the gap is real in sign
     across every bound but nowhere near a family-wise bar, so the line says
     what the two records are and stops. Nothing here changes a gate — the
     card's own verdict above is computed on its own record alone. */
  function hgOgDirSiblingLineHtml(kind, selfEv){
    try {
      var sib = hgOgDirSibling(kind);
      if (!sib) return '';
      var sEv = hgOgReplayEvidence(sib.kind);
      if (!sEv || !isFinite(fin(sEv.winRate))) return '';
      if (!selfEv || !isFinite(fin(selfEv.winRate))) return '';
      return '<div class="dim og-replay-dirsplit" style="font-size:10px;margin-top:1px">'
        + esc('same detector, other side: ' + sib.kind + ' (' + sib.side + ') '
            + (sEv.winRate * 100).toFixed(0) + '% on n=' + sEv.n + ' vs this side\'s '
            + (selfEv.winRate * 100).toFixed(0) + '% on n=' + selfEv.n
            + ' — the halves are judged separately because they differ; '
            + 'the gap is consistent in sign but not established')
        + '</div>';
    } catch (e) { return ''; }
  }

  /* ENGINE pick annotations. Grade A/B used to carry what was called the
     replay's one genuinely positive finding, the selection ordering; that
     is read from the bake now (hgOgGradeOrder) rather than stated, because
     the bake it was measured on is gone and the line was rendering
     "0% WR (n=1) — selection edge real" — its own refutation, in one
     sentence, with the n already in it. A SCALP-horizon
     pick whose fee tier is heavy/fatal gets the cohort caution too, read
     from the bake by hgOgCohortClaim rather than quoted here. The figures
     that used to be quoted here were a pre-v699 bake's and were still
     being printed long after it was replaced. '' when the grade has no
     record; never a throw. */
  function hgOgEngineReplayLinesHtml(pick, horizon){
    if (!pick) return '';
    var h = '';
    var g = pick.engineGrade || ((typeof pick.grade === 'string') ? pick.grade : '');
    g = String(g || '').toUpperCase();
    if (g === 'A' || g === 'B'){
      var demoted = !!(pick.engineDemoted || pick.demoted);
      /* THIS LINE PRINTED ITS OWN REFUTATION: '0% WR (n=1) — selection
         edge real'. The n was already right there and nothing read it. */
      var gc = hgOgCohortClaim(g + (demoted ? '-DEMOTED' : ''));
      var rec = hgOgClaimRecordTxt(gc, { n: true });
      if (rec){
        h += '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">replay: grade-'
          + g + (demoted ? ' (demoted)' : '') + ' ' + esc(rec) + ' — '
          + esc(hgOgGradeOrderTxt(true)) + '</div>';
      }
    }
    var hz = String(horizon || pick.horizon || '').toUpperCase();
    if (hz === 'SCALP'){
      var d = hgOgCostDrag(pick);
      if (d && (d.tier === 'heavy' || d.tier === 'fatal')){
        /* BOTH HALVES OF THE OLD LINE WERE LITERALS. '-2.6' came from a
           cohort with no row in this bake, and 'swing geometry survived
           (PF 0.90)' quoted a profit factor this file's own evidence
           object sets to null on n=3. A three-trade cohort did not
           survive anything. */
        var sc = hgOgCohortClaim('ENGINE:SCALP');
        if (sc.missing) sc = hgOgCohortClaim('SCAN:SCALP');
        var scNet = hgOgCohortNetTxt(sc, 1);
        var sw = hgOgCohortClaim('ENGINE:SWING');
        var swNet = hgOgCohortNetTxt(sw, 1), swN = hgOgCohortNTxt(sw, true);
        var bits = [];
        if (scNet) bits.push('scalp cost drag ' + scNet + ' on the ' + sc.key + ' cohort');
        if (swNet) bits.push('swing geometry ' + swNet + hgOgCohortPfTxt(sw)
                             + (swN ? ' (' + swN + ')' : ''));
        if (bits.length){
          h += '<div class="dim og-replay-line" style="font-size:11px;margin-top:2px">replay: '
            + esc(bits.join(' — ')) + '</div>';
        }
      }
    }
    return h;
  }

  /* One muted footnote where the confluence legend renders. The replay's
     honest answer on the aggregate score: test AUC 0.5044, no monotonic
     decile ranking — so the legend's tiers are a checklist of agreement,
     not a probability. (hg-v910: this comment read 0.4924, a figure from a
     replaced generation of the bake. The RENDERED footnote was never wrong —
     it reads fit.testAUC off HG_OG_REPLAY_EVIDENCE, which already carried
     0.5044 — so what drifted was the prose beside the code, not the card.) If a future refit flips the baked verdict to
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
     replay rows (n >= 50 so mid-sample losers cannot hide under n<100):
       grossR <= -0.05          direction measured wrong at scale, costs aside
       venue-adj netR <= -0.5   still toxic after re-pricing fees at the venue
     venue-adjusted netR = avgGrossR - (venueRt / 0.26) * (avgGrossR - avgNetR):
     the kind's MEAN fee load was measured at the 0.26% PAXG round trip,
     so a venue's fee load is that mean scaled by the round-trip ratio;
     gross outcomes are measured facts and are NOT rescaled. This used the
     MEDIAN fee, which understated the drag on every skewed kind and so
     demoted fewer than the record supports — 31 rather than 37 at PAXG.
     See hgOgVenueNet. */
  var HG_OG_DEMOTE_MIN_N = 50;
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
    /* one arithmetic, one place — see hgOgVenueNet */
    return hgOgVenueNet(row.avgGrossR, row.avgNetR,
                        fin(venueCost && venueCost.rtCostPct),
                        HG_OG_REPLAY_EVIDENCE.rtCostPct);
  }

  /* Demotion verdict for ONE kind at the given (or active) venue.
     null = not demoted (including: no baked row, or n < 100 — demotion is an
     evidence claim and only measured evidence can make it).
     Else { kind, n, winRate, grossR, paxgNetR, medCostR, venueNetR, venue,
            reasons[] }. */
  function hgOgKindDemotion(kind, venueCost){
    try{
      /* NO HORIZON EXEMPTION HERE. Until this repair the first line was
         `if (hgOgSwingPrefer(kind, horizon)) return null;`, which returned
         BEFORE hgOgReplayEvidence was read — so hgOgFormation never
         computed a demotion for a SWING-prefer kind and therefore never
         called hgOgForwardPaid on it. Measured-negative kinds
         (RIBBON-PULLBACK grossR -0.093 at n=102, NR7-BREAK grossR -0.102
         at n=143) formed tradable SWING cards with no evidence check at
         all, while every other demoted kind had to show a live 'has paid'
         forward ledger to be un-demoted. HG_OG_SWING_PREFER carries no
         per-horizon replay row, so the "paid net+ on 4h" claim was not
         traceable to the baked source either.
         The list stays exactly what its own comment says — ranking / score
         only (hgOgDeskOrder's surv(), hgOgBalanceScore's
         'swing-replay-prefer' bonus). A SWING-prefer kind that genuinely
         paid on the 4h desk is still exempted, through the SAME
         hgOgForwardPaid(kind, 'SWING') check hgOgFormation applies to
         everything else — measured live evidence, not a hand-kept list.
         Dropping the horizon argument also makes hgOgDemotedKindCount's
         banner figure describe what every desk actually applies. */
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
          + ' x meanCostR '
          + (fin(ev.avgGrossR) - fin(ev.avgNetR)).toFixed(3) + ')');
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
     bake: 18 at XM (~0.020% RT), 33 at PAXG (0.26% RT) after n-floor 100→50
     (hg-v589: mid-sample losers such as PDL-SWEEP / ER-IGNITION / ASIA-BREAK
     can no longer hide under n<100). No kind is exempt by name: a demoted
     kind clears only through hgOgForwardPaid in hgOgFormation, so this
     count describes exactly what every desk applies. */
  function hgOgDemotedKindCount(venueCost){
    var vc = (venueCost && isFinite(fin(venueCost.rtCostPct))) ? venueCost : hgOgVenueCost();
    /* DISTINCT MECHANICS, like hgOgReplayFamilySize: counting both labels of
       an aliased pair would report one demoted mechanic as two. SPRING and
       UTAD are NOT such a pair — hg-v764 un-pooled them so each direction
       keeps its own record, and OG_KIND_ALIAS has been empty since — so
       this loop is a no-op today and is kept for the next alias that is
       added, not for those two. */
    var kinds = HG_OG_REPLAY_EVIDENCE.kinds, k, n = 0, seen = {};
    for (k in kinds){
      if (!Object.prototype.hasOwnProperty.call(kinds, k)) continue;
      var canon = Object.prototype.hasOwnProperty.call(OG_KIND_ALIAS, k) ? OG_KIND_ALIAS[k] : k;
      if (seen[canon]) continue;
      seen[canon] = 1;
      if (hgOgKindDemotion(canon, vc)) n++;
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
  /* SWING-horizon kinds that paid net+ in the 7,270-trade replay with
     n>=15. Ranking / score only — never invents a ticket. SCALP must not
     inherit this list (same names lose on 1h). */
  var HG_OG_SWING_PREFER = [
    'BOS-RETEST', 'INSIDE-BREAK', 'RIBBON-PULLBACK',
    'STRUCT-BOS', 'NR7-BREAK', 'AVWAP-RECLAIM'
  ];
  function hgOgSwingPrefer(kind, horizon){
    if (String(horizon || '').toUpperCase() !== 'SWING') return false;
    if (kind === null || kind === undefined) return false;
    var key = String(kind).toUpperCase().replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    return HG_OG_SWING_PREFER.indexOf(key) >= 0;
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
         demotion and the forward evidence, shown on the card. This is the
         ONLY route out of a demotion; no name list exempts a kind.
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
    /* hg-v700: float tolerance at the bar. Producers now mint stops AT the
       venue floor (og1 hg-v700 mint floor; entry×rt/0.125/100 exactly), and
       rt/stopPct at that boundary divides to 0.12500000000000003 — strictly
       greater than 0.125 in floats — which stood aside the very cards the
       floor was composed for (replay caught 2,826 boundary stand-asides). A
       stop AT the bar is AT the bar. */
    if (drag && fin(drag.costR) > HG_OG_FORM_COST_R_MAX * (1 + 1e-9)){
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
          /* hg-v916: say what the suppression withholds on today's population,
             not only the whole-replay figure the row was baked from. */
          if (probe.edge && probe.edge.liveWhy) out.reasons.push(probe.edge.liveWhy);
        } else if (probe.demoted && probe.edge && probe.edge.action === 'demote'){
          /* Demote paints and ranks below survivors — unlike suppress it is not
             a formation kill. ORB/HVN/ribbon are fee-weak, not geometry-broken. */
          out.edgeDemote = probe.edge;
          out.reasons.push(probe.edge.why || 'gold setup edge demote');
          if (probe.edge.liveWhy) out.reasons.push(probe.edge.liveWhy);
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

  /* WATCH SECTION (hg-v698). Setups that fired, cleared the venue floor and
     the measured-evidence checks, and are short ONLY of the shared
     >=3-distinct-class confluence bar. Nothing here is measured-negative and
     nothing here is hidden: each row names the classes that DID confirm and
     the class that is missing, so the reader knows exactly what would turn it
     into a ticket. Still no entry/stop/target — a level on a card the desk
     has declined to call tradable is an invitation. */
  /* THE ONE PREDICATE that separates "not yet" from "measured losing".
     It was written out three times (section partition, status tally, and
     nowhere at all in the collapsed wrapper, which is how the wrapper came
     to call every stood-aside card measured-negative). One function, so the
     three places cannot disagree about what a WATCH card is. */
  function hgOgIsWatchOnly(f){
    return !!(f && (f.confluenceShort === true || f.confluenceUnavailable === true)
      && !f.kindDemotion && !f.stopFloor && !f.catalogExclude && !f.edgeSuppress);
  }
  function hgOgStoodAsideSplit(cards){
    var watch = [], neg = [], i;
    for (i = 0; i < (cards || []).length; i++){
      if (!cards[i]) continue;
      if (hgOgIsWatchOnly(cards[i].formation)) watch.push(cards[i]);
      else neg.push(cards[i]);
    }
    return { watch: watch, neg: neg };
  }

  function hgOgWatchSectionHtml(cards){
    if (!cards || !cards.length) return '';
    var w = W();
    var htmlFn = (w && typeof w.hgGoldConfluenceHtml === 'function') ? w.hgGoldConfluenceHtml : null;
    var h = '<details class="note og-watch-confluence" data-og-watch="1" style="margin-top:12px">';
    h += '<summary style="cursor:pointer"><b>WATCH — short of the confluence bar</b> ('
      + cards.length + ' setup' + (cards.length === 1 ? '' : 's')
      + ', not tickets yet)</summary>';
    h += '<div class="dim" style="margin:8px 0;font-size:0.85em">A gold setup becomes a tradable card only with '
      + '<b>&ge; 3 independent confirmations on the closed bar from distinct classes</b> '
      + '(structure · momentum · participation · session/HTF). One class counts once however many reads inside it agree. '
      + 'These fired and are on the record; they are NOT tradable and no levels print. '
      + 'The missing class is named on each row.</div>';
    var i, c, cf;
    for (i = 0; i < cards.length; i++){
      c = cards[i];
      if (!c) continue;
      h += '<div class="og-watch-row" style="margin:6px 0;font-size:0.85em">'
        + '<b>' + esc(String(c.horizon || '') + ' · ' + String(c.kind || '?') + ' '
                     + String(c.dir || '').toUpperCase()) + '</b>';
      cf = c.formation && c.formation.confluence;
      if (cf && htmlFn) h += htmlFn(cf);
      else if (cf) h += '<div class="dim">' + esc(cf.why || '') + '</div>';
      else h += '<div class="dim">' + esc((c.formation && c.formation.reasons || []).join(' · ')) + '</div>';
      h += '</div>';
    }
    h += '</details>';
    return h;
  }

  /* The stood-aside section: every setup that fired but did NOT form.
     Collapsed, listed with each kind's replay row — n, WR, grossR,
     venue-net — and the formation reason. NO entry/stop/target renders
     here, deliberately: a level on a measured-negative card is an
     invitation. */
  function hgOgDemotedSectionHtml(cards){
    if (!cards || !cards.length) return '';
    var vc = hgOgVenueCost();
    /* hg-v698: a card can leave the tradable list for two DIFFERENT reasons,
       and calling both "measured-negative" is a lie about one of them.
         WATCH             the evidence is fine as far as it goes, it is just
                           short of the >=3-distinct-class confluence bar.
                           The missing class is named; nothing is measured
                           against this kind.
         MEASURED-NEGATIVE the replay / venue floor / catalog stood it aside.
       They render in separate blocks so a reader can tell "not yet" from
       "measured losing". */
    var __split = hgOgStoodAsideSplit(cards);
    var watchCards = __split.watch, negCards = __split.neg;
    var h = '';
    if (watchCards.length) h += hgOgWatchSectionHtml(watchCards);
    if (!negCards.length) return h;
    cards = negCards;
    h += '<details class="note og-demoted-kinds" data-og-demoted="1" style="margin-top:12px">';
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
    var tabs = hgOgFwdTabsFor(horizon);
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
          avgRr: fin(t.avgRr),
          wilson: hgOgWilsonHit(t.wins, t.samples),
          wilsonFam: hgOgWilsonHit(t.wins, t.samples, hgOgPromotionZ())
        };
      }
    }
    /* PRECEDENCE BY SPECIFICITY, NEVER SELECTION BY OUTCOME.

       Three populations can answer for a row: this mechanic's own pooled
       TICKET record, the desk-wide scalp pool, and the scorecard's gold log
       — and the last two are not about this mechanic at all. The rule used
       to be "whichever has the highest Wilson lower bound wins". That is
       picking the most flattering population and then testing it against a
       fixed 95% bar, and it broke in both directions. Driven, both:

         PROMOTION. A mechanic whose own record is 5/20 — lower bound 0.11,
         a demonstrably bad mechanic — read 95% SETTLED EXECUTE true and 90%
         SCALP VERDICT true off a 294/300 scorecard record. The panel headed
         "PROVEN EDGE · FORWARD-TESTED" showed a setup whose own forward
         evidence said the opposite.

         DEMOTION. A mechanic with a real edge — 20/30 at avgRr 2.0, lower
         bound 0.488 against a 0.333 breakeven, clearing by 15.4 points —
         read PROVEN EDGE false once a 32/40 scorecard record outscored it
         on RAW HIT RATE. The scorecard carries no avgRr, so the swap took
         the reward multiple with it and hgOgProvenEdgeOk had no breakeven
         left to test against.

       That second one is the same error hgOgEdgeMargin exists to prevent,
       pointed at the evidence rather than at the ranking: "a mechanic with
       a smaller hit rate but a bigger payoff can carry more edge than a
       higher-hit one". Raw hit rate is not comparable across payoffs, and
       choosing BETWEEN populations on it is exactly that comparison.

       So the order is fixed in advance and does not look at the numbers:
       the mechanic's own record whenever it has one worth the name, then
       the desk pool, then the scorecard. A fallback is marked specific
       false and says so on the card, because a record about other setups is
       not this setup's record even when it is the best available. */
    /* `specific` is about the POPULATION, not the sample size: the mechanic's
       own record is its own record at three trades as much as at three
       hundred. Thinness is what triggers a fallback; it is not what makes a
       record someone else's. Conflating the two had the card telling a
       reader that a thin ROUND-MAGNET record was "not this mechanic's own"
       when it was exactly that. */
    if (out) out.specific = true;
    var thin = !out || fin(out.samples) < OG_VERDICT_MIN_N;

    if (thin && horizon === 'SCALP'){
      var desk = hgOgMergeSettledEvidence(OG_SCALP_FWD_TABS, null, row.dir);
      if (desk && desk.wilson){
        desk.source = 'desk-pool · ' + desk.source;
        desk.specific = false;
        desk.fallbackFor = mechanic;
        if (!out || fin(desk.samples) > fin(out.samples)) out = desk;
      }
    }
    if (thin && !(out && out.specific === false)){
      var sc = hgOgScorecardGoldEvidence(row.dir);
      if (sc && sc.wilson && (!out || fin(sc.samples) > fin(out.samples))){
        sc.specific = false;
        sc.fallbackFor = mechanic;
        out = sc;
      }
    }
    return out;
  }

  /* One sentence naming the population, for the two evidence panels. A
     fallback row is headed by a mechanic's name and then quotes a record
     that is not that mechanic's; the reader should not have to decode a
     source string to notice. */
  function hgOgEvidenceScopeTxt(ev){
    if (!ev) return '';
    if (ev.specific) return '';
    return ' — NOT this mechanic\'s own record'
         + (ev.fallbackFor ? (': ' + String(ev.fallbackFor) + ' is below the '
            + OG_VERDICT_MIN_N + '-trade minimum, so the wider gold log is shown in its place') : '');
  }

  /* A TIER IS A CLAIM ABOUT THIS MECHANIC, SO IT NEEDS THIS MECHANIC'S
     RECORD. Fallback evidence — the desk-wide scalp pool, the scorecard's
     gold log — is worth showing a reader when a mechanic is too thin to
     speak for itself, and hgOgSettledEvidence still shows it. It cannot
     PROMOTE: the panel is headed "PROVEN EDGE · FORWARD-TESTED" and the
     verdict says "this scalp setup's settled TICKET record", and a record
     about other setups is neither of those however good it looks.

     This is not a narrow case on this desk. The gold book's mechanics hold
     single-digit samples each, so before this every one of them was eligible
     to be promoted on the aggregate rather than on itself. */
  function hgOgSettledExecuteOk(ev, minLo, minN){
    if (!ev || !ev.wilson) return false;
    if (ev.specific === false) return false;
    var b = hgOgEvBound(ev);
    if (!b) return false;
    minLo = isFinite(fin(minLo)) ? fin(minLo) : OG_EXEC_WILSON_LO;
    minN = isFinite(fin(minN)) ? fin(minN) : OG_EXEC_MIN_N;
    return fin(ev.samples) >= minN && b.lo >= minLo;
  }

  /* The hit rate a plan needs just to break even at the reward multiple its
     winners actually carried. NaN when avgRr is unknown or non-positive —
     there is no breakeven to quote, and a fabricated one would promote a
     losing mechanic. */
  function hgOgBreakevenHit(avgRr){
    var r = fin(avgRr);
    if (!(r > 0)) return NaN;
    return 1 / (1 + r);
  }

  /* PROVEN EDGE: profitable at 95% confidence — the Wilson lower bound sits
     above breakeven by a real margin, on enough settled trades. */
  function hgOgProvenEdgeOk(ev, minN, margin){
    if (!ev || !ev.wilson) return false;
    if (ev.specific === false) return false;   /* see hgOgSettledExecuteOk */
    minN = isFinite(fin(minN)) ? fin(minN) : OG_EDGE_MIN_N;
    margin = isFinite(fin(margin)) ? fin(margin) : OG_EDGE_MARGIN;
    var be = hgOgBreakevenHit(ev.avgRr);
    if (!isFinite(be)) return false;
    var b = hgOgEvBound(ev);
    if (!b) return false;
    return fin(ev.samples) >= minN && b.lo >= (be + margin);
  }

  /* How far the lower bound clears breakeven. The honest ranking key: a
     mechanic with a smaller hit rate but a bigger payoff can carry more edge
     than a higher-hit one, and this is what says so. NaN when unknowable. */
  function hgOgEdgeMargin(ev){
    if (!ev || !ev.wilson) return NaN;
    var be = hgOgBreakevenHit(ev.avgRr);
    if (!isFinite(be)) return NaN;
    /* the margin against the bar that DECIDES, not against the one on
       display — a card reading "clears breakeven by 15.4 pts" next to a
       mechanic the corrected bar rejects would be the ranking and the
       verdict disagreeing in public */
    var b = hgOgEvBound(ev);
    if (!b) return NaN;
    return b.lo - be;
  }

  function hgOgPickSettledExecutes(ranked, tapeDir, opts){
    opts = opts || {};
    var minLo = opts.minWilsonLo != null ? opts.minWilsonLo : OG_EXEC_WILSON_LO;
    var minN = opts.minN != null ? opts.minN : OG_EXEC_MIN_N;
    var edgeN = opts.edgeMinN != null ? opts.edgeMinN : OG_EDGE_MIN_N;
    var edgeMargin = opts.edgeMargin != null ? opts.edgeMargin : OG_EDGE_MARGIN;
    tapeDir = String(tapeDir || '').toLowerCase();
    var execute = [], proven = [], pool = [], i, c, ev;
    for (i = 0; i < (ranked || []).length; i++){
      c = ranked[i];
      if (!c || !(c.grade && c.grade.ticket) || !c.plan) continue;
      if (tapeDir === 'long' || tapeDir === 'short'){
        if (String(c.dir || '').toLowerCase() !== tapeDir) continue;
      }
      ev = hgOgSettledEvidence(c);
      c.settledEv = ev;
      /* A setup can sit in BOTH tiers: near-certainty is a strict superset of
         proven edge whenever the reward multiple is known, and the panel wants
         to show it under the bar it actually trades as well as the ceiling. */
      if (hgOgSettledExecuteOk(ev, minLo, minN)) execute.push(c);
      if (hgOgProvenEdgeOk(ev, edgeN, edgeMargin)) proven.push(c);
      else if (ev && ev.wilson && !hgOgSettledExecuteOk(ev, minLo, minN)) pool.push(c);
    }
    /* Ranked by how far the lower bound clears breakeven, so a lower-hit,
       bigger-payoff mechanic can legitimately outrank a higher-hit one. */
    proven.sort(function(a, b){
      return (hgOgEdgeMargin(b.settledEv) - hgOgEdgeMargin(a.settledEv))
          || (b.settledEv.samples - a.settledEv.samples);
    });
    pool.sort(function(a, b){
      return (b.settledEv.wilson.lo - a.settledEv.wilson.lo)
          || (b.settledEv.samples - a.settledEv.samples);
    });
    return { execute: execute, proven: proven, best: pool.slice(0, 2),
             minLo: minLo, minN: minN, edgeMinN: edgeN, edgeMargin: edgeMargin };
  }

  /* WHICH CONSTRAINT ACTUALLY BINDS.

     The below-the-bar line asserted one blocker unconditionally:

       "clears breakeven by 3.8 pts, below the 25-trade minimum"

     printed on a row carrying 63 trades. It was true when the sample
     minimum was the only thing between a positive margin and a promotion.
     Packs 834, 835 and 836 each added another — the population must be this
     mechanic's own, the bound is corrected for the 78-mechanic family, and
     it is deflated by the record's measured overlap — so a row can now fail
     for four different reasons and the card named whichever one was written
     into the template.

     The result was a sentence contradicting itself: that same row went on to
     say "NOT this mechanic's own record", which was the real blocker, two
     clauses after claiming the sample minimum was.

     So the reason is COMPUTED, by walking the tier's own gates in the order
     the tier applies them, and the last branch says plainly that nothing is
     blocking rather than inventing a fifth reason — if that ever renders,
     the row and the gate disagree and the card should say so rather than
     cover for it. */
  function hgOgTierBlock(ev, minN, margin){
    /* TWO TIER SHAPES, ONE WALK. PROVEN EDGE tests the bound against this
       mechanic's OWN breakeven; the 95% EXECUTE and 90% SCALP VERDICT tiers
       test it against a fixed rate. Same gates in the same order up to the
       last one, so an options object picks which final test applies rather
       than a second copy of the walk drifting from this one. */
    var minLo = NaN;
    if (minN && typeof minN === 'object'){
      minLo = fin(minN.minLo);
      margin = isFinite(fin(minN.margin)) ? fin(minN.margin) : margin;
      minN = minN.minN;
    }
    if (!ev || !ev.wilson) return { key: 'no-record', txt: 'no settled record yet' };
    minN = isFinite(fin(minN)) ? fin(minN) : OG_EDGE_MIN_N;
    margin = isFinite(fin(margin)) ? fin(margin) : OG_EDGE_MARGIN;
    if (ev.specific === false){
      /* terse on purpose: hgOgEvidenceScopeTxt renders straight after this
         on the same line and names the mechanic and the minimum it missed,
         so spelling it out twice would be two clauses saying one thing */
      return { key: 'population', txt: 'the population it is measured on' };
    }
    var be = NaN;
    if (!isFinite(minLo)){
      /* a breakeven tier: with no reward multiple there is no bar to clear */
      be = hgOgBreakevenHit(ev.avgRr);
      if (!isFinite(be)){
        return { key: 'breakeven', txt: 'no winner has reported its R, so there is no breakeven to clear' };
      }
    }
    var n = fin(ev.samples);
    if (!(n >= minN)){
      return { key: 'samples',
               txt: hgOgFmtCount(isFinite(n) ? n : 0) + ' of the ' + minN + ' settled trades this tier needs' };
    }
    var b = hgOgEvBound(ev);
    if (!b) return { key: 'no-record', txt: 'no usable bound' };
    var target = isFinite(minLo) ? minLo : (be + margin);
    var gap = b.lo - target;
    if (!(gap >= 0)){
      /* THE CORRECTED BOUND, named as such. The card prints the 95% interval
         beside this, and on a row whose displayed lower bound is 92% a bare
         "below 90% lower bound" reads as a contradiction rather than as a
         different bar — which is what it is. */
      return { key: 'bound',
               txt: (Math.abs(gap) * 100).toFixed(1) + ' pts short of '
                    + (isFinite(minLo) ? ((minLo * 100).toFixed(0) + '%') : 'breakeven')
                    + ' at the corrected bar (' + (b.lo * 100).toFixed(0) + '% against the '
                    + (ev.wilson.lo * 100).toFixed(0) + '% shown)'
                    + (hgOgOverlapKnown(ev) && fin(ev.overlapRatio) < 1
                        ? ', on ' + fin(ev.effSamples).toFixed(1) + ' effective trades' : '') };
    }
    return { key: 'none', txt: 'nothing is blocking it — this row and the tier gate disagree' };
  }

  function hgOgSettledExecuteRowHtml(c, tier){
    var p = c.plan, ev = c.settledEv;
    var w = ev && ev.wilson;
    var pct = w ? (w.p * 100).toFixed(0) : '—';
    var lo = w ? (w.lo * 100).toFixed(0) : '—';
    var hi = w ? (w.hi * 100).toFixed(0) : '—';
    /* hg-v729: SMC context chip — '' when the helper or c.smc is absent. */
    var smcChipSe = '';
    try {
      var smcChipFnSe = gfn('hgSmcChipHtml');
      if (smcChipFnSe) smcChipSe = smcChipFnSe(c) || '';
    } catch (eSmcSe) { smcChipSe = ''; }
    var h = '<div class="og-settled-row' + (tier === 'execute' ? ' og-settled-exec' : '')
          + (tier === 'proven' ? ' og-settled-proven' : '') + '">';
    h += '<div class="hg-mp-head">XAUUSD ' + esc(String(c.dir || '').toUpperCase())
      + ' <span>' + esc(c.horizon) + ' · ' + esc(c.kind) + ' · TICKET'
      + (smcChipSe ? ' ' + smcChipSe : '') + '</span></div>';
    /* Breakeven is what makes the lower bound mean something: 62% sounds
       strong until the plan needs 67% to break even. Shown on every row. */
    var beV = hgOgBreakevenHit(ev.avgRr);
    var beTxt = isFinite(beV)
      ? ' · breakeven ' + (beV * 100).toFixed(0) + '% at ' + fin(ev.avgRr).toFixed(2) + 'R'
      : ' · breakeven unknown (no winner has reported its R yet)';
    var mg = hgOgEdgeMargin(ev);
    var tierTxt;
    if (tier === 'execute'){
      tierTxt = ' · <b>meets the 95% near-certainty ceiling</b>';
    } else if (tier === 'proven'){
      tierTxt = ' · <b>clears breakeven by ' + (mg * 100).toFixed(1)
              + ' pts — profitable at 95% confidence</b>';
    } else {
      /* the blocker is READ OFF THE GATE, not written into the template */
      var blk = hgOgTierBlock(ev, OG_EDGE_MIN_N, OG_EDGE_MARGIN);
      tierTxt = ' · ' + (isFinite(mg) && mg >= 0
                          ? ('clears breakeven by ' + (mg * 100).toFixed(1) + ' pts, held by: ' + blk.txt)
                          : ('held by: ' + blk.txt));
    }
    h += '<div class="hg-mp-note">SETTLED ' + esc(ev.source) + ' · '
      + esc(String(ev.wins)) + '/' + esc(String(ev.samples)) + ' wins · '
      + pct + '% hit · Wilson 95% CI ' + lo + '–' + hi + '%'
      + beTxt + tierTxt + esc(hgOgEvidenceScopeTxt(ev)) + esc(hgOgOverlapScopeTxt(ev)) + '</div>';
    h += '<div class="hg-mp-grid">';
    var mkt = fin(__og.spotAnchor);
    if (mkt > 0) h += '<div><i>MARKET</i><b>' + fmtPx(mkt) + '</b><u>live spot</u></div>';
    h += '<div><i>ENTRY</i><b>' + fmtPx(p.entry) + '</b><u>limit</u></div>';
    h += '<div><i>STOP</i><b>' + fmtPx(p.stop) + '</b><u>invalidation</u></div>';
    h += '<div><i>T1</i><b>' + fmtPx(p.t1) + '</b><u>' + esc(hgOgTargetReadout(Object.assign({ dir: c.dir }, p), c.horizon) || 'target') + '</u></div>';
    h += '</div>';
    /* WHERE THE PLAN SITS AGAINST THE LIVE MARK.
       hgOgTargetReadout measures T1 from the ENTRY, so a plan can be a clean
       2.0R and still be nonsense against spot: on a short whose entry is a
       retest ABOVE the market, a T1 that lands BETWEEN market and entry has
       already been traded through. Price reaching the entry has to cross TP1
       on the way up, so the target is behind price, not ahead of it.

       hgOgEntryMarketNote already names that exact geometry and the market
       picture cards have shown it since v697 — this row simply never called
       it, so the settled-evidence panel was the one place that printed such a
       plan with no warning at all. Reuse it rather than re-deriving it. */
    var mktNote = '';
    try { mktNote = hgOgEntryMarketNote(c, p) || ''; } catch (eMn) { mktNote = ''; }
    if (mktNote){
      var crossesTp1 = mktNote.indexOf('crosses TP1') !== -1;
      h += '<div class="hg-mp-note' + (crossesTp1 ? ' warn' : '') + '" style="margin-top:6px">'
        + esc(mktNote) + '</div>';
    }
    /* and how often an entry of this kind becomes a trade at all — the
       same entry-vs-mark relationship the note above reads, priced against
       the measured fill rate rather than left implicit */
    try {
      h += hgOgFillRateNoteHtml(c.dir, p && p.entry,
        fin(c.livePx) || fin(c.mark) || fin(c.markAtFire)) || '';
    } catch (eFr) {}
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
      + '<span style="color:' + (regime.regime === 'NORMAL' ? 'var(--long)' : (regime.regime === 'DECOUPLING' ? 'var(--veto)' : 'var(--short)'))
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

  /* `bag || {defaults}` DEFAULTS THE OBJECT, NOT ITS FIELDS.

     The two evidence panels each opened with that idiom. It reads like a
     default and is not one: it fires only when the bag is entirely falsy, so
     a bag that arrives with SOME fields set — a caller that built it from a
     partial state, an exported entry point, a future refactor of the picker —
     takes none of the defaults and renders the holes.

     What the holes look like is the problem. These are threshold sentences:

       "Wilson lower >= NaN% - min undefined settled"
       "none has undefined+ settled TICKETs"

     A NaN threshold does not read as missing. It reads as a number, in the
     one place on this tab a reader is most likely to trust without checking,
     and it violates the rule the rest of the file is built on — a figure is
     quoted from the record or it is not quoted.

     This file already carries the antidote and its post-mortem:
     hgOgNormalizeDrawdownState, written after a legacy state missing two
     fields turned both counters into NaN and silently disabled the breaker.
     Same shape, same fix — coerce every field here so no renderer below has
     to guard, and so a partial bag degrades to the desk's real thresholds
     rather than to arithmetic on undefined.

     NOTE ON SCOPE. No call site reaches these panels with a partial bag
     today: both pickers populate every field on their single return path.
     This is the exported surface being made to keep the promise the rest of
     the tab keeps, not a live wrong number being corrected. */
  function hgOgNum(v, dflt){
    var n = fin(v);
    return isFinite(n) ? n : dflt;
  }
  function hgOgArr(v){
    return Array.isArray(v) ? v : [];
  }
  function hgOgNormalizeExecBag(bag){
    var b = (bag && typeof bag === 'object' && !Array.isArray(bag)) ? bag : {};
    return {
      execute: hgOgArr(b.execute),
      proven: hgOgArr(b.proven),
      best: hgOgArr(b.best),
      minLo: hgOgNum(b.minLo, OG_EXEC_WILSON_LO),
      minN: hgOgNum(b.minN, OG_EXEC_MIN_N),
      edgeMinN: hgOgNum(b.edgeMinN, OG_EDGE_MIN_N),
      edgeMargin: hgOgNum(b.edgeMargin, OG_EDGE_MARGIN)
    };
  }
  function hgOgNormalizeVerdictBag(bag){
    var b = (bag && typeof bag === 'object' && !Array.isArray(bag)) ? bag : {};
    var tabs = [], i;
    if (Array.isArray(b.tabs)) for (i = 0; i < b.tabs.length; i++) if (b.tabs[i]) tabs.push(String(b.tabs[i]));
    return {
      go: (b.go && typeof b.go === 'object') ? b.go : null,
      alternates: hgOgArr(b.alternates),
      bestBelow: hgOgArr(b.bestBelow),
      minLo: hgOgNum(b.minLo, OG_VERDICT_SCALP_LO),
      minN: hgOgNum(b.minN, OG_VERDICT_MIN_N),
      tabs: tabs.length ? tabs : OG_SCALP_FWD_TABS.slice()
    };
  }

  function hgOgSettledExecutePanelHtml(bag){
    bag = hgOgNormalizeExecBag(bag);
    var edgeN = bag.edgeMinN;
    var h = '<section class="hg-mp og-settled-exec-panel" data-og-settled="1" aria-label="Settled forward-tested setups">';
    h += '<div class="hg-mp-eye">PROVEN EDGE · FORWARD-TESTED</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>TICKET + settled out-of-sample record · Wilson lower above breakeven · min '
      + edgeN + ' trades · corrected for ' + OG_MECHANICS.length
      + ' mechanics (+' + hgOgPromotionZ().toFixed(2) + '&sigma;)</span></div>';

    /* ---- the bar the desk actually trades ---- */
    if (bag.proven && bag.proven.length){
      h += '<div class="hg-mp-note">Profitable at 95% confidence: the lower bound of each record sits above the win rate its own plan needs to break even. Ranked by how far it clears. Measured on trades already settled — not a forecast.</div>';
      var pi;
      for (pi = 0; pi < bag.proven.length; pi++) h += hgOgSettledExecuteRowHtml(bag.proven[pi], 'proven');
    } else {
      h += '<div class="hg-mp-note warn">No mechanic has yet proven a forward edge: none has ' + edgeN
        + '+ settled TICKETs whose Wilson 95% lower bound clears its own breakeven. This is the honest state of the log, not a missing number — '
        + 'a mechanic reaches it by settling trades, so keep scanning and it will resolve either way.</div>';
      if (bag.best && bag.best.length){
        h += '<div class="hg-mp-note">Closest on current TICKETs — the best forward-tested evidence available right now, ranked by Wilson lower bound. Read the breakeven on each row before trading it:</div>';
        var bi;
        for (bi = 0; bi < bag.best.length; bi++) h += hgOgSettledExecuteRowHtml(bag.best[bi], 'best');
      } else {
        h += '<div class="hg-mp-note dim">No settled TICKET record on any current setup yet. The forward log fills one record per firing bar and settles on later bars — there is nothing to rank until then.</div>';
      }
    }

    /* ---- the aspirational ceiling, kept but no longer the headline ---- */
    h += '<div class="hg-mp-eye" style="margin-top:12px">NEAR-CERTAINTY CEILING · 95% BAR</div>';
    if (bag.execute && bag.execute.length){
      h += '<div class="hg-mp-note">Also clears the strictest bar on the desk — settled record with Wilson 95% lower bound ≥ '
        + (bag.minLo * 100).toFixed(0) + '% on ' + bag.minN + '+ trades.</div>';
      var ei;
      for (ei = 0; ei < bag.execute.length; ei++) h += hgOgSettledExecuteRowHtml(bag.execute[ei], 'execute');
    } else {
      h += '<div class="hg-mp-note dim">Empty, and expected to stay so. The old SETTLED EXECUTE bar — Wilson 95% lower bound ≥ '
        + (bag.minLo * 100).toFixed(0) + '% — is a claim about the TRUE win rate, not about sample size: the bound converges upward to the true rate, so clearing 95% needs a mechanic that wins about '
        + '<b>97% of the time</b>. A perfect 15/15 only reaches 79.6%, and 80 straight wins reach 95.4%; at gold\'s measured ~54% hit the bound converges to ~53.7% and never clears, at any sample size. '
        + 'Kept as a ceiling so a mechanic that somehow did reach it would be flagged — but PROVEN EDGE above is the bar to trade.</div>';
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
        if (diff > 5) bgStyle = ' style="border-left:3px solid var(--pass);padding-left:10px"';  /* Green: today > baseline + 5pp */
        else if (diff < -5) bgStyle = ' style="border-left:3px solid var(--short);padding-left:10px"';  /* Red: today < baseline - 5pp */
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
    /* hg-v729: SMC context chip — '' when the helper or c.smc is absent. */
    var smcChipSv = '';
    try {
      var smcChipFnSv = gfn('hgSmcChipHtml');
      if (smcChipFnSv) smcChipSv = smcChipFnSv(c) || '';
    } catch (eSmcSv) { smcChipSv = ''; }
    var h = '<div class="og-verdict-row' + (tier === 'go' ? ' og-verdict-go' : '') + '">';
    h += '<div class="hg-mp-head">XAUUSD ' + esc(String(c.dir || '').toUpperCase())
      + ' <span>SCALP · ' + esc(c.kind) + src
      + (smcChipSv ? ' ' + smcChipSv : '') + '</span></div>';
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
      + (tier === 'go'
          ? (' · <b>meets the ' + (OG_VERDICT_SCALP_LO * 100).toFixed(0) + '% verdict bar</b>')
          : (' · held by: ' + hgOgTierBlock(ev, { minN: OG_VERDICT_MIN_N, minLo: OG_VERDICT_SCALP_LO }).txt))
      + esc(hgOgEvidenceScopeTxt(ev)) + esc(hgOgOverlapScopeTxt(ev)) + '</div>';
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
    bag = hgOgNormalizeVerdictBag(bag);
    var h = '<section class="hg-mp og-scalp-verdict" data-og-verdict="1" aria-label="Scalp verdict">';
    h += '<div class="hg-mp-eye">SCALP VERDICT · 90% SETTLED</div>';
    h += '<div class="hg-mp-head">XAUUSD <span>pooled TICKET history · '
      + bag.tabs.join(' + ')
      + ' + scorecard gold · Wilson lower ≥ ' + (bag.minLo * 100).toFixed(0)
      + '% · min ' + bag.minN + ' settled · corrected for ' + OG_MECHANICS.length
      + ' mechanics (+' + hgOgPromotionZ().toFixed(2) + '&sigma;)</span></div>';
    if (bag.go){
      h += '<div class="hg-mp-note" style="border-left:3px solid var(--long);padding-left:10px">'
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
        /* THE HEADING MADE THE SAME UNCONDITIONAL CLAIM AS THE ROWS. A list
           whose entries are held by four different gates cannot be headed
           "still below 90% lower bound" — some of them are not. Each row now
           names its own blocker, so the heading points at them instead. */
        h += '<div class="hg-mp-note">Best available settled edge on current scalp candidates — '
          + 'none clears the ' + (OG_VERDICT_SCALP_LO * 100).toFixed(0)
          + '% verdict, and each row says what is holding it:</div>';
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
    /* a null entry in the list is skipped, not read for .tally — a render
       function that throws takes its whole panel off the page, and this
       file's header promises none of them do */
    for (i = 0; i < ranked.length; i++){
      if (ranked[i]) bestT = Math.max(bestT, fin(ranked[i].tally) || 0);
    }
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
     (HG_OG_REPLAY_EVIDENCE — its own window and settled count, not a
     copy of them; the copy that used to sit here said n=7270 against a
     bake of 8,155):
       1. ENGINE grade A/B only, taken from the REAL pick gate
          hgOgPickGoldEngineFor (tape-aligned per horizon), never demoted
          grades, never grade-C FORMING fallbacks.
          THIS IS A SELECTION PRIOR, NOT A MEASURED EDGE, and the
          difference matters because it used to be written down as the
          latter: 'the one selection ordering that held (A 54.3% WR n=70
          vs B 36.1% vs C 34.8%)'. That bake is gone; the current one
          settles one trade per grade and can order nothing. The rule is
          UNCHANGED deliberately — dropping a selection prior because this
          window settled three trades would be the same overfit as keeping
          the claim, pointing the other way — but the tab no longer tells
          a reader it is measured. hgOgGradeOrderTxt() says what the bake
          actually supports, wherever a grade is quoted.
       2. SWING geometry preferred. A SCALP pick qualifies ONLY when its
          cost tier is ok (0.26% PAXG round trip <= 0.125R of the stop),
          because scalp geometry is where the fee load dominates: the
          median scalp trade in the bake paid 0.64R in fees against 0.28R
          on swing, and every scalp score tier finished net-negative.
          THE RULE IS UNCHANGED AND ITS JUSTIFICATION IS NOT THE ONE THAT
          USED TO BE WRITTEN HERE. That cited ENGINE:SWING at -0.06R net
          and PF 0.90 and ENGINE:SCALP at -2.603R; the current bake has no
          ENGINE:SCALP row at all and puts ENGINE:SWING at +0.85R on three
          trades, which is not evidence for the rule OR against it. The
          fee-load argument above is, and it is read off medianCostR and
          the tier table rather than restated from a previous bake.
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
          /* THE ONE SITE THAT ALREADY GOT THIS RIGHT: printed only when
             the record exists, no literal behind it. Routed through the
             shared resolver so the other three cannot drift away from it
             again. */
          var coh = hgOgCohortClaim('ENGINE:SCALP');
          var cohNet = hgOgCohortNetTxt(coh, 1);
          why = 'scalp cost drag' + (cohNet
            ? ' — replay: ' + cohNet + ' on the ' + coh.key + ' cohort'
            : ' — no settled ' + coh.key + ' cohort in this replay window');
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

  /* Gold Playbook 7-step readout on OMNIGOLD. Paints at once from the bars the
     scan already holds (15m → 1H aggregation, closed bars only), then swaps in
     the 400 × 1H leg when it arrives. Same desk tape as MOST PROBABLE, so an
     against-tape candidate is HELD here exactly as it is there. */
  function hgOgSevenStepInputs(rows1h, feed){
    var tape = (__og.tape && (__og.tape.desk || __og.tape.swing)) || null;
    var basis = NaN;
    try { if (typeof S !== 'undefined' && S && isFinite(+S.goldBasisPct)) basis = +S.goldBasisPct; } catch (eB){}
    var shared = __og.shared || {};
    return {
      rows1h: rows1h || [],
      rows15m: (__og.lastRows && (__og.lastRows.m15 || __og.lastRows.scalp)) || [],
      rows4h: (__og.lastRows && __og.lastRows.swing) || [],
      now: Date.now(),
      feed: feed || (__og.src && (__og.src.swing || __og.src.scalp)) || 'unavailable',
      venue: (feed === 'delta-xaut') ? 'analysis feed' : 'Delta XAUTUSD',
      basisPct: basis,
      macro: shared.macro, dxyRows: shared.macro && shared.macro.dxyRows, news: shared.news,
      perpNative: __og.perpNative || null,
      tape: tape === 'long' ? 'UP' : tape === 'short' ? 'DOWN' : null
    };
  }
  function hgOgSevenStepHtml(rows1h, feed){
    try {
      var fn = gfn('hgGoldSevenStepPanel');
      if (!fn || !__og || !__og.lastRows) return '';
      return fn(hgOgSevenStepInputs(rows1h, feed));
    } catch (eSeven){ return ''; }
  }
  function hgOgRefreshSevenStep(host){
    var load = gfn('hgGoldSevenStepLoad1h');
    if (!load || !host) return;
    var stamp = __og.__sevenStamp = (__og.__sevenStamp || 0) + 1;
    try {
      Promise.resolve().then(function(){ return load(400); }).then(function(leg){
        if (!leg || !leg.rows || !leg.rows.length) return;
        if (stamp !== __og.__sevenStamp) return;
        var slot = host.querySelector ? host.querySelector('[data-og-seven-host="1"]') : null;
        if (!slot) return;
        __og.rows1h = leg.rows;
        __og.src1h = leg.source || null;
        slot.innerHTML = hgOgSevenStepHtml(leg.rows, leg.source);
      }).catch(function(){});
    } catch (eLoad){}
  }

  function hgOgPaintGoldEngines(ui, bridge, tapeDir){
    /* tapeDir is ADDITIVE optional — omitted, the APEX head block falls
       back to the tab's stored desk-tape read; nothing else changes. */
    var host = ui && ui.goldEngines;
    if (!host) return;
      try {
        var sevenHtml = '<div data-og-seven-host="1">' + hgOgSevenStepHtml(__og.rows1h || [], __og.src1h || null) + '</div>';
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
        host.innerHTML = sevenHtml + formHtml + hgOgGoldEnginesPanelHtml(bridge, tapeDir);
        hgOgRefreshSevenStep(host);
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
        heldCards: hgOgHeldCards(ogCollapsed || [], deskTape),
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
    /* When the edge gate is why this panel is empty, say so HERE rather
       than only in the evidence panel further down. */
    var edgeSilence = hgOgEdgeSilenceNote();
    var note = anyTrade
      ? 'Balanced across mechanic families and indicator reads on gold\'s own tape. Tickets only. Not a win probability.'
      : ((anyEngine
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
          /* hgOgMpNoneWhy already carries the gate reason; the branches
             above do not, so it is appended to them here. */
          : hgOgMpNoneWhy(tape, held)))
        + ((edgeSilence && (anyEngine || anyWatch)) ? (' ' + edgeSilence) : ''));
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
    h += '<div style="margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:4px;background:var(--panel2)">';
    h += '<div style="font-weight:bold;margin-bottom:8px;color:var(--mut)">Confluence Rating Spectrum</div>';
    h += hgOgSpectrumTruthHeaderHtml();
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:0.85em">';
    h += hgOgSpectrumLegendCellsHtml();
    h += '</div>';
    /* Replay footnote (ADDITIVE): the OOS verdict on this very legend. */
    h += hgOgConfluenceFitNoteHtml();
    h += '</div>';
    h += hgOgMpHorizonHtml('SCALP', pickScalp, scalpT, watchScalp, held, engineScalp);
    h += hgOgMpHorizonHtml('SWING', pickSwing, swingT, watchSwing, held, engineSwing);
    /* v689: KILLED note. Rendered BEFORE the perf panels so the user
       sees the filter action, then the per-horizon stats that justify
       it. Reads from window.__hgSolKillLast[OMNIGOLD] which
       hgSolidityReorder stashed during the ranker step. */
    try {
      var Wk = (typeof window !== 'undefined') ? window : null;
      if (Wk && typeof Wk.hgSolidityLastKilled === 'function'
              && typeof Wk.hgSolidityKilledNoteHtml === 'function'){
        h += Wk.hgSolidityKilledNoteHtml(Wk.hgSolidityLastKilled('OMNIGOLD'));
      }
    } catch(eKn){}
    /* v688: kind performance panels per horizon from the accumulated forward
       log. omnigold records with tab='OMNIGOLD:'+cfg.label so each horizon
       gets its own panel keyed by 'OMNIGOLD:SCALP' / 'OMNIGOLD:SWING'. Shows
       which mechanics are actually winning/losing so the trader can verify
       the v685 veto and v687 PRIME promotion (including the v687 omnigold
       tape-override) rest on real accumulated evidence. Feature-checked. */
    try {
      var Wp = (typeof window !== 'undefined') ? window : null;
      if (Wp && typeof Wp.hgPerfPanelHtml === 'function'){
        h += Wp.hgPerfPanelHtml('OMNIGOLD:SCALP', { title: 'KIND PERFORMANCE · OMNIGOLD SCALP' });
        h += Wp.hgPerfPanelHtml('OMNIGOLD:SWING', { title: 'KIND PERFORMANCE · OMNIGOLD SWING' });
      }
    } catch(ePerf){}
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

  /* GOLD SCALP / GOLD SWING desk snapshots: the plans those tabs are showing
     right now, including CONVICTION-LOCKED ones a fresh engine run no longer
     emits. Same objects the desks paint (dir · grade · strategy · entry /
     stop / t1 · locked · why), taken within the last 30 minutes. */
  function hgOgDeskSnapshotCands(horizon){
    var snap = hgOgDeskSnapshot(horizon);
    if (!snap || !Array.isArray(snap.cands) || !snap.cands.length) return [];
    var out = [], i, c;
    for (i = 0; i < snap.cands.length; i++){
      c = snap.cands[i];
      if (!c || !c.dir || !isFinite(fin(c.entry)) || !isFinite(fin(c.stop)) || !isFinite(fin(c.t1))) continue;
      out.push({ dir: c.dir, entry: fin(c.entry), stop: fin(c.stop), t1: fin(c.t1), t2: fin(c.t2), grade: c.grade || null,
                 strategy: c.strategy || null, stratKey: c.stratKey || null, kind: c.stratKey || c.strategy || null,
                 tally: c.tally, locked: !!c.locked, why: c.why || null, invalidates: c.invalidates || null,
                 confluence: Array.isArray(c.tallyParts) ? c.tallyParts.map(function(p){ return p && p.label; }).filter(Boolean) : [],
                 deskSnapshot: true });
    }
    return out;
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
    var snap = hgOgDeskSnapshotCands(horizon);
    for (i = 0; i < snap.length; i++) out.push(snap[i]);
    var cards = (__og && __og.uniformCards)
      || (__og && __og.lastView && __og.lastView.collapsed) || [];
    for (i = 0; i < cards.length; i++){
      r = hgOgCardAsUniformCand(cards[i], horizon);
      if (r) out.push(r);
    }
    return out;
  }

  /* Tape for the uniform card: the desk's stored read first; when that is
     unread (mixed stack) fall back to the SAME EMA21/50 read GOLD SCALP and
     GOLD SWING use on their own rows (hgGoldUniformTape), so the three tabs
     hold the same side. An unread tape holds nothing — that hid every
     opposite-side plan on OMNIGOLD. */
  function hgOgDeskSnapshot(horizon){
    var fn = gfn(String(horizon).toUpperCase() === 'SWING' ? 'goldswingScan' : 'goldscalpScan');
    if (!fn) return null;
    var snap = null; try { snap = fn(); } catch (e){ snap = null; }
    if (!snap) return null;
    if (isFinite(fin(snap.at)) && Date.now() - fin(snap.at) > 30 * 60000) return null;
    return snap;
  }
  function hgOgUniformTape(horizon){
    var tapes = (__og && __og.tape) || {};
    var rows = (__og && __og.lastRows) || {};
    /* the desk that owns the plan owns the tape: GOLD SCALP / SWING publish
       theirs with the scan snapshot, so the held verdict is the same on both tabs */
    var snap = hgOgDeskSnapshot(horizon);
    var st = snap && String(snap.tape || '').toLowerCase();
    if (st === 'long' || st === 'short') return st;
    var stored = String(horizon).toUpperCase() === 'SWING' ? tapes.swing : tapes.scalp;
    if (stored === 'long' || stored === 'short') return stored;
    var tf = gfn('hgGoldUniformTape');
    var r = String(horizon).toUpperCase() === 'SWING' ? (rows.swing || []) : (rows.scalp || rows.m15 || []);
    if (!tf || !r.length) return stored || '';
    try { return tf(r) || stored || ''; } catch (e){ return stored || ''; }
  }
  /* Repaint the combined / held card from the LIVE desk snapshots without a
     full OMNIGOLD rescan. GOLD SCALP / SWING scan on their own clocks; a plan
     they issue between two OMNIGOLD scans used to stay invisible here for up to
     ten minutes. Cheap (compose + html) and replace-in-place. */
  function hgOgRepaintUniform(){
    try {
      var ui = __og && __og.ui;
      var host = (ui && ui.mp) || (ui && ui.cards);
      if (!host || !host.querySelector) return false;
      var old = host.querySelector('[data-hg-gold-uniform-desk]');
      if (!old) return false;
      var uni = hgOgUniformLeadHtml();
      if (!uni) return false;
      var sig = uni.replace(/\d{2}:\d{2}:\d{2}/g, '');
      if (__og.__uniSig === sig) return false;
      __og.__uniSig = sig;
      old.outerHTML = uni;
      return true;
    } catch (e){ return false; }
  }
  window.hgOgRepaintUniform = hgOgRepaintUniform;
  /* The 30 s repaint timer starts when the tab is MOUNTED in a real page —
     never at module load, where it would keep a Node test process alive. */
  function hgOgStartUniformTimer(){
    try {
      if (typeof setInterval !== 'function' || __og.__uniTimer) return;
      __og.__uniTimer = setInterval(function(){ try { hgOgRepaintUniform(); } catch (e){} }, 30000);
    } catch (eT){}
  }
  window.hgOgUniformDebug = function(){
    var b = (__og && __og.bridge) || null;
    return { tape: { scalp: hgOgUniformTape('SCALP'), swing: hgOgUniformTape('SWING'), stored: (__og && __og.tape) || null },
             bridge: b ? { ok: !!b.ok, why: b.why || '', scalpRanked: (b.scalp && b.scalp.ranked ? b.scalp.ranked.length : 0), scalpBest: !!(b.scalp && b.scalp.best), swingRanked: (b.swing && b.swing.ranked ? b.swing.ranked.length : 0) } : null,
             src: (__og && __og.src) || null,
             scalp: hgOgUniformCands('SCALP'), swing: hgOgUniformCands('SWING') };
  };

  function hgOgUniformLeadHtml(){
    try{
      var compose = gfn('hgGoldUniformCompose');
      var htmlFn = gfn('hgGoldUniformHtml');
      if (!compose || !htmlFn) return '';
      var tapes = { scalp: hgOgUniformTape('SCALP'), swing: hgOgUniformTape('SWING') };
      var rows = (__og && __og.lastRows) || {};
      /* A stray semicolon after the opening tag used to return ONLY that tag,
         so the combined / HELD card never painted on OMNIGOLD (v593–v601).
         heldStyle 'dark' = the enlarged, dark-highlighted held trade cards the
         desk asked for; same compose, same levels, same against-tape rule. */
      return '<div data-hg-gold-uniform-desk="1" style="grid-column:1/-1;display:block;width:100%">'
        + htmlFn(compose(hgOgUniformCands('SCALP'), {
            horizon: 'SCALP', tape: tapes.scalp, rows: rows.scalp || rows.m15 || [], heldStyle: 'dark', heldMax: 3
          }))
        + htmlFn(compose(hgOgUniformCands('SWING'), {
            horizon: 'SWING', tape: tapes.swing, rows: rows.swing || [], heldStyle: 'dark', heldMax: 3
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
      /* KILLED (v689): a proven-losing kind is filtered out of the visible
         list by hgSolidityReorder, so it must never be the MOST PROBABLE
         pick either — otherwise the tab prints ENTRY/STOP/T1 for a card it
         simultaneously reports as hidden. Same shape as the formed check. */
      if (c.solidity && c.solidity.killed === true) continue;
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
    var nearAtr = hgOgNearAtrFor(horizon);
    var near = [], anyDist = false;
    for (i = 0; i < pool.length; i++){
      if (isFinite(fin(pool[i].distAtr))){
        anyDist = true;
        if (pool[i].distAtr <= nearAtr) near.push(pool[i]);
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
      /* KILLED (v689): filtered out of the visible list, so not a WATCH. */
      if (c.solidity && c.solidity.killed === true) continue;
      if (c.plan.momentumStop === true) vol.push(c);
      else structural.push(c);
    }
    var pool = structural.length ? structural : vol;
    if (!pool.length) return null;
    var nearAtr = hgOgNearAtrFor(horizon);
    var watchMax = hgOgWatchMaxAtrFor(horizon);
    var near = [], inReach = [], anyDist = false;
    for (i = 0; i < pool.length; i++){
      if (isFinite(fin(pool[i].distAtr))){
        anyDist = true;
        if (pool[i].distAtr <= nearAtr) near.push(pool[i]);
        else if (pool[i].distAtr <= watchMax) inReach.push(pool[i]);
      }
    }
    /* Beyond watchMax stand aside (ORB @ 4633 when gold prints 4597). Inside
       the horizon ceiling, prefer near levels but still show a far WATCH. */
    if (anyDist){
      if (!near.length && !inReach.length) return null;
      pool = near.length ? near : inReach;
    }
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

  /* Opposite-side TICKETS the tape is holding. Same filter the card
     loop already uses: gate-passed, formed, plan in hand, dir !== tape.
     Empty when tape is unread — no side is invented. Pure. */
  function hgOgHeldCards(cards, tape){
    tape = String(tape || '').toLowerCase();
    if (tape !== 'long' && tape !== 'short') return [];
    var out = [], i, c;
    for (i = 0; i < (cards || []).length; i++){
      c = cards[i];
      if (!c || !c.plan) continue;
      if (!(c.grade && c.grade.ticket)) continue;
      if (c.formation && c.formation.formed === false) continue;
      if (String(c.dir || '').toLowerCase() === tape) continue;
      out.push(c);
    }
    return out;
  }

  /* TOP SETUP visibility for the other side. Against-tape tickets stay
     HELD / NOT ACTIVATED (replay: with-tape +0.121R, against-tape −0.280R).
     When none exist the card says they are not hidden. Never invents
     levels. Pure over its inputs. */
  function hgOgOppositeAsideHtml(tape, heldCards){
    tape = String(tape || '').toLowerCase();
    if (tape !== 'long' && tape !== 'short') return '';
    var other = (tape === 'long') ? 'SHORT' : 'LONG';
    var n = (heldCards && heldCards.length) || 0;
    var h = '<div class="note og-opposite-aside" data-og-opposite="1" role="status"'
      + ' style="display:block;margin:8px 0;padding:8px 10px;border-left:3px solid var(--veto)">';
    if (n){
      h += '<b>' + other + ' SETUPS ARE SHOWN — HELD, NOT ACTIVATED</b> — gold tape is '
        + (tape === 'long' ? 'UP' : 'DOWN') + ', so a ' + other
        + ' is not the activated setup (against-tape replay −0.280R vs with-tape +0.121R). '
        + 'They stay queued until the tape flips.';
      h += hgOgHeldQueueHtml(heldCards, tape);
    } else {
      h += '<b>NO ' + other + ' TICKET THIS SCAN</b> — ' + other.toLowerCase()
        + 's are not hidden. None cleared the gate ledger. The stand-aside is no '
        + (tape === 'long' ? 'LONG' : 'SHORT') + ' ticket and no ' + other
        + ' ticket, not a missing side.';
    }
    return h + '</div>';
  }

  /* THIS LIST NAMES SETUPS, SO IT HAS TO NAME THEM. Two reads went straight
     into the sentence: `tape.toUpperCase()` on an unreadable tape left the
     line ending "while gold tape reads ." with nothing after it, and
     `hc.horizon + ' · ' + hc.kind` on a half-built card rendered
     "undefined · undefined LONG" as the setup's identity. The single live
     caller guards the tape and builds complete cards, so neither has shipped
     — but a queue entry that cannot say what it is should be left out of the
     queue, not printed as a row of undefineds. */
  function hgOgHeldQueueHtml(cards, tape){
    if (!cards || !cards.length) return '';
    tape = String(tape || '').toLowerCase();
    var known = (tape === 'long' || tape === 'short');
    var side = (tape === 'short') ? 'LONG' : 'SHORT';
    var rows = [], ci, hc, hz, kd, dir, line;
    for (ci = 0; ci < cards.length; ci++){
      hc = cards[ci];
      if (!hc) continue;                 /* see hgOgEngineGradeBannerHtml */
      hz = (hc.horizon != null && hc.horizon !== '') ? String(hc.horizon) : '';
      kd = (hc.kind != null && hc.kind !== '') ? String(hc.kind) : '';
      /* a row that can name neither its horizon nor its mechanic identifies
         nothing, and an unnamed row in a queue is worse than a shorter queue */
      if (!hz && !kd) continue;
      dir = String(hc.dir || '').toUpperCase();
      line = [hz, kd].filter(function(x){ return !!x; }).join(' · ') + (dir ? ' ' + dir : '');
      rows.push('<li class="dim">' + esc(line)
        + (hc.plan ? (' · ENTRY ' + fmtPx(hc.plan.entry) + ' · STOP ' + fmtPx(hc.plan.stop)
                      + ' · T1 ' + fmtPx(hc.plan.t1)) : '')
        + '</li>');
    }
    if (!rows.length) return '';
    var h = '<div class="note og-held-queue" style="margin-top:12px"><b>HELD AGAINST TAPE</b> — '
      + rows.length + ' cleared ' + side + ' ticket' + (rows.length === 1 ? '' : 's')
      + (known ? (' while gold tape reads ' + esc(tape.toUpperCase()))
               : ' held against the tape (tape direction unreadable this scan)')
      + '. Not setups — they stay queued until the tape flips.<ul style="margin:8px 0 0 16px">';
    h += rows.join('');
    h += '</ul></div>';
    return h;
  }

  function setupCard(c){
    /* THE ONLY UNGUARDED READ ON THE RENDER PATH. Every caller builds these
       cards with a grade attached, so this held for as long as nobody passed
       one that did not — and a card without a grade is exactly what a
       half-built scan produces. A throw here empties MOST PROBABLE, the
       panel at the top of the tab. */
    if (!c || !c.grade) return '';
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
    /* hg-v729: SMC context chip (smc-setups.js hgSmcChipHtml). Returns ''
       when the helper or c.smc is absent, so the head is byte-identical
       without it. Additive — no score, tier, order or visibility reads it. */
    try {
      var smcChipFn = gfn('hgSmcChipHtml');
      var smcChipCard = smcChipFn ? (smcChipFn(c) || '') : '';
      if (smcChipCard) badge += ' ' + smcChipCard;
    } catch (eSmcCard) {}

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
      /* THE RISK % IS THE STOP, NOT THE SIZE. plan.riskPct is
         |entry - stop| / entry * 100 — a GEOMETRIC distance, fixed by the
         two prices printed on this very line. It used to be multiplied by
         hgOgRegimeScaleFactor (1.0 / 0.7 / 0.6), so a card reading
         ENTRY 3400 · STOP 3366 (a 1.00% stop) printed "risk 0.70%" in a
         DECOUPLING regime — the line contradicted itself. The regime factor
         is a POSITION-SIZE multiplier; it is shown as one, beside the
         geometry rather than folded into it. */
      var regimeScale = 1.0;
      if (__og.correlationRegime){
        regimeScale = hgOgRegimeScaleFactor(__og.correlationRegime.regime);
      }
      h += '<div class="plan">ENTRY ' + fmtPx(c.plan.entry) + ' · STOP ' + fmtPx(c.plan.stop)
        +  ' · T1 ' + fmtPx(c.plan.t1) + ' · T2 ' + fmtPx(c.plan.t2)
        +  ' · <b>R:R ' + fmt(c.plan.rr1, 2) + '</b> · stop ' + fmt(fin(c.plan.riskPct), 2) + '% of entry'
        +  (regimeScale < 1.0
              ? (' <span class="dim">· size ' + (regimeScale * 100).toFixed(0) + '% (regime '
                 + esc(String((__og.correlationRegime && __og.correlationRegime.regime) || '')) + ')</span>')
              : '') + '</div>';
      /* Replay evidence line (ADDITIVE): the mechanic's settled PAXG-replay
         record, negative numbers included; '' when it has no n>=40 record. */
      h += hgOgReplayLineHtml(c.kind);
      /* UNIFIED CONFLUENCE (hg-v698): the named independent confirmations
         this card actually stands on, one line per confirmation, plus any
         class still missing. Every name comes from this card's own gate
         ledger — nothing is invented and no count is inflated (a class
         counts once however many reads inside it agree). */
      try {
        var wConf = W();
        if (c.formation && c.formation.confluence && wConf
            && typeof wConf.hgGoldConfluenceHtml === 'function'){
          h += wConf.hgGoldConfluenceHtml(c.formation.confluence);
        }
      } catch (eCH){}
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
      /* The fill rate is the evidence behind "thin fill", and it was computed
         on every limit setup and then thrown away — plan.fillNote was set and
         never rendered. A reader saw the verdict and not the sample it came
         from. Now the sentence appears, and an UNMEASURED fill says so rather
         than passing the gap-ATR estimate off as a measurement. */
      /* a string, not merely truthy: a note that is an object renders as
         "[object Object]", which the fuzz in test-omnigold-fill-evidence
         caught on the first pass */
      var fillTxt = (typeof c.plan.fillNote === 'string') ? c.plan.fillNote.trim() : '';
      if (fillTxt){
        var fillPct = fin(c.plan.fillProb);
        h += '<div class="dim og-fill-line">'
          + (c.plan.fillMeasured === false
              ? ('fill NOT measured — no usable history on this tape'
                 + (isFinite(fillPct)
                     ? (' · the ' + Math.round(fillPct) + '% shown is an estimate from the entry gap, not a rate')
                     : ''))
              : ('fill: ' + esc(fillTxt)))
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

  /* THE REPLAY'S DETECTOR MAP, HOISTED SO ITS INVARIANT CAN BE TESTED.

     Built inline inside scanHorizon until now, which made the claim two
     comments below — that every entry is the same pure function the live
     pass calls — impossible to check from outside. It was not true.

     A detector in here is handed a TRUNCATED slice of history and asked
     what it sees at the end of it. Anything it reads other than those bars
     is not a property of the setup: it is a property of the moment the bake
     ran. hgOgVpPlaybook was called with no options at all, so its `now` fell
     through to Date.now() and the gold VP playbook judged every historical
     bar against the wall clock. Its session gate is one of the twelve it
     scores, so the SAME 400 bars read 3/12 with sessionOk false at 03:00 UTC
     and 4/12 with sessionOk true at 15:00 — the record was a property of
     when scripts/backtest-omnigold.mjs happened to run, and not reproducible.

     Every entry that accepts a clock now receives the bar's own timestamp,
     which is the only clock a replay has any business reading.
     test-omnigold-replay-clock.mjs holds the whole map to that: each entry
     must answer identically under two wall clocks twelve hours apart. */
  function hgOgBtLastSec(r){
    if (!r || !r.length) return NaN;
    var i = r.length - 1, t;
    for (; i >= 0; i--){
      if (!r[i]) continue;                      /* a hole in the slice is not a clock */
      t = fin(r[i].t);
      if (isFinite(t)) return t;
    }
    return NaN;
  }

  function hgOgBtDetectors(){
    var w = W();
    return {
          /* ONE CALL, TWO REGISTERED LABELS — the EQL/EQH-SWEEP pattern.
             hgOmniSpring returns SPRING on a swept low and UTAD on a swept
             high. This entry used to return whichever came back, so UTAD
             fired 106 times while being registered nowhere. Now each side
             is its own mechanic with its own row, its own gate verdict and
             its own place in the family count — which is the whole reason
             OG_KIND_ALIAS is empty. */
          SPRING: function(r){ var g = w.hgOmniRange ? w.hgOmniRange(r, 40) : null;
                               var h = (g && w.hgOmniSpring) ? w.hgOmniSpring(r, g) : null;
                               return (h && h.kind === 'SPRING') ? h : null; },
          UTAD:   function(r){ var g = w.hgOmniRange ? w.hgOmniRange(r, 40) : null;
                               var h = (g && w.hgOmniSpring) ? w.hgOmniSpring(r, g) : null;
                               return (h && h.kind === 'UTAD') ? h : null; },
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
          /* the bar's own timestamp, NOT the wall clock: this is the only
             entry in the map whose engine reads a clock, and reading
             Date.now() made its session gate a property of the bake */
          'VP-PLAYBOOK':     function(r){ return hgOgVpPlaybook(r, { nowSec: hgOgBtLastSec(r) }); },
          'SWEEP-OB':        function(r){ return hgOgSweepObHit(r, { nowSec: hgOgBtLastSec(r) }); },
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
  }

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
        var fns = hgOgBtDetectors();
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

        /* hg-v729: Smart-Money-Concepts context on every card that carries
           a plan (smc-setups.js). RECORD-ONLY — gates, grade, plan, ranking,
           solidity and visibility are all untouched; this only hangs a .smc
           object off the card for the chip and logs one SMC_CONTEXT signal.
           hgSmcEnrich reads dir/entry/stop/t1 at the TOP level and this desk
           keeps them on c.plan, so a shim row carries them and the resulting
           .smc is copied back onto the card. Scored here, BEFORE
           hgOgAlignPlansToSpot rescales plans, so the geometry matches the
           feed rows the mechanic actually fired on. Feature-checked through
           gfn() — W is a FUNCTION in this file, not the window object. */
        try {
          var smcEnrichFn = gfn('hgSmcEnrich');
          if (smcEnrichFn && rows.length){
            for (var smcI = 0; smcI < cands.length; smcI++){
              var smcCard = cands[smcI];
              if (!smcCard || !smcCard.plan) continue;
              var smcRow = { sym: 'XAUUSD', dir: smcCard.dir,
                             entry: smcCard.plan.entry, stop: smcCard.plan.stop,
                             t1: smcCard.plan.t1, t2: smcCard.plan.t2 };
              smcEnrichFn(smcRow, { rows: rows, tab: 'OMNIGOLD' });
              if (smcRow.smc) smcCard.smc = smcRow.smc;
            }
          }
        } catch (eSmcOg) {}


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
            /* The EXACT forward key this record will carry, stamped on the
               candidate so the lane throttle downstream can mark it shown or
               hidden without reconstructing the key and guessing wrong about
               cfg.label vs c.horizon. One source of truth for the key. */
            c.__fwdKey = ['OMNIGOLD:' + cfg.label, c.kind, 'XAUUSD', c.dir, barT].join('|');
            try {
              fwdRecord({
                tab: 'OMNIGOLD:' + cfg.label, mechanic: c.kind, sym: 'XAUUSD', tf: cfg.tf,
                dir: c.dir, entry: c.plan.entry, stop: c.plan.stop, t1: c.plan.t1,
                barT: barT, horizonBars: cfg.horizonBars, ticket: !!(c.grade && c.grade.ticket),
                /* EVERY GATE PASSED EXCEPT THE ONE UNDER TEST.

                   measured-edge promotes a mechanic on twenty settled
                   TICKETS. hg-v756 made that gate hard, so nothing is a
                   ticket, so the population can never grow, so the gate can
                   never promote anything — it became the only thing that
                   could clear itself. This is the population that replaced
                   `ticket`, and it keeps accumulating.

                   Computed from the grade's own veto/unknown lists rather
                   than re-deriving the ledger, so it cannot drift from what
                   the card actually showed. */
                gateClear: hgOgGateClear(c.grade),
                /* WHERE THE DESK PUT THIS CARD.

                   hgOgBalanceParts is what orders every gold card — the
                   composite of tape, family agreement, indicator net,
                   coverage, proximity, freshness and measured edge. It has
                   decided which setup a reader sees first since it was
                   written, and NOTHING has ever recorded it, so whether a
                   higher-ranked card actually does better is a question
                   this desk has never been able to ask.

                   Computed here, at fire time, from the same function the
                   renderer uses, so the number recorded is the number that
                   ordered the card. Tape is unread at this point in the
                   scan — it is resolved later — so the score is taken
                   WITHOUT a tape side: the tape term contributes 0 for
                   every card equally and the remaining terms are what
                   separate them. That makes it comparable across bars,
                   which a tape-dependent score would not be.

                   A number, not a claim. The forward log will say in time
                   whether it ranks anything. */
                balScore: (function(){
                  try {
                    var b = hgOgBalanceParts(c, '');
                    return (b && isFinite(fin(b.score))) ? Math.round(fin(b.score) * 10) / 10 : undefined;
                  } catch (eB) { return undefined; }
                })(),
                /* PRICE AT FIRE. Without it the log cannot tell a limit from
                   a stop entry, and so cannot ask whether the order would
                   have filled at all — it has always assumed it did. The
                   bar close is the mark the plan was written against; the
                   live price is preferred when the scan has one. */
                mark: (function(){
                  /* same precedence the zone context uses a few lines up:
                     the traded market price first, the feed's live price
                     next, the bar close last */
                  var m = fin(mktPx);
                  if (!(isFinite(m) && m > 0)) m = fin(livePx);
                  if (isFinite(m) && m > 0) return m;
                  var b = rows[rows.length - 1];
                  return (b && isFinite(fin(b.c))) ? fin(b.c) : undefined;
                })(),
                /* WAS IT ON THE SCREEN? hg-v753's lane throttle means the
                   tab forms ~46 plans a day and shows about 6. The recording
                   stays unthrottled on purpose — the in-sample pool measures
                   the raw mechanic and the forward pool must measure the same
                   thing — but without this the log could only ever answer how
                   the MECHANIC did, never how the cards a reader actually saw
                   did. Undefined until the throttle has run, which is after
                   this point in the scan; hgOgMarkShownInForward stamps it. */
                shown: undefined,
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

        /* LANE THROTTLE. The collapse above merges plans on the same
           levels; this drops a card into a lane whose previous card is
           still running. One direction on one horizon is a lane, and a
           reader holds one gold position — see hgOgLaneThrottle for the
           measured occupancy the interval comes from, and for why this is
           a tradeability rule and explicitly not an edge play.

           Keyed on the SCAN's timestamp, not the wall clock, so
           re-rendering the same scan cannot age its own cards out from
           under the reader. Fail-open: any error and the full list shows,
           because a throttle that silently eats the book is worse than one
           that does nothing. */
        try {
          var ogScanAt = fin(__og.snap && __og.snap.at);
          if (!isFinite(ogScanAt)) ogScanAt = (typeof Date !== 'undefined') ? Date.now() : 0;
          var ogThr = hgOgLaneThrottle(ogCollapsed, __og.laneLastPub || {}, ogScanAt);
          if (ogThr && ogThr.shown){
            __og.laneLastPub = ogThr.lastByLane;
            __og.laneThrottled = ogCollapsed.length - ogThr.shown.length;
            /* Tell the forward log which firings reached the screen. The
               records were written during the per-horizon evaluation, before
               this decision existed; hgFwdMarkShown stamps them write-once so
               a re-scan cannot flip a card's history. Without this the log
               can only ever answer how the MECHANIC did, never how the cards
               a reader actually saw did — and since hg-v753 those are
               different populations: ~46 formed a day against about 6 shown. */
            try {
              var markFn = gfn('hgFwdMarkShown');
              if (markFn){
                var shownKeys = {}, hiddenKeys = {}, mi, mc;
                for (mi = 0; mi < ogCollapsed.length; mi++){
                  mc = ogCollapsed[mi];
                  if (!mc || !mc.__fwdKey) continue;
                  hiddenKeys[mc.__fwdKey] = 1;
                }
                for (mi = 0; mi < ogThr.shown.length; mi++){
                  mc = ogThr.shown[mi];
                  if (!mc || !mc.__fwdKey) continue;
                  shownKeys[mc.__fwdKey] = 1;
                  delete hiddenKeys[mc.__fwdKey];
                }
                markFn(shownKeys, true);
                markFn(hiddenKeys, false);
              }
            } catch (eMark) {}
            ogCollapsed = ogThr.shown;
          }
        } catch (eThr) { /* fail open — show everything rather than nothing */ }

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
        /* Counted ONCE, from the shared predicate, and used by both the
           status tally and the collapsed wrapper below — those two used to
           disagree, and the wrapper (the only line visible before a reader
           expands it) called every WATCH card measured-negative. */
        var __sa = hgOgStoodAsideSplit(ogDemotedCards);
        var ogWatchN = __sa.watch.length, ogNegN = __sa.neg.length;
        if (ogDemotedCards.length){
          /* hg-v698: the tally now names BOTH reasons a card can leave the
             tradable list, because they mean opposite things to a reader —
             "measured losing" versus "not enough independent confirmation
             yet". Counted from the same stamps the two sections partition on. */
          __og.lastStat += '  ·  ' + ogDemotedCards.length + ' stood aside ('
            + (ogNegN ? ogNegN + ' measured-negative / venue stop floor' : '')
            + (ogNegN && ogWatchN ? ' · ' : '')
            + (ogWatchN ? ogWatchN + ' WATCH — short of 3 confirmation classes' : '')
            + ')';
          ui.stat.textContent = __og.lastStat + warn;
        }

        /* KILL-LIST BEFORE THE PICK (v689 repair). hgOgDeskOrder stamps
           .solidity and then drops sol.killed cards. Stamping there and
           only there meant the pick was chosen from an UNSTAMPED list, so
           a proven-losing kind could be selected as MOST PROBABLE and keep
           printing ENTRY/STOP/T1 while the same card was counted in the
           "N proven-losing setups hidden" note. Stamp first so hgOgPickFor
           can see .killed; hgOgDeskOrder re-stamps idempotently below. */
        try { hgOgStampSolidity(ogCollapsed, deskTape); } catch (eSolPre) {}
        var pickScalp = hgOgPickFor(ogCollapsed, HORIZONS.scalp.label, scalpTape);
        var pickSwing = hgOgPickFor(ogCollapsed, HORIZONS.swing.label, swingTape);
        var watchScalp = pickScalp ? null : hgOgPickWatchFor(ogCollapsed, HORIZONS.scalp.label, scalpTape);
        var watchSwing = pickSwing ? null : hgOgPickWatchFor(ogCollapsed, HORIZONS.swing.label, swingTape);
        if (pickScalp) pickScalp.topPick = true;
        if (pickSwing) pickSwing.topPick = true;
        if (watchScalp) watchScalp.topWatch = true;
        if (watchSwing) watchSwing.topWatch = true;
        ogCollapsed = hgOgDeskOrder(ogCollapsed, deskTape);
        /* Belt and braces: the re-stamp inside hgOgDeskOrder could flip a
           card to killed (fresh forward samples land between the two
           calls). A pick the ordered list no longer carries is not a pick. */
        (function(){
          function stillLive(p){
            if (!p) return null;
            if (p.solidity && p.solidity.killed === true){ p.topPick = false; p.topWatch = false; return null; }
            return p;
          }
          pickScalp = stillLive(pickScalp); pickSwing = stillLive(pickSwing);
          watchScalp = stillLive(watchScalp); watchSwing = stillLive(watchSwing);
        })();

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
        var heldCards = hgOgHeldCards(ogCollapsed, deskTape);
        /* v697 rule D: cap visible tradable cards at 5 per direction so the
           tab reads as top picks, not a firehose. Order is preserved (the
           list is already ranked upstream); a summary line reports how many
           extras were trimmed. Held cards + dead-level lines still render
           in full because they carry a different reader responsibility.
           A <details> disclosure exposes the trimmed tail on demand. */
        var OG_VIS_CAP = 5;
        var perSideKept = { long: 0, short: 0, other: 0 };
        var trimmedTail = [];
        for (i = 0; i < ogCollapsed.length; i++){
          var cCard = ogCollapsed[i];
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
          var sideKey = String(cCard.dir || '').toLowerCase();
          if (sideKey !== 'long' && sideKey !== 'short') sideKey = 'other';
          if (perSideKept[sideKey] >= OG_VIS_CAP){
            trimmedTail.push(cCard);
            continue;
          }
          perSideKept[sideKey]++;
          h += setupCard(cCard);
        }
        if (trimmedTail.length){
          h += '<details class="note" style="margin-top:10px">'
            +    '<summary style="cursor:pointer;padding:6px 0">▸ '
            +      trimmedTail.length + ' lower-ranked setup'
            +      (trimmedTail.length === 1 ? '' : 's')
            +      ' beyond top ' + OG_VIS_CAP + ' per side · <span class="dim">click to expand</span></summary>'
            +    '<div style="margin-top:8px">';
          for (var ti = 0; ti < trimmedTail.length; ti++){
            h += setupCard(trimmedTail[ti]);
          }
          h +=  '</div></details>';
        }
        if (deadLines){
          h += '<div class="note" style="margin-top:10px"><b>DEAD LEVELS — priced off a closed bar the market has left behind:</b>'
            +  deadLines + '</div>';
        }
        /* MEASURED-NEGATIVE KINDS — stood aside (hg-v533).
           v697 rule C: keep parity (nothing silently dropped) but
           collapse the whole demoted-cards section behind a <details>
           so the tab reads as 'tradable + a summary of what was stood
           aside'. Expanding shows the exact same block hg-v533 rendered. */
        if (ogDemotedCards.length){
          /* hg-v698 (audit fix): this summary is the ONLY text a reader sees
             before expanding, and it used to call all of them
             "measured-negative" — including the WATCH cards the block inside
             it explicitly separates out as NOT measured against. Same two
             counts as the status tally, from the same predicate. */
          h += '<details class="note" id="ogDemotedDetails" style="margin-top:12px">'
            +    '<summary style="cursor:pointer;padding:6px 0">▸ '
            +      ogDemotedCards.length + ' setup'
            +      (ogDemotedCards.length === 1 ? '' : 's')
            +      ' stood aside'
            +      (ogNegN ? ' · ' + ogNegN + ' measured-negative / venue stop floor' : '')
            +      (ogWatchN ? ' · ' + ogWatchN + ' WATCH (short of 3 confirmation classes)' : '')
            +      ' · <span class="dim">click to inspect</span></summary>'
            +    '<div style="margin-top:8px">'
            +      hgOgDemotedSectionHtml(ogDemotedCards)
            +    '</div>'
            + '</details>';
        }
        /* Prepend circuit breaker warning banner if active */
        var drawdownStateBanner = hgOgResetWeeklyDrawdown();
        var circuitBannerHtml = hgOgDrawdownCircuitBannerHtml(drawdownStateBanner);
        if (circuitBannerHtml) h = circuitBannerHtml + h;
        /* Pack 907: the HTF legs this scan actually used, judged for whether
           they are possible candles. OMNIGOLD held still on the malformed tape
           in the pack-907 harness, but that harness reaches very little of this
           desk, so the check goes on the tape rather than on its reach. W() is
           a FUNCTION in this file, not the window itself. */
        try {
          var __w907 = W();
          var __sh907 = __og.shared;
          if (__w907 && __sh907 && typeof __w907.hgGoldTapeNotes === 'function'){
            var __tn907 = '';
            if (__sh907.rows4h && __sh907.rows4h.length)
              __tn907 += __w907.hgGoldTapeNotes(__sh907.rows4h, '4h');
            if (__sh907.rows1d && __sh907.rows1d.length)
              __tn907 += __w907.hgGoldTapeNotes(__sh907.rows1d, '1d');
            if (__tn907) h = __tn907 + h;
          }
        } catch (e907) {}
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
            /* Same list TOP SETUP paints — never a held count that
               disagrees with the opposite-side panel. */
            ogHeld.n = heldCards.length;
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
              __og.lastScanAt = Date.now();
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
  /* v697 rule A: default to PAID-ONLY so users see only setups whose
     forward ledger reads 'has paid'. The old default of ALL surfaced
     every mechanic incl. those the tab's own replay marks negative;
     PAID is a stricter, honest starting view. ALL toggle remains one
     click away. Migration: a NEW third key encodes explicit user
     choice so returning users who never touched the toggle inherit
     the new default; only an explicit ALL click keeps ALL. */
  var OG_PAID_CHOICE_LS = 'hg_paidonly_OMNIGOLD_choice'; /* v697 */

  function hgOgShowMode(){
    try{
      if (typeof localStorage === 'undefined') return 'PAID';
      var explicit = localStorage.getItem(OG_PAID_CHOICE_LS);
      if (explicit === 'ALL') return 'ALL';
      if (explicit === 'PAID') return 'PAID';
      /* Legacy key still honored: '1' -> PAID, everything else -> new PAID default. */
      if (localStorage.getItem(OG_PAID_LS) === '1') return 'PAID';
      return 'PAID';
    }catch(e){ return 'PAID'; }
  }
  function hgOgShowModeSet(mode){
    try{
      if (typeof localStorage === 'undefined') return;
      /* v697: record the explicit choice so we never regress a
         deliberate ALL back to the new PAID default. */
      if (mode === 'PAID'){
        localStorage.setItem(OG_PAID_LS, '1');
        localStorage.setItem(OG_PAID_CHOICE_LS, 'PAID');
      } else {
        localStorage.removeItem(OG_PAID_LS);
        localStorage.setItem(OG_PAID_CHOICE_LS, 'ALL');
      }
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
    /* `sets || default` accepted any truthy object and then read s.union.length
       off it — a sets bag missing a key threw where the empty default would
       have rendered. Fill the gaps rather than trusting the shape. */
    var sIn = (sets && typeof sets === 'object') ? sets : {};
    var s = {
      SCALP: Array.isArray(sIn.SCALP) ? sIn.SCALP : [],
      SWING: Array.isArray(sIn.SWING) ? sIn.SWING : [],
      union: Array.isArray(sIn.union) ? sIn.union : []
    };
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
    hgOgStartUniformTimer();
    /* Venue selection FIRST — the desk-stance banner below prices its
       demotion counts at the active venue, so the persisted choice (or the
       XM default; PAXG when storage is unavailable) must be applied before
       any HTML is built. */
    hgOgVenueInit();
    hgOgEdgeProofInit();
    hgOgOneAtATimeInit();
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
      /* v697 rule B: collapse the DESK-STANCE (replay) verdict + DESK
         VERDICT (forward) block behind a single <details> so the tab
         opens on the setups, not on a wall of forensic paragraphs. The
         evidence is still one click away; nothing is deleted. */
      + '<details class="note" id="ogEvidenceDetails" style="margin-bottom:10px">'
      +   '<summary style="cursor:pointer;padding:6px 0">▸ measured evidence · replay + forward verdicts · <span class="dim">click to expand</span></summary>'
      +   '<div style="margin-top:8px">'
      +     hgOgDeskStanceBannerHtml()
      +     '<div id="ogFwdVerdict" style="margin-top:8px"></div>'
      +   '</div>'
      + '</details>'
      /* EXECUTION VENUE control + counts strip (hg-v537) — see
         hgOgVenueControlHtml for why changes apply on the next scan. */
      + hgOgVenueControlHtml()
      + '<div class="row"><button class="btn" id="ogRun">RUN GOLD SCAN</button>'
      +   ' <button class="btn" id="ogGrid">R / HORIZON GRID</button></div>'
      + '<div class="note" id="ogStat">idle — press RUN. Fetches two horizons of gold bars, then measures every mechanic on each.</div>'
      + '<div class="note warn" id="ogWarn" style="display:none"></div>'
      /* PAID-ONLY toggle (hg-v540) — stays visible above the picks. */
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
    /* Exported so the DST-aware local hour and its formatter cache are tested
       directly rather than inferred from a mechanic that fires twice a day. */
    window.hgOgLocalHour = hgOgLocalHour;
    window.hgOgWeekOpenPx = hgOgWeekOpenPx;
    window.hgOgAsiaRange = hgOgAsiaRange;
    window.hgOgPrevDay = hgOgPrevDay;
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

  /* A DEFAULT STATE, never a partial one. hgOgLoadDrawdownState used to
     return whatever JSON.parse produced — `null`, a number, a string, an
     array — and every caller then wrote `.weekStart` onto it. 'null' threw
     inside hgOgResetWeeklyDrawdown (which runScan calls at line ~10054 with
     no local try/catch), and a legacy object missing weekPnl/losStreak turned
     both counters into NaN on the first ++/+=, at which point
     `losStreak >= 3` and `weekPnl <= -2.0` are false forever — the auto-50%
     sizing and the -2% breaker silently off, showing as "Streak: undefinedL".
     Every field is coerced here so no downstream reader has to. */
  function hgOgDrawdownDefaults(){
    return {
      weekStart: hgOgMondayIstIso(new Date()),
      weekPnl: 0,
      losStreak: 0,
      settles: 0,
      isCircuitBreakerActive: false
    };
  }
  function hgOgNormalizeDrawdownState(raw){
    var d = hgOgDrawdownDefaults();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
    var ws = raw.weekStart;
    if (typeof ws === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ws)) d.weekStart = ws;
    d.weekPnl = isFinite(+raw.weekPnl) ? +raw.weekPnl : 0;
    d.losStreak = isFinite(+raw.losStreak) ? Math.max(0, Math.floor(+raw.losStreak)) : 0;
    d.settles = isFinite(+raw.settles) ? Math.max(0, Math.floor(+raw.settles)) : 0;
    d.isCircuitBreakerActive = raw.isCircuitBreakerActive === true;
    return d;
  }

  function hgOgLoadDrawdownState(){
    var raw = null;
    try {
      var stored = localStorage.getItem('hg_og_drawdown_state');
      if (stored) raw = JSON.parse(stored);
    } catch (e) { raw = null; }
    return hgOgNormalizeDrawdownState(raw);
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
      state.settles = 0;
      state.isCircuitBreakerActive = false;
      hgOgSaveDrawdownState(state);
    }
    return state;
  }

  /* THE DESK'S CONSECUTIVE-LOSS STREAK, FROM THE LEDGER THAT SETTLES TRADES.

     hgOgUpdateDrawdownOnSettle is the only writer of state.losStreak and it
     has no call site, so the counter was zero forever: the auto-50% sizing
     reduction and the -2% breaker were advertised on the tab and could never
     fire. The panel already said "unavailable" rather than printing a
     fabricated zero, which was right — but it was honest about a control
     that did not work, and that is not the same as the control working.

     The forward ledger settles every recorded setup as a win, a loss or an
     expiry, with the time the outcome landed. A consecutive-loss streak is
     exactly what that record can answer, and it needs no account equity to
     do it. weekPnl still does — R to % requires equity and risk-per-trade
     that this app has no concept of — so that half stays unavailable rather
     than being invented from a constant.

     Both horizons pool: the drawdown control is a property of the DESK, and
     three losses are three losses whether they came from SCALP or SWING. */
  var OG_FWD_TABS = ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING'];

  function hgOgFwdLossStreak(){
    var f = gfn('hgFwdLossStreak');
    if (!f) return null;
    try {
      var r = f(OG_FWD_TABS);
      return (r && isFinite(fin(r.streak)) && isFinite(fin(r.settled))) ? r : null;
    } catch (e) { return null; }
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

  /* TWO NUMBERS ON ONE TAB HAVE TO BE THE SAME NUMBER. This pill showed a
     sizing percentage computed from confluence and queue depth alone, while
     the drawdown panel a few inches away announced "Sizing: auto-50%" off
     the loss streak. hgOgApplyDrawdownSizing existed to reconcile them and
     was called by nobody. The streak reduction now lands here too, so the
     card cannot advertise 100% while the desk is halved. */
  function hgOgRiskBadgeHtml(stack3, heldCount){
    if (stack3 === 0) return '';
    var sizing = hgOgCalculateRiskScale(stack3, heldCount);
    var scale = sizing.scale;
    var reason = sizing.reason;

    var ls = hgOgFwdLossStreak();
    var streak = (ls && fin(ls.settled) > 0) ? fin(ls.streak) : 0;
    if (hgOgGetConsecutiveLossReduction(streak) < 1){
      scale = scale * hgOgGetConsecutiveLossReduction(streak);
      reason = (reason ? reason + ' · ' : '') + 'halved on ' + streak + ' losses in a row';
    }

    var cls = scale >= 1.0 ? 'ok' : (scale >= 0.5 ? 'warn' : 'bad');
    var txt = (scale * 100).toFixed(0) + '% sizing';
    if (reason) txt += ' (' + reason + ')';

    return pill(txt, cls);
  }

  function hgOgDrawdownMetricsHtml(state){
    state = hgOgNormalizeDrawdownState(state || hgOgResetWeeklyDrawdown());
    /* NOTHING HAS BEEN SETTLED INTO THIS PANEL. hgOgUpdateDrawdownOnSettle is
       the only writer and it has no call site, so "Week P&L: 0% | Streak: 0L"
       was a fabricated measurement, not a measured zero — the tab's own house
       rule is unavailable over estimates. Say unread until a settle lands.
       (The R-denominated forward ledger cannot feed weekPnl: this file has no
       account-equity or risk-per-trade concept, so R -> % would be an invented
       constant. See the report note.) */
    /* THE STREAK IS NOW READ, NOT WAITED FOR. The stored counter still has no
       writer; the forward ledger does, and a consecutive-loss streak is
       exactly what a settled record can answer. Week P&L still cannot be
       answered — turning R into % needs account equity and risk-per-trade
       that no tab here carries — so the two halves are reported separately
       instead of one unavailable swallowing the other. */
    var ls = hgOgFwdLossStreak();
    var lsN = (ls && fin(ls.settled) > 0) ? fin(ls.settled) : 0;
    var streak = lsN > 0 ? fin(ls.streak) : 0;

    var html = '<span class="dim">Week P&amp;L: ';
    if (state.settles > 0 && isFinite(state.weekPnl) && state.weekPnl !== 0){
      html += (state.weekPnl >= 0 ? '+' : '') + state.weekPnl.toFixed(1) + '%';
    } else {
      /* not a measured zero — nothing has ever been settled in percent here */
      html += 'unavailable (no equity basis — the ledger measures in R)';
    }

    html += ' &middot; Streak: ';
    if (lsN > 0){
      html += streak + 'L';
      html += ' (from ' + hgOgFmtCount(lsN) + ' settled ' + (lsN === 1 ? 'trade' : 'trades')
            + ', ' + hgOgFmtCount(fin(ls.wins)) + 'W/' + hgOgFmtCount(fin(ls.losses)) + 'L'
            + (fin(ls.expired) > 0 ? '/' + hgOgFmtCount(fin(ls.expired)) + ' expired' : '') + ')';
      if (hgOgGetConsecutiveLossReduction(streak) < 1) html += ' | Sizing: auto-50%';
    } else {
      html += 'unavailable (nothing settled in the forward ledger yet)';
    }

    if (state.isCircuitBreakerActive){
      html += ' | <b style="color:red">CIRCUIT BREAKER ACTIVE</b>';
    }
    html += '</span>';
    return html;
  }

  function hgOgDrawdownCircuitBannerHtml(state){
    if (!state || state.isCircuitBreakerActive !== true) return '';
    /* weekPnl.toFixed threw on a legacy state that carried the flag but not
       the number, taking the whole MOST PROBABLE render down with it. */
    var pnl = isFinite(+(state && state.weekPnl)) ? +state.weekPnl : null;
    var html = '<div style="background:#ffe0e0;border:1px solid #ff6666;border-radius:4px;'
             + 'padding:10px;margin:8px 0;color:#cc0000;font-weight:bold;">'
             + '⚠ Drawdown Circuit Breaker: '
             + (pnl === null ? 'week P&amp;L unavailable' : ((pnl >= 0 ? '+' : '') + pnl.toFixed(1) + '% week'))
             + ' | PAUSE ENTRIES until next Mon</div>';
    return html;
  }

  function hgOgUpdateDrawdownOnSettle(outcome, pnl){
    /* Called when a setup settles (outcome = 'win' or 'loss', pnl = numeric or null).
       `settles` counts the folds so the panel can tell "measured zero" from
       "never fed" instead of printing a fabricated 0% / 0L. */
    var state = hgOgResetWeeklyDrawdown();

    if (outcome !== 'win' && outcome !== 'loss') return state;
    state.settles++;

    /* Update consecutive loss streak */
    if (outcome === 'loss'){
      state.losStreak++;
    } else if (outcome === 'win'){
      state.losStreak = 0;
    }

    /* Accumulate weekly P&L if provided. `+pnl` so a numeric string cannot
       turn the running total into a concatenated string (and then NaN). */
    if (isFinite(+pnl) && +pnl !== 0){
      state.weekPnl += +pnl;
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

  /* Apply the consecutive-loss auto-reduction on top of other sizing.

     `state` is honoured when a caller passes one — that is the stored path,
     and it is what a test drives. With no state, the streak comes from the
     forward ledger rather than from the stored counter nothing writes, so
     the default argument is the live reading and not a permanent 1.0. */
  function hgOgApplyDrawdownSizing(riskScale, state){
    var streak;
    if (state){
      streak = hgOgNormalizeDrawdownState(state).losStreak;
    } else {
      var ls = hgOgFwdLossStreak();
      streak = (ls && fin(ls.settled) > 0) ? fin(ls.streak) : 0;
    }
    return riskScale * hgOgGetConsecutiveLossReduction(streak);
  }

  window.hgOgLoadDrawdownState = hgOgLoadDrawdownState;
  window.hgOgNormalizeDrawdownState = hgOgNormalizeDrawdownState;
  window.hgOgSaveDrawdownState = hgOgSaveDrawdownState;
  window.hgOgResetWeeklyDrawdown = hgOgResetWeeklyDrawdown;
  window.hgOgCalculateRiskScale = hgOgCalculateRiskScale;
  window.hgOgRiskBadgeHtml = hgOgRiskBadgeHtml;
  window.hgOgDrawdownMetricsHtml = hgOgDrawdownMetricsHtml;
  window.hgOgDrawdownCircuitBannerHtml = hgOgDrawdownCircuitBannerHtml;
  window.hgOgUpdateDrawdownOnSettle = hgOgUpdateDrawdownOnSettle;
  window.hgOgGetConsecutiveLossReduction = hgOgGetConsecutiveLossReduction;
  window.hgOgApplyDrawdownSizing = hgOgApplyDrawdownSizing;
  window.hgOgFwdLossStreak = hgOgFwdLossStreak;
  window.HG_OG_FWD_TABS = OG_FWD_TABS;

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
    /* exported so the overlap deflation can be tested on its own: it is
       what decides whether a mechanic reaches PROVEN EDGE */
    window.hgOgEffN = hgOgEffN;
    /* publication throttle — pure, so the rate the desk publishes at can
       be tested without a mount */
    window.hgOgLaneCooldownMs = hgOgLaneCooldownMs;
    window.hgOgEdgeProofPanelHtml = hgOgEdgeProofPanelHtml;
    /* pure Bonferroni bar — exported so a test can check the ledger against
       the same number the gate and the panel use, not a copy of it */
    window.hgOgFamilyZ = hgOgFamilyZ;
    /* the population measured-edge judges on since it went hard */
    window.hgOgGateClear = hgOgGateClear;
    window.hgOgHorizonPoolTests = hgOgHorizonPoolTests;
    /* the one-line reason, for every surface the hard edge gate emptied */
    window.hgOgEdgeSilenceNote = hgOgEdgeSilenceNote;
    window.hgOgEdgeProgressHtml = hgOgEdgeProgressHtml;
    window.hgOgMpNoneWhyTape = hgOgMpNoneWhyTape;
    window.hgOgLaneThrottle = hgOgLaneThrottle;
    /* drawdown / streak panel + its baked numbers */
    window.hgOgBookExperienceHtml = hgOgBookExperienceHtml;
    window.hgOgEvidenceStale = hgOgEvidenceStale;
    window.hgOgEvidenceStaleHtml = hgOgEvidenceStaleHtml;
    window.HG_OG_EVIDENCE_GATESET = HG_OG_EVIDENCE_GATESET;
    window.HG_OG_BOOK_EXPERIENCE = HG_OG_BOOK_EXPERIENCE;
    window.hgOgFillRate = hgOgFillRate;
    window.hgOgFillRateNoteHtml = hgOgFillRateNoteHtml;
    window.HG_OG_FILL_RATES = HG_OG_FILL_RATES;
    window.ogTradeKey = ogTradeKey;
    window.hgOgSettledEvidence = hgOgSettledEvidence;
    window.hgOgEvidenceScopeTxt = hgOgEvidenceScopeTxt;
    window.hgOgPromotionZ = hgOgPromotionZ;
    window.hgOgOverlapKnown = hgOgOverlapKnown;
    window.hgOgTierBlock = hgOgTierBlock;
    window.hgOgOverlapScopeTxt = hgOgOverlapScopeTxt;
    window.hgOgSettledOverlapRatio = hgOgSettledOverlapRatio;
    window.hgOgEvBound = hgOgEvBound;
    window.hgOgSettledExecuteOk = hgOgSettledExecuteOk;
    window.hgOgPickSettledExecutes = hgOgPickSettledExecutes;
    window.hgOgProvenEdgeOk = hgOgProvenEdgeOk;
    window.hgOgBreakevenHit = hgOgBreakevenHit;
    window.hgOgEdgeMargin = hgOgEdgeMargin;
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
    window.hgOgSetupCard = function(c, tape){
      var prev = __og.tape;
      if (tape === 'long' || tape === 'short'){
        __og.tape = { desk: tape, scalp: tape, swing: tape };
      }
      try { return setupCard(c); }
      finally { if (tape === 'long' || tape === 'short') __og.tape = prev; }
    };
    window.hgOgHeldQueueHtml = hgOgHeldQueueHtml;
    window.hgOgHeldCards = hgOgHeldCards;
    window.hgOgOppositeAsideHtml = hgOgOppositeAsideHtml;
    window.hgOgInfoNet = hgOgInfoNet;
    window.hgOgBalanceScore = hgOgBalanceScore;
    window.hgOgBalanceParts = hgOgBalanceParts;
    window.hgOgDeskOrder = hgOgDeskOrder;
    /* exported so the kill-list-before-the-pick order runScan uses is
       testable without a mount (v689 repair). */
    window.hgOgStampSolidity = hgOgStampSolidity;
    window.hgOgMostProbablePanelHtml = hgOgMostProbablePanelHtml;
    /* TOP SETUP — gate-ledger-fed card (hg-v541); exported so the pick,
       the level-fresh re-check and the stand-aside copy are testable
       without a mount. */
    window.hgOgTopSetupPick = hgOgTopSetupPick;
    window.hgOgTopSetupFresh = hgOgTopSetupFresh;
    window.hgOgSetupActivation = hgOgSetupActivation;
    window.hgOgSetupActivationHtml = hgOgSetupActivationHtml;
    window.hgOgTopSetupPanelHtml = hgOgTopSetupPanelHtml;
    window.hgOgPaintTopSetup = hgOgPaintTopSetup;
    window.hgOgInjectSection = hgOgInjectSection;
    window.hgOgNormalizeGrade = hgOgNormalizeGrade;
    window.hgOgGradeChipHtml = hgOgGradeChipHtml;
    window.hgOgGradeLegendHtml = hgOgGradeLegendHtml;
    window.hgOgMpHorizonHtml = hgOgMpHorizonHtml;
    window.hgOgTargetReadout = hgOgTargetReadout;
    window.hgOgRunnerReadout = hgOgRunnerReadout;
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
    window.hgOgLetterConfluenceScore = hgOgLetterConfluenceScore;
    window.hgOgAdvancedConfluenceScore = hgOgAdvancedConfluenceScore;  /* 0-100 agrees with the letter (hg-v585) */
    window.hgOgDeskTape = hgOgDeskTape;
    window.hgOgTapeBannerHtml = hgOgTapeBannerHtml;
    window.hgOgZoneLevels = hgOgZoneLevels;   /* the desk's own anticipation levels, testable */
    window.hgOgZonesPanel = hgOgZonesPanel;
    /* Replay evidence + cost drag (ADDITIVE) — PAXG 1h replay 2026-03-27..
       09-10, 54 kinds summing to n=7953 settled; see
       scripts/omnigold-replay-evidence.json.
       (hg-v910 corrected the window and n here too.)
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
    window.hgOgSwingPrefer = hgOgSwingPrefer;
    window.HG_OG_SWING_PREFER = HG_OG_SWING_PREFER;
    window.hgOgFormation = hgOgFormation;
    window.hgOgDemotedSectionHtml = hgOgDemotedSectionHtml;
    /* hg-v698: the unified >=3-distinct-class confluence read and the WATCH
       section it feeds, exported so both are testable without a mount. */
    window.hgOgConfluenceFor = hgOgConfluenceFor;
    window.hgOgWatchSectionHtml = hgOgWatchSectionHtml;
    window.hgOgStoodAsideSplit = hgOgStoodAsideSplit;
    window.HG_OG_FORM_COST_R_MAX = HG_OG_FORM_COST_R_MAX;
    window.hgOgCostChipHtml = hgOgCostChipHtml;
    window.hgOgReplayEvidence = hgOgReplayEvidence;
    window.hgOgSequentialCellsHtml = hgOgSequentialCellsHtml;
    window.hgOgCostCeilingDemand = hgOgCostCeilingDemand;
    window.hgOgCostCeilingNote = hgOgCostCeilingNote;
    window.hgOgCostCeilingPanelHtml = hgOgCostCeilingPanelHtml;
    window.hgOgCostCeilingScanTally = hgOgCostCeilingScanTally;
    window.hgOgCostCeilingScanNoteHtml = hgOgCostCeilingScanNoteHtml;
    window.hgOgBlockerFunnelHtml = hgOgBlockerFunnelHtml;
    window.hgOgSetEdgeProof = hgOgSetEdgeProof;
    window.hgOgEdgeProofInit = hgOgEdgeProofInit;
    window.hgOgEdgeRelaxedTally = hgOgEdgeRelaxedTally;
    window.hgOgEdgeRelaxedPanelHtml = hgOgEdgeRelaxedPanelHtml;
    window.hgOgSetOneAtATime = hgOgSetOneAtATime;
    window.hgOgOneAtATimeInit = hgOgOneAtATimeInit;
    window.hgOgOpenGoldConvictions = hgOgOpenGoldConvictions;
    window.hgOgHoldingRowsHtml = hgOgHoldingRowsHtml;
    window.hgOgOneAtATimeHtml = hgOgOneAtATimeHtml;
    window.hgOgOneAtATimeGate = hgOgOneAtATimeGate;
    window.HG_OG_WALK = HG_OG_WALK;
    window.hgOgWalkAgeDays = hgOgWalkAgeDays;
    window.hgOgWalkAgeHtml = hgOgWalkAgeHtml;
    window.hgOgUnobservedPanelHtml = hgOgUnobservedPanelHtml;
    window.hgOgSelectionRefusedHtml = hgOgSelectionRefusedHtml;
    window.HG_OG_SELECTION = HG_OG_SELECTION;
    window.hgOgFactorSepPanelHtml = hgOgFactorSepPanelHtml;
    window.HG_OG_FACTOR_SEP = HG_OG_FACTOR_SEP;
    window.hgOgReplayLineHtml = hgOgReplayLineHtml;
    window.hgOgReplayBelowBarHtml = hgOgReplayBelowBarHtml;
    window.hgOgKindKnownState = hgOgKindKnownState;
    window.hgOgFwdSplitsPanelHtml = hgOgFwdSplitsPanelHtml;
    window.hgOgFwdBucketTxt = hgOgFwdBucketTxt;
    window.hgOgUnobservedKinds = hgOgUnobservedKinds;
    window.hgOgSiblingRecordNote = hgOgSiblingRecordNote;
    window.hgOgDirSibling = hgOgDirSibling;
    window.hgOgDirSiblingLineHtml = hgOgDirSiblingLineHtml;
    window.OG_DIR_PAIRS = OG_DIR_PAIRS;
    window.hgOgReplayNetAtVenue = hgOgReplayNetAtVenue;
    window.hgOgReplayEdgeVerdict = hgOgReplayEdgeVerdict;
    window.hgOgReplayFamilySize = hgOgReplayFamilySize;
    window.hgOgInvNorm = hgOgInvNorm;
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
    window.hgOgCohortClaim = hgOgCohortClaim;
    window.hgOgCohortNetTxt = hgOgCohortNetTxt;
    window.hgOgCohortNTxt = hgOgCohortNTxt;
    window.hgOgCohortPfTxt = hgOgCohortPfTxt;
    window.hgOgCohortBook = hgOgCohortBook;
    window.hgOgCohortStanceTxt = hgOgCohortStanceTxt;
    window.hgOgClaimRecordTxt = hgOgClaimRecordTxt;
    window.hgOgGradeOrder = hgOgGradeOrder;
    window.hgOgGradeOrderTxt = hgOgGradeOrderTxt;
    window.hgOgEvidenceHealth = hgOgEvidenceHealth;
    window.hgOgEvidenceHealthHtml = hgOgEvidenceHealthHtml;
    window.hgOgGroupSettled = hgOgGroupSettled;
    window.hgOgVenueNet = hgOgVenueNet;
    window.hgOgWindowStart = hgOgWindowStart;
    /* the replay's detector map and the clock it reads, exported so a test
       can hold every entry to the invariant this file claims for them:
       a replayed detector sees the bars and nothing else */
    window.hgOgBtDetectors = hgOgBtDetectors;
    window.hgOgBtLastSec = hgOgBtLastSec;
    /* exported so a test can drive the true-range path that a missing
       bar field used to turn into the gold price — see num() */
    window.hgOgAtrOf = atrOf;
    window.hgOgReplayZ = hgOgReplayZ;
    /* the family every significance bar on this tab corrects for */
    window.HG_OG_MECHANIC_COUNT = OG_MECHANICS.length;
    window.HG_OG_EFF_N_RATIO = OG_EFF_N_RATIO;
    window.HG_OG_EVIDENCE_GROUPS = OG_EVIDENCE_GROUPS;
    window.hgOgSpectrumLegendCellsHtml = hgOgSpectrumLegendCellsHtml;
    window.HG_OG_MIN_SAMPLES = MIN_SAMPLES;
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
    /* hg-v938: THE EVALUATED CARDS, for a desk that wants this one's gates.

       MILLI GOLD shipped in hg-v936 running its OWN scan — hgOgDetect and
       hgOgEvaluate called with an EMPTY extra — and that was wrong in a way
       the tab then advertised the opposite of. This desk hands its evaluator
       about twenty fields (daily and 4h bars, macro, DXY and yield rows, ADR,
       news, live and market price, zone context, PAXG basis, quote, L2, bid,
       ask, the scan clock, the pooled stats). With none of them roughly
       fourteen gates FAIL OPEN to UNCHECKED — so a tab that claimed "every
       gate still applies" was in fact LESS gated than this one, which is the
       opposite of what it promised and the opposite of safe.

       Exporting the cards themselves removes the whole class of bug: there is
       no second context to keep in step, because there is no second scan. A
       consumer filters what this desk already gated. Returned by reference on
       purpose — these are live card objects with their gate ledgers attached,
       and a JSON round-trip would drop exactly the structure a consumer needs
       (hgOgState stays the JSON-safe snapshot for anyone who wants one). */
    /* The bars that scan ran on, for a consumer that must apply the shared
       gold tape rule to the SAME series it is showing cards from. Reading a
       fresh series would judge a different tape than the one on screen. */
    window.hgOgLastRows = function hgOgLastRows(tf){
      try{
        var r = __og && __og.lastRows;
        if (!r) return [];
        if (tf === '4h') return r.swing || [];
        return r.scalp || r.m15 || [];
      }catch(e){ return []; }
    };
    window.hgOgLastCards = function hgOgLastCards(){
      try{
        if (!__og) return null;
        /* `ran` IS THE AUTHORITY ON WHETHER A SCAN HAPPENED, not lastView.

           hg-v938 read lastView alone and returned null without it — but this
           desk sets `__og.lastView = null` DELIBERATELY on its honest-empty /
           no-candles branch (see the hg-v540 comment there): that is "scanned,
           nothing to show", not "never scanned". Conflating the two told MILLI
           GOLD to report a completed scan as still pending, and to ask this
           desk to refresh on EVERY paint — a scan storm on the quietest tape,
           which is exactly when the board is legitimately empty. So an empty
           board returns an EMPTY LIST with ran:true, and only a desk that has
           genuinely never run returns null. */
        if (!__og.ran) return null;
        var v = __og.lastView;
        var cards = (v && Array.isArray(v.collapsed)) ? v.collapsed : [];
        return { cards: cards, at: __og.lastScanAt || 0, ran: true };
      }catch(e){ return null; }
    };
    window.hgOgState = function hgOgState(){
      try { return __og.snap ? JSON.parse(JSON.stringify(__og.snap)) : null; } catch (e) { return null; }
    };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'omnigold', label: 'OMNIGOLD', mount: mountOmnigold, refresh: refreshOmnigold });
  }

})();
