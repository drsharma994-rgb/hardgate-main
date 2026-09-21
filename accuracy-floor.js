/* HARDGATE — THE 80% ACCURACY FLOOR
   =====================================================================
   Asked for: every gold and crypto tab at better than 80% accuracy.

   Accuracy is not a setting. No edit to this file can make a rule win more
   often; the market decides that. What an edit CAN do is stop a tab
   presenting itself as better than it has been shown to be, and say — per
   tab, in one line — exactly where it stands against an 80% standard.

   So this is the floor, applied to every gold and crypto desk at once: a tab
   may claim to clear 80% only when its OWN settled forward records say so,
   and "say so" means the LOWER BOUND of a confidence interval, not the point
   estimate.

   WHY THE LOWER BOUND, AND NOT THE NUMBER ON THE SCREEN
   ----------------------------------------------------
   Three wins from three trades is 100%, and 100% is more than 80%. Reading
   that as clearing the floor is precisely the error that makes every
   over-fitted backtest look extraordinary. The Wilson interval asks a
   different question — given this record, what is the worst the true rate
   plausibly is — and at three from three the answer is 43.8%.

   At a FLAWLESS record the floor needs 16 independent observations:

     independent obs at 100%     Wilson 95% lower bound
              3                          43.8%
              8                          67.6%
             12                          75.7%
             15                          79.6%
             16                          80.6%   <- clears

   Anything less than perfect needs more, and the closer the true rate sits to
   the floor the more evidence it takes to prove it is above:

     observed rate     independent observations needed
         100%                        16
          95%                        28
          90%                        62
          85%                       246
          82%                     1,537

   That table is the honest answer to "make the desks better than 80%". A
   desk observed at 85% is not an 80% desk until roughly 246 independent
   observations say so, and at the ~5 independent observations a day this
   app's cross-sectional desks generate, that is about seven weeks. Below the
   floor the arithmetic simply stops: no sample size makes a 70% rule clear
   80%, and the banner says that rather than implying patience will fix it.

   AND WHY *INDEPENDENT* OBSERVATIONS
   ----------------------------------
   The count is effN from hgFwdOverlap, not the raw record count. A desk that
   fires on four hundred contracts on one bar, all with the same horizon, has
   written four hundred rows and seen ONE thing happen. CRYPTO SCAN measured
   4.96 independent observations from 3,840 rows — a whole day of scanning.
   Judging a floor on the raw count would let concurrency alone clear it.

   WHAT THIS DOES NOT DO
   ---------------------
   It does not hide cards, and it does not re-rank anything. A desk below the
   floor still shows its setups; what it can no longer do is stay quiet about
   the fact. Hiding every card on every tab until 16 independent observations
   accumulate would leave an empty app for weeks and teach nobody anything.
   ===================================================================== */
