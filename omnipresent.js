/* HARDGATE — OMNIPRESENT: the anticipation desk.

   THE ASK: "I should be the first to know that the contract will go down
   from a particular high and will go up from a particular bottom."

   THE HONEST VERSION OF THAT: nobody knows a top before the market does —
   but the LEVELS where reversals have structural odds are computable in
   advance, and the reader can hold them before price arrives. That is what
   this desk does. For every contract it builds the nearest REVERSAL ZONE
   above and below the market from independent level sources — prior swing
   highs/lows, prior-day extremes, Donchian channel edges, the volume
   profile's value area, round numbers, anchored-VWAP bands — and clusters
   them: three or more sources agreeing within a third of an ATR is a level
   the whole market can see, which is exactly what makes it tradeable
   (liquidity rests there; sweeps and rejections happen there).

   Each zone is then read for EXHAUSTION EVIDENCE as price approaches:
   RSI divergence at the extreme, a volume climax bar, price stretched
   multiple ATRs from its mean, a squeeze that has just released. These are
   the classical, publicly documented reversal reads — Wyckoff's springs
   and upthrusts, the liquidity-sweep entry, divergence-at-extremes — not a
   private oracle, and this desk does not pretend otherwise.

   LIFECYCLE — the whole point is to be early, honestly:

     ARMED      the zone is near but untouched. The card shows the exact
                level band, the tight structural stop beyond it, the wide
                targets, the trigger rule, and WHEN the trigger can fire
                (bar closes, listed in UTC and IST). The reader holds the
                level before the market gets there. ARMED is WATCH, never
                a TICKET — there is no trade until the 1h close rejects.
     TRIGGERED  the zone was swept and the last closed bar closed back
                through it — the classical rejection. Entry is the LIVE
                price, now, and the plan is forward-logged. TICKET only
                after 3+ sources, 2+ exhaustion reads, a daily stack that
                does not fight the fade, and (if ADX is running) RSI
                divergence.

   STOP: beyond the zone extreme plus 0.3xATR — squeezed, because the zone
   IS the invalidation: if price accepts beyond it, the idea is dead and no
   wider stop changes that. TARGETS: T1 = 2R (the banker — and the leg the
   forward log measures, so the record stays comparable); T2 = the opposite
   zone or 5R, whichever is further, capped 10R — deliberately BIG, because
   a rejection at a universe-visible level travels, and the tight stop is
   what makes a 5-10R runner arithmetically honest rather than greedy.

   EVERY claim is gated: a fade against a running ADX trend with no climax
   and no divergence is vetoed (a fade wants a stretched tape, not a
   running one); fewer than three level sources is not a zone; fewer than
   two evidences is a level, not a setup; a stop the market already
   crossed is dead on arrival; the shared context bank (20 reads as of
   bank two) grades every candidate, and an adverse third of the panel
   stands it aside. Verdicts come from the same
   hgOmniGrade every ledger desk uses, and every TRIGGERED plan is
   forward-logged under OMNIPRESENT — the pool that will say, in R, whether
   this desk earns anything. Anticipation, not prophecy.

   Closed candles only (hgOmniDropForming at ingestion; the forming close
   is retained as the live price). Classic script, no build step. */
