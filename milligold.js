/* =========================================================================
HARDGATE — milligold.js
MILLI GOLD — gold setups from ONLY the mechanics that measured profitable.

WHAT THIS IS, AND WHAT IT IS NOT.

Asked for: a tab that forms gold setups using only the indicators and
strategies that have actually paid across the gold desks. That is a
well-defined question with a derivable answer, and this is it — nine of
OMNIGOLD's 54 measured mechanics are net-positive at XM on the gate-clear
population, and this tab forms from those nine and nothing else.

It is NOT a new engine. Every detector, gate, plan and grade here is
OMNIGOLD's, reached through its own exports (hgOgFetchRows, hgOgDetect,
hgOgEvaluate). A second copy of that engine would drift from the first the
day either was touched, and the only thing this tab changes is WHICH
mechanics are allowed to reach a card. The filter runs on the DETECT
output, before evaluation, so a mechanic off the roster is never scored,
never graded and never ranked — it cannot arrive by some other path.

AND THE HONEST PART, WHICH LEADS THE TAB RATHER THAN SITTING UNDER IT.

hg-v935 tested this exact selection procedure out of sample: four disjoint
windows, the mechanics ranked on the other three each time, the chosen set
scored on the held-out one, at both fill bounds. "Keep the net-positive
mechanics" scored 13-14 of 16. NEVER UNANIMOUS. The same pack found that
even the best rule that IS unanimous lifts net expectancy by +0.03R and
leaves the book negative.

So the cohort's +0.0565R is what these nine did IN THE BOOK THEY WERE
CHOSEN FROM. It is an upper bound on what they should be expected to do,
not a forecast, and the panel says so in those words. Each of the nine is
also inside the noise on its own — the largest cluster-robust t on the
roster is about 1.55 against a family bar above 3.1 — so this is the best
available reading of which mechanics have paid, not a demonstration that
any of them pays.

That disclosure is not decoration. A tab called "the profitable ones" is
exactly the shape a reader over-trusts, and hg-v920 is in this repo because
a selection that looked this good in sample was worse in three of four
disjoint windows.

NOTHING HERE LOOSENS A GATE. The roster only ever REMOVES mechanics from
what OMNIGOLD would have shown. G1-G7, the cost ceiling, the one-at-a-time
hold and the measured-edge veto all still apply, because they are the same
code path.
========================================================================= */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;
var __mg = { ui: null, busy: false, ranOnce: false, last: null };

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;'
      : c === '"' ? '&quot;' : '&#39;';
  });
}
function gfn(n){ try { return (typeof W[n] === 'function') ? W[n] : null; } catch (e){ return null; } }
function sgn(n){ return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(4); }

/* --- BEGIN GENERATED HG_MILLI_ROSTER (scripts/milli-gold-roster.mjs) ---
   Every figure is re-derived from scripts/omnigold-replay-evidence.json by
   that script. Do not hand-edit — `npm run gold:milli` is the drift check.
   A roster is the last place a stale number should live, because it decides
   what this tab forms at all. */
  var HG_MILLI_ROSTER = {
    window: '2026-03-27..2026-09-10', minN: 20, minRr: 2,
    cohortN: 678, cohortGross: 0.0887, cohortNet: 0.0565,
    maxAbsT: 1.55,
    kinds: [
    { kind: 'P5-DRIVE', n: 48, settled: 41, winRate: 0.3902, grossR: 0.2146, netXm: 0.1796, tCluster: 1.55 },
    { kind: 'STRUCT-BOS', n: 103, settled: 87, winRate: 0.3448, grossR: 0.1085, netXm: 0.0816, tCluster: 1.22 },
    { kind: 'SQUEEZE-FIRE', n: 50, settled: 45, winRate: 0.3556, grossR: 0.1082, netXm: 0.0746, tCluster: 0.55 },
    { kind: 'CUSUM-SHIFT', n: 44, settled: 32, winRate: 0.3438, grossR: 0.0918, netXm: 0.0707, tCluster: 0.58 },
    { kind: 'MMOVE', n: 204, settled: 177, winRate: 0.3559, grossR: 0.0836, netXm: 0.0587, tCluster: 1.54 },
    { kind: 'TREND-RECLAIM', n: 106, settled: 99, winRate: 0.3636, grossR: 0.0923, netXm: 0.0549, tCluster: 0.83 },
    { kind: 'P6-COMP', n: 98, settled: 82, winRate: 0.3293, grossR: 0.0421, netXm: 0.0186, tCluster: 0.32 },
    { kind: 'EQH-SWEEP', n: 41, settled: 41, winRate: 0.3659, grossR: 0.0976, netXm: 0.0159, tCluster: 0.36 },
    { kind: 'BOS-RETEST', n: 83, settled: 74, winRate: 0.3378, grossR: 0.0367, netXm: 0.0027, tCluster: 0.3 }
    ]
  };
  /* --- END GENERATED HG_MILLI_ROSTER --- */

