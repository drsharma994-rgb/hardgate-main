/* =========================================================================
   CRYPTO SCAN v3 Voting Logic — Three-Layer Consensus with Risk Gates

   Architecture:
   Layer 1 (Price Action): 470 indicators, 40% weight
   Layer 2 (Order Flow): 4-5 reads, 35% weight
   Layer 3 (External): Sentiment (25%) + Liquidation Risk + Whale Activity

   Consensus Rule: Entry fires IF Layer 1 agrees AND (L2 OR L3 doesn't contradict)
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/**
 * Three-Layer Confidence Calculation (v3 final)
 *
 * Input: L1_score, L1_dir, L2_score, L2_dir, L3_sentiment, externalRisk
 * Output: finalConfidence (0-1), shouldTrade (bool), gateReasons (array)
 */
function hgComputeThreeLayerConfidence(l1, l2, l3, externalRisk) {
  var gates = [];

  /* Layer 3 is an ABSOLUTE market read, not a per-trade agreement score:
     sentiment.js scores +1 bullish / -1 bearish for the SYMBOL, and it is
     hgSentimentScoreSignal there that turns that into agreement with a trade
     (alignment = score for a long, -score for a short). This function used to
     add the raw score for both directions, and on a SHORT that is exactly
     backwards — the bullish read, the one that CONTRADICTS the trade, added
     confidence, and the bearish read that confirms it subtracted.

     Measured on one setup with identical price and flow reads, pct 0.80 and
     flow 0.5, changing nothing but the sentiment:

       short + sentiment -0.80 (bearish, CONFIRMS)     0.339  weak          no trade
       short + sentiment +0.80 (bullish, contradicts)  0.799  professional  trade

     The short was blocked when the market agreed with it and promoted to
     PROFESSIONAL when the market disagreed. Longs were right all along, so the
     fault was invisible on half the book.

     It is not hypothetical on the shipped cache: scripts/sentiment-cache/
     sentiment.json carries BTCUSDT, ETHUSDT and SOLUSDT all at +0.272. Over a
     200-cell grid of short setups (price agreement 0.60-0.98 x flow 0.0-0.9),
     37 of them — 18.5% — held the >=0.75 pro-grade bar ONLY because the sign
     was wrong; none lost out the other way. 86 changed tier and 70 changed
     shouldTrade. That bar is what cryptoscan.js calls HIGH-QUALITY and what it
     writes to the forward log as `ticket`, so the desk was also grading its own
     strongest cohort on it.

     Direction unknown contributes nothing rather than a sign picked at random,
     which is what hgSentimentScoreSignal does too (it returns the base
     confidence untouched when direction is neither long nor short). */
  var l3Raw = (l3 && l3.sentiment != null && isFinite(+l3.sentiment)) ? +l3.sentiment : 0;
  var l3Aligned = l1.dir === 'long' ? l3Raw : l1.dir === 'short' ? -l3Raw : 0;

  /* Layer 2 is signed the same way (order-flow.js: -1..+1, positive = buying
     pressure), and it used to enter as Math.abs(l2.score). The reasoning was
     that magnitude is conviction and the +-15/20% agreement multiplier below
     carries the direction. Composed, it does not: the multiplier is far too
     small to undo a 0.35-weighted magnitude term, so the curve is V-SHAPED in
     agreement with its MINIMUM at flow = 0. One long, pct 0.90, sentiment
     +0.60, sweeping the flow read from fully against to fully with:

       flow -0.9 (hard against)  0.660
       flow -0.5                 0.548
       flow  0.0 (NO OPINION)    0.408   <- the lowest point on the curve
       flow +0.5                 0.788
       flow +0.9 (hard with)     0.949

     The harder order flow argued AGAINST the trade, the more confident the
     desk became. Over 200 swept configurations that held in every one: 100%
     non-monotone, and in 100% a neutral flow scored below an opposing one.

     Two causes, and both are here. Math.abs() credits conviction-against to
     the base. And 'neutral' is a truthy string, so the l2.dir compare below
     read no-opinion as disagreement, charging it the 0.80 penalty and printing
     "L1/L2 divergence" on the card while giving it none of the magnitude
     credit an opposing read got. A flow reader that RAN and said neutral
     therefore scored BELOW one that was never loaded at all (0.408 vs 0.510).

     Layer 2 is now read relative to the trade, exactly as layer 3 is, and only
     a real long/short call takes the multiplier. The agreeing case is
     arithmetically untouched (|score| and the aligned score are the same
     number whenever flow points the way the trade does), so no pro-grade
     verdict moves - that stamp requires layerAgreement === 2, which IS the
     agreeing case. The +-15/20% multiplier stays as it is: it now double-counts
     direction mildly, but removing it would re-tune every number on the tab,
     and that is a calibration decision, not this defect. */
  /* What layer 2 actually is, measured rather than assumed: every read in
     order-flow.js is computed from the same OHLCV candles layer 1 votes on —
     there is no order book, trade tape or liquidation feed in that file. Over
     56 synthetic tapes fed to both engines, the correlation between layer-1
     direction and layer-2 score is 0.957, and layer 2 agreed with layer 1 on
     53 of 56 (95%).

     That matters here because the +15% bonus below pays out on exactly those
     agreements, so most of the time it is rewarding one price read twice, and
     the 0.35 weight is not buying the independence the architecture claims.
     The weights and the bonus are LEFT ALONE: changing either re-tunes every
     number the tab has ever printed, which is a calibration decision and the
     desk's to make. What is fixed is that the layer now says what it is. */
  var l2Raw = (l2 && l2.score != null && isFinite(+l2.score)) ? +l2.score : 0;
  var l2Aligned = l1.dir === 'long' ? l2Raw : l1.dir === 'short' ? -l2Raw : 0;
  /* only a real call is a call; 'neutral' and undefined are not disagreement */
  var l2Dir = (l2 && (l2.dir === 'long' || l2.dir === 'short')) ? l2.dir : null;

  /* Base confidence: weighted average of three layers */
  var confidence = (l1.pct * 0.40) +           /* Layer 1: Price (40%) */
                   (l2Aligned * 0.35) +        /* Layer 2: Order Flow, vs THIS trade (35%) */
                   (l3Aligned * 0.25);         /* Layer 3: Sentiment, vs THIS trade (25%) */

  /* Clamp to valid range */
  confidence = Math.max(0, Math.min(1, confidence));

  /* --- LAYER AGREEMENT BONUSES --- */
  if (l1.dir && l2Dir && l1.dir === l2Dir){
    /* L1 and L2 agree: strong signal */
    confidence *= 1.15;  /* +15% */
  } else if (l1.dir && l2Dir){
    /* L1 and L2 disagree: weak signal. Reached only on a real long/short
       call from the flow layer — a neutral read is silence, not dissent. */
    confidence *= 0.80;  /* -20% */
    gates.push('L1/L2 divergence');
  }

  /* --- EXTERNAL RISK GATES --- */
  if (externalRisk && externalRisk.cascadeImminent){
    /* Liquidation cascade incoming: block longs entirely */
    if (l1.dir === 'long'){
      gates.push('LIQUIDATION_CASCADE');
      return { confidence: 0, shouldTrade: false, gateReasons: gates, override: false };
    }
    /* Shorts may be profitable during cascade, but penalize */
    confidence *= 0.85;
  }

  if (externalRisk && externalRisk.whaleActive && externalRisk.recommendation === 'CAUTION_LONGS'){
    if (l1.dir === 'long'){
      /* Whale distribution + long signal = risky */
      confidence *= 0.75;  /* -25% */
      gates.push('Whale distribution (longs risky)');
    }
  }

  /* --- FINAL GATES --- */
  var shouldTrade = true;

  if (confidence >= 0.85){
    /* Very high confidence: trade */
    return {
      confidence: confidence,
      shouldTrade: true,
      gateReasons: gates,
      override: false,
      tier: 'professional-grade'
    };
  } else if (confidence >= 0.75){
    /* High confidence: trade with caution flag */
    return {
      confidence: confidence,
      shouldTrade: true,
      gateReasons: gates,
      override: false,
      tier: 'professional'
    };
  } else if (confidence >= 0.65){
    /* Medium confidence: trade only if no major conflicts */
    if (gates.length > 1){
      shouldTrade = false;
      gates.push('Multiple gate conflicts');
    }
    return {
      confidence: confidence,
      shouldTrade: shouldTrade,
      gateReasons: gates,
      override: false,
      tier: 'standard'
    };
  } else {
    /* Low confidence: block */
    return {
      confidence: confidence,
      shouldTrade: false,
      gateReasons: gates.concat(['Low confidence']),
      override: false,
      tier: 'weak'
    };
  }
}

