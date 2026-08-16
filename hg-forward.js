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
    /* prune oldest-first, by the bar the setup fired on */
    if (out.length > MAX_RECORDS){
      out.sort(function(a, b){ return num(a.barT) - num(b.barT); });
      out = out.slice(out.length - MAX_RECORDS);
    }
    return { list: out, added: true, reason: 'recorded' };
  }

  /* Settle one open record against candles. Only bars STRICTLY AFTER the
     firing bar are considered, so a record can never be resolved by data
     that already existed when it was written. Pure. */
  function hgFwdSettleOne(rec, rows){
    if (!rec || rec.state !== 'open') return rec;
    if (!rows || !rows.length) return rec;
    var i, t, h, l, seen = 0;
    var hitStop, hitT1;
    for (i = 0; i < rows.length; i++){
      t = num(rows[i].t);
      if (!isFinite(t) || t <= rec.barT) continue;      /* strictly after */
      seen++;
      h = num(rows[i].h); l = num(rows[i].l);
      if (!isFinite(h) || !isFinite(l)) continue;
      hitStop = (rec.dir === 'long') ? (l <= rec.stop) : (h >= rec.stop);
      hitT1   = (rec.dir === 'long') ? (h >= rec.t1)   : (l <= rec.t1);
      /* both in one bar -> STOP. Candles cannot say which printed first. */
      if (hitStop) return copyWith(rec, { state:'stop', r: -1, settledT: t });
      if (hitT1)   return copyWith(rec, { state:'t1',   r: rec.rr, settledT: t });
      if (seen >= rec.horizonBars) return copyWith(rec, { state:'expired', r: null, settledT: t });
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
  function hgFwdStats(list, tab, mechanic, ticketOnly){
    var recs = Array.isArray(list) ? list : [];
    var wins = 0, losses = 0, open = 0, expired = 0, rrSum = 0, i, r;
    for (i = 0; i < recs.length; i++){
      r = recs[i];
      if (tab && r.tab !== tab) continue;
      if (mechanic && r.mechanic !== mechanic) continue;
      if (ticketOnly === true && r.ticket !== true) continue;
      if (r.state === 't1'){ wins++; rrSum += num(r.rr) || 0; }
      else if (r.state === 'stop') losses++;
      else if (r.state === 'expired') expired++;
      else open++;
    }
    var settled = wins + losses;
    var hit = settled ? wins / settled : NaN;
    /* average reward multiple actually carried by the winners, so expectancy
       reflects the plans recorded rather than an assumed R */
    var avgRr = wins ? (rrSum / wins) : NaN;
    var expR = (settled && isFinite(avgRr)) ? (hit * avgRr - (1 - hit)) : NaN;
    return { samples: settled, wins: wins, losses: losses, open: open,
             expired: expired, hit: hit, avgRr: avgRr, expR: expR };
  }

  /* Every mechanic seen for a tab. Pure. */
  function hgFwdPool(list, tab){
    var recs = Array.isArray(list) ? list : [];
    var seen = {}, out = {}, i;
    for (i = 0; i < recs.length; i++){
      if (tab && recs[i].tab !== tab) continue;
      seen[recs[i].mechanic] = true;
    }
    for (var m in seen) if (Object.prototype.hasOwnProperty.call(seen, m)){
      out[m] = hgFwdStats(recs, tab, m);
    }
    return out;
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
    W.hgFwdPoolOf = hgFwdPool;
    W.HG_FWD_MAX = MAX_RECORDS;

    /* Record a setup the moment a tab emits it. Safe to call on every scan:
       the same firing on the same bar is recorded once. */
    W.hgFwdRecord = function(rec){
      try {
        var r = hgFwdAdd(load(), rec);
        if (r.added) save(r.list);
        return r.reason;
      } catch (e) { return 'error'; }
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
      try { return hgFwdStats(load(), tab, mechanic, ticketOnly); }
      catch (e) { return { samples:0, wins:0, losses:0, open:0, expired:0, hit:NaN, avgRr:NaN, expR:NaN }; }
    };
    W.hgFwdPool = function(tab){
      try { return hgFwdPool(load(), tab); } catch (e) { return {}; }
    };
    /* Bar-open seconds per timeframe, so a scan can derive the bar it fired on
       without the caller threading candle timestamps through. */
    var TF_SEC = { '1m':60, '5m':300, '15m':900, '30m':1800, '1h':3600, '2h':7200, '4h':14400, '1d':86400 };

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
            ticket: (c.ticket !== undefined) ? c.ticket : (o.ticket === true)
          });
          if (r === 'recorded') added++;
        }
        return added;
      } catch (e) { return 0; }
    };

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
    W.hgFwdClear = function(){
      try { localStorage.removeItem(LS_KEY); return true; } catch (e) { return false; }
    };
  }

})();