/** The roster as a Set, for the hit filter. */
function rosterSet(){
  var s = {};
  var k = (HG_MILLI_ROSTER && HG_MILLI_ROSTER.kinds) || [];
  for (var i = 0; i < k.length; i++) s[String(k[i].kind).toUpperCase()] = k[i];
  return s;
}

/** The one thing this tab does to OMNIGOLD's pipeline: drop every hit whose
    mechanic is not on the roster. Applied to DETECT output, so an off-roster
    mechanic is never evaluated, graded or ranked — there is no second path by
    which one could arrive. An empty roster keeps NOTHING, deliberately: a tab
    defined as "only the measured ones" must go silent when it has no
    measurements, not fall back to showing everything. */
function hgMilliFilterHits(hits){
  var keep = [], set = rosterSet(), i;
  if (!hits || !hits.length) return keep;
  for (i = 0; i < hits.length; i++){
    var h = hits[i];
    if (!h) continue;
    var kind = String(h.kind || h.mech || '').toUpperCase();
    if (Object.prototype.hasOwnProperty.call(set, kind)) keep.push(h);
  }
  return keep;
}

/** A roster row's record, for the chip a card carries. */
function hgMilliRecord(kind){
  var r = rosterSet()[String(kind || '').toUpperCase()];
  return r || null;
}

/** THE PANEL THAT LEADS THE TAB. Every number comes from the generated
    roster, so a re-bake moves them instead of leaving a stale boast. */
function hgMilliDisclosureHtml(){
  var R = HG_MILLI_ROSTER;
  if (!R || !R.kinds || !R.kinds.length){
    return '<div class="note warn" style="margin:8px 0;padding:6px 8px;'
      + 'border:1px solid #B45309;border-left:3px solid #B45309;border-radius:4px">'
      + '<b>NO ROSTER</b> &mdash; this tab forms from the mechanics measured '
      + 'net-positive in the committed walk, and none is loaded. It shows nothing '
      + 'rather than falling back to the full register, because "only the measured '
      + 'ones" with no measurements is not a smaller desk, it is a different one.</div>';
  }
  return '<div class="note" style="margin:8px 0;padding:6px 8px;'
    + 'border:1px solid #B45309;border-left:3px solid #B45309;border-radius:4px;'
    + 'background:rgba(180,83,9,0.07);font-size:0.85em">'
    + '<b>THESE ARE THE ' + R.kinds.length + ' MECHANICS THAT MEASURED POSITIVE, AND '
    + 'THAT IS A WEAKER CLAIM THAN IT SOUNDS</b> &mdash; on the gate-clear population '
    + 'of the ' + esc(R.window) + ' walk they pool to ' + R.cohortN + ' settled trades, '
    + 'gross ' + sgn(R.cohortGross) + 'R and net ' + sgn(R.cohortNet) + 'R at XM.'
    + '<div style="margin-top:4px"><b>That is what they did in the book they were '
    + 'chosen from.</b> hg-v935 tested this exact selection out of sample &mdash; four '
    + 'disjoint windows, the mechanics ranked on the other three each time, both fill '
    + 'bounds &mdash; and keeping the net-positive mechanics scored <b>13-14 of 16, '
    + 'never unanimous</b>. So the figure above is an <b>upper bound</b>, not a '
    + 'forecast.</div>'
    + '<div style="margin-top:4px">Each one is also inside the noise on its own: the '
    + 'largest cluster-robust t on this roster is <b>' + R.maxAbsT.toFixed(2)
    + '</b>, against a family bar above 3.1. This is the best available reading of '
    + 'which mechanics have paid &mdash; not a demonstration that any of them pays.</div>'
    + '<div style="margin-top:4px;opacity:0.85">Nothing here loosens a gate: the roster '
    + 'only ever removes mechanics from what OMNIGOLD would show, and every gate, plan '
    + 'and grade is that desk\'s own code. Re-derive: '
    + '<code>npm run gold:milli</code></div>'
    + '</div>';
}

