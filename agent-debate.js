/* HARDGATE — browser agent debate bridge (TradingAgents-inspired, advisory only). */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function fin(v){ return v !== undefined && v !== null && isFinite(+v); }

function bullCase(setup){
  var args = [];
  if (!setup) return args;
  var dir = String(setup.dir || 'long').toLowerCase();
  if (setup.clean7 || setup.clean) args.push('7/7 gate clean — full confluence stack');
  else if (setup.nearClean) args.push('Near-clean — minor gate friction only');
  if (fin(setup.formationScore) && setup.formationScore >= 70) args.push('Formation score ' + setup.formationScore + '/100');
  if (fin(setup.fqs) && setup.fqs >= 70) args.push('FQS grade ' + (setup.grade || 'B+') + ' (' + setup.fqs + ')');
  if (setup.poi === 'sweep' || setup.poiKind === 'sweep-reclaim') args.push('Liquidity sweep POI — high-quality entry anchor');
  if (fin(setup.rr != null ? setup.rr : setup.rr1) && (setup.rr != null ? setup.rr : setup.rr1) >= 2.5) args.push('Structural R:R ' + (setup.rr != null ? setup.rr : setup.rr1).toFixed(2) + ' meets swing floor');
  if (setup.htfAlign === true) args.push('HTF structure aligned with ' + dir);
  if (setup.metaLabel && setup.metaLabel.take) args.push('Meta-label TAKE (p=' + Math.round(setup.metaLabel.prob * 100) + '%)');
  if (setup.tier === 'PRIME') args.push('PRIME tier — top conviction bucket');
  if (!args.length) args.push('Primary direction ' + dir.toUpperCase() + ' with valid plan levels');
  return args;
}

function bearCase(setup){
  var args = [];
  if (!setup) return args;
  if (setup.eventBlackout === true) args.push('Event blackout — macro calendar risk');
  if (setup.htfAlign === false) args.push('HTF structure against trade direction');
  if (fin(setup.fillProb) && setup.fillProb < 30) args.push('Low fill probability (' + setup.fillProb + '%) — limit may not trade');
  if (setup.metaLabel && !setup.metaLabel.take) args.push('Meta-label SKIP (p=' + Math.round(setup.metaLabel.prob * 100) + '%)');
  if (fin(setup.formationScore) && setup.formationScore < 55) args.push('Weak formation score ' + setup.formationScore);
  if (setup.swingClean === false) args.push('Swing parity not clean — CUSUM or R:R friction');
  if (setup.newsRisk === 'high') args.push('High-impact news window — size down or skip');
  if (setup.intoOpposingLiquidity === true) args.push('Entry into opposing liquidity pool');
  if (!args.length) args.push('No major vetoes — standard execution risk applies');
  return args;
}

function riskVerdict(setup, bull, bear){
  var score = bull.length * 2 - bear.length * 2;
  if (setup && setup.metaLabel) score += setup.metaLabel.take ? 3 : -4;
  if (setup && fin(setup.formationScore)) score += (setup.formationScore - 50) / 15;
  if (setup && setup.eventBlackout) score -= 5;
  var verdict = 'NEUTRAL', sizeAdj = 1;
  if (score >= 4){ verdict = 'TAKE'; sizeAdj = setup && setup.tier === 'PRIME' ? 1 : 0.75; }
  else if (score <= -3){ verdict = 'SKIP'; sizeAdj = 0; }
  else if (score >= 1){ verdict = 'REDUCE'; sizeAdj = 0.5; }
  else { verdict = 'WAIT'; sizeAdj = 0.25; }
  return { verdict: verdict, sizeAdj: Math.round(sizeAdj * 100) / 100, score: Math.round(score * 10) / 10 };
}

function hgAgentDebate(setup){
  setup = setup || {};
  var bull = bullCase(setup);
  var bear = bearCase(setup);
  var risk = riskVerdict(setup, bull, bear);
  var sym = setup.sym || setup.symbol || '?';
  var dir = String(setup.dir || 'long').toUpperCase();
  var summary = risk.verdict + ' · ' + sym + ' ' + dir + ' · bull ' + bull.length + ' / bear ' + bear.length + ' · size ×' + risk.sizeAdj;
  return { bull: bull, bear: bear, risk: risk, summary: summary };
}

try{ G.hgAgentDebate = hgAgentDebate; }catch(e){}

})();
