/* HARDGATE — gold-rank-evidence.js — WHAT THE REPLAYS SAY ABOUT THE DESK'S
   OWN RANKING SIGNALS.

   The gold desks order a board and then present the top of it. MOST PROBABLE
   is a claim about which setup is best. Lead-eligibility decides which cards
   may be crowned at all. The A/B/C grade is printed on every card as quality.
   All three are rankings, and a ranking earns its keep only if the cards it
   puts first do better than the ones it puts last.

   MEASURED (pack 911), on the largest committed replays this repo holds —
   2,445 settled GOLD SCALP trades (backtest-goldscalp-results-floor.json)
   and 244 settled GOLD SWING trades (backtest-goldswing-results.json), net R
   at the desk's own XM venue cost:

     lane   signal                  nSel  nRest   selR    restR   diff     t
     SCALP  MOST PROBABLE vs rest    111   2334  -0.231  -0.154  -0.078  -0.74
     SCALP  lead-eligible vs demoted 381   2064  -0.221  -0.146  -0.075  -1.15
     SCALP  grade A vs B and C      1463    730  -0.165  -0.113  -0.053  -0.95
     SWING  grade A vs B and C         9    235  +0.972  +0.047  +0.926  +1.58

   NOT ONE CLEARS 95% IN EITHER DIRECTION. That is the finding, and it is
   worth stating precisely, because the temptation runs both ways:

     - It is NOT evidence the rankings are backwards. Four of the six
       comparisons run in the earlier sweep had point estimates saying the
       selected cards did worse, and none of them is significant. A t of
       -0.74 is a shrug, not a verdict.
     - It is NOT evidence the rankings work either. Nothing here shows a
       card the desk puts first doing better than one it puts last.

   The honest reading is the third one: on the evidence this repo has, the
   desk's three ranking signals are UNDEMONSTRATED. The SWING grade-A cell
   is the only one leaning positive and it rests on NINE settled trades.

   WHAT THIS MODULE DOES ABOUT IT: it says so, on the desks that display
   those signals. It does not reorder a board, suppress a card, or change a
   grade. There is no better ordering on hand — an unproven ranking still
   beats an arbitrary one — and swapping a ranking nobody has measured for a
   different ranking nobody has measured would be motion, not improvement.
   What changes is that MOST PROBABLE stops being read as a measured claim.

   This follows the precedent of the pack that stopped displaying confluence
   as a quality signal once its replay showed no monotonic decile ranking.

   RE-DERIVED, NOT REMEMBERED. Every number below is recomputed from the
   committed per-trade files by tests/test-gold-rank-evidence.mjs on each
   run, which fails on drift. A browser cannot read those JSONs, so the table
   has to be transcribed here — and pack 910 is the reason it is transcribed
   under a test rather than trusted. */
(function(W){
  'use strict';
  if (!W) return;

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var T_95 = 1.96;

  /* nSel/nRest are settled trades; selR/restR are mean net R at XM costs;
     t is Welch's on the difference of means. */
  var HG_GOLD_RANK_EVIDENCE = [
    { lane: 'scalp', signal: 'mp',     label: 'MOST PROBABLE',
      nSel: 111,  nRest: 2334, selR: -0.231, restR: -0.154, diff: -0.078, t: -0.74 },
    { lane: 'scalp', signal: 'lead',   label: 'lead-eligible (not demoted)',
      nSel: 381,  nRest: 2064, selR: -0.221, restR: -0.146, diff: -0.075, t: -1.15 },
    { lane: 'scalp', signal: 'gradeA', label: 'grade A',
      nSel: 1463, nRest: 730,  selR: -0.165, restR: -0.113, diff: -0.053, t: -0.95 },
    { lane: 'swing', signal: 'gradeA', label: 'grade A',
      nSel: 9,    nRest: 235,  selR: 0.972,  restR: 0.047,  diff: 0.926,  t: 1.58 }
  ];

  function hgGoldRankEvidenceFor(lane, signal){
    var i, r;
    for (i = 0; i < HG_GOLD_RANK_EVIDENCE.length; i++){
      r = HG_GOLD_RANK_EVIDENCE[i];
      if (r.lane === lane && r.signal === signal) return r;
    }
    return null;   /* absent is absent: no row, no claim */
  }

  /* 'ranks' / 'backwards' / 'undemonstrated' — never a fourth answer, and
     never a silent pass when the row is missing. */
  function hgGoldRankVerdict(row){
    if (!row || typeof row.t !== 'number' || !isFinite(row.t)) return null;
    if (row.t > T_95) return 'ranks';
    if (row.t < -T_95) return 'backwards';
    return 'undemonstrated';
  }

  function hgGoldRankEvidenceNote(lane, signal){
    var r = hgGoldRankEvidenceFor(lane, signal);
    var v = hgGoldRankVerdict(r);
    if (!r || !v) return '';
    var sel = (r.selR >= 0 ? '+' : '') + r.selR.toFixed(3);
    var rest = (r.restR >= 0 ? '+' : '') + r.restR.toFixed(3);
    var lean = r.diff < 0 ? 'lower' : 'higher';
    var body;
    if (v === 'undemonstrated'){
      body = '<b>' + esc(r.label) + ' IS NOT A MEASURED CLAIM.</b> Over '
        + (r.nSel + r.nRest) + ' settled ' + esc(lane) + ' trades in this desk\'s own replay, the cards it '
        + 'selected ran ' + sel + 'R against ' + rest + 'R for the rest — ' + lean + ', on n=' + r.nSel
        + ' against n=' + r.nRest + ', at t=' + r.t.toFixed(2) + '. That does not clear 95% in EITHER '
        + 'direction: it is not evidence the ranking is backwards, and it is not evidence it works. '
        + 'The board is still ordered this way because an unproven ordering beats an arbitrary one, '
        + 'and nothing here is suppressed or re-ranked on the strength of a shrug.';
    } else if (v === 'backwards'){
      body = '<b>' + esc(r.label) + ' RANKED BACKWARDS in replay.</b> Selected ' + sel + 'R against '
        + rest + 'R for the rest (n=' + r.nSel + ' vs ' + r.nRest + ', t=' + r.t.toFixed(2) + ').';
    } else {
      body = '<b>' + esc(r.label) + ' ranked outcomes in replay:</b> selected ' + sel + 'R against '
        + rest + 'R (n=' + r.nSel + ' vs ' + r.nRest + ', t=' + r.t.toFixed(2) + ').';
    }
    return '<div class="note" style="margin:6px 0;padding:6px 9px;border-left:3px solid #94A3B8;font-size:11px">'
      + body + '</div>';
  }

  W.HG_GOLD_RANK_EVIDENCE = HG_GOLD_RANK_EVIDENCE;
  W.hgGoldRankEvidenceFor = hgGoldRankEvidenceFor;
  W.hgGoldRankVerdict = hgGoldRankVerdict;
  W.hgGoldRankEvidenceNote = hgGoldRankEvidenceNote;
})(typeof window !== 'undefined' ? window : this);