/** The roster table, so the reader can see what was included and on what. */
function hgMilliRosterHtml(){
  var R = HG_MILLI_ROSTER;
  if (!R || !R.kinds || !R.kinds.length) return '';
  var h = '<table class="tbl" style="margin-top:8px"><tr><th>MECHANIC</th>'
    + '<th>SETTLED</th><th>WIN</th><th>GROSS</th><th>NET XM</th><th>t</th></tr>';
  for (var i = 0; i < R.kinds.length; i++){
    var k = R.kinds[i];
    h += '<tr><td>' + esc(k.kind) + '</td>'
      + '<td class="hg-num">' + k.settled + '</td>'
      + '<td class="hg-num">' + (k.winRate * 100).toFixed(1) + '%</td>'
      + '<td class="hg-num">' + sgn(k.grossR) + '</td>'
      + '<td class="hg-num">' + sgn(k.netXm) + '</td>'
      + '<td class="hg-num">' + (k.tCluster >= 0 ? '+' : '') + k.tCluster.toFixed(2) + '</td></tr>';
  }
  h += '</table><div class="note" style="margin-top:4px">Admitted at n &ge; '
    + R.minN + ' firings and net &gt; 0 at XM, judged at ' + R.minRr
    + 'R. The sample floor is OMNIGOLD\'s own MIN_SAMPLES: a roster that used a '
    + 'looser floor than the desk\'s evidence gate would admit mechanics that gate '
    + 'calls too thin to judge.</div>';
  return h;
}

/** Cards for whatever survived, using OMNIGOLD's own renderer when present. */
function hgMilliCardsHtml(rows){
  if (!rows || !rows.length){
    return '<div class="note" style="margin-top:8px">No setup from the roster right '
      + 'now. That is the ordinary state: this tab watches ' + ((HG_MILLI_ROSTER
      && HG_MILLI_ROSTER.kinds) ? HG_MILLI_ROSTER.kinds.length : 0)
      + ' mechanics where OMNIGOLD watches its whole register, so it is silent more '
      + 'often, by construction rather than by fault.</div>';
  }
  var card = gfn('hgOmniSetupCard') || gfn('hgOgSetupCard');
  var out = '', i;
  for (i = 0; i < rows.length; i++){
    var c = rows[i];
    var rec = hgMilliRecord(c && (c.kind || c.mech));
    var chip = rec ? ('<div class="note">ROSTER RECORD &mdash; ' + esc(rec.kind) + ': '
      + rec.settled + ' settled, ' + (rec.winRate * 100).toFixed(1) + '% to T1 first, net '
      + sgn(rec.netXm) + 'R at XM, t ' + (rec.tCluster >= 0 ? '+' : '')
      + rec.tCluster.toFixed(2) + ' &mdash; in sample, and inside the noise.</div>') : '';
    if (card){ try { out += card(c) + chip; continue; } catch (e){} }
    out += '<div class="panel"><b>' + esc(String(c.kind || c.mech || 'SETUP')) + '</b> '
      + esc(String(c.dir || '')) + chip + '</div>';
  }
  return out;
}

