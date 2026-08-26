/* HARDGATE — setup-solidity.js
   One composite read for crypto + gold: how solid is this ticket?

   Combines gate cleanliness, post-gate quality, formation, flow, R:R,
   gold grade/tally, and optional OMNI INFO legs. Ranks desks and gates
   BOOK on WEAK rows. Never loosens G1–G7 — only ranks and filters. */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

function num(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}

function isGoldRow(row, opts){
  opts = opts || {};
  if (opts.asset === 'gold') return true;
  var sym = String(row.sym || row.symbol || '').toUpperCase();
  return /XAU|XAUT|PAXG|GOLD/.test(sym);
}

function gatePts(row){
  var p = num(row.gatesPassed != null ? row.gatesPassed : row.passed);
  if (isFinite(p)){
    if (p >= 7) return 36;
    if (p === 6) return 14;
    if (p >= 5) return 6;
    return 2;
  }
  if (row.clean) return 28;
  if (row.near || row.nearClean) return 12;
  if (row.forming) return 4;
  return 0;
}

function rrPts(row){
  var e = num(row.entry), s = num(row.stop), t1 = num(row.t1);
  var rr = num(row.rr);
  if (!isFinite(rr) && isFinite(e) && isFinite(s) && isFinite(t1) && e !== s){
    rr = Math.abs(t1 - e) / Math.abs(e - s);
  }
  if (!isFinite(rr)) return 0;
  if (rr >= 2.5) return 14;
  if (rr >= 2) return 10;
  if (rr >= 1.5) return 4;
  return -8;
}

function postGatePts(row){
  if (row.postGateOk === false || row.postGateVeto) return -28;
  if (row.postGateUnchecked) return -14;
  if (row.postGateChecked) return 16;
  if (row.demoted) return -20;
  return 4;
}

function flowPts(row){
  if (row.flowVeto) return -14;
  if (row.flowOk) return 7;
  return 0;
}

function goldPts(row, opts){
  if (!isGoldRow(row, opts)) return 0;
  var pts = 0;
  var tally = num(opts.tally != null ? opts.tally : row.tally);
  if (isFinite(tally)){
    if (tally >= 8) pts += 12;
    else if (tally >= 5) pts += 6;
    else if (tally >= 3) pts += 2;
    else pts -= 4;
  }
  var g = String(row.grade || opts.grade || '').toUpperCase();
  if (g === 'A') pts += 14;
  else if (g === 'B') pts += 7;
  else if (g === 'C') pts -= 6;
  if (row.demoted) pts -= 18;
  if (row.newsCaution) pts -= 6;
  return pts;
}

function omniInfoPts(row){
  var pts = 0;
  if (row.omniVolOverBudget) pts -= 7;
  if (row.omniCvdWith === true) pts += 6;
  else if (row.omniCvdWith === false) pts -= 9;
  if (row.omniLiqStopCluster) pts -= 14;
  else if (row.omniLiqFuel) pts += 4;
  return pts;
}

function metaPts(row){
  var pts = 0;
  if (row.metaTake === true) pts += 7;
  else if (row.metaTake === false) pts -= 12;
  if (row.fqsOk === true) pts += 8;
  else if (row.fqsOk === false) pts -= 10;
  if (isFinite(num(row.formationScore)) && num(row.formationScore) > 0){
    pts += Math.min(10, Math.round(num(row.formationScore) / 5));
  }
  if (isFinite(num(row.rankBoost))) pts += Math.min(8, num(row.rankBoost));
  return pts;
}

function tierFromScore(score, row, opts){
  var clean = !!(row.clean && !row.near && !row.nearClean && !row.forming);
  var near = !!(row.near || row.nearClean);
  if (score >= 78 && clean && !row.postGateUnchecked && !row.demoted
      && (num(row.gatesPassed != null ? row.gatesPassed : row.passed) >= 7 || isGoldRow(row, opts))){
    return 'SOLID';
  }
  if (score >= 62 && clean && !row.demoted) return 'GOOD';
  if (score >= 45 || near) return 'WATCH';
  return 'WEAK';
}

