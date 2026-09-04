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

  var OMNI_TOP = 0;         // 0 = FULL universe: every delta+coindcx contract xuUniverse
                            // returns, the same coverage promise omniroute makes ("no
                            // top-N cap"). ESCAPE HATCH: window.HG_OP_TOP = N (any
                            // finite N > 0) restores a head cap for users who want the
                            // old faster 48-name scan — documented, read at scan time.
  var TF = '1h';            // near-future = hours, not days
  var BARS = 400;
  var CHUNK = 4;            // gentle on the venue legs, same as omniroute pass 1 (CHUNK=4)
  var CHUNK_DELAY = 80;     // ms between batches — omniroute's CHUNK_DELAY_MS=80 idiom
  var SHOW = 6;             // "only the most probable" — the ranked head, not the pile
  var ZONE_TOL_ATR = 0.35;  // level sources within this agree on one zone
  var ARM_MAX_ATR = 3.0;    // a zone further than this is not "near future"
  var STOP_PAD_ATR = 0.30;  // squeezed structural stop beyond the zone extreme
  var MIN_RR = 1.8;
  var T2_FLOOR_R = 5;       // the runner starts at 5R — the squeezed stop is what buys this
  var T2_CAP_R = 10;        // and stretches to the opposite zone, up to 10R

  var OP_FRESH_MS = 180000;   /* same 3-min skip as omniroute — tab-open / hardRefreshAll must not re-sweep a fresh desk */
  var __op = { busy: false, ran: false, ui: null, lastStat: null, snap: null, lastX20Html: '',
               lastCardsHtml: '',
               /* hg-v540: the ALL view's exact bytes + the inputs behind them,
                  so PAID-ONLY filters a snapshot and ALL restores verbatim. */
               lastAllView: null, lastView: null };

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

  /* Named zone/live levels stay put. Reuses OMNIROUTE's keep-levels wrapper. */
  function opFormCandidate(cand, rows, livePx){
    if (!cand) return cand;
    var formFn = gfn('hgOmniFormTicket');
    if (!formFn){
      cand.formationOk = null;
      cand.formationReason = 'hgOmniFormTicket unavailable — UNCHECKED';
      return cand;
    }
    var plan = {
      dir: cand.dir, entry: cand.entry, stop: cand.stop, t1: cand.t1, t2: cand.t2,
      rr1: cand.rr1, rr2: cand.rr2, risk: cand.risk, sym: cand.sym,
      planSrc: 'omnipresent', kind: cand.status === 'TRIGGERED' ? 'OP-REJECT' : 'OP-ARMED'
    };
    var formed;
    try {
      formed = formFn(plan, { dir: cand.dir, kind: plan.kind }, rows, {
        livePx: livePx, atr: cand.atr, sym: cand.sym, style: 'swing'
      });
    } catch (eF) {
      cand.formationOk = null;
      cand.formationReason = 'formation threw';
      return cand;
    }
    cand.formation = formed;
    if (formed && formed.plan){
      cand.formationScore = formed.plan.formationScore;
      cand.fillProb = formed.plan.fillProb;
      cand.fillNote = formed.plan.fillNote;
      cand.evidenceChips = formed.plan.evidenceChips;
      cand.liveNote = formed.plan.liveNote;
      cand.entryType = formed.plan.entryType;
      cand.t1Source = formed.plan.t1Source;
      cand.formationOk = formed.ok;
      cand.formationReason = formed.reason;
      /* ENTRY stays live (TRIGGERED) or the zone edge (ARMED). Stop stays
         the squeezed zone invalidation (keepLevels skips structure-widen
         on OP-*). T1/T2 may snap to liquidity / value-area. */
      if (isFinite(fin(cand.entry))) formed.plan.entry = cand.entry;
      if (isFinite(fin(formed.plan.t1))){
        cand.t1 = formed.plan.t1;
        if (isFinite(fin(formed.plan.t2))) cand.t2 = formed.plan.t2;
        if (formed.plan.t1Source) cand.t1Source = formed.plan.t1Source;
        if (formed.plan.t2Source) cand.t2Source = formed.plan.t2Source;
        /* Formation can snap T1 past the named T2 (8R first take, 5R
           "runner"). Reorder existing prices — never invent a new level. */
        var orderFn = gfn('hgOrderRunnerTargets');
        if (orderFn){
          var ord = orderFn(cand.dir, cand.entry, cand.t1, cand.t2);
          if (ord){
            if (isFinite(fin(ord.t1))) cand.t1 = ord.t1;
            if (ord.dropped || !isFinite(fin(ord.t2))) cand.t2 = null;
            else cand.t2 = ord.t2;
            if (ord.swapped){
              var tmpSrc = cand.t1Source;
              cand.t1Source = cand.t2Source;
              cand.t2Source = tmpSrc;
            }
          }
        }
        var riskN = Math.abs(fin(cand.entry) - fin(cand.stop));
        if (isFinite(riskN) && riskN > 0){
          cand.rr1 = Math.abs(fin(cand.t1) - fin(cand.entry)) / riskN;
          cand.rr2 = isFinite(fin(cand.t2)) ? Math.abs(fin(cand.t2) - fin(cand.entry)) / riskN : cand.rr2;
          cand.risk = riskN;
        }
      }
    }
    try {
      var stampOp = gfn('hgOmniStampEdge');
      if (stampOp) stampOp(cand, { livePx: livePx });
    } catch (eOpEdge) {}
    try {
      var dragF = opCostDrag(cand);
      if (dragF && isFinite(fin(dragF.costR))) cand.costR = fin(dragF.costR);
    } catch (eCost) {}
    /* Crypto Master Catalog: permission/size/lead only. Never flip dir.
       Unknown kinds (OP-ARMED / OP-REJECT) fail-open as S0. */
    try {
      var catApply = gfn('hgCryptoCatalogApplyVerdict');
      if (catApply){
        catApply(cand, null, { rows: rows, dir: cand.dir, desk: 'OMNIPRESENT', kind: cand.kind });
        if (cand.catalogExclude){
          cand.formationOk = false;
          cand.formationReason = 'catalog ' + (cand.catalogVerdict || 'exclude');
        }
      }
    } catch (eCat) {}
    return cand;
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

    /* Cost geometry (hg-v590 / tightened hg-v607). Replay: costR>=0.20
       loses −0.49R; the 0.12–0.20 band still −0.15R. TRIGGERED tickets
       above 0.12R stand aside. ARMED stays WATCH. Never loosens 3+/2+. */
    var drag = opCostDrag(cand);
    var costR = drag ? fin(drag.costR) : NaN;
    if (isFinite(costR)) cand.costR = costR;
    var costCeil = HG_OP_COST_TOXIC_R;
    try{
      var evC = opX20Evidence();
      if (evC && evC.costToxic && isFinite(fin(evC.costToxic.thresholdR)))
        costCeil = fin(evC.costToxic.thresholdR);
    }catch(eCeil){}
    if (!isFinite(costR)){
      gates.push({ key: 'cost-geometry', hard: false, pass: null,
        why: 'cost drag UNCHECKED — no entry/stop geometry' });
    } else if (costR > costCeil){
      var costWhy = 'cost ' + costR.toFixed(2) + 'R of every trade to fees (stop too tight vs '
        + (drag && isFinite(fin(drag.rtCostPct)) ? fin(drag.rtCostPct).toFixed(2) : '0.14')
        + '% RT) — replay costR>' + costCeil.toFixed(2) + ' lost −0.49R';
      if (cand.status === 'TRIGGERED'){
        gates.push({ key: 'cost-geometry', hard: true, pass: false, why: costWhy });
      } else {
        gates.push({ key: 'cost-geometry', hard: false, info: true, pass: false, why: costWhy });
      }
    } else {
      gates.push({ key: 'cost-geometry', hard: true, pass: true,
        why: 'cost ' + costR.toFixed(2) + 'R — inside the ' + costCeil.toFixed(2) + 'R replay ceiling' });
    }

    /* Gold venue (hg-v590). XAU/XAG/PAXG lost −0.53R on this fade desk.
       TRIGGERED stands aside; ARMED remains a watch with an AGAINST note. */
    if (opReplayGoldSym(sym || cand.sym)){
      var goldWhy = 'gold perp on a crypto fade desk — replay XAU/XAG/PAXG net −0.53R';
      if (cand.status === 'TRIGGERED'){
        gates.push({ key: 'replay-venue', hard: true, pass: false, why: goldWhy });
      } else {
        gates.push({ key: 'replay-venue', hard: false, info: true, pass: false, why: goldWhy });
      }
    } else {
      gates.push({ key: 'replay-venue', hard: true, pass: true,
        why: 'not a gold perp — crypto fade book applies' });
    }

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
          var famZ = 1.96;
          try{
            if (gfn('hgOmniFamilyZ')) famZ = W.hgOmniFamilyZ(2);
          }catch(eZ){}
          var stat = sN + ' samples · ' + (sHit * 100).toFixed(0) + '% · '
                   + (sExp >= 0 ? '+' : '') + sExp.toFixed(2) + 'R ['
                   + (zsc >= 0 ? '+' : '') + zsc.toFixed(2) + 'σ vs breakeven]';
          if (sExp < 0 || zsc <= -2){
            ed = false;
            edWhy = stat + ' — significantly below breakeven, this mechanic has not paid';
          } else if (zsc >= famZ){
            ed = true;
            edWhy = stat + ' — clears the 2-mechanic significance bar (+' + famZ.toFixed(2) + 'σ)';
          } else {
            ed = null;
            edWhy = stat + ' — does not clear the 2-mechanic bar (+' + famZ.toFixed(2)
                  + 'σ); too thin to call an edge, so this stays UNCHECKED rather than PASS';
          }
        } else if (isFinite(sN) && sN > 0 && sN < 20){
          edWhy = 'only ' + sN + ' settled samples — too few to judge';
        }
      }catch(eEd){ edWhy = 'forward stats threw'; }
    }
    gates.push({ key: 'measured-edge', hard: false, pass: ed, why: edWhy });

    var fm = cand.formation;
    var opFmPass = !fm ? null : (fm.ok === false ? false : (fm.ok === true ? true : null));
    var opFmWhy;
    if (!fm) opFmWhy = 'formation not run on this candidate — UNCHECKED';
    else if (fm.ok === false) opFmWhy = String(fm.reason || 'live formation refused');
    else if (fm.ok === true){
      opFmWhy = 'keep-levels formation'
        + (isFinite(fin(cand.formationScore)) ? (' · score ' + fin(cand.formationScore)) : '')
        + (isFinite(fin(cand.fillProb)) ? (' · fill ' + fin(cand.fillProb) + '%') : '');
    } else opFmWhy = String((fm && fm.reason) || 'formation module UNCHECKED');
    gates.push({ key: 'formation', hard: opFmPass === false, info: opFmPass === true, pass: opFmPass, why: opFmWhy });

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

  /* One name, one direction. The desk prints TAKE LONGS / TAKE SHORTS;
     a LONG-from-the-bottom and a SHORT-from-the-high on the same contract
     is two answers to a one-answer question. Tape-aligned wins even when
     the other side is TRIGGERED or nearer. */
  function opContractKey(c){
    return String(c && (c.base || c.sym) || '') + '|' + String((c && c.exchange) || '');
  }
  function opBetterCand(a, b, side){
    if (!b) return true;
    if (!a) return false;
    var aDir = String(a.dir || '').toLowerCase();
    var bDir = String(b.dir || '').toLowerCase();
    if (side === 'long' || side === 'short'){
      var aW = aDir === side ? 1 : 0, bW = bDir === side ? 1 : 0;
      if (aW !== bW) return aW > bW;
    }
    var aT = (a.grade && a.grade.ticket) ? 1 : 0, bT = (b.grade && b.grade.ticket) ? 1 : 0;
    if (aT !== bT) return aT > bT;
    var aC = (a.grade && a.grade.vetoes && a.grade.vetoes.length) ? 0 : 1;
    var bC = (b.grade && b.grade.vetoes && b.grade.vetoes.length) ? 0 : 1;
    if (aC !== bC) return aC > bC;
    var aTr = a.status === 'TRIGGERED' ? 1 : 0, bTr = b.status === 'TRIGGERED' ? 1 : 0;
    if (aTr !== bTr) return aTr > bTr;
    /* Tickets: replay said lower costR / wider stop lost less. ARMED
       watches still prefer nearer — that is the anticipation job. */
    if (aT && bT){
      var aCost = isFinite(fin(a.costR)) ? fin(a.costR) : 99;
      var bCost = isFinite(fin(b.costR)) ? fin(b.costR) : 99;
      if (aCost !== bCost) return aCost < bCost;
      var aW = (a.zone && isFinite(+a.zone.distAtr)) ? +a.zone.distAtr : -1;
      var bW = (b.zone && isFinite(+b.zone.distAtr)) ? +b.zone.distAtr : -1;
      if (aW !== bW) return aW > bW;
    }
    var aS = isFinite(a.score) ? a.score : 0, bS = isFinite(b.score) ? b.score : 0;
    if (aS !== bS) return aS > bS;
    var aF = isFinite(+a.formationScore) ? +a.formationScore : -1;
    var bF = isFinite(+b.formationScore) ? +b.formationScore : -1;
    if (aF !== bF) return aF > bF;
    var aE = isFinite(+a.edgeScore) ? +a.edgeScore : -1;
    var bE = isFinite(+b.edgeScore) ? +b.edgeScore : -1;
    if (aE !== bE) return aE > bE;
    var aD = (a.zone && isFinite(+a.zone.distAtr)) ? +a.zone.distAtr : 99;
    var bD = (b.zone && isFinite(+b.zone.distAtr)) ? +b.zone.distAtr : 99;
    return aD < bD;
  }
  function opOnePerContract(cands, side){
    if (side && side.side) side = side.side;
    if (side !== 'long' && side !== 'short') side = null;
    var best = {}, order = [], i, c, k;
    for (i = 0; i < (cands || []).length; i++){
      c = cands[i];
      if (!c) continue;
      k = opContractKey(c);
      if (best[k] == null){ best[k] = c; order.push(k); continue; }
      if (opBetterCand(c, best[k], side)) best[k] = c;
    }
    return order.map(function (key){ return best[key]; });
  }
  function opRankHead(cands, sideRead){
    var side = sideRead && (sideRead.side === 'long' || sideRead.side === 'short') ? sideRead.side : null;
    var one = opOnePerContract(cands, side);
    one.sort(function (a, b){
      var at = a && a.grade && a.grade.ticket ? 1 : 0, bt = b && b.grade && b.grade.ticket ? 1 : 0;
      if (at !== bt) return bt - at;
      if (at && bt){
        var ac = isFinite(fin(a.costR)) ? fin(a.costR) : 99;
        var bc = isFinite(fin(b.costR)) ? fin(b.costR) : 99;
        if (ac !== bc) return ac - bc;
      }
      var as = ((b && b.score) || 0) - ((a && a.score) || 0);
      if (as) return as;
      var ae = isFinite(+a.edgeScore) ? +a.edgeScore : -1;
      var be = isFinite(+b.edgeScore) ? +b.edgeScore : -1;
      if (be !== ae) return be - ae;
      return ((b && +b.formationScore) || 0) - ((a && +a.formationScore) || 0);
    });
    var showable = one.filter(opShowable);
    if (side)
      showable = showable.filter(function (c){ return String(c.dir).toLowerCase() === side; });
    var top = showable.slice(0, SHOW);
    if (!top.length){
      var fb = side
        ? one.filter(function (c){ return String(c.dir).toLowerCase() === side; })
        : one;
      top = fb.slice(0, Math.min(3, fb.length));
    }
    return { one: one, top: top, side: side };
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

  function opRememberPaint(ui){
    try { if (ui && ui.cards) __op.lastCardsHtml = ui.cards.innerHTML; } catch (eC) {}
    try { if (ui && ui.x20) __op.lastX20Html = ui.x20.innerHTML; } catch (eX) {}
  }

  function opKeepLast(ui, why){
    try {
      if (ui && ui.cards && __op.lastCardsHtml) ui.cards.innerHTML = __op.lastCardsHtml;
    } catch (eC) {}
    try {
      if (ui && ui.x20 && __op.lastX20Html != null) ui.x20.innerHTML = __op.lastX20Html;
    } catch (eX) {}
    if (__op.lastStat) opStat(ui, __op.lastStat);
    try {
      if (ui && ui.warn){
        ui.warn.textContent = 'rescan failed — keeping last scan. ' + String(why || '');
        ui.warn.style.display = 'block';
      }
    } catch (eW) {}
  }

  function opWarmHooks(ui){
    function warmNews(){
      return Promise.resolve().then(function(){
        var hooks = W.HG_warmups;
        if (!hooks || !hooks.length) return null;
        var nw = null, i;
        for (i = 0; i < hooks.length; i++) if (hooks[i] && hooks[i].id === 'news') nw = hooks[i];
        if (!nw || typeof nw.run !== 'function') return null;
        opStat(ui, 'warming news calendar…');
        return nw.run();
      }).catch(function(){ return null; });
    }
    function warmRegime(){
      return Promise.resolve().then(function(){
        if (typeof W.regimeState === 'function' && W.regimeState()) return 'fresh';
        var hooks = W.HG_warmups;
        if (!hooks || !hooks.length) return 'no warmup registered';
        var rg = null, i;
        for (i = 0; i < hooks.length; i++) if (hooks[i] && hooks[i].id === 'regime') rg = hooks[i];
        if (!rg || typeof rg.run !== 'function') return 'no regime warmup';
        opStat(ui, 'warming market regime…');
        return rg.run();
      }).catch(function(){ return null; });
    }
    function warmFormationLive(){
      return Promise.resolve().then(function(){
        var hooks = W.HG_warmups;
        if (!hooks || !hooks.length) return null;
        var fl = null, i;
        for (i = 0; i < hooks.length; i++) if (hooks[i] && hooks[i].id === 'formation-live') fl = hooks[i];
        if (!fl || typeof fl.run !== 'function') return null;
        opStat(ui, 'warming live formation context…');
        return fl.run();
      }).catch(function(){ return null; });
    }
    return warmRegime().then(function(){ return warmNews(); }).then(function(){ return warmFormationLive(); });
  }

  function runScan(ui){
    if (__op.busy) return Promise.resolve();
    if (!gfn('xuUniverse') || !gfn('xuCandles')){
      opStat(ui, 'xuniverse.js unavailable — no venue universe, scan disabled.');
      return Promise.resolve();
    }
    __op.busy = true;
    ui.btn.disabled = true;
    /* Never blank a finished desk to start a rescan — same contract as omniroute. */
    if (!__op.lastCardsHtml){
      try { ui.cards.innerHTML = ''; } catch (eClr) {}
      opStat(ui, 'loading universe…');
    } else {
      opStat(ui, 'rescanning… previous results still showing');
    }
    try { if (ui.warn) ui.warn.style.display = 'none'; } catch (eWh) {}
    var dropFn = gfn('hgOmniDropForming');
    var gradeFn = gfn('hgOmniGrade');

    return opWarmHooks(ui).then(function (){ return W.xuUniverse(); })
      .catch(function (){ return []; })
      .then(function (uni){
        uni = (uni || []).filter(function (u){ return u && (u.exchange === 'delta' || u.exchange === 'coindcx'); });
        if (!uni.length){
          if (__op.lastCardsHtml) opKeepLast(ui, 'universe empty — both venue legs failed');
          else opStat(ui, 'universe empty — both venue legs failed. A data problem, not a quiet market.');
          return null;
        }
        /* FULL UNIVERSE — every delta+coindcx contract, the coverage bar
           omniroute already holds this app to. Pacing is unchanged and is
           omniroute pass 1's exact rhythm (CHUNK=4 concurrent fetches,
           80ms between batches — omniroute.js CHUNK / CHUNK_DELAY_MS), so
           ~531 names is the same proxy load profile a full omniroute sweep
           already survives; it just takes minutes instead of seconds, and
           the status line counts every name as it lands. window.HG_OP_TOP
           is the documented escape hatch back to a capped head. */
        var capN = fin(W.HG_OP_TOP);
        if (!(capN > 0)) capN = OMNI_TOP;
        var list = (capN > 0) ? uni.slice(0, capN) : uni;
        var found = [], done = 0, failed = 0;

        function step(i){
          if (i >= list.length) return Promise.resolve();
          var slice = list.slice(i, i + CHUNK);
          return Promise.all(slice.map(function (item){
            /* COUNT IN == COUNTED OUT. done bumps exactly once per name, on
               the shared tail below, whether the fetch failed OR processing
               threw. The old shape (done++ at the top of the success handler
               plus done++ in a trailing .catch) double-counted a name whose
               PROCESSING threw after its fetch landed — the counter could
               read "scanned 10 / 9" on a 531-name sweep — and a failing
               LAST name never printed the final tick at all. The two-arg
               .then splits fetch failure from processing; the processing
               body is try/caught so nothing it throws can escape this name. */
            return Promise.resolve().then(function (){ return W.xuCandles(item, TF, BARS); })
              .then(function (rows){
                try{
                  var livePx = (rows && rows.length) ? fin(rows[rows.length - 1].c) : NaN;
                  rows = dropFn ? dropFn(rows, TF) : rows;
                  if (rows && rows.length >= 120){
                    if (gfn('hgFwdResolve')){ try{ W.hgFwdResolve(item.sym, null, rows); }catch(e){} }
                    var cands = opAssess(rows, livePx);
                    for (var c = 0; c < cands.length; c++){
                      cands[c].sym = item.sym; cands[c].base = item.base; cands[c].exchange = item.exchange;
                      opFormCandidate(cands[c], rows, livePx);
                      cands[c].gates = opGates(rows, cands[c], livePx, item.sym);
                      cands[c].grade = gradeFn ? gradeFn(cands[c].gates)
                        : { ticket: false, vetoes: [], verdict: 'grade engine unavailable' };
                      cands[c].livePx = livePx;
                      /* 20X stamps (atr1hPct + the ticket re-plan) MUST happen
                         here, while rows are still in scope — the omniroute
                         lesson this file already records at opX20Stamp. */
                      opX20Stamp(cands[c], rows);
                      found.push(cands[c]);
                    }
                  }
                }catch(eProc){ failed++; }
                /* MEMORY — full-universe sanity. This desk is single-pass:
                   unlike omniroute there is no held[] of tapes to null out
                   later. The bars live only inside THIS closure; the only
                   survivors are the compact candidate objects above (zone,
                   gates, scalars — never rows). The explicit release mirrors
                   omniroute's held[j].rows = null idiom so a 531-name scan
                   holds at most CHUNK tapes at once, and stays honest even
                   if a future edit captures this closure. */
                rows = null;
              }, function (){ failed++; })
              .then(function (){
                done++;
                if (done % 5 === 0 || done === list.length)
                  opStat(ui, 'scanned ' + done + ' / ' + list.length + ' contracts'
                    + (capN > 0 ? ' (HG_OP_TOP cap)' : ' (full universe)')
                    + ' — ' + found.length + ' zone(s) found'
                    + (failed ? ' · ' + failed + ' failed (counted, not dropped)' : ''));
              });
          })).then(function (){
            if (i + CHUNK >= list.length) return;
            return opSleep(CHUNK_DELAY).then(function (){ return step(i + CHUNK); });
          });
        }

        return step(0).then(function (){
          return { found: found, scanned: list.length, failed: failed,
                   uniN: uni.length, capN: (capN > 0 ? capN : 0) };
        });
      })
      .then(function (res){
        if (!res) return opRefreshSide(ui);
        return opRefreshSide(ui).then(function (sideRead){
          var ranked = opRankHead(res.found, sideRead);
          var top = ranked.top;
          __op.ran = true;
          __op.snap = { at: Date.now(), rows: res.found };
          var trig = top.filter(function (c){ return c.status === 'TRIGGERED'; }).length;
          var tick = top.filter(function (c){ return c.grade && c.grade.ticket; }).length;
          __op.lastStat = res.found.length + ' zone(s) across ' + res.scanned + ' contracts — '
                        + (res.capN ? ('HG_OP_TOP cap: ' + res.scanned + ' of ' + res.uniN + ' in the universe')
                                    : 'full universe')
                        + ' · top ' + top.length + ' shown, all ' + ranked.one.length + ' kept (expander below)'
                        + ' · one side per contract'
                        + (ranked.side ? (' · tape ' + ranked.side) : '')
                        + ' · ' + trig + ' triggered · ' + tick + ' ticket(s)'
                        + (res.failed ? ' · ' + res.failed + ' feeds failed' : '');
          opStat(ui, __op.lastStat);

          /* forward-log / Telegram only the shown head — alerting the
             against-tape side of the same name is the bug this collapses.
             FULL-UNIVERSE DECISION (deliberate, unchanged semantics):
             recording every TRIGGERED zone across ~531 names could write
             tens-to-hundreds of records per scan into hg-forward's
             4000-record pool, which prunes OLDEST-FIRST (hgFwdAdd folds
             pruned outcomes into an aggregate, so evidence is never
             destroyed — but per-record detail from other desks would churn
             out within days of repeated full scans). The shown head
             (<= SHOW per scan) is what this desk actually recommends, so
             it is the only thing its forward record judges — same rule as
             before the cap was removed, now stated on the coverage line. */
          if (gfn('hgFwdRecordScan')){
            var fwd = top.filter(function (c){ return c.status === 'TRIGGERED'; })
              .map(function (c){ return { sym: c.sym, dir: c.dir, entry: c.entry, stop: c.stop, t1: c.t1,
                                          mechanic: 'OP-' + (c.dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT'),
                                          ticket: !!(c.grade && c.grade.ticket) }; });
            if (fwd.length){ try{ W.hgFwdRecordScan('OMNIPRESENT', TF, fwd, { horizonBars: 24 }); }catch(e){} }
          }
          if (gfn('hgAlertZones')){
            try{
              W.hgAlertZones(top.filter(function (c){ return c.status === 'TRIGGERED'; })
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

          var h = '', closes = opNextCloses(Date.now(), 3);
          h += '<div class="note">Triggers evaluate at 1h bar closes: <b>' + closes.join(' · ') + '</b>'
            + ' — highest-frequency reversal windows: London 07–10 UTC, New York 13–16 UTC.</div>';
          /* COVERAGE — the honesty line: what was scanned, what is shown,
             where the rest lives. Nothing scanned is invisible. */
          h += '<div class="note">' + res.scanned + ' contracts scanned — '
            + (res.capN ? esc('HG_OP_TOP cap: ' + res.scanned + ' of ' + res.uniN + ' in the universe')
                        : 'full universe, no cap')
            + '; top ' + top.length + ' shown, all ' + ranked.one.length
            + ' zone(s) kept in the ALL ZONES section below.'
            + ' Forward log + alerts cover the shown head only.</div>';
          for (var i = 0; i < top.length; i++) h += opCard(top[i], sideRead);
          /* ALL-ZONES EXPANDER — omniroute's overflow discipline (a count
             plus one line per setup, capped at 200 rendered lines) wearing
             the app's <details> idiom (omnigold's demoted-kinds section).
             The full one-per-contract ranked list, top head included so
             the list is complete on its own; every entry also lives in
             hgOpState()'s snapshot. Same honesty rule as omniroute's
             near-miss block: no zone band is printed on a VETOED row —
             tradable numbers under a veto turn a warning into a
             suggestion. */
          var allZ = ranked.one || [];
          if (allZ.length){
            h += '<details class="note" data-op-all-zones="1" style="margin-top:10px">'
              + '<summary style="cursor:pointer"><b>ALL ' + allZ.length + ' ZONE(S) — full ranked list</b>'
              + ' <span class="dim">(one side per contract · top ' + top.length + ' carded above)</span></summary>';
            var zLim = Math.min(allZ.length, 200), zi, zc, zb, zVeto;
            for (zi = 0; zi < zLim; zi++){
              zc = allZ[zi];
              if (!zc) continue;
              zVeto = !!(zc.grade && zc.grade.vetoes && zc.grade.vetoes.length && !(zc.grade.ticket));
              zb = (zc.grade && zc.grade.ticket) ? 'TICKET' : (zVeto ? 'VETO' : 'WATCH');
              h += '<div class="dim">' + esc(String(zc.base || zc.sym || '?'))
                + ' ' + esc(String(zc.dir || '').toUpperCase())
                + ' · ' + esc(String(zc.status || '')) + ' · ' + zb
                + (zVeto
                    ? (' — ' + esc(String(zc.grade.vetoes[0]))
                       + (zc.grade.vetoes.length > 1 ? ' +' + (zc.grade.vetoes.length - 1) : '')
                       + ' · levels withheld')
                    : (' · zone ' + pxF(zc.zone && zc.zone.lo) + '–' + pxF(zc.zone && zc.zone.hi)))
                + ' · ' + ((zc.zone && isFinite(+zc.zone.distAtr)) ? (+zc.zone.distAtr).toFixed(1) : '—') + 'xATR away'
                + ' · score ' + (isFinite(+zc.score) ? (+zc.score).toFixed(0) : '—')
                + '</div>';
            }
            if (allZ.length > zLim)
              h += '<div class="dim">…and ' + (allZ.length - zLim) + ' more — still ranked, 20X-judged and kept in hgOpState().</div>';
            h += '</details>';
          }
          var empty = (ranked.side)
            ? ('<div class="empty">no ' + ranked.side.toUpperCase()
               + ' zone in range — TAKE ' + (ranked.side === 'long' ? 'LONGS' : 'SHORTS')
               + ' stands; the other side is not shown.</div>')
            : ('<div class="empty">no zone within ' + ARM_MAX_ATR + 'xATR of any market — the detectors are meant to be quiet when nothing is near.</div>');
          ui.cards.innerHTML = opUniformLeadHtml(ranked.one && ranked.one.length ? ranked.one : top, ranked.side || (sideRead && sideRead.side)) + (h || empty);
          try { if (typeof W.hgMpPin === 'function') W.hgMpPin('omnipresent', top, null, ui.cards); } catch (eMp) {}
          /* 20X — judged on the same collapsed one-per-contract list the
             desk ranks; kept for remount restore. */
          try{
            if (ui.x20){
              var x20h = opX20SectionHtml(ranked.one);
              ui.x20.innerHTML = x20h;
              __op.lastX20Html = x20h;
            }
          }catch(eX20r){}
          /* DESK VERDICT + PAID-ONLY (hg-v540): capture the ALL bytes the
             lines above just painted, remember the inputs, refresh the
             verdict strip from the live pool, then apply the persisted show
             mode — a DOM no-op when the mode is ALL. */
          try{
            __op.lastAllView = { cards: ui.cards.innerHTML, x20: __op.lastX20Html };
            __op.lastView = { one: ranked.one, top: top, sideRead: sideRead };
            opPaintVerdict(ui);
            opApplyShowMode(ui);
          }catch(ePv){}
          opRememberPaint(ui);
        });
      })
      .catch(function (e){
        var msg = (e && e.message) || e;
        if (__op.lastCardsHtml) opKeepLast(ui, msg);
        else opStat(ui, 'scan failed: ' + msg);
      })
      .then(function (){
        __op.busy = false;
        ui.btn.disabled = false;
      });
  }

  /* ============ 20X — leverage-safe setups (this desk's face) ============
     ALL leverage math is the audited omniroute machinery, called through its
     window exports (hgOmni20xParams / hgOmni20xQualify / hgOmni20xReplan /
     hgOmni20xExplain) — nothing is reimplemented here, so the two tabs can
     never disagree about what survives 20x. This file only (1) adapts the
     OP candidate shape into what those functions read, and (2) names the
     quality floor honestly: this desk has no conviction certificates and no
     meaningful solidity score, so exactly TWO quality paths are reachable:
       - forward-paid: its own settled forward record (fwdTab 'OMNIPRESENT',
         kinds OP-HIGH-REJECT / OP-LOW-REJECT — the same pool the
         measured-edge gate and FORWARD table read);
       - replay-evidence: the mechanic's own AUDITED offline replay record
         (HG_OP_REPLAY_EVIDENCE below) is gross-positive at n >= 50 — a rule
         COMPUTED from the baked rows at render time, never asserted, so the
         section can never claim an edge the table does not show. As baked
         (the 2026-09-01 full run) BOTH kinds are gross-negative, so this
         path grants nothing today and the section says so.
     Candidates that clear every GEOMETRY gate but no quality path render in
     a separate, clearly-labeled GEOMETRY tier below the quality-passed
     cards — geometry safety is not edge, and the tier says so per card.
     Every missing field maps to ABSENT — fail closed, never a placeholder
     that could read as qualification. */

  /* Stamp the two 20X inputs that need the raw bars, at SCAN time, because
     rows exist only inside the scan closure (the omniroute lesson: capture
     atr1hPct and the re-plan while the tape is in scope or the noise gate
     can never run). Best-effort; absent on any failure — fail closed. */
  function opX20Stamp(c, rows){
    try{
      var aPct = (fin(c.atr) > 0 && fin(c.livePx) > 0) ? fin(c.atr) / fin(c.livePx) * 100 : NaN;
      if (isFinite(aPct) && aPct > 0) c.atr1hPct = aPct;
      /* re-plan only where it could ever be used: a TICKET (TRIGGERED by
         construction — the rejection gate blocks tickets on ARMED). This
         desk has no 15m tape; hgOmni20xReplan handles the null — fewer
         candidates, honestly. */
      if (c.grade && c.grade.ticket === true && gfn('hgOmni20xReplan')){
        c.x20plan = W.hgOmni20xReplan({ entry: c.entry, stop: c.stop, t1: c.t1 }, c.dir, rows, null) || null;
      }
    }catch(e){}
  }

  /* ADAPTER — an OP candidate reshaped into what hgOmni20xQualify reads.
     Field map (every mapped field from real data, every missing field ABSENT):
       dir                 <- c.dir
       grade               <- c.grade       (same hgOmniGrade producer — the
                                             same ticket boolean, TRIGGERED-only
                                             by this desk's rejection gate)
       plan.entry/stop/t1  <- c.entry / c.stop / c.t1  (top-level here)
       atr1hPct            <- c.atr1hPct    (scan-time stamp; absent -> the
                                             noise gate FAILs, by design)
       x20plan             <- c.x20plan     (scan-time re-plan; absent -> no
                                             stop-width fallback)
       kind                <- OP-HIGH-REJECT / OP-LOW-REJECT (the exact key
                              this desk's forward recorder writes)
       fwdTab              <- 'OMNIPRESENT' (quality reads THIS desk's own
                              pool — never another tab's record)
       conviction          <- ABSENT: no formation-time certificate exists on
                              this desk and one is never fabricated from
                              confluence/evidence counts (path fails closed)
       solidity            <- ABSENT: the 18-pillar score is omniroute-shaped;
                              a starved recompute is meaningless here and no
                              SOLIDITY chip is ever printed on these cards */
  function opX20Wrap(c){
    if (!c) return null;
    var dir = String(c.dir || '').toLowerCase();
    var wrap = {
      dir: dir,
      grade: c.grade || null,
      plan: { entry: c.entry, stop: c.stop, t1: c.t1 },
      kind: 'OP-' + (dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT'),
      fwdTab: 'OMNIPRESENT',
      sym: c.sym, base: c.base, exchange: c.exchange
    };
    var aPct = fin(c.atr1hPct);
    if (isFinite(aPct) && aPct > 0) wrap.atr1hPct = aPct;
    if (c.x20plan) wrap.x20plan = c.x20plan;
    return wrap;
  }

  /* Does ONE OP candidate survive 20x? The audited qualifier answers, on the
     wrapped shape. Null when the module is absent — fail closed, and the
     section renderer says so out loud instead of throwing. */
  function opX20Qualify(c){
    var qFn = gfn('hgOmni20xQualify');
    if (!qFn) return null;
    var wrap = opX20Wrap(c);
    if (!wrap) return null;
    try{ return qFn(wrap); }catch(e){ return null; }
  }

  /* ============ replay evidence — the desk's audited offline record ======
     PROVENANCE. Baked from scripts/backtest-omnipresent-results.json,
     wallClockRunAt 2026-09-01T04:56:42Z: the FULL replay — 25-symbol
     point-in-time universe x 2000 1h bars per symbol, run offline from the
     shared point-in-time kline cache, fees 0.05% + slippage 0.02% per side
     (taker), 8522 settled trades. Audit trail: an earlier evidence file
     sold as the full run was in fact a 3-symbol --smoke run that had
     silently overwritten full-run output via a shared OUT_PATH; the runner
     now writes smoke to backtest-omnipresent-smoke-results.json so that
     can never recur, and THESE rows are from the re-run true full run.
     That run measured BOTH mechanics gross-negative (the earlier "+0.049
     gross" claim inverted), which is why nothing below asserts an edge:
     the quality rule is COMPUTED from these rows at render time.
       kinds        per-mechanic settled rows (n / winRate / avgGrossR /
                    avgNetR / profit factor) from aggregates.byKind;
       gatedCohort  aggregates.gatedCohort.bothHardGates — replay trades
                    that passed BOTH signal-time hard gates (3+ level
                    sources AND 2+ exhaustion reads, tagged at signal time,
                    provably derived from the gate tags, never refit);
       settled      aggregates.overall.n.
     Exported (window.HG_OP_REPLAY_EVIDENCE) so harnesses can verify the
     runtime rule against a mutated table; lookups read the export first so
     the displayed numbers and the rule can never come from two copies. */
  var HG_OP_REPLAY_EVIDENCE = {
    src: 'scripts/backtest-omnipresent-results.json',
    runAt: '2026-09-01T04:56:42Z',
    basis: '25 symbols x 2000 1h bars, offline point-in-time cache, taker fees 0.05%+0.02%/side',
    settled: 8522,
    kinds: {
      'OP-HIGH-REJECT': { n: 4204, winRate: 0.3088, avgGrossR: -0.0224, avgNetR: -0.2182, pf: 0.7240 },
      'OP-LOW-REJECT':  { n: 4318, winRate: 0.3038, avgGrossR: -0.0391, avgNetR: -0.2196, pf: 0.7207 }
    },
    gatedCohort: { n: 164, winRate: 0.2683, avgGrossR: -0.1473, avgNetR: -0.2736, pf: 0.6538 },
    /* hg-v590 slices — tighten tickets, never loosen 3+/2+ */
    costToxic: { thresholdR: 0.12, n: 2532, avgNetR: -0.4911, note: 'hg-v607: ceiling 0.20→0.12; ≥0.20 lost −0.49R, 0.12–0.20 still −0.15R' },
    goldVenue: { n: 564, avgNetR: -0.5345, note: 'XAU/XAG/PAXG perps on this fade desk' }
  };

  var HG_OP_COST_TOXIC_R = 0.12;

  function opReplayGoldSym(sym){
    return /XAU|XAG|PAXG|XAUT/.test(String(sym || '').toUpperCase());
  }

  function opCostDrag(cand){
    var fn = gfn('hgOmniCostDrag');
    if (!fn || !cand) return null;
    try{
      return fn({ plan: { entry: cand.entry, stop: cand.stop } }) || null;
    }catch(e){ return null; }
  }

  function opDeskStanceBannerHtml(){
    var E = opX20Evidence();
    var hi = E && E.kinds && E.kinds['OP-HIGH-REJECT'];
    var lo = E && E.kinds && E.kinds['OP-LOW-REJECT'];
    var gc = E && E.gatedCohort;
    var ct = E && E.costToxic;
    var gv = E && E.goldVenue;
    var txt = 'BOTH fade kinds net-negative at scale'
      + (hi && isFinite(fin(hi.avgNetR)) ? (' — HIGH-REJECT ' + fin(hi.avgNetR).toFixed(2) + 'R') : '')
      + (lo && isFinite(fin(lo.avgNetR)) ? (', LOW-REJECT ' + fin(lo.avgNetR).toFixed(2) + 'R') : '')
      + ' over ' + (E && E.settled ? E.settled : 8522) + ' settled ('
      + (E && E.src ? E.src : 'scripts/backtest-omnipresent-results.json') + '). '
      + 'Gated 3+ sources AND 2+ exhaustion is worse'
      + (gc && isFinite(fin(gc.avgNetR)) ? (' (' + fin(gc.avgNetR).toFixed(2) + 'R) — not loosened.') : '.')
      + ' Tight stops (costR>'
      + (ct && isFinite(fin(ct.thresholdR)) ? fin(ct.thresholdR).toFixed(2) : '0.12')
      + ') lose '
      + (ct && isFinite(fin(ct.avgNetR)) ? fin(ct.avgNetR).toFixed(2) : '-0.49')
      + 'R — TRIGGERED tickets with that geometry stand aside. '
      + 'Gold perps (XAU/XAG/PAXG) lose '
      + (gv && isFinite(fin(gv.avgNetR)) ? fin(gv.avgNetR).toFixed(2) : '-0.53')
      + 'R — stood aside from TICKET. ARMED stays WATCH. No third mechanic.';
    return '<div class="note warn" data-op-replay-stance="1" style="display:block;margin-bottom:10px">'
      + '<b>REPLAY STANCE</b> — ' + esc(txt) + '</div>';
  }

  /* The one read path for the table: prefer the window export (same object
     unless a harness swapped it), fall back to the lexical copy. Anything
     that is not a plain object reads as ABSENT — fail closed. */
  function opX20Evidence(){
    try{
      var e = W.HG_OP_REPLAY_EVIDENCE;
      if (e && typeof e === 'object') return e;
    }catch(eE){}
    return HG_OP_REPLAY_EVIDENCE;
  }

  function opX20ReplayRow(kind){
    try{
      var E = opX20Evidence();
      var k = String(kind || '');
      if (E && E.kinds && Object.prototype.hasOwnProperty.call(E.kinds, k)){
        var r = E.kinds[k];
        if (r && typeof r === 'object') return r;
      }
    }catch(eR){}
    return null;
  }

  /* THE QUALITY RULE — computed at runtime from the baked rows, never a
     baked boolean: avgGrossR > 0 AND n >= 50. Returns the row when the
     mechanic's replay record earns the quality path, else null. Junk rows
     (NaN, missing fields) return null — fail closed. As baked, BOTH kinds
     are gross-negative, so this returns null for both; the rule exists so
     the section flips HONESTLY the day a re-run table says otherwise. */
  function opX20ReplayQuality(kind){
    var r = opX20ReplayRow(kind);
    if (!r) return null;
    var n = fin(r.n), g = fin(r.avgGrossR);
    if (!isFinite(n) || !isFinite(g)) return null;
    return (n >= 50 && g > 0) ? r : null;
  }

  /* One formatted evidence line, gross AND net ALWAYS together — the edge
     (when one exists) is thin and fee-sensitive, so printing gross without
     net would be a lie of omission. Null when no row exists. */
  function opX20ReplayLine(kind){
    var r = opX20ReplayRow(kind);
    if (!r) return null;
    var n = fin(r.n), wr = fin(r.winRate), g = fin(r.avgGrossR), nt = fin(r.avgNetR);
    if (!isFinite(n) || n <= 0) return null;
    var s = String(kind) + ' n=' + Math.round(n);
    if (isFinite(wr)) s += ', ' + Math.round(wr * 100) + '% WR';
    if (isFinite(g))  s += ', gross ' + (g >= 0 ? '+' : '') + g.toFixed(2) + 'R';
    if (isFinite(nt)) s += ' — net ' + (nt >= 0 ? '+' : '') + nt.toFixed(2) + 'R at taker fees';
    return s;
  }

  /* Did the candidate clear every GEOMETRY gate and fail ONLY the quality
     floor? Decided by the audited explainer alone — this file never
     re-judges a gate. Null explainer, non-ticket, throw: false (closed). */
  function opX20GeomOnly(c){
    var xFn = gfn('hgOmni20xExplain');
    if (!xFn) return false;
    var wrap = opX20Wrap(c);
    if (!wrap) return false;
    var ex = null;
    try{ ex = xFn(wrap); }catch(eX){ ex = null; }
    if (!ex || ex.qualified || !ex.fails || !ex.fails.length) return false;
    for (var i = 0; i < ex.fails.length; i++){
      if (!ex.fails[i] || String(ex.fails[i].gate) !== 'quality') return false;
    }
    return true;
  }

  /* Full audited gate-run numbers for a candidate whose quality floor is
     met by the BAKED replay evidence instead of the three in-gate paths.
     The geometry verdict is already established (opX20GeomOnly: every gate
     but quality passed) — this re-run exists ONLY to obtain the exact
     liq/cost card numbers from the audited machinery instead of forking
     its arithmetic. It delegates the quality floor through the OFFICIAL
     call-time override HG_OMNI_20X_SOLIDITY_FLOOR (dropped to epsilon so
     gate (e) is satisfied by any computable score) and restores it in the
     same tick; every GEOMETRY gate runs at the frozen parameters, so
     nothing that failed geometry can slip through here. The result is
     relabeled quality:'replay-evidence' — the floor that ACTUALLY earned
     the card. Any failure (no export, incomputable score, throw): null —
     the candidate falls to the geometry tier instead of qualifying. */
  function opX20ReplayRequalify(c){
    var qFn = gfn('hgOmni20xQualify');
    if (!qFn) return null;
    var wrap = opX20Wrap(c);
    if (!wrap) return null;
    var had = false, sav, q = null;
    try{ had = Object.prototype.hasOwnProperty.call(W, 'HG_OMNI_20X_SOLIDITY_FLOOR'); }catch(eH){ had = false; }
    if (had){ try{ sav = W.HG_OMNI_20X_SOLIDITY_FLOOR; }catch(eS){ sav = undefined; } }
    try{
      W.HG_OMNI_20X_SOLIDITY_FLOOR = 1e-9;
      try{ q = qFn(wrap) || null; }catch(eQ){ q = null; }
    }finally{
      try{
        if (had) W.HG_OMNI_20X_SOLIDITY_FLOOR = sav;
        else delete W.HG_OMNI_20X_SOLIDITY_FLOOR;
      }catch(eD){ try{ W.HG_OMNI_20X_SOLIDITY_FLOOR = undefined; }catch(eU){} }
    }
    if (q) q.quality = 'replay-evidence';
    return q;
  }

  /* What the runtime rule says TODAY, spelled per kind for the quality-
     floor note — computed, so the note can never contradict the rule. */
  function opX20ReplayStatusText(){
    var kinds = ['OP-HIGH-REJECT', 'OP-LOW-REJECT'];
    var parts = [], anyPass = false, i, k, r, g, n;
    for (i = 0; i < kinds.length; i++){
      k = kinds[i];
      r = opX20ReplayRow(k);
      if (!r){ parts.push(k + ': no replay record'); continue; }
      g = fin(r.avgGrossR); n = fin(r.n);
      if (opX20ReplayQuality(k)){
        anyPass = true;
        parts.push(k + ' PASSES (gross ' + (isFinite(g) ? ((g >= 0 ? '+' : '') + g.toFixed(2)) : '?') + 'R over n=' + (isFinite(n) ? Math.round(n) : '?') + ')');
      } else {
        parts.push(k + ' fails (gross ' + (isFinite(g) ? ((g >= 0 ? '+' : '') + g.toFixed(2)) : '?') + 'R over n=' + (isFinite(n) ? Math.round(n) : '?') + ')');
      }
    }
    return parts.join('; ') + (anyPass ? '' : ' — the replay path grants nothing today');
  }

  function opX20Placeholder(){
    return '<section data-op-20x="1">'
      + '<div class="hg-mp-eye">20X — LEVERAGE-SAFE SETUPS</div>'
      + '<div class="note warn" style="display:block">20x is unforgiving: a ~4.6% adverse move liquidates '
      + 'the full isolated margin. This section fills when a scan runs — press RUN OMNIPRESENT SCAN above. '
      + 'Only TRIGGERED tickets whose geometry survives 20x pass its gates (stop 2.5x inside liquidation, '
      + 'ATR-noise check, cost gate, quality floor — on this desk, a forward record that has paid, or a '
      + 'mechanic whose audited full-replay record is gross-positive at n&gt;=50). '
      + 'Most scans yield none, which is the gates working, not a malfunction. '
      + 'Signals only — this desk does not execute.</div>'
      + '<div class="empty">no scan yet — the 20x gates run on scan results.</div>'
      + '</section>';
  }

  /* The whole section: permanent warning banner (copied VERBATIM from the
     omniroute section — one message about 20x risk everywhere), this desk's
     quality-floor truth, one compact card per qualifier, the honest empty
     state, and near-miss transparency that NEVER prints levels for a setup
     that failed a safety gate. Fed the same collapsed one-per-contract list
     the desk ranks.
     opts (ADDITIVE, hg-v540): { hideGeomTier: true } is the PAID-ONLY view —
     the GEOMETRY tier's cards are withheld (quality unproven is exactly what
     PAID-ONLY exists to hide) and replaced by a one-line count. Every caller
     that omits opts renders byte-identically to before the flag existed. */
  function opX20SectionHtml(cands, opts){
    try{
      if (!gfn('hgOmni20xParams') || !gfn('hgOmni20xQualify')){
        return '<section data-op-20x="1"><div class="hg-mp-eye">20X — LEVERAGE-SAFE SETUPS</div>'
          + '<div class="note warn" style="display:block">20X section unavailable — the omniroute leverage module '
          + '(hgOmni20xParams / hgOmni20xQualify) has not loaded. This desk never reimplements the liquidation '
          + 'arithmetic, so nothing is judged without it.</div></section>';
      }
      var P = null;
      try{ P = W.hgOmni20xParams(); }catch(eP){ P = null; }
      if (!P){
        return '<section data-op-20x="1"><div class="hg-mp-eye">20X — LEVERAGE-SAFE SETUPS</div>'
          + '<div class="note warn" style="display:block">20X section unavailable — the configured '
          + 'leverage/maintenance-margin combination leaves no distance to liquidation, so no geometry can be judged.</div>'
          + '</section>';
      }
      var arr = Array.isArray(cands) ? cands : [];
      /* TWO TIERS, never blended:
           list/quals — QUALITY-PASSED: the audited qualifier said yes
             (forward-paid path), OR every geometry gate passed and the
             mechanic's baked replay record earns the runtime rule
             (gross-positive at n>=50) — promoted through
             opX20ReplayRequalify so the card numbers still come from the
             audited machinery, stamped quality:'replay-evidence'.
           geomC — GEOMETRY-ONLY: every geometry gate passed, NO quality
             path. Rendered below with a warn label per card; never mixed
             into the quality tier, never given a green pip. */
      var list = [], quals = [], geomC = [], replayPassedN = 0, i, c, q;
      for (i = 0; i < arr.length; i++){
        c = arr[i]; if (!c) continue;
        q = opX20Qualify(c);
        if (q){ list.push(c); quals.push(q); continue; }
        if (!opX20GeomOnly(c)) continue;
        var gKind = 'OP-' + (String(c.dir || '').toLowerCase() === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT');
        if (opX20ReplayQuality(gKind)){
          var rq = opX20ReplayRequalify(c);
          if (rq){ list.push(c); quals.push(rq); replayPassedN++; continue; }
        }
        geomC.push(c);
      }
      /* rank by LOWER cost drag — the one meaningful ordering this desk has.
         Omniroute ranks by its stamped solidity, which does not exist here
         and is never faked; costR is that ranking's own tiebreak, promoted. */
      if (list.length > 1){
        var ordr = [], oi;
        for (oi = 0; oi < list.length; oi++) ordr.push({ c: list[oi], q: quals[oi] });
        ordr.sort(function (a, b){
          var ca = fin(a.q && a.q.costR), cb = fin(b.q && b.q.costR);
          var fa = isFinite(ca), fb = isFinite(cb);
          if (fa && fb && ca !== cb) return ca - cb;
          if (fa !== fb) return fa ? -1 : 1;
          return 0;
        });
        for (oi = 0; oi < ordr.length; oi++){ list[oi] = ordr[oi].c; quals[oi] = ordr[oi].q; }
      }
      /* deterministic geometry-tier order: by display name. These cards
         carry no audited cost number (they are not qualified), so a costR
         ranking here would imply a precision the tier has not earned. */
      if (geomC.length > 1){
        geomC.sort(function (ga, gb){
          var an = String((ga && (ga.base || ga.sym)) || ''), bn = String((gb && (gb.base || gb.sym)) || '');
          return an < bn ? -1 : an > bn ? 1 : 0;
        });
      }
      var h = '<section data-op-20x="1">';
      h += '<div class="hg-mp-eye">20X — LEVERAGE-SAFE SETUPS (' + list.length + ' quality / ' + geomC.length + ' geometry-only)</div>';
      /* banner verbatim from omniroute — it renders on the empty state too,
         because the reader most likely to need it is the one about to force
         a trade that did not qualify. */
      h += '<div class="note warn" style="display:block">20x is unforgiving: a ~'
        +  P.liqDistPct.toFixed(1) + '% adverse move liquidates the full isolated margin. '
        +  'These cards passed geometry gates (stop ' + P.safety + 'x inside liquidation, noise check, '
        +  'cost gate, quality floor: conviction cert, a forward record that has paid, or solidity) '
        +  '— that is safety of GEOMETRY, not a prediction. '
        +  'Funding and gap slippage are NOT modeled. Signals only — this desk does not execute.</div>';
      /* what the quality floor honestly IS on this desk — the replay-path
         status is COMPUTED from the baked table at render, so this note can
         never disagree with what the rule actually granted above. */
      h += '<div class="note">Quality floor on THIS desk: OMNIPRESENT setups carry no conviction certificate and no '
        +  'meaningful solidity score, and neither is ever fabricated — two quality paths are reachable. '
        +  '(1) forward-paid: this desk&#39;s OWN settled forward record (OP-HIGH-REJECT / OP-LOW-REJECT in the '
        +  'OMNIPRESENT pool, the same stats the measured-edge gate reads: 20+ settled samples clearing the '
        +  '2-mechanic significance bar). (2) replay-evidence: the mechanic&#39;s audited offline replay '
        +  '(' + esc(String(fin(opX20Evidence().settled) || '?')) + ' settled trades, 25 symbols x 2000 1h bars, taker fees modeled) '
        +  'is gross-positive at n&gt;=50 — computed from the baked table at render, never asserted. '
        +  'Today that computation says: ' + esc(opX20ReplayStatusText()) + '. '
        +  'Until a path pays, the quality tier is structurally empty — correct, not broken. '
        +  'ARMED zones can never appear here: no ticket exists before a 1h rejection close.</div>';
      if (!list.length){
        h += '<div class="empty">no setup currently clears the 20x safety gates — with 20x leverage '
          +  'that is the correct output most of the time, not a malfunction.'
          +  (geomC.length ? ' The GEOMETRY tier below passed the geometry gates only — quality unproven, not a qualification.' : '')
          +  '</div>';
      } else {
        for (i = 0; i < list.length; i++){
          c = list[i]; q = quals[i];
          var used20 = !!(q && q.planUsed === 'x20' && q.x20);
          var mech = 'OP-' + (c.dir === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT');
          h += '<div class="card">';
          h += '<div class="ttl">' + esc(c.base || c.sym) + ' · ' + esc(String(c.dir || '').toUpperCase())
            +  ' · ' + esc(mech)
            +  ' <span class="gpip ok">' + (used20 ? '20X RE-PLAN OK' : '20X GEOMETRY OK') + '</span>'
            +  ' <span class="dim">' + esc(String(c.exchange || '').toUpperCase()) + '</span></div>';
          if (used20){
            /* the re-plan card must never read like the zone card — the stop
               is 1h structure chosen to FIT 20x, not the invalidation */
            h += '<div class="note warn" style="display:block">20X PLAN — tighter 1h stop, NOT the '
              +  'zone invalidation: ordinary noise can stop this trade while the zone idea stays alive.</div>';
            h += '<div>20x ENTRY <b>' + pxF(q.x20.entry) + '</b> · STOP <b>' + pxF(q.x20.stop)
              +  '</b> · T1 <b>' + pxF(q.x20.t1) + '</b> <span class="dim">('
              +  esc(String(q.x20.src || '')) + ', 2R)</span></div>';
            h += '<div class="dim">zone plan: stop '
              +  (isFinite(fin(q.primaryStopDistPct)) ? fin(q.primaryStopDistPct).toFixed(2) : '—')
              +  '% away — that invalidation stays live after a 20x stop-out</div>';
          } else {
            h += '<div>ENTRY <b>' + pxF(c.entry) + '</b> · STOP <b>' + pxF(c.stop)
              +  '</b> · T1 <b>' + pxF(c.t1) + '</b></div>';
          }
          /* the 20x arithmetic, spelled out — computed from the plan that
             actually qualified. A 1.2% stop is "small" until it is printed
             as 24% of the margin. */
          h += '<div>est. liq ' + pxF(q.liqPrice)
            +  ' (' + fin(q.liqDistPct).toFixed(2) + '%)'
            +  ' · stop ' + fin(q.stopDistPct).toFixed(2) + '%'
            +  ' · stop-to-liq buffer ' + fin(q.bufferX).toFixed(1) + 'x'
            +  ' · at stop you lose <b>' + fin(q.marginLossAtStopPct).toFixed(0) + '%</b> of margin'
            +  ' · cost ' + fin(q.costR).toFixed(2) + 'R</div>';
          if (q.quality === 'replay-evidence'){
            /* the evidence line prints gross AND net, always — the measured
               edge (when one exists) is thin and fee-sensitive, and a card
               that printed gross alone would be selling the fee away. */
            var rvLine = opX20ReplayLine(mech);
            h += '<div class="dim">[via replay-evidence: '
              +  esc(rvLine || (mech + ' — replay row unavailable at render; the rule read it at qualify time'))
              +  ' · plan: ' + esc(String(q.planUsed || 'primary')) + ']</div>';
          } else {
            h += '<div class="dim">[via ' + esc(String(q.quality)) + ' · plan: ' + esc(String(q.planUsed || 'primary')) + ']</div>';
          }
          h += '</div>';
        }
      }
      /* ---- GEOMETRY TIER — passed every geometry gate, NO quality path.
         Always BELOW the quality-passed cards, never mixed in, never a
         green pip. Levels ARE printed here — these setups failed no SAFETY
         gate, only the evidence floor — but each card leads with the warn
         label and its mechanic's actual replay record, negative gross
         stated plainly. (The near-miss block below still lists these
         tickets too: that block is the canonical "which gate stopped it"
         diagnosis and quality is the gate that stopped them.) */
      if (geomC.length && opts && opts.hideGeomTier === true){
        /* PAID-ONLY: the tier's existence stays on the record (a count is
           information), its tradable-looking cards do not. */
        h += '<div class="note warn" data-op-geom-hidden="1" style="display:block;margin-top:8px"><b>GEOMETRY TIER — '
          +  geomC.length + ' card(s) hidden by PAID-ONLY</b> — these passed geometry gates only; '
          +  'no quality path (no paid forward record, no gross-positive replay). Switch SHOW to ALL to see them.</div>';
      } else if (geomC.length){
        h += '<div class="note warn" style="display:block;margin-top:8px"><b>GEOMETRY TIER — QUALITY UNPROVEN (' + geomC.length + ')</b> '
          +  '— every geometry gate passed (stop band, noise, cost), but no quality path did: no paid forward record, '
          +  'and no gross-positive replay record. Geometry safety is not edge.</div>';
        for (i = 0; i < geomC.length; i++){
          c = geomC[i];
          var gMech = 'OP-' + (String(c.dir || '').toLowerCase() === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT');
          var gLine = opX20ReplayLine(gMech);
          h += '<div class="card">';
          h += '<div class="ttl">' + esc(c.base || c.sym) + ' · ' + esc(String(c.dir || '').toUpperCase())
            +  ' · ' + esc(gMech)
            +  ' <span class="gpip warn">GEOMETRY-ONLY</span>'
            +  ' <span class="dim">' + esc(String(c.exchange || '').toUpperCase()) + '</span></div>';
          h += '<div class="note warn" style="display:block">GEOMETRY OK — quality unproven: no paid forward record; '
            +  'replay for this mechanic: ' + esc(gLine || 'no replay record at all — fully unproven') + '.</div>';
          h += '<div>ENTRY <b>' + pxF(c.entry) + '</b> · STOP <b>' + pxF(c.stop)
            +  '</b> · T1 <b>' + pxF(c.t1) + '</b></div>';
          h += '</div>';
        }
      }
      /* ---- gated-cohort footnote — rendered whenever replay numbers are
         being cited on cards above (replay-evidence passes or geometry
         tier), so the reader who just saw per-kind replay stats also sees
         what the desk's own hard gates did to the same replay: computed
         from the baked cohort row, never hardcoded prose. */
      if (replayPassedN > 0 || geomC.length){
        try{
          var gc = opX20Evidence().gatedCohort;
          var gcN = fin(gc && gc.n), gcPf = fin(gc && gc.pf), gcG = fin(gc && gc.avgGrossR), gcNt = fin(gc && gc.avgNetR);
          if (isFinite(gcN) && gcN > 0 && isFinite(gcPf)){
            h += '<div class="note dim" style="margin-top:6px;opacity:.85">Gated cohort, same replay: '
              +  Math.round(gcN) + ' trades passing BOTH hard gates (3+ level sources AND 2+ exhaustion reads) ran PF '
              +  gcPf.toFixed(2)
              +  ((isFinite(gcG) && isFinite(gcNt))
                   ? (' (gross ' + (gcG >= 0 ? '+' : '') + gcG.toFixed(2) + 'R, net ' + (gcNt >= 0 ? '+' : '') + gcNt.toFixed(2) + 'R)')
                   : '')
              +  (gcPf >= 1
                   ? ' — above water but ' + (gcN < 500 ? 'far below any sample floor; tracked, not trusted.' : 'tracked, not trusted.')
                   : ' — the hard gates did not rescue these mechanics in replay; tracked, not trusted.')
              +  '</div>';
          }
        }catch(eGc){}
      }
      /* NEAR-MISS TRANSPARENCY — same discipline as omniroute: name the
         closest TICKETS and the gate that stopped each, so a thin section
         reads as gates doing their job on specific setups. NO entry/stop
         levels here, ever: these failed a safety gate, and printing tradable
         numbers under a "not qualified" heading turns a warning into a
         suggestion. */
      if (list.length < 3 && gfn('hgOmni20xExplain')){
        var near = [], ni, nc, nx, nw;
        for (ni = 0; ni < arr.length; ni++){
          nc = arr[ni]; if (!nc) continue;
          if (!(nc.grade && nc.grade.ticket === true)) continue;
          if (list.indexOf(nc) >= 0) continue;
          nw = opX20Wrap(nc);
          nx = null;
          try{ nx = W.hgOmni20xExplain(nw); }catch(eNx){ nx = null; }
          if (!nx || nx.qualified || !nx.fails || !nx.fails.length) continue;
          near.push({ c: nc, fails: nx.fails });
        }
        near.sort(function (a, b){ return a.fails.length - b.fails.length; });
        if (near.length){
          h += '<div class="note dim" style="margin-top:8px;opacity:.8"><b>NEAREST MISSES — NOT QUALIFIED</b>'
            +  ' <span class="dim">(closest tickets and the gate that stopped each · no levels shown on setups that failed safety)</span>';
          for (ni = 0; ni < near.length && ni < 3; ni++){
            var nf = near[ni].fails[0], nMore = near[ni].fails.length - 1;
            h += '<div class="dim">' + esc(String(near[ni].c.base || near[ni].c.sym || '?'))
              +  ' ' + esc(String(near[ni].c.dir || '').toUpperCase())
              +  ' — failed: ' + esc(String(nf.gate)) + ': ' + esc(String(nf.why))
              +  (nMore > 0 ? ' <span class="dim">(+' + nMore + ' more gate' + (nMore === 1 ? '' : 's') + ')</span>' : '')
              +  '</div>';
          }
          h += '</div>';
        }
      }
      h += '</section>';
      return h;
    }catch(eSec){
      return '<div class="note warn">20X section failed to render — nothing was judged.</div>';
    }
  }

  /* ============ PAID-ONLY MODE + DESK VERDICT (hg-v540) ============
     ADDITIVE display layer. ALL mode is the untouched render: the scan paints
     exactly what it painted before, those bytes are captured, and only THEN
     does the persisted mode get applied — so ALL is byte-identical to the
     pre-toggle desk, and PAID-ONLY is a filter over a snapshot, never a
     different scan. Fail closed everywhere: a missing shared builder, an
     empty pool or a throw renders the honest text or nothing, never a pass. */
  var OP_PAID_LS = 'hg_paidonly_OMNIPRESENT';

  function opShowMode(){
    try{
      if (typeof localStorage === 'undefined') return 'ALL';
      return localStorage.getItem(OP_PAID_LS) === '1' ? 'PAID' : 'ALL';
    }catch(e){ return 'ALL'; }
  }
  function opShowModeSet(mode){
    try{
      if (typeof localStorage === 'undefined') return;
      if (mode === 'PAID') localStorage.setItem(OP_PAID_LS, '1');
      else localStorage.removeItem(OP_PAID_LS);
    }catch(e){}
  }

  /* This desk's paid mechanics — the shared hgFwdPaidKinds read (the exact
     hgOmniPoolRead chain the FORWARD table and the 20X forward-paid gate
     judge by), at this desk's own MIN_RR. [] when anything is missing. */
  function opPaidKinds(){
    var fn = gfn('hgFwdPaidKinds');
    if (!fn) return [];
    try{ return fn('OMNIPRESENT', MIN_RR) || []; }catch(e){ return []; }
  }

  function opMechOf(c){
    return 'OP-' + (String(c && c.dir || '').toLowerCase() === 'short' ? 'HIGH-REJECT' : 'LOW-REJECT');
  }

  function opPaintCatalog(ui){
    try{
      if (!ui || !ui.catalog) return;
      var htmlFn = gfn('hgCryptoCatalogHtml');
      var engFn = gfn('hgCryptoCatalogEngine');
      if (!htmlFn || !engFn) return;
      ui.catalog.innerHTML = htmlFn(engFn([], {}));
    }catch(e){}
  }

  function opUniformLeadHtml(cands, tape){
    try{
      var compose = gfn('hgCryptoUniformCompose');
      var htmlFn = gfn('hgCryptoUniformHtml');
      if (!compose || !htmlFn) return '';
      return '<div data-hg-crypto-uniform-desk="1" style="grid-column:1/-1;display:block;width:100%">'
        + htmlFn(compose(cands || [], { desk: 'OMNIPRESENT', tape: tape }))
        + '</div>';
    }catch(e){ return ''; }
  }

  function opPaintVerdict(ui){
    try{
      var fn = gfn('hgFwdDeskVerdictHtml');
      if (ui && ui.verdict && fn) ui.verdict.innerHTML = fn('OMNIPRESENT') || '';
    }catch(e){}
    opPaintCatalog(ui);
  }

  function opShowToggleHtml(){
    var mode = opShowMode();
    return '<div class="note" data-op-showmode="' + esc(mode) + '">SHOW: '
      + '<button type="button" class="btn" id="opShowAll"' + (mode === 'ALL' ? ' disabled' : '') + '>ALL</button> '
      + '<button type="button" class="btn ghost" id="opShowPaid"' + (mode === 'PAID' ? ' disabled' : '') + '>PAID-ONLY</button>'
      + ' <span class="dim">PAID-ONLY keeps only setups whose mechanic’s own forward ledger reads ‘has paid’. '
      + 'Nothing is deleted — ALL restores everything.</span></div>';
  }

  function opWireShowToggle(ui, el){
    try{
      if (!ui || !ui.showMode) return;
      ui.showMode.innerHTML = opShowToggleHtml();
      var root = el || ui.showMode;
      var bAll = root.querySelector ? root.querySelector('#opShowAll') : null;
      var bPaid = root.querySelector ? root.querySelector('#opShowPaid') : null;
      if (bAll && bAll.addEventListener) bAll.addEventListener('click', function(){
        opShowModeSet('ALL'); opWireShowToggle(ui, el); opApplyShowMode(ui);
      });
      if (bPaid && bPaid.addEventListener) bPaid.addEventListener('click', function(){
        opShowModeSet('PAID'); opWireShowToggle(ui, el); opApplyShowMode(ui);
      });
    }catch(e){}
  }

  /* The PAID-ONLY card view, built from the same ranked head the ALL view
     carded. Pure over its inputs, exported for the harness. This desk's pool
     is young: until a mechanic reads 'has paid' the summary says exactly
     that, with the live settled count — never a silent blank. */
  function opPaidCardsHtml(top, sideRead, paidKinds){
    var paid = (Object.prototype.toString.call(paidKinds) === '[object Array]') ? paidKinds : [];
    var arr = (Object.prototype.toString.call(top) === '[object Array]') ? top : [];
    var kept = [], hidden = 0, i, c;
    for (i = 0; i < arr.length; i++){
      c = arr[i]; if (!c) continue;
      if (paid.indexOf(opMechOf(c)) >= 0) kept.push(c); else hidden++;
    }
    var settled = 0;
    try{ var scFn = gfn('hgFwdSettledCount'); if (scFn) settled = scFn('OMNIPRESENT') || 0; }catch(eS){}
    var h = '<div class="note warn" data-op-paidonly="1" style="display:block"><b>PAID-ONLY</b> — ';
    if (!paid.length){
      h += 'no mechanic on this tab has a paid forward record yet (pool: ' + settled + ' settled)'
        + (hidden ? ' — ' + hidden + ' setup(s) hidden' : '')
        + ', mechanics without a paid forward record. ';
    } else {
      h += hidden + ' setup(s) hidden by PAID-ONLY — mechanics without a paid forward record '
        + '(paid: ' + esc(paid.join(', ')) + '). ';
    }
    h += 'The 20X section below keeps its own gates (already stricter); under PAID-ONLY its '
      + 'geometry-only tier is hidden. Click ALL to restore everything.</div>';
    for (i = 0; i < kept.length; i++) h += opCard(kept[i], sideRead);
    if (!kept.length) h += '<div class="empty">no PAID-ONLY setup this scan.</div>';
    return h;
  }

  /* Apply the persisted mode to the last completed paint. ALL restores the
     captured bytes verbatim; PAID rebuilds cards + 20X from the snapshot. */
  function opApplyShowMode(ui){
    try{
      if (!ui || !ui.cards) return;
      var mode = opShowMode();
      if (mode !== 'PAID'){
        if (__op.lastAllView){
          try{ ui.cards.innerHTML = __op.lastAllView.cards; }catch(e1){}
          try{ if (ui.x20 && __op.lastAllView.x20 != null) ui.x20.innerHTML = __op.lastAllView.x20; }catch(e2){}
        }
        return;
      }
      if (!__op.lastView) return;   /* no scan yet — nothing to filter */
      var paid = opPaidKinds();
      ui.cards.innerHTML = opUniformLeadHtml(__op.lastView.one || __op.lastView.top, __op.lastView.sideRead && __op.lastView.sideRead.side)
        + opPaidCardsHtml(__op.lastView.top, __op.lastView.sideRead, paid);
      /* MOST PROBABLE pin follows the same filter. */
      try{
        if (typeof W.hgMpPin === 'function'){
          var keptTop = [], i, c;
          for (i = 0; i < (__op.lastView.top || []).length; i++){
            c = __op.lastView.top[i];
            if (c && paid.indexOf(opMechOf(c)) >= 0) keptTop.push(c);
          }
          W.hgMpPin('omnipresent', keptTop, null, ui.cards);
        }
      }catch(eMp){}
      /* 20X keeps its own gates — not re-filtered — but its geometry-only
         tier (quality unproven by definition) is withheld under PAID-ONLY. */
      try{
        if (ui.x20) ui.x20.innerHTML = opX20SectionHtml(__op.lastView.one, { hideGeomTier: true });
      }catch(eX){}
    }catch(e){}
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
      try{
        if (typeof S !== 'undefined' && S && S.fng) fng = S.fng;
        else if (W.S && W.S.fng) fng = W.S.fng;
      }catch(e2){}
      var read = sideFn(pic, fng);
      try{ if (ui && ui.side) ui.side.innerHTML = htmlFn(read, { oneSide: true }); }catch(e3){}
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
    var showT1 = c.t1, showT2 = c.t2, showRr1 = c.rr1, showRr2 = c.rr2;
    var orderCard = gfn('hgOrderRunnerTargets');
    if (orderCard){
      var oc = orderCard(c.dir, c.entry, c.t1, c.t2);
      if (oc && isFinite(fin(oc.t1))){
        showT1 = oc.t1;
        showT2 = (oc.dropped || !isFinite(fin(oc.t2))) ? NaN : oc.t2;
        var rC = Math.abs(fin(c.entry) - fin(c.stop));
        if (rC > 0){
          showRr1 = Math.abs(fin(showT1) - fin(c.entry)) / rC;
          showRr2 = isFinite(fin(showT2)) ? Math.abs(fin(showT2) - fin(c.entry)) / rC : NaN;
        }
      }
    }
    h += '<div>ENTRY <b>' + pxF(c.entry) + '</b>' + (c.status === 'TRIGGERED' ? ' (live)' : ' (at the zone)')
       + (c.entryType ? (' · ' + esc(String(c.entryType))) : '')
       + ' · SL <b>' + pxF(c.stop) + '</b> (squeezed: zone + ' + STOP_PAD_ATR + 'xATR)'
       + ' · TP1 <b>' + pxF(showT1) + '</b> (' + (isFinite(fin(showRr1)) ? fin(showRr1).toFixed(1) : '2') + 'R'
       + (c.t1Source ? (' · ' + esc(String(c.t1Source))) : '') + ')'
       + ' · TP2 <b>' + pxF(showT2) + '</b> (' + (isFinite(fin(showRr2)) ? fin(showRr2).toFixed(1) : '?') + 'R)</div>';
    if (isFinite(fin(c.formationScore)) || isFinite(fin(c.fillProb))
        || (c.evidenceChips && c.evidenceChips.length) || c.liveNote){
      h += '<div class="dim">FORMATION'
        + (isFinite(fin(c.formationScore)) ? (' ' + fin(c.formationScore)) : '')
        + (isFinite(fin(c.edgeScore)) ? (' · EDGE ' + Math.round(fin(c.edgeScore))) : '')
        + (isFinite(fin(c.fillProb)) ? (' · fill ' + fin(c.fillProb) + '%') : '')
        + (c.fillNote ? (' · ' + esc(String(c.fillNote).slice(0, 80))) : '')
        + ((c.evidenceChips && c.evidenceChips.length) ? (' · ' + esc(c.evidenceChips.join(' · '))) : '')
        + (c.liveNote ? (' · ' + esc(String(c.liveNote).slice(0, 80))) : '')
        + '</div>';
    }
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
      + '(swing highs/lows, prior-day extremes, Donchian edges, value-area edges, round numbers, AVWAP bands); 3+ sources within a third of an ATR is a ZONE. '
      + 'Read exhaustion on the approach (RSI divergence, volume climax, ATR stretch, squeeze release). ARMED = you hold the level before price arrives (WATCH — not a ticket); '
      + 'TRIGGERED = swept and rejected, enter at market. Stop sits just beyond the zone — the zone IS the invalidation, which is why it can stay squeezed. '
      + 'TICKET requires 3+ level sources, 2+ exhaustion reads including a real rejection, a daily stack that does not fight the fade, and a running trend only with RSI divergence. '
      + 'Thin zones, one-read “setups”, and an adverse third of the context panel are vetoes. Every triggered plan is forward-logged under OMNIPRESENT. '
      + '<b>Anticipation, not prophecy</b> — these are the levels where reversals have the best structural odds; the forward pool is the judge.</div>'
      + opDeskStanceBannerHtml()
      + '<div class="note" id="opStat">idle — press RUN.</div>'
      + '<div class="note warn" id="opWarn" style="display:none"></div>'
      + '<div class="row" style="margin-top:8px"><button class="btn" id="opRun">RUN OMNIPRESENT SCAN</button></div>'
      /* DESK VERDICT + PAID-ONLY toggle (hg-v540) — under the banners, above
         the cards. The strip fills from the live pool at mount and again
         after every scan. */
      + '<div id="opVerdict" style="margin-top:8px"></div>'
      + '<div id="opCatalog" style="margin-top:8px"></div>'
      + '<div id="opShowMode" style="margin-top:8px"></div>'
      + '<div id="opSide"></div>'
      + '<div class="cards" id="opCards" style="margin-top:12px"></div>'
      + '<div id="opX20" style="margin-top:12px"></div>'
      + '</div>';
    var ui = { btn: el.querySelector('#opRun'), stat: el.querySelector('#opStat'), warn: el.querySelector('#opWarn'),
               side: el.querySelector('#opSide'), cards: el.querySelector('#opCards'), x20: el.querySelector('#opX20'),
               verdict: el.querySelector('#opVerdict'), catalog: el.querySelector('#opCatalog'),
               showMode: el.querySelector('#opShowMode') };
    if (!ui.btn || !ui.stat || !ui.cards) return;
    __op.ui = ui;
    /* Remount must not look like a first visit — restore the last completed scan. */
    if (__op.lastCardsHtml){
      try { ui.cards.innerHTML = __op.lastCardsHtml; } catch (eM) {}
      if (__op.lastStat) opStat(ui, __op.lastStat);
      if (ui.x20 && __op.lastX20Html != null){
        try { ui.x20.innerHTML = __op.lastX20Html; } catch (eX20) {}
      }
    }
    try{ opPaintVerdict(ui); }catch(ePv0){}
    try{ opWireShowToggle(ui, el); }catch(eTg0){}
    /* 20X: restore the last rendered section across remounts (the omniroute
       last20xHtml idiom), else the pre-scan placeholder. */
    try{ if (ui.x20) ui.x20.innerHTML = __op.lastX20Html || opX20Placeholder(); }catch(eX20m){}
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
      if (__op.snap && isFinite(__op.snap.at) && (Date.now() - __op.snap.at) < OP_FRESH_MS)
        return 'skipped: fresh';
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
    window.opBetterCand = opBetterCand;
    window.opOnePerContract = opOnePerContract;
    window.opRankHead = opRankHead;
    window.opNextCloses = opNextCloses;
    window.opFormCandidate = opFormCandidate;
    /* 20X face — the adapter, the qualify wrapper and the renderer, exported
       so each is testable on a synthetic candidate apart from a live scan. */
    window.opX20Wrap = opX20Wrap;
    window.opX20Qualify = opX20Qualify;
    window.opX20SectionHtml = opX20SectionHtml;
    /* Replay evidence — the baked audited table plus the runtime quality
       rule and the geometry-only detector, exported so a harness can prove
       the rule COMPUTES from the rows (mutate the table, watch the section
       flip) instead of trusting prose. */
    window.HG_OP_REPLAY_EVIDENCE = HG_OP_REPLAY_EVIDENCE;
    window.opReplayGoldSym = opReplayGoldSym;
    window.opCostDrag = opCostDrag;
    window.opDeskStanceBannerHtml = opDeskStanceBannerHtml;
    window.opX20ReplayQuality = opX20ReplayQuality;
    window.opX20ReplayLine = opX20ReplayLine;
    window.opX20GeomOnly = opX20GeomOnly;
    /* PAID-ONLY + DESK VERDICT (hg-v540) — mode state, the filter view and
       the apply step, exported so the harness proves the filter keeps
       exactly the paid mechanics and that ALL restores the captured bytes. */
    window.opShowMode = opShowMode;
    window.opShowModeSet = opShowModeSet;
    window.opPaidKinds = opPaidKinds;
    window.opPaidCardsHtml = opPaidCardsHtml;
    window.opApplyShowMode = opApplyShowMode;
    window.hgOpRunScan = runScan;   /* the scan loop itself, for the stability harness */
    window.hgOpState = function (){ try{ return __op.snap ? JSON.parse(JSON.stringify(__op.snap)) : null; }catch(e){ return null; } };
    window.HG_tabs = window.HG_tabs || [];
    window.HG_tabs.push({ id: 'omnipresent', label: 'OMNIPRESENT', mount: mountOmnipresent, refresh: refreshOmnipresent });
  }
})();
