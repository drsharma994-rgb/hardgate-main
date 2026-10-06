/* HARDGATE — gold-iux.js — ONE IUX XAUUSD ANCHOR FOR EVERY GOLD TAB (hg-v1161)

   THE ASK: price every gold tab's ENTRY / STOP / T1 on the IUX XAUUSD chart.

   WHAT THE DESKS WERE DOING. Three gold desks each carried their own copy of
   a "scale the levels to live spot" rule, with three different triggers:
   GOLD SCALP and GOLD SWING scaled a candidate's levels by live/feed when
   the two sat 0.5% apart (and not inside 0.35%); OMNIGOLD scaled its plans
   from 0.15% or 8 points; and build-stamp.js wrapped window.fetch (hg-v1101)
   to SHIFT any gold candle payload whose last close sat $8 to $80 ABOVE
   gold-api spot — so a feed BELOW spot (Delta XAUT runs ~1.5% under, PAXG
   either side) was never shifted, a URL the wrapper's regex did not match
   (Binance through /api/proxy is percent-encoded) was never shifted, and
   the five desk label maps called a Yahoo feed "IUX XAUUSD" whether or not
   the shift had fired. Ten of the fifteen minting gold desks applied no
   anchor at all. And where a desk DID scale, it scaled the levels AFTER the
   engines and recorded the scaled levels into a forward ledger that settles
   on the UNscaled feed bars (hg-v979), so every scaled record was decided
   by the basis on its first bar rather than by the tape.

   ONE HOME, AT THE FEED. The anchor is applied to the BARS, once, where
   every gold desk fetches them — macro.js getGoldCandles, the shell's
   getXAUCandles (its Delta XAUT leg), OMNIGOLD's own fetcher and the three
   direct PAXG fallbacks — through hgGoldIuxApply. Every level every desk
   derives from those bars is then on the IUX scale by construction, every
   percent-based rule (stop%, ATR%, basis%, RVOL, every gate) is unchanged
   exactly because a pure scale cancels out of a ratio, and the forward
   ledger records AND settles on the same anchored feed, re-anchored on
   each fetch. The three desk-level scalers stay as the residual safety net
   for a feed that arrived unanchored (the anchor unreadable at fetch time,
   readable at scan time); on an anchored feed they measure ~0 and do not
   fire, and the guard asserts that.

   WHAT "IUX" MEANS HERE, SAID PLAINLY. IUX has no public price API. Its
   XAUUSD CFD tracks spot gold; the one free spot quote this repo already
   reads is api.gold-api.com XAU (macro.js, the hg-v1101 wrapper, the three
   desk scalers all read it), so THAT is the anchor, named on screen as
   "IUX anchor (gold-api spot)". A BROKER feed is never anchored: a
   configured MT5 bridge (xm-xauusd) IS the reader's instrument, and moving
   its bars onto a different quote would be the wrong direction.

   THE RULE. ratio = anchor / feedLastClose. Inside 0.05% nothing moves (a
   feed on the anchor is on the anchor; the measurement is kept so the
   record can say so). Beyond 2.5% nothing moves either — a feed that far
   from spot is a broken feed, not a basis, and a broken feed must not be
   dressed up as the anchor. Between the two every o/h/l/c is multiplied by
   the ratio on NEW row objects (the fetcher's own rows are never mutated),
   volume and time untouched, a null price stays null (+null is 0, the
   trap this repo has hit ten times). A pack already carrying `iux` is
   returned as it is, so a cached pack is never anchored twice.

   FAILS OPEN EVERYWHERE: no anchor (timeout, non-ok, junk price, no
   fetch), no rows, no feed name, the module absent from a page — the
   bars are the feed's bars, exactly as before this file existed.

   WHAT THE LEDGER GAINS: hg-forward.js stamps `iuxShiftPct` (the percent
   the record's feed was moved at fire time; 0 when measured on the anchor;
   ABSENT for a broker or unmeasured feed) on every record through
   hgGoldIuxShiftOf, and the gold desk note prints how many records carry
   it and the median move — the residual error of this pack is the drift
   of that basis between fire and settle, and a ledger that records the
   move can measure it. Nothing is gated on it. */
