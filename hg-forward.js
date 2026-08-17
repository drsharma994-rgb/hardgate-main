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

  /* Module scope on purpose: this file is 'use strict', so a function declared
     inside the `if (typeof window …)` block does NOT escape it — the health
     renderer sits outside that block and could not see it there. */
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
  function hgFwdStats(list, tab, mechanic, ticketOnly, agg){
    var recs = Array.isArray(list) ? list : [];
    var wins = 0, losses = 0, open = 0, expired = 0, rrSum = 0, i, r;
    /* Start from any evidence already folded out of the record list. Without
       this, everything pruned would silently vanish from the numbers.
       ticketOnly cannot be answered from the aggregate — it does not keep that
       split — so a ticket-only query deliberately uses live records only and
       is therefore a view of the recent window, not of all time. */
    if (agg && !ticketOnly){
      var ak = String(tab || '') + '|' + String(mechanic || '');
      var a = agg[ak];
      if (a){ wins += (a.wins || 0); losses += (a.losses || 0); expired += (a.expired || 0); rrSum += (a.rrSum || 0); }
    }
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

    /* A drop-in panel any tab can render with one line. Kept here rather than
       in each tab so the wording, the thresholds and the honest empty state
       stay identical everywhere — the alternative is forty tabs each
       describing out-of-sample evidence slightly differently.
       Verdicts come from hgOmniPoolRead when it is loaded, so the forward
       column is judged by exactly the same +/-2 sigma bar as the in-sample
       one; without it the panel still lists counts and simply omits verdicts. */
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
        var h = healthHtml + '<h4>' + esc(title) + '</h4>';
        h += '<table class="tbl"><thead><tr><th>MECHANIC</th><th>SETTLED</th><th>T1-FIRST</th>'
           + '<th>EXPECTANCY</th><th>OPEN</th><th>READ</th></tr></thead><tbody>';
        var i, p, v;
        for (i = 0; i < keys.length; i++){
          p = pool[keys[i]];
          v = readFn ? readFn(p, minRr, 20) : null;
          /* A mechanic with open trades and none settled has NOT "never
             fired" — it has fired and is waiting. The shared verdict helper
             only speaks about settled samples, so that distinction has to be
             made here or the panel misreports its own pending evidence. */
          var read;
          if (!p.samples) read = p.open ? (p.open + ' awaiting settlement') : 'never fired';
          else read = v ? v.read : 'unjudged';
          var cls = (!p.samples) ? '' : (v ? v.cls : '');
          var need = (v && v.need) ? (' <span class="dim">(needs ~' + v.need + ')</span>') : '';
          h += '<tr><td><b>' + esc(keys[i]) + '</b></td>'
             + '<td>' + p.samples + need + '</td>'
             + '<td>' + (p.samples ? (p.hit * 100).toFixed(0) + '%' : '—') + '</td>'
             + '<td>' + (isFinite(p.expR) ? ((p.expR >= 0 ? '+' : '') + p.expR.toFixed(2) + 'R') : '—') + '</td>'
             + '<td class="dim">' + p.open + (p.expired ? (' <span class="dim">/' + p.expired + ' exp</span>') : '') + '</td>'
             + '<td><span class="gpip ' + cls + '">' + esc(read) + '</span></td></tr>';
        }
        h += '</tbody></table>';
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
            var v = readFn ? readFn(p, minRr, 20) : null;
            var read = !p.samples ? (p.open ? (p.open + ' awaiting settlement') : 'never fired')
                                  : (v ? v.read : 'unjudged');
            var cls = !p.samples ? '' : (v ? v.cls : '');
            var need = (v && v.need) ? (' <span class="dim">(needs ~' + v.need + ')</span>') : '';
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
