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

  /* Base confidence: weighted average of three layers */
  var confidence = (l1.pct * 0.40) +           /* Layer 1: Price (40%) */
                   (Math.abs(l2.score || 0) * 0.35) +  /* Layer 2: Order Flow (35%) */
                   (l3Aligned * 0.25);                 /* Layer 3: Sentiment, vs THIS trade (25%) */

  /* Clamp to valid range */
  confidence = Math.max(0, Math.min(1, confidence));

  /* --- LAYER AGREEMENT BONUSES --- */
  if (l1.dir && l2.dir && l1.dir === l2.dir){
    /* L1 and L2 agree: strong signal */
    confidence *= 1.15;  /* +15% */
  } else if (l1.dir && l2.dir && l1.dir !== l2.dir){
    /* L1 and L2 disagree: weak signal */
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

  /* Agreement status */
  if (l1.dir === l2.dir){
    summary += ' · ✅ AGREE';
  } else if (l1.dir && l2.dir){
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
 * Two things it does NOT require, despite earlier wording here:
 *
 *   - Sentiment agreement is not part of (2). layerAgreement is computed in
 *     cryptoscan.js from order flow versus price and nothing else; sentiment
 *     reaches the stamp only through the confidence number in (1).
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
