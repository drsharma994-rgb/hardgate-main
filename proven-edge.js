/* =========================================================================
HARDGATE — proven-edge.js
THE PROVEN-EDGE GATE: a card's action buttons are earned by a measured,
settled, out-of-sample record — not asserted by the scan that printed it.

WHY THIS EXISTS. The owner asked for "100 percent profitable setups only".
That setup does not exist, and a gate that claimed it would be lying on the
card. What CAN honestly be built is the strongest readable form of the ask:

  A strategy's SEND TO TRADE PLAN and ADD TO BOOK buttons appear only when
  that strategy's OWN forward record — recorded by this app, settled by bars
  that had not printed when the setups were written — has cleared the desk's
  evidence floor with POSITIVE expectancy.

Everything below the floor, and everything at or under zero expectancy,
keeps its card and loses its buttons. The card still prints, still shows its
levels, still names its evidence state on a chip, and — the load-bearing
part — IS STILL RECORDED. A gate that stopped recording what it demoted
could never change its mind: the only population that could clear the gate
would be the one the gate had already passed. Recording stays ungated so the
verdict can move in BOTH directions — a losing strategy that turns profitable
gets its buttons back, a proven one that stops paying loses them.

WHAT IT READS. cardHTML (index.html) already records every tradeable card
into the forward ledger as pool 'CARD:<scanner>', mechanic '<STRATEGY>' —
the tightest honest attribution: this strategy's cards, on this tab, and
nothing else's. The verdict is judged by the ledger's own hgFwdJudgeSample,
which prefers the fill-aware tally once that population clears the floor on
its own (a resting order the tape never reached is not a win or a loss, it
is nothing). The floor is the desk's own: hgDeskParam(tab, 'minEvidence'),
the same data/desk-tab-params.json rows the R:R floors already read — 20
where the desk has no measured row, which is the house FWD_MIN_JUDGE. No
threshold is invented or moved here; this file reads the owner's numbers.

THE THREE STATES, all printed on the card:

  EDGE PROVEN    n >= floor and expectancy > 0 — buttons live.
  EDGE LOSING    n >= floor and expectancy <= 0 — WATCH ONLY. The record
                 says this strategy does not pay; the card argues otherwise
                 and loses.
  EDGE UNPROVEN  fewer than floor settled — WATCH ONLY. "We do not know
                 yet" is not a pass; the ask was proven only, and a fresh
                 ledger is precisely the condition the ask is about.

THE MODE. Default ON — that was the explicit ask. localStorage
hg_proven_edge_v1 = '0' opts out (header drawer toggle), which restores the
pre-gate behaviour exactly: the chip stays on the card either way, because
the evidence is true in both modes. OFF never hides the record; it only
stops the record from gating the buttons.

THE BOUNDARY, STATED. This gate covers the tabs that render through
cardHTML: SWING, SCALP, COIL, COIL-EXPANSION, DIVERGENCE, APEX, LIQ-TRAP,
SMC, ORDER BLOCKS, BASIS. The SMART and MOST PROBABLE renderers are bespoke
templates outside that choke point; the smart tab does not record forward
evidence at all today, so there is no pool to judge it by — gating it
without its own ledger would be the deadlock this design exists to avoid.
What this file never touches: the gold desks (their own measured-edge path
predates it), the scan logic (a blocked card is still detected, printed and
recorded), and any threshold.

Classic script, IIFE, feature-checked by every caller, never throws.
========================================================================= */
'use strict';

