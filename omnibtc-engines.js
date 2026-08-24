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
  ONCHAIN, TERM BASIS, CARRY, ORDER FLOW (CVD/OBI via hgAssessFlowTrap),
  OPTION FLOW (Deribit public put/call + DVOL), flow-trap / post-gate veto,
  chart-vision boost. Silent = UNCHECKED. They confirm, demote or refuse.
  They never mint levels.

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

    ledger.push(orderFlowLedger(extra));
    ledger.push(optionFlowLedger(extra));

    return { candidates: out, ledger: ledger };
  }

  function orderFlowLedger(extra){
    var fl = extra && extra.flowLong, fs = extra && extra.flowShort;
    if (!fl && !fs) return ledgerRow('ORDER FLOW', 'idle', null, 'CVD/OBI unread');
    if ((fl && fl.veto) || (fs && fs.veto)){
      var v = (fl && fl.veto) ? fl : fs;
      return ledgerRow('ORDER FLOW', 'idle', null, (v && v.reason) || 'flow trap');
    }
    if (fl && fl.flowOk) return ledgerRow('ORDER FLOW', 'idle', 'long', fl.flowDetail || 'CVD with long');
    if (fs && fs.flowOk) return ledgerRow('ORDER FLOW', 'idle', 'short', fs.flowDetail || 'CVD with short');
    if ((fl && fl.flowNA) && (!fs || fs.flowNA))
      return ledgerRow('ORDER FLOW', 'idle', null, (fl && fl.flowDetail) || 'FLOW N/A');
    return ledgerRow('ORDER FLOW', 'idle', null, 'no aligned CVD/OBI');
  }

  function optionFlowLedger(extra){
    var of = extra && extra.optionFlow;
    if (!of || !of.bias) return ledgerRow('OPTION FLOW', 'idle', null, 'Deribit put/call unread');
    var dir = of.bias === 'bullish' ? 'long' : (of.bias === 'bearish' ? 'short' : null);
    var det = of.bias;
    if (isFinite(fin(of.putCallVol))) det += ' · P/C ' + Number(of.putCallVol).toFixed(2);
    return ledgerRow('OPTION FLOW', 'idle', dir, det);
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

      var flow = ctx.flow;
      if (!flow){
        if (dir === 'long' && ctx.flowLong) flow = ctx.flowLong;
        else if (dir === 'short' && ctx.flowShort) flow = ctx.flowShort;
      }
      if (flow && flow.veto){
        out.ok = false; out.refuse = true; out.reason = flow.reason || 'flow trap';
      } else if (flow && flow.flowOk){
        out.chips.push('ORDER FLOW with');
      } else if (flow && flow.flowNA){
        out.unchecked.push('order-flow');
      } else if (flow){
        out.demote = true;
        out.chips.push('ORDER FLOW against');
      } else {
        out.unchecked.push('order-flow');
      }

      var of = ctx.optionFlow;
      if (!of || !of.bias){
        out.unchecked.push('option-flow');
      } else {
        out.chips.push('OPTION FLOW ' + of.bias);
        if ((of.bias === 'bearish' && dir === 'long') || (of.bias === 'bullish' && dir === 'short'))
          out.demote = true;
      }

      var dv = ctx.dvol;
      if (dv && dv.regime === 'extreme'){
        out.chips.push('DVOL extreme');
        out.demote = true;
      }

      if (ctx.postGate && ctx.postGate.ok === false){
        out.ok = false; out.refuse = true; out.reason = ctx.postGate.reason || 'post-gate veto';
      }
      if (typeof ctx.visionBoost === 'number' && ctx.visionBoost <= -10)
        out.demote = true;
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
    var ctx = { onchain: extra.onchain || null, term: extra.term || null, carry: extra.carry || null,
      flowLong: extra.flowLong || null, flowShort: extra.flowShort || null,
      optionFlow: extra.optionFlow || null, dvol: extra.dvol || null, flow: extra.flow || null };
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
    return ctx;
  }

  async function hgObtcGatherExtra(sym, ticker){
    var extra = { smart: null, onchain: null, term: null, carry: null, live: null,
      flowLong: null, flowShort: null, optionFlow: null, dvol: null };
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
    try{
      if (gfn('deribitVolSnapshot')) extra.dvol = await W.deribitVolSnapshot('BTC');
    }catch(e3){}
    try{
      if (gfn('deribitOptionFlowSnapshot')) extra.optionFlow = await W.deribitOptionFlowSnapshot('BTC');
    }catch(e4){}
    try{
      if (gfn('hgAssessFlowTrap')){
        var fr = ticker && isFinite(+ticker.fundingPct) ? +ticker.fundingPct : null;
        extra.flowLong = await W.hgAssessFlowTrap(sym, 'long', fr, '4h');
        extra.flowShort = await W.hgAssessFlowTrap(sym, 'short', fr, '4h');
      }
    }catch(e5){}
    if (!extra.dvol && gfn('deribitVolState')){
      try{ extra.dvol = W.deribitVolState(); }catch(e6){}
    }
    if (!extra.optionFlow && gfn('deribitOptionFlowState')){
      try{ extra.optionFlow = W.deribitOptionFlowState(); }catch(e7){}
    }
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
})();
