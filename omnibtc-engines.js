/* =========================================================================
HARDGATE — omnibtc-engines.js
The house strategies OMNIBTC was not calling. Each one is an existing
desk rule, pointed at BTC only. None of them invent ENTRY / STOP / T1.

WHY THIS FILE EXISTS. omnibtc.js already runs SWING / SCALP / EDGE / MR /
sniper / liq flush / squeeze / trend / OMNIROUTE / contract-report.
The CRYPTO tabs that were still missing from that list live here:

  SMART $ ........ smartClassify + smartSetup (needs a positioning snap)
  OI FLOW ........ oiflowClassify + oiflowSetup (same)
  FUNDING FADE ... swingTryFundingFade / scalpTryFundingFade — NOT 7/7 CLEAN
  COIL / DIV / TRAP  the same gates as those tabs, one BTC tape
  SMC ............ pineSmcCore (levels only when ChoCh printed on the last bar)
  STAR TRADER .... stSynthesize — votes the engines above; uses their plan

EVIDENCE, not tickets:
  ONCHAIN, TERM BASIS, CARRY, flow-trap / post-gate veto, chart-vision boost.
  Silent = UNCHECKED. They confirm, demote or refuse. They never mint levels.

  hg-v1002 — THE FUNDAMENTAL STACK. The tape is only half the read; the
  desk now also weighs what the app ALREADY fetches but this tab never
  read: FEAR & GREED extremes (contrarian, the house S2 80/20 lines),
  Deribit 25d risk-reversal extremes (the house |8| line), DVOL and BTC
  dominance as info-only priors (a vol prior and a dominance print never
  vote), and the event calendar — a red-folder blackout REFUSES, the same
  severity as the flow veto. A decisive fundamental headwind (2+ net
  checked votes against the candidate's direction) demotes to watch-only;
  ONE WITNESS NEVER FLIPS A SETUP. 2+ net votes with the direction print a
  TAILWIND chip. Chips inform, gates decide: the stack never mints levels,
  never moves rank math, and an unread feed stays UNCHECKED, never faked.
  When the host has not warmed Fear & Greed or BTC dominance, the gather
  asks alternative.me and CoinGecko once. A failed fetch stays unread.
  Binance BTCUSDT global long/short (free, 4h) votes only at the house
  65/35 retail lines — inside the band it is checked and silent. One
  crowded print still cannot flip a setup by itself.
  hg-v1003: the stack itself now lives in fundamental-stack.js — one shared
  asset-aware source of truth for every crypto and gold desk; the
  hgObtcFundamental* wrappers below delegate to it and fail open without it.
  hg-v1011 — REAL FLOW. hgObtcGatherExtra now fetches Binance's BTCUSDT
  taker long/short series (4h, 120 windows, cached) into extra.takerSeries
  — the seam contract-report's CVD row always accepted and was never fed,
  so it read the candle-approximated stand-in for the life of the desk.
  Real aggressor flow when the feed is up; the honest stand-in, labelled,
  when it is not.

WHAT THIS FILE WILL NOT DO.
  - Claim 7/7 CLEAN. That badge stays on swingTryClean / scalpTryClean.
    Every extra engine is stamped near or forming.
  - Run APEX (that desk is alts versus BTC).
  - Run BEST / SUPER / BRAIN full-universe scans (BEST is swingTryClean
    again; SUPER and BRAIN need a warmed multi-asset snap).
  - Loosen G1–G7 or invent a ticket when every engine is quiet.

Classic script, IIFE. Every call is feature-checked. Never throws at load.
========================================================================= */
'use strict';