(function(){
  'use strict';
  var G = (typeof window !== 'undefined') ? window : globalThis;

  var MIN_PCT = 0.05;          /* inside this the feed sits on the anchor */
  var MAX_PCT = 2.5;           /* beyond this the feed is broken, not based */
  var ANCHOR_TTL_MS = 45000;   /* gold-api upstream cache is ~10s; 45s is the hg-v1101 figure */
  var ANCHOR_TIMEOUT_MS = 2500;
  var ANCHOR_URL = 'https://api.gold-api.com/price/XAU';
  var BROKER_FEEDS = ['xm-xauusd'];

  var state = { anchor: null, byFeed: {} };
  var inflight = null;

  function num(v){ return (typeof v === 'number' && isFinite(v)) ? v : NaN; }

  function isBrokerFeed(feed){
    return BROKER_FEEDS.indexOf(String(feed || '')) >= 0;
  }

  /* The IUX anchor: gold-api spot, cached 45s, one request in flight,
     bounded, null on every failure. */
  function hgGoldIuxAnchor(opts){
    opts = opts || {};
    var now = Date.now();
    var a = state.anchor;
    if (a && num(a.px) > 0 && (now - a.at) < ANCHOR_TTL_MS && !opts.refresh) return Promise.resolve(a);
    if (inflight) return inflight;
    var f = (typeof G.fetch === 'function') ? G.fetch : null;
    if (!f) return Promise.resolve(a && num(a.px) > 0 ? a : null);
    var timeoutMs = num(opts.timeoutMs) > 0 ? num(opts.timeoutMs) : ANCHOR_TIMEOUT_MS;
    var ctrl = null, timer = null;
    try{ ctrl = (typeof AbortController === 'function') ? new AbortController() : null; }catch(e0){ ctrl = null; }
    var req;
    try{
      req = Promise.resolve(f(ANCHOR_URL, ctrl ? { cache: 'no-store', signal: ctrl.signal } : { cache: 'no-store' }));
    }catch(e1){ req = Promise.reject(e1); }
    var timed = new Promise(function(res){
      timer = setTimeout(function(){ try{ if (ctrl) ctrl.abort(); }catch(e2){} res(null); }, timeoutMs);
    });
    inflight = Promise.race([
      req.then(function(r){
        if (!r || !r.ok || typeof r.json !== 'function') return null;
        return r.json();
      }).then(function(j){
        var p = j ? num(+j.price) : NaN;
        if (!(p > 1000 && p < 20000)) return null;
        state.anchor = { px: p, at: Date.now(), src: 'gold-api' };
        return state.anchor;
      }).catch(function(){ return null; }),
      timed
    ]).then(function(out){
      try{ clearTimeout(timer); }catch(e3){}
      inflight = null;
      if (out) return out;
      /* a stale anchor is better than none for a label; it is NOT used to shift */
      return null;
    });
    return inflight;
  }

  function hgGoldIuxAnchorCached(){
    var a = state.anchor;
    return (a && num(a.px) > 0) ? { px: a.px, at: a.at, src: a.src } : null;
  }

  function hgGoldIuxLastClose(rows){
    if (!Array.isArray(rows)) return NaN;
    for (var i = rows.length - 1; i >= 0; i--){
      var r = rows[i];
      if (!r) continue;
      var c = num(r.c !== undefined ? r.c : r.close);
      if (c > 0) return c;
    }
    return NaN;
  }

  /* The one rule. null when either side is unreadable. */
  function hgGoldIuxRatio(feedLast, anchorPx){
    var fl = num(feedLast), ap = num(anchorPx);
    if (!(fl > 0) || !(ap > 0)) return null;
    var pct = (ap / fl - 1) * 100;
    if (Math.abs(pct) < MIN_PCT) return { ratio: 1, pct: pct, shift: false, why: 'on-anchor' };
    if (Math.abs(pct) > MAX_PCT) return { ratio: 1, pct: pct, shift: false, why: 'out-of-window' };
    return { ratio: ap / fl, pct: pct, shift: true, why: 'shifted' };
  }

  var PX_KEYS = ['o', 'h', 'l', 'c', 'open', 'high', 'low', 'close'];
  function hgGoldIuxShiftRows(rows, ratio){
    var rt = num(ratio);
    if (!Array.isArray(rows) || !(rt > 0)) return rows;
    var out = new Array(rows.length);
    for (var i = 0; i < rows.length; i++){
      var r = rows[i];
      if (!r || typeof r !== 'object'){ out[i] = r; continue; }
      var n = {};
      for (var k in r){
        if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
        var v = r[k];
        if (PX_KEYS.indexOf(k) >= 0 && num(v) > 0) n[k] = Math.round(v * rt * 1e6) / 1e6;
        else n[k] = v;
      }
      out[i] = n;
    }
    return out;
  }

  /* pack: { rows, source?, feed? }. Returns a NEW pack when it was measured,
     the same pack otherwise. Never mutates the input rows. */
  function hgGoldIuxShiftPack(pack, anchor){
    if (!pack || typeof pack !== 'object' || !Array.isArray(pack.rows) || !pack.rows.length) return pack;
    if (pack.iux) return pack;
    var feed = (typeof pack.feed === 'string' && pack.feed) ? pack.feed
             : ((typeof pack.source === 'string' && pack.source) ? pack.source : null);
    if (!feed) return pack;
    var at = Date.now();
    if (isBrokerFeed(feed)){
      state.byFeed[feed] = { feed: feed, measured: false, shifted: false, why: 'broker', at: at };
      return pack;
    }
    var ap = anchor ? num(anchor.px) : NaN;
    if (!(ap > 0)) return pack;
    var last = hgGoldIuxLastClose(pack.rows);
    var r = hgGoldIuxRatio(last, ap);
    if (!r) return pack;
    state.byFeed[feed] = { feed: feed, measured: true, shifted: r.shift, pct: r.pct, ratio: r.ratio,
                           why: r.why, anchor: ap, feedLast: last, at: at };
    var out = {};
    for (var k in pack) if (Object.prototype.hasOwnProperty.call(pack, k)) out[k] = pack[k];
    out.rows = r.shift ? hgGoldIuxShiftRows(pack.rows, r.ratio) : pack.rows;
    out.iux = { anchor: ap, feedLast: last, ratio: r.ratio, pct: r.pct, shifted: r.shift, why: r.why, src: anchor.src || 'gold-api', at: at };
    return out;
  }

  function hgGoldIuxApply(pack, opts){
    try{
      if (!pack || !Array.isArray(pack.rows) || !pack.rows.length || pack.iux) return Promise.resolve(pack);
      var feed = (typeof pack.feed === 'string' && pack.feed) ? pack.feed
               : ((typeof pack.source === 'string' && pack.source) ? pack.source : null);
      if (!feed) return Promise.resolve(pack);
      if (isBrokerFeed(feed)) return Promise.resolve(hgGoldIuxShiftPack(pack, null));
      return hgGoldIuxAnchor(opts).then(function(a){
        return hgGoldIuxShiftPack(pack, a);
      }).catch(function(){ return pack; });
    }catch(e){ return Promise.resolve(pack); }
  }

  /* Rows-shaped convenience for the direct PAXG fallbacks: rows in, rows out. */
  function hgGoldIuxApplyRows(rows, feed, opts){
    if (!Array.isArray(rows) || !rows.length) return Promise.resolve(rows);
    return hgGoldIuxApply({ rows: rows, source: feed }, opts).then(function(p){
      return (p && Array.isArray(p.rows) && p.rows.length) ? p.rows : rows;
    }).catch(function(){ return rows; });
  }

  /* The percent a feed's bars were moved by at its last fetch: the number
     when the feed was measured (0 when it sat on the anchor or beyond the
     window), ABSENT for a broker feed or one never measured. */
  function hgGoldIuxShiftOf(feed){
    var st = state.byFeed[String(feed || '')];
    if (!st || !st.measured) return undefined;
    return st.shifted ? Math.round(st.pct * 1e4) / 1e4 : 0;
  }

  function hgGoldIuxState(){
    var out = { anchor: hgGoldIuxAnchorCached(), byFeed: {} };
    for (var k in state.byFeed){
      if (!Object.prototype.hasOwnProperty.call(state.byFeed, k)) continue;
      var s = state.byFeed[k], c = {};
      for (var j in s) if (Object.prototype.hasOwnProperty.call(s, j)) c[j] = s[j];
      out.byFeed[k] = c;
    }
    return out;
  }

  function hgGoldIuxFeedLabel(feed, base){
    var b = (base === undefined || base === null) ? String(feed || '') : String(base);
    var st = state.byFeed[String(feed || '')];
    if (st && st.measured && st.shifted) return b + ' → IUX';
    return b;
  }

  function fmtPct(p){ return (p >= 0 ? '+' : '') + p.toFixed(2) + '%'; }

  /* One short line for a status chip / a card. '' when nothing is known. */
  function hgGoldIuxLine(feed){
    var a = hgGoldIuxAnchorCached();
    if (!a) return '';
    var st = feed ? state.byFeed[String(feed)] : null;
    var head = 'IUX anchor ~$' + a.px.toFixed(2) + ' (gold-api spot)';
    if (!st) return head;
    if (!st.measured) return head + ' · ' + st.feed + ' is the broker feed, not anchored';
    if (st.shifted) return head + ' · ' + st.feed + ' moved ' + fmtPct(st.pct) + ' onto it';
    if (st.why === 'out-of-window') return head + ' · ' + st.feed + ' sits ' + fmtPct(st.pct) + ' off it — outside the ' + MAX_PCT + '% window, NOT anchored';
    return head + ' · ' + st.feed + ' on the anchor (' + fmtPct(st.pct) + ')';
  }

  function hgGoldIuxChipHtml(feed){
    var line = hgGoldIuxLine(feed);
    if (!line) return '';
    return ' <span style="color:var(--gold)" title="' + line.replace(/"/g, '&quot;') + '">→ IUX ~$'
      + hgGoldIuxAnchorCached().px.toFixed(2) + '</span>';
  }

  /* test seam */
  function hgGoldIuxReset(){ state.anchor = null; state.byFeed = {}; inflight = null; }

  G.HG_GOLD_IUX_MIN_PCT = MIN_PCT;
  G.HG_GOLD_IUX_MAX_PCT = MAX_PCT;
  G.HG_GOLD_IUX_BROKER_FEEDS = BROKER_FEEDS.slice();
  G.HG_GOLD_IUX_ANCHOR_URL = ANCHOR_URL;
  G.hgGoldIuxAnchor = hgGoldIuxAnchor;
  G.hgGoldIuxAnchorCached = hgGoldIuxAnchorCached;
  G.hgGoldIuxLastClose = hgGoldIuxLastClose;
  G.hgGoldIuxRatio = hgGoldIuxRatio;
  G.hgGoldIuxShiftRows = hgGoldIuxShiftRows;
  G.hgGoldIuxShiftPack = hgGoldIuxShiftPack;
  G.hgGoldIuxApply = hgGoldIuxApply;
  G.hgGoldIuxApplyRows = hgGoldIuxApplyRows;
  G.hgGoldIuxShiftOf = hgGoldIuxShiftOf;
  G.hgGoldIuxState = hgGoldIuxState;
  G.hgGoldIuxFeedLabel = hgGoldIuxFeedLabel;
  G.hgGoldIuxLine = hgGoldIuxLine;
  G.hgGoldIuxChipHtml = hgGoldIuxChipHtml;
  G.hgGoldIuxReset = hgGoldIuxReset;
})();
