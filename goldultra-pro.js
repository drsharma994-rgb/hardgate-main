/* =========================================================================
   HARDGATE GOLD ULTRA Pro — Professional Tier Integration

   Integrates: Macro context + Smart money zones + Session volume
   Confidence tiers: 80%+ professional-grade, 65-80% standard, <65% filtered
   Multi-timeframe confluence: 15m + 1h + 4h agreement
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* Multi-timeframe confluence: vote agreement across 15m, 1h, 4h */
function hgComputeMultiTFConfluence(tf15m, tf1h, tf4h){
  if (!tf15m || !tf1h || !tf4h) return { score: 0, confluenceLevel: 'UNKNOWN' };
  try{
    var agreements = 0;
    var totalVotes = 3;

    if (tf15m.direction === tf1h.direction) agreements++;
    if (tf1h.direction === tf4h.direction) agreements++;
    if (tf15m.direction === tf4h.direction) agreements++;

    var confluenceScore = agreements / totalVotes;

    return {
      score: confluenceScore,
      confluenceLevel: confluenceScore >= 0.67 ? 'STRONG' : confluenceScore >= 0.33 ? 'MEDIUM' : 'WEAK',
      tf15m: tf15m.direction,
      tf1h: tf1h.direction,
      tf4h: tf4h.direction,
      agreements: agreements
    };
  }catch(e){
    return { score: 0, confluenceLevel: 'ERROR' };
  }
}

/* Professional-grade setup checker */
function hgIsProfessionalGradeGold(setup){
  if (!setup) return { isPro: false, reasons: ['No setup data'] };
  try{
    var checks = [];

    /* Multi-timeframe confluence: all 3 agree */
    if (setup.multiTFConfluence && setup.multiTFConfluence.confluenceLevel === 'STRONG'){
      checks.push({ rule: 'MTF_CONFLUENCE', passed: true, weight: 0.25 });
    } else {
      checks.push({ rule: 'MTF_CONFLUENCE', passed: false, weight: 0.25 });
    }

    /* No liquidation cascade imminent */
    if (!setup.liquidationRisk || !setup.liquidationRisk.cascadeImminent){
      checks.push({ rule: 'NO_CASCADE', passed: true, weight: 0.15 });
    } else {
      checks.push({ rule: 'NO_CASCADE', passed: false, weight: 0.15 });
    }

    /* Smart money order block present */
    if (setup.smartMoney && setup.smartMoney.institutionalSetup){
      checks.push({ rule: 'SMART_MONEY_ZONE', passed: true, weight: 0.20 });
    } else {
      checks.push({ rule: 'SMART_MONEY_ZONE', passed: false, weight: 0.20 });
    }

    /* Session liquidity high */
    if (setup.session && (setup.session.liquidity === 'PEAK' || setup.session.liquidity === 'HIGH')){
      checks.push({ rule: 'SESSION_LIQUIDITY', passed: true, weight: 0.15 });
    } else {
      checks.push({ rule: 'SESSION_LIQUIDITY', passed: false, weight: 0.15 });
    }

    /* Macro bias aligned */
    if (setup.macroScore && Math.abs(setup.macroScore.score) > 0.3){
      checks.push({ rule: 'MACRO_ALIGNED', passed: true, weight: 0.25 });
    } else {
      checks.push({ rule: 'MACRO_ALIGNED', passed: false, weight: 0.25 });
    }

    var weightedScore = 0;
    var totalWeight = 0;
    for (var i = 0; i < checks.length; i++){
      var c = checks[i];
      weightedScore += (c.passed ? c.weight : 0);
      totalWeight += c.weight;
    }

    var finalScore = weightedScore / totalWeight;

    return {
      isPro: finalScore >= 0.75,
      professionalScore: finalScore,
      tier: finalScore >= 0.85 ? 'PREMIUM' : finalScore >= 0.75 ? 'PROFESSIONAL' : 'STANDARD',
      checks: checks,
      reasons: checks.filter(function(c){ return !c.passed; }).map(function(c){ return c.rule; })
    };
  }catch(e){
    return { isPro: false, tier: 'ERROR', reasons: [e.message] };
  }
}

/* Confidence tier assignment */
function hgAssignConfidenceTier(baseConfidence, confluence, smartMoney, macroScore){
  try{
    var confidence = baseConfidence || 0.5;

    /* Confluence boost: +15% if strong MTF agreement */
    if (confluence && confluence.confluenceLevel === 'STRONG'){
      confidence *= 1.15;
    }

    /* Smart money bonus: +10% if institutional zone present */
    if (smartMoney && smartMoney.institutionalSetup){
      confidence *= 1.10;
    }

    /* Macro alignment: +12% if macro bias strong */
    if (macroScore && Math.abs(macroScore.score) > 0.5){
      confidence *= 1.12;
    }

    /* Clamp */
    confidence = Math.min(1.0, confidence);

    var tier = {
      confidence: confidence,
      tier: 'WEAK'
    };

    if (confidence >= 0.85){
      tier.tier = 'PROFESSIONAL-GRADE';
      tier.rules = 'Entry approved: all confluence + macro + smart money aligned';
      tier.riskMultiplier = 1.0;
    } else if (confidence >= 0.75){
      tier.tier = 'PROFESSIONAL';
      tier.rules = 'Entry approved with caution: most checks pass';
      tier.riskMultiplier = 0.8;
    } else if (confidence >= 0.65){
      tier.tier = 'STANDARD';
      tier.rules = 'Entry allowed if no conflicts: basic checks pass';
      tier.riskMultiplier = 0.6;
    } else {
      tier.tier = 'WEAK';
      tier.rules = 'Record-only: insufficient confluence';
      tier.riskMultiplier = 0;
    }

    return tier;
  }catch(e){
    return { confidence: 0, tier: 'ERROR' };
  }
}

/* Filter entries by professional criteria */
function hgFilterGoldSetupsByProfessional(setups){
  if (!setups || !Array.isArray(setups)) return { professional: [], standard: [], weak: [] };
  try{
    var filtered = {
      professional: [],
      standard: [],
      weak: []
    };

    for (var i = 0; i < setups.length; i++){
      var setup = setups[i];
      var tierCheck = hgAssignConfidenceTier(
        setup.confidence,
        setup.multiTFConfluence,
        setup.smartMoney,
        setup.macroScore
      );

      if (tierCheck.tier === 'PROFESSIONAL-GRADE'){
        filtered.professional.push(setup);
      } else if (tierCheck.tier === 'PROFESSIONAL' || tierCheck.tier === 'STANDARD'){
        filtered.standard.push(setup);
      } else {
        filtered.weak.push(setup);
      }
    }

    return {
      professional: filtered.professional,
      standard: filtered.standard,
      weak: filtered.weak,
      totalSetups: setups.length,
      professionalCount: filtered.professional.length,
      professionalPercentage: (filtered.professional.length / setups.length * 100).toFixed(1) + '%'
    };
  }catch(e){
    return { professional: [], standard: [], weak: setups };
  }
}

G.hgComputeMultiTFConfluence = hgComputeMultiTFConfluence;
G.hgIsProfessionalGradeGold = hgIsProfessionalGradeGold;
G.hgAssignConfidenceTier = hgAssignConfidenceTier;
G.hgFilterGoldSetupsByProfessional = hgFilterGoldSetupsByProfessional;