/**
 * Consensus Summary (for card display)
 */
function hgVotingSummary(l1, l2, l3, voteResult) {
  var summary = '';

  /* Layer 1 */
  summary += '🔵 Price: ' + Math.round(l1.pct * 100) + '% (' + l1.dir.toUpperCase() + ') · ';

  /* Layer 2 */
  var l2Emoji = l2.dir === 'long' ? '🟢' : l2.dir === 'short' ? '🔴' : '⚪';
  summary += l2Emoji + ' Flow: ' + (l2.dir || 'neutral').toUpperCase() + ' (' + Math.round(Math.abs(l2.score || 0) * 100) + '%) · ';

  /* Layer 3 */
  var l3Emoji = l3.sentiment > 0.3 ? '🟢' : l3.sentiment < -0.3 ? '🔴' : '🟡';
  summary += l3Emoji + ' Sentiment: ' + (l3.sentiment || 0).toFixed(2);

  /* Agreement status. Same rule as hgComputeThreeLayerConfidence: 'neutral' is
     a truthy string, so reading it as dissent would print DIVERGE at a layer
     that simply had no opinion. Nothing calls hgVotingSummary today — the tab
     builds its own layer line — so this corrects a copy of the defect rather
     than a live readout, which is why it is worth correcting now. */
  var l1d = l1 && l1.dir, l2d = (l2 && (l2.dir === 'long' || l2.dir === 'short')) ? l2.dir : null;
  if (l1d && l2d && l1d === l2d){
    summary += ' · ✅ AGREE';
  } else if (l1d && l2d){
    summary += ' · ❌ DIVERGE';
  }

  return summary;
}

