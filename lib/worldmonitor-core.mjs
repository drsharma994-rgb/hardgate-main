/* HARDGATE — World Monitor desk normalization + formation boosts.
   Consumes /api/worldmonitor/desk (remote WM API or local public-source fallback).
   Signal formulas are independent implementations; optional WORLDMONITOR_API_KEY
   pulls pre-computed snapshots from api.worldmonitor.app. */

export function wmConfigured(env){
  env = env || (typeof process !== 'undefined' ? process.env : {});
  return !!(env.WORLDMONITOR_API_KEY && (env.WORLDMONITOR_API_URL || env.WORLDMONITOR_API_BASE));
}

export function wmApiBase(env){
  env = env || (typeof process !== 'undefined' ? process.env : {});
  var base = env.WORLDMONITOR_API_URL || env.WORLDMONITOR_API_BASE || 'https://api.worldmonitor.app';
  return String(base).replace(/\/+$/, '');
}

/** Macro verdict → formation score delta (−12..+12). */
export function wmMacroFormationBoost(dir, macro){
  if (!macro || macro.unavailable) return 0;
  var side = String(dir || 'long').toLowerCase();
  var v = String(macro.verdict || '').toUpperCase();
  if (v === 'BUY'){
    return side === 'long' ? 10 : -8;
  }
  if (v === 'CASH'){
    return side === 'long' ? -5 : 4;
  }
  return 0;
}

/** Economic stress label → formation delta. */
export function wmStressFormationBoost(dir, stress){
  if (!stress || !stress.label) return 0;
  var side = String(dir || 'long').toLowerCase();
  var lbl = String(stress.label);
  if (lbl === 'Critical' || lbl === 'Severe'){
    return side === 'long' ? -10 : 6;
  }
  if (lbl === 'Elevated'){
    return side === 'long' ? -6 : 3;
  }
  if (lbl === 'Low'){
    return side === 'long' ? 4 : -2;
  }
  return 0;
}

/** Gold desk: ETF flow + positioning context. */
export function wmGoldFormationBoost(dir, gold){
  if (!gold || gold.unavailable) return 0;
  var side = String(dir || 'long').toLowerCase();
  var boost = 0;
  if (gold.etfFlows && isFinite(+gold.etfFlows.changeW1Tonnes)){
    var w1 = +gold.etfFlows.changeW1Tonnes;
    if (w1 > 0 && side === 'long') boost += 6;
    else if (w1 < 0 && side === 'short') boost += 4;
    else if (w1 < 0 && side === 'long') boost -= 5;
  }
  if (gold.cot && gold.cot.managedMoney && isFinite(+gold.cot.managedMoney.netPct)){
    var net = +gold.cot.managedMoney.netPct;
    if (net > 15 && side === 'long') boost += 4;
    else if (net < -10 && side === 'short') boost += 3;
    else if (net > 25 && side === 'short') boost -= 6;
  }
  if (isFinite(+gold.goldChangePct)){
    var ch = +gold.goldChangePct;
    if (ch > 0.5 && side === 'long') boost += 2;
    else if (ch < -0.5 && side === 'short') boost += 2;
  }
  return Math.max(-12, Math.min(12, boost));
}

/** Hyperliquid positioning stress for symbol family. */
export function wmHyperliquidFormationBoost(dir, sym, hl){
  if (!hl || !hl.assets || !hl.assets.length) return 0;
  var side = String(dir || 'long').toLowerCase();
  var u = String(sym || '').toUpperCase();
  var want = /ETH/.test(u) ? 'ETH' : (/XAU|XAUT|GOLD|PAXG/.test(u) ? 'PAXG' : 'BTC');
  var leg = hl.assets.find(function(a){ return a && (a.symbol === want || a.display === want); });
  if (!leg) leg = hl.assets.find(function(a){ return a && a.symbol === 'xyz:GOLD' && /GOLD|XAU/.test(want); });
  if (!leg || !isFinite(+leg.score)) return 0;
  var score = +leg.score;
  var funding = leg.fundingRate != null ? +leg.fundingRate : null;
  var boost = 0;
  if (score >= 60){
    boost = side === 'long' ? -7 : -7;
  } else if (score >= 40){
    boost = -3;
  }
  if (funding != null){
    if (side === 'long' && funding > 0.0003) boost -= 4;
    if (side === 'short' && funding < -0.0003) boost -= 4;
    if (side === 'long' && funding < -0.0001) boost += 3;
  }
  return Math.max(-12, Math.min(12, boost));
}

export function wmDeskFormationBoost(dir, asset, desk){
  desk = desk || {};
  asset = asset || 'crypto';
  var total = 0;
  total += wmMacroFormationBoost(dir, desk.macro);
  total += wmStressFormationBoost(dir, desk.stress);
  if (asset === 'gold'){
    total += wmGoldFormationBoost(dir, desk.gold);
  }
  if (desk.hyperliquid){
    total += wmHyperliquidFormationBoost(dir, asset === 'gold' ? 'XAUUSD' : 'BTCUSDT', desk.hyperliquid);
  }
  return Math.max(-12, Math.min(12, total));
}

export function wmRiskKnowledgeScore(desk){
  desk = desk || {};
  var score = 0;
  if (desk.macro && !desk.macro.unavailable && desk.macro.totalCount > 0){
    score += (desk.macro.bullishCount / desk.macro.totalCount) * 40;
  }
  if (desk.stress && isFinite(+desk.stress.score)){
    score += Math.max(0, 30 - (+desk.stress.score) * 0.3);
  }
  if (desk.gold && !desk.gold.unavailable && desk.gold.goldPrice > 0) score += 15;
  if (desk.hyperliquid && desk.hyperliquid.assets && desk.hyperliquid.assets.length) score += 15;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function wmFinalizeDesk(parts){
  parts = parts || {};
  var desk = {
    at: Date.now(),
    source: parts.source || 'local',
    macro: parts.macro || { unavailable: true, verdict: 'UNKNOWN' },
    stress: parts.stress || null,
    gold: parts.gold || { unavailable: true },
    hyperliquid: parts.hyperliquid || { assets: [] },
    attribution: 'World Monitor methodology · koala73/worldmonitor (optional API)',
  };
  desk.knowledgeScore = wmRiskKnowledgeScore(desk);
  desk.macroRiskScore = desk.macro && desk.macro.totalCount
    ? Math.round((desk.macro.bullishCount / desk.macro.totalCount) * 100)
    : null;
  return desk;
}
