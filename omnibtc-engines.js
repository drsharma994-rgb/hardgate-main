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

  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  function hgObtcTrySmc(rows4h){
    try{
      if (!gfn('pineSmcCore') || !rows4h) return null;
      var sig = W.pineSmcCore(rows4h);
      return watchRow(sig, 'SMC ChoCh', 'near');
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

    take('SMC ChoCh', hgObtcTrySmc(rows4h), 'no last-bar ChoCh with FVG levels');
    take('STAR TRADER', hgObtcTryStarTrader(rows4h, rows1h, rows15m, ticker),
      'no majority, or synthesis vetoed');

    return { candidates: out, ledger: ledger };
  }

  /* ---- hg-v1002: THE FUNDAMENTAL STACK -----------------------------
     Legs read ONLY feeds the app already fetches. Each leg is
       { key, label, vote: 'bull'|'bear'|'neutral', state: 'checked'|'unchecked',
         text, info?, blackout?, extreme? }
     A leg that was not measured says UNCHECKED — a missing feed is never
     a neutral vote. info legs (DVOL, BTC.D) are priors: they render, they
     never vote. news never votes either; its blackout refuses elsewhere.
     Every threshold below is a house line already enforced elsewhere —
     F&G 80/20 is the S2 gate, |8| is the P9 risk-reversal line, DVOL
     85/65/40 is deribitVolClassify. Nothing is recalibrated here. */
  function hgObtcFundamentalLegs(extra){
    extra = extra || {};
    var legs = [];
    var hS = hostS();

    /* ON-CHAIN — the house composite (mempool.space). A real vote. */
    var oc = extra.onchain;
    if (oc && oc.bias){
      var ocVote = oc.bias === 'bullish' ? 'bull' : (oc.bias === 'bearish' ? 'bear' : 'neutral');
      var fl = oc.flags || {}, bits = [];
      if (fl.feeSpike) bits.push('fee spike');
      if (fl.congestion === 'clogged') bits.push('mempool clogged');
      if (fl.capitulation) bits.push('capitulation');
      if (isFinite(fin(oc.hashrateTrendPct))) bits.push('hashrate ' + (+fin(oc.hashrateTrendPct)).toFixed(1) + '%');
      legs.push({ key: 'onchain', label: 'ON-CHAIN', vote: ocVote, state: 'checked',
        text: 'bias ' + oc.bias + (bits.length ? ' · ' + bits.join(' · ') : '') });
    } else {
      legs.push({ key: 'onchain', label: 'ON-CHAIN', vote: 'neutral', state: 'unchecked',
        text: 'mempool.space read absent' });
    }

    /* TERM BASIS — same reads hgObtcEvidenceDecide already gates on. */
    var term = extra.term;
    var tReg = term && term.regime;
    if (tReg){
      var tVote = (tReg === 'contango' || tReg === 'perp rich') ? 'bear'
        : (tReg === 'backwardation' || tReg === 'perp cheap') ? 'bull' : 'neutral';
      legs.push({ key: 'term', label: 'TERM BASIS', vote: tVote, state: 'checked',
        text: String(tReg) + (tVote === 'bear' ? ' — longs pay to be long' : tVote === 'bull' ? ' — perp cheap / spot leads' : '') });
    } else {
      legs.push({ key: 'term', label: 'TERM BASIS', vote: 'neutral', state: 'unchecked',
        text: 'futures curve read absent' });
    }

    /* FEAR & GREED — contrarian at the house S2 extremes only. undefined
       means "never probed" (fall back to the host S); explicit null means
       "probed, absent" and stays unchecked. */
    var fng = extra.fng;
    if (fng === undefined) fng = (hS && hS.fng) ? hS.fng : null;
    if (fng && isFinite(fin(fng.v))){
      var fv = +fin(fng.v);
      var fVote = fv >= 80 ? 'bear' : (fv <= 20 ? 'bull' : 'neutral');
      legs.push({ key: 'fng', label: 'FEAR & GREED', vote: fVote, state: 'checked',
        extreme: fVote !== 'neutral',
        text: fv + ' ' + (fng.c || '')
          + (fVote === 'bear' ? ' — contrarian bear (house S2 ≥80 line)'
            : fVote === 'bull' ? ' — contrarian bull (house S2 ≤20 line)'
            : ' — no extreme, no vote') });
    } else {
      legs.push({ key: 'fng', label: 'FEAR & GREED', vote: 'neutral', state: 'unchecked',
        text: 'alternative.me read absent' });
    }

    /* 25Δ RISK REVERSAL — Deribit options positioning, state-only (the
       boot warmup fetched the book; a scan never refetches it). */
    var opt = extra.options;
    if (opt === undefined && gfn('deribitOptionsState')){
      try{ opt = W.deribitOptionsState(); }catch(eO){ opt = null; }
    }
    var rr = opt && opt.rr25d;
    if (rr && isFinite(fin(rr.rr25d))){
      var rv = +fin(rr.rr25d);
      var rExt = rr.extreme === true || (rr.extreme === undefined && Math.abs(rv) >= 8);
      var rBias = rr.bias || (rv > 0 ? 'CALLS RICH' : 'PUTS RICH');
      var rVote = rExt ? (rBias === 'PUTS RICH' ? 'bear' : 'bull') : 'neutral';
      legs.push({ key: 'rr25d', label: '25Δ RISK REVERSAL', vote: rVote, state: 'checked',
        extreme: rExt,
        text: 'rr ' + rv.toFixed(1) + ' · ' + rBias
          + (rExt ? ' · extreme (house |8| line)' : ' · inside the |8| line, no vote') });
    } else {
      legs.push({ key: 'rr25d', label: '25Δ RISK REVERSAL', vote: 'neutral', state: 'unchecked',
        text: 'Deribit options snap absent' });
    }

    /* DVOL — vol prior. INFO ONLY, never a vote. */
    var dv = extra.dvol;
    if (dv === undefined && gfn('deribitVolState')){
      try{ dv = W.deribitVolState(); }catch(eD){ dv = null; }
    }
    if (dv && isFinite(fin(dv.dvol))){
      legs.push({ key: 'dvol', label: 'DVOL (Deribit)', vote: 'neutral', state: 'checked', info: true,
        extreme: dv.regime === 'extreme',
        text: 'DVOL ' + (+fin(dv.dvol)).toFixed(1) + ' · ' + (dv.regime || 'normal') + ' — vol prior, never a vote' });
    } else {
      legs.push({ key: 'dvol', label: 'DVOL (Deribit)', vote: 'neutral', state: 'unchecked', info: true,
        text: 'DVOL snap absent' });
    }

    /* BTC DOMINANCE — house F1 convention: informational, judge it yourself. */
    var dom = extra.dom;
    if (dom === undefined) dom = (hS && hS.dom != null) ? hS.dom : null;
    if (isFinite(fin(dom))){
      legs.push({ key: 'dom', label: 'BTC DOMINANCE', vote: 'neutral', state: 'checked', info: true,
        text: (+fin(dom)).toFixed(1) + '% — informational (house F1: judge it yourself)' });
    } else {
      legs.push({ key: 'dom', label: 'BTC DOMINANCE', vote: 'neutral', state: 'unchecked', info: true,
        text: 'coingecko global read absent' });
    }

    /* EVENT RISK — never a vote. A checked blackout is the stack's one
       hard refuse; an unchecked calendar says so (hg-v992 honesty). */
    var news = extra.news;
    if (news === undefined && gfn('hgNewsRisk')){
      try{ news = W.hgNewsRisk('BTC'); }catch(eN){ news = null; }
    }
    if (news && !news.unchecked){
      legs.push({ key: 'news', label: 'EVENT RISK', vote: 'neutral', state: 'checked',
        blackout: news.blackout === true,
        text: news.blackout
          ? 'BLACKOUT — red-folder window: no fresh setup forms into the print'
          : 'risk ' + (news.risk || 'low') + ' — calendar checked, no blackout' });
    } else {
      legs.push({ key: 'news', label: 'EVENT RISK', vote: 'neutral', state: 'unchecked',
        text: 'calendar unchecked' + (news && news.note ? ' — ' + news.note : '') });
    }

    return legs;
  }

  /* Votes are counted among checked DIRECTIONAL legs only (onchain, term,
     fng, rr25d). unknown = nothing directional was measured; quiet = read
     but no extremes; mixed = tied. */
  function hgObtcFundamentalRegime(extra){
    var legs = hgObtcFundamentalLegs(extra);
    var bulls = 0, bears = 0, checked = 0, blackout = false;
    legs.forEach(function(l){
      if (!l) return;
      if (l.blackout) blackout = true;
      if (l.info || l.key === 'news') return;
      if (l.state !== 'checked') return;
      checked++;
      if (l.vote === 'bull') bulls++;
      else if (l.vote === 'bear') bears++;
    });
    var regime = 'unknown';
    if (checked > 0){
      if (bulls === 0 && bears === 0) regime = 'quiet';
      else if (bulls === bears) regime = 'mixed';
      else regime = bulls > bears ? 'bullish' : 'bearish';
    }
    return { regime: regime, bulls: bulls, bears: bears, checked: checked, blackout: blackout, legs: legs };
  }

  function hgObtcFundamentalPanelHtml(regime){
    if (!regime || !Array.isArray(regime.legs)) return '';
    var html = '<div class="note" style="margin-top:10px" data-obtc-fundamental="1"><b>FUNDAMENTAL REGIME — '
      + esc(String(regime.regime || 'unknown').toUpperCase()) + '</b>'
      + ' · ' + regime.bulls + ' bull / ' + regime.bears + ' bear of ' + regime.checked + ' directional checked'
      + (regime.blackout ? ' · <b>EVENT BLACKOUT — no fresh setup forms</b>' : '')
      + '<br><span class="dim">Evidence, not tickets: a 2+-vote headwind demotes to watch, a blackout refuses, one witness never flips a setup. DVOL and BTC.D are priors — they never vote.</span></div>';
    html += '<div class="cr-ind-wrap">';
    regime.legs.forEach(function(l){
      if (!l) return;
      var mark = '—';
      if (l.blackout) mark = 'BLACKOUT';
      else if (l.state !== 'checked') mark = '—';
      else if (l.info) mark = 'INFO';
      else mark = l.vote === 'bull' ? 'BULL' : l.vote === 'bear' ? 'BEAR' : 'NEUTRAL';
      html += '<div class="kv"><span class="k">' + esc(l.label) + '</span><span class="v">'
        + esc(mark) + (l.text ? ' · ' + esc(l.text) : '') + '</span></div>';
    });
    return html + '</div>';
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
        fng: extra.fng, dom: extra.dom,
        options: extra.options, dvol: extra.dvol, news: extra.news
      });
    }catch(e3){}
    return ctx;
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
    extra.term = evidenceFromExtra(extra).term;
    extra.carry = evidenceFromExtra(extra).carry;
    /* hg-v1002: sentiment / options positioning / event risk join the
       evidence bag. STATE-ONLY reads — the Deribit book is boot-warmed
       (HG_warmups 'dvol'), so a scan never refetches it; F&G and BTC.D
       sit on the host S; hgNewsRisk is synchronous by contract. */
    try{
      if (extra.fng === undefined){ var hS = hostS(); extra.fng = (hS && hS.fng) ? hS.fng : null; }
    }catch(eF){}
    try{
      if (extra.dom === undefined){ var hS2 = hostS(); extra.dom = (hS2 && hS2.dom != null) ? hS2.dom : null; }
    }catch(eD){}
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
  W.hgObtcRunExtraEngines = hgObtcRunExtraEngines;
  W.hgObtcEvidenceDecide = hgObtcEvidenceDecide;
  W.hgObtcGatherExtra = hgObtcGatherExtra;
  W.hgObtcApplyEvidence = hgObtcApplyEvidence;
  W.hgObtcFundamentalLegs = hgObtcFundamentalLegs;
  W.hgObtcFundamentalRegime = hgObtcFundamentalRegime;
  W.hgObtcFundamentalPanelHtml = hgObtcFundamentalPanelHtml;
})();