(function(){

  var W = (typeof window !== 'undefined') ? window : globalThis;
  var LS_MODE = 'hg_proven_edge_v1';

  /* The house settled-sample floor — omnigold.js FWD_MIN_JUDGE, the number
     a desk falls back to when data/desk-tab-params.json carries no measured
     minEvidence row for it. Read, never redefined: hgDeskParam(tab,
     'minEvidence', THIS) is the only path a floor arrives by. */
  var FLOOR_DEFAULT = 20;

  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  function esc(x){
    return String(x == null ? '' : x)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ==================== mode ==================== */

  /* ON unless explicitly opted out. The try matters: localStorage can throw
     in private mode, and the gate's answer to an unreadable preference is
     the default the owner asked for, not a crash. */
  function hgProvenEdgeMode(){
    try{
      if (typeof localStorage !== 'undefined' && localStorage.getItem(LS_MODE) === '0') return false;
    }catch(e){}
    return true;
  }

  /* ==================== the floor ==================== */

  /* The desk-params row a tab addresses itself by is not always its scanner
     id: the LIQUIDITY TRAP leg reads its R:R floor as hgTabMinRr('trap')
     while its cards record under scanner 'liq-trap', and COIL-EXPANSION is
     the coil desk's second detector. Same convention here, so the evidence
     floor and the R:R floor come out of the SAME row — two gates reading
     two rows for one desk would be a calibration nobody configured. */
  var TAB_ALIAS = { 'liq-trap': 'trap', 'coil-expansion': 'coil' };

  function hgProvenEdgeFloor(scanId){
    var tab = String(scanId || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TAB_ALIAS, tab)) tab = TAB_ALIAS[tab];
    try{
      if (typeof W.hgDeskParam === 'function'){
        var v = fin(W.hgDeskParam(tab, 'minEvidence', FLOOR_DEFAULT));
        if (isFinite(v) && v >= 1) return Math.floor(v);
      }
    }catch(e){}
    return FLOOR_DEFAULT;
  }

  /* ==================== the verdict ==================== */

  /* Judge one (pool, mechanic) pair on its SETTLED forward record.

       { state:'proven',  n, hit, expR, fillAware, floor }   — expR > 0
       { state:'losing',  n, hit, expR, fillAware, floor }   — expR <= 0
       { state:'unproven', n(<floor), floor, note }          — not enough
         settled yet, the ledger unreadable, or the log absent

     opts.pool / opts.mechanic override the default 'CARD:<scanId>' /
     '<STRATID>' attribution — the MOST PROBABLE tab's cards are the swing
     cascade's CLEAN cohort, whose evidence lives in the BEST:swing pool the
     scan snap publisher writes, under the mechanic SWING-CLEAN. The floor
     still comes from scanId: the desk the card trades as, not the pool the
     evidence happens to live in.

     Never throws; the worst answer it can give is 'unproven', which is the
     safe one: a verdict that cannot be read blocks nothing but buttons. */
  function hgProvenEdgeVerdict(scanId, stratId, opts){
    var out = { state: 'unproven', n: 0, floor: FLOOR_DEFAULT, hit: NaN, expR: NaN, fillAware: false, note: '' };
    try{
      if (!scanId){ out.note = 'no scanner id'; return out; }
      out.floor = hgProvenEdgeFloor(scanId);
      if (typeof W.hgFwdStats !== 'function' || typeof W.hgFwdJudgeSample !== 'function'){
        out.note = 'forward log not loaded';
        return out;
      }
      var pool = (opts && typeof opts.pool === 'string' && opts.pool) ? opts.pool : ('CARD:' + scanId);
      var mech = (opts && typeof opts.mechanic === 'string' && opts.mechanic)
        ? opts.mechanic : String(stratId || scanId).toUpperCase();
      out.pool = pool; out.mechanic = mech;
      var stats = W.hgFwdStats(pool, mech, false);
      var j = W.hgFwdJudgeSample(stats, out.floor);
      if (!isFinite(fin(j && j.n))){
        /* Below the floor. Report progress against it: the larger of the two
           populations the judge is willing to read (the settled tally, and
           the fill-aware one it prefers once IT clears the floor). Neither
           is at the floor in this branch, so neither is the verdict — the
           number is a progress read, nothing more. */
        var settled = fin(stats && stats.samples), fsettled = fin(stats && stats.fillSamples);
        out.n = Math.max(isFinite(settled) ? settled : 0, isFinite(fsettled) ? fsettled : 0);
        out.note = out.n + '/' + out.floor + ' settled';
        return out;
      }
      out.n = j.n;
      out.hit = fin(j.hit);
      out.expR = fin(j.expR);
      out.fillAware = j.fillAware === true;
      if (!isFinite(out.expR)){
        /* n cleared the floor but the expectancy did not compute. That is
           not a pass and it is not a loss: it is a record this gate cannot
           honestly read, and the safe word for that is unproven. */
        out.state = 'unproven';
        out.note = 'expectancy unreadable at n=' + out.n;
        return out;
      }
      out.state = out.expR > 0 ? 'proven' : 'losing';
      return out;
    }catch(e){
      out.state = 'unproven';
      out.note = 'read error — gated safely';
      return out;
    }
  }

  /* Does this verdict block the action buttons? Only when the mode is ON,
     and only 'proven' passes. Mode OFF blocks NOTHING — the chip still
     prints, because the record is still true. */
  function hgProvenEdgeBlocks(v){
    if (!hgProvenEdgeMode()) return false;
    return !v || v.state !== 'proven';
  }

  /* ==================== the display ==================== */

  function fmtSignedR(x){
    var n = fin(x);
    if (!isFinite(n)) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(2);
  }

  /* One .gpip chip — the established honest-display pattern, same classes
     the gate pips already use: ok when the record pays, bad when it loses,
     neutral when it has not earned a verdict yet. The title carries the
     whole rule so the chip itself never has to. */
  function hgProvenEdgeChipHtml(v){
    if (!v) return '';
    var title = 'forward evidence gate: the settled out-of-sample record of this strategy on this tab, '
      + 'judged by the forward ledger at the desk evidence floor (n>=' + v.floor + '). '
      + 'Buttons appear only on a PROVEN record while PROVEN EDGE is ON.';
    var cls, txt;
    if (v.state === 'proven'){
      cls = ' ok';
      txt = 'EDGE PROVEN · n=' + v.n + ' · expR ' + fmtSignedR(v.expR) + 'R' + (v.fillAware ? ' · fills' : '');
    } else if (v.state === 'losing'){
      cls = ' bad';
      txt = 'EDGE LOSING · n=' + v.n + ' · expR ' + fmtSignedR(v.expR) + 'R' + (v.fillAware ? ' · fills' : '');
    } else {
      cls = '';
      txt = 'EDGE UNPROVEN · ' + (v.note || (v.n + '/' + v.floor + ' settled'));
    }
    return '<span class="gpip' + cls + '" title="' + esc(title) + '">' + esc(txt) + '</span>';
  }

  /* What prints where the buttons would have been. Says what the state is,
     what would change it, and that the card is still being recorded — the
     last clause is the anti-deadlock invariant, stated where the reader can
     see it. */
  function hgProvenEdgeBlockedNoteHtml(v){
    if (!v) return '';
    var msg;
    if (v.state === 'losing'){
      msg = 'WATCH ONLY — the settled forward record for this strategy on this tab does not pay '
        + '(n=' + v.n + ', expR ' + fmtSignedR(v.expR) + 'R). '
        + 'This card is still recorded; the buttons return if the record turns profitable.';
    } else {
      msg = 'WATCH ONLY — no proven forward record for this strategy on this tab yet '
        + '(' + esc(v.note || (v.n + '/' + v.floor + ' settled')) + '). '
        + 'This card is still recorded; the buttons appear when the settled record earns them.';
    }
    return '<div class="note warn" style="margin-top:6px;font-size:11px"><b>PROVEN EDGE</b> · ' + msg + '</div>';
  }

  /* ==================== state-flip alerts ==================== */

  /* THE MOMENT THE MACHINERY PRODUCES SOMETHING ACTIONABLE is not a card
     printing — it is a strategy's verdict CHANGING: a record that earned
     its buttons (into PROVEN) or an edge that just died (into LOSING). Both
     are worth a push; a pool slipping back under the floor (UNPROVEN) is
     just evidence thinning and is recorded but never pushed.

     THE RULES, same conventions as the alert bell:
       FIRST SIGHTING SEEDS SILENTLY. A browser that loads this pack onto an
     established ledger must not fire twenty pushes for transitions that
     happened before it could see them. Only a CHANGE OBSERVED BY THIS
     BROWSER alerts.
       ONE PUSH PER KEY PER HOUR at most. A pool oscillating around zero
     expectancy still needs new settled trades to flip, but the cap is cheap
     insurance.
       THE MODE DOES NOT GATE THE ALERT. The record is still true when the
     gate is opted out; the push is information, and information was never
     the thing being gated.

     State lives in localStorage under hg_proven_edge_states_v1, capped —
     the app's existing convention; losing it costs a re-seed, not
     correctness. */
  var LS_STATES = 'hg_proven_edge_states_v1';
  var STATES_MAX = 200;
  var FLIP_ALERT_MIN_MS = 60 * 60 * 1000;

  function readStates(){
    try{
      if (typeof localStorage === 'undefined') return {};
      var j = JSON.parse(localStorage.getItem(LS_STATES) || '{}');
      return (j && typeof j === 'object' && !Array.isArray(j)) ? j : {};
    }catch(e){ return {}; }
  }
  function writeStates(m){
    try{
      if (typeof localStorage === 'undefined') return;
      var keys = Object.keys(m);
      if (keys.length > STATES_MAX){
        keys.sort(function(a, b){ return (m[a].at || 0) - (m[b].at || 0); });
        for (var i = 0; i < keys.length - STATES_MAX; i++) delete m[keys[i]];
      }
      localStorage.setItem(LS_STATES, JSON.stringify(m));
    }catch(e){}
  }

  /* Record the verdict for one (pool, mechanic) and, when it CHANGED into a
     state worth knowing about, push it — Telegram first, ntfy second, the
     established cascade. Returns the transition {from, to} or null. Never
     throws, never blocks a render. */
  function hgProvenEdgeTrack(scanId, stratId, v, opts){
    try{
      if (!v || !v.state || !scanId) return null;
      var pool = (opts && opts.pool) || v.pool || ('CARD:' + scanId);
      var mech = (opts && opts.mechanic) || v.mechanic || String(stratId || scanId).toUpperCase();
      var key = pool + '|' + mech;
      var states = readStates();
      var prev = states[key];
      var now = Date.now();
      states[key] = { state: v.state, at: now, alertAt: (prev && prev.alertAt) || 0 };
      /* first sighting seeds silently — a state we never saw before is not
         a change, it is the baseline */
      if (!prev){ writeStates(states); return null; }
      var from = prev.state, to = v.state;
      if (from === to){ writeStates(states); return null; }
      var trans = { from: from, to: to };
      var worthPush = (to === 'proven' || to === 'losing');
      var throttled = (now - (states[key].alertAt || 0)) < FLIP_ALERT_MIN_MS;
      if (worthPush && !throttled){
        states[key].alertAt = now;
        var tabName = String(scanId).toUpperCase();
        var title = 'HARDGATE · ' + tabName + ' ' + mech + ' — EDGE ' + to.toUpperCase();
        var body = (to === 'proven')
          ? ('the settled forward record just earned its buttons: n=' + v.n + ', expR ' + fmtSignedR(v.expR) + 'R on ' + tabName + '.')
          : ('the settled forward record stopped paying: n=' + v.n + ', expR ' + fmtSignedR(v.expR) + 'R on ' + tabName + ' — buttons withdrawn, cards still print and record.');
        try{ if (typeof W.sendTelegram === 'function') W.sendTelegram(title, body); }catch(eT){}
        try{ if (typeof W.sendAlertPush === 'function') W.sendAlertPush(title, body, { priority: 4 }); }catch(eP){}
      }
      writeStates(states);
      return trans;
    }catch(e){ return null; }
  }

  /* ==================== the toggle ==================== */

  function hgProvenEdgePaint(){
    try{
      var el = (typeof document !== 'undefined') && document.getElementById
        ? document.getElementById('provenEdgeState') : null;
      if (el) el.textContent = hgProvenEdgeMode() ? 'ON' : 'OFF';
      var chip = (typeof document !== 'undefined') && document.getElementById
        ? document.getElementById('chipProvenEdge') : null;
      if (chip){
        chip.title = hgProvenEdgeMode()
          ? 'PROVEN EDGE is ON — a card shows SEND TO TRADE PLAN / ADD TO BOOK only when the strategy has a settled, profitable forward record on that tab at the desk evidence floor. Click to opt out (applies from the next scan; the evidence chip stays either way).'
          : 'PROVEN EDGE is OFF — buttons print without the forward-evidence gate, exactly as before. The evidence chip still prints, because the record is still true. Click to re-enable.';
      }
    }catch(e){}
  }

  function hgProvenEdgeToggle(){
    var on = !hgProvenEdgeMode();
    try{ if (typeof localStorage !== 'undefined') localStorage.setItem(LS_MODE, on ? '1' : '0'); }catch(e){}
    hgProvenEdgePaint();
    return on;
  }

  /* ==================== exports ==================== */

  W.hgProvenEdgeMode = hgProvenEdgeMode;
  W.hgProvenEdgeFloor = hgProvenEdgeFloor;
  W.hgProvenEdgeVerdict = hgProvenEdgeVerdict;
  W.hgProvenEdgeTrack = hgProvenEdgeTrack;
  W.hgProvenEdgeBlocks = hgProvenEdgeBlocks;
  W.hgProvenEdgeChipHtml = hgProvenEdgeChipHtml;
  W.hgProvenEdgeBlockedNoteHtml = hgProvenEdgeBlockedNoteHtml;
  W.hgProvenEdgeToggle = hgProvenEdgeToggle;
  W.hgProvenEdgePaint = hgProvenEdgePaint;

  /* Paint the drawer chip once the DOM exists — the same init pattern as
     build-stamp.js, and equally cheap: a feature check and a text set. */
  try{
    if (W.document){
      if (W.document.readyState === 'loading'){
        W.document.addEventListener('DOMContentLoaded', hgProvenEdgePaint);
      } else {
        hgProvenEdgePaint();
      }
    }
  }catch(e){}

})();
