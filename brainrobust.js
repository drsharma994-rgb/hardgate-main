/* HARDGATE — brainrobust.js
   Crypto LIVE eligibility, PRIME crowding veto, scorecard rank helpers.
   Loaded after plans.js, before brain.js. Never throws. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var BRAIN_LIVE_MODE_KEY = 'hg_brain_live_mode_v1';
var BRAIN_INV_ALERTS_KEY = 'hg_brain_inv_alerts_v1';
var BRAIN_TP1_BARS_SWING = 12;   /* 4h bars ≈ 48h without TP1 */
var BRAIN_TP1_BARS_SCALP = 24;   /* 15m bars ≈ 6h */

function brainLiveModeOn(){
  try{ return localStorage.getItem(BRAIN_LIVE_MODE_KEY) === '1'; }catch(e){ return false; }
}
function brainSetLiveMode(on){
  try{ localStorage.setItem(BRAIN_LIVE_MODE_KEY, on ? '1' : '0'); }catch(e){}
}
function brainInvAlertsOn(){
  try{
    if (localStorage.getItem(BRAIN_INV_ALERTS_KEY) === '1') return true;
    return brainLiveModeOn();
  }catch(e){ return false; }
}
function brainSetInvAlerts(on){
  try{ localStorage.setItem(BRAIN_INV_ALERTS_KEY, on ? '1' : '0'); }catch(e){}
}

function brainRowHasLiqpoolCaution(row){
  try{
    if (!row || !row.col) return false;
    var notes = row.col.notes || {};
    if (notes.liqpool && String(notes.liqpool).toUpperCase().indexOf('CAUTION') >= 0) return true;
    var votes = row.col.votes || [];
    for (var i = 0; i < votes.length; i++){
      if (votes[i] && votes[i].layer === 'liqpool' && votes[i].caution) return true;
    }
    return false;
  }catch(e){ return false; }
}

function brainRowPlanConfirmed(row){
  try{
    var p = row && row.plan;
    if (!p) return false;
    if (p.confirmed === false) return false;
    if (p.confirmed === true) return true;
    if (typeof G.hgConfirmedCascade === 'function' && row.rows4h){
      try{ return !!G.hgConfirmedCascade(row.rows4h, row.dec && row.dec.dir); }catch(e2){}
    }
    if (row.rows && row.dec && row.dec.dir && typeof G.hgConfirmedCascade === 'function'){
      try{ return !!G.hgConfirmedCascade(row.rows, row.dec.dir); }catch(e3){}
    }
    return p.entryType !== 'MARKET' || p.confirmed !== false;
  }catch(e){
    try{ if (typeof G.hgFwdWarn === 'function') G.hgFwdWarn('BRAIN', 'plan-confirmed check threw, row treated as confirmed: ' + ((e && e.message) || e)); }catch(e2){}
    return true;
  }
}

function brainRowHasTripleStack(sym, dir){
  try{
    if (typeof G.hgTripleStackMatch !== 'function') return null;
    return !!G.hgTripleStackMatch(sym, dir);
  }catch(e){ return null; }
}

/** PRIME + TRIPLE STACK + confirmed plan + no liqpool stop-run caution (+ family EV). */
function brainLiveEligible(row){
  var reasons = [];
  try{
    var dec = row && row.dec;
    if (!dec || dec.tier !== 'PRIME') reasons.push('need PRIME tier');
    var dir = dec && dec.dir;
    if (!(dir === 'long' || dir === 'short')) reasons.push('no trade direction');
    var plan = row.plan;
    if (!plan || !isFinite(plan.entry) || !isFinite(plan.stop) || !isFinite(plan.t1)){
      reasons.push('plan incomplete (entry/stop/T1)');
    }
    if (!brainRowPlanConfirmed(row)) reasons.push('plan unconfirmed (wait for structure)');
    var sym = row.lane === 'gold' ? 'XAUTUSD' : row.sym;
    var ts = brainRowHasTripleStack(sym, dir);
    if (ts === false) reasons.push('TRIPLE STACK missing (SWING CLEAN + EDGE + BRAIN must agree)');
    if (brainRowHasLiqpoolCaution(row)) reasons.push('liqpool — stop sits in equal-high/low pool (stop-run risk)');
    if (typeof G.familyEvOk === 'function' && plan && !G.familyEvOk(plan)){
      reasons.push('setup-log EV negative for this family');
    }
  }catch(e){ reasons.push('eligibility check error'); }
  return { ok: reasons.length === 0, reasons: reasons };
}

