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
    - news calendar in BLACKOUT (a scheduled high-impact event)
    - session floor THIN (dead tape, no participation)
    - volume witness AGAINST (RVOL below the participation floor)

The reason it never *requires* the evidence legs to be READABLE is honesty:
a missing feed must not be able to either mint or deny a PERFECT. A candidate
with every evidence leg readable-and-WITH is the headline tier; a candidate
whose evidence is simply unreadable passes the always-computable bar only,
and the ledger splits those two cohorts apart.

  THE HEADLINE TIER (hg-v1030): a candidate whose PERFECT and whose every
  readable evidence leg is explicitly WITH is marked `plus` — ★ PERFECT⁺.
  It is the max-confluence setup: nothing unknown, everything favourable.
  `plus` is earned, never minted, and the forward ledger records it as its
  own read-mark so PERFECT⁺ is measured against PERFECT and the rest.

Loaded early (before the desks) and attached to window/globalThis, guarded so
vm test contexts without a window stub still load cleanly.
   ========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

var TOP_GRADES = { A: 1, S: 1, AA: 1 };
var DEFAULT_RR_FLOOR = 0.25;   /* a perfect formation still has to pay for the trip */
/* hg-v1030: the participation floor below which a "volume witness" reads
   AGAINST (dead tape). RVOL is relative to the desk's own 20-bar average, so
   0.6 means the fire bar traded 40% below its recent norm — a setup printing
   on a tape no one is trading. */
var VOLUME_AGAINST = 0.6;
var VOLUME_WITH = 1.0;

/* hgPerfectFormation(c, reads) -> { perfect: bool, plus: bool, why: string[] } */
function hgPerfectFormation(c, reads){
  var out = { perfect: false, plus: false, why: [] };
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

    /* ---- evidence legs: an explicit AGAINST disqualifies; an unreadable leg
       neither confirms nor disqualifies. Each leg also reports whether it is
       WITH, so the `plus` (max-confluence) tier can be computed below. ---- */
    reads = reads || {};
    var leg = {};

    var flow = reads.takerFlowVerdict != null ? reads.takerFlowVerdict : c.takerFlowVerdict;
    if (flow === 'against'){ out.why.push('taker flow against'); return out; }
    leg.flowWith = (flow === 'with');
    leg.flowReadable = (flow != null);

    var fund = reads.fundingAgainst != null ? reads.fundingAgainst : c.fundingAgainst;
    if (fund === true){ out.why.push('funding crowded/against'); return out; }
    leg.fundWith = (fund === false);
    leg.fundReadable = (fund != null);

    var atr = reads.atrRegime != null ? reads.atrRegime : c.atrRegime;
    if (atr === 'BLOWOFF'){ out.why.push('volatility regime blowoff'); return out; }
    leg.atrWith = (atr === 'HEALTHY');
    leg.atrReadable = (atr != null);

    var struc = reads.structureTrend != null ? reads.structureTrend : c.structureTrend;
    if (struc && c.dir && struc !== 'range'){
      var opp = (c.dir === 'long') ? 'down' : 'up';
      if (struc === opp){ out.why.push('structure trend against'); return out; }
    }
    leg.strucWith = (struc && c.dir && struc === (c.dir === 'long' ? 'up' : 'down'));
    leg.strucReadable = (struc != null);

    var nw = reads.newsRisk != null ? reads.newsRisk : c.newsRisk;
    if (nw === 'blackout'){ out.why.push('news blackout'); return out; }
    leg.newsWith = (nw === 'low');
    leg.newsReadable = (nw != null);

    var sess = reads.sess != null ? reads.sess : c.sess;
    if (sess === 'thin'){ out.why.push('thin/dead tape'); return out; }
    leg.sessWith = (sess === 'participating');
    leg.sessReadable = (sess != null);

    var rvol = reads.volumeRvol != null ? +reads.volumeRvol : (c.volumeRvol != null ? +c.volumeRvol : NaN);
    if (isFinite(rvol) && rvol < VOLUME_AGAINST){ out.why.push('volume witness against (RVOL ' + rvol.toFixed(2) + ')'); return out; }
    leg.volWith = (isFinite(rvol) && rvol >= VOLUME_WITH);
    leg.volReadable = isFinite(rvol);

    out.perfect = true;

    /* ---- the headline tier (hg-v1030): PERFECT⁺ is earned when AT LEAST ONE
       evidence leg is readable AND every readable leg is WITH — nothing
       readable is merely neutral, let alone against. An UNREADABLE leg does
       not block the WITH-check (a missing feed is absent, not unfavourable),
       so PERFECT⁺ means "we have a favourable witness, and nothing we can
       read says otherwise". The any-readable guard is what stops the tier
       minting on a candidate whose evidence is entirely silent — a max-
       confluence badge on zero evidence is a coerced story, not a read mark.
       It also keeps the tier meaningful for desks that feed a subset (e.g.
       gold feeds news + volume, not the trend-matrix witnesses). ---- */
    var anyReadable = leg.flowReadable || leg.fundReadable || leg.atrReadable
      || leg.strucReadable || leg.newsReadable || leg.sessReadable || leg.volReadable;
    out.plus = anyReadable && (!leg.flowReadable || leg.flowWith)
             && (!leg.fundReadable || leg.fundWith)
             && (!leg.atrReadable || leg.atrWith)
             && (!leg.strucReadable || leg.strucWith)
             && (!leg.newsReadable || leg.newsWith)
             && (!leg.sessReadable || leg.sessWith)
             && (!leg.volReadable || leg.volWith);

    return out;
  }catch(e){
    return out;
  }
}

