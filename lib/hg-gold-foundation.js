/* Measured lead rank for the gold desks.
   A strategy leads only when its own published cohort cleared the prefer bar.
   Scalp bar (goldind): n>=50, gross>0, net>=+0.10 at XM. Only p6fail clears it
   on the hg-v1439 book. Swing bar: weekly and p9volbar. Nothing else is promoted.
   Sentiment is not an input. A dark fundamental board does not veto.
   An unmeasured plan may lead only when no measured prefer is already eligible. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var PREFER = {
  scalp: {
    p6fail: { n: 64, gross: 0.206, net: 0.128 }
  },
  swing: {
    weekly: { n: 32, gross: 0.217, net: 0.2 },
    p9volbar: { n: 44, gross: 0.211, net: 0.189 }
  }
};

function hgGoldMeasuredPrefer(lane, key){
  var book = PREFER[String(lane || '').toLowerCase()];
  if (!book || key == null) return null;
  return book[String(key).toLowerCase()] || null;
}

function hgGoldFoundationJudge(card, opt){
  opt = opt || {};
  var out = { mayLead: false, measured: 'unmeasured', reason: 'no plan', sentiment: 'not a side' };
  if (!card) return out;
  if (card.geometryOk === false){
    out.reason = 'stop or target is not beyond the entry';
    return out;
  }
  var fund = opt.fund || null;
  if (fund && fund.refuse === true){
    out.measured = 'refuse';
    out.reason = fund.reason || 'EVENT BLACKOUT — no fresh setup forms into a red-folder print';
    return out;
  }
  if (fund && fund.demote === true){
    out.measured = 'demote';
    out.reason = fund.reason || 'fundamental headwind — this plan does not lead';
    return out;
  }
  var lane = opt.lane || 'scalp';
  var row = hgGoldMeasuredPrefer(lane, card.stratKey);
  if (row){
    out.measured = 'prefer';
    out.mayLead = true;
    out.reason = String(card.stratKey) + ' keeps the lead. Measured n=' + row.n + ', net +' + row.net + 'R at XM.';
    return out;
  }
  if (opt.preferSibling){
    out.reason = 'A measured prefer is already eligible. This plan has no win-rate record and does not replace it.';
    return out;
  }
  out.mayLead = true;
  out.reason = 'No measured prefer is eligible. This structure may lead. It has no win-rate record of its own.';
  return out;
}

G.hgGoldMeasuredPrefer = hgGoldMeasuredPrefer;
G.hgGoldFoundationJudge = hgGoldFoundationJudge;
})();