(function(){
'use strict';
var W = (typeof window !== 'undefined') ? window : globalThis;

/* ONE NUMBER, ONE PLACE. */
var HG_ACCURACY_FLOOR = 0.80;
var HG_ACCURACY_Z = 1.96;          /* 95% two-sided */

/* Every gold and crypto desk that writes forward records, mapped to the tab
   that shows it. A tab absent from here is not judged — silence about a desk
   nobody instrumented is honest; a verdict about it would not be.

   THE NAMES ON THE RIGHT ARE THE EXACT STRINGS THE DESK RECORDS UNDER, and
   they are checked against the source rather than trusted. hgFwdPool matches
   rec.tab with !==, so a name that is merely PLAUSIBLE pools nothing and the
   desk reads NOT YET MEASURED for ever — a wrong verdict that looks like a
   patient one, and invisible, because that is what a new desk looks like.
   The first cut of this roster guessed five of them: GOLD SCALP for
   GOLDSCALP, OI FLOW for OIFLOW, REVERSAL SNIPER for REVERSALSNIPER, GOLD
   ULTRA for GOLDULTRA and GOLD SWING for GOLDSWING.

   A CORRECTION TO WHAT v896 SAID HERE. It also claimed OMNIGOLD "records
   nothing at all" and left it off. That was wrong. OMNIGOLD records under
   OMNIGOLD:SCALP and OMNIGOLD:SWING through a captured local —
   `var fwdRecord = gfn('hgFwdRecord')` — which an extraction keyed on the
   literal name at the call site could not see. The check now follows that
   indirection, and it runs BOTH ways: a roster name the sources never write
   fails, and a desk that records and owns a tab but is absent from the roster
   fails too. The second direction is the one that would have caught this.

   The gold tabs genuinely left off are GOLD SPOT, a spot-versus-perp basis
   monitor, and GOLD COINT, a cointegration context ledger. Neither mentions
   entry, stop or t1 anywhere: there is nothing to measure, so there is no
   verdict to give.

   A tab may pool under SEVERAL names when one desk is split by an artefact of
   naming rather than by strategy — NEWGOLD by horizon, GOLDPINE by scalp and
   swing, OMNIGOLD by horizon. Those are written as { prefix } and resolved
   from the log, so a family can grow a member without this list rotting. */
var HG_ACCURACY_TABS = {
  /* crypto */
  cryptoscan:     ['CRYPTO SCAN'],
  cryptoverse:    ['CRYPTOVERSE'],
  ninetypercent:  ['90PERCENT'],
  omniroute:      ['OMNIROUTE'],
  omnipresent:    ['OMNIPRESENT'],
  reversalsniper: ['REVERSALSNIPER'],
  squeeze:        ['SQUEEZE'],
  oiflow:         ['OIFLOW'],
  edge:           ['EDGE'],
  brain:          ['BRAIN'],
  dexscreener:    ['DEX-SCREENER'],
  pine:           ['PINE'],
  trendmx:        ['TRENDMX'],
  execute:        ['EXECUTE'],
  'super-best':   ['SUPER:BEST'],
  'super-sniper': ['SUPER:SNIPER'],
  /* gold */
  omnigold:       ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING'],
  omnigold1:      ['omnigold1'],
  goldscalp:      ['GOLDSCALP'],
  goldswing:      ['GOLDSWING'],
  goldultra:      ['GOLDULTRA'],
  goldpro:        ['GOLDPRO'],
  goldpine:       [{ prefix: 'GOLDPINE:' }],
  golddirection:  ['GOLDDIRECTION'],
  newgold:        [{ prefix: 'NEWGOLD:' }],
  optigold:       ['OPTI GOLD'],
  '80percent':    ['OMNIGOLD:P80'],
  tauric:         ['OMNIGOLD:TAURIC'],
  'super-gold':   ['SUPER:GOLD']
};

/* A roster entry is an exact pool name, or { prefix } for a desk that writes
   a FAMILY of them. Resolving a family from the log rather than listing its
   suffixes here keeps one list instead of two: GOLDPINE splits scalp/swing,
   NEWGOLD splits by horizon, and neither can add a third without this
   picking it up. Exact names stay exact -- OMNIGOLD:P80 and OMNIGOLD:TAURIC
   are separate desks that merely share a stem with OMNIGOLD, so OMNIGOLD is
   listed by its two exact pools and NOT as a prefix, or it would swallow
   both of them. */
function hgAccuracyPools(entry){
  var out = [], i, e, got;
  for (i = 0; i < entry.length; i++){
    e = entry[i];
    if (typeof e === 'string'){ out.push(e); continue; }
    if (!e || !e.prefix) continue;
    got = (typeof W.hgFwdTabs === 'function') ? W.hgFwdTabs(e.prefix) : null;
    if (got && got.length) out = out.concat(got);
  }
  return out;
}

/* What a family MIGHT resolve to is not known before the log is read, so a
   banner names the stem rather than promising a count it has not counted. */
function hgAccuracyStems(entry){
  var out = [], i, e;
  for (i = 0; i < entry.length; i++){
    e = entry[i];
    out.push(typeof e === 'string' ? e : (e && e.prefix ? e.prefix + '*' : '?'));
  }
  return out;
}

/* The label a banner prints for a tab: the desk's own pool name when it has
   one, and the shared stem when a desk pools under several. */
function hgAccuracyDeskLabel(names){
  if (!names || !names.length) return null;
  if (names.length === 1) return names[0];
  var stem = String(names[0]).split(':')[0];
  return stem + ' (' + names.length + ' pools)';
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* WILSON SCORE INTERVAL, lower bound.

   The normal approximation (p ± z·sqrt(p(1-p)/n)) has a half-width of ZERO at
   p = 0 or p = 1, so a flawless record would read as a certainty at any
   sample size — the exact failure this floor exists to prevent. Wilson does
   not degenerate there. */
function hgWilsonLower(wins, n, z){
  n = +n; wins = +wins;
  if (!isFinite(n) || n <= 0) return NaN;
  if (!isFinite(wins) || wins < 0) return NaN;
  z = isFinite(+z) ? +z : HG_ACCURACY_Z;
  var p = Math.min(1, wins / n);
  var z2 = z * z;
  var denom = 1 + z2 / n;
  var centre = (p + z2 / (2 * n)) / denom;
  var half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return Math.max(0, centre - half);
}

/* How many independent observations a FLAWLESS record needs before its lower
   bound clears the floor. Computed rather than quoted, so the banner cannot
   drift from the arithmetic it describes. */
function hgAccuracyMinObs(floor, z){
  floor = isFinite(+floor) ? +floor : HG_ACCURACY_FLOOR;
  for (var n = 1; n <= 10000; n++){
    if (hgWilsonLower(n, n, z) >= floor) return n;
  }
  return NaN;
}

/* HOW MUCH EVIDENCE A DESK AT THIS RATE WOULD NEED.

   null when the observed rate is at or under the floor: no sample size makes
   a 70% rule clear 80%, and returning a big number there would read as "keep
   waiting" when the honest answer is "the rate itself has to be higher". */
function hgAccuracyNeedObs(hit, floor, z){
  floor = isFinite(+floor) ? +floor : HG_ACCURACY_FLOOR;
  hit = +hit;
  if (!isFinite(hit) || hit <= floor) return null;
  for (var n = 1; n <= 100000; n++){
    if (hgWilsonLower(hit * n, n, z) >= floor) return n;
  }
  return null;
}

/* WHERE ONE DESK STANDS.

   Reads the desk's own settled records and corrects the sample for overlap
   exactly as the forward panels do. Returns state:

     'unwired'     the desk writes no records under this tab name
     'unmeasured'  records exist but nothing has settled
     'thin'        settled, but too few INDEPENDENT observations to judge
     'below'       judged, and the lower bound is under the floor
     'clears'      judged, and the lower bound is at or above it
*/
function hgAccuracyRead(tab, floor){
  floor = isFinite(+floor) ? +floor : HG_ACCURACY_FLOOR;
  var entry = HG_ACCURACY_TABS[String(tab || '')];
  var names = entry ? hgAccuracyPools(entry) : null;
  /* A family that resolves to nothing yet is still a real desk -- it has
     simply written no records. Fall back to the stem so the banner names it
     rather than calling an instrumented tab unwired. */
  var deskName = entry ? (hgAccuracyDeskLabel(names) || hgAccuracyStems(entry).join(' + ')) : null;
  var out = { tab: String(tab || ''), desk: deskName || null, pools: names || null, floor: floor,
              state: 'unwired', settled: 0, open: 0, wins: 0,
              hit: NaN, effN: NaN, lower: NaN, minObs: hgAccuracyMinObs(floor),
              needObs: null };
  if (!entry) return out;
  out.state = 'unmeasured';
  if (!names || !names.length) return out;
  try{
    if (typeof W.hgFwdPool !== 'function') return out;
    var ni, pool, keys, i, st;
    for (ni = 0; ni < names.length; ni++){
      pool = W.hgFwdPool(names[ni]) || {};
      keys = Object.keys(pool);
      for (i = 0; i < keys.length; i++){
        st = pool[keys[i]];
        if (!st) continue;
        out.wins += (st.wins || 0);
        out.settled += (st.samples || 0);
        out.open += (st.open || 0);
      }
    }
    if (!out.settled) return out;
    out.hit = out.wins / out.settled;
    out.needObs = hgAccuracyNeedObs(out.hit, floor);
    /* INDEPENDENCE ACROSS POOLS IS TAKEN AS THE LARGEST, NEVER THE SUM.
       A desk split by horizon trades the same instrument at the same time --
       NEWGOLD:1H and NEWGOLD:4H are both XAUUSD -- so adding their effN would
       count one market move twice and claim independence the desk has not
       got. The maximum understates the evidence when the pools really are
       disjoint, and understating it is the safe direction for a floor. */
    var ov = null;
    if (typeof W.hgFwdOverlap === 'function'){
      for (ni = 0; ni < names.length; ni++){
        var o1 = W.hgFwdOverlap(names[ni], null, {});
        if (o1 && isFinite(o1.effN) && (!ov || o1.effN > ov.effN)) ov = o1;
      }
    }
    /* No overlap reading means no INDEPENDENT count, and the raw count is not
       a substitute -- it is the thing overlap exists to correct. */
    if (!ov || !isFinite(ov.effN)){ out.state = 'thin'; return out; }
    out.effN = ov.effN;
    /* wins scaled to the independent sample: the ratio is what was observed,
       the count is how much of it was independent */
    var effWins = out.hit * out.effN;
    out.lower = hgWilsonLower(effWins, out.effN, HG_ACCURACY_Z);
    if (!isFinite(out.lower)){ out.state = 'thin'; return out; }
    out.state = out.lower >= floor ? 'clears' : 'below';
    /* a desk whose lower bound COULD NOT clear the floor even at a flawless
       record is not "below" on its merits -- it simply has not been given
       enough independent observations yet, and saying otherwise blames the
       rule for the sample */
    if (out.state === 'below' && out.effN < out.minObs) out.state = 'thin';
    return out;
  }catch(e){ return out; }
}

/** one sentence, in the words the state deserves */
function hgAccuracyText(r){
  if (!r || r.state === 'unwired') return '';
  var pctFloor = Math.round(r.floor * 100) + '%';
  if (r.state === 'unmeasured'){
    return 'NOT YET MEASURED against the ' + pctFloor + ' floor — nothing this desk has recorded '
      + 'has settled yet' + (r.open ? ' (' + r.open + ' still open)' : '')
      + '. A flawless record needs ' + r.minObs + ' independent observations before it can claim '
      + pctFloor + '.';
  }
  var hitTxt = Math.round(r.hit * 100) + '%';
  /* what it would take FROM HERE, at the rate actually observed */
  var need = (r.needObs === null)
    ? 'At ' + hitTxt + ', no sample size clears ' + pctFloor + ' — the rate itself has to be higher.'
    : 'At ' + hitTxt + ' it would take about ' + r.needObs + ' independent observations to clear '
      + pctFloor + (isFinite(r.effN) && r.effN > 0
          ? ', and it has ' + (r.effN >= 10 ? r.effN.toFixed(0) : r.effN.toFixed(1)) + '.' : '.');
  if (r.state === 'thin'){
    var effTxt = isFinite(r.effN)
      ? (r.effN >= 10 ? r.effN.toFixed(0) : r.effN.toFixed(1)) + ' independent observations'
      : 'no overlap reading yet';
    return 'TOO THIN TO JUDGE against the ' + pctFloor + ' floor — ' + r.settled + ' settled at '
      + hitTxt + ', which is ' + effTxt + ' after correcting for overlap. '
      + r.minObs + ' are needed even at a flawless record. ' + need;
  }
  var eff = r.effN >= 10 ? r.effN.toFixed(0) : r.effN.toFixed(1);
  var lower = Math.round(r.lower * 100) + '%';
  if (r.state === 'clears'){
    return 'CLEARS THE ' + pctFloor + ' FLOOR — ' + hitTxt + ' over ' + r.settled
      + ' settled (' + eff + ' independent), lower bound ' + lower + '.';
  }
  return 'BELOW THE ' + pctFloor + ' FLOOR — ' + hitTxt + ' over ' + r.settled
    + ' settled (' + eff + ' independent), lower bound ' + lower + '. '
    + 'The point estimate is not the claim; the lower bound is. ' + need;
}

var HG_ACCURACY_COLOURS = {
  clears:     { fg: '#166534', bg: '#DCFCE7', bd: '#86EFAC' },
  below:      { fg: '#991B1B', bg: '#FEE2E2', bd: '#FCA5A5' },
  thin:       { fg: '#92400E', bg: '#FFFBEB', bd: '#FDE68A' },
  unmeasured: { fg: '#475569', bg: '#F8FAFC', bd: '#E2E8F0' }
};

function hgAccuracyFloorHtml(tab){
  var r = hgAccuracyRead(tab);
  if (!r || r.state === 'unwired') return '';
  var txt = hgAccuracyText(r);
  if (!txt) return '';
  var c = HG_ACCURACY_COLOURS[r.state] || HG_ACCURACY_COLOURS.unmeasured;
  return '<div class="hg-acc-floor" style="font-size:10px;color:' + c.fg + ';background:' + c.bg
    + ';border:1px solid ' + c.bd + ';border-radius:6px;padding:7px 9px;margin:6px 0">'
    + '<b>ACCURACY FLOOR ' + Math.round(r.floor * 100) + '%</b> · ' + esc(r.desk) + ' — ' + esc(txt)
    + '</div>';
}

/* Paints into the tab pane, beside the nightly banner and by the same route:
   find the pane, find or make a host, set its HTML. Idempotent -- repainting
   a tab replaces the line rather than stacking another one. */
function hgAccuracyFloorPaint(tab){
  if (!tab || !W.document) return null;
  var id = String(tab);
  if (!HG_ACCURACY_TABS[id]) return null;
  var pane = W.document.getElementById('tab_' + id);
  if (!pane) return null;
  var hostId = id + 'AccFloor';
  var host = W.document.getElementById(hostId);
  if (!host){
    host = W.document.createElement('div');
    host.id = hostId;
    host.className = 'hg-acc-host';
    if (pane.firstChild) pane.insertBefore(host, pane.firstChild);
    else pane.appendChild(host);
  }
  host.innerHTML = hgAccuracyFloorHtml(id) || '';
  return host;
}

/* POOLS IN THE LOG THAT NO ROSTER ENTRY CLAIMS.

   The roster is checked against the sources at test time, but a STATIC check
   has one hole it cannot close: OMNIGOLD is listed by its two exact pools
   rather than by a prefix (because OMNIGOLD:P80 and OMNIGOLD:TAURIC are
   separate desks that merely share the stem), so a third OMNIGOLD: pool added
   tomorrow would record evidence that no tab is judged on and no test would
   notice. This closes that at RUN time, against the log itself: anything
   accumulating records under a name the roster does not claim is named here,
   rather than quietly going unjudged. */
function hgAccuracyUnclaimed(){
  if (typeof W.hgFwdTabs !== 'function') return [];
  /* A prefix entry needs no separate registration here: hgAccuracyPools
     resolves it from the SAME hgFwdTabs list this function walks, so every
     pool under a claimed prefix is already claimed by its exact name. A
     second prefix pass could never change the answer. */
  var claimed = {}, id, pools, p, i;
  for (id in HG_ACCURACY_TABS) if (Object.prototype.hasOwnProperty.call(HG_ACCURACY_TABS, id)){
    pools = hgAccuracyPools(HG_ACCURACY_TABS[id]);
    for (p = 0; p < pools.length; p++) claimed[pools[p]] = true;
  }
  var all = W.hgFwdTabs() || [], out = [];
  for (i = 0; i < all.length; i++) if (!claimed[all[i]]) out.push(all[i]);
  return out;
}

/* THE WHOLE BOARD AT ONCE, so "every gold and crypto tab" is a thing you can
   look at rather than a claim you have to take on faith. */
function hgAccuracyRoster(floor){
  var out = [], id;
  for (id in HG_ACCURACY_TABS) if (Object.prototype.hasOwnProperty.call(HG_ACCURACY_TABS, id)){
    out.push(hgAccuracyRead(id, floor));
  }
  var rank = { clears: 0, below: 1, thin: 2, unmeasured: 3, unwired: 4 };
  out.sort(function(a, b){
    if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
    return String(a.desk).localeCompare(String(b.desk));
  });
  return out;
}

function hgAccuracyRosterHtml(floor){
  var rows = hgAccuracyRoster(floor);
  if (!rows.length) return '';
  var f = Math.round((isFinite(+floor) ? +floor : HG_ACCURACY_FLOOR) * 100);
  var h = '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:#334155;margin:8px 0 4px">'
    + 'ACCURACY FLOOR ' + f + '% — EVERY INSTRUMENTED GOLD AND CRYPTO DESK</div>'
    + '<table class="cs-vtbl" style="width:100%;border-collapse:collapse;font-size:10px">'
    + '<tr><th style="text-align:left">desk</th><th>settled</th><th>independent</th>'
    + '<th>hit</th><th>lower bound</th><th>vs floor</th></tr>';
  for (var i = 0; i < rows.length; i++){
    var r = rows[i], c = HG_ACCURACY_COLOURS[r.state] || HG_ACCURACY_COLOURS.unmeasured;
    var word = r.state === 'clears' ? 'CLEARS' : r.state === 'below' ? 'BELOW'
             : r.state === 'thin' ? 'too thin' : 'not measured';
    h += '<tr><td>' + esc(r.desk) + '</td>'
      + '<td>' + (r.settled || 0) + '</td>'
      + '<td>' + (isFinite(r.effN) ? (r.effN >= 10 ? r.effN.toFixed(0) : r.effN.toFixed(1)) : '—') + '</td>'
      + '<td>' + (isFinite(r.hit) ? Math.round(r.hit * 100) + '%' : '—') + '</td>'
      + '<td>' + (isFinite(r.lower) ? Math.round(r.lower * 100) + '%' : '—') + '</td>'
      + '<td style="color:' + c.fg + ';font-weight:700">' + word + '</td></tr>';
  }
  h += '</table><div style="font-size:9px;color:#94A3B8;margin-top:4px">'
    + 'Judged on the Wilson 95% lower bound over INDEPENDENT observations (effN), never on the '
    + 'point estimate: a flawless record needs ' + hgAccuracyMinObs() + ' of them to claim '
    + f + '%.</div>';
  /* anything writing records under a name no tab is judged on */
  var un = hgAccuracyUnclaimed();
  if (un.length){
    h += '<div style="font-size:9px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;'
      + 'border-radius:5px;padding:5px 7px;margin-top:4px">UNCLAIMED — '
      + un.length + ' pool' + (un.length === 1 ? '' : 's') + ' accumulating records that no tab '
      + 'on this board is judged on: ' + esc(un.join(', ')) + '</div>';
  }
  return h;
}

W.HG_ACCURACY_FLOOR = HG_ACCURACY_FLOOR;
W.HG_ACCURACY_TABS = HG_ACCURACY_TABS;
W.hgWilsonLower = W.hgWilsonLower || hgWilsonLower;
W.hgAccuracyMinObs = hgAccuracyMinObs;
W.hgAccuracyNeedObs = hgAccuracyNeedObs;
W.hgAccuracyRead = hgAccuracyRead;
W.hgAccuracyText = hgAccuracyText;
W.hgAccuracyFloorHtml = hgAccuracyFloorHtml;
W.hgAccuracyFloorPaint = hgAccuracyFloorPaint;
W.hgAccuracyRoster = hgAccuracyRoster;
W.hgAccuracyUnclaimed = hgAccuracyUnclaimed;
W.hgAccuracyRosterHtml = hgAccuracyRosterHtml;

})();
