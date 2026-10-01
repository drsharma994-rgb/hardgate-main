/* =========================================================================
HARDGATE — hg-perfect-setup.js
THE PERFECT SETUP FORMATION tier, shared across every setup-forming desk.

One honest predicate — hgPerfectFormation(c, reads) — that says a candidate
is a PERFECT / max-confluence setup ONLY when every ALWAYS-COMPUTABLE leg
passes AND no READABLE evidence leg runs against it. It is a FILTER, never a
gate: it cannot demote, move or drop a candidate, and it cannot mint one. It
only earns a ★ PERFECT badge and a `perfect` read-mark the forward ledger
measures against the rest — exactly as the MOST PROBABLE cohort already is.

Two tiers of legs, stated plainly:

  ALWAYS-COMPUTABLE (must pass — a candidate that fails one is simply not
  perfect, and the `why` array names the leg):
    1. not demoted and not vetoed (it leads on its own merit)
    2. top grade (grade A / S / AA — the desk's own max)
    3. nothing on the books opposes it (oppose === 0)
    4. strictly positive, readable confluence tally
    5. R:R clears the desk's floor (when entry/stop/t1 are readable)

  EVIDENCE (only disqualifies when an explicitly AGAINST read is present;
  an UNREADABLE read never confirms and never disqualifies — the honest
  third state):
    - taker flow verdict === 'against'
    - funding mark against the direction
    - volatility regime BLOWOFF (a move already spent)
    - structure trend against the direction (a confirmed opposite)

The reason it never *requires* the evidence legs to be READABLE is honesty:
a missing feed must not be able to either mint or deny a PERFECT. A candidate
with every evidence leg readable-and-WITH is the headline tier; a candidate
whose evidence is simply unreadable passes the always-computable bar only,
and the ledger splits those two cohorts apart.

Loaded early (before the desks) and attached to window/globalThis, guarded so
vm test contexts without a window stub still load cleanly.
   ========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var TOP_GRADES = { A: 1, S: 1, AA: 1 };
var DEFAULT_RR_FLOOR = 0.25;   /* a perfect formation still has to pay for the trip */

/* hgPerfectFormation(c, reads) -> { perfect: bool, why: string[] } */
function hgPerfectFormation(c, reads){
  var out = { perfect: false, why: [] };
  try{
    if (!c) return out;

    /* ---- always-computable legs ---- */
    if (c.demoted || c.vetoed){
      out.why.push('demoted or vetoed');
      return out;
    }
    if (!TOP_GRADES[c.grade]){
      out.why.push('grade ' + (c.grade == null ? 'unread' : c.grade) + ' (needs top)');
      return out;
    }
    if (c.oppose !== 0){
      out.why.push(c.oppose == null ? 'opposing reads unread' : (c.oppose + ' opposing read' + (c.oppose === 1 ? '' : 's')));
      return out;
    }
    if (!(typeof c.tally === 'number' && isFinite(c.tally) && c.tally > 0)){
      out.why.push('tally not strictly positive');
      return out;
    }
    /* R:R floor — only when the numbers are all readable */
    if (isFinite(c.entry) && isFinite(c.stop) && isFinite(c.t1)){
      var rr = (c.dir === 'short')
        ? (c.entry - c.t1) / Math.abs(c.entry - c.stop)
        : (c.t1 - c.entry) / Math.abs(c.entry - c.stop);
      var floor = (isFinite(c.rrFloor) && c.rrFloor > 0) ? c.rrFloor : DEFAULT_RR_FLOOR;
      if (!isFinite(rr) || rr < floor){
        out.why.push('R:R ' + (isFinite(rr) ? rr.toFixed(2) : 'unread') + ' below floor ' + floor.toFixed(2));
        return out;
      }
    }

    /* ---- evidence legs: only an explicit AGAINST disqualifies ---- */
    reads = reads || {};
    var flow = reads.takerFlowVerdict != null ? reads.takerFlowVerdict : c.takerFlowVerdict;
    if (flow === 'against'){ out.why.push('taker flow against'); return out; }
    var fund = reads.fundingAgainst != null ? reads.fundingAgainst : c.fundingAgainst;
    if (fund === true){ out.why.push('funding crowded/against'); return out; }
    var atr = reads.atrRegime != null ? reads.atrRegime : c.atrRegime;
    if (atr === 'BLOWOFF'){ out.why.push('volatility regime blowoff'); return out; }
    var struc = reads.structureTrend != null ? reads.structureTrend : c.structureTrend;
    if (struc && c.dir && struc !== 'range'){
      var opp = (c.dir === 'long') ? 'down' : 'up';
      if (struc === opp){ out.why.push('structure trend against'); return out; }
    }

    out.perfect = true;
    return out;
  }catch(e){
    return out;
  }
}

/* The ★ PERFECT badge. Empty string when not perfect — every desk wraps its
   own "most probable" line with it, so a screenshot keeps the tier legible.
   Amber vocabulary shared with the trend matrix / gold scalp stamps. */
function hgPerfectStamp(c, reads){
  var r = hgPerfectFormation(c, reads);
  if (!r.perfect) return '';
  var title = 'perfect setup formation: max confluence, every readable evidence leg WITH, nothing against — a filter, not a promise';
  if (r.why && r.why.length) title += ' · passed: ' + r.why.join(', ');
  title = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return '<span style="display:inline-block;margin-left:6px;font-size:10px;font-weight:800;letter-spacing:.12em;color:#92400E;background:#FEF3C7;padding:2px 7px;border-radius:4px;border:1px solid #F59E0B;vertical-align:middle" title="' + title + '">\u2605 PERFECT</span>';
}

/* The forward-ledger read-mark: true when perfect, undefined otherwise — the
   split by which the PERFECT cohort's outcome is measured against the rest. */
function hgPerfectLedgerMark(c, reads){
  return hgPerfectFormation(c, reads).perfect ? true : undefined;
}

G.hgPerfectFormation = hgPerfectFormation;
G.hgPerfectStamp = hgPerfectStamp;
G.hgPerfectLedgerMark = hgPerfectLedgerMark;

})();
