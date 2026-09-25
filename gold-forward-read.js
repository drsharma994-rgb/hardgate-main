/* HARDGATE — gold-forward-read.js — THE GOLD DESKS READ THE RECORDS THEY WRITE.

   Thirteen of the fifteen gold tabs that can be driven write forward
   records on every scan. Four read any back. Nine write into a log that,
   from their own board, may as well not exist: they record what they
   fired, the log settles it, and the desk never asks what happened.

   MEASURED (pack 913), across the gold family:

     write a forward record   13   super-gold omnigold omnigold1 optigold
                                   newgold golddirection goldswing goldscalp
                                   goldultra goldpro goldpine tauric 80percent
     read one back             4   omnigold omnigold1 golddirection 80percent
     write and never read      9

   GOLDSCALP and GOLDSWING are a partial exception worth naming rather than
   counting as read: OMNIGOLD pools their records into ITS gate
   (OG_SCALP_FWD_TABS / OG_SWING_FWD_TABS), so the records are consulted —
   by a different desk, for a different board. The desk that wrote them
   still never sees them. GOLDULTRA, NEWGOLD, OPTI GOLD and GOLDPRO are
   pooled by nobody at all.

   WHAT THIS DOES NOT DO. It does not reimplement OMNIGOLD's measured-edge
   gate. That gate carries years of care this module has no business
   duplicating — all/ticket/gate-clear populations, cross-tab pooling,
   an effective-n overlap correction, a multiple-comparison bar counted
   from the horizon table. Two copies of that would be two things to drift.
   This is the small honest version for the desks that have nothing: what
   does my own log say about me, and is it enough to say anything.

   THE VERDICT USES THE REPO'S OWN ARITHMETIC, not a new threshold.
   A mechanic pays if its win rate beats the breakeven implied by its own
   measured R:R; it fails if it cannot. Both sides are Wilson bounds at the
   same z the accuracy floor uses, via the same hgWilsonLower:

     breakeven hit   = 1 / (1 + avgRr)        -- from the log's own avgRr
     PAYING          Wilson LOWER(wins, n) > breakeven
     LOSING          Wilson UPPER(wins, n) < breakeven
     UNMEASURED      the interval straddles it, or n is under the bar

   Wilson's upper bound is 1 - lower(losses, n) by the symmetry of the
   interval; verified to 3.3e-16 across every (w, n) up to 500 rather than
   assumed, so the tested helper does both jobs and there is one
   implementation of the interval in this repo, not two.

   IT REPORTS. A LOSING verdict demotes — never suppresses — and only at
   OMNIGOLD's own EDGE_VETO_SAMPLES bar of 30 settled trades, because
   borrowing that desk's threshold is honest where inventing one is not.
   UNMEASURED changes nothing at all: an empty log is the normal state of a
   desk that has not traded yet, and a desk that has not traded yet must not
   read as a desk that has failed. */