(function () {
  'use strict';
  var W = (typeof window !== 'undefined') ? window : this;

  function gfn(name){ return (W && typeof W[name] === 'function') ? W[name] : null; }
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }
  function last(a){ return (a && a.length) ? a[a.length - 1] : undefined; }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pxF(n){ var v = fin(n); return isFinite(v) ? (v >= 100 ? v.toFixed(2) : v.toFixed(4)) : '—'; }

  var OMNI_TOP = 48;        // contracts scanned (universe order = venue turnover order)
  var TF = '1h';            // near-future = hours, not days
  var BARS = 400;
  var CHUNK = 4;            // gentle on the venue legs, same as omniroute pass 1
  var CHUNK_DELAY = 80;
  var SHOW = 6;             // "only the most probable" — the ranked head, not the pile
  var ZONE_TOL_ATR = 0.35;  // level sources within this agree on one zone
  var ARM_MAX_ATR = 3.0;    // a zone further than this is not "near future"
  var STOP_PAD_ATR = 0.30;  // squeezed structural stop beyond the zone extreme
  var MIN_RR = 1.8;
  var T2_FLOOR_R = 5;       // the runner starts at 5R — the squeezed stop is what buys this
  var T2_CAP_R = 10;        // and stretches to the opposite zone, up to 10R

  var __op = { busy: false, ran: false, ui: null, lastStat: null, snap: null };

  function opSleep(ms){ return new Promise(function (res){ setTimeout(res, ms); }); }

  /* ==================== pure: pivots and level sources ==================== */

  /* Sanitise first — every exported read must survive feed-shaped garbage
     STANDALONE. A venue that drops one candle returns an array with an
     undefined in it, and the first sweep of this module (2026-08 fuzz)
     found five functions that walked straight into that hole. One guard
     per entry point beats five defensive checks per loop — the same
     lesson hgOmniDropForming's sanitiser recorded for the crypto scan. */
  function opClean(rows){
    if (!Array.isArray(rows)) return [];
    var out = [], i, r;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      if (r && typeof r === 'object' && isFinite(fin(r.c))) out.push(r);
    }
    return out;
  }

  /* Fractal pivots, k bars each side. The last k bars cannot confirm a
     pivot yet — that is not a defect, it is what "confirmed" means. */
  function opPivots(rows, k){
    k = k || 3;
    rows = opClean(rows);
    var hi = [], lo = [], i, j, isH, isL;
    if (rows.length < k * 2 + 1) return { hi: hi, lo: lo };
    for (i = k; i < rows.length - k; i++){
      isH = true; isL = true;
      for (j = 1; j <= k; j++){
        if (!(fin(rows[i].h) > fin(rows[i - j].h)) || !(fin(rows[i].h) > fin(rows[i + j].h))) isH = false;
        if (!(fin(rows[i].l) < fin(rows[i - j].l)) || !(fin(rows[i].l) < fin(rows[i + j].l))) isL = false;
        if (!isH && !isL) break;
      }
      if (isH) hi.push({ i: i, px: fin(rows[i].h) });
      if (isL) lo.push({ i: i, px: fin(rows[i].l) });
    }
    return { hi: hi, lo: lo };
  }

  /* Round-number step scaled to price magnitude — the levels resting
     orders actually cluster on. */
  function opRoundStep(px){
    if (!(px > 0)) return NaN;
    var mag = Math.pow(10, Math.floor(Math.log(px) / Math.LN10));
    return mag / 10;   /* 4,500 -> 100s; 85 -> 1s; 0.42 -> 0.01s */
  }

  /* Every independent place a level can come from, labeled by source.
     Returns { above:[{px,src}], below:[{px,src}] } relative to livePx. */
  function opLevelSources(rows, livePx){
    var out = { above: [], below: [] };
    rows = opClean(rows);
    livePx = fin(livePx);
    if (rows.length < 60 || !(livePx > 0)) return out;
    var i, px;
    function put(p, src){
      p = fin(p);
      if (!isFinite(p) || p <= 0) return;
      if (p > livePx) out.above.push({ px: p, src: src });
      else if (p < livePx) out.below.push({ px: p, src: src });
    }

    var piv = opPivots(rows.slice(-160), 3);
    for (i = Math.max(0, piv.hi.length - 4); i < piv.hi.length; i++) put(piv.hi[i].px, 'swing high');
    for (i = Math.max(0, piv.lo.length - 4); i < piv.lo.length; i++) put(piv.lo[i].px, 'swing low');

    /* prior day extremes off the last 48 closed hours */
    var d = rows.slice(-48, -24);
    if (d.length >= 12){
      var dh = -Infinity, dl = Infinity;
      for (i = 0; i < d.length; i++){ dh = Math.max(dh, fin(d[i].h)); dl = Math.min(dl, fin(d[i].l)); }
      if (isFinite(dh)) put(dh, 'prior-day high');
      if (isFinite(dl)) put(dl, 'prior-day low');
    }

    var donFn = gfn('donchian');
    if (donFn){
      try{
        var don = donFn(rows, 20), dn = rows.length - 1;
        if (don && don.upper && isFinite(fin(don.upper[dn]))) put(don.upper[dn], 'Donchian 20 high');
        if (don && don.lower && isFinite(fin(don.lower[dn]))) put(don.lower[dn], 'Donchian 20 low');
      }catch(e){}
    }

    var vpFn = gfn('volumeProfile');
    if (vpFn){
      try{
        var vp = vpFn(rows, 120, 24);
        if (vp){
          /* value-area EDGES are where rejections happen; the POC is a
             magnet price gets PULLED to — the opposite of a reversal level,
             so it stays off this list. */
          if (isFinite(fin(vp.vah)) && fin(vp.vah) > livePx) put(vp.vah, 'value-area high');
          if (isFinite(fin(vp.val)) && fin(vp.val) < livePx) put(vp.val, 'value-area low');
        }
      }catch(e){}
    }

    var step = opRoundStep(livePx);
    if (isFinite(step) && step > 0){
      put(Math.ceil(livePx / step) * step, 'round number');
      put(Math.floor(livePx / step) * step, 'round number');
    }

    var avFn = gfn('hgAVWAP');
    if (avFn){
      try{
        var av = avFn(rows, Math.max(0, rows.length - 24));
        /* each band only on its NATURAL side: a lower band sitting above
           the market is a math artifact of the anchor, not resistance */
        if (av && isFinite(fin(av.upper)) && fin(av.upper) > livePx) put(av.upper, 'AVWAP +2σ');
        if (av && isFinite(fin(av.lower)) && fin(av.lower) < livePx) put(av.lower, 'AVWAP −2σ');
      }catch(e){}
    }
    return out;
  }

  /* Cluster one side's levels into zones; a zone is levels agreeing within
     ZONE_TOL_ATR. Returns the NEAREST zone to the market on that side, or
     null — anticipating means the next level, not every level. */
  function opZones(levels, atr, livePx, side){
    if (!Array.isArray(levels) || !(atr > 0)) return null;
    /* a null level entry is not a level */
    levels = levels.filter(function (L){ return L && isFinite(fin(L.px)); });
    if (!levels.length) return null;
    var sorted = levels.slice().sort(function (a, b){ return a.px - b.px; });
    var zones = [], cur = null, i, L;
    for (i = 0; i < sorted.length; i++){
      L = sorted[i];
      if (cur && (L.px - cur.hi) <= ZONE_TOL_ATR * atr){
        cur.hi = Math.max(cur.hi, L.px);
        cur.srcs.push(L.src);
      } else {
        if (cur) zones.push(cur);
        cur = { lo: L.px, hi: L.px, srcs: [L.src] };
      }
    }
    if (cur) zones.push(cur);
    for (i = 0; i < zones.length; i++){
      var uniq = {}; zones[i].srcs.forEach(function (s){ uniq[s] = true; });
      zones[i].srcs = Object.keys(uniq);
      zones[i].confluence = zones[i].srcs.length;
      zones[i].mid = (zones[i].lo + zones[i].hi) / 2;
      zones[i].distAtr = Math.abs(((side === 'above') ? zones[i].lo : zones[i].hi) - livePx) / atr;
    }
    zones = zones.filter(function (z){ return z.confluence >= 2; });
    if (!zones.length) return null;
    zones.sort(function (a, b){ return a.distAtr - b.distAtr; });
    return zones;
  }

  /* ==================== pure: exhaustion evidence ==================== */

  /* What is actually true on the tape as price approaches the zone. Each
     item is independent and named; the count is the score's honest core. */
  function opEvidence(rows, dir, livePx){
    var ev = [];
    rows = opClean(rows);
    if (rows.length < 60) return ev;
    var n = rows.length - 1;
    var closes = rows.map(function (r){ return fin(r.c); });
    var atrFn = gfn('atr'), emaFn = gfn('ema'), rsiFn = gfn('rsi'), vzFn = gfn('volZ'), sqFn = gfn('ttmSqueeze');
    var a = NaN;
    if (atrFn){ try{ var aa = atrFn(rows, 14); a = fin(aa[n]); }catch(e){} }

    if (emaFn && isFinite(a) && a > 0){
      try{
        var e21 = fin(emaFn(closes, 21)[n]);
        var stretch = (livePx - e21) / a;
        if (dir === 'short' && stretch >= 1.5) ev.push('stretched +' + stretch.toFixed(1) + 'xATR above EMA21 — rubber band');
        if (dir === 'long' && stretch <= -1.5) ev.push('stretched ' + stretch.toFixed(1) + 'xATR below EMA21 — rubber band');
      }catch(e){}
    }

    if (rsiFn){
      try{
        var rs = rsiFn(closes, 14);
        var piv = opPivots(rows.slice(-120), 3), off = rows.length - Math.min(rows.length, 120);
        if (dir === 'short' && piv.hi.length >= 2){
          var h1 = piv.hi[piv.hi.length - 2], h2 = piv.hi[piv.hi.length - 1];
          if (h2.px > h1.px && fin(rs[off + h2.i]) < fin(rs[off + h1.i]) - 1)
            ev.push('bearish RSI divergence — higher high in price, lower high in RSI');
        }
        if (dir === 'long' && piv.lo.length >= 2){
          var l1 = piv.lo[piv.lo.length - 2], l2 = piv.lo[piv.lo.length - 1];
          if (l2.px < l1.px && fin(rs[off + l2.i]) > fin(rs[off + l1.i]) + 1)
            ev.push('bullish RSI divergence — lower low in price, higher low in RSI');
        }
      }catch(e){}
    }

    if (vzFn){
      try{
        var vz = fin(vzFn(rows, 20));
        if (isFinite(vz) && vz >= 2) ev.push('volume climax — ' + vz.toFixed(1) + 'σ participation on the approach');
      }catch(e){}
    }

    if (sqFn){
      try{
        var sq = sqFn(rows);
        if (sq && sq.fired && sq.fired[n]) ev.push('squeeze released this bar — energy just left the coil');
      }catch(e){}
    }
    return ev;
  }

  /* ==================== pure: assessment per contract ==================== */

  /* rows are CLOSED bars; livePx is the forming close captured before the
     drop. Returns candidates (0-2: one per side), each ARMED or TRIGGERED. */
  /* extraLevels ({above:[{px,src}], below:[{px,src}]}) lets a desk add the
     levels only IT knows about — the gold tab feeds ADR bands, the Asia
     range and the prior week here. They join the cluster on equal terms:
     an extra source is one more voice at a zone, never a zone by itself. */
  function opAssess(rows, livePx, extraLevels){
    var out = [];
    rows = opClean(rows);
    livePx = fin(livePx);
    if (rows.length < 120 || !(livePx > 0)) return out;
    var atrFn = gfn('atr');
    if (!atrFn) return out;
    var n = rows.length - 1, a = NaN;
    try{ a = fin(atrFn(rows, 14)[n]); }catch(e){}
    if (!(a > 0)) return out;

    var src = opLevelSources(rows, livePx);
    if (extraLevels){
      var xs2 = ['above', 'below'], xi, xj, XL;
      for (xi = 0; xi < 2; xi++){
        if (!Array.isArray(extraLevels[xs2[xi]])) continue;
        for (xj = 0; xj < extraLevels[xs2[xi]].length; xj++){
          XL = extraLevels[xs2[xi]][xj];
          if (XL && isFinite(fin(XL.px)) && fin(XL.px) > 0)
            src[xs2[xi]].push({ px: fin(XL.px), src: String(XL.src || 'desk level') });
        }
      }
    }
    var sides = [
      { dir: 'short', zones: opZones(src.above, a, livePx, 'above') || [] },
      { dir: 'long',  zones: opZones(src.below, a, livePx, 'below') || [] }
    ];

    for (var s = 0; s < sides.length; s++){
      var dir = sides[s].dir;
      /* Pick the nearest zone that is a real anticipation target: either
         genuinely AHEAD of the market (>= 0.5 ATR — a zone price is already
         sitting inside is where the market is, not where it turns) or
         freshly swept-and-rejected (the trigger just happened). */
      var z = null, status = null, zi, cand2, tagged, closedBack, i, r;
      for (zi = 0; zi < sides[s].zones.length; zi++){
        cand2 = sides[s].zones[zi];
        if (cand2.distAtr > ARM_MAX_ATR) break;
        tagged = false; closedBack = false;
        for (i = Math.max(0, n - 2); i <= n; i++){
          r = rows[i];
          if (dir === 'short' && fin(r.h) >= cand2.lo){ tagged = true; if (fin(r.c) < cand2.lo) closedBack = true; }
          if (dir === 'long' && fin(r.l) <= cand2.hi){ tagged = true; if (fin(r.c) > cand2.hi) closedBack = true; }
        }
        if (tagged && closedBack){ z = cand2; status = 'TRIGGERED'; break; }
        if (!tagged && cand2.distAtr >= 0.5){ z = cand2; status = 'ARMED'; break; }
        /* tagged without rejection, or too close: price is negotiating this
           zone right now — no anticipation edge either way; look further. */
      }
      if (!z) continue;

      /* levels: triggered enters at the LIVE price, armed rests at the zone
         edge; the stop is beyond the zone extreme either way — the zone IS
         the invalidation, which is what keeps it squeezed. */
      var entry = (status === 'TRIGGERED') ? livePx : ((dir === 'short') ? z.lo : z.hi);
      var stop = (dir === 'short') ? z.hi + STOP_PAD_ATR * a : z.lo - STOP_PAD_ATR * a;
      var risk = Math.abs(entry - stop);
      if (!(risk > 0)) continue;
      var t1 = (dir === 'short') ? entry - 2 * risk : entry + 2 * risk;
      /* the opposite side's zones were selected for the OTHER direction's
         entry; for the runner target we want the FAR one in reach */
      var oppList = sides[s === 0 ? 1 : 0].zones || [];
      var t2r = T2_FLOOR_R, oi2;
      for (oi2 = 0; oi2 < oppList.length; oi2++){
        if (oppList[oi2].distAtr > ARM_MAX_ATR) break;
        var oppEdge = (dir === 'short') ? oppList[oi2].hi : oppList[oi2].lo;
        var rr = Math.abs(oppEdge - entry) / risk;
        if (rr > t2r) t2r = Math.min(T2_CAP_R, rr);
      }
      var t2 = (dir === 'short') ? entry - t2r * risk : entry + t2r * risk;

      out.push({
        dir: dir, status: status, zone: z, entry: entry, stop: stop, t1: t1, t2: t2,
        risk: risk, rr1: 2, rr2: t2r, atr: a,
        evidence: opEvidence(rows, dir, livePx),
        trigger: (dir === 'short')
          ? '1h bar tags ' + pxF(z.lo) + '–' + pxF(z.hi) + ' and CLOSES back below ' + pxF(z.lo)
          : '1h bar tags ' + pxF(z.hi) + '–' + pxF(z.lo) + ' and CLOSES back above ' + pxF(z.hi),
        score: z.confluence * 10 + opEvidence.length /* placeholder, set below */
      });
      var c = out[out.length - 1];
      c.score = c.zone.confluence * 10 + c.evidence.length * 6
              + (status === 'TRIGGERED' ? 8 : 0)
              + Math.max(0, 3 - c.zone.distAtr);   /* nearer = sooner = more relevant */
    }
    return out;
  }

  /* Daily closes from a 1h tape — the "shorts in a rally" read. Need ~12
     sessions so EMA8 vs EMA13 is defined; fewer → UNCHECKED, never a pass. */
  function opHtfDaily(rows){
    rows = opClean(rows);
    if (rows.length < 80) return null;
    var lastByDay = {}, i, t, day, closes, emaFn, eFast, eSlow, a, b;
    for (i = 0; i < rows.length; i++){
      t = fin(rows[i].t);
      if (!isFinite(t)) continue;
      if (t > 1e12) t = Math.floor(t / 1000);
      day = Math.floor(t / 86400);
      lastByDay[day] = fin(rows[i].c);
    }
    closes = Object.keys(lastByDay).sort(function (x, y){ return +x - +y; })
      .map(function (d){ return lastByDay[d]; })
      .filter(function (c){ return isFinite(c); });
    if (closes.length < 12) return null;
    emaFn = gfn('ema');
    if (!emaFn) return null;
    try{
      eFast = emaFn(closes, 8);
      eSlow = emaFn(closes, 13);
      a = fin(eFast[eFast.length - 1]);
      b = fin(eSlow[eSlow.length - 1]);
    }catch(e){ return null; }
    if (!isFinite(a) || !isFinite(b)) return null;
    return { up: a >= b, e8: a, e13: b, n: closes.length };
  }

  /* ==================== pure: the ledger ==================== */

  function opGates(rows, cand, livePx, sym){
    var gates = [];
    cand = cand || {};
    /* a candidate with no evidence ARRAY is a candidate with no evidence */
    if (!Array.isArray(cand.evidence)) cand.evidence = [];
    var z = cand.zone || { lo: NaN, hi: NaN, confluence: 0, srcs: [] };
    var dir = cand.dir;

    /* A fade against a RUNNING trend needs DIVERGENCE, not mere stretch.
       Stretch + climax fire inside the trend itself — that is how gold and
       crypto fades die. RSI divergence is the exhaustion that can actually
       turn a running tape. */
    var adxFn = gfn('adx');
    var hasDiv = cand.evidence.some(function (s){ return /divergence/i.test(String(s)); });
    if (adxFn && rows && rows.length > 40){
      try{
        var ax = adxFn(rows, 14), n2 = rows.length - 1;
        var adxNow = fin(ax.adx[n2]), diP = fin(ax.plusDI ? ax.plusDI[n2] : ax.pdi && ax.pdi[n2]), diM = fin(ax.minusDI ? ax.minusDI[n2] : ax.mdi && ax.mdi[n2]);
        var runningAgainst = isFinite(adxNow) && adxNow >= 25
          && ((dir === 'short' && diP > diM) || (dir === 'long' && diM > diP));
        if (runningAgainst && !hasDiv){
          gates.push({ key: 'trend-guard', hard: true, pass: false,
            why: 'fading a RUNNING trend (ADX ' + adxNow.toFixed(0) + ' with DI against) without RSI divergence — stretch is the trend, not exhaustion' });
        } else {
          gates.push({ key: 'trend-guard', hard: true, pass: true,
            why: runningAgainst ? 'trend runs against this fade, but RSI divergence argues the tape is done'
                                : 'no running trend stands against this direction' });
        }
      }catch(e){ gates.push({ key: 'trend-guard', hard: true, pass: null, why: 'ADX threw: ' + (e && e.message) }); }
    } else gates.push({ key: 'trend-guard', hard: true, pass: null, why: 'ADX unavailable — trend read UNCHECKED' });

    /* 3+ sources is a ZONE — the header already said so. Two voices is a
       coincidence, and coincidences used to TICKET as AGAINST. */
    gates.push(z.confluence >= 3
      ? { key: 'confluence', hard: true, pass: true, why: z.confluence + ' independent level sources agree here: ' + z.srcs.join(', ') }
      : { key: 'confluence', hard: true, pass: false, why: 'only ' + z.confluence + ' level sources (' + z.srcs.join(', ') + ') — not a zone (need 3+)' });

    /* Two exhaustion reads is a setup. One is a level with a hint. Zero is
       just a line on the chart. All three used to be able to TICKET except
       zero; the one-read AGAINST note was the live leak. */
    gates.push(cand.evidence.length >= 2
      ? { key: 'exhaustion', hard: true, pass: true, why: cand.evidence.length + ' independent exhaustion reads' }
      : { key: 'exhaustion', hard: true, pass: false,
          why: cand.evidence.length === 1
            ? 'one exhaustion read only — a level, not a setup'
            : 'no exhaustion evidence at all — this is a level, not a setup' });

    /* dead-on-arrival: the market already beyond the stop */
    var dead = (dir === 'short') ? (livePx >= cand.stop) : (livePx <= cand.stop);
    gates.push(dead
      ? { key: 'level-fresh', hard: true, pass: false, why: 'DEAD ON ARRIVAL — market (' + pxF(livePx) + ') is already beyond the stop (' + pxF(cand.stop) + ')' }
      : { key: 'level-fresh', hard: true, pass: true, why: 'market ' + pxF(livePx) + ', ' + (Math.abs(livePx - cand.entry) / cand.atr).toFixed(1) + 'xATR from the entry' });

    /* fin() first: an absent rr1 must read UNCHECKED, not throw building
       its own why-string (undefined.toFixed — caught by the fuzz pin) */
    var rr1n = fin(cand.rr1);
    gates.push(!isFinite(rr1n)
      ? { key: 'min-rr', hard: true, pass: null, why: 'no R:R supplied — UNCHECKED' }
      : (rr1n >= MIN_RR
        ? { key: 'min-rr', hard: true, pass: true, why: 'T1 pays ' + rr1n.toFixed(1) + 'R off the squeezed stop' }
        : { key: 'min-rr', hard: true, pass: false, why: 'T1 pays only ' + rr1n.toFixed(1) + 'R — under the ' + MIN_RR + 'R floor' }));

    var newsFn = gfn('hgNewsRisk');
    if (newsFn){
      try{
        var nw = newsFn(sym);
        if (nw && nw.blackout) gates.push({ key: 'news-window', hard: true, pass: false, why: String(nw.note || 'inside a high-impact news blackout') });
        else gates.push({ key: 'news-window', hard: true, pass: true, why: (nw && nw.note) ? String(nw.note) : 'no blackout in the window' });
      }catch(e){ gates.push({ key: 'news-window', hard: true, pass: null, why: 'news read threw' }); }
    } else gates.push({ key: 'news-window', hard: false, pass: null, why: 'news module not loaded — UNCHECKED' });

    var cxFn = gfn('hgContextRead');
    if (cxFn){
      var cx = cxFn(rows, dir, 'omnipresent', true);
      if (cx){
        /* The header promised an adverse third of the panel stands the
           trade aside. info:true made that a note that still TICKETED. */
        if (cx.adverse){
          gates.push({ key: 'context-gates', hard: false, pass: false,
            why: cx.read + ' — a third of the panel objects; this fade stands aside' });
        } else {
          gates.push({ key: 'context-gates', hard: false, info: true, pass: true, why: cx.read });
        }
        cand.contextGates = cx.gates;
      } else gates.push({ key: 'context-gates', hard: false, pass: null, why: 'context read unavailable on this tape' });
    } else gates.push({ key: 'context-gates', hard: false, pass: null, why: 'hg-gates.js not loaded — UNCHECKED' });

    /* REJECTION — ARMED is anticipation. TICKET means enter now. A hard
       UNCHECKED on ARMED grades WATCH (blocks the ticket, is not a veto). */
    gates.push(cand.status === 'TRIGGERED'
      ? { key: 'rejection', hard: true, pass: true, why: '1h close rejected the zone — entry is live' }
      : { key: 'rejection', hard: true, pass: null,
          why: 'ARMED — the zone is not yet swept; there is no trade to take until the 1h close rejects' });

    /* Daily stack: fading a higher-timeframe rally is how these shorts die. */
    var htf = opHtfDaily(rows);
    if (!htf){
      gates.push({ key: 'htf-daily', hard: false, pass: null, why: 'not enough daily closes to judge the higher timeframe' });
    } else {
      var htfAgainst = (dir === 'short' && htf.up) || (dir === 'long' && !htf.up);
      gates.push({ key: 'htf-daily', hard: false, pass: htfAgainst ? false : true,
        why: htfAgainst
          ? ('daily EMA stack is ' + (htf.up ? 'UP' : 'DOWN') + ' — fading a higher-timeframe '
            + (htf.up ? 'rally' : 'selloff'))
          : ('daily EMA stack ' + (htf.up ? 'UP' : 'DOWN') + ' does not fight this fade') });
    }

    /* This desk's own settled record. Same bar as OMNIGOLD: 20+ samples
       with negative expectancy (or −2σ vs breakeven) VETOES. */
    var mech = 'OP-' + (dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT');
    var ed = null, edWhy = 'no settled OMNIPRESENT record yet — not judged';
    var fwdFn = gfn('hgFwdStats');
    if (fwdFn){
      try{
        var st = fwdFn('OMNIPRESENT', mech, true);
        var sN = st ? fin(st.samples) : NaN;
        var sHit = st ? fin(st.hit) : NaN;
        var sExp = st ? fin(st.expR) : NaN;
        if (isFinite(sN) && sN >= 20 && isFinite(sHit) && isFinite(sExp)){
          var pBreak = 1 / (1 + MIN_RR);
          var se = Math.sqrt(pBreak * (1 - pBreak) / sN);
          var zsc = se > 0 ? ((sHit - pBreak) / se) : 0;
          var stat = sN + ' samples · ' + (sHit * 100).toFixed(0) + '% · '
                   + (sExp >= 0 ? '+' : '') + sExp.toFixed(2) + 'R ['
                   + (zsc >= 0 ? '+' : '') + zsc.toFixed(2) + 'σ vs breakeven]';
          if (sExp < 0 || zsc <= -2){
            ed = false;
            edWhy = stat + ' — significantly below breakeven, this mechanic has not paid';
          } else {
            ed = true;
            edWhy = stat;
          }
        } else if (isFinite(sN) && sN > 0 && sN < 20){
          edWhy = 'only ' + sN + ' settled samples — too few to judge';
        }
      }catch(eEd){ edWhy = 'forward stats threw'; }
    }
    gates.push({ key: 'measured-edge', hard: false, pass: ed, why: edWhy });

    return gates;
  }

  /* Shown head: tickets first (already sorted), then ARMED watches that
     the ledger did not veto. Vetoed junk does not occupy the "most
     probable" slots unless nothing cleaner exists. */
  function opShowable(c){
    if (!c || !c.grade) return false;
    if (c.grade.ticket) return true;
    if (c.grade.vetoes && c.grade.vetoes.length) return false;
    return c.status === 'ARMED';
  }

  /* Next K hourly bar closes — WHEN a trigger can actually fire. Entries on
     this desk happen at bar closes (that is what "closed back through" means),
     so these times are the honest answer to "the exact time of entry". */
  function opNextCloses(nowMs, k){
    var out = [], i;
    var next = Math.ceil(nowMs / 3600000) * 3600000;
    for (i = 0; i < (k || 3); i++){
      var t = new Date(next + i * 3600000);
      var utc = ('0' + t.getUTCHours()).slice(-2) + ':00';
      var istH = (t.getUTCHours() + 5) % 24, istM = 30;
      out.push(utc + ' UTC (' + ('0' + istH).slice(-2) + ':' + istM + ' IST)');
    }
    return out;
  }

  /* ==================== scan ==================== */

  function opStat(ui, msg){ try{ if (ui && ui.stat) ui.stat.textContent = msg; }catch(e){} }

  function runScan(ui){
    if (__op.busy) return Promise.resolve();
    if (!gfn('xuUniverse') || !gfn('xuCandles')){
      opStat(ui, 'xuniverse.js unavailable — no venue universe, scan disabled.');
      return Promise.resolve();
    }
    __op.busy = true;
    ui.btn.disabled = true;
    ui.cards.innerHTML = '';
    opStat(ui, 'loading universe…');
    var dropFn = gfn('hgOmniDropForming');
    var gradeFn = gfn('hgOmniGrade');

    return Promise.resolve().then(function (){ return W.xuUniverse(); })
      .catch(function (){ return []; })
      .then(function (uni){
        uni = (uni || []).filter(function (u){ return u && (u.exchange === 'delta' || u.exchange === 'coindcx'); });
        if (!uni.length){
          opStat(ui, 'universe empty — both venue legs failed. A data problem, not a quiet market.');
          return null;
        }
        var list = uni.slice(0, OMNI_TOP);
        var found = [], done = 0, failed = 0;

        function step(i){
          if (i >= list.length) return Promise.resolve();
          var slice = list.slice(i, i + CHUNK);
          return Promise.all(slice.map(function (item){
            return Promise.resolve().then(function (){ return W.xuCandles(item, TF, BARS); })
              .then(function (rows){
                done++;
                if (done % 6 === 0 || done === list.length) opStat(ui, 'scanning ' + done + '/' + list.length + ' — ' + found.length + ' zones armed');
                var livePx = (rows && rows.length) ? fin(rows[rows.length - 1].c) : NaN;
                rows = dropFn ? dropFn(rows, TF) : rows;
                if (!rows || rows.length < 120) return;
                if (gfn('hgFwdResolve')){ try{ W.hgFwdResolve(item.sym, null, rows); }catch(e){} }
                var cands = opAssess(rows, livePx);
                for (var c = 0; c < cands.length; c++){
                  cands[c].sym = item.sym; cands[c].base = item.base; cands[c].exchange = item.exchange;
                  cands[c].gates = opGates(rows, cands[c], livePx, item.sym);
                  cands[c].grade = gradeFn ? gradeFn(cands[c].gates)
                    : { ticket: false, vetoes: [], verdict: 'grade engine unavailable' };
                  cands[c].livePx = livePx;
                  found.push(cands[c]);
                }
              })
              .catch(function (){ done++; failed++; });
          })).then(function (){
            if (i + CHUNK >= list.length) return;
            return opSleep(CHUNK_DELAY).then(function (){ return step(i + CHUNK); });
          });
        }

        return step(0).then(function (){
          found.sort(function (a, b){
            var at = a.grade && a.grade.ticket ? 1 : 0, bt = b.grade && b.grade.ticket ? 1 : 0;
            if (at !== bt) return bt - at;
            return b.score - a.score;
          });
          var showable = found.filter(opShowable);
          var top = showable.slice(0, SHOW);
          if (!top.length) top = found.slice(0, Math.min(3, found.length));

          /* forward-log every TRIGGERED plan in the head — the desk's record */
          if (gfn('hgFwdRecordScan')){
            var fwd = top.filter(function (c){ return c.status === 'TRIGGERED'; })
              .map(function (c){ return { sym: c.sym, dir: c.dir, entry: c.entry, stop: c.stop, t1: c.t1,
                                          mechanic: 'OP-' + (c.dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT'),
                                          ticket: !!(c.grade && c.grade.ticket) }; });
            if (fwd.length){ try{ W.hgFwdRecordScan('OMNIPRESENT', TF, fwd, { horizonBars: 24 }); }catch(e){} }
          }
          /* THE WHOLE POINT, DELIVERED: the flip to TRIGGERED reaches the
             reader even when this tab is not on screen — chime + Telegram
             via the alert bell (hgalert.js ZONES class, seeded silently on
             the first scan, keyed per zone so nothing fires twice). The
             verdict rides along honestly: a triggered zone the gates
             vetoed says so in the same push. */
          if (gfn('hgAlertZones')){
            try{
              W.hgAlertZones(found.filter(function (c){ return c.status === 'TRIGGERED'; })
                .map(function (c){
                  return { sym: c.sym, dir: c.dir, tab: 'OMNIPRESENT',
                           zoneLo: c.zone.lo, zoneHi: c.zone.hi,
                           entry: c.entry, stop: c.stop, t1: c.t1, t2: c.t2, rr2: c.rr2,
                           verdict: (c.grade && c.grade.ticket) ? 'TICKET — all gates clear'
                                  : ((c.grade && c.grade.vetoes && c.grade.vetoes.length)
                                      ? 'VETOED by ' + c.grade.vetoes.join(', ')
                                      : 'WATCH — no veto, not a ticket') };
                }), 'OMNIPRESENT');
            }catch(eAz){}
          }
          return { found: found, top: top, scanned: list.length, failed: failed };
        });
      })
      .then(function (res){
        if (!res) return opRefreshSide(ui);
        __op.ran = true;
        __op.snap = { at: Date.now(), rows: res.found };
        var trig = res.top.filter(function (c){ return c.status === 'TRIGGERED'; }).length;
        var tick = res.top.filter(function (c){ return c.grade && c.grade.ticket; }).length;
        __op.lastStat = res.found.length + ' zone(s) across ' + res.scanned + ' contracts · showing top ' + res.top.length
                      + ' · ' + trig + ' triggered · ' + tick + ' ticket(s)'
                      + (res.failed ? ' · ' + res.failed + ' feeds failed' : '');
        opStat(ui, __op.lastStat);
        return opRefreshSide(ui).then(function (sideRead){
          var h = '', closes = opNextCloses(Date.now(), 3);
          h += '<div class="note">Triggers evaluate at 1h bar closes: <b>' + closes.join(' · ') + '</b>'
            + ' — highest-frequency reversal windows: London 07–10 UTC, New York 13–16 UTC.</div>';
          for (var i = 0; i < res.top.length; i++) h += opCard(res.top[i], sideRead);
          ui.cards.innerHTML = h || '<div class="empty">no zone within ' + ARM_MAX_ATR + 'xATR of any market — the detectors are meant to be quiet when nothing is near.</div>';
        });
      })
      .catch(function (e){
        opStat(ui, 'scan failed: ' + ((e && e.message) || e));
      })
      .then(function (){
        __op.busy = false;
        ui.btn.disabled = false;
      });
  }

  /* ==================== render ==================== */

  function opCta(c){
    if (!(c && c.grade && c.grade.ticket)) return '';
    var meta = {
      scanner: 'omnipresent',
      strategy: 'OP-' + (c.dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT'),
      t2: c.t2
    };
    var h = '';
    if (gfn('hgBookStampChip')) h += W.hgBookStampChip(c.sym, c.dir, meta);
    if (gfn('bookBtnHTML')) h += W.bookBtnHTML(c.sym, c.dir, c.entry, c.stop, c.t1, meta);
    if (gfn('hgToTradePlanOnclickAttr'))
      h += '<button class="toTrade" onclick="' + W.hgToTradePlanOnclickAttr(c.sym, c.dir, c.entry, c.stop, c.t1, meta) + '">SEND TO TRADE PLAN →</button>';
    return h ? '<div>' + h + '</div>' : '';
  }

  function opRefreshSide(ui){
    var sideFn = gfn('hgOmniMarketSide');
    var htmlFn = gfn('hgOmniMarketSideHtml');
    var paint = function (){
      if (!sideFn || !htmlFn) return null;
      var pic = null, fng = null;
      try{ pic = W.__hgMarketPicture || null; }catch(e){}
      try{ fng = (W.S && W.S.fng) || null; }catch(e2){}
      var read = sideFn(pic, fng);
      try{ if (ui && ui.side) ui.side.innerHTML = htmlFn(read); }catch(e3){}
      return read;
    };
    try{
      if (W && W.__hgMarketPicture) return Promise.resolve(paint());
      if (W && typeof W.marketPictureCheck === 'function'){
        return Promise.resolve(W.marketPictureCheck()).then(function (r){
          try{ W.__hgMarketPicture = r; }catch(e){}
          return paint();
        }).catch(function (){ return paint(); });
      }
    }catch(e4){}
    return Promise.resolve(paint());
  }

  function opCard(c, sideRead){
    var badge = (c.grade && c.grade.ticket)
      ? '<span class="gpip ok">TICKET</span>'
      : ((c.grade && c.grade.vetoes && c.grade.vetoes.length) ? '<span class="gpip bad">VETO</span>' : '<span class="gpip">WATCH</span>');
    if (sideRead && (sideRead.side === 'long' || sideRead.side === 'short') && c.dir){
      if (String(c.dir).toLowerCase() === sideRead.side) badge += ' <span class="gpip ok">WITH TAPE</span>';
      else badge += ' <span class="gpip bad">AGAINST TAPE</span>';
    }
    var st = (c.status === 'TRIGGERED')
      ? '<span class="gpip ok">TRIGGERED — rejection closed, entry at market</span>'
      : '<span class="gpip">ARMED — level not yet swept, be there first</span>';
    var h = '<div class="card">';
    h += '<div class="ttl">' + esc(c.base || c.sym) + ' · ' + (c.dir === 'short' ? 'SHORT from the high' : 'LONG from the bottom')
       + ' ' + badge + ' ' + st + ' <span class="dim">' + esc(String(c.exchange || '').toUpperCase()) + '</span>'
       + (gfn('hgBookStampChip') ? W.hgBookStampChip(c.sym, c.dir, { scanner: 'omnipresent', strategy: 'OP-' + (c.dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT') }) : '')
       + '</div>';
    h += '<div>ZONE <b>' + pxF(c.zone.lo) + '–' + pxF(c.zone.hi) + '</b> (' + c.zone.confluence + ' sources: '
       + esc(c.zone.srcs.join(', ')) + ') · ' + c.zone.distAtr.toFixed(1) + 'xATR from market ' + pxF(c.livePx) + '</div>';
    h += '<div>ENTRY <b>' + pxF(c.entry) + '</b>' + (c.status === 'TRIGGERED' ? ' (live)' : ' (at the zone)')
       + ' · SL <b>' + pxF(c.stop) + '</b> (squeezed: zone + ' + STOP_PAD_ATR + 'xATR)'
       + ' · TP1 <b>' + pxF(c.t1) + '</b> (2R) · TP2 <b>' + pxF(c.t2) + '</b> (' + c.rr2.toFixed(1) + 'R)</div>';
    h += '<div class="dim">trigger: ' + esc(c.trigger) + '</div>';
    h += opCta(c);
    if (c.evidence.length) h += '<div>evidence: ' + esc(c.evidence.join(' · ')) + '</div>';
    else h += '<div class="dim">no exhaustion evidence yet — the zone is drawn, the tape has not argued for it</div>';
    var g;
    for (var i = 0; i < (c.gates || []).length; i++){
      g = c.gates[i];
      if (!g) continue;
      var mark = g.pass === true ? 'PASS' : (g.pass === false ? (g.info ? 'AGAINST' : 'VETO') : 'UNCHECKED');
      h += '<div class="dim">' + esc(g.key) + ' — ' + mark + ': ' + esc(String(g.why).slice(0, 180)) + '</div>';
    }
    h += '</div>';
    return h;
  }

  function mountOmnipresent(el){
    if (!el) return;
    el.innerHTML =
      '<div class="panel">'
      + '<h2>OMNIPRESENT — the anticipation desk <span>nearest high-confluence reversal zone per contract · tight structural stop · wide targets · triggers at 1h closes</span></h2>'
      + '<div class="note" style="margin-bottom:10px">METHOD — for every contract: cluster the independent levels the whole market can see '
      + '(swing highs/lows, prior-day extremes, Donchian edges, value area, volume POC, round numbers, AVWAP bands); 3+ sources within a third of an ATR is a ZONE. '
      + 'Read exhaustion on the approach (RSI divergence, volume climax, ATR stretch, squeeze release). ARMED = you hold the level before price arrives (WATCH — not a ticket); '
      + 'TRIGGERED = swept and rejected, enter at market. Stop sits just beyond the zone — the zone IS the invalidation, which is why it can stay squeezed. '
      + 'TICKET requires 3+ level sources, 2+ exhaustion reads including a real rejection, a daily stack that does not fight the fade, and a running trend only with RSI divergence. '
      + 'Thin zones, one-read “setups”, and an adverse third of the context panel are vetoes. Every triggered plan is forward-logged under OMNIPRESENT. '
      + '<b>Anticipation, not prophecy</b> — these are the levels where reversals have the best structural odds; the forward pool is the judge.</div>'
      + '<div class="note" id="opStat">idle — press RUN.</div>'
      + '<div class="row" style="margin-top:8px"><button class="btn" id="opRun">RUN OMNIPRESENT SCAN</button></div>'
      + '<div id="opSide"></div>'
      + '<div class="cards" id="opCards" style="margin-top:12px"></div>'
      + '</div>';
    var ui = { btn: el.querySelector('#opRun'), stat: el.querySelector('#opStat'), side: el.querySelector('#opSide'), cards: el.querySelector('#opCards') };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __op.ui = ui;
    var missing = [];
    if (!gfn('xuUniverse')) missing.push('xuUniverse');
    if (!gfn('xuCandles')) missing.push('xuCandles');
    if (!gfn('hgOmniGrade')) missing.push('hgOmniGrade');
    if (missing.length) opStat(ui, 'missing globals: ' + missing.join(', ') + ' — the scan degrades honestly where it can.');
    ui.btn.addEventListener('click', function (){ return runScan(ui); });
    opRefreshSide(ui);
  }

  function refreshOmnipresent(){
    return Promise.resolve().then(function (){
      if (__op.busy) return 'busy';
      if (!__op.ran) return 'skipped: not run yet';
      var ui = __op.ui;
      if (ui) return runScan(ui).then(function (){ return __op.lastStat || 'rescanned'; });
      return __op.lastStat || 'no ui mounted';
    }).catch(function (){ return 'refresh failed'; });
  }

  /* ============================ exports ============================ */
  if (typeof window !== 'undefined'){
    window.opPivots = opPivots;
    window.opRoundStep = opRoundStep;
    window.opLevelSources = opLevelSources;
    window.opZones = opZones;
    window.opEvidence = opEvidence;
    window.opAssess = opAssess;
    window.opGates = opGates;
    window.opShowable = opShowable;
    window.opNextCloses = opNextCloses;
    window.hgOpRunScan = runScan;   /* the scan loop itself, for the stability harness */
    window.hgOpState = function (){ try{ return __op.snap ? JSON.parse(JSON.stringify(__op.snap)) : null; }catch(e){ return null; } };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'omnipresent', label: 'OMNIPRESENT', mount: mountOmnipresent, refresh: refreshOmnipresent });
  }
})();
