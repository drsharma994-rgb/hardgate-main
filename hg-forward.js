/* =========================================================================
HARDGATE — hg-forward.js
FORWARD LOG — out-of-sample evidence, accumulated across scans.

WHY THIS EXISTS. Every measurement in the app today is IN-SAMPLE: a tab
replays the same rolling window of candles it just fetched and reports how a
mechanic would have done. Re-scanning tomorrow slides the window and
reshuffles noise; it does not add evidence. OMNIGOLD made the problem
concrete — MMOVE needs ~157 non-overlapping trades to settle at 2 sigma,
fires ~1.1/day, and the window only holds 63 days, so the in-sample number
can never converge no matter how often you press RUN.

This module fixes the shape of the problem rather than the number. When a
tab emits a setup it RECORDS it here, once, keyed to the bar it fired on.
Later scans hand back fresh candles and any record whose outcome is now
knowable gets resolved — T1 before stop, or stop first, or still open.
What accumulates is genuine forward evidence: each trade recorded before its
outcome existed, resolved by bars that had not printed when it was written.

THE RULES IT KEEPS, so a forward number cannot flatter itself:

  ONE RECORD PER FIRING. Keyed by tab + mechanic + symbol + direction + the
  BAR TIMESTAMP it fired on. Re-scanning the same bar cannot record it twice,
  which is what would otherwise turn one setup into a hundred "samples"
  simply by pressing RUN repeatedly.

  NEVER RESOLVE ON THE FIRING BAR. A record is only settled by bars strictly
  after the one it was written on, so a setup can never be resolved by data
  that already existed when it was recorded.

  A BAR SPANNING BOTH COUNTS AS A STOP. Identical to the in-sample walk-
  forward: candles cannot say which printed first, and the optimistic reading
  is how backtests flatter themselves.

  EXPIRY IS NOT A WIN. A record that never reaches either level inside its
  horizon settles as 'expired' and is excluded from the hit rate entirely,
  exactly as an unresolved in-sample trade is.

STORAGE. localStorage under a single key, capped and pruned oldest-first —
the app's existing convention (signallog caps at 500). Nothing here is
authoritative: losing it costs accumulated evidence, not correctness.

Classic script, IIFE. Pure functions are exported for tests and take state
as an argument; the window-level wrappers are the only thing that touches
localStorage. Never throws.
========================================================================= */
'use strict';