async function runMilliGold(ui){
  if (__mg.busy) return 'busy';
  __mg.busy = true;
  if (ui && ui.stat) ui.stat.textContent = 'scanning…';
  /* Declared OUT HERE on purpose. A feed fault must be reported even when the
     scan then fails — especially then, because an error message that changes
     with the bars while saying nothing about them is exactly how a reader
     concludes the desk is quiet rather than that the tape is broken. The first
     version computed this inside the success path only, and the family guard
     caught it: on a tape with a 12-bar hole this tab's output changed and it
     said nothing. */
  var tapeNote = '';
  try{
    var fetchRows = gfn('hgOgFetchRows'), detect = gfn('hgOgDetect'), evaluate = gfn('hgOgEvaluate');
    if (!fetchRows || !detect || !evaluate){
      if (ui && ui.body) ui.body.innerHTML = hgMilliDisclosureHtml()
        + '<div class="note warn" style="margin-top:8px">OMNIGOLD is not loaded, and this '
        + 'tab is that desk restricted to a roster &mdash; it has no engine of its own to '
        + 'fall back on, and inventing one here would be a second copy that drifts.</div>'
        + hgMilliRosterHtml();
      return 'no-engine';
    }
    var got = await fetchRows('1h', 400);
    var rows = (got && got.rows) || [];
    /* The shared gold tape rule, same as every other candle-fetching gold tab:
       stale feed, bad bar, hole in the series. Computed BEFORE anything reads
       the bars. A desk restricted to the mechanics that measured well is MORE
       exposed to a bad bar, not less — a narrow roster means each surviving
       setup carries more weight. Fails open when goldind is absent. */
    try{
      var tapeFn = gfn('hgGoldTapeNotes');
      if (tapeFn && rows.length) tapeNote = tapeFn(rows, '1h') || '';
    }catch(eTape){ tapeNote = ''; }

    var hits = detect(rows, {}) || [];
    var kept = hgMilliFilterHits(hits);
    var cards = kept.length ? (evaluate(rows, kept, {}, {}) || []) : [];
    __mg.last = { scanned: hits.length, kept: kept.length, cards: cards.length };
    if (ui && ui.body){
      ui.body.innerHTML = tapeNote + hgMilliDisclosureHtml()
        + '<div class="note" style="margin-top:8px">' + hits.length + ' mechanic hits this '
        + 'scan, ' + kept.length + ' on the roster, ' + cards.length + ' cleared the gates.</div>'
        + hgMilliCardsHtml(cards)
        + hgMilliRosterHtml();
    }
    if (ui && ui.stat) ui.stat.textContent = 'updated ' + new Date().toISOString().slice(11, 19) + ' UTC';
    __mg.ranOnce = true;
    return 'ok';
  }catch(e){
    if (ui && ui.body) ui.body.innerHTML = tapeNote + hgMilliDisclosureHtml()
      + '<div class="note warn" style="margin-top:8px">' + esc(e && (e.message || e)) + '</div>';
    return 'error';
  }finally{ __mg.busy = false; }
}

function mountMilliGold(el){
  if (!el) return;
  el.innerHTML = '<div class="panel"><h2>MILLI GOLD <span>only the mechanics that '
    + 'measured net-positive &middot; OMNIGOLD engine, roster-restricted</span></h2>'
    + '<div class="row"><button class="btn" id="milliRun">RUN SCAN</button>'
    + '<span class="note" id="milliStat">auto-runs on open</span></div>'
    + '<div id="milliBody"></div></div>';
  __mg.ui = { el: el, body: el.querySelector('#milliBody'),
              stat: el.querySelector('#milliStat'), run: el.querySelector('#milliRun') };
  if (__mg.ui.run) __mg.ui.run.addEventListener('click', function(){ runMilliGold(__mg.ui); });
  runMilliGold(__mg.ui);
}

async function refreshMilliGold(){
  if (__mg.busy) return 'busy';
  if (!__mg.ranOnce || !__mg.ui) return 'skipped: not run yet';
  return runMilliGold(__mg.ui);
}

W.HG_MILLI_ROSTER = HG_MILLI_ROSTER;
W.hgMilliFilterHits = hgMilliFilterHits;
W.hgMilliRecord = hgMilliRecord;
W.hgMilliDisclosureHtml = hgMilliDisclosureHtml;
W.hgMilliRosterHtml = hgMilliRosterHtml;
W.hgMilliCardsHtml = hgMilliCardsHtml;
W.hgMilliState = function(){ return __mg.last; };

W.HG_tabs = W.HG_tabs || [];
W.HG_tabs.push({ id: 'milligold', label: 'MILLI GOLD', mount: mountMilliGold, refresh: refreshMilliGold });

})();