(function(){

  var W = (typeof window !== 'undefined') ? window : globalThis;

  function gfn(name){
    return (W && typeof W[name] === 'function') ? W[name] : null;
  }
  function fin(v){
    if (v === null || v === undefined || v === '') return NaN;
    var n = +v;
    return isFinite(n) ? n : NaN;
  }
  function lastOf(a){
    return (a && a.length) ? a[a.length - 1] : undefined;
  }
  function dirOf(v){
    var d = String(v || '').toLowerCase();
    if (d === 'buy' || d === 'l' || d === 'long') return 'long';
    if (d === 'sell' || d === 's' || d === 'short') return 'short';
    return '';
  }
  function hasLevels(r){
    if (!r) return false;
    var e = fin(r.entry), s = fin(r.stop), t1 = fin(r.t1 != null ? r.t1 : r.tp);
    return isFinite(e) && e > 0 && isFinite(s) && s > 0 && e !== s && isFinite(t1) && t1 > 0;
  }

  /* Extra engines are never G1–G7 CLEAN. near = watch with levels.
     forming = coil-style draft. The picker already knows that rule. */
  function watchRow(hit, engine, kind){
    if (!hasLevels(hit)) return null;
    var dir = dirOf(hit.dir);
    if (!dir) return null;
    var t1 = fin(hit.t1 != null ? hit.t1 : hit.tp);
    var row = {
      dir: dir,
      entry: fin(hit.entry),
      stop: fin(hit.stop),
      t1: t1,
      t2: fin(hit.t2),
      rr: fin(hit.rr != null ? hit.rr : hit.rr1),
      source: engine,
      name: engine,
      engine: engine,
      strategy: engine,
      clean: false,
      near: kind !== 'forming',
      nearClean: kind !== 'forming',
      forming: kind === 'forming',
      passed: kind === 'forming' ? 5 : 6,
      gatesPassed: kind === 'forming' ? 5 : 6,
      gatesTotal: 7
    };
    if (!isFinite(row.t2) || row.t2 <= 0) delete row.t2;
    if (!isFinite(row.rr)) delete row.rr;
    return row;
  }

  function ledgerRow(name, state, dir, detail){
    return { name: name, state: state || 'idle', dir: dir || null, detail: detail || '' };
  }

  /* hg-v1002: index.html keeps its macro reads on a top-level `const S` —
     reachable from classic scripts by bare name, NEVER on window. Probe
     both, guard both; TDZ and a missing binding both read as absent. */
  function hostS(){
    try{ if (W.S) return W.S; }catch(e0){}
    try{ if (typeof S !== 'undefined' && S) return S; }catch(e1){}
    return null;
  }

  /* ---- COIL (same gates as runCoilScanLeg) ------------------------- */
  function hgObtcTryCoil(rows4h){
    try{
      if (!rows4h || rows4h.length < 80) return null;
      if (!gfn('bollinger') || !gfn('volZ') || !gfn('ema')) return null;
      var c = rows4h.map(function(r){ return r.c; });
      var p = c[c.length - 1];
      var bb = W.bollinger(c, 20, 2);
      if (!bb || !bb.widthPct) return null;
      var currentWidth = bb.widthPct[c.length - 1];
      var pastWidths = bb.widthPct.slice(-51, -1).filter(isFinite);
      if (!pastWidths.length) return null;
      var avgWidth = pastWidths.reduce(function(a, b){ return a + b; }, 0) / pastWidths.length;
      if (!(currentWidth < avgWidth * 0.75)) return null;
      var vz = W.volZ(rows4h, 20);
      if (!(vz < -0.5)) return null;
      var e200 = lastOf(W.ema(c, 200));
      if (!(p > e200)) return null;
      var recent = rows4h.slice(-20);
      var coilLow = Math.min.apply(null, recent.map(function(r){ return r.l; }));
      var coilHigh = Math.max.apply(null, recent.map(function(r){ return r.h; }));
      var pl = gfn('hgPlanLevels') ? W.hgPlanLevels('long', rows4h, coilLow) : null;
      if (!pl || !hasLevels(pl)) return null;
      var row = watchRow(Object.assign({}, pl, { dir: 'long' }), 'COIL', 'forming');
      if (row) row.detail = 'BB squeeze · vol drought · above 4H 200 EMA · coil ' + coilLow + '–' + coilHigh;
      return row;
    }catch(e){ return null; }
  }

  /* ---- DIV (same gates as runDivScanLeg) --------------------------- */
  function hgObtcTryDiv(rows4h, ticker){
    try{
      if (!rows4h || rows4h.length < 80) return null;
      if (!gfn('rsi') || !gfn('findPivots') || !gfn('atr')) return null;
      var c = rows4h.map(function(r){ return r.c; });
      var n = c.length;
      var rv = W.rsi(c, 14);
      var pivots = W.findPivots(c, 3);
      var highs = pivots.filter(function(p){ return p.type === 'high'; });
      var lows = pivots.filter(function(p){ return p.type === 'low'; });
      var dir = null, kindLabel = null, pivA = null, pivB = null;
      if (highs.length >= 2){
        var h1 = highs[highs.length - 2], h2 = highs[highs.length - 1];
        if (h2.i - h1.i >= 10 && isFinite(rv[h1.i]) && isFinite(rv[h2.i])){
          if (h2.v > h1.v && rv[h2.i] < rv[h1.i]){ dir = 'short'; kindLabel = 'Regular Bearish'; pivA = h1; pivB = h2; }
          else if (h2.v < h1.v && rv[h2.i] > rv[h1.i]){ dir = 'short'; kindLabel = 'Hidden Bearish'; pivA = h1; pivB = h2; }
        }
      }
      if (!dir && lows.length >= 2){
        var l1 = lows[lows.length - 2], l2 = lows[lows.length - 1];
        if (l2.i - l1.i >= 10 && isFinite(rv[l1.i]) && isFinite(rv[l2.i])){
          if (l2.v < l1.v && rv[l2.i] > rv[l1.i]){ dir = 'long'; kindLabel = 'Regular Bullish'; pivA = l1; pivB = l2; }
          else if (l2.v > l1.v && rv[l2.i] < rv[l1.i]){ dir = 'long'; kindLabel = 'Hidden Bullish'; pivA = l1; pivB = l2; }
        }
      }
      if (!dir || !pivB) return null;
      if ((n - 1 - pivB.i) > 15) return null;
      if (gfn('cusumLast')){
        var ev = W.cusumLast(c, 1);
        if (ev && ev.barsAgo <= 10){
          if ((dir === 'long' && ev.dir === 'short') || (dir === 'short' && ev.dir === 'long')) return null;
        }
      }
      var fr = ticker && ticker.fundingPct;
      if (fr != null && isFinite(+fr)){
        if (Math.abs(+fr) > 0.05 - 1e-9) return null;
        if ((dir === 'long' && +fr >= 0.04) || (dir === 'short' && +fr <= -0.04)) return null;
      }
      var p = c[n - 1];
      var a4 = lastOf(W.atr(rows4h, 14));
      if (!isFinite(a4) || a4 <= 0) return null;
      var entry = p;
      var stop = dir === 'long' ? pivB.v - 0.75 * a4 : pivB.v + 0.75 * a4;
      var maxStop = 2 * a4;
      if (dir === 'long' && entry - stop > maxStop) stop = entry - maxStop;
      if (dir === 'short' && stop - entry > maxStop) stop = entry + maxStop;
      var risk = Math.abs(entry - stop);
      if (!(risk > 0)) return null;
      var t1 = dir === 'long' ? entry + 2 * risk : entry - 2 * risk;
      var t2 = dir === 'long' ? entry + 3 * risk : entry - 3 * risk;
      if (!(Math.abs(t1 - entry) / risk >= 2)) return null;
      var pl = { dir: dir, type: 'SWING', entry: entry, stop: stop, t1: t1, t2: t2 };
      var apply = gfn('applyExactEntry') || gfn('hgApplyExactEntry');
      if (apply){
        try{ pl = apply(pl, rows4h, { style: 'swing', preferEdge: true, refineLevels: true }) || pl; }catch(eA){}
      }
      var row = watchRow(pl, 'DIV ' + kindLabel, 'near');
      if (row) row.detail = kindLabel + ' · span ' + (pivB.i - pivA.i) + ' bars';
      return row;
    }catch(e){ return null; }
  }

  /* ---- TRAP (same gates as runTrapScanLeg) ------------------------- */
  function hgObtcTryTrap(rows15m){
    try{
      if (!rows15m || rows15m.length < 50) return null;
      if (!gfn('bollinger') || !gfn('atr') || !gfn('rsi')) return null;
      var c = rows15m.map(function(r){ return r.c; });
      var p = c[c.length - 1];
      var a14 = lastOf(W.atr(rows15m, 14));
      if (!isFinite(a14) || !(p > 0)) return null;
      var atrPct = (a14 / p) * 100;
      var outerSD = Math.min(4.5, Math.max(2.5, 3.0 + (atrPct - 0.5) * 0.6));
      var innerSD = Math.min(3.0, Math.max(1.8, 2.0 + (atrPct - 0.5) * 0.3));
      var bbOuter = W.bollinger(c, 20, outerSD);
      var bbInner = W.bollinger(c, 20, innerSD);
      var e20 = bbInner.mid[c.length - 1];
      var lOuter = bbOuter.lower[c.length - 1];
      var lInner = bbInner.lower[c.length - 1];
      var uOuter = bbOuter.upper[c.length - 1];
      var uInner = bbInner.upper[c.length - 1];
      var N = 4, sweptLowAt = -1, sweptHighAt = -1, k;
      for (k = Math.max(0, rows15m.length - N); k < rows15m.length; k++){
        if (rows15m[k].l < lOuter) sweptLowAt = k;
        if (rows15m[k].h > uOuter) sweptHighAt = k;
      }
      var reclaimLong = sweptLowAt >= 0 && p > lInner;
      var reclaimShort = sweptHighAt >= 0 && p < uInner;
      var dir = null, stop = NaN;
      if (reclaimLong){
        var rLow = lastOf(W.rsi(c.slice(0, sweptLowAt + 1), 14));
        if (rLow < 35){ dir = 'long'; stop = rows15m[sweptLowAt].l - (rows15m[sweptLowAt].l * 0.001); }
      }
      if (!dir && reclaimShort){
        var rHigh = lastOf(W.rsi(c.slice(0, sweptHighAt + 1), 14));
        if (rHigh > 65){ dir = 'short'; stop = rows15m[sweptHighAt].h + (rows15m[sweptHighAt].h * 0.001); }
      }
      if (!dir) return null;
      var risk = Math.abs(p - stop);
      if (!(risk > 0)) return null;
      var t1 = e20;
      if (dir === 'long' ? !(t1 > p) : !(t1 < p)) return null;
      if (Math.abs(t1 - p) / risk < 1.5) return null;
      var t2 = dir === 'long' ? uOuter : lOuter;
      var pl = { dir: dir, type: 'SCALP', entry: p, stop: stop, t1: t1, t2: t2 };
      var apply = gfn('applyExactEntry') || gfn('hgApplyExactEntry');
      if (apply){
        try{
          pl = apply(pl, rows15m, {
            style: 'scalp', m15: rows15m,
            poiLevel: dir === 'long' ? lInner : uInner,
            poiLabel: 'inner band', refineLevels: true, reversion: true
          }) || pl;
        }catch(eA){}
      }
      return watchRow(pl, 'TRAP', 'near');
    }catch(e){ return null; }
  }

  function hgObtcTryFundingFade(rows4h, rows1h, rows15m, ticker, mins){
    var out = [], hit;
    if (gfn('swingTryFundingFade') && rows4h && rows4h.length){
      try{
        hit = W.swingTryFundingFade(rows4h, ticker);
        hit = watchRow(hit, 'SWING funding fade', 'near');
        if (hit) out.push(hit);
      }catch(e1){}
    }
    if (gfn('scalpTryFundingFade') && rows1h && rows15m){
      try{
        hit = W.scalpTryFundingFade(rows1h, rows15m, ticker, mins);
        hit = watchRow(hit, 'SCALP funding fade', 'near');
        if (hit) out.push(hit);
      }catch(e2){}
    }
    return out;
  }

  function hgObtcTrySmart(cls, rows4h, rows1h){
    try{
      if (!cls || !cls.dir || !gfn('smartSetup')) return null;
      var setup = W.smartSetup(cls, rows4h, rows1h);
      return watchRow(setup, 'SMART $ ' + (setup && setup.type ? setup.type : ''), 'near');
    }catch(e){ return null; }
  }

  function hgObtcTryOiFlow(cls, rows4h, rows1h){
    try{
      if (!cls || !cls.dir || !gfn('oiflowSetup')) return null;
      var setup = W.oiflowSetup(cls, rows4h, rows1h);
      return watchRow(setup, 'OI FLOW', 'near');
    }catch(e){ return null; }
  }

  function hgObtcTrySmc(rows4h, ticker){
    try{
      if (!gfn('pineSmcCore') || !rows4h) return null;
      var sig = W.pineSmcCore(rows4h);
      var row = watchRow(sig, 'SMC ChoCh', 'near');
      if (!row) return null;
      /* hg-v1043: the 6/7 was a HARDCODED label — no gate was ever evaluated
         behind it, so the card's 'one gate away' was invented and the banner
         had no measured gate to name. Evaluate the real shared 7-gate matrix
         (swingGateMatrix — the raw matrix, NOT swingTryNear, which returns
         null below 6 passes by its NEAR-watch contract) and stamp the honest
         tally, gateMeta and missing-gate list. G6 is re-priced on the SMC
         levels themselves (the matrix's own G6 is priced on ITS plan, which
         this row does not trade). A signal against the matrix's own
         direction is named counter-cascade and stays a watch — the SMC
         levels ride, the gates decide the badge. */
      try{
        if (gfn('swingGateMatrix')){
          var m = W.swingGateMatrix(rows4h, ticker || { symbol: 'BTCUSDT' });
          if (m && Array.isArray(m.gateMeta) && m.gateMeta.length){
            var meta = [], missing = [], passCount = 0, i, g, ok;
            for (i = 0; i < m.gateMeta.length; i++){
              g = m.gateMeta[i];
              if (!g) continue;
              ok = (g.state === 'pass') || (g.pass === true);
              meta.push(Object.assign({}, g, { pass: ok }));
              if (ok) passCount++; else if (g.state === 'veto' || g.pass === false) missing.push(String(g.id || g.label || 'G?'));
            }
            var rr = isFinite(row.rr) ? row.rr : NaN;
            var g6Idx = -1;
            for (i = 0; i < meta.length; i++){
              if (/G6/.test(String(meta[i].id || ''))){ g6Idx = i; break; }
            }
            if (g6Idx >= 0){
              var g6Ok = isFinite(rr) && rr >= 2.0;
              var wasOk = meta[g6Idx].pass === true;
              meta[g6Idx] = Object.assign({}, meta[g6Idx], {
                pass: g6Ok, state: g6Ok ? 'pass' : 'veto',
                detail: 'SMC plan R:R ' + (isFinite(rr) ? rr.toFixed(2) : 'n/a') + ' (need ≥ 2.0)'
              });
              if (wasOk && !g6Ok){ passCount--; missing.push('G6'); }
              else if (!wasOk && g6Ok){ passCount++; missing = missing.filter(function(x){ return x !== 'G6'; }); }
            }
            if (m.dir && m.dir !== row.dir){
              /* counter-cascade: the direction-dependent gates (G2/G3/G7) were
                 evaluated for the CASCADE's side — mark them unevaluated for this
                 row instead of printing their long-side verdicts as if they
                 certified the short. The DIRECTION gate carries the cascade's
                 measured read instead. */
              var di;
              for (di = 0; di < meta.length; di++){
                var dg = meta[di];
                if (dg && /G2|G3|G7/.test(String(dg.id || ''))){
                  if (dg.pass === true) passCount--;
                  meta[di] = Object.assign({}, dg, { pass: false, state: 'na',
                    detail: 'evaluated for the cascade side (' + m.dir + ') — see DIRECTION' });
                }
              }
              passCount = Math.min(passCount, 6);
              meta.push({ id: 'DIR', label: 'Direction', state: 'veto', pass: false,
                detail: 'SMC ChoCh ' + row.dir + ' runs against the 7-gate cascade, which reads ' + m.dir
                  + ' (p ' + (isFinite(m.p) ? m.p.toFixed(0) : 'n/a') + ' vs EMA200 ' + (isFinite(m.e200) ? m.e200.toFixed(0) : 'n/a')
                  + ', RSI ' + (isFinite(m.r14) ? m.r14.toFixed(1) : 'n/a') + ') — counter-trend, watch only' });
              missing.push('DIRECTION');
            }
            /* rebuild the missing list from the FINAL meta — a gate the
               counter-cascade override turned into 'na' is not a failing
               gate of this row */
            missing = [];
            for (var mi = 0; mi < meta.length; mi++){
              /* a VETO is a failing gate; an 'na' (evaluated for the other
                 side) is not — only vetoes join the Waiting list */
              if (meta[mi] && meta[mi].state === 'veto' && meta[mi].id !== 'DIR'){
                missing.push(String(meta[mi].id || meta[mi].label || 'G?'));
              }
            }
            if (m.dir && m.dir !== row.dir) missing.push('DIRECTION');
            row.gateMeta = meta;
            row.passed = passCount;
            row.gatesPassed = passCount;
            row.gatesTotal = 7;
            if (missing.length) row.missing = missing;
            if (passCount >= 7 && (!m.dir || m.dir === row.dir)){
              row.clean = true; row.near = false; row.nearClean = false;
            }
          }
        }
      }catch(eM){ try{ if (gfn('hgFwdWarn')) W.hgFwdWarn('omnibtc', eM); }catch(eW){} }
      return row;
    }catch(e){ return null; }
  }

  function hgObtcTryStarTrader(rows4h, rows1h, rows15m, ticker){
    try{
      if (!gfn('stSynthesize') || !rows4h) return null;
      var syn = W.stSynthesize({
        sym: ticker && ticker.symbol, base: 'BTC', klass: 'crypto',
        exchange: (ticker && ticker.exchange) || 'delta'
      }, rows4h, rows1h, rows15m, ticker);
      if (!syn || !syn.plan) return null;
      var kind = syn.planDraft ? 'forming' : 'near';
      var row = watchRow(syn.plan, 'STAR TRADER ' + (syn.tier || ''), kind);
      if (row && syn.plan.clean && !syn.planDraft){
        /* The plan is a house CLEAN ticket the synthesizer already found.
           Keep it as a watch here so we do not mint a second 7/7 badge;
           the original swingTryClean / scalpTryClean row still competes. */
        row.near = true; row.nearClean = true; row.clean = false; row.forming = false;
      }
      return row;
    }catch(e){ return null; }
  }

  /* ---- hg-v1057 accuracy pack: KAMA + SuperTrend local primitives ------
     Self-contained (cryptoultra.js keeps its own copies; this file never
     imports across desks). Feature-checked at the call sites. */
  function levelsLocal(dir, rows, entry){
    /* the house fallback ladder (trendmxPlanLegacy's own shape): structure
       stop via lastSwing buffered 0.25xATR14 when within 2.5xATR14, else
       1.5xATR14 against the direction; 2R / 3.5R targets. */
    if (!gfn('atr') || !gfn('lastSwing') || !rows || !rows.length || !isFinite(entry) || entry <= 0) return null;
    var aArr = W.atr(rows, 14);
    var a = aArr && isFinite(aArr[aArr.length - 1]) && aArr[aArr.length - 1] > 0 ? aArr[aArr.length - 1] : NaN;
    if (!isFinite(a)) return null;
    var stop = NaN;
    var sw = W.lastSwing(rows, dir, 30);
    if (isFinite(sw)){
      var s = (dir === 'long') ? sw - 0.25 * a : sw + 0.25 * a;
      var risk0 = (dir === 'long') ? entry - s : s - entry;
      if (risk0 > 0 && risk0 <= 2.5 * a) stop = s;
    }
    if (!isFinite(stop)) stop = (dir === 'long') ? entry - 1.5 * a : entry + 1.5 * a;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    return {
      dir: dir, entry: entry, stop: stop,
      t1: entry + (dir === 'long' ? 1 : -1) * 2 * risk,
      t2: entry + (dir === 'long' ? 1 : -1) * 3.5 * risk,
      rr: 2
    };
  }

  function kamaLocal(closes, erWin, fastP, slowP){
    erWin = erWin || 10; fastP = fastP || 2; slowP = slowP || 30;
    var n = closes.length;
    var out = new Array(n).fill(NaN);
    if (n < erWin + 1) return out;
    var fastC = 2 / (fastP + 1), slowC = 2 / (slowP + 1);
    var kama = closes[erWin];
    out[erWin] = kama;
    for (var i = erWin + 1; i < n; i++){
      var net = Math.abs(closes[i] - closes[i - erWin]);
      var gross = 0;
      for (var k = i - erWin + 1; k <= i; k++) gross += Math.abs(closes[k] - closes[k - 1]);
      var er = gross > 0 ? net / gross : 0;
      var sc = Math.pow(er * (fastC - slowC) + slowC, 2);
      kama = kama + sc * (closes[i] - kama);
      out[i] = kama;
    }
    return out;
  }

  function superTrendLocal(rows, p, mult){
    p = p || 10; mult = mult || 3;
    var n = rows.length;
    var aArr = (gfn('atr') && typeof W.atr === 'function') ? W.atr(rows, p) : null;
    if (!aArr || n < p + 1) return null;
    var up = new Array(n).fill(NaN), dn = new Array(n).fill(NaN), side = new Array(n).fill(0);
    for (var i = p; i < n; i++){
      if (!isFinite(aArr[i])) continue;
      var mid = (rows[i].h + rows[i].l) / 2;
      var ub = mid + mult * aArr[i], db = mid - mult * aArr[i];
      if (i === p){ up[i] = ub; dn[i] = db; side[i] = rows[i].c >= ub ? 1 : -1; continue; }
      up[i] = (ub < up[i - 1] || rows[i - 1].c > up[i - 1]) ? ub : up[i - 1];
      dn[i] = (db > dn[i - 1] || rows[i - 1].c < dn[i - 1]) ? db : dn[i - 1];
      side[i] = (side[i - 1] === 1) ? (rows[i].c < dn[i] ? -1 : 1) : (rows[i].c > up[i] ? 1 : -1);
    }
    return { up: up, dn: dn, side: side };
  }

  /* ---- hg-v1057: TSI CROSS mechanic (research B1). The double-smoothed
     momentum line crossing its signal EMA on the 4h tape — the Gate
     Research trend-change read, shipped as a WATCH mechanic the ledger
     measures like every other engine. */
  function hgObtcTryTsi(rows4h){
    try{
      if (!rows4h || rows4h.length < 60) return null;
      if (!gfn('tsi') || !gfn('ema')) return null;
      var c = rows4h.map(function(r){ return r.c; });
      var t = W.tsi(c, 13, 25);
      /* tsi's seed bar is NaN (0/0) — the NaN-skipping ema keeps the signal
         finite through the warmup head; the classic ema would poison it. */
      var sig = (gfn('nanEmaLocal')) ? W.nanEmaLocal(t, 13) : W.ema(t, 13);
      var n = c.length;
      var lastT = t[n - 1], lastSig = sig[n - 1];
      if (!isFinite(lastT) || !isFinite(lastSig)) return null;
      /* epsilon comparisons: a tape pinned at -100 leaves float dust on the
         signal (-100.00000000000003), which would read "below" forever and
         swallow the very cross this mechanic exists to catch. */
      var EPS = 1e-9;
      var dir = null;
      for (var i = n - 2; i >= n - 3 && i >= 0; i--){
        var a = t[i], b = sig[i];
        if (!isFinite(a) || !isFinite(b)) break;
        if (a <= b + EPS && t[i + 1] > sig[i + 1] + EPS){ dir = 'long'; break; }
        if (a + EPS >= b && t[i + 1] < sig[i + 1] - EPS){ dir = 'short'; break; }
      }
      if (!dir) return null;
      /* no sign guard: a long cross out of deeply negative TSI is exactly the
         trend-change read this mechanic ships for (the Gate TSI framing) —
         the cross itself is the signal, and the ledger will judge it. */
      var pl = levelsLocal(dir, rows4h, c[n - 1]);
      if (!pl || !hasLevels(pl)) return null;
      var row = watchRow(Object.assign({}, pl, { dir: dir }), 'TSI CROSS', 'near');
      if (row) row.detail = 'TSI 13/25 ' + lastT.toFixed(2) + ' vs signal ' + lastSig.toFixed(2) + ' — fresh cross';
      return row;
    }catch(e){ return null; }
  }

  /* ---- hg-v1057: ADAPTIVE TREND mechanic (research B3). KAMA(10,2,30)
     side + SuperTrend(10,3) side must agree on the 4h tape — the Adaptive
     Trend Shield pattern. Levels are the house plan off the last close. */
  function hgObtcTryAdaptive(rows4h){
    try{
      if (!rows4h || rows4h.length < 80) return null;
      var c = rows4h.map(function(r){ return r.c; });
      var n = c.length;
      var ka = kamaLocal(c);
      if (!isFinite(ka[n - 1]) || !isFinite(ka[n - 2])) return null;
      var st = superTrendLocal(rows4h, 10, 3);
      if (!st || !st.side[n - 1]) return null;
      var kamaUp = ka[n - 1] > ka[n - 2], kamaDn = ka[n - 1] < ka[n - 2];
      var stSide = st.side[n - 1];
      var dir = null;
      if (kamaUp && stSide === 1) dir = 'long';
      else if (kamaDn && stSide === -1) dir = 'short';
      if (!dir) return null;
      var pl = levelsLocal(dir, rows4h, c[n - 1]);
      if (!pl || !hasLevels(pl)) return null;
      var row = watchRow(Object.assign({}, pl, { dir: dir }), 'ADAPTIVE TREND', 'near');
      if (row) row.detail = 'KAMA 10,2,30 ' + ka[n - 1].toFixed(2) + ' + SuperTrend 10,3 agree ' + dir;
      return row;
    }catch(e){ return null; }
  }

  /* ---- hg-v1057: WYCKOFF SPRING mechanic (research B4). A liquidity
     sweep BELOW a range low (choppy precondition) that the last bar
     reclaims on springboard volume (>= 2x the 20-bar norm). The stop
     sits beyond the sweep extreme — the spring's whole geometry. */
  function hgObtcTrySpring(rows4h){
    try{
      if (!rows4h || rows4h.length < 60) return null;
      if (!gfn('hgChoppiness') || !gfn('atr')) return null;
      var n = rows4h.length;
      var chopArr = W.hgChoppiness(rows4h, 14);
      /* the range precondition reads the PRE-SWEEP bar (n-5): the sweep and
         its reclaim are the range's end, and they widen the last window's
         hi-lo so much that the chop read would call the spring's own exit
         "trending". A Wyckoff spring is a range first, a sweep second. */
      var chopPre = (n >= 20) ? chopArr[n - 5] : NaN;
      if (!isFinite(chopPre) || chopPre < 61.8) return null;
      var atrArr = W.atr(rows4h, 14);
      var aNow = atrArr[n - 1];
      if (!isFinite(aNow) || aNow <= 0) return null;
      var last = rows4h[n - 1];
      var volSum = 0, volN = 0;
      for (var k = n - 21; k < n - 1; k++){ var v = +rows4h[k].v; if (isFinite(v) && v > 0){ volSum += v; volN++; } }
      if (!volN) return null;
      var volMean = volSum / volN;
      if (!(+last.v >= 2 * volMean)) return null;               /* springboard volume */
      var dir = null, sweepExt = NaN;
      for (var i = n - 5; i <= n - 1; i++){
        var prior = rows4h.slice(Math.max(0, i - 20), i);
        if (prior.length < 5) continue;
        var priorLow = Math.min.apply(null, prior.map(function(r){ return +r.l; }));
        var priorHigh = Math.max.apply(null, prior.map(function(r){ return +r.h; }));
        if (rows4h[i].l < priorLow && last.c > priorLow){ dir = 'long'; sweepExt = +rows4h[i].l; break; }
        if (rows4h[i].h > priorHigh && last.c < priorHigh){ dir = 'short'; sweepExt = +rows4h[i].h; break; }
      }
      if (!dir || !isFinite(sweepExt)) return null;
      var entry = +last.c;
      var risk = (dir === 'long') ? (entry - (sweepExt - 0.2 * aNow)) : ((sweepExt + 0.2 * aNow) - entry);
      if (!(risk > 0)) return null;
      var pl = {
        dir: dir, entry: entry,
        stop: dir === 'long' ? sweepExt - 0.2 * aNow : sweepExt + 0.2 * aNow,
        t1: entry + (dir === 'long' ? 1 : -1) * 2 * risk,
        t2: entry + (dir === 'long' ? 1 : -1) * 3.5 * risk,
        rr: 2
      };
      var row = watchRow(pl, 'SPRING', 'near');
      if (row) row.detail = 'range chop ' + chopPre.toFixed(0) + ' (pre-sweep) · sweep ' + sweepExt.toFixed(2) + ' reclaimed on ' + (+last.v / volMean).toFixed(1) + 'x volume';
      return row;
    }catch(e){ return null; }
  }

  function classifySmart(extra, ticker, live){
    if (!gfn('smartClassify')) return null;
    var snap = extra && extra.smart;
    var inp = gfn('smartClsInput') && snap ? W.smartClsInput(snap) : {
      chg24: ticker && ticker.chg24 != null ? ticker.chg24 : null,
      oiChgPct: snap && snap.oiChgPct != null ? snap.oiChgPct : (live && live.oiChg),
      fundingPct: snap && snap.fundingPct != null ? snap.fundingPct
        : (ticker && ticker.fundingPct != null ? ticker.fundingPct : (live && live.fundingPct)),
      retailLongPct: snap && snap.retailLongPct != null ? snap.retailLongPct : null,
      topLongPct: snap && snap.topLongPct != null ? snap.topLongPct : null,
      takerRatio: snap && snap.takerRatio != null ? snap.takerRatio : null
    };
    try{ return W.smartClassify(inp); }catch(e){ return null; }
  }

  function classifyOi(extra, live){
    if (!gfn('oiflowClassify')) return null;
    var snap = extra && extra.smart;
    var d = {
      pxChg: live && live.pxChg,
      oiChg: live && live.oiChg,
      fundingZ: null,
      longPct: snap && snap.retailLongPct,
      takerAvg: snap && snap.takerRatio
    };
    if (d.pxChg == null && d.oiChg == null && d.longPct == null) return null;
    try{ return W.oiflowClassify(d); }catch(e){ return null; }
  }

  function hgObtcRunExtraEngines(rows4h, rows1h, rows15m, ticker, extra){
    extra = extra || {};
    var out = [];
    var ledger = [];
    var mins = 120;
    try{ if (gfn('tickClock')) mins = W.tickClock(); }catch(e){}
    var live = extra.live || (gfn('hgLiveFormationSnap') && ticker
      ? W.hgLiveFormationSnap(ticker.symbol, extra.dir) : null);

    function take(name, row, idleDetail){
      if (row && hasLevels(row)){
        var refused = false;
        if (gfn('hgObtcApplyOmniPrincipal')){
          var app = W.hgObtcApplyOmniPrincipal(row);
          if (!app || !app.pickable) refused = true;
        } else if (gfn('hgDeskFormationEdgeApply')){
          var tab = 'coil';
          var n = String(name || '').toUpperCase();
          if (/DIV/.test(n)) tab = 'divergence';
          else if (/TRAP/.test(n)) tab = 'trap';
          else if (/SMART/.test(n)) tab = 'smart';
          else if (/OI FLOW/.test(n)) tab = 'oiflow';
          else if (/SMC/.test(n)) tab = 'smc';
          else if (/FUNDING/.test(n)) tab = 'fund-fade';
          W.hgDeskFormationEdgeApply(row, { tab: tab, dir: row.dir });
          if (row.deskEdgeAction === 'suppress' || row.deskEdgeAction === 'demote') refused = true;
        }
        if (refused){
          ledger.push(ledgerRow(name, 'idle', row.dir, 'day book refused — ' + (row.deskEdgeWhy || row.omniPrincipal || 'principal')));
          return;
        }
        out.push(row);
        ledger.push(ledgerRow(name, 'signal', row.dir, row.detail || row.engine));
      } else {
        ledger.push(ledgerRow(name, 'idle', null, idleDetail || 'no ticket'));
      }
    }

    take('COIL', hgObtcTryCoil(rows4h), 'no BB squeeze above the 200 EMA');
    take('DIV', hgObtcTryDiv(rows4h, ticker), 'no fresh RSI pivot divergence');
    take('TRAP', hgObtcTryTrap(rows15m), 'no 15m sweep-and-reclaim');

    hgObtcTryFundingFade(rows4h, rows1h, rows15m, ticker, mins).forEach(function(hit){
      take(hit.engine, hit, '');
    });
    if (!out.some(function(r){ return /funding fade/i.test(r.engine || ''); })){
      ledger.push(ledgerRow('FUNDING FADE', 'idle', null, 'G4 not crowded or fade plan refused'));
    }

    var smartCls = classifySmart(extra, ticker, live);
    take('SMART $', hgObtcTrySmart(smartCls, rows4h, rows1h),
      smartCls && smartCls.dir ? 'classify fired, setup builder refused' : 'no positioning snap or no direction');

    var oiCls = classifyOi(extra, live);
    take('OI FLOW', hgObtcTryOiFlow(oiCls, rows4h, rows1h),
      oiCls && oiCls.dir ? 'classify fired, setup builder refused' : 'OI/price legs silent');

    take('SMC ChoCh', hgObtcTrySmc(rows4h, ticker), 'no last-bar ChoCh with FVG levels');
    take('STAR TRADER', hgObtcTryStarTrader(rows4h, rows1h, rows15m, ticker),
      'no majority, or synthesis vetoed');
    /* hg-v1057 accuracy pack: the three measured WATCH mechanics — TSI cross,
       adaptive trend (KAMA + SuperTrend) and the Wyckoff spring. Each mints
       only on its own tape; the ledger judges whether any of them earns a
       crown, exactly like every other engine. */
    take('TSI CROSS', hgObtcTryTsi(rows4h), 'no TSI 13/25 cross in the last 3 bars');
    take('ADAPTIVE TREND', hgObtcTryAdaptive(rows4h), 'KAMA + SuperTrend disagree or unreadable');
    take('SPRING', hgObtcTrySpring(rows4h), 'no range-bound spring with springboard volume');

    return { candidates: out, ledger: ledger };
  }

  /* ---- hg-v1003: THE FUNDAMENTAL STACK — now house-wide --------------
     The legs, thresholds and decision rules that shipped here in hg-v1002
     moved to fundamental-stack.js — ONE asset-aware source of truth every
     crypto and gold desk reads. These wrappers delegate so OMNIBTC keeps
     its exact v1002 behaviour (the shared module's BTC board is the same
     seven legs) and fail open to the pre-stack behaviour when the module
     is not loaded. */
  function hgObtcFundamentalLegs(extra){
    if (gfn('hgFundamentalLegs')){
      try{ return W.hgFundamentalLegs('btc', extra || {}) || []; }catch(e){}
    }
    return [];
  }

  /* Binance global long/short, account-weighted. The house fade lines live
     in positioning.js (65 / 35). Inside the band the print is checked and
     casts no vote. A missing or out-of-range print stays unread. */
  function hgObtcRetailLeg(extra){
    var ls = extra && extra.retailLs;
    var pct = ls && ls.latest ? +ls.latest.longPct : NaN;
    if (!isFinite(pct) || pct < 0 || pct > 100){
      return { key: 'retail', label: 'RETAIL LONG/SHORT', vote: 'neutral', state: 'unchecked',
        text: 'Binance BTCUSDT global long/short absent' };
    }
    var vote = pct >= 65 ? 'bear' : (pct <= 35 ? 'bull' : 'neutral');
    return { key: 'retail', label: 'RETAIL LONG/SHORT', vote: vote, state: 'checked',
      extreme: vote !== 'neutral',
      text: pct.toFixed(1) + '% long'
        + (vote === 'bear' ? ' — crowded long (house >=65 fade)'
          : vote === 'bull' ? ' — crowded short (house <=35 fade)'
          : ' — inside 35-65, no vote') };
  }

  function hgObtcWithRetail(r, extra){
    var i, leg;
    if (!r || !Array.isArray(r.legs)) return r;
    for (i = 0; i < r.legs.length; i++){
      if (r.legs[i] && r.legs[i].key === 'retail') return r;
    }
    leg = hgObtcRetailLeg(extra);
    r.legs.push(leg);
    if (leg.state !== 'checked') return r;
    r.checked = (r.checked || 0) + 1;
    if (leg.vote === 'bull') r.bulls = (r.bulls || 0) + 1;
    else if (leg.vote === 'bear') r.bears = (r.bears || 0) + 1;
    if ((r.bulls || 0) === 0 && (r.bears || 0) === 0) r.regime = 'quiet';
    else if (r.bulls === r.bears) r.regime = 'mixed';
    else r.regime = r.bulls > r.bears ? 'bullish' : 'bearish';
    return r;
  }

  function hgObtcFundamentalRegime(extra){
    if (gfn('hgFundamentalRegime')){
      try{
        var r = W.hgFundamentalRegime('btc', extra || {});
        if (r && Array.isArray(r.legs)) return hgObtcWithRetail(r, extra);
      }catch(e){}
    }
    return hgObtcWithRetail({ regime: 'unknown', bulls: 0, bears: 0, checked: 0, blackout: false, legs: [] }, extra);
  }

  function hgObtcFundamentalPanelHtml(regime){
    if (gfn('hgFundamentalPanelHtml')){
      try{ return W.hgFundamentalPanelHtml(regime) || ''; }catch(e){}
    }
    return '';
  }

  /* Evidence. Silent feeds stay UNCHECKED. Never mint levels. */
  function hgObtcEvidenceDecide(plan, ctx){
    var out = { ok: true, refuse: false, demote: false, chips: [], reason: '', unchecked: [] };
    try{
      if (!plan || !dirOf(plan.dir)) return out;
      var dir = dirOf(plan.dir);
      ctx = ctx || {};

      var oc = ctx.onchain;
      if (oc && oc.bias && oc.bias !== 'neutral'){
        out.chips.push('ONCHAIN ' + oc.bias);
        var flags = oc.flags || {};
        if (oc.bias === 'bearish' && dir === 'long' && (flags.feeSpike || flags.congestion === 'clogged'))
          out.demote = true;
        if (oc.bias === 'bullish' && dir === 'short' && flags.capitulation)
          out.demote = true;
      } else {
        out.unchecked.push('onchain');
      }

      var term = ctx.term;
      if (term && term.regime && term.regime !== 'flat'){
        out.chips.push('TERM ' + term.regime);
        if ((term.regime === 'contango' || term.regime === 'perp rich') && dir === 'long') out.demote = true;
        if ((term.regime === 'backwardation' || term.regime === 'perp cheap') && dir === 'short') out.demote = true;
      }

      var carry = ctx.carry;
      if (carry && isFinite(fin(carry.spreadAPR)))
        out.chips.push('CARRY ' + Number(carry.spreadAPR).toFixed(1) + '% APR');

      if (ctx.flow && ctx.flow.veto){
        out.ok = false; out.refuse = true; out.reason = ctx.flow.reason || 'flow trap';
      }
      if (ctx.postGate && ctx.postGate.ok === false){
        out.ok = false; out.refuse = true; out.reason = ctx.postGate.reason || 'post-gate veto';
      }
      if (typeof ctx.visionBoost === 'number' && ctx.visionBoost <= -10)
        out.demote = true;

      /* hg-v1002: the fundamental stack. Blackout REFUSES at flow-veto
         severity. A DECISIVE headwind (2+ net checked votes against the
         candidate's direction) demotes to watch — one witness never
         flips a setup. Tailwind and extremes print chips; chips inform,
         gates decide. Absent stack = UNCHECKED, never a fake read. */
      var fund = ctx.fundamental;
      if (fund && Array.isArray(fund.legs)){
        if (fund.blackout){
          out.ok = false; out.refuse = true;
          if (!out.reason) out.reason = 'macro event blackout — no fresh setup forms into a red-folder print';
          out.chips.push('EVENT BLACKOUT');
        } else {
          var against = dir === 'long' ? (fund.bears || 0) : (fund.bulls || 0);
          var withDir = dir === 'long' ? (fund.bulls || 0) : (fund.bears || 0);
          if (against - withDir >= 2){
            out.demote = true;
            out.chips.push('FUNDAMENTAL HEADWIND ' + against + 'v' + withDir);
          } else if (withDir - against >= 2){
            out.chips.push('FUNDAMENTAL TAILWIND ' + withDir + 'v' + against);
          }
          fund.legs.forEach(function(l){
            if (!l || l.state !== 'checked' || !l.extreme) return;
            if (l.key === 'fng') out.chips.push('F&G EXTREME');
            else if (l.key === 'rr25d') out.chips.push('RR25 EXTREME');
            else if (l.key === 'dvol') out.chips.push('DVOL EXTREME');
            else if (l.key === 'retail') out.chips.push('RETAIL EXTREME');
          });
        }
      } else {
        out.unchecked.push('fundamental');
      }
    }catch(e){}
    return out;
  }

  function btcRowFromList(list, key){
    var i, it, sym;
    if (!Array.isArray(list)) return null;
    for (i = 0; i < list.length; i++){
      it = list[i];
      if (!it) continue;
      sym = String(it.sym || it.symbol || it.pair || it.base || '');
      if (/BTC/i.test(sym) && !/ETH|SOL|XAU|PAXG/i.test(sym)) return key ? it[key] || it : it;
    }
    return null;
  }

  function evidenceFromExtra(extra){
    extra = extra || {};
    var ctx = { onchain: extra.onchain || null, term: extra.term || null, carry: extra.carry || null };
    if (!ctx.term && gfn('termBasisState')){
      try{
        var tb = W.termBasisState();
        var row = btcRowFromList((tb && (tb.rows || tb.pairs || tb.results)) || []);
        ctx.term = row && row.curve ? row.curve : (row || null);
      }catch(e1){}
    }
    if (!ctx.carry && gfn('carryState')){
      try{
        var cr = W.carryState();
        ctx.carry = btcRowFromList((cr && (cr.rows || cr.results || cr.pairs)) || []) || null;
      }catch(e2){}
    }
    /* hg-v1002: the fundamental stack rides the same ctx. The RESOLVED
       onchain/term feeds (fallbacks included) feed the regime so the card
       and the gate never read two different truths. */
    try{
      ctx.fundamental = hgObtcFundamentalRegime({
        onchain: ctx.onchain, term: ctx.term, carry: ctx.carry,
        fng: extra.fng, dom: extra.dom, retailLs: extra.retailLs,
        options: extra.options, dvol: extra.dvol, news: extra.news
      });
    }catch(e3){}
    return ctx;
  }

  /* Free sentiment reads. A host value wins. A failed fetch is not cached
     as a number. Ten minutes is enough that the second venue leg does not
     ask again. */
  var __obtcSentAt = { fng: 0, dom: 0 };
  var __obtcSentVal = { fng: null, dom: null };
  var OBTC_SENT_MS = 10 * 60 * 1000;

  function hgObtcSentTake(key){
    if (__obtcSentVal[key] == null) return null;
    if ((Date.now() - __obtcSentAt[key]) > OBTC_SENT_MS) return null;
    return __obtcSentVal[key];
  }
  function hgObtcFinitePct(v){
    if (v === null || v === undefined || v === '') return false;
    var n = +v;
    return isFinite(n) && n > 0 && n <= 100;
  }
  function hgObtcSentKeep(key, val){
    __obtcSentVal[key] = val;
    __obtcSentAt[key] = Date.now();
  }
  async function hgObtcFetchJson(url){
    if (typeof fetch !== 'function') return null;
    try{
      var res = await fetch(url, { cache: 'no-store' });
      if (!res || res.ok === false || typeof res.json !== 'function') return null;
      return await res.json();
    }catch(eFj){ return null; }
  }

  async function hgObtcGatherExtra(sym, ticker){
    var extra = { smart: null, onchain: null, term: null, carry: null, live: null };
    try{
      if (gfn('hgLiveFormationSnap')) extra.live = W.hgLiveFormationSnap(sym, ticker && ticker.dir);
    }catch(e0){}
    try{
      if (gfn('smartScanSymbol')) extra.smart = await W.smartScanSymbol('BTCUSDT', ticker || { symbol: sym });
    }catch(e1){}
    try{
      if (gfn('onchainFetch')) await W.onchainFetch();
      var st = gfn('onchainState') ? W.onchainState() : null;
      extra.onchain = (gfn('onchainSignal') && st) ? W.onchainSignal(st.snap) : null;
    }catch(e2){}
    /* hg-v1011: REAL FLOW FOR THE CVD SEAM. contract-report's CVD row has
       always accepted a taker series (inp.takerSeries -> hgOmniCvd) and this
       bag never carried one, so the row has read the candle-approximated
       stand-in for the whole life of the desk — derived from the same
       closes the momentum gates already read, labelled an approximation.
       One soft call to Binance's taker long/short endpoint makes it REAL
       aggressor flow. BTCUSDT is read whatever the execution leg: it is
       the global price-discovery perp for BTC, the same cross-venue read
       the desk already makes for positioning (smartScanSymbol('BTCUSDT')
       above). '4h' because the report's CVD row reads the 4h tape; 120
       windows cover its 30-window look with slack for missing prints.
       binance.js caches the call, so the second venue leg costs nothing.
       A failed fetch is a null, never an error up — the row then honestly
       keeps the stand-in and says so. */
    try{
      if (extra.takerSeries === undefined && gfn('binanceTakerRatio')){
        var tk = await W.binanceTakerRatio('BTCUSDT', '4h', 120);
        extra.takerSeries = (tk && Array.isArray(tk.series) && tk.series.length) ? tk.series : null;
      }
    }catch(eT){ extra.takerSeries = null; }
    /* hg-v1042: CROSS-VENUE FUNDING SPREAD — Binance's BTCUSDT funding (the
       global price-discovery perp) beside the venue ticker's own print, so
       the desk can show the local premium the CARRY tab already reads for
       every other coin. Evidence only; binance.js caches the call and a
       failure is a null, never an error up. */
    try{
      if (gfn('binanceFunding')){
        var bf = await W.binanceFunding('BTCUSDT');
        extra.btcFundingBinance = (bf && typeof bf.fundingPct === 'number' && isFinite(bf.fundingPct)) ? bf.fundingPct : null;
      }
    }catch(eBf){ extra.btcFundingBinance = null; }
    extra.term = evidenceFromExtra(extra).term;
    extra.carry = evidenceFromExtra(extra).carry;
    /* Sentiment. The host wins when it already has a number. Otherwise one
       free read: alternative.me Fear & Greed, CoinGecko BTC dominance, and
       Binance BTCUSDT global long/short. A failure stays unread. */
    try{
      if (extra.fng === undefined){ var hS = hostS(); extra.fng = (hS && hS.fng) ? hS.fng : null; }
    }catch(eF){}
    try{
      if (!(extra.fng && isFinite(+extra.fng.v))){
        var cachedF = hgObtcSentTake('fng');
        if (cachedF) extra.fng = cachedF;
        else {
          var fj = await hgObtcFetchJson('https://api.alternative.me/fng/?limit=1');
          var fd = fj && fj.data && fj.data[0];
          if (fd && isFinite(+fd.value)){
            extra.fng = { v: +fd.value, c: String(fd.value_classification || '') };
            hgObtcSentKeep('fng', extra.fng);
          }
        }
      }
    }catch(eFf){}
    try{
      if (extra.dom === undefined){ var hS2 = hostS(); extra.dom = (hS2 && hS2.dom != null) ? hS2.dom : null; }
    }catch(eD){}
    try{
      if (!hgObtcFinitePct(extra.dom)){
        var cachedD = hgObtcSentTake('dom');
        if (hgObtcFinitePct(cachedD)) extra.dom = cachedD;
        else {
          var gj = await hgObtcFetchJson('https://api.coingecko.com/api/v3/global');
          var btcDom = gj && gj.data && gj.data.market_cap_percentage && +gj.data.market_cap_percentage.btc;
          if (isFinite(btcDom)){ extra.dom = btcDom; hgObtcSentKeep('dom', btcDom); }
        }
      }
    }catch(eDg){}
    try{
      if (gfn('binanceLongShort')){
        var ls = await W.binanceLongShort('BTCUSDT', '4h', 6);
        extra.retailLs = (ls && ls.latest && isFinite(+ls.latest.longPct)) ? ls : null;
      }
    }catch(eLs){ extra.retailLs = null; }
    try{ if (gfn('deribitOptionsState')) extra.options = W.deribitOptionsState(); }catch(eO){}
    try{ if (gfn('deribitVolState')) extra.dvol = W.deribitVolState(); }catch(eV){}
    try{ if (gfn('hgNewsRisk')) extra.news = W.hgNewsRisk('BTC'); }catch(eN){}
    return extra;
  }

  function hgObtcApplyEvidence(row, extra, evOverride){
    if (!row) return { ok: true, row: row, ev: null };
    var ctx = evOverride || evidenceFromExtra(extra || {});
    var ev = hgObtcEvidenceDecide(row, ctx);
    if (ev.refuse || ev.ok === false) return { ok: false, row: null, ev: ev };
    if (ev.demote){
      row.clean = false;
      row.near = true;
      row.nearClean = true;
      row.forming = false;
      if (!(fin(row.passed) === 6)) row.passed = 6;
    }
    if (ev.chips && ev.chips.length) row.evidenceChips = ev.chips;
    return { ok: true, row: row, ev: ev };
  }

  W.hgObtcTryCoil = hgObtcTryCoil;
  W.hgObtcTryDiv = hgObtcTryDiv;
  W.hgObtcTryTrap = hgObtcTryTrap;
  W.hgObtcTryFundingFade = hgObtcTryFundingFade;
  W.hgObtcTrySmart = hgObtcTrySmart;
  W.hgObtcTryOiFlow = hgObtcTryOiFlow;
  W.hgObtcTrySmc = hgObtcTrySmc;
  W.hgObtcTryStarTrader = hgObtcTryStarTrader;
  W.hgObtcTryTsi = hgObtcTryTsi;          /* hg-v1057 accuracy pack */
  W.hgObtcTryAdaptive = hgObtcTryAdaptive;
  W.hgObtcTrySpring = hgObtcTrySpring;
  W.hgObtcRunExtraEngines = hgObtcRunExtraEngines;
  W.hgObtcEvidenceDecide = hgObtcEvidenceDecide;
  W.hgObtcGatherExtra = hgObtcGatherExtra;
  W.hgObtcApplyEvidence = hgObtcApplyEvidence;
  W.hgObtcFundamentalLegs = hgObtcFundamentalLegs;
  W.hgObtcFundamentalRegime = hgObtcFundamentalRegime;
  W.hgObtcFundamentalPanelHtml = hgObtcFundamentalPanelHtml;
})();