function hgSetupSolidityScore(row, opts){
  opts = opts || {};
  row = row || {};
  var parts = [];
  function add(label, pts){
    if (!pts) return;
    parts.push({ label: label, pts: pts });
  }
  var score = 50;
  var g = gatePts(row); score += g - 20; add('gates', g);
  var pg = postGatePts(row); score += pg; add('post-gate', pg);
  var rp = rrPts(row); score += rp; add('R:R', rp);
  var fp = flowPts(row); score += fp; add('flow', fp);
  var gp = goldPts(row, opts); score += gp; add('gold', gp);
  var op = omniInfoPts(row); score += op; add('omni-info', op);
  var mp = metaPts(row); score += mp; add('formation/meta', mp);
  if (row.near || row.nearClean) score -= 10;
  if (row.forming) score -= 6;
  score = Math.max(0, Math.min(100, Math.round(score)));
  var tier = tierFromScore(score, row, opts);
  var bookOk = tier === 'SOLID' || (tier === 'GOOD' && row.clean && !row.postGateUnchecked && !row.nearClean);
  var tradeOk = tier === 'SOLID' || tier === 'GOOD';
  var summary = tier + ' · ' + score + '/100';
  if (row.postGateUnchecked) summary += ' · post-gate unchecked';
  return {
    score: score,
    tier: tier,
    grade: tier,
    bookOk: bookOk,
    tradeOk: tradeOk,
    parts: parts,
    summary: summary
  };
}

function hgSetupSolidityApply(row, opts){
  if (!row || typeof row !== 'object') return row;
  try{
    var s = hgSetupSolidityScore(row, opts);
    row.solidityScore = s.score;
    row.solidityTier = s.tier;
    row.solidityBookOk = s.bookOk;
    row.solidityTradeOk = s.tradeOk;
    row.soliditySummary = s.summary;
    row.solidityParts = s.parts;
  }catch(e){}
  return row;
}

function hgSetupSolidityBookOk(rowOrScore){
  if (!rowOrScore) return true;
  if (typeof rowOrScore === 'object' && rowOrScore.bookOk != null) return !!rowOrScore.bookOk;
  if (typeof rowOrScore === 'object' && rowOrScore.solidityBookOk != null) return !!rowOrScore.solidityBookOk;
  if (typeof rowOrScore === 'object'){
    var s = hgSetupSolidityScore(rowOrScore);
    return s.bookOk;
  }
  return true;
}

function hgSetupSolidityChipHtml(row){
  try{
    if (!row) return '';
    var s = (row.solidityScore != null && row.solidityTier)
      ? { score: row.solidityScore, tier: row.solidityTier, summary: row.soliditySummary }
      : hgSetupSolidityScore(row);
    if (!s || !s.tier) return '';
    var cls = s.tier === 'SOLID' ? 'pass' : (s.tier === 'GOOD' ? 'ok' : (s.tier === 'WATCH' ? 'warn' : 'bad'));
    return '<span class="stamp ' + cls + '" style="margin-left:6px" title="'
      + String(s.summary || s.tier).replace(/"/g, '&quot;')
      + '">' + s.tier + ' · ' + s.score + '</span>';
  }catch(e){ return ''; }
}

function hgSetupSolidityCmp(a, b){
  a = a || {}; b = b || {};
  var as = num(a.solidityScore);
  var bs = num(b.solidityScore);
  if (!isFinite(as) && typeof W.hgSetupSolidityApply === 'function'){
    hgSetupSolidityApply(a);
    as = num(a.solidityScore);
  }
  if (!isFinite(bs)){
    hgSetupSolidityApply(b);
    bs = num(b.solidityScore);
  }
  if (isFinite(bs) && isFinite(as) && bs !== as) return bs - as;
  var ab = a.solidityBookOk === false ? 0 : 1;
  var bb = b.solidityBookOk === false ? 0 : 1;
  if (bb !== ab) return bb - ab;
  return 0;
}

W.hgSetupSolidityScore = hgSetupSolidityScore;
W.hgSetupSolidityApply = hgSetupSolidityApply;
W.hgSetupSolidityBookOk = hgSetupSolidityBookOk;
W.hgSetupSolidityChipHtml = hgSetupSolidityChipHtml;
W.hgSetupSolidityCmp = hgSetupSolidityCmp;
})();