(function(){

  var LS_KEY = 'hg_forward_v1';
  var MAX_RECORDS = 4000;     /* ~1 year of a busy tab; pruned oldest-first */
  /* Bar-open seconds per timeframe. Module scope, because both the recorder
     (deriving the bar a scan fired on) and the staleness check (deriving when
     a record's horizon has demonstrably passed) need it. */
  var TF_SEC = { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '1d':86400 };
  /* How far past its own horizon an OPEN record must be before we stop
     calling it live. Settlement needs BARS for that symbol to arrive; if a
     contract is delisted, renamed, or simply drops out of the universe, the
     bars never come and the record stays open for ever. Three horizons is
     well beyond any normal settle: a 4h/20-bar record is stale after ten
     days, a 1h/24-bar one after three. */
  var STALE_HORIZONS = 3;

  /* Module scope on purpose: this file is 'use strict', so a function declared
     inside the `if (typeof window …)` block does NOT escape it — the health
     renderer sits outside that block and could not see it there. */
  /* See omniroute: a required sample size in the tens of thousands is not a
     target, it is the statement that the edge is indistinguishable from
     zero. */
  function hgFwdNeedText(need){
    if (!need || !isFinite(need)) return '';
    if (need > 5000) return ' <span class="dim">(edge too small to confirm at any realistic sample size)</span>';
    return ' <span class="dim">(needs ~' + need + ')</span>';
  }

  function esc(x){
    return String(x == null ? '' : x)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function num(v){ var n = +v; return isFinite(n) ? n : NaN; }
  /* null/undefined/'' -> NaN. isFinite(null) is TRUE in JS. */
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }

  /* ==================== pure core ==================== */

  /* Identity of a firing. The bar timestamp is what makes re-scanning safe:
     the same setup on the same bar is the same trade however many times the
     user presses RUN. */
  function hgFwdKey(rec){
    if (!rec) return '';
    return [rec.tab, rec.mechanic, rec.sym, rec.dir, rec.barT].join('|');
  }

  /* Validate and normalise a candidate record. Returns null when the setup
     cannot be resolved later — a record we could never settle is worse than
     no record, because it would sit in the log looking like pending evidence. */
  function hgFwdNormalize(rec){
    if (!rec || typeof rec !== 'object') return null;
    var entry = fin(rec.entry), stop = fin(rec.stop), t1 = fin(rec.t1), barT = fin(rec.barT);
    if (!isFinite(entry) || !isFinite(stop) || !isFinite(t1) || !isFinite(barT)) return null;
    if (!rec.tab || !rec.mechanic || !rec.sym) return null;
    var dir = (rec.dir === 'long' || rec.dir === 'short') ? rec.dir : null;
    if (!dir) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    /* target must sit on the correct side of entry, or the record is unsettleable */
    if (dir === 'long' ? !(t1 > entry) : !(t1 < entry)) return null;
    return {
      tab: String(rec.tab), mechanic: String(rec.mechanic), sym: String(rec.sym),
      tf: String(rec.tf || ''), dir: dir,
      entry: entry, stop: stop, t1: t1, risk: risk,
      rr: Math.abs(t1 - entry) / risk,
      barT: barT,
      horizonBars: isFinite(fin(rec.horizonBars)) ? fin(rec.horizonBars) : 20,
      /* Whether the gate ledger passed this setup at the time it fired. Not
         used by the stats yet, but recording it now means we can later ask
         the question that actually matters about the gates: do TICKETS
         resolve better than the setups the ledger stood aside? If they do
         not, the ledger is decoration. It cannot be reconstructed after the
         fact, so it has to be written at record time. */
      ticket: rec.ticket === true,
      /* THE SETUP'S OWN GRADE AT FIRING TIME (A/B/C/D), so the chips can be
         judged out-of-sample. The grade is a CONFLUENCE tally — A is "eight or
         more reads agree" — and confluence has never been shown to predict
         outcome on gold. It plausibly does the opposite: eleven gates measured
         BACKWARDS on the scalp horizon, and every one of them passes when the
         tape is active, which is when a gold move is already spent. An A chip
         that is really a C is worse than no chip.
         It cannot be reconstructed later, so it is written at record time and
         costs one string. */
      grade: (function(g){
        var t = String(g || '').toUpperCase().trim();
        if (t === 'CLEAN') return 'A';
        return (t === 'A' || t === 'B' || t === 'C' || t === 'D') ? t : '';
      })(rec.grade),
      /* HOW MANY OF THE THREE REPLICATED GATES AGREED (0-3, -1 = unknown).
         regime-fit, htf-confirm and hurst-regime are the only gates that
         earned their keep on BOTH horizons in the gate audit. Stacked on top
         of the tape, in-sample on 1,000 PAXG bars:

           SWING @2R   tape alone 31.9%  ->  all three agree 45.0% (n=602)
                       +0.350R, z +5.80 over the tape
           SCALP @2R   tape alone 36.0%  ->  all three agree 38.2% (n=930)
                       z +1.14 — not significant

         That is the strongest result of the whole audit and it is IN-SAMPLE
         on one instrument, which is exactly the evidence this repo refuses to
         trade on. Recording it per firing is how it earns an out-of-sample
         answer instead. */
      stack3: (function(v){
        var n = +v;
        return (isFinite(n) && n >= 0 && n <= 3) ? Math.floor(n) : -1;
      })(rec.stack3),
      state: 'open', r: null, settledT: null,
      at: isFinite(fin(rec.at)) ? fin(rec.at) : barT
    };
  }

  /* Add a record unless this firing is already logged. Pure: takes and
     returns the list. */
  function hgFwdAdd(list, rec){
    var recs = Array.isArray(list) ? list : [];
    var norm = hgFwdNormalize(rec);
    if (!norm) return { list: recs, added: false, reason: 'unsettleable or malformed' };
    var key = hgFwdKey(norm), i;
    for (i = 0; i < recs.length; i++){
      if (hgFwdKey(recs[i]) === key) return { list: recs, added: false, reason: 'already recorded' };
    }
    var out = recs.concat([norm]);
    /* Prune oldest-first — but FOLD the dropped records' outcomes into the
       aggregate first, so pruning costs detail and never evidence. */
    var folded = null;
    if (out.length > MAX_RECORDS){
      out.sort(function(a, b){ return num(a.barT) - num(b.barT); });
      var dropped = out.slice(0, out.length - MAX_RECORDS);
      out = out.slice(out.length - MAX_RECORDS);
      folded = dropped;
    }
    return { list: out, added: true, reason: 'recorded', folded: folded };
  }

  /* An open record whose bars were never going to arrive.

     NOT a settlement: we do not know the outcome and must never guess one.
     It is reported apart from 'open' because the two mean different things to
     a reader — "still running" and "recorded, then the contract went quiet"
     are not the same evidence, and lumping them together overstates how much
     is still in flight. A live desk showed ~1,200 open records with no way to
     tell which were which. Pure. */
  function hgFwdIsStale(rec, nowSec){
    if (!rec || rec.state !== 'open') return false;
    var bar = num(rec.barT);
    var hz = num(rec.horizonBars);
    if (!isFinite(bar) || !isFinite(hz) || hz <= 0) return false;
    var sec = TF_SEC[rec.tf] || 14400;
    var now = isFinite(num(nowSec)) ? num(nowSec) : Math.floor(Date.now() / 1000);
    return (now - bar) > (hz * sec * STALE_HORIZONS);
  }

  /* Settle one open record against candles. Only bars STRICTLY AFTER the
     firing bar are considered, so a record can never be resolved by data
     that already existed when it was written. Pure.

     SHADOW: BANK HALF AT +1R. Alongside the actual outcome, the same walk
     resolves what "bank half at +1R, stop the rest to breakeven" would have
     done. Why this is measured and not just proposed: on 1,000 PAXG bars per
     horizon, 48% of stopped gold scalps had FIRST reached +1R — a partial
     would have banked them — but that is in-sample, and this repo's standard
     is that strategy changes need out-of-sample evidence. This shadow is how
     that evidence accumulates: every record now carries both outcomes, and in
     a few weeks the forward panel can say which policy actually paid, on
     trades that had not happened when the policy was written down.

     The shadow can only ever settle EARLIER than the actual (its stop
     tightens to breakeven after +1R), so freezing it inside the actual's walk
     is sound: by the time the actual terminates, the shadow already has.
     Ambiguity is resolved against the shadow at every step — a bar touching
     both +1R and the stop is a STOP (candles cannot order intra-bar prints,
     same convention as the actual), and a post-bank bar touching both
     breakeven and T1 banks only the half (+0.5), never the full ride. The
     comparison must not be able to flatter the policy it exists to judge.

       oneR   whether +1R traded before the stop (null while unknowable)
       bankR  the shadow outcome in R; null when the actual expired unsettled
              or T1 sits inside +1R (no banking opportunity — policies equal) */
  function hgFwdSettleOne(rec, rows){
    if (!rec || rec.state !== 'open') return rec;
    if (!rows || !rows.length) return rec;
    var i, t, h, l, seen = 0;
    var hitStop, hitT1;
    var long = (rec.dir === 'long');
    var oneLvl = long ? (rec.entry + rec.risk) : (rec.entry - rec.risk);
    var banked = false, shadowR = null;         /* null = not yet resolved */
    var noBank = (rec.rr <= 1);                 /* T1 at/inside +1R: identical policies */
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t <= rec.barT) continue;      /* strictly after */
      seen++;
      h = num(rows[i].h); l = num(rows[i].l);
      if (!isFinite(h) || !isFinite(l)) continue;
      hitStop = long ? (l <= rec.stop) : (h >= rec.stop);
      hitT1   = long ? (h >= rec.t1)   : (l <= rec.t1);
      /* ---- shadow first, so its state is final before any actual return ---- */
      if (!noBank && shadowR === null){
        if (!banked){
          if (hitStop) shadowR = -1;                          /* stop before +1R */
          else if (long ? (h >= oneLvl) : (l <= oneLvl)){
            banked = true;                                    /* half off at +1R */
            if (hitT1) shadowR = 0.5 + 0.5 * rec.rr;          /* same bar ran on */
            else if (long ? (l <= rec.entry) : (h >= rec.entry)) shadowR = 0.5;  /* conservative: breakeven first */
          }
        } else {
          if (long ? (l <= rec.entry) : (h >= rec.entry)) shadowR = 0.5;         /* breakeven checked first */
          else if (hitT1) shadowR = 0.5 + 0.5 * rec.rr;
        }
      }
      /* ---- actual, unchanged ---- */
      /* both in one bar -> STOP. Candles cannot say which printed first. */
      if (hitStop) return copyWith(rec, { state:'stop', r: -1, settledT: t,
        oneR: banked, bankR: noBank ? -1 : (shadowR !== null ? shadowR : (banked ? 0.5 : -1)) });
      if (hitT1)   return copyWith(rec, { state:'t1',   r: rec.rr, settledT: t,
        oneR: true, bankR: noBank ? rec.rr : (shadowR !== null ? shadowR : 0.5 + 0.5 * rec.rr) });
      if (seen >= rec.horizonBars) return copyWith(rec, { state:'expired', r: null, settledT: t,
        oneR: banked, bankR: null });
    }
    return rec;
  }

  function copyWith(rec, patch){
    var out = {}, k;
    for (k in rec) if (Object.prototype.hasOwnProperty.call(rec, k)) out[k] = rec[k];
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
    return out;
  }

  /* Settle every open record for one symbol+timeframe. Pure. */
  function hgFwdSettle(list, sym, tf, rows){
    var recs = Array.isArray(list) ? list : [];
    var out = [], changed = 0, i, r;
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (r.state === 'open' && r.sym === sym && (!tf || !r.tf || r.tf === tf)){
        var s = hgFwdSettleOne(r, rows);
        if (s !== r) changed++;
        out.push(s);
      } else out.push(r);
    }
    return { list: out, changed: changed };
  }

  /* Pool settled records into a stat block per mechanic. Mirrors the
     in-sample shape exactly (samples/wins/losses/open/hit/expR) so the same
     verdict helper reads both. 'expired' is excluded from the hit rate — it
     is not a win. Pure. */
  function hgFwdStats(list, tab, mechanic, ticketOnly, agg, nowSec){
    var recs = Array.isArray(list) ? list : [];
    var wins = 0, losses = 0, open = 0, expired = 0, rrSum = 0, stale = 0, i, r;
    /* MATCHED PAIRS for the bank-half-at-1R shadow: only records carrying a
       finite bankR contribute, and each contributes BOTH its actual and its
       shadow R — comparing the shadow against a different population than the
       actual would be the fill-modelling mistake all over again. */
    var bankN = 0, bankSum = 0, bankActualSum = 0;
    /* Settled outcomes split by the grade the setup carried WHEN IT FIRED, so
       the A/B/C chips can be judged rather than trusted. */
    var byGrade = { A:{n:0,w:0}, B:{n:0,w:0}, C:{n:0,w:0}, D:{n:0,w:0} };
    /* settled outcomes split by how many of the three replicated gates agreed */
    var byStack = { 0:{n:0,w:0}, 1:{n:0,w:0}, 2:{n:0,w:0}, 3:{n:0,w:0} };
    /* Start from any evidence already folded out of the record list. Without
       this, everything pruned would silently vanish from the numbers.
       ticketOnly cannot be answered from the aggregate — it does not keep that
       split — so a ticket-only query deliberately uses live records only and
       is therefore a view of the recent window, not of all time. */
    if (agg && !ticketOnly){
      var ak = String(tab || '') + '|' + String(mechanic || '');
      var a = agg[ak];
      if (a){ wins += (a.wins || 0); losses += (a.losses || 0); expired += (a.expired || 0); rrSum += (a.rrSum || 0);
              bankN += (a.bankN || 0); bankSum += (a.bankSum || 0); bankActualSum += (a.bankActualSum || 0); }
    }
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (tab && r.tab !== tab) continue;
      if (mechanic && r.mechanic !== mechanic) continue;
      if (ticketOnly === true && r.ticket !== true) continue;
      /* Split 'open' before counting it: a record whose bars were never
         going to arrive is not a trade still running. Neither is counted as
         a sample — we do not know the outcome of either. */
      if (r.state === 'open' && hgFwdIsStale(r, nowSec)){ stale++; continue; }
      if (r.state === 't1'){ wins++; rrSum += num(r.rr) || 0; }
      else if (r.state === 'stop') losses++;
      else if (r.state === 'expired') expired++;
      else open++;
      if ((r.state === 't1' || r.state === 'stop') && isFinite(num(r.bankR))){
        bankN++; bankSum += num(r.bankR);
        bankActualSum += (r.state === 't1') ? (num(r.rr) || 0) : -1;
      }
      if ((r.state === 't1' || r.state === 'stop') && byGrade[r.grade]){
        byGrade[r.grade].n++;
        if (r.state === 't1') byGrade[r.grade].w++;
      }
      if ((r.state === 't1' || r.state === 'stop') && byStack[r.stack3]){
        byStack[r.stack3].n++;
        if (r.state === 't1') byStack[r.stack3].w++;
      }
    }
    var settled = wins + losses;
    var hit = settled ? wins / settled : NaN;
    /* average reward multiple actually carried by the winners, so expectancy
       reflects the plans recorded rather than an assumed R */
    var avgRr = wins ? (rrSum / wins) : NaN;
    /* With NO winners avgRr is legitimately unknown — there is no winner to
       average — but the EXPECTANCY is not: every settled trade lost 1R, so it
       is exactly -1R and the hit*avgRr term vanishes. Gating expR on
       isFinite(avgRr) printed a dash for the one record that needs no
       inference at all, and a dash reads as "no data" rather than as the
       worst result on the scale. A desk that has never won must not be able
       to hide behind an em dash. */
    var expR;
    if (!settled) expR = NaN;
    else if (!wins) expR = -1;
    else if (isFinite(avgRr)) expR = hit * avgRr - (1 - hit);
    else expR = NaN;
    return { samples: settled, wins: wins, losses: losses, open: open,
             stale: stale, expired: expired, hit: hit, avgRr: avgRr, expR: expR,
             /* the shadow comparison, matched pairs only */
             bankN: bankN,
             bankExpR: bankN ? (bankSum / bankN) : NaN,
             bankActualExpR: bankN ? (bankActualSum / bankN) : NaN,
             byGrade: byGrade, byStack: byStack };
  }

  /* Every mechanic seen for a tab. Pure. */
  function hgFwdPool(list, tab, agg){
    var recs = Array.isArray(list) ? list : [];
    var seen = {}, out = {}, i, k;
    for (i = 0; i < recs.length; i++){
      if (tab && recs[i].tab !== tab) continue;
      seen[recs[i].mechanic] = true;
    }
    /* Mechanics that exist ONLY in the aggregate — every live record pruned —
       must still appear, or a long-running mechanic would drop off the table
       precisely because it had accumulated the most evidence. */
    for (k in (agg || {})) if (Object.prototype.hasOwnProperty.call(agg, k)){
      var parts = k.split('|');
      if (!tab || parts[0] === tab) seen[parts.slice(1).join('|')] = true;
    }
    for (var m in seen) if (Object.prototype.hasOwnProperty.call(seen, m)){
      out[m] = hgFwdStats(recs, tab, m, false, agg);
    }
    return out;
  }

  /* ==================== the aggregate ====================
     The record list is capped, and pruning is oldest-first. On its own that
     quietly destroys the thing this module exists to build: at a conservative
     150 records/day across ~20 instrumented tabs the cap fills in under a
     month, and a mechanic needing ~157 settled trades over ~2.7 months would
     have its earliest evidence pruned before it ever reached significance —
     the same structural failure as the in-sample window, only slower and
     harder to notice.
     So a record is never simply dropped. Before pruning, any SETTLED outcome
     is folded into a per-(tab, mechanic) running aggregate that has no cap.
     Detail is lost; evidence is not. Open and expired records carry no
     outcome, so dropping those costs nothing. */

  var AGG_KEY = 'hg_forward_agg_v1';

  function aggKey(rec){ return String(rec.tab) + '|' + String(rec.mechanic); }

  function loadAgg(){
    try {
      if (typeof localStorage === 'undefined') return {};
      var j = JSON.parse(localStorage.getItem(AGG_KEY) || '{}');
      return (j && typeof j === 'object') ? j : {};
    } catch (e) { return {}; }
  }

  function saveAgg(a){
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(AGG_KEY, JSON.stringify(a || {}));
      return true;
    } catch (e) { return false; }
  }

  /* Fold settled records into the aggregate. PURE given the aggregate. */
  function hgFwdFold(agg, recs){
    var out = {}, k;
    for (k in (agg || {})) if (Object.prototype.hasOwnProperty.call(agg, k)) out[k] = agg[k];
    for (var i = 0; i < (recs || []).length; i++){
      var r = recs[i];
      if (!r) continue;
      if (r.state !== 't1' && r.state !== 'stop' && r.state !== 'expired') continue;
      var key = aggKey(r);
      if (!out[key]) out[key] = { wins: 0, losses: 0, expired: 0, rrSum: 0 };
      if (r.state === 't1'){ out[key].wins++; out[key].rrSum += (num(r.rr) || 0); }
      else if (r.state === 'stop') out[key].losses++;
      else out[key].expired++;
      /* the shadow folds too, or pruning would erase exactly the long-run
         evidence this measurement exists to accumulate */
      if ((r.state === 't1' || r.state === 'stop') && isFinite(num(r.bankR))){
        out[key].bankN = (out[key].bankN || 0) + 1;
        out[key].bankSum = (out[key].bankSum || 0) + num(r.bankR);
        out[key].bankActualSum = (out[key].bankActualSum || 0) + ((r.state === 't1') ? (num(r.rr) || 0) : -1);
      }
    }
    return out;
  }

  /* ==================== health ====================
     Every call site into this module is wrapped in try/catch, because a
     logging failure must never break a scan. But a SILENT logging failure is
     worse than the crash it prevents: evidence stops accumulating, the panel
     keeps saying "nothing recorded yet", and there is no way to tell a quiet
     market from a broken pipeline. That ambiguity is the exact thing this
     workstream exists to remove, so the module reports its own failures.
     Kept in memory plus a small persisted summary, so a fault that happens
     during a scan still shows after a reload. */

  var HEALTH_KEY = 'hg_forward_health_v1';
  var MAX_ERRS = 20;
  var __errs = [];

  function hgFwdWarn(scope, err){
    try {
      var msg = (err && err.message) ? err.message : String(err || 'unknown');
      __errs.push({ scope: String(scope || '?'), msg: msg, at: Date.now() });
      if (__errs.length > MAX_ERRS) __errs = __errs.slice(-MAX_ERRS);
      try {
        if (typeof localStorage !== 'undefined'){
          var prev = null;
          try { prev = JSON.parse(localStorage.getItem(HEALTH_KEY) || 'null'); } catch (e2) { prev = null; }
          var n = (prev && isFinite(+prev.count)) ? (+prev.count + 1) : 1;
          localStorage.setItem(HEALTH_KEY, JSON.stringify({ count: n, scope: String(scope || '?'), msg: msg, at: Date.now() }));
        }
      } catch (e3) { /* storage full or blocked — the in-memory list still holds it */ }
      try { if (typeof console !== 'undefined' && console.warn) console.warn('[hg-forward] ' + scope, err); } catch (e4) {}
    } catch (e) { /* the warner itself must never throw */ }
  }

  function hgFwdHealth(){
    var persisted = null;
    try {
      if (typeof localStorage !== 'undefined') persisted = JSON.parse(localStorage.getItem(HEALTH_KEY) || 'null');
    } catch (e) { persisted = null; }
    return { errors: __errs.slice(), recent: __errs.length, persisted: persisted };
  }

  function hgFwdHealthHTML(){
    var h = hgFwdHealth();
    var n = (h.persisted && isFinite(+h.persisted.count)) ? +h.persisted.count : h.recent;
    if (!n) return '';
    var last = h.errors.length ? h.errors[h.errors.length - 1] : h.persisted;
    return '<div class="note warn"><b>Forward log reported ' + n + ' failure(s).</b> '
         + 'Evidence may be incomplete — a scan that cannot record looks exactly like a quiet market, '
         + 'which is why this says so instead of staying silent.'
         + (last ? ('<br>Last: <b>' + esc(last.scope) + '</b> — ' + esc(last.msg)) : '')
         + '</div>';
  }

  /* ==================== storage (the only impure part) ==================== */

  function load(){
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      var j = JSON.parse(raw);
      return Array.isArray(j) ? j : [];
    } catch (e) { return []; }
  }

  function save(list){
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(LS_KEY, JSON.stringify(list || []));
      return true;
    } catch (e) { return false; }   /* quota or private mode — evidence is not correctness */
  }

  /* ==================== window API ==================== */

  if (typeof window !== 'undefined'){
    var W = window;

    /* pure, for tests */
    W.hgFwdKey = hgFwdKey;
    W.hgFwdNormalize = hgFwdNormalize;
    W.hgFwdAdd = hgFwdAdd;
    W.hgFwdSettleOne = hgFwdSettleOne;
    W.hgFwdSettle = hgFwdSettle;
    W.hgFwdStatsOf = hgFwdStats;
    W.hgFwdFold = hgFwdFold;
    W.hgFwdAgg = loadAgg;
    W.hgFwdPoolOf = hgFwdPool;
    W.HG_FWD_MAX = MAX_RECORDS;

    /* Record a setup the moment a tab emits it. Safe to call on every scan:
       the same firing on the same bar is recorded once. */
    W.hgFwdRecord = function(rec){
      try {
        var r = hgFwdAdd(load(), rec);
        if (r.added){
          /* Fold BEFORE saving the trimmed list, so a crash between the two
             cannot lose the dropped records' outcomes. */
          if (r.folded && r.folded.length) saveAgg(hgFwdFold(loadAgg(), r.folded));
          save(r.list);
        }
        return r.reason;
      } catch (e) { hgFwdWarn('record', e); return 'error'; }
    };

    /* Hand back fresh candles for a symbol; any open record whose outcome is
       now knowable settles. Call this at the START of a scan, before
       recording the current bar's setups. */
    W.hgFwdResolve = function(sym, tf, rows){
      try {
        var r = hgFwdSettle(load(), sym, tf, rows);
        if (r.changed) save(r.list);
        return r.changed;
      } catch (e) { return 0; }
    };

    /* Out-of-sample stats, same shape the in-sample pool uses, so
       hgOmniPoolRead() reads either without translation. */
    W.hgFwdStats = function(tab, mechanic, ticketOnly){
      try { return hgFwdStats(load(), tab, mechanic, ticketOnly, loadAgg()); }
      catch (e) { hgFwdWarn('stats', e); return { samples:0, wins:0, losses:0, open:0, expired:0, hit:NaN, avgRr:NaN, expR:NaN }; }
    };
    W.hgFwdPool = function(tab){
      try { return hgFwdPool(load(), tab, loadAgg()); }
      catch (e) { hgFwdWarn('pool', e); return {}; }
    };

    /* Record a whole scan's output in one call — the shape every tab needs.
       barT is derived by flooring NOW to the timeframe, so re-running a scan
       inside the same bar records each setup once, which is exactly the dedup
       rule the log is built on. Callers pass their own setups; nothing here
       inspects tab internals, so instrumenting a new tab is one line.
       Returns how many NEW trades were recorded. */
    W.hgFwdRecordScan = function(tab, tf, cands, opts){
      try {
        if (!tab || !Array.isArray(cands) || !cands.length) return 0;
        var sec = TF_SEC[tf] || 14400;
        var barT = Math.floor((Date.now() / 1000) / sec) * sec;
        var o = opts || {};
        var added = 0, i, c;
        for (i = 0; i < cands.length; i++){
          c = cands[i];
          if (!c) continue;
          var r = W.hgFwdRecord({
            tab: tab,
            mechanic: c.mechanic || c.strategy || o.mechanic || tf,
            sym: c.sym || c.symbol,
            tf: tf,
            dir: c.dir,
            entry: c.entry, stop: c.stop, t1: c.t1,
            barT: barT,
            horizonBars: o.horizonBars || 20,
            ticket: (c.ticket !== undefined) ? c.ticket : (o.ticket === true),
            /* accept the grade wherever the calling desk keeps it */
            grade: c.grade || c.engineGrade || (c.gradeObj && c.gradeObj.letter) || o.grade || '',
            /* stack3 from OMNIROUTE and OMNIGOLD, passed through unchanged */
            stack3: c.stack3
          });
          if (r === 'recorded') added++;
        }
        return added;
      } catch (e) { return 0; }
    };

    /* A drop-in panel any tab can render with one line. Kept here rather than
       in each tab so the wording, the thresholds and the honest empty state
       stay identical everywhere — the alternative is forty tabs each
       describing out-of-sample evidence slightly differently.
       Verdicts come from hgOmniPoolRead when it is loaded; without it the panel
       still lists counts and simply omits verdicts.

       WHICH BAR. This used to say "exactly the same +/-2 sigma bar as the
       in-sample one", and that stopped being true when the in-sample table
       moved its POSITIVE bar to the family-wise threshold. Worse, the call
       passed no bar at all, so after that change every forward panel in the
       app silently inherited omniroute's 27-MECHANIC default — a gold panel
       judged by the crypto count.

       The bar is derived from the rows this panel is actually rendering. That
       is the honest number: a reader looking at a table of N mechanics and
       noticing the best one has searched N ways, whether the numbers are
       in-sample or out. The negative side keeps -2 sigma, because noticing
       that one named mechanic is losing is not a search. */
    W.hgFwdPanelHTML = function(tab, opts){
      try {
        var o = opts || {};
        var pool = W.hgFwdPool(tab) || {};   /* already merges the aggregate */
        var keys = [], k;
        for (k in pool) if (Object.prototype.hasOwnProperty.call(pool, k)) keys.push(k);
        keys.sort();
        var title = o.title || 'FORWARD — out-of-sample, accumulated across scans';
        var healthHtml = hgFwdHealthHTML();
        if (!keys.length){
          return healthHtml + '<div class="note"><b>' + esc(title) + '</b><br>'
               + 'Nothing recorded yet. This fills as scans run: each setup is logged once when it '
               + 'fires and settled later by bars that had not printed at the time. Unlike every '
               + 'other measurement in the app, it is never re-read from the current window.</div>';
        }
        var readFn = (typeof W.hgOmniPoolRead === 'function') ? W.hgOmniPoolRead : null;
        var minRr = isFinite(+o.minRr) ? +o.minRr : 2;
        /* Correct over the rows THIS panel shows, not over another desk's
           mechanic count. o.barZ lets a caller state its own if it has reason
           to. */
        var barZ = isFinite(+o.barZ) && +o.barZ > 0 ? +o.barZ
                 : ((typeof W.hgOmniFamilyZ === 'function') ? W.hgOmniFamilyZ(Math.max(1, keys.length)) : 2);
        var h = healthHtml + '<h4>' + esc(title) + '</h4>';
        h += '<table class="tbl"><thead><tr><th>MECHANIC</th><th>SETTLED</th><th>T1-FIRST</th>'
           + '<th>EXPECTANCY</th><th>OPEN</th><th>READ</th></tr></thead><tbody>';
        var i, p, v;
        for (i = 0; i < keys.length; i++){
          p = pool[keys[i]];
          v = readFn ? readFn(p, minRr, 20, barZ) : null;
          /* A mechanic with open trades and none settled has NOT "never
             fired" — it has fired and is waiting. The shared verdict helper
             only speaks about settled samples, so that distinction has to be
             made here or the panel misreports its own pending evidence. */
          var read;
          if (!p.samples) read = p.open ? (p.open + ' awaiting settlement')
                                        : (p.stale ? 'nothing settled — ' + p.stale + ' stale' : 'never fired');
          else read = v ? v.read : 'unjudged';
          var cls = (!p.samples) ? '' : (v ? v.cls : '');
          var need = hgFwdNeedText(v && v.need);
          h += '<tr><td><b>' + esc(keys[i]) + '</b></td>'
             + '<td>' + p.samples + need + '</td>'
             + '<td>' + (p.samples ? (p.hit * 100).toFixed(0) + '%' : '—') + '</td>'
             + '<td>' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—') + '</td>'
             + '<td class="dim">' + p.open
             + (p.stale ? (' <span class="dim">/' + p.stale + ' stale</span>') : '')
             + (p.expired ? (' <span class="dim">/' + p.expired + ' exp</span>') : '') + '</td>'
             + '<td><span class="gpip ' + cls + '">' + esc(read) + '</span></td></tr>';
        }
        h += '</tbody></table>';
        /* THE SHADOW LINE. Sums the matched pairs across every mechanic shown
           and prints both policies side by side. Nothing is recommended until
           the gap is worth acting on over a real sample — this line is the
           evidence accumulating in public, not a verdict. */
        (function(){
          var bn = 0, bs = 0, ba = 0, bi2;
          for (bi2 = 0; bi2 < keys.length; bi2++){
            var bp = pool[keys[bi2]];
            if (bp && bp.bankN){ bn += bp.bankN; bs += bp.bankN * bp.bankExpR; ba += bp.bankN * bp.bankActualExpR; }
          }
          if (bn > 0){
            var sh = bs / bn, ac = ba / bn;
            h += '<div class="note"><b>SHADOW — bank half at +1R, rest to breakeven</b>: '
              + bn + ' settled pair' + (bn === 1 ? '' : 's') + ' · as traded '
              + (ac >= 0 ? '+' : '') + ac.toFixed(2) + 'R vs shadow '
              + (sh >= 0 ? '+' : '') + sh.toFixed(2) + 'R per trade. '
              + (bn < 30 ? 'Too few pairs to act on — accumulating.'
                         : 'A persistent gap here is out-of-sample evidence; in-sample, 48% of stopped gold scalps had first reached +1R.')
              + '</div>';
          }
        })();
        /* THE GRADE LINE. The A/B/C chips grade by CONFLUENCE COUNT — A means
           eight or more reads agree. Whether that predicts anything on gold is
           an open question and a doubtful one: eleven gates measured backwards
           on the scalp horizon, and they all pass when the tape is active,
           which is when a gold move is already spent. This is where the chips
           get judged on trades recorded before their outcomes existed. */
        (function(){
          var g, tot = 0, gs = { A:{n:0,w:0}, B:{n:0,w:0}, C:{n:0,w:0}, D:{n:0,w:0} };
          for (var gi = 0; gi < keys.length; gi++){
            var gp = pool[keys[gi]];
            if (!gp || !gp.byGrade) continue;
            for (g in gs) if (gp.byGrade[g]){ gs[g].n += gp.byGrade[g].n; gs[g].w += gp.byGrade[g].w; tot += gp.byGrade[g].n; }
          }
          if (!tot) return;
          var parts = [];
          for (g in gs) if (gs[g].n) parts.push(g + ' ' + (100 * gs[g].w / gs[g].n).toFixed(0) + '% (n=' + gs[g].n + ')');
          h += '<div class="note"><b>BY GRADE</b> — T1-first on settled records, split by the grade the '
            + 'setup carried when it fired: ' + esc(parts.join(' · ')) + '. '
            + (tot < 40
                ? 'Too few to judge the chips yet — accumulating.'
                : 'If A does not beat C here, the chips are counting confluence rather than measuring edge.')
            + '</div>';
        })();
        /* THE STACK LINE. Each desk earned its own stack, so the wording is
           per-tab. GOLD: regime-fit + htf-confirm + hurst-regime were the
           only gates that replicated on both horizons — in-sample (close-by-
           close re-measure) the swing horizon went 31.6% on tape alone to
           44.2% with all three, z +5.68. CRYPTO (OMNIROUTE): regime and
           htf-confirm replicated on both 4h and 1h across 10 Binance majors,
           stoch-rsi marginally; gold's other two gates did NOT survive
           there. This is where each claim gets checked against trades
           recorded before their outcomes existed. */
        (function(){
          var isGoldTab = String(tab).indexOf('OMNIGOLD') === 0 || String(tab).indexOf('GOLD') === 0;
          var stackNames = isGoldTab
            ? 'regime-fit, htf-confirm and hurst-regime'
            : 'regime, htf-confirm and stoch-rsi';
          var stackCtx = isGoldTab
            ? 'In-sample the swing horizon ran 31.6% on tape alone against 44.2% with all three; this is the out-of-sample check on that.'
            : 'In-sample (10 Binance majors) BTC-regime-aligned firings ran 32.2% at 2R against 35.0% with htf-confirm stacked on; this is the out-of-sample check on that.';
          var st = { 0:{n:0,w:0}, 1:{n:0,w:0}, 2:{n:0,w:0}, 3:{n:0,w:0} }, tot = 0, k, si;
          for (si = 0; si < keys.length; si++){
            var sp = pool[keys[si]];
            if (!sp || !sp.byStack) continue;
            for (k in st) if (sp.byStack[k]){ st[k].n += sp.byStack[k].n; st[k].w += sp.byStack[k].w; tot += sp.byStack[k].n; }
          }
          if (!tot) return;
          var bits = [];
          for (k in st) if (st[k].n) bits.push(k + '/3 ' + (100 * st[k].w / st[k].n).toFixed(0) + '% (n=' + st[k].n + ')');
          h += '<div class="note"><b>REPLICATED-GATE STACK</b> — T1-first by how many of '
            + stackNames + ' agreed: ' + esc(bits.join(' · ')) + '. '
            + (tot < 40 ? 'Too few to judge yet — accumulating.' : stackCtx)
            + '</div>';
        })();
        h += '<div class="note">Recorded once per firing when it fires, settled later by bars that did '
           + 'not exist at the time. A bar spanning both stop and target counts as a STOP; expiry is '
           + 'excluded rather than counted as a win. This is the only measurement here that accumulates.</div>';
        return h;
      } catch (e) { return ''; }
    };

    /* Every tab's evidence in one table. Most tabs record but have no panel
       of their own, so without this the instrumentation is write-only —
       fifteen tabs banking evidence nobody can read.
       This lives beside SCORECARD's ledger rather than replacing it. That
       ledger dedups by symbol+direction within 24h, which is correct for
       "did this SETUP pay" but collapses distinct mechanics: if two tabs
       both fire long BTC today it keeps one. Measuring which MECHANIC pays
       needs the tab+mechanic+bar key used here, so the two answer different
       questions and both are worth having. */
    W.hgFwdAllHTML = function(opts){
      try {
        var o = opts || {};
        var list = load();
        if (!list.length && !Object.keys(loadAgg()).length){
          return hgFwdHealthHTML() + '<div class="note"><b>FORWARD LEDGER — every tab, out-of-sample</b><br>'
               + 'Nothing recorded yet. Each tab logs a setup once when it fires and settles it later '
               + 'against bars that had not printed at the time. Run the scanners and this fills; '
               + 'unlike every other measurement in the app it is never re-read from the current window.</div>';
        }
        var agg = loadAgg();
        var tabs = {}, i, r, ak;
        for (i = 0; i < list.length; i++){
          r = list[i];
          if (!tabs[r.tab]) tabs[r.tab] = true;
        }
        /* Tabs whose live records have all been pruned still have evidence in
           the aggregate — they must not disappear from the ledger. */
        for (ak in agg) if (Object.prototype.hasOwnProperty.call(agg, ak)) tabs[ak.split('|')[0]] = true;
        var names = [];
        for (var t in tabs) if (Object.prototype.hasOwnProperty.call(tabs, t)) names.push(t);
        names.sort();
        var readFn = (typeof W.hgOmniPoolRead === 'function') ? W.hgOmniPoolRead : null;
        var minRr = isFinite(+o.minRr) ? +o.minRr : 2;
        /* Count the rows before rendering them: this table spans every tab, so
           the search a reader performs over it is wider than any one desk's. */
        var ledgerRows = 0;
        for (var ci = 0; ci < names.length; ci++){
          var cp = hgFwdPool(list, names[ci], agg);
          for (var cm in cp) if (Object.prototype.hasOwnProperty.call(cp, cm)) ledgerRows++;
        }
        var barZ = (typeof W.hgOmniFamilyZ === 'function') ? W.hgOmniFamilyZ(Math.max(1, ledgerRows)) : 2;
        var h = hgFwdHealthHTML() + '<h3>FORWARD LEDGER — every tab, out-of-sample</h3>';
        h += '<table class="tbl"><thead><tr><th>TAB</th><th>MECHANIC</th><th>SETTLED</th>'
           + '<th>T1-FIRST</th><th>EXPECTANCY</th><th>OPEN</th><th>READ</th></tr></thead><tbody>';
        var totS = 0, totW = 0, totO = 0, rowsOut = 0;
        for (i = 0; i < names.length; i++){
          var pool = hgFwdPool(list, names[i], agg);
          var mechs = [];
          for (var m in pool) if (Object.prototype.hasOwnProperty.call(pool, m)) mechs.push(m);
          mechs.sort();
          for (var j = 0; j < mechs.length; j++){
            var p = pool[mechs[j]];
            /* SUPER: tabs are SELECTION layers — they re-present setups their
               source tab already recorded, after a conviction filter. Their own
               numbers are meaningful (does the filter beat the pool?), but they
               are not distinct trades, so they are shown and excluded from the
               totals rather than double-counted. */
            var isSel = names[i].indexOf('SUPER:') === 0;
            if (!isSel){ totS += p.samples; totW += p.wins; totO += p.open; }
            rowsOut++;
            var v = readFn ? readFn(p, minRr, 20, barZ) : null;
            var read = !p.samples ? (p.open ? (p.open + ' awaiting settlement')
                                             : (p.stale ? 'nothing settled — ' + p.stale + ' stale' : 'never fired'))
                                  : (v ? v.read : 'unjudged');
            var cls = !p.samples ? '' : (v ? v.cls : '');
            var need = hgFwdNeedText(v && v.need);
            h += '<tr><td class="dim">' + esc(names[i]) + (isSel ? ' <span class="dim">(selection)</span>' : '')
               + '</td><td><b>' + esc(mechs[j]) + '</b></td>'
               + '<td>' + p.samples + need + '</td>'
               + '<td>' + (p.samples ? (p.hit * 100).toFixed(0) + '%' : '—') + '</td>'
               + '<td>' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—') + '</td>'
               + '<td class="dim">' + p.open + '</td>'
               + '<td><span class="gpip ' + cls + '">' + esc(read) + '</span></td></tr>';
          }
        }
        h += '</tbody></table>';
        h += '<div class="note">' + rowsOut + ' mechanic(s) across ' + names.length + ' tab(s) · '
           + totS + ' settled, ' + totO + ' open <span class="dim">(selection desks excluded from these '
           + 'totals — they re-present setups their source tab already recorded, so counting them again '
           + 'would inflate the trade count; their own rows above still stand)</span>'
           + (totS ? (' · ' + (totW / totS * 100).toFixed(0) + '% T1-first overall') : '')
           + '. Recorded once per firing, settled by bars that did not exist at the time; a bar spanning '
           + 'both stop and target counts as a STOP, and expiry is excluded rather than counted as a win. '
           + 'This sits alongside the SCORECARD ledger below, which dedups by symbol and direction over 24h '
           + '— right for "did this setup pay", but it merges mechanics, so per-mechanic evidence is keyed '
           + 'separately here.</div>';
        return h;
      } catch (e) { return ''; }
    };

    W.hgFwdWarn = hgFwdWarn;
    W.hgFwdHealth = hgFwdHealth;
    W.hgFwdHealthHTML = hgFwdHealthHTML;

    W.hgFwdState = function(){
      try {
        var l = load(), open = 0, settled = 0, i;
        for (i = 0; i < l.length; i++){
          if (l[i].state === 'open') open++;
          else if (l[i].state === 't1' || l[i].state === 'stop') settled++;
        }
        return { total: l.length, open: open, settled: settled, cap: MAX_RECORDS };
      } catch (e) { return null; }
    };
    /* Clear the forward log, optionally for ONE desk only.

       All-or-nothing was the only option, and that is the wrong tool after a
       model change: the gold stop fix invalidated the OMNIGOLD records, while
       the OMNIROUTE, PINE and EDGE pools were recorded under a stop model
       that did not change and are still good evidence. Wiping those to fix
       gold would destroy months of accumulated out-of-sample record for no
       reason.

       Pass a tab prefix to clear just that desk — 'OMNIGOLD' catches both
       'OMNIGOLD:SCALP' and 'OMNIGOLD:SWING'. Pass nothing to clear
       everything, which is what this always did.

       The AGGREGATE is cleared for the same tabs in the same call. It is a
       separate store that survives record pruning by design, so clearing
       records alone would leave the log still reporting trades the user
       believes they deleted — the exact failure this had to avoid.

       Returns what was actually removed rather than a bare true, because
       "I deleted your evidence" deserves a count. */
    W.hgFwdClear = function(tabPrefix){
      try {
        var pref = (tabPrefix === undefined || tabPrefix === null) ? null : String(tabPrefix);
        if (pref === null || pref === ''){
          var allRecs = load().length;
          var allAgg = Object.keys(loadAgg()).length;
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(AGG_KEY);
          return { cleared: 'ALL', records: allRecs, aggregates: allAgg };
        }
        var recs = load();
        var keptRecs = [], droppedRecs = 0, i;
        for (i = 0; i < recs.length; i++){
          if (recs[i] && String(recs[i].tab).indexOf(pref) === 0) droppedRecs++;
          else keptRecs.push(recs[i]);
        }
        save(keptRecs);
        var agg = loadAgg(), keptAgg = {}, droppedAgg = 0, k;
        for (k in agg){
          if (!Object.prototype.hasOwnProperty.call(agg, k)) continue;
          if (String(k).indexOf(pref + '|') === 0) droppedAgg++;
          else keptAgg[k] = agg[k];
        }
        saveAgg(keptAgg);
        return { cleared: pref, records: droppedRecs, aggregates: droppedAgg,
                 recordsKept: keptRecs.length, aggregatesKept: Object.keys(keptAgg).length };
      } catch (e) { hgFwdWarn('clear', e); return { cleared: null, records: 0, aggregates: 0, error: true }; }
    };
  }

})();