(function(W){
  'use strict';
  if (!W) return;

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* OMNIGOLD's own bars, named here so the borrowing is visible. */
  var FWD_MIN_JUDGE = 20;        /* settled trades before any verdict at all */
  var FWD_DEMOTE_SAMPLES = 30;   /* OMNIGOLD EDGE_VETO_SAMPLES */
  var FWD_Z = 1.96;

  function wilsonLower(wins, n){
    return (typeof W.hgWilsonLower === 'function') ? W.hgWilsonLower(wins, n, FWD_Z) : NaN;
  }
  /* upper(w, n) === 1 - lower(n - w, n). Verified, not assumed. */
  function wilsonUpper(wins, n){
    var lo = wilsonLower(n - wins, n);
    return isFinite(lo) ? (1 - lo) : NaN;
  }

  /* The pools a gold tab writes into. Taken from the accuracy roster rather
     than a second list — that roster already resolves prefix families
     (GOLDPINE:*, NEWGOLD:*) from the log, and two rosters would be two
     chances to name different pools. */
  function hgGoldFwdPools(tabId){
    try{
      var roster = W.HG_ACCURACY_TABS;
      var entry = roster && roster[String(tabId || '')];
      if (!entry) return null;
      if (typeof W.hgAccuracyPools === 'function') return W.hgAccuracyPools(entry);
      /* the roster is there but its resolver is not exported: take the exact
         names and skip the families rather than guessing their suffixes */
      var out = [], i;
      for (i = 0; i < entry.length; i++) if (typeof entry[i] === 'string') out.push(entry[i]);
      return out.length ? out : null;
    }catch(e){ return null; }
  }

  /* -> { verdict, why } with verdict one of 'paying' | 'losing' |
     'unmeasured'. Null when there is nothing to judge, which is different
     from having judged and found nothing. */
  function hgGoldFwdVerdict(stat){
    if (!stat) return null;
    var n = +stat.samples, w = +stat.wins, rr = +stat.avgRr;
    if (!isFinite(n) || n < 1) return { verdict: 'unmeasured', why: 'nothing has settled yet' };
    if (!isFinite(w)) return { verdict: 'unmeasured', why: 'the log carries no win count' };
    if (n < FWD_MIN_JUDGE){
      return { verdict: 'unmeasured',
               why: n + ' settled, under the ' + FWD_MIN_JUDGE + ' this desk requires before it will conclude anything' };
    }
    if (!isFinite(rr) || !(rr > 0)){
      return { verdict: 'unmeasured', why: 'no measured R:R in the log, so there is no breakeven to judge against' };
    }
    var be = 1 / (1 + rr);
    var lo = wilsonLower(w, n), hi = wilsonUpper(w, n);
    if (!isFinite(lo) || !isFinite(hi)) return { verdict: 'unmeasured', why: 'the interval could not be computed' };
    if (lo > be) return { verdict: 'paying', why: 'the 95% interval sits ABOVE breakeven', be: be, lo: lo, hi: hi };
    if (hi < be) return { verdict: 'losing', why: 'the 95% interval sits BELOW breakeven', be: be, lo: lo, hi: hi };
    return { verdict: 'unmeasured', why: 'the 95% interval straddles breakeven', be: be, lo: lo, hi: hi };
  }

  /* -> { tabId, pools, stat, verdict, demote } or null when the log layer
     is absent. Never throws; a desk with no reader must not lose its scan. */
  function hgGoldFwdRead(tabId, mechanic){
    try{
      if (typeof W.hgFwdStats !== 'function') return null;
      var pools = hgGoldFwdPools(tabId);
      if (!pools || !pools.length) return null;
      var stat = W.hgFwdStats(pools, mechanic || null, false);
      if (!stat) return null;
      var v = hgGoldFwdVerdict(stat);
      return {
        tabId: String(tabId || ''), pools: pools, mechanic: mechanic || null, stat: stat,
        verdict: v ? v.verdict : null, why: v ? v.why : null, be: v ? v.be : null,
        lo: v ? v.lo : null, hi: v ? v.hi : null,
        /* the only behaviour this module asks for, and only at OMNIGOLD's bar */
        demote: !!(v && v.verdict === 'losing' && +stat.samples >= FWD_DEMOTE_SAMPLES)
      };
    }catch(e){ return null; }
  }

  /* typeof first: isFinite(null) is TRUE and Number(null) is 0, so a bare
   isFinite check renders a missing bound as a confident 0.0%. This module
   passes r.lo / r.hi straight in, and those ARE null whenever the verdict
   could not compute an interval — which is precisely the case a fabricated
   zero would hide. test-null-formatting caught it. */
  function pct(x){ return (typeof x === 'number' && isFinite(x)) ? (x * 100).toFixed(1) + '%' : 'n/a'; }

  /* hg-v979: the records this desk priced on another feed and is now
     waiting to settle on it. Renders NOTHING unless a known mismatch is
     counted -- an absent feed on either side is not a wait. */
  function hgGoldFwdFeedHeldHtml(pools, feed){
    try{
      if (typeof feed !== 'string' || !feed || typeof W.hgFwdFeedHeld !== 'function') return '';
      var h = W.hgFwdFeedHeld(pools, feed);
      if (!h || !(h.held > 0)) return '';
      var parts = [], k;
      for (k in h.feeds) if (Object.prototype.hasOwnProperty.call(h.feeds, k)) parts.push(h.feeds[k] + ' on ' + k);
      return '<div class="note" style="margin:6px 0;padding:6px 9px;border-left:3px solid #94A3B8;font-size:11px">'
        + '<b>' + h.held + ' OPEN RECORD' + (h.held === 1 ? '' : 'S') + ' PRICED ON ANOTHER FEED</b> — '
        + esc(parts.join(', ')) + '; this scan reads <b>' + esc(feed) + '</b>. '
        + 'The ledger settles a record only on bars of the feed its levels were priced on '
        + '(hg-v979): a stop narrower than the basis between two gold feeds is hit on the first bar '
        + 'whatever the tape did. These wait for their own feed to return.</div>';
    }catch(e){ return ''; }
  }

  /* hg-v980: the fill-aware split beside the verdict. hgFwdStats has counted
     it since the fill model was written and no gold desk fed it a mark, so
     it read 0/0 on every gold pool. Renders NOTHING while no record carries
     a fill resolution -- a legacy log is not evidence about fills. */
  function hgGoldFwdFillHtml(stat){
    try{
      if (!stat) return '';
      var w = +stat.fillWins || 0, l = +stat.fillLosses || 0, u = +stat.fillUnfilled || 0, p = +stat.fillUnprovable || 0;
      if (!(w + l + u + p > 0)) return '';
      var n = w + l;
      return '<div class="note" style="margin:6px 0;padding:6px 9px;border-left:3px solid #94A3B8;font-size:11px">'
        + '<b>FILL-AWARE:</b> ' + n + ' filled and settled (' + w + 'W / ' + l + 'L'
        + (n ? ', ' + (w / n * 100).toFixed(1) + '% hit' : '') + ') · '
        + u + ' never filled · ' + p + ' unprovable (the fill bar also touched an exit). '
        + 'Settled as if the order had to fill first (hg-v980): a resting order that never opened '
        + 'is excluded rather than settled as a market order, which is what the actual tally above does.</div>';
    }catch(e){ return ''; }
  }

  function hgGoldFwdNote(tabId, mechanic, feed){
    var r = hgGoldFwdRead(tabId, mechanic);
    /* hg-v979: the wait line does not depend on a verdict -- a desk with
       nothing settled yet can still have records waiting for their feed */
    var heldHtml = '';
    try{ heldHtml = hgGoldFwdFeedHeldHtml(hgGoldFwdPools(tabId), feed); }catch(eH){ heldHtml = ''; }
    if (!r) return heldHtml;
    var s = r.stat, n = +s.samples;
    var head, body;
    if (r.verdict === 'losing'){
      head = 'ITS OWN FORWARD LOG SAYS THIS DESK IS LOSING';
      body = 'over ' + n + ' settled trades it won ' + pct(s.hit) + ' at an average '
        + (isFinite(s.avgRr) ? s.avgRr.toFixed(2) : '?') + ':1, and the 95% interval ('
        + pct(r.lo) + '–' + pct(r.hi) + ') sits entirely BELOW the ' + pct(r.be)
        + ' that R:R needs to break even.'
        + (r.demote ? ' Cards are demoted — painted, never led.' : ' Under ' + FWD_DEMOTE_SAMPLES
            + ' settled it is reported and nothing is demoted on it.');
    } else if (r.verdict === 'paying'){
      head = 'ITS OWN FORWARD LOG SAYS THIS DESK IS PAYING';
      body = 'over ' + n + ' settled trades it won ' + pct(s.hit) + ' at an average '
        + (isFinite(s.avgRr) ? s.avgRr.toFixed(2) : '?') + ':1, and the 95% interval ('
        + pct(r.lo) + '–' + pct(r.hi) + ') sits entirely ABOVE the ' + pct(r.be)
        + ' breakeven. Nothing is promoted on it: a desk that is paying still has to clear every gate.';
    } else {
      head = 'THIS DESK HAS NOT MEASURED ITSELF YET';
      body = esc(r.why) + '. ' + n + ' settled, ' + (+s.open || 0) + ' still open. '
        + 'Nothing is demoted or promoted on an unmeasured record — a desk that has not traded '
        + 'is not a desk that has failed.';
    }
    /* hg-v955: and the calendar split beside the verdict, because this note
       is the one seam every gold desk already renders. It appends NOTHING
       until a record carries the mark -- an absent split is not a clean one. */
    var cal = '';
    try{
      if (typeof W.hgFwdGoldCalendarHtml === 'function'){
        var pools = (r && r.pools && r.pools.length) ? r.pools : [];
        cal = W.hgFwdGoldCalendarHtml(pools.length === 1 ? pools[0] : null) || '';
      }
    }catch(eCal){ cal = ''; }
    return '<div class="note" style="margin:6px 0;padding:6px 9px;border-left:3px solid #94A3B8;font-size:11px">'
      + '<b>' + head + '</b> — ' + body
      + ' <span style="opacity:.7">(pool: ' + esc(r.pools.join(', ')) + ')</span></div>' + cal
      + hgGoldFwdFillHtml(r.stat)
      + heldHtml;
  }

  W.HG_GOLD_FWD_MIN_JUDGE = FWD_MIN_JUDGE;
  W.HG_GOLD_FWD_DEMOTE_SAMPLES = FWD_DEMOTE_SAMPLES;
  W.hgGoldFwdPools = hgGoldFwdPools;
  W.hgGoldFwdVerdict = hgGoldFwdVerdict;
  W.hgGoldFwdRead = hgGoldFwdRead;
  W.hgGoldFwdNote = hgGoldFwdNote;
  W.hgGoldFwdFeedHeldHtml = hgGoldFwdFeedHeldHtml;
  W.hgGoldFwdFillHtml = hgGoldFwdFillHtml;
})(typeof window !== 'undefined' ? window : this);