function brainRowRank(row){
  try{
    var dec = row && row.dec;
    if (!dec) return 0;
    var tierR = { ASIDE: 0, WATCH: 100, HIGH: 200, PRIME: 300 };
    var base = tierR[dec.tier] || 0;
    var agree = isFinite(dec.agree) ? dec.agree : 0;
    var boost = 0;
    if (typeof G.__hgBrainProfitBoost === 'function' && dec.dir){
      boost = G.__hgBrainProfitBoost(row, dec.dir) || 0;
    }else if (typeof G.hgProfitRankHint === 'function' && row.plan){
      var h = G.hgProfitRankHint({ sym: row.sym, dir: dec.dir, tier: dec.tier, rr1: row.plan.rr1 });
      if (h && isFinite(h.boost)) boost = h.boost;
    }
    var rr = 0;
    if (row.plan && isFinite(row.plan.rr1)) rr = row.plan.rr1;
    var live = (brainLiveEligible(row).ok ? 50 : 0);
    return base + agree * 10 + boost + rr + live;
  }catch(e){ return 0; }
}

function brainRowFundingCrowded(row){
  try{
    var dir = row.dec && row.dec.dir;
    if (!dir) return false;
    var fp = row.xu && row.xu.fundingPct;
    if (typeof fp === 'number' && isFinite(fp) && Math.abs(fp) >= 0.001){
      if ((dir === 'long' && fp > 0) || (dir === 'short' && fp < 0)) return true;
    }
    var votes = (row.col && row.col.votes) ? row.col.votes : [];
    for (var i = 0; i < votes.length; i++){
      if (votes[i] && votes[i].layer === 'fundz' && votes[i].caution) return true;
    }
    return false;
  }catch(e){ return false; }
}

function brainRowOiCrowded(row){
  try{
    var dir = row.dec && row.dec.dir;
    if (!dir) return false;
    var votes = (row.col && row.col.votes) ? row.col.votes : [];
    for (var j = 0; j < votes.length; j++){
      var v = votes[j];
      if (!v || v.layer !== 'oiflow' || v.vote !== dir) continue;
      var t = String(v.text || '').toUpperCase();
      if (t.indexOf('NEW LONG') >= 0 || t.indexOf('NEW SHORT') >= 0
          || t.indexOf('CROWD') >= 0 || t.indexOf('LEAD') >= 0) return true;
    }
    return false;
  }catch(e){ return false; }
}

/** Demote PRIME → HIGH when funding AND OI both crowd the same side. */
function applyPrimeCrowdingVeto(rows){
  try{
    if (!Array.isArray(rows)) return;
    for (var i = 0; i < rows.length; i++){
      var row = rows[i];
      if (!row || row.lane !== 'crypto' || !row.dec || row.dec.tier !== 'PRIME') continue;
      if (!brainRowFundingCrowded(row) || !brainRowOiCrowded(row)) continue;
      row.dec.gatedFrom = 'PRIME';
      row.dec.tier = 'HIGH';
      row.dec.reasons.unshift('PRIME crowding veto — same-side funding + OI flow crowded (squeeze risk) · demoted to HIGH');
      row.gated = 'crowding';
    }
  }catch(e){}
}

function brainLiveChipHtml(row){
  try{
    var el = brainLiveEligible(row);
    if (el.ok){
      return '<span class="stamp pass" style="margin-left:6px" title="LIVE eligible: PRIME + TRIPLE STACK + confirmed plan + clear liqpool">LIVE OK</span>';
    }
    if (!brainLiveModeOn()) return '';
    return '<span class="stamp na" style="margin-left:6px" title="' + String(el.reasons.join(' · ')).replace(/"/g, '&quot;') + '">LIVE blocked</span>';
  }catch(e){ return ''; }
}

G.brainLiveModeOn = brainLiveModeOn;
G.brainSetLiveMode = brainSetLiveMode;
G.brainInvAlertsOn = brainInvAlertsOn;
G.brainSetInvAlerts = brainSetInvAlerts;
G.brainLiveEligible = brainLiveEligible;
G.brainRowHasLiqpoolCaution = brainRowHasLiqpoolCaution;
G.brainRowPlanConfirmed = brainRowPlanConfirmed;
G.brainRowRank = brainRowRank;
G.applyPrimeCrowdingVeto = applyPrimeCrowdingVeto;
G.brainLiveChipHtml = brainLiveChipHtml;
G.BRAIN_TP1_BARS_SWING = BRAIN_TP1_BARS_SWING;
G.BRAIN_TP1_BARS_SCALP = BRAIN_TP1_BARS_SCALP;

})();