/* The ★ PERFECT badge — PERFECT⁺ when every evidence leg is on and WITH,
   plain PERFECT when the always-computable bar is cleared with nothing
   against. Empty string when not perfect — every desk wraps its own
   "most probable" line with it, so a screenshot keeps the tier legible. */
function hgPerfectStamp(c, reads){
  var r = hgPerfectFormation(c, reads);
  if (!r.perfect) return '';
  /* prefer the ranker's own verdict when it has travelled on the row (so the
     banner agrees with what the ledger recorded), else recompute from c. */
  var plus = (c && c.perfectPlus === true) ? true : r.plus;
  var title = plus
    ? 'perfect setup formation ★ PLUS — max confluence, every readable evidence leg WITH'
    : 'perfect setup formation: max confluence, every readable evidence leg WITH, nothing against — a filter, not a promise';
  if (r.why && r.why.length) title += ' · passed: ' + r.why.join(', ');
  title = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  var label = plus ? '\u2605 PERFECT\u207A' : '\u2605 PERFECT';
  var bg = plus ? '#FFFBEB' : '#FEF3C7', border = plus ? '#D97706' : '#F59E0B', color = plus ? '#92400E' : '#92400E';
  return '<span style="display:inline-block;margin-left:6px;font-size:10px;font-weight:800;letter-spacing:.12em;color:' + color + ';background:' + bg + ';padding:2px 7px;border-radius:4px;border:1px solid ' + border + ';vertical-align:middle" title="' + title + '">' + label + '</span>';
}

/* The forward-ledger read-mark: true when perfect, undefined otherwise — the
   split by which the PERFECT cohort's outcome is measured against the rest. */
function hgPerfectLedgerMark(c, reads){
  return hgPerfectFormation(c, reads).perfect ? true : undefined;
}

/* The PERFECT⁺ read-mark (hg-v1030): true when the headline max-confluence
   tier fired (every evidence leg readable AND WITH), undefined otherwise. */
function hgPerfectPlusLedgerMark(c, reads){
  return hgPerfectFormation(c, reads).plus ? true : undefined;
}

G.hgPerfectFormation = hgPerfectFormation;
G.hgPerfectStamp = hgPerfectStamp;
G.hgPerfectLedgerMark = hgPerfectLedgerMark;
G.hgPerfectPlusLedgerMark = hgPerfectPlusLedgerMark;

})();
