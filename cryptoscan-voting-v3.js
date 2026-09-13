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

  /* Base confidence: weighted average of three layers */
  var confidence = (l1.pct * 0.40) +           /* Layer 1: Price (40%) */
                   (Math.abs(l2.score || 0) * 0.35) +  /* Layer 2: Order Flow (35%) */
                   ((l3.sentiment || 0) * 0.25);       /* Layer 3: Sentiment (25%) */

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
 * Professional traders only take trades with:
 * 1. Confluence (multiple sources agree)
 * 2. Favorable risk-reward (1:2 minimum)
 * 3. Market context (session liquidity, regime)
 * 4. No tail risks (liquidation, whale distribution)
 */
function hgIsProGradeSetup(setup) {
  if (!setup) return false;

  var checks = {
    highConfidence: (setup.threeLayerConfidence || 0) >= 0.75,
    layerAgreement: setup.layerAgreement === 2,  /* All three layers agree */
    noLiquidationRisk: !setup.externalRisk || !setup.externalRisk.cascadeImminent,
    qualityGates: (setup.qualityGates || []).length === 0,
    positiveRR: setup.plan && (setup.plan.rr1 || 0) >= 1.5
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