/**
 * Professional vs Retail Trade Filtering
 *
 * What the PROFESSIONAL-GRADE stamp actually requires, in the order the code
 * applies it — and it is worth stating exactly, because the stamp is what
 * cryptoscan.js turns into its HIGH-QUALITY block and into `ticket` in the
 * forward log:
 *   1. three-layer confidence >= 0.75
 *   2. price and ORDER FLOW pointing the same way (layerAgreement === 2)
 *   3. no imminent liquidation cascade
 *   4. every one of the tab's quality gates clear (confidence, regime,
 *      session, voting gate, sentiment conflict)
 *
 * Three things it does NOT require, despite earlier wording here:
 *
 *   - Sentiment agreement is not part of (2). layerAgreement is computed in
 *     cryptoscan.js from order flow versus price and nothing else; sentiment
 *     reaches the stamp only through the confidence number in (1).
 *
 *   - (3) is a live gate with a dead feed, and pack 863 listed it as a
 *     satisfied standard without checking. Every reader in
 *     liquidation-intelligence.js is an unwired placeholder, so
 *     hgExternalRiskScore returns one identical object for every symbol and
 *     cascadeImminent is a constant false — which makes noLiquidationRisk
 *     true on every setup that has ever been stamped. Unlike positiveRR
 *     below, this one is vacuous through ABSENCE rather than by
 *     construction: it starts discriminating the day a feed lands, which is
 *     why it stays in the conjunction. What changed is that the layer now
 *     reports measured:false and the card prints UNCHECKED, so nobody reads
 *     a missing measurement as a clean bill of health.
 *
 *   - Risk-reward is not a filter, and cannot be one as the plan is built
 *     today. positiveRR below reads plan.rr1, and cryptoultra.js sets that to
 *     the constant RULE.t1R = 1.5 on every plan it prices, so the check is
 *     1.5 >= 1.5 for every setup that has ever existed — true by construction.
 *     It stays in `checks` because it is reported, not because it filters, and
 *     it is deliberately left OUT of the conjunction: adding it would look
 *     like a tightened standard while changing no verdict at all. A real R:R
 *     standard needs a plan whose reward is measured per setup, not a fixed
 *     ladder, and that belongs in cryptoultra.js.
 */
function hgIsProGradeSetup(setup) {
  if (!setup) return { isPro: false, checks: null, tier: 'RECORD-ONLY' };

  var checks = {
    highConfidence: (setup.threeLayerConfidence || 0) >= 0.75,
    layerAgreement: setup.layerAgreement === 2,  /* price and order flow, not sentiment */
    noLiquidationRisk: !setup.externalRisk || !setup.externalRisk.cascadeImminent,
    qualityGates: (setup.qualityGates || []).length === 0,
    /* vacuous while plan.rr1 is cryptoultra's fixed 1.5R ladder — see above */
    positiveRR: !!(setup.plan && (setup.plan.rr1 || 0) >= 1.5)
  };

  var proGrade = checks.highConfidence &&
                 checks.layerAgreement &&
                 checks.noLiquidationRisk &&
                 checks.qualityGates;

  return {
    isPro: proGrade,
    checks: checks,
    tier: proGrade ? 'PROFESSIONAL-GRADE' : 'RECORD-ONLY'
  };
}

/* Export */
G.hgComputeThreeLayerConfidence = hgComputeThreeLayerConfidence;
G.hgVotingSummary = hgVotingSummary;
G.hgIsProGradeSetup = hgIsProGradeSetup;
